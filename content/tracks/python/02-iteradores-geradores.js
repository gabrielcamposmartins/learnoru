(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'iteradores-geradores',
    title: 'Iteradores e geradores',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'funcional',
    summary: 'Como o `for` funciona por dentro, geradores e avaliação preguiçosa, `yield from` e pipelines que processam gigabytes com memória constante — sem cair no iterador esgotado nem no `groupby` sem ordenar.',
    concepts: ['Iterável × iterador', 'Geradores', 'Avaliação preguiçosa', 'yield from', 'itertools'],
    takeaways: [
      '**Iterável** sabe criar iteradores (`__iter__`); **iterador** entrega um item por vez (`__next__`) e se esgota. O `for` é só `iter()` + `next()` até o `StopIteration`.',
      'Um gerador não executa nada até o primeiro `next()`: ele **pausa** em cada `yield` e retoma de onde parou. Até a validação dos argumentos fica para depois — valide numa função normal que devolve o gerador.',
      'Iterador **esgotado** não dá erro: devolve vazio. Se a função precisa percorrer os dados duas vezes, materialize com `list()` ou exija um contêiner.',
      'Genexp ocupa ~200 bytes para qualquer tamanho; list comprehension materializa tudo. Num pipeline de geradores, cada item atravessa todas as etapas antes do próximo ser lido.',
      '`itertools`: `islice` fatia até o infinito, `chain` concatena e `groupby` só agrupa **vizinhos** — ordene pela mesma chave antes (ou use `Counter`).',
    ],
    glossary: [
      { term: 'Iterável', aliases: ['iteráveis', 'iterable', 'iterables'], definition: 'Objeto que fornece um iterador novo via `iter(obj)` (método `__iter__` ou protocolo de sequência). Listas, dicts, strings e `range` são iteráveis — e podem ser percorridos várias vezes.' },
      { term: 'Iterador', aliases: ['iteradores', 'iterator', 'iterators'], definition: 'Objeto com `__next__` (entrega o próximo item ou lança `StopIteration`) e `__iter__` que devolve ele mesmo. Guarda a posição e se **esgota**: depois do fim, só devolve vazio.' },
      { term: 'Função geradora', aliases: ['funções geradoras', 'generator function', 'generator functions', 'objeto gerador', 'objetos geradores'], definition: 'Função com `yield` no corpo. Chamá-la não executa nada: devolve um **objeto gerador** (um iterador) que roda sob demanda, pausando em cada `yield` com as variáveis locais preservadas e retomando no próximo `next()`.' },
      { term: 'Avaliação preguiçosa', aliases: ['lazy evaluation', 'avaliação sob demanda', 'preguiçoso', 'preguiçosa'], definition: 'Estratégia de adiar um cálculo — ou a criação de um objeto — até alguém precisar do resultado. Economiza trabalho e memória (em geradores, permite até fluxos infinitos), mas adia os erros para o momento do uso.' },
      { term: 'Genexp', aliases: ['genexps', 'generator expression', 'expressão geradora', 'expressões geradoras'], definition: 'Expressão `(f(x) for x in dados)`: a versão preguiçosa da list comprehension. Produz um gerador de tamanho constante em vez de uma lista inteira na memória.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje vamos desmontar o `for`. Ele parece mágico, mas são só duas funções: `iter()` e `next()`.',
          'E a distinção que cai em entrevista: **iterável** não é a mesma coisa que **iterador**.',
        ],
        board: {
          title: 'Iterável × iterador: o for por dentro',
          md: `\`\`\`python
nomes = ["ana", "bia"]       # ITERÁVEL: sabe criar iteradores
it = iter(nomes)             # ITERADOR: guarda a posição
next(it)                     # 'ana'
next(it)                     # 'bia'
next(it)                     # StopIteration  <- acabou
\`\`\`

O \`for\` é açúcar sintático para isto:

\`\`\`python
it = iter(colecao)           # colecao.__iter__()
while True:
    try:
        item = next(it)      # it.__next__()
    except StopIteration:
        break
    ...                      # corpo do for
\`\`\`

| | Iterável | Iterador |
|---|---|---|
| Protocolo | \`__iter__\` devolve um iterador **novo** | \`__next__\` + \`__iter__\` que devolve **self** |
| Percorre de novo? | sim, quantas vezes quiser | não — se esgota |
| Exemplos | \`list\`, \`dict\`, \`str\`, \`range\` | \`iter(lista)\`, geradores, \`map\`, \`zip\`, \`enumerate\`, arquivo aberto |

> [!dica] Teste rápido: \`iter(x) is x\` é \`True\` para iteradores e \`False\` para iteráveis reutilizáveis. E \`range\` **não** é iterador: é uma sequência preguiçosa — \`10**9 in range(0, 10**12, 2)\` responde na hora, fazendo conta em vez de percorrer.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'A consequência mais traiçoeira: iterador **esgotado** não dá erro. Ele só devolve vazio.',
          'E muita função percorre os dados duas vezes sem avisar ninguém.',
        ],
        board: {
          title: 'O iterador esgotado',
          md: `\`\`\`python
numeros = map(int, ["3", "1", "2"])
sum(numeros)                 # 6
sum(numeros)                 # 0   <- esgotado, em silêncio!


def normalizar(valores):
    maior = max(valores)                   # 1ª passada
    return [v / maior for v in valores]    # 2ª passada

normalizar([1, 2, 4])                      # [0.25, 0.5, 1.0]
normalizar(x for x in [1, 2, 4])           # []   <- o max() já consumiu tudo
\`\`\`

Defesas:

- Precisa de duas passadas? Materialize no início: \`valores = list(valores)\` (custa memória, mas é honesto).
- Ou recuse iteradores explicitamente: \`if iter(valores) is valores: raise TypeError("passe uma lista, não um iterador")\`.
- Cuidado com consumidores "escondidos": \`in\`, \`any\`, \`all\`, \`zip\`, \`max\`, \`sorted\` e \`next\` também avançam o iterador.

> [!sabia] O \`iter()\` tem uma forma com **dois argumentos**: \`iter(funcao, sentinela)\` chama \`funcao()\` repetidamente até ela devolver a sentinela. Ler um arquivo binário em blocos vira uma linha: \`for bloco in iter(partial(f.read, 4096), b""):\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Escrever iterador em classe dá trabalho. Com `yield`, o Python escreve o protocolo por você.',
          'O detalhe que surpreende: chamar a função geradora **não executa nada**. Ela só cria o gerador.',
        ],
        board: {
          title: 'Geradores: funções que pausam',
          md: `\`\`\`python
def contagem(n):
    print("começou")
    while n > 0:
        yield n              # entrega n e PAUSA aqui
        n -= 1
    print("acabou")          # depois disto: StopIteration

g = contagem(2)              # nada impresso: só cria o gerador
next(g)                      # imprime "começou" e devolve 2
next(g)                      # devolve 1 (retoma depois do yield)
next(g)                      # imprime "acabou" e lança StopIteration
\`\`\`

A mesma coisa em classe — o protocolo que o \`yield\` escreve por você:

\`\`\`python
class Contagem:
    def __init__(self, n):
        self.n = n
    def __iter__(self):
        return self
    def __next__(self):
        if self.n <= 0:
            raise StopIteration
        self.n -= 1
        return self.n + 1
\`\`\`

- Chamar uma **função geradora** (qualquer \`def\` com \`yield\`) não executa o corpo: devolve um **objeto gerador**, que guarda as variáveis locais e a linha onde parou entre um \`next()\` e outro.
- \`return valor\` encerra o gerador (vira \`StopIteration(valor)\`).
- Quer um iterável **reutilizável**? Faça o \`__iter__\` ser um gerador: \`def __iter__(self): yield from self._itens\` — cada \`for\` ganha um gerador novo.
- Como o corpo só roda no primeiro \`next()\`, até a **validação** dos argumentos fica adiada. Para falhar na hora, valide numa função normal que devolve o gerador.

> [!atencao] Desde o Python 3.7 (PEP 479), um \`StopIteration\` que escapa de **dentro** de um gerador vira \`RuntimeError\`. Chamar \`next(it)\` sem valor padrão dentro de um gerador é bug latente: use \`next(it, None)\` ou um \`for\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Genexp e list comprehension parecem gêmeas: só trocam colchetes por parênteses.',
          'Mas uma materializa tudo na memória e a outra entrega um item por vez. Olhe os números.',
        ],
        board: {
          title: 'Genexp × list comprehension',
          md: `\`\`\`python
import sys

lista = [n * n for n in range(1_000_000)]
gen   = (n * n for n in range(1_000_000))

sys.getsizeof(lista)     # ~8,4 MB (e isso é só o vetor de ponteiros!)
sys.getsizeof(gen)       # ~200 bytes — para qualquer tamanho

sum(n * n for n in range(1_000_000))       # genexp como único argumento: sem parênteses extras
any(linha.startswith("ERRO") for linha in log)   # para no primeiro verdadeiro
\`\`\`

| | List comprehension | Genexp |
|---|---|---|
| Memória | proporcional a n | constante |
| Percorrer de novo | sim | não (esgota) |
| \`len()\`, índice, fatia | sim | não |
| Primeiro resultado | depois de calcular **tudo** | imediato |
| Melhor para | dados pequenos, várias passadas | fluxo grande/infinito, passada única, \`sum\`/\`any\`/\`max\` |

Genexp não é "sempre melhor": por item, costuma ser um pouco **mais lenta** que a lista. Ela ganha em memória e em poder parar cedo.

> [!sabia] No Python 3.12 (PEP 709), list, dict e set comprehensions passaram a ser **embutidas** (*inlined*) na função que as contém — antes, cada uma virava uma função escondida — e ficaram até 2× mais rápidas. Genexps continuam sendo geradores de verdade.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o superpoder: encadear geradores num **pipeline**. Cada etapa puxa um item da anterior, só quando precisa.',
          'É assim que se processa um arquivo de 20 GB com poucos megabytes de memória.',
        ],
        board: {
          title: 'yield from e pipelines preguiçosos',
          md: `\`\`\`python
def achatar(itens):
    for item in itens:
        if isinstance(item, list):
            yield from achatar(item)     # delega ao subgerador
        else:
            yield item

list(achatar([1, [2, [3, 4]], 5]))      # [1, 2, 3, 4, 5]
\`\`\`

\`yield from sub\` equivale a \`for x in sub: yield x\` — e ainda repassa \`send()\`/\`throw()\` e devolve o \`return\` do subgerador (\`total = yield from sub()\`).

\`\`\`python
from itertools import islice

def limpar(linhas):
    for linha in linhas:
        linha = linha.strip()
        if linha and not linha.startswith("#"):
            yield linha

def campos(linhas):
    for linha in linhas:
        yield linha.split(";")

with open("vendas.csv") as f:                 # 20 GB? tudo bem
    registros = campos(limpar(f))             # nada executou ainda
    for registro in islice(registros, 10):    # puxa só o necessário
        print(registro)
\`\`\`

\`\`\`text
 for/islice --next--> campos --next--> limpar --next--> arquivo
            <-1 item--        <-1 item--       <-1 linha--
 (cada linha atravessa o pipeline inteiro antes da próxima ser lida)
\`\`\`

Custos da preguiça: uso único; o erro só aparece no **consumo**, longe de onde o pipeline foi montado; e a fonte (arquivo, conexão) precisa continuar aberta enquanto alguém consome.

> [!atencao] \`def linhas(c): with open(c) as f: return (l.strip() for l in f)\` devolve um gerador de arquivo **fechado** — o primeiro \`next()\` dá \`ValueError: I/O operation on closed file\`. Faça a própria função ser o gerador (\`yield\` dentro do \`with\`).`,
        },
      },
      {
        type: 'say',
        text: [
          'Para fechar a teoria, a caixa de ferramentas: `itertools`. Tudo preguiçoso, tudo em C.',
          'E uma armadilha que derruba muita gente: o `groupby`.',
        ],
        board: {
          title: 'itertools — e a armadilha do groupby',
          md: `\`\`\`python
from itertools import islice, chain, count, takewhile, pairwise, batched, groupby

list(islice(count(1), 3))                    # [1, 2, 3]   fatia até o infinito
list(chain([1, 2], (3, 4), "ab"))            # [1, 2, 3, 4, 'a', 'b']
list(takewhile(lambda x: x < 3, count()))    # [0, 1, 2]
list(pairwise([1, 5, 8]))                    # [(1, 5), (5, 8)]          (3.10+)
list(batched(range(5), 2))                   # [(0, 1), (2, 3), (4,)]    (3.12+)
\`\`\`

\`\`\`python
niveis = ["ERRO", "INFO", "ERRO", "ERRO"]

[(k, len(list(g))) for k, g in groupby(niveis)]
# [('ERRO', 1), ('INFO', 1), ('ERRO', 2)]     <- ERRO aparece duas vezes!

[(k, len(list(g))) for k, g in groupby(sorted(niveis))]
# [('ERRO', 3), ('INFO', 1)]

Counter(niveis)          # Counter({'ERRO': 3, 'INFO': 1}) — só quer contar? use isto
\`\`\`

- \`groupby\` agrupa só **vizinhos** com a mesma chave: ordene pela **mesma** \`key\` antes. Ele existe assim de propósito — funciona em fluxo, sem guardar nada.
- Os grupos compartilham o iterador de baixo: ao avançar para o próximo grupo, o anterior some. \`list(groupby(x))\` e depois ler os grupos → todos vazios.
- \`tee(it, 2)\` duplica um iterador, mas guarda em buffer o que um consumiu e o outro não. Se um dispara na frente, vira uma lista disfarçada.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Iteradores esgotados, geradores, groupby e pipelines preguiçosos.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-gen-q1',
        concept: 'Iterador esgotado',
        say: 'Primeira: um gerador, um `in` e um `list`. O que sobra?',
        prompt: `O que este código imprime?

\`\`\`python
quadrados = (n * n for n in range(4))
print(4 in quadrados)
print(list(quadrados))
\`\`\``,
        options: [
          { text: '`True` e depois `[9]`', correct: true, why: 'O `in` consome o gerador até achar o 4 (passando por 0, 1 e 4) e para. Sobra só o 9.' },
          { text: '`True` e depois `[0, 1, 4, 9]`', why: 'Valeria para uma lista. Genexp é iterador: o que o `in` consumiu não volta.' },
          { text: '`True` e depois `[]`', why: 'O `in` para assim que encontra o item; ele não esgota o resto. Sobrou o `9`.' },
          { text: '`False` e depois `[0, 1, 4, 9]`', why: 'Geradores suportam `in` (por iteração) — e o 4 está lá, é 2 × 2. Além disso, a busca consome o que percorreu.' },
        ],
        explanation: '`x in iterador` avança o iterador até achar `x` ou esgotá-lo. Consumidores "escondidos" — `in`, `any`, `all`, `next`, `zip`, `max` — deixam o iterador em outra posição. Se for reaproveitar, materialize com `list()` antes.',
      },
      {
        type: 'mcq',
        id: 'py-gen-q2',
        concept: 'itertools.groupby',
        say: 'Agora o `groupby`. Cuidado: a resposta "óbvia" está errada.',
        prompt: `O que este código imprime?

\`\`\`python
from itertools import groupby

eventos = ["login", "erro", "login", "login", "erro"]
print({k: len(list(g)) for k, g in groupby(eventos)})
\`\`\``,
        options: [
          { text: "`{'login': 2, 'erro': 1}`", correct: true, why: 'O `groupby` gera 4 grupos: login(1), erro(1), login(2), erro(1). O dict comprehension sobrescreve as chaves repetidas e fica com o **último** grupo de cada uma.' },
          { text: "`{'login': 3, 'erro': 2}`", why: 'É o que uma contagem daria, mas `groupby` não conta: agrupa só elementos **consecutivos**. Para contar, `Counter(eventos)` ou `groupby(sorted(eventos))`.' },
          { text: "`{'login': 1, 'erro': 1}`", why: 'Os grupos repetidos não são descartados: cada um sobrescreve o anterior no dict. O último `login` é o grupo de dois vizinhos.' },
          { text: "`{'login': 0, 'erro': 0}`", why: 'Os grupos só chegam vazios se você avançar o `groupby` antes de lê-los (por exemplo, com `list(groupby(...))`). Aqui cada grupo é lido na hora, com `list(g)`.' },
        ],
        explanation: '`groupby` foi feito para **fluxos**: ele olha só o elemento atual e o anterior, sem memória. Por isso agrupa apenas vizinhos com a mesma chave. Quer grupos globais? Ordene pela mesma chave (`sorted(eventos)`) — ou, se só quer contar, use `collections.Counter`.',
      },
      {
        type: 'order',
        id: 'py-gen-q3',
        concept: 'Geradores',
        say: 'Siga a execução de um gerador passo a passo e ordene o que aparece na tela.',
        prompt: `Em que ordem as letras são impressas?

\`\`\`python
def gerador():
    print("A")
    yield 1
    print("B")
    yield 2
    print("C")

g = gerador()
print("D")
next(g)
print("E")
for _ in g:
    print("F")
\`\`\``,
        items: [
          'Imprime `D`',
          'Imprime `A`',
          'Imprime `E`',
          'Imprime `B`',
          'Imprime `F`',
          'Imprime `C`',
        ],
        explanation: 'Chamar `gerador()` só cria o objeto — nada roda, então `D` vem primeiro. O `next(g)` executa até o primeiro `yield` (imprime `A`) e pausa. Depois do `E`, o `for` retoma: imprime `B`, recebe o 2 e roda o corpo (`F`). No próximo `next`, imprime `C`; o gerador termina com `StopIteration`, que o `for` trata em silêncio.',
      },
      {
        type: 'code',
        id: 'py-gen-q4',
        concept: 'Avaliação preguiçosa',
        title: 'Pipeline preguiçoso de logs',
        points: 40,
        say: 'Mão na massa: um pipeline de logs que lê só o necessário. Os testes espionam quantas linhas você puxou da fonte!',
        prompt: `Cada linha de log tem o formato \`"<ts> <NIVEL> <servico>: <mensagem>"\`, por exemplo \`"2024-05-01T10:00:00 ERROR pagamentos: timeout no gateway"\`.

Implemente, **sem materializar a fonte**:

- \`ler_eventos(linhas)\` — **gerador** que produz um dict \`{"ts", "nivel", "servico", "msg"}\` por linha. Tire espaços e quebras de linha das pontas; pule linhas vazias, comentários (começam com \`#\`) e linhas **malformadas**. A mensagem pode conter \`": "\` (só o primeiro separa serviço e mensagem).
- \`filtrar(eventos, nivel)\` — iterador preguiçoso com os eventos daquele nível.
- \`primeiros(linhas, nivel, n)\` — **lista** com os \`n\` primeiros eventos do nível, lendo da fonte **só as linhas necessárias** (use \`itertools.islice\`).

Os testes contam quantas linhas cada função puxou da fonte.`,
        starter: py(`
          from itertools import islice


          def ler_eventos(linhas):
              """Gera um dict por linha válida: {"ts", "nivel", "servico", "msg"}."""
              # TODO: pule linhas vazias, comentários (#) e malformadas


          def filtrar(eventos, nivel):
              """Só os eventos do nível pedido — preguiçoso!"""


          def primeiros(linhas, nivel, n):
              """Lista com os n primeiros eventos do nível, lendo só o necessário."""
        `),
        tests: [
          {
            name: 'lê e converte eventos',
            code: py(`
              linhas = ["2024-05-01T10:00:00 ERROR pagamentos: timeout no gateway",
                        "2024-05-01T10:00:01 INFO api: ok"]
              eventos = list(ler_eventos(linhas))
              assert eventos == [
                  {"ts": "2024-05-01T10:00:00", "nivel": "ERROR", "servico": "pagamentos", "msg": "timeout no gateway"},
                  {"ts": "2024-05-01T10:00:01", "nivel": "INFO", "servico": "api", "msg": "ok"},
              ], eventos
            `),
          },
          {
            name: 'pula vazias, comentários e malformadas',
            code: py(`
              linhas = ["", "   ", "# comentário", "linha quebrada",
                        "2024-05-01T10:00:02 WARN db: lento: 2s\\n",
                        "2024-05-01T10:00:03 ERROR"]
              eventos = list(ler_eventos(linhas))
              assert eventos == [{"ts": "2024-05-01T10:00:02", "nivel": "WARN", "servico": "db", "msg": "lento: 2s"}], eventos
            `),
          },
          {
            name: 'ler_eventos é preguiçoso',
            code: py(`
              lidas = []
              def fonte():
                  for i in range(1000):
                      lidas.append(i)
                      yield f"2024-05-01T10:00:00 INFO api: req {i}"

              g = ler_eventos(fonte())
              assert lidas == [], "ler_eventos não deveria ler nada antes do primeiro next()"
              primeiro = next(g)
              assert primeiro["msg"] == "req 0", primeiro
              assert len(lidas) == 1, f"leu {len(lidas)} linhas para entregar 1 evento"
            `),
          },
          {
            name: 'filtrar por nível',
            code: py(`
              linhas = ["t1 ERROR a: x", "t2 INFO b: y", "t3 ERROR c: z"]
              erros = filtrar(ler_eventos(linhas), "ERROR")
              assert iter(erros) is erros, "filtrar deveria devolver um iterador (gerador), não uma lista"
              assert [e["servico"] for e in erros] == ["a", "c"]
            `),
          },
          {
            name: 'primeiros lê só o necessário',
            code: py(`
              lidas = []
              def fonte():
                  for i in range(10_000):
                      lidas.append(i)
                      nivel = "ERROR" if i % 3 == 0 else "INFO"
                      yield f"2024-05-01T10:00:00 {nivel} api: req {i}"

              resultado = primeiros(fonte(), "ERROR", 2)
              assert isinstance(resultado, list), "primeiros deve devolver uma lista"
              assert [e["msg"] for e in resultado] == ["req 0", "req 3"], resultado
              assert len(lidas) == 4, f"o pipeline leu {len(lidas)} linhas para achar 2 erros (bastavam 4)"
            `),
          },
          {
            name: 'menos eventos que n: devolve o que houver',
            code: py(`
              linhas = ["t1 ERROR a: x", "t2 INFO b: y"]
              assert [e["servico"] for e in primeiros(linhas, "ERROR", 5)] == ["a"]
              assert primeiros([], "ERROR", 3) == []
            `),
          },
          {
            name: 'filtrar também é preguiçoso',
            hidden: true,
            code: py(`
              lidas = []
              def fonte():
                  for i in range(1000):
                      lidas.append(i)
                      yield f"t{i} ERROR api: req {i}"

              g = filtrar(ler_eventos(fonte()), "ERROR")
              next(g)
              assert len(lidas) == 1, f"filtrar leu {len(lidas)} linhas para entregar 1 evento"
            `),
          },
          {
            name: 'n = 0 não lê nada',
            hidden: true,
            code: py(`
              lidas = []
              def fonte():
                  for i in range(100):
                      lidas.append(i)
                      yield f"t{i} ERROR api: req {i}"

              assert primeiros(fonte(), "ERROR", 0) == []
              assert lidas == [], f"com n = 0, nada deveria ser lido (leu {len(lidas)})"
            `),
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('islice'),
            text: '`itertools.islice(iterador, n)` é o jeito idiomático de "pegar só os n primeiros" de qualquer iterador — sem contador manual, e sem ler nada a mais (nem com `n = 0`).',
            concept: 'itertools',
          },
          {
            when: (m, code) => /\.split\(\s*\)/.test(code),
            text: '`split()` sem limite quebra a mensagem em pedaços que depois precisam ser remontados com `join`. Com `maxsplit` — `linha.split(" ", 2)` e `resto.split(": ", 1)` — você separa só o necessário.',
            concept: 'Parsing',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Um `except` amplo pula a linha "malformada" mas também esconde bugs de verdade no seu código. Capture só o `ValueError` do desempacotamento.',
            concept: 'Tratamento de erros',
          },
        ],
        hints: [
          'Em `ler_eventos`, um `for linha in linhas:` com `yield` já torna a função um gerador. Faça `linha = linha.strip()` e `continue` para vazias e `#`.',
          'Separe com limites: `ts, nivel, resto = linha.split(" ", 2)` e `servico, msg = resto.split(": ", 1)`. Se faltar parte, o desempacotamento lança `ValueError` — capture e pule a linha.',
          '`filtrar` cabe numa genexp: `(e for e in eventos if e["nivel"] == nivel)`. E `primeiros` é uma linha: `list(islice(filtrar(ler_eventos(linhas), nivel), n))`.',
        ],
        solution: py(`
          from itertools import islice


          def ler_eventos(linhas):
              """Gera um dict por linha válida: {"ts", "nivel", "servico", "msg"}."""
              for linha in linhas:
                  linha = linha.strip()
                  if not linha or linha.startswith("#"):
                      continue
                  try:
                      ts, nivel, resto = linha.split(" ", 2)
                      servico, msg = resto.split(": ", 1)
                  except ValueError:          # linha malformada: pula
                      continue
                  yield {"ts": ts, "nivel": nivel, "servico": servico, "msg": msg}


          def filtrar(eventos, nivel):
              """Só os eventos do nível pedido — preguiçoso!"""
              return (e for e in eventos if e["nivel"] == nivel)


          def primeiros(linhas, nivel, n):
              """Lista com os n primeiros eventos do nível, lendo só o necessário."""
              return list(islice(filtrar(ler_eventos(linhas), nivel), n))
        `),
        solutionExplanation: 'Nenhuma etapa guarda a fonte inteira: `ler_eventos` é um gerador que converte uma linha por vez, `filtrar` é uma genexp e `primeiros` só puxa itens até o `islice` dizer "chega". Por isso, para achar 2 erros, o pipeline lê exatamente 4 linhas — e com `n = 0`, nenhuma. O `split` com limite (`maxsplit`) preserva o `": "` dentro da mensagem, e o `except ValueError` estreito pula só as linhas malformadas, sem esconder outros bugs. Só a última etapa materializa — e apenas os `n` itens pedidos.',
      },
      {
        type: 'code',
        id: 'py-gen-q5',
        concept: 'Geradores',
        title: 'Backoff infinito',
        points: 40,
        say: 'Agora um gerador que **nunca termina**: os atrasos de um retry com backoff exponencial. Quem decide quantos usar é quem consome, com `islice`.',
        prompt: `Implemente \`atrasos(base, fator=2, teto=60, rng=None)\`, um gerador **infinito** de atrasos para retries:

- Produz \`base\`, \`base * fator\`, \`base * fator²\`… sempre limitado ao \`teto\`, para sempre.
- Com \`rng\` (um \`random.Random\`), aplica *full jitter*: cada valor vira \`rng.uniform(0, atraso)\`. O jitter **não** altera a progressão — o próximo atraso é calculado a partir do valor sem jitter.
- \`base <= 0\` ou \`fator < 1\` → \`ValueError\` **já na chamada** de \`atrasos(...)\`, não só no primeiro \`next()\`.
- Não durma nem use relógio: o gerador só **calcula**; quem espera é quem consome.

Exemplo: \`list(islice(atrasos(1, 2, 10), 6)) == [1, 2, 4, 8, 10, 10]\`.`,
        starter: py(`
          def atrasos(base, fator=2, teto=60, rng=None):
              """Gera atrasos de backoff exponencial para sempre."""
              # TODO
        `),
        tests: [
          {
            name: 'progressão exponencial',
            code: py(`
              from itertools import islice
              obtidos = list(islice(atrasos(1), 5))
              assert obtidos == [1, 2, 4, 8, 16], obtidos
            `),
          },
          {
            name: 'respeita o teto',
            code: py(`
              from itertools import islice
              obtidos = list(islice(atrasos(1, 2, 10), 6))
              assert obtidos == [1, 2, 4, 8, 10, 10], obtidos
            `),
          },
          {
            name: 'é um gerador (preguiçoso)',
            code: py(`
              g = atrasos(1)
              assert iter(g) is g, "atrasos(...) deveria devolver um iterador/gerador"
              assert next(g) == 1
            `),
          },
          {
            name: 'parâmetros inválidos falham na chamada',
            code: py(`
              for args in [(0,), (-1,), (1, 0.5)]:
                  try:
                      atrasos(*args)
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"atrasos{args} deveria lançar ValueError já na chamada (o corpo de um gerador só roda no 1º next)")
            `),
          },
          {
            name: 'jitter com rng injetado',
            code: py(`
              import random
              from itertools import islice
              obtidos = list(islice(atrasos(1, 2, 8, rng=random.Random(42)), 5))
              ref = random.Random(42)
              esperados = [ref.uniform(0, d) for d in [1, 2, 4, 8, 8]]
              assert obtidos == esperados, obtidos
            `),
          },
          {
            name: 'nunca termina nem estoura',
            hidden: true,
            code: py(`
              g = atrasos(0.5, 3, 5)
              for _ in range(10_000):
                  valor = next(g)
              assert valor == 5, valor
            `),
          },
          {
            name: 'base e fator quaisquer',
            hidden: true,
            code: py(`
              from itertools import islice
              obtidos = list(islice(atrasos(0.5, 3, 100), 6))
              assert obtidos == [0.5, 1.5, 4.5, 13.5, 40.5, 100], obtidos
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /\*\*/.test(code),
            text: 'Calcular `base * fator ** tentativa` faz a potência crescer sem limite: depois de milhares de tentativas vira um inteiro gigante — ou `OverflowError` ao misturar com `float`. Guarde o atraso atual e faça `atraso = min(atraso * fator, teto)`.',
            concept: 'Geradores',
          },
          {
            when: (m, code) => /\bsleep\s*\(|\btime\s*\(/.test(code),
            text: 'O gerador só **calcula** os atrasos; quem dorme é quem consome. Separar as duas coisas deixa o código testável sem esperar de verdade (e o consumidor escolhe `time.sleep` ou `asyncio.sleep`).',
            concept: 'Injeção de dependência',
          },
        ],
        hints: [
          'Gerador infinito = `while True:` com `yield` dentro. Guarde o atraso atual numa variável e, depois de cada `yield`, faça `atraso = min(atraso * fator, teto)`.',
          'A validação dentro de uma função geradora só roda no primeiro `next()`! Separe: `atrasos()` é uma função **normal** que valida e devolve `_gerar(...)`, o gerador de verdade.',
          'Jitter: `yield rng.uniform(0, atraso) if rng is not None else atraso` — e continue multiplicando o `atraso` **sem** jitter.',
        ],
        solution: py(`
          def atrasos(base, fator=2, teto=60, rng=None):
              """Gera atrasos de backoff exponencial para sempre."""
              if base <= 0 or fator < 1:
                  raise ValueError("base deve ser > 0 e fator >= 1")
              return _gerar(base, fator, teto, rng)    # função normal: valida na hora


          def _gerar(base, fator, teto, rng):
              atraso = min(base, teto)
              while True:
                  yield rng.uniform(0, atraso) if rng is not None else atraso
                  atraso = min(atraso * fator, teto)   # nunca passa do teto
        `),
        solutionExplanation: 'O truque está em **separar** validação e geração. Se `atrasos` tivesse `yield` no corpo, o `raise ValueError` só rodaria no primeiro `next()` — longe de quem passou o argumento errado. Como é uma função normal que devolve o gerador `_gerar`, o erro aparece na chamada. O gerador guarda o atraso atual e o multiplica a cada passo, preso ao teto: nada cresce sem limite, mesmo depois de 10 mil tentativas. O jitter é aplicado só no valor entregue, então a progressão não muda. E quem consome decide quantos atrasos usar — `islice(atrasos(1), 5)` — e como esperar.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora o `for` não tem mais segredo: é `iter()` + `next()`, e geradores escrevem o protocolo por você.',
          'Lembre: preguiça economiza memória, mas cobra atenção — iterador esgota, erro aparece tarde e `groupby` só junta vizinhos.',
        ],
        board: null,
      },
    ],
  });
})();
