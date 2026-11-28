// UX para a adulta que acompanha: rótulos, legenda da fala, indicadores, "Como funciona", área dos pais, contraste.
// Uso: node tests/i-ux.test.mjs   (fotos em /tmp/claude-0/i/teste-*.png)
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, tocar, esperarTela, esperarAte, dormir, auditar,
  curriculo, frases, raizProjeto,
} from './e-lib.mjs';

const R = criarRelator('I UX');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
const FOTOS = '/tmp/claude-0/i';
mkdirSync(FOTOS, { recursive: true });
const ORDEM = curriculo.ordem;
const textosVistos = new Set();

function sementeBase(extra = {}) {
  return {
    v: 1, nome: 'Bia', guia: 'lumi', liberadas: ['a'], hist: {}, rec: { estrela: 3, concha: 2, chifre: 1 }, recSessao: { estrela: 1, concha: 0, chifre: 0 },
    tempoTotal: 7 * 60000, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now(), ...extra,
  };
}
const dominada = (jogos = ['escute', 'caca', 'trace']) => Array.from({ length: 6 }, (_, i) => ({ jogo: jogos[i % jogos.length], ok: true, sessao: 1, t: Date.now() - 1000 * (6 - i) }));

async function juntarTextos(page) {
  const a = await auditar(page);
  // o nome da letra só pode aparecer na legenda, depois do rótulo "nome:" (regra do nome e som)
  const nomesLegenda = await page.evaluate(() => [...document.querySelectorAll('#legenda .legenda-rotulo')].filter((e) => e.textContent === 'nome:').map((e) => e.nextElementSibling && e.nextElementSibling.textContent));
  for (const t of [...a.textos, ...a.textosAdulta]) if (!nomesLegenda.includes(t)) textosVistos.add(t);
  return a;
}
async function marcarFalas(page) {
  await page.evaluate(() => {
    window.__fala = [];
    window.addEventListener('trilha:fala', (e) => {
      const L = document.getElementById('legenda');
      window.__fala.push({ d: e.detail, html: L ? L.innerHTML : '', visivel: L ? L.classList.contains('visivel') : false, naTela: !!(L && L.isConnected) });
    });
  });
}
const lerFalas = (page) => page.evaluate(() => window.__fala.slice());

