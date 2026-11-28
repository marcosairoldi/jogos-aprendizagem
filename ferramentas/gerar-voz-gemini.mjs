// Gera TODOS os áudios do jogo com o Gemini TTS numa voz só, para o app inteiro falar com a mesma voz.
// A chave NÃO fica no projeto: o proxy da sessão injeta o cabeçalho x-goog-api-key (Network secret).
// Fora dessa sessão, defina GEMINI_API_KEY no terminal. Em ambiente com proxy (HTTPS_PROXY), rode com
// NODE_USE_ENV_PROXY=1 para o Node usar o proxy.
//
// Uso:
//   node ferramentas/gerar-voz-gemini.mjs modelos                  lista os modelos TTS disponíveis
//   node ferramentas/gerar-voz-gemini.mjs amostras [vozes]         gera amostras para comparar vozes
//   node ferramentas/gerar-voz-gemini.mjs tudo <Voz> [--refazer]   gera (ou completa) todos os áudios
//   node ferramentas/gerar-voz-gemini.mjs listar                   mostra todos os itens e o texto falado
//
// Saída: assets/audio/voz/<id>.mp3 (48 kHz, 64 kbps, mono, sem silêncio nas pontas, volume igualado).
// Sem --refazer, itens já gerados nesta voz (registro em assets/audio/voz/voz.json) são pulados: dá para
// retomar no dia seguinte se a cota gratuita acabar no meio.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://generativelanguage.googleapis.com/v1beta';
// Pro: o mesmo modelo dos áudios do Unicórnio (precisa de faturamento). Na cota gratuita, use GEMINI_TTS_MODELO=gemini-2.5-flash-preview-tts.
const MODELO = process.env.GEMINI_TTS_MODELO || 'gemini-2.5-pro-preview-tts';
const DESTINO = join(raiz, 'assets/audio/voz');
const REGISTRO = join(DESTINO, 'voz.json');
const TMP = join(raiz, '.tmp-voz');
const PAUSA = Number(process.env.PAUSA_MS || 6500); // respeita o limite de pedidos por minuto
const LOTE = 8;

const FEMININAS = ['Kore', 'Leda', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome',
  'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat'];

const BASE = 'Fale em português do Brasil, com voz feminina alegre, carinhosa e clara, devagar, para uma criança de 5 anos.';
const ESTILO = `${BASE} Leia exatamente o texto, sem acrescentar nada:`;
const ESTILO_LOTE = `${BASE} Leia a lista abaixo, um item por vez, exatamente como está escrito, com uma pausa longa de um segundo e meio entre um item e outro. Não leia os números nem os pontos, não acrescente nada:`;
const NOMES_EXTRA = { h: 'agá', k: 'cá', q: 'quê', w: 'dáblio', x: 'xis', y: 'ípsilon' };
// Sons isolados. Contínuos: a voz lê o som alongado. Oclusivos: a voz lê a sílaba com A e o áudio é
// cortado no começo da vogal (fica só o estalo). Tudo é conferido por análise (msDeVogal).
const SONS = {
  a: 'Aaaaaa.', e: 'Êêêêêê.', i: 'Iiiiii.', o: 'Ôôôôôô.', u: 'Uuuuuu.',
  m: 'Mmmmmmmm.', n: 'Nnnnnnnn.', l: 'Llllllll.', f: 'Ffffffff.', v: 'Vvvvvvvv.',
  s: 'Ssssssss.', z: 'Zzzzzzzz.', j: 'Jjjjjjjj.', r: 'Rrrrrrrr.',
};
const OCLUSIVAS = { p: 'pá', b: 'bá', t: 'tá', d: 'dá', c: 'cá', g: 'gá' };
const CONTINUOS = new Set(['a', 'e', 'i', 'o', 'u', 'm', 'n', 'l', 'f', 'v', 's', 'z', 'j', 'r']);

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

function cabecalhos() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.GEMINI_API_KEY) h['x-goog-api-key'] = process.env.GEMINI_API_KEY;
  return h;
}

