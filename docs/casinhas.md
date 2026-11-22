# Casinhas dos Sons (jogo 5)

Arquivos: `js/jogos/casinhas.js`, `css/casinhas.css`, `assets/svg/ui/jogo-casinhas.svg`, `tests/l-casinhas.test.mjs`. Entra no menu de brincadeiras (`js/telas/menu.js`, lista `JOGOS`) com o rótulo "Casinhas dos Sons". Contrato da seção 6 do PLANO: `{ id: 'casinhas', icone, disponivel, iniciar }`; no fim da rodada chama `ctx.aoTerminar({ jogo: 'casinhas', itens })` (via `terminarRodada` de `comum.js`).

## Mecânica

Tela única: topo (rótulo "Fase" + bolinhas 1, 2, 3 e "Ouvir de novo"), cinco pontinhos de progresso, quadro da figura, duas casinhas (telhado rosa para a consoante, lilás para a vogal) e uma bandeja de peças. A criança arrasta uma consoante para a primeira casinha e uma vogal para a segunda; o jogo fala a sílaba formada, mostra a figura de uma palavra com essa sílaba (prefere a que começa com ela) e fala a palavra. Sílaba sem palavra com figura no currículo (ex.: JU, ZU) só mostra a sílaba em letras grandes.

- Tocar numa peça fala o SOM (`som:x`), nunca o nome. Na fase 3 a peça é uma sílaba e toca `sil:xx`.
- Fase 1: consoantes longas (as de `continuo: true`: F L M N R S V Z J) com a vogal A. Bandeja: 3 a 4 consoantes longas e só o A.
- Fase 2: todas as vogais e também as curtas (B C D G P T), alternando longas e curtas. Bandeja: 3 a 4 consoantes e de 2 a 5 vogais (cresce de 2 até 5 ao longo da rodada; em telas estreitas o teto é o que cabe numa fileira, 4 em 360 e 412 px de largura, 5 em tablet). O Q não entra. CE, CI, GE, GI não existem no currículo e, por isso, não aparecem.
- Fase 3: palavras com `juntar: true` e sílabas preenchidas. Aparece a figura (visível desde o início), as casinhas viram uma por sílaba e a criança arrasta as sílabas, com 2 distratores. Cada sílaba é falada ao soltar; no fim, `sil` da última sílaba + `pal:x`. Palavras de letras já liberadas têm preferência.
- Alvo falado: fases 1 e 2 `['frase:casinhas_monte','sil:xx']`; fase 3 `['frase:casinhas_palavra','pal:x']`. Na primeira rodada vem antes `frase:casinhas_instrucao`. "Ouvir de novo" repete só o alvo.

## Erro e acerto

- Erro (peça errada na casinha): a peça volta deslizando para o lugar, o jogo fala o alvo de novo; depois de 2 erros no mesmo item a peça certa (da primeira casinha vazia) brilha. Peça do tipo errado na casinha (consoante na casa da vogal) volta e repete o alvo, mas não conta como erro. Sem vermelho, sem som de falha, sem tempo limite.
- Acerto: casinhas pulam, `efeito('brilho')`, cintilância, a amiga guia comemora (`celebrarGuia`), sílaba, figura e palavra.
- Registro: `ctx.registrar({ letra: <consoante>, acertouPrimeira, jogo: 'casinhas' })`, só se a consoante estiver em `ctx.letrasLiberadas`. Na fase 3 a letra é a inicial da palavra.

## Progresso e fases

`localStorage` chave `trilhaSons.casinhas` (via `js/armazenamento.js`): `{ fase, acertos: { 1, 2, 3 } }`. Só no navegador, fora do `trilhaSons.v1`. Avança de fase com 8 acertos de primeira na fase atual (acumulados entre rodadas); o avanço vale a partir do próximo item, com a bolinha da nova fase pulsando. As três bolinhas (64 px, com o número para a adulta) escolhem a fase a qualquer momento; as fases não alcançadas ficam disponíveis, só sem o destaque da fase atual. Trocar de fase reinicia os itens da rodada em andamento.

## Entrada

- Pointer events com `setPointerCapture`; `touch-action: none` em toda a área de jogo; `pointercancel` e `lostpointercapture` devolvem a peça. Limite de 10 px para começar a arrastar; abaixo disso é um toque.
- Tocar-para-colocar: toque na peça (ela fica selecionada e as casinhas que a aceitam convidam) e depois na casinha. Teclado: Enter/Espaço seleciona a peça e coloca na casinha.
- Peças >= 72 px (`--peca`, 72 a 104 px conforme a tela); casinhas e bolinhas >= 64 px; letras em MAIÚSCULA com `var(--fonte)`.

## Layout

Coluna única sem rolagem (conferido em 360x800, 360x640, 412x915, 768x1024 e 1024x768); em telas largas o conteúdo fica centrado numa coluna de 640 px. Margem de 16 px. Em telas baixas (<= 700 px) o telhado e os espaços encolhem.

## Observações para a integração

- O menu passa a ter 5 jogos; testes antigos que contam 4 botões `.btn-jogo` precisam ser ajustados (ver relatório do subagente L).
- `sw.js` / lista de cache: incluir `css/casinhas.css`, `js/jogos/casinhas.js` e `assets/svg/ui/jogo-casinhas.svg` (o líder roda `gerar-sw.mjs`).
