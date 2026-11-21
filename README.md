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
4. Uma sessão dura cerca de 8 minutos e termina com uma despedida carinhosa. Pouco por dia funciona melhor do que muito de uma vez.

### Área dos pais

Toque na **engrenagem pequena** da tela inicial e responda a conta de somar. Lá você pode:

- digitar o nome da criança (fica só no celular; o jogo passa a chamá-la pelo nome);
- trocar a amiga guia;
- ver as letras que ela já domina e as que está praticando;
- ver o tempo de uso;
- liberar a próxima letra manualmente;
- reiniciar o progresso.

### Gravar a sua voz (opcional)

O som das letras vem de arquivos prontos, feitos por voz sintética. A sua voz fica muito melhor. A lista do que gravar, com o nome exato de cada arquivo e dicas de como fazer cada som, está em [`assets/audio/LISTA.md`](assets/audio/LISTA.md).

**Atenção à privacidade:** este repositório é público. Qualquer gravação enviada para ele pode ser ouvida por qualquer pessoa na internet. Não grave nomes nem informações pessoais.

### Mudar letras, palavras e frases

- Letras, palavras, sílabas e regras de avanço: `data/curriculo.json`.
- Frases que o jogo fala: `data/frases.json`.

Dá para editar direto no GitHub: abra o arquivo, clique no lápis, altere o texto entre aspas, e clique em **Commit changes**. O fundamento pedagógico e as fontes estão em [`docs/pesquisa.md`](docs/pesquisa.md).

Depois de mudar arquivos, o celular atualiza o jogo sozinho na próxima vez que abrir com internet (às vezes é preciso fechar e abrir o app duas vezes).

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