async function chamar(caminho, corpo) {
  const r = await fetch(`${API}/${caminho}`, { method: corpo ? 'POST' : 'GET', headers: cabecalhos(), body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

class CotaEsgotada extends Error {}
class SemAudio extends Error {}

/** Pede o áudio e grava PCM bruto em TMP; devolve { pcm, taxa }. */
async function pedirAudio(texto, voz, estilo) {
  const corpo = {
    contents: [{ parts: [{ text: `${estilo}\n${texto}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } },
  };
  let resp;
  for (let tentativa = 1; ; tentativa++) {
    try { resp = await chamar(`models/${MODELO}:generateContent`, corpo); break; } catch (e0) {
      // falha de rede (fetch failed) conta como erro passageiro, igual a 500/502/503/504
      const e = /^HTTP /.test(e0.message) ? e0 : new Error('HTTP 503: ' + e0.message);
      if (/HTTP 429/.test(e.message) && /per_day|PerDay|RequestsPerDay/i.test(e.message)) throw new CotaEsgotada(e.message);
      if (tentativa >= 6 || !/HTTP (429|500|502|503|504)/.test(e.message)) {
        if (/HTTP 429/.test(e.message)) throw new CotaEsgotada(e.message);
        throw e;
      }
      await dormir(15000 * tentativa);
    }
  }
  await dormir(PAUSA);
  const parte = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!parte) throw new SemAudio('resposta sem áudio: ' + JSON.stringify(resp).slice(0, 160));
  const taxa = ((parte.inlineData.mimeType || '').match(/rate=(\d+)/) || [])[1] || '24000';
  mkdirSync(TMP, { recursive: true });
  const pcm = join(TMP, `bruto-${Date.now()}.pcm`);
  writeFileSync(pcm, Buffer.from(parte.inlineData.data, 'base64'));
  return { pcm, taxa };
}

/** Trecho [ini, fim] (s) do PCM -> mp3 final, sem silêncio nas pontas e com volume igualado. */
function finalizar({ pcm, taxa }, arquivo, ini = 0, fim = null, limiar = '-45dB') {
  const af = [
    `silenceremove=start_periods=1:start_threshold=${limiar}:start_silence=0.03`,
    'areverse', `silenceremove=start_periods=1:start_threshold=${limiar}:start_silence=0.06`, 'areverse',
    'afade=t=in:d=0.01', 'loudnorm=I=-18:TP=-2:LRA=11',
  ].join(',');
  const corte = fim !== null ? ['-ss', String(ini), '-to', String(fim)] : [];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', taxa, '-ac', '1', ...corte, '-i', pcm,
    '-af', af, '-ar', '48000', '-ac', '1', '-b:a', '64k', arquivo]);
}

/** Silêncios (>= minS) no PCM, em segundos: [{ini, fim}]. */
function silencios({ pcm, taxa }, minS = 0.45) {
  let saida = '';
  try {
    saida = execFileSync('ffmpeg', ['-v', 'info', '-f', 's16le', '-ar', taxa, '-ac', '1', '-i', pcm,
      '-af', `silencedetect=noise=-40dB:d=${minS}`, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) { saida = (e.stderr || '').toString(); }
  const lista = [];
  let ini = null;
  for (const linha of saida.split('\n')) {
    const a = linha.match(/silence_start: ([\d.]+)/); if (a) ini = parseFloat(a[1]);
    const b = linha.match(/silence_end: ([\d.]+)/); if (b && ini !== null) { lista.push({ ini, fim: parseFloat(b[1]) }); ini = null; }
  }
  return lista;
}

function duracao({ pcm, taxa }) {
  return readFileSync(pcm).length / 2 / Number(taxa);
}

/** Análise simples: segundos de quadros com cara de vogal (energia forte entre 300 e 2500 Hz). */
function msDeVogal(arquivo) {
  const py = `
import subprocess,numpy as np,sys
sr=16000
raw=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ac','1','-ar',str(sr),'-f','s16le','-'],capture_output=True).stdout
x=np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
w=int(.03*sr);h=int(.01*sr);p=np.abs(x).max()+1e-9;v=0
for i in range(0,len(x)-w,h):
  q=x[i:i+w]*np.hanning(w)
  if np.sqrt((q**2).mean())<0.1*p: continue
  S=np.abs(np.fft.rfft(q,1024))**2;f=np.fft.rfftfreq(1024,1/sr)
  if S[(f>=300)&(f<2500)].sum()>2*S[f<300].sum(): v+=1
print(v*10)`;
  try { return Number(execFileSync('python3', ['-c', py, arquivo]).toString().trim()); } catch (e) { return -1; }
}

function todosOsItens() {
  const c = JSON.parse(readFileSync(join(raiz, 'data/curriculo.json'), 'utf8'));
  const f = JSON.parse(readFileSync(join(raiz, 'data/frases.json'), 'utf8'));
  const frases = Object.entries(f).filter(([k, v]) => !k.startsWith('_') && !v.includes('{nome}'))
    .map(([k, v]) => ({ id: `frase_${k}`, texto: v }));
  const palavras = Object.entries(c.palavras).map(([k, p]) => ({ id: `pal_${k}`, texto: (p.tts || p.texto).toLowerCase() }));
  const silabas = Object.entries(c.silabas).map(([k, s]) => ({ id: `sil_${k}`, texto: s.tts || k }));
  const nomes = [...Object.entries(c.letras).map(([k, l]) => ({ id: `nome_${k}`, texto: l.nome })),
    ...Object.entries(NOMES_EXTRA).map(([k, n]) => ({ id: `nome_${k}`, texto: n }))];
  const sons = c.ordem.filter((l) => SONS[l] || OCLUSIVAS[l]).map((l) => ({ id: `som_${l}`, letra: l, texto: SONS[l] || OCLUSIVAS[l] }));
  return { frases, palavras, silabas, nomes, sons };
}

function lerRegistro() {
  try { return JSON.parse(readFileSync(REGISTRO, 'utf8')); } catch (e) { return { voz: null, modelo: null, itens: {} }; }
}
function salvarRegistro(r) { writeFileSync(REGISTRO, JSON.stringify(r, null, 1) + '\n'); }

async function gerarUm(item, voz, estilo, reg) {
  let audio;
  for (let t = 1; ; t++) {
    try { audio = await pedirAudio(item.texto, voz, estilo); break; } catch (e) {
      if (!(e instanceof SemAudio) || t >= 3) { if (e instanceof SemAudio) { console.log('falhou', item.id, e.message); return; } throw e; }
    }
  }
  finalizar(audio, join(DESTINO, `${item.id}.mp3`));
  reg.itens[item.id] = { texto: item.texto };
  salvarRegistro(reg);
  console.log('ok', item.id);
}

/** Um pedido para vários itens curtos; corta nos silêncios. Se a contagem não bater, gera um a um. */
async function gerarLote(itens, voz, reg) {
  const texto = itens.map((i, n) => `${n + 1}. ${i.texto}.`).join('\n');
  let audio;
  try { audio = await pedirAudio(texto, voz, ESTILO_LOTE); } catch (e) {
    if (!(e instanceof SemAudio)) throw e;
    for (const i of itens) await gerarUm(i, voz, ESTILO, reg);
    return;
  }
  const total = duracao(audio);
  // silêncios internos (ignora os das pontas) e, se sobrarem, fica com os mais longos
  let sil = silencios(audio).filter((s) => s.ini > 0.05 && s.fim < total - 0.05);
  if (sil.length > itens.length - 1) sil = sil.sort((a, b) => (b.fim - b.ini) - (a.fim - a.ini)).slice(0, itens.length - 1).sort((a, b) => a.ini - b.ini);
  if (sil.length !== itens.length - 1) {
    console.log(`lote com ${itens.length} itens veio com ${sil.length + 1} trechos: refaz um a um`);
    for (const i of itens) await gerarUm(i, voz, ESTILO, reg);
    return;
  }
  const cortes = [0, ...sil.map((s) => (s.ini + s.fim) / 2), total];
  itens.forEach((i, n) => {
    finalizar(audio, join(DESTINO, `${i.id}.mp3`), cortes[n], cortes[n + 1]);
    reg.itens[i.id] = { texto: i.texto, lote: true };
    console.log('ok', i.id, '(lote)');
  });
  salvarRegistro(reg);
}

/** Tempo (s) em que a vogal começa: primeiro quadro com cara de vogal, depois do início do som. */
function inicioDaVogal(arquivo) {
  const py = `
import subprocess,numpy as np,sys
sr=16000
raw=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ac','1','-ar',str(sr),'-f','s16le','-'],capture_output=True).stdout
x=np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
w=int(.02*sr);h=int(.005*sr);p=np.abs(x).max()+1e-9
for i in range(0,len(x)-w,h):
  q=x[i:i+w]*np.hanning(w)
  if np.sqrt((q**2).mean())<0.15*p: continue
  S=np.abs(np.fft.rfft(q,1024))**2;f=np.fft.rfftfreq(1024,1/sr)
  if S[(f>=300)&(f<2500)].sum()>2*S[f<300].sum():
    print(i/sr);break
else: print(-1)`;
  return Number(execFileSync('python3', ['-c', py, arquivo]).toString().trim());
}

async function gerarSom(item, voz, reg) {
  const vogal = 'aeiou'.includes(item.letra);
  const oclusiva = !!OCLUSIVAS[item.letra];
  const arq = join(DESTINO, `${item.id}.mp3`);
  for (let t = 1; t <= 3; t++) {
    let audio;
    try { audio = await pedirAudio(item.texto, voz, ESTILO); } catch (e) {
      if (e instanceof SemAudio) { console.log(`tentativa ${t}: ${item.id} sem áudio`); continue; }
      throw e;
    }
    if (oclusiva) {
      // sílaba inteira num arquivo provisório; corta logo antes da vogal
      const silaba = join(TMP, `${item.id}-silaba.mp3`);
      finalizar(audio, silaba);
      const v = inicioDaVogal(silaba);
      if (!(v > 0.01)) { console.log(`tentativa ${t}: ${item.id} sem início de vogal claro`); continue; }
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silaba, '-t', String(Math.max(0.03, v - 0.005)),
        '-af', 'afade=t=out:st=' + Math.max(0, v - 0.02).toFixed(3) + ':d=0.015', '-ar', '48000', '-ac', '1', '-b:a', '64k', arq]);
    } else {
      finalizar(audio, arq, 0, null, '-60dB');
    }
    const ms = msDeVogal(arq);
    const limite = vogal ? Infinity : (oclusiva ? 30 : 60);
    const dur = (() => { try { return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString()); } catch (e) { return 0; } })();
    if (ms >= 0 && dur >= 0.04 && ms <= limite) {
      reg.itens[item.id] = { texto: item.texto, vogalMs: ms };
      salvarRegistro(reg);
      console.log('ok', item.id, `(vogal ${ms} ms)`);
      return;
    }
    console.log(`tentativa ${t}: ${item.id} com ${ms} ms de vogal`);
  }
  console.log('REVISAR', item.id, 'não saiu limpo em 3 tentativas: mantido o arquivo anterior');
  try { execFileSync('git', ['-C', raiz, 'checkout', '--', `assets/audio/voz/${item.id}.mp3`]); } catch (e) { /* sem arquivo anterior */ }
}

const [cmd, arg, ...resto] = process.argv.slice(2);
if (cmd === 'modelos') {
  const r = await chamar('models?pageSize=200');
  for (const m of r.models || []) if (/tts/i.test(m.name)) console.log(m.name, m.supportedGenerationMethods?.join(','));
} else if (cmd === 'listar') {
  for (const [g, lista] of Object.entries(todosOsItens())) for (const i of lista) console.log(g, i.id, '|', i.texto);
} else if (cmd === 'amostras') {
  const vozes = arg ? arg.split(',') : FEMININAS;
  const pasta = join(TMP, 'amostras');
  mkdirSync(pasta, { recursive: true });
  for (const v of vozes) {
    try { finalizar(await pedirAudio('Tchau tchau! Você brincou muito bem hoje. Até amanhã!', v, ESTILO), join(pasta, `${v}__frase_despedida.mp3`)); console.log('ok', v); } catch (e) { console.log('falhou', v, e.message.slice(0, 200)); }
  }
} else if (cmd === 'tudo') {
  if (!arg) { console.error('Informe a voz. Ex.: tudo Autonoe'); process.exit(1); }
  mkdirSync(DESTINO, { recursive: true });
  let reg = lerRegistro();
  if (resto.includes('--refazer') || reg.voz !== arg || reg.modelo !== MODELO) reg = { voz: arg, modelo: MODELO, itens: {} };
  salvarRegistro(reg);
  const { frases, palavras, silabas, nomes, sons } = todosOsItens();
  const falta = (lista) => lista.filter((i) => !reg.itens[i.id]);
  try {
    // ordem de prioridade: sons das letras, nomes, frases, sílabas e palavras
    for (const i of falta(sons)) await gerarSom(i, arg, reg);
    for (const i of falta(frases)) await gerarUm(i, arg, ESTILO, reg);
    for (const grupo of [nomes, silabas, palavras]) {
      const f = falta(grupo);
      for (let n = 0; n < f.length; n += LOTE) await gerarLote(f.slice(n, n + LOTE), arg, reg);
    }
    console.log('PRONTO: todos os itens gerados.');
  } catch (e) {
    if (e instanceof CotaEsgotada) console.log('COTA: a cota acabou por agora. Rode o mesmo comando mais tarde para continuar de onde parou.\n' + e.message.slice(0, 300));
    else throw e;
  }
  const todos = [...sons, ...frases, ...nomes, ...silabas, ...palavras];
  console.log(`gerados ${todos.filter((i) => reg.itens[i.id]).length} de ${todos.length}`);
  rmSync(TMP, { recursive: true, force: true });
} else {
  console.log('Comandos: modelos | listar | amostras [vozes] | tudo <Voz> [--refazer]');
}
