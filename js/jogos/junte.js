// Jogo 3: Junte os Sons. A sereia Marola nada de bloco em bloco; cada bloco acende e soa;
// no fim os blocos se juntam. Nas palavras, a criança ainda escolhe a figura certa.
import {
  el, imagem, urlAsset, criarCiclo, criarTrava, aoTocar, criarCartao, criarBotaoOuvir,
  criarProgresso, criarElogio, embaralhar, escolherDistratoresPalavras, itensPorRodada,
  efeito, festejar, errarSuave, terminarRodada, desmontar, cintilancia,
} from './comum.js';

const ID = 'junte';

function letrasDaPalavra(cur, p) {
  return (p.silabas || []).flatMap((s) => cur.silabas?.[s]?.letras || []);
}
function todasLiberadas(letras, lib) {
  return letras.length > 0 && letras.every((l) => lib.includes(l));
}
function candidatos(lib, cur) {
  const silabas = Object.entries(cur.silabas || {})
    .filter(([, s]) => todasLiberadas(s.letras || [], lib))
    .map(([id, s]) => ({ tipo: 'silaba', id, letras: s.letras }));
  const palavras = Object.entries(cur.palavras || {})
    .filter(([, p]) => p.juntar && p.figura && (p.silabas || []).every((s) => cur.silabas?.[s])
      && todasLiberadas(letrasDaPalavra(cur, p), lib))
    .map(([id, p]) => ({ tipo: 'palavra', id, letras: letrasDaPalavra(cur, p), inicial: p.inicial }));
  return { silabas, palavras };
}

