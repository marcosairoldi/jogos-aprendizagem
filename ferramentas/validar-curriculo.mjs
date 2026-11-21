#!/usr/bin/env node
// Valida data/curriculo.json contra o contrato (docs/PLANO.md, seção 4).
// Uso: node ferramentas/validar-curriculo.mjs   (Node 22, sem dependências)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const erros = [];
const avisos = [];
const erro = (m) => erros.push(m);

const FIGURAS = {
  a: ['abelha', 'anel', 'aviao'], e: ['elefante', 'ervilha', 'ema'], i: ['ilha', 'iglu', 'ioio'],
  o: ['ovo', 'olho', 'ovelha'], u: ['uva', 'urso', 'unicornio'], m: ['mapa', 'moto', 'mala'],
  p: ['pato', 'pipa', 'pe'], b: ['bola', 'bolo', 'bota'], t: ['tatu', 'tomate', 'tapete'],
  f: ['foca', 'fada', 'fita'], v: ['vaca', 'vela', 'vaso'], s: ['sapo', 'sino', 'suco'],
  l: ['lua', 'lobo', 'lupa'], n: ['navio', 'nuvem', 'nariz'], d: ['dado', 'dedo', 'dente'],
  c: ['copo', 'cubo', 'cama'], g: ['gato', 'galo', 'gota'],
};
const ORDEM = Object.keys(FIGURAS);
const VOGAIS = ['a', 'e', 'i', 'o', 'u'];
const OCLUSIVAS = ['p', 'b', 't', 'd', 'c', 'g'];
const NOMES_LETRAS = ['eme', 'pe', 'be', 'te', 'efe', 've', 'esse', 'ese', 'ele', 'ene', 'de', 'ce', 'se', 'ge', 'em', 'en', 'es', 'ef', 'el', 'em-e'];

const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let c;
try {
  c = JSON.parse(fs.readFileSync(path.join(raiz, 'data/curriculo.json'), 'utf8'));
} catch (e) {
  console.error('ERRO: não consegui ler/parsear data/curriculo.json: ' + e.message);
  process.exit(1);
}

// regras
const CHAVES_REGRAS = ['itensPorRodada', 'janelaDominio', 'acertosParaDominar', 'jogosDistintosParaDominar',
  'sessoesParaDominar', 'proporcaoRevisao', 'minutosSessao', 'opcoesMin', 'opcoesMax'];
if (!c.regras || typeof c.regras !== 'object') erro('regras ausentes');
else {
  for (const k of CHAVES_REGRAS) if (typeof c.regras[k] !== 'number') erro(`regras.${k} ausente ou não numérico`);
  if (c.regras.acertosParaDominar > c.regras.janelaDominio) erro('regras.acertosParaDominar maior que janelaDominio');
  if (c.regras.opcoesMin > c.regras.opcoesMax) erro('regras.opcoesMin maior que opcoesMax');
}

// ordem
if (!Array.isArray(c.ordem)) erro('"ordem" ausente');
const ordem = Array.isArray(c.ordem) ? c.ordem : [];
for (const l of ORDEM) if (!ordem.includes(l)) erro(`ordem: falta a letra "${l}"`);
for (const l of ordem) if (!ORDEM.includes(l)) erro(`ordem: letra inesperada "${l}"`);
if (new Set(ordem).size !== ordem.length) erro('ordem: letras repetidas');

// etapas
const naEtapa = new Set();
if (!Array.isArray(c.etapas) || !c.etapas.length) erro('"etapas" ausente');
else for (const e of c.etapas) {
  if (!e.id || !Array.isArray(e.letras)) erro('etapa sem id ou letras');
  else for (const l of e.letras) { naEtapa.add(l); if (!ordem.includes(l)) erro(`etapa ${e.id}: letra "${l}" fora da ordem`); }
}
for (const l of ordem) if (!naEtapa.has(l)) erro(`letra "${l}" não está em nenhuma etapa`);

const letras = c.letras || {};
const silabas = c.silabas || {};
const palavras = c.palavras || {};

