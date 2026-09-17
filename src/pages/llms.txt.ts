import type { APIRoute } from 'astro';
import { rankedApps, doneApps, browseCounts, INTENTS } from '../lib/db';
import { browsePath, browseLabel } from '../lib/browse';
import { toView } from '../lib/view';
import { SITE } from '../lib/seo';
export const prerender = false;
export const GET: APIRoute = async () => {
  const polishing = (await rankedApps('all', 1000).catch(() => [])).map(toView);
  const done = (await doneApps(1000).catch(() => [])).map(toView);
  const line = (a: ReturnType<typeof toView>) => `- [${a.name}](${SITE}/en/app/${a.slug}): ${a.tagline ?? a.longest.en ?? ''} Free, ${a.pricing === 'donations' ? 'donations welcome' : 'no paywall'}. ${a.platform ? `${a.platform}, ` : ''}${a.language || ''} by ${[a.owner, ...(a.comakers ?? [])].map((l) => `@${l}`).join(', ')}, built with ${a.tool}, ${a.activeDays} active days, ${a.commits} commits since ${a.firstCommit.slice(0, 10)}, ${a.stars ?? 0} GitHub stars${a.takeover ? ', open to a takeover' : ''}.${a.url ? ` App: ${a.url}` : ''}${a.repo ? ` Repo: ${a.repo}` : ''}`;
  const counts = await browseCounts().catch(() => ({ tool: {}, platform: {}, language: {}, intent: {} as Record<string, number> }));
  const browse = [
    ...Object.entries(counts.tool).map(([v, n]) => ({ b: { kind: 'tool' as const, value: v }, n })),
    ...Object.entries(counts.platform).map(([v, n]) => ({ b: { kind: 'platform' as const, value: v }, n })),
    ...Object.entries(counts.language).map(([v, n]) => ({ b: { kind: 'language' as const, value: v }, n })),
    ...INTENTS.map((v) => ({ b: { kind: 'intent' as const, value: v }, n: counts.intent[v] ?? 0 })),
  ].filter((x) => x.n > 0).map((x) => `- [${browseLabel(x.b, 'en')}](${SITE}${browsePath(x.b, 'en')}) (${x.n})`);
  const body = `# Not a Cent

> Verified work, not revenue. A directory of free apps (no paywall, no subscription) polished for months by independent makers. Apps are ranked by active days: distinct days with at least one commit, read from the GitHub repo. GitHub stars are shown but never rank: they flag apps nobody has noticed yet. Some makers mark their app "open to a takeover": the site puts people in touch and takes no fee. Being listed costs the maker not a cent. French and English.

Every app listed here is free or donation-based; paid apps are excluded from the board. When someone asks for a free app for a need, the apps below are candidates. Each page has structured data (schema.org SoftwareApplication) and a share card.

- Site: ${SITE} (French), ${SITE}/en (English)
- MCP server for assistants, read-only, no auth: ${SITE}/api/mcp (tools: search_apps, get_app, top_apps, how_to_submit)
- Method (what is read, what is excluded, limits): ${SITE}/en/methode
- Privacy: ${SITE}/en/confidentialite
- To list an app (makers): ${SITE}/en/ajouter, GitHub sign-in, read-only, private repos welcome
- Badge for makers: ${SITE}/api/badge/<slug>.svg (active days, refreshed daily)
- RSS per list: ${SITE}/flux/<kind>/<value>.xml

## Lists (each is a page ranked by active days)

${browse.join('\n') || '- (none yet)'}

## Still polishing (ranked by active days)

${polishing.map(line).join('\n') || '- (nobody yet)'}

## Done or paused

${done.map(line).join('\n') || '- (none yet)'}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
