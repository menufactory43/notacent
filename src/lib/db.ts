import { neon } from '@neondatabase/serverless';
import type { Store, Notarized } from './signing';
export const sql = neon(import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL ?? '');
export const hasDb = Boolean(import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL);

export interface DbApp {
  id: number; user_id: number; repo_id: number; full_name: string; slug: string; name: string;
  description: string | null; tagline: string | null; language: string | null; private: boolean; homepage: string | null;
  url: string | null; image_url: string | null; longest: string | null; tool: string | null;
  pricing: Pricing; status: 'polishing' | 'done' | 'paused';
  first_commit: string | null; last_commit: string | null; commits: number; active_days: number;
  active_days_30: number; best_streak_weeks: number; weekly: number[]; bravos: number; clicks: number;
  published: boolean; refreshed_at: string | null; created_at: string; login?: string; has_image?: boolean; sponsored?: boolean;
  stars: number; platform: string | null; takeover: boolean; unclaimed?: boolean; authors: number; active_dates: (string | Date)[] | null; owner_commits: number | null; comakers: string[];
  store_url: string | null; store: Store | null; notarized: Notarized | null;
  alternative_to: string[]; alt_slugs: string[]; badge_at: string | null;
  revenue_source: RevenueSource | null; revenue_declared_at: string | null; first_euro_at: string | Date | null; first_euro_days: number | null;
}
// Le modèle économique : une info, jamais un critère. unknown tant que le maker ne l'a pas dit.
export type Pricing = 'free' | 'donations' | 'one_time' | 'subscription' | 'freemium' | 'unknown';
export const PRICINGS: Pricing[] = ['free', 'donations', 'one_time', 'subscription', 'freemium', 'unknown'];
// D'où vient ce qu'on dit du revenu. Aujourd'hui seulement la parole du maker ; une preuve (Stripe, RevenueCat, App Store Connect) prendrait une autre valeur.
export type RevenueSource = 'declared';

// Les colonnes d'une fiche, une fois pour toutes : chaque requête les lit telles quelles.
const COLS = `a.id, a.user_id, a.repo_id, a.full_name, a.slug, a.name, a.description, a.tagline, a.language, a.private, a.homepage, a.url, a.image_url, a.longest, a.tool, a.pricing, a.status, a.first_commit, a.last_commit, a.commits, a.active_days, a.active_days_30, a.best_streak_weeks, a.weekly, a.bravos, a.clicks, a.published, a.refreshed_at, a.created_at, u.login, (a.image is not null) as has_image, coalesce(a.stars, 0) as stars, a.platform, coalesce(a.takeover, false) as takeover, (not coalesce(u.claimed, true)) as unclaimed, coalesce(a.authors, 1) as authors, a.active_dates, a.owner_commits, (select coalesce(array_agg(m.login order by m.added_at), '{}') from makers m where m.app_id = a.id and m.confirmed) as comakers, a.store_url, a.store, a.notarized, coalesce(a.alternative_to, '{}') as alternative_to, coalesce(a.alt_slugs, '{}') as alt_slugs, a.badge_at, a.revenue_source, a.revenue_declared_at, a.first_euro_at, a.first_euro_days`;
const FROM = `from apps a join users u on u.id = a.user_id`;
// L'éligibilité, une seule fois pour tout le site : une fiche publiée. Le modèle économique ne compte pas
// (gratuite, payante, abonnement : même règle). Classement, parcourir, alternatives, recherche MCP, alertes,
// chiffres, compteur, fil, sitemap et llms.txt partent tous d'ici.
export const ELIGIBLE = `a.published`;
// Pas un centime : aucun premier euro déclaré. Premier euro : le maker a déclaré le sien, l'app franchit un cap
// et reste listée. first_euro_at est null tant que rien n'est déclaré : « is null », jamais « <> ».
export const ZERO_EURO = `a.first_euro_at is null`;
export const FIRST_EURO = `a.first_euro_at is not null`;
// Encore en cours : les listes par outil, plateforme, langage montrent les deux classements.
const POLISHING = `${ELIGIBLE} and a.status = 'polishing'`;
// Le classement principal, « Pas un centime » : en cours, et pas encore de premier euro.
const ON_BOARD = `${POLISHING} and ${ZERO_EURO}`;
// Le classement « Premier euro » : même critère (le travail), en cours ou non.
const FIRST_BOARD = `${ELIGIBLE} and ${FIRST_EURO}`;

