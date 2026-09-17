import { sql } from './db';
import { publicRepos, installationRepos, serverToken, userInstallationId, type GhRepo } from './github';
import type { SessionUser } from './session';

// Les repos qu'un maker peut lister : ses repos publics (lus sans permission), plus ceux ouverts à la GitHub App s'il l'a installée.
export async function makerRepos(login: string, installationId: number | null): Promise<GhRepo[]> {
  const pub = await publicRepos(login, await serverToken()).catch((e) => { console.error('repos publics', e); return [] as GhRepo[]; });
  const priv = installationId ? await installationRepos(installationId).catch((e) => { console.error('repos installation', e); return [] as GhRepo[]; }) : [];
  const seen = new Set<number>();
  return [...priv, ...pub].filter((r) => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1));
}

// L'installation connue en base, sinon on la demande à GitHub (le maker a pu installer l'app à l'instant) et on la note.
export async function syncInstallation(user: SessionUser): Promise<number | null> {
  if (user.installation_id) return user.installation_id;
  const id = await userInstallationId(user.login).catch(() => null);
  if (id) await sql.query(`update users set installation_id = $2 where id = $1`, [user.id, id]);
  return id;
}
