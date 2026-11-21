// Currículo REAL: com a e i o u m p b t liberadas, cada um dos 4 jogos roda uma rodada inteira (incluindo
// Junte os Sons com sílabas e palavras) e o domínio por regras libera a próxima letra (sem o atalho dos pais).
// Uso: node tests/e-curriculo-real.test.mjs
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, tocar, esperarTela, esperarAte, dormir, curriculo, auditar, verificarAuditoria, falasProibidas, silabasHomofonas,
} from './e-lib.mjs';

const R = criarRelator('E currículo real');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
const ORDEM = curriculo.ordem;

function hist(letra, { sessoes = [1, 2], jogos = ['escute', 'caca', 'trace'], acertos = 6 } = {}) {
  const h = [];
  for (let i = 0; i < acertos; i++) h.push({ jogo: jogos[i % jogos.length], ok: true, sessao: sessoes[i % sessoes.length], t: Date.now() - 1000 * (acertos - i) });
  return h;
}
function semente(foco, focoEstado) {
  const lib = ORDEM.slice(0, ORDEM.indexOf('t') + 1); // a e i o u m p b t
  const h = {};
  for (const l of lib) {
    if (l === foco) { if (focoEstado === 'pratica') h[l] = hist(l, { acertos: 3, sessoes: [2] }).map((x) => ({ ...x, ok: x.jogo !== 'trace' })); } else h[l] = hist(l);
  }
  return { v: 1, nome: '', guia: 'marola', liberadas: lib, hist: h, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now() };
}

