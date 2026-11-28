// Nome e som da letra: a apresentação diz o NOME e depois o SOM; os jogos de ouvir e juntar só usam o SOM.
// Uso: node tests/k-nome-som.test.mjs
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, tocar, esperarTela, esperarAte, dormir, curriculo,
} from './e-lib.mjs';

const R = criarRelator('K nome e som');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
const ORDEM = curriculo.ordem;
const NOME = (l) => curriculo.letras[l].nome;

const dominada = () => Array.from({ length: 6 }, (_, i) => ({ jogo: ['escute', 'caca', 'trace'][i % 3], ok: true, sessao: 1, t: Date.now() - 1000 * (6 - i) }));
function semente(extra = {}) {
  const lib = ORDEM.slice(0, 6); // a e i o u m
  return {
    v: 1, nome: 'Bia', guia: 'lumi', liberadas: lib, hist: Object.fromEntries(lib.slice(0, 5).map((l) => [l, dominada()])),
    rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 0, sessoes: 1, sessaoId: 1, ultima: Date.now(), ...extra,
  };
}
async function marcarFalas(page) {
  await page.evaluate(() => {
    window.__fala = [];
    window.addEventListener('trilha:fala', (e) => {
      const L = document.getElementById('legenda');
      window.__fala.push({ d: e.detail, html: L ? L.innerHTML : '', texto: L ? [...L.children].map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim() : '' });
    });
  });
}
const lerFalas = (page) => page.evaluate(() => window.__fala.slice());
/** Ids na ordem em que foram ouvidos: arquivo (nome_m, som_m...) ou fala do aparelho com o id que a pediu. */
function ids(bruto) {
  const out = [];
  for (const x of bruto) {
    if (x.k === 'audio') { const m = /\/([a-z0-9_]+)\.(mp3|m4a)/.exec(x.url); out.push(m ? m[1] : x.url); }
    else if (x.k === 'fala') out.push(x.idvoz || 'fala:' + x.texto);
  }
  return out;
}
async function entrarPais(page) {
  await tocar(page, 'button[aria-label="Área dos pais"]');
  await page.waitForSelector('.conta');
  const t = await page.locator('.conta').innerText();
  const [, x, y] = t.match(/(\d+)\s*\+\s*(\d+)/);
  await tocar(page, `button[aria-label="Resposta ${+x + +y}"]`);
  await page.waitForSelector('.abas');
}
const coletas = [];

