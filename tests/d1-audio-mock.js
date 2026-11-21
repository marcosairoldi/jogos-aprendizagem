// Mock de js/audio.js para os testes da casca: mesma API, registra as chamadas.
window.__audio = window.__audio || { chamadas: [], config: null, desbloqueios: 0 };
const reg = window.__audio;
export function configurar(c) { reg.config = c; reg.chamadas.push({ tipo: 'configurar' }); }
export async function desbloquear() { reg.desbloqueios += 1; reg.chamadas.push({ tipo: 'desbloquear' }); }
export async function falar(itens) { reg.chamadas.push({ tipo: 'falar', itens, nome: reg.config && reg.config.obterNome ? reg.config.obterNome() : null }); return { cancelado: false }; }
export function efeito(n) { reg.chamadas.push({ tipo: 'efeito', n }); }
export function parar() { reg.chamadas.push({ tipo: 'parar' }); }
export function estado() { return { desbloqueado: reg.desbloqueios > 0, temVozPtBr: window.__semVoz ? false : true }; }
