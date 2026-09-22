import type { APIRoute } from 'astro';
import { appBySlug } from '../../../lib/db';
import { apps as samples } from '../../../data/apps';
import { badgeCard, BADGE_THEMES, type BadgeTheme } from '../../../lib/badgeCard';
export const prerender = false;
// Le badge : « 214 jours actifs · vérifié · Not a Cent ». Un SVG, remis à jour chaque jour, qui renvoie vers la fiche.
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.slug ?? '';
  const row = await appBySlug(slug).catch(() => null);
  const days = row?.published ? row.active_days : samples.find((a) => a.slug === slug)?.activeDays;
  if (days === undefined) return new Response(null, { status: 404 });
  const en = url.searchParams.get('lang') === 'en';
  const headers = { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'Access-Control-Allow-Origin': '*' };
  // ?style=card : la carte 256 × 54 façon annuaire de lancement ; ?theme=light|dark|paper (light par défaut).
  if (url.searchParams.get('style') === 'card') {
    const asked = url.searchParams.get('theme') ?? 'light';
    const theme: BadgeTheme = (BADGE_THEMES as string[]).includes(asked) ? (asked as BadgeTheme) : 'light';
    return new Response(badgeCard(days, { en, theme }), { headers });
  }
  const label = en ? 'active days' : 'jours actifs';
  const tag = en ? 'verified · Not a Cent' : 'vérifié · Not a Cent';
  const n = String(days);
  const w1 = 14 + n.length * 9 + 6 + label.length * 6.6 + 12;
  const w2 = tag.length * 6.4 + 22;
  const W = Math.round(w1 + w2), H = 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${n} ${label}, ${tag}`)}">
<title>${esc(`${n} ${label}, ${tag}`)}</title>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="7" fill="#FFFFFF" stroke="#1F1D2B" stroke-width="1.6"/>
<line x1="${Math.round(w1)}" y1="5" x2="${Math.round(w1)}" y2="${H - 5}" stroke="#E6E4EC" stroke-width="1.5"/>
<text x="12" y="18.5" font-family="IBM Plex Mono, ui-monospace, Menlo, monospace" font-size="13" font-weight="600" fill="#1F1D2B">${n}<tspan font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="400" font-size="12" dx="5">${esc(label)}</tspan></text>
<text x="${Math.round(w1) + 10}" y="18.5" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="700" fill="#D9432F">${esc(tag)}</text>
</svg>`;
  return new Response(svg, { headers });
};