// ---------------------------------------------------------------- 1. rótulos
console.log('\n# 1. Rótulos visíveis em todos os botões de ícone');
{
  const SEM_ROTULO = '.j-cartao, .j-bloco, .j-sereia, .parada, .letra-gigante, .btn-texto, .chave, .respostas button, .j-cartao-letra, .btn-guia';
  async function conferirRotulos(page, tela, esperados) {
    const r = await page.evaluate((sel) => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      return [...document.querySelectorAll('button')].filter(vis).filter((b) => !b.matches(sel)).map((b) => {
        const rot = b.querySelector('[data-i="rotulo"]');
        const box = b.getBoundingClientRect();
        const rb = rot ? rot.getBoundingClientRect() : null;
        const px = rot ? parseFloat(getComputedStyle(rot).fontSize) : 0;
        return { aria: b.getAttribute('aria-label'), rotulo: rot ? rot.textContent.trim() : '', w: box.width, h: box.height, px, abaixo: !!rb && rb.top >= box.top + 30, l: box.left, r: box.right };
      });
    }, SEM_ROTULO);
    for (const b of r) {
      ok(!!b.aria, `${tela}: botão "${b.rotulo}" mantém aria-label`);
      ok(b.rotulo.length > 0, `${tela}: botão [${b.aria}] tem rótulo visível`);
      ok(b.px >= 12 && b.px <= 18, `${tela}: rótulo "${b.rotulo}" com fonte legível (${b.px}px)`);
      ok(b.abaixo, `${tela}: rótulo "${b.rotulo}" fica abaixo do ícone`);
      ok(b.w >= 63.5 && b.h >= 63.5, `${tela}: alvo "${b.rotulo}" >= 64px (${Math.round(b.w)}x${Math.round(b.h)})`);
    }
    const nomes = r.map((b) => b.rotulo);
    for (const e of esperados) ok(nomes.includes(e), `${tela}: tem o rótulo "${e}"`, JSON.stringify(nomes));
  }
  const app = await abrirApp(browser, srv.base, { rapido: true, seed: sementeBase({ liberadas: ['a', 'e', 'i'], hist: { a: dominada() } }) });
  const { page } = app;
  await esperarTela(page, 'inicio'); await dormir(600);
  await conferirRotulos(page, 'inicio', ['Começar', 'Ouvir de novo', 'Pais', 'Como funciona']);
  await juntarTextos(page);
  await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha'); await dormir(600);
  await conferirRotulos(page, 'trilha', ['Início', 'Ouvir de novo', 'Brincadeiras', 'Coleção']);
  await juntarTextos(page);
  await tocar(page, '.parada.foco'); await esperarTela(page, 'apresenta'); await dormir(500);
  await conferirRotulos(page, 'lição', ['Voltar', 'Ouvir de novo', 'Continuar']);
  await juntarTextos(page);
  await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha');
  await tocar(page, 'button[aria-label="Minha coleção"]'); await esperarTela(page, 'colecao'); await dormir(500);
  await conferirRotulos(page, 'coleção', ['Voltar', 'Ouvir de novo']);
  await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha');
  await tocar(page, 'button[aria-label="Brincadeiras"]'); await esperarTela(page, 'menu'); await dormir(500);
  await conferirRotulos(page, 'menu', ['Voltar', 'Ouvir de novo']);
  const nomesJogos = await page.locator('.btn-jogo .rotulo').allInnerTexts();
  ok(JSON.stringify(nomesJogos) === JSON.stringify(['Escute e Toque', 'Caça-Som', 'Junte os Sons', 'Trace a Letra', 'Casinhas dos Sons']), 'menu: cartões com o nome de cada jogo', JSON.stringify(nomesJogos));
  await juntarTextos(page);
  await tocar(page, '.btn-jogo', { indice: 0 }); await page.waitForSelector('.j-ouvir'); await dormir(500);
  const jr = await page.locator('.j-ouvir .j-rotulo').innerText();
  ok(jr === 'Ouvir de novo', 'jogo: botão de ouvir com rótulo escrito');
  ok((await page.locator('.j-ouvir').getAttribute('aria-label')) === 'Ouvir de novo', 'jogo: aria-label mantido');
  await page.screenshot({ path: `${FOTOS}/teste-jogo.png` });
  await app.ctx.close();
  const app2 = await abrirApp(browser, srv.base, { rapido: true, seed: null });
  await esperarTela(app2.page, 'inicio');
  await tocar(app2.page, 'button[aria-label="Começar"]'); await esperarTela(app2.page, 'guia'); await dormir(400);
  const g = await app2.page.locator('.btn-guia .rotulo').allInnerTexts();
  ok(g.length === 2 && /Lumi/.test(g[0]) && /Marola/.test(g[1]), 'escolha do guia: nome de cada amiga escrito', JSON.stringify(g));
  await juntarTextos(app2.page);
  await app2.ctx.close();
}

