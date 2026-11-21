// Lição de uma letra: apresentação e depois os jogos em sequência, com recompensas.
import { el, imagem, botaoIcone, botaoOuvir, quadro } from '../ui.js';
import { executarJogo } from './jogo.js';
import { mostrarRecompensa } from './recompensa.js';

const SEQUENCIA = ['escute', 'caca', 'trace', 'junte'];
const NOMES_JOGOS = { escute: 'Escute e Toque', caca: 'Caça-Som', trace: 'Trace a Letra', junte: 'Junte os Sons' };

export default {
  montar(raiz, app, params) {
    const letra = params.letra;
    const info = app.curriculo.letras[letra] || {};
    const guia = app.progresso.guia() || 'lumi';
    let vivo = true;
    let jogoAtual = null;

    const q = quadro(app, raiz, { aoCasa: () => app.ir('trilha') });
    const palco = q.palco;
    const maius = info.maiuscula || letra.toUpperCase();

    // passo a passo para a adulta: "Lição da letra A · 2 de 4 · Caça-Som" e bolinhas
    let seq = SEQUENCIA.slice();
    const textoPasso = el('div', { classe: 'passos-texto' });
    const bolinhas = el('div', { classe: 'passos-bolinhas', attrs: { 'aria-hidden': 'true' } });
    const passos = el('div', { classe: 'passos', attrs: { 'data-i': 'indicador', id: 'passos-licao' } }, textoPasso, bolinhas);
    q.tela.insertBefore(passos, palco);
    function pintar(passo) { // 0 = conhecendo a letra; 1..n = jogo; n+1 = concluída
      const n = seq.length;
      let t = `Lição da letra ${maius}`;
      if (passo === 0) t += ' · Conhecendo a letra';
      else if (passo > n) t += ' · Concluída';
      else t += ` · ${passo} de ${n} · ${NOMES_JOGOS[seq[passo - 1]] || ''}`;
      textoPasso.textContent = t;
      bolinhas.replaceChildren(...seq.map((_, i) => el('span', { classe: `bolinha${i + 1 < passo ? ' feita' : ''}${i + 1 === passo ? ' atual' : ''}` })));
    }
    pintar(0);
    // só conta os jogos que estão disponíveis para esta letra (o Junte não aparece na letra A)
    const preparo = (async () => {
      const lib = app.progresso.letrasLiberadas();
      const ok = [];
      for (const id of SEQUENCIA) {
        try {
          const j = await app.carregarJogo(id);
          if (j && j.disponivel(lib, app.curriculo)) ok.push(id);
        } catch (e) { /* jogo ausente: fica de fora */ }
      }
      if (ok.length) seq = ok;
      if (vivo && passoAtual === 0) pintar(0);
    })();
    let passoAtual = 0;
    const regras = app.progresso.getRegras();

    function apresentar() {
      return new Promise((resolver) => {
        const palavra = (info.palavras && info.palavras[0]) || null;
        const fala = ['frase:apresentar_letra', `som:${letra}`, 'pausa:400', 'frase:repita_comigo', `som:${letra}`];
        if (palavra) fala.push('pausa:600', 'frase:como_no_comeco', `pal:${palavra}`);
        const gigante = el('button', { type: 'button', classe: 'letra-gigante', attrs: { 'aria-label': 'Ouvir o som da letra' }, texto: info.maiuscula || letra.toUpperCase() });
        gigante.addEventListener('click', () => app.audio.falar([`som:${letra}`]));
        const fig = el('div', { classe: 'figura-licao' });
        if (palavra) fig.append(imagem(`assets/svg/figuras/${palavra}.svg`));
        const ouvir = botaoOuvir(() => app.audio.falar(fala));
        const continuar = botaoIcone({
          src: 'assets/svg/ui/continuar.svg', rotulo: 'Continuar', texto: 'Continuar', glifo: '▶', classe: 'grande pulsa',
          aoClicar: () => { continuar.disabled = true; resolver(); },
        });
        palco.replaceChildren(
          el('div', { classe: 'apresenta' }, gigante, fig),
          el('div', { classe: 'rodape' }, ouvir, continuar),
        );
        app.audio.falar(fala);
      });
    }

    async function fluxo() {
      await apresentar();
      await preparo;
      if (!vivo) return;
      let feitos = 0;
      for (const id of seq) {
        const letras = app.progresso.escolherLetrasRodada(regras.itensPorRodada, letra);
        passoAtual = feitos + 1;
        pintar(passoAtual);
        jogoAtual = executarJogo(app, palco, id, { letras, letraFoco: letra });
        const r = await jogoAtual.promessa;
        jogoAtual = null;
        if (!vivo) return;
        if (!r.ok) continue; // jogo ausente ou indisponível: pula sem quebrar
        feitos++;
        const ultimo = id === SEQUENCIA[SEQUENCIA.length - 1];
        if (ultimo) break; // o último jogo vai direto para a recompensa final
        await mostrarRecompensa(app, palco, 'estrela');
        if (!vivo) return;
        if (app.sessaoExcedida()) return app.ir('despedida');
      }
      // fim da lição: concha (Marola) ou chifre (Lumi)
      pintar(seq.length + 1);
      const nova = app.progresso.verificarAvanco();
      const dominada = app.progresso.estadoLetra(letra) === 'dominada';
      const nota = nova
        ? `Letra ${maius} dominada! A próxima letra foi liberada.`
        : dominada
          ? `Letra ${maius} dominada!`
          : `Mais um pouco de prática com a letra ${maius} na próxima vez.`;
      await mostrarRecompensa(app, palco, guia === 'marola' ? 'concha' : 'chifre', { nota });
      if (!vivo) return;
      if (app.sessaoExcedida()) return app.ir('despedida');
      app.ir('trilha', nova ? { novaLetra: nova } : {});
    }
    fluxo();

    return {
      destruir() {
        vivo = false;
        if (jogoAtual) jogoAtual.destruir();
      },
    };
  },
};
