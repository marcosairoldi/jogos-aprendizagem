// Trilha Encantada: caminho rosa sinuoso, de baixo para cima, uma parada por letra.
// Mostra só uma janela de 6 paradas, centrada na letra foco (sem rolagem). Botões e arrasto vertical trocam de página.
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
    const inicioFoco = Math.max(0, Math.min(idxFoco - 2, ordem.length - JANELA));
    let inicio = inicioFoco;

    const area = el('div', { classe: 'trilha-area' });
    let suprimirAte = 0; // depois de arrastar, o toque que "sobra" não abre nada
    const iniciarLicao = (l) => { if (Date.now() < suprimirAte) return; app.ir('licao', { letra: l }); };

    function criarPagina(ini) {
      const letras = ordem.slice(ini, ini + JANELA);
      const pts = letras.map((_, i) => posicao(i, Math.min(JANELA, letras.length) > 1 ? JANELA : 1));
      const pag = el('div', { classe: 'trilha-pagina' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const d = desenharCaminho(pts, ini > 0, ini + JANELA < ordem.length);
      for (const cls of ['caminho-base', 'caminho-miolo']) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', cls);
        svg.append(p);
      }
      pag.append(svg);
      letras.forEach((l, i) => {
        const { x, y } = pts[i];
        const estilo = `left:${x}%;top:${y}%`;
        if (!liberadas.includes(l)) {
          pag.append(el('div', { classe: 'ponto futura', estilo, attrs: { 'aria-hidden': 'true' } }, imagem('assets/svg/ui/nuvem.svg')));
          return;
        }
        const ehFoco = l === foco || (!foco && l === liberadas[liberadas.length - 1]);
        const dominada = app.progresso.estadoLetra(l) === 'dominada';
        const b = el('button', {
          type: 'button',
          classe: `ponto parada${ehFoco ? ' foco' : ''}${dominada ? ' dominada' : ''}`,
          estilo,
          attrs: { 'aria-label': `Parada número ${ordem.indexOf(l) + 1}` },
        }, imagem('assets/svg/ui/parada.svg', 'fundo-parada'),
        el('span', { classe: 'letra', texto: (app.curriculo.letras[l] && app.curriculo.letras[l].maiuscula) || l.toUpperCase() }),
        dominada ? el('span', { classe: 'marca-dominada', attrs: { 'aria-hidden': 'true', 'data-glifo': '★' } }, imagem('assets/svg/recompensas/estrela.svg')) : null);
        // um toque abre a lição da letra (a lição diz o nome e o som ao abrir)
        b.addEventListener('click', () => iniciarLicao(l));
        pag.append(b);
        if (ehFoco) {
          const gx = x < 50 ? 78 : 22;
          pag.append(el('div', { classe: 'guia-trilha', estilo: `left:${gx}%;top:${y}%` }, imagem(srcGuia(app.progresso.guia()))));
        }
      });
      return pag;
    }

    let pagina = criarPagina(inicio);
    area.append(pagina);

    const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar ao início', texto: 'Início', glifo: '⌂', aoClicar: () => app.ir('inicio') });
    const falaInstr = ['frase:trilha_instrucao'];
    const ouvir = botaoOuvir(() => app.audio.falar(falaInstr));
    const barra = el('div', { classe: 'barra' }, casa, slotLegenda(), ouvir);
    const jogos = botaoIcone({ src: 'assets/svg/ui/jogo-trilha.svg', rotulo: 'Brincadeiras', texto: 'Brincadeiras', glifo: '★', classe: 'grande', aoClicar: () => app.ir('menu') });
    const colecao = botaoIcone({ src: 'assets/svg/ui/colecao.svg', rotulo: 'Minha coleção', texto: 'Coleção', glifo: '❦', classe: 'grande', aoClicar: () => app.ir('colecao') });
    const anteriores = botaoIcone({ src: 'assets/svg/ui/voltar-trilha.svg', rotulo: 'Letras anteriores', texto: 'Letras anteriores', glifo: '↓', classe: 'nav-trilha', aoClicar: () => irPara(inicio - JANELA) });
    const hoje = botaoIcone({ src: 'assets/svg/ui/letra-de-hoje.svg', rotulo: 'Letra de hoje', texto: 'Letra de hoje', glifo: '★', classe: 'nav-trilha', aoClicar: () => irPara(inicioFoco) });
    const rodape = el('div', { classe: 'rodape rodape-trilha' }, anteriores, jogos, colecao, hoje);

    // indicador para a adulta: em que letra a criança está e em que etapa (ou o intervalo da página que está vendo)
    const letraAtual = foco || liberadas[liberadas.length - 1];
    const indicador = el('div', { classe: 'indicador', attrs: { 'data-i': 'indicador', id: 'indicador-trilha' } });
    function pintarIndicador() {
      indicador.replaceChildren();
      if (inicio === inicioFoco) {
        const etapa = nomeEtapa(app.curriculo, letraAtual);
        indicador.append(el('strong', { texto: `Letra ${ordem.indexOf(letraAtual) + 1} de ${ordem.length}` }));
        if (etapa) indicador.append(el('span', { texto: ` · ${etapa}` }));
        if (params.novaLetra) indicador.append(el('span', { classe: 'indicador-nova', texto: 'Nova letra liberada!' }));
      } else {
        const fim = Math.min(inicio + JANELA, ordem.length);
        indicador.append(el('strong', { texto: `Letras ${inicio + 1} a ${fim} de ${ordem.length}` }), el('span', { texto: ' · treino das letras anteriores' }));
      }
    }
    function pintarNav() {
      const mostrar = (b, sim) => { b.classList.toggle('oculto', !sim); b.disabled = !sim; b.tabIndex = sim ? 0 : -1; b.setAttribute('aria-hidden', sim ? 'false' : 'true'); };
      mostrar(anteriores, inicio > 0);
      mostrar(hoje, inicio !== inicioFoco);
    }

    /** Troca a janela da trilha com uma transição suave (a tela não rola). */
    function irPara(alvo) {
      alvo = Math.max(0, Math.min(alvo, inicioFoco));
      if (alvo === inicio) return;
      const subindo = alvo > inicio; // páginas mais novas entram por cima
      inicio = alvo;
      const velha = pagina;
      pagina = criarPagina(inicio);
      pagina.classList.add(subindo ? 'entra-de-cima' : 'entra-de-baixo');
      velha.classList.add('saindo', subindo ? 'sai-para-baixo' : 'sai-para-cima');
      velha.setAttribute('aria-hidden', 'true');
      area.append(pagina);
      setTimeout(() => velha.remove(), 320);
      pintarIndicador();
      pintarNav();
    }

    // arrastar na vertical: dedo para cima mostra as letras anteriores (abaixo), para baixo as mais novas
    let ini = null;
    area.addEventListener('pointerdown', (ev) => { ini = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
    const soltar = (ev) => {
      if (!ini || ev.pointerId !== ini.id) return;
      const dy = ev.clientY - ini.y;
      const dx = ev.clientX - ini.x;
      ini = null;
      if (ev.type === 'pointerup' && Math.abs(dy) >= 48 && Math.abs(dy) > Math.abs(dx) * 1.3) {
        suprimirAte = Date.now() + 450;
        irPara(dy < 0 ? inicio - JANELA : inicio + JANELA);
      }
    };
    area.addEventListener('pointerup', soltar);
    area.addEventListener('pointercancel', soltar);

    pintarIndicador();
    pintarNav();
    raiz.append(el('section', { classe: 'tela fundo-trilha' }, barra, indicador, area, rodape));

    let fala = falaInstr;
    if (params.novaLetra) fala = ['frase:letra_dominada', 'pausa:300', 'frase:trilha_nova_letra', 'pausa:300', ...falaInstr];
    else if (params.boasVindas) fala = ['frase:boas_vindas', 'pausa:300', ...falaInstr];
    app.audio.falar(fala);
    return {};
  },
};
