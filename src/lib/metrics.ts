import { gh } from './github';
export { compute, statusFor, type Metrics } from './work';

// Lit toutes les dates de commit de la branche par défaut. 100 par page, donc ~12 appels pour 1 200 commits.
export async function commitDates(token: string, fullName: string, maxPages = 50): Promise<string[]> {
  const dates: string[] = [];
  let url: string | null = `/repos/${fullName}/commits?per_page=100`;
  let pages = 0;
  while (url && pages++ < maxPages) {
    const r: { data: { commit: { author?: { date?: string }; committer?: { date?: string } } }[]; next: string | null } = await gh(url, token);
    for (const c of r.data) { const d = c.commit.author?.date ?? c.commit.committer?.date; if (d) dates.push(d); }
    url = r.next;
  }
  return dates;
}
