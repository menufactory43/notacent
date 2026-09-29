// Plateformes reconnues : ce sont aussi les pages « Parcourir » (/plateforme/mac…).
export const PLATFORMS = ['Mac', 'iOS', 'Web', 'CLI', 'Android', 'Windows', 'Linux', 'MCP', 'Autre'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const platformSlug = (p: string) => p.toLowerCase();
export const platformFromSlug = (s: string): Platform | null => PLATFORMS.find((p) => platformSlug(p) === s.toLowerCase()) ?? null;

// Devine la plateforme à partir de ce que GitHub sait du repo. Le maker peut corriger dans la fiche.
export function guessPlatform(o: { language?: string | null; topics?: string[] | null; name?: string; description?: string | null; homepage?: string | null }): Platform {
  const topics = (o.topics ?? []).map((t) => t.toLowerCase());
  const text = `${o.name ?? ''} ${o.description ?? ''} ${o.homepage ?? ''}`.toLowerCase();
  // Des mots entiers : « cli » est dans « client » et « clipboard », « ios » dans « studios ».
  const inText = (x: string) => new RegExp(`(^|[^a-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);
  const has = (...w: string[]) => w.some((x) => topics.includes(x) || inText(x));
  if (has('mcp', 'model-context-protocol', 'mcp-server')) return 'MCP';
  if (has('cli', 'command-line', 'terminal', 'tui')) return 'CLI';
  if (has('ios', 'iphone', 'ipad', 'testflight')) return 'iOS';
  if (has('macos', 'mac-app', 'menubar', 'menu-bar', 'swiftui-mac', 'appkit')) return 'Mac';
  // apps.apple.com sert aussi le Mac App Store : le lien ne tranche qu'après les signaux Mac.
  if (inText('apps.apple.com')) return /[?&]mt=12\b/.test(text) ? 'Mac' : 'iOS';
  if (has('android', 'play.google.com', 'kotlin-android')) return 'Android';
  if (has('windows', 'winui', 'wpf')) return 'Windows';
  // Une app multiplateforme (Tauri, Electron, Flutter, wasm…) n'est pas un outil en ligne de commande, même écrite en Rust ou en Go.
  if (has('tauri', 'electron', 'flutter', 'react-native', 'react native', 'cross-platform', 'wasm', 'webassembly', 'leptos', 'dioxus', 'pwa', 'capacitor', 'wails')) return 'Web';
  const lang = (o.language ?? '').toLowerCase();
  if (lang === 'swift' || lang === 'objective-c') return 'Mac';
  if (lang === 'kotlin' || lang === 'java') return 'Android';
  if (['rust', 'go', 'c', 'c++', 'shell', 'zig'].includes(lang)) return 'CLI';
  if (lang === 'c#') return 'Windows';
  if (['typescript', 'javascript', 'astro', 'svelte', 'vue', 'html', 'css', 'php', 'ruby', 'elixir', 'python', 'dart'].includes(lang)) return 'Web';
  return 'Autre';
}
