// Testes do jogo Casinhas dos Sons (js/jogos/casinhas.js), contra o app real.
// Uso: node tests/l-casinhas.test.mjs   (fotos em /tmp/claude-0/l/)
import { mkdirSync } from 'node:fs';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, dormir, esperarAte, curriculo, frases,
  procurarVermelhoNaPagina, esperarTela,
} from './e-lib.mjs';

const FOTOS = '/tmp/claude-0/l';
mkdirSync(FOTOS, { recursive: true });
const R = criarRelator('Casinhas dos Sons');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();

const LONGAS = Object.keys(curriculo.letras).filter((l) => curriculo.letras[l].tipo === 'consoante' && curriculo.letras[l].continuo);
const CURTAS = Object.keys(curriculo.letras).filter((l) => curriculo.letras[l].tipo === 'consoante' && !curriculo.letras[l].continuo);
const VOGAIS = Object.keys(curriculo.letras).filter((l) => curriculo.letras[l].tipo === 'vogal');
const TODAS = Object.keys(curriculo.letras);
const NOMES_DE_LETRA = /^(ême|eme|pê|bê|tê|dê|efe|ele|ene|erre|esse|zê|jota|gê|cê|vê)$/i;

function seedProgresso(liberadas) {
  return {
    v: 1, nome: '', guia: 'lumi', liberadas, hist: {}, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 },
    tempoTotal: 0, tempoSessao: 0, sessoes: 1, sessaoId: 1, ultima: Date.now(),
    ajustes: { itensPorRodada: null, letrasRevisao: null, tracadoNaLicao: true }, ultimoBackup: null,
  };
}

// ---------- ajudantes ----------
async function abrirCasinhas(w, h, { fase = 1, acertos = {}, liberadas = TODAS, contexto = null, semMexerEstado = false } = {}) {
  const a = await abrirApp(browser, srv.base, { viewport: { width: w, height: h }, seed: seedProgresso(liberadas), rapido: true, contexto });
  const { page } = a;
  a.cdp = await page.context().newCDPSession(page);
  await entrarNoJogo(a, { fase, acertos, semMexerEstado });
  return a;
}
async function entrarNoJogo(a, { fase = 1, acertos = {}, semMexerEstado = false } = {}) {
  const { page } = a;
  if (await page.evaluate(() => document.getElementById('app').dataset.tela) === 'inicio') {
    await page.touchscreen.tap(page.viewportSize().width / 2, page.viewportSize().height * 0.75);
  }
  await page.waitForSelector('button[aria-label="Brincadeiras"]', { timeout: 15000 });
  await dormir(500);
  await page.locator('button[aria-label="Brincadeiras"]').first().click();
  await page.waitForSelector('.menu-jogos');
  if (!semMexerEstado) {
    await page.evaluate(([f, ac]) => localStorage.setItem('trilhaSons.casinhas', JSON.stringify({ fase: f, acertos: { 1: 0, 2: 0, 3: 0, ...ac } })), [fase, acertos]);
  }
  await dormir(200);
  await page.locator('.btn-jogo').nth(4).click();
  await page.waitForSelector('.cs-casas .cs-casa');
  await dormir(300);
}

