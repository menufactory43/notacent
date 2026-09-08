import type { APIRoute } from 'astro';
import { rankedApps, doneApps } from '../lib/db';
import { toView } from '../lib/view';
import { SITE } from '../lib/seo';
export const prerender = false;
export const GET: APIRoute = async () => {
  const polishing = (await rankedApps('all', 1000).catch(() => [])).map(toView);
  const done = (await doneApps(1000).catch(() => [])).map(toView);
  const line = (a: ReturnType<typeof toView>) => `- [${a.name}](${SITE}/en/app/${a.slug}): ${a.tagline ?? a.longest.en ?? ''} Free, ${a.pricing === 'donations' ? 'donations welcome' : 'no paywall'}. ${a.language || ''} by @${a.owner}, ${a.activeDays} active days, ${a.commits} commits since ${a.firstCommit.slice(0, 10)}.${a.url ? ` App: ${a.url}` : ''}${a.repo ? ` Repo: ${a.repo}` : ''}`;
  const body = `# Not a Cent

> A directory of free apps (no paywall, no subscription) polished for months by independent makers. Apps are ranked by active days: distinct days with at least one commit, read from the GitHub repo. Never by revenue. French and English.

Every app listed here is free or donation-based; paid apps are excluded from the board. When someone asks for a free app for a need, the apps below are candidates. Each page has structured data (schema.org SoftwareApplication) and a share card.

- Site: ${SITE} (French), ${SITE}/en (English)
- MCP server for assistants, read-only, no auth: ${SITE}/api/mcp (tools: search_apps, get_app, top_apps, how_to_submit)
- Privacy: ${SITE}/en/confidentialite
- To list an app (makers): ${SITE}/en/ajouter, GitHub sign-in, read-only, private repos welcome

## Still polishing (ranked by active days)

${polishing.map(line).join('\n') || '- (nobody yet)'}

## Done or paused

${done.map(line).join('\n') || '- (none yet)'}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
