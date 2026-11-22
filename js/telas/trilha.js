// Trilha Encantada: caminho rosa sinuoso, de baixo para cima, uma parada por letra.
// Mostra só uma janela de 6 paradas, centrada na letra foco (sem rolagem).
import { el, imagem, botaoIcone, botaoOuvir, srcGuia, slotLegenda, nomeEtapa } from '../ui.js';

const JANELA = 6;
const XS = [32, 68, 34, 66, 32, 68]; // posições x (%) em zigue-zague, de baixo para cima

function posicao(i, total) {
  const passo = total > 1 ? 76 / (total - 1) : 0;
  return { x: XS[i % XS.length], y: 88 - i * passo };
}

/** Caminho em curvas suaves passando por todos os pontos. */
function desenharCaminho(pts, comecaAbaixo, continuaAcima) {
  const todos = pts.slice();
  if (comecaAbaixo) todos.unshift({ x: 50, y: 104 });
  if (continuaAcima) todos.push({ x: 50, y: -4 });
  let d = `M ${todos[0].x} ${todos[0].y}`;
  for (let i = 1; i < todos.length; i++) {
    const a = todos[i - 1];
    const b = todos[i];
    const m = (a.y + b.y) / 2;
    d += ` C ${a.x} ${m}, ${b.x} ${m}, ${b.x} ${b.y}`;
  }
  return d;
}

export default {
  montar(raiz, app, params = {}) {
    const { ordem } = app.curriculo;
    const liberadas = app.progresso.letrasLiberadas();
    const foco = app.progresso.letraFoco();
    const idxFoco = foco ? ordem.indexOf(foco) : ordem.indexOf(liberadas[liberadas.length - 1]);
    const inicio = Math.max(0, Math.min(idxFoco - 2, ordem.length - JANELA));
    const letras = ordem.slice(inicio, inicio + JANELA);
    const pts = letras.map((_, i) => posicao(i, Math.min(JANELA, letras.length) > 1 ? JANELA : 1));

    const area = el('div', { classe: 'trilha-area' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const d = desenharCaminho(pts, inicio > 0, inicio + JANELA < ordem.length);
    for (const cls of ['caminho-base', 'caminho-miolo']) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      svg.append(p);
    }
    area.append(svg);

    let ultimoToque = { letra: null, t: 0 };
    const iniciarLicao = (l) => app.ir('licao', { letra: l });

    letras.forEach((l, i) => {
      const { x, y } = pts[i];
      const estilo = `left:${x}%;top:${y}%`;
      if (!liberadas.includes(l)) {
        const f = el('div', { classe: 'ponto futura', estilo, attrs: { 'aria-hidden': 'true' } }, imagem('assets/svg/ui/nuvem.svg'));
        area.append(f);
        return;
      }
      const ehFoco = l === foco || (!foco && l === liberadas[liberadas.length - 1]);
      const b = el('button', {
        type: 'button',
        classe: `ponto parada${ehFoco ? ' foco' : ''}`,
        estilo,
        attrs: { 'aria-label': `Parada número ${ordem.indexOf(l) + 1}` },
      }, imagem('assets/svg/ui/parada.svg', 'fundo-parada'), el('span', { classe: 'letra', texto: (app.curriculo.letras[l] && app.curriculo.letras[l].maiuscula) || l.toUpperCase() }));
      b.addEventListener('click', () => {
        if (ehFoco) return iniciarLicao(l);
        // parada antiga: diz o nome e depois o som; um segundo toque seguido abre a lição daquela letra
        const agora = Date.now();
        if (ultimoToque.letra === l && agora - ultimoToque.t < 6000) return iniciarLicao(l);
        ultimoToque = { letra: l, t: agora };
        b.classList.remove('balanca');
        void b.offsetWidth;
        b.classList.add('balanca');
        app.audio.falar([`nome:${l}`, 'pausa:400', `som:${l}`]);
      });
      area.append(b);
      if (ehFoco) {
        const gx = x < 50 ? 78 : 22;
        area.append(el('div', { classe: 'guia-trilha', estilo: `left:${gx}%;top:${y}%` }, imagem(srcGuia(app.progresso.guia()))));
      }
    });

    const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar ao início', texto: 'Início', glifo: '⌂', aoClicar: () => app.ir('inicio') });
    const falaInstr = ['frase:trilha_instrucao'];
    const ouvir = botaoOuvir(() => app.audio.falar(falaInstr));
    const barra = el('div', { classe: 'barra' }, casa, slotLegenda(), ouvir);
    const jogos = botaoIcone({ src: 'assets/svg/ui/jogo-trilha.svg', rotulo: 'Brincadeiras', texto: 'Brincadeiras', glifo: '★', classe: 'grande', aoClicar: () => app.ir('menu') });
    const colecao = botaoIcone({ src: 'assets/svg/ui/colecao.svg', rotulo: 'Minha coleção', texto: 'Coleção', glifo: '❦', classe: 'grande', aoClicar: () => app.ir('colecao') });
    const rodape = el('div', { classe: 'rodape' }, jogos, colecao);

    // indicador para a adulta: em que letra a criança está e em que etapa
    const letraAtual = foco || liberadas[liberadas.length - 1];
    const indice = ordem.indexOf(letraAtual) + 1;
    const etapa = nomeEtapa(app.curriculo, letraAtual);
    const indicador = el('div', { classe: 'indicador', attrs: { 'data-i': 'indicador', id: 'indicador-trilha' } },
      el('strong', { texto: `Letra ${indice} de ${ordem.length}` }),
      etapa ? el('span', { texto: ` · ${etapa}` }) : null,
      params.novaLetra ? el('span', { classe: 'indicador-nova', texto: 'Nova letra liberada!' }) : null);

    raiz.append(el('section', { classe: 'tela fundo-trilha' }, barra, indicador, area, rodape));

    let fala = falaInstr;
    if (params.novaLetra) fala = ['frase:letra_dominada', 'pausa:300', 'frase:trilha_nova_letra', 'pausa:300', ...falaInstr];
    else if (params.boasVindas) fala = ['frase:boas_vindas', 'pausa:300', ...falaInstr];
    app.audio.falar(fala);
    return {};
  },
};
