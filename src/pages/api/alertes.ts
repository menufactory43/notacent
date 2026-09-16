import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { addAlert, removeAlert, INTENTS } from '../../lib/db';
import { browseFromParams, KIND_PATH } from '../../lib/browse';
export const prerender = false;
// Créer une alerte : un email, un filtre. Gratuit, un mail par semaine au plus. Le lien de désinscription est dans chaque mail.
export const POST: APIRoute = async ({ request, redirect }) => {
  const f = await request.formData();
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const lang = f.get('lang') === 'en' ? 'en' : 'fr';
  const back = String(f.get('back') ?? '').startsWith('/') ? String(f.get('back')) : lang === 'en' ? '/en' : '/';
  const sep = back.includes('?') ? '&' : '?';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return redirect(`${back}${sep}alerte=bad`, 302);
  const kind = String(f.get('kind') ?? ''), value = String(f.get('value') ?? '');
  const b = kind && value ? browseFromParams(KIND_PATH[kind as keyof typeof KIND_PATH] ?? '', kind === 'intent' && (INTENTS as string[]).includes(value) ? value : value.toLowerCase().replace(/\s+/g, '-')) : null;
  const filter = b ?? (kind === 'language' && value ? { kind: 'language' as const, value } : {});
  const r = await addAlert(email, lang, filter, randomBytes(16).toString('hex')).catch(() => 'exists' as const);
  return redirect(`${back}${sep}alerte=${r === 'added' ? 'ok' : 'exists'}`, 302);
};
// Se désinscrire : le lien du mail.
export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  if (url.searchParams.get('stop') && /^[a-f0-9]{32}$/.test(token)) await removeAlert(token).catch(() => {});
  return redirect('/?alerte=bye', 302);
};
