import type { APIRoute } from 'astro';
import { publishedFiches, browseCounts, altCounts, INTENTS } from '../lib/db';
import { browsePath } from '../lib/browse';
import { SITE } from '../lib/seo';
export const prerender = false;
export const GET: APIRoute = async () => {
  // Chaque fiche publiée, qu'elle soit au classement ou non : une app payante a une fiche publique elle aussi.
  const apps = await publishedFiches().catch(() => []);
  const pages: { fr: string; en: string; mod?: string; prio: string }[] = [
    { fr: '/', en: '/en', prio: '1.0' }, { fr: '/ajouter', en: '/en/ajouter', prio: '0.5' }, { fr: '/methode', en: '/en/methode', prio: '0.6' }, { fr: '/chiffres', en: '/en/chiffres', prio: '0.7' }, { fr: '/confidentialite', en: '/en/confidentialite', prio: '0.2' },
    ...apps.map((a) => ({ fr: `/app/${a.slug}`, en: `/en/app/${a.slug}`, mod: new Date(a.last_commit ?? a.created_at).toISOString().slice(0, 10), prio: '0.8' })),
  ];
  // Les pages « Parcourir » : chaque valeur qui a au moins une app, plus les intentions.
  const counts = await browseCounts().catch(() => ({ tool: {}, platform: {}, language: {}, intent: {} }));
  const browse = [
    ...Object.keys(counts.tool).map((v) => ({ kind: 'tool' as const, value: v })),
    ...Object.keys(counts.platform).map((v) => ({ kind: 'platform' as const, value: v })),
    ...Object.keys(counts.language).map((v) => ({ kind: 'language' as const, value: v })),
    ...INTENTS.map((v) => ({ kind: 'intent' as const, value: v })),
    ...(await altCounts().catch(() => [])).map((x) => ({ kind: 'alt' as const, value: x.slug })),
  ];
  for (const b of browse) pages.push({ fr: browsePath(b, 'fr'), en: browsePath(b, 'en'), prio: '0.7' });
  const url = (p: typeof pages[number], l: 'fr' | 'en') => `<url><loc>${SITE}${p[l]}</loc>${p.mod ? `<lastmod>${p.mod}</lastmod>` : ''}<priority>${p.prio}</priority><xhtml:link rel="alternate" hreflang="fr" href="${SITE}${p.fr}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/></url>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.flatMap((p) => [url(p, 'fr'), url(p, 'en')]).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
