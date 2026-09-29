Game.registerModule('leetcode', {
  id: 'interview-pleno',
  title: 'Entrevista Pleno',
  kind: 'interview',
  level: 3,
  order: 91,
  unit: 'entrevistas',
  summary: 'Três problemas em sequência: Merge Intervals, Top K Frequent e Maximum Subarray (Kadane).',
  concepts: ['Ordenação', 'Heap', 'Bucket sort', 'Kadane', 'Programação dinâmica'],
  takeaways: [
    'Merge Intervals: **ordene pelo início** e estenda o último intervalo do resultado. `O(n log n)`, e o `max` no fim trata intervalos contidos.',
    'Top K Frequent: conte com `Counter` e escolha com um **heap de tamanho k** (`O(n log k)`) ou com **bucket sort** por frequência (`O(n)`).',
    'Em stream gigante, troque a contagem exata por estruturas aproximadas (**Count-Min Sketch**, Space-Saving) e combine os top-k parciais de cada partição.',
    '**Kadane**: em cada posição, continue o subarray ou recomece. Inicialize com `nums[0]` para não aceitar o subarray vazio quando tudo é negativo.',
    'No nível pleno, o diferencial é **comparar abordagens** e antecipar os casos de borda antes do entrevistador perguntar.',
  ],
  glossary: [
    { term: 'Timsort', aliases: ['Tim sort', 'Powersort', 'power sort'], definition: 'Algoritmo de ordenação **estável** e adaptativo criado por Tim Peters para o Python (2002): acha trechos já ordenados (*runs*) e os funde. É `O(n)` em entrada já ordenada e `O(n log n)` no pior caso. Desde o 3.11, o CPython decide a ordem das fusões com a política **Powersort**.' },
    { term: 'Ordenação estável', aliases: ['ordenações estáveis', 'sort estável', 'stable sort', 'ordenação estavel'], definition: 'Ordenação que mantém a **ordem original** dos elementos com chaves iguais. `sorted` e `list.sort` são estáveis, por isso dá para ordenar por vários critérios em passadas sucessivas, do menos para o mais importante.' },
    { term: 'Bucket sort', aliases: ['ordenação por baldes', 'bucket-sort', 'baldes por frequência'], definition: 'Distribui os itens em **baldes** indexados pela chave e depois lê os baldes em ordem. No Top K Frequent, a frequência vai de 1 a `n`, então ela vira o índice do balde: `O(n)` sem comparar elementos.' },
    { term: 'Algoritmo de Kadane', aliases: ['Kadane', "Kadane's algorithm", 'algoritmo Kadane'], definition: 'Resolve o subarray contíguo de soma máxima em `O(n)` e `O(1)` de espaço: o melhor subarray que **termina** em `i` é `max(nums[i], anterior + nums[i])`. É programação dinâmica com o estado compactado numa variável.' },
    { term: 'Count-Min Sketch', aliases: ['count-min', 'count min sketch', 'CM sketch'], definition: 'Estrutura probabilística (Cormode e Muthukrishnan, 2005) que estima frequências com memória fixa: vários contadores indexados por hashes diferentes, e a estimativa é o **mínimo** deles. Pode superestimar, nunca subestimar.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Bem-vindo(a) de volta. Hoje o nível sobe: esta é a entrevista para **pleno**.',
        'Serão **três problemas**. Espero que você escolha a abordagem certa rápido, escreva código limpo e discuta trade-offs nos follow-ups.',
        { text: 'Se travar, peça uma dica — em entrevista real isso é normal, só custa um pouco na avaliação. Vamos lá!', mood: 'happy' },
      ],
      board: {
        title: '🎤 Roteiro da entrevista',
        md: `1. **Merge Intervals** — ordenação + varredura
2. **Top K Frequent Elements** — contagem + heap/bucket
3. **Maximum Subarray** — Kadane (programação dinâmica)

> [!dica] Para pleno, o entrevistador espera que você **compare abordagens** (ex.: heap vs ordenação) e justifique a escolha.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Hoje vai ter ordenação e heap, e muita gente trata o `sorted` do Python como uma caixa-preta.',
        'Vale saber o que tem lá dentro: ajuda a justificar complexidade e estabilidade no follow-up.',
      ],
      board: {
        title: 'O que o sorted() faz por baixo',
        md: `- O \`sorted\` e o \`list.sort\` usam o **Timsort**, criado por Tim Peters para o Python em 2002: ele acha trechos já ordenados (*runs*) e os funde.
- Por isso é \`O(n)\` em entrada **já ordenada** e \`O(n log n)\` no pior caso.
- É uma **ordenação estável**: empates mantêm a ordem original.

\`\`\`python
pessoas = [("ana", 30), ("bia", 25), ("caio", 30)]
sorted(pessoas, key=lambda p: p[1])
# [('bia', 25), ('ana', 30), ('caio', 30)]  -> ana continua antes de caio
\`\`\`

> [!sabia] Em 2015, pesquisadores tentaram **provar formalmente** o Timsort do Java (ferramenta KeY) e acharam um bug na regra que decide quais *runs* fundir: com entradas construídas de propósito, a pilha interna de *runs* estourava. O CPython corrigiu a regra. No **Python 3.11**, trocou a política de fusão pela do **Powersort** (Munro e Wild, 2018), que tem garantia teórica de fusões quase ótimas. O Timsort também é usado pelo Java (objetos), pelo Android e pelo V8.`,
      },
    },
    {
      type: 'section',
      title: 'Problema 1',
      subtitle: 'Merge Intervals (LeetCode 56)',
      icon: '📅',
      text: 'Primeiro problema: intervalos.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Você recebe uma lista de intervalos `[inicio, fim]`, **fora de ordem**. Junte todos os que se sobrepõem.',
        'Pense em reuniões na agenda: se uma começa antes da outra terminar, elas viram um bloco só.',
      ],
      board: {
        title: 'Merge Intervals',
        md: `\`\`\`text
entrada: [[1, 3], [8, 10], [2, 6], [15, 18]]
saída:   [[1, 6], [8, 10], [15, 18]]

[1,3] e [2,6] se sobrepõem -> [1,6]
\`\`\`

- Intervalos que só **encostam** também juntam: \`[1, 4]\` e \`[4, 5]\` → \`[1, 5]\`.
- A saída deve vir **ordenada** pelo início.`,
      },
    },
    {
      type: 'mcq',
      id: 'lc-ip-q1',
      concept: 'Ordenação',
      say: 'Qual o primeiro passo?',
      prompt: 'Qual estratégia resolve Merge Intervals de forma eficiente?',
      options: [
        { text: 'Comparar cada intervalo com todos os outros e juntar até não haver mudanças.', why: 'Funciona, mas é `O(n²)` ou pior, e é fácil errar.' },
        { text: 'Ordenar pelo **início** e percorrer uma vez, estendendo o último intervalo do resultado quando houver sobreposição.', correct: true, why: 'Depois de ordenar, só o último intervalo do resultado pode se sobrepor ao atual.' },
        { text: 'Ordenar pelo **fim** e usar busca binária para cada intervalo.', why: 'Ordenar pelo fim não garante que os sobrepostos fiquem adjacentes da forma que precisamos.' },
        { text: 'Colocar todos os pontos num `set` e reconstruir os intervalos.', why: 'Intervalos podem ser enormes (ex.: `[0, 10⁹]`) e isso não diferencia `[1,2],[3,4]` de `[1,4]`.' },
      ],
      explanation: 'Ordenando por início, intervalos que se sobrepõem ficam **adjacentes**. Uma varredura linear basta: `O(n log n)` pela ordenação.',
    },
    {
      type: 'code',
      id: 'lc-ip-q2',
      concept: 'Ordenação',
      title: 'merge',
      say: 'Pode implementar. Cuidado com intervalos contidos em outros, tipo `[1, 10]` e `[2, 3]`.',
      prompt: `Implemente \`merge(intervals)\` que recebe uma lista de intervalos \`[inicio, fim]\` (em qualquer ordem) e devolve a lista de intervalos **mesclados**, **ordenada** pelo início. Cada intervalo da saída deve ser uma **lista** \`[inicio, fim]\`.

Objetivo: **\`O(n log n)\`**.`,
      starter: `def merge(intervals):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'merge([[1, 3], [2, 6], [8, 10], [15, 18]])', expected: '[[1, 6], [8, 10], [15, 18]]' },
        { name: 'encostados', expr: 'merge([[1, 4], [4, 5]])', expected: '[[1, 5]]' },
        { name: 'lista vazia', expr: 'merge([])', expected: '[]' },
        { name: 'um intervalo', expr: 'merge([[1, 4]])', expected: '[[1, 4]]' },
        { name: 'fora de ordem', expr: 'merge([[8, 10], [1, 3], [2, 6]])', expected: '[[1, 6], [8, 10]]' },
        { name: 'contido em outro', expr: 'merge([[1, 10], [2, 3]])', expected: '[[1, 10]]' },
        { expr: 'merge([[1, 4], [0, 0]])', expected: '[[0, 0], [1, 4]]', hidden: true },
        { expr: 'merge([[2, 3], [4, 5], [6, 7], [1, 10]])', expected: '[[1, 10]]', hidden: true },
        { expr: 'merge([[-5, -1], [-3, 2], [3, 3]])', expected: '[[-5, 2], [3, 3]]', hidden: true },
      ],
      perfTests: [
        {
          name: '6.000 intervalos disjuntos, em ordem reversa',
          setup: 'intervals = [[i * 2, i * 2 + 1] for i in range(6000)][::-1]',
          expr: 'merge(intervals)',
          expected: '[[i * 2, i * 2 + 1] for i in range(6000)]',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Ordenar + varredura linear',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Comparar cada intervalo com todos os outros é `O(n²)`. Depois de ordenar pelo início, só o **último** intervalo do resultado pode se sobrepor ao atual.',
          concept: 'Ordenação',
        },
        {
          when: (m, code) => /pop\s*\(\s*0\s*\)|insert\s*\(\s*0/.test(code),
          text: '`pop(0)`/`insert(0, ...)` custam `O(n)` numa lista. Percorra com `for` e trabalhe no fim do resultado (`resultado[-1]`).',
          concept: 'Custo de operações em list',
        },
      ],
      hints: [
        'Ordene por início: `intervals.sort(key=lambda x: x[0])` (ou `sorted(...)`).',
        'Percorra os intervalos: se o resultado está vazio ou o atual começa **depois** do fim do último, adicione uma cópia do atual.',
        'Senão, há sobreposição: `resultado[-1][1] = max(resultado[-1][1], fim)`. O `max` cobre intervalos contidos.',
      ],
      solution: `def merge(intervals):
    resultado = []
    for inicio, fim in sorted(intervals, key=lambda x: x[0]):
        if resultado and inicio <= resultado[-1][1]:
            resultado[-1][1] = max(resultado[-1][1], fim)
        else:
            resultado.append([inicio, fim])
    return resultado
`,
      solutionExplanation: 'Ordenar custa `O(n log n)` e a varredura `O(n)`: **tempo `O(n log n)`**, **espaço `O(n)`** para a saída. Criar `[inicio, fim]` novo evita modificar a entrada; o `max` no fim trata intervalos contidos (`[1, 10]` e `[2, 3]`).',
    },
    {
      type: 'section',
      title: 'Problema 2',
      subtitle: 'Top K Frequent Elements (LeetCode 347)',
      icon: '🏆',
      text: 'Ótimo. Segundo problema: frequências.',
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Dada uma lista de inteiros e um `k`, devolva os **k elementos mais frequentes**.',
        'O LeetCode pede algo **melhor que `O(n log n)`**. Pense em como contar e depois como escolher os k maiores sem ordenar tudo.',
      ],
      board: {
        title: 'Top K Frequent Elements',
        md: `\`\`\`text
nums = [1, 1, 1, 2, 2, 3], k = 2  ->  [1, 2]
\`\`\`

| Abordagem | Tempo |
|---|---|
| Contar + ordenar tudo por frequência | \`O(n log n)\` |
| Contar + **heap** de tamanho k (\`heapq.nlargest\`) | \`O(n log k)\` |
| Contar + **bucket sort** por frequência | \`O(n)\` |

\`\`\`python
import heapq
heapq.nlargest(2, [5, 1, 9, 3])   # [9, 5]
\`\`\``,
      },
    },
    {
      type: 'code',
      id: 'lc-ip-q3',
      concept: 'Heap',
      title: 'top_k_frequent',
      say: 'Pode codar. Qualquer ordem de saída serve.',
      prompt: `Implemente \`top_k_frequent(nums, k)\` que devolve os \`k\` elementos **mais frequentes** de \`nums\`, em qualquer ordem.

- A resposta é garantidamente **única**.
- Objetivo: **melhor que \`O(n²)\`** — idealmente \`O(n log k)\` com heap ou \`O(n)\` com bucket sort.`,
      starter: `def top_k_frequent(nums, k):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'top_k_frequent([1, 1, 1, 2, 2, 3], 2)', expected: '[1, 2]', compare: 'sorted' },
        { name: 'um elemento', expr: 'top_k_frequent([1], 1)', expected: '[1]', compare: 'sorted' },
        { name: 'negativos', expr: 'top_k_frequent([4, 4, -1, -1, -1, 2], 1)', expected: '[-1]', compare: 'sorted' },
        { name: 'k = 2', expr: 'top_k_frequent([5, 5, 6, 6, 6, 7], 2)', expected: '[5, 6]', compare: 'sorted' },
        { expr: 'top_k_frequent([3, 0, 1, 0], 1)', expected: '[0]', compare: 'sorted', hidden: true },
        { expr: 'top_k_frequent([9, 8, 7], 3)', expected: '[7, 8, 9]', compare: 'sorted', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 20.000, quase todos distintos',
          setup: 'nums = list(range(20000)) + [7] * 3 + [42] * 2',
          expr: 'top_k_frequent(nums, 2)',
          expected: '[7, 42]',
          compare: 'sorted',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Counter + heap / bucket sort',
      reviews: [
        {
          when: m => m.calls.includes('count'),
          text: '`nums.count(x)` percorre a lista inteira; chamado para cada elemento, vira `O(n²)`. Conte tudo numa passada com `Counter`.',
          concept: 'Counter',
        },
        {
          when: m => m.loopDepth >= 2 && !m.calls.includes('Counter') && !m.calls.includes('get') && !m.imports.includes('heapq'),
          text: 'Loops aninhados para contar/selecionar tendem a `O(n²)`. Conte com `Counter` e selecione com `heapq.nlargest` ou buckets.',
          concept: 'Heap',
        },
      ],
      hints: [
        'Primeiro conte as frequências: `Counter(nums)`.',
        'Para pegar os k mais frequentes sem ordenar tudo: `heapq.nlargest(k, contagem, key=contagem.get)`.',
        'Alternativa `O(n)`: bucket sort — uma lista de listas indexada pela frequência (de 0 a n).',
      ],
      solution: `import heapq
from collections import Counter


def top_k_frequent(nums, k):
    contagem = Counter(nums)
    return heapq.nlargest(k, contagem, key=contagem.get)
`,
      solutionExplanation: '`Counter` conta em `O(n)`. `heapq.nlargest` mantém um heap de tamanho k: `O(u log k)`, com u = valores distintos. **Total `O(n log k)`**, **espaço `O(n)`**. `Counter(nums).most_common(k)` também funciona. Para `O(n)`: bucket sort, onde `buckets[f]` guarda os valores com frequência `f`, percorrido do maior para o menor.',
    },
    {
      type: 'open',
      id: 'lc-ip-q4',
      concept: 'Heap',
      say: 'Follow-up clássico de pleno. Imagine escala de verdade.',
      prompt: 'E se `nums` fosse um **fluxo (stream)** gigante de eventos — por exemplo, as hashtags mais usadas no último dia — que não cabe todo na memória? Como você adaptaria a solução?',
      minWords: 20,
      rubric: [
        { label: 'Usar um **heap de tamanho k** (min-heap) para manter só os candidatos', keywords: ['heap', 'fila de prioridade', 'priority queue', 'heapq'], concept: 'Heap', why: 'O heap mantém os k maiores com memória `O(k)` e atualização `O(log k)`.' },
        { label: 'Processar em **fluxo/incremental**, atualizando contagens conforme os eventos chegam', keywords: ['stream', 'fluxo', 'increment', 'conforme chega', 'tempo real', 'janela', 'sliding'], concept: 'Processamento em stream', why: 'Não dá para reler tudo a cada consulta.' },
        { label: 'Lidar com **memória**: estruturas **aproximadas** (Count-Min Sketch, Space-Saving) ou limitar o que é guardado', keywords: ['aproximad', 'count-min', 'count min', 'sketch', 'space-saving', 'space saving', 'probabilist', 'memoria'], concept: 'Estruturas probabilísticas', why: 'Com cardinalidade enorme, contar tudo exatamente não cabe na memória.' },
        { label: 'Distribuir: **particionar/shardear** por chave e combinar os top-k parciais (map-reduce)', keywords: ['particion', 'shard', 'distribu', 'map-reduce', 'map reduce', 'mapreduce', 'varias maquinas', 'combinar', 'merge'], concept: 'Sistemas distribuídos', why: 'Em escala real, a contagem é dividida entre máquinas.' },
      ],
      modelAnswer: `Eu processaria os eventos **em fluxo**, atualizando contagens de forma **incremental**, e manteria um **min-heap de tamanho k** com os candidatos: cada atualização custa \`O(log k)\` e a memória do heap é \`O(k)\`.

O problema é que contar **todas** as chaves pode não caber na memória. Aí uso estruturas **aproximadas**: um **Count-Min Sketch** (contagem aproximada com memória fixa) junto com o heap, ou o algoritmo **Space-Saving**. Para "último dia", uso **janelas de tempo** (buckets por hora que expiram).

Em escala maior, **particiono** os eventos por hash da chave entre várias máquinas; cada uma calcula seu top-k local e um agregador faz o **merge** dos top-k parciais (estilo map-reduce).`,
    },
    {
      type: 'section',
      title: 'Problema 3',
      subtitle: 'Maximum Subarray (LeetCode 53)',
      icon: '📊',
      text: 'Último problema. Esse é um clássico de programação dinâmica.',
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Encontre o **subarray contíguo** com a **maior soma** e devolva essa soma.',
        'A ideia do **algoritmo de Kadane**: em cada posição, vale mais a pena **continuar** o subarray anterior ou **começar de novo** aqui?',
      ],
      board: {
        title: 'Maximum Subarray — Kadane',
        md: `\`\`\`text
nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]
                   [4, -1, 2, 1]  ->  soma 6
\`\`\`

**Recorrência:** \`melhor_terminando_em[i] = max(nums[i], melhor_terminando_em[i-1] + nums[i])\`

Se a soma acumulada ficou **negativa**, ela só atrapalha: é melhor recomeçar.

> [!atencao] Se todos os números forem negativos, a resposta é o **maior** deles — não \`0\`.`,
      },
    },
    {
      type: 'code',
      id: 'lc-ip-q5',
      concept: 'Kadane',
      title: 'max_sub_array',
      say: 'Pode implementar. Lembre do caso com todos negativos!',
      prompt: `Implemente \`max_sub_array(nums)\` que devolve a **maior soma** de um subarray **contíguo e não vazio** de \`nums\`.

- \`nums\` tem pelo menos 1 elemento.
- Objetivo: **\`O(n)\` de tempo e \`O(1)\` de espaço** (Kadane).`,
      starter: `def max_sub_array(nums):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'max_sub_array([-2, 1, -3, 4, -1, 2, 1, -5, 4])', expected: '6' },
        { name: 'um elemento', expr: 'max_sub_array([1])', expected: '1' },
        { name: 'tudo positivo', expr: 'max_sub_array([5, 4, -1, 7, 8])', expected: '23' },
        { name: 'todos negativos', expr: 'max_sub_array([-3, -1, -2])', expected: '-1' },
        { expr: 'max_sub_array([-1])', expected: '-1', hidden: true },
        { expr: 'max_sub_array([2, -1, 2])', expected: '3', hidden: true },
        { expr: 'max_sub_array([-2, -3, 4, -1, -2, 1, 5, -3])', expected: '7', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 6.000',
          setup: 'nums = [((i * 7919) % 201) - 100 for i in range(6000)]\ndef _ref(a):\n    cur = best = a[0]\n    for x in a[1:]:\n        cur = max(x, cur + x); best = max(best, cur)\n    return best',
          expr: 'max_sub_array(nums)',
          expected: '_ref(nums)',
          maxMs: 120,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Kadane — programação dinâmica em O(n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Testar todos os subarrays com loops aninhados é `O(n²)` (ou `O(n³)` com `sum`). Kadane decide em `O(1)` por posição se continua ou recomeça.',
          concept: 'Kadane',
        },
        {
          when: (m, code) => /\bfor\b[\s\S]*\bsum\s*\(/.test(code),
          text: 'Chamar `sum()` sobre fatias dentro do loop recalcula somas já conhecidas. Mantenha uma soma corrente.',
          concept: 'Programação dinâmica',
        },
        {
          when: (m, code) => /(melhor|best|maximo|max_sum|resposta)\s*=\s*0\b/.test(code),
          text: 'Inicializar o melhor com `0` falha quando todos são negativos (a resposta seria `0`, mas o subarray não pode ser vazio). Comece com `nums[0]`.',
          concept: 'Casos de borda',
        },
      ],
      hints: [
        'Mantenha duas variáveis: `atual` (melhor soma **terminando** na posição atual) e `melhor` (melhor soma vista).',
        'Para cada `x`: `atual = max(x, atual + x)` — continuar ou recomeçar.',
        'Inicialize ambos com `nums[0]` e percorra a partir do segundo elemento.',
      ],
      solution: `def max_sub_array(nums):
    atual = melhor = nums[0]
    for x in nums[1:]:
        atual = max(x, atual + x)
        melhor = max(melhor, atual)
    return melhor
`,
      solutionExplanation: '`atual` é o melhor subarray que **termina** em cada posição: ou estende o anterior, ou recomeça em `x`. **Tempo `O(n)`**, **espaço `O(1)`** (a fatia `nums[1:]` pode ser trocada por índices para não copiar). É programação dinâmica com o estado compactado em uma variável.',
    },
    {
      type: 'mcq',
      id: 'lc-ip-q6',
      concept: 'Casos de borda',
      say: 'Follow-up final: ache o bug.',
      prompt: `Esta versão de Kadane passa no exemplo do enunciado. Em que entrada ela **falha**?

\`\`\`python
def max_sub_array(nums):
    atual = melhor = 0
    for x in nums:
        atual = max(0, atual + x)
        melhor = max(melhor, atual)
    return melhor
\`\`\``,
      options: [
        { text: '`[5, 4, -1, 7, 8]`', why: 'Com positivos ela acerta: 23.' },
        { text: '`[-3, -1, -2]`', correct: true, why: 'Ela devolve `0` (subarray vazio), mas a resposta é `-1`.' },
        { text: '`[1]`', why: 'Devolve 1, correto.' },
        { text: '`[-2, 1, -3, 4, -1, 2, 1, -5, 4]`', why: 'É o exemplo do enunciado, e ela devolve 6.' },
      ],
      explanation: 'Zerar a soma com `max(0, ...)` e começar em `0` equivale a permitir o subarray **vazio**. Quando todos os números são negativos, a resposta correta é o maior deles. Por isso inicializamos com `nums[0]`.',
    },
    {
      type: 'match',
      id: 'lc-rx2-ip-q7',
      concept: 'Trade-offs de abordagem',
      say: 'Pra fechar, um bate-bola: qual é a sacada de cada abordagem de hoje?',
      prompt: 'Associe cada abordagem à **ideia-chave** que a faz funcionar.',
      pairs: [
        { left: 'Merge Intervals ordenando pelo início', right: 'Sobrepostos ficam adjacentes; basta olhar o último' },
        { left: 'Top K com heap de tamanho k', right: 'Um min-heap descarta o menor candidato: `O(n log k)`' },
        { left: 'Top K com bucket sort', right: 'A frequência nunca passa de `n`: vira índice de balde' },
        { left: 'Top K num stream gigante', right: 'Count-Min Sketch + heap, com memória fixa' },
        { left: 'Kadane', right: 'Soma acumulada negativa só atrapalha: recomece' },
      ],
      explanation: 'Cada padrão tem uma **observação** que corta trabalho: a ordenação deixa a sobreposição local, o heap limita a memória a `k`, o bucket troca comparação por indexação, o sketch troca exatidão por memória fixa, e Kadane descarta prefixos negativos. Saber dizer essa sacada em uma frase é o que convence no nível pleno.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'E é isso! Três problemas, três padrões: **ordenar + varrer**, **contar + heap**, e **Kadane**.',
        { text: 'Feedback: nesse nível, o diferencial é discutir trade-offs — heap vs bucket, memória em streams, e casos de borda antes do entrevistador perguntar.', mood: 'neutral' },
        { text: 'Parabéns por chegar até aqui. Revise os conceitos marcados no seu review e tente de novo pelas 3 estrelas!', mood: 'happy' },
      ],
      board: null,
    },
  ],
});
