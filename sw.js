// Service worker da Trilha dos Sons. A lista de arquivos e o nome do cache sao
// gerados por `node ferramentas/gerar-sw.mjs`: nao edite entre os marcadores.
const CACHE = 'trilha-sons-980032f750'; // CACHE-AUTO
const ARQUIVOS = [
// <ARQUIVOS>
  "./",
  "assets/audio/gerado/indice.json",
  "assets/audio/gerado/som_a.mp3",
  "assets/audio/gerado/som_b.mp3",
  "assets/audio/gerado/som_c.mp3",
  "assets/audio/gerado/som_d.mp3",
  "assets/audio/gerado/som_e.mp3",
  "assets/audio/gerado/som_f.mp3",
  "assets/audio/gerado/som_g.mp3",
  "assets/audio/gerado/som_i.mp3",
  "assets/audio/gerado/som_l.mp3",
  "assets/audio/gerado/som_m.mp3",
  "assets/audio/gerado/som_n.mp3",
  "assets/audio/gerado/som_o.mp3",
  "assets/audio/gerado/som_p.mp3",
  "assets/audio/gerado/som_s.mp3",
  "assets/audio/gerado/som_t.mp3",
  "assets/audio/gerado/som_u.mp3",
  "assets/audio/gerado/som_v.mp3",
  "assets/fontes/LICENSE-OFL.txt",
  "assets/fontes/andika-latin-400-normal.woff2",
  "assets/fontes/andika-latin-700-normal.woff2",
  "assets/icones/icone-192.png",
  "assets/icones/icone-512.png",
  "assets/icones/icone-maskable-512.png",
  "assets/icones/icone-maskable.svg",
  "assets/icones/icone.svg",
  "assets/svg/cenarios/ceu.svg",
  "assets/svg/cenarios/mar.svg",
  "assets/svg/cenarios/trilha.svg",
  "assets/svg/figuras/abelha.svg",
  "assets/svg/figuras/anel.svg",
  "assets/svg/figuras/aviao.svg",
  "assets/svg/figuras/bola.svg",
  "assets/svg/figuras/bolo.svg",
  "assets/svg/figuras/bota.svg",
  "assets/svg/figuras/cama.svg",
  "assets/svg/figuras/copo.svg",
  "assets/svg/figuras/cubo.svg",
  "assets/svg/figuras/dado.svg",
  "assets/svg/figuras/dedo.svg",
  "assets/svg/figuras/dente.svg",
  "assets/svg/figuras/elefante.svg",
  "assets/svg/figuras/ema.svg",
  "assets/svg/figuras/ervilha.svg",
  "assets/svg/figuras/fada.svg",
  "assets/svg/figuras/fita.svg",
  "assets/svg/figuras/foca.svg",
  "assets/svg/figuras/galo.svg",
  "assets/svg/figuras/gato.svg",
  "assets/svg/figuras/gota.svg",
  "assets/svg/figuras/iglu.svg",
  "assets/svg/figuras/ilha.svg",
  "assets/svg/figuras/ioio.svg",
  "assets/svg/figuras/lobo.svg",
  "assets/svg/figuras/lua.svg",
  "assets/svg/figuras/lupa.svg",
  "assets/svg/figuras/mala.svg",
  "assets/svg/figuras/mapa.svg",
  "assets/svg/figuras/moto.svg",
  "assets/svg/figuras/nariz.svg",
  "assets/svg/figuras/navio.svg",
  "assets/svg/figuras/nuvem.svg",
  "assets/svg/figuras/olho.svg",
  "assets/svg/figuras/ovelha.svg",
  "assets/svg/figuras/ovo.svg",
  "assets/svg/figuras/pato.svg",
  "assets/svg/figuras/pe.svg",
  "assets/svg/figuras/pipa.svg",
  "assets/svg/figuras/sapo.svg",
  "assets/svg/figuras/sino.svg",
  "assets/svg/figuras/suco.svg",
  "assets/svg/figuras/tapete.svg",
  "assets/svg/figuras/tatu.svg",
  "assets/svg/figuras/tomate.svg",
  "assets/svg/figuras/unicornio.svg",
  "assets/svg/figuras/urso.svg",
  "assets/svg/figuras/uva.svg",
  "assets/svg/figuras/vaca.svg",
  "assets/svg/figuras/vaso.svg",
  "assets/svg/figuras/vela.svg",
  "assets/svg/personagens/lumi-festa.svg",
  "assets/svg/personagens/lumi.svg",
  "assets/svg/personagens/marola-festa.svg",
  "assets/svg/personagens/marola-nadando.svg",
  "assets/svg/personagens/marola.svg",
  "assets/svg/recompensas/chifre.svg",
  "assets/svg/recompensas/concha.svg",
  "assets/svg/recompensas/estrela.svg",
  "assets/svg/ui/casa.svg",
  "assets/svg/ui/colecao.svg",
  "assets/svg/ui/comecar.svg",
  "assets/svg/ui/continuar.svg",
  "assets/svg/ui/jogo-caca.svg",
  "assets/svg/ui/jogo-escute.svg",
  "assets/svg/ui/jogo-junte.svg",
  "assets/svg/ui/jogo-trace.svg",
  "assets/svg/ui/jogo-trilha.svg",
  "assets/svg/ui/nuvem.svg",
  "assets/svg/ui/ouvir.svg",
  "assets/svg/ui/pais.svg",
  "assets/svg/ui/parada.svg",
  "css/estilo.css",
  "css/jogos.css",
  "data/curriculo.json",
  "data/frases.json",
  "data/tracados.json",
  "index.html",
  "js/app.js",
  "js/armazenamento.js",
  "js/audio.js",
  "js/jogos/caca.js",
  "js/jogos/comum.js",
  "js/jogos/escute.js",
  "js/jogos/junte.js",
  "js/jogos/trace.js",
  "js/progresso.js",
  "js/telas/colecao.js",
  "js/telas/despedida.js",
  "js/telas/guia.js",
  "js/telas/inicio.js",
  "js/telas/jogo.js",
  "js/telas/licao.js",
  "js/telas/menu.js",
  "js/telas/pais.js",
  "js/telas/recompensa.js",
  "js/telas/trilha.js",
  "js/ui.js",
  "manifest.json"
// </ARQUIVOS>
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ARQUIVOS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.info('[sw] nao foi possivel guardar', url);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== CACHE && n.startsWith('trilha-sons-')).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  evento.respondWith(responder(evento));
});

