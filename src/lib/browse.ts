import type { Browse, BrowseKind, Intent } from './db';
import { INTENTS, altName } from './db';
import { PLATFORMS, platformFromSlug, platformSlug } from './platform';
import type { Locale } from '../i18n/strings';

export const TOOLS = ['Claude Code', 'Cursor', 'Lovable', 'Bolt', 'Copilot', 'Codex', 'Autre'] as const;

// Les segments d'URL des pages « Parcourir », dans les deux langues : /outil/claude-code, /en/outil/claude-code.
export const KIND_PATH: Record<BrowseKind, string> = { tool: 'outil', platform: 'plateforme', language: 'langage', intent: 'intention', alt: 'alternative-a' };
export const kindFromPath = (p: string): BrowseKind | null => (Object.entries(KIND_PATH).find(([, v]) => v === p)?.[0] as BrowseKind | undefined) ?? null;

export const slugOf = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#]+/g, '-').replace(/^-|-$/g, '');
export const toolFromSlug = (s: string) => TOOLS.find((t) => slugOf(t) === s) ?? null;

// Retrouve la valeur canonique à partir du segment d'URL. Un langage inconnu passe tel quel : la page dit alors « personne ».
export function browseFromParams(kindPath: string, valueSlug: string): Browse | null {
  const kind = kindFromPath(kindPath);
  if (!kind) return null;
  if (kind === 'tool') { const t = toolFromSlug(valueSlug); return t ? { kind, value: t } : null; }
  if (kind === 'platform') { const p = platformFromSlug(valueSlug); return p ? { kind, value: p } : null; }
  if (kind === 'intent') return (INTENTS as string[]).includes(valueSlug) ? { kind, value: valueSlug } : null;
  // « alternative à » : le segment passe tel quel, s'il a la forme d'un segment. Le nom affiché se lit en base (withAltName).
  if (kind === 'alt') return valueSlug && valueSlug.length <= 60 && slugOf(valueSlug) === valueSlug ? { kind, value: valueSlug } : null;
  return { kind, value: languageFromSlug(valueSlug) };
}
const LANG_NAMES = ['Swift', 'TypeScript', 'JavaScript', 'Rust', 'Python', 'Go', 'Kotlin', 'Dart', 'Ruby', 'PHP', 'C#', 'C++', 'C', 'Elixir', 'Astro', 'Svelte', 'Vue', 'HTML', 'CSS', 'Shell', 'Zig', 'Objective-C', 'Java', 'Lua', 'Haskell', 'Scala', 'Clojure', 'Nim', 'OCaml', 'Crystal'];
export const languageFromSlug = (s: string) => LANG_NAMES.find((l) => slugOf(l) === s) ?? s.replace(/-/g, ' ');

export function browsePath(b: Browse, locale: Locale) {
  const v = b.kind === 'alt' ? b.value : b.kind === 'tool' ? slugOf(b.value) : b.kind === 'platform' ? platformSlug(b.value) : b.kind === 'language' ? slugOf(b.value) : b.value;
  return `${locale === 'fr' ? '' : '/en'}/${KIND_PATH[b.kind]}/${v}`;
}

