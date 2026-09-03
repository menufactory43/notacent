import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
export const prerender = false;
// Compte un clic puis envoie vers l'app.
export const GET: APIRoute = async ({ url, redirect }) => {
  const slug = url.searchParams.get('slug') ?? '';
  if (!hasDb) return redirect('/', 302);
  const [r] = (await sql.query(`update apps set clicks = clicks + 1 where slug = $1 and published returning coalesce(url, homepage, 'https://github.com/' || full_name) as target`, [slug])) as { target: string }[];
  return redirect(r?.target ?? '/', 302);
};
