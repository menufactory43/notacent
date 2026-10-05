// Rendu image par image dans Chrome sans tête, en parallèle, puis cues.json pour la bande-son.
//   node render.mjs                      → frames/ (1800 PNG) + cues.json
//   node render.mjs --stills 2.0,6.5     → stills/t_2.00.png, pour relire des instants précis
//   node render.mjs --from 600 --to 900  → une plage
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-mcp/node_modules/puppeteer-core');

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', path.join(HERE, 'frames'));
const WORKERS = +arg('--workers', 8);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--force-color-profile=srgb'] });
const open = async () => { const p = await browser.newPage(); await p.setViewport({ width: 1920, height: 1080 }); p.on('pageerror', (e) => console.error('page:', e.message)); await p.goto(`http://127.0.0.1:${port}/promo/scene.html?render`); await p.waitForFunction('window.READY === true', { timeout: 60000 }); return p; };

const first = await open();
const cues = await first.evaluate(() => SCENE.cues());
fs.writeFileSync(path.join(HERE, 'cues.json'), JSON.stringify(cues, null, 1));

let jobs;
const stills = arg('--stills');
if (stills) jobs = stills.split(',').map((s) => ({ i: Math.round(+s * 60), file: path.join(HERE, 'stills', `t_${(+s).toFixed(2)}.png`) }));
else { const a = +arg('--from', 0), b = +arg('--to', 1799); jobs = []; for (let i = a; i <= b; i++) jobs.push({ i, file: path.join(OUT, `f_${String(i).padStart(5, '0')}.png`) }); }
fs.mkdirSync(path.dirname(jobs[0].file), { recursive: true });

const pages = [first, ...(await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) - 1 }, open)))];
let next = 0, done = 0; const t0 = Date.now();
await Promise.all(pages.map(async (p) => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const url = await p.evaluate((i) => SCENE.frame(i), job.i);
    fs.writeFileSync(job.file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (++done % 60 === 0) process.stdout.write(`\r${done}/${jobs.length} · ${((Date.now() - t0) / done).toFixed(0)} ms/image`);
  }
}));
console.log(`\n${done} images en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close(); server.close();
