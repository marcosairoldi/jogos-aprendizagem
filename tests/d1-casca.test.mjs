// Testes da casca do app (D1) com Playwright. Uso: node tests/d1-casca.test.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(aqui, '..');
const SHOTS = '/tmp/claude-0/d1';
mkdirSync(SHOTS, { recursive: true });

const mockAudio = readFileSync(path.join(aqui, 'd1-audio-mock.js'), 'utf8');
const mockCurr = readFileSync(path.join(aqui, 'd1-mock-curriculo.json'), 'utf8');
const mockJogo = readFileSync(path.join(aqui, 'd1-mock-jogo.js'), 'utf8');

let falhas = 0;
let passou = 0;
const erros = [];
function ok(cond, msg) {
  if (cond) { passou++; console.log('  ok  ', msg); } else { falhas++; console.log('  FALHA', msg); }
}

function portaLivre() {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

const porta = await portaLivre();
const servidor = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: raizProjeto, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${porta}/`;
const browser = await chromium.launch();

/** Abre uma página nova com mocks. opcoes: seed (objeto progresso), semStorage, semVoz, jogoManual, jogosAusentes[] */
async function abrir(opcoes = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(`console.error: ${m.text()}`);
  });
  await page.route('**/js/audio.js', (r) => r.fulfill({ contentType: 'text/javascript', body: mockAudio }));
  await page.route('**/data/curriculo.json', (r) => r.fulfill({ contentType: 'application/json', body: mockCurr }));
  for (const id of ['escute', 'caca', 'junte', 'trace']) {
    await page.route(`**/js/jogos/${id}.js`, (r) => {
      if ((opcoes.jogosAusentes || []).includes(id)) return r.fulfill({ status: 404, body: 'nao existe' });
      return r.fulfill({ contentType: 'text/javascript', body: mockJogo.replace("id: 'mock'", `id: '${id}'`) });
    });
  }
  await page.addInitScript((o) => {
    if (o.semStorage) {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } });
    } else if (o.seed && !sessionStorage.getItem('__semeado')) {
      localStorage.setItem('trilhaSons.v1', JSON.stringify(o.seed));
      sessionStorage.setItem('__semeado', '1');
    }
    if (o.semVoz) window.__semVoz = true;
    if (o.jogoManual) window.__jogoManual = true;
  }, { seed: opcoes.seed, semStorage: opcoes.semStorage, semVoz: opcoes.semVoz, jogoManual: opcoes.jogoManual });
  await page.goto(base);
  await page.waitForSelector('.tela');
  return { page, ctx };
}

const falasDe = (page) => page.evaluate(() => window.__audio.chamadas.filter((c) => c.tipo === 'falar').map((c) => c.itens));
const progressoSalvo = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1') || 'null'));
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth);
const foto = (page, nome) => page.screenshot({ path: `${SHOTS}/${nome}.png` });

/** Todos os botões visíveis: >= 64x64 e a >= 16 px das bordas (a borda inferior só fora da área dos pais). */
async function conferirBotoes(page, rotulo, { baixo = true } = {}) {
  const ruins = await page.evaluate((conferirBaixo) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const lista = [];
    for (const e of document.querySelectorAll('button, input')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const problemas = [];
      if (r.width < 63.5 || r.height < 63.5) problemas.push(`tamanho ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
      if (r.left < 15.5 || r.right > w - 15.5 || r.top < 15.5 || (conferirBaixo && r.bottom > h - 15.5)) problemas.push(`borda ${JSON.stringify([r.left, r.top, w - r.right, h - r.bottom].map(Math.round))}`);
      if (!e.getAttribute('aria-label')) problemas.push('sem aria-label');
      if (problemas.length) lista.push(`${e.getAttribute('aria-label') || e.className}: ${problemas.join(', ')}`);
    }
    return lista;
  }, baixo);
  ok(ruins.length === 0, `botões ok em ${rotulo}${ruins.length ? ' -> ' + ruins.join(' | ') : ''}`);
}

const clicar = (page, rotulo) => page.click(`button[aria-label="${rotulo}"]`);
async function clicarContinuar(page) {
  await page.waitForSelector('button[aria-label="Continuar"]:not([disabled])');
  await page.waitForTimeout(80);
  await clicar(page, 'Continuar');
}
const agora = Date.now();
const semente = (extra = {}) => ({
  v: 1, nome: '', guia: 'lumi', liberadas: ['a'], hist: {}, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 },
  tempoTotal: 0, tempoSessao: 0, sessoes: 1, sessaoId: 1, ultima: agora, ...extra,
});

