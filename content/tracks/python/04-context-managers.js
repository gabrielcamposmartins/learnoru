(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  // Conexão de mentira usada nos testes da questão de transação (roda antes de cada teste).
  const CONEXAO_FALSA = py(`
    class ConexaoFalsa:
        """Registra begin/commit/rollback em self.log."""

        def __init__(self, falhar_commit=False):
            self.log = []
            self.falhar_commit = falhar_commit

        def begin(self):
            self.log.append("begin")

        def commit(self):
            self.log.append("commit")
            if self.falhar_commit:
                raise ConnectionError("commit falhou")

        def rollback(self):
            self.log.append("rollback")
  `);

  Game.registerModule('python', {
    id: 'context-managers',
    title: 'Context managers',
    kind: 'lesson',
    level: 2,
    order: 12,
    unit: 'funcional',
    summary: 'O que o `with` faz por baixo, o retorno de `__exit__` que engole exceções, `@contextmanager`, o pouco conhecido `ExitStack` e a caixa de ferramentas do `contextlib`.',
    concepts: ['Context managers', '__enter__ e __exit__', 'contextlib.contextmanager', 'ExitStack', 'contextlib'],
    takeaways: [
      '`with` garante a limpeza: chama `__enter__` na entrada (o `as` recebe o **retorno** dele) e `__exit__(tipo, exc, tb)` na saída — com ou sem exceção.',
      'Se `__exit__` devolver algo **verdadeiro**, a exceção é **suprimida** e o programa segue depois do `with`. Por padrão, devolva `None`/`False`; suprimir deve ser explícito e raro.',
      'Com `@contextmanager`, o que vem antes do `yield` é a entrada e o que vem depois é a saída — mas só roda em caso de erro se estiver num `try/finally`.',
      '`ExitStack` gerencia um número **dinâmico** de recursos, fecha tudo em ordem inversa (LIFO) e, com `pop_all()`, transfere a posse quando tudo deu certo.',
      '`suppress`, `closing`, `nullcontext` e `redirect_stdout` já vêm prontos. No mundo assíncrono, `async with` usa `__aenter__`/`__aexit__` e `@asynccontextmanager`.',
    ],
    glossary: [
      { term: 'Context manager', aliases: ['context managers', 'gerenciador de contexto', 'gerenciadores de contexto'], definition: 'Objeto que define o que acontece ao entrar e ao sair de um bloco `with` (`__enter__`/`__exit__`). Garante a limpeza de recursos mesmo quando ocorre uma exceção.' },
      { term: 'ExitStack', aliases: ['contextlib.ExitStack', 'AsyncExitStack'], definition: 'Context manager do `contextlib` que empilha outros context managers e callbacks em tempo de execução e os fecha em ordem inversa (LIFO) na saída — ideal para um número variável de recursos.' },
      { term: 'RAII', aliases: ['Resource Acquisition Is Initialization'], definition: 'Idioma do C++: o recurso é adquirido na criação de um objeto e liberado na sua destruição. Em Python, o equivalente explícito e confiável é o `with` — não o `__del__`.' },
      { term: 'Unit of Work', aliases: ['unidade de trabalho'], definition: 'Padrão que agrupa as alterações de uma operação de negócio numa transação: ou tudo é confirmado (*commit*) ou nada é (*rollback*). Um context manager de transação é a forma pythônica de expressá-lo.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Abrir é fácil; o difícil é **fechar** — em todos os caminhos, inclusive quando algo explode no meio.',
          'O `with` resolve isso. Vamos ver exatamente o que ele faz por baixo.',
        ],
        board: {
          title: 'O que o with faz por baixo',
          md: `\`\`\`python
f = open("dados.txt")
try:
    processar(f)
finally:
    f.close()                    # roda com ou sem exceção

with open("dados.txt") as f:     # a mesma garantia, sem cerimônia
    processar(f)
\`\`\`

O \`with\`, simplificado (PEP 343):

\`\`\`python
gerente = open("dados.txt")
f = gerente.__enter__()                  # o "as" recebe o RETORNO do __enter__
try:
    processar(f)
except BaseException as e:
    if not gerente.__exit__(type(e), e, e.__traceback__):
        raise                            # __exit__ devolveu falso: propaga
else:
    gerente.__exit__(None, None, None)   # saiu sem erro
\`\`\`

- O \`as\` recebe o que \`__enter__\` **devolve**, que nem sempre é o próprio objeto: \`open()\` devolve \`self\`, mas \`with trava as x:\` (um \`threading.Lock\`) dá \`x = True\`.
- \`__exit__\` roda em **qualquer** saída: fim normal, exceção, \`return\`, \`break\`.
- Não use \`__del__\` para liberar recursos: ele roda quando o coletor quiser (no PyPy, bem depois). O \`with\` é a versão Python do **RAII** do C++ — só que explícita, no bloco.

> [!sabia] \`with sqlite3.connect("app.db") as conn:\` **não fecha** a conexão! O context manager da \`Connection\` só faz *commit* (ou *rollback*, se houve exceção). Para fechar, use \`contextlib.closing(sqlite3.connect(...))\` ou chame \`conn.close()\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o detalhe que pouca gente conhece: o **valor de retorno** de `__exit__` importa.',
          'Se ele devolver algo verdadeiro, a exceção **some**. Isso é poder — e uma fonte de bugs silenciosos.',
        ],
        board: {
          title: 'O retorno de __exit__ pode engolir exceções',
          md: `\`\`\`python
class Ignorar:
    def __init__(self, *tipos):
        self.tipos = tipos

    def __enter__(self):
        return self

    def __exit__(self, tipo, exc, tb):
        # True = "eu tratei, pode seguir"
        return tipo is not None and issubclass(tipo, self.tipos)


with Ignorar(KeyError):
    porta = {}["porta"]          # KeyError... suprimido
    print("nunca roda")          # o resto do bloco é abandonado
print("segue a vida")            # executa
\`\`\`

| \`__exit__\` devolve | Efeito |
|---|---|
| \`None\` / \`False\` (ou nada) | a exceção **propaga** normalmente |
| valor verdadeiro | a exceção é **suprimida**; o código segue **depois** do \`with\` |
| lança outra exceção | ela **substitui** a original (que fica em \`__context__\`) |

O uso clássico de context manager em classe é a transação — o padrão **Unit of Work**: *commit* se o bloco terminou bem, *rollback* se não. Ela quase nunca deve suprimir: o erro precisa chegar a quem chamou.

> [!atencao] Bug sutil: um \`__exit__\` que termina com \`return self.ok\` ou \`return resultado\` pode engolir exceções sem ninguém perceber — **qualquer** valor *truthy* suprime, até a string \`"ok"\`. Se não é para suprimir, não devolva nada.`,
        },
      },
      {
        type: 'say',
        text: [
          'Escrever classe com `__enter__` e `__exit__` para tudo cansa. O `contextlib.contextmanager` transforma um **gerador** em context manager.',
          'Antes do `yield` é a entrada; depois é a saída. Mas cuidado com um detalhe: o `try/finally`.',
        ],
        board: {
          title: '@contextmanager: um gerador vira context manager',
          md: `\`\`\`python
import shutil
import tempfile
from contextlib import contextmanager

@contextmanager
def diretorio_temporario():
    caminho = tempfile.mkdtemp()     # antes do yield = __enter__
    try:
        yield caminho                # valor do "as"; o bloco do with roda AQUI
    finally:
        shutil.rmtree(caminho)       # depois do yield = __exit__ (sempre, graças ao finally)

with diretorio_temporario() as d:
    ...
\`\`\`

- Uma exceção no bloco do \`with\` é **relançada no ponto do \`yield\`**. Sem \`try/finally\`, a limpeza **não roda** em caso de erro — o bug mais comum com \`@contextmanager\`.
- Para suprimir: capture a exceção em volta do \`yield\` e não a relance.
- O gerador faz **exatamente um** \`yield\`. Dois dão \`RuntimeError: generator didn't stop\`.
- Bônus pouco conhecido: todo \`@contextmanager\` também funciona como **decorator** (\`@medir("relatorio")\` em cima de uma função) — o \`contextlib\` recria o gerador a cada chamada.

| | Classe (\`__enter__\`/\`__exit__\`) | \`@contextmanager\` |
|---|---|---|
| Código | mais verboso | curto, lido de cima para baixo |
| Estado e métodos extras | natural | desajeitado |
| Reutilizar o mesmo objeto | pode | não: cada chamada cria um novo |
| Suprimir exceção | \`return True\` | capturar em volta do \`yield\` |`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E quando você não sabe **quantos** recursos vai abrir? Três arquivos, dez, nenhum?',
          '`with` aninhado não resolve. Para isso existe uma joia escondida do `contextlib`: o `ExitStack`.',
        ],
        board: {
          title: 'ExitStack: recursos em número variável',
          md: `\`\`\`python
import heapq
from contextlib import ExitStack

def mesclar(caminhos, destino):
    with ExitStack() as pilha:
        entradas = [pilha.enter_context(open(c)) for c in caminhos]   # N arquivos
        saida = pilha.enter_context(open(destino, "w"))
        pilha.callback(print, "tudo fechado")     # qualquer função vira limpeza
        saida.writelines(heapq.merge(*entradas))
# na saída: fecha tudo em ordem INVERSA (LIFO) — mesmo que o 3º open() falhe no meio
\`\`\`

Se o terceiro \`open()\` falhar, os dois primeiros já estão na pilha e são fechados. Limpeza **condicional** também fica simples: \`if precisa_de_trava: pilha.enter_context(trava)\`.

\`\`\`python
class Servico:
    def __init__(self, abrir_db, abrir_cache):
        with ExitStack() as pilha:
            self.db = pilha.enter_context(abrir_db())
            self.cache = pilha.enter_context(abrir_cache())   # se falhar, fecha o db
            self._pilha = pilha.pop_all()     # deu certo: a posse passa para o objeto

    def close(self):
        self._pilha.close()                   # fecha cache e db, nessa ordem
\`\`\`

> [!sabia] Pouca gente conhece o \`ExitStack\`, mas ele resolve três problemas chatos: número **variável** de recursos, limpeza **condicional** e o construtor que adquire vários recursos e precisa desfazer os anteriores se um falhar — o \`pop_all()\` "desarma" a limpeza quando tudo deu certo. Existe também o \`AsyncExitStack\`, para \`async with\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'O `contextlib` ainda traz ferramentas prontas que poupam muito `try/except`.',
          'Cada uma tem uma pegadinha — a tabela mostra.',
        ],
        board: {
          title: 'A caixa de ferramentas do contextlib',
          md: `\`\`\`python
import io
import os
import sqlite3
from contextlib import closing, nullcontext, redirect_stdout, suppress

with suppress(FileNotFoundError):              # try/except/pass em uma linha
    os.remove("cache.tmp")

with closing(sqlite3.connect("app.db")) as conn:   # garante conn.close() na saída
    ...

def atualizar(dados, trava=None):
    with trava if trava is not None else nullcontext():   # recurso opcional
        ...

saida = io.StringIO()
with redirect_stdout(saida):                   # captura print() de código alheio
    funcao_barulhenta()
\`\`\`

| Ferramenta | Para quê | Cuidado |
|---|---|---|
| \`suppress(*excecoes)\` | ignorar exceções **esperadas** | o bloco **para** na primeira exceção — o resto não roda |
| \`closing(obj)\` | objetos com \`.close()\` mas sem \`with\` | só chama \`close()\`; nada de commit |
| \`nullcontext(valor)\` | recurso opcional, sem duplicar o bloco num \`if/else\` | o \`as\` recebe \`valor\` |
| \`redirect_stdout(f)\` | capturar o que é impresso | afeta o processo todo: evite com threads |
| \`chdir(caminho)\` (3.11+) | trocar de diretório temporariamente | também global ao processo |`,
        },
      },
      {
        type: 'say',
        text: [
          'Por último, o mundo assíncrono. Quando entrar e sair envolve **I/O** — pegar uma conexão do pool, por exemplo —, o `__enter__` precisaria esperar.',
          'Para isso existe o `async with`, com `__aenter__` e `__aexit__`.',
        ],
        board: {
          title: 'Context managers assíncronos (em linhas gerais)',
          md: `\`\`\`python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def conexao(pool):
    conn = await pool.acquire()        # a entrada pode esperar I/O
    try:
        yield conn
    finally:
        await pool.release(conn)       # a saída também

async def main(pool):
    async with conexao(pool) as conn:
        await conn.execute("SELECT 1")

    async with asyncio.timeout(2):     # 3.11+: timeout como context manager
        await operacao_lenta()

    async with asyncio.TaskGroup() as tg:     # 3.11+: tarefas com limpeza garantida
        tg.create_task(baixar(1))
        tg.create_task(baixar(2))
\`\`\`

- \`async with x\` faz \`await x.__aenter__()\` e \`await x.__aexit__(...)\`: entrada e saída podem esperar I/O **sem bloquear** o event loop.
- \`AsyncExitStack\` é o \`ExitStack\` do mundo assíncrono; \`aclosing()\` fecha geradores assíncronos.
- Um \`with\` comum dentro de \`async def\` funciona, mas se o \`__enter__\` fizer I/O bloqueante, trava o loop inteiro.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'O protocolo do with, supressão de exceções, contextlib, transações e cronômetro.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'py-ctx-q1',
        concept: '__enter__ e __exit__',
        say: 'Primeira: um context manager simpático demais. O que aparece na tela?',
        prompt: `O que este código imprime?

\`\`\`python
class Silencioso:
    def __enter__(self):
        return "recurso"

    def __exit__(self, tipo, exc, tb):
        print("saindo:", tipo.__name__ if tipo else None)
        return "ok"

with Silencioso() as r:
    print(r)
    1 / 0
    print("depois da divisão")
print("fim")
\`\`\``,
        options: [
          { text: '`recurso` → `saindo: ZeroDivisionError` → `fim`', correct: true, why: 'O `as` recebe o retorno do `__enter__`. A divisão lança; o `__exit__` roda e devolve `"ok"`, que é *truthy*: a exceção é suprimida e o programa segue **depois** do `with`.' },
          { text: '`recurso` → `saindo: ZeroDivisionError` → traceback do `ZeroDivisionError`', why: 'Seria assim se `__exit__` devolvesse `None` ou `False`. Qualquer valor verdadeiro — até a string `"ok"` — suprime a exceção.' },
          { text: '`recurso` → `saindo: ZeroDivisionError` → `depois da divisão` → `fim`', why: 'Suprimir não é "continuar de onde parou": o bloco é abandonado na exceção, e a execução segue na primeira linha **depois** do `with`.' },
          { text: '`<__main__.Silencioso object at ...>` → `saindo: ZeroDivisionError` → `fim`', why: 'O `as` recebe o **retorno** de `__enter__`, não o objeto usado no `with`. Aqui, a string `"recurso"`.' },
        ],
        explanation: 'Dois detalhes do protocolo em um exemplo: o `as` recebe o que `__enter__` devolve, e o `__exit__` decide o destino da exceção pelo seu retorno — verdadeiro suprime, falso deixa propagar. Por isso um `__exit__` que "devolve qualquer coisa" é perigoso: engole erros em silêncio.',
      },
      {
        type: 'order',
        id: 'py-ctx-q2',
        concept: 'Context managers',
        say: 'Agora ordene o protocolo do `with` quando o corpo lança uma exceção.',
        prompt: 'Ordene o que acontece em `with Transacao(conn) as tx: corpo()` quando `corpo()` lança uma exceção e o `__exit__` **não** a suprime.',
        items: [
          'Avalia `Transacao(conn)` e obtém o context manager',
          'Chama `__enter__()` e liga o **retorno** dele a `tx`',
          'Executa o corpo até a exceção',
          'Chama `__exit__(tipo, exc, tb)` com os dados da exceção',
          'Como `__exit__` devolveu falso, a exceção continua propagando',
        ],
        explanation: 'O `with` só entra no `try` depois que `__enter__` termina: se o próprio `__enter__` falhar, o `__exit__` **não** é chamado (não há o que limpar). Daí em diante, qualquer saída do bloco passa pelo `__exit__`, que recebe `(tipo, exc, tb)` — ou três `None` numa saída normal.',
      },
      {
        type: 'match',
        id: 'py-ctx-q3',
        concept: 'contextlib',
        say: 'Rodada rápida: associe cada ferramenta do `contextlib` ao seu uso.',
        prompt: 'Associe cada **ferramenta** ao problema que ela resolve.',
        pairs: [
          { left: '`suppress(FileNotFoundError)`', right: 'Ignorar uma exceção esperada, sem `try/except/pass`' },
          { left: '`closing(obj)`', right: 'Chamar `obj.close()` na saída de algo que não suporta `with`' },
          { left: '`nullcontext()`', right: 'Um `with` que não faz nada, para recurso opcional' },
          { left: '`ExitStack()`', right: 'Número variável de recursos, fechados em ordem inversa' },
          { left: '`redirect_stdout(buffer)`', right: 'Capturar o que um código de terceiros imprime' },
          { left: '`@contextmanager`', right: 'Escrever um context manager com um gerador e `yield`' },
        ],
        explanation: 'Antes de escrever um context manager do zero, olhe o `contextlib`. E lembre as pegadinhas: `suppress` abandona o resto do bloco na primeira exceção, `closing` não faz commit, e `redirect_stdout` afeta o processo inteiro.',
      },
      {
        type: 'code',
        id: 'py-ctx-q4',
        concept: '__enter__ e __exit__',
        title: 'Transação com commit e rollback',
        points: 50,
        say: 'Mão na massa: um context manager de transação de verdade — commit no sucesso, rollback no erro, e supressão só quando for pedida.',
        prompt: `Implemente a classe \`Transacao\` (o padrão *Unit of Work*) sobre uma conexão que tem \`begin()\`, \`commit()\` e \`rollback()\`:

- \`__enter__\` chama \`begin()\` e devolve a **conexão** (é o que o \`as\` recebe).
- Bloco terminou sem exceção → \`commit()\`.
- Bloco lançou exceção → \`rollback()\`, e a exceção **continua propagando**…
- …exceto se o tipo dela estiver em \`ignorar\` (ou for **subclasse** de um deles): aí faz \`rollback()\` e a **suprime**.
- Se o próprio \`commit()\` falhar → \`rollback()\`, e a exceção do commit propaga.
- Sem exceção, \`__exit__\` não suprime nada (devolve falso).

Nos testes, a conexão é uma \`ConexaoFalsa\` que registra as chamadas em \`conn.log\`, como \`["begin", "commit"]\`.`,
        starter: py(`
          class Transacao:
              """with Transacao(conn) as conn: ... -> commit no sucesso, rollback no erro."""

              def __init__(self, conn, ignorar=()):
                  self.conn = conn
                  self.ignorar = tuple(ignorar)

              def __enter__(self):
                  # TODO
                  pass

              def __exit__(self, tipo, exc, tb):
                  # TODO: commit ou rollback; devolva True só para as exceções de \`ignorar\`
                  pass
        `),
        tests: [
          {
            name: 'sucesso: begin e commit',
            setup: CONEXAO_FALSA,
            code: py(`
              conn = ConexaoFalsa()
              with Transacao(conn) as c:
                  assert c is conn, "o 'as' deve receber a conexão"
                  assert conn.log == ["begin"], conn.log
              assert conn.log == ["begin", "commit"], conn.log
            `),
          },
          {
            name: 'exceção: rollback e propaga',
            setup: CONEXAO_FALSA,
            code: py(`
              conn = ConexaoFalsa()
              try:
                  with Transacao(conn):
                      raise ValueError("saldo insuficiente")
              except ValueError as e:
                  assert str(e) == "saldo insuficiente"
              else:
                  raise AssertionError("a exceção deveria propagar depois do rollback")
              assert conn.log == ["begin", "rollback"], conn.log
            `),
          },
          {
            name: 'ignorar: rollback e suprime',
            setup: CONEXAO_FALSA,
            code: py(`
              class Cancelado(Exception):
                  pass

              conn = ConexaoFalsa()
              with Transacao(conn, ignorar=(Cancelado,)):
                  raise Cancelado()
              assert conn.log == ["begin", "rollback"], conn.log
            `),
          },
          {
            name: 'ignorar não engole outras exceções',
            setup: CONEXAO_FALSA,
            code: py(`
              class Cancelado(Exception):
                  pass

              conn = ConexaoFalsa()
              try:
                  with Transacao(conn, ignorar=(Cancelado,)):
                      raise KeyError("x")
              except KeyError:
                  pass
              else:
                  raise AssertionError("só as exceções de 'ignorar' podem ser suprimidas")
              assert conn.log == ["begin", "rollback"], conn.log
            `),
          },
          {
            name: 'commit falhou: rollback e propaga',
            setup: CONEXAO_FALSA,
            code: py(`
              conn = ConexaoFalsa(falhar_commit=True)
              try:
                  with Transacao(conn):
                      pass
              except ConnectionError:
                  pass
              else:
                  raise AssertionError("a falha do commit deveria propagar")
              assert conn.log == ["begin", "commit", "rollback"], conn.log
            `),
          },
          {
            name: 'subclasse de exceção ignorada também é suprimida',
            hidden: true,
            setup: CONEXAO_FALSA,
            code: py(`
              class Cancelado(Exception):
                  pass

              class CanceladoPeloUsuario(Cancelado):
                  pass

              conn = ConexaoFalsa()
              with Transacao(conn, ignorar=(Cancelado,)):
                  raise CanceladoPeloUsuario()
              assert conn.log == ["begin", "rollback"], conn.log
            `),
          },
          {
            name: 'sem exceção, __exit__ devolve falso',
            hidden: true,
            setup: CONEXAO_FALSA,
            code: py(`
              conn = ConexaoFalsa()
              t = Transacao(conn)
              assert t.__enter__() is conn
              assert not t.__exit__(None, None, None), "sem exceção, __exit__ deve devolver algo falso"
              assert conn.log == ["begin", "commit"], conn.log
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /^\s*raise\s+[a-z_]\w*\s*$/m.test(code),
            text: 'Relançar a exceção de dentro do `__exit__` (`raise exc`) funciona, mas mexe no traceback e confunde quem lê. O protocolo é outro: faça o rollback e **devolva `False`** — o Python propaga a exceção original, intacta.',
            concept: '__enter__ e __exit__',
          },
          {
            when: (m, code) => /except\s+Exception\b/.test(code),
            text: 'Com `except Exception` em volta do commit, um `KeyboardInterrupt` no meio dele deixaria a transação sem rollback. Para "limpar e relançar", `except BaseException:` + `raise` (ou `try/finally`) é o certo.',
            concept: 'Tratamento de erros',
          },
          {
            when: (m, code) => /__del__/.test(code),
            text: '`__del__` roda quando o coletor de lixo quiser — ou nunca, em ciclos e no encerramento. Commit/rollback pertencem ao `__exit__`, que tem hora certa para rodar.',
            concept: 'Context managers',
          },
        ],
        hints: [
          '`__enter__` chama `self.conn.begin()` e devolve `self.conn` — é isso que o `as` recebe.',
          'Em `__exit__(self, tipo, exc, tb)`, `tipo is None` significa sucesso → `commit()`. Senão, `rollback()` e devolva `issubclass(tipo, self.ignorar)`: `True` suprime, `False` deixa propagar.',
          'O commit pode falhar: envolva-o em `try:` … `except BaseException:` com `self.conn.rollback()` seguido de `raise` puro. No caminho de sucesso, devolva `False`.',
        ],
        solution: py(`
          class Transacao:
              """with Transacao(conn) as conn: ... -> commit no sucesso, rollback no erro."""

              def __init__(self, conn, ignorar=()):
                  self.conn = conn
                  self.ignorar = tuple(ignorar)

              def __enter__(self):
                  self.conn.begin()
                  return self.conn                    # é isto que o "as" recebe

              def __exit__(self, tipo, exc, tb):
                  if tipo is None:
                      try:
                          self.conn.commit()
                      except BaseException:
                          self.conn.rollback()        # commit falhou: desfaz e propaga
                          raise
                      return False
                  self.conn.rollback()
                  return issubclass(tipo, self.ignorar)   # True só para as "esperadas"
        `),
        solutionExplanation: 'O `__enter__` inicia a transação e entrega a conexão ao `as`. O `__exit__` decide pelo `tipo`: `None` significa que o bloco terminou bem, então é hora do commit — e, se o próprio commit falhar, o rollback roda antes de a exceção seguir (`except BaseException` + `raise` puro é o idioma de "limpar e relançar"). Com exceção no bloco, o rollback é incondicional, e o **retorno** faz o resto: `issubclass(tipo, self.ignorar)` devolve `True` só para os tipos esperados (e suas subclasses, como no `except`), suprimindo-os; para todo o resto, `False` deixa a exceção original propagar intacta. Com `ignorar=()`, o `issubclass` devolve sempre `False`.',
      },
      {
        type: 'code',
        id: 'py-ctx-q5',
        concept: 'contextlib.contextmanager',
        title: 'Cronômetro com relógio injetado',
        points: 40,
        say: 'Agora com `@contextmanager`: um cronômetro que mede o bloco mesmo quando ele explode — e com o relógio **injetado**, para os testes não dependerem do tempo real.',
        prompt: `Implemente \`cronometro(relogio=time.perf_counter, registrar=None)\` usando \`@contextmanager\`:

- Faz \`yield\` de um objeto \`Medicao\` (já definido) cujo \`segundos\` fica \`None\` durante o bloco.
- Na saída — **com ou sem exceção** — preenche \`medicao.segundos = fim - inicio\` e, se houver \`registrar\`, chama \`registrar(segundos)\`.
- Lê o relógio exatamente **duas** vezes por medição (início e fim). O padrão é \`time.perf_counter\`, que é **monotônico** (ao contrário de \`time.time\`, que pode andar para trás com ajustes do relógio do sistema).
- **Não** suprime exceções.
- Como todo \`@contextmanager\`, deve funcionar também como **decorator**: \`@cronometro(registrar=metricas.append)\` mede cada chamada da função.`,
        starter: py(`
          import time
          from contextlib import contextmanager
          from dataclasses import dataclass


          @dataclass
          class Medicao:
              segundos: float | None = None


          def cronometro(relogio=time.perf_counter, registrar=None):
              """Mede o bloco with: faz yield de uma Medicao e preenche .segundos na saída."""
              # TODO: decore com @contextmanager e use try/finally em volta do yield
        `),
        tests: [
          {
            name: 'mede com relógio injetado',
            code: py(`
              relogio = iter([100.0, 102.5]).__next__
              with cronometro(relogio) as m:
                  assert m.segundos is None, "durante o bloco, segundos ainda é None"
              assert m.segundos == 2.5, m.segundos
            `),
          },
          {
            name: 'mede mesmo com exceção e não a engole',
            code: py(`
              relogio = iter([5.0, 7.0]).__next__
              try:
                  with cronometro(relogio) as m:
                      raise ValueError("falhou")
              except ValueError:
                  pass
              else:
                  raise AssertionError("a exceção deveria propagar (não suprima!)")
              assert m.segundos == 2.0, f"a medição deve acontecer mesmo com exceção (try/finally em volta do yield); veio {m.segundos}"
            `),
          },
          {
            name: 'registrar recebe o tempo',
            code: py(`
              tempos = []
              relogio = iter([0.0, 0.75]).__next__
              with cronometro(relogio, registrar=tempos.append):
                  pass
              assert tempos == [0.75], tempos
            `),
          },
          {
            name: 'registrar também em caso de erro',
            code: py(`
              tempos = []
              relogio = iter([1.0, 4.0]).__next__
              try:
                  with cronometro(relogio, registrar=tempos.append):
                      raise KeyError("x")
              except KeyError:
                  pass
              assert tempos == [3.0], tempos
            `),
          },
          {
            name: 'funciona como decorator',
            code: py(`
              tempos = []
              relogio = iter([0.0, 1.5, 10.0, 10.25]).__next__

              @cronometro(relogio=relogio, registrar=tempos.append)
              def tarefa(x):
                  return x * 2

              assert tarefa(2) == 4 and tarefa(3) == 6
              assert tempos == [1.5, 0.25], tempos
            `),
          },
          {
            name: 'relógio lido 2 vezes; padrão perf_counter',
            hidden: true,
            code: py(`
              import inspect
              import time

              leituras = []
              def relogio_espiao():
                  leituras.append(1)
                  return float(len(leituras))

              with cronometro(relogio_espiao) as m:
                  pass
              assert len(leituras) == 2, f"o relógio deve ser lido 2 vezes (início e fim), foi lido {len(leituras)}"
              assert m.segundos == 1.0, m.segundos
              padrao = inspect.signature(cronometro).parameters["relogio"].default
              assert padrao is time.perf_counter, "o padrão deve ser time.perf_counter (monotônico)"
            `),
          },
          {
            name: 'medições independentes',
            hidden: true,
            code: py(`
              relogio = iter([0.0, 1.0, 0.0, 3.0]).__next__
              with cronometro(relogio) as a:
                  pass
              with cronometro(relogio) as b:
                  pass
              assert (a.segundos, b.segundos) == (1.0, 3.0), (a.segundos, b.segundos)
              assert a is not b, "cada medição precisa do seu próprio objeto Medicao"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => c.methods.includes('__enter__')),
            text: 'Funciona! Mas repare: com `@contextmanager` o mesmo cronômetro cabe em meia dúzia de linhas — e já vira decorator de graça, porque o objeto gerado herda de `ContextDecorator`.',
            concept: 'contextlib.contextmanager',
          },
          {
            when: (m, code) => /except\s+(Exception|BaseException)\b[\s\S]*raise/.test(code) && !/finally/.test(code),
            text: 'Capturar a exceção só para medir e relançar duplica a lógica de saída. `try: yield ...` / `finally:` roda a medição nos dois caminhos, e a exceção segue sozinha.',
            concept: 'contextlib.contextmanager',
          },
        ],
        hints: [
          'Decore `cronometro` com `@contextmanager`. Crie `medicao = Medicao()`, leia `inicio = relogio()` e faça `yield medicao`.',
          'A exceção do bloco é relançada **no `yield`**. Para medir mesmo assim, coloque o `yield` num `try:` e a medição no `finally:`.',
          'No `finally`: `medicao.segundos = relogio() - inicio` e, se `registrar is not None`, `registrar(medicao.segundos)`. Não capture a exceção — o `finally` não a engole.',
        ],
        solution: py(`
          import time
          from contextlib import contextmanager
          from dataclasses import dataclass


          @dataclass
          class Medicao:
              segundos: float | None = None


          @contextmanager
          def cronometro(relogio=time.perf_counter, registrar=None):
              """Mede o bloco with: faz yield de uma Medicao e preenche .segundos na saída."""
              medicao = Medicao()
              inicio = relogio()
              try:
                  yield medicao                        # o bloco do with roda aqui
              finally:                                 # com ou sem exceção
                  medicao.segundos = relogio() - inicio
                  if registrar is not None:
                      registrar(medicao.segundos)
        `),
        solutionExplanation: 'O `@contextmanager` divide o gerador em dois: até o `yield` é a entrada; depois, a saída. Como a exceção do bloco reaparece **no ponto do `yield`**, só o `try/finally` garante a medição nos dois caminhos — e o `finally` não suprime nada, então o erro segue para quem chamou. O relógio injetado (padrão `time.perf_counter`, monotônico) torna os testes determinísticos: uma lista de instantes vira o tempo. De brinde, o objeto criado pelo `@contextmanager` é um `ContextDecorator`: `@cronometro(...)` recria o gerador a cada chamada e mede cada execução.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Perfeito! Agora o `with` não tem mais mistério: `__enter__`, `__exit__`, o retorno que suprime, `@contextmanager` com `try/finally` e o `ExitStack` para os casos difíceis.',
          'Regra de ouro: todo recurso que precisa ser liberado merece um `with` — e nenhum `__exit__` deve engolir exceção sem querer.',
        ],
        board: null,
      },
    ],
  });
})();
