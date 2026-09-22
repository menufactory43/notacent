import type { App } from '../data/apps';
import type { Locale } from '../i18n/strings';
import { declaredFree, declaredPricing, revenueState } from './view';
export const SITE = 'https://notacent.app';

// Données structurées : ce qu'un moteur, et l'assistant qui s'en sert, lisent d'une app sans deviner.
export function softwareLd(app: App, locale: Locale) {
  const url = `${SITE}${locale === 'fr' ? '' : '/en'}/app/${app.slug}`;
  const os = /swift/i.test(app.language) ? 'macOS, iOS' : /kotlin/i.test(app.language) ? 'Android' : 'Web';
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': url, name: app.name, url,
    description: app.tagline ?? app.longest[locale] ?? undefined,
    applicationCategory: 'UtilitiesApplication', operatingSystem: os, inLanguage: locale,
    // Un prix seulement quand on le connaît : 0 pour une app gratuite ou à dons déclarée par son maker, rien sinon.
    ...(declaredFree(app) ? { isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } } : {}),
    author: [app.owner, ...(app.comakers ?? [])].map((l) => ({ '@type': 'Person', name: l, url: `https://github.com/${l}` })),
    ...(app.url ? { installUrl: app.url, downloadUrl: app.url } : {}),
    ...(app.repo ? { codeRepository: app.repo } : {}),
    ...(app.imageUrl ? { image: new URL(app.imageUrl, SITE).toString() } : {}),
    datePublished: app.firstCommit.slice(0, 10),
    ...(app.bravos > 0 ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: app.bravos } } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'activeDays', value: app.activeDays, description: 'Days with at least one commit, read from the GitHub repo' },
      { '@type': 'PropertyValue', name: 'commits', value: app.commits },
      { '@type': 'PropertyValue', name: 'authors', value: app.authors ?? 1, description: 'Human authors found in the commit history, bots excluded' },
      ...(app.ownerCommits != null ? [{ '@type': 'PropertyValue', name: 'makerCommits', value: app.ownerCommits, description: 'Commits authored by the maker themself' }] : []),
      ...(app.refreshedAt ? [{ '@type': 'PropertyValue', name: 'readOn', value: app.refreshedAt.slice(0, 10), description: 'Last time the repo was read' }] : []),
      { '@type': 'PropertyValue', name: 'mainTool', value: app.tool },
      { '@type': 'PropertyValue', name: 'githubStars', value: app.stars ?? 0 },
      ...(app.platform ? [{ '@type': 'PropertyValue', name: 'platform', value: app.platform }] : []),
      ...((app.alternativeTo ?? []).length ? [{ '@type': 'PropertyValue', name: 'alternativeTo', value: app.alternativeTo!.map((x) => x.name).join(', '), description: 'Products this app is listed as an alternative to' }] : []),
      // Le modèle économique et le revenu, tels que le maker les a déclarés. Rien quand personne n'a rien dit.
      ...(declaredPricing(app) ? [{ '@type': 'PropertyValue', name: 'businessModel', value: declaredPricing(app), description: 'Declared by the maker' }] : []),
      ...(revenueState(app) === 'zero' ? [{ '@type': 'PropertyValue', name: 'revenueToDate', value: 0, unitCode: 'EUR', description: 'Nothing earned yet, declared by the maker, not verified' }] : []),
      ...(revenueState(app) === 'first' ? [
        { '@type': 'PropertyValue', name: 'firstEuroOn', value: app.firstEuroAt, description: 'First euro made, declared by the maker, not verified' },
        ...(app.firstEuroDays != null ? [{ '@type': 'PropertyValue', name: 'activeDaysBeforeFirstEuro', value: app.firstEuroDays, description: 'Active days read from the repo up to the declared first euro' }] : []),
      ] : []),
      ...(app.takeover ? [{ '@type': 'PropertyValue', name: 'openToTakeover', value: true, description: 'The maker is open to handing the app over' }] : []),
    ],
  };
}

// Fil d'Ariane : la page dit d'où elle vient, le moteur aussi.
export function breadcrumbLd(locale: Locale, items: [string, string][]) {
  const base = locale === 'fr' ? SITE : `${SITE}/en`;
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: path === '/' ? base : `${base}${path}` })),
  };
}
// Une page « Parcourir » : une liste ordonnée d'apps, avec son titre.
export function listLd(locale: Locale, name: string, apps: App[], path: string) {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList', '@id': `${SITE}${locale === 'fr' ? '' : '/en'}${path}`, name,
    itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: apps.length,
    itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, item: softwareLd(a, locale) })),
  };
}

export function siteLd(locale: Locale, apps: App[]) {
  const home = locale === 'fr' ? SITE : `${SITE}/en`;
  const fr = locale === 'fr';
  return [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#site`, url: home, name: 'Not a Cent', inLanguage: locale,
      description: fr ? "Le travail vérifié, pas le revenu : des apps peaufinées pendant des mois qui n'ont pas encore gagné un centime, classées par jours de commit lus dans le repo GitHub. Être listé ne coûte rien." : "Verified work, not revenue: apps polished for months that haven't made a cent yet, ranked by commit days read from the GitHub repo. Being listed costs nothing.",
      publisher: { '@type': 'Organization', name: 'Not a Cent', url: SITE, logo: `${SITE}/favicon.svg` },
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: fr ? 'Pas un centime' : 'Not a cent yet', itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: apps.length,
      itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, item: softwareLd(a, locale) })),
    },
  ];
}