// O que o jogo mandou falar, em ids "som:v", "sil:va", "pal:uva", "frase:casinhas_monte".
async function falados(a, desde = 0) {
  const b = await a.esp.bruto();
  const saida = [];
  for (const x of b) {
    if (x.k === 'audio') {
      const m = /\/(som|sil|pal|frase)_([a-z0-9_]+)\.(mp3|m4a)/.exec(x.url);
      saida.push(m ? m[1] + ':' + m[2] : 'audio:' + x.url);
    } else if (x.k === 'fala') {
      if (x.idvoz) saida.push(x.idvoz.replace('_', ':'));
      else {
        const k = Object.entries(frases).find(([kk, v]) => !kk.startsWith('_') && v.replace(/\{nome\}/g, 'princesa') === (x.texto || '').trim());
        if (k) saida.push('frase:' + k[0]); else if ((x.texto || '').trim()) saida.push('fala:' + x.texto.trim());
      }
    }
  }
  return saida.slice(desde);
}
async function alvoAtual(a, { minimo = 1 } = {}) {
  return esperarAte(async () => {
    const f = await falados(a);
    const idx = [];
    f.forEach((x, i) => { if (x === 'frase:casinhas_monte' || x === 'frase:casinhas_palavra') idx.push(i); });
    if (idx.length < minimo) return null;
    const i = idx[idx.length - 1];
    const prox = f[i + 1];
    if (!prox) return null;
    return { n: idx.length, tipo: f[i] === 'frase:casinhas_palavra' ? 'palavra' : 'silaba', id: prox.split(':')[1] };
  }, { timeout: 10000, msg: 'alvo falado' });
}
const centro = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
async function arrastar(a, origem, destino, { soltar = true, cancelar = false } = {}) {
  const { page, cdp } = a;
  const p = await centro(page, origem), q = await centro(page, destino);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + ((q.x - p.x) * i) / 10, y: p.y + ((q.y - p.y) * i) / 10, id: 1 }] });
    await dormir(16);
  }
  if (cancelar) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); return; }
  if (soltar) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tocar(a, sel) {
  const c = await centro(a.page, sel);
  await a.page.touchscreen.tap(c.x, c.y);
}
const peca = (id) => `.cs-bandeja .cs-peca[data-id="${id}"]`;
const casa = (i) => `.cs-casa[data-casa="${i}"]`;
const textoSilaba = (id) => id;

