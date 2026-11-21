// Privacidade: procura nomes proibidos (variável NOMES_PROIBIDOS, separados por vírgula) como PALAVRA INTEIRA,
// sem diferenciar maiúsculas, em todos os arquivos versionados e nas mensagens/autores de commit.
// Este arquivo não contém nenhum nome. Uso: NOMES_PROIBIDOS=nome1,nome2 node tests/e-privacidade.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bruto = process.env.NOMES_PROIBIDOS || '';
const nomes = bruto.split(',').map((n) => n.trim()).filter(Boolean);
if (!nomes.length) {
  console.log('AVISO: NOMES_PROIBIDOS não definida; verificação de privacidade pulada.');
  console.log('Uso: NOMES_PROIBIDOS=nome1,nome2 node tests/e-privacidade.mjs');
  process.exit(0);
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "palavra inteira": sem letra/dígito colado antes ou depois (aceita acentos).
const regs = nomes.map((n) => ({ n, re: new RegExp(`(?<![\\p{L}\\p{N}_])${escapar(n)}(?![\\p{L}\\p{N}_])`, 'iu') }));
const git = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

let achados = 0;
const relatar = (onde, n, trecho) => { achados++; console.log(`ENCONTRADO "${n}" em ${onde}: ${trecho.trim().slice(0, 120)}`); };

// 1) arquivos versionados (caminho e conteúdo), mais os novos ainda não versionados (para pegar antes do commit)
const versionados = git('ls-files', '-z').split('\0').filter(Boolean);
const novos = git('ls-files', '-z', '--others', '--exclude-standard').split('\0').filter(Boolean);
const todos = [...new Set([...versionados, ...novos])];
let lidos = 0;
for (const arq of todos) {
  for (const { n, re } of regs) if (re.test(arq)) relatar(`nome do arquivo ${arq}`, n, arq);
  let buf;
  try { if (!statSync(path.join(raiz, arq)).isFile()) continue; buf = readFileSync(path.join(raiz, arq)); } catch (e) { continue; }
  if (buf.includes(0)) continue; // binário (png, mp3, woff2): pula
  lidos++;
  const linhas = buf.toString('utf8').split('\n');
  linhas.forEach((linha, i) => {
    for (const { n, re } of regs) if (re.test(linha)) relatar(`${arq}:${i + 1}`, n, linha);
  });
}

// 2) mensagens e autores de commit (todas as branches)
let commits = 0;
try {
  const log = git('log', '--all', '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e');
  for (const reg of log.split('\x1e')) {
    const campos = reg.replace(/^\n/, '').split('\x1f');
    if (campos.length < 6) continue;
    commits++;
    const [hash, an, ae, cn, ce, corpo] = campos;
    const alvo = { autor: an, 'e-mail do autor': ae, committer: cn, 'e-mail do committer': ce, mensagem: corpo };
    for (const [campo, valor] of Object.entries(alvo)) {
      for (const { n, re } of regs) if (re.test(valor)) relatar(`commit ${hash.slice(0, 8)} (${campo})`, n, valor);
    }
  }
} catch (e) {
  console.log('AVISO: não foi possível ler o git log:', e.message);
}

console.log(`Verificados ${lidos} arquivos de texto (${todos.length} no total) e ${commits} commits para ${nomes.length} nome(s).`);
if (achados) { console.log(`FALHA: ${achados} ocorrência(s).`); process.exit(1); }
console.log('ok: nenhuma ocorrência.');
