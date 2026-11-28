// N: voltar na trilha para treinar letras já concluídas.
// Uso: node tests/n-trilha-voltar.test.mjs   (fotos em /tmp/claude-0/n/)
import { mkdirSync } from 'node:fs';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, auditar, verificarAuditoria,
  tocar, esperarTela, esperarAte, dormir, curriculo, qualTela,
} from './e-lib.mjs';

const SHOTS = '/tmp/claude-0/n';
mkdirSync(SHOTS, { recursive: true });
const R = criarRelator('N trilha voltar', { quieto: true });
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 360, height: 640 }, { width: 412, height: 915 }];
const ORDEM = curriculo.ordem;

function seed() {
  const lib = ORDEM.slice(0, 9); // a e i o u m p b t
  const h = {};
  // as 8 primeiras estão dominadas; a nona (foco) está só começando
  for (const l of lib.slice(0, 8)) h[l] = Array.from({ length: 6 }, (_, i) => ({ jogo: ['escute', 'caca', 'trace'][i % 3], ok: true, sessao: 1, t: Date.now() - 100000 + i }));
  return {
    v: 1, nome: '', guia: 'lumi', liberadas: lib, hist: h, rec: { estrela: 3, concha: 3, chifre: 3 }, recSessao: { estrela: 0, concha: 0, chifre: 0 },
    tempoTotal: 0, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now(), ...{},
  };
}
const estado = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
const letrasVisiveis = (page) => page.evaluate(() => [...document.querySelectorAll('.trilha-pagina:not(.saindo) .parada .letra')].map((x) => x.textContent));
const indicador = (page) => page.evaluate(() => document.getElementById('indicador-trilha').textContent.replace(/\s+/g, ' ').trim());
const visivelBtn = (page, rot) => page.evaluate((r) => { const b = document.querySelector(`button[aria-label="${r}"]`); return !!b && !b.disabled && getComputedStyle(b).visibility !== 'hidden' && b.getBoundingClientRect().width > 0; }, rot);

async function arrastar(page, x, y0, y1) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (yy) => [{ x, y: yy, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y0) });
  const passos = 8;
  for (let i = 1; i <= passos; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y0 + ((y1 - y0) * i) / passos) });
    await dormir(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function auditarTela(page, vp, nome) {
  await dormir(500);
  const a = await auditar(page);
  verificarAuditoria(R, `${vp.width}x${vp.height} ${nome}`, a);
  try { await page.screenshot({ path: `${SHOTS}/${vp.width}x${vp.height}-${nome}.png` }); } catch (e) { /* ok */ }
}

async function jogarLicao(page, J, notas) {
  await tocar(page, 'button[aria-label="Continuar"]');
  for (let g = 0; g < 20; g++) {
    const t = await esperarAte(() => page.evaluate(() => (document.querySelector('.raiz-jogo') ? 'jogo' : document.querySelector('.recompensa .premio') ? 'recompensa' : document.querySelector('.trilha-area') ? 'trilha' : null)), { timeout: 60000 });
    if (t === 'trilha') return t;
    if (t === 'recompensa') {
      notas.push(await page.evaluate(() => document.querySelector('.recompensa').innerText.replace(/\s+/g, ' ')));
      await page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
      await dormir(300);
      await tocar(page, 'button[aria-label="Continuar"]');
      await esperarAte(() => page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000 });
    } else await J.jogarRodada();
  }
  return null;
}

