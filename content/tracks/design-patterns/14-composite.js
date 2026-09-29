Game.registerModule('design-patterns', {
  id: 'composite',
  title: 'Composite',
  kind: 'lesson',
  level: 2,
  order: 24,
  unit: 'estruturais',
  summary: 'Tratar um item e um grupo de itens do mesmo jeito: árvores com interface uniforme e recursão que agrega.',
  concepts: ['Composite', 'Nó folha × composto', 'Recursão em árvores', 'Transparência × segurança'],
  takeaways: [
    'O **Composite** monta hierarquias parte-todo em que **folhas e grupos têm a mesma interface**: o cliente chama `raiz.preco()` sem saber o que tem dentro.',
    'O composto **delega aos filhos e agrega** o resultado (soma, contagem, máximo); a recursão termina nos nós folha.',
    '**Transparência × segurança:** `adicionar()` na interface comum deixa tudo uniforme, mas a folha só falha em runtime; só no composto é mais seguro, mas o cliente precisa saber o tipo.',
    'Composite pressupõe **árvore**: nós compartilhados (DAG) fazem as somas contarem em dobro, e ciclos geram recursão infinita — valide no `adicionar()`.',
    'Árvores muito profundas estouram o limite de recursão do Python (~1000): troque a recursão por uma pilha explícita.',
  ],
  glossary: [
    { term: 'Composite', aliases: ['padrão Composite', 'composite pattern'], definition: 'Padrão estrutural que compõe objetos em **árvores** e permite tratar nós folha e grupos pela mesma interface; o grupo delega aos filhos e agrega os resultados.' },
    { term: 'Nó folha', aliases: ['nós folha', 'nó-folha', 'nós-folha', 'leaf node'], definition: 'Nó de uma árvore que não tem filhos. No Composite, é o objeto que faz o trabalho de fato (um `Arquivo`, um `Produto`), enquanto os compostos só delegam e agregam.' },
    { term: 'Hierarquia parte-todo', aliases: ['hierarquias parte-todo', 'parte-todo', 'part-whole'], definition: 'Estrutura em que um todo é feito de partes que podem, por sua vez, ser todos menores: pasta → subpastas → arquivos; kit → subkits → produtos.' },
    { term: 'Hard link', aliases: ['hard links', 'link físico'], definition: 'Entrada de diretório que aponta para o mesmo *inode* de outro arquivo: o mesmo conteúdo aparece em duas pastas. Transforma a "árvore" do sistema de arquivos num grafo com nós compartilhados.' },
    { term: 'Lista de materiais', aliases: ['bill of materials', 'listas de materiais'], definition: 'Na indústria, a árvore produto → submontagens → peças, com quantidades. "Explodir" a lista é percorrê-la recursivamente para saber quantas peças comprar — um Composite clássico.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto são **árvores**. Pensa numa loja que vende produtos e **kits** — e um kit pode ter produtos e **outros kits** dentro.',
        'Quanto custa o pedido? Sem o padrão certo, a resposta vira uma cascata de `isinstance`.',
      ],
      board: {
        title: 'O problema: itens e grupos de itens',
        md: `\`\`\`text
Pedido
├── Notebook ................ R$ 4.000
├── Kit Home Office (-10%)
│   ├── Mouse ............... R$ 100
│   ├── Teclado ............. R$ 200
│   └── Kit Cabos
│       ├── HDMI ............ R$ 50
│       └── USB-C ........... R$ 30
└── Mochila ................. R$ 250
\`\`\`

Sem um padrão, cada operação precisa perguntar "o que é você?" — e isso se repete no frete, no estoque, na nota fiscal…

\`\`\`python
def preco_total(x):
    if isinstance(x, Produto):
        return x.valor
    if isinstance(x, Kit):
        return sum(preco_total(i) for i in x.itens) * (1 - x.desconto)
    if isinstance(x, Pedido):
        ...                     # e mais um tipo, e mais um if...
\`\`\`

**A ideia do Composite:** um item e um grupo de itens respondem à **mesma pergunta** (\`preco()\`). O grupo responde perguntando aos filhos.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O padrão tem três papéis: a **interface comum**, o **nó folha**, que faz o trabalho, e o **composto**, que guarda filhos.',
        'O composto não calcula nada sozinho: **delega** para cada filho e **agrega** as respostas. A recursão aparece de graça!',
      ],
      board: {
        title: 'Composite: folha e composto com a mesma interface',
        md: `\`\`\`text
        «interface» Item
            preco()
         ▲           ▲
         │           │
     Produto        Kit ◆────► filhos: [Item, Item, ...]
    (nó folha)   (composto)      (produtos OU outros kits)
\`\`\`

\`\`\`python
class Produto:                            # NÓ FOLHA: faz o trabalho
    def __init__(self, nome, valor):
        self.nome, self.valor = nome, valor

    def preco(self):
        return self.valor


class Kit:                                # COMPOSTO: delega e agrega
    def __init__(self, nome, desconto=0.0):
        self.nome, self.desconto = nome, desconto
        self.filhos = []

    def adicionar(self, item):
        self.filhos.append(item)
        return self                       # permite encadear

    def preco(self):
        bruto = sum(f.preco() for f in self.filhos)   # recursão natural
        return bruto * (1 - self.desconto)


cabos = Kit("Cabos").adicionar(Produto("HDMI", 50)).adicionar(Produto("USB-C", 30))
home = Kit("Home Office", desconto=0.10)
home.adicionar(Produto("Mouse", 100)).adicionar(Produto("Teclado", 200)).adicionar(cabos)
home.preco()     # (100 + 200 + 80) × 0.9 = 342.0
\`\`\``,
        caption: 'O cliente chama `preco()` num produto, num kit ou num kit de kits — do mesmo jeito.',
      },
    },
    {
      type: 'say',
      text: [
        'Toda operação no composto segue a mesma receita: pergunta aos filhos e **combina**. Somar tamanhos, contar arquivos, listar caminhos…',
        'E o padrão está em todo lugar: sistema de arquivos, interfaces gráficas, árvores de expressão — o próprio módulo `ast` do Python é um Composite.',
      ],
      board: {
        title: 'Recursão que agrega — e onde o Composite aparece',
        md: `\`\`\`python
class Arquivo:
    def __init__(self, nome, kb):
        self.nome, self.kb = nome, kb

    def tamanho(self):
        return self.kb

    def caminhos(self, prefixo=""):
        yield prefixo + self.nome


class Pasta:
    def __init__(self, nome, *filhos):
        self.nome, self.filhos = nome, list(filhos)

    def tamanho(self):                       # agrega: soma
        return sum(f.tamanho() for f in self.filhos)

    def caminhos(self, prefixo=""):          # percorre: pré-ordem
        base = prefixo + self.nome + "/"
        yield base
        for f in self.filhos:
            yield from f.caminhos(base)


src = Pasta("src", Arquivo("main.py", 12),
            Pasta("utils", Arquivo("io.py", 8), Arquivo("tempo.py", 3)))
src.tamanho()          # 23
list(src.caminhos())   # ['src/', 'src/main.py', 'src/utils/', 'src/utils/io.py', 'src/utils/tempo.py']
\`\`\`

| Domínio | Nó folha | Composto | Operação que agrega |
|---|---|---|---|
| Sistema de arquivos | \`Arquivo\` | \`Pasta\` | tamanho total, busca |
| Loja | \`Produto\` | \`Kit\`, \`Pedido\` | preço, peso para o frete |
| Expressões | \`Numero(2)\` | \`Soma(a, b)\`, \`Mult(a, b)\` | \`avaliar()\` |
| Interface gráfica | \`Botao\`, \`Rotulo\` | \`Painel\`, \`Janela\` | \`desenhar()\`, \`mover(dx, dy)\` |
| Indústria | peça | submontagem | "explodir" a lista de materiais |`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora um dilema que o próprio GoF discute: onde fica o `adicionar()`?',
        'Se estiver na interface comum, tudo fica uniforme… mas um produto "tem" um método que não faz sentido. Se ficar só no kit, é seguro… mas o cliente precisa saber com quem fala.',
      ],
      board: {
        title: 'Transparência × segurança: onde fica o adicionar()?',
        md: `| | **Transparente** | **Segura** |
|---|---|---|
| Onde fica \`adicionar()\` | Na interface comum: todos têm | Só no composto |
| Cliente | Trata tudo igual, sem perguntar o tipo | Precisa saber que tem um composto nas mãos |
| Erro de uso | \`produto.adicionar(x)\` só falha **em runtime** | Pego **antes**, pelo type checker ou pela IDE |
| Preço | A folha ganha um método sem sentido (fere o LSP) | Um pouco menos de uniformidade |

\`\`\`python
from typing import Protocol

# TRANSPARENTE: a folha também "tem" adicionar()...
class Produto:
    def adicionar(self, item):
        raise TypeError("Produto é nó folha: não tem filhos")   # só em runtime


# SEGURA: a interface comum só tem o que TODOS fazem de verdade
class Item(Protocol):
    def preco(self) -> float: ...
# ...e só Kit define adicionar(); o mypy acusa produto.adicionar(x)
\`\`\`

> [!dica] Em Python, a abordagem **segura** costuma ganhar: um \`Protocol\` com as operações comuns (\`preco()\`, \`tamanho()\`) e \`adicionar()\` só no composto. O GoF ainda sugere um meio-termo pouco lembrado: uma operação \`get_composite()\` que devolve \`self\` no composto e \`None\` na folha — descobre-se o tipo sem \`isinstance\`.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Cuidado: o Composite **assume uma árvore**. Se um nó aparece em dois lugares, ou pior, dentro de si mesmo, as operações recursivas se perdem.',
        'E árvores muito fundas esbarram no limite de recursão do Python.',
      ],
      board: {
        title: '⚠️ Quando a árvore deixa de ser árvore',
        md: `**Ciclos:** se uma pasta for adicionada dentro dela mesma (direta ou indiretamente), \`tamanho()\` nunca termina: \`RecursionError\`. Valide no \`adicionar()\`.

**Nós compartilhados:** se o mesmo kit está em dois lugares, a "árvore" virou um **DAG** (grafo acíclico dirigido) e as somas contam aquele kit duas vezes. Se isso é possível no seu domínio, agregue com um conjunto de visitados.

**Profundidade:** o limite padrão de recursão é ~1000 (\`sys.getrecursionlimit()\`). Para árvores muito fundas, troque a recursão por uma **pilha explícita**:

\`\`\`python
def tamanho_iterativo(raiz):
    total, pilha = 0, [raiz]
    while pilha:
        no = pilha.pop()
        filhos = getattr(no, "filhos", None)
        if filhos is None:
            total += no.tamanho()          # nó folha
        else:
            pilha.extend(filhos)           # composto: empilha os filhos
    return total
\`\`\`

> [!sabia] Sistemas de arquivos reais **não são árvores**: um *hard link* faz o mesmo arquivo (o mesmo *inode*) aparecer em duas pastas. Por isso o \`du\` do Unix guarda os pares (dispositivo, inode) que já viu — sem isso, somaria o mesmo arquivo duas vezes. É exatamente o problema de agregar um Composite que virou DAG.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Folhas, compostos e recursão.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-cmp-q1',
      concept: 'Composite',
      say: 'Para começar: qual padrão modela este editor?',
      prompt: 'Num editor de diagramas, o usuário pode **agrupar** formas; um grupo pode conter formas **e outros grupos**, e mover ou redimensionar um grupo deve afetar tudo o que está dentro dele. Qual padrão modela isso melhor?',
      options: [
        { text: 'Composite', correct: true, why: 'Hierarquia parte-todo com interface uniforme: `grupo.mover(dx, dy)` repassa aos filhos, que podem ser formas ou outros grupos.' },
        { text: 'Decorator', why: 'O Decorator embrulha **um** objeto para adicionar comportamento; aqui um grupo tem **vários** filhos e agrega as operações.' },
        { text: 'Flyweight', why: 'Flyweight compartilha estado para economizar memória; não trata de agrupar objetos em árvore.' },
        { text: 'Bridge', why: 'Bridge separa abstração de implementação (ex.: forma × renderizador); não organiza objetos em grupos aninhados.' },
      ],
      explanation: 'O sinal clássico do Composite é: "um X pode conter X\'s" e o cliente quer tratar **um** e **muitos** do mesmo jeito. O GoF observa que o Decorator parece um "Composite degenerado" com um único filho — mas a intenção é outra: adicionar responsabilidades, não agregar objetos.',
    },
    {
      type: 'mcq',
      id: 'dp-cmp-q2',
      concept: 'Recursão em árvores',
      say: 'Agora, faça as contas como a recursão faria.',
      prompt: `Usando o \`Kit\` do quadro (soma os filhos e aplica o **próprio** desconto), quanto vale \`pedido.preco()\`?

\`\`\`python
interno = Kit("Interno", desconto=0.5)
interno.adicionar(Produto("A", 40)).adicionar(Produto("B", 60))

pedido = Kit("Pedido", desconto=0.1)
pedido.adicionar(Produto("C", 100)).adicionar(interno)

print(pedido.preco())
\`\`\``,
      options: [
        { text: '`135.0`', correct: true, why: 'O kit interno vale `(40 + 60) × 0,5 = 50`; o pedido soma `100 + 50 = 150` e aplica 10%: `135`.' },
        { text: '`180.0`', why: 'Esse valor ignora o desconto do kit interno: `(100 + 100) × 0,9`. Cada composto aplica o **seu** desconto antes de responder ao pai.' },
        { text: '`150.0`', why: 'Esse valor ignora o desconto do pedido: `100 + 50`. O pedido também é um `Kit` e aplica os seus 10%.' },
        { text: '`200.0`', why: 'Esse é o preço sem nenhum desconto; os dois kits aplicam os seus.' },
      ],
      explanation: 'A recursão resolve **de dentro para fora**: o pedido pergunta o preço aos filhos; o kit interno, por sua vez, pergunta aos dele, aplica o próprio desconto e devolve `50`. Cada composto só conhece os filhos **diretos** e confia que cada um sabe responder `preco()` — é essa confiança (polimorfismo) que dispensa os `isinstance`.',
    },
    {
      type: 'match',
      id: 'dp-cmp-q3',
      concept: 'Composite',
      say: 'Rodada rápida: quem é quem no Composite?',
      prompt: 'Associe cada papel (ou decisão) do Composite à sua descrição.',
      pairs: [
        { left: 'Componente', right: 'Interface comum a folhas e compostos, ex.: `tamanho()`' },
        { left: 'Nó folha', right: 'Não tem filhos e faz o trabalho de fato, ex.: `Arquivo`' },
        { left: 'Composto', right: 'Guarda filhos, delega a eles e agrega o resultado, ex.: `Pasta`' },
        { left: 'Cliente', right: 'Chama `raiz.tamanho()` sem saber se é um item ou um grupo' },
        { left: 'Abordagem transparente', right: '`adicionar()` na interface comum; na folha, só falha em runtime' },
      ],
      explanation: 'O **componente** define o contrato; **folhas** fazem o trabalho; **compostos** delegam e agregam; o **cliente** só conhece o contrato. A abordagem **transparente** põe até o gerenciamento de filhos no contrato — uniforme, mas com erros só em runtime; a **segura** deixa `adicionar()` apenas no composto.',
    },
    {
      type: 'code',
      id: 'dp-cmp-q4',
      concept: 'Composite',
      title: 'Sistema de arquivos sem ciclos',
      say: 'Agora é com você: um sistema de arquivos em Composite — e à prova de ciclos!',
      prompt: `Implemente \`Arquivo(nome, kb)\` e \`Pasta(nome)\` com a **mesma interface**:

- \`tamanho()\`: o arquivo devolve seu \`kb\`; a pasta, a soma dos filhos (pasta vazia = \`0\`);
- \`contar_arquivos()\`: o arquivo devolve \`1\`; a pasta, o total de arquivos abaixo dela;
- \`Pasta.adicionar(item)\` acrescenta o item em \`self.filhos\` e **devolve a própria pasta** (para encadear);
- \`adicionar\` deve lançar \`ValueError\` (sem alterar nada) se o item criar um **ciclo**: for a própria pasta ou uma pasta que a **contém** (um ancestral).

Só recuse ciclos: colocar a mesma subpasta em dois lugares diferentes é permitido — ela será contada duas vezes, como no DAG do quadro.`,
      starter: `class Arquivo:
    def __init__(self, nome, kb):
        self.nome = nome
        self.kb = kb

    def tamanho(self):
        pass

    def contar_arquivos(self):
        pass


class Pasta:
    def __init__(self, nome):
        self.nome = nome
        self.filhos = []

    def adicionar(self, item):
        pass

    def tamanho(self):
        pass

    def contar_arquivos(self):
        pass
`,
      tests: [
        { name: 'arquivo sozinho', code: `a = Arquivo("a.txt", 10)
assert a.tamanho() == 10, f"tamanho = {a.tamanho()}"
assert a.contar_arquivos() == 1` },
        { name: 'pasta vazia', code: `p = Pasta("vazia")
assert p.tamanho() == 0, f"tamanho = {p.tamanho()}"
assert p.contar_arquivos() == 0` },
        { name: 'árvore aninhada', code: `utils = Pasta("utils")
utils.adicionar(Arquivo("io.py", 8)).adicionar(Arquivo("tempo.py", 3))
src = Pasta("src")
src.adicionar(Arquivo("main.py", 12)).adicionar(utils).adicionar(Pasta("vazia"))
assert src.tamanho() == 23, f"tamanho = {src.tamanho()}"
assert src.contar_arquivos() == 3, f"arquivos = {src.contar_arquivos()}"` },
        { name: 'adicionar devolve a própria pasta', code: `p = Pasta("p")
assert p.adicionar(Arquivo("x", 1)) is p, "adicionar deve devolver self para permitir encadear"` },
        { name: 'pasta dentro dela mesma → ValueError', code: `p = Pasta("p")
try:
    p.adicionar(p)
except ValueError:
    pass
else:
    raise AssertionError("adicionar uma pasta nela mesma deveria lançar ValueError")
assert p.filhos == [], "a pasta não pode ficar com o filho inválido"` },
        { name: 'ciclo indireto → ValueError', hidden: true, code: `a = Pasta("a")
b = Pasta("b")
c = Pasta("c")
a.adicionar(b)
b.adicionar(c)
c.adicionar(Arquivo("f", 5))
try:
    c.adicionar(a)
except ValueError:
    pass
else:
    raise AssertionError("a → b → c → a é um ciclo")
assert a.tamanho() == 5 and a.contar_arquivos() == 1` },
        { name: 'mesma subpasta em dois lugares é permitida', hidden: true, code: `comum = Pasta("comum").adicionar(Arquivo("x", 1))
p1 = Pasta("p1").adicionar(comum)
p2 = Pasta("p2").adicionar(comum)
raiz = Pasta("raiz").adicionar(p1).adicionar(p2)
assert raiz.tamanho() == 2 and raiz.contar_arquivos() == 2` },
        { name: 'adicionar um descendente de novo não é ciclo', hidden: true, code: `raiz = Pasta("raiz")
sub = Pasta("sub")
raiz.adicionar(sub)
sub.adicionar(Arquivo("y", 4))
outra = Pasta("outra").adicionar(sub)
raiz.adicionar(outra)
assert raiz.tamanho() == 8` },
      ],
      reviews: [
        {
          when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
          text: 'Você distinguiu arquivo e pasta com `isinstance`/`type`. O ponto do Composite é o **polimorfismo**: se todo nó sabe responder `tamanho()` (e, para o ciclo, `contem(no)`), a pasta só delega — e um tipo novo de nó não obriga a mexer nela.',
          concept: 'Composite',
        },
        {
          when: m => m.classes.some(c => c.name === 'Arquivo' && c.methods.includes('adicionar')),
          text: 'Seu `Arquivo` tem `adicionar()`: é a abordagem **transparente**. Ela é válida, mas cria um método que a folha não pode honrar (só falha em runtime). Aqui, deixar `adicionar()` apenas na `Pasta` (abordagem segura) é mais simples e honesto.',
          concept: 'Transparência × segurança',
        },
      ],
      hints: [
        'No `Arquivo`, `tamanho()` devolve `self.kb` e `contar_arquivos()` devolve `1`. Na `Pasta`, some os filhos: `sum(f.tamanho() for f in self.filhos)`.',
        'Para detectar o ciclo, dê a **todos** os nós um método `contem(no)`: no arquivo, `return self is no`; na pasta, `self is no` **ou** algum filho contém `no`.',
        'Em `adicionar(item)`: se `item.contem(self)`, lance `ValueError`; senão, `self.filhos.append(item)` e `return self`.',
      ],
      solution: `class Arquivo:
    def __init__(self, nome, kb):
        self.nome = nome
        self.kb = kb

    def tamanho(self):
        return self.kb

    def contar_arquivos(self):
        return 1

    def contem(self, no):
        return self is no


class Pasta:
    def __init__(self, nome):
        self.nome = nome
        self.filhos = []

    def adicionar(self, item):
        if item.contem(self):              # item é a própria pasta ou um ancestral
            raise ValueError(f"adicionar {item.nome!r} em {self.nome!r} criaria um ciclo")
        self.filhos.append(item)
        return self

    def tamanho(self):
        return sum(f.tamanho() for f in self.filhos)

    def contar_arquivos(self):
        return sum(f.contar_arquivos() for f in self.filhos)

    def contem(self, no):
        return self is no or any(f.contem(no) for f in self.filhos)
`,
      solutionExplanation: 'Arquivos e pastas respondem às mesmas perguntas (`tamanho`, `contar_arquivos`, `contem`), então a pasta só **delega e agrega** — sem nenhum `isinstance`. A checagem de ciclo também é polimórfica: pôr `item` dentro de `self` cria um ciclo exatamente quando `item` já **contém** `self` (é ela mesma ou um ancestral). Compartilhar a mesma subpasta em dois lugares não é ciclo; ela só é contada duas vezes — o comportamento de DAG que vimos no quadro.',
    },
    {
      type: 'open',
      id: 'dp-cmp-q5',
      concept: 'Transparência × segurança',
      say: 'Para fechar, uma decisão de design para você defender.',
      prompt: 'Ao desenhar um Composite, onde você colocaria `adicionar()`/`remover()`: na interface **comum** (transparente) ou só no **composto** (segura)? Explique o trade-off e qual você escolheria em Python.',
      minWords: 25,
      rubric: [
        { label: 'Explica a abordagem **transparente**: todos têm `adicionar`, o cliente trata tudo igual', keywords: ['transparen', 'uniform', 'interface comum', 'todos tem', 'trata tudo igual', 'tratar tudo igual', 'mesma interface'], concept: 'Composite', why: 'A vantagem da transparência é o cliente nunca precisar distinguir folha de composto.' },
        { label: 'Aponta o custo: a folha ganha um método sem sentido e o erro só aparece em **runtime**', keywords: ['runtime', 'tempo de execucao', 'em execucao', 'lanca erro', 'lancar erro', 'lanca excecao', 'lancar excecao', 'sem sentido', 'nao faz sentido', 'liskov', 'lsp', 'typeerror', 'notimplemented'], concept: 'LSP', why: 'Uma folha que "tem" `adicionar()` mas sempre falha quebra a expectativa do contrato.' },
        { label: 'Explica a abordagem **segura**: só o composto tem, e erros são pegos antes', keywords: ['segur', 'so no composto', 'apenas no composto', 'somente no composto', 'type checker', 'mypy', 'estatic', 'antes de rodar', 'antes de executar'], concept: 'Transparência × segurança', why: 'Com o método só no composto, o type checker aponta o uso errado antes de o código rodar.' },
        { label: 'Aponta o custo da segura: o cliente precisa **saber o tipo** do nó', keywords: ['isinstance', 'saber o tipo', 'conhecer o tipo', 'checar o tipo', 'verificar o tipo', 'saber se', 'precisa saber', 'distinguir', 'menos uniform', 'get_composite'], concept: 'Composite', why: 'Para adicionar filhos, o cliente precisa ter em mãos (ou descobrir) que o nó é um composto.' },
      ],
      modelAnswer: `É o dilema **transparência × segurança** do GoF:

- **Transparente:** \`adicionar()\`/\`remover()\` ficam na **interface comum**. O cliente trata tudo de forma **uniforme**, sem perguntar o tipo. O custo é que a folha ganha um método **sem sentido**, que só falha em **runtime** (lança \`TypeError\`) — fere o LSP.
- **Segura:** os métodos ficam **só no composto**. Erros de uso são pegos antes, pelo **type checker** (mypy) ou pela IDE. O custo é que o cliente **precisa saber o tipo** do nó (ou usar \`isinstance\`/\`get_composite()\`) para adicionar filhos.

Em Python eu escolheria a **segura**: um \`Protocol\` com as operações que todos fazem de verdade (\`tamanho()\`, \`preco()\`) e \`adicionar()\` apenas no composto — normalmente quem monta a árvore já sabe que está lidando com uma pasta ou um kit.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Composite é tratar **um** e **muitos** do mesmo jeito: folhas trabalham, compostos delegam e agregam.',
        'Lembre do dilema transparência × segurança e dos perigos quando a árvore vira DAG ou ganha ciclos. Próximo: **Bridge**!',
      ],
      board: null,
    },
  ],
});