// ---------------------------------------------------------------- 2. legenda
console.log('\n# 2. Legenda da fala');
{
  const app = await abrirApp(browser, srv.base, { rapido: true, seed: sementeBase({ liberadas: ['a', 'e', 'i', 'o'], hist: { a: dominada(), e: dominada() } }) });
  const { page } = app;
  await esperarTela(page, 'inicio'); await marcarFalas(page);
  await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha');
  await esperarAte(async () => { const l = await lerFalas(page); const i = l.findIndex((x) => x.d.texto && /Toque na parada/.test(x.d.texto)); return i >= 0 && l.slice(i).some((x) => x.d.fim); }, { msg: 'fim da fala' });
  const f = await lerFalas(page);
  const boas = f.find((x) => x.d.tipo === 'frase' && /Vamos brincar/.test(x.d.texto));
  ok(!!boas && boas.d.texto === 'Oi, Bia! Vamos brincar com os sons das letras?', 'evento trilha:fala traz o texto da frase com o nome preenchido', JSON.stringify(boas));
  ok(f.every((x) => !x.d.texto || !/\{nome\}/.test(x.d.texto)), 'nenhum {nome} cru na legenda');
  // (o evento sai antes de a tela nova ter montado o espaço da legenda: o texto chega pelo evento e a legenda guarda o estado)
  ok(await page.evaluate(() => { const L = document.getElementById('legenda'); return L.isConnected && !!L.closest('.legenda-slot'); }), 'a legenda fica no espaço reservado da tela da trilha');
  const txtAgora = await page.locator('#legenda').innerText();
  ok(/Toque na parada/.test(txtAgora), 'depois da última frase a legenda mostra a instrução da trilha', txtAgora);
  await page.screenshot({ path: `${FOTOS}/teste-legenda.png` });
  const rect = await page.evaluate(() => { const r = document.getElementById('legenda').getBoundingClientRect(); const bs = [...document.querySelectorAll('button')].map((b) => b.getBoundingClientRect()); const sob = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; return { cobre: bs.filter((b) => sob(r, b)).length, bottom: r.bottom }; });
  ok(rect.cobre === 0, 'a legenda não cobre nenhum botão');
  await esperarAte(async () => page.evaluate(() => !document.getElementById('legenda').classList.contains('visivel')), { timeout: 8000, msg: 'legenda some' });
  ok(true, 'a legenda some alguns segundos depois do fim da fala');
  // parada antiga: um toque abre a lição, que diz o nome e depois o som; a legenda marca "nome:" e, em seguida, "som:" (alto-falante + letra em maiúscula)
  await page.evaluate(() => { window.__fala.length = 0; });
  await tocar(page, '.parada:not(.foco)');
  await esperarTela(page, 'apresenta');
  await esperarAte(async () => (await lerFalas(page)).some((x) => x.d.tipo === 'som'), { msg: 'fala de som' });
  const fl = await lerFalas(page);
  const nomeEv = fl.find((x) => x.d.tipo === 'nome');
  ok(!!nomeEv && fl.indexOf(nomeEv) < fl.findIndex((x) => x.d.tipo === 'som'), 'parada: o nome vem antes do som');
  ok(/legenda-rotulo[^>]*>nome:</.test(nomeEv.html) && nomeEv.html.includes(`>${nomeEv.d.texto}<`), `nome: legenda mostra "nome:" e o nome (${nomeEv.d.texto})`, nomeEv.html);
  const som = fl.find((x) => x.d.tipo === 'som');
  ok(/^[A-Z]$/.test(som.d.texto), `som: legenda mostra só a letra maiúscula (${som.d.texto})`);
  const txtSom = som.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(/legenda-icone/.test(som.html) && /legenda-texto grande/.test(som.html) && !/\//.test(txtSom), 'som: alto-falante + letra, sem barras');
  ok(txtSom === `nome: ${nomeEv.d.texto} · som: ${som.d.texto}`, 'a dupla fica clara: "nome: ... · som: ..."', txtSom);
  await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha');
  await tocar(page, 'button[aria-label="Brincadeiras"]'); await esperarTela(page, 'menu');
  // no Escute e Toque a letra é a resposta: só o alto-falante
  await page.evaluate(() => { window.__fala.length = 0; });
  await tocar(page, '.btn-jogo', { indice: 0 });
  await esperarAte(async () => (await lerFalas(page)).some((x) => x.d.tipo === 'som'), { msg: 'som no escute' });
  const sE = (await lerFalas(page)).find((x) => x.d.tipo === 'som');
  ok(/legenda-icone/.test(sE.html) && !/legenda-texto/.test(sE.html), 'Escute e Toque: legenda não entrega a letra da resposta (só o alto-falante)', sE.html);
  await app.ctx.close();

  // sílaba e palavra: pelo evento do áudio real
  const app3 = await abrirApp(browser, srv.base, { rapido: true, seed: sementeBase({ liberadas: ORDEM.slice(0, 6), hist: {} }) });
  await esperarTela(app3.page, 'inicio'); await marcarFalas(app3.page);
  await app3.page.evaluate(async () => { const a = await import('./js/audio.js'); await a.falar(['sil:ma', 'pal:mapa']); });
  const f3 = await lerFalas(app3.page);
  ok(f3.some((x) => x.d.tipo === 'sil' && x.d.texto === 'MA') && f3.some((x) => x.d.tipo === 'pal' && x.d.texto === 'MAPA'), 'sílaba e palavra aparecem como MA e MAPA');
  ok(f3.some((x) => x.d.fim), 'ao terminar a fala é emitido o fim');
  await app3.ctx.close();
}

// ---------------------------------------------------------------- 3. opção de legendas
console.log('\n# 3. Opção "Mostrar legendas" e área dos pais');
async function abrirPainel(page) {
  await tocar(page, 'button[aria-label="Área dos pais"]'); await esperarTela(page, 'pais');
  const c = await page.locator('.conta').innerText();
  const m = /(\d+)\s*\+\s*(\d+)/.exec(c); const soma = +m[1] + +m[2];
  const rs = await page.locator('.respostas button').allInnerTexts();
  await tocar(page, '.respostas button', { indice: rs.findIndex((x) => +x === soma) });
  await page.waitForSelector('.abas');
}
{
  const seed = sementeBase({ liberadas: ['a', 'e', 'i', 'o'], hist: { a: dominada(), e: dominada() } });
  const app = await abrirApp(browser, srv.base, { rapido: true, seed });
  const { page } = app;
  await esperarTela(page, 'inicio');
  await abrirPainel(page); await dormir(400);
  await page.screenshot({ path: `${FOTOS}/teste-pais.png` });
  await juntarTextos(page);
  const titulos = await page.locator('.painel h2').allInnerTexts();
  for (const t of ['Pequenas grandes conquistas', 'Letras do currículo', 'Letra por letra', 'Onde precisou de mais ajuda', 'Histórico recente', 'Prática do seu jeito', 'Guia', 'Progresso', 'Ajuda', 'Uma cópia das descobertas', 'Versão do jogo']) ok(titulos.includes(t), `pais: seção "${t}"`, JSON.stringify(titulos));
  const cards = await page.locator('.estatistica .est-titulo').allInnerTexts();
  ok(['Letras dominadas', 'Tempo de uso', 'Sessões', 'Recompensas'].every((c) => cards.includes(c)), 'pais: cards de tempo de uso, sessões e recompensas', JSON.stringify(cards));
  const estados = await page.$$eval('#grade-letras .cel', (cs) => cs.map((c) => ({ e: c.dataset.estado, t: c.querySelector('.cel-letra').textContent, bg: getComputedStyle(c).backgroundColor })));
  ok(estados.length === ORDEM.length, `pais: grade com as ${ORDEM.length} letras do currículo`);
  const cont = (e) => estados.filter((x) => x.e === e).length;
  ok(cont('dominada') === 2 && cont('pratica') === 2 && cont('bloqueada') === ORDEM.length - 4, 'pais: 2 dominadas, 2 em prática, o resto ainda não liberado', JSON.stringify([cont('dominada'), cont('pratica'), cont('bloqueada')]));
  ok(new Set(estados.map((x) => x.bg)).size === 3, 'pais: os 3 estados têm cores diferentes');
  const leg = await page.locator('.legenda-cores').innerText();
  ok(/dominadas/.test(leg) && /em prática/.test(leg) && /ainda não liberadas/.test(leg), 'pais: legenda de cores escrita', leg);
  ok((await page.locator('.estatisticas').innerText()).includes('7 min'), 'pais: tempo de uso em minutos');
  for (const t of ['Liberar próxima letra', 'Reiniciar progresso', 'Sua voz', 'Backup', 'Ajustes', 'Progresso', 'Trocar guia', 'Voltar', 'Exportar cópia', 'Importar cópia', 'Mostrar legendas']) ok(await page.locator(`button[aria-label="${t}"]`).count() === 1, `pais: botão "${t}"`);
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  ok(/use se a criança já sabe/i.test(await page.locator('.painel').innerText()), 'pais: explicação de uma linha em cada ação (liberar)');
  ok(await page.locator('#resumo-voz').count() === 1, 'pais: contagem de gravações');
  // chave de legendas
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  const chave = 'button[aria-label="Mostrar legendas"]';
  ok((await page.locator(chave).getAttribute('aria-checked')) === 'true', 'legendas ligadas por padrão');
  await tocar(page, chave);
  ok((await page.locator(chave).getAttribute('aria-checked')) === 'false', 'tocar na chave desliga as legendas');
  ok(await page.evaluate(() => localStorage.getItem('trilhaSons.legendas') === 'false'), 'a escolha fica salva no aparelho');
  await tocar(page, 'button[aria-label="Voltar"]'); await esperarTela(page, 'inicio');
  await marcarFalas(page);
  await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha');
  await esperarAte(async () => (await lerFalas(page)).some((f) => f.d.fim), { msg: 'fala' });
  const vis = await page.evaluate(() => { const s = document.querySelector('.legenda-slot'); const L = document.getElementById('legenda'); return { slotOculto: s.hidden, visivel: L.classList.contains('visivel') }; });
  ok(vis.slotOculto && !vis.visivel, 'legendas desligadas: nada aparece na tela');
  ok(await page.locator('button[aria-label="Ouvir de novo"]').count() === 1, 'sem legenda a tela continua com áudio e "Ouvir de novo"');
  await app.ctx.close();
}

// ---------------------------------------------------------------- 4. indicadores
console.log('\n# 4. Indicadores: trilha e lição');
{
  const seed = sementeBase({ liberadas: ORDEM.slice(0, 6), hist: Object.fromEntries(ORDEM.slice(0, 5).map((l) => [l, dominada()])) });
  const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25, seed });
  const { page, esp } = app;
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha'); await dormir(500);
  const ind = await page.locator('#indicador-trilha').innerText();
  ok(/Letra 6 de 20/.test(ind), `trilha: "Letra 6 de 20" (${ind.replace(/\n/g, ' ')})`);
  ok(/Sons M, P, B, T/.test(ind), 'trilha: nome da etapa');
  await juntarTextos(page);
  await tocar(page, '.parada.foco'); await esperarTela(page, 'apresenta'); await dormir(400);
  const p0 = await page.locator('#passos-licao .passos-texto').innerText();
  ok(/^Lição da letra M · Conhecendo a letra$/.test(p0), `lição: passo a passo na apresentação (${p0})`);
  const nb = await page.locator('#passos-licao .bolinha').count();
  ok(nb >= 3 && nb <= 4, `lição: ${nb} bolinhas de progresso`);
  await page.screenshot({ path: `${FOTOS}/teste-licao-passo0.png` });
  await tocar(page, 'button[aria-label="Continuar"]'); await page.waitForSelector('.jogo-escute .j-opcoes');
  await dormir(300);
  const p1 = await page.locator('#passos-licao .passos-texto').innerText();
  ok(new RegExp(`^Lição da letra M · 1 de ${nb} · Escute e Toque$`).test(p1), `lição: "1 de ${nb}" com o nome do jogo (${p1})`);
  ok(await page.locator('#passos-licao .bolinha.atual').count() === 1, 'lição: uma bolinha marca o passo atual');
  await page.screenshot({ path: `${FOTOS}/teste-licao-passo1.png` });
  const a = await auditar(page);
  ok(a.rolagem.sh <= a.rolagem.ih + 1, 'lição com passo a passo continua sem rolagem');
  await app.ctx.close();

  // resultado escrito no fim da lição (letra A, jogando sem errar)
  const app2 = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25, seed: sementeBase({ nome: '' }) });
  const { page: p2, esp: e2 } = app2;
  const J = criarJogador(p2, e2, R, { errar: false });
  await esperarTela(p2, 'inicio');
  await tocar(p2, 'button[aria-label="Começar"]'); await esperarTela(p2, 'trilha');
  await tocar(p2, '.parada.foco'); await esperarTela(p2, 'apresenta');
  await tocar(p2, 'button[aria-label="Continuar"]');
  let nota = '';
  for (let i = 0; i < 6 && !nota; i++) {
    const est = await esperarAte(() => p2.evaluate(() => (document.querySelector('.resultado-licao') ? 'fim' : document.querySelector('.raiz-jogo') ? 'jogo' : null)), { timeout: 15000, msg: 'jogo ou resultado' });
    if (est === 'fim') { nota = await p2.locator('.resultado-licao').innerText(); break; }
    await J.jogarRodada();
    await esperarTela(p2, 'recompensa'); await dormir(500);
    if (await p2.locator('.resultado-licao').count()) { nota = await p2.locator('.resultado-licao').innerText(); break; }
    await tocar(p2, 'button[aria-label="Continuar"]');
  }
  ok(/^Letra A dominada! A próxima letra foi liberada\.$/.test(nota), `fim da lição: frase escrita do resultado (${nota})`);
  ok(!/erro|errou|fracass|não conseguiu|infelizmente/i.test(nota), 'resultado sem tom negativo');
  await p2.screenshot({ path: `${FOTOS}/teste-resultado.png` });
  await app2.ctx.close();
}

