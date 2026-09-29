(function () {
  // Utilitários dos testes de desempenho (rodam depois do código do jogador).
  const NDT_PERF = `import heapq as _hq
import random as _r


def _ndt_ref(times, n, k):
    viz = [[] for _ in range(n + 1)]
    for u, v, w in times:
        viz[u].append((v, w))
    dist = [float("inf")] * (n + 1)
    dist[k] = 0
    h = [(0, k)]
    while h:
        d, u = _hq.heappop(h)
        if d > dist[u]:
            continue
        for v, w in viz[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                _hq.heappush(h, (d + w, v))
    m = max(dist[1:])
    return m if m < float("inf") else -1


_g = _r.Random(7)
n = 1500
_perm = list(range(2, n + 1))
_g.shuffle(_perm)
_perm = [1] + _perm
# uma "estrada" longa e barata + atalhos caros: a árvore de caminhos mínimos é funda
times = [[_perm[i], _perm[i + 1], _g.randint(1, 3)] for i in range(n - 1)]
for _ in range(4500):
    _a, _b = _g.randrange(n), _g.randrange(n)
    if _a != _b:
        times.append([_perm[_a], _perm[_b], 3 * abs(_a - _b) + _g.randint(0, 9)])
_g.shuffle(times)
_esperado = _ndt_ref(times, n, 1)
`;
  const BF_PERF = `import random as _r


def _bf_ref(n, edges, origem):
    dist = [float("inf")] * n
    dist[origem] = 0
    for _ in range(n - 1):
        mudou = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                mudou = True
        if not mudou:
            break
    return dist


_g = _r.Random(4)
n = 800
# pesos w = c + p[u] - p[v], com c >= 0: há arestas negativas, mas nenhum ciclo negativo
_pot = [_g.randint(0, 50) for _ in range(n)]
_arestas = [[i, i + 1, _g.randint(0, 20) + _pot[i] - _pot[i + 1]] for i in range(n - 1)]
while len(_arestas) < 4000:
    _a, _b = _g.randrange(n), _g.randrange(n)
    if _a != _b:
        _arestas.append([_a, _b, _g.randint(0, 60) + _pot[_a] - _pot[_b]])
_perm = list(range(n))
_g.shuffle(_perm)
arestas = [[_perm[a], _perm[b], w] for a, b, w in _arestas]
_g.shuffle(arestas)
origem = _perm[0]
_esperado = _bf_ref(n, arestas, origem)
`;

  Game.registerModule('leetcode', {
    id: 'dijkstra',
    title: 'Dijkstra e caminhos mínimos com peso',
    kind: 'lesson',
    level: 3,
    order: 32,
    unit: 'grafos',
    summary: 'Quando cada aresta tem um custo, a BFS não basta: Dijkstra com heapq e entradas obsoletas, por que um peso negativo o quebra (e o Bellman-Ford resolve) e o A* em linhas gerais.',
    concepts: ['Dijkstra', 'Relaxamento', 'Entradas obsoletas', 'Bellman-Ford', 'A*'],
    takeaways: [
      'Com pesos, "menos arestas" deixa de ser "mais barato": o **Dijkstra** troca a fila da BFS por um **heap** de `(distância, vértice)` e **relaxa** as arestas.',
      'O `heapq` não tem *decrease-key*: empurre a entrada nova e **descarte a obsoleta** quando ela sair (`if d > dist[u]: continue`). Custo: `O((V + E) log V)`.',
      'Um único peso **negativo** quebra a invariante gulosa. O **Bellman-Ford** relaxa todas as arestas até `V − 1` vezes (`O(V·E)`); se uma rodada extra ainda melhora algo, há **ciclo negativo**.',
      'O `A*` ordena o heap por `g + h`: com heurística **admissível** (nunca superestima), o caminho continua ótimo e bem menos vértices são explorados. Com `h = 0`, é o próprio Dijkstra.',
      'Pesos só 0 ou 1? **0-1 BFS** com `deque`, em `O(V + E)`. Grafo acíclico? Ordenação topológica e relaxar em ordem, também linear.',
    ],
    glossary: [
      { term: 'Algoritmo de Dijkstra', aliases: ['Dijkstra', "Dijkstra's algorithm"], definition: 'Caminho mínimo a partir de uma origem em grafo com pesos **não negativos**: tira do heap o vértice de menor distância provisória e relaxa suas arestas. Com `heapq`, `O((V + E) log V)`.' },
      { term: 'Relaxamento', aliases: ['relaxamentos', 'relaxar a aresta', 'relaxar as arestas', 'relaxation', 'edge relaxation'], definition: 'Testar se ir até `v` passando por `u` é mais barato do que o melhor conhecido: `if dist[u] + w < dist[v]: dist[v] = dist[u] + w`. É a operação básica de Dijkstra, Bellman-Ford e A*.' },
      { term: 'Bellman-Ford', aliases: ['algoritmo de Bellman-Ford', 'Bellman Ford'], definition: 'Caminho mínimo que aceita pesos **negativos**: relaxa todas as arestas até `V − 1` vezes, em `O(V·E)`. Se uma rodada extra ainda melhora alguma distância, existe um **ciclo negativo** alcançável.' },
      { term: 'A*', aliases: ['A estrela', 'A-estrela', 'A-star', 'A star'], definition: 'Busca de caminho mínimo até **um alvo** que ordena o heap por `g + h`: custo real até aqui mais uma estimativa até o alvo. Com heurística admissível, acha o caminho ótimo explorando menos que o Dijkstra.' },
      { term: 'Heurística admissível', aliases: ['heurísticas admissíveis', 'admissible heuristic', 'heurística consistente', 'heurísticas consistentes', 'consistent heuristic'], definition: 'Estimativa que **nunca superestima** o custo real até o alvo (ex.: distância em linha reta num mapa). **Consistente** é mais forte: `h(u) ≤ w(u, v) + h(v)` em toda aresta — aí cada vértice é finalizado uma vez só.' },
      { term: '0-1 BFS', aliases: ['BFS 0-1', '0/1 BFS', 'zero-one BFS'], definition: 'Caminho mínimo quando os pesos são só 0 ou 1: uma `deque` em que arestas de peso 0 entram pela **frente** e as de peso 1 pelo **fim**. Mantém a ordem de distância sem heap: `O(V + E)`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Na aula de grafos, a BFS achava o caminho com **menos arestas**. Agora cada rua tem um **tempo** diferente — e a conta muda.',
          'Hoje é dia de **Dijkstra**: o algoritmo por trás de GPS, roteamento de rede e metade das perguntas de grafo com peso.',
        ],
        board: {
          title: 'Quando a BFS erra',
          md: `\`\`\`text
        1           1
   A ─────── B ─────── C
   └─────────────────────┘
              5

BFS (menos arestas):  A → C          custo 5   (1 aresta)
mais barato:          A → B → C      custo 2   (2 arestas)
\`\`\`

Com pesos, "chegou primeiro em camadas" não quer dizer "chegou mais barato". A operação que resolve isso é o **relaxamento**:

\`\`\`python
# "passar por u melhora o caminho até v?"
if dist[u] + peso < dist[v]:
    dist[v] = dist[u] + peso
\`\`\`

Todo algoritmo de caminho mínimo é uma **estratégia para decidir em que ordem relaxar**:

| Grafo | Algoritmo | Custo |
|---|---|---|
| sem peso (ou tudo 1) | BFS | \`O(V + E)\` |
| pesos 0 ou 1 | 0-1 BFS (\`deque\`) | \`O(V + E)\` |
| pesos **não negativos** | **Dijkstra** (heap) | \`O((V + E) log V)\` |
| pesos negativos | Bellman-Ford | \`O(V·E)\` |
| DAG (acíclico) | ordem topológica + relaxar | \`O(V + E)\` |`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A ideia do Dijkstra: sempre expandir o vértice **mais próximo** que ainda não foi resolvido. Para achar esse vértice rápido, um **min-heap**.',
          'O detalhe que separa quem decorou de quem entendeu: o `heapq` não sabe **diminuir** uma prioridade. Então a gente empurra a entrada nova e **ignora a velha** quando ela sair.',
        ],
        board: {
          title: 'Dijkstra com heapq — entradas obsoletas',
          md: `\`\`\`python
import heapq

def dijkstra(n, vizinhos, origem):          # vizinhos[u] = [(v, peso), ...]
    dist = [float("inf")] * n
    dist[origem] = 0
    heap = [(0, origem)]                     # tuplas: o heap ordena pela distância
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:                      # entrada OBSOLETA: já achamos melhor
            continue
        for v, peso in vizinhos[u]:
            nd = d + peso
            if nd < dist[v]:                 # relaxamento
                dist[v] = nd
                heapq.heappush(heap, (nd, v))   # a entrada antiga de v fica lá
    return dist
\`\`\`

Rodando a partir de **A** em: A→B 4, A→C 1, C→B 2, B→D 1, C→D 5.

| Sai do heap | O que acontece | Heap depois |
|---|---|---|
| \`(0, A)\` | B = 4, C = 1 | \`(1,C) (4,B)\` |
| \`(1, C)\` | B melhora para **3**; D = 6 | \`(3,B) (4,B) (6,D)\` |
| \`(3, B)\` | D melhora para **4** | \`(4,B) (4,D) (6,D)\` |
| \`(4, B)\` | **obsoleta**: 4 > dist[B] = 3 → ignora | \`(4,D) (6,D)\` |
| \`(4, D)\` | nada a relaxar | \`(6,D)\` |
| \`(6, D)\` | **obsoleta** → ignora | vazio |

> [!atencao] Sem o \`if d > dist[u]: continue\`, o resultado continua certo (com pesos não negativos), mas cada entrada obsoleta **varre de novo** a lista de vizinhos. Em grafo denso, isso multiplica o trabalho. É a *lazy deletion* da aula de heaps, aplicada.

> [!dica] Se o vértice não for comparável (um objeto, um \`dict\`), o empate na distância faz a tupla comparar o vértice e dá \`TypeError\`. Use \`(distância, contador, vértice)\` com um contador crescente.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por que dá certo? Quando um vértice sai do heap com a distância atual, **nenhum caminho futuro** consegue ficar mais barato — todo o resto já custa pelo menos isso.',
          'E essa garantia se apoia em uma hipótese só: **nenhum peso negativo**. Guarde isso, que já já vamos quebrá-la.',
        ],
        board: {
          title: 'Invariante, custo e variações',
          md: `**Invariante gulosa:** o vértice \`u\` que sai do heap (entrada não obsoleta) tem \`dist[u]\` **definitiva**. Qualquer outro caminho até \`u\` teria de passar por um vértice ainda no heap, que já custa \`≥ dist[u]\` — e pesos \`≥ 0\` só somam.

**Custo com \`heapq\`:** cada aresta faz no máximo um \`heappush\`, então o heap tem até \`E\` entradas. Cada operação custa \`O(log E) = O(log V)\` (porque \`E ≤ V²\`). Total: **\`O((V + E) log V)\`**, memória \`O(V + E)\`.

| Implementação | Tempo | Quando |
|---|---|---|
| vetor + varredura do mínimo (a original) | \`O(V²)\` | grafo **denso** (\`E ≈ V²\`) |
| \`heapq\` + entradas obsoletas | \`O((V + E) log V)\` | o padrão em entrevista |
| heap de Fibonacci (Fredman e Tarjan, 1984) | \`O(E + V log V)\` | teoria; constante alta na prática |

Variações que caem em entrevista:
- **Um destino só:** pare quando o destino **sair** do heap (não quando for descoberto).
- **Reconstruir o caminho:** ao relaxar, guarde \`anterior[v] = u\` e percorra de trás para frente.
- **Custo que não é soma** (ex.: "menor esforço máximo" numa trilha): troque \`d + peso\` por \`max(d, peso)\` — a invariante continua valendo.

> [!sabia] Dijkstra inventou o algoritmo em 1956, em uns **20 minutos**, sentado num café em Amsterdã com a noiva — sem papel nem lápis, segundo ele. Publicou só em 1959, num artigo de **3 páginas**. E há um primo pouco conhecido: com pesos só **0 ou 1**, a **0-1 BFS** usa uma \`deque\` — peso 0 entra pela frente (\`appendleft\`), peso 1 pelo fim — e resolve em \`O(V + E)\`, sem heap. Para pesos inteiros pequenos, o **algoritmo de Dial** (1969) generaliza a ideia com baldes.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a pegadinha clássica: por que o Dijkstra **não aceita pesos negativos**?',
          'Porque a invariante gulosa cai: um caminho que parecia caro pode ficar barato **depois**, passando por uma aresta negativa.',
        ],
        board: {
          title: 'Pesos negativos e o Bellman-Ford',
          md: `\`\`\`text
          2              1
    A ─────────> B ─────────> D
    │            ^
  5 │            │ -4
    v            │
    C ───────────┘

Dijkstra que finaliza ao tirar do heap:
  A(0) → B(2) finalizado → D(3) finalizado → C(5)
  C → B daria 5 - 4 = 1 < 2 ... tarde demais: B e D já saíram errados.
Certo: B = 1, D = 2.
\`\`\`

A versão com entradas obsoletas **reabre** B e até chega ao número certo aqui — mas perde a garantia: no pior caso reprocessa vértices um número **exponencial** de vezes, e com **ciclo negativo** nunca termina.

**Bellman-Ford** (Ford, 1956; Bellman, 1958) não depende de ordem gulosa: relaxa **todas** as arestas em rodadas.

\`\`\`python
dist = [float("inf")] * n
dist[origem] = 0
for _ in range(n - 1):                 # caminho mínimo simples tem <= n - 1 arestas
    for u, v, w in arestas:
        if dist[u] + w < dist[v]:
            dist[v] = dist[u] + w
\`\`\`

- Depois da rodada \`i\`, \`dist\` está certa para todo caminho de **até \`i\` arestas**. Por isso \`n − 1\` rodadas bastam.
- **Rodada extra:** se alguma aresta ainda relaxa, existe um **ciclo negativo** alcançável — o "caminho mínimo" é \`-∞\`.
- **Parada antecipada:** se uma rodada não mudar nada, as seguintes também não mudarão. Na prática, costuma parar muito antes de \`n − 1\`.

> [!sabia] Ciclo negativo tem aplicação de verdade: em **arbitragem de câmbio**, use peso \`-log(taxa)\`; um ciclo negativo é uma volta de trocas que termina com mais dinheiro do que começou. E o **algoritmo de Johnson** (1977) usa um Bellman-Ford para achar um potencial \`h\` e troca cada peso por \`w + h(u) − h(v)\`, que é sempre \`≥ 0\` e preserva os caminhos mínimos — daí roda um Dijkstra por vértice.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Última ferramenta: o A* (A-estrela). Quando você quer **um destino específico**, o Dijkstra desperdiça esforço explorando em todas as direções.',
          'O A* dá uma "bússola" para o heap: além do custo até aqui, ele soma uma **estimativa** do que falta.',
        ],
        board: {
          title: 'A* em linhas gerais',
          md: `**Prioridade no heap:** \`f(v) = g(v) + h(v)\`
- \`g(v)\`: custo real da origem até \`v\` (o \`dist\` do Dijkstra);
- \`h(v)\`: **heurística**, uma estimativa do custo de \`v\` até o alvo.

\`\`\`python
def a_estrela(inicio, alvo, vizinhos, h):
    g = {inicio: 0}
    heap = [(h(inicio), inicio)]
    while heap:
        f, u = heapq.heappop(heap)
        if u == alvo:
            return g[u]
        if f > g[u] + h(u):                   # obsoleta
            continue
        for v, peso in vizinhos(u):
            ng = g[u] + peso
            if ng < g.get(v, float("inf")):
                g[v] = ng
                heapq.heappush(heap, (ng + h(v), v))
    return -1
\`\`\`

| Heurística \`h\` | Resultado |
|---|---|
| \`h = 0\` | vira o **Dijkstra** (explora em "círculos") |
| **admissível** (nunca superestima) | caminho **ótimo**, explorando menos (uma "elipse" rumo ao alvo) |
| **consistente**: \`h(u) ≤ w(u, v) + h(v)\` | ótimo **e** cada vértice é finalizado uma vez só |
| superestima (ex.: \`1.5 × h\`) | mais rápido, mas **pode perder o ótimo** — aceitável em jogos |

Heurísticas típicas: **Manhattan** \`|Δx| + |Δy|\` numa grade de 4 direções; distância em **linha reta** num mapa.

> [!sabia] O A* com heurística consistente é **exatamente** um Dijkstra sobre os pesos reduzidos \`w + h(v) − h(u)\` (o mesmo truque de potencial do Johnson). E os apps de rota não rodam nem um nem outro "puros" num mapa continental: usam **contraction hierarchies** (Geisberger e outros, 2008), que pré-processam a malha viária criando **atalhos** entre vértices importantes — as consultas caem de segundos para milissegundos. O OSRM e o GraphHopper, por exemplo, usam essa técnica.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Entradas obsoletas, network delay, pesos negativos e a escolha do algoritmo.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'lc-dij-q1',
        concept: 'Entradas obsoletas',
        say: 'Começando pelo detalhe que mais derruba candidato em Dijkstra com `heapq`.',
        prompt: 'No meio de um Dijkstra com `heapq`, o heap ainda contém a entrada `(9, "C")`, mas `dist["C"]` já foi melhorado para `4` (e `(4, "C")` também foi empurrado). O que o código deve fazer quando `(9, "C")` **sair** do heap?',
        options: [
          { text: 'Descartá-la: `if d > dist[u]: continue`.', correct: true, why: 'É a *lazy deletion*: a entrada ficou obsoleta quando achamos um caminho melhor. Descartar custa `O(1)` e evita varrer os vizinhos de novo.' },
          { text: 'Nada: o certo seria ter removido `(9, "C")` do heap com `heap.remove(...)` + `heapify` no momento em que a distância melhorou.', why: 'Remover do meio de uma lista-heap custa `O(n)` (achar o item e refazer o heap). Justamente para evitar isso usamos entradas obsoletas.' },
          { text: 'Processá-la normalmente, relaxando os vizinhos de C com `d = 9`.', why: 'Não erra o resultado (com pesos não negativos, `9 + w` nunca melhora ninguém), mas repete trabalho: cada entrada obsoleta varre a lista de vizinhos de novo — em grafo denso, isso multiplica o custo.' },
          { text: 'Atualizar `dist["C"] = 9`, porque ela é a entrada mais recente a sair do heap.', why: 'Isso **piora** uma distância já correta: `4` é menor e já foi processado. O heap sai em ordem crescente, então a entrada de 9 é necessariamente a velha.' },
        ],
        explanation: 'O `heapq` não tem *decrease-key*. A saída padrão é empurrar `(nova_dist, v)` e deixar a entrada antiga no heap; quando ela sair, `d > dist[u]` a denuncia. O heap chega a ter até `E` entradas, o que ainda dá `O((V + E) log V)`. Uma alternativa equivalente é um `set` de finalizados: `if u in feitos: continue`.',
      },
      {
        type: 'code',
        id: 'lc-dij-q2',
        concept: 'Dijkstra',
        title: 'Network Delay Time',
        say: 'LeetCode 743. Um sinal sai de um servidor e se espalha pela rede. Quanto tempo até **todo mundo** receber?',
        prompt: `Há \`n\` nós numerados de **\`1\` a \`n\`**. Cada item \`[u, v, w]\` de \`times\` é uma aresta **dirigida**: um sinal leva \`w\` unidades de tempo de \`u\` até \`v\` (\`w >= 0\`).

Implemente \`network_delay_time(times, n, k)\`: um sinal parte do nó \`k\`. Devolva o tempo mínimo para que **todos** os \`n\` nós o recebam, ou \`-1\` se algum nó nunca receber.

- Pode haver arestas paralelas (com pesos diferentes), laços e pesos \`0\`.
- Dica de modelagem: o tempo total é a **maior** das distâncias mínimas a partir de \`k\`.
- Objetivo: **\`O((V + E) log V)\`**. O teste de desempenho tem 1.500 nós e ~6.000 arestas.`,
        starter: `import heapq


def network_delay_time(times, n, k):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'network_delay_time([[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2)', expected: '2' },
          { name: 'nó inalcançável', expr: 'network_delay_time([[1, 2, 1]], 2, 2)', expected: '-1' },
          { name: 'um nó só', expr: 'network_delay_time([], 1, 1)', expected: '0' },
          { name: 'caminho indireto mais barato', expr: 'network_delay_time([[1, 2, 5], [1, 3, 1], [3, 2, 1]], 3, 1)', expected: '2' },
          { name: 'arestas paralelas e peso zero', expr: 'network_delay_time([[1, 2, 3], [1, 2, 1], [2, 3, 0]], 3, 1)', expected: '1' },
          { expr: 'network_delay_time([[1, 2, 1], [2, 1, 3]], 2, 2)', expected: '3', hidden: true },
          { expr: 'network_delay_time([[1, 2, 1], [2, 3, 1], [3, 4, 1], [1, 4, 10]], 4, 1)', expected: '3', hidden: true },
          { expr: 'network_delay_time([[1, 2, 1], [3, 4, 1]], 4, 1)', expected: '-1', hidden: true },
          { expr: 'network_delay_time([[1, 2, 4], [1, 3, 1], [3, 2, 2], [2, 4, 1], [3, 4, 5]], 4, 1)', expected: '4', hidden: true },
          { expr: 'network_delay_time([[1, 1, 5], [1, 2, 2]], 2, 1)', expected: '2', hidden: true },
        ],
        perfTests: [
          {
            name: '1.500 nós, ~6.000 arestas',
            setup: NDT_PERF,
            expr: 'network_delay_time(times, n, 1)',
            expected: '_esperado',
            maxMs: 60,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Dijkstra com heap — O((V + E) log V)',
        reviews: [
          {
            when: m => !m.imports.includes('heapq') && !m.imports.includes('queue') && m.calls.includes('min'),
            text: 'Escolher o próximo vértice com `min(...)` sobre todos os pendentes custa `O(V)` por passo: `O(V²)` no total. Com `heapq`, cada escolha custa `O(log V)` e o Dijkstra fica em `O((V + E) log V)`.',
            concept: 'Dijkstra',
          },
          {
            when: m => !m.imports.includes('heapq') && !m.imports.includes('queue') && !m.calls.includes('min') && m.loopDepth >= 2,
            text: 'Relaxar todas as arestas em rodadas (Bellman-Ford) ou reenfileirar vértices sem prioridade pode custar `O(V·E)`. Com pesos não negativos, o heap do Dijkstra garante que cada vértice seja resolvido uma vez.',
            concept: 'Dijkstra',
          },
          {
            when: m => m.imports.includes('queue'),
            text: '`queue.PriorityQueue` é feita para **threads**: cada `put`/`get` adquire um lock. Funciona, mas é mais lenta que o `heapq` puro — que é o esperado em entrevista.',
            concept: 'heapq vs PriorityQueue',
          },
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code) || m.calls.includes('sort'),
            text: 'Reordenar a fronteira (`sort`) ou tirar do início de uma lista (`pop(0)`) a cada passo custa `O(n)` ou mais por operação. O heap mantém a ordem **incrementalmente**, em `O(log n)`.',
            concept: 'Fila de prioridade',
          },
        ],
        hints: [
          'Monte a lista de adjacência com índices de `1` a `n`: `vizinhos = [[] for _ in range(n + 1)]` e `vizinhos[u].append((v, w))` — a aresta é **dirigida**.',
          'Dijkstra: `dist = [float("inf")] * (n + 1)`, `dist[k] = 0`, `heap = [(0, k)]`. Tire `(d, u)` com `heappop`; se `d > dist[u]`, é entrada obsoleta — pule.',
          'Relaxe cada `(v, w)`: se `d + w < dist[v]`, atualize e `heappush((d + w, v))`. No fim, `maior = max(dist[1:])` — se for infinito, devolva `-1`.',
        ],
        solution: `import heapq


def network_delay_time(times, n, k):
    vizinhos = [[] for _ in range(n + 1)]
    for u, v, w in times:
        vizinhos[u].append((v, w))
    dist = [float("inf")] * (n + 1)
    dist[k] = 0
    heap = [(0, k)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:              # entrada obsoleta: já achamos caminho melhor
            continue
        for v, w in vizinhos[u]:
            nd = d + w
            if nd < dist[v]:         # relaxamento
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    maior = max(dist[1:])            # o último a receber define o tempo total
    return maior if maior < float("inf") else -1
`,
        solutionExplanation: 'Cada aresta gera no máximo um `heappush`, então o heap tem até `E` entradas: **tempo `O((V + E) log V)`**, **espaço `O(V + E)`**. O `dist[0]` fica sem uso para os índices baterem com os nós `1..n`. Arestas paralelas e laços se resolvem sozinhos: o relaxamento só aceita melhoras. O detalhe da modelagem é a última linha: o sinal chega a todos quando chega ao **mais distante** — o `max` das distâncias mínimas; um `inf` ali denuncia nó inalcançável.',
      },
      {
        type: 'order',
        id: 'lc-dij-q3',
        concept: 'Dijkstra',
        say: 'Simulação de quadro branco: me diga em que ordem o Dijkstra **finaliza** cada vértice.',
        prompt: `Grafo dirigido, origem **S**:

\`\`\`text
S→A 7   S→B 2   B→A 3   B→C 8   A→C 1
A→D 6   C→D 2   C→E 5   D→E 1
\`\`\`

Ordene os vértices na ordem em que o Dijkstra com \`heapq\` os **finaliza** (entradas obsoletas não contam).`,
        items: ['S', 'B', 'A', 'C', 'D', 'E'],
        explanation: 'As distâncias finais são S = 0, B = 2, A = 5 (via B), C = 6 (via A), D = 8 (via C) e E = 9 (via D) — e o Dijkstra finaliza sempre em **ordem crescente de distância**. Repare nas entradas obsoletas do caminho: `(7, A)`, `(10, C)`, `(11, D)` e `(11, E)` foram empurradas antes de achar os atalhos e são descartadas quando saem.',
      },
      {
        type: 'mcq',
        id: 'lc-dij-q4',
        concept: 'Pesos negativos',
        say: 'Agora com uma aresta negativa. Faça a conta de cabeça.',
        prompt: `Arestas dirigidas: \`S→X 1\`, \`S→Y 3\`, \`Y→X -3\`, \`X→Z 2\`. Um Dijkstra que **finaliza** cada vértice ao tirá-lo do heap (e nunca o reabre) roda a partir de \`S\`. O que ele devolve para \`X\` e \`Z\`?`,
        options: [
          { text: '`X = 1` e `Z = 3` — mas o certo é `X = 0` e `Z = 2`.', correct: true, why: 'X sai do heap com 1 e é finalizado; Z herda o erro (3). Só depois Y sai com 3 e descobre `3 − 3 = 0` para X — tarde demais.' },
          { text: '`X = 0` e `Z = 2`: um peso negativo sozinho não atrapalha, só ciclos negativos.', why: 'Um único peso negativo já quebra a invariante gulosa: "saiu do heap = definitivo" deixa de valer. Ciclo negativo é outro problema (o mínimo nem existe).' },
          { text: 'Lança erro: o `heapq` não aceita prioridades negativas.', why: 'O `heapq` compara quaisquer valores ordenáveis, negativos inclusive. E aqui as distâncias nem ficam negativas.' },
          { text: 'Não termina: fica reabrindo X para sempre.', why: 'A versão que finaliza nunca reabre ninguém. Loop infinito aconteceria numa versão que **reabre** vértices e só se houver ciclo negativo — não é o caso.' },
        ],
        explanation: 'O Dijkstra aposta que o vértice mais próximo no heap já tem a distância definitiva, porque o resto do caminho só pode somar. Com peso negativo, um caminho que parecia caro (via Y) fica barato **depois**. Para pesos negativos, use **Bellman-Ford** (`O(V·E)`), que também detecta ciclos negativos — ou, para muitas consultas, reponderar os pesos com o potencial do algoritmo de Johnson.',
      },
      {
        type: 'code',
        id: 'lc-dij-q5',
        concept: 'Bellman-Ford',
        title: 'Bellman-Ford com detecção de ciclo negativo',
        say: 'Agora o Bellman-Ford de verdade — com parada antecipada e detecção de ciclo negativo.',
        prompt: `Implemente \`bellman_ford(n, edges, origem)\`. O grafo é **dirigido**, com vértices \`0..n-1\`, e cada aresta é \`[u, v, w]\` — **\`w\` pode ser negativo**.

- Devolva a lista \`dist\` com a menor distância de \`origem\` até cada vértice, usando \`float("inf")\` para os inalcançáveis.
- Se existir um **ciclo negativo alcançável a partir de \`origem\`**, devolva \`None\`.
- Um ciclo negativo que a origem **não alcança** não afeta a resposta.
- Objetivo: **\`O(V·E)\`** no pior caso — mas **pare assim que uma rodada não mudar nada**. O teste de desempenho tem 800 vértices e 4.000 arestas, e converge em poucas rodadas.`,
        starter: `def bellman_ford(n, edges, origem):
    pass
`,
        tests: [
          { name: 'exemplo com peso negativo', expr: 'bellman_ford(4, [[0, 1, 4], [0, 2, 5], [2, 1, -3], [1, 3, 2]], 0)', expected: '[0, 2, 5, 4]' },
          { name: 'vértice inalcançável', expr: 'bellman_ford(3, [[0, 1, 2]], 0)', expected: '[0, 2, float("inf")]' },
          { name: 'ciclo negativo alcançável', expr: 'bellman_ford(3, [[0, 1, 1], [1, 2, -2], [2, 1, 1]], 0)', expected: 'None' },
          { name: 'ciclo negativo que a origem não alcança', expr: 'bellman_ford(4, [[0, 1, 3], [2, 3, -5], [3, 2, 1]], 0)', expected: '[0, 3, float("inf"), float("inf")]' },
          { name: 'um vértice só', expr: 'bellman_ford(1, [], 0)', expected: '[0]' },
          { expr: 'bellman_ford(2, [[0, 0, -1], [0, 1, 2]], 0)', expected: 'None', hidden: true },
          { expr: 'bellman_ford(4, [[0, 1, 2], [0, 2, 5], [2, 1, -4], [1, 3, 1]], 0)', expected: '[0, 1, 5, 2]', hidden: true },
          { expr: 'bellman_ford(3, [[0, 1, 5], [0, 1, -1], [1, 2, -1]], 0)', expected: '[0, -1, -2]', hidden: true },
          { expr: 'bellman_ford(3, [[1, 0, -2], [1, 2, 4], [0, 2, 1]], 1)', expected: '[-2, 0, -1]', hidden: true },
          { expr: 'bellman_ford(3, [[0, 1, 1], [1, 2, -1], [2, 1, 1]], 0)', expected: '[0, 1, 0]', hidden: true },
          { expr: 'bellman_ford(5, [[3, 4, -2], [4, 3, -2], [0, 1, 1]], 0)', expected: '[0, 1, float("inf"), float("inf"), float("inf")]', hidden: true },
        ],
        perfTests: [
          {
            name: '800 vértices, 4.000 arestas (com pesos negativos)',
            setup: BF_PERF,
            expr: 'bellman_ford(n, arestas, origem)',
            expected: '_esperado',
            maxMs: 40,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Bellman-Ford com parada antecipada',
        reviews: [
          {
            when: m => m.imports.includes('heapq') || m.imports.includes('queue'),
            text: 'Heap é estratégia de Dijkstra, que depende de "saiu do heap = definitivo" — e isso não vale com pesos negativos. Reabrindo vértices, o custo pode explodir e, com ciclo negativo, não há garantia de parar. Rodadas de relaxamento (Bellman-Ford) não dependem de ordem.',
            concept: 'Pesos negativos',
          },
          {
            when: m => m.recursion,
            text: 'Explorar caminhos recursivamente é exponencial — e com ciclos pode não terminar. O Bellman-Ford resolve em `O(V·E)` com rodadas de relaxamento.',
            concept: 'Bellman-Ford',
          },
        ],
        hints: [
          'Comece com `dist = [float("inf")] * n` e `dist[origem] = 0`. Uma **rodada** percorre todas as arestas `u, v, w` e relaxa: se `dist[u] + w < dist[v]`, atualize.',
          'Faça no máximo `n - 1` rodadas (um caminho mínimo simples tem no máximo `n - 1` arestas) e use uma flag `mudou`: se a rodada não mudou nada, pode devolver `dist` na hora.',
          'Se as `n - 1` rodadas acabarem, faça mais uma passada: se alguma aresta ainda relaxa, há ciclo negativo alcançável → `None`. Com `float("inf")`, `inf + w` continua `inf`, então vértices inalcançáveis nunca "melhoram" (um sentinela como `10**18` quebraria isso).',
        ],
        solution: `def bellman_ford(n, edges, origem):
    inf = float("inf")
    dist = [inf] * n
    dist[origem] = 0
    for _ in range(n - 1):
        mudou = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:       # inf + w continua inf: inalcançável não relaxa
                dist[v] = dist[u] + w
                mudou = True
        if not mudou:                       # convergiu: as próximas rodadas não mudariam nada
            return dist
    for u, v, w in edges:                   # rodada extra: ainda melhora? ciclo negativo
        if dist[u] + w < dist[v]:
            return None
    return dist
`,
        solutionExplanation: 'Pior caso: `n − 1` rodadas de `E` relaxamentos, **tempo `O(V·E)`**, **espaço `O(V)`**. A parada antecipada é segura: se uma rodada inteira não mudou nada, `dist` já é um ponto fixo — e, nesse caso, também não existe ciclo negativo alcançável (ele sempre permitiria mais uma melhora). O `float("inf")` resolve de graça o ciclo negativo **inalcançável**: `inf + w` nunca fica menor que `inf`. Variante útil: com um limite de `k` rodadas (copiando `dist` a cada rodada), você obtém "o caminho mais barato com no máximo `k` arestas" — o LeetCode 787, *Cheapest Flights Within K Stops*.',
      },
      {
        type: 'match',
        id: 'lc-dij-q6',
        concept: 'Escolha do algoritmo de caminho mínimo',
        say: 'Bate-bola final: qual algoritmo para cada cenário?',
        prompt: 'Associe cada cenário ao algoritmo mais adequado.',
        pairs: [
          { left: 'Labirinto em grade em que todo passo custa 1', right: 'BFS' },
          { left: 'Grade em que seguir reto custa 0 e virar custa 1', right: '0-1 BFS com `deque`' },
          { left: 'Rotas de entrega com tempos positivos em cada rua', right: 'Dijkstra com `heapq`' },
          { left: 'Taxas de câmbio: existe uma volta de trocas que dá lucro?', right: 'Bellman-Ford (ciclo negativo)' },
          { left: 'Personagem de jogo indo até um alvo conhecido, com a distância em linha reta como estimativa', right: 'A* com heurística admissível' },
          { left: 'Tarefas com durações e dependências, sem ciclos', right: 'Ordem topológica + relaxar em ordem' },
        ],
        explanation: 'A pergunta guia são os **pesos** e o **objetivo**: todos iguais → BFS; só 0 e 1 → 0-1 BFS; não negativos → Dijkstra; negativos (ou detectar ciclo negativo) → Bellman-Ford; um alvo com boa estimativa → A*; DAG → ordem topológica, que funciona até com pesos negativos e resolve em `O(V + E)`.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Fechamos caminhos mínimos! **Dijkstra** com `heapq` e entradas obsoletas, **Bellman-Ford** quando há peso negativo, e o A* quando existe um alvo e uma boa estimativa.',
          { text: 'Em entrevista, diga a hipótese em voz alta: "pesos não negativos, então Dijkstra". Mostra que você sabe onde o algoritmo quebra. Até a próxima!', mood: 'neutral' },
        ],
        board: null,
      },
    ],
  });
})();
