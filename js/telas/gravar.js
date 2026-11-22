// Tela "Gravar minha voz" (para a adulta, por isso tem texto).
// As gravações ficam só neste aparelho (IndexedDB, ver js/gravacoes.js) e passam a valer no jogo na hora.
import { el } from '../ui.js';
import * as gravacoes from '../gravacoes.js';


// Nomes das letras fora do currículo (mesma tabela de js/audio.js; repetida aqui para a tela não depender do módulo de áudio).
const NOMES_EXTRA = { h: 'agá', k: 'cá', q: 'quê', w: 'dáblio', x: 'xis', y: 'ípsilon' };

const LIMITE_MS = 6000;
const TAXA_SAIDA = 22050;
const MARGEM_S = 0.06;
const PICO_ALVO = 0.9;
const PICO_MINIMO = 0.012; // abaixo disso a gravação é considerada muda

// ---------------------------------------------------------------------------
// Processamento do áudio gravado (funções puras exportadas para teste)
// ---------------------------------------------------------------------------

/** Mistura os canais de um AudioBuffer em um Float32Array mono. */
export function misturarMono(buf) {
  const n = buf.length;
  const saida = new Float32Array(n);
  const canais = buf.numberOfChannels;
  for (let c = 0; c < canais; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) saida[i] += d[i] / canais;
  }
  return saida;
}

/**
 * Corta o silêncio do começo e do fim (janelas de ~10 ms, limiar relativo ao pico de energia,
 * com piso mínimo) e deixa ~60 ms de margem. Devolve { dados, pico, inicio, fim }.
 */
export function recortarSilencio(dados, taxa) {
  const janela = Math.max(1, Math.round(taxa * 0.01));
  const nj = Math.floor(dados.length / janela);
  let pico = 0;
  for (let i = 0; i < dados.length; i++) { const a = Math.abs(dados[i]); if (a > pico) pico = a; }
  if (nj < 1 || pico <= 0) return { dados: dados.slice(0, 0), pico, inicio: 0, fim: 0 };
  const rms = new Float32Array(nj);
  let rmsMax = 0;
  for (let j = 0; j < nj; j++) {
    let s = 0;
    const b = j * janela;
    for (let i = 0; i < janela; i++) s += dados[b + i] * dados[b + i];
    rms[j] = Math.sqrt(s / janela);
    if (rms[j] > rmsMax) rmsMax = rms[j];
  }
  const limiar = Math.max(0.003, rmsMax * 0.06);
  let a = 0;
  while (a < nj && rms[a] < limiar) a++;
  let z = nj - 1;
  while (z > a && rms[z] < limiar) z--;
  if (a >= nj) return { dados: dados.slice(0, 0), pico, inicio: 0, fim: 0 };
  const margem = Math.round(taxa * MARGEM_S);
  const inicio = Math.max(0, a * janela - margem);
  const fim = Math.min(dados.length, (z + 1) * janela + margem);
  return { dados: dados.slice(inicio, fim), pico, inicio, fim };
}

/** Ajusta o pico para o valor alvo. */
export function normalizar(dados, alvo = PICO_ALVO) {
  let pico = 0;
  for (let i = 0; i < dados.length; i++) { const a = Math.abs(dados[i]); if (a > pico) pico = a; }
  if (pico <= 0) return dados;
  const g = alvo / pico;
  const s = new Float32Array(dados.length);
  for (let i = 0; i < dados.length; i++) s[i] = dados[i] * g;
  return s;
}

