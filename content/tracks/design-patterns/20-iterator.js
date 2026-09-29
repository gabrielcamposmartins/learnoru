Game.registerModule('design-patterns', {
  id: 'iterator',
  title: 'Iterator',
  kind: 'lesson',
  level: 2,
  order: 35,
  unit: 'comportamentais',
  summary: 'Percorrer qualquer coleção sem expor como ela é por dentro: o protocolo `__iter__`/`__next__`, geradores, percursos de árvore e sequências preguiçosas.',
  concepts: ['Iterator', 'Protocolo de iteração', 'Iterador externo × interno', 'Percursos de árvore', 'Avaliação preguiçosa'],
  takeaways: [
    'O Iterator separa **percorrer** de **armazenar**: o cliente só pede "o próximo", sem saber se a coleção é lista, árvore, arquivo ou API paginada.',
    '**Iterável** tem `__iter__` e entrega um cursor **novo** a cada chamada; **iterador** tem `__next__`, devolve `self` no `__iter__` e se esgota. Confundir os dois gera o bug do "segundo `for` vazio".',
    'Um `__iter__` com `yield` é o jeito mais curto de escrever um iterador: o "onde parei" fica nas variáveis locais congeladas entre um `next` e outro — e a coleção continua re-iterável.',
    'Percursos de árvore viram geradores: em profundidade com **pilha** explícita (sem limite de recursão), em largura com **fila** (`deque`). Quem consome pode parar no meio sem pagar pelo resto.',
    'Iteradores **externos** deixam o cliente parar, pausar e intercalar percursos; sequências **preguiçosas** podem até ser infinitas — quem consome decide quando parar.',
  ],
  glossary: [
    { term: 'Protocolo de iteração', aliases: ['protocolo do iterador', 'protocolo de iterador', 'iterator protocol'], definition: '`__iter__` devolve um iterador; o iterador responde a `__next__` com o próximo item ou lança `StopIteration` no fim. É o contrato usado por `for`, `list()`, `sum()`, desempacotamento e `itertools`.' },
    { term: 'Iterador externo', aliases: ['iteradores externos', 'external iterator'], definition: 'Iterador em que o **cliente** controla o avanço, pedindo o próximo item quando quiser (`next(it)`): dá para parar, pausar e intercalar percursos. É o modelo do `for` do Python.' },
    { term: 'Iterador interno', aliases: ['iteradores internos', 'internal iterator'], definition: 'Iterador em que a **coleção** controla o laço e chama uma função sua para cada item (`colecao.para_cada(f)`). Simples de implementar, mas o cliente não consegue pausar nem intercalar dois percursos.' },
    { term: 'Invalidação de iterador', aliases: ['iterador invalidado', 'iteradores invalidados', 'iterator invalidation'], definition: 'Quando a coleção muda enquanto um iterador a percorre. Python detecta alguns casos (`RuntimeError: dictionary changed size during iteration`); em listas, não: o laço pula ou repete itens em silêncio.' },
    { term: 'Same fringe problem', aliases: ['same fringe', 'problema da mesma franja'], definition: 'Problema clássico: duas árvores têm as mesmas folhas, na mesma ordem? Com iteradores externos (geradores) basta comparar item a item e parar na primeira diferença; com internos, é preciso achatar as árvores inteiras.' },
    { term: 'Halloween problem', aliases: ['problema do Halloween'], definition: 'Anomalia descoberta na IBM em 1976: um `UPDATE` que percorria um índice pela coluna que ele mesmo alterava reencontrava as linhas já atualizadas e as atualizava de novo. É invalidação de iterador dentro do banco de dados.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é dia de **Iterator** — o padrão que você usa toda vez que escreve um `for`, mesmo sem perceber.',
        'Começo com uma playlist cujos clientes sabem **demais** sobre ela.',
      ],
      board: {
        title: 'O problema: o cliente sabe demais',
        md: `\`\`\`python
class Playlist:
    def __init__(self):
        self.musicas = []            # hoje é uma lista…


# cliente 1: toca tudo
for i in range(len(playlist.musicas)):
    tocar(playlist.musicas[i])

# cliente 2: só as favoritas
i = 0
while i < len(playlist.musicas):
    if playlist.musicas[i].favorita:
        tocar(playlist.musicas[i])
    i += 1
\`\`\`

Amanhã a playlist vira uma **árvore de pastas**, ou passa a vir **paginada** de uma API — e todos os clientes quebram, porque cada um reimplementa o percurso com índices.

**Intenção (GoF):** fornecer um meio de acessar os elementos de uma coleção **sequencialmente, sem expor sua representação interna**.

\`\`\`text
 cliente ──for──▶ iterável ──__iter__()──▶ iterador ──__next__()──▶ item, item, … StopIteration
                  (a coleção)              (o cursor: "onde parei")
\`\`\`

A coleção sabe **criar** cursores; o cursor sabe **andar**. O cliente só pede "o próximo".`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Em Python, o padrão virou **protocolo** da linguagem. Olha o que o `for` faz por baixo dos panos.',
        'Repare nos dois papéis: quem **cria** cursores e quem **é** o cursor.',
      ],
      board: {
        title: 'O protocolo: iterável × iterador',
        md: `\`\`\`python
# o que "for item in colecao: ..." realmente executa
it = iter(colecao)            # chama colecao.__iter__()
while True:
    try:
        item = next(it)       # chama it.__next__()
    except StopIteration:     # fim normal: o for engole a exceção
        break
    ...                       # corpo do for
\`\`\`

| | Iterável | Iterador |
|---|---|---|
| Métodos | \`__iter__\` → um iterador **novo** | \`__next__\` + \`__iter__\` → \`self\` |
| Exemplos | \`list\`, \`dict\`, \`str\`, \`range\` | \`iter(lista)\`, geradores, \`map\`, \`zip\`, arquivo aberto |
| Percorre de novo? | sim: cada \`iter()\` dá um cursor novo | não: **esgota** (é *one-shot*) |

\`\`\`python
class Contagem:                         # iterável
    def __init__(self, inicio, fim):
        self.inicio, self.fim = inicio, fim

    def __iter__(self):
        return ContagemIter(self.inicio, self.fim)   # cursor NOVO a cada for


class ContagemIter:                     # iterador: guarda "onde parei"
    def __init__(self, atual, fim):
        self.atual, self.fim = atual, fim

    def __iter__(self):
        return self

    def __next__(self):
        if self.atual >= self.fim:
            raise StopIteration
        valor = self.atual
        self.atual += 1
        return valor
\`\`\`

> [!atencao] Iterador **esgota**. Com \`quadrados = (x * x for x in range(4))\`, o primeiro \`sum(quadrados)\` dá 14 e o segundo dá **0** — o gerador já acabou, e ninguém avisa. Precisa percorrer duas vezes? Guarde uma lista ou peça um iterador novo ao iterável.`,
      },
    },
    {
      type: 'say',
      text: [
        'Escrever a classe do cursor à mão é verboso. Um **gerador** faz esse trabalho sozinho.',
        'Cada `yield` entrega um item e **congela** a função — variáveis locais e tudo — até o próximo `next`.',
      ],
      board: {
        title: 'Geradores: o iterador que se escreve sozinho',
        md: `\`\`\`python
class Contagem:
    def __init__(self, inicio, fim):
        self.inicio, self.fim = inicio, fim

    def __iter__(self):              # método gerador: cada chamada cria um gerador novo
        atual = self.inicio
        while atual < self.fim:
            yield atual              # entrega e congela aqui
            atual += 1               # continua daqui no próximo next()
\`\`\`

\`\`\`text
next(g) ─▶ roda até o 1º yield ────────▶ devolve 0 e congela
next(g) ─▶ continua depois do yield ───▶ devolve 1 e congela
   …
next(g) ─▶ a função termina ───────────▶ StopIteration (automático)
\`\`\`

- O "onde parei" mora nas **variáveis locais** — nada de \`self.atual\` compartilhado.
- Como \`__iter__\` cria um gerador **novo** a cada chamada, a \`Contagem\` continua **re-iterável**: dois \`for\` aninhados funcionam.
- \`yield from outro_iteravel\` delega o percurso a outro iterável — perfeito para estruturas recursivas.

> [!sabia] A ideia é antiga: a linguagem **CLU**, criada no MIT por **Barbara Liskov** (a mesma do princípio de substituição, o "L" do SOLID) nos anos 1970, já tinha iteradores escritos com \`yield\`. Python só ganhou geradores em 2001, com a PEP 255.`,
      },
    },
    {
      type: 'say',
      text: [
        'Existem dois estilos de iterador, e a diferença é **quem manda no laço**.',
        'Parece detalhe — até você precisar percorrer **duas** coleções ao mesmo tempo.',
      ],
      board: {
        title: 'Iterador externo × interno',
        md: `\`\`\`python
# interno: a coleção controla o laço e chama a SUA função
class Arvore:
    def para_cada(self, funcao):
        ...                              # percorre tudo chamando funcao(chave)

arvore.para_cada(print)                  # parar no meio? só com gambiarra

# externo: o cliente controla o laço
it = iter(arvore)
menor = next(it)                         # pego um, faço outra coisa, volto depois…
\`\`\`

| | Externo (\`__iter__\`/\`__next__\`) | Interno (\`para_cada(f)\`) |
|---|---|---|
| Quem controla o laço | o **cliente** | a **coleção** |
| Parar no meio | \`break\` | exceção ou flag |
| Intercalar dois percursos | \`zip\`, \`heapq.merge\`, \`itertools\` | praticamente impossível |
| Implementar | guardar "onde parei" (geradores resolvem) | trivial: recursão pura |
| Vantagem própria | combina com todo o ecossistema | a coleção controla o contexto (lock, transação) |

O teste clássico é o **same fringe problem**: duas árvores têm as mesmas folhas, na mesma ordem? Com iteradores externos, compara-se item a item e **para na primeira diferença**:

\`\`\`python
from itertools import zip_longest

FIM = object()


def mesma_franja(a, b):                  # folhas(arvore) é um gerador das folhas
    pares = zip_longest(folhas(a), folhas(b), fillvalue=FIM)
    return all(x == y for x, y in pares)
\`\`\`

Com iteradores internos, o jeito é achatar as duas árvores **inteiras** em listas antes de comparar.

> [!sabia] O **same fringe problem** é um exemplo clássico da literatura de corrotinas: com geradores ele é trivial; sem eles, exige memória proporcional às árvores ou um código cheio de estado manual. É o melhor argumento a favor de iteradores externos.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Árvores são o terreno favorito do Iterator: o mesmo dado, vários percursos possíveis.',
        'E cada percurso vira um **gerador** — quem consome pega só o que precisa.',
      ],
      board: {
        title: 'Percursos de árvore como geradores',
        md: `\`\`\`text
         8
       /   \\
      3     10
     / \\      \\
    1   6      14

pré-ordem   (nó, esq, dir)  →  8 3 1 6 10 14
em ordem    (esq, nó, dir)  →  1 3 6 8 10 14   ◀ crescente numa BST!
pós-ordem   (esq, dir, nó)  →  1 6 3 14 10 8
em largura  (nível a nível) →  8 3 10 1 6 14
\`\`\`

\`\`\`python
from collections import deque


def em_ordem(no):                        # recursivo: curto e legível
    if no is not None:
        yield from em_ordem(no.esq)
        yield no.chave
        yield from em_ordem(no.dir)


def em_ordem_com_pilha(raiz):            # pilha explícita: sem limite de recursão
    pilha, atual = [], raiz
    while pilha or atual is not None:
        while atual is not None:         # desce tudo à esquerda, empilhando
            pilha.append(atual)
            atual = atual.esq
        atual = pilha.pop()
        yield atual.chave
        atual = atual.dir


def em_largura(raiz):                    # BFS: troque a pilha por uma FILA
    fila = deque([raiz] if raiz is not None else [])
    while fila:
        no = fila.popleft()              # O(1); list.pop(0) seria O(n)
        yield no.chave
        for filho in (no.esq, no.dir):
            if filho is not None:
                fila.append(filho)
\`\`\`

> [!atencao] A versão recursiva é linda, mas cada nível da árvore empilha um gerador: numa árvore **degenerada** (chaves inseridas já ordenadas viram uma "lista ligada"), cerca de 1.000 níveis bastam para um \`RecursionError\`. Com profundidade imprevisível, prefira a pilha explícita.

> [!sabia] Dá para percorrer em ordem com memória **O(1)**, sem pilha nem recursão: o **Morris traversal** (1979) "costura" temporariamente os ponteiros \`dir\` vazios de volta ao ancestral e desfaz a costura no caminho. O preço: a árvore é modificada durante o percurso — nada de duas leituras simultâneas.`,
      },
    },
    {
      type: 'say',
      text: [
        'Como o iterador só calcula o próximo item quando alguém pede, a sequência nem precisa **terminar**.',
        'Só cuidado com o outro lado da moeda: mexer na coleção enquanto um iterador anda por ela.',
      ],
      board: {
        title: 'Sequências preguiçosas — e coleções que mudam no meio',
        md: `\`\`\`python
from itertools import islice, takewhile


def fibonacci():                         # infinito: nunca termina sozinho
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


list(islice(fibonacci(), 8))                     # [0, 1, 1, 2, 3, 5, 8, 13]
list(takewhile(lambda x: x < 50, fibonacci()))   # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# pipeline preguiçoso: nada roda até alguém pedir
linhas = (l.rstrip("\\n") for l in open("app.log"))   # uma linha por vez na memória
erros = (l for l in linhas if "ERROR" in l)
primeiros = list(islice(erros, 10))                  # lê o arquivo só até o 10º erro
\`\`\`

Quem **consome** decide quando parar — por isso um gerador infinito é seguro, e um \`list(fibonacci())\` trava para sempre.

**Invalidação de iterador:** a coleção muda enquanto é percorrida.

\`\`\`python
nums = [1, 2, 2, 3]
for n in nums:
    if n == 2:
        nums.remove(n)          # o índice anda e pula o 2º "2": sobra [1, 2, 3]

d = {"a": 1}
for k in d:
    d["b"] = 2                  # RuntimeError: dictionary changed size during iteration
\`\`\`

Percorra uma **cópia** (\`for n in list(nums)\`) ou construa uma coleção nova (\`[n for n in nums if n != 2]\`).

> [!sabia] Em 1976, pesquisadores da IBM que construíam o System R rodaram um \`UPDATE\` que dava 10% de aumento a quem ganhava menos de 25 mil. A consulta percorria um **índice por salário**: cada linha atualizada "andava para a frente" no índice e era encontrada de novo — no fim, ninguém ganhava menos de 25 mil. Descoberto num dia de Halloween, virou o **Halloween problem**: invalidação de iterador em escala de banco de dados. Todo SGBD sério tem proteção contra ele.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Iterador esgotado, percursos, um organograma iterável e um intercalador preguiçoso.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-itr-q1',
      concept: 'Iterável × iterador',
      say: 'Primeira: um bug que já derrubou muito relatório por aí.',
      prompt: `Um colega implementou a \`Playlist\` assim. O que o \`print\` mostra?

\`\`\`python
class Playlist:
    def __init__(self, musicas):
        self._musicas = list(musicas)
        self._i = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._i >= len(self._musicas):
            raise StopIteration
        musica = self._musicas[self._i]
        self._i += 1
        return musica


p = Playlist(["a", "b", "c"])
print(list(p), list(p))
\`\`\``,
      options: [
        { text: "`['a', 'b', 'c'] ['a', 'b', 'c']`", why: 'Só aconteceria se cada `iter(p)` começasse do zero. Aqui `__iter__` devolve o próprio objeto, com o `_i` que já chegou ao fim.' },
        { text: "`['a', 'b', 'c'] []`", correct: true, why: 'A `Playlist` é o próprio cursor: o primeiro `list()` leva o `_i` até o fim, e o segundo recebe o mesmo objeto, já esgotado — `StopIteration` logo de cara.' },
        { text: 'O segundo `list(p)` deixa escapar um `StopIteration`.', why: '`list()`, como o `for`, trata `StopIteration` como o fim normal da iteração: a exceção nunca vaza.' },
        { text: 'Laço infinito: o segundo `list(p)` recomeça e nunca para.', why: 'É o contrário: nada zera o `_i`, então o segundo percurso termina antes de começar.' },
      ],
      explanation: 'A `Playlist` misturou os papéis: ela é a **coleção** e o **cursor** ao mesmo tempo, então só pode ser percorrida uma vez — e dois `for` aninhados sobre ela se atrapalham. A regra: o **iterável** devolve um iterador **novo** em `__iter__`; só o **iterador** devolve `self`. A correção mais curta é trocar `__iter__` e `__next__` por um método gerador — `def __iter__(self): yield from self._musicas` —, e cada `for` ganha o seu próprio cursor.',
    },
    {
      type: 'match',
      id: 'dp-itr-q2',
      concept: 'Percursos de árvore',
      say: 'Agora, escolha o percurso certo para cada tarefa.',
      prompt: 'Associe cada **tarefa** ao percurso (ou técnica) mais adequado.',
      pairs: [
        { left: 'Listar as chaves de uma árvore de busca em ordem crescente', right: 'Em ordem (esquerda, nó, direita)' },
        { left: 'Mostrar um organograma nível a nível: diretoria, depois gerências…', right: 'Em largura (BFS), com uma fila' },
        { left: 'Serializar a árvore para recriá-la depois (pai antes dos filhos)', right: 'Pré-ordem (nó, esquerda, direita)' },
        { left: 'Somar o tamanho de cada pasta (filhos antes do pai)', right: 'Pós-ordem (esquerda, direita, nó)' },
        { left: 'Percorrer uma árvore degenerada com 100 mil níveis', right: 'Pilha explícita em vez de recursão' },
      ],
      explanation: 'Em ordem numa **BST** entrega as chaves ordenadas de graça. **Em largura** usa uma **fila** e respeita os níveis. **Pré-ordem** emite o pai antes dos filhos — ao reconstruir, cada nó já tem onde se pendurar. **Pós-ordem** processa os filhos primeiro, ideal para agregar (tamanhos, liberar recursos). E quando a profundidade é grande, troque a recursão (limitada a ~1.000 níveis) por uma **pilha** que você controla.',
    },
    {
      type: 'code',
      id: 'dp-itr-q3',
      concept: 'Percursos de árvore',
      title: 'Organograma iterável: pré-ordem e níveis',
      say: 'Hora de codar! Um organograma é uma árvore — e merece um `for` decente.',
      prompt: `Cada \`Pessoa\` tem um \`nome\` e uma lista \`equipe\` de subordinados (outras \`Pessoa\`). Complete a classe \`Organograma\`:

- **\`__iter__\`** percorre em **pré-ordem**: o chefe antes da equipe, e a equipe **na ordem da lista**. Entrega os **nomes**.
- **\`por_nivel()\`** é um **gerador** que entrega **uma lista de nomes por nível**, de cima para baixo e da esquerda para a direita.
- O organograma deve ser **re-iterável** (dois \`for\` aninhados funcionam) e, com \`raiz=None\`, os dois percursos são vazios.
- **Sem recursão**: existem organogramas "em corrente" com milhares de níveis. Use uma **pilha** e uma **fila**.

\`\`\`python
ana = Pessoa("Ana", [
    Pessoa("Bia", [Pessoa("Duda"), Pessoa("Edu")]),
    Pessoa("Caio", [Pessoa("Fábio")]),
])
org = Organograma(ana)
list(org)              # ['Ana', 'Bia', 'Duda', 'Edu', 'Caio', 'Fábio']
list(org.por_nivel())  # [['Ana'], ['Bia', 'Caio'], ['Duda', 'Edu', 'Fábio']]
\`\`\``,
      starter: `from collections import deque


class Pessoa:
    def __init__(self, nome, equipe=()):
        self.nome = nome
        self.equipe = list(equipe)


class Organograma:
    def __init__(self, raiz):
        self.raiz = raiz              # uma Pessoa ou None

    def __iter__(self):
        """Pré-ordem: chefe antes da equipe, equipe na ordem da lista."""
        pass

    def por_nivel(self):
        """Gera uma lista de nomes por nível, de cima para baixo."""
        pass
`,
      tests: [
        {
          name: 'pré-ordem do exemplo',
          code: `org = Organograma(Pessoa("Ana", [Pessoa("Bia", [Pessoa("Duda"), Pessoa("Edu")]), Pessoa("Caio", [Pessoa("Fábio")])]))
assert list(org) == ["Ana", "Bia", "Duda", "Edu", "Caio", "Fábio"], list(org)`,
        },
        {
          name: 'níveis do exemplo',
          code: `org = Organograma(Pessoa("Ana", [Pessoa("Bia", [Pessoa("Duda"), Pessoa("Edu")]), Pessoa("Caio", [Pessoa("Fábio")])]))
niveis = list(org.por_nivel())
assert niveis == [["Ana"], ["Bia", "Caio"], ["Duda", "Edu", "Fábio"]], niveis`,
        },
        {
          name: 're-iterável (for aninhado)',
          code: `org = Organograma(Pessoa("Ana", [Pessoa("Bia"), Pessoa("Caio")]))
pares = [(a, b) for a in org for b in org]
assert len(pares) == 9, f"esperava 9 pares, vieram {len(pares)}: cada __iter__ precisa criar um percurso novo"`,
        },
        {
          name: 'organograma vazio',
          code: `org = Organograma(None)
assert list(org) == [] and list(org.por_nivel()) == [], (list(org), list(org.por_nivel()))`,
        },
        {
          name: 'iter() devolve um iterador de verdade',
          code: `org = Organograma(Pessoa("Ana", [Pessoa("Bia")]))
it = iter(org)
assert next(it) == "Ana" and next(it) == "Bia"
try:
    next(it)
except StopIteration:
    pass
else:
    raise AssertionError("depois do último nome, next() deveria lançar StopIteration")`,
        },
        {
          name: 'corrente com 5.000 níveis',
          hidden: true,
          code: `raiz = Pessoa("p0")
atual = raiz
for i in range(1, 5000):
    novo = Pessoa(f"p{i}")
    atual.equipe.append(novo)
    atual = novo
org = Organograma(raiz)
nomes = list(org)
assert len(nomes) == 5000 and nomes[-1] == "p4999", "a pré-ordem não pode depender de recursão"
niveis = list(org.por_nivel())
assert len(niveis) == 5000 and niveis[-1] == ["p4999"], len(niveis)`,
        },
        {
          name: 'equipe grande mantém a ordem',
          hidden: true,
          code: `org = Organograma(Pessoa("chefe", [Pessoa(f"f{i}") for i in range(300)]))
assert list(org) == ["chefe"] + [f"f{i}" for i in range(300)], "a equipe deve sair na ordem da lista"
assert list(org.por_nivel()) == [["chefe"], [f"f{i}" for i in range(300)]]`,
        },
        {
          name: 'galhos de profundidades diferentes',
          hidden: true,
          code: `org = Organograma(Pessoa("A", [Pessoa("B", [Pessoa("C", [Pessoa("D")])]), Pessoa("E"), Pessoa("F", [Pessoa("G")])]))
assert list(org) == ["A", "B", "C", "D", "E", "F", "G"], list(org)
assert list(org.por_nivel()) == [["A"], ["B", "E", "F"], ["C", "G"], ["D"]], list(org.por_nivel())`,
        },
        {
          name: 'por_nivel é um gerador',
          hidden: true,
          code: `org = Organograma(Pessoa("Ana", [Pessoa("Bia")]))
g = org.por_nivel()
assert next(g) == ["Ana"], "por_nivel() deve entregar um nível por vez"
assert next(g) == ["Bia"]`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /return\s+iter\s*\(/.test(code),
          text: 'Um dos percursos monta a lista inteira e devolve `iter(lista)`. Funciona, mas percorre o organograma todo antes de entregar o primeiro nome: memória O(n) e nada de parar cedo. Com `yield`, o percurso anda **sob demanda**.',
          concept: 'Avaliação preguiçosa',
        },
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: '`lista.pop(0)` desloca todos os elementos: O(n) por retirada, O(n²) no percurso. Para a fila da largura, use `collections.deque` com `popleft()`, que é O(1).',
          concept: 'deque (fila O(1))',
        },
      ],
      hints: [
        'Pré-ordem sem recursão: comece com `pilha = [self.raiz]` (se houver raiz). A cada volta, faça `pop()` de uma pessoa, `yield pessoa.nome` e empilhe a equipe dela.',
        'A pilha é LIFO: para a equipe sair **na ordem da lista**, empilhe-a **ao contrário** — `pilha.extend(reversed(pessoa.equipe))`.',
        'Para os níveis, use `fila = deque([self.raiz])`. Enquanto houver fila: retire exatamente `len(fila)` pessoas (esse é o nível atual), faça `yield` da lista de nomes delas e enfileire as equipes.',
      ],
      solution: `from collections import deque


class Pessoa:
    def __init__(self, nome, equipe=()):
        self.nome = nome
        self.equipe = list(equipe)


class Organograma:
    def __init__(self, raiz):
        self.raiz = raiz              # uma Pessoa ou None

    def __iter__(self):
        """Pré-ordem: chefe antes da equipe, equipe na ordem da lista."""
        pilha = [self.raiz] if self.raiz is not None else []
        while pilha:
            pessoa = pilha.pop()
            yield pessoa.nome
            pilha.extend(reversed(pessoa.equipe))   # o 1º da equipe fica no topo

    def por_nivel(self):
        """Gera uma lista de nomes por nível, de cima para baixo."""
        fila = deque([self.raiz] if self.raiz is not None else [])
        while fila:
            nivel = [fila.popleft() for _ in range(len(fila))]
            yield [pessoa.nome for pessoa in nivel]
            for pessoa in nivel:
                fila.extend(pessoa.equipe)
`,
      solutionExplanation: 'Os dois percursos são **métodos geradores**: cada chamada cria um cursor novo, então o organograma é re-iterável e dois `for` aninhados não se atrapalham. A pré-ordem troca a recursão por uma **pilha** — e, como a pilha devolve primeiro o que entrou por último, a equipe é empilhada **invertida** para sair na ordem da lista. A largura usa uma **fila**: retirar exatamente `len(fila)` pessoas por volta separa os níveis. Nada é materializado além do necessário, e quem consome pode parar no primeiro nível. (Uma alternativa igualmente boa para os níveis: `nivel = [filho for p in nivel for filho in p.equipe]`.)',
    },
    {
      type: 'code',
      id: 'dp-itr-q4',
      concept: 'Iterador externo',
      title: 'Intercalador preguiçoso (round-robin)',
      say: 'Agora, um superpoder dos iteradores externos: intercalar várias fontes — inclusive infinitas.',
      prompt: `Escreva o gerador \`intercalar(*iteraveis)\`, que alterna entre as fontes em rodízio (*round-robin*): o 1º item de cada fonte, depois o 2º de cada, e assim por diante.

- Aceita **qualquer** iterável (listas, strings, geradores…) e qualquer quantidade deles, inclusive nenhum.
- Quando uma fonte acaba, ela sai do rodízio e as outras continuam; termina quando **todas** acabarem.
- É **preguiçoso**: cada item é puxado da fonte só no momento de ser entregue — por isso funciona com fontes infinitas.
- Os itens podem ser qualquer coisa, **inclusive \`None\`**.

\`\`\`python
list(intercalar([1, 2, 3], "ab", []))          # [1, 'a', 2, 'b', 3]
list(islice(intercalar(count(), "xy"), 6))    # [0, 'x', 1, 'y', 2, 3]
\`\`\``,
      starter: `def intercalar(*iteraveis):
    """Gera os itens das fontes em rodízio, sob demanda."""
    pass
`,
      tests: [
        { name: 'exemplo com fonte vazia', expr: 'list(intercalar([1, 2, 3], "ab", []))', expected: '[1, "a", 2, "b", 3]' },
        { name: 'sem fontes', expr: 'list(intercalar())', expected: '[]' },
        {
          name: 'fonte infinita',
          code: `from itertools import islice


def infinito():
    n = 0
    while True:
        if n > 10_000:
            raise AssertionError("puxou itens demais: o intercalar precisa ser preguiçoso")
        yield n
        n += 1


assert list(islice(intercalar(infinito(), "xy"), 6)) == [0, "x", 1, "y", 2, 3]`,
        },
        {
          name: 'puxa só o necessário',
          code: `puxados = []


def fonte(nome, n):
    for i in range(n):
        puxados.append(f"{nome}{i}")
        yield f"{nome}{i}"


it = intercalar(fonte("a", 100), fonte("b", 100))
assert [next(it) for _ in range(3)] == ["a0", "b0", "a1"]
assert puxados == ["a0", "b0", "a1"], f"puxou adiantado: {puxados}"`,
        },
        { name: 'None é um item como outro qualquer', hidden: true, expr: 'list(intercalar([None, 1], [None]))', expected: '[None, None, 1]' },
        { name: 'fontes de tamanhos diferentes', hidden: true, expr: 'list(intercalar(*[range(i) for i in range(5)]))', expected: '[0, 0, 0, 0, 1, 1, 1, 2, 2, 3]' },
        { name: 'fontes vazias no meio', hidden: true, expr: 'list(intercalar([], [1, 2], "", "x"))', expected: '[1, "x", 2]' },
        {
          name: 'devolve um iterador',
          hidden: true,
          code: `it = intercalar([1], [2])
assert iter(it) is it, "intercalar deve devolver um iterador (use yield)"
assert next(it) == 1 and next(it) == 2`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Capture só `StopIteration`. Um `except Exception` (ou `except:`) também engoliria erros **reais** das fontes: uma falha de leitura sumiria como se a fonte tivesse simplesmente acabado.',
          concept: 'Tratamento de exceções',
        },
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: 'Girar a roda com `lista.pop(0)` custa O(n) por item. Uma `collections.deque` com `popleft()` e `append()` faz o rodízio em O(1).',
          concept: 'deque (fila O(1))',
        },
      ],
      hints: [
        'Transforme cada fonte num iterador com `iter(...)` e guarde-os numa `deque`: ela é a "roda" do rodízio.',
        'Em laço: tire o primeiro iterador da roda (`popleft`) e tente `next(it)`. Se vier `StopIteration`, a fonte acabou — não a devolva à roda.',
        'Se veio um item, faça `yield item` e só depois devolva o iterador ao **fim** da roda (`append`). Assim nada é puxado antes da hora.',
      ],
      solution: `from collections import deque


def intercalar(*iteraveis):
    """Gera os itens das fontes em rodízio, sob demanda."""
    roda = deque(iter(fonte) for fonte in iteraveis)
    while roda:
        it = roda.popleft()
        try:
            item = next(it)
        except StopIteration:
            continue                 # fonte esgotada: sai da roda
        yield item
        roda.append(it)
`,
      solutionExplanation: 'É o Iterator **externo** em ação: o `intercalar` segura um cursor por fonte e decide, a cada passo, de qual puxar — algo impossível se as fontes só oferecessem `para_cada(f)`. A `deque` funciona como uma roda: tira da frente, puxa **um** item e devolve ao fim, tudo em O(1). O `try/except StopIteration` distingue "a fonte acabou" de "a fonte entregou `None`" (um `next(it, None)` confundiria os dois). E como o `yield` acontece antes de pedir o próximo item, nada é puxado adiantado — por isso fontes infinitas funcionam. A documentação do `itertools` traz uma receita parecida, chamada `roundrobin`.',
    },
    {
      type: 'open',
      id: 'dp-itr-q5',
      concept: 'Iterador externo × interno',
      say: 'Para fechar, uma pergunta de design que aparece em revisão de código.',
      prompt: 'Um colega propôs que a classe `Arvore` ofereça **só** `para_cada(funcao)` — um iterador interno —, "porque é mais simples de implementar". Que limitações isso traz para quem usa a árvore? E em que situação um iterador interno é, sim, uma boa escolha?',
      minWords: 30,
      rubric: [
        { label: 'Não dá para **parar no meio** (achar o primeiro, `break`) sem gambiarra', keywords: ['parar', 'interromp', 'break', 'no meio', 'antecipad', 'early', 'primeiro que', 'primeira ocorrencia', 'curto-circuit', 'short-circuit', 'excecao para sair', 'flag'], concept: 'Iterador externo', why: 'Com o laço nas mãos da coleção, sair cedo exige lançar exceção ou carregar uma flag — e o percurso continua pagando pelo resto.' },
        { label: 'Não dá para **intercalar ou combinar** dois percursos (zip, comparar duas árvores, merge)', keywords: ['intercal', 'zip', 'duas arvores', 'dois percursos', 'duas colecoes', 'comparar', 'merge', 'mesclar', 'combinar', 'lado a lado', 'same fringe', 'ao mesmo tempo', 'simultane', 'pausar', 'pausa'], concept: 'Same fringe problem', why: 'Dois iteradores internos não conseguem avançar alternadamente: cada um quer terminar o próprio laço.' },
        { label: 'Perde a integração com o **protocolo** do Python (`for`, `sum`, `itertools`, preguiça)', keywords: ['protocolo', '__iter__', 'iter(', 'itertools', 'islice', 'list(', 'sum(', 'sorted', 'compreens', 'comprehension', 'ecossistema', 'stdlib', 'biblioteca padrao', 'gerador', 'generator', 'yield', 'preguic', 'lazy', 'sob demanda'], concept: 'Protocolo de iteração', why: 'Com `__iter__` (um gerador basta), a árvore funciona com `for`, `sum`, `sorted`, `zip`, `itertools` e compreensões, sem nenhum código extra.' },
        { label: 'Reconhece quando o **interno** é bom: a coleção controla o contexto (lock, transação, recurso) ou pode paralelizar', keywords: ['lock', 'trava', 'transac', 'conexao', 'recurso', 'fechar', 'liberar', 'cleanup', 'contexto', 'paraleliz', 'paralelo', 'callback', 'sempre complet', 'percorrer tudo', 'todos os itens'], concept: 'Iterador interno', why: 'Quando a coleção precisa segurar um lock, uma transação ou um cursor de banco durante o percurso — ou pode paralelizar a execução —, deixá-la no controle é uma vantagem.' },
      ],
      modelAnswer: `Com só \`para_cada(funcao)\`, quem manda no laço é a árvore, e o cliente perde três coisas. Primeiro, **parar no meio**: achar o primeiro nó que satisfaz uma condição exige lançar uma exceção ou carregar uma flag, e o percurso continua pagando pelo resto. Segundo, **intercalar** percursos: comparar duas árvores item a item (o *same fringe problem*), fazer \`zip\` ou \`merge\` fica praticamente impossível — cada iterador interno quer terminar o próprio laço. Terceiro, a integração com o **protocolo** do Python: com \`__iter__\` (um gerador de poucas linhas), a árvore funciona com \`for\`, \`sum\`, \`sorted\`, \`zip\`, \`itertools\` e compreensões, e o percurso fica preguiçoso, sob demanda.

O iterador interno faz sentido quando a coleção precisa **controlar o contexto** do percurso — segurar um lock, abrir e fechar uma transação ou um cursor de banco, liberar o recurso no fim — ou quando pode paralelizar a execução do callback. Mesmo assim, eu ofereceria os dois: \`__iter__\` como padrão e \`para_cada\` como conveniência.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Iterator = percorrer sem expor o **como**: o iterável cria cursores, o iterador anda e se esgota.',
        'Geradores escrevem cursores de graça, pilha e fila domam árvores, e a preguiça permite até o infinito. Próximo: Chain of Responsibility!',
      ],
      board: null,
    },
  ],
});
