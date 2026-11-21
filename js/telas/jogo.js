// Executa um jogo (js/jogos/<id>.js) dentro de um palco, montando o ctx do contrato.
import { el } from '../ui.js';

/**
 * Devolve { promessa, destruir }.
 * promessa resolve com { ok: true, res } quando o jogo chama aoTerminar,
 * ou { ok: false } se o jogo não existe, não está disponível ou falhou.
 */
export function executarJogo(app, palco, id, { letras, letraFoco }) {
  let instancia = null;
  let terminou = false;
  let destruido = false;
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });

  const destruir = () => {
    if (destruido) return;
    destruido = true;
    try { if (instancia && instancia.destruir) instancia.destruir(); } catch (e) { console.warn('[jogo] erro ao destruir', id, e); }
    instancia = null;
  };

  (async () => {
    const jogo = await app.carregarJogo(id);
    if (destruido) return;
    const liberadas = app.progresso.letrasLiberadas();
    let ok = false;
    try { ok = !!(jogo && jogo.disponivel(liberadas, app.curriculo)); } catch (e) { ok = false; }
    if (!ok) { resolver({ ok: false }); return; }
    const raiz = el('div', { classe: `raiz-jogo jogo-${id}`, estilo: 'flex:1;width:100%;min-height:0;position:relative;' });
    palco.replaceChildren(raiz);
    const ctx = {
      curriculo: app.curriculo,
      audio: app.audio,
      guia: app.progresso.guia() || 'lumi',
      letras,
      letraFoco,
      letrasLiberadas: liberadas,
      estadoLetra: (l) => app.progresso.estadoLetra(l),
      registrar: (r) => app.progresso.registrar(r),
      aoTerminar: (res) => {
        if (terminou) return;
        terminou = true;
        // destrói fora da pilha de quem chamou, para o jogo terminar o que está fazendo
        Promise.resolve().then(() => { destruir(); resolver({ ok: true, res }); });
      },
    };
    try {
      instancia = jogo.iniciar(raiz, ctx) || null;
    } catch (e) {
      console.warn('[jogo] falha ao iniciar', id, e);
      destruir();
      resolver({ ok: false });
    }
  })();

  return { promessa, destruir };
}
