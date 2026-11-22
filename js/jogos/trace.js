// Jogo 4: Trace a Letra. A criança passa o dedo sobre a letra pontilhada.
// Mecânica pensada para 5 anos: pode começar em qualquer ponto, em qualquer ordem e com o dedo tremido.
// Um ponto de controle fica "coberto" quando o dedo passa a até RAIO_PX pixels reais dele (o trecho entre dois
// eventos também conta, para dedos rápidos). Traço pronto = FRACAO dos pontos cobertos; letra pronta = todos os traços.
import {
  aoTocar, el, urlAsset, criarCiclo, criarBotaoOuvir, criarProgresso, embaralhar, efeito, cintilancia,
  terminarRodada, desmontar,
} from './comum.js';

const ID = 'trace';
const NS = 'http://www.w3.org/2000/svg';
const RAIO_PX = 28;      // o dedo cobre um ponto a até 28 px de tela (independe do tamanho da letra)
const ATRACAO_PX = 46;   // o rastro "gruda" no caminho mais próximo se o dedo estiver a até 46 px dele
const FRACAO = 0.8;      // fração dos pontos de um traço para dá-lo por feito
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz'.split('');
const RODADA_LIVRE = 3;  // letras traçadas no modo livre até a recompensa
// cada letra ocupa uma "célula" 100x100 (maiúscula 15..88, minúscula 15..97); recortes com folga pequena
const CELULA = 100, CX = 6, CY = 8, CW = 88, CH = 92;

let cacheTracados = null;
function carregarTracados() {
  if (!cacheTracados) {
    cacheTracados = fetch(urlAsset('data/tracados.json')).then((r) => r.json());
  }
  return cacheTracados;
}

function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
const pts = (lista) => lista.map((p) => p.join(',')).join(' ');
const r1 = (n) => Math.round(n * 10) / 10;

function estrela(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push([(cx + rr * Math.cos(a)).toFixed(1), (cy + rr * Math.sin(a)).toFixed(1)]);
  }
  return p;
}

