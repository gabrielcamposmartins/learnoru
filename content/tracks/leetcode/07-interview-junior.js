Game.registerModule('leetcode', {
  id: 'interview-junior',
  title: 'Entrevista Júnior',
  kind: 'interview',
  level: 2,
  order: 90,
  unit: 'entrevistas',
  summary: 'Simulação de entrevista: Best Time to Buy and Sell Stock e Group Anagrams, com follow-ups.',
  concepts: ['Hash Map', 'Mínimo corrente', 'Chave canônica', 'Testes'],
  takeaways: [
    'Comece dizendo a **força bruta** e a complexidade dela; depois otimize. Isso mostra raciocínio estruturado.',
    'Best Time to Buy and Sell Stock: para vender hoje, o melhor é ter comprado no **mínimo corrente** (menor preço até ontem). Uma passada: `O(n)` de tempo, `O(1)` de espaço.',
    'Group Anagrams: uma **chave canônica** (letras ordenadas ou a contagem das 26 letras) num `dict` agrupa tudo numa passada.',
    'Se a saída não tem ordem definida, o teste precisa **normalizar** antes de comparar. Cubra bordas e compare com uma solução de referência.',
    '**Pense em voz alta**: o entrevistador avalia o processo, não só o código final.',
  ],
  glossary: [
    { term: 'Mínimo corrente', aliases: ['mínimo acumulado', 'running minimum', 'prefix minimum', 'mínimo até agora'], definition: 'O menor valor visto **até a posição atual**, atualizado a cada passo com `menor = min(menor, x)`. Troca um laço interno de "procurar o menor antes de `i`" por uma variável: de `O(n²)` para `O(n)`.' },
    { term: 'Chave canônica', aliases: ['chaves canônicas', 'forma canônica', 'formas canônicas', 'canonical key', 'canonical form'], definition: 'Representação **única** para todos os objetos considerados equivalentes. Para anagramas, `"".join(sorted(palavra))` ou a tupla com a contagem das letras: palavras equivalentes geram a mesma chave de `dict`.' },
    { term: 'Think-aloud', aliases: ['think aloud', 'pensar em voz alta', 'protocolo de pensar em voz alta', 'think-aloud protocol'], definition: 'Método da psicologia cognitiva (Ericsson e Simon) em que a pessoa **narra o raciocínio** enquanto resolve uma tarefa. Entrevistas técnicas adotam a mesma ideia para avaliar o processo, não só a resposta.' },
    { term: 'Rubber duck debugging', aliases: ['pato de borracha', 'depuração com pato de borracha', 'rubber duck', 'rubber ducking'], definition: 'Explicar o código, linha por linha, para um pato de borracha (ou qualquer ouvinte). Verbalizar obriga a checar cada suposição e costuma revelar o bug. O termo ficou famoso com o livro *The Pragmatic Programmer* (1999).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Oi! Eu vou conduzir sua entrevista técnica hoje. Relaxa, a ideia é conversar.',
        'Vão ser **dois problemas**. Em cada um, quero ouvir sua abordagem antes do código, e depois vou fazer umas perguntas de follow-up.',
        { text: 'Dica de ouro: pense em voz alta, comece simples e diga a complexidade no final. Bora?', mood: 'neutral' },
      ],
      board: {
        title: '🎤 Roteiro da entrevista',
        md: `1. **Problema 1** — Best Time to Buy and Sell Stock
2. **Problema 2** — Group Anagrams
3. **Follow-up** — complexidade e testes

> [!dica] Em entrevista real: repita o problema com suas palavras, pergunte sobre casos de borda e só então codifique.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Antes de começar: sabe por que eu insisto tanto em "pensar em voz alta"? Não é mania de entrevistadora, tem ciência por trás.',
        { text: 'E, de bônus, falar sozinho ajuda a achar bug. Até com um pato de borracha.', mood: 'happy' },
      ],
      board: {
        title: 'Por que pensar em voz alta funciona',
        md: `| Prática | De onde vem | O que dá para você |
|---|---|---|
| **Think-aloud** | Psicologia cognitiva: Ericsson e Simon, *Protocol Analysis* (anos 1980) | O entrevistador vê **como** você raciocina e pode dar uma dica na hora certa |
| **Rubber duck debugging** | *The Pragmatic Programmer* (1999) | Narrar o código linha por linha força você a checar cada suposição |

> [!sabia] Nos estudos de *think-aloud*, pede-se só para **narrar** o que passa pela cabeça, sem justificar nem explicar. Narrar quase não muda o desempenho; ficar se justificando o tempo todo, sim. Na entrevista vale o mesmo: diga o que está tentando ("vou guardar o menor preço até aqui…") em vez de ficar em silêncio ou se desculpando.`,
      },
    },
    {
      type: 'section',
      title: 'Problema 1',
      subtitle: 'Best Time to Buy and Sell Stock (LeetCode 121)',
      icon: '📈',
      text: 'Primeiro problema. Vou descrever e você me diz como atacaria.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Você recebe os preços de uma ação, um por dia. Pode **comprar em um dia** e **vender em um dia posterior** — uma única vez.',
        'Qual o **lucro máximo** possível? Se não der para lucrar, a resposta é `0`.',
      ],
      board: {
        title: 'Best Time to Buy and Sell Stock',
        md: `\`\`\`text
preços: [7, 1, 5, 3, 6, 4]
         ↑  ↑        ↑
             compra 1, vende 6  ->  lucro 5
\`\`\`

- Tem que **comprar antes** de vender (não vale vender a 7 e comprar a 1).
- \`[7, 6, 4, 3, 1]\` → \`0\` (os preços só caem).`,
      },
    },
    {
      type: 'mcq',
      id: 'lc-ij-q1',
      concept: 'Mínimo corrente',
      say: 'Qual abordagem você usaria?',
      prompt: 'Qual abordagem resolve o problema em **tempo `O(n)`**?',
      options: [
        { text: 'Testar todos os pares (compra `i`, venda `j > i`) e guardar o maior lucro.', why: 'Correto, mas `O(n²)` — é a força bruta que você pode citar como ponto de partida.' },
        { text: 'Ordenar os preços e subtrair o menor do maior.', why: 'Ordenar perde a **ordem dos dias**: o menor preço pode vir depois do maior.' },
        { text: 'Percorrer uma vez guardando o **menor preço visto até agora** e o melhor lucro `preço - mínimo`.', correct: true, why: 'Para vender no dia `i`, o melhor é ter comprado no menor preço anterior a `i`.' },
        { text: 'Dois ponteiros, um em cada ponta, andando em direção ao meio.', why: 'A lista não está ordenada, então mover os ponteiros não descarta possibilidades com segurança.' },
      ],
      explanation: 'A pergunta-chave é: "se eu vendesse hoje, qual seria o melhor dia de compra?" — o **mínimo até ontem**. Mantendo esse mínimo corrente, uma passada basta.',
    },
    {
      type: 'code',
      id: 'lc-ij-q2',
      concept: 'Mínimo corrente',
      title: 'max_profit',
      say: 'Pode implementar. Pensa nos casos de borda: lista vazia, um dia só, preços caindo.',
      prompt: `Implemente \`max_profit(prices)\` que devolve o **maior lucro** possível comprando em um dia e vendendo num dia **posterior**. Se não houver lucro possível, devolva \`0\`.

Objetivo: **\`O(n)\` de tempo e \`O(1)\` de espaço**.`,
      starter: `def max_profit(prices):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'max_profit([7, 1, 5, 3, 6, 4])', expected: '5' },
        { name: 'preços só caem', expr: 'max_profit([7, 6, 4, 3, 1])', expected: '0' },
        { name: 'lista vazia', expr: 'max_profit([])', expected: '0' },
        { name: 'um dia só', expr: 'max_profit([5])', expected: '0' },
        { name: 'mínimo depois do máximo', expr: 'max_profit([2, 4, 1])', expected: '2' },
        { expr: 'max_profit([3, 2, 6, 5, 0, 3])', expected: '4', hidden: true },
        { expr: 'max_profit([1, 2])', expected: '1', hidden: true },
        { expr: 'max_profit([2, 1, 2, 1, 0, 1, 2])', expected: '2', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.000, preços sempre caindo',
          setup: 'prices = list(range(8000, 0, -1))',
          expr: 'max_profit(prices)',
          expected: '0',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Mínimo corrente — uma passada O(n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Testar todos os pares compra/venda é `O(n²)`. Guarde o menor preço visto até agora e calcule o lucro de vender hoje.',
          concept: 'Mínimo corrente',
        },
        {
          when: (m, code) => /\bfor\b[\s\S]*\b(max|min)\s*\(\s*prices\s*\[/.test(code),
          text: 'Chamar `max(prices[i:])`/`min(prices[:i])` dentro do loop recalcula a fatia inteira (`O(n)` por passo). Atualize o mínimo incrementalmente.',
          concept: 'Mínimo corrente',
        },
        {
          when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
          text: 'Ordenar os preços perde a ordem dos dias — e custa `O(n log n)`. A ordem temporal é essencial neste problema.',
          concept: 'Mínimo corrente',
        },
      ],
      hints: [
        'Se você vendesse no dia `i`, em qual dia deveria ter comprado?',
        'Mantenha `menor` = menor preço visto até agora e `lucro` = melhor lucro até agora.',
        'Para cada preço `p`: `lucro = max(lucro, p - menor)` e `menor = min(menor, p)`.',
      ],
      solution: `def max_profit(prices):
    menor = float("inf")
    lucro = 0
    for p in prices:
        menor = min(menor, p)
        lucro = max(lucro, p - menor)
    return lucro
`,
      solutionExplanation: 'Para cada dia, o melhor lucro vendendo hoje é `preço - menor preço anterior`. Mantendo esse mínimo corrente: **tempo `O(n)`**, **espaço `O(1)`**. Começar `lucro = 0` já cobre listas vazias e preços só caindo.',
    },
    {
      type: 'mcq',
      id: 'lc-ij-q3',
      concept: 'Big-O',
      say: 'Follow-up: qual a complexidade da sua solução?',
      prompt: 'Qual é a complexidade da solução com **mínimo corrente** (uma passada, duas variáveis)?',
      options: [
        { text: 'Tempo `O(n)`, espaço `O(1)`', correct: true, why: 'Uma passada pelos preços e só duas variáveis extras.' },
        { text: 'Tempo `O(n)`, espaço `O(n)`', why: 'Não guardamos nenhuma estrutura proporcional à entrada.' },
        { text: 'Tempo `O(n log n)`, espaço `O(1)`', why: 'Não há ordenação.' },
        { text: 'Tempo `O(n²)`, espaço `O(1)`', why: 'Esse é o custo da força bruta, não do mínimo corrente.' },
      ],
      explanation: 'Uma única passada com `menor` e `lucro`: `O(n)` de tempo, `O(1)` de espaço — o melhor possível, pois é preciso ler todos os preços.',
    },
    {
      type: 'section',
      title: 'Problema 2',
      subtitle: 'Group Anagrams (LeetCode 49)',
      icon: '🔤',
      text: 'Muito bem. Vamos ao segundo problema.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Agora você recebe uma lista de palavras e precisa **agrupar os anagramas**: palavras com as mesmas letras, em qualquer ordem.',
        'A pergunta que eu quero que você se faça: qual **chave** é igual para todas as palavras de um mesmo grupo?',
      ],
      board: {
        title: 'Group Anagrams',
        md: `\`\`\`text
entrada: ["eat", "tea", "tan", "ate", "nat", "bat"]
saída:   [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]
\`\`\`

- A ordem dos grupos e dentro dos grupos **não importa**.
- Ideia: uma **chave canônica** — algo que todos os anagramas compartilham.`,
      },
    },
    {
      type: 'code',
      id: 'lc-ij-q4',
      concept: 'Chave canônica',
      title: 'group_anagrams',
      say: 'Pode codar. Um `dict` com a chave certa resolve quase tudo.',
      prompt: `Implemente \`group_anagrams(strs)\` que devolve uma **lista de grupos** (listas de strings), onde cada grupo contém palavras que são anagramas entre si.

- A ordem dos grupos e das palavras dentro de cada grupo não importa.
- Objetivo: **\`O(n · k log k)\`** (n palavras de tamanho até k) ou melhor.`,
      starter: `def group_anagrams(strs):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])', expected: '[["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]', compare: 'nested_sorted' },
        { name: 'string vazia', expr: 'group_anagrams([""])', expected: '[[""]]', compare: 'nested_sorted' },
        { name: 'uma palavra', expr: 'group_anagrams(["a"])', expected: '[["a"]]', compare: 'nested_sorted' },
        { name: 'lista vazia', expr: 'group_anagrams([])', expected: '[]', compare: 'nested_sorted' },
        { expr: 'group_anagrams(["abc", "bca", "cab", "xyz", "zyx", "q"])', expected: '[["abc", "bca", "cab"], ["xyz", "zyx"], ["q"]]', compare: 'nested_sorted', hidden: true },
        { expr: 'group_anagrams(["ab", "ba", "ab"])', expected: '[["ab", "ab", "ba"]]', compare: 'nested_sorted', hidden: true },
      ],
      perfTests: [
        {
          name: '20.000 palavras',
          setup: 'strs = [str(i) for i in range(20000)]',
          expr: 'len(group_anagrams(strs))',
          expected: 'len({"".join(sorted(s)) for s in strs})',
          maxMs: 250,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Hash Map com chave canônica',
      reviews: [
        {
          when: m => m.calls.includes('index'),
          text: 'Procurar o grupo com `.index()` numa lista de chaves é `O(grupos)` por palavra. Um `dict` chave → grupo encontra em `O(1)`.',
          concept: 'Hash Map',
        },
        {
          when: m => m.calls.includes('Counter'),
          text: '`Counter` não é hasheável, então não serve como chave de `dict` — comparar contadores par a par vira `O(n²)`. Use `"".join(sorted(p))` ou uma tupla com 26 contagens como chave.',
          concept: 'Chave canônica',
        },
      ],
      hints: [
        'Duas palavras são anagramas se, **ordenando** as letras, ficam iguais: `"".join(sorted("eat")) == "aet"`.',
        'Use um `dict` (ou `defaultdict(list)`) de chave ordenada → lista de palavras.',
        'No final, devolva `list(grupos.values())`.',
      ],
      solution: `from collections import defaultdict


def group_anagrams(strs):
    grupos = defaultdict(list)
    for palavra in strs:
        chave = "".join(sorted(palavra))
        grupos[chave].append(palavra)
    return list(grupos.values())
`,
      solutionExplanation: 'A **chave canônica** (letras ordenadas) é idêntica para todos os anagramas. Com um `dict`, cada palavra vai para o grupo certo em `O(1)`. **Tempo `O(n · k log k)`** (ordenar cada palavra), **espaço `O(n · k)`**. Alternativa `O(n · k)`: usar como chave uma tupla com a contagem das 26 letras.',
    },
    {
      type: 'open',
      id: 'lc-ij-q5',
      concept: 'Testes',
      say: 'Último follow-up: se esse código fosse para produção, como você testaria?',
      prompt: 'Como você **testaria** a função `group_anagrams`? Que casos você escreveria e por quê?',
      minWords: 15,
      rubric: [
        { label: 'Casos de borda: lista **vazia**, **string vazia**, **uma palavra**', keywords: ['vazi', 'uma palavra', 'um elemento', 'um item', 'unico'], concept: 'Casos de borda', why: 'É onde a maioria dos bugs aparece.' },
        { label: 'Palavras **repetidas** ou sem nenhum anagrama', keywords: ['repetid', 'duplicad', 'iguais', 'sem anagrama', 'nenhum anagrama', 'sozinh'], concept: 'Casos de borda', why: 'Duplicatas devem ficar no mesmo grupo; palavras únicas formam grupo próprio.' },
        { label: 'A comparação **não deve depender da ordem** dos grupos/palavras', keywords: ['ordem', 'ordenar o resultado', 'independente', 'conjunto'], concept: 'Testes', why: 'A saída não tem ordem definida; o teste precisa normalizar antes de comparar.' },
        { label: 'Teste de **desempenho** com entrada grande ou comparação com uma solução de referência/força bruta', keywords: ['desempenho', 'performance', 'grande', 'forca bruta', 'referencia', 'aleatori', 'stress', 'carga'], concept: 'Testes', why: 'Garante a complexidade e pega bugs que exemplos pequenos não mostram.' },
      ],
      modelAnswer: `Eu escreveria testes com \`pytest\` cobrindo:

1. **Exemplo do enunciado** (caso feliz).
2. **Casos de borda**: lista vazia → \`[]\`; \`[""]\` → \`[[""]]\`; uma palavra só.
3. **Repetidas e sem anagramas**: \`["ab", "ba", "ab"]\` num único grupo; \`["abc", "xyz"]\` em grupos separados.
4. Maiúsculas/acentos, se o enunciado permitir, para decidir o comportamento esperado.

Como a **ordem** dos grupos não é definida, o teste **normaliza** antes de comparar (ordena cada grupo e a lista de grupos).

Por fim, um teste de **desempenho** com milhares de palavras e um teste aleatório comparando com uma **solução de referência** simples (força bruta) para pegar bugs sutis.`,
    },
    {
      type: 'order',
      id: 'lc-rx2-ij-q6',
      concept: 'Processo de entrevista',
      say: 'Antes de encerrar: se você fosse ensinar alguém a fazer esta entrevista, em que ordem faria as coisas?',
      prompt: 'Coloque os passos para resolver um problema de entrevista na **ordem recomendada**.',
      items: [
        'Repetir o problema com suas palavras e perguntar sobre casos de borda',
        'Propor a força bruta e dizer a complexidade dela',
        'Identificar o padrão que otimiza (mínimo corrente, chave canônica…)',
        'Escrever o código pensando em voz alta',
        'Rastrear o código com um exemplo e com os casos de borda',
        'Dizer a complexidade final de tempo e de espaço',
      ],
      explanation: 'Entender antes de codar evita resolver o problema errado. A força bruta garante uma resposta e serve de base para comparar. Otimizar antes de escrever evita reescrever tudo. **Rastrear** o código antes de dizer "terminei" pega bugs que o entrevistador acharia. A complexidade fecha a conversa e abre espaço para os follow-ups.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'É isso! Obrigada pela conversa. Você mostrou abordagem, código e pensou em testes — exatamente o que buscamos.',
        { text: 'Meu feedback: quando possível, comece dizendo a **força bruta** e a complexidade dela; depois otimize. Isso mostra raciocínio estruturado.', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
