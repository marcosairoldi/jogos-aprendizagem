# Plano e contrato técnico: Trilha dos Sons

Jogo web (PWA) de método fônico em português do Brasil para crianças de 5 anos em pré-escola.
Uma adulta acompanha. Toda instrução é falada; nada exige leitura.

## 1. Estrutura de pastas e donos

| Caminho | Dono | Conteúdo |
|---|---|---|
| `index.html`, `css/estilo.css`, `js/app.js`, `js/ui.js`, `js/armazenamento.js`, `js/progresso.js`, `js/telas/*.js` | D1 | casca do app, rotas, tela inicial, escolha do guia, Trilha Encantada, menu, recompensas, despedida, área dos pais |
| `js/jogos/*.js`, `css/jogos.css`, `data/tracados.json` | D2 | Escute e Toque, Caça-Som, Junte os Sons, Trace a Letra |
| `data/curriculo.json`, `docs/pesquisa.md` | A | pesquisa e currículo |
| `assets/svg/personagens`, `cenarios`, `recompensas`, `ui`, `assets/icones/*.svg` | B1 | personagens, cenários, recompensas, ícones |
| `assets/svg/figuras/*.svg` | B2 (vogais, M, P, B, T) e B3 (F, V, S, L, N, D, C, G) | figuras das palavras |
| `js/audio.js`, `assets/audio/gerado/`, `assets/audio/LISTA.md`, `manifest.json`, `sw.js`, `ferramentas/*` | C | áudio, PWA, offline, scripts |
| `data/frases.json` | líder | frases faladas (chaves fixas) |
| `tests/` | E | QA e testes |
| `README.md`, `docs/PLANO.md` | líder | |

Ninguém edita arquivo de outro dono. Ninguém faz commit; o líder integra e commita.

## 2. Convenções

- JS puro, módulos ES (`<script type="module">`), sem frameworks, sem dependências em tempo de execução.
- Todos os caminhos são relativos (`assets/...`, nunca `/assets/...`), para funcionar em `usuario.github.io/repo/`.
- Ids em minúsculas ASCII sem acento: letra `m`, sílaba `ma`, palavra `aviao`.
- Ids de áudio: `som_<letra>`, `sil_<silaba>`, `pal_<palavra>`, `frase_<chave>`.
- Letras exibidas em MAIÚSCULA, fonte Andika (SIL OFL, feita para quem está aprendendo a ler), embutida em `assets/fontes/`.
- Paleta: rosa dominante. Tokens CSS em `css/estilo.css` (`--rosa-forte #d6336c`, `--rosa #f783ac`, `--rosa-claro #ffdeeb`, `--lilas #b197fc`, `--agua #66d9e8`, `--dourado #ffd43b`, `--texto #5c2a3e`, `--fundo #fff0f6`).
- Personagens originais: unicórnio **Lumi** e sereia **Marola**.
- Nenhum nome real de pessoa em arquivo algum. Nome da criança só no `localStorage`; sem nome, o jogo diz "princesa".

## 3. Regras pedagógicas que o código obedece

1. O jogo nunca fala o NOME de uma consoante ("eme", "pê"). Só o SOM, vindo de arquivo de áudio. Nenhuma frase interpola a letra como texto para TTS.
2. Erro: sem som de falha, sem vermelho, sem pontos perdidos. A opção errada balança de leve e some; o som-alvo é repetido com carinho; as opções diminuem até sobrar a certa.
3. Sem tempo limite. Toda tela fala sua instrução ao entrar e tem botão grande de "ouvir de novo" (ícone de orelha/alto-falante).
4. Sessão de cerca de 8 minutos (`regras.minutosSessao`), com despedida carinhosa; a adulta pode continuar.
5. Avanço por domínio, com revisão espaçada das letras antigas; nada de bloquear a diversão (todos os jogos ficam disponíveis com as letras já liberadas).

## 4. Esquema de `data/curriculo.json`

```json
{
  "versao": 1,
  "regras": {
    "itensPorRodada": 5, "janelaDominio": 6, "acertosParaDominar": 5,
    "jogosDistintosParaDominar": 2, "sessoesParaDominar": 1,
    "proporcaoRevisao": 0.3, "minutosSessao": 8, "opcoesMin": 2, "opcoesMax": 4
  },
  "ordem": ["a","e","i","o","u","m","p","b","t","f","v","s","l","n","d","c","g"],
  "etapas": [{ "id": "vogais", "letras": ["a","e","i","o","u"] }],
  "letras": {
    "m": {
      "maiuscula": "M", "tipo": "consoante", "fonema": "/m/", "continuo": true,
      "audio": "som_m", "tts": "mmmmm", "palavras": ["mapa","moto","mala"],
      "dica": "Para a adulta: boca fechada, som contínuo, sem dizer 'mê'."
    }
  },
  "silabas": {
    "ma": { "texto": "MA", "letras": ["m","a"], "audio": "sil_ma", "tts": "má" }
  },
  "palavras": {
    "mapa": { "texto": "MAPA", "silabas": ["ma","pa"], "inicial": "m",
              "figura": "assets/svg/figuras/mapa.svg", "audio": "pal_mapa",
              "tts": "mapa", "juntar": true }
  }
}
```

