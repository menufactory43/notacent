import type { App } from '../data/apps';
import type { Locale } from '../i18n/strings';
export const SITE = 'https://notacent.vercel.app';

// Données structurées : ce qu'un moteur, et l'assistant qui s'en sert, lisent d'une app sans deviner.
export function softwareLd(app: App, locale: Locale) {
  const url = `${SITE}${locale === 'fr' ? '' : '/en'}/app/${app.slug}`;
  const os = /swift/i.test(app.language) ? 'macOS, iOS' : /kotlin/i.test(app.language) ? 'Android' : 'Web';
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': url, name: app.name, url,
    description: app.tagline ?? app.longest[locale] ?? undefined,
    applicationCategory: 'UtilitiesApplication', operatingSystem: os, inLanguage: locale,
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    author: { '@type': 'Person', name: app.owner, url: `https://github.com/${app.owner}` },
    ...(app.url ? { installUrl: app.url, downloadUrl: app.url } : {}),
    ...(app.repo ? { codeRepository: app.repo } : {}),
    ...(app.imageUrl ? { image: new URL(app.imageUrl, SITE).toString() } : {}),
    datePublished: app.firstCommit.slice(0, 10),
    ...(app.bravos > 0 ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: app.bravos } } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'activeDays', value: app.activeDays, description: 'Days with at least one commit, read from the GitHub repo' },
      { '@type': 'PropertyValue', name: 'commits', value: app.commits },
      { '@type': 'PropertyValue', name: 'mainTool', value: app.tool },
    ],
  };
}

export function siteLd(locale: Locale, apps: App[]) {
  const home = locale === 'fr' ? SITE : `${SITE}/en`;
  const fr = locale === 'fr';
  return [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#site`, url: home, name: 'Not a Cent', inLanguage: locale,
      description: fr ? 'Annuaire d\'apps gratuites peaufinées pendant des mois, classées par jours de travail lus dans le repo GitHub, jamais par revenu.' : 'Directory of free apps polished for months, ranked by days of work read from the GitHub repo, never by revenue.',
      publisher: { '@type': 'Organization', name: 'Not a Cent', url: SITE, logo: `${SITE}/favicon.svg` },
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: fr ? 'En cours de peaufinage' : 'Still polishing', itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: apps.length,
      itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, item: softwareLd(a, locale) })),
    },
  ];
}
