Game.registerModule('leetcode', {
  id: 'hash-map',
  title: 'Hash Map e contagem',
  kind: 'lesson',
  level: 1,
  order: 10,
  unit: 'arrays',
  summary: 'O padrão mais usado em entrevistas: trocar memória por tempo com dict, set e Counter.',
  concepts: ['Hash Map', 'Counter', 'Two Sum', 'Trade-off espaço/tempo'],
  takeaways: [
    'A pergunta do padrão: **"e se eu lembrasse do que já vi?"** → `set` para pertinência, `dict` para valor → informação (índice, contagem…).',
    'No Two Sum, **consulte o complemento antes de inserir** o elemento atual — senão ele "casa" consigo mesmo.',
    'Para contar, use `Counter` ou `defaultdict(int)` numa passada; `.count()` dentro de um loop vira `O(n²)`.',
    'O preço é `O(n)` de **memória**, e o `O(1)` é **médio**: colisões, chaves não hasheáveis e a falta de ordem são os limites do hash map.',
    'Se `a == b`, então `hash(a) == hash(b)`: por isso `1`, `1.0` e `True` são **a mesma chave** num `dict`.',
  ],
  glossary: [
    { term: 'Tabela hash', aliases: ['tabelas hash', 'hash table', 'hash tables', 'hash map', 'hash maps', 'hashmap', 'tabela de espalhamento'], definition: 'Estrutura que guarda pares chave → valor num array, usando `hash(chave)` para calcular a posição. Busca, inserção e remoção são `O(1)` em média. O `dict` e o `set` do Python são tabelas hash.' },
    { term: 'Colisão de hash', aliases: ['colisões de hash', 'colisao de hash', 'hash collision', 'hash collisions'], definition: 'Quando duas chaves diferentes caem na mesma posição da tabela. São inevitáveis: a tabela procura outra posição (ou encadeia os itens), e muitas colisões degradam a busca para `O(n)`.' },
    { term: 'Endereçamento aberto', aliases: ['enderecamento aberto', 'open addressing'], definition: 'Estratégia de colisão em que tudo fica no próprio array: se a posição está ocupada, a tabela **sonda** outras numa sequência determinística. É o que o `dict` do CPython usa, com uma perturbação baseada nos bits altos do hash.' },
    { term: 'Hash flooding', aliases: ['HashDoS', 'hash DoS', 'hash-flooding'], definition: 'Ataque de negação de serviço em que o invasor envia chaves escolhidas para colidirem na tabela hash: cada inserção vira `O(n)` e o processamento do request, `O(n²)`. Demonstrado contra várias linguagens em 2011.' },
    { term: 'Randomização de hash', aliases: ['randomizacao de hash', 'hash randomization', 'PYTHONHASHSEED'], definition: 'Defesa contra hash flooding: o hash de `str` e `bytes` usa uma semente aleatória por processo (padrão desde o Python 3.3; SipHash desde o 3.4). Por isso `hash("abc")` muda a cada execução — nunca persista hashes.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Se eu tivesse que apostar em **um** padrão que aparece em toda entrevista, seria o **Hash Map**.',
        'A pergunta mágica é: "e se eu **lembrasse** do que já vi?". Um `dict` responde isso em `O(1)`.',
      ],
      board: {
        title: 'O padrão Hash Map',
        md: `**Sinais de que o problema pede um hash map:**

- "encontre dois elementos que somam X"
- "conte quantas vezes cada item aparece"
- "agrupe itens equivalentes" (anagramas, por exemplo)
- "já vi esse elemento antes?"

**Ferramentas do Python:**

| Estrutura | Para quê |
|---|---|
| \`set\` | "já vi?" — pertinência em \`O(1)\` |
| \`dict\` | valor → informação (índice, contagem…) |
| \`collections.Counter\` | contagem pronta |
| \`collections.defaultdict\` | dict com valor padrão (\`list\`, \`int\`…) |

> [!dica] Quase sempre o custo é \`O(n)\` de **memória** extra. Diga isso ao entrevistador.`,
      },
    },
    {
      type: 'say',
      text: [
        'O exemplo clássico é o **Two Sum**: dada uma lista e um alvo, ache os índices de dois números que somam o alvo.',
        'A força bruta testa todos os pares: `O(n²)`. O truque é perceber que, para cada `x`, eu procuro exatamente o **complemento** `alvo - x`.',
      ],
      board: {
        title: 'Two Sum: do O(n²) ao O(n)',
        code: `# Força bruta — O(n²)
def two_sum_lento(nums, alvo):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == alvo:
                return [i, j]


# Hash map — O(n): guardo valor -> índice do que já passou
def two_sum(nums, alvo):
    indice_de = {}
    for i, x in enumerate(nums):
        complemento = alvo - x
        if complemento in indice_de:        # O(1)
            return [indice_de[complemento], i]
        indice_de[x] = i`,
        caption: 'Uma única passada: para cada número, pergunto ao dicionário se o complemento já apareceu.',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Repara num detalhe: eu **procuro primeiro** e **guardo depois**.',
        'Se guardasse antes, com `nums = [3, 2, 4]` e alvo `6`, o `3` encontraria a si mesmo e eu devolveria `[0, 0]`. Bug clássico!',
      ],
    },
    {
      type: 'say',
      text: [
        'O segundo uso é **contagem**. Em vez de chamar `lista.count(x)` para cada elemento — que é `O(n²)` —, conte tudo numa passada.',
        'O `Counter` faz isso pra você, e ainda compara contagens com `==`.',
      ],
      board: {
        title: 'Contando com dict e Counter',
        code: `from collections import Counter, defaultdict

palavras = ["ana", "bia", "ana", "caio", "bia", "ana"]

# 1) dict manual
contagem = {}
for p in palavras:
    contagem[p] = contagem.get(p, 0) + 1

# 2) defaultdict
contagem = defaultdict(int)
for p in palavras:
    contagem[p] += 1

# 3) Counter
contagem = Counter(palavras)
print(contagem.most_common(1))            # [('ana', 3)]
print(Counter("roma") == Counter("amor")) # True — são anagramas`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Curiosidade de bastidor: o `dict` do Python esconde alguns segredos.',
        'Um deles já derrubou servidores inteiros com um único request.',
      ],
      board: {
        title: 'Segredos do dict do CPython',
        md: `**Como o \`dict\` acha uma chave:** calcula \`hash(chave)\`, usa os bits baixos como posição e, se houver **colisão de hash**, sonda outras posições (**endereçamento aberto**). No fim, confirma com \`==\`.

\`\`\`python
>>> {1: "int", 1.0: "float", True: "bool"}
{1: 'bool'}          # 1 == 1.0 == True e o hash é igual: é UMA chave só
>>> hash(-1), hash(-2)
(-2, -2)             # -1 é reservado como código de erro na API C do CPython
\`\`\`

> [!sabia] Em 2011, pesquisadores apresentaram o **hash flooding** (HashDoS): um POST com milhares de parâmetros que colidem de propósito ocupava a CPU de servidores em PHP, Java, Python e Ruby por minutos — cada inserção virava \`O(n)\`. A resposta do Python foi a **randomização de hash**: o hash de \`str\` muda a cada execução (veja \`PYTHONHASHSEED\`). Por isso, **nunca** salve \`hash(texto)\` em disco ou banco.

> [!dica] Regra do modelo de dados: se \`a == b\`, então \`hash(a) == hash(b)\`. É por isso que objetos mutáveis, como \`list\`, não podem ser chaves.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Two Sum, anagramas e o trade-off do hash map.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-hash-q1',
      concept: 'Hash Map',
      say: 'Pergunta de abordagem, como no começo de uma entrevista.',
      prompt: 'Para o **Two Sum** numa lista **não ordenada**, qual abordagem tem a melhor complexidade de tempo?',
      options: [
        { text: 'Testar todos os pares com dois loops.', why: 'Correto, mas `O(n²)`.' },
        { text: 'Ordenar e usar dois ponteiros.', why: 'Fica `O(n log n)` por causa da ordenação — e você perde os índices originais, precisando guardá-los.' },
        { text: 'Um dicionário valor → índice, procurando o complemento numa única passada.', correct: true, why: '`O(n)` de tempo e `O(n)` de espaço.' },
        { text: 'Busca binária do complemento para cada elemento, sem ordenar.', why: 'Busca binária só funciona em dados **ordenados**.' },
      ],
      explanation: 'O hash map troca `O(n)` de memória por tempo `O(n)`: cada consulta ao complemento é `O(1)` em média.',
    },
    {
      type: 'code',
      id: 'lc-hash-q2',
      concept: 'Hash Map',
      title: 'Two Sum',
      say: 'LeetCode 1, o problema mais famoso de todos. Tem teste de desempenho: força bruta não vai passar liso.',
      prompt: `Implemente \`two_sum(nums, target)\` que devolve os **índices** \`[i, j]\` de dois números distintos (\`i != j\`) cuja soma é \`target\`.

- Existe **exatamente uma** solução.
- Não use o mesmo elemento duas vezes.
- A ordem dos dois índices não importa.

Objetivo: **\`O(n)\` de tempo**.`,
      starter: `def two_sum(nums, target):
    pass
`,
      tests: [
        { name: 'exemplo 1', expr: 'two_sum([2, 7, 11, 15], 9)', expected: '[0, 1]', compare: 'sorted' },
        { name: 'não reutilizar o mesmo elemento', expr: 'two_sum([3, 2, 4], 6)', expected: '[1, 2]', compare: 'sorted' },
        { name: 'valores repetidos', expr: 'two_sum([3, 3], 6)', expected: '[0, 1]', compare: 'sorted' },
        { name: 'negativos e zero', expr: 'two_sum([-3, 4, 3, 90], 0)', expected: '[0, 2]', compare: 'sorted' },
        { expr: 'two_sum([1, 5, 9, -2], 7)', expected: '[2, 3]', compare: 'sorted', hidden: true },
        { expr: 'two_sum([0, 4, 3, 0], 0)', expected: '[0, 3]', compare: 'sorted', hidden: true },
      ],
      perfTests: [
        {
          name: 'n = 8.000, par no final',
          setup: 'nums = list(range(8000))',
          expr: 'two_sum(nums, 15997)',
          expected: '[7998, 7999]',
          compare: 'sorted',
          maxMs: 150,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Hash Map — busca do complemento em O(1)',
      reviews: [
        {
          when: m => m.loopDepth >= 2,
          text: 'Dois loops aninhados testam todos os pares: `O(n²)`. Guarde valor → índice num `dict` e procure o complemento.',
          concept: 'Hash Map',
        },
        {
          when: m => m.calls.includes('index'),
          text: '`nums.index(...)` faz uma busca linear `O(n)` a cada chamada. O `dict` já guarda o índice pronto.',
          concept: 'Custo de operações em list',
        },
      ],
      hints: [
        'Para cada `x`, o número que você procura é `target - x`. Como saber em `O(1)` se ele já apareceu?',
        'Use um `dict` que mapeia **valor → índice** dos números já visitados.',
        'Dentro do loop: primeiro verifique se o complemento está no dict; só **depois** guarde `x`.',
      ],
      solution: `def two_sum(nums, target):
    indice_de = {}
    for i, x in enumerate(nums):
        complemento = target - x
        if complemento in indice_de:
            return [indice_de[complemento], i]
        indice_de[x] = i
`,
      solutionExplanation: 'Uma passada com um `dict` valor → índice. **Tempo `O(n)`**, **espaço `O(n)`**. Verificar antes de inserir evita usar o mesmo elemento duas vezes e trata corretamente repetidos como `[3, 3]`.',
    },
    {
      type: 'mcq',
      id: 'lc-hash-q3',
      concept: 'Ordem de inserção no Hash Map',
      say: 'Achar bugs é tão importante quanto escrever código. O que sai aqui?',
      prompt: `O que \`two_sum_bug([3, 2, 4], 6)\` devolve?

\`\`\`python
def two_sum_bug(nums, alvo):
    visto = {}
    for i, x in enumerate(nums):
        visto[x] = i                  # guarda ANTES de procurar
        if alvo - x in visto:
            return [visto[alvo - x], i]
\`\`\``,
      options: [
        { text: '`[1, 2]`', why: 'Essa seria a resposta certa, mas o código para antes.' },
        { text: '`[0, 0]`', correct: true, why: 'Na primeira volta, `3` é guardado e `6 - 3 = 3` já está no dict: ele encontra a si mesmo.' },
        { text: '`None`', why: 'O código retorna logo na primeira iteração.' },
        { text: 'Lança `KeyError`.', why: 'O `in` verifica antes de acessar, então não há `KeyError`.' },
      ],
      explanation: 'Inserir antes de consultar permite que um elemento "case" consigo mesmo. A ordem correta é **consultar e depois inserir**.',
    },
    {
      type: 'match',
      id: 'lc-rx-hash-q1',
      concept: 'Escolha da estrutura hash',
      say: 'Bate-bola: qual ferramenta do Python para cada pergunta?',
      prompt: 'Associe cada problema à estrutura mais adequada.',
      pairs: [
        { left: '"Já vi este número antes?"', right: '`set` com os valores vistos' },
        { left: 'Two Sum: onde está o complemento?', right: '`dict` valor → índice' },
        { left: 'As 3 palavras mais frequentes de um texto', right: '`Counter(palavras).most_common(3)`' },
        { left: 'Agrupar palavras que são anagramas', right: '`defaultdict(list)` com a chave `"".join(sorted(p))`' },
      ],
      explanation: 'Pertinência pura ("já vi?") pede `set`. Quando você precisa **lembrar algo** sobre o valor — o índice, no Two Sum — use `dict`. Contagem é o caso de uso do `Counter`, que ainda traz `most_common`. Para agrupar, a chave precisa ser **igual para itens equivalentes** e **hasheável**: as letras ordenadas viram uma assinatura canônica do anagrama, e o `defaultdict(list)` evita checar se a chave já existe.',
    },
    {
      type: 'code',
      id: 'lc-hash-q4',
      concept: 'Counter',
      title: 'Valid Anagram',
      say: 'Agora contagem. LeetCode 242: duas strings são anagramas uma da outra?',
      prompt: `Implemente \`is_anagram(s, t)\` que devolve \`True\` se \`t\` é um **anagrama** de \`s\` — mesmas letras, nas mesmas quantidades, em qualquer ordem.

Objetivo: **\`O(n)\` de tempo**, contando caracteres.`,
      starter: `def is_anagram(s, t):
    pass
`,
      tests: [
        { name: 'exemplo 1', expr: 'is_anagram("anagram", "nagaram")', expected: 'True' },
        { name: 'exemplo 2', expr: 'is_anagram("rat", "car")', expected: 'False' },
        { name: 'strings vazias', expr: 'is_anagram("", "")', expected: 'True' },
        { name: 'tamanhos diferentes', expr: 'is_anagram("a", "ab")', expected: 'False' },
        { name: 'mesmas letras, quantidades diferentes', expr: 'is_anagram("aacc", "ccac")', expected: 'False' },
        { expr: 'is_anagram("amor", "roma")', expected: 'True', hidden: true },
        { expr: 'is_anagram("ab", "a")', expected: 'False', hidden: true },
      ],
      perfTests: [
        {
          name: 'strings com 30.000 caracteres',
          setup: 's = "".join(chr(97 + (i * 7) % 26) for i in range(30000))\nt = s[::-1]',
          expr: 'is_anagram(s, t)',
          expected: 'True',
          maxMs: 120,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Counter / contagem em O(n)',
      reviews: [
        {
          when: m => m.calls.includes('remove'),
          text: '`list.remove` é `O(n)` (procura e desloca elementos); dentro de um loop vira `O(n²)`. Conte as letras com `Counter` ou `dict`.',
          concept: 'Custo de operações em list',
        },
        {
          when: m => m.calls.includes('count') && m.loops > 0,
          text: 'Chamar `.count()` dentro de um loop percorre a string a cada volta. Conte tudo em uma passada com `Counter`.',
          concept: 'Counter',
        },
      ],
      hints: [
        'Se os tamanhos forem diferentes, já pode devolver `False`.',
        'Conte quantas vezes cada letra aparece em cada string e compare as contagens.',
        '`from collections import Counter` — e `Counter(s) == Counter(t)` resolve.',
      ],
      solution: `from collections import Counter


def is_anagram(s, t):
    if len(s) != len(t):
        return False
    return Counter(s) == Counter(t)
`,
      solutionExplanation: 'Contar as letras com `Counter` é **`O(n)` de tempo** e **`O(k)` de espaço** (k = tamanho do alfabeto). Ordenar (`sorted(s) == sorted(t)`) também funciona, em `O(n log n)`. Checar o tamanho antes é uma saída rápida barata.',
    },
    {
      type: 'open',
      id: 'lc-hash-q5',
      concept: 'Trade-off espaço/tempo',
      say: 'Pergunta conceitual, bem comum em entrevista.',
      prompt: 'Quando você **não** usaria um hash map para resolver um problema, mesmo ele deixando a solução mais rápida? Cite os trade-offs.',
      minWords: 15,
      rubric: [
        { label: 'Cita o **uso de memória** extra (`O(n)` de espaço)', keywords: ['memoria', 'espaco', 'o(n) de espaco'], concept: 'Complexidade de espaço', why: 'O hash map guarda dados extras; com memória limitada isso pesa.' },
        { label: 'Menciona que hash map **não mantém ordem** / não serve para buscas por faixa', keywords: ['ordem', 'ordenad', 'faixa', 'intervalo', 'range', 'menor', 'maior'], concept: 'Estruturas ordenadas', why: 'Para "o menor maior que X" ou percorrer em ordem, ordenação ou árvores são melhores.' },
        { label: 'Lembra que se os dados já estão **ordenados**, dois ponteiros ou busca binária resolvem com `O(1)` de espaço', keywords: ['dois ponteiros', 'two pointers', 'busca binaria', 'binary search', 'ja ordenad', 'ja esta ordenad'], concept: 'Two Pointers', why: 'Aproveitar a estrutura da entrada evita memória extra.' },
        { label: 'Cita **colisões**/pior caso ou a necessidade de chaves **hasheáveis**', keywords: ['colis', 'pior caso', 'hashe', 'imutave', 'mutave'], concept: 'Tabela hash', why: 'O `O(1)` é médio; e listas/dicts não podem ser chaves.' },
      ],
      modelAnswer: `O hash map troca **memória por tempo**: usa \`O(n)\` de espaço extra. Se a memória é limitada (ou os dados são enormes), isso pode ser inaceitável.

Ele também **não mantém ordem**: para consultas por faixa ("todos entre 10 e 20", "o menor maior que X") uma lista ordenada com busca binária ou uma árvore é melhor.

Se a entrada **já está ordenada**, técnicas como **dois ponteiros** ou **busca binária** resolvem com \`O(1)\` de espaço.

Por fim, o \`O(1)\` é **médio** — com muitas **colisões** pode degradar — e as chaves precisam ser **hasheáveis** (imutáveis).`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Guarde o padrão: **"e se eu lembrasse do que já vi?"** → `dict`/`set`. Para contar → `Counter`.',
        'E sempre mencione o custo: `O(n)` de memória extra. No próximo módulo, veremos como economizar essa memória com **dois ponteiros**.',
      ],
      board: null,
    },
  ],
});
