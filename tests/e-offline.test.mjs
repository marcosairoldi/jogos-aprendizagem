// Offline: carrega o app, espera o service worker controlar, desliga a rede, recarrega e joga lições inteiras.
// Uso: node tests/e-offline.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, auditar, tocar, esperarTela, esperarAte, dormir,
  curriculo, raizProjeto,
} from './e-lib.mjs';

const R = criarRelator('E offline');
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();

async function prepararOffline(opcoes) {
  const app = await abrirApp(browser, srv.base, { rapido: true, escala: 0.5, sw: 'allow', ...opcoes });
  const { page, ctx } = app;
  await esperarAte(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))), { timeout: 30000, msg: 'SW ativo' });
  await esperarAte(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000, msg: 'SW controlando' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  // dá tempo para o pré-cache terminar e confere quantos arquivos ficaram guardados
  const lista = await page.evaluate(async () => {
    const nomes = await caches.keys();
    const c = await caches.open(nomes.find((n) => n.startsWith('trilha-sons-')));
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  const sw = readFileSync(path.join(raizProjeto, 'sw.js'), 'utf8');
  const previstos = [...sw.matchAll(/^\s+"([^"]+)",?$/gm)].map((m) => m[1]).filter((x) => x !== './');
  const faltam = previstos.filter((p) => !lista.some((u) => u.endsWith('/' + p)));
  ok(faltam.length === 0, `pré-cache completo (${lista.length} arquivos guardados)`, faltam.slice(0, 10).join(', '));
  await ctx.setOffline(true);
  app.coleta.respostasRuins.length = 0; app.coleta.falhas.length = 0; app.coleta.erros.length = 0; app.coleta.avisos.length = 0;
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#app > *');
  return app;
}

async function sairRecompensa(page) {
  await page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
  await tocar(page, 'button[aria-label="Continuar"]');
  await esperarAte(() => page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000 });
}

try {
  console.log('\n# Lição inteira offline (estado novo, letra A)');
  {
    const app = await prepararOffline({});
    const { page, esp, coleta } = app;
    ok(await page.evaluate(() => navigator.onLine === false), 'navegador está offline');
    await esperarTela(page, 'inicio');
    ok(true, 'tela inicial abre offline (recarregada sem rede)');
    // fonte, figuras, sons, traçados e currículo
    const recursos = await page.evaluate(async (curr) => {
      const urls = ['data/curriculo.json', 'data/frases.json', 'data/tracados.json', 'assets/fontes/andika-latin-400-normal.woff2', 'assets/fontes/andika-latin-700-normal.woff2', 'manifest.json'];
      for (const p of Object.values(curr.palavras)) urls.push(p.figura);
      for (const l of Object.values(curr.letras)) urls.push('assets/audio/gerado/' + l.audio + '.mp3');
      const falhas = [];
      for (const u of urls) { try { const r = await fetch(u); if (!r.ok) falhas.push(u + ' ' + r.status); } catch (e) { falhas.push(u + ' erro'); } }
      await document.fonts.ready;
      const fontes = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight);
      return { total: urls.length, falhas, fontes };
    }, curriculo);
    ok(recursos.falhas.length === 0, `${recursos.total} recursos (figuras, sons, fontes, dados) respondem offline`, recursos.falhas.join('\n'));
    const J = criarJogador(page, esp, R, {});
    await tocar(page, 'button[aria-label="Começar"]');
    await esperarTela(page, 'guia');
    await tocar(page, 'button[aria-label="Escolher a sereia"]');
    await esperarTela(page, 'trilha');
    await tocar(page, '.parada.foco');
    await esperarTela(page, 'apresenta');
    await dormir(300);
    await tocar(page, 'button[aria-label="Continuar"]');
    const jogos = [];
    for (let g = 0; g < 20; g++) {
      const t = await esperarAte(() => page.evaluate(() => (document.querySelector('.raiz-jogo') ? 'jogo' : document.querySelector('.recompensa .premio') ? 'recompensa' : document.querySelector('.trilha-area') ? 'trilha' : null)), { timeout: 60000 });
      if (t === 'trilha') break;
      if (t === 'recompensa') { await dormir(300); await sairRecompensa(page); } else jogos.push(await J.jogarRodada());
    }
    ok(jogos.join(',') === 'escute,caca,trace,junte', 'lição completa offline: ' + jogos.join(', '));
    const fontes = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight); });
    ok(fontes.some((f) => /Andika/.test(f)), 'fonte Andika carregada (do cache) e usada nas letras', JSON.stringify(fontes));
    // figuras realmente carregadas (naturalWidth > 0) em todo o percurso: confere as do caça-som com a página atual
    ok(coleta.falhas.length === 0, 'nenhuma requisição falhou offline', coleta.falhas.join('\n'));
    ok(coleta.respostasRuins.length === 0, 'nenhum 404/5xx offline', coleta.respostasRuins.join('\n'));
    ok(coleta.pageerrors.length === 0 && coleta.erros.length === 0 && coleta.avisos.length === 0, 'sem erros/avisos de console offline', coleta.pageerrors.concat(coleta.erros, coleta.avisos).join('\n'));
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('trilhaSons.v1')));
    ok(salvo.hist.a && salvo.hist.a.length >= 10, 'progresso gravado offline');
    await app.ctx.close();
  }

  console.log('\n# Currículo amplo offline (9 letras: figuras, sílabas e palavras)');
  {
    const lib = curriculo.ordem.slice(0, 9);
    const h = {};
    for (const l of lib) if (l !== 'm') h[l] = Array.from({ length: 6 }, (_, i) => ({ jogo: ['escute', 'caca', 'trace'][i % 3], ok: true, sessao: 1 + (i % 2), t: Date.now() - 1000 * (6 - i) }));
    const seed = { v: 1, nome: '', guia: 'lumi', liberadas: lib, hist: h, rec: { estrela: 0, concha: 0, chifre: 0 }, recSessao: { estrela: 0, concha: 0, chifre: 0 }, tempoTotal: 0, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now() };
    const app = await prepararOffline({ seed });
    const { page, esp, coleta } = app;
    await esperarTela(page, 'inicio');
    await tocar(page, 'button[aria-label="Começar"]');
    await esperarTela(page, 'trilha');
    await tocar(page, 'button[aria-label="Brincadeiras"]');
    const J = criarJogador(page, esp, R, {});
    const feitos = [];
    for (let i = 0; i < 4; i++) {
      await esperarTela(page, 'menu');
      await tocar(page, '.btn-jogo', { indice: i });
      feitos.push(await J.jogarRodada());
      await esperarTela(page, 'recompensa');
      await dormir(300);
      await sairRecompensa(page);
    }
    ok(feitos.join(',') === 'escute,caca,junte,trace', 'os 4 jogos rodam offline: ' + feitos.join(', '));
    // todas as figuras mostradas carregaram de verdade
    const quebradas = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    ok(quebradas.length === 0, 'nenhuma imagem quebrada na tela', quebradas.join(', '));
    // net::ERR_ABORTED = um som interrompido pela fala seguinte (cancelamento normal), não arquivo faltando
    const falhasReais = coleta.falhas.filter((f) => !f.startsWith('net::ERR_ABORTED'));
    ok(falhasReais.length === 0 && coleta.respostasRuins.length === 0, 'sem falhas de rede nem 404 offline', falhasReais.concat(coleta.respostasRuins).join('\n'));
    ok(coleta.pageerrors.length === 0 && coleta.erros.length === 0 && coleta.avisos.length === 0, 'sem erros/avisos de console offline', coleta.pageerrors.concat(coleta.erros, coleta.avisos).join('\n'));
    await app.ctx.close();
  }
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