// distância de P ao segmento AB e o ponto mais próximo dele
function sobreSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.hypot(px - x, py - y), x, y };
}

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-trace.svg',
  disponivel(letrasLiberadas) { return (letrasLiberadas || []).length >= 1; },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const livre = ctx.modo === 'livre';
    const resultados = [];
    const tracadas = new Set();
    let dados = null;
    let letraAtual = null;
    let estado = null; // { svg, tracos: [{ grupo, local, p, cob, n, feito, rastro }], layout, px, g* }
    let concluindo = false;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-trace');
    if (livre) raiz.classList.add('j-livre');

    const temSom = (l) => !!(ctx.curriculo && ctx.curriculo.letras && ctx.curriculo.letras[l]);
    const somDe = (l) => (temSom(l) ? ['som:' + l] : []);

    // ---- letras da rodada da lição: foco (ou a primeira) e uma revisão
    function escolherLetras(tracados) {
      const tem = (l) => tracados.letras[l];
      const base = ctx.letraFoco && tem(ctx.letraFoco) ? ctx.letraFoco : ctx.letras.find(tem);
      if (!base) return [];
      const outras = embaralhar(ctx.letras.concat(ctx.letrasLiberadas).filter((l) => l !== base && tem(l)));
      return outras.length ? [base, outras[0]] : [base];
    }

    let letras = [];
    const total = livre ? RODADA_LIVRE : 2;
    const progresso = criarProgresso(total);
    let aoOuvir = () => {};
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => aoOuvir() });
    const topo = el('div', { class: 'j-topo' }, progresso.caixa, botaoOuvir);
    const palco = el('div', { class: 'j-palco' });
    raiz.append(topo, palco);

    // ---- uma letra: maiúscula e minúscula juntas (lado a lado ou uma sobre a outra, o que ficar maior)
    function tracarLetra(letra) {
      return new Promise((resolver) => {
        letraAtual = letra;
        concluindo = false;
        ativos.clear();
        const def = dados.letras[letra];
        const grupos = [def.tracos];
        if (def.minuscula && def.minuscula.tracos) grupos.push(def.minuscula.tracos);
        const locais = [];
        grupos.forEach((g, gi) => g.forEach((t) => locais.push({ grupo: gi, local: t })));
        palco.innerHTML = '';
        const s = svg('svg', {
          class: 'j-trace-svg', role: 'img', 'aria-label': 'Letra para traçar', preserveAspectRatio: 'xMidYMid meet',
        });
        palco.append(s);
        estado = {
          svg: s, tracos: locais.map((t) => ({ ...t, p: [], cob: [], n: 0, feito: false })), grupos: grupos.length,
          layout: '', iGuia: 0, gFundo: null, gRastro: null, gDedo: null, gGuia: null, pronto: resolver,
        };
        ajustar(true);
        aoOuvir = falarInstrucao;
        // toque cru: sem rolagem, sem zoom, sem gesto de sistema sobre a área do traçado
        const barrar = (ev) => { if (ev.cancelable) ev.preventDefault(); };
        ciclo.ouvir(s, 'touchstart', barrar, { passive: false });
        ciclo.ouvir(s, 'touchmove', barrar, { passive: false });
        ciclo.ouvir(s, 'pointerdown', aoPressionar);
        ciclo.ouvir(s, 'pointermove', aoMover);
        ciclo.ouvir(s, 'pointerup', aoSoltar);
        ciclo.ouvir(s, 'pointercancel', aoSoltar);
        falarInstrucao();
      });
    }

    function falarInstrucao() {
      if (letraAtual) ctx.audio.falar(['frase:trace_instrucao', ...somDe(letraAtual)]);
    }

    // ---- layout: escolhe a disposição que deixa a letra maior e monta/redimensiona o SVG
    function ajustar(forcar) {
      const e = estado;
      if (!e || !palco.isConnected) return;
      const W = Math.max(40, palco.clientWidth - 14), H = Math.max(40, palco.clientHeight - 18);
      const duas = e.grupos > 1;
      const sH = Math.min(W / (duas ? 2 * CW + (CELULA - CW) : CW), H / CH); // lado a lado
      const sV = duas ? Math.min(W / CW, H / (CELULA + CH)) : sH;           // uma sobre a outra
      const layout = duas && sV > sH * 1.08 ? 'vertical' : 'horizontal';
      const esc = layout === 'vertical' ? sV : sH;
      const vbw = layout === 'vertical' || !duas ? CW : CELULA + CW;
      const vbh = layout === 'vertical' ? CELULA + CH : CH;
      e.px = esc;
      e.svg.style.width = Math.floor(vbw * esc) + 'px';
      e.svg.style.height = Math.floor(vbh * esc) + 'px';
      if (forcar || layout !== e.layout) {
        e.layout = layout;
        e.svg.setAttribute('viewBox', `${CX} ${CY} ${vbw} ${vbh}`);
        e.svg.dataset.layout = layout;
        e.svg.dataset.largura = vbw;
        e.tracos.forEach((t) => {
          const dx = t.grupo && layout === 'horizontal' ? CELULA : 0, dy = t.grupo && layout === 'vertical' ? CELULA : 0;
          t.p = t.local.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
          if (!t.cob.length) t.cob = t.p.map(() => false);
        });
        construir();
      }
    }

    // (re)cria o desenho a partir do estado: faixa, pontilhado, trechos acesos, dedo e guia
    function construir() {
      const e = estado;
      e.svg.replaceChildren();
      e.gFundo = svg('g'); e.gRastro = svg('g'); e.gDedo = svg('g'); e.gGuia = svg('g');
      e.svg.append(e.gFundo, e.gRastro, e.gDedo, e.gGuia);
      e.svg.dataset.total = e.tracos.reduce((n, t) => n + t.p.length, 0);
      e.svg.dataset.cobertos = e.tracos.reduce((n, t) => n + t.n, 0);
      if (e.grupos > 1) {
        const v = e.layout === 'vertical';
        e.gFundo.append(svg('line', {
          x1: v ? 24 : CELULA, y1: v ? CELULA : 18, x2: v ? 76 : CELULA, y2: v ? CELULA : 94, class: 'j-trace-divisor',
        }));
      }
      e.tracos.forEach((t) => {
        e.gFundo.append(svg('polyline', { points: pts(t.p), class: 'j-trace-faixa' }));
        e.gFundo.append(svg('polyline', { points: pts(t.p), class: 'j-trace-pontos' }));
        t.rastro = svg('path', { d: '', class: 'j-trace-rastro' + (t.feito ? ' j-pronto' : '') });
        e.gRastro.append(t.rastro);
        desenharRastro(t);
      });
      marcarGuia();
    }

    function desenharRastro(t) {
      const n = t.p.length;
      if (t.feito) { t.rastro.setAttribute('d', 'M' + t.p.map((q) => q.join(' ')).join('L')); return; }
      let d = '';
      for (let i = 0; i < n; i++) {
        if (!t.cob[i]) continue;
        let j = i;
        while (j + 1 < n && t.cob[j + 1]) j++;
        d += `M${t.p[i].join(' ')}` + (j === i ? 'l.01 0' : t.p.slice(i + 1, j + 1).map((q) => 'L' + q.join(' ')).join(''));
        i = j;
      }
      t.rastro.setAttribute('d', d);
    }

    // Ajuda sem pressa (inspirada no dedo-guia do app de referência): se a criança fica parada ~7 s, uma bolinha
    // mostra o caminho do próximo traço, duas vezes, e volta a esperar. Nada é cobrado nem contado; tocar a faz sumir.
    let timerDica = null;
    function agendarDica(ms = 7000) {
      clearTimeout(timerDica);
      if (!estado || concluindo) return;
      timerDica = ciclo.depois(mostrarDica, ms);
    }
    function limparDica() {
      if (!estado || !estado.gGuia) return;
      const d = estado.gGuia.querySelector('.j-trace-demo');
      if (d) d.remove();
    }
    function proximo() { return estado.tracos.find((t) => !t.feito); }
    function mostrarDica() {
      const e = estado;
      if (!e || concluindo) return;
      const t = proximo();
      if (!t || ativos.size) { agendarDica(); return; }
      limparDica();
      const [x0, y0] = t.p[0];
      const caminho = 'M0 0 ' + t.p.slice(1).map(([x, y]) => `L${r1(x - x0)} ${r1(y - y0)}`).join(' ');
      const ponto = svg('circle', { cx: x0, cy: y0, r: 6, class: 'j-trace-demo-ponto' });
      ponto.append(svg('animateMotion', { dur: '2s', repeatCount: '2', path: caminho, fill: 'freeze' }));
      const g = svg('g', { class: 'j-trace-demo' });
      g.append(ponto);
      e.gGuia.append(g);
      agendarDica(6500);
    }

    // Estrelinha no início do próximo traço e seta de direção (sugestão: a criança pode começar onde quiser).
    function marcarGuia() {
      const { gGuia } = estado;
      gGuia.innerHTML = '';
      agendarDica();
      const t = proximo();
      if (!t) return;
      const [x, y] = t.p[0];
      gGuia.append(svg('polygon', { points: pts(estrela(x, y, 8)), class: 'j-trace-estrela' }));
      const k = Math.min(4, t.p.length - 1);
      const a = t.p[Math.max(0, k - 1)], b = t.p[Math.min(t.p.length - 1, k + 1)];
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      gGuia.append(svg('polygon', {
        points: '-4,-3.5 4,0 -4,3.5', class: 'j-trace-seta',
        transform: `translate(${t.p[k][0]} ${t.p[k][1]}) rotate(${ang.toFixed(0)})`,
      }));
    }

    // ---- toque
    // dedo: { id, ult: [x,y] | null, rastro: path do dedo, d: string, ultSnap }
    const ativos = new Map();

    function paraViewBox(ev) {
      const s = estado.svg;
      const r = s.getBoundingClientRect();
      const vb = s.viewBox.baseVal;
      return [((ev.clientX - r.left) / r.width) * vb.width + vb.x, ((ev.clientY - r.top) / r.height) * vb.height + vb.y];
    }

    function amostras(ev) {
      let lista = [];
      try { if (typeof ev.getCoalescedEvents === 'function') lista = ev.getCoalescedEvents(); } catch (e) { lista = []; }
      if (!lista.length) return [ev];
      const u = lista[lista.length - 1];
      return u.clientX === ev.clientX && u.clientY === ev.clientY ? lista : lista.concat([ev]);
    }

    function aoPressionar(ev) {
      if (concluindo || !estado) return;
      if (ev.pointerType === 'mouse' && ev.button > 0) return;
      try { estado.svg.setPointerCapture(ev.pointerId); } catch (e) { /* ok: o dedo continua chegando ao SVG */ }
      if (ev.cancelable) ev.preventDefault();
      limparDica();
      agendarDica();
      const dedo = { id: ev.pointerId, ult: null, d: '', ultSnap: null };
      dedo.rastro = svg('path', { d: '', class: 'j-trace-dedo' });
      estado.gDedo.append(dedo.rastro);
      ativos.set(ev.pointerId, dedo);
      for (const a of amostras(ev)) seguir(dedo, paraViewBox(a));
    }
    function aoMover(ev) {
      if (concluindo || !estado) return;
      let dedo = ativos.get(ev.pointerId);
      if (!dedo) {
        // pointerdown perdido (ex.: o navegador reiniciou o gesto): retoma sem exigir novo toque
        if (ev.pointerType === 'mouse' ? ev.buttons === 0 : ev.pressure === 0 && ev.buttons === 0) return;
        aoPressionar(ev);
        return;
      }
      if (ev.cancelable) ev.preventDefault();
      for (const a of amostras(ev)) seguir(dedo, paraViewBox(a));
    }
    function aoSoltar(ev) {
      const dedo = ativos.get(ev.pointerId);
      if (!dedo) return;
      ativos.delete(ev.pointerId); // o progresso (pontos cobertos) é mantido, também no pointercancel
      try { estado.svg.releasePointerCapture(ev.pointerId); } catch (e) { /* ok */ }
      const r = dedo.rastro;
      r.classList.add('j-some-dedo');
      ciclo.depois(() => r.remove(), 1400);
      agendarDica();
    }

    // um ponto novo do dedo: desenha o rastro (com ímã) e cobre os pontos de controle
    function seguir(dedo, p) {
      const e = estado;
      if (!e || concluindo) return;
      const raio = RAIO_PX / e.px;
      const a = dedo.ult || p;
      dedo.ult = p;
      // 1) rastro visível, grudando no caminho mais próximo quando está perto
      const alvo = pontoNoCaminho(p, ATRACAO_PX / e.px);
      const q = alvo ? [alvo.x, alvo.y] : p;
      const salta = dedo.ultSnap && (alvo ? alvo.i !== dedo.ultSnap.i && Math.hypot(q[0] - dedo.ultSnap.q[0], q[1] - dedo.ultSnap.q[1]) > raio * 1.4 : false);
      dedo.d += (!dedo.d || salta ? 'M' : 'L') + `${r1(q[0])} ${r1(q[1])}`;
      if (dedo.d.length < 14) dedo.d += 'l.01 0';
      dedo.ultSnap = { q, i: alvo ? alvo.i : -1, alvo: !!alvo };
      if (dedo.d.length > 6000) dedo.d = `M${r1(q[0])} ${r1(q[1])}`;
      dedo.rastro.setAttribute('d', dedo.d);
      // 2) cobertura: pontos a até `raio` do trecho a→p, em qualquer ordem
      let mudou = false;
      for (const t of e.tracos) {
        if (t.feito) continue;
        let tocou = false;
        for (let k = 0; k < t.p.length; k++) {
          if (t.cob[k]) continue;
          if (sobreSegmento(t.p[k][0], t.p[k][1], a[0], a[1], p[0], p[1]).d <= raio) { t.cob[k] = true; t.n++; tocou = true; }
        }
        if (!tocou) continue;
        mudou = true;
        if (t.n >= Math.ceil(t.p.length * FRACAO)) { t.feito = true; t.cob.fill(true); t.n = t.p.length; desenharRastro(t); t.rastro.classList.add('j-pronto'); tracoCompleto(); }
        else desenharRastro(t);
        if (concluindo) break;
      }
      if (!mudou) return;
      e.svg.dataset.cobertos = e.tracos.reduce((n, t) => n + t.n, 0);
      limparDica();
      agendarDica();
    }

    function pontoNoCaminho(p, maximo) {
      let melhor = null;
      estado.tracos.forEach((t, i) => {
        for (let k = 1; k < t.p.length; k++) {
          const r = sobreSegmento(p[0], p[1], t.p[k - 1][0], t.p[k - 1][1], t.p[k][0], t.p[k][1]);
          if (r.d <= maximo && (!melhor || r.d < melhor.d)) melhor = { d: r.d, x: r.x, y: r.y, i };
        }
      });
      return melhor;
    }

    function tracoCompleto() {
      const e = estado;
      if (e.tracos.every((t) => t.feito)) { letraCompleta(); return; }
      efeito(ctx, 'pop');
      marcarGuia();
    }

    async function letraCompleta() {
      concluindo = true;
      clearTimeout(timerDica);
      const e = estado;
      e.svg.dataset.cobertos = e.svg.dataset.total;
      e.gGuia.innerHTML = '';
      const l = letraAtual;
      // na lição todas as letras são do currículo; no modo livre só as liberadas contam para o domínio
      if (!livre || ctx.letrasLiberadas.includes(l)) ctx.registrar({ letra: l, acertouPrimeira: true, jogo: ID });
      resultados.push({ letra: l, acertouPrimeira: true });
      e.svg.classList.add('j-trace-completa');
      cintilancia(palco, ciclo, 26);
      efeito(ctx, 'brilho');
      // letras do currículo: elogio, nome, pausa e som; as demais (h k q w x y): elogio e nome (sem som de letra)
      const fala = temSom(l) ? ['frase:trace_completo', 'nome:' + l, 'pausa:300', 'som:' + l] : ['frase:trace_completo', 'nome:' + l];
      await ciclo.aguardar(ctx.audio.falar(fala));
      await ciclo.esperar(900);
      e.pronto();
    }

    async function fim() {
      palco.innerHTML = '';
      concluindo = true;
      await terminarRodada({ ctx, ciclo, jogo: ID, itens: resultados, raiz });
    }

    // ---- lição: o par da letra foco e o da revisão
    async function rodadaLicao() {
      letras = escolherLetras(dados);
      progresso.caixa.replaceChildren(...Array.from({ length: letras.length }, () => el('span', { class: 'j-ponto' })));
      if (!letras.length) return ctx.aoTerminar({ jogo: ID, itens: [] });
      for (let i = 0; i < letras.length; i++) {
        progresso.marcar(i);
        await tracarLetra(letras[i]);
      }
      progresso.marcar(letras.length);
      await fim();
    }

    // ---- modo livre: grade com as 26 letras
    function falarEscolher() { ctx.audio.falar(['frase:trace_escolher']); }

    function mostrarGrade() {
      estado = null; letraAtual = null; concluindo = false;
      raiz.classList.add('j-em-grade');
      aoOuvir = falarEscolher;
      const grade = el('div', { class: 'j-grade-letras', role: 'group', 'aria-label': 'Letras' });
      let ocupado = false;
      for (const l of ALFABETO) {
        if (!dados.letras[l]) continue;
        const feita = tracadas.has(l);
        const b = el('button', {
          type: 'button', 'data-letra': l, 'aria-label': 'Letra ' + l.toUpperCase(),
          class: 'j-cartao j-cartao-letra' + (ctx.letrasLiberadas.includes(l) ? ' j-liberada' : '') + (feita ? ' j-tracada' : ''),
        }, el('span', { class: 'j-par', 'aria-hidden': 'true' },
          el('span', { class: 'j-mai' }, l.toUpperCase()), el('span', { class: 'j-min' }, l)));
        if (feita) {
          const m = svg('svg', { viewBox: '0 0 24 24', class: 'j-marca', 'aria-hidden': 'true' });
          m.append(svg('polygon', { points: pts(estrela(12, 13, 11)) }));
          b.append(m);
        }
        aoTocar(ciclo, b, () => { if (!ocupado) { ocupado = true; escolherLetra(l); } });
        grade.append(b);
      }
      // o botão de ouvir e os pontinhos ocupam as duas últimas células da grade (sem barra no topo)
      progresso.marcar(tracadas.size);
      grade.append(el('div', { class: 'j-celula' }, botaoOuvir), el('div', { class: 'j-celula' }, progresso.caixa));
      palco.replaceChildren(grade);
      falarEscolher();
    }

    async function escolherLetra(l) {
      if (temSom(l)) await ciclo.aguardar(ctx.audio.falar(['som:' + l]));
      raiz.classList.remove('j-em-grade');
      topo.replaceChildren(progresso.caixa, botaoOuvir);
      progresso.marcar(tracadas.size);
      await tracarLetra(l);
      tracadas.add(l);
      progresso.marcar(tracadas.size);
      if (tracadas.size >= RODADA_LIVRE) return fim();
      mostrarGrade();
    }

    // acompanha o tamanho da área (girar o aparelho, barra do navegador): refaz a escala sem perder o progresso
    let observador = null;
    if (typeof ResizeObserver === 'function') {
      observador = new ResizeObserver(() => ajustar(false));
      observador.observe(palco);
    } else ciclo.ouvir(window, 'resize', () => ajustar(false));

    carregarTracados().then((d) => {
      if (!ciclo.vivo) return;
      dados = d;
      if (livre) { progresso.marcar(0); mostrarGrade(); return null; }
      return rodadaLicao();
    }).catch((e) => { console.warn('[trace] não foi possível carregar os traçados', e); });

    return { destruir() { if (observador) observador.disconnect(); desmontar(raiz, ctx, ciclo); raiz.classList.remove('j-livre', 'j-em-grade'); } };
  },
};
