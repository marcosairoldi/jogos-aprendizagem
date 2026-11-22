// Área dos pais: porta com conta de somar e painel para a adulta (aqui pode ter texto).
// Painel em 4 abas, como no app de referência: Progresso, Ajustes, Sua voz e Backup.
import { el, imagem, srcGuia } from '../ui.js';
import * as gravacoes from '../gravacoes.js';
import { legendasLigadas, definirLegendas } from '../legenda.js';
import { criarEditorVoz } from './gravar.js';
import * as backup from './pais-backup.js';
import * as atualizar from './pais-atualizar.js';

const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const NS = 'http://www.w3.org/2000/svg';
const NOMES_JOGOS = { escute: 'Escute e Toque', caca: 'Caça-Som', trace: 'Trace a Letra', junte: 'Junte os Sons' };
const DIAS_AVISO_BACKUP = 14;

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

function svg(caminhos, classe = 'icone-pais') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', classe);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  for (const d of caminhos) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}
const ICONES = {
  progresso: ['M3 3v18h18', 'M8 17v-6', 'M13 17V6', 'M18 17v-3'],
  ajustes: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h11', 'M19 18h1', 'M15 4v4', 'M9 10v4', 'M17 16v4'],
  voz: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  backup: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  cadeado: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  atualizar: ['M20 11a8 8 0 0 0-14.5-4.5L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.5 4.5L20 16', 'M20 20v-4h-4'],
  menos: ['M5 12h14'],
  mais: ['M5 12h14', 'M12 5v14'],
};