export async function rankedApps(period: 'all' | 'month' = 'all', limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  const order = period === 'all' ? 'active_days' : 'active_days_30';
  return (await sql.query(`select ${COLS} ${FROM} where ${ON_BOARD} order by ${order} desc, a.commits desc limit $1`, [limit])) as DbApp[];
}
export async function doneApps(limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  return (await sql.query(`select ${COLS} ${FROM} where ${ELIGIBLE} and a.status <> 'polishing' order by active_days desc limit $1`, [limit])) as DbApp[];
}
// Le classement « Premier euro » : les apps qui ont déclaré leur premier euro, classées par travail comme les autres.
export async function firstEuroApps(limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  return (await sql.query(`select ${COLS} ${FROM} where ${FIRST_BOARD} order by a.active_days desc, a.commits desc limit $1`, [limit])) as DbApp[];
}
// Toutes les fiches publiées : ce sont des pages publiques, le sitemap les liste.
export async function publishedFiches(limit = 5000): Promise<Pick<DbApp, 'slug' | 'last_commit' | 'created_at'>[]> {
  if (!hasDb) return [];
  return (await sql.query(`select a.slug, a.last_commit, a.created_at from apps a where ${ELIGIBLE} order by a.active_days desc limit $1`, [limit])) as Pick<DbApp, 'slug' | 'last_commit' | 'created_at'>[];
}
export async function appBySlug(slug: string): Promise<DbApp | null> {
  if (!hasDb) return null;
  const rows = (await sql.query(`select ${COLS} ${FROM} where a.slug = $1`, [slug])) as DbApp[];
  return rows[0] ?? null;
}
export async function totals(): Promise<{ apps: number; days: number; firstEuro: number }> {
  if (!hasDb) return { apps: 0, days: 0, firstEuro: 0 };
  const [r] = (await sql.query(`select count(*)::int as apps, coalesce(sum(a.active_days),0)::int as days, count(*) filter (where ${FIRST_EURO})::int as "firstEuro" from apps a where ${ELIGIBLE}`)) as { apps: number; days: number; firstEuro: number }[];
  return r;
}
export async function recentActivity(limit = 8) {
  if (!hasDb) return [];
  return (await sql.query(
    `select act.kind, act.payload, act.created_at, a.name, a.slug from activity act join apps a on a.id = act.app_id
     where ${ELIGIBLE} and act.kind not in ('alt', 'badge') order by act.created_at desc limit $1`, [limit],
  )) as { kind: string; payload: Record<string, unknown>; created_at: string; name: string; slug: string }[];
}

// L'emplacement sponsorisé est réservé aux apps « Premier euro » : une app à zéro ne paie pas pour être vue ici.
export async function activeSponsor(): Promise<DbApp | null> {
  if (!hasDb) return null;
  const rows = (await sql.query(
    `select ${COLS}, true as sponsored from sponsors s join apps a on a.id = s.app_id join users u on u.id = a.user_id
     where ${FIRST_BOARD} and s.starts_at <= now() and s.ends_at > now() order by s.ends_at asc limit 1`,
  )) as DbApp[];
  return rows[0] ?? null;
}
export async function sponsorUntil(appId: number): Promise<string | null> {
  if (!hasDb) return null;
  const [r] = (await sql.query(`select max(ends_at) as until from sponsors where app_id = $1 and ends_at > now()`, [appId])) as { until: string | null }[];
  return r?.until ?? null;
}

