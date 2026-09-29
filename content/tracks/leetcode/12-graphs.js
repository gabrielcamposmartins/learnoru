(function () {
  // Utilitários dos testes (rodam depois do código do jogador).
  const GRADE = `def _grade(linhas):
    return [list(l) for l in linhas]


def _serpentina(n):
    """Uma única ilha em forma de serpente: milhares de células conectadas."""
    linhas = []
    for r in range(n):
        if r % 2 == 0:
            linhas.append("1" * n)
        elif r % 4 == 1:
            linhas.append("0" * (n - 1) + "1")
        else:
            linhas.append("1" + "0" * (n - 1))
    return linhas

`;
  const BFS_REF = `from collections import deque as _dq


def _bfs_ref(n, arestas, s, t):
    viz = [[] for _ in range(n)]
    for a, b in arestas:
        viz[a].append(b)
        viz[b].append(a)
    d = [-1] * n
    d[s] = 0
    f = _dq([s])
    while f:
        v = f.popleft()
        for w in viz[v]:
            if d[w] < 0:
                d[w] = d[v] + 1
                f.append(w)
    return d[t]

`;
  const TOPO = `def _valida(n, pre, ordem):
    """A ordem tem cada curso uma vez e respeita todos os pré-requisitos?"""
    if not isinstance(ordem, list) or sorted(ordem) != list(range(n)):
        return False
    pos = {c: i for i, c in enumerate(ordem)}
    return all(pos[p] < pos[c] for c, p in pre)

`;

  Game.registerModule('leetcode', {
    id: 'graphs',
    title: 'Grafos: BFS, DFS e ordenação topológica',
    kind: 'lesson',
    level: 3,
    order: 30,
    unit: 'grafos',
    summary: 'Modele o problema como grafo e escolha a busca certa: BFS para caminho mínimo sem peso, DFS para componentes e ilhas, Kahn para ordenar dependências e detectar ciclos.',
    concepts: ['Lista de adjacência', 'BFS', 'DFS', 'Ordenação topológica', 'Detecção de ciclo'],
    takeaways: [
      'Lista de adjacência (`defaultdict(list)`) é a representação padrão: `O(V + E)` de memória. Matriz só para grafos densos ou consulta de aresta em `O(1)`.',
      '**BFS** acha o **menor número de arestas** em grafo sem peso — e o vértice é marcado como visitado **ao enfileirar**.',
      '**DFS** conta componentes e ilhas; em Python, grafos e grades grandes pedem **pilha explícita** em vez de recursão.',
      '**Kahn**: graus de entrada + fila. Se sobrar vértice fora da ordem, há **ciclo**. Em grafo dirigido, a DFS de três cores também detecta ciclos.',
      'Tudo isso custa **`O(V + E)`**: cada vértice e cada aresta são processados um número constante de vezes.',
    ],
    glossary: [
      { term: 'BFS', aliases: ['busca em largura', 'breadth-first search', 'breadth first search'], definition: 'Busca em largura: explora o grafo em camadas de distância usando uma **fila**. Em grafo sem peso, a primeira vez que alcança um vértice é pelo caminho com menos arestas. `O(V + E)`.' },
      { term: 'DFS', aliases: ['busca em profundidade', 'depth-first search', 'depth first search'], definition: 'Busca em profundidade: segue um caminho até o fim antes de voltar, com recursão ou **pilha** explícita. Base para componentes, ciclos e ordenação topológica. `O(V + E)`.' },
      { term: 'Lista de adjacência', aliases: ['listas de adjacência', 'adjacency list', 'adjacency lists'], definition: 'Representação de grafo em que cada vértice guarda a lista dos seus vizinhos (em Python, `defaultdict(list)`). Usa `O(V + E)` de memória: a escolha padrão para grafos esparsos.' },
      { term: 'Ordenação topológica', aliases: ['ordenações topológicas', 'topological sort', 'topological sorting', 'topo sort'], definition: 'Ordem dos vértices de um grafo dirigido em que toda aresta `u -> v` tem `u` antes de `v`. Só existe se o grafo não tiver ciclos (um DAG).' },
      { term: 'Algoritmo de Kahn', aliases: ["Kahn's algorithm"], definition: 'Ordenação topológica com fila (Arthur Kahn, 1962): começa pelos vértices de grau de entrada 0 e vai "apagando" suas arestas. Se sobrar vértice, há ciclo. `O(V + E)`.' },
      { term: 'DAG', aliases: ['DAGs', 'grafo acíclico dirigido', 'grafos acíclicos dirigidos', 'directed acyclic graph'], definition: 'Grafo dirigido sem ciclos. Modela dependências (builds, cursos, planilhas, pipelines de dados) e é exatamente o tipo de grafo que admite ordenação topológica.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Chegamos aos **grafos** — o tema que mais assusta em entrevista e, ao mesmo tempo, o mais "mecânico" depois que você pega o jeito.',
          'O primeiro passo é sempre o mesmo: perceber que o problema **é** um grafo. Pessoas e amizades, cursos e pré-requisitos, células de um mapa…',
        ],
        board: {
          title: 'Grafos — representações',
          md: `Um **grafo** tem **vértices** (nós) e **arestas** (ligações). As arestas podem ter **direção** (seguir alguém) ou não (amizade), e **peso** (distância, custo) ou não.

\`\`\`python
from collections import defaultdict

arestas = [(0, 1), (0, 2), (1, 3), (2, 3)]

# Lista de adjacência — a escolha padrão
grafo = defaultdict(list)
for a, b in arestas:
    grafo[a].append(b)
    grafo[b].append(a)            # não dirigido: registra os dois sentidos

# Matriz de adjacência — grafos densos, ou "existe a aresta (u, v)?" em O(1)
n = 4
matriz = [[False] * n for _ in range(n)]
for a, b in arestas:
    matriz[a][b] = matriz[b][a] = True
\`\`\`

| Representação | Memória | Vizinhos de \`v\` | Existe \`(u, v)\`? |
|---|---|---|---|
| Lista de adjacência | \`O(V + E)\` | \`O(grau(v))\` | \`O(grau(u))\` |
| Matriz de adjacência | \`O(V²)\` | \`O(V)\` | \`O(1)\` |
| Lista de arestas | \`O(E)\` | \`O(E)\` | \`O(E)\` |

> [!dica] Uma **grade** (mapa de \`0\`/\`1\`, labirinto, tabuleiro) é um **grafo implícito**: os vizinhos de \`(i, j)\` são \`(i ± 1, j)\` e \`(i, j ± 1)\`. Não precisa montar nada.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          '**BFS** (busca em largura) explora o grafo em **camadas**: primeiro tudo a 1 passo da origem, depois a 2, e assim por diante.',
          'Por isso, a primeira vez que ela alcança um vértice é, garantidamente, pelo caminho com **menos arestas**.',
        ],
        board: {
          title: 'BFS: caminho mínimo sem peso',
          md: `Menor número de passos num labirinto (\`#\` é parede), do canto superior esquerdo ao inferior direito:

\`\`\`python
from collections import deque

def menor_caminho(grade):
    linhas, colunas = len(grade), len(grade[0])
    if grade[0][0] == "#":
        return -1
    dist = {(0, 0): 0}
    fila = deque([(0, 0)])
    while fila:
        i, j = fila.popleft()
        if (i, j) == (linhas - 1, colunas - 1):
            return dist[(i, j)]
        for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if (0 <= ni < linhas and 0 <= nj < colunas
                    and grade[ni][nj] != "#" and (ni, nj) not in dist):
                dist[(ni, nj)] = dist[(i, j)] + 1    # marca ao ENFILEIRAR
                fila.append((ni, nj))
    return -1
\`\`\`

\`\`\`text
labirinto        distâncias (camadas da BFS)
. . . .          0 1 2 3
. # # .          1 # # 4
. . # .          2 3 # 5      -> resposta: 5
\`\`\`

> [!atencao] Marque o vértice como visitado **ao enfileirar**, não ao desenfileirar. Senão ele entra na fila várias vezes — num grafo denso, a fila recebe \`O(E)\` entradas em vez de \`O(V)\`.

> [!dica] Com **pesos** diferentes, "menos arestas" deixa de ser "mais barato": aí entra o **Dijkstra**, que troca a fila por um heap.`,
        },
      },
      {
        type: 'say',
        text: [
          '**DFS** (busca em profundidade) segue um caminho até o fim antes de voltar. É a ferramenta para **componentes conectados**, ilhas e ciclos.',
          'Para contar componentes: dispare uma DFS de cada vértice ainda não visitado. Cada disparo é um componente novo.',
        ],
        board: {
          title: 'DFS: componentes conectados',
          md: `\`\`\`python
def componentes(n, grafo):
    visitado = [False] * n
    total = 0
    for inicio in range(n):
        if visitado[inicio]:
            continue
        total += 1                       # achou um componente novo
        visitado[inicio] = True
        pilha = [inicio]
        while pilha:                     # DFS iterativa: sem limite de recursão
            v = pilha.pop()
            for w in grafo[v]:
                if not visitado[w]:
                    visitado[w] = True
                    pilha.append(w)
    return total
\`\`\`

Cada vértice entra na pilha uma vez e cada aresta é olhada uma vez (duas, se não dirigida): **\`O(V + E)\`**.

| | Recursiva | Pilha explícita |
|---|---|---|
| Código | mais curto | um pouco mais longo |
| Profundidade máxima em Python | ~1.000 (\`RecursionError\`) | só limitada pela memória |
| Pós-ordem (útil para ordem topológica e ciclos) | natural | exige marcar a "volta" |

> [!atencao] Numa grade 300 × 300 toda de terra, a DFS recursiva pode descer 90 mil níveis: \`RecursionError\` na certa. Aumentar \`sys.setrecursionlimit\` só empurra o problema — dependendo do ambiente, estoura a pilha nativa e derruba o processo. Prefira a **pilha explícita** (ou BFS).`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora grafos **dirigidos** com dependências: cursos e pré-requisitos, pacotes de um build, células de uma planilha.',
          'A pergunta é "em que ordem fazer tudo?" — a **ordenação topológica**. O algoritmo de **Kahn** responde com uma fila.',
        ],
        board: {
          title: 'Ordenação topológica — o algoritmo de Kahn',
          md: `\`\`\`text
lógica ──> algoritmos ──> grafos
   │                        ^
   └─────> discreta ────────┘

grau de entrada: lógica 0 · algoritmos 1 · discreta 1 · grafos 2

fila: [lógica]
tira lógica      -> algoritmos e discreta caem para 0  -> fila: [algoritmos, discreta]
tira algoritmos  -> grafos cai para 1
tira discreta    -> grafos cai para 0                   -> fila: [grafos]
tira grafos      -> ordem: lógica, algoritmos, discreta, grafos
\`\`\`

1. Calcule o **grau de entrada** de cada vértice (quantas setas chegam nele).
2. Enfileire todos com grau 0 — eles não dependem de ninguém.
3. Tire um da fila, ponha na ordem e "apague" suas arestas: cada vizinho perde 1 de grau; quem chegar a 0 entra na fila.
4. Se a ordem terminar com **menos** vértices que o grafo, sobrou um **ciclo**: esses vértices nunca chegam a grau 0.

Tudo em **\`O(V + E)\`**.

> [!sabia] O Python tem ordenação topológica na **biblioteca padrão** desde a 3.9: \`graphlib.TopologicalSorter\`. Você passa \`{nó: predecessores}\` e \`static_order()\` devolve uma ordem válida — ou lança \`graphlib.CycleError\` apontando o ciclo. Com \`get_ready()\` e \`done()\`, ele entrega a cada rodada **todos** os nós já liberados, para processar em paralelo, como faria um sistema de build. O algoritmo da fila é de **Arthur Kahn (1962)**.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Última ferramenta: detectar ciclo com **DFS de três cores**. Serve para grafos dirigidos quando você já está usando DFS.',
          'O segredo é distinguir "já terminei esse vértice" de "esse vértice ainda está no meu caminho atual".',
        ],
        board: {
          title: 'Ciclos em grafo dirigido: três cores',
          md: `\`\`\`text
BRANCO = ainda não visitado
CINZA  = no caminho atual da DFS (em processamento)
PRETO  = terminado (ele e todos os descendentes)

Aresta para um nó CINZA?  -> ciclo! (aresta de retorno)
Aresta para um nó PRETO?  -> tudo bem: aquele trecho já foi explorado
\`\`\`

\`\`\`python
def tem_ciclo(n, grafo):                # grafo[v] = lista de sucessores
    cor = [0] * n                       # 0 = branco, 1 = cinza, 2 = preto

    def dfs(v):
        cor[v] = 1
        for w in grafo[v]:
            if cor[w] == 1:             # voltou para o caminho atual: ciclo
                return True
            if cor[w] == 0 and dfs(w):
                return True
        cor[v] = 2
        return False

    return any(cor[v] == 0 and dfs(v) for v in range(n))
\`\`\`

- Só "visitado ou não" **não basta** em grafo dirigido: chegar a um nó preto por outro caminho (um "losango") não é ciclo.
- Em grafo **não dirigido**, a regra muda: achar um vizinho já visitado que **não é o pai** indica ciclo (ou use Union-Find).

> [!dica] A **pós-ordem invertida** da DFS também é uma ordem topológica (Tarjan, 1976). Kahn e DFS custam o mesmo \`O(V + E)\`; Kahn é iterativo e já detecta o ciclo de brinde.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Caminho mínimo, ilhas, dependências e ciclos.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'lc-graph-q1',
        concept: 'BFS',
        say: 'Pergunta de abordagem, como no começo de uma entrevista de grafos.',
        prompt: 'Num grafo **sem pesos** com milhões de vértices, você quer o caminho com o **menor número de arestas** entre dois vértices. Qual é a escolha certa?',
        options: [
          { text: 'BFS a partir da origem, parando ao alcançar o destino.', correct: true, why: 'A BFS visita em camadas de distância: a primeira vez que alcança o destino é pelo menor número de arestas. `O(V + E)`.' },
          { text: 'DFS a partir da origem, guardando o primeiro caminho que chegar ao destino.', why: 'A DFS mergulha fundo e pode achar primeiro um caminho enorme. Para garantir o menor, teria de explorar todos os caminhos — exponencial.' },
          { text: 'Dijkstra com um heap.', why: 'Funciona (todos os pesos valem 1), mas paga `O(log V)` por operação de heap à toa: sem pesos, a fila simples da BFS já sai em ordem de distância.' },
          { text: 'Ordenação topológica e depois relaxar as arestas nessa ordem.', why: 'Isso só vale para grafos **acíclicos dirigidos** (DAGs). Um grafo qualquer pode ter ciclos — e aí não existe ordem topológica.' },
        ],
        explanation: 'Sem pesos, a **fila** da BFS processa os vértices em ordem não decrescente de distância — é por isso que ela acha o caminho mínimo em `O(V + E)`. O Dijkstra generaliza a ideia para pesos **não negativos**, trocando a fila por um heap. A DFS serve para alcançabilidade, componentes e ciclos, não para "o mais curto".',
      },
      {
        type: 'code',
        id: 'lc-graph-q2',
        concept: 'BFS',
        title: 'Menor caminho num grafo sem peso',
        say: 'Vamos codar a BFS de verdade, a partir de uma lista de arestas.',
        prompt: `Implemente \`shortest_path(n, edges, origem, destino)\`: o grafo é **não dirigido**, com vértices \`0..n-1\`, e cada aresta \`[a, b]\` liga \`a\` e \`b\` nos dois sentidos. Devolva o **menor número de arestas** de \`origem\` até \`destino\`, ou \`-1\` se não houver caminho.

- Pode haver arestas repetidas e laços (\`[v, v]\`).
- \`origem == destino\` vale \`0\`.
- Objetivo: **\`O(V + E)\`**. O teste de desempenho tem 3.000 vértices.`,
        starter: `from collections import deque


def shortest_path(n, edges, origem, destino):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'shortest_path(6, [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5]], 0, 5)', expected: '4' },
          { name: 'origem igual ao destino', expr: 'shortest_path(3, [[0, 1]], 2, 2)', expected: '0' },
          { name: 'sem caminho', expr: 'shortest_path(4, [[0, 1], [2, 3]], 0, 3)', expected: '-1' },
          { name: 'atalho vence o caminho longo', expr: 'shortest_path(5, [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]], 0, 4)', expected: '1' },
          { name: 'arestas repetidas e laço', expr: 'shortest_path(3, [[0, 1], [0, 1], [1, 1], [1, 2]], 0, 2)', expected: '2' },
          { expr: 'shortest_path(8, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7], [0, 5], [5, 6], [6, 7]], 0, 7)', expected: '3', hidden: true },
          { expr: 'shortest_path(5, [], 0, 4)', expected: '-1', hidden: true },
          { expr: 'shortest_path(3, [[1, 0], [2, 1]], 0, 2)', expected: '2', hidden: true },
          { expr: 'shortest_path(4, [[0, 1], [1, 2], [2, 0], [2, 3]], 1, 3)', expected: '2', hidden: true },
        ],
        perfTests: [
          {
            name: '3.000 vértices, ~4.500 arestas',
            setup: BFS_REF + `import random as _r
_g = _r.Random(1)
n = 3000
arestas = [[i, i + 1] for i in range(n - 1)] + [[i, i + 3] for i in range(0, n - 3, 2)]
_g.shuffle(arestas)
for _e in arestas:
    if _g.random() < 0.5:
        _e.reverse()
_esperado = _bfs_ref(n, arestas, 0, n - 1)`,
            expr: 'shortest_path(n, arestas, 0, n - 1)',
            expected: '_esperado',
            maxMs: 40,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'BFS com lista de adjacência — O(V + E)',
        reviews: [
          {
            when: (m, code) => /while[\s\S]*for\s+\w+\s*,\s*\w+\s+in\s+edges\b/.test(code),
            text: 'Percorrer a lista de arestas inteira para achar os vizinhos de cada vértice custa `O(V·E)`. Monte antes uma **lista de adjacência**: aí a BFS toda custa `O(V + E)`.',
            concept: 'Lista de adjacência',
          },
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
            text: '`lista.pop(0)` desloca todos os elementos restantes: `O(n)` por remoção. Para a fila da BFS, use `collections.deque` com `popleft()`.',
            concept: 'deque vs list.pop(0)',
          },
          {
            when: m => m.recursion,
            text: 'DFS recursiva não garante o **menor** caminho — e explorar todos os caminhos é exponencial. Para o menor número de arestas, BFS.',
            concept: 'BFS',
          },
          {
            when: m => m.calls.includes('heappush'),
            text: 'Dijkstra funciona, mas o heap custa `O(log V)` por operação à toa: sem pesos, a fila da BFS já sai em ordem de distância.',
            concept: 'BFS',
          },
        ],
        hints: [
          'Monte a lista de adjacência: `vizinhos = [[] for _ in range(n)]` e, para cada `[a, b]`, registre os **dois** sentidos.',
          'Guarde `dist = [-1] * n`, com `dist[origem] = 0`, e uma `deque([origem])`. Enquanto houver fila, `popleft()` e olhe os vizinhos.',
          'Vizinho com `dist == -1`: defina `dist[w] = dist[v] + 1` e enfileire **na hora** (marca ao enfileirar). Ao tirar o `destino` da fila, devolva `dist[destino]`.',
        ],
        solution: `from collections import deque


def shortest_path(n, edges, origem, destino):
    vizinhos = [[] for _ in range(n)]
    for a, b in edges:
        vizinhos[a].append(b)
        vizinhos[b].append(a)
    dist = [-1] * n
    dist[origem] = 0
    fila = deque([origem])
    while fila:
        v = fila.popleft()
        if v == destino:
            return dist[v]
        for w in vizinhos[v]:
            if dist[w] == -1:            # marca ao ENFILEIRAR
                dist[w] = dist[v] + 1
                fila.append(w)
    return -1
`,
        solutionExplanation: 'Montar a lista de adjacência custa `O(E)`; na BFS, cada vértice entra na fila uma vez e cada aresta é olhada duas vezes: **tempo `O(V + E)`**, **espaço `O(V + E)`**. O `dist` faz dois papéis — visitado e distância —, e marcar ao enfileirar impede duplicatas na fila. Arestas repetidas e laços não atrapalham: o vizinho já marcado é ignorado.',
      },
      {
        type: 'code',
        id: 'lc-graph-q3',
        concept: 'DFS',
        title: 'Number of Islands',
        say: 'LeetCode 200, talvez o problema de grafo mais pedido. A grade **é** o grafo.',
        prompt: `Implemente \`num_islands(grid)\`: \`grid\` é uma lista de listas com \`"1"\` (terra) e \`"0"\` (água). Uma **ilha** é um grupo de terras ligadas na **horizontal ou vertical** (diagonal não conta). Devolva quantas ilhas existem.

- \`grid\` pode ser vazio (\`[]\`). Você pode modificar a grade.
- Objetivo: **\`O(linhas × colunas)\`**.
- ⚠ O teste de desempenho tem uma ilha em **serpentina** com milhares de células: DFS recursiva passa do limite de recursão do Python. Use uma **pilha explícita** ou BFS.`,
        starter: `def num_islands(grid):
    pass
`,
        tests: [
          { name: 'exemplo 1', setup: GRADE, expr: 'num_islands(_grade(["11110", "11010", "11000", "00000"]))', expected: '1' },
          { name: 'exemplo 2', setup: GRADE, expr: 'num_islands(_grade(["11000", "11000", "00100", "00011"]))', expected: '3' },
          { name: 'grade vazia', expr: 'num_islands([])', expected: '0' },
          { name: 'só água', setup: GRADE, expr: 'num_islands(_grade(["00", "00"]))', expected: '0' },
          { name: 'diagonal não conecta', setup: GRADE, expr: 'num_islands(_grade(["101", "010", "101"]))', expected: '5' },
          { setup: GRADE, expr: 'num_islands(_grade(["111", "101", "111"]))', expected: '1', hidden: true },
          { setup: GRADE, expr: 'num_islands(_grade(["1"]))', expected: '1', hidden: true },
          { setup: GRADE, expr: 'num_islands(_grade(["11111", "00001", "11111", "10000", "11111"]))', expected: '1', hidden: true },
          { setup: GRADE, expr: 'num_islands(_grade(["1", "0", "1", "1"]))', expected: '2', hidden: true },
        ],
        perfTests: [
          {
            name: 'grade 80 × 80 com uma ilha em serpentina',
            setup: GRADE + 'g = _grade(_serpentina(80))',
            expr: 'num_islands(g)',
            expected: '1',
            maxMs: 50,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'DFS/BFS com marcação em O(linhas × colunas)',
        reviews: [
          {
            when: m => m.recursion || m.calls.includes('setrecursionlimit'),
            text: 'DFS recursiva numa grade grande pode descer milhares de níveis: `RecursionError` com o limite padrão — e aumentar `sys.setrecursionlimit` pode estourar a pilha nativa. Uma pilha explícita (ou BFS) não tem esse teto.',
            concept: 'Recursão e pilha de chamadas',
          },
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
            text: '`lista.pop(0)` é `O(n)`: numa BFS grande, a fila vira gargalo. Use `collections.deque` com `popleft()` — ou uma pilha com `pop()` (DFS).',
            concept: 'deque vs list.pop(0)',
          },
        ],
        hints: [
          'Percorra todas as células. Cada `"1"` ainda não visitado é o começo de uma **ilha nova**: some 1 e "afunde" a ilha inteira.',
          'Para afundar, use uma pilha: empilhe a célula, marque-a como `"0"` e, enquanto a pilha tiver itens, `pop()` e empilhe os vizinhos de cima, baixo, esquerda e direita que forem `"1"`.',
          'Marque a célula **ao empilhar** (não ao desempilhar) e confira os limites `0 <= i < linhas` e `0 <= j < colunas` antes de acessar a grade.',
        ],
        solution: `def num_islands(grid):
    if not grid:
        return 0
    linhas, colunas = len(grid), len(grid[0])
    ilhas = 0
    for r in range(linhas):
        for c in range(colunas):
            if grid[r][c] != "1":
                continue
            ilhas += 1                    # uma ilha nova: afunda ela inteira
            grid[r][c] = "0"              # marca ao EMPILHAR
            pilha = [(r, c)]
            while pilha:                  # DFS iterativa: sem limite de recursão
                i, j = pilha.pop()
                for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if 0 <= ni < linhas and 0 <= nj < colunas and grid[ni][nj] == "1":
                        grid[ni][nj] = "0"
                        pilha.append((ni, nj))
    return ilhas
`,
        solutionExplanation: 'Cada célula é afundada uma única vez e olha 4 vizinhos: **tempo `O(L·C)`**; a pilha pode guardar `O(L·C)` células no pior caso. "Afundar" (`"1"` → `"0"`) dispensa uma matriz de visitados, mas **modifica a entrada** — se isso não for permitido, use um `set` ou uma matriz de booleanos. A pilha explícita troca o limite de ~1.000 chamadas por memória comum.',
      },
      {
        type: 'match',
        id: 'lc-graph-q4',
        concept: 'Escolha do algoritmo de grafo',
        say: 'Bate-bola: qual algoritmo para cada situação?',
        prompt: 'Associe cada problema ao algoritmo mais adequado.',
        pairs: [
          { left: 'Menor número de conexões entre duas pessoas numa rede social', right: 'BFS a partir da origem' },
          { left: 'Contar ilhas num mapa de `0`s e `1`s', right: 'DFS ou BFS a partir de cada célula não visitada' },
          { left: 'Ordem de build de pacotes com dependências', right: 'Ordenação topológica (Kahn)' },
          { left: 'Rota mais rápida com tempos diferentes em cada rua', right: 'Dijkstra (pesos não negativos)' },
          { left: 'Achar dependência circular num grafo dirigido, já usando DFS', right: 'DFS de três cores (aresta para nó cinza)' },
        ],
        explanation: 'A pergunta guia é **o que o problema quer**: "menos passos" sem pesos → BFS; "quais estão conectados" → DFS/BFS (ou Union-Find); "em que ordem" → ordenação topológica; "mais barato" com pesos não negativos → Dijkstra; "existe ciclo" → Kahn (sobra vértice) ou DFS com três cores.',
      },
      {
        type: 'code',
        id: 'lc-graph-q5',
        concept: 'Ordenação topológica',
        title: 'Course Schedule II',
        say: 'LeetCode 210. Cursos, pré-requisitos — e, quem sabe, um ciclo escondido.',
        prompt: `Há \`num_courses\` cursos, numerados de \`0\` a \`num_courses - 1\`. Cada item \`[curso, pre]\` de \`prerequisites\` diz que \`pre\` precisa ser feito **antes** de \`curso\`.

Implemente \`find_order(num_courses, prerequisites)\`: devolva **uma** ordem válida para fazer todos os cursos (qualquer uma serve) ou \`[]\` se for impossível — ou seja, se houver ciclo.

- Pode haver pré-requisitos repetidos.
- Objetivo: **\`O(V + E)\`**. O teste de desempenho tem 1.500 cursos e ~2.900 pré-requisitos.`,
        starter: `from collections import deque


def find_order(num_courses, prerequisites):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'find_order(2, [[1, 0]])', expected: '[0, 1]' },
          {
            name: 'várias ordens válidas',
            setup: TOPO,
            code: `P = [[1, 0], [2, 0], [3, 1], [3, 2]]
ordem = find_order(4, P)
assert _valida(4, P, ordem), f"ordem inválida: {ordem}"`,
          },
          { name: 'ciclo', expr: 'find_order(2, [[1, 0], [0, 1]])', expected: '[]' },
          {
            name: 'sem pré-requisitos',
            setup: TOPO,
            code: `ordem = find_order(3, [])
assert _valida(3, [], ordem), f"ordem inválida: {ordem}"`,
          },
          { name: 'ciclo escondido no meio', expr: 'find_order(5, [[1, 0], [2, 1], [3, 2], [1, 3], [4, 0]])', expected: '[]' },
          { expr: 'find_order(1, [[0, 0]])', expected: '[]', hidden: true },
          { expr: 'find_order(1, [])', expected: '[0]', hidden: true },
          { expr: 'find_order(3, [[1, 0], [1, 0], [2, 1]])', expected: '[0, 1, 2]', hidden: true },
          {
            setup: TOPO,
            code: `P = [[3, 0], [3, 1], [4, 1], [4, 2], [5, 3], [5, 4]]
ordem = find_order(6, P)
assert _valida(6, P, ordem), f"ordem inválida: {ordem}"`,
            hidden: true,
          },
        ],
        perfTests: [
          {
            name: '1.500 cursos em 30 camadas',
            setup: TOPO + `import random as _r
_g = _r.Random(5)
n = 1500
_perm = list(range(n))
_g.shuffle(_perm)
pre = []
for _c in range(29):
    for _i in range(50):
        _u = _perm[_c * 50 + _i]
        for _k in range(2):
            pre.append([_perm[(_c + 1) * 50 + _g.randrange(50)], _u])
_g.shuffle(pre)`,
            expr: '_valida(n, pre, find_order(n, pre))',
            expected: 'True',
            maxMs: 40,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Kahn — O(V + E)',
        reviews: [
          {
            when: m => m.calls.includes('all'),
            text: 'Procurar, a cada rodada, um curso com todos os pré-requisitos feitos varre as arestas de novo: `O(V·E)`. Kahn mantém o **grau de entrada** de cada curso e olha cada aresta uma única vez: `O(V + E)`.',
            concept: 'Algoritmo de Kahn',
          },
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
            text: '`lista.pop(0)` é `O(n)` por remoção. Para a fila do Kahn, use `collections.deque` com `popleft()`.',
            concept: 'deque vs list.pop(0)',
          },
        ],
        hints: [
          'Monte `seguintes[pre]` (quem depende de `pre`) e conte o **grau de entrada** de cada curso: quantos pré-requisitos ele tem.',
          'Enfileire todos os cursos com grau 0. Ao tirar um da fila, coloque-o na ordem e diminua o grau de cada curso em `seguintes[c]`; quem chegar a 0 entra na fila.',
          'No fim, se `len(ordem) < num_courses`, sobrou um ciclo: devolva `[]`. Pré-requisito repetido funciona sozinho: ele soma 2 no grau e é descontado 2 vezes.',
        ],
        solution: `from collections import deque


def find_order(num_courses, prerequisites):
    seguintes = [[] for _ in range(num_courses)]
    grau = [0] * num_courses                  # quantos pré-requisitos faltam
    for curso, pre in prerequisites:
        seguintes[pre].append(curso)
        grau[curso] += 1
    fila = deque(c for c in range(num_courses) if grau[c] == 0)
    ordem = []
    while fila:
        c = fila.popleft()
        ordem.append(c)
        for s in seguintes[c]:
            grau[s] -= 1
            if grau[s] == 0:                  # todos os pré-requisitos feitos
                fila.append(s)
    return ordem if len(ordem) == num_courses else []   # sobrou alguém: ciclo
`,
        solutionExplanation: 'Cada curso entra e sai da fila no máximo uma vez e cada pré-requisito é descontado uma vez: **tempo `O(V + E)`**, **espaço `O(V + E)`**. A detecção de ciclo sai de graça: cursos presos num ciclo nunca chegam a grau 0 e ficam fora da ordem. A DFS com pós-ordem invertida também resolve em `O(V + E)`, mas precisa das três cores para detectar o ciclo — e cuidado com a recursão em cadeias longas.',
      },
      {
        type: 'mcq',
        id: 'lc-graph-q6',
        concept: 'Detecção de ciclo',
        say: 'Última: um follow-up clássico sobre o Kahn.',
        prompt: 'Você rodou o algoritmo de Kahn num grafo **dirigido** com 6 vértices. A fila esvaziou, mas a ordem só tem **4** vértices. O que isso significa?',
        options: [
          { text: 'Há um ciclo: os 2 vértices restantes nunca chegaram a grau de entrada 0.', correct: true, why: 'Num ciclo, cada vértice espera pelo anterior — ninguém libera ninguém. É assim que Kahn detecta ciclos de brinde.' },
          { text: 'O grafo é desconexo: os 2 vértices estão em outro componente.', why: 'Kahn lida bem com vários componentes: todo vértice de grau 0, de qualquer componente, entra na fila logo no início.' },
          { text: 'Os 2 vértices restantes são isolados, sem nenhuma aresta.', why: 'Vértices isolados têm grau de entrada 0 e entram na fila no começo — estariam na ordem.' },
          { text: 'Nada de errado: basta anexar os 2 restantes ao fim da ordem.', why: 'Eles têm pré-requisitos nunca satisfeitos (o ciclo): em qualquer posição, alguma aresta seria violada. Não existe ordem válida.' },
        ],
        explanation: 'Kahn só põe na ordem vértices cujo grau de entrada chegou a 0 — ou seja, cujos predecessores já saíram. Se sobrou alguém, ele depende, direta ou indiretamente, de si mesmo (ou de alguém preso num ciclo). Por isso `len(ordem) < n` é o teste de ciclo mais barato que existe, e os LeetCode 207 e 210 cobram exatamente isso.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Fechamos grafos! Lista de adjacência para representar, **BFS** para o caminho mínimo sem peso, **DFS** com pilha explícita para componentes e **Kahn** para dependências e ciclos.',
          { text: 'Tudo em `O(V + E)`. Com essa base, Union-Find e Dijkstra vão parecer extensões naturais. Até a próxima!', mood: 'neutral' },
        ],
        board: null,
      },
    ],
  });
})();