// ---------------------------------------------------------------- 5. Como funciona
console.log('\n# 5. Tela "Como funciona"');
{
  const app = await abrirApp(browser, srv.base, { rapido: true, seed: sementeBase() });
  const { page } = app;
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Como funciona"]'); await page.waitForSelector('.ajuda'); await dormir(400);
  const h2 = await page.locator('.ajuda h2').allInnerTexts();
  for (const t of ['O objetivo', 'Como acompanhar', 'As brincadeiras', 'Como a trilha avança', 'Gravar a sua voz']) ok(h2.includes(t), `ajuda: seção "${t}"`, JSON.stringify(h2));
  const txt = await page.locator('.ajuda').innerText();
  ok(/SOM das letras/.test(txt) && /5 a 10 minutos/.test(txt) && /revisão/.test(txt) && /Sua voz/.test(txt), 'ajuda: objetivo, sessões, revisão e onde gravar a voz');
  for (const j of ['Escute e Toque', 'Caça-Som', 'Junte os Sons', 'Trace a Letra']) ok(txt.includes(j), `ajuda: descreve ${j}`);
  const rol = await page.evaluate(() => { const t = document.querySelector('.ajuda'); return { rola: t.scrollHeight > t.clientHeight, ov: getComputedStyle(t).overflowY }; });
  ok(rol.ov === 'auto' || rol.ov === 'scroll', 'ajuda: tela rolável');
  await page.screenshot({ path: `${FOTOS}/teste-ajuda.png` });
  await juntarTextos(page);
  textosVistos.add(txt);
  await tocar(page, 'button[aria-label="Voltar"]'); await esperarTela(page, 'inicio');
  ok(true, 'ajuda: Voltar leva à tela inicial');
  await app.ctx.close();
}

