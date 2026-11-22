// Service worker da Trilha dos Sons. A lista de arquivos e o nome do cache sao
// gerados por `node ferramentas/gerar-sw.mjs`: nao edite entre os marcadores.
const CACHE = 'trilha-sons-614ba7cdda'; // CACHE-AUTO
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
  "assets/audio/gerado/som_j.mp3",
  "assets/audio/gerado/som_l.mp3",
  "assets/audio/gerado/som_m.mp3",
  "assets/audio/gerado/som_n.mp3",
  "assets/audio/gerado/som_o.mp3",
  "assets/audio/gerado/som_p.mp3",
  "assets/audio/gerado/som_r.mp3",
  "assets/audio/gerado/som_s.mp3",
  "assets/audio/gerado/som_t.mp3",
  "assets/audio/gerado/som_u.mp3",
  "assets/audio/gerado/som_v.mp3",
  "assets/audio/gerado/som_z.mp3",
  "assets/audio/voz/frase_acerto_1.mp3",
  "assets/audio/voz/frase_acerto_2.mp3",
  "assets/audio/voz/frase_acerto_3.mp3",
  "assets/audio/voz/frase_acerto_4.mp3",
  "assets/audio/voz/frase_apresentar_letra.mp3",
  "assets/audio/voz/frase_caca_instrucao.mp3",
  "assets/audio/voz/frase_caca_pergunta.mp3",
  "assets/audio/voz/frase_despedida.mp3",
  "assets/audio/voz/frase_escute_instrucao.mp3",
  "assets/audio/voz/frase_escute_pergunta.mp3",
  "assets/audio/voz/frase_ouca_nome_som.mp3",
  "assets/audio/voz/frase_quase.mp3",
  "assets/audio/voz/frase_rodada_fim.mp3",
  "assets/audio/voz/frase_trace_instrucao.mp3",
  "assets/audio/voz/nome_a.mp3",
  "assets/audio/voz/nome_b.mp3",
  "assets/audio/voz/nome_c.mp3",
  "assets/audio/voz/nome_d.mp3",
  "assets/audio/voz/nome_e.mp3",
  "assets/audio/voz/nome_f.mp3",
  "assets/audio/voz/nome_g.mp3",
  "assets/audio/voz/nome_i.mp3",
  "assets/audio/voz/nome_l.mp3",
  "assets/audio/voz/nome_m.mp3",
  "assets/audio/voz/nome_n.mp3",
  "assets/audio/voz/nome_o.mp3",
  "assets/audio/voz/nome_p.mp3",
  "assets/audio/voz/nome_r.mp3",
  "assets/audio/voz/nome_s.mp3",
  "assets/audio/voz/nome_t.mp3",
  "assets/audio/voz/nome_u.mp3",
  "assets/audio/voz/nome_v.mp3",
  "assets/audio/voz/pal_bola.mp3",
  "assets/audio/voz/pal_bolo.mp3",
  "assets/audio/voz/pal_copo.mp3",
  "assets/audio/voz/pal_dado.mp3",
  "assets/audio/voz/pal_dedo.mp3",
  "assets/audio/voz/pal_ema.mp3",
  "assets/audio/voz/pal_fada.mp3",
  "assets/audio/voz/pal_foca.mp3",
  "assets/audio/voz/pal_gato.mp3",
  "assets/audio/voz/pal_gota.mp3",
  "assets/audio/voz/pal_ioio.mp3",
  "assets/audio/voz/pal_lobo.mp3",
  "assets/audio/voz/pal_lua.mp3",
  "assets/audio/voz/pal_mala.mp3",
  "assets/audio/voz/pal_mapa.mp3",
  "assets/audio/voz/pal_ovo.mp3",
  "assets/audio/voz/pal_pato.mp3",
  "assets/audio/voz/pal_pe.mp3",
  "assets/audio/voz/pal_pipa.mp3",
  "assets/audio/voz/pal_rato.mp3",
  "assets/audio/voz/pal_roda.mp3",
  "assets/audio/voz/pal_sapo.mp3",
  "assets/audio/voz/pal_suco.mp3",
  "assets/audio/voz/pal_tatu.mp3",
  "assets/audio/voz/pal_urso.mp3",
  "assets/audio/voz/pal_uva.mp3",
  "assets/audio/voz/pal_vaca.mp3",
  "assets/audio/voz/pal_vaso.mp3",
  "assets/audio/voz/pal_vela.mp3",
  "assets/audio/voz/sil_ba.mp3",
  "assets/audio/voz/sil_be.mp3",
  "assets/audio/voz/sil_bi.mp3",
  "assets/audio/voz/sil_bo.mp3",
  "assets/audio/voz/sil_bu.mp3",
  "assets/audio/voz/sil_ca.mp3",
  "assets/audio/voz/sil_co.mp3",
  "assets/audio/voz/sil_cu.mp3",
  "assets/audio/voz/sil_da.mp3",
  "assets/audio/voz/sil_de.mp3",
  "assets/audio/voz/sil_do.mp3",
  "assets/audio/voz/sil_du.mp3",
  "assets/audio/voz/sil_fa.mp3",
  "assets/audio/voz/sil_fe.mp3",
  "assets/audio/voz/sil_fi.mp3",
  "assets/audio/voz/sil_fo.mp3",
  "assets/audio/voz/sil_fu.mp3",
  "assets/audio/voz/sil_ga.mp3",
  "assets/audio/voz/sil_go.mp3",
  "assets/audio/voz/sil_gu.mp3",
  "assets/audio/voz/sil_la.mp3",
  "assets/audio/voz/sil_le.mp3",
  "assets/audio/voz/sil_li.mp3",
  "assets/audio/voz/sil_lo.mp3",
  "assets/audio/voz/sil_lu.mp3",
  "assets/audio/voz/sil_ma.mp3",
  "assets/audio/voz/sil_me.mp3",
  "assets/audio/voz/sil_mi.mp3",
  "assets/audio/voz/sil_mo.mp3",
  "assets/audio/voz/sil_mu.mp3",
  "assets/audio/voz/sil_na.mp3",
  "assets/audio/voz/sil_ne.mp3",
  "assets/audio/voz/sil_ni.mp3",
  "assets/audio/voz/sil_no.mp3",
  "assets/audio/voz/sil_nu.mp3",
  "assets/audio/voz/sil_pa.mp3",
  "assets/audio/voz/sil_pe.mp3",
  "assets/audio/voz/sil_pi.mp3",
  "assets/audio/voz/sil_po.mp3",
  "assets/audio/voz/sil_pu.mp3",
  "assets/audio/voz/sil_ra.mp3",
  "assets/audio/voz/sil_re.mp3",
  "assets/audio/voz/sil_ri.mp3",
  "assets/audio/voz/sil_ro.mp3",
  "assets/audio/voz/sil_ru.mp3",
  "assets/audio/voz/sil_sa.mp3",
  "assets/audio/voz/sil_se.mp3",
  "assets/audio/voz/sil_si.mp3",
  "assets/audio/voz/sil_so.mp3",
  "assets/audio/voz/sil_su.mp3",
  "assets/audio/voz/sil_ta.mp3",
  "assets/audio/voz/sil_te.mp3",
  "assets/audio/voz/sil_to.mp3",
  "assets/audio/voz/sil_tu.mp3",
  "assets/audio/voz/sil_va.mp3",
  "assets/audio/voz/sil_ve.mp3",
  "assets/audio/voz/sil_vi.mp3",
  "assets/audio/voz/sil_vo.mp3",
  "assets/audio/voz/sil_vu.mp3",
  "assets/audio/voz/som_a.mp3",
  "assets/audio/voz/som_b.mp3",
  "assets/audio/voz/som_c.mp3",
  "assets/audio/voz/som_d.mp3",
  "assets/audio/voz/som_f.mp3",
  "assets/audio/voz/som_g.mp3",
  "assets/audio/voz/som_i.mp3",
  "assets/audio/voz/som_l.mp3",
  "assets/audio/voz/som_m.mp3",
  "assets/audio/voz/som_n.mp3",
  "assets/audio/voz/som_p.mp3",
  "assets/audio/voz/som_r.mp3",
  "assets/audio/voz/som_s.mp3",
  "assets/audio/voz/som_t.mp3",
  "assets/audio/voz/som_u.mp3",
  "assets/audio/voz/som_v.mp3",
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
  "assets/svg/figuras/jacare.svg",
  "assets/svg/figuras/janela.svg",
  "assets/svg/figuras/joaninha.svg",
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
  "assets/svg/figuras/rato.svg",
  "assets/svg/figuras/roda.svg",
  "assets/svg/figuras/rosa.svg",
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
  "assets/svg/figuras/zebra.svg",
  "assets/svg/figuras/ziper.svg",
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
  "assets/svg/ui/jogo-casinhas.svg",
  "assets/svg/ui/jogo-escute.svg",
  "assets/svg/ui/jogo-junte.svg",
  "assets/svg/ui/jogo-trace.svg",
  "assets/svg/ui/jogo-trilha.svg",
  "assets/svg/ui/nuvem.svg",
  "assets/svg/ui/ouvir.svg",
  "assets/svg/ui/pais.svg",
  "assets/svg/ui/parada.svg",
  "css/casinhas.css",
  "css/estilo.css",
  "css/jogos.css",
  "data/curriculo.json",
  "data/frases.json",
  "data/tracados.json",
  "index.html",
  "js/app.js",
  "js/armazenamento.js",
  "js/audio.js",
  "js/gravacoes.js",
  "js/jogos/caca.js",
  "js/jogos/casinhas.js",
  "js/jogos/comum.js",
  "js/jogos/escute.js",
  "js/jogos/junte.js",
  "js/jogos/trace.js",
  "js/legenda.js",
  "js/progresso.js",
  "js/telas/ajuda.js",
  "js/telas/colecao.js",
  "js/telas/despedida.js",
  "js/telas/gravar.js",
  "js/telas/guia.js",
  "js/telas/inicio.js",
  "js/telas/jogo.js",
  "js/telas/licao.js",
  "js/telas/menu.js",
  "js/telas/pais-atualizar.js",
  "js/telas/pais-backup.js",
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
    // Sem skipWaiting aqui: a versao nova fica esperando ate a adulta tocar em "Atualizar" (Area dos pais).
  })());
});

self.addEventListener('message', (evento) => {
  const d = evento.data || {};
  if (d.tipo === 'PULAR_ESPERA') {
    self.skipWaiting();
  } else if (d.tipo === 'VERSAO' && evento.ports && evento.ports[0]) {
    evento.ports[0].postMessage({ versao: CACHE });
  }
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
