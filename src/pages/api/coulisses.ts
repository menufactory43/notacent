import type { APIRoute } from 'astro';
import { currentUser } from '../../lib/session';
import { isAdmin, listCandidate, setStatus, refuse, candidates, composeMail, type OutreachStatus } from '../../lib/outreach';
export const prerender = false;

// Les gestes des coulisses : lister, marquer envoyé, non, ignorer, remettre. Admin seulement.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await currentUser(cookies);
  if (!isAdmin(user?.login)) return new Response('non', { status: 403 });
  const f = await request.formData();
  const id = Number(f.get('id'));
  const action = String(f.get('action') ?? '');
  const note = typeof f.get('note') === 'string' ? String(f.get('note')).slice(0, 500) : null;
  if (!id) return redirect('/coulisses', 302);
  let msg = '';
  if (action === 'list') { const r = await listCandidate(id); msg = r.ok ? `listée : /app/${r.slug}` : r.why; }
  else if (action === 'sent') await setStatus(id, 'sent', note);
  else if (action === 'no') await refuse(id);
  else if (action === 'ignore') await setStatus(id, 'ignored', note);
  else if (action === 'back') await setStatus(id, 'found', note);
  else if (action === 'note') await setStatus(id, String(f.get('status') ?? 'found') as OutreachStatus, note);
  const focus = String(f.get('focus') ?? '');
  return redirect(`/coulisses?msg=${encodeURIComponent(msg)}${focus ? `&focus=${encodeURIComponent(focus)}` : ''}`, 303);
};

// Export CSV des fiches listées avec une adresse : pour un publipostage, si un jour on en veut un.
export const GET: APIRoute = async ({ cookies }) => {
  const user = await currentUser(cookies);
  if (!isAdmin(user?.login)) return new Response('non', { status: 403 });
  const rows = await candidates('listed');
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['email,first_name,app,url,subject,body'];
  for (const c of rows) {
    const to = c.owner_email ?? c.commit_email;
    if (!to) continue;
    const m = await composeMail(c);
    lines.push([to, (c.owner_name ?? '').split(/\s+/)[0] || c.owner_login, c.name, `https://notacent.app/app/${c.slug}`, m.subject, m.body].map(esc).join(','));
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="notacent-outreach.csv"' } });
};
