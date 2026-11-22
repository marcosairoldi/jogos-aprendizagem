// Testes dos 4 mini-jogos (Playwright, 360x800 móvel). Uso: node tests/d2-jogos.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import assert from 'node:assert/strict';
import { curriculoMock } from './d2-mock-curriculo.js';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = '/tmp/claude-0/d2';
mkdirSync(SHOTS, { recursive: true });

const livre = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const porta = await livre();
const srv = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${porta}`;

const browser = await chromium.launch();
let falhas = 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function novaPagina(query) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  // ícones/cenários dos outros agentes podem ainda não existir: serve um SVG de reserva
  await page.route('**/assets/svg/**', (route) => {
    const u = new URL(route.request().url());
    if (existsSync(RAIZ + decodeURIComponent(u.pathname))) return route.continue();
    route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#fff"/></svg>' });
  });
  await page.goto(`${base}/tests/d2-harness.html?${query}`);
  await page.waitForFunction(() => window.__d2 && window.__d2.pronto);
  return { page, erros, ctx };
}

async function teste(nome, fn) {
  if (process.env.SO && !nome.includes(process.env.SO)) return;
  try { await fn(); console.log('ok   ', nome); }
  catch (e) { falhas++; console.log('FALHA', nome, '\n     ', e.stack.split('\n').slice(0, 14).join('\n      ')); }
}

const falas = (page) => page.evaluate(() => window.__d2.falas.flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x))));
const ultimaFala = (page) => page.evaluate(() => window.__d2.falas.at(-1));
const esperar = (page, fn, arg, t = 8000) => page.waitForFunction(fn, arg, { timeout: t });

// Layout: sem rolagem, alvos >= 64 px, a >= 16 px das bordas.
async function conferirLayout(page, rotulo) {
  const r = await page.evaluate(() => {
    const raiz = document.getElementById('raiz');
    const alvos = [...document.querySelectorAll('.j-cartao, .j-ouvir, .j-sereia, .j-bloco')]
      .filter((e) => !e.matches('.j-acerto, .j-grande, .j-some, .j-fora') && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0')
      .map((e) => { const b = e.getBoundingClientRect(); return { c: e.className, w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom }; });
    return {
      docH: document.documentElement.scrollHeight, winH: innerHeight, raizSH: raiz.scrollHeight, raizCH: raiz.clientHeight,
      docW: document.documentElement.scrollWidth, winW: innerWidth, alvos,
    };
  });
  assert.ok(r.docH <= r.winH, `${rotulo}: rolagem vertical do documento ${r.docH}>${r.winH}`);
  assert.ok(r.docW <= r.winW, `${rotulo}: rolagem horizontal`);
  assert.ok(r.raizSH <= r.raizCH + 1, `${rotulo}: conteúdo maior que a raiz ${r.raizSH}>${r.raizCH}`);
  for (const a of r.alvos) {
    assert.ok(a.w >= 63.5 && a.h >= 63.5, `${rotulo}: alvo pequeno ${a.c} ${a.w}x${a.h}`);
    // tolerância de 2 px por causa de escala em animações
    assert.ok(a.l >= 14 && a.r <= 360 - 14, `${rotulo}: alvo perto da borda ${a.c} ${a.l}..${a.r}`);
    assert.ok(a.b <= 800 - 8, `${rotulo}: alvo passa do fim ${a.c}`);
  }
  return r;
}

const alvoDaUltimaPergunta = async (page) => {
  const f = await ultimaFala(page);
  return f.filter((x) => typeof x === 'string' && x.startsWith('som:')).at(-1).slice(4);
};

// ---------- disponivel() ----------
await teste('disponivel(): regras de cada jogo', async () => {
  const mods = {};
  for (const j of ['escute', 'caca', 'junte', 'trace']) mods[j] = (await import(`../js/jogos/${j}.js`)).default;
  for (const j of Object.keys(mods)) {
    assert.equal(mods[j].id, j);
    assert.equal(mods[j].icone, `assets/svg/ui/jogo-${j}.svg`);
    assert.equal(typeof mods[j].iniciar, 'function');
  }
  // sem sílaba só com as liberadas, o Junte usa os pares de vogais: nunca fica trancado
  assert.equal(mods.junte.disponivel(['a'], curriculoMock), true, 'só "a": usa pares de vogais');
  assert.equal(mods.junte.disponivel(['a', 'i'], curriculoMock), true, 'a+i: "ai"');
  assert.equal(mods.junte.disponivel(['m'], curriculoMock), true, 'só "m": completa com vogais');
  assert.equal(mods.junte.disponivel(['m', 'a'], curriculoMock), true, '"ma"');
  assert.equal(mods.junte.disponivel(['m', 'a', 'p'], curriculoMock), true, 'mapa');
  assert.equal(mods.escute.disponivel(['a'], curriculoMock), true);
  assert.equal(mods.caca.disponivel(['a'], curriculoMock), true);
  assert.equal(mods.caca.disponivel([], curriculoMock), false);
});

// ---------- Escute e Toque ----------
await teste('escute: instrução, erro sem punição, rodada completa', async () => {
  const { page, erros, ctx } = await novaPagina('jogo=escute');
  await esperar(page, () => document.querySelectorAll('.j-cartao').length >= 2);
  const f0 = await falas(page);
  assert.ok(f0.includes('frase:escute_instrucao') && f0.includes('frase:escute_pergunta'), 'fala a instrução');
  assert.ok(await page.$('.j-ouvir[aria-label]'), 'botão ouvir com aria-label');
  await conferirLayout(page, 'escute');
  await page.screenshot({ path: `${SHOTS}/escute-1.png` });

  const nItens = 5;
  for (let i = 0; i < nItens; i++) {
    await esperar(page, () => document.querySelectorAll('.j-cartao').length >= 2 && !document.querySelector('.j-acerto'));
    const alvo = await alvoDaUltimaPergunta(page);
    const qtd = await page.locator('.j-cartao').count();
    assert.ok(qtd >= 2 && qtd <= 4, 'opções entre 2 e 4');
    if (i === 0) {
      const errado = page.locator(`.j-cartao:not([data-letra="${alvo}"])`).first();
      const nFalas = (await page.evaluate(() => window.__d2.falas.length));
      await errado.tap({ force: true });
      await esperar(page, () => document.querySelector('.j-some'));
      await dormir(100);
      const ult = await ultimaFala(page);
      assert.deepEqual(ult, ['frase:quase', 'som:' + alvo], 'repete o som com carinho');
      assert.ok((await page.evaluate(() => window.__d2.falas.length)) > nFalas);
      await esperar(page, () => !document.querySelector('.j-balanca') || true);
      await dormir(800);
      assert.equal(await page.evaluate(() => window.__d2.registros.length), 0, 'erro não registra ainda');
      const cor = await page.evaluate(() => [...document.querySelectorAll('.j-cartao')].map((c) => getComputedStyle(c).borderTopColor + getComputedStyle(c).backgroundColor).join('|'));
      assert.ok(!/rgb\(2[0-5]\d, [0-4]?\d, [0-4]?\d\)/.test(cor), 'sem vermelho');
      await conferirLayout(page, 'escute após erro');
      if (qtd === 2) {
        assert.ok(await page.$('.j-convida'), 'sobrou só a certa e ela convida');
        await page.screenshot({ path: `${SHOTS}/escute-2-erro.png` });
      }
    }
    const certo = page.locator(`.j-cartao[data-letra="${alvo}"]`);
    await certo.tap({ force: true });
    await certo.tap({ force: true }); // toque duplo: deve ser ignorado
    await dormir(150);
  }
  await esperar(page, () => window.__d2.terminou, null, 12000);
  const r = await page.evaluate(() => ({ t: window.__d2.terminou, reg: window.__d2.registros }));
  assert.equal(r.t.jogo, 'escute');
  assert.equal(r.t.itens.length, nItens);
  assert.equal(r.reg.length, nItens, 'um registro por item (toque duplo ignorado)');
  assert.equal(r.reg[0].acertouPrimeira, false, 'primeiro item teve erro');
  assert.ok(r.reg.slice(1).every((x) => x.acertouPrimeira === true));
  assert.ok(r.reg.every((x) => x.jogo === 'escute'));
  const fs = await falas(page);
  assert.ok(fs.includes('frase:rodada_fim'));
  assert.ok(fs.some((x) => /^frase:acerto_[1-4]$/.test(x)));
  assert.equal(await page.evaluate(() => window.__d2.terminou && 1), 1);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await teste('escute: alvo "nova" evita par confundível e usa próximas letras', async () => {
  // só "p" liberada, alvo nova p: distratores vêm de curriculo.ordem, sem "b"
  const { page, erros, ctx } = await novaPagina('jogo=escute&liberadas=p&letras=p&foco=p&estados=p:nova');
  for (let i = 0; i < 5; i++) {
    await esperar(page, () => document.querySelectorAll('.j-cartao').length >= 2 && !document.querySelector('.j-acerto'));
    const letras = await page.$$eval('.j-cartao', (c) => c.map((x) => x.dataset.letra));
    assert.equal(letras.length, 2, 'nova -> opcoesMin = 2');
    assert.ok(!letras.includes('b'), 'sem b junto de p: ' + letras);
    const alvo = await alvoDaUltimaPergunta(page);
    await page.locator(`.j-cartao[data-letra="${alvo}"]`).tap({ force: true });
    await dormir(200);
  }
  await esperar(page, () => window.__d2.terminou, null, 12000);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- Caça-Som ----------
await teste('caca: instrução, erro, rodada completa', async () => {
  const { page, erros, ctx } = await novaPagina('jogo=caca');
  await esperar(page, () => document.querySelectorAll('.j-cartao').length === 3);
  const f0 = await falas(page);
  assert.ok(f0.includes('frase:caca_instrucao') && f0.includes('frase:caca_pergunta'));
  await conferirLayout(page, 'caca');
  await page.screenshot({ path: `${SHOTS}/caca-1.png` });
  for (let i = 0; i < 5; i++) {
    await esperar(page, () => document.querySelectorAll('.j-cartao').length === 3 && !document.querySelector('.j-acerto'));
    const alvo = await alvoDaUltimaPergunta(page);
    const ids = await page.$$eval('.j-cartao', (c) => c.map((x) => x.dataset.palavra));
    const ini = ids.map((id) => curriculoMock.palavras[id].inicial);
    assert.equal(ini.filter((x) => x === alvo).length, 1, `exatamente uma figura começa com ${alvo}: ${ids}`);
    const certoId = ids[ini.indexOf(alvo)];
    if (i === 0) {
      const errId = ids.find((id) => id !== certoId);
      await page.locator(`.j-cartao[data-palavra="${errId}"]`).tap({ force: true });
      await esperar(page, () => document.querySelector('.j-some'));
      await dormir(900);
      assert.deepEqual(await ultimaFala(page), ['frase:quase', 'som:' + alvo]);
      assert.equal(await page.locator('.j-cartao:not(.j-some)').count(), 2);
      await page.screenshot({ path: `${SHOTS}/caca-2-erro.png` });
      // segundo erro: sobra só a certa e ela convida
      const err2 = ids.find((id) => id !== certoId && id !== errId);
      await page.locator(`.j-cartao[data-palavra="${err2}"]`).tap({ force: true });
      await dormir(900);
      assert.ok(await page.$('.j-convida'));
    }
    await page.locator(`.j-cartao[data-palavra="${certoId}"]`).tap({ force: true });
    await dormir(100);
    const ult = await falas(page);
    assert.ok(ult.includes('pal:' + certoId), 'fala a palavra ao acertar');
  }
  await esperar(page, () => window.__d2.terminou, null, 12000);
  const r = await page.evaluate(() => ({ t: window.__d2.terminou, reg: window.__d2.registros }));
  assert.equal(r.t.itens.length, 5);
  assert.equal(r.reg.length, 5);
  assert.equal(r.reg[0].acertouPrimeira, false);
  assert.ok(r.reg.slice(1).every((x) => x.acertouPrimeira));
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- Junte os Sons ----------
async function rodarJunte(page, { errarPalavra }) {
  let palavras = 0, silabas = 0, errou = false;
  for (let i = 0; i < 5; i++) {
    await esperar(page, () => document.querySelector('.j-bloco') && !document.querySelector('.j-bloco.j-aceso') && !document.querySelector('.j-juntos'), null, 10000);
    const n = await page.locator('.j-bloco').count();
    if (i === 0) {
      assert.ok((await falas(page)).includes('frase:junte_instrucao'));
      await conferirLayout(page, 'junte');
      await page.screenshot({ path: `${SHOTS}/junte-1.png` });
    }
    const nFalasAntes = await page.evaluate(() => window.__d2.falas.length);
    for (let k = 0; k < n; k++) {
      if (k === 0 && i === 1) await page.locator('.j-bloco').first().tap({ force: true }); // também vale tocar o bloco
      else await page.locator('.j-sereia').tap({ force: true });
      await esperar(page, (c) => document.querySelectorAll('.j-bloco.j-aceso').length === c, k + 1);
      if (k === 0) await page.screenshot({ path: `${SHOTS}/junte-2-nadando.png` });
      await dormir(120);
    }
    // sons dos blocos falados em ordem
    const fb = (await page.evaluate((a) => window.__d2.falas.slice(a).flat(), nFalasAntes));
    assert.ok(fb.slice(0, n).every((x) => /^(som|sil):/.test(x)), 'blocos falam som/sil: ' + fb.slice(0, n));
    await esperar(page, (a) => window.__d2.falas.slice(a).some((f) => f[0] === 'frase:junte_resultado'), nFalasAntes, 8000);
    await dormir(200);
    const resultado = (await page.evaluate((a) => window.__d2.falas.slice(a), nFalasAntes)).find((f) => f[0] === 'frase:junte_resultado');
    assert.ok(resultado && /^(pal|sil):/.test(resultado[1]), 'fala o resultado: ' + JSON.stringify(resultado));
    if (resultado[1].startsWith('sil:')) {
      silabas++;
      await dormir(900);
      continue;
    }
    palavras++;
    await esperar(page, () => document.querySelector('.j-opcoes-junte.j-visivel'));
    assert.equal(await page.locator('.j-opcoes-junte .j-cartao').count(), 2, 'duas figuras');
    const palId = resultado[1].slice(4);
    if (palavras === 1) {
      await conferirLayout(page, 'junte escolha');
      await page.screenshot({ path: `${SHOTS}/junte-3-escolha.png` });
    }
    if (errarPalavra && !errou) {
      errou = true;
      await page.locator(`.j-opcoes-junte .j-cartao:not([data-palavra="${palId}"])`).tap({ force: true });
      await esperar(page, () => document.querySelector('.j-some'));
      await dormir(900);
      const ult = await ultimaFala(page);
      assert.equal(ult[0], 'frase:quase');
      assert.equal(ult.at(-1), 'pal:' + palId);
      assert.ok(ult.slice(1, -1).every((x) => x.startsWith('sil:')), 'repete as sílabas');
      assert.ok(await page.$('.j-convida'));
    }
    await page.locator(`.j-opcoes-junte .j-cartao[data-palavra="${palId}"]`).tap({ force: true });
    await dormir(200);
  }
  return { palavras, silabas, errou };
}

await teste('junte: sereia, junção, escolha, rodada completa', async () => {
  const { page, erros, ctx } = await novaPagina('jogo=junte&liberadas=a,e,i,o,u,m,p,b,t&foco=m&letras=m,a,p');
  await esperar(page, () => document.querySelector('.j-bloco'));
  const r = await rodarJunte(page, { errarPalavra: true });
  assert.ok(r.palavras >= 1 && r.silabas >= 1, 'mistura sílabas e palavras');
  await esperar(page, () => window.__d2.terminou, null, 12000);
  const t = await page.evaluate(() => ({ t: window.__d2.terminou, reg: window.__d2.registros }));
  assert.equal(t.t.jogo, 'junte');
  assert.equal(t.t.itens.length, 5);
  assert.equal(t.reg.length, r.palavras, 'registra só palavras');
  assert.equal(t.reg[0].acertouPrimeira, false);
  assert.ok(t.reg.every((x) => curriculoMock.letras[x.letra]));
  assert.deepEqual(erros, []);
  await ctx.close();
});

await teste('junte: etapa das vogais usa pares (ai, oi)', async () => {
  const { page, erros, ctx } = await novaPagina('jogo=junte&liberadas=a,e,i,o,u&foco=a&letras=a,i,o&estados=a:nova');
  assert.equal(await page.evaluate(() => window.__d2.disponivel), true);
  const r = await rodarJunte(page, { errarPalavra: false });
  assert.equal(r.palavras, 0);
  assert.equal(r.silabas, 5);
  await esperar(page, () => window.__d2.terminou, null, 12000);
  assert.equal(await page.evaluate(() => window.__d2.registros.length), 0, 'sílabas não registram');
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- Trace a Letra ----------
const tracados = JSON.parse(readFileSync(RAIZ + 'data/tracados.json', 'utf8'));
// traços (pontos guia do pontilhado) em px de tela, lidos do DOM: valem para o layout lado a lado e para o vertical
const tracosTela = (page) => page.evaluate(() => [...document.querySelectorAll('.j-trace-svg .j-trace-pontos')].map((pl) => {
  const m = pl.getScreenCTM();
  return [...pl.points].map((p) => [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]);
}));
async function arrastar(page, traco, { ate = traco.length } = {}) {
  const [x0, y0] = traco[0];
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i < ate; i++) { const [x, y] = traco[i]; await page.mouse.move(x, y, { steps: 2 }); }
  await page.mouse.up();
}

await teste('trace: arrasta os traços de 2 letras e conclui', async () => {
  const { page, erros, ctx } = await novaPagina('jogo=trace&foco=m&letras=m,a&liberadas=m,a');
  await esperar(page, () => document.querySelector('.j-trace-svg'));
  const f0 = await falas(page);
  assert.ok(f0.includes('frase:trace_instrucao') && f0.includes('som:m'));
  await conferirLayout(page, 'trace');
  assert.ok(await page.$('.j-trace-estrela'), 'estrelinha no início');
  await page.screenshot({ path: `${SHOTS}/trace-1.png` });
  const info = await page.evaluate(() => ({ touch: getComputedStyle(document.querySelector('.j-trace-svg')).touchAction }));
  assert.equal(info.touch, 'none');
  for (const letra of ['m', 'a']) {
    await esperar(page, (l) => !document.querySelector('.j-trace-completa') && window.__d2.falas.some((f) => f[0] === 'frase:trace_instrucao' && f[1] === 'som:' + l), letra);
    const tr = await tracosTela(page);
    for (let t = 0; t < tr.length; t++) {
      if (letra === 'm' && t === 0) {
        // arrasta só metade, levanta o dedo: o progresso fica
        await arrastar(page, tr[0], { ate: Math.floor(tr[0].length / 2) });
        const pontos = await page.evaluate(() => +document.querySelector('.j-trace-svg').dataset.cobertos);
        assert.ok(pontos >= 5, 'progresso mantido ao levantar o dedo');
        await page.screenshot({ path: `${SHOTS}/trace-2-meio.png` });
        // continua de onde parou (dedo cai de novo no meio do traço)
        await arrastar(page, tr[0].slice(Math.floor(tr[0].length / 2) - 1));
      } else {
        await arrastar(page, tr[t]);
      }
      await dormir(60);
    }
    await esperar(page, () => document.querySelector('.j-trace-completa'));
    await page.screenshot({ path: `${SHOTS}/trace-3-completa-${letra}.png` });
    await esperar(page, (l) => window.__d2.falas.some((f) => f[0] === 'frase:trace_completo' && f[1] === 'nome:' + l && f[3] === 'som:' + l), letra);
  }
  await esperar(page, () => window.__d2.terminou, null, 12000);
  const r = await page.evaluate(() => ({ t: window.__d2.terminou, reg: window.__d2.registros, ef: window.__d2.efeitos }));
  assert.equal(r.t.jogo, 'trace');
  assert.deepEqual(r.t.itens.map((i) => i.letra), ['m', 'a']);
  assert.ok(r.reg.every((x) => x.acertouPrimeira === true && x.jogo === 'trace'));
  assert.ok(r.ef.includes('pop') && r.ef.includes('brilho'));
  assert.deepEqual(erros, []);
  await ctx.close();
});

await teste('trace: as 26 letras (maiúscula e minúscula) são completáveis', async () => {
  const todas = Object.keys(tracados.letras);
  assert.equal(todas.length, 26);
  for (const l of todas) {
    const { page, erros, ctx } = await novaPagina(`jogo=trace&foco=${l}&letras=${l}&liberadas=${l}`);
    await esperar(page, () => document.querySelector('.j-trace-svg'));
    for (const t of await tracosTela(page)) await arrastar(page, t);
    await esperar(page, () => document.querySelector('.j-trace-completa'), null, 4000);
    assert.deepEqual(erros, [], l);
    await ctx.close();
  }
});

// ---------- destruir ----------
for (const j of ['escute', 'caca', 'junte', 'trace']) {
  await teste(`${j}: destruir() limpa tudo`, async () => {
    const { page, erros, ctx } = await novaPagina(`jogo=${j}`);
    await esperar(page, () => document.querySelector('.j-ouvir'));
    await dormir(200);
    await page.evaluate(() => window.__d2.jogo.destruir());
    const n = await page.evaluate(() => window.__d2.falas.length);
    const r = await page.evaluate(() => ({ filhos: document.getElementById('raiz').children.length, paradas: window.__d2.paradas, cls: document.getElementById('raiz').className }));
    assert.equal(r.filhos, 0);
    assert.ok(r.paradas >= 1, 'chamou audio.parar()');
    assert.equal(r.cls, '');
    await dormir(1800);
    assert.equal(await page.evaluate(() => window.__d2.falas.length), n, 'nenhuma fala depois de destruir');
    assert.equal(await page.evaluate(() => window.__d2.terminou), null);
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

await browser.close();
srv.kill();
console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
