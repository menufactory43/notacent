import { sql, hasDb, rankIn, type DbApp } from './db';
import { SITE } from './seo';
import type { Metrics } from './metrics';
import { pingIndexNow, appPaths } from './indexnow';

// Les coulisses : qui peut y entrer. Le login GitHub de l'admin, rien d'autre.
const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
export const adminLogin = () => env('ADMIN_LOGIN');
export const isAdmin = (login: string | undefined | null) => Boolean(login && adminLogin() && login === adminLogin());

export type OutreachStatus = 'found' | 'listed' | 'sent' | 'claimed' | 'no' | 'ignored';
export interface Candidate {
  id: number; repo_id: number; full_name: string; name: string; description: string | null; language: string | null; homepage: string | null;
  topics: string[]; stars: number; contributors: number; has_release: boolean; repo_created: string | null; pushed_at: string | null;
  owner_id: number; owner_login: string; owner_name: string | null; owner_avatar: string | null; owner_email: string | null; commit_email: string | null;
  owner_blog: string | null; owner_twitter: string | null; owner_location: string | null;
  metrics: Metrics & { platform?: string }; score: number; query: string | null; status: OutreachStatus; app_id: number | null; note: string | null;
  listed_at: string | null; sent_at: string | null; answered_at: string | null; found_at: string;
  slug?: string | null; active_days?: number | null; best_streak_weeks?: number | null; first_commit?: string | null; app_platform?: string | null;
}

