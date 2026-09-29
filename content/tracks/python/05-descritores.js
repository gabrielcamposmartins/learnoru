(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'descritores',
    title: 'Descritores e a busca de atributos',
    kind: 'lesson',
    level: 3,
    order: 2,
    unit: 'objetos',
    summary: 'O que acontece de verdade em `obj.attr`: o protocolo de descritor, a ordem exata da busca de atributos, `__set_name__`, como `property` e métodos funcionam por dentro, `__getattr__` × `__getattribute__` e `__slots__`.',
    concepts: ['Protocolo de descritor', 'Dados × não-dados', '__set_name__', '__getattr__ × __getattribute__', '__slots__'],
    takeaways: [
      'Um **descritor** é um objeto com `__get__`, `__set__` ou `__delete__` guardado como atributo **de classe**; é ele que roda em `obj.attr`, `obj.attr = v` e `del obj.attr`.',
      'Ordem da busca: descritor **de dados** na classe → `__dict__` da instância → descritor **não-dados** ou atributo comum da classe → `__getattr__`.',
      'Guarde os valores **na instância** (`obj.__dict__[self.nome]`, com o nome vindo do `__set_name__`): o descritor é um só, compartilhado por todas as instâncias.',
      'Funções, `property`, `classmethod` e `staticmethod` são descritores: o `self` do método vem de `funcao.__get__(obj, Classe)`, que devolve um método vinculado.',
      '`__getattribute__` roda em **todo** acesso; `__getattr__`, só quando a busca falha. `__slots__` troca o `__dict__` por descritores de membro: menos memória, nenhum atributo novo.',
    ],
    glossary: [
      { term: 'Descritor', aliases: ['descritores', 'descriptor', 'descriptors', 'protocolo de descritor'], definition: 'Objeto guardado como atributo de **classe** que define `__get__`, `__set__` e/ou `__delete__`. O Python o chama sozinho em `obj.attr`, `obj.attr = v` e `del obj.attr`. É o mecanismo por trás de `property`, métodos, `classmethod` e `__slots__`.' },
      { term: 'Descritor de dados', aliases: ['descritores de dados', 'data descriptor', 'data descriptors'], definition: 'Descritor que define `__set__` ou `__delete__` (ex.: `property`, slots). Tem **prioridade** sobre o `__dict__` da instância na busca de atributos.' },
      { term: 'Descritor não-dados', aliases: ['descritores não-dados', 'non-data descriptor', 'non-data descriptors', 'descritor de não-dados'], definition: 'Descritor que só define `__get__` (ex.: funções, `classmethod`, `cached_property`). **Perde** para o `__dict__` da instância: um valor gravado lá com o mesmo nome o esconde.' },
      { term: '__set_name__', aliases: ['set_name'], definition: 'Gancho (PEP 487, Python 3.6+) chamado pelo `type.__new__` em cada atributo da classe que o define: `__set_name__(self, dono, nome)`. Permite ao descritor descobrir o nome do atributo sem repeti-lo.' },
      { term: 'Método vinculado', aliases: ['métodos vinculados', 'bound method', 'bound methods'], definition: 'Objeto devolvido por `funcao.__get__(obj, Classe)`: guarda a função (`__func__`) e a instância (`__self__`) e, ao ser chamado, passa `obj` como primeiro argumento. É criado a cada acesso.' },
      { term: '__slots__', definition: 'Declaração de classe que fixa os atributos permitidos. Cada nome vira um **descritor de membro** e as instâncias deixam de ter `__dict__`: menos memória, mas nenhum atributo novo em tempo de execução.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje a gente abre o capô do **ponto**: o que o Python faz quando você escreve `obj.attr`?',
          'A resposta tem nome: **descritores**. Você usa dezenas por dia — todo método e todo `@property` é um.',
        ],
        board: {
          title: 'O protocolo de descritor',
          md: `Um **descritor** é um objeto guardado como **atributo de classe** que define pelo menos um destes métodos:

| Método | Disparado por | Assinatura |
|---|---|---|
| \`__get__\` | \`obj.attr\` e \`Classe.attr\` | \`__get__(self, obj, dono=None)\` |
| \`__set__\` | \`obj.attr = valor\` | \`__set__(self, obj, valor)\` |
| \`__delete__\` | \`del obj.attr\` | \`__delete__(self, obj)\` |
| \`__set_name__\` | criação da classe | \`__set_name__(self, dono, nome)\` |

\`\`\`python
class Verboso:
    def __get__(self, obj, dono=None):
        print(f"__get__(obj={obj}, dono={dono.__name__})")
        return 42

class Pedido:
    total = Verboso()        # atributo de CLASSE

Pedido().total   # __get__(obj=<Pedido object at 0x...>, dono=Pedido) -> 42
Pedido.total     # __get__(obj=None, dono=Pedido)                     -> 42
\`\`\`

- \`obj\` é a instância — ou \`None\`, quando o acesso é pela classe; \`dono\` é a classe.
- **Um único** descritor atende todas as instâncias da classe.

> [!atencao] Descritor só funciona como atributo **de classe**. Guardado na instância (\`self.total = Verboso()\`), é só um objeto comum. E \`Pedido.total = 0\` **substitui** o descritor: o \`__set__\` só intercepta atribuições feitas em instâncias.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o detalhe que quase ninguém conhece: existem **dois tipos** de descritor, com prioridades diferentes.',
          'Quem define `__set__` ou `__delete__` é **de dados** e vence o `__dict__` da instância. Quem só tem `__get__` perde para ele.',
        ],
        board: {
          title: 'A ordem exata da busca de atributos',
          md: `\`\`\`text
obj.x  ->  type(obj).__getattribute__(obj, "x")    (o padrão é object.__getattribute__)

 1. procura "x" na MRO de type(obj)
 2. achou um descritor DE DADOS?        -> devolve descritor.__get__(obj, type(obj))
 3. "x" está em obj.__dict__?           -> devolve o valor da instância
 4. achou um descritor NÃO-DADOS?       -> devolve descritor.__get__(obj, type(obj))
 5. achou um atributo comum na classe?  -> devolve o atributo
 6. nada? AttributeError                -> chama __getattr__(obj, "x"), se existir
\`\`\`

\`\`\`python
class SoGet:                          # não-dados: só __get__
    def __get__(self, obj, dono=None):
        return "do descritor"

class ComSet(SoGet):                  # de dados: tem __set__
    def __set__(self, obj, valor):
        raise AttributeError("somente leitura")

class C:
    a = SoGet()
    b = ComSet()

c = C()
c.__dict__["a"] = "da instância"
c.__dict__["b"] = "da instância"
print(c.a)    # da instância   <- o __dict__ vence o não-dados
print(c.b)    # do descritor   <- o descritor de dados vence o __dict__
\`\`\`

> [!sabia] É essa regra que deixa o \`functools.cached_property\` praticamente de graça: ele é um descritor **não-dados**. No primeiro acesso, calcula o valor e grava em \`obj.__dict__\` com o mesmo nome; dali em diante o \`__dict__\` da instância vence a busca e o descritor **nunca mais é chamado**.`,
        },
      },
      {
        type: 'say',
        text: [
          'Vamos escrever um descritor útil: um **validador**. A primeira decisão é onde guardar o valor.',
          { text: 'Lembre: o descritor é um só para a classe inteira. Guardar o valor nele faz todas as instâncias dividirem o mesmo número.', mood: 'concerned' },
        ],
        board: {
          title: 'Validação reutilizável com __set_name__',
          md: `\`\`\`python
class Positivo:
    def __set_name__(self, dono, nome):
        self.nome = nome                   # "preco", "estoque"... sem repetir o nome

    def __get__(self, obj, dono=None):
        if obj is None:                    # Produto.preco -> o próprio descritor
            return self
        return obj.__dict__[self.nome]

    def __set__(self, obj, valor):
        if valor <= 0:
            raise ValueError(f"{self.nome} deve ser positivo, recebi {valor!r}")
        obj.__dict__[self.nome] = valor    # cada instância guarda o SEU valor


class Produto:
    preco = Positivo()                     # __set_name__(Produto, "preco") roda aqui
    estoque = Positivo()

    def __init__(self, preco, estoque):
        self.preco = preco                 # passa pelo __set__: validado!
        self.estoque = estoque


class Frete:
    peso = Positivo()                      # a mesma regra, em outra classe
\`\`\`

- Gravar em \`obj.__dict__\` com o **mesmo nome** é seguro porque \`Positivo\` tem \`__set__\`: é descritor de dados e continua vencendo o \`__dict__\` na leitura.
- O \`__set_name__\` é chamado pelo \`type.__new__\` quando a classe é criada. Antes dele (Python < 3.6), era preciso repetir: \`preco = Positivo("preco")\`.
- Atribuir o descritor depois (\`Produto.x = Positivo()\`) **não** chama \`__set_name__\` — aí é preciso chamá-lo à mão.
- Sem \`__dict__\` na instância? Use um nome privado com \`setattr(obj, "_preco", v)\` (e um slot para ele) ou um \`weakref.WeakKeyDictionary\`.

> [!atencao] O bug clássico é \`self.valor = valor\` dentro do \`__set__\`: o \`self\` ali é o **descritor**, compartilhado por todos os produtos. Resultado: mudar o preço de um muda o de todos.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora a revelação: `property`, métodos, `classmethod` e `staticmethod` são todos descritores.',
          'Aquele `self` que aparece "magicamente" no método vem do `__get__` das funções.',
        ],
        board: {
          title: 'property, métodos e classmethod por dentro',
          md: `\`\`\`python
class Conta:
    def depositar(self, valor): ...

c = Conta()
f = Conta.__dict__["depositar"]     # a função crua, guardada na classe
f.__get__(c, Conta)                 # <bound method Conta.depositar of <Conta ...>>
f.__get__(None, Conta)              # a própria função (Python 3 não tem "unbound method")

c.depositar(10)                     # = Conta.__dict__["depositar"].__get__(c, Conta)(10)
                                    # = Conta.depositar(c, 10)
\`\`\`

| Na classe | \`__get__(obj, dono)\` devolve | Tipo |
|---|---|---|
| função | método vinculado a \`obj\` | não-dados |
| \`classmethod(f)\` | método vinculado a \`dono\` (a classe) | não-dados |
| \`staticmethod(f)\` | \`f\`, sem vincular nada | não-dados |
| \`property(fget, fset)\` | \`fget(obj)\` | **dados** — sempre tem \`__set__\` |

\`\`\`python
class MinhaProperty:                        # a essência da property
    def __init__(self, fget, fset=None):
        self.fget, self.fset = fget, fset

    def __get__(self, obj, dono=None):
        return self if obj is None else self.fget(obj)

    def __set__(self, obj, valor):          # existe mesmo sem setter...
        if self.fset is None:               # ...por isso a property é "de dados"
            raise AttributeError("somente leitura")
        self.fset(obj, valor)

    def setter(self, fset):                 # @x.setter devolve uma NOVA property
        return type(self)(self.fget, fset)
\`\`\`

> [!sabia] O método vinculado é criado **a cada acesso**: \`c.depositar is c.depositar\` é \`False\` (já \`==\` é \`True\`). E como a property é descritor de dados, gravar \`obj.__dict__["x"]\` não esconde uma property \`x\` — mas esconde um método.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando o atributo não existe? Entram dois ganchos com nomes quase iguais e comportamentos bem diferentes.',
          { text: 'Um roda em **todo** acesso; o outro, só quando a busca normal falha. Confundir os dois é receita de recursão infinita.', mood: 'concerned' },
        ],
        board: {
          title: '__getattr__ × __getattribute__',
          md: `\`\`\`python
class Proxy:
    def __init__(self, alvo):
        self._alvo = alvo

    def __getattr__(self, nome):             # só quando a busca normal FALHA
        return getattr(self._alvo, nome)


class Espiao:
    def __getattribute__(self, nome):        # TODO acesso passa aqui, até self._x
        print("lendo", nome)
        return super().__getattribute__(nome)   # nunca self.algo aqui: recursão!
\`\`\`

| | \`__getattribute__\` | \`__getattr__\` |
|---|---|---|
| Quando roda | em **todo** \`obj.x\` | só depois de um \`AttributeError\` na busca normal |
| Uso típico | instrumentação, proxies totais (raro) | delegação, atributos dinâmicos, fallback |
| Armadilha | recursão infinita; deixa todo acesso mais lento | esconde erros de digitação |

> [!atencao] Um \`AttributeError\` lançado **dentro** de uma property também aciona o \`__getattr__\`: o erro real some e você recebe o fallback. E métodos especiais ignoram os dois ganchos: \`len(proxy)\` procura \`__len__\` direto no **tipo**. Com o \`Proxy\` acima, \`proxy.__len__()\` funciona, mas \`len(proxy)\` dá \`TypeError\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Último mecanismo: `__slots__`. Ele troca o `__dict__` de cada instância por espaços fixos.',
          'E adivinhe como cada slot é implementado? Com um descritor de dados, claro.',
        ],
        board: {
          title: '__slots__: menos memória, menos liberdade',
          md: `\`\`\`python
class Ponto:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x, self.y = x, y

p = Ponto(1, 2)
p.z = 3        # AttributeError: 'Ponto' object has no attribute 'z'
p.__dict__     # AttributeError: a instância não tem __dict__
Ponto.x        # <member 'x' of 'Ponto' objects>  <- um descritor de dados
\`\`\`

| Ganha | Perde |
|---|---|
| bem menos memória por instância (nada de dict) | atributos novos em tempo de execução |
| acesso a atributo um pouco mais rápido | \`cached_property\` (precisa de \`__dict__\`) e \`weakref\` (a menos que liste \`"__weakref__"\`) |
| erro imediato ao digitar \`p.nme = ...\` | padrão como atributo de classe: \`x = 0\` + slot \`"x"\` dá \`ValueError\` |

- Subclasse sem \`__slots__\` ganha o \`__dict__\` de volta; cada classe da hierarquia declara só os **seus** nomes novos.
- Compensa com **muitas** instâncias pequenas (milhões de pontos, eventos, nós de árvore). Para dez objetos, é ruído.

> [!sabia] \`__slots__\` pode ser um **dict**: \`__slots__ = {"x": "coordenada horizontal"}\`. Os valores viram a documentação de cada atributo, exibida pelo \`help()\` e por \`inspect.getdoc()\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Com tanta ferramenta, a pergunta de sênior é: qual usar?',
          'Descritor é infraestrutura. Se a regra aparece uma vez só, uma `property` é mais legível.',
        ],
        board: {
          title: 'Qual ferramenta usar',
          md: `| Preciso de… | Use |
|---|---|
| lógica em **um** atributo de **uma** classe | \`@property\` |
| a mesma regra em vários atributos ou classes | descritor com \`__set_name__\` |
| valor caro, calculado uma vez por instância | \`functools.cached_property\` |
| delegar atributos desconhecidos a outro objeto | \`__getattr__\` |
| interceptar **todo** acesso | \`__getattribute__\` (quase nunca) |
| milhões de instâncias pequenas | \`__slots__\` (ou \`@dataclass(slots=True)\`) |

Descritores estão por trás de muita biblioteca famosa: os campos de ORMs como Django e SQLAlchemy (\`Coluna\` na classe, valor na instância) e os validadores de muitas bibliotecas de configuração.

> [!dica] Numa entrevista, "como a \`property\` funciona?" é a porta de entrada para mostrar que você entende o protocolo de descritor e a ordem da busca de atributos.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Protocolo de descritor, busca de atributos, `__getattr__` e `__slots__`.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-desc-q1',
        concept: 'Descritor de dados × não-dados',
        say: 'Primeira: leia com calma e diga o que o `print` mostra.',
        prompt: `O que este código imprime?

\`\`\`python
class Constante:
    def __init__(self, valor):
        self.valor = valor

    def __get__(self, obj, dono=None):
        return self.valor

class Travado(Constante):
    def __set__(self, obj, valor):
        raise AttributeError("travado")

class Config:
    modo = Constante("prod")
    versao = Travado(2)

c = Config()
c.__dict__.update(modo="dev", versao=3)
print(c.modo, c.versao)
\`\`\``,
        options: [
          { text: '`dev 2`', correct: true, why: '`Constante` só tem `__get__` (não-dados): o `"dev"` do `__dict__` vence. `Travado` herda o `__get__` e ganha `__set__` (dados): ele vence o `3` do `__dict__`.' },
          { text: '`prod 2`', why: 'Descritor **não-dados** perde para o `__dict__` da instância. O `"dev"` gravado direto no dicionário esconde o `Constante`.' },
          { text: '`dev 3`', why: '`Travado` define `__set__`, então é descritor **de dados** — e esse tipo tem prioridade sobre o `__dict__` da instância.' },
          { text: '`AttributeError: travado`', why: '`c.__dict__.update(...)` escreve direto no dicionário e **não** passa pelo `__set__`. Só `c.versao = 3` acionaria o descritor.' },
        ],
        explanation: 'A busca de `obj.x` olha primeiro a classe: se lá houver um descritor **de dados** (com `__set__` ou `__delete__`), ele manda. Senão, o `__dict__` da instância vence; só depois entram os descritores **não-dados** e os atributos comuns. Escrever em `obj.__dict__` pula o `__set__`, o que é justamente o truque que descritores usam para guardar valores.',
      },
      {
        type: 'order',
        id: 'py-desc-q2',
        concept: 'Busca de atributos',
        say: 'Agora coloque em ordem o algoritmo que roda a cada `obj.x`.',
        prompt: 'Ordene os passos que `object.__getattribute__` segue para resolver `obj.x`.',
        items: [
          'Procura `x` na MRO de `type(obj)`',
          'Se lá existe um descritor de dados, devolve o `__get__` dele',
          'Senão, procura `x` em `obj.__dict__`',
          'Senão, usa o que achou na classe: `__get__` do não-dados ou o atributo comum',
          'Nada encontrado: `AttributeError`, que aciona o `__getattr__` se existir',
        ],
        explanation: 'A classe é consultada **antes** da instância só para descobrir se existe um descritor de dados — é por isso que uma `property` não pode ser escondida pelo `__dict__`. O `__getattr__` é o último recurso: só roda depois que a busca inteira falhou com `AttributeError`.',
      },
      {
        type: 'match',
        id: 'py-desc-q3',
        concept: 'Descritores embutidos',
        say: 'Associe cada peça conhecida ao descritor que ela é por dentro.',
        prompt: 'Associe cada recurso do Python ao seu comportamento como **descritor**.',
        pairs: [
          { left: 'Função definida na classe', right: 'Não-dados; o `__get__` devolve um método vinculado' },
          { left: '`property`', right: 'De dados mesmo sem setter; não é escondida pelo `__dict__`' },
          { left: '`classmethod`', right: 'Vincula o primeiro argumento à classe' },
          { left: '`staticmethod`', right: 'Devolve a função sem vincular nada' },
          { left: '`functools.cached_property`', right: 'Calcula uma vez e grava no `__dict__` da instância' },
          { left: 'Nome em `__slots__`', right: 'Descritor de membro; a instância fica sem `__dict__`' },
        ],
        explanation: 'Todos seguem o mesmo protocolo e só mudam o que o `__get__` devolve e se existe `__set__`. Métodos e `cached_property` são **não-dados** (podem ser escondidos pelo `__dict__`); `property` e slots são **de dados** (vencem o `__dict__`).',
      },
      {
        type: 'code',
        id: 'py-desc-q4',
        concept: 'Descritores de validação',
        title: 'Validador reutilizável com descritores',
        points: 50,
        say: 'Mão na massa: uma família de descritores de validação que qualquer classe pode usar. Cuidado com onde você guarda os valores!',
        prompt: `Crie um **descritor de validação reutilizável**. A base \`Validador\` cuida do protocolo; as subclasses só implementam \`validar(valor)\`.

**\`Validador\`**
- \`__set_name__\`: guarde o nome do atributo em \`self.nome\`.
- \`__get__\`: acesso pela classe (\`Produto.preco\`) devolve o **próprio descritor**; atributo nunca atribuído → \`AttributeError\`.
- \`__set__\`: chama \`self.validar(valor)\` e só então guarda o valor **na instância** (cada objeto tem o seu).
- \`__delete__\`: remove o valor; se não houver valor → \`AttributeError\`.

**\`Numero(minimo=None, maximo=None)\`**: aceita \`int\` e \`float\`, mas **não** \`bool\` (\`TypeError\`); fora de \`[minimo, maximo]\` (limites inclusivos) → \`ValueError\`.

**\`Texto(min_tam=0, max_tam=None)\`**: só \`str\` (senão \`TypeError\`); tamanho fora dos limites → \`ValueError\`.

As mensagens de \`ValueError\` devem citar o **nome do atributo** (ex.: \`"idade: 151 > máximo 150"\`).`,
        starter: py(`
          class Validador:
              """Descritor base: cuida do protocolo; as subclasses só implementam validar()."""

              def __set_name__(self, dono, nome):
                  pass  # TODO: guarde o nome do atributo em self.nome

              def __get__(self, obj, dono=None):
                  pass  # TODO: pela classe -> o próprio descritor; sem valor -> AttributeError

              def __set__(self, obj, valor):
                  pass  # TODO: valide e guarde o valor NA INSTÂNCIA

              def __delete__(self, obj):
                  pass  # TODO: remova o valor; sem valor -> AttributeError

              def validar(self, valor):
                  raise NotImplementedError


          class Numero(Validador):
              def __init__(self, minimo=None, maximo=None):
                  self.minimo = minimo
                  self.maximo = maximo

              def validar(self, valor):
                  pass  # TODO: int/float (bool não!) -> senão TypeError; fora dos limites -> ValueError


          class Texto(Validador):
              def __init__(self, min_tam=0, max_tam=None):
                  self.min_tam = min_tam
                  self.max_tam = max_tam

              def validar(self, valor):
                  pass  # TODO: só str -> senão TypeError; tamanho fora dos limites -> ValueError
        `),
        tests: [
          {
            name: 'valores válidos são lidos de volta',
            code: py(`
              class Produto:
                  nome = Texto(min_tam=1)
                  preco = Numero(minimo=0)

                  def __init__(self, nome, preco):
                      self.nome = nome
                      self.preco = preco

              p = Produto("Café", 12.5)
              assert (p.nome, p.preco) == ("Café", 12.5), (p.nome, p.preco)
              p.preco = 10
              assert p.preco == 10
            `),
          },
          {
            name: 'cada instância guarda o seu valor',
            code: py(`
              class Produto:
                  preco = Numero(minimo=0)

              a, b = Produto(), Produto()
              a.preco = 1
              b.preco = 2
              assert (a.preco, b.preco) == (1, 2), "as instâncias estão dividindo o valor: ele foi guardado no descritor?"
            `),
          },
          {
            name: 'tipo errado → TypeError (bool não é número)',
            code: py(`
              class Produto:
                  preco = Numero()
                  nome = Texto()

              p = Produto()
              for attr, ruim in (("preco", "10"), ("preco", None), ("preco", True), ("nome", 42)):
                  try:
                      setattr(p, attr, ruim)
                  except TypeError:
                      pass
                  else:
                      raise AssertionError(f"{attr} = {ruim!r} deveria lançar TypeError")
            `),
          },
          {
            name: 'fora dos limites → ValueError citando o atributo',
            code: py(`
              class Usuario:
                  idade = Numero(minimo=0, maximo=150)
                  apelido = Texto(min_tam=3, max_tam=10)

              u = Usuario()
              u.idade = 150          # limites inclusivos
              u.apelido = "lia"
              for attr, ruim in (("idade", 151), ("idade", -1), ("apelido", "li"), ("apelido", "x" * 11)):
                  try:
                      setattr(u, attr, ruim)
                  except ValueError as e:
                      assert attr in str(e), f"a mensagem deveria citar {attr!r}: {e}"
                  else:
                      raise AssertionError(f"{attr} = {ruim!r} deveria lançar ValueError")
            `),
          },
          {
            name: 'pela classe devolve o descritor; sem valor → AttributeError',
            code: py(`
              class Produto:
                  preco = Numero()

              assert isinstance(Produto.preco, Numero), "Produto.preco deveria devolver o próprio descritor"
              assert Produto.preco.nome == "preco", "guarde o nome recebido no __set_name__ em self.nome"
              p = Produto()
              assert not hasattr(p, "preco"), "sem valor atribuído, ler p.preco deve lançar AttributeError"
              assert getattr(p, "preco", "padrão") == "padrão"
            `),
          },
          {
            name: 'valor inválido não sobrescreve o anterior',
            hidden: true,
            code: py(`
              class Produto:
                  preco = Numero(minimo=0)

              p = Produto()
              p.preco = 10
              try:
                  p.preco = -5
              except ValueError:
                  pass
              assert p.preco == 10, "o valor inválido não pode ter sido gravado"
            `),
          },
          {
            name: 'limite 0 também vale (0 é falsy)',
            hidden: true,
            code: py(`
              class Conta:
                  saldo = Numero(minimo=0)
                  desconto = Numero(maximo=0)

              c = Conta()
              c.saldo = 0
              c.desconto = 0
              for attr, ruim in (("saldo", -0.5), ("desconto", 0.5)):
                  try:
                      setattr(c, attr, ruim)
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"{attr} = {ruim} deveria lançar ValueError (limite 0 é falsy: use 'is not None')")
            `),
          },
          {
            name: 'del remove o valor',
            hidden: true,
            code: py(`
              class Produto:
                  preco = Numero()

              p = Produto()
              p.preco = 5
              del p.preco
              assert not hasattr(p, "preco"), "depois do del, ler p.preco deve lançar AttributeError"
              try:
                  del p.preco
              except AttributeError:
                  pass
              else:
                  raise AssertionError("del de um atributo sem valor deveria lançar AttributeError")
              p.preco = 7
              assert p.preco == 7
            `),
          },
          {
            name: 'a base é reutilizável: subclasse nova só implementa validar()',
            hidden: true,
            code: py(`
              class UmDe(Validador):
                  def __init__(self, *opcoes):
                      super().__init__()
                      self.opcoes = set(opcoes)

                  def validar(self, valor):
                      if valor not in self.opcoes:
                          raise ValueError(f"{self.nome}: {valor!r} não é uma opção válida")

              class Pedido:
                  status = UmDe("aberto", "pago")
                  total = Numero(minimo=0)

              class Chamado:
                  status = UmDe("novo", "fechado")

              pe, ch = Pedido(), Chamado()
              pe.status, pe.total, ch.status = "pago", 99.9, "novo"
              assert (pe.status, pe.total, ch.status) == ("pago", 99.9, "novo")
              try:
                  ch.status = "pago"
              except ValueError as e:
                  assert "status" in str(e)
              else:
                  raise AssertionError("UmDe deveria validar através do __set__ do Validador")
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /self\.\w+\s*\[\s*(id\s*\(\s*)?obj\b/.test(code) && !/WeakKeyDictionary/.test(code),
            text: 'Guardar os valores num dict **do descritor** indexado pela instância (`self._valores[obj]` ou `[id(obj)]`) vaza memória: o dict mantém as instâncias vivas para sempre — e um `id()` pode ser reaproveitado por outro objeto depois que o primeiro morre. Prefira `obj.__dict__` (ou `weakref.WeakKeyDictionary`, se a classe não tiver `__dict__`).',
            concept: 'Armazenamento por instância',
          },
          {
            when: (m, code) => /type\s*\(\s*valor\s*\)\s*(==|!=|is\b|in\b|not\b)/.test(code),
            text: 'Comparar `type(valor) == int` (ou `in (int, float)`) barra o `bool`, mas também rejeita subclasses legítimas, como uma `class Centavos(int)`. O idiomático é `isinstance` excluindo o `bool` explicitamente: `isinstance(valor, bool) or not isinstance(valor, (int, float))`.',
            concept: 'isinstance × type',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Um `except` amplo pode engolir o `TypeError`/`ValueError` da validação ou transformar qualquer bug em `AttributeError`. Capture só o `KeyError` da leitura do `__dict__`.',
            concept: 'Tratamento de erros',
          },
        ],
        hints: [
          '`__set_name__(self, dono, nome)` roda quando a classe é criada: basta `self.nome = nome`. No `__get__`, trate primeiro `obj is None` (acesso pela classe) devolvendo `self`.',
          'Guarde cada valor em `obj.__dict__[self.nome]` — nunca em `self`, que é compartilhado. Como o descritor tem `__set__`, ele continua vencendo o `__dict__` na leitura. No `__get__` e no `__delete__`, troque o `KeyError` por `AttributeError`.',
          'No `__set__`, chame `self.validar(valor)` **antes** de gravar. Em `Numero.validar`, rejeite o `bool` primeiro (`isinstance(True, int)` é `True`!) e compare os limites com `is not None` — `0` é falsy.',
        ],
        solution: py(`
          class Validador:
              """Descritor base: cuida do protocolo; as subclasses só implementam validar()."""

              def __set_name__(self, dono, nome):
                  self.nome = nome

              def __get__(self, obj, dono=None):
                  if obj is None:                      # Produto.preco -> o próprio descritor
                      return self
                  try:
                      return obj.__dict__[self.nome]
                  except KeyError:
                      raise AttributeError(f"{type(obj).__name__}.{self.nome} ainda não foi definido") from None

              def __set__(self, obj, valor):
                  self.validar(valor)                  # valida ANTES de gravar
                  obj.__dict__[self.nome] = valor      # na instância, nunca em self

              def __delete__(self, obj):
                  try:
                      del obj.__dict__[self.nome]
                  except KeyError:
                      raise AttributeError(self.nome) from None

              def validar(self, valor):
                  raise NotImplementedError


          class Numero(Validador):
              def __init__(self, minimo=None, maximo=None):
                  self.minimo = minimo
                  self.maximo = maximo

              def validar(self, valor):
                  if isinstance(valor, bool) or not isinstance(valor, (int, float)):
                      raise TypeError(f"{self.nome}: esperava número, recebi {type(valor).__name__}")
                  if self.minimo is not None and valor < self.minimo:
                      raise ValueError(f"{self.nome}: {valor} < mínimo {self.minimo}")
                  if self.maximo is not None and valor > self.maximo:
                      raise ValueError(f"{self.nome}: {valor} > máximo {self.maximo}")


          class Texto(Validador):
              def __init__(self, min_tam=0, max_tam=None):
                  self.min_tam = min_tam
                  self.max_tam = max_tam

              def validar(self, valor):
                  if not isinstance(valor, str):
                      raise TypeError(f"{self.nome}: esperava str, recebi {type(valor).__name__}")
                  if len(valor) < self.min_tam or (self.max_tam is not None and len(valor) > self.max_tam):
                      raise ValueError(f"{self.nome}: tamanho {len(valor)} fora de [{self.min_tam}, {self.max_tam}]")
        `),
        solutionExplanation: 'O `__set_name__` dá ao descritor o nome do atributo sem repeti-lo. Os valores ficam em `obj.__dict__[self.nome]`: cada instância tem o seu, e — como `Validador` define `__set__` — ele é **descritor de dados** e continua vencendo o `__dict__` na leitura, mesmo com o mesmo nome. O `KeyError` vira `AttributeError`, o que mantém `hasattr` e `getattr(obj, nome, padrão)` funcionando. A validação roda **antes** de gravar (valor inválido nunca entra), e cada subclasse só descreve a regra em `validar()` — um *template method* aplicado a descritores. Repare no `bool` barrado primeiro (`isinstance(True, int)` é `True`) e nos limites comparados com `is not None`, porque `0` é falsy.',
      },
      {
        type: 'mcq',
        id: 'py-desc-q5',
        concept: '__getattr__ × __getattribute__',
        say: 'Esta pegadinha já custou horas de depuração a muita gente. O que sai?',
        prompt: `O que este código imprime?

\`\`\`python
from types import SimpleNamespace

class Usuario:
    def __init__(self, perfil):
        self._perfil = perfil

    @property
    def email(self):
        return self._perfil.emial          # erro de digitação!

    def __getattr__(self, nome):
        return f"<{nome} indisponível>"

u = Usuario(SimpleNamespace(email="lia@exemplo.com"))
print(u.email)
\`\`\``,
        options: [
          { text: '`<email indisponível>`', correct: true, why: 'O `AttributeError` do `emial` escapa da property; para o Python, a busca de `email` **falhou**, então ele chama `__getattr__("email")`. O erro de digitação some sem deixar rastro.' },
          { text: '`lia@exemplo.com`', why: 'A property não lê `email`: ela lê `emial`, que não existe no `SimpleNamespace`. Nada ali devolve o e-mail.' },
          { text: "`AttributeError: 'types.SimpleNamespace' object has no attribute 'emial'`", why: 'Seria o resultado **sem** o `__getattr__`. Com ele, o `AttributeError` vindo de dentro da property é tratado como "atributo não encontrado" e desviado para o fallback.' },
          { text: '`<emial indisponível>`', why: 'O `__getattr__` de `Usuario` recebe o nome buscado em `Usuario` — `"email"` —, não o nome que falhou lá dentro do `SimpleNamespace`.' },
        ],
        explanation: 'O Python implementa `obj.x` como "tente `__getattribute__`; se sair `AttributeError`, chame `__getattr__`". Ele não distingue um atributo inexistente de um `AttributeError` acidental dentro de uma property. Defesas: não deixar `AttributeError` escapar de properties (converta para outra exceção) e fazer o `__getattr__` responder só aos nomes esperados, lançando `AttributeError` para o resto.',
      },
      {
        type: 'open',
        id: 'py-desc-q6',
        concept: 'cached_property',
        say: 'Última: explique como numa entrevista, ligando as peças da aula.',
        prompt: 'Um colega pergunta: "por que o `@functools.cached_property` fica praticamente de graça depois do primeiro acesso, e por que ele quebra numa classe com `__slots__`?" Responda usando o **protocolo de descritor** e a **ordem da busca de atributos**.',
        minWords: 30,
        rubric: [
          { label: 'É um descritor **não-dados** (só `__get__`, sem `__set__`)', keywords: ['nao-dados', 'nao dados', 'non-data', 'nondata', 'sem __set__', 'sem set', 'nao tem __set__', 'nao define __set__', 'nao implementa __set__', 'so tem __get__', 'so define __get__', 'so implementa __get__', 'apenas __get__', 'somente __get__', 'so o __get__'], concept: 'Descritor não-dados', why: 'Sem `__set__`, ele tem prioridade **menor** que o `__dict__` da instância.' },
          { label: 'No primeiro acesso calcula e **grava na instância** (`__dict__`)', keywords: [['grav', '__dict__'], ['salv', '__dict__'], ['guard', '__dict__'], ['armazen', '__dict__'], ['escrev', '__dict__'], 'dict da instancia', 'dicionario da instancia', 'grava na instancia', 'salva na instancia', 'guarda na instancia', 'armazena na instancia', 'atributo da instancia', 'atributo de instancia', 'atributo comum'], concept: 'cached_property', why: 'O valor calculado vira um atributo comum da instância, com o mesmo nome.' },
          { label: 'Depois, o `__dict__` **vence** a busca e o descritor nem é chamado', keywords: ['vence', 'prioridade', 'precedencia', 'sombre', 'shadow', 'esconde', 'encontrado primeiro', 'achado primeiro', 'nao e mais chamado', 'nunca mais', 'nao chama mais', 'ignora o descritor', 'antes do descritor', 'antes dos descritores'], concept: 'Busca de atributos', why: 'Na ordem da busca, o `__dict__` da instância vem antes dos descritores não-dados.' },
          { label: '`__slots__` **remove o `__dict__`**: não há onde gravar (`TypeError`)', keywords: ['sem __dict__', 'nao tem __dict__', 'nao ha __dict__', 'remove o __dict__', 'elimina o __dict__', 'sem dicionario', 'nao tem dicionario', 'nao ha dicionario', 'typeerror', 'nao tem onde gravar', 'nao tem onde guardar', 'nao ha onde', 'onde gravar', 'onde guardar'], concept: '__slots__', why: 'Sem `"__dict__"` na lista de slots, a instância não tem dicionário e o `cached_property` lança `TypeError` ao tentar gravar.' },
        ],
        modelAnswer: `O \`cached_property\` é um descritor **não-dados**: define só \`__get__\` (e \`__set_name__\`), sem \`__set__\`.

No primeiro acesso, \`obj.relatorio\` não encontra nada no \`obj.__dict__\`, então a busca cai no \`__get__\` do descritor, que calcula o resultado e o **grava na instância** (\`obj.__dict__["relatorio"]\`), com o mesmo nome do atributo.

A partir daí, pela ordem da busca de atributos, o \`__dict__\` da instância **vence** qualquer descritor não-dados: o descritor nunca mais é chamado, e a leitura vira um acesso comum a atributo.

Numa classe com \`__slots__\`, a instância não tem dicionário (\`__dict__\`), então não há onde gravar o valor e o \`cached_property\` lança \`TypeError\`. Saídas: incluir \`"__dict__"\` nos slots (perdendo parte da economia) ou fazer o cache à mão num slot, com uma \`property\`.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você sabe o que o ponto faz: descritor de dados, `__dict__` da instância, não-dados e, por último, `__getattr__`.',
          'Na próxima aula a gente sobe um nível: se descritores controlam atributos, **metaclasses** controlam a criação das próprias classes.',
        ],
        board: null,
      },
    ],
  });
})();
