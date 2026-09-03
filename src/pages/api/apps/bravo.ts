import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
export const prerender = false;
// Un bravo par navigateur et par app, sans compte : un cookie liste les slugs déjà applaudis.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasDb) return new Response('{"error":"no db"}', { status: 503 });
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return new Response('{"error":"slug"}', { status: 400 });
  const done = new Set((cookies.get('nac_bravo')?.value ?? '').split(',').filter(Boolean));
  if (done.has(slug)) {
    const [r] = (await sql.query(`select bravos from apps where slug = $1`, [slug])) as { bravos: number }[];
    return Response.json({ bravos: r?.bravos ?? 0, already: true });
  }
  const [r] = (await sql.query(`update apps set bravos = bravos + 1 where slug = $1 and published returning bravos`, [slug])) as { bravos: number }[];
  if (!r) return new Response('{"error":"unknown"}', { status: 404 });
  done.add(slug);
  cookies.set('nac_bravo', [...done].slice(-200).join(','), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return Response.json({ bravos: r.bravos });
};
