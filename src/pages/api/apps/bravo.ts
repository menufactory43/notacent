import type { APIRoute } from 'astro';
import { createHmac } from 'node:crypto';
import { sql, hasDb } from '../../../lib/db';
export const prerender = false;
// Un bravo par personne et par app, sans compte. Le cookie évite un aller-retour, mais il s'efface d'une fenêtre privée
// ou d'un curl : ce qui compte, c'est bravo_votes, une ligne par app et par votant. Le votant est une empreinte de l'IP
// (HMAC avec le secret de session), jamais l'adresse. En IPv6, le /64 : un abonné en a des milliards à sa disposition.
// Une IPv4 écrite en IPv6 (::ffff:1.2.3.4) reste cette IPv4 ; sinon « :: » est déplié pour que 2001:db8::1 et 2001:db8::2 tombent ensemble.
const prefix64 = (ip: string) => {
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (v4) return v4[1];
  const [head, tail] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail === undefined ? [] : tail ? tail.split(':') : [];
  const full = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return full.slice(0, 4).map((x) => parseInt(x || '0', 16).toString(16)).join(':');
};
const voterOf = (ip: string) => {
  const key = ip.includes(':') ? prefix64(ip) : ip;
  const secret = import.meta.env.SESSION_SECRET ?? process.env.SESSION_SECRET ?? '';
  return createHmac('sha256', secret).update(`bravo:${key}`).digest('base64url').slice(0, 22);
};
export const POST: APIRoute = async ({ request, cookies, clientAddress, url }) => {
  if (!hasDb) return new Response('{"error":"no db"}', { status: 503 });
  // Le bouton de la fiche, pas un autre site : un en-tête Origin étranger est refusé.
  const origin = request.headers.get('origin');
  if (origin && URL.parse(origin)?.host !== url.host) return new Response('{"error":"origin"}', { status: 403 });
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return new Response('{"error":"slug"}', { status: 400 });
  const done = new Set((cookies.get('nac_bravo')?.value ?? '').split(',').filter(Boolean));
  const remember = () => { done.add(slug); cookies.set('nac_bravo', [...done].slice(-200).join(','), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }); };
  const count = async () => ((await sql.query(`select bravos from apps where slug = $1 and published`, [slug])) as { bravos: number }[])[0];
  if (done.has(slug)) return Response.json({ bravos: (await count())?.bravos ?? 0, already: true });
  let ip = '';
  try { ip = clientAddress; } catch { /* en dev, sans adaptateur */ }
  if (!ip) return new Response('{"error":"ip"}', { status: 400 });
  // Le vote et le compteur dans la même requête : pas de vote, pas de +1.
  const [r] = (await sql.query(
    `with v as (insert into bravo_votes (app_id, voter) select id, $2 from apps where slug = $1 and published on conflict do nothing returning app_id)
     update apps set bravos = bravos + 1 where id in (select app_id from v) returning bravos`,
    [slug, voterOf(ip)],
  )) as { bravos: number }[];
  if (r) { remember(); return Response.json({ bravos: r.bravos }); }
  const known = await count();
  if (!known) return new Response('{"error":"unknown"}', { status: 404 });
  remember();
  return Response.json({ bravos: known.bravos, already: true });
};
