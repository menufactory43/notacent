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
  // Les stats se calculent en arrière-plan la première fois (202) : on laisse GitHub le temps, cinq essais.
  // Si les contributeurs manquent encore, on garde les jours de l'année (commit_activity) et le nombre de commits déjà connu.
  const stat = async <T,>(path: string): Promise<T | null> => {
    for (let i = 0; i < 5; i++) {
      const res = await gh<T>(path, token);
      if (res.status === 200 && res.data) return res.data;
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    return null;
  };
  const [contributors, activity] = await Promise.all([stat<StatContributor[]>(`/repos/${r.full_name}/stats/contributors`), stat<StatActivity[]>(`/repos/${r.full_name}/stats/commit_activity`)]);
  if (!contributors && !activity) throw new Error(`statistiques indisponibles : ${r.full_name}`);
  const fromStats = datesFromStats(contributors ?? [], activity ?? []);
  const ledger = [...new Set([...(r.known ?? []).map(day), ...fromStats.dates])].sort();
  return { dates: ledger, commits: contributors ? fromStats.commits : undefined, ledger };
}
