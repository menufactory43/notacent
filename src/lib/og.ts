import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori, { type SatoriOptions } from 'satori';
import sharp from 'sharp';

export const OG_W = 1200;
export const OG_H = 630;

// Palette claire du cahier (src/styles/global.css). Les cartes de partage sont
// toujours en clair : les aperçus Twitter/X n'ont pas de mode sombre.
const INK = '#1F1D2B';
const PENCIL = '#7C7A8A';
const FAINT = '#E6E4EC';
const PAPER = '#FFFFFF';
const PAPER2 = '#FAF9FC';
const HILITE = '#FFE45C';
const REDPEN = '#D9432F';

const HAND = 'Caveat';
const BODY = 'Atkinson Hyperlegible';
const MONO = 'IBM Plex Mono';

// Le bundle Vercel sépare le code (.vercel/output/server/chunks) des fichiers
// recopiés par `includeFiles` (à la racine de la fonction) : on essaie les deux.
async function font(f: string): Promise<Buffer> {
  const candidates = [
    fileURLToPath(new URL(`../assets/fonts/${f}`, import.meta.url)),
    join(process.cwd(), 'src/assets/fonts', f),
  ];
  for (const p of candidates) {
    try {
      return await readFile(p);
    } catch {
      /* candidat suivant */
    }
  }
  throw new Error(`Police introuvable : ${f} (essayé ${candidates.join(', ')})`);
}

let fonts: SatoriOptions['fonts'] | null = null;
async function loadFonts(): Promise<SatoriOptions['fonts']> {
  if (fonts) return fonts;
  const [hand, body, bodyBold, mono] = await Promise.all([
    font('Caveat-Bold.ttf'),
    font('AtkinsonHyperlegible-Regular.ttf'),
    font('AtkinsonHyperlegible-Bold.ttf'),
    font('IBMPlexMono-Medium.ttf'),
  ]);
  fonts = [
    { name: HAND, data: hand, weight: 700, style: 'normal' },
    { name: BODY, data: body, weight: 400, style: 'normal' },
    { name: BODY, data: bodyBold, weight: 700, style: 'normal' },
    { name: MONO, data: mono, weight: 500, style: 'normal' },
  ];
  return fonts;
}

// satori accepte des éléments façon React : on s'en tient à des objets simples
// pour ne pas avoir à brancher JSX sur des fichiers .ts.
type Node = { type: string; props: Record<string, unknown> } | string | false | null | undefined;
const h = (type: string, style: Record<string, unknown>, ...children: Node[]): Node => {
  // satori exige `display: flex` dès que `children` est un tableau, même vide :
  // on n'expose donc la clé que s'il y a vraiment des enfants.
  const kids = children.filter(Boolean);
  return { type, props: kids.length ? { style, children: kids.length === 1 ? kids[0] : kids } : { style } };
};
const text = (s: string, style: Record<string, unknown>) => h('div', { display: 'flex', ...style }, s);

