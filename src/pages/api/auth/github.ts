import type { APIRoute } from 'astro';
export const prerender = false;
// Étape 2 : redirection OAuth GitHub. Pour l'instant, on renvoie à l'accueil.
export const GET: APIRoute = ({ url, redirect }) => {
  const repo = url.searchParams.get('repo') ?? '';
  return redirect(`/?soon=1&repo=${encodeURIComponent(repo)}`, 302);
};
