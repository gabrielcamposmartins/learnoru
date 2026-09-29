Game.registerModule('leetcode', {
  id: 'binary-search',
  title: 'Busca Binária',
  kind: 'lesson',
  level: 2,
  order: 21,
  unit: 'estruturas',
  summary: 'Descartar metade a cada passo: O(log n), invariantes e o módulo bisect.',
  concepts: ['Busca binária', 'O(log n)', 'Invariante', 'bisect'],
  takeaways: [
    'Busca binária exige entrada **ordenada** ou, no caso geral, um **predicado monotônico** (falso… falso… verdadeiro… verdadeiro).',
    'Fixe um **invariante** sobre `[lo, hi]` e **exclua o `mid`** a cada passo (`mid + 1` / `mid - 1`). Sem isso, o intervalo para de encolher e o loop não termina.',
    'Quando o alvo não existe, `lo` termina na **posição de inserção**, o mesmo valor que `bisect_left` devolve.',
    '`bisect_left` = primeira posição com valor **≥ x**; `bisect_right` = primeira com valor **> x**. A diferença entre os dois conta quantas vezes `x` aparece.',
    'Teste lista vazia, 1 e 2 elementos, e alvo antes do primeiro e depois do último: é onde moram os **off-by-one**.',
  ],
  glossary: [
    { term: 'Predicado monotônico', aliases: ['predicados monotônicos', 'condição monotônica', 'condições monotônicas', 'monotonic predicate'], definition: 'Condição que, ao longo do espaço de busca, muda **uma única vez** (falso… falso… verdadeiro… verdadeiro). É o que a busca binária realmente precisa: ela acha a fronteira em `O(log n)`, mesmo sem uma lista ordenada.' },
    { term: 'Off-by-one', aliases: ['off by one', 'erro off-by-one', 'erros off-by-one', 'erro de um a mais'], definition: 'Erro de limite em que um índice ou contagem fica **um a mais ou um a menos**: `<` no lugar de `<=`, `mid` no lugar de `mid + 1`. É o bug mais comum em busca binária e em laços com fatias.' },
    { term: 'Overflow de inteiro', aliases: ['integer overflow', 'estouro de inteiro', 'overflow de inteiros'], definition: 'Quando uma conta passa do maior valor que um inteiro de tamanho fixo guarda (ex.: 2³¹ − 1 em Java) e "dá a volta" para um número negativo. Os `int` do Python têm precisão arbitrária e não sofrem disso.' },
    { term: 'Busca exponencial', aliases: ['exponential search', 'galloping', 'galloping search', 'busca galopante', 'galope'], definition: 'Testa as posições 1, 2, 4, 8… até passar do alvo e então faz busca binária só nesse trecho. Custa `O(log i)`, onde `i` é a posição do alvo; serve para listas enormes ou sem tamanho conhecido e é usada no *galloping mode* do Timsort.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Sabe aquele jogo de adivinhar um número de 1 a 100 com "maior" ou "menor"? Você chuta o meio e descarta **metade**.',
        'Isso é **busca binária**. Com 1 milhão de elementos, bastam uns **20 passos**. Mas só funciona se os dados estiverem **ordenados**.',
      ],
      board: {
        title: 'Busca binária',
        md: `**Pré-requisito:** a entrada é **ordenada** (ou, mais geral, a condição é **monotônica**: falsa… falsa… verdadeira… verdadeira).

**Ideia:** olhar o elemento do meio e descartar a metade onde a resposta não pode estar.

| n | passos (≈ log₂ n) |
|---|---|
| 1.000 | 10 |
| 1.000.000 | 20 |
| 1.000.000.000 | 30 |

> [!atencao] \`x in lista\` e \`lista.index(x)\` são \`O(n)\`: eles **não** sabem que a lista está ordenada.`,
      },
    },
    {
      type: 'say',
      text: [
        'Este é o molde que eu recomendo decorar. O segredo é o **invariante**: se o alvo existe, ele está sempre entre `lo` e `hi`.',
        'Com `while lo <= hi`, atualizamos com `mid + 1` e `mid - 1` — assim o intervalo sempre encolhe e não há loop infinito.',
      ],
      board: {
        title: 'O molde clássico',
        code: `def busca_binaria(nums, alvo):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:                 # intervalo [lo, hi] ainda não vazio
        mid = (lo + hi) // 2
        if nums[mid] == alvo:
            return mid
        if nums[mid] < alvo:
            lo = mid + 1            # alvo está à direita
        else:
            hi = mid - 1            # alvo está à esquerda
    return -1                       # não encontrado

# nums = [1, 3, 5, 7, 9, 11], alvo = 9
# lo=0 hi=5 mid=2 (5 < 9)  -> lo=3
# lo=3 hi=5 mid=4 (9 == 9) -> 4`,
        caption: 'Em Python não há overflow de inteiros, então `(lo + hi) // 2` é seguro.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Quando o loop termina sem achar, `lo` para exatamente onde o alvo **deveria ser inserido** para manter a ordem.',
        'E no dia a dia, o Python já tem isso pronto no módulo `bisect`. Em entrevista, porém, geralmente pedem para você implementar.',
      ],
      board: {
        title: 'O módulo bisect',
        code: `import bisect

nums = [1, 3, 3, 3, 7]
bisect.bisect_left(nums, 3)    # 1 -> primeira posição onde 3 pode entrar
bisect.bisect_right(nums, 3)   # 4 -> depois do último 3
bisect.bisect_left(nums, 5)    # 4 -> posição de inserção do 5

bisect.insort(nums, 5)         # insere mantendo a ordem
print(nums)                    # [1, 3, 3, 3, 5, 7]`,
        caption: '`bisect_left` = primeira posição com valor **≥ x**. `bisect_right` = primeira posição com valor **> x**.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Parece fácil, né? Pois a busca binária tem uma das histórias de bugs mais famosas da computação.',
        'Até a versão da biblioteca padrão do Java ficou **quase uma década** com um bug escondido.',
      ],
      board: {
        title: 'A busca binária é traiçoeira',
        md: `- Segundo Knuth, a primeira busca binária publicada é de **1946**, mas a primeira versão que funcionava para **qualquer** tamanho de lista só saiu em **1960** (D. H. Lehmer).
- Jon Bentley, em *Programming Pearls*, conta que pediu a programadores profissionais para escreverem uma busca binária: cerca de **90%** entregaram código com bug.
- Em **2006**, Joshua Bloch mostrou que o \`java.util.Arrays.binarySearch\` quebrava com arrays enormes:

\`\`\`text
int mid = (low + high) / 2;          // low + high passa de 2^31 - 1 -> vira negativo
int mid = low + (high - low) / 2;    // correção: nunca estoura
\`\`\`

> [!sabia] Esse bug de **overflow de inteiro** ficou uns 9 anos no JDK, e o próprio *Programming Pearls* tinha a mesma linha. Em Python, \`(lo + hi) // 2\` é seguro, porque \`int\` não tem tamanho fixo. Mas o erro volta ao portar o código para Java, C, Go ou NumPy com \`int32\`. Outra variante pouco conhecida é a **busca exponencial** (*galloping*): testa as posições 1, 2, 4, 8… e só depois faz a busca binária no trecho certo. O Timsort do Python usa essa ideia ao fundir sequências.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Implemente a busca binária de verdade.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-bs-q1',
      concept: 'O(log n)',
      say: 'Conta rápida!',
      prompt: 'Numa lista **ordenada** com cerca de **1.000.000** de elementos, quantas comparações a busca binária faz, no máximo, aproximadamente?',
      options: [
        { text: '≈ 20', correct: true, why: '2²⁰ ≈ 1.048.576, então ~20 divisões por 2 esgotam a lista.' },
        { text: '≈ 1.000', why: 'Isso seria √n — não é o caso da busca binária.' },
        { text: '≈ 500.000', why: 'Essa é a média de uma busca **linear**.' },
        { text: '≈ 1.000.000', why: 'Esse é o pior caso da busca **linear**.' },
      ],
      explanation: 'Cada passo corta o intervalo pela metade: `log₂(1.000.000) ≈ 20`. É por isso que `O(log n)` é quase tão bom quanto `O(1)`.',
    },
    {
      type: 'code',
      id: 'lc-bs-q2',
      concept: 'Busca binária',
      title: 'Binary Search',
      say: 'LeetCode 704. Implemente na mão, sem `bisect` e sem `in`. O teste de desempenho faz mil buscas seguidas.',
      prompt: `Dada uma lista \`nums\` **ordenada em ordem crescente** (sem repetidos), implemente \`search(nums, target)\` que devolve o **índice** de \`target\`, ou \`-1\` se ele não existir.

- Objetivo: **\`O(log n)\`**.
- Não use \`in\`, \`.index()\` nem o módulo \`bisect\` — a ideia é implementar a busca.`,
      starter: `def search(nums, target):
    lo, hi = 0, len(nums) - 1
    pass
`,
      tests: [
        { name: 'encontrado', expr: 'search([-1, 0, 3, 5, 9, 12], 9)', expected: '4' },
        { name: 'não encontrado', expr: 'search([-1, 0, 3, 5, 9, 12], 2)', expected: '-1' },
        { name: 'lista vazia', expr: 'search([], 1)', expected: '-1' },
        { name: 'um elemento (achou)', expr: 'search([5], 5)', expected: '0' },
        { name: 'um elemento (não achou)', expr: 'search([5], -5)', expected: '-1' },
        { expr: 'search([-1, 0, 3, 5, 9, 12], -1)', expected: '0', hidden: true },
        { expr: 'search([-1, 0, 3, 5, 9, 12], 12)', expected: '5', hidden: true },
        { expr: 'search([-1, 0, 3, 5, 9, 12], 13)', expected: '-1', hidden: true },
      ],
      perfTests: [
        {
          name: '1.000 buscas em 50.000 elementos',
          setup: 'nums = list(range(0, 100000, 2))',
          expr: 'sum(search(nums, t) for t in range(0, 100000, 100))',
          expected: 'sum(t // 2 for t in range(0, 100000, 100))',
          maxMs: 60,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Busca binária — O(log n)',
      reviews: [
        {
          when: (m, code) => m.calls.includes('index') || /\bif\b[^\n]*\bin\s+nums\b|\breturn\b[^\n]*\bin\s+nums\b/.test(code),
          text: '`in` e `.index()` fazem busca **linear** (`O(n)`) e ignoram que a lista está ordenada. Compare com o elemento do meio e descarte metade.',
          concept: 'Busca binária',
        },
        {
          when: m => m.imports.includes('bisect'),
          text: 'Conhecer `bisect` é ótimo no dia a dia, mas aqui a entrevista pede a implementação. Saiba escrever o loop com `lo`, `hi` e `mid`.',
          concept: 'bisect',
        },
        {
          when: m => m.recursion,
          text: 'A versão recursiva funciona, mas usa `O(log n)` de pilha e fatiar a lista (`nums[mid:]`) custaria `O(n)`. A versão iterativa usa `O(1)` de espaço.',
          concept: 'Complexidade de espaço',
        },
      ],
      hints: [
        'Enquanto `lo <= hi`, calcule `mid = (lo + hi) // 2` e compare `nums[mid]` com `target`.',
        'Se `nums[mid] < target`, a resposta só pode estar à direita: `lo = mid + 1`. Senão, `hi = mid - 1`.',
        'Se sair do loop sem encontrar, devolva `-1`.',
      ],
      solution: `def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
      solutionExplanation: 'O intervalo `[lo, hi]` cai pela metade a cada volta: **tempo `O(log n)`**, **espaço `O(1)`**. Usar `mid + 1` e `mid - 1` garante que o intervalo sempre encolhe — sem loop infinito.',
    },
    {
      type: 'mcq',
      id: 'lc-bs-q3',
      concept: 'Invariante',
      say: 'Achar o bug é metade da entrevista. Onde está o problema?',
      prompt: `Este código às vezes **nunca termina**. Por quê?

\`\`\`python
def busca(nums, alvo):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == alvo:
            return mid
        if nums[mid] < alvo:
            lo = mid
        else:
            hi = mid - 1
    return -1
\`\`\``,
      options: [
        { text: 'Porque `(lo + hi) // 2` pode estourar o inteiro.', why: 'Em Python inteiros não estouram.' },
        { text: 'Porque `lo = mid` pode não mover `lo`; quando `lo == mid`, o intervalo para de encolher.', correct: true, why: 'Ex.: `nums=[1, 3]`, `alvo=5`: `lo=0, hi=1, mid=0` → `lo=0` para sempre.' },
        { text: 'Porque deveria ser `while lo < hi`.', why: 'Com `lo = mid + 1`, o `<=` é o correto para esse molde.' },
        { text: 'Porque falta ordenar `nums` antes.', why: 'A lista já é pressuposta ordenada; o problema é a atualização dos limites.' },
      ],
      explanation: 'Todo passo precisa **excluir** o `mid` já testado: `lo = mid + 1` ou `hi = mid - 1`. Caso contrário, com dois elementos o `mid` pode repetir e o loop não termina.',
    },
    {
      type: 'code',
      id: 'lc-bs-q4',
      concept: 'Busca binária',
      title: 'Search Insert Position',
      say: 'LeetCode 35. Se não achar, onde ele deveria entrar? Lembra onde o `lo` para!',
      prompt: `Dada uma lista \`nums\` **ordenada** (sem repetidos), implemente \`search_insert(nums, target)\` que devolve o índice de \`target\` se ele existir; caso contrário, o índice onde ele **seria inserido** para manter a ordem.

- \`search_insert([1, 3, 5, 6], 2)\` → \`1\`
- Objetivo: **\`O(log n)\`**, sem \`bisect\`.`,
      starter: `def search_insert(nums, target):
    pass
`,
      tests: [
        { name: 'existe', expr: 'search_insert([1, 3, 5, 6], 5)', expected: '2' },
        { name: 'no meio', expr: 'search_insert([1, 3, 5, 6], 2)', expected: '1' },
        { name: 'depois do fim', expr: 'search_insert([1, 3, 5, 6], 7)', expected: '4' },
        { name: 'antes do início', expr: 'search_insert([1, 3, 5, 6], 0)', expected: '0' },
        { name: 'lista vazia', expr: 'search_insert([], 3)', expected: '0' },
        { expr: 'search_insert([1, 3, 5, 6], 6)', expected: '3', hidden: true },
        { expr: 'search_insert([-10, -3, 8], -5)', expected: '1', hidden: true },
      ],
      perfTests: [
        {
          name: '1.000 buscas em 50.000 elementos',
          setup: 'nums = list(range(0, 100000, 2))',
          expr: 'sum(search_insert(nums, t) for t in range(1, 100000, 100))',
          expected: 'sum((t + 1) // 2 for t in range(1, 100000, 100))',
          maxMs: 60,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Busca binária — O(log n)',
      reviews: [
        {
          when: m => m.calls.includes('index') || m.calls.includes('enumerate'),
          text: 'Percorrer a lista até achar a posição é `O(n)`. A busca binária encontra o ponto de inserção em `O(log n)`.',
          concept: 'Busca binária',
        },
        {
          when: m => m.imports.includes('bisect'),
          text: '`bisect.bisect_left` resolve em uma linha — ótimo saber! Mas na entrevista pedem a implementação da busca.',
          concept: 'bisect',
        },
      ],
      hints: [
        'Use exatamente o molde da busca binária clássica.',
        'Se o alvo não for encontrado, o loop termina com `lo > hi`. Onde `lo` está nesse momento?',
        '`lo` é justamente a posição de inserção: `return lo` no final.',
      ],
      solution: `def search_insert(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return lo
`,
      solutionExplanation: 'Invariante: tudo antes de `lo` é **menor** que o alvo e tudo depois de `hi` é **maior**. Quando o intervalo esvazia, `lo` é a primeira posição com valor ≥ alvo — exatamente o que `bisect.bisect_left` devolve. **Tempo `O(log n)`**, **espaço `O(1)`**.',
    },
    {
      type: 'match',
      id: 'lc-rx2-bs-q6',
      concept: 'bisect',
      say: 'Bate-bola de `bisect`: o que cada chamada devolve?',
      prompt: 'Com `a` **ordenada**, associe cada expressão ao que ela calcula.',
      pairs: [
        { left: '`bisect_left(a, x)`', right: 'Primeira posição com valor **≥ x**' },
        { left: '`bisect_right(a, x)`', right: 'Primeira posição com valor **> x**' },
        { left: '`bisect_right(a, x) - bisect_left(a, x)`', right: 'Quantas vezes `x` aparece em `a`' },
        { left: '`bisect_left(a, x) - 1`', right: 'Índice do último valor **< x** (ou `-1`)' },
        { left: '`insort(a, x)`', right: 'Insere `x` mantendo `a` ordenada' },
      ],
      explanation: 'As duas funções de `bisect` marcam as **fronteiras** do bloco de valores iguais a `x`: `bisect_left` é o começo e `bisect_right` é o fim (exclusivo). Daí saem contagens e vizinhos em `O(log n)`. Atenção: `insort` acha a posição em `O(log n)`, mas inserir no meio de uma `list` custa `O(n)`.',
    },
    {
      type: 'open',
      id: 'lc-bs-q5',
      concept: 'Invariante',
      say: 'Pra fechar, uma pergunta conceitual.',
      prompt: 'Explique como você evita erros de "off-by-one" e loops infinitos ao implementar uma busca binária. Que condições precisam valer?',
      minWords: 15,
      rubric: [
        { label: 'Cita que a entrada precisa estar **ordenada** (ou ser monotônica)', keywords: ['ordenad', 'monoton', 'crescente'], concept: 'Busca binária', why: 'Sem ordem, descartar metade não é seguro.' },
        { label: 'Define um **invariante** sobre o intervalo `[lo, hi]`', keywords: ['invariante', 'intervalo', 'lo e hi', 'lo, hi', 'limites', 'extremos'], concept: 'Invariante', why: 'Saber exatamente o que `lo` e `hi` significam evita erros de borda.' },
        { label: 'Garante que o intervalo **sempre encolhe** (`mid + 1` / `mid - 1`)', keywords: ['mid + 1', 'mid+1', 'mid - 1', 'mid-1', 'encolhe', 'diminui', 'exclui o mid', 'excluir o mid'], concept: 'Invariante', why: 'Se o `mid` não é excluído, o loop pode repetir para sempre.' },
        { label: 'Menciona a **condição de parada** (`lo <= hi`) ou testar **casos de borda** (vazio, 1–2 elementos)', keywords: ['lo <= hi', 'lo<=hi', 'parada', 'vazi', 'um elemento', 'dois elementos', 'borda'], concept: 'Casos de borda', why: 'Listas pequenas são onde os off-by-one aparecem.' },
      ],
      modelAnswer: `Primeiro, a busca binária só vale se a entrada for **ordenada** (ou a condição testada for monotônica).

Eu defino um **invariante** claro: "se o alvo existe, ele está em \`[lo, hi]\`". Com isso, as atualizações ficam óbvias: se \`nums[mid] < alvo\`, \`lo = mid + 1\`; senão, \`hi = mid - 1\` — o \`mid\` já testado é sempre **excluído**, então o intervalo **sempre encolhe** e não há loop infinito.

A **condição de parada** combina com o invariante: \`while lo <= hi\` (intervalo fechado). Por fim, testo os **casos de borda**: lista vazia, um e dois elementos, alvo antes do primeiro e depois do último.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Busca binária: entrada **ordenada**, invariante sobre `[lo, hi]`, e sempre excluir o `mid`.',
        'Com isso você fechou os padrões básicos. Agora é hora de **entrevista de verdade** — te vejo lá!',
      ],
      board: null,
    },
  ],
});
