// Biblioteca de apoio dos testes de ponta a ponta (E). Sem mocks do app: tudo roda contra o app real.
// Só o ÁUDIO é espionado (para saber o que o app mandou falar) e, opcionalmente, acelerado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');
export const aqui = path.dirname(fileURLToPath(import.meta.url));
export const raizProjeto = path.resolve(aqui, '..');
export const SHOTS = '/tmp/claude-0/e';
mkdirSync(SHOTS, { recursive: true });

export const curriculo = JSON.parse(readFileSync(path.join(raizProjeto, 'data/curriculo.json'), 'utf8'));
export const frases = JSON.parse(readFileSync(path.join(raizProjeto, 'data/frases.json'), 'utf8'));
export const tracados = JSON.parse(readFileSync(path.join(raizProjeto, 'data/tracados.json'), 'utf8'));

// ---------- relatório de checagens ----------
export function criarRelator(titulo, { quieto = false } = {}) {
  const r = { passou: 0, falhas: 0, avisos: [], titulo };
  r.ok = (cond, msg, detalhe) => {
    if (cond) { r.passou++; if (!quieto) console.log('  ok   ' + msg); } else {
      r.falhas++; console.log('  FALHA ' + msg + (detalhe ? '\n         ' + String(detalhe).replace(/\n/g, '\n         ') : ''));
    }
    return !!cond;
  };
  r.aviso = (msg) => { r.avisos.push(msg); console.log('  aviso ' + msg); };
  r.fim = () => {
    console.log(`\n${titulo}: ${r.passou} ok, ${r.falhas} falhas, ${r.avisos.length} avisos`);
    return r.falhas;
  };
  return r;
}

// ---------- servidor ----------
function portaLivre() {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
export async function iniciarServidor() {
  const porta = await portaLivre();
  const proc = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1'], { cwd: raizProjeto, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  return { base: `http://127.0.0.1:${porta}/`, origem: `http://127.0.0.1:${porta}`, parar: () => proc.kill() };
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export async function esperarAte(fn, { timeout = 15000, passo = 60, msg = 'condição' } = {}) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('tempo esgotado esperando: ' + msg);
    await dormir(passo);
  }
}

// ---------- abrir o app ----------
/**
 * opcoes: viewport {width,height}, seed (objeto de progresso), rapido (áudio fingido termina em 15 ms),
 * escala (multiplica setTimeout > 200ms), reduzirMovimento, sw ('allow'|'block'), contexto (já criado)
 */
export async function abrirApp(browser, base, opcoes = {}) {
  const vp = opcoes.viewport || { width: 360, height: 800 };
  const ctx = opcoes.contexto || await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    reducedMotion: opcoes.reduzirMovimento ? 'reduce' : 'no-preference',
    serviceWorkers: opcoes.sw || 'block', locale: 'pt-BR',
  });
  const page = await ctx.newPage();
  const coleta = { erros: [], avisos: [], infos: [], pageerrors: [], respostasRuins: [], requisicoesExternas: [], falhas: [] };
  const origem = new URL(base).origin;
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error') coleta.erros.push(m.text() + ' @' + (m.location().url || ''));
    else if (t === 'warning') { if (!/Service Worker registration blocked by Playwright/.test(m.text())) coleta.avisos.push(m.text()); }
    else if (t === 'info') coleta.infos.push(m.text());
  });
  page.on('pageerror', (e) => coleta.pageerrors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) coleta.respostasRuins.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => {
    const erro = (r.failure() && r.failure().errorText) || '';
    // net::ERR_ABORTED = um som interrompido pela fala seguinte (cancelamento normal), não arquivo faltando
    if (erro === 'net::ERR_ABORTED') return;
    coleta.falhas.push(erro + ' ' + r.url());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (/^(data|blob|about):/.test(u)) return;
    if (!u.startsWith(origem)) coleta.requisicoesExternas.push(u);
  });
  await page.addInitScript((o) => {
    const E = (window.__esp = { log: [] });
    const push = (x) => E.log.push(x);
    {
      const info = console.info.bind(console);
      console.info = function (...a) {
        if (typeof a[0] === 'string' && a[0].startsWith('[audio] usando voz do aparelho para')) push({ k: 'idvoz', id: String(a[1]) });
        return info(...a);
      };
    }
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      push({ k: 'audio', url: this.currentSrc || this.src });
      if (o.rapido) {
        const self = this;
        setTimeout(() => { try { self.onended && self.onended(); } catch (e) { /* ok */ } }, 15);
        return Promise.resolve();
      }
      return origPlay.apply(this, arguments);
    };
    if (window.speechSynthesis) {
      const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (u) {
        push({ k: 'fala', texto: u.text });
        if (o.rapido) { setTimeout(() => { try { u.onend && u.onend(); } catch (e) { /* ok */ } }, 15); return; }
        return origSpeak(u);
      };
    }
    {
      let desloc = 0;
      const dn = Date.now.bind(Date);
      Date.now = () => dn() + desloc;
      window.__deslocar = (ms) => { desloc += ms; };
    }
    if (o.escala && o.escala !== 1) {
      const st = window.setTimeout.bind(window);
      window.setTimeout = (f, ms, ...r) => st(f, ms > 200 ? ms * o.escala : ms, ...r);
    }
    if (o.semStorage) {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } });
    } else if (o.seed) {
      try {
        if (!sessionStorage.getItem('__semeado')) {
          localStorage.setItem('trilhaSons.v1', JSON.stringify(o.seed));
          sessionStorage.setItem('__semeado', '1');
        }
      } catch (e) { /* ok */ }
    }
  }, { rapido: !!opcoes.rapido, escala: opcoes.escala || 1, seed: opcoes.seed || null, semStorage: !!opcoes.semStorage });
  if (!opcoes.semNavegar) {
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { timeout: 10000 });
  }
  return { ctx, page, coleta, esp: criarEspiao(page) };
}

