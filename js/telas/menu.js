// Menu de brincadeiras: os 4 jogos livres, cada um com uma rodada.
import { el, imagem, botaoOuvir, quadro } from '../ui.js';
import { executarJogo } from './jogo.js';
import { mostrarRecompensa } from './recompensa.js';

const JOGOS = [
  ['escute', 'Escute e toque', '♪'],
  ['caca', 'Caça-som', '✶'],
  ['junte', 'Junte os sons', '≈'],
  ['trace', 'Trace a letra', '✎'],
];

export default {
  montar(raiz, app) {
    let vivo = true;
    let jogoAtual = null;
    const q = quadro(app, raiz, { aoCasa: () => app.ir('trilha') });
    const palco = q.palco;
    const regras = app.progresso.getRegras();

    function mostrarMenu() {
      const grade = el('div', { classe: 'menu-jogos' });
      for (const [id, rotulo, glifo] of JOGOS) {
        const b = el('button', { type: 'button', classe: 'btn-jogo', attrs: { 'aria-label': rotulo, 'data-glifo': glifo } }, imagem(`assets/svg/ui/jogo-${id}.svg`));
        b.addEventListener('click', () => jogar(id));
        grade.append(b);
      }
      const fala = ['frase:menu_jogos'];
      const ouvir = botaoOuvir(() => app.audio.falar(fala));
      palco.replaceChildren(grade, el('div', { classe: 'rodape' }, ouvir));
      app.audio.falar(fala);
    }

    async function jogar(id) {
      const letras = app.progresso.escolherLetrasRodada(regras.itensPorRodada);
      jogoAtual = executarJogo(app, palco, id, { letras, letraFoco: app.progresso.letraFoco(), modo: id === 'trace' ? 'livre' : undefined });
      const r = await jogoAtual.promessa;
      jogoAtual = null;
      if (!vivo) return;
      if (!r.ok) { mostrarMenu(); return; }
      await mostrarRecompensa(app, palco, 'estrela');
      if (!vivo) return;
      if (app.sessaoExcedida()) return app.ir('despedida');
      mostrarMenu();
    }

    mostrarMenu();
    return { destruir() { vivo = false; if (jogoAtual) jogoAtual.destruir(); } };
  },
};
