// Utilidades de interface compartilhadas pelas telas.

/** Cria um elemento. props: classe, texto, attrs{}, on{evento: fn}, estilo (string css). */
export function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'classe') e.className = v;
    else if (k === 'texto') e.textContent = v;
    else if (k === 'estilo') e.style.cssText = v;
    else if (k === 'attrs') for (const [a, b] of Object.entries(v)) e.setAttribute(a, b);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e[k] = v;
  }
  for (const f of filhos.flat()) if (f != null) e.append(f);
  return e;
}

/** Imagem tolerante: se o arquivo não existir, some e o pai ganha a classe 'sem-img'. */
export function imagem(src, classe = '') {
  const img = new Image();
  img.className = classe;
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.addEventListener('error', () => {
    img.classList.add('quebrada');
    if (img.parentElement) img.parentElement.classList.add('sem-img');
  });
  img.src = src;
  return img;
}

/**
 * Botão com ícone. `glifo` é só um símbolo de reserva se o SVG faltar.
 * Todo botão tem aria-label.
 */
export function botaoIcone({ src, rotulo, glifo = '', classe = '', aoClicar }) {
  const b = el('button', { type: 'button', classe: `btn-icone ${classe}`.trim(), attrs: { 'aria-label': rotulo, 'data-glifo': glifo } });
  if (src) b.append(imagem(src));
  if (aoClicar) b.addEventListener('click', aoClicar);
  return b;
}

export function botaoOuvir(aoClicar, classe = '') {
  return botaoIcone({ src: 'assets/svg/ui/ouvir.svg', rotulo: 'Ouvir de novo', glifo: '♫', classe: `ouvir ${classe}`, aoClicar });
}

export function srcGuia(guia, festa = false) {
  return `assets/svg/personagens/${guia || 'lumi'}${festa ? '-festa' : ''}.svg`;
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a fala terminar, mas nunca mais que `max` ms (a fala não pode travar a tela). */
export function falarComLimite(app, itens, max = 9000) {
  return Promise.race([app.audio.falar(itens), dormir(max)]);
}

/**
 * Quadro de lição/jogo: barra superior (casa + guia) e palco abaixo.
 * `aoCasa` é chamado ao tocar na casa.
 */
export function quadro(app, raiz, { aoCasa, guia } = {}) {
  const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar para a trilha', glifo: '⌂', aoClicar: aoCasa });
  const g = el('div', { classe: 'barra-guia' }, imagem(srcGuia(guia || app.progresso.guia())));
  const barra = el('div', { classe: 'barra' }, casa, g);
  const palco = el('div', { classe: 'palco' });
  const tela = el('section', { classe: 'tela tela-jogo' }, barra, palco);
  raiz.append(tela);
  return { tela, barra, palco };
}

/**
 * Grade da coleção: ícones de estrelas, conchas e chifres (sem números).
 * `filas` é o total de filas de ícones (5 por fila) que cabem na tela sem rolar; dividido entre os tipos presentes.
 */
export function gradeColecao(rec, maximo = 24, filas = 6) {
  const grade = el('div', { classe: 'grade-colecao' });
  const tipos = [['estrela', 'estrela'], ['concha', 'concha'], ['chifre', 'chifre']];
  const presentes = tipos.filter(([tipo]) => (rec[tipo] || 0) > 0).length || 1;
  const porTipo = Math.min(maximo, Math.max(1, Math.floor(filas / presentes)) * 5);
  for (const [tipo, arq] of tipos) {
    const n = Math.min(rec[tipo] || 0, porTipo);
    if (!n) continue;
    const linha = el('div', { classe: `linha-colecao ${tipo}` });
    for (let i = 0; i < n; i++) {
      const c = el('span', { classe: `item-colecao ${tipo}`, estilo: `animation-delay:${Math.min(i, 12) * 60}ms` });
      c.append(imagem(`assets/svg/recompensas/${arq}.svg`));
      linha.append(c);
    }
    grade.append(linha);
  }
  return grade;
}
