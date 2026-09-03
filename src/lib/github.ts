import { SignJWT, importPKCS8 } from 'jose';

const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
export const appSlug = () => env('GITHUB_APP_SLUG');
export const clientId = () => env('GITHUB_CLIENT_ID');
export const githubReady = () => Boolean(clientId() && env('GITHUB_CLIENT_SECRET'));
const UA = 'notacent (+https://notacent.vercel.app)';

export async function gh<T>(path: string, token: string, init: RequestInit = {}): Promise<{ data: T; next: string | null }> {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': UA, 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  const link = res.headers.get('link') ?? '';
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  return { data: (await res.json()) as T, next: m ? m[1] : null };
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: clientId(), client_secret: env('GITHUB_CLIENT_SECRET'), code }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(j.error_description ?? j.error ?? 'échange OAuth refusé');
  return j.access_token;
}

export interface GhUser { id: number; login: string; name: string | null; avatar_url: string }
export interface GhRepo { id: number; name: string; full_name: string; description: string | null; language: string | null; private: boolean; homepage: string | null; html_url: string; default_branch: string; pushed_at: string; fork: boolean }

export const me = (token: string) => gh<GhUser>('/user', token).then((r) => r.data);

export async function userInstallations(token: string) {
  const { data } = await gh<{ installations: { id: number; app_slug: string }[] }>('/user/installations', token);
  return data.installations.filter((i) => !appSlug() || i.app_slug === appSlug());
}
export async function installationRepos(token: string, installationId: number): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  let url: string | null = `/user/installations/${installationId}/repositories?per_page=100`;
  while (url) {
    const r: { data: { repositories: GhRepo[] }; next: string | null } = await gh(url, token);
    out.push(...r.data.repositories);
    url = r.next;
  }
  return out.filter((r) => !r.fork).sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1));
}

// Jeton d'installation (serveur à serveur) pour le cron : signé avec la clé privée de l'app.
let cache: { id: number; token: string; exp: number } | null = null;
export async function installationToken(installationId: number): Promise<string> {
  if (cache && cache.id === installationId && cache.exp > Date.now() + 60_000) return cache.token;
  const pem = env('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'RS256');
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setIssuedAt(Math.floor(Date.now() / 1000) - 30).setExpirationTime('9m').setIssuer(env('GITHUB_APP_ID')).sign(key);
  const { data } = await gh<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, jwt, { method: 'POST' });
  cache = { id: installationId, token: data.token, exp: new Date(data.expires_at).getTime() };
  return data.token;
}
