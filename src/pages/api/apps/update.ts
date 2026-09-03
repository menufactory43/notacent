import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
export const prerender = false;
const TOOLS = ['Claude Code', 'Cursor', 'Lovable', 'Bolt', 'Copilot', 'Codex', 'Autre'];
const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null;
const httpOnly = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user) return redirect(`${lang}/?erreur=session`, 302);
  const f = await request.formData();
  const slug = clean(f.get('slug'), 120);
  const tool = TOOLS.includes(String(f.get('tool'))) ? String(f.get('tool')) : null;
  const pricing = ['free', 'donations', 'paid'].includes(String(f.get('pricing'))) ? String(f.get('pricing')) : 'free';
  const status = ['polishing', 'done', 'paused'].includes(String(f.get('status'))) ? String(f.get('status')) : 'polishing';
  const rows = (await sql.query(
    `update apps set url = $1, image_url = $2, longest = $3, tool = $4, pricing = $5, status = $6, name = coalesce($7, name)
     where slug = $8 and user_id = $9 returning id, slug`,
    [httpOnly(clean(f.get('url'), 500)), httpOnly(clean(f.get('image_url'), 500)), clean(f.get('longest'), 600), tool, pricing, status, clean(f.get('name'), 80), slug, user.id],
  )) as { id: number; slug: string }[];
  if (!rows.length) return redirect(`${lang}/?erreur=fiche`, 302);
  if (status !== 'polishing') await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'status', $2)`, [rows[0].id, JSON.stringify({ status })]);
  return redirect(`${lang}/app/${rows[0].slug}`, 302);
};
