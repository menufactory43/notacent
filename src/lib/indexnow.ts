import { SITE } from './seo';
// IndexNow : on dit à Bing (et donc ChatGPT), Yandex, Naver et Seznam quelles pages viennent de changer. Google n'écoute pas, il a le sitemap.
const env = (k: string) => (import.meta.env[k] ?? process.env[k] ?? '') as string;
export const indexNowKey = () => env('INDEXNOW_KEY');
export const KEY_PATH = '/indexnow.txt';

// Jusqu'à 10 000 URL par appel. Retourne le nombre d'URL envoyées, 0 si la clé manque ou si l'appel échoue.
export async function pingIndexNow(paths: string[]): Promise<number> {
  const key = indexNowKey();
  if (!key || !paths.length) return 0;
  const urlList = [...new Set(paths)].slice(0, 10_000).map((p) => (p.startsWith('http') ? p : `${SITE}${p}`));
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}${KEY_PATH}`, urlList }),
    });
    if (!res.ok && res.status !== 202) { console.error('indexnow', res.status, await res.text()); return 0; }
    return urlList.length;
  } catch (e) { console.error('indexnow', e); return 0; }
}
// Les deux pages d'une fiche.
export const appPaths = (slug: string) => [`/app/${slug}`, `/en/app/${slug}`];
