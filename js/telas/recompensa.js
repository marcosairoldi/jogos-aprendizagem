// Tela de recompensa rápida (estrela, concha ou chifre) dentro de um palco.
import { el, imagem, botaoIcone, botaoOuvir, srcGuia } from '../ui.js';

const FRASES = { estrela: 'frase:recompensa_estrela', concha: 'frase:recompensa_concha', chifre: 'frase:recompensa_chifre' };

/** Mostra o prêmio e devolve uma Promise que resolve quando a criança toca em continuar. */
export function mostrarRecompensa(app, palco, tipo, { nota } = {}) {
  return new Promise((resolver) => {
    app.progresso.ganharRecompensa(tipo);
    const guia = app.progresso.guia() || 'lumi';
    const fala = ['efeito:tchan', FRASES[tipo]];
    const premio = el('div', { classe: 'premio' }, imagem(`assets/svg/recompensas/${tipo}.svg`));
    const festa = el('div', { classe: 'guia-festa' }, imagem(srcGuia(guia, true)));
    const ouvir = botaoOuvir(() => app.audio.falar(fala));
    const continuar = botaoIcone({
      src: 'assets/svg/ui/continuar.svg', rotulo: 'Continuar', texto: 'Continuar', glifo: '▶', classe: 'grande pulsa',
      aoClicar: () => { continuar.disabled = true; resolver(); },
    });
    const rodape = el('div', { classe: 'rodape' }, ouvir, continuar);
    const resultado = nota ? el('p', { classe: 'resultado-licao', texto: nota, attrs: { 'data-i': 'indicador' } }) : null;
    palco.replaceChildren(el('div', { classe: 'recompensa' }, festa, premio, resultado), rodape);
    app.audio.falar(fala);
  });
}
