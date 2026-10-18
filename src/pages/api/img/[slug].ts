import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
export const prerender = false;
// Les images vivent dans la base : sans cache CDN, chaque affichage la réveillait et lui faisait sortir les octets.
// Les fiches pointent sur /api/img/slug?v=<date de l'image> : une nouvelle image change d'adresse, l'ancienne peut rester en cache un an.
export const GET: APIRoute = async ({ params, url }) => {
  if (!hasDb) return new Response(null, { status: 404 });
  const [r] = (await sql.query(`select image, image_type from apps where slug = $1 and image is not null`, [params.slug])) as { image: Uint8Array | string; image_type: string }[];
  if (!r) return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } });
  const bytes = typeof r.image === 'string' ? Buffer.from(r.image.replace(/^\\x/, ''), 'hex') : Buffer.from(r.image);
  const cache = url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
  return new Response(bytes, { headers: { 'Content-Type': r.image_type || 'image/png', 'Cache-Control': cache } });
};
