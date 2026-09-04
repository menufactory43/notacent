// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://notacent.dev',
  adapter: vercel({ includeFiles: ['./src/assets/fonts/Caveat-Bold.ttf', './src/assets/fonts/AtkinsonHyperlegible-Regular.ttf', './src/assets/fonts/AtkinsonHyperlegible-Bold.ttf', './src/assets/fonts/IBMPlexMono-Medium.ttf'] }),
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
