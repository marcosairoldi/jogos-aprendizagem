// Tela inicial: guia, botão Começar enorme e botão discreto dos pais.
import { el, imagem, botaoIcone, botaoOuvir, srcGuia, slotLegenda } from '../ui.js';

export default {
  montar(raiz, app) {
    const guia = app.progresso.guia();
    const pais = botaoIcone({
      src: 'assets/svg/ui/pais.svg', rotulo: 'Área dos pais', texto: 'Pais', glifo: '⚙', classe: 'discreto',
      aoClicar: () => app.ir('pais'),
    });
    const ajuda = botaoIcone({
      rotulo: 'Como funciona', texto: 'Como funciona', glifo: '?', classe: 'discreto',
      aoClicar: () => app.ir('ajuda'),
    });
    const topo = el('div', { classe: 'topo' }, ajuda, pais);

    const pers = el('div', { classe: 'personagens' });
    if (guia) {
      const i = imagem(srcGuia(guia));
      i.classList.add('unico');
      pers.append(i);
    } else {
      pers.append(imagem(srcGuia('lumi')), imagem(srcGuia('marola')));
    }

    const comecar = botaoIcone({
      src: 'assets/svg/ui/comecar.svg', rotulo: 'Começar', texto: 'Começar', classe: 'enorme pulsa',
      aoClicar: async () => {
        comecar.disabled = true;
        await app.audio.desbloquear();
        if (app.progresso.guia()) app.ir('trilha', { boasVindas: true });
        else app.ir('guia', { boasVindas: true });
      },
    });
    const ouvir = botaoOuvir(async () => {
      await app.audio.desbloquear();
      app.audio.falar(['frase:boas_vindas']);
    });
    const baixo = el('div', { classe: 'baixo' }, comecar, ouvir);

    raiz.append(el('section', { classe: 'tela inicio fundo-ceu' }, topo, slotLegenda(), pers, baixo));
    return {};
  },
};
