// Legenda da fala para a adulta que acompanha. A criança continua só ouvindo.
// Escuta o evento 'trilha:fala' (emitido por js/audio.js) e mostra o texto da frase.
// Para sons, sílabas e palavras mostra um alto-falante e o texto em MAIÚSCULA: a adulta deve ler o SOM, não o nome da letra.
import { el } from './ui.js';
import { ler, gravar } from './armazenamento.js';

const CHAVE = 'trilhaSons.legendas';
const SOME_DEPOIS_MS = 4000;
const NS = 'http://www.w3.org/2000/svg';

let ligada = null;
let timer = null;

function icone() {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'legenda-icone');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z');
  p.setAttribute('fill', 'currentColor');
  s.append(p);
  return s;
}

const caixa = el('div', { classe: 'legenda', attrs: { 'aria-hidden': 'true', 'data-i': 'legenda', id: 'legenda' } });
let slotAtual = null;

export function legendasLigadas() {
  if (ligada === null) ligada = ler(CHAVE, true) !== false;
  return ligada;
}
export function definirLegendas(v) {
  ligada = !!v;
  gravar(CHAVE, ligada);
  if (!ligada) limpar();
  if (slotAtual) slotAtual.hidden = !ligada;
}

export function limpar() {
  clearTimeout(timer);
  caixa.classList.remove('visivel');
}

function mostrar(d) {
  if (!legendasLigadas()) return;
  clearTimeout(timer);
  caixa.replaceChildren();
  if (d.tipo === 'frase') {
    caixa.classList.remove('simbolo');
    caixa.append(el('span', { classe: 'legenda-texto', texto: d.texto }));
  } else {
    caixa.classList.add('simbolo');
    caixa.append(icone());
    // no Escute e Toque a letra é a resposta: só o alto-falante, para não entregar a resposta
    const escondeTexto = d.tipo === 'som' && document.querySelector('.jogo-escute');
    if (!escondeTexto) caixa.append(el('span', { classe: 'legenda-texto grande', texto: d.texto }));
  }
  caixa.classList.add('visivel');
  ajustar();
}

// Frase longa em espaço estreito: reduz a fonte (14 a 11 px) até caber inteira, sem cortar.
function ajustar() {
  caixa.style.fontSize = '';
  if (!caixa.isConnected || caixa.classList.contains('simbolo')) return;
  for (let px = 14; px >= 11; px--) {
    caixa.style.fontSize = px + 'px';
    if (caixa.scrollHeight <= caixa.clientHeight + 1) return;
  }
}

function aoFalar(ev) {
  const d = (ev && ev.detail) || {};
  if (d.fim) {
    clearTimeout(timer);
    timer = setTimeout(() => caixa.classList.remove('visivel'), SOME_DEPOIS_MS);
    return;
  }
  if (d.texto) mostrar(d);
}

export function iniciarLegenda() {
  window.addEventListener('trilha:fala', aoFalar);
}

/** Depois de montar uma tela: coloca a legenda no espaço reservado dela (se houver). */
export function anexar(raiz) {
  const slot = raiz.querySelector('.legenda-slot');
  slotAtual = slot;
  if (!slot) { caixa.remove(); return; }
  slot.hidden = !legendasLigadas();
  slot.append(caixa);
  ajustar();
}