// ---------------------------------------------------------------- 6. nomes de consoantes
console.log('\n# 6. Nome de letra só aparece como nome (legenda "nome:" e gravação), nunca solto');
{
  const NOMES = ['eme', 'pê', 'bê', 'tê', 'efe', 'vê', 'esse', 'ele', 'ene', 'dê', 'cê', 'gê', 'jota', 'zê', 'erre', 'agá', 'cá', 'quê', 'xis', 'dáblio', 'ípsilon'];
  // "esse", "ele", "cá" também são palavras comuns: só contam quando aparecem como nome de letra
  const AMBIGUOS = new Set(['esse', 'ele', 'cá']);
  const re = (n) => new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, 'iu');
  const reLetra = (n) => new RegExp(`(letra|chama|nome|som d[oa])\\s+(d[oa]\\s+)?["“']?${n}(["”']|[^\\p{L}]|$)|["“']${n}["”']`, 'iu');
  // tira as frases que explicitamente falam do NOME da letra (permitidas desde a regra nome e depois som)
  const tirarFrasesDeNome = (t) => t.split(/(?<=[.!?])\s+/).filter((f) => !/\bnome\b/i.test(f)).join(' ');
  const proibido = (texto) => NOMES.filter((n) => (AMBIGUOS.has(n) ? reLetra(n) : re(n)).test(texto));
  const fontes = [];
  const lerDir = (d) => { for (const f of readdirSync(path.join(raizProjeto, d))) if (f.endsWith('.js')) fontes.push([`${d}/${f}`, readFileSync(path.join(raizProjeto, d, f), 'utf8')]); };
  lerDir('js'); lerDir('js/telas'); lerDir('js/jogos');
  fontes.push(['index.html', readFileSync(path.join(raizProjeto, 'index.html'), 'utf8')]);
  fontes.push(['README.md', readFileSync(path.join(raizProjeto, 'README.md'), 'utf8')]);
  for (const [arq, t] of fontes) {
    // comentários de código podem falar em nomes; a tabela de nomes das letras fora do currículo (audio.js) é a única exceção
    const sem = t.replace(/\/\/.*$/gm, '').replace(/^.*NOMES_EXTRA =.*$/gm, '');
    // regra nova (nome e depois som): a ajuda para a adulta pode citar um nome numa frase que diz que é o NOME
    const semAjuda = arq.endsWith('ajuda.js') ? tirarFrasesDeNome(sem) : sem;
    const r = proibido(semAjuda);
    ok(r.length === 0, `${arq}: sem nome de consoante`, r.join(', '));
  }
  const fr = Object.entries(frases).filter(([k]) => !k.startsWith('_'));
  ok(fr.every(([, v]) => proibido(v).length === 0), 'frases.json: nenhuma frase com nome de consoante');
  const vistos = [...textosVistos].filter((t) => proibido(tirarFrasesDeNome(t)).length && !/^Diga o NOME da letra: /.test(t));
  ok(vistos.length === 0, 'textos vistos nas telas: sem nome de consoante', vistos.join(' | '));
  ok(textosVistos.size > 20, `(${textosVistos.size} textos conferidos nas telas)`);
}