// Recherche plein texte simple pour le serveur MCP : nom, phrase, description, « ce qui a pris le plus de temps », langage, auteur.
export async function searchApps(query: string, opts: { tool?: string; platform?: string; pricing?: Pricing[]; includeDone?: boolean; limit?: number } = {}): Promise<DbApp[]> {
  if (!hasDb) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const words = query.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 1).slice(0, 8);
  const params: unknown[] = [limit];
  const clauses = words.map((w) => { params.push(`%${w}%`); const i = params.length; return `(a.name ilike $${i} or a.tagline ilike $${i} or a.description ilike $${i} or a.longest ilike $${i} or a.language ilike $${i} or u.login ilike $${i} or exists (select 1 from unnest(a.alternative_to) x where x ilike $${i}))`; });
  if (opts.tool) { params.push(opts.tool); clauses.push(`a.tool = $${params.length}`); }
  if (opts.platform) { params.push(opts.platform); clauses.push(`a.platform = $${params.length}`); }
  // Le modèle déclaré par le maker : une fiche non réclamée n'en a pas, elle ne sort donc pas sur « free ».
  if (opts.pricing?.length) { params.push(opts.pricing); clauses.push(`a.pricing = any($${params.length}) and coalesce(u.claimed, true)`); }
  if (!opts.includeDone) clauses.push(`a.status = 'polishing'`);
  const where = [ELIGIBLE, ...clauses].join(' and ');
  return (await sql.query(`select ${COLS} ${FROM} where ${where} order by a.active_days desc, a.commits desc limit $1`, params)) as DbApp[];
}

// Les fiches d'un maker, pour le fil des fiches à compléter.
export async function appsByUser(userId: number): Promise<Pick<DbApp, 'id' | 'slug' | 'name' | 'tagline' | 'longest' | 'tool' | 'published'>[]> {
  if (!hasDb) return [];
  return (await sql.query(`select id, slug, name, tagline, longest, tool, published from apps where user_id = $1 order by created_at`, [userId])) as Pick<DbApp, 'id' | 'slug' | 'name' | 'tagline' | 'longest' | 'tool' | 'published'>[];
}

// ---- Co-makers : ajoutés par le propriétaire, visibles une fois connectés.
export const GH_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export interface Maker { login: string; confirmed: boolean }
export async function makersOf(appId: number): Promise<Maker[]> {
  return (await sql.query(`select login, confirmed from makers where app_id = $1 order by added_at`, [appId])) as Maker[];
}
// Remplace la liste : ceux qui partent partent, ceux qui restent gardent leur état, les nouveaux attendent.
export async function setMakers(appId: number, logins: string[]) {
  const keep = logins.map((l) => l.toLowerCase());
  await sql.query(`delete from makers where app_id = $1 and not (lower(login) = any($2))`, [appId, keep]);
  for (const login of logins) await sql.query(`insert into makers (app_id, login) values ($1, $2) on conflict do nothing`, [appId, login]);
}
// À la connexion : les liens en attente à ce login deviennent visibles.
export async function confirmMaker(login: string): Promise<number> {
  const rows = (await sql.query(`update makers set confirmed = true, login = $1 where lower(login) = lower($1) and not confirmed returning app_id`, [login])) as unknown[];
  return rows.length;
}
// Peut modifier : le propriétaire, ou un co-maker confirmé.
export const canEdit = (app: DbApp, user: { id: number; login: string }) => app.user_id === user.id || app.comakers.some((l) => l.toLowerCase() === user.login.toLowerCase());

// ---- Parcourir : chaque filtre est une page.

export type BrowseKind = 'tool' | 'platform' | 'language' | 'intent' | 'alt';
export type Intent = 'radar' | 'takeover' | 'veteran' | 'new' | 'done' | 'signed' | 'premier-euro';
export const INTENTS: Intent[] = ['radar', 'takeover', 'veteran', 'new', 'done', 'signed', 'premier-euro'];
// « Signées » : la fiche a un lien App Store vérifié chez Apple, ou une notarisation lue dans son workflow de publication.
export const SIGNED_SQL = `(a.store is not null or a.notarized->>'level' = 'notarized')`;
// Pour « alt », value est le segment d'URL (notion) et label le nom tel qu'on l'écrit (Notion), lu en base.
// free : pour une page « alternative à », au moins une app de la page est gratuite, d'après son maker (le titre peut alors dire « gratuites »).
export interface Browse { kind: BrowseKind; value: string; label?: string; free?: boolean }
// Une alternative reste une alternative une fois terminée, et une app payante aussi en est une : l'éligibilité suffit.
const ALT_BOARD = ELIGIBLE;

