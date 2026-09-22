import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
import { repoInfo, serverToken, installationToken } from '../../../lib/github';
import { guessPlatform } from '../../../lib/platform';
import { readDates, compute } from '../../../lib/metrics';
import { makerRepos, syncInstallation } from '../../../lib/repos';
import { pingIndexNow, appPaths } from '../../../lib/indexnow';
import { refreshSigning } from '../../../lib/signing';
export const prerender = false;

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user) return redirect(`${lang}/?erreur=session`, 302);
  const form = await request.formData();
  const ids = form.getAll('repo').map(Number).filter(Boolean);
  if (!ids.length) return redirect(`${lang}/ajouter`, 302);
  // La règle d'entrée : pas encore d'argent gagné, déclaré sur l'honneur. Le travail se lit dans le repo, le revenu non.
  if (form.get('declare') !== 'on') return redirect(`${lang}/ajouter?erreur=revenu`, 302);
  const installationId = await syncInstallation(user);
  const repos = (await makerRepos(user.login, installationId)).filter((r) => ids.includes(r.id));
  const slugs: string[] = [];
  for (const r of repos) {
    let slug = slugify(r.name);
    const taken = (await sql.query(`select 1 from apps where slug = $1 and repo_id <> $2`, [slug, r.id])) as unknown[];
    if (taken.length) slug = `${slug}-${slugify(user.login)}`;
    const [known] = (await sql.query(`select active_dates, commits from apps where repo_id = $1`, [r.id])) as { active_dates: string[]; commits: number }[];
    const read = await readDates({ full_name: r.full_name, private: r.private, installation_id: installationId, known: known?.active_dates ?? [], makers: [user.login] });
    const m = compute(read.dates, Date.now(), read.commits ?? (r.private ? known?.commits : undefined));
    // Étoiles et sujets : un appel de plus, pour la plateforme devinée et le signal « sous les radars ».
    const token = r.private ? (installationId ? await installationToken(installationId).catch(() => null) : null) : await serverToken().catch(() => null);
    const info = token ? await repoInfo(token, r.full_name).catch(() => null) : null;
    const stars = r.private ? 0 : info?.stargazers_count ?? 0;
    const platform = guessPlatform({ language: r.language, topics: info?.topics, name: r.name, description: r.description, homepage: r.homepage });
    // App Store et notarisation, dès la première lecture : c'est ce qu'on regarde avant de télécharger un binaire.
    const sign = await refreshSigning({ full_name: r.full_name, private: r.private, platform, store_url: null, url: r.homepage, homepage: r.homepage, store: null, notarized: null }, r.private ? null : token).catch(() => ({ store: null, notarized: null }));
    const [row] = (await sql.query(
      `insert into apps (user_id, repo_id, full_name, slug, name, description, language, private, homepage, url,
         first_commit, last_commit, commits, active_days, active_days_30, best_streak_weeks, weekly, published, refreshed_at, stars, platform, active_dates, authors, owner_commits, store, notarized, revenue_source, revenue_declared_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,true,now(),$17,$18,$19,$20,$21,$22,$23,'declared',now())
       on conflict (repo_id) do update set description = excluded.description, language = excluded.language, homepage = excluded.homepage,
         first_commit = excluded.first_commit, last_commit = excluded.last_commit, commits = excluded.commits, active_days = excluded.active_days,
         active_days_30 = excluded.active_days_30, best_streak_weeks = excluded.best_streak_weeks, weekly = excluded.weekly, published = true, refreshed_at = now(),
         stars = excluded.stars, platform = coalesce(apps.platform, excluded.platform), active_dates = excluded.active_dates, authors = coalesce(excluded.authors, apps.authors), owner_commits = coalesce(excluded.owner_commits, apps.owner_commits), store = coalesce(excluded.store, apps.store), notarized = coalesce(excluded.notarized, apps.notarized),
         revenue_source = coalesce(apps.revenue_source, 'declared'), revenue_declared_at = coalesce(apps.revenue_declared_at, now())
       returning id, slug, (xmax = 0) as inserted`,
      [user.id, r.id, r.full_name, slug, r.name, r.description, r.language, r.private, r.homepage || null,
       m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly, stars, platform, read.ledger, read.authors ?? 1, read.ownerCommits ?? null, sign.store && JSON.stringify(sign.store), sign.notarized && JSON.stringify(sign.notarized)],
    )) as { id: number; slug: string; inserted: boolean }[];
    if (row.inserted) await sql.query(`insert into activity (app_id, kind) values ($1, 'arrived')`, [row.id]);
    slugs.push(row.slug);
  }
  if (!slugs.length) return redirect(`${lang}/ajouter`, 302);
  await pingIndexNow(['/', '/en', ...slugs.flatMap(appPaths)]);
  // Plusieurs repos cochés : on enchaîne les fiches, une par une, dans l'ordre de publication.
  cookies.set('nac_batch', slugs.join(','), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600 });
  return redirect(`${lang}/app/${slugs[0]}/modifier`, 302);
};
