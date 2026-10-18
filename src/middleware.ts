import { defineMiddleware } from 'astro:middleware';

// Les pages sont rendues à la demande et lisent la base. Sans cache, chaque visite et chaque robot la réveillait :
// une requête toutes les quelques minutes suffit à la garder allumée en continu, et le crédit de calcul de Neon y passait.
// Les pages publiques sont donc les mêmes pour tous et sortent du CDN, rafraîchies au plus une fois par heure en arrière-plan.
// Ce qui ne regarde que la personne connectée (déconnexion, « modifier ») s'affiche dans le navigateur, via /api/moi.
// Les pages qui dépendent de la session (ajouter, modifier, coulisses) ou d'un paramètre ne sont jamais en cache.
const PERSONAL = /^\/(en\/)?(ajouter|coulisses|app\/[^/]+\/modifier)\/?$/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();
  const { pathname, search } = ctx.url;
  if (ctx.isPrerendered || pathname.startsWith('/api/') || res.headers.has('Cache-Control')) return res;
  if (!(res.headers.get('Content-Type') ?? '').startsWith('text/html')) return res;
  const shareable = ['GET', 'HEAD'].includes(ctx.request.method) && !search && !PERSONAL.test(pathname) && (res.status === 200 || res.status === 404) && !res.headers.has('Set-Cookie');
  if (shareable) {
    res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    res.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  } else {
    res.headers.set('Cache-Control', 'private, no-store');
  }
  return res;
});
