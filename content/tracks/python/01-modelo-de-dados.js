(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'modelo-de-dados',
    title: 'O modelo de dados',
    kind: 'lesson',
    level: 2,
    order: 1,
    unit: 'objetos',
    summary: 'Os métodos especiais (dunders) que fazem `print`, `==`, `in`, `for`, `if` e `+` funcionarem nas suas classes — e a armadilha do `__eq__` que apaga o `__hash__`.',
    concepts: ['Dunder methods', '__eq__ e __hash__', 'Protocolo de sequência', 'NotImplemented', 'total_ordering'],
    takeaways: [
      'O Python não chama `obj.len()`: a sintaxe (`len`, `==`, `in`, `for`, `+`) aciona **métodos especiais** procurados no **tipo** do objeto — é o *modelo de dados*.',
      '`__repr__` é para devs (sem ambiguidade, de preferência `Classe(args)`); `__str__` é para usuários. Sem `__str__`, o `str()` usa o `__repr__` — e contêineres sempre mostram o `repr` dos itens.',
      'Definir `__eq__` **apaga** o `__hash__` herdado (vira `None`). Iguais precisam de hashes iguais: escreva `__hash__` com os **mesmos campos** — e só em objetos imutáveis.',
      'Só `__getitem__` já torna a classe iterável e habilita `in` (protocolo de sequência), mas `isinstance(x, Iterable)` diz `False`: para saber se algo itera, chame `iter(x)`.',
      'Operador que não sabe lidar com o outro tipo **devolve** `NotImplemented` (não lança `NotImplementedError`): o Python tenta o método refletido (`__radd__`) e só então dá `TypeError`.',
    ],
    glossary: [
      { term: 'Dunder method', aliases: ['dunder', 'dunders', 'dunder methods', 'método especial', 'métodos especiais', 'método mágico', 'métodos mágicos', 'magic methods'], definition: 'Método com dois sublinhados antes e depois do nome (*double underscore*), como `__len__` e `__eq__`. Você não os chama diretamente: a sintaxe da linguagem (`len(x)`, `a == b`) os aciona.' },
      { term: 'Modelo de dados', aliases: ['data model', 'modelo de dados do Python'], definition: 'A especificação de quais métodos especiais o interpretador procura para cada operação da linguagem. Implementá-los faz suas classes se comportarem como os tipos nativos.' },
      { term: 'NotImplemented', aliases: ['sentinela NotImplemented'], definition: 'Singleton que um método de operador binário (`__add__`, `__eq__`, `__lt__`…) **devolve** para dizer "não sei operar com esse tipo". O Python então tenta o método refletido do outro operando. Não confunda com a exceção `NotImplementedError`.' },
      { term: 'Método refletido', aliases: ['métodos refletidos', 'operando refletido', 'operador refletido', 'reflected method'], definition: 'Versão "da direita" de um operador (`__radd__`, `__rmul__`…): em `a + b`, se `a.__add__(b)` devolve `NotImplemented`, o Python tenta `b.__radd__(a)`.' },
      { term: 'Protocolo de sequência', aliases: ['sequence protocol', 'protocolo de iteração legado'], definition: 'Regra antiga, ainda válida: sem `__iter__`, o `iter()` chama `__getitem__(0)`, `__getitem__(1)`… até um `IndexError`. Por isso só `__getitem__` já torna um objeto iterável.' },
      { term: 'Hashable', aliases: ['hasheável', 'hasheáveis', 'hashável', 'hasháveis', 'unhashable'], definition: 'Objeto com hash estável durante toda a vida e coerente com `__eq__` (iguais ⇒ hashes iguais). Só objetos hashable podem ser chaves de `dict` ou elementos de `set`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) ao Python por dentro! Primeira pergunta: por que `len(x)` e não `x.len()`?',
          'A resposta é o **modelo de dados**: a sintaxe da linguagem chama métodos especiais — os *dunders* — que você mesmo pode implementar.',
        ],
        board: {
          title: 'A sintaxe chama métodos especiais',
          md: `| Você escreve | O Python chama |
|---|---|
| \`len(x)\` | \`type(x).__len__(x)\` |
| \`x[i]\` / \`x[a:b]\` | \`__getitem__(i)\` / \`__getitem__(slice(a, b))\` |
| \`a == b\` | \`a.__eq__(b)\` |
| \`a + b\` | \`a.__add__(b)\` (ou \`b.__radd__(a)\`) |
| \`x in c\` | \`c.__contains__(x)\` |
| \`for v in c\` | \`iter(c)\` → \`c.__iter__()\` |
| \`if x:\` | \`x.__bool__()\` (ou \`__len__\`) |
| \`print(x)\` / \`repr(x)\` | \`__str__\` / \`__repr__\` |
| \`{x}\` / \`d[x]\` | \`x.__hash__()\` + \`__eq__\` |
| \`with x:\` | \`__enter__\` / \`__exit__\` |

Implementando esses métodos, sua classe passa a funcionar com \`sorted\`, \`sum\`, \`set\`, \`for\`, \`print\`… sem que ninguém precise conhecer a API dela. É por isso que o Python prefere funções como \`len()\`: **um protocolo**, muitos tipos.

> [!sabia] O Python procura os dunders no **tipo**, não na instância: \`obj.__len__ = lambda: 42\` não muda o que \`len(obj)\` devolve. Esse atalho direto no tipo deixa as operações rápidas e impede que um atributo qualquer da instância "sequestre" um operador.`,
        },
      },
      {
        type: 'say',
        text: [
          'Comecemos pelo que mais aparece em log de erro: `__repr__` e `__str__`.',
          'Regra de bolso: `__repr__` é para **devs**, `__str__` é para **usuários**.',
        ],
        board: {
          title: '__repr__ × __str__',
          md: `\`\`\`python
from decimal import Decimal

class Dinheiro:
    def __init__(self, valor, moeda="BRL"):
        self.valor = Decimal(str(valor))
        self.moeda = moeda

    def __repr__(self):                  # para devs: sem ambiguidade
        return f"{type(self).__name__}({str(self.valor)!r}, {self.moeda!r})"

    def __str__(self):                   # para usuários: legível
        return f"{self.moeda} {self.valor:.2f}"


d = Dinheiro("10.5")
print(d)          # BRL 10.50                  -> __str__
print(repr(d))    # Dinheiro('10.5', 'BRL')    -> __repr__ (REPL, debugger, logs)
print([d])        # [Dinheiro('10.5', 'BRL')]  -> contêineres usam o repr dos itens!
print(f"{d!r}")   # força o repr numa f-string
print(f"{d=}")    # d=Dinheiro('10.5', 'BRL')  -> o "=" também usa repr
\`\`\`

- Sem \`__str__\`, \`str(x)\` e \`print(x)\` usam o \`__repr__\`. O contrário **não** vale — se for escrever só um, escreva o \`__repr__\`.
- Meta do \`__repr__\`: ser inequívoco e, se possível, valer \`eval(repr(x)) == x\`. Quando não der, use o estilo \`<Conexao host='db' aberta>\`.
- \`type(self).__name__\` em vez do nome fixo: subclasses aparecem com o próprio nome.
- Formatos como \`f"{d:>12}"\` passam por um terceiro método, o \`__format__\`.

> [!dica] Um bom \`__repr__\` é o melhor amigo de quem lê log às 3h da manhã: \`Pedido(id=42, status='pago')\` diz muito mais que \`<Pedido object at 0x7f3a…>\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora a pegadinha favorita das entrevistas: o que acontece quando você define `__eq__`?',
          'O Python **apaga** o `__hash__` da classe. Suas instâncias deixam de caber em `set` e em chaves de `dict`!',
        ],
        board: {
          title: 'Definir __eq__ apaga o __hash__',
          md: `\`\`\`python
class Ponto:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, outro):
        if not isinstance(outro, Ponto):
            return NotImplemented        # "não sei comparar" — não é False!
        return (self.x, self.y) == (outro.x, outro.y)


Ponto(1, 2) == Ponto(1, 2)   # True
Ponto.__hash__               # None   <- sumiu!
{Ponto(1, 2)}                # TypeError: unhashable type: 'Ponto'
\`\`\`

Por quê? O **contrato de hash**: se \`a == b\`, então \`hash(a) == hash(b)\`. O hash herdado de \`object\` vem da **identidade**; com igualdade por valor, dois pontos iguais cairiam em "baldes" diferentes do \`set\` e apareceriam duplicados. Em vez de deixar esse bug silencioso, o Python torna a classe *unhashable*.

| Sua classe | O que fazer |
|---|---|
| igualdade por identidade (padrão) | não defina \`__eq__\` nem \`__hash__\` |
| igualdade por valor, **imutável** | \`__eq__\` + \`__hash__\` com os **mesmos campos** |
| igualdade por valor, **mutável** | só \`__eq__\` (deixe unhashable) |

E o \`NotImplemented\` no \`__eq__\`? Ele deixa o **outro lado** responder. Se ninguém souber, o Python cai na identidade (\`is\`) — sem erro. É o que faz \`Ponto(1, 2) == mock.ANY\` dar \`True\`; com \`return False\`, daria \`False\`.

> [!dica] \`@dataclass(frozen=True)\` gera \`__eq__\` e \`__hash__\` coerentes. Com \`@dataclass\` comum (mutável), o \`__hash__\` fica \`None\` — pelo mesmo motivo.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E por que só em objetos **imutáveis**? Porque o hash é calculado uma vez, na hora de guardar.',
          'Se os campos mudam depois, o objeto fica perdido dentro do `set`: está lá, mas ninguém o encontra.',
        ],
        board: {
          title: 'Hash + mutação = objeto perdido',
          md: `\`\`\`python
class Ponto:
    ...                                  # __eq__ como antes
    def __hash__(self):
        return hash((self.x, self.y))    # os MESMOS campos do __eq__


p = Ponto(1, 2)
visitados = {p}
p.x = 99                     # mutou DEPOIS de guardar no set

p in visitados               # False  (procura no balde do hash novo)
Ponto(1, 2) in visitados     # False  (acha o balde antigo, mas o objeto mudou)
len(visitados)               # 1      -> está lá, mas é inalcançável
\`\`\`

\`\`\`text
 set por dentro (simplificado)
 balde de hash((1, 2)) -> [p]        <- p mora aqui, com x = 99 agora
 balde de hash((99, 2)) -> []        <- é aqui que "p in visitados" procura
\`\`\`

Regras práticas:

- \`__hash__\` usa **só** campos que participam do \`__eq__\` (pode ser um subconjunto imutável deles, como um id).
- Hash **não** precisa ser único — colisões são normais; só precisa ser igual para objetos iguais e estável no tempo.
- Delegue: \`hash((campo1, campo2))\` combina bem os campos. Nada de inventar fórmula com \`^\` ou \`*\`.

> [!sabia] No CPython, \`hash(-1) == -2\`. Na API em C, \`-1\` sinaliza "deu erro", então nenhum objeto pode ter hash \`-1\` — e \`hash(-1) == hash(-2)\` é uma colisão garantida. Um lembrete de que hash não é identificador único.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Para ordenar, você precisaria de `<`, `<=`, `>` e `>=`. Escrever os quatro à mão é chato e fácil de errar.',
          'O `functools.total_ordering` completa o conjunto a partir de `__eq__` e **um** deles.',
        ],
        board: {
          title: 'Ordenação: total_ordering',
          md: `\`\`\`python
from functools import total_ordering

@total_ordering                     # gera <=, > e >= a partir de == e <
class Versao:
    def __init__(self, texto):
        self.partes = tuple(int(p) for p in texto.split("."))

    def __eq__(self, outro):
        if not isinstance(outro, Versao):
            return NotImplemented
        return self.partes == outro.partes

    def __lt__(self, outro):
        if not isinstance(outro, Versao):
            return NotImplemented
        return self.partes < outro.partes

    def __hash__(self):
        return hash(self.partes)


Versao("1.10.0") > Versao("1.9.3")    # True   (como texto, "1.10" < "1.9"!)
Versao("2.0") >= Versao("2.0")        # True   (__ge__ gerado)
\`\`\`

- \`@total_ordering\` exige \`__eq__\` + um entre \`__lt__\`, \`__le__\`, \`__gt__\`, \`__ge__\`.
- Custo: os métodos gerados fazem uma chamada extra. Num laço quente, escreva os quatro.
- \`sorted()\` e \`list.sort()\` só usam \`<\` — para ordenar, \`__lt__\` basta.
- Critério pontual? Prefira \`key=\`: \`sorted(pedidos, key=attrgetter("data"))\` não obriga a classe a ter uma "ordem natural".
- \`@dataclass(order=True)\` compara como **tupla dos campos**, na ordem em que foram declarados.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora contêineres. Quer ver algo curioso? Uma classe **só com `__getitem__`** já funciona num `for`.',
          'É o protocolo de sequência — mais antigo que o próprio `__iter__`, e ainda vivo.',
        ],
        board: {
          title: 'Protocolo de sequência, __contains__ e __bool__',
          md: `\`\`\`python
class Playlist:
    def __init__(self, musicas):
        self._musicas = list(musicas)

    def __len__(self):
        return len(self._musicas)

    def __getitem__(self, i):          # recebe int OU slice
        return self._musicas[i]


p = Playlist(["intro", "refrão", "final"])
p[0], p[-1], p[1:]         # 'intro', 'final', ['refrão', 'final']
for m in p: ...            # funciona — sem __iter__!
"refrão" in p              # True — sem __contains__ (busca linear)
list(reversed(p))          # ['final', 'refrão', 'intro'] (usa __len__ + __getitem__)
if p: ...                  # sem __bool__, usa __len__ (0 é falso)
\`\`\`

\`\`\`text
iter(p)  -> sem __iter__?     chama __getitem__(0), (1), (2)... até IndexError
x in p   -> sem __contains__? itera comparando cada item com ==
bool(p)  -> sem __bool__?     usa __len__() != 0; sem nenhum dos dois: sempre True
\`\`\`

- Escreva \`__contains__\` quando der para fazer melhor que busca linear (ex.: um \`set\` interno → O(1)).
- \`__bool__\` precisa devolver \`bool\`; \`__len__\`, um \`int >= 0\`.
- Quer que \`p[1:]\` devolva uma \`Playlist\`? Teste \`isinstance(i, slice)\` no \`__getitem__\`.

> [!sabia] Esse fallback é o **protocolo de sequência**, anterior ao \`__iter__\` (que só chegou no Python 2.2). Ele engana \`isinstance(p, collections.abc.Iterable)\`, que devolve \`False\` porque só procura \`__iter__\`. A própria documentação avisa: o jeito confiável de saber se algo é iterável é chamar \`iter(x)\`.

> [!atencao] \`if not resultado:\` trata \`None\`, \`0\`, \`""\` e contêiner vazio do mesmo jeito. Se "vazio" e "ausente" significam coisas diferentes, escreva \`if resultado is None:\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, operadores. O segredo de um operador bem-educado é saber dizer "não sei" — devolvendo `NotImplemented`.',
          'Aí o Python dá a vez para o outro operando, pelo **método refletido**.',
        ],
        board: {
          title: 'Operadores, métodos refletidos e NotImplemented',
          md: `\`\`\`python
class Vetor:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, outro):                # Vetor + Vetor
        if not isinstance(outro, Vetor):
            return NotImplemented            # "não sei" -> o outro lado tenta
        return Vetor(self.x + outro.x, self.y + outro.y)

    def __mul__(self, k):                    # Vetor * 3
        if not isinstance(k, (int, float)):
            return NotImplemented
        return Vetor(self.x * k, self.y * k)

    __rmul__ = __mul__                       # 3 * Vetor: int não sabe, cai aqui

    def __repr__(self):
        return f"Vetor({self.x}, {self.y})"
\`\`\`

\`\`\`text
a + b
 |- a.__add__(b)   -> resultado? pronto
 |     '- NotImplemented
 |- b.__radd__(a)  -> resultado? pronto
 |     '- NotImplemented
 '- TypeError: unsupported operand type(s) for +
\`\`\`

| Situação | O que fazer |
|---|---|
| tipo que você não conhece | \`return NotImplemented\` |
| tipo certo, valor inválido (moedas diferentes) | \`raise ValueError(...)\` |
| método abstrato ainda sem implementação | \`raise NotImplementedError\` |

- \`sum(vetores)\` começa com \`0\`: \`0 + Vetor\` só funciona com um \`__radd__\` que aceite o \`0\` — ou passe o início: \`sum(vetores, Vetor(0, 0))\`.
- \`a += b\` tenta \`__iadd__\` (in-place); sem ele, vira \`a = a + b\`.
- Se o tipo da direita é **subclasse** do da esquerda e redefine o refletido, o Python tenta o refletido **primeiro** — a subclasse "ganha a vez".

> [!atencao] Devolver \`NotImplementedError\` (a exceção) no lugar de \`NotImplemented\` é bug clássico: a classe da exceção é *truthy*, então \`if a == b:\` passa a ser verdadeiro para qualquer coisa.

> [!dica] Sobrecarregue operadores só quando o significado for óbvio (\`+\` de vetores, de dinheiro). \`pedido + cliente\` ninguém adivinha — use um método com nome.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Dunders, hash, protocolo de sequência e operadores.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-dm-q1',
        concept: '__eq__ e __hash__',
        say: 'Primeira: a pegadinha do hash. Leia com calma.',
        prompt: `O que acontece ao rodar este código?

\`\`\`python
class Produto:
    def __init__(self, sku):
        self.sku = sku

    def __eq__(self, outro):
        return isinstance(outro, Produto) and self.sku == outro.sku

itens = {Produto("A1"), Produto("A1")}
print(len(itens))
\`\`\``,
        options: [
          { text: "`TypeError` na criação do `set`: a classe é *unhashable*.", correct: true, why: 'Ao definir `__eq__` sem `__hash__`, o Python faz `Produto.__hash__ = None`. Montar o `set` chama `hash()` em cada elemento e falha já no primeiro.' },
          { text: 'Imprime `1`: os dois produtos são iguais.', why: 'Seria o resultado com um `__hash__` coerente (`hash(self.sku)`). Sem ele, a classe nem chega a ser hashable.' },
          { text: 'Imprime `2`: o hash herdado vem do `id()`, então os dois ficam no `set`.', why: 'É exatamente o bug que o Python evita: com o hash por identidade, dois objetos iguais cairiam em baldes diferentes. Por isso o `__hash__` herdado é removido.' },
          { text: "`AttributeError`: o objeto não tem mais o atributo `__hash__`.", why: 'O atributo existe — vale `None`. O `hash()` vê o `None` e lança `TypeError` dizendo que o tipo é unhashable.' },
        ],
        explanation: 'Uma classe que define `__eq__` e não define `__hash__` recebe `__hash__ = None`. É proposital: o contrato `a == b ⇒ hash(a) == hash(b)` quebraria com o hash por identidade herdado de `object`. Correção: `def __hash__(self): return hash(self.sku)` — se o `sku` nunca muda — ou `@dataclass(frozen=True)`.',
      },
      {
        type: 'mcq',
        id: 'py-dm-q2',
        concept: 'Protocolo de sequência',
        say: 'Agora uma classe com um único método. Quanta coisa ela consegue fazer?',
        prompt: `O que este código imprime?

\`\`\`python
from collections.abc import Iterable

class Contagem:
    def __getitem__(self, i):
        if i >= 3:
            raise IndexError(i)
        return i * 10

c = Contagem()
print(list(c), 20 in c, isinstance(c, Iterable))
\`\`\``,
        options: [
          { text: '`[0, 10, 20] True False`', correct: true, why: 'Sem `__iter__`, o `iter()` chama `__getitem__(0)`, `(1)`, `(2)` até o `IndexError`; o `in` itera comparando com `==`; mas a ABC `Iterable` só reconhece quem tem `__iter__`.' },
          { text: "`TypeError: 'Contagem' object is not iterable`", why: 'Seria verdade sem `__getitem__` também. O protocolo de sequência — antigo, mas vivo — faz `list()`, `for` e `in` funcionarem.' },
          { text: '`[0, 10, 20] True True`', why: '`isinstance(x, Iterable)` só detecta `__iter__` (ou registro na ABC). Não enxerga o protocolo de sequência — por isso a documentação recomenda testar com `iter(x)`.' },
          { text: '`[0, 10, 20] False False`', why: 'Sem `__contains__`, o `in` cai na iteração e compara cada item com `==`. O `20` é o terceiro item, então dá `True`.' },
        ],
        explanation: 'Cadeia de fallbacks: `iter()` tenta `__iter__` e, na falta, cria um iterador que chama `__getitem__` com 0, 1, 2… até um `IndexError`. O `in` tenta `__contains__` e, na falta, itera. Ferramentas de checagem (`isinstance` com ABCs) olham só os métodos "modernos" — o jeito confiável de perguntar "é iterável?" é tentar `iter(x)` e tratar o `TypeError`.',
      },
      {
        type: 'match',
        id: 'py-dm-q3',
        concept: 'Dunder methods',
        say: 'Rodada rápida: associe cada operação ao método especial que ela aciona.',
        prompt: 'Associe cada **operação** ao método especial que o Python aciona.',
        pairs: [
          { left: '`print(obj)`', right: '`__str__` (ou `__repr__`, se não houver `__str__`)' },
          { left: 'exibir `[obj]` numa lista', right: '`__repr__` de cada item' },
          { left: '`x in obj`', right: '`__contains__` (ou iteração)' },
          { left: '`if obj:`', right: '`__bool__` (ou `__len__`)' },
          { left: '`3 * obj`', right: '`__rmul__` de `obj`' },
          { left: '`obj` como chave de `dict`', right: '`__hash__` + `__eq__`' },
        ],
        explanation: 'Repare nos fallbacks: `str` → `__repr__`, `in` → iteração, `bool` → `__len__` → `True`. Em `3 * obj`, o `int` não sabe multiplicar `obj`, devolve `NotImplemented`, e o Python tenta o refletido `obj.__rmul__(3)`. E no `dict` o hash escolhe o balde, mas é o `__eq__` que confirma a chave.',
      },
      {
        type: 'code',
        id: 'py-dm-q4',
        concept: 'Dunder methods',
        title: 'Dinheiro com dunders',
        points: 50,
        say: 'Mão na massa: uma classe `Dinheiro` que se comporta como tipo nativo — imprime bem, compara, entra em `set`, soma e ordena.',
        prompt: `Complete a classe \`Dinheiro\` (o \`__init__\` já guarda \`valor\` como \`Decimal\` e \`moeda\`):

- \`repr(Dinheiro("10.5"))\` → \`"Dinheiro('10.5', 'BRL')"\`, usando o nome da classe **real** (\`type(self).__name__\`) para funcionar em subclasses.
- \`str(Dinheiro("10.5"))\` → \`"BRL 10.50"\` (sempre 2 casas).
- \`==\` compara **valor e moeda** (\`Dinheiro("10.5") == Dinheiro("10.50")\` é \`True\`); com outro tipo, **devolva** \`NotImplemented\`.
- Instâncias **hashable** e coerentes com o \`==\`.
- \`<\` compara valores da mesma moeda; use \`@total_ordering\` para ganhar \`<=\`, \`>\` e \`>=\`.
- \`+\` soma a mesma moeda e devolve um **novo** \`Dinheiro\`. Moedas diferentes → \`ValueError\` (no \`+\` e no \`<\`). Com outro tipo, \`NotImplemented\`.
- \`sum([...])\` precisa funcionar (lembre: ele começa com \`0\`).
- \`bool(Dinheiro("0"))\` é \`False\`; qualquer valor diferente de zero é \`True\`.`,
        starter: py(`
          from decimal import Decimal
          from functools import total_ordering


          class Dinheiro:
              def __init__(self, valor, moeda="BRL"):
                  self.valor = Decimal(str(valor))   # "10.5", 10 ou Decimal
                  self.moeda = moeda

              # TODO: __repr__, __str__, __eq__, __hash__, __lt__,
              #       __add__, __radd__ e __bool__
        `),
        tests: [
          {
            name: 'repr e str',
            code: py(`
              d = Dinheiro("10.5")
              assert repr(d) == "Dinheiro('10.5', 'BRL')", repr(d)
              assert str(d) == "BRL 10.50", str(d)
              assert str(Dinheiro(3, "USD")) == "USD 3.00", str(Dinheiro(3, "USD"))
            `),
          },
          {
            name: 'igualdade por valor e moeda (e outros tipos sem erro)',
            code: py(`
              assert Dinheiro("10.5") == Dinheiro("10.50"), "mesmo valor e moeda devem ser iguais"
              assert Dinheiro("1", "USD") != Dinheiro("1", "BRL"), "moedas diferentes não são iguais"
              assert Dinheiro("1") != Dinheiro("2")
              assert Dinheiro("1").__eq__(1) is NotImplemented, "com outro tipo, devolva NotImplemented"
              assert (Dinheiro("1") == "1") is False
            `),
          },
          {
            name: 'hashable e coerente com ==',
            code: py(`
              precos = {Dinheiro("10.5"), Dinheiro("10.50"), Dinheiro("10.5", "USD")}
              assert len(precos) == 2, precos
              assert hash(Dinheiro("7")) == hash(Dinheiro("7.00"))
            `),
          },
          {
            name: 'soma e sum()',
            code: py(`
              total = Dinheiro("1.5") + Dinheiro("2.25")
              assert isinstance(total, Dinheiro), total
              assert total == Dinheiro("3.75"), total
              assert sum([Dinheiro("1"), Dinheiro("2"), Dinheiro("3.5")]) == Dinheiro("6.5")
            `),
          },
          {
            name: 'moedas diferentes → ValueError',
            code: py(`
              for operacao in (lambda: Dinheiro("1") + Dinheiro("1", "USD"),
                               lambda: Dinheiro("1") < Dinheiro("2", "USD")):
                  try:
                      operacao()
                  except ValueError:
                      pass
                  else:
                      raise AssertionError("misturar moedas deveria lançar ValueError")
            `),
          },
          {
            name: 'ordenação completa',
            code: py(`
              precos = [Dinheiro("9.9"), Dinheiro("0.5"), Dinheiro("3")]
              assert sorted(precos) == [Dinheiro("0.5"), Dinheiro("3"), Dinheiro("9.9")], sorted(precos)
              assert Dinheiro("2") <= Dinheiro("2.00")
              assert Dinheiro("3") >= Dinheiro("1") and Dinheiro("3") > Dinheiro("1")
              assert max(precos) == Dinheiro("9.9")
            `),
          },
          {
            name: 'zero é falso',
            code: py(`
              assert not Dinheiro("0") and not Dinheiro("0.00"), "zero deveria ser falso"
              assert Dinheiro("0.01") and Dinheiro("-5"), "valores diferentes de zero são verdadeiros"
            `),
          },
          {
            name: 'repr de ida e volta e em subclasses',
            hidden: true,
            code: py(`
              d = Dinheiro("42.10", "EUR")
              assert eval(repr(d)) == d, repr(d)

              class Real(Dinheiro):
                  pass

              assert repr(Real("1")) == "Real('1', 'BRL')", repr(Real("1"))
            `),
          },
          {
            name: 'tipos desconhecidos terminam em TypeError',
            hidden: true,
            code: py(`
              for operacao in (lambda: Dinheiro("1") + 1,
                               lambda: 5 + Dinheiro("1"),
                               lambda: Dinheiro("1") < 5):
                  try:
                      operacao()
                  except TypeError:
                      pass
                  else:
                      raise AssertionError("com tipos desconhecidos, devolva NotImplemented (o Python lança TypeError)")
            `),
          },
          {
            name: 'soma não altera os operandos',
            hidden: true,
            code: py(`
              a, b = Dinheiro("1"), Dinheiro("2")
              c = a + b
              assert c is not a and c is not b, "o + deve devolver um objeto novo"
              assert (a, b) == (Dinheiro("1"), Dinheiro("2")), "o + não pode alterar os operandos"
              assert sum([Dinheiro("5")]) == Dinheiro("5")
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /NotImplementedError/.test(code),
            text: '`NotImplementedError` é para método abstrato ainda sem implementação. Em operadores, **devolva** `NotImplemented`: é o sinal para o Python tentar o método refletido do outro operando antes de desistir com `TypeError`.',
            concept: 'NotImplemented',
          },
          {
            when: (m, code) => /raise\s+TypeError/.test(code),
            text: 'Lançar `TypeError` direto no operador impede o outro operando de tentar: o `__radd__`/`__eq__` dele nunca é chamado. **Devolva** `NotImplemented` — se ninguém souber operar, o próprio Python lança o `TypeError`.',
            concept: 'NotImplemented',
          },
          {
            when: m => !m.decorators.includes('total_ordering'),
            text: 'Você escreveu as comparações à mão. `@functools.total_ordering` gera `<=`, `>` e `>=` a partir de `__eq__` e `__lt__` — menos código para manter coerente.',
            concept: 'total_ordering',
          },
          {
            when: (m, code) => /\bfloat\s*\(/.test(code),
            text: 'Dinheiro em `float` acumula erro de arredondamento (`0.1 + 0.2 != 0.3`). Mantenha `Decimal` do começo ao fim — ou centavos em `int`.',
            concept: 'Decimal',
          },
        ],
        hints: [
          '`__repr__`: `f"{type(self).__name__}({str(self.valor)!r}, {self.moeda!r})"`. `__str__`: `f"{self.moeda} {self.valor:.2f}"` — o `Decimal` aceita o formato `.2f`.',
          'Em `__eq__`, `__lt__` e `__add__`, comece com `if not isinstance(outro, Dinheiro): return NotImplemented`. O `__hash__` usa os mesmos campos do `__eq__`: `hash((self.valor, self.moeda))`.',
          '`sum()` faz `0 + primeiro`: o `int` devolve `NotImplemented` e o Python chama `primeiro.__radd__(0)`. Trate o `0` (devolva `self`) e devolva `NotImplemented` para o resto. `__bool__` é `self.valor != 0`.',
        ],
        solution: py(`
          from decimal import Decimal
          from functools import total_ordering


          @total_ordering
          class Dinheiro:
              def __init__(self, valor, moeda="BRL"):
                  self.valor = Decimal(str(valor))   # "10.5", 10 ou Decimal
                  self.moeda = moeda

              def __repr__(self):
                  return f"{type(self).__name__}({str(self.valor)!r}, {self.moeda!r})"

              def __str__(self):
                  return f"{self.moeda} {self.valor:.2f}"

              def _exigir_mesma_moeda(self, outro):
                  if outro.moeda != self.moeda:
                      raise ValueError(f"moedas diferentes: {self.moeda} e {outro.moeda}")

              def __eq__(self, outro):
                  if not isinstance(outro, Dinheiro):
                      return NotImplemented
                  return (self.valor, self.moeda) == (outro.valor, outro.moeda)

              def __hash__(self):
                  return hash((self.valor, self.moeda))   # mesmos campos do __eq__

              def __lt__(self, outro):
                  if not isinstance(outro, Dinheiro):
                      return NotImplemented
                  self._exigir_mesma_moeda(outro)
                  return self.valor < outro.valor

              def __add__(self, outro):
                  if not isinstance(outro, Dinheiro):
                      return NotImplemented
                  self._exigir_mesma_moeda(outro)
                  return type(self)(self.valor + outro.valor, self.moeda)

              def __radd__(self, outro):
                  if outro == 0:          # sum() começa com 0
                      return self
                  return NotImplemented

              def __bool__(self):
                  return self.valor != 0
        `),
        solutionExplanation: 'Cada operação da linguagem vira um dunder. O `__repr__` usa `type(self).__name__` e `!r` para produzir algo que o `eval` reconstrói; o `__str__` formata para gente. `__eq__` e `__hash__` usam **os mesmos campos** — e como `Decimal("10.5") == Decimal("10.50")` com hashes iguais, o contrato se mantém. Para tipos desconhecidos, todo operador **devolve** `NotImplemented`, o que dá a vez ao outro operando e termina em `TypeError` se ninguém souber. O `__radd__` existe por causa do `sum()`, que começa com `0`. Com `@total_ordering`, `__eq__` + `__lt__` bastam para `<=`, `>` e `>=`; e o `ValueError` de moedas diferentes atravessa os métodos gerados.',
      },
      {
        type: 'open',
        id: 'py-dm-q5',
        concept: '__eq__ e __hash__',
        say: 'Última: explique como se estivesse ajudando alguém do time.',
        prompt: 'Explique a um colega júnior: por que definir `__eq__` faz a classe "perder" o hash, qual é o **contrato** entre `__eq__` e `__hash__`, e por que objetos **mutáveis** não deveriam ser hashable. Como você resolveria para uma classe `Cpf` (imutável) e para uma classe `Carrinho` (mutável)?',
        minWords: 35,
        rubric: [
          { label: 'Contrato: objetos **iguais** têm o **mesmo hash**', keywords: ['mesmo hash', 'hash igual', 'hashes iguais', 'hash iguais', 'mesmo valor de hash', 'hash tambem', 'contrato', 'a == b', 'a==b'], concept: '__eq__ e __hash__', why: 'É a regra que `dict` e `set` pressupõem: o hash escolhe o balde, o `__eq__` confirma.' },
          { label: 'Com `__eq__` definido, o Python faz `__hash__ = None` (o hash herdado era por **identidade**)', keywords: ['none', 'unhashable', 'nao hashable', 'nao e hashable', 'nao hasheavel', 'perde o hash', 'remove o hash', 'apaga', 'identidade', 'id(', 'id do objeto', 'endereco'], concept: 'Hashable', why: 'O hash herdado de `object` vem da identidade; com igualdade por valor, iguais cairiam em baldes diferentes.' },
          { label: 'Mutação muda o hash e o objeto se **perde** no `set`/`dict`', keywords: ['mutave', 'mutavel', 'mudar', 'muda o', 'mudam', 'alter', 'perdid', 'nao encontra', 'nao acha', 'inalcanc', 'balde', 'bucket'], concept: 'Hashable', why: 'O hash é calculado na inserção; se os campos mudam, a busca vai ao balde errado.' },
          { label: 'Solução: `Cpf` com `__hash__` dos mesmos campos (ou `frozen=True`); `Carrinho` sem hash', keywords: ['frozen', 'imutave', 'imutavel', 'mesmos campos', 'hash((', 'hash(self', 'dataclass', 'namedtuple', 'sem hash', 'sem __hash__', 'deixar unhashable', 'deixo unhashable'], concept: '__eq__ e __hash__', why: 'Hash só onde o valor nunca muda; no mutável, a identidade (ou um id estável) vira a chave.' },
        ],
        modelAnswer: `O \`set\` e o \`dict\` usam o hash para escolher o "balde" e o \`__eq__\` para confirmar a chave. Por isso existe um **contrato**: se \`a == b\`, então \`hash(a) == hash(b)\`.

O hash herdado de \`object\` vem da **identidade** (\`id\`). Quando você define \`__eq__\` por valor, dois objetos iguais teriam hashes diferentes e apareceriam duplicados num \`set\`. Para não deixar esse bug silencioso, o Python faz \`__hash__ = None\` e a classe fica *unhashable* (\`TypeError\`).

Objetos **mutáveis** não deveriam ser hashable porque o hash é calculado na inserção: se um campo usado no hash muda depois, o objeto fica **perdido** no balde antigo — está no \`set\`, mas \`in\` não o encontra.

Para o \`Cpf\`, que é imutável, eu escreveria \`__hash__\` com os mesmos campos do \`__eq__\` (\`hash(self.numero)\`) ou usaria \`@dataclass(frozen=True)\`, que gera os dois coerentes. Para o \`Carrinho\`, mutável, eu deixaria sem \`__hash__\` (unhashable); se precisar indexá-lo, uso um id estável como chave do \`dict\`.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo trabalho! Agora você sabe o que o Python chama por baixo de `print`, `==`, `in`, `for`, `if` e `+`.',
          'Guarde as três regras de ouro: `__repr__` sempre, `__eq__` com `__hash__` coerente (só em imutáveis), e `NotImplemented` para dizer "não sei".',
        ],
        board: null,
      },
    ],
  });
})();
