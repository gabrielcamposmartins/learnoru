Game.registerModule('leetcode', {
  id: 'union-find',
  title: 'Union-Find (DSU)',
  kind: 'lesson',
  level: 3,
  order: 31,
  unit: 'grafos',
  summary: 'Responda "estão no mesmo grupo?" enquanto as conexões chegam — em tempo quase constante, com compressão de caminho, união por rank e a curiosa inversa de Ackermann.',
  concepts: ['Union-Find (DSU)', 'Compressão de caminho', 'União por rank', 'Inversa de Ackermann', 'Kruskal'],
  takeaways: [
    'Union-Find guarda cada conjunto como uma **árvore de ponteiros para o pai**: `find(x)` sobe até a raiz (o representante) e `union(a, b)` pendura uma **raiz** na outra.',
    'Sem otimizações, as árvores viram **correntes** e cada `find` custa `O(n)`. A **compressão de caminho** achata o caminho percorrido; a **união por rank** (ou por tamanho) pendura a árvore baixa na alta.',
    'Com as duas juntas, `m` operações custam `O(m·α(n))`, e **α é a inversa de Ackermann**: não passa de 4 para qualquer `n` realista. Em entrevista: "quase `O(1)` amortizado".',
    '`union` devolvendo `False` quer dizer "já estavam conectados": é assim que se acha a **aresta que fecha um ciclo**. Um contador de componentes (começa em `n` e cai 1 a cada união efetiva) responde "está tudo conectado?" em `O(1)`.',
    'Kruskal = ordenar as arestas por peso + DSU para pular as que fechariam ciclo, em `O(E log E)`. O DSU **não** desfaz uniões, não dá caminhos e não modela conectividade **dirigida**.',
  ],
  glossary: [
    { term: 'Union-Find', aliases: ['union find', 'DSU', 'disjoint set union', 'disjoint-set', 'conjuntos disjuntos', 'estrutura de conjuntos disjuntos'], definition: 'Estrutura que mantém elementos divididos em **conjuntos disjuntos** com duas operações: `find(x)` (quem representa o conjunto de `x`) e `union(a, b)` (junta dois conjuntos). Criada por Galler e Fischer em 1964.' },
    { term: 'Compressão de caminho', aliases: ['path compression', 'compressão de caminhos'], definition: 'Otimização do `find`: depois de achar a raiz, todo nó do caminho passa a apontar **direto** para ela. As próximas buscas por esses nós custam um passo.' },
    { term: 'União por rank', aliases: ['union by rank', 'união por tamanho', 'union by size', 'união por posto'], definition: 'Otimização do `union`: a raiz da árvore de rank **menor** vira filha da de rank maior, então a altura só cresce quando os dois empatam. Sozinha, já garante altura `O(log n)`.' },
    { term: 'Inversa de Ackermann', aliases: ['função inversa de Ackermann', 'inverse Ackermann', 'α(n)', 'função de Ackermann'], definition: 'Função `α(n)` que cresce absurdamente devagar: vale no máximo 4 para qualquer `n` que caiba no universo observável. Tarjan (1975) provou que o Union-Find com as duas otimizações custa `O(m·α(n))` para `m` operações.' },
    { term: 'Árvore geradora mínima', aliases: ['árvores geradoras mínimas', 'MST', 'minimum spanning tree', 'árvore geradora de custo mínimo'], definition: 'Conjunto de arestas que liga **todos** os vértices de um grafo com pesos, sem ciclos, com a menor soma de pesos possível. Algoritmos clássicos: **Kruskal** (ordena as arestas + Union-Find) e **Prim** (cresce a partir de um vértice, com heap).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é uma estrutura pequena, elegante e muito **subestimada**: o **Union-Find**, também chamado de DSU (*Disjoint Set Union*).',
        'Ela responde uma pergunta só — "esses dois estão no mesmo grupo?" — enquanto as conexões vão chegando.',
      ],
      board: {
        title: 'O problema: conectividade dinâmica',
        md: `Uma rede social recebe amizades **uma a uma** e, no meio disso, perguntas como "Ana e Davi estão no mesmo grupo, direta ou indiretamente?".

\`\`\`text
chega Ana-Bia     ->  {Ana, Bia}   {Caio}   {Davi}
chega Caio-Davi   ->  {Ana, Bia}   {Caio, Davi}
chega Bia-Caio    ->  {Ana, Bia, Caio, Davi}        <- agora Ana e Davi estão ligados
\`\`\`

| Abordagem | Nova amizade | "Mesmo grupo?" |
|---|---|---|
| BFS/DFS a cada pergunta | \`O(1)\` | \`O(V + E)\` |
| Rótulo de grupo por pessoa (*quick-find*) | \`O(n)\` para reetiquetar | \`O(1)\` |
| **Union-Find** otimizado | quase \`O(1)\` | quase \`O(1)\` |

Duas operações, e só:
- \`find(x)\` — devolve o **representante** do conjunto de \`x\`;
- \`union(a, b)\` — junta o conjunto de \`a\` com o de \`b\`.

> [!dica] \`a\` e \`b\` estão conectados **se e somente se** \`find(a) == find(b)\`.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A ideia: cada conjunto é uma **árvore** em que cada elemento aponta para o **pai**. A raiz aponta para si mesma — ela é o representante.',
        'A versão ingênua cabe em dez linhas. O problema é que, dependendo da ordem das uniões, a árvore vira uma **corrente**.',
      ],
      board: {
        title: 'Uma floresta de ponteiros para o pai',
        md: `\`\`\`python
parent = list(range(n))        # no começo, cada um é o próprio representante

def find(x):
    while parent[x] != x:      # sobe até a raiz
        x = parent[x]
    return x

def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[ra] = rb        # pendura uma RAIZ na outra
\`\`\`

\`\`\`text
parent = [1, 1, 1, 4, 4]

0 -> 1 <- 2        3 -> 4          raízes: 1 e 4 (parent[r] == r)
conjuntos: {0, 1, 2} e {3, 4}
\`\`\`

O pior caso da versão ingênua — \`union(0, 1)\`, \`union(0, 2)\`, \`union(0, 3)\`, …:

\`\`\`text
0 -> 1 -> 2 -> 3 -> ... -> n-1      cada find(0) percorre a corrente inteira: O(n)
\`\`\`

Com \`n\` uniões assim, o total vira **\`O(n²)\`** — nada melhor que a força bruta.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Duas otimizações resolvem isso, e cada uma cabe em poucas linhas.',
        '**Compressão de caminho**: depois de achar a raiz, faça todo mundo do caminho apontar direto para ela. **União por rank**: pendure a árvore mais baixa embaixo da mais alta.',
      ],
      board: {
        title: 'As duas otimizações',
        md: `**1. Compressão de caminho** — quem estava no caminho passa a apontar **direto** para a raiz:

\`\`\`text
antes de find(0):   0 -> 1 -> 2 -> 3          depois:   0 -> 3,  1 -> 3,  2 -> 3
\`\`\`

**2. União por rank** — \`rank\` é um limite superior para a altura da árvore. A raiz de rank **menor** vira filha da de rank maior; a altura só cresce quando os ranks **empatam**.

\`\`\`python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.componentes = n                # quantos conjuntos existem agora

    def find(self, x):
        raiz = x
        while self.parent[raiz] != raiz:    # 1ª passada: acha a raiz
            raiz = self.parent[raiz]
        while x != raiz:                    # 2ª passada: comprime o caminho
            proximo = self.parent[x]
            self.parent[x] = raiz
            x = proximo
        return raiz

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False                    # já estavam no mesmo conjunto
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra                 # ra fica sendo a árvore mais alta
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1              # empate: a altura cresce 1
        self.componentes -= 1
        return True
\`\`\`

> [!dica] **União por tamanho** (pendurar o conjunto menor no maior) dá a mesma garantia e ainda entrega o tamanho de cada grupo — útil em "qual é o maior grupo?".`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E quanto custa? Aqui mora um dos resultados mais curiosos da computação.',
        'Com as duas otimizações juntas, o custo amortizado por operação é `O(α(n))`, em que α é a **inversa da função de Ackermann** — uma função que, na prática, nunca passa de 4.',
      ],
      board: {
        title: 'Custo amortizado e a inversa de Ackermann',
        md: `| Versão | Um \`find\` no pior caso | \`m\` operações |
|---|---|---|
| Ingênua | \`O(n)\` | \`O(m·n)\` |
| Só união por rank | \`O(log n)\` | \`O(m log n)\` |
| Só compressão de caminho | \`O(n)\` | \`O(m log n)\` (amortizado) |
| **As duas juntas** | \`O(log n)\` | **\`O(m·α(n))\`** |

**Amortizado** quer dizer: um \`find\` isolado ainda pode ser caro, mas ao percorrer o caminho ele o **achata** e "paga adiantado" as próximas buscas. Na média da sequência inteira, cada operação sai quase de graça.

> [!sabia] A **função de Ackermann** (1928) cresce de forma explosiva: \`A(4, 2)\` já tem **19.729 dígitos**. Sua inversa, **α(n)**, é o oposto: vale no máximo 4 para qualquer \`n\` que caiba no universo observável. Robert Tarjan provou o limite \`O(m·α(n))\` em 1975, num artigo chamado, com humor, *"Efficiency of a Good But Not Linear Set Union Algorithm"*. Em 1989, Fredman e Saks mostraram que **nenhuma** estrutura consegue fazer melhor: esse α é inevitável.

> [!atencao] O \`find\` recursivo (\`parent[x] = find(parent[x])\`) é elegante, mas o Python desiste depois de ~1.000 chamadas aninhadas. Com união por rank, a altura fica em no máximo \`log₂ n\` e não há risco; **sem** ela, uma corrente de 5.000 elementos dispara \`RecursionError\`.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Onde isso aparece? Em todo problema de "grupos que se juntam": componentes conexos, ciclos em grafos não dirigidos, contas duplicadas, redes.',
        'E, tão importante quanto: onde **não** usar. O DSU só sabe **juntar** — nunca separar.',
      ],
      board: {
        title: 'Onde o Union-Find aparece (e onde não)',
        md: `| Problema | Como o DSU entra |
|---|---|
| Número de componentes / "províncias" (LeetCode 323, 547) | comece com \`n\` e subtraia 1 a cada \`union\` que junta |
| Conexão redundante (LeetCode 684) | a aresta cujo \`union\` devolve \`False\` fecha um ciclo |
| Quando todos ficam conectados (LeetCode 1101) | processe em ordem de tempo; pare quando sobrar 1 componente |
| Mesclar contas por e-mail (LeetCode 721) | una as contas que compartilham um e-mail |
| Árvore geradora mínima (Kruskal) | descarte as arestas que fechariam ciclo |

**Quando não usar:**
- Precisa **remover** conexões → o DSU não desfaz uniões. (Truque: se tudo é conhecido de antemão, processe **ao contrário**, e as remoções viram inserções.)
- Precisa do **caminho** ou da **distância** → BFS ou Dijkstra.
- Grafo **dirigido** ("A alcança B?") → o DSU só modela relações **simétricas**; use DFS, ordenação topológica ou componentes fortemente conexos.
- Grafo fixo com uma única pergunta → BFS/DFS resolve igual, sem estrutura extra.

> [!dica] Elementos que não são inteiros (e-mails, nomes)? Troque a lista por um \`dict\`: \`parent.setdefault(x, x)\` cria o conjunto na primeira vez que \`x\` aparece.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Para fechar a teoria, a aplicação mais famosa: o algoritmo de **Kruskal**, que acha a **árvore geradora mínima** de um grafo.',
        'Ele é quase só ordenação: pegue as arestas da mais barata para a mais cara e aceite cada uma que **não feche ciclo**. Quem responde isso? O DSU.',
      ],
      board: {
        title: 'Kruskal em linhas gerais',
        md: `**Árvore geradora mínima:** ligar **todos** os vértices com o **menor custo total** — cabos entre prédios, estradas, redes elétricas.

\`\`\`python
def kruskal(n, arestas):                   # arestas: [(peso, u, v), ...]
    dsu = DSU(n)
    escolhidas, custo = [], 0
    for peso, u, v in sorted(arestas):      # 1. da mais barata para a mais cara
        if dsu.union(u, v):                 # 2. só se NÃO fechar ciclo
            escolhidas.append((u, v))
            custo += peso
            if len(escolhidas) == n - 1:    # 3. n - 1 arestas: a árvore está pronta
                break
    return custo, escolhidas
\`\`\`

\`\`\`text
A ---1--- B        ordem: A-B (1)  B-D (2)  A-C (3)  C-D (4)  A-D (5, na diagonal)
|         |
3         2        aceita A-B, B-D e A-C  ->  3 arestas = n - 1: para!
|         |        custo total = 1 + 2 + 3 = 6
C ---4--- D        (C-D e A-D fechariam ciclo)
\`\`\`

- Custo: **\`O(E log E)\`**, dominado pela **ordenação** — o DSU quase não pesa.
- É **guloso** com garantia: pela **propriedade do corte**, a aresta mais barata que atravessa qualquer divisão dos vértices pertence a alguma árvore mínima.
- Alternativa: **Prim**, que cresce a árvore a partir de um vértice com um heap — costuma ser melhor em grafos **densos**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Bugs clássicos, conectividade, ciclos e Kruskal.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-uf-q1',
      concept: 'Union-Find (DSU)',
      say: 'Primeiro, um bug que eu já vi em muita entrevista.',
      prompt: `Um colega escreveu este \`union\` (o \`find\` dele está correto):

\`\`\`python
def union(a, b):
    if find(a) != find(b):
        parent[a] = b
\`\`\`

Com \`n = 4\`, ele executa \`union(0, 1)\` e depois \`union(0, 2)\`. O que acontece?`,
      options: [
        { text: 'Funciona: `0`, `1` e `2` terminam no mesmo conjunto.', why: 'O segundo `union` sobrescreve `parent[0]`, que apontava para `1`. O `1` fica sozinho de novo.' },
        { text: 'Surge um ciclo de ponteiros e o próximo `find` entra em loop infinito.', why: 'Não há ciclo: como `find(a) != find(b)`, `b` nunca está na árvore de `a`, então `a -> b` não fecha volta.' },
        { text: 'Só fica mais lento: sem união por rank, a árvore vira corrente.', why: 'É pior que lentidão: o resultado fica **errado**. Conexões já feitas se perdem.' },
        { text: 'O `1` se desconecta: `parent[0] = 2` apaga a ligação `0 -> 1`, e `find(1) != find(2)` mesmo que devessem estar juntos.', correct: true, why: 'Depois de `union(0, 1)`, o conjunto `{0, 1}` tem raiz `1`. Mexer só em `parent[0]` arranca o `0` desse conjunto e deixa o `1` para trás.' },
      ],
      explanation: 'Uma união precisa mover **conjuntos inteiros** — e um conjunto é representado pela **raiz**. Com `parent[a] = b`, só o nó `a` (e quem estiver pendurado nele) muda de árvore; o resto do conjunto antigo fica para trás. O certo é `parent[find(a)] = find(b)`: a raiz inteira muda de lugar e leva todo mundo junto. Por isso o `union` sempre começa com dois `find`.',
    },
    {
      type: 'code',
      id: 'lc-uf-q2',
      concept: 'Union-Find (DSU)',
      title: 'Quando todos viram amigos',
      say: 'Inspirado no LeetCode 1101. Os registros chegam bagunçados — pense no que fazer antes das uniões.',
      prompt: `Há \`n\` pessoas (\`n ≥ 2\`), numeradas de \`0\` a \`n - 1\`. Cada registro de \`logs\` é \`[t, a, b]\`: no instante \`t\`, \`a\` e \`b\` viraram amigos. Amigo de amigo está no **mesmo grupo**.

Implemente \`momento_conectado(n, logs)\` que devolve o **menor instante** em que as \`n\` pessoas passam a formar **um único grupo**, ou \`-1\` se isso nunca acontecer.

- Os \`logs\` **não** vêm ordenados, e uma amizade pode se repetir.
- Objetivo: **\`O(m log m)\`** para \`m\` registros (o custo da ordenação), com Union-Find.`,
      starter: `def momento_conectado(n, logs):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'momento_conectado(4, [[5, 0, 1], [9, 2, 3], [7, 1, 2], [12, 0, 3]])', expected: '9' },
        { name: 'registros fora de ordem', expr: 'momento_conectado(3, [[8, 1, 2], [3, 0, 1]])', expected: '8' },
        { name: 'nunca conecta todo mundo', expr: 'momento_conectado(4, [[1, 0, 1], [2, 2, 3]])', expected: '-1' },
        { name: 'sem registros', expr: 'momento_conectado(2, [])', expected: '-1' },
        { name: 'amizade repetida não junta nada', expr: 'momento_conectado(3, [[1, 0, 1], [2, 1, 0], [6, 2, 0]])', expected: '6' },
        { name: 'duas pessoas', expr: 'momento_conectado(2, [[4, 1, 0]])', expected: '4' },
        { expr: 'momento_conectado(5, [[10, 0, 1], [1, 3, 4], [5, 1, 2], [7, 0, 2], [3, 2, 3]])', expected: '7', hidden: true },
        { expr: 'momento_conectado(6, [[1, 0, 1], [2, 2, 3], [3, 4, 5], [4, 1, 0], [5, 3, 4]])', expected: '-1', hidden: true },
        { expr: 'momento_conectado(3, [[2, 0, 1], [2, 1, 2]])', expected: '2', hidden: true },
        { expr: 'momento_conectado(4, [[30, 0, 3], [10, 0, 1], [20, 1, 0], [25, 2, 3], [40, 1, 2]])', expected: '30', hidden: true },
      ],
      perfTests: [
        {
          name: '4.000 pessoas, todas amigas da pessoa 0',
          setup: 'n = 4000\nlogs = [[t, 0, t] if t % 2 else [t, t, 0] for t in range(1, n)][::-1]',
          expr: 'momento_conectado(n, logs)',
          expected: '3999',
          maxMs: 40,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Compressão de caminho + união por rank',
      reviews: [
        {
          when: (m, code) => m.calls.includes('popleft') || /\b(visitad[oa]s?|visited|seen)\b/i.test(code),
          text: 'Refazer uma busca (BFS/DFS) a cada registro custa `O(n + m)` por registro — `O(m·(n + m))` no total. Com Union-Find, cada amizade custa quase `O(1)`, e um **contador de componentes** diz quando sobrou um grupo só.',
          concept: 'Union-Find (DSU)',
        },
        {
          when: (m, code) => /len\s*\(\s*(set\s*\(|\{)[^\n]*find/.test(code),
          text: 'Recontar os grupos com `len({find(i) for i in range(n)})` a cada registro custa `O(n)` por registro. Mantenha um contador: comece em `n` e subtraia 1 a cada `union` que realmente junta dois grupos.',
          concept: 'Contador de componentes',
        },
      ],
      hints: [
        'Ordene os registros pelo tempo (`sorted(logs)` já ordena pelo primeiro campo). Assim, o primeiro instante em que tudo fica conectado é o **primeiro** que você encontrar.',
        'Use um Union-Find e um contador `componentes = n`. A cada amizade que junta **dois grupos diferentes** (`find(a) != find(b)`), faça `componentes -= 1`.',
        'Quando `componentes == 1`, devolva o `t` do registro atual; se o laço acabar antes, devolva `-1`. Use compressão de caminho e união por rank para as árvores não virarem correntes.',
      ],
      solution: `def momento_conectado(n, logs):
    parent = list(range(n))
    rank = [0] * n

    def find(x):
        raiz = x
        while parent[raiz] != raiz:
            raiz = parent[raiz]
        while x != raiz:                  # compressão de caminho
            proximo = parent[x]
            parent[x] = raiz
            x = proximo
        return raiz

    componentes = n
    for t, a, b in sorted(logs):          # ordem cronológica
        ra, rb = find(a), find(b)
        if ra == rb:
            continue                      # já estavam no mesmo grupo
        if rank[ra] < rank[rb]:           # união por rank
            ra, rb = rb, ra
        parent[rb] = ra
        if rank[ra] == rank[rb]:
            rank[ra] += 1
        componentes -= 1
        if componentes == 1:
            return t
    return -1
`,
      solutionExplanation: 'Ordenar custa `O(m log m)`; cada registro faz duas buscas e no máximo uma união, quase `O(1)` amortizado com as duas otimizações: **tempo `O(m log m + m·α(n))`**, **espaço `O(n)`**. O contador de componentes evita recontar grupos: ele só cai quando uma união junta conjuntos **diferentes** — amizade repetida ou já implícita não muda nada. O teste de desempenho monta uma "estrela" em volta da pessoa 0: sem as otimizações, as árvores viram correntes e o total vira `O(n²)`.',
    },
    {
      type: 'mcq',
      id: 'lc-uf-q3',
      concept: 'Inversa de Ackermann',
      say: 'Pergunta de entrevista sênior: complexidade. Pense no quadro.',
      prompt: 'Com **compressão de caminho** e **união por rank** juntas, quanto custam `m` operações (`find` e `union`) sobre `n` elementos, no pior caso?',
      options: [
        { text: '`O(m)`: cada operação é exatamente `O(1)`.', why: 'Tarjan provou em 1975 que **não** é linear, e Fredman e Saks (1989) mostraram que nenhuma estrutura escapa do fator α(n). Na prática parece `O(1)`, mas não é.' },
        { text: '`O(m log n)`', why: 'Esse é o limite com **uma** otimização só — por exemplo, só união por rank, que garante altura `O(log n)`. Juntas, elas fazem muito melhor.' },
        { text: '`O(m·α(n))`, com α a inversa da função de Ackermann', correct: true, why: 'É o limite de Tarjan. Como α(n) ≤ 4 para qualquer `n` prático, na prática é "quase constante" por operação, amortizado.' },
        { text: '`O(m·n)`', why: 'É o pior caso da versão **ingênua**, quando as árvores viram correntes.' },
      ],
      explanation: 'O custo é **amortizado**: um `find` isolado ainda pode percorrer `O(log n)` nós, mas, ao fazê-lo, ele achata o caminho e "paga adiantado" as buscas seguintes. Somando tudo, `m` operações custam `O(m·α(n))`. Como α(n) não passa de 4 no universo observável, em entrevista vale dizer "quase `O(1)` amortizado" — e ganhar pontos citando a inversa de Ackermann.',
    },
    {
      type: 'code',
      id: 'lc-uf-q4',
      concept: 'Detecção de ciclo',
      title: 'Redundant Connection',
      say: 'LeetCode 684. Uma árvore ganhou uma aresta a mais — qual tirar?',
      prompt: `Um grafo **não dirigido** começou como uma **árvore** com os vértices \`1\` a \`n\` e ganhou **uma aresta extra** (que pode até repetir uma ligação existente). \`edges\` tem as \`n\` arestas, na ordem em que foram adicionadas.

Implemente \`find_redundant_connection(edges)\` que devolve a aresta cuja remoção faz o grafo voltar a ser uma árvore. Se houver várias, devolva a que aparece **por último** em \`edges\`.

- \`[[1, 2], [1, 3], [2, 3]]\` → \`[2, 3]\`
- Objetivo: **\`O(n·α(n))\`** com Union-Find.`,
      starter: `def find_redundant_connection(edges):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'find_redundant_connection([[1, 2], [1, 3], [2, 3]])', expected: '[2, 3]' },
        { name: 'ciclo de 4 vértices', expr: 'find_redundant_connection([[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]])', expected: '[1, 4]' },
        { name: 'o ciclo fecha antes do fim da lista', expr: 'find_redundant_connection([[1, 2], [2, 3], [3, 1], [3, 4]])', expected: '[3, 1]' },
        { name: 'aresta repetida', expr: 'find_redundant_connection([[1, 2], [2, 1]])', expected: '[2, 1]' },
        { expr: 'find_redundant_connection([[3, 4], [1, 2], [2, 4], [3, 5], [2, 5]])', expected: '[2, 5]', hidden: true },
        { expr: 'find_redundant_connection([[1, 4], [3, 4], [1, 3], [1, 2], [4, 5]])', expected: '[1, 3]', hidden: true },
        { expr: 'find_redundant_connection([[2, 3], [5, 2], [1, 5], [4, 1], [3, 4]])', expected: '[3, 4]', hidden: true },
        { expr: 'find_redundant_connection([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]])', expected: '[6, 1]', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 4.000, estrela em volta do vértice 1',
          setup: 'n = 4000\nedges = [[1, i] if i % 2 else [i, 1] for i in range(2, 3201)] + [[2, 3]] + [[1, i] if i % 2 else [i, 1] for i in range(3201, n + 1)]',
          expr: 'find_redundant_connection(edges)',
          expected: '[2, 3]',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Union-Find — quase O(1) por aresta',
      reviews: [
        {
          when: (m, code) => m.calls.includes('popleft') || /\b(visitad[oa]s?|visited|seen)\b/i.test(code),
          text: 'Rodar uma busca a cada aresta para ver se `u` já alcança `v` custa `O(n)` por aresta — `O(n²)` no total. No Union-Find, "já estão conectados?" é o próprio `find(u) == find(v)`.',
          concept: 'Union-Find (DSU)',
        },
        {
          when: m => m.calls.includes('remove') || m.calls.includes('copy'),
          text: 'Remover cada aresta e testar se o resto é uma árvore refaz o grafo inteiro a cada tentativa: `O(n²)`. Processando as arestas **em ordem**, a primeira cujo `union` falha já é a resposta.',
          concept: 'Detecção de ciclo',
        },
      ],
      hints: [
        'Processe as arestas na ordem. Antes de ligar `u` e `v`, pergunte: eles **já** estão no mesmo conjunto?',
        'Se `find(u) == find(v)`, essa aresta fecha um ciclo. Como o ciclo só se fecha quando chega a **última** aresta dele, ela é exatamente a resposta pedida.',
        'Os vértices vão de `1` a `n`, com `n = len(edges)`: crie `parent = list(range(n + 1))` e ignore a posição `0`.',
      ],
      solution: `def find_redundant_connection(edges):
    n = len(edges)
    parent = list(range(n + 1))           # vértices de 1 a n
    rank = [0] * (n + 1)

    def find(x):
        raiz = x
        while parent[raiz] != raiz:
            raiz = parent[raiz]
        while x != raiz:                  # compressão de caminho
            proximo = parent[x]
            parent[x] = raiz
            x = proximo
        return raiz

    for u, v in edges:
        ru, rv = find(u), find(v)
        if ru == rv:
            return [u, v]                 # u e v já estavam ligados: ciclo!
        if rank[ru] < rank[rv]:           # união por rank
            ru, rv = rv, ru
        parent[rv] = ru
        if rank[ru] == rank[rv]:
            rank[ru] += 1
    return []
`,
      solutionExplanation: 'Cada aresta faz duas buscas e no máximo uma união: **tempo `O(n·α(n))`**, **espaço `O(n)`**. Por que a primeira aresta que falha é a "última do ciclo"? O grafo tem exatamente **um** ciclo, e ele só passa a existir quando chega a sua última aresta — é justamente nela que `find(u) == find(v)` pela primeira vez. O que vem depois não importa.',
    },
    {
      type: 'order',
      id: 'lc-uf-q5',
      concept: 'Kruskal',
      say: 'Agora monte o Kruskal na ordem certa.',
      prompt: 'Coloque os passos do algoritmo de **Kruskal** (árvore geradora mínima) na ordem em que acontecem.',
      items: [
        'Ordenar as arestas por peso, da mais leve para a mais pesada',
        'Pegar a próxima aresta `(u, v)` da lista ordenada',
        'Comparar `find(u)` com `find(v)`',
        'Se as raízes forem diferentes, fazer `union(u, v)` e incluir a aresta na árvore',
        'Parar quando a árvore tiver `n - 1` arestas',
      ],
      explanation: 'Kruskal é **guloso**: sempre tenta a aresta mais barata ainda não considerada e a aceita se ela **não fechar ciclo** — pergunta que o DSU responde em `O(α(n))`. Uma árvore com `n` vértices tem exatamente `n - 1` arestas, então dá para parar cedo. O custo total é `O(E log E)`, dominado pela ordenação.',
    },
    {
      type: 'open',
      id: 'lc-uf-q6',
      concept: 'Escolha de algoritmo',
      say: 'Para fechar, uma pergunta de trade-off. Pense em voz alta.',
      prompt: 'Numa entrevista, te perguntam: "Quando você usaria **Union-Find** em vez de rodar **BFS/DFS**? E em que situações o Union-Find **não** serve?"',
      minWords: 30,
      rubric: [
        { label: 'Conexões chegando **aos poucos**, intercaladas com consultas (cenário dinâmico/online)', keywords: ['increment', 'dinamic', 'online', 'intercal', 'aos poucos', 'chegam', 'conforme', 'ao longo do tempo', 'tempo real', 'muitas consultas', 'varias consultas', 'stream'], concept: 'Union-Find (DSU)', why: 'Com BFS, cada pergunta refaz a busca; o DSU mantém os grupos sempre atualizados.' },
        { label: 'Compara custos: BFS/DFS **`O(V + E)`** por consulta × DSU quase `O(1)` amortizado (α(n))', keywords: ['o(v + e)', 'o(v+e)', 'v + e', 'v+e', 'ackermann', 'alfa', 'α', 'amortiz', 'quase constante', 'quase o(1)', 'por consulta'], concept: 'Inversa de Ackermann', why: 'O argumento de complexidade é o que convence o entrevistador.' },
        { label: 'Limitação: não suporta **remover** arestas nem desfazer uniões', keywords: ['remov', 'remoc', 'desfaz', 'deletar', 'apagar', 'separar', 'dividir', 'split', 'excluir'], concept: 'Union-Find (DSU)', why: 'O DSU só junta conjuntos; remoções exigem outra estrutura ou processar tudo ao contrário.' },
        { label: 'Limitação: não dá **caminho/distância** nem trata grafos **dirigidos**', keywords: ['caminho', 'distancia', 'dirigid', 'direcionad', 'rota', 'shortest', 'dijkstra', 'alcanc', 'simetric'], concept: 'Escolha de algoritmo', why: 'O DSU responde só "mesmo grupo?", e só para relações simétricas.' },
      ],
      modelAnswer: `Eu usaria **Union-Find** quando as conexões chegam **aos poucos**, intercaladas com muitas perguntas do tipo "esses dois estão no mesmo grupo?". Com BFS/DFS, cada consulta custa \`O(V + E)\`; com DSU e as duas otimizações, cada operação custa \`O(α(n))\` amortizado — a inversa de Ackermann, quase constante. Ele também é a peça central do Kruskal e da detecção de ciclos em grafos não dirigidos.

Por outro lado, o DSU só sabe **juntar**: não suporta **remover** arestas nem desfazer uniões (a não ser processando tudo ao contrário, offline). Ele também não devolve o **caminho** nem a **distância** entre dois vértices — para isso uso BFS ou Dijkstra — e não modela grafos **dirigidos**, em que "A alcança B" não implica "B alcança A". E, se o grafo é fixo e há uma única pergunta, uma BFS resolve sem estrutura extra.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! Union-Find é uma floresta de ponteiros: `find` com **compressão de caminho**, `union` por **rank**, e custo `O(α(n))` amortizado — a inversa de Ackermann que quase ninguém cita.',
        { text: 'Guarde o reflexo: conexões chegando e a pergunta "estão juntos?" → DSU. Precisou de caminho ou distância → BFS ou Dijkstra. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
