// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Le domaine du site : les cartes de partage, le sitemap et le MCP ont besoin d'une URL absolue.
  site: 'https://notacent.app',
  // Le CSS du site est petit (~20 Ko, ~5 Ko compressé) : l'inliner évite trois feuilles bloquantes avant le premier affichage.
  build: { inlineStylesheets: 'always' },
  vite: {
    build: {
      // La police du texte (Atkinson 400, ~11 Ko) part en data: dans le CSS inliné : le texte du hero,
      // élément LCP, s'affiche dès la première peinture sans attendre une requête de police.
      assetsInlineLimit: (file) => (file.endsWith('AtkinsonHyperlegible-400-latin.woff2') ? true : undefined),
    },
  },
  adapter: vercel({
    // Les cartes de partage (satori) lisent ces fichiers au moment du rendu :
    // le tracing des dépendances ne les voit pas, on les recopie à la main.
    includeFiles: [
      './src/assets/fonts/Caveat-Bold.ttf',
      './src/assets/fonts/AtkinsonHyperlegible-Regular.ttf',
      './src/assets/fonts/AtkinsonHyperlegible-Bold.ttf',
      './src/assets/fonts/IBMPlexMono-Medium.ttf',
      './node_modules/harfbuzzjs/hb.wasm',
    ],
  }),
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
