import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
import { installationRepos } from '../../../lib/github';
import { commitDates, compute } from '../../../lib/metrics';
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
  let firstSlug = '';
  for (const r of repos) {
    let slug = slugify(r.name);
    const taken = (await sql.query(`select 1 from apps where slug = $1 and repo_id <> $2`, [slug, r.id])) as unknown[];
    if (taken.length) slug = `${slug}-${slugify(user.login)}`;
    const m = compute(await commitDates(user.access_token, r.full_name));
    const [row] = (await sql.query(
      `insert into apps (user_id, repo_id, full_name, slug, name, description, language, private, homepage, url,
         first_commit, last_commit, commits, active_days, active_days_30, best_streak_weeks, weekly, published, refreshed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,true,now())
       on conflict (repo_id) do update set description = excluded.description, language = excluded.language, homepage = excluded.homepage,
         first_commit = excluded.first_commit, last_commit = excluded.last_commit, commits = excluded.commits, active_days = excluded.active_days,
         active_days_30 = excluded.active_days_30, best_streak_weeks = excluded.best_streak_weeks, weekly = excluded.weekly, published = true, refreshed_at = now()
       returning id, slug, (xmax = 0) as inserted`,
      [user.id, r.id, r.full_name, slug, r.name, r.description, r.language, r.private, r.homepage || null,
       m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly],
    )) as { id: number; slug: string; inserted: boolean }[];
    if (row.inserted) await sql.query(`insert into activity (app_id, kind) values ($1, 'arrived')`, [row.id]);
    firstSlug ||= row.slug;
  }
  return redirect(`${lang}/app/${firstSlug}/modifier`, 302);
};