// ---------------------------------------------------------------- 7. contraste
console.log('\n# 7. Contraste AA (cálculo WCAG)');
{
  const css = readFileSync(path.join(raizProjeto, 'css/estilo.css'), 'utf8');
  const tok = {};
  for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tok[m[1]] = m[2];
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const BRANCO = '#ffffff';
  const pares = [
    ['rótulos e legenda: texto sobre branco', tok.texto, BRANCO, 4.5],
    ['texto sobre o fundo rosa', tok.texto, tok.fundo, 4.5],
    ['rótulo do cartão (texto sobre rosa claro)', tok.texto, tok['rosa-claro'], 4.5],
    ['notas dos pais (texto suave sobre branco)', tok['texto-suave'], BRANCO, 4.5],
    ['letra da legenda (rosa forte sobre branco)', tok['rosa-forte'], BRANCO, 4.5],
    ['botão de texto (branco sobre rosa forte)', BRANCO, tok['rosa-forte'], 4.5],
    ['números dos cards (rosa forte sobre rosa claro, texto grande)', tok['rosa-forte'], tok['rosa-claro'], 3],
    ['letra dominada', tok['ok-texto'], tok['ok-fundo'], 4.5],
    ['letra em prática', tok['pratica-texto'], tok['pratica-fundo'], 4.5],
    ['letra ainda não liberada', tok['bloq-texto'], tok['bloq-fundo'], 4.5],
    ['legendas ligadas (chave)', tok['ok-texto'], tok['ok-fundo'], 4.5],
    ['legendas desligadas (chave)', tok['bloq-texto'], tok['bloq-fundo'], 4.5],
    ['texto sobre o aviso amarelo', tok.texto, '#fff3bf', 4.5],
  ];
  for (const [nome, fg, bg, min] of pares) {
    const r = razao(fg, bg);
    ok(r >= min, `${nome}: ${r.toFixed(2)}:1 (mínimo ${min})`);
  }
}

