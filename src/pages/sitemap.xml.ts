import type { APIRoute } from 'astro';
import { rankedApps, doneApps } from '../lib/db';
import { SITE } from '../lib/seo';
export const prerender = false;
export const GET: APIRoute = async () => {
  const apps = [...(await rankedApps('all', 1000).catch(() => [])), ...(await doneApps(1000).catch(() => []))];
  const pages: { fr: string; en: string; mod?: string; prio: string }[] = [
    { fr: '/', en: '/en', prio: '1.0' }, { fr: '/ajouter', en: '/en/ajouter', prio: '0.5' }, { fr: '/confidentialite', en: '/en/confidentialite', prio: '0.2' },
    ...apps.map((a) => ({ fr: `/app/${a.slug}`, en: `/en/app/${a.slug}`, mod: new Date(a.last_commit ?? a.created_at).toISOString().slice(0, 10), prio: '0.8' })),
  ];
  const url = (p: typeof pages[number], l: 'fr' | 'en') => `<url><loc>${SITE}${p[l]}</loc>${p.mod ? `<lastmod>${p.mod}</lastmod>` : ''}<priority>${p.prio}</priority><xhtml:link rel="alternate" hreflang="fr" href="${SITE}${p.fr}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/></url>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.flatMap((p) => [url(p, 'fr'), url(p, 'en')]).join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
