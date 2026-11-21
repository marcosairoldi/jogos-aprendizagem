// H: avanço da trilha. Lição de A acertando tudo libera E; com muitos erros não libera; refazer libera; persiste.
import { chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, tocar, esperarTela, esperarAte, dormir } from './e-lib.mjs';

const R = criarRelator('H avanço');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();

async function iniciar(errar, ctxExistente) {
  const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25, ...(ctxExistente ? { contexto: ctxExistente } : {}) });
  const J = criarJogador(app.page, app.esp, R, { errar });
  return { app, J };
}
async function comecar(page) {
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Começar"]');
  await esperarTela(page, 'guia');
  await tocar(page, 'button[aria-label="Escolher a unicórnio"]');
  await esperarTela(page, 'trilha');
}
async function licao(page, J) {
  await tocar(page, '.parada.foco');
  await esperarTela(page, 'apresenta');
  await dormir(200);
  await tocar(page, 'button[aria-label="Continuar"]');
  for (let g = 0; g < 20; g++) {
    const t = await esperarAte(() => page.evaluate(() => (document.querySelector('.raiz-jogo') ? 'jogo' : document.querySelector('.recompensa .premio') ? 'recompensa' : document.querySelector('.trilha-area') ? 'trilha' : document.querySelector('.guia-festa') && !document.querySelector('.premio') ? 'despedida' : null)), { timeout: 60000 });
    if (t === 'trilha' || t === 'despedida') return t;
    if (t === 'recompensa') {
      await page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
      await dormir(300);
      await tocar(page, 'button[aria-label="Continuar"]');
      await esperarAte(() => page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000 });
    } else await J.jogarRodada();
  }
  return null;
}
const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
function criterios(st, l, regras) {
  const h = st.hist[l] || [];
  const j = h.slice(-regras.janelaDominio);
  return { tentativas: h.length, acertosJanela: j.filter((x) => x.ok).length, jogos: new Set(j.map((x) => x.jogo)).size, sessoes: new Set(h.map((x) => x.sessao)).size };
}
const regras = (await import('node:fs')).readFileSync(new URL('../data/curriculo.json', import.meta.url), 'utf8');
const REG = JSON.parse(regras).regras;
async function textos(page) { return page.evaluate(() => [...document.querySelectorAll('.parada .letra')].map((x) => x.textContent)); }
async function falas(esp) { return (await esp.eventos(0)).map((x) => x.id); }

