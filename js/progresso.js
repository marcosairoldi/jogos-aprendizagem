// Progresso da criança: letras liberadas, histórico, recompensas, tempo.
// Tudo fica só no aparelho (localStorage, chave 'trilhaSons.v1').
import { ler, gravar, remover } from './armazenamento.js';

const CHAVE = 'trilhaSons.v1';
const INATIVIDADE_NOVA_SESSAO_MS = 30 * 60 * 1000;
const MAX_HISTORICO = 30;

const REGRAS_PADRAO = {
  itensPorRodada: 5,
  janelaDominio: 6,
  acertosParaDominar: 5,
  jogosDistintosParaDominar: 2,
  sessoesParaDominar: 2,
  proporcaoRevisao: 0.3,
  minutosSessao: 8,
  opcoesMin: 2,
  opcoesMax: 4,
};

let regras = { ...REGRAS_PADRAO };
let ordem = [];
let dados = null;

function vazio() {
  return {
    v: 1,
    nome: '',
    guia: null,
    liberadas: ordem.length ? [ordem[0]] : [],
    hist: {},
    rec: { estrela: 0, concha: 0, chifre: 0 },
    recSessao: { estrela: 0, concha: 0, chifre: 0 },
    tempoTotal: 0,
    tempoSessao: 0,
    sessoes: 0,
    sessaoId: 0,
    ultima: 0,
  };
}

function salvar() {
  if (dados) gravar(CHAVE, dados);
}

/** Carrega o currículo (regras e ordem) e o progresso salvo. */
export function carregar(curriculo) {
  regras = { ...REGRAS_PADRAO, ...((curriculo && curriculo.regras) || {}) };
  ordem = Array.isArray(curriculo && curriculo.ordem) && curriculo.ordem.length
    ? curriculo.ordem.slice()
    : Object.keys((curriculo && curriculo.letras) || {});
  const salvo = ler(CHAVE, null);
  const base = vazio();
  dados = salvo && typeof salvo === 'object' ? { ...base, ...salvo } : base;
  dados.rec = { ...base.rec, ...(dados.rec || {}) };
  dados.recSessao = { ...base.recSessao, ...(dados.recSessao || {}) };
  if (!dados.hist || typeof dados.hist !== 'object') dados.hist = {};
  // só letras que existem na ordem; a primeira sempre liberada
  dados.liberadas = (Array.isArray(dados.liberadas) ? dados.liberadas : []).filter((l) => ordem.includes(l));
  if (!dados.liberadas.length && ordem.length) dados.liberadas = [ordem[0]];
  if (dados.guia !== 'lumi' && dados.guia !== 'marola') dados.guia = null;
  novaSessaoSeNecessario();
  salvar();
  return dados;
}

export function getRegras() {
  return regras;
}

export function nome() {
  return (dados && dados.nome) || '';
}
export function definirNome(n) {
  dados.nome = String(n || '').trim().slice(0, 30);
  salvar();
}
export function guia() {
  return (dados && dados.guia) || null;
}
export function definirGuia(g) {
  dados.guia = g === 'marola' ? 'marola' : 'lumi';
  salvar();
}

export function letrasLiberadas() {
  return dados.liberadas.slice();
}

/** Letra mais nova ainda não dominada (ou null se todas estão dominadas). */
export function letraFoco() {
  for (let i = dados.liberadas.length - 1; i >= 0; i--) {
    if (estadoLetra(dados.liberadas[i]) !== 'dominada') return dados.liberadas[i];
  }
  return null;
}

/** Estado: 'nova' (poucas tentativas), 'pratica' ou 'dominada'. */
export function estadoLetra(l) {
  const h = dados.hist[l] || [];
  if (h.length < 3) return 'nova';
  const janela = h.slice(-regras.janelaDominio);
  const acertos = janela.filter((x) => x.ok).length;
  const jogos = new Set(janela.map((x) => x.jogo)).size;
  const sessoes = new Set(janela.map((x) => x.sessao)).size;
  if (
    acertos >= regras.acertosParaDominar &&
    jogos >= regras.jogosDistintosParaDominar &&
    sessoes >= regras.sessoesParaDominar
  ) return 'dominada';
  return 'pratica';
}

