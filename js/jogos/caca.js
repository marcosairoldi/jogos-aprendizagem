// Jogo 2: Caça-Som. A criança ouve o som e toca a figura que começa com ele.
import {
  el, imagem, criarCiclo, criarTrava, criarCartao, criarBotaoOuvir, criarProgresso, criarElogio,
  embaralhar, sequenciaAlvos, escolherDistratoresPalavras, itensPorRodada, efeito, festejar,
  errarSuave, terminarRodada, desmontar,
} from './comum.js';

const ID = 'caca';

// Palavras (com figura) de uma letra.
function palavrasDaLetra(cur, letra) {
  const ids = cur.letras[letra]?.palavras || [];
  return ids.filter((id) => cur.palavras?.[id]?.figura);
}

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-caca.svg',
  disponivel(letrasLiberadas, curriculo) {
    if (!curriculo?.letras) return false;
    return (letrasLiberadas || []).some((l) => palavrasDaLetra(curriculo, l).length > 0);
  },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const trava = criarTrava();
    const elogio = criarElogio();
    const cur = ctx.curriculo;
    const N = itensPorRodada(ctx);
    const validas = ctx.letras.filter((l) => palavrasDaLetra(cur, l).length > 0);
    const alvos = sequenciaAlvos(ctx, N, validas);
    const resultados = [];
    const ultimas = {};
    let indice = -1;
    let atual = null;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-caca');
    const progresso = criarProgresso(N);
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => perguntar(false) });
    const topo = el('div', { class: 'j-topo' }, progresso.caixa, botaoOuvir);
    const area = el('div', { class: 'j-opcoes j-opcoes-figuras' });
    raiz.append(topo, area);

    function perguntar(primeira) {
      if (!atual) return;
      const fala = ['frase:caca_pergunta', 'som:' + atual.alvo];
      if (primeira) fala.unshift('frase:caca_instrucao', 'pausa:300');
      ctx.audio.falar(fala);
    }

    function proximo() {
      indice++;
      progresso.marcar(indice);
      if (indice >= N) return fim();
      const alvo = alvos[indice];
      const lista = palavrasDaLetra(cur, alvo);
      const preferidas = lista.filter((p) => p !== ultimas[alvo]);
      const palavra = embaralhar(preferidas.length ? preferidas : lista)[0];
      ultimas[alvo] = palavra;
      const distratores = escolherDistratoresPalavras(ctx, alvo, palavra, 2);
      const opcoes = embaralhar([palavra, ...distratores]);
      area.innerHTML = '';
      const cartoes = [];
      atual = { alvo, palavra, errou: false, cartoes, certo: null };
      opcoes.forEach((id) => {
        const p = cur.palavras[id];
        const c = criarCartao({
          ciclo, conteudo: imagem(p.figura, 'j-figura'), aria: 'Figura de ' + (p.texto || id).toLowerCase(),
          aoEscolher: (cartao) => escolher(cartao, id),
        });
        c.dataset.palavra = id;
        if (id === palavra) atual.certo = c;
        cartoes.push(c);
        area.append(c);
      });
      area.dataset.qtd = String(opcoes.length);
      trava.ocupado = false;
      perguntar(indice === 0);
    }

    async function escolher(cartao, id) {
      if (trava.ocupado || !atual) return;
      trava.ocupado = true;
      const { alvo, palavra } = atual;
      if (id !== palavra) {
        atual.errou = true;
        await errarSuave({
          ctx, ciclo, cartao, cartoes: atual.cartoes, certo: atual.certo,
          fala: ['frase:quase', 'som:' + alvo],
        });
        trava.ocupado = false;
        return;
      }
      const acertouPrimeira = !atual.errou;
      ctx.registrar({ letra: alvo, acertouPrimeira, jogo: ID });
      resultados.push({ letra: alvo, acertouPrimeira });
      atual.cartoes.forEach((c) => { if (c !== cartao) c.classList.add('j-fora'); });
      festejar(cartao);
      efeito(ctx, 'brilho');
      await ciclo.aguardar(ctx.audio.falar(['pal:' + palavra, 'pausa:150', 'som:' + alvo, 'pausa:200', elogio()]));
      await ciclo.esperar(450);
      proximo();
    }

    async function fim() {
      area.innerHTML = '';
      atual = null;
      trava.ocupado = true;
      await terminarRodada({ ctx, ciclo, jogo: ID, itens: resultados, raiz });
    }

    proximo();

    return { destruir() { desmontar(raiz, ctx, ciclo); } };
  },
};
