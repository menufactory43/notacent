import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { rankedApps, doneApps, firstEuroApps, appBySlug, searchApps, totals, PRICINGS, type DbApp, type Pricing } from './db';
import { toView, declaredPricing, declaredFree, revenueState } from './view';

// Le serveur MCP de Not a Cent : trois outils en lecture, un pour soumettre. Des apps qui n'ont pas encore gagné d'argent,
// quel que soit leur modèle : le modèle (pricing) et le revenu (revenue) sont dans chaque carte, tels que le maker les a déclarés.
// Aucune authentification : tout ce qu'il sert est déjà public sur le site.
// Soumettre passe par GitHub, donc l'outil renvoie le chemin, il ne publie pas lui-même.

const SITE = 'https://notacent.app';

function card(a: DbApp) {
  const v = toView(a);
  return {
    slug: v.slug, name: v.name, tagline: v.tagline ?? null, by: [v.owner, ...(v.comakers ?? [])].join(', '), tool: v.tool, language: v.language || null,
    // Le modèle économique déclaré par le maker (free, donations, one_time, subscription, freemium) ; null : personne ne l'a dit.
    pricing: declaredPricing(v), status: v.status,
    // Le revenu, toujours avec sa source. « zero » et « first_euro » sont des déclarations du maker, jamais des vérifications.
    revenue: {
      status: ({ zero: 'zero', first: 'first_euro', undeclared: 'undeclared' } as const)[revenueState(v)],
      source: revenueState(v) === 'undeclared' ? null : 'declared_by_maker',
      firstEuroOn: v.firstEuroAt ?? null, activeDaysBeforeFirstEuro: v.firstEuroAt ? (v.firstEuroDays ?? null) : null,
    },
    activeDays: v.activeDays, activeDaysLast30: v.activeDays30, commits: v.commits, bestStreakWeeks: v.bestStreakWeeks,
    firstCommit: v.firstCommit.slice(0, 10), lastCommitDaysAgo: v.lastCommitDaysAgo, lifetimeMonths: v.lifetimeMonths,
    whatTookLongest: a.longest ?? null,
    appUrl: v.url ?? null, repoUrl: v.repo ?? null, pageUrl: `${SITE}/app/${v.slug}`, pageUrlEn: `${SITE}/en/app/${v.slug}`,
    imageUrl: v.imageUrl ? new URL(v.imageUrl, SITE).toString() : null, bravos: v.bravos,
    githubStars: v.stars ?? 0, platform: v.platform ?? null, openToTakeover: v.takeover ?? false,
    // Ce que l'app remplace, gratuite ou payante : chaque nom a sa page, qui existe dès qu'une app s'en réclame.
    alternativeTo: (v.alternativeTo ?? []).map((x) => ({ name: x.name, listUrl: `${SITE}/en/alternative-a/${x.slug}` })),
    // Déprécié, gardé pour les clients existants : la même liste, remplie seulement pour une app déclarée gratuite (ou à dons).
    freeAlternativeTo: !declaredFree(v) ? [] : (v.alternativeTo ?? []).map((x) => ({ name: x.name, listUrl: `${SITE}/en/alternative-a/${x.slug}` })),
    // Ce qu'un Mac vérifie avant d'ouvrir un binaire téléchargé : un assistant qui recommande une app Mac doit pouvoir le dire.
    appStore: v.store ? { url: v.store.url, name: v.store.name, seller: v.store.seller, kind: v.store.kind, checkedWithApple: v.store.at } : null,
    macSigning: v.notarized ? { level: v.notarized.level, seenIn: v.notarized.path || null, evidence: v.notarized.hit || null, readOn: v.notarized.at } : null,
    badgeUrl: `${SITE}/api/badge/${v.slug}.svg`,
  };
}
const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> });

