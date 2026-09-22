import type { APIRoute } from 'astro';
import { appBySlug, sql, hasDb } from '../../../lib/db';
import { apps } from '../../../data/apps';
import { toView, declaredFree, declaredPaid } from '../../../lib/view';
import { t, type Locale } from '../../../i18n/strings';
import { appCard, renderCard, shotDataUri } from '../../../lib/og';

export const prerender = false;

// La légende surlignée et la ligne de provenance, dans la langue de la carte.
function calendarFor(dates: string[], total: number, refreshedAt: string | undefined, locale: Locale) {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (52 * 7 + (start.getUTCDay() + 6) % 7) * 86_400_000);
  const from = start.toISOString().slice(0, 10);
  const inYear = dates.filter((d) => d >= from).length;
  const before = Math.max(0, total - inYear);
  const fr = locale === 'fr';
  const caption = fr
    ? `${inYear} jour${inYear > 1 ? 's' : ''} de travail sur 12 mois${before ? `, ${before} avant` : ''}`
    : `${inYear} day${inYear > 1 ? 's' : ''} of work over 12 months${before ? `, ${before} before that` : ''}`;
  const read = refreshedAt ? new Date(refreshedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const provenance = [read ? (fr ? `lu le ${read}` : `read on ${read}`) : null, fr ? 'un jour = un commit humain' : 'one day = one human commit', 'notacent.app'].filter(Boolean).join(' \u00b7 ');
  return { dates, caption, provenance, locale };
}

async function shot(slug: string): Promise<string | undefined> {
  if (!hasDb) return undefined;
  try {
    const [r] = (await sql.query(`select image from apps where slug = $1 and image is not null`, [slug])) as {
      image: Uint8Array | string;
    }[];
    if (!r) return undefined;
    const bytes = typeof r.image === 'string' ? Buffer.from(r.image.replace(/^\\x/, ''), 'hex') : Buffer.from(r.image);
    return shotDataUri(bytes, 300, 225);
  } catch {
    return undefined;
  }
}

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.slug ?? '';
  const row = await appBySlug(slug).catch(() => null);
  const app = row ? toView(row) : apps.find((a) => a.slug === slug);
  if (!app) return new Response(null, { status: 404 });

  const locale: Locale = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const s = t(locale);
  // Même tampon que la fiche : le prix déclaré par le maker, rien pour une fiche non réclamée.
  const png = await renderCard(
    appCard({
      name: app.name,
      tagline: app.tagline ?? (app.longest[locale] || undefined),
      owner: app.owner,
      tool: app.tool,
      language: app.language,
      byLabel: s.by,
      stampLabel: declaredPaid(app) ? s.paid : app.pricing === 'donations' && declaredFree(app) ? s.donations : declaredFree(app) ? '0 €' : undefined,
      stats: [
        { value: app.activeDays.toLocaleString(locale), label: s.days },
        { value: app.commits.toLocaleString(locale), label: s.commits },
        { value: `${app.bestStreakWeeks} ${s.weeks}`, label: s.streak },
      ],
      shot: row ? await shot(slug) : undefined,
      calendar: app.activeDates?.length ? calendarFor(app.activeDates, app.activeDays, app.refreshedAt, locale) : undefined,
    }),
  );

  return new Response(png as Uint8Array<ArrayBuffer>, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
  });
};