try {
  for (const vp of VIEWPORTS) {
    const rot = `${vp.width}x${vp.height}`;
    console.log(`\n# ${rot}`);
    let app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, escala: 0.25, seed: seed() });
    let { page, esp, coleta } = app;
    await esperarTela(page, 'inicio');
    await tocar(page, 'button[aria-label="Começar"]');
    await esperarTela(page, 'trilha');
    await dormir(400);

    // janela inicial na letra foco
    ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['P', 'B', 'T']), `${rot}: janela inicial mostra P B T`, JSON.stringify(await letrasVisiveis(page)));
    ok(/Letra 9 de 20/.test(await indicador(page)), `${rot}: indicador da letra foco`, await indicador(page));
    ok(await visivelBtn(page, 'Letras anteriores'), `${rot}: botão "Letras anteriores" visível`);
    ok(!(await visivelBtn(page, 'Letra de hoje')), `${rot}: "Letra de hoje" escondido na letra foco`);
    await auditarTela(page, vp, 'trilha-foco');

    // botão: letras anteriores
    await tocar(page, 'button[aria-label="Letras anteriores"]');
    await dormir(500);
    const ant = await letrasVisiveis(page);
    ok(JSON.stringify(ant) === JSON.stringify(['A', 'E', 'I', 'O', 'U', 'M']), `${rot}: página anterior mostra A E I O U M`, JSON.stringify(ant));
    ok((await page.locator('.trilha-pagina:not(.saindo) .parada.dominada .marca-dominada').count()) === 6, `${rot}: estrelinha nas 6 dominadas`);
    ok(/Letras 1 a 6 de 20/.test(await indicador(page)), `${rot}: indicador mostra o intervalo`, await indicador(page));
    ok(!(await visivelBtn(page, 'Letras anteriores')) && (await visivelBtn(page, 'Letra de hoje')), `${rot}: no começo só "Letra de hoje" aparece`);
    await auditarTela(page, vp, 'trilha-anteriores');

    // Letra de hoje volta
    await tocar(page, 'button[aria-label="Letra de hoje"]');
    await dormir(500);
    ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['P', 'B', 'T']) && !(await visivelBtn(page, 'Letra de hoje')), `${rot}: "Letra de hoje" volta à janela da letra foco`);

    // arrastar: dedo para cima = anteriores; dedo para baixo = volta
    const r = await page.evaluate(() => { const b = document.querySelector('.trilha-area').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await arrastar(page, r.x, r.y + 90, r.y - 90);
    await dormir(500);
    ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['A', 'E', 'I', 'O', 'U', 'M']), `${rot}: arrastar para cima mostra as anteriores`, JSON.stringify(await letrasVisiveis(page)));
    await arrastar(page, r.x, r.y - 90, r.y + 90);
    await dormir(500);
    ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['P', 'B', 'T']), `${rot}: arrastar para baixo volta`, JSON.stringify(await letrasVisiveis(page)));
    ok((await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)), `${rot}: a página não rolou`);
    // arrastar começando em cima de uma parada não abre a lição
    const pos = await page.evaluate(() => { const b = document.querySelector('.parada.foco').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await arrastar(page, pos.x, pos.y + 20, pos.y - 90);
    await dormir(500);
    ok((await qualTela(page)) === 'trilha', `${rot}: arrastar sobre uma parada não abre a lição`);
    ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['A', 'E', 'I', 'O', 'U', 'M']), `${rot}: ...e troca a página`);

    // um toque na parada A abre a lição de A, que diz nome e som
    const m = await esp.tamanho();
    await tocar(page, '.trilha-pagina:not(.saindo) .parada >> nth=0');
    await esperarTela(page, 'apresenta');
    ok((await page.textContent('.letra-gigante')) === 'A', `${rot}: um toque na parada A abre a lição de A`);
    await esperarAte(async () => (await esp.eventos(m)).filter((x) => x.id === 'a').length >= 2, { timeout: 8000, msg: 'nome e som' }).catch(() => {});
    const evs = (await esp.eventos(m)).map((x) => x.tipo + ':' + x.id);
    ok(evs.some((x) => /^(audio|som|fala):/.test(x)) && (await esp.bruto()).slice(m).some((x) => /nome_a|som_a/.test(x.url || '')), `${rot}: a lição diz nome e som da letra`, JSON.stringify(evs));
    ok(/Lição da letra A/.test(await page.textContent('#passos-licao')), `${rot}: passo a passo da lição de A`);

    // joga a revisão até o fim (só no primeiro tamanho, para não demorar)
    if (vp.height === 800 && vp.width === 360) {
      // contexto novo (sem os gestos de arrasto de antes) para jogar a lição inteira
      await app.ctx.close();
      app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, escala: 0.25, seed: { ...seed(), ajustes: { itensPorRodada: null, letrasRevisao: null, tracadoNaLicao: false } } });
      ({ page, esp, coleta } = app); globalThis.__pg = page;
      const J = criarJogador(page, esp, R, { errar: false });
      await esperarTela(page, 'inicio');
      await tocar(page, 'button[aria-label="Começar"]');
      await esperarTela(page, 'trilha');
      await tocar(page, 'button[aria-label="Letras anteriores"]');
      await dormir(500);
      await tocar(page, '.trilha-pagina:not(.saindo) .parada >> nth=0');
      await esperarTela(page, 'apresenta');
      const antes = await estado(page);
      const notas = [];
      const fim = await jogarLicao(page, J, notas);
      ok(fim === 'trilha', `${rot}: a lição de revisão termina e volta à trilha`);
      const depois = await estado(page);
      ok(depois.liberadas.length === antes.liberadas.length, `${rot}: revisão não libera letra nova`, depois.liberadas.join(''));
      ok(depois.hist.a.length > antes.hist.a.length, `${rot}: a revisão registrou tentativas de A`);
      ok(notas.some((n) => /Treino da letra A concluído!/.test(n)), `${rot}: frase "Treino da letra A concluído!"`, JSON.stringify(notas));
      await dormir(300);
      ok(JSON.stringify(await letrasVisiveis(page)) === JSON.stringify(['P', 'B', 'T']), `${rot}: depois da revisão a janela volta à letra foco`);
      ok(/Letra 9 de 20/.test(await indicador(page)), `${rot}: a letra foco continua a 9ª`);
      const foco = await page.textContent('.parada.foco .letra');
      ok(foco === 'T', `${rot}: o foco continua T`, foco);
    } else {
      await tocar(page, 'button[aria-label="Voltar para a trilha"]');
      await esperarTela(page, 'trilha');
    }
    await auditarTela(page, vp, 'trilha-final');
    ok(coleta.erros.length === 0 && coleta.pageerrors.length === 0 && coleta.avisos.length === 0, `${rot}: console limpo`, JSON.stringify([coleta.erros, coleta.pageerrors, coleta.avisos]));
    await app.ctx.close();
  }
} catch (e) {
  R.ok(false, 'exceção: ' + e.message, e.stack);
  try { await globalThis.__pg.screenshot({ path: SHOTS + '/erro.png' }); } catch (x) { /* ok */ }
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
