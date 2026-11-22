// Trace a Letra com gestos REALISTAS de criança (toque real via CDP, Pixel 5 e 360x640).
// Começa no meio, dedo tremido, rápido, lento, levanta e continua, touchCancel, rabisco longe do caminho.
// Uso: node tests/m-trace-real.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = '/tmp/claude-0/m';
mkdirSync(SHOTS, { recursive: true });
const livre = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const porta = await livre();
const srv = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${porta}`;
const browser = await chromium.launch();
let falhas = 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const TELAS = { '360x640': [360, 640], '360x800': [360, 800], '412x915': [412, 915], '768x1024': [768, 1024] };
const FILTRO = process.env.SO || '';

const AMBIENTES = {
  'Pixel 5': { ...devices['Pixel 5'] },
  '360x640': { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function abrir(amb, letra, extra = '') {
  const ctx = await browser.newContext(AMBIENTES[amb]);
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    window.__pc = 0; window.__scroll = 0;
    addEventListener('pointercancel', () => { window.__pc++; }, true);
    addEventListener('scroll', () => { window.__scroll++; }, true);
  });
  await page.route('**/assets/svg/**', (route) => {
    const u = new URL(route.request().url());
    if (existsSync(RAIZ + decodeURIComponent(u.pathname))) return route.continue();
    route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#fff"/></svg>' });
  });
  await page.goto(`${base}/tests/d2-harness.html?jogo=trace&foco=${letra}&letras=${letra}&liberadas=${'m,a,s,g'.includes(letra) ? letra : 'm'}${extra}`);
  await page.waitForFunction(() => window.__d2 && window.__d2.pronto);
  await page.waitForSelector('.j-trace-svg');
  await dormir(600); // passa a animação de entrada
  const cdp = await ctx.newCDPSession(page);
  return { page, erros, ctx, cdp };
}

// traços (pontos guia) em px de tela, lidos do DOM: independem do layout
const tracosTela = (page) => page.evaluate(() => [...document.querySelectorAll('.j-trace-svg .j-trace-pontos')].map((pl) => {
  const m = pl.getScreenCTM();
  return [...pl.points].map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }));
}));

// ---- geometria
const comp = (s) => { let t = 0; for (let i = 1; i < s.length; i++) t += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y); return t; };
function reamostrar(s, passo) {
  const r = [{ ...s[0] }];
  let falta = passo;
  for (let i = 1; i < s.length; i++) {
    let a = s[i - 1]; const b = s[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d >= falta) {
      const f = falta / d; a = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      r.push(a); d = Math.hypot(b.x - a.x, b.y - a.y); falta = passo;
    }
    falta -= d;
  }
  const u = s[s.length - 1];
  if (Math.hypot(r.at(-1).x - u.x, r.at(-1).y - u.y) > passo * 0.3) r.push({ ...u });
  return r;
}
let semente = 12345;
const rnd = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
const ruido = (s, px) => s.map((p) => ({ x: p.x + (rnd() * 2 - 1) * px, y: p.y + (rnd() * 2 - 1) * px }));

// ---- dedo via CDP
let idToque = 1;
const tp = (p, id) => ({ x: p.x, y: p.y, id, radiusX: 10, radiusY: 10, force: 1 });
async function dedo(cdp, pts, { dt = 12, cancelarEm = null } = {}) {
  const id = idToque++;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(pts[0], id)] });
  for (let i = 1; i < pts.length; i++) {
    if (dt) await dormir(dt);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(pts[i], id)] });
    if (cancelarEm === i) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      return;
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const info = (page) => page.evaluate(() => {
  const s = document.querySelector('.j-trace-svg');
  return {
    completa: !!document.querySelector('.j-trace-completa') || !document.querySelector('.j-trace-svg'),
    cobertos: s ? +(s.dataset.cobertos || 0) : -1, total: s ? +(s.dataset.total || 0) : -1,
    rastro: s ? [...s.querySelectorAll('.j-trace-rastro, .j-trace-dedo')].reduce((n, e) => n + (e.getAttribute('points') || e.getAttribute('d') || '').length, 0) : 0,
    pc: window.__pc, rolou: window.__scroll, sy: scrollY, sh: document.documentElement.scrollHeight, ih: innerHeight, vs: visualViewport.scale,
  };
});
const esperarCompleta = (page, t = 6000) => page.waitForFunction(() => !!document.querySelector('.j-trace-completa') || !document.querySelector('.j-trace-svg'), null, { timeout: t }).then(() => true, () => false);

async function teste(nome, fn) {
  if (FILTRO && !nome.includes(FILTRO)) return;
  try { await fn(); console.log('ok   ', nome); } catch (e) { falhas++; console.log('FALHA', nome, '\n     ', e.stack.split('\n').slice(0, 6).join('\n      ')); }
}

// cada cenário devolve a lista de dedos (pontos) para uma letra, dados os traços em px
const CENARIOS = {
  'começa no meio do traço e vai nos dois sentidos': (tr) => tr.flatMap((s) => {
    const r = reamostrar(s, 10); const m = Math.floor(r.length / 2);
    return [{ pts: r.slice(m) }, { pts: r.slice(0, m + 1).reverse() }];
  }),
  'dedo tremido (ruído de 12 px)': (tr) => tr.map((s) => ({ pts: ruido(reamostrar(s, 8), 12) })),
  'dedo rápido (poucos eventos, saltos grandes)': (tr) => tr.map((s) => ({ pts: reamostrar(s, 45), dt: 4 })),
  'dedo lento': (tr) => tr.map((s) => ({ pts: reamostrar(s, 9), dt: 25 })),
  'levanta e continua (3 pedaços por traço)': (tr) => tr.flatMap((s) => {
    const r = reamostrar(s, 9); const a = Math.floor(r.length / 3), b = Math.floor((2 * r.length) / 3);
    return [{ pts: r.slice(0, a + 1) }, { pts: r.slice(a - 1, b + 1) }, { pts: r.slice(b) }];
  }),
  'ordem trocada, de trás para frente': (tr) => tr.slice().reverse().map((s) => ({ pts: reamostrar(s, 10).reverse() })),
  'um dedo só varrendo tudo sem levantar': (tr) => {
    const pts = []; tr.forEach((s) => { if (pts.length) pts.push(...reamostrar([pts.at(-1), s[0]], 15)); pts.push(...reamostrar(s, 10)); });
    return [{ pts }];
  },
};

for (const amb of Object.keys(AMBIENTES)) {
  for (const letra of ['m', 'g']) {
    for (const [nome, gerar] of Object.entries(CENARIOS)) {
      await teste(`${amb} ${letra}: ${nome} conclui a letra`, async () => {
        const { page, erros, ctx, cdp } = await abrir(amb, letra);
        const tr = await tracosTela(page);
        let meioShot = false;
        const dedos = gerar(tr);
        for (let i = 0; i < dedos.length; i++) {
          await dedo(cdp, dedos[i].pts, { dt: dedos[i].dt ?? 10 });
          await dormir(40);
          if (!meioShot && letra === 'm' && nome.startsWith('começa') && i === 1) {
            meioShot = true;
            await page.screenshot({ path: `${SHOTS}/meio-${amb.replace(' ', '')}.png` });
          }
        }
        const ok = await esperarCompleta(page);
        const r = await info(page);
        assert.ok(ok, `não concluiu: ${r.cobertos}/${r.total}`);
        if (nome.startsWith('dedo lento') || nome.startsWith('dedo tremido')) {
          await page.screenshot({ path: `${SHOTS}/completo-${amb.replace(' ', '')}-${letra}.png` });
        }
        assert.equal(r.pc, 0, 'pointercancel disparado (gesto roubado)');
        assert.equal(r.rolou, 0, 'houve rolagem');
        assert.ok(r.sy === 0 && r.sh <= r.ih && r.vs === 1, `rolagem/zoom sy=${r.sy} sh=${r.sh} ih=${r.ih} vs=${r.vs}`);
        assert.deepEqual(erros, []);
        await ctx.close();
      });
    }
  }

  await teste(`${amb}: touchCancel no meio do traço não perde o progresso`, async () => {
    const { page, erros, ctx, cdp } = await abrir(amb, 'm');
    const tr = await tracosTela(page);
    const r0 = reamostrar(tr[0], 10);
    await dedo(cdp, r0, { cancelarEm: Math.floor(r0.length * 0.6) });
    await dormir(100);
    const antes = await info(page);
    assert.ok(antes.cobertos > 0, 'nada coberto antes do cancelamento');
    assert.ok(antes.rastro > 0, 'rastro sumiu');
    for (const s of tr.slice(1)) await dedo(cdp, reamostrar(s, 10));
    const meio = await info(page);
    assert.ok(meio.cobertos >= antes.cobertos, 'progresso diminuiu');
    await dedo(cdp, reamostrar(tr[0], 10).reverse());
    assert.ok(await esperarCompleta(page), 'não concluiu depois do cancelamento');
    assert.deepEqual(erros, []);
    await ctx.close();
  });

  await teste(`${amb}: rabisco longe do caminho NÃO conclui, mas deixa rastro`, async () => {
    const { page, erros, ctx, cdp } = await abrir(amb, 'm');
    const tr = await tracosTela(page);
    const caixa = await page.evaluate(() => { const b = document.querySelector('.j-trace-svg').getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
    const todos = tr.flat();
    const longe = (p) => Math.min(...todos.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
    // candidatas: borda interna da caixa; guarda só as que estão a >= 35 px de qualquer ponto
    const cand = [];
    for (let x = caixa.l + 8; x <= caixa.r - 8; x += 6) { cand.push({ x, y: caixa.t + 8 }); cand.push({ x, y: caixa.b - 8 }); }
    const ok = cand.filter((p) => longe(p) >= 35);
    assert.ok(ok.length > 10, 'sem região longe do caminho para rabiscar');
    const topo = ok.filter((p) => p.y < (caixa.t + caixa.b) / 2), baixo = ok.filter((p) => p.y >= (caixa.t + caixa.b) / 2);
    const rabisco = [...topo, ...topo.slice().reverse(), ...baixo, ...baixo.slice().reverse()];
    await dedo(cdp, rabisco, { dt: 8 });
    await dormir(1200);
    const r = await info(page);
    assert.ok(!(await page.evaluate(() => !!document.querySelector('.j-trace-completa'))), 'concluiu com rabisco');
    assert.ok(r.rastro > 0, 'sem rastro visível no rabisco');
    assert.equal(r.pc, 0);
    assert.deepEqual(erros, []);
    await ctx.close();
  });

  await teste(`${amb}: rastro aparece já no primeiro toque (mesmo fora do caminho)`, async () => {
    const { page, ctx, cdp } = await abrir(amb, 'm');
    const caixa = await page.evaluate(() => { const b = document.querySelector('.j-trace-svg').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
    const p = { x: caixa.l + 10, y: caixa.t + 10 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(p, 99)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp({ x: p.x + 40, y: p.y + 6 }, 99)] });
    await dormir(80);
    const r = await info(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(r.rastro > 0, 'sem rastro');
    await ctx.close();
  });
}

// áudio de conclusão
await teste('Pixel 5: ao completar, fala elogio + nome + pausa + som (m) e só elogio + nome (h)', async () => {
  for (const [letra, esperado] of [['m', ['frase:trace_completo', 'nome:m', 'pausa:300', 'som:m']], ['h', ['frase:trace_completo', 'nome:h']]]) {
    const { page, erros, ctx, cdp } = await abrir('Pixel 5', letra);
    const tr = await tracosTela(page);
    for (const s of tr) await dedo(cdp, reamostrar(s, 10));
    assert.ok(await esperarCompleta(page));
    const f = await page.evaluate(() => window.__d2.falas.find((x) => x[0] === 'frase:trace_completo'));
    assert.deepEqual(f, esperado);
    assert.ok(await page.evaluate(() => window.__d2.efeitos.includes('brilho')));
    assert.deepEqual(erros, []);
    await ctx.close();
  }
});

// tamanho da letra e layout em várias telas: sem rolagem, caixa dentro da área, letra bem grande
for (const [nome, [w, h]] of Object.entries(TELAS)) {
  await teste(`layout ${nome}: letra grande, dentro da tela, sem rolagem`, async () => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    await page.route('**/assets/svg/**', (route) => {
      const u = new URL(route.request().url());
      if (existsSync(RAIZ + decodeURIComponent(u.pathname))) return route.continue();
      route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#fff"/></svg>' });
    });
    await page.goto(`${base}/tests/d2-harness.html?jogo=trace&foco=m&letras=m&liberadas=m`);
    await page.waitForSelector('.j-trace-svg');
    await dormir(600);
    const r = await page.evaluate(() => {
      const s = document.querySelector('.j-trace-svg'), b = s.getBoundingClientRect(), p = document.querySelector('.j-palco').getBoundingClientRect();
      const vb = s.viewBox.baseVal;
      return { layout: s.dataset.layout, l: b.left, t: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom, px: b.width / vb.width, pl: p.left, pt: p.top, pr: p.right, pb: p.bottom,
        docH: document.documentElement.scrollHeight, winH: innerHeight, docW: document.documentElement.scrollWidth, winW: innerWidth };
    });
    console.log(`     ${nome}: layout ${r.layout}, ${Math.round(r.w)}x${Math.round(r.h)} px, ${r.px.toFixed(2)} px por unidade (letra ${Math.round(r.px * 70)} px de altura)`);
    assert.ok(r.l >= 8 && r.r <= w - 8 && r.t >= pt(r) && r.b <= r.pb + 1, 'fora da área');
    assert.ok(r.docH <= r.winH && r.docW <= r.winW, 'rolagem');
    assert.ok(r.px * 70 >= 120, 'letra pequena: ' + r.px * 70);
    if (w < 500) assert.equal(r.layout, 'vertical', 'tela estreita: maiúscula em cima, minúscula embaixo');
    await page.screenshot({ path: `${SHOTS}/layout-${nome}.png` });
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}
function pt(r) { return r.pt - 1; }

await browser.close();
srv.kill();
console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
