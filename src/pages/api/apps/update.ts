import type { APIRoute } from 'astro';
import { sql, appBySlug, canEdit, setMakers, GH_LOGIN } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
import { PLATFORMS } from '../../../lib/platform';
import { pingIndexNow, appPaths } from '../../../lib/indexnow';
import { storeIdFrom, lookupStore } from '../../../lib/signing';
export const prerender = false;
const TOOLS = ['Claude Code', 'Cursor', 'Lovable', 'Bolt', 'Copilot', 'Codex', 'Autre'];
const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null;
const httpOnly = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user) return redirect(`${lang}/?erreur=session`, 302);
  const f = await request.formData();
  const slug = clean(f.get('slug'), 120);
  const tool = TOOLS.includes(String(f.get('tool'))) ? String(f.get('tool')) : null;
  const pricing = ['free', 'donations', 'paid'].includes(String(f.get('pricing'))) ? String(f.get('pricing')) : 'free';
  const status = ['polishing', 'done', 'paused'].includes(String(f.get('status'))) ? String(f.get('status')) : 'polishing';
  const platform = (PLATFORMS as readonly string[]).includes(String(f.get('platform'))) ? String(f.get('platform')) : null;
  const takeover = f.get('takeover') === 'on';
  const file = f.get('image');
  let image: Buffer | null = null, imageType: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 2_000_000) return redirect(`${lang}/app/${slug}/modifier?erreur=image`, 302);
    image = Buffer.from(await file.arrayBuffer()); imageType = file.type;
  }
  const before = slug ? await appBySlug(slug) : null;
  if (!before || !canEdit(before, user)) return redirect(`${lang}/?erreur=fiche`, 302);
  // Le lien App Store : déclaré ici, vérifié chez Apple tout de suite, jamais gardé s'il ne mène à aucune app.
  // Champ vide mais lien de l'app déjà sur l'App Store : on le retrouve là, comme le fait le cron chaque nuit.
  const url = httpOnly(clean(f.get('url'), 500));
  const storeUrl = clean(f.get('store_url'), 500);
  const declared = storeIdFrom(storeUrl);
  if (storeUrl && !declared) return redirect(`${lang}/app/${slug}/modifier?erreur=store`, 302);
  const storeId = declared ?? storeIdFrom(url);
  const store = !storeId ? null : storeId === before.store?.id ? before.store : await lookupStore(storeId).catch(() => null);
  if (declared && !store) return redirect(`${lang}/app/${slug}/modifier?erreur=store`, 302);
  // La liste des co-makers : seul le propriétaire y touche. Deux logins au plus, jamais le sien.
  if (before.user_id === user.id && f.has('makers')) {
    const logins = [...new Set(String(f.get('makers') ?? '').split(/[,\s]+/).map((l) => l.replace(/^@/, '').trim()).filter((l) => l && GH_LOGIN.test(l) && l.toLowerCase() !== user.login.toLowerCase()))].slice(0, 2);
    await setMakers(before.id, logins);
  }
  const rows = (await sql.query(
    `update apps set url = $1, image_url = coalesce($2, image_url), longest = $3, tool = $4, pricing = $5, status = $6, name = coalesce($7, name),
       image = coalesce($10, image), image_type = coalesce($11, image_type), tagline = $12, platform = coalesce($13, platform), takeover = $14, store_url = $15, store = $16
     where id = $9 and slug = $8 returning id, slug`,
    [url, httpOnly(clean(f.get('image_url'), 500)), clean(f.get('longest'), 600), tool, pricing, status, clean(f.get('name'), 80), slug, before.id, image, imageType, clean(f.get('tagline'), 140), platform, takeover, declared ? storeUrl : null, store && JSON.stringify(store)],
  )) as { id: number; slug: string }[];
  if (!rows.length) return redirect(`${lang}/?erreur=fiche`, 302);
  await pingIndexNow(appPaths(rows[0].slug));
  if (status !== 'polishing') await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'status', $2)`, [rows[0].id, JSON.stringify({ status })]);
  if (takeover && before && !before.takeover) await sql.query(`insert into activity (app_id, kind) values ($1, 'takeover')`, [rows[0].id]);
  const batch = (cookies.get('nac_batch')?.value ?? '').split(',').filter((x) => x && x !== rows[0].slug);
  if (batch.length) { cookies.set('nac_batch', batch.join(','), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600 }); return redirect(`${lang}/app/${batch[0]}/modifier`, 302); }
  cookies.delete('nac_batch', { path: '/' });
  return redirect(`${lang}/app/${rows[0].slug}`, 302);
};