/** Registra uma tentativa de uma letra. */
export function registrar({ letra, acertouPrimeira, jogo }) {
  if (!letra) return;
  novaSessaoSeNecessario();
  const h = dados.hist[letra] || (dados.hist[letra] = []);
  h.push({ jogo: jogo || '?', ok: !!acertouPrimeira, sessao: dados.sessaoId, t: Date.now() });
  if (h.length > MAX_HISTORICO) h.splice(0, h.length - MAX_HISTORICO);
  dados.ultima = Date.now();
  salvar();
}

/** Se a última letra liberada está dominada, libera a próxima e a devolve. */
export function verificarAvanco() {
  const ultima = dados.liberadas[dados.liberadas.length - 1];
  if (!ultima || estadoLetra(ultima) !== 'dominada') return null;
  return liberarProxima();
}

/** Libera a próxima letra da ordem (também é o atalho da adulta). */
export function liberarProxima() {
  const prox = ordem.find((l) => !dados.liberadas.includes(l));
  if (!prox) return null;
  dados.liberadas.push(prox);
  salvar();
  return prox;
}

function acertosRecentes(l) {
  return (dados.hist[l] || []).slice(-regras.janelaDominio).filter((x) => x.ok).length;
}
function ultimaVez(l) {
  const h = dados.hist[l] || [];
  return h.length ? h[h.length - 1].t : 0;
}

/**
 * Letras da rodada: a letra foco primeiro, mais letras antigas para revisão
 * (as menos recentes e com menos acertos primeiro). Sem repetição.
 * Com n=5 e proporcaoRevisao 0.3, devolve a foco + até 2 antigas.
 * `foco` opcional força a letra foco (ex.: a criança tocou numa parada antiga).
 */
export function escolherLetrasRodada(n = regras.itensPorRodada, foco) {
  const f = foco !== undefined ? foco : letraFoco();
  const antigas = dados.liberadas
    .filter((l) => l !== f)
    .sort((a, b) => ultimaVez(a) - ultimaVez(b) || acertosRecentes(a) - acertosRecentes(b));
  if (!f) return antigas.slice(0, Math.max(1, n));
  const qtdRev = Math.min(antigas.length, Math.max(1, Math.ceil(n * regras.proporcaoRevisao)));
  // priorizar também quem tem menos acertos: ordena os candidatos mais antigos por acertos
  const candidatas = antigas.slice(0, Math.max(qtdRev * 2, qtdRev))
    .sort((a, b) => acertosRecentes(a) - acertosRecentes(b) || ultimaVez(a) - ultimaVez(b));
  return [f, ...candidatas.slice(0, qtdRev)];
}

export function ganharRecompensa(tipo) {
  if (!(tipo in dados.rec)) return;
  dados.rec[tipo] += 1;
  dados.recSessao[tipo] = (dados.recSessao[tipo] || 0) + 1;
  salvar();
}
export function recompensas() {
  return { ...dados.rec };
}
export function recompensasSessao() {
  return { ...dados.recSessao };
}

/** Marca atividade da criança (toque). */
export function tocar() {
  dados.ultima = Date.now();
}

/** Abre uma nova sessão se passaram >= 30 min desde a última atividade. */
export function novaSessaoSeNecessario(agora = Date.now()) {
  if (dados.sessoes === 0 || agora - dados.ultima >= INATIVIDADE_NOVA_SESSAO_MS) {
    dados.sessoes += 1;
    dados.sessaoId = dados.sessoes;
    dados.tempoSessao = 0;
    dados.recSessao = { estrela: 0, concha: 0, chifre: 0 };
    dados.ultima = agora;
    salvar();
    return true;
  }
  return false;
}

/** Soma tempo de uso (o app só chama com a página visível). */
export function adicionarTempo(ms) {
  if (!(ms > 0)) return;
  dados.tempoTotal += ms;
  dados.tempoSessao += ms;
  salvar();
}
export function tempoTotal() {
  return dados.tempoTotal;
}
export function tempoSessao() {
  return dados.tempoSessao;
}
export function numeroSessoes() {
  return dados.sessoes;
}

/** Apaga o progresso (letras, histórico, recompensas, tempo). Mantém nome e guia. */
export function reiniciar() {
  const { nome: n, guia: g } = dados;
  remover(CHAVE);
  dados = vazio();
  dados.nome = n;
  dados.guia = g;
  novaSessaoSeNecessario();
  salvar();
}
