(function () {
  // Classe usada nos starters/soluções e utilitários dos testes (rodam depois do código do jogador).
  const NODE = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;
  const ARV = `def _arvore(valores):
    """Monta a árvore no formato do LeetCode: nível a nível, None = sem filho."""
    if not valores or valores[0] is None:
        return None
    raiz = TreeNode(valores[0])
    fila = [raiz]
    k, i = 0, 1
    while i < len(valores):
        no = fila[k]
        k += 1
        if valores[i] is not None:
            no.left = TreeNode(valores[i])
            fila.append(no.left)
        i += 1
        if i < len(valores) and valores[i] is not None:
            no.right = TreeNode(valores[i])
            fila.append(no.right)
        i += 1
    return raiz


def _completa(n):
    nos = [TreeNode(i) for i in range(n)]
    for i in range(n):
        if 2 * i + 1 < n:
            nos[i].left = nos[2 * i + 1]
        if 2 * i + 2 < n:
            nos[i].right = nos[2 * i + 2]
    return nos[0]


def _bst(lo, hi):
    """BST balanceada com os valores lo..hi-1."""
    if lo >= hi:
        return None
    m = (lo + hi) // 2
    return TreeNode(m, _bst(lo, m), _bst(m + 1, hi))


def _espinha(n_espinha, tam):
    """Espinha para a direita; cada nó dela tem uma BST balanceada de tam nós à esquerda."""
    nos = []
    base = 0
    for _ in range(n_espinha):
        nos.append(TreeNode(base + tam, _bst(base, base + tam)))
        base += tam + 1
    for a, b in zip(nos, nos[1:]):
        a.right = b
    return nos[0]


def _no(raiz, v):
    while raiz is not None and raiz.val != v:
        raiz = raiz.left if v < raiz.val else raiz.right
    return raiz


def _val(no):
    return None if no is None else no.val

`;
  const BST_EX = 'raiz = _arvore([6, 2, 8, 0, 4, 7, 9, None, None, 3, 5])\n';

  Game.registerModule('leetcode', {
    id: 'trees',
    title: 'Árvores: DFS, BFS e BST',
    kind: 'lesson',
    level: 2,
    order: 23,
    unit: 'estruturas',
    summary: 'Percorra árvores em profundidade e por níveis, valide uma BST sem cair na armadilha dos limites e ache o menor ancestral comum em O(h).',
    concepts: ['DFS', 'BFS por níveis', 'BST', 'Menor ancestral comum'],
    takeaways: [
      'Quase todo problema de árvore custa **`O(n)` de tempo**; a memória extra é **`O(h)`** na DFS e **`O(w)`** na BFS (`w` = nível mais largo).',
      '**Em-ordem** numa BST sai ordenada; **pré-ordem** copia e serializa; **pós-ordem** resolve os filhos antes do pai.',
      'BFS por níveis: no começo de cada rodada a fila tem **exatamente um nível** — guarde `len(fila)`. E use `deque.popleft()`, nunca `pop(0)`.',
      'Validar BST exige **limites herdados** `(menor, maior)`: comparar só com os filhos deixa passar netos fora do intervalo.',
      'Numa BST, o menor ancestral comum é o primeiro nó que **separa** `p` e `q`: `O(h)` descendo da raiz. E em Python, árvore degenerada pede **pilha explícita**, não recursão.',
    ],
    glossary: [
      { term: 'BST', aliases: ['BSTs', 'árvore binária de busca', 'árvores binárias de busca', 'binary search tree'], definition: 'Árvore binária em que, para **todo** nó, os valores da subárvore esquerda são menores e os da direita são maiores. Busca, inserção e remoção custam `O(h)`: `O(log n)` se ela estiver balanceada.' },
      { term: 'Em-ordem', aliases: ['in-order', 'inorder', 'travessia em-ordem', 'percurso em-ordem'], definition: 'Travessia em profundidade que visita esquerda, nó, direita. Numa BST, devolve os valores em ordem crescente.' },
      { term: 'Menor ancestral comum', aliases: ['LCA', 'lowest common ancestor'], definition: 'O nó mais profundo que tem `p` e `q` na sua subárvore (um nó conta como ancestral de si mesmo). Numa BST, é o primeiro nó, descendo da raiz, que separa `p` e `q`.' },
      { term: 'Árvore degenerada', aliases: ['árvores degeneradas', 'degenerate tree'], definition: 'Árvore em que cada nó tem no máximo um filho: ela vira uma "linha", com altura `h = n - 1`. É o pior caso das operações `O(h)` — e da recursão em Python.' },
      { term: 'Morris traversal', aliases: ['travessia de Morris', 'percurso de Morris'], definition: 'Travessia em-ordem com `O(1)` de memória extra (J. M. Morris, 1979): liga temporariamente o predecessor de cada nó de volta a ele para saber voltar, e desfaz a ligação no caminho. Sem pilha e sem recursão.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Árvores estão em todo lugar: o DOM do navegador, o sistema de arquivos, os índices B-tree do banco, o próprio `ast` do Python.',
          'Em entrevista, quase sempre é uma **árvore binária**: cada nó tem no máximo dois filhos.',
        ],
        board: {
          title: 'Árvore binária — vocabulário',
          md: `\`\`\`python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
\`\`\`

\`\`\`text
            8            <- raiz (profundidade 0)
          /   \\
         3     10        <- profundidade 1
        / \\      \\
       1   6      14     <- 1 e 14 são folhas
          / \\
         4   7           <- o caminho mais longo tem 3 arestas (8, 3, 6, 4)
\`\`\`

| Termo | Significado |
|---|---|
| **Folha** | nó sem filhos |
| **Profundidade** de um nó | número de arestas da raiz até ele |
| **Altura** \`h\` | maior profundidade; balanceada: \`h ≈ log₂ n\`; degenerada: \`h = n - 1\` |
| **Profundidade máxima** (LeetCode 104) | conta **nós** no caminho mais longo: aqui, 4 |
| **BST** | para **todo** nó: a subárvore esquerda só tem menores; a direita, só maiores |

> [!dica] Quase toda solução de árvore custa \`O(n)\` de tempo (visitar cada nó uma vez) e \`O(h)\` de espaço (a pilha da recursão). Diga os dois na entrevista.`,
        },
      },
      {
        type: 'say',
        text: [
          '**DFS** (busca em profundidade) desce até o fundo de um galho antes de voltar. Em árvores, ela tem três sabores, conforme **quando** você visita o nó.',
          'A versão recursiva é curtinha; a iterativa troca a pilha de chamadas por uma **pilha explícita**.',
        ],
        board: {
          title: 'DFS: pré, em e pós-ordem',
          md: `\`\`\`python
def em_ordem(no, saida):             # esquerda, NÓ, direita
    if no is None:
        return
    em_ordem(no.left, saida)
    saida.append(no.val)
    em_ordem(no.right, saida)
\`\`\`

| Ordem | Visita | Na árvore do quadro anterior |
|---|---|---|
| Pré-ordem | nó, esquerda, direita | 8 3 1 6 4 7 10 14 |
| Em-ordem | esquerda, nó, direita | 1 3 4 6 7 8 10 14 |
| Pós-ordem | esquerda, direita, nó | 1 4 7 6 3 14 10 8 |

**Iterativa** (pré-ordem), sem limite de recursão:

\`\`\`python
def pre_ordem(raiz):
    saida = []
    pilha = [raiz] if raiz else []
    while pilha:
        no = pilha.pop()
        saida.append(no.val)
        if no.right:
            pilha.append(no.right)   # a direita entra primeiro...
        if no.left:
            pilha.append(no.left)    # ...para a esquerda sair antes (LIFO)
    return saida
\`\`\`

> [!atencao] A **em-ordem** de uma BST devolve os valores **ordenados**. Guarde isso: resolve "validar BST", "k-ésimo menor elemento" e vários outros.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          '**BFS** (busca em largura) visita a árvore **nível por nível**, com uma **fila**.',
          'O truque para separar os níveis: no começo de cada rodada, a fila contém **exatamente** um nível. Guarde `len(fila)` e processe só esses nós.',
        ],
        board: {
          title: 'BFS por níveis',
          md: `\`\`\`python
from collections import deque

def por_niveis(raiz):
    if raiz is None:
        return []
    niveis = []
    fila = deque([raiz])
    while fila:
        nivel = []
        for _ in range(len(fila)):        # só os nós DESTE nível
            no = fila.popleft()
            nivel.append(no.val)
            if no.left:
                fila.append(no.left)
            if no.right:
                fila.append(no.right)
        niveis.append(nivel)
    return niveis

# árvore do primeiro quadro -> [[8], [3, 10], [1, 6, 14], [4, 7]]
\`\`\`

| | DFS | BFS |
|---|---|---|
| Estrutura | pilha (ou recursão) | fila (\`deque\`) |
| Memória extra | \`O(h)\` | \`O(w)\` — \`w\` = nível mais largo |
| Bom para | caminhos, validações, combinar resultados dos filhos | **menor profundidade**, qualquer coisa "por nível" |

> [!atencao] Use \`deque.popleft()\`, nunca \`lista.pop(0)\`: o \`pop(0)\` desloca todos os elementos restantes e custa \`O(n)\` por chamada.`,
        },
      },
      {
        type: 'say',
        text: [
          'Um clássico de aquecimento: **profundidade máxima** (LeetCode 104). A versão recursiva é praticamente a definição.',
          'Mas atenção ao Python: numa árvore **degenerada**, a recursão desce `n` níveis.',
        ],
        board: {
          title: 'Profundidade máxima e o custo da recursão',
          md: `\`\`\`python
def max_depth(raiz):                  # recursiva: O(n) tempo, O(h) de pilha
    if raiz is None:
        return 0
    return 1 + max(max_depth(raiz.left), max_depth(raiz.right))


def max_depth_iter(raiz):             # iterativa: pilha explícita de (nó, profundidade)
    maior = 0
    pilha = [(raiz, 1)] if raiz else []
    while pilha:
        no, prof = pilha.pop()
        maior = max(maior, prof)
        for filho in (no.left, no.right):
            if filho:
                pilha.append((filho, prof + 1))
    return maior
\`\`\`

| Árvore com 1 milhão de nós | Altura | Recursão em Python |
|---|---|---|
| Balanceada | ~20 | tranquila |
| Degenerada (vira uma "linha") | ~1.000.000 | \`RecursionError\` (limite padrão ~1.000) |

> [!sabia] Dá para percorrer uma árvore **em-ordem com \`O(1)\` de memória extra**, sem pilha nem recursão: é a **Morris traversal** (Joseph Morris, 1979). Antes de descer à esquerda, ela faz o nó mais à direita da subárvore esquerda — o predecessor — apontar de volta para o nó atual, uma "linha" temporária para saber voltar. Na volta, desfaz a ligação: a árvore termina intacta.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a pegadinha mais famosa de árvores: **validar uma BST** (LeetCode 98).',
          'Comparar cada nó só com os **filhos** não basta. A regra vale para a subárvore **inteira**.',
        ],
        board: {
          title: 'Validar BST: a armadilha dos limites',
          md: `\`\`\`text
          5
         / \\
        4   6
           / \\
          3   7        3 < 6: ok com o pai... mas 3 está à DIREITA do 5!
\`\`\`

Cada nó herda um **intervalo aberto** \`(menor, maior)\` de todos os ancestrais:

\`\`\`text
5  em (-inf, +inf)
├── 4  em (-inf, 5)
└── 6  em (5, +inf)
    ├── 3  em (5, 6)     <- 3 fora de (5, 6): árvore inválida
    └── 7  em (6, +inf)
\`\`\`

- Descendo à **esquerda**, o teto vira o valor do pai; à **direita**, o piso vira o valor do pai.
- Comece com \`(float("-inf"), float("inf"))\`. Limites "grandes" chumbados, como \`-2**31\`, quebram quando a árvore contém exatamente esse valor.
- Iguais não valem: uma BST (no LeetCode 98) tem valores **estritamente** menores à esquerda e maiores à direita.

> [!dica] Outra saída elegante: a em-ordem de uma BST válida é **estritamente crescente**. Percorra em-ordem comparando cada valor com o anterior — sem guardar a lista inteira.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Última ideia: o **menor ancestral comum** (LCA) de dois nós.',
          'Numa BST, a ordem diz para que lado cada nó está. O LCA é o primeiro nó, descendo da raiz, que deixa `p` e `q` em **lados diferentes**.',
        ],
        board: {
          title: 'Menor ancestral comum numa BST',
          md: `\`\`\`text
              6
            /   \\
           2     8
          / \\   / \\
         0   4 7   9
            / \\
           3   5

LCA(2, 8) = 6     2 fica à esquerda do 6, e 8 à direita
LCA(3, 5) = 4     os dois descem juntos até o 4, que os separa
LCA(2, 4) = 2     um nó conta como ancestral de si mesmo
\`\`\`

**Regra:** a partir da raiz, se \`p\` e \`q\` são **ambos menores** que o nó, desça à esquerda; se são **ambos maiores**, à direita; senão, o nó atual os separa (ou é um deles) — é o LCA.

- Um único caminho da raiz para baixo: **\`O(h)\`** de tempo e \`O(1)\` de memória na versão iterativa.
- Em árvore binária **comum** (LeetCode 236), não há ordem para escolher o lado: a recursão pergunta a cada subárvore "achou \`p\` ou \`q\`?", e o primeiro nó que recebe "sim" dos dois lados é o LCA. Aí o custo é \`O(n)\`.

> [!dica] Em entrevista, pergunte: "é uma BST?". A resposta muda o algoritmo e a complexidade.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Travessias, visão por níveis, recursão, validação de BST e LCA.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'lc-tree-q1',
        concept: 'Travessias DFS',
        say: 'Aquecimento: siga a árvore com o dedo.',
        prompt: `Qual é a sequência da travessia em **pós-ordem** desta árvore?

\`\`\`text
        5
       / \\
      2   9
     / \\   \\
    1   4   12
\`\`\``,
        options: [
          { text: '`5 2 1 4 9 12`', why: 'Essa é a **pré-ordem**: o nó aparece antes dos filhos.' },
          { text: '`1 2 4 5 9 12`', why: 'Essa é a **em-ordem** — e, como a árvore é uma BST, ela saiu ordenada.' },
          { text: '`1 4 2 12 9 5`', correct: true, why: 'Pós-ordem: esquerda, direita e só então o nó. A raiz `5` é sempre a **última**.' },
          { text: '`5 2 9 1 4 12`', why: 'Essa é a **BFS** (por níveis), não uma DFS.' },
        ],
        explanation: 'O nome diz **quando** o nó é visitado em relação aos filhos: **pré** (antes), **em** (entre) e **pós** (depois). A pós-ordem é a escolha quando o pai depende do resultado dos filhos: altura, tamanho da subárvore, liberar recursos, avaliar uma expressão — `(2 + 3) * 4` em pós-ordem vira `2 3 + 4 *`, a notação polonesa reversa.',
      },
      {
        type: 'code',
        id: 'lc-tree-q2',
        concept: 'BFS por níveis',
        title: 'Binary Tree Right Side View',
        say: 'LeetCode 199, favorito de entrevista. Imagine-se parada à direita da árvore.',
        prompt: `Implemente \`right_side_view(root)\`: devolva os valores que uma pessoa **à direita da árvore** enxerga, de cima para baixo — ou seja, o nó **mais à direita de cada nível**.

- \`root\` pode ser \`None\`.
- Cuidado: o nó visível de um nível pode estar numa subárvore **esquerda**.
- Objetivo: **\`O(n)\`**. Há um teste de desempenho com 65.535 nós.`,
        starter: NODE + `

def right_side_view(root):
    pass
`,
        tests: [
          { name: 'exemplo', setup: ARV + 'raiz = _arvore([1, 2, 3, None, 5, None, 4])', expr: 'right_side_view(raiz)', expected: '[1, 3, 4]' },
          { name: 'galho esquerdo mais fundo', setup: ARV + 'raiz = _arvore([1, 2, 3, 4])', expr: 'right_side_view(raiz)', expected: '[1, 3, 4]' },
          { name: 'árvore vazia', expr: 'right_side_view(None)', expected: '[]' },
          { name: 'só a raiz', setup: ARV + 'raiz = _arvore([1])', expr: 'right_side_view(raiz)', expected: '[1]' },
          { name: 'torta para a esquerda', setup: ARV + 'raiz = _arvore([1, 2, None, 3])', expr: 'right_side_view(raiz)', expected: '[1, 2, 3]' },
          { setup: ARV + 'raiz = _arvore([1, 2, 3, None, 5, 6, None, 7])', expr: 'right_side_view(raiz)', expected: '[1, 3, 6, 7]', hidden: true },
          { setup: ARV + 'raiz = _arvore([0, -1, -2, -3, None, None, -4, -5])', expr: 'right_side_view(raiz)', expected: '[0, -2, -4, -5]', hidden: true },
        ],
        perfTests: [
          {
            name: 'árvore completa com 65.535 nós',
            setup: ARV + 'raiz = _completa(65535)',
            expr: 'right_side_view(raiz)',
            expected: '[2 ** (d + 1) - 2 for d in range(16)]',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'BFS com deque — O(n)',
        reviews: [
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
            text: '`lista.pop(0)` desloca todos os elementos restantes: `O(n)` por remoção, e a BFS inteira pode virar `O(n²)`. Use `collections.deque` com `popleft()`.',
            concept: 'deque vs list.pop(0)',
          },
          {
            when: m => m.calls.includes('insert'),
            text: '`lista.insert(0, x)` também desloca todos os elementos (`O(n)`). Para fila, `deque` tem `appendleft` e `popleft` em `O(1)`.',
            concept: 'deque vs list.pop(0)',
          },
        ],
        hints: [
          'Faça uma BFS por níveis: no começo de cada rodada, a fila tem exatamente os nós de **um** nível, da esquerda para a direita.',
          'Qual nó da fila é o mais à direita do nível? O **último**: `fila[-1]`. Guarde o valor dele antes de processar o nível.',
          'Use `deque`: `for _ in range(len(fila))`, `popleft()` e enfileire `left` e depois `right`. (Alternativa: DFS visitando a direita primeiro e guardando o primeiro nó de cada profundidade.)',
        ],
        solution: NODE + `
from collections import deque


def right_side_view(root):
    if root is None:
        return []
    vista = []
    fila = deque([root])
    while fila:
        vista.append(fila[-1].val)       # o último da fila é o mais à direita do nível
        for _ in range(len(fila)):
            no = fila.popleft()
            if no.left:
                fila.append(no.left)
            if no.right:
                fila.append(no.right)
    return vista
`,
        solutionExplanation: 'Cada nó entra e sai da fila uma vez: **tempo `O(n)`**, **espaço `O(w)`** (o nível mais largo). Como a fila guarda um nível inteiro, da esquerda para a direita, `fila[-1]` é o nó visível. A DFS "direita primeiro" também é `O(n)`: o primeiro nó alcançado em cada profundidade é o visível — mas usa `O(h)` de pilha.',
      },
      {
        type: 'mcq',
        id: 'lc-tree-q3',
        concept: 'Recursão e pilha de chamadas',
        say: 'Pergunta de follow-up que eu adoro fazer depois de um código recursivo.',
        prompt: `Sobre esta função, qual afirmação é verdadeira?

\`\`\`python
def max_depth(raiz):
    if raiz is None:
        return 0
    return 1 + max(max_depth(raiz.left), max_depth(raiz.right))
\`\`\``,
        options: [
          { text: 'Tempo `O(n)` e espaço `O(h)`; numa árvore degenerada de 5.000 nós, o Python lança `RecursionError`.', correct: true, why: 'Cada nó é visitado uma vez, e a pilha guarda o caminho da raiz até o nó atual. Com 5.000 níveis, passa do limite padrão de ~1.000 chamadas.' },
          { text: 'Tempo `O(n log n)`, porque cada chamada divide a árvore em duas metades.', why: 'Não há trabalho extra por nível: cada nó é visitado exatamente uma vez, `O(n)`. E a árvore nem sempre se divide ao meio.' },
          { text: 'Espaço `O(1)`, porque a função não cria listas nem dicionários.', why: 'A **pilha de chamadas** conta como espaço: cada chamada pendente ocupa um frame.' },
          { text: 'Espaço `O(n)` sempre, mesmo numa árvore balanceada.', why: 'Numa árvore balanceada, nunca há mais de `h ≈ log n` chamadas abertas ao mesmo tempo.' },
        ],
        explanation: 'A profundidade da recursão acompanha a **altura**: `O(log n)` numa árvore balanceada, `O(n)` numa degenerada. Em Python isso pesa em dobro, porque o limite padrão é ~1.000 frames (`sys.getrecursionlimit()`). Se a árvore pode ser degenerada, use uma **pilha explícita** ou BFS por níveis — a profundidade máxima é o número de níveis.',
      },
      {
        type: 'code',
        id: 'lc-tree-q4',
        concept: 'BST',
        title: 'Validate Binary Search Tree',
        say: 'LeetCode 98. Lembra da armadilha do quadro? Os testes lembram.',
        prompt: `Implemente \`is_valid_bst(root)\`: devolva \`True\` se a árvore for uma **BST válida** e \`False\` caso contrário.

- Para **todo** nó, a subárvore esquerda só tem valores **estritamente menores** e a direita, **estritamente maiores**.
- Árvore vazia é válida. Os valores podem ser negativos ou extremos, como \`-2**31\`.
- Objetivo: **\`O(n)\`** — visite cada nó uma vez.`,
        starter: NODE + `

def is_valid_bst(root):
    pass
`,
        tests: [
          { name: 'válida', setup: ARV + 'raiz = _arvore([2, 1, 3])', expr: 'is_valid_bst(raiz)', expected: 'True' },
          { name: 'filho direito menor que a raiz', setup: ARV + 'raiz = _arvore([5, 1, 4, None, None, 3, 6])', expr: 'is_valid_bst(raiz)', expected: 'False' },
          { name: 'a armadilha: neto fora do intervalo', setup: ARV + 'raiz = _arvore([5, 4, 6, None, None, 3, 7])', expr: 'is_valid_bst(raiz)', expected: 'False' },
          { name: 'árvore vazia', expr: 'is_valid_bst(None)', expected: 'True' },
          { name: 'valores iguais não valem', setup: ARV + 'raiz = _arvore([2, 2, 2])', expr: 'is_valid_bst(raiz)', expected: 'False' },
          { name: 'um nó só', setup: ARV + 'raiz = _arvore([1])', expr: 'is_valid_bst(raiz)', expected: 'True' },
          { setup: ARV + 'raiz = _arvore([10, 5, 15, None, None, 6, 20])', expr: 'is_valid_bst(raiz)', expected: 'False', hidden: true },
          { setup: ARV + 'raiz = _arvore([-2**31, None, 2**31 - 1])', expr: 'is_valid_bst(raiz)', expected: 'True', hidden: true },
          { setup: ARV + 'raiz = _arvore([3, 1, 5, 0, 2, 4, 6])', expr: 'is_valid_bst(raiz)', expected: 'True', hidden: true },
          { setup: ARV + 'raiz = _arvore([32, 26, 47, 19, None, None, 56, None, 27])', expr: 'is_valid_bst(raiz)', expected: 'False', hidden: true },
        ],
        perfTests: [
          {
            name: 'espinha de 200 nós, cada um com uma subárvore de 63',
            setup: ARV + 'raiz = _espinha(200, 63)',
            expr: 'is_valid_bst(raiz)',
            expected: 'True',
            maxMs: 60,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Limites herdados — O(n)',
        reviews: [
          {
            when: m => m.calls.includes('max') || m.calls.includes('min'),
            text: 'Calcular o máximo/mínimo de cada subárvore, para cada nó, refaz o mesmo trabalho várias vezes: `O(n·h)`, que vira `O(n²)` numa árvore torta. Passe os **limites** `(menor, maior)` de cima para baixo e visite cada nó uma vez.',
            concept: 'BST',
          },
          {
            when: (m, code) => /2\s*\*\*\s*3[12]|10\s*\*\*\s*\d|maxsize|999999/.test(code),
            text: 'Limites "grandes" chumbados (`2**31`, `10**9`, `sys.maxsize`) quebram quando a árvore contém exatamente esse valor. Use `float("-inf")`/`float("inf")` — ou `None` para "sem limite".',
            concept: 'Casos de borda',
          },
        ],
        hints: [
          'Comparar só pai e filho não basta: cada nó precisa respeitar **todos** os ancestrais. Que informação você passaria para baixo?',
          'Escreva `valida(no, menor, maior)`: o valor precisa estar em `(menor, maior)`. À esquerda, chame com `(menor, no.val)`; à direita, com `(no.val, maior)`.',
          'Comece com `menor = float("-inf")` e `maior = float("inf")`, e use comparações **estritas** (`<`): iguais não valem.',
        ],
        solution: NODE + `

def is_valid_bst(root):
    def valida(no, menor, maior):
        if no is None:
            return True
        if not (menor < no.val < maior):
            return False
        return valida(no.left, menor, no.val) and valida(no.right, no.val, maior)

    return valida(root, float("-inf"), float("inf"))
`,
        solutionExplanation: 'Cada nó é visitado uma vez com o intervalo herdado dos ancestrais: **tempo `O(n)`**, **espaço `O(h)`** de pilha. O `and` ainda corta a busca no primeiro nó inválido. Os limites infinitos evitam o bug dos sentinelas chumbados (o teste com `-2**31`). Alternativa equivalente: em-ordem comparando cada valor com o anterior, que precisa ser estritamente menor.',
      },
      {
        type: 'match',
        id: 'lc-tree-q5',
        concept: 'Escolha da travessia',
        say: 'Bate-bola: cada travessia tem sua vocação.',
        prompt: 'Associe cada travessia (ou variação) ao problema em que ela é a escolha natural.',
        pairs: [
          { left: 'Pré-ordem (nó, esquerda, direita)', right: 'Copiar ou serializar a árvore: o pai vem antes dos filhos' },
          { left: 'Em-ordem (esquerda, nó, direita)', right: 'Listar os valores de uma BST em ordem crescente' },
          { left: 'Pós-ordem (esquerda, direita, nó)', right: 'Calcular alturas ou liberar nós: os filhos antes do pai' },
          { left: 'BFS por níveis', right: 'Menor profundidade até uma folha, parando no primeiro nível que tiver uma' },
          { left: 'DFS iterativa com pilha explícita', right: 'Árvore degenerada com 100 mil nós, sem `RecursionError`' },
        ],
        explanation: 'A pergunta-chave é **quando** o nó precisa ser processado: antes dos filhos (pré), entre eles (em — ordem crescente numa BST) ou depois (pós — quando o pai depende dos filhos). A BFS brilha em "o mais próximo da raiz": ela para no primeiro nível que resolve. E em Python, profundidade grande pede pilha explícita.',
      },
      {
        type: 'code',
        id: 'lc-tree-q6',
        concept: 'Menor ancestral comum',
        title: 'Lowest Common Ancestor of a BST',
        say: 'LeetCode 235. É uma BST — use isso a seu favor.',
        prompt: `Implemente \`lowest_common_ancestor(root, p, q)\`: \`root\` é uma **BST** com valores distintos, e \`p\` e \`q\` são **nós** dela. Devolva o **nó** que é o menor ancestral comum dos dois (um nó pode ser ancestral de si mesmo).

- \`p\` pode ser maior ou menor que \`q\`.
- Objetivo: **\`O(h)\`** — aproveite a ordem da BST; nada de percorrer a árvore inteira. O teste de desempenho faz 100 consultas numa árvore de 16.383 nós.`,
        starter: NODE + `

def lowest_common_ancestor(root, p, q):
    pass
`,
        tests: [
          { name: 'p = 2, q = 8', setup: ARV + BST_EX + 'p, q = _no(raiz, 2), _no(raiz, 8)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '6' },
          { name: 'p = 2, q = 4 (um é ancestral do outro)', setup: ARV + BST_EX + 'p, q = _no(raiz, 2), _no(raiz, 4)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '2' },
          { name: 'p = 3, q = 5', setup: ARV + BST_EX + 'p, q = _no(raiz, 3), _no(raiz, 5)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '4' },
          { name: 'p = 8, q = 2 (ordem trocada)', setup: ARV + BST_EX + 'p, q = _no(raiz, 8), _no(raiz, 2)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '6' },
          { name: 'p = 7, q = 9', setup: ARV + BST_EX + 'p, q = _no(raiz, 7), _no(raiz, 9)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '8' },
          { setup: ARV + BST_EX + 'p, q = _no(raiz, 0), _no(raiz, 5)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '2', hidden: true },
          { setup: ARV + BST_EX + 'p, q = _no(raiz, 3), _no(raiz, 9)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '6', hidden: true },
          { setup: ARV + 'raiz = _arvore([2, 1])\np, q = _no(raiz, 2), _no(raiz, 1)', expr: '_val(lowest_common_ancestor(raiz, p, q))', expected: '2', hidden: true },
          {
            setup: ARV + BST_EX,
            code: `r = lowest_common_ancestor(raiz, _no(raiz, 0), _no(raiz, 4))
assert r is raiz.left, "devolva o próprio nó da árvore (o 2), não uma cópia nem o valor"`,
            hidden: true,
          },
        ],
        perfTests: [
          {
            name: '100 consultas numa BST de 16.383 nós',
            setup: ARV + `import random as _random
raiz = _bst(0, 16383)


def _lca_ref(a, b):
    no = raiz
    while True:
        if a < no.val and b < no.val:
            no = no.left
        elif a > no.val and b > no.val:
            no = no.right
        else:
            return no.val


_rng = _random.Random(42)
_pares = [(_rng.randrange(16383), _rng.randrange(16383)) for _ in range(100)]
_pares = [(a, b) for a, b in _pares if a != b]
consultas = [(_no(raiz, a), _no(raiz, b)) for a, b in _pares]
_esperado = [_lca_ref(a, b) for a, b in _pares]`,
            expr: '[_val(lowest_common_ancestor(raiz, p, q)) for p, q in consultas]',
            expected: '_esperado',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Propriedade da BST — descer em O(h)',
        reviews: [
          {
            when: m => m.calls.includes('append'),
            text: 'Montar os caminhos da raiz até `p` e até `q` numa lista funciona, mas gasta memória extra — e, se a busca não usar a ordem da BST, `O(n)` de tempo. Descer **uma vez** comparando os valores resolve em `O(h)` com `O(1)` de espaço.',
            concept: 'Menor ancestral comum',
          },
        ],
        hints: [
          'Comece na raiz. Se `p.val` e `q.val` forem **ambos menores** que o valor do nó, onde está o LCA?',
          'Ambos menores: desça à esquerda. Ambos maiores: desça à direita. Qualquer outro caso: o nó atual separa os dois (ou é um deles).',
          'Um `while` simples resolve, sem recursão: `O(h)` de tempo e `O(1)` de espaço. Devolva o **nó**, não o valor.',
        ],
        solution: NODE + `

def lowest_common_ancestor(root, p, q):
    no = root
    while no:
        if p.val < no.val and q.val < no.val:
            no = no.left            # os dois estão à esquerda
        elif p.val > no.val and q.val > no.val:
            no = no.right           # os dois estão à direita
        else:
            return no               # o nó separa p e q (ou é um deles)
    return None
`,
        solutionExplanation: 'A cada passo descemos um nível, e o laço para no primeiro nó que separa `p` e `q`: **tempo `O(h)`** — `O(log n)` numa BST balanceada — e **espaço `O(1)`**. A solução genérica de árvore binária (LeetCode 236) também acertaria, mas visitaria a árvore inteira: `O(n)` por consulta, o que o teste de desempenho percebe.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! DFS em três sabores, BFS por níveis com `deque`, limites herdados para validar BST e o LCA descendo pela ordem da árvore.',
          { text: 'E o bordão da entrevista: **tempo `O(n)`, espaço `O(h)`** — e cuidado com a recursão em árvores degeneradas. Próximo: **heaps**!', mood: 'neutral' },
        ],
        board: null,
      },
    ],
  });
})();
