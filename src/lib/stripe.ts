import { createHmac, timingSafeEqual } from 'node:crypto';
const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
export const stripeReady = () => Boolean(env('STRIPE_SECRET_KEY'));
export const sponsorDays = () => Number(env('SPONSOR_DAYS') || 7);
export const sponsorCents = () => Number(env('SPONSOR_PRICE_CENTS') || 1900);
export const sponsorCurrency = () => env('SPONSOR_CURRENCY') || 'eur';

// Stripe Checkout, sans SDK : une requête form-encodée.
export async function createCheckout(o: { appId: number; slug: string; name: string; origin: string; locale: string }) {
  const p = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': sponsorCurrency(),
    'line_items[0][price_data][unit_amount]': String(sponsorCents()),
    'line_items[0][price_data][product_data][name]': `Not a Cent · ${o.name} · ${sponsorDays()} jours en emplacement sponsorisé`,
    success_url: `${o.origin}${o.locale === 'en' ? '/en' : ''}/app/${o.slug}?sponsor=merci`,
    cancel_url: `${o.origin}${o.locale === 'en' ? '/en' : ''}/app/${o.slug}`,
    'metadata[app_id]': String(o.appId),
    'metadata[slug]': o.slug,
    locale: o.locale === 'en' ? 'en' : 'fr',
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p,
  });
  const j = (await res.json()) as { url?: string; error?: { message: string } };
  if (!j.url) throw new Error(j.error?.message ?? 'Stripe a refusé la session');
  return j.url;
}

export function verifyWebhook(raw: string, header: string | null): { type: string; data: { object: { id: string; payment_status: string; amount_total: number; metadata: Record<string, string> } } } | null {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret || !header) return null;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return null;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  if (expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return null;
  return JSON.parse(raw);
}
