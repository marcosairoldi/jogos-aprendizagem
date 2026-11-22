// Painel dos pais (abas, ajustes, backup, atualização). Uso: node tests/j-painel.test.mjs
// Playwright com servidor estático próprio (para poder trocar o sw.js e simular uma versão nova). Fotos em /tmp/claude-0/j.
import http from 'node:http';
import net from 'node:net';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  chromium, abrirApp, criarRelator, esperarAte, dormir, tocar, raizProjeto, curriculo,
} from './e-lib.mjs';

const R = criarRelator('J painel');
const { ok } = R;
const FOTOS = '/tmp/claude-0/j';
mkdirSync(FOTOS, { recursive: true });

// ---------------------------------------------------------------- servidor estático com sw.js trocável
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let swNovo = false; // quando true, /sw.js é servido como uma versão nova (outro nome de cache)
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(raizProjeto, p);
  if (!arq.startsWith(raizProjeto) || !existsSync(arq) || !statSync(arq).isFile()) { res.writeHead(404); res.end('nao'); return; }
  let corpo = readFileSync(arq);
  if (p === '/sw.js' && swNovo) corpo = Buffer.from(corpo.toString('utf8').replace(/const CACHE = '[^']*';/, "const CACHE = 'trilha-sons-versao-nova-teste';"));
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(corpo);
});
const porta = await new Promise((res) => { const s = net.createServer().listen(0, () => { const n = s.address().port; s.close(() => res(n)); }); });
await new Promise((res) => servidor.listen(porta, '127.0.0.1', res));
const base = `http://127.0.0.1:${porta}/`;

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const semente = (extra = {}) => ({
  v: 1, nome: 'Bia', guia: 'lumi', liberadas: ['a', 'e', 'i'],
  hist: { a: Array.from({ length: 6 }, (_, i) => ({ jogo: ['escute', 'caca', 'trace'][i % 3], ok: i !== 1, sessao: 1, t: Date.now() - 60000 + i * 1000 })) },
  rec: { estrela: 3, concha: 1, chifre: 1 }, recSessao: { estrela: 0, concha: 0, chifre: 0 },
  tempoTotal: 7 * 60000, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now(), ...extra,
});
const novoCtx = (extra = {}) => browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', permissions: ['microphone'], acceptDownloads: true, ...extra });
const limpo = (coleta, rot) => {
  ok(coleta.erros.length === 0, rot + ': sem console.error', coleta.erros.join('\n'));
  ok(coleta.avisos.length === 0, rot + ': sem console.warn', coleta.avisos.join('\n'));
  ok(coleta.pageerrors.length === 0, rot + ': sem pageerror', coleta.pageerrors.join('\n'));
};
async function entrarPainel(page, { errarPrimeiro = false } = {}) {
  await tocar(page, 'button[aria-label="Área dos pais"]');
  await page.waitForSelector('.conta');
  const soma = async () => { const m = /(\d+)\s*\+\s*(\d+)/.exec(await page.locator('.conta').innerText()); return +m[1] + +m[2]; };
  if (errarPrimeiro) {
    const s = await soma();
    const rs = await page.locator('.respostas button').allInnerTexts();
    await tocar(page, '.respostas button', { indice: rs.findIndex((x) => +x !== s) });
    await dormir(200);
    ok(await page.locator('.abas').count() === 0, 'porta: resposta errada não abre o painel');
    ok(await page.locator('.conta').count() === 1, 'porta: resposta errada mostra uma nova conta');
  }
  await tocar(page, `button[aria-label="Resposta ${await soma()}"]`);
  await page.waitForSelector('.abas');
}
const aba = async (page, nome) => { await tocar(page, `button.aba[data-aba="${nome}"]`); await dormir(120); };
const ls = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
// parte estável do progresso (o tempo de uso e a data da última atividade mudam sozinhos)
const estavel = async (page) => { const { nome, guia, liberadas, hist, rec, ajustes, sessoes } = await ls(page); return JSON.stringify({ nome, guia, liberadas, hist, rec, ajustes, sessoes }); };
const idsVoz = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('trilhaSons-voz', 1);
  r.onupgradeneeded = () => { try { r.result.createObjectStore('gravacoes'); } catch (e) { /* ok */ } };
  r.onsuccess = () => { const t = r.result.transaction('gravacoes', 'readonly'); const k = t.objectStore('gravacoes').getAllKeys(); t.oncomplete = () => { r.result.close(); res(k.result.map(String).sort()); }; };
  r.onerror = () => res(null);
}));
const msg = (page) => page.locator('#msg-pais').innerText().catch(() => '');
const nomeAtual = async (page) => (await ls(page)).nome;

