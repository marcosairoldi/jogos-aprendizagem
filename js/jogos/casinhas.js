// Jogo 5: Casinhas dos Sons. A criança arrasta (ou toca e coloca) uma consoante e uma vogal nas duas
// casinhas e ouve a sílaba formada; na fase 3 monta palavras arrastando sílabas.
// Tocar numa peça fala o SOM (nunca o nome da letra). Erro sem punição: a peça volta suavemente.
import { ler, gravar } from '../armazenamento.js';
import {
  el, imagem, criarCiclo, criarBotaoOuvir, criarProgresso, embaralhar, itensPorRodada,
  efeito, terminarRodada, cintilancia, celebrarGuia, confundivel,
} from './comum.js';

const ID = 'casinhas';
const CHAVE = 'trilhaSons.casinhas';
const ACERTOS_PARA_AVANCAR = 8;
const LIMIAR_ARRASTE = 10; // px antes de virar arraste (abaixo disso é toque)

// ---------- progresso das fases (só no navegador) ----------
function lerEstado() {
  const s = ler(CHAVE, null) || {};
  const fase = [1, 2, 3].includes(Number(s.fase)) ? Number(s.fase) : 1;
  const a = (s && typeof s.acertos === 'object' && s.acertos) || {};
  const n = (k) => (Number.isFinite(Number(a[k])) && Number(a[k]) >= 0 ? Math.floor(Number(a[k])) : 0);
  return { fase, acertos: { 1: n(1), 2: n(2), 3: n(3) } };
}

// ---------- dados do currículo ----------
function consoantes(cur) {
  const todas = (cur.ordem || Object.keys(cur.letras)).filter((l) => cur.letras[l] && cur.letras[l].tipo === 'consoante' && l !== 'q');
  return { longas: todas.filter((l) => cur.letras[l].continuo), curtas: todas.filter((l) => !cur.letras[l].continuo), todas };
}
function vogais(cur) {
  return (cur.ordem || Object.keys(cur.letras)).filter((l) => cur.letras[l] && cur.letras[l].tipo === 'vogal');
}
function silabasCV(cur, cons, vog) {
  return Object.entries(cur.silabas || {})
    .filter(([, s]) => (s.letras || []).length === 2 && cons.includes(s.letras[0]) && vog.includes(s.letras[1]))
    .map(([id, s]) => ({ id, c: s.letras[0], v: s.letras[1] }));
}
function palavrasParaMontar(cur) {
  return Object.entries(cur.palavras || {})
    .filter(([, p]) => p.juntar && p.figura && (p.silabas || []).length >= 2 && p.silabas.every((s) => cur.silabas?.[s]))
    .map(([id, p]) => ({ id, silabas: p.silabas, inicial: p.inicial, figura: p.figura }));
}
// Palavra com figura que contém a sílaba; prefere a que começa com ela.
function palavrasDaSilaba(cur, sil) {
  const pal = cur.palavras || {};
  const ids = Object.keys(pal).filter((id) => pal[id].figura && (id.startsWith(sil) || (pal[id].silabas || []).includes(sil)));
  const comecam = ids.filter((id) => id.startsWith(sil));
  return comecam.length ? comecam : ids;
}

