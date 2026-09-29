Game.registerModule('leetcode', {
  id: 'greedy-intervals',
  title: 'Guloso & Intervalos',
  kind: 'lesson',
  level: 2,
  order: 14,
  unit: 'arrays',
  summary: 'Escolha o melhor agora e nunca volte atrás: quando o guloso é ótimo (e quando engana), intervalos sem sobreposição, salas de reunião com sweep line e jump game.',
  concepts: ['Escolha gulosa', 'Interval scheduling', 'Sweep line', 'Jump game', 'Exchange argument'],
  takeaways: [
    'Guloso = decidir **localmente**, sem desfazer. Só é correto quando a escolha gulosa faz parte de **alguma** solução ótima — prove com um **exchange argument** ou derrube com um contraexemplo pequeno.',
    'Máximo de intervalos sem sobreposição: ordene pelo **fim** e pegue sempre quem termina primeiro. Ordenar pelo início ou pela duração parece razoável — e falha.',
    'Salas de reunião = **pico de sobreposição**. Sweep line: `+1` no início, `-1` no fim, com o fim processado **antes** do início no empate; ou um min-heap com os horários de término.',
    'Jump game: carregue o **alcance máximo**. Para o mínimo de saltos, cada salto é um nível de uma BFS implícita em que cada nível é um intervalo de índices — `O(n)` sem fila.',
    'Quando uma escolha boa agora pode **bloquear** uma melhor depois (troco com `{1, 3, 4}`, mochila 0/1), o guloso quebra: é caso de **programação dinâmica**.',
  ],
  glossary: [
    { term: 'Algoritmo guloso', aliases: ['algoritmos gulosos', 'guloso', 'gulosa', 'gulosos', 'escolha gulosa', 'greedy'], definition: 'Estratégia que, a cada passo, faz a escolha que parece melhor **agora** e nunca a desfaz. É rápida e simples, mas só é correta quando o problema tem a *propriedade da escolha gulosa*.' },
    { term: 'Exchange argument', aliases: ['argumento de troca', 'exchange arguments', 'argumentos de troca'], definition: 'Técnica para provar um guloso: pegue uma solução ótima qualquer e **troque** a primeira escolha dela pela escolha gulosa, mostrando que a solução continua válida e não piora.' },
    { term: 'Sweep line', aliases: ['linha de varredura', 'line sweep', 'sweep-line', 'varredura de eventos'], definition: 'Técnica que transforma objetos (intervalos, segmentos) em **eventos** ordenados — "começa em t", "termina em t" — e os percorre mantendo um estado, como uma linha imaginária varrendo o eixo.' },
    { term: 'Interval scheduling', aliases: ['escalonamento de intervalos', 'activity selection', 'seleção de atividades'], definition: 'Problema de escolher o **maior número** de intervalos sem sobreposição. O guloso ótimo ordena pelo **fim** e pega sempre o que termina primeiro: `O(n log n)`.' },
    { term: 'Matroide', aliases: ['matroides', 'matroid', 'matroids'], definition: 'Estrutura combinatória em que o guloso "ordene por peso e pegue o que couber" é ótimo para **quaisquer** pesos (teorema de Rado–Edmonds). As florestas de um grafo formam um matroide — por isso o algoritmo de Kruskal funciona.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o tema é o mais confiante dos paradigmas: o **algoritmo guloso**. Ele escolhe o que parece melhor **agora** e nunca volta atrás.',
        'Quando funciona, rende soluções curtíssimas e rápidas. Quando não funciona, erra com toda a convicção. Vamos aprender a diferença.',
      ],
      board: {
        title: 'Guloso — decidir sem se arrepender',
        md: `**Ideia:** a cada passo, faça a escolha localmente ótima e siga em frente. Sem backtracking, sem tabela de DP.

Exemplo clássico — dar troco com o **menor número de moedas**, sempre pegando a maior moeda que cabe:

\`\`\`text
moedas {1, 5, 10, 25}, troco 63:
  25 + 25 + 10 + 1 + 1 + 1     -> 6 moedas (ótimo)

moedas {1, 3, 4}, troco 6:
  guloso:  4 + 1 + 1           -> 3 moedas
  ótimo:   3 + 3               -> 2 moedas     o guloso errou!
\`\`\`

| Paradigma | Volta atrás? | Custo típico |
|---|---|---|
| Guloso | Nunca | \`O(n log n)\` (ordenar) ou \`O(n)\` |
| Programação dinâmica | Considera todas as escolhas, com memória | \`O(n · estados)\` |
| Backtracking | Sim: explora e desfaz | Exponencial |

> [!sabia] Um sistema de moedas em que o guloso sempre acerta se chama **canônico**. O do dólar (\`1, 5, 10, 25\`) é; o antigo sistema britânico, anterior à decimalização, não era: para 48 pence o guloso dá *half-crown* + *shilling* + *sixpence* (30 + 12 + 6, três moedas), mas dois *florins* (24 + 24) bastavam.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Como saber se o guloso está certo? Em entrevista, "funcionou nos exemplos" não convence ninguém.',
        'Há dois caminhos: **provar** com um argumento de troca, ou **quebrar** com um contraexemplo pequeno. Tente quebrar primeiro — costuma ser mais rápido.',
      ],
      board: {
        title: 'Provar ou quebrar',
        md: `Um guloso é correto quando o problema tem duas propriedades:

1. **Escolha gulosa:** existe uma solução ótima que começa com a escolha gulosa.
2. **Subestrutura ótima:** depois dessa escolha, o que sobra é o mesmo problema, menor.

O **exchange argument** (argumento de troca) é o jeito padrão de provar a primeira:

\`\`\`text
Seja OPT uma solução ótima qualquer e g a escolha gulosa.
Se OPT não usa g, troque a primeira escolha de OPT por g.
Mostre que a solução continua válida e não piorou.
Logo, existe uma solução ótima que começa com g.
\`\`\`

Para **quebrar**, compare o guloso com uma força bruta em milhares de entradas pequenas e aleatórias:

\`\`\`python
import random

rng = random.Random(42)
for _ in range(10_000):
    entrada = entrada_pequena(rng)      # ex.: até 6 intervalos, valores de 0 a 10
    assert guloso(entrada) == forca_bruta(entrada), entrada
\`\`\`

> [!sabia] Existe uma teoria que diz **exatamente** quando o guloso "ordene por peso e pegue o que couber" é ótimo para quaisquer pesos: quando as soluções viáveis formam um **matroide** (teorema de Rado–Edmonds). As florestas de um grafo são um matroide — é por isso que o algoritmo de Kruskal para árvore geradora mínima está certo.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora o clássico: uma sala e vários pedidos de reunião `[inicio, fim)`. Quantas reuniões, **no máximo**, cabem sem sobreposição?',
        'Três gulosos parecem razoáveis. Só um está certo: ordenar pelo **fim**.',
      ],
      board: {
        title: 'Interval scheduling — ordene pelo fim',
        md: `| Critério guloso | Contraexemplo |
|---|---|
| Começa primeiro | \`[0, 100)\` engole \`[1, 2)\`, \`[3, 4)\` e \`[5, 6)\` |
| Mais curto primeiro | \`[4, 7)\` é o menor, mas bloqueia \`[1, 5)\` e \`[6, 10)\` |
| **Termina primeiro** | nenhum — é o ótimo |

\`\`\`python
def max_sem_sobreposicao(intervalos):
    fim_atual = float("-inf")
    escolhidos = 0
    for inicio, fim in sorted(intervalos, key=lambda x: x[1]):   # pelo FIM
        if inicio >= fim_atual:      # começa quando (ou depois que) o último acabou
            escolhidos += 1
            fim_atual = fim
    return escolhidos
\`\`\`

**Por que o fim?** Quem termina primeiro deixa o **máximo de tempo livre** para o resto. Pelo argumento de troca: se uma solução ótima começa com outro intervalo, trocá-lo pelo que termina primeiro não cria conflito — ele termina ainda mais cedo.

> [!dica] Intervalos **semiabertos** \`[inicio, fim)\`: uma reunião que termina às 10h não conflita com outra que começa às 10h, daí o \`>=\`. Confirme essa convenção com o entrevistador — é a pergunta de esclarecimento mais comum em problemas de intervalo.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Mudou a pergunta: agora **todas** as reuniões vão acontecer. Quantas salas, no mínimo, a empresa precisa?',
        'A resposta é o **pico** de reuniões simultâneas. E o jeito elegante de medir picos é a **sweep line**: transformar intervalos em eventos e varrer o tempo.',
      ],
      board: {
        title: 'Salas de reunião — sweep line',
        md: `Cada reunião vira dois **eventos**: \`+1\` quando começa e \`-1\` quando termina. Ordene os eventos pelo tempo e acumule:

\`\`\`text
reuniões:  [0, 30)   [5, 10)   [15, 20)

tempo:      0     5     10     15     20     30
evento:    +1    +1     -1     +1     -1     -1
salas:      1     2      1      2      1      0       pico = 2 salas
\`\`\`

- O **pico** do acumulado é o número mínimo de salas: \`O(n log n)\` para ordenar os \`2n\` eventos, \`O(n)\` para varrer.
- Não importa **qual** reunião terminou: a sweep line só olha contagens.
- **Alternativa com heap:** ordene as reuniões pelo início e mantenha um min-heap com o término de cada sala ocupada. Se a sala que libera primeiro já está livre (\`heap[0] <= inicio\`), reaproveite-a; senão, abra outra. O tamanho final do heap é a resposta — e ele ainda diz **qual** sala cada reunião usa.

> [!atencao] O **empate** decide a resposta: com \`[1, 5)\` e \`[5, 8)\`, se o \`+1\` das 5h for processado antes do \`-1\`, você conta 2 salas quando 1 basta. Com tuplas \`(tempo, delta)\`, o \`sort()\` desempata de graça, porque \`-1 < 1\`.

> [!sabia] A **sweep line** vem da geometria computacional: Shamos e Hoey (1976) a usaram para detectar em \`O(n log n)\` se algum par de segmentos se cruza, e o algoritmo de Bentley–Ottmann (1979) lista todos os cruzamentos. A mesma receita — eventos ordenados + um estado — resolve união de retângulos, o "horizonte de prédios" (*skyline*) e agendas.`,
      },
    },
    {
      type: 'say',
      text: [
        'Último padrão: o **jump game**. `nums[i]` é o salto **máximo** a partir da posição `i`. Dá para chegar ao fim?',
        'Não precisa testar caminhos: basta carregar o **alcance máximo** até agora. Se você pisar além dele, travou.',
      ],
      board: {
        title: 'Jump game — alcance máximo',
        md: `\`\`\`python
def pode_chegar(nums):                    # LeetCode 55
    alcance = 0
    for i, salto in enumerate(nums):
        if i > alcance:                   # nem o melhor caminho chega aqui
            return False
        alcance = max(alcance, i + salto)
    return True
\`\`\`

\`\`\`text
nums    = [3, 2, 1, 0, 4]
i:         0  1  2  3  4
alcance:   3  3  3  3  -    i = 4 > 3: todo caminho morre no 0 da posição 3
\`\`\`

**Mínimo de saltos** (LeetCode 45): pense em **níveis**, como numa BFS. Com \`k\` saltos você alcança um trecho **contíguo** de índices; varrendo esse trecho, descobre até onde chega com \`k + 1\`.

\`\`\`text
nums = [2, 3, 1, 1, 4]
nível 0: índice 0          -> alcança até o índice 2
nível 1: índices 1..2      -> alcança até o índice 4 (o fim!)
resposta: 2 saltos
\`\`\`

> [!dica] É uma BFS em que cada nível é um **intervalo** de índices — por isso não precisa de fila nem de \`visitados\`: \`O(n)\` de tempo e \`O(1)\` de memória.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Para fechar a teoria: o guloso é sedutor porque o código é curto. O perigo é justamente esse.',
        'Se você não consegue nem provar nem achar contraexemplo, desconfie — e tenha a programação dinâmica como plano B.',
      ],
      board: {
        title: 'Quando usar (e quando não)',
        md: `| Problema | Guloso? | Critério ou alternativa |
|---|---|---|
| Máximo de intervalos compatíveis | ✓ | Ordenar pelo **fim** |
| Mesclar intervalos sobrepostos | ✓ | Ordenar pelo **início** |
| Mínimo de salas | ✓ | Sweep line ou heap de términos |
| Mínimo de flechas para estourar balões (LeetCode 452) | ✓ | Ordenar pelo **fim** |
| Mochila **fracionária** | ✓ | Maior valor por quilo primeiro |
| Mochila **0/1** | ✗ | Programação dinâmica |
| Troco com moedas arbitrárias | ✗ | Programação dinâmica |
| Máximo **peso** de intervalos compatíveis | ✗ | DP + busca binária (*weighted interval scheduling*) |

- Quase todo guloso começa com uma **ordenação** — o critério de ordenação *é* o algoritmo.
- Sinal de alerta: uma escolha boa agora pode **bloquear** algo melhor depois (ex.: intervalos com pesos diferentes, em que um intervalo longo e valioso vale mais que três curtos).`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Critérios gulosos, flechas, salas de reunião, saltos e provas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-greedy-q1',
      concept: 'Interval scheduling',
      say: 'Aquecimento: qual critério de ordenação?',
      prompt: 'Você quer o **maior número** de reuniões `[inicio, fim)` numa única sala, sem sobreposição. Qual guloso é **sempre** ótimo?',
      options: [
        { text: 'Ordenar pelo **início** e pegar cada reunião que não conflita com a última escolhida.', why: 'Uma reunião que começa cedo pode durar o dia todo: `[0, 100)` bloqueia `[1, 2)`, `[3, 4)` e `[5, 6)`.' },
        { text: 'Ordenar pela **duração** e pegar as mais curtas primeiro.', why: 'A mais curta pode ficar bem no meio de duas: `[4, 7)` bloqueia `[1, 5)` e `[6, 10)`, que juntas caberiam.' },
        { text: 'Ordenar pelo **fim** e pegar sempre a que termina primeiro.', correct: true, why: 'Quem termina primeiro deixa o máximo de tempo livre; o argumento de troca prova que essa escolha nunca piora a solução.' },
        { text: 'Pegar primeiro a reunião com **menos conflitos** com as outras.', why: 'Parece esperto, mas também tem contraexemplos — e só contar os conflitos já custa `O(n²)`.' },
      ],
      explanation: 'O critério de ordenação **é** o algoritmo guloso. Ordenar pelo fim funciona porque, pelo *exchange argument*, trocar a primeira reunião de qualquer solução ótima pela que termina primeiro não cria conflito algum. Os outros critérios caem com contraexemplos de três ou quatro intervalos — por isso vale sempre tentar quebrar o guloso antes de codar.',
    },
    {
      type: 'code',
      id: 'lc-greedy-q2',
      concept: 'Interval scheduling',
      title: 'Minimum Number of Arrows to Burst Balloons',
      say: 'LeetCode 452: o mesmo guloso, com uma pegadinha na borda.',
      prompt: `Balões estão presos numa parede, cada um ocupando um intervalo horizontal \`[inicio, fim]\`. Uma flecha disparada na vertical na posição \`x\` estoura **todos** os balões com \`inicio <= x <= fim\` — os intervalos são **fechados**: encostar conta.

Implemente \`min_flechas(baloes)\` que devolve o **menor número de flechas** para estourar todos os balões.

- Os balões vêm em qualquer ordem, com \`inicio <= fim\`.
- Objetivo: **\`O(n log n)\`**.`,
      starter: `def min_flechas(baloes):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'min_flechas([[10, 16], [2, 8], [1, 6], [7, 12]])', expected: '2' },
        { name: 'todos separados', expr: 'min_flechas([[1, 2], [3, 4], [5, 6], [7, 8]])', expected: '4' },
        { name: 'encostar conta', expr: 'min_flechas([[1, 2], [2, 3], [3, 4], [4, 5]])', expected: '2' },
        { name: 'sem balões', expr: 'min_flechas([])', expected: '0' },
        { name: 'balão de um ponto só', expr: 'min_flechas([[5, 5]])', expected: '1' },
        { name: 'um longo e dois curtos', expr: 'min_flechas([[1, 10], [2, 3], [4, 5]])', expected: '2' },
        { expr: 'min_flechas([[-5, -1], [-3, 2], [3, 3]])', expected: '2', hidden: true },
        { expr: 'min_flechas([[1, 5], [4, 7], [6, 10]])', expected: '2', hidden: true },
        { expr: 'min_flechas([[1, 2], [1, 2], [1, 2]])', expected: '1', hidden: true },
        { expr: 'min_flechas([[3, 9], [7, 12], [3, 8], [6, 8], [9, 10], [2, 9], [0, 9], [3, 9], [0, 6], [2, 8]])', expected: '2', hidden: true },
        { expr: 'min_flechas([[-2**31, 2**31 - 1], [0, 0]])', expected: '1', hidden: true },
      ],
      perfTests: [
        {
          name: '3.000 balões curtos',
          setup: 'baloes = [[(i * 7919) % 100000, (i * 7919) % 100000 + (i * 104729) % 30] for i in range(3000)]',
          expr: 'min_flechas(baloes)',
          expected: '2354',
          maxMs: 40,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Guloso: ordenar pelo fim — O(n log n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Para cada flecha, varrer (ou filtrar) os balões restantes custa `O(n · flechas)`, até `O(n²)`. Com os balões ordenados pelo **fim**, basta comparar cada um com a posição da **última** flecha.',
          concept: 'Interval scheduling',
        },
        {
          when: (m, code) => /pop\s*\(\s*0\s*\)|\.remove\s*\(/.test(code),
          text: '`pop(0)` e `remove()` custam `O(n)` cada. Não é preciso tirar balões da lista: percorra em ordem e só conte uma flecha nova quando um balão **escapa** da última.',
          concept: 'Custo de operações em list',
        },
        {
          when: m => m.recursion,
          text: 'Recursão testando onde atirar cada flecha explora combinações demais. A escolha gulosa — atirar no **fim** do balão que termina primeiro — já é ótima.',
          concept: 'Escolha gulosa',
        },
      ],
      hints: [
        'Uma flecha em `x` estoura um grupo de balões que se **sobrepõem** num mesmo ponto. Você quer o menor número de grupos.',
        'Ordene pelo **fim**. A primeira flecha vai no fim do primeiro balão: é o ponto mais à direita que ainda o estoura, então pega o máximo de outros.',
        'Percorra guardando `ultima` (posição da última flecha, começando em `float("-inf")`). Se `inicio > ultima`, o balão escapou: nova flecha em `fim`. Cuidado com o `>`: um balão que só **encosta** na flecha (`inicio == ultima`) estoura.',
      ],
      solution: `def min_flechas(baloes):
    flechas = 0
    ultima = float("-inf")                 # posição da última flecha
    for inicio, fim in sorted(baloes, key=lambda b: b[1]):
        if inicio > ultima:                # a última flecha não alcança este balão
            flechas += 1
            ultima = fim                   # atira no fim dele
    return flechas
`,
      solutionExplanation: 'É o **interval scheduling** disfarçado: o menor número de flechas é igual ao maior número de balões **disjuntos**, e o guloso é o mesmo — ordenar pelo fim. Atirar no fim do balão que termina primeiro é seguro pelo argumento de troca: qualquer flecha que o estoure está à esquerda desse ponto, e empurrá-la até lá só pode estourar **mais** balões. **Tempo `O(n log n)`**, **espaço `O(n)`** pela ordenação. A diferença para as reuniões é a borda: aqui os intervalos são **fechados**, então o teste é `inicio > ultima`, não `>=`.',
    },
    {
      type: 'code',
      id: 'lc-greedy-q3',
      concept: 'Sweep line',
      title: 'Meeting Rooms II',
      say: 'Agora a sweep line. Atenção ao empate!',
      prompt: `Implemente \`min_salas(reunioes)\` que devolve o **número mínimo de salas** para realizar todas as reuniões.

- Cada reunião é \`[inicio, fim]\` com \`inicio < fim\` e ocupa a sala no intervalo **semiaberto** \`[inicio, fim)\`: quem termina às 10 libera a sala para quem começa às 10.
- As reuniões vêm em qualquer ordem.
- Objetivo: **\`O(n log n)\`**.`,
      starter: `def min_salas(reunioes):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'min_salas([[0, 30], [5, 10], [15, 20]])', expected: '2' },
        { name: 'sem conflito', expr: 'min_salas([[7, 10], [2, 4]])', expected: '1' },
        { name: 'lista vazia', expr: 'min_salas([])', expected: '0' },
        { name: 'uma reunião', expr: 'min_salas([[1, 5]])', expected: '1' },
        { name: 'encostadas (empate)', expr: 'min_salas([[1, 5], [5, 10]])', expected: '1' },
        { name: 'todas iguais', expr: 'min_salas([[1, 5], [1, 5], [1, 5]])', expected: '3' },
        { expr: 'min_salas([[1, 10], [2, 7], [3, 19], [8, 12], [10, 20], [11, 30]])', expected: '4', hidden: true },
        { expr: 'min_salas([[13, 15], [1, 13]])', expected: '1', hidden: true },
        { expr: 'min_salas([[9, 10], [4, 9], [4, 17]])', expected: '2', hidden: true },
        { expr: 'min_salas([[0, 5], [5, 10], [10, 15], [0, 15]])', expected: '2', hidden: true },
      ],
      perfTests: [
        {
          name: '3.000 reuniões muito sobrepostas',
          setup: 'reunioes = [[(i * 7919) % 1000003, (i * 7919) % 1000003 + 400000 + (i * 104729) % 600000] for i in range(3000)]',
          expr: 'min_salas(reunioes)',
          expected: '2094',
          maxMs: 40,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Sweep line / heap de términos — O(n log n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Para cada reunião, varrer as outras (ou a lista de salas) custa `O(n²)` quando muitas se sobrepõem. Com eventos ordenados (sweep line) ou um **min-heap** de términos, cada reunião custa `O(log n)`.',
          concept: 'Sweep line',
        },
        {
          when: (m, code) => /\[\s*0\s*\]\s*\*/.test(code),
          text: 'Um array indexado pelo **tempo** gasta memória e tempo proporcionais ao maior horário — e se os horários fossem timestamps em segundos? Ordene só os `2n` eventos: o custo passa a depender do número de reuniões.',
          concept: 'Sweep line',
        },
        {
          when: m => m.calls.includes('min') && !m.imports.includes('heapq'),
          text: 'Chamar `min()` sobre as salas a cada reunião é `O(salas)` por passo. Um **heap** (`heapq`) entrega o menor término em `O(1)` e atualiza em `O(log n)`.',
          concept: 'Heap',
        },
      ],
      hints: [
        'O número de salas é o **pico** de reuniões acontecendo ao mesmo tempo.',
        'Transforme cada reunião em dois eventos, `(inicio, 1)` e `(fim, -1)`. Ordene a lista de eventos e acumule os deltas, guardando o máximo.',
        'No empate de horário, o término precisa vir **antes** do início. Com tuplas `(tempo, delta)`, o `sort()` já faz isso: `(10, -1) < (10, 1)`.',
      ],
      solution: `def min_salas(reunioes):
    eventos = []
    for inicio, fim in reunioes:
        eventos.append((inicio, 1))     # alguém entra
        eventos.append((fim, -1))       # alguém sai
    eventos.sort()                      # no empate, -1 vem antes de +1
    salas = pico = 0
    for _, delta in eventos:
        salas += delta
        pico = max(pico, salas)
    return pico
`,
      solutionExplanation: 'São `2n` eventos: ordenar custa **`O(n log n)`** e a varredura, `O(n)`; **espaço `O(n)`**. O desempate `(t, -1) < (t, 1)` implementa o intervalo semiaberto sem nenhum `if`. A versão com heap (ordenar por início; `heapreplace` quando `heap[0] <= inicio`, senão `heappush`; resposta `len(heap)`) tem a mesma complexidade e ainda permite saber **qual** sala cada reunião ocupa — a sweep line só mede o pico.',
    },
    {
      type: 'match',
      id: 'lc-greedy-q4',
      concept: 'Escolha gulosa',
      say: 'Bate-bola: qual estratégia para cada problema?',
      prompt: 'Associe cada problema à estratégia correta.',
      pairs: [
        { left: 'Máximo de reuniões numa única sala', right: 'Ordenar pelo fim e pegar quem termina primeiro' },
        { left: 'Mínimo de salas para todas as reuniões', right: 'Sweep line: `+1` no início, `-1` no fim' },
        { left: 'Mesclar intervalos sobrepostos', right: 'Ordenar pelo início e estender o último' },
        { left: 'Dá para chegar ao fim do array de saltos?', right: 'Carregar o alcance máximo até agora' },
        { left: 'Troco mínimo com moedas `{1, 3, 4}`', right: 'Programação dinâmica — o guloso falha' },
        { left: 'Mochila fracionária', right: 'Maior valor por quilo primeiro' },
      ],
      explanation: 'Quase todo guloso de intervalos começa com uma **ordenação** — e o critério muda com a pergunta: fim para *selecionar*, início para *mesclar*, eventos para *contar simultâneos*. Já o troco com moedas arbitrárias e a mochila 0/1 são os contraexemplos clássicos: uma escolha boa agora pode bloquear uma melhor depois, e só a programação dinâmica garante o ótimo. (Na mochila **fracionária** o guloso funciona porque dá para levar um pedaço do item.)',
    },
    {
      type: 'code',
      id: 'lc-greedy-q5',
      concept: 'Jump game',
      title: 'Jump Game II',
      say: 'Último código: saltos mínimos. Pense em níveis, não em caminhos.',
      prompt: `Em \`nums\`, cada valor \`nums[i] >= 0\` é o salto **máximo** a partir da posição \`i\`: dali você pode saltar qualquer distância de \`1\` até \`nums[i]\`. Você começa no índice \`0\`.

Implemente \`min_saltos(nums)\` que devolve o **menor número de saltos** para chegar ao **último índice**, ou \`-1\` se for impossível.

- \`nums\` tem pelo menos 1 elemento (se você já está no fim, a resposta é \`0\`).
- Objetivo: **\`O(n)\`**.`,
      starter: `def min_saltos(nums):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'min_saltos([2, 3, 1, 1, 4])', expected: '2' },
        { name: 'impossível', expr: 'min_saltos([3, 2, 1, 0, 4])', expected: '-1' },
        { name: 'já no fim', expr: 'min_saltos([0])', expected: '0' },
        { name: 'preso no começo', expr: 'min_saltos([0, 1])', expected: '-1' },
        { name: 'passos de 1', expr: 'min_saltos([1, 1, 1, 1])', expected: '3' },
        { name: 'um salto basta', expr: 'min_saltos([10, 0, 0])', expected: '1' },
        { expr: 'min_saltos([2, 3, 0, 1, 4])', expected: '2', hidden: true },
        { expr: 'min_saltos([1, 0, 1])', expected: '-1', hidden: true },
        { expr: 'min_saltos([5, 9, 3, 2, 1, 0, 2, 3, 3, 1, 0, 0])', expected: '3', hidden: true },
        { expr: 'min_saltos([2, 0, 2, 0, 1])', expected: '2', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 4.000, saltos longos',
          setup: 'nums = [400 - (i % 7) for i in range(4000)]',
          expr: 'min_saltos(nums)',
          expected: '11',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Guloso por níveis (BFS implícita) — O(n)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Para cada posição, percorrer todos os destinos (ou todas as origens) custa `O(n · salto)`, até `O(n²)`. Os índices alcançáveis com `k` saltos formam um **intervalo contíguo**: uma varredura carregando `fim_do_nivel` e `alcance` basta.',
          concept: 'Jump game',
        },
        {
          when: m => m.recursion,
          text: 'Recursão que tenta cada salto possível explode exponencialmente — e, memoizada, ainda fica `O(n²)`. O guloso por níveis resolve em `O(n)`.',
          concept: 'Escolha gulosa',
        },
        {
          when: m => m.calls.includes('deque'),
          text: 'Uma BFS com fila funciona, mas aqui cada nível é um **intervalo de índices**: dá para dispensar a fila e os `visitados` e ficar com `O(1)` de memória.',
          concept: 'Jump game',
        },
      ],
      hints: [
        'Com `k` saltos, os índices alcançáveis formam um **trecho contíguo** que começa no 0. Chame o fim desse trecho de `fim_do_nivel`.',
        'Varra `i` do primeiro ao **penúltimo** índice mantendo `alcance = max(alcance, i + nums[i])` — o mais longe que se chega com **um salto a mais**.',
        'Quando `i == fim_do_nivel`, o nível acabou: se `alcance <= i`, ninguém passa daqui (devolva `-1`); senão, `saltos += 1` e `fim_do_nivel = alcance` (pare se já chegou ao último índice).',
      ],
      solution: `def min_saltos(nums):
    ultimo = len(nums) - 1
    saltos = 0
    fim_do_nivel = 0     # mais longe que se chega com "saltos" saltos
    alcance = 0          # mais longe que se chega com um salto a mais
    for i in range(ultimo):
        alcance = max(alcance, i + nums[i])
        if i == fim_do_nivel:            # acabou o nível: é preciso saltar
            if alcance <= i:             # ninguém deste nível passa daqui
                return -1
            saltos += 1
            fim_do_nivel = alcance
            if fim_do_nivel >= ultimo:
                break
    return saltos
`,
      solutionExplanation: 'É uma **BFS por níveis** em que cada nível é um intervalo de índices: `fim_do_nivel` fecha o nível atual e `alcance` já calcula o próximo. Cada índice é visto uma vez: **tempo `O(n)`**, **espaço `O(1)`**. O laço vai só até o **penúltimo** índice — saltar a partir do último não faz sentido —, o que também cobre `[0]` (resposta `0`). Se um nível termina sem que ninguém alcance além dele, o índice seguinte é inalcançável: `-1`.',
    },
    {
      type: 'open',
      id: 'lc-greedy-q6',
      concept: 'Escolha gulosa',
      say: 'Pergunta de entrevista: me convença de que o guloso está certo.',
      prompt: 'Um colega propôs resolver "troco com o menor número de moedas" sempre pegando a **maior moeda que cabe**. O sistema de moedas vem de uma configuração e pode mudar. Você aprovaria? Como verificaria se um guloso está certo, e o que usaria no lugar?',
      minWords: 25,
      rubric: [
        { label: 'Mostra um **contraexemplo** (ex.: moedas `{1, 3, 4}` e troco `6`)', keywords: ['contraexemplo', 'contra-exemplo', 'contra exemplo', '1, 3, 4', '1,3,4', '3 + 3', '3+3', '4 + 1 + 1', '4+1+1', 'falha', 'nao funciona', 'nao da o otimo'], concept: 'Escolha gulosa', why: 'Um único contraexemplo derruba o guloso — e, para sistemas de moedas arbitrários, ele existe.' },
        { label: 'Propõe **programação dinâmica** para o caso geral', keywords: ['programacao dinamica', 'dp', 'memoiz', 'tabela', 'bottom-up', 'bottom up', 'coin change'], concept: 'Programação dinâmica', why: 'A DP considera todas as moedas em cada valor: `O(valor · moedas)` e sempre ótima.' },
        { label: 'Explica como **provar** um guloso (exchange argument, escolha gulosa + subestrutura ótima, sistema canônico)', keywords: ['prova', 'provar', 'exchange', 'argumento de troca', 'escolha gulosa', 'subestrutura', 'canonic', 'invariante'], concept: 'Exchange argument', why: 'Sem prova, "passou nos exemplos" não garante nada.' },
        { label: 'Sugere **comparar com força bruta** em entradas pequenas e aleatórias', keywords: ['forca bruta', 'brute', 'aleatori', 'random', 'property', 'propriedade', 'exaustiv', 'entradas pequenas', 'valores pequenos', 'fuzz'], concept: 'Testes', why: 'Comparar com uma solução exaustiva em milhares de casos pequenos encontra contraexemplos rapidamente.' },
      ],
      modelAnswer: `Eu **não** aprovaria para um sistema de moedas arbitrário. Contraexemplo: com moedas \`{1, 3, 4}\` e troco \`6\`, o guloso dá \`4 + 1 + 1\` (3 moedas), mas \`3 + 3\` usa só 2 — o guloso **falha**.

Para o caso geral, eu usaria **programação dinâmica**: \`dp[v] = 1 + min(dp[v - m])\` para cada moeda \`m <= v\`, em \`O(valor · moedas)\`, sempre ótima.

O guloso só é aceitável com **prova**: mostrar a propriedade da escolha gulosa com um *exchange argument* e a subestrutura ótima — sistemas em que isso vale se chamam **canônicos** (o do dólar é um). Como o sistema vem de configuração, eu ainda escreveria um teste que compara o guloso com a **força bruta** em milhares de valores pequenos e aleatórios: se alguém cadastrar um sistema não canônico, o teste acusa.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! Guloso é escolher o **critério certo** e decidir sem voltar atrás: fim para selecionar, eventos para contar simultâneos, alcance para saltar.',
        { text: 'E o hábito que separa quem é experiente: antes de confiar no guloso, tente **quebrá-lo** com um contraexemplo pequeno. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