/** WAV PCM 16 bits mono. Devolve ArrayBuffer. */
export function codificarWav(dados, taxa) {
  const n = dados.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const v = new DataView(ab);
  const txt = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, dados[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return ab;
}

async function reamostrar(dados, taxaOrigem, taxaDestino) {
  if (taxaOrigem === taxaDestino) return dados;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const nSaida = Math.max(1, Math.ceil(dados.length * taxaDestino / taxaOrigem));
  const oac = new OAC(1, nSaida, taxaDestino);
  const buf = oac.createBuffer(1, dados.length, taxaOrigem);
  buf.copyToChannel(dados, 0);
  const src = oac.createBufferSource();
  src.buffer = buf;
  src.connect(oac.destination);
  src.start(0);
  const r = await oac.startRendering();
  return r.getChannelData(0).slice();
}

/**
 * Pipeline completo: decodifica, mono, recorta, reamostra, normaliza, WAV.
 * Devolve { mudo:true } se não houve som; { blob, tipo, duracao } caso contrário.
 * Se a decodificação falhar, devolve o blob original ({ original:true }).
 */
export async function processarGravacao(blobOriginal) {
  let buf;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = new AC();
    try { buf = await c.decodeAudioData(await blobOriginal.arrayBuffer()); } finally { try { c.close(); } catch (e) { /* ignora */ } }
  } catch (e) {
    return { blob: blobOriginal, tipo: blobOriginal.type, duracao: 0, original: true };
  }
  try {
    const mono = misturarMono(buf);
    const r = recortarSilencio(mono, buf.sampleRate);
    if (r.pico < PICO_MINIMO || r.dados.length < buf.sampleRate * 0.03) return { mudo: true };
    const leve = await reamostrar(r.dados, buf.sampleRate, TAXA_SAIDA);
    const final = normalizar(leve);
    const wav = new Blob([codificarWav(final, TAXA_SAIDA)], { type: 'audio/wav' });
    return { blob: wav, tipo: 'audio/wav', duracao: final.length / TAXA_SAIDA };
  } catch (e) {
    return { blob: blobOriginal, tipo: blobOriginal.type, duracao: buf.duration || 0, original: true };
  }
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

const semNome = (t) => t.replace(/,?\s*\{nome\}/g, '').replace(/\{nome\}\s*/g, '').replace(/\s+([!?.,])/g, '$1').replace(/\s{2,}/g, ' ').trim();

function montarGrupos(cur, frases) {
  const sons = (cur.ordem || []).map((l) => {
    const d = (cur.letras && cur.letras[l]) || {};
    return {
      id: 'som_' + l, item: { som: l }, tipo: 'som', alvo: d.maiuscula || l.toUpperCase(),
      dica: (d.dica || '').replace(/^Para a adulta:\s*/i, ''),
    };
  });
  // nomes das letras (nome_<l>): as do currículo e as 6 fora dele (usadas no Trace livre)
  const letrasNomes = [...(cur.ordem || []), ...Object.keys(NOMES_EXTRA)];
  const nomes = letrasNomes.map((l) => {
    const d = (cur.letras && cur.letras[l]) || {};
    const nome = d.nome || NOMES_EXTRA[l] || '';
    return {
      id: 'nome_' + l, item: { nome: l }, tipo: 'nome', alvo: d.maiuscula || l.toUpperCase(),
      dica: `Diga o NOME da letra: ${nome}`,
    };
  });
  const fr = Object.entries(frases || {})
    .filter(([k, t]) => !k.startsWith('_') && typeof t === 'string')
    .map(([k, t]) => ({ id: 'frase_' + k, item: { frase: k }, tipo: 'frase', alvo: semNome(t), dica: '' }));
  const sil = Object.entries(cur.silabas || {}).map(([k, s]) => ({
    id: s.audio || 'sil_' + k, item: { sil: k }, tipo: 'sil', alvo: (s.texto || k).toUpperCase(), dica: '',
  }));
  const pal = Object.entries(cur.palavras || {}).map(([k, p]) => ({
    id: p.audio || 'pal_' + k, item: { pal: k }, tipo: 'pal', alvo: (p.texto || k).toUpperCase(), dica: '',
  }));
  return [
    { chave: 'sons', titulo: 'Sons das letras (mais importante)', itens: sons, aberto: true,
      aviso: 'Fale só o SOM da letra, sem juntar vogal: "mmm" para o M; para o P, só o sopro dos lábios.' },
    { chave: 'nomes', titulo: 'Nomes das letras', itens: nomes, aberto: false,
      aviso: 'Aqui é o NOME da letra, não o som. Grave o nome sozinho, devagar e alegre. O jogo diz o nome e logo depois o som, sempre separados.' },
    { chave: 'frases', titulo: 'Frases', itens: fr, aberto: false },
    { chave: 'silabas', titulo: 'Sílabas', itens: sil, aberto: false, aviso: 'Fale a sílaba juntinha, como numa palavra: "má".' },
    { chave: 'palavras', titulo: 'Palavras', itens: pal, aberto: false },
  ];
}

function escolherMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const pref = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const m of pref) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignora */ } }
  return '';
}

