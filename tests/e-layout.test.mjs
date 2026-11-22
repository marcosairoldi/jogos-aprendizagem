// Layout mobile em três tamanhos de tela (360x800, 412x915 e 360x640), todas as telas da criança.
// Confere: sem rolagem, nada fora da tela, alvos >= 64px e >= 12px das bordas, texto só de conteúdo, aria-label.
// Uso: node tests/e-layout.test.mjs   (gera fotos em /tmp/claude-0/e/l-*.png)
import {
  chromium, iniciarServidor, abrirApp, criarRelator, criarJogador, auditar, verificarAuditoria, verificarEstilos,
  tocar, esperarTela, esperarAte, dormir, curriculo, SHOTS,
} from './e-lib.mjs';

const R = criarRelator('E layout mobile', { quieto: true });
const { ok } = R;
const srv = await iniciarServidor();
const browser = await chromium.launch();
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 360, height: 640 }];
const ORDEM = curriculo.ordem;

function seedBase(extra = {}) {
  const lib = ORDEM.slice(0, 9);
  const h = {};
  for (const l of lib) if (l !== 'm') h[l] = Array.from({ length: 6 }, (_, i) => ({ jogo: ['escute', 'caca', 'trace'][i % 3], ok: true, sessao: 1 + (i % 2), t: Date.now() - 1000 * (6 - i) }));
  return {
    v: 1, nome: '', guia: 'lumi', liberadas: lib, hist: h, rec: { estrela: 30, concha: 30, chifre: 30 }, recSessao: { estrela: 12, concha: 12, chifre: 12 },
    tempoTotal: 0, tempoSessao: 0, sessoes: 2, sessaoId: 2, ultima: Date.now(), ...extra,
  };
}

async function foto(page, vp, nome) {
  try { await page.screenshot({ path: `${SHOTS}/l-${vp.width}x${vp.height}-${nome}.png` }); } catch (e) { /* ok */ }
}

async function auditarTela(page, vp, nome, opcoes = {}) {
  await dormir(900); // espera as animações de entrada
  const a = await auditar(page);
  verificarAuditoria(R, `${vp.width}x${vp.height} ${nome}`, a, opcoes);
  await foto(page, vp, nome);
  return a;
}

async function sairRecompensa(page) {
  await page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); if (p) p.__v = true; });
  await tocar(page, 'button[aria-label="Continuar"]');
  await esperarAte(() => page.evaluate(() => { const p = document.querySelector('.recompensa .premio'); return !(p && p.__v); }), { timeout: 10000 });
}

try {
  for (const vp of VIEWPORTS) {
    const rotulo = `${vp.width}x${vp.height}`;
    console.log(`\n# ${rotulo}`);
    const n0 = R.falhas;
    // ---- A) estado novo
    {
      const app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true });
      const { page } = app;
      await esperarTela(page, 'inicio');
      const a = await auditarTela(page, vp, 'inicio');
      verificarEstilos(R, rotulo, a.estilos);
      await tocar(page, 'button[aria-label="Começar"]');
      await esperarTela(page, 'guia');
      await auditarTela(page, vp, 'guia');
      await tocar(page, 'button[aria-label="Escolher a unicórnio"]');
      await esperarTela(page, 'trilha');
      await auditarTela(page, vp, 'trilha-1-letra');
      await app.ctx.close();
    }
    // ---- B) 9 letras liberadas, coleção cheia
    {
      const app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, escala: 0.35, seed: seedBase() });
      const { page, esp } = app;
      const J = criarJogador(page, esp, R, {
        auditarTodos: true,
        aoAuditar: async (n) => { const a = await auditar(page); verificarAuditoria(R, `${rotulo} ${n}`, a); await foto(page, vp, n); },
      });
      await esperarTela(page, 'inicio');
      await tocar(page, 'button[aria-label="Começar"]');
      await esperarTela(page, 'trilha');
      await auditarTela(page, vp, 'trilha-9-letras');
      await tocar(page, '.parada.foco');
      await esperarTela(page, 'apresenta');
      await auditarTela(page, vp, 'apresenta');
      await tocar(page, 'button[aria-label="Voltar para a trilha"]');
      await esperarTela(page, 'trilha');
      await tocar(page, 'button[aria-label="Minha coleção"]');
      await esperarTela(page, 'colecao');
      await auditarTela(page, vp, 'colecao-cheia');
      await tocar(page, 'button[aria-label="Voltar para a trilha"]');
      await esperarTela(page, 'trilha');
      await tocar(page, 'button[aria-label="Brincadeiras"]');
      await esperarTela(page, 'menu');
      await auditarTela(page, vp, 'menu');
      // o 5º jogo (Casinhas dos Sons) tem seu próprio teste de layout em 5 tamanhos: tests/l-casinhas.test.mjs
      for (let i = 0; i < 4; i++) {
        await tocar(page, '.btn-jogo', { indice: i });
        const jogo = await J.jogarRodada();
        await esperarTela(page, 'recompensa');
        if (i === 0) await auditarTela(page, vp, 'recompensa');
        await sairRecompensa(page);
        await esperarTela(page, 'menu');
        console.log(`   ${rotulo}: ${jogo} ok`);
      }
      ok(app.coleta.pageerrors.length === 0 && app.coleta.erros.length === 0, `${rotulo}: sem erros no console`, app.coleta.pageerrors.concat(app.coleta.erros).join('\n'));
      await app.ctx.close();
    }
    // ---- C) despedida com coleção do dia cheia
    {
      const app = await abrirApp(browser, srv.base, { viewport: vp, rapido: true, escala: 0.35, seed: seedBase({ tempoSessao: 9 * 60000 }) });
      const { page, esp } = app;
      await esperarTela(page, 'inicio');
      await tocar(page, 'button[aria-label="Começar"]');
      await esperarTela(page, 'trilha');
      await tocar(page, 'button[aria-label="Brincadeiras"]');
      await esperarTela(page, 'menu');
      await tocar(page, '.btn-jogo', { indice: 0 });
      const J = criarJogador(page, esp, R, { errar: false });
      await J.jogarRodada();
      await esperarTela(page, 'recompensa');
      await sairRecompensa(page);
      await esperarTela(page, 'despedida');
      await auditarTela(page, vp, 'despedida-cheia');
      await app.ctx.close();
    }
    console.log(`   ${rotulo}: ${R.falhas - n0} falhas`);
  }
} catch (e) {
  R.ok(false, 'exceção no teste: ' + (e && e.stack || e));
} finally {
  await browser.close();
  srv.parar();
}
process.exit(R.fim() ? 1 : 0);
