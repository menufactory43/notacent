// Ce qu'un Mac demande avant d'ouvrir une app téléchargée : est-elle signée, notarisée, ou passée par l'App Store ?
// C'est la première chose qu'on vérifie avant de télécharger un DMG d'inconnu. On la lit comme le reste : dans le repo,
// et chez Apple, jamais sur déclaration. Les deux chiffres sont indépendants, une app peut avoir les deux.
import { gh } from './github';

// ---- 1. L'App Store : un lien apps.apple.com, vérifié chez Apple.

// L'identifiant d'une fiche App Store à partir de son lien. Accepte les vieilles formes (itunes.apple.com, /idNNN, ?id=NNN).
export function storeIdFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  if (!/(^|\.)(apps|itunes)\.apple\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/id(\d{4,12})/i) ?? u.pathname.match(/\/(\d{6,12})$/);
  return m?.[1] ?? (/^\d{4,12}$/.test(u.searchParams.get('id') ?? '') ? u.searchParams.get('id') : null);
}

export interface Store { id: string; url: string; name: string; seller: string; kind: 'mac' | 'ios'; price: number; at: string }
// L'API publique d'Apple, sans clé : elle répond ce que la fiche App Store affiche. Zéro résultat = le lien ne mène nulle part.
export async function lookupStore(id: string): Promise<Store | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=macSoftware,software`, { headers: { 'User-Agent': 'notacent (+https://notacent.app)' } });
  if (!res.ok) throw new Error(`Apple ${res.status}`);
  const j = (await res.json()) as { resultCount: number; results: { trackId: number; trackViewUrl: string; trackName: string; sellerName: string; kind?: string; wrapperType?: string; price?: number }[] };
  const r = j.results?.[0];
  if (!j.resultCount || !r?.trackViewUrl) return null;
  return {
    id: String(r.trackId), url: r.trackViewUrl, name: r.trackName ?? '', seller: r.sellerName ?? '',
    kind: r.kind === 'mac-software' ? 'mac' : 'ios', price: r.price ?? 0, at: new Date().toISOString().slice(0, 10),
  };
}

// ---- 2. La notarisation : lue dans le workflow de publication, sur un repo public.

// Notarisée : l'outil d'Apple qui envoie le binaire à la notarisation, ou le ticket agrafé dessus.
const NOTARY: [RegExp, string][] = [
  [/\bnotarytool\b/i, 'xcrun notarytool'],
  [/\bstapler\s+staple\b/i, 'xcrun stapler staple'],
  [/altool[^\n]*--notarize/i, 'altool --notarize-app'],
  [/uses:\s*\S*notarize\S*/i, 'action de notarisation'],
  [/APPLE_APP_SPECIFIC_PASSWORD|APPLE_ID_PASSWORD|APPLE_NOTARIZATION|NOTARIZE_APPLE/i, 'identifiants de notarisation'],
];
// Signée seulement : un certificat Developer ID passe Gatekeeper au premier lancement, mais pas sans notarisation depuis macOS 10.15.
const SIGNED: [RegExp, string][] = [
  [/codesign[^\n]*(--sign|-s\s)/i, 'codesign --sign'],
  [/APPLE_SIGNING_IDENTITY|APPLE_CERTIFICATE|MACOS_CERTIFICATE|DEVELOPER_ID_APPLICATION/i, 'certificat Developer ID'],
  [/\bCSC_LINK\b/i, 'CSC_LINK (electron-builder)'],
];

// « none » n'est pas rien : c'est « lu ce jour-là, rien trouvé ». La fiche le dit, et le cron sait qu'il n'a pas à relire.
export interface Notarized { level: 'notarized' | 'signed' | 'none'; path: string; hit: string; at: string }
const match = (text: string, table: [RegExp, string][]) => table.find(([re]) => re.test(text))?.[1] ?? null;

// Les fichiers publics où se joue une publication Mac : les workflows, et ce que ces workflows appellent
// (script/bundle-mac, scripts/release.sh, Makefile, tauri.conf.json…). Beaucoup de makers notarisent dans un script,
// pas dans le YAML : s'arrêter aux workflows ferait dire « rien » à des apps parfaitement notarisées.
const RAW = 'https://raw.githubusercontent.com';
const NAMED = /^(makefile|justfile|tauri\.conf\.json|package\.json|electron-builder\.(ya?ml|json|js)|fastlane\/fastfile)$/i;
const BUILDY = /(notari[sz]|codesign|gatekeeper|release|publish|bundle|package|dist|build|sign|deploy|dmg|installer)/i;
const CODE = /\.(sh|bash|zsh|ya?ml|js|mjs|cjs|ts|py|rb|toml|json|swift|ps1|mk)$/i;

function candidates(tree: { path: string; type: string; size?: number }[]): string[] {
  const files = tree.filter((f) => f.type === 'blob' && (f.size ?? 0) < 100_000);
  const score = (p: string) => {
    const name = p.split('/').pop() ?? '';
    const dir = p.slice(0, p.length - name.length);
    if (p.startsWith('.github/workflows/')) return /\.ya?ml$/i.test(name) ? 3 : 0;
    if (NAMED.test(p) || NAMED.test(name)) return 2;
    const inScripts = /^(script|scripts|ci|tools|build|packaging|dev)\//i.test(dir) || dir === '';
    if (!inScripts) return 0;
    // Le nom doit parler de publication (`create-dmg.sh`, `release.yml`), ou n'avoir aucune extension dans script/
    // (`script/bundle-mac`). Sinon on ramasse un `codesign` qui traîne dans un outil sans rapport, et on l'affiche à tort.
    if (BUILDY.test(name)) return CODE.test(name) || !name.includes('.') ? 2 : 0;
    return !name.includes('.') && dir !== '' ? 1 : 0;
  };
  return files.map((f) => [score(f.path), f.path] as const).filter(([n]) => n > 0)
    .sort((a, b) => b[0] - a[0] || a[1].length - b[1].length).slice(0, 14).map(([, p]) => p);
}

// Lus comme n'importe qui les lit sur github.com : un appel pour l'arborescence, puis les fichiers en clair.
export async function releaseFiles(token: string, fullName: string): Promise<{ path: string; text: string }[]> {
  type Tree = { tree: { path: string; type: string; size?: number }[]; truncated: boolean };
  const { data } = await gh<Tree>(`/repos/${fullName}/git/trees/HEAD?recursive=1`, token).catch((e) => {
    if (/ 40[943] /.test(String(e))) return { data: { tree: [], truncated: false } as Tree, next: null, status: 404 };
    throw e;
  });
  const out: { path: string; text: string }[] = [];
  for (const path of candidates(data?.tree ?? [])) {
    const res = await fetch(`${RAW}/${fullName}/HEAD/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { 'User-Agent': 'notacent (+https://notacent.app)' } }).catch(() => null);
    if (res?.ok) out.push({ path, text: await res.text() });
  }
  return out;
}

