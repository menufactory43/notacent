import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { appBySlug } from '../../../lib/db';
import { createCheckout, stripeReady } from '../../../lib/stripe';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const lang = cookies.get('nac_lang')?.value === 'en' ? 'en' : 'fr';
  const user = await currentUser(cookies);
  if (!user) return redirect(`/api/auth/github?lang=${lang}`, 302);
  const f = await request.formData();
  const app = await appBySlug(String(f.get('slug') ?? ''));
  if (!app || app.user_id !== user.id || !stripeReady()) return redirect(lang === 'en' ? '/en' : '/', 302);
  try {
    return redirect(await createCheckout({ appId: app.id, slug: app.slug, name: app.name, origin: url.origin, locale: lang }), 303);
  } catch (e) { console.error(e); return redirect(`${lang === 'en' ? '/en' : ''}/app/${app.slug}?sponsor=erreur`, 302); }
};
