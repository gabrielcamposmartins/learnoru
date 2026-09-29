Game.registerModule('leetcode', {
  id: 'dynamic-programming',
  title: 'Programação Dinâmica',
  kind: 'lesson',
  level: 3,
  order: 41,
  unit: 'tecnicas',
  summary: 'Transforme recursões exponenciais em tabelas polinomiais: subproblemas sobrepostos, memoização com functools.cache, tabulação, coin change, distância de edição e o truque de guardar só duas linhas.',
  concepts: ['Programação dinâmica', 'Memoização × tabulação', 'Coin change', 'DP 2D (LCS/edição)', 'Otimização de espaço'],
  takeaways: [
    'Programação dinâmica é **recursão + reaproveitamento**: vale quando há **subproblemas sobrepostos** e **subestrutura ótima**. Sem sobreposição (como no merge sort), é só divisão e conquista, e o cache não ajuda.',
    '**Memoização** (top-down, `@functools.cache`) sai direto da recorrência e calcula só os estados alcançados — mas exige argumentos *hashable* e esbarra no limite de ~1.000 níveis de recursão. **Tabulação** (bottom-up) preenche a tabela em ordem, sem pilha.',
    'A receita: **estado** em palavras → **transição** (recorrência) → **casos base** → **ordem** de cálculo → onde está a **resposta**. No coin change, `dp[v] = 1 + min(dp[v - m])` — e o guloso falha com moedas `[1, 3, 4]`.',
    'Em DP 2D (LCS, distância de edição), `dp[i][j]` fala dos **prefixos** `a[:i]` e `b[:j]`, e o custo é `O(m·n)`. A ordem dos laços muda o que se conta: moedas por fora contam **combinações**; valor por fora, **sequências**.',
    'Se cada linha só depende da anterior, guarde **duas linhas** (ou duas variáveis): o espaço cai de `O(m·n)` para `O(n)`, ao preço de não conseguir reconstruir a resposta — a não ser com o algoritmo de Hirschberg.',
  ],
  glossary: [
    { term: 'Programação dinâmica', aliases: ['programacao dinamica', 'dynamic programming', 'DP'], definition: 'Técnica que resolve um problema combinando soluções de **subproblemas sobrepostos**, calculando cada um **uma única vez** (por memoização ou tabulação). O nome foi escolhido por Richard Bellman nos anos 1950.' },
    { term: 'Subproblemas sobrepostos', aliases: ['subproblema sobreposto', 'overlapping subproblems', 'sobreposição de subproblemas'], definition: 'Propriedade de uma recursão que resolve **os mesmos** subproblemas muitas vezes em ramos diferentes (como `fib(n - 2)` dentro de `fib(n)`). É o que faz o cache valer a pena.' },
    { term: 'Subestrutura ótima', aliases: ['subestrutura otima', 'optimal substructure'], definition: 'Propriedade de um problema cuja solução ótima é formada por soluções ótimas de subproblemas. Ex.: o troco mínimo para 11 é uma moeda + o troco mínimo para o que sobra.' },
    { term: 'Tabulação', aliases: ['tabulation', 'tabulacao'], definition: 'Forma **bottom-up** da programação dinâmica: preenche uma tabela dos menores subproblemas para os maiores, com laços, sem recursão. Permite otimizar o espaço guardando só as últimas linhas.' },
    { term: 'Distância de edição', aliases: ['distancia de edicao', 'distância de Levenshtein', 'Levenshtein', 'edit distance'], definition: 'Menor número de inserções, remoções e trocas de caractere para transformar uma string em outra (Levenshtein, 1965). Calculada por DP 2D em `O(m·n)`; usada em corretores ortográficos, `diff` e bioinformática.' },
    { term: 'Algoritmo de Hirschberg', aliases: ['Hirschberg'], definition: 'Algoritmo de 1975 que reconstrói a LCS (ou o alinhamento de duas strings) em espaço **linear**, mantendo tempo `O(m·n)`: combina a DP de duas linhas com divisão e conquista.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Chegou a técnica mais temida das entrevistas: **programação dinâmica**. Spoiler: ela é só recursão com boa memória.',
        'Vamos começar pelo exemplo que todo mundo já escreveu errado: Fibonacci recursivo.',
      ],
      board: {
        title: 'O problema: recalcular a mesma coisa milhões de vezes',
        md: `\`\`\`python
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
\`\`\`

\`\`\`text
                        fib(5)
                  /                \\
             fib(4)                 fib(3)      <- fib(3) calculado 2 vezes
            /      \\               /      \\
        fib(3)     fib(2)      fib(2)    fib(1)  <- fib(2) calculado 3 vezes
        /    \\     /    \\     /    \\
    fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
\`\`\`

\`fib(40)\` faz **331 milhões** de chamadas para calcular apenas **41** valores diferentes. O custo é \`O(φⁿ)\` ≈ \`O(1,618ⁿ)\`.

Programação dinâmica (DP) se aplica quando o problema tem **duas propriedades**:

| Propriedade | O que significa | Em Fibonacci |
|---|---|---|
| **Subproblemas sobrepostos** | a recursão resolve os **mesmos** subproblemas em ramos diferentes | \`fib(3)\` aparece várias vezes |
| **Subestrutura ótima** | a resposta se monta a partir das respostas dos subproblemas | \`fib(n)\` sai de \`fib(n - 1)\` e \`fib(n - 2)\` |

A solução: **calcular cada subproblema uma vez só** e guardar o resultado.

> [!atencao] Sem sobreposição não há DP: no **merge sort**, as duas metades são subproblemas **disjuntos**, resolvidos uma única vez cada. Isso é divisão e conquista; um cache ali só gasta memória.

> [!sabia] O nome "programação dinâmica" é quase uma cortina de fumaça. Richard Bellman contou que o escolheu nos anos 1950, na RAND, porque o Secretário de Defesa dos EUA, Charles Wilson, tinha "pavor patológico" da palavra *pesquisa*. "Programação" significava **planejamento** (como em programação linear), e "dinâmica" era, nas palavras dele, impossível de usar num sentido pejorativo. Nada a ver com programar computadores.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O jeito mais rápido de aplicar DP é a **memoização**: escreva a recursão normal e guarde cada resultado num cache.',
        'Em Python, isso é um decorator: `@functools.cache`. Mas ele tem três pegadinhas que caem em entrevista.',
      ],
      board: {
        title: 'Memoização (top-down) com functools.cache',
        md: `**Escadas** (LeetCode 70): de quantas formas dá para subir \`n\` degraus, 1 ou 2 por vez?

\`\`\`python
from functools import cache

def escadas(n):
    @cache                                # guarda o resultado de cada i
    def formas(i):                        # formas de chegar ao degrau i
        if i <= 1:
            return 1
        return formas(i - 1) + formas(i - 2)   # último passo: 1 ou 2 degraus
    return formas(n)
\`\`\`

Cada \`formas(i)\` roda **uma vez**; as outras chamadas são consultas ao cache. De \`O(φⁿ)\` para **\`O(n)\`**.

**As três pegadinhas:**

| Pegadinha | O que acontece | Como evitar |
|---|---|---|
| Argumento **não-hashable** | \`@cache def f(nums, i)\` com lista → \`TypeError: unhashable type: 'list'\` | deixe a lista **fora** (na closure) e passe só índices; ou converta para \`tuple\` |
| Cache **global** | um \`@cache\` no nível do módulo guarda resultados **entre chamadas** (memória crescendo, dados velhos) | decore uma função **interna**: o cache morre junto com a chamada; ou use \`f.cache_clear()\` |
| **Profundidade** de recursão | \`escadas(5000)\` → \`RecursionError\`: o Python para em ~1.000 níveis | tabulação (próximo quadro); \`sys.setrecursionlimit\` é só um curativo |

> [!dica] \`@cache\` (Python 3.9+) é o mesmo que \`@lru_cache(maxsize=None)\`. Um \`lru_cache\` com \`maxsize\` pequeno **descarta** resultados, e a recursão pode voltar a ser exponencial.

> [!sabia] É **memo**ização, não **memor**ização. O termo foi cunhado por Donald Michie em 1968, a partir de *memo* ("lembrete", "anotação"): a função deixa um bilhete para si mesma com a resposta.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'A outra forma é a **tabulação**: em vez de começar do problema grande e descer, você começa dos casos base e **sobe**, preenchendo uma tabela.',
        'Sem recursão, sem limite de pilha — e com uma ordem de cálculo que você controla.',
      ],
      board: {
        title: 'Tabulação (bottom-up)',
        md: `\`\`\`python
def escadas(n):
    dp = [0] * (n + 1)          # dp[i] = formas de chegar ao degrau i
    dp[0] = 1
    if n >= 1:
        dp[1] = 1
    for i in range(2, n + 1):   # ordem: do menor para o maior
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
\`\`\`

\`\`\`text
i:     0  1  2  3  4  5  6
dp:    1  1  2  3  5  8  13     cada célula lê as duas anteriores
\`\`\`

| | Memoização (top-down) | Tabulação (bottom-up) |
|---|---|---|
| Como escreve | recursão + \`@cache\` | laços + tabela |
| Ordem de cálculo | automática (a recursão decide) | **você** decide |
| Estados calculados | só os **alcançados** a partir do problema | **todos** da tabela |
| Limite de pilha | sim (~1.000 níveis em Python) | não |
| Custo constante | chamadas de função + hashing | acesso a lista, bem mais barato |
| Otimizar espaço | difícil | fácil: guarde só o que a próxima linha lê |

> [!dica] Em entrevista, um caminho seguro: escreva a **recorrência** em voz alta, implemente com \`@cache\` (rápido e difícil de errar) e, se o entrevistador pedir, converta para tabulação e otimize o espaço.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Todo problema de DP se resolve com a mesma receita de cinco passos. O mais importante é o primeiro: dizer **em palavras** o que `dp[i]` significa.',
        'Vamos aplicar no **house robber** — e já otimizar o espaço de `O(n)` para `O(1)`.',
      ],
      board: {
        title: 'A receita em 5 passos: house robber',
        md: `**House robber** (LeetCode 198): casas enfileiradas com dinheiro; roubar duas **vizinhas** dispara o alarme. Qual o máximo possível?

| Passo | House robber |
|---|---|
| 1. **Estado** (em palavras!) | \`dp[i]\` = maior valor usando só as \`i\` primeiras casas |
| 2. **Transição** | \`dp[i] = max(dp[i - 1], dp[i - 2] + casas[i - 1])\` — pula a casa \`i\` ou rouba e pula a vizinha |
| 3. **Casos base** | \`dp[0] = 0\` (nenhuma casa), \`dp[1] = casas[0]\` |
| 4. **Ordem** | \`i\` crescente: cada célula depende de células menores |
| 5. **Resposta** | \`dp[n]\` |

\`\`\`text
casas = [2, 7, 9, 3, 1]
i:     0   1   2   3    4    5
dp:    0   2   7   11   11   12      dp[3] = max(7, 2 + 9) = 11
\`\`\`

Cada \`dp[i]\` só olha para \`dp[i - 1]\` e \`dp[i - 2]\`. Então **duas variáveis bastam**:

\`\`\`python
def roubo_maximo(casas):
    anterior, atual = 0, 0          # melhor até i - 2 e melhor até i - 1
    for valor in casas:
        anterior, atual = atual, max(atual, anterior + valor)
    return atual
\`\`\`

Tempo \`O(n)\`, espaço **\`O(1)\`**.

> [!atencao] A transição precisa ser **completa**: toda solução ótima de \`dp[i]\` cai em um dos casos considerados (roubou ou não a casa \`i\`). Esquecer um caso é o bug mais comum de DP — os testes pequenos passam e a entrada grande falha.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora o **coin change**, talvez a DP mais cobrada em entrevista. A primeira ideia de quase todo mundo é gulosa: pegar sempre a maior moeda.',
        'E ela falha. Com moedas `[1, 3, 4]` e valor 6, o guloso dá `4 + 1 + 1`; o ótimo é `3 + 3`.',
      ],
      board: {
        title: 'Coin change: quando o guloso falha',
        md: `\`\`\`text
moedas = [1, 3, 4], valor = 6
guloso (maior moeda primeiro):  4 + 1 + 1  -> 3 moedas
ótimo:                          3 + 3      -> 2 moedas
\`\`\`

**Subestrutura ótima:** o troco mínimo de \`v\` é **uma** moeda \`m\` mais o troco mínimo de \`v - m\`. Tente todas as moedas:

\`\`\`text
dp[v] = 1 + min(dp[v - m])   para cada moeda m ≤ v
dp[0] = 0                    (troco de zero: nenhuma moeda)
dp[v] = ∞                    se nenhuma moeda chega em v

v:    0  1  2  3  4  5  6
dp:   0  1  2  1  1  2  2     dp[6] = 1 + min(dp[5], dp[3], dp[2]) = 1 + 1 = 2
\`\`\`

Custo: \`O(valor · k)\` para \`k\` moedas. A versão recursiva **sem** memo é exponencial: com \`[1, 2, 5]\` e valor 25 já são quase **um milhão** de chamadas.

**Variante — contar as formas** (LeetCode 518): mesma tabela, soma no lugar de mínimo.

\`\`\`python
def formas_de_troco(moedas, valor):
    dp = [1] + [0] * valor          # dp[v] = formas de somar v
    for m in moedas:                # a ORDEM destes laços importa…
        for v in range(m, valor + 1):
            dp[v] += dp[v - m]
    return dp[valor]
\`\`\`

(Já já você vai descobrir o que acontece se trocar os laços de lugar.)

> [!sabia] O guloso funciona para moedas reais como \`[1, 5, 10, 25, 50, 100]\` porque elas formam um **sistema de moedas canônico**. Nem todo sistema é: em 1994, Kozen e Zaks mostraram que, se o guloso falha para algum valor, o **menor** contraexemplo é menor que a soma das duas maiores moedas — dá para testar a canonicidade com uma DP pequena.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Quando o problema envolve **duas** sequências, o estado ganha duas dimensões: `dp[i][j]` fala do prefixo `a[:i]` e do prefixo `b[:j]`.',
        'Os dois clássicos são a **LCS** e a **distância de edição** — a base de ferramentas como `diff` e corretores ortográficos.',
      ],
      board: {
        title: 'DP 2D: LCS e distância de edição',
        md: `**LCS** (LeetCode 1143): tamanho da maior subsequência comum (não precisa ser contígua).

\`\`\`python
def lcs(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]    # dp[i][j]: LCS de a[:i] e b[:j]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1          # mesmo caractere: estende
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])   # descarta de um lado
    return dp[m][n]
\`\`\`

\`\`\`text
a = "abcde", b = "ace"          ""  a  c  e
                          ""     0  0  0  0
                          a      0  1  1  1
                          b      0  1  1  1
                          c      0  1  2  2
                          d      0  1  2  2
                          e      0  1  2  3    <- LCS = 3 ("ace")
\`\`\`

**Distância de edição** (LeetCode 72): menor número de inserções, remoções e trocas para transformar \`a\` em \`b\`.

\`\`\`text
dp[i][j] = distância entre a[:i] e b[:j]

se a[i-1] == b[j-1]:  dp[i][j] = dp[i-1][j-1]             nada a fazer
senão:                dp[i][j] = 1 + min(dp[i-1][j],      apagar a[i-1]
                                         dp[i][j-1],      inserir b[j-1]
                                         dp[i-1][j-1])    trocar a[i-1] por b[j-1]

casos base: dp[i][0] = i  (apagar tudo)      dp[0][j] = j  (inserir tudo)
\`\`\`

As duas custam **\`O(m·n)\`** de tempo. Sem memo, a recursão da distância de edição se ramifica em **três** a cada caractere diferente — exponencial.

> [!dica] Monte a tabela com **uma linha e uma coluna a mais** (a string vazia). Os casos base viram a primeira linha e a primeira coluna, e o índice \`i\` da tabela corresponde ao caractere \`a[i - 1]\`.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Último truque: **otimização de espaço**. Olhe a recorrência — a linha `i` só lê a linha `i - 1`.',
        'Então por que guardar a tabela inteira? Duas linhas bastam. O preço: você perde o "mapa" para reconstruir a resposta.',
      ],
      board: {
        title: 'Otimização de espaço (e quando não usar DP)',
        md: `\`\`\`python
def lcs(a, b):
    if len(b) > len(a):
        a, b = b, a                      # a linha fica com a string menor
    anterior = [0] * (len(b) + 1)        # linha i - 1
    for i in range(1, len(a) + 1):
        atual = [0] * (len(b) + 1)       # linha i
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                atual[j] = anterior[j - 1] + 1
            else:
                atual[j] = max(anterior[j], atual[j - 1])
        anterior = atual
    return anterior[-1]
\`\`\`

| Problema | Tabela completa | Otimizado |
|---|---|---|
| Escadas, house robber | \`O(n)\` | **\`O(1)\`** — duas variáveis |
| LCS, distância de edição | \`O(m·n)\` | **\`O(min(m, n))\`** — duas linhas |
| Mochila 0/1 | \`O(n·W)\` | \`O(W)\` — uma linha, percorrida de **trás para frente** |

**O preço:** para dizer **qual** é a subsequência (ou **quais** operações de edição), você caminha de volta pela tabela desde \`dp[m][n]\`. Com duas linhas, esse caminho se perdeu.

> [!sabia] Dá para ter os dois. O **algoritmo de Hirschberg** (1975) reconstrói a LCS em espaço **linear**: calcula a DP de duas linhas da esquerda para a direita e da direita para a esquerda, acha a coluna em que a resposta ótima cruza a linha do meio e resolve as duas metades recursivamente. O tempo continua \`O(m·n)\`. A mesma ideia é usada para alinhar sequências longas de DNA sem estourar a memória.

**Quando não usar DP:**
- Subproblemas **disjuntos** (merge sort, busca binária) → divisão e conquista.
- Existe uma escolha **gulosa** com prova (intervalos, moedas canônicas) → guloso, mais simples e mais rápido.
- É preciso **listar** todas as soluções → backtracking; DP serve para **contar** e **otimizar**.
- O estado não cabe na memória: \`dp\` com \`2ⁿ\` subconjuntos (caixeiro-viajante) só vale para \`n\` pequeno.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Sobreposição, coin change, recorrências, ordem dos laços e distância de edição.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-dp-q1',
      concept: 'Programação dinâmica',
      say: 'Primeiro, reconhecer quando DP ajuda. Esta separa quem decorou de quem entendeu.',
      prompt: 'Em qual destes problemas colocar `@cache` na recursão **não ajuda em nada**?',
      options: [
        { text: '`fib(n)` recursivo', why: '`fib(n - 2)` é recalculado dentro de `fib(n)` e de `fib(n - 1)`: subproblemas sobrepostos clássicos. O cache leva de `O(φⁿ)` para `O(n)`.' },
        { text: 'Contar os caminhos numa grade `m × n` andando só para a direita ou para baixo', why: 'A mesma célula `(i, j)` é alcançada por muitos caminhos diferentes, e `caminhos(i, j)` seria recalculado para cada um. Com cache, cai para `O(m·n)`.' },
        { text: 'Ordenar uma lista com merge sort', correct: true, why: 'Cada metade é um subproblema **disjunto**, resolvido uma única vez: nenhuma chamada se repete, então o cache nunca seria consultado. É divisão e conquista, não DP.' },
        { text: 'Distância de edição entre duas strings', why: 'O estado `(i, j)` é alcançado por várias sequências de operações (apagar e depois inserir, inserir e depois apagar…). Sem cache, a recursão é exponencial; com cache, `O(m·n)`.' },
      ],
      explanation: 'DP exige **subproblemas sobrepostos**: a mesma pergunta feita várias vezes em ramos diferentes da recursão. No merge sort, `ordenar(lista[:meio])` e `ordenar(lista[meio:])` tratam de pedaços que nunca se repetem — a árvore de recursão não tem nós iguais. Pergunta útil para reconhecer DP: "se eu desenhar a árvore de chamadas, aparecem **argumentos repetidos**?" Se sim, memoize; se não, o cache só gasta memória.',
    },
    {
      type: 'code',
      id: 'lc-dp-q2',
      concept: 'Coin change',
      title: 'Coin Change',
      say: 'LeetCode 322. Cuidado com o guloso — e com a profundidade da recursão.',
      prompt: `Implemente \`menor_troco(moedas, valor)\` que devolve o **menor número de moedas** que somam exatamente \`valor\`, ou \`-1\` se for impossível. Cada moeda pode ser usada **quantas vezes quiser**.

- \`moedas\` são inteiros positivos distintos; \`valor ≥ 0\` (e \`menor_troco(moedas, 0)\` é \`0\`).
- \`menor_troco([1, 2, 5], 11)\` → \`3\` (\`5 + 5 + 1\`)
- \`valor\` pode chegar a **10.000** (com moeda de 1!) — escolha a técnica pensando nisso.
- Objetivo: **\`O(valor · k)\`** para \`k\` moedas.`,
      starter: `def menor_troco(moedas, valor):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'menor_troco([1, 2, 5], 11)', expected: '3' },
        { name: 'o guloso falha aqui', expr: 'menor_troco([1, 3, 4], 6)', expected: '2' },
        { name: 'impossível', expr: 'menor_troco([2], 3)', expected: '-1' },
        { name: 'valor zero', expr: 'menor_troco([1], 0)', expected: '0' },
        { name: 'todas as moedas maiores que o valor', expr: 'menor_troco([5, 10], 3)', expected: '-1' },
        { expr: 'menor_troco([2, 5, 10, 1], 18)', expected: '4', hidden: true },
        { expr: 'menor_troco([3, 7], 11)', expected: '-1', hidden: true },
        { expr: 'menor_troco([1, 5, 6, 9], 11)', expected: '2', hidden: true },
        { expr: 'menor_troco([7], 14)', expected: '2', hidden: true },
        { expr: 'menor_troco([4, 9], 17)', expected: '3', hidden: true },
      ],
      perfTests: [
        {
          name: 'moedas [1, 2, 5], valor 25',
          setup: 'moedas = [1, 2, 5]',
          expr: 'menor_troco(moedas, 25)',
          expected: '5',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Subproblemas sobrepostos — cada valor calculado uma vez',
      reviews: [
        {
          when: m => m.recursion,
          text: 'A memoização resolve os subproblemas repetidos, mas a pilha chega a `valor / menor moeda` níveis: com `valor = 10.000` e moeda de 1, são 10.000 chamadas aninhadas e o Python estoura `RecursionError` perto de 1.000. A **tabulação** (`for v in range(1, valor + 1)`) tem o mesmo custo e nenhuma pilha.',
          concept: 'Memoização × tabulação',
        },
        {
          when: (m, code) => /\[\s*\w+\s*-\s*\w+\s*\]\s*\+\s*\[/.test(code),
          text: 'Guardar a **lista** de moedas em cada `dp[v]` (`dp[v - m] + [m]`) copia listas a cada transição e ocupa `O(valor · resposta)` de memória. Guarde só a **contagem**; se precisar mostrar as moedas, mantenha um vetor `ultima[v]` com a moeda escolhida e reconstrua andando para trás a partir de `valor`.',
          concept: 'Otimização de espaço',
        },
      ],
      hints: [
        'O guloso (maior moeda primeiro) falha em `[1, 3, 4]` com valor 6. Defina o estado: `dp[v]` = menor número de moedas que somam `v`.',
        'Transição: `dp[v] = 1 + min(dp[v - m])` para cada moeda `m ≤ v`. Caso base `dp[0] = 0`; valores inalcançáveis ficam com "infinito" (`float("inf")` ou `valor + 1`, já que nenhuma resposta passa de `valor` moedas).',
        'Preencha de `v = 1` até `valor` com laços, sem recursão (nada de `RecursionError` com valor 10.000). No fim, se `dp[valor]` continuar "infinito", devolva `-1`.',
      ],
      solution: `def menor_troco(moedas, valor):
    infinito = valor + 1                 # nenhuma resposta usa mais que valor moedas
    dp = [0] + [infinito] * valor        # dp[v] = menor nº de moedas que somam v
    for v in range(1, valor + 1):
        for m in moedas:
            if m <= v and dp[v - m] + 1 < dp[v]:
                dp[v] = dp[v - m] + 1    # uma moeda m + o melhor troco de v - m
    return dp[valor] if dp[valor] != infinito else -1
`,
      solutionExplanation: 'Cada `dp[v]` é calculado **uma vez**, olhando `k` moedas: **tempo `O(valor · k)`**, **espaço `O(valor)`**, sem recursão. O "infinito" `valor + 1` funciona porque a pior resposta possível usa `valor` moedas de 1; qualquer coisa acima disso significa "inalcançável". A recursão sem memo faz a mesma conta repetidas vezes: `troco(20)` aparece tanto depois de `5` quanto depois de `2 + 2 + 1`, e o número de chamadas cresce exponencialmente com o valor — o teste de desempenho, com valor 25, já custa quase um milhão de chamadas.',
    },
    {
      type: 'match',
      id: 'lc-dp-q3',
      concept: 'Programação dinâmica',
      say: 'Rapidinho: cada problema com a sua recorrência.',
      prompt: 'Associe cada problema à recorrência que o resolve.',
      pairs: [
        { left: 'Escadas (sobe 1 ou 2 degraus)', right: '`f(i) = f(i-1) + f(i-2)`' },
        { left: 'House robber', right: '`f(i) = max(f(i-1), f(i-2) + v[i])`' },
        { left: 'Coin change (menos moedas)', right: '`f(v) = 1 + min(f(v - m))` para cada moeda `m`' },
        { left: 'LCS (maior subsequência comum)', right: '`f(i-1, j-1) + 1` se iguais; senão `max(f(i-1, j), f(i, j-1))`' },
        { left: 'Distância de edição', right: '`f(i-1, j-1)` se iguais; senão `1 + min(apagar, inserir, trocar)`' },
      ],
      explanation: 'Reconhecer a **recorrência** é 80% de uma DP. Escadas **somam** (contam formas), house robber e LCS tomam o **máximo** (otimizam ganho), coin change e distância de edição tomam o **mínimo** (otimizam custo). Os problemas com uma sequência têm estado `f(i)`; os que comparam duas sequências têm estado `f(i, j)`, sobre os prefixos de cada uma.',
    },
    {
      type: 'mcq',
      id: 'lc-dp-q4',
      concept: 'Coin change',
      say: 'Lembra do "a ordem dos laços importa"? Chegou a hora.',
      prompt: `Este código é o \`formas_de_troco\` do quadro com os laços **trocados** — valor por fora, moedas por dentro:

\`\`\`python
def formas(moedas, valor):
    dp = [1] + [0] * valor
    for v in range(1, valor + 1):        # valor POR FORA
        for m in moedas:
            if m <= v:
                dp[v] += dp[v - m]
    return dp[valor]
\`\`\`

Quanto vale \`formas([1, 2], 3)\`?`,
      options: [
        { text: '`2` — as combinações `{1, 1, 1}` e `{1, 2}`', why: 'Esse é o resultado com as **moedas por fora** (LeetCode 518). Aqui, para cada valor `v` o laço tenta todas as moedas como "a última", então a ordem das moedas passa a contar.' },
        { text: '`3` — conta `1+1+1`, `1+2` e `2+1` como formas diferentes', correct: true, why: '`dp[3] = dp[2] + dp[1] = 2 + 1`: terminar em 1 (depois de `1+1` ou `2`) ou terminar em 2 (depois de `1`). São **sequências**, então `1+2` e `2+1` contam separado.' },
        { text: '`4` — conta também `2+2`, que passa do valor', why: 'O `if m <= v` só usa `dp[v - m]` com índice válido, e `dp[v]` só soma formas que fecham exatamente `v`. Nada passa do valor.' },
        { text: 'Dá `IndexError`, porque `v - m` pode ficar negativo', why: 'O `if m <= v` garante `v - m ≥ 0`.' },
      ],
      explanation: 'A ordem dos laços define **o que** se conta. Com as **moedas por fora**, cada moeda é "liberada" uma vez, em ordem, e toda forma é montada com as moedas numa ordem fixa: conta **combinações** (LeetCode 518, *Coin Change II*). Com o **valor por fora**, para cada `v` qualquer moeda pode ser a última: conta **sequências** (LeetCode 377, *Combination Sum IV*). Mesmos dados, mesma recorrência, respostas diferentes — por isso vale sempre dizer o estado em palavras.',
    },
    {
      type: 'code',
      id: 'lc-dp-q5',
      concept: 'DP 2D (LCS/edição)',
      title: 'Edit Distance',
      say: 'LeetCode 72, com um bônus de entrevista sênior: espaço de duas linhas.',
      prompt: `Implemente \`distancia_edicao(a, b)\` que devolve o **menor número de operações** para transformar a string \`a\` na string \`b\`. As operações permitidas, cada uma custando 1, são:
- **inserir** um caractere;
- **apagar** um caractere;
- **trocar** um caractere por outro.

Exemplo: \`distancia_edicao("horse", "ros")\` → \`3\` (horse → rorse → rose → ros).

Objetivo: tempo **\`O(m·n)\`** e espaço extra **\`O(n)\`** — guarde só duas linhas da tabela.`,
      starter: `def distancia_edicao(a, b):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'distancia_edicao("horse", "ros")', expected: '3' },
        { name: 'intention → execution', expr: 'distancia_edicao("intention", "execution")', expected: '5' },
        { name: 'origem vazia', expr: 'distancia_edicao("", "abc")', expected: '3' },
        { name: 'destino vazio', expr: 'distancia_edicao("abc", "")', expected: '3' },
        { name: 'as duas vazias', expr: 'distancia_edicao("", "")', expected: '0' },
        { name: 'strings iguais', expr: 'distancia_edicao("python", "python")', expected: '0' },
        { expr: 'distancia_edicao("kitten", "sitting")', expected: '3', hidden: true },
        { expr: 'distancia_edicao("flaw", "lawn")', expected: '2', hidden: true },
        { expr: 'distancia_edicao("sunday", "saturday")', expected: '3', hidden: true },
        { expr: 'distancia_edicao("a", "b")', expected: '1', hidden: true },
        { expr: 'distancia_edicao("ab", "ba")', expected: '2', hidden: true },
      ],
      perfTests: [
        {
          name: '"backtrack" → "memoizado"',
          setup: 'a, b = "backtrack", "memoizado"',
          expr: 'distancia_edicao(a, b)',
          expected: '8',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'DP 2D — cada par (i, j) calculado uma vez',
      reviews: [
        {
          when: (m, code) => /\[\s*\[/.test(code) || /\[\s*list\s*\(/.test(code),
          text: 'A tabela `(m + 1) × (n + 1)` inteira ocupa `O(m·n)` de memória, mas a linha `i` só lê a linha `i - 1`. Guarde `anterior` e `atual` e o espaço cai para `O(n)`. (A tabela completa só se justifica se você precisar **reconstruir** as operações.)',
          concept: 'Otimização de espaço',
        },
        {
          when: m => m.recursion || m.decorators.includes('cache') || m.decorators.includes('lru_cache'),
          text: 'Memoização top-down resolve, mas guarda `O(m·n)` resultados no cache e empilha até `m + n` chamadas — com strings de milhares de caracteres, `RecursionError`. A tabulação linha a linha usa `O(n)` de espaço e nenhuma pilha.',
          concept: 'Memoização × tabulação',
        },
      ],
      hints: [
        'Estado: `dp[i][j]` = distância entre os prefixos `a[:i]` e `b[:j]`. Casos base: `dp[i][0] = i` (apagar tudo) e `dp[0][j] = j` (inserir tudo).',
        'Se `a[i - 1] == b[j - 1]`, `dp[i][j] = dp[i - 1][j - 1]`. Senão, `1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])` — apagar, inserir, trocar.',
        'A linha `i` só usa a linha `i - 1`: comece com `anterior = list(range(len(b) + 1))`; a cada `i`, crie `atual` com `atual[0] = i`, preencha e faça `anterior = atual`. A resposta fica em `anterior[-1]`.',
      ],
      solution: `def distancia_edicao(a, b):
    m, n = len(a), len(b)
    anterior = list(range(n + 1))            # linha 0: transformar "" em b[:j] = j inserções
    for i in range(1, m + 1):
        atual = [i] + [0] * n                # coluna 0: apagar os i caracteres de a[:i]
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                atual[j] = anterior[j - 1]   # mesmo caractere: nada a fazer
            else:
                atual[j] = 1 + min(anterior[j],       # apagar a[i - 1]
                                   atual[j - 1],      # inserir b[j - 1]
                                   anterior[j - 1])   # trocar
        anterior = atual
    return anterior[n]
`,
      solutionExplanation: 'São `(m + 1)·(n + 1)` estados, cada um calculado em `O(1)`: **tempo `O(m·n)`**. Como a linha `i` só lê a linha `i - 1` (`anterior`) e a própria linha à esquerda (`atual[j - 1]`), duas listas bastam: **espaço `O(n)`** — trocando `a` e `b` quando `b` é maior, `O(min(m, n))`. A recursão sem memo se ramifica em três a cada caractere diferente e revisita os mesmos pares `(i, j)` por caminhos diferentes: no teste de desempenho, com 9 caracteres de cada lado, são mais de 1,4 milhão de chamadas para só 100 estados distintos.',
    },
    {
      type: 'open',
      id: 'lc-dp-q6',
      concept: 'Memoização × tabulação',
      say: 'Para fechar, o follow-up clássico. Pense em voz alta.',
      prompt: 'Você resolveu um problema com `@cache` e o entrevistador pergunta: "Por que memoização e não tabulação? Quando você escolheria cada uma?"',
      minWords: 30,
      rubric: [
        { label: 'Memoização: **top-down**, sai direto da recorrência e calcula só os estados **alcançados**', keywords: ['top-down', 'top down', 'de cima para baixo', 'direto da recorrencia', 'traduz a recorrencia', 'natural', 'mais facil de escrever', 'mais simples de escrever', 'so os estados', 'apenas os estados', 'estados necessarios', 'estados alcanc', 'sob demanda', 'preguic', 'lazy'], concept: 'Memoização × tabulação', why: 'É a forma mais rápida de sair da recorrência para um código correto, e pula estados que nunca são usados.' },
        { label: 'Limitação da memoização: **limite de recursão**/pilha e custo das chamadas', keywords: ['recursionerror', 'limite de recurs', '1000 niveis', '1.000 niveis', 'pilha', 'stack', 'profundidade', 'setrecursionlimit', 'overhead', 'custo das chamadas', 'custo de chamada', 'chamadas de funcao'], concept: 'Memoização × tabulação', why: 'Em Python, a recursão para em ~1.000 níveis e cada chamada custa mais que um acesso a lista.' },
        { label: 'Tabulação: **bottom-up**, iterativa, com a ordem de cálculo explícita', keywords: ['bottom-up', 'bottom up', 'de baixo para cima', 'iterativ', 'laco', 'loop', 'ordem de calculo', 'ordem de preenchimento', 'preenche a tabela', 'preencher a tabela'], concept: 'Memoização × tabulação', why: 'Sem recursão, sem pilha, e você controla em que ordem os estados são calculados.' },
        { label: 'Tabulação permite **otimizar o espaço** (duas linhas / duas variáveis)', keywords: ['espaco', 'memoria', 'duas linhas', 'duas variaveis', 'rolling', 'o(1)', 'linha anterior', 'descartar', 'descarta'], concept: 'Otimização de espaço', why: 'Com a ordem explícita, dá para jogar fora as linhas que ninguém vai ler de novo.' },
      ],
      modelAnswer: `Eu começo com **memoização** porque ela é **top-down** e sai direto da recorrência: escrevo a função recursiva, coloco \`@cache\` e pronto — fica fácil de acertar e de explicar. Ela também calcula **só os estados alcançados** a partir do problema original, o que ajuda quando boa parte da tabela nunca seria usada.

A limitação é a **pilha**: em Python, a recursão estoura \`RecursionError\` perto de 1.000 níveis de profundidade, e cada chamada de função tem um custo maior que acessar uma lista. Se a entrada pode ter 10.000 níveis, a memoização quebra.

Aí eu escolho **tabulação**: é **bottom-up**, iterativa, com a ordem de cálculo explícita — preencho a tabela dos casos base até a resposta, sem recursão. E, como sei exatamente quais células cada passo lê, posso **otimizar o espaço**: guardar só **duas linhas** da tabela, ou **duas variáveis** em problemas como escadas e house robber, levando o espaço de \`O(n)\` para \`O(1)\`.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! DP é recursão que não repete trabalho: ache os **subproblemas sobrepostos**, diga o estado em palavras, escreva a recorrência e escolha entre **`@cache`** e **tabela**.',
        { text: 'E quando a linha só olha para a anterior, jogue o resto fora: duas linhas bastam. Bellman ficaria orgulhoso — e o Secretário de Defesa nem desconfiaria. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
