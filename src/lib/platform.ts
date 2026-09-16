// Plateformes reconnues : ce sont aussi les pages « Parcourir » (/plateforme/mac…).
export const PLATFORMS = ['Mac', 'iOS', 'Web', 'CLI', 'Android', 'Windows', 'Linux', 'MCP', 'Autre'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const platformSlug = (p: string) => p.toLowerCase();
export const platformFromSlug = (s: string): Platform | null => PLATFORMS.find((p) => platformSlug(p) === s.toLowerCase()) ?? null;

// Devine la plateforme à partir de ce que GitHub sait du repo. Le maker peut corriger dans la fiche.
export function guessPlatform(o: { language?: string | null; topics?: string[] | null; name?: string; description?: string | null; homepage?: string | null }): Platform {
  const topics = (o.topics ?? []).map((t) => t.toLowerCase());
  const text = `${o.name ?? ''} ${o.description ?? ''} ${o.homepage ?? ''}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => topics.includes(x) || text.includes(x));
  if (has('mcp', 'model-context-protocol', 'mcp-server')) return 'MCP';
  if (has('cli', 'command-line', 'terminal', 'tui')) return 'CLI';
  if (has('ios', 'iphone', 'ipad', 'testflight', 'apps.apple.com')) return 'iOS';
  if (has('macos', 'mac-app', 'menubar', 'menu-bar', 'swiftui-mac', 'appkit')) return 'Mac';
  if (has('android', 'play.google.com', 'kotlin-android')) return 'Android';
  if (has('windows', 'winui', 'wpf')) return 'Windows';
  const lang = (o.language ?? '').toLowerCase();
  if (lang === 'swift' || lang === 'objective-c') return 'Mac';
  if (lang === 'kotlin' || lang === 'java') return 'Android';
  if (['rust', 'go', 'c', 'c++', 'shell', 'zig'].includes(lang)) return 'CLI';
  if (lang === 'c#') return 'Windows';
  if (['typescript', 'javascript', 'astro', 'svelte', 'vue', 'html', 'css', 'php', 'ruby', 'elixir', 'python', 'dart'].includes(lang)) return 'Web';
  return 'Autre';
}
