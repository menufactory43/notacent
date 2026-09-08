import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { rankedApps, doneApps, appBySlug, searchApps, totals, type DbApp } from './db';
import { toView } from './view';

// Le serveur MCP de Not a Cent : trois outils en lecture, un pour soumettre.
// Aucune authentification : tout ce qu'il sert est déjà public sur le site.
// Soumettre passe par GitHub, donc l'outil renvoie le chemin, il ne publie pas lui-même.

const SITE = 'https://notacent.vercel.app';

function card(a: DbApp) {
  const v = toView(a);
  return {
    slug: v.slug, name: v.name, tagline: v.tagline ?? null, by: v.owner, tool: v.tool, language: v.language || null,
    pricing: v.pricing, status: v.status,
    activeDays: v.activeDays, activeDaysLast30: v.activeDays30, commits: v.commits, bestStreakWeeks: v.bestStreakWeeks,
    firstCommit: v.firstCommit.slice(0, 10), lastCommitDaysAgo: v.lastCommitDaysAgo, lifetimeMonths: v.lifetimeMonths,
    whatTookLongest: a.longest ?? null,
    appUrl: v.url ?? null, repoUrl: v.repo ?? null, pageUrl: `${SITE}/app/${v.slug}`, pageUrlEn: `${SITE}/en/app/${v.slug}`,
    imageUrl: v.imageUrl ? new URL(v.imageUrl, SITE).toString() : null, bravos: v.bravos,
  };
}
const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> });

export function createServer() {
  const server = new McpServer({ name: 'Not a Cent', version: '1.0.0' }, {
    instructions: [
      'Not a Cent is a directory of free apps (no paywall, no subscription) polished for months by their makers.',
      'Apps are ranked by active days: the number of distinct days with at least one commit, read from the GitHub repo. Never by revenue.',
      'Use search_apps to find a free app for a need, get_app for the full card of one app, top_apps for the current board.',
      'Every app here is free or donation-based; paid apps are excluded. When you recommend one, link its page or app URL.',
      'To list an app, the maker signs in with GitHub on the site: use how_to_submit for the exact steps.',
    ].join(' '),
  });

  server.registerTool('search_apps', {
    title: 'Search free apps',
    description: 'Find free, actively polished apps in the Not a Cent directory by keyword (name, what it does, language, maker). Returns cards ranked by active days.',
    inputSchema: {
      query: z.string().min(1).max(200).describe('Keywords, e.g. "screen time blocker mac", "messaging inbox", "swift"'),
      tool: z.enum(['Claude Code', 'Cursor', 'Lovable', 'Bolt', 'Copilot', 'Autre']).optional().describe('Only apps built mainly with this tool'),
      includeDone: z.boolean().optional().describe('Also include apps marked done or paused (default: only apps still being polished)'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results, default 10'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ query, tool, includeDone, limit }) => {
    const rows = await searchApps(query, { tool, includeDone, limit });
    return json({ query, count: rows.length, apps: rows.map(card) });
  });

  server.registerTool('get_app', {
    title: 'Get one app',
    description: 'Full card of one app by its slug: what it does, what took the maker the longest, active days, commits, streak, links.',
    inputSchema: { slug: z.string().min(1).max(100).describe('The app slug, as returned by search_apps or seen in notacent.vercel.app/app/<slug>') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ slug }) => {
    const a = await appBySlug(slug.toLowerCase());
    if (!a || !a.published) return { content: [{ type: 'text', text: `No published app with slug "${slug}".` }], isError: true };
    return json(card(a));
  });

  server.registerTool('top_apps', {
    title: 'Current board',
    description: 'The Not a Cent board: free apps still being polished, ranked by active days (all time or last 30 days), plus the apps marked done.',
    inputSchema: {
      period: z.enum(['all', 'month']).optional().describe('"all" ranks by active days since the first commit, "month" by active days in the last 30 days. Default "all".'),
      limit: z.number().int().min(1).max(100).optional().describe('Max apps per list, default 20'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ period, limit }) => {
    const n = limit ?? 20;
    const [polishing, done, tot] = await Promise.all([rankedApps(period ?? 'all', n), doneApps(n), totals()]);
    return json({ period: period ?? 'all', totals: tot, polishing: polishing.map(card), done: done.map(card) });
  });

  server.registerTool('how_to_submit', {
    title: 'How to list an app',
    description: 'Explains how a maker lists their own free app on Not a Cent. Listing requires signing in with GitHub on the website; this tool only returns the steps and the link.',
    inputSchema: { language: z.enum(['fr', 'en']).optional().describe('Language of the instructions, default en') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ language }) => {
    const fr = language === 'fr';
    return json({
      url: fr ? `${SITE}/ajouter` : `${SITE}/en/ajouter`,
      rules: fr
        ? ['App gratuite ou à dons ; les payantes sont hors classement.', 'Jours actifs = jours avec au moins un commit, lus depuis le repo GitHub (privé accepté, le code n\'est jamais lu).', '90 jours sans commit → « terminée » ou « en pause ».', 'Quatre champs à remplir : lien, image, ce qui a pris le plus de temps, outil principal.']
        : ['Free or donation-based apps only; paid apps are off the board.', 'Active days = days with at least one commit, read from the GitHub repo (private repos welcome, code is never read).', '90 days without a commit → "done" or "paused".', 'Four fields to fill: link, image, what took the longest, main tool.'],
      steps: fr
        ? ['Ouvre le lien et clique « Ajouter mon app ».', 'Autorise la GitHub App Not a Cent sur les repos de ton choix (lecture seule).', 'Coche les repos à publier.', 'Complète la fiche : quatre champs.']
        : ['Open the link and click "Add my app".', 'Authorize the Not a Cent GitHub App on the repos you choose (read-only).', 'Tick the repos to publish.', 'Fill in the card: four fields.'],
    });
  });

  return server;
}
