Game.registerModule('leetcode', {
  id: 'trie',
  title: 'Trie (Árvore de Prefixos)',
  kind: 'lesson',
  level: 2,
  order: 25,
  unit: 'estruturas',
  summary: 'Uma árvore em que cada aresta é uma letra: palavras e prefixos em O(L), autocomplete e contagem de prefixos — e quando um simples set ganha dela.',
  concepts: ['Trie', 'Busca por prefixo', 'Contagem de prefixos', 'Autocomplete', 'Memória × velocidade'],
  takeaways: [
    'Uma **trie** guarda strings letra a letra: cada nó é um **prefixo** e um marcador de fim diz onde uma palavra termina. Inserir, buscar e testar prefixo custam **`O(L)`** — não importa quantas palavras existam.',
    '`search` e `starts_with` só diferem no final: a palavra exige o **marcador de fim**; o prefixo só exige que o caminho exista. Sem o marcador, `"sol"` "existe" só porque `"sola"` foi inserida.',
    'Contadores nos nós (`passam` e `terminam`) respondem "quantas palavras começam com `p`?" em `O(P)`, sendo `P` o tamanho do prefixo — sem visitar a subárvore.',
    'Autocomplete: desça até o nó do prefixo e liste o que está abaixo — ou **pré-calcule** as melhores sugestões em cada nó e responda em `O(P)`, trocando memória por tempo.',
    'Para palavras **exatas**, um `set` é mais simples e mais econômico; para dicionário fixo, lista ordenada + `bisect` acha prefixos em `O(P log n)`. A trie vale com **muitas consultas por prefixo** — e cobra caro em memória no Python.',
  ],
  glossary: [
    { term: 'Trie', aliases: ['tries', 'árvore de prefixos', 'árvores de prefixos', 'prefix tree', 'árvore digital'], definition: 'Árvore em que cada aresta é um caractere e cada nó representa um **prefixo**. Buscar uma palavra de tamanho `L` custa `O(L)`, não importa quantas palavras estejam guardadas.' },
    { term: 'Radix tree', aliases: ['radix trees', 'árvore radix', 'Patricia trie', 'PATRICIA', 'trie compactada', 'compressed trie'], definition: 'Trie **compactada**: cadeias de nós com um único filho viram uma só aresta, rotulada por uma string. Economiza muita memória; aparece em tabelas de rotas IP e em índices de bancos de dados e de kernels.' },
    { term: 'Longest prefix match', aliases: ['longest-prefix match', 'maior prefixo correspondente', 'casamento do prefixo mais longo'], definition: 'Regra dos roteadores: entre as rotas cujo prefixo casa com o IP de destino, vence a **mais específica** (a mais longa). Tries binárias percorrem os bits do endereço guardando a última rota vista no caminho.' },
    { term: 'DAWG', aliases: ['DAFSA', 'directed acyclic word graph', 'grafo acíclico de palavras'], definition: '*Directed Acyclic Word Graph*: uma trie que também **compartilha sufixos**, fundindo nós equivalentes. Guarda dicionários enormes em pouca memória — foi o truque do "programa de Scrabble mais rápido do mundo" (Appel e Jacobson, 1988).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Sabe o autocomplete da barra de busca? Você digita "pro" e ele já sugere "programa", "projeto", "prova"…',
        'A estrutura clássica por trás disso é a **trie**, a árvore de prefixos. Cada aresta é uma **letra**, e palavras com o mesmo começo **compartilham** o caminho.',
      ],
      board: {
        title: 'Trie — a árvore de prefixos',
        md: `Palavras: \`sal\`, \`sol\`, \`sola\`, \`solo\`, \`mar\`

\`\`\`text
(raiz)
├── s
│   ├── a
│   │   └── l *          sal
│   └── o
│       └── l *          sol
│           ├── a *      sola
│           └── o *      solo
└── m
    └── a
        └── r *          mar           * = aqui termina uma palavra
\`\`\`

- Cada nó é um **prefixo**: o nó ao fim de \`s → o → l\` representa "sol".
- \`sol\` é palavra **e** prefixo de \`sola\`/\`solo\`: por isso cada nó precisa de um marcador de **fim**.
- Buscar uma palavra de \`L\` letras desce \`L\` níveis: **\`O(L)\`**, com 5 ou 5 milhões de palavras guardadas.

Sendo \`L\` o tamanho da palavra, \`P\` o do prefixo e \`n\` o número de palavras:

| Pergunta | \`list\` | \`set\` | Trie |
|---|---|---|---|
| A palavra existe? | \`O(n·L)\` | \`O(L)\` (hash) | \`O(L)\` |
| Alguma começa com o prefixo? | \`O(n·P)\` | \`O(n·P)\` (varre tudo) | \`O(P)\` |
| Quantas começam com o prefixo? | \`O(n·P)\` | \`O(n·P)\` | \`O(P)\`, com contadores |

> [!sabia] O nome vem de re**trie**val ("recuperação"). Edward Fredkin, que o cunhou em 1960, pronunciava *"tree"* — igualzinho a árvore em inglês —, o que só gerava confusão; por isso muita gente passou a dizer *"try"*. A estrutura em si tinha sido descrita um ano antes por René de la Briandais.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na implementação, cada nó é um `dict` de filhos (letra → nó) mais o marcador de fim.',
        '`search` e `starts_with` descem pelo **mesmo** caminho — a única diferença é o que exigem no final.',
      ],
      board: {
        title: 'Implementação (LeetCode 208)',
        md: `\`\`\`python
class No:
    __slots__ = ("filhos", "fim")      # sem __dict__ por nó: economiza memória

    def __init__(self):
        self.filhos = {}               # letra -> No
        self.fim = False               # alguma palavra termina aqui?


class Trie:
    def __init__(self):
        self.raiz = No()

    def insert(self, palavra):
        no = self.raiz
        for c in palavra:
            if c not in no.filhos:
                no.filhos[c] = No()
            no = no.filhos[c]
        no.fim = True

    def _descer(self, s):
        """Devolve o nó do prefixo s, ou None se o caminho não existe."""
        no = self.raiz
        for c in s:
            no = no.filhos.get(c)
            if no is None:
                return None
        return no

    def search(self, palavra):
        no = self._descer(palavra)
        return no is not None and no.fim           # precisa TERMINAR aqui

    def starts_with(self, prefixo):
        return self._descer(prefixo) is not None   # basta o caminho existir
\`\`\`

> [!atencao] \`no.filhos.setdefault(c, No())\` parece mais curto, mas cria um \`No()\` **descartável** a cada letra, mesmo quando o filho já existe: o argumento é avaliado antes da chamada. Em milhões de inserções, isso pesa.

> [!dica] Letras acentuadas são caracteres diferentes: \`"ç" != "c"\`. Se a busca deve ignorar acentos e maiúsculas, **normalize** as palavras antes de inserir e antes de buscar (\`casefold()\` e \`unicodedata.normalize\`).`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora, dois superpoderes. Primeiro: com **contadores** nos nós, "quantas palavras começam com `so`?" sai em `O(P)`, sem visitar a subárvore.',
        'Segundo: **autocomplete**. Dá para descer até o nó do prefixo e explorar o que está abaixo dele — ou deixar as sugestões **prontas** em cada nó.',
      ],
      board: {
        title: 'Contagem de prefixos e autocomplete',
        md: `**Contadores:** cada nó guarda \`passam\` (quantas palavras passam por ele) e \`terminam\` (quantas terminam exatamente nele).

\`\`\`text
inseridas: "sol", "sola", "solo", "sal"

s  (passam=4)
├── o  (passam=3)
│   └── l  (passam=3, terminam=1)       "sol", "sola" e "solo" passam aqui
│       ├── a  (passam=1, terminam=1)
│       └── o  (passam=1, terminam=1)
└── a  (passam=1)
    └── l  (passam=1, terminam=1)

quantas começam com "so"?   desce s -> o   ->   passam = 3
\`\`\`

**Autocomplete — duas estratégias:**

| Estratégia | Custo de cada consulta | Memória extra |
|---|---|---|
| DFS a partir do nó do prefixo, visitando os filhos em ordem alfabética | \`O(P)\` + o que a DFS percorrer até juntar \`k\` palavras | nenhuma |
| **Top-k pré-calculado**: cada nó guarda suas \`k\` melhores sugestões | \`O(P + k)\` | até \`k\` referências por nó |

A segunda troca **memória por tempo**: o trabalho de escolher as sugestões é feito uma vez, na montagem, e não a cada tecla digitada.

> [!dica] Contadores também facilitam **apagar**: subtraia 1 ao longo do caminho e, quando \`passam\` chegar a zero, o ramo inteiro pode ser removido.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o lado B: **memória**. Em Python, cada nó é um objeto com um `dict` dentro — e isso custa caro.',
        'Antes de sair montando trie, pergunte: eu preciso mesmo de consultas por **prefixo**? Muitas vezes, um `set` ou uma lista ordenada resolvem.',
      ],
      board: {
        title: 'Memória e alternativas',
        md: `No CPython de 64 bits, um nó com \`__slots__\` e um \`dict\` de filhos custa na faixa de **100 a 250 bytes** — para representar **uma letra**. Uma trie com 100 mil palavras tem centenas de milhares de nós.

| Estrutura | Memória | Consulta por prefixo | Quando usar |
|---|---|---|---|
| \`set\` de palavras | baixa | não faz (varre tudo) | só palavras **exatas** |
| Lista ordenada + \`bisect\` | mínima | \`O(P log n)\` até o começo do bloco | dicionário **fixo** |
| Trie com \`dict\` por nó | alta | \`O(P)\` | muitas consultas, inserções frequentes |
| Radix tree / DAWG | média a baixa | \`O(P)\` | dicionários enormes |

Numa lista **ordenada**, as palavras com um mesmo prefixo formam um **bloco contíguo**:

\`\`\`python
from bisect import bisect_left

palavras = sorted(["mar", "sal", "sol", "sola", "solo"])
i = bisect_left(palavras, "sol")                   # 2: início do bloco "sol..."
[w for w in palavras[i:i + 3] if w.startswith("sol")]   # ['sol', 'sola', 'solo']
\`\`\`

> [!sabia] Existem tries "comprimidas" com nomes curiosos. A **Patricia trie** (1968) — sigla de *Practical Algorithm To Retrieve Information Coded In Alphanumeric* — junta cadeias de nós de filho único numa aresta só, e é a base de tabelas de rotas IP, onde vale o **longest prefix match**. Já o **DAWG** também funde **sufixos** iguais: foi o segredo do "programa de Scrabble mais rápido do mundo" (Appel e Jacobson, 1988).`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Marcador de fim, contadores, autocomplete e memória.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'lc-trie-q1',
      concept: 'Trie',
      multiple: true,
      say: 'Aquecimento: rastreie a trie de cabeça. Pode haver mais de uma certa!',
      prompt: 'Numa trie **vazia**, você insere apenas `"sola"` e `"solo"`. Quais chamadas devolvem `True`?',
      options: [
        { text: '`search("sol")`', why: 'O caminho `s → o → l` existe, mas nenhuma palavra **termina** ali: o marcador de fim desse nó é `False`.' },
        { text: '`starts_with("sol")`', correct: true, why: 'Para prefixo basta o caminho existir — e `s → o → l` existe.' },
        { text: '`search("solo")`', correct: true, why: '`"solo"` foi inserida: o caminho existe e o último nó tem o marcador de fim.' },
        { text: '`starts_with("solar")`', why: 'Depois de `s → o → l → a` não existe filho `r`: o caminho quebra.' },
      ],
      explanation: '`search` e `starts_with` descem pelo **mesmo** caminho; só muda a exigência no final. Sem o marcador de fim, a trie diria que `"sol"` existe só porque `"sola"` foi inserida — o bug clássico de quem implementa trie pela primeira vez.',
    },
    {
      type: 'code',
      id: 'lc-trie-q2',
      concept: 'Contagem de prefixos',
      title: 'Implement Trie II',
      say: 'LeetCode 1804: agora a trie conta. Palavras podem se repetir — e podem ser apagadas.',
      prompt: `Implemente a classe \`Trie\` com:

- \`insert(word)\` — insere \`word\` (a mesma palavra pode ser inserida **várias vezes**);
- \`count_words_equal_to(word)\` — quantas vezes \`word\` está guardada;
- \`count_words_starting_with(prefix)\` — quantas palavras guardadas começam com \`prefix\` (repetições contam; o prefixo vazio \`""\` conta todas);
- \`erase(word)\` — remove **uma** ocorrência de \`word\`; se ela não estiver guardada, **não faz nada**.

Objetivo: cada operação em **\`O(L)\`**, sendo \`L\` o tamanho do argumento — sem percorrer as palavras guardadas.`,
      starter: `class Trie:
    def __init__(self):
        pass

    def insert(self, word):
        pass

    def count_words_equal_to(self, word):
        pass

    def count_words_starting_with(self, prefix):
        pass

    def erase(self, word):
        pass
`,
      tests: [
        { name: 'palavra repetida conta duas vezes', code: `t = Trie()
t.insert("apple")
t.insert("apple")
got = t.count_words_equal_to("apple")
assert got == 2, f"count_words_equal_to('apple') devolveu {got}, esperado 2"
got = t.count_words_starting_with("app")
assert got == 2, f"count_words_starting_with('app') devolveu {got}, esperado 2"` },
        { name: 'prefixo não é palavra', code: `t = Trie()
t.insert("app")
t.insert("apple")
got = t.count_words_equal_to("app")
assert got == 1, f"count_words_equal_to('app') devolveu {got}, esperado 1"
got = t.count_words_equal_to("ap")
assert got == 0, f"count_words_equal_to('ap') devolveu {got}, esperado 0"
got = t.count_words_starting_with("app")
assert got == 2, f"count_words_starting_with('app') devolveu {got}, esperado 2"
got = t.count_words_starting_with("appl")
assert got == 1, f"count_words_starting_with('appl') devolveu {got}, esperado 1"` },
        { name: 'prefixo inexistente', code: `t = Trie()
t.insert("apple")
got = t.count_words_starting_with("b")
assert got == 0, f"count_words_starting_with('b') devolveu {got}, esperado 0"
got = t.count_words_starting_with("applesauce")
assert got == 0, f"count_words_starting_with('applesauce') devolveu {got}, esperado 0"
got = t.count_words_equal_to("banana")
assert got == 0, f"count_words_equal_to('banana') devolveu {got}, esperado 0"` },
        { name: 'erase remove só uma ocorrência', code: `t = Trie()
t.insert("apple")
t.insert("apple")
t.erase("apple")
got = t.count_words_equal_to("apple")
assert got == 1, f"depois de um erase, count_words_equal_to('apple') devolveu {got}, esperado 1"
got = t.count_words_starting_with("a")
assert got == 1, f"depois de um erase, count_words_starting_with('a') devolveu {got}, esperado 1"` },
        { name: 'erase de palavra ausente não faz nada', code: `t = Trie()
t.insert("apple")
t.erase("app")
got = t.count_words_starting_with("app")
assert got == 1, f"erase('app') não deveria mudar nada: count_words_starting_with('app') devolveu {got}, esperado 1"
got = t.count_words_equal_to("apple")
assert got == 1, f"erase('app') não deveria mudar nada: count_words_equal_to('apple') devolveu {got}, esperado 1"` },
        { name: 'trie vazia e prefixo vazio', code: `t = Trie()
got = t.count_words_starting_with("")
assert got == 0, f"trie vazia: count_words_starting_with('') devolveu {got}, esperado 0"
t.insert("a")
t.insert("b")
got = t.count_words_starting_with("")
assert got == 2, f"count_words_starting_with('') devolveu {got}, esperado 2"` },
        { hidden: true, code: `t = Trie()
for w in ["casa", "casal", "casamento", "caso", "cama"]:
    t.insert(w)
assert t.count_words_starting_with("cas") == 4
assert t.count_words_starting_with("casa") == 3
t.erase("casal")
assert t.count_words_starting_with("casa") == 2
assert t.count_words_equal_to("casal") == 0
assert t.count_words_equal_to("casa") == 1
t.insert("casal")
assert t.count_words_equal_to("casal") == 1
assert t.count_words_starting_with("ca") == 5` },
        { hidden: true, code: `t = Trie()
t.insert("x")
t.erase("x")
t.erase("x")
assert t.count_words_equal_to("x") == 0, "apagar duas vezes não pode deixar contagem negativa"
assert t.count_words_starting_with("") == 0
assert t.count_words_starting_with("x") == 0
t.insert("x")
assert t.count_words_equal_to("x") == 1
assert t.count_words_starting_with("") == 1` },
        { hidden: true, code: `t = Trie()
t.insert("sol")
t.insert("sola")
t.erase("sol")
assert t.count_words_equal_to("sol") == 0
assert t.count_words_equal_to("sola") == 1
assert t.count_words_starting_with("sol") == 1
t.erase("sola")
assert t.count_words_starting_with("s") == 0` },
      ],
      perfTests: [
        {
          name: '3.000 palavras guardadas, 2.500 consultas de prefixo',
          setup: `import random
from collections import Counter
_r = random.Random(2024)
_palavras = ["".join(_r.choice("abcdef") for _ in range(_r.randint(3, 9))) for _ in range(3000)]
consultas = ["".join(_r.choice("abcdef") for _ in range(_r.randint(1, 4))) for _ in range(2500)]
t = Trie()
for _p in _palavras:
    t.insert(_p)
_prefixos = Counter(_p[:_k] for _p in _palavras for _k in range(len(_p) + 1))
_esperado = sum(_prefixos[_q] for _q in consultas)`,
          expr: 'sum(t.count_words_starting_with(q) for q in consultas)',
          expected: '_esperado',
          maxMs: 30,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Contadores nos nós — O(P) por consulta',
      reviews: [
        {
          when: m => m.calls.includes('startswith'),
          text: 'Varrer as palavras guardadas com `startswith` custa `O(n·P)` por consulta. Na trie, cada nó já sabe quantas palavras **passam** por ele: desça pelo prefixo e leia o contador.',
          concept: 'Contagem de prefixos',
        },
      ],
      hints: [
        'Troque o booleano de fim por **dois contadores** em cada nó: `passam` (quantas palavras passam pelo nó) e `terminam` (quantas terminam nele).',
        'No `insert`, some 1 em `passam` de cada nó do caminho — inclusive a raiz, que responde pelo prefixo vazio — e 1 em `terminam` no último nó. As consultas só descem pelo caminho e leem o contador, ou devolvem `0` se o caminho quebrar.',
        'No `erase`, confira **antes** se a palavra existe (`count_words_equal_to(word) > 0`). Se existir, desça subtraindo 1 de `passam` em cada nó e 1 de `terminam` no último.',
      ],
      solution: `class No:
    __slots__ = ("filhos", "passam", "terminam")

    def __init__(self):
        self.filhos = {}
        self.passam = 0          # palavras que passam por este nó (prefixos)
        self.terminam = 0        # palavras que terminam exatamente aqui


class Trie:
    def __init__(self):
        self.raiz = No()

    def insert(self, word):
        no = self.raiz
        no.passam += 1
        for c in word:
            if c not in no.filhos:
                no.filhos[c] = No()
            no = no.filhos[c]
            no.passam += 1
        no.terminam += 1

    def _descer(self, s):
        no = self.raiz
        for c in s:
            no = no.filhos.get(c)
            if no is None:
                return None
        return no

    def count_words_equal_to(self, word):
        no = self._descer(word)
        return no.terminam if no else 0

    def count_words_starting_with(self, prefix):
        no = self._descer(prefix)
        return no.passam if no else 0

    def erase(self, word):
        if self.count_words_equal_to(word) == 0:
            return                           # nada a apagar
        no = self.raiz
        no.passam -= 1
        for c in word:
            filho = no.filhos[c]
            filho.passam -= 1
            if filho.passam == 0:
                del no.filhos[c]             # ramo vazio: libera a memória
                return
            no = filho
        no.terminam -= 1
`,
      solutionExplanation: 'Cada operação desce no máximo `L` níveis: **tempo `O(L)`** por operação, **espaço proporcional ao total de letras inseridas**. `passam` responde prefixos sem visitar a subárvore; `terminam` distingue palavra de prefixo e conta repetições. O `erase` confere a existência **antes** de mexer — senão, apagar `"app"` quando só existe `"apple"` estragaria os contadores do caminho. De bônus, quando `passam` chega a zero, o ramo inteiro é removido e a memória volta.',
    },
    {
      type: 'code',
      id: 'lc-trie-q3',
      concept: 'Autocomplete',
      title: 'Autocomplete com top-3',
      say: 'Agora o autocomplete. O índice é montado uma vez; as consultas chegam aos milhares.',
      prompt: `Implemente a classe \`Autocomplete\`:

- \`Autocomplete(palavras)\` — monta o índice a partir de uma lista de palavras (pode haver **repetidas**);
- \`sugerir(prefixo)\` — devolve as **até 3** palavras **distintas** que começam com \`prefixo\`, as primeiras em **ordem alfabética** (a ordem de \`sorted\`). Sem nenhuma, devolve \`[]\`. O prefixo vazio vale para todas as palavras.

O construtor roda **uma vez**; \`sugerir\` será chamado milhares de vezes. Objetivo: cada consulta em **\`O(P)\`**, sendo \`P\` o tamanho do prefixo.`,
      starter: `class Autocomplete:
    def __init__(self, palavras):
        pass

    def sugerir(self, prefixo):
        pass
`,
      tests: [
        { name: 'exemplo', expr: 'Autocomplete(["mouse", "monitor", "mousepad", "moneypot", "mobile"]).sugerir("mo")', expected: '["mobile", "moneypot", "monitor"]' },
        { name: 'prefixo mais longo', expr: 'Autocomplete(["mouse", "monitor", "mousepad", "moneypot", "mobile"]).sugerir("mou")', expected: '["mouse", "mousepad"]' },
        { name: 'nenhuma palavra com o prefixo', expr: 'Autocomplete(["sol", "sal"]).sugerir("x")', expected: '[]' },
        { name: 'repetidas aparecem uma vez só', expr: 'Autocomplete(["casa", "casa", "casa", "caso"]).sugerir("cas")', expected: '["casa", "caso"]' },
        { name: 'o próprio prefixo é palavra', expr: 'Autocomplete(["sol", "sola", "solo", "solar"]).sugerir("sol")', expected: '["sol", "sola", "solar"]' },
        { name: 'prefixo vazio', expr: 'Autocomplete(["b", "c", "a", "d"]).sugerir("")', expected: '["a", "b", "c"]' },
        { expr: 'Autocomplete([]).sugerir("a")', expected: '[]', hidden: true },
        { expr: 'Autocomplete(["abc"]).sugerir("abcd")', expected: '[]', hidden: true },
        { expr: 'Autocomplete(["zeta", "alfa", "beta", "alfabeto", "alface", "alfinete"]).sugerir("alf")', expected: '["alfa", "alfabeto", "alface"]', hidden: true },
        { hidden: true, code: `a = Autocomplete(["banana", "bandana", "banda", "bando", "ban"])
assert a.sugerir("band") == ["banda", "bandana", "bando"], a.sugerir("band")
assert a.sugerir("b") == ["ban", "banana", "banda"], a.sugerir("b")
r = a.sugerir("ban")
r.append("intrusa")
assert a.sugerir("ban") == ["ban", "banana", "banda"], "mexer na lista devolvida não pode alterar o índice"` },
      ],
      perfTests: [
        {
          name: '4.000 palavras no índice, 2.000 consultas',
          setup: `import random
from bisect import bisect_left
_r = random.Random(7)
_palavras = ["".join(_r.choice("abcdefghij") for _ in range(_r.randint(3, 8))) for _ in range(4000)]
consultas = ["".join(_r.choice("abcdefghij") for _ in range(_r.randint(1, 3))) for _ in range(2000)]
a = Autocomplete(_palavras)
_ordenadas = sorted(set(_palavras))
_esperado = []
for _q in consultas:
    _i = bisect_left(_ordenadas, _q)
    _esperado.append([_w for _w in _ordenadas[_i:_i + 3] if _w.startswith(_q)])`,
          expr: '[a.sugerir(q) for q in consultas]',
          expected: '_esperado',
          maxMs: 60,
        },
      ],
      timeoutMs: 12000,
      slowConcept: 'Top-k pré-calculado — O(P) por consulta',
      reviews: [
        {
          when: (m, code) => /for\s+\w+\s+in\s+(?:sorted\s*\(\s*)?self\.\w+\s*\)?\s*(?::\s*(?:#[^\n]*)?\n\s*)?if\s+[\w.]+\.startswith/.test(code),
          text: 'Filtrar a lista inteira com `startswith` a cada consulta custa `O(n·P)` — com milhares de consultas, isso domina tudo. Monte o índice uma vez (trie) e responda descendo só `P` níveis.',
          concept: 'Autocomplete',
        },
        {
          when: (m, code) => {
            const corpo = (code.match(/def\s+sugerir\b[\s\S]*?(?=\n[ \t]*def\s|\n\S|$)/) || [''])[0];
            return /\bsorted\s*\(|\.sort\s*\(/.test(corpo);
          },
          text: 'Ordenar dentro de `sugerir` repete, a cada tecla, um trabalho que só precisa ser feito uma vez. Insira as palavras **já ordenadas** no construtor e guarde o top-3 pronto em cada nó.',
          concept: 'Memória × velocidade',
        },
      ],
      hints: [
        'Faça o trabalho pesado **no construtor**: ordene as palavras distintas (`sorted(set(palavras))`) e insira-as numa trie nessa ordem.',
        'Dê a cada nó uma lista `top`. Ao inserir uma palavra, em cada nó do caminho faça `if len(no.top) < 3: no.top.append(palavra)` — como as palavras chegam em ordem alfabética, as 3 primeiras que passam por um nó são as 3 menores.',
        'Em `sugerir`, desça pelo prefixo; se o caminho quebrar, devolva `[]`; senão, devolva uma **cópia** de `no.top`. Não esqueça a raiz: ela atende o prefixo vazio.',
      ],
      solution: `class No:
    __slots__ = ("filhos", "top")

    def __init__(self):
        self.filhos = {}
        self.top = []            # até 3 menores palavras que passam por aqui


class Autocomplete:
    def __init__(self, palavras):
        self.raiz = No()
        for p in sorted(set(palavras)):      # em ordem: as primeiras a chegar são as menores
            no = self.raiz
            if len(no.top) < 3:
                no.top.append(p)             # a raiz atende o prefixo vazio
            for c in p:
                if c not in no.filhos:
                    no.filhos[c] = No()
                no = no.filhos[c]
                if len(no.top) < 3:
                    no.top.append(p)

    def sugerir(self, prefixo):
        no = self.raiz
        for c in prefixo:
            no = no.filhos.get(c)
            if no is None:
                return []
        return list(no.top)                  # cópia: quem chama não estraga o índice
`,
      solutionExplanation: 'O construtor custa `O(n log n)` comparações de strings para ordenar, mais o total de letras para inserir; cada consulta custa **`O(P)`** para descer e `O(1)` para copiar até 3 sugestões. A memória extra é de no máximo 3 **referências** por nó — as strings não são copiadas. É a troca clássica de memória por tempo. Alternativa elegante sem trie: lista ordenada + `bisect_left(lista, prefixo)` acha o começo do bloco em `O(P log n)` — ótima para dicionário fixo, com bem menos memória.',
    },
    {
      type: 'match',
      id: 'lc-trie-q4',
      concept: 'Memória × velocidade',
      say: 'Bate-bola: qual estrutura para cada cenário?',
      prompt: 'Associe cada cenário à estrutura mais adequada.',
      pairs: [
        { left: 'Checar se um e-mail está numa lista de bloqueio', right: '`set` — busca exata em `O(L)`' },
        { left: 'Autocomplete com milhares de consultas e palavras novas o tempo todo', right: 'Trie com top-k em cada nó' },
        { left: 'Dicionário fixo, pouca memória, busca por prefixo de vez em quando', right: 'Lista ordenada + `bisect`' },
        { left: 'Roteador escolhendo a rota mais específica para um IP', right: 'Patricia trie (longest prefix match)' },
        { left: 'Corretor ortográfico com milhões de palavras em pouca memória', right: 'DAWG (compartilha prefixos e sufixos)' },
        { left: 'Contar quantas palavras começam com cada prefixo digitado', right: 'Trie com contadores nos nós' },
      ],
      explanation: 'A trie é a escolha quando o **prefixo** é a pergunta e os dados mudam. Para busca **exata**, um `set` ganha em simplicidade e memória; para dicionário **fixo**, a lista ordenada com `bisect` acha o bloco de qualquer prefixo em `O(P log n)` quase sem memória extra. Nos extremos de escala entram as variantes compactadas: Patricia/radix nos roteadores e DAWG quando até os sufixos se repetem.',
    },
    {
      type: 'open',
      id: 'lc-trie-q5',
      concept: 'Memória × velocidade',
      say: 'Follow-up de entrevista: o seu autocomplete fez sucesso… e a memória explodiu.',
      prompt: 'O autocomplete com trie em Python passou a guardar **20 milhões** de termos e o processo está usando dezenas de GB de RAM. Como você reduziria a memória? Cite os trade-offs.',
      minWords: 25,
      rubric: [
        { label: 'Compactar a estrutura: **radix/Patricia** (cadeias de filho único viram uma aresta) ou **DAWG** (compartilhar sufixos)', keywords: ['radix', 'patricia', 'compact', 'comprim', 'dawg', 'dafsa', 'sufixo', 'filho unico', 'um filho', 'um unico filho'], concept: 'Radix tree', why: 'Numa trie grande, a maioria dos nós tem um único filho.' },
        { label: 'Mudar a **representação** dos nós: `__slots__`, listas ou arrays no lugar de `dict`, nós como índices em arrays planos', keywords: ['slots', 'array', 'vetor', 'lista de filhos', 'indice', 'plano', 'serializ', 'bytes', 'struct', 'representa'], concept: 'Memória × velocidade', why: 'Em Python, o custo fixo de objeto + `dict` por nó domina a memória.' },
        { label: 'Trocar de estrutura quando couber: **lista ordenada + bisect** ou um índice externo (banco, disco)', keywords: ['bisect', 'ordenad', 'busca binaria', 'banco', 'disco', 'indice externo', 'elasticsearch', 'redis', 'sqlite', 'arquivo'], concept: 'Busca por prefixo', why: 'Um array ordenado de strings ocupa uma fração da trie e ainda acha prefixos em `O(P log n)`.' },
        { label: 'Guardar menos: **podar** termos raros, limitar o top-k, **particionar** por prefixo entre máquinas', keywords: ['podar', 'poda', 'raros', 'frequen', 'top-k', 'top k', 'limitar', 'profundidade', 'particion', 'shard', 'distribu', 'maquinas'], concept: 'Memória × velocidade', why: 'Nem todo termo precisa estar em memória, em todo servidor.' },
      ],
      modelAnswer: `Primeiro eu **compactaria** a trie: numa trie grande, a maioria dos nós tem um filho só, então uma **radix/Patricia tree** junta essas cadeias numa aresta rotulada por uma string. Se muitos termos compartilham os finais, um **DAWG** também funde sufixos. O preço é código mais complexo e inserções mais caras.

Depois mudaria a **representação**: em Python, cada nó é um objeto com um \`dict\`, centenas de bytes. Com \`__slots__\`, listas de filhos ou, melhor ainda, arrays planos (nós como índices inteiros e filhos num \`array\`), a memória cai muito — em troca de legibilidade.

Se o dicionário muda pouco, uma **lista ordenada + \`bisect\`** acha o bloco de qualquer prefixo em \`O(P log n)\` com uma fração da memória; um índice externo, num banco ou em disco, também serve.

Por fim, guardaria menos: **podar** termos raros, manter só o **top-k** de cada nó e **particionar** por prefixo entre máquinas (shards), cada uma com uma fatia do dicionário.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Trie = um caminho por palavra, prefixos compartilhados, **marcador de fim** e consultas em `O(L)`.',
        { text: 'Contadores contam prefixos, top-k pré-calculado acelera o autocomplete — e, se o problema é só busca exata, um `set` resolve com muito menos memória. Até a próxima!', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
