// Área dos pais: porta com conta de somar e painel para a adulta (aqui pode ter texto).
import { el, botaoIcone } from '../ui.js';

const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function novaConta() {
  const x = sorteio(2, 6);
  const y = sorteio(2, 6);
  const certa = x + y;
  const erradas = new Set();
  while (erradas.size < 2) {
    const e = certa + sorteio(-3, 3);
    if (e !== certa && e > 0) erradas.add(e);
  }
  const opcoes = [certa, ...erradas].sort(() => Math.random() - 0.5);
  return { x, y, certa, opcoes };
}

export default {
  montar(raiz, app) {
    const tela = el('section', { classe: 'tela rolavel pais' });
    raiz.append(tela);
    const voltar = () => app.ir('inicio');
    let temporizador = null;

    function porta() {
      const c = novaConta();
      const resp = el('div', { classe: 'respostas' });
      for (const o of c.opcoes) {
        const b = el('button', { type: 'button', classe: 'btn-texto', texto: String(o), attrs: { 'aria-label': `Resposta ${o}` } });
        b.addEventListener('click', () => (o === c.certa ? painel() : porta()));
        resp.append(b);
      }
      const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar ao início', glifo: '⌂', aoClicar: voltar });
      tela.className = 'tela rolavel pais porta';
      tela.replaceChildren(
        el('div', { estilo: 'align-self:flex-start' }, casa),
        el('h1', { texto: 'Área dos pais' }),
        el('p', { texto: 'Para entrar, resolva a conta:' }),
        el('div', { classe: 'conta', texto: `${c.x} + ${c.y} = ?` }),
        resp,
      );
    }

    function painel() {
      tela.className = 'tela rolavel pais';
      const rec = app.progresso;
      const letras = app.curriculo.ordem;
      const lib = rec.letrasLiberadas();
      const maiusc = (l) => (app.curriculo.letras[l] && app.curriculo.letras[l].maiuscula) || l.toUpperCase();
      const dominadas = lib.filter((l) => rec.estadoLetra(l) === 'dominada');
      const pratica = lib.filter((l) => rec.estadoLetra(l) !== 'dominada');
      const mostrarLetras = (arr, ok) => el('div', { classe: 'letras-pais' }, arr.length
        ? arr.map((l) => el('span', { classe: `l${ok ? ' ok' : ''}`, texto: maiusc(l) }))
        : [el('span', { classe: 'nota', texto: 'Nenhuma ainda.' })]);

      const voltarBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Voltar', attrs: { 'aria-label': 'Voltar' } });
      voltarBtn.addEventListener('click', voltar);

      const campo = el('input', { type: 'text', id: 'campo-nome', maxLength: 30, value: rec.nome(), attrs: { 'aria-label': 'Nome da criança', autocomplete: 'off', autocapitalize: 'words' } });
      campo.addEventListener('input', () => app.progresso.definirNome(campo.value));

      const trocar = el('button', { type: 'button', classe: 'btn-texto', texto: 'Trocar guia', attrs: { 'aria-label': 'Trocar guia' } });
      trocar.addEventListener('click', () => app.ir('guia', { depois: 'inicio' }));

      const liberarMsg = el('p', { classe: 'nota' });
      const liberar = el('button', { type: 'button', classe: 'btn-texto', texto: 'Liberar próxima letra', attrs: { 'aria-label': 'Liberar próxima letra' } });
      liberar.addEventListener('click', () => {
        const l = rec.liberarProxima();
        liberarMsg.textContent = l ? `Liberada: ${maiusc(l)}.` : 'Todas as letras já estão liberadas.';
        const novas = mostrarLetras(rec.letrasLiberadas().filter((x) => rec.estadoLetra(x) !== 'dominada'), false);
        praticaBox.replaceWith(novas);
        praticaBox = novas;
      });

      let confirmando = false;
      const reiniciar = el('button', { type: 'button', classe: 'btn-texto perigo', texto: 'Reiniciar progresso', attrs: { 'aria-label': 'Reiniciar progresso' } });
      reiniciar.addEventListener('click', () => {
        if (!confirmando) {
          confirmando = true;
          reiniciar.textContent = 'Toque de novo para apagar tudo';
          reiniciar.classList.add('confirma');
          temporizador = setTimeout(() => {
            confirmando = false;
            reiniciar.textContent = 'Reiniciar progresso';
            reiniciar.classList.remove('confirma');
          }, 5000);
          return;
        }
        clearTimeout(temporizador);
        app.progresso.reiniciar();
        painel();
      });

      const minutos = Math.round(rec.tempoTotal() / 60000);
      const semVoz = app.audio.estado && app.audio.estado().temVozPtBr === false;

      let praticaBox = mostrarLetras(pratica, false);
      tela.replaceChildren(
        el('div', { classe: 'topo-pais' }, el('h1', { texto: 'Área dos pais' })),
        el('h2', { texto: 'Nome da criança' }),
        campo,
        el('p', { classe: 'nota', texto: 'O nome fica salvo só neste aparelho e é usado para o jogo chamar a criança. Sem nome, o jogo diz "princesa".' }),
        el('h2', { texto: 'Guia' }),
        el('div', { classe: 'linha' }, trocar),
        el('h2', { texto: 'Letras dominadas' }),
        mostrarLetras(dominadas, true),
        el('h2', { texto: 'Letras em prática' }),
        praticaBox,
        el('h2', { texto: 'Uso' }),
        el('p', { id: 'resumo-uso', texto: `Tempo total de uso: ${minutos} min. Sessões: ${rec.numeroSessoes()}.` }),
        semVoz ? el('p', { classe: 'aviso', id: 'aviso-voz', texto: 'Este aparelho parece não ter voz em português do Brasil. Nas configurações do Android, instale a voz Google pt-BR (Idioma e entrada > Saída de texto para voz) para o jogo falar melhor.' }) : null,
        el('h2', { texto: 'Progresso' }),
        el('div', { classe: 'linha' }, liberar),
        liberarMsg,
        el('p', { classe: 'nota', texto: `Há ${letras.length} letras na trilha. ${lib.length} liberadas.` }),
        el('div', { classe: 'linha' }, reiniciar),
        el('div', { classe: 'linha', estilo: 'padding-bottom:16px' }, voltarBtn),
      );
    }

    porta();
    return { destruir() { clearTimeout(temporizador); } };
  },
};