// Le titre d'une page « Parcourir », qui sert aussi de <title>, de H1 et de sujet d'alerte.
export function browseLabel(b: Browse | Record<string, never>, locale: Locale): string {
  const fr = locale === 'fr';
  if (!('kind' in b) || !b.kind) return fr ? 'Toutes les apps' : 'All apps';
  switch (b.kind) {
    case 'tool': return fr ? `Apps faites avec ${b.value}` : `Apps built with ${b.value}`;
    case 'platform': {
      const p = b.value;
      if (fr) return p === 'Mac' ? 'Apps Mac indépendantes' : p === 'CLI' ? 'Outils en ligne de commande' : p === 'MCP' ? 'Serveurs MCP' : p === 'Web' ? 'Apps web' : p === 'Autre' ? 'Autres plateformes' : `Apps ${p}`;
      return p === 'Mac' ? 'Indie Mac apps' : p === 'CLI' ? 'Command-line tools' : p === 'MCP' ? 'MCP servers' : p === 'Web' ? 'Web apps' : p === 'Autre' ? 'Other platforms' : `${p} apps`;
    }
    case 'language': return fr ? `Apps écrites en ${b.value}` : `Apps written in ${b.value}`;
    // « gratuites » seulement si la page a au moins une app gratuite déclarée par son maker ; sinon, « Alternatives à X ».
    case 'alt': return fr ? `Alternatives ${(b as Browse).free ? 'gratuites ' : ''}à ${altLabel(b as Browse)}` : `${(b as Browse).free ? 'Free alternatives' : 'Alternatives'} to ${altLabel(b as Browse)}`;
    case 'intent': {
      const i = b.value as Intent;
      const m: Record<Intent, [string, string]> = {
        radar: ['Encore sous les radars', 'Still under the radar'],
        takeover: ['Ouvertes à une reprise', 'Open to a takeover'],
        veteran: ['Toujours vivantes après 1 an', 'Still alive after a year'],
        new: ['Nouvelles cette semaine', 'New this week'],
        done: ['Terminées, mais finies', 'Done, and finished'],
        signed: ['Signées : App Store ou notarisées', 'Signed: App Store or notarized'],
        'premier-euro': ['Premier euro', 'First euro'],
      };
      return fr ? m[i][0] : m[i][1];
    }
  }
}
// Le nom d'une « alternative à » : celui lu en base, sinon le segment remis en mots (google-analytics → Google Analytics).
const altLabel = (b: Browse) => b.label ?? b.value.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
// Une phrase sous le titre, pour le moteur et pour le lecteur.
export function browseLede(b: Browse, locale: Locale): string {
  const fr = locale === 'fr';
  switch (b.kind) {
    case 'tool': return fr ? `Des apps gratuites dont ${b.value} est l'outil principal, classées par jours de travail lus dans le repo GitHub. Pas de revenu, pas de vote : des commits.` : `Free apps built mainly with ${b.value}, ranked by days of work read from the GitHub repo. No revenue, no votes: commits.`;
    case 'platform': return fr ? `Des apps gratuites pour ${b.value}, faites par une personne, classées par jours actifs vérifiés sur GitHub.` : `Free ${b.value} apps made by one person, ranked by active days verified on GitHub.`;
    case 'language': return fr ? `Des apps gratuites écrites en ${b.value}, classées par jours actifs lus dans le repo.` : `Free apps written in ${b.value}, ranked by active days read from the repo.`;
    case 'alt': return b.free
      ? (fr ? `Des apps gratuites listées comme alternative à ${altLabel(b)}, classées par jours de travail lus dans le repo GitHub : on voit lesquelles sont encore entretenues. Les payantes qui n'ont pas encore gagné d'argent, s'il y en a, suivent à part.` : `Free apps listed as an alternative to ${altLabel(b)}, ranked by days of work read from the GitHub repo, so you can see which ones are still maintained. Paid ones that haven't made money yet, if any, come after, separately.`)
      : (fr ? `Des apps indépendantes listées comme alternative à ${altLabel(b)}, qui n'ont pas encore gagné d'argent. Classées par jours de travail lus dans le repo GitHub : on voit lesquelles sont encore entretenues.` : `Indie apps listed as an alternative to ${altLabel(b)} that haven't made money yet. Ranked by days of work read from the GitHub repo, so you can see which ones are still maintained.`);
    case 'intent': {
      const m: Record<Intent, [string, string]> = {
        radar: ['Beaucoup de jours de travail, peu d\'étoiles : les apps que personne n\'a encore vues. Classées par jours actifs rapportés aux étoiles GitHub.', 'Many days of work, few stars: the apps nobody has noticed yet. Ranked by active days relative to GitHub stars.'],
        takeover: ['Leur maker est prêt à passer le relais. On met en relation, on ne prend ni commission ni escrow.', 'Their maker is ready to hand over. We put you in touch, we take no fee and run no escrow.'],
        veteran: ['Premier commit il y a plus d\'un an, et toujours en cours. La durée, c\'est la preuve.', 'First commit more than a year ago, still going. Duration is the proof.'],
        new: ['Arrivées dans les quatorze derniers jours, avec leur historique de commits déjà lu.', 'Listed in the last fourteen days, commit history already read.'],
        done: ['Le maker a dit « terminée » ou « en pause ». Elles marchent, elles ne bougent plus.', 'The maker said "done" or "paused". They work, they no longer move.'],
        signed: ['Ce qu\'on regarde avant de télécharger un binaire : une fiche App Store vérifiée chez Apple, ou une notarisation lue dans le workflow de publication du repo.', 'What you check before downloading a binary: an App Store page verified with Apple, or a notarization step read in the repo\'s release workflow.'],
        'premier-euro': ['Elles ont gagné leur premier euro, d\'après leur maker. Elles restent listées et se classent pareil : par jours de travail lus dans le repo.', 'They made their first euro, according to their maker. They stay listed and rank the same way: by days of work read from the repo.'],
      };
      return fr ? m[b.value as Intent][0] : m[b.value as Intent][1];
    }
  }
}
// Une page « alternative à » n'existe que si une app s'en réclame : on lit son nom en base, null veut dire 404.
// Les autres filtres passent tels quels.
export async function withAltName(b: Browse): Promise<Browse | null> {
  if (b.kind !== 'alt') return b;
  const found = await altName(b.value).catch(() => null);
  return found ? { ...b, label: found.name, free: found.free } : null;
}
export { PLATFORMS };
