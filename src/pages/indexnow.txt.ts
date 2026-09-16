import type { APIRoute } from 'astro';
import { indexNowKey } from '../lib/indexnow';
export const prerender = false;
// La preuve que la clé IndexNow est à nous : le fichier doit contenir la clé, à l'adresse déclarée en keyLocation.
export const GET: APIRoute = () => (indexNowKey() ? new Response(indexNowKey(), { headers: { 'Content-Type': 'text/plain' } }) : new Response(null, { status: 404 }));
