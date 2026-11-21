// Camada de áudio da Trilha dos Sons.
// API: configurar, desbloquear, falar, efeito, parar, estado (ver docs/PLANO.md, seção 5).
// Regra pedagógica: o jogo ensina o SOM da letra, nunca o nome. Nunca mandamos uma
// consoante isolada para o speechSynthesis; sem arquivo, usa-se o "tts" do currículo
// (som alongado) ou, se for null, a primeira palavra-âncora da letra.

import * as gravacoes from './gravacoes.js';

const BASE_GRAVACOES = 'assets/audio/gravacoes/';
const BASE_GERADO = 'assets/audio/gerado/';

let cfg = { curriculo: null, frases: {}, obterNome: () => '' };
let ctx = null; // AudioContext
let mestre = null; // GainNode mestre dos efeitos
let desbloqueado = false;
let voz = null;
let vozesProntas = false;
let seq = 0; // token da sequência de fala atual
const existe = new Map(); // id -> url (string) ou null
const buscas = new Map(); // id -> Promise (evita HEAD duplicado)
const cancelaveis = new Set(); // funções que interrompem o passo atual
let infoTtsAvisado = new Set();

const temSS = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

// ---------- configuração ----------
export function configurar({ curriculo, frases, obterNome } = {}) {
  cfg = {
    curriculo: curriculo || null,
    frases: frases || {},
    obterNome: typeof obterNome === 'function' ? obterNome : () => '',
  };
}

export function estado() {
  return { desbloqueado, temVozPtBr: !!voz };
}

// ---------- vozes ----------
function escolherVoz() {
  if (!temSS()) return null;
  let lista = [];
  try { lista = speechSynthesis.getVoices() || []; } catch (e) { lista = []; }
  const pt = lista.filter((v) => /^pt[-_]br$/i.test(v.lang || ''));
  if (!pt.length) return null;
  return pt.find((v) => /google/i.test(v.name)) || pt.find((v) => /fem|maria|luciana|francisca/i.test(v.name)) || pt[0];
}

function atualizarVoz() {
  voz = escolherVoz();
  let n = 0;
  try { n = speechSynthesis.getVoices().length; } catch (e) { /* ignora */ }
  if (n > 0) vozesProntas = true;
}

function carregarVozes() {
  if (!temSS()) return Promise.resolve();
  atualizarVoz();
  if (vozesProntas) return Promise.resolve();
  return new Promise((resolve) => {
    let feito = false;
    // Espera uma vez só: se o aparelho nunca preencher a lista, não atrasa cada fala seguinte.
    const fim = () => { if (feito) return; feito = true; atualizarVoz(); vozesProntas = true; resolve(); };
    try { speechSynthesis.addEventListener('voiceschanged', fim, { once: true }); } catch (e) { /* ignora */ }
    setTimeout(fim, 1200);
  });
}

if (temSS()) {
  try {
    speechSynthesis.addEventListener('voiceschanged', atualizarVoz);
    atualizarVoz();
  } catch (e) { /* ignora */ }
}

// ---------- desbloqueio ----------
function garantirContexto() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    mestre = ctx.createGain();
    mestre.gain.value = 0.5;
    mestre.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export async function desbloquear() {
  try {
    const c = garantirContexto();
    if (c) {
      if (c.state === 'suspended') { try { await c.resume(); } catch (e) { /* ignora */ } }
      // buffer silencioso para liberar a saída de áudio no Android
      try {
        const buf = c.createBuffer(1, 1, 22050);
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start(0);
      } catch (e) { /* ignora */ }
    }
    if (temSS()) {
      // "aquece" o motor de fala com uma fala curta inaudível
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.lang = 'pt-BR';
        speechSynthesis.speak(u);
      } catch (e) { /* ignora */ }
    }
    desbloqueado = true;
    await carregarVozes();
  } catch (e) {
    desbloqueado = true;
  }
  return estado();
}

// ---------- utilidades de espera cancelável ----------
// Executa um passo que pode ser interrompido por parar()/nova sequência.
function passo(iniciar) {
  return new Promise((resolve) => {
    let fechado = false;
    const limpezas = [];
    const encerrar = (cancelado) => {
      if (fechado) return;
      fechado = true;
      cancelaveis.delete(cancelar);
      limpezas.forEach((f) => { try { f(); } catch (e) { /* ignora */ } });
      resolve(cancelado);
    };
    const cancelar = () => encerrar(true);
    cancelaveis.add(cancelar);
    try {
      iniciar({
        fim: () => encerrar(false),
        aoLimpar: (f) => limpezas.push(f),
      });
    } catch (e) {
      encerrar(false);
    }
  });
}

