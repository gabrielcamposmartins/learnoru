(function () {
  // Tentativas instrumentadas usadas pelos testes (cada teste roda num namespace novo).
  const CORRIDA = `import asyncio

class _Corrida:
    """Tentativas instrumentadas: registram início, fim, falha e cancelamento."""
    def __init__(self):
        self.eventos = []

    def fonte(self, nome, atraso, erro=None):
        async def tentar():
            self.eventos.append(("inicio", nome))
            try:
                await asyncio.sleep(atraso)
            except asyncio.CancelledError:
                self.eventos.append(("cancelada", nome))
                raise
            if erro is not None:
                self.eventos.append(("falhou", nome))
                raise erro
            self.eventos.append(("fim", nome))
            return nome
        return tentar

    def canceladas(self):
        return sorted(n for e, n in self.eventos if e == "cancelada")

async def _sem_travar(coro, prazo=2):
    try:
        return await asyncio.wait_for(coro, prazo)
    except TimeoutError:
        raise AssertionError(f"primeiro_sucesso não terminou em {prazo} s: alguma tarefa ficou esperando para sempre") from None
`;

  Game.registerModule('concurrency', {
    id: 'asyncio',
    title: 'asyncio: event loop, corrotinas e tarefas',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'async',
    summary: 'Como uma única thread atende milhares de conexões: event loop, corrotinas × tarefas, `gather`, `TaskGroup`, timeouts e cancelamento — com código assíncrono de verdade.',
    concepts: ['Event loop', 'Corrotinas × tarefas', 'gather e TaskGroup', 'Structured concurrency', 'Timeouts e cancelamento'],
    takeaways: [
      'O event loop é **cooperativo**: uma tarefa só cede a vez num `await` que realmente espera. Entre dois `await`, o seu código roda sozinho — e quem não cede a vez trava todo mundo.',
      'Chamar uma função `async` só **cria** a corrotina. `await` a executa **agora** (sequencial); `create_task` a agenda para rodar **concorrentemente**.',
      '`gather` devolve os resultados na ordem dos argumentos; sem `return_exceptions`, a primeira exceção sobe e as irmãs **continuam rodando**. Com `return_exceptions=True`, as exceções entram na lista.',
      '`TaskGroup` (3.11+) é *structured concurrency*: nenhuma tarefa sobrevive ao bloco; se uma falha, as irmãs são canceladas e os erros chegam num `ExceptionGroup` (`except*`).',
      'Timeout no asyncio **é cancelamento**: `asyncio.timeout()` e `wait_for` cancelam a tarefa e convertem em `TimeoutError`. Limpe no `finally` e **nunca** engula `CancelledError`.',
    ],
    glossary: [
      { term: 'Event loop', aliases: ['loop de eventos', 'laço de eventos', 'event loops'], definition: 'O "motor" do `asyncio`: numa única thread, roda as tarefas prontas até o próximo `await` que espera, pergunta ao sistema operacional quais sockets e timers ficaram prontos e acorda as tarefas correspondentes.' },
      { term: 'Corrotina', aliases: ['corrotinas', 'coroutine', 'coroutines'], definition: 'Função que pode **pausar e continuar**. Chamar uma função `async def` devolve um objeto corrotina, que só executa quando alguém faz `await` nele ou o agenda como `Task`.' },
      { term: 'Multitarefa cooperativa', aliases: ['cooperativa', 'cooperative multitasking'], definition: 'Cada tarefa **cede a vez voluntariamente** — no `asyncio`, em cada `await` que espera. Ninguém é interrompido no meio do código, mas uma tarefa que não cede a vez trava todas as outras.' },
      { term: 'Structured concurrency', aliases: ['concorrência estruturada', 'concorrencia estruturada'], definition: 'Princípio de que tarefas concorrentes vivem dentro de um **escopo**: o bloco só termina quando todas as filhas terminam, e erros e cancelamentos seguem a hierarquia. Em Python: `asyncio.TaskGroup` (3.11+).' },
      { term: 'ExceptionGroup', aliases: ['ExceptionGroups', 'grupo de exceções', 'grupo de excecoes'], definition: 'Exceção que carrega **várias** exceções (atributo `.exceptions`), criada para erros concorrentes (3.11+). É tratada com `except*`, que casa partes do grupo por tipo.' },
      { term: 'Nursery', aliases: ['nurseries'], definition: 'O "berçário" da biblioteca **Trio**: um bloco `async with` onde as tarefas nascem e do qual não podem escapar — o bloco só termina quando todas terminam. Inspirou o `asyncio.TaskGroup`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) ao **asyncio**! A pergunta de hoje: como **uma única thread** atende dez mil conexões?',
          'Resposta curta: ela nunca fica parada esperando. Quem organiza isso é o **event loop**.',
        ],
        board: {
          title: '🍽️ O event loop: um garçom, muitas mesas',
          md: `Um bom garçom não fica parado ao lado da mesa esperando a cozinha: ele anota o pedido, **entrega à cozinha** e vai atender outra mesa. Quando um prato fica pronto, ele volta.

\`\`\`text
enquanto houver tarefas:
    1. roda cada tarefa PRONTA até ela chegar num await que precisa esperar
    2. pergunta ao SO (epoll / kqueue / IOCP): "algum socket ficou pronto?"
       — e dorme, no máximo, até o próximo timer
    3. marca como prontas as tarefas cujo I/O ou timer chegou
\`\`\`

| Tarefa | Estado |
|---|---|
| A: \`await sock.recv()\` | esperando dados da rede |
| B: \`await asyncio.sleep(1)\` | esperando um timer |
| C: calculando entre dois \`await\` | **rodando** — só ela, até ceder a vez |

É **multitarefa cooperativa**: ninguém é interrompido no meio. Uma tarefa só cede a vez num \`await\` que realmente espera, e isso tem um lado bom e um ruim:

- ✅ entre dois \`await\` o seu código roda **sozinho**: \`contador += 1\` não sofre corrida;
- ❌ se uma tarefa não cede a vez (\`time.sleep\`, CPU pesado), **todas** as outras param.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o detalhe que mais confunde: chamar uma função `async` **não executa nada**. Só cria uma corrotina.',
          'Quem faz a corrotina andar é o `await` (agora, esperando) ou o `create_task` (concorrente, sem esperar).',
        ],
        board: {
          title: 'Corrotina × Task × await',
          code: `import asyncio

async def buscar(nome, segundos):
    await asyncio.sleep(segundos)          # ponto de espera: cede o loop
    return f"{nome} ok"

async def main():
    c = buscar("a", 1)                     # só CRIA a corrotina — nada rodou ainda
    print(await c)                         # roda AGORA e espera: 1 s

    # sequencial: 1 s + 1 s = 2 s
    r1 = await buscar("a", 1)
    r2 = await buscar("b", 1)

    # concorrente: ~1 s no total
    t1 = asyncio.create_task(buscar("a", 1))   # agendada: começa no próximo ponto de espera
    t2 = asyncio.create_task(buscar("b", 1))
    r1 = await t1                               # t2 já está rodando enquanto esperamos t1
    r2 = await t2

asyncio.run(main())                        # cria o loop, roda main() e fecha o loop`,
          caption: 'A corrotina é a receita; a `Task` é o pedido já entregue à cozinha — roda sozinha e tem `cancel()`, `done()` e `result()`. Corrotina criada e nunca aguardada gera o aviso *"coroutine … was never awaited"*.',
        },
      },
      {
        type: 'say',
        text: [
          'Para disparar várias e esperar todas, o clássico é o `asyncio.gather`.',
          'Ele devolve os resultados **na ordem dos argumentos** — mas o comportamento com erros tem pegadinha.',
        ],
        board: {
          title: 'asyncio.gather e return_exceptions',
          md: `\`\`\`python
async def ok(n):
    await asyncio.sleep(0.1)
    return n

async def falha():
    await asyncio.sleep(0.05)
    raise ValueError("deu ruim")

await asyncio.gather(ok(1), ok(2))                  # [1, 2] — na ordem dos argumentos

await asyncio.gather(ok(1), falha(), ok(3))         # o ValueError sobe para quem esperou…
                                                    # …e ok(1) e ok(3) CONTINUAM rodando!

await asyncio.gather(ok(1), falha(), ok(3), return_exceptions=True)
# [1, ValueError('deu ruim'), 3] — as exceções viram valores na lista
\`\`\`

| | sem \`return_exceptions\` | com \`return_exceptions=True\` |
|---|---|---|
| Uma tarefa falha | a **primeira** exceção sobe na hora | a exceção entra na lista, no lugar do resultado |
| As outras tarefas | **continuam rodando** (ninguém as cancela) | continuam e terminam normalmente |
| Bom para | "tudo ou nada" simples | resultados **parciais**: uso o que deu certo |

> [!atencao] Se o próprio \`gather\` for cancelado, ele cancela todas as filhas. Mas, se uma filha **falhar**, as irmãs seguem vivas sem ninguém esperando por elas — a porta de entrada para tarefas órfãs.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Desde o Python 3.11 existe um jeito mais seguro: o `asyncio.TaskGroup`.',
          'A ideia tem nome: *structured concurrency*. Nenhuma tarefa sobrevive ao bloco que a criou.',
        ],
        board: {
          title: '🌳 TaskGroup: structured concurrency',
          md: `\`\`\`python
async def painel(usuario_id):
    async with asyncio.TaskGroup() as tg:
        perfil = tg.create_task(buscar_perfil(usuario_id))
        pedidos = tg.create_task(buscar_pedidos(usuario_id))
    # aqui TODAS as tarefas terminaram — garantido
    return perfil.result(), pedidos.result()

try:
    dados = await painel(42)
except* ConnectionError as grupo:          # ExceptionGroup: pode haver várias falhas
    for erro in grupo.exceptions:
        log.warning("serviço fora do ar: %s", erro)
\`\`\`

Se **uma** filha falha, o \`TaskGroup\`:
1. **cancela** as irmãs que ainda estão rodando;
2. **espera** todas terminarem (os \`finally\` de limpeza rodam);
3. lança um \`ExceptionGroup\` com **todas** as exceções reais (os cancelamentos ficam de fora).

| | \`gather\` | \`TaskGroup\` |
|---|---|---|
| Uma falha | a exceção sobe; as irmãs continuam | as irmãs são **canceladas** |
| Erros | só o primeiro (ou a lista, com \`return_exceptions\`) | **todos**, num \`ExceptionGroup\` (\`except*\`) |
| Tarefas depois do bloco | podem sobrar órfãs | **nenhuma** — é garantido |
| Resultados parciais | ✅ \`return_exceptions=True\` | trate os erros dentro de cada tarefa |

> [!sabia] O termo *structured concurrency* foi cunhado por Martin Sústrik (2016) e popularizado pelo ensaio de Nathaniel J. Smith *"Notes on structured concurrency, or: Go statement considered harmful"* (2018): disparar uma tarefa solta é como um \`goto\` — o fluxo escapa do bloco e ninguém garante quem vai esperar por ela ou tratar os seus erros. A biblioteca **Trio** chamou o escopo de *nursery* (berçário), e o \`TaskGroup\` do asyncio veio dessa ideia.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Toda chamada de rede precisa de prazo. E no asyncio, **timeout é cancelamento**: estourou o tempo, a tarefa é cancelada por dentro.',
          'Desde o 3.11 temos `asyncio.timeout()`, que põe prazo num **bloco** inteiro.',
        ],
        board: {
          title: '⏱️ Timeouts: asyncio.timeout e wait_for',
          code: `import asyncio

# 3.11+: prazo para um BLOCO (pode ter vários awaits)
async def carregar():
    try:
        async with asyncio.timeout(2):
            dados = await buscar()
            await salvar(dados)
    except TimeoutError:          # desde o 3.11, asyncio.TimeoutError É o TimeoutError embutido
        log.warning("carregar() passou de 2 s")

# prazo para UMA espera
async def saldo_ou_cache():
    try:
        return await asyncio.wait_for(buscar_saldo(), timeout=0.5)
    except TimeoutError:
        return CACHE["saldo"]

# prazo absoluto (em loop.time()) e ajustável
async def com_prazo(deadline):
    async with asyncio.timeout_at(deadline) as cm:
        await etapa_1()
        cm.reschedule(cm.when() + 1)          # ganhou mais 1 s
        await etapa_2()`,
          caption: 'Por baixo, os dois cancelam a tarefa quando o prazo acaba e convertem o `CancelledError` em `TimeoutError` na saída. Por isso o timeout só "pega" num `await`: um laço de CPU sem `await` nunca é interrompido.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E o cancelamento em si? `task.cancel()` é um **pedido**: a tarefa recebe um `CancelledError` no `await` em que está parada.',
          'Ela pode limpar a casa no `finally` — mas deve deixar o erro seguir. Engolir o cancelamento quebra timeouts e TaskGroups.',
        ],
        board: {
          title: '🛑 Cancelamento e CancelledError',
          code: `async def worker(conexao):
    try:
        while True:
            msg = await conexao.receber()      # ← o CancelledError aparece AQUI
            await processar(msg)
    except asyncio.CancelledError:
        await conexao.enviar("tchau")          # limpeza rápida (pode ter await)
        raise                                  # re-lance: SEMPRE
    finally:
        conexao.fechar()                       # roda em qualquer caso

tarefa = asyncio.create_task(worker(con))
...
tarefa.cancel()                  # pede o cancelamento — não é instantâneo
try:
    await tarefa                 # espera a limpeza terminar
except asyncio.CancelledError:
    pass                         # esperado: fomos nós que cancelamos
print(tarefa.cancelled())        # True`,
          caption: '`CancelledError` herda de `BaseException` (desde o 3.8) justamente para escapar de `except Exception`. Para proteger uma operação que não pode parar pela metade, existe `asyncio.shield(...)`: ela segue rodando mesmo se quem espera for cancelado.',
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Tarefas, gather, TaskGroup e cancelamento — rodando de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'conc-aio-q1',
        concept: 'Corrotinas × tarefas',
        say: 'Primeira pergunta: quanto tempo leva?',
        prompt: `\`\`\`python
import asyncio

async def espera(s):
    await asyncio.sleep(s)
    return s

async def main():
    t = asyncio.create_task(espera(2))
    await espera(1)
    await espera(1)
    await t
\`\`\`

Quanto tempo \`main()\` leva, aproximadamente?`,
        options: [
          { text: '4 s: 2 + 1 + 1, uma coisa de cada vez.', why: 'A Task `t` não espera ninguém: ela começa a rodar assim que `main` chega no primeiro `await` que espera.' },
          { text: '2 s: a Task `t` roda enquanto acontecem as duas esperas sequenciais de 1 s; no `await t`, ela já está terminando.', correct: true, why: 'Os dois `await espera(1)` são sequenciais (1 + 1 = 2 s) e, nesse tempo, `t` completa os seus 2 s. O `await t` só recolhe o resultado.' },
          { text: '1 s: tudo roda em paralelo, então só conta uma espera de 1 s.', why: 'Os dois `await espera(1)` diretos são **sequenciais**: o segundo só começa quando o primeiro termina.' },
          { text: '3 s: a Task só começa a rodar quando alguém faz `await t`.', why: 'Esse é o comportamento de uma **corrotina** solta. Uma Task é agendada no `create_task` e começa no próximo ponto de espera do loop.' },
        ],
        explanation: '`await corrotina` executa **agora** e espera — é sequencial. `create_task` entrega a corrotina ao event loop, que a roda sempre que a tarefa atual ceder a vez. Linha do tempo: em t = 0, `t` começa a dormir 2 s; `main` dorme 1 s e depois mais 1 s; em t = 2 s as duas coisas terminam juntas. Regra prática: para rodar em paralelo, **crie as tarefas antes** de esperar por elas.',
      },
      {
        type: 'match',
        id: 'conc-aio-q2',
        concept: 'APIs do asyncio',
        say: 'Cada ferramenta do asyncio com o seu papel. Associe!',
        prompt: 'Associe cada **chamada** ao que ela faz.',
        pairs: [
          { left: '`await coro`', right: 'Executa agora e espera o resultado' },
          { left: '`asyncio.create_task(coro)`', right: 'Agenda para rodar concorrentemente e devolve uma Task' },
          { left: '`asyncio.gather(..., return_exceptions=True)`', right: 'Resultados na ordem; as exceções entram na lista' },
          { left: '`asyncio.TaskGroup()`', right: 'Escopo: se uma tarefa falha, cancela as irmãs' },
          { left: '`asyncio.timeout(2)`', right: 'Cancela o bloco após 2 s e lança `TimeoutError`' },
          { left: '`asyncio.shield(t)`', right: 'Protege a operação do cancelamento de quem espera' },
        ],
        explanation: '`await` é sequencial; `create_task` é concorrente. `gather` reúne resultados (e, com `return_exceptions=True`, falhas) na ordem dos argumentos; `TaskGroup` dá escopo às tarefas e cancela as irmãs quando uma falha. `timeout` transforma prazo em cancelamento. E `shield` impede que o cancelamento de quem espera atinja a operação protegida — útil para um commit que não pode parar pela metade.',
      },
      {
        type: 'mcq',
        id: 'conc-aio-q3',
        concept: 'gather × TaskGroup',
        say: 'Agora a pegadinha do `gather` que já derrubou muito serviço.',
        prompt: `\`\`\`python
async def main():
    try:
        await asyncio.gather(baixar("a"), baixar("b"), baixar("c"))
    except ConnectionError:
        print("falhou")
\`\`\`

\`baixar("b")\` lança \`ConnectionError\` logo no começo; \`a\` e \`c\` ainda levariam vários segundos. O que acontece?`,
        options: [
          { text: '"falhou" é impresso na hora, e `baixar("a")` e `baixar("c")` **continuam rodando** sem ninguém esperando por elas.', correct: true, why: 'Sem `return_exceptions`, a primeira exceção sobe imediatamente — e o `gather` não cancela as irmãs.' },
          { text: 'O `gather` cancela `a` e `c` automaticamente e então lança a exceção.', why: 'Isso é o que o `TaskGroup` faz. O `gather` só cancela as filhas quando **ele próprio** é cancelado.' },
          { text: 'O `gather` espera `a` e `c` terminarem e só então lança o `ConnectionError`.', why: 'Sem `return_exceptions`, a primeira exceção sobe **imediatamente** para quem espera o `gather`.' },
          { text: 'O `gather` devolve `[resultado_a, None, resultado_c]`.', why: 'Nem com `return_exceptions=True` seria `None`: nesse modo, o próprio objeto da exceção entra na lista.' },
        ],
        explanation: 'É a pegadinha do `gather`: a exceção sobe na hora, mas as irmãs viram **órfãs** — continuam ocupando conexões e podem falhar sem ninguém ver. Troque por `TaskGroup` (cancela as irmãs e reúne os erros num `ExceptionGroup`) ou, se o objetivo são resultados parciais, use `return_exceptions=True` e trate item a item.',
      },
      {
        type: 'code',
        id: 'conc-aio-q4',
        concept: 'Cancelamento de tarefas',
        title: 'O primeiro que responder',
        timeoutMs: 15000,
        say: 'Mão na massa, com asyncio de verdade! Os testes medem se as tentativas rodam juntas e se as perdedoras são canceladas.',
        prompt: `Implemente a corrotina \`primeiro_sucesso(fabricas)\`:

- \`fabricas\` é uma lista de **funções assíncronas sem argumentos**: chamar \`f()\` cria a corrotina de uma tentativa (ex.: o mesmo dado pedido a réplicas diferentes).
- Dispare **todas ao mesmo tempo** e devolva o resultado da **primeira que terminar com sucesso**.
- Tentativas que falham (qualquer \`Exception\`) não vencem: continue esperando as outras.
- Assim que houver um vencedor, **cancele as demais e espere-as terminar** — nada pode continuar rodando depois que a função retornar (nem se quem chamou for cancelado).
- Se **todas** falharem, lance um \`ExceptionGroup\` com todas as exceções.
- Lista vazia → \`ValueError\`.

É o padrão por trás do *Happy Eyeballs* (RFC 8305): tentar IPv6 e IPv4 em paralelo e ficar com a primeira conexão que der certo.`,
        starter: `import asyncio

async def primeiro_sucesso(fabricas):
    # TODO: dispare todas ao mesmo tempo e fique com a primeira que der certo
    for fabrica in fabricas:
        try:
            return await fabrica()        # sequencial: uma de cada vez
        except Exception:
            pass
    raise ValueError("nenhuma tentativa deu certo")
`,
        tests: [
          { name: 'devolve a tentativa mais rápida', code: CORRIDA + `
c = _Corrida()
r = await _sem_travar(primeiro_sucesso([c.fonte("lenta", 0.3), c.fonte("rapida", 0.01), c.fonte("media", 0.1)]))
assert r == "rapida", f"esperado 'rapida', obtido {r!r}"
` },
          { name: 'todas começam juntas (concorrência de verdade)', code: CORRIDA + `
c = _Corrida()
await _sem_travar(primeiro_sucesso([c.fonte("a", 0.05), c.fonte("b", 0.02), c.fonte("c", 0.08)]))
primeiro_fim = next(i for i, (e, _) in enumerate(c.eventos) if e == "fim")
iniciadas = {n for e, n in c.eventos[:primeiro_fim] if e == "inicio"}
assert iniciadas == {"a", "b", "c"}, f"só {sorted(iniciadas)} tinham começado quando a primeira terminou: as tentativas devem rodar ao mesmo tempo"
` },
          { name: 'as perdedoras são canceladas antes do retorno', code: CORRIDA + `
c = _Corrida()
r = await _sem_travar(primeiro_sucesso([c.fonte("lenta", 0.3), c.fonte("rapida", 0.01), c.fonte("media", 0.1)]))
assert r == "rapida", f"obtido {r!r}"
assert c.canceladas() == ["lenta", "media"], f"quando primeiro_sucesso retornou, as perdedoras deveriam estar canceladas (eventos: {c.eventos}). Cancele e ESPERE as tarefas antes de retornar."
` },
          { name: 'uma falha rápida não vence', code: CORRIDA + `
c = _Corrida()
r = await _sem_travar(primeiro_sucesso([c.fonte("quebrada", 0.01, ConnectionError("recusada")), c.fonte("ok", 0.05)]))
assert r == "ok", f"uma tentativa que falhou não pode vencer: obtido {r!r}"
` },
          { name: 'todas falham: ExceptionGroup com todos os erros', code: CORRIDA + `
c = _Corrida()
fontes = [
    c.fonte("a", 0.01, ConnectionError("a caiu")),
    c.fonte("b", 0.03, RuntimeError("b sem resposta")),
    c.fonte("c", 0.02, ValueError("c inválida")),
]
try:
    await _sem_travar(primeiro_sucesso(fontes))
except ExceptionGroup as grupo:
    msgs = sorted(str(e) for e in grupo.exceptions)
    assert msgs == ["a caiu", "b sem resposta", "c inválida"], f"o grupo deveria ter os 3 erros, tem: {msgs}"
except Exception as e:
    raise AssertionError(f"esperado ExceptionGroup, veio {type(e).__name__}: {e}")
else:
    raise AssertionError("com todas falhando, deveria lançar ExceptionGroup")
` },
          { name: 'lista vazia lança ValueError', code: `
try:
    await primeiro_sucesso([])
except ValueError:
    pass
else:
    raise AssertionError("lista vazia deveria lançar ValueError")
` },
          { name: 'uma tentativa só', hidden: true, code: CORRIDA + `
c = _Corrida()
r = await _sem_travar(primeiro_sucesso([c.fonte("unica", 0.01)]))
assert r == "unica", f"obtido {r!r}"
assert c.canceladas() == [], f"nada deveria ser cancelado: {c.eventos}"
` },
          { name: 'nada fica rodando depois do retorno', hidden: true, code: CORRIDA + `
c = _Corrida()
antes = asyncio.all_tasks()
await _sem_travar(primeiro_sucesso([c.fonte("x", 0.2), c.fonte("y", 0.01), c.fonte("z", 0.2)]))
eu = asyncio.current_task()
sobrando = [t for t in asyncio.all_tasks() - antes if t is not eu and not t.done()]
assert not sobrando, f"{len(sobrando)} tarefa(s) continuam rodando depois que primeiro_sucesso retornou"
` },
          { name: 'cancelamento de fora cancela todas as tentativas', hidden: true, code: CORRIDA + `
c = _Corrida()
try:
    async with asyncio.timeout(0.03):
        await primeiro_sucesso([c.fonte("a", 0.5), c.fonte("b", 0.5)])
except TimeoutError:
    pass
else:
    raise AssertionError("o timeout de fora deveria ter estourado")
for _ in range(3):
    await asyncio.sleep(0)
assert c.canceladas() == ["a", "b"], f"quem chamou foi cancelado (timeout), então as tentativas também deveriam ser: {c.eventos}"
` },
        ],
        reviews: [
          {
            when: m => m.calls.includes('sleep'),
            text: 'Você usou `sleep` para esperar os resultados (*polling*). Isso adiciona latência e gasta ciclos do loop: `asyncio.as_completed` ou `asyncio.wait(..., return_when=FIRST_COMPLETED)` acordam **exatamente** quando uma tarefa termina.',
            concept: 'Polling × espera por evento',
          },
          {
            when: (m, code) => m.bareExcepts > 0 || /except\s*\(?[^:\n]*\bBaseException\b/.test(code),
            text: '`except:` puro ou `except BaseException` engolem o `CancelledError`: se quem chamou cancelar (um timeout, por exemplo), sua função segue rodando como se nada tivesse acontecido. Capture `Exception` — o cancelamento precisa passar.',
            concept: 'Não engolir CancelledError',
          },
        ],
        hints: [
          'Crie **todas** as tarefas de uma vez, com `asyncio.create_task(f())` — só assim elas rodam ao mesmo tempo.',
          '`for proxima in asyncio.as_completed(tarefas):` entrega as tarefas **na ordem em que terminam**. `return await proxima` devolve a primeira que der certo; num `except Exception`, guarde o erro e siga para a próxima.',
          'Envolva tudo num `try/finally`: no `finally`, chame `t.cancel()` em todas e `await asyncio.gather(*tarefas, return_exceptions=True)` para esperar a limpeza. Se o laço acabar sem vencedor, `raise ExceptionGroup("todas falharam", erros)`.',
        ],
        solution: `import asyncio

async def primeiro_sucesso(fabricas):
    if not fabricas:
        raise ValueError("nenhuma tentativa")
    tarefas = [asyncio.create_task(f()) for f in fabricas]
    erros = []
    try:
        for proxima in asyncio.as_completed(tarefas):
            try:
                return await proxima          # a primeira que TERMINAR com sucesso
            except Exception as erro:         # falhou: guarda e espera a próxima
                erros.append(erro)
        raise ExceptionGroup("todas as tentativas falharam", erros)
    finally:
        for t in tarefas:
            t.cancel()                        # não faz nada nas que já terminaram
        await asyncio.gather(*tarefas, return_exceptions=True)
`,
        solutionExplanation: '`create_task` dispara todas as tentativas de uma vez; `as_completed` as entrega **na ordem em que terminam**, então o primeiro `return` bem-sucedido é o vencedor e as falhas são guardadas. O `finally` é o coração da solução: ele roda no retorno, na exceção **e no cancelamento vindo de fora** (o timeout de quem chamou) — cancela todas as tarefas (em quem já terminou, `cancel()` não faz nada) e **espera** a limpeza com `gather(..., return_exceptions=True)`. Assim nada sobrevive à função: é *structured concurrency* feita à mão. Com todas falhando, o `ExceptionGroup` preserva **todos** os erros, como faz o `TaskGroup`. E repare que `except Exception` não captura `CancelledError` (é `BaseException`): o cancelamento de fora passa direto, como deve.',
      },
      {
        type: 'order',
        id: 'conc-aio-q5',
        concept: 'TaskGroup e cancelamento',
        say: 'Vamos acompanhar, passo a passo, uma falha dentro de um TaskGroup.',
        prompt: 'Três tarefas rodam num `async with asyncio.TaskGroup() as tg:`. A tarefa B lança `ValueError`. Coloque os acontecimentos em ordem.',
        items: [
          'A tarefa B lança `ValueError`',
          'O TaskGroup cancela as irmãs A e C, que ainda estavam rodando',
          'A e C recebem `CancelledError` no `await` em que estavam paradas',
          'Os blocos `finally` de A e C fazem a limpeza',
          'O `async with` termina lançando um `ExceptionGroup` com o `ValueError`',
          'Um `except* ValueError` de quem chamou trata o erro',
        ],
        explanation: 'O `TaskGroup` nunca abandona tarefas: antes de propagar o erro, ele cancela as irmãs e **espera** todas terminarem — por isso a limpeza acontece antes de o erro sair do bloco. O `ExceptionGroup` reúne só as exceções "de verdade" (os `CancelledError` das irmãs não entram). E, se o código no **corpo** do `async with` falhar, o efeito é o mesmo: as filhas são canceladas.',
      },
      {
        type: 'open',
        id: 'conc-aio-q6',
        concept: 'gather × TaskGroup',
        say: 'Para fechar, explique com as suas palavras — é pergunta frequente em entrevista.',
        prompt: 'Um colega pergunta: *"Qual a diferença entre `asyncio.gather` e `asyncio.TaskGroup`? Quando usar cada um?"* Explique para ele.',
        minWords: 25,
        rubric: [
          { label: 'Com `TaskGroup`, uma falha **cancela as irmãs**; com `gather`, elas continuam rodando', keywords: ['cancela as', 'cancela os', 'cancela todas', 'cancela todos', 'cancela o resto', 'cancelad', 'continuam rodando', 'continuam executando', 'orfa'], concept: 'gather × TaskGroup', why: 'É a diferença que mais pesa em produção: tarefas órfãs seguem consumindo recursos sem ninguém esperar por elas.' },
          { label: '`TaskGroup` reúne **todos** os erros num `ExceptionGroup` (`except*`); o `gather` propaga só o primeiro', keywords: ['exceptiongroup', 'exception group', 'except*', 'grupo de exce', 'todos os erros', 'todas as exce', 'primeira exce', 'primeiro erro'], concept: 'ExceptionGroup', why: 'Com várias falhas simultâneas, o `ExceptionGroup` não perde nenhuma.' },
          { label: '`gather(..., return_exceptions=True)` serve para **resultados parciais**', keywords: ['return_exceptions', 'return exceptions', 'parcia', 'o que deu certo', 'mesmo que algumas falhem'], concept: 'return_exceptions', why: 'Quando faz sentido usar o que deu certo e tratar as falhas item a item.' },
          { label: 'Cita **structured concurrency** / escopo: nenhuma tarefa sobrevive ao bloco', keywords: ['structured', 'estruturad', 'escopo', 'sobreviv', 'nursery', 'bercario', 'nenhuma tarefa'], concept: 'Structured concurrency', why: 'O `TaskGroup` garante que, ao sair do bloco, todas as tarefas terminaram.' },
        ],
        modelAnswer: `Os dois rodam várias corrotinas ao mesmo tempo, mas tratam falhas de forma bem diferente.

- No \`TaskGroup\` (3.11+), se uma tarefa falha, ele **cancela as irmãs**, espera todas terminarem e lança um **\`ExceptionGroup\`** com todos os erros (tratado com \`except*\`). Nenhuma tarefa sobrevive ao bloco \`async with\` — é *structured concurrency*.
- No \`gather\`, a primeira exceção sobe na hora e as outras tarefas **continuam rodando**, órfãs. Com \`return_exceptions=True\`, ele devolve as exceções na lista, o que é ótimo para **resultados parciais**.

Eu uso \`TaskGroup\` como padrão para "tudo ou nada" e \`gather(..., return_exceptions=True)\` quando quero aproveitar o que deu certo e tratar as falhas item a item.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora você sabe o que o event loop faz, quando uma corrotina roda de verdade e como o `TaskGroup` evita tarefas órfãs.',
          'Na próxima aula, **padrões**: `Semaphore`, filas e backpressure para fazer mil coisas ao mesmo tempo sem derrubar ninguém.',
        ],
        board: null,
      },
    ],
  });
})();
