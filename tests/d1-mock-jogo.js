// Jogo falso para testar a casca: registra o ctx, chama registrar e termina logo.
window.__jogos = window.__jogos || [];
export default {
  id: 'mock',
  icone: 'assets/svg/ui/jogo-escute.svg',
  disponivel() { return true; },
  iniciar(raiz, ctx) {
    window.__jogos.push({ letras: ctx.letras, letraFoco: ctx.letraFoco, guia: ctx.guia, liberadas: ctx.letrasLiberadas, estado: ctx.estadoLetra(ctx.letras[0]) });
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Terminar jogo falso');
    b.style.cssText = 'width:96px;height:96px;margin:auto;align-self:center';
    b.textContent = 'ok';
    raiz.style.display = 'flex';
    raiz.append(b);
    let timer;
    const fim = () => {
      ctx.registrar({ letra: ctx.letras[0], acertouPrimeira: true, jogo: this.id });
      ctx.aoTerminar({ jogo: this.id, itens: 1 });
    };
    b.addEventListener('click', fim);
    if (!window.__jogoManual) timer = setTimeout(fim, 40);
    return { destruir() { clearTimeout(timer); window.__destruidos = (window.__destruidos || 0) + 1; } };
  },
};
