(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'dataclasses-match',
    title: 'Dataclasses & pattern matching',
    kind: 'lesson',
    level: 2,
    order: 21,
    unit: 'tipos',
    summary: 'Dataclasses a fundo (`default_factory`, `frozen`, `slots`, `order`, `__post_init__`, `KW_ONLY`, `replace`), quando preferir `NamedTuple` ou pydantic — e o `match` desmontando sequências, dicionários e classes.',
    concepts: ['Dataclasses', 'Imutabilidade', '__post_init__', 'Pattern matching', '__match_args__'],
    takeaways: [
      '`@dataclass` gera `__init__`, `__repr__`, `__eq__` e `__match_args__` a partir das **anotações**. Default mutável pede `field(default_factory=...)`.',
      '`frozen=True` bloqueia atribuições (e, junto com `eq`, gera `__hash__`), mas é **raso**: guarde `tuple`/`frozenset` dentro. `slots=True` economiza memória e barra atributos novos.',
      '`__post_init__` valida e normaliza (numa classe frozen, via `object.__setattr__`). `replace()` chama o `__init__` de novo, então a validação vale também para as cópias.',
      'Dataclass para o **domínio**, `NamedTuple` quando você quer mesmo uma tupla, pydantic/attrs para validar e converter na **fronteira** (JSON, configuração).',
      '`match` casa **estrutura**: sequências (strings não contam), mapeamentos (chaves extras são ignoradas), classes via `__match_args__` e guardas. Nome solto **captura**; constante precisa de ponto (`Cor.VERMELHO`).',
    ],
    glossary: [
      { term: 'Dataclass', aliases: ['dataclasses', '@dataclass'], definition: 'Classe decorada com `@dataclass`: a partir das anotações, o Python gera `__init__`, `__repr__`, `__eq__` e, se pedido, ordenação, `__hash__` e `__slots__`. É uma classe comum — sem validação automática em runtime.' },
      { term: 'Imutabilidade rasa', aliases: ['shallow immutability', 'congelamento raso'], definition: 'Um objeto `frozen` impede reatribuir os **próprios** atributos, mas não protege o que eles apontam: uma `list` dentro dele continua mutável. Para imutabilidade de verdade, guarde `tuple`, `frozenset` ou outros objetos imutáveis.' },
      { term: 'Pattern matching estrutural', aliases: ['pattern matching', 'structural pattern matching', 'match/case'], definition: 'O `match`/`case` do Python 3.10+ (PEP 634): compara o **formato** de um valor (sequência, mapeamento, classe, literal) e já extrai as partes para variáveis. O primeiro `case` que casa (e cuja guarda passa) vence.' },
      { term: '__match_args__', aliases: ['match_args'], definition: 'Tupla de nomes de atributos que diz como padrões **posicionais** de classe se traduzem: com `__match_args__ = ("x", "y")`, `case Ponto(1, 2)` equivale a `case Ponto(x=1, y=2)`. O `@dataclass` gera essa tupla sozinho.' },
      { term: 'Parse, don\'t validate', aliases: ['parse dont validate', 'parse, nao valide'], definition: 'Princípio (Alexis King, 2019): em vez de só **checar** a entrada e seguir com o dado cru, **converta-a** num tipo que carrega a garantia — depois disso, ninguém precisa checar de novo.' },
      { term: 'Expression problem', aliases: ['problema da expressão'], definition: 'Dilema descrito por Philip Wadler (1998): com classes e polimorfismo é fácil criar **tipos** novos, mas cada **operação** nova mexe em todas as classes; com `match` sobre dados, é o contrário.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Última parada da unidade de tipos: dataclasses e pattern matching — onde os tipos encontram os dados.',
          'Começando pelo básico: o `@dataclass` escreve para você o código repetitivo de uma classe que **guarda dados**.',
        ],
        board: {
          title: 'O que o @dataclass gera',
          md: `\`\`\`python
from dataclasses import asdict, dataclass, field, fields
from typing import ClassVar

@dataclass
class Produto:
    nome: str                                   # anotado -> vira campo
    preco: float
    tags: list[str] = field(default_factory=list)
    estoque: int = 0
    moeda = "BRL"                               # SEM anotação: atributo de classe comum
    registro: ClassVar[dict] = {}               # ClassVar: fica fora dos campos

p = Produto("caneca", 39.9)
p                              # Produto(nome='caneca', preco=39.9, tags=[], estoque=0)
p == Produto("caneca", 39.9)   # True: compara os campos, na ordem, como tupla
asdict(p)                      # {'nome': 'caneca', 'preco': 39.9, 'tags': [], 'estoque': 0}
[f.name for f in fields(p)]    # ['nome', 'preco', 'tags', 'estoque']
\`\`\`

| Parâmetro | Padrão | O que gera |
|---|---|---|
| \`init\` | \`True\` | \`__init__\` com os campos na ordem declarada |
| \`repr\` | \`True\` | \`__repr__\` legível |
| \`eq\` | \`True\` | \`__eq__\` que compara os campos (só com a mesma classe) |
| \`match_args\` | \`True\` | \`__match_args__\`, usado pelo \`match\` |
| \`order\` | \`False\` | \`<\`, \`<=\`, \`>\`, \`>=\` |
| \`frozen\` | \`False\` | \`__setattr__\`/\`__delattr__\` que lançam \`FrozenInstanceError\` |
| \`slots\` | \`False\` | \`__slots__\` (3.10+) |

> [!dica] O decorator não usa metaclasse nem mágica em runtime: ele monta o código-fonte do \`__init__\` como **texto** e o compila com \`exec\`. Por isso o \`__init__\` gerado é tão rápido quanto um escrito à mão.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'A armadilha mais famosa do Python: o valor padrão é criado **uma vez só**, quando a função (ou a classe) é definida.',
          'O `@dataclass` tenta te proteger dela — mas a proteção tem um furo que pouca gente conhece.',
        ],
        board: {
          title: 'Default mutável e field(default_factory=...)',
          md: `\`\`\`python
def adicionar(item, lista=[]):     # o [] nasce UMA vez, na definição da função
    lista.append(item)
    return lista

adicionar(1)    # [1]
adicionar(2)    # [1, 2]  <- a mesma lista de antes!

@dataclass
class Carrinho:
    itens: list = []
# ValueError: mutable default <class 'list'> for field itens is not allowed: use default_factory

@dataclass
class Carrinho:
    itens: list[str] = field(default_factory=list)          # uma lista NOVA por instância
    criado_em: datetime = field(default_factory=datetime.now)  # também serve p/ "valor do momento"
\`\`\`

- \`default_factory\` recebe um **callable sem argumentos**, chamado a cada \`__init__\` em que o campo não foi passado.
- \`field(default=...)\` serve para valores imutáveis; \`field(repr=False)\`, \`compare=False\` e \`kw_only=True\` ajustam o campo individualmente.

> [!sabia] Desde o Python 3.11, o \`@dataclass\` não procura mais por \`list\`, \`dict\` e \`set\`: ele recusa qualquer default **não hashable** (\`__hash__\` é \`None\`), usando isso como aproximação de "mutável". O furo: uma instância de classe comum é hashable (por identidade)... e passa. \`config: Config = Config()\` é aceito em silêncio — e **o mesmo objeto** fica compartilhado por todas as instâncias.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora os parâmetros que mudam o comportamento da classe: `frozen`, `slots` e `order`.',
          'E uma regra que cai em entrevista: quando uma dataclass tem `__hash__`?',
        ],
        board: {
          title: 'frozen, slots, order — e a regra do __hash__',
          md: `\`\`\`python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True, order=True)
class Versao:
    major: int
    minor: int
    patch: int = 0
    rotulo: str = field(default="", compare=False)   # fora de ==, < e hash

v = Versao(1, 4)
v.minor = 5                    # FrozenInstanceError
sorted([Versao(1, 10), Versao(1, 9)])   # compara (1, 9, 0) < (1, 10, 0): ordem certa
Versao(1, 0) < (1, 1)          # TypeError: order só compara com a mesma classe
{v: "estável"}                 # OK: frozen + eq geram __hash__
v.__dict__                     # AttributeError: com slots, não há __dict__
\`\`\`

| \`eq\` | \`frozen\` | \`__hash__\` gerado |
|---|---|---|
| \`True\` | \`False\` | \`None\`: a instância **não é hashable** (mutável como chave de dict seria um bug) |
| \`True\` | \`True\` | calculado a partir dos campos com \`compare=True\` |
| \`False\` | qualquer | herdado de \`object\` (identidade) |

\`unsafe_hash=True\` força a geração mesmo sem \`frozen\` — o nome avisa: só se você garantir que ninguém muda os campos.

- **\`slots=True\`**: menos memória e acesso a atributos mais rápido; nenhum atributo fora dos campos. Cuidado: o decorator **cria uma classe nova**, então, no 3.12, \`super()\` sem argumentos dentro dos métodos quebra. Para \`weakref\`, use \`weakref_slot=True\`.

> [!atencao] \`frozen\` é **raso**: \`Time(membros=["ana"])\` continua com uma lista mutável lá dentro. Se precisa de imutabilidade de verdade, guarde \`tuple\`/\`frozenset\` — e converta no \`__post_init__\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E se eu quiser **validar** ou calcular um campo derivado? O lugar é o `__post_init__`, chamado no fim do `__init__` gerado.',
          'Junto com ele vêm três ferramentas pouco usadas: `InitVar`, `KW_ONLY` e `replace`.',
        ],
        board: {
          title: '__post_init__, InitVar, KW_ONLY e replace',
          md: `\`\`\`python
from dataclasses import InitVar, KW_ONLY, dataclass, field, replace

@dataclass(frozen=True)
class Temperatura:
    celsius: float
    _: KW_ONLY                          # pseudo-campo: tudo abaixo é só por nome
    fonte: str = "sensor"
    precisao: InitVar[int] = 1          # vai para o __post_init__, mas NÃO vira campo
    fahrenheit: float = field(init=False)   # derivado: fora do __init__

    def __post_init__(self, precisao: int) -> None:
        if self.celsius < -273.15:
            raise ValueError("abaixo do zero absoluto")
        c = round(self.celsius, precisao)
        object.__setattr__(self, "celsius", c)      # frozen: self.celsius = c falharia
        object.__setattr__(self, "fahrenheit", c * 9 / 5 + 32)

t = Temperatura(21.456, fonte="api")
Temperatura(20, "api")                 # TypeError: fonte é keyword-only
t2 = replace(t, celsius=30)            # cópia alterada: chama o __init__ DE NOVO
replace(t, celsius=-300)               # ValueError: a validação vale para as cópias
\`\`\`

- \`replace(obj, **mudancas)\` cria um objeto novo passando os campos atuais + as mudanças pelo \`__init__\`: o \`__post_init__\` roda de novo e revalida. (O \`copy.replace\` genérico só chega no 3.13.)
- Campos com \`init=False\` não podem ser passados ao \`replace\` — são recalculados.
- \`KW_ONLY\` (ou \`kw_only=True\` no decorator/\`field\`) resolve o clássico \`TypeError: non-default argument follows default argument\`, comum ao herdar de uma dataclass que já tem defaults.

> [!dica] \`object.__setattr__\` é o jeito **documentado** de ajustar campos de uma classe \`frozen\` durante a construção. Fora do \`__post_init__\`, isso é trapaça.`,
        },
      },
      {
        type: 'say',
        text: [
          'Dataclass não é a única opção. `NamedTuple` é mais leve, attrs e pydantic fazem mais.',
          'A escolha certa depende de **onde** o dado vive: na fronteira do sistema ou no domínio.',
        ],
        board: {
          title: 'dataclass × NamedTuple × attrs × pydantic',
          md: `| | \`@dataclass\` | \`NamedTuple\` | attrs | pydantic |
|---|---|---|---|---|
| Origem | stdlib | stdlib | pacote externo | pacote externo |
| Mutável? | sim (ou \`frozen\`) | não: **é uma tupla** | escolha (\`@define\`/\`@frozen\`) | sim (ou \`frozen=True\` na config) |
| Valida em runtime? | não (só o que você escrever) | não | validadores e conversores opcionais | **sim**: valida e converte (\`"7"\` → \`7\`) |
| Indexável/desempacotável | não | sim | não | não |
| Uso típico | domínio, DTOs internos | retorno leve de função, trocar tuplas anônimas | "dataclass turbinada" (slots por padrão) | fronteira: JSON, configuração, APIs |

\`\`\`python
from typing import NamedTuple

class Ponto(NamedTuple):
    x: int
    y: int

class Tamanho(NamedTuple):
    largura: int
    altura: int

x, y = Ponto(1, 2)                 # desempacota como tupla
Ponto(1, 2) == (1, 2)              # True
Ponto(1, 2) == Tamanho(1, 2)       # True! As duas são só a tupla (1, 2)

# pydantic (fora da stdlib — não roda aqui)
class Pedido(BaseModel):
    id: int
    itens: list[str]

Pedido.model_validate({"id": "7", "itens": []})   # id vira 7; "sete" -> ValidationError
\`\`\`

Padrão comum: **pydantic na borda** (converte e valida o JSON que chega) e **dataclasses no domínio** (sem depender de biblioteca externa).

> [!sabia] Esse desenho tem nome: **"Parse, don't validate"** (Alexis King, 2019). Em vez de só checar um \`dict\` e seguir usando o \`dict\`, **converta** a entrada num tipo que carrega a garantia (\`Deposito(conta, valor)\` com valor positivo). Daí em diante, ninguém precisa checar de novo — o tipo é a prova.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Agora o `match`! Ele não é um `switch`: ele compara o **formato** do valor e já desmonta as partes em variáveis.',
          'Primeiro, sequências e dicionários — perfeito para comandos de texto e JSON.',
        ],
        board: {
          title: 'match: sequências, mapeamentos, OR, as e guardas',
          md: `\`\`\`python
def rotear(comando: str) -> str:
    match comando.split():
        case []:
            return "vazio"
        case ["sair" | "exit"]:                       # OR de literais
            return "tchau"
        case ["ir", ("norte" | "sul") as direcao]:    # as: captura o que casou
            return f"indo para {direcao}"
        case ["pegar", item]:
            return f"pegou {item}"
        case ["pegar", *itens] if len(itens) <= 3:    # *resto + guarda
            return f"pegou {len(itens)} itens"
        case _:                                       # coringa: casa tudo
            return "comando desconhecido"

def tratar(evento: dict) -> str:
    match evento:
        case {"tipo": "clique", "pos": [x, y]}:        # chaves extras são ignoradas
            return f"clique em {x},{y}"
        case {"tipo": "tecla", "tecla": str(t), **resto}:   # **resto: o que sobrou
            return f"tecla {t} ({len(resto)} extras)"
    return "ignorado"                                  # sem case: o match só não faz nada
\`\`\`

| Padrão | Casa com | Cuidado |
|---|---|---|
| \`[a, b]\` ou \`(a, b)\` | qualquer \`Sequence\` de tamanho 2 (lista, tupla, \`range\`) | \`str\`, \`bytes\` e \`bytearray\` **não** contam |
| \`{"k": v}\` | qualquer \`Mapping\` com a chave \`"k"\` | casamento **parcial**: chaves extras passam |
| \`"x"\`, \`42\` | igualdade (\`==\`) | \`None\`, \`True\` e \`False\` são comparados com \`is\` |
| \`nome\` | **tudo** (captura) | não é comparação! |
| \`_\` | tudo, sem capturar | |

> [!atencao] \`case VERMELHO:\` **não** compara com a constante \`VERMELHO\`: é um padrão de captura, que casa com tudo e sobrescreve a variável. Se não for o último \`case\`, é \`SyntaxError\` ("makes remaining patterns unreachable"); se for, o bug é silencioso. Use um nome com ponto: \`case Cor.VERMELHO:\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Onde dataclass e `match` se encontram: **padrões de classe**. `case Ponto(0, y)` checa o tipo e desmonta os atributos.',
          { text: 'E o segredo para os argumentos posicionais funcionarem é um atributo que pouca gente conhece: `__match_args__`.', mood: 'surprised' },
        ],
        board: {
          title: 'Padrões de classe e __match_args__',
          md: `\`\`\`python
from dataclasses import dataclass

@dataclass
class Ponto:
    x: int
    y: int

Ponto.__match_args__             # ('x', 'y') — gerado pelo @dataclass

def onde(p) -> str:
    match p:
        case Ponto(0, 0):                 # posicional: traduzido via __match_args__
            return "origem"
        case Ponto(x=0, y=y):             # por nome: funciona em qualquer classe
            return f"no eixo y, em {y}"
        case Ponto(x, y) if x == y:
            return "na diagonal"
        case Ponto():                     # só isinstance
            return "em algum lugar"
        case int(n) | float(n):           # builtins "self-matching": captura o próprio valor
            return f"número {n}"
    return "não sei"

class Cor:                                # classe comum: sem __match_args__...
    def __init__(self, r, g, b):
        self.r, self.g, self.b = r, g, b

# case Cor(255, 0, 0):  -> TypeError: Cor() accepts 0 positional sub-patterns (3 given)
# solução: __match_args__ = ("r", "g", "b") na classe
\`\`\`

- \`Classe(...)\` = \`isinstance\` + leitura dos atributos. Posicionais viram nomes pela tupla \`__match_args__\`.
- No \`@dataclass\`, campos keyword-only ficam **fora** do \`__match_args__\`; \`match_args=False\` desliga a geração.
- \`bool\`, \`bytearray\`, \`bytes\`, \`dict\`, \`float\`, \`frozenset\`, \`int\`, \`list\`, \`set\`, \`str\` e \`tuple\` são *self-matching*: \`case str(s)\` checa o tipo e captura o objeto inteiro.
- Com uma união de tipos, termine com \`case _: assert_never(evento)\` (\`typing\`, 3.11+): o type checker acusa se aparecer um tipo novo sem \`case\`.

> [!sabia] \`match\` sobre dataclasses × polimorfismo é o **expression problem** (Wadler, 1998). Com métodos nas classes, criar um **tipo** novo é fácil, mas cada **operação** nova mexe em todas as classes. Com \`match\`, é o contrário: uma operação nova é só uma função, e um tipo novo obriga a revisar todos os \`match\`. Conjunto fechado de tipos (eventos, comandos, nós de AST) → \`match\`; conjunto aberto (plugins) → polimorfismo.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Dataclasses imutáveis de verdade e `match` interpretando eventos.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-dc-q1',
        concept: 'Imutabilidade rasa',
        say: 'Aquecimento: uma classe `frozen`, um `replace` e um `append`. O que sai?',
        prompt: `O que este código imprime?

\`\`\`python
from dataclasses import dataclass, field, replace

@dataclass(frozen=True)
class Time:
    nome: str
    membros: list[str] = field(default_factory=list)

dev = Time("dev")
ops = replace(dev, nome="ops")
dev.membros.append("lia")
print(ops.membros)
\`\`\``,
        options: [
          { text: "`['lia']`", correct: true, why: '`replace` passa ao `__init__` os valores atuais dos campos — a **mesma** lista, sem copiar. E `frozen` só impede reatribuir `dev.membros`; mutar a lista que ele aponta continua valendo.' },
          { text: '`[]`', why: 'Seria verdade se `replace` fizesse cópia profunda ou chamasse o `default_factory` de novo. Ele não faz nenhum dos dois: o `default_factory` só roda quando o campo **não** é passado, e o `replace` passa todos.' },
          { text: '`FrozenInstanceError` no `append`', why: '`frozen` intercepta `__setattr__` no objeto `Time` (ex.: `dev.membros = []`). O `append` não reatribui nada: muta a lista, que é um objeto à parte.' },
          { text: '`TypeError` ao definir a classe: `frozen` não aceita campo `list`', why: 'O `@dataclass` não confere isso. O que falharia é `hash(dev)`: com `frozen` + `eq`, o hash é calculado a partir dos campos, e uma `list` não é hashable.' },
        ],
        explanation: '`frozen` é **imutabilidade rasa**: protege os atributos do objeto, não o que eles apontam. E `replace` é uma cópia rasa. Para uma dataclass imutável de verdade, guarde tipos imutáveis (`tuple`, `frozenset`) e converta a entrada no `__post_init__` — é exatamente o que você vai fazer no próximo exercício.',
      },
      {
        type: 'match',
        id: 'py-dc-q2',
        concept: 'Dataclasses',
        say: 'Associe cada peça da caixa de ferramentas do `dataclasses` ao que ela faz.',
        prompt: 'Associe cada recurso do módulo `dataclasses` ao seu efeito.',
        pairs: [
          { left: '`frozen=True`', right: 'Bloqueia atribuições e, com `eq`, gera `__hash__`' },
          { left: '`slots=True`', right: 'Sem `__dict__`: menos memória e nenhum atributo novo' },
          { left: '`field(default_factory=list)`', right: 'Uma lista nova para cada instância' },
          { left: '`field(init=False)`', right: 'Campo derivado, calculado no `__post_init__`' },
          { left: '`_: KW_ONLY`', right: 'Os campos seguintes só podem ser passados por nome' },
          { left: '`InitVar[int]`', right: 'Parâmetro do `__init__` que não vira campo' },
        ],
        explanation: 'Quase tudo é configuração do código **gerado**: o decorator lê as anotações e os `field(...)` e escreve `__init__`, `__eq__`, `__hash__`, `__slots__` e companhia. Conhecer esses ajustes evita escrever à mão o que o `@dataclass` já faz — e evita as armadilhas (default mutável, hash de objeto mutável).',
      },
      {
        type: 'code',
        id: 'py-dc-q3',
        concept: '__post_init__ e imutabilidade',
        title: 'Reserva de sala: validação e imutabilidade',
        points: 45,
        say: 'Primeiro código: uma dataclass que se valida sozinha e não pode ser alterada depois de criada.',
        prompt: `Implemente a dataclass **\`Reserva\`** — **imutável**, com **slots** e **ordenável**:

- \`sala: str\`, \`inicio: int\` e \`fim: int\` (minutos desde 00:00), nessa ordem, posicionais;
- \`participantes\`: **só por nome** (keyword-only), padrão vazio. Aceita qualquer iterável (lista, gerador...) e guarda uma **tupla sem repetições**, na ordem de chegada;
- \`duracao\`: campo **derivado** (\`fim - inicio\`), fora do \`__init__\` e fora da comparação;
- no \`__post_init__\`: \`sala\` sem espaços nas pontas e em **maiúsculas** (vazia → \`ValueError\`); exige \`0 <= inicio < fim <= 1440\` (senão, \`ValueError\`);
- \`adiar(minutos)\` devolve uma **nova** reserva deslocada — e a validação precisa valer para ela (use \`dataclasses.replace\`);
- \`sobrepoe(outra)\`: mesma sala e horários que se cruzam (só encostar, como 600–660 e 660–720, **não** conta).

Reservas iguais precisam ter o mesmo \`hash\` (dá para pô-las num \`set\`), e \`sorted\` ordena por sala, início e fim.`,
        starter: py(`
          from dataclasses import KW_ONLY, dataclass, field, replace


          @dataclass
          class Reserva:  # TODO: imutável, com slots e ordenável
              sala: str
              inicio: int          # minutos desde 00:00 (0 a 1440)
              fim: int
              # TODO: participantes só por nome, padrão vazio
              # TODO: duracao derivada (fora do __init__ e da comparação)

              def __post_init__(self) -> None:
                  pass  # TODO: normalizar e validar

              def adiar(self, minutos: int) -> "Reserva":
                  raise NotImplementedError

              def sobrepoe(self, outra: "Reserva") -> bool:
                  raise NotImplementedError
        `),
        tests: [
          {
            name: 'normaliza a sala, deduplica participantes e calcula a duração',
            code: py(`
              r = Reserva("  sala-1 ", 540, 600, participantes=["ana", "bia", "ana"])
              assert r.sala == "SALA-1", r.sala
              assert r.participantes == ("ana", "bia"), "guarde uma tupla sem repetições, na ordem"
              assert r.duracao == 60
              assert Reserva("b", 0, 30).participantes == ()
            `),
          },
          {
            name: 'valida no __post_init__',
            code: py(`
              def invalida(*args, **kwargs):
                  try:
                      Reserva(*args, **kwargs)
                  except ValueError:
                      return True
                  return False

              assert invalida("   ", 0, 30), "sala vazia"
              assert invalida("a", 60, 60), "o fim precisa vir depois do início"
              assert invalida("a", 90, 60)
              assert invalida("a", -10, 30)
              assert invalida("a", 1400, 1441), "o dia tem 1440 minutos"
              assert not invalida("a", 0, 1440)
            `),
          },
          {
            name: 'frozen, com slots e hashable',
            code: py(`
              import dataclasses

              r = Reserva("a", 0, 30, participantes=["x"])
              try:
                  r.fim = 60
              except dataclasses.FrozenInstanceError:
                  pass
              else:
                  raise AssertionError("a reserva deveria ser frozen")
              assert not hasattr(r, "__dict__"), "use slots=True"
              igual = Reserva(" A", 0, 30, participantes=("x",))
              assert r == igual
              assert len({r, igual}) == 1, "reservas iguais precisam ter o mesmo hash"
            `),
          },
          {
            name: 'participantes só por nome; duracao fora do __init__ e da comparação',
            code: py(`
              import dataclasses

              for args, kwargs in [(("a", 0, 30, ("x",)), {}), (("a", 0, 30), {"duracao": 30})]:
                  try:
                      Reserva(*args, **kwargs)
                  except TypeError:
                      pass
                  else:
                      raise AssertionError(f"Reserva(*{args!r}, **{kwargs!r}) deveria dar TypeError")
              campos = {f.name: f for f in dataclasses.fields(Reserva)}
              assert not campos["duracao"].init and not campos["duracao"].compare
            `),
          },
          {
            name: 'adiar devolve uma cópia revalidada',
            code: py(`
              r = Reserva("a", 540, 600, participantes=["ana"])
              r2 = r.adiar(30)
              assert (r2.inicio, r2.fim, r2.duracao) == (570, 630, 60)
              assert r2.participantes == ("ana",) and r2.sala == "A"
              assert (r.inicio, r.fim) == (540, 600), "adiar não pode alterar a original"
              try:
                  Reserva("a", 1400, 1430).adiar(20)
              except ValueError:
                  pass
              else:
                  raise AssertionError("adiar para depois da meia-noite deveria dar ValueError")
            `),
          },
          {
            name: 'sobrepoe',
            code: py(`
              a = Reserva("a", 600, 660)
              assert a.sobrepoe(Reserva("a", 630, 700))
              assert a.sobrepoe(Reserva(" A ", 540, 720)), "uma contém a outra"
              assert not a.sobrepoe(Reserva("a", 660, 720)), "só encostar não é sobrepor"
              assert not a.sobrepoe(Reserva("a", 540, 600))
              assert not a.sobrepoe(Reserva("b", 600, 660)), "salas diferentes"
            `),
          },
          {
            name: 'ordenação por sala, início e fim',
            hidden: true,
            code: py(`
              rs = [Reserva("b", 0, 10), Reserva("a", 50, 60), Reserva("a", 10, 20), Reserva("a", 10, 15)]
              assert [(r.sala, r.inicio, r.fim) for r in sorted(rs)] == [
                  ("A", 10, 15), ("A", 10, 20), ("A", 50, 60), ("B", 0, 10)]
            `),
          },
          {
            name: 'participantes vindos de um gerador',
            hidden: true,
            code: py(`
              r = Reserva("a", 0, 30, participantes=(n for n in ["x", "y", "x", "z"]))
              assert r.participantes == ("x", "y", "z")
              assert hash(r) == hash(Reserva("a", 0, 30, participantes=["x", "y", "z"]))
            `),
          },
          {
            name: '__match_args__ só com os campos posicionais',
            hidden: true,
            code: py(`
              assert Reserva.__match_args__ == ("sala", "inicio", "fim")
              match Reserva("a", 0, 30):
                  case Reserva("A", inicio, fim):
                      assert (inicio, fim) == (0, 30)
                  case _:
                      raise AssertionError("o padrão Reserva('A', inicio, fim) deveria casar")
            `),
          },
        ],
        reviews: [
          {
            when: m => m.asserts > 0,
            text: 'Não valide com `assert`: com `python -O` todos os asserts somem, e a validação vai junto. Para regra de negócio, `raise ValueError(...)`.',
            concept: 'assert × exceções',
          },
          {
            when: m => m.classes.some(c => c.methods.includes('__init__')),
            text: 'Escrever `__init__` numa dataclass descarta o gerado (e, com ele, a chamada ao `__post_init__`). Deixe o decorator gerar o construtor e coloque validação e normalização no `__post_init__`.',
            concept: '__post_init__',
          },
          {
            when: (m, code) => /def\s+adiar/.test(code) && !/\breplace\s*\(/.test(code),
            text: 'Montar a cópia à mão (`Reserva(self.sala, ...)`) obriga a lembrar de todos os campos — e esquece os que forem criados depois. `dataclasses.replace(self, inicio=..., fim=...)` copia o resto e passa pelo `__init__`, revalidando.',
            concept: 'replace',
          },
        ],
        hints: [
          'Comece pelo decorator: `@dataclass(frozen=True, slots=True, order=True)`. Depois dos três campos posicionais, `_: KW_ONLY` faz `participantes` ser só por nome. O derivado é `duracao: int = field(init=False, compare=False)`.',
          'Numa classe frozen, `self.sala = ...` dentro do `__post_init__` lança `FrozenInstanceError`: use `object.__setattr__(self, "sala", ...)`. `tuple(dict.fromkeys(iteravel))` remove repetições mantendo a ordem — e a tupla deixa o objeto hashable.',
          '`adiar`: `return replace(self, inicio=self.inicio + minutos, fim=self.fim + minutos)` — o `replace` chama o `__init__`, que chama o `__post_init__`. `sobrepoe`: dois intervalos meio-abertos se cruzam quando `self.inicio < outra.fim and outra.inicio < self.fim`.',
        ],
        solution: py(`
          from dataclasses import KW_ONLY, dataclass, field, replace

          MINUTOS_NO_DIA = 24 * 60


          @dataclass(frozen=True, slots=True, order=True)
          class Reserva:
              sala: str
              inicio: int          # minutos desde 00:00 (0 a 1440)
              fim: int
              _: KW_ONLY
              participantes: tuple[str, ...] = ()
              duracao: int = field(init=False, compare=False)

              def __post_init__(self) -> None:
                  sala = self.sala.strip().upper()
                  if not sala:
                      raise ValueError("a sala não pode ser vazia")
                  if not 0 <= self.inicio < self.fim <= MINUTOS_NO_DIA:
                      raise ValueError(f"horário inválido: {self.inicio}-{self.fim}")
                  # frozen: a atribuição normal lança FrozenInstanceError
                  object.__setattr__(self, "sala", sala)
                  object.__setattr__(self, "participantes", tuple(dict.fromkeys(self.participantes)))
                  object.__setattr__(self, "duracao", self.fim - self.inicio)

              def adiar(self, minutos: int) -> "Reserva":
                  return replace(self, inicio=self.inicio + minutos, fim=self.fim + minutos)

              def sobrepoe(self, outra: "Reserva") -> bool:
                  return self.sala == outra.sala and self.inicio < outra.fim and outra.inicio < self.fim
        `),
        solutionExplanation: 'O decorator faz o trabalho pesado: `frozen=True` bloqueia atribuições e, junto com `eq`, gera o `__hash__`; `slots=True` tira o `__dict__`; `order=True` compara `(sala, inicio, fim, participantes)` como tupla — `duracao` fica de fora por `compare=False`. O `_: KW_ONLY` torna `participantes` keyword-only e, de quebra, o deixa fora do `__match_args__`. No `__post_init__`, a validação vem **antes** de qualquer ajuste, e os ajustes usam `object.__setattr__`, o caminho documentado para classes frozen. Converter `participantes` para tupla não é detalhe: sem isso, o objeto "imutável" guardaria uma lista mutável (imutabilidade rasa) e o `hash` quebraria. Por fim, `adiar` usa `replace`, que passa pelo `__init__` — então nenhuma cópia escapa da validação.',
      },
      {
        type: 'mcq',
        id: 'py-dc-q4',
        concept: 'Pattern matching estrutural',
        say: 'Agora o `match`. Siga os `case` de cima para baixo, com calma.',
        prompt: `O que este código imprime?

\`\`\`python
def classificar(msg):
    match msg:
        case {"tipo": "clique", "pos": [x, y]} if x == y:
            return "diagonal"
        case {"tipo": "clique", "pos": [x, y]}:
            return f"clique {x},{y}"
        case {"tipo": "tecla", "tecla": str() as t} if len(t) == 1:
            return "tecla " + t
        case [str(), *_]:
            return "lista de textos"
        case str():
            return "texto"
        case _:
            return "?"

print(classificar({"tipo": "clique", "pos": (2, 3), "id": 9}),
      classificar("ok"),
      classificar({"tipo": "tecla", "tecla": "enter"}))
\`\`\``,
        options: [
          { text: '`clique 2,3 texto ?`', correct: true, why: 'O mapeamento casa mesmo com a chave extra `"id"`, e a tupla `(2, 3)` casa com `[x, y]` (qualquer sequência serve); a guarda `x == y` falha, então vence o segundo `case`. `"ok"` pula o padrão de sequência (strings não contam) e cai em `str()`. `"enter"` reprova na guarda e só o `_` sobra.' },
          { text: '`clique 2,3 lista de textos ?`', why: 'Uma `str` **não** casa com padrões de sequência, justamente para `case [a, b]` não desmontar `"ok"` em letras. Por isso ela chega até `case str()`.' },
          { text: '`? texto ?`', why: 'Padrões de mapeamento são **parciais**: chaves extras como `"id"` são ignoradas. E `[x, y]` casa com qualquer sequência de dois itens, inclusive a tupla `(2, 3)` — colchetes ou parênteses no padrão dão no mesmo.' },
          { text: '`clique 2,3 texto tecla enter`', why: 'Quando a guarda é falsa, o `case` inteiro é descartado e o `match` segue para os próximos. `"enter"` tem 5 caracteres, então não passa em `len(t) == 1`.' },
        ],
        explanation: 'O `match` testa os `case` **em ordem** e para no primeiro que casa com a estrutura **e** passa na guarda. Três regras explicam a saída: padrões de mapeamento ignoram chaves extras; padrões de sequência aceitam qualquer `Sequence` (lista, tupla...), menos `str`, `bytes` e `bytearray`; e a guarda falsa só descarta aquele `case`.',
      },
      {
        type: 'code',
        id: 'py-dc-q5',
        concept: 'Pattern matching estrutural',
        title: 'Interpretador de eventos bancários',
        points: 50,
        say: 'Agora o `match` em ação: transforme mensagens JSON em eventos e aplique-os aos saldos. Parse, don\'t validate!',
        prompt: `Um serviço recebe mensagens JSON (já convertidas em \`dict\`) de uma fila. Os eventos — dataclasses \`frozen\` com slots — já estão no código. Implemente as duas funções usando \`match\`.

**\`decodificar(msg)\`** — com padrões de **mapeamento**:

| Mensagem | Evento |
|---|---|
| \`{"tipo": "deposito", "conta": str, "valor": int}\` | \`Deposito(conta, valor)\` |
| \`{"tipo": "saque", "conta": str, "valor": int}\` | \`Saque(conta, valor)\` |
| \`{"tipo": "transferencia", "de": str, "para": str, "valor": int}\` | \`Transferencia(de, para, valor)\`, com contas **diferentes** |
| \`{"tipo": "lote", "eventos": [msg, ...]}\` (uma \`list\`) | \`Lote(tupla com cada mensagem decodificada)\` |

- \`valor\` precisa ser um \`int\` **positivo** — e \`bool\` não vale (\`True\` é um \`int\`!).
- Chaves extras (ex.: \`"id"\`) são ignoradas. Qualquer outra coisa → \`ValueError\`.

**\`aplicar(saldos, evento)\`** — com padrões de **classe**. Devolve um **novo** \`dict\` (nunca altere o recebido):
- depósito soma (conta nova começa em 0); saque e transferência exigem saldo suficiente, senão \`ValueError\`;
- \`Lote\` aplica os eventos em ordem e é **atômico**: se um falhar, a exceção sobe e nada muda;
- um objeto que não é evento → \`TypeError\`.`,
        starter: py(`
          from dataclasses import dataclass


          @dataclass(frozen=True, slots=True)
          class Deposito:
              conta: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Saque:
              conta: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Transferencia:
              origem: str
              destino: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Lote:
              eventos: tuple


          def decodificar(msg):
              """dict vindo do JSON -> evento. ValueError se a mensagem for inválida."""
              raise NotImplementedError


          def aplicar(saldos, evento):
              """Devolve um NOVO dict de saldos com o evento aplicado."""
              raise NotImplementedError
        `),
        tests: [
          {
            name: 'decodifica os três tipos (ignorando chaves extras)',
            code: py(`
              assert decodificar({"tipo": "deposito", "conta": "ana", "valor": 100}) == Deposito("ana", 100)
              assert decodificar({"tipo": "saque", "conta": "bia", "valor": 5, "id": "e-42"}) == Saque("bia", 5)
              assert decodificar({"tipo": "transferencia", "de": "ana", "para": "bia", "valor": 30}) == \\
                  Transferencia("ana", "bia", 30)
            `),
          },
          {
            name: 'rejeita mensagens inválidas com ValueError',
            code: py(`
              def rejeita(msg):
                  try:
                      decodificar(msg)
                  except ValueError:
                      return True
                  return False

              assert rejeita({"tipo": "deposito", "conta": "ana", "valor": 0}), "valor zero"
              assert rejeita({"tipo": "deposito", "conta": "ana", "valor": -5}), "valor negativo"
              assert rejeita({"tipo": "deposito", "conta": "ana", "valor": "10"}), "valor como texto"
              assert rejeita({"tipo": "deposito", "conta": "ana"}), "faltou o valor"
              assert rejeita({"tipo": "saque", "conta": 7, "valor": 10}), "conta precisa ser str"
              assert rejeita({"tipo": "pix", "conta": "ana", "valor": 10}), "tipo desconhecido"
              assert rejeita({"tipo": "transferencia", "de": "ana", "para": "ana", "valor": 10}), "mesma conta"
              assert rejeita(["deposito", "ana", 10]), "não é um dict"
              assert rejeita("deposito ana 10"), "não é um dict"
            `),
          },
          {
            name: 'aplica depósito, saque e transferência sem mutar a entrada',
            code: py(`
              saldos = {"ana": 100}
              depois = aplicar(saldos, Deposito("bia", 50))
              assert depois == {"ana": 100, "bia": 50}
              assert aplicar(depois, Saque("ana", 40)) == {"ana": 60, "bia": 50}
              assert aplicar(depois, Transferencia("ana", "bia", 100)) == {"ana": 0, "bia": 150}
              assert aplicar(depois, Transferencia("bia", "caio", 20)) == {"ana": 100, "bia": 30, "caio": 20}
              assert saldos == {"ana": 100}, "aplicar não pode alterar o dict recebido"
            `),
          },
          {
            name: 'saldo insuficiente dá ValueError',
            code: py(`
              def falha(saldos, evento):
                  try:
                      aplicar(saldos, evento)
                  except ValueError:
                      return True
                  return False

              saldos = {"ana": 10}
              assert falha(saldos, Saque("ana", 11))
              assert falha(saldos, Saque("bia", 1)), "conta inexistente tem saldo 0"
              assert falha(saldos, Transferencia("ana", "bia", 50))
              assert saldos == {"ana": 10}
              assert aplicar(saldos, Saque("ana", 10)) == {"ana": 0}, "sacar o saldo exato pode"
            `),
          },
          {
            name: 'bool e float não são valores válidos',
            hidden: true,
            code: py(`
              for valor in [True, 10.0, None]:
                  try:
                      decodificar({"tipo": "saque", "conta": "ana", "valor": valor})
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"valor={valor!r} deveria dar ValueError")
            `),
          },
          {
            name: 'lote: decodifica e aplica de forma atômica',
            hidden: true,
            code: py(`
              lote = decodificar({"tipo": "lote", "eventos": [
                  {"tipo": "deposito", "conta": "ana", "valor": 100},
                  {"tipo": "transferencia", "de": "ana", "para": "bia", "valor": 30},
              ]})
              assert lote == Lote((Deposito("ana", 100), Transferencia("ana", "bia", 30)))
              assert aplicar({}, lote) == {"ana": 70, "bia": 30}

              ruim = Lote((Deposito("ana", 100), Saque("ana", 500)))
              saldos = {"ana": 10}
              try:
                  aplicar(saldos, ruim)
              except ValueError:
                  pass
              else:
                  raise AssertionError("o saque sem saldo deveria derrubar o lote inteiro")
              assert saldos == {"ana": 10}

              try:
                  decodificar({"tipo": "lote", "eventos": [{"tipo": "deposito", "conta": "a", "valor": 1}, {"tipo": "?"}]})
              except ValueError:
                  pass
              else:
                  raise AssertionError("uma mensagem inválida invalida o lote")
            `),
          },
          {
            name: 'lote aninhado e lote vazio',
            hidden: true,
            code: py(`
              lote = decodificar({"tipo": "lote", "eventos": [
                  {"tipo": "deposito", "conta": "ana", "valor": 10},
                  {"tipo": "lote", "eventos": [{"tipo": "saque", "conta": "ana", "valor": 4}]},
              ]})
              assert lote == Lote((Deposito("ana", 10), Lote((Saque("ana", 4),))))
              assert aplicar({}, lote) == {"ana": 6}
              assert decodificar({"tipo": "lote", "eventos": []}) == Lote(())
              assert aplicar({"x": 1}, Lote(())) == {"x": 1}
            `),
          },
          {
            name: 'objeto que não é evento dá TypeError',
            hidden: true,
            code: py(`
              for coisa in ["deposito", {"tipo": "deposito", "conta": "ana", "valor": 1}, None]:
                  try:
                      aplicar({}, coisa)
                  except TypeError:
                      pass
                  else:
                      raise AssertionError(f"aplicar({{}}, {coisa!r}) deveria dar TypeError")
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => (code.match(/^\s*match\s/gm) || []).length < 2,
            text: 'Resolver com cadeias de `if` funciona, mas o `match` faz em uma linha o que exigiria vários testes: confere o tipo, a presença das chaves, o formato e ainda extrai as partes. Use-o nas duas funções.',
            concept: 'Pattern matching estrutural',
          },
          {
            when: (m, code) => (code.match(/\bisinstance\s*\(/g) || []).length >= 3,
            text: 'Uma escada de `isinstance` é o que os padrões de classe substituem: `case Saque(conta, valor):` checa o tipo **e** desmonta os campos via `__match_args__`.',
            concept: '__match_args__',
          },
          {
            when: (m, code) => /\[\s*["']tipo["']\s*\]|\.get\(\s*["']tipo["']/.test(code),
            text: 'Ler `msg["tipo"]`/`msg.get("tipo")` e depois conferir cada chave à mão é o que o padrão de mapeamento faz de uma vez: `case {"tipo": "saque", "conta": str(conta), "valor": valor}` exige as chaves, checa os tipos e captura os valores.',
            concept: 'Padrões de mapeamento',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Não precisa capturar exceções para "desfazer" um lote: como `aplicar` nunca muta o dict recebido, basta deixar o erro subir — a atomicidade sai de graça da imutabilidade.',
            concept: 'Imutabilidade',
          },
        ],
        hints: [
          'Um padrão de classe cabe dentro do mapeamento: `case {"tipo": "deposito", "conta": str(conta), "valor": valor} if _valor_ok(valor):` exige as chaves, checa que `conta` é `str` e captura tudo. Chaves extras passam sozinhas. Termine com `case _: raise ValueError(...)`.',
          'Cuidado: `int(v)` também casa `True`, porque `bool` herda de `int`. Por isso a guarda usa `type(v) is int and v > 0`. Para o lote: `case {"tipo": "lote", "eventos": list(mensagens)}` e `Lote(tuple(decodificar(m) for m in mensagens))`.',
          'Em `aplicar`, comece com `novo = dict(saldos)`. `case Saque(conta, valor) if novo.get(conta, 0) >= valor:` usa o `__match_args__`; logo depois, `case Saque() | Transferencia(): raise ValueError(...)` pega os sem saldo. No lote, `novo = aplicar(novo, e)` para cada evento. Por último, `case _: raise TypeError(...)`.',
        ],
        solution: py(`
          from dataclasses import dataclass


          @dataclass(frozen=True, slots=True)
          class Deposito:
              conta: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Saque:
              conta: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Transferencia:
              origem: str
              destino: str
              valor: int


          @dataclass(frozen=True, slots=True)
          class Lote:
              eventos: tuple


          def _valor_ok(valor) -> bool:
              return type(valor) is int and valor > 0      # bool herda de int: barre explicitamente


          def decodificar(msg):
              """dict vindo do JSON -> evento. ValueError se a mensagem for inválida."""
              match msg:
                  case {"tipo": "deposito", "conta": str(conta), "valor": valor} if _valor_ok(valor):
                      return Deposito(conta, valor)
                  case {"tipo": "saque", "conta": str(conta), "valor": valor} if _valor_ok(valor):
                      return Saque(conta, valor)
                  case {"tipo": "transferencia", "de": str(origem), "para": str(destino), "valor": valor} if (
                      origem != destino and _valor_ok(valor)
                  ):
                      return Transferencia(origem, destino, valor)
                  case {"tipo": "lote", "eventos": list(mensagens)}:
                      return Lote(tuple(decodificar(m) for m in mensagens))
                  case _:
                      raise ValueError(f"mensagem inválida: {msg!r}")


          def aplicar(saldos, evento):
              """Devolve um NOVO dict de saldos com o evento aplicado."""
              novo = dict(saldos)
              match evento:
                  case Deposito(conta, valor):
                      novo[conta] = novo.get(conta, 0) + valor
                  case Saque(conta, valor) if novo.get(conta, 0) >= valor:
                      novo[conta] -= valor
                  case Transferencia(origem, destino, valor) if novo.get(origem, 0) >= valor:
                      novo[origem] -= valor
                      novo[destino] = novo.get(destino, 0) + valor
                  case Saque() | Transferencia():
                      raise ValueError(f"saldo insuficiente para {evento!r}")
                  case Lote(eventos):
                      for e in eventos:
                          novo = aplicar(novo, e)          # cada passo gera um dict novo
                  case _:
                      raise TypeError(f"não é um evento: {evento!r}")
              return novo
        `),
        solutionExplanation: '`decodificar` é o "parse, don\'t validate" em ação: cada `case` de mapeamento exige as chaves certas, checa os tipos com padrões de classe (`str(conta)`) e captura os valores; as guardas cuidam do que o formato não expressa (valor positivo, contas diferentes). O `bool` precisa ser barrado à parte porque `True` é um `int` — `type(v) is int` resolve. Depois disso, o resto do sistema recebe um `Deposito` e não precisa checar mais nada. Em `aplicar`, os padrões de classe usam o `__match_args__` gerado pelo `@dataclass` para desmontar os eventos, e a ordem dos `case` importa: primeiro os casos com saldo, depois `Saque() | Transferencia()` para os que sobraram. Como cada passo gera um dict novo, o `Lote` é atômico sem `try`/rollback: se algo falha, o dict original nunca foi tocado.',
      },
      {
        type: 'open',
        id: 'py-dc-q6',
        concept: 'dataclass × NamedTuple × pydantic',
        say: 'Última: uma pergunta de code review que separa quem conhece as ferramentas de quem só usa a primeira que aparece.',
        prompt: 'Num code review, alguém pergunta: "Por que `@dataclass` aqui, e não `NamedTuple` ou pydantic?". O serviço recebe JSON de uma API externa e o transforma em objetos de domínio. Compare as três opções e diga onde cada uma se encaixa.',
        minWords: 40,
        rubric: [
          { label: 'pydantic (ou attrs) **valida e converte** dados na fronteira (JSON externo)', keywords: ['pydantic', 'valida', 'convert', 'converte', 'conversao', 'coer', 'fronteira', 'borda', 'entrada externa', 'dados externos'], concept: 'Parse, don\'t validate', why: 'A entrada externa não é confiável: é ali que vale pagar pela validação automática.' },
          { label: '`NamedTuple` **é uma tupla**: imutável, indexável, desempacotável — e igual a qualquer tupla com os mesmos valores', keywords: ['tupla', 'tuple', 'desempacot', 'unpack', 'indice', 'indexa', 'posicional', 'posicao'], concept: 'NamedTuple', why: 'Ser tupla é vantagem (leve, desempacota) e risco (`Ponto(1, 2) == Tamanho(1, 2)`).' },
          { label: '`@dataclass` para o **domínio interno**: stdlib, sem validação automática (só o que você escreve no `__post_init__`)', keywords: ['dominio', 'interno', 'post_init', 'stdlib', 'biblioteca padrao', 'sem validacao', 'nao valida', 'value object', 'objeto de valor', 'entidade'], concept: 'Dataclass', why: 'Classe comum, sem dependência, com o comportamento e as invariantes do domínio.' },
          { label: 'Trade-offs: dependência externa, custo de validação e acoplamento do domínio à biblioteca', keywords: ['dependencia', 'acopl', 'custo', 'desempenho', 'performance', 'overhead', 'pacote externo', 'biblioteca externa', 'terceiro'], concept: 'Trade-offs', why: 'Espalhar modelos pydantic pelo domínio amarra o núcleo do sistema a uma biblioteca e paga validação onde o dado já é confiável.' },
        ],
        modelAnswer: `Eu usaria as três, cada uma no seu lugar.

Na fronteira, onde chega o JSON da API externa, o pydantic (ou attrs com validadores) faz sentido: ele valida e converte os dados automaticamente — "7" vira 7, campo faltando vira erro claro. É o "parse, don't validate": a entrada não confiável vira um tipo com garantias.

Dentro do domínio, uso @dataclass: é stdlib, gera __init__, __eq__ e __repr__, e as invariantes do negócio ficam no __post_init__ (com frozen=True para value objects). Não há validação automática de tipos, mas ali o dado já foi validado na borda.

NamedTuple é uma tupla: imutável, indexável e desempacotável, ótima para um retorno leve de função. O risco é que ela é igual a qualquer tupla com os mesmos valores (Ponto(1, 2) == Tamanho(1, 2)), então não serve bem como objeto de domínio.

O trade-off de usar pydantic em tudo é a dependência externa e o acoplamento do domínio à biblioteca, além do custo de validar de novo dados que já são confiáveis.`,
      },
      {
        type: 'say',
        mood: 'cheer',
        text: [
          'Unidade de tipos concluída! Default mutável, `frozen` raso, `__post_init__`, `replace`, `__match_args__` e um interpretador de eventos inteiro.',
          'A regra de ouro: **parse** na fronteira, dados imutáveis no domínio e `match` para desmontá-los. Obrigada pela companhia — até a próxima!',
        ],
        board: null,
      },
    ],
  });
})();
