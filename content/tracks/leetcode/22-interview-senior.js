(function () {
  // Utilitários dos testes de desempenho (rodam depois do código do jogador).
  const SCHED_PERF = `import random as _r

tarefas = ["A"] * 1500 + ["B"] * 1500 + list("CDEFGHIJKLMNOPQRSTUVWXYZ") * 40
_r.Random(3).shuffle(tarefas)
`;
  const LADDER_PERF = `import random as _r
from collections import deque as _dq


def _escada_ref(inicio, fim, lista):
    livres = set(lista)
    if fim not in livres:
        return 0
    livres.discard(inicio)
    fila = _dq([(inicio, 1)])
    while fila:
        p, d = fila.popleft()
        if p == fim:
            return d
        for i in range(len(p)):
            for c in "abcdefghijklmnopqrstuvwxyz":
                q = p[:i] + c + p[i + 1:]
                if q in livres:
                    livres.remove(q)
                    fila.append((q, d + 1))
    return 0


_g = _r.Random(11)
_alfa = "abcdefghijklmno"


def _palavra():
    return "".join(_g.choice(_alfa) for _ in range(5))


# uma trilha longa de palavras a uma letra de distância + ruído aleatório
inicio = _palavra()
_trilha = [inicio]
while len(_trilha) < 400:
    _i = _g.randrange(5)
    _nova = _trilha[-1][:_i] + _g.choice(_alfa) + _trilha[-1][_i + 1:]
    if _nova not in _trilha:
        _trilha.append(_nova)
_palavras = set(_trilha[1:])
while len(_palavras) < 1200:
    _palavras.add(_palavra())
fim = _trilha[-1]
lista = sorted(_palavras)
_g.shuffle(lista)
_esperado = _escada_ref(inicio, fim, lista)
`;

  Game.registerModule('leetcode', {
    id: 'interview-senior',
    title: 'Entrevista Sênior',
    kind: 'interview',
    level: 3,
    order: 92,
    unit: 'entrevistas',
    summary: 'Dois problemas difíceis — Task Scheduler (cooldown) e Word Ladder (BFS num grafo implícito) — com follow-ups de escala, BFS bidirecional e comunicação de trade-offs.',
    concepts: ['Contagem e argumento de limite', 'Simulação por eventos', 'Grafo implícito', 'BFS bidirecional', 'Comunicação de trade-offs'],
    takeaways: [
      'Task Scheduler: só as **frequências** importam. `max(len(tasks), (fmax − 1)·(n + 1) + empatados)` resolve em `O(N)`, sem simular o tempo.',
      'Quando a resposta pode ser enorme (cooldown longo), simular unidade por unidade vira o gargalo: **conte** ou **salte o tempo** (heap de prontos + fila de espera por horário).',
      'Word Ladder é **BFS num grafo implícito**: gere os vizinhos trocando uma letra e consultando um `set` (`O(N·L·26)`), em vez de comparar todos os pares (`O(N²·L)`).',
      '**BFS bidirecional** troca ~`b^d` por ~`2·b^(d/2)` vértices explorados: expanda sempre a fronteira **menor**.',
      'Em sênior, o código é metade: esclareça requisitos, diga o custo de cada opção e proponha uma evolução em fases.',
    ],
    glossary: [
      { term: 'Grafo implícito', aliases: ['grafos implícitos', 'implicit graph'], definition: 'Grafo que não é montado na memória: os vizinhos de cada vértice são **gerados sob demanda** por uma regra (trocar uma letra, mover numa grade, girar um cadeado). Evita materializar arestas que talvez nem sejam visitadas.' },
      { term: 'BFS bidirecional', aliases: ['busca bidirecional', 'bidirectional BFS', 'bidirectional search', 'meet in the middle'], definition: 'Duas BFS, uma a partir de cada ponta, que param quando as fronteiras se encontram. Cada lado vai só até ~metade da distância: ~`2·b^(d/2)` vértices em vez de ~`b^d`.' },
      { term: 'Work-conserving', aliases: ['work conserving', 'escalonador work-conserving'], definition: 'Propriedade de um escalonador que **nunca fica ocioso** quando há trabalho pronto para rodar. Termo comum em sistemas operacionais e redes; não basta para ser ótimo — importa também **qual** tarefa escolher.' },
      { term: 'Doublets', aliases: ['word ladder', 'escada de palavras', 'escadas de palavras'], definition: 'Jogo publicado por Lewis Carroll em 1879: transformar uma palavra em outra trocando uma letra por vez, sempre passando por palavras válidas (HEAD → HEAL → TEAL → TELL → TALL → TAIL). É o LeetCode 127.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Oi de novo! Esta é a entrevista para **sênior** — o último degrau da trilha.',
          'São **dois problemas**, mais difíceis que os anteriores. Mas o que mais pesa aqui são os **follow-ups**: escala, variações e como você comunica decisões.',
          { text: 'Pense em voz alta, faça perguntas antes de codar e diga o custo de cada escolha. Vamos lá!', mood: 'happy' },
        ],
        board: {
          title: '🎤 Roteiro da entrevista',
          md: `1. **Task Scheduler** (LeetCode 621) — contagem + argumento de limite inferior
2. **Word Ladder** (LeetCode 127) — BFS num grafo implícito

| O que eu avalio em sênior | Como aparece |
|---|---|
| Resolver | chega na complexidade ótima e **justifica** por que é ótima |
| Código | limpo, com os casos de borda tratados **antes** de eu perguntar |
| Escala | sabe o que quebra com 1.000× mais dados ou tráfego |
| Comunicação | esclarece requisitos e expõe trade-offs como opções, não como dogma |

> [!dica] Antes de codar, faça **2 ou 3 perguntas de requisito** (tamanho da entrada, o que devolver, casos degenerados). Em sênior, pular essa etapa já conta contra.`,
        },
      },
      {
        type: 'section',
        title: 'Problema 1',
        subtitle: 'Task Scheduler (LeetCode 621)',
        icon: '⏱️',
        text: 'Primeiro problema: agendar tarefas com cooldown.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Uma CPU executa tarefas identificadas por letras. Entre duas execuções da **mesma** tarefa, ela precisa esperar pelo menos `n` unidades de tempo.',
          'Cada unidade de tempo roda uma tarefa ou fica **ociosa**. Qual é o **menor tempo total** para rodar tudo?',
        ],
        board: {
          title: 'Task Scheduler',
          md: `\`\`\`text
tasks = ["A", "A", "A", "B", "B", "B"]    n = 2

A B _ A B _ A B      ->  8 unidades   (_ = ocioso)

com n = 0:  A A A B B B  ->  6
\`\`\`

- A **ordem** de execução é livre.
- Entre duas execuções da mesma letra, pelo menos \`n\` unidades de distância.
- Devolva só o **tempo total**, não a agenda.

**Perguntas que eu espero ouvir** (e minhas respostas):

| Pergunta | Resposta |
|---|---|
| A lista pode ser vazia? E \`n = 0\`? | Pode. Vazia dá \`0\`. |
| Quantos tipos de tarefa? | Letras de \`A\` a \`Z\`. |
| Quão grandes são \`n\` e a lista? | Milhares de tarefas, cooldown de centenas: a resposta passa de **1 milhão** de unidades. |`,
        },
      },
      {
        type: 'mcq',
        id: 'lc-sen-q1',
        concept: 'Contagem e argumento de limite',
        say: 'Antes do código: qual abordagem você defende?',
        prompt: 'Qual abordagem dá a resposta **correta** em **`O(N)`** (N = número de tarefas), **independentemente** do tamanho de `n`?',
        options: [
          { text: 'Contar as frequências: a tarefa mais frequente impõe "quadros" de `n + 1` posições; o resultado sai do número de quadros, de quantas tarefas empatam no máximo e do total de tarefas.', correct: true, why: 'Só as frequências importam. O limite inferior vem da tarefa mais frequente, e sempre dá para preencher os quadros sem violar o cooldown — então a conta é exata e custa `O(N)`.' },
          { text: 'Simular unidade por unidade, sempre escolhendo a tarefa disponível com mais repetições restantes.', why: 'Dá a resposta certa, mas o custo cresce com a **resposta**, não com N: com cooldown de centenas, são milhões de unidades simuladas.' },
          { text: 'Simular escolhendo sempre a tarefa disponível com **menos** repetições restantes, para liberar tipos rápido.', why: 'Errado: deixa a mais frequente para o fim, quando ela só roda com ociosos entre si. `AAAB`, `n = 1`: `B A _ A _ A` (6) em vez de `A B A _ A` (5).' },
          { text: 'Ordenar as tarefas e executar em sequência, inserindo `n` ociosos entre letras iguais.', why: 'Errado: não intercala tipos diferentes. `AAABBB`, `n = 2` viraria `A _ _ A _ _ A B _ _ B _ _ B` (14) em vez de 8.' },
        ],
        explanation: 'É um problema de **contagem com argumento de limite**: a tarefa mais frequente (`fmax` vezes) precisa de `fmax − 1` intervalos de `n` entre suas execuções, e as outras tarefas só **preenchem** esses buracos. Nenhuma agenda consegue ser menor que esse limite, e a construção por quadros sempre o atinge — por isso dá para responder sem simular.',
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Isso. Vou desenhar os quadros para você ver de onde sai a conta.',
          'Repare no caso em que **não sobra ociosidade**: aí a resposta é simplesmente o número de tarefas.',
        ],
        board: {
          title: 'Quadros de n + 1',
          md: `\`\`\`text
tasks: A×3, B×3, C×1      n = 2      fmax = 3  (A e B empatam)

 quadro 1    quadro 2    final
[ A  B  C ] [ A  B  _ ] [ A  B ]
 └─ n+1 ─┘   └─ n+1 ─┘   └ só quem empata com fmax

(fmax - 1) × (n + 1) + empatados  =  2 × 3 + 2  =  8
\`\`\`

- **Limite inferior:** a letra mais frequente precisa de \`fmax − 1\` quadros completos e ainda aparece no fim; cada letra empatada com ela também aparece no quadro final.
- **Sem ociosidade:** se há tarefas de sobra para encher os quadros, eles apenas **alargam** — ninguém precisa esperar. Aí o limite é \`len(tasks)\`.
- Resposta: o **maior** dos dois limites.

> [!sabia] Em sistemas operacionais e redes, um escalonador que nunca fica ocioso havendo trabalho pronto se chama **work-conserving**. Existe agenda ótima work-conserving para este problema — mas só isso não basta: no exemplo \`AAAB\`, \`n = 1\`, a agenda \`B A _ A _ A\` nunca ficou ociosa com tarefa pronta e mesmo assim perdeu. O que importa é **qual** tarefa escolher: a com mais repetições restantes.`,
        },
      },
      {
        type: 'code',
        id: 'lc-sen-q2',
        concept: 'Contagem e argumento de limite',
        title: 'least_interval',
        say: 'Pode codar. Pense nos empates, no `n = 0` e no caso sem ociosidade.',
        prompt: `Implemente \`least_interval(tasks, n)\`: \`tasks\` é uma lista de letras maiúsculas e \`n >= 0\` é o cooldown entre duas execuções da mesma letra. Devolva o **menor tempo total** para executar todas as tarefas.

- \`tasks\` pode ser vazia (resposta \`0\`).
- Objetivo: **\`O(N)\`**. O teste de desempenho tem cooldown longo e a resposta passa de 750 mil unidades: simular unidade por unidade, varrendo as tarefas a cada instante, não passa.`,
        starter: `from collections import Counter


def least_interval(tasks, n):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'least_interval(["A", "A", "A", "B", "B", "B"], 2)', expected: '8' },
          { name: 'n = 0', expr: 'least_interval(["A", "A", "A", "B", "B", "B"], 0)', expected: '6' },
          { name: 'sem ociosidade', expr: 'least_interval(["A", "A", "A", "B", "C", "D", "E", "F", "G"], 2)', expected: '9' },
          { name: 'uma tarefa só', expr: 'least_interval(["A"], 5)', expected: '1' },
          { name: 'três empatadas no máximo', expr: 'least_interval(["A", "A", "B", "B", "C", "C"], 3)', expected: '7' },
          { expr: 'least_interval([], 3)', expected: '0', hidden: true },
          { expr: 'least_interval(["A"] * 4, 3)', expected: '13', hidden: true },
          { expr: 'least_interval(list("AAABBBCCCDDE"), 2)', expected: '12', hidden: true },
          { expr: 'least_interval(["A", "B", "A"], 1)', expected: '3', hidden: true },
          { expr: 'least_interval(list("AAAAAABCDEFG"), 2)', expected: '16', hidden: true },
          { expr: 'least_interval(list("AAAB"), 1)', expected: '5', hidden: true },
        ],
        perfTests: [
          {
            name: '3.960 tarefas, cooldown 500',
            setup: SCHED_PERF,
            expr: 'least_interval(tarefas, 500)',
            expected: '751001',
            maxMs: 60,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'Contagem — O(N) sem simular o tempo',
        reviews: [
          {
            when: m => m.loopDepth >= 2 && !m.imports.includes('heapq'),
            text: 'Simular instante a instante e varrer as tarefas em cada um custa `O(resposta × tipos)` — e a resposta cresce com `n`. Contando frequências e quadros, a conta sai em `O(N)`.',
            concept: 'Contagem e argumento de limite',
          },
          {
            when: (m, code) => /["'](idle|ocioso|_)["']/.test(code),
            text: 'Montar a agenda inteira, com cada ocioso, gasta tempo e memória proporcionais à **resposta**. Quando só o tempo total é pedido, **conte** em vez de construir.',
            concept: 'Contagem e argumento de limite',
          },
        ],
        hints: [
          'Comece contando: `Counter(tasks)`. Os nomes das tarefas não importam, só as **frequências**.',
          'Seja `fmax` a maior frequência. A letra mais frequente precisa de `fmax - 1` quadros de `n + 1` posições, mais o quadro final — onde entram só as letras **empatadas** com `fmax`.',
          'Limite dos quadros: `(fmax - 1) * (n + 1) + empatados`. Mas se houver tarefas de sobra, não existe ociosidade: devolva `max(len(tasks), limite)`. E trate a lista vazia antes de chamar `max` nas frequências.',
        ],
        solution: `from collections import Counter


def least_interval(tasks, n):
    if not tasks:
        return 0
    frequencias = Counter(tasks).values()
    fmax = max(frequencias)
    empatados = sum(1 for f in frequencias if f == fmax)
    quadros = (fmax - 1) * (n + 1) + empatados   # limite imposto pela mais frequente
    return max(len(tasks), quadros)              # sem ociosidade, o total é len(tasks)
`,
        solutionExplanation: 'Contar custa `O(N)`; o resto é `O(k)`, com `k ≤ 26` tipos: **tempo `O(N)`**, **espaço `O(k)`**. A fórmula é o maior de dois limites inferiores — a letra mais frequente e o próprio número de tarefas — e a construção por quadros (preenchendo em ordem decrescente de frequência) sempre atinge esse limite. Se o entrevistador pedir a **agenda** ou mudar as regras (prioridades, tarefas chegando com o tempo), a fórmula não serve mais: aí vale um heap de prontos (por repetições restantes) com uma fila de espera ordenada por "quando fica livre", **saltando** o relógio para o próximo evento — `O(N log k)`, sem simular cada ocioso.',
      },
      {
        type: 'open',
        id: 'lc-sen-q3',
        concept: 'Simulação por eventos',
        say: 'Follow-up de escala. Aqui eu quero ouvir você pensar como quem vai operar isso.',
        prompt: 'Agora é um agendador **de verdade**: não existe lista pronta — tarefas chegam o tempo todo —, cada tipo é um cliente que precisa de cooldown entre execuções, e vários servidores processam em paralelo. O que muda na sua solução, e o que você perguntaria antes de desenhar?',
        minWords: 25,
        rubric: [
          { label: 'Troca a fórmula por uma **simulação por eventos**: heap de prontos + fila de espera ordenada por "quando fica livre"', keywords: ['heap', 'fila de prioridade', 'priority queue', 'heapq', 'quando fica livre', 'fica disponivel', 'timestamp', 'por evento', 'eventos', 'proximo horario', 'fila de espera'], concept: 'Simulação por eventos', why: 'Com chegadas contínuas não há frequências para contar: o agendador decide a cada evento quem está pronto e quem ainda espera o cooldown.' },
          { label: 'Reconhece que a fórmula só vale **offline**; com chegadas contínuas o problema vira **online/incremental**', keywords: ['online', 'offline', 'stream', 'fluxo', 'incremental', 'tempo real', 'a formula nao', 'formula so', 'formula deixa'], concept: 'Algoritmos online', why: 'A fórmula precisa conhecer todas as tarefas de antemão. Um algoritmo online decide sem ver o futuro.' },
          { label: 'Distribui entre servidores sem violar o cooldown: **particionar** por cliente (hash) ou coordenar com lock/lease', keywords: ['particion', 'shard', 'hash', 'lock', 'lease', 'coorden', 'afinidade', 'dono', 'consistent'], concept: 'Particionamento', why: 'Se dois servidores rodarem o mesmo cliente ao mesmo tempo, o cooldown é violado. Particionar por cliente mantém a regra local; o preço é o balanceamento.' },
          { label: 'Esclarece requisitos e riscos: prioridades, **justiça** entre clientes (starvation), SLA', keywords: ['prioridade', 'justica', 'justo', 'fairness', 'starvation', 'inanicao', 'sla', 'esclarec', 'pergunt', 'requisito'], concept: 'Comunicação em entrevista', why: '"Mais repetições primeiro" pode deixar clientes pequenos esperando para sempre. Em sênior, levantar isso antes de desenhar é parte da resposta.' },
        ],
        modelAnswer: `Primeiro eu **perguntaria** os requisitos: existe **prioridade** entre clientes? Há SLA de espera? Preciso garantir **justiça**, para que um cliente pequeno não sofra *starvation* atrás dos grandes?

A fórmula deixa de servir: ela é **offline** — precisa conhecer todas as tarefas antes. Com chegadas contínuas, o problema é **online/incremental**, então eu faria uma **simulação por eventos**: um **heap** de clientes prontos (ordenado pela prioridade escolhida) e uma **fila de espera** ordenada por "quando fica livre" (o timestamp de fim do cooldown). A cada evento — tarefa chegou, servidor liberou, cooldown venceu — movo quem ficou livre para o heap de prontos e despacho.

Com vários servidores, o risco é dois rodarem o mesmo cliente dentro do cooldown. Eu **particionaria** por hash do cliente (cada cliente tem um dono, então o cooldown é verificado localmente) e rebalancearia com consistent hashing; a alternativa é coordenar com um **lock/lease** por cliente num armazenamento central, que é mais flexível mas adiciona latência e um ponto de contenção. Eu apresentaria as duas opções com esse trade-off.`,
      },
      {
        type: 'section',
        title: 'Problema 2',
        subtitle: 'Word Ladder (LeetCode 127)',
        icon: '🪜',
        text: 'Muito bem. Segundo problema: palavras, e um grafo que ninguém te entrega pronto.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Você recebe uma palavra inicial, uma final e um dicionário. A cada passo, troque **exatamente uma letra**, e toda palavra intermediária precisa estar no dicionário.',
          'Qual é o **menor número de palavras** na sequência, contando a inicial e a final? Se não houver caminho, `0`.',
        ],
        board: {
          title: 'Word Ladder',
          md: `\`\`\`text
begin = "hit"    end = "cog"
word_list = ["hot", "dot", "dog", "lot", "log", "cog"]

hit → hot → dot → dog → cog        ->  5 palavras
\`\`\`

- A palavra inicial **não precisa** estar no dicionário; a final **precisa**.
- Todas as palavras têm o **mesmo tamanho** \`L\`, em letras minúsculas.
- Conte **palavras**, não passos (5 palavras = 4 trocas).

> [!sabia] O jogo foi inventado por **Lewis Carroll** — o autor de *Alice* — com o nome de **Doublets** e publicado na revista *Vanity Fair* em 1879; o exemplo dele era HEAD → HEAL → TEAL → TELL → TALL → TAIL. Mais de um século depois, Donald Knuth incluiu no *Stanford GraphBase* um grafo com **5.757 palavras** de cinco letras do inglês ligadas exatamente por essa regra, para estudar componentes e caminhos mínimos.`,
        },
      },
      {
        type: 'mcq',
        id: 'lc-sen-q4',
        concept: 'Grafo implícito',
        say: 'Como você modela isso?',
        prompt: 'Com `N` palavras de tamanho `L` no dicionário, qual modelagem é a mais adequada?',
        options: [
          { text: 'Grafo implícito: palavras são vértices, ligadas se diferem em uma letra. BFS a partir da inicial, gerando os vizinhos ao trocar cada posição por `a`–`z` e consultando um `set`.', correct: true, why: 'Todas as arestas valem 1 passo, então BFS dá o mínimo. Gerar vizinhos custa `O(L·26)` consultas `O(L)` por palavra — sem precisar montar o grafo antes.' },
          { text: 'Comparar todos os pares de palavras para montar a lista de adjacência e depois rodar a BFS.', why: 'Correto, mas `O(N²·L)` só para montar o grafo: com 50 mil palavras são 1,25 bilhão de comparações. Gerar vizinhos sob demanda é bem mais barato quando `N` é grande.' },
          { text: 'DFS com backtracking, explorando todas as sequências e guardando a menor.', why: 'Exponencial: o número de sequências explode. E a DFS não encontra o caminho mínimo sem explorar tudo.' },
          { text: 'Dijkstra, com o peso da aresta igual ao número de letras diferentes entre as palavras.', why: 'As regras só permitem trocar **uma** letra por vez, então toda aresta válida vale 1 — heap é custo à toa. E ligar palavras que diferem em várias letras permitiria saltos proibidos.' },
        ],
        explanation: 'É **BFS num grafo implícito**: você não recebe arestas, recebe uma **regra** para gerá-las. Como todo passo custa 1, a BFS acha o caminho mínimo. Duas formas de gerar vizinhos: trocar cada posição por `a`–`z` e consultar um `set` (`O(L·26)` candidatos por palavra) ou pré-indexar **padrões** — `h*t` → `["hot", "hit", "hat"]` —, que agrupa as palavras vizinhas e evita os candidatos inexistentes.',
      },
      {
        type: 'code',
        id: 'lc-sen-q5',
        concept: 'Grafo implícito',
        title: 'ladder_length',
        say: 'Pode codar. Lembre de marcar as palavras como visitadas **ao enfileirar**.',
        prompt: `Implemente \`ladder_length(begin_word, end_word, word_list)\`: devolva o **número de palavras** da menor sequência de \`begin_word\` até \`end_word\` em que cada passo troca **exatamente uma letra** e toda palavra depois da inicial está em \`word_list\`. Devolva \`0\` se não houver sequência.

- Todas as palavras têm o mesmo tamanho, em letras minúsculas; \`begin_word != end_word\`.
- \`begin_word\` pode ou não estar em \`word_list\`; \`word_list\` pode ter repetidas.
- Objetivo: **\`O(N·L·26)\`** consultas a um \`set\`. O teste de desempenho tem 1.200 palavras.`,
        starter: `from collections import deque


def ladder_length(begin_word, end_word, word_list):
    pass
`,
        tests: [
          { name: 'exemplo', expr: 'ladder_length("hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"])', expected: '5' },
          { name: 'final fora do dicionário', expr: 'ladder_length("hit", "cog", ["hot", "dot", "dog", "lot", "log"])', expected: '0' },
          { name: 'um passo', expr: 'ladder_length("a", "c", ["a", "b", "c"])', expected: '2' },
          { name: 'sem caminho', expr: 'ladder_length("hot", "dog", ["hot", "dog"])', expected: '0' },
          { name: 'inicial no dicionário', expr: 'ladder_length("hot", "dog", ["hot", "dot", "dog"])', expected: '3' },
          { expr: 'ladder_length("hit", "hot", ["hot", "hot"])', expected: '2', hidden: true },
          { expr: 'ladder_length("abc", "xyz", ["xbc", "xyc", "xyz", "abz"])', expected: '4', hidden: true },
          { expr: 'ladder_length("red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"])', expected: '4', hidden: true },
          { expr: 'ladder_length("lost", "cost", ["most", "fist", "lost", "cost", "fish"])', expected: '2', hidden: true },
          { expr: 'ladder_length("aaaa", "bbbb", ["baaa", "bbaa", "bbba", "bbbb", "abbb", "aabb"])', expected: '5', hidden: true },
        ],
        perfTests: [
          {
            name: '1.200 palavras de 5 letras',
            setup: LADDER_PERF,
            expr: 'ladder_length(inicio, fim, lista)',
            expected: '_esperado',
            maxMs: 60,
          },
        ],
        timeoutMs: 12000,
        slowConcept: 'BFS com vizinhos gerados e set — O(N·L·26)',
        reviews: [
          {
            when: m => m.calls.includes('zip'),
            text: 'Comparar a palavra atual com **todas** as outras, letra a letra, custa `O(N·L)` por vértice: `O(N²·L)` no total. Gere os vizinhos trocando cada posição por `a`–`z` e consulte um `set` — ou indexe padrões como `h*t`.',
            concept: 'Grafo implícito',
          },
          {
            when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
            text: '`lista.pop(0)` desloca todos os elementos: `O(n)` por remoção. Para a fila da BFS, use `collections.deque` com `popleft()`.',
            concept: 'deque vs list.pop(0)',
          },
          {
            when: m => m.recursion,
            text: 'Busca recursiva em profundidade não garante a **menor** sequência sem explorar todas — e isso é exponencial. Com passos de custo 1, BFS.',
            concept: 'BFS',
          },
        ],
        hints: [
          'Transforme `word_list` num `set` (consulta `O(L)` em vez de `O(N)`). Se `end_word` não estiver lá, devolva `0` logo.',
          'BFS com `deque([(begin_word, 1)])`. Para cada palavra tirada da fila, gere os candidatos: para cada posição `i` e cada letra `c` de `a` a `z`, `palavra[:i] + c + palavra[i + 1:]`.',
          'Candidato no `set`? Remova-o do `set` **na hora** (marca ao enfileirar) e enfileire com `passos + 1`. Ao tirar `end_word` da fila, devolva os passos; fila vazia, `0`.',
        ],
        solution: `from collections import deque
from string import ascii_lowercase


def ladder_length(begin_word, end_word, word_list):
    livres = set(word_list)              # ainda não visitadas
    if end_word not in livres:
        return 0
    livres.discard(begin_word)
    fila = deque([(begin_word, 1)])
    while fila:
        palavra, passos = fila.popleft()
        if palavra == end_word:
            return passos
        for i in range(len(palavra)):
            prefixo, sufixo = palavra[:i], palavra[i + 1:]
            for c in ascii_lowercase:
                vizinha = prefixo + c + sufixo
                if vizinha in livres:
                    livres.remove(vizinha)       # marca ao ENFILEIRAR
                    fila.append((vizinha, passos + 1))
    return 0
`,
        solutionExplanation: 'Cada palavra entra na fila no máximo uma vez e gera `26·L` candidatos, cada um custando `O(L)` para montar e consultar: **tempo `O(N·L²·26)`** — normalmente escrito `O(N·L·26)` tratando `L` como pequeno —, **espaço `O(N·L)`**. O `set` `livres` faz dois papéis: dicionário e "não visitado"; remover ao enfileirar impede duplicatas na fila. Repetidas na lista somem no `set`. Com dicionários grandes e buscas longas, a **BFS bidirecional** é a próxima otimização.',
      },
      {
        type: 'mcq',
        id: 'lc-sen-q6',
        concept: 'BFS bidirecional',
        say: 'Follow-up: dá para fazer melhor que uma BFS comum?',
        prompt: 'Num dicionário grande, cada palavra tem em média **b = 50** vizinhas e a resposta está a **d = 6** passos. Por que uma **BFS bidirecional** — uma BFS de cada ponta, parando quando as fronteiras se encontram — ajuda tanto?',
        options: [
          { text: 'Cada lado só vai até ~`d/2`: são ~`2·b^(d/2)` = 250 mil vértices em vez de ~`b^d` ≈ 15,6 bilhões.', correct: true, why: 'O custo de uma BFS cresce exponencialmente com a profundidade. Cortar a profundidade pela metade dos dois lados troca `b^d` por `2·b^(d/2)`.' },
          { text: 'Porque as duas buscas rodam em paralelo, em duas threads, dividindo o tempo pela metade.', why: 'O ganho não vem de paralelismo (que daria no máximo 2×), e sim de explorar níveis bem mais rasos. As duas buscas podem até rodar intercaladas numa thread só.' },
          { text: 'Porque dispensa o conjunto de visitados.', why: 'Continua precisando de visitados em cada lado — e é justamente consultando os visitados do **outro** lado que se detecta o encontro.' },
          { text: 'Porque garante que cada palavra seja visitada uma vez só, ao contrário da BFS comum.', why: 'A BFS comum, marcando ao enfileirar, já visita cada vértice uma vez. O problema dela é **quantos** vértices visita antes de chegar.' },
        ],
        explanation: 'Detalhes que contam pontos: expanda sempre a **fronteira menor** (equilibra o custo quando um lado ramifica mais), expanda **um nível inteiro** por vez e pare quando um vizinho gerado já pertencer à fronteira do outro lado. A distância é a soma dos níveis dos dois lados + 1. A mesma ideia de "encontro no meio" (*meet in the middle*) aparece em criptoanálise e em problemas de subconjuntos.',
      },
      {
        type: 'open',
        id: 'lc-sen-q7',
        concept: 'Comunicação de trade-offs',
        say: 'Última pergunta — e é a que mais pesa para sênior.',
        prompt: 'O produto quer isso como uma **API**: dicionário com 3 milhões de palavras de vários tamanhos, milhares de consultas por segundo e latência baixa. Como você evoluiria a solução — e como apresentaria as opções para o time?',
        minWords: 30,
        rubric: [
          { label: '**Pré-processa** o dicionário: índice de padrões (`h*t` → palavras), separado por tamanho, montado offline', keywords: ['pre-process', 'preprocess', 'pre process', 'pre-comput', 'precomput', 'indice', 'indexa', 'padroes', 'wildcard', 'curinga', 'offline', 'por tamanho', 'comprimento', 'grafo pronto'], concept: 'Grafo implícito', why: 'O dicionário muda pouco e é consultado muito: vale pagar o custo uma vez e ter os vizinhos prontos em cada consulta.' },
          { label: 'Reduz o trabalho por consulta: **BFS bidirecional**, limite de profundidade ou orçamento por requisição', keywords: ['bidirecional', 'bidirectional', 'duas pontas', 'dois lados', 'meet in the middle', 'a*', 'a estrela', 'a-estrela', 'limite de profundidade', 'orcamento', 'timeout'], concept: 'BFS bidirecional', why: 'A BFS comum explora ~`b^d` vértices; a bidirecional, ~`2·b^(d/2)`. Um orçamento protege a latência nos casos patológicos.' },
          { label: 'Escala a leitura: **cache** de consultas populares, réplicas stateless com o índice em memória, particionamento', keywords: ['cache', 'memoiz', 'replica', 'stateless', 'shard', 'particion', 'horizontal'], concept: 'Escalabilidade', why: 'Consultas se repetem e o índice é só leitura: cache e réplicas escalam de forma quase linear.' },
          { label: 'Comunica como sênior: esclarece requisitos, **mede** antes e expõe **trade-offs** (memória × latência) em fases', keywords: ['trade-off', 'tradeoff', 'custo', 'medir', 'medindo', 'medicao', 'benchmark', 'profil', 'requisito', 'esclarec', 'pergunt', 'fases', 'mvp', 'iterar', 'opcoes', 'alternativa'], concept: 'Comunicação de trade-offs', why: 'Em sênior, a decisão vem com números e com o preço de cada opção — e o time escolhe sabendo o que está trocando.' },
        ],
        modelAnswer: `Começaria **esclarecendo requisitos**: qual latência alvo, se a resposta precisa ser o caminho ou só o tamanho, com que frequência o dicionário muda. Depois **mediria** a versão atual com um benchmark de consultas reais.

1. **Pré-processamento offline:** separo as palavras **por tamanho** (só palavras de mesmo comprimento se ligam) e monto um **índice de padrões** — \`h*t\` → \`[hat, hit, hot]\`. Cada consulta passa a achar vizinhos com poucas leituras de hash.
2. **Menos trabalho por consulta:** **BFS bidirecional**, expandindo a fronteira menor, e um **orçamento** (limite de vértices ou timeout) para os casos patológicos, devolvendo "sem caminho encontrado" em vez de estourar a latência.
3. **Escala:** o índice é só leitura, então replico em serviços **stateless** com tudo em memória, escalo na horizontal e ponho um **cache** para os pares mais consultados. Se não couber numa máquina, **particiono** por tamanho de palavra.

Apresentaria isso em **fases**, com o **trade-off** de cada uma: o índice custa memória (cerca de \`L\` entradas por palavra) em troca de latência; o cache ajuda muito se as consultas se repetem e quase nada se forem aleatórias. Começaria pela fase 1 + bidirecional, mediria de novo e só depois partiria para o resto.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'E terminamos! Dois problemas, dois padrões: **contagem com argumento de limite** e **BFS num grafo implícito**.',
          { text: 'Feedback de sênior: o que diferencia não é chegar no código, é **justificar** por que ele é ótimo, antecipar o que quebra em escala e apresentar opções com o preço de cada uma.', mood: 'neutral' },
          { text: 'Parabéns por completar a trilha de entrevistas! Revise os conceitos marcados e volte para buscar as 3 estrelas.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