/**
 * Editor de voz (para a adulta). Pode ficar dentro da Área dos pais (aba "Sua voz") ou numa tela própria.
 * Opções: aoVoltar (mostra "Voltar ao painel"), aoMudar(qtdGravada) (chamado quando a lista de gravações muda).
 * Devolve { no, destruir }.
 */
export function criarEditorVoz(app, { aoVoltar = null, aoMudar = null } = {}) {
    const tela = el('div', { classe: 'editor-voz gravar' });
    const audio = app.audio;
    let destruida = false;
    let gravando = null; // { id, rec, stream, chunks, timer, descartar }
    let processando = null; // id em processamento
    let ids = new Set();
    const linhas = new Map(); // id -> { atualizar }
    const confirmacoes = new Set(); // temporizadores de confirmação
    const grupos = montarGrupos(app.curriculo || {}, app.frases || {});

    const msg = el('p', { classe: 'aviso gv-msg', id: 'msg-gravar', attrs: { role: 'status', 'aria-live': 'polite' }, estilo: 'display:none' });
    const mostrar = (t, ruim = true) => {
      msg.textContent = t || '';
      msg.style.display = t ? '' : 'none';
      msg.classList.toggle('gv-ok', !ruim);
    };

    const voltar = () => aoVoltar && aoVoltar();
    const botaoVoltar = () => {
      if (!aoVoltar) return null;
      const b = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Voltar ao painel', attrs: { 'aria-label': 'Voltar ao painel', 'data-acao': 'voltar' } });
      b.addEventListener('click', voltar);
      return b;
    };

    function avisarAudio() {
      try { const r = audio.gravacoesMudaram && audio.gravacoesMudaram(); if (r && r.catch) r.catch(() => {}); return r; } catch (e) { return null; }
    }
    const ouvir = (it) => { try { audio.parar(); audio.falar([it.item]); } catch (e) { /* ignora */ } };

    function liberarMicrofone(g) {
      if (!g) return;
      clearTimeout(g.timer);
      try { g.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignora */ }
    }

    function atualizarTudo() {
      linhas.forEach((l) => l.atualizar());
      for (const gr of grupos) {
        const n = gr.itens.filter((i) => ids.has(i.id)).length;
        if (gr.contador) gr.contador.textContent = `${n} de ${gr.itens.length} gravados`;
      }
      if (total) total.textContent = ids.size === 1 ? '1 item gravado neste celular.' : `${ids.size} itens gravados neste celular.`;
      if (apagarTudo) apagarTudo.disabled = ids.size === 0;
      if (resumoVoz) resumoVoz.textContent = `${ids.size} de ${totalSons} sons com a sua voz`;
      if (aoMudar) { try { aoMudar(ids.size); } catch (e) { /* ignora */ } }
    }

    // ---------- gravar ----------
    function mensagemErro(e) {
      const n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
        return 'O microfone está bloqueado. No Chrome, toque no cadeado ao lado do endereço (ou em Configurações > Configurações do site > Microfone) e permita o microfone para este site. Depois tente de novo.';
      }
      if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return 'Não encontrei um microfone neste aparelho.';
      if (n === 'NotReadableError' || n === 'AbortError') return 'Não consegui usar o microfone. Feche outros aplicativos que possam estar usando e tente de novo.';
      return 'Não foi possível gravar agora. Tente de novo.';
    }

    async function iniciar(it) {
      if (gravando || processando) return;
      mostrar('');
      const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
        mostrar('Este navegador não consegue gravar. Abra o jogo no Chrome, pelo endereço https, e tente de novo.');
        return;
      }
      try { audio.parar(); } catch (e) { /* ignora */ }
      let stream;
      try {
        stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        mostrar(mensagemErro(e));
        return;
      }
      if (destruida || gravando) { stream.getTracks().forEach((t) => t.stop()); return; }
      let rec;
      try {
        const mime = escolherMime();
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        mostrar('Este navegador não consegue gravar. Abra o jogo no Chrome e tente de novo.');
        return;
      }
      const g = { id: it.id, rec, stream, chunks: [], timer: null, descartar: false };
      gravando = g;
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) g.chunks.push(ev.data); };
      rec.onerror = () => { g.descartar = true; mostrar('A gravação falhou. Tente de novo.'); try { rec.stop(); } catch (e) { /* ignora */ } };
      rec.onstop = () => terminar(g, it);
      try { rec.start(); } catch (e) {
        liberarMicrofone(g);
        gravando = null;
        mostrar('Não foi possível começar a gravar. Tente de novo.');
        atualizarTudo();
        return;
      }
      g.timer = setTimeout(() => parar(), LIMITE_MS);
      atualizarTudo();
    }

    function parar() {
      const g = gravando;
      if (!g) return;
      clearTimeout(g.timer);
      try { if (g.rec.state !== 'inactive') g.rec.stop(); else terminar(g, null); } catch (e) { liberarMicrofone(g); gravando = null; atualizarTudo(); }
    }

    async function terminar(g, it) {
      liberarMicrofone(g);
      if (gravando === g) gravando = null;
      if (g.descartar || destruida || !it) { atualizarTudo(); return; }
      const blob = new Blob(g.chunks, { type: g.rec.mimeType || 'audio/webm' });
      if (!blob.size) { mostrar('Não ouvi nada, tente de novo mais perto do celular.'); atualizarTudo(); return; }
      await guardarBlob(it, blob);
    }

    async function guardarBlob(it, blob) {
      processando = it.id;
      atualizarTudo();
      let r;
      try { r = await processarGravacao(blob); } catch (e) { r = { blob, tipo: blob.type, duracao: 0, original: true }; }
      processando = null;
      if (destruida) return;
      if (r.mudo) { mostrar('Não ouvi nada, tente de novo mais perto do celular.'); atualizarTudo(); return; }
      const salvou = await gravacoes.salvar(it.id, r.blob, { tipo: r.tipo, duracao: r.duracao });
      if (destruida) return;
      if (!salvou) { mostrar('Não foi possível guardar a gravação neste navegador (talvez a aba seja anônima).'); atualizarTudo(); return; }
      ids.add(it.id);
      mostrar('Gravado! Vou tocar para você conferir.', false);
      atualizarTudo();
      try { await avisarAudio(); } catch (e) { /* ignora */ }
      if (!destruida) ouvir(it);
    }

    // ---------- enviar um arquivo de áudio (em vez de gravar) ----------
    async function enviar(it, arquivo) {
      if (gravando || processando) return;
      mostrar('');
      if (!arquivo || !arquivo.size || !/^audio\//.test(arquivo.type || '')) { mostrar('Escolha um arquivo de áudio válido, como MP3, M4A, WAV ou WebM.'); return; }
      if (arquivo.size > 10 * 1024 * 1024) { mostrar('Este áudio é grande demais. Escolha um de até 10 MB.'); return; }
      try { audio.parar(); } catch (e) { /* ignora */ }
      await guardarBlob(it, arquivo);
    }

    // ---------- apagar ----------
    function confirmar(botao, textoNormal, textoConfirma, acao) {
      let esperando = false;
      let t = null;
      const reset = () => { esperando = false; botao.textContent = textoNormal; botao.classList.remove('confirma'); };
      botao.addEventListener('click', async () => {
        if (!esperando) {
          esperando = true;
          botao.textContent = textoConfirma;
          botao.classList.add('confirma');
          t = setTimeout(reset, 4000);
          confirmacoes.add(t);
          return;
        }
        clearTimeout(t);
        reset();
        await acao();
      });
    }

    async function apagarUm(it) {
      await gravacoes.apagar(it.id);
      ids.delete(it.id);
      atualizarTudo();
      await avisarAudio();
    }

    // ---------- interface ----------
    function criarLinha(it) {
      const gravadoMarca = el('span', { classe: 'gv-marca', texto: '✓ gravado', attrs: { 'aria-label': 'Gravado' } });
      const alvo = el('div', { classe: `gv-alvo ${it.tipo}`, texto: it.alvo });
      const originalMarca = el('span', { classe: 'gv-original', texto: 'Voz original' });
      const topo = el('div', { classe: 'gv-topo' }, alvo, gravadoMarca, originalMarca);
      const dica = it.dica ? el('p', { classe: 'nota gv-dica', texto: it.dica }) : null;

      const bGravar = el('button', { type: 'button', classe: 'btn-texto gv-gravar', attrs: { 'data-acao': 'gravar' } });
      bGravar.addEventListener('click', () => (gravando && gravando.id === it.id ? parar() : iniciar(it)));
      const bOuvir = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Ouvir', attrs: { 'data-acao': 'ouvir', 'aria-label': `Ouvir minha gravação de ${it.alvo}` } });
      bOuvir.addEventListener('click', () => ouvir(it));
      const bHoje = el('button', { type: 'button', classe: 'btn-texto claro gv-hoje', texto: 'Ouvir como está hoje', attrs: { 'data-acao': 'hoje', 'aria-label': `Ouvir como está hoje: ${it.alvo}` } });
      bHoje.addEventListener('click', () => ouvir(it));
      const bApagar = el('button', { type: 'button', classe: 'btn-texto perigo', texto: 'Apagar', attrs: { 'data-acao': 'apagar', 'aria-label': `Apagar gravação de ${it.alvo}` } });
      confirmar(bApagar, 'Apagar', 'Toque de novo', () => apagarUm(it));

      const entrada = el('input', { type: 'file', accept: 'audio/*', classe: 'gv-arquivo', attrs: { 'aria-label': `Enviar áudio de ${it.alvo}`, 'data-acao': 'enviar-arquivo', tabindex: '-1' } });
      entrada.addEventListener('change', () => { const f = entrada.files && entrada.files[0]; entrada.value = ''; if (f) enviar(it, f); });
      const bEnviar = el('button', { type: 'button', classe: 'btn-texto claro gv-enviar', texto: 'Enviar áudio', attrs: { 'data-acao': 'enviar', 'aria-label': `Enviar um arquivo de áudio para ${it.alvo}` } });
      bEnviar.addEventListener('click', () => entrada.click());
      const botoes = el('div', { classe: 'gv-botoes' }, bGravar, bOuvir, bHoje, bEnviar, bApagar, entrada);
      const card = el('div', { classe: 'gv-item', attrs: { 'data-id': it.id } }, topo, dica, botoes);

      const atualizar = () => {
        const tem = ids.has(it.id);
        const eu = gravando && gravando.id === it.id;
        const ocupado = !!(gravando && !eu) || !!processando;
        card.classList.toggle('gravado', tem);
        card.classList.toggle('gravando', !!eu);
        gravadoMarca.style.display = tem ? '' : 'none';
        originalMarca.style.display = tem ? 'none' : '';
        bEnviar.disabled = ocupado || !!eu;
        bGravar.textContent = eu ? 'Parar' : processando === it.id ? 'Salvando…' : tem ? 'Gravar de novo' : 'Gravar';
        bGravar.setAttribute('aria-label', eu ? `Parar de gravar ${it.alvo}` : `Gravar ${it.alvo}`);
        bGravar.classList.toggle('ativo', !!eu);
        bGravar.disabled = ocupado;
        bOuvir.style.display = tem ? '' : 'none';
        bApagar.style.display = tem ? '' : 'none';
        bHoje.style.display = tem ? 'none' : '';
        bOuvir.disabled = !!gravando || !!processando;
        bHoje.disabled = !!gravando || !!processando;
        bApagar.disabled = !!gravando || !!processando;
      };
      linhas.set(it.id, { atualizar });
      atualizar();
      return card;
    }

    const total = el('p', { classe: 'nota', id: 'gv-total' });
    const totalSons = grupos.reduce((n, g) => n + g.itens.length, 0);
    const resumoVoz = el('p', { classe: 'resumo-voz', id: 'gv-resumo-total' });
    const apagarTudo = el('button', { type: 'button', classe: 'btn-texto perigo', texto: 'Apagar todas as gravações', attrs: { 'data-acao': 'apagar-todas', 'aria-label': 'Apagar todas as gravações' } });
    confirmar(apagarTudo, 'Apagar todas as gravações', 'Toque de novo para apagar todas', async () => {
      await gravacoes.apagarTodas();
      ids = new Set();
      atualizarTudo();
      await avisarAudio();
      mostrar('Todas as gravações foram apagadas.', false);
    });

    const semAcento = (t) => String(t || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let filtro = 'letras'; // 'letras' (só os sons das letras) ou 'todos' (sons, frases, sílabas e palavras)
    let busca = '';
    const detalhes = [];
    const botoesFiltro = {};
    const semResultado = el('p', { classe: 'nota', id: 'gv-sem-resultado', texto: 'Nenhum som encontrado.', attrs: { hidden: '' } });

    let aplicando = false;
    function aplicarFiltro() {
      if (aplicando) return;
      aplicando = true;
      try { aplicarFiltroInterno(); } finally { aplicando = false; }
    }
    function aplicarFiltroInterno() {
      const q = semAcento(busca).trim();
      let achou = 0;
      for (const d of detalhes) {
        const gr = d.gr;
        const mostrarGrupo = q ? true : filtro === 'todos' || gr.chave === 'sons' || gr.chave === 'nomes';
        let visiveis = 0;
        if (q) { d.abrir(); }
        for (const it of gr.itens) {
          const linha = d.det.querySelector(`.gv-item[data-id="${it.id}"]`);
          if (!linha) continue;
          const bate = !q || semAcento(`${it.alvo} ${it.id}`).includes(q);
          linha.hidden = !bate;
          if (bate) visiveis++;
        }
        const grupoVisivel = mostrarGrupo && (!q || visiveis > 0);
        d.det.hidden = !grupoVisivel;
        if (grupoVisivel) achou += q ? visiveis : 1;
      }
      semResultado.hidden = !(q && achou === 0);
      for (const [k, b] of Object.entries(botoesFiltro)) {
        b.setAttribute('aria-pressed', String(k === filtro));
        b.classList.toggle('ativo', k === filtro);
      }
    }

    function montarConteudo() {
      const blocos = grupos.map((gr) => {
        gr.contador = el('span', { classe: 'gv-contador', attrs: { 'data-grupo': gr.chave } });
        const sum = el('summary', { classe: 'gv-resumo' }, el('span', { classe: 'gv-titulo', texto: gr.titulo }), gr.contador);
        const det = el('details', { classe: 'gv-grupo', attrs: { 'data-grupo': gr.chave } }, sum);
        if (gr.aberto) det.open = true;
        if (gr.aviso) det.append(el('p', { classe: 'aviso', texto: gr.aviso }));
        let montado = false;
        const montarItens = () => { if (montado) return; montado = true; gr.itens.forEach((it) => det.append(criarLinha(it))); atualizarTudo(); aplicarFiltro(); };
        det.addEventListener('toggle', () => { if (det.open) montarItens(); });
        if (gr.aberto) montarItens();
        detalhes.push({ gr, det, abrir: () => { if (!det.open) det.open = true; montarItens(); } });
        return det;
      });
      const campoBusca = el('input', { type: 'text', id: 'busca-som', placeholder: 'Buscar som ou palavra', attrs: { 'aria-label': 'Buscar som', autocomplete: 'off' } });
      campoBusca.addEventListener('input', () => { busca = campoBusca.value; aplicarFiltro(); });
      const faixa = el('div', { classe: 'gv-filtro' });
      for (const [k, rot] of [['letras', 'Letras'], ['todos', 'Todos os sons']]) {
        const b = el('button', { type: 'button', classe: 'btn-texto claro gv-filtro-btn', texto: rot, attrs: { 'data-filtro': k, 'aria-pressed': 'false' } });
        b.addEventListener('click', () => { filtro = k; aplicarFiltro(); });
        botoesFiltro[k] = b;
        faixa.append(b);
      }
      tela.replaceChildren(...[
        aoVoltar ? el('div', { classe: 'topo-pais' }, el('h1', { texto: 'Gravar minha voz' })) : el('h2', { texto: 'Sua voz, som por som' }),
        el('p', { texto: 'Grave a sua voz (até 6 segundos) ou envie um áudio. Ouça e, se quiser, grave de novo. Sem uma gravação, o jogo usa a voz original daquele som. As gravações ficam só neste celular e não vão para a internet. Se você apagar os dados do navegador ou desinstalar o app, elas somem.' }),
        el('p', { classe: 'nota', texto: 'Dica: fique num lugar silencioso, com o celular a um palmo da boca. Comece pelos sons das letras e pelos nomes delas.' }),
        msg,
        faixa,
        campoBusca,
        resumoVoz,
        total,
        ...blocos,
        semResultado,
        el('div', { classe: 'linha' }, apagarTudo),
        aoVoltar ? el('div', { classe: 'linha', estilo: 'padding-bottom:24px' }, botaoVoltar()) : null,
      ].filter(Boolean));
      aplicarFiltro();
      atualizarTudo();
    }

    try { audio.parar(); } catch (e) { /* ignora */ }
    if (!gravacoes.disponivel()) {
      tela.replaceChildren(...[
        aoVoltar ? el('div', { classe: 'topo-pais' }, el('h1', { texto: 'Gravar minha voz' })) : el('h2', { texto: 'Sua voz, som por som' }),
        el('p', { classe: 'aviso', id: 'gv-indisponivel', texto: 'Este navegador não permite guardar gravações (isso acontece em abas anônimas). Abra o jogo numa aba normal do Chrome. O jogo continua funcionando com a voz do aparelho.' }),
        aoVoltar ? el('div', { classe: 'linha' }, botaoVoltar()) : null,
      ].filter(Boolean));
    } else {
      montarConteudo();
      gravacoes.listarIds().then((s) => {
        if (destruida) return;
        ids = s;
        atualizarTudo();
      });
    }

    return {
      no: tela,
      /** Para uma gravação em andamento e solta o microfone (ao trocar de aba ou sair). */
      pausar() {
        if (gravando) {
          gravando.descartar = true;
          liberarMicrofone(gravando);
          try { if (gravando.rec.state !== 'inactive') gravando.rec.stop(); } catch (e) { /* ignora */ }
          gravando = null;
          atualizarTudo();
        }
        try { audio.parar(); } catch (e) { /* ignora */ }
      },
      destruir() {
        destruida = true;
        confirmacoes.forEach((t) => clearTimeout(t));
        if (gravando) {
          gravando.descartar = true;
          liberarMicrofone(gravando);
          try { if (gravando.rec.state !== 'inactive') gravando.rec.stop(); } catch (e) { /* ignora */ }
          gravando = null;
        }
      },
    };
}

// Tela própria (continua disponível; a Área dos pais usa o editor dentro da aba "Sua voz").
export default {
  montar(raiz, app) {
    const tela = el('section', { classe: 'tela rolavel pais gravar' });
    raiz.append(tela);
    const ed = criarEditorVoz(app, { aoVoltar: () => app.ir('pais', { painel: true, aba: 'voz' }) });
    tela.append(ed.no);
    return { destruir() { ed.destruir(); } };
  },
};
