import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { sql, hasDb } from './db';
import { open } from './crypto';

const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
const UA = 'notacent (+https://notacent.app)';

// Deux apps GitHub, un rôle chacune.
// L'OAuth App (« Public data only ») sert à savoir qui se connecte, rien d'autre. GITHUB_OAUTH_ID / GITHUB_OAUTH_SECRET.
// La GitHub App (permission « Metadata » seule) ne sert qu'aux repos privés, et seulement si le maker l'installe.
export const appSlug = () => env('GITHUB_APP_SLUG');
export const oauthClientId = () => env('GITHUB_OAUTH_ID') || env('GITHUB_CLIENT_ID');
const oauthSecret = () => env('GITHUB_OAUTH_SECRET') || env('GITHUB_CLIENT_SECRET');
export const githubReady = () => Boolean(oauthClientId() && oauthSecret());
export const appReady = () => Boolean(env('GITHUB_APP_ID') && env('GITHUB_APP_PRIVATE_KEY'));

export async function gh<T>(path: string, token: string, init: RequestInit = {}): Promise<{ data: T; next: string | null; status: number }> {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': UA, 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) },
  });
  if (res.status === 202 || res.status === 204) return { data: null as T, next: null, status: res.status };
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  const link = res.headers.get('link') ?? '';
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  return { data: (await res.json()) as T, next: m ? m[1] : null, status: res.status };
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: oauthClientId(), client_secret: oauthSecret(), code }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(j.error_description ?? j.error ?? 'échange OAuth refusé');
  return j.access_token;
}

export interface GhUser { id: number; login: string; name: string | null; avatar_url: string; type?: string }
export interface GhRepo { id: number; name: string; full_name: string; description: string | null; language: string | null; private: boolean; homepage: string | null; html_url: string; default_branch: string; pushed_at: string; fork: boolean }

export const me = (token: string) => gh<GhUser>('/user', token).then((r) => r.data);

// Le jeton serveur : celui qui lit les repos publics, comme n'importe qui peut les lire sur github.com.
// GITHUB_TOKEN si posé, sinon le jeton laissé par l'admin à sa connexion.
let serverCache: { token: string; at: number } | null = null;
export async function serverToken(): Promise<string> {
  if (env('GITHUB_TOKEN')) return env('GITHUB_TOKEN');
  if (serverCache && Date.now() - serverCache.at < 300_000) return serverCache.token;
  if (!hasDb || !env('ADMIN_LOGIN')) throw new Error('aucun jeton serveur : GITHUB_TOKEN ou ADMIN_LOGIN');
  const [row] = (await sql.query(`select access_token from users where login = $1`, [env('ADMIN_LOGIN')])) as { access_token: string | null }[];
  const token = open(row?.access_token ?? null);
  if (!token) throw new Error('aucun jeton serveur : l\'admin doit se connecter une fois');
  serverCache = { token, at: Date.now() };
  return token;
}

// Les repos publics d'un compte, sans fork, les plus récents d'abord.
export async function publicRepos(login: string, token: string): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  let url: string | null = `/users/${login}/repos?type=owner&sort=pushed&per_page=100`;
  let pages = 0;
  while (url && pages++ < 5) {
    const r: { data: GhRepo[]; next: string | null } = await gh(url, token);
    out.push(...(r.data ?? []));
    url = r.next;
  }
  return out.filter((r) => !r.fork);
}

// La GitHub App, côté serveur : un JWT signé avec la clé privée, puis des jetons d'installation.
async function appJwt() {
  const pem = env('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const key = createPrivateKey(pem); // accepte PKCS#1 (GitHub) et PKCS#8
  return new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setIssuedAt(Math.floor(Date.now() / 1000) - 30).setExpirationTime('9m').setIssuer(env('GITHUB_APP_ID')).sign(key);
}
let cache: { id: number; token: string; exp: number } | null = null;
export async function installationToken(installationId: number): Promise<string> {
  if (cache && cache.id === installationId && cache.exp > Date.now() + 60_000) return cache.token;
  const { data } = await gh<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, await appJwt(), { method: 'POST' });
  cache = { id: installationId, token: data.token, exp: new Date(data.expires_at).getTime() };
  return cache.token;
}
// L'installation d'un compte (utilisateur ou organisation), s'il a installé l'app. null sinon.
export async function userInstallationId(login: string): Promise<number | null> {
  if (!appReady()) return null;
  const jwt = await appJwt();
  for (const path of [`/users/${login}/installation`, `/orgs/${login}/installation`]) {
    try { const { data } = await gh<{ id: number }>(path, jwt); if (data?.id) return data.id; } catch (e) { if (!String(e).includes('404')) throw e; }
  }
  return null;
}
// Les repos ouverts à l'app par cette installation : c'est là que sont les repos privés.
export async function installationRepos(installationId: number): Promise<GhRepo[]> {
  const token = await installationToken(installationId);
  const out: GhRepo[] = [];
  let url: string | null = `/installation/repositories?per_page=100`;
  while (url) {
    const r: { data: { repositories: GhRepo[] }; next: string | null } = await gh(url, token);
    out.push(...r.data.repositories);
    url = r.next;
  }
  return out.filter((r) => !r.fork);
}

// Le README d'un repo public, en texte. null s'il n'y en a pas. On n'y cherche qu'une chose : le badge.
export async function readme(token: string, fullName: string): Promise<string | null> {
  try {
    const { data } = await gh<{ content?: string; encoding?: string }>(`/repos/${fullName}/readme`, token);
    return data?.content ? Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8') : null;
  } catch (e) { if (String(e).includes('404')) return null; throw e; }
}

// Ce que GitHub dit d'un repo en un appel : étoiles, sujets, page d'accueil. On n'y lit pas le code.
export interface GhRepoInfo { stargazers_count: number; topics: string[]; language: string | null; homepage: string | null; description: string | null; name: string }
export async function repoInfo(token: string, fullName: string): Promise<GhRepoInfo> {
  const { data } = await gh<GhRepoInfo>(`/repos/${fullName}`, token);
  return { stargazers_count: data.stargazers_count ?? 0, topics: data.topics ?? [], language: data.language, homepage: data.homepage, description: data.description, name: data.name };
}