function esperar(ms) {
  return passo(({ fim, aoLimpar }) => {
    const t = setTimeout(fim, Math.max(0, ms));
    aoLimpar(() => clearTimeout(t));
  });
}

// ---------- arquivos ----------
async function existeUrl(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.status === 200; // o service worker responde 204 para gravação inexistente
  } catch (e) {
    return false;
  }
}

const temControlador = () => typeof navigator !== 'undefined' && navigator.serviceWorker && !!navigator.serviceWorker.controller;

// Índice dos arquivos de áudio existentes (gerado por ferramentas/gerar-sw.mjs).
// Com o índice não há requisições a arquivos inexistentes (sem 404 no console).
let indice = null; // Set de caminhos, ou false se não houver índice
let carregandoIndice = null;
function carregarIndice() {
  if (indice !== null) return Promise.resolve(indice);
  if (!carregandoIndice) {
    carregandoIndice = fetch(BASE_GERADO + 'indice.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((lista) => { indice = Array.isArray(lista) ? new Set(lista) : false; return indice; })
      .catch(() => { indice = false; return indice; });
  }
  return carregandoIndice;
}

// ---------- gravações da adulta (neste aparelho, têm prioridade máxima) ----------
let gravIds = null; // Set de ids gravados
let carregandoGrav = null;
let geracao = 0; // muda quando as gravações mudam; resoluções antigas não entram no cache
const urlsGrav = new Map(); // id -> blob: URL

function carregarGravados() {
  if (gravIds) return Promise.resolve(gravIds);
  if (!carregandoGrav) {
    carregandoGrav = gravacoes.listarIds()
      .then((s) => { gravIds = s; return s; })
      .catch(() => { gravIds = new Set(); return gravIds; });
  }
  return carregandoGrav;
}

async function urlGravacao(id) {
  const ids = await carregarGravados();
  if (!ids.has(id)) return null;
  if (urlsGrav.has(id)) return urlsGrav.get(id);
  const blob = await gravacoes.obter(id);
  if (!blob) return null;
  try {
    const u = URL.createObjectURL(blob);
    urlsGrav.set(id, u);
    return u;
  } catch (e) {
    return null;
  }
}

/** A tela de gravação chama depois de salvar/apagar: limpa os caches e recarrega o conjunto. */
export function gravacoesMudaram() {
  geracao++;
  urlsGrav.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* ignora */ } });
  urlsGrav.clear();
  existe.clear();
  buscas.clear();
  gravIds = null;
  carregandoGrav = null;
  return carregarGravados().then(() => undefined);
}

function resolverArquivo(id) {
  if (existe.has(id)) return Promise.resolve(existe.get(id));
  if (buscas.has(id)) return buscas.get(id);
  const minha = geracao;
  const p = (async () => {
    const gravada = await urlGravacao(id);
    if (gravada) {
      if (minha === geracao) { buscas.delete(id); existe.set(id, gravada); }
      return gravada;
    }
    const candidatos = [BASE_GRAVACOES + id + '.mp3', BASE_GRAVACOES + id + '.m4a'];
    if (id.startsWith('som_')) candidatos.push(BASE_GERADO + id + '.mp3');
    const idx = await carregarIndice();
    let achada = null;
    let pulou = false;
    for (const url of candidatos) {
      if (idx && idx.has(url)) { achada = url; break; }
      if (url.startsWith(BASE_GRAVACOES)) {
        // Sem service worker no controle, a sondagem geraria 404 no console: pula.
        if (!temControlador()) { pulou = true; continue; }
        if (await existeUrl(url)) { achada = url; break; }
      } else if (!idx && (await existeUrl(url))) { achada = url; break; }
    }
    if (minha !== geracao) return achada; // as gravações mudaram no meio: não memoriza
    buscas.delete(id);
    if (!achada && pulou) return null; // não memoriza: tenta de novo quando o SW assumir
    existe.set(id, achada);
    return achada;
  })();
  buscas.set(id, p);
  return p;
}

