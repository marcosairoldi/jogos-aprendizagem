// Utilidades compartilhadas pelos quatro mini-jogos.
// Nada aqui fala o nome de letras: só o SOM (ctx.audio.falar(['som:m'])).

// Pares de letras cujos sons a criança costuma confundir no começo.
export const PARES_CONFUNDIVEIS = [['p', 'b'], ['t', 'd'], ['f', 'v'], ['m', 'n']];

export function confundivel(a, b) {
  return PARES_CONFUNDIVEIS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// Caminho de arquivo do projeto (relativo à raiz do site), resolvido a partir deste módulo.
export function urlAsset(caminho) {
  if (/^(data:|https?:|blob:)/.test(caminho)) return caminho;
  return new URL('../../' + caminho.replace(/^\/+/, ''), import.meta.url).href;
}

export function embaralhar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cria elemento: el('div', {class:'x', aria:'...', dataset:{}}, filho1, filho2)
export function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'aria') e.setAttribute('aria-label', v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null) e.append(f);
  return e;
}

export function imagem(caminho, classe = '') {
  const img = el('img', { src: urlAsset(caminho), alt: '', draggable: 'false', class: classe });
  img.addEventListener('dragstart', (e) => e.preventDefault());
  return img;
}

// Ciclo de vida: guarda timers e listeners e os desfaz em destruir().
// aguardar(promessa) nunca resolve depois de destruir(), o que interrompe as cadeias async.
export function criarCiclo() {
  const timers = new Set();
  const ouvintes = [];
  let vivo = true;
  return {
    get vivo() { return vivo; },
    depois(fn, ms) {
      const t = setTimeout(() => { timers.delete(t); if (vivo) fn(); }, ms);
      timers.add(t);
      return t;
    },
    esperar(ms) {
      return new Promise((res) => { this.depois(res, ms); });
    },
    aguardar(promessa) {
      return Promise.resolve(promessa).then((v) => (vivo ? v : new Promise(() => {})));
    },
    ouvir(alvo, evento, fn, opcoes) {
      alvo.addEventListener(evento, fn, opcoes);
      ouvintes.push([alvo, evento, fn, opcoes]);
    },
    destruir() {
      vivo = false;
      timers.forEach(clearTimeout);
      timers.clear();
      ouvintes.forEach(([a, e, f, o]) => a.removeEventListener(e, f, o));
      ouvintes.length = 0;
    },
  };
}

// Trava: ignora toques enquanto uma resposta está sendo processada.
export function criarTrava() {
  return { ocupado: false };
}

// Liga toque (pointerup) e teclado (Enter/Espaço) a um elemento.
export function aoTocar(ciclo, elemento, fn) {
  ciclo.ouvir(elemento, 'pointerup', (ev) => { if (ev.button > 0) return; fn(ev); });
  ciclo.ouvir(elemento, 'keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(ev); }
  });
}

// Cartão grande de resposta (botão). conteudo: texto (letra) ou elemento (figura).
export function criarCartao({ ciclo, conteudo, aria, classe = '', aoEscolher }) {
  const b = el('button', { type: 'button', class: 'j-cartao ' + classe, aria });
  if (typeof conteudo === 'string') b.append(el('span', { class: 'j-letra', 'aria-hidden': 'true' }, conteudo));
  else b.append(conteudo);
  aoTocar(ciclo, b, () => aoEscolher(b));
  return b;
}

// Botão grande de ouvir de novo.
export function criarBotaoOuvir({ ciclo, aoOuvir }) {
  const b = el('button', { type: 'button', class: 'j-ouvir', aria: 'Ouvir de novo' }, imagem('assets/svg/ui/ouvir.svg'));
  aoTocar(ciclo, b, () => aoOuvir());
  return b;
}

// Pontinhos de progresso da rodada (decorativos).
export function criarProgresso(total) {
  const caixa = el('div', { class: 'j-progresso', 'aria-hidden': 'true' });
  for (let i = 0; i < total; i++) caixa.append(el('span', { class: 'j-ponto' }));
  return {
    caixa,
    marcar(feitos) {
      [...caixa.children].forEach((p, i) => p.classList.toggle('j-feito', i < feitos));
    },
  };
}

export function efeito(ctx, nome) {
  try { ctx.audio.efeito(nome); } catch (e) { /* som é opcional */ }
}

// Elogio variando acerto_1..acerto_4.
export function criarElogio() {
  let n = Math.floor(Math.random() * 4);
  return () => `frase:acerto_${(n++ % 4) + 1}`;
}

export function itensPorRodada(ctx) {
  return ctx.curriculo?.regras?.itensPorRodada ?? 5;
}

// Sequência de n alvos (letras) sem repetir em seguida; a letra foco aparece mais.
export function sequenciaAlvos(ctx, n, validas) {
  let base = validas.slice();
  if (!base.length) return [];
  const foco = ctx.letraFoco;
  const saco = () => embaralhar(foco && base.includes(foco) ? base.concat([foco, foco]) : base);
  const res = [];
  let pool = saco();
  while (res.length < n) {
    if (!pool.length) pool = saco();
    let i = pool.findIndex((l) => l !== res[res.length - 1]);
    if (i < 0) { if (base.length > 1) { pool = saco(); continue; } i = 0; }
    res.push(pool.splice(i, 1)[0]);
  }
  return res;
}

