// Not a Cent — film de 30 s, 1920 × 1080, 60 i/s. Tout est dessiné ici, en canvas.
// Déterministe : frame(i) ne dépend que de i. Le même fichier sert l'aperçu temps réel, le rendu image par image
// et la liste des repères sonores (CUES) que audio.py lit pour caler la bande-son sur l'image.
(() => {
const W = 1920, H = 1080, FPS = 60, DUR = 30, FRAMES = FPS * DUR;

// Les couleurs du site (global.css) et les trois thèmes du badge (badgeCard.ts).
const LIGHT = { paper: '#FFFFFF', paper2: '#FAF9FC', ink: '#1F1D2B', pencil: '#7C7A8A', soft: '#66637A', faint: '#E6E4EC', hi: '#FFE45C', hiInk: '#5A4B00', red: '#D9432F', dot: '#E3E1EA', lines: null };
const DARK = { paper: '#1F1D2B', paper2: '#282637', ink: '#F6F3EA', pencil: '#B7B3C4', soft: '#B7B3C4', faint: '#393649', hi: '#FFE45C', hiInk: '#1F1D2B', red: '#F2705B', dot: '#302E40', lines: null };
const PAPER = { paper: '#FFFAEA', paper2: '#FFF5D8', ink: '#1F1D2B', pencil: '#66637A', soft: '#66637A', faint: '#EEE4C8', hi: '#FFE45C', hiInk: '#5A4B00', red: '#D9432F', dot: '#EEE4C8', lines: '#D9CFAF' };
const LOGO_INK = '#1F1D2B', LOGO_RED = '#D9432F', LOGO_HI = '#FFE45C';
let P = LIGHT;
let BOIL = 0; // les traits « bouillonnent » à 12 i/s, comme un dessin animé à la main

// ---------- maths ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  in2: (x) => x * x, in3: (x) => x * x * x,
  out2: (x) => 1 - (1 - x) * (1 - x), out3: (x) => 1 - Math.pow(1 - x, 3), out4: (x) => 1 - Math.pow(1 - x, 4),
  io2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  ioSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  ioExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  outBounce: (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; },
};
// Ressort amorti de 0 à 1, lancé à t0 : f en Hz, z l'amortissement (< 1 = dépasse puis revient).
function sp(t, t0, f = 2, z = 0.5) {
  const x = t - t0; if (x <= 0) return 0;
  const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
}
const bump = (t, a, b) => Math.sin(Math.PI * prog(t, a, b));
function hash(n) { n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
const rnd = (a, b = 0) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rnd(i, seed), rnd(i + 1, seed), u) * 2 - 1; }
function shake(t, t0, amp, dur = 0.5) {
  const x = t - t0; if (x < 0 || x > dur) return [0, 0, 0];
  const d = Math.pow(1 - x / dur, 2);
  return [noise(x * 38, 11) * amp * d, noise(x * 38, 23) * amp * d, noise(x * 30, 37) * amp * 0.0009 * d];
}

// ---------- tracés ----------
function measure(pts) { const acc = [0]; let L = 0; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(L); } return { acc, L }; }
function resample(pts, step = 8) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([lerp(ax, bx, k / n), lerp(ay, by, k / n)]);
  }
  return out;
}
function wob(pts, seed, amp = 1.2, freq = 1 / 50) {
  const { acc } = measure(pts), n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = a[1] - b[1], ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1;
    const o = noise(acc[i] * freq, seed) * amp; out.push([pts[i][0] + (nx / l) * o, pts[i][1] + (ny / l) * o]);
  }
  return out;
}
// Trace la portion [a, b] (en fraction de longueur) d'une polyligne.
function tracePart(ctx, pts, a = 0, b = 1) {
  const { acc, L } = measure(pts); const s0 = L * clamp(a), s1 = L * clamp(b); if (s1 <= s0 || L === 0) return false;
  const at = (s) => { let i = 1; while (i < pts.length - 1 && acc[i] < s) i++; const k = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; };
  const p0 = at(s0); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
  for (let i = 0; i < pts.length; i++) if (acc[i] > s0 && acc[i] < s1) ctx.lineTo(pts[i][0], pts[i][1]);
  const p1 = at(s1); ctx.lineTo(p1[0], p1[1]); return true;
}
function stroke(ctx, pts, { w = 3, color = P.ink, p = 1, a = 0, alpha = 1, cap = 'round' } = {}) {
  if (alpha <= 0 || !tracePart(ctx, pts, a, p)) return;
  ctx.save(); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.globalAlpha *= alpha; ctx.stroke(); ctx.restore();
}
function fillPts(ctx, pts, color, alpha = 1) { if (alpha <= 0) return; tracePart(ctx, pts); ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
const closed = (pts) => pts.concat([pts[0].slice()]);

// Les coins « dessinés à la main » du site : border-radius elliptiques inégaux (--sk, --sk2, .chip, le cadre du badge).
const RADII = { sk: [[255, 15, 225, 15], [15, 225, 15, 255]], sk2: [[15, 225, 15, 255], [255, 15, 225, 15]], chip: [[12, 40, 14, 44], [40, 12, 44, 14]], badge: [[14, 6, 16, 6], [6, 12, 6, 14]] };
function skPts(x, y, w, h, kind = 'sk', k = 1, seed = 1, amp = 1, over = 0.018) {
  const [hr0, vr0] = RADII[kind]; const hr = hr0.map((r) => r * k), vr = vr0.map((r) => r * k);
  const f = Math.min(1, w / (hr[0] + hr[1]), w / (hr[3] + hr[2]), h / (vr[0] + vr[3]), h / (vr[1] + vr[2]));
  const a = hr.map((r) => r * f), b = vr.map((r) => r * f); const pts = []; const n = 16;
  const arc = (cx, cy, rx, ry, a0, a1) => { for (let i = 0; i <= n; i++) { const q = a0 + ((a1 - a0) * i) / n; pts.push([cx + rx * Math.cos(q), cy + ry * Math.sin(q)]); } };
  arc(x + a[0], y + b[0], a[0], b[0], Math.PI, 1.5 * Math.PI);
  arc(x + w - a[1], y + b[1], a[1], b[1], 1.5 * Math.PI, 2 * Math.PI);
  arc(x + w - a[2], y + h - b[2], a[2], b[2], 0, 0.5 * Math.PI);
  arc(x + a[3], y + h - b[3], a[3], b[3], 0.5 * Math.PI, Math.PI);
  pts.push(pts[0].slice());
  let r = resample(pts, 7);
  if (over > 0) r = r.concat(r.slice(1, Math.max(2, Math.floor(r.length * over))));
  return amp ? wob(r, seed + BOIL * 131, amp, 1 / 70) : r;
}
function box(ctx, x, y, w, h, o = {}) {
  const { kind = 'sk', k = 1, seed = 1, amp = 1.1, p = 1, lw = 3, color = P.ink, fill = null, fillA = 1, dash = null } = o;
  const pts = skPts(x, y, w, h, kind, k, seed, amp);
  if (fill && fillA > 0) fillPts(ctx, pts, fill, fillA);
  if (dash) { ctx.save(); ctx.setLineDash(dash); stroke(ctx, pts, { w: lw, color, p }); ctx.restore(); } else stroke(ctx, pts, { w: lw, color, p });
  return pts;
}
// Chemins SVG simples (M, L, Q, C, Z, relatifs ou absolus) → polylignes, pour tracer le logo au feutre.
function svgPoly(d, seg = 14) {
  const tk = d.match(/[MmLlQqCcZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g); const pts = []; let i = 0, cmd = '', x = 0, y = 0;
  const num = () => parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toLowerCase()) {
      case 'm': case 'l': { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } x = nx; y = ny; pts.push([x, y]); if (cmd === 'm') cmd = 'l'; if (cmd === 'M') cmd = 'L'; break; }
      case 'q': { let ax = num(), ay = num(), ex = num(), ey = num(); if (rel) { ax += x; ay += y; ex += x; ey += y; } for (let k = 1; k <= seg; k++) { const s = k / seg, m = 1 - s; pts.push([m * m * x + 2 * m * s * ax + s * s * ex, m * m * y + 2 * m * s * ay + s * s * ey]); } x = ex; y = ey; break; }
      case 'c': { let ax = num(), ay = num(), bx = num(), by = num(), ex = num(), ey = num(); if (rel) { ax += x; ay += y; bx += x; by += y; ex += x; ey += y; } for (let k = 1; k <= seg; k++) { const s = k / seg, m = 1 - s; pts.push([m * m * m * x + 3 * m * m * s * ax + 3 * m * s * s * bx + s * s * s * ex, m * m * m * y + 3 * m * m * s * ay + 3 * m * s * s * by + s * s * s * ey]); } x = ex; y = ey; break; }
      case 'z': pts.push(pts[0].slice()); break;
      default: i++;
    }
  }
  return pts;
}
// Le logo du badge : un « c » ouvert, sa barre, le trait rouge (badgeCard.ts, LOGO), sur 32 unités.
const LOGO = { c: svgPoly('M22 11.5q-2.5-3-6.5-2.2-5 1-5.2 6.5-.2 5 4.2 6.5 4.3 1.5 7.6-1.4'), bar: svgPoly('M16.2 6q.7 8-.6 20'), red: svgPoly('M6 22.5C13 18.5 19 15 26.5 10') };
function tile(ctx, cx, cy, size, { pc = 1, pbar = 1, pred = 1, rot = 0, s = 1, glyphS = 1 } = {}) {
  if (size <= 0) return;
  const u = size / 32;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = LOGO_HI; ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, 7 * u); ctx.fill();
  ctx.scale(u * glyphS, u * glyphS); ctx.translate(-16, -16);
  stroke(ctx, LOGO.c, { w: 3.2, color: LOGO_INK, p: pc });
  stroke(ctx, LOGO.bar, { w: 2.3, color: LOGO_INK, p: pbar });
  stroke(ctx, LOGO.red, { w: 2.8, color: LOGO_RED, p: pred });
  ctx.restore();
}

