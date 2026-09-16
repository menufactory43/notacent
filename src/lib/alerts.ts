import { dueAlerts, alertMatches, markAlertSent, type Alert, type Browse } from './db';
import { toView } from './view';
import { browseLabel } from './browse';
import { SITE } from './seo';
import type { Locale } from '../i18n/strings';

const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
export const mailReady = () => Boolean(env('RESEND_API_KEY'));
const FROM = () => env('ALERT_FROM') || 'Not a Cent <alertes@notacent.vercel.app>';

// Un mail par alerte, une fois par semaine, seulement s'il y a des apps à montrer. Envoyé par Resend, sans SDK.
export async function sendAlerts(): Promise<{ sent: number; skipped: number }> {
  if (!mailReady()) return { sent: 0, skipped: 0 };
  let sent = 0, skipped = 0;
  for (const a of await dueAlerts()) {
    const apps = await alertMatches(a).catch(() => []);
    if (!apps.length) { skipped++; continue; }
    const locale: Locale = a.locale === 'en' ? 'en' : 'fr';
    const label = browseLabel(a.filter as Browse, locale);
    const subject = locale === 'fr' ? `${apps.length} app${apps.length > 1 ? 's' : ''} · ${label}` : `${apps.length} app${apps.length > 1 ? 's' : ''} · ${label}`;
    const lines = apps.map(toView).map((v) => {
      const page = `${SITE}${locale === 'fr' ? '' : '/en'}/app/${v.slug}`;
      const bits = locale === 'fr'
        ? `${v.activeDays} jours actifs · ${v.commits} commits · ★ ${v.stars}${v.takeover ? ' · ouverte à une reprise' : ''}`
        : `${v.activeDays} active days · ${v.commits} commits · ★ ${v.stars}${v.takeover ? ' · open to a takeover' : ''}`;
      return `<p style="margin:0 0 14px"><a href="${page}" style="font-weight:700;color:#1F1D2B">${esc(v.name)}</a>${v.tagline ? ` — ${esc(v.tagline)}` : ''}<br><span style="color:#6B6979;font-size:14px">${bits}</span></p>`;
    });
    const unsub = `${SITE}/api/alertes?token=${a.token}&stop=1`;
    const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1F1D2B;max-width:560px">
<p style="font-size:22px;font-weight:700;margin:0 0 6px">Not a Cent · ${esc(label)}</p>
<p style="color:#6B6979;margin:0 0 20px">${locale === 'fr' ? 'Ce qui est arrivé cette semaine dans ton filtre. Les chiffres viennent du repo.' : 'What landed in your filter this week. The numbers come from the repo.'}</p>
${lines.join('\n')}
<p style="color:#6B6979;font-size:13px;margin-top:24px">${locale === 'fr' ? 'Tu reçois ce mail parce que tu as créé une alerte sur' : 'You get this because you created an alert on'} <a href="${SITE}" style="color:#6B6979">notacent.vercel.app</a>. <a href="${unsub}" style="color:#6B6979">${locale === 'fr' ? 'Ne plus recevoir' : 'Unsubscribe'}</a></p>
</div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM(), to: [a.email], subject, html }),
    });
    if (res.ok) { await markAlertSent(a.id); sent++; } else { console.error('resend', a.email, await res.text()); skipped++; }
  }
  return { sent, skipped };
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export type { Alert };