async function gravarSom(page, id) {
  await tocar(page, `.gv-item[data-id="${id}"] button[data-acao="gravar"]`);
  await page.waitForSelector(`.gv-item[data-id="${id}"].gravando`);
  await dormir(1200);
  await tocar(page, `.gv-item[data-id="${id}"] button[data-acao="gravar"]`);
  await page.waitForSelector(`.gv-item[data-id="${id}"].gravado`, { timeout: 15000 });
}

try {
  // ================================================================ 1. porta e seções
  console.log('\n# 1. Porta com conta e todas as seções do painel');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente() });
    const { page } = app;
    await tocar(page, 'button[aria-label="Área dos pais"]');
    await page.waitForSelector('.conta');
    await page.screenshot({ path: FOTOS + '/painel-porta.png' });
    await aba(page, 'progresso').catch(() => {});
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#app > *');
    await entrarPainel(page, { errarPrimeiro: true });
    await dormir(300);
    await page.screenshot({ path: FOTOS + '/painel-progresso.png' });
    const abas = await page.locator('.abas .aba').allInnerTexts();
    ok(JSON.stringify(abas.map((t) => t.trim())) === JSON.stringify(['Progresso', 'Ajustes', 'Sua voz', 'Backup']), 'abas na ordem Progresso, Ajustes, Sua voz, Backup', abas.join('|'));
    const titulos = async () => (await page.locator('.aba-painel:not([hidden]) h2').allInnerTexts()).map((t) => t.trim());
    let t = await titulos();
    for (const x of ['Pequenas grandes conquistas', 'Letras do currículo', 'Letra por letra', 'Onde precisou de mais ajuda', 'Histórico recente']) ok(t.includes(x), `Progresso: seção "${x}"`, t.join('|'));
    ok(/7 min/.test(await page.locator('#resumo-uso').innerText()) && (await page.locator('#grade-letras .cel').count()) === curriculo.ordem.length, 'Progresso: resumo e grade de letras');
    ok((await page.locator('#cartoes-letras .cartao-letra').count()) === 3, 'Progresso: um cartão por letra liberada');
    ok((await page.locator('#lista-historico li').count()) > 0 && (await page.locator('#lista-ajuda-letras li').count()) === 1, 'Progresso: histórico recente e onde precisou de ajuda');
    await aba(page, 'ajustes');
    await page.screenshot({ path: FOTOS + '/painel-ajustes.png' });
    t = await titulos();
    for (const x of ['Prática do seu jeito', 'Guia', 'Progresso', 'Ajuda']) ok(t.includes(x), `Ajustes: seção "${x}"`, t.join('|'));
    for (const l of ['Nome da criança', 'Diminuir: Atividades por rodada', 'Aumentar: Letras de revisão', 'Mostrar legendas', 'Trace a Letra na lição', 'Trocar guia', 'Liberar próxima letra', 'Reiniciar progresso', 'Como funciona']) {
      ok((await page.locator(`[aria-label="${l}"]`).count()) >= 1, `Ajustes: controle "${l}"`);
    }
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_a"]');
    await page.screenshot({ path: FOTOS + '/painel-voz.png' });
    ok(await page.locator('#busca-som').count() === 1 && await page.locator('button[data-filtro="letras"]').count() === 1 && await page.locator('button[data-filtro="todos"]').count() === 1, 'Sua voz: busca e filtro Letras / Todos os sons');
    await page.fill('#busca-som', 'mapa');
    await dormir(300);
    ok(await page.locator('.gv-item[data-id="pal_mapa"]:not([hidden])').count() === 1 && await page.locator('.gv-item[data-id="som_a"]:not([hidden])').count() === 0, 'Sua voz: a busca acha a palavra e esconde o resto');
    await page.fill('#busca-som', '');
    ok(await page.locator('.gv-item[data-id="som_a"] button[data-acao="enviar"]').count() === 1, 'Sua voz: botão de enviar arquivo de áudio');
    await aba(page, 'backup');
    await page.screenshot({ path: FOTOS + '/painel-backup.png' });
    t = await titulos();
    ok(t.includes('Uma cópia das descobertas'), 'Backup: seção "Uma cópia das descobertas"', t.join('|'));
    ok(await page.locator('button[aria-label="Exportar cópia"]').count() === 1 && await page.locator('button[aria-label="Importar cópia"]').count() === 1 && /ainda não feita/.test(await page.locator('#ultima-copia').innerText()), 'Backup: exportar, importar e "ainda não feita"');
    ok(/Tudo salvo somente neste aparelho/.test(await page.locator('.rodape-pais').innerText()) && await page.locator('#cartao-versao').count() === 1, 'rodapé "Tudo salvo somente neste aparelho" e cartão da versão');
    limpo(app.coleta, 'porta e seções');
    await ctx.close();
  }

  // ================================================================ 2. ajustes mudam o comportamento
  console.log('\n# 2. Ajustes salvam e mudam o comportamento');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente() });
    const { page } = app;
    await entrarPainel(page);
    await aba(page, 'ajustes');
    ok((await page.locator('#valor-itens').innerText()) === '5', 'atividades por rodada começa em 5 (regra do currículo)');
    for (let i = 0; i < 2; i++) await tocar(page, 'button[aria-label="Diminuir: Atividades por rodada"]');
    ok((await page.locator('#valor-itens').innerText()) === '3' && (await ls(page)).ajustes.itensPorRodada === 3, 'atividades por rodada: 3 salvo no aparelho');
    ok(await page.locator('button[aria-label="Diminuir: Atividades por rodada"]').isDisabled(), 'atividades por rodada não passa do mínimo');
    ok(/Ajuste salvo/.test(await msg(page)), 'mensagem "Ajuste salvo neste aparelho"');
    // revisão: 0 = só a letra nova
    const rev0 = await page.evaluate(async () => { const p = await import('/js/progresso.js'); const a = p.escolherLetrasRodada(5, 'i').length; return a; });
    ok(rev0 === 3, 'com a revisão padrão a rodada tem a letra nova e 2 antigas', String(rev0));
    for (let i = 0; i < 3; i++) await tocar(page, 'button[aria-label="Diminuir: Letras de revisão"]').catch(() => {});
    ok((await page.locator('#valor-revisao').innerText()) === '0' && (await ls(page)).ajustes.letrasRevisao === 0, 'letras de revisão: 0 salvo');
    const rev1 = await page.evaluate(async () => { const p = await import('/js/progresso.js'); return p.escolherLetrasRodada(5, 'i'); });
    ok(rev1.length === 1 && rev1[0] === 'i', 'com revisão 0 a rodada só tem a letra nova', JSON.stringify(rev1));
    await tocar(page, 'button[aria-label="Aumentar: Letras de revisão"]');
    ok((await ls(page)).ajustes.letrasRevisao === 1, 'letras de revisão: 1');
    // Trace na lição
    await tocar(page, 'button[aria-label="Trace a Letra na lição"]');
    ok((await ls(page)).ajustes.tracadoNaLicao === false, 'Trace na lição: desligado e salvo');
    // legendas
    await tocar(page, 'button[aria-label="Mostrar legendas"]');
    ok(await page.evaluate(() => localStorage.getItem('trilhaSons.legendas')) === 'false', 'legendas desligadas e salvas');
    await tocar(page, 'button[aria-label="Mostrar legendas"]');
    // recarrega: persiste
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#app > *');
    await entrarPainel(page); await aba(page, 'ajustes');
    ok((await page.locator('#valor-itens').innerText()) === '3' && (await page.locator('#valor-revisao').innerText()) === '1', 'ajustes sobrevivem ao recarregar');
    await page.screenshot({ path: FOTOS + '/painel-ajustes-salvos.png' });
    // comportamento no jogo: 3 itens por rodada
    await tocar(page, 'button[aria-label="Voltar"]');
    await tocar(page, 'button[aria-label="Começar"]');
    await page.waitForSelector('.ponto.parada.foco');
    await tocar(page, 'button[aria-label="Brincadeiras"]');
    await page.waitForSelector('.menu-jogos');
    await tocar(page, 'button[aria-label="Escute e toque"]');
    await page.waitForSelector('.j-progresso .j-ponto');
    const pontos = await page.locator('.j-progresso .j-ponto').count();
    ok(pontos === 3, 'o jogo usa 3 itens por rodada (bolinhas de progresso)', String(pontos));
    // lição sem Trace: 4 jogos -> 3 (a letra I tem Junte), então escute, caça e junte
    await tocar(page, 'button[aria-label="Voltar para a trilha"]');
    await page.waitForSelector('.ponto.parada.foco');
    await tocar(page, '.ponto.parada.foco');
    await page.waitForSelector('.apresenta');
    await tocar(page, 'button[aria-label="Continuar"]');
    await esperarAte(async () => /\d de \d/.test(await page.locator('#passos-licao .passos-texto').innerText()), { msg: 'passos da lição' });
    const passos = await page.locator('#passos-licao .passos-texto').innerText();
    ok(!/Trace/.test(passos) && /1 de 3 · Escute e Toque/.test(passos), 'lição sem o Trace a Letra (3 passos)', passos);
    limpo(app.coleta, 'ajustes');
    await ctx.close();
  }

  // ================================================================ 3 a 6. backup
  console.log('\n# 3. Exportar backup (progresso, ajustes e gravações)');
  const ARQ = '/tmp/claude-0/j/copia-valida.json';
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente({ nome: 'Lia', ajustes: { itensPorRodada: 4, letrasRevisao: 1, tracadoNaLicao: false } }) });
    const { page } = app;
    await entrarPainel(page);
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_m"]');
    await gravarSom(page, 'som_m');
    await gravarSom(page, 'som_a');
    ok(JSON.stringify(await idsVoz(page)) === JSON.stringify(['som_a', 'som_m']), 'duas gravações feitas com o microfone falso');
    await aba(page, 'backup');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), tocar(page, 'button[aria-label="Exportar cópia"]')]);
    ok(/^trilha-dos-sons-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'o arquivo baixado tem nome com a data', dl.suggestedFilename());
    await dl.saveAs(ARQ);
    const copia = JSON.parse(readFileSync(ARQ, 'utf8'));
    ok(copia.app === 'trilha-dos-sons' && copia.versao === 1 && copia.criadoEm > 0, 'JSON válido com app, versão e data');
    ok(copia.progresso.nome === 'Lia' && JSON.stringify(copia.progresso.liberadas) === '["a","e","i"]' && copia.progresso.rec.estrela === 3 && copia.progresso.hist.a.length === 6, 'contém o progresso (nome, letras, recompensas, histórico)');
    ok(copia.ajustes.itensPorRodada === 4 && copia.ajustes.letrasRevisao === 1 && copia.ajustes.tracadoNaLicao === false && typeof copia.ajustes.legendas === 'boolean', 'contém os ajustes', JSON.stringify(copia.ajustes));
    ok(copia.gravacoes.length === 2 && copia.gravacoes.every((g) => /^audio\//.test(g.mime) && Buffer.from(g.base64, 'base64').subarray(0, 4).toString() === 'RIFF'), 'contém as 2 gravações em base64 (WAV)', copia.gravacoes.map((g) => g.id + ' ' + g.mime).join(','));
    ok(!/https?:/.test(readFileSync(ARQ, 'utf8')), 'o arquivo não tem endereços externos');
    await esperarAte(async () => !/ainda não feita/.test(await page.locator('#ultima-copia').innerText()), { msg: 'última cópia' });
    ok(/Cópia preparada para download/.test(await msg(page)), 'mensagem de cópia preparada');
    await page.screenshot({ path: FOTOS + '/painel-backup-exportado.png' });
    limpo(app.coleta, 'exportar');
    await ctx.close();
  }

  console.log('\n# 4. Importar restaura tudo após confirmação');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente({ nome: 'Outra', liberadas: ['a'], hist: {}, rec: { estrela: 9, concha: 0, chifre: 0 } }) });
    const { page } = app;
    await entrarPainel(page);
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_p"]');
    await gravarSom(page, 'som_p');
    ok(JSON.stringify(await idsVoz(page)) === '["som_p"]', 'estado inicial: 1 gravação diferente');
    await aba(page, 'backup');
    await page.setInputFiles('#arquivo-copia', ARQ);
    await page.waitForSelector('#modal-pais');
    const texto = await page.locator('#modal-pais').innerText();
    ok(/Restaurar esta cópia\?/.test(texto) && /2 sessões/.test(texto) && /3 letras liberadas/.test(texto) && /2 gravações/.test(texto) && /serão substituídos/.test(texto), 'a confirmação resume a cópia', texto);
    await page.screenshot({ path: FOTOS + '/painel-confirmar-importacao.png' });
    ok((await nomeAtual(page)) === 'Outra', 'antes de confirmar nada mudou');
    await tocar(page, 'button[data-acao="modal-cancelar"]');
    await dormir(200);
    ok(await page.locator('#modal-pais').count() === 0 && (await nomeAtual(page)) === 'Outra' && JSON.stringify(await idsVoz(page)) === '["som_p"]', 'Cancelar não muda nada');
    await page.setInputFiles('#arquivo-copia', ARQ);
    await page.waitForSelector('#modal-pais');
    await tocar(page, 'button[data-acao="modal-ok"]');
    await esperarAte(async () => /Cópia restaurada/.test(await msg(page)), { msg: 'mensagem de restauração' });
    const s = await ls(page);
    ok(s.nome === 'Lia' && s.liberadas.length === 3 && s.rec.estrela === 3 && s.hist.a.length === 6, 'progresso restaurado');
    ok(s.ajustes.itensPorRodada === 4 && s.ajustes.letrasRevisao === 1 && s.ajustes.tracadoNaLicao === false, 'ajustes restaurados', JSON.stringify(s.ajustes));
    ok(JSON.stringify(await idsVoz(page)) === JSON.stringify(['som_a', 'som_m']), 'gravações restauradas (as de antes foram substituídas)');
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_m"].gravado');
    ok(/2 de \d+ sons com a sua voz/.test(await page.locator('#gv-resumo-total').innerText()), 'a aba Sua voz mostra as gravações restauradas');
    await aba(page, 'ajustes');
    ok((await page.locator('#valor-itens').innerText()) === '4', 'o painel mostra os ajustes restaurados');
    limpo(app.coleta, 'importar');
    await ctx.close();
  }

  console.log('\n# 5. Arquivo inválido não muda nada e mostra mensagem clara');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente({ nome: 'Fica' }) });
    const { page } = app;
    await entrarPainel(page);
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_u"]');
    await gravarSom(page, 'som_u');
    await aba(page, 'backup');
    const antes = await estavel(page);
    const idsAntes = JSON.stringify(await idsVoz(page));
    const bom = JSON.parse(readFileSync(ARQ, 'utf8'));
    const casos = {
      'nao-json': 'isto não é json {{{',
      'outro-app': JSON.stringify({ app: 'outro', versao: 1 }),
      'versao-futura': JSON.stringify({ ...bom, versao: 99 }),
      'letra-desconhecida': JSON.stringify({ ...bom, progresso: { ...bom.progresso, liberadas: ['a', 'zzz'] } }),
      'numero-ruim': JSON.stringify({ ...bom, progresso: { ...bom.progresso, tempoTotal: -5 } }),
      'ajuste-fora-do-limite': JSON.stringify({ ...bom, ajustes: { ...bom.ajustes, itensPorRodada: 99 } }),
      'gravacao-danificada': JSON.stringify({ ...bom, gravacoes: [{ ...bom.gravacoes[0], base64: '@@@@' }] }),
      'gravacao-id-ruim': JSON.stringify({ ...bom, gravacoes: [{ ...bom.gravacoes[0], id: '../x' }] }),
      'sem-gravacoes': JSON.stringify({ app: bom.app, versao: 1, criadoEm: bom.criadoEm, progresso: bom.progresso, ajustes: bom.ajustes }),
    };
    for (const [nome, conteudo] of Object.entries(casos)) {
      const f = `/tmp/claude-0/j/invalido-${nome}.json`;
      writeFileSync(f, conteudo);
      await page.setInputFiles('#arquivo-copia', f);
      await esperarAte(async () => /Nada foi alterado/.test(await msg(page)), { msg: 'mensagem para ' + nome });
      const m = await msg(page);
      ok(await page.locator('#modal-pais').count() === 0, `${nome}: não abre confirmação`);
      ok((await estavel(page)) === antes && JSON.stringify(await idsVoz(page)) === idsAntes, `${nome}: progresso e gravações intactos`);
      ok(m.length > 25 && !/undefined|\[object|SyntaxError|TypeError/.test(m), `${nome}: mensagem clara`, m);
      if (nome === 'nao-json') await page.screenshot({ path: FOTOS + '/painel-arquivo-invalido.png' });
    }
    ok(await page.locator('#modal-pais').count() === 0, 'nenhuma confirmação ficou aberta');
    limpo(app.coleta, 'arquivo inválido');
    await ctx.close();
  }

  console.log('\n# 6. Restauração atômica: se falhar no meio, nada muda');
  {
    const ctx = await novoCtx();
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente({ nome: 'Intacto', liberadas: ['a', 'e'] }) });
    const { page } = app;
    await entrarPainel(page);
    await aba(page, 'voz');
    await page.waitForSelector('.gv-item[data-id="som_t"]');
    await gravarSom(page, 'som_t');
    await aba(page, 'backup');
    const antes = await estavel(page);
    ok(JSON.stringify(await idsVoz(page)) === '["som_t"]', 'estado inicial com 1 gravação');
    // simula falha ao gravar no IndexedDB durante a restauração
    await page.evaluate(() => {
      const orig = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { if (window.__falhar) throw new DOMException('cheio', 'QuotaExceededError'); return orig.apply(this, arguments); };
      window.__falhar = true;
    });
    await page.setInputFiles('#arquivo-copia', ARQ);
    await page.waitForSelector('#modal-pais');
    await tocar(page, 'button[data-acao="modal-ok"]');
    await esperarAte(async () => /Nada foi alterado/.test(await msg(page)), { msg: 'mensagem de falha' });
    await page.evaluate(() => { window.__falhar = false; });
    ok((await estavel(page)) === antes, 'falha na restauração: o progresso voltou exatamente ao que era');
    ok(JSON.stringify(await idsVoz(page)) === '["som_t"]', 'falha na restauração: as gravações antigas continuam');
    ok(/Restaurar|restaurar/.test(await msg(page)) && await page.locator('#modal-pais').count() === 0, 'mensagem clara e diálogo fechado', await msg(page));
    // e depois, sem falha, funciona
    await page.setInputFiles('#arquivo-copia', ARQ);
    await page.waitForSelector('#modal-pais');
    await tocar(page, 'button[data-acao="modal-ok"]');
    await esperarAte(async () => /Cópia restaurada/.test(await msg(page)), { msg: 'restaura depois' });
    ok((await nomeAtual(page)) === 'Lia', 'sem a falha, a mesma cópia restaura normalmente');
    await ctx.close();
  }

  // ================================================================ 7. atualização controlada
  console.log('\n# 7. Atualização: "Nova versão disponível" e botão Atualizar');
  {
    swNovo = false;
    const ctx = await novoCtx({ serviceWorkers: 'allow' });
    const app = await abrirApp(browser, base, { contexto: ctx, rapido: true, seed: semente({ nome: 'Fica' }) });
    const { page } = app;
    await page.evaluate(() => navigator.serviceWorker.ready);
    await esperarAte(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000, msg: 'página controlada pelo SW' });
    const versaoNo = (p) => p.evaluate(() => new Promise((res) => {
      const c = navigator.serviceWorker.controller; if (!c) return res(null);
      const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data && e.data.versao); c.postMessage({ tipo: 'VERSAO' }, [ch.port2]);
    }));
    const v1 = await versaoNo(page);
    ok(/^trilha-sons-[0-9a-f]{10}$/.test(v1 || ''), 'versão instalada lida do service worker', String(v1));
    await entrarPainel(page);
    await dormir(500);
    ok(await page.locator('#aviso-atualizacao').isHidden() && await page.locator('button[data-acao="atualizar"]').isHidden(), 'sem versão nova: nada de aviso nem botão Atualizar');
    ok(/versão mais recente/.test(await page.locator('#estado-versao').innerText()), 'estado "versão mais recente"');
    // o servidor passa a oferecer outro sw.js (outro nome de cache) = nova versão publicada
    swNovo = true;
    await tocar(page, 'button[aria-label="Verificar nova versão"]');
    await page.waitForSelector('#aviso-atualizacao', { state: 'visible', timeout: 20000 });
    ok(/Nova versão disponível/.test(await page.locator('#aviso-atualizacao').innerText()), 'o painel mostra "Nova versão disponível"');
    await page.screenshot({ path: FOTOS + '/painel-nova-versao.png' });
    const espera = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!r.waiting, ativo: !!r.active }; });
    ok(espera.waiting && espera.ativo, 'a versão nova ficou ESPERANDO (sem skipWaiting automático)');
    await dormir(1500);
    ok((await versaoNo(page)) === v1, 'enquanto a adulta não toca em Atualizar, a versão em uso continua a mesma');
    ok(/Nova versão disponível/.test(await page.locator('#estado-versao').innerText()) && await page.locator('button[data-acao="atualizar"]').isVisible(), 'o cartão da versão também oferece Atualizar');
    const progAntes = JSON.stringify(await ls(page));
    // Atualizar: ativa a versão nova e recarrega
    await Promise.all([page.waitForEvent('load', { timeout: 20000 }), tocar(page, 'button[data-acao="atualizar-topo"]')]);
    await page.waitForSelector('#app > *');
    await esperarAte(() => page.evaluate(() => !!navigator.serviceWorker.controller), { msg: 'controlada de novo' });
    const v2 = await esperarAte(async () => { const v = await versaoNo(page); return v && v !== v1 ? v : null; }, { timeout: 15000, msg: 'versão nova ativa' });
    ok(v2 === 'trilha-sons-versao-nova-teste', 'depois de Atualizar a versão nova está ativa', String(v2));
    const sem = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!r.waiting }; });
    ok(!sem.waiting, 'nenhuma versão fica esperando depois de atualizar');
    ok(JSON.stringify(await ls(page)).includes('"nome":"Fica"') && (await ls(page)).liberadas.length === JSON.parse(progAntes).liberadas.length, 'o progresso continua intacto depois de atualizar');
    await entrarPainel(page);
    ok(await page.locator('#aviso-atualizacao').isHidden(), 'depois de atualizar o aviso some');
    limpo(app.coleta, 'atualização');
    await ctx.close();
    swNovo = false;
  }
} finally {
  await browser.close();
  servidor.close();
}
process.exit(R.fim() ? 1 : 0);
