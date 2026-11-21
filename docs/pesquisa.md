# Pesquisa pedagógica: método fônico para a Trilha dos Sons

Método da pesquisa: duas buscas na web (resultados resumidos, sem abrir os PDFs completos) somadas ao conhecimento prévio sobre as fontes de referência. Tudo o que não foi visto online nesta rodada está marcado como **(não confirmado online)**.

## 1. Resumo por tema

**Instrução fônica sistemática.** O National Reading Panel (2000) concluiu que ensinar a relação entre letras e sons de forma sistemática e explícita melhora leitura e escrita, com efeito maior na pré-escola e no 1º ano. O Relatório "Alfabetização Infantil: novos caminhos" (Câmara dos Deputados, 2003; edição de 2019), a PNA (MEC, 2019) e o RENABE (MEC/Sealf, 2020) defendem a mesma linha para o Brasil. Na prática: ensino planejado, uma letra por vez, com prática diária curta.

**Consciência fonêmica.** Perceber que a fala é feita de sons pequenos (/m/, /a/) é o melhor preditor de aprendizagem da leitura. Treinar consciência fonêmica junto com as letras rende mais do que treinar separadamente (NRP, 2000; Capovilla e Capovilla). Aqui: "Caça-Som" (qual figura começa com este som) e "Escute e Toque".

**Ensinar o som, não o nome da letra.** O som é o que a criança usa para decodificar. O nome pode vir depois (Ehri). Para a consoante, a adulta deve produzir o som puro, sem vogal agregada ("mmm", não "mê"), senão a mistura vira "mê-a" em vez de "ma". Regra do jogo: nunca falar nome de consoante.

**Ordem de introdução das letras.** Ver seção 2.

**Mistura de sons (blending).** É a habilidade central: juntar /m/ + /a/ = "ma". Funciona melhor com sílabas CV e sons que podem ser sustentados. Em português a sílaba CV é a unidade natural, o que favorece ir direto de som a sílaba e de sílaba a palavra CV.CV (Capovilla e Capovilla; RENABE, não confirmado online no detalhe).

**Sílabas CV.** Sílabas consoante+vogal regulares são o primeiro alvo. Cuidado com as irregulares no Brasil: CE e CI (som /s/), GE e GI (som /ʒ/), e TI e DI (viram "tchi" e "dji" em boa parte do país). Ficam de fora do currículo, assim como dígrafos.

**Revisão espaçada.** Reencontrar o conteúdo em intervalos crescentes consolida a memória; para crianças pequenas, a revisão misturada na rodada (aqui 30% de itens antigos) é uma forma prática. A literatura geral de prática distribuída sustenta isso (não confirmado online para esta faixa etária específica).

**Aprendizagem sem erro (errorless learning).** Reduzir a chance de errar, com poucas opções, dicas e repetição do modelo correto, evita que a criança fixe a resposta errada e protege a motivação. Aqui: o erro nunca pune; as opções diminuem até sobrar a certa (2 a 4 opções).

**Sessões curtas aos 5 anos.** A atenção sustentada de crianças dessa idade é de poucos minutos por atividade; sessões de 5 a 10 minutos, diárias, são mais eficazes do que longas e raras. Adotamos 8 minutos, com despedida carinhosa. A adulta pode continuar, sem obrigação. (Recomendação prática comum; fonte primária não confirmada online.)

**Traçado multissensorial.** Passar o dedo sobre a letra ao mesmo tempo em que se ouve e fala o som liga forma, som e movimento e ajuda a fixar o reconhecimento da letra. Os efeitos mais claros são para letras e escrita inicial; é um reforço, não substitui o ensino do som (Ehri et al.; não confirmado online no detalhe).

**Fases de leitura (Ehri).** A criança de 5 anos que ainda não lê está na fase pré-alfabética, passando à alfabética parcial. O objetivo desta etapa é só: conhecer o som das letras e conseguir misturar poucos sons. Ler palavras de verdade vem depois.

## 2. Ordem das letras: o que a pesquisa sustenta

