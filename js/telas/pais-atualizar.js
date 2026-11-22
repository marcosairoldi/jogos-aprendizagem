// Atualização controlada do jogo. O service worker novo fica ESPERANDO (sem skipWaiting automático);
// só quando a adulta toca em "Atualizar" na Área dos pais é que ele assume e a página recarrega.
// Nada de dados é tocado: progresso (localStorage) e gravações (IndexedDB) continuam como estão.

let registro = null;
let esperando = false;
let iniciado = false;
const ouvintes = new Set();

const suporta = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

function marcar(v) {
  if (esperando === v) return;
  esperando = v;
  ouvintes.forEach((f) => { try { f(v); } catch (e) { /* ignora */ } });
}

function acompanhar(reg) {
  registro = reg;
  if (reg.waiting && navigator.serviceWorker.controller) marcar(true);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) marcar(true);
    });
  });
}

/** Começa a acompanhar o service worker (chamar uma vez, ao abrir o app). */
export function iniciar() {
  if (iniciado || !suporta()) return;
  iniciado = true;
  navigator.serviceWorker.ready.then(acompanhar).catch(() => {});
}

export const temAtualizacao = () => esperando;
export function aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

/** Pergunta ao servidor se há versão nova (o navegador baixa e instala em segundo plano). */
export async function verificar() {
  if (!registro) return false;
  try { await registro.update(); } catch (e) { /* offline: segue */ }
  if (registro.waiting && navigator.serviceWorker.controller) marcar(true);
  return esperando;
}

/** Versão (nome do cache) do service worker que controla a página, ou null. */
export function versaoAtual() {
  return new Promise((resolve) => {
    const c = suporta() && navigator.serviceWorker.controller;
    if (!c) { resolve(null); return; }
    const canal = new MessageChannel();
    const t = setTimeout(() => resolve(null), 1500);
    canal.port1.onmessage = (e) => { clearTimeout(t); resolve((e.data && e.data.versao) || null); };
    try { c.postMessage({ tipo: 'VERSAO' }, [canal.port2]); } catch (e) { clearTimeout(t); resolve(null); }
  });
}

/** Ativa a versão que está esperando e recarrega a página. Resolve false se não havia nada esperando. */
export function aplicar() {
  const w = registro && registro.waiting;
  if (!w) return Promise.resolve(false);
  return new Promise((resolve) => {
    let recarregou = false;
    const recarregar = () => { if (recarregou) return; recarregou = true; location.reload(); resolve(true); };
    navigator.serviceWorker.addEventListener('controllerchange', recarregar, { once: true });
    setTimeout(recarregar, 6000); // reserva: se o aviso de troca não vier, recarrega mesmo assim
    w.postMessage({ tipo: 'PULAR_ESPERA' });
  });
}
