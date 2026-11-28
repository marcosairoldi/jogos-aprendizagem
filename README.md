# Trilha dos Sons

Jogo para celular que ensina os **sons das letras** (método fônico) em português do Brasil, para crianças de 5 anos que ainda não leem. Tudo é falado: a criança não precisa ler nada. Uma adulta acompanha.

- 5 brincadeiras: Trilha Encantada, Escute e Toque, Caça-Som, Junte os Sons e Trace a Letra.
- Duas amigas originais guiam a criança: a unicórnio **Lumi** e a sereia **Marola**.
- Funciona sem internet depois da primeira abertura.
- Sem anúncios, sem login, sem coleta de dados. O progresso e o nome da criança ficam guardados **só no celular**.

---

## Como publicar (passo a passo, sem conhecimento técnico)

Você vai precisar de uma conta gratuita no GitHub (https://github.com). O site do jogo fica de graça no **GitHub Pages**.

### 1. Criar o repositório

1. Entre no GitHub e clique no **+** no canto superior direito, depois em **New repository**.
2. Em **Repository name**, escreva um nome sem espaços, por exemplo `trilha-dos-sons`.
3. Marque **Public**.
4. Não marque nenhuma outra opção. Clique em **Create repository**.

### 2. Enviar os arquivos

**Jeito mais fácil (pelo navegador):**

1. Na página do repositório recém-criado, clique no link **uploading an existing file**.
2. No computador, abra a pasta do jogo, selecione **todo o conteúdo** dela (as pastas `assets`, `css`, `data`, `docs`, `js` e os arquivos `index.html`, `manifest.json`, `sw.js`, `README.md` e os demais) e arraste para a página.
3. Espere terminar de carregar, desça a página e clique em **Commit changes**.

**Jeito para quem usa o Git no computador:** veja a seção "Comandos" no fim.

### 3. Ligar o GitHub Pages

1. No repositório, clique em **Settings** (Configurações).
2. No menu da esquerda, clique em **Pages**.
3. Em **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
5. Espere de 1 a 3 minutos e recarregue a página. Vai aparecer o endereço do jogo, parecido com:
   `https://SEU-USUARIO.github.io/trilha-dos-sons/`

### 4. Abrir no celular Android e instalar

1. No celular, abra o **Chrome** e digite o endereço do passo anterior.
2. Espere o jogo abrir uma vez com internet (assim ele guarda tudo para funcionar offline).
3. Toque nos **três pontinhos** (canto superior direito) e depois em **Adicionar à tela inicial** (ou **Instalar app**).
4. Confirme. Vai aparecer um ícone rosa na tela do celular. Pronto: abra por ele, em tela cheia, mesmo sem internet.

**Dica de voz:** o jogo usa a voz do próprio celular para falar as frases. Se a voz estiver estranha ou em outro idioma, vá em **Configurações do Android > Sistema > Idioma > Saída de texto para fala**, escolha o **Mecanismo de fala do Google** e o idioma **Português (Brasil)**.

---

## Como usar

1. Abra o jogo e toque no **botão grande** para começar (o celular só libera o som depois de um toque).
2. Na primeira vez, a criança escolhe a amiga: Lumi ou Marola.
3. Na trilha, toque na parada que brilha. Cada parada é uma letra nova.
   Para treinar uma letra que já foi concluída, toque em "Letras anteriores" (ou arraste a trilha para cima) e toque na parada da letra; as concluídas têm uma estrelinha, e "Letra de hoje" volta para a letra atual. Esse treino não muda a letra atual nem libera letra nova.
4. Uma sessão dura cerca de 8 minutos e termina com uma despedida carinhosa. Pouco por dia funciona melhor do que muito de uma vez.

### Para a adulta que acompanha

Tudo é **falado** para a criança: ela não precisa ler nada. O texto na tela é para você.

- **Rótulos:** todo botão de ícone tem o nome escrito embaixo (Começar, Ouvir de novo, Início, Brincadeiras, Coleção, Pais, Continuar, Voltar), e os cartões do menu mostram o nome de cada jogo.
- **Como funciona:** o botão com "?" na tela inicial abre uma tela curta com o objetivo, como acompanhar, o que é cada brincadeira e como a trilha avança.
- **Legenda da fala:** no alto da tela aparece o texto do que o guia está falando. Quando toca um **som**, a legenda mostra um alto-falante e a letra em maiúscula (por exemplo, alto-falante e M); para sílabas e palavras, MA ou MAPA. Quando o guia diz o **nome** da letra, a legenda mostra "nome:" e o nome, e logo depois "som:" com o alto-falante e a letra, para ficar claro qual é qual. **Ao repetir o som, faça o SOM, não o nome**: para o M, um "mmm" com a boca fechada, sem juntar vogal. No jogo Escute e Toque a legenda mostra só o alto-falante, para não entregar a resposta. Dá para desligar em **Pais > Mostrar legendas**.
- **Onde a criança está:** na trilha aparece "Letra N de 20" e o nome da etapa; na lição, "Lição da letra A · 2 de 4 · Caça-Som" com bolinhas de progresso; ao fim da lição, uma frase escrita com o resultado (por exemplo, "Letra A dominada! A próxima letra foi liberada.").
- **Nome e som:** ao apresentar uma letra, o jogo diz primeiro o NOME dela e depois o SOM, sempre separados (dois balõezinhos, "nome" e "som", acendem na lição). Os jogos de ouvir e juntar usam só o som. Você pode gravar os nomes na aba **Sua voz**, no grupo **Nomes das letras**.
- **Como acompanhar:** deixe a criança tocar, repita o som junto, elogie o esforço e use sessões de 5 a 10 minutos.

### Área dos pais

Toque em **Pais** na tela inicial e responda a conta de somar. O painel tem quatro abas:

- **Progresso:** tempo de uso, sessões, letras dominadas e recompensas; a grade com todas as letras do currículo, coloridas por estado (verde com ✓ = dominada, amarelo = em prática, cinza tracejado = ainda não liberada); um cartão por letra liberada; "Onde precisou de mais ajuda" e o histórico recente das brincadeiras.
- **Ajustes:** nome da criança (fica só no celular), **atividades por rodada** (3 a 8), **letras de revisão** por rodada (0 a 3), incluir ou não o **Trace a Letra** na lição, ligar ou desligar as **legendas**, trocar a amiga guia, liberar a próxima letra (use se a criança já sabe o som), reiniciar o progresso (pede um segundo toque; não apaga nome, ajustes nem gravações) e o link **Como funciona**.
- **Sua voz:** grave a sua voz, som por som (veja a seção abaixo).
- **Backup:** **Exportar cópia** baixa um arquivo `.json` com o progresso, os ajustes e as suas gravações; **Importar cópia** lê esse arquivo, mostra um resumo e só substitui os dados depois da sua confirmação. Arquivo inválido ou falha no meio do caminho não mudam nada. O arquivo fica com você: nada é enviado pela internet. O painel avisa quando a última cópia tem mais de 14 dias.

Embaixo das abas, o cartão **Versão do jogo** mostra se há versão nova. Quando você publica uma atualização, o celular a baixa sozinho, mas **só troca de versão quando você toca em Atualizar** (aparece "Nova versão disponível"): assim a criança nunca é surpreendida no meio de uma brincadeira. Atualizar recarrega a página e não apaga progresso nem gravações.

### Gravar a sua voz

Sem gravação, o jogo usa sons gerados por computador e a voz do aparelho. A sua voz ensina muito melhor, e dá para gravar dentro do próprio jogo:

1. Abra o jogo, toque no botão discreto da **Área dos pais** (canto da tela inicial) e resolva a conta.
2. Abra a aba **Sua voz**. **Letras** mostra só os sons das letras; **Todos os sons** inclui frases, sílabas e palavras. Dá para **buscar** um som ou uma palavra.
3. Em cada item, toque em **Gravar**, fale, e toque em **Parar** (ou espere 6 segundos). O jogo corta o silêncio do começo e do fim, ajusta o volume e toca a gravação para você conferir. Se não gostou, grave de novo. Para comparar, **Ouvir como está hoje** toca o som atual. Em vez de gravar, você pode **Enviar áudio** (um arquivo seu). Cada item mostra "Voz original" ou "gravado".
4. A primeira vez o Chrome pede permissão para usar o microfone: toque em **Permitir**. Se negar sem querer, toque no cadeado ao lado do endereço e permita o microfone para este site.

Dicas:

- Escolha um lugar silencioso (quarto com a porta fechada) e deixe o celular a um palmo da boca, um pouco de lado.
- **Comece pelos sons das letras** (o grupo mais importante). Fale só o som, sem vogal: "mmm".
- Fale devagar e alegre. Frases com o nome da criança são gravadas sem o nome ("Muito bem!").
- O que não for gravado continua com a voz do aparelho. Dá para gravar aos poucos.

**Onde ficam as gravações:** só neste celular (no armazenamento do navegador). Elas não vão para a internet nem para o repositório, e ninguém mais as ouve. Por isso: se você apagar os dados do navegador ou desinstalar o app, as gravações somem; **"Reiniciar progresso" não apaga as gravações**; e elas só passam para outro celular pelo **Backup** (Exportar cópia no celular antigo, Importar cópia no novo). A aba Sua voz mostra quantos itens já estão gravados e tem o botão **Apagar todas as gravações**.

**Alternativa avançada (arquivos no repositório):** quem quiser que as gravações valham em todos os celulares pode colocar arquivos `.mp3` ou `.m4a`, com o nome exato de cada item, na pasta `assets/audio/gravacoes/`. A lista de nomes e dicas de cada som está em [`assets/audio/LISTA.md`](assets/audio/LISTA.md). **Atenção à privacidade:** este repositório é público. Qualquer gravação enviada para ele pode ser ouvida por qualquer pessoa na internet. Só faça isso se quem falou concordar, e não grave nomes nem informações pessoais. A gravação feita no celular tem prioridade sobre esses arquivos.

### Mudar letras, palavras e frases

- Letras, palavras, sílabas e regras de avanço: `data/curriculo.json`.
- Frases que o jogo fala: `data/frases.json`.

Dá para editar direto no GitHub: abra o arquivo, clique no lápis, altere o texto entre aspas, e clique em **Commit changes**. O fundamento pedagógico e as fontes estão em [`docs/pesquisa.md`](docs/pesquisa.md).

Depois de mudar arquivos, o celular baixa a versão nova na próxima vez que abrir com internet. Para usá-la, abra **Pais > Atualizar** (aparece "Nova versão disponível"); sem tocar, o jogo continua na versão antiga, sem surpresa para a criança. Os arquivos `data/*.json` e as gravações do repositório são buscados na rede primeiro.

---

## Comandos (para quem usa o Git)

Dentro da pasta do jogo, trocando `SEU-USUARIO` e `trilha-dos-sons` pelos seus:

```bash
git remote add origin https://github.com/SEU-USUARIO/trilha-dos-sons.git
```

```bash
git push -u origin main
```

Para testar no computador antes de publicar:

```bash
python3 -m http.server 8000
```

e abra `http://localhost:8000` no Chrome.

## Para quem for mexer no código

- Plano e contrato entre as partes: [`docs/PLANO.md`](docs/PLANO.md).
- Depois de adicionar ou trocar arquivos, atualize a lista de cache offline e a lista de gravações:

```bash
node ferramentas/gerar-sw.mjs && node ferramentas/gerar-lista-audio.mjs
```

- Validar o currículo:

```bash
node ferramentas/validar-curriculo.mjs
```

## Licenças

- Código e arte: originais deste projeto.
- Fonte Andika: SIL Open Font License (arquivo em `assets/fontes/`).
