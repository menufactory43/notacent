import type { AstroCookies } from 'astro';
import { localePath, type Locale } from '../i18n/strings';
import { currentUser, type SessionUser } from './session';
import { appBySlug, canEdit, type DbApp } from './db';
import { isAdmin } from './outreach';

// Astro n'accepte une redirection ou un 404 que depuis une page : un composant qui renvoie une Response sert une page blanche.
// Les pages appellent donc ces gardes et renvoient la Response elles-mêmes.
const signIn = (locale: Locale, back?: string) =>
  new Response(null, { status: 302, headers: { Location: `/api/auth/github?lang=${locale}${back ? `&back=${encodeURIComponent(back)}` : ''}` } });

export async function signedIn(cookies: AstroCookies, locale: Locale, back?: string): Promise<SessionUser | Response> {
  const user = await currentUser(cookies).catch(() => null);
  return user ?? signIn(locale, back);
}

export async function editAccess(cookies: AstroCookies, locale: Locale, slug: string): Promise<{ user: SessionUser; app: DbApp } | Response> {
  const user = await signedIn(cookies, locale, localePath(locale, `/app/${slug}/modifier`));
  if (user instanceof Response) return user;
  const app = await appBySlug(slug).catch(() => null);
  // Une fiche non réclamée n'a personne pour la remplir : l'admin peut le faire en attendant son maker.
  if (!app || !(canEdit(app, user) || (app.unclaimed && isAdmin(user.login)))) return new Response(null, { status: 404 });
  return { user, app };
}
