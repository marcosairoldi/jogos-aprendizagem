// Gera a lista de pre-cache e o nome do cache em sw.js.
// Uso: node ferramentas/gerar-sw.mjs   (rode de novo sempre que arquivos mudarem)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ignorar = new Set(['docs', 'tests', 'ferramentas', '.git', 'node_modules', '.github', '.claude']);

function varrer(dir, saida) {
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    const rel = relative(raiz, p).split(sep).join('/');
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!ignorar.has(nome)) varrer(p, saida);
    } else if (!nome.endsWith('.md') && !nome.startsWith('.') && rel !== 'sw.js' && nome !== 'package.json' && nome !== 'package-lock.json') {
      saida.push(rel);
    }
  }
}

// Indice dos audios GERADOS (gravacoes novas sao achadas por sondagem, sem regenerar nada), lido por js/audio.js (evita requisicoes que dariam 404).
const audios = [];
for (const sub of ['assets/audio/voz', 'assets/audio/gerado']) {
  const d = join(raiz, sub);
  if (!existsSync(d)) continue;
  for (const n of readdirSync(d).sort()) if (/\.(mp3|m4a)$/.test(n)) audios.push(`${sub}/${n}`);
}
writeFileSync(join(raiz, 'assets/audio/gerado/indice.json'), JSON.stringify(audios, null, 1) + '\n');

const todos = [];
varrer(raiz, todos);
// somente o que faz parte do app
const permitido = (r) => r === 'index.html' || r === 'manifest.json' || /^(css|js|data|assets)\//.test(r);
const arquivos = todos.filter(permitido);

const hash = createHash('sha1');
for (const a of arquivos) { hash.update(a); hash.update(readFileSync(join(raiz, a))); }
const nomeCache = 'trilha-sons-' + hash.digest('hex').slice(0, 10);

const lista = ['./', ...arquivos.filter((a) => a !== 'index.html' || existsSync(join(raiz, 'index.html')))];
const corpo = lista.map((a) => '  ' + JSON.stringify(a)).join(',\n');

const caminho = join(raiz, 'sw.js');
let sw = readFileSync(caminho, 'utf8');
sw = sw.replace(/\/\/ <ARQUIVOS>[\s\S]*?\/\/ <\/ARQUIVOS>/, `// <ARQUIVOS>\n${corpo}\n// </ARQUIVOS>`);
sw = sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${nomeCache}';`);
writeFileSync(caminho, sw);
console.log(`sw.js atualizado: ${lista.length} arquivos, cache ${nomeCache}`);
