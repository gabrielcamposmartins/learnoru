Game.registerModule('leetcode', {
  id: 'bit-manipulation',
  title: 'Manipulação de Bits',
  kind: 'lesson',
  level: 2,
  order: 42,
  unit: 'tecnicas',
  summary: 'Operadores bit a bit em Python, XOR para achar o único, o truque de Kernighan, potências de dois e subconjuntos como máscaras de bits.',
  concepts: ['Operadores bit a bit', 'XOR', 'Truque de Kernighan', 'Bitmask', 'Contar por bit'],
  takeaways: [
    'Em Python, inteiros **não têm limite de bits**: negativos agem como complemento de dois com infinitos 1s à esquerda. Para imitar 32 bits, aplique a máscara `& 0xFFFFFFFF`.',
    '`x ^ x == 0` e `x ^ 0 == x`: fazendo o XOR de tudo, os pares se **anulam** e sobra o único — `O(n)` de tempo e `O(1)` de memória.',
    '`n & (n - 1)` **apaga** o bit 1 mais baixo (truque de Kernighan) e `n & -n` o **isola**. Potência de dois: `n > 0 and n & (n - 1) == 0`.',
    'Um inteiro de `n` bits é um **subconjunto** de `n` itens: `range(1 << n)` enumera os `2ⁿ`, e `mask >> i & 1` diz se o item `i` está dentro.',
    'Pense **por bit, não por par**: contar quantos números têm cada bit ligado transforma somas sobre `O(n²)` pares em `O(n · bits)`.',
  ],
  glossary: [
    { term: 'Complemento de dois', aliases: ['complemento a dois', "two's complement", 'complemento de 2'], definition: 'Representação de inteiros negativos em que `-x` é `~x + 1` (inverter os bits e somar 1). Em Python o inteiro não tem tamanho fixo: um negativo age como se tivesse **infinitos** bits 1 à esquerda.' },
    { term: 'Truque de Kernighan', aliases: ['truque de Brian Kernighan', 'algoritmo de Kernighan', 'Brian Kernighan'], definition: '`n & (n - 1)` apaga o bit 1 mais baixo de `n`. Repetir até zerar conta os bits ligados em `O(bits ligados)`, em vez de `O(total de bits)`.' },
    { term: 'Popcount', aliases: ['population count', 'Hamming weight', 'peso de Hamming'], definition: 'Número de bits 1 de um inteiro. Em Python 3.10+, `n.bit_count()` — que conta os bits do valor **absoluto**. Muitas CPUs têm uma instrução só para isso (`POPCNT`).' },
    { term: 'Bitmask', aliases: ['bitmasks', 'máscara de bits', 'máscaras de bits'], definition: 'Inteiro usado como **conjunto**: o bit `i` ligado significa "o item `i` está presente". União é `|`, interseção é `&` e pertinência é `mask >> i & 1`.' },
    { term: 'Distância de Hamming', aliases: ['distâncias de Hamming', 'Hamming distance'], definition: 'Número de posições em que dois valores diferem. Para inteiros, `(a ^ b).bit_count()`: o XOR liga exatamente os bits diferentes.' },
    { term: "Gosper's hack", aliases: ['truque de Gosper', 'hack de Gosper'], definition: 'Fórmula de Bill Gosper (HAKMEM, MIT, 1972) que, dada uma máscara com `k` bits ligados, calcula a **próxima** máscara maior com os mesmos `k` bits — enumera as combinações de tamanho `k` sem gerar as outras.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje a gente desce ao nível dos **bits**. Parece coisa de programador de C, mas cai em entrevista — e rende soluções lindas de `O(1)` de memória.',
        'Primeiro, os operadores. Em Python eles funcionam sobre inteiros comuns, com uma surpresa que vem logo depois.',
      ],
      board: {
        title: 'Operadores bit a bit em Python',
        md: `\`\`\`python
a, b = 0b1100, 0b1010     # 12 e 10

a & b      # 0b1000   E (AND): ligado nos DOIS
a | b      # 0b1110   OU (OR): ligado em ALGUM
a ^ b      # 0b0110   OU exclusivo (XOR): ligado em SÓ UM
~a         # -13      NÃO (NOT): em Python, ~x == -x - 1
a << 2     # 48       desloca à esquerda: multiplica por 2**2
a >> 2     # 3        desloca à direita: divide por 2**2, arredondando para baixo
\`\`\`

Ferramentas de conversão e contagem:

\`\`\`python
bin(11)             # '0b1011'
int("1011", 2)      # 11
f"{5:08b}"          # '00000101'  (8 dígitos, com zeros à esquerda)
(255).bit_length()  # 8           (quantos bits para representar)
(0b1011).bit_count()  # 3         (bits ligados; Python 3.10+)
\`\`\`

> [!dica] Bit \`i\` = potência \`2**i\`, contando do **0**, da **direita** para a esquerda. Em \`0b1011\`, os bits ligados são 0, 1 e 3.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'A surpresa: em C ou Java, um `int` tem 32 bits e **estoura**. Em Python, o inteiro cresce o quanto precisar.',
        'Isso é ótimo para contas, mas muda o comportamento dos negativos — e quebra código portado de outras linguagens.',
      ],
      board: {
        title: 'Inteiros sem limite (e o que isso muda)',
        md: `\`\`\`python
1 << 100       # 1267650600228229401496703205376 — sem overflow
~5             # -6: inverter os bits é -x - 1
-8 >> 1        # -4: desloca "puxando" 1s (divisão arredondando para baixo)
bin(-5)        # '-0b101' — bin mostra sinal + magnitude, não os bits reais
-5 & 0xFF      # 251: os 8 bits de baixo do complemento de dois
\`\`\`

Os negativos agem como **complemento de dois com infinitos 1s à esquerda**:

\`\`\`text
 5  =  ...0000 0101
-5  =  ...1111 1011      (~5 + 1)
\`\`\`

Para portar código que **depende** de 32 bits (hashes, LeetCode 190 e 371), aplique a máscara e reinterprete o sinal:

\`\`\`python
MASCARA = 0xFFFFFFFF

def para_int32(x):
    x &= MASCARA
    return x - (1 << 32) if x >= 1 << 31 else x

para_int32(2**31)      # -2147483648, como em Java
\`\`\`

> [!atencao] Um laço como \`while n: n >>= 1\` **nunca termina** com \`n\` negativo em Python: \`-1 >> 1\` continua valendo \`-1\`. Trate o sinal antes — ou aplique a máscara.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora o operador mais querido das entrevistas: o **XOR**. Ele tem uma propriedade mágica — um valor repetido se cancela.',
        'Com isso, "ache o número que não tem par" vira uma linha, sem memória extra.',
      ],
      board: {
        title: 'XOR: os pares se anulam',
        md: `| Propriedade | Consequência |
|---|---|
| \`x ^ x == 0\` | um valor repetido se cancela |
| \`x ^ 0 == x\` | zero é neutro |
| comutativo e associativo | a ordem não importa |

**Single Number** (LeetCode 136): todo valor aparece duas vezes, exceto um. Ache-o com \`O(1)\` de memória:

\`\`\`python
from functools import reduce
from operator import xor

def unico(nums):
    return reduce(xor, nums, 0)

unico([4, 1, 2, 1, 2])     # 4, porque 4 ^ (1 ^ 1) ^ (2 ^ 2) = 4 ^ 0 ^ 0
\`\`\`

Outros clássicos do mesmo truque:

- **Número que falta** em \`0..n\` (LeetCode 268): XOR de todos os índices com todos os valores — só o que falta fica sem par.
- **Trocar duas variáveis** sem auxiliar: \`a ^= b; b ^= a; a ^= b\`. Curiosidade de C; em Python, use \`a, b = b, a\`.

> [!dica] Com \`set\` ou \`Counter\` também dá, mas com \`O(n)\` de memória. Em entrevista, o follow-up costuma ser justamente: "e com memória constante?".`,
      },
    },
    {
      type: 'say',
      text: [
        'Próximo truque: `n & (n - 1)`. Subtrair 1 inverte o bit 1 mais baixo e todos os zeros à direita dele.',
        'O `&` com o original apaga **exatamente** esse bit. Daí saem contagem de bits, potência de dois e mais.',
      ],
      board: {
        title: 'O truque de Kernighan',
        md: `\`\`\`text
n           = 0b1011000
n - 1       = 0b1010111
n & (n - 1) = 0b1010000      <- o 1 mais baixo sumiu
\`\`\`

\`\`\`python
def conta_bits(n):              # n >= 0; uma volta por bit LIGADO
    c = 0
    while n:
        n &= n - 1
        c += 1
    return c

def potencia_de_dois(n):
    return n > 0 and n & (n - 1) == 0     # exatamente um bit ligado

0b1011000 & -0b1011000        # 0b1000: n & -n ISOLA o bit 1 mais baixo
\`\`\`

- \`conta_bits(0b1011000)\` dá 3 voltas; o laço ingênuo com \`n >>= 1\` daria 7 (uma por bit).
- No dia a dia, use \`n.bit_count()\` (Python 3.10+), que conta em C. O truque vale pela ideia — e pelas entrevistas.

> [!sabia] O "truque de Kernighan" não é do Kernighan: Peter Wegner o publicou em 1960, e Derrick Lehmer o redescobriu em 1964. Ficou com o nome de Brian Kernighan porque aparece como exercício no livro *The C Programming Language* (o "K&R"). E o irmão dele, \`n & -n\`, é o coração da **Fenwick tree**: é ele que acha o próximo índice a visitar.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora o uso mais poderoso: um inteiro como **conjunto**. Com `n` itens, cada número de `0` a `2ⁿ - 1` é um subconjunto diferente.',
        'O bit `i` ligado quer dizer "o item `i` está dentro". Enumerar subconjuntos vira um `for` simples.',
      ],
      board: {
        title: 'Subconjuntos como máscaras',
        md: `\`\`\`text
itens = ['a', 'b', 'c']               bit:  2 1 0
mask = 0b000  ->  []                        0 0 0
mask = 0b101  ->  ['a', 'c']                1 0 1   (bit 0 = 'a', bit 2 = 'c')
mask = 0b111  ->  ['a', 'b', 'c']           1 1 1
\`\`\`

\`\`\`python
def subconjuntos(itens):
    n = len(itens)
    return [[itens[i] for i in range(n) if mask >> i & 1]
            for mask in range(1 << n)]

subconjuntos(['a', 'b', 'c'])
# [[], ['a'], ['b'], ['a', 'b'], ['c'], ['a', 'c'], ['b', 'c'], ['a', 'b', 'c']]
\`\`\`

Operações de conjunto com máscaras:

\`\`\`python
mask >> i & 1          # contém o item i?
mask | (1 << i)        # adiciona i
mask & ~(1 << i)       # remove i
mask ^ (1 << i)        # alterna i
mask.bit_count()       # tamanho do conjunto
a & b == 0             # conjuntos disjuntos?

s = m                  # todos os submasks de m (exceto o vazio):
while s:
    ...                # usa s
    s = (s - 1) & m
\`\`\`

- Custo de enumerar: \`O(n · 2ⁿ)\` — só viável até uns 20 itens. É a mesma ordem do backtracking, sem recursão.
- Máscaras também são **conjuntos pequenos e rápidos**: as 26 letras cabem num inteiro, e "duas palavras sem letras em comum" vira \`m1 & m2 == 0\`.

> [!sabia] Para enumerar só os subconjuntos de tamanho \`k\`, existe o **Gosper's hack** (HAKMEM, MIT, 1972): a partir de uma máscara \`x\` com \`k\` bits, \`c = x & -x\`, \`r = x + c\` e \`prox = (((r ^ x) >> 2) // c) | r\` dão a próxima máscara maior com os mesmos \`k\` bits.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Para fechar: quando usar — e as armadilhas que derrubam até gente experiente.',
        'A pior delas é de **precedência**, e em Python ela é o contrário de C.',
      ],
      board: {
        title: 'Quando usar (e armadilhas)',
        md: `| Situação | Técnica |
|---|---|
| Achar o valor que aparece um número **ímpar** de vezes | XOR de tudo |
| Contar bits ligados | \`n.bit_count()\` (ou Kernighan) |
| Testar potência de dois | \`n > 0 and n & (n - 1) == 0\` |
| Enumerar subconjuntos de até uns 20 itens | \`for mask in range(1 << n)\` |
| Conjunto pequeno (letras, até dezenas de flags) | Bitmask em vez de \`set\` |
| Somas ou distâncias sobre **todos os pares** | Contar **por bit**: \`uns * (n - uns)\` |

Armadilhas:

- **Precedência:** em Python, \`&\`, \`|\` e \`^\` ligam **mais forte** que \`==\`: \`n & 1 == 0\` é \`(n & 1) == 0\`. Em C é o contrário! Já \`+\` e \`-\` ligam mais forte que \`<<\` e \`&\`: \`1 << n - 1\` é \`1 << (n - 1)\`. Na dúvida, parênteses.
- **Negativos:** \`bit_count()\` conta os bits do valor **absoluto** — \`(-4).bit_count() == 1\` — e \`>>\` num negativo nunca chega a zero.
- **Legibilidade:** \`x & 1\` para paridade é idiomático; truques obscuros em código de negócio merecem um comentário — ou um \`set\`.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Potência de dois, XOR, máscaras e contagem por bit.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-bit-q1',
      concept: 'Truque de Kernighan',
      say: 'Aquecimento: potência de dois, com casos de borda.',
      prompt: 'Qual expressão devolve `True` **exatamente** quando o inteiro `n` — qualquer inteiro do Python, inclusive zero ou negativo — é uma potência de dois (`1, 2, 4, 8, …`)?',
      options: [
        { text: '`n & (n - 1) == 0`', why: 'Quase: com `n = 0` dá `0 & -1 == 0`, ou seja, `True` — e zero não é potência de dois.' },
        { text: '`n > 0 and n & (n - 1) == 0`', correct: true, why: 'Positivo e com um único bit ligado. Em Python, `&` liga mais forte que `==`, então não faltam parênteses.' },
        { text: '`n.bit_count() == 1`', why: '`bit_count()` conta os bits do valor **absoluto**: `(-4).bit_count() == 1`, e `-4` não é potência de dois.' },
        { text: '`n % 2 == 0`', why: 'Isso testa se o número é **par**: `6` passa, e `1` (que é `2⁰`) não.' },
      ],
      explanation: 'Potência de dois positiva = **exatamente um bit ligado**. Como `n & (n - 1)` apaga o bit 1 mais baixo, sobrar zero significa que havia só um; o `n > 0` elimina o zero e os negativos. Detalhe de linguagem: em Python, os operadores bit a bit têm precedência **maior** que as comparações. Em C, `n & (n - 1) == 0` compararia primeiro — um bug clássico.',
    },
    {
      type: 'code',
      id: 'lc-bit-q2',
      concept: 'XOR',
      title: 'Single Number III',
      say: 'Agora são dois únicos em vez de um. O XOR sozinho não basta... ou basta?',
      prompt: `Em \`nums\`, **exatamente dois** valores aparecem uma única vez, e todos os outros aparecem **exatamente duas** vezes.

Implemente \`dois_unicos(nums)\` que devolve uma lista com os dois valores únicos, em qualquer ordem.

- Os números podem ser negativos ou enormes (inteiros do Python).
- Objetivo: **\`O(n)\` de tempo e \`O(1)\` de memória extra** — sem \`set\`, \`dict\` ou \`Counter\`.`,
      starter: `def dois_unicos(nums):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'dois_unicos([1, 2, 1, 3, 2, 5])', expected: '[3, 5]', compare: 'sorted' },
        { name: 'só os dois', expr: 'dois_unicos([0, 1])', expected: '[0, 1]', compare: 'sorted' },
        { name: 'com negativo', expr: 'dois_unicos([-1, 0])', expected: '[-1, 0]', compare: 'sorted' },
        { name: 'pares no começo', expr: 'dois_unicos([2, 2, 7, 9])', expected: '[7, 9]', compare: 'sorted' },
        { expr: 'dois_unicos([4, -4, 4, 6, 6, 100])', expected: '[-4, 100]', compare: 'sorted', hidden: true },
        { expr: 'dois_unicos([2**40, 3, 3, 2**40 + 1])', expected: '[2**40, 2**40 + 1]', compare: 'sorted', hidden: true },
        { expr: 'dois_unicos([-7, -7, -8, 5])', expected: '[-8, 5]', compare: 'sorted', hidden: true },
        { expr: 'dois_unicos([10, 20, 30, 20, 10, 40])', expected: '[30, 40]', compare: 'sorted', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.002',
          setup: `nums = [(i * 7919) % 1000003 + 1000 for i in range(4000)] * 2 + [-17, 123456789]
nums = [nums[(i * 7) % len(nums)] for i in range(len(nums))]`,
          expr: 'dois_unicos(nums)',
          expected: '[-17, 123456789]',
          compare: 'sorted',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'XOR + separação por um bit — O(n)',
      reviews: [
        {
          when: m => ['Counter', 'set', 'dict', 'defaultdict'].some(f => m.calls.includes(f)),
          text: 'Funciona, mas guarda até `n` valores: `O(n)` de memória. Faça o XOR de tudo (sobra `a ^ b`), isole um bit em que `a` e `b` diferem com `x & -x` e separe os números em dois grupos por esse bit.',
          concept: 'XOR',
        },
        {
          when: m => m.calls.includes('count'),
          text: '`nums.count(v)` percorre a lista inteira; chamado para cada elemento, vira `O(n²)`. O XOR resolve em duas passadas.',
          concept: 'XOR',
        },
        {
          when: m => m.calls.includes('sort') || m.calls.includes('sorted'),
          text: 'Ordenar e procurar vizinhos diferentes funciona em `O(n log n)`. O XOR com a separação por um bit faz em `O(n)`, sem mexer na lista.',
          concept: 'XOR',
        },
      ],
      hints: [
        'Faça o XOR de todos os números: os pares se anulam e sobra `x = a ^ b`. Como `a != b`, `x` tem pelo menos um bit ligado.',
        'Um bit ligado em `x` é uma posição em que `a` e `b` **diferem**. Isole o mais baixo com `bit = x & -x`.',
        'Separe os números pelo teste `v & bit`: `a` cai num grupo, `b` no outro, e cada par repetido cai inteiro no mesmo grupo. O XOR do grupo "ligado" dá um dos únicos; o outro é `x ^ a`.',
      ],
      solution: `def dois_unicos(nums):
    x = 0
    for v in nums:
        x ^= v                  # os pares se anulam: sobra a ^ b
    bit = x & -x                # bit 1 mais baixo: a e b diferem nele
    a = 0
    for v in nums:
        if v & bit:             # só o grupo com esse bit ligado
            a ^= v
    return [a, x ^ a]
`,
      solutionExplanation: 'O primeiro XOR deixa `a ^ b`, e qualquer bit ligado ali separa `a` de `b`. `x & -x` isola o mais baixo — funciona até com negativos, graças ao complemento de dois "infinito" do Python. Os pares repetidos caem inteiros num mesmo grupo e se anulam, então o XOR do grupo "bit ligado" é exatamente um dos únicos. **Tempo `O(n)`** (duas passadas), **espaço `O(1)`**.',
    },
    {
      type: 'match',
      id: 'lc-bit-q3',
      concept: 'Operadores bit a bit',
      say: 'Bate-bola: cada operação com sua expressão.',
      prompt: 'Associe cada operação à expressão em Python (`i` é a posição do bit, contando do 0 à direita).',
      pairs: [
        { left: 'Testar se o bit `i` está ligado', right: '`x >> i & 1`' },
        { left: 'Ligar o bit `i`', right: '`x | (1 << i)`' },
        { left: 'Desligar o bit `i`', right: '`x & ~(1 << i)`' },
        { left: 'Inverter o bit `i`', right: '`x ^ (1 << i)`' },
        { left: 'Apagar o bit 1 mais baixo', right: '`x & (x - 1)`' },
        { left: 'Isolar o bit 1 mais baixo', right: '`x & -x`' },
      ],
      explanation: 'As quatro primeiras seguem o mesmo molde: construa uma **máscara** com `1 << i` e combine — `|` liga, `& ~` desliga, `^` inverte e `>> i & 1` lê. As duas últimas usam aritmética: subtrair 1 inverte o bit 1 mais baixo e os zeros à direita dele (por isso `x & (x - 1)` o apaga), e `-x == ~x + 1` só tem em comum com `x` esse mesmo bit (por isso `x & -x` o isola).',
    },
    {
      type: 'code',
      id: 'lc-bit-q4',
      concept: 'Contar por bit',
      title: 'Total Hamming Distance',
      say: 'Problema de entrevista: pense por bit, não por par.',
      prompt: `A **distância de Hamming** entre dois inteiros é o número de posições de bit em que eles diferem: \`(a ^ b).bit_count()\`.

Implemente \`hamming_total(nums)\` que devolve a **soma das distâncias de Hamming de todos os pares** \`i < j\`.

- \`0 <= nums[i] < 2**30\`.
- A força bruta sobre os pares é \`O(n²)\`. Objetivo: **\`O(n · bits)\`**.`,
      starter: `def hamming_total(nums):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'hamming_total([4, 14, 2])', expected: '6' },
        { name: 'com repetido', expr: 'hamming_total([4, 14, 4])', expected: '4' },
        { name: 'lista vazia', expr: 'hamming_total([])', expected: '0' },
        { name: 'um número', expr: 'hamming_total([7])', expected: '0' },
        { name: 'todos zero', expr: 'hamming_total([0, 0, 0])', expected: '0' },
        { name: 'pequeno', expr: 'hamming_total([1, 2, 3])', expected: '4' },
        { expr: 'hamming_total([0, 2**29])', expected: '1', hidden: true },
        { expr: 'hamming_total([1023, 0, 1023])', expected: '20', hidden: true },
        { expr: 'hamming_total([5, 5, 5, 5])', expected: '0', hidden: true },
        { expr: 'hamming_total([i * 37 % 64 for i in range(20)])', expected: '600', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 3.000',
          setup: 'nums = [(i * 2654435761) % (1 << 30) for i in range(3000)]',
          expr: 'hamming_total(nums)',
          expected: '67499818',
          maxMs: 50,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Contar por bit — O(n · bits)',
      reviews: [
        {
          when: (m, code) => m.calls.includes('combinations') || (m.loopDepth >= 2 && /\^/.test(code)),
          text: 'Percorrer todos os pares é `O(n²)` — com 3.000 números, são 4,5 milhões de XORs. Troque a ordem da soma: para cada **posição de bit**, conte quantos números a têm ligada (`uns`); ela contribui com `uns * (n - uns)` pares.',
          concept: 'Contar por bit',
        },
        {
          when: (m, code) => /bin\s*\(/.test(code) && /count\s*\(/.test(code),
          text: '`bin(x).count("1")` cria uma string a cada chamada. Em Python 3.10+, `x.bit_count()` conta em C — e aqui nem é preciso contar bits de cada par: conte **por posição**.',
          concept: 'Popcount',
        },
      ],
      hints: [
        'Em vez de olhar cada **par**, olhe cada **posição de bit** separadamente: a distância total é a soma, posição por posição, de quantos pares diferem ali.',
        'Na posição `b`, se `uns` números têm o bit ligado e `n - uns` têm desligado, quantos pares diferem nessa posição?',
        'Exatamente `uns * (n - uns)`. Some isso para `b` de `0` a `29`, com `uns = sum(v >> b & 1 for v in nums)`.',
      ],
      solution: `def hamming_total(nums):
    n = len(nums)
    total = 0
    for b in range(30):                         # cada posição de bit
        uns = sum(v >> b & 1 for v in nums)     # quantos têm o bit b ligado
        total += uns * (n - uns)                # pares (ligado, desligado)
    return total
`,
      solutionExplanation: 'Um par contribui com 1 na posição `b` exatamente quando um número tem o bit ligado e o outro não: são `uns · (n - uns)` pares. Somando as 30 posições: **tempo `O(30 · n)` = `O(n)`**, **espaço `O(1)`**. É o padrão **contar por bit**: trocar uma soma sobre `n²/2` pares por uma soma sobre poucas posições — o mesmo que inverter a ordem de dois somatórios.',
    },
    {
      type: 'mcq',
      id: 'lc-bit-q5',
      concept: 'Bitmask',
      say: 'Agora com máscaras. Leia os bits da direita para a esquerda!',
      prompt: `Com \`itens = ['pão', 'queijo', 'presunto', 'ovo']\`, a função

\`\`\`python
def escolha(mask):
    return [itens[i] for i in range(len(itens)) if mask >> i & 1]
\`\`\`

devolve o quê para \`mask = 0b1010\`?`,
      options: [
        { text: "`['pão', 'presunto']`", why: 'Essa é a leitura da **esquerda para a direita**. O bit 0 é o mais à direita — e em `0b1010` ele está desligado.' },
        { text: "`['queijo', 'ovo']`", correct: true, why: '`0b1010` tem ligados os bits 1 e 3 (valores 2 e 8): `itens[1]` e `itens[3]`.' },
        { text: "`['queijo', 'presunto']`", why: 'Os bits ligados são o 1 e o 3, não o 1 e o 2: `0b1010 == 8 + 2`.' },
        { text: "`['pão', 'queijo', 'presunto', 'ovo']`", why: 'Isso seria `0b1111` (15). Em `0b1010`, só dois bits estão ligados.' },
      ],
      explanation: 'O bit `i` vale `2**i` e é lido com `mask >> i & 1`; o bit 0 é o **menos significativo**, o mais à direita na notação `0b`. Assim, `0b1010 = 8 + 2` liga os bits 3 e 1: `itens[1]` e `itens[3]`. Percorrendo `range(1 << n)`, cada inteiro gera um subconjunto diferente — `2ⁿ` ao todo, cada um montado em `O(n)`.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fechou! XOR para anular pares, Kernighan para apagar bits, máscaras para subconjuntos e contagem por bit para escapar do `O(n²)`.',
        { text: 'E lembre: em Python o inteiro não tem limite — se o problema depende de 32 bits, a máscara fica por sua conta. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