// Les candidats d'un état, avec la fiche quand elle existe (rang, jours à jour depuis le cron).
export async function candidates(status: OutreachStatus | OutreachStatus[], limit = 200): Promise<Candidate[]> {
  if (!hasDb) return [];
  const list = Array.isArray(status) ? status : [status];
  return (await sql.query(
    `select o.*, a.slug, a.active_days, a.best_streak_weeks, a.first_commit, a.platform as app_platform
     from outreach o left join apps a on a.id = o.app_id where o.status = any($1) order by o.score desc, o.found_at desc limit $2`, [list, limit],
  )) as Candidate[];
}
export async function candidate(id: number): Promise<Candidate | null> {
  const rows = (await sql.query(`select o.*, a.slug, a.active_days, a.best_streak_weeks, a.first_commit, a.platform as app_platform from outreach o left join apps a on a.id = o.app_id where o.id = $1`, [id])) as Candidate[];
  return rows[0] ?? null;
}
export async function counts(): Promise<Record<OutreachStatus, number>> {
  const base: Record<OutreachStatus, number> = { found: 0, listed: 0, sent: 0, claimed: 0, no: 0, ignored: 0 };
  if (!hasDb) return base;
  for (const r of (await sql.query(`select status, count(*)::int as n from outreach group by status`)) as { status: OutreachStatus; n: number }[]) base[r.status] = r.n;
  return base;
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';

// Lister : un compte « non réclamé » au nom du maker (son github_id, aucun jeton), puis la fiche, avec les chiffres lus par le script.
// Quand il se connectera, le upsert du callback retrouvera ce compte et la fiche sera à lui.
export async function listCandidate(id: number): Promise<{ ok: true; slug: string } | { ok: false; why: string }> {
  const c = await candidate(id);
  if (!c) return { ok: false, why: 'candidat inconnu' };
  if (c.status !== 'found') return { ok: false, why: `déjà ${c.status}` };
  const [existing] = (await sql.query(`select id, claimed, blocked from users where github_id = $1`, [c.owner_id])) as { id: number; claimed: boolean; blocked: boolean }[];
  if (existing?.blocked) return { ok: false, why: 'ce maker a dit non' };
  if (existing?.claimed) return { ok: false, why: 'ce maker a déjà un compte : il liste lui-même' };
  const [u] = (await sql.query(
    `insert into users (github_id, login, name, avatar_url, claimed) values ($1,$2,$3,$4,false)
     on conflict (github_id) do update set login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url returning id`,
    [c.owner_id, c.owner_login, c.owner_name, c.owner_avatar],
  )) as { id: number }[];
  let slug = slugify(c.name);
  const taken = (await sql.query(`select 1 from apps where slug = $1 and repo_id <> $2`, [slug, c.repo_id])) as unknown[];
  if (taken.length) slug = `${slug}-${slugify(c.owner_login)}`;
  const m = c.metrics;
  const [row] = (await sql.query(
    `insert into apps (user_id, repo_id, full_name, slug, name, description, language, private, homepage, url,
       first_commit, last_commit, commits, active_days, active_days_30, best_streak_weeks, weekly, published, refreshed_at, stars, platform, authors)
     values ($1,$2,$3,$4,$5,$6,$7,false,$8,$8,$9,$10,$11,$12,$13,$14,$15,true,now(),$16,$17,$18)
     on conflict (repo_id) do update set published = true returning id, slug`,
    [u.id, c.repo_id, c.full_name, slug, c.name, c.description, c.language, c.homepage, m.first_commit, m.last_commit, m.commits, m.active_days, m.active_days_30, m.best_streak_weeks, m.weekly ?? [], c.stars, m.platform ?? 'Autre', Math.max(1, c.contributors || 1)],
  )) as { id: number; slug: string }[];
  await sql.query(`insert into activity (app_id, kind) values ($1, 'arrived')`, [row.id]);
  await sql.query(`update outreach set status = 'listed', app_id = $2, listed_at = now() where id = $1`, [id, row.id]);
  await pingIndexNow(['/', '/en', ...appPaths(row.slug)]);
  return { ok: true, slug: row.slug };
}

export async function setStatus(id: number, status: OutreachStatus, note?: string | null) {
  const stamp = status === 'sent' ? 'sent_at = now(),' : status === 'no' || status === 'claimed' ? 'answered_at = now(),' : '';
  await sql.query(`update outreach set ${stamp} status = $2, note = coalesce($3, note) where id = $1`, [id, status, note ?? null]);
}

// « Non » : la fiche part, le compte fantôme est bloqué (jamais relisté), les emails sont effacés.
export async function refuse(id: number) {
  const c = await candidate(id);
  if (!c) return;
  if (c.app_id) await sql.query(`delete from apps where id = $1 and user_id in (select id from users where github_id = $2 and not claimed)`, [c.app_id, c.owner_id]);
  await sql.query(`update users set blocked = true where github_id = $1 and not claimed`, [c.owner_id]);
  await sql.query(`update outreach set status = 'no', answered_at = now(), owner_email = null, commit_email = null where id = $1`, [id]);
}

// Réclamée : appelé par le callback quand un compte non réclamé se connecte. Retourne les slugs devenus siens.
export async function claim(userId: number, githubId: number): Promise<string[]> {
  const apps = (await sql.query(`select id, slug from apps where user_id = $1`, [userId])) as { id: number; slug: string }[];
  for (const a of apps) await sql.query(`insert into activity (app_id, kind) values ($1, 'claimed')`, [a.id]);
  await sql.query(`update outreach set status = 'claimed', answered_at = now(), owner_email = null, commit_email = null where owner_id = $1 and status in ('listed', 'sent')`, [githubId]);
  return apps.map((a) => a.slug);
}

// Le mail : un seul, en texte brut, avec les vrais chiffres. Français si le maker a l'air francophone, anglais sinon.
const frenchish = (c: Candidate) => /france|paris|lyon|marseille|bordeaux|nantes|toulouse|lille|qu[ée]bec|montr[ée]al|belgi|bruxelles|brussels|suisse|gen[èe]ve|lausanne/i.test(c.owner_location ?? '') || /[éèêàçù]/.test(c.description ?? '');
export type MailLocale = 'fr' | 'en';
export function guessLocale(c: Candidate): MailLocale { return frenchish(c) ? 'fr' : 'en'; }

export interface Mail { to: string | null; subject: string; body: string; locale: MailLocale }
export async function composeMail(c: Candidate, locale: MailLocale = guessLocale(c), row?: DbApp | null): Promise<Mail> {
  const first = (c.owner_name ?? '').trim().split(/\s+/)[0] || c.owner_login;
  const days = c.active_days ?? c.metrics.active_days;
  const streak = c.best_streak_weeks ?? c.metrics.best_streak_weeks;
  const firstCommit = new Date(c.first_commit ?? c.metrics.first_commit ?? Date.now());
  const platform = c.app_platform ?? c.metrics.platform ?? null;
  const [rankPlat, rankAll] = row ? await Promise.all([rankIn(row, 'platform'), rankIn(row, 'all')]).catch(() => [null, null]) : [null, null];
  const page = `${SITE}${locale === 'en' ? '/en' : ''}/app/${c.slug ?? ''}`;
  const privacy = `${SITE}${locale === 'en' ? '/en' : ''}/confidentialite`;
  const to = c.owner_email ?? null;
  if (locale === 'fr') {
    const since = firstCommit.toLocaleDateString('fr', { month: 'long', year: 'numeric' });
    const rank = rankPlat && platform && platform !== 'Autre' ? `Elle est ${rankPlat === 1 ? '1re' : `${rankPlat}e`} des apps ${platform}.` : rankAll ? `Elle est ${rankAll === 1 ? '1re' : `${rankAll}e`} du classement.` : '';
    return { to, locale, subject: `${c.name} sur Not a Cent`, body:
`Bonjour ${first},

J'ai trouvé ${c.name} sur GitHub : ${days} jours de commits depuis ${since}, ${streak} semaine${streak > 1 ? 's' : ''} d'affilée au mieux. Ça méritait une fiche sur Not a Cent, un annuaire où on classe les apps par travail vérifié, pas par revenu. ${rank}

${page}

Not a Cent liste les apps qui n'ont pas encore gagné d'argent. Si la tienne en gagne, dis-le et on ajuste la fiche. L'inscription, elle, est gratuite et le restera. Si tu te connectes avec GitHub, la fiche est à toi : une phrase, une image, et un badge « ${days} jours actifs, vérifié » pour ton README. Si tu préfères qu'elle disparaisse, réponds « non » et je la retire.

Ton adresse vient de ton profil GitHub public, je ne t'écrirai pas deux fois. Les détails : ${privacy}

Gabriel` };
  }
  const since = firstCommit.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const nth = (n: number) => `#${n}`;
  const rank = rankPlat && platform && platform !== 'Autre' ? `It's ${nth(rankPlat)} among ${platform} apps.` : rankAll ? `It's ${nth(rankAll)} on the board.` : '';
  return { to, locale, subject: `${c.name} on Not a Cent`, body:
`Hi ${first},

I found ${c.name} on GitHub: ${days} days with commits since ${since}, ${streak} week${streak > 1 ? 's' : ''} in a row at best. That deserved a card on Not a Cent, a directory that ranks apps by verified work, not revenue. ${rank}

${page}

Not a Cent lists apps that haven't made money yet. If yours does, tell me and I'll adjust the card. Listing itself is free and always will be. If you sign in with GitHub, the card is yours: a line, a picture, and a "${days} active days, verified" badge for your README. If you'd rather it disappear, reply "no" and I'll take it down.

Your address comes from your public GitHub profile, and I won't write twice. Details: ${privacy}

Gabriel` };
}
