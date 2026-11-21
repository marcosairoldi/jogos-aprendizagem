// Testes da camada de audio e do service worker.  Uso: node tests/c-audio.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { copyFileSync, rmSync, existsSync } from 'node:fs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');

const porta = await new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: raiz, stdio: ['ignore', 'ignore', 'pipe'] });
let logSrv = '';
srv.stderr.on('data', (d) => { logSrv += d; });
const falsa = join(raiz, 'assets/audio/gravacoes/frase_acerto_1.mp3');
const existiaFalsa = existsSync(falsa);
if (existiaFalsa) throw new Error('frase_acerto_1.mp3 ja existe; abortando para nao apagar');
copyFileSync(join(raiz, 'assets/audio/gerado/som_m.mp3'), falsa);
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${porta}/`;

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas++; };

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  // ---------- audio ----------
  await page.goto(base + 'tests/c-audio.html');
  await page.waitForSelector('body[data-carregado="1"]', { state: 'attached' });
  ok((await page.evaluate(() => audio.estado().desbloqueado)) === false, 'estado: nao desbloqueado antes do toque');
  await page.click('#comecar');
  await page.waitForSelector('body[data-pronto="1"]', { state: 'attached', timeout: 8000 });
  const est = await page.evaluate(() => audio.estado());
  ok(est.desbloqueado === true, 'estado: desbloqueado apos o toque (temVozPtBr=' + est.temVozPtBr + ')');

  let x0;
  const t = async (expr) => { const t0 = Date.now(); const r = await page.evaluate(expr); return { r, ms: Date.now() - t0 }; };

  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'SW controla a pagina');
  const pedidos = [];
  page.on('request', (r) => pedidos.push(r.method() + ' ' + r.url()));
  x0 = await t(`audio.falar(['frase:acerto_1'])`);
  ok(x0.r.cancelado === false && x0.ms > 300 && x0.ms < 3000, `gravacao falsa usada (${x0.ms} ms)`);
  ok(pedidos.some((p) => p.startsWith('GET') && p.includes('gravacoes/frase_acerto_1.mp3')), 'gravacao falsa foi pedida (GET)');
  let x = await t(`audio.falar(['som:m'])`);
  ok(x.r.cancelado === false && x.ms > 300 && x.ms < 4000, `som de letra (arquivo gerado) resolve em ${x.ms} ms`);
  x = await t(`audio.falar(['som:p'])`);
  ok(x.r.cancelado === false, `som oclusivo p (arquivo) resolve em ${x.ms} ms`);
  x = await t(`audio.falar(['sil:ma', 'pausa:100', 'pal:mapa'])`);
  ok(x.r.cancelado === false, `silaba e palavra (sem arquivo -> voz do aparelho ou nada) resolvem em ${x.ms} ms`);
  x = await t(`(setNome('Ana'), audio.falar([{ frase: 'acerto_2' }, 'frase:boas_vindas']))`);
  ok(x.r.cancelado === false, `frases com {nome} resolvem em ${x.ms} ms`);
  x = await t(`audio.falar(['som:zzz', 'frase:nao_existe', 'xyz', 'pausa:50'])`);
  ok(x.r.cancelado === false, 'itens invalidos nao quebram');

  const cancel = await page.evaluate(async () => {
    const a = audio.falar(['pausa:1500', 'som:m']);
    await new Promise((r) => setTimeout(r, 100));
    const b = audio.falar(['pausa:50']);
    return [await a, await b];
  });
  ok(cancel[0].cancelado === true && cancel[1].cancelado === false, 'segunda chamada cancela a primeira (cancelado:true)');

  const par = await page.evaluate(async () => {
    const a = audio.falar(['pausa:2000', 'efeito:pop']);
    await new Promise((r) => setTimeout(r, 100));
    audio.parar();
    return await a;
  });
  ok(par.cancelado === true, 'parar() cancela a sequencia');

  x = await t(`audio.falar(['efeito:brilho', 'pausa:50', 'efeito:pop'])`);
  ok(x.r.cancelado === false && x.ms > 800, `efeitos dentro de falar (${x.ms} ms)`);
  for (const n of ['brilho', 'pop', 'tchan', 'bolha', 'passo', 'inexistente']) {
    const r = await page.evaluate((n) => { try { audio.efeito(n); return true; } catch (e) { return false; } }, n);
    ok(r, `efeito('${n}' ) nao lanca`);
  }
  await page.evaluate(() => audio.parar());

  // visibilitychange: esconde a pagina durante uma fala
  const vis = await page.evaluate(async () => {
    const a = audio.falar(['pausa:3000']);
    await new Promise((r) => setTimeout(r, 100));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const r = await a;
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    return r;
  });
  ok(vis.cancelado === true, 'visibilitychange (escondida) para a fala');

  // ---------- service worker ----------
  const p2 = await context.newPage();
  p2.on('console', (m) => { if (m.type() === 'error') erros.push('sw-page error: ' + m.text()); });
  await p2.goto(base + 'tests/c-sw.html');
  await p2.waitForSelector('body[data-sw="pronto"]', { state: 'attached', timeout: 15000 });
  await p2.waitForTimeout(1500); // deixa o pre-cache terminar
  // frases.json: rede quando online, cache quando offline
  const antes = (logSrv.match(/GET \/data\/frases\.json/g) || []).length;
  const on = await p2.evaluate(async () => (await fetch('../data/frases.json')).status);
  await new Promise((r) => setTimeout(r, 500));
  const depois = (logSrv.match(/GET \/data\/frases\.json/g) || []).length;
  ok(on === 200 && depois > antes, 'online: data/frases.json vem da rede (network-first)');
  p2.removeAllListeners('console');
  await context.setOffline(true);
  const off = await p2.evaluate(async () => {
    const get = async (u) => { try { const r = await fetch(u); return r.status; } catch (e) { return 'erro'; } };
    const head = async (u) => { try { const r = await fetch(u, { method: 'HEAD' }); return r.status; } catch (e) { return 'erro'; } };
    return {
      manifest: await get('manifest.json'.replace(/^/, '../')),
      som: await get('../assets/audio/gerado/som_m.mp3'),
      frases: await get('../data/frases.json'),
      headOk: await head('../assets/audio/gerado/som_m.mp3'),
      frasesOff: await get('../data/frases.json'),
      gravOff: await get('../assets/audio/gravacoes/frase_acerto_1.mp3'),
      headNao: await head('../assets/audio/gravacoes/som_m.mp3'),
    };
  });
  ok(off.manifest === 200, 'offline: manifest.json carrega (' + off.manifest + ')');
  ok(off.som === 200, 'offline: som_m.mp3 carrega (' + off.som + ')');
  ok(off.frases === 200, 'offline: data/frases.json carrega (' + off.frases + ')');
  ok(off.headOk === 200, 'offline: HEAD de arquivo existente = 200');
  ok(off.headNao === 204, 'offline: HEAD de gravacao inexistente = 204 (' + off.headNao + ')');
  ok(off.frasesOff === 200, 'offline: data/frases.json vem do cache');
  ok(off.gravOff === 200, 'offline: gravacao falsa ja usada continua disponivel');
  await context.setOffline(false);

  ok(erros.length === 0, 'sem console.error/warning nem excecoes' + (erros.length ? ': ' + erros.join(' | ') : ''));
} finally {
  await browser.close();
  srv.kill();
  rmSync(falsa, { force: true });
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
