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
  j: [[[66,15],[66,62], ...arco(46,62,20,23,0,180).slice(1)]],
  z: [L([22,15],[78,15],[22,85],[78,85])],
  h: [L([26,15],[26,85]), L([74,15],[74,85]), L([26,50],[74,50])],
  k: [L([28,15],[28,85]), L([74,15],[28,52]), L([28,52],[74,85])],
  q: [arco(50,50,28,35,-90,-450), L([56,62],[80,88])],
  w: [L([14,15],[32,85],[50,35],[68,85],[86,15])],
  x: [L([22,15],[78,85]), L([78,15],[22,85])],
  y: [L([22,15],[50,50]), L([78,15],[50,50]), L([50,50],[50,85])],
  r: [L([28,15],[28,85]), [[28,15],[54,15], ...arco(54,35,21,20,-90,90).slice(1), [28,55]], L([46,55],[78,85])],
};


// Minúsculas de imprensa como a fonte Andika desenha (a e g de um andar).
// viewBox 0 0 100 100: ascendente 15, altura-x 45, linha de base 85, descendente até 97.
// Bolinhas no sentido anti-horário a partir do alto à direita; hastes de cima para baixo.
const minusculas = {
  a: [arco(46,65,19,20,-45,-405), L([65,45],[65,85])],
  b: [L([30,15],[30,85]), arco(50,65,20,20,180,540)],
  c: [arco(52,65,20,20,-40,-320)],
  d: [arco(50,65,20,20,-45,-405), L([70,15],[70,85])],
  e: [[[32,65],[68,65], ...arco(50,65,18,20,0,-320).slice(1)]],
  f: [[...arco(60,28,12,13,-20,-180), [48,85]], L([36,45],[62,45])],
  g: [arco(46,65,19,20,-45,-405), [[65,45],[65,80], ...arco(47,80,18,17,0,140).slice(1)]],
  h: [L([30,15],[30,85]), [[30,62], ...arco(50,62,20,17,180,360).slice(1), [70,85]]],
  i: [L([50,45],[50,85]), L([50,25],[50,31])],
  j: [[[56,45],[56,82], ...arco(42,82,14,15,0,140).slice(1)], L([56,25],[56,31])],
  k: [L([30,15],[30,85]), L([68,45],[30,68]), L([42,60],[70,85])],
  l: [L([50,15],[50,85])],
  m: [L([22,45],[22,85]), [[22,62], ...arco(36,62,14,17,180,360).slice(1), [50,85]], [[50,62], ...arco(64,62,14,17,180,360).slice(1), [78,85]]],
  n: [L([30,45],[30,85]), [[30,62], ...arco(50,62,20,17,180,360).slice(1), [70,85]]],
  o: [arco(50,65,20,20,-90,-450)],
  p: [L([30,45],[30,97]), arco(50,65,20,20,180,540)],
  q: [arco(48,65,20,20,-45,-405), L([68,45],[68,97])],
  r: [L([32,45],[32,85]), [[32,62], ...arco(52,62,20,17,180,290).slice(1)]],
  s: [[...arco(50,55,17,10,-30,-270), ...arco(50,75,17,10,-90,150).slice(1)]],
  t: [[[46,25],[46,75], ...arco(58,75,12,10,180,90).slice(1)], L([34,45],[62,45])],
  u: [[[28,45],[28,70], ...arco(48,70,20,15,180,0).slice(1), [68,45]], L([68,45],[68,85])],
  v: [L([25,45],[50,85],[75,45])],
  w: [L([14,45],[32,85],[50,52],[68,85],[86,45])],
  x: [L([28,45],[72,85]), L([72,45],[28,85])],
  y: [L([28,45],[50,85]), L([72,45],[50,85],[40,97])],
  z: [L([28,45],[72,45],[28,85],[72,85])],
};

const saida = { viewBox: '0 0 100 100', letras: {} };
for (const [k, tracos] of Object.entries(letras)) {
  saida.letras[k] = { tracos: tracos.map(reamostrar), minuscula: { tracos: minusculas[k].map(reamostrar) } };
}
const destino = fileURLToPath(new URL('../data/tracados.json', import.meta.url));
writeFileSync(destino, JSON.stringify(saida));
console.log('ok', Object.keys(saida.letras).length, 'letras');
