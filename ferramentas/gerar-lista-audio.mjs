// Gera assets/audio/LISTA.md (roteiro de gravação para a adulta) a partir de
// data/curriculo.json e data/frases.json.  Uso: node ferramentas/gerar-lista-audio.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => JSON.parse(readFileSync(join(raiz, p), 'utf8'));
const frases = ler('data/frases.json');
let cur = null;
if (existsSync(join(raiz, 'data/curriculo.json'))) cur = ler('data/curriculo.json');
else console.log('AVISO: data/curriculo.json não existe; gerando só frases e sons das 17 letras.');

const ordem = cur?.ordem || 'a e i o u m p b t f v s l n d c g'.split(' ');
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const semNome = (t) => t.replace(/,?\s*\{nome\}/g, '').replace(/\{nome\}\s*/g, '').replace(/\s+([!?.,])/g, '$1').replace(/\s{2,}/g, ' ').trim();

const L = [];
L.push(`# Lista de gravações da Trilha dos Sons

Este roteiro é para quem quiser gravar a própria voz no jogo. **Nada aqui é obrigatório**: sem gravação, o jogo usa sons gerados por computador e a voz do aparelho. Mas a sua voz, falando devagar e alegre, ensina muito melhor.

> **ATENÇÃO, PRIVACIDADE:** o repositório deste jogo é **público**. Qualquer gravação colocada lá fica pública, para qualquer pessoa na internet. A voz de uma pessoa é um dado pessoal. Só envie uma gravação se a pessoa que falou concordou, sabendo disso. Se preferir, **não suba as gravações para o repositório**: use-as só no seu próprio aparelho/cópia do jogo.

## Como gravar

1. **Lugar silencioso.** Quarto com a porta fechada, sem televisão, ventilador ou geladeira por perto. Cobertores e almofadas ajudam.
2. **Celular a um palmo da boca** (mais ou menos o tamanho da sua mão aberta), um pouco de lado, para o ar da boca não "estourar" no microfone.
3. **Um segundo de silêncio antes de falar** e um pouco de silêncio depois. Conte "um" na cabeça antes de começar.
4. **Fale devagar e alegre**, como quem fala com a criança. Sorrir enquanto fala deixa a voz mais simpática.
5. **Uma gravação para cada arquivo.** Se errar, apague e grave de novo.
6. Use o gravador de voz do celular. Pode salvar em **mp3** ou **m4a** (o formato padrão de muitos celulares).

## Nome do arquivo

- O nome tem que ser **exatamente** o da tabela, **tudo minúsculo**, sem acento e sem espaço. Exemplo: \`som_m.mp3\` ou \`som_m.m4a\`.
- Aceitamos \`.mp3\` ou \`.m4a\`. Se existirem os dois, vale o mp3.
- Coloque os arquivos na pasta **\`assets/audio/gravacoes/\`**.
- **Basta enviar o arquivo com o nome certo para essa pasta.** Não precisa mexer em mais nada: o jogo encontra sozinho. Na primeira vez que o celular abrir o jogo **com internet**, ele pega a gravação nova e guarda; depois disso funciona sem internet. (Pode levar uma ou duas aberturas do jogo até a novidade aparecer.)

## Frases com {nome}

Algumas frases têm \`{nome}\` (por exemplo "Muito bem, {nome}!"). **Grave essas frases SEM o nome**: a tabela já mostra o que falar. O jogo toca a sua gravação do jeito que ela está. A voz do aparelho só diz o nome da criança quando **não** existe gravação.

## Os sons das letras (muito importante)

O jogo ensina o **som** da letra, **nunca o nome**. Diga "mmmm", não "eme"; "p" (só o sopro), não "pê". **Não coloque vogal depois da consoante.** A coluna "como fazer" explica cada som. Os sons contínuos (a e i o u m f v s l n) podem durar quase um segundo; os "estourinhos" (p b t d c g) são bem curtos.
`);

// ---- sons das letras
L.push('### 1. Sons das letras\n');
L.push('| arquivo | letra | como fazer o som |');
L.push('|---|---|---|');
for (const l of ordem) {
  const d = cur?.letras?.[l];
  const dica = d?.dica ? d.dica.replace(/^Para a adulta:\s*/i, '') : '';
  const fon = d?.fonema ? ` (som ${d.fonema})` : '';
  L.push(`| \`som_${l}.mp3\` | ${l.toUpperCase()} | ${esc(dica)}${fon} |`);
}
L.push('');

if (cur) {
  L.push('### 2. Sílabas\n');
  L.push('Fale a sílaba como ela soa dentro de uma palavra, juntinha ("má", não "eme-a").\n');
  L.push('| arquivo | o que falar |');
  L.push('|---|---|');
  for (const [id, s] of Object.entries(cur.silabas || {})) {
    L.push(`| \`${esc(s.audio || 'sil_' + id)}.mp3\` | ${esc((s.tts || s.texto || id).toLowerCase())} (${esc(s.texto || id.toUpperCase())}) |`);
  }
  L.push('');
  L.push('### 3. Palavras\n');
  L.push('| arquivo | o que falar |');
  L.push('|---|---|');
  for (const [id, p] of Object.entries(cur.palavras || {})) {
    L.push(`| \`${esc(p.audio || 'pal_' + id)}.mp3\` | ${esc(p.tts || (p.texto || id).toLowerCase())} |`);
  }
  L.push('');
}

L.push(`### ${cur ? 4 : 2}. Frases\n`);
L.push('Frases com `{nome}`: grave **sem o nome**, como mostrado.\n');
L.push('| arquivo | o que falar |');
L.push('|---|---|');
for (const [k, t] of Object.entries(frases)) {
  if (k.startsWith('_') || typeof t !== 'string') continue;
  L.push(`| \`frase_${k}.mp3\` | ${esc(semNome(t))} |`);
}
L.push('');

writeFileSync(join(raiz, 'assets/audio/LISTA.md'), L.join('\n'));
console.log('assets/audio/LISTA.md gerado');