// ---------- espião de áudio ----------
function chaveDeTexto(texto, nome) {
  const t = (texto || '').trim();
  for (const [k, v] of Object.entries(frases)) {
    if (k.startsWith('_')) continue;
    const alvo = v.replace(/\{nome\}/g, nome || 'princesa');
    if (alvo === t) return k;
  }
  return null;
}
export function criarEspiao(page) {
  const e = {
    async bruto() {
      const b = await page.evaluate(() => window.__esp.log.slice());
      // cada fala recebe o id do áudio que a pediu (ex.: sil_pe, som_p, frase_acerto_1)
      let id = null;
      for (const x of b) { if (x.k === 'idvoz') id = x.id; else if (x.k === 'fala') { x.idvoz = id; id = null; } }
      return b;
    },
    async tamanho() { return page.evaluate(() => window.__esp.log.length); },
    /** Traduz o log: {tipo:'som'|'frase'|'fala'|'audio', id, ...}. */
    async eventos(desde = 0, nome = '') {
      const b = await page.evaluate((d) => window.__esp.log.slice(d), desde);
      return b.map((x, i) => ({ x, i })).filter((o) => o.x.k !== 'idvoz').map(({ x, i }) => {
        const idx = desde + i;
        if (x.k === 'audio') {
          const m = /\/(som|sil|pal|frase)_([a-z0-9_]+)\.(mp3|m4a)/.exec(x.url);
          return { idx, tipo: m ? m[1] : 'audio', id: m ? m[2] : x.url, arquivo: true };
        }
        const chave = chaveDeTexto(x.texto, nome);
        return { idx, tipo: chave ? 'frase' : 'fala', id: chave || x.texto, texto: x.texto };
      });
    },
  };
  return e;
}

// ---------- coleta de texto e auditorias na página ----------
export const TELAS_SEL = {
  inicio: '.tela.inicio',
  guia: '.btn-guia',
  trilha: '.trilha-area',
  apresenta: '.apresenta',
  menu: '.menu-jogos',
  colecao: '.area-colecao',
  recompensa: '.recompensa .premio',
  despedida: '.recompensa .guia-festa:not(:has(+ .premio))',
  pais: '.tela.pais',
  jogoEscute: '.jogo-escute .j-opcoes',
  jogoCaca: '.jogo-caca .j-opcoes',
  jogoJunte: '.jogo-junte .j-pista',
  jogoTrace: '.jogo-trace .j-trace-svg',
};

