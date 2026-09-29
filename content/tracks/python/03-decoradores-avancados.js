(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('python', {
    id: 'decoradores-avancados',
    title: 'Decorators avançados',
    kind: 'lesson',
    level: 3,
    order: 11,
    unit: 'funcional',
    summary: 'Closures e `nonlocal`, decorators com argumentos (os três níveis), `functools.wraps`, decorators de classe, cache com `lru_cache` — e a ordem em que decorators empilhados rodam.',
    concepts: ['Closures', 'Decorator factory', 'functools.wraps', 'lru_cache', 'Empilhamento de decorators'],
    takeaways: [
      '`@deco` é só `f = deco(f)`, executado na **definição** (no import!). Com argumentos, são três níveis: `fabrica(config)` → `decorator(func)` → `wrapper(*args, **kwargs)`.',
      'Closures capturam **variáveis**, não valores (*late binding*). Para reatribuir uma variável capturada, `nonlocal`; mutar um dict ou lista capturado dispensa.',
      'Sempre `@functools.wraps(func)`: preserva `__name__` e `__doc__` e cria `__wrapped__`, que `inspect.signature` e os testes usam para chegar à função original.',
      'Empilhados, decorators são **aplicados de baixo para cima** e **executam de cima para baixo**: `@a @b def f` vira `a(b(f))` — e a ordem muda o comportamento (log × cache, retry × timeout).',
      '`lru_cache`/`cache` exigem argumentos hashable e têm riscos: memória sem limite, dado velho, retorno mutável compartilhado e `self` preso no cache de métodos.',
    ],
    glossary: [
      { term: 'Closure', aliases: ['closures', 'clausura', 'clausuras'], definition: 'Função interna que guarda referências às variáveis do escopo onde foi criada, mesmo depois que a função externa retornou. As variáveis ficam em "células" (`f.__closure__`).' },
      { term: 'Late binding', aliases: ['ligação tardia', 'vinculação tardia'], definition: 'Closures leem o valor da variável capturada na hora da **chamada**, não na criação. Por isso `[lambda: i for i in range(3)]` gera três funções que devolvem `2`.' },
      { term: 'nonlocal', aliases: ['declaração nonlocal'], definition: 'Declaração que permite **reatribuir** uma variável da função externa dentro de uma closure. Sem ela, `n += 1` torna `n` local e dá `UnboundLocalError`.' },
      { term: 'Decorator factory', aliases: ['fábrica de decorators', 'decorator com argumentos', 'decorators com argumentos', 'decorator parametrizado'], definition: 'Função que recebe configuração e **devolve um decorator**: `@retry(3)` chama `retry(3)` primeiro e aplica o resultado à função. Daí os três níveis de funções aninhadas.' },
      { term: 'functools.wraps', aliases: ['update_wrapper', 'functools.update_wrapper'], definition: 'Decorator da stdlib para o wrapper: copia `__name__`, `__qualname__`, `__doc__`, `__module__` e o `__dict__` da função original e cria `__wrapped__` apontando para ela.' },
      { term: 'Memoização', aliases: ['memoization', 'memoizar', 'memoizada'], definition: 'Guardar o resultado de uma função pura por argumentos para devolvê-lo sem recalcular na próxima chamada igual. Na stdlib: `functools.cache` e `functools.lru_cache`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Você já usou `@decorator`. Hoje a gente vai do "uso" ao "escrevo o meu, com argumentos, cache e tudo".',
          'Primeiro, a verdade nua: `@deco` é só açúcar para `f = deco(f)`.',
        ],
        board: {
          title: 'Decorator: função que recebe e devolve função',
          md: `\`\`\`python
import functools
import time

def cronometrar(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        inicio = time.perf_counter()
        try:
            return func(*args, **kwargs)     # não esqueça o return!
        finally:
            print(f"{func.__name__}: {time.perf_counter() - inicio:.3f}s")
    return wrapper

@cronometrar                  # o mesmo que: relatorio = cronometrar(relatorio)
def relatorio(mes):
    ...
\`\`\`

- O \`@\` roda na **definição** da função — ou seja, quando o módulo é **importado**. Um decorator que registra rotas, abre conexão ou lê configuração faz isso no import.
- \`*args, **kwargs\` deixam o wrapper aceitar qualquer assinatura. E ele precisa **devolver** o resultado: esquecer o \`return\` é o bug nº 1 — a função decorada passa a devolver \`None\`.
- O \`wrapper\` enxerga \`func\` mesmo depois que \`cronometrar\` retornou. Isso tem nome: **closure**.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Closures são o motor dos decorators. Ler uma variável de fora é tranquilo; **reatribuir** é outra história.',
          'E tem uma pegadinha clássica de entrevista: closures capturam a variável, não o valor.',
        ],
        board: {
          title: 'Closures, nonlocal e late binding',
          md: `\`\`\`python
def contador():
    n = 0
    def incrementar():
        nonlocal n            # sem isto: UnboundLocalError
        n += 1
        return n
    return incrementar

c = contador()
c(), c(), c()                        # (1, 2, 3)
c.__closure__[0].cell_contents       # 3  <- a variável vive numa "célula"
\`\`\`

- **Ler** uma variável de fora funciona sempre. **Reatribuir** (\`n += 1\`, \`n = ...\`) faz o compilador tratá-la como **local** da função interna inteira → \`UnboundLocalError\`. O \`nonlocal\` diz "é a de fora".
- **Mutar** um objeto capturado (\`cache[k] = v\`, \`lista.append(x)\`) não reatribui o nome — dispensa \`nonlocal\`.
- \`global\` faz o mesmo para o escopo do módulo. Num decorator, quase sempre é erro: o estado passa a ser compartilhado por **todas** as funções decoradas.

\`\`\`python
acoes = [lambda: i for i in range(3)]
[f() for f in acoes]                 # [2, 2, 2]  <- todas leem o MESMO i, no fim

acoes = [lambda i=i: i for i in range(3)]
[f() for f in acoes]                 # [0, 1, 2]  <- o padrão é avaliado na criação
\`\`\`

> [!sabia] Closures capturam **variáveis**, não valores — isso se chama *late binding*: o valor é lido na hora da chamada. O truque \`i=i\` funciona porque valores padrão são avaliados uma única vez, na **definição** — o mesmo motivo do famoso bug do argumento padrão mutável (\`def f(x=[])\`).`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora um detalhe que separa decorator amador de profissional: o `functools.wraps`.',
          'Sem ele, sua função "esquece" quem ela é — e logs, documentação e frameworks passam a mentir.',
        ],
        board: {
          title: 'functools.wraps e o __wrapped__',
          md: `\`\`\`python
def sem_wraps(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@sem_wraps
def soma(a: int, b: int = 0) -> int:
    """Soma dois números."""
    return a + b

soma.__name__              # 'wrapper'  <- logs, métricas e tracebacks mentem
soma.__doc__               # None       <- help() fica vazio
inspect.signature(soma)    # (*args, **kwargs)
\`\`\`

Com \`@functools.wraps(func)\` em cima do \`wrapper\`:

\`\`\`python
soma.__name__              # 'soma'
soma.__doc__               # 'Soma dois números.'
inspect.signature(soma)    # (a: int, b: int = 0) -> int   (segue o __wrapped__)
soma.__wrapped__(2, 3)     # 5 — a original, sem o decorator
\`\`\`

- \`wraps\` copia \`__module__\`, \`__name__\`, \`__qualname__\`, \`__doc__\` e as anotações, atualiza o \`__dict__\` e cria \`__wrapped__\`.
- \`__wrapped__\` é ouro nos testes: dá para testar a lógica **sem** o retry ou o cache por cima. \`inspect.unwrap(f)\` desce todas as camadas.
- Frameworks dependem disso: registrar por \`__name__\` ou inspecionar a assinatura (fixtures do pytest, parâmetros do FastAPI) quebra sem \`wraps\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando o decorator precisa de configuração, como `@retry(3)`? Aí entra mais um nível de função.',
          'Parece assustador, mas cada nível tem um papel só. Veja a linha do tempo.',
        ],
        board: {
          title: 'Decorators com argumentos: os três níveis',
          md: `\`\`\`python
import functools

def repetir(vezes):                        # 1) fábrica: recebe a configuração
    def decorator(func):                   # 2) decorator: recebe a função
        @functools.wraps(func)
        def wrapper(*args, **kwargs):      # 3) wrapper: recebe cada chamada
            for _ in range(vezes - 1):
                func(*args, **kwargs)
            return func(*args, **kwargs)
        return wrapper
    return decorator

@repetir(3)                 # saudar = repetir(3)(saudar)
def saudar(nome):
    print(f"oi, {nome}")
\`\`\`

\`\`\`text
 @repetir(3)          repetir(3)         -> decorator   (1 vez, na definição)
 def saudar(...)      decorator(saudar)  -> wrapper     (1 vez, na definição)
 saudar("ana")        wrapper("ana")     -> func(...)   (a cada chamada)
\`\`\`

Erro clássico: esquecer os parênteses. \`@repetir\` sem \`(3)\` faz \`saudar = repetir(saudar)\`: \`vezes\` recebe a função, e \`saudar("ana")\` devolve um decorator em vez de cumprimentar.

Parênteses opcionais (\`@retry\` e \`@retry(tentativas=5)\`) com \`functools.partial\`:

\`\`\`python
def retry(func=None, *, tentativas=3):
    if func is None:                               # usado como @retry(...)
        return functools.partial(retry, tentativas=tentativas)
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        ...
    return wrapper
\`\`\`

> [!dica] Deixe a configuração *keyword-only* (o \`*\` na assinatura): \`@retry(tentativas=5)\` se lê sozinho, e ninguém confunde o primeiro argumento com a função.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Quando você empilha decorators, a ordem importa — e confunde muita gente.',
          'Regra: **aplicados de baixo para cima**, **executados de cima para baixo**.',
        ],
        board: {
          title: 'Empilhamento: ordem de aplicação × execução',
          md: `\`\`\`python
@negrito
@italico
def titulo():
    return "Oi"

# equivale a:  titulo = negrito(italico(titulo))
titulo()      # '<b><i>Oi</i></b>'
\`\`\`

\`\`\`text
 aplicação (na definição):  de BAIXO para CIMA   italico(...) primeiro, depois negrito(...)
 execução (na chamada):     de CIMA para BAIXO   wrapper do negrito -> wrapper do italico -> titulo
\`\`\`

A ordem muda o comportamento:

| Empilhamento | Efeito |
|---|---|
| \`@log\` em cima de \`@cache\` | loga **toda** chamada, inclusive os acertos de cache |
| \`@cache\` em cima de \`@log\` | loga só quando calcula de verdade |
| \`@retry\` em cima de \`@timeout\` | cada tentativa tem o seu próprio timeout |
| \`@timeout\` em cima de \`@retry\` | o timeout vale para **todas** as tentativas somadas |
| \`@app.route\` **embaixo** dos outros | o framework registra a função **sem** os outros decorators |

> [!atencao] Em métodos, \`@staticmethod\`, \`@classmethod\` e \`@property\` costumam ir **por cima** de todos: eles devolvem descritores, não funções, e um decorator comum aplicado sobre eles recebe algo que não sabe tratar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Decorators não servem só para funções: um decorator **de classe** recebe a classe inteira.',
          'E o decorator também pode **ser** uma classe — com uma pegadinha que quase ninguém conhece.',
        ],
        board: {
          title: 'Decorators de classe e decorators como classe',
          md: `\`\`\`python
# 1) Decorator DE classe: recebe a classe e a devolve (modificada ou registrada)
PAGAMENTOS = {}

def registrar(cls):
    PAGAMENTOS[cls.__name__.lower()] = cls
    return cls                         # esqueça o return e o nome vira None!

@registrar
class Pix: ...
\`\`\`

\`@dataclass\` e \`@functools.total_ordering\` são decorators de classe da stdlib: geram métodos e devolvem a mesma classe.

\`\`\`python
# 2) Decorator COMO classe: bom quando há estado e métodos auxiliares
class Contar:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.chamadas = 0

    def __call__(self, *args, **kwargs):
        self.chamadas += 1
        return self.func(*args, **kwargs)

@Contar
def ping():
    return "pong"

ping()
ping.chamadas          # 1
\`\`\`

> [!sabia] Decorator feito com **classe** quebra em métodos: \`obj.metodo()\` dá \`TypeError: missing 1 required positional argument: 'self'\`. Funções viram métodos porque são **descritores** — têm \`__get__\`, que "amarra" o \`self\`. Uma instância com \`__call__\` não tem. A correção é implementar \`__get__\` devolvendo \`types.MethodType(self, obj)\` — ou usar decorator com função e closure, que já funciona em tudo.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Por fim, o decorator mais usado da stdlib: o cache. Uma linha e sua função fica rápida.',
          'Mas cache é estado — e estado escondido cobra juros. Olhe a tabela de riscos.',
        ],
        board: {
          title: 'lru_cache, cache e seus riscos',
          md: `\`\`\`python
from functools import cache, lru_cache

@lru_cache(maxsize=1024)           # LRU: descarta o usado há mais tempo
def cotacao(moeda, dia):
    return api.buscar(moeda, dia)

cotacao.cache_info()     # CacheInfo(hits=3, misses=2, maxsize=1024, currsize=2)
cotacao.cache_clear()

@cache                             # = lru_cache(maxsize=None): SEM limite (3.9+)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
\`\`\`

| Risco | Exemplo | Mitigação |
|---|---|---|
| memória sem limite | \`@cache\` numa função chamada com ids de usuários | \`lru_cache(maxsize=...)\` |
| dado velho | cotação cacheada para sempre | TTL (ex.: janela de tempo na chave) ou cache externo com expiração |
| argumento não hashable | \`f([1, 2])\` → \`TypeError\` | converter para \`tuple\`/\`frozenset\` |
| retorno mutável compartilhado | quem recebe a lista cacheada faz \`.append\` e altera o cache | devolver tupla ou cópia |
| método com \`@lru_cache\` | o cache guarda \`self\` → as instâncias nunca são liberadas | cache por instância, \`cached_property\` |
| efeito colateral | cachear \`enviar_email()\` | só cacheie funções **puras** |

> [!atencao] A chave do \`lru_cache\` usa os argumentos **como foram passados**: \`f(1, 2)\`, \`f(1, b=2)\` e \`f(b=2, a=1)\` viram **três** entradas diferentes. Normalizar a chamada custa caro, e a stdlib preferiu a velocidade.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Closures, ordem de decorators, retry e memoização.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-dec-q1',
        concept: 'Empilhamento de decorators',
        say: 'Primeira: dois decorators empilhados, cada um imprimindo algo. Qual é a saída completa?',
        prompt: `O que este código imprime (na ordem)?

\`\`\`python
def a(func):
    print("A")
    def wrapper():
        print("a")
        return func()
    return wrapper

def b(func):
    print("B")
    def wrapper():
        print("b")
        return func()
    return wrapper

@a
@b
def f():
    print("f")

f()
\`\`\``,
        options: [
          { text: '`B`, `A`, `a`, `b`, `f`', correct: true, why: 'Na definição, `b` é aplicado primeiro (é o mais próximo da função) e depois `a`: imprime B, A. Na chamada, o wrapper mais externo (`a`) roda primeiro: a, b, f.' },
          { text: '`A`, `B`, `a`, `b`, `f`', why: 'A aplicação é de **baixo para cima**: `f = a(b(f))` — o `b(f)` é avaliado antes, então B sai antes de A.' },
          { text: '`B`, `A`, `b`, `a`, `f`', why: 'A execução é de **cima para baixo**: o nome `f` aponta para o wrapper de `a`, que chama o wrapper de `b`, que chama a original.' },
          { text: '`a`, `b`, `f`', why: 'Os corpos de `a` e `b` rodam na **definição** (no import), não na chamada — então A e B também aparecem, antes de tudo.' },
        ],
        explanation: '`@a @b def f` é `f = a(b(f))`. A aplicação acontece uma vez, na definição, de dentro para fora (B, A). Cada chamada entra pela camada mais externa (a → b → f). É por isso que `@log` em cima de `@cache` loga todas as chamadas, e embaixo, só os erros de cache.',
      },
      {
        type: 'mcq',
        id: 'py-dec-q2',
        concept: 'Closures',
        say: 'Agora uma closure que tenta manter um total. Funciona?',
        prompt: `O que acontece?

\`\`\`python
def fabrica():
    total = 0
    def somar(x):
        total += x
        return total
    return somar

somar = fabrica()
print(somar(5))
\`\`\``,
        options: [
          { text: '`UnboundLocalError`', correct: true, why: '`total += x` é uma atribuição: o compilador marca `total` como **local** de `somar`, e a leitura antes da atribuição falha. Falta `nonlocal total`.' },
          { text: 'Imprime `5`', why: 'Seria o resultado com `nonlocal total`. Sem ele, a atribuição torna `total` local em toda a função `somar`.' },
          { text: 'Imprime `0`', why: 'Não existe uma "cópia local" começando em zero: a variável local nem tem valor quando `total += x` tenta lê-la.' },
          { text: 'Imprime `5`, mas o `total` de `fabrica` continua `0`', why: 'Seria verdade se o Python criasse uma cópia local inicializada com o valor de fora — ele não faz isso. O escopo é decidido na compilação.' },
        ],
        explanation: 'O escopo de um nome é decidido na **compilação**: qualquer atribuição (`=`, `+=`, `for x in`, `import`) dentro da função torna o nome local na função inteira. `nonlocal total` avisa que o nome é o da função externa. Se `total` fosse um dict e você fizesse `total["n"] += x`, não precisaria de `nonlocal`: mutar não é reatribuir o nome.',
      },
      {
        type: 'order',
        id: 'py-dec-q3',
        concept: 'Decorator factory',
        say: 'Coloque em ordem a vida de um decorator com argumentos, da definição até a chamada.',
        prompt: `Ordene o que acontece, da definição até a chamada:

\`\`\`python
@retry(tentativas=3)
def buscar(url): ...

buscar("https://api.exemplo.com")
\`\`\``,
        items: [
          '`retry(tentativas=3)` é chamada e devolve o decorator',
          'O decorator recebe a função `buscar` original',
          'O decorator devolve o `wrapper`, que herda o nome `buscar` via `@wraps`',
          'O nome `buscar` passa a apontar para o `wrapper`',
          'A chamada executa o `wrapper`, que chama a original até 3 vezes',
        ],
        explanation: 'Os dois primeiros níveis rodam **uma vez**, na definição (no import do módulo). Só o terceiro — o `wrapper` — roda a cada chamada, enxergando `tentativas` e a função original por closure.',
      },
      {
        type: 'code',
        id: 'py-dec-q4',
        concept: 'Decorator factory',
        title: '@retry com argumentos',
        points: 50,
        say: 'Mão na massa: o decorator mais pedido em entrevista — `@retry` configurável, com backoff e o `dormir` injetado para os testes não esperarem de verdade.',
        prompt: `Implemente \`retry(tentativas=3, excecoes=(Exception,), atraso=0.0, dormir=time.sleep)\`, uma **fábrica de decorators**:

- \`tentativas\` é o total de execuções (a primeira conta). \`tentativas < 1\` → \`ValueError\` já em \`retry(...)\`.
- Só exceções de \`excecoes\` (uma classe ou tupla, como no \`except\`) provocam nova tentativa. Outras propagam **na hora**.
- Se todas falharem, relance a **última** exceção, intacta (mesmo tipo e mensagem).
- Entre uma tentativa e a próxima — nunca depois da última — chame \`dormir(espera)\`: \`espera\` começa em \`atraso\` e **dobra** a cada falha.
- Cada chamada recomeça a contagem de tentativas.
- Use \`functools.wraps\` (nome, docstring e \`__wrapped__\` preservados) e repasse \`*args\` e \`**kwargs\`.`,
        starter: py(`
          import functools
          import time


          def retry(tentativas=3, excecoes=(Exception,), atraso=0.0, dormir=time.sleep):
              """Repete a função quando ela lança uma das \`excecoes\`."""
              # TODO: valide, e devolva um decorator que devolve um wrapper
        `),
        tests: [
          {
            name: 'sucesso de primeira: executa uma vez',
            code: py(`
              chamadas = []

              @retry(3, dormir=lambda s: None)
              def dobro(x):
                  chamadas.append(x)
                  return 2 * x

              assert dobro(21) == 42
              assert chamadas == [21], chamadas
            `),
          },
          {
            name: 'falha, falha, funciona',
            code: py(`
              tentativas = []

              @retry(tentativas=3, excecoes=(ConnectionError,), dormir=lambda s: None)
              def instavel():
                  tentativas.append(1)
                  if len(tentativas) < 3:
                      raise ConnectionError("caiu")
                  return "ok"

              assert instavel() == "ok"
              assert len(tentativas) == 3, f"deveria executar 3 vezes, executou {len(tentativas)}"
            `),
          },
          {
            name: 'esgota e relança a última exceção',
            code: py(`
              contador = []

              @retry(tentativas=3, excecoes=(TimeoutError,), dormir=lambda s: None)
              def sempre_falha():
                  contador.append(1)
                  raise TimeoutError(f"tentativa {len(contador)}")

              try:
                  sempre_falha()
              except TimeoutError as e:
                  assert str(e) == "tentativa 3", f"relance a ÚLTIMA exceção (veio: {e})"
              else:
                  raise AssertionError("deveria relançar o TimeoutError")
              assert len(contador) == 3, contador
            `),
          },
          {
            name: 'exceção fora da lista não é repetida',
            code: py(`
              contador = []

              @retry(tentativas=5, excecoes=(ConnectionError,), dormir=lambda s: None)
              def bug():
                  contador.append(1)
                  raise KeyError("bug de verdade")

              try:
                  bug()
              except KeyError:
                  pass
              else:
                  raise AssertionError("KeyError deveria propagar")
              assert len(contador) == 1, f"KeyError não está em excecoes: não repita (executou {len(contador)}x)"
            `),
          },
          {
            name: 'backoff com dormir injetado',
            code: py(`
              esperas = []

              @retry(tentativas=4, excecoes=(OSError,), atraso=0.5, dormir=esperas.append)
              def falha():
                  raise OSError("disco")

              try:
                  falha()
              except OSError:
                  pass
              assert esperas == [0.5, 1.0, 2.0], f"esperas entre as 4 tentativas: {esperas}"
            `),
          },
          {
            name: 'preserva metadados (wraps)',
            code: py(`
              def original(a, b=1):
                  """Doc original."""
                  return a + b

              decorada = retry(2, dormir=lambda s: None)(original)
              assert decorada.__name__ == "original", decorada.__name__
              assert decorada.__doc__ == "Doc original."
              assert decorada.__wrapped__ is original, "use functools.wraps (ele cria __wrapped__)"
              assert decorada(1, b=2) == 3
            `),
          },
          {
            name: 'tentativas inválidas: ValueError na fábrica',
            hidden: true,
            code: py(`
              for n in (0, -1):
                  try:
                      retry(n)
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"retry({n}) deveria lançar ValueError")
            `),
          },
          {
            name: 'funciona em métodos',
            hidden: true,
            code: py(`
              class Cliente:
                  def __init__(self):
                      self.falhas = 1

                  @retry(2, excecoes=(ConnectionError,), dormir=lambda s: None)
                  def buscar(self, rota):
                      if self.falhas:
                          self.falhas -= 1
                          raise ConnectionError()
                      return f"GET {rota}"

              assert Cliente().buscar("/x") == "GET /x"
            `),
          },
          {
            name: 'exceção única e contagem por chamada',
            hidden: true,
            code: py(`
              estado = {"n": 0}

              @retry(2, excecoes=ValueError, dormir=lambda s: None)
              def f():
                  estado["n"] += 1
                  if estado["n"] % 2 == 1:
                      raise ValueError()
                  return estado["n"]

              assert f() == 2
              assert f() == 4, "cada chamada recomeça a contagem de tentativas"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Um `except:`/`except Exception` no wrapper repete até **bugs** (`KeyError`, `TypeError`) — e com `BaseException` engoliria até o Ctrl+C. Capture só `excecoes`: o que não estiver lá propaga sozinho.',
            concept: 'Tratamento de erros',
          },
          {
            when: (m, code) => /raise\s+(RuntimeError|Exception)\s*\(/.test(code),
            text: 'Embrulhar a falha em outra exceção esconde o tipo original: quem chama não consegue mais fazer `except TimeoutError`. Use `raise` puro dentro do `except` para relançar a exceção intacta.',
            concept: 'Tratamento de erros',
          },
          {
            when: (m, code) => /^\s*raise\s+[a-z_]\w*\s*$/m.test(code),
            text: 'Guardar a exceção numa variável e fazer `raise ultima` depois do laço funciona, mas o `raise` puro dentro do `except` da última tentativa é mais simples: sem variável extra (que mantém frames vivos) e com o traceback exatamente como estava.',
            concept: 'Tratamento de erros',
          },
          {
            when: m => m.recursion,
            text: 'Retry recursivo empilha um frame por tentativa e complica o relançamento. Um laço `for tentativa in range(...)` é mais simples e não tem limite de profundidade.',
            concept: 'Decorator factory',
          },
        ],
        hints: [
          'Três níveis: `retry(...)` valida e devolve `decorator`; `decorator(func)` devolve `wrapper`; o `wrapper(*args, **kwargs)` faz o laço de tentativas. Decore o `wrapper` com `@functools.wraps(func)`.',
          'No laço: `try: return func(*args, **kwargs)` e `except excecoes:` — o `except` aceita uma classe ou uma tupla. Exceções fora da lista nem são capturadas, então propagam sozinhas.',
          'Na última tentativa, `raise` puro relança a exceção intacta. Nas outras, `dormir(espera)` e `espera *= 2` (com `espera = atraso` no começo de cada chamada).',
        ],
        solution: py(`
          import functools
          import time


          def retry(tentativas=3, excecoes=(Exception,), atraso=0.0, dormir=time.sleep):
              """Repete a função quando ela lança uma das \`excecoes\`."""
              if tentativas < 1:
                  raise ValueError("tentativas deve ser >= 1")

              def decorator(func):
                  @functools.wraps(func)
                  def wrapper(*args, **kwargs):
                      espera = atraso                    # recomeça a cada chamada
                      for tentativa in range(1, tentativas + 1):
                          try:
                              return func(*args, **kwargs)
                          except excecoes:
                              if tentativa == tentativas:
                                  raise                  # esgotou: relança a última, intacta
                              dormir(espera)
                              espera *= 2
                  return wrapper

              return decorator
        `),
        solutionExplanation: 'A fábrica valida **uma vez**, na definição — um `@retry(0)` falha no import, não em produção. O `decorator` só embrulha a função com `wraps`; o `wrapper` guarda o estado de **cada chamada** em variáveis locais (`espera`, `tentativa`), por isso chamadas diferentes não interferem. O `except excecoes` filtra o que merece nova tentativa — o resto propaga sem ser tocado — e o `raise` puro na última tentativa preserva tipo, mensagem e traceback. Como o decorator é uma função com closure, funciona em métodos sem nenhum `__get__`.',
      },
      {
        type: 'code',
        id: 'py-dec-q5',
        concept: 'Memoização',
        title: '@memoize com estatísticas',
        points: 60,
        say: 'Agora o seu próprio cache — melhor que o `lru_cache` num ponto: chamadas equivalentes, como `f(1, 2)` e `f(1, b=2)`, compartilham a mesma entrada.',
        prompt: `Implemente o decorator \`memoize\` (sem argumentos):

- Guarda o resultado por argumentos. Chamadas **equivalentes** compartilham a entrada: \`area(3, 2)\`, \`area(3, altura=2)\` e \`area(altura=2, largura=3)\` — e, se \`altura=1\` for o padrão, \`area(5)\` e \`area(5, 1)\`.
- \`f.stats()\` devolve \`{"hits": ..., "misses": ..., "tamanho": ...}\` (\`tamanho\` = entradas no cache).
- \`f.limpar()\` esvazia o cache e zera as estatísticas.
- Exceções **não** são guardadas: a próxima chamada executa de novo.
- \`None\` é um resultado como outro qualquer (também é cacheado).
- Cada função decorada tem o **seu** cache. Use \`functools.wraps\`.`,
        starter: py(`
          import functools
          import inspect


          def memoize(func):
              """Cacheia resultados por argumentos (normalizados) e expõe estatísticas."""
              # TODO: cache, contadores, wrapper, stats() e limpar()
        `),
        tests: [
          {
            name: 'guarda resultados e conta hits/misses',
            code: py(`
              chamadas = []

              @memoize
              def quadrado(x):
                  chamadas.append(x)
                  return x * x

              assert quadrado(4) == 16 and quadrado(4) == 16 and quadrado(5) == 25
              assert chamadas == [4, 5], chamadas
              assert quadrado.stats() == {"hits": 1, "misses": 2, "tamanho": 2}, quadrado.stats()
            `),
          },
          {
            name: 'chamadas equivalentes compartilham a entrada',
            code: py(`
              chamadas = []

              @memoize
              def area(largura, altura=1):
                  chamadas.append((largura, altura))
                  return largura * altura

              assert area(3, 2) == 6
              assert area(3, altura=2) == 6
              assert area(altura=2, largura=3) == 6
              assert area(5) == area(5, 1) == 5
              assert len(chamadas) == 2, f"a função rodou {len(chamadas)}x; chamadas equivalentes deveriam reaproveitar o cache"
              assert area.stats() == {"hits": 3, "misses": 2, "tamanho": 2}, area.stats()
            `),
          },
          {
            name: 'limpar zera cache e estatísticas',
            code: py(`
              @memoize
              def dobro(x):
                  return 2 * x

              dobro(1); dobro(1)
              dobro.limpar()
              assert dobro.stats() == {"hits": 0, "misses": 0, "tamanho": 0}, dobro.stats()
              dobro(1)
              assert dobro.stats() == {"hits": 0, "misses": 1, "tamanho": 1}, dobro.stats()
            `),
          },
          {
            name: 'exceções não são cacheadas',
            code: py(`
              tentativas = []

              @memoize
              def instavel(x):
                  tentativas.append(x)
                  if len(tentativas) == 1:
                      raise ConnectionError("falhou")
                  return x

              try:
                  instavel(7)
              except ConnectionError:
                  pass
              assert instavel(7) == 7, "depois de uma exceção, a próxima chamada deve executar de novo"
              assert len(tentativas) == 2, tentativas
              assert instavel.stats()["tamanho"] == 1, instavel.stats()
            `),
          },
          {
            name: 'None também é resultado',
            code: py(`
              chamadas = []

              @memoize
              def buscar(chave):
                  chamadas.append(chave)
                  return None

              buscar("x"); buscar("x")
              assert chamadas == ["x"], "None é um resultado válido: use 'in' (ou uma sentinela), não cache.get()"
              assert buscar.stats()["hits"] == 1, buscar.stats()
            `),
          },
          {
            name: 'preserva metadados (wraps)',
            code: py(`
              def original(n):
                  """Calcula algo caro."""
                  return n

              m = memoize(original)
              assert m.__name__ == "original" and m.__doc__ == "Calcula algo caro."
              assert m.__wrapped__ is original, "use functools.wraps (ele cria __wrapped__)"
              assert m(3) == 3
            `),
          },
          {
            name: 'cada função tem o seu cache',
            hidden: true,
            code: py(`
              @memoize
              def f(x):
                  return ("f", x)

              @memoize
              def g(x):
                  return ("g", x)

              assert f(1) == ("f", 1) and g(1) == ("g", 1)
              assert f.stats() == {"hits": 0, "misses": 1, "tamanho": 1}, f.stats()
              f.limpar()
              assert g.stats()["tamanho"] == 1, "limpar f não pode apagar o cache de g"
            `),
          },
          {
            name: 'recursão aproveita o cache',
            hidden: true,
            code: py(`
              @memoize
              def fib(n):
                  return n if n < 2 else fib(n - 1) + fib(n - 2)

              assert fib(80) == 23416728348467685
              s = fib.stats()
              assert s["misses"] == 81 and s["tamanho"] == 81, s
            `),
          },
          {
            name: '*args e argumentos só-nomeados',
            hidden: true,
            code: py(`
              @memoize
              def juntar(*partes, sep="-"):
                  return sep.join(partes)

              assert juntar("a", "b") == "a-b"
              assert juntar("a", "b", sep="-") == "a-b"
              assert juntar("a", "b", sep="+") == "a+b"
              assert juntar.stats() == {"hits": 1, "misses": 2, "tamanho": 2}, juntar.stats()
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /^\s*global\s/m.test(code),
            text: 'Com `global`, o cache e as estatísticas ficam **compartilhados** por todas as funções decoradas. Guarde o estado na closure (com `nonlocal` para os contadores) — cada decoração ganha o seu.',
            concept: 'Closures',
          },
          {
            when: m => m.classes.length > 0 && !m.classes.some(c => c.methods.includes('__get__')),
            text: 'Decorator feito com classe funciona em funções, mas quebra em **métodos**: sem `__get__`, o `self` não é passado. Implemente `__get__` (devolvendo `types.MethodType(self, obj)`) ou use uma closure.',
            concept: 'Descritores',
          },
        ],
        hints: [
          'Guarde o estado na closure: `cache = {}` e contadores `hits`/`misses`, reatribuídos com `nonlocal`. Pendure `stats` e `limpar` como atributos do `wrapper` — funções também têm atributos.',
          'Para normalizar a chamada: `ligados = inspect.signature(func).bind(*args, **kwargs)` e depois `ligados.apply_defaults()`. A chave é `(ligados.args, tuple(sorted(ligados.kwargs.items())))`.',
          'Use `if chave in cache:` (e não `cache.get`) — `None` é resultado válido. Só grave no cache **depois** que a função retornar: se ela lançar, nada é guardado.',
        ],
        solution: py(`
          import functools
          import inspect


          def memoize(func):
              """Cacheia resultados por argumentos (normalizados) e expõe estatísticas."""
              assinatura = inspect.signature(func)
              cache = {}
              hits = misses = 0

              @functools.wraps(func)
              def wrapper(*args, **kwargs):
                  nonlocal hits, misses
                  ligados = assinatura.bind(*args, **kwargs)
                  ligados.apply_defaults()                 # area(5) == area(5, altura=1)
                  chave = (ligados.args, tuple(sorted(ligados.kwargs.items())))
                  if chave in cache:                       # "in": None também é resultado
                      hits += 1
                      return cache[chave]
                  misses += 1
                  resultado = func(*args, **kwargs)        # se lançar, nada é guardado
                  cache[chave] = resultado
                  return resultado

              def stats():
                  return {"hits": hits, "misses": misses, "tamanho": len(cache)}

              def limpar():
                  nonlocal hits, misses
                  cache.clear()
                  hits = misses = 0

              wrapper.stats = stats
              wrapper.limpar = limpar
              return wrapper
        `),
        solutionExplanation: 'Todo o estado mora na **closure** de cada decoração: `cache`, `hits` e `misses` (reatribuídos com `nonlocal`; o `cache` só é mutado, então dispensa). A normalização vem de `inspect.signature(...).bind` + `apply_defaults()`: posicional, nomeado e padrão viram a mesma forma canônica — algo que o `lru_cache` não faz, por custo. O teste `chave in cache` separa "não calculado" de "calculado e deu `None`", e gravar só **depois** do retorno garante que exceções não fiquem presas no cache. `wraps` preserva nome, docstring e `__wrapped__`, e `stats`/`limpar` viram atributos do próprio wrapper, como o `cache_info()` do `lru_cache`.',
      },
      {
        type: 'open',
        id: 'py-dec-q6',
        concept: 'lru_cache',
        say: 'Última: um code review de verdade. Aponte os riscos e proponha saídas.',
        prompt: 'Num PR, um colega colocou `@functools.lru_cache(maxsize=None)` no método `Repositorio.buscar_cliente(self, cliente_id)`, que consulta o banco e devolve um `dict` com os dados do cliente. Que **riscos** você apontaria e o que proporia no lugar?',
        minWords: 35,
        rubric: [
          { label: 'Memória **sem limite** (`maxsize=None`)', keywords: ['memoria', 'sem limite', 'ilimitad', 'cresce', 'crescer', 'maxsize', 'vazamento', 'leak', 'estour'], concept: 'lru_cache', why: 'Cada `cliente_id` novo vira uma entrada eterna; com muitos clientes, o processo só cresce.' },
          { label: 'O cache guarda **`self`**: as instâncias nunca são liberadas', keywords: ['self', 'instancia', 'garbage', 'coletad', 'coleta de lixo', 'liberad', 'b019'], concept: 'lru_cache', why: 'O `self` faz parte da chave, então o cache mantém referência a cada repositório criado.' },
          { label: 'Dado **velho**: o cliente muda no banco e o cache não sabe', keywords: ['desatualiz', 'velho', 'antigo', 'stale', 'ttl', 'invalid', 'expira', 'consistencia', 'mudou no banco', 'muda no banco'], concept: 'Invalidação de cache', why: 'Sem expiração nem invalidação, o método devolve para sempre a primeira versão lida.' },
          { label: 'Retorno **mutável** compartilhado', keywords: ['mutave', 'mutavel', 'compartilhad', 'copia', 'corromp', 'altera o cache', 'alterar o cache', 'imutave', 'mappingproxy', 'frozen'], concept: 'Memoização', why: 'Todos os chamadores recebem o **mesmo** dict; um `cliente["nome"] = ...` altera o valor cacheado para todo mundo.' },
        ],
        modelAnswer: `Eu apontaria quatro riscos:

1. **Memória sem limite:** com \`maxsize=None\`, cada \`cliente_id\` consultado vira uma entrada eterna — o processo só cresce. No mínimo, \`maxsize\` finito.
2. **\`self\` preso no cache:** num método, o \`self\` faz parte da chave, então o cache mantém referência a cada instância de \`Repositorio\` e elas nunca são liberadas pela coleta de lixo (o flake8-bugbear até tem a regra B019 para isso).
3. **Dado velho:** se o cliente muda no banco, o cache continua devolvendo a versão antiga, sem expiração (TTL) nem invalidação.
4. **Retorno mutável compartilhado:** todo chamador recebe o **mesmo** \`dict\`; se um deles alterar um campo, corrompe o valor cacheado para todos.

Proposta: tirar o cache do método e colocá-lo numa camada explícita — um cache por instância ou externo (Redis) com TTL curto e invalidação quando o cliente é atualizado — devolvendo uma cópia ou um objeto imutável (dataclass frozen). E só cachear depois de medir que a consulta é mesmo o gargalo.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou muito bem! Closures, três níveis, `wraps`, ordem de empilhamento e cache — agora você escreve decorators de gente grande.',
          'E lembre: decorator é código que roda no import e muda o comportamento em silêncio. Use com parcimônia e sempre com `wraps`.',
        ],
        board: null,
      },
    ],
  });
})();
