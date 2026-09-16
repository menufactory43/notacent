// Cherche des apps sur GitHub, les note, et les range dans la table outreach pour /coulisses.
// Rien n'est publié ici : lister une fiche reste un geste à la main dans les coulisses.
//
//   npm run prospect                    toutes les recherches, 40 candidats retenus chacune
//   npm run prospect -- mac cli-rust    seulement ces recherches
//   npm run prospect -- --limit 20      moins de candidats par recherche
//
// Jeton GitHub : GITHUB_TOKEN dans .env.local, sinon celui de `gh auth login`.
import { execSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import { compute } from '../src/lib/work.ts';
import { guessPlatform } from '../src/lib/platform.ts';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL manquante'); process.exit(1); }
const sql = neon(url);
const token = process.env.GITHUB_TOKEN || execSync('gh auth token', { encoding: 'utf8' }).trim();
if (!token) { console.error('aucun jeton GitHub : GITHUB_TOKEN ou `gh auth login`'); process.exit(1); }

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 40 : 40;
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit');

const DAY = 86_400_000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const since = iso(Date.now() - 45 * DAY); // poussé dans les six dernières semaines : encore vivante
const before = iso(Date.now() - 150 * DAY); // créée il y a au moins cinq mois : du travail derrière
const base = `fork:false archived:false stars:<80 pushed:>${since} created:<${before}`;

// Les recherches. Chaque nom devient la colonne « query » du candidat, pour savoir d'où il vient.
const QUERIES = {
  'mac': `topic:macos ${base}`,
  'mac-swift': `language:Swift topic:macos-app ${base}`,
  'menubar': `topic:menubar ${base}`,
  'swiftui': `topic:swiftui language:Swift ${base}`,
  'ios': `topic:ios language:Swift ${base}`,
  'cli-rust': `topic:cli language:Rust ${base}`,
  'cli-go': `topic:cli language:Go ${base}`,
  'tui': `topic:tui ${base}`,
  'tauri': `topic:tauri ${base}`,
  'electron': `topic:electron topic:desktop-app ${base}`,
  'mcp': `topic:mcp-server ${base}`,
  'indie': `topic:indie-hacker ${base}`,
  'side-project': `topic:side-project ${base}`,
  'claude-code': `topic:claude-code ${base}`,
};
const names = wanted.length ? wanted.filter((n) => QUERIES[n]) : Object.keys(QUERIES);
if (!names.length) { console.error(`recherches connues : ${Object.keys(QUERIES).join(', ')}`); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gh(path) {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'notacent (+https://notacent.app)', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
    const wait = Math.max(5_000, reset - Date.now() + 1_000);
    console.log(`  limite GitHub, pause ${Math.round(wait / 1000)} s`);
    await sleep(wait);
    return gh(path);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

// Ce qui n'est pas une app : modèles, listes, dotfiles, exemples.
const NOISE = /awesome|template|boilerplate|starter|dotfiles|example|sample|tutorial|course|playground|demo|-docs$|^docs-|homework|leetcode|config$|configuration|homebrew|\btap\b|nixos|nix-/i;

// Déjà connu : une fiche, un candidat, ou un maker qui a dit non.
const known = new Set((await sql.query(`select repo_id from apps union select repo_id from outreach`)).map((r) => String(r.repo_id)));
const blocked = new Set((await sql.query(`select github_id from users where blocked`)).map((r) => String(r.github_id)));
const hasAccount = new Set((await sql.query(`select github_id from users where claimed`)).map((r) => String(r.github_id)));

// Les dates de commit et l'email de l'auteur quand c'est le propriétaire. 100 par page, 15 pages au plus.
async function commits(fullName, ownerLogin) {
  const dates = [];
  let email = null;
  let next = `/repos/${fullName}/commits?per_page=100`;
  let pages = 0;
  while (next && pages++ < 15) {
    const res = await fetch(next.startsWith('http') ? next : `https://api.github.com${next}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'notacent (+https://notacent.app)' },
    });
    if (!res.ok) break;
    for (const c of await res.json()) {
      const d = c.commit?.author?.date ?? c.commit?.committer?.date;
      if (d) dates.push(d);
      const e = c.commit?.author?.email ?? '';
      if (!email && c.author?.login === ownerLogin && e && !/noreply|no-reply|users\.noreply/i.test(e)) email = e;
    }
    const link = res.headers.get('link') ?? '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    next = m ? m[1] : null;
  }
  return { dates, email };
}

let found = 0, kept = 0;
for (const name of names) {
  console.log(`\n# ${name}`);
  const q = encodeURIComponent(QUERIES[name]);
  let candidates = [];
  for (let page = 1; page <= 3 && candidates.length < LIMIT * 3; page++) {
    const r = await gh(`/search/repositories?q=${q}&sort=updated&order=desc&per_page=100&page=${page}`);
    if (!r?.items?.length) break;
    candidates.push(...r.items);
    if (r.items.length < 100) break;
    await sleep(2_200); // 30 recherches par minute
  }
  // Le tri qui compte : une personne (pas une organisation), un site, une description, pas un modèle, pas déjà connu.
  candidates = candidates.filter((r) =>
    r.owner?.type === 'User' && r.homepage && /^https?:\/\//i.test(r.homepage) && !/github\.com\//i.test(r.homepage)
    && r.description && !NOISE.test(r.name) && !NOISE.test(r.description)
    && !known.has(String(r.id)) && !blocked.has(String(r.owner.id)) && !hasAccount.has(String(r.owner.id)),
  );
  console.log(`  ${candidates.length} avec un site, on en regarde ${Math.min(candidates.length, LIMIT)}`);
  found += candidates.length;

  for (const r of candidates.slice(0, LIMIT)) {
    try {
      const contributors = (await gh(`/repos/${r.full_name}/contributors?per_page=5&anon=0`)) ?? [];
      if (contributors.length > 3) { console.log(`  · ${r.full_name} : ${contributors.length}+ contributeurs, passe`); continue; }
      const { dates, email: commitEmail } = await commits(r.full_name, r.owner.login);
      const m = compute(dates);
      if (m.active_days < 20 || m.active_days_30 < 2) { console.log(`  · ${r.full_name} : ${m.active_days} j, ${m.active_days_30} ce mois, passe`); continue; }
      const owner = (await gh(`/users/${r.owner.login}`)) ?? {};
      const release = await gh(`/repos/${r.full_name}/releases/latest`);
      // Score pépite : jours actifs × plus longue série ÷ (étoiles + 5). Du travail régulier, que personne n'a vu.
      const score = m.active_days * m.best_streak_weeks / (r.stargazers_count + 5);
      await sql.query(
        `insert into outreach (repo_id, full_name, name, description, language, homepage, topics, stars, contributors, has_release, repo_created, pushed_at,
           owner_id, owner_login, owner_name, owner_avatar, owner_email, commit_email, owner_blog, owner_twitter, owner_location, metrics, score, query)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         on conflict (repo_id) do update set stars = excluded.stars, pushed_at = excluded.pushed_at, metrics = excluded.metrics, score = excluded.score`,
        [r.id, r.full_name, r.name, r.description, r.language, r.homepage, r.topics ?? [], r.stargazers_count, contributors.length || 1, Boolean(release), r.created_at, r.pushed_at,
         r.owner.id, r.owner.login, owner.name ?? null, owner.avatar_url ?? null, owner.email ?? null, commitEmail, owner.blog || null, owner.twitter_username ?? null, owner.location ?? null,
         JSON.stringify({ ...m, platform: guessPlatform({ language: r.language, topics: r.topics, name: r.name, description: r.description, homepage: r.homepage }) }), score, name],
      );
      known.add(String(r.id));
      kept++;
      console.log(`  ✓ ${r.full_name} · ${m.active_days} j · ${m.best_streak_weeks} sem · ★ ${r.stargazers_count} · score ${score.toFixed(1)} · ${owner.email ? 'email profil' : commitEmail ? 'email commit' : 'pas d\'email'}`);
    } catch (e) { console.error(`  ✗ ${r.full_name}`, e.message); }
  }
}
const [{ n }] = await sql.query(`select count(*)::int as n from outreach where status = 'found'`);
console.log(`\n${found} repos avec un site, ${kept} candidats retenus cette fois, ${n} à lister dans /coulisses`);
