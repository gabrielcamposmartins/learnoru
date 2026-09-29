Game.registerModule('leetcode', {
  id: 'stack',
  title: 'Pilhas e Monotonic Stack',
  kind: 'lesson',
  level: 2,
  order: 20,
  unit: 'estruturas',
  summary: 'LIFO para parênteses, desfazer e "próximo maior elemento" em O(n).',
  concepts: ['Pilha (Stack)', 'LIFO', 'Monotonic Stack', 'Análise amortizada'],
  takeaways: [
    'Pilha = **LIFO**. Em Python, uma `list` com `append` e `pop()` no **fim** já basta, ambos `O(1)`; `pop(0)` é fila e custa `O(n)`.',
    'Pense em pilha quando o enunciado fala em **aninhamento** ou no "**mais recente** pendente": parênteses, desfazer, DFS iterativo, expressões.',
    'Parênteses válidos falham de três jeitos: fechamento com a pilha **vazia**, topo que **não casa** e aberturas **sobrando** no fim.',
    '**Monotonic stack** resolve "próximo maior/menor" em `O(n)`: quem chega maior que o topo é a resposta dele. Guarde **índices** quando a resposta for uma distância.',
    'O `while` dentro do `for` não é `O(n²)`: cada índice entra e sai da pilha **uma vez**. Isso é **análise amortizada**.',
  ],
  glossary: [
    { term: 'LIFO', aliases: ['last in, first out', 'last-in first-out'], definition: '*Last In, First Out*: o último elemento a entrar é o primeiro a sair. É a disciplina da **pilha**; o oposto é FIFO, a da fila.' },
    { term: 'Monotonic stack', aliases: ['monotonic stacks', 'pilha monotônica', 'pilhas monotônicas'], definition: 'Pilha mantida sempre em ordem (crescente ou decrescente). Ao empilhar, desempilha quem quebra a ordem, e cada desempilhado descobre sua resposta. Resolve "próximo maior/menor elemento" em `O(n)`.' },
    { term: 'Análise amortizada', aliases: ['custo amortizado', 'amortized analysis', 'tempo amortizado'], definition: 'Análise do custo **total** de uma sequência de operações dividido pelo número delas. Uma operação isolada pode ser cara (um `while` que desempilha muito), mas a média por operação continua `O(1)`.' },
    { term: 'Palavra de Dyck', aliases: ['palavras de Dyck', 'Dyck word', 'Dyck words', 'linguagem de Dyck'], definition: 'Nome matemático de uma sequência de parênteses **balanceada** (em homenagem a Walther von Dyck). O conjunto dessas palavras é a *linguagem de Dyck*, que uma pilha reconhece.' },
    { term: 'Números de Catalan', aliases: ['número de Catalan', 'Catalan numbers', 'Catalan number'], definition: 'Sequência 1, 1, 2, 5, 14, 42… dada por `C(n) = comb(2n, n) // (n + 1)`. Conta as strings válidas com `n` pares de parênteses, as árvores binárias com `n` nós e muitos outros objetos combinatórios.' },
    { term: 'Shunting-yard', aliases: ['algoritmo shunting-yard', 'shunting yard', 'algoritmo do pátio de manobras'], definition: 'Algoritmo de Dijkstra (1961) que converte uma expressão infixa (`3 + 4 * 2`) em notação polonesa reversa (`3 4 2 * +`) usando uma **pilha de operadores** e respeitando a precedência.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é dia de **pilha**: o último que entra é o primeiro que sai — **LIFO**.',
        'Em Python não precisa de biblioteca: uma `list` com `append` e `pop()` já é uma pilha, com as duas operações em `O(1)`.',
      ],
      board: {
        title: 'Pilha (stack) em Python',
        code: `pilha = []
pilha.append(1)     # push  -> [1]
pilha.append(2)     # push  -> [1, 2]
pilha.append(3)     # push  -> [1, 2, 3]
topo = pilha[-1]    # peek  -> 3
pilha.pop()         # pop   -> devolve 3, fica [1, 2]
vazia = not pilha   # False`,
        caption: 'Sempre `pop()` do **fim**. `pop(0)` seria fila — e `O(n)`.',
      },
    },
    {
      type: 'say',
      text: [
        'Quando usar? Sempre que o problema tiver **aninhamento** ou precisar lembrar do **mais recente pendente**.',
        'Parênteses são o exemplo perfeito: o último que abriu tem que ser o primeiro a fechar.',
      ],
      board: {
        title: 'Onde pilhas aparecem',
        md: `- **Parênteses balanceados**, tags HTML/XML aninhadas
- **Desfazer/refazer** (Ctrl+Z) em editores
- **Pilha de chamadas** de funções (a recursão usa uma!)
- Avaliar expressões (notação polonesa reversa)
- **DFS** iterativo em grafos e árvores
- "Próximo elemento maior/menor" → **monotonic stack**

> [!dica] Se a palavra "aninhado" ou "o mais recente" aparece no enunciado, pense em pilha.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora a versão avançada: **monotonic stack**. É uma pilha que mantemos sempre em ordem — crescente ou decrescente.',
        'Ela resolve "para cada elemento, qual o **próximo maior**?" em `O(n)`, em vez de `O(n²)`.',
        'Quando chega um elemento maior que o topo, o topo acabou de encontrar a resposta dele: desempilhamos e registramos.',
      ],
      board: {
        title: 'Monotonic stack: próximo maior elemento',
        code: `def proximo_maior(nums):
    resposta = [-1] * len(nums)
    pilha = []                  # índices ainda sem resposta (valores decrescentes)
    for i, x in enumerate(nums):
        while pilha and nums[pilha[-1]] < x:
            j = pilha.pop()
            resposta[j] = x     # x é o próximo maior de nums[j]
        pilha.append(i)
    return resposta

print(proximo_maior([2, 1, 5, 3, 6]))   # [5, 5, 6, 6, -1]`,
        caption: 'Cada índice entra e sai da pilha **uma vez**: `O(n)` amortizado, apesar do `while` dentro do `for`.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma curiosidade antes de praticar: strings de parênteses válidas têm até **nome próprio** na matemática.',
        'E toda calculadora esconde uma pilha, graças a um algoritmo do Dijkstra.',
      ],
      board: {
        title: 'Parênteses, Catalan e o pátio de manobras',
        md: `Uma sequência de parênteses balanceada é uma **palavra de Dyck**. Quantas existem com \`n\` pares? O **n-ésimo número de Catalan**:

| pares \`n\` | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| strings válidas | 1 | 1 | 2 | 5 | 14 | 42 |

\`\`\`python
from math import comb

def catalan(n):
    return comb(2 * n, n) // (n + 1)

print([catalan(n) for n in range(6)])   # [1, 1, 2, 5, 14, 42]
\`\`\`

> [!sabia] Os **números de Catalan** também contam as árvores binárias com \`n\` nós e os jeitos de parentesear um produto. E o **shunting-yard** (Dijkstra, 1961) usa uma **pilha de operadores** para transformar \`3 + 4 * 2\` em \`3 4 2 * +\` (notação polonesa reversa), que outra pilha avalia. O nome vem do pátio de manobras de trens, onde vagões são desviados e reordenados.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Parênteses e temperaturas diárias.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-stack-q1',
      concept: 'Pilha (Stack)',
      say: 'Pra esquentar: qual estrutura?',
      prompt: 'Você está implementando o **Ctrl+Z** (desfazer) de um editor de texto: cada ação feita é registrada e o desfazer reverte **a ação mais recente**. Qual estrutura é a mais natural?',
      options: [
        { text: 'Fila (FIFO)', why: 'A fila devolveria a ação **mais antiga** primeiro.' },
        { text: 'Pilha (LIFO)', correct: true, why: 'A última ação registrada é a primeira a ser desfeita.' },
        { text: 'Conjunto (`set`)', why: 'O `set` não guarda ordem nem repetições.' },
        { text: 'Heap (fila de prioridade)', why: 'Não há prioridade aqui, só ordem cronológica reversa.' },
      ],
      explanation: 'Desfazer é o caso de uso clássico de **LIFO**. Muitos editores usam duas pilhas: uma para desfazer e outra para refazer.',
    },
    {
      type: 'code',
      id: 'lc-stack-q2',
      concept: 'Pilha (Stack)',
      title: 'Valid Parentheses',
      say: 'LeetCode 20. Clássico absoluto. Pense no que fazer quando aparece um fechamento… e no que sobra no final.',
      prompt: `Implemente \`is_valid(s)\` para uma string contendo apenas \`()[]{}\`. Ela é válida se:

1. Todo parêntese aberto é fechado pelo **mesmo tipo**.
2. Eles fecham na **ordem correta** (\`"([)]"\` é inválida).
3. Todo fechamento tem um abertura correspondente.

Objetivo: **\`O(n)\`** com uma pilha.`,
      starter: `def is_valid(s):
    pares = {")": "(", "]": "[", "}": "{"}
    pass
`,
      tests: [
        { name: 'simples', expr: 'is_valid("()")', expected: 'True' },
        { name: 'vários tipos', expr: 'is_valid("()[]{}")', expected: 'True' },
        { name: 'tipo errado', expr: 'is_valid("(]")', expected: 'False' },
        { name: 'ordem errada', expr: 'is_valid("([)]")', expected: 'False' },
        { name: 'aninhado', expr: 'is_valid("{[]}")', expected: 'True' },
        { name: 'string vazia', expr: 'is_valid("")', expected: 'True' },
        { name: 'sobrou abertura', expr: 'is_valid("(")', expected: 'False' },
        { name: 'fechamento sem abertura', expr: 'is_valid(")")', expected: 'False' },
        { expr: 'is_valid("((")', expected: 'False', hidden: true },
        { expr: 'is_valid("){")', expected: 'False', hidden: true },
        { expr: 'is_valid("([{}])[]")', expected: 'True', hidden: true },
      ],
      perfTests: [
        {
          name: '40.000 parênteses aninhados',
          setup: 's = "(" * 20000 + ")" * 20000',
          expr: 'is_valid(s)',
          expected: 'True',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Pilha — uma passada O(n)',
      reviews: [
        {
          when: m => m.calls.includes('replace'),
          text: 'Remover pares com `replace` em loop funciona, mas cada passada copia a string: `O(n²)` no pior caso. Uma pilha resolve em uma passada.',
          concept: 'Pilha (Stack)',
        },
        {
          when: m => m.calls.includes('count'),
          text: 'Contar aberturas e fechamentos não basta: `"([)]"` tem as contagens certas e a ordem errada. A pilha verifica a **ordem**.',
          concept: 'Pilha (Stack)',
        },
      ],
      hints: [
        'Ao ver uma **abertura**, empilhe. Ao ver um **fechamento**, o topo da pilha precisa ser a abertura correspondente.',
        'Se aparecer um fechamento com a pilha vazia, ou o topo não casar, a string é inválida.',
        'No final, a pilha precisa estar **vazia**: `return not pilha`.',
      ],
      solution: `def is_valid(s):
    pares = {")": "(", "]": "[", "}": "{"}
    pilha = []
    for c in s:
        if c in pares:
            if not pilha or pilha.pop() != pares[c]:
                return False
        else:
            pilha.append(c)
    return not pilha
`,
      solutionExplanation: 'Cada caractere é empilhado/desempilhado no máximo uma vez: **tempo `O(n)`**, **espaço `O(n)`** no pior caso (só aberturas). Os três casos de erro: fechamento com pilha vazia, topo que não casa e aberturas sobrando no fim.',
    },
    {
      type: 'mcq',
      id: 'lc-stack-q3',
      concept: 'Pilha (Stack)',
      say: 'Rastreie a pilha na cabeça. O que sobra?',
      prompt: `Processando \`"{[("\` e depois \`")]"\` com o algoritmo da pilha, qual é o conteúdo da pilha no final (do fundo para o topo)?`,
      options: [
        { text: '`[]` (vazia) — string válida', why: 'O `{` do começo nunca foi fechado.' },
        { text: '`["{"]` — string inválida', correct: true, why: '`(` e `[` foram fechados, mas `{` sobrou na pilha.' },
        { text: '`["{", "["]` — string inválida', why: 'O `]` fechou o `[`, removendo-o da pilha.' },
        { text: '`["(", "[", "{"]`', why: 'A ordem da pilha é a de entrada: `{` no fundo, e os dois do topo já saíram.' },
      ],
      explanation: 'A string completa `"{[()]"` tem uma abertura a mais. Pilha não vazia no final ⇒ inválida.',
    },
    {
      type: 'code',
      id: 'lc-stack-q4',
      concept: 'Monotonic Stack',
      title: 'Daily Temperatures',
      say: 'LeetCode 739. A força bruta olha para frente dia por dia. Com monotonic stack sai em `O(n)` — e tem teste de desempenho!',
      prompt: `Dada uma lista \`temps\` de temperaturas diárias, implemente \`daily_temperatures(temps)\` que devolve uma lista \`resposta\` onde \`resposta[i]\` é **quantos dias** depois do dia \`i\` vem uma temperatura **mais alta**. Se não houver, use \`0\`.

- \`[73, 74, 75, 71, 69, 72, 76, 73]\` → \`[1, 1, 4, 2, 1, 1, 0, 0]\`
- Objetivo: **\`O(n)\`** com uma pilha monotônica.`,
      starter: `def daily_temperatures(temps):
    resposta = [0] * len(temps)
    pilha = []  # índices dos dias que ainda esperam um dia mais quente
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73])', expected: '[1, 1, 4, 2, 1, 1, 0, 0]' },
        { name: 'crescente', expr: 'daily_temperatures([30, 40, 50, 60])', expected: '[1, 1, 1, 0]' },
        { name: 'lista vazia', expr: 'daily_temperatures([])', expected: '[]' },
        { name: 'um dia', expr: 'daily_temperatures([50])', expected: '[0]' },
        { name: 'decrescente', expr: 'daily_temperatures([5, 4, 3])', expected: '[0, 0, 0]' },
        { expr: 'daily_temperatures([70, 70, 71])', expected: '[2, 1, 0]', hidden: true },
        { expr: 'daily_temperatures([30, 60, 90])', expected: '[1, 1, 0]', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.000, esfriando até o último dia',
          setup: 'temps = list(range(8000, 0, -1)) + [9000]',
          expr: 'daily_temperatures(temps)',
          expected: '[8000 - i for i in range(8000)] + [0]',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Monotonic Stack — O(n) amortizado',
      reviews: [
        {
          when: m => m.calls.includes('index'),
          text: '`.index()` faz busca linear a cada dia. A pilha já guarda os índices pendentes.',
          concept: 'Monotonic Stack',
        },
        {
          when: (m, code) => /pop\s*\(\s*0\s*\)|insert\s*\(\s*0/.test(code),
          text: '`pop(0)`/`insert(0, ...)` são `O(n)` numa `list`. A pilha deve trabalhar só no **fim** da lista.',
          concept: 'Pilha (Stack)',
        },
      ],
      hints: [
        'Percorra os dias guardando numa pilha os **índices** que ainda não encontraram um dia mais quente.',
        'Ao chegar no dia `i`: enquanto a pilha não estiver vazia e `temps[i] > temps[pilha[-1]]`, desempilhe `j` e faça `resposta[j] = i - j`.',
        'Depois do `while`, empilhe `i`. Os que sobrarem na pilha ficam com `0`.',
      ],
      solution: `def daily_temperatures(temps):
    resposta = [0] * len(temps)
    pilha = []
    for i, t in enumerate(temps):
        while pilha and t > temps[pilha[-1]]:
            j = pilha.pop()
            resposta[j] = i - j
        pilha.append(i)
    return resposta
`,
      solutionExplanation: 'A pilha guarda índices com temperaturas **decrescentes**. Cada índice é empilhado e desempilhado no máximo uma vez: **tempo `O(n)` amortizado**, **espaço `O(n)`**. A força bruta (procurar para frente a partir de cada dia) é `O(n²)` no pior caso — justamente o teste de desempenho.',
    },
    {
      type: 'match',
      id: 'lc-rx2-stack-q5',
      concept: 'Monotonic Stack',
      say: 'Bate-bola: o que vai na pilha em cada problema?',
      prompt: 'Associe cada problema ao **conteúdo da pilha** que o resolve.',
      pairs: [
        { left: 'Parênteses válidos', right: 'Aberturas ainda não fechadas' },
        { left: 'Próximo **maior** elemento', right: 'Índices com valores **decrescentes**' },
        { left: 'Próximo **menor** elemento', right: 'Índices com valores **crescentes**' },
        { left: 'Avaliar notação polonesa reversa', right: 'Operandos à espera de um operador' },
        { left: 'DFS iterativo num grafo', right: 'Nós descobertos ainda não visitados' },
      ],
      explanation: 'A pilha sempre guarda o que está **pendente**. No próximo maior, um valor que chega maior que o topo "resolve" o topo; por isso o que sobra fica em ordem **decrescente**. No próximo menor é o espelho: a pilha fica **crescente**.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Pilha = **LIFO**: aninhamento, desfazer, DFS. **Monotonic stack** = "próximo maior/menor" em `O(n)`.',
        'Próxima parada: **busca binária**, o `O(log n)` que todo entrevistador espera que você saiba de cor.',
      ],
      board: null,
    },
  ],
});
