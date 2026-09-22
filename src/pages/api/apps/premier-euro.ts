import type { APIRoute } from 'astro';
import { sql, appBySlug, canEdit } from '../../../lib/db';
import { currentUser } from '../../../lib/session';
import { pingIndexNow, appPaths } from '../../../lib/indexnow';
export const prerender = false;

// « Mon app a gagné son premier euro » : une date, déclarée par le maker. L'app franchit un cap, elle ne sort pas :
// elle passe du classement « Pas un centime » au classement « Premier euro », toujours classée par travail.
// On fige les jours actifs comptés jusqu'à ce jour-là : c'est le chiffre « jours actifs avant le premier euro ».
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!user) return redirect(`${lang}/?erreur=session`, 302);
  const f = await request.formData();
  const app = await appBySlug(String(f.get('slug') ?? '').slice(0, 120));
  // Seul le maker (ou un co-maker) déclare un revenu : jamais l'admin à la place d'une fiche non réclamée.
  if (!app || !canEdit(app, user)) return redirect(`${lang}/?erreur=fiche`, 302);
  const back = `${lang}/app/${app.slug}`;
  if (f.get('undo')) {
    await sql.query(`update apps set first_euro_at = null, first_euro_days = null where id = $1`, [app.id]);
    await sql.query(`delete from activity where app_id = $1 and kind = 'first_euro'`, [app.id]);
  } else {
    const date = String(f.get('date') ?? '');
    const today = new Date().toISOString().slice(0, 10);
    const first = app.first_commit ? new Date(app.first_commit).toISOString().slice(0, 10) : '0000-00-00';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today || date < first) return redirect(`${lang}/app/${app.slug}/modifier?erreur=date#premier-euro`, 302);
    // Les jours actifs jusqu'au premier euro : lus dans le registre des jours ; sans registre, le total du jour.
    await sql.query(
      `update apps set first_euro_at = $2::date,
         first_euro_days = case when cardinality(coalesce(active_dates, '{}')) > 0 then (select count(*)::int from unnest(active_dates) d where d <= $2::date) else active_days end,
         revenue_source = coalesce(revenue_source, 'declared'), revenue_declared_at = coalesce(revenue_declared_at, now())
       where id = $1`,
      [app.id, date],
    );
    if (!app.first_euro_at) await sql.query(`insert into activity (app_id, kind, payload) values ($1, 'first_euro', $2)`, [app.id, JSON.stringify({ date })]);
  }
  await pingIndexNow(['/', '/en', '/intention/premier-euro', '/en/intention/premier-euro', '/chiffres', '/en/chiffres', ...appPaths(app.slug)]);
  return redirect(back, 302);
};
