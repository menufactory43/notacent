import { gh, serverToken, installationToken } from './github';
import { isBot, datesFromStats, type CommitLike, type StatContributor, type StatActivity } from './work';
export { compute, statusFor, type Metrics } from './work';

// Lit toutes les dates de commit de la branche par défaut. 100 par page, donc ~12 appels pour 1 200 commits.
export async function commitDates(token: string, fullName: string, maxPages = 50): Promise<string[]> {
  const dates: string[] = [];
  let url: string | null = `/repos/${fullName}/commits?per_page=100`;
  let pages = 0;
  while (url && pages++ < maxPages) {
    const r: { data: CommitLike[]; next: string | null } = await gh(url, token);
    for (const c of r.data) { if (isBot(c)) continue; const d = c.commit.author?.date ?? c.commit.committer?.date; if (d) dates.push(d); }
    url = r.next;
  }
  return dates;
}

// Un repo, ses dates. Public : toutes les dates de commit, avec le jeton serveur, comme n'importe qui peut les lire.
// Privé : les statistiques via l'installation (permission « Metadata » seule), fusionnées avec le registre des jours déjà connus.
export interface RepoRead { full_name: string; private: boolean; installation_id?: number | null; known?: string[] | null }
export interface DatesRead { dates: string[]; commits?: number; ledger: string[] }
const day = (d: string) => new Date(d).toISOString().slice(0, 10);
export async function readDates(r: RepoRead): Promise<DatesRead> {
  if (!r.private) {
    const dates = await commitDates(await serverToken(), r.full_name);
    return { dates, ledger: [...new Set(dates.map(day))].sort() };
  }
  if (!r.installation_id) throw new Error(`repo privé sans installation : ${r.full_name}`);
  const token = await installationToken(r.installation_id);
  const known = new Set((r.known ?? []).map(day));
  let commits: number | undefined;
  // 1. Les statistiques, quand GitHub veut bien les calculer (202 sans fin sur certains repos : on n'attend pas plus de cinq essais).
  const stat = async <T,>(path: string): Promise<T | null> => {
    for (let i = 0; i < 5; i++) {
      const res = await gh<T>(path, token);
      if (res.status === 200 && res.data) return res.data;
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    return null;
  };
  const [contributors, activity] = await Promise.all([stat<StatContributor[]>(`/repos/${r.full_name}/stats/contributors`), stat<StatActivity[]>(`/repos/${r.full_name}/stats/commit_activity`)]);
  if (contributors || activity) {
    const fromStats = datesFromStats(contributors ?? [], activity ?? []);
    for (const d of fromStats.dates) known.add(d);
    if (contributors) commits = fromStats.commits;
  }
  // 2. L'activité du repo : chaque push humain vaut un jour actif. C'est ce qui fait grandir le registre nuit après nuit.
  try {
    let url: string | null = `/repos/${r.full_name}/activity?activity_type=push&per_page=100`;
    let pages = 0;
    while (url && pages++ < 5) {
      const res: { data: { timestamp: string; actor: { login?: string; type?: string } | null }[] | null; next: string | null } = await gh(url, token);
      for (const a of res.data ?? []) if (a.actor?.type !== 'Bot' && !/\[bot\]/.test(a.actor?.login ?? '')) known.add(day(a.timestamp));
      url = res.next;
    }
  } catch (e) { console.error('activité', r.full_name, e); }
  // 3. Premier passage sur un repo sans statistiques : on remonte la branche par défaut, un commit à la fois (« lire un commit » est sous Metadata).
  if (known.size < 5 && !contributors) {
    try {
      const { data: info } = await gh<{ default_branch: string }>(`/repos/${r.full_name}`, token);
      let ref: string | null = info.default_branch;
      let n = 0;
      const started = Date.now();
      while (ref && n++ < 400 && Date.now() - started < 45_000) {
        type Walk = { sha: string; parents: { sha: string }[]; author?: { login?: string; type?: string } | null; commit: { author?: { name?: string; email?: string; date?: string } } };
        const res: { data: Walk | null } = await gh<Walk>(`/repos/${r.full_name}/commits/${ref}`, token);
        const c = res.data;
        if (!c) break;
        if (!isBot(c as CommitLike) && c.commit.author?.date) known.add(day(c.commit.author.date));
        ref = c.parents?.[0]?.sha ?? null;
      }
      if (n > 1) commits = commits ?? n;
    } catch (e) { console.error('remontée', r.full_name, e); }
  }
  if (!known.size) throw new Error(`rien de lisible : ${r.full_name}`);
  const ledger = [...known].sort();
  return { dates: ledger, commits, ledger };
}

