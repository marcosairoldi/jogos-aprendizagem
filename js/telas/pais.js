// Área dos pais: porta com conta de somar e painel para a adulta (aqui pode ter texto).
import { el, botaoIcone } from '../ui.js';
import * as gravacoes from '../gravacoes.js';
import { legendasLigadas, definirLegendas } from '../legenda.js';

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
  montar(raiz, app, params = {}) {
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
      const casa = botaoIcone({ src: 'assets/svg/ui/casa.svg', rotulo: 'Voltar ao início', texto: 'Início', glifo: '⌂', aoClicar: voltar });
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
      tela.className = 'tela rolavel pais painel';
      const rec = app.progresso;
      const ordem = app.curriculo.ordem;
      const maiusc = (l) => (app.curriculo.letras[l] && app.curriculo.letras[l].maiuscula) || l.toUpperCase();
      const estadoDe = (l) => (!rec.letrasLiberadas().includes(l) ? 'bloqueada' : rec.estadoLetra(l) === 'dominada' ? 'dominada' : 'pratica');
      const MARCAS = { dominada: '✓', pratica: '…', bloqueada: '' };
      const NOMES = { dominada: 'dominada', pratica: 'em prática', bloqueada: 'ainda não liberada' };

      // ---- grade de letras do currículo, colorida por estado, com legenda escrita ----
      function montarGrade() {
        const cont = { dominada: 0, pratica: 0, bloqueada: 0 };
        const celulas = ordem.map((l) => {
          const e = estadoDe(l);
          cont[e]++;
          return el('li', { classe: `cel ${e}`, attrs: { 'aria-label': `Letra ${maiusc(l)}: ${NOMES[e]}`, 'data-estado': e } },
            el('span', { classe: 'cel-letra', texto: maiusc(l) }), el('span', { classe: 'cel-marca', texto: MARCAS[e] }));
        });
        const legenda = el('ul', { classe: 'legenda-cores' },
          ...['dominada', 'pratica', 'bloqueada'].map((e) => el('li', {}, el('span', { classe: `amostra ${e}`, texto: MARCAS[e] }),
            el('span', { texto: `${cont[e]} ${e === 'bloqueada' ? 'ainda não liberadas' : e === 'pratica' ? 'em prática' : cont[e] === 1 ? 'dominada' : 'dominadas'}` }))));
        return el('div', { id: 'grade-letras' }, el('ul', { classe: 'grade-letras' }, ...celulas), legenda);
      }
      let grade = montarGrade();

      const voltarBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Voltar', attrs: { 'aria-label': 'Voltar' } });
      voltarBtn.addEventListener('click', voltar);

      const campo = el('input', { type: 'text', id: 'campo-nome', maxLength: 30, value: rec.nome(), attrs: { 'aria-label': 'Nome da criança', autocomplete: 'off', autocapitalize: 'words' } });
      campo.addEventListener('input', () => app.progresso.definirNome(campo.value));

      // ---- legendas ----
      const chave = el('button', { type: 'button', classe: 'chave', attrs: { role: 'switch', 'aria-label': 'Mostrar legendas', 'data-acao': 'legendas' } });
      const pintarChave = () => {
        const on = legendasLigadas();
        chave.setAttribute('aria-checked', String(on));
        chave.classList.toggle('ligada', on);
        chave.textContent = on ? 'Ligadas' : 'Desligadas';
      };
      pintarChave();
      chave.addEventListener('click', () => { definirLegendas(!legendasLigadas()); pintarChave(); });

      const trocar = el('button', { type: 'button', classe: 'btn-texto', texto: 'Trocar guia', attrs: { 'aria-label': 'Trocar guia' } });
      trocar.addEventListener('click', () => app.ir('guia', { depois: 'inicio' }));

      const liberarMsg = el('p', { classe: 'nota', attrs: { 'aria-live': 'polite' } });
      const liberar = el('button', { type: 'button', classe: 'btn-texto', texto: 'Liberar próxima letra', attrs: { 'aria-label': 'Liberar próxima letra' } });
      liberar.addEventListener('click', () => {
        const l = rec.liberarProxima();
        liberarMsg.textContent = l ? `Liberada: ${maiusc(l)}.` : 'Todas as letras já estão liberadas.';
        const nova = montarGrade();
        grade.replaceWith(nova);
        grade = nova;
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

      const gravarBtn = el('button', { type: 'button', classe: 'btn-texto', texto: 'Gravar minha voz', attrs: { 'aria-label': 'Gravar minha voz', 'data-acao': 'gravar-voz' } });
      gravarBtn.addEventListener('click', () => app.ir('gravar'));
      if (gravacoes.disponivel()) {
        gravacoes.listarIds().then((s) => {
          const r = tela.querySelector('#resumo-voz');
          if (r) r.textContent = s.size === 1 ? 'Voz gravada: 1 item' : `Voz gravada: ${s.size} itens`;
        });
      }
      const comoBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Como funciona', attrs: { 'aria-label': 'Como funciona' } });
      comoBtn.addEventListener('click', () => app.ir('ajuda', { voltarPara: 'pais' }));

      const minutos = Math.round(rec.tempoTotal() / 60000);
      const r = rec.recompensas();
      const totalRec = r.estrela + r.concha + r.chifre;
      const semVoz = app.audio.estado && app.audio.estado().temVozPtBr === false;
      const card = (titulo, valor, detalhe) => el('div', { classe: 'estatistica' },
        el('span', { classe: 'est-titulo', texto: titulo }), el('span', { classe: 'est-valor', texto: valor }), detalhe ? el('span', { classe: 'est-detalhe', texto: detalhe }) : null);
      const secao = (titulo, ...filhos) => el('section', { classe: 'secao-pais' }, el('h2', { texto: titulo }), ...filhos);
      const acao = (botao, explicacao) => el('div', { classe: 'acao-pais' }, botao, el('p', { classe: 'nota', texto: explicacao }));

      tela.replaceChildren(
        el('header', { classe: 'cabecalho-pais' }, voltarBtn, el('h1', { texto: 'Área dos pais' })),
        semVoz ? el('p', { classe: 'aviso', id: 'aviso-voz', texto: 'Este aparelho parece não ter voz em português do Brasil. Nas configurações do Android, instale a voz Google pt-BR (Idioma e entrada > Saída de texto para voz) para o jogo falar melhor.' }) : null,
        secao('Resumo',
          el('div', { classe: 'estatisticas', id: 'resumo-uso' },
            card('Tempo de uso', `${minutos} min`),
            card('Sessões', String(rec.numeroSessoes())),
            card('Recompensas', String(totalRec), `${r.estrela} estrelas, ${r.concha} conchas, ${r.chifre} chifres`))),
        secao('Letras do currículo',
          el('p', { classe: 'nota', texto: `A trilha tem ${ordem.length} letras, na ordem em que são ensinadas. As cores mostram onde a criança está.` }),
          grade),
        secao('Nome da criança', campo,
          el('p', { classe: 'nota', texto: 'O nome fica salvo só neste aparelho e é usado para o jogo chamar a criança. Sem nome, o jogo diz "princesa".' })),
        secao('Legendas',
          el('div', { classe: 'linha-chave' }, el('span', { classe: 'chave-texto', texto: 'Mostrar legendas' }), chave),
          el('p', { classe: 'nota', texto: 'Mostra na tela, para você, o texto do que o guia fala. Nos sons aparece só a letra: leia o SOM, não o nome. A criança continua só ouvindo.' })),
        secao('Guia', acao(trocar, 'Escolha entre a unicórnio Lumi e a sereia Marola.')),
        secao('Voz gravada',
          el('p', { classe: 'nota', texto: 'Grave a sua voz para o jogo falar com você. As gravações ficam só neste celular.' }),
          el('p', { id: 'resumo-voz', classe: 'resumo-voz', texto: gravacoes.disponivel() ? 'Voz gravada: contando…' : 'Gravação indisponível neste navegador (aba anônima?).' }),
          acao(gravarBtn, 'Comece pelos sons das letras: fale só o som, sem vogal.')),
        secao('Progresso',
          acao(liberar, 'Use se a criança já sabe o som da letra atual. A próxima letra aparece na trilha.'),
          liberarMsg,
          acao(reiniciar, 'Apaga letras liberadas, recompensas e tempo de uso. Não apaga o nome nem as gravações da sua voz.')),
        secao('Ajuda', acao(comoBtn, 'Objetivo do jogo, como acompanhar e o que é cada brincadeira.')),
      );
    }

    if (params && params.painel) painel(); else porta();
    return { destruir() { clearTimeout(temporizador); } };
  },
};
