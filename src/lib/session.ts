import type { AstroCookies } from 'astro';
import { sql, hasDb } from './db';
import { open } from './crypto';

const secret = () => import.meta.env.SESSION_SECRET ?? process.env.SESSION_SECRET ?? '';
const enc = new TextEncoder();

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
export async function sign(value: string) { return `${value}.${await hmac(value)}`; }
export async function verify(token: string | undefined) {
  if (!token || !secret()) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const value = token.slice(0, i);
  return (await hmac(value)) === token.slice(i + 1) ? value : null;
}

export interface SessionUser { id: number; github_id: number; login: string; name: string | null; avatar_url: string | null; access_token: string | null; installation_id: number | null }

export async function setSession(cookies: AstroCookies, userId: number) {
  cookies.set('nac_session', await sign(String(userId)), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 });
}
export function clearSession(cookies: AstroCookies) { cookies.delete('nac_session', { path: '/' }); }
export async function currentUser(cookies: AstroCookies): Promise<SessionUser | null> {
  if (!hasDb) return null;
  const id = await verify(cookies.get('nac_session')?.value);
  if (!id) return null;
  const rows = (await sql.query(`select id, github_id, login, name, avatar_url, access_token, installation_id from users where id = $1`, [Number(id)])) as SessionUser[];
  const u = rows[0];
  if (!u) return null;
  return { ...u, access_token: open(u.access_token) };
}
