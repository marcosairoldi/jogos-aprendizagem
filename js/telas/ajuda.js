// "Como funciona": tela curta para a adulta que acompanha. Texto simples, rolável, sem áudio.
import { el } from '../ui.js';

const lista = (...itens) => el('ul', { classe: 'lista-ajuda' }, ...itens.map((t) => el('li', { texto: t })));
const secao = (titulo, ...filhos) => el('section', { classe: 'secao-pais' }, el('h2', { texto: titulo }), ...filhos);
const par = (t) => el('p', { texto: t });

export default {
  montar(raiz, app, params = {}) {
    const voltarBtn = el('button', { type: 'button', classe: 'btn-texto claro', texto: 'Voltar', attrs: { 'aria-label': 'Voltar' } });
    voltarBtn.addEventListener('click', () => app.ir(params.voltarPara || 'inicio', params.voltarPara === 'pais' ? { painel: true } : {}));

    raiz.append(el('section', { classe: 'tela rolavel pais painel ajuda' },
      el('header', { classe: 'cabecalho-pais' }, voltarBtn, el('h1', { texto: 'Como funciona' })),
      secao('O objetivo',
        par('O jogo ensina o SOM das letras, e não o nome delas. É o método fônico: a criança aprende que cada letra tem um som e depois junta os sons para formar sílabas e palavras.'),
        par('Tudo é falado pelo guia. A criança não precisa ler nada. O texto na tela é só para você.')),
      secao('Como acompanhar',
        lista(
          'Deixe a criança tocar sozinha. Você só observa e ajuda se ela pedir.',
          'Repita o som junto com ela, com a boca bem aberta para ela ver.',
          'Ao ler uma letra na tela, diga o som dela, não o nome. Para o M, por exemplo, é um "mmm" com a boca fechada, sem juntar vogal.',
          'Elogie o esforço, não só o acerto. Errar faz parte e o jogo nunca pune.',
          'Sessões de 5 a 10 minutos, um pouco por dia, funcionam melhor do que uma sessão longa.')),
      secao('As brincadeiras',
        lista(
          'Trilha Encantada: o caminho com uma parada por letra. A parada que brilha é a lição de hoje.',
          'Escute e Toque: a criança ouve um som e toca a letra que faz esse som.',
          'Caça-Som: a criança ouve um som e toca a figura que começa com ele.',
          'Junte os Sons: a sereia nada e junta os sons para formar sílabas e palavras.',
          'Trace a Letra: a criança passa o dedo sobre os pontinhos para desenhar a letra.')),
      secao('Como a trilha avança',
        par('Cada lição ensina uma letra com as quatro brincadeiras. Quando a criança acerta bem, a próxima letra é liberada ao fim da lição. Se ainda precisar de prática, a mesma letra volta na próxima vez, sem nenhum aviso negativo.'),
        par('As letras antigas voltam misturadas nas rodadas, para revisão. Se a criança já sabe o som, você pode liberar a próxima letra na Área dos pais.')),
      secao('Legendas',
        par('No alto da tela aparece o texto do que o guia está falando. Quando o guia toca um som, aparece um alto-falante e a letra. Leia o som, não o nome. Dá para desligar as legendas na Área dos pais.')),
      secao('Gravar a sua voz',
        par('A sua voz ensina melhor do que a voz do aparelho. Entre em Pais, resolva a conta, abra a aba "Sua voz" e grave os sons um por um. Dá para buscar um som, enviar um arquivo de áudio e ouvir antes de decidir. Comece pelos sons das letras. As gravações ficam só neste celular.')),
    ));
    return {};
  },
};
