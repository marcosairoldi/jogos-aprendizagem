// Gera data/tracados.json: letras bastão MAIÚSCULAS em viewBox 0 0 100 100.
// Uso: node tests/d2-gerar-tracados.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PASSO = 4; // distância aproximada entre pontos de controle

const rad = (g) => (g * Math.PI) / 180;
// arco elíptico de angulo a (graus) até b; ângulo 0 = direita, 90 = baixo (coordenadas de tela)
function arco(cx, cy, rx, ry, a, b) {
  const n = Math.max(6, Math.ceil(Math.abs(b - a) / 8));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = rad(a + ((b - a) * i) / n);
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}
// reamostra uma polilinha em pontos igualmente espaçados
function reamostrar(pts) {
  const out = [pts[0]];
  let falta = PASSO;
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    let d = Math.hypot(x1 - x0, y1 - y0);
    while (d >= falta) {
      const f = falta / d;
      x0 += (x1 - x0) * f; y0 += (y1 - y0) * f;
      out.push([x0, y0]);
      d = Math.hypot(x1 - x0, y1 - y0);
      falta = PASSO;
    }
    falta -= d;
  }
  const u = pts[pts.length - 1], l = out[out.length - 1];
  if (Math.hypot(u[0] - l[0], u[1] - l[1]) > 1) out.push(u);
  return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}
const L = (...p) => p; // polilinha crua

const letras = {
  a: [L([50,15],[18,85]), L([50,15],[82,85]), L([32,62],[68,62])],
  e: [L([28,15],[28,85]), L([28,15],[76,15]), L([28,50],[68,50]), L([28,85],[76,85])],
  i: [L([50,15],[50,85])],
  o: [arco(50,50,28,35,-90,-450)],
  u: [[[24,15],[24,60], ...arco(50,60,26,25,180,0).slice(1), [76,15]]],
  m: [L([20,15],[20,85]), L([20,15],[50,66],[80,15]), L([80,15],[80,85])],
  p: [L([28,15],[28,85]), [[28,15],[54,15], ...arco(54,35,21,20,-90,90).slice(1), [28,55]]],
  b: [L([28,15],[28,85]), [[28,15],[50,15], ...arco(50,32.5,20,17.5,-90,90).slice(1), [28,50]],
      [[28,50],[52,50], ...arco(52,67.5,22,17.5,-90,90).slice(1), [28,85]]],
  t: [L([20,15],[80,15]), L([50,15],[50,85])],
  f: [L([28,15],[28,85]), L([28,15],[76,15]), L([28,50],[66,50])],
  v: [L([20,15],[50,85],[80,15])],
  s: [[...arco(50,32,22,17,-30,-270), ...arco(50,66,22,17,-90,150).slice(1)]],
  l: [L([30,15],[30,85],[76,85])],
  n: [L([24,15],[24,85]), L([24,15],[76,85]), L([76,15],[76,85])],
  d: [L([26,15],[26,85]), [[26,15],[46,15], ...arco(46,50,30,35,-90,90).slice(1), [26,85]]],
  c: [arco(54,50,28,35,-40,-320)],
  g: [arco(54,50,28,35,-40,-360), L([58,50],[82,50])],
};

const saida = { viewBox: '0 0 100 100', letras: {} };
for (const [k, tracos] of Object.entries(letras)) {
  saida.letras[k] = { tracos: tracos.map(reamostrar) };
}
const destino = fileURLToPath(new URL('../data/tracados.json', import.meta.url));
writeFileSync(destino, JSON.stringify(saida));
console.log('ok', Object.keys(saida.letras).length, 'letras');