- `tts` de consoante oclusiva (p, b, t, d, c, g) é `null`: TTS não consegue fazer esse som puro. Nesse caso o áudio usa o arquivo gerado; se faltar, fala a palavra-âncora.
- `juntar: true` só para palavras regulares CV.CV usadas em Junte os Sons.
- Pares de vogais (ex.: `ai`, `oi`, `eu`) podem entrar em `silabas` para Junte os Sons na etapa das vogais.

### Figuras (ids fixos; arquivo `assets/svg/figuras/<id>.svg`, viewBox `0 0 200 200`)

A: abelha, anel, aviao · E: elefante, ervilha, ema · I: ilha, iglu, ioio · O: ovo, olho, ovelha · U: uva, urso, unicornio · M: mapa, moto, mala · P: pato, pipa, pe · B: bola, bolo, bota · T: tatu, tomate, tapete · F: foca, fada, fita · V: vaca, vela, vaso · S: sapo, sino, suco · L: lua, lobo, lupa · N: navio, nuvem, nariz · D: dado, dedo, dente · C: copo, cubo, cama · G: gato, galo, gota · J: janela, jacare, joaninha · Z: zebra, ziper · R: rato, roda, rosa

## 5. API de áudio (`js/audio.js`)

```js
import * as audio from './audio.js';
audio.configurar({ curriculo, frases, obterNome })  // obterNome(): string ou ''
await audio.desbloquear()           // chamar dentro do toque no botão "Começar"
await audio.falar(['frase:escute_instrucao', 'pausa:300', 'som:m'])
await audio.falar([{ frase: 'acerto_2' }])  // {nome} é preenchido sozinho
audio.efeito('brilho')              // 'brilho' | 'pop' | 'tchan' | 'bolha' | 'passo' (sintetizados, nunca som de erro)
audio.parar()
audio.estado()                      // { desbloqueado, temVozPtBr }
```

- Itens de `falar`: `frase:<chave>`, `som:<letra>`, `sil:<silaba>`, `pal:<palavra>`, `pausa:<ms>`, `efeito:<nome>`, ou `{ frase, vars }`.
- Uma nova chamada a `falar` cancela a anterior. A Promise sempre resolve (nunca rejeita): `{ cancelado: boolean }`.
- Busca de arquivo para um id: `assets/audio/gravacoes/<id>.mp3`, depois `.m4a` (gravações da adulta), depois `assets/audio/gerado/<id>.<ext>` (sons de letra gerados), depois `speechSynthesis` pt-BR com `tts` do currículo ou texto da frase, com `console.info('[audio] usando voz do aparelho para', id)`.
- O módulo pausa tudo sozinho quando a página vai para segundo plano (`visibilitychange`).

## 6. Contrato dos jogos (`js/jogos/<id>.js`)

```js
export default {
  id: 'escute',             // 'escute' | 'caca' | 'junte' | 'trace'
  icone: 'assets/svg/ui/jogo-escute.svg',
  disponivel(letrasLiberadas, curriculo) { return true },
  iniciar(raiz, ctx) { /* monta a tela dentro de raiz */ return { destruir() {} } }
}
```

`ctx` entregue pela casca:

```js
{
  curriculo, audio, guia,          // guia: 'lumi' | 'marola'
  letras,                           // letras da rodada (foco + revisão), ex.: ['m','a','o']
  letraFoco,                        // letra nova sendo aprendida, ou null
  letrasLiberadas,                  // todas as já liberadas
  estadoLetra(letra),               // 'nova' | 'pratica' | 'dominada'
  modo,                             // opcional: 'livre' só quando o Trace abre pelo menu de brincadeiras (26 letras); ausente na lição
  registrar({ letra, acertouPrimeira, jogo }),
  aoTerminar({ jogo, itens })       // fim da rodada; a casca mostra recompensa
}
```

A raiz ocupa a tela toda abaixo de uma barra superior da casca (botão casa e guia). O jogo não usa rolagem.

## 7. Progresso (`js/progresso.js`, chave `localStorage` `trilhaSons.v1`)

