// Gravação da voz dentro do app (IndexedDB). Uso: node tests/f-gravar.test.mjs
// Microfone falso do Chromium; sem mocks de app. Screenshots em /tmp/claude-0/f.
import { mkdirSync } from 'node:fs';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, esperarAte, dormir, tocar, curriculo,
} from './e-lib.mjs';

const N = curriculo.ordem.length;
const R = criarRelator('F gravar');
const { ok } = R;
const SHOTS = '/tmp/claude-0/f';
mkdirSync(SHOTS, { recursive: true });
const srv = await iniciarServidor();
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const seed = { v: 1, nome: 'Bia', guia: 'lumi', liberadas: ['m'], hist: {}, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 0, sessoes: 1, sessaoId: 1, ultima: Date.now() };

async function novoCtx(extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', permissions: ['microphone'], ...extra });
  return ctx;
}
async function entrarPais(page) {
  await tocar(page, 'button[aria-label="Área dos pais"]');
  await page.waitForSelector('.conta');
  const t = await page.locator('.conta').innerText();
  const [, x, y] = t.match(/(\d+)\s*\+\s*(\d+)/);
  await tocar(page, `button[aria-label="Resposta ${+x + +y}"]`);
  await page.waitForSelector('.abas');
}
const limpo = (coleta, rot) => {
  ok(coleta.erros.length === 0, rot + ': sem console.error', coleta.erros.join('\n'));
  ok(coleta.avisos.length === 0, rot + ': sem console.warn', coleta.avisos.join('\n'));
  ok(coleta.pageerrors.length === 0, rot + ': sem pageerror', coleta.pageerrors.join('\n'));
};
const logAudio = (page) => page.evaluate(() => window.__esp.log.filter((x) => x.k === 'audio').map((x) => x.url));

