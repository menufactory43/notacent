// La fournée du jour : les N meilleures fiches listées, adresse du profil GitHub public seulement,
// jamais quelqu'un déjà écrit. Envoi par smtp.gmail.com en tant que gabriel@getnotacent.com
// (l'alias « Envoyer en tant que »), donc rangé dans les Envoyés de Gmail, puis statut « sent ».
// Lancé chaque jour par ~/Library/LaunchAgents/app.notacent.outreach.plist.
//   npm run outreach:send -- 20          envoie
//   npm run outreach:send -- 20 --dry    montre sans envoyer
import nodemailer from 'nodemailer';
import { appBySlug, sql } from '../src/lib/db';
import { candidates, composeMail, setStatus } from '../src/lib/outreach';

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const dry = args.includes('--dry');
const FROM = 'Gabriel <gabriel@getnotacent.com>';
const pass = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s/g, '');
if (!dry && !pass) throw new Error('GMAIL_APP_PASSWORD manquant (fnox exec)');

const written = new Set(((await sql.query(
  `select lower(coalesce(owner_email, commit_email)) e from outreach where status in ('sent', 'claimed', 'no') and coalesce(owner_email, commit_email) is not null`,
)) as { e: string }[]).map((r) => r.e));

const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'meffysto@gmail.com', pass } });
let sent = 0;
for (const c of await candidates('listed', 1000)) {
  if (sent >= n) break;
  const to = c.owner_email?.toLowerCase();
  if (!to || !c.slug || written.has(to)) continue;
  const m = await composeMail(c, undefined, await appBySlug(c.slug));
  if (dry) { console.log(`--- ${to} · ${m.subject}\n${m.body}\n`); sent++; written.add(to); continue; }
  try {
    await t.sendMail({ from: FROM, to, subject: m.subject, text: m.body });
    await setStatus(c.id, 'sent');
    console.log(new Date().toISOString(), 'OK ', to, c.slug);
    sent++;
    written.add(to);
  } catch (e) {
    console.log(new Date().toISOString(), 'ERR', to, (e as Error).message);
  }
  await new Promise((r) => setTimeout(r, 4000));
}
const left = ((await sql.query(`select count(*)::int n from outreach where status = 'listed' and owner_email is not null`)) as { n: number }[])[0].n;
console.log(new Date().toISOString(), `${dry ? 'à envoyer' : 'envoyés'} : ${sent}, encore listées avec adresse : ${left}`);
