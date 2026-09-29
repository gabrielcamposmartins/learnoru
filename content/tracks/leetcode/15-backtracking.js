Game.registerModule('leetcode', {
  id: 'backtracking',
  title: 'Backtracking',
  kind: 'lesson',
  level: 3,
  order: 40,
  unit: 'tecnicas',
  summary: 'Explore todas as possibilidades sem se perder: o molde escolher/explorar/desfazer gera subconjuntos, permutações e combinações, e a poda resolve as N-Rainhas antes do universo esfriar.',
  concepts: ['Backtracking', 'Escolher/explorar/desfazer', 'Poda', 'N-Rainhas', 'Complexidade exponencial'],
  takeaways: [
    'Backtracking é uma **DFS na árvore de decisões**: monta a solução peça por peça e **volta atrás** quando o caminho não leva a nada.',
    'O molde é sempre o mesmo: **escolher** (`caminho.append(x)`), **explorar** (recursão) e **desfazer** (`caminho.pop()`). Ao guardar uma resposta, guarde uma **cópia** (`caminho[:]`).',
    'Subconjuntos e combinações usam um índice `inicio` (só olham para a frente); permutações usam um vetor `usados`. Duplicatas na entrada: **ordene** e pule `nums[i] == nums[i - 1]` quando `i > inicio`.',
    '**Poda** é o que separa backtracking de força bruta: corte o ramo assim que ele violar uma restrição (casa atacada, soma que estourou, valor repetido no mesmo nível).',
    'O custo é **exponencial** (`O(n·2ⁿ)`, `O(n·n!)`) e muitas vezes inevitável, porque a própria **saída** é exponencial. Se a pergunta é só "quantos?" ou "qual o melhor?" e os subproblemas se repetem, pense em **programação dinâmica**.',
  ],
  glossary: [
    { term: 'Backtracking', aliases: ['backtrack', 'retrocesso', 'busca com retrocesso'], definition: 'Técnica que constrói soluções **incrementalmente** e abandona (volta atrás de) cada candidato parcial assim que ele não pode mais virar uma solução válida. É uma busca em profundidade na árvore de decisões. O nome foi cunhado por D. H. Lehmer nos anos 1950.' },
    { term: 'Árvore de espaço de estados', aliases: ['árvore de estados', 'espaço de estados', 'state space tree', 'árvore de busca'], definition: 'Árvore implícita em que cada nó é uma **solução parcial** e cada aresta é uma escolha. O backtracking a percorre em profundidade, sem nunca montá-la inteira na memória.' },
    { term: 'Poda', aliases: ['pruning', 'podar', 'podas', 'podando'], definition: 'Cortar um ramo inteiro da árvore de busca assim que se sabe que ele não leva a nenhuma solução (ou a nenhuma melhor que a atual). Uma boa poda transforma uma busca impraticável em milissegundos.' },
    { term: 'Branch and bound', aliases: ['branch-and-bound', 'ramificar e limitar'], definition: 'Variante de backtracking para **otimização**: cada ramo recebe um limite (*bound*) do melhor valor que ainda pode atingir; se esse limite já é pior que a melhor solução conhecida, o ramo é podado.' },
    { term: 'Dancing Links', aliases: ['DLX', 'Algoritmo X', 'Algorithm X'], definition: 'Técnica popularizada por Donald Knuth (2000) para backtracking em problemas de **cobertura exata** (sudoku, N-Rainhas, pentominós): remover e **restaurar** um nó de uma lista duplamente ligada custa `O(1)`, então "desfazer" sai de graça.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é dia de **backtracking** — a técnica para quando o enunciado diz "liste **todas** as…".',
        'A ideia: montar a resposta uma escolha por vez e, quando der em beco sem saída, **voltar atrás** e tentar outra coisa.',
      ],
      board: {
        title: 'O problema: explorar todas as possibilidades',
        md: `Enunciados típicos:
- "Liste **todos os subconjuntos** de \`[1, 2, 3]\`." (LeetCode 78)
- "Liste **todas as permutações** de uma lista." (LeetCode 46)
- "Todas as combinações que somam \`alvo\`." (LeetCode 39/40)
- "Coloque \`n\` rainhas num tabuleiro \`n × n\` sem que nenhuma ataque outra." (LeetCode 51/52)

Todos têm a mesma cara: uma sequência de **decisões**. Desenhe as decisões e aparece uma **árvore** — a *árvore de espaço de estados*:

\`\`\`text
subconjuntos de [1, 2, 3]: para cada número, "entra" ou "não entra"?

                           []
               usa 1 /           \\ não usa 1
                 [1]                 []
          usa 2 /    \\           /      \\
          [1,2]      [1]       [2]       []
          /   \\     /   \\     /  \\      /  \\
    [1,2,3] [1,2] [1,3] [1] [2,3] [2]  [3]  []     <- 2³ = 8 folhas
\`\`\`

**Backtracking** = percorrer essa árvore em **profundidade** (DFS), guardando só o **caminho atual**. Ao chegar numa folha (ou num beco sem saída), você **volta** um nível e tenta a próxima opção.

> [!dica] A árvore nunca é montada na memória: ela existe só implicitamente, na pilha de recursão. Por isso o espaço extra é \`O(profundidade)\`, não \`O(número de nós)\`.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Todo backtracking segue o mesmo molde de três tempos: **escolher, explorar, desfazer**.',
        'Decore isso e metade dos problemas "liste todos" viram preencher lacunas.',
      ],
      board: {
        title: 'O molde: escolher → explorar → desfazer',
        md: `\`\`\`python
def resolver(entrada):
    resultado, caminho = [], []

    def backtrack(estado):
        if eh_solucao_completa(estado):
            resultado.append(caminho[:])      # guarda uma CÓPIA
            return
        for escolha in candidatos(estado):
            if not valida(escolha):           # PODA: nem entra no ramo
                continue
            caminho.append(escolha)           # 1. escolher
            backtrack(proximo(estado))        # 2. explorar
            caminho.pop()                     # 3. desfazer

    backtrack(estado_inicial)
    return resultado
\`\`\`

Por que **desfazer**? Porque existe **um único** \`caminho\` compartilhado por toda a busca. Cada nível empilha sua escolha e a retira ao voltar, então quem vem depois encontra o estado exatamente como estava. Isso custa \`O(n)\` de memória, em vez de copiar a lista inteira a cada chamada.

> [!atencao] O bug número 1 do backtracking é \`resultado.append(caminho)\` **sem cópia**. Você guarda a **mesma lista** várias vezes; como ela é esvaziada pelos \`pop()\`, no fim todas as "respostas" aparecem vazias. Use \`caminho[:]\` ou \`list(caminho)\`.

Em que o molde varia de um problema para outro:

| Pergunta | Decide… |
|---|---|
| Quando uma solução está completa? | o caso base |
| Quais são os candidatos do próximo passo? | o laço \`for\` |
| O que torna um candidato inválido? | a **poda** |
| O que precisa ser desfeito? | lista, conjunto, tabuleiro, contador… |`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Três formas aparecem o tempo todo: **subconjuntos**, **combinações** e **permutações**.',
        'A diferença entre elas está em um detalhe: de onde o laço começa e o que conta como "já usado".',
      ],
      board: {
        title: 'Subconjuntos, combinações e permutações',
        md: `**Subconjuntos** — todo nó da árvore é uma resposta; o índice \`inicio\` faz o laço só olhar **para a frente**, então \`[1, 2]\` e \`[2, 1]\` não aparecem as duas:

\`\`\`python
def subconjuntos(nums):
    resultado, caminho = [], []

    def backtrack(inicio):
        resultado.append(caminho[:])          # cada nó é um subconjunto
        for i in range(inicio, len(nums)):
            caminho.append(nums[i])
            backtrack(i + 1)                  # i + 1: nunca volta para trás
            caminho.pop()

    backtrack(0)
    return resultado
\`\`\`

**Permutações** — a ordem importa, então o laço sempre recomeça do zero e um vetor \`usados\` evita repetir elementos:

\`\`\`python
def permutacoes(nums):
    resultado, caminho, usados = [], [], [False] * len(nums)

    def backtrack():
        if len(caminho) == len(nums):
            resultado.append(caminho[:])
            return
        for i, x in enumerate(nums):
            if usados[i]:
                continue
            usados[i] = True                  # escolher (duas coisas!)
            caminho.append(x)
            backtrack()                       # explorar
            caminho.pop()                     # desfazer (as mesmas duas)
            usados[i] = False

    backtrack()
    return resultado
\`\`\`

| Forma | O laço começa em | Resposta quando | Nº de respostas |
|---|---|---|---|
| Subconjuntos | \`inicio\` | em **todo** nó | \`2ⁿ\` |
| Combinações de \`k\` | \`inicio\` | \`len(caminho) == k\` | \`C(n, k)\` |
| Permutações | \`0\` (com \`usados\`) | \`len(caminho) == n\` | \`n!\` |

> [!dica] Nas combinações de \`k\`, dá para podar cedo: se \`len(caminho) + (len(nums) - i) < k\`, não sobram elementos para completar — \`break\`.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora a parte que impressiona o entrevistador: **poda**.',
        'Força bruta gera tudo e depois filtra. Backtracking **nem entra** nos ramos que já sabe que não prestam.',
      ],
      board: {
        title: 'Poda: combination sum',
        md: `**Combination sum** (LeetCode 39): combinações de \`candidatos\` (distintos, **reutilizáveis**) que somam \`alvo\`.

\`\`\`python
def combination_sum(candidatos, alvo):
    candidatos = sorted(candidatos)           # ordenar habilita a poda
    resultado, caminho = [], []

    def backtrack(inicio, resto):
        if resto == 0:
            resultado.append(caminho[:])
            return
        for i in range(inicio, len(candidatos)):
            c = candidatos[i]
            if c > resto:
                break                         # PODA: os próximos são ainda maiores
            caminho.append(c)
            backtrack(i, resto - c)           # i (e não i + 1): c pode ser reusado
            caminho.pop()

    backtrack(0, alvo)
    return resultado
\`\`\`

\`\`\`text
candidatos = [2, 3, 6, 7], alvo = 7

resto 7
├─ 2 → resto 5
│   ├─ 2 → resto 3
│   │   ├─ 2 → resto 1   (o próximo 2 > 1: break, nem tenta 3, 6, 7)
│   │   └─ 3 → resto 0   ✓ [2, 2, 3]
│   └─ 3 → resto 2       (3 > 2: break)
├─ 3 → resto 4
│   └─ 3 → resto 1       (3 > 1: break)
├─ 6 → resto 1           (6 > 1: break)
└─ 7 → resto 0           ✓ [7]
\`\`\`

Os tipos de poda que mais aparecem:

| Poda | Exemplo |
|---|---|
| **Por restrição** | casa atacada nas N-Rainhas; letra que não bate no *word search* |
| **Por limite** | a soma já passou do alvo (com a lista **ordenada**, vira \`break\`) |
| **Por duplicata** | entrada com repetidos: ordene e pule \`i > inicio and c == candidatos[i - 1]\` |
| **Por otimalidade** | *branch and bound*: este ramo nunca vai superar a melhor resposta já achada |

> [!atencao] Na poda de duplicatas, a condição é \`i > inicio\`, **não** \`i > 0\`. Usar o mesmo valor em **níveis diferentes** é legítimo (\`[1, 1, 6]\`); o que gera repetição é escolher o mesmo valor duas vezes **no mesmo nível** da árvore.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O clássico dos clássicos: as **N-Rainhas**. Colocar `n` rainhas num tabuleiro `n × n` sem nenhuma atacar outra.',
        'O segredo é escolher bem a decisão: **uma rainha por linha**. Aí só falta checar colunas e diagonais — em `O(1)`.',
      ],
      board: {
        title: 'N-Rainhas: uma linha por nível',
        md: `Cada nível da recursão é uma **linha**; as escolhas são as **colunas**. Duas linhas nunca brigam (uma rainha por linha), então sobram três restrições:

\`\`\`text
linha - col  (diagonal ↘)       linha + col  (diagonal ↙)
 0 -1 -2 -3                      0  1  2  3
 1  0 -1 -2                      1  2  3  4
 2  1  0 -1                      2  3  4  5
 3  2  1  0                      3  4  5  6
\`\`\`

Na mesma diagonal ↘, \`linha - col\` é constante; na ↙, \`linha + col\`. Com três conjuntos, a checagem é **\`O(1)\`**:

\`\`\`python
colunas, diag, anti = set(), set(), set()

def pode_colocar(linha, col):
    return col not in colunas and linha - col not in diag and linha + col not in anti
\`\`\`

A busca em \`n = 4\`, com poda:

\`\`\`text
linha 0: coluna 0
  linha 1: col 0 ✗ (coluna)  col 1 ✗ (diagonal)  col 2 ✓
    linha 2: todas atacadas → beco sem saída, DESFAZ
  linha 1: col 3 ✓
    linha 2: col 1 ✓
      linha 3: todas atacadas → desfaz, desfaz, desfaz…
linha 0: coluna 1 → … → primeira solução: colunas [1, 3, 0, 2]
\`\`\`

A força bruta testaria \`C(16, 4) = 1.820\` posições; a busca acima visita poucas dezenas de nós.

> [!sabia] O problema das 8 rainhas foi proposto pelo enxadrista Max Bezzel em **1848** e tem **92** soluções (12 "essencialmente diferentes", descontando rotações e reflexos). Em 2000, Donald Knuth popularizou os **Dancing Links**: numa lista duplamente ligada, remover \`x\` é \`x.esq.dir = x.dir; x.dir.esq = x.esq\` — mas \`x\` continua lembrando dos vizinhos, então **desfazer** é só \`x.esq.dir = x; x.dir.esq = x\`, em \`O(1)\`. É o "desfazer" do backtracking levado ao extremo, e resolve sudoku e N-Rainhas como problemas de *cobertura exata*.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Hora da verdade: backtracking é **exponencial**. Quase sempre não tem como fugir disso.',
        'O que você precisa saber é **quanto** exponencial, e reconhecer pelas restrições do enunciado se isso cabe.',
      ],
      board: {
        title: 'Complexidade exponencial (e quando não usar)',
        md: `| Problema | Folhas da árvore | Custo total (copiando cada resposta) |
|---|---|---|
| Subconjuntos | \`2ⁿ\` | \`O(n·2ⁿ)\` |
| Combinações de \`k\` | \`C(n, k)\` | \`O(k·C(n, k))\` |
| Permutações | \`n!\` | \`O(n·n!)\` |
| N-Rainhas | bem menos que \`n!\` (graças à poda) | \`O(n!)\` no pior caso |
| Combination sum | depende de \`alvo / menor candidato\` (profundidade) | exponencial nessa profundidade |

| \`n\` | \`2ⁿ\` | \`n!\` |
|---|---|---|
| 10 | 1.024 | 3.628.800 |
| 15 | 32.768 | ≈ 1,3 × 10¹² |
| 20 | 1.048.576 | ≈ 2,4 × 10¹⁸ |

- **Leia as restrições**: \`n ≤ 20\` é um convite a \`2ⁿ\`; \`n ≤ 10\` sugere \`n!\`. Se \`n\` chega a 10⁵, backtracking não é o caminho.
- **Espaço**: \`O(n)\` de pilha e de \`caminho\`, mais o tamanho da saída.
- Quando é preciso **listar** todas as respostas, a saída já é exponencial: nenhum algoritmo faz melhor que o tamanho dela.

**Quando não usar:**
- A pergunta é "**quantas** formas?" ou "qual o **mínimo**?" e os mesmos subproblemas se repetem → **programação dinâmica** (a próxima aula).
- Existe uma escolha gulosa com garantia → algoritmo guloso.
- Pode usar biblioteca? \`itertools.combinations\`, \`permutations\` e \`product\` geram as formas básicas em C — mas não sabem **podar**.

> [!dica] Recursão em Python tem limite de ~1.000 níveis, mas aqui a profundidade é \`n\` (ou \`alvo / menor candidato\`), bem longe disso: o gargalo do backtracking é o **tempo**, não a pilha.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'O bug da cópia, combinações sem repetição, N-Rainhas e o molde.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-bt-q1',
      concept: 'Escolher/explorar/desfazer',
      say: 'Começando por um bug que aparece em muita entrevista. Olhe com calma.',
      prompt: `Um candidato escreveu:

\`\`\`python
def subconjuntos(nums):
    resultado, caminho = [], []

    def backtrack(inicio):
        resultado.append(caminho)
        for i in range(inicio, len(nums)):
            caminho.append(nums[i])
            backtrack(i + 1)
            caminho.pop()

    backtrack(0)
    return resultado
\`\`\`

O que \`subconjuntos([1, 2])\` devolve?`,
      options: [
        { text: '`[[], [1], [1, 2], [2]]`', why: 'Seria a resposta certa com `caminho[:]`. Sem a cópia, `resultado` guarda quatro referências para a **mesma** lista.' },
        { text: '`[[1, 2], [1, 2], [1, 2], [1, 2]]`', why: 'As quatro entradas são a mesma lista, sim, mas ela não termina em `[1, 2]`: cada `append` foi desfeito por um `pop`, então no fim ela está vazia.' },
        { text: '`[[], [], [], []]`', correct: true, why: 'São quatro referências ao mesmo objeto `caminho`. Depois do último `pop()`, ele está vazio — e todas as "respostas" mostram isso.' },
        { text: 'Estoura `RecursionError`, porque o caso base não tem `return`.', why: 'O laço `for` com `inicio` crescente já termina a recursão: quando `inicio == len(nums)`, o laço não roda e a função volta.' },
      ],
      explanation: '`resultado.append(caminho)` guarda uma **referência**, não um retrato do momento. Como o backtracking reutiliza um único `caminho` (é isso que o torna econômico em memória), toda mudança posterior aparece em todas as referências guardadas. A regra: **ao registrar uma resposta, copie** — `caminho[:]`, `list(caminho)` ou `tuple(caminho)`. A cópia custa `O(n)` por resposta, e é por isso que os custos têm o fator `n` em `O(n·2ⁿ)`.',
    },
    {
      type: 'code',
      id: 'lc-bt-q2',
      concept: 'Poda',
      title: 'Combination Sum II',
      say: 'LeetCode 40. Os candidatos podem se repetir, mas as respostas não. Pense na poda antes de codar.',
      prompt: `Dados \`candidatos\` (inteiros positivos, que **podem se repetir**) e um \`alvo\` positivo, implemente \`combinacoes_soma(candidatos, alvo)\` que devolve **todas** as combinações **distintas** cuja soma é \`alvo\`.

- Cada **posição** de \`candidatos\` pode ser usada **no máximo uma vez**.
- A ordem das combinações (e dentro de cada uma) não importa, mas **não** pode haver combinações repetidas.
- \`combinacoes_soma([10, 1, 2, 7, 6, 1, 5], 8)\` → \`[[1, 1, 6], [1, 2, 5], [1, 7], [2, 6]]\`
- Objetivo: backtracking com **poda** — sem gerar ramos repetidos nem continuar somas que já estouraram.`,
      starter: `def combinacoes_soma(candidatos, alvo):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'combinacoes_soma([10, 1, 2, 7, 6, 1, 5], 8)', expected: '[[1, 1, 6], [1, 2, 5], [1, 7], [2, 6]]', compare: 'nested_sorted' },
        { name: 'valores repetidos na entrada', expr: 'combinacoes_soma([2, 5, 2, 1, 2], 5)', expected: '[[1, 2, 2], [5]]', compare: 'nested_sorted' },
        { name: 'cada posição só uma vez', expr: 'combinacoes_soma([2], 4)', expected: '[]', compare: 'nested_sorted' },
        { name: 'sem candidatos', expr: 'combinacoes_soma([], 3)', expected: '[]', compare: 'nested_sorted' },
        { name: 'nenhuma combinação possível', expr: 'combinacoes_soma([4, 6, 8], 5)', expected: '[]', compare: 'nested_sorted' },
        { expr: 'combinacoes_soma([1, 1, 1, 1], 2)', expected: '[[1, 1]]', compare: 'nested_sorted', hidden: true },
        { expr: 'combinacoes_soma([4, 4, 2, 1, 4, 2, 2, 1, 3], 6)', expected: '[[1, 1, 2, 2], [1, 1, 4], [1, 2, 3], [2, 2, 2], [2, 4]]', compare: 'nested_sorted', hidden: true },
        { expr: 'combinacoes_soma([3, 1, 3, 5, 1, 1], 8)', expected: '[[1, 1, 1, 5], [1, 1, 3, 3], [3, 5]]', compare: 'nested_sorted', hidden: true },
        { expr: 'combinacoes_soma([7], 7)', expected: '[[7]]', compare: 'nested_sorted', hidden: true },
      ],
      perfTests: [
        {
          name: 'vinte 1s, alvo 10',
          setup: 'candidatos = [1] * 20',
          expr: 'combinacoes_soma(candidatos, 10)',
          expected: '[[1] * 10]',
          compare: 'nested_sorted',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Poda de duplicatas no mesmo nível',
      reviews: [
        {
          when: m => m.calls.includes('tuple') || m.calls.includes('frozenset'),
          text: 'Deduplicar no fim (um `set` de tuplas) dá a resposta certa, mas você já pagou para explorar **todos** os ramos repetidos — com vinte `1`s são centenas de milhares de caminhos para uma única resposta. Ordene e pule `candidatos[i] == candidatos[i - 1]` quando `i > inicio`: o ramo repetido nem nasce.',
          concept: 'Poda',
        },
        {
          when: m => m.calls.includes('combinations') || m.calls.includes('product'),
          text: 'Gerar todas as combinações com `itertools` e filtrar pela soma é **gerar e testar**: `2ⁿ` candidatos, mesmo quando quase todos estouram o alvo. O backtracking poda o ramo no instante em que a soma passa do alvo.',
          concept: 'Backtracking',
        },
      ],
      hints: [
        'Use o molde com `backtrack(inicio, resto)`: quando `resto == 0`, registre uma **cópia** do caminho. Como cada posição vale uma vez só, a recursão segue com `i + 1`.',
        'Ordene `candidatos` antes de começar. Assim, se `candidatos[i] > resto`, todos os seguintes também são — faça `break`, não `continue`.',
        'Para não repetir combinações: no mesmo nível (mesmo laço `for`), pule `candidatos[i] == candidatos[i - 1]` quando `i > inicio`. Com `i > 0` você perderia respostas como `[1, 1, 6]`.',
      ],
      solution: `def combinacoes_soma(candidatos, alvo):
    candidatos = sorted(candidatos)        # ordenar habilita as duas podas
    resultado, caminho = [], []

    def backtrack(inicio, resto):
        if resto == 0:
            resultado.append(caminho[:])   # cópia!
            return
        for i in range(inicio, len(candidatos)):
            c = candidatos[i]
            if c > resto:
                break                      # poda por limite: os próximos são maiores
            if i > inicio and c == candidatos[i - 1]:
                continue                   # poda por duplicata: mesmo valor, mesmo nível
            caminho.append(c)              # escolher
            backtrack(i + 1, resto - c)    # explorar (cada posição uma vez)
            caminho.pop()                  # desfazer

    backtrack(0, alvo)
    return resultado
`,
      solutionExplanation: 'Ordenar custa `O(n log n)` e habilita duas podas. **Por limite**: se `c > resto`, nenhum candidato seguinte cabe, então `break`. **Por duplicata**: dentro do mesmo laço (mesmo nível da árvore), escolher um valor igual ao anterior geraria exatamente a mesma subárvore — pular garante combinações distintas **sem** precisar de `set`. O pior caso continua exponencial (`O(n·2ⁿ)`, o número de subconjuntos), mas só se visitam ramos que ainda podem dar certo. No teste de desempenho, com vinte `1`s e alvo 10, a solução visita 11 nós; quem deduplica no fim percorre centenas de milhares de caminhos repetidos. Espaço: `O(n)` de pilha e caminho, mais a saída.',
    },
    {
      type: 'match',
      id: 'lc-bt-q3',
      concept: 'Complexidade exponencial',
      say: 'Rapidinho: associe cada problema ao tamanho da sua árvore de busca.',
      prompt: 'Associe cada problema de backtracking ao seu custo (ou à sua forma de crescer).',
      pairs: [
        { left: 'Todos os subconjuntos de `n` itens', right: '`O(n·2ⁿ)` — cada item entra ou não entra' },
        { left: 'Todas as permutações de `n` itens', right: '`O(n·n!)` — `n` escolhas, depois `n - 1`, …' },
        { left: 'Combinações de `k` entre `n`', right: '`O(k·C(n, k))` — só caminhos de tamanho `k`' },
        { left: 'N-Rainhas', right: 'Bem menos que `n!` — poda por colunas e diagonais' },
        { left: 'Combination sum (com repetição)', right: 'Profundidade de até `alvo / menor candidato`' },
      ],
      explanation: 'O custo de um backtracking é, grosso modo, **número de nós da árvore × trabalho por nó**. Subconjuntos têm `2ⁿ` folhas; permutações, `n!`; combinações de `k`, `C(n, k)` — e cada resposta ainda custa `O(n)` (ou `O(k)`) para ser copiada. Nas N-Rainhas, a poda corta a árvore tão cedo que o número real de nós fica muito abaixo de `n!`. No combination sum, a profundidade é o que explode: com candidato `1` e alvo 30, o caminho tem até 30 níveis.',
    },
    {
      type: 'code',
      id: 'lc-bt-q4',
      concept: 'N-Rainhas',
      title: 'N-Rainhas II',
      say: 'LeetCode 52. Não precisa desenhar os tabuleiros: só contar quantas soluções existem.',
      prompt: `Implemente \`total_n_rainhas(n)\` que devolve **quantas** formas existem de colocar \`n\` rainhas num tabuleiro \`n × n\` (\`n ≥ 1\`) sem que nenhuma ataque outra (mesma linha, coluna ou diagonal).

- \`total_n_rainhas(4)\` → \`2\`
- Objetivo: backtracking **linha a linha**, com a checagem de ataque em **\`O(1)\`**.`,
      starter: `def total_n_rainhas(n):
    pass
`,
      tests: [
        { name: 'tabuleiro 4 × 4', expr: 'total_n_rainhas(4)', expected: '2' },
        { name: 'uma rainha sozinha', expr: 'total_n_rainhas(1)', expected: '1' },
        { name: 'n = 2: impossível', expr: 'total_n_rainhas(2)', expected: '0' },
        { name: 'n = 3: impossível', expr: 'total_n_rainhas(3)', expected: '0' },
        { name: 'n = 5', expr: 'total_n_rainhas(5)', expected: '10' },
        { expr: 'total_n_rainhas(6)', expected: '4', hidden: true },
        { expr: 'total_n_rainhas(7)', expected: '40', hidden: true },
        { expr: 'total_n_rainhas(8)', expected: '92', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 9',
          setup: 'n = 9',
          expr: 'total_n_rainhas(n)',
          expected: '352',
          maxMs: 200,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Poda linha a linha com checagem O(1)',
      reviews: [
        {
          when: m => m.calls.includes('permutations'),
          text: 'Gerar todas as `n!` permutações e só depois checar as diagonais é **gerar e testar**: com `n = 9` são 362.880 tabuleiros completos. Colocando uma rainha por linha e checando na hora, um ramo morre na primeira casa atacada, junto com todos os tabuleiros que começariam por ele.',
          concept: 'Poda',
        },
        {
          when: m => m.calls.includes('abs'),
          text: 'Conferir cada rainha anterior (`abs(l1 - l2) == abs(c1 - c2)`) custa `O(n)` por casa testada. Guarde três conjuntos — colunas, `linha - col` e `linha + col` — e a checagem vira `O(1)`: na mesma diagonal, uma dessas duas somas é constante.',
          concept: 'N-Rainhas',
        },
        {
          when: m => m.calls.includes('deepcopy'),
          text: 'Copiar o tabuleiro a cada nível custa `O(n²)` por chamada. O backtracking não precisa de cópias: marque a escolha, explore e **desfaça** a marcação ao voltar.',
          concept: 'Escolher/explorar/desfazer',
        },
      ],
      hints: [
        'Cada linha recebe **exatamente uma** rainha. Faça uma função recursiva `colocar(linha)` que tenta cada coluna dessa linha; quando `linha == n`, achou uma solução: devolva `1`.',
        'Duas casas estão na mesma diagonal ↘ quando `linha - col` é igual, e na mesma diagonal ↙ quando `linha + col` é igual. Guarde três conjuntos: `colunas`, `diag` e `anti`.',
        'Para cada coluna livre: adicione nos três conjuntos (escolher), some `colocar(linha + 1)` (explorar) e remova dos três (desfazer). Colunas atacadas são puladas com `continue` — essa é a poda.',
      ],
      solution: `def total_n_rainhas(n):
    colunas, diag, anti = set(), set(), set()

    def colocar(linha):
        if linha == n:
            return 1                             # todas as linhas preenchidas
        total = 0
        for col in range(n):
            if col in colunas or linha - col in diag or linha + col in anti:
                continue                         # poda: casa atacada
            colunas.add(col)                     # escolher
            diag.add(linha - col)
            anti.add(linha + col)
            total += colocar(linha + 1)          # explorar
            colunas.remove(col)                  # desfazer
            diag.remove(linha - col)
            anti.remove(linha + col)
        return total

    return colocar(0)
`,
      solutionExplanation: 'Decidir **uma linha por nível** elimina de graça os conflitos de linha; os três conjuntos respondem "coluna ou diagonal ocupada?" em `O(1)`, porque `linha - col` identifica a diagonal ↘ e `linha + col` a ↙. O pior caso é `O(n!)` (a cada linha sobra pelo menos uma coluna a menos), mas a poda corta a árvore muito antes: para `n = 9`, a busca visita alguns milhares de nós, contra 362.880 permutações completas na abordagem gerar-e-testar. Espaço: `O(n)` — a pilha de recursão e os três conjuntos.',
    },
    {
      type: 'order',
      id: 'lc-bt-q5',
      concept: 'Escolher/explorar/desfazer',
      say: 'Agora monte o molde de memória, na ordem em que ele executa.',
      prompt: 'Coloque os passos de **uma chamada** de `backtrack` na ordem em que acontecem.',
      items: [
        'Checar se o caminho atual já é uma solução completa (e guardar uma **cópia**)',
        'Percorrer os candidatos para a próxima posição',
        'Podar: pular o candidato que viola alguma restrição',
        'Escolher: aplicar o candidato ao estado (`caminho.append(x)`)',
        'Explorar: chamar `backtrack` para o próximo nível',
        'Desfazer: reverter o estado (`caminho.pop()`)',
      ],
      explanation: 'O caso base vem primeiro — senão a recursão continuaria depois da solução pronta. Dentro do laço, a **poda** acontece **antes** de escolher: assim o ramo inválido nem é criado. E o **desfazer** precisa espelhar exatamente o escolher (se marcou `usados[i]` e fez `append`, desmarque e faça `pop`); é isso que permite reutilizar um único estado em toda a busca.',
    },
    {
      type: 'open',
      id: 'lc-bt-q6',
      concept: 'Complexidade exponencial',
      say: 'Para fechar, o follow-up que sempre vem depois de um backtracking.',
      prompt: 'Você entregou um backtracking e o entrevistador provoca: "Sua solução é **exponencial**. Isso é aceitável? Como você justificaria e o que faria para deixá-la mais rápida?"',
      minWords: 30,
      rubric: [
        { label: 'A **saída** já é exponencial: listar todas as respostas não pode custar menos que o tamanho da resposta', keywords: ['saida', 'output', 'listar todas', 'todas as respostas', 'todas as solucoes', 'numero de solucoes', 'numero de respostas', 'tamanho da resposta', 'resposta e exponencial', 'resultado e exponencial', 'limite inferior'], concept: 'Complexidade exponencial', why: 'Se o enunciado pede todas as combinações, nenhum algoritmo escapa do tamanho da saída.' },
        { label: 'Olha as **restrições**: `n` pequeno (≤ 20 para `2ⁿ`, ≤ 10 para `n!`) torna a busca viável', keywords: ['restric', 'constraint', 'n pequeno', 'entrada pequena', 'n <=', 'n ≤', 'ate 20', 'ate 10', 'limite de n', 'poucos elementos', 'tamanho da entrada', 'pequen'], concept: 'Complexidade exponencial', why: 'Ler as restrições é o que diz se o exponencial cabe no tempo.' },
        { label: 'Acelera com **poda**: ordenar, cortar ramos inválidos cedo, *branch and bound*', keywords: ['poda', 'podar', 'prun', 'cortar', 'corta ', 'break', 'ordenar', 'ordena', 'descartar', 'branch and bound', 'bound', 'cedo'], concept: 'Poda', why: 'A poda não muda o pior caso, mas elimina a maior parte da árvore na prática.' },
        { label: 'Se basta **contar** ou **otimizar** e os subproblemas se repetem, troca por **programação dinâmica**/memoização', keywords: ['programacao dinamica', 'memoiz', 'memo', 'cache', 'subproblema', 'tabulac', 'contar', 'quantas formas'], concept: 'Backtracking', why: 'Listar exige backtracking; contar ou achar o melhor muitas vezes cabe numa DP polinomial.' },
      ],
      modelAnswer: `Depende do que o problema pede. Se é preciso **listar todas** as combinações, a própria **saída** é exponencial — são \`2ⁿ\` subconjuntos ou \`n!\` permutações —, então nenhum algoritmo pode ser mais rápido que o tamanho da resposta. Nesse caso, eu justificaria pelas **restrições**: com \`n ≤ 20\`, \`2ⁿ\` dá cerca de um milhão de nós, o que roda em tempo razoável; com \`n\` na casa dos milhares, eu nem tentaria.

Para acelerar na prática, uso **poda**: ordeno a entrada para poder dar \`break\` quando a soma estoura, corto cedo os ramos que violam restrições, pulo duplicatas no mesmo nível e, em problemas de otimização, uso *branch and bound* para descartar ramos que não superam a melhor resposta.

Por fim, se o enunciado pede só **contar** as formas ou achar o **mínimo**, e os mesmos subproblemas se repetem, eu trocaria o backtracking por **programação dinâmica** com memoização, que costuma ser polinomial.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! Backtracking é uma DFS na árvore de decisões: **escolher, explorar, desfazer** — e guardar sempre uma **cópia** da resposta.',
        { text: 'Leia as restrições para saber se o exponencial cabe e **pode** sem dó — do verbo podar. Na próxima aula, quando os subproblemas se repetem, a gente troca a busca por **programação dinâmica**. Até lá!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
