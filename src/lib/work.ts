// Les calculs purs, sans GitHub : importables depuis les scripts node (prospect.mjs) comme depuis le site.
// Un commit de robot n'est pas du travail : dependabot, renovate, github-actions et consorts sont ignorés.
export interface CommitLike { author?: { login?: string; type?: string } | null; commit: { author?: { name?: string; email?: string; date?: string }; committer?: { name?: string; email?: string; date?: string } } }
const BOT = /\[bot\]|dependabot|renovate|github-actions|actions-user|greenkeeper|semantic-release|snyk|imgbot|allcontributors|copilot/i;
export const isBot = (c: CommitLike) =>
  c.author?.type === 'Bot' || BOT.test(c.author?.login ?? '') || BOT.test(c.commit.author?.name ?? '') || BOT.test(c.commit.author?.email ?? '') || BOT.test(c.commit.committer?.name ?? '');

export interface Metrics {
  commits: number; active_days: number; active_days_30: number; best_streak_weeks: number;
  first_commit: string | null; last_commit: string | null; weekly: number[];
}

const DAY = 86_400_000;
const isoWeek = (t: number) => Math.floor((t + 3 * DAY) / (7 * DAY)); // lundi = début, epoch 1970-01-01 était un jeudi

export function compute(dates: string[], now = Date.now()): Metrics {
  const times = dates.map((d) => new Date(d).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const days = new Set(times.map((t) => Math.floor(t / DAY)));
  const cutoff30 = Math.floor((now - 30 * DAY) / DAY);
  const active_days_30 = [...days].filter((d) => d >= cutoff30).length;
  const weeks = [...new Set(times.map(isoWeek))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = NaN;
  for (const w of weeks) { run = w === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = w; }
  const thisWeek = isoWeek(now);
  const weekly = Array.from({ length: 26 }, (_, i) => {
    const w = thisWeek - 25 + i;
    const set = new Set<number>();
    for (const t of times) if (isoWeek(t) === w) set.add(Math.floor(t / DAY));
    return set.size;
  });
  return {
    commits: times.length, active_days: days.size, active_days_30, best_streak_weeks: best,
    first_commit: times.length ? new Date(times[0]).toISOString() : null,
    last_commit: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    weekly,
  };
}

export function statusFor(last_commit: string | null, current: string, now = Date.now()) {
  if (current !== 'polishing') return current; // « terminée » ou « en pause » : choix du maker, on n'y touche pas
  if (!last_commit) return 'polishing';
  return now - new Date(last_commit).getTime() > 90 * DAY ? 'paused' : 'polishing';
}