// ---------- texte ----------
const F = { hand: (s) => `700 ${s}px Caveat`, bold: (s) => `700 ${s}px Atkinson`, body: (s) => `400 ${s}px Atkinson`, mono: (s) => `500 ${s}px Plex` };
let MC; const mcache = new Map();
function xs(font, str) {
  const key = font + '|' + str; let v = mcache.get(key); if (v) return v;
  MC.font = font; v = []; for (let i = 0; i <= str.length; i++) v.push(MC.measureText(str.slice(0, i)).width);
  mcache.set(key, v); return v;
}
const tw = (font, str) => { const v = xs(font, str); return v[v.length - 1]; };
// Texte lettre par lettre : anim(i) rend {a, dx, dy, s, sx, sy, r, color} ou null (lettre cachée).
function text(ctx, str, x, y, font, color, align = 'left', anim = null, alpha = 1) {
  if (alpha <= 0) return 0;
  const v = xs(font, str), w = v[v.length - 1];
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.globalAlpha *= alpha;
  if (!anim) { ctx.fillText(str, x0, y); ctx.restore(); return w; }
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]; if (ch === ' ') continue;
    const a = anim(i); if (!a || (a.a ?? 1) <= 0) continue;
    const cw = v[i + 1] - v[i], cx = x0 + v[i] + cw / 2;
    ctx.save(); ctx.globalAlpha *= a.a ?? 1; ctx.translate(cx + (a.dx || 0), y + (a.dy || 0)); ctx.rotate(a.r || 0);
    ctx.scale(a.sx ?? a.s ?? 1, a.sy ?? a.s ?? 1); if (a.color) ctx.fillStyle = a.color; ctx.fillText(ch, -cw / 2, 0); ctx.restore();
  }
  ctx.restore(); return w;
}
// Une lettre qui saute en place : monte, pivote, rebondit sur un ressort.
function popChar(t, t0, i, o = {}) {
  const { dy = 38, rot = 0.35, f = 2.6, z = 0.46, s0 = 0.35 } = o;
  const s = sp(t, t0, f, z); if (s <= 0) return null;
  return { a: clamp(s * 2.2), dy: (1 - s) * dy, s: s0 + (1 - s0) * s, r: (1 - s) * rot * (rnd(i, 17) - 0.5) * 2 };
}
const popIn = (t, t0, st = 0.03, o) => (i) => popChar(t, t0 + i * st, i, o);
// Mot par mot : times[k] = départ du k-ième mot.
function wordsIn(t, str, times, st = 0.028, o) {
  const idx = []; let w = 0, k = 0;
  for (let i = 0; i < str.length; i++) { if (str[i] === ' ') { w++; k = 0; idx.push(null); } else idx.push([w, k++]); }
  return (i) => { const q = idx[i]; if (!q || times[q[0]] == null) return null; return popChar(t, times[q[0]] + q[1] * st, i, o); };
}

// ---------- surfaces ----------
let LAYER, SPECK; const dotPat = new Map();
function withLayer(ctx, draw) {
  const L = LAYER; L.setTransform(1, 0, 0, 1, 0, 0); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, W, H);
  L.setTransform(ctx.getTransform()); draw(L);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, 0, 0); ctx.restore();
}
// Un tampon rouge à double trait, encre irrégulière, fond papier (le « 0 € gagné » de la fiche).
function stamp(ctx, str, cx, cy, size, { rot = -0.12, sx = 1, sy = 1, s = 1, alpha = 1, color = P.red, bg = P.paper, seed = 3 } = {}) {
  if (alpha <= 0 || s <= 0) return;
  const f = F.hand(size), w = tw(f, str) + size * 0.95, h = size * 1.42;
  ctx.save(); ctx.globalAlpha *= alpha;
  withLayer(ctx, (L) => {
    L.translate(cx, cy); L.rotate(rot); L.scale(sx * s, sy * s);
    const outer = skPts(-w / 2, -h / 2, w, h, 'chip', size / 24, seed, size * 0.018);
    const inner = skPts(-w / 2 + size * 0.15, -h / 2 + size * 0.15, w - size * 0.3, h - size * 0.3, 'chip', size / 30, seed + 5, size * 0.014);
    stroke(L, outer, { w: size * 0.08, color });
    stroke(L, inner, { w: size * 0.042, color });
    // le zéro de Caveat est ouvert en haut : à petite taille on lit « $C ». On le trace à la main, fermé.
    L.font = f; L.fillStyle = color; L.textBaseline = 'alphabetic'; L.textAlign = 'left';
    const v = xs(f, str); let x0 = -v[v.length - 1] / 2;
    str.split('').forEach((ch, i) => {
      const cw = v[i + 1] - v[i];
      if (ch !== '0') { L.fillText(ch, x0 + v[i], size * 0.34); return; }
      const cx0 = x0 + v[i] + cw / 2, cy0 = size * 0.34 - size * 0.3, ov = [];
      for (let k = 0; k <= 40; k++) { const a = -2.2 + (k / 40) * Math.PI * 2.15; ov.push([cx0 + Math.cos(a) * cw * 0.34 * (1 + k / 400), cy0 + Math.sin(a) * size * 0.3]); }
      stroke(L, ov, { w: size * 0.1, color });
    });
    L.globalCompositeOperation = 'destination-out'; L.fillStyle = SPECK; L.fillRect(-w, -h, w * 2, h * 2);
    L.globalCompositeOperation = 'destination-over'; tracePart(L, outer); L.fillStyle = bg; L.fill();
  });
  ctx.restore();
}
function highlight(ctx, x, y, w, h, p = 1, seed = 1, color = P.hi, alpha = 1) {
  if (p <= 0 || alpha <= 0) return;
  const x1 = x + w * clamp(p), top = [], bot = [];
  const n = Math.max(2, Math.ceil((x1 - x) / 24));
  for (let i = 0; i <= n; i++) { const xx = lerp(x, x1, i / n); top.push([xx, y + noise(xx / 90, seed) * h * 0.06 - (i / n) * h * 0.05]); bot.push([xx, y + h + noise(xx / 80, seed + 9) * h * 0.06 - (i / n) * h * 0.02]); }
  const pts = top.concat([[x1 + h * 0.08, y + h * 0.45]], bot.reverse(), [[x - h * 0.06, y + h * 0.55]]);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'multiply'; tracePart(ctx, closed(pts)); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function drawBG(ctx, pal = P, dots = 1) {
  const inv = ctx.getTransform().inverse();
  const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
  const x0 = Math.min(...cs.map((p) => p.x)) - 4, x1 = Math.max(...cs.map((p) => p.x)) + 4;
  const y0 = Math.min(...cs.map((p) => p.y)) - 4, y1 = Math.max(...cs.map((p) => p.y)) + 4;
  ctx.fillStyle = pal.paper; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (pal.lines) {
    ctx.save(); ctx.strokeStyle = pal.lines; ctx.globalAlpha *= 0.6; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let yy = Math.floor(y0 / 54) * 54 + 27; yy < y1; yy += 54) { ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); }
    ctx.stroke(); ctx.strokeStyle = pal.red; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(150, y0); ctx.lineTo(150, y1); ctx.stroke(); ctx.restore();
  }
  if (dots > 0 && !pal.lines) {
    let pat = dotPat.get(pal.dot);
    if (!pat) { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.fillStyle = pal.dot; g.beginPath(); g.arc(24, 24, 2.2, 0, Math.PI * 2); g.fill(); pat = ctx.createPattern(c, 'repeat'); dotPat.set(pal.dot, pat); }
    ctx.save(); ctx.globalAlpha *= dots; ctx.fillStyle = pat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }
}
function setCam(ctx, c) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(W / 2, H / 2); ctx.rotate(c.r || 0); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y); }
const CURSOR = closed([[0, 0], [0, 46], [11, 35], [19, 54], [27, 50], [19, 32], [34, 32]]);
function cursor(ctx, x, y, s = 1.6, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= alpha;
  const pts = wob(resample(CURSOR, 3), 400 + BOIL, 0.45, 1 / 12);
  fillPts(ctx, pts, P.paper); stroke(ctx, pts, { w: 3, color: P.ink }); ctx.restore();
}
// Des éclats de clic : de petits traits qui partent en étoile.
function burst(ctx, cx, cy, t, t0, { n = 10, r0 = 60, r1 = 150, len = 34, ry = 1, color = P.ink, w = 4, seed = 1 } = {}) {
  const q = prog(t, t0, t0 + 0.32); if (q <= 0 || q >= 1) return;
  const e = E.out3(q);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(i, seed) * 0.4, r = lerp(r0, r1, e), l = len * (1 - e);
    const c = Math.cos(a), s = Math.sin(a) * ry;
    stroke(ctx, [[cx + c * r, cy + s * r], [cx + c * (r + l), cy + s * (r + l)]], { w, color });
  }
}

