import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
export const prerender = false;
// Retire une fiche pour de bon : la ligne, son activité et ses sponsors partent (cascade).
// Le repo reste ouvert à la GitHub App ; le maker peut la republier depuis /ajouter.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user) return redirect(`${lang}/?erreur=session`, 302);
  const slug = String((await request.formData()).get('slug') ?? '').slice(0, 120);
  const rows = (await sql.query(`delete from apps where slug = $1 and user_id = $2 returning id`, [slug, user.id])) as { id: number }[];
  if (!rows.length) return redirect(`${lang}/?erreur=fiche`, 302);
  const batch = (cookies.get('nac_batch')?.value ?? '').split(',').filter((s) => s && s !== slug);
  if (batch.length) { cookies.set('nac_batch', batch.join(','), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600 }); return redirect(`${lang}/app/${batch[0]}/modifier`, 302); }
  cookies.delete('nac_batch', { path: '/' });
  return redirect(`${lang}/?retiree=1`, 302);
};
