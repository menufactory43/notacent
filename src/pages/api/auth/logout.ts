import type { APIRoute } from 'astro';
import { clearSession } from '../../../lib/session';
export const prerender = false;
// « Changer de compte » renvoie vers la page d'où l'on vient ; seul un chemin du site est accepté.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  clearSession(cookies);
  const back = String((await request.formData().catch(() => null))?.get('back') ?? '');
  return redirect(/^\/(?!\/)/.test(back) ? back : '/', 302);
};
