Game.registerModule('leetcode', {
  id: 'big-o',
  title: 'Complexidade Big-O',
  kind: 'lesson',
  level: 1,
  order: 1,
  unit: 'fundamentos',
  summary: 'Como medir o custo de um algoritmo — e o custo escondido das operações do Python.',
  concepts: ['Big-O', 'Complexidade de tempo', 'Complexidade de espaço', 'Hash Set'],
  takeaways: [
    'Big-O descreve como o custo **cresce** com `n`: ignore constantes e termos menores — e sempre diga a complexidade de **tempo e espaço**.',
    'Loops **em sequência** somam; loops **aninhados** multiplicam; dividir a entrada pela metade a cada passo dá `O(log n)`.',
    'Cuidado com os `O(n)` escondidos: `x in list`, `list.pop(0)`, `remove`, `index`, `count` e fatias varrem ou copiam a lista.',
    'Trocar **memória por tempo** com um `set` ou `dict` é o atalho mais comum de `O(n²)` para `O(n)`.',
    'Big-O não é tudo: para `n` pequeno, constantes e cache pesam — existem até algoritmos **galácticos**, ótimos no papel e inúteis na prática.',
  ],
  glossary: [
    { term: 'Big-O', aliases: ['notação Big-O', 'big O', 'O grande', 'notação assintótica'], definition: 'Notação que dá um **limite superior** para o crescimento do custo de um algoritmo em função do tamanho da entrada `n`, ignorando constantes e termos de menor ordem.' },
    { term: 'Custo amortizado', aliases: ['amortizado', 'amortizada', 'análise amortizada'], definition: 'Custo **médio por operação** numa sequência longa, mesmo que uma operação isolada seja cara. Ex.: `list.append` às vezes realoca e copia o array inteiro, mas somando tudo sai `O(1)` por append.' },
    { term: 'Array dinâmico', aliases: ['arrays dinâmicos', 'dynamic array', 'dynamic arrays', 'vetor dinâmico'], definition: 'Array contíguo que cresce sozinho: quando enche, aloca um bloco maior e copia tudo. É a `list` do Python — índice em `O(1)`, `append` em `O(1)` amortizado, inserir ou remover no início em `O(n)`.' },
    { term: 'Algoritmo galáctico', aliases: ['algoritmos galácticos', 'galactic algorithm', 'galactic algorithms'], definition: 'Algoritmo com a melhor complexidade assintótica conhecida, mas com constantes tão grandes que só venceria em entradas maiores que qualquer dado real. Termo popularizado por Richard Lipton e Ken Regan.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Antes de qualquer problema de entrevista, precisamos falar a mesma língua: **Big-O**.',
        'Big-O descreve como o custo de um algoritmo **cresce** quando a entrada cresce. Não é tempo em segundos — é a forma da curva.',
      ],
      board: {
        title: 'O que é Big-O?',
        md: `**Big-O** é um limite superior para o crescimento do custo em função do tamanho da entrada \`n\`.

- Ignoramos **constantes**: \`O(2n)\` vira \`O(n)\`
- Ignoramos termos **menores**: \`O(n² + n)\` vira \`O(n²)\`
- Normalmente falamos do **pior caso**

> [!dica] Em entrevista, depois de toda solução, diga a complexidade de **tempo** e de **espaço** sem esperar o entrevistador perguntar.`,
      },
    },
    {
      type: 'say',
      text: [
        'Estas são as classes que mais aparecem. Decore a ordem — da mais rápida para a mais lenta.',
        'Com `n = 1.000.000`, um algoritmo `O(n log n)` faz uns 20 milhões de passos. Um `O(n²)` faria **um trilhão**.',
      ],
      board: {
        title: 'Classes de complexidade',
        md: `| Big-O | Nome | Exemplo | n = 10⁶ |
|---|---|---|---|
| \`O(1)\` | constante | acessar \`lista[i]\`, \`x in set\` | 1 |
| \`O(log n)\` | logarítmica | busca binária | ~20 |
| \`O(n)\` | linear | percorrer uma lista | 10⁶ |
| \`O(n log n)\` | linearítmica | \`sorted()\` | ~2·10⁷ |
| \`O(n²)\` | quadrática | dois \`for\` aninhados | 10¹² 😱 |
| \`O(2ⁿ)\` | exponencial | todos os subconjuntos | impossível |

> [!atencao] Regra prática: um computador faz ~10⁷–10⁸ operações simples por segundo em Python… bem menos que em C.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora a parte que pega muita gente: operações do Python que **parecem** O(1), mas não são.',
        '`x in lista` percorre a lista inteira. Já `x in conjunto` usa hash e é O(1) em média.',
        'E `lista.pop(0)` desloca todos os elementos. Para fila, use `collections.deque`.',
      ],
      board: {
        title: 'Custo das operações em Python',
        md: `| Operação | \`list\` | \`dict\` / \`set\` |
|---|---|---|
| acessar por índice/chave | \`O(1)\` | \`O(1)\` médio |
| \`x in ...\` | **\`O(n)\`** | \`O(1)\` médio |
| \`append\` / \`add\` | \`O(1)\` amortizado | \`O(1)\` médio |
| \`pop()\` do fim | \`O(1)\` | — |
| \`pop(0)\` / \`insert(0, x)\` | **\`O(n)\`** | — |
| \`remove(x)\`, \`index(x)\`, \`count(x)\` | **\`O(n)\`** | — |
| fatiar \`lista[a:b]\` | \`O(b - a)\` (copia!) | — |
| \`sorted()\` / \`.sort()\` | \`O(n log n)\` | — |

\`\`\`python
from collections import deque

fila = deque([1, 2, 3])
fila.popleft()     # O(1) — em vez de lista.pop(0), que é O(n)
\`\`\``,
      },
    },
    {
      type: 'say',
      text: [
        'Veja como isso muda tudo. Duas funções que detectam duplicatas: a primeira compara todos os pares, a segunda usa um `set`.',
        'Mesma resposta, mas com 100 mil elementos a primeira faz ~5 bilhões de comparações. A segunda, 100 mil.',
      ],
      board: {
        title: 'O(n²) vs O(n)',
        code: `def tem_duplicata_lenta(nums):          # O(n²) tempo, O(1) espaço
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                return True
    return False


def tem_duplicata_rapida(nums):         # O(n) tempo, O(n) espaço
    vistos = set()
    for x in nums:
        if x in vistos:                 # O(1) em média
            return True
        vistos.add(x)
    return False`,
        caption: 'Trocamos **memória** (o `set`) por **tempo** — o trade-off mais comum em entrevistas.',
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Espaço também conta. A complexidade de **espaço** mede a memória extra que o algoritmo usa, sem contar a entrada.',
        'E cuidado com a recursão: cada chamada ocupa espaço na pilha. Uma recursão de profundidade `n` usa `O(n)` de espaço.',
      ],
      board: {
        title: 'Complexidade de espaço',
        md: `\`\`\`python
def soma(nums):              # O(1) de espaço extra
    total = 0
    for x in nums:
        total += x
    return total


def quadrados(nums):         # O(n) de espaço: cria uma lista nova
    return [x * x for x in nums]


def soma_rec(nums, i=0):     # O(n) de espaço: n chamadas na pilha
    if i == len(nums):
        return 0
    return nums[i] + soma_rec(nums, i + 1)
\`\`\`

> [!dica] Loops **em sequência** somam (\`O(n) + O(n) = O(n)\`); loops **aninhados** multiplicam (\`O(n) · O(n) = O(n²)\`).`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma confissão antes dos exercícios: Big-O não conta a história toda.',
        'Ele esconde as **constantes** — e às vezes elas são astronômicas.',
      ],
      board: {
        title: 'Quando o Big-O engana',
        md: `Big-O descreve o **crescimento**, não a velocidade. Para \`n\` pequeno, constantes e hardware mandam:

| Situação | O que acontece |
|---|---|
| \`n\` pequeno | um \`O(n²)\` simples pode vencer um \`O(n log n)\` sofisticado |
| memória contígua | percorrer uma \`list\` aproveita o **cache** da CPU; saltar entre objetos espalhados, não |
| entrada quase ordenada | o **Timsort** do \`sorted()\` detecta trechos já ordenados e chega a \`O(n)\` |

> [!sabia] Existem **algoritmos galácticos**: os melhores no papel, mas com constantes tão grandes que nunca compensam aqui na Terra. Em 2019, Harvey e van der Hoeven mostraram como multiplicar inteiros de \`n\` dígitos em \`O(n log n)\` — só que o ganho só aparece para números com mais dígitos do que há átomos no universo observável. Na prática, o CPython multiplica inteiros grandes com **Karatsuba**, \`O(n^1.585)\`.

> [!dica] Em entrevista, o Big-O decide a abordagem. Em produção, **meça** (\`timeit\`, profiler) antes de otimizar.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Qual é a complexidade? Mostre que sabe analisar código.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-bigo-q1',
      concept: 'Loops aninhados',
      say: 'Aquecimento. Qual a complexidade de tempo?',
      prompt: `Qual a complexidade de **tempo** desta função?

\`\`\`python
def pares(nums):
    resultado = []
    for a in nums:
        for b in nums:
            resultado.append((a, b))
    return resultado
\`\`\``,
      options: [
        { text: '`O(n)`', why: 'Há um loop **dentro** do outro: para cada `a`, percorremos todos os `b`.' },
        { text: '`O(n²)`', correct: true, why: 'n iterações externas × n internas = n² pares.' },
        { text: '`O(n log n)`', why: 'Não há divisão pela metade nem ordenação aqui.' },
        { text: '`O(2n)`', why: '`O(2n)` seria dois loops em **sequência** (e simplifica para `O(n)`).' },
      ],
      explanation: 'Loops aninhados sobre a mesma entrada multiplicam: `n · n = O(n²)`. O espaço também é `O(n²)`, pois guardamos todos os pares.',
    },
    {
      type: 'order',
      id: 'lc-rx-bigo-q1',
      concept: 'Classes de complexidade',
      say: 'Rapidinho: lembra da ordem que eu pedi para decorar?',
      prompt: 'Ordene as classes de complexidade da **mais rápida** (cresce mais devagar) para a **mais lenta**, pensando em `n` grande.',
      items: ['`O(1)`', '`O(log n)`', '`O(n)`', '`O(n log n)`', '`O(n²)`', '`O(2ⁿ)`', '`O(n!)`'],
      explanation: 'Com `n = 20`: 1, ~4, 20, ~86, 400, ~10⁶ e ~2,4·10¹⁸ passos. Repare como `2ⁿ` (todos os subconjuntos) e `n!` (todas as permutações) explodem: backtracking que enumera tudo só é viável para `n` bem pequeno. Entre `O(n)` e `O(n log n)` a diferença é só um fator `log n` (~20 para um milhão).',
    },
    {
      type: 'mcq',
      id: 'lc-bigo-q2',
      concept: 'Complexidade logarítmica',
      say: 'Agora um loop diferente. Repara no que acontece com o `n`.',
      prompt: `Qual a complexidade de tempo?

\`\`\`python
def passos(n):
    contador = 0
    while n > 1:
        n //= 2
        contador += 1
    return contador
\`\`\``,
      options: [
        { text: '`O(n)`', why: 'O `n` não diminui de 1 em 1 — ele é **dividido por 2** a cada volta.' },
        { text: '`O(log n)`', correct: true, why: 'Quantas vezes dá para dividir n por 2 até chegar em 1? log₂ n vezes.' },
        { text: '`O(1)`', why: 'O número de voltas depende de `n`, então não é constante.' },
        { text: '`O(n²)`', why: 'Há um único loop, e ele encolhe a entrada pela metade.' },
      ],
      explanation: 'Sempre que o problema é **dividido pela metade** a cada passo, pense em `O(log n)`. É a base da busca binária.',
    },
    {
      type: 'mcq',
      id: 'lc-bigo-q3',
      concept: 'Custo de `x in list`',
      say: 'Essa é pegadinha clássica. Só tem um `for`… será?',
      prompt: `Qual a complexidade de tempo, sendo \`n = len(a) = len(b)\`?

\`\`\`python
def em_comum(a, b):
    comuns = []
    for x in a:
        if x in b:          # b é uma list
            comuns.append(x)
    return comuns
\`\`\``,
      options: [
        { text: '`O(n)` — só tem um loop.', why: '`x in b` com `b` sendo **lista** percorre a lista inteira: é um loop escondido.' },
        { text: '`O(n²)`', correct: true, why: 'n iterações × `O(n)` do `in` na lista = `O(n²)`.' },
        { text: '`O(n log n)`', why: 'Não há ordenação nem busca binária.' },
        { text: '`O(1)`', why: 'O custo claramente cresce com o tamanho das listas.' },
      ],
      explanation: '`x in list` é `O(n)`. Convertendo antes `b = set(b)` (custo `O(n)` uma vez), cada `in` vira `O(1)` e a função toda fica `O(n)`.',
    },
    {
      type: 'mcq',
      id: 'lc-bigo-q4',
      concept: 'deque vs list.pop(0)',
      say: 'Última de múltipla escolha. Pensa em como a lista é guardada na memória.',
      prompt: `Uma fila foi implementada assim. Processar \`n\` itens custa quanto?

\`\`\`python
fila = list(range(n))
while fila:
    item = fila.pop(0)
    processar(item)     # O(1)
\`\`\``,
      options: [
        { text: '`O(n)` — cada `pop` é `O(1)`.', why: 'Só `pop()` do **fim** é `O(1)`. `pop(0)` desloca todos os elementos restantes.' },
        { text: '`O(n²)` — trocar por `collections.deque` e `popleft()` deixa `O(n)`.', correct: true, why: 'Cada `pop(0)` é `O(n)`; `deque.popleft()` é `O(1)`.' },
        { text: '`O(n log n)` — a lista se reorganiza como um heap.', why: '`list` é um array dinâmico, não um heap.' },
        { text: '`O(n²)` — e não há como melhorar em Python.', why: 'Há sim: `collections.deque` foi feita exatamente para isso.' },
      ],
      explanation: 'A `list` do Python é um **array dinâmico**: remover do início obriga a mover todos os elementos. Para filas (BFS, por exemplo), use `deque`.',
    },
    {
      type: 'open',
      id: 'lc-bigo-q5',
      concept: 'Hash Set',
      say: 'Agora me explica com suas palavras, como numa entrevista.',
      prompt: 'Por que verificar `x in conjunto` (um `set`) é muito mais rápido que `x in lista`? Existe algum custo ou pior caso?',
      minWords: 15,
      rubric: [
        { label: 'Explica que o `set` usa **hash** para achar a posição do elemento', keywords: ['hash', 'espalhamento'], concept: 'Tabela hash', why: 'O hash do elemento indica diretamente onde procurar, sem varrer tudo.' },
        { label: 'Diz que a busca na lista é **linear / O(n)**', keywords: ['o(n)', 'linear', 'percorre', 'varre', ['cada', 'elemento']], concept: 'Busca linear', why: 'A lista compara elemento por elemento até achar.' },
        { label: 'Diz que no `set` a busca é **O(1) em média**', keywords: ['o(1)', 'constante'], concept: 'Big-O', why: 'Esse é o ganho principal.' },
        { label: 'Cita um custo: **memória extra**, **colisões** (pior caso O(n)) ou elementos precisarem ser **hasheáveis**', keywords: ['memoria', 'espaco', 'colis', 'pior caso', 'hashe', 'imutave'], concept: 'Trade-offs de hash', why: 'Em entrevista, mostrar o trade-off vale tanto quanto a resposta.' },
      ],
      modelAnswer: `O \`set\` é uma **tabela hash**: ao procurar \`x\`, o Python calcula \`hash(x)\` e vai direto à posição onde ele estaria. Isso é **O(1) em média**, independente do tamanho.

A lista não tem esse índice: \`x in lista\` compara elemento por elemento, uma **busca linear O(n)**.

Custos: o \`set\` gasta **memória extra**, só aceita elementos **hasheáveis** (imutáveis, como int, str, tuple) e, com muitas **colisões**, o pior caso degrada para O(n) — raro na prática.`,
    },
    {
      type: 'code',
      id: 'lc-bigo-q6',
      concept: 'Hash Set',
      title: 'Contains Duplicate',
      say: 'Hora de codar! Esse é o LeetCode 217. Tem teste de desempenho, então nada de comparar todos os pares.',
      prompt: `Implemente \`contains_duplicate(nums)\` que devolve \`True\` se algum valor aparece **pelo menos duas vezes** na lista, e \`False\` se todos forem distintos.

Objetivo: **\`O(n)\` de tempo**. Há um teste de desempenho com milhares de elementos.`,
      starter: `def contains_duplicate(nums):
    # Dica: qual estrutura responde "já vi esse número?" em O(1)?
    pass
`,
      tests: [
        { name: 'exemplo com duplicata', expr: 'contains_duplicate([1, 2, 3, 1])', expected: 'True' },
        { name: 'todos distintos', expr: 'contains_duplicate([1, 2, 3, 4])', expected: 'False' },
        { name: 'lista vazia', expr: 'contains_duplicate([])', expected: 'False' },
        { name: 'um elemento', expr: 'contains_duplicate([7])', expected: 'False' },
        { name: 'negativos', expr: 'contains_duplicate([-1, 5, -1])', expected: 'True' },
        { expr: 'contains_duplicate([1, 1, 1, 3, 3, 4, 3, 2, 4, 2])', expected: 'True', hidden: true },
        { expr: 'contains_duplicate([0, -0, 10])', expected: 'True', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.000, duplicata só no final',
          setup: 'nums = list(range(8000)) + [7999]',
          expr: 'contains_duplicate(nums)',
          expected: 'True',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Hash Set — busca O(1)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Loops aninhados comparando pares dão `O(n²)`. Um `set` com os valores já vistos resolve em uma passada.',
          concept: 'Hash Set',
        },
        {
          when: m => m.calls.includes('count') || m.calls.includes('index'),
          text: '`list.count`/`list.index` percorrem a lista inteira (`O(n)`); chamados para cada elemento, viram `O(n²)`.',
          concept: 'Custo de operações em list',
        },
        {
          when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
          text: 'Ordenar funciona, mas custa `O(n log n)`. Com um `set` dá para fazer em `O(n)`.',
          concept: 'Hash Set',
        },
      ],
      hints: [
        'Percorra a lista guardando os números já vistos numa estrutura com busca `O(1)`.',
        'Use um `set`: se `x in vistos`, achou a duplicata; senão, `vistos.add(x)`.',
        'Versão de uma linha: compare `len(set(nums))` com `len(nums)`.',
      ],
      solution: `def contains_duplicate(nums):
    vistos = set()
    for x in nums:
        if x in vistos:
            return True
        vistos.add(x)
    return False
`,
      solutionExplanation: '**Tempo `O(n)`**: cada `in` e `add` no `set` é `O(1)` em média. **Espaço `O(n)`** no pior caso (todos distintos). Retornar cedo ao achar a primeira duplicata ajuda na prática. A versão `len(set(nums)) != len(nums)` tem a mesma complexidade, mas sempre processa a lista toda.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Boa! Resumo: loops aninhados multiplicam, dividir pela metade dá `log n`, e operações como `in` em lista e `pop(0)` escondem um `O(n)`.',
        'Nos próximos módulos você vai usar isso o tempo todo. Sempre feche uma solução dizendo **tempo e espaço**!',
      ],
      board: null,
    },
  ],
});
