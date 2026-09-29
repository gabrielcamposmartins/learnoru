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
  const CICLO = `_nos = []


def _montar_ciclo(valores, pos):
    """Monta a lista; se pos >= 0, o último nó aponta de volta para o nó de índice pos."""
    _nos.clear()
    _nos.extend(ListNode(v) for v in valores)
    for a, b in zip(_nos, _nos[1:]):
        a.next = b
    if _nos and pos >= 0:
        _nos[-1].next = _nos[pos]
    return _nos[0] if _nos else None


def _indice(no):
    if no is None:
        return None
    for i, x in enumerate(_nos):
        if x is no:
            return i
    return "nó que não pertence à lista"

`;

  Game.registerModule('leetcode', {
    id: 'linked-list',
    title: 'Listas Ligadas',
    kind: 'lesson',
    level: 2,
    order: 22,
    unit: 'estruturas',
    summary: 'Ponteiros sem medo: inverter, mesclar com nó sentinela, achar o meio e detectar ciclos com a tartaruga e a lebre.',
    concepts: ['Lista ligada', 'Nó sentinela', 'Ponteiros lento/rápido', 'Tartaruga e lebre'],
    takeaways: [
      'Lista ligada troca o acesso por índice (`O(n)`) por inserção e remoção **`O(1)` quando você já tem o nó** — e cada nó é um objeto separado na memória.',
      'Para inverter, três ponteiros: guarde `proximo`, vire `atual.next` para `anterior` e avance os dois. **Tempo `O(n)`, espaço `O(1)`.**',
      'Um **nó sentinela** antes da cabeça elimina os casos especiais ("lista vazia", "quem é a nova cabeça?"): no fim, devolva `sentinela.next`.',
      '**Lento/rápido**: quando o rápido (2 passos) chega ao fim, o lento (1 passo) está no meio; se houver ciclo, eles **se encontram** — e a fase 2 de Floyd acha o início do ciclo com `O(1)` de memória.',
      'Em Python, recursão sobre listas longas estoura o limite (~1.000 chamadas): prefira a versão **iterativa**.',
    ],
    glossary: [
      { term: 'Lista ligada', aliases: ['listas ligadas', 'lista encadeada', 'listas encadeadas', 'linked list', 'linked lists'], definition: 'Sequência de nós em que cada nó guarda um valor e uma referência para o próximo. Inserir ou remover um nó conhecido custa `O(1)`; acessar o i-ésimo elemento custa `O(n)`.' },
      { term: 'Nó sentinela', aliases: ['nós sentinela', 'dummy node', 'nó dummy', 'nó fictício'], definition: 'Nó falso colocado antes da cabeça da lista. Com ele, todo nó real tem um "anterior" e a resposta é sempre `sentinela.next` — somem os casos especiais de lista vazia e de troca da cabeça.' },
      { term: 'Ponteiros lento/rápido', aliases: ['lento/rápido', 'ponteiro lento', 'ponteiro rápido', 'fast/slow pointers', 'fast and slow pointers'], definition: 'Dois ponteiros que percorrem a mesma estrutura em velocidades diferentes (tipicamente 1 e 2 passos). Acham o meio de uma lista numa só passada e detectam ciclos.' },
      { term: 'Tartaruga e lebre', aliases: ['algoritmo de Floyd', 'ciclo de Floyd', 'tortoise and hare', "Floyd's cycle detection"], definition: 'Detecção de ciclo com dois ponteiros: a tartaruga anda 1 passo e a lebre 2. Se há ciclo, elas se encontram; depois, andando juntas de 1 em 1 (uma a partir da cabeça), chegam ao início do ciclo. `O(n)` de tempo e `O(1)` de memória.' },
      { term: 'Algoritmo de Brent', aliases: ["Brent's algorithm", 'método de Brent'], definition: 'Variante da detecção de ciclo (Richard Brent, 1980): a lebre anda sozinha e a tartaruga "se teletransporta" até ela a cada potência de 2. Também usa `O(1)` de memória e costuma fazer menos passos que o de Floyd.' },
      { term: 'Unrolled linked list', aliases: ['unrolled linked lists', 'lista ligada desenrolada'], definition: 'Lista ligada em que cada nó guarda um **bloco** de elementos. Menos ponteiros e melhor uso de cache. O `collections.deque` do CPython é uma lista duplamente ligada de blocos de 64 itens.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **ponteiros**: listas ligadas aparecem muito em entrevista justamente porque é fácil se perder neles.',
          'A boa notícia: são poucos padrões. Dominando quatro, você resolve a maioria dos problemas.',
        ],
        board: {
          title: 'Lista ligada — o básico',
          md: `Cada **nó** guarda um valor e uma referência para o próximo. A lista é só a referência para o primeiro nó, a **cabeça**.

\`\`\`python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

# 1 -> 2 -> 3 -> None
cabeca = ListNode(1, ListNode(2, ListNode(3)))
\`\`\`

| Operação | \`list\` do Python (array) | Lista ligada |
|---|---|---|
| Acessar o i-ésimo | \`O(1)\` | \`O(n)\` — precisa andar |
| Inserir/remover no início | \`O(n)\` | \`O(1)\` |
| Inserir/remover **depois de um nó conhecido** | \`O(n)\` | \`O(1)\` |
| Memória por elemento | uma referência | um objeto inteiro por nó |

> [!dica] No dia a dia de Python você quase nunca escreve uma lista ligada: \`list\` e \`collections.deque\` resolvem. Em entrevista, ela testa se você manipula **referências** sem perder pedaços da estrutura.

> [!sabia] O \`collections.deque\` do CPython é, por dentro, uma **unrolled linked list**: uma lista duplamente ligada de **blocos de 64 itens**. Menos ponteiros, melhor uso de cache — e \`appendleft\`/\`popleft\` em \`O(1)\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O clássico dos clássicos: **inverter** a lista (LeetCode 206).',
          'O segredo é guardar o próximo nó **antes** de virar o ponteiro. Se você virar primeiro, perde o resto da lista.',
        ],
        board: {
          title: 'Inverter com três ponteiros',
          md: `Três referências andam juntas pela lista: \`anterior\`, \`atual\` e \`proximo\`.

\`\`\`text
início:   None    1 -> 2 -> 3 -> None
          ant     at

passo 1:  None <- 1    2 -> 3 -> None
                  ant  at

passo 2:  None <- 1 <- 2    3 -> None
                       ant  at

fim:      None <- 1 <- 2 <- 3        at = None: a nova cabeça é ant
                            ant
\`\`\`

A cada passo, **nesta ordem**:

1. guarde o resto da lista (\`proximo\`) — senão ele se perde;
2. vire o ponteiro do nó atual para trás;
3. avance \`anterior\` e \`atual\` uma casa.

**Tempo \`O(n)\`**, **espaço \`O(1)\`**: nenhum nó novo é criado — só os \`next\` mudam.

> [!atencao] A versão recursiva também funciona, mas usa um frame de pilha por nó. Com mais de ~1.000 nós, o Python lança \`RecursionError\` (veja \`sys.getrecursionlimit()\`).`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora um truque que limpa muito código: o **nó sentinela** (ou *dummy node*).',
          'Você cria um nó falso **antes** da cabeça. Assim, todo nó de verdade tem um "anterior" — inclusive o primeiro.',
        ],
        board: {
          title: 'Nó sentinela: menos casos especiais',
          md: `Remover todos os nós com um valor (LeetCode 203), sem e com sentinela:

\`\`\`python
# Sem sentinela: remover a cabeça vira um caso especial
def remove_elements(head, val):
    while head and head.val == val:
        head = head.next
    atual = head
    while atual and atual.next:
        if atual.next.val == val:
            atual.next = atual.next.next
        else:
            atual = atual.next
    return head


# Com sentinela: todo nó tem um "anterior"
def remove_elements(head, val):
    sentinela = ListNode(0, head)
    atual = sentinela
    while atual.next:
        if atual.next.val == val:
            atual.next = atual.next.next    # pula o nó
        else:
            atual = atual.next
    return sentinela.next                   # a cabeça pode ter mudado!
\`\`\`

O mesmo truque vale para **construir** uma lista: crie o sentinela, pendure cada nó em \`cauda.next\`, avance \`cauda\` e, no fim, devolva \`sentinela.next\` — sem \`if\` para decidir quem é a cabeça.

> [!dica] O sentinela nunca é devolvido: ele só existe para que o primeiro nó real não seja diferente dos outros.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Próximo padrão: **ponteiros lento e rápido**. O lento anda 1 nó por vez; o rápido, 2.',
          'Quando o rápido chega ao fim, o lento fez metade do caminho: está no **meio** — numa passada só, sem contar o tamanho antes.',
        ],
        board: {
          title: 'Lento/rápido: o nó do meio',
          md: `\`\`\`python
def middle_node(head):
    lenta = rapida = head
    while rapida and rapida.next:
        lenta = lenta.next            # 1 passo
        rapida = rapida.next.next     # 2 passos
    return lenta
\`\`\`

\`\`\`text
1 -> 2 -> 3 -> 4 -> 5

lenta:  1, 2, 3
rapida: 1, 3, 5       (5.next é None: o laço para)   ->  meio = 3
\`\`\`

- \`rapida and rapida.next\` protege os **dois** passos: sem isso, \`rapida.next.next\` lança \`AttributeError\` no fim da lista.
- **Tempo \`O(n)\`**, **espaço \`O(1)\`**.

> [!dica] Primo desse truque: o **k-ésimo nó a partir do fim** (LeetCode 19). Dê \`k\` passos de vantagem a um ponteiro e ande com os dois juntos; quando o da frente chegar ao fim, o de trás está no alvo.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E se a lista tiver um **ciclo**? Um laço `while no:` nunca termina.',
          'A saída elegante é o algoritmo da **tartaruga e da lebre**: se existe ciclo, a lebre dá a volta e alcança a tartaruga, como num autódromo.',
        ],
        board: {
          title: 'Floyd: detectar o ciclo e achar onde ele começa',
          md: `**Fase 1 — existe ciclo?** A tartaruga anda 1, a lebre anda 2. Se a lebre chegar a \`None\`, não há ciclo. Se as duas se encontrarem (\`is\`), há.

**Fase 2 — onde começa?** Leve **uma** delas de volta à cabeça e ande com as duas de **1 em 1**: elas se reencontram exatamente no início do ciclo.

\`\`\`text
cabeça ───a───> início do ciclo ───b───> encontro
                      ^                     │
                      └──────  c - b  ──────┘        c = tamanho do ciclo

No encontro, a tartaruga andou a + b; a lebre, o dobro: 2(a + b) = a + b + k·c
  =>  a + b = k·c   =>   a = k·c - b
Andar "a" passos a partir do encontro = completar voltas e parar no início.
\`\`\`

| Abordagem | Tempo | Memória |
|---|---|---|
| \`set\` com os nós visitados | \`O(n)\` | \`O(n)\` |
| Tartaruga e lebre (Floyd) | \`O(n)\` | **\`O(1)\`** |

> [!sabia] O algoritmo leva o nome de **Robert Floyd** porque Knuth o creditou a ele em *The Art of Computer Programming* — mas não existe artigo de Floyd descrevendo-o. Em 1980, **Richard Brent** publicou uma variante em que a tartaruga fica parada e "se teletransporta" até a lebre a cada potência de 2, fazendo menos passos. E o truque detecta ciclos em qualquer sequência \`x -> f(x)\`: é o coração do **rho de Pollard**, um método para fatorar inteiros.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Antes dos exercícios, as armadilhas que mais derrubam gente em entrevista.',
        ],
        board: {
          title: 'Armadilhas com ponteiros',
          md: `| Armadilha | Como evitar |
|---|---|
| Perder o resto da lista ao virar um ponteiro | Guarde \`proximo = atual.next\` **antes** |
| \`AttributeError: 'NoneType' object has no attribute 'next'\` | Cheque \`rapida and rapida.next\` antes de dar dois passos |
| Comparar nós por **valor** (\`a.val == b.val\`) | Nós diferentes podem ter o mesmo valor: compare com **\`is\`** |
| Esquecer o \`next = None\` no último nó | Sem ele, a lista nova pode virar um ciclo |
| Recursão em lista longa | \`RecursionError\` a partir de ~1.000 nós: prefira laços |

> [!dica] Antes de codar, **desenhe** três nós e simule seu laço no papel, falando em voz alta. É o que o entrevistador quer ver — e evita a maioria dos bugs de ponteiro.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Meio da lista, inversão, merge com sentinela e o ciclo de Floyd.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'lc-ll-q1',
        concept: 'Ponteiros lento/rápido',
        say: 'Aquecimento: simule os ponteiros com calma. Agora a lista tem tamanho par.',
        prompt: `O que \`meio(cabeca)\` devolve para a lista \`1 -> 2 -> 3 -> 4 -> 5 -> 6\`?

\`\`\`python
def meio(head):
    lenta = rapida = head
    while rapida and rapida.next:
        lenta = lenta.next
        rapida = rapida.next.next
    return lenta.val
\`\`\``,
        options: [
          { text: '`3`', why: 'Esse é o **primeiro** do meio. Com essa condição, a lenta ainda dá mais um passo: na última volta a rápida vai do 5 para `None` (o `next` do 6).' },
          { text: '`4`', correct: true, why: 'A lenta passa por 1, 2, 3, 4 enquanto a rápida passa por 1, 3, 5 e cai em `None`. Com tamanho par, sai o **segundo** do meio.' },
          { text: '`3.5`', why: 'A função devolve o valor de um **nó**, não a média de dois valores.' },
          { text: 'Lança `AttributeError` quando a rápida passa do fim.', why: 'A condição `rapida and rapida.next` garante que os dois passos são seguros; a rápida só vira `None` na última volta, e aí o laço para.' },
        ],
        explanation: 'Com a rápida andando 2 e a lenta 1, a lenta percorre metade do caminho. Em listas de tamanho par, `while rapida and rapida.next` para no **segundo** nó do meio (é o que o LeetCode 876 pede). Trocando por `while rapida.next and rapida.next.next`, ela para no **primeiro** — o ponto certo para partir a lista em duas metades, como no *merge sort* de listas ligadas.',
      },
      {
        type: 'order',
        id: 'lc-ll-q2',
        concept: 'Inversão de lista ligada',
        say: 'Antes de codar a inversão, monte o roteiro na ordem certa.',
        prompt: 'Coloque em ordem os passos da inversão **iterativa** de uma lista ligada.',
        items: [
          'Comece com `anterior = None` e `atual = head`',
          'Guarde o resto da lista: `proximo = atual.next`',
          'Vire o ponteiro: `atual.next = anterior`',
          'Avance o anterior: `anterior = atual`',
          'Avance o atual: `atual = proximo`',
          'Quando `atual` for `None`, devolva `anterior`',
        ],
        explanation: 'Os passos do meio formam o corpo do laço, e a ordem importa: sem guardar `proximo` antes, virar o ponteiro perde o resto da lista; e se `atual = proximo` viesse antes de `anterior = atual`, `anterior` receberia o nó errado. No fim, `anterior` aponta para a antiga cauda — a nova cabeça.',
      },
      {
        type: 'code',
        id: 'lc-ll-q3',
        concept: 'Inversão de lista ligada',
        title: 'Reverse Linked List',
        say: 'LeetCode 206. Sem criar nós novos — e tem lista comprida no teste de desempenho.',
        prompt: `Implemente \`reverse_list(head)\`, que inverte a lista ligada e devolve a **nova cabeça**.

- Inverta **no lugar**: reaproveite os nós, mudando só os \`next\` (nada de criar \`ListNode\` novos).
- \`head\` pode ser \`None\` (lista vazia).
- Objetivo: **\`O(n)\` de tempo e \`O(1)\` de espaço extra**. Há um teste com **5.000 nós** — e o Python limita a recursão a ~1.000 chamadas.`,
        starter: NODE + `

def reverse_list(head):
    pass
`,
        tests: [
          { name: 'exemplo', setup: LL + 'cabeca = _montar([1, 2, 3, 4, 5])', expr: '_valores(reverse_list(cabeca))', expected: '[5, 4, 3, 2, 1]' },
          { name: 'lista vazia', expr: 'reverse_list(None)', expected: 'None' },
          { name: 'um nó', setup: LL + 'cabeca = _montar([7])', expr: '_valores(reverse_list(cabeca))', expected: '[7]' },
          { name: 'dois nós', setup: LL + 'cabeca = _montar([1, 2])', expr: '_valores(reverse_list(cabeca))', expected: '[2, 1]' },
          {
            name: 'reaproveita os nós',
            setup: LL,
            code: `cabeca = _montar([1, 2, 3])
cauda = cabeca.next.next
nova = reverse_list(cabeca)
assert nova is cauda, "a nova cabeça deve ser o antigo último nó (não crie nós novos)"
assert cabeca.next is None, "o antigo primeiro nó deve virar o último, com next = None"`,
          },
          { setup: LL + 'cabeca = _montar([3, -1, 0, 3])', expr: '_valores(reverse_list(cabeca))', expected: '[3, 0, -1, 3]', hidden: true },
          { setup: LL + 'cabeca = _montar([1, 2, 3, 4])', expr: '_valores(reverse_list(reverse_list(cabeca)))', expected: '[1, 2, 3, 4]', hidden: true },
        ],
        perfTests: [
          {
            name: 'lista com 5.000 nós',
            setup: LL + 'cabeca = _montar(range(5000))',
            expr: '_valores(reverse_list(cabeca))',
            expected: 'list(range(4999, -1, -1))',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Inversão iterativa em O(n)',
        reviews: [
          {
            when: m => m.recursion,
            text: 'Recursão usa um frame de pilha por nó: `O(n)` de espaço e `RecursionError` a partir de ~1.000 nós. O laço com três ponteiros faz o mesmo com `O(1)`.',
            concept: 'Recursão e pilha de chamadas',
          },
          {
            when: m => m.loopDepth >= 2,
            text: 'Um laço dentro do outro (procurar o penúltimo nó a cada passo) dá `O(n²)`. Com `anterior`, `atual` e `proximo`, uma passada basta.',
            concept: 'Inversão de lista ligada',
          },
          {
            when: (m, code) => m.calls.includes('append') || m.calls.includes('reverse') || /\[\s*::\s*-1\s*\]/.test(code),
            text: 'Copiar os valores para uma `list` gasta `O(n)` de memória extra e não inverte a estrutura de verdade. Vire os ponteiros `next` no lugar.',
            concept: 'In-place',
          },
        ],
        hints: [
          'A cada passo você precisa de três referências: o nó **anterior** (para onde apontar), o **atual** e o **próximo** (para não perder o resto).',
          'No laço `while atual:`, nesta ordem: `proximo = atual.next`, `atual.next = anterior`, `anterior = atual`, `atual = proximo`.',
          'Comece com `anterior = None` (o antigo primeiro nó vira o último) e devolva `anterior` quando `atual` virar `None`.',
        ],
        solution: NODE + `

def reverse_list(head):
    anterior = None
    atual = head
    while atual:
        proximo = atual.next      # 1. guarda o resto
        atual.next = anterior     # 2. vira o ponteiro
        anterior = atual          # 3. anterior avança
        atual = proximo           # 4. atual avança
    return anterior               # a antiga cauda é a nova cabeça
`,
        solutionExplanation: 'Cada nó é visitado uma vez e só existem três referências extras: **tempo `O(n)`**, **espaço `O(1)`**. Guardar `proximo` antes de virar `atual.next` é o que impede de perder o resto da lista. A versão recursiva também é `O(n)` de tempo, mas usa `O(n)` de pilha — e o Python corta a profundidade em ~1.000 chamadas.',
      },
      {
        type: 'code',
        id: 'lc-ll-q4',
        concept: 'Nó sentinela',
        title: 'Merge Two Sorted Lists',
        say: 'LeetCode 21. Um nó sentinela deixa esse código bem mais curto.',
        prompt: `Implemente \`merge_two_lists(l1, l2)\`: recebe as cabeças de duas listas ligadas **ordenadas** (crescente) e devolve a cabeça de **uma** lista ordenada com todos os nós.

- **Emende os nós existentes** — só um eventual nó sentinela pode ser novo.
- Qualquer uma das listas pode ser vazia (\`None\`).
- Objetivo: **\`O(n + m)\` de tempo e \`O(1)\` de espaço extra**. Há um teste com duas listas de 3.000 nós.`,
        starter: NODE + `

def merge_two_lists(l1, l2):
    pass
`,
        tests: [
          { name: 'exemplo', setup: LL, expr: '_valores(merge_two_lists(_montar([1, 2, 4]), _montar([1, 3, 4])))', expected: '[1, 1, 2, 3, 4, 4]' },
          { name: 'as duas vazias', expr: 'merge_two_lists(None, None)', expected: 'None' },
          { name: 'uma vazia', setup: LL, expr: '_valores(merge_two_lists(None, _montar([0])))', expected: '[0]' },
          { name: 'uma acaba antes', setup: LL, expr: '_valores(merge_two_lists(_montar([5, 6, 7]), _montar([1])))', expected: '[1, 5, 6, 7]' },
          {
            name: 'emenda os nós existentes',
            setup: LL,
            code: `a = _montar([1, 4])
b = _montar([2, 3])
n1, n4, n2, n3 = a, a.next, b, b.next
r = merge_two_lists(a, b)
assert r is n1 and n1.next is n2 and n2.next is n3 and n3.next is n4 and n4.next is None, "emende os nós existentes na ordem 1 -> 2 -> 3 -> 4, sem criar nós novos"`,
          },
          { setup: LL, expr: '_valores(merge_two_lists(_montar([-3, 0, 0, 7]), _montar([-5, 0, 8])))', expected: '[-5, -3, 0, 0, 0, 7, 8]', hidden: true },
          { setup: LL, expr: '_valores(merge_two_lists(_montar([1, 1, 1]), _montar([1, 1])))', expected: '[1, 1, 1, 1, 1]', hidden: true },
          { setup: LL, expr: '_valores(merge_two_lists(_montar([2]), None))', expected: '[2]', hidden: true },
        ],
        perfTests: [
          {
            name: 'duas listas com 3.000 nós',
            setup: LL + 'a = _montar(range(0, 6000, 2))\nb = _montar(range(1, 6000, 2))',
            expr: '_valores(merge_two_lists(a, b))',
            expected: 'list(range(6000))',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Merge iterativo em O(n + m)',
        reviews: [
          {
            when: m => m.recursion,
            text: 'A versão recursiva é elegante, mas empilha uma chamada por nó: `O(n + m)` de espaço e `RecursionError` em listas longas. Com um nó sentinela, o laço iterativo usa `O(1)`.',
            concept: 'Recursão e pilha de chamadas',
          },
          {
            when: m => m.loopDepth >= 2,
            text: 'Procurar a posição de cada nó desde o começo (um laço dentro do outro) custa `O(n·m)`. As listas já estão ordenadas: basta comparar as duas **cabeças** a cada passo.',
            concept: 'Merge de listas ordenadas',
          },
          {
            when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
            text: 'Ordenar de novo custa `O((n + m) log(n + m))` e ignora que as listas já vêm ordenadas. O merge compara só as cabeças: `O(n + m)`.',
            concept: 'Merge de listas ordenadas',
          },
        ],
        hints: [
          'Crie `sentinela = ListNode()` e uma variável `cauda` apontando para ele. Você vai pendurar os nós em `cauda.next`.',
          'Enquanto as duas listas tiverem nós, pendure a cabeça de menor `val` em `cauda.next`, avance essa lista e avance `cauda`.',
          'Quando uma acabar, emende o resto da outra de uma vez: `cauda.next = l1 or l2`. Devolva `sentinela.next`.',
        ],
        solution: NODE + `

def merge_two_lists(l1, l2):
    sentinela = ListNode()          # nó falso: nunca é devolvido
    cauda = sentinela
    while l1 and l2:
        if l1.val <= l2.val:        # <= mantém a ordem dos empates (estável)
            cauda.next = l1
            l1 = l1.next
        else:
            cauda.next = l2
            l2 = l2.next
        cauda = cauda.next
    cauda.next = l1 or l2           # o resto já está ordenado
    return sentinela.next
`,
        solutionExplanation: 'Cada nó é pendurado uma única vez: **tempo `O(n + m)`**, **espaço `O(1)`** (só o sentinela e a `cauda`). O sentinela elimina dois casos especiais — "quem é a cabeça?" e "e se uma lista for vazia?". Usar `<=` mantém a ordem original dos empates (merge **estável**), a mesma propriedade de que o *merge sort* precisa.',
      },
      {
        type: 'code',
        id: 'lc-ll-q5',
        concept: 'Tartaruga e lebre',
        title: 'Linked List Cycle II',
        say: 'Agora o grand finale: LeetCode 142. Não basta dizer **se** há ciclo — quero o nó onde ele começa.',
        prompt: `Implemente \`detect_cycle(head)\`: se a lista tiver um ciclo, devolva o **nó** onde o ciclo começa; senão, devolva \`None\`.

- Compare **nós**, não valores: a lista pode ter valores repetidos.
- Não modifique a lista.
- Objetivo: **\`O(n)\` de tempo e \`O(1)\` de memória** — sem guardar os nós visitados.`,
        starter: NODE + `

def detect_cycle(head):
    pass
`,
        tests: [
          { name: 'ciclo volta ao índice 1', setup: CICLO + 'cabeca = _montar_ciclo([3, 2, 0, -4], 1)', expr: '_indice(detect_cycle(cabeca))', expected: '1' },
          { name: 'ciclo começa na cabeça', setup: CICLO + 'cabeca = _montar_ciclo([1, 2], 0)', expr: '_indice(detect_cycle(cabeca))', expected: '0' },
          { name: 'sem ciclo', setup: CICLO + 'cabeca = _montar_ciclo([1, 2, 3], -1)', expr: '_indice(detect_cycle(cabeca))', expected: 'None' },
          { name: 'lista vazia', setup: CICLO + 'cabeca = _montar_ciclo([], -1)', expr: '_indice(detect_cycle(cabeca))', expected: 'None' },
          { name: 'um nó apontando para si mesmo', setup: CICLO + 'cabeca = _montar_ciclo([7], 0)', expr: '_indice(detect_cycle(cabeca))', expected: '0' },
          { setup: CICLO + 'cabeca = _montar_ciclo([5, 5, 5, 5, 5], 2)', expr: '_indice(detect_cycle(cabeca))', expected: '2', hidden: true },
          { setup: CICLO + 'cabeca = _montar_ciclo(list(range(10)), 9)', expr: '_indice(detect_cycle(cabeca))', expected: '9', hidden: true },
          { setup: CICLO + 'cabeca = _montar_ciclo(list(range(8)), 3)', expr: '_indice(detect_cycle(cabeca))', expected: '3', hidden: true },
          {
            setup: CICLO,
            code: `cabeca = _montar_ciclo([1, 2, 3, 4], 1)
detect_cycle(cabeca)
assert [no.val for no in _nos] == [1, 2, 3, 4], "a lista foi modificada (valores)"
assert all(_nos[i].next is _nos[i + 1] for i in range(3)) and _nos[3].next is _nos[1], "a lista foi modificada (ponteiros)"`,
            hidden: true,
          },
        ],
        perfTests: [
          {
            name: '10.000 nós, ciclo começando no meio',
            setup: CICLO + 'cabeca = _montar_ciclo(list(range(10000)), 5000)',
            expr: '_indice(detect_cycle(cabeca))',
            expected: '5000',
            maxMs: 40,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Tartaruga e lebre em O(n)',
        reviews: [
          {
            when: (m, code) => m.calls.includes('set') || m.calls.includes('add') || m.calls.includes('dict') || /=\s*\{\s*\}/.test(code),
            text: 'Guardar os nós visitados num `set`/`dict` resolve em `O(n)`, mas gasta `O(n)` de memória. A tartaruga e a lebre fazem o mesmo com **dois ponteiros**: `O(1)`.',
            concept: 'Tartaruga e lebre',
          },
          {
            when: m => m.calls.includes('append'),
            text: 'Uma `list` de visitados com `in` custa `O(n)` por consulta: `O(n²)` no total, além de `O(n)` de memória. Dois ponteiros em velocidades diferentes resolvem sem memória extra.',
            concept: 'Tartaruga e lebre',
          },
        ],
        hints: [
          'Fase 1: `lenta` anda 1 nó e `rapida` anda 2. Se `rapida` (ou `rapida.next`) virar `None`, não há ciclo. Se `lenta is rapida`, há.',
          'Fase 2: depois do encontro, volte **uma** delas para `head` e ande com as duas de 1 em 1.',
          'Onde elas se reencontrarem é o início do ciclo (a distância da cabeça ao início é `k·c - b`). Compare com `is`, nunca com `.val`.',
        ],
        solution: NODE + `

def detect_cycle(head):
    lenta = rapida = head
    while rapida and rapida.next:
        lenta = lenta.next
        rapida = rapida.next.next
        if lenta is rapida:              # fase 1: encontro dentro do ciclo
            lenta = head                 # fase 2: uma volta para a cabeça...
            while lenta is not rapida:   # ...e as duas andam de 1 em 1
                lenta = lenta.next
                rapida = rapida.next
            return lenta                 # o início do ciclo
    return None
`,
        solutionExplanation: 'Na fase 1, a lebre ganha 1 nó por passo sobre a tartaruga, então a alcança antes de a tartaruga completar uma volta: `O(n)`. Na fase 2, se `a` é a distância da cabeça ao início do ciclo e o encontro ocorreu `b` nós depois do início, vale `a = k·c - b` (`c` = tamanho do ciclo): andando `a` passos, uma sai da cabeça e a outra completa voltas até parar no início. **Tempo `O(n)`**, **espaço `O(1)`** — contra `O(n)` de memória da versão com `set`.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Fechou! Três ponteiros para **inverter**, um **nó sentinela** para construir listas sem casos especiais e **lento/rápido** para achar o meio e os ciclos.',
          { text: 'E lembre: em Python, lista longa pede laço, não recursão. Próxima parada: **árvores**!', mood: 'neutral' },
        ],
        board: null,
      },
    ],
  });
})();