/** Roda dentro da página. Devolve { textos, problemasToque, foraTela, rolagem, semAria, estilos }. */
export function auditarNaPagina(opcoes) {
  const vw = innerWidth, vh = innerHeight;
  const visivel = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    let p = e;
    while (p && p.nodeType === 1) {
      const c = getComputedStyle(p);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false;
      p = p.parentElement;
    }
    return true;
  };
  const noSvgInterno = (e) => !!(e.closest && e.closest('svg') && e.tagName.toLowerCase() !== 'svg');
  const descr = (e) => {
    const c = typeof e.className === 'string' ? e.className : '';
    return e.tagName.toLowerCase() + (c ? '.' + c.trim().split(/\s+/).join('.') : '') + (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : '');
  };
  const out = { textos: [], textosAdulta: [], toque: [], foraTela: [], semAria: [], rolagem: null, estilos: {}, dimTela: [vw, vh] };

  // textos visíveis (nós de texto próprios)
  const todos = [...document.body.querySelectorAll('*')];
  for (const e of todos) {
    if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
    if (!visivel(e)) continue;
    // texto escrito para a adulta (rótulo de botão, legenda da fala, indicador de etapa) vem marcado com data-i;
    // fica separado do conteúdo da criança (letras, sílabas, palavras)
    const paraAdulta = !!(e.closest && e.closest('[data-i]'));
    for (const n of e.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) (paraAdulta ? out.textosAdulta : out.textos).push(n.textContent.trim());
    }
  }

  // alvos de toque
  const alvos = [...document.querySelectorAll('button, [role="button"], .j-bloco, a[href], input, select, textarea')].filter(visivel);
  for (const e of alvos) {
    const r = e.getBoundingClientRect();
    const prob = [];
    if (r.width < 63.5 || r.height < 63.5) prob.push(`tamanho ${Math.round(r.width)}x${Math.round(r.height)}`);
    const m = opcoes && opcoes.margem != null ? opcoes.margem : 12;
    if (r.left < m - 0.5 || r.top < m - 0.5 || r.right > vw - m + 0.5 || r.bottom > vh - m + 0.5) {
      prob.push(`borda (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    if (prob.length) out.toque.push(descr(e) + ': ' + prob.join('; '));
    if ((e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && !(e.getAttribute('aria-label') || '').trim()) out.semAria.push(descr(e));
  }
  // nada fora da tela
  const candidatos = [...document.querySelectorAll('button, img, h1, h2, p, .j-bloco, .j-letra, .letra, .letra-gigante, .j-trace-svg, .j-pista, .j-sereia, .conta')]
    .filter((e) => visivel(e) && !noSvgInterno(e) && !e.closest('.j-cintila'));
  for (const e of candidatos) {
    const r = e.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.foraTela.push(`${descr(e)} (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)})`);
  }
  // rolagem
  const se = document.scrollingElement;
  out.rolagem = { sh: se.scrollHeight, sw: se.scrollWidth, ih: vh, iw: vw };
  const app = document.getElementById('app');
  out.rolagem.appSH = app.scrollHeight; out.rolagem.appCH = app.clientHeight;
  // sobreposição de alvos de toque (botões grandes cobrindo um ao outro)
  out.sobrepostos = [];
  for (let i = 0; i < alvos.length; i++) {
    for (let j = i + 1; j < alvos.length; j++) {
      if (alvos[i].contains(alvos[j]) || alvos[j].contains(alvos[i])) continue;
      const a = alvos[i].getBoundingClientRect(), b = alvos[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) out.sobrepostos.push(`${descr(alvos[i])} x ${descr(alvos[j])} (${Math.round(w)}x${Math.round(h)})`);
    }
  }
  // estilos globais
  const cs = (e) => getComputedStyle(e);
  out.estilos = {
    htmlTouch: cs(document.documentElement).touchAction, bodyTouch: cs(document.body).touchAction,
    htmlOverscroll: cs(document.documentElement).overscrollBehaviorY, bodyOverscroll: cs(document.body).overscrollBehaviorY,
    bodyUserSelect: cs(document.body).userSelect,
  };
  const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(ev);
  out.estilos.contextMenuBloqueado = ev.defaultPrevented;
  const vm = document.querySelector('meta[name=viewport]');
  out.estilos.viewport = vm ? vm.content : '';
  return out;
}

/** Cores: procura vermelho "puro" (r>200, g<80, b<80) em elementos; devolve lista de descrições. */
export function procurarVermelhoNaPagina(seletor) {
  const achados = [];
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const vermelho = (c) => c && c.a > 0.05 && c.r > 200 && c.g < 80 && c.b < 80;
  const els = [...document.querySelectorAll(seletor + ', ' + seletor + ' *')];
  for (const e of els) {
    const c = getComputedStyle(e);
    for (const prop of ['backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'color', 'outlineColor', 'fill', 'stroke']) {
      const col = parse(c[prop]);
      if (vermelho(col)) achados.push(`${e.tagName}.${e.className} ${prop}=${c[prop]}`);
    }
    const sombra = c.boxShadow || '';
    for (const m of sombra.matchAll(/rgba?\([^)]+\)/g)) { if (vermelho(parse(m[0]))) achados.push(`${e.tagName}.${e.className} boxShadow=${m[0]}`); }
    const filtro = c.filter || '';
    if (/hue-rotate|sepia/.test(filtro)) achados.push(`${e.tagName}.${e.className} filter=${filtro}`);
  }
  return achados;
}

export async function auditar(page, opcoes = {}) {
  // pausa as animações infinitas (pulsa, flutua...) no instante 0 para medir o layout em repouso
  await page.evaluate(() => {
    window.__pausadas = [];
    for (const a of document.getAnimations()) {
      try {
        if (a.effect.getComputedTiming().iterations === Infinity) { window.__pausadas.push([a, a.currentTime]); a.pause(); a.currentTime = 0; }
      } catch (e) { /* ok */ }
    }
  });
  try {
    return await page.evaluate(auditarNaPagina, opcoes);
  } finally {
    await page.evaluate(() => { for (const [a, t] of window.__pausadas || []) { try { a.currentTime = t; a.play(); } catch (e) { /* ok */ } } window.__pausadas = []; });
  }
}

// ---------- navegação e toque ----------
/** Toque real (eventos de toque) no centro do elemento; confere que o elemento é o que recebe o toque. */
export async function tocar(page, seletor, { indice = 0, desvio = null } = {}) {
  const loc = page.locator(seletor).nth(indice);
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  await loc.evaluate((e) => { const r = e.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) e.scrollIntoView({ block: 'center' }); });
  const cx = await loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const topo = await loc.evaluate((e, c) => {
    const t = document.elementFromPoint(c.x, c.y);
    return !!t && (t === e || e.contains(t) || t.contains(e));
  }, cx);
  await page.touchscreen.tap(cx.x, cx.y);
  return topo;
}

export async function qualTela(page) {
  return page.evaluate((sel) => {
    for (const [nome, s] of Object.entries(sel)) {
      try { const e = document.querySelector(s); if (e) { const r = e.getBoundingClientRect(); if (r.width > 0) return nome; } } catch (err) { /* seletor sem suporte */ }
    }
    return null;
  }, TELAS_SEL);
}
export async function esperarTela(page, nome, timeout = 20000) {
  await esperarAte(async () => (await qualTela(page)) === nome, { timeout, msg: 'tela ' + nome });
}

export async function tirarFoto(page, nome) {
  try { await page.screenshot({ path: path.join(SHOTS, nome + '.png') }); } catch (e) { /* ok */ }
}

// ---------- jogar como uma criança ----------
export function criarJogador(page, esp, relator, { nome = '', errar = true, foto = null, aoAuditar = null, auditarTodos = false } = {}) {
  const J = { cartoesVistos: new Set(), palavrasJunte: new Set(), silabasJunte: new Set(), errosFeitos: 0, vermelhos: [], resultados: {}, tela: {} };
  const ok = relator.ok;

  async function cartoes() {
    return page.evaluate(() => [...document.querySelectorAll('.j-opcoes .j-cartao')].map((b) => ({
      letra: b.dataset.letra || null, palavra: b.dataset.palavra || null,
      desabilitado: b.disabled, some: b.classList.contains('j-some'), fora: b.classList.contains('j-fora'),
      visivel: (() => { const r = b.getBoundingClientRect(); const o = parseFloat(getComputedStyle(b).opacity); return r.width > 0 && o > 0.05; })(),
    })));
  }

  /** Espera a pergunta (frase) e o som seguinte, depois de `marca`. Devolve { letra, fim }. */
  async function esperarAlvo(chavePergunta, marca, tipoAlvo = 'som') {
    return esperarAte(async () => {
      const ev = await esp.eventos(marca, nome);
      const ip = ev.findLastIndex((x) => x.tipo === 'frase' && x.id === chavePergunta);
      if (ip < 0) return null;
      const s = ev.slice(ip + 1).find((x) => x.tipo === tipoAlvo);
      return s ? { id: s.id, fim: ev[ev.length - 1].idx + 1 } : null;
    }, { timeout: 15000, msg: 'pergunta ' + chavePergunta });
  }

  async function checarSemVermelho(rotulo) {
    const v = await page.evaluate(procurarVermelhoNaPagina, '.j-opcoes');
    if (v.length) J.vermelhos.push(rotulo + ': ' + v.join(' | '));
  }

  /** Erra de propósito: toca opções erradas (n vezes); confere erro sem punição. */
  async function errarEm(seletorCartao, ehCerto, chaveFalaErro, alvoId) {
    const antes = await cartoes();
    const visiveisAntes = antes.filter((c) => c.visivel && !c.desabilitado).length;
    const errado = antes.findIndex((c) => !ehCerto(c) && c.visivel && !c.desabilitado);
    if (errado < 0) return;
    const marca = await esp.tamanho();
    await tocar(page, seletorCartao, { indice: errado });
    J.errosFeitos++;
    // durante a balançada: sem vermelho
    await dormir(200);
    await checarSemVermelho('durante erro');
    await esperarAte(async () => (await cartoes())[errado].desabilitado, { timeout: 4000, msg: 'opção errada some' });
    const depois = await cartoes();
    const visiveisDepois = depois.filter((c) => c.visivel && !c.desabilitado).length;
    ok(visiveisDepois === visiveisAntes - 1, `erro: opções diminuem (${visiveisAntes} -> ${visiveisDepois})`);
    ok(depois[errado].some, 'erro: a opção errada recebe j-some (some suavemente)');
    const ev = await esperarAte(async () => {
      const e = await esp.eventos(marca, nome);
      const q = e.findIndex((x) => x.tipo === 'frase' && x.id === chaveFalaErro);
      return q >= 0 && e.slice(q + 1).some((x) => x.tipo === alvoId.tipo && (x.id === alvoId.id || x.texto)) ? e : null;
    }, { timeout: 6000, msg: 'fala de erro' }).catch(async () => esp.eventos(marca, nome));
    const quase = ev.findIndex((x) => x.tipo === 'frase' && x.id === chaveFalaErro);
    const repetiu = ev.slice(quase + 1).some((x) => (x.tipo === alvoId.tipo && x.id === alvoId.id) || (alvoId.tipo === 'pal' && ['fala', 'pal', 'sil'].includes(x.tipo)));
    ok(quase >= 0 && repetiu, `erro: fala "quase" e repete o alvo (${alvoId.tipo}:${alvoId.id})`, JSON.stringify(ev.slice(0, 6)));
    ok(ev.every((x) => !/erro|falha|buzina/i.test(x.id)), 'erro: sem som de falha');
    ok(!(await page.locator('.recompensa').count()), 'erro: nenhuma tela de fracasso');
    await checarSemVermelho('depois do erro');
  }

  // ----- Escute e Toque -----
  async function escute(erraNoItem) {
    const N = curriculo.regras.itensPorRodada;
    let marca = await esp.tamanho();
    for (let i = 0; i < N; i++) {
      const alvo = await esperarAlvo('escute_pergunta', marca);
      const cs = await esperarAte(async () => { const c = await cartoes(); return c.length >= 2 ? c : null; }, { msg: 'cartões do escute' });
      cs.forEach((c) => J.cartoesVistos.add('letra:' + c.letra));
      ok(cs.some((c) => c.letra === alvo.id), `escute ${i + 1}: o som tocado ("${alvo.id}") tem a letra entre as opções`);
      if (i === 0 || auditarTodos) await verTela('jogoEscute' + (auditarTodos ? '-' + cs.length + 'op' : ''));
      if (erraNoItem(i) && errar) {
        await errarEm('.j-opcoes .j-cartao', (c) => c.letra === alvo.id, 'quase', { tipo: 'som', id: alvo.id });
      }
      const idx = (await cartoes()).findIndex((c) => c.letra === alvo.id);
      await tocar(page, '.j-opcoes .j-cartao', { indice: idx });
      marca = await esp.tamanho();
      await dormir(150);
    }
  }

  // ----- Caça-Som -----
  async function caca(erraNoItem) {
    const N = curriculo.regras.itensPorRodada;
    let marca = await esp.tamanho();
    for (let i = 0; i < N; i++) {
      const alvo = await esperarAlvo('caca_pergunta', marca);
      const cs = await esperarAte(async () => { const c = await cartoes(); return c.length >= 2 ? c : null; }, { msg: 'cartões da caça' });
      cs.forEach((c) => J.cartoesVistos.add('pal:' + c.palavra));
      const ehCerta = (c) => curriculo.palavras[c.palavra] && curriculo.palavras[c.palavra].inicial === alvo.id;
      ok(cs.filter(ehCerta).length === 1, `caça ${i + 1}: exatamente uma figura começa com o som "${alvo.id}"`, JSON.stringify(cs));
      if (i === 0 || auditarTodos) await verTela('jogoCaca' + (auditarTodos ? '-' + cs.length + 'op' : ''));
      if (erraNoItem(i) && errar) await errarEm('.j-opcoes .j-cartao', ehCerta, 'quase', { tipo: 'som', id: alvo.id });
      const idx = (await cartoes()).findIndex(ehCerta);
      await tocar(page, '.j-opcoes .j-cartao', { indice: idx });
      marca = await esp.tamanho();
      await dormir(150);
    }
  }

  // ----- Junte os Sons -----
  async function junte(erraNoItem) {
    const N = curriculo.regras.itensPorRodada;
    let marca = await esp.tamanho();
    let feitos = 0, visto = 0;
    let t0 = Date.now();
    while (feitos < N) {
      if (Date.now() - t0 > 90000) throw new Error('junte travou');
      const st = await page.evaluate(() => ({
        blocos: [...document.querySelectorAll('.j-bloco')].map((b) => ({ t: b.textContent.trim(), aceso: b.classList.contains('j-aceso') })),
        juntos: !!document.querySelector('.j-blocos.j-juntos'),
        escolhas: document.querySelector('.j-opcoes-junte.j-visivel') ? [...document.querySelectorAll('.j-opcoes-junte .j-cartao')].map((b) => ({ p: b.dataset.palavra, dis: b.disabled, v: parseFloat(getComputedStyle(b).opacity) > 0.05 })) : null,
        prog: document.querySelectorAll('.j-progresso .j-feito').length,
        fim: !!document.querySelector('.recompensa'),
      }));
      if (st.fim) break;
      if (st.prog > feitos) { feitos = st.prog; t0 = Date.now(); continue; }
      if (st.escolhas && st.escolhas.length) {
        const texto = st.blocos.map((b) => b.t).join('');
        const certa = Object.keys(curriculo.palavras).find((id) => curriculo.palavras[id].texto === texto);
        ok(!!certa, `junte: blocos "${texto}" formam uma palavra do currículo`);
        J.palavrasJunte.add(certa);
        // áudio: junte_resultado + pal da palavra certa
        const ev = await esp.eventos(marca, nome);
        const ir = ev.findIndex((x) => x.tipo === 'frase' && x.id === 'junte_resultado');
        const texPal = (curriculo.palavras[certa].tts || certa);
        const falouPal = ev.slice(ir + 1).some((x) => (x.tipo === 'pal' && x.id === certa) || (x.texto && x.texto.trim() === texPal));
        ok(ir >= 0 && falouPal, `junte: fala "Juntando fica assim" e a palavra "${texPal}"`, JSON.stringify(ev.slice(-6)));
        if (visto === 0) await verTela('jogoJunte');
        visto++;
        const cs = await cartoes();
        ok(cs.length === 2, 'junte: duas figuras para escolher');
        if (erraNoItem(visto - 1) && errar) {
          await errarEm('.j-opcoes-junte .j-cartao', (c) => c.palavra === certa, 'quase', { tipo: 'pal', id: certa }).catch((e) => relator.ok(false, 'junte erro: ' + e.message));
        }
        const idx = (await cartoes()).findIndex((c) => c.palavra === certa);
        await tocar(page, '.j-opcoes-junte .j-cartao', { indice: idx });
        marca = await esp.tamanho();
        await esperarAte(async () => (await page.evaluate(() => document.querySelectorAll('.j-progresso .j-feito').length)) > feitos || !!(await page.locator('.recompensa').count()), { timeout: 8000, msg: 'avançar após escolha' }).catch(() => {});
        continue;
      }
      if (st.juntos && !st.escolhas && st.blocos.length) { J.silabasJunte.add(st.blocos.map((b) => b.t).join('')); await dormir(200); continue; }
      if (st.blocos.length && !st.juntos && st.blocos.some((b) => !b.aceso)) {
        if (!J.junteDe) { J.junteDe = true; await verTela('jogoJunte'); }
        await tocar(page, '.j-sereia');
        await dormir(250);
        continue;
      }
      await dormir(150);
    }
  }

  // ----- Trace -----
  async function trace() {
    const cdp = await page.context().newCDPSession(page);
    // a instrução pode ter sido falada antes desta função começar: olha também os últimos eventos
    let marca = Math.max(0, (await esp.tamanho()) - 20);
    // pelo menu de brincadeiras o Trace abre uma grade com as 26 letras (modo livre: 3 letras);
    // na lição ele traça direto o par da letra foco e de uma revisão (2 letras)
    await esperarAte(async () => page.locator('.j-cartao-letra, .j-trace-svg').count(), { msg: 'grade ou traçado' });
    const livre = (await page.locator('.j-cartao-letra').count()) > 0;
    const nLetras = livre ? 3 : 2;
    const escolhas = ['m', 'h', 'a', 'p']; // inclui uma letra sem som no currículo (h)
    for (let n = 0; n < nLetras; n++) {
      let letra;
      if (livre) {
        await esperarAte(async () => page.locator('.j-cartao-letra').count(), { msg: 'grade de letras' });
        if (n === 0) await verTela('jogoTraceGrade');
        letra = escolhas[n];
        await tocar(page, `.j-cartao-letra[data-letra="${letra}"]`);
      } else {
        let alvo;
        try { alvo = await esperarAlvo('trace_instrucao', marca); } catch (e) {
          if (await page.locator('.recompensa').count()) break;
          throw e;
        }
        letra = alvo.id;
      }
      await esperarAte(async () => page.locator('.j-trace-svg').count(), { msg: 'svg do trace' });
      if (n === 0) await verTela('jogoTrace');
      ok(!!tracados.letras[letra], `trace: há traçado para "${letra}"`);
      // pontos do pontilhado em px de tela, lidos do DOM com a matriz real do SVG (o que a criança vê; vale para os dois layouts)
      const traços = await page.evaluate(() => [...document.querySelectorAll('.j-trace-svg .j-trace-pontos')].map((pl) => {
        const m = pl.getScreenCTM();
        return [...pl.points].map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }));
      }));
      let tid = 1;
      for (const t of traços) {
        const toque = (p) => ({ x: p.x, y: p.y, id: tid, radiusX: 8, radiusY: 8, force: 1 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [toque(t[0])] });
        for (let i = 1; i < t.length; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [toque(t[i])] });
          await dormir(12);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        tid++;
        await dormir(120);
      }
      const completou = await esperarAte(async () => page.evaluate(() => !!document.querySelector('.j-trace-completa') || !document.querySelector('.j-trace-svg')), { timeout: 5000, msg: 'letra completa' }).catch(() => false);
      ok(!!completou, `trace: arrastar pelo caminho real completa a letra "${letra}"`);
      marca = await esp.tamanho();
      await esperarAte(async () => page.evaluate(() => !document.querySelector('.j-trace-completa')) || page.locator('.recompensa').count(), { timeout: 8000 }).catch(() => {});
    }
  }

  async function verTela(nomeTela) {
    await dormir(350);
    if (aoAuditar) await aoAuditar(nomeTela);
  }

  /** Joga a rodada do jogo que estiver na tela. Devolve o id do jogo. */
  async function jogarRodada() {
    const jogo = await esperarAte(async () => page.evaluate(() => {
      const r = document.querySelector('.raiz-jogo');
      if (!r) return null;
      const m = /jogo-(escute|caca|junte|trace)/.exec(r.className);
      return m ? m[1] : null;
    }), { timeout: 15000, msg: 'um jogo na tela' });
    const quando = (i) => i % 3 === 0; // erra no 1º, 4º... item
    if (jogo === 'escute') await escute(quando);
    else if (jogo === 'caca') await caca(quando);
    else if (jogo === 'junte') await junte((i) => i % 2 === 0);
    else await trace();
    await esperarAte(async () => !(await page.locator('.raiz-jogo').count()), { timeout: 20000, msg: 'o jogo sair da tela' });
    return jogo;
  }

  Object.assign(J, { jogarRodada, esperarAlvo, cartoes });
  return J;
}

// ---------- verificação de uma auditoria ----------
export function textosPermitidos() {
  const s = new Set();
  for (const l of Object.values(curriculo.letras)) s.add(l.maiuscula);
  for (const x of Object.values(curriculo.silabas)) s.add(x.texto);
  for (const p of Object.values(curriculo.palavras)) s.add(p.texto);
  return s;
}
const PERMITIDOS = textosPermitidos();
// no Trace livre as 26 letras (maiúscula e minúscula) são o próprio conteúdo da grade, não instrução
for (const c of 'abcdefghijklmnopqrstuvwxyz') { PERMITIDOS.add(c); PERMITIDOS.add(c.toUpperCase()); }

/** Confere uma auditoria de tela da criança. rotulo identifica tela+viewport nas mensagens. */
export function verificarAuditoria(relator, rotulo, a, { exigirSemRolagem = true, textoLivre = false } = {}) {
  const ok = relator.ok;
  if (!textoLivre) {
    const ruins = a.textos.filter((t) => !PERMITIDOS.has(t));
    // a tela da criança continua funcionando só com áudio: o texto visível existe só como rótulo/legenda/indicador (data-i) ou conteúdo (letras, sílabas, palavras)
    ok(ruins.length === 0, `${rotulo}: texto visível só como conteúdo ou rótulo/legenda para a adulta`, 'texto indevido: ' + JSON.stringify(ruins));
  }
  ok(a.toque.length === 0, `${rotulo}: alvos de toque >= 64px e >= 12px das bordas`, a.toque.join('\n'));
  ok(a.semAria.length === 0, `${rotulo}: todo botão tem aria-label`, a.semAria.join(', '));
  ok(a.foraTela.length === 0, `${rotulo}: nada sai da tela`, a.foraTela.join('\n'));
  if (exigirSemRolagem) {
    const r = a.rolagem;
    ok(r.sh <= r.ih + 1 && r.sw <= r.iw + 1 && r.appSH <= r.appCH + 1, `${rotulo}: não rola`, JSON.stringify(r));
  }
  ok(a.sobrepostos.length === 0, `${rotulo}: alvos de toque não se sobrepõem`, a.sobrepostos.join('\n'));
}
export function verificarEstilos(relator, rotulo, e) {
  const ok = relator.ok;
  ok(/manipulation|none/.test(e.htmlTouch) || /manipulation|none/.test(e.bodyTouch), `${rotulo}: touch-action sem zoom por duplo toque`, JSON.stringify(e));
  ok(e.htmlOverscroll === 'none' || e.bodyOverscroll === 'none', `${rotulo}: overscroll-behavior none`, JSON.stringify(e));
  ok(e.bodyUserSelect === 'none', `${rotulo}: sem seleção de texto`);
  ok(e.contextMenuBloqueado, `${rotulo}: menu de contexto bloqueado`);
  ok(/user-scalable=no/.test(e.viewport), `${rotulo}: viewport sem zoom`, e.viewport);
}

// ---------- inegociável: nunca falar nome de consoante ----------
const NOMES_CONSOANTES = ['eme', 'pê', 'pe', 'bê', 'be', 'tê', 'te', 'efe', 'vê', 've', 'esse', 'ele', 'ene', 'dê', 'de', 'cê', 'ce', 'gê', 'ge', 'erre'];
/** Devolve as falas (speechSynthesis.speak) que são nome de consoante ou uma consoante sozinha. */
export function falasProibidas(bruto, { incluirSilabas = false } = {}) {
  const consoantes = Object.keys(curriculo.letras).filter((l) => curriculo.letras[l].tipo === 'consoante');
  const ruins = [];
  for (const x of bruto) {
    if (x.k !== 'fala') continue;
    const t = (x.texto || '').trim().toLowerCase();
    if (!t) continue;
    if (NOMES_CONSOANTES.includes(t) || (t.length === 1 && consoantes.includes(t))) {
      // a SÍLABA "pe" falada como "pê" é homófona do nome da letra, mas é a sílaba (id sil_*), não o nome da letra
      if (!incluirSilabas && x.idvoz && x.idvoz.startsWith('sil_')) continue;
      ruins.push(`${t} (${x.idvoz || '?'})`);
    }
  }
  return ruins;
}
/** Falas de sílabas que soam como nome de letra (informativo). */
export function silabasHomofonas(bruto) {
  return [...new Set(falasProibidas(bruto, { incluirSilabas: true }).filter((x) => /\(sil_/.test(x)))];
}
