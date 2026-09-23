// L'encart « App de la semaine » en haut de l'accueil. Choisi à la main, pas par le repo :
// c'est une mise en avant éditoriale, à ne pas confondre avec les tampons des pépites.
//
// Pour changer d'app chaque semaine, on ne touche qu'à cet objet. Mettre `appOfTheWeek`
// à `null` retire l'encart. Les paramètres UTM sont ajoutés tout seuls aux liens `url`.
// Rester honnête : le site parle d'apps qui n'ont pas gagné un centime, alors une app
// payante le dit (`price`), et une app à nous le dit aussi (`ours`).

type Text = { fr: string; en: string };

export interface AppOfTheWeek {
  name: string;
  /** Une phrase, ce que fait l'app. */
  pitch: Text;
  /** Le prix tel que le site de l'app l'annonce, ou « gratuite ». Jamais inventé. */
  price: Text;
  /** Lien externe, une URL par langue. Les UTM sont ajoutés à l'affichage. */
  url: Text;
  /** Slug de la fiche Not a Cent, si l'app en a une. */
  slug?: string;
  /** L'app est faite par l'équipe de Not a Cent. */
  ours?: boolean;
  /** Logo carré, facultatif. Sans logo, on affiche l'initiale. */
  imageUrl?: string;
}

export const appOfTheWeek: AppOfTheWeek | null = {
  name: 'Souffleuse',
  pitch: {
    fr: "Glisse le mot juste sous ton curseur, dans toutes les apps du Mac, avec une IA 100 % locale : ton texte ne quitte jamais ta machine.",
    en: 'Slips the right word under your cursor in any Mac app, with a 100% local AI: your text never leaves your machine.',
  },
  price: {
    fr: 'payante · achat unique dès 29 € · Mac Apple Silicon',
    en: 'paid · one-time purchase from €29 · Apple Silicon Macs',
  },
  url: { fr: 'https://souffleuse.app/', en: 'https://souffleuse.app/en/' },
  slug: 'souffleuse',
  ours: true,
};

export const AOTW_UTM = { utm_source: 'notacent', utm_medium: 'banner', utm_campaign: 'app-of-the-week' } as const;

export function withUtm(href: string): string {
  const u = new URL(href);
  for (const [k, v] of Object.entries(AOTW_UTM)) u.searchParams.set(k, v);
  return u.toString();
}
