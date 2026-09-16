import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
import { installationRepos, repoInfo } from '../../../lib/github';
import { guessPlatform } from '../../../lib/platform';
import { commitDates, compute } from '../../../lib/metrics';
import { pingIndexNow, appPaths } from '../../../lib/indexnow';
export const prerender = false;

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user?.access_token || !user.installation_id) return redirect(`${lang}/?erreur=session`, 302);
  const form = await request.formData();
  const ids = form.getAll('repo').map(Number).filter(Boolean);
  if (!ids.length) return redirect(`${lang}/ajouter`, 302);
  const repos = (await installationRepos(user.access_token, user.installation_id)).filter((r) => ids.includes(r.id));
  const slugs: string[] = [];
  for (const r of repos) {
    let slug = slugify(r.name);
    const taken = (await sql.query(`select 1 from apps where slug = $1 and repo_id <> $2`, [slug, r.id])) as unknown[];
    if (taken.length) slug = `${slug}-${slugify(user.login)}`;
    const m = compute(await commitDates(user.access_token, r.full_name));
    // Étoiles et sujets : un appel de plus, pour la plateforme devinée et le signal « sous les radars ».
    const info = await repoInfo(user.access_token, r.full_name).catch(() => null);
    const stars = r.private ? 0 : info?.stargazers_count ?? 0;
    const platform = guessPlatform({ language: r.language, topics: info?.topics, name: r.name, description: r.description, homepage: r.homepage });
    const [row] = (await sql.query(
      `insert into apps (user_id, repo_id, full_name, slug, name, description, language, private, homepage, url,
         first_commit, last_commit, commits, active_days, active_days_30, best_streak_weeks, weekly, published, refreshed_at, stars, platform)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,true,now(),$17,$18)
       on conflict (repo_id) do update set description = excluded.description, language = excluded.language, homepage = excluded.homepage,
         first_commit = excluded.first_commit, last_commit = excluded.last_commit, commits = excluded.commits, active_days = excluded.active_days,
         active_days_30 = excluded.active_days_30, best_streak_weeks = excluded.best_streak_weeks, weekly = excluded.weekly, published = true, refreshed_at = now(),
         stars = excluded.stars, platform = coalesce(apps.platform, excluded.platform)
       returning id, slug, (xmax = 0) as inserted`,
      [user.id, r.id, r.full_name, slug, r.name, r.description, r.language, r.private, r.homepage || null,
       m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly, stars, platform],
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
