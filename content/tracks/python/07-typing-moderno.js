(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'typing-moderno',
    title: 'Typing moderno',
    kind: 'lesson',
    level: 3,
    order: 20,
    unit: 'tipos',
    summary: 'Tipagem gradual na prática: `Protocol` × ABC, genéricos com a PEP 695, variância, `ParamSpec`, `TypedDict`, `Literal`, `@overload`, `Self`, `Final` e `NewType` — e o que dá para conferir em tempo de execução.',
    concepts: ['Tipagem gradual', 'Protocol × ABC', 'Genéricos (PEP 695)', 'Variância', 'Validação em runtime'],
    takeaways: [
      'Anotações **não são checadas** em runtime: quem confere é o type checker. `Any` desliga a checagem; `object` aceita tudo, mas exige estreitar o tipo antes de usar.',
      '`Protocol` é **estrutural** (basta ter os métodos); ABC é **nominal** (exige herança) e pode trazer implementação compartilhada.',
      'Genéricos com a PEP 695: `class Pilha[T]`, `def f[T](...)` e `type Par[T] = ...`. O parâmetro de tipo some em runtime (*type erasure*).',
      '**Variância**: contêiner mutável é invariante (`list`), só leitura é covariante (`Sequence`) e parâmetros de função são contravariantes.',
      'Para validar em runtime, leia as anotações com `get_type_hints`, `get_origin` e `get_args` — é o que pydantic e afins fazem na fronteira do sistema.',
    ],
    glossary: [
      { term: 'Tipagem gradual', aliases: ['gradual typing'], definition: 'Sistema em que anotar tipos é opcional e código tipado convive com código sem tipos. O tipo `Any` é *consistente* com todos os outros e marca onde a checagem fica desligada.' },
      { term: 'Subtipagem estrutural', aliases: ['structural subtyping', 'tipagem estrutural'], definition: 'Compatibilidade decidida pela **forma** (quais métodos e atributos o objeto tem), não pela herança declarada. Em Python, é o que `typing.Protocol` descreve: o *duck typing* verificado pelo checker.' },
      { term: 'Variância', aliases: ['variance', 'covariância', 'contravariância', 'covariante', 'contravariante'], definition: 'Como a relação "`B` é subtipo de `A`" se propaga para `C[B]` e `C[A]`: **covariante** (mesmo sentido, ex.: `Sequence`), **contravariante** (sentido inverso, ex.: parâmetros de `Callable`) ou **invariante** (nenhum, ex.: `list`).' },
      { term: 'Type erasure', aliases: ['apagamento de tipos'], definition: 'Os parâmetros de tipo só existem para o checker: em runtime, `Pilha[int]()` é uma `Pilha` comum e nada impede um `str` lá dentro. `isinstance(x, list[int])` nem é permitido.' },
      { term: 'TypedDict', aliases: ['TypedDicts'], definition: 'Descreve o formato de um `dict` com chaves fixas e o tipo de cada valor (`NotRequired` marca as opcionais). Em runtime é um `dict` comum: ótimo para tipar JSON sem criar classes.' },
      { term: 'ParamSpec', aliases: ['ParamSpecs'], definition: 'Variável de tipo que captura a **assinatura inteira** de uma função (`**P` na sintaxe 3.12). Permite escrever decorators que preservam parâmetros e tipos da função decorada.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à unidade de **tipos**! Primeiro, o combinado: anotações de tipo **não são checadas** quando o código roda.',
          'Quem confere é uma ferramenta à parte — mypy, pyright — antes de rodar. E você decide o quanto anotar: isso é **tipagem gradual**.',
        ],
        board: {
          title: 'Tipagem gradual: anotações são metadados',
          md: `\`\`\`python
def dobro(x: int) -> int:
    return x * 2

dobro("ab")              # 'abab' — o Python NÃO checa nada em runtime
dobro.__annotations__    # {'x': <class 'int'>, 'return': <class 'int'>}

from typing import Any

def a(x: Any) -> None:
    x.voar()             # ok para o checker: Any desliga a checagem

def b(x: object) -> None:
    x.voar()             # ERRO no checker: object não tem .voar()
    if isinstance(x, str):
        x.upper()        # ok: o isinstance estreitou o tipo (narrowing)
\`\`\`

| | \`Any\` | \`object\` |
|---|---|---|
| Aceita qualquer valor? | sim | sim |
| Deixa usar qualquer atributo? | **sim** (desliga a checagem) | **não** (precisa estreitar antes) |
| Quando usar | migração, código dinâmico de verdade | "aceito qualquer coisa e não mexo nela" |

> [!sabia] A tipagem gradual (Siek & Taha, 2006) não se apoia só em subtipos: usa a relação de **consistência**. \`Any\` é *consistente* com todo tipo, nos dois sentidos — por isso ele "desliga" o checker —, enquanto \`object\`, o topo da hierarquia, obriga você a estreitar o tipo antes de usar.

> [!atencao] Para ler anotações em runtime, prefira \`typing.get_type_hints()\` a \`__annotations__\`: ele resolve anotações em string (\`from __future__ import annotations\`) e junta as das classes-base. No Python 3.14, as anotações passam a ser avaliadas sob demanda (PEP 649).`,
        },
      },
      {
        type: 'say',
        text: [
          'Duas formas de dizer "este parâmetro precisa saber fazer X": uma ABC ou um `Protocol`.',
          'A ABC exige **herança**. O `Protocol` só exige que o objeto tenha os métodos — é o *duck typing* com aval do type checker.',
        ],
        board: {
          title: 'Protocol × ABC',
          md: `\`\`\`python
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

class Repositorio(ABC):                   # NOMINAL: precisa herdar
    @abstractmethod
    def salvar(self, item) -> None: ...

    def salvar_varios(self, itens) -> None:   # ABC pode trazer implementação
        for item in itens:
            self.salvar(item)

@runtime_checkable
class Fechavel(Protocol):                 # ESTRUTURAL: basta ter .fechar()
    def fechar(self) -> None: ...

class Arquivo:                            # não herda de nada
    def fechar(self) -> None:
        print("fechado")

def encerrar(recurso: Fechavel) -> None:  # o checker aceita Arquivo()
    recurso.fechar()

isinstance(Arquivo(), Fechavel)           # True — graças ao @runtime_checkable
Repositorio()                             # TypeError: classe abstrata
\`\`\`

| | ABC | \`Protocol\` |
|---|---|---|
| Subtipagem | nominal (herança explícita) | estrutural (basta ter os membros) |
| Classes de terceiros | precisam herdar ou \`Repositorio.register(X)\` | encaixam sem mudar nada |
| Em runtime | \`isinstance\` e bloqueio na instanciação | \`isinstance\` só com \`@runtime_checkable\` |
| Implementação compartilhada | sim | possível, mas só para quem herda |

> [!atencao] O \`isinstance\` de um protocolo \`@runtime_checkable\` só confere se os **nomes** existem — não a assinatura nem os tipos. Uma classe com \`fechar = 42\` passa no teste.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora, genéricos: como dizer "uma pilha **de alguma coisa**" sem perder qual coisa.',
          'Desde o Python 3.12 existe uma sintaxe enxuta para isso — a PEP 695.',
        ],
        board: {
          title: 'Genéricos: TypeVar e a PEP 695',
          md: `\`\`\`python
# Antes (3.5+): TypeVar declarado à parte
from typing import Generic, TypeVar
T = TypeVar("T")

class PilhaAntiga(Generic[T]):
    def empilhar(self, item: T) -> None: ...

# PEP 695 (3.12+): o parâmetro de tipo nasce na própria definição
class Pilha[T]:
    def __init__(self) -> None:
        self._itens: list[T] = []

    def empilhar(self, item: T) -> None:
        self._itens.append(item)

    def desempilhar(self) -> T:
        return self._itens.pop()

def primeiro[T](itens: list[T]) -> T:          # função genérica
    return itens[0]

def maior[N: (int, float)](a: N, b: N) -> N:   # restrição: N é int OU float
    return a if a > b else b

type Par[T] = tuple[T, T]                      # alias genérico (instrução type)

p = Pilha[int]()
p.empilhar("oi")      # o checker reclama; o Python, não (type erasure)
\`\`\`

- \`[T: Base]\` é um **limite** (*bound*): qualquer subtipo de \`Base\`. \`[T: (int, float)]\` é uma **restrição**: exatamente um dos tipos listados.
- Em runtime, \`Pilha.__type_params__\` guarda o \`T\`, mas \`Pilha[int]()\` não checa nada — e \`isinstance(x, list[int])\` dá \`TypeError\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Pergunta de entrevista sênior: se `Cachorro` é um `Animal`, uma `list[Cachorro]` é uma `list[Animal]`?',
          { text: 'Não! E entender o porquê é entender **variância**, um conceito que pouca gente sabe explicar.', mood: 'surprised' },
        ],
        board: {
          title: 'Variância: covariante, contravariante, invariante',
          md: `\`\`\`python
class Animal: ...
class Cachorro(Animal): ...
class Gato(Animal): ...

def adotar(abrigo: list[Animal]) -> None:
    abrigo.append(Gato())            # válido para uma list[Animal]...

caes: list[Cachorro] = [Cachorro()]
adotar(caes)                         # ERRO no checker: senão um Gato entraria em caes

from collections.abc import Sequence

def listar(bichos: Sequence[Animal]) -> None: ...
listar(caes)                         # OK: Sequence é só leitura -> covariante
\`\`\`

| Variância | Regra | Exemplos |
|---|---|---|
| **Covariante** | \`C[Cachorro]\` é um \`C[Animal]\` | \`Sequence\`, \`tuple\`, \`frozenset\`, retorno de \`Callable\` |
| **Contravariante** | \`C[Animal]\` é um \`C[Cachorro]\` | **parâmetros** de \`Callable\` |
| **Invariante** | nenhum dos dois | \`list\`, \`dict\`, \`set\` (mutáveis) |

Regra de bolso: quem só **produz** \`T\` (saída) pode ser covariante; quem só **consome** \`T\` (entrada) pode ser contravariante; quem faz os dois é invariante. Uma função que cuida de **qualquer** \`Animal\` serve onde se pede \`Callable[[Cachorro], None]\`.

Na PEP 695, o checker **infere** a variância de \`class Caixa[T]\` pelo uso de \`T\`; no estilo antigo, você declara: \`TypeVar("T_co", covariant=True)\`.

> [!sabia] Arrays em Java são covariantes: \`Object[] a = new String[1]; a[0] = 1;\` compila e só explode em runtime, com \`ArrayStoreException\`. É exatamente o buraco que a invariância de \`list\` fecha no Python tipado.`,
        },
      },
      {
        type: 'say',
        text: [
          'Decorators são um pesadelo para os tipos: o que a função decorada aceita?',
          'O `ParamSpec` captura a assinatura inteira — parâmetros **e** tipos — e a repassa adiante.',
        ],
        board: {
          title: 'ParamSpec: decorators que preservam a assinatura',
          md: `\`\`\`python
from collections.abc import Callable
from functools import wraps

# Sem ParamSpec: a assinatura vira "qualquer coisa"
def logado_ruim(func: Callable[..., object]) -> Callable[..., object]: ...

# Com ParamSpec (sintaxe 3.12: **P)
def logado[**P, R](func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def interno(*args: P.args, **kwargs: P.kwargs) -> R:
        print("chamando", func.__name__)
        return func(*args, **kwargs)
    return interno

@logado
def somar(a: int, b: int) -> int:
    return a + b

somar(1, 2)        # OK
somar("1", 2)      # ERRO no checker: a assinatura (a: int, b: int) sobreviveu
\`\`\`

- \`P.args\` e \`P.kwargs\` só aparecem juntos, anotando \`*args\` e \`**kwargs\`.
- \`Concatenate[Conexao, P]\` descreve um decorator que **injeta** um primeiro argumento (ex.: uma conexão de banco) e o esconde de quem chama.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora a caixa de ferramentas do dia a dia. Todas são instruções para o checker.',
          'Repare na última coluna da tabela: é o que sobra quando o código **roda**.',
        ],
        board: {
          title: 'TypedDict, Literal, Final, NewType, Self e overload',
          md: `\`\`\`python
from typing import Final, Literal, NewType, NotRequired, Self, TypedDict, overload

class Usuario(TypedDict):          # formato de um dict (ex.: JSON)
    id: int
    nome: str
    apelido: NotRequired[str]      # pode faltar

Modo = Literal["r", "w"]           # só esses valores exatos
MAX_TENTATIVAS: Final = 3          # o checker proíbe reatribuir
UserId = NewType("UserId", int)    # um int "com crachá": não se mistura com int comum

class Consulta:
    def filtrar(self, **criterios) -> Self:   # a subclasse encadeia com o PRÓPRIO tipo
        ...
        return self

@overload
def ler(chave: str, como: Literal["int"]) -> int: ...
@overload
def ler(chave: str, como: Literal["str"]) -> str: ...
def ler(chave, como):              # a implementação real, sem @overload
    ...
\`\`\`

| Ferramenta | Para o checker | Em runtime |
|---|---|---|
| \`TypedDict\` | chaves e tipos de um dict | \`dict\` comum (\`isinstance\` nem é permitido) |
| \`Literal\` | valores exatos permitidos | só um marcador |
| \`Final\` | proíbe reatribuir | nada impede |
| \`NewType\` | tipo distinto: \`UserId\` ≠ \`int\` | função identidade: \`UserId(5)\` é o \`int\` 5 |
| \`Self\` | retorno acompanha a subclasse | nada |
| \`@overload\` | assinaturas alternativas | só a última definição existe (\`typing.get_overloads\` lista as outras) |`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Se o Python não checa nada, como bibliotecas como o pydantic validam JSON pelas anotações?',
          'Elas **leem** as anotações em runtime e comparam com os valores. Você vai construir uma versão mini disso.',
        ],
        board: {
          title: 'Anotações em runtime: get_origin, get_args, get_type_hints',
          md: `\`\`\`python
from typing import Literal, Optional, TypedDict, get_args, get_origin, get_type_hints

get_origin(list[int])             # <class 'list'>
get_args(dict[str, int])          # (<class 'str'>, <class 'int'>)
get_origin(Literal["r", "w"])     # typing.Literal
get_args(Optional[int])           # (<class 'int'>, <class 'NoneType'>)
get_origin(int | None)            # types.UnionType no 3.12 (typing.Union no 3.14)

class Ponto(TypedDict):
    x: int
    y: int

get_type_hints(Ponto)             # {'x': <class 'int'>, 'y': <class 'int'>}
Ponto.__required_keys__           # frozenset({'x', 'y'})
\`\`\`

- Em runtime, uma anotação é **dado**: \`get_origin\` diz "que construção é essa" e \`get_args\` devolve as peças.
- Validar em runtime é o que fazem pydantic, typeguard e beartype — útil na **fronteira** do sistema (JSON, configuração, APIs), onde o checker não enxerga.

> [!dica] O \`get_type_hints\` remove \`NotRequired\`/\`Required\` das anotações; para mantê-los, use \`include_extras=True\`. As chaves obrigatórias ficam em \`__required_keys__\`.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Variância, ferramentas do `typing` e validação em runtime.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-typ-q1',
        concept: 'Variância',
        say: 'Primeira: o type checker vai rejeitar uma destas chamadas. Qual?',
        prompt: `Com as definições abaixo, qual chamada um type checker (mypy/pyright) **rejeita**?

\`\`\`python
from collections.abc import Callable, Sequence

class Animal: ...
class Cachorro(Animal): ...

def listar(bichos: Sequence[Animal]) -> None: ...
def cadastrar(bichos: list[Animal]) -> None: ...
def tratar(cuidar: Callable[[Cachorro], None]) -> None: ...
def cuidar_de_animal(a: Animal) -> None: ...

caes: list[Cachorro] = [Cachorro()]
\`\`\``,
        options: [
          { text: '`cadastrar(caes)`', correct: true, why: '`list` é **invariante**: `cadastrar` poderia fazer `bichos.append(Gato())`, e um gato entraria na lista de cachorros. O checker barra.' },
          { text: '`listar(caes)`', why: '`Sequence` é só leitura, portanto **covariante**: uma sequência de cachorros é uma sequência de animais.' },
          { text: '`tratar(cuidar_de_animal)`', why: 'Parâmetros de `Callable` são **contravariantes**: uma função que cuida de qualquer `Animal` certamente cuida de um `Cachorro`.' },
          { text: '`listar((Cachorro(), Cachorro()))`', why: 'Uma tupla é uma `Sequence` — imutável e covariante. Nenhum problema.' },
        ],
        explanation: 'Variância responde: "se `Cachorro` é subtipo de `Animal`, o que acontece com `C[Cachorro]` e `C[Animal]`?". Contêineres mutáveis são invariantes (leem **e** escrevem), contêineres só de leitura são covariantes e parâmetros de função são contravariantes. É o mesmo raciocínio do Princípio de Substituição de Liskov: aceite entradas mais amplas, devolva saídas mais específicas.',
      },
      {
        type: 'match',
        id: 'py-typ-q2',
        concept: 'Ferramentas do typing',
        say: 'Associe cada ferramenta do `typing` ao que ela faz.',
        prompt: 'Associe cada construção do módulo `typing` ao seu propósito.',
        pairs: [
          { left: '`Protocol`', right: 'Subtipagem estrutural: basta ter os métodos' },
          { left: '`TypedDict`', right: 'Formato de um dict com chaves fixas; em runtime, dict comum' },
          { left: '`NewType`', right: 'Tipo distinto para o checker, custo zero em runtime' },
          { left: '`Literal`', right: 'Restringe a valores exatos, como `"r"` ou `"w"`' },
          { left: '`ParamSpec`', right: 'Preserva a assinatura da função num decorator' },
          { left: '`Self`', right: 'Retorno que acompanha a subclasse em métodos encadeáveis' },
        ],
        explanation: 'Nenhuma dessas construções muda o comportamento do programa: elas dão ao checker informação para pegar erros **antes** de rodar. Em runtime sobra só o que você ler explicitamente com `get_type_hints`, `get_origin` e companhia.',
      },
      {
        type: 'code',
        id: 'py-typ-q3',
        concept: 'Validação em runtime',
        title: 'Validador de anotações + coleção genérica',
        points: 50,
        say: 'Hora de construir seu mini-pydantic: um verificador que lê anotações em runtime, e uma coleção genérica que o usa.',
        prompt: `Implemente um **verificador de anotações em tempo de execução** e uma **coleção genérica** que o usa.

**\`confere(valor, tipo) -> bool\`** deve entender:
- \`Any\` (aceita tudo) e \`None\` (só \`None\`);
- classes comuns via \`isinstance\`, com a regra da PEP 484: onde se pede \`float\`, um \`int\` também serve;
- \`Literal[...]\`: o valor precisa ser um dos literais **e ter o mesmo tipo** (cuidado: \`True == 1\`!);
- uniões: \`X | Y\`, \`Optional[X]\` e \`Union[X, Y]\`;
- \`list[X]\` e \`dict[K, V]\`, conferindo cada elemento (inclusive aninhados);
- aliases da PEP 695 (\`type Nota = int | float\`): confira contra \`alias.__value__\`;
- **\`TypedDict\`**: precisa ser \`dict\`, ter todas as chaves obrigatórias (\`__required_keys__\`), nenhuma chave desconhecida e cada valor conferindo com a anotação (\`typing.get_type_hints\`).

**\`Colecao\`**: genérica em \`T\` (\`class Colecao[T]:\`). Recebe no construtor o tipo esperado; \`adicionar(item)\` lança \`TypeError\` se \`confere\` falhar. Suporta \`len()\` e iteração.`,
        starter: py(`
          import types
          from collections.abc import Iterator
          from typing import (Any, Literal, TypeAliasType, Union, get_args, get_origin,
                              get_type_hints, is_typeddict)


          def confere(valor, tipo) -> bool:
              """Diz se \`valor\` é compatível com a anotação \`tipo\`, em tempo de execução."""
              # TODO: Any, None, aliases (type X = ...), TypedDict, Literal, uniões,
              #       list[X], dict[K, V], float aceitando int e classes comuns
              return isinstance(valor, tipo)


          class Colecao:  # TODO: torne-a genérica em T
              def __init__(self, tipo):
                  self.tipo = tipo
                  self._itens = []

              def adicionar(self, item):
                  pass  # TODO: TypeError se o item não conferir com self.tipo

              def __len__(self):
                  return len(self._itens)

              def __iter__(self):
                  return iter(self._itens)
        `),
        tests: [
          {
            name: 'classes comuns, Any e None',
            code: py(`
              from typing import Any
              assert confere(3, int) and confere("a", str)
              assert not confere("3", int)
              assert confere(None, None) and not confere(0, None)
              assert confere(object(), Any) and confere(None, Any)
            `),
          },
          {
            name: 'float aceita int (PEP 484), mas não str',
            code: py(`
              assert confere(1, float) and confere(1.5, float)
              assert not confere("1.5", float)
              assert not confere(1.5, int), "float não serve onde se pede int"
            `),
          },
          {
            name: 'Literal compara valor e tipo',
            code: py(`
              from typing import Literal
              Modo = Literal["r", "w"]
              assert confere("r", Modo) and not confere("x", Modo)
              assert confere(1, Literal[1, 2])
              assert not confere(True, Literal[1]), "True == 1, mas True não é o literal 1"
            `),
          },
          {
            name: 'uniões: X | Y, Optional e Union',
            code: py(`
              from typing import Literal, Optional, Union
              assert confere(None, int | None) and confere(3, int | None)
              assert not confere("3", int | None)
              assert confere(None, Optional[str]) and confere("a", Union[int, str])
              assert not confere(2.5, Union[int, str])
              assert confere([1], list[int] | None) and not confere(["x"], list[int] | None)
              assert confere("r", Literal["r"] | None) and not confere("x", Literal["r"] | None)
            `),
          },
          {
            name: 'list e dict conferem cada elemento',
            code: py(`
              assert confere([1, 2, 3], list[int]) and confere([], list[int])
              assert not confere([1, "2"], list[int])
              assert not confere((1, 2), list[int]), "tupla não é list"
              assert confere({"a": 1}, dict[str, int])
              assert not confere({"a": "1"}, dict[str, int])
              assert not confere({1: 1}, dict[str, int])
              assert confere([[1], [2, 3]], list[list[int]])
            `),
          },
          {
            name: 'TypedDict: obrigatórias, opcionais e desconhecidas',
            code: py(`
              from typing import NotRequired, TypedDict

              class Usuario(TypedDict):
                  id: int
                  nome: str
                  apelido: NotRequired[str]

              assert confere({"id": 1, "nome": "Lia"}, Usuario)
              assert confere({"id": 1, "nome": "Lia", "apelido": "li"}, Usuario)
              assert not confere({"id": 1}, Usuario), "faltou a chave obrigatória 'nome'"
              assert not confere({"id": "1", "nome": "Lia"}, Usuario), "id deveria ser int"
              assert not confere({"id": 1, "nome": "Lia", "admin": True}, Usuario), "chave desconhecida"
              assert not confere([("id", 1)], Usuario), "TypedDict precisa ser um dict"
            `),
          },
          {
            name: 'Colecao é genérica e valida ao adicionar',
            code: py(`
              from typing import TypedDict

              class Ponto(TypedDict):
                  x: int
                  y: int

              assert len(getattr(Colecao, "__parameters__", ())) == 1, "declare a classe como genérica: class Colecao[T]:"
              c = Colecao[Ponto](Ponto)          # o [Ponto] é só para o checker
              c.adicionar({"x": 1, "y": 2})
              try:
                  c.adicionar({"x": 1})
              except TypeError:
                  pass
              else:
                  raise AssertionError("adicionar um Ponto sem 'y' deveria lançar TypeError")
              assert len(c) == 1 and list(c) == [{"x": 1, "y": 2}]
            `),
          },
          {
            name: 'TypedDict aninhado dentro de list',
            hidden: true,
            code: py(`
              from typing import Literal, TypedDict

              class Item(TypedDict):
                  sku: str
                  qtd: int

              class Pedido(TypedDict):
                  id: int
                  status: Literal["aberto", "pago"]
                  itens: list[Item]

              ok = {"id": 1, "status": "pago", "itens": [{"sku": "A1", "qtd": 2}]}
              assert confere(ok, Pedido)
              assert confere({**ok, "itens": []}, Pedido)
              assert not confere({**ok, "status": "cancelado"}, Pedido)
              assert not confere({**ok, "itens": [{"sku": "A1", "qtd": "2"}]}, Pedido)
            `),
          },
          {
            name: 'TypedDict com total=False e Required',
            hidden: true,
            code: py(`
              from typing import Required, TypedDict

              class Filtro(TypedDict, total=False):
                  termo: Required[str]
                  pagina: int

              assert confere({"termo": "py"}, Filtro)
              assert confere({"termo": "py", "pagina": 2}, Filtro)
              assert not confere({"pagina": 2}, Filtro), "'termo' é Required"
              assert not confere({"termo": "py", "pagina": "2"}, Filtro)
            `),
          },
          {
            name: 'aliases da PEP 695 (type X = ...)',
            hidden: true,
            code: py(`
              type Nota = int | float
              type Notas = list[Nota]
              assert confere(7, Nota) and confere(8.5, Nota)
              assert confere([7, 8.5], Notas)
              assert not confere([7, "10"], Notas)
            `),
          },
          {
            name: 'Colecao com uma união',
            hidden: true,
            code: py(`
              c = Colecao(int | None)
              c.adicionar(None)
              c.adicionar(3)
              try:
                  c.adicionar("3")
              except TypeError:
                  pass
              else:
                  raise AssertionError("'3' não é int | None")
              assert list(c) == [None, 3] and len(c) == 2
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /__annotations__/.test(code),
            text: 'Ler `__annotations__` direto é frágil: com `from __future__ import annotations` vêm strings, as anotações das bases ficam de fora e, no Python 3.14, elas passam a ser avaliadas sob demanda. `typing.get_type_hints()` resolve tudo isso.',
            concept: 'get_type_hints',
          },
          {
            when: (m, code) => /\bstr\s*\(\s*tipo\s*\)|\brepr\s*\(\s*tipo\s*\)|__name__\s*==\s*["']/.test(code),
            text: 'Comparar o **texto** da anotação (`str(tipo)`, `__name__ == "list"`) quebra com aliases e muda entre versões do Python. `get_origin`/`get_args` dão a estrutura de verdade.',
            concept: 'Introspecção de tipos',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Engolir exceções para devolver `False` esconde bugs do próprio verificador: uma anotação que você não tratou vira "não confere" em silêncio. Deixe o erro aparecer.',
            concept: 'Tratamento de erros',
          },
        ],
        hints: [
          'Trate primeiro os casos especiais: `tipo is Any`, `tipo is None or tipo is type(None)`, `isinstance(tipo, TypeAliasType)` (recursão com `tipo.__value__`) e `is_typeddict(tipo)`. Depois, `get_origin(tipo)` e `get_args(tipo)` desmontam `list[int]` em `list` e `(int,)`.',
          'Uniões aparecem com duas origens: `typing.Union` (para `Optional`/`Union`) e `types.UnionType` (para `X | Y`) — teste as duas. Em `Literal`, compare `type(valor) is type(lit) and valor == lit`. Em `list`/`dict`, chame `confere` recursivamente em cada elemento.',
          'No `TypedDict`: `get_type_hints(td)` devolve as anotações já sem o `NotRequired[...]`; `td.__required_keys__ <= valor.keys()` checa as obrigatórias e `valor.keys() <= dicas.keys()` barra as desconhecidas. A `Colecao` vira genérica só com `class Colecao[T]:`.',
        ],
        solution: py(`
          import types
          from collections.abc import Iterator
          from typing import (Any, Literal, TypeAliasType, Union, get_args, get_origin,
                              get_type_hints, is_typeddict)


          def confere(valor, tipo) -> bool:
              """Diz se \`valor\` é compatível com a anotação \`tipo\`, em tempo de execução."""
              if tipo is Any:
                  return True
              if tipo is None or tipo is type(None):
                  return valor is None
              if isinstance(tipo, TypeAliasType):                 # type Nota = int | float
                  return confere(valor, tipo.__value__)
              if is_typeddict(tipo):
                  return _confere_typeddict(valor, tipo)

              origem, args = get_origin(tipo), get_args(tipo)
              if origem is Literal:
                  return any(type(valor) is type(lit) and valor == lit for lit in args)
              if origem is Union or origem is types.UnionType:    # Optional[X], Union[X, Y], X | Y
                  return any(confere(valor, a) for a in args)
              if origem is list:
                  (item,) = args
                  return isinstance(valor, list) and all(confere(v, item) for v in valor)
              if origem is dict:
                  tipo_chave, tipo_valor = args
                  return isinstance(valor, dict) and all(
                      confere(k, tipo_chave) and confere(v, tipo_valor) for k, v in valor.items()
                  )
              if tipo is float:                                   # PEP 484: int serve onde se pede float
                  return isinstance(valor, (int, float))
              return isinstance(valor, tipo)


          def _confere_typeddict(valor, td) -> bool:
              if not isinstance(valor, dict):
                  return False
              dicas = get_type_hints(td)                          # resolve e tira o NotRequired[...]
              if not td.__required_keys__ <= valor.keys():
                  return False                                    # falta chave obrigatória
              if not valor.keys() <= dicas.keys():
                  return False                                    # chave desconhecida
              return all(confere(v, dicas[k]) for k, v in valor.items())


          class Colecao[T]:
              """Coleção que valida os itens em tempo de execução."""

              def __init__(self, tipo: Any) -> None:              # Any: aceita TypedDict, int | None...
                  self.tipo = tipo
                  self._itens: list[T] = []

              def adicionar(self, item: T) -> None:
                  if not confere(item, self.tipo):
                      raise TypeError(f"{item!r} não confere com {self.tipo!r}")
                  self._itens.append(item)

              def __len__(self) -> int:
                  return len(self._itens)

              def __iter__(self) -> Iterator[T]:
                  return iter(self._itens)
        `),
        solutionExplanation: 'O verificador é um despachante recursivo sobre a **estrutura** da anotação: `get_origin` diz qual construção é (`list`, `dict`, `Literal`, união) e `get_args` entrega as peças, que são conferidas chamando `confere` de novo — por isso `list[list[int]]` e `TypedDict` dentro de `list` saem de graça. Os casos especiais vêm antes: `Any`, `None`, aliases da PEP 695 (desembrulhados por `__value__`) e `TypedDict`, que é conferido com `get_type_hints` (anotações já resolvidas, sem `NotRequired`) mais `__required_keys__`. Dois detalhes de semântica: `Literal` compara também o tipo, porque `True == 1`; e `float` aceita `int`, como manda a PEP 484. A `Colecao[T]` mostra o outro lado: o `T` só existe para o checker (*type erasure*), então a validação real depende do tipo passado ao construtor.',
      },
      {
        type: 'mcq',
        id: 'py-typ-q4',
        concept: 'Type erasure',
        say: 'Depois de escrever um validador, fica fácil prever esta. O que sai?',
        prompt: `O que este código imprime ao **executar** (sem type checker)?

\`\`\`python
from typing import Final, NewType, TypedDict

UserId = NewType("UserId", int)

class Ponto(TypedDict):
    x: int
    y: int

LIMITE: Final = 10
LIMITE = 20

p = Ponto(x="1", y=2)
print(type(UserId(5)).__name__, type(p).__name__, LIMITE, p["x"])
\`\`\``,
        options: [
          { text: '`int dict 20 1`', correct: true, why: 'Em runtime, `NewType` é uma função identidade (devolve o próprio `int`), `Ponto(...)` cria um `dict` comum sem validar nada e `Final` não impede a reatribuição. Só o checker reclamaria das duas últimas atribuições.' },
          { text: '`UserId Ponto 10 1`', why: '`NewType` não cria uma classe nova, e `TypedDict` não cria instâncias próprias: os dois somem em runtime.' },
          { text: '`TypeError` ao criar `Ponto(x="1", y=2)`', why: 'O `TypedDict` não valida valores em runtime: o `"1"` entra no dict sem reclamação. Validar é trabalho do checker (estático) ou de uma biblioteca como o pydantic.' },
          { text: 'Um erro ao reatribuir `LIMITE`', why: '`Final` é só uma anotação: o checker acusa `LIMITE = 20`, mas o Python executa normalmente.' },
        ],
        explanation: 'Anotações são metadados. Quase tudo no módulo `typing` (com poucas exceções, como `@runtime_checkable`) serve ao type checker — código mal tipado roda do mesmo jeito. Para ter garantias em runtime, é preciso validar explicitamente, como no exercício anterior.',
      },
      {
        type: 'open',
        id: 'py-typ-q5',
        concept: 'Protocol × ABC',
        say: 'Última: uma pergunta clássica de entrevista. Explique com critério.',
        prompt: 'Numa entrevista: "Quando você usaria um `Protocol` e quando uma ABC (`abc.ABC`) para definir o que um parâmetro precisa saber fazer?" Explique a diferença e dê um critério de escolha.',
        minWords: 35,
        rubric: [
          { label: '`Protocol` é **estrutural**; ABC é **nominal** (exige herança)', keywords: ['estrutural', 'structural', 'nominal', 'duck typing', 'duck-typing', 'sem herdar', 'sem heranca', 'nao precisa herdar', 'nao precisa de heranca', 'heranca explicita', 'herdar explicitamente'], concept: 'Subtipagem estrutural', why: 'É a diferença central: forma × declaração de herança.' },
          { label: '`Protocol` encaixa classes de **terceiros** ou legado sem modificá-las', keywords: ['terceiro', 'biblioteca', 'legado', 'nao controlo', 'nao posso alterar', 'nao posso modificar', 'sem modificar', 'sem alterar', 'codigo externo', 'externa', 'externo', 'desacopl'], concept: 'Protocol', why: 'Você descreve a capacidade de que precisa sem exigir que o autor da classe conheça a sua interface.' },
          { label: 'ABC traz **implementação compartilhada** e barra a instanciação incompleta', keywords: ['implementacao compartilhada', 'implementacao padrao', 'metodo concreto', 'metodos concretos', 'reaproveit', 'reutiliz', 'abstractmethod', 'instanci', 'template method', 'codigo comum', 'comportamento comum'], concept: 'ABC', why: 'Métodos concretos na base e o `TypeError` ao instanciar uma subclasse incompleta são vantagens da ABC.' },
          { label: 'Limite em runtime: `@runtime_checkable` só confere os nomes', keywords: ['runtime_checkable', 'runtime checkable', 'isinstance', 'so confere', 'so verifica', 'assinatura', 'nomes dos metodos', 'presenca'], concept: 'runtime_checkable', why: 'O `isinstance` com protocolo não confere assinaturas nem tipos — só a existência dos membros.' },
        ],
        modelAnswer: `A ABC usa subtipagem **nominal**: para contar como \`Repositorio\`, a classe precisa herdar dela (ou ser registrada com \`register\`). O \`Protocol\` usa subtipagem **estrutural**: qualquer objeto com os métodos certos serve, sem herdar nada — é o duck typing com aval do type checker.

Uso \`Protocol\` quando quero descrever uma capacidade mínima e aceitar classes de terceiros ou código legado que não posso alterar, mantendo o módulo desacoplado — por exemplo, "qualquer coisa com \`.fechar()\`".

Uso ABC quando quero uma hierarquia explícita com implementação compartilhada (métodos concretos que chamam os abstratos, como num template method) e quero que o Python barre a instanciação de uma subclasse incompleta via \`@abstractmethod\`.

Um cuidado: em runtime, \`isinstance\` com protocolo só funciona com \`@runtime_checkable\` e só confere se os nomes existem — não confere assinatura nem tipos.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ufa! Tipagem gradual, `Protocol`, genéricos, variância, `ParamSpec`, a caixa de ferramentas — e ainda um validador em runtime.',
          'Na próxima aula: dataclasses a fundo e pattern matching, onde os tipos encontram os dados.',
        ],
        board: null,
      },
    ],
  });
})();
