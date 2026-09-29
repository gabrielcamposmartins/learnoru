Game.registerModule('leetcode', {
  id: 'sliding-window',
  title: 'Janela Deslizante',
  kind: 'lesson',
  level: 2,
  order: 12,
  unit: 'arrays',
  summary: 'Subarrays e substrings contíguos em O(n): reaproveite o trabalho da janela anterior.',
  concepts: ['Sliding Window', 'Janela fixa', 'Janela variável', 'Hash Map'],
  takeaways: [
    '"Subarray/substring **contígua**" é o sinal da janela deslizante: mantenha `[esq, dir]` e ajuste só o que entra e o que sai.',
    'Janela **fixa**: calcule a primeira janela uma vez e depois `soma += entra - sai`.',
    'Janela **variável**: `dir` sempre expande; `esq` encolhe **enquanto** a janela for inválida — e nunca volta.',
    'Um `while` dentro do `for` continua `O(n)`: cada elemento entra e sai da janela no máximo uma vez (custo amortizado).',
    'A ideia vale até para hashes: um **rolling hash** atualiza o hash da janela em `O(1)` (Rabin-Karp, rsync).',
  ],
  glossary: [
    { term: 'Janela deslizante', aliases: ['janelas deslizantes', 'janela fixa', 'janela variável', 'janela variavel'], definition: 'Técnica para subarrays/substrings **contíguos**: mantém um trecho `[esq, dir]` e, ao movê-lo, atualiza só o que entrou e o que saiu, em vez de recalcular tudo. Pode ser fixa (tamanho k) ou variável (encolhe quando fica inválida).' },
    { term: 'Subsequência', aliases: ['subsequências', 'subsequencia', 'subsequence'], definition: 'Elementos tirados **na mesma ordem**, mas não necessariamente vizinhos: `"ace"` é subsequência de `"abcde"`. Substring e subarray são **contíguos** — só estes cabem numa janela deslizante.' },
    { term: 'Rolling hash', aliases: ['rolling hashes', 'hash rolante', 'Rabin-Karp'], definition: 'Hash de uma janela atualizado em `O(1)` quando ela desliza: tira a contribuição do caractere que sai e soma a do que entra. Base do algoritmo de busca de texto **Rabin-Karp** (1987) e do rsync.' },
    { term: 'Deque monotônica', aliases: ['deques monotônicas', 'deque monotonica', 'fila monotônica', 'monotonic deque', 'monotonic queue'], definition: 'Deque cujos valores ficam sempre em ordem, descartando pelo fundo quem nunca mais pode ser a resposta. Dá o **máximo de cada janela** de tamanho k em `O(n)` no total (LeetCode 239).' },
    { term: 'Content-defined chunking', aliases: ['content defined chunking', 'chunking definido pelo conteúdo'], definition: 'Cortar um arquivo em blocos onde o **rolling hash** dos últimos bytes bate um padrão, em vez de a cada N bytes fixos. Inserir um byte muda só os blocos vizinhos — é o que permite a deduplicação em ferramentas de backup como restic e borg.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Sempre que o problema falar em **subarray** ou **substring contígua**, acenda uma luz: **janela deslizante**.',
        'A ideia é manter um trecho `[esq, dir]` e, ao mover a janela, só **ajustar** o que entrou e o que saiu — em vez de recalcular tudo.',
      ],
      board: {
        title: 'Janela deslizante',
        md: `**Sinais no enunciado:**
- "subarray / substring **contígua**"
- "de tamanho **k**"
- "a **maior/menor** janela que satisfaz uma condição"

**Dois tipos:**

| Tipo | Como anda | Exemplo |
|---|---|---|
| **Fixa** | entra 1, sai 1 | soma máxima de k elementos seguidos |
| **Variável** | \`dir\` expande; \`esq\` encolhe quando a condição quebra | maior substring sem repetição |

> [!dica] Força bruta sobre todas as janelas costuma ser \`O(n·k)\` ou \`O(n²)\`. A janela deslizante leva a \`O(n)\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'Janela **fixa**: soma de cada bloco de `k` elementos. A força bruta chama `sum()` para cada posição — `O(n·k)`.',
        'Mas de uma janela para a próxima, só **um** elemento sai e **um** entra. Então: `soma += entra - sai`.',
      ],
      board: {
        title: 'Janela fixa',
        code: `# Força bruta — O(n·k): recalcula a soma inteira a cada passo
def medias_lento(nums, k):
    return [sum(nums[i:i + k]) / k for i in range(len(nums) - k + 1)]


# Janela deslizante — O(n)
def medias(nums, k):
    soma = sum(nums[:k])                 # primeira janela
    resultado = [soma / k]
    for dir in range(k, len(nums)):
        soma += nums[dir] - nums[dir - k]  # entra um, sai um
        resultado.append(soma / k)
    return resultado

# nums = [1, 3, 2, 6, -1], k = 3
# [1 3 2] 6 -1  -> 6
#  1 [3 2 6] -1 -> 6 - 1 + 6 = 11`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Janela **variável**: `dir` avança sempre, colocando elementos na janela.',
        'Quando a janela fica **inválida** (por exemplo, tem um caractere repetido), avançamos `esq` até ela voltar a ser válida.',
        'Como cada ponteiro só anda para frente, o total de passos é no máximo `2n`: continua `O(n)`, mesmo com um `while` dentro do `for`.',
      ],
      board: {
        title: 'Janela variável — o molde',
        code: `def molde(s):
    esq = 0
    estado = {}                  # o que há dentro da janela
    melhor = 0
    for dir, c in enumerate(s):
        # 1) coloca s[dir] na janela
        estado[c] = estado.get(c, 0) + 1
        # 2) enquanto a janela for inválida, tira s[esq]
        while janela_invalida(estado):
            estado[s[esq]] -= 1
            esq += 1
        # 3) janela válida: atualiza a resposta
        melhor = max(melhor, dir - esq + 1)
    return melhor`,
        caption: 'Um `while` dentro do `for` **não** significa `O(n²)` aqui: `esq` só avança, no total, até n.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'A janela deslizante não serve só para somas. Dá para deslizar um **hash**!',
        'É assim que o rsync descobre quais pedaços de um arquivo mudaram sem mandar o arquivo inteiro.',
      ],
      board: {
        title: 'Deslizando um hash: Rabin-Karp',
        md: `Comparar cada janela de tamanho \`k\` com um padrão custa \`O(k)\`. O **rolling hash** trata a janela como um número na base \`B\` e o atualiza em \`O(1)\` — o mesmo "entra um, sai um" da soma:

\`\`\`python
def rabin_karp(texto, padrao, B=256, M=1_000_000_007):
    k = len(padrao)
    if k > len(texto):
        return -1
    peso = pow(B, k - 1, M)          # peso do caractere que sai
    hp = hj = 0
    for i in range(k):
        hp = (hp * B + ord(padrao[i])) % M
        hj = (hj * B + ord(texto[i])) % M
    for esq in range(len(texto) - k + 1):
        if hj == hp and texto[esq:esq + k] == padrao:  # confirma: colisões existem
            return esq
        if esq + k < len(texto):
            hj = ((hj - ord(texto[esq]) * peso) * B + ord(texto[esq + k])) % M
    return -1
\`\`\`

> [!sabia] O **rsync** usa um rolling checksum para achar, byte a byte, blocos do arquivo antigo dentro do novo — e só transfere o que mudou. Ferramentas de backup como **restic** e **borg** vão além com o **content-defined chunking**: cortam o arquivo onde o rolling hash dos últimos bytes bate um padrão. Assim, inserir um byte no começo de um arquivo de 1 GB muda só um ou dois blocos, e o resto é deduplicado.

> [!dica] Outra variação famosa: o **máximo de cada janela** (LeetCode 239) sai em \`O(n)\` com uma **deque monotônica**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Janela fixa e janela variável.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-sw-q1',
      concept: 'Sliding Window',
      say: 'Bate-bola: qual a complexidade?',
      prompt: 'Calcular a soma de **todas** as janelas de tamanho `k` de uma lista com `n` elementos, chamando `sum(nums[i:i+k])` para cada `i`, custa quanto? E com janela deslizante?',
      options: [
        { text: '`O(n)` nas duas formas.', why: 'Cada `sum` de uma fatia de tamanho k custa `O(k)` — e ainda copia a fatia.' },
        { text: 'Força bruta `O(n·k)`; janela deslizante `O(n)`.', correct: true, why: 'São ~n janelas × `O(k)` por soma. Deslizando, cada passo é `O(1)`.' },
        { text: 'Força bruta `O(n²)`; janela deslizante `O(n log n)`.', why: 'A janela deslizante não ordena nada: é `O(n)`.' },
        { text: 'Força bruta `O(k)`; janela deslizante `O(1)`.', why: 'Há ~n janelas para calcular, então nenhuma das duas é independente de n.' },
      ],
      explanation: 'Na força bruta cada janela custa `O(k)`, totalizando `O(n·k)` (que vira `O(n²)` quando k ~ n/2). A janela deslizante reaproveita a soma anterior: `soma += entra - sai`.',
    },
    {
      type: 'code',
      id: 'lc-sw-q2',
      concept: 'Janela fixa',
      title: 'Soma máxima de k elementos consecutivos',
      say: 'Janela fixa! Cuidado com listas só de negativos.',
      prompt: `Implemente \`max_sum_subarray(nums, k)\` que devolve a **maior soma** entre todos os subarrays **contíguos** de tamanho exatamente \`k\`.

- Garantia: \`1 <= k <= len(nums)\`.
- Os números podem ser negativos.
- Objetivo: **\`O(n)\`** — não recalcule a soma da janela inteira a cada passo.`,
      starter: `def max_sum_subarray(nums, k):
    pass
`,
      tests: [
        { name: 'exemplo', expr: 'max_sum_subarray([2, 1, 5, 1, 3, 2], 3)', expected: '9' },
        { name: 'um elemento', expr: 'max_sum_subarray([5], 1)', expected: '5' },
        { name: 'só negativos', expr: 'max_sum_subarray([-1, -2, -3], 2)', expected: '-3' },
        { name: 'k = n', expr: 'max_sum_subarray([1, 2, 3], 3)', expected: '6' },
        { expr: 'max_sum_subarray([4, -1, 2, 1, -5, 4], 2)', expected: '3', hidden: true },
        { expr: 'max_sum_subarray([-5, -1, -8, -2], 1)', expected: '-1', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 12.000, k = 6.000',
          setup: 'nums = [(i * 37) % 101 - 50 for i in range(12000)]\ndef _ref(a, k):\n    s = sum(a[:k]); m = s\n    for i in range(k, len(a)):\n        s += a[i] - a[i - k]; m = max(m, s)\n    return m',
          expr: 'max_sum_subarray(nums, 6000)',
          expected: '_ref(nums, 6000)',
          maxMs: 120,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Sliding Window — janela fixa em O(n)',
      reviews: [
        {
          when: (m, code) => /\bfor\b[\s\S]*\bsum\s*\(/.test(code),
          text: 'Chamar `sum()` dentro do loop recalcula a janela inteira (`O(k)`) a cada passo. Atualize a soma: `soma += nums[dir] - nums[dir - k]`.',
          concept: 'Sliding Window',
        },
        {
          when: m => m.loopDepth >= 2,
          text: 'Loops aninhados percorrem cada janela do zero: `O(n·k)`. Reaproveite a soma da janela anterior.',
          concept: 'Sliding Window',
        },
        {
          when: (m, code) => /melhor\s*=\s*0\b|maior\s*=\s*0\b|best\s*=\s*0\b|max_sum\s*=\s*0\b/.test(code),
          text: 'Inicializar o máximo com `0` é arriscado: com todos os números negativos a resposta é negativa. Comece com a soma da primeira janela (ou `float("-inf")`).',
          concept: 'Casos de borda',
        },
      ],
      hints: [
        'Calcule a soma da primeira janela com `sum(nums[:k])` — uma única vez, **antes** do loop.',
        'Para `dir` de `k` até o fim: `soma += nums[dir] - nums[dir - k]`.',
        'Guarde o máximo começando pela soma da primeira janela, não por `0` (pense nos negativos).',
      ],
      solution: `def max_sum_subarray(nums, k):
    soma = sum(nums[:k])
    maximo = soma
    for dir in range(k, len(nums)):
        soma += nums[dir] - nums[dir - k]
        maximo = max(maximo, soma)
    return maximo
`,
      solutionExplanation: 'A primeira janela custa `O(k)` e cada deslocamento `O(1)`: **tempo `O(n)`**, **espaço `O(1)`**. Inicializar o máximo com a primeira janela resolve o caso de todos negativos.',
    },
    {
      type: 'order',
      id: 'lc-rx-sw-q1',
      concept: 'Janela variável',
      say: 'Antes do próximo código, monte o molde da janela variável na ordem certa.',
      prompt: 'Ordene os passos do molde de **janela variável** (ex.: maior substring sem repetição).',
      items: [
        'Comece com `esq = 0`, o estado da janela vazio e `melhor = 0`',
        'Avance `dir` e coloque `s[dir]` no estado da janela',
        'Enquanto a janela for inválida, tire `s[esq]` do estado e faça `esq += 1`',
        'Com a janela válida, atualize `melhor` com `dir - esq + 1`',
        'Terminado o `for`, devolva `melhor`',
      ],
      explanation: 'Os passos do meio formam o corpo do `for`, e a ordem importa: a resposta só pode ser atualizada **depois** de a janela voltar a ser válida — atualizar antes do `while` contaria janelas com repetição. E como `esq` só avança, o `while` soma no máximo `n` iterações ao todo.',
    },
    {
      type: 'code',
      id: 'lc-sw-q3',
      concept: 'Janela variável',
      title: 'Longest Substring Without Repeating Characters',
      say: 'LeetCode 3, um dos mais pedidos. Janela variável — e cuidado com o caso `"abba"`!',
      prompt: `Implemente \`length_of_longest_substring(s)\` que devolve o **tamanho** da maior substring de \`s\` **sem caracteres repetidos**.

- \`"abcabcbb"\` → \`3\` (\`"abc"\`)
- \`"pwwkew"\` → \`3\` (\`"wke"\`; \`"pwke"\` não vale, pois não é contígua)
- Objetivo: **\`O(n)\`**.`,
      starter: `def length_of_longest_substring(s):
    pass
`,
      tests: [
        { name: 'exemplo 1', expr: 'length_of_longest_substring("abcabcbb")', expected: '3' },
        { name: 'tudo igual', expr: 'length_of_longest_substring("bbbbb")', expected: '1' },
        { name: 'exemplo 3', expr: 'length_of_longest_substring("pwwkew")', expected: '3' },
        { name: 'string vazia', expr: 'length_of_longest_substring("")', expected: '0' },
        { name: 'espaço conta como caractere', expr: 'length_of_longest_substring(" ")', expected: '1' },
        { name: 'dvdf', expr: 'length_of_longest_substring("dvdf")', expected: '3' },
        { expr: 'length_of_longest_substring("abba")', expected: '2', hidden: true },
        { expr: 'length_of_longest_substring("tmmzuxt")', expected: '5', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 10.000, janela de até 2.000 caracteres',
          setup: 's = "".join(chr(0x4E00 + i % 2000) for i in range(10000))',
          expr: 'length_of_longest_substring(s)',
          expected: '2000',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Sliding Window — janela variável em O(n)',
      reviews: [
        {
          when: (m, code) => /pop\s*\(\s*0\s*\)/.test(code),
          text: '`lista.pop(0)` é `O(n)`: usar uma lista como janela deixa tudo mais lento. Use índices (`esq`/`dir`) com um `set`/`dict`, ou `collections.deque`.',
          concept: 'Custo de operações em list',
        },
        {
          when: m => m.calls.includes('index') || m.calls.includes('find'),
          text: 'Buscar na substring com `.index()`/`.find()` percorre a janela a cada passo. Um `dict` com a última posição de cada caractere responde em `O(1)`.',
          concept: 'Hash Map',
        },
      ],
      hints: [
        'Mantenha a janela `s[esq:dir+1]` sempre **sem repetições** e acompanhe o maior tamanho visto.',
        'Guarde num `dict` a **última posição** de cada caractere. Ao ver `c` repetido dentro da janela, pule `esq` para depois dessa posição.',
        'Cuidado com `"abba"`: só mova `esq` para frente — use `esq = max(esq, ultima[c] + 1)`.',
      ],
      solution: `def length_of_longest_substring(s):
    ultima = {}
    esq = 0
    melhor = 0
    for dir, c in enumerate(s):
        if c in ultima and ultima[c] >= esq:
            esq = ultima[c] + 1
        ultima[c] = dir
        melhor = max(melhor, dir - esq + 1)
    return melhor
`,
      solutionExplanation: 'Cada caractere é visitado uma vez e o `dict` dá a última posição em `O(1)`: **tempo `O(n)`**, **espaço `O(min(n, alfabeto))`**. A condição `ultima[c] >= esq` impede que `esq` volte para trás (o bug do `"abba"`). A versão com `set` + `while` removendo pela esquerda também é `O(n)` amortizado.',
    },
    {
      type: 'open',
      id: 'lc-sw-q4',
      concept: 'Análise amortizada',
      say: 'Pergunta de follow-up que entrevistador adora.',
      prompt: 'Na janela variável é comum ter um `while` dentro de um `for`. Por que, mesmo assim, o algoritmo é `O(n)` e não `O(n²)`?',
      minWords: 12,
      rubric: [
        { label: 'Diz que o ponteiro esquerdo **só avança** (nunca volta)', keywords: ['so avanca', 'nunca volta', 'so anda para frente', 'so vai para frente', 'nao volta', 'monoton', 'so aumenta', 'nunca diminui'], concept: 'Sliding Window', why: 'É a monotonicidade dos ponteiros que limita o trabalho total.' },
        { label: 'Conclui que cada elemento **entra e sai da janela no máximo uma vez**', keywords: ['uma vez', 'uma unica vez', 'no maximo n', 'cada elemento', '2n'], concept: 'Análise amortizada', why: 'Somando entradas e saídas, são no máximo 2n operações.' },
        { label: 'Usa o termo **amortizado** ou a ideia de custo **total** somado', keywords: ['amortiz', 'total', 'somando', 'no geral', 'ao todo'], concept: 'Análise amortizada', why: 'O custo de um passo pode ser alto, mas a soma de todos é linear.' },
      ],
      modelAnswer: `Porque o ponteiro \`esq\` **só avança** — nunca volta. Ao longo de toda a execução, \`dir\` anda n vezes e \`esq\` anda **no máximo n vezes no total**, somando todas as iterações do \`while\`.

Ou seja, **cada elemento entra na janela uma vez e sai no máximo uma vez**: no máximo \`2n\` operações. Um passo isolado pode custar mais, mas o custo **amortizado** é \`O(1)\` por elemento, e o total é \`O(n)\`.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Boa! Janela **fixa**: `soma += entra - sai`. Janela **variável**: expande com `dir`, encolhe com `esq` enquanto for inválida.',
        'E lembre do argumento **amortizado**: cada elemento entra e sai uma vez só. Próximo módulo: **pilhas**!',
      ],
      board: null,
    },
  ],
});