- **Não há ordem comprovada como melhor.** Ehri (2022, "What teachers need to know and do to teach letter sounds...") e Shanahan afirmam que não existe consenso nem estudo mostrando uma sequência superior; os cerca de 18 programas analisados no NRP tinham cada um a sua. Confirmado online nesta rodada.
- **Orientações práticas, de apoio mais fraco:** (a) começar por várias consoantes contínuas (f, l, m, n, r, s), porque o som pode ser sustentado sem distorção e a mistura fica mais fácil; oclusivas no começo da palavra são mais difíceis de misturar; (b) introduzir cedo letras frequentes e algumas vogais, para poder formar sílabas e palavras logo. Fonte: Reading Rockets e checklist da Universidade do Oregon (confirmado online, mas guias práticos, não estudos comparativos).
- **Consequência para o currículo.** A ordem proposta pelo dono do projeto (A E I O U, M P B T, F V S, L N, D C G) é defensável: as vogais vêm primeiro (permitem formar sílabas imediatamente), M é contínua e abre o grupo, e as oclusivas P, B, T entram cedo mas com M já conhecida. **Decisão: manter a ordem sem alterações.** Reordenar para "contínuas antes de oclusivas" (M, F, V, S, L, N antes de P, B, T) seria permitido pela pesquisa, mas o ganho não está demonstrado e quebraria a configuração testada (vogais + M P B T). Alternativa registrada, caso o desempenho com P, B, T seja baixo: antecipar F e S antes de P.
- **Mitigação para oclusivas:** como o som puro de P, B, T, D, C, G é difícil de isolar, o jogo depende do áudio (gravado pela adulta ou gerado), e o `tts` desses sons é `null`; a dica da adulta orienta a pronúncia sem vogal. Ao misturar, a criança usa sílabas CV (pá, bô) em vez do som isolado.
- **Vogais:** introduzidas na ordem A, E, I, O, U. Pares muito parecidos (E/I, O/U) ficam separados por A no meio e pelo uso de palavras-âncora; o jogo diminui opções para 2 em caso de erro.

## 3. Valores de `regras` (ajustes e motivos)

| Regra | Valor | Motivo |
|---|---|---|
| itensPorRodada | 5 | rodada curta, cabe em 1 a 2 minutos; sem frustração |
| janelaDominio | 6 | olha as últimas 6 tentativas da letra |
| acertosParaDominar | 5 | 5 de 6 acertos de primeira: tolera um tropeço, sem exigir perfeição |
| jogosDistintosParaDominar | 2 | evita "decorar" a resposta de um só jogo; generaliza o som |
| sessoesParaDominar | 2 | domínio em dias diferentes, o que aproxima de revisão espaçada |
| proporcaoRevisao | 0.3 | cerca de 1 em 3 itens é de letra antiga |
| minutosSessao | 8 | dentro de 5 a 10 minutos por dia |
| opcoesMin / opcoesMax | 2 / 4 | começa com mais opções e encolhe no erro (aprendizagem sem erro) |

Valores iguais aos sugeridos no contrato: a pesquisa não pede mudança. Nada bloqueia a diversão: letras dominadas continuam disponíveis em todos os jogos. Sugestão de uso pelo código: liberar uma letra nova por vez dentro da etapa, e só liberar a próxima ao dominar a anterior (ou quando a adulta quiser).

## 4. Decisões fonéticas do currículo

- Vogais no português brasileiro falado: A /a/, E /e/ (fechado, "ê"), I /i/, O /o/ (fechado, "ô"), U /u/. Coerente com as palavras-âncora (elefante, ervilha, ema; ovo, olho, ovelha). Sem conflito com a pesquisa.
- Consoantes contínuas: M, F, V, S, L, N, com `tts` alongado ("mmmmm"). Oclusivas P, B, T, D, C /k/, G /g/ com `tts` `null`.
- Sílabas CV regulares: todas as consoantes com A, E, I, O, U, exceto CE, CI, GE, GI, TI, DI (total de 60 sílabas com 6 pares de vogais: ai, au, ei, eu, oi, ui). `tts` com acento forçado (pá, mê, mí, mô, mú). As sílabas "pe", "be", "te", "de" e "ve" usam o acento (pê, bê, tê, dê, vê), que coincide com o nome da letra; é inevitável para a voz do aparelho e vale só como sílaba, nunca como `tts` da letra (a regra do validador só vigia o `tts` das letras).
- `juntar: true` em 27 palavras CV.CV regulares: mapa, moto, mala, pato, pipa, bola, bolo, bota, tatu, foca, fada, fita, vaca, vela, sapo, sino, suco, lobo, lupa, dado, dedo, copo, cubo, cama, gato, galo, gota.
- Campo `silabas` das palavras: preenchido quando todas as sílabas existem como CV no currículo (inclusive tomate, tapete, vaso); vazio para palavras com sílaba não CV (vogal solta, "lha", "ão", "nho" etc.).

### Figuras problemáticas (mantidas com `juntar: false`)

- **ema**: o E antes de M é nasalizado ("ẽ"); aceitável como âncora de /e/, mas não é o "ê" puro.
- **unicornio**: U nasal ("ũ"); âncora aceitável, mas a melhor de U é uva.
- **ioio**: começa com glide ("iôiô"), e o "i" é curto; funciona, mas é a figura mais fraca de I. Melhor âncora: ilha.
- **elefante**: o E inicial pode soar entre "ê" e "i" em algumas regiões; é a âncora padrão de E e foi mantida como primeira.
- **dente**: "den-te" vira "dẽ-tchi"; nasal e "tchi" final. Por isso não é palavra de junção; o D inicial está correto. Melhor âncora de D: dado, depois dedo.
- **vaso**: o S entre vogais soa /z/; irregular para leitura sílaba a sílaba, `juntar: false`.
- **pe**: uma sílaba só ("pé" aberto); o E aqui é aberto e não "ê"; âncora de P aceitável pelo /p/ inicial.
- **lua, navio, nuvem, nariz, tomate, tapete**: iniciais corretas; não são CV.CV de duas sílabas, por isso não entram na junção.

