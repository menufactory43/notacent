import type { APIRoute } from 'astro';
import { currentUser, signedInHint } from '../../lib/session';
export const prerender = false;
// Qui est connecté, pour les boutons que la page (servie depuis le cache) ne peut pas savoir : déconnexion, « modifier », sponsor.
export const GET: APIRoute = async ({ cookies }) => {
  const user = await currentUser(cookies).catch(() => null);
  signedInHint(cookies, Boolean(user));
  return new Response(JSON.stringify(user ? { id: user.id, login: user.login } : null), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
