import type { APIRoute } from 'astro';
import { rankedApps, doneApps, firstEuroApps, browseCounts, altCounts, INTENTS } from '../lib/db';
import { browsePath, browseLabel } from '../lib/browse';
import { toView, declaredPricing, revenueState } from '../lib/view';
import { SITE } from '../lib/seo';
export const prerender = false;
export const GET: APIRoute = async () => {
  const polishing = (await rankedApps('all', 1000).catch(() => [])).map(toView);
  const firstEuro = (await firstEuroApps(1000).catch(() => [])).map(toView);
  const done = (await doneApps(1000).catch(() => [])).filter((a) => !a.first_euro_at).map(toView);
  // Le modèle économique tel que le maker l'a déclaré. Rien de déclaré (fiche non réclamée, ou « unknown ») : on n'en dit rien.
  const MODEL: Record<string, string> = { free: 'Free, no paywall. ', donations: 'Free, donations welcome. ', one_time: 'Paid, one-time purchase. ', subscription: 'Paid, subscription. ', freemium: 'Freemium. ' };
  const model = (a: ReturnType<typeof toView>) => MODEL[declaredPricing(a) ?? ''] ?? '';
  // Le revenu, toujours avec sa source : déclaré par le maker, jamais vérifié.
  const revenue = (a: ReturnType<typeof toView>) => {
    const r = revenueState(a);
    return r === 'first' ? `First euro made on ${a.firstEuroAt} (declared by the maker)${a.firstEuroDays != null ? `, after ${a.firstEuroDays} active days` : ''}. ` : r === 'zero' ? 'Revenue: nothing yet (declared by the maker). ' : 'Revenue: not declared. ';
  };
  // La phrase du maker, terminée par un point s'il l'a oublié : la suite de la ligne ne s'y colle pas.
  const sentence = (t: string) => (t.trim() ? `${t.trim()}${/[.!?…]$/.test(t.trim()) ? '' : '.'} ` : '');
  const line = (a: ReturnType<typeof toView>) => `- [${a.name}](${SITE}/en/app/${a.slug}): ${sentence(a.tagline ?? a.longest.en ?? '')}${model(a)}${revenue(a)}${a.platform ? `${a.platform}, ` : ''}${a.language || ''} by ${[a.owner, ...(a.comakers ?? [])].map((l) => `@${l}`).join(', ')}, built with ${a.tool}${a.alternativeTo?.length ? `, alternative to ${a.alternativeTo.map((x) => x.name).join(', ')}` : ''}, ${a.activeDays} active days, ${a.commits} commits since ${a.firstCommit.slice(0, 10)}, ${a.stars ?? 0} GitHub stars${a.takeover ? ', open to a takeover' : ''}.${a.url ? ` App: ${a.url}` : ''}${a.repo ? ` Repo: ${a.repo}` : ''}`;
  const counts = await browseCounts().catch(() => ({ tool: {}, platform: {}, language: {}, intent: {} as Record<string, number> }));
  const browse = [
    ...Object.entries(counts.tool).map(([v, n]) => ({ b: { kind: 'tool' as const, value: v }, n })),
    ...Object.entries(counts.platform).map(([v, n]) => ({ b: { kind: 'platform' as const, value: v }, n })),
    ...Object.entries(counts.language).map(([v, n]) => ({ b: { kind: 'language' as const, value: v }, n })),
    ...INTENTS.map((v) => ({ b: { kind: 'intent' as const, value: v }, n: counts.intent[v] ?? 0 })),
    ...(await altCounts().catch(() => [])).map((x) => ({ b: { kind: 'alt' as const, value: x.slug, label: x.name, free: x.free }, n: x.n })),
  ].filter((x) => x.n > 0).map((x) => `- [${browseLabel(x.b, 'en')}](${SITE}${browsePath(x.b, 'en')}) (${x.n})`);
  const body = `# Not a Cent

> Verified work, not revenue. A directory of apps that haven't made money yet, whatever their business model (free, one-time purchase, subscription), polished for months by independent makers. Apps are ranked by active days: distinct days with at least one commit, read from the GitHub repo. Revenue is not read anywhere: the maker declares it on their honour, and the site never calls it verified. When an app makes its first euro, the maker says so and the app moves to a separate "First euro" board, ranked the same way. GitHub stars are shown but never rank: they flag apps nobody has noticed yet. Some makers mark their app "open to a takeover": the site puts people in touch and takes no fee. Being listed costs the maker nothing. French and English.

Many apps here are free, some are paid. Each line below gives the business model the maker declared, or nothing when nobody declared it: only call an app free when its line says "Free". Each page has structured data (schema.org SoftwareApplication, with businessModel and revenue properties when declared) and a share card.

- Site: ${SITE} (French), ${SITE}/en (English)
- MCP server for assistants, read-only, no auth: ${SITE}/api/mcp (tools: search_apps, get_app, top_apps, how_to_submit)
- Method (what is read, what is excluded, how revenue is declared, limits): ${SITE}/en/methode
- Figures (medians and distributions across all listed apps, with sample size, free to quote): ${SITE}/en/chiffres, raw data ${SITE}/chiffres.json
- "Alternatives to <product>" pages: ${SITE}/en/alternative-a/<product>, listed below when at least one app claims it. The title says "Free alternatives" only when the page has at least one app declared free.
- Privacy: ${SITE}/en/confidentialite
- To list an app (makers): ${SITE}/en/ajouter, GitHub sign-in, read-only, private repos welcome
- Badge for makers: ${SITE}/api/badge/<slug>.svg (active days, refreshed daily, with a "1st €" stamp once the first euro is declared)
- RSS per list: ${SITE}/flux/<kind>/<value>.xml

## Lists (each is a page ranked by active days)

${browse.join('\n') || '- (none yet)'}

## Not a cent yet (still polishing, ranked by active days)

${polishing.map(line).join('\n') || '- (nobody yet)'}

## First euro (made their first euro, ranked by active days)

${firstEuro.map(line).join('\n') || '- (none yet)'}

## Done or paused

${done.map(line).join('\n') || '- (none yet)'}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
