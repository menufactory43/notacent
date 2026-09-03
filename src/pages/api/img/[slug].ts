import type { APIRoute } from 'astro';
import { sql, hasDb } from '../../../lib/db';
export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  if (!hasDb) return new Response(null, { status: 404 });
  const [r] = (await sql.query(`select image, image_type from apps where slug = $1 and image is not null`, [params.slug])) as { image: Uint8Array | string; image_type: string }[];
  if (!r) return new Response(null, { status: 404 });
  const bytes = typeof r.image === 'string' ? Buffer.from(r.image.replace(/^\\x/, ''), 'hex') : Buffer.from(r.image);
  return new Response(bytes, { headers: { 'Content-Type': r.image_type || 'image/png', 'Cache-Control': 'public, max-age=300' } });
};