async function rodadaNoMenu(pg, esp, J, indiceJogo) {
  await esperarTela(pg, 'menu');
  await tocar(pg, '.btn-jogo', { indice: indiceJogo });
  const t0 = Date.now();
  const jogo = await J.jogarRodada();
  console.log(`   rodada ${jogo}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await esperarTela(pg, 'recompensa');
  await dormir(200);
  await pg.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
  await tocar(pg, 'button[aria-label="Continuar"]');
  await esperarAte(() => pg.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000 });
  return jogo;
}

try {
  console.log('\n# Os 4 jogos com a e i o u m p b t liberadas (currículo real)');
  const ALVO = ['mapa', 'pato', 'bota', 'tatu'];
  const silabasHom = [];
  const palavrasVistas = new Set();
  const silabasVistas = new Set();
  const cartoesLetra = new Set();
  const textosProibidos = [];
  const FOCOS = (process.env.FOCOS || 'm,p,b,t').split(',');
  for (const [foco, estado] of [['m', 'nova'], ['p', 'pratica'], ['b', 'nova'], ['t', 'pratica']].filter(([f]) => FOCOS.includes(f))) {
    console.log(`\n## foco ${foco.toUpperCase()} (${estado})`);
    const seed = semente(foco, estado);
    const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.25, seed });
    const { page, esp, coleta } = app;
    const J = criarJogador(page, esp, R, {
      aoAuditar: async (n) => {
        const a = await auditar(page);
        verificarAuditoria(R, `foco ${foco} ${n}`, a);
      },
    });
    await esperarTela(page, 'inicio');
    await tocar(page, 'button[aria-label="Começar"]');
    await esperarTela(page, 'trilha');
    await dormir(700);
    // a trilha mostra a letra foco
    const textoTrilha = (await auditar(page)).textos;
    ok(textoTrilha.includes(foco.toUpperCase()), `trilha mostra a parada ${foco.toUpperCase()}`, JSON.stringify(textoTrilha));
    await tocar(page, 'button[aria-label="Brincadeiras"]');
    const feitos = [];
    for (let i = 0; i < 4; i++) feitos.push(await rodadaNoMenu(page, esp, J, i));
    ok(feitos.join(',') === 'escute,caca,junte,trace', `foco ${foco}: rodada inteira de cada um dos 4 jogos`, feitos.join(','));
    // mais rodadas só de Junte até ver as palavras-alvo (ou 8 rodadas)
    for (let k = 0; k < 3 && !ALVO.every((p) => J.palavrasJunte.has(p) || palavrasVistas.has(p)); k++) {
      await rodadaNoMenu(page, esp, J, 2);
    }
    J.palavrasJunte.forEach((p) => palavrasVistas.add(p));
    J.silabasJunte.forEach((p) => silabasVistas.add(p));
    J.cartoesVistos.forEach((c) => cartoesLetra.add(c));
    ok(coleta.pageerrors.length === 0 && coleta.erros.length === 0 && coleta.avisos.length === 0, `foco ${foco}: sem erros nem avisos no console`, coleta.pageerrors.concat(coleta.erros, coleta.avisos).join('\n'));
    const brutoFoco = await esp.bruto();
    ok(falasProibidas(brutoFoco).length === 0, `foco ${foco}: nenhuma fala com nome de consoante`, falasProibidas(brutoFoco).join(', '));
    silabasHom.push(...silabasHomofonas(brutoFoco));
    ok(J.vermelhos.length === 0, `foco ${foco}: sem vermelho nos erros`, J.vermelhos.join('\n'));
    // salvou histórico das letras do foco
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
    ok(salvo.hist[foco].length > (seed.hist[foco] || []).length, `foco ${foco}: tentativas registradas`);
    await app.ctx.close();
  }
  console.log('\n   palavras no Junte:', [...palavrasVistas].sort().join(' '));
  console.log('   sílabas faladas pela voz do aparelho que soam como nome de letra:', [...new Set(silabasHom)].join(' ') || '(nenhuma)');
  console.log('   sílabas no Junte:', [...silabasVistas].sort().join(' '));
  for (const p of ALVO) ok(palavrasVistas.has(p), `Junte os Sons montou a palavra ${p.toUpperCase()} e achou a figura`);
  ok(silabasVistas.size >= 4, `Junte os Sons com sílabas (${silabasVistas.size} diferentes)`);
  for (const p of palavrasVistas) ok(curriculo.palavras[p].juntar === true, `palavra ${p} é regular (juntar: true)`);

  // ---------- domínio por regras, sem o atalho dos pais ----------
  console.log('\n# Domínio por regras (sem atalho dos pais): A -> E');
  const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.35 });
  const { page, esp } = app;
  const J = criarJogador(page, esp, R, { errar: false });
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Começar"]');
  await esperarTela(page, 'guia');
  await tocar(page, 'button[aria-label="Escolher a unicórnio"]');
  await esperarTela(page, 'trilha');

  async function licao() {
    await tocar(page, '.parada.foco');
    await esperarTela(page, 'apresenta');
    await dormir(200);
    await tocar(page, 'button[aria-label="Continuar"]');
    for (let g = 0; g < 20; g++) {
      const t = await esperarAte(async () => {
        const x = await page.evaluate(() => (document.querySelector('.raiz-jogo') ? 'jogo' : document.querySelector('.recompensa .premio') ? 'recompensa' : document.querySelector('.trilha-area') ? 'trilha' : document.querySelector('.guia-festa') && !document.querySelector('.premio') ? 'despedida' : null));
        return x;
      }, { timeout: 60000 });
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
  const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  let fim = await licao();
  let st = await estado();
  console.log('   após lição 1 (sessão 1): liberadas =', st.liberadas.join(''), '| entradas de A =', st.hist.a.length, '| sessões das entradas =', [...new Set(st.hist.a.map((x) => x.sessao))].join(','));
  ok(fim === 'trilha', 'lição 1 termina na trilha');
  ok(st.liberadas.includes('e'), 'DOMÍNIO POR REGRAS: A dominada ao fim de UMA lição de acertos libera E (sem atalho dos pais)', `liberadas=${st.liberadas.join('')}`);
  if (st.liberadas.includes('e')) {
    await esperarTela(page, 'trilha');
    await esperarAte(async () => (await esp.eventos(0)).some((x) => x.id === 'trilha_nova_letra'), { timeout: 8000 }).catch(() => {});
    await dormir(900);
    const novaFala = (await esp.eventos(0)).some((x) => x.id === 'letra_dominada') && (await esp.eventos(0)).some((x) => x.id === 'trilha_nova_letra');
    ok(novaFala, 'trilha fala "letra dominada" e "letra nova apareceu"');
    ok((await auditar(page)).textos.includes('E'), 'a nova parada E aparece na trilha');
  }
  ok(app.coleta.pageerrors.length === 0 && app.coleta.erros.length === 0, 'sem erros de console na sequência');
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
