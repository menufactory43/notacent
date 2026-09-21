import type { APIRoute } from 'astro';
import { figures } from '../lib/figures';
import { SITE } from '../lib/seo';
export const prerender = false;
// Les chiffres de /chiffres, bruts : pour qui veut les reprendre sans lire du HTML. Même calcul, même date.
export const GET: APIRoute = async () => {
  const f = await figures().catch(() => null);
  if (!f) return new Response(null, { status: 503 });
  const body = { source: `${SITE}/en/chiffres`, method: `${SITE}/en/methode`, license: 'CC BY 4.0', population: 'Published, free or donation-based apps listed on Not a Cent, read from their GitHub repo', ...f };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
};
