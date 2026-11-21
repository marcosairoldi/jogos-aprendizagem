// Gera assets/icones/icone-192.png, icone-512.png e icone-maskable-512.png (Playwright).
// Usa icone.svg e icone-maskable.svg; se faltarem, cria um icone provisorio (coracao rosa).
// Uso: node ferramentas/gerar-icones.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(raiz, 'assets/icones');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const provisorio = (margem) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${margem ? '' : 'rx="112" '}fill="#d6336c"/><path transform="translate(256 270) scale(${margem ? 0.62 : 0.8}) translate(-256 -256)" d="M256 430C120 330 70 250 70 180c0-60 45-100 100-100 40 0 70 22 86 54 16-32 46-54 86-54 55 0 100 40 100 100 0 70-50 150-186 250z" fill="#fff0f6"/></svg>`;

const alvos = [
  { svg: 'icone.svg', saida: 'icone-192.png', t: 192, margem: false },
  { svg: 'icone.svg', saida: 'icone-512.png', t: 512, margem: false },
  { svg: 'icone-maskable.svg', saida: 'icone-maskable-512.png', t: 512, margem: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const a of alvos) {
    const caminho = join(dir, a.svg);
    let svg;
    if (existsSync(caminho)) svg = readFileSync(caminho, 'utf8');
    else { svg = provisorio(a.margem); console.log(`AVISO: ${a.svg} não existe; usando ícone provisório`); }
    await page.setViewportSize({ width: a.t, height: a.t });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${a.t}px;height:${a.t}px}</style>${svg}`);
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: a.t, height: a.t } });
    writeFileSync(join(dir, a.saida), png);
    console.log('gerado', a.saida);
  }
} finally {
  await browser.close();
}
