// Jogo 4: Trace a Letra. A criança passa o dedo sobre a letra pontilhada, na ordem dos traços.
import {
  aoTocar, el, urlAsset, criarCiclo, criarBotaoOuvir, criarProgresso, embaralhar, efeito, cintilancia,
  terminarRodada, desmontar,
} from './comum.js';

const ID = 'trace';
const NS = 'http://www.w3.org/2000/svg';
const RAIO = 17;      // tolerância (viewBox 0..200, ~27 px na tela) para "pegar" o próximo ponto
const LARGURA_PAR = 100; // a minúscula fica 100 unidades à direita da maiúscula
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz'.split('');
const RODADA_LIVRE = 3;  // letras traçadas no modo livre até a recompensa
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
    const livre = ctx.modo === 'livre';
    const resultados = [];
    const tracadas = new Set();
    let dados = null;
    let letraAtual = null;
    let estado = null; // { tracos, iTraco, iPonto, trilhas, gGuia, svg }
    let pointerId = null;
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

    // ---- uma letra: maiúscula e minúscula lado a lado; devolve uma promessa que resolve ao terminar
    function tracarLetra(letra) {
      return new Promise((resolver) => {
        letraAtual = letra;
        concluindo = false;
        const def = dados.letras[letra];
        const grupos = [def.tracos];
        if (def.minuscula && def.minuscula.tracos) {
          grupos.push(def.minuscula.tracos.map((t) => t.map(([x, y]) => [+(x + LARGURA_PAR).toFixed(1), y])));
        }
        const tracos = grupos.flat();
        palco.innerHTML = '';
        const largura = grupos.length > 1 ? 200 : 100;
        const s = svg('svg', {
          viewBox: `0 0 ${largura} 100`, class: 'j-trace-svg', role: 'img', 'aria-label': 'Letra para traçar',
          'data-largura': largura,
        });
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
        estado = { tracos, iTraco: 0, iPonto: 0, trilhas, gGuia, svg: s, pronto: resolver };
        aoOuvir = falarInstrucao;
        marcarGuia();
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

    // Estrelinha no início do traço atual e seta de direção.
    function marcarGuia() {
      const { gGuia, tracos, iTraco } = estado;
      gGuia.innerHTML = '';
      const t = tracos[iTraco];
      if (!t) return;
      const [x, y] = t[0];
      gGuia.append(svg('polygon', { points: pts(estrela(x, y, 8)), class: 'j-trace-estrela' }));
      const k = Math.min(4, t.length - 1);
      const a = t[Math.max(0, k - 1)], b = t[Math.min(t.length - 1, k + 1)];
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      gGuia.append(svg('polygon', {
        points: '-4,-3.5 4,0 -4,3.5', class: 'j-trace-seta',
        transform: `translate(${t[k][0]} ${t[k][1]}) rotate(${ang.toFixed(0)})`,
      }));
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
      e.trilhas[e.iTraco].setAttribute('points', pts(t.slice(0, e.iPonto)));
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
      const e = estado;
      e.gGuia.innerHTML = '';
      const l = letraAtual;
      // na lição todas as letras são do currículo; no modo livre só as liberadas contam para o domínio
      if (!livre || ctx.letrasLiberadas.includes(l)) ctx.registrar({ letra: l, acertouPrimeira: true, jogo: ID });
      resultados.push({ letra: l, acertouPrimeira: true });
      e.svg.classList.add('j-trace-completa');
      cintilancia(palco, ciclo, 26);
      efeito(ctx, 'brilho');
      await ciclo.aguardar(ctx.audio.falar(['frase:trace_completo', ...somDe(l)]));
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

    carregarTracados().then((d) => {
      if (!ciclo.vivo) return;
      dados = d;
      if (livre) { progresso.marcar(0); mostrarGrade(); return null; }
      return rodadaLicao();
    }).catch((e) => { console.warn('[trace] não foi possível carregar os traçados', e); });

    return { destruir() { desmontar(raiz, ctx, ciclo); raiz.classList.remove('j-livre', 'j-em-grade'); } };
  },
};