// ---------------------------------------------------------------- 8. legenda e indicador sem cortes nem sobreposição
console.log('\n# 8. Legenda e indicador: frase longa, nome de 12 letras, 3 tamanhos');
{
  const NOME12 = 'Aaaaaaaaaaaa';
  const longas = Object.entries(frases).filter(([k]) => !k.startsWith('_')).map(([, v]) => v.replace(/\{nome\}/g, NOME12)).sort((a, b) => b.length - a.length).slice(0, 3);
  async function medir(page, rotulo) {
    for (const texto of longas) {
      const r = await page.evaluate((t) => {
        window.dispatchEvent(new CustomEvent('trilha:fala', { detail: { tipo: 'frase', texto: t } }));
        const L = document.getElementById('legenda');
        const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        const caixa = (e) => e.getBoundingClientRect();
        const sob = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const out = { problemas: [], tem: !!(L && L.isConnected && L.closest('.legenda-slot')) };
        if (!out.tem) return out;
        const lr = caixa(L);
        const slot = L.closest('.legenda-slot').getBoundingClientRect();
        if (L.scrollHeight > L.clientHeight + 1) out.problemas.push(`legenda cortada (${L.scrollHeight}>${L.clientHeight})`);
        const tx = L.querySelector('.legenda-texto');
        if (tx && tx.scrollWidth > tx.clientWidth + 1) out.problemas.push('texto da legenda mais largo que a caixa');
        if (lr.top < slot.top - 1 || lr.bottom > slot.bottom + 1 || lr.left < slot.left - 1 || lr.right > slot.right + 1) out.problemas.push('legenda fora do seu espaço');
        if (lr.left < 0 || lr.right > innerWidth || lr.top < 0 || lr.bottom > innerHeight) out.problemas.push('legenda fora da tela');
        const outros = [...document.querySelectorAll('button, .indicador, .passos, .barra-guia')].filter(vis);
        for (const o of outros) {
          if (sob(lr, caixa(o))) out.problemas.push(`legenda sobrepõe ${o.getAttribute('aria-label') || o.className}`);
        }
        for (const ind of document.querySelectorAll('.indicador, .passos')) {
          if (!vis(ind)) continue;
          const ir = caixa(ind);
          if (ind.scrollWidth > ind.clientWidth + 1 || ind.scrollHeight > ind.clientHeight + 1) out.problemas.push(`${ind.className} cortado`);
          if (ir.left < 0 || ir.right > innerWidth) out.problemas.push(`${ind.className} fora da tela`);
          for (const o of document.querySelectorAll('button, .barra-guia')) if (vis(o) && sob(ir, caixa(o))) out.problemas.push(`${ind.className} sobrepõe ${o.getAttribute('aria-label') || o.className}`);
        }
        return out;
      }, texto);
      ok(r.tem, `${rotulo}: a legenda está no espaço da tela`);
      ok(r.problemas.length === 0, `${rotulo}: "${texto.slice(0, 28)}…" sem corte nem sobreposição`, r.problemas.join('; '));
    }
  }
  for (const vp of [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 360, height: 640 }]) {
    const tam = `${vp.width}x${vp.height}`;
    const lib = ORDEM.slice(0, 6);
    const seed = sementeBase({ nome: NOME12, liberadas: lib, hist: Object.fromEntries(ORDEM.slice(0, 5).map((l) => [l, dominada()])), tempoSessao: 9 * 60000 });
    const app0 = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, seed: null });
    await esperarTela(app0.page, 'inicio'); await dormir(300);
    await medir(app0.page, `${tam} início`);
    await tocar(app0.page, 'button[aria-label="Começar"]'); await esperarTela(app0.page, 'guia'); await dormir(500);
    await medir(app0.page, `${tam} escolha do guia`);
    await app0.page.screenshot({ path: `${FOTOS}/teste-${tam}-guia.png` });
    await app0.ctx.close();
    const app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, escala: 0.35, seed });
    const { page, esp } = app;
    await esperarTela(page, 'inicio');
    await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha'); await dormir(700);
    await medir(page, `${tam} trilha`);
    await page.screenshot({ path: `${FOTOS}/teste-${tam}-trilha.png` });
    await tocar(page, '.parada.foco'); await esperarTela(page, 'apresenta'); await dormir(600);
    await medir(page, `${tam} lição`);
    await tocar(page, 'button[aria-label="Continuar"]'); await page.waitForSelector('.jogo-escute .j-opcoes'); await dormir(400);
    await medir(page, `${tam} jogo na lição`);
    await page.screenshot({ path: `${FOTOS}/teste-${tam}-jogo.png` });
    await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha');
    await tocar(page, 'button[aria-label="Minha coleção"]'); await esperarTela(page, 'colecao'); await dormir(500);
    await medir(page, `${tam} coleção`);
    await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha');
    await tocar(page, 'button[aria-label="Brincadeiras"]'); await esperarTela(page, 'menu'); await dormir(400);
    await medir(page, `${tam} menu`);
    await tocar(page, '.btn-jogo', { indice: 0 });
    const J = criarJogador(page, esp, R, { errar: false });
    await J.jogarRodada();
    await esperarTela(page, 'recompensa'); await dormir(500);
    await medir(page, `${tam} recompensa`);
    await tocar(page, 'button[aria-label="Continuar"]'); await esperarTela(page, 'despedida'); await dormir(600);
    await medir(page, `${tam} despedida`);
    await page.screenshot({ path: `${FOTOS}/teste-${tam}-despedida.png` });
    await app.ctx.close();
  }
}

await browser.close();
srv.parar();
process.exit(R.fim() ? 1 : 0);