async function toPng(node: Node): Promise<Uint8Array> {
  const svg = await satori(node as Parameters<typeof satori>[0], { width: OG_W, height: OG_H, fonts: await loadFonts() });
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

/** Le logo « Not a Cent », avec le trait de stylo rouge sur « Cent ». */
function logo(size = 44): Node {
  return h(
    'div',
    { display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: HAND, fontSize: size, color: INK },
    text('Not a', {}),
    h(
      'div',
      { display: 'flex', position: 'relative' },
      text('Cent', {}),
      h('div', {
        position: 'absolute',
        left: -4,
        right: -4,
        top: '52%',
        height: Math.max(3, Math.round(size / 14)),
        backgroundColor: REDPEN,
        borderRadius: 2,
        transform: 'rotate(-8deg)',
      }),
    ),
  );
}

/** Le tampon « 0 € » en haut à droite, comme sur la fiche. */
function stamp(label: string): Node {
  return h(
    'div',
    {
      display: 'flex',
      position: 'absolute',
      top: 34,
      right: 46,
      transform: 'rotate(-7deg)',
      border: `3px solid ${REDPEN}`,
      borderRadius: 18,
      padding: '12px 24px',
      backgroundColor: PAPER,
      color: REDPEN,
      fontFamily: HAND,
      fontSize: 40,
    },
    // satori ne connaît pas `border-style: double` : on double le trait à la main.
    h('div', {
      position: 'absolute',
      top: 4,
      left: 4,
      right: 4,
      bottom: 4,
      border: `2px solid ${REDPEN}`,
      borderRadius: 13,
    }),
    text(label, {}),
  );
}

function frame(...children: Node[]): Node {
  return h(
    'div',
    {
      width: OG_W,
      height: OG_H,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: PAPER,
      padding: 56,
      position: 'relative',
    },
    h('div', {
      position: 'absolute',
      top: 18,
      left: 18,
      right: 18,
      bottom: 18,
      border: `3px solid ${INK}`,
      borderRadius: 28,
    }),
    ...children,
  );
}

function statCell(value: string, label: string): Node {
  return h(
    'div',
    { display: 'flex', flexDirection: 'column', paddingTop: 10, borderTop: `2px solid ${FAINT}`, marginRight: 34 },
    text(value, { fontFamily: MONO, fontSize: 40, color: INK }),
    text(label, { fontFamily: HAND, fontSize: 24, color: PENCIL }),
  );
}

export interface SiteCard {
  tagline: string;
  note: string;
}

export function siteCard(c: SiteCard): Node {
  return frame(
    stamp('0 \u20ac'),
    logo(64),
    h('div', { display: 'flex', flexGrow: 1 }),
    text(c.tagline, { fontFamily: HAND, fontSize: 86, color: INK, lineHeight: 1.05, maxWidth: 940 }),
    h('div', { display: 'flex', flexGrow: 1 }),
    h('div', { display: 'flex', paddingTop: 16, borderTop: `2px solid ${FAINT}` },
      text(c.note, { fontFamily: BODY, fontSize: 26, color: PENCIL }),
    ),
  );
}

export interface AppCard {
  name: string;
  tagline?: string;
  owner: string;
  tool: string;
  language: string;
  stats: { value: string; label: string }[];
  stampLabel: string;
  byLabel: string;
  shot?: string; // data URI
}

export function appCard(c: AppCard): Node {
  const meta = [`${c.byLabel} @${c.owner}`, c.tool, c.language].filter(Boolean).join(' · ');
  return frame(
    stamp(c.stampLabel),
    logo(34),
    h(
      'div',
      { display: 'flex', flexGrow: 1, alignItems: 'center', gap: 40, marginTop: 22 },
      h(
        'div',
        { display: 'flex', flexDirection: 'column', flexGrow: 1, maxWidth: c.shot ? 620 : 1000 },
        text(c.name, { fontFamily: HAND, fontSize: 84, color: INK, lineHeight: 1.05 }),
        c.tagline
          ? text(c.tagline, { fontFamily: BODY, fontSize: 28, color: INK, marginTop: 10, lineHeight: 1.35 })
          : null,
        text(meta, { fontFamily: BODY, fontSize: 22, color: PENCIL, marginTop: 14 }),
        h(
          'div',
          { display: 'flex', marginTop: 26 },
          ...c.stats.map((s) => statCell(s.value, s.label)),
        ),
      ),
      c.shot
        ? h(
            'div',
            {
              display: 'flex',
              width: 380,
              height: 285,
              border: `3px solid ${INK}`,
              borderRadius: 20,
              backgroundColor: PAPER2,
              overflow: 'hidden',
            },
            { type: 'img', props: { src: c.shot, width: 380, height: 285, style: { objectFit: 'cover' } } },
          )
        : null,
    ),
  );
}

export const renderCard = toPng;

/** Redimensionne une capture pour l'encastrer dans la carte, en data URI. */
export async function shotDataUri(bytes: Uint8Array): Promise<string | undefined> {
  try {
    const png = await sharp(bytes).resize(380, 285, { fit: 'cover' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return undefined;
  }
}
