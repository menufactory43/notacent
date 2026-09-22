import { sql, hasDb, ELIGIBLE, FIRST_EURO } from './db';

// Les chiffres de l'annuaire entier : ce qu'on peut citer. Des médianes, pas des moyennes (une app à 900 jours tire tout vers le haut),
// et la taille de l'échantillon à côté de chaque chiffre. Population : toutes les fiches listées, en cours ou terminées,
// quel que soit leur modèle économique (la même règle que le classement, depuis le 22 septembre 2026).
const POP = ELIGIBLE;
// Un groupe à une ou deux apps n'est pas une statistique, c'est une fiche : on ne le montre pas.
export const MIN_GROUP = 3;
// Pas de médiane « avant le premier euro » sous cinq apps : on dit « pas encore assez d'apps », avec l'effectif.
export const MIN_FIRST_EURO = 5;
// Le jour où la population est passée des apps gratuites à toutes les apps pas encore rentables.
export const POPULATION_SINCE = '2026-09-22';

export interface Group { value: string; n: number; medianDays: number; medianMonths: number }
export interface Figures {
  readOn: string; apps: number; polishing: number; totalDays: number; totalCommits: number;
  days: { q1: number; median: number; q3: number; max: number };
  medianMonths: number; medianStreakWeeks: number; medianStars: number; medianCommitsPerDay: number;
  under20Stars: number; solo: number; veterans: number; over100Days: number; claimed: number; signed: number; macApps: number;
  byPlatform: Group[]; byLanguage: Group[]; byTool: Group[];
  // Jours actifs par jour de la semaine (1 = lundi), repos publics, 365 derniers jours, en UTC.
  weekdays: { dow: number; n: number }[]; weekendShare: number | null; weekdayApps: number;
  // Jours actifs comptés jusqu'au premier euro déclaré : l'effectif, et la médiane seulement à partir de MIN_FIRST_EURO apps.
  firstEuro: { n: number; medianDays: number | null; q1: number | null; q3: number | null };
  populationSince: string;
}

const MONTHS = `extract(epoch from (coalesce(a.last_commit, a.created_at) - coalesce(a.first_commit, a.created_at))) / 2629800`;

export async function figures(): Promise<Figures | null> {
  if (!hasDb) return null;
  const [o] = (await sql.query(
    `select count(*)::int as apps, count(*) filter (where a.status = 'polishing')::int as polishing,
       coalesce(sum(a.active_days), 0)::int as total_days, coalesce(sum(a.commits), 0)::int as total_commits,
       percentile_cont(0.25) within group (order by a.active_days) as q1, percentile_cont(0.5) within group (order by a.active_days) as median,
       percentile_cont(0.75) within group (order by a.active_days) as q3, coalesce(max(a.active_days), 0)::int as max,
       percentile_cont(0.5) within group (order by ${MONTHS}) as months, percentile_cont(0.5) within group (order by a.best_streak_weeks) as streak,
       percentile_cont(0.5) within group (order by coalesce(a.stars, 0)) as stars,
       percentile_cont(0.5) within group (order by a.commits::float / nullif(a.active_days, 0)) as cpd,
       count(*) filter (where coalesce(a.stars, 0) < 20)::int as under20, count(*) filter (where coalesce(a.authors, 1) = 1)::int as solo,
       count(*) filter (where a.first_commit < now() - interval '365 days' and a.status = 'polishing')::int as veterans,
       count(*) filter (where a.active_days >= 100)::int as over100, count(*) filter (where coalesce(u.claimed, true))::int as claimed,
       count(*) filter (where a.platform = 'Mac')::int as mac,
       count(*) filter (where a.platform = 'Mac' and (a.store is not null or a.notarized->>'level' = 'notarized'))::int as signed
     from apps a join users u on u.id = a.user_id where ${POP}`,
  )) as Record<string, number>[];
  const group = async (col: string) => ((await sql.query(
    `select ${col} as value, count(*)::int as n, percentile_cont(0.5) within group (order by a.active_days) as days, percentile_cont(0.5) within group (order by ${MONTHS}) as months
     from apps a where ${POP} and ${col} is not null and ${col} <> 'Autre' group by ${col} having count(*) >= ${MIN_GROUP} order by n desc, value`,
  )) as { value: string; n: number; days: number; months: number }[]).map((g) => ({ value: g.value, n: g.n, medianDays: Math.round(g.days), medianMonths: Math.round(g.months) }));
  const [byPlatform, byLanguage, byTool] = await Promise.all([group('a.platform'), group('a.language'), group('a.tool')]);
  // Les jours d'un repo privé vieux de plus d'un an sont notés au dimanche de leur semaine (voir /methode) : ils fausseraient la part du week-end.
  // On ne compte donc que les repos publics, sur les 365 derniers jours.
  const wd = (await sql.query(
    `select extract(isodow from d)::int as dow, count(*)::int as n from apps a, unnest(a.active_dates) d
     where ${POP} and not a.private and d > current_date - 365 group by 1 order by 1`,
  )) as { dow: number; n: number }[];
  const [{ apps: weekdayApps } = { apps: 0 }] = (await sql.query(
    `select count(distinct a.id)::int as apps from apps a, unnest(a.active_dates) d where ${POP} and not a.private and d > current_date - 365`,
  )) as { apps: number }[];
  const [fe] = (await sql.query(
    `select count(*)::int as n, percentile_cont(0.5) within group (order by a.first_euro_days) as median,
       percentile_cont(0.25) within group (order by a.first_euro_days) as q1, percentile_cont(0.75) within group (order by a.first_euro_days) as q3
     from apps a where ${POP} and ${FIRST_EURO} and a.first_euro_days is not null`,
  )) as { n: number; median: number | null; q1: number | null; q3: number | null }[];
  const enough = fe.n >= MIN_FIRST_EURO;
  const firstEuro = { n: fe.n, medianDays: enough ? Math.round(Number(fe.median)) : null, q1: enough ? Math.round(Number(fe.q1)) : null, q3: enough ? Math.round(Number(fe.q3)) : null };
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, n: wd.find((r) => r.dow === dow)?.n ?? 0 }));
  const all = weekdays.reduce((s, r) => s + r.n, 0);
  const r = (v: number | null | undefined) => Math.round(Number(v ?? 0));
  return {
    readOn: new Date().toISOString().slice(0, 10), apps: o.apps, polishing: o.polishing, totalDays: o.total_days, totalCommits: o.total_commits,
    days: { q1: r(o.q1), median: r(o.median), q3: r(o.q3), max: o.max },
    medianMonths: r(o.months), medianStreakWeeks: r(o.streak), medianStars: r(o.stars), medianCommitsPerDay: Math.round(Number(o.cpd ?? 0) * 10) / 10,
    under20Stars: o.under20, solo: o.solo, veterans: o.veterans, over100Days: o.over100, claimed: o.claimed, signed: o.signed, macApps: o.mac,
    byPlatform, byLanguage, byTool,
    weekdays, weekendShare: all ? (weekdays[5].n + weekdays[6].n) / all : null, weekdayApps,
    firstEuro, populationSince: POPULATION_SINCE,
  };
}