try {
  // ---------------------------------------------------------------- trilha e lição
  console.log('\n# Trilha: tocar numa parada diz o nome e depois o som');
  const app = await abrirApp(browser, srv.base, { rapido: true, seed: semente() });
  coletas.push(app.coleta);
  const { page, esp } = app;
  await esperarTela(page, 'inicio');
  await marcarFalas(page);
  await tocar(page, 'button[aria-label="Começar"]');
  await esperarTela(page, 'trilha');
  await esperarAte(async () => ids(await esp.bruto()).includes('frase_trilha_instrucao'), { timeout: 10000, msg: 'instrução da trilha' });
  await dormir(300);
  let m = await esp.tamanho();
  await page.evaluate(() => { window.__fala.length = 0; });
  const L = (await page.locator('.parada:not(.foco) .letra').first().innerText()).toLowerCase(); // uma parada antiga (O)
  await tocar(page, '.parada:not(.foco)'); // um toque abre a lição da letra antiga, que diz nome e som
  await esperarTela(page, 'apresenta');
  await esperarAte(async () => ids((await esp.bruto()).slice(m)).filter((x) => x === 'som_' + L).length >= 2, { timeout: 8000, msg: 'nome e som da parada' });
  const sq = ids((await esp.bruto()).slice(m));
  ok(JSON.stringify(sq.slice(0, 4)) === JSON.stringify(['frase_ouca_nome_som', 'nome_' + L, 'som_' + L, 'som_' + L]), 'parada antiga: a lição diz nome e depois som da letra (nessa ordem)', JSON.stringify(sq));
  const fT = await lerFalas(page);
  const nT = fT.find((x) => x.d.tipo === 'nome');
  const sT = fT.find((x) => x.d.tipo === 'som');
  ok(!!nT && nT.d.texto === NOME(L) && nT.texto === `nome: ${NOME(L)}`, `legenda do nome: "nome: ${NOME(L)}"`, JSON.stringify(nT));
  ok(!!sT && sT.d.texto === L.toUpperCase() && sT.texto === `nome: ${NOME(L)} · som: ${L.toUpperCase()}`, 'legenda do som: dupla "nome: ... · som: LETRA"', JSON.stringify(sT));
  ok(fT.indexOf(nT) < fT.indexOf(sT), 'legenda: o nome vem antes do som');
  ok(/legenda-icone/.test(sT.html), 'legenda do som mantém o alto-falante');

  await tocar(page, 'button[aria-label="Voltar para a trilha"]'); await esperarTela(page, 'trilha'); await dormir(300);
  console.log('\n# Lição: apresentação fala ouca_nome_som, nome, som, som');
  m = await esp.tamanho();
  await page.evaluate(() => { window.__fala.length = 0; });
  await tocar(page, '.parada.foco');
  await esperarTela(page, 'apresenta');
  await esperarAte(async () => ids((await esp.bruto()).slice(m)).includes('pal_mapa'), { timeout: 12000, msg: 'fim da apresentação' });
  const seq = ids((await esp.bruto()).slice(m));
  ok(JSON.stringify(seq.slice(0, 4)) === JSON.stringify(['frase_ouca_nome_som', 'nome_m', 'som_m', 'som_m']), 'apresentação: ouca_nome_som, nome_m, som_m, som_m na ordem', JSON.stringify(seq));
  ok(JSON.stringify(seq.slice(4)) === JSON.stringify(['frase_como_no_comeco', 'pal_mapa']), 'depois vem a palavra-âncora', JSON.stringify(seq.slice(4)));
  ok(!seq.includes('frase_apresentar_letra') && !seq.includes('frase_repita_comigo'), 'as frases antigas da apresentação saíram');
  const fL = await lerFalas(page);
  const tiposL = fL.filter((x) => x.d.tipo === 'nome' || x.d.tipo === 'som').map((x) => x.d.tipo);
  ok(tiposL.join(',') === 'nome,som,som', 'legenda da lição: nome, som, som', tiposL.join(','));
  const nL = fL.find((x) => x.d.tipo === 'nome');
  ok(nL.texto === `nome: ${NOME('m')}`, `lição: legenda "nome: ${NOME('m')}"`, nL.texto);
  ok(fL.filter((x) => x.d.tipo === 'som').every((x) => x.texto === `nome: ${NOME('m')} · som: M`), 'lição: legenda do som mostra a dupla "nome: ... · som: M"', JSON.stringify(fL.filter((x) => x.d.tipo === 'som').map((x) => x.texto)));
  // rótulos visíveis para a adulta
  const rot = await page.evaluate(() => ['.balao-nome', '.balao-som'].map((s) => { const e = document.querySelector(s); return e ? { t: e.textContent, i: e.getAttribute('data-i'), vis: e.getBoundingClientRect().width > 0 } : null; }));
  ok(rot[0] && rot[0].t === 'nome' && rot[0].vis && rot[0].i === 'rotulo' && rot[1] && rot[1].t === 'som' && rot[1].vis, 'lição: rótulos visíveis "nome" e "som" (para a adulta)', JSON.stringify(rot));
  // balõezinhos acendem: durante o som o "som" fica aceso
  m = await esp.tamanho();
  await page.evaluate(() => { window.__acesos = []; window.addEventListener('trilha:fala', () => window.__acesos.push([document.querySelector('.balao-nome').classList.contains('aceso'), document.querySelector('.balao-som').classList.contains('aceso')])); });
  await tocar(page, '.letra-gigante');
  await esperarAte(async () => ids((await esp.bruto()).slice(m)).filter((x) => x === 'som_m').length >= 2, { timeout: 8000, msg: 'toque na letra gigante' });
  ok(JSON.stringify(ids((await esp.bruto()).slice(m))) === JSON.stringify(['nome_m', 'som_m', 'som_m']), 'tocar na letra gigante repete nome e som', JSON.stringify(ids((await esp.bruto()).slice(m))));
  const ac = await page.evaluate(() => window.__acesos);
  ok(ac.some((a) => a[0] && !a[1]) && ac.some((a) => !a[0] && a[1]), 'os balões "nome" e "som" acendem na vez de cada um', JSON.stringify(ac));
  ok(await page.locator('.letra-gigante').getAttribute('aria-label') === 'Ouvir o nome e o som da letra', 'aria-label da letra gigante fala em nome e som');

  // ---------------------------------------------------------------- jogos de ouvir e juntar: só som
  console.log('\n# Escute e Toque, Caça-Som e Junte os Sons nunca chamam nome');
  const app2 = await abrirApp(browser, srv.base, { rapido: true, seed: semente() });
  coletas.push(app2.coleta);
  const p2 = app2.page;
  await esperarTela(p2, 'inicio');
  await marcarFalas(p2);
  const marca2 = await app2.esp.tamanho();
  await tocar(p2, 'button[aria-label="Começar"]');
  await esperarTela(p2, 'trilha');
  await tocar(p2, 'button[aria-label="Brincadeiras"]');
  await esperarTela(p2, 'menu');
  const J = criarJogador(p2, app2.esp, R, { nome: 'Bia', errar: true });
  for (const [indice, rotulo] of [[0, 'Escute e Toque'], [1, 'Caça-Som'], [2, 'Junte os Sons']]) {
    await tocar(p2, '.btn-jogo', { indice });
    const jogado = await J.jogarRodada();
    await esperarTela(p2, 'recompensa');
    ok(!!jogado, `${rotulo}: rodada jogada (${jogado})`);
    await tocar(p2, 'button[aria-label="Continuar"]');
    await esperarTela(p2, 'menu');
  }
  const idsJogos = ids((await app2.esp.bruto()).slice(marca2));
  ok(idsJogos.filter((x) => x.startsWith('som_')).length >= 10, `os jogos tocaram sons de letra (${idsJogos.filter((x) => x.startsWith('som_')).length})`);
  ok(!idsJogos.some((x) => x.startsWith('nome_')), 'nenhum item nome_* tocado nos três jogos', idsJogos.filter((x) => x.startsWith('nome_')).join(','));
  const legJogos = await lerFalas(p2);
  ok(!legJogos.some((x) => x.d.tipo === 'nome'), 'nenhum evento de legenda do tipo "nome" nos três jogos');
  ok(legJogos.every((x) => !/nome:/.test(x.texto)), 'a legenda dos jogos nunca mostra "nome:"');

  // ---------------------------------------------------------------- nome:h sem currículo
  console.log('\n# nome: funciona para as 26 letras, mesmo sem currículo');
  const app3 = await abrirApp(browser, srv.base, { rapido: true });
  coletas.push(app3.coleta);
  const p3 = app3.page;
  await esperarTela(p3, 'inicio');
  const r3 = await p3.evaluate(async () => {
    const a = await import('./js/audio.js');
    a.configurar({ curriculo: null, frases: {}, obterNome: () => '' });
    const ev = [];
    const f = (e) => { if (e.detail && e.detail.tipo === 'nome') ev.push(e.detail.texto); };
    window.addEventListener('trilha:fala', f);
    const r = await a.falar(['nome:h', 'nome:k', 'nome:q', 'nome:w', 'nome:x', 'nome:y']);
    const todas = [];
    for (const l of 'abcdefghijklmnopqrstuvwxyz') todas.push((await a.falar([`nome:${l}`])).cancelado);
    window.removeEventListener('trilha:fala', f);
    return { r, ev, todas };
  });
  ok(r3.r.cancelado === false && r3.ev.slice(0, 6).join(',') === 'agá,cá,quê,dáblio,xis,ípsilon', "'nome:h k q w x y' funcionam sem currículo", JSON.stringify(r3.ev));
  ok(r3.todas.length === 26 && r3.todas.every((c) => c === false), "'nome:' resolve para as 26 letras sem currículo");
  const falasN = (await app3.esp.bruto()).filter((x) => x.k === 'fala' && x.idvoz && x.idvoz.startsWith('nome_'));
  ok(falasN.some((x) => x.texto === 'agá' && x.idvoz === 'nome_h'), 'sem arquivo, o nome de H sai pela voz do aparelho (agá) com id nome_h', JSON.stringify(falasN.slice(0, 3)));

  // ---------------------------------------------------------------- gravar
  console.log('\n# Gravar minha voz: grupo "Nomes das letras"');
  const app4 = await abrirApp(browser, srv.base, { rapido: true, seed: semente() });
  coletas.push(app4.coleta);
  const p4 = app4.page;
  await esperarTela(p4, 'inicio');
  await entrarPais(p4);
  await tocar(p4, 'button.aba[data-aba="voz"]');
  await p4.waitForSelector('details.gv-grupo[data-grupo="nomes"]');
  ok((await p4.locator('details.gv-grupo[data-grupo="nomes"] .gv-titulo').innerText()) === 'Nomes das letras', 'existe o grupo "Nomes das letras"');
  await tocar(p4, 'details[data-grupo="nomes"] > summary');
  await p4.waitForSelector('.gv-item[data-id="nome_b"]');
  ok((await p4.locator('.gv-item[data-id="nome_b"] .gv-dica').innerText()) === `Diga o NOME da letra: ${NOME('b')}`, 'texto "Diga o NOME da letra: bê"');
  ok((await p4.locator('details[data-grupo="nomes"] .gv-item').count()) === ORDEM.length + 6, 'uma linha de nome por letra (currículo + h k q w x y)');
  // ouvir como está hoje toca o nome (arquivo ou voz do aparelho), nunca o som
  const m4 = await app4.esp.tamanho();
  await tocar(p4, '.gv-item[data-id="nome_b"] button[data-acao="hoje"]');
  await esperarAte(async () => ids((await app4.esp.bruto()).slice(m4)).length > 0, { timeout: 6000, msg: 'ouvir nome_b' });
  ok(JSON.stringify(ids((await app4.esp.bruto()).slice(m4))) === JSON.stringify(['nome_b']), '"Ouvir como está hoje" no nome toca nome_b', JSON.stringify(ids((await app4.esp.bruto()).slice(m4))));

  // ---------------------------------------------------------------- console limpo
  console.log('\n# Console limpo');
  const todos = coletas.flatMap((c) => c.erros);
  ok(todos.length === 0, 'nenhum console.error', todos.join('\n'));
  ok(coletas.every((c) => c.avisos.length === 0), 'nenhum console.warn', coletas.flatMap((c) => c.avisos).join('\n'));
  ok(coletas.every((c) => c.pageerrors.length === 0), 'nenhum pageerror', coletas.flatMap((c) => c.pageerrors).join('\n'));
  ok(coletas.every((c) => c.requisicoesExternas.length === 0), 'nenhuma requisição para fora da origem');
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