try {
  // ============ função de recorte (pura) ============
  console.log('\n# Recorte de silêncio com WAV sintético');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, srv.base, { contexto: ctx, rapido: true, seed });
    const r = await app.page.evaluate(async () => {
      const m = await import('/js/telas/gravar.js');
      const taxa = 44100;
      const n = taxa * 3; // 1 s silêncio + 0,5 s tom + 1,5 s silêncio
      const d = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / taxa;
        d[i] = (Math.random() - 0.5) * 0.002; // ruído de fundo bem baixo
        if (t >= 1 && t < 1.5) d[i] += 0.3 * Math.sin(2 * Math.PI * 440 * t);
      }
      const wav = m.codificarWav(d, taxa);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const p = await m.processarGravacao(blob);
      const ab = await p.blob.arrayBuffer();
      const v = new DataView(ab);
      const taxaSaida = v.getUint32(24, true);
      const bits = v.getUint16(34, true);
      const canais = v.getUint16(22, true);
      let pico = 0;
      for (let i = 44; i < ab.byteLength; i += 2) pico = Math.max(pico, Math.abs(v.getInt16(i, true)) / 32768);
      // silêncio puro
      const muda = await m.processarGravacao(new Blob([m.codificarWav(new Float32Array(taxa), taxa)], { type: 'audio/wav' }));
      const lixo = await m.processarGravacao(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }));
      return { dur: p.duracao, tipo: p.tipo, taxaSaida, bits, canais, pico, mudo: !!muda.mudo, lixoOriginal: !!lixo.original, lixoTam: lixo.blob.size };
    });
    ok(r.tipo === 'audio/wav' && r.taxaSaida === 22050 && r.bits === 16 && r.canais === 1, 'WAV mono 16 bits a 22050 Hz', JSON.stringify(r));
    ok(r.dur > 0.5 + 0.08 && r.dur < 0.5 + 0.2, 'duração = tom (0,5 s) + margens (~0,12 s)', String(r.dur));
    ok(r.pico > 0.85 && r.pico <= 0.93, 'pico normalizado perto de 0,9', String(r.pico));
    ok(r.mudo, 'gravação muda é recusada');
    ok(r.lixoOriginal && r.lixoTam === 4, 'falha na decodificação guarda o blob original');
    limpo(app.coleta, 'recorte');
    await ctx.close();
  }

  // ============ fluxo principal ============
  console.log('\n# Gravar som_m pelo app');
  const ctx = await novoCtx();
  const app = await abrirApp(browser, srv.base, { contexto: ctx, rapido: true, seed });
  const { page, coleta } = app;
  await entrarPais(page);
  ok(/Voz gravada: 0 itens/.test(await page.locator('#resumo-voz').innerText().then(async (t) => { await esperarAte(async () => /0 itens/.test(await page.locator('#resumo-voz').innerText()), { timeout: 4000 }).catch(() => {}); return page.locator('#resumo-voz').innerText(); })), 'painel mostra "Voz gravada: 0 itens"');
  await tocar(page, 'button.aba[data-aba="voz"]');
  await page.waitForSelector('.gv-item[data-id="som_m"]');
  await page.screenshot({ path: SHOTS + '/gravar-1-inicio.png' });
  ok(new RegExp('0 de ' + N).test(await page.locator('.gv-contador[data-grupo="sons"]').innerText()), 'contador dos sons: 0 de N');
  const nGrupos = await page.locator('details.gv-grupo').count();
  ok(nGrupos === 5, '5 grupos recolhíveis (sons, nomes, frases, sílabas, palavras)');
  ok((await page.locator('.gv-item').count()) === N, 'só os sons aparecem (outros grupos recolhidos)');
  const tit = await page.locator('.gv-titulo').allInnerTexts();
  ok(tit[0].includes('Sons das letras') && tit[1].includes('Nomes das letras') && tit[2].includes('Frases') && tit[3].includes('Sílabas') && tit[4].includes('Palavras'), 'ordem dos grupos', tit.join('|'));
  ok(/mmm/.test(await page.locator('details[data-grupo="sons"] > .aviso').innerText()), 'aviso fixo sobre fonema sem vogal');
  const alvos = await page.locator('.gv-item[data-id="som_m"] .gv-botoes button').evaluateAll((bs) => bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height));
  ok(alvos.every((h) => h >= 47.5), 'botões visíveis >= 48 px', alvos.join(','));

  await tocar(page, '.gv-item[data-id="som_m"] button[data-acao="gravar"]');
  await page.waitForSelector('.gv-item[data-id="som_m"].gravando');
  ok((await page.locator('.gv-item[data-id="som_m"] button[data-acao="gravar"]').innerText()) === 'Parar', 'botão vira Parar');
  await page.screenshot({ path: SHOTS + '/gravar-2-gravando.png' });
  ok(await page.locator('.gv-item[data-id="som_p"] button[data-acao="gravar"]').isDisabled(), 'outros itens ficam desabilitados enquanto grava');
  await dormir(1500);
  await tocar(page, '.gv-item[data-id="som_m"] button[data-acao="gravar"]');
  await page.waitForSelector('.gv-item[data-id="som_m"].gravado', { timeout: 15000 });
  ok(true, 'marca de gravado apareceu');
  ok(new RegExp('1 de ' + N).test(await page.locator('.gv-contador[data-grupo="sons"]').innerText()), 'contador: 1 de N');
  ok(!!(await page.locator('.gv-item[data-id="som_m"] .gv-marca').isVisible()), 'marca visual visível');
  await esperarAte(async () => (await logAudio(page)).some((u) => u.startsWith('blob:')), { timeout: 5000, msg: 'toca automático' }).catch(() => {});
  ok((await logAudio(page)).some((u) => u.startsWith('blob:')), 'tocou a gravação automaticamente após salvar');
  const info = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('trilhaSons-voz', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const v = await new Promise((res) => { const q = db.transaction('gravacoes').objectStore('gravacoes').get('som_m'); q.onsuccess = () => res(q.result); });
    return { tipo: v.tipo, size: v.blob.size, dur: v.duracao, criado: typeof v.criadoEm };
  });
  ok(info.tipo === 'audio/wav' && info.size > 1000 && info.dur > 0.1 && info.dur < 3 && info.criado === 'number', 'guardado como WAV no IndexedDB', JSON.stringify(info));
  await page.screenshot({ path: SHOTS + '/gravar-3-gravado.png' });

  // recarrega: continua gravado
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await entrarPais(page);
  await esperarAte(async () => /Voz gravada: 1 item/.test(await page.locator('#resumo-voz').innerText()), { msg: 'resumo 1 item' });
  ok(true, 'painel mostra "Voz gravada: 1 item" após recarregar');
  await tocar(page, 'button.aba[data-aba="voz"]');
  await page.waitForSelector('.gv-item[data-id="som_m"].gravado');
  ok(true, 'som_m continua gravado após recarregar');

  // voltar ao painel (sem nova conta)
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  await page.waitForSelector('#campo-nome');
  ok(true, 'voltar leva direto ao painel');

  // jogo usa a gravação
  console.log('\n# O jogo usa a gravação e volta ao arquivo ao apagar');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await tocar(page, 'button[aria-label="Começar"]');
  await page.waitForSelector('.ponto.parada.foco');
  await page.evaluate(() => { window.__esp.log.length = 0; });
  await tocar(page, '.ponto.parada.foco');
  await page.waitForSelector('.apresenta');
  await esperarAte(async () => (await logAudio(page)).some((u) => /som_m\.mp3|^blob:/.test(u)), { timeout: 20000, msg: 'áudio da lição' });
  await dormir(500);
  let urls = await logAudio(page);
  ok(urls.some((u) => u.startsWith('blob:')), 'lição da letra M toca um blob: URL para o som', urls.join(' '));
  ok(!urls.some((u) => /audio\/(voz|gerado)\/som_m\.mp3/.test(u)), 'não toca o arquivo original (voz importada ou gerado) enquanto há gravação');

  // apagar pela tela
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await entrarPais(page);
  await tocar(page, 'button.aba[data-aba="voz"]');
  await page.waitForSelector('.gv-item[data-id="som_m"].gravado');
  const bApagar = '.gv-item[data-id="som_m"] button[data-acao="apagar"]';
  await tocar(page, bApagar);
  ok(/Toque de novo/.test(await page.locator(bApagar).innerText()), 'apagar pede confirmação em dois toques');
  ok(await page.locator('.gv-item[data-id="som_m"].gravado').count() === 1, 'primeiro toque não apaga');
  await tocar(page, bApagar);
  await page.waitForSelector('.gv-item[data-id="som_m"]:not(.gravado)');
  ok(true, 'segundo toque apagou');
  ok(new RegExp('0 de ' + N).test(await page.locator('.gv-contador[data-grupo="sons"]').innerText()), 'contador volta a 0 de N');
  // "ouvir como está hoje" aparece sem gravação e toca o arquivo original (voz importada ou gerado)
  await page.evaluate(() => { window.__esp.log.length = 0; });
  await tocar(page, '.gv-item[data-id="som_m"] button[data-acao="hoje"]');
  await esperarAte(async () => (await logAudio(page)).length > 0, { msg: 'ouvir como está hoje' });
  urls = await logAudio(page);
  ok(urls.some((u) => /assets\/audio\/(voz|gerado)\/som_m\.mp3/.test(u)), 'ouvir como está hoje toca o som gerado', urls.join(' '));
  // jogo (sem recarregar a página): a resolução foi atualizada por gravacoesMudaram
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  await page.waitForSelector('#campo-nome');
  // recarrega para jogar
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await tocar(page, 'button[aria-label="Começar"]');
  await page.waitForSelector('.ponto.parada.foco');
  await page.evaluate(() => { window.__esp.log.length = 0; });
  await tocar(page, '.ponto.parada.foco');
  await page.waitForSelector('.apresenta');
  await esperarAte(async () => (await logAudio(page)).some((u) => /som_m\.mp3|^blob:/.test(u)), { timeout: 20000, msg: 'áudio da lição' });
  await dormir(500);
  urls = await logAudio(page);
  ok(urls.some((u) => /assets\/audio\/(voz|gerado)\/som_m\.mp3/.test(u)) && !urls.some((u) => u.startsWith('blob:')), 'apagada a gravação, o jogo volta a assets/audio/gerado/som_m.mp3', urls.join(' '));

  // ============ apagar todas, reiniciar progresso, sem sons ============
  console.log('\n# Apagar todas, reiniciar progresso, frases e grupos');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  await entrarPais(page);
  await tocar(page, 'button.aba[data-aba="voz"]');
  await page.waitForSelector('.gv-item[data-id="som_a"]');
  // grava duas letras
  for (const l of ['a', 'e']) {
    await tocar(page, `.gv-item[data-id="som_${l}"] button[data-acao="gravar"]`);
    await page.waitForSelector(`.gv-item[data-id="som_${l}"].gravando`);
    await dormir(1200);
    await tocar(page, `.gv-item[data-id="som_${l}"] button[data-acao="gravar"]`);
    await page.waitForSelector(`.gv-item[data-id="som_${l}"].gravado`, { timeout: 15000 });
  }
  ok(new RegExp('2 de ' + N).test(await page.locator('.gv-contador[data-grupo="sons"]').innerText()), '2 de N gravados');
  // frases: abre o grupo, mostra texto sem {nome}
  await tocar(page, 'button[data-filtro="todos"]');
  await tocar(page, 'details[data-grupo="frases"] > summary');
  await page.waitForSelector('.gv-item[data-id="frase_acerto_2"]');
  const txt = await page.locator('.gv-item[data-id="frase_acerto_2"] .gv-alvo').innerText();
  ok(txt === 'Muito bem!', 'frase sem {nome}', txt);
  await tocar(page, 'details[data-grupo="silabas"] > summary');
  ok((await page.locator('.gv-item[data-id="sil_ma"] .gv-alvo').innerText()) === 'MA', 'sílaba em maiúsculas');
  await tocar(page, 'details[data-grupo="palavras"] > summary');
  ok((await page.locator('.gv-item[data-id="pal_mapa"] .gv-alvo').innerText()) === 'MAPA', 'palavra em maiúsculas');
  // nomes das letras: grupo próprio, com o texto "Diga o NOME da letra: ..."
  await tocar(page, 'details[data-grupo="nomes"] > summary');
  await page.waitForSelector('.gv-item[data-id="nome_m"]');
  ok((await page.locator('details[data-grupo="nomes"] .gv-item').count()) === curriculo.ordem.length + 6, 'nomes: uma linha por letra (as do currículo e h k q w x y)');
  ok((await page.locator('.gv-item[data-id="nome_b"] .gv-dica').innerText()) === 'Diga o NOME da letra: bê', 'nomes: texto "Diga o NOME da letra: bê"');
  ok((await page.locator('.gv-item[data-id="nome_h"] .gv-dica').innerText()) === 'Diga o NOME da letra: agá', 'nomes: letras fora do currículo também (agá)');
  ok(/NOME da letra, não o som/.test(await page.locator('details[data-grupo="nomes"] > .aviso').innerText()), 'nomes: aviso separando nome e som');
  ok(new RegExp('0 de ' + (curriculo.ordem.length + 6)).test(await page.locator('.gv-contador[data-grupo="nomes"]').innerText()), 'nomes: contador próprio');
  await page.locator('.gv-item[data-id="pal_mapa"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: SHOTS + '/gravar-4-palavras.png' });

  // reiniciar progresso não apaga gravações
  await tocar(page, 'button.aba[data-aba="ajustes"]');
  await page.waitForSelector('#campo-nome');
  await tocar(page, 'button[aria-label="Reiniciar progresso"]');
  await tocar(page, 'button[aria-label="Reiniciar progresso"]');
  await page.waitForSelector('#campo-nome');
  await esperarAte(async () => /Voz gravada: 2 itens/.test(await page.locator('#resumo-voz').innerText()), { msg: 'resumo 2 itens' });
  ok(true, 'reiniciar progresso não apaga gravações (2 itens)');
  await page.screenshot({ path: SHOTS + '/pais-painel.png', fullPage: false });

  await tocar(page, 'button.aba[data-aba="voz"]');
  await page.waitForSelector('button[data-acao="apagar-todas"]');
  const bt = 'button[data-acao="apagar-todas"]';
  await tocar(page, bt);
  ok(await page.locator('.gv-item.gravado').count() === 2, 'primeiro toque em "apagar todas" só pede confirmação');
  await tocar(page, bt);
  await esperarAte(async () => (await page.locator('.gv-item.gravado').count()) === 0, { msg: 'apagou tudo' });
  ok(new RegExp('0 de ' + N).test(await page.locator('.gv-contador[data-grupo="sons"]').innerText()), 'apagar todas funciona');
  await esperarAte(async () => /Voz gravada: 0 itens/.test(await page.locator('#resumo-voz').innerText()), { msg: 'resumo 0' });
  ok(true, 'painel volta a "Voz gravada: 0 itens"');
  limpo(coleta, 'fluxo principal');
  await ctx.close();

  // ============ permissão negada ============
  console.log('\n# Microfone negado / sem MediaRecorder');
  {
    const c2 = await novoCtx({ permissions: [] });
    const a2 = await abrirApp(browser, srv.base, { contexto: c2, rapido: true, seed });
    await a2.page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negado', 'NotAllowedError'));
    });
    await entrarPais(a2.page);
    await tocar(a2.page, 'button.aba[data-aba="voz"]');
    await a2.page.waitForSelector('.gv-item[data-id="som_m"]');
    await tocar(a2.page, '.gv-item[data-id="som_m"] button[data-acao="gravar"]');
    await a2.page.waitForSelector('#msg-gravar:not([style*="none"])');
    ok(/permita o microfone/i.test(await a2.page.locator('#msg-gravar').innerText()), 'mensagem clara de microfone bloqueado');
    ok(await a2.page.locator('.gv-item.gravando').count() === 0, 'não ficou em estado de gravação');
    await a2.page.evaluate(() => { delete window.MediaRecorder; window.MediaRecorder = undefined; });
    await tocar(a2.page, '.gv-item[data-id="som_m"] button[data-acao="gravar"]');
    await esperarAte(async () => /não consegue gravar/.test(await a2.page.locator('#msg-gravar').innerText()), { msg: 'msg sem MediaRecorder' });
    ok(true, 'sem MediaRecorder: mensagem clara');
    limpo(a2.coleta, 'permissão negada');
    await c2.close();
  }

  // ============ IndexedDB indisponível ============
  for (const modo of ['getter', 'open']) {
    console.log(`\n# IndexedDB indisponível (${modo})`);
    const c3 = await novoCtx();
    await c3.addInitScript((m) => {
      if (m === 'getter') Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('bloqueado', 'SecurityError'); } });
      else Object.defineProperty(window, 'indexedDB', { value: { open() { throw new DOMException('bloqueado', 'SecurityError'); } } });
    }, modo);
    const a3 = await abrirApp(browser, srv.base, { contexto: c3, rapido: true, seed });
    await entrarPais(a3.page);
    ok(await a3.page.locator('#resumo-voz').count() === 1, 'painel dos pais abre');
    await tocar(a3.page, 'button.aba[data-aba="voz"]');
    await a3.page.waitForSelector('.gv-item, #gv-indisponivel');
    // sem DB: ou mostra aviso de indisponível, ou (open lançando) lista vazia sem quebrar
    ok(true, 'tela de gravação abre sem quebrar');
    await tocar(a3.page, 'button.aba[data-aba="ajustes"]');
    await a3.page.waitForSelector('#campo-nome');
    await a3.page.reload({ waitUntil: 'load' });
    await a3.page.waitForSelector('#app > *');
    await tocar(a3.page, 'button[aria-label="Começar"]');
    await a3.page.waitForSelector('.ponto.parada.foco');
    await a3.page.evaluate(() => { window.__esp.log.length = 0; });
    await tocar(a3.page, '.ponto.parada.foco');
    await a3.page.waitForSelector('.apresenta');
    await esperarAte(async () => (await logAudio(a3.page)).some((u) => /som_m\.mp3|^blob:/.test(u)), { timeout: 20000, msg: 'áudio sem IDB' });
    ok((await logAudio(a3.page)).some((u) => /audio\/(voz|gerado)\/som_m\.mp3/.test(u)), 'o jogo segue tocando o som gerado');
    if (modo === 'getter') await a3.page.screenshot({ path: SHOTS + '/gravar-sem-idb.png' });
    limpo(a3.coleta, 'IDB ' + modo);
    await c3.close();
  }
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
