// Escolha do guia: Lumi (unicórnio) ou Marola (sereia).
import { el, imagem, botaoOuvir, falarComLimite, srcGuia, slotLegenda } from '../ui.js';

export default {
  montar(raiz, app, params = {}) {
    let ocupado = false;
    let vivo = true;
    const falaEntrada = [
      ...(params.boasVindas ? ['frase:boas_vindas', 'pausa:300'] : []),
      'frase:escolher_guia',
    ];
    const ouvir = botaoOuvir(() => app.audio.falar(['frase:escolher_guia']));
    const linha = el('div', { classe: 'linha-ouvir' }, slotLegenda(), ouvir);

    const botao = (id, rotulo, glifo, nome) => {
      const b = el('button', { type: 'button', classe: 'btn-guia', attrs: { 'aria-label': rotulo, 'data-glifo': glifo } },
        imagem(srcGuia(id)), el('span', { classe: 'rotulo', texto: nome, attrs: { 'data-i': 'rotulo' } }));
      b.addEventListener('click', async () => {
        if (ocupado) return;
        ocupado = true;
        b.classList.add('escolhida');
        app.progresso.definirGuia(id);
        app.audio.efeito('brilho');
        await falarComLimite(app, [`frase:guia_${id}`]);
        if (!vivo) return;
        app.ir(params.depois || 'trilha');
      });
      return b;
    };
    const tela = el('section', { classe: 'tela fundo-ceu' },
      el('div', { classe: 'guias' }, linha,
        botao('lumi', 'Escolher a unicórnio', '♡', 'Lumi, a unicórnio'),
        botao('marola', 'Escolher a sereia', '♥', 'Marola, a sereia')));
    raiz.append(tela);
    app.audio.falar(falaEntrada);
    return { destruir() { vivo = false; } };
  },
};
