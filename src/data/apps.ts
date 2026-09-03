// Données d'exemple. Seront remplacées par la base + la lecture GitHub (étapes 2 et 3).
export type Pricing = 'free' | 'donations' | 'paid';
export type Status = 'polishing' | 'done' | 'paused';
export type Tool = 'Claude Code' | 'Cursor' | 'Lovable' | 'Bolt' | 'Copilot' | 'Autre';

export interface App {
  slug: string;
  name: string;
  owner: string;
  tool: Tool;
  language: string;
  activeDays: number;
  activeDays30: number;
  commits: number;
  clicks: number;
  lastCommitDaysAgo: number;
  firstCommit: string; // ISO
  lifetimeMonths: number;
  bestStreakWeeks: number;
  bravos: number;
  pricing: Pricing;
  status: Status;
  longest: { fr: string; en: string };
  url?: string;
  repo?: string;
  weekly: number[]; // jours actifs par semaine, 26 semaines
  margin?: { fr: string; en: string };
  sponsored?: boolean;
  imageUrl?: string;
  tagline?: string;
}

function weekly(shape: 'up' | 'steady' | 'burst' | 'new', seed: number) {
  let s = seed * 97 + 13;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 26 }, (_, i) => {
    let v = 0;
    if (shape === 'up') v = 1 + (i / 26) * 4 + r() * 2;
    else if (shape === 'steady') v = 3 + r() * 3;
    else if (shape === 'burst') v = i > 18 ? 4 + r() * 3 : r() * 1.2;
    else v = i > 23 ? 2 + r() * 3 : 0;
    return Math.round(Math.max(0, Math.min(7, v)));
  });
}

export const apps: App[] = [
  {
    slug: 'correspondance', name: 'Correspondance', owner: 'meffysto', tool: 'Claude Code', language: 'Swift', tagline: 'Toutes vos messageries, une inbox.',
    activeDays: 214, activeDays30: 22, commits: 1187, clicks: 2340, lastCommitDaysAgo: 2, firstCommit: '2026-02-03',
    lifetimeMonths: 7, bestStreakWeeks: 19, bravos: 48, pricing: 'free', status: 'polishing',
    longest: {
      fr: "Le mode Focus. Une file de messages en attente, un seul à la fois, et un raccourci pour répondre sans ouvrir l'app. Huit versions avant que ça paraisse évident.",
      en: 'Focus mode. A queue of waiting messages, one at a time, and a shortcut to reply without opening the app. Eight versions before it looked obvious.',
    },
    weekly: weekly('up', 1), margin: { fr: 'toujours pas un centime !', en: 'still not a cent!' },
  },
  {
    slug: 'semaphore', name: 'Sémaphore', owner: 'lea.dev', tool: 'Cursor', language: 'TypeScript',
    activeDays: 167, activeDays30: 25, commits: 642, clicks: 1102, lastCommitDaysAgo: 1, firstCommit: '2026-01-12',
    lifetimeMonths: 8, bestStreakWeeks: 14, bravos: 31, pricing: 'donations', status: 'polishing',
    longest: { fr: 'Le rendu des signaux en temps réel sans faire chauffer le Mac.', en: 'Rendering signals in real time without heating up the Mac.' },
    weekly: weekly('steady', 2),
  },
  {
    slug: 'tidy-tabs', name: 'Tidy Tabs', owner: 'marco', tool: 'Lovable', language: 'React',
    activeDays: 38, activeDays30: 19, commits: 210, clicks: 87, lastCommitDaysAgo: 5, firstCommit: '2026-06-20',
    lifetimeMonths: 2, bestStreakWeeks: 5, bravos: 4, pricing: 'free', status: 'polishing',
    longest: { fr: "L'icône.", en: 'The icon.' }, weekly: weekly('burst', 7), sponsored: true,
  },
  {
    slug: 'daybard', name: 'Daybard', owner: 'meffysto', tool: 'Claude Code', language: 'Swift',
    activeDays: 142, activeDays30: 12, commits: 903, clicks: 615, lastCommitDaysAgo: 4, firstCommit: '2026-03-01',
    lifetimeMonths: 6, bestStreakWeeks: 11, bravos: 22, pricing: 'free', status: 'polishing',
    longest: { fr: 'Le système de quêtes qui ne culpabilise pas.', en: 'A quest system that never guilt-trips you.' },
    weekly: weekly('up', 3),
  },
  {
    slug: 'notacent', name: 'Not a Cent', owner: 'meffysto', tool: 'Claude Code', language: 'Astro',
    activeDays: 1, activeDays30: 1, commits: 1, clicks: 0, lastCommitDaysAgo: 0, firstCommit: '2026-09-03',
    lifetimeMonths: 0, bestStreakWeeks: 1, bravos: 0, pricing: 'free', status: 'polishing',
    longest: { fr: 'La maquette, avant la première ligne de code.', en: 'The mockup, before the first line of code.' },
    weekly: weekly('new', 4), margin: { fr: 'ce site, oui oui', en: 'this very site' },
    repo: 'https://github.com/menufactory43/notacent',
  },
];

export function ranked(period: 'all' | 'month' = 'all') {
  return apps
    .filter((a) => a.pricing !== 'paid' && a.status === 'polishing')
    .sort((a, b) => (period === 'all' ? b.activeDays - a.activeDays : b.activeDays30 - a.activeDays30));
}
export function totals() {
  return { apps: apps.length, days: apps.reduce((n, a) => n + a.activeDays, 0) };
}