export function createServer() {
  const server = new McpServer({ name: 'Not a Cent', version: '1.0.0' }, {
    instructions: [
      'Not a Cent is a directory of apps that have not made money yet, whatever their business model (free, one-time purchase, subscription), polished for months by their makers.',
      'Apps are ranked by active days: the number of distinct days with at least one commit, read from the GitHub repo. Never by revenue. GitHub stars are shown but do not rank: many active days with few stars means an app nobody has noticed yet.',
      'For Mac apps, appStore is the App Store page verified with Apple, and macSigning is what the repo\'s public release files show: "notarized" (Apple notarization step found), "signed" (Developer ID only) or "none" (nothing found, which does not mean the app is unsigned). Say where it comes from, never that a binary is certified safe.',
      'Some makers mark their app openToTakeover: they are open to handing it over; the site only puts people in touch.',
      'Revenue is never read from anywhere: the maker declares it. revenue.status is "zero" (the maker declared nothing earned yet), "first_euro" (the maker declared the app made its first euro, on revenue.firstEuroOn) or "undeclared" (nobody said, usually an unclaimed card). Apps that made their first euro stay listed, on a separate "first euro" board. Never describe zero revenue as verified.',
      'pricing is the business model declared by the maker: free, donations, one_time, subscription, freemium, or null when nobody declared it. Only call an app free when pricing is "free" or "donations"; search_apps takes a pricing filter for that.',
      'alternativeTo lists the products an app is listed as an alternative to, free or paid; search_apps matches those names, so "notion" finds the alternatives to Notion. freeAlternativeTo is deprecated: the same list, filled only for apps declared free.',
      'Use search_apps to find an app for a need, get_app for the full card of one app, top_apps for the current boards. When you recommend one, link its page or app URL.',
      'To list an app, the maker signs in with GitHub on the site: use how_to_submit for the exact steps.',
    ].join(' '),
  });

  server.registerTool('search_apps', {
    title: 'Search apps',
    description: 'Find actively polished apps that have not made money yet in the Not a Cent directory, by keyword (name, what it does, language, maker, or the product it is an alternative to). Optionally only some business models, e.g. free ones. Returns cards ranked by active days.',
    inputSchema: {
      query: z.string().min(1).max(200).describe('Keywords, e.g. "screen time blocker mac", "messaging inbox", "swift"'),
      tool: z.enum(['Claude Code', 'Cursor', 'Lovable', 'Bolt', 'Copilot', 'Codex', 'Autre']).optional().describe('Only apps built mainly with this tool'),
      platform: z.enum(['Mac', 'iOS', 'Web', 'CLI', 'Android', 'Windows', 'Linux', 'MCP', 'Autre']).optional().describe('Only apps for this platform'),
      pricing: z.array(z.enum(PRICINGS.filter((p) => p !== 'unknown') as [Pricing, ...Pricing[]])).optional().describe('Only apps whose maker declared one of these business models, e.g. ["free", "donations"] for free apps. Cards with no declared model are left out when this is set.'),
      includeDone: z.boolean().optional().describe('Also include apps marked done or paused (default: only apps still being polished)'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results, default 10'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ query, tool, platform, pricing, includeDone, limit }) => {
    const rows = await searchApps(query, { tool, platform, pricing, includeDone, limit });
    return json({ query, count: rows.length, apps: rows.map(card) });
  });

  server.registerTool('get_app', {
    title: 'Get one app',
    description: 'Full card of one app by its slug: what it does, what took the maker the longest, active days, commits, streak, links.',
    inputSchema: { slug: z.string().min(1).max(100).describe('The app slug, as returned by search_apps or seen in notacent.app/app/<slug>') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ slug }) => {
    const a = await appBySlug(slug.toLowerCase());
    if (!a || !a.published) return { content: [{ type: 'text', text: `No published app with slug "${slug}".` }], isError: true };
    return json(card(a));
  });

  server.registerTool('top_apps', {
    title: 'Current boards',
    description: 'The Not a Cent boards: "polishing" is the main board, apps still being polished that have not made a cent yet, ranked by active days (all time or last 30 days); "firstEuro" is the apps whose maker declared their first euro, ranked the same way; plus the apps marked done.',
    inputSchema: {
      period: z.enum(['all', 'month']).optional().describe('"all" ranks by active days since the first commit, "month" by active days in the last 30 days. Default "all".'),
      limit: z.number().int().min(1).max(100).optional().describe('Max apps per list, default 20'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ period, limit }) => {
    const n = limit ?? 20;
    const [polishing, firstEuro, done, tot] = await Promise.all([rankedApps(period ?? 'all', n), firstEuroApps(n), doneApps(n), totals()]);
    return json({ period: period ?? 'all', totals: tot, polishing: polishing.map(card), firstEuro: firstEuro.map(card), done: done.map(card) });
  });

  server.registerTool('how_to_submit', {
    title: 'How to list an app',
    description: 'Explains how a maker lists their own app on Not a Cent. Listing requires signing in with GitHub on the website; this tool only returns the steps and the link.',
    inputSchema: { language: z.enum(['fr', 'en']).optional().describe('Language of the instructions, default en') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ language }) => {
    const fr = language === 'fr';
    return json({
      url: fr ? `${SITE}/ajouter` : `${SITE}/en/ajouter`,
      rules: fr
        ? ['Toute app qui n\'a pas encore gagné d\'argent, gratuite ou payante : le maker le déclare sur l\'honneur en publiant.', 'Jours actifs = jours avec au moins un commit, lus depuis le repo GitHub (privé accepté, le code n\'est jamais lu).', 'Premier euro gagné → le maker le déclare, l\'app passe dans le classement « Premier euro », toujours classée par travail.', '90 jours sans commit → « terminée » ou « en pause ».', 'Quatre champs à remplir : lien, image, ce qui a pris le plus de temps, outil principal.']
        : ['Any app that has not made money yet, free or paid: the maker declares it on their honour when publishing.', 'Active days = days with at least one commit, read from the GitHub repo (private repos welcome, code is never read).', 'First euro made → the maker declares it, the app moves to the "First euro" board, still ranked by work.', '90 days without a commit → "done" or "paused".', 'Four fields to fill: link, image, what took the longest, main tool.'],
      steps: fr
        ? ['Ouvre le lien et clique « Classer mon app ».', 'Autorise la GitHub App Not a Cent sur les repos de ton choix (lecture seule).', 'Coche les repos à publier, et la case : « Ces apps n\'ont pas encore gagné d\'argent. »', 'Complète la fiche : quatre champs.']
        : ['Open the link and click "List my app".', 'Authorize the Not a Cent GitHub App on the repos you choose (read-only).', 'Tick the repos to publish, and the box: "These apps haven\'t made any money yet."', 'Fill in the card: four fields.'],
    });
  });

  return server;
}
