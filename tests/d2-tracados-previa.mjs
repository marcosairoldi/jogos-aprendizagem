// Renderiza todas as letras (maiúscula e minúscula lado a lado) de data/tracados.json num PNG para conferência visual.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const dados = JSON.parse(readFileSync(new URL('../data/tracados.json', import.meta.url)));
const cores = ['#d6336c', '#2b8a3e', '#1971c2', '#e8590c'];
function desenhar(tracos, dx) {
  let h = '';
  tracos.forEach((t, i) => {
    const pts = t.map((p) => `${p[0] + dx},${p[1]}`).join(' ');
    h += `<polyline points="${pts}" fill="none" stroke="${cores[i % 4]}" stroke-width="3" stroke-linecap="round"/>`;
    h += `<circle cx="${t[0][0] + dx}" cy="${t[0][1]}" r="3.5" fill="${cores[i % 4]}"/><text x="${t[0][0] + dx + 3}" y="${t[0][1] - 3}" font-size="8">${i + 1}</text>`;
    t.forEach((p) => { h += `<circle cx="${p[0] + dx}" cy="${p[1]}" r="0.9" fill="#000"/>`; });
  });
  return h;
}
let html = '<body style="margin:0;background:#fff0f6;display:flex;flex-wrap:wrap;width:1200px;font-family:Andika,sans-serif">';
for (const [k, v] of Object.entries(dados.letras)) {
  html += `<div style="width:300px;text-align:center;font:14px sans-serif"><svg viewBox="0 0 200 100" width="300" height="150" style="background:#fff">`;
  html += '<line x1="0" y1="85" x2="200" y2="85" stroke="#ccc" stroke-width=".5"/><line x1="0" y1="45" x2="200" y2="45" stroke="#ddd" stroke-width=".5"/>';
  html += desenhar(v.tracos, 0) + desenhar(v.minuscula.tracos, 100);
  html += `<text x="100" y="97" font-size="12" opacity=".15" text-anchor="end" font-family="Andika,sans-serif">${k.toUpperCase()}</text><text x="100" y="97" font-size="12" opacity=".15" font-family="Andika,sans-serif">${k}</text></svg></div>`;
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
await p.setContent(html);
mkdirSync('/tmp/claude-0/d2', { recursive: true });
await p.screenshot({ path: '/tmp/claude-0/d2/tracados.png', fullPage: true });
await b.close();