// Resolve o item atual (arrastando ou tocando). Espera o próximo item (ou o fim da rodada).
async function resolverItem(a, modo = 'arrastar', alvo = null) {
  const al = alvo || await alvoAtual(a);
  const passos = al.tipo === 'palavra'
    ? curriculo.palavras[al.id].silabas.map((s, i) => [s, i])
    : [[al.id[0], 0], [al.id[1], 1]];
  for (const [id, i] of passos) {
    if (modo === 'arrastar') await arrastar(a, peca(id), casa(i));
    else { await tocar(a, peca(id)); await dormir(80); await tocar(a, casa(i)); }
    await dormir(450);
  }
  return al;
}
async function esperarProximo(a, n) {
  await esperarAte(async () => {
    const tela = await a.page.evaluate(() => document.getElementById('app').dataset.tela);
    if (tela !== 'menu') return true;
    const f = await falados(a);
    return f.filter((x) => x === 'frase:casinhas_monte' || x === 'frase:casinhas_palavra').length > n;
  }, { timeout: 15000, msg: 'próximo item' });
  await dormir(200);
}
const lerEstado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.casinhas') || 'null'));
const trazer = (page, sel) => page.$$eval(sel, (es) => es.map((e) => ({ id: e.dataset.id, tipo: e.dataset.tipo, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
const existePalavra = (sil) => Object.keys(curriculo.palavras).some((id) => curriculo.palavras[id].figura && palavraDaSilaba(sil, id));
// espera o fim do acerto: sílaba falada e, se existir palavra com figura, a palavra
async function esperarAcerto(a, al, ini) {
  return esperarAte(async () => {
    const x = (await falados(a)).slice(ini);
    if (!x.includes('sil:' + al.id)) return null;
    if (existePalavra(al.id) && !x.some((y) => y.startsWith('pal:'))) return null;
    return x;
  }, { timeout: 10000, msg: 'acerto falado' });
}
const palavraDaSilaba = (sil, pal) => pal.startsWith(sil) || (curriculo.palavras[pal]?.silabas || []).includes(sil);

// =====================================================================
console.log('--- menu e abertura');
{
  const a = await abrirCasinhas(360, 800, { semMexerEstado: false });
  const { page, coleta } = a;
  // (abriu pelo menu: entrarNoJogo clicou no 5º botão)
  ok(await page.locator('.cs-casas').count() === 1, 'abre pelo menu (5º botão)');
  await page.locator('button[aria-label="Voltar para a trilha"]').first().click();
  await page.waitForSelector('.trilha-area, .trilha');
  await page.locator('button[aria-label="Brincadeiras"]').first().click();
  await page.waitForSelector('.menu-jogos');
  ok(await page.locator('.btn-jogo').count() === 5, 'menu com 5 brincadeiras');
  const rotulo = await page.locator('.btn-jogo').nth(4).innerText();
  ok(/Casinhas dos Sons/.test(rotulo), 'rótulo "Casinhas dos Sons" no menu', rotulo);
  const textoPagina = await page.content();
  ok(!/LeTrilha|ABC da Gabi/i.test(textoPagina), 'sem os nomes proibidos');
  await page.locator('.btn-jogo').nth(4).click();
  await page.waitForSelector('.cs-casas .cs-casa');
  await alvoAtual(a);
  const f = await falados(a);
  const iInstr = f.indexOf('frase:casinhas_instrucao');
  const iMonte = f.indexOf('frase:casinhas_monte');
  ok(iInstr >= 0 && iMonte > iInstr, 'fala a instrução antes do alvo na primeira rodada', JSON.stringify(f.slice(-8)));
  ok(/^sil:[a-z]{2}$/.test(f[iMonte + 1] || ''), 'alvo falado como sílaba (frase:casinhas_monte + sil:xx)', f[iMonte + 1]);
  // "Ouvir de novo" tem rótulo e repete o alvo (sem a instrução)
  ok(await page.locator('.j-ouvir .j-rotulo').innerText() === 'Ouvir de novo', 'botão "Ouvir de novo" com rótulo');
  const antes = (await falados(a)).length;
  await tocar(a, '.j-ouvir');
  await dormir(300);
  const depois = (await falados(a)).slice(antes);
  ok(depois[0] === 'frase:casinhas_monte' && /^sil:/.test(depois[1]), '"Ouvir de novo" repete o alvo', JSON.stringify(depois));
  // rótulo "Fase" e três bolinhas numeradas
  ok(await page.locator('.cs-rotulo-fase').innerText() === 'Fase', 'rótulo "Fase"');
  ok(JSON.stringify(await page.$$eval('.cs-fase', (b) => b.map((x) => x.textContent))) === '["1","2","3"]', 'bolinhas 1, 2 e 3');
  ok(await page.locator('.cs-fase.cs-atual').innerText() === '1', 'fase 1 em destaque');
  await page.screenshot({ path: `${FOTOS}/t-abertura.png` });
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo na abertura', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- fase 1: só consoantes longas e A; arrastar certo');
{
  const a = await abrirCasinhas(360, 800, { fase: 1 });
  const { page, coleta } = a;
  const vistos = new Set();
  for (let k = 0; k < 3; k++) {
    const al = await alvoAtual(a, { minimo: k + 1 });
    const cs = await trazer(page, '.cs-peca[data-tipo="c"]');
    const vs = await trazer(page, '.cs-peca[data-tipo="v"]');
    cs.forEach((c) => vistos.add(c.id));
    ok(cs.length >= 3 && cs.length <= 4, `fase 1 item ${k + 1}: 3 a 4 consoantes (${cs.length})`);
    ok(cs.every((c) => LONGAS.includes(c.id)), `fase 1 item ${k + 1}: só consoantes longas`, cs.map((c) => c.id).join(','));
    ok(vs.length === 1 && vs[0].id === 'a', `fase 1 item ${k + 1}: só a vogal A`);
    ok(cs.some((c) => c.id === al.id[0]), `fase 1 item ${k + 1}: consoante certa está na bandeja`);
    ok(al.id[1] === 'a', `fase 1 item ${k + 1}: alvo é consoante + A (${al.id})`);
    ok([...cs, ...vs].every((p) => p.w >= 71.5 && p.h >= 71.5), `fase 1 item ${k + 1}: peças >= 72 px`);
    ok(await page.locator('.cs-peca').evaluateAll((es) => es.every((e) => /^[A-Z]$/.test(e.textContent) && getComputedStyle(e).fontFamily.includes('Andika'))), 'letras em MAIÚSCULA com a fonte Andika');
    const ini = (await falados(a)).length;
    // tocar na consoante toca o SOM
    await tocar(a, peca(al.id[0]));
    await dormir(250);
    const f1 = (await falados(a)).slice(ini);
    ok(f1.includes('som:' + al.id[0]), `tocar na consoante fala o som (som:${al.id[0]})`, JSON.stringify(f1));
    ok(f1.every((x) => !/^fala:/.test(x) && !NOMES_DE_LETRA.test(x.split(':')[1] || '')), 'nunca o nome da letra');
    // arrasta a consoante e a vogal certas
    const ini2 = (await falados(a)).length;
    await arrastar(a, peca(al.id[0]), casa(0));
    await dormir(450);
    ok(await page.locator(`${casa(0)} .cs-peca[data-id="${al.id[0]}"]`).count() === 1, 'consoante certa fica na primeira casinha');
    await arrastar(a, peca('a'), casa(1));
    await dormir(450);
    ok(await page.locator(`${casa(1)} .cs-peca[data-id="a"]`).count() === 1, 'vogal certa fica na segunda casinha');
    if (k === 0) await page.screenshot({ path: `${FOTOS}/t-fase1-acerto.png` });
    const f = await esperarAcerto(a, al, ini2);
    ok(f.includes('sil:' + al.id), `fala a sílaba formada (sil:${al.id})`, JSON.stringify(f));
    if (existePalavra(al.id)) {
      const pal = f.find((y) => y.startsWith('pal:')).split(':')[1];
      ok(palavraDaSilaba(al.id, pal), `fala uma palavra que contém a sílaba (${al.id} → ${pal})`);
      ok(f.indexOf('sil:' + al.id) < f.findIndex((y) => y.startsWith('pal:')), 'sílaba antes da palavra');
      const srcFig = await page.locator('.cs-cartao-figura img').getAttribute('src').catch(() => null);
      ok(srcFig && srcFig.includes(pal + '.svg'), `mostra a figura da palavra (${pal})`, srcFig);
    } else ok(await page.locator('.cs-silaba-grande').innerText() === al.id.toUpperCase(), `sem palavra para ${al.id}: mostra só a sílaba`);
    ok(await page.locator('.cs-casas.cs-feliz').count() === 1, 'animação alegre de acerto');
    await esperarProximo(a, k + 1);
  }
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  const reg = Object.values(salvo.hist).flat();
  ok(reg.length >= 3 && reg.every((h) => h.jogo === 'casinhas' && h.ok === true), 'registra os acertos de primeira (jogo casinhas)', JSON.stringify(reg));
  const est = await lerEstado(page);
  ok(est && est.fase === 1 && est.acertos['1'] === 3, 'salva fase e acertos em trilhaSons.casinhas', JSON.stringify(est));
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo na fase 1', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- erro que vira acerto');
{
  const a = await abrirCasinhas(360, 800, { fase: 1 });
  const { page, coleta } = a;
  const al = await alvoAtual(a);
  const c = al.id[0];
  const errada = (await trazer(page, '.cs-peca[data-tipo="c"]')).find((p) => p.id !== c).id;
  const vermelhoAntes = await page.evaluate(procurarVermelhoNaPagina, '.jogo-casinhas');
  ok(vermelhoAntes.length === 0, 'sem vermelho em repouso', vermelhoAntes.join(';'));
  let ini = (await falados(a)).length;
  await arrastar(a, peca(errada), casa(0));
  await dormir(120);
  const durante = await page.evaluate(procurarVermelhoNaPagina, '.jogo-casinhas');
  ok(durante.length === 0, 'sem vermelho durante o erro', durante.join(';'));
  await dormir(700);
  ok(await page.locator(`.cs-bandeja .cs-vaga-peca .cs-peca[data-id="${errada}"]`).count() === 1, 'peça errada volta para a bandeja');
  ok((await page.locator(peca(errada)).evaluate((e) => e.style.transform)) === '', 'peça errada sem deslocamento (voltou ao lugar)');
  ok(await page.locator(`${casa(0)} .cs-peca`).count() === 0, 'casinha continua vazia');
  let f = (await falados(a)).slice(ini);
  const iM = f.indexOf('frase:casinhas_monte');
  ok(iM >= 0 && f[iM + 1] === 'sil:' + al.id, 'repete o alvo depois do erro', JSON.stringify(f));
  ok(!f.some((x) => /falha|erro/.test(x)), 'nenhum som de falha');
  // vogal na casa da consoante e consoante na casa da vogal: volta sem punir
  ini = (await falados(a)).length;
  await arrastar(a, peca(c), casa(1));
  await dormir(700);
  ok(await page.locator(`${casa(1)} .cs-peca`).count() === 0, 'consoante na casa da vogal volta');
  ok(await page.locator('.cs-peca.cs-brilha').count() === 0, 'um erro só: ainda sem brilho');
  // segundo erro: a peça certa brilha
  await arrastar(a, peca(errada), casa(0));
  await dormir(800);
  const brilha = await page.locator('.cs-peca.cs-brilha').evaluateAll((es) => es.map((e) => e.dataset.id));
  ok(brilha.length === 1 && brilha[0] === c, 'depois de 2 erros a peça certa (consoante) brilha', JSON.stringify(brilha));
  await page.screenshot({ path: `${FOTOS}/t-erro-brilho.png` });
  const verm2 = await page.evaluate(procurarVermelhoNaPagina, '.jogo-casinhas');
  ok(verm2.length === 0, 'sem vermelho com a peça brilhando', verm2.join(';'));
  // pointercancel no meio do arraste: a peça volta
  await arrastar(a, peca(c), casa(0), { cancelar: true });
  await dormir(700);
  ok(await page.locator(`${casa(0)} .cs-peca`).count() === 0 && (await page.locator(peca(c)).evaluate((e) => e.style.transform)) === '', 'pointercancel: peça volta ao lugar');
  ok(!(await page.locator(peca(c)).evaluate((e) => e.classList.contains('cs-arrasta'))), 'pointercancel: sem peça presa no arraste');
  // soltar fora das casinhas: volta
  await arrastar(a, peca(c), '.cs-bandeja');
  await dormir(700);
  ok(await page.locator(`${casa(0)} .cs-peca`).count() === 0, 'soltar fora das casinhas: volta');
  // agora acerta (erro vira acerto) e a rodada segue
  await arrastar(a, peca(c), casa(0)); await dormir(450);
  await arrastar(a, peca(al.id[1]), casa(1)); await dormir(450);
  await esperarAcerto(a, al, ini);
  ok(true, 'depois do erro, o acerto funciona e fala a sílaba');
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  const reg = salvo.hist[c] || [];
  ok(reg.length === 1 && reg[0].ok === false, 'acertouPrimeira=false registrado (letra liberada)', JSON.stringify(reg));
  const est = await lerEstado(page);
  ok(est.acertos['1'] === 0, 'erro não conta para avançar de fase', JSON.stringify(est));
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo com erros e cancelamento', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- só registra consoantes liberadas');
{
  const a = await abrirCasinhas(360, 800, { fase: 1, liberadas: ['a'] });
  const al = await alvoAtual(a);
  await resolverItem(a, 'arrastar', al);
  await esperarAcerto(a, al, 0);
  const salvo = await a.page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok(Object.keys(salvo.hist).length === 0, 'consoante não liberada: não registra', JSON.stringify(salvo.hist));
  await a.ctx.close();
}

// =====================================================================
console.log('--- tocar-para-colocar');
{
  const a = await abrirCasinhas(360, 800, { fase: 1 });
  const { page, coleta } = a;
  const al = await alvoAtual(a);
  const c = al.id[0];
  const ini = (await falados(a)).length;
  await tocar(a, peca(c));
  await dormir(250);
  ok(await page.locator(peca(c)).evaluate((e) => e.classList.contains('cs-selecionada')), 'toque seleciona a peça');
  ok((await falados(a)).slice(ini).includes('som:' + c), 'toque na consoante fala o som');
  ok(await page.locator('.cs-casa.cs-convida-casa').count() >= 1, 'casinha convida a receber');
  await tocar(a, casa(0));
  await dormir(500);
  ok(await page.locator(`${casa(0)} .cs-peca[data-id="${c}"]`).count() === 1, 'toque na casinha coloca a consoante');
  await tocar(a, peca('a')); await dormir(100); await tocar(a, casa(1)); await dormir(500);
  ok(await page.locator(`${casa(1)} .cs-peca[data-id="a"]`).count() === 1, 'toque coloca a vogal');
  const ft = await esperarAcerto(a, al, ini);
  ok(ft.includes('sil:' + al.id), 'tocar-para-colocar completa e fala a sílaba');
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo no tocar-para-colocar');
  await a.ctx.close();
}

// =====================================================================
console.log('--- fase 2: todas as vogais e consoantes curtas');
{
  const a = await abrirCasinhas(412, 915, { fase: 2 });
  const { page, coleta } = a;
  const cons = new Set(), alvosC = new Set();
  let maxV = 0, minV = 9;
  for (let k = 0; k < 5; k++) {
    const al = await alvoAtual(a, { minimo: k + 1 });
    const cs = await trazer(page, '.cs-peca[data-tipo="c"]');
    const vs = await trazer(page, '.cs-peca[data-tipo="v"]');
    cs.forEach((x) => cons.add(x.id));
    alvosC.add(al.id[0]);
    maxV = Math.max(maxV, vs.length); minV = Math.min(minV, vs.length);
    ok(cs.length >= 3 && cs.length <= 4 && vs.length >= 2 && vs.length <= 5, `fase 2 item ${k + 1}: ${cs.length} consoantes e ${vs.length} vogais`);
    ok(vs.some((v) => v.id === al.id[1]) && cs.some((x) => x.id === al.id[0]), `fase 2 item ${k + 1}: peças certas na bandeja (${al.id})`);
    ok([...cs, ...vs].every((p) => p.w >= 71.5), 'peças >= 72 px');
    if (k === 3) await page.screenshot({ path: `${FOTOS}/t-fase2-412.png` });
    await resolverItem(a, k % 2 ? 'tocar' : 'arrastar', al);
    if (k < 4) await esperarProximo(a, k + 1);
  }
  ok([...alvosC].some((l) => CURTAS.includes(l)) && [...alvosC].some((l) => LONGAS.includes(l)), 'alvos misturam consoantes longas e curtas', [...alvosC].join(','));
  ok(!cons.has('q'), 'Q fora do jogo');
  ok(maxV >= 4 && minV <= 3, `número de vogais varia (${minV}..${maxV})`);
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo na fase 2', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- fase 3: montar a palavra por sílabas');
{
  const a = await abrirCasinhas(360, 800, { fase: 3 });
  const { page, coleta } = a;
  const al = await alvoAtual(a);
  ok(al.tipo === 'palavra', 'fase 3 fala frase:casinhas_palavra + pal:x', JSON.stringify(al));
  const palavra = curriculo.palavras[al.id];
  ok(palavra.juntar === true && palavra.silabas.length >= 2, 'palavra com juntar:true e sílabas preenchidas');
  const srcFig = await page.locator('.cs-cartao-figura img').getAttribute('src');
  ok(srcFig && srcFig.includes(al.id + '.svg'), 'figura visível desde o início', srcFig);
  ok(await page.locator('.cs-casa').count() === palavra.silabas.length, 'uma casinha por sílaba');
  const ps = await trazer(page, '.cs-peca');
  ok(ps.every((p) => p.tipo === 's' && p.w >= 71.5), 'peças são sílabas, >= 72 px');
  ok(palavra.silabas.every((s) => ps.some((p) => p.id === s)) && ps.length > palavra.silabas.length, 'bandeja traz as sílabas certas e distratores');
  // erro: sílaba da segunda casinha na primeira
  const ini0 = (await falados(a)).length;
  await arrastar(a, peca(palavra.silabas[1]), casa(0));
  await dormir(750);
  const fe = (await falados(a)).slice(ini0);
  ok(await page.locator(`${casa(0)} .cs-peca`).count() === 0, 'sílaba fora de ordem volta');
  ok(fe.includes('frase:casinhas_palavra') && fe.includes('pal:' + al.id), 'repete a palavra-alvo', JSON.stringify(fe));
  await page.screenshot({ path: `${FOTOS}/t-fase3.png` });
  // monta na ordem; cada sílaba é falada ao soltar
  const ini = (await falados(a)).length;
  await arrastar(a, peca(palavra.silabas[0]), casa(0));
  await dormir(600);
  ok((await falados(a)).slice(ini).includes('sil:' + palavra.silabas[0]), 'fala a sílaba ao soltar');
  await arrastar(a, peca(palavra.silabas[1]), casa(1));
  await dormir(450);
  const fim = await esperarAte(async () => { const x = (await falados(a)).slice(ini); return x.includes('pal:' + al.id) ? x : null; }, { timeout: 8000, msg: 'palavra no fim' });
  ok(fim.includes('sil:' + palavra.silabas[1]), 'fala a última sílaba e a palavra no fim', JSON.stringify(fim));
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok((salvo.hist[palavra.inicial] || []).length === 1 && salvo.hist[palavra.inicial][0].ok === false, 'registra a inicial da palavra (com erro de ordem)', JSON.stringify(salvo.hist));
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo na fase 3', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- fases: escolha pela adulta, avanço com 8 acertos, progresso salvo ao recarregar');
{
  const a = await abrirCasinhas(360, 800, { fase: 1, acertos: { 1: 7 } });
  const { page, coleta } = a;
  // fases não alcançadas ficam disponíveis (botões habilitados, sem destaque)
  ok(await page.locator('.cs-fase:not([disabled])').count() === 3, 'três bolinhas habilitadas');
  ok(await page.locator('.cs-fase.cs-atual').count() === 1, 'só a fase atual em destaque');
  const al = await alvoAtual(a);
  await resolverItem(a, 'arrastar', al);
  await esperarAte(async () => (await lerEstado(page)).fase === 2, { timeout: 8000, msg: 'avançar de fase' });
  const est = await lerEstado(page);
  ok(est.fase === 2 && est.acertos['1'] === 8, '8 acertos de primeira avançam para a fase 2', JSON.stringify(est));
  await esperarAte(async () => (await page.locator('.cs-fase.cs-atual').innerText()) === '2', { timeout: 5000 });
  ok(true, 'bolinha 2 fica em destaque');
  // a adulta escolhe a fase 3 e depois recarrega
  await tocar(a, '.cs-fase[data-fase="3"]');
  await dormir(500);
  ok(await page.locator('.cs-fase.cs-atual').innerText() === '3', 'escolher a fase 3 pela bolinha');
  ok(await page.locator('.cs-casa').count() === 2 && await page.locator('.cs-peca[data-tipo="s"]').count() >= 3, 'tela da fase 3 monta sílabas');
  ok((await lerEstado(page)).fase === 3, 'fase escolhida é salva');
  await tocar(a, '.cs-fase[data-fase="1"]');
  await dormir(400);
  ok(await page.locator('.cs-peca[data-tipo="v"]').count() === 1, 'voltar à fase 1 funciona (nada bloqueado)');
  await page.reload({ waitUntil: 'load' });
  await entrarNoJogo(a, { semMexerEstado: true });
  ok(await page.locator('.cs-fase.cs-atual').innerText() === '1', 'depois de recarregar, a fase escolhida continua');
  const est2 = await lerEstado(page);
  ok(est2.acertos['1'] === 8, 'acertos continuam salvos após recarregar', JSON.stringify(est2));
  ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, 'console limpo nas fases', JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
  await a.ctx.close();
}

// =====================================================================
console.log('--- rodada completa termina com aoTerminar (recompensa)');
{
  const a = await abrirCasinhas(360, 800, { fase: 1 });
  const { page } = a;
  const n = curriculo.regras.itensPorRodada;
  for (let k = 0; k < n; k++) {
    const al = await alvoAtual(a, { minimo: k + 1 });
    await resolverItem(a, 'arrastar', al);
    if (k < n - 1) await esperarProximo(a, k + 1);
  }
  await esperarTela(page, 'recompensa', 25000);
  ok(true, `depois de ${n} itens a casca mostra a recompensa (aoTerminar)`);
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok(Object.values(salvo.hist).flat().filter((h) => h.jogo === 'casinhas').length === n, `${n} registros do jogo casinhas`);
  await a.ctx.close();
}

// =====================================================================
console.log('--- layout nos 5 tamanhos, 3 fases');
for (const [w, h] of [[360, 800], [360, 640], [412, 915], [768, 1024], [1024, 768]]) {
  for (const fase of [1, 2, 3]) {
    const a = await abrirCasinhas(w, h, { fase });
    const { page, coleta } = a;
    const passos = fase === 2 ? 4 : 1;
    for (let k = 0; k < passos; k++) {
      await alvoAtual(a, { minimo: k + 1 });
      await dormir(250);
      const m = await page.evaluate(() => {
        const j = document.querySelector('.jogo-casinhas');
        const sel = '.cs-peca, .cs-casa, .cs-fase, .j-ouvir, .cs-bandeja, .cs-cartao-figura';
        const alvos = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
          const r = e.getBoundingClientRect();
          return { c: e.className, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom };
        });
        return { sh: j.scrollHeight, ch: j.clientHeight, sw: j.scrollWidth, cw: j.clientWidth, dh: document.documentElement.scrollHeight, dw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, alvos, jb: j.getBoundingClientRect().bottom };
      });
      const rot = `${w}x${h} fase ${fase} item ${k + 1}`;
      ok(m.sh <= m.ch + 1 && m.sw <= m.cw + 1, `${rot}: sem rolagem no jogo`, `${m.sh}>${m.ch} ${m.sw}>${m.cw}`);
      ok(m.dh <= m.ih + 1 && m.dw <= m.iw + 1, `${rot}: sem rolagem na página`);
      const ruins = m.alvos.filter((x) => {
        const minimo = /cs-peca/.test(x.c) ? 71.5 : /cs-cartao|cs-bandeja/.test(x.c) ? 0 : 63.5;
        return x.w < minimo || x.h < minimo || x.l < 15.5 || x.r > m.iw - 15.5 || x.b > m.jb - 15.5;
      });
      ok(ruins.length === 0, `${rot}: alvos >= 64 px (peças >= 72) e margem de 16 px`, JSON.stringify(ruins.slice(0, 3)));
      if (k === passos - 1 || fase !== 2) await page.screenshot({ path: `${FOTOS}/t-layout-f${fase}-${w}x${h}.png` });
      if (k < passos - 1) { await resolverItem(a, 'tocar'); await esperarProximo(a, k + 1); }
    }
    ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0, `${w}x${h} fase ${fase}: console limpo`, JSON.stringify(coleta.erros.concat(coleta.pageerrors)));
    ok(await page.locator('.jogo-casinhas').evaluate((e) => getComputedStyle(e).touchAction === 'none'), `${w}x${h}: touch-action none na área de jogo`);
    await a.ctx.close();
  }
}

// =====================================================================
console.log('--- menu com 5 jogos cabe sem rolagem (botão ouvir visível)');
for (const [w, h] of [[360, 800], [360, 640], [412, 915], [768, 1024], [1024, 768]]) {
  const a = await abrirApp(browser, srv.base, { viewport: { width: w, height: h }, seed: seedProgresso(['a', 'm']), rapido: true });
  const { page } = a;
  await page.touchscreen.tap(w / 2, h * 0.75);
  await page.waitForSelector('button[aria-label="Brincadeiras"]'); await dormir(500);
  await page.locator('button[aria-label="Brincadeiras"]').first().click();
  await page.waitForSelector('.menu-jogos'); await dormir(1200);
  const m = await page.evaluate(() => {
    const p = document.querySelector('.palco');
    const o = document.querySelector('.rodape button').getBoundingClientRect();
    const bs = [...document.querySelectorAll('.btn-jogo')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, b: r.bottom }; });
    return { ph: p.clientHeight, ps: p.scrollHeight, ob: o.bottom, ih: innerHeight, bs };
  });
  ok(m.ps <= m.ph + 1 && m.ob <= m.ih, `${w}x${h}: menu sem rolagem e com "Ouvir de novo" visível`, JSON.stringify(m));
  ok(m.bs.length === 5 && m.bs.every((b) => b.w >= 64 && b.h >= 64), `${w}x${h}: 5 botões >= 64 px`);
  await a.ctx.close();
}

browser.close();
srv.parar();
process.exit(R.fim() ? 1 : 0);
