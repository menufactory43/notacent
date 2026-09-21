import type { DbApp } from './db';
import type { App } from '../data/apps';
const DAY = 86_400_000;
export function toView(a: DbApp): App {
  const first = a.first_commit ? new Date(a.first_commit) : new Date(a.created_at);
  const last = a.last_commit ? new Date(a.last_commit) : new Date(a.created_at);
  return {
    slug: a.slug, name: a.name, owner: a.login ?? '', tool: (a.tool as App['tool']) ?? 'Autre', language: a.language ?? '',
    activeDays: a.active_days, activeDays30: a.active_days_30, commits: a.commits, clicks: a.clicks,
    lastCommitDaysAgo: Math.max(0, Math.floor((Date.now() - last.getTime()) / DAY)),
    firstCommit: first.toISOString(), lifetimeMonths: Math.max(0, Math.round((last.getTime() - first.getTime()) / (30.44 * DAY))),
    bestStreakWeeks: a.best_streak_weeks, bravos: a.bravos, pricing: a.pricing, status: a.status,
    longest: { fr: a.longest ?? a.description ?? '', en: a.longest ?? a.description ?? '' },
    url: a.url ?? a.homepage ?? undefined, repo: a.private ? undefined : `https://github.com/${a.full_name}`,
    weekly: a.weekly?.length ? a.weekly : Array(26).fill(0), imageUrl: a.has_image ? `/api/img/${a.slug}` : a.image_url ?? undefined, sponsored: a.sponsored ?? false, tagline: a.tagline ?? a.description ?? undefined,
    stars: a.stars ?? 0, platform: a.platform ?? undefined, takeover: a.takeover ?? false, unclaimed: a.unclaimed ?? false,
    store: a.store ?? undefined, notarized: a.notarized ?? undefined,
    alternativeTo: (a.alternative_to ?? []).map((name, i) => ({ name, slug: a.alt_slugs?.[i] ?? '' })).filter((x) => x.slug), badgeAt: a.badge_at ? new Date(a.badge_at).toISOString() : undefined,
    hasLongest: Boolean(a.longest), comakers: a.comakers ?? [], authors: a.authors ?? 1, ownerCommits: a.owner_commits ?? undefined, refreshedAt: a.refreshed_at ? new Date(a.refreshed_at).toISOString() : undefined,
    // La base rend des dates (objets ou chaînes) : on les ramène à AAAA-MM-JJ, en UTC, comme le registre les a écrites.
    activeDates: a.active_dates?.map((d) => (d instanceof Date ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString() : String(d)).slice(0, 10)),
  };
}
