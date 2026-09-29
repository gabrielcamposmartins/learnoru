Game.registerModule('design-patterns', {
  id: 'visitor',
  title: 'Visitor',
  kind: 'lesson',
  level: 3,
  order: 39,
  unit: 'comportamentais',
  summary: 'Novas operações sobre uma árvore de objetos sem tocar nas classes: double dispatch, `singledispatch`, `ast.NodeVisitor` — e quando um `match` resolve melhor.',
  concepts: ['Visitor', 'Double dispatch', 'singledispatch', 'ast.NodeVisitor', 'Expression problem'],
  takeaways: [
    'O Visitor tira as **operações** de dentro das classes de uma estrutura estável (como uma árvore de nós) e agrupa cada operação num lugar só: criar uma operação nova vira escrever **um** visitante.',
    'Python (como Java) só despacha pelo tipo do receptor; o `aceitar` → `visitar_x` clássico simula o **double dispatch**. Em Python dá para despachar pelo **nome** do tipo, como o `ast.NodeVisitor`, ou pelo tipo com `functools.singledispatch`.',
    'No `ast.NodeVisitor`, cada `visit_<Tipo>` trata um nó e o `generic_visit` continua a descida — esquecê-lo **poda** a subárvore em silêncio.',
    'É o **expression problem**: com métodos nas classes, é fácil criar tipos e difícil criar operações; com Visitor ou `match`, o contrário. Escolha pelo eixo que mais muda.',
    'Com um conjunto **fechado** de nós, `match` com padrões de classe costuma ser o visitante mais direto — e casa padrões **aninhados**. Sempre com um `case _:` que falha alto.',
  ],
  glossary: [
    { term: 'Double dispatch', aliases: ['despacho duplo', 'dispatch duplo'], definition: 'Escolher a implementação pelo tipo de **dois** objetos. Python e Java só despacham pelo receptor (*single dispatch*); o Visitor simula o duplo com duas chamadas: `no.aceitar(v)` → `v.visitar_soma(no)`.' },
    { term: 'Multiple dispatch', aliases: ['despacho múltiplo', 'multimétodos', 'multimétodo', 'multimethods'], definition: 'Escolha da implementação pelo tipo de **todos** os argumentos. É nativo em Julia e no CLOS (Common Lisp); nessas linguagens, o Visitor praticamente não é necessário.' },
    { term: 'singledispatch', aliases: ['functools.singledispatch', 'singledispatchmethod', 'função genérica', 'funções genéricas'], definition: 'Decorador do `functools` que cria uma **função genérica**: a implementação é escolhida pelo tipo do primeiro argumento, e novas versões são registradas com `.register` — inclusive a partir de outros módulos.' },
    { term: 'Expression problem', aliases: ['problema da expressão'], definition: 'Nome dado por Philip Wadler (1998) ao desafio de estender um tipo de dados nos **dois eixos** — novos casos e novas operações — sem alterar o código existente e mantendo a checagem estática de tipos.' },
    { term: 'AST', aliases: ['ASTs', 'árvore sintática abstrata', 'árvores sintáticas abstratas', 'abstract syntax tree'], definition: 'Árvore que representa a estrutura de um programa, sem detalhes de formatação. Em Python, `ast.parse` a produz e `ast.NodeVisitor` a percorre; linters, formatadores e este jogo trabalham sobre ela.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é dia de **Visitor** — o padrão de fama mais assustadora do GoF. Prometo que ele é mais simples do que parece.',
        'O cenário: uma árvore de expressões que precisa de cada vez mais **operações**.',
      ],
      board: {
        title: 'O problema: operações demais dentro das classes',
        md: `\`\`\`python
class Num:
    def __init__(self, valor):
        self.valor = valor

    def avaliar(self):
        return self.valor

    def imprimir(self):
        return str(self.valor)

    # …e simplificar(), derivar(), para_json(), contar_nos()…


class Soma:
    def __init__(self, esq, dir):
        self.esq, self.dir = esq, dir

    def avaliar(self):
        return self.esq.avaliar() + self.dir.avaliar()

    def imprimir(self):
        return f"({self.esq.imprimir()} + {self.dir.imprimir()})"

    # …as mesmas operações de novo, e em Mult, Neg, Var…
\`\`\`

\`\`\`text
          avaliar   imprimir   simplificar   derivar   para_json
  Num        ●         ●            ●           ●          ●
  Soma       ●         ●            ●           ●          ●
  Mult       ●         ●            ●           ●          ●
\`\`\`

Os **tipos de nó** quase nunca mudam; as **operações** não param de chegar. E cada operação nova obriga a abrir **todas** as classes.

**Intenção (GoF):** representar uma operação a ser executada sobre os elementos de uma estrutura, permitindo definir **novas operações sem mudar as classes** desses elementos.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A solução clássica agrupa cada operação num objeto, o **visitante**, com um método por tipo de nó.',
        'E cada nó ganha um único método, `aceitar`, que faz a ponte. É aqui que mora o tal **double dispatch**.',
      ],
      board: {
        title: 'Visitor clássico e o double dispatch',
        md: `\`\`\`python
class Num:
    def __init__(self, valor):
        self.valor = valor

    def aceitar(self, visitante):
        return visitante.visitar_num(self)


class Soma:
    def __init__(self, esq, dir):
        self.esq, self.dir = esq, dir

    def aceitar(self, visitante):
        return visitante.visitar_soma(self)


class Avaliador:                            # uma operação = uma classe
    def visitar_num(self, no):
        return no.valor

    def visitar_soma(self, no):
        return no.esq.aceitar(self) + no.dir.aceitar(self)


class Impressor:
    def visitar_num(self, no):
        return str(no.valor)

    def visitar_soma(self, no):
        return f"({no.esq.aceitar(self)} + {no.dir.aceitar(self)})"


expr = Soma(Num(1), Soma(Num(2), Num(3)))
expr.aceitar(Avaliador())                   # 6
expr.aceitar(Impressor())                   # '(1 + (2 + 3))'
\`\`\`

\`\`\`text
 expr.aceitar(avaliador)             1º despacho, pelo tipo do NÓ:        Soma.aceitar
   └▶ avaliador.visitar_soma(expr)   2º despacho, pelo tipo do VISITANTE: Avaliador.visitar_soma
\`\`\`

Python escolhe o método só pelo tipo do **receptor** (*single dispatch*). Como a resposta depende de **dois** tipos — o nó e a operação —, o Visitor encadeia dois despachos simples.

> [!atencao] O Visitor **não** se paga quando os tipos de nó mudam com frequência: cada tipo novo exige um \`visitar_x\` em **todos** os visitantes. Ele brilha com estruturas **estáveis** e operações que crescem.`,
      },
    },
    {
      type: 'say',
      text: [
        'Em Python, o `aceitar` é opcional: dá para despachar pelo **nome** do tipo.',
        'É exatamente assim que funciona o `ast.NodeVisitor` — um Visitor de verdade, na biblioteca padrão.',
      ],
      board: {
        title: 'Na stdlib: ast.NodeVisitor',
        md: `\`\`\`python
class Visitante:
    def visitar(self, no):
        metodo = getattr(self, "visitar_" + type(no).__name__.lower(), self.generico)
        return metodo(no)

    def generico(self, no):
        raise TypeError(f"nó sem visitante: {type(no).__name__}")
\`\`\`

O \`ast.NodeVisitor\` faz o mesmo com \`visit_<Tipo>\` e, no \`generic_visit\`, **desce** pelos filhos. Um contador de chamadas de função em poucas linhas:

\`\`\`python
import ast


class ContaChamadas(ast.NodeVisitor):
    def __init__(self):
        self.chamadas = {}

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            nome = node.func.id
            self.chamadas[nome] = self.chamadas.get(nome, 0) + 1
        self.generic_visit(node)            # continua descendo: há chamadas dentro de chamadas


v = ContaChamadas()
v.visit(ast.parse("print(len(x))\\nprint(y)"))
v.chamadas                                  # {'print': 2, 'len': 1}
\`\`\`

> [!atencao] Esqueceu o \`self.generic_visit(node)\` num \`visit_X\`? A subárvore daquele nó é **podada** em silêncio: o \`len\` dentro do \`print\` nunca seria contado.

- \`ast.NodeTransformer\` é o primo que **reescreve**: cada \`visit_X\` devolve o nó novo (ou \`None\` para removê-lo).
- Linters (pyflakes, ruff), formatadores e ferramentas de refatoração vivem de visitantes sobre a AST.

> [!sabia] Os reviews que este jogo faz do seu código saem de um \`ast.NodeVisitor\`: uma classe com \`visit_Call\`, \`visit_For\`, \`visit_Name\`… que conta laços, chamadas, recursão e complexidade enquanto percorre a árvore do que você escreveu.`,
      },
    },
    {
      type: 'say',
      text: [
        'Outra saída pythônica: `functools.singledispatch`. Cada **operação** vira uma função genérica, com uma implementação por tipo.',
        'Sem `aceitar`, sem classe visitante — e dá para registrar tipos novos **de fora** do módulo.',
      ],
      board: {
        title: 'functools.singledispatch: o visitante vira função',
        md: `\`\`\`python
from functools import singledispatch


@singledispatch
def avaliar(no):
    raise TypeError(f"não sei avaliar {type(no).__name__}")


@avaliar.register
def _(no: Num):
    return no.valor


@avaliar.register
def _(no: Soma):
    return avaliar(no.esq) + avaliar(no.dir)


# em OUTRO módulo, um plugin que trouxe um nó novo:
@avaliar.register
def _(no: Pot):
    return avaliar(no.base) ** avaliar(no.expoente)
\`\`\`

- A implementação é escolhida pelo tipo do **primeiro argumento**, respeitando herança: registre para a classe base e as subclasses herdam.
- \`avaliar.registry\` mostra o que está registrado; \`avaliar.dispatch(Soma)\` diz qual função seria usada.
- Para métodos, use \`functools.singledispatchmethod\`.

| | Visitor clássico | Por nome (\`NodeVisitor\`) | \`singledispatch\` |
|---|---|---|---|
| Nós precisam de \`aceitar\`? | sim | não | não |
| Uma operação é… | uma classe | uma classe | uma função |
| Tipo novo vindo de outro módulo | edita todos os visitantes | cada visitante ganha um \`visit_Novo\` (ou cai no genérico) | \`.register\` de fora |
| Estado durante o percurso | atributos do visitante | atributos do visitante | parâmetros extras |

> [!sabia] Com **multiple dispatch** — a escolha pelo tipo de *todos* os argumentos —, o Visitor quase desaparece. É o modelo central da linguagem **Julia** e existe desde os anos 1980 no **CLOS**, o sistema de objetos do Common Lisp. O Visitor é, em boa parte, um remendo para linguagens que só despacham pelo receptor.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora o conceito que separa quem decorou o padrão de quem entendeu: o **expression problem**.',
        'Toda estrutura de dados cresce em dois eixos — e nenhum design clássico é bom nos dois.',
      ],
      board: {
        title: 'O expression problem',
        md: `| Design | Novo **tipo** de nó (\`Pot\`) | Nova **operação** (\`derivar\`) |
|---|---|---|
| Métodos nas classes (OO clássico) | ✅ uma classe nova, nada muda | ❌ abre **todas** as classes |
| Visitor ou funções com \`match\` | ❌ abre **todos** os visitantes | ✅ um visitante (ou função) novo |
| \`singledispatch\` | ✅ \`.register\` de fora | ✅ uma função genérica nova |

A última linha parece vencer nos dois eixos… mas sem checagem estática: esqueceu de registrar \`Pot\` em \`imprimir\`? Você descobre com um \`TypeError\` **em produção**.

Na prática, escolha pelo **eixo que mais muda**:

- **Compiladores e interpretadores**: a gramática (os tipos de nó) é estável e as operações se multiplicam (checar tipos, otimizar, gerar código) → Visitor ou \`match\`.
- **Widgets de interface**: surgem componentes novos o tempo todo, e as operações são poucas (desenhar, medir) → métodos nas próprias classes.

> [!sabia] O nome é de **Philip Wadler**, num e-mail de 1998: o desafio é definir um tipo de dados por casos e poder acrescentar **novos casos e novas operações** sem recompilar o código existente e **mantendo a segurança de tipos**. Linguagens atacam o problema com *type classes* (Haskell), *traits* (Rust, Scala), multimétodos e técnicas como *object algebras* — e o tema ainda rende artigos acadêmicos.`,
      },
    },
    {
      type: 'say',
      text: [
        'Por fim: desde o Python 3.10, muitas vezes o melhor visitante é um bom `match`.',
        'Com dataclasses, cada caso vira uma linha — e dá para casar padrões **aninhados**, coisa que visitante nenhum faz sozinho.',
      ],
      board: {
        title: 'Quando o match resolve melhor',
        md: `\`\`\`python
from dataclasses import dataclass


@dataclass(frozen=True)
class Num:
    valor: float


@dataclass(frozen=True)
class Soma:
    esq: object
    dir: object


@dataclass(frozen=True)
class Mult:
    esq: object
    dir: object


def avaliar(e):
    match e:
        case Num(v):
            return v
        case Soma(a, b):
            return avaliar(a) + avaliar(b)
        case Mult(a, b):
            return avaliar(a) * avaliar(b)
        case _:
            raise TypeError(f"nó desconhecido: {e!r}")


def simplificar(e):                     # padrões ANINHADOS: o forte do match
    match e:
        case Soma(x, Num(0)) | Soma(Num(0), x):
            return simplificar(x)
        case Mult(x, Num(1)) | Mult(Num(1), x):
            return simplificar(x)
        case Mult(_, Num(0)) | Mult(Num(0), _):
            return Num(0)
        case Soma(a, b):
            return Soma(simplificar(a), simplificar(b))
        case Mult(a, b):
            return Mult(simplificar(a), simplificar(b))
        case _:
            return e
\`\`\`

| Situação | Melhor escolha |
|---|---|
| Conjunto **fechado** de nós, operações no mesmo pacote | \`match\` com padrões de classe |
| Regras que olham **vários níveis** da árvore (simplificar, otimizar) | \`match\` com padrões aninhados |
| Tipos **abertos**: plugins trazem nós novos | \`singledispatch\` |
| Árvore grande em que só alguns nós interessam | visitante com \`generic_visit\` (\`ast.NodeVisitor\`) |
| Poucas operações, tipos que crescem | métodos nas próprias classes |

> [!dica] Com type checker, anote o nó como uma união (\`Num | Soma | Mult\`) e feche o \`match\` com \`case _: assert_never(e)\` (de \`typing\`, Python 3.11+). Se alguém criar um nó novo e esquecer um caso, o **mypy/pyright** aponta antes de rodar — a checagem estática que o expression problem pede.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Despacho, mecanismos, um linter com NodeVisitor e uma árvore de expressões.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-vis-q1',
      concept: 'Double dispatch',
      say: 'Primeira: um colega veio do Java e tentou fazer "sobrecarga".',
      prompt: `O que acontece ao executar a última linha?

\`\`\`python
class Num:
    def __init__(self, valor):
        self.valor = valor


class Soma:
    def __init__(self, esq, dir):
        self.esq, self.dir = esq, dir


class Avaliador:
    def visitar(self, no: Num):
        return no.valor

    def visitar(self, no: Soma):
        return self.visitar(no.esq) + self.visitar(no.dir)


Avaliador().visitar(Num(3))
\`\`\``,
      options: [
        { text: 'Devolve `3`: o Python escolhe o `visitar` pela anotação do parâmetro.', why: 'Python não tem sobrecarga por tipo: anotações não participam da escolha do método em tempo de execução.' },
        { text: '`AttributeError`: `Num` não tem `esq`.', correct: true, why: 'O segundo `def visitar` **substitui** o primeiro na classe. Qualquer chamada cai na versão de `Soma`, que tenta ler `no.esq` num `Num`.' },
        { text: '`TypeError`, porque `Num(3)` não é um `Soma`, como diz a anotação.', why: 'Anotações não são verificadas em tempo de execução; só um type checker (mypy, pyright) reclamaria.' },
        { text: '`SyntaxError`: método definido duas vezes na mesma classe.', why: 'Redefinir é permitido: a última definição vence. Linters avisam (é a regra F811 do pyflakes/ruff), mas o interpretador aceita.' },
      ],
      explanation: 'Python faz **single dispatch**: o método é escolhido só pelo tipo do **receptor** (`Avaliador`), e o nome `visitar` aponta para uma única função — a última definida. Por isso o Visitor clássico usa **nomes distintos** (`visitar_num`, `visitar_soma`) e o `aceitar` no nó: o **double dispatch**. As alternativas pythônicas são despachar pelo nome do tipo (`getattr`, como o `ast.NodeVisitor`) ou usar `functools.singledispatchmethod`, que escolhe a implementação pelo tipo real do argumento.',
    },
    {
      type: 'match',
      id: 'dp-vis-q2',
      concept: 'Visitor',
      say: 'Agora, ligue cada trecho ao mecanismo que ele representa.',
      prompt: 'Associe cada **trecho de código** ao mecanismo correspondente.',
      pairs: [
        { left: '`def aceitar(self, v): return v.visitar_soma(self)`', right: 'Double dispatch clássico do GoF' },
        { left: '`getattr(self, "visit_" + type(no).__name__)`', right: 'Despacho pelo nome do tipo, como no `ast.NodeVisitor`' },
        { left: '`@avaliar.register`', right: 'Implementação por tipo numa função genérica, registrável de fora' },
        { left: '`case Mult(_, Num(0)):`', right: 'Casamento estrutural de padrões aninhados' },
        { left: '`self.generic_visit(node)`', right: 'Continua a descida pelos filhos do nó' },
      ],
      explanation: 'São quatro jeitos de responder "qual código roda para este tipo de nó?". O `aceitar` é o **double dispatch** do GoF, necessário em linguagens sem outro recurso. O `getattr` por nome dispensa o `aceitar` — é o que o `ast.NodeVisitor` faz, e o `generic_visit` é o que mantém a descida pela árvore. O `singledispatch` transforma cada operação numa função genérica aberta a tipos novos. E o `match` vai além do tipo: casa a **forma** da árvore, vários níveis de uma vez.',
    },
    {
      type: 'code',
      id: 'dp-vis-q3',
      concept: 'ast.NodeVisitor',
      title: 'Linter de imports não usados',
      say: 'Hora de codar! Vamos escrever uma regra de linter de verdade com `ast.NodeVisitor`.',
      prompt: `Implemente \`imports_nao_usados(codigo)\`, que recebe o **texto** de um programa Python e devolve, em ordem alfabética e sem repetição, os nomes criados por \`import\` que **nunca são lidos**. Complete o visitante \`ImportsNaoUsados\` e use-o.

- \`import os\` cria o nome \`os\`; \`import os.path\` também cria **\`os\`**; \`import xml.dom as dom\` cria \`dom\`.
- \`from collections import deque, OrderedDict as OD\` cria \`deque\` e \`OD\`. Ignore \`from x import *\`.
- Um nome é **lido** quando aparece como \`ast.Name\` com contexto \`ast.Load\`. Atribuir (\`os = 1\`) não conta, e \`sys.path\` lê \`sys\`, não \`path\`.
- Imports dentro de funções também contam.

\`\`\`python
imports_nao_usados("import os\\nimport sys\\nprint(sys.argv)")   # ['os']
\`\`\`

Dica: explore a árvore com \`print(ast.dump(ast.parse("from a import b as c"), indent=2))\`.`,
      starter: `import ast


class ImportsNaoUsados(ast.NodeVisitor):
    def __init__(self):
        self.importados = set()   # nomes criados por import
        self.lidos = set()        # nomes lidos em algum lugar do código

    # escreva aqui visit_Import, visit_ImportFrom e visit_Name


def imports_nao_usados(codigo):
    """Nomes importados que nunca são lidos, em ordem alfabética."""
    pass
`,
      tests: [
        { name: 'exemplo do enunciado', expr: `imports_nao_usados("import os\\nimport sys\\nprint(sys.argv)")`, expected: '["os"]' },
        { name: 'from … import com alias', expr: `imports_nao_usados("from collections import deque, OrderedDict as OD\\nfila = deque()")`, expected: '["OD"]' },
        { name: 'import pontilhado cria o primeiro nome', expr: `imports_nao_usados("import os.path\\nimport xml.dom as dom\\nos.path.join('a')")`, expected: '["dom"]' },
        { name: 'uso dentro de função', expr: `imports_nao_usados("import json\\ndef salvar(d):\\n    return json.dumps(d)")`, expected: '[]' },
        { name: 'código sem imports', expr: `imports_nao_usados("x = 1\\nprint(x)")`, expected: '[]' },
        { name: 'import dentro de função', hidden: true, expr: `imports_nao_usados("def f():\\n    import re\\n    return 1")`, expected: '["re"]' },
        { name: 'atribuir não é usar', hidden: true, expr: `imports_nao_usados("import os\\nos = 1")`, expected: '["os"]' },
        { name: 'ordem alfabética, sem repetição', hidden: true, expr: `imports_nao_usados("import b\\nimport a\\nimport b\\nfrom c import d")`, expected: '["a", "b", "d"]' },
        { name: 'import * é ignorado', hidden: true, expr: `imports_nao_usados("from os import *\\nimport sys")`, expected: '["sys"]' },
        { name: 'atributo não é leitura do nome', hidden: true, expr: `imports_nao_usados("from os import path\\nimport sys\\nsys.path.append('x')")`, expected: '["path"]' },
        { name: 'uso em anotação e em decorador', hidden: true, expr: `imports_nao_usados("from typing import Any\\nimport functools\\n@functools.cache\\ndef f(x: Any): ...")`, expected: '[]' },
        { name: 'uso bem fundo na árvore', hidden: true, expr: `imports_nao_usados("import math\\nclass C:\\n    def m(self):\\n        return [math.pi for _ in range(2)]")`, expected: '[]' },
      ],
      reviews: [
        {
          when: m => !m.classes.some(c => c.bases.includes('NodeVisitor')),
          text: 'Você resolveu sem herdar de `ast.NodeVisitor`. Funciona, mas o objetivo era o Visitor da stdlib: um `visit_<Tipo>` por nó que interessa, e a descida por todo o resto (funções, classes, compreensões) de graça, pelo `generic_visit`.',
          concept: 'ast.NodeVisitor',
        },
      ],
      hints: [
        '`visit_Import` recebe um `ast.Import`, cujo `node.names` é uma lista de `ast.alias` com `.name` e `.asname`. O nome criado é o `asname` ou, sem ele, a primeira parte do `name` (`"os.path".split(".")[0]`).',
        '`visit_ImportFrom` é parecido, mas o nome criado é `alias.asname or alias.name` (sem cortar no ponto) — e pule `alias.name == "*"`. Em `visit_Name`, registre só se `isinstance(node.ctx, ast.Load)`.',
        'Na função: crie o visitante, chame `visitante.visit(ast.parse(codigo))` e devolva `sorted(visitante.importados - visitante.lidos)`. O `NodeVisitor` desce sozinho pelos nós que você não sobrescreveu.',
      ],
      solution: `import ast


class ImportsNaoUsados(ast.NodeVisitor):
    def __init__(self):
        self.importados = set()   # nomes criados por import
        self.lidos = set()        # nomes lidos em algum lugar do código

    def visit_Import(self, node):
        for alias in node.names:
            self.importados.add(alias.asname or alias.name.split(".")[0])

    def visit_ImportFrom(self, node):
        for alias in node.names:
            if alias.name != "*":
                self.importados.add(alias.asname or alias.name)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self.lidos.add(node.id)


def imports_nao_usados(codigo):
    """Nomes importados que nunca são lidos, em ordem alfabética."""
    visitante = ImportsNaoUsados()
    visitante.visit(ast.parse(codigo))
    return sorted(visitante.importados - visitante.lidos)
`,
      solutionExplanation: 'Cada tipo de nó que importa ganhou seu `visit_<Tipo>`, e todo o resto — funções, classes, compreensões, decoradores, anotações — é percorrido pelo `generic_visit` herdado, sem uma linha de código de percurso. (`Import` e `Name` não têm filhos relevantes, por isso esses métodos nem precisam chamar `generic_visit`.) `visit_Import` e `visit_ImportFrom` registram os nomes **criados** — o `asname` tem prioridade, e `import os.path` cria `os` —, enquanto `visit_Name` registra só **leituras** (`ast.Load`): atribuir não é usar, e `sys.path` é um `ast.Attribute`, não uma leitura do nome `path`. A resposta é uma diferença de conjuntos, ordenada. É, em miniatura, a regra F401 do pyflakes/ruff (que ainda trata `__all__`, reexportações e escopos).',
    },
    {
      type: 'code',
      id: 'dp-vis-q4',
      concept: 'Árvore de expressões',
      title: 'Árvore de expressões: avaliar e mostrar',
      say: 'Agora, as duas operações clássicas de uma árvore de expressões. Escolha a arma: `match`, `singledispatch` ou visitante.',
      prompt: `Os nós já estão no editor, como dataclasses: \`Num(valor)\`, \`Var(nome)\`, \`Soma(esq, dir)\` e \`Mult(esq, dir)\`. Implemente duas **operações** fora das classes:

- \`avaliar(expr, ambiente)\` → o valor numérico; \`ambiente\` é um dict \`nome → valor\` para as variáveis.
- \`mostrar(expr)\` → o texto da expressão com o **mínimo de parênteses**: \`*\` tem precedência sobre \`+\`, então uma \`Soma\` só leva parênteses quando é operando de uma \`Mult\`. Use um espaço de cada lado dos operadores.
- Nas duas, um nó de tipo desconhecido lança \`TypeError\` — nada de devolver \`None\` em silêncio.

\`\`\`python
e = Mult(Soma(Num(1), Var("x")), Num(3))
avaliar(e, {"x": 4})                            # 15
mostrar(e)                                      # '(1 + x) * 3'
mostrar(Soma(Num(1), Mult(Var("x"), Num(3))))   # '1 + x * 3'
\`\`\``,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class Num:
    valor: int


@dataclass(frozen=True)
class Var:
    nome: str


@dataclass(frozen=True)
class Soma:
    esq: object
    dir: object


@dataclass(frozen=True)
class Mult:
    esq: object
    dir: object


def avaliar(expr, ambiente):
    pass


def mostrar(expr):
    pass
`,
      tests: [
        { name: 'avaliar o exemplo', expr: 'avaliar(Mult(Soma(Num(1), Var("x")), Num(3)), {"x": 4})', expected: '15' },
        { name: 'parênteses necessários', expr: 'mostrar(Mult(Soma(Num(1), Var("x")), Num(3)))', expected: '"(1 + x) * 3"' },
        { name: 'sem parênteses desnecessários', expr: 'mostrar(Soma(Num(1), Mult(Var("x"), Num(3))))', expected: '"1 + x * 3"' },
        {
          name: 'folhas',
          code: `assert mostrar(Num(7)) == "7" and mostrar(Var("y")) == "y", (mostrar(Num(7)), mostrar(Var("y")))
assert avaliar(Num(7), {}) == 7 and avaliar(Var("y"), {"y": -2}) == -2`,
        },
        { name: 'somas dos dois lados de uma multiplicação', expr: 'mostrar(Mult(Soma(Var("a"), Num(1)), Soma(Var("b"), Num(2))))', expected: '"(a + 1) * (b + 2)"' },
        {
          name: 'nó desconhecido lança TypeError',
          hidden: true,
          code: `from dataclasses import dataclass


@dataclass(frozen=True)
class Pot:
    base: object
    expoente: object


for operacao in (lambda: avaliar(Pot(Num(2), Num(3)), {}), lambda: mostrar(Pot(Num(2), Num(3)))):
    try:
        operacao()
    except TypeError:
        pass
    else:
        raise AssertionError("um nó desconhecido deveria lançar TypeError")`,
        },
        {
          name: 'aninhamento profundo',
          hidden: true,
          code: `e = Soma(Mult(Num(2), Mult(Var("x"), Soma(Num(1), Num(1)))), Soma(Num(3), Mult(Num(4), Num(5))))
assert mostrar(e) == "2 * x * (1 + 1) + 3 + 4 * 5", mostrar(e)
assert avaliar(e, {"x": 10}) == 63, avaliar(e, {"x": 10})`,
        },
        {
          name: 'somas e produtos encadeados',
          hidden: true,
          code: `assert mostrar(Soma(Soma(Num(1), Num(2)), Soma(Num(3), Num(4)))) == "1 + 2 + 3 + 4"
assert mostrar(Mult(Mult(Num(1), Num(2)), Num(3))) == "1 * 2 * 3"`,
        },
        { name: 'variável usada várias vezes', hidden: true, expr: 'avaliar(Mult(Var("x"), Soma(Var("x"), Var("y"))), {"x": 3, "y": -1})', expected: '6' },
      ],
      reviews: [
        {
          when: (m, code) => (code.match(/isinstance\(/g) || []).length >= 3,
          text: 'Você despachou com uma cadeia de `isinstance`. Funciona, mas o `if/elif` cresce a cada tipo e esconde o caso "desconhecido". Com `match` (padrões de classe) ou `@singledispatch`, cada caso fica explícito — e o `case _:`/implementação padrão é o lugar óbvio para falhar alto.',
          concept: 'Visitor',
        },
        {
          when: m => m.classes.some(c => ['Num', 'Var', 'Soma', 'Mult'].includes(c.name) && c.methods.some(n => !['aceitar', 'accept', '__post_init__'].includes(n))),
          text: 'Você colocou operações **dentro** das classes dos nós. É o design OO clássico — ótimo para criar tipos novos, ruim para criar operações novas (o *expression problem*). Mantendo as operações de fora, amanhã `derivar` é só mais uma função, sem abrir nenhuma classe.',
          concept: 'Expression problem',
        },
        {
          when: (m, code) => /type\([^)]*\)\s*(==|is\s)/.test(code) || /__name__\s*==/.test(code),
          text: 'Comparar `type(x) == Soma` (ou o nome da classe) ignora herança: uma subclasse de `Soma` deixaria de funcionar. Padrões de classe no `match`, `isinstance` e `singledispatch` respeitam a herança.',
          concept: 'Double dispatch',
        },
      ],
      hints: [
        'Com `match`, cada caso é um padrão de classe: `case Soma(a, b): return avaliar(a, ambiente) + avaliar(b, ambiente)`. Termine com `case _: raise TypeError(...)`.',
        'Em `mostrar`, a única decisão de parênteses acontece na `Mult`: cada operando que for uma `Soma` vai entre parênteses. Uma função auxiliar `_fator(expr)` deixa isso limpo.',
        'Folhas: `Num` vira `str(valor)` e `Var` vira o nome. `Soma(a, b)` vira `f"{mostrar(a)} + {mostrar(b)}"` — sem parênteses, porque nada tem precedência menor que `+`.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class Num:
    valor: int


@dataclass(frozen=True)
class Var:
    nome: str


@dataclass(frozen=True)
class Soma:
    esq: object
    dir: object


@dataclass(frozen=True)
class Mult:
    esq: object
    dir: object


def avaliar(expr, ambiente):
    match expr:
        case Num(valor):
            return valor
        case Var(nome):
            return ambiente[nome]
        case Soma(a, b):
            return avaliar(a, ambiente) + avaliar(b, ambiente)
        case Mult(a, b):
            return avaliar(a, ambiente) * avaliar(b, ambiente)
        case _:
            raise TypeError(f"nó desconhecido: {type(expr).__name__}")


def mostrar(expr):
    match expr:
        case Num(valor):
            return str(valor)
        case Var(nome):
            return nome
        case Soma(a, b):
            return f"{mostrar(a)} + {mostrar(b)}"
        case Mult(a, b):
            return f"{_fator(a)} * {_fator(b)}"
        case _:
            raise TypeError(f"nó desconhecido: {type(expr).__name__}")


def _fator(expr):
    """Operando de uma multiplicação: uma soma precisa de parênteses."""
    match expr:
        case Soma():
            return f"({mostrar(expr)})"
        case _:
            return mostrar(expr)
`,
      solutionExplanation: 'Cada operação é uma função com um `match` — o "visitante" pythônico para um conjunto **fechado** de nós. Os padrões de classe (`Soma(a, b)`) desempacotam os campos graças ao `__match_args__` que o `@dataclass` gera, e o `case _:` garante que um nó novo **falhe alto** em vez de devolver `None`. A regra de precedência mora num lugar só (`_fator`): apenas uma `Soma` dentro de uma `Mult` precisa de parênteses. Repare no expression problem na prática: acrescentar `derivar` seria uma função nova, sem tocar em nada; acrescentar `Pot` exigiria um caso novo em **cada** função — e o teste do nó desconhecido mostra por que o `case _` importa.',
    },
    {
      type: 'open',
      id: 'dp-vis-q5',
      concept: 'Expression problem',
      say: 'Para fechar, a pergunta que separa quem decorou o padrão de quem entendeu.',
      prompt: 'Sua biblioteca de expressões tem 6 tipos de nó e 4 operações, todas escritas como funções com `match` (um "visitante" por operação). O time pede duas coisas: um nó novo, `Pot`, e uma operação nova, `derivar`. Qual das duas é mais fácil nesse design, e por quê? O que mudaria se as operações fossem métodos das classes? E que recursos do Python ajudam a não esquecer nenhum caso?',
      minWords: 35,
      rubric: [
        { label: 'A **operação nova** é fácil: uma função (ou visitante) nova, sem tocar no que existe', keywords: ['nova operacao e facil', 'operacao nova e facil', 'derivar e facil', 'derivar e mais facil', 'uma funcao nova', 'nova funcao', 'funcao nova', 'novo visitante', 'visitante novo', 'sem mexer', 'sem tocar', 'nao mexe', 'nao toca', 'nao precisa mexer', 'nao altera'], concept: 'Visitor', why: 'No design por operações, cada operação é independente: `derivar` é só mais uma função com o seu `match`.' },
        { label: 'O **tipo novo** é difícil: um caso novo em **cada** operação (e o esquecido falha em runtime)', keywords: ['todas as funcoes', 'todas as operacoes', 'cada funcao', 'cada operacao', 'todos os match', 'cada match', 'todos os visitantes', 'cada visitante', 'mexer em todas', 'alterar todas', 'quatro funcoes', '4 funcoes', 'caso novo', 'novo caso', 'novo case', 'esquec'], concept: 'Expression problem', why: 'Com 4 operações, `Pot` exige 4 casos novos espalhados — e o que for esquecido só aparece quando o código rodar.' },
        { label: 'Com métodos nas classes, o trade-off **se inverte** (expression problem)', keywords: ['invert', 'inverso', 'ao contrario', 'oposto', 'contrario', 'expression problem', 'problema da expressao', 'dois eixos', 'trade-off', 'tradeoff', 'orientad', 'polimorf'], concept: 'Expression problem', why: 'Com métodos, `Pot` é uma classe nova e autocontida, mas `derivar` exige abrir as 6 classes — é o expression problem de Wadler.' },
        { label: 'Recursos para não esquecer casos: `case _: raise`, `assert_never` com type checker, `singledispatch`', keywords: ['assert_never', 'case _', 'typeerror', 'raise', 'falhar alto', 'falha alto', 'exaust', 'mypy', 'pyright', 'type checker', 'checagem estatica', 'singledispatch', 'register', 'uniao', 'union'], concept: 'singledispatch', why: 'Um `case _` que lança exceção evita o `None` silencioso; `assert_never` com uma união de tipos faz o type checker apontar o caso esquecido; `singledispatch` permite registrar `Pot` de fora.' },
      ],
      modelAnswer: `Nesse design, a **operação nova** é a fácil: \`derivar\` é só **uma função nova** com o seu próprio \`match\`, sem tocar em nada do que existe. Já o **tipo novo** é o difícil: \`Pot\` exige um **caso novo em cada uma das quatro funções** — e a que for esquecida só falha em tempo de execução.

Se as operações fossem métodos das classes, o trade-off **se inverteria**: \`Pot\` seria uma classe nova e autocontida, mas \`derivar\` obrigaria a abrir as seis classes. Esse é o **expression problem** (Wadler): nenhum dos dois designs é bom nos dois eixos, então escolho pelo eixo que mais muda. Numa biblioteca de expressões, a gramática é estável e as operações crescem — funções com \`match\` (ou visitantes) fazem sentido.

Para não esquecer casos: todo \`match\` termina com \`case _: raise TypeError(...)\`, para falhar alto; com type checker, anoto o nó como uma **união** (\`Num | Soma | ... | Pot\`) e uso \`assert_never\` no \`case _\`, e o mypy/pyright aponta o caso faltante antes de rodar. Se os nós novos vierem de plugins, \`singledispatch\` permite registrar \`Pot\` de fora.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Arrasou! Visitor = **operações fora das classes**, escolhidas pelo tipo de cada nó — com `aceitar`, por nome, por `singledispatch` ou por `match`.',
        'E agora você sabe o nome do dilema por trás de tudo isso: o **expression problem**. Fechamos os comportamentais — a seguir, os padrões pythônicos, começando pelo Null Object!',
      ],
      board: null,
    },
  ],
});
