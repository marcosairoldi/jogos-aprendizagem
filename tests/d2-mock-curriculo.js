// Currículo de mentira para testar os jogos (esquema do PLANO.md, letras a e i o u m p b t).
const cores = ['#f783ac', '#b197fc', '#66d9e8', '#ffd43b', '#8ce99a', '#ffa94d'];
function figura(id, i) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="20" y="20" width="160" height="160" rx="40" fill="${cores[i % cores.length]}"/><circle cx="100" cy="100" r="40" fill="#fff"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const PAL = {
  a: ['abelha', 'anel', 'aviao'], e: ['elefante', 'ervilha', 'ema'], i: ['ilha', 'iglu', 'ioio'],
  o: ['ovo', 'olho', 'ovelha'], u: ['uva', 'urso', 'unicornio'], m: ['mapa', 'moto', 'mala'],
  p: ['pato', 'pipa', 'pe'], b: ['bola', 'bolo', 'bota'], t: ['tatu', 'tomate', 'tapete'],
};
const SILABAS_PAL = { mapa: ['ma', 'pa'], moto: ['mo', 'to'], pato: ['pa', 'to'], pipa: ['pi', 'pa'], bota: ['bo', 'ta'], tatu: ['ta', 'tu'] };
const silabas = {};
for (const s of ['ma', 'mo', 'pa', 'to', 'pi', 'ta', 'tu', 'bo']) {
  silabas[s] = { texto: s.toUpperCase(), letras: s.split(''), audio: 'sil_' + s, tts: s };
}
silabas.ai = { texto: 'AI', letras: ['a', 'i'], audio: 'sil_ai', tts: 'ai' };
silabas.oi = { texto: 'OI', letras: ['o', 'i'], audio: 'sil_oi', tts: 'oi' };

const letras = {};
const palavras = {};
let n = 0;
for (const [l, lista] of Object.entries(PAL)) {
  letras[l] = { maiuscula: l.toUpperCase(), tipo: 'x', audio: 'som_' + l, palavras: lista };
  for (const id of lista) {
    palavras[id] = { texto: id.toUpperCase(), silabas: SILABAS_PAL[id] || [id], inicial: l, figura: figura(id, n++), audio: 'pal_' + id, tts: id, juntar: !!SILABAS_PAL[id] };
  }
}
export const curriculoMock = {
  versao: 1,
  regras: { itensPorRodada: 5, janelaDominio: 6, acertosParaDominar: 5, jogosDistintosParaDominar: 2, sessoesParaDominar: 2, proporcaoRevisao: 0.3, minutosSessao: 8, opcoesMin: 2, opcoesMax: 4 },
  ordem: ['a', 'e', 'i', 'o', 'u', 'm', 'p', 'b', 't'],
  etapas: [{ id: 'vogais', letras: ['a', 'e', 'i', 'o', 'u'] }],
  letras, silabas, palavras,
};