// Quantas opções mostrar conforme o estado da letra-alvo.
export function numeroOpcoes(ctx, alvo, disponiveis) {
  const r = ctx.curriculo?.regras || {};
  const min = r.opcoesMin ?? 2, max = r.opcoesMax ?? 4;
  const est = ctx.estadoLetra(alvo);
  const n = est === 'nova' ? min : est === 'pratica' ? Math.min(3, max) : max;
  return Math.max(2, Math.min(n, disponiveis));
}

// Distratores de letra: das liberadas; se faltar, das próximas em curriculo.ordem.
// Para alvo 'nova', evita pares confundíveis (p/b, t/d, f/v, m/n) quando possível.
export function escolherDistratoresLetras(ctx, alvo, qtd) {
  const cur = ctx.curriculo;
  const lib = ctx.letrasLiberadas.filter((l) => l !== alvo && cur.letras[l]);
  const extra = (cur.ordem || []).filter((l) => l !== alvo && cur.letras[l] && !ctx.letrasLiberadas.includes(l));
  const pool = embaralhar(lib).concat(extra);
  const nova = ctx.estadoLetra(alvo) === 'nova';
  const bons = nova ? pool.filter((l) => !confundivel(alvo, l)) : pool;
  const ruins = pool.filter((l) => !bons.includes(l));
  return bons.concat(ruins).slice(0, qtd);
}

// Quantas letras distintas existem (liberadas + próximas) além do alvo.
export function letrasDisponiveisTotal(ctx) {
  const cur = ctx.curriculo;
  const s = new Set(ctx.letrasLiberadas.filter((l) => cur.letras[l]));
  (cur.ordem || []).forEach((l) => { if (cur.letras[l]) s.add(l); });
  return s.size;
}

// Distratores de palavra: figuras de palavras cuja inicial difere do alvo
// (preferindo letras liberadas e iniciais diferentes entre si).
export function escolherDistratoresPalavras(ctx, letraAlvo, palavraId, qtd, excluirIniciais = []) {
  const pal = ctx.curriculo.palavras || {};
  const nova = ctx.estadoLetra(letraAlvo) === 'nova';
  const todos = Object.keys(pal).filter((id) => {
    const p = pal[id];
    return id !== palavraId && p.figura && p.inicial !== letraAlvo && !excluirIniciais.includes(p.inicial)
      && !(nova && confundivel(letraAlvo, p.inicial));
  });
  const lib = embaralhar(todos.filter((id) => ctx.letrasLiberadas.includes(pal[id].inicial)));
  const outros = embaralhar(todos.filter((id) => !lib.includes(id)));
  const res = [], usadas = new Set();
  for (const id of lib.concat(outros)) {
    if (res.length >= qtd) break;
    if (usadas.has(pal[id].inicial)) continue;
    usadas.add(pal[id].inicial); res.push(id);
  }
  for (const id of lib.concat(outros)) {
    if (res.length >= qtd) break;
    if (!res.includes(id)) res.push(id);
  }
  return res;
}

// Animação alegre de acerto.
export function festejar(elemento) {
  elemento.classList.remove('j-convida');
  elemento.classList.add('j-acerto');
}

// Cintilância: partículas de brilho em CSS que se espalham a partir do centro do container.
export function cintilancia(container, ciclo, qtd = 22) {
  const camada = el('div', { class: 'j-cintila', 'aria-hidden': 'true' });
  for (let i = 0; i < qtd; i++) {
    const ang = (Math.PI * 2 * i) / qtd + Math.random() * 0.5;
    const dist = 90 + Math.random() * 130;
    const s = el('span', { class: 'j-estrelinha' });
    s.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
    s.style.setProperty('--atraso', Math.round(Math.random() * 250) + 'ms');
    s.style.setProperty('--tam', 10 + Math.round(Math.random() * 16) + 'px');
    camada.append(s);
  }
  container.append(camada);
  ciclo.depois(() => camada.remove(), 1700);
}

// Erro sem punição: a opção tocada balança de leve e some suavemente; fala a repetição;
// quando sobra só a certa, ela brilha convidando o toque. Resolve quando a trava pode soltar.
// cartoes: todos os cartões do item; certo: o cartão correto.
export async function errarSuave({ ctx, ciclo, cartao, cartoes, certo, fala }) {
  cartao.classList.add('j-balanca');
  ciclo.depois(() => cartao.classList.add('j-some'), 350);
  try { ctx.audio.falar(fala); } catch (e) { /* segue sem voz */ }
  await ciclo.esperar(750);
  cartao.disabled = true;
  const restantes = cartoes.filter((c) => !c.classList.contains('j-some'));
  if (restantes.length === 1 && restantes[0] === certo) certo.classList.add('j-convida');
}

// Fim da rodada comum: fala o encerramento e chama aoTerminar uma vez.
export async function terminarRodada({ ctx, ciclo, jogo, itens, raiz }) {
  cintilancia(raiz, ciclo, 18);
  efeito(ctx, 'tchan');
  await ciclo.aguardar(ctx.audio.falar(['frase:rodada_fim']));
  await ciclo.esperar(300);
  ctx.aoTerminar({ jogo, itens });
}

// Desmonta o jogo.
export function desmontar(raiz, ctx, ciclo) {
  ciclo.destruir();
  try { ctx.audio.parar(); } catch (e) { /* ok */ }
  raiz.innerHTML = '';
  raiz.classList.remove('jogo', 'jogo-escute', 'jogo-caca', 'jogo-junte', 'jogo-trace');
}
