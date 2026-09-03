import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL manquante'); process.exit(1); }
const sql = neon(url);
const statements = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`schéma appliqué (${statements.length} instructions)`);
