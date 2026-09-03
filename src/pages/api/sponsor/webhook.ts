import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { verifyWebhook, sponsorDays } from '../../../lib/stripe';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const ev = verifyWebhook(await request.text(), request.headers.get('stripe-signature'));
  if (!ev) return new Response('signature', { status: 400 });
  if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') {
    const o = ev.data.object;
    const appId = Number(o.metadata.app_id);
    if (appId) {
      // L'emplacement démarre à la fin du sponsoring en cours s'il y en a un.
      await sql.query(
        `insert into sponsors (app_id, starts_at, ends_at, amount_cents, stripe_session)
         select $1, greatest(now(), coalesce((select max(ends_at) from sponsors where ends_at > now()), now())),
                greatest(now(), coalesce((select max(ends_at) from sponsors where ends_at > now()), now())) + ($2 || ' days')::interval, $3, $4
         on conflict (stripe_session) do nothing`,
        [appId, String(sponsorDays()), o.amount_total, o.id],
      );
      await sql.query(`insert into activity (app_id, kind) values ($1, 'sponsor')`, [appId]);
    }
  }
  return new Response('ok');
};