// ---------------------------------------------------------------------------
console.log('\n[1] tela inicial, Começar, escolha do guia');
{
  const { page, ctx } = await abrir();
  ok(await semRolagem(page), 'tela inicial sem rolagem');
  ok((await page.getAttribute('html', 'lang')) === 'pt-BR', 'lang pt-BR');
  await conferirBotoes(page, 'inicio');
  const caixa = await page.locator('button[aria-label="Começar"]').boundingBox();
  ok(caixa.width >= 120 && caixa.height >= 120, `botão Começar grande (${caixa.width}x${caixa.height})`);
  await foto(page, 'inicio');
  await clicar(page, 'Começar');
  await page.waitForSelector('.btn-guia');
  const desb = await page.evaluate(() => window.__audio.desbloqueios);
  ok(desb === 1, 'Começar chama audio.desbloquear');
  let falas = await falasDe(page);
  ok(falas.some((f) => f.includes('frase:boas_vindas')), 'fala boas_vindas');
  ok(falas.some((f) => f.includes('frase:escolher_guia')), 'fala escolher_guia');
  ok(await semRolagem(page), 'escolha do guia sem rolagem');
  await conferirBotoes(page, 'guia');
  await foto(page, 'guia');
  await clicar(page, 'Escolher a sereia');
  await page.waitForSelector('.parada.foco');
  ok((await progressoSalvo(page)).guia === 'marola', 'guia escolhido (marola) salvo');
  falas = await falasDe(page);
  ok(falas.some((f) => f.includes('frase:guia_marola')), 'fala guia_marola');
  await ctx.close();
}

console.log('\n[2] trilha, lição, sequência de jogos, recompensas, persistência');
{
  const { page, ctx } = await abrir({ seed: semente({ guia: 'marola' }) });
  await clicar(page, 'Começar');
  await page.waitForSelector('.parada.foco');
  ok(await semRolagem(page), 'trilha sem rolagem');
  ok((await page.textContent('.parada.foco .letra')) === 'A', 'parada foco mostra A');
  ok((await page.locator('.parada').count()) === 1 && (await page.locator('.futura').count()) === 5, '1 parada liberada e 5 nuvens');
  await conferirBotoes(page, 'trilha');
  await foto(page, 'trilha');
  let falas = await falasDe(page);
  ok(falas.some((f) => f.includes('frase:trilha_instrucao')), 'trilha fala instrução');
  await page.click('.parada.foco');
  await page.waitForSelector('.letra-gigante');
  ok((await page.textContent('.letra-gigante')) === 'A', 'lição mostra a letra A gigante');
  falas = await falasDe(page);
  const esperado = ['frase:apresentar_letra', 'som:a', 'pausa:400', 'frase:repita_comigo', 'som:a', 'pausa:600', 'frase:como_no_comeco', 'pal:abelha'];
  ok(falas.some((f) => JSON.stringify(f) === JSON.stringify(esperado)), 'fala da apresentação exatamente como no contrato');
  ok(await semRolagem(page), 'apresentação sem rolagem');
  await conferirBotoes(page, 'apresentação');
  await foto(page, 'licao');
  await clicar(page, 'Continuar');
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.premio');
    if (i === 0) { ok(await semRolagem(page), 'recompensa sem rolagem'); await conferirBotoes(page, 'recompensa'); await foto(page, 'recompensa'); }
    await clicarContinuar(page);
  }
  await page.waitForFunction(() => window.__audio.chamadas.some((c) => c.tipo === 'falar' && c.itens.includes('frase:recompensa_concha')));
  falas = await falasDe(page);
  ok(falas.filter((f) => f.includes('frase:recompensa_estrela')).length === 3, '3 estrelas entre os jogos');
  ok(falas.some((f) => f.includes('frase:recompensa_concha')), 'concha no fim (guia Marola)');
  ok(await page.evaluate(() => window.__jogos.length) === 4, 'rodou os 4 jogos em sequência');
  const ctxJogo = await page.evaluate(() => window.__jogos[0]);
  ok(ctxJogo.letras[0] === 'a' && ctxJogo.letraFoco === 'a' && ctxJogo.guia === 'marola' && ctxJogo.liberadas.length === 1, 'ctx do jogo com letras, foco, guia e liberadas');
  await clicarContinuar(page);
  await page.waitForSelector('.parada.foco');
  ok(true, 'voltou à trilha após a lição');
  const salvo = await progressoSalvo(page);
  ok(salvo.rec.estrela === 3 && salvo.rec.concha === 1 && salvo.hist.a.length === 4, 'recompensas e histórico gravados');
  await page.reload();
  await page.waitForSelector('.tela');
  const salvo2 = await progressoSalvo(page);
  ok(salvo2.rec.estrela === 3 && salvo2.hist.a.length === 4 && salvo2.guia === 'marola', 'progresso persiste após recarregar');
  await ctx.close();
}

