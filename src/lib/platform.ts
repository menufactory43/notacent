// Plateformes reconnues : ce sont aussi les pages « Parcourir » (/plateforme/mac…).
export const PLATFORMS = ['Mac', 'iOS', 'Web', 'CLI', 'Android', 'Windows', 'Linux', 'MCP', 'Autre'] as const;
export type Platform = (typeof PLATFORMS)[number];

// Les plateformes d'une app, principale d'abord ; une vieille valeur seule (échantillons, anciennes lignes) en fait une liste.
export const platformsOf = (a: { platform?: string | null; platforms?: string[] | null }): string[] => (a.platforms?.length ? a.platforms : a.platform ? [a.platform] : []);

export const platformSlug = (p: string) => p.toLowerCase();
export const platformFromSlug = (s: string): Platform | null => PLATFORMS.find((p) => platformSlug(p) === s.toLowerCase()) ?? null;

// Une app peut viser plusieurs plateformes : la liste est rangée comme PLATFORMS, la première sert quand il n'en faut qu'une
// (le rang « 3e des apps Mac », le mail de prospection). « Autre » ne vaut que seule.
export function cleanPlatforms(values: unknown[], primary?: string | null): Platform[] {
  const set = new Set(values.map(String).filter((v): v is Platform => (PLATFORMS as readonly string[]).includes(v)));
  if (set.size > 1) set.delete('Autre');
  const list = PLATFORMS.filter((p) => set.has(p));
  // La principale d'avant garde sa place tant qu'elle reste cochée.
  return primary && set.has(primary as Platform) ? [primary as Platform, ...list.filter((p) => p !== primary)] : list;
}

// Devine les plateformes à partir de ce que GitHub sait du repo. Le maker peut corriger dans la fiche.
export function guessPlatforms(o: { language?: string | null; topics?: string[] | null; name?: string; description?: string | null; homepage?: string | null }): Platform[] {
  const topics = (o.topics ?? []).map((t) => t.toLowerCase());
  const main = guessPlatform(o);
  if (main === 'Desktop') return ['Mac', 'Windows', 'Linux'];
  // Les autres ne viennent que des topics, posés exprès : « windows » dans une description parle souvent de fenêtres.
  const extra: Platform[] = [];
  if (topics.includes('ios')) extra.push('iOS');
  if (topics.includes('macos')) extra.push('Mac');
  if (topics.includes('android')) extra.push('Android');
  if (topics.includes('windows')) extra.push('Windows');
  if (topics.includes('linux')) extra.push('Linux');
  return main === 'CLI' || main === 'MCP' ? [main] : cleanPlatforms([main, ...extra], main);
}

// La plateforme principale ; « Desktop » : une app de bureau multiplateforme, qui vaut Mac, Windows et Linux.
function guessPlatform(o: { language?: string | null; topics?: string[] | null; name?: string; description?: string | null; homepage?: string | null }): Platform | 'Desktop' {
  const topics = (o.topics ?? []).map((t) => t.toLowerCase());
  const text = `${o.name ?? ''} ${o.description ?? ''} ${o.homepage ?? ''}`.toLowerCase();
  // Des mots entiers : « cli » est dans « client » et « clipboard », « ios » dans « studios ».
  const inText = (x: string) => new RegExp(`(^|[^a-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);
  const has = (...w: string[]) => w.some((x) => topics.includes(x) || inText(x));
  if (has('mcp', 'model-context-protocol', 'mcp-server')) return 'MCP';
  // Une app de bureau multiplateforme (Electron, Tauri, Wails) n'est pas un outil en ligne de commande, même avec un terminal intégré.
  if (has('electron', 'tauri', 'wails')) return 'Desktop';
  if (has('cli', 'command-line', 'terminal', 'tui')) return 'CLI';
  if (has('ios', 'iphone', 'ipad', 'testflight')) return 'iOS';
  if (has('macos', 'mac-app', 'menubar', 'menu-bar', 'swiftui-mac', 'appkit')) return 'Mac';
  // apps.apple.com sert aussi le Mac App Store : le lien ne tranche qu'après les signaux Mac.
  if (inText('apps.apple.com')) return /[?&]mt=12\b/.test(text) ? 'Mac' : 'iOS';
  if (has('android', 'play.google.com', 'kotlin-android')) return 'Android';
  if (has('windows', 'winui', 'wpf')) return 'Windows';
  // Une app multiplateforme (Flutter, wasm…) n'est pas un outil en ligne de commande, même écrite en Rust ou en Go.
  if (has('flutter', 'react-native', 'react native', 'cross-platform', 'wasm', 'webassembly', 'leptos', 'dioxus', 'pwa', 'capacitor')) return 'Web';
  const lang = (o.language ?? '').toLowerCase();
  if (lang === 'swift' || lang === 'objective-c') return 'Mac';
  if (lang === 'kotlin' || lang === 'java') return 'Android';
  if (['rust', 'go', 'c', 'c++', 'shell', 'zig'].includes(lang)) return 'CLI';
  if (lang === 'c#') return 'Windows';
  if (['typescript', 'javascript', 'astro', 'svelte', 'vue', 'html', 'css', 'php', 'ruby', 'elixir', 'python', 'dart'].includes(lang)) return 'Web';
  return 'Autre';
}
