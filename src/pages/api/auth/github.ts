import type { APIRoute } from 'astro';
import { clientId, githubReady } from '../../../lib/github';
export const prerender = false;
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!githubReady()) return redirect('/?soon=1', 302);
  const state = crypto.randomUUID();
  cookies.set('nac_state', state, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  const repo = url.searchParams.get('repo');
  if (repo) cookies.set('nac_repo', repo, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  cookies.set('nac_lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const redirectUri = `${url.origin}/api/auth/callback`;
  const p = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri, state });
  return redirect(`https://github.com/login/oauth/authorize?${p}`, 302);
};