// letras
for (const l of ordem) {
  const x = letras[l];
  if (!x) { erro(`letras: falta "${l}"`); continue; }
  const p = `letras.${l}`;
  if (x.maiuscula !== l.toUpperCase()) erro(`${p}.maiuscula deveria ser "${l.toUpperCase()}"`);
  if (x.tipo !== (VOGAIS.includes(l) ? 'vogal' : 'consoante')) erro(`${p}.tipo incorreto`);
  if (!x.fonema || !/^\/.+\/$/.test(x.fonema)) erro(`${p}.fonema deve estar entre barras (IPA)`);
  if (typeof x.continuo !== 'boolean') erro(`${p}.continuo deve ser booleano`);
  if (x.audio !== `som_${l}`) erro(`${p}.audio deve ser "som_${l}"`);
  if (!x.dica) erro(`${p}.dica ausente`);
  if (!('tts' in x)) erro(`${p}.tts ausente (use null para oclusivas)`);
  if (!Array.isArray(x.palavras) || x.palavras.length !== 3) erro(`${p}.palavras deve ter 3 palavras`);
  else {
    for (const w of x.palavras) {
      if (!FIGURAS[l].includes(w)) erro(`${p}.palavras: "${w}" não é figura da letra ${l} na lista fixa`);
      if (!palavras[w]) erro(`${p}.palavras: palavra "${w}" inexistente em "palavras"`);
    }
  }
  if (!VOGAIS.includes(l)) {
    if (OCLUSIVAS.includes(l)) {
      if (x.tts !== null) erro(`${p}: oclusiva deve ter tts null (achei ${JSON.stringify(x.tts)})`);
      if (x.continuo) erro(`${p}: oclusiva não pode ser continuo:true`);
    } else {
      if (typeof x.tts !== 'string' || !x.tts) erro(`${p}: consoante contínua precisa de tts alongado`);
      else if (!x.continuo) erro(`${p}: consoante com tts de som contínuo deveria ter continuo:true`);
    }
    if (typeof x.tts === 'string') {
      const t = sem(x.tts);
      if (NOMES_LETRAS.includes(t)) erro(`${p}.tts "${x.tts}" é o NOME da letra, não o som`);
      if (!new RegExp(`^${l}{3,}$`).test(t) && !/^(.)\1{2,}$/.test(t)) erro(`${p}.tts "${x.tts}" deveria ser a letra repetida (ex.: "mmmmm")`);
    }
  } else if (typeof x.tts !== 'string' || !x.tts) erro(`${p}: vogal precisa de tts`);
}
for (const l of Object.keys(letras)) if (!ordem.includes(l)) erro(`letras: "${l}" não está na ordem`);

// sílabas
for (const [id, s] of Object.entries(silabas)) {
  const p = `silabas.${id}`;
  if (!/^[a-z]{2}$/.test(id)) erro(`${p}: id deve ser 2 letras minúsculas ASCII`);
  if (!Array.isArray(s.letras) || s.letras.length !== 2) erro(`${p}.letras deve ter 2 letras`);
  else {
    for (const l of s.letras) if (!letras[l]) erro(`${p}: letra "${l}" inexistente em "letras"`);
    if (s.letras.join('') !== id) erro(`${p}: letras não correspondem ao id`);
  }
  if (s.texto !== id.toUpperCase()) erro(`${p}.texto deveria ser "${id.toUpperCase()}"`);
  if (s.audio !== `sil_${id}`) erro(`${p}.audio deve ser "sil_${id}" (convenção som_/sil_/pal_)`);
  if (typeof s.tts !== 'string' || !s.tts) erro(`${p}.tts ausente`);
}

// palavras
const juntaveis = [];
for (const [id, w] of Object.entries(palavras)) {
  const p = `palavras.${id}`;
  if (!/^[a-z]+$/.test(id)) erro(`${p}: id deve ser minúsculas ASCII sem acento`);
  const dona = ORDEM.find((l) => FIGURAS[l].includes(id));
  if (!dona) erro(`${p}: id fora da lista fixa de 51 figuras`);
  if (w.figura !== `assets/svg/figuras/${id}.svg`) erro(`${p}.figura deve ser "assets/svg/figuras/${id}.svg"`);
  if (w.audio !== `pal_${id}`) erro(`${p}.audio deve ser "pal_${id}"`);
  if (dona && w.inicial !== dona) erro(`${p}.inicial "${w.inicial}" difere da letra que a lista ("${dona}")`);
  if (!(letras[w.inicial]?.palavras || []).includes(id)) erro(`${p}: não listada em letras.${w.inicial}.palavras`);
  if (!w.texto) erro(`${p}.texto ausente`);
  if (!w.tts) erro(`${p}.tts ausente`);
  if (typeof w.juntar !== 'boolean') erro(`${p}.juntar deve ser booleano`);
  if (!Array.isArray(w.silabas)) erro(`${p}.silabas ausente`);
  else {
    for (const s of w.silabas) if (!silabas[s]) erro(`${p}: sílaba "${s}" inexistente em "silabas"`);
    if (w.juntar) {
      juntaveis.push(id);
      if (w.silabas.length !== 2) erro(`${p}: juntar:true exige 2 sílabas`);
      if (w.silabas.join('') !== id) erro(`${p}: juntar:true exige que as sílabas formem a palavra (${w.silabas.join('')} != ${id})`);
      if (w.silabas[0] && w.silabas[0][0] !== w.inicial) erro(`${p}: primeira sílaba não começa pela inicial`);
    }
  }
}
for (const l of ordem) for (const w of FIGURAS[l]) if (!palavras[w]) erro(`palavras: falta "${w}"`);

// figuras em disco (somente aviso)
const dirFig = path.join(raiz, 'assets/svg/figuras');
let faltam = [];
if (fs.existsSync(dirFig)) {
  for (const l of ORDEM) for (const w of FIGURAS[l]) if (!fs.existsSync(path.join(dirFig, `${w}.svg`))) faltam.push(w);
  if (faltam.length) avisos.push(`AVISO: ${faltam.length} figura(s) ainda não existem em assets/svg/figuras: ${faltam.join(', ')}`);
}

for (const a of avisos) console.warn(a);
if (erros.length) {
  console.error(`\n${erros.length} erro(s) no currículo:`);
  for (const e of erros) console.error(' - ' + e);
  process.exit(1);
}
console.log(`OK: ${ordem.length} letras, ${Object.keys(silabas).length} sílabas, ${Object.keys(palavras).length} palavras (${juntaveis.length} para Junte os Sons).`);
