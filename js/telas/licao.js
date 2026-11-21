// Lição de uma letra: apresentação e depois os jogos em sequência, com recompensas.
import { el, imagem, botaoIcone, botaoOuvir, quadro } from '../ui.js';
import { executarJogo } from './jogo.js';
import { mostrarRecompensa } from './recompensa.js';

const SEQUENCIA = ['escute', 'caca', 'trace', 'junte'];

export default {
  montar(raiz, app, params) {
    const letra = params.letra;
    const info = app.curriculo.letras[letra] || {};
    const guia = app.progresso.guia() || 'lumi';
    let vivo = true;
    let jogoAtual = null;

    const q = quadro(app, raiz, { aoCasa: () => app.ir('trilha') });
    const palco = q.palco;
    const regras = app.progresso.getRegras();

    function apresentar() {
      return new Promise((resolver) => {
        const palavra = (info.palavras && info.palavras[0]) || null;
        const fala = ['frase:apresentar_letra', `som:${letra}`, 'pausa:400', 'frase:repita_comigo', `som:${letra}`];
        if (palavra) fala.push('pausa:600', 'frase:como_no_comeco', `pal:${palavra}`);
        const gigante = el('button', { type: 'button', classe: 'letra-gigante', attrs: { 'aria-label': 'Ouvir o som da letra' }, texto: info.maiuscula || letra.toUpperCase() });
        gigante.addEventListener('click', () => app.audio.falar([`som:${letra}`]));
        const fig = el('div', { classe: 'figura-licao' });
        if (palavra) fig.append(imagem(`assets/svg/figuras/${palavra}.svg`));
        const ouvir = botaoOuvir(() => app.audio.falar(fala));
        const continuar = botaoIcone({
          src: 'assets/svg/ui/continuar.svg', rotulo: 'Continuar', glifo: '▶', classe: 'grande pulsa',
          aoClicar: () => { continuar.disabled = true; resolver(); },
        });
        palco.replaceChildren(
          el('div', { classe: 'apresenta' }, gigante, fig),
          el('div', { classe: 'rodape' }, ouvir, continuar),
        );
        app.audio.falar(fala);
      });
    }

    async function fluxo() {
      await apresentar();
      if (!vivo) return;
      for (const id of SEQUENCIA) {
        const letras = app.progresso.escolherLetrasRodada(regras.itensPorRodada, letra);
        jogoAtual = executarJogo(app, palco, id, { letras, letraFoco: letra });
        const r = await jogoAtual.promessa;
        jogoAtual = null;
        if (!vivo) return;
        if (!r.ok) continue; // jogo ausente ou indisponível: pula sem quebrar
        const ultimo = id === SEQUENCIA[SEQUENCIA.length - 1];
        if (ultimo) break; // o último jogo vai direto para a recompensa final
        await mostrarRecompensa(app, palco, 'estrela');
        if (!vivo) return;
        if (app.sessaoExcedida()) return app.ir('despedida');
      }
      // fim da lição: concha (Marola) ou chifre (Lumi)
      await mostrarRecompensa(app, palco, guia === 'marola' ? 'concha' : 'chifre');
      if (!vivo) return;
      const nova = app.progresso.verificarAvanco();
      if (app.sessaoExcedida()) return app.ir('despedida');
      app.ir('trilha', nova ? { novaLetra: nova } : {});
    }
    fluxo();

    return {
      destruir() {
        vivo = false;
        if (jogoAtual) jogoAtual.destruir();
      },
    };
  },
};
