// Gera, com o Gemini TTS (mesmo modelo usado nos áudios do Unicórnio dos Sons), os áudios que ainda não
// existem em assets/audio/voz/, para o jogo inteiro falar com a mesma voz natural.
// A chave NÃO fica no projeto: o proxy da sessão injeta o cabeçalho x-goog-api-key (Network secret).
// Fora dessa sessão, defina GEMINI_API_KEY no terminal.
//
// Uso:
//   node ferramentas/gerar-voz-gemini.mjs modelos                 lista os modelos TTS disponíveis
//   node ferramentas/gerar-voz-gemini.mjs amostras [vozes]        gera amostras para comparar vozes
//   node ferramentas/gerar-voz-gemini.mjs gerar <Voz> [--refazer] gera os itens que faltam com a voz escolhida
//   node ferramentas/gerar-voz-gemini.mjs listar                  mostra o que falta, sem gerar
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = process.env.GEMINI_TTS_MODELO || 'gemini-2.5-pro-preview-tts';
const DESTINO = join(raiz, 'assets/audio/voz');
const TMP = join(raiz, '.tmp-voz');

// Vozes femininas do Gemini TTS (a voz atual é feminina, aguda e alegre).
const FEMININAS = ['Kore', 'Leda', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome',
  'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat'];

const ESTILO = 'Fale em português do Brasil, com voz feminina alegre, carinhosa e clara, devagar, para uma criança de 5 anos. Leia exatamente o texto, sem acrescentar nada:';

function cabecalhos() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.GEMINI_API_KEY) h['x-goog-api-key'] = process.env.GEMINI_API_KEY;
  return h;
}

async function chamar(caminho, corpo) {
  const r = await fetch(`${API}/${caminho}`, { method: corpo ? 'POST' : 'GET', headers: cabecalhos(), body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

/** Texto -> mp3 em `arquivo` (48 kHz, 64 kbps, mono, sem silêncio nas pontas, volume igualado). */
async function sintetizar(texto, voz, arquivo, estilo = ESTILO) {
  const corpo = {
    contents: [{ parts: [{ text: `${estilo}\n${texto}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
    },
  };
  let resp;
  for (let tentativa = 1; ; tentativa++) {
    try { resp = await chamar(`models/${MODELO}:generateContent`, corpo); break; } catch (e) {
      if (tentativa >= 4 || !/HTTP (429|500|503)/.test(e.message)) throw e;
      await new Promise((ok) => setTimeout(ok, 4000 * tentativa));
    }
  }
  const parte = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!parte) throw new Error('resposta sem áudio: ' + JSON.stringify(resp).slice(0, 300));
  const mime = parte.inlineData.mimeType || '';
  const taxa = (mime.match(/rate=(\d+)/) || [])[1] || '24000';
  mkdirSync(TMP, { recursive: true });
  const pcm = join(TMP, 'bruto.pcm');
  writeFileSync(pcm, Buffer.from(parte.inlineData.data, 'base64'));
  const af = [
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
    'areverse', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08', 'areverse',
    'loudnorm=I=-18:TP=-2:LRA=11',
  ].join(',');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', taxa, '-ac', '1', '-i', pcm,
    '-af', af, '-ar', '48000', '-ac', '1', '-b:a', '64k', arquivo]);
}

function itensQueFaltam() {
  const c = JSON.parse(readFileSync(join(raiz, 'data/curriculo.json'), 'utf8'));
  const f = JSON.parse(readFileSync(join(raiz, 'data/frases.json'), 'utf8'));
  const tem = new Set(existsSync(DESTINO) ? readdirSync(DESTINO).map((x) => x.replace(/\.mp3$/, '')) : []);
  const itens = [];
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('_') || v.includes('{nome}')) continue; // frase com nome fica na voz do aparelho
    itens.push({ id: `frase_${k}`, texto: v });
  }
  for (const [k, p] of Object.entries(c.palavras)) itens.push({ id: `pal_${k}`, texto: (p.tts || p.texto).toLowerCase() });
  for (const [k, s] of Object.entries(c.silabas)) {
    itens.push({ id: `sil_${k}`, texto: k, estilo: 'Fale em português do Brasil, com voz feminina alegre e clara, para uma criança. Diga somente esta sílaba, uma vez, sem soletrar e sem dizer mais nada:' });
  }
  for (const [k, l] of Object.entries(c.letras)) {
    itens.push({ id: `nome_${k}`, texto: l.nome, estilo: 'Fale em português do Brasil, com voz feminina alegre e clara. Diga somente o nome desta letra do alfabeto, uma vez:' });
  }
  // Sons contínuos de J e Z: pedido explícito sem vogal; o resultado é conferido por análise antes de usar.
  const SONS = { j: 'jjjjjj (o som de J em janela, sem vogal, só o chiado com voz, por um segundo)', z: 'zzzzzz (o som de Z em zebra, sem vogal, só o zumbido, por um segundo)' };
  for (const k of Object.keys(SONS)) itens.push({ id: `som_${k}`, texto: SONS[k], estilo: 'Em português do Brasil, produza somente este som contínuo, sem dizer nenhuma vogal nem o nome da letra:' });
  return itens.filter((i) => !tem.has(i.id));
}

const [cmd, arg, ...resto] = process.argv.slice(2);
if (cmd === 'modelos') {
  const r = await chamar('models?pageSize=200');
  for (const m of r.models || []) if (/tts/i.test(m.name)) console.log(m.name, m.supportedGenerationMethods?.join(','));
} else if (cmd === 'listar') {
  for (const i of itensQueFaltam()) console.log(i.id, '|', i.texto);
} else if (cmd === 'amostras') {
  const vozes = arg ? arg.split(',') : FEMININAS;
  const pasta = join(raiz, '.tmp-voz/amostras');
  mkdirSync(pasta, { recursive: true });
  // mesmos textos de áudios que já existem, para comparar timbre e tom com a voz atual
  const textos = { frase_acerto_1: 'Isso mesmo!', frase_despedida: 'Tchau tchau! Você brincou muito bem hoje. Até amanhã!', pal_pato: 'pato' };
  for (const v of vozes) {
    for (const [id, t] of Object.entries(textos)) {
      const arq = join(pasta, `${v}__${id}.mp3`);
      try { await sintetizar(t, v, arq); console.log('ok', v, id); } catch (e) { console.log('falhou', v, id, e.message); }
    }
  }
} else if (cmd === 'gerar') {
  if (!arg) { console.error('Informe a voz. Ex.: gerar Kore'); process.exit(1); }
  const refazer = resto.includes('--refazer');
  const itens = itensQueFaltam();
  console.log(`${itens.length} itens para gerar com a voz ${arg}`);
  for (const i of itens) {
    const arq = join(DESTINO, `${i.id}.mp3`);
    if (existsSync(arq) && !refazer) continue;
    try { await sintetizar(i.texto, arg, arq, i.estilo); console.log('ok', i.id); } catch (e) { console.log('falhou', i.id, e.message); }
  }
  rmSync(TMP, { recursive: true, force: true });
} else {
  console.log('Comandos: modelos | listar | amostras [vozes] | gerar <Voz> [--refazer]');
}