// Foco primeiro (embaralhado), depois o resto (embaralhado).
function ordenarPorFoco(lista, foco) {
  const com = embaralhar(lista.filter((i) => foco && i.letras.includes(foco)));
  const sem = embaralhar(lista.filter((i) => !(foco && i.letras.includes(foco))));
  return com.concat(sem);
}

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-junte.svg',
  disponivel(letrasLiberadas, curriculo) {
    if (!curriculo) return false;
    const c = candidatos(letrasLiberadas || [], curriculo);
    return c.silabas.length + c.palavras.length > 0;
  },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const trava = criarTrava();
    const elogio = criarElogio();
    const cur = ctx.curriculo;
    const N = itensPorRodada(ctx);
    const resultados = [];

    // ---- escolha dos itens da rodada: alterna sílaba e palavra quando há as duas
    const c = candidatos(ctx.letrasLiberadas, cur);
    const poolS = ordenarPorFoco(c.silabas, ctx.letraFoco);
    const poolP = ordenarPorFoco(c.palavras, ctx.letraFoco);
    const itens = [];
    for (let i = 0; i < N; i++) {
      const pool = poolS.length && poolP.length ? (i % 2 === 0 ? poolS : poolP) : (poolS.length ? poolS : poolP);
      const usados = itens.filter((x) => pool.includes(x)).length;
      itens.push(pool[usados % pool.length]);
    }

    let indice = -1;
    let atual = null;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-junte');
    raiz.style.setProperty('--cenario-mar', `url("${urlAsset('assets/svg/cenarios/mar.svg')}")`);
    const progresso = criarProgresso(N);
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => ouvirDeNovo() });
    const topo = el('div', { class: 'j-topo' }, progresso.caixa, botaoOuvir);
    const pista = el('div', { class: 'j-pista' });
    const sereia = el('button', { type: 'button', class: 'j-sereia', aria: 'Marola, toque para ela nadar' },
      imagem('assets/svg/personagens/marola-nadando.svg'));
    const linha = el('div', { class: 'j-blocos' });
    pista.append(sereia, linha);
    const escolhas = el('div', { class: 'j-opcoes j-opcoes-junte' });
    raiz.append(topo, pista, escolhas);

    aoTocar(ciclo, sereia, () => avancar());

    function ouvirDeNovo() {
      if (!atual) return;
      if (atual.fase === 'escolha') {
        ctx.audio.falar([...atual.falasBlocos, 'pal:' + atual.item.id]);
      } else if (atual.fase === 'nadar') {
        ctx.audio.falar(['frase:junte_instrucao']);
      }
    }

    function centralizarSereiaSobre(alvo) {
      const rp = pista.getBoundingClientRect();
      const ra = alvo.getBoundingClientRect();
      const x = ra.left - rp.left + ra.width / 2 - sereia.offsetWidth / 2;
      sereia.style.setProperty('--x', Math.max(0, Math.round(x)) + 'px');
    }

    function proximo() {
      indice++;
      progresso.marcar(indice);
      if (indice >= N) return fim();
      const item = itens[indice];
      const ehPalavra = item.tipo === 'palavra';
      // blocos: letras (som:x) nas sílabas; sílabas (sil:xx) nas palavras
      let blocos;
      if (ehPalavra) {
        blocos = cur.palavras[item.id].silabas.map((s) => ({
          texto: (cur.silabas[s].texto || s).toUpperCase(), fala: 'sil:' + s,
        }));
      } else {
        blocos = cur.silabas[item.id].letras.map((l) => ({ texto: l.toUpperCase(), fala: 'som:' + l }));
      }
      atual = {
        item, ehPalavra, blocos, passo: 0, errou: false, fase: 'nadar',
        falasBlocos: blocos.map((b) => b.fala), els: [], cartoes: [], certo: null,
      };
      linha.innerHTML = '';
      linha.classList.remove('j-juntos');
      linha.dataset.qtd = String(blocos.length);
      escolhas.innerHTML = '';
      escolhas.classList.remove('j-visivel');
      sereia.classList.remove('j-aponta');
      sereia.style.setProperty('--x', '0px');
      blocos.forEach((b) => {
        const e = el('div', { class: 'j-bloco', 'aria-hidden': 'true', dataset: { len: String(b.texto.length) } }, el('span', { class: 'j-letra' }, b.texto));
        aoTocar(ciclo, e, () => avancar());
        atual.els.push(e);
        linha.append(e);
      });
      trava.ocupado = false;
      ctx.audio.falar(['frase:junte_instrucao']);
    }

    async function avancar() {
      if (trava.ocupado || !atual || atual.fase !== 'nadar') return;
      trava.ocupado = true;
      const a = atual;
      const bloco = a.els[a.passo];
      centralizarSereiaSobre(bloco);
      sereia.classList.add('j-nada');
      await ciclo.esperar(650);
      sereia.classList.remove('j-nada');
      bloco.classList.add('j-aceso');
      efeito(ctx, 'bolha');
      await ciclo.aguardar(ctx.audio.falar([a.falasBlocos[a.passo]]));
      a.passo++;
      if (a.passo < a.blocos.length) { trava.ocupado = false; return; }
      await juntar();
    }

    async function juntar() {
      const a = atual;
      await ciclo.esperar(250);
      linha.classList.add('j-juntos');
      centralizarSereiaSobre(linha);
      efeito(ctx, 'brilho');
      await ciclo.esperar(700);
      cintilancia(pista, ciclo, 14);
      const final = (a.ehPalavra ? 'pal:' : 'sil:') + a.item.id;
      await ciclo.aguardar(ctx.audio.falar(['frase:junte_resultado', final]));
      if (!a.ehPalavra) {
        // sílabas são prática livre: não registram
        resultados.push({ letra: a.item.letras[0], acertouPrimeira: true });
        await ciclo.esperar(600);
        return proximo();
      }
      mostrarEscolhas();
    }

    // Depois de juntar uma palavra: duas figuras, a certa e uma outra; a sereia aponta.
    function mostrarEscolhas() {
      const a = atual;
      const id = a.item.id;
      const inicial = a.item.inicial;
      a.fase = 'escolha';
      const outro = escolherDistratoresPalavras(ctx, inicial, id, 1)[0];
      const opcoes = embaralhar([id, outro].filter(Boolean));
      escolhas.innerHTML = '';
      opcoes.forEach((pid) => {
        const p = cur.palavras[pid];
        const cartao = criarCartao({
          ciclo, conteudo: imagem(p.figura, 'j-figura'), aria: 'Figura de ' + (p.texto || pid).toLowerCase(),
          aoEscolher: (cc) => escolher(cc, pid),
        });
        cartao.dataset.palavra = pid;
        if (pid === id) a.certo = cartao;
        a.cartoes.push(cartao);
        escolhas.append(cartao);
      });
      escolhas.dataset.qtd = String(opcoes.length);
      escolhas.classList.add('j-visivel');
      sereia.classList.add('j-aponta');
      trava.ocupado = false;
    }

    async function escolher(cartao, pid) {
      const a = atual;
      if (trava.ocupado || !a || a.fase !== 'escolha') return;
      trava.ocupado = true;
      if (pid !== a.item.id) {
        a.errou = true;
        await errarSuave({
          ctx, ciclo, cartao, cartoes: a.cartoes, certo: a.certo,
          fala: ['frase:quase', ...a.falasBlocos, 'pal:' + a.item.id],
        });
        trava.ocupado = false;
        return;
      }
      a.fase = 'feito';
      const acertouPrimeira = !a.errou;
      ctx.registrar({ letra: a.item.inicial, acertouPrimeira, jogo: ID });
      resultados.push({ letra: a.item.inicial, acertouPrimeira });
      a.cartoes.forEach((x) => { if (x !== cartao) x.classList.add('j-fora'); });
      festejar(cartao);
      cartao.classList.add('j-grande');
      efeito(ctx, 'brilho');
      await ciclo.aguardar(ctx.audio.falar([elogio()]));
      await ciclo.esperar(500);
      proximo();
    }

    async function fim() {
      atual = null;
      linha.innerHTML = '';
      escolhas.innerHTML = '';
      trava.ocupado = true;
      await terminarRodada({ ctx, ciclo, jogo: ID, itens: resultados, raiz });
    }

    proximo();

    return { destruir() { desmontar(raiz, ctx, ciclo); } };
  },
};
