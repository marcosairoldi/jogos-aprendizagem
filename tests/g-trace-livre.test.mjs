// Testes do Trace em modo livre (26 letras, pares Aa). Uso: node tests/g-trace-livre.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = '/tmp/claude-0/g';
mkdirSync(SHOTS, { recursive: true });
const livre = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const porta = await livre();
const srv = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${porta}`;
const browser = await chromium.launch();
let falhas = 0;
const tracados = JSON.parse(readFileSync(RAIZ + 'data/tracados.json', 'utf8'));
const tracosDe = (l) => [...tracados.letras[l].tracos, ...tracados.letras[l].minuscula.tracos.map((t) => t.map(([x, y]) => [x + 100, y]))];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function nova(w, h, query) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route('**/assets/svg/**', (route) => {
    const u = new URL(route.request().url());
    if (existsSync(RAIZ + decodeURIComponent(u.pathname))) return route.continue();
    route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#fff"/></svg>' });
  });
  await page.goto(`${base}/tests/d2-harness.html?jogo=trace&modo=livre&${query}`);
  await page.waitForFunction(() => window.__d2 && window.__d2.pronto);
  return { page, erros, ctx };
}
async function teste(nome, fn) {
  try { await fn(); console.log('ok   ', nome); } catch (e) { falhas++; console.log('FALHA', nome, '\n     ', e.stack.split('\n').slice(0, 12).join('\n      ')); }
}
const esperar = (page, fn, arg, t = 8000) => page.waitForFunction(fn, arg, { timeout: t });
const falas = (page) => page.evaluate(() => window.__d2.falas.flat());
async function arrastar(page, traco) {
  const b = await page.evaluate(() => { const s = document.querySelector('.j-trace-svg'); const r = s.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, vw: s.viewBox.baseVal.width }; });
  const pos = ([x, y]) => [b.l + (x / b.vw) * b.w, b.t + (y / 100) * b.h];
  const [x0, y0] = pos(traco[0]);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i < traco.length; i++) { const [x, y] = pos(traco[i]); await page.mouse.move(x, y, { steps: 2 }); }
  await page.mouse.up();
}
async function tracar(page, letra) {
  for (const t of tracosDe(letra)) { await arrastar(page, t); await dormir(50); }
  await esperar(page, () => document.querySelector('.j-trace-completa'));
}

for (const [w, h] of [[360, 800], [360, 640]]) {
  await teste(`grade ${w}x${h}: 26 pares, sem rolagem, alvos >= 64 px e >= 16 px das bordas`, async () => {
    const { page, erros, ctx } = await nova(w, h, 'liberadas=a,m,p');
    await esperar(page, () => document.querySelectorAll('.j-cartao-letra').length === 26);
    const letras = await page.$$eval('.j-cartao-letra', (bs) => bs.map((b) => b.querySelector('.j-mai').textContent + b.querySelector('.j-min').textContent));
    assert.deepEqual(letras, 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => l.toUpperCase() + l));
    const r = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll('.j-cartao-letra, .j-ouvir')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const b = e.getBoundingClientRect(); return { c: e.className, w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom }; });
      const raiz = document.getElementById('raiz');
      return { alvos, docH: document.documentElement.scrollHeight, winH: innerHeight, docW: document.documentElement.scrollWidth, winW: innerWidth, sh: raiz.scrollHeight, ch: raiz.clientHeight, sw: raiz.scrollWidth, cw: raiz.clientWidth };
    });
    assert.ok(r.docH <= r.winH && r.docW <= r.winW, 'rolagem do documento');
    assert.ok(r.sh <= r.ch + 1 && r.sw <= r.cw + 1, `conteúdo maior que a raiz ${r.sh}>${r.ch}`);
    assert.ok(r.alvos.length >= 27);
    for (const a of r.alvos) {
      assert.ok(a.w >= 63.5 && a.h >= 63.5, `alvo pequeno ${a.c} ${a.w}x${a.h}`);
      assert.ok(a.l >= 15.5 && a.r <= w - 15.5, `perto da borda ${a.c} ${a.l}..${a.r}`);
      assert.ok(a.t >= 15.5 && a.b <= h - 72 - 15.5 + 72, `fora no vertical ${a.c}`);
    }
    // o conteúdo do par cabe no cartão
    const cabe = await page.$$eval('.j-cartao-letra', (bs) => bs.every((b) => { const p = b.querySelector('.j-par').getBoundingClientRect(), c = b.getBoundingClientRect(); return p.width <= c.width - 8 && p.height <= c.height - 4; }));
    assert.ok(cabe, 'par cabe no cartão');
    assert.ok((await falas(page)).includes('frase:trace_escolher'), 'fala a escolha');
    // ouvir de novo repete a escolha
    const n0 = (await falas(page)).filter((x) => x === 'frase:trace_escolher').length;
    await page.locator('.j-ouvir').tap();
    await esperar(page, (n) => window.__d2.falas.flat().filter((x) => x === 'frase:trace_escolher').length > n, n0);
    await page.screenshot({ path: `${SHOTS}/grade-${w}x${h}.png` });
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

await teste('tocar H não fala som de letra; abre o traçado do par', async () => {
  const { page, erros, ctx } = await nova(360, 800, 'liberadas=a,m,p');
  await esperar(page, () => document.querySelectorAll('.j-cartao-letra').length === 26);
  await page.locator('.j-cartao-letra[data-letra="h"]').tap();
  await esperar(page, () => document.querySelector('.j-trace-svg'));
  await dormir(300);
  const f = await falas(page);
  assert.ok(!f.some((x) => typeof x === 'string' && /^som:h$/.test(x)), 'sem som:h');
  assert.ok(!f.some((x) => typeof x === 'string' && x.toLowerCase() === 'h'), 'sem "h" para a voz');
  assert.ok(f.filter((x) => typeof x === 'string' && x.startsWith('som:')).length === 0, 'nenhum som de letra');
  assert.ok(f.includes('frase:trace_instrucao'));
  assert.equal(await page.evaluate(() => document.querySelector('.j-trace-svg').viewBox.baseVal.width), 200, 'par lado a lado');
  await page.screenshot({ path: `${SHOTS}/tracar-h.png` });
  await tracar(page, 'h');
  await esperar(page, () => window.__d2.falas.some((x) => x[0] === 'frase:trace_completo'));
  const completos = await page.evaluate(() => window.__d2.falas.filter((x) => x[0] === 'frase:trace_completo'));
  assert.deepEqual(completos[0], ['frase:trace_completo'], 'só o elogio');
  assert.deepEqual(await page.evaluate(() => window.__d2.registros), [], 'h não liberada: não registra');
  await esperar(page, () => document.querySelector('.j-cartao-letra.j-tracada[data-letra="h"] .j-marca'), null, 6000);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await teste('tocar M fala som:m; 3 letras encerram; só liberadas registram', async () => {
  const { page, erros, ctx } = await nova(360, 800, 'liberadas=a,m,p');
  await esperar(page, () => document.querySelectorAll('.j-cartao-letra').length === 26);
  assert.ok(await page.$('.j-cartao-letra.j-liberada[data-letra="m"]'), 'brilho nas liberadas');
  await page.locator('.j-cartao-letra[data-letra="m"]').tap();
  await esperar(page, () => document.querySelector('.j-trace-svg'));
  const f = await falas(page);
  assert.ok(f.includes('som:m'), 'som:m ao tocar');
  assert.ok(await page.$('.j-trace-estrela'), 'estrelinha de início');
  await tracar(page, 'm');
  await esperar(page, () => window.__d2.falas.some((x) => x[0] === 'frase:trace_completo' && x[1] === 'som:m'));
  await esperar(page, () => document.querySelectorAll('.j-cartao-letra').length === 26, null, 6000);
  await page.screenshot({ path: `${SHOTS}/grade-com-estrela.png` });
  for (const l of ['q', 'x']) {
    await page.locator(`.j-cartao-letra[data-letra="${l}"]`).tap();
    await esperar(page, () => document.querySelector('.j-trace-svg'));
    await tracar(page, l);
    if (l === 'q') await esperar(page, () => document.querySelectorAll('.j-cartao-letra').length === 26, null, 6000);
  }
  await esperar(page, () => window.__d2.terminou, null, 12000);
  const r = await page.evaluate(() => ({ t: window.__d2.terminou, reg: window.__d2.registros }));
  assert.deepEqual(r.t.itens.map((i) => i.letra), ['m', 'q', 'x']);
  assert.deepEqual(r.reg.map((x) => x.letra), ['m'], 'só a liberada conta para o domínio');
  assert.deepEqual(erros, []);
  await ctx.close();
});

await browser.close();
srv.kill();
console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
