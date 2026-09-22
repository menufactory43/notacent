import type { APIRoute } from 'astro';
import { figures } from '../lib/figures';
import { SITE } from '../lib/seo';
export const prerender = false;
// Les chiffres de /chiffres, bruts : pour qui veut les reprendre sans lire du HTML. Même calcul, même date.
export const GET: APIRoute = async () => {
  const f = await figures().catch(() => null);
  if (!f) return new Response(null, { status: 503 });
  const body = { source: `${SITE}/en/chiffres`, method: `${SITE}/en/methode`, license: 'CC BY 4.0', population: 'Every app listed on Not a Cent, whatever its business model (free, one-time purchase, subscription): apps that have not made money yet according to their maker, or just their first euro. Unclaimed cards have declared nothing and still count. Work is read from the GitHub repo; revenue is declared, not verified. Widened on 2026-09-22: before, free or donation-based apps only.', ...f };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
};
