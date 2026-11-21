// Gravações da voz da adulta, guardadas SÓ neste aparelho (IndexedDB). Nada sai do celular.
// Chave = id de áudio ('som_m', 'sil_ma', 'pal_mapa', 'frase_acerto_1').
// Valor = { blob, tipo, duracao, criadoEm }. Se o IndexedDB faltar ou falhar, disponivel() vira false e nada quebra.

const BANCO = 'trilhaSons-voz';
const LOJA = 'gravacoes';

let dispFlag = null; // null = ainda não testado
let abrindo = null;
let persistiu = false;

function existeIDB() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB && typeof indexedDB.open === 'function'; } catch (e) { return false; }
}

export function disponivel() {
  if (dispFlag === null) dispFlag = existeIDB();
  return dispFlag;
}

function abrir() {
  if (!disponivel()) return Promise.reject(new Error('sem IndexedDB'));
  if (abrindo) return abrindo;
  abrindo = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(BANCO, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      try { if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA); } catch (e) { /* tratado no onerror */ }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('falha ao abrir'));
    req.onblocked = () => reject(new Error('bloqueado'));
  }).catch((e) => {
    dispFlag = false; // modo anônimo ou bloqueado: desiste sem barulho
    abrindo = null;
    throw e;
  });
  return abrindo;
}

function pedido(modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(LOJA, modo); } catch (e) { reject(e); return; }
    let res;
    try { res = fn(tx.objectStore(LOJA)); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(res && 'result' in res ? res.result : undefined);
    tx.onerror = () => reject(tx.error || new Error('falha na transação'));
    tx.onabort = () => reject(tx.error || new Error('transação cancelada'));
  }));
}

/** Set com os ids gravados. Nunca rejeita: sem banco, devolve um Set vazio. */
export async function listarIds() {
  try {
    const chaves = await pedido('readonly', (s) => s.getAllKeys());
    return new Set((chaves || []).map(String));
  } catch (e) {
    return new Set();
  }
}

/** Blob da gravação ou null. */
export async function obter(id) {
  try {
    const v = await pedido('readonly', (s) => s.get(id));
    return v && v.blob ? v.blob : null;
  } catch (e) {
    return null;
  }
}

/** Devolve true se salvou. */
export async function salvar(id, blob, meta = {}) {
  try {
    await pedido('readwrite', (s) => s.put({ blob, tipo: meta.tipo || (blob && blob.type) || '', duracao: meta.duracao || 0, criadoEm: Date.now() }, id));
    if (!persistiu) {
      persistiu = true;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignora */ }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function apagar(id) {
  try { await pedido('readwrite', (s) => s.delete(id)); return true; } catch (e) { return false; }
}

export async function apagarTodas() {
  try { await pedido('readwrite', (s) => s.clear()); return true; } catch (e) { return false; }
}
