// Casca do app: carrega dados, configura o áudio, roteia as telas e conta o tempo de uso.
import * as progresso from './progresso.js';
import { el } from './ui.js';
import inicio from './telas/inicio.js';
import guia from './telas/guia.js';
import trilha from './telas/trilha.js';
import licao from './telas/licao.js';
import menu from './telas/menu.js';
import colecao from './telas/colecao.js';
import despedida from './telas/despedida.js';
import pais from './telas/pais.js';
import gravar from './telas/gravar.js';

const TELAS = { inicio, guia, trilha, licao, menu, colecao, despedida, pais, gravar };
const raiz = document.getElementById('app');

// Áudio reserva (silencioso) caso js/audio.js não carregue.
const audioMudo = {
  configurar() {},
  async desbloquear() {},
  async falar() { return { cancelado: false }; },
  efeito() {},
  parar() {},
  gravacoesMudaram() {},
  estado: () => ({ desbloqueado: false, temVozPtBr: true }),
};

const app = {
  curriculo: null,
  frases: null,
  audio: audioMudo,
  progresso,
  baseSessao: 0,
  telaAtual: null,
  cacheJogos: new Map(),

  /** Troca de tela: destrói a atual, para o áudio e monta a nova. */
  ir(nome, params = {}) {
    const anterior = this.telaAtual;
    this.telaAtual = null;
    try { if (anterior && anterior.destruir) anterior.destruir(); } catch (e) { console.warn('[app] erro ao destruir tela', e); }
    try { this.audio.parar(); } catch (e) { /* sem áudio */ }
    raiz.replaceChildren();
    const tela = TELAS[nome] || TELAS.inicio;
    this.telaAtual = tela.montar(raiz, this, params) || {};
    this.telaAtual.nome = nome;
  },

  /** Importa js/jogos/<id>.js; se falhar, devolve null (o jogo é pulado). */
  carregarJogo(id) {
    if (!this.cacheJogos.has(id)) {
      this.cacheJogos.set(id, import(`./jogos/${id}.js`).then((m) => m.default || null).catch((e) => {
        console.warn('[app] jogo indisponível:', id, e && e.message);
        return null;
      }));
    }
    return this.cacheJogos.get(id);
  },

  /** A sessão passou do tempo? (só vale ao fim de uma rodada) */
  sessaoExcedida() {
    const t = progresso.tempoSessao();
    if (t < this.baseSessao) this.baseSessao = 0;
    return t - this.baseSessao >= progresso.getRegras().minutosSessao * 60000;
  },
  /** A adulta pediu para continuar: a próxima despedida só depois de outro período. */
  adiarDespedida() {
    this.baseSessao = progresso.tempoSessao();
  },
};

async function buscarJson(caminho) {
  const r = await fetch(caminho);
  if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
  return r.json();
}

/** Conta o tempo de uso apenas com a página visível. */
function iniciarContagemTempo() {
  let ultimo = document.visibilityState === 'visible' ? Date.now() : null;
  const fecharTrecho = () => {
    if (ultimo != null) {
      progresso.adicionarTempo(Math.min(Date.now() - ultimo, 10000));
      ultimo = null;
    }
  };
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const agora = Date.now();
    if (ultimo != null) progresso.adicionarTempo(Math.min(agora - ultimo, 10000));
    ultimo = agora;
  }, 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fecharTrecho();
    else { progresso.novaSessaoSeNecessario(); ultimo = Date.now(); }
  });
  window.addEventListener('pagehide', fecharTrecho);
}

function bloquearGestos() {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => { if (!e.target.closest || !e.target.closest('input')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => e.preventDefault());
  // pinça: impede zoom com dois dedos
  document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // marca atividade e abre nova sessão após longa pausa
  document.addEventListener('pointerdown', () => {
    try { progresso.novaSessaoSeNecessario(); progresso.tocar(); } catch (e) { /* ignora */ }
  }, true);
}

function telaErro() {
  raiz.replaceChildren(el('section', { classe: 'tela pais' },
    el('h1', { texto: 'Não deu para abrir o jogo' }),
    el('p', { texto: 'Os arquivos do jogo não carregaram. Verifique a conexão e tente de novo.' }),
    el('button', { type: 'button', classe: 'btn-texto', texto: 'Tentar de novo', attrs: { 'aria-label': 'Tentar de novo' }, on: { click: () => location.reload() } })));
}

async function iniciar() {
  bloquearGestos();
  let curriculo;
  let frases;
  try {
    [curriculo, frases] = await Promise.all([buscarJson('data/curriculo.json'), buscarJson('data/frases.json')]);
  } catch (e) {
    console.warn('[app] falha ao carregar dados', e);
    telaErro();
    return;
  }
  app.curriculo = curriculo;
  app.frases = frases;
  progresso.carregar(curriculo);
  try {
    app.audio = await import('./audio.js');
  } catch (e) {
    console.warn('[app] audio.js indisponível, seguindo sem som', e && e.message);
    app.audio = audioMudo;
  }
  try {
    app.audio.configurar({ curriculo, frases, obterNome: () => progresso.nome() });
  } catch (e) {
    console.warn('[app] falha ao configurar o áudio', e);
  }
  iniciarContagemTempo();
  app.ir('inicio');
}

iniciar();