Guarda: nome, guia, letras liberadas, histórico curto por letra (`[{ jogo, ok, sessao, t }]`), recompensas (`{ estrela, concha, chifre }`), tempo total de uso, número de sessões. Se o armazenamento falhar, usa memória e o jogo segue.

## 8. Ordem de trabalho

1. Paralelo: A, B1, B2, B3, C, D1, D2.
2. Líder integra, gera lista de cache e LISTA.md, roda o jogo.
3. E faz QA em 360x800 e offline; líder corrige e commita.

## 9. Decisões tomadas na integração

- Sons de letra de reserva gerados com espeak-ng (`ferramentas/gerar-sons.sh`), robóticos mas sem vogal agregada; a gravação da adulta tem prioridade.
- Gravações novas em `assets/audio/gravacoes/` são encontradas sem rodar script: o service worker responde 204 quando o arquivo não existe (console limpo) e guarda o que existir para uso offline.
- `data/*.json` e gravações usam rede primeiro e cache como reserva, para que edições feitas no GitHub cheguem ao celular; o resto é cache primeiro.
- Domínio de uma letra: 5 acertos de primeira nas últimas 6 tentativas, em 2 jogos diferentes (`sessoesParaDominar` = 1: basta uma lição). A próxima letra é liberada ao fim da lição em que houve domínio; sem domínio, a letra segue em prática e a lição recomeça no próximo toque, sem mensagem negativa. A revisão espaçada vem da mistura de letras antigas nas rodadas; a adulta pode liberar a próxima na área dos pais.
- Junte os Sons não aparece na letra A (não há sílaba com uma letra só); a partir da E usa pares de vogais (AI, EI...) e, com consoantes, sílabas e palavras CV.CV.
- Sílabas com E (PE, BE, TE...) soam igual ao nome da consoante; isso é correto para a sílaba e não é usado como som de letra.
- Gravação da voz dentro do app (Área dos pais > Gravar minha voz): `js/gravacoes.js` guarda blobs no IndexedDB (`trilhaSons-voz`), só no aparelho. `js/audio.js` dá a elas prioridade máxima na resolução de um id (blob: URL), e `audio.gravacoesMudaram()` limpa os caches após salvar/apagar. A tela `js/telas/gravar.js` recorta o silêncio, normaliza, reamostra para 22050 Hz e guarda WAV mono 16 bits. "Reiniciar progresso" não apaga gravações. Backup e sincronização: ver o item da Área dos pais em abas abaixo (JSON baixado pela adulta); apagar os dados do navegador apaga as gravações.
- Trace livre (menu de brincadeiras, `ctx.modo === 'livre'`): grade com as 26 letras A a Z (cartões "Aa"), inclusive as ainda não liberadas e as fora do currículo (H, K, Q, W, X, Y). Tocar uma letra com som no currículo toca `som:x`; letras sem som (h k q w x y) só recebem a frase de elogio, nunca nome nem voz sintética. 3 letras traçadas encerram a rodada; só letras de `letrasLiberadas` são registradas. Trilha, lição e outros jogos seguem só com o currículo.
- Trace (lição e livre): traça-se o par maiúscula + minúscula lado a lado (viewBox 0 0 200 100; a minúscula é a do `data/tracados.json` deslocada 100 unidades). Formato: `letras.x.tracos` (maiúscula, 15..85) e `letras.x.minuscula.tracos` (altura-x 45, base 85, ascendente 15, descendente 97), gerado por `tests/d2-gerar-tracados.mjs`. Minúsculas no estilo da Andika (a e g de um andar).
- UX para a adulta (subagente I): a criança continua só ouvindo; o texto escrito é para a adulta e vem sempre marcado com `data-i` (`rotulo`, `legenda`, `indicador`), o que permite aos testes separar o conteúdo da criança (letras, sílabas, palavras) do texto de apoio. `tests/e-lib.mjs` agora devolve `textos` (conteúdo) e `textosAdulta`; a checagem "sem texto de instrução" virou "texto visível só como conteúdo ou rótulo/legenda para a adulta", e cada tela segue exigindo áudio ao entrar e "Ouvir de novo".
- Botões de ícone (`botaoIcone` em `js/ui.js`): o botão inteiro (círculo + rótulo de 13 a 15 px embaixo) é o alvo de toque; `aria-label` mantido, rótulo visível curto (Voltar, Início, Ouvir de novo...). `--barra` passou a 92 px; os discos da barra têm 56 px (o alvo, com rótulo, passa de 64 px).
- Legenda: `js/audio.js` emite `trilha:fala` (`{tipo, texto}` com `{nome}` preenchido; `{fim:true}` ao terminar ou parar). `js/legenda.js` mostra no `.legenda-slot` da tela (centro da barra, ao lado do "ouvir" ou numa linha própria), sem cobrir alvos, e some 4 s depois do fim. Som: alto-falante + letra MAIÚSCULA; sílaba/palavra: MA, MAPA. No Escute e Toque só o alto-falante (a letra é a resposta). A escolha "Mostrar legendas" (padrão ligada) fica em `localStorage` (`trilhaSons.legendas`), fora do progresso, e não é apagada por "Reiniciar progresso".
- Indicadores: trilha mostra "Letra N de 20 · etapa"; a lição mostra o passo a passo (só conta os jogos disponíveis para a letra, por isso a letra A tem 3) e o fim da lição mostra a frase do resultado. A frase é calculada depois de `verificarAvanco()`, que passou a rodar antes da recompensa final (o efeito para o progresso é o mesmo).
- Área dos pais em cartões por seção, com grade das letras do currículo por estado (cor + marca ✓ / … + contorno tracejado, para não depender só da cor), resumo em cards e explicação de uma linha em cada ação. Nova tela `ajuda` ("Como funciona"), aberta da tela inicial e da área dos pais. Textos de apoio que citavam o nome de uma consoante (gravar.js, README) foram reescritos.
- Contraste: pares de cores do texto conferidos por cálculo WCAG em `tests/i-ux.test.mjs` (mínimo 4,5:1; 3:1 só para número grande).
- Área dos pais em 4 abas, copiada do painel do app de referência (subagente J): Progresso, Ajustes, Sua voz e Backup, com o texto e o visual no estilo do jogo (rosa, Andika). Porta mantida com conta e 3 respostas (o teclado numérico da referência foi deixado de fora para não quebrar o contrato de testes; a chance de acerto ao acaso é de 1 em 3, aceitável para uma criança de 5 anos que não sabe somar). O painel inteiro está sempre no DOM, com as abas inativas `hidden`; o editor de voz é montado só na primeira abertura da aba Sua voz (`criarEditorVoz` em `js/telas/gravar.js`; a tela `gravar` continua existindo como invólucro).
- Ajustes da adulta ficam em `progresso.ajustes` (`trilhaSons.v1`): `itensPorRodada` (3 a 8, `null` = regra do currículo, entregue aos jogos em `ctx.itensPorRodada`), `letrasRevisao` (0 a 3, `null` = `ceil(itens x proporcaoRevisao)`; com 0 a rodada só tem a letra nova) e `tracadoNaLicao` (padrão ligado; o Trace segue no menu de brincadeiras). `reiniciar()` preserva nome, guia, ajustes e a data da última cópia. Fora do escopo por depender de `js/audio.js`: volume do jogo e escolha "voz da mãe x original" (a gravação da adulta sempre tem prioridade; para voltar à original, apague a gravação).
- Backup (`js/telas/pais-backup.js`): arquivo `trilha-dos-sons-AAAA-MM-DD.json` com `{ app, versao: 1, criadoEm, progresso, ajustes (inclui legendas), gravacoes: [{ id, mime, duracao, criadoEm, base64 }] }`. Importar valida tudo antes (`progresso.validar`, ids de áudio, base64 decodificado) sem tocar em nada, mostra um resumo e só restaura após confirmação. A restauração é atômica: progresso (localStorage, com retorno ao anterior se o aparelho não gravar) e gravações (IndexedDB, uma única transação `clear` + `put`, cancelada em qualquer erro); se a segunda parte falhar, a primeira é desfeita. O arquivo é baixado pela própria adulta; nada é enviado.
- Atualização controlada: `sw.js` não chama mais `skipWaiting()` na instalação. A versão nova fica esperando; `js/telas/pais-atualizar.js` detecta `registration.waiting`, o painel mostra "Nova versão disponível" e o botão Atualizar envia `{ tipo: 'PULAR_ESPERA' }` ao SW, que faz `skipWaiting()`; em `controllerchange` a página recarrega. `{ tipo: 'VERSAO' }` devolve o nome do cache (mostrado no painel e usado nos testes). Na primeira instalação não há versão antiga, então o SW ativa direto. `data/*.json` e gravações seguem rede primeiro; o resto, cache primeiro.
- UX trazida da referência para os jogos: a amiga guia da barra comemora o acerto (troca para a figura "festa" e dá dois pulinhos, em `celebrarGuia` de `js/jogos/comum.js`) e o Trace ganha uma dica sem pressa (após ~7 s parado, uma bolinha percorre o traço duas vezes; some ao avançar; sem contagem nem pontos). Deixado de fora: falar o nome da letra e os sons de número (regra do destino), fim automático da sessão após 1,5 s (a despedida tem botões para a adulta), tela de apresentação "Aa" (decisão pedagógica do líder), botão de traçado na tela inicial (o menu de brincadeiras já leva ao Trace livre).
