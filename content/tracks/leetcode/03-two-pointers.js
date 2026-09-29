Game.registerModule('leetcode', {
  id: 'two-pointers',
  title: 'Dois Ponteiros',
  kind: 'lesson',
  level: 1,
  order: 11,
  unit: 'arrays',
  summary: 'Percorrer a entrada com dois índices para resolver em O(n) sem memória extra.',
  concepts: ['Two Pointers', 'Array ordenado', 'In-place', 'Complexidade de espaço'],
  takeaways: [
    '**Pontas opostas** (`esq` e `dir` se fechando) servem para entradas **ordenadas** ou simétricas: palíndromos, pares com soma X.',
    '**Mesma direção** (`lento`/`rapido`): o `rapido` explora e o `lento` marca onde escrever — ideal para modificar **in-place**.',
    'Cada passo descarta um elemento para sempre: `O(n)` de tempo e **`O(1)` de espaço**, a vantagem sobre o hash map.',
    'Sem ordenação, "soma pequena → avance `esq`" deixa de valer: volte ao hash map (ou ordene, pagando `O(n log n)`).',
    'Com **três** ponteiros (bandeira holandesa) dá para particionar em três grupos numa única passada.',
  ],
  glossary: [
    { term: 'Dois ponteiros', aliases: ['two pointers', 'two-pointers'], definition: 'Técnica que percorre a entrada com dois índices — vindo das pontas um em direção ao outro, ou na mesma direção em velocidades diferentes — descartando possibilidades a cada passo. Costuma dar `O(n)` de tempo e `O(1)` de espaço.' },
    { term: 'In-place', aliases: ['in place'], definition: 'Algoritmo que transforma a entrada **na própria estrutura**, com só `O(1)` de memória extra. Ex.: `lista.reverse()` é in-place; `lista[::-1]` cria uma cópia com `O(n)` de memória.' },
    { term: 'Bandeira holandesa', aliases: ['problema da bandeira holandesa', 'Dutch national flag', 'partição em três vias', 'particao em tres vias', 'three-way partition'], definition: 'Problema proposto por Edsger Dijkstra: ordenar um array com três valores numa única passada e com `O(1)` de espaço, usando três ponteiros. É a base do quicksort de três vias, usado quando há muitos valores repetidos.' },
    { term: 'Partição estável', aliases: ['particao estavel', 'partições estáveis', 'stable partition'], definition: 'Separar os elementos em grupos (ex.: não-zeros antes dos zeros) **preservando a ordem relativa** dentro de cada grupo. O Move Zeroes com ponteiros lento/rápido é estável; a bandeira holandesa, não.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hash map é ótimo, mas gasta memória. Quando a entrada tem **estrutura** — tipo estar ordenada —, dá para fazer melhor.',
        'A técnica dos **dois ponteiros** usa dois índices que andam pela lista, cada um descartando possibilidades.',
      ],
      board: {
        title: 'Dois ponteiros — duas variações',
        md: `**1. Pontas opostas** (\`esq\` no início, \`dir\` no fim, andando um em direção ao outro)
- palíndromos
- pares com soma X em array **ordenado**
- "container with most water"

**2. Mesma direção** (\`lento\` e \`rapido\`)
- remover duplicatas **in-place**
- mover zeros para o fim
- detectar ciclo em lista ligada

> [!dica] O ganho típico: de \`O(n²)\` de tempo ou \`O(n)\` de espaço para **\`O(n)\` de tempo e \`O(1)\` de espaço**.`,
      },
    },
    {
      type: 'say',
      text: [
        'Exemplo clássico: verificar se uma string é **palíndromo**. Um ponteiro no começo, outro no fim, comparando e fechando.',
        'Se algum par for diferente, não é palíndromo. Se os ponteiros se cruzarem, é.',
      ],
      board: {
        title: 'Pontas opostas: palíndromo',
        code: `def eh_palindromo(s):
    esq, dir = 0, len(s) - 1
    while esq < dir:
        if s[esq] != s[dir]:
            return False
        esq += 1
        dir -= 1
    return True

# "arara"
#  ^   ^   a == a
#   ^ ^    r == r
#    ^     cruzaram -> True`,
        caption: '`s == s[::-1]` também funciona, mas cria uma cópia: `O(n)` de espaço extra.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora o pulo do gato: soma de pares num array **ordenado**.',
        'Se a soma está pequena, só adianta **aumentar** — então ando com o ponteiro da esquerda. Se está grande, ando com o da direita.',
        'Cada passo descarta um elemento para sempre. Por isso é `O(n)`.',
      ],
      board: {
        title: 'Pontas opostas: soma em array ordenado',
        code: `def par_com_soma(nums, alvo):          # nums ORDENADO
    esq, dir = 0, len(nums) - 1
    while esq < dir:
        soma = nums[esq] + nums[dir]
        if soma == alvo:
            return [esq, dir]
        if soma < alvo:
            esq += 1       # preciso de um número maior
        else:
            dir -= 1       # preciso de um número menor
    return []

# [1, 3, 4, 6, 9], alvo 10
#  1 + 9 = 10  -> achou [0, 4]`,
      },
    },
    {
      type: 'say',
      text: [
        'A outra variação: ponteiros na **mesma direção**. O `rapido` explora, o `lento` marca onde escrever o próximo elemento válido.',
        'Assim dá para remover duplicatas de uma lista ordenada **sem criar outra lista**.',
      ],
      board: {
        title: 'Mesma direção: remover duplicatas in-place',
        code: `def remover_duplicatas(nums):         # nums ORDENADO
    if not nums:
        return 0
    lento = 0
    for rapido in range(1, len(nums)):
        if nums[rapido] != nums[lento]:
            lento += 1
            nums[lento] = nums[rapido]
    return lento + 1     # quantidade de únicos

nums = [1, 1, 2, 3, 3]
k = remover_duplicatas(nums)
print(k, nums[:k])       # 3 [1, 2, 3]`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E se forem **três** grupos? Um holandês famoso pensou nisso nos anos 70.',
        'Três ponteiros, uma passada, zero memória extra.',
      ],
      board: {
        title: 'Três ponteiros: a bandeira holandesa',
        md: `**Problema:** ordenar um array que só tem \`0\`, \`1\` e \`2\` (LeetCode 75 — *Sort Colors*) numa única passada, sem contar e sem memória extra.

\`\`\`python
def ordenar_cores(nums):
    baixo, meio, alto = 0, 0, len(nums) - 1
    while meio <= alto:
        if nums[meio] == 0:
            nums[baixo], nums[meio] = nums[meio], nums[baixo]
            baixo += 1
            meio += 1
        elif nums[meio] == 1:
            meio += 1
        else:                     # 2 vai para o fim
            nums[meio], nums[alto] = nums[alto], nums[meio]
            alto -= 1             # NÃO avança meio: o valor que chegou ainda não foi visto
\`\`\`

\`\`\`text
[ 0 0 0 | 1 1 1 | ? ? ? ? | 2 2 2 ]
          ^baixo  ^meio ^alto
\`\`\`

Invariante: \`[0, baixo)\` são 0s · \`[baixo, meio)\` são 1s · \`[meio, alto]\` ainda não vistos · \`(alto, fim]\` são 2s.

> [!sabia] Esse é o **problema da bandeira holandesa** (*Dutch national flag*), proposto por **Edsger Dijkstra** em 1976 — três faixas, como as cores da bandeira do país dele. A mesma **partição em três vias** salva o quicksort quando há muitos valores repetidos: sem ela, muitas implementações caem no pior caso \`O(n²)\` com um array cheio de iguais.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Palíndromos, pares ordenados e ponteiros lento/rápido.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-tp-q1',
      concept: 'Two Pointers',
      say: 'Quando dois ponteiros funcionam? Essa é a pergunta que decide a abordagem.',
      prompt: 'Para achar dois números que somam `alvo` com a técnica de **pontas opostas** (andar `esq` se a soma for pequena, `dir` se for grande), qual condição a entrada **precisa** satisfazer?',
      options: [
        { text: 'Não ter números repetidos.', why: 'Repetidos não atrapalham a técnica.' },
        { text: 'Estar ordenada.', correct: true, why: 'É a ordenação que garante que andar com `esq` aumenta a soma e andar com `dir` diminui.' },
        { text: 'Ter tamanho par.', why: 'O tamanho não importa: os ponteiros param quando se cruzam.' },
        { text: 'Ter apenas números positivos.', why: 'Negativos funcionam normalmente se a lista estiver ordenada.' },
      ],
      explanation: 'A decisão de qual ponteiro mover só é segura porque a lista está **ordenada** — cada movimento descarta um elemento que nunca faria parte da resposta.',
    },
    {
      type: 'code',
      id: 'lc-tp-q2',
      concept: 'Two Pointers',
      title: 'Valid Palindrome',
      say: 'LeetCode 125. Aqui o detalhe é ignorar tudo que não é letra ou número. E faça com `O(1)` de espaço extra!',
      prompt: `Implemente \`is_palindrome(s)\`: devolva \`True\` se \`s\` for um palíndromo **considerando apenas letras e dígitos** e **ignorando maiúsculas/minúsculas**.

- \`"A man, a plan, a canal: Panama"\` → \`True\`
- Use **dois ponteiros** sem montar uma string limpa nova (\`O(1)\` de espaço extra).
- Dicas úteis: \`c.isalnum()\` e \`c.lower()\`.`,
      starter: `def is_palindrome(s):
    esq, dir = 0, len(s) - 1
    # TODO: pule o que não é alfanumérico e compare sem diferenciar maiúsculas
    pass
`,
      tests: [
        { name: 'frase clássica', expr: 'is_palindrome("A man, a plan, a canal: Panama")', expected: 'True' },
        { name: 'não é palíndromo', expr: 'is_palindrome("race a car")', expected: 'False' },
        { name: 'só espaço', expr: 'is_palindrome(" ")', expected: 'True' },
        { name: 'string vazia', expr: 'is_palindrome("")', expected: 'True' },
        { name: 'dígitos contam', expr: 'is_palindrome("0P")', expected: 'False' },
        { expr: 'is_palindrome("ab_a")', expected: 'True', hidden: true },
        { expr: 'is_palindrome(".,")', expected: 'True', hidden: true },
        { expr: 'is_palindrome("Socorram-me, subi no onibus em Marrocos")', expected: 'True', hidden: true },
      ],
      perfTests: [
        {
          name: 'string com 200.000 caracteres',
          setup: 'metade = "".join(chr(97 + i % 26) + ", " for i in range(50000))\ns = metade + metade[::-1]',
          expr: 'is_palindrome(s)',
          expected: 'True',
          maxMs: 500,
        },
      ],
      slowConcept: 'Two Pointers — uma passada O(n)',
      reviews: [
        {
          when: (m, code) => /\[\s*::\s*-1\s*\]/.test(code) || m.calls.includes('reversed') || m.calls.includes('join'),
          text: 'Montar/inverter uma string nova funciona, mas usa `O(n)` de memória extra. Com dois ponteiros você compara no lugar, com `O(1)` de espaço.',
          concept: 'Complexidade de espaço',
        },
      ],
      hints: [
        'Enquanto `esq < dir`: se `s[esq]` não for alfanumérico, avance `esq`; se `s[dir]` não for, recue `dir`.',
        'Quando os dois apontarem para caracteres válidos, compare `s[esq].lower()` com `s[dir].lower()`.',
        'Se forem diferentes, `return False`; senão, avance os dois. Ao sair do loop, `return True`.',
      ],
      solution: `def is_palindrome(s):
    esq, dir = 0, len(s) - 1
    while esq < dir:
        if not s[esq].isalnum():
            esq += 1
        elif not s[dir].isalnum():
            dir -= 1
        elif s[esq].lower() != s[dir].lower():
            return False
        else:
            esq += 1
            dir -= 1
    return True
`,
      solutionExplanation: 'Cada iteração move pelo menos um ponteiro, então são no máximo `n` passos: **tempo `O(n)`**, **espaço `O(1)`**. Usar `if/elif` num único loop evita os `while` internos e os erros de índice que eles costumam causar.',
    },
    {
      type: 'code',
      id: 'lc-tp-q3',
      concept: 'Two Pointers',
      title: 'Two Sum II — array ordenado',
      say: 'LeetCode 167. Parece o Two Sum, mas agora a lista vem **ordenada**. Dá para fazer sem dicionário!',
      prompt: `Dada uma lista \`numbers\` **ordenada em ordem crescente**, implemente \`two_sum_sorted(numbers, target)\` que devolve os índices \`[i, j]\` (base 0, \`i < j\`) de dois números cuja soma é \`target\`.

- Existe exatamente uma solução.
- Objetivo: **\`O(n)\` de tempo e \`O(1)\` de espaço extra** — aproveite a ordenação.`,
      starter: `def two_sum_sorted(numbers, target):
    pass
`,
      tests: [
        { name: 'exemplo 1', expr: 'two_sum_sorted([2, 7, 11, 15], 9)', expected: '[0, 1]' },
        { name: 'exemplo 2', expr: 'two_sum_sorted([2, 3, 4], 6)', expected: '[0, 2]' },
        { name: 'negativos', expr: 'two_sum_sorted([-1, 0], -1)', expected: '[0, 1]' },
        { name: 'repetidos', expr: 'two_sum_sorted([1, 2, 2, 9], 4)', expected: '[1, 2]' },
        { expr: 'two_sum_sorted([-5, -3, 0, 4, 8, 12], 9)', expected: '[1, 5]', hidden: true },
        { expr: 'two_sum_sorted([1, 3, 4, 6, 9], 13)', expected: '[2, 4]', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.000, par no final',
          setup: 'numbers = list(range(0, 16000, 2))',
          expr: 'two_sum_sorted(numbers, 15996 + 15998)',
          expected: '[7998, 7999]',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Two Pointers em array ordenado',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Loops aninhados testam todos os pares (`O(n²)`). Com a lista ordenada, dois ponteiros resolvem em uma passada.',
          concept: 'Two Pointers',
        },
        {
          when: (m, code) => /=\s*\{\s*\}/.test(code) || m.calls.includes('dict') || m.calls.includes('set'),
          text: 'Um `dict`/`set` funciona em `O(n)`, mas gasta `O(n)` de memória e ignora que a lista já está ordenada. Dois ponteiros fazem com `O(1)` de espaço.',
          concept: 'Complexidade de espaço',
        },
      ],
      hints: [
        'Comece com `esq = 0` e `dir = len(numbers) - 1`.',
        'Se `numbers[esq] + numbers[dir]` for menor que o alvo, você precisa de uma soma maior: qual ponteiro mover?',
        'Soma pequena → `esq += 1`; soma grande → `dir -= 1`; igual → `return [esq, dir]`.',
      ],
      solution: `def two_sum_sorted(numbers, target):
    esq, dir = 0, len(numbers) - 1
    while esq < dir:
        soma = numbers[esq] + numbers[dir]
        if soma == target:
            return [esq, dir]
        if soma < target:
            esq += 1
        else:
            dir -= 1
    return []
`,
      solutionExplanation: 'A cada passo um ponteiro anda e descarta um elemento que não pode fazer parte da resposta: **tempo `O(n)`**, **espaço `O(1)`**. É a vantagem sobre o hash map quando a entrada já vem ordenada.',
    },
    {
      type: 'match',
      id: 'lc-rx-tp-q1',
      concept: 'Escolha da variação de ponteiros',
      say: 'Bate-bola: qual arranjo de ponteiros para cada problema?',
      prompt: 'Associe cada problema à técnica mais adequada.',
      pairs: [
        { left: 'Verificar se uma frase é palíndromo', right: 'Pontas opostas, fechando até se cruzarem' },
        { left: 'Remover duplicatas de uma lista ordenada in-place', right: 'Lento e rápido na mesma direção' },
        { left: 'Ordenar um array só de 0, 1 e 2 numa passada', right: 'Três ponteiros (bandeira holandesa)' },
        { left: 'Mesclar duas listas já ordenadas', right: 'Um ponteiro em cada lista, avançando o do menor' },
        { left: 'Par com soma X numa lista **não** ordenada, devolvendo os índices', right: 'Hash map — dois ponteiros exigiriam ordenar' },
      ],
      explanation: 'Pontas opostas exploram **simetria** ou **ordenação**; lento/rápido reescrevem a lista **no lugar**; três ponteiros particionam em três grupos. Na mescla, cada lista ganha seu ponteiro e sempre avança o que aponta para o menor. E nem todo problema de pares é de dois ponteiros: sem ordenação (e precisando dos índices originais), o hash map em `O(n)` vence ordenar em `O(n log n)`.',
    },
    {
      type: 'mcq',
      id: 'lc-tp-q4',
      concept: 'Ponteiros lento/rápido',
      say: 'Última: siga os ponteiros com calma.',
      prompt: `O que este código imprime?

\`\`\`python
def mover_zeros(nums):
    lento = 0
    for rapido in range(len(nums)):
        if nums[rapido] != 0:
            nums[lento], nums[rapido] = nums[rapido], nums[lento]
            lento += 1

nums = [0, 1, 0, 3, 12]
mover_zeros(nums)
print(nums)
\`\`\``,
      options: [
        { text: '`[1, 3, 12, 0, 0]`', correct: true, why: 'O `lento` marca a próxima posição para um não-zero; os zeros vão sendo empurrados para o fim, mantendo a ordem dos outros.' },
        { text: '`[0, 0, 1, 3, 12]`', why: 'É o contrário: os não-zeros são trazidos para a frente.' },
        { text: '`[12, 3, 1, 0, 0]`', why: 'A ordem relativa dos não-zeros é preservada.' },
        { text: '`[1, 0, 3, 0, 12]`', why: 'Todos os não-zeros são trocados com a posição `lento`, então nenhum zero fica no meio.' },
      ],
      explanation: 'Esse é o LeetCode 283 (Move Zeroes). Ponteiros na **mesma direção**: `rapido` percorre tudo, `lento` indica onde colocar o próximo elemento válido. `O(n)` de tempo, `O(1)` de espaço, in-place.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo! Lembre: **pontas opostas** quando a entrada é ordenada ou simétrica; **lento/rápido** para modificar in-place.',
        'O ganho é quase sempre em memória: `O(1)` de espaço. No próximo módulo, os ponteiros viram uma **janela deslizante**.',
      ],
      board: null,
    },
  ],
});
