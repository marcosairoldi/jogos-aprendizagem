// Renderiza todas as letras de data/tracados.json num PNG para conferência visual.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const dados = JSON.parse(readFileSync(new URL('../data/tracados.json', import.meta.url)));
const cores = ['#d6336c', '#2b8a3e', '#1971c2', '#e8590c'];
let html = '<body style="margin:0;background:#fff0f6;display:flex;flex-wrap:wrap;width:900px">';
for (const [k, v] of Object.entries(dados.letras)) {
  html += `<div style="width:150px;text-align:center;font:14px sans-serif"><svg viewBox="0 0 100 100" width="150" height="150" style="background:#fff">`;
  v.tracos.forEach((t, i) => {
    html += `<polyline points="${t.map(p => p.join(',')).join(' ')}" fill="none" stroke="${cores[i % 4]}" stroke-width="3" stroke-linecap="round"/>`;
    html += `<circle cx="${t[0][0]}" cy="${t[0][1]}" r="3.5" fill="${cores[i % 4]}"/><text x="${t[0][0] + 3}" y="${t[0][1] - 3}" font-size="8">${i + 1}</text>`;
    t.forEach(p => { html += `<circle cx="${p[0]}" cy="${p[1]}" r="0.9" fill="#000"/>`; });
  });
  html += `</svg>${k.toUpperCase()}</div>`;
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
await p.setContent(html);
mkdirSync('/tmp/claude-0/d2', { recursive: true });
await p.screenshot({ path: '/tmp/claude-0/d2/tracados.png', fullPage: true });
await b.close();