console.log('\n[3] avanço por domínio libera nova letra');
{
  const velho = [{ jogo: 'escute', ok: true, sessao: 1, t: 1 }, { jogo: 'caca', ok: true, sessao: 1, t: 2 }];
  const { page, ctx } = await abrir({ seed: semente({ guia: 'lumi', sessoes: 2, sessaoId: 2, hist: { a: velho } }) });
  await clicar(page, 'Começar');
  await page.click('.parada.foco');
  await clicar(page, 'Continuar');
  for (let i = 0; i < 3; i++) await clicarContinuar(page);
  await page.waitForFunction(() => window.__audio.chamadas.some((c) => c.tipo === 'falar' && c.itens.includes('frase:recompensa_chifre')));
  const falas1 = await falasDe(page);
  ok(falas1.some((f) => f.includes('frase:recompensa_chifre')), 'chifre no fim (guia Lumi)');
  await clicarContinuar(page);
  await page.waitForSelector('.parada.foco');
  ok((await page.textContent('.parada.foco .letra')) === 'E', 'nova letra E é o foco da trilha');
  const falas = await falasDe(page);
  ok(falas.some((f) => f.includes('frase:letra_dominada') && f.includes('frase:trilha_nova_letra')), 'fala letra_dominada + trilha_nova_letra');
  ok((await page.locator('.parada').count()) === 2, 'duas paradas liberadas');
  await conferirBotoes(page, 'trilha com 2 letras');
  await foto(page, 'trilha-nova');
  // toque numa parada antiga toca o som; segundo toque abre a lição
  await page.locator('.parada:not(.foco)').click();
  const f2 = await falasDe(page);
  ok(f2.some((f) => f.length === 1 && f[0] === 'som:a'), 'toque numa parada antiga toca o som');
  await page.locator('.parada:not(.foco)').click();
  await page.waitForSelector('.letra-gigante');
  ok((await page.textContent('.letra-gigante')) === 'A', 'segundo toque abre a lição da letra antiga');
  await clicar(page, 'Continuar');
  await page.waitForFunction(() => window.__jogos.length >= 5);
  const j = await page.evaluate(() => window.__jogos[window.__jogos.length - 1]);
  ok(j.letras[0] === 'a' && j.letras.includes('e'), 'lição antiga: foco a e revisão da letra mais nova');
  await ctx.close();
}

console.log('\n[4] menu de jogos, coleção, despedida');
{
  const { page, ctx } = await abrir({ seed: semente({ rec: { estrela: 2, concha: 1, chifre: 1 }, recSessao: { estrela: 2, concha: 1, chifre: 1 }, tempoSessao: 9 * 60000 }) });
  await clicar(page, 'Começar');
  await page.waitForSelector('.parada.foco');
  await clicar(page, 'Minha coleção');
  await page.waitForSelector('.item-colecao');
  ok(await page.locator('.item-colecao').count() === 4, 'coleção mostra 4 itens');
  ok(await semRolagem(page), 'coleção sem rolagem');
  await conferirBotoes(page, 'coleção');
  await foto(page, 'colecao');
  ok((await falasDe(page)).some((f) => f.includes('frase:colecao')), 'fala colecao');
  await clicar(page, 'Voltar para a trilha');
  await clicar(page, 'Brincadeiras');
  await page.waitForSelector('.btn-jogo');
  ok(await page.locator('.btn-jogo').count() === 4, 'menu com 4 jogos');
  ok((await falasDe(page)).some((f) => f.includes('frase:menu_jogos')), 'fala menu_jogos');
  await conferirBotoes(page, 'menu');
  await foto(page, 'menu');
  await clicar(page, 'Escute e toque');
  await page.waitForSelector('.premio');
  await clicarContinuar(page);
  // sessão passou de 8 minutos: despedida ao fim da rodada
  await page.waitForSelector('button[aria-label="Ir para o início"]');
  ok((await falasDe(page)).some((f) => f.includes('frase:despedida')), 'despedida fala ao fim da rodada');
  ok(await semRolagem(page), 'despedida sem rolagem');
  await conferirBotoes(page, 'despedida');
  await foto(page, 'despedida');
  await clicar(page, 'Continuar brincando');
  await page.waitForSelector('.parada.foco');
  ok(true, 'continuar discreto volta à trilha');
  await clicar(page, 'Brincadeiras');
  await clicar(page, 'Caça-som');
  await page.waitForSelector('.premio');
  await clicarContinuar(page);
  await page.waitForSelector('.btn-jogo');
  ok(true, 'depois de continuar, não repete a despedida logo em seguida');
  await clicar(page, 'Voltar para a trilha');
  await page.waitForSelector('.parada.foco');
  await ctx.close();
}

