import type { APIRoute } from 'astro';
import { appBySlug, sql, hasDb } from '../../../lib/db';
import { apps } from '../../../data/apps';
import { toView } from '../../../lib/view';
import { t, type Locale } from '../../../i18n/strings';
import { appCard, renderCard, shotDataUri } from '../../../lib/og';

export const prerender = false;

async function shot(slug: string): Promise<string | undefined> {
  if (!hasDb) return undefined;
  try {
    const [r] = (await sql.query(`select image from apps where slug = $1 and image is not null`, [slug])) as {
      image: Uint8Array | string;
    }[];
    if (!r) return undefined;
    const bytes = typeof r.image === 'string' ? Buffer.from(r.image.replace(/^\\x/, ''), 'hex') : Buffer.from(r.image);
    return shotDataUri(bytes);
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
  const png = await renderCard(
    appCard({
      name: app.name,
      tagline: app.tagline ?? (app.longest[locale] || undefined),
      owner: app.owner,
      tool: app.tool,
      language: app.language,
      byLabel: s.by,
      stampLabel: app.pricing === 'donations' ? s.donations : app.pricing === 'paid' ? '€' : '0 €',
      stats: [
        { value: app.activeDays.toLocaleString(locale), label: s.days },
        { value: app.commits.toLocaleString(locale), label: s.commits },
        { value: `${app.bestStreakWeeks} ${s.weeks}`, label: s.streak },
      ],
      shot: row ? await shot(slug) : undefined,
    }),
  );

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
  });
};
