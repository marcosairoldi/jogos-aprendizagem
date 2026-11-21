// Jogo 1: Escute e Toque. A criança ouve o som e toca a letra que o faz.
import {
  el, imagem, criarCiclo, criarTrava, criarCartao, criarBotaoOuvir, criarProgresso, criarElogio,
  embaralhar, sequenciaAlvos, numeroOpcoes, escolherDistratoresLetras, letrasDisponiveisTotal,
  itensPorRodada, efeito, festejar, errarSuave, terminarRodada, desmontar,
} from './comum.js';

const ID = 'escute';

export default {
  id: ID,
  icone: 'assets/svg/ui/jogo-escute.svg',
  disponivel(letrasLiberadas) { return (letrasLiberadas || []).length >= 1; },

  iniciar(raiz, ctx) {
    const ciclo = criarCiclo();
    const trava = criarTrava();
    const elogio = criarElogio();
    const N = itensPorRodada(ctx);
    const validas = ctx.letras.filter((l) => ctx.curriculo.letras[l]);
    const alvos = sequenciaAlvos(ctx, N, validas);
    const resultados = [];
    let indice = -1;
    let atual = null;

    raiz.innerHTML = '';
    raiz.classList.add('jogo', 'jogo-escute');
    const progresso = criarProgresso(N);
    const botaoOuvir = criarBotaoOuvir({ ciclo, aoOuvir: () => perguntar(false) });
    const topo = el('div', { class: 'j-topo' }, progresso.caixa, botaoOuvir);
    const area = el('div', { class: 'j-opcoes j-opcoes-letras' });
    raiz.append(topo, area);

    function perguntar(primeira) {
      if (!atual) return;
      const fala = ['frase:escute_pergunta', 'som:' + atual.alvo];
      if (primeira) fala.unshift('frase:escute_instrucao', 'pausa:300');
      ctx.audio.falar(fala);
    }

    function proximo() {
      indice++;
      progresso.marcar(indice);
      if (indice >= N) return fim();
      const alvo = alvos[indice];
      const total = letrasDisponiveisTotal(ctx);
      const qtd = numeroOpcoes(ctx, alvo, total);
      const opcoes = embaralhar([alvo, ...escolherDistratoresLetras(ctx, alvo, qtd - 1)]);
      area.innerHTML = '';
      const cartoes = [];
      atual = { alvo, errou: false, cartoes, certo: null };
      opcoes.forEach((letra) => {
        const c = criarCartao({
          ciclo, conteudo: letra.toUpperCase(), aria: 'Letra',
          aoEscolher: (cartao) => escolher(cartao, letra),
        });
        c.dataset.letra = letra;
        if (letra === alvo) atual.certo = c;
        cartoes.push(c);
        area.append(c);
      });
      area.dataset.qtd = String(opcoes.length);
      trava.ocupado = false;
      perguntar(indice === 0);
    }

    async function escolher(cartao, letra) {
      if (trava.ocupado || !atual) return;
      trava.ocupado = true;
      const { alvo } = atual;
      if (letra !== alvo) {
        atual.errou = true;
        await errarSuave({
          ctx, ciclo, cartao, cartoes: atual.cartoes, certo: atual.certo,
          fala: ['frase:quase', 'som:' + alvo],
        });
        trava.ocupado = false;
        return;
      }
      // acerto
      const acertouPrimeira = !atual.errou;
      ctx.registrar({ letra: alvo, acertouPrimeira, jogo: ID });
      resultados.push({ letra: alvo, acertouPrimeira });
      atual.cartoes.forEach((c) => { if (c !== cartao) c.classList.add('j-fora'); });
      festejar(cartao);
      efeito(ctx, 'brilho');
      await ciclo.aguardar(ctx.audio.falar([elogio(), 'som:' + alvo]));
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
