import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL manquante'); process.exit(1); }
const sql = neon(url);
const split = (text) => text.split(/;\s*\n/).map((s) => s.replace(/^(\s*--.*\n)+/g, '').trim()).filter((s) => s && !/^--/.test(s));
const file = process.argv[2];
if (!file) {
  // Sans argument : le schéma complet, idempotent, rejouable à volonté.
  const statements = split(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  for (const s of statements) await sql.query(s);
  console.log(`schéma appliqué (${statements.length} instructions)`);
} else {
  // Avec un fichier : une migration datée, jouée une seule fois, en une transaction, et notée dans schema_migrations.
  // Un fichier .down.sql défait la migration du même nom et efface sa ligne.
  const down = file.endsWith('.down.sql');
  const name = basename(file).replace(/(\.down)?\.sql$/, '');
  await sql.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())`);
  const [done] = await sql.query(`select applied_at from schema_migrations where name = $1`, [name]);
  if (!down && done) { console.log(`${name} : déjà appliquée le ${new Date(done.applied_at).toISOString()}`); process.exit(0); }
  if (down && !done) { console.log(`${name} : pas appliquée, rien à défaire`); process.exit(0); }
  const statements = split(readFileSync(file, 'utf8'));
  const ledger = down ? sql.query(`delete from schema_migrations where name = $1`, [name]) : sql.query(`insert into schema_migrations (name) values ($1)`, [name]);
  await sql.transaction([...statements.map((s) => sql.query(s)), ledger]);
  console.log(`${name} : ${down ? 'défaite' : 'appliquée'} (${statements.length} instructions)`);
}