console.log('\n[5] casa durante o jogo destrói o jogo e para o áudio');
{
  const { page, ctx } = await abrir({ seed: semente(), jogoManual: true });
  await clicar(page, 'Começar');
  await page.click('.parada.foco');
  await clicar(page, 'Continuar');
  await page.waitForSelector('button[aria-label="Terminar jogo falso"]');
  await conferirBotoes(page, 'barra do jogo');
  await clicar(page, 'Voltar para a trilha');
  await page.waitForSelector('.parada.foco');
  ok((await page.evaluate(() => window.__destruidos)) === 1, 'jogo destruído ao voltar');
  const par = await page.evaluate(() => window.__audio.chamadas.filter((c) => c.tipo === 'parar').length);
  ok(par >= 1, 'audio.parar chamado');
  await ctx.close();
}

console.log('\n[6] jogo ausente é pulado sem quebrar');
{
  const { page, ctx } = await abrir({ seed: semente(), jogosAusentes: ['escute'] });
  await clicar(page, 'Começar');
  await page.click('.parada.foco');
  await clicar(page, 'Continuar');
  await page.waitForSelector('.premio');
  ok(await page.evaluate(() => window.__jogos.length) === 1, 'escute pulado; caca rodou primeiro');
  await ctx.close();
}

console.log('\n[7] área dos pais');
{
  const { page, ctx } = await abrir({ seed: semente({ sessoes: 3, tempoTotal: 7 * 60000 }), semVoz: true });
  await clicar(page, 'Área dos pais');
  await page.waitForSelector('.conta');
  ok(await semRolagem(page), 'porta sem rolagem');
  await conferirBotoes(page, 'porta dos pais');
  await foto(page, 'pais-porta');
  const lerConta = async () => {
    const t = await page.textContent('.conta');
    const [x, y] = t.match(/\d+/g).map(Number);
    return x + y;
  };
  let certa = await lerConta();
  const textos = await page.locator('.respostas button').allTextContents();
  ok(textos.length === 3 && textos.includes(String(certa)), '3 respostas incluindo a certa');
  const errada = textos.find((t) => Number(t) !== certa);
  await page.click(`.respostas button:text-is("${errada}")`);
  await page.waitForSelector('.conta');
  ok(await page.locator('#campo-nome').count() === 0, 'resposta errada não entra');
  certa = await lerConta();
  await page.click(`.respostas button:text-is("${certa}")`);
  await page.waitForSelector('#campo-nome');
  await conferirBotoes(page, 'painel dos pais', { baixo: false });
  ok(await page.locator('#aviso-voz').count() === 1, 'aviso de voz pt-BR aparece');
  ok(/7 min/.test(await page.textContent('#resumo-uso')) && /Sessões: 3/.test(await page.textContent('#resumo-uso')), 'tempo total e sessões');
  await page.fill('#campo-nome', 'Flor');
  ok((await progressoSalvo(page)).nome === 'Flor', 'nome salvo no aparelho');
  await foto(page, 'pais-painel');
  await clicar(page, 'Liberar próxima letra');
  ok((await progressoSalvo(page)).liberadas.length === 2, 'liberar próxima letra');
  await clicar(page, 'Reiniciar progresso');
  ok((await progressoSalvo(page)).liberadas.length === 2, 'reiniciar pede segundo toque');
  await page.click('button.perigo');
  await page.waitForSelector('#campo-nome');
  const s = await progressoSalvo(page);
  ok(s.liberadas.length === 1 && s.tempoTotal === 0 && s.rec.estrela === 0, 'reiniciar limpa o progresso');
  ok(s.nome === 'Flor', 'reiniciar mantém o nome');
  await clicar(page, 'Voltar');
  await page.waitForSelector('button[aria-label="Começar"]');
  await clicar(page, 'Começar');
  await page.waitForSelector('.parada.foco');
  const nomeUsado = await page.evaluate(() => window.__audio.config.obterNome());
  ok(nomeUsado === 'Flor', 'obterNome devolve o nome salvo');
  await ctx.close();
}

