// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Le domaine du site : les cartes de partage, le sitemap et le MCP ont besoin d'une URL absolue.
  site: 'https://notacent.app',
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
