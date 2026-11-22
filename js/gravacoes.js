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

// ---------------------------------------------------------------------------
// Backup (Área dos pais): exportar tudo e substituir tudo de uma vez
// ---------------------------------------------------------------------------

/** Todas as gravações: [{ id, blob, tipo, duracao, criadoEm }]. Sem banco, devolve lista vazia. */
export async function exportarTodas() {
  try {
    const db = await abrir();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOJA, 'readonly');
      const loja = tx.objectStore(LOJA);
      const chaves = loja.getAllKeys();
      const valores = loja.getAll();
      tx.oncomplete = () => {
        const ks = chaves.result || [];
        const vs = valores.result || [];
        resolve(ks.map((k, i) => ({ id: String(k), blob: vs[i] && vs[i].blob, tipo: (vs[i] && vs[i].tipo) || '', duracao: (vs[i] && vs[i].duracao) || 0, criadoEm: (vs[i] && vs[i].criadoEm) || 0 })).filter((x) => x.blob));
      };
      tx.onerror = () => reject(tx.error || new Error('falha na leitura'));
      tx.onabort = () => reject(tx.error || new Error('leitura cancelada'));
    });
  } catch (e) {
    return [];
  }
}

/**
 * Troca TODAS as gravações pela lista dada, numa única transação: se qualquer parte falhar,
 * a transação é cancelada e as gravações atuais continuam como estavam. Devolve true se deu certo.
 */
export async function substituirTodas(lista) {
  try {
    const db = await abrir();
    return await new Promise((resolve) => {
      let tx;
      try { tx = db.transaction(LOJA, 'readwrite'); } catch (e) { resolve(false); return; }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      try {
        const loja = tx.objectStore(LOJA);
        loja.clear();
        for (const g of lista) loja.put({ blob: g.blob, tipo: g.tipo || (g.blob && g.blob.type) || '', duracao: g.duracao || 0, criadoEm: g.criadoEm || Date.now() }, g.id);
      } catch (e) {
        try { tx.abort(); } catch (e2) { /* já cancelada */ }
        resolve(false);
      }
    });
  } catch (e) {
    return false;
  }
}
