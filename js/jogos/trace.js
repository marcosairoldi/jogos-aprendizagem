// Jogo 4: Trace a Letra. A criança passa o dedo sobre a letra pontilhada, na ordem dos traços.
import {
  el, urlAsset, criarCiclo, criarBotaoOuvir, criarProgresso, embaralhar, efeito, cintilancia,
  terminarRodada, desmontar,
} from './comum.js';

const ID = 'trace';
const NS = 'http://www.w3.org/2000/svg';
const RAIO = 14;      // tolerância (viewBox 0..100) para "pegar" o próximo ponto
const OLHAR_ADIANTE = 5; // aceita pular até 5 pontos se o dedo foi rápido

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
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function estrela(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push([(cx + rr * Math.cos(a)).toFixed(1), (cy + rr * Math.sin(a)).toFixed(1)]);
  }
  return p;
}

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-trace.svg',
  disponivel(letrasLiberadas) { return (letrasLiberadas || []).length >= 1; },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const resultados = [];
    let dados = null;
    let letraAtual = null;
    let estado = null; // { tracos, iTraco, iPonto, trilha, grupos... }
    let pointerId = null;
    let concluindo = false;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-trace');

    // ---- letras da rodada: foco (ou a primeira) e uma revisão
    function escolherLetras(tracados) {
      const tem = (l) => tracados.letras[l];
      const base = ctx.letraFoco && tem(ctx.letraFoco) ? ctx.letraFoco : ctx.letras.find(tem);
      if (!base) return [];
      const outras = embaralhar(ctx.letras.concat(ctx.letrasLiberadas).filter((l) => l !== base && tem(l)));
      return outras.length ? [base, outras[0]] : [base];
    }

    let letras = [];
    let indice = -1;
    const progresso = criarProgresso(2);
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => falarInstrucao() });
    const topo = el('div', { class: 'j-topo' }, progresso.caixa, botaoOuvir);
    const palco = el('div', { class: 'j-palco' });
    raiz.append(topo, palco);

    function falarInstrucao() {
      if (letraAtual) ctx.audio.falar(['frase:trace_instrucao', 'som:' + letraAtual]);
    }

    function montarLetra() {
      indice++;
      progresso.marcar(indice);
      if (indice >= letras.length) return fim();
      letraAtual = letras[indice];
      concluindo = false;
      const tracos = dados.letras[letraAtual].tracos;
      palco.innerHTML = '';
      const s = svg('svg', { viewBox: dados.viewBox || '0 0 100 100', class: 'j-trace-svg', role: 'img', 'aria-label': 'Letra para traçar' });
      const gFundo = svg('g'), gRastro = svg('g'), gGuia = svg('g');
      s.append(gFundo, gRastro, gGuia);
      const trilhas = [];
      tracos.forEach((t) => {
        gFundo.append(svg('polyline', { points: pts(t), class: 'j-trace-faixa' }));
        gFundo.append(svg('polyline', { points: pts(t), class: 'j-trace-pontos' }));
        const rastro = svg('polyline', { points: '', class: 'j-trace-rastro' });
        gRastro.append(rastro);
        trilhas.push(rastro);
      });
      palco.append(s);
      estado = { tracos, iTraco: 0, iPonto: 0, trilhas, gGuia, svg: s, feitos: [] };
      marcarGuia();
      s.addEventListener('pointerdown', aoPressionar);
      s.addEventListener('pointermove', aoMover);
      s.addEventListener('pointerup', aoSoltar);
      s.addEventListener('pointercancel', aoSoltar);
      falarInstrucao();
    }

    // Estrelinha no início do traço atual e seta de direção.
    function marcarGuia() {
      const { gGuia, tracos, iTraco } = estado;
      gGuia.innerHTML = '';
      const t = tracos[iTraco];
      if (!t) return;
      const [x, y] = t[0];
      const e = svg('polygon', { points: pts(estrela(x, y, 8)), class: 'j-trace-estrela' });
      gGuia.append(e);
      const k = Math.min(4, t.length - 1);
      const a = t[Math.max(0, k - 1)], b = t[Math.min(t.length - 1, k + 1)];
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const seta = svg('polygon', {
        points: '-4,-3.5 4,0 -4,3.5', class: 'j-trace-seta',
        transform: `translate(${t[k][0]} ${t[k][1]}) rotate(${ang.toFixed(0)})`,
      });
      gGuia.append(seta);
    }

    function paraViewBox(ev) {
      const r = estado.svg.getBoundingClientRect();
      const vb = estado.svg.viewBox.baseVal;
      return [((ev.clientX - r.left) / r.width) * vb.width + vb.x, ((ev.clientY - r.top) / r.height) * vb.height + vb.y];
    }

    function aoPressionar(ev) {
      if (concluindo || !estado) return;
      pointerId = ev.pointerId;
      try { estado.svg.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
      ev.preventDefault();
      progredir(paraViewBox(ev));
    }
    function aoMover(ev) {
      if (concluindo || !estado || ev.pointerId !== pointerId) return;
      progredir(paraViewBox(ev));
    }
    function aoSoltar(ev) {
      if (ev.pointerId === pointerId) pointerId = null; // o progresso é mantido
    }

    // Pega pontos de controle quando o dedo passa por perto, em ordem.
    function progredir(p) {
      const e = estado;
      const t = e.tracos[e.iTraco];
      if (!t) return;
      let pegou = false;
      for (;;) {
        let achou = -1;
        for (let k = 0; k < OLHAR_ADIANTE; k++) {
          const i = e.iPonto + k;
          if (i < t.length && dist(p, t[i]) <= RAIO) achou = i; // o mais adiante dentro da tolerância
        }
        if (achou < 0) break;
        e.iPonto = achou + 1;
        pegou = true;
        if (e.iPonto >= t.length) break;
      }
      if (!pegou) return;
      const feito = t.slice(0, e.iPonto);
      e.trilhas[e.iTraco].setAttribute('points', pts(feito));
      if (e.iPonto >= t.length) tracoCompleto();
    }

    function tracoCompleto() {
      const e = estado;
      e.trilhas[e.iTraco].setAttribute('points', pts(e.tracos[e.iTraco]));
      e.trilhas[e.iTraco].classList.add('j-pronto');
      e.iTraco++;
      e.iPonto = 0;
      if (e.iTraco < e.tracos.length) {
        efeito(ctx, 'pop');
        marcarGuia();
        return;
      }
      letraCompleta();
    }

    async function letraCompleta() {
      concluindo = true;
      estado.gGuia.innerHTML = '';
      const l = letraAtual;
      ctx.registrar({ letra: l, acertouPrimeira: true, jogo: ID });
      resultados.push({ letra: l, acertouPrimeira: true });
      estado.svg.classList.add('j-trace-completa');
      cintilancia(palco, ciclo, 26);
      efeito(ctx, 'brilho');
      await ciclo.aguardar(ctx.audio.falar(['frase:trace_completo', 'som:' + l]));
      await ciclo.esperar(900);
      montarLetra();
    }

    async function fim() {
      palco.innerHTML = '';
      concluindo = true;
      await terminarRodada({ ctx, ciclo, jogo: ID, itens: resultados, raiz });
    }

    carregarTracados().then((d) => {
      if (!ciclo.vivo) return;
      dados = d;
      letras = escolherLetras(d);
      progresso.caixa.replaceChildren(...Array.from({ length: letras.length }, () => el('span', { class: 'j-ponto' })));
      if (!letras.length) return ctx.aoTerminar({ jogo: ID, itens: [] });
      montarLetra();
    }).catch((e) => { console.warn('[trace] não foi possível carregar os traçados', e); });

    return { destruir() { desmontar(raiz, ctx, ciclo); } };
  },
};
