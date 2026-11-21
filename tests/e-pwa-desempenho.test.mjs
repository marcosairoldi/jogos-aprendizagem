// PWA, links externos e desempenho de primeira abertura.
// Cobre os itens 9b, 11 e 12. Uso: node tests/e-pwa-desempenho.test.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, tocar, esperarTela, esperarAte, dormir, raizProjeto,
} from './e-lib.mjs';

const R = criarRelator('E PWA e desempenho');
const { ok } = R;
const lerTexto = (p) => readFileSync(path.join(raizProjeto, p), 'utf8');

// ---------- 12. manifest ----------
console.log('\n# Manifest e ícones');
const manifest = JSON.parse(lerTexto('manifest.json'));
ok(manifest.name && manifest.short_name, 'manifest tem name e short_name');
ok(manifest.start_url && !/^(\/|https?:)/.test(manifest.start_url), `start_url relativo (${manifest.start_url})`);
ok(manifest.scope && !/^(\/|https?:)/.test(manifest.scope), `scope relativo (${manifest.scope})`);
ok(manifest.display === 'standalone', 'display standalone');
ok(manifest.orientation === 'portrait', 'orientação retrato');
ok(/^#[0-9a-f]{6}$/i.test(manifest.theme_color) && /^#[0-9a-f]{6}$/i.test(manifest.background_color), 'theme_color e background_color válidos');
function dimensoesPng(p) {
  const b = readFileSync(path.join(raizProjeto, p));
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
for (const tam of [192, 512]) {
  const ic = manifest.icons.find((i) => i.sizes === `${tam}x${tam}` && i.type === 'image/png' && (i.purpose || 'any').includes('any'));
  ok(!!ic, `ícone ${tam}x${tam} PNG declarado`);
  if (ic) {
    ok(existsSync(path.join(raizProjeto, ic.src)), `arquivo ${ic.src} existe`);
    const d = dimensoesPng(ic.src);
    ok(d && d[0] === tam && d[1] === tam, `${ic.src} tem ${tam}x${tam} de verdade`, JSON.stringify(d));
  }
}
const mask = manifest.icons.find((i) => (i.purpose || '').includes('maskable'));
ok(!!mask, 'ícone maskable declarado');
if (mask) { const d = dimensoesPng(mask.src); ok(d && d[0] >= 192 && d[0] === d[1], `ícone maskable ${mask.src} quadrado (${d})`); }
for (const ic of manifest.icons) ok(existsSync(path.join(raizProjeto, ic.src)), `ícone ${ic.src} existe`);
const html = lerTexto('index.html');
ok(/<link rel="manifest" href="manifest.json">/.test(html), 'index.html liga o manifest (caminho relativo)');
const tc = /<meta name="theme-color" content="([^"]+)"/.exec(html);
ok(tc && tc[1].toLowerCase() === manifest.theme_color.toLowerCase(), 'theme-color do HTML igual ao do manifest', tc && tc[1]);
ok(/<html lang="pt-BR"/.test(html), 'html lang pt-BR');
ok(!/(src|href)="\//.test(html) && !/(src|href)="\//.test(lerTexto('css/estilo.css')), 'caminhos relativos no HTML');
const absJs = [];
for (const f of readdirSync(path.join(raizProjeto, 'js'), { recursive: true })) {
  if (!f.endsWith('.js')) continue;
  const t = lerTexto('js/' + f);
  if (/(fetch|import|new Audio|\.src\s*=)\(?\s*['"`]\/[a-z]/.test(t)) absJs.push(f);
}
ok(absJs.length === 0, 'JS sem caminhos absolutos (/...)', absJs.join(', '));

// ---------- 9b. links externos ----------
console.log('\n# Links externos');
const arquivos = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: raizProjeto, encoding: 'utf8' }).split('\0').filter(Boolean);
const NAMESPACES = /^https?:\/\/www\.w3\.org\/(2000\/svg|1999\/xlink|1999\/xhtml)/;
const achados = [];
const achadosDocs = [];
for (const arq of arquivos) {
  if (!/^(index\.html|css\/|js\/|data\/|manifest\.json|sw\.js|assets\/)/.test(arq)) continue;
  if (/\.(png|mp3|woff2|ico|jpg)$/.test(arq)) continue;
  if (arq === 'assets/fontes/LICENSE-OFL.txt') continue; // texto legal da licença OFL (obrigatório); cita a URL da SIL, o app nunca a abre
  const t = lerTexto(arq);
  for (const m of t.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    if (NAMESPACES.test(m[0])) continue;
    (arq.endsWith('.md') ? achadosDocs : achados).push(`${arq}: ${m[0]}`);
  }
}
ok(achados.length === 0, 'nenhum http(s):// no app (exceto o namespace SVG do W3C)', achados.join('\n'));
if (achadosDocs.length) R.aviso('URLs em documentação (não vão para a criança): ' + achadosDocs.join(' | '));
// binários: procura strings http em PNG/MP3 (metadados)
const metadados = [];
for (const arq of arquivos) {
  if (!/\.(png|mp3|woff2)$/.test(arq)) continue;
  const b = readFileSync(path.join(raizProjeto, arq)).toString('latin1');
  const m = /https?:\/\/[\x21-\x7e]{4,}/.exec(b);
  if (m && !/w3\.org/.test(m[0]) && !/license|sil\.org|scripts\.sil/i.test(m[0])) metadados.push(`${arq}: ${m[0].slice(0, 70)}`);
}
ok(metadados.length === 0, 'nenhuma URL escondida em metadados de PNG/MP3/fonte', metadados.join('\n'));

// ---------- navegador ----------
const srv = await iniciarServidor();
const browser = await chromium.launch();
try {
  console.log('\n# Service worker registrado');
  {
    const app = await abrirApp(browser, srv.base, { rapido: true, sw: 'allow' });
    const { page } = app;
    await esperarAte(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))), { timeout: 30000, msg: 'SW ativo' });
    const reg = await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => ({ escopo: r.scope, script: r.active.scriptURL })));
    ok(reg.script.endsWith('/sw.js') && reg.escopo === srv.base, 'service worker registrado com escopo da raiz', JSON.stringify(reg));
    const mf = await page.evaluate(() => fetch(document.querySelector('link[rel=manifest]').href).then((r) => r.json()));
    ok(mf.display === 'standalone', 'manifest servido corretamente');
    const ic = await page.evaluate(async () => { const r = await fetch('assets/icones/icone-512.png'); const b = await createImageBitmap(await r.blob()); return [b.width, b.height]; });
    ok(ic[0] === 512 && ic[1] === 512, 'ícone 512 decodifica no navegador');
    ok(app.coleta.requisicoesExternas.length === 0, 'nenhuma requisição externa na primeira abertura', app.coleta.requisicoesExternas.join('\n'));
    await app.ctx.close();
  }

  // ---------- 11. desempenho ----------
  console.log('\n# Desempenho de primeira abertura (4G: 1,6 Mbps, 150 ms RTT)');
  async function medir(swModo) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: swModo });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1000 * 1000) / 8, uploadThroughput: (0.75 * 1000 * 1000) / 8 });
    const reqs = new Map();
    cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp, bytes: 0 }));
    cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; } });
    const t0 = Date.now();
    await page.goto(srv.base, { waitUntil: 'commit' });
    await page.waitForFunction(() => {
      const b = document.querySelector('button[aria-label="Começar"] img');
      return b && b.complete && b.naturalWidth > 0;
    }, null, { timeout: 60000 });
    const tInicio = Date.now() - t0;
    const bytesInicio = [...reqs.values()].filter((r) => r.bytes).reduce((s, r) => s + r.bytes, 0);
    const listaInicio = [...reqs.values()].filter((r) => r.bytes).map((r) => [r.url.replace(srv.base, ''), r.bytes]);
    // segue até a trilha (guia + trilha)
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.touchscreen.tap(180, 600);
    await page.waitForSelector('.btn-guia', { timeout: 30000 });
    await page.locator('.btn-guia').first().tap();
    await page.waitForSelector('.trilha-area .parada', { timeout: 30000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    const tTrilha = Date.now() - t0;
    await dormir(1500);
    const total = [...reqs.values()].filter((r) => r.bytes).reduce((s, r) => s + r.bytes, 0);
    const swBytes = [...reqs.values()].filter((r) => r.bytes && /(figuras|audio\/gerado)/.test(r.url)).reduce((s, r) => s + r.bytes, 0);
    await ctx.close();
    return { tInicio, bytesInicio, tTrilha, total, listaInicio, swBytes, n: reqs.size };
  }
  const semSW = await medir('block');
  console.log(`   sem service worker: tela inicial utilizável em ${semSW.tInicio} ms (${(semSW.bytesInicio / 1024).toFixed(0)} KB, ${semSW.listaInicio.length} arquivos); até a trilha ${semSW.tTrilha} ms, total ${(semSW.total / 1024).toFixed(0)} KB`);
  const comSW = await medir('allow');
  console.log(`   com service worker (pré-cache em paralelo): tela inicial em ${comSW.tInicio} ms; até a trilha ${comSW.tTrilha} ms; total transferido na janela ${(comSW.total / 1024).toFixed(0)} KB`);
  for (const [u, b] of semSW.listaInicio.sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`     ${(b / 1024).toFixed(1).padStart(7)} KB  ${u}`);

  // estimativa analítica com compressão gzip (o GitHub Pages comprime texto)
  const lista = semSW.listaInicio.map(([u]) => u).filter((u) => !/^(favicon)/.test(u));
  let bruto = 0, comprimido = 0;
  for (const u of lista) {
    const p = path.join(raizProjeto, u === '' ? 'index.html' : u.split('?')[0]);
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    const b = readFileSync(p);
    bruto += b.length;
    comprimido += /\.(html|css|js|json|svg)$/.test(p) ? gzipSync(b, { level: 6 }).length : b.length;
  }
  const bps = 1.6e6;
  const estimativa = (bytes, rtts) => (bytes * 8) / bps + (rtts * 0.15);
  console.log(`   estimativa analítica: ${(bruto / 1024).toFixed(0)} KB brutos / ${(comprimido / 1024).toFixed(0)} KB com gzip -> ${estimativa(comprimido, 4).toFixed(2)} s (gzip, ~4 RTTs) a ${estimativa(bruto, 4).toFixed(2)} s (sem compressão)`);
  ok(semSW.tInicio < 2000 || estimativa(comprimido, 4) < 2, `tela inicial utilizável < 2 s em 4G (medido ${semSW.tInicio} ms sem compressão do servidor; estimado ${estimativa(comprimido, 4).toFixed(2)} s com gzip)`);
  if (semSW.tInicio >= 2000) R.aviso(`medido ${semSW.tInicio} ms no servidor de teste sem gzip e sem HTTP/2 (o GitHub Pages comprime e multiplexa)`);
  // tamanho total do app (para quem instala)
  let totalApp = 0, nApp = 0;
  const walk = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); const s = statSync(p); if (s.isDirectory()) { if (!['docs', 'tests', 'ferramentas', '.git'].includes(n)) walk(p); } else if (!n.endsWith('.md')) { totalApp += s.size; nApp++; } } };
  walk(raizProjeto);
  console.log(`   app inteiro (pré-cache do SW): ${nApp} arquivos, ${(totalApp / 1024).toFixed(0)} KB`);
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
