import { neon } from '@neondatabase/serverless';
export const sql = neon(import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL ?? '');
export const hasDb = Boolean(import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL);

export interface DbApp {
  id: number; user_id: number; repo_id: number; full_name: string; slug: string; name: string;
  description: string | null; language: string | null; private: boolean; homepage: string | null;
  url: string | null; image_url: string | null; longest: string | null; tool: string | null;
  pricing: 'free' | 'donations' | 'paid'; status: 'polishing' | 'done' | 'paused';
  first_commit: string | null; last_commit: string | null; commits: number; active_days: number;
  active_days_30: number; best_streak_weeks: number; weekly: number[]; bravos: number; clicks: number;
  published: boolean; refreshed_at: string | null; created_at: string; login?: string;
}

export async function rankedApps(period: 'all' | 'month' = 'all', limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  const order = period === 'all' ? 'active_days' : 'active_days_30';
  return (await sql.query(
    `select a.*, u.login from apps a join users u on u.id = a.user_id
     where a.published and a.pricing <> 'paid' and a.status = 'polishing'
     order by ${order} desc, a.commits desc limit $1`, [limit],
  )) as DbApp[];
}
export async function doneApps(limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  return (await sql.query(
    `select a.*, u.login from apps a join users u on u.id = a.user_id
     where a.published and a.status <> 'polishing' order by active_days desc limit $1`, [limit],
  )) as DbApp[];
}
export async function appBySlug(slug: string): Promise<DbApp | null> {
  if (!hasDb) return null;
  const rows = (await sql.query(`select a.*, u.login from apps a join users u on u.id = a.user_id where a.slug = $1`, [slug])) as DbApp[];
  return rows[0] ?? null;
}
export async function totals() {
  if (!hasDb) return { apps: 0, days: 0 };
  const [r] = (await sql.query(`select count(*)::int as apps, coalesce(sum(active_days),0)::int as days from apps where published`)) as { apps: number; days: number }[];
  return r;
}
export async function recentActivity(limit = 8) {
  if (!hasDb) return [];
  return (await sql.query(
    `select act.kind, act.payload, act.created_at, a.name, a.slug from activity act join apps a on a.id = act.app_id
     where a.published order by act.created_at desc limit $1`, [limit],
  )) as { kind: string; payload: Record<string, unknown>; created_at: string; name: string; slug: string }[];
}
