// Génère les cartes de partage statiques du site dans public/.
// `npm run og` après un changement de baseline (titre, palette, polices).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { siteCard, renderCard } from '../src/lib/og.ts';
import { t } from '../src/i18n/strings.ts';

for (const locale of ['fr', 'en']) {
  const s = t(locale);
  const png = await renderCard(siteCard({ tagline: s.tagline, note: s.foot1 }));
  const out = fileURLToPath(new URL(`../public/og${locale === 'fr' ? '' : `-${locale}`}.png`, import.meta.url));
  await writeFile(out, png);
  console.log(out, `${(png.byteLength / 1024).toFixed(0)} Ko`);
}