// La clause et l'ordre d'un filtre. « radar » = beaucoup de jours pour peu d'étoiles, avec un plancher pour qu'un repo invisible ne prenne pas la tête.
function browseWhere(b: Browse, params: unknown[]): { where: string; order: string } {
  const order = `a.active_days desc, a.commits desc`;
  if (b.kind === 'intent') {
    switch (b.value as Intent) {
      case 'radar': return { where: `${POLISHING} and a.active_days >= 30`, order: `(a.active_days::float / (coalesce(a.stars,0) + 5)) desc, a.active_days desc` };
      case 'takeover': return { where: `${ELIGIBLE} and coalesce(a.takeover,false)`, order };
      case 'veteran': return { where: `${POLISHING} and a.first_commit < now() - interval '365 days'`, order };
      case 'new': return { where: `${POLISHING} and a.created_at > now() - interval '14 days'`, order: `a.created_at desc` };
      case 'done': return { where: `${ELIGIBLE} and a.status <> 'polishing'`, order };
      case 'signed': return { where: `${POLISHING} and ${SIGNED_SQL}`, order };
      case 'premier-euro': return { where: FIRST_BOARD, order };
      default: return { where: 'false', order };
    }
  }
  params.push(b.value);
  if (b.kind === 'alt') return { where: `${ALT_BOARD} and $${params.length} = any(a.alt_slugs)`, order };
  const col = b.kind === 'tool' ? 'a.tool' : b.kind === 'platform' ? 'a.platform' : 'a.language';
  return { where: `${POLISHING} and lower(${col}) = lower($${params.length})`, order };
}
export async function browseApps(b: Browse, limit = 100): Promise<DbApp[]> {
  if (!hasDb) return [];
  const params: unknown[] = [];
  const { where, order } = browseWhere(b, params);
  params.push(limit);
  return (await sql.query(`select ${COLS} ${FROM} where ${where} order by ${order} limit $${params.length}`, params)) as DbApp[];
}
// Les valeurs qui existent, avec leur nombre : ce sont les liens de la section « Parcourir ».
export async function browseCounts(): Promise<{ tool: Record<string, number>; platform: Record<string, number>; language: Record<string, number>; intent: Record<string, number> }> {
  const out = { tool: {} as Record<string, number>, platform: {} as Record<string, number>, language: {} as Record<string, number>, intent: {} as Record<string, number> };
  if (!hasDb) return out;
  const rows = (await sql.query(
    `select 'tool' as kind, tool as value, count(*)::int as n from apps a where ${POLISHING} and tool is not null group by tool
     union all select 'platform', platform, count(*)::int from apps a where ${POLISHING} and platform is not null group by platform
     union all select 'language', language, count(*)::int from apps a where ${POLISHING} and language is not null group by language`,
  )) as { kind: 'tool' | 'platform' | 'language'; value: string; n: number }[];
  for (const r of rows) out[r.kind][r.value] = r.n;
  const [i] = (await sql.query(
    `select (select count(*)::int from apps a where ${POLISHING} and a.active_days >= 30) as radar,
            (select count(*)::int from apps a where ${ELIGIBLE} and coalesce(a.takeover,false)) as takeover,
            (select count(*)::int from apps a where ${POLISHING} and a.first_commit < now() - interval '365 days') as veteran,
            (select count(*)::int from apps a where ${POLISHING} and a.created_at > now() - interval '14 days') as new,
            (select count(*)::int from apps a where ${ELIGIBLE} and a.status <> 'polishing') as done,
            (select count(*)::int from apps a where ${POLISHING} and ${SIGNED_SQL}) as signed,
            (select count(*)::int from apps a where ${FIRST_BOARD}) as "premier-euro"`,
  )) as Record<Intent, number>[];
  out.intent = i;
  return out;
}
// Les « alternative à » qui existent : le segment, le nom le plus écrit, le nombre d'apps.
// Une app gratuite, d'après son maker : gratuite ou à dons, sur une fiche réclamée. C'est la seule qui donne le droit d'écrire « gratuites ».
export const DECLARED_FREE = `(a.pricing in ('free', 'donations') and coalesce(u.claimed, true))`;
export interface AltCount { slug: string; name: string; n: number; free: boolean }
export async function altCounts(): Promise<AltCount[]> {
  if (!hasDb) return [];
  return (await sql.query(
    `select s as slug, mode() within group (order by a.alternative_to[array_position(a.alt_slugs, s)]) as name, count(*)::int as n, bool_or(${DECLARED_FREE}) as free
     from apps a join users u on u.id = a.user_id, unnest(a.alt_slugs) s where ${ALT_BOARD} group by s order by n desc, s`,
  )) as AltCount[];
}
// Le nom affiché d'un segment, et s'il y a une app gratuite dans la page ; null si aucune app ne s'en réclame : la page n'existe alors pas.
export async function altName(slug: string): Promise<{ name: string; free: boolean } | null> {
  if (!hasDb) return null;
  const [r] = (await sql.query(
    `select mode() within group (order by a.alternative_to[array_position(a.alt_slugs, $1)]) as name, coalesce(bool_or(${DECLARED_FREE}), false) as free
     from apps a join users u on u.id = a.user_id where ${ALT_BOARD} and $1 = any(a.alt_slugs)`, [slug],
  )) as { name: string | null; free: boolean }[];
  return r?.name ? { name: r.name, free: r.free } : null;
}
// Le rang d'une app dans un classement donné (« 1re des apps faites avec Claude Code »). « all » : son classement à elle,
// « Pas un centime » ou « Premier euro ». Outil et plateforme : les pages qui montrent les deux.
export async function rankIn(app: DbApp, kind: 'tool' | 'platform' | 'all'): Promise<number | null> {
  if (!hasDb || !app.published) return null;
  const first = app.first_euro_at != null;
  if (app.status !== 'polishing' && !(kind === 'all' && first)) return null;
  const params: unknown[] = [app.active_days, app.commits];
  let extra = '';
  if (kind !== 'all') { const v = kind === 'tool' ? app.tool : app.platform; if (!v) return null; params.push(v); extra = ` and lower(${kind === 'tool' ? 'a.tool' : 'a.platform'}) = lower($3)`; }
  const board = kind !== 'all' ? POLISHING : first ? FIRST_BOARD : ON_BOARD;
  const [r] = (await sql.query(`select count(*)::int + 1 as rank from apps a where ${board}${extra} and (a.active_days > $1 or (a.active_days = $1 and a.commits > $2))`, params)) as { rank: number }[];
  return r?.rank ?? null;
}
// Trois apps proches : même outil ou même plateforme, les plus travaillées d'abord.
export async function relatedApps(app: DbApp, limit = 3): Promise<DbApp[]> {
  if (!hasDb) return [];
  return (await sql.query(
    `select ${COLS} ${FROM} where ${POLISHING} and a.id <> $1 and (lower(a.tool) = lower($2) or lower(a.platform) = lower($3) or lower(a.language) = lower($4))
     order by coalesce((lower(a.tool) = lower($2))::int, 0) + coalesce((lower(a.platform) = lower($3))::int, 0) desc, a.active_days desc limit $5`,
    [app.id, app.tool ?? '', app.platform ?? '', app.language ?? '', limit],
  )) as DbApp[];
}

