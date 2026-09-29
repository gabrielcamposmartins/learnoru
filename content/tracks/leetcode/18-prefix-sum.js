Game.registerModule('leetcode', {
  id: 'prefix-sum',
  title: 'Somas de Prefixo',
  kind: 'lesson',
  level: 2,
  order: 13,
  unit: 'arrays',
  summary: 'Pague O(n) uma vez e responda qualquer soma de intervalo em O(1) — e o truque inverso, o difference array, para atualizar intervalos inteiros.',
  concepts: ['Soma de prefixo', 'Prefixo + hash map', 'Difference array', 'Prefixo 2D'],
  takeaways: [
    'Com `pre = list(accumulate(nums, initial=0))`, a soma de `nums[i..j]` é `pre[j + 1] - pre[i]`: **`O(n)`** para montar e **`O(1)`** por consulta.',
    'A convenção de **n + 1 posições** (`pre[0] = 0`) elimina o caso especial do começo — e o bug silencioso de `pre[-1]`.',
    '"Quantos subarrays somam k?" = prefixo + **hash map** dos prefixos já vistos (comece com `{0: 1}`). Funciona com negativos, onde a janela deslizante falha.',
    '**Difference array** é o inverso: `+v` no início, `-v` depois do fim, e um prefixo no final reconstrói o array — cada atualização de intervalo custa `O(1)`.',
    'Prefixo não combina com **atualizações intercaladas** com consultas: aí entram Fenwick tree ou segment tree, com `O(log n)` para as duas operações.',
  ],
  glossary: [
    { term: 'Soma de prefixo', aliases: ['somas de prefixo', 'prefix sum', 'prefix sums', 'soma acumulada', 'somas acumuladas'], definition: 'Array em que `pre[i]` guarda a soma dos `i` primeiros elementos. Com ele, a soma de qualquer intervalo sai com uma subtração: `pre[j + 1] - pre[i]`.' },
    { term: 'Difference array', aliases: ['difference arrays', 'array de diferenças', 'vetor de diferenças'], definition: 'Guarda `d[i] = a[i] - a[i - 1]`. Somar `v` ao intervalo `[l, r]` vira `d[l] += v` e `d[r + 1] -= v`, em `O(1)`; a soma de prefixo de `d` reconstrói o array.' },
    { term: 'Summed-area table', aliases: ['summed area table', 'tabela de áreas somadas', 'imagem integral', 'integral image', 'prefixo 2D'], definition: 'Soma de prefixo em 2D: `P[i][j]` é a soma do retângulo do canto `(0, 0)` até `(i - 1, j - 1)`. Qualquer retângulo sai em `O(1)` por inclusão-exclusão.' },
    { term: 'Inclusão-exclusão', aliases: ['inclusao-exclusao', 'inclusão e exclusão', 'princípio da inclusão-exclusão'], definition: 'Some as partes, subtraia o que foi contado duas vezes e devolva o que foi subtraído demais. No prefixo 2D: `P[tudo] - P[faixa de cima] - P[faixa da esquerda] + P[canto]`.' },
    { term: 'Fenwick tree', aliases: ['árvore de Fenwick', 'binary indexed tree'], definition: 'Estrutura (Peter Fenwick, 1994) que mantém somas de prefixo **com atualizações**: consulta e update em `O(log n)`, usando `i & -i` para achar o bit 1 mais à direita do índice.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é um padrão curtinho que resolve uma família enorme de problemas: **somas de prefixo**.',
        'A pergunta típica: "qual a soma de `nums[i..j]`?" — só que **milhares de vezes**, para intervalos diferentes.',
      ],
      board: {
        title: 'Somas de prefixo — a ideia',
        md: `**Força bruta:** somar o intervalo a cada consulta custa \`O(n)\`. Com \`q\` consultas, \`O(n·q)\`.

**Prefixo:** pague \`O(n)\` **uma vez** e responda cada consulta com **uma subtração**.

\`\`\`text
índice:       0   1   2   3   4   5
nums  =     [ 3,  1,  4,  1,  5,  9 ]
pre   =   [ 0,  3,  4,  8,  9, 14, 23 ]     pre[i] = soma dos i primeiros

soma(nums[2..4]) = 4 + 1 + 5          = 10
                 = pre[5] - pre[2] = 14 - 4 = 10
\`\`\`

| Abordagem | Pré-processamento | Cada consulta |
|---|---|---|
| Somar o intervalo toda vez | — | \`O(n)\` |
| Soma de prefixo | \`O(n)\` | \`O(1)\` |

> [!dica] Sinais no enunciado: "**muitas** consultas de soma em intervalo", "subarray com soma **k**", "soma de um **retângulo**". Array **fixo** + muitas consultas = prefixo.`,
      },
    },
    {
      type: 'say',
      text: [
        'Em Python, `itertools.accumulate` monta o prefixo numa linha. O detalhe que evita bugs: use **n + 1 posições**, com `pre[0] = 0`.',
        'Assim, a soma de `nums[i..j]` (inclusive) é sempre `pre[j + 1] - pre[i]` — sem `if` para o começo da lista.',
      ],
      board: {
        title: 'Implementação — convenção n + 1',
        md: `\`\`\`python
from itertools import accumulate


class SomaIntervalo:
    def __init__(self, nums):
        # pre[i] = soma de nums[0:i]  ->  len(pre) == len(nums) + 1
        self.pre = list(accumulate(nums, initial=0))

    def soma(self, i, j):
        """Soma de nums[i..j], incluindo as duas pontas. O(1)."""
        return self.pre[j + 1] - self.pre[i]


s = SomaIntervalo([3, 1, 4, 1, 5, 9])
s.pre          # [0, 3, 4, 8, 9, 14, 23]
s.soma(2, 4)   # 10
s.soma(0, 0)   # 3  -> pre[1] - pre[0]: o começo não é caso especial
\`\`\`

Leia \`pre[k]\` como "a soma de tudo **antes** do índice \`k\`".

> [!atencao] Na convenção sem o zero inicial, a fórmula vira \`pre[j] - pre[i - 1]\` — e com \`i = 0\` isso acessa \`pre[-1]\`, o **último** elemento. Em Python não dá erro: só devolve a resposta errada.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora o clássico de entrevista: **quantos subarrays somam exatamente `k`?** (LeetCode 560).',
        'O truque é reescrever a subtração: em vez de testar todo início, pergunte "quantos prefixos **anteriores** valem `atual - k`?". Um `dict` responde em `O(1)`.',
      ],
      board: {
        title: 'Prefixo + hash map',
        md: `A soma de \`nums[i..j]\` é \`pre[j + 1] - pre[i]\`. Queremos que ela seja \`k\`:

\`\`\`text
pre[j + 1] - pre[i] = k      <=>      pre[i] = pre[j + 1] - k
\`\`\`

Varrendo da esquerda para a direita com o prefixo **atual**, conte quantos prefixos já vistos valem \`atual - k\`. Exemplo com \`nums = [1, 1, 1]\`, \`k = 2\`:

| x | atual | procura (atual - k) | achou | prefixos vistos depois |
|---|---|---|---|---|
| — | 0 | — | — | {0: 1} |
| 1 | 1 | -1 | 0 | {0: 1, 1: 1} |
| 1 | 2 | 0 | 1 | {0: 1, 1: 1, 2: 1} |
| 1 | 3 | 1 | 1 | {0: 1, 1: 1, 2: 1, 3: 1} |

Total: **2** subarrays (\`[1, 1]\` duas vezes).

> [!dica] O \`{0: 1}\` inicial é o prefixo **vazio**: ele conta os subarrays que começam no índice 0.

> [!atencao] A **janela deslizante** não resolve isso quando há **negativos**: aumentar a janela pode *diminuir* a soma, então não dá para saber quando encolher. O prefixo + hash map não depende de monotonicidade.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora o problema **inverso**: em vez de muitas consultas, muitas **atualizações**. "Some 3 do dia 1 ao dia 4", milhares de vezes, e só no fim leia o resultado.',
        'A força bruta mexe em cada posição do intervalo. Com um **difference array**, cada atualização vira **duas** escritas.',
      ],
      board: {
        title: 'Difference array — marque só as bordas',
        md: `\`\`\`text
atualizações (n = 5):   +2 em [0..2]     e     +3 em [1..4]

índice:      0    1    2    3    4    5
diff    = [ +2,  +3,   0,  -2,   0,  -3 ]     <- n + 1 posições
prefixo = [  2,   5,   5,   3,   3 ]          <- o array final!
\`\`\`

- \`diff[inicio] += v\` — "daqui em diante, some \`v\`";
- \`diff[fim + 1] -= v\` — "depois do fim, pare de somar";
- no final, **uma** soma de prefixo reconstrói tudo: \`O(n + q)\` em vez de \`O(n·q)\`.

> [!sabia] Soma de prefixo e diferença são **operações inversas**, como integral e derivada: é o teorema fundamental do cálculo na versão discreta. Por isso o *difference array* aparece em todo problema de "evento de início e fim": ocupação de hotel, passageiros num trecho (LeetCode 1094, *Car Pooling*), assentos reservados por voo (LeetCode 1109).`,
      },
    },
    {
      type: 'say',
      text: [
        'A ideia sobe para **duas dimensões** sem drama: `P[i][j]` guarda a soma do retângulo que vai do canto `(0, 0)` até `(i - 1, j - 1)`.',
        'Para um retângulo qualquer, você pega o grandão e recorta as sobras. É **inclusão-exclusão**.',
      ],
      board: {
        title: 'Prefixo 2D (LeetCode 304)',
        md: `\`\`\`text
               c1            c2
       +---------+-------------+
       |    D    |      B      |
    r1 +---------+-------------+
       |    C    |      A      |      A = linhas r1..r2, colunas c1..c2
    r2 +---------+-------------+
\`\`\`

\`\`\`python
# Construção: O(linhas * colunas), com uma linha e uma coluna extras de zeros
P = [[0] * (C + 1) for _ in range(R + 1)]
for i in range(R):
    for j in range(C):
        P[i + 1][j + 1] = grid[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j]

# Consulta: O(1)
def soma(r1, c1, r2, c2):
    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]
\`\`\`

> [!sabia] Essa estrutura tem nome: **summed-area table**. Frank Crow a propôs em 1984 para suavizar texturas em computação gráfica, e ela ficou famosa em 2001 no detector de rostos de **Viola–Jones**, sob o nome de "imagem integral": milhares de somas de retângulos por imagem, cada uma em \`O(1)\`.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora, os limites — em entrevista, saber **quando não usar** vale tanto quanto a técnica.',
        'O prefixo é ótimo para dados **fixos**. Se o array muda entre as consultas, cada mudança obriga a refazer o prefixo.',
      ],
      board: {
        title: 'Quando usar (e quando não)',
        md: `| Situação | Use |
|---|---|
| Array fixo, muitas consultas de soma | Soma de prefixo |
| Muitas atualizações de intervalo, leitura só no fim | Difference array |
| Updates **intercalados** com consultas | Fenwick tree ou segment tree, \`O(log n)\` |
| Máximo/mínimo de intervalo | Sparse table ou segment tree (\`max\` não tem "subtração") |
| Janela com soma ≥ alvo e **só positivos** | Janela deslizante: mais simples, \`O(1)\` de memória |

- O truque funciona para operações **inversíveis**: soma (desfaz com subtração), XOR (desfaz com o próprio XOR), contagens.
- **Floats:** \`pre[j + 1] - pre[i]\` subtrai dois números grandes e parecidos e pode perder precisão (*cancelamento catastrófico*). Para dinheiro, use **centavos inteiros** ou \`decimal\`.
- Em Java/C++, o prefixo de um array grande pode **estourar** \`int\`; em Python, inteiros não têm limite.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Fórmulas, prefixo + hash map, difference array e trade-offs.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-ps-q1',
      concept: 'Soma de prefixo',
      say: 'Aquecimento: cuidado com o índice!',
      prompt: 'Com `pre = list(accumulate(nums, initial=0))` — ou seja, `pre[0] = 0` e `len(pre) == len(nums) + 1` —, qual expressão devolve a soma de `nums[i..j]`, **incluindo** as duas pontas?',
      options: [
        { text: '`pre[j] - pre[i]`', why: 'Fica faltando o `nums[j]`: `pre[j]` só soma até o índice `j - 1`.' },
        { text: '`pre[j + 1] - pre[i]`', correct: true, why: '`pre[j + 1]` soma tudo até `j` (inclusive) e `pre[i]` retira tudo antes de `i`.' },
        { text: '`pre[j] - pre[i - 1]`', why: 'É a fórmula da convenção **sem** o zero inicial. Aqui ela erra — e com `i = 0` vira `pre[-1]`, o último elemento: bug silencioso!' },
        { text: '`pre[j + 1] - pre[i + 1]`', why: 'Retira o `nums[i]` junto: soma só `nums[i + 1..j]`.' },
      ],
      explanation: 'Leia `pre[k]` como "a soma **antes** do índice `k`". A soma de `i` a `j` é "antes de `j + 1`" menos "antes de `i`". A convenção de n + 1 posições evita o `if i == 0` — e o índice negativo, que em Python não dá erro, só devolve a resposta errada.',
    },
    {
      type: 'code',
      id: 'lc-ps-q2',
      concept: 'Prefixo + hash map',
      title: 'Subarray Sum Equals K',
      say: 'LeetCode 560, clássico de entrevista. E sim: tem números negativos.',
      prompt: `Implemente \`subarray_sum(nums, k)\` que devolve **quantos** subarrays **contíguos e não vazios** de \`nums\` têm soma exatamente \`k\`.

- Os números podem ser **negativos** ou zero.
- \`[1, 1, 1]\` com \`k = 2\` → \`2\` (as duas duplas \`[1, 1]\`).
- Objetivo: **\`O(n)\`**.`,
      starter: `def subarray_sum(nums, k):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'subarray_sum([1, 1, 1], 2)', expected: '2' },
        { name: 'exemplo 2', expr: 'subarray_sum([1, 2, 3], 3)', expected: '2' },
        { name: 'com negativos', expr: 'subarray_sum([1, -1, 0], 0)', expected: '3' },
        { name: 'zeros com k = 0', expr: 'subarray_sum([0, 0, 0], 0)', expected: '6' },
        { name: 'lista vazia', expr: 'subarray_sum([], 5)', expected: '0' },
        { name: 'um elemento igual a k', expr: 'subarray_sum([5], 5)', expected: '1' },
        { expr: 'subarray_sum([3, 4, 7, 2, -3, 1, 4, 2], 7)', expected: '4', hidden: true },
        { expr: 'subarray_sum([-1, -1, 1], 0)', expected: '1', hidden: true },
        { expr: 'subarray_sum([1, -1, 1, -1], 0)', expected: '4', hidden: true },
        { expr: 'subarray_sum([-2, 5, -3, 3], 3)', expected: '3', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 4.000, com negativos',
          setup: 'nums = [((i * 7919) % 21) - 10 for i in range(4000)]',
          expr: 'subarray_sum(nums, 5)',
          expected: '108490',
          maxMs: 100,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Prefixo + hash map em O(n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Testar todos os pares `(i, j)` é `O(n²)`. Com o prefixo atual em mãos, "quantos inícios fecham soma `k`?" vira uma consulta `O(1)` num `dict` de prefixos já vistos.',
          concept: 'Prefixo + hash map',
        },
        {
          when: (m, code) => /\bsum\s*\(/.test(code),
          text: 'Chamar `sum()` em fatias recalcula somas que você já conhecia. Mantenha o prefixo **corrente** numa variável.',
          concept: 'Soma de prefixo',
        },
        {
          when: m => m.calls.includes('count'),
          text: '`lista.count(x)` percorre a lista inteira a cada chamada. Guarde **quantas vezes** cada prefixo apareceu num `dict` (ou `defaultdict(int)`).',
          concept: 'Hash Map',
        },
      ],
      hints: [
        'Seja `atual` a soma de `nums[0..j]`. O subarray `nums[i..j]` soma `k` quando o prefixo **antes** de `i` vale `atual - k`.',
        'Guarde num `dict` quantas vezes cada valor de prefixo já apareceu. A cada elemento: some ao total `vistos.get(atual - k, 0)` e **só depois** registre `atual`.',
        'Comece com `vistos = {0: 1}` — o prefixo vazio — para contar os subarrays que começam no índice 0.',
      ],
      solution: `def subarray_sum(nums, k):
    vistos = {0: 1}          # o prefixo vazio
    atual = 0
    total = 0
    for x in nums:
        atual += x
        total += vistos.get(atual - k, 0)
        vistos[atual] = vistos.get(atual, 0) + 1
    return total
`,
      solutionExplanation: 'Cada elemento faz uma consulta e uma atualização no `dict`: **tempo `O(n)`**, **espaço `O(n)`** (prefixos distintos). A ordem importa: consultar **antes** de registrar o prefixo atual evita contar o subarray vazio quando `k = 0`. A janela deslizante não serviria: com negativos, a soma não cresce junto com a janela.',
    },
    {
      type: 'match',
      id: 'lc-ps-q3',
      concept: 'Escolha da técnica',
      say: 'Bate-bola: qual ferramenta para cada situação?',
      prompt: 'Associe cada situação à técnica mais adequada.',
      pairs: [
        { left: 'Muitas consultas de soma em intervalo, array fixo', right: 'Soma de prefixo 1D' },
        { left: 'Quantos subarrays somam `k` (com negativos)', right: 'Prefixo + hash map de contagens' },
        { left: 'Milhares de "some `v` de `l` até `r`", leitura só no fim', right: 'Difference array' },
        { left: 'Soma de retângulos de uma matriz fixa', right: 'Prefixo 2D (inclusão-exclusão)' },
        { left: 'Updates pontuais intercalados com consultas de soma', right: 'Fenwick tree ou segment tree' },
        { left: 'Maior janela com soma ≤ alvo, só positivos', right: 'Janela deslizante' },
      ],
      explanation: 'O prefixo brilha com **dados fixos e muitas leituras**; o difference array, com **muitas escritas e uma leitura**. Quando leituras e escritas se misturam, as árvores (Fenwick/segment) equilibram as duas em `O(log n)`. E se todos os números são positivos, a janela deslizante resolve com `O(1)` de memória.',
    },
    {
      type: 'code',
      id: 'lc-ps-q4',
      concept: 'Difference array',
      title: 'Ocupação da pousada',
      say: 'Agora o truque inverso. Pense em bordas, não em dias.',
      prompt: `Uma pousada registra reservas como \`[inicio, fim, quartos]\`: a reserva ocupa \`quartos\` quartos em **cada** dia de \`inicio\` a \`fim\` (**inclusive**). Os dias vão de \`0\` a \`n - 1\`.

Implemente \`ocupacao(n, reservas)\` que devolve uma lista com o total de quartos ocupados em cada dia.

- \`quartos\` pode ser **negativo** (um cancelamento parcial).
- Objetivo: **\`O(n + q)\`** para \`q\` reservas — sem percorrer os dias de cada reserva.`,
      starter: `def ocupacao(n, reservas):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'ocupacao(5, [[0, 2, 2], [1, 4, 3], [3, 3, 1]])', expected: '[2, 5, 5, 4, 3]' },
        { name: 'sem reservas', expr: 'ocupacao(3, [])', expected: '[0, 0, 0]' },
        { name: 'n = 0', expr: 'ocupacao(0, [])', expected: '[]' },
        { name: 'reserva até o último dia', expr: 'ocupacao(4, [[1, 3, 5]])', expected: '[0, 5, 5, 5]' },
        { name: 'um único dia', expr: 'ocupacao(3, [[1, 1, 7]])', expected: '[0, 7, 0]' },
        { name: 'cancelamento', expr: 'ocupacao(3, [[0, 2, 4], [1, 2, -4]])', expected: '[4, 0, 0]' },
        { expr: 'ocupacao(6, [[0, 5, 1], [0, 5, 1], [2, 3, 10], [5, 5, 2]])', expected: '[2, 2, 12, 12, 2, 4]', hidden: true },
        { expr: 'ocupacao(1, [[0, 0, 3], [0, 0, 4]])', expected: '[7]', hidden: true },
      ],
      perfTests: [
        {
          name: '20.000 dias, 1.000 reservas longas',
          setup: `n = 20000
reservas = [[(i * 37) % 10000, (i * 37) % 10000 + 5000 + (i * 13) % 5000, 1 + i % 5] for i in range(1000)]
_esperado = [0] * (n + 1)
for _a, _b, _q in reservas:
    _esperado[_a] += _q
    _esperado[_b + 1] -= _q
for _i in range(1, n):
    _esperado[_i] += _esperado[_i - 1]
_esperado = _esperado[:n]`,
          expr: 'ocupacao(n, reservas)',
          expected: '_esperado',
          maxMs: 100,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Difference array — O(n + q)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Percorrer os dias de cada reserva custa `O(n·q)`. Marque só as **bordas** — `diff[inicio] += quartos` e `diff[fim + 1] -= quartos` — e reconstrua tudo com **uma** soma de prefixo no final.',
          concept: 'Difference array',
        },
        {
          when: (m, code) => /\bsum\s*\(/.test(code),
          text: '`sum(diff[:i + 1])` para cada dia refaz o prefixo do zero: `O(n²)`. Acumule numa variável ou use `itertools.accumulate`.',
          concept: 'Soma de prefixo',
        },
      ],
      hints: [
        'Em vez de somar `quartos` em todos os dias do intervalo, anote só **onde o efeito começa** e **onde ele termina**.',
        'Crie `diff = [0] * (n + 1)` (a posição extra recebe o `fim + 1` do último dia). Para cada reserva: `diff[inicio] += quartos` e `diff[fim + 1] -= quartos`.',
        'No final, a ocupação do dia `i` é a soma de `diff[0..i]`: `list(accumulate(diff[:n]))` (de `itertools`) ou um loop com um acumulador.',
      ],
      solution: `from itertools import accumulate


def ocupacao(n, reservas):
    diff = [0] * (n + 1)              # posição extra para o "fim + 1"
    for inicio, fim, quartos in reservas:
        diff[inicio] += quartos       # daqui em diante, soma
        diff[fim + 1] -= quartos      # depois do fim, desfaz
    return list(accumulate(diff[:n]))
`,
      solutionExplanation: 'Cada reserva custa `O(1)` (duas escritas) e a reconstrução custa `O(n)`: **tempo `O(n + q)`**, **espaço `O(n)`**. A posição extra `diff[n]` absorve o `fim + 1` das reservas que vão até o último dia, sem `if`. Repare na simetria: o prefixo de `diff` devolve o array original — difference array e soma de prefixo são inversos.',
    },
    {
      type: 'mcq',
      id: 'lc-ps-q5',
      concept: 'Prefixo 2D',
      say: 'Agora em duas dimensões. Lembre do desenho do quadro.',
      prompt: `No prefixo 2D, a soma do retângulo das linhas \`r1..r2\` e colunas \`c1..c2\` é:

\`\`\`python
P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]
\`\`\`

Por que o último termo, \`+ P[r1][c1]\`, é **somado** de volta?`,
      options: [
        { text: 'Porque o bloco acima e à esquerda do retângulo foi subtraído **duas vezes**: uma com a faixa de cima e outra com a da esquerda.', correct: true, why: 'É a inclusão-exclusão: o canto `D` está dentro das duas faixas removidas.' },
        { text: 'Para compensar o deslocamento de `+1` dos índices de `P`.', why: 'O `+1` já aparece em `r2 + 1` e `c2 + 1`; o termo extra existe por causa da sobreposição das faixas.' },
        { text: 'Para incluir a linha `r1`, que a fórmula tinha deixado de fora.', why: 'A linha `r1` já está incluída: `P[r1][...]` soma só as linhas **antes** de `r1`.' },
        { text: 'Só é necessário quando a matriz tem números negativos.', why: 'Vale para quaisquer números: sem ele, o canto é descontado duas vezes e o resultado fica errado.' },
      ],
      explanation: 'Há quatro regiões: o retângulo pedido `A`, a faixa de cima `B`, a da esquerda `C` e o canto `D`. `P[r2+1][c2+1]` soma `A + B + C + D`; tirar a faixa de cima remove `B + D` e tirar a da esquerda remove `C + D` — o `D` saiu duas vezes, então somamos `P[r1][c1] = D` de volta. A construção de `P` usa exatamente a mesma inclusão-exclusão.',
    },
    {
      type: 'open',
      id: 'lc-ps-q6',
      concept: 'Trade-offs de estruturas',
      say: 'Follow-up de entrevista: agora o array muda.',
      prompt: 'Você usou soma de prefixo para responder consultas de soma em `O(1)`. O produto mudou: o array agora recebe **atualizações pontuais** (`nums[i] = x`) **intercaladas** com as consultas, na mesma proporção. O prefixo ainda serve? O que você faria?',
      minWords: 20,
      rubric: [
        { label: 'Explica que cada atualização obriga a **recalcular o prefixo** (`O(n)` por update)', keywords: ['recalcul', 'refazer', 'refaz', 'reconstru', 'o(n) por', 'o(n) a cada', 'cada atualizacao', 'cada update', 'todo o prefixo', 'invalida'], concept: 'Soma de prefixo', why: 'Mudar `nums[i]` altera todos os `pre[k]` com `k > i`.' },
        { label: 'Propõe **Fenwick tree** (binary indexed tree) ou **segment tree**', keywords: ['fenwick', 'binary indexed', 'segment tree', 'arvore de segmento', 'arvore de segmentos', 'segtree'], concept: 'Fenwick tree', why: 'Essas árvores guardam somas parciais e aceitam atualizações sem refazer tudo.' },
        { label: 'Diz a complexidade: **`O(log n)`** para consulta **e** para atualização', keywords: ['log n', 'logn', 'log(n)', 'logaritm'], concept: 'Complexidade', why: 'É o meio-termo entre o prefixo (consulta `O(1)`, update `O(n)`) e o array puro (consulta `O(n)`, update `O(1)`).' },
        { label: 'Discute o **trade-off** conforme a proporção de leituras e escritas (ex.: updates raros, processamento em lote, blocos de √n)', keywords: ['proporc', 'trade-off', 'tradeoff', 'depende', 'poucas atualiza', 'raras', 'leituras', 'escritas', 'sqrt', 'raiz de n', 'blocos', 'em lote', 'batch'], concept: 'Trade-offs', why: 'A escolha depende do perfil de uso — e entrevistadores valorizam esse raciocínio.' },
      ],
      modelAnswer: `Com atualizações frequentes, o prefixo perde a graça: mudar \`nums[i]\` altera todos os \`pre[k]\` com \`k > i\`, então eu teria que **recalcular** \`O(n)\` a cada update. Com consultas e updates na mesma proporção, o total vira \`O(n·q)\`.

Eu usaria uma **Fenwick tree** (binary indexed tree) ou uma **segment tree**: as duas fazem consulta de soma de intervalo **e** atualização pontual em **\`O(log n)\`**. A Fenwick é mais curta de implementar; a segment tree é mais flexível (serve para mínimo/máximo e para atualizações de intervalo com *lazy propagation*).

No fundo é um **trade-off** entre leituras e escritas: se as atualizações fossem raras, eu manteria o prefixo e o reconstruiria **em lote**; num meio-termo, a decomposição em **blocos** de tamanho \`√n\` também funciona.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! Prefixo para **ler** intervalos em `O(1)`, prefixo + hash map para **contar** subarrays e difference array para **escrever** intervalos em `O(1)`.',
        { text: 'E lembre do limite: se leituras e escritas se misturam, é hora de Fenwick tree ou segment tree. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
