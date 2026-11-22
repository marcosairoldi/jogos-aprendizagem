// Backup da Área dos pais: um arquivo JSON baixado pela própria adulta (nada sai do aparelho sozinho).
// Guarda progresso, ajustes e as gravações da voz (em base64). A restauração é atômica: se algo falhar, nada muda.
import * as progresso from '../progresso.js';
import * as gravacoes from '../gravacoes.js';
import { legendasLigadas, definirLegendas } from '../legenda.js';

export const APP_ID = 'trilha-dos-sons';
const MAX_ARQUIVO_MB = 80;
const ID_AUDIO = /^(som|sil|pal|frase)_[a-z0-9_]{1,60}$/;
const MIME = /^audio\/[\w.+-]+(;[\w= .+-]+)?$/;

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error || new Error('leitura'));
    r.readAsDataURL(blob);
  });
}

/** Monta o objeto do backup (e marca a data da cópia depois, quando o arquivo for entregue). */
export async function gerarBackup() {
  const agora = Date.now();
  const p = progresso.exportar();
  const aj = p.ajustes;
  delete p.ajustes;
  p.ultimoBackup = agora;
  const lista = await gravacoes.exportarTodas();
  const gravacoesB64 = [];
  for (const g of lista) {
    gravacoesB64.push({ id: g.id, mime: g.tipo || g.blob.type || 'audio/wav', duracao: g.duracao, criadoEm: g.criadoEm, base64: await blobParaBase64(g.blob) });
  }
  return {
    app: APP_ID, versao: 1, criadoEm: agora,
    progresso: p,
    ajustes: { ...aj, legendas: legendasLigadas() },
    gravacoes: gravacoesB64,
  };
}

/** Baixa o objeto como arquivo .json e marca a data da última cópia. */
export function baixarBackup(backup) {
  const dia = new Date(backup.criadoEm).toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `trilha-dos-sons-${dia}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  progresso.marcarBackup(backup.criadoEm);
}

const INVALIDO = 'Este arquivo não é uma cópia válida da Trilha dos Sons. Nada foi alterado.';

function base64ParaBlob(b64, mime) {
  if (typeof b64 !== 'string' || b64.length < 4 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error('base64');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Lê e valida o texto de um arquivo de backup SEM alterar nada.
 * Devolve { progresso, legendas, gravacoes:[{id,blob,tipo,duracao,criadoEm}], criadoEm, resumo }. Lança Error(mensagem clara).
 */
export function validarBackup(texto) {
  let o;
  try { o = JSON.parse(texto); } catch (e) { throw new Error('Este arquivo não é uma cópia da Trilha dos Sons (não é um JSON). Nada foi alterado.'); }
  if (!o || typeof o !== 'object' || o.app !== APP_ID) throw new Error(INVALIDO);
  if (o.versao !== 1) throw new Error('Esta cópia é de uma versão que este jogo não conhece. Nada foi alterado.');
  if (!Number.isFinite(o.criadoEm) || o.criadoEm <= 0) throw new Error(INVALIDO);
  let prog;
  try {
    const p = { ...(o.progresso || {}) };
    if (!o.ajustes || typeof o.ajustes !== 'object') throw new Error('ajustes ausentes');
    const { legendas, ...aj } = o.ajustes;
    if (legendas !== undefined && typeof legendas !== 'boolean') throw new Error('ajustes inválidos');
    p.ajustes = aj;
    prog = { dados: progresso.validar(p), legendas: legendas !== false };
  } catch (e) {
    throw new Error(`A cópia está com o progresso inválido (${e.message}). Nada foi alterado.`);
  }
  if (!Array.isArray(o.gravacoes)) throw new Error(INVALIDO);
  const ids = new Set();
  const grav = [];
  for (const g of o.gravacoes) {
    try {
      if (!g || !ID_AUDIO.test(g.id) || ids.has(g.id) || typeof g.mime !== 'string' || !MIME.test(g.mime)) throw new Error('x');
      ids.add(g.id);
      grav.push({ id: g.id, blob: base64ParaBlob(g.base64, g.mime), tipo: g.mime, duracao: Number.isFinite(g.duracao) && g.duracao >= 0 ? g.duracao : 0, criadoEm: Number.isFinite(g.criadoEm) && g.criadoEm >= 0 ? g.criadoEm : o.criadoEm });
    } catch (e) {
      throw new Error('Uma das gravações de voz da cópia está danificada. Nada foi alterado.');
    }
  }
  return {
    criadoEm: o.criadoEm, progresso: prog.dados, legendas: prog.legendas, gravacoes: grav,
    resumo: { sessoes: prog.dados.sessoes, letras: prog.dados.liberadas.length, gravacoes: grav.length, nome: prog.dados.nome },
  };
}

export function lerArquivo(arquivo) {
  if (!arquivo) return Promise.reject(new Error('Nenhum arquivo escolhido.'));
  if (arquivo.size > MAX_ARQUIVO_MB * 1024 * 1024) return Promise.reject(new Error(`O arquivo é grande demais (mais de ${MAX_ARQUIVO_MB} MB). Nada foi alterado.`));
  return arquivo.text().then(validarBackup);
}

/**
 * Restaura tudo ou nada. Ordem: progresso (localStorage) -> gravações (IndexedDB, uma transação).
 * Se a segunda parte falhar, a primeira é desfeita e a mensagem de erro diz que nada mudou.
 */
export async function restaurarBackup(b, audio) {
  const legendasAntes = legendasLigadas();
  const anterior = progresso.substituir(b.progresso);
  if (!anterior) throw new Error('Não foi possível guardar os dados neste aparelho (sem espaço?). Nada foi alterado.');
  definirLegendas(b.legendas);
  if (gravacoes.disponivel() || b.gravacoes.length) {
    const ok = await gravacoes.substituirTodas(b.gravacoes);
    if (!ok && (b.gravacoes.length || gravacoes.disponivel())) {
      progresso.desfazerSubstituicao(anterior);
      definirLegendas(legendasAntes);
      throw new Error('Não foi possível restaurar as gravações de voz neste navegador. Nada foi alterado.');
    }
  }
  try { const r = audio && audio.gravacoesMudaram && audio.gravacoesMudaram(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignora */ }
}
