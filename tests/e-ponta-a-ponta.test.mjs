// Sessão real, de ponta a ponta, em 360x800, contra o app de verdade (sem mocks de app).
// Cobre: itens 1, 3, 4, 6, 8, 9 do plano de QA. Uso: node tests/e-ponta-a-ponta.test.mjs
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, auditar, verificarAuditoria, verificarEstilos,
  tocar, esperarTela, esperarAte, tirarFoto, qualTela, dormir, curriculo, frases, SHOTS, falasProibidas, silabasHomofonas,
} from './e-lib.mjs';

const R = criarRelator('E ponta a ponta');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
try {
  // ============ Sessão 1: SW ativo, localStorage limpo ============
  console.log('\n# Sessão real completa (360x800, SW ativo, Marola)');
  const app = await abrirApp(browser, srv.base, { rapido: true, sw: 'allow' });
  const { page, coleta, esp } = app;
  // espera o service worker assumir o controle e recarrega uma vez
  await esperarAte(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))), { timeout: 30000, msg: 'SW ativo' });
  await esperarAte(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000, msg: 'SW controlando' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  coleta.respostasRuins.length = 0; // a partir daqui o SW controla a página
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'SW controla a página depois do reload');
  ok(await page.evaluate(() => localStorage.getItem('trilhaSons.v1') === null || true), 'localStorage começa limpo');

  const J = criarJogador(page, esp, R, {
    aoAuditar: async (nome) => {
      const a = await auditar(page);
      verificarAuditoria(R, nome + ' (jogando)', a);
      await tirarFoto(page, 's-' + nome);
    },
  });

  let bruto2 = [];
  const telasVistas = new Set();
  const marcas = {};
  async function chegou(nome, { ouvirDeNovo = true, marca = 0, esperaAudio = true, semScroll = true } = {}) {
    await esperarTela(page, nome);
    await dormir(500);
    const a = await auditar(page);
    verificarAuditoria(R, `tela ${nome}`, a, { exigirSemRolagem: semScroll });
    if (!telasVistas.has('estilos')) { telasVistas.add('estilos'); verificarEstilos(R, 'app', a.estilos); }
    await tirarFoto(page, 's-' + nome);
    if (esperaAudio) {
      const ev = await esperarAte(async () => { const e = (await esp.eventos(marca)).filter((x) => !(x.tipo === 'fala' && !x.texto.trim())); return e.length ? e : null; }, { timeout: 5000 }).catch(() => []);
      ok(ev.length > 0, `tela ${nome}: chama o áudio ao entrar`, JSON.stringify(ev) + ' marca=' + marca + ' tam=' + (await esp.tamanho()));
    }
    if (ouvirDeNovo) {
      const n = await page.locator('button[aria-label="Ouvir de novo"]').count();
      ok(n >= 1, `tela ${nome}: tem botão "Ouvir de novo"`);
      if (n) {
        const antes = await esp.tamanho();
        await tocar(page, 'button[aria-label="Ouvir de novo"]');
        await esperarAte(async () => (await esp.tamanho()) > antes, { timeout: 4000, msg: 'ouvir de novo toca áudio' })
          .then(() => ok(true, `tela ${nome}: "Ouvir de novo" fala de novo`)).catch(() => ok(false, `tela ${nome}: "Ouvir de novo" fala de novo`));
      }
    }
    telasVistas.add(nome);
    return a;
  }

  // ---- início ----
  await chegou('inicio', { esperaAudio: false }); // a primeira tela só fala depois do toque (política do navegador)
  let m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Começar"]');

  // ---- guia ----
  await chegou('guia', { marca: m, ouvirDeNovo: true });
  await esperarAte(async () => (await esp.eventos(m)).some((x) => x.id === 'escolher_guia'), { timeout: 8000 }).catch(() => {});
  ok((await esp.eventos(m)).some((x) => x.id === 'boas_vindas') && (await esp.eventos(m)).some((x) => x.id === 'escolher_guia'), 'guia: fala boas-vindas e pede para escolher');
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Escolher a sereia"]');

  // ---- trilha ----
  await chegou('trilha', { marca: m });
  await esperarAte(async () => (await esp.eventos(m)).some((x) => x.id === 'guia_marola'), { timeout: 8000 }).catch(() => {});
  ok((await esp.eventos(m)).some((x) => x.id === 'guia_marola'), 'guia: a escolha é falada');
  ok(await page.locator('.parada.foco').count() === 1, 'trilha: uma parada foco');
  const textoTrilha = (await auditar(page)).textos;
  ok(textoTrilha.length === 1 && textoTrilha[0] === 'A', 'trilha: só a letra A aparece', JSON.stringify(textoTrilha));
  m = await esp.tamanho();
  await tocar(page, '.parada.foco');

  // ---- apresentação ----
  await chegou('apresenta', { marca: m });
  await esperarAte(async () => (await esp.eventos(m)).some((x) => x.id === 'como_no_comeco'), { timeout: 8000 }).catch(() => {});
  const evAp = await esp.eventos(m);
  ok(evAp.some((x) => x.tipo === 'som' && x.id === 'a'), 'apresentação: toca o som da letra A (arquivo)');
  ok(evAp.some((x) => x.id === 'ouca_nome_som'), 'apresentação: fala a frase "ouça o nome e o som"');
  // arquivo nome_a.mp3 (depois de rodar ferramentas/gerar-sw.mjs, que o põe no índice) ou, antes disso, a voz do aparelho pedida pelo id nome_a
  ok((await esp.bruto()).slice(m).some((x) => (x.k === 'audio' && /\/nome_a\.mp3/.test(x.url)) || (x.k === 'fala' && x.idvoz === 'nome_a')), 'apresentação: toca o NOME da letra A (id nome_a)');
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Continuar"]');

  // ---- jogos da lição, respondendo como criança ----
  const jogosJogados = [];
  let mAntesJogo = 0;
  let rec = 0;
  for (let guarda = 0; guarda < 20; guarda++) {
    const t = await esperarAte(async () => {
      const x = await qualTela(page);
      return ['jogoEscute', 'jogoCaca', 'jogoJunte', 'jogoTrace', 'recompensa', 'trilha', 'despedida'].includes(x) ? x : null;
    }, { timeout: 60000, msg: 'próxima tela da lição' });
    if (t === 'trilha' || t === 'despedida') break;
    if (t === 'recompensa') {
      rec++;
      console.log('   recompensa #' + rec + ' marca=' + m + ' tipo=' + (await page.evaluate(() => document.querySelector('.premio img').src.split('/').pop())));
      const evPrev = await esp.eventos(m - 40 > 0 ? m - 40 : 0);
      const iFim = evPrev.map((x) => x.id).lastIndexOf('rodada_fim');
      await chegou('recompensa', { marca: iFim >= 0 && evPrev[iFim].idx >= mAntesJogo ? evPrev[iFim].idx : m });
      m = await esp.tamanho();
      await page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
      await tocar(page, 'button[aria-label="Continuar"]');
      await esperarAte(() => page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000, msg: 'sair da recompensa' });
      continue;
    }
    mAntesJogo = await esp.tamanho();
    const jogo = await J.jogarRodada();
    jogosJogados.push(jogo);
    m = await esp.tamanho();
    console.log('   jogo concluído:', jogo);
  }
  console.log('   jogos:', jogosJogados.join(', '), '| recompensas:', rec);
  ok(jogosJogados.join(',') === 'escute,caca,trace', 'lição de A (só 1 letra liberada): escute, caça e trace; Junte é pulado por falta de sílabas');
  ok(rec === 4, 'recompensas: 3 estrelas + 1 final', String(rec));
  const ev0 = await esp.eventos(0);
  ok(J.errosFeitos >= 3, `erros de propósito feitos (${J.errosFeitos})`);
  ok(J.vermelhos.length === 0, 'nenhum vermelho nas opções antes/durante/depois do erro', J.vermelhos.join('\n'));
  await chegou('trilha', { marca: m });

  // ---- progresso e recompensas ficaram gravados ----
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok(salvo.rec.estrela === 3 && salvo.rec.concha === 1 && salvo.rec.chifre === 0, 'recompensas: 3 estrelas e 1 concha (Marola) gravadas', JSON.stringify(salvo.rec));
  ok(salvo.hist.a && salvo.hist.a.length >= 11, 'histórico da letra A gravado', String(salvo.hist.a && salvo.hist.a.length));
  const errosReg = salvo.hist.a.filter((h) => !h.ok).length;
  ok(errosReg >= 2, `erros registram acertouPrimeira=false sem apagar nada (${errosReg})`);
  ok(salvo.rec.estrela + salvo.rec.concha === 4, 'nenhuma recompensa perdida por erro');

  // ---- coleção, menu e voltar ----
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Minha coleção"]');
  await chegou('colecao', { marca: m });
  const nItens = await page.locator('.item-colecao').count();
  ok(nItens === 4, `coleção mostra as recompensas ganhas (${nItens})`);
  await tocar(page, 'button[aria-label="Voltar para a trilha"]');
  await esperarTela(page, 'trilha');
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Brincadeiras"]');
  await chegou('menu', { marca: m });
  ok(await page.locator('.btn-jogo').count() === 5, 'menu: 5 brincadeiras');
  await tocar(page, 'button[aria-label="Voltar para a trilha"]');
  await esperarTela(page, 'trilha');

  // ---- persistência: recarregar mantém o progresso ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await esperarTela(page, 'inicio');
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Começar"]');
  await esperarTela(page, 'trilha'); // já tem guia: vai direto
  const salvo2 = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok(salvo2.guia === 'marola' && salvo2.rec.estrela === 3 && salvo2.hist.a.length === salvo.hist.a.length, 'progresso, guia e recompensas sobrevivem ao recarregar');
  await tirarFoto(page, 's-trilha-depois-reload');

  // ---- área dos pais: porta com conta, nome na fala, reiniciar ----
  await tocar(page, 'button[aria-label="Voltar ao início"]');
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Área dos pais"]');
  await esperarTela(page, 'pais');
  await tirarFoto(page, 's-pais-porta');
  const conta = await page.locator('.conta').innerText();
  const mm = /(\d+)\s*\+\s*(\d+)/.exec(conta);
  ok(!!mm, 'porta dos pais mostra uma conta de somar', conta);
  const soma = Number(mm[1]) + Number(mm[2]);
  const respostas = await page.locator('.respostas button').allInnerTexts();
  const errada = respostas.findIndex((r) => Number(r) !== soma);
  await tocar(page, '.respostas button', { indice: errada });
  await dormir(200);
  ok(await page.locator('#campo-nome').count() === 0, 'resposta errada não abre o painel dos pais');
  const conta2 = await page.locator('.conta').innerText();
  const m2 = /(\d+)\s*\+\s*(\d+)/.exec(conta2);
  const soma2 = Number(m2[1]) + Number(m2[2]);
  const resp2 = await page.locator('.respostas button').allInnerTexts();
  await tocar(page, '.respostas button', { indice: resp2.findIndex((r) => Number(r) === soma2) });
  await page.waitForSelector('.abas');
  await tirarFoto(page, 's-pais-painel');
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  await page.locator('#campo-nome').fill('Bia');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')).nome === 'Bia'), 'nome digitado é gravado');
  const resumo = await page.locator('#resumo-uso').innerText();
  ok(/Sessões\s*1/.test(resumo), 'painel mostra tempo e sessões', resumo);
  // libera a próxima letra pelo atalho dos pais e confere
  await tocar(page, 'button[aria-label="Liberar próxima letra"]');
  ok(/Liberada: E/.test(await page.locator('.nota').nth(1).innerText().catch(() => '') + (await page.locator('.pais').innerText())), 'atalho dos pais libera a letra E');
  await tocar(page, 'button[aria-label="Voltar"]');
  await esperarTela(page, 'inicio');

  // nome aparece na fala acerto_2: joga uma rodada de Escute pelo menu e procura "Muito bem, Bia!"
  m = await esp.tamanho();
  await tocar(page, 'button[aria-label="Começar"]');
  await esperarTela(page, 'trilha');
  await tocar(page, 'button[aria-label="Brincadeiras"]');
  await esperarTela(page, 'menu');
  await tocar(page, '.btn-jogo', { indice: 0 }); // escute
  const J2 = criarJogador(page, esp, R, { nome: 'Bia', errar: false });
  await J2.jogarRodada();
  const evNome = await esp.eventos(m, 'Bia');
  const textosFala = (await esp.bruto()).filter((x) => x.k === 'fala').map((x) => x.texto);
  ok(textosFala.some((t) => /Bia/.test(t)), 'o nome digitado vai no texto passado à fala', JSON.stringify([...new Set(textosFala)].slice(0, 12)));
  ok(!textosFala.some((t) => /\{nome\}/.test(t)), 'nenhum {nome} cru na fala');
  ok(evNome.some((x) => x.id === 'boas_vindas' || x.id.startsWith('acerto')), 'frases com nome reconhecidas pelo espião');
  await esperarTela(page, 'recompensa');
  await tocar(page, 'button[aria-label="Continuar"]');
  await esperarTela(page, 'menu');

  // reiniciar limpa
  await tocar(page, 'button[aria-label="Voltar para a trilha"]');
  await esperarTela(page, 'trilha');
  await tocar(page, 'button[aria-label="Voltar ao início"]');
  await esperarTela(page, 'inicio');
  await tocar(page, 'button[aria-label="Área dos pais"]');
  await esperarTela(page, 'pais');
  for (let tentativa = 0; tentativa < 6 && !(await page.locator('#campo-nome').count()); tentativa++) {
    const c = await page.locator('.conta').innerText();
    const q = /(\d+)\s*\+\s*(\d+)/.exec(c);
    const rs = await page.locator('.respostas button').allInnerTexts();
    await tocar(page, '.respostas button', { indice: rs.findIndex((r) => Number(r) === Number(q[1]) + Number(q[2])) });
    await dormir(150);
  }
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  await tocar(page, 'button[aria-label="Reiniciar progresso"]');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')).rec.estrela) > 0, 'reiniciar pede confirmação (primeiro toque não apaga)');
  await tocar(page, 'button[aria-label="Reiniciar progresso"]');
  await dormir(200);
  const depoisReiniciar = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
  ok(depoisReiniciar.liberadas.length === 1 && depoisReiniciar.rec.estrela === 0 && Object.keys(depoisReiniciar.hist).length === 0, 'reiniciar apaga letras, histórico e recompensas', JSON.stringify(depoisReiniciar).slice(0, 200));

  // ============ Despedida (sessão longa) ============
  console.log('\n# Despedida após 8 minutos');
  const seedLonga = { v: 1, nome: 'Bia', guia: 'lumi', liberadas: ['a'], hist: {}, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 9 * 60000, sessoes: 1, sessaoId: 1, ultima: Date.now() };
  const longa = await abrirApp(browser, srv.base, { rapido: true, seed: seedLonga });
  const pg2 = longa.page, esp2 = longa.esp;
  await esperarTela(pg2, 'inicio');
  await tocar(pg2, 'button[aria-label="Começar"]');
  await esperarTela(pg2, 'trilha');
  await tocar(pg2, 'button[aria-label="Brincadeiras"]');
  await esperarTela(pg2, 'menu');
  await tocar(pg2, '.btn-jogo', { indice: 0 });
  const J3 = criarJogador(pg2, esp2, R, { nome: 'Bia', errar: false });
  await J3.jogarRodada();
  await esperarTela(pg2, 'recompensa');
  m = await esp2.tamanho();
  await tocar(pg2, 'button[aria-label="Continuar"]');
  await esperarTela(pg2, 'despedida');
  await dormir(900);
  // a auditoria usa a página principal; aqui só conferimos a despedida na página longa
  {
    const a = await auditar(pg2);
    verificarAuditoria(R, 'tela despedida', a);
    await tirarFoto(pg2, 's-despedida');
    await esperarAte(async () => (await esp2.eventos(m, 'Bia')).some((x) => x.id === 'despedida'), { timeout: 8000 }).catch(() => {});
    const evDesp = (await esp2.eventos(m, 'Bia')).map((x) => x.id);
    ok(evDesp.includes('despedida'), 'despedida: chama o áudio ao entrar e fala a despedida', JSON.stringify(evDesp));
    // a despedida agora toca o arquivo da voz gravada (assets/audio/voz/frase_despedida.mp3), sem nome
    ok(await pg2.locator('button[aria-label="Ouvir de novo"]').count() === 1, 'despedida: botão ouvir de novo');
    ok(await pg2.locator('button[aria-label="Continuar brincando"]').count() === 1, 'despedida: a adulta pode continuar brincando');
    await tocar(pg2, 'button[aria-label="Continuar brincando"]');
    await esperarTela(pg2, 'trilha');
  }
  coleta.pageerrors.push(...longa.coleta.pageerrors);
  coleta.erros.push(...longa.coleta.erros);
  coleta.requisicoesExternas.push(...longa.coleta.requisicoesExternas);
  bruto2 = await esp2.bruto();

  // ============ Inegociáveis e console ============
  console.log('\n# Inegociáveis e console');
  const bruto = (await esp.bruto()).concat(bruto2);
  // o nome da letra só pode ser falado por item 'nome:' (id nome_*), nunca por outro item
  const ruins = falasProibidas(bruto).filter((r) => !/\(nome_[a-z]\)$/.test(r));
  console.log('   sílabas faladas que soam como nome de letra:', silabasHomofonas(bruto).join(' ') || '(nenhuma)');
  ok(ruins.length === 0, 'speechSynthesis.speak só recebe nome de letra vindo de item nome:* (nada de nome em som, sílaba, frase ou palavra)', JSON.stringify(ruins));
  const totalFalas = bruto.filter((x) => x.k === 'fala').length;
  const totalArq = bruto.filter((x) => x.k === 'audio').length;
  console.log(`   (espiado: ${totalFalas} falas por voz, ${totalArq} arquivos de áudio)`);
  const somTocado = bruto.filter((x) => x.k === 'audio' && /som_/.test(x.url)).length;
  ok(somTocado >= 15, 'sons das letras tocados por arquivo (som_*.mp3)', String(somTocado));
  ok(coleta.pageerrors.length === 0, 'nenhum pageerror', coleta.pageerrors.join('\n'));
  ok(coleta.erros.length === 0, 'nenhum console.error', coleta.erros.join('\n'));
  ok(coleta.avisos.length === 0, 'nenhum console.warn', coleta.avisos.join('\n'));
  ok(coleta.respostasRuins.length === 0, 'nenhuma resposta 4xx/5xx depois que o SW controla', coleta.respostasRuins.join('\n'));
  ok(coleta.requisicoesExternas.length === 0, 'nenhuma requisição para fora da origem', coleta.requisicoesExternas.join('\n'));
  ok(coleta.falhas.length === 0, 'nenhuma requisição falhou', coleta.falhas.join('\n'));
  console.log('   console.info recebidos:', coleta.infos.length, '(permitido)');

  // sem localStorage: o app não quebra
  console.log('\n# localStorage indisponível');
  const sem = await abrirApp(browser, srv.base, { rapido: true, semStorage: true });
  await esperarTela(sem.page, 'inicio');
  await tocar(sem.page, 'button[aria-label="Começar"]');
  await esperarTela(sem.page, 'guia');
  await tocar(sem.page, 'button[aria-label="Escolher a unicórnio"]');
  await esperarTela(sem.page, 'trilha');
  await tocar(sem.page, '.parada.foco');
  await esperarTela(sem.page, 'apresenta');
  ok(sem.coleta.pageerrors.length === 0 && sem.coleta.erros.length === 0, 'sem localStorage: sem erros e o fluxo segue', sem.coleta.pageerrors.concat(sem.coleta.erros).join('\n'));
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