const ehGravacao = (u) => u.pathname.includes('/assets/audio/gravacoes/') && /\.(mp3|m4a)$/.test(u.pathname);
const ehDados = (u) => /\/data\/[^/]+\.json$/.test(u.pathname);
const vazio204 = () => new Response(null, { status: 204 });

// Guarda no cache a versao completa (200) de um arquivo; uteis para requisicoes Range de <audio>.
async function guardarCompleto(cache, url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.status === 200) await cache.put(url, r);
  } catch (e) { /* offline: ignora */ }
}

async function responder(evento) {
  const req = evento.request;
  const url = new URL(req.url);
  const cache = await caches.open(CACHE);

  if (ehGravacao(url)) {
    // Rede primeiro; inexistente vira 204 (sem 404 no console); offline usa o cache.
    let rede = null;
    try { rede = await fetch(req, { cache: 'no-cache' }); } catch (e) { rede = null; }
    if (rede && (rede.status === 200 || rede.status === 206)) {
      evento.waitUntil(guardarCompleto(cache, req.url));
      return rede;
    }
    const guardado = await cache.match(req.url, { ignoreMethod: true });
    if (guardado) return req.method === 'HEAD' ? new Response(null, { status: 200, headers: guardado.headers }) : guardado;
    return vazio204();
  }

  if (ehDados(url) && req.method === 'GET') {
    try {
      const rede = await fetch(req, { cache: 'no-cache' });
      if (rede.ok) { cache.put(req, rede.clone()).catch(() => {}); return rede; }
    } catch (e) { /* offline */ }
    const guardado = await cache.match(req);
    return guardado || new Response('', { status: 404, statusText: 'offline' });
  }

  if (req.method === 'HEAD') {
    const guardado = await cache.match(req, { ignoreMethod: true });
    if (guardado) return new Response(null, { status: 200, headers: guardado.headers });
    try {
      return await fetch(req);
    } catch (e) {
      return new Response(null, { status: 404 });
    }
  }

  const guardado = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (guardado) return guardado;

  try {
    const rede = await fetch(req);
    if (rede && rede.ok && rede.type === 'basic') {
      cache.put(req, rede.clone()).catch(() => {});
    }
    return rede;
  } catch (e) {
    if (req.mode === 'navigate') {
      const inicio = (await cache.match('index.html')) || (await cache.match('./'));
      if (inicio) return inicio;
    }
    return new Response('', { status: 404, statusText: 'offline' });
  }
}