const fmtData = (n) => new Date(n).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDia = (n) => new Date(n).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default {
  montar(raiz, app, params = {}) {
    const tela = el('section', { classe: 'tela rolavel pais' });
    raiz.append(tela);
    const voltar = () => app.ir('inicio');
    let temporizador = null;
    let editor = null; // editor de voz (criado quando a aba "Sua voz" abre pela primeira vez)
    let desassinar = null;
    let modalAtual = null;
    let destruida = false;

    function porta() {
      const c = novaConta();
      const resp = el('div', { classe: 'respostas' });
      for (const o of c.opcoes) {
        const b = el('button', { type: 'button', classe: 'btn-texto', texto: String(o), attrs: { 'aria-label': `Resposta ${o}` } });
        b.addEventListener('click', () => (o === c.certa ? painel(params.aba) : porta()));
        resp.append(b);
      }
      const casa = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Voltar', attrs: { 'aria-label': 'Voltar ao início' } });
      casa.addEventListener('click', voltar);
      tela.className = 'tela rolavel pais porta';
      tela.replaceChildren(
        el('div', { estilo: 'align-self:flex-start' }, casa),
        svg(ICONES.cadeado, 'icone-porta'),
        el('h1', { texto: 'Área dos pais' }),
        el('p', { texto: 'Só para a pessoa adulta. Para entrar, resolva a conta:' }),
        el('div', { classe: 'conta', texto: `${c.x} + ${c.y} = ?` }),
        resp,
      );
    }

    function painel(abaInicial, avisoInicial) {
      tela.className = 'tela rolavel pais painel';
      const rec = app.progresso;
      const ordem = app.curriculo.ordem;
      const regrasCur = rec.getRegras();
      const maiusc = (l) => (app.curriculo.letras[l] && app.curriculo.letras[l].maiuscula) || l.toUpperCase();
      const estadoDe = (l) => (!rec.letrasLiberadas().includes(l) ? 'bloqueada' : rec.estadoLetra(l) === 'dominada' ? 'dominada' : 'pratica');
      const MARCAS = { dominada: '✓', pratica: '…', bloqueada: '' };
      const NOMES = { dominada: 'dominada', pratica: 'em prática', bloqueada: 'ainda não liberada' };
      const copia = rec.exportar();
      const hist = copia.hist || {};

      // ---------- mensagem de estado (sempre visível no rodapé) ----------
      const mensagem = el('p', { classe: 'msg-pais', id: 'msg-pais', attrs: { role: 'status', 'aria-live': 'polite', hidden: '' } });
      const dizer = (t) => { mensagem.textContent = t || ''; mensagem.hidden = !t; };
      let ocupado = false;
      const travar = (v) => {
        ocupado = v;
        tela.querySelectorAll('[data-trava]').forEach((b) => { b.disabled = v; });
      };

      const secao = (titulo, ...filhos) => el('section', { classe: 'secao-pais' }, el('h2', { texto: titulo }), ...filhos);
      const acao = (botao, explicacao) => el('div', { classe: 'acao-pais' }, botao, el('p', { classe: 'nota', texto: explicacao }));
      const card = (titulo, valor, detalhe) => el('div', { classe: 'estatistica' },
        el('span', { classe: 'est-titulo', texto: titulo }), el('span', { classe: 'est-valor', texto: valor }), detalhe ? el('span', { classe: 'est-detalhe', texto: detalhe }) : null);

      // ================= ABA: PROGRESSO =================
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

      const minutos = Math.round(rec.tempoTotal() / 60000);
      const r = rec.recompensas();
      const totalRec = r.estrela + r.concha + r.chifre;
      const dominadas = ordem.filter((l) => estadoDe(l) === 'dominada').length;

      const liberadas = rec.letrasLiberadas();
      const janela = regrasCur.janelaDominio || 6;
      const cartoesLetras = liberadas.map((l) => {
        const h = hist[l] || [];
        const recentes = h.slice(-janela);
        const e = estadoDe(l);
        const estado = e === 'dominada' ? 'Dominada' : rec.estadoLetra(l) === 'nova' ? 'Nova' : 'Em prática';
        return el('article', { classe: `cartao-letra ${e}`, attrs: { 'data-letra': l } },
          el('div', { classe: 'cartao-letra-topo' }, el('span', { classe: 'cartao-letra-grande', texto: maiusc(l) }), el('span', { classe: 'cartao-letra-estado', texto: estado })),
          el('p', { classe: 'nota', texto: h.length ? `${recentes.filter((x) => x.ok).length} de ${recentes.length} acertos de primeira nas últimas tentativas` : 'Ainda não praticada' }),
          el('p', { classe: 'nota', texto: `Tentativas: ${h.length}` }));
      });

      const ajuda = ordem.map((l) => [l, (hist[l] || []).filter((x) => !x.ok).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const recentes = Object.entries(hist).flatMap(([l, lista]) => lista.map((x) => ({ ...x, l }))).sort((a, b) => b.t - a.t).slice(0, 8);

      const abaProgresso = el('div', { classe: 'aba-painel', id: 'aba-progresso', attrs: { 'data-aba': 'progresso', role: 'region', 'aria-label': 'Progresso' } },
        secao('Pequenas grandes conquistas',
          el('div', { classe: 'estatisticas', id: 'resumo-uso' },
            card('Letras dominadas', `${dominadas}/${ordem.length}`),
            card('Sessões', String(rec.numeroSessoes())),
            card('Tempo de uso', `${minutos} min`),
            card('Recompensas', String(totalRec), `${r.estrela} estrelas, ${r.concha} conchas, ${r.chifre} chifres`))),
        secao('Letras do currículo',
          el('p', { classe: 'nota', texto: `A trilha tem ${ordem.length} letras, na ordem em que são ensinadas. As cores mostram onde a criança está.` }),
          grade),
        secao('Letra por letra',
          el('div', { classe: 'cartoes-letras', id: 'cartoes-letras' }, ...cartoesLetras)),
        secao('Onde precisou de mais ajuda',
          ajuda.length
            ? el('ul', { classe: 'lista-linhas', id: 'lista-ajuda-letras' }, ...ajuda.map(([l, n]) => el('li', {}, el('span', { texto: `Letra ${maiusc(l)}` }), el('span', { texto: `${n} ${n === 1 ? 'tentativa com ajuda' : 'tentativas com ajuda'}` }))))
            : el('p', { classe: 'nota', texto: 'Ainda não há tentativas com ajuda registradas.' })),
        secao('Histórico recente',
          recentes.length
            ? el('ul', { classe: 'lista-linhas', id: 'lista-historico' }, ...recentes.map((x) => el('li', {}, el('span', { texto: `${fmtDia(x.t)} · Letra ${maiusc(x.l)} · ${NOMES_JOGOS[x.jogo] || 'Brincadeira'}` }), el('span', { texto: x.ok ? 'de primeira' : 'com ajuda' }))))
            : el('p', { classe: 'nota', texto: 'As brincadeiras feitas aparecerão aqui.' })));

      // ================= ABA: AJUSTES =================
      const campo = el('input', { type: 'text', id: 'campo-nome', maxLength: 30, value: rec.nome(), attrs: { 'aria-label': 'Nome da criança', autocomplete: 'off', autocapitalize: 'words' } });
      campo.addEventListener('input', () => app.progresso.definirNome(campo.value));

      function chaveLigada(rotuloAria, ligadaFn, aoMudar, dataAcao) {
        const b = el('button', { type: 'button', classe: 'chave', attrs: { role: 'switch', 'aria-label': rotuloAria, ...(dataAcao ? { 'data-acao': dataAcao } : {}) } });
        const pintar = () => {
          const on = ligadaFn();
          b.setAttribute('aria-checked', String(on));
          b.classList.toggle('ligada', on);
          b.textContent = on ? 'Ligadas' : 'Desligadas';
        };
        pintar();
        b.addEventListener('click', () => { aoMudar(!ligadaFn()); pintar(); });
        return b;
      }
      const chaveLegendas = chaveLigada('Mostrar legendas', legendasLigadas, (v) => { definirLegendas(v); dizer('Ajuste salvo neste aparelho.'); }, 'legendas');
      const chaveTrace = chaveLigada('Trace a Letra na lição', () => rec.ajustes().tracadoNaLicao, (v) => { rec.definirAjuste('tracadoNaLicao', v); dizer('Ajuste salvo neste aparelho.'); }, 'trace-na-licao');
      chaveTrace.textContent = '';
      const pintarTrace = () => { const on = rec.ajustes().tracadoNaLicao; chaveTrace.textContent = on ? 'Incluído' : 'Fora'; };
      pintarTrace();
      chaveTrace.addEventListener('click', pintarTrace);

      function passo(rotulo, chave, id, nota) {
        const [min, max] = [rec.LIMITES ? rec.LIMITES[chave][0] : 0, rec.LIMITES ? rec.LIMITES[chave][1] : 9];
        const saida = el('output', { classe: 'passo-valor', id, texto: String(rec.ajustes()[chave]), attrs: { 'aria-live': 'polite' } });
        const menos = el('button', { type: 'button', classe: 'passo-btn', attrs: { 'aria-label': `Diminuir: ${rotulo}`, 'data-ajuste': chave, 'data-sentido': '-' } }, svg(ICONES.menos));
        const mais = el('button', { type: 'button', classe: 'passo-btn', attrs: { 'aria-label': `Aumentar: ${rotulo}`, 'data-ajuste': chave, 'data-sentido': '+' } }, svg(ICONES.mais));
        const pintar = () => {
          const v = rec.ajustes()[chave];
          saida.textContent = String(v);
          menos.disabled = v <= min;
          mais.disabled = v >= max;
        };
        const mudar = (d) => { rec.definirAjuste(chave, rec.ajustes()[chave] + d); pintar(); dizer('Ajuste salvo neste aparelho.'); };
        menos.addEventListener('click', () => mudar(-1));
        mais.addEventListener('click', () => mudar(1));
        pintar();
        return el('div', { classe: 'linha-ajuste' },
          el('div', { classe: 'linha-ajuste-topo' }, el('span', { classe: 'ajuste-nome', texto: rotulo }), el('div', { classe: 'passo' }, menos, saida, mais)),
          el('p', { classe: 'nota', texto: nota }));
      }

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
        painel('ajustes');
      });

      const comoBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Como funciona', attrs: { 'aria-label': 'Como funciona' } });
      comoBtn.addEventListener('click', () => app.ir('ajuda', { voltarPara: 'pais' }));

      const semVoz = app.audio.estado && app.audio.estado().temVozPtBr === false;

      const abaAjustes = el('div', { classe: 'aba-painel', id: 'aba-ajustes', attrs: { 'data-aba': 'ajustes', role: 'region', 'aria-label': 'Ajustes', hidden: '' } },
        semVoz ? el('p', { classe: 'aviso', id: 'aviso-voz', texto: 'Este aparelho parece não ter voz em português do Brasil. A maior parte do jogo usa áudios gravados, mas algumas palavras usam a voz do aparelho: para elas, instale a voz Google pt-BR (Idioma e entrada > Saída de texto para voz).' }) : null,
        secao('Prática do seu jeito',
          el('div', { classe: 'linha-ajuste' }, el('label', { classe: 'ajuste-nome', texto: 'Nome da criança', htmlFor: 'campo-nome' }), campo,
            el('p', { classe: 'nota', texto: 'O nome fica salvo só neste aparelho e é usado para o jogo chamar a criança. Sem nome, o jogo diz "princesa".' })),
          passo('Atividades por rodada', 'itensPorRodada', 'valor-itens', 'Quantos itens tem cada brincadeira. Menos itens deixam a lição mais curta.'),
          passo('Letras de revisão', 'letrasRevisao', 'valor-revisao', 'Quantas letras antigas voltam misturadas em cada rodada. Com 0, só a letra nova aparece.'),
          el('div', { classe: 'linha-ajuste' },
            el('div', { classe: 'linha-ajuste-topo' }, el('span', { classe: 'ajuste-nome', texto: 'Trace a Letra na lição' }), chaveTrace),
            el('p', { classe: 'nota', texto: 'Fora da lição, o Trace continua nas brincadeiras do menu.' })),
          el('div', { classe: 'linha-ajuste' },
            el('div', { classe: 'linha-ajuste-topo' }, el('span', { classe: 'ajuste-nome', texto: 'Mostrar legendas' }), chaveLegendas),
            el('p', { classe: 'nota', texto: 'Mostra na tela, para você, o texto do que o guia fala. Nos sons aparece só a letra: leia o SOM, não o nome. A criança continua só ouvindo.' }))),
        secao('Guia', acao(trocar, 'Escolha entre a unicórnio Lumi e a sereia Marola.')),
        secao('Progresso',
          acao(liberar, 'Use se a criança já sabe o som da letra atual. A próxima letra aparece na trilha.'),
          liberarMsg,
          acao(reiniciar, 'Apaga letras liberadas, recompensas e tempo de uso. Não apaga o nome, os ajustes nem as gravações da sua voz.')),
        secao('Ajuda', acao(comoBtn, 'Objetivo do jogo, como acompanhar e o que é cada brincadeira.')));

      // ================= ABA: SUA VOZ =================
      const resumoVoz = el('p', { id: 'resumo-voz', classe: 'resumo-voz', texto: gravacoes.disponivel() ? 'Voz gravada: contando…' : 'Gravação indisponível neste navegador (aba anônima?).' });
      const nVoz = (n) => (n === 1 ? 'Voz gravada: 1 item' : `Voz gravada: ${n} itens`);
      if (gravacoes.disponivel()) {
        gravacoes.listarIds().then((s) => { if (!destruida && resumoVoz.isConnected && !editor) resumoVoz.textContent = nVoz(s.size); });
      }
      const caixaEditor = el('div', { id: 'caixa-voz' });
      const abaVoz = el('div', { classe: 'aba-painel', id: 'aba-voz', attrs: { 'data-aba': 'voz', role: 'region', 'aria-label': 'Sua voz', hidden: '' } },
        el('section', { classe: 'secao-pais' }, resumoVoz, caixaEditor));

      // ================= ABA: BACKUP =================
      const ultima = el('p', { id: 'ultima-copia', classe: 'ultima-copia' });
      const pintarUltima = () => {
        const u = rec.ultimoBackup();
        ultima.textContent = `Última cópia: ${u ? fmtData(u) : 'ainda não feita'}`;
      };
      pintarUltima();
      const exportarBtn = el('button', { type: 'button', classe: 'btn-texto largo', attrs: { 'aria-label': 'Exportar cópia', 'data-acao': 'exportar', 'data-trava': '' } }, svg(ICONES.backup), el('span', { texto: 'Exportar cópia' }));
      const arquivo = el('input', { type: 'file', id: 'arquivo-copia', accept: '.json,application/json', attrs: { 'aria-label': 'Arquivo da cópia', hidden: '', tabindex: '-1' } });
      const importarBtn = el('button', { type: 'button', classe: 'btn-texto claro largo', attrs: { 'aria-label': 'Importar cópia', 'data-acao': 'importar', 'data-trava': '' } }, svg(ICONES.backup, 'icone-pais gira'), el('span', { texto: 'Importar cópia' }));
      importarBtn.addEventListener('click', () => arquivo.click());

      exportarBtn.addEventListener('click', async () => {
        if (ocupado) return;
        travar(true);
        dizer('Preparando a cópia…');
        try {
          const b = await backup.gerarBackup();
          backup.baixarBackup(b);
          pintarUltima();
          pintarAviso();
          dizer('Cópia preparada para download. Guarde o arquivo em um lugar seguro.');
        } catch (e) {
          dizer('Não foi possível preparar a cópia. Confira o espaço livre do aparelho e tente de novo.');
        } finally {
          travar(false);
        }
      });

      arquivo.addEventListener('change', async () => {
        const f = arquivo.files && arquivo.files[0];
        arquivo.value = '';
        if (!f || ocupado) return;
        travar(true);
        dizer('Lendo a cópia…');
        try {
          const b = await backup.lerArquivo(f);
          dizer('');
          confirmarRestauracao(b);
        } catch (e) {
          dizer(e && e.message ? e.message : 'Não foi possível ler o arquivo. Nada foi alterado.');
        } finally {
          travar(false);
        }
      });

      function confirmarRestauracao(b) {
        const partes = [`${b.resumo.sessoes} ${b.resumo.sessoes === 1 ? 'sessão' : 'sessões'}`, `${b.resumo.letras} ${b.resumo.letras === 1 ? 'letra liberada' : 'letras liberadas'}`, `${b.resumo.gravacoes} ${b.resumo.gravacoes === 1 ? 'gravação' : 'gravações'}`];
        abrirModal({
          titulo: 'Restaurar esta cópia?',
          texto: `Cópia de ${fmtData(b.criadoEm)}: ${partes.join(', ')}. Os dados atuais deste aparelho serão substituídos.`,
          ok: 'Restaurar e substituir',
          aoOk: async () => {
            travar(true);
            try {
              await backup.restaurarBackup(b, app.audio);
              fecharModal();
              travar(false);
              painel('backup', 'Cópia restaurada neste aparelho.');
            } catch (e) {
              fecharModal();
              travar(false);
              dizer(e && e.message ? e.message : 'Não foi possível restaurar. Nada foi alterado.');
            }
          },
        });
      }

      const abaBackup = el('div', { classe: 'aba-painel', id: 'aba-backup', attrs: { 'data-aba': 'backup', role: 'region', 'aria-label': 'Backup', hidden: '' } },
        secao('Uma cópia das descobertas',
          el('p', { classe: 'nota', texto: 'O arquivo guarda progresso, ajustes e a sua voz. Nada é enviado pela internet: a cópia é um arquivo que você baixa e guarda onde quiser.' }),
          ultima, exportarBtn, importarBtn, arquivo,
          el('p', { classe: 'nota', texto: 'A importação só substitui os dados depois da sua confirmação, e se algo der errado nada muda. A cópia também inclui as gravações de voz: guarde-a com cuidado.' })));

      // ================= modal de confirmação =================
      function fecharModal() {
        if (modalAtual) { modalAtual.remove(); modalAtual = null; }
      }
      function abrirModal({ titulo, texto, ok, aoOk }) {
        fecharModal();
        const bOk = el('button', { type: 'button', classe: 'btn-texto', texto: ok, attrs: { 'data-acao': 'modal-ok' } });
        const bCancelar = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Cancelar', attrs: { 'data-acao': 'modal-cancelar' } });
        const m = el('div', { classe: 'modal-fundo', id: 'modal-pais' },
          el('div', { classe: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-titulo' } },
            el('h2', { id: 'modal-titulo', texto: titulo }), el('p', { texto }), el('div', { classe: 'modal-botoes' }, bOk, bCancelar)));
        bOk.addEventListener('click', () => { if (!ocupado) aoOk(); });
        bCancelar.addEventListener('click', () => { if (!ocupado) fecharModal(); });
        m.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ocupado) fecharModal(); });
        raiz.append(m);
        modalAtual = m;
        bCancelar.focus();
      }

      // ================= atualização do jogo =================
      const aviso = el('div', { classe: 'aviso-copia', id: 'aviso-copia', attrs: { hidden: '' } },
        el('p', { classe: 'aviso-titulo', texto: 'Hora de guardar uma cópia' }), el('p', { id: 'aviso-copia-texto', classe: 'nota' }));
      function pintarAviso() {
        const u = rec.ultimoBackup();
        const velho = u == null || Date.now() - u > DIAS_AVISO_BACKUP * 86400000;
        aviso.hidden = !velho;
        aviso.querySelector('#aviso-copia-texto').textContent = u ? `Seu último backup foi há mais de ${DIAS_AVISO_BACKUP} dias.` : 'Ainda não há uma cópia de segurança.';
      }
      pintarAviso();

      const textoVersao = el('p', { id: 'estado-versao', classe: 'nota', attrs: { 'aria-live': 'polite' } });
      const atualizarBtn = el('button', { type: 'button', classe: 'btn-texto largo', attrs: { 'aria-label': 'Atualizar o jogo agora', 'data-acao': 'atualizar', hidden: '' } }, svg(ICONES.atualizar), el('span', { texto: 'Atualizar' }));
      const verificarBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Verificar nova versão', attrs: { 'aria-label': 'Verificar nova versão', 'data-acao': 'verificar' } });
      const avisoNova = el('div', { classe: 'aviso-nova', id: 'aviso-atualizacao', attrs: { hidden: '', role: 'status' } }, el('p', { classe: 'aviso-titulo', texto: 'Nova versão disponível' }));
      const atualizarTopo = el('button', { type: 'button', classe: 'btn-texto', texto: 'Atualizar', attrs: { 'aria-label': 'Atualizar o jogo agora', 'data-acao': 'atualizar-topo' } });
      avisoNova.append(el('p', { classe: 'nota', texto: 'Ao atualizar, a página recarrega. O progresso e as gravações não são apagados.' }), atualizarTopo);
      let versao = null;
      function pintarVersao() {
        const nova = atualizar.temAtualizacao();
        avisoNova.hidden = !nova;
        atualizarBtn.hidden = !nova;
        textoVersao.textContent = nova ? 'Nova versão disponível. Toque em Atualizar para usar a versão mais nova.' : `Você está com a versão mais recente.${versao ? ` (${versao.replace(/^trilha-sons-/, '')})` : ''}`;
      }
      const aplicar = async () => {
        if (ocupado) return;
        travar(true);
        dizer('Atualizando…');
        const feito = await atualizar.aplicar();
        if (!feito) { travar(false); dizer('Não há versão nova esperando agora.'); pintarVersao(); }
      };
      atualizarBtn.addEventListener('click', aplicar);
      atualizarTopo.addEventListener('click', aplicar);
      verificarBtn.addEventListener('click', async () => {
        verificarBtn.disabled = true;
        dizer('Procurando versão nova…');
        const nova = await atualizar.verificar();
        verificarBtn.disabled = false;
        pintarVersao();
        dizer(nova ? 'Nova versão disponível.' : 'Você já está com a versão mais recente.');
      });
      atualizarBtn.setAttribute('data-trava', '');
      atualizarTopo.setAttribute('data-trava', '');
      if (desassinar) desassinar();
      desassinar = atualizar.aoMudar(() => { if (!destruida) pintarVersao(); });
      pintarVersao();
      atualizar.versaoAtual().then((v) => { versao = v; if (!destruida) pintarVersao(); });
      if (navigator.onLine !== false) atualizar.verificar().then(() => { if (!destruida) pintarVersao(); });

      const cartaoVersao = el('section', { classe: 'secao-pais', id: 'cartao-versao' }, el('h2', { texto: 'Versão do jogo' }), textoVersao, atualizarBtn, verificarBtn);

      // ================= abas =================
      const ABAS = [['progresso', 'Progresso', abaProgresso], ['ajustes', 'Ajustes', abaAjustes], ['voz', 'Sua voz', abaVoz], ['backup', 'Backup', abaBackup]];
      const botoesAba = {};
      let abaAtual = 'progresso';
      const nav = el('nav', { classe: 'abas', attrs: { 'aria-label': 'Seções do painel' } });
      for (const [id, nome, painelEl] of ABAS) {
        const b = el('button', { type: 'button', classe: 'aba', attrs: { 'data-aba': id, 'aria-label': nome, 'aria-pressed': 'false' } }, svg(ICONES[id]), el('span', { texto: nome }));
        b.addEventListener('click', () => trocarAba(id));
        botoesAba[id] = b;
        nav.append(b);
        painelEl.hidden = true;
      }
      function trocarAba(id) {
        if (modalAtual) fecharModal();
        if (abaAtual === 'voz' && id !== 'voz' && editor) editor.pausar();
        abaAtual = id;
        for (const [k, , p] of ABAS) {
          p.hidden = k !== id;
          botoesAba[k].setAttribute('aria-pressed', String(k === id));
          botoesAba[k].classList.toggle('ativa', k === id);
        }
        dizer('');
        if (id === 'voz' && !editor) {
          editor = criarEditorVoz(app, { aoMudar: (n) => { resumoVoz.textContent = nVoz(n); } });
          caixaEditor.append(editor.no);
        }
        tela.scrollTo({ top: 0 });
      }

      const voltarBtn = el('button', { type: 'button', classe: 'btn-texto claro voltar-pais', attrs: { 'aria-label': 'Voltar' } }, svg(['M19 12H5', 'M11 6l-6 6 6 6']), el('span', { texto: 'Voltar' }));
      voltarBtn.addEventListener('click', voltar);

      if (editor) { editor.destruir(); editor = null; }
      tela.replaceChildren(
        el('header', { classe: 'cabecalho-pais' }, imagem(srcGuia(rec.guia()), 'mascote-pais'), el('h1', { texto: 'Área dos pais' }), voltarBtn),
        nav,
        aviso,
        avisoNova,
        abaProgresso, abaAjustes, abaVoz, abaBackup,
        cartaoVersao,
        el('footer', { classe: 'rodape-pais', texto: 'Tudo salvo somente neste aparelho' }),
        mensagem,
      );
      trocarAba(ABAS.some(([k]) => k === abaInicial) ? abaInicial : 'progresso');
      if (avisoInicial) dizer(avisoInicial);
    }

    if (params && (params.painel || params.aba)) painel(params.aba); else porta();
    return {
      destruir() {
        destruida = true;
        clearTimeout(temporizador);
        if (desassinar) desassinar();
        if (editor) editor.destruir();
        if (modalAtual) modalAtual.remove();
      },
    };
  },
};