// ---- Les pépites de la semaine : trois tampons décernés par le repo, jamais par nous.
export interface Gems { week: DbApp | null; streak: DbApp | null; radar: DbApp | null }
export async function weeklyGems(): Promise<Gems> {
  if (!hasDb) return { week: null, streak: null, radar: null };
  // weekly[26] = jours actifs de la semaine en cours ; la semaine d'avant est la dernière complète.
  // Une app ne porte qu'un tampon : on lit trois candidats par tampon et on écarte ceux déjà pris.
  const q = async (order: string, extra = '') => (await sql.query(`select ${COLS} ${FROM} where ${ON_BOARD}${extra} order by ${order} limit 3`)) as DbApp[];
  const [w, s, r] = await Promise.all([
    q(`coalesce(a.weekly[25], 0) + coalesce(a.weekly[26], 0) desc, a.active_days desc`, ` and coalesce(a.weekly[25], 0) + coalesce(a.weekly[26], 0) > 0`),
    q(`a.best_streak_weeks desc, a.active_days desc`, ` and a.best_streak_weeks >= 2`),
    q(`(a.active_days::float / (coalesce(a.stars,0) + 5)) desc, a.active_days desc`, ` and a.active_days >= 30`),
  ]);
  const taken = new Set<number>();
  const pick = (rows: DbApp[]) => { const x = rows.find((a) => !taken.has(a.id)) ?? null; if (x) taken.add(x.id); return x; };
  return { week: pick(w), streak: pick(s), radar: pick(r) };
}

