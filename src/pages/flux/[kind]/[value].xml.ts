import type { APIRoute } from 'astro';
import { browseApps } from '../../../lib/db';
import { toView } from '../../../lib/view';
import { browseFromParams, withAltName, browseLabel, browseLede, browsePath } from '../../../lib/browse';
import { SITE } from '../../../lib/seo';
export const prerender = false;
// Un flux RSS par page « Parcourir » : les mêmes apps, dans le même ordre, pour un lecteur ou un automate.
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const GET: APIRoute = async ({ params, url }) => {
  const found = browseFromParams(params.kind ?? '', params.value ?? '');
  const b = found && (await withAltName(found));
  if (!b) return new Response(null, { status: 404 });
  const locale = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const apps = (await browseApps(b, 50).catch(() => [])).map(toView);
  const page = `${SITE}${browsePath(b, locale)}`;
  const items = apps.map((a) => {
    const link = `${SITE}${locale === 'fr' ? '' : '/en'}/app/${a.slug}`;
    const desc = `${a.tagline ?? ''} ${a.activeDays} ${locale === 'fr' ? 'jours actifs' : 'active days'} · ${a.commits} commits · ★ ${a.stars ?? 0} · ${a.tool} · ${a.language}${a.takeover ? (locale === 'fr' ? ' · ouverte à une reprise' : ' · open to a takeover') : ''}`;
    return `<item><title>${esc(a.name)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><description>${esc(desc.trim())}</description><pubDate>${new Date(a.firstCommit).toUTCString()}</pubDate></item>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Not a Cent · ${esc(browseLabel(b, locale))}</title><link>${page}</link><atom:link href="${SITE}${url.pathname}${url.search}" rel="self" type="application/rss+xml"/><description>${esc(browseLede(b, locale))}</description><language>${locale}</language>
${items.join('\n')}
</channel></rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
