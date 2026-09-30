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

// « notYours » : la fiche est publiée mais pas à la personne connectée. On le lui dit, avec le login du maker (déjà public sur la fiche).
export type EditAccess = { user: SessionUser; app: DbApp } | { notFound: true } | { notYours: { slug: string; owner: string; me: string } };
export async function editAccess(cookies: AstroCookies, locale: Locale, slug: string): Promise<EditAccess | Response> {
  const user = await signedIn(cookies, locale, localePath(locale, `/app/${slug}/modifier`));
  if (user instanceof Response) return user;
  const app = await appBySlug(slug).catch(() => null);
  // Une fiche non réclamée n'a personne pour la remplir : l'admin peut le faire en attendant son maker.
  if (!app) return { notFound: true };
  if (canEdit(app, user) || (app.unclaimed && isAdmin(user.login))) return { user, app };
  return app.published && app.login ? { notYours: { slug: app.slug, owner: app.login, me: user.login } } : { notFound: true };
}
