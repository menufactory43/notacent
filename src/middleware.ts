import { defineMiddleware } from 'astro:middleware';

// Les pages sont rendues à la demande et lisent la base. Sans cache, chaque visite et chaque robot la réveillait :
// une requête toutes les quelques minutes suffit à la garder allumée en continu, et le crédit de calcul de Neon y passait.
// Une visite anonyme (sans cookie) prend donc la page du CDN, rafraîchie au plus une fois par heure en arrière-plan.
// Connecté, on a ses propres boutons (déconnexion, « modifier ») : jamais en cache.
const PERSONAL = /^\/(en\/)?(ajouter|coulisses|app\/[^/]+\/modifier)\/?$/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();
  const { pathname, search } = ctx.url;
  if (ctx.isPrerendered || pathname.startsWith('/api/') || res.headers.has('Cache-Control')) return res;
  if (!(res.headers.get('Content-Type') ?? '').startsWith('text/html')) return res;
  const anonymous = !ctx.request.headers.get('cookie')?.includes('nac_');
  const shareable = ['GET', 'HEAD'].includes(ctx.request.method) && !search && !PERSONAL.test(pathname) && (res.status === 200 || res.status === 404) && !res.headers.has('Set-Cookie');
  if (anonymous && shareable) {
    res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    res.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  } else {
    res.headers.set('Cache-Control', 'private, no-store');
  }
  // Le CDN range à part les visites avec cookie : une page connectée n'est jamais servie à un autre.
  res.headers.set('Vary', 'Cookie');
  return res;
});