// Le verdict, avec son fichier : la fiche montre où c'est écrit, pour qu'on puisse aller voir soi-même.
export function notaryIn(files: { path: string; text: string }[]): Notarized {
  const at = new Date().toISOString().slice(0, 10);
  for (const f of files) { const hit = match(f.text, NOTARY); if (hit) return { level: 'notarized', path: f.path, hit, at }; }
  for (const f of files) { const hit = match(f.text, SIGNED); if (hit) return { level: 'signed', path: f.path, hit, at }; }
  return { level: 'none', path: '', hit: '', at };
}

// Une app Mac, un repo public : le workflow dit-il qu'on signe et qu'on notarise ?
export async function readNotarized(token: string, fullName: string): Promise<Notarized> {
  return notaryIn(await releaseFiles(token, fullName));
}

// Ce que le cron relit chaque nuit, et ce que la publication lit une première fois.
// Le lien App Store vaut pour toutes les plateformes ; la notarisation ne se lit que sur un repo public d'app Mac.
// En cas de pépin (Apple ou GitHub qui ne répond pas), on garde ce qu'on savait plutôt que d'effacer.
export interface SigningIn { full_name: string; private: boolean; platform: string | null; store_url: string | null; url?: string | null; homepage?: string | null; store: Store | null; notarized: Notarized | null }
export async function refreshSigning(a: SigningIn, token: string | null): Promise<{ store: Store | null; notarized: Notarized | null }> {
  const id = storeIdFrom(a.store_url) ?? storeIdFrom(a.url) ?? storeIdFrom(a.homepage);
  const store = id ? await lookupStore(id).catch((e) => { console.error('App Store', a.full_name, e); return a.store; }) : null;
  // La lecture coûte une arborescence et une poignée de fichiers : une fois par semaine suffit, un workflow ne bouge pas tous les jours.
  const fresh = a.notarized && Date.now() - Date.parse(a.notarized.at) < 7 * 86_400_000;
  const mac = !a.private && token && a.platform === 'Mac';
  const notarized = !mac ? null : fresh ? a.notarized : await readNotarized(token!, a.full_name).catch((e) => { console.error('notarisation', a.full_name, e); return a.notarized; });
  return { store, notarized };
}