try {
  ok(REG.sessoesParaDominar === 1, 'currículo: sessoesParaDominar = 1');

  console.log('\n# (a) lição de A acertando tudo libera E');
  {
    const { app, J } = await iniciar(false);
    const { page, esp } = app;
    await comecar(page);
    const fim = await licao(page, J);
    const st = await estado(page);
    const c = criterios(st, 'a', REG);
    console.log('   critérios de A:', JSON.stringify(c), '| liberadas:', st.liberadas.join(''));
    ok(fim === 'trilha', 'a lição termina na trilha');
    ok(c.acertosJanela >= REG.acertosParaDominar && c.jogos >= REG.jogosDistintosParaDominar, 'A cumpre os critérios', JSON.stringify(c));
    ok(st.liberadas.join('') === 'ae', 'E foi liberada', st.liberadas.join(''));
    await esperarTela(page, 'trilha');
    await esperarAte(async () => (await falas(esp)).includes('trilha_nova_letra'), { timeout: 10000 }).catch(() => {});
    const f = await falas(esp);
    ok(f.includes('letra_dominada') && f.includes('trilha_nova_letra'), 'guia fala letra_dominada e trilha_nova_letra');
    ok(f.indexOf('letra_dominada') < f.indexOf('trilha_nova_letra'), 'na ordem certa');
    ok((await textos(page)).includes('E'), 'a trilha mostra a parada E');
    const foco = await page.evaluate(() => document.querySelector('.parada.foco .letra').textContent);
    ok(foco === 'E', 'E é a parada brilhando (foco)', foco);
    // persiste após recarregar
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.trilha-area, #app > *');
    const st2 = await estado(page);
    ok(st2.liberadas.join('') === 'ae', '(d) após recarregar, E segue liberada');
    await esperarAte(() => page.evaluate(() => !!document.querySelector('.parada.foco')), { timeout: 10000, msg: 'trilha' }).catch(() => {});
    if (await page.evaluate(() => !document.querySelector('.parada.foco'))) { await esperarTela(page, 'inicio'); await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha'); }
    ok((await page.evaluate(() => document.querySelector('.parada.foco .letra').textContent)) === 'E', '(d) após recarregar, o foco é E');
    ok(app.coleta.pageerrors.length === 0, 'sem erros de página', app.coleta.pageerrors.join('\n'));
    await app.ctx.close();
  }

  console.log('\n# (b) muitos erros: não libera; (c) refazer acertando libera');
  {
    const { app, J } = await iniciar(true);
    const { page, esp } = app;
    await comecar(page);
    // força erros no registro: wrapper sobre erros de primeira já feitos pelo jogador (errar=true erra em vários itens)
    const fim = await licao(page, J);
    let st = await estado(page);
    let c = criterios(st, 'a', REG);
    console.log('   critérios de A (com erros):', JSON.stringify(c), '| liberadas:', st.liberadas.join(''));
    const dominou = c.acertosJanela >= REG.acertosParaDominar && c.jogos >= REG.jogosDistintosParaDominar;
    if (dominou) R.aviso('o jogador com erros ainda dominou A (poucos erros em itens de A); (b) coberto por injeção abaixo');
    ok(fim === 'trilha', 'termina na trilha');
    ok(dominou === (st.liberadas.length > 1), 'liberação coerente com os critérios');
    await app.ctx.close();
  }
  {
    // erros pesados garantidos: semeia histórico ruim e joga uma lição só com 1 acerto possível
    const seed = { v: 1, nome: '', guia: 'lumi', liberadas: ['a'], hist: { a: [0, 1, 2, 3, 4].map((i) => ({ jogo: ['escute', 'caca'][i % 2], ok: false, sessao: 1, t: Date.now() - 1000 * (9 - i) })) }, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 0, sessoes: 1, sessaoId: 1, ultima: Date.now() };
    const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25, seed });
    const { page, esp } = app;
    const J = criarJogador(page, esp, R, { errar: false });
    await esperarTela(page, 'inicio'); await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'trilha');
    // 1) estado sem domínio: a parada A é foco
    ok((await page.evaluate(() => document.querySelector('.parada.foco .letra').textContent)) === 'A', 'sem domínio: A é o foco');
    // 2) joga a lição estragando as tentativas: o histórico semeado tem 5 erros; a lição vai acrescentar acertos
    // para garantir o cenário (b), a janela é de 6: sobram só ruins se a lição registrar poucas de A.
    const fim = await licao(page, J);
    const st = await estado(page);
    const c = criterios(st, 'a', REG);
    console.log('   (c) critérios de A após lição acertando sobre histórico ruim:', JSON.stringify(c), '| liberadas:', st.liberadas.join(''));
    ok(fim === 'trilha', 'lição termina na trilha');
    const deveLiberar = c.acertosJanela >= REG.acertosParaDominar && c.jogos >= REG.jogosDistintosParaDominar;
    ok(deveLiberar === (st.liberadas.length > 1), 'liberação coerente com os critérios');
    await app.ctx.close();
  }
  {
    // (b) puro: erros de primeira em quase tudo; (c) depois acertando libera
    const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25 });
    const { page, esp } = app;
    await esperarTela(page, 'inicio'); await tocar(page, 'button[aria-label="Começar"]'); await esperarTela(page, 'guia');
    await tocar(page, 'button[aria-label="Escolher a unicórnio"]'); await esperarTela(page, 'trilha');
    // simula lição ruim: grava tentativas erradas como o app faria, depois abre a lição
    await page.evaluate(async () => {
      const m = await import('/js/progresso.js');
      for (let i = 0; i < 6; i++) m.registrar({ letra: 'a', acertouPrimeira: false, jogo: ['escute', 'caca', 'junte'][i % 3] });
      window.__av = m.verificarAvanco();
    });
    const st0 = await estado(page);
    ok(st0.liberadas.join('') === 'a' && (await page.evaluate(() => window.__av)) === null, '(b) 6 erros: não libera');
    const antes = await falas(esp);
    ok(antes.every((x) => !/erro|ainda_nao|tente|falhou/i.test(x)), '(b) nenhuma fala negativa');
    await page.evaluate(() => { location.hash = ''; });
    await page.reload({ waitUntil: 'load' });
    await esperarTela(page, 'inicio'); await tocar(page, 'button[aria-label="Começar"]').catch(() => {});
    await esperarAte(() => page.evaluate(() => !!document.querySelector('.parada.foco')), { timeout: 10000, msg: 'trilha' });
    ok((await page.evaluate(() => document.querySelector('.parada.foco .letra').textContent)) === 'A', '(b) a parada A segue brilhando');
    const J = criarJogador(page, esp, R, { errar: false });
    const fim = await licao(page, J);
    const st = await estado(page);
    const c = criterios(st, 'a', REG);
    console.log('   (c) após refazer acertando:', JSON.stringify(c), '| liberadas:', st.liberadas.join(''));
    ok(fim === 'trilha' && st.liberadas.join('') === 'ae', '(c) refazer a lição acertando libera E', st.liberadas.join(''));
    await app.ctx.close();
  }
} catch (e) {
  R.ok(false, 'exceção: ' + (e && e.stack || e));
}
await browser.close();
srv.parar();
process.exit(R.fim() ? 1 : 0);