## 5. Fontes

- National Institute of Child Health and Human Development (2000). *Report of the National Reading Panel: Teaching Children to Read.* https://www.nichd.nih.gov/publications/pubs/nrp/smallbook (não confirmado online nesta rodada)
- Câmara dos Deputados, Comissão de Educação e Cultura (2003). *Alfabetização Infantil: os novos caminhos* (edição revista, 2019). https://www.gov.br/mec (não confirmado online)
- MEC (2019). *PNA: Política Nacional de Alfabetização* (Decreto 9.765/2019). https://alfabetizacao.mec.gov.br/ (decreto confirmado online; caderno não aberto)
- MEC/Sealf (2020). *Relatório Nacional de Alfabetização Baseada em Evidências (RENABE).* Brasília, 360 p. Localizado em buscas (hospedado em gov.br/mec); trecho "a instrução fônica sistemática é a forma mais eficaz de ensinar a ler" visto apenas em citação secundária.
- Capovilla, A. G. S.; Capovilla, F. C. *Alfabetização: método fônico.* (Memnon). (não confirmado online)
- Ehri, L. C. (2022). What teachers need to know and do to teach letter sounds, phonemic awareness, and word reading. https://www.bangor.ac.uk/sites/default/files/2025-12/Ehri%20%282022%29%20What%20Teachers%20Need%20to%20Know%20and%20Do%20to%20Teach%20Letter%20Sounds%20Phonemic%20Awareness%20Word.pdf (resultado de busca)
- Ehri, L. C. (2005). Learning to read words: theory, findings, and issues. *Scientific Studies of Reading*, 9(2). (fases de leitura; não confirmado online)
- Ehri, L. C.; Nunes, S. R.; Stahl, S. A.; Willows, D. M. (2001). Systematic phonics instruction helps students learn to read. *Review of Educational Research*, 71(3). (não confirmado online)
- Shanahan, T. "Putting on your underwear first: why instructional sequence doesn't always matter." https://www.shanahanonliteracy.com/blog/putting-on-your-underwear-first-why-instructional-sequence-doesnt-always-matter
- Reading Rockets, "Alphabetic principle". https://www.readingrockets.org/article/alphabetic-principle (sons contínuos primeiro)
- Checklist de sequência (University of Oregon), via PETAA: https://petaa.edu.au/litportal/Resources-for-Curriculum/Lower-primary/Phonics-Spelling/Phonics/Carnine-order.aspx
- Estudo quase experimental brasileiro (48 crianças, 22 sessões de instrução fônica): https://scielo.br/j/ptp/a/3zzgqs75tSY5JJNfMpn7krm/?lang=pt (resumo visto em busca)

## 6. O que não consegui confirmar

- Texto integral e números do NRP, do relatório da Câmara, da PNA e do RENABE: não abri os PDFs; as afirmações vêm de conhecimento prévio e de resumos de busca.
- Estudos comparando diretamente "contínuas primeiro" com outras ordens: não encontrei; só guias práticos.
- Duração ideal de sessão aos 5 anos e frequência de revisão espaçada nessa faixa: recomendação prática; sem fonte primária vista.
- Efeito específico do traçado multissensorial sobre o som das letras: sem estudo verificado.
- Frequência de letras e sílabas no português infantil e detalhes do método de Capovilla (ordem das letras): não consultei.
- Pronúncia regional: a validação fonética assume o português falado no Sudeste/Brasil geral; em outras regiões TI/DI e o E/O átonos podem variar.
- Comportamento real da voz pt-BR do aparelho com "mmmmm", "ê", "ô" e sílabas acentuadas: depende do dispositivo; o áudio gravado é o caminho principal.

## 7. Acréscimo: J, Z e R (depois do MVP)

- **J** (/ʒ/) e **Z** (/z/) têm um som só e regular no português do Brasil; entram como sons contínuos, fáceis de prolongar.
- **R**: só o R forte do começo da palavra (rato, roda, rosa), que no Brasil soa como um sopro na garganta (/h/ ou /x/, varia com o sotaque). O R fraco de "caro", o RR e o R final ficam para depois, como casos de posição.
- Ficam fora, por serem irregulares ou raros: H (sem som próprio), Q (só com U), X (quatro sons), K, W, Y (palavras estrangeiras), além de C e G antes de E e I.
- Palavras para Junte os Sons: rato e roda. Rosa fica fora (S com som de Z), assim como jacaré (R fraco), janela (3 sílabas), joaninha, zebra (BR) e zíper.