console.log('\n[8] trocar guia pela área dos pais');
{
  const { page, ctx } = await abrir({ seed: semente({ guia: 'lumi' }) });
  await clicar(page, 'Área dos pais');
  const t = await page.textContent('.conta');
  const [x, y] = t.match(/\d+/g).map(Number);
  await page.click(`.respostas button:text-is("${x + y}")`);
  await clicar(page, 'Trocar guia');
  await page.waitForSelector('.btn-guia');
  await clicar(page, 'Escolher a sereia');
  await page.waitForSelector('button[aria-label="Começar"]');
  ok((await progressoSalvo(page)).guia === 'marola', 'trocou o guia e voltou ao início');
  await ctx.close();
}

console.log('\n[9] localStorage indisponível');
{
  const { page, ctx } = await abrir({ semStorage: true });
  await clicar(page, 'Começar');
  await page.waitForSelector('.btn-guia');
  await clicar(page, 'Escolher a unicórnio');
  await page.waitForSelector('.parada.foco');
  await page.click('.parada.foco');
  await clicar(page, 'Continuar');
  await page.waitForSelector('.premio');
  ok(true, 'app funciona com localStorage lançando exceção');
  await ctx.close();
}

console.log('\n[10] regras de progresso (unidade)');
{
  const { page, ctx } = await abrir({ seed: semente({ liberadas: ['a', 'e', 'i'], hist: {
    a: [{ jogo: 'x', ok: true, sessao: 1, t: 10 }, { jogo: 'y', ok: true, sessao: 1, t: 11 }, { jogo: 'x', ok: true, sessao: 1, t: 12 }, { jogo: 'y', ok: true, sessao: 2, t: 13 }, { jogo: 'x', ok: true, sessao: 2, t: 14 }],
    e: [{ jogo: 'x', ok: false, sessao: 1, t: 500 }],
  } }) });
  const r = await page.evaluate(async () => {
    const p = await import('./js/progresso.js');
    return {
      a: p.estadoLetra('a'), e: p.estadoLetra('e'), i: p.estadoLetra('i'), foco: p.letraFoco(),
      rodada: p.escolherLetrasRodada(5), rodadaE: p.escolherLetrasRodada(5, 'e'),
      regras: p.getRegras().minutosSessao,
    };
  });
  ok(r.a === 'nova' || r.a === 'pratica' || r.a === 'dominada', 'estadoLetra devolve estado válido');
  ok(r.a === 'dominada', 'a dominada (5 acertos, 2 jogos, 2 sessões)');
  ok(r.e === 'nova' && r.i === 'nova', 'letras com poucas tentativas são novas');
  ok(r.foco === 'i', 'foco é a letra liberada mais nova não dominada');
  ok(r.rodada[0] === 'i' && r.rodada.length === 3 && !r.rodada.includes('undefined'), 'rodada: foco + 2 revisões');
  ok(r.rodada[1] === 'a' || r.rodada[1] === 'e', 'revisão usa letras antigas');
  ok(r.rodadaE[0] === 'e', 'foco forçado');
  ok(r.regras === 8, 'regras lidas do currículo');
  await ctx.close();
}

console.log('\n[11] tempo só com a página visível');
{
  const { page, ctx } = await abrir({ seed: semente() });
  await page.waitForTimeout(2600);
  const t1 = (await progressoSalvo(page)).tempoTotal;
  ok(t1 > 1500, `tempo contado com a página visível (${t1} ms)`);
  await ctx.close();
}

console.log('\n[12] sem erros de console/pageerror');
ok(erros.length === 0, `nenhum console.error nem pageerror${erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''}`);

await browser.close();
servidor.kill();
console.log(`\n${passou} verificações ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