// =====================================================================
// 1. Le compteur de revenus : les rouleaux s'arrêtent tous sur zéro, le tampon tombe, on plonge dans le zéro.
// =====================================================================
const S1 = { box: { x: 480, y: 318, w: 960, h: 334 }, size: 224, TF: 1.58 };
S1.cw = S1.size * 0.6; S1.cy = S1.box.y + S1.box.h / 2; S1.base = S1.cy + 0.35 * S1.size; S1.x0 = 960 - 3 * S1.cw;
S1.land = (i) => 1.02 + i * 0.1;
S1.target = (i) => 30 + i * 10 + 10 * (i % 2);
function reelPos(i, t) {
  const L = S1.land(i), T = S1.target(i);
  if (t < L) return T - 24 * Math.pow(L - Math.max(t, 0.2), 2.4);
  const x = t - L; return T + 0.24 * Math.sin(x * 26) * Math.exp(-x * 15);
}
const S1gs = (t) => lerp(1, 1.2, sp(t, 1.68, 2.0, 0.55)); // le « $0 » se resserre et grossit
function zeroHole() { const gs = 1.2; return { x: 960 + gs * (S1.cw / 2), y: S1.cy }; }
function s1(ctx, t) {
  const { size, cw, cy, base, x0, TF } = S1, B = S1.box;
  const zt = prog(t, 3.2, 4.0), hole = zeroHole(), k = E.io3(prog(t, 2.9, 3.75));
  const z = lerp(1.07, 1, E.out3(prog(t, 0, 2.3))) * Math.exp(Math.log(95) * E.inExpo(zt));
  const [shx, shy, shr] = shake(t, 2.0, 18, 0.55);
  setCam(ctx, { x: lerp(960, hole.x, k) - shx, y: lerp(540, hole.y, k) - shy, z, r: 0.3 * E.inExpo(zt) + shr + noise(t * 0.5, 4) * 0.002 });
  drawBG(ctx, LIGHT, clamp(2.2 - z));

  // étiquette tapée à la machine
  const lab = 'REVENUE';
  const nl = Math.floor(prog(t, 0.14, 0.44) * lab.length);
  ctx.save(); ctx.letterSpacing = '9px'; text(ctx, lab.slice(0, nl), B.x + 6, B.y - 30, F.mono(30), P.pencil); ctx.restore();
  text(ctx, 'your-app · 11 months', B.x + B.w - 4, B.y - 30, F.hand(40), P.pencil, 'right', popIn(t, 0.42, 0.012, { dy: 16 }));

  box(ctx, B.x, B.y, B.w, B.h, { k: 1.5, seed: 11 + (t >= 2 ? 3 : 0), p: E.out3(prog(t, 0.04, 0.5)), lw: 4.5, fill: P.paper, fillA: 1 });

  // les rouleaux
  const gs = S1gs(t), sl = sp(t, TF + 0.1, 2.1, 0.55);
  const squash = t > 2 ? 0.1 * Math.exp(-(t - 2) * 12) * Math.cos((t - 2) * 40) : 0;
  const reelA = prog(t, 0.22, 0.42);
  ctx.save(); ctx.font = F.mono(size); ctx.fillStyle = P.ink; ctx.textBaseline = 'alphabetic';
  if (t < TF) {
    ctx.globalAlpha = reelA; ctx.fillText('$', x0, base);
    ctx.save(); ctx.beginPath(); ctx.rect(B.x + 8, B.y + 8, B.w - 16, B.h - 16); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const p = reelPos(i, t), k0 = Math.floor(p), fr = p - k0, x = x0 + (i + 1) * cw;
      for (let j = -1; j <= 2; j++) ctx.fillText(String((((k0 + j) % 10) + 10) % 10), x, base + (j - fr) * size * 1.12);
    }
    // l'ombre de la fenêtre du compteur, en haut et en bas
    const g = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.26, 'rgba(255,255,255,0)'); g.addColorStop(0.74, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.globalAlpha = 1 - prog(t, 1.3, 1.55); ctx.fillStyle = g; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.restore();
  } else {
    // les zéros de tête tombent du compteur, le « $ » et le dernier « 0 » se rejoignent
    for (let i = 0; i < 4; i++) {
      const x = t - (TF + i * 0.03); const fx = x0 + (i + 1) * cw + (rnd(i, 3) - 0.5) * 260 * Math.max(0, x);
      const fy = base + (x > 0 ? 260 * x + 0.5 * 7600 * x * x : 0);
      ctx.save(); ctx.translate(fx + cw / 2, fy - size * 0.35); ctx.rotate((rnd(i, 5) - 0.5) * 7 * Math.max(0, x)); ctx.globalAlpha = 1 - prog(x, 0.18, 0.4); ctx.fillText('0', -cw / 2, size * 0.35); ctx.restore();
    }
    ctx.save(); ctx.translate(960, cy); ctx.scale(gs * (1 + squash * 0.6), gs * (1 - squash)); ctx.translate(-960, -cy);
    ctx.fillText('$', lerp(x0, 960 - cw, sl), base); ctx.fillText('0', lerp(x0 + 5 * cw, 960, sl), base);
    ctx.restore();
  }
  ctx.restore();

  // le trou du zéro se remplit de jaune : c'est la porte vers le logo
  const hf = sp(t, 2.92, 2.6, 0.6);
  if (hf > 0) { ctx.save(); ctx.fillStyle = LOGO_HI; ctx.beginPath(); ctx.ellipse(hole.x, hole.y + 2, 36 * gs * hf, 70 * gs * hf, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

  // le tampon
  if (t >= 1.8) {
    const q = E.in3(prog(t, 1.8, 2.0)), x = t - 2;
    const s = t < 2 ? lerp(3.6, 1, q) : 1;
    const sq = x > 0 ? 0.16 * Math.exp(-x * 15) * Math.cos(x * 46) : 0;
    stamp(ctx, '$0 earned', B.x + B.w - 96, B.y + B.h - 26, 70, { rot: -0.17, s, sx: 1 + sq, sy: 1 - sq, alpha: clamp((t - 1.8) / 0.07), seed: 7 });
    if (x > 0 && x < 0.4) {
      const e = E.out3(x / 0.4); ctx.save(); ctx.strokeStyle = P.red; ctx.lineWidth = 4 * (1 - e); ctx.globalAlpha = 0.5 * (1 - e);
      ctx.beginPath(); ctx.ellipse(B.x + B.w - 96, B.y + B.h - 26, 150 + 260 * e, 80 + 150 * e, -0.17, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      for (let j = 0; j < 18; j++) {
        const a = rnd(j, 5) * Math.PI * 2, v = 250 + rnd(j, 6) * 650, r = 70 + v * x;
        ctx.save(); ctx.fillStyle = P.red; ctx.globalAlpha = 1 - x / 0.4; ctx.beginPath();
        ctx.arc(B.x + B.w - 96 + Math.cos(a) * r * 1.5, B.y + B.h - 26 + Math.sin(a) * r, 2 + rnd(j, 7) * 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }
  // la phrase
  const cap = '11 months of work. Not a cent.', cut = cap.indexOf('Not');
  text(ctx, cap, 960, 810, F.hand(86), P.ink, 'center', (i) => {
    const a = i < cut ? popChar(t, 2.22 + i * 0.016, i) : popChar(t, 2.62 + (i - cut) * 0.03, i, { dy: 50, rot: 0.5 });
    if (a && i >= cut) a.color = P.red; return a;
  });
}

// =====================================================================
// Monde A : le logo (x = 0), puis, après un panoramique fouetté, le calendrier, le classement et le premier euro (x = 2400).
// =====================================================================
function camA(t) {
  let x = 960, y = 540, z = 1, r = 0;
  x += 2400 * E.ioExpo(prog(t, 7.62, 8.34));
  z *= 1 + 0.035 * Math.sin(Math.PI * prog(t, 9.5, 13.9));
  const zr = E.io3(prog(t, 19.25, 20.05)); x = lerp(x, 2400 + 730, zr); y = lerp(y, 497, zr); z = lerp(z, 1.75, zr);
  const pt = E.io3(prog(t, 22.18, 22.62)); x = lerp(x, 2400 + 1370, pt); y = lerp(y, 215, pt); z = lerp(z, 1.55, pt);
  const [a, b, c] = shake(t, 21.02, 11, 0.45);
  x += noise(t * 0.55, 1) * 3 - a / z; y += noise(t * 0.55, 2) * 3 - b / z; r += noise(t * 0.4, 3) * 0.0025 + c;
  return { x, y, z, r };
}

// ---------- 2. Le logo ----------
const S2 = { wm: 'Not a Cent', wmS: 214, tileS: 226, gap: 56 };
function s2(ctx, t) {
  const { wm, wmS, tileS, gap } = S2;
  const wmW = tw(F.hand(wmS), wm), groupW = tileS + gap + wmW, left = 960 - groupW / 2;
  // le carré jaune : il remplit l'écran puis se referme en tuile
  const k1 = sp(t, 4.0, 1.3, 0.62), k3 = sp(t, 4.72, 1.9, 0.64);
  const size0 = lerp(2700, 300, k1), size = lerp(size0, tileS, k3);
  const tcx = lerp(960, left + tileS / 2, k3);
  // le groupe remonte en en-tête
  const k2 = sp(t, 5.85, 1.5, 0.74), gy = lerp(540, 196, k2), gsc = lerp(1, 0.44, k2);
  ctx.save(); ctx.translate(960, gy); ctx.scale(gsc, gsc); ctx.translate(-960, -540);
  const gp = sp(t, 4.18, 2.4, 0.45);
  tile(ctx, tcx, 540, size, { pc: E.out3(prog(t, 4.2, 4.4)), pbar: E.out3(prog(t, 4.34, 4.46)), pred: E.out2(prog(t, 4.46, 4.62)), glyphS: 0.4 + 0.6 * gp, rot: (1 - clamp(k1)) * 0.2 });
  const wx = left + tileS + gap, base = 540 + 0.29 * wmS;
  if (t > 4.8) {
    text(ctx, wm, wx, base, F.hand(wmS), P.ink, 'left', popIn(t, 4.84, 0.045, { dy: 70, rot: 0.4 }));
    const v = xs(F.hand(wmS), wm), cx0 = wx + v[6], cx1 = wx + v[10];
    const strike = svgPoly(`M${cx0 - 12} ${base - 0.2 * wmS} Q${(cx0 + cx1) / 2} ${base - 0.3 * wmS} ${cx1 + 16} ${base - 0.43 * wmS}`);
    stroke(ctx, strike, { w: 0.052 * wmS, color: P.red, p: E.out2(prog(t, 5.4, 5.6)) });
  }
  ctx.restore();
  // la phrase du site, mot par mot, le surligneur sous « work »
  if (t > 5.9) {
    const hs = 176, f = F.hand(hs), l1 = 'Verified work.', l2 = 'Not revenue.', b1 = 628, b2 = 822;
    const w1 = tw(f, l1), v1 = xs(f, l1), hx = 960 - w1 / 2 + v1[9];
    highlight(ctx, hx - 16, b1 - 0.56 * hs, v1[13] - v1[9] + 30, 0.62 * hs, E.out3(prog(t, 6.33, 6.6)), 5);
    text(ctx, l1, 960, b1, f, P.ink, 'center', wordsIn(t, l1, [6.0, 6.22], 0.026, { dy: 60, rot: 0.3 }));
    text(ctx, l2, 960, b2, f, P.ink, 'center', wordsIn(t, l2, [6.95, 7.14], 0.026, { dy: 60, rot: 0.3 }));
  }
}

// ---------- 3. Le calendrier ----------
const G = { CELL: 26, GAP: 6, STEP: 32, COLS: 53, ROWS: 7 };
G.X = (1920 - (G.COLS * G.STEP - G.GAP)) / 2; G.Y = 372; G.HT = G.ROWS * G.STEP - G.GAP;
const STREAK0 = 7 * 30 + 2, STREAK = 23, TOTAL = 214;
function runLen(on, d) { let a = d, b = d; while (a > 0 && on[a - 1]) a--; while (b < on.length - 1 && on[b + 1]) b++; return b - a + 1; }
const DAYS = (() => {
  const n = G.COLS * 7, on = new Array(n).fill(false), start = 26;
  for (let d = start; d < n; d++) { const w = Math.floor(d / 7), dow = d % 7; let pr = 0.28 + 0.62 * (0.5 + 0.5 * noise(w * 0.33, 5)); if (dow >= 5) pr *= 0.72; on[d] = rnd(d, 77) < pr; }
  on[start] = true;
  const inS = (d) => d >= STREAK0 - 1 && d <= STREAK0 + STREAK;
  for (let d = STREAK0; d < STREAK0 + STREAK; d++) on[d] = true; on[STREAK0 - 1] = false; on[STREAK0 + STREAK] = false;
  let run = 0; for (let d = 0; d < n; d++) { if (inS(d)) { run = 0; continue; } run = on[d] ? run + 1 : 0; if (run >= 11) { on[d] = false; run = 0; } }
  let count = on.filter(Boolean).length, k = 0;
  while (count > TOTAL) { const d = start + 1 + Math.floor(rnd(k++, 91) * (n - start - 1)); if (on[d] && !inS(d)) { on[d] = false; count--; } }
  while (count < TOTAL) { const d = start + 1 + Math.floor(rnd(k++, 93) * (n - start - 1)); if (!on[d] && !inS(d)) { on[d] = true; if (runLen(on, d) >= 11) on[d] = false; else count++; } }
  return on;
})();
const COLCOUNT = Array.from({ length: G.COLS }, (_, c) => DAYS.slice(c * 7, c * 7 + 7).filter(Boolean).length);
const scanE = (p) => 0.35 * p + 0.65 * p * p;
const colT = (c) => { const x = c / (G.COLS - 1); return 9.72 + (1.75 * (-0.35 + Math.sqrt(0.1225 + 2.6 * x))) / 1.3; };
const cellT = (c, r) => colT(c) + r * 0.012;
const FILLS = []; for (let d = 0; d < DAYS.length; d++) if (DAYS[d]) FILLS.push(cellT(Math.floor(d / 7), d % 7)); FILLS.sort((a, b) => a - b);
const filled = (t) => { let n = 0; while (n < FILLS.length && FILLS[n] <= t) n++; return n; };
const MONTHS = (() => {
  const out = [], start = Date.UTC(2025, 8, 22); let last = -1; const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let c = 0; c < G.COLS; c++) { const d = new Date(start + c * 7 * 86400000); if (d.getUTCMonth() !== last) { last = d.getUTCMonth(); if (c > 0 && c < G.COLS - 2) out.push({ c, label: names[last] }); } }
  return out;
})();
const colDrop = (c) => 13.1 + rnd(c, 3) * 0.09 + c * 0.0025;
// La courbe de la rangée naît des sommets des colonnes empilées.
const ROWX = 170, ROWW = 1580, ROWH = 150, slotY = (k) => 250 + k * 172;
const SPK = { dx: 900, w: 260, dy: 43, h: 64 };
function heroSparkPts(t) {
  const pts = [];
  for (let c = 0; c < G.COLS; c++) {
    const m = COLCOUNT[c];
    const ax = G.X + c * G.STEP + G.CELL / 2, ay = G.Y + (7 - m) * G.STEP - 5;
    const bx = ROWX + SPK.dx + (c * SPK.w) / (G.COLS - 1), by = slotY(2) + SPK.dy + SPK.h - (m / 7) * SPK.h;
    const k = sp(t, 13.8 + c * 0.004, 1.7, 0.74);
    pts.push([lerp(ax, bx, k), lerp(ay, by, k)]);
  }
  return pts;
}
function s3(ctx, t) {
  const out = 1 - prog(t, 13.02, 13.3), outY = 40 * E.in2(prog(t, 13.02, 13.3));
  // le champ du site et son bouton
  const fk = sp(t, 9.05, 1.6, 0.76), fy = lerp(540, 150, fk), fs = lerp(1, 0.6, fk);
  ctx.save(); ctx.globalAlpha *= out; ctx.translate(960, fy + outY); ctx.scale(fs, fs); ctx.translate(-960, -540);
  box(ctx, 410, 470, 1100, 140, { k: 1.5, seed: 21, p: E.out3(prog(t, 7.95, 8.4)), lw: 4, fill: P.paper });
  const url = 'github.com/you/your-app', n = Math.floor(clamp((t - 8.12) / 0.026, 0, url.length));
  const tx = text(ctx, url.slice(0, n), 455, 558, F.body(50), P.ink);
  if (t < 9.0 && (t < 8.8 || Math.floor(t * 3.3) % 2 === 0)) { ctx.fillStyle = P.ink; ctx.fillRect(460 + tx, 516, 3.5, 54); }
  const press = 1 - 0.085 * bump(t, 8.97, 9.14);
  ctx.save(); ctx.translate(1345, 540); ctx.scale(press, press); ctx.translate(-1345, -540);
  box(ctx, 1200, 486, 290, 108, { kind: 'sk2', k: 0.9, seed: 22, p: E.out3(prog(t, 8.05, 8.4)), lw: 4, fill: P.hi, fillA: prog(t, 8.1, 8.3) });
  text(ctx, 'List my app', 1345, 558, F.hand(58), P.hiInk, 'center', null, prog(t, 8.15, 8.3));
  ctx.restore();
  burst(ctx, 1345, 540, t, 9.0, { n: 12, r0: 160, r1: 240, len: 44, ry: 0.55, w: 5, seed: 3 });
  ctx.restore();
  // le curseur
  const cp = E.io3(prog(t, 8.42, 8.92)), cxp = lerp(1640, 1350, cp), cyp = lerp(930, 552, cp) - 70 * Math.sin(Math.PI * cp);
  const leave = E.in2(prog(t, 9.12, 9.45));
  cursor(ctx, cxp + 220 * leave, cyp + 260 * leave, 1.7 * (1 - 0.14 * bump(t, 8.96, 9.1)), prog(t, 8.42, 8.5) * (1 - leave));
  // ce qu'on lit, et ce qu'on ne lit pas
  text(ctx, 'we only read commit dates, never the code', 960, 262 + outY, F.hand(42), P.pencil, 'center', popIn(t, 9.35, 0.01, { dy: 20 }), out);

  // la grille
  const { X, Y, CELL, STEP } = G;
  ctx.save(); ctx.font = F.mono(20); ctx.fillStyle = P.pencil; ctx.globalAlpha *= out * prog(t, 9.3, 9.6);
  for (const m of MONTHS) ctx.fillText(m.label, X + m.c * STEP, Y - 16 + outY); ctx.restore();
  const cellsA = 1 - prog(t, 13.72, 14.0);
  for (let c = 0; c < G.COLS; c++) {
    const on = [], td = colDrop(c);
    for (let r = 0; r < 7; r++) if (DAYS[c * 7 + r]) on.push(r);
    const m = on.length;
    for (let r = 0; r < 7; r++) {
      const d = c * 7 + r, ap = sp(t, 9.12 + c * 0.006 + r * 0.02, 3, 0.55); if (ap <= 0) continue;
      let x = X + c * STEP, y = Y + r * STEP, s = ap;
      if (!DAYS[d]) {
        s *= 1 - E.in2(prog(t, 13.06 + c * 0.003, 13.24 + c * 0.003)); if (s <= 0.01) continue;
        ctx.save(); ctx.translate(x + CELL / 2, y + CELL / 2); ctx.scale(s, s); ctx.fillStyle = P.faint; ctx.beginPath(); ctx.roundRect(-CELL / 2, -CELL / 2, CELL, CELL, 6); ctx.fill(); ctx.restore();
        continue;
      }
      const tf = cellT(c, r), isOn = t >= tf;
      if (isOn) {
        const pop = sp(t, tf, 3.4, 0.38); s *= lerp(1.65, 1, pop);
        const j = on.indexOf(r), yTo = Y + (7 - m + j) * STEP; y = lerp(y, yTo, E.outBounce(prog(t, td, td + 0.44)));
      }
      ctx.save(); ctx.globalAlpha *= isOn ? cellsA : 1; ctx.translate(x + CELL / 2, y + CELL / 2); ctx.scale(s, s);
      ctx.beginPath(); ctx.roundRect(-CELL / 2, -CELL / 2, CELL, CELL, 6);
      if (isOn) { ctx.fillStyle = P.hi; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = P.ink; ctx.stroke(); } else { ctx.fillStyle = P.faint; ctx.fill(); }
      ctx.restore();
    }
  }
  // la tête de lecture
  const sa = prog(t, 9.62, 9.74) * (1 - prog(t, 11.45, 11.65));
  if (sa > 0) {
    const sx = X + 52 * STEP * scanE(prog(t, 9.72, 11.47)) + CELL / 2;
    stroke(ctx, wob(resample([[sx, Y - 34], [sx + 3, Y + G.HT + 30]], 10), 70 + BOIL, 1.2, 1 / 30), { w: 4, color: P.red, alpha: sa });
    ctx.save(); ctx.globalAlpha *= sa; ctx.fillStyle = P.red; ctx.beginPath(); ctx.moveTo(sx - 11, Y - 50); ctx.lineTo(sx + 11, Y - 50); ctx.lineTo(sx + 1, Y - 34); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // les chiffres
  const sY = 826 + outY;
  const nDays = filled(t), bumpS = 1 + 0.09 * bump(t, 11.48, 11.76);
  if (t > 9.66) {
    ctx.save(); ctx.globalAlpha *= out * prog(t, 9.66, 9.8);
    const numW = tw(F.mono(140), String(nDays));
    highlight(ctx, X - 14, sY - 92, numW + 30, 94, E.out3(prog(t, 11.5, 11.7)), 8);
    ctx.save(); ctx.translate(X, sY); ctx.scale(bumpS, bumpS); text(ctx, String(nDays), 0, 0, F.mono(140), P.ink); ctx.restore();
    text(ctx, 'active days', X + 4, sY + 66, F.hand(54), P.pencil, 'left', popIn(t, 9.75, 0.02, { dy: 20 }));
    ctx.restore();
  }
  const stat = (x, num, lab, t0) => {
    if (t < t0) return; ctx.save(); ctx.globalAlpha *= out;
    const s = sp(t, t0, 2.4, 0.5); ctx.save(); ctx.translate(x, sY); ctx.scale(s, s); text(ctx, num, 0, 0, F.mono(140), P.ink, 'left', null, clamp(s * 2)); ctx.restore();
    text(ctx, lab, x + 4, sY + 66, F.hand(54), P.pencil, 'left', popIn(t, t0 + 0.06, 0.02, { dy: 20 })); ctx.restore();
  };
  stat(X + 640, '23', 'day streak', 11.84);
  stat(X + 1250, '11', 'months alive', 12.18);
  // le stylo rouge entoure la plus longue série, puis la relie à son chiffre
  const c0 = Math.floor(STREAK0 / 7), c1 = Math.floor((STREAK0 + STREAK - 1) / 7);
  const ex = X + ((c0 + c1 + 1) * STEP) / 2 - 3, ey = Y + G.HT / 2, erx = ((c1 - c0 + 1) * STEP) / 2 + 30, ery = G.HT / 2 + 34;
  const loop = []; for (let i = 0; i <= 90; i++) { const a = -1.9 + (i / 90) * Math.PI * 2 * 1.1, rr = 1 + noise(i / 12, 31) * 0.05 + (i / 90) * 0.06; loop.push([ex + Math.cos(a) * erx * rr, ey + Math.sin(a) * ery * rr]); }
  stroke(ctx, wob(loop, 90 + BOIL, 1.2), { w: 5, color: P.red, p: E.io2(prog(t, 11.78, 12.2)), alpha: out });
  const arrow = svgPoly(`M${ex - 40} ${ey + ery + 10} C${ex - 60} ${ey + ery + 60} ${X + 900} ${sY - 150} ${X + 830} ${sY - 108}`);
  stroke(ctx, arrow, { w: 5, color: P.red, p: E.out2(prog(t, 12.08, 12.3)), alpha: out });
  if (t > 12.28) { const e = arrow[arrow.length - 1], a2 = arrow[arrow.length - 4], ang = Math.atan2(e[1] - a2[1], e[0] - a2[0]), hp = E.out2(prog(t, 12.28, 12.36));
    for (const s of [-1, 1]) stroke(ctx, [e, [e[0] - Math.cos(ang + s * 0.55) * 30, e[1] - Math.sin(ang + s * 0.55) * 30]], { w: 5, color: P.red, p: hp, alpha: out }); }
  // la courbe des sommets
  if (t >= 13.5 && t < 13.8) stroke(ctx, heroSparkPts(t), { w: 5, color: P.ink, p: E.io2(prog(t, 13.52, 13.8)) });
}

// ---------- 4. Le classement ----------
function sparkData(seed, shape) {
  return Array.from({ length: G.COLS }, (_, i) => {
    const n = 0.5 + 0.5 * noise(i * 0.28, seed); let v = shape === 'up' ? 1 + (i / 53) * 4 + n * 2.4 : shape === 'burst' ? (i > 34 ? 3 + n * 4 : n * 2) : 2.5 + n * 3.5;
    return clamp(Math.round(v), 0, 7);
  });
}
const ROWS = [
  { name: 'Correspondance', letter: 'C', by: '@meffysto · Swift · Mac · last commit 2 d ago', tag: 'Every messenger, one inbox.', days: 262, sub: '★ 41 · 22 this month', cheers: 48, spark: sparkData(1, 'up'), t0: 14.18, seed: 31 },
  { name: 'Sémaphore', letter: 'S', by: '@lea.dev · TypeScript · Mac · last commit today', tag: 'Real-time signals, without the fan noise.', days: 228, sub: '★ 18 · 25 this month', cheers: 31, spark: sparkData(2, 'steady'), t0: 14.28, seed: 32 },
  { hero: true, name: 'your-app', letter: 'y', by: '@you · Swift · Mac · last commit today', tag: 'Polished for months, one evening at a time.', days: 214, sub: '★ 7 · 19 this month', cheers: 12, spark: COLCOUNT, t0: 13.8, seed: 33 },
  { name: 'Daybard', letter: 'D', by: '@meffysto · Swift · iOS · last commit 4 d ago', tag: 'A quest system that never guilt-trips you.', days: 142, sub: '★ 27 · 12 this month', cheers: 22, spark: sparkData(3, 'burst'), t0: 14.38, seed: 34 },
];
const T_COUNT = [15.45, 16.45], T_SWAP = 15.45 + (15 / 17) * 1.0;
const heroDays = (t) => 214 + Math.floor(17 * prog(t, T_COUNT[0], T_COUNT[1]));
const CHEERS = new Path2D('M7 11V6a2 2 0 1 1 4 0v5M11 10V4a2 2 0 1 1 4 0v6M15 10V6a2 2 0 1 1 4 0v8a7 7 0 0 1-14 0v-2a2 2 0 1 1 4 0');
const HERO_STAMP_X = () => ROWX + 230 + tw(F.bold(40), 'your-app') + 20 + (tw(F.hand(29), '$0 earned') + 29 * 0.95) / 2;
// Le premier euro : le vieux tampon s'envole, la pièce devient le cachet « 1st € ».
const T_COIN = 20.18, T_HIT = 20.7, T_STAMP = 21.0;
function row(ctx, R, t, y, rank, { dx = 0, alpha = 1, lift = 0, rank2 = null, rk = 0 } = {}) {
  if (alpha <= 0) return;
  const x = ROWX + dx, t0 = R.t0, a = (tt) => prog(t, tt, tt + 0.12);
  ctx.save(); ctx.globalAlpha *= alpha;
  if (lift > 0) { ctx.save(); ctx.globalAlpha *= 0.13 * lift; ctx.fillStyle = LIGHT.ink; ctx.filter = 'blur(14px)'; ctx.beginPath(); ctx.roundRect(x + 14, y + 22, ROWW, ROWH, 20); ctx.fill(); ctx.restore(); }
  box(ctx, x, y, ROWW, ROWH, { k: 1.5, seed: R.seed, p: R.hero ? E.io2(prog(t, 13.95, 14.4)) : 1, lw: 3.2, fill: P.paper, fillA: R.hero ? prog(t, 13.95, 14.25) : 1 });
  // rang
  const rankY = y + 98;
  if (rank2 == null) text(ctx, String(rank), x + 62, rankY, F.hand(72), P.pencil, 'center', R.hero ? popIn(t, 14.05, 0) : null);
  else { text(ctx, String(rank), x + 62, rankY - 40 * rk, F.hand(72), P.pencil, 'center', null, 1 - clamp(rk)); text(ctx, String(rank2), x + 62, rankY + 40 * (1 - rk), F.hand(72), P.pencil, 'center', null, clamp(rk)); }
  // la tuile
  const ts = R.hero ? sp(t, 14.1, 2.6, 0.5) : 1;
  ctx.save(); ctx.translate(x + 154, y + 75); ctx.scale(ts, ts);
  box(ctx, -42, -42, 84, 84, { kind: 'sk2', k: 0.35, seed: R.seed + 3, lw: 3, fill: P.paper2, amp: 0.8 });
  text(ctx, R.letter, 0, 16, F.hand(50), P.ink, 'center'); ctx.restore();
  // textes
  const tx = x + 230;
  text(ctx, R.name, tx, y + 60, F.bold(40), P.ink, 'left', R.hero ? popIn(t, 14.12, 0.025, { dy: 20 }) : null);
  text(ctx, R.tag, tx, y + 100, F.body(29), P.ink, 'left', null, R.hero ? a(14.22) : 1);
  text(ctx, R.by, tx, y + 134, F.body(23), P.pencil, 'left', null, R.hero ? a(14.28) : 1);
  // la courbe
  if (R.hero && t < 15.2) { if (t >= 13.8) stroke(ctx, heroSparkPts(t), { w: lerp(5, 3.2, prog(t, 13.8, 14.3)), color: P.ink }); }
  else {
    const pts = R.spark.map((v, i) => [x + SPK.dx + (i * SPK.w) / (G.COLS - 1), y + SPK.dy + SPK.h - (v / 7) * SPK.h]);
    stroke(ctx, pts, { w: 3.2, color: P.ink, p: R.hero ? 1 : E.io2(prog(t, t0 + 0.15, t0 + 0.6)) });
  }
  const endP = R.hero ? prog(t, 14.25, 14.4) : prog(t, t0 + 0.55, t0 + 0.65);
  if (endP > 0) {
    const v = R.spark[R.spark.length - 1], ex = x + SPK.dx + SPK.w, ey = y + SPK.dy + SPK.h - (v / 7) * SPK.h;
    const pulse = R.hero && t > T_COUNT[0] && t < T_COUNT[1] + 0.2 ? 1 + 0.5 * Math.abs(Math.sin((t - T_COUNT[0]) * 17 * Math.PI)) : 1;
    ctx.save(); ctx.translate(ex, ey); ctx.scale(endP * pulse, endP * pulse); ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fillStyle = P.hi; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
  }
  // les jours actifs
  const days = R.hero ? heroDays(t) : Math.round(R.days * E.out3(prog(t, t0 + 0.05, t0 + 0.55)));
  const bumpD = R.hero ? 1 + 0.06 * Math.abs(Math.sin((t - T_COUNT[0]) * 17 * Math.PI)) * (t > T_COUNT[0] && t < T_COUNT[1] ? 1 : 0) : 1;
  ctx.save(); ctx.translate(x + 1400, y + 84); ctx.scale(bumpD, bumpD); text(ctx, String(days), 0, 0, F.mono(66), P.ink, 'right', null, R.hero ? a(14.15) : 1); ctx.restore();
  text(ctx, R.sub, x + 1400, y + 122, F.hand(31), P.pencil, 'right', null, R.hero ? a(14.2) : 1);
  // bravo
  ctx.save(); ctx.globalAlpha *= R.hero ? a(14.3) : 1;
  box(ctx, x + 1446, y + 44, 108, 62, { kind: 'sk2', k: 0.3, seed: R.seed + 7, lw: 3, amp: 0.7 });
  ctx.save(); ctx.translate(x + 1462, y + 58); ctx.scale(1.45, 1.45); ctx.lineWidth = 2; ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(CHEERS); ctx.restore();
  text(ctx, String(R.cheers), x + 1538, y + 87, F.mono(30), P.ink, 'right'); ctx.restore();
  // le tampon du revenu (la rangée de l'app qu'on suit)
  if (R.hero) {
    const sx = x + (HERO_STAMP_X() - ROWX), sy = y + 48;
    const q = E.in3(prog(t, 14.26, 14.38)), sq = t > 14.38 ? 0.14 * Math.exp(-(t - 14.38) * 16) * Math.cos((t - 14.38) * 44) : 0;
    if (t < T_STAMP) stamp(ctx, '$0 earned', sx, sy, 29, { rot: -0.08, s: lerp(2.6, 1, q), sx: 1 + sq, sy: 1 - sq, alpha: prog(t, 14.26, 14.3), seed: 12 });
    else {
      const f = t - T_STAMP; // l'ancien tampon s'envole
      stamp(ctx, '$0 earned', sx + 520 * f, sy - 620 * f + 0.5 * 2600 * f * f, 29, { rot: -0.08 + 7 * f, alpha: 1 - prog(f, 0.45, 0.7), seed: 12 });
      const q2 = E.in3(prog(t, T_STAMP, T_STAMP + 0.08)), f2 = t - (T_STAMP + 0.08), sq2 = f2 > 0 ? 0.18 * Math.exp(-f2 * 14) * Math.cos(f2 * 44) : 0;
      stamp(ctx, '1st €', sx - 22, sy - 2, 30, { rot: -0.14, s: lerp(2.2, 1, q2), sx: 1 + sq2, sy: 1 - sq2, alpha: prog(t, T_STAMP, T_STAMP + 0.03), seed: 14 });
    }
    // la note dans la marge : relu cette nuit
    const na = popIn(t, 15.2, 0.014, { dy: 16, rot: 0.2 }), nOut = 1 - prog(t, 17.0, 17.3);
    if (t > 15.2 && nOut > 0) {
      ctx.save(); ctx.translate(x + 1180, y - 4); ctx.rotate(0.035); ctx.globalAlpha *= nOut;
      const note = 're-read tonight, 3:17 UTC', nw = tw(F.hand(34), note);
      ctx.fillStyle = P.paper; ctx.globalAlpha *= prog(t, 15.2, 15.3); ctx.fillRect(-nw / 2 - 52, -26, nw + 70, 40); ctx.globalAlpha = alpha * nOut;
      const ms = sp(t, 15.2, 2.6, 0.5); ctx.save(); ctx.translate(-nw / 2 - 24, -8); ctx.scale(ms, ms); ctx.fillStyle = P.red; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.paper; ctx.beginPath(); ctx.arc(7, -5, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      text(ctx, note, 8, 4, F.hand(34), P.red, 'center', na); ctx.restore();
    }
  }
  ctx.restore();
}
function tabsGeom() {
  const labels = ['All', 'This month', 'New', 'Racing', 'First euro', 'Done'], f = F.hand(36), pad = 20;
  const ws = labels.map((l) => tw(f, l) + pad * 2), total = ws.reduce((a, b) => a + b, 0);
  let x = 1750 - total; const cells = labels.map((l, i) => { const c = { l, x, w: ws[i] }; x += ws[i]; return c; });
  return { cells, x0: 1750 - total, y: 146, h: 64, f };
}
function tabs(ctx, t, alpha) {
  if (alpha <= 0) return;
  const g = tabsGeom(); ctx.save(); ctx.globalAlpha *= alpha;
  box(ctx, g.x0, g.y, g.cells.reduce((a, c) => a + c.w, 0), g.h, { kind: 'sk2', k: 0.6, seed: 41, lw: 3, p: E.io2(prog(t, 14.1, 14.45)), fill: P.paper });
  const from = g.cells[0], to = g.cells[4];
  const kl = sp(t, 22.64, 2.0, 0.72), kr = sp(t, 22.58, 2.6, 0.66);
  const pl = lerp(from.x, to.x, kl) + 4, pr = lerp(from.x + from.w, to.x + to.w, kr) - 4;
  const lab = (col) => { for (const c of g.cells) text(ctx, c.l, c.x + c.w / 2, g.y + 43, g.f, col, 'center', null, prog(t, 14.2, 14.4)); };
  lab(P.pencil);
  ctx.save(); ctx.beginPath(); ctx.roundRect(pl, g.y + 5, Math.max(0, pr - pl), g.h - 10, 12); ctx.fillStyle = P.ink; ctx.globalAlpha *= prog(t, 14.3, 14.45); ctx.fill(); ctx.clip(); lab(P.paper); ctx.restore();
  text(ctx, 'same rule as before: the work', 1750, 270, F.hand(36), P.red, 'right', popIn(t, 23.0, 0.012, { dy: 16 }));
  ctx.restore();
}
function s4(ctx, t) {
  const fade = 1 - prog(t, 19.3, 19.8), drift = 30 * E.in2(prog(t, 19.3, 19.8));
  text(ctx, 'Not a cent yet', 170, 205 + drift, F.hand(92), P.ink, 'left', popIn(t, 14.02, 0.022, { dy: 34 }), fade);
  tabs(ctx, t, t < 22.0 ? fade : prog(t, 22.1, 22.35));
  const kS = sp(t, T_SWAP, 1.35, 0.7), kc = clamp(kS), arcK = Math.sin(Math.PI * kc);
  const order = [0, 1, 3, 2];
  for (const i of order) {
    const R = ROWS[i]; if (t < R.t0) continue;
    let y = slotY(i), dx = 0, alpha = fade, lift = 0, rank = i + 1, rank2 = null;
    if (!R.hero) { dx = 1500 * (1 - sp(t, R.t0, 1.6, 0.78)); alpha *= clamp((t - R.t0) * 6); y += drift * (i + 1) * 0.5; }
    if (i === 1) { y = lerp(slotY(1), slotY(2), kS) + drift; dx += 26 * arcK; if (t > T_SWAP) { rank = 2; rank2 = 3; } }
    if (R.hero) { y = lerp(slotY(2), slotY(1), kS); dx = -34 * arcK; lift = arcK; alpha = 1; if (t > T_SWAP) { rank = 3; rank2 = 2; } }
    ctx.save();
    if (R.hero && arcK > 0) { const cx = ROWX + ROWW / 2, cy = y + ROWH / 2, s = 1 + 0.03 * arcK; ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); }
    row(ctx, R, t, y, rank, { dx, alpha, lift, rank2, rk: kc });
    ctx.restore();
  }
  // la règle du cahier
  const rf = F.hand(58), rl = 'MRR, ARR, churn', rv = xs(rf, rl), ry = 1004 + drift;
  text(ctx, rl, 170, ry, rf, P.pencil, 'left', popIn(t, 17.12, 0.018, { dy: 20 }), fade);
  [[0, 3, 17.45], [5, 8, 17.7], [10, 15, 17.95]].forEach(([a, b, t0], j) => {
    stroke(ctx, svgPoly(`M${170 + rv[a] - 6} ${ry - 17} Q${170 + (rv[a] + rv[b]) / 2} ${ry - 24} ${170 + rv[b] + 8} ${ry - 29}`), { w: 5.5, color: P.red, p: E.out2(prog(t, t0, t0 + 0.12)), alpha: fade });
  });
  text(ctx, "zero, that's the rule.", 170 + rv[15] + 34, ry, rf, P.red, 'left', popIn(t, 18.2, 0.018, { dy: 26, rot: 0.4 }), fade);
  // le premier euro
  s5(ctx, t);
}

// ---------- 5. Le premier euro ----------
function coin(ctx, x, y, r, { spin = 0, sx = 1, sy = 1 } = {}) {
  const c = Math.cos(spin), face = c >= 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.06, Math.abs(c)) * sx, sy);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = face ? LOGO_HI : '#F2D23A'; ctx.fill();
  ctx.lineWidth = r * 0.09; ctx.strokeStyle = P.ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2); ctx.lineWidth = r * 0.04; ctx.stroke();
  if (face) { ctx.font = F.hand(r * 1.15); ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.fillText('€', 0, r * 0.38); }
  ctx.restore();
}
function s5(ctx, t) {
  if (t < T_COIN) return;
  const hy = slotY(1), sx = HERO_STAMP_X(), sy = hy + 48, R = 50;
  if (t < T_STAMP + 0.06) {
    let x = sx, y, spin, sxx = 1, syy = 1, s = 1;
    if (t < T_HIT) { const q = prog(t, T_COIN, T_HIT); y = lerp(hy - 380, hy - R, E.in2(q)); spin = q * 3 * Math.PI; }
    else { const q = prog(t, T_HIT, T_STAMP); y = lerp(hy - R, sy, q) - 170 * 4 * q * (1 - q); x = sx - 60 * (1 - q); spin = q * 2 * Math.PI; s = 1 + 0.25 * q;
      const f = t - T_HIT; const sq = 0.22 * Math.exp(-f * 22) * Math.cos(f * 50); sxx = 1 + sq; syy = 1 - sq; }
    if (t > T_STAMP) { s *= lerp(1.25, 0.4, prog(t, T_STAMP, T_STAMP + 0.06)); }
    ctx.save(); ctx.globalAlpha *= 1 - prog(t, T_STAMP, T_STAMP + 0.06); coin(ctx, x, y, R * s, { spin, sx: sxx, sy: syy }); ctx.restore();
    // la poussière au contact
    const f = t - T_HIT; if (f > 0 && f < 0.3) for (const sg of [-1, 1]) for (let j = 0; j < 3; j++) stroke(ctx, [[sx + sg * (40 + f * 300 + j * 10), hy - 6 - j * 12], [sx + sg * (58 + f * 380 + j * 14), hy - 14 - j * 16]], { w: 4, color: P.ink, alpha: 1 - f / 0.3 });
  }
  // la phrase
  const cf = F.hand(60), cl = 'First euro? A milestone, not an exit.', cv = xs(cf, cl), cx = 400, cyb = 666;
  const cA = 1 - prog(t, 23.2, 23.4);
  text(ctx, cl, cx, cyb, cf, P.ink, 'left', popIn(t, 21.3, 0.016, { dy: 26 }), cA);
  const u0 = cl.indexOf('not'), u1 = cl.length - 1;
  const und = []; for (let i = 0; i <= 40; i++) { const xx = lerp(cx + cv[u0] - 4, cx + cv[u1] + 6, i / 40); und.push([xx, cyb + 16 + Math.sin(i * 0.9) * 4]); }
  stroke(ctx, und, { w: 5, color: P.red, p: E.out2(prog(t, 21.95, 22.15)), alpha: cA });
}

// ---------- le coup de surligneur qui balaie tout ----------
function markerWipe(ctx, t) {
  const a = E.io2(prog(t, 23.28, 23.76)), b = E.io2(prog(t, 23.94, 24.38));
  if (a <= 0 || b >= 1) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(960, 540); ctx.rotate(-0.24);
  const lo = -1700, hi = 1700, x1 = lerp(lo, hi, a), x0 = lerp(lo, hi, b), top = -1150, bot = 1150;
  const edge = (xx, seed, dir) => { const pts = []; for (let i = 0; i <= 46; i++) { const y = lerp(top, bot, i / 46); pts.push([xx + dir * (noise(y / 60, seed) * 22 + Math.abs(y) * 0.05), y]); } return pts; };
  const R = edge(x1, 3, 1), L = edge(x0, 5, -1).reverse();
  tracePart(ctx, closed(R.concat(L))); ctx.fillStyle = LOGO_HI; ctx.fill(); ctx.clip();
  ctx.globalAlpha = 0.45; ctx.fillStyle = '#F4D53C';
  for (let k = 0; k < 44; k++) { const y = top + k * 53 + rnd(k, 8) * 30; ctx.fillRect(x0 - 60, y, x1 - x0 + 120, 3 + rnd(k, 9) * 9); }
  ctx.restore();
}

// =====================================================================
// Monde B : le badge (trois thèmes), puis la fin.
// =====================================================================
const BS = 4.4, BW = 256 * BS, BH = 54 * BS, BX = 960 - BW / 2, BY = 452 - BH / 2;
const u = (v) => v * BS;
const THEMES = [[-1, LIGHT], [25.1, DARK], [25.7, PAPER], [26.3, LIGHT]], WIPE = 0.42;
const TILE_B = { x: BX + u(27), y: BY + u(27), s: u(32) };
const BREAK = 26.74;
function badge(ctx, t, pal) {
  const days = Math.round(231 * E.out3(prog(t, 24.45, 24.95)));
  const brk = t - BREAK, fall = (seed) => (brk > 0 ? { dy: -240 * brk + 2900 * brk * brk, r: (rnd(seed, 2) - 0.3) * 1.6 * brk, a: 1 - prog(brk, 0.35, 0.55) } : { dy: 0, r: 0, a: 1 });
  // la carte
  const f1 = fall(1);
  if (f1.a > 0) {
    ctx.save(); ctx.globalAlpha *= f1.a; ctx.translate(BX + BW / 2, BY + BH / 2 + f1.dy); ctx.rotate(f1.r); ctx.translate(-BX - BW / 2, -BY - BH / 2);
    const fr = skPts(BX, BY, BW, BH, 'badge', BS, 51, 1.2, 0.012);
    fillPts(ctx, fr, pal.paper, prog(t, 23.95, 24.2));
    if (pal.lines) { ctx.save(); tracePart(ctx, fr); ctx.clip(); ctx.strokeStyle = pal.lines; ctx.globalAlpha *= 0.55; ctx.lineWidth = u(0.8); ctx.beginPath(); for (const yy of [16.5, 27.5, 38.5]) { ctx.moveTo(BX + u(6), BY + u(yy)); ctx.lineTo(BX + u(250), BY + u(yy)); } ctx.stroke(); ctx.restore(); }
    stroke(ctx, fr, { w: u(2) * 0.8, color: pal.ink, p: E.io2(prog(t, 23.95, 24.4)) });
    ctx.save(); ctx.letterSpacing = `${u(1.3)}px`; const kick = 'VERIFIED ON', nk = Math.floor(prog(t, 24.2, 24.42) * kick.length);
    text(ctx, kick.slice(0, nk), BX + u(55), BY + u(19.5), F.bold(u(8.5)), pal.soft); ctx.restore();
    const wmf = F.hand(u(22)), wx = BX + u(54), wb = BY + u(42);
    text(ctx, 'Not a Cent', wx, wb, wmf, pal.ink, 'left', popIn(t, 24.26, 0.03, { dy: 40 }));
    const v = xs(wmf, 'Not a Cent'), c0 = wx + v[6], c1 = wx + v[10];
    stroke(ctx, svgPoly(`M${c0 - u(1)} ${BY + u(36.5)} Q${(c0 + c1) / 2} ${BY + u(33.5)} ${c1 + u(1.5)} ${BY + u(30)}`), { w: u(2.3), color: pal.red, p: E.out2(prog(t, 24.52, 24.66)) });
    stroke(ctx, svgPoly(`M${BX + u(178.5)} ${BY + u(12)} Q${BX + u(177.4)} ${BY + u(27)} ${BX + u(178.8)} ${BY + u(42)}`), { w: u(1.3), color: pal.ink, alpha: 0.3, p: E.out2(prog(t, 24.36, 24.5)) });
    ctx.restore();
  }
  // le compteur (il se détache et tombe à part)
  const f2 = fall(2);
  if (f2.a > 0 && t > 24.4) {
    ctx.save(); ctx.globalAlpha *= f2.a; const ccx = BX + u(215), ccy = BY + u(30);
    ctx.translate(ccx + 140 * Math.max(0, brk), ccy + f2.dy * 1.1); ctx.rotate(-f2.r * 1.4); ctx.translate(-ccx, -ccy);
    const df = F.hand(u(25)), n = String(days), total = tw(df, n), mw = Math.max(total + u(12), u(34)), mx = BX + u(215) - mw / 2;
    const mp = E.out3(prog(t, 24.42, 24.6));
    ctx.save(); ctx.beginPath(); ctx.rect(mx - 10, BY, (mw + 20) * mp, BH); ctx.clip();
    fillPts(ctx, closed([[mx, BY + u(17)], [mx + mw / 2, BY + u(15.4)], [mx + mw, BY + u(16.6)], [mx + mw - u(0.6), BY + u(33.2)], [mx + u(0.4), BY + u(33.6)]]), LOGO_HI); ctx.restore();
    text(ctx, n, BX + u(215), BY + u(34), df, LOGO_INK, 'center');
    text(ctx, 'active days', BX + u(215), BY + u(45.5), F.bold(u(8.5)), pal.soft, 'center', null, prog(t, 24.6, 24.75));
    ctx.restore();
  }
  // la tuile (elle part vers la fin)
  const tk = sp(t, BREAK - 0.02, 1.55, 0.66);
  const end = endGeom();
  const ts = sp(t, 24.04, 2.6, 0.5);
  tile(ctx, lerp(TILE_B.x, end.tx, tk), lerp(TILE_B.y, end.ty, tk), lerp(TILE_B.s, end.ts, tk), { s: ts, rot: 0.25 * Math.sin(Math.PI * clamp(tk)), pc: E.out3(prog(t, 24.12, 24.3)), pbar: E.out3(prog(t, 24.24, 24.32)), pred: E.out2(prog(t, 24.32, 24.44)) });
}
function endGeom() {
  const tsz = 188, wmS = 176, gap = 48, wmW = tw(F.hand(wmS), 'Not a Cent'), gw = tsz + gap + wmW, left = 960 - gw / 2;
  return { tx: left + tsz / 2, ty: 360, ts: tsz, wx: left + tsz + gap, wb: 360 + 0.29 * wmS, wmS };
}
function worldB(ctx, t, pal) {
  const saved = P; P = pal;
  drawBG(ctx, pal, 1);
  badge(ctx, t, pal);
  const out = 1 - prog(t, 26.7, 26.95), od = 50 * E.in2(prog(t, 26.7, 26.95));
  // l'URL du badge, et le thème qui change dans l'URL
  const uf = F.mono(31), base = 'notacent.app/api/badge/your-app.svg?theme=', nU = Math.floor(clamp((t - 24.55) / 0.008, 0, base.length));
  if (t > 24.55 && out > 0) {
    ctx.save(); ctx.globalAlpha *= out;
    const words = ['light', 'dark', 'paper', 'light'], full = tw(uf, base + 'paper'), x0 = 960 - full / 2, y0 = 712 + od;
    text(ctx, base.slice(0, nU), x0, y0, uf, pal.pencil);
    if (nU >= base.length) {
      const bx = x0 + tw(uf, base);
      ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, y0 - 40, 200, 56); ctx.clip();
      let k = 0; for (let i = 1; i < THEMES.length; i++) if (t >= THEMES[i][0]) k = i;
      const q = k > 0 ? E.out3(prog(t, THEMES[k][0], THEMES[k][0] + 0.28)) : 1;
      text(ctx, words[k], bx, y0 + (1 - q) * 44, uf, pal.red, 'left', null, q);
      if (k > 0) text(ctx, words[k - 1], bx, y0 - q * 44, uf, pal.red, 'left', null, 1 - q);
      ctx.restore();
    }
    ctx.restore();
  }
  text(ctx, 'A badge that updates itself.', 960, 858 + od, F.hand(76), pal.ink, 'center', popIn(t, 24.92, 0.018, { dy: 30 }), out);
  if (t > 26.7) endCard(ctx, t);
  P = saved;
}
function endCard(ctx, t) {
  const g = endGeom();
  text(ctx, 'Not a Cent', g.wx, g.wb, F.hand(g.wmS), P.ink, 'left', popIn(t, 26.95, 0.032, { dy: 60, rot: 0.4 }));
  const v = xs(F.hand(g.wmS), 'Not a Cent'), c0 = g.wx + v[6], c1 = g.wx + v[10];
  stroke(ctx, svgPoly(`M${c0 - 12} ${g.wb - 0.2 * g.wmS} Q${(c0 + c1) / 2} ${g.wb - 0.3 * g.wmS} ${c1 + 16} ${g.wb - 0.43 * g.wmS}`), { w: 0.052 * g.wmS, color: P.red, p: E.out2(prog(t, 27.34, 27.52)) });
  text(ctx, "Apps that haven't made a cent yet.", 960, 606, F.hand(66), P.ink, 'center', popIn(t, 27.56, 0.012, { dy: 24 }));
  text(ctx, "Being listed doesn't cost one either.", 960, 688, F.hand(66), P.pencil, 'center', popIn(t, 27.8, 0.012, { dy: 24 }));
  // l'adresse, dans le champ du site
  const fk = sp(t, 27.96, 1.9, 0.62); if (fk <= 0) return;
  const press = 1 - 0.085 * bump(t, 28.92, 29.1);
  ctx.save(); ctx.globalAlpha *= clamp(fk * 3); ctx.translate(0, (1 - fk) * 220);
  box(ctx, 540, 770, 840, 124, { k: 1.4, seed: 61, lw: 4, fill: P.paper });
  text(ctx, 'notacent.app', 590, 853, F.mono(56), P.ink);
  ctx.save(); ctx.translate(1235, 832); ctx.scale(press, press); ctx.translate(-1235, -832);
  box(ctx, 1104, 784, 262, 96, { kind: 'sk2', k: 0.85, seed: 62, lw: 4, fill: P.hi });
  text(ctx, 'List my app', 1235, 850, F.hand(54), P.hiInk, 'center'); ctx.restore();
  ctx.restore();
  burst(ctx, 1235, 832, t, 28.96, { n: 14, r0: 150, r1: 250, len: 46, ry: 0.6, w: 5, seed: 9, color: P.ink });
  burst(ctx, 1235, 832, t, 29.02, { n: 9, r0: 110, r1: 330, len: 30, ry: 0.8, w: 5, seed: 4, color: P.red });
  const cp = E.io3(prog(t, 28.36, 28.88)), leave = E.in2(prog(t, 29.2, 29.6));
  cursor(ctx, lerp(1640, 1242, cp) + 180 * leave, lerp(1060, 842, cp) - 60 * Math.sin(Math.PI * cp) + 200 * leave, 1.7 * (1 - 0.14 * bump(t, 28.9, 29.04)), prog(t, 28.36, 28.44) * (1 - leave));
}
function camB(t) { return { x: 960 + noise(t * 0.5, 7) * 3, y: 540 + noise(t * 0.5, 8) * 3, z: 1 + 0.03 * E.io2(prog(t, 27.0, 30)), r: noise(t * 0.4, 9) * 0.002 }; }
function sceneB(ctx, t) {
  setCam(ctx, camB(t));
  let k = 0; for (let i = 1; i < THEMES.length; i++) if (t >= THEMES[i][0]) k = i;
  const inWipe = k > 0 && t < THEMES[k][0] + WIPE;
  worldB(ctx, t, inWipe ? THEMES[k - 1][1] : THEMES[k][1]);
  if (inWipe) {
    const r = 2400 * E.io3(prog(t, THEMES[k][0], THEMES[k][0] + WIPE));
    ctx.save(); ctx.beginPath(); ctx.arc(TILE_B.x, TILE_B.y, r, 0, Math.PI * 2); ctx.clip(); worldB(ctx, t, THEMES[k][1]); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(TILE_B.x, TILE_B.y, r, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = THEMES[k][1].red; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.restore();
  }
}

// =====================================================================
function sceneA(ctx, t) {
  setCam(ctx, camA(t)); drawBG(ctx, LIGHT, 1);
  if (t < 8.4) s2(ctx, t);
  if (t > 7.8) { ctx.save(); ctx.translate(2400, 0); if (t < 14.1) s3(ctx, t); if (t > 13.8) s4(ctx, t); ctx.restore(); }
}
function renderAt(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  P = LIGHT;
  if (t < 4.0) s1(ctx, t);
  else if (t < 23.85) sceneA(ctx, t);
  else sceneB(ctx, t);
  markerWipe(ctx, t);
}
const FAST = [[0.25, 1.65], [1.55, 2.12], [3.2, 4.12], [7.6, 8.4], [13.05, 14.45], [16.3, 16.95], [19.2, 20.1], [20.15, 21.3], [22.15, 22.7], [23.25, 24.42], [26.7, 27.45]];
const ULTRA = [[3.5, 4.03], [7.72, 8.22], [23.3, 24.4], [25.1, 25.55], [25.7, 26.15], [26.3, 26.75]];
const samplesAt = (t) => (ULTRA.some(([a, b]) => t >= a && t <= b) ? 40 : FAST.some(([a, b]) => t >= a && t <= b) ? 12 : 4);

// ---------- les repères sonores ----------
function buildCues() {
  const C = []; const cue = (t, type, o = {}) => C.push({ t: +t.toFixed(4), type, ...o });
  // 1
  for (let i = 0; i < 7; i++) cue(0.14 + (i * 0.3) / 7, 'key', { g: 0.5 });
  cue(0.04, 'pencil', { d: 0.46 });
  for (const i of [4, 2]) { let last = Math.floor(reelPos(i, 0.2)); for (let t = 0.2; t < S1.land(i); t += 0.001) { const f = Math.floor(reelPos(i, t)); if (f !== last) { cue(t, 'tick', { g: i === 4 ? 0.55 : 0.35, p: 1 + i * 0.05 }); last = f; } } }
  for (let i = 0; i < 5; i++) cue(S1.land(i), 'clunk', { p: 1 + i * 0.06 });
  cue(S1.TF, 'drop'); cue(1.64, 'slide');
  cue(1.8, 'fallwhistle', { d: 0.2 }); cue(2.0, 'slam', { g: 1 });
  cue(2.22, 'pops', { n: 18, d: 0.3 }); cue(2.62, 'pops', { n: 11, d: 0.33, p: 1.3 });
  cue(2.92, 'blip', { p: 1.5 }); cue(3.1, 'riser', { d: 0.9 });
  // 2
  cue(4.0, 'boom'); cue(4.18, 'blip', { p: 1 }); cue(4.2, 'marker', { d: 0.42, g: 0.5 });
  cue(4.72, 'slide'); cue(4.84, 'pops', { n: 9, d: 0.4 }); cue(5.4, 'pen', { d: 0.2 });
  cue(5.85, 'whoosh', { d: 0.4, g: 0.5 });
  cue(6.0, 'pops', { n: 8, d: 0.2 }); cue(6.22, 'pops', { n: 5, d: 0.13 }); cue(6.33, 'marker', { d: 0.27 });
  cue(6.95, 'pops', { n: 3, d: 0.08 }); cue(7.14, 'pops', { n: 8, d: 0.2 });
  cue(7.62, 'whip', { d: 0.72 });
  // 3
  for (let i = 0; i < 23; i++) cue(8.12 + i * 0.026, 'key', { g: 0.6 });
  cue(8.42, 'whoosh', { d: 0.5, g: 0.25 }); cue(9.0, 'click'); cue(9.05, 'whoosh', { d: 0.45, g: 0.4 });
  cue(9.12, 'shimmer', { d: 0.5 });
  for (let c = 0; c < G.COLS; c++) if (COLCOUNT[c]) cue(colT(c), 'fill', { g: 0.25 + COLCOUNT[c] * 0.08, i: c });
  cue(11.5, 'marker', { d: 0.2 }); cue(11.5, 'ding');
  cue(11.78, 'pen', { d: 0.42 }); cue(11.84, 'pop', { p: 1.1 }); cue(12.08, 'pen', { d: 0.28 }); cue(12.18, 'pop', { p: 1.25 });
  cue(13.02, 'whoosh', { d: 0.35, g: 0.35 });
  for (let c = 0; c < G.COLS; c++) if (COLCOUNT[c] && COLCOUNT[c] < 7) cue(colDrop(c) + 0.44 * 0.3636, 'clack', { g: 0.2 + COLCOUNT[c] * 0.04, p: 0.8 + rnd(c, 4) * 0.5 });
  cue(13.52, 'pen', { d: 0.28 }); cue(13.8, 'whoosh', { d: 0.5, g: 0.5 });
  // 4
  cue(13.95, 'pencil', { d: 0.45 }); cue(14.02, 'pops', { n: 14, d: 0.3 });
  for (const R of ROWS) if (!R.hero) cue(R.t0, 'whoosh', { d: 0.35, g: 0.4 });
  cue(14.26, 'stampSmall');
  cue(15.2, 'pops', { n: 6, d: 0.3, p: 1.2 });
  for (let k = 1; k <= 17; k++) cue(T_COUNT[0] + (k / 17) * 1.0, 'count', { i: k });
  cue(T_SWAP, 'swap'); cue(17.12, 'pops', { n: 6, d: 0.25 });
  for (const t0 of [17.45, 17.7, 17.95]) cue(t0, 'pen', { d: 0.12, g: 0.9 });
  cue(18.2, 'pops', { n: 12, d: 0.35, p: 1.3 }); cue(19.25, 'whoosh', { d: 0.8, g: 0.5 });
  // 5
  cue(T_COIN, 'fallwhistle', { d: 0.5 }); cue(T_HIT, 'coin'); cue(T_STAMP - 0.02, 'coin', { p: 1.12 }); cue(T_STAMP, 'slam', { g: 0.85 }); cue(T_STAMP + 0.02, 'whoosh', { d: 0.4, g: 0.4 });
  cue(21.3, 'pops', { n: 16, d: 0.55 }); cue(21.95, 'pen', { d: 0.2 });
  cue(22.18, 'whoosh', { d: 0.45, g: 0.45 }); cue(22.58, 'tab'); cue(23.0, 'pops', { n: 8, d: 0.3, p: 1.2 });
  cue(23.28, 'marker', { d: 0.5, g: 1 }); cue(23.94, 'marker', { d: 0.45, g: 0.8 });
  // 6
  cue(23.95, 'pencil', { d: 0.45 }); cue(24.04, 'blip', { p: 1.2 }); cue(24.12, 'pen', { d: 0.3, g: 0.6 });
  for (let i = 0; i < 11; i++) cue(24.2 + i * 0.02, 'key', { g: 0.35 });
  cue(24.26, 'pops', { n: 8, d: 0.25 }); cue(24.52, 'pen', { d: 0.14 }); cue(24.42, 'marker', { d: 0.18, g: 0.6 });
  for (let k = 0; k < 10; k++) cue(24.45 + 0.5 * (1 - Math.cbrt(1 - k / 10)), 'count', { i: k + 3, g: 0.5 });
  for (let i = 0; i < 44; i += 2) cue(24.55 + i * 0.008, 'key', { g: 0.3 });
  cue(24.92, 'pops', { n: 12, d: 0.4 });
  for (let i = 1; i < THEMES.length; i++) cue(THEMES[i][0], 'wipe', { d: WIPE });
  // 7
  cue(BREAK, 'drop'); cue(BREAK, 'whoosh', { d: 0.5, g: 0.5 });
  cue(26.95, 'pops', { n: 9, d: 0.3 }); cue(27.34, 'pen', { d: 0.2 });
  cue(27.56, 'pops', { n: 14, d: 0.4 }); cue(27.8, 'pops', { n: 14, d: 0.42 });
  cue(28.36, 'whoosh', { d: 0.5, g: 0.2 }); cue(28.94, 'click'); cue(28.98, 'sparkle');
  return C.sort((a, b) => a.t - b.t);
}

// ---------- rendu ----------
let CTX, TMP, ACC;
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
async function init(canvas) {
  const faces = [['Caveat', 'Caveat-Bold.ttf', '700'], ['Atkinson', 'AtkinsonHyperlegible-Regular.ttf', '400'], ['Atkinson', 'AtkinsonHyperlegible-Bold.ttf', '700'], ['Plex', 'IBMPlexMono-Medium.ttf', '500']];
  await Promise.all(faces.map(async ([f, file, w]) => { const ff = new FontFace(f, `url(../src/assets/fonts/${file})`, { weight: w }); await ff.load(); document.fonts.add(ff); }));
  CTX = canvas.getContext('2d'); TMP = mk().getContext('2d'); ACC = mk().getContext('2d'); LAYER = mk().getContext('2d'); MC = mk(8, 8).getContext('2d');
  const sp_ = mk(256, 256), g = sp_.getContext('2d');
  for (let i = 0; i < 900; i++) { g.globalAlpha = 0.25 + rnd(i, 1) * 0.75; g.beginPath(); g.arc(rnd(i, 2) * 256, rnd(i, 3) * 256, 0.4 + Math.pow(rnd(i, 4), 3) * 2.6, 0, Math.PI * 2); g.fill(); }
  SPECK = CTX.createPattern(sp_, 'repeat');
}
function draw(i, { mb = true } = {}) {
  BOIL = Math.floor(i / 5);
  const t = i / FPS, n = mb ? samplesAt(t) : 1;
  if (n === 1) { renderAt(CTX, t); return; }
  for (let s = 0; s < n; s++) {
    renderAt(TMP, t + ((s + 0.5) / n - 0.5) * 0.5 / FPS);
    ACC.setTransform(1, 0, 0, 1, 0, 0); ACC.globalAlpha = 1 / (s + 1); ACC.drawImage(TMP.canvas, 0, 0);
  }
  CTX.setTransform(1, 0, 0, 1, 0, 0); CTX.globalAlpha = 1; CTX.drawImage(ACC.canvas, 0, 0);
}
window.SCENE = { W, H, FPS, DUR, FRAMES, init, draw, cues: buildCues, frame: (i, o) => { draw(i, o); return CTX.canvas.toDataURL('image/png'); } };
})();
