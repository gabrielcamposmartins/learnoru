(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'metaprogramacao',
    title: 'Metaprogramação: classes que criam classes',
    kind: 'lesson',
    level: 3,
    order: 3,
    unit: 'objetos',
    summary: 'Classes são objetos criados em tempo de execução: `type()`, metaclasses (`__prepare__`, `__new__`, `__init__`, `__call__`), `__init_subclass__`, decorators de classe e `__class_getitem__` — e como saber quando tudo isso é exagero.',
    concepts: ['type()', 'Metaclasses', '__prepare__', '__init_subclass__ × decorators', '__class_getitem__'],
    takeaways: [
      'Classes são objetos: `class X: ...` equivale a `X = type("X", bases, namespace)`, e `type` é a metaclasse padrão — a classe das classes.',
      'Criação de uma classe: escolhe a metaclasse → `__prepare__` → corpo executa → `Meta.__new__` (onde rodam `__set_name__` e `__init_subclass__`) → `Meta.__init__` → decorators.',
      'Metaclasse se justifica pelo que só ela alcança: ver o corpo da classe (`__prepare__`), controlar `Classe(...)` (`__call__`) ou dar comportamento à própria classe (`len(Cor)`, `Cor["VERDE"]`).',
      'Para registrar ou validar **toda** subclasse, prefira `__init_subclass__` (herdado); para ajustar **uma** classe, um decorator de classe (não é herdado).',
      '`Classe[X]` chama `__class_getitem__` (feito para type hints); `class C(list[int])` funciona graças ao `__mro_entries__`.',
    ],
    glossary: [
      { term: 'Metaprogramação', aliases: ['metaprogramming'], definition: 'Código que trata código como dado: cria ou modifica classes e funções em tempo de execução. Em Python: `type()`, metaclasses, decorators, `__init_subclass__` e descritores.' },
      { term: 'Metaclasse', aliases: ['metaclasses', 'metaclass'], definition: 'A classe de uma classe (por padrão, `type`). Controla a criação das classes (`__prepare__`, `__new__`, `__init__`) e o que `Classe(...)` faz (`__call__`).' },
      { term: '__prepare__', definition: 'Método de classe da metaclasse que cria o **namespace** onde o corpo da classe executa. Devolvendo um mapeamento próprio, a metaclasse vê cada atribuição do corpo — o `Enum` usa isso para barrar membros duplicados.' },
      { term: 'Decorator de classe', aliases: ['decorators de classe', 'decorador de classe', 'decoradores de classe', 'class decorator', 'class decorators'], definition: 'Função que recebe uma classe já criada e devolve a mesma (ajustada) ou outra, como `@dataclass` e `@total_ordering`. Explícito e simples, mas **não é herdado** pelas subclasses.' },
      { term: '__class_getitem__', aliases: ['class_getitem'], definition: 'Método implícito de classe chamado em `Classe[item]` (PEP 560). Existe para anotações genéricas como `list[int]`; se a metaclasse define `__getitem__`, ela tem prioridade.' },
      { term: '__mro_entries__', aliases: ['mro_entries', 'orig_bases', '__orig_bases__'], definition: 'Gancho (PEP 560) de um objeto usado como base sem ser classe: devolve as bases reais. Por isso `class Pilha(list[int])` herda de `list` e guarda o original em `__orig_bases__`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Na aula passada, o ponto. Hoje, algo ainda mais fundamental: de onde vêm as **classes**?',
          'Spoiler: uma classe é um objeto como outro qualquer — criado em tempo de execução, por outra classe.',
        ],
        board: {
          title: 'Classes são objetos — e type é a classe delas',
          md: `\`\`\`python
class Ponto:
    pass

p = Ponto()
type(p)        # <class 'Ponto'>  a classe da instância
type(Ponto)    # <class 'type'>   a classe da classe: a METACLASSE
type(type)     # <class 'type'>   type é instância de si mesmo

formatos = {"ponto": Ponto}          # classes vão em dicts e listas...
def fabricar(cls): return cls()      # ...e viram argumento como qualquer valor
\`\`\`

\`\`\`text
 instância          classe            metaclasse
    p   --type()-->  Ponto  --type()-->  type  --type()-->  type (ele mesmo)
\`\`\`

A instrução \`class\` é açúcar sintático: executa o corpo, junta os nomes num dicionário e chama a metaclasse.

\`\`\`python
def falar(self):
    return f"{self.nome} diz oi"

Pessoa = type("Pessoa", (object,), {"nome": "Lia", "falar": falar})
Pessoa().falar()      # 'Lia diz oi' — igualzinho a escrever class Pessoa: ...
\`\`\`

> [!sabia] \`type()\` com 3 argumentos **pula o \`__prepare__\`**: se a base tiver uma metaclasse que depende dele, o namespace especial nunca é criado. Para criar classes dinamicamente respeitando a metaclasse, use \`types.new_class(nome, bases, kwds, exec_body)\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Se `type` cria classes, uma **metaclasse** é só uma subclasse de `type` que muda esse processo.',
          'Vamos acompanhar, passo a passo, tudo o que roda quando o Python encontra um `class`.',
        ],
        board: {
          title: 'O ciclo de vida de uma classe',
          md: `\`\`\`python
class Meta(type):
    @classmethod
    def __prepare__(mcls, nome, bases, **kw):
        print("1. __prepare__: cria o namespace")
        return {}

    def __new__(mcls, nome, bases, ns, **kw):
        print("3. Meta.__new__: vai criar a classe")
        return super().__new__(mcls, nome, bases, ns, **kw)

    def __init__(cls, nome, bases, ns, **kw):
        print("5. Meta.__init__: classe pronta")
        super().__init__(nome, bases, ns, **kw)

    def __call__(cls, *args, **kw):
        print("7. Meta.__call__: alguém chamou Modelo()")
        return super().__call__(*args, **kw)      # __new__ + __init__ da classe


class Campo:
    def __set_name__(self, dono, nome):
        print("4a. __set_name__ do descritor")

class Base:
    def __init_subclass__(cls, **kw):
        print("4b. __init_subclass__ da base")
        super().__init_subclass__(**kw)

def decorar(cls):
    print("6. decorator de classe")
    return cls

@decorar
class Modelo(Base, metaclass=Meta):
    print("2. corpo da classe executando")
    email = Campo()

# a definição acima imprime 1, 2, 3, 4a, 4b, 5 e 6
Modelo()      # e só esta linha imprime o 7
\`\`\`

- A metaclasse é escolhida entre \`metaclass=\` e as metaclasses das bases: vence a **mais derivada**; se nenhuma deriva das outras, *metaclass conflict*.
- \`__set_name__\` e \`__init_subclass__\` rodam **dentro** do \`type.__new__\`, antes do \`Meta.__init__\`.
- Argumentos nomeados da linha \`class X(Base, metaclass=Meta, tabela="x")\` chegam ao \`__prepare__\`, ao \`__new__\`, ao \`__init__\` e ao \`__init_subclass__\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Então o que **só** uma metaclasse consegue fazer? Três coisas.',
          'Ver o corpo da classe enquanto ele roda, controlar o `Classe(...)` e dar comportamento à própria classe — o `Enum` usa as três.',
        ],
        board: {
          title: 'O que só uma metaclasse faz',
          md: `\`\`\`python
from enum import Enum

class Cor(Enum):
    VERMELHO = 1
    VERDE = 2

len(Cor)          # 2                  <- __len__ da metaclasse (EnumType)
list(Cor)         # [<Cor.VERMELHO: 1>, <Cor.VERDE: 2>]
Cor["VERDE"]      # <Cor.VERDE: 2>     <- __getitem__ da metaclasse
Cor(1)            # <Cor.VERMELHO: 1>  <- __call__ da metaclasse: BUSCA, não cria
\`\`\`

\`__call__\` intercepta a instanciação. Exemplo: objetos "internados" — mesmos argumentos, mesma instância:

\`\`\`python
class MetaInterna(type):
    def __init__(cls, *args, **kw):
        super().__init__(*args, **kw)
        cls._cache = {}                            # um cache por classe

    def __call__(cls, *args):                      # intercepta Moeda("BRL")
        if args not in cls._cache:
            cls._cache[args] = super().__call__(*args)   # __new__ + __init__
        return cls._cache[args]

class Moeda(metaclass=MetaInterna):
    def __init__(self, codigo):
        self.codigo = codigo

Moeda("BRL") is Moeda("BRL")     # True
\`\`\`

> [!sabia] O \`__prepare__\` do \`Enum\` devolve um dicionário especial (\`_EnumDict\`) que vigia cada atribuição do corpo. Por isso \`VERDE = 2\` repetido na mesma classe dá \`TypeError: 'VERDE' already defined as 2\`. Nenhum outro gancho consegue isso: quando o \`__init_subclass__\` roda, o primeiro valor já foi sobrescrito.`,
        },
      },
      {
        type: 'say',
        text: [
          'Na maioria dos casos, você **não** precisa de metaclasse. Existem duas alternativas bem mais leves.',
          'A diferença que importa: o `__init_subclass__` é **herdado**; o decorator vale só para a classe decorada.',
        ],
        board: {
          title: '__init_subclass__ e decorators de classe',
          md: `\`\`\`python
# 1) __init_subclass__: roda para TODA subclasse, em qualquer nível
class Comando:
    def __init_subclass__(cls, nome=None, **kw):
        super().__init_subclass__(**kw)
        if not callable(getattr(cls, "executar", None)):
            raise TypeError(f"{cls.__name__} precisa definir executar()")
        cls.nome = nome or cls.__name__.lower()

class Salvar(Comando, nome="save"):
    def executar(self): ...


# 2) decorator de classe: explícito, só na classe marcada
import inspect

def com_repr(cls):
    """Gera __repr__ a partir dos parâmetros do __init__."""
    params = list(inspect.signature(cls).parameters)
    def __repr__(self):
        pares = ", ".join(f"{p}={getattr(self, p)!r}" for p in params)
        return f"{type(self).__name__}({pares})"
    cls.__repr__ = __repr__
    return cls

@com_repr
class Moeda:
    def __init__(self, codigo, casas=2):
        self.codigo, self.casas = codigo, casas

Moeda("BRL")      # Moeda(codigo='BRL', casas=2)
\`\`\`

| | Decorator de classe | \`__init_subclass__\` | Metaclasse |
|---|---|---|---|
| Quando roda | depois da classe pronta | dentro do \`type.__new__\` | antes, durante e depois |
| Herdado pelas subclasses? | **não** | sim | sim |
| Vê o corpo executando? | não | não | sim (\`__prepare__\`) |
| Controla \`Classe(...)\`? | só trocando métodos | não | sim (\`__call__\`) |
| Combina com outras bibliotecas? | sim | sim | risco de *metaclass conflict* |

> [!dica] \`@dataclass\` e \`@functools.total_ordering\` são decorators de classe: leem a classe pronta e **acrescentam** métodos. Nenhuma metaclasse envolvida.`,
        },
      },
      {
        type: 'say',
        text: [
          'Já reparou que `list[int]` funciona? Quem responde aos colchetes numa **classe** é o `__class_getitem__`.',
          'É o gancho que o `typing` usa para genéricos — e ele tem um parceiro pouco conhecido: o `__mro_entries__`.',
        ],
        board: {
          title: '__class_getitem__ e __mro_entries__',
          md: `\`\`\`python
import types

list[int]                       # list.__class_getitem__(int) -> types.GenericAlias

class Caixa:
    def __class_getitem__(cls, item):          # implicitamente um classmethod
        return types.GenericAlias(cls, item)   # herdar de typing.Generic faz isso por você

Caixa[int]                      # __main__.Caixa[int] — serve para anotações
isinstance(Caixa(), Caixa)      # em runtime o [int] some (type erasure)

class Pilha(list[int]):         # list[int] nem é uma classe... e funciona!
    pass

Pilha.__bases__                 # (<class 'list'>,)   <- via __mro_entries__
types.get_original_bases(Pilha) # (list[int],)        <- Python 3.12+
\`\`\`

- \`Classe[x]\`: se a **metaclasse** define \`__getitem__\`, ele vence (é o \`Cor["VERDE"]\` do \`Enum\`); senão, o Python chama \`Classe.__class_getitem__(x)\`.
- A documentação desencoraja usar \`__class_getitem__\` para outra coisa que não type hints. Para indexar a classe em tempo de execução, a ferramenta certa é o \`__getitem__\` na metaclasse.

> [!sabia] \`__mro_entries__\` (PEP 560): quando a base de uma classe **não é uma classe** — como \`list[int]\` ou \`Generic[T]\` —, o Python pergunta a ela quais são as bases reais. É assim que \`class Pilha(list[int])\` herda de \`list\` e ainda guarda o original em \`__orig_bases__\`, de onde dá para descobrir o \`int\` em tempo de execução.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o conselho mais importante da aula: metaprogramação é tempero, não prato principal.',
          'Cada camada de mágica é algo a mais que o próximo dev — e as ferramentas de análise — precisa entender.',
        ],
        board: {
          title: 'Quando é exagero',
          md: `\`\`\`text
Preciso mudar o comportamento de classes?
 1. Função, composição ou herança simples resolve?      -> use isso
 2. Ajustar UMA classe depois de pronta?                 -> decorator de classe
 3. Registrar ou validar TODA subclasse?                 -> __init_subclass__
 4. Regras em atributos?                                 -> descritores + __set_name__
 5. Ver o corpo da classe, controlar Classe(...) ou
    dar comportamento à classe em si (len, iter, [])?    -> metaclasse
\`\`\`

Custos reais da mágica:

- **Descoberta**: quem lê \`class Usuario(Modelo)\` não vê de onde vêm o \`__init__\`, as validações e o registro.
- **Ferramentas**: type checkers e IDEs não executam seu código; um \`__init__\` gerado em runtime vira "argumento desconhecido".
- **Composição**: duas bibliotecas com metaclasses diferentes na mesma classe → *metaclass conflict*.
- **Depuração**: stack traces atravessam \`__new__\`, \`__call__\` e código gerado.

> [!sabia] \`typing.dataclass_transform\` (PEP 681, Python 3.11) ataca o problema das ferramentas: marcando a metaclasse, a base ou o decorator com ele, você avisa aos type checkers que as classes geradas se comportam como dataclasses — com \`__init__\` a partir dos campos declarados. Bibliotecas como pydantic e SQLAlchemy 2.0 usam isso.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: '`type()`, ciclo de vida das classes, metaclasses e as alternativas leves.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-meta-q1',
        concept: 'type()',
        say: 'Aquecimento: uma classe criada sem a palavra `class`. O que sai?',
        prompt: `O que este código imprime?

\`\`\`python
def criar(nome, **attrs):
    return type(nome, (), attrs)

Ponto = criar("Ponto", x=0, dobro=lambda self: self.x * 2)
p = Ponto()
p.x = 21
print(type(Ponto).__name__, Ponto.__name__, p.dobro())
\`\`\``,
        options: [
          { text: '`type Ponto 42`', correct: true, why: '`type(Ponto)` é a metaclasse `type`; o nome veio do 1º argumento; e a `lambda` do namespace virou método como qualquer função: `p.dobro()` recebe `p` como `self` e lê o `x` da instância (21).' },
          { text: '`Ponto Ponto 42`', why: '`type(Ponto)` pergunta a classe **da classe**. Toda classe criada sem metaclasse customizada é instância de `type`.' },
          { text: '`type Ponto 0`', why: '`p.x = 21` cria um atributo na instância, que vence o `x = 0` da classe na busca de atributos.' },
          { text: '`TypeError: <lambda>() missing 1 required positional argument`', why: 'Não importa se a função veio de `def` ou de `lambda`, nem se a classe veio de `class` ou de `type()`: toda função no namespace da classe é um descritor e vira método vinculado.' },
        ],
        explanation: '`type(nome, bases, namespace)` faz exatamente o que a instrução `class` faz depois de executar o corpo: cria a classe a partir de um dicionário de atributos. As funções desse dicionário viram métodos pelo mesmo protocolo de descritor da aula anterior.',
      },
      {
        type: 'order',
        id: 'py-meta-q2',
        concept: 'Criação de classes',
        say: 'Agora a linha do tempo completa. Coloque os eventos na ordem.',
        prompt: 'Ordene o que acontece quando o Python executa `@decorar` seguido de `class Modelo(Base, metaclass=Meta): ...` (com um descritor no corpo).',
        items: [
          'A metaclasse é determinada (`Meta`, conferida com as metaclasses das bases)',
          '`Meta.__prepare__` cria o namespace',
          'O corpo da classe executa dentro desse namespace',
          '`Meta.__new__` chama `type.__new__`, que cria o objeto classe',
          'Ainda no `type.__new__`: `__set_name__` dos descritores e `__init_subclass__` da base',
          '`Meta.__init__` recebe a classe pronta',
          'O decorator é aplicado e o resultado é ligado ao nome `Modelo`',
        ],
        explanation: '`__set_name__` e `__init_subclass__` rodam **dentro** do `type.__new__` — antes do `Meta.__init__`. O decorator é o último: recebe a classe já criada pela metaclasse, por isso não participa da criação nem é herdado.',
      },
      {
        type: 'match',
        id: 'py-meta-q3',
        concept: 'Metaprogramação',
        say: 'Cada ferramenta tem seu lugar. Associe à situação em que ela brilha.',
        prompt: 'Associe cada **ferramenta de metaprogramação** ao cenário em que ela é a melhor escolha.',
        pairs: [
          { left: 'Decorator de classe', right: 'Ajustar uma classe específica depois de pronta' },
          { left: '`__init_subclass__`', right: 'Validar ou registrar toda subclasse de uma hierarquia' },
          { left: 'Metaclasse com `__prepare__`', right: 'Enxergar o corpo da classe enquanto ele executa' },
          { left: 'Metaclasse com `__call__`', right: 'Controlar o que acontece em `Classe(...)`' },
          { left: '`__class_getitem__`', right: 'Suportar `Classe[int]` em anotações de tipo' },
          { left: '`type(nome, bases, ns)`', right: 'Criar uma classe a partir de dados, em tempo de execução' },
        ],
        explanation: 'Do mais simples ao mais poderoso: decorator → `__init_subclass__` → metaclasse. Os dois primeiros cobrem a maior parte dos casos reais; a metaclasse fica para o que só ela alcança — namespace do corpo, instanciação e comportamento da própria classe.',
      },
      {
        type: 'code',
        id: 'py-meta-q4',
        concept: '__prepare__',
        title: 'Mini-ORM com metaclasse',
        points: 50,
        say: 'Agora uma metaclasse de verdade — e justificada: ela precisa enxergar o corpo da classe, coisa que o `__init_subclass__` não consegue.',
        prompt: `Complete o mini-ORM. \`Campo\`, \`Inteiro\`, \`Texto\` e a base \`Modelo\` já estão prontos; falta a **metaclasse**.

**\`NamespaceModelo\`** (o namespace do corpo da classe): um **campo** declarado duas vezes no mesmo corpo → \`TypeError\`. Outros nomes podem se repetir (o \`@x.setter\` de uma property repete o nome!).

**\`MetaModelo\`**
- \`__prepare__\` devolve um \`NamespaceModelo\`.
- \`__new__\` cria a classe e define:
  - \`cls._campos\`: dict nome → campo, com os **herdados primeiro** e depois os do corpo, na ordem de declaração — sem alterar o \`_campos\` das bases;
  - \`cls._tabela\`: o atributo \`tabela\` declarado **no próprio corpo** ou, sem ele, o nome da classe em minúsculas.
- Classes **concretas** precisam de exatamente **1** campo com \`chave=True\` (senão \`TypeError\` já na definição) e entram em \`MetaModelo.registro\` (\`_tabela\` → classe).
- **Não** são concretas: a própria \`Modelo\` (sem bases que sejam modelos) e classes com \`abstrato = True\` **no próprio corpo** — as filhas delas são concretas.`,
        starter: py(`
          class Campo:
              tipo_sql = "TEXT"

              def __init__(self, *, chave=False):
                  self.chave = chave
                  self.nome = None

              def __set_name__(self, dono, nome):      # chamado pelo type.__new__
                  self.nome = nome

              def sql(self):
                  extra = " PRIMARY KEY" if self.chave else ""
                  return f"{self.nome} {self.tipo_sql}{extra}"


          class Inteiro(Campo):
              tipo_sql = "INTEGER"


          class Texto(Campo):
              tipo_sql = "TEXT"


          class NamespaceModelo(dict):
              """Namespace onde o corpo da classe executa."""

              def __setitem__(self, chave, valor):
                  # TODO: campo declarado duas vezes no mesmo corpo -> TypeError
                  super().__setitem__(chave, valor)


          class MetaModelo(type):
              registro = {}

              @classmethod
              def __prepare__(mcls, nome, bases, **kwargs):
                  return {}  # TODO: devolva o namespace que detecta campos duplicados

              def __new__(mcls, nome, bases, ns, **kwargs):
                  cls = super().__new__(mcls, nome, bases, dict(ns), **kwargs)
                  # TODO: _campos (herdados + do corpo), _tabela, validação da chave e registro
                  return cls


          class Modelo(metaclass=MetaModelo):
              """Base de todos os modelos (já pronta: usa cls._campos e cls._tabela)."""

              def __init__(self, **valores):
                  desconhecidos = valores.keys() - self._campos.keys()
                  if desconhecidos:
                      raise TypeError(f"campos desconhecidos: {sorted(desconhecidos)}")
                  for nome in self._campos:
                      setattr(self, nome, valores.get(nome))

              def __repr__(self):
                  pares = ", ".join(f"{n}={getattr(self, n)!r}" for n in self._campos)
                  return f"{type(self).__name__}({pares})"

              @classmethod
              def sql_criar(cls):
                  colunas = ", ".join(c.sql() for c in cls._campos.values())
                  return f"CREATE TABLE {cls._tabela} ({colunas})"
        `),
        tests: [
          {
            name: 'coleta os campos na ordem de declaração',
            code: py(`
              class Usuario(Modelo):
                  id = Inteiro(chave=True)
                  nome = Texto()
                  email = Texto()

              assert list(Usuario._campos) == ["id", "nome", "email"], list(Usuario._campos)
              assert Usuario._tabela == "usuario", Usuario._tabela
              sql = Usuario.sql_criar()
              assert sql == "CREATE TABLE usuario (id INTEGER PRIMARY KEY, nome TEXT, email TEXT)", sql
              u = Usuario(id=1, nome="Lia")
              assert repr(u) == "Usuario(id=1, nome='Lia', email=None)", repr(u)
            `),
          },
          {
            name: 'registro por tabela; a base não entra',
            code: py(`
              class Pedido(Modelo):
                  tabela = "pedidos"
                  id = Inteiro(chave=True)
                  total = Inteiro()

              assert Pedido._tabela == "pedidos", Pedido._tabela
              assert MetaModelo.registro == {"pedidos": Pedido}, MetaModelo.registro
            `),
          },
          {
            name: 'sem chave primária → TypeError na definição',
            code: py(`
              try:
                  class SemChave(Modelo):
                      nome = Texto()
              except TypeError:
                  pass
              else:
                  raise AssertionError("modelo sem chave primária deveria falhar já na definição da classe")
              assert MetaModelo.registro == {}, MetaModelo.registro
            `),
          },
          {
            name: 'campo declarado duas vezes → TypeError',
            code: py(`
              try:
                  class Produto(Modelo):
                      id = Inteiro(chave=True)
                      nome = Texto()
                      nome = Texto()          # copiar-e-colar esquecido
              except TypeError:
                  pass
              else:
                  raise AssertionError("o campo 'nome' foi declarado duas vezes e ninguém reclamou")
            `),
          },
          {
            name: 'herança: campos da base primeiro; abstrato fica fora do registro',
            code: py(`
              class ComDatas(Modelo):
                  abstrato = True
                  criado_em = Texto()

              class Post(ComDatas):
                  id = Inteiro(chave=True)
                  titulo = Texto()

              assert list(Post._campos) == ["criado_em", "id", "titulo"], list(Post._campos)
              assert MetaModelo.registro == {"post": Post}, MetaModelo.registro
            `),
          },
          {
            name: 'o SQL gerado roda no SQLite',
            hidden: true,
            code: py(`
              import sqlite3

              class Livro(Modelo):
                  tabela = "livros"
                  isbn = Texto(chave=True)
                  titulo = Texto()
                  paginas = Inteiro()

              con = sqlite3.connect(":memory:")
              con.execute(Livro.sql_criar())
              con.execute("INSERT INTO livros VALUES ('978-85', 'Python Fluente', 800)")
              assert con.execute("SELECT paginas FROM livros WHERE isbn = '978-85'").fetchone() == (800,)
              try:
                  con.execute("INSERT INTO livros VALUES ('978-85', 'Duplicado', 1)")
              except sqlite3.IntegrityError:
                  pass
              else:
                  raise AssertionError("isbn deveria ser PRIMARY KEY")
            `),
          },
          {
            name: 'duas chaves primárias → TypeError',
            hidden: true,
            code: py(`
              try:
                  class Dupla(Modelo):
                      a = Inteiro(chave=True)
                      b = Inteiro(chave=True)
              except TypeError:
                  pass
              else:
                  raise AssertionError("duas chaves primárias deveriam lançar TypeError")
            `),
          },
          {
            name: 'property com setter repete o nome — e pode',
            hidden: true,
            code: py(`
              class Conta(Modelo):
                  id = Inteiro(chave=True)
                  centavos = Inteiro()

                  @property
                  def saldo(self):
                      return self.centavos / 100

                  @saldo.setter
                  def saldo(self, valor):
                      self.centavos = round(valor * 100)

              c = Conta(id=1, centavos=150)
              c.saldo = 2.5
              assert c.centavos == 250
              assert list(Conta._campos) == ["id", "centavos"], list(Conta._campos)
            `),
          },
          {
            name: 'subclasse concreta: tabela não é herdada e a base fica intacta',
            hidden: true,
            code: py(`
              class Usuario(Modelo):
                  tabela = "usuarios"
                  id = Inteiro(chave=True)
                  nome = Texto()

              class Admin(Usuario):
                  nivel = Inteiro()

              assert list(Admin._campos) == ["id", "nome", "nivel"], list(Admin._campos)
              assert list(Usuario._campos) == ["id", "nome"], "a subclasse alterou o _campos da base!"
              assert MetaModelo.registro == {"usuarios": Usuario, "admin": Admin}, MetaModelo.registro
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /==\s*["']Modelo["']|["']Modelo["']\s*==/.test(code),
            text: 'Pular a base comparando `nome == "Modelo"` funciona, mas é frágil: renomeou, quebrou — e qualquer outra classe chamada `Modelo` também seria pulada. Pergunte pela estrutura: nenhuma das bases é instância de `MetaModelo`.',
            concept: 'Metaclasses',
          },
          {
            when: (m, code) => /\b(exec|eval)\s*\(/.test(code),
            text: 'Gerar código com `exec`/`eval` é frágil (injeção, mensagens de erro ruins, nada de análise estática). Aqui, montar dicts e usar `setattr` resolve tudo.',
            concept: 'Metaprogramação',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Um `except` amplo dentro da metaclasse engole erros de definição de classe — justamente os que você quer ver cedo, no import. Deixe o `TypeError` subir.',
            concept: 'Falhar cedo',
          },
        ],
        hints: [
          '`__prepare__` só precisa de `return NamespaceModelo()`. Cada `nome = Texto()` do corpo vira um `ns["nome"] = ...` — e é no `__setitem__` que a duplicata aparece: `if isinstance(self.get(chave), Campo): raise TypeError(...)`.',
          'No `__new__`, depois do `super().__new__`: comece um dict **novo**, copie os campos das bases (`for base in reversed(cls.__mro__[1:]): campos.update(getattr(base, "_campos", {}))`) e depois os valores do `ns` que são `Campo`, na ordem.',
          'Leia `tabela` e `abstrato` com `ns.get(...)`, não com `getattr(cls, ...)` — atributos de classe são herdados! A base é a classe sem nenhuma base `MetaModelo`: `not any(isinstance(b, MetaModelo) for b in bases)`. Nas concretas, conte os campos com `chave`, lance `TypeError` se não for 1 e grave em `mcls.registro`.',
        ],
        solution: py(`
          class Campo:
              tipo_sql = "TEXT"

              def __init__(self, *, chave=False):
                  self.chave = chave
                  self.nome = None

              def __set_name__(self, dono, nome):      # chamado pelo type.__new__
                  self.nome = nome

              def sql(self):
                  extra = " PRIMARY KEY" if self.chave else ""
                  return f"{self.nome} {self.tipo_sql}{extra}"


          class Inteiro(Campo):
              tipo_sql = "INTEGER"


          class Texto(Campo):
              tipo_sql = "TEXT"


          class NamespaceModelo(dict):
              """Namespace onde o corpo da classe executa."""

              def __setitem__(self, chave, valor):
                  if isinstance(self.get(chave), Campo):
                      raise TypeError(f"campo '{chave}' declarado duas vezes")
                  super().__setitem__(chave, valor)


          class MetaModelo(type):
              registro = {}

              @classmethod
              def __prepare__(mcls, nome, bases, **kwargs):
                  return NamespaceModelo()

              def __new__(mcls, nome, bases, ns, **kwargs):
                  cls = super().__new__(mcls, nome, bases, dict(ns), **kwargs)

                  campos = {}                                   # dict NOVO: não mexe nas bases
                  for base in reversed(cls.__mro__[1:]):        # herdados primeiro
                      campos.update(getattr(base, "_campos", {}))
                  for attr, valor in ns.items():                # depois os do corpo, em ordem
                      if isinstance(valor, Campo):
                          campos[attr] = valor
                  cls._campos = campos
                  cls._tabela = ns.get("tabela") or nome.lower()   # do corpo: não herda

                  eh_base = not any(isinstance(b, MetaModelo) for b in bases)
                  if eh_base or ns.get("abstrato", False):
                      return cls

                  chaves = [n for n, c in campos.items() if c.chave]
                  if len(chaves) != 1:
                      raise TypeError(f"{nome} precisa de exatamente 1 chave primária; tem {len(chaves)}")
                  mcls.registro[cls._tabela] = cls
                  return cls


          class Modelo(metaclass=MetaModelo):
              """Base de todos os modelos (já pronta: usa cls._campos e cls._tabela)."""

              def __init__(self, **valores):
                  desconhecidos = valores.keys() - self._campos.keys()
                  if desconhecidos:
                      raise TypeError(f"campos desconhecidos: {sorted(desconhecidos)}")
                  for nome in self._campos:
                      setattr(self, nome, valores.get(nome))

              def __repr__(self):
                  pares = ", ".join(f"{n}={getattr(self, n)!r}" for n in self._campos)
                  return f"{type(self).__name__}({pares})"

              @classmethod
              def sql_criar(cls):
                  colunas = ", ".join(c.sql() for c in cls._campos.values())
                  return f"CREATE TABLE {cls._tabela} ({colunas})"
        `),
        solutionExplanation: 'O `__prepare__` é o único gancho que enxerga o corpo da classe **enquanto** ele executa: quando o segundo `nome = Texto()` chega ao `__setitem__`, o primeiro ainda está lá para ser comparado — um `__init_subclass__` chegaria tarde, com o dict já sobrescrito. No `__new__`, o `super().__new__` cria a classe (e, lá dentro, o `type.__new__` chama o `__set_name__` de cada campo); depois montamos um dict **novo** com os campos herdados (percorrendo a MRO de trás para frente) e os do corpo, na ordem do `ns`. `tabela` e `abstrato` vêm do `ns` porque atributos de classe são herdados: sem isso, toda filha de um modelo abstrato também seria abstrata. E a validação lança `TypeError` na **definição** da classe — o erro aparece no import, não em produção.',
      },
      {
        type: 'mcq',
        id: 'py-meta-q5',
        concept: '__init_subclass__ × decorators',
        say: 'Decorator ou `__init_subclass__`? Este código mostra a diferença na prática.',
        prompt: `O que este código imprime?

\`\`\`python
registrados = []

def registrar(cls):
    registrados.append(cls.__name__)
    return cls

class Base:
    def __init_subclass__(cls, **kw):
        super().__init_subclass__(**kw)
        registrados.append("sub:" + cls.__name__)

@registrar
class A(Base):
    pass

class B(A):
    pass

print(registrados)
\`\`\``,
        options: [
          { text: "`['sub:A', 'A', 'sub:B']`", correct: true, why: 'Ao criar `A`, o `__init_subclass__` roda **dentro** da criação e só depois o decorator recebe a classe pronta. `B` herda o gancho da `Base`, mas não o decorator.' },
          { text: "`['A', 'sub:A', 'sub:B']`", why: 'O decorator só recebe a classe **depois** que ela foi criada — e o `__init_subclass__` roda durante a criação, dentro do `type.__new__`.' },
          { text: "`['sub:A', 'A', 'sub:B', 'B']`", why: 'Decorator de classe **não é herdado**: `B` herda de `A`, mas nunca passou pelo `@registrar`.' },
          { text: "`['sub:A', 'sub:B']`", why: 'O `@registrar` roda sim para `A`: um decorator é só `A = registrar(A)` logo depois da criação da classe.' },
        ],
        explanation: 'É a diferença prática entre as duas alternativas leves: `__init_subclass__` vale para **toda a hierarquia**, automaticamente; o decorator é **explícito** e vale só onde foi escrito. Escolha pelo que você quer que as subclasses herdem.',
      },
      {
        type: 'open',
        id: 'py-meta-q6',
        concept: 'Quando usar metaclasse',
        say: 'Para fechar, um code review: convença seu colega com argumentos, não com gosto pessoal.',
        prompt: 'Num code review, um colega criou uma **metaclasse** para: (a) registrar cada subclasse de `Plugin` num dicionário e (b) adicionar um `__repr__` automático a **duas** classes específicas. Que alternativa você sugeriria para cada item, e em que situação uma metaclasse seria de fato justificada?',
        minWords: 35,
        rubric: [
          { label: '(a) `__init_subclass__` para registrar as subclasses', keywords: ['__init_subclass__', 'init_subclass', 'init subclass'], concept: '__init_subclass__', why: 'Roda para toda subclasse, é herdado e não tem risco de *metaclass conflict*.' },
          { label: '(b) decorator de classe (ou `@dataclass`) para o `__repr__`', keywords: ['decorator', 'decorador', 'dataclass'], concept: 'Decorator de classe', why: 'Explícito e local: vale só para as classes marcadas, sem se espalhar para as filhas.' },
          { label: 'Metaclasse só para o que só ela faz: `__prepare__`, `__call__`, comportamento da própria classe', keywords: ['__prepare__', 'prepare', '__call__', 'namespace', 'corpo da classe', 'instanciacao', 'enum', 'comportamento da classe', 'comportamento da propria classe', 'len(', 'criacao da classe'], concept: 'Metaclasses', why: 'Ver o corpo da classe, interceptar `Classe(...)` ou dar `len`/`iter`/`[]` à classe exigem metaclasse.' },
          { label: 'Aponta os **custos**: complexidade, conflito de metaclasses, ferramentas', keywords: ['conflit', 'complex', 'dificil de ler', 'legib', 'magia', 'magic', 'type checker', 'mypy', 'depura', 'debug', 'implicit', 'surpres'], concept: 'Metaprogramação', why: 'Mágica tem preço: leitura, depuração, análise estática e composição com outras bibliotecas.' },
        ],
        modelAnswer: `**(a)** Para registrar cada subclasse, o \`__init_subclass__\` resolve: roda na base sempre que uma subclasse é definida, é herdado por toda a hierarquia e não traz risco de *metaclass conflict*.

**(b)** Para o \`__repr__\` de duas classes específicas, um **decorator de classe** (ou simplesmente \`@dataclass\`) é o ideal: explícito, visível na definição e sem se espalhar para as subclasses.

A metaclasse se justifica quando preciso do que só ela faz: enxergar o **corpo da classe** enquanto ele executa (\`__prepare__\`, como o \`Enum\` faz para barrar duplicatas), controlar a instanciação em \`Classe(...)\` com \`__call__\` ou dar comportamento à própria classe (\`len(Cor)\`, \`Cor["X"]\`).

Fora disso, ela só adiciona custo: complexidade, código implícito mais difícil de depurar, type checkers e IDEs que não entendem a mágica e conflito de metaclasses ao combinar com \`ABC\`, ORMs ou \`Enum\`.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou muito bem! Você viu a fábrica de classes por dentro: `type`, `__prepare__`, `__new__`, `__init__` e `__call__`.',
          'E a lição mais valiosa: comece pelo mais simples — decorator, `__init_subclass__`, descritor — e guarde a metaclasse para quando só ela resolve.',
        ],
        board: null,
      },
    ],
  });
})();