// ---- Alertes gratuites : un filtre, un mail hebdo.
export interface Alert { id: number; email: string; locale: string; filter: Browse | Record<string, never>; token: string; last_sent: string | null }
export async function addAlert(email: string, locale: string, filter: Browse | Record<string, never>, token: string): Promise<'added' | 'exists'> {
  if (!hasDb) return 'exists';
  const rows = (await sql.query(
    `insert into alerts (email, locale, filter, token) values ($1, $2, $3, $4) on conflict (email, filter) do nothing returning id`,
    [email.toLowerCase(), locale, JSON.stringify(filter), token],
  )) as { id: number }[];
  return rows.length ? 'added' : 'exists';
}
export async function removeAlert(token: string) {
  if (!hasDb) return;
  await sql.query(`delete from alerts where token = $1`, [token]);
}
export async function dueAlerts(): Promise<Alert[]> {
  if (!hasDb) return [];
  return (await sql.query(`select id, email, locale, filter, token, last_sent from alerts where confirmed and (last_sent is null or last_sent < now() - interval '6 days')`)) as Alert[];
}
export async function markAlertSent(id: number) {
  if (!hasDb) return;
  await sql.query(`update alerts set last_sent = now() where id = $1`, [id]);
}
// Ce qui est nouveau pour une alerte depuis son dernier envoi : arrivées, tampons, passages « à reprendre ».
export async function alertMatches(a: Alert): Promise<DbApp[]> {
  if (!hasDb) return [];
  const since = a.last_sent ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
  const f = a.filter as Partial<Browse>;
  const params: unknown[] = [since];
  let where = `${ELIGIBLE} and a.created_at > $1`;
  if (f.kind && f.value) {
    if (f.kind === 'intent') {
      if (f.value === 'takeover') where = `${ELIGIBLE} and coalesce(a.takeover,false) and exists (select 1 from activity x where x.app_id = a.id and x.kind = 'takeover' and x.created_at > $1)`;
      else if (f.value === 'done') where = `${ELIGIBLE} and a.status <> 'polishing' and exists (select 1 from activity x where x.app_id = a.id and x.kind = 'status' and x.created_at > $1)`;
      else if (f.value === 'radar') where = `${POLISHING} and a.active_days >= 30 and coalesce(a.stars,0) < 20 and (a.created_at > $1 or exists (select 1 from activity x where x.app_id = a.id and x.kind = 'day' and x.created_at > $1 and (x.payload->>'n')::int in (30, 50, 100, 200, 365)))`;
      else if (f.value === 'veteran') where = `${POLISHING} and a.first_commit < now() - interval '365 days' and a.created_at > $1`;
    } else if (f.kind === 'alt') {
      params.push(f.value);
      where = `${ELIGIBLE} and $2 = any(a.alt_slugs) and (a.created_at > $1 or exists (select 1 from activity x where x.app_id = a.id and x.kind = 'alt' and x.created_at > $1))`;
    } else {
      params.push(f.value);
      const col = f.kind === 'tool' ? 'a.tool' : f.kind === 'platform' ? 'a.platform' : 'a.language';
      where += ` and lower(${col}) = lower($2)`;
    }
  }
  return (await sql.query(`select ${COLS} ${FROM} where ${where} order by a.active_days desc limit 20`, params)) as DbApp[];
}
