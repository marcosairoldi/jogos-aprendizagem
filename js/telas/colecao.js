// Coleção: estrelas, conchas e chifres ganhos (sem números, sem competição).
import { el, botaoIcone, botaoOuvir, gradeColecao } from '../ui.js';

export default {
  montar(raiz, app) {
    const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar para a trilha', glifo: '⌂', aoClicar: () => app.ir('trilha') });
    const fala = ['frase:colecao'];
    const ouvir = botaoOuvir(() => app.audio.falar(fala));
    const barra = el('div', { classe: 'barra' }, casa, ouvir);
    const grade = gradeColecao(app.progresso.recompensas(), 24);
    const area = el('div', { classe: 'area-colecao' }, el('div', { classe: 'colecao-cheia' }, grade));
    raiz.append(el('section', { classe: 'tela fundo-mar' }, barra, area));
    app.audio.falar(fala);
    return {};
  },
};
