import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
import { installationToken, repoInfo } from '../../../lib/github';
import { guessPlatform } from '../../../lib/platform';
import { sendAlerts } from '../../../lib/alerts';
import { commitDates, compute, statusFor } from '../../../lib/metrics';
import { open } from '../../../lib/crypto';
import { adminLogin } from '../../../lib/outreach';
import { pingIndexNow, appPaths } from '../../../lib/indexnow';
import { browsePath } from '../../../lib/browse';
import { browseCounts, INTENTS } from '../../../lib/db';
export const prerender = false;
// Relit chaque repo publié, une fois par nuit. Appelé par Vercel Cron avec le CRON_SECRET.
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET;
  if (!hasDb || !secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('non', { status: 401 });
  const apps = (await sql.query(
    `select a.id, a.full_name, a.active_days, a.status, a.private, a.platform, a.language, a.name, a.description, a.homepage, u.installation_id, u.access_token from apps a join users u on u.id = a.user_id where a.published`,
  )) as { id: number; full_name: string; active_days: number; status: string; private: boolean; platform: string | null; language: string | null; name: string; description: string | null; homepage: string | null; installation_id: number | null; access_token: string | null }[];
  // Les fiches non réclamées n'ont pas de jeton : on lit leur repo public avec celui de l'admin.
  const [admin] = adminLogin() ? ((await sql.query(`select access_token from users where login = $1`, [adminLogin()])) as { access_token: string | null }[]) : [];
  const fallback = open(admin?.access_token ?? null);
  let ok = 0, failed = 0;
  for (const a of apps) {
    try {
      let token = open(a.access_token);
      if (a.installation_id) { try { token = await installationToken(a.installation_id); } catch (e) { console.error('jeton d\'installation', e); } }
      if (!token && !a.private) token = fallback;
      if (!token) throw new Error('aucun jeton');
      const m = compute(await commitDates(token, a.full_name));
      const status = statusFor(m.last_commit, a.status);
      const info = await repoInfo(token, a.full_name).catch(() => null);
      const stars = a.private ? 0 : info?.stargazers_count ?? null;
      const platform = a.platform ?? guessPlatform({ language: info?.language ?? a.language, topics: info?.topics, name: a.name, description: a.description, homepage: a.homepage });
      await sql.query(
        `update apps set first_commit=$2, last_commit=$3, commits=$4, active_days=$5, active_days_30=$6, best_streak_weeks=$7, weekly=$8, status=$9, refreshed_at=now(), stars=coalesce($10, stars), platform=$11 where id=$1`,
        [a.id, m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly, status, stars, platform],
      );
      if (m.active_days > a.active_days) await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'day', $2)`, [a.id, JSON.stringify({ n: m.active_days })]);
      if (status !== a.status) await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'status', $2)`, [a.id, JSON.stringify({ status })]);
      ok++;
    } catch (e) { failed++; console.error(a.full_name, e); }
  }
  // Une fois les chiffres à jour : les alertes dues partent, s'il y a de quoi les remplir.
  const alerts = await sendAlerts().catch((e) => { console.error('alertes', e); return { sent: 0, skipped: 0 }; });
  // Les chiffres ont changé sur chaque fiche, l'accueil et les pages Parcourir : on le dit à IndexNow.
  const slugs = (await sql.query(`select slug from apps where published`)) as { slug: string }[];
  const counts = await browseCounts().catch(() => ({ tool: {}, platform: {}, language: {}, intent: {} }));
  const browse = [
    ...Object.keys(counts.tool).map((v) => ({ kind: 'tool' as const, value: v })), ...Object.keys(counts.platform).map((v) => ({ kind: 'platform' as const, value: v })),
    ...Object.keys(counts.language).map((v) => ({ kind: 'language' as const, value: v })), ...INTENTS.map((v) => ({ kind: 'intent' as const, value: v })),
  ];
  const indexnow = await pingIndexNow(['/', '/en', ...slugs.flatMap((r) => appPaths(r.slug)), ...browse.flatMap((b) => [browsePath(b, 'fr'), browsePath(b, 'en')])]);
  return Response.json({ ok, failed, alerts, indexnow });
};
