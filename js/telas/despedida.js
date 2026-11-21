// Despedida: o guia em festa, a coleção do dia e o botão casa.
import { el, imagem, botaoIcone, botaoOuvir, srcGuia, gradeColecao } from '../ui.js';

export default {
  montar(raiz, app) {
    const guia = app.progresso.guia() || 'lumi';
    const fala = ['efeito:tchan', 'frase:despedida'];
    const festa = el('div', { classe: 'guia-festa' }, imagem(srcGuia(guia, true)));
    const dia = el('div', { classe: 'colecao-cheia' }, gradeColecao(app.progresso.recompensasSessao(), 12, 3));
    const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Ir para o início', glifo: '⌂', classe: 'grande', aoClicar: () => app.ir('inicio') });
    const ouvir = botaoOuvir(() => app.audio.falar(fala));
    // botão discreto, para a adulta seguir brincando
    const continuar = botaoIcone({
      src: 'assets/svg/ui/continuar.svg', rotulo: 'Continuar brincando', glifo: '▶', classe: 'discreto',
      aoClicar: () => { app.adiarDespedida(); app.ir('trilha'); },
    });
    raiz.append(el('section', { classe: 'tela fundo-ceu' },
      el('div', { classe: 'recompensa', estilo: 'padding-top:24px' }, festa, dia),
      el('div', { classe: 'rodape' }, ouvir, casa, continuar)));
    app.audio.falar(fala);
    return {};
  },
};