function tocarArquivo(url) {
  return passo(({ fim, aoLimpar }) => {
    const a = new Audio(url);
    a.preload = 'auto';
    let seguranca = setTimeout(fim, 20000);
    aoLimpar(() => {
      clearTimeout(seguranca);
      try { a.pause(); } catch (e) { /* ignora */ }
      a.onended = a.onerror = a.onloadedmetadata = null;
      try { a.removeAttribute('src'); a.load(); } catch (e) { /* ignora */ }
    });
    a.onended = fim;
    a.onerror = fim;
    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) {
        clearTimeout(seguranca);
        seguranca = setTimeout(fim, a.duration * 1000 + 2500);
      }
    };
    let p;
    try { p = a.play(); } catch (e) { fim(); return; }
    if (p && typeof p.catch === 'function') p.catch(() => fim());
  });
}

// ---------- fala do aparelho ----------
function falarComVoz(texto, id) {
  if (!temSS()) {
    console.info('[audio] sem speechSynthesis; pulando', id);
    return Promise.resolve(false);
  }
  if (!voz) atualizarVoz();
  let n = 0;
  try { n = speechSynthesis.getVoices().length; } catch (e) { /* ignora */ }
  if (!voz && n > 0) {
    console.info('[audio] sem voz pt-BR no aparelho; pulando', id);
    return Promise.resolve(false);
  }
  console.info('[audio] usando voz do aparelho para', id);
  return passo(({ fim, aoLimpar }) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    if (voz) u.voice = voz;
    u.rate = 0.9;
    u.pitch = 1.1;
    u.volume = 1;
    // No Android o onend às vezes não dispara: timeout proporcional ao texto.
    const limite = 1500 + texto.length * 130;
    const t = setTimeout(fim, limite);
    aoLimpar(() => {
      clearTimeout(t);
      u.onend = u.onerror = null;
      try { speechSynthesis.cancel(); } catch (e) { /* ignora */ }
    });
    u.onend = fim;
    u.onerror = fim;
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      if (speechSynthesis.paused) speechSynthesis.resume();
    } catch (e) {
      fim();
    }
  });
}

// ---------- itens ----------
function textoFrase(chave, vars) {
  let t = cfg.frases && cfg.frases[chave];
  if (typeof t !== 'string') return '';
  const nome = ((vars && vars.nome) || (cfg.obterNome && cfg.obterNome()) || '').toString().trim() || 'princesa';
  return t.replace(/\{nome\}/g, nome).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : ''));
}

function normalizar(itens) {
  const lista = Array.isArray(itens) ? itens : [itens];
  const saida = [];
  for (const it of lista) {
    if (it == null) continue;
    if (typeof it === 'object') {
      if (it.frase) saida.push({ tipo: 'frase', chave: it.frase, vars: it.vars });
      else if (it.som) saida.push({ tipo: 'som', chave: it.som });
      else if (it.sil) saida.push({ tipo: 'sil', chave: it.sil });
      else if (it.pal) saida.push({ tipo: 'pal', chave: it.pal });
      else if (it.pausa != null) saida.push({ tipo: 'pausa', chave: it.pausa });
      else if (it.efeito) saida.push({ tipo: 'efeito', chave: it.efeito });
      continue;
    }
    const s = String(it);
    const i = s.indexOf(':');
    if (i < 0) continue;
    saida.push({ tipo: s.slice(0, i), chave: s.slice(i + 1) });
  }
  return saida;
}

const ID_PREFIXO = { frase: 'frase_', som: 'som_', sil: 'sil_', pal: 'pal_' };

// Texto de reserva para a voz do aparelho (nunca o nome de uma consoante).
function textoReserva(tipo, chave, vars) {
  const cur = cfg.curriculo || {};
  if (tipo === 'frase') return textoFrase(chave, vars);
  if (tipo === 'sil') {
    const s = cur.silabas && cur.silabas[chave];
    return (s && (s.tts || (s.texto || '').toLowerCase())) || '';
  }
  if (tipo === 'pal') {
    const p = cur.palavras && cur.palavras[chave];
    return (p && (p.tts || chave)) || chave;
  }
  if (tipo === 'som') {
    const l = cur.letras && cur.letras[chave];
    if (!l) return '';
    if (l.tts) return l.tts;
    // oclusivas: fala a primeira palavra-âncora em vez do som
    const ancora = l.palavras && l.palavras[0];
    if (ancora) {
      const p = cur.palavras && cur.palavras[ancora];
      return (p && (p.tts || ancora)) || ancora;
    }
    return '';
  }
  return '';
}

