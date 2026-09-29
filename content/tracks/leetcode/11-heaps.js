(function () {
  // Classe usada nos starters/soluções e utilitários dos testes (rodam depois do código do jogador).
  const NODE = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
`;
  const LL = `def _montar(valores):
    sentinela = ListNode()
    cauda = sentinela
    for v in valores:
        cauda.next = ListNode(v)
        cauda = cauda.next
    return sentinela.next


def _valores(cabeca, limite=100000):
    saida = []
    while cabeca is not None and len(saida) < limite:
        saida.append(cabeca.val)
        cabeca = cabeca.next
    return saida

`;
  const MED = `def _medianas(nums):
    m = MedianFinder()
    saida = []
    for x in nums:
        m.add_num(x)
        saida.append(m.find_median())
    return saida

`;

  Game.registerModule('leetcode', {
    id: 'heaps',
    title: 'Heaps e filas de prioridade',
    kind: 'lesson',
    level: 2,
    order: 24,
    unit: 'estruturas',
    summary: 'O menor (ou o maior) sempre à mão: heapq, top-k em O(n log k), mesclar k listas e a mediana de um fluxo com dois heaps.',
    concepts: ['Heap', 'heapq', 'Top-k', 'Dois heaps'],
    takeaways: [
      'Heap é uma árvore completa guardada numa lista: `heap[0]` é sempre o menor; push e pop custam **`O(log n)`**, e `heapify` só **`O(n)`**.',
      'O `heapq` só faz min-heap: para max-heap, **negue os valores**; para desempatar, use tuplas `(prioridade, contador, item)`.',
      '**Top-k** com um heap de tamanho `k`: `O(n log k)` de tempo e `O(k)` de memória — os k **maiores** ficam num **min-heap**, cujo topo é o primeiro a ser expulso.',
      'Mesclar `k` listas ordenadas: o heap guarda só a **cabeça** de cada uma — `O(N log k)` para `N` elementos.',
      'Mediana em fluxo: **dois heaps** equilibrados (max-heap embaixo, min-heap em cima) — inserção `O(log n)`, mediana `O(1)`.',
    ],
    glossary: [
      { term: 'Heap', aliases: ['heaps', 'min-heap', 'max-heap', 'heap binário', 'binary heap'], definition: 'Árvore binária completa guardada numa lista em que cada pai é menor ou igual aos filhos (min-heap). O menor fica em `heap[0]`; inserir e remover o topo custam `O(log n)`.' },
      { term: 'Fila de prioridade', aliases: ['filas de prioridade', 'priority queue', 'priority queues'], definition: 'Tipo abstrato em que sempre sai o item de **maior prioridade** (menor chave), não o mais antigo. Em Python, é implementada com `heapq` sobre uma `list`.' },
      { term: 'Heapify', aliases: ['heapq.heapify'], definition: 'Transforma uma lista em heap **no lugar** e em `O(n)`, descendo os nós de baixo para cima (Floyd, 1964). Mais rápido que `n` chamadas de `heappush`, que custariam `O(n log n)`.' },
      { term: 'Top-k', aliases: ['top k', 'k maiores', 'k menores'], definition: 'Família de problemas "os k maiores/menores/mais frequentes". Com um heap de tamanho k: `O(n log k)` de tempo e `O(k)` de memória, mesmo num stream que não cabe na memória.' },
      { term: 'Lazy deletion', aliases: ['remoção preguiçosa'], definition: 'Em vez de remover um item do meio do heap (`O(n)`), marque-o como inválido e descarte-o quando ele chegar ao topo. Contorna a falta de `decrease-key` no `heapq` — é o truque do Dijkstra em Python.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **heap**: a estrutura que responde "qual é o menor?" em `O(1)` e se atualiza em `O(log n)`.',
          'Agendadores de tarefas, Dijkstra, "os 10 mais vendidos", mesclar arquivos gigantes… tem heap por trás de tudo isso.',
        ],
        board: {
          title: 'Heap — a ideia',
          md: `Um **min-heap** é uma árvore binária **completa** em que todo pai é **≤** seus filhos. Por ser completa, ela cabe numa \`list\`, sem ponteiros:

\`\`\`text
lista:   [1, 3, 2, 7, 4, 5]
índice:   0  1  2  3  4  5

              1              pai de i:     (i - 1) // 2
            /   \\            filhos de i:  2i + 1 e 2i + 2
           3     2
          / \\   /
         7   4 5
\`\`\`

| Operação | Custo |
|---|---|
| Ver o menor (\`heap[0]\`) | \`O(1)\` |
| Inserir (\`heappush\`) — o item **sobe** até o lugar certo | \`O(log n)\` |
| Remover o menor (\`heappop\`) — o último vai ao topo e **desce** | \`O(log n)\` |
| Montar a partir de uma lista (\`heapify\`) | \`O(n)\` |
| Procurar um valor qualquer | \`O(n)\` |

> [!atencao] A lista de um heap **não está ordenada**: só \`heap[0]\` tem garantia. \`[1, 3, 2, 7, 4, 5]\` é um heap válido — e \`heap[-1]\` não é o maior.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Em Python, o heap é uma `list` comum manipulada pelas funções do módulo `heapq`.',
          'Detalhe importante: o `heapq` só faz **min-heap**. Para max-heap, o truque é guardar os valores **negados**.',
        ],
        board: {
          title: 'heapq na prática',
          md: `\`\`\`python
import heapq

h = []
heapq.heappush(h, 5)
heapq.heappush(h, 1)
heapq.heappush(h, 3)
h[0]                        # 1 — espiar o topo: O(1)
heapq.heappop(h)            # 1 — remover o topo: O(log n)
heapq.heapify(nums)         # transforma nums em heap, no lugar, em O(n)
heapq.heappushpop(h, x)     # push + pop numa operação só (mais rápido)
heapq.heapreplace(h, x)     # pop + push (o heap não pode estar vazio)

# Max-heap: guarde os valores NEGADOS
maxh = []
for x in [5, 1, 8]:
    heapq.heappush(maxh, -x)
-maxh[0]                    # 8

# Prioridade com desempate: tuplas comparam campo a campo
tarefas = []
heapq.heappush(tarefas, (2, 0, "deploy"))    # (prioridade, contador, item)
heapq.heappush(tarefas, (1, 1, "hotfix"))
heapq.heappop(tarefas)                       # (1, 1, 'hotfix')
\`\`\`

> [!dica] O **contador** no meio da tupla desempata prioridades iguais **antes** de comparar os itens — que podem nem ser comparáveis (um \`dict\`, um \`ListNode\`…).

> [!sabia] Montar um heap com \`heapify\` custa **\`O(n)\`**, não \`O(n log n)\`. O truque, de **Robert Floyd (1964)**, é descer os nós de baixo para cima: metade dos nós são folhas e não descem nada, um quarto desce no máximo 1 nível, um oitavo no máximo 2… e a soma \`n/4·1 + n/8·2 + n/16·3 + …\` fica abaixo de \`n\`. Por isso \`heapify(lista)\` ganha de \`n\` chamadas de \`heappush\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o padrão mais cobrado: **top-k**. "Os 10 maiores de um bilhão de números" — e não cabe tudo na memória.',
          'A sacada parece ao contrário: para os k **maiores**, use um **min-heap** de tamanho k. O topo é o **pior** dos escolhidos, o primeiro a ser expulso.',
        ],
        board: {
          title: 'Top-k: um heap de tamanho k',
          md: `Exemplo com os k **menores** — a versão espelhada, com max-heap (valores negados):

\`\`\`python
import heapq

def k_menores(stream, k):
    heap = []                              # max-heap (negado) com os k menores até agora
    for x in stream:
        if len(heap) < k:
            heapq.heappush(heap, -x)
        elif x < -heap[0]:                 # menor que o MAIOR dos k menores?
            heapq.heapreplace(heap, -x)    # expulsa o maior e entra x
    return sorted(-v for v in heap)
\`\`\`

| Abordagem | Tempo | Memória extra |
|---|---|---|
| Ordenar tudo e fatiar | \`O(n log n)\` | \`O(n)\` |
| \`heapify\` em tudo + k pops | \`O(n + k log n)\` | \`O(n)\` |
| **Heap de tamanho k** | **\`O(n log k)\`** | **\`O(k)\`** — funciona em stream |
| Quickselect | \`O(n)\` médio, \`O(n²)\` no pior caso | \`O(1)\` (mexe na entrada) |

> [!dica] \`heapq.nlargest(k, it)\` e \`heapq.nsmallest(k, it)\` já fazem isso — e aceitam \`key=\`. Em entrevista, saiba escrever o laço; no trabalho, use a biblioteca.`,
        },
      },
      {
        type: 'say',
        text: [
          'Outro clássico: **mesclar k listas ordenadas** (LeetCode 23).',
          'O heap guarda só a **cabeça atual de cada lista** — no máximo k itens. Sai o menor, entra o próximo da mesma lista.',
        ],
        board: {
          title: 'Mesclar k listas ordenadas',
          md: `\`\`\`text
A: 1 -> 4 -> 7        no heap: 1 (A), 2 (B), 3 (C)   -> sai 1, entra 4 (de A)
B: 2 -> 5             no heap: 2 (B), 3 (C), 4 (A)   -> sai 2, entra 5 (de B)
C: 3 -> 6 -> 9        no heap: 3 (C), 4 (A), 5 (B)   -> sai 3, entra 6 (de C)
                      ...
\`\`\`

Cada um dos \`N\` elementos entra e sai do heap **uma vez**, e o heap nunca passa de \`k\` itens: **\`O(N log k)\`** de tempo e \`O(k)\` de memória extra.

Para iteráveis comuns, o Python já traz pronto:

\`\`\`python
import heapq

list(heapq.merge([1, 4, 7], [2, 5], [3, 6, 9]))   # [1, 2, 3, 4, 5, 6, 7, 9]
\`\`\`

\`heapq.merge\` é **preguiçoso**: devolve um iterador e nunca carrega tudo na memória — ótimo para mesclar arquivos ordenados gigantes, o passo final de um *external sort*.

> [!atencao] Com nós (\`ListNode\`), \`heappush(heap, (no.val, no))\` quebra quando dois valores empatam: o Python tenta comparar os nós e lança \`TypeError: '<' not supported\`. Ponha um desempate no meio: \`(no.val, i, no)\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o problema "difícil" mais elegante da lista: a **mediana de um fluxo** de números (LeetCode 295).',
          'A ideia: dividir os números em duas metades e manter o **maior da metade de baixo** e o **menor da metade de cima** sempre no topo.',
        ],
        board: {
          title: 'Mediana em fluxo: dois heaps',
          md: `\`\`\`text
 metade de baixo (max-heap, negados)       metade de cima (min-heap)
   [ 1  2  3  5 ]    topo = 5       |      topo = 7    [ 7  8  9 ]

 total ímpar: mediana = topo de baixo                       -> aqui, 5
 total par:   mediana = (topo de baixo + topo de cima) / 2
\`\`\`

**Invariantes** (valem depois de cada inserção):

1. tudo em \`baixo\` ≤ tudo em \`alto\` — basta comparar os topos: \`-baixo[0] <= alto[0]\`;
2. \`len(baixo) == len(alto)\` ou \`len(baixo) == len(alto) + 1\`.

| Operação | Custo |
|---|---|
| Inserir um número (1 a 3 operações de heap) | \`O(log n)\` |
| Consultar a mediana (olhar os topos) | \`O(1)\` |

> [!dica] Por que não uma lista ordenada com \`bisect.insort\`? A busca da posição é \`O(log n)\`, mas **inserir no meio** desloca os elementos seguintes: \`O(n)\` por número.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Por fim, os limites. O `heapq` é enxuto — e isso tem preço.',
        ],
        board: {
          title: 'Armadilhas e limites do heapq',
          md: `| Armadilha | Como lidar |
|---|---|
| Não existe max-heap | Negue os valores (ou use \`(-prioridade, ...)\`) |
| Itens não comparáveis empatam | Tupla \`(prioridade, contador, item)\` |
| Não há \`decrease-key\` nem remoção do meio | **Lazy deletion**: marque o item como removido e descarte-o quando chegar ao topo |
| Procurar se um valor está no heap | \`O(n)\`: heap não é índice (use um \`dict\` ao lado) |
| \`heap[-1]\` como "o maior" | Errado: só \`heap[0]\` tem garantia |

> [!dica] A própria documentação do \`heapq\` traz uma receita de fila de prioridade com *lazy deletion*: um \`dict\` aponta para a entrada de cada tarefa, e "remover" só troca a tarefa por um marcador \`REMOVED\`. É assim que implementações do Dijkstra em Python contornam a falta de \`decrease-key\`.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'heapq, top-k, mesclar k listas e a mediana em fluxo.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'lc-heap-q1',
        concept: 'heapq e max-heap',
        say: 'Aquecimento: o que sai daqui? Cuidado com os sinais.',
        prompt: `O que este código imprime?

\`\`\`python
import heapq

h = []
for x in [5, 1, 8, 3, 9]:
    heapq.heappush(h, -x)

print(-h[0], -heapq.heappop(h), -heapq.heappop(h), len(h))
\`\`\``,
        options: [
          { text: '`9 9 8 3`', correct: true, why: 'Os valores negados transformam o min-heap num max-heap: `h[0]` espia o maior (sem remover) e cada `heappop` tira o maior restante.' },
          { text: '`1 1 3 3`', why: 'Seria o comportamento **sem** negar os valores: um min-heap entrega o menor primeiro.' },
          { text: '`9 8 5 3`', why: '`h[0]` só **espia** o topo, não remove: o primeiro `heappop` ainda devolve o 9.' },
          { text: '`-9 -9 -8 3`', why: 'O código desfaz o sinal com `-` ao ler; sem isso, sairiam os negativos.' },
        ],
        explanation: 'O `heapq` só implementa **min-heap**. O truque é guardar `-x`: o menor negado é o maior original. Leia com `-h[0]` (espiar, `O(1)`) e `-heappop(h)` (remover, `O(log n)`). Com objetos, a mesma ideia vira tupla: `(-prioridade, contador, item)`.',
      },
      {
        type: 'code',
        id: 'lc-heap-q2',
        concept: 'Top-k',
        title: 'Kth Largest Element',
        say: 'LeetCode 215, com uma exigência de entrevista: memória O(k), como se os números viessem de um stream.',
        prompt: `Implemente \`kth_largest(nums, k)\`: devolva o **k-ésimo maior** elemento de \`nums\` na ordem decrescente — repetidos contam (em \`[3, 2, 3, 1]\`, o 2º maior é \`3\`).

- Garantia: \`1 <= k <= len(nums)\`.
- **Não modifique** \`nums\`.
- Objetivo: **\`O(n log k)\` de tempo e \`O(k)\` de memória extra**, com um heap de tamanho \`k\`. O teste de desempenho tem 60.000 números e \`k = 500\`.`,
        starter: `import heapq


def kth_largest(nums, k):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'kth_largest([3, 2, 1, 5, 6, 4], 2)', expected: '5' },
          { name: 'repetidos contam', expr: 'kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)', expected: '4' },
          { name: 'k = 1 (o máximo)', expr: 'kth_largest([7, -2, 7], 1)', expected: '7' },
          { name: 'k = n (o mínimo)', expr: 'kth_largest([4, 1, 9], 3)', expected: '1' },
          { name: 'um elemento', expr: 'kth_largest([-1], 1)', expected: '-1' },
          {
            name: 'não modifica a entrada',
            code: `nums = [5, 3, 8, 1]
assert kth_largest(nums, 2) == 5
assert nums == [5, 3, 8, 1], "não modifique a lista recebida"`,
          },
          { expr: 'kth_largest([-5, -1, -10, -3], 2)', expected: '-3', hidden: true },
          { expr: 'kth_largest([2, 2, 2, 2], 3)', expected: '2', hidden: true },
          { expr: 'kth_largest(list(range(100)), 10)', expected: '90', hidden: true },
        ],
        perfTests: [
          {
            name: 'n = 60.000, k = 500',
            setup: 'import random as _r\n_g = _r.Random(11)\nnums = [_g.randint(-10**6, 10**6) for _ in range(60000)]\n_esperado = sorted(nums, reverse=True)[499]',
            expr: 'kth_largest(nums, 500)',
            expected: '_esperado',
            maxMs: 40,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Heap de tamanho k — O(n log k)',
        reviews: [
          {
            when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
            text: 'Ordenar tudo custa `O(n log n)` de tempo e `O(n)` de memória. Com um **min-heap de tamanho k** você guarda só os k maiores: `O(n log k)` e `O(k)` — e funciona até num stream que não cabe na memória.',
            concept: 'Top-k',
          },
          {
            when: m => m.calls.includes('remove'),
            text: 'Tirar o máximo `k` vezes com `max()` + `remove()` percorre a lista a cada rodada: `O(n·k)`. Um heap de tamanho k resolve em uma passada.',
            concept: 'Top-k',
          },
        ],
        hints: [
          'Mantenha um heap com os **k maiores** vistos até agora. Qual deles você expulsaria se chegasse um número melhor?',
          'O candidato a sair é o **menor** dos k maiores — por isso, um **min-heap**: ele fica em `heap[0]`.',
          'Para cada `x`: se o heap tem menos de `k` itens, `heappush`; senão, se `x > heap[0]`, `heapreplace(heap, x)`. No fim, `heap[0]` é a resposta.',
        ],
        solution: `import heapq


def kth_largest(nums, k):
    heap = []                             # min-heap com os k maiores vistos até agora
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:                 # maior que o menor dos k maiores?
            heapq.heapreplace(heap, x)    # troca o menor por x
    return heap[0]                        # o menor dos k maiores = k-ésimo maior
`,
        solutionExplanation: 'Cada número custa no máximo uma operação de heap com `k` itens: **tempo `O(n log k)`**, **memória `O(k)`**. O topo do min-heap é o menor dos k maiores — exatamente o k-ésimo maior. Números que não superam o topo são descartados em `O(1)`. `heapq.nlargest(k, nums)[-1]` faz o mesmo; e o *quickselect* chega a `O(n)` em média, mas precisa de todos os dados na memória e tem pior caso `O(n²)`.',
      },
      {
        type: 'match',
        id: 'lc-heap-q3',
        concept: 'Padrões com heap',
        say: 'Bate-bola: qual arranjo de heap resolve cada problema?',
        prompt: 'Associe cada problema à estratégia com heap mais adequada.',
        pairs: [
          { left: 'Os k **maiores** de um stream enorme', right: 'Min-heap de tamanho k (o topo é o menor dos k)' },
          { left: 'Os k **menores** de um stream enorme', right: 'Max-heap de tamanho k (valores negados)' },
          { left: 'Mediana de um fluxo de números', right: 'Dois heaps: max-heap embaixo, min-heap em cima' },
          { left: 'Mesclar k listas ordenadas', right: 'Heap com a cabeça atual de cada lista' },
          { left: 'Agendador: sempre a tarefa de menor prazo', right: 'Heap de tuplas `(prazo, contador, tarefa)`' },
        ],
        explanation: 'Nos problemas de top-k, o topo do heap guarda o **pior** dos escolhidos — o próximo a ser expulso —, por isso os k maiores usam min-heap e os k menores, max-heap. A mediana precisa dos **dois** lados do meio ao mesmo tempo. E sempre que houver empate possível entre itens não comparáveis, um contador na tupla resolve.',
      },
      {
        type: 'code',
        id: 'lc-heap-q4',
        concept: 'Mesclar k listas',
        title: 'Merge k Sorted Lists',
        say: 'LeetCode 23 — classificado como difícil, mas com heap fica curtinho. Cuidado com os empates!',
        prompt: `Implemente \`merge_k_lists(lists)\`: recebe uma lista com as cabeças de **k listas ligadas ordenadas** (algumas podem ser \`None\`) e devolve a cabeça de uma única lista ordenada com todos os valores.

- \`lists\` pode ser vazia.
- \`ListNode\` **não** implementa \`<\`, e dois nós podem ter o mesmo valor.
- Objetivo: **\`O(N log k)\`**, sendo \`N\` o total de nós. O teste de desempenho tem 300 listas com 50 nós cada.`,
        starter: NODE + `
import heapq


def merge_k_lists(lists):
    pass
`,
        tests: [
          { name: 'exemplo', setup: LL + 'listas = [_montar(v) for v in [[1, 4, 5], [1, 3, 4], [2, 6]]]', expr: '_valores(merge_k_lists(listas))', expected: '[1, 1, 2, 3, 4, 4, 5, 6]' },
          { name: 'nenhuma lista', expr: 'merge_k_lists([])', expected: 'None' },
          { name: 'só listas vazias', expr: 'merge_k_lists([None, None])', expected: 'None' },
          { name: 'uma lista', setup: LL + 'listas = [_montar([1, 2, 3])]', expr: '_valores(merge_k_lists(listas))', expected: '[1, 2, 3]' },
          { name: 'valores empatados', setup: LL + 'listas = [_montar(v) for v in [[2, 2], [2], [1, 2]]]', expr: '_valores(merge_k_lists(listas))', expected: '[1, 2, 2, 2, 2]' },
          { setup: LL + 'listas = [_montar(v) for v in [[-3, 0, 10], [], [-3, 5], [0]]]', expr: '_valores(merge_k_lists(listas))', expected: '[-3, -3, 0, 0, 5, 10]', hidden: true },
          { setup: LL + 'listas = [_montar(v) for v in [[5], [1], [3], [2], [4]]]', expr: '_valores(merge_k_lists(listas))', expected: '[1, 2, 3, 4, 5]', hidden: true },
        ],
        perfTests: [
          {
            name: '300 listas × 50 nós',
            setup: LL + 'listas = [_montar(range(j, 15000, 300)) for j in range(300)]',
            expr: '_valores(merge_k_lists(listas))',
            expected: 'list(range(15000))',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Heap com as k cabeças — O(N log k)',
        reviews: [
          {
            when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
            text: 'Juntar tudo e ordenar custa `O(N log N)` e ignora que cada lista já vem ordenada. Um heap só com a cabeça de cada lista faz `O(N log k)` com `O(k)` de memória extra — e funciona com streams.',
            concept: 'Mesclar k listas',
          },
          {
            when: m => m.calls.includes('min'),
            text: 'Procurar a menor cabeça com `min()` a cada passo custa `O(k)` por nó: `O(N·k)` no total. O heap entrega a menor cabeça em `O(log k)`.',
            concept: 'Mesclar k listas',
          },
        ],
        hints: [
          'Coloque no heap a **cabeça** de cada lista não vazia. O menor valor do heap é o próximo da resposta.',
          'Use tuplas `(no.val, i, no)`: o índice `i` da lista desempata valores iguais **antes** de o Python tentar comparar dois `ListNode`.',
          'Com um nó sentinela: `heappop` o menor, pendure-o em `cauda.next`, avance a cauda e, se `no.next` existir, empurre `(no.next.val, i, no.next)`.',
        ],
        solution: NODE + `
import heapq


def merge_k_lists(lists):
    # (valor, índice da lista, nó): o índice desempata e evita comparar dois ListNode
    heap = [(no.val, i, no) for i, no in enumerate(lists) if no]
    heapq.heapify(heap)
    sentinela = ListNode()
    cauda = sentinela
    while heap:
        _, i, no = heapq.heappop(heap)
        cauda.next = no
        cauda = no
        if no.next:
            heapq.heappush(heap, (no.next.val, i, no.next))
    return sentinela.next
`,
        solutionExplanation: 'O heap nunca passa de `k` itens e cada um dos `N` nós entra e sai uma vez: **tempo `O(N log k)`**, **memória extra `O(k)`** (os nós são reaproveitados). O `i` na tupla é essencial: sem ele, dois valores iguais fariam o Python comparar os nós e lançar `TypeError`. Mesclar as listas em pares, em rodadas (dividir e conquistar), também dá `O(N log k)`; já mesclar uma a uma, em sequência, custa `O(N·k)`.',
      },
      {
        type: 'code',
        id: 'lc-heap-q5',
        concept: 'Dois heaps',
        title: 'Find Median from Data Stream',
        say: 'LeetCode 295. Dois heaps, duas invariantes — e nada de ordenar a cada consulta.',
        prompt: `Implemente a classe \`MedianFinder\`:

- \`add_num(num)\` adiciona um inteiro ao fluxo;
- \`find_median()\` devolve a **mediana** de tudo que já entrou, como \`float\` — com quantidade par, a média dos dois do meio.

Objetivo: \`add_num\` em **\`O(log n)\`** e \`find_median\` em **\`O(1)\`**. O teste de desempenho intercala 5.000 inserções com 5.000 consultas.`,
        starter: `import heapq


class MedianFinder:
    def __init__(self):
        pass

    def add_num(self, num):
        pass

    def find_median(self):
        pass
`,
        tests: [
          { name: 'exemplo', setup: MED, expr: '_medianas([1, 2, 3])', expected: '[1.0, 1.5, 2.0]' },
          { name: 'um número', setup: MED, expr: '_medianas([5])', expected: '[5.0]' },
          { name: 'ordem decrescente', setup: MED, expr: '_medianas([5, 4, 3, 2, 1])', expected: '[5.0, 4.5, 4.0, 3.5, 3.0]' },
          { name: 'negativos', setup: MED, expr: '_medianas([-1, -2, -3, -4])', expected: '[-1.0, -1.5, -2.0, -2.5]' },
          { name: 'repetidos', setup: MED, expr: '_medianas([2, 2, 2, 7])', expected: '[2.0, 2.0, 2.0, 2.0]' },
          {
            name: 'instâncias independentes',
            code: `a = MedianFinder()
b = MedianFinder()
a.add_num(1)
a.add_num(3)
b.add_num(100)
assert a.find_median() == 2.0 and b.find_median() == 100.0, "cada MedianFinder precisa dos próprios heaps (crie as listas no __init__)"`,
          },
          { setup: MED, expr: '_medianas([6, 10, 2, 6, 5, 0, 6, 3, 1, 0, 0])', expected: '[6.0, 8.0, 6.0, 6.0, 6.0, 5.5, 6.0, 5.5, 5.0, 4.0, 3.0]', hidden: true },
          { setup: MED, expr: '_medianas([1000000, -1000000, 0, 7])', expected: '[1000000.0, 0.0, 0.0, 3.5]', hidden: true },
          {
            code: `m = MedianFinder()
for x in (4, 8, 1):
    m.add_num(x)
assert m.find_median() == 4.0
assert m.find_median() == 4.0, "find_median não deve alterar os heaps"
m.add_num(10)
assert m.find_median() == 6.0`,
            hidden: true,
          },
        ],
        perfTests: [
          {
            name: '5.000 inserções, uma consulta após cada',
            setup: MED + `import random as _r
import bisect as _b
_g = _r.Random(3)
dados = [_g.randint(-10**5, 10**5) for _ in range(5000)]
_esperado = []
_s = []
for _x in dados:
    _b.insort(_s, _x)
    _n = len(_s)
    _esperado.append(float(_s[_n // 2]) if _n % 2 else (_s[_n // 2 - 1] + _s[_n // 2]) / 2)`,
            expr: '_medianas(dados)',
            expected: '_esperado',
            maxMs: 30,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Dois heaps — mediana em O(1)',
        reviews: [
          {
            when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
            text: 'Ordenar a cada `find_median` custa `O(n log n)` por consulta (ou `O(n)`, no melhor caso do Timsort). Com dois heaps, a mediana fica sempre nos topos: `O(1)` para ler e `O(log n)` para inserir.',
            concept: 'Dois heaps',
          },
          {
            when: m => m.calls.includes('insort') || m.imports.includes('bisect'),
            text: '`bisect.insort` acha a posição em `O(log n)`, mas **inserir** no meio da lista desloca os elementos seguintes: `O(n)` por número. É rápido na prática (um `memmove`), mas cresce linearmente; dois heaps garantem `O(log n)`.',
            concept: 'Dois heaps',
          },
        ],
        hints: [
          'Guarde a metade **menor** num max-heap (`baixo`, com valores negados) e a metade **maior** num min-heap (`alto`). Crie as duas listas no `__init__`.',
          'Um jeito sem muitos `if`s: empurre `-num` em `baixo`; mova o maior de `baixo` para `alto`; se `alto` ficar maior que `baixo`, devolva o menor de `alto` para `baixo`.',
          'Mediana: se `baixo` tiver um a mais, é `-baixo[0]`; senão, `(-baixo[0] + alto[0]) / 2`.',
        ],
        solution: `import heapq


class MedianFinder:
    def __init__(self):
        self.baixo = []   # max-heap (valores negados): a metade menor
        self.alto = []    # min-heap: a metade maior

    def add_num(self, num):
        # passar pelo baixo garante que todo item de baixo <= todo item de alto
        heapq.heappush(self.baixo, -num)
        heapq.heappush(self.alto, -heapq.heappop(self.baixo))
        # rebalanceia: baixo fica com o item extra quando o total é ímpar
        if len(self.alto) > len(self.baixo):
            heapq.heappush(self.baixo, -heapq.heappop(self.alto))

    def find_median(self):
        if len(self.baixo) > len(self.alto):
            return float(-self.baixo[0])
        return (-self.baixo[0] + self.alto[0]) / 2
`,
        solutionExplanation: 'Cada `add_num` faz no máximo três operações de heap: **`O(log n)`**; `find_median` só lê os topos: **`O(1)`**. Passar sempre pelo `baixo` antes do `alto` mantém a invariante de ordem sem comparações manuais, e o rebalanceamento mantém os tamanhos iguais ou com um a mais embaixo. As listas nascem no `__init__`: atributos de classe seriam **compartilhados** entre instâncias — o bug que o teste "instâncias independentes" pega.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Heap para o menor (ou o maior, negando), heap de tamanho k para top-k, heap de cabeças para mesclar e dois heaps para a mediana.',
          { text: 'Guarde a frase de entrevista: "com heap, `O(n log k)` de tempo e `O(k)` de memória". Nos grafos, o heap volta como motor do Dijkstra!', mood: 'neutral' },
        ],
        board: null,
      },
    ],
  });
})();
