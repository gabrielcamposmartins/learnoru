Game.registerModule('design-patterns', {
  id: 'decorator',
  title: 'Decorator',
  kind: 'lesson',
  level: 2,
  order: 22,
  unit: 'estruturais',
  summary: 'Adicionar comportamento sem herança: o padrão GoF e os decorators do Python.',
  concepts: ['Decorator (GoF)', 'Decorators Python', 'functools.wraps', 'Closures'],
  takeaways: [
    'O **Decorator** do GoF embrulha um objeto com a **mesma interface** e acrescenta comportamento: N decorators combináveis substituem a explosão de subclasses.',
    'Em Python, `@d` sobre `def f` é só açúcar para `f = d(f)`: o decorator recebe uma função e devolve outra — em geral um *wrapper*, que é uma **closure**.',
    'Decorator com parâmetros tem **três níveis** (fábrica → decorator → wrapper). Empilhados, eles são **aplicados de baixo para cima** e **executados de fora para dentro**, como camadas de cebola.',
    'Use sempre `@functools.wraps` no wrapper: sem ele, a função decorada perde `__name__`, `__doc__` e companhia, e logs, docs e depuradores só enxergam "wrapper".',
    'Decorators brilham em **preocupações transversais** — log, cache, retry, autorização, métricas —, a mesma ideia que a programação orientada a aspectos (AOP) formalizou.',
  ],
  glossary: [
    { term: 'Decorator', aliases: ['decorators', 'padrão Decorator', 'decorador', 'decoradores'], definition: 'Padrão estrutural (GoF) que embrulha um objeto em outro com a **mesma interface** para acrescentar comportamento em tempo de execução, de forma empilhável. Em Python, também é o nome da função aplicada com `@`, que recebe e devolve uma função ou classe.' },
    { term: 'Closure', aliases: ['closures', 'clausura', 'clausuras'], definition: 'Função interna que "lembra" as variáveis do escopo onde foi criada, mesmo depois que a função externa retornou. É o que permite ao `wrapper` usar `func` e o parâmetro de `@retry(3)`.' },
    { term: 'Preocupação transversal', aliases: ['preocupações transversais', 'cross-cutting concern', 'cross-cutting concerns', 'interesse transversal', 'interesses transversais'], definition: 'Necessidade que atravessa muitas partes do código sem ser regra de negócio: log, cache, retry, autorização, métricas. Decorators e middlewares são o lugar clássico para ela.' },
    { term: 'Memoização', aliases: ['memoization', 'memoizar', 'memoizada'], definition: 'Guardar o resultado de uma função **pura** para cada combinação de argumentos e devolvê-lo nas chamadas seguintes. Em Python: `@functools.cache` e `@functools.lru_cache`.' },
    { term: 'Programação orientada a aspectos', aliases: ['AOP', 'aspect-oriented programming', 'orientação a aspectos'], definition: 'Paradigma nascido no Xerox PARC (equipe de Gregor Kiczales, 1997) que isola **preocupações transversais** em *aspectos*: o código extra — o *advice* — roda antes, depois ou em volta das funções escolhidas por um *pointcut*.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto tem dois lados: o **Decorator do GoF** e os **decorators do Python** — o famoso `@`.',
        'Eles têm a mesma ideia: **embrulhar** algo para adicionar comportamento, sem modificar o original.',
      ],
      board: {
        title: 'O problema: explosão de subclasses',
        code: `class Cafe: ...
class CafeComLeite(Cafe): ...
class CafeComCanela(Cafe): ...
class CafeComLeiteECanela(Cafe): ...
class CafeComLeiteCanelaEChantilly(Cafe): ...
# 4 adicionais → 16 combinações possíveis 😱`,
        caption: 'Herança não escala para combinações de funcionalidades.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'No Decorator do GoF, cada adicional é um objeto que **tem a mesma interface** da bebida e **guarda uma bebida dentro**.',
        'Ele repassa a chamada para o objeto embrulhado e acrescenta algo antes ou depois. Dá para empilhar quantos quiser!',
      ],
      board: {
        title: 'Decorator (GoF) por composição',
        code: `class Cafe:
    def preco(self):     return 5.0
    def descricao(self): return "café"


class ComChantilly:
    def __init__(self, bebida):
        self.bebida = bebida                  # embrulha

    def preco(self):
        return self.bebida.preco() + 2.0      # delega + adiciona

    def descricao(self):
        return self.bebida.descricao() + " + chantilly"


pedido = ComChantilly(ComChantilly(Cafe()))   # empilhando!
print(pedido.descricao())   # café + chantilly + chantilly
print(pedido.preco())       # 9.0`,
        caption: 'N adicionais = N classes, combináveis livremente em tempo de execução.',
      },
    },
    {
      type: 'say',
      text: [
        'Agora o lado Python. Um decorator de **função** é uma função que recebe uma função e devolve outra — geralmente um *wrapper* que chama a original.',
        'A sintaxe `@` é só açúcar sintático para `f = decorator(f)`.',
      ],
      board: {
        title: 'Decorators do Python',
        code: `import functools
import time

def cronometrar(func):
    @functools.wraps(func)                 # preserva nome, docstring...
    def wrapper(*args, **kwargs):
        inicio = time.perf_counter()
        resultado = func(*args, **kwargs)
        print(f"{func.__name__}: {time.perf_counter() - inicio:.4f}s")
        return resultado
    return wrapper


@cronometrar            # equivale a: somar = cronometrar(somar)
def somar(a, b):
    """Soma dois números."""
    return a + b

somar(2, 3)
print(somar.__name__)   # "somar" (sem wraps seria "wrapper")`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Precisa de parâmetros, como `@retry(3)`? Aí são **três níveis**: a fábrica recebe os parâmetros e devolve o decorator de verdade.',
        'E ao empilhar decorators, o mais **próximo da função** é aplicado primeiro.',
      ],
      board: {
        title: 'Decorator com parâmetros e empilhamento',
        code: `def repetir(vezes):                 # 1) recebe os parâmetros
    def decorador(func):            # 2) recebe a função
        @functools.wraps(func)
        def wrapper(*args, **kwargs):   # 3) substitui a função
            return [func(*args, **kwargs) for _ in range(vezes)]
        return wrapper
    return decorador


@repetir(3)
def ola():
    return "olá"

print(ola())    # ['olá', 'olá', 'olá']


@a
@b
def f(): ...
# equivale a: f = a(b(f))  → b embrulha primeiro, a fica por fora`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'A biblioteca padrão está cheia de decorators prontos. O `functools.lru_cache`, por exemplo, adiciona **memoização** a qualquer função pura.',
      ],
      board: {
        title: 'Decorators que você já deveria conhecer',
        md: `| Decorator | Para quê |
|---|---|
| \`@functools.lru_cache\` / \`@functools.cache\` | Memoização (guarda resultados) |
| \`@functools.wraps\` | Copia metadados da função original para o wrapper |
| \`@property\` | Método acessado como atributo |
| \`@classmethod\` / \`@staticmethod\` | Métodos de classe / estáticos |
| \`@dataclasses.dataclass\` | Gera \`__init__\`, \`__repr__\`, \`__eq__\` |

\`\`\`python
from functools import cache

@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

fib(100)   # instantâneo — O(n) em vez de O(2^n)
\`\`\`

> [!dica] Decorators são ótimos para **preocupações transversais** (logging, cache, retry, autorização, métricas) — coisas que não são a regra de negócio, mas se repetem em muitas funções.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Repare que um wrapper pode agir em três momentos: **antes** de chamar a função, **depois**, ou **em volta**, decidindo se e como ela roda.',
        { text: 'Essa ideia é mais velha que o `@` do Python — e tem um vocabulário próprio que pouca gente conhece.', mood: 'surprised' },
      ],
      board: {
        title: 'Antes, depois ou em volta',
        md: `| Momento | Termo da AOP | Exemplos de decorator |
|---|---|---|
| **antes** da chamada | *before advice* | autorização, validação de argumentos |
| **depois** da chamada | *after advice* | log do resultado, métricas |
| **em volta** (decide se e como chama) | *around advice* | cache, retry, timeout, \`cronometrar\` |

\`\`\`python
def autorizar(func):                      # "before": pode barrar a chamada
    @functools.wraps(func)
    def wrapper(usuario, *args, **kwargs):
        if not usuario.admin:
            raise PermissionError(usuario.nome)
        return func(usuario, *args, **kwargs)
    return wrapper
\`\`\`

> [!sabia] Os decorators são a versão "caseira" de uma ideia de 1997: a **programação orientada a aspectos** (AOP), nascida no Xerox PARC com a equipe de Gregor Kiczales. Na AOP, cada preocupação transversal vira um **aspecto**; o código que roda antes, depois ou em volta é o **advice**; e a regra que escolhe quais funções recebem o advice é o **pointcut**. O \`@Transactional\` do Spring, no Java, funciona assim. A diferença é que, no Python, você aplica o \`@\` função por função: o *pointcut* é você.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Embrulhe, empilhe e preserve metadados.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-decorator-q1',
      concept: 'Decorators Python',
      say: 'Aquecendo com a ordem de aplicação…',
      prompt: `Qual é a ordem de aplicação neste código?

\`\`\`python
@log
@autenticar
def transferir(valor): ...
\`\`\``,
      options: [
        { text: '`transferir = log(autenticar(transferir))`', correct: true, why: 'O decorator mais próximo da função (`autenticar`) é aplicado primeiro; `log` embrulha o resultado.' },
        { text: '`transferir = autenticar(log(transferir))`', why: 'É o contrário: a aplicação é de baixo para cima.' },
        { text: '`transferir = log(transferir) + autenticar(transferir)`', why: 'Decorators não são somados; cada um recebe o resultado do anterior.' },
        { text: 'A ordem não importa.', why: 'Importa muito: aqui o log registra inclusive chamadas que falham na autenticação; invertendo, não.' },
      ],
      explanation: 'Decorators são aplicados **de baixo para cima**: `@a @b def f` equivale a `f = a(b(f))`. Na chamada, o de fora (`log`) roda primeiro e chama o de dentro.',
    },
    {
      type: 'order',
      id: 'dp-rx2-decorator-order',
      concept: 'Empilhamento de decorators',
      say: 'E na hora da **execução**? Cada camada avisa quando entra e quando sai.',
      prompt: `Cada decorator imprime uma linha **antes** e outra **depois** de chamar a função que embrulha. Ordene as linhas impressas por \`transferir()\`:

\`\`\`python
def anunciar(nome):
    def decorador(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            print(f"entra {nome}")
            resultado = func(*args, **kwargs)
            print(f"sai {nome}")
            return resultado
        return wrapper
    return decorador

@anunciar("log")
@anunciar("auth")
def transferir():
    print("transferindo")
\`\`\``,
      items: ['`entra log`', '`entra auth`', '`transferindo`', '`sai auth`', '`sai log`'],
      explanation: 'Na **definição**, os decorators são aplicados de baixo para cima: `transferir = anunciar("log")(anunciar("auth")(transferir))`. Na **chamada**, a execução atravessa as camadas como uma cebola: entra pela de fora (`log`), passa pela de dentro (`auth`), chega à função e sai na ordem **inversa**. Por isso um `@log` por fora registra até as chamadas que o `@auth` barra.',
    },
    {
      type: 'mcq',
      id: 'dp-decorator-q2',
      concept: 'Decorator (GoF)',
      say: 'Agora sobre o padrão do GoF.',
      prompt: 'Por que o **Decorator** do GoF é preferível a subclasses para adicionais de café (leite, canela, chantilly…)?',
      options: [
        { text: 'Porque executa mais rápido que herança.', why: 'Desempenho não é a motivação; há até uma pequena indireção a mais.' },
        { text: 'Porque combinações são montadas em tempo de execução, sem uma classe para cada combinação.', correct: true, why: 'N decorators combináveis substituem 2^N subclasses.' },
        { text: 'Porque impede que o objeto original seja usado diretamente.', why: 'O original continua utilizável; o decorator apenas o embrulha.' },
        { text: 'Porque dispensa que os decorators tenham a mesma interface do objeto.', why: 'É o oposto: o decorator **precisa** ter a mesma interface para ser intercambiável.' },
      ],
      explanation: 'O Decorator usa **composição** e a **mesma interface** do componente, permitindo empilhar funcionalidades dinamicamente — algo que a herança só faria com uma explosão de subclasses.',
    },
    {
      type: 'code',
      id: 'dp-decorator-q3',
      concept: 'Decorator (GoF)',
      title: 'Cafeteria com decorators',
      say: 'Primeiro desafio: o Decorator clássico, por **composição**.',
      prompt: `A classe \`Cafe\` já existe (\`preco()\` = 5.0, \`descricao()\` = \`"café"\`).

Implemente os decorators \`ComLeite(bebida)\` e \`ComCanela(bebida)\`:

- \`ComLeite\`: preço **+ 1.5** e descrição com \`" + leite"\` no final;
- \`ComCanela\`: preço **+ 0.5** e descrição com \`" + canela"\` no final.

Eles devem funcionar com **qualquer bebida** que tenha \`preco()\` e \`descricao()\` — inclusive outro decorator (empilhamento).`,
      starter: `class Cafe:
    def preco(self):
        return 5.0

    def descricao(self):
        return "café"


class ComLeite:
    def __init__(self, bebida):
        pass

    def preco(self):
        pass

    def descricao(self):
        pass


class ComCanela:
    pass
`,
      tests: [
        { name: 'café com leite — preço', expr: 'ComLeite(Cafe()).preco()', expected: '6.5', compare: 'approx' },
        { name: 'café com leite — descrição', expr: 'ComLeite(Cafe()).descricao()', expected: '"café + leite"' },
        { name: 'empilhando', code: 'b = ComCanela(ComLeite(Cafe()))\nassert abs(b.preco() - 7.0) < 1e-9, f"preço {b.preco()}"\nassert b.descricao() == "café + leite + canela", b.descricao()' },
        { name: 'leite duplo', hidden: true, expr: 'ComLeite(ComLeite(Cafe())).preco()', expected: '8.0', compare: 'approx' },
        { name: 'qualquer bebida', hidden: true, code: 'class Cha:\n    def preco(self): return 3.0\n    def descricao(self): return "chá"\n\nb = ComCanela(Cha())\nassert b.descricao() == "chá + canela" and abs(b.preco() - 3.5) < 1e-9' },
      ],
      reviews: [
        {
          when: m => m.classes.some(c => ['ComLeite', 'ComCanela'].includes(c.name) && c.bases.includes('Cafe')),
          text: 'Seus decorators **herdam de `Cafe`**. Isso os amarra a uma bebida concreta e herda comportamento que você nem usa — o decorator deve **embrulhar** a bebida recebida (composição) e delegar a ela.',
          concept: 'Composição > herança',
        },
        {
          when: m => m.calls.includes('isinstance'),
          text: 'Checar o tipo da bebida com `isinstance` limita o decorator a tipos conhecidos. Apenas delegue para `bebida.preco()` / `bebida.descricao()`.',
          concept: 'Duck typing / polimorfismo',
        },
      ],
      hints: [
        'Guarde a bebida no `__init__`: `self.bebida = bebida`.',
        'Delegue e acrescente: `return self.bebida.preco() + 1.5` e `return self.bebida.descricao() + " + leite"`.',
      ],
      solution: `class Cafe:
    def preco(self):
        return 5.0

    def descricao(self):
        return "café"


class ComLeite:
    def __init__(self, bebida):
        self.bebida = bebida

    def preco(self):
        return self.bebida.preco() + 1.5

    def descricao(self):
        return self.bebida.descricao() + " + leite"


class ComCanela:
    def __init__(self, bebida):
        self.bebida = bebida

    def preco(self):
        return self.bebida.preco() + 0.5

    def descricao(self):
        return self.bebida.descricao() + " + canela"
`,
      solutionExplanation: 'Cada decorator guarda a bebida que embrulha, tem a **mesma interface** e delega para ela, acrescentando seu pedaço. Como não dependem de `Cafe`, funcionam com chá, com outro decorator ou com qualquer objeto que tenha `preco()` e `descricao()`.',
    },
    {
      type: 'code',
      id: 'dp-decorator-q4',
      concept: 'Decorators Python',
      title: '@retry(tentativas)',
      say: 'Agora o decorator mais pedido em entrevistas de backend: o **retry**.',
      prompt: `Implemente o decorator com parâmetro \`retry(tentativas)\`:

- chama a função decorada; se ela **lançar uma exceção**, tenta de novo, até o total de \`tentativas\` chamadas;
- se alguma chamada der certo, retorna o resultado imediatamente;
- se **todas** falharem, relança a **última** exceção;
- repassa \`*args\` e \`**kwargs\` e **preserva** \`__name__\` e \`__doc__\` da função original.

\`\`\`python
@retry(3)
def buscar_cotacao(moeda):
    ...  # às vezes lança ConnectionError
\`\`\``,
      starter: `import functools


def retry(tentativas):
    pass
`,
      tests: [
        { name: 'sucesso de primeira (1 chamada)', code: 'n = {"c": 0}\n@retry(3)\ndef ok():\n    n["c"] += 1\n    return "ok"\nassert ok() == "ok"\nassert n["c"] == 1, f"chamou {n[\'c\']} vezes"' },
        { name: 'falha 2x e depois funciona', code: 'n = {"c": 0}\n@retry(3)\ndef instavel():\n    n["c"] += 1\n    if n["c"] < 3:\n        raise ConnectionError("falhou")\n    return "ok"\nassert instavel() == "ok"\nassert n["c"] == 3' },
        { name: 'esgota as tentativas e relança', code: 'n = {"c": 0}\n@retry(2)\ndef sempre_falha():\n    n["c"] += 1\n    raise ValueError(f"falha {n[\'c\']}")\ntry:\n    sempre_falha()\nexcept ValueError as e:\n    assert str(e) == "falha 2", "relance a ÚLTIMA exceção"\nelse:\n    raise AssertionError("deveria relançar a exceção")\nassert n["c"] == 2, f"chamou {n[\'c\']} vezes"' },
        { name: 'preserva __name__ e __doc__', code: '@retry(2)\ndef minha_funcao():\n    """doc original"""\n    return 1\nassert minha_funcao.__name__ == "minha_funcao", "use functools.wraps"\nassert minha_funcao.__doc__ == "doc original"' },
        { name: 'repassa args e kwargs', hidden: true, code: '@retry(2)\ndef soma(a, b, extra=0):\n    return a + b + extra\nassert soma(1, 2, extra=3) == 6' },
      ],
      reviews: [
        {
          when: (m, code) => /except\s*:/.test(code) || /except\s+BaseException/.test(code),
          text: 'Um `except:` genérico (ou `BaseException`) captura até `KeyboardInterrupt` e `SystemExit` — seu retry impediria o usuário de interromper o programa. Capture `Exception`.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => !m.decorators.includes('wraps'),
          text: 'Você não usou `functools.wraps`. Copiar `__name__`/`__doc__` à mão esquece outros metadados (`__module__`, `__qualname__`, `__wrapped__`); `@functools.wraps(func)` faz tudo.',
          concept: 'functools.wraps',
        },
      ],
      hints: [
        'São três níveis: `def retry(tentativas):` → `def decorador(func):` → `def wrapper(*args, **kwargs):`.',
        'Dentro do wrapper: `for _ in range(tentativas):` com `try: return func(*args, **kwargs)` e `except Exception as e: ultimo_erro = e`.',
        'Depois do laço, `raise ultimo_erro`. E não esqueça o `@functools.wraps(func)` sobre o wrapper.',
      ],
      solution: `import functools


def retry(tentativas):
    def decorador(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            ultimo_erro = None
            for _ in range(tentativas):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    ultimo_erro = e
            raise ultimo_erro
        return wrapper
    return decorador
`,
      solutionExplanation: '`retry(3)` devolve o decorator, que devolve o `wrapper`. O `wrapper` tenta até `tentativas` vezes, retornando no primeiro sucesso; se todas falharem, relança a última exceção guardada. Capturar `Exception` (e não tudo) mantém `Ctrl+C` funcionando, e `functools.wraps` preserva os metadados da função. Em produção, adicionaríamos *backoff* (esperar cada vez mais entre tentativas) e só repetiríamos erros transitórios.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! O Decorator — do GoF ou do Python — **embrulha** para adicionar comportamento sem modificar o original.',
        'Guarde: composição + mesma interface no GoF; `functools.wraps` e três níveis para decorators com parâmetros no Python. Próximo: Adapter!',
      ],
      board: null,
    },
  ],
});