async function executarItem(item, meu) {
  const { tipo, chave } = item;
  if (tipo === 'pausa') return esperar(parseInt(chave, 10) || 0);
  if (tipo === 'efeito') {
    const dur = tocarEfeito(chave);
    return esperar(dur);
  }
  if (!ID_PREFIXO[tipo]) return false;
  const id = ID_PREFIXO[tipo] + chave;
  const url = await resolverArquivo(id);
  if (meu !== seq) return true;
  if (url) return tocarArquivo(url);
  const texto = textoReserva(tipo, chave, item.vars);
  if (!texto) {
    if (!infoTtsAvisado.has(id)) { infoTtsAvisado.add(id); console.info('[audio] nada para falar em', id); }
    return false;
  }
  if (!vozesProntas) await carregarVozes();
  if (meu !== seq) return true;
  return falarComVoz(texto, id);
}

export function falar(itens) {
  const meu = ++seq;
  pararInterno();
  const lista = normalizar(itens);
  return (async () => {
    try {
      for (const item of lista) {
        if (meu !== seq) return { cancelado: true };
        const cancelou = await executarItem(item, meu);
        if (cancelou === true || meu !== seq) return { cancelado: true };
      }
      return { cancelado: meu !== seq };
    } catch (e) {
      console.info('[audio] falha ao falar', e && e.message);
      return { cancelado: meu !== seq };
    }
  })();
}

function pararInterno() {
  [...cancelaveis].forEach((f) => { try { f(); } catch (e) { /* ignora */ } });
  cancelaveis.clear();
  if (temSS()) { try { speechSynthesis.cancel(); } catch (e) { /* ignora */ } }
}

export function parar() {
  seq++;
  pararInterno();
  pararEfeitos();
}

// ---------- efeitos sintetizados ----------
const fontes = new Set();

function pararEfeitos() {
  fontes.forEach((o) => { try { o.stop(); } catch (e) { /* ignora */ } });
  fontes.clear();
}

const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12);

function tom({ tipo = 'sine', freq, fim, t0 = 0, dur = 0.3, vol = 0.3, ataque = 0.01 }) {
  const c = ctx;
  const t = c.currentTime + t0;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(mestre);
  o.start(t);
  o.stop(t + dur + 0.05);
  fontes.add(o);
  o.onended = () => fontes.delete(o);
}

// Retorna a duração em ms.
function tocarEfeito(nome) {
  const c = garantirContexto();
  if (!c) return 0;
  try {
    if (c.state === 'suspended') c.resume().catch(() => {});
    switch (nome) {
      case 'brilho': {
        [84, 88, 91, 96, 100].forEach((n, i) => tom({ freq: NOTA(n), t0: i * 0.07, dur: 0.35, vol: 0.18 }));
        tom({ freq: NOTA(103), t0: 0.35, dur: 0.5, vol: 0.12 });
        return 850;
      }
      case 'pop':
        tom({ freq: 700, fim: 180, dur: 0.12, vol: 0.4, ataque: 0.004 });
        return 160;
      case 'tchan': {
        [60, 64, 67, 72].forEach((n) => tom({ tipo: 'triangle', freq: NOTA(n), dur: 0.7, vol: 0.14, ataque: 0.015 }));
        [96, 100, 103, 108].forEach((n, i) => tom({ freq: NOTA(n), t0: 0.08 + i * 0.06, dur: 0.4, vol: 0.08 }));
        return 800;
      }
      case 'bolha':
        tom({ freq: 300, fim: 900, dur: 0.18, vol: 0.3, ataque: 0.02 });
        tom({ freq: 500, fim: 1300, t0: 0.12, dur: 0.14, vol: 0.15, ataque: 0.02 });
        return 300;
      case 'passo':
        tom({ freq: 160, fim: 70, dur: 0.12, vol: 0.35, ataque: 0.008 });
        return 150;
      default:
        console.info('[audio] efeito desconhecido', nome);
        return 0;
    }
  } catch (e) {
    return 0;
  }
}

export function efeito(nome) {
  const dur = tocarEfeito(nome);
  return esperar(dur).then(() => undefined);
}

// ---------- ciclo de vida ----------
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      parar();
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (ctx && ctx.state === 'suspended' && desbloqueado) {
      ctx.resume().catch(() => {}); // só reabilita a saída; nada volta a tocar sozinho
    }
  });
}
