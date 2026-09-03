import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
import { installationToken } from '../../../lib/github';
import { commitDates, compute, statusFor } from '../../../lib/metrics';
export const prerender = false;
// Relit chaque repo publié, une fois par nuit. Appelé par Vercel Cron avec le CRON_SECRET.
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET;
  if (!hasDb || !secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('non', { status: 401 });
  const apps = (await sql.query(
    `select a.id, a.full_name, a.active_days, a.status, u.installation_id, u.access_token from apps a join users u on u.id = a.user_id where a.published`,
  )) as { id: number; full_name: string; active_days: number; status: string; installation_id: number | null; access_token: string | null }[];
  let ok = 0, failed = 0;
  for (const a of apps) {
    try {
      let token = a.access_token;
      if (a.installation_id) { try { token = await installationToken(a.installation_id); } catch (e) { console.error('jeton d\'installation', e); } }
      if (!token) throw new Error('aucun jeton');
      const m = compute(await commitDates(token, a.full_name));
      const status = statusFor(m.last_commit, a.status);
      await sql.query(
        `update apps set first_commit=$2, last_commit=$3, commits=$4, active_days=$5, active_days_30=$6, best_streak_weeks=$7, weekly=$8, status=$9, refreshed_at=now() where id=$1`,
        [a.id, m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly, status],
      );
      if (m.active_days > a.active_days) await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'day', $2)`, [a.id, JSON.stringify({ n: m.active_days })]);
      if (status !== a.status) await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'status', $2)`, [a.id, JSON.stringify({ status })]);
      ok++;
    } catch (e) { failed++; console.error(a.full_name, e); }
  }
  return Response.json({ ok, failed });
};
