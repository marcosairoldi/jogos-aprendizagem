// Importa a voz sintética de alta qualidade do projeto "Unicórnio dos Sons" para assets/audio/voz/,
// renomeando cada arquivo para os ids deste jogo (som_, sil_, pal_, frase_).
// Uso: node ferramentas/importar-voz.mjs <pasta public/audio do outro projeto>
// Os nomes das letras (letra-x-nome) entram como nome_<letra>; o jogo ensina o NOME e depois o SOM, sempre separados.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = process.argv[2];
if (!origem || !existsSync(origem)) {
  console.error('Informe a pasta de áudios de origem. Ex.: node ferramentas/importar-voz.mjs ../unic-rnio-dos-sons/public/audio');
  process.exit(1);
}
const curriculo = JSON.parse(readFileSync(join(raiz, 'data/curriculo.json'), 'utf8'));
const destino = join(raiz, 'assets/audio/voz');
if (existsSync(destino)) rmSync(destino, { recursive: true });
mkdirSync(destino, { recursive: true });

// E e O usam o som aberto da voz natural (é, ó): o som fechado gerado por computador ficava robotizado
// demais para entender. Nenhuma letra fica de fora.
const SONS_FORA = new Set();

// Frases deste jogo -> arquivo de instrução/elogio da outra voz (o texto em data/frases.json foi
// ajustado para ser exatamente o que a voz fala, para a legenda bater com o áudio).
const FRASES = {
  escute_instrucao: 'instrucao-vamos-jogar',
  caca_instrucao: 'instrucao-vamos-jogar',
  escute_pergunta: 'instrucao-toque-letra',
  caca_pergunta: 'instrucao-toque-figura-som',
  trace_instrucao: 'instrucao-vamos-tracar',
  apresentar_letra: 'instrucao-letra-nova',
  quase: 'instrucao-tente-de-novo',
  acerto_1: 'elogio-2',
  acerto_2: 'elogio-1',
  acerto_3: 'elogio-3',
  acerto_4: 'elogio-4',
  rodada_fim: 'elogio-5',
  despedida: 'despedida-1',
  ouca_nome_som: 'instrucao-ouca-nome-som',
  // frases com equivalente gravado na voz natural (o texto em data/frases.json é exatamente o falado)
  menu_jogos: 'instrucao-vamos-jogar',
  trilha_nova_letra: 'instrucao-letra-nova',
  trace_escolher: 'instrucao-vamos-tracar',
  trace_completo: 'elogio-4',
  letra_dominada: 'elogio-3',
  recompensa_estrela: 'elogio-5',
  recompensa_concha: 'elogio-5',
  recompensa_chifre: 'elogio-5',
  junte_instrucao: 'instrucao-junte-sons',
};

const copiados = [];
const faltam = [];
function copiar(arquivoOrigem, id) {
  const de = join(origem, arquivoOrigem + '.mp3');
  if (!existsSync(de)) { faltam.push(id); return; }
  copyFileSync(de, join(destino, id + '.mp3'));
  copiados.push(id);
}

for (const l of curriculo.ordem) {
  if (SONS_FORA.has(l)) continue;
  copiar(`letra-${l}-som`, `som_${l}`);
}
for (const s of Object.keys(curriculo.silabas)) copiar(`silaba-${s}`, `sil_${s}`);
for (const p of Object.keys(curriculo.palavras)) copiar(`palavra-${p}`, `pal_${p}`);
// Nomes das letras (J e Z não existem na outra voz: ficam com a voz do aparelho).
for (const l of curriculo.ordem) copiar(`letra-${l}-nome`, `nome_${l}`);
for (const [chave, arq] of Object.entries(FRASES)) copiar(arq, `frase_${chave}`);

// Sons contínuos muito longos atrasam o jogo: corta em 1,5 s com final suave (precisa de ffmpeg).
for (const id of copiados.filter((i) => i.startsWith('som_'))) {
  const arq = join(destino, id + '.mp3');
  try {
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString());
    if (dur > 1.8) {
      const tmp = arq.replace(/\.mp3$/, '.tmp.mp3');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arq, '-t', '1.5', '-af', 'afade=t=out:st=1.25:d=0.25', tmp]);
      rmSync(arq); copyFileSync(tmp, arq); rmSync(tmp);
      console.log(`${id}: cortado de ${dur.toFixed(2)} s para 1,5 s`);
    }
  } catch (e) { console.log(`${id}: sem ffmpeg, mantido como está`); }
}

console.log(`voz importada: ${copiados.length} arquivos em assets/audio/voz/`);
console.log(`sem arquivo na outra voz (continuam com som gerado ou voz do aparelho): ${faltam.length}`);
console.log(faltam.join(' '));