// Ciclo entre dois grupos (longas e curtas) para variar; devolve n elementos sem repetir em seguida.
function sortear(lista, n) {
  const res = [];
  let saco = [];
  while (res.length < n && lista.length) {
    if (!saco.length) saco = embaralhar(lista);
    let i = saco.findIndex((x) => x.id !== (res[res.length - 1] || {}).id);
    if (i < 0) i = 0;
    res.push(saco.splice(i, 1)[0]);
  }
  return res;
}
function intercalar(a, b, n) {
  const A = sortear(a, n), B = sortear(b, n);
  const res = [];
  for (let i = 0; res.length < n && (i < A.length || i < B.length); i++) {
    if (i % 2 === 0) { if (A[Math.floor(i / 2)]) res.push(A[Math.floor(i / 2)]); } else if (B[Math.floor(i / 2)]) res.push(B[Math.floor(i / 2)]);
  }
  return res.length >= n ? res : sortear(a.concat(b), n);
}
function distratoresConsoantes(pool, alvo, qtd) {
  const outros = embaralhar(pool.filter((l) => l !== alvo));
  const bons = outros.filter((l) => !confundivel(alvo, l));
  return bons.concat(outros.filter((l) => !bons.includes(l))).slice(0, qtd);
}

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-casinhas.svg',
  disponivel(letrasLiberadas, curriculo) {
    return !!(curriculo && curriculo.silabas && curriculo.letras);
  },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const cur = ctx.curriculo;
    const N = itensPorRodada(ctx);
    const estado = lerEstado();
    const cons = consoantes(cur);
    const vogs = vogais(cur);
    const pPalavras = palavrasParaMontar(cur);
    let fase = estado.fase;
    let indice = -1;
    let geracao = 0; // muda ao trocar de fase: interrompe cadeias async antigas
    let resultados = [];
    let itens = [];
    let item = null;
    let trava = false;
    let arraste = null;
    let selecionada = null;
    let primeira = true;
    let ultimaPalavra = null;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-casinhas');

    // ---- esqueleto
    const rotuloFase = el('span', { class: 'cs-rotulo-fase', 'data-i': 'rotulo' }, 'Fase');
    const botoesFase = [1, 2, 3].map((n) => {
      const b = el('button', { type: 'button', class: 'cs-fase', aria: 'Fase ' + n, 'data-i': 'indicador', dataset: { fase: String(n) } }, String(n));
      ciclo.ouvir(b, 'click', () => mudarFase(n));
      return b;
    });
    const fases = el('div', { class: 'cs-fases', role: 'group', 'aria-label': 'Fase' }, rotuloFase, el('div', { class: 'cs-bolinhas' }, botoesFase));
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => { if (item && !item.feito) ctx.audio.falar(falaAlvo(false)); } });
    const topo = el('div', { class: 'cs-topo' }, fases, botaoOuvir);
    const progresso = criarProgresso(N);
    const caixaProgresso = el('div', { class: 'cs-progresso' }, progresso.caixa);
    const figura = el('div', { class: 'cs-figura' });
    const casas = el('div', { class: 'cs-casas' });
    const bandeja = el('div', { class: 'cs-bandeja' });
    raiz.append(topo, caixaProgresso, figura, casas, bandeja);

    function atualizarFases(pulsar) {
      botoesFase.forEach((b, i) => {
        const atual = i + 1 === fase;
        b.classList.toggle('cs-atual', atual);
        b.setAttribute('aria-pressed', atual ? 'true' : 'false');
        if (atual && pulsar) { b.classList.remove('cs-pulsa'); void b.offsetWidth; b.classList.add('cs-pulsa'); }
      });
    }
    function salvar() { gravar(CHAVE, { fase, acertos: estado.acertos }); }

    // ---- escolha dos itens da rodada
    function sortearItens() {
      if (fase === 1) {
        const pool = silabasCV(cur, cons.longas, ['a']);
        return sortear(pool, N).map((s) => ({ tipo: 'sil', ...s }));
      }
      if (fase === 2) {
        const longas = silabasCV(cur, cons.longas, vogs);
        const curtas = silabasCV(cur, cons.curtas, vogs);
        return intercalar(longas, curtas, N).map((s) => ({ tipo: 'sil', ...s }));
      }
      const lib = pPalavras.filter((p) => p.silabas.every((s) => (cur.silabas[s].letras || []).every((l) => ctx.letrasLiberadas.includes(l))));
      const base = lib.length >= N ? lib : pPalavras;
      return sortear(base, N).map((p) => ({ tipo: 'pal', ...p }));
    }

    // ---- fala do alvo
    function falaAlvo(inicio) {
      if (!item) return [];
      const f = item.fase === 3 ? ['frase:casinhas_palavra', 'pal:' + item.palavra.id] : ['frase:casinhas_monte', 'sil:' + item.silaba];
      if (inicio) f.unshift('frase:casinhas_instrucao', 'pausa:300');
      return f;
    }

    // ---- montagem de um item
    function proximo() {
      indice++;
      progresso.marcar(indice);
      if (indice >= N) return fim();
      const base = itens[indice];
      limparSelecao();
      trava = false;
      arraste = null;
      casas.classList.remove('cs-feliz');
      casas.innerHTML = '';
      bandeja.innerHTML = '';
      figura.innerHTML = '';
      item = { fase, erros: 0, feito: false, slots: [], pecas: [], base };

      let pecas;
      if (fase === 3) {
        const palavra = base;
        const usadas = new Set(palavra.silabas);
        const outras = embaralhar([...new Set(pPalavras.flatMap((p) => p.silabas))].filter((s) => !usadas.has(s)));
        const certas = palavra.silabas.map((s) => ({ id: s, tipo: 's' }));
        const dist = outras.slice(0, 2).map((s) => ({ id: s, tipo: 's' }));
        pecas = embaralhar(certas.concat(dist));
        item.palavra = palavra;
        item.slots = palavra.silabas.map((s, i) => ({ tipo: 's', esperado: s, indice: i }));
        item.consoante = palavra.inicial;
        mostrarFigura(palavra.figura, null, false);
      } else {
        const poolC = fase === 1 ? cons.longas : cons.todas;
        const qC = indice % 2 === 0 ? 3 : 4;
        const lc = embaralhar([base.c, ...distratoresConsoantes(poolC, base.c, qC - 1)]).map((l) => ({ id: l, tipo: 'c' }));
        let lv;
        if (fase === 1) lv = [{ id: 'a', tipo: 'v' }];
        else {
          // quantas vogais cabem numa fileira da bandeja (5 só em telas largas)
          const cs = getComputedStyle(raiz);
          const largura = raiz.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20;
          const tam = Math.max(72, Math.min(104, Math.min(0.18 * innerWidth, 0.11 * innerHeight)));
          const maxV = Math.max(2, Math.min(5, Math.floor((largura + 6) / (tam + 6))));
          const q = Math.min(maxV, 2 + Math.min(3, indice));
          lv = embaralhar([base.v, ...embaralhar(vogs.filter((v) => v !== base.v)).slice(0, q - 1)]).map((v) => ({ id: v, tipo: 'v' }));
        }
        pecas = lc.concat(lv);
        item.silaba = base.id;
        item.consoante = base.c;
        item.slots = [{ tipo: 'c', esperado: base.c, indice: 0 }, { tipo: 'v', esperado: base.v, indice: 1 }];
        mostrarFigura(null, null, true);
      }

      // casinhas
      item.slots.forEach((s, i) => {
        const classe = fase === 3 ? 'cs-silaba-' + Math.min(i, 2) : (s.tipo === 'c' ? 'cs-consoante' : 'cs-vogal');
        s.vaga = el('div', { class: 'cs-vaga-casa' });
        s.el = el('div', { class: 'cs-casa ' + classe, role: 'button', tabindex: '0', aria: 'Casinha ' + (i + 1), dataset: { casa: String(i) } },
          el('div', { class: 'cs-telhado', 'aria-hidden': 'true' }), el('div', { class: 'cs-corpo' }, s.vaga));
        ciclo.ouvir(s.el, 'click', () => aoTocarCasa(i));
        ciclo.ouvir(s.el, 'keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); aoTocarCasa(i); } });
        casas.append(s.el);
      });

      // bandeja
      const grupos = fase === 3 ? [pecas] : [pecas.filter((p) => p.tipo === 'c'), pecas.filter((p) => p.tipo === 'v')];
      grupos.forEach((lista) => {
        const g2 = el('div', { class: 'cs-grupo' });
        lista.forEach((p) => {
          p.texto = p.id.toUpperCase();
          p.som = p.tipo === 's' ? 'sil:' + p.id : 'som:' + p.id;
          p.colocada = false;
          p.vaga = el('div', { class: 'cs-vaga-peca' + (p.tipo === 's' ? ' cs-silaba' : '') });
          p.el = el('button', { type: 'button', class: 'cs-peca cs-' + p.tipo, aria: p.tipo === 's' ? 'Sílaba' : (p.tipo === 'c' ? 'Consoante' : 'Vogal'), dataset: { id: p.id, tipo: p.tipo } }, p.texto);
          p.vaga.append(p.el);
          ligarPeca(p);
          item.pecas.push(p);
          g2.append(p.vaga);
        });
        bandeja.append(g2);
      });

      const inicio = primeira;
      primeira = false;
      ctx.audio.falar(falaAlvo(inicio));
    }

    function mostrarFigura(caminho, texto, vazio) {
      figura.innerHTML = '';
      const c = el('div', { class: 'cs-cartao-figura' + (vazio ? ' cs-vazio' : '') });
      if (vazio) c.append(imagem('assets/svg/ui/jogo-casinhas.svg'));
      else if (caminho) c.append(imagem(caminho));
      else if (texto) c.append(el('span', { class: 'cs-silaba-grande' }, texto));
      figura.append(c);
      if (!vazio) c.classList.add('cs-aparece');
    }

    // ---- peças: som ao tocar, arrastar, tocar-para-colocar
    function tocarSom(p) { try { ctx.audio.falar([p.som]); } catch (e) { /* segue sem voz */ } }

    function limparSelecao() {
      if (selecionada) selecionada.el.classList.remove('cs-selecionada');
      selecionada = null;
      if (item) item.slots.forEach((s) => s.el && s.el.classList.remove('cs-convida-casa'));
    }
    function selecionar(p) {
      limparSelecao();
      selecionada = p;
      p.el.classList.add('cs-selecionada');
      item.slots.forEach((s) => { if (!s.peca && (fase === 3 || s.tipo === p.tipo)) s.el.classList.add('cs-convida-casa'); });
    }

    function casaSob(cx, cy) {
      let melhor = null, dist = Infinity;
      item.slots.forEach((s, i) => {
        if (s.peca) return;
        const r = s.el.getBoundingClientRect();
        const m = 18;
        if (cx < r.left - m || cx > r.right + m || cy < r.top - m || cy > r.bottom + m) return;
        const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
        if (d < dist) { dist = d; melhor = i; }
      });
      return melhor;
    }
    function marcarSobre(i) {
      item.slots.forEach((s, k) => s.el.classList.toggle('cs-sobre', k === i));
    }

    function ligarPeca(p) {
      const b = p.el;
      ciclo.ouvir(b, 'pointerdown', (ev) => {
        if (ev.pointerType === 'mouse' && ev.button > 0) return;
        if (trava || arraste || p.colocada || !item || item.feito) return;
        ev.preventDefault();
        try { b.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
        const r = b.getBoundingClientRect();
        arraste = { p, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, movido: false };
        tocarSom(p);
      });
      ciclo.ouvir(b, 'pointermove', (ev) => {
        if (!arraste || arraste.p !== p || ev.pointerId !== arraste.id) return;
        const dx = ev.clientX - arraste.x0, dy = ev.clientY - arraste.y0;
        if (!arraste.movido) {
          if (Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
          arraste.movido = true;
          limparSelecao();
          b.classList.remove('cs-volta');
          b.classList.add('cs-arrasta');
        }
        b.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
        marcarSobre(casaSob(arraste.cx + dx, arraste.cy + dy));
      });
      ciclo.ouvir(b, 'pointerup', (ev) => {
        if (!arraste || arraste.p !== p || ev.pointerId !== arraste.id) return;
        const a = arraste;
        arraste = null;
        try { b.releasePointerCapture(ev.pointerId); } catch (e) { /* ok */ }
        marcarSobre(-1);
        if (!a.movido) { // toque: seleciona (ou solta a seleção)
          if (selecionada === p) limparSelecao(); else selecionar(p);
          return;
        }
        const dx = ev.clientX - a.x0, dy = ev.clientY - a.y0;
        const i = casaSob(a.cx + dx, a.cy + dy);
        if (i == null) { voltar(p); return; }
        tentar(p, i, { cx: a.cx, cy: a.cy });
      });
      const cancelar = (ev) => {
        if (!arraste || arraste.p !== p || (ev.pointerId != null && ev.pointerId !== arraste.id)) return;
        arraste = null;
        marcarSobre(-1);
        voltar(p);
      };
      ciclo.ouvir(b, 'pointercancel', cancelar);
      ciclo.ouvir(b, 'lostpointercapture', cancelar);
      ciclo.ouvir(b, 'keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        if (trava || p.colocada || item.feito) return;
        tocarSom(p);
        if (selecionada === p) limparSelecao(); else selecionar(p);
      });
    }

    function aoTocarCasa(i) {
      if (trava || !item || item.feito || !selecionada) return;
      const p = selecionada;
      limparSelecao();
      const r = p.el.getBoundingClientRect();
      tentar(p, i, { cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    }

    function voltar(p) {
      const b = p.el;
      b.classList.remove('cs-arrasta');
      b.classList.add('cs-volta');
      b.style.transform = '';
      ciclo.depois(() => b.classList.remove('cs-volta'), 460);
    }

    // ---- regras: valida a peça na casinha
    function tentar(p, i, base) {
      const s = item.slots[i];
      if (!s || s.peca || p.colocada || item.feito || trava) { voltar(p); return; }
      if (fase < 3 && p.tipo !== s.tipo) { // consoante na casa da vogal (ou o contrário): volta sem contar erro
        voltar(p); balancarCasa(s);
        ctx.audio.falar(falaAlvo(false));
        return;
      }
      if (p.id !== s.esperado) { errar(p); return; }
      encaixar(p, s, base);
    }

    function balancarCasa(s) {
      s.el.classList.remove('j-balanca'); void s.el.offsetWidth; s.el.classList.add('j-balanca');
      ciclo.depois(() => s.el.classList.remove('j-balanca'), 500);
    }

    function errar(p) {
      item.erros++;
      voltar(p);
      p.el.classList.remove('j-balanca');
      ctx.audio.falar(falaAlvo(false));
      if (item.erros >= 2) destacarCerta();
    }

    // depois de 2 erros, a peça certa (da primeira casa ainda vazia) brilha convidando
    function destacarCerta() {
      item.pecas.forEach((q) => q.el.classList.remove('cs-brilha'));
      const s = item.slots.find((x) => !x.peca);
      if (!s) return;
      const q = item.pecas.find((x) => !x.colocada && x.id === s.esperado && x.tipo === s.tipo);
      if (q) q.el.classList.add('cs-brilha');
    }

    async function encaixar(p, s, base) {
      const g = geracao;
      s.peca = p;
      p.colocada = true;
      limparSelecao();
      const b = p.el;
      const rv = s.vaga.getBoundingClientRect();
      b.classList.remove('cs-arrasta', 'cs-volta', 'cs-brilha');
      b.classList.add('cs-voa');
      b.style.transform = `translate(${Math.round(rv.left + rv.width / 2 - base.cx)}px, ${Math.round(rv.top + rv.height / 2 - base.cy)}px)`;
      efeito(ctx, 'pop');
      const ultima = item.slots.every((x) => x.peca);
      if (fase === 3 && !ultima) ctx.audio.falar(['sil:' + p.id]);
      await ciclo.esperar(290);
      if (g !== geracao) return;
      b.classList.remove('cs-voa');
      b.style.transform = '';
      s.vaga.append(b);
      s.el.classList.add('cs-cheia');
      p.vaga.classList.add('cs-vazia');
      if (ultima) { completar(p); return; }
      if (item.erros >= 2) destacarCerta();
    }

    // ---- acerto
    async function completar() {
      if (item.feito) return;
      const g = geracao;
      const it = item;
      it.feito = true;
      trava = true;
      limparSelecao();
      it.pecas.forEach((q) => q.el.classList.remove('cs-brilha'));
      const acertouPrimeira = it.erros === 0;
      if (ctx.letrasLiberadas.includes(it.consoante)) ctx.registrar({ letra: it.consoante, acertouPrimeira, jogo: ID });
      resultados.push({ letra: it.consoante, acertouPrimeira });
      let avancou = false;
      if (acertouPrimeira && it.fase === fase) {
        estado.acertos[fase] = (estado.acertos[fase] || 0) + 1;
        if (fase < 3 && estado.acertos[fase] >= ACERTOS_PARA_AVANCAR) { fase++; avancou = true; }
        salvar();
      } else salvar();

      casas.classList.add('cs-feliz');
      efeito(ctx, 'brilho');
      celebrarGuia();
      cintilancia(casas, ciclo, 16);

      if (it.fase === 3) {
        mostrarFigura(it.palavra.figura, null, false);
        await ciclo.aguardar(ctx.audio.falar(['sil:' + it.palavra.silabas[it.palavra.silabas.length - 1], 'pausa:150', 'pal:' + it.palavra.id]));
      } else {
        await ciclo.aguardar(ctx.audio.falar(['sil:' + it.silaba]));
        if (g !== geracao) return;
        const ids = palavrasDaSilaba(cur, it.silaba);
        const escolha = embaralhar(ids).find((x) => x !== ultimaPalavra) || ids[0];
        if (escolha) {
          ultimaPalavra = escolha;
          mostrarFigura(cur.palavras[escolha].figura, null, false);
          await ciclo.aguardar(ctx.audio.falar(['pal:' + escolha]));
        } else {
          mostrarFigura(null, it.silaba.toUpperCase(), false);
        }
      }
      if (g !== geracao) return;
      await ciclo.esperar(700);
      if (g !== geracao) return;
      if (avancou) {
        atualizarFases(true);
        efeito(ctx, 'tchan');
        const novos = sortearItens();
        for (let k = indice + 1; k < N; k++) itens[k] = novos[k];
        await ciclo.esperar(500);
        if (g !== geracao) return;
      }
      proximo();
    }

    function mudarFase(n) {
      if (n === fase) return;
      geracao++;
      fase = n;
      salvar();
      atualizarFases(false);
      resultados = [];
      indice = -1;
      itens = sortearItens();
      primeira = false;
      proximo();
    }

    async function fim() {
      geracao++;
      item = null;
      trava = true;
      casas.innerHTML = '';
      bandeja.innerHTML = '';
      figura.innerHTML = '';
      await terminarRodada({ ctx, ciclo, jogo: ID, itens: resultados, raiz });
    }

    atualizarFases(false);
    itens = sortearItens();
    proximo();

    return {
      destruir() {
        geracao++;
        ciclo.destruir();
        try { ctx.audio.parar(); } catch (e) { /* ok */ }
        raiz.innerHTML = '';
        raiz.classList.remove('jogo', 'jogo-casinhas');
      },
    };
  },
};
