(function () {
  // Pool de conexões falso usado nos testes da parte de cancelamento.
  const POOL = `import asyncio

class _Conexao:
    def __init__(self, pool):
        self.pool = pool

    async def buscar(self, url):
        await asyncio.sleep(self.pool.atraso)
        if self.pool.erro:
            raise self.pool.erro
        return f"<{url}>"

class _Pool:
    def __init__(self, atraso=0, erro=None):
        self.livres = 1
        self.atraso = atraso
        self.erro = erro

    async def pegar(self):
        await asyncio.sleep(0)
        self.livres -= 1
        return _Conexao(self)

    def devolver(self, conexao):
        self.livres += 1
`;

  Game.registerModule('concurrency', {
    id: 'armadilhas-async',
    title: 'Armadilhas do asyncio',
    kind: 'lesson',
    level: 3,
    order: 12,
    unit: 'async',
    summary: 'Os bugs que só aparecem em produção: loop bloqueado, await esquecido, tarefas que somem, contexto vazando, cancelamento engolido — e a "cor" das funções.',
    concepts: ['Bloqueio do event loop', 'Tarefas órfãs', 'contextvars', 'Cancelamento', 'Function coloring'],
    takeaways: [
      'Entre dois `await`, o seu código **segura o event loop**: `time.sleep`, CPU pesado e I/O síncrono congelam todas as tarefas. Meça o *lag* do loop para detectar.',
      'Chamar uma corrotina sem `await` só cria o objeto — nada executa (e o objeto é sempre "verdadeiro" num `if`).',
      'O loop guarda só referências **fracas** às tarefas: guarde as suas (`set` + `add_done_callback(discard)`) ou use `TaskGroup`.',
      'Estado "por requisição" vai numa `ContextVar`, com `token = var.set(...)` e `var.reset(token)` no `finally`; cada tarefa roda numa cópia do contexto.',
      'Cancelamento é uma exceção: limpe no `finally` e **deixe o `CancelledError` propagar** — engoli-lo quebra `timeout`, `TaskGroup` e o shutdown.',
    ],
    glossary: [
      { term: 'Event loop lag', aliases: ['lag do event loop', 'lag do loop', 'loop lag', 'event loop delay', 'atraso do event loop'], definition: 'Quanto uma tarefa pronta atrasa para rodar porque algum código segurou o loop. Mede-se com um "batimento": uma tarefa dorme X ms e compara com o tempo que realmente passou.' },
      { term: 'Tarefa órfã', aliases: ['tarefas órfãs', 'tarefa orfa', 'tarefas orfas', 'fire-and-forget', 'orphan task', 'dangling task'], definition: 'Tarefa criada com `create_task` sem que ninguém guarde a referência ou aguarde o resultado. Pode ser coletada pelo GC no meio da execução, e suas exceções se perdem.' },
      { term: 'ContextVar', aliases: ['contextvars', 'context var', 'variável de contexto', 'variáveis de contexto', 'variavel de contexto'], definition: 'Variável do módulo `contextvars` cujo valor depende do **contexto** em execução. Cada tarefa asyncio roda numa cópia do contexto, então valores "por requisição" não vazam entre tarefas.' },
      { term: 'Function coloring', aliases: ['cor das funções', 'cor das funcoes', 'coloração de funções', 'what color is your function', 'funções coloridas'], definition: 'Metáfora de Bob Nystrom (2015) para a divisão entre funções síncronas e assíncronas: uma função `async` só pode ser aguardada por outra `async`, e isso se espalha pela base de código.' },
      { term: 'CancelledError', aliases: ['asyncio.CancelledError'], definition: 'Exceção injetada no `await` em que a tarefa está parada quando alguém chama `cancel()`. Desde o Python 3.8 herda de `BaseException`, para não ser engolida por `except Exception`.' },
      { term: 'Sans-I/O', aliases: ['sans-io', 'sans io'], definition: 'Estilo de biblioteca em que o núcleo (parsing, máquina de estados do protocolo) não faz I/O: recebe e devolve bytes. A mesma lógica serve a código síncrono e assíncrono (ex.: `h11`, `h2`).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Código assíncrono tem uma categoria própria de bugs: os que passam nos testes e explodem com **carga de verdade**.',
          'Todos nascem do mesmo contrato: o asyncio é **cooperativo**. Quem não devolve a vez, trava todo mundo.',
        ],
        board: {
          title: '🧨 O contrato do asyncio',
          md: `O asyncio é **multitarefa cooperativa**: um thread, um event loop, e as tarefas se revezam **só nos \`await\`**.

\`\`\`text
tarefa A: ==código==> await ..........> ==código==> await
tarefa B:              ==código==> await .........> ==código==>
                      ^ a troca de vez só acontece nos await
\`\`\`

Entre dois \`await\`, **o seu código é o único rodando** no processo. Isso é ótimo (quase não há condições de corrida) e perigoso (quem não devolve a vez congela todos).

| Armadilha | Sintoma típico |
|---|---|
| Bloquear o loop | todas as requisições lentas ao mesmo tempo |
| Esquecer o \`await\` | "funciona", mas não faz nada |
| Tarefa órfã | tarefa some no meio; exceção perdida |
| Global por requisição | dado de um usuário no log (ou na resposta!) de outro |
| Engolir o cancelamento | timeout não dispara; shutdown trava |
| Cor das funções | \`async\` se espalhando pela base inteira |`,
        },
      },
      {
        type: 'say',
        text: [
          'Armadilha número um: **bloquear o event loop**. Não precisa ser um laço infinito — basta algo síncrono e demorado.',
          'Um `time.sleep(0.5)` num handler não atrasa só aquela requisição: atrasa **todas** as que estão no processo.',
        ],
        board: {
          title: 'O que bloqueia o loop (e o que usar no lugar)',
          code: `async def handler_ruim(req):
    time.sleep(0.5)                          # ✗ dorme SEGURANDO o loop
    texto = open("grande.csv").read()        # ✗ I/O de disco síncrono
    resp = requests.get(URL)                 # ✗ biblioteca HTTP bloqueante
    total = sum(x * x for x in range(10**7)) # ✗ CPU pesado, sem pausa
    return total

async def handler_bom(req):
    await asyncio.sleep(0.5)                          # ✓ dorme devolvendo a vez
    texto = await asyncio.to_thread(ler, "grande.csv")  # ✓ bloqueante -> thread auxiliar
    resp = await cliente.get(URL)                     # ✓ cliente async (httpx, aiohttp)
    loop = asyncio.get_running_loop()
    total = await loop.run_in_executor(processos, calcular)  # ✓ CPU -> outro processo
    return total`,
          caption: 'Aqui no navegador não há threads: `to_thread` e executores ficam só no quadro. Nos exercícios, a saída é **fatiar** o trabalho e ceder a vez com `await asyncio.sleep(0)`.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Como descobrir quem está segurando o loop? Três ferramentas: o modo debug, uma métrica de **lag** e, em último caso, fatiar o trabalho.',
          'O `await asyncio.sleep(0)` é o "sleep zero": não espera nada, só devolve a vez para quem estiver na fila.',
        ],
        board: {
          title: 'Detectar e contornar',
          md: `**1. Modo debug** — avisa quando um passo de tarefa demora demais:

\`\`\`python
asyncio.run(main(), debug=True)        # ou PYTHONASYNCIODEBUG=1
loop.slow_callback_duration = 0.05     # padrão: 0.1 s
# Executing <Task ... coro=<handler()>> took 0.512 seconds
\`\`\`

**2. Lag do loop em produção** — um "batimento" que deveria acordar a cada 100 ms:

\`\`\`python
async def monitorar_lag(metricas, intervalo=0.1):
    loop = asyncio.get_running_loop()
    while True:
        inicio = loop.time()
        await asyncio.sleep(intervalo)
        atraso = loop.time() - inicio - intervalo   # quanto o loop demorou a nos acordar
        metricas.observar("event_loop_lag_seconds", atraso)
\`\`\`

**3. Fatiar CPU** quando não dá para tirá-lo do processo:

\`\`\`python
for i, item in enumerate(itens, 1):
    processar(item)
    if i % 1000 == 0:
        await asyncio.sleep(0)   # cede a vez sem esperar nada
\`\`\`

> [!dica] \`py-spy dump --pid <PID>\` mostra a pilha de um processo sem pará-lo. Se o thread do loop aparece sempre na mesma função síncrona, você achou o culpado.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Armadilha número dois, a mais silenciosa: **esquecer o `await`**. Chamar uma função `async` não executa nada — só cria um objeto corrotina.',
          'E fica pior num `if`: o objeto corrotina é sempre "verdadeiro".',
        ],
        board: {
          title: 'Esqueceu o await',
          code: `async def salvar(pedido):
    await db.insert(pedido)

async def finalizar(pedido):
    salvar(pedido)             # cria a corrotina... e joga fora. NADA é salvo.
    return "ok"                # RuntimeWarning: coroutine 'salvar' was never awaited

async def pode_comprar(usuario):
    if tem_saldo(usuario):     # objeto corrotina -> SEMPRE verdadeiro!
        return True            # (e a consulta de saldo nem roda)
    return False`,
          caption: 'Não ignore o `RuntimeWarning` nos logs nem no resumo de avisos do pytest. Type checkers ajudam: o mypy tem até um código de erro para isso, `unused-coroutine`.',
        },
      },
      {
        type: 'say',
        text: [
          'Terceira: a **tarefa órfã**. O `create_task` devolve a tarefa, mas o event loop guarda só uma referência **fraca** a ela.',
          'Se ninguém mais segura a tarefa, o coletor de lixo pode destruí-la **no meio da execução**.',
        ],
        board: {
          title: 'Tarefas órfãs e o coletor de lixo',
          code: `# ✗ "fire-and-forget": ninguém guarda a tarefa
asyncio.create_task(enviar_email(pedido))

# ✓ referências FORTES + limpeza automática
em_segundo_plano = set()

def disparar(coro):
    tarefa = asyncio.create_task(coro)
    em_segundo_plano.add(tarefa)                          # impede o GC
    tarefa.add_done_callback(em_segundo_plano.discard)    # evita vazamento
    return tarefa

# ✓✓ quando existe um escopo: concorrência estruturada
async with asyncio.TaskGroup() as tg:
    tg.create_task(enviar_email(pedido))
    tg.create_task(baixar_estoque(pedido))
# aqui as duas terminaram (ou o erro já foi propagado)`,
          md: `Sintomas de tarefa órfã no log:

- \`Task was destroyed but it is pending!\` — o GC destruiu uma tarefa que ainda não tinha terminado.
- \`Task exception was never retrieved\` — a tarefa falhou e ninguém leu a exceção.

> [!sabia] Isso está escrito na documentação de \`asyncio.create_task\` ("guarde uma referência ao resultado desta função"), mas é tão comum esquecer que o linter **ruff** tem uma regra só para isso: **RUF006** (*asyncio-dangling-task*).`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Quarta: **cancelamento**. O `cancel()` não mata nada à força: ele injeta um `CancelledError` no `await` em que a tarefa está parada.',
          'Daí em diante é uma exceção como outra qualquer — e engoli-la é um dos bugs mais difíceis de achar.',
        ],
        board: {
          title: 'Cancelamento: limpe no finally e re-lance',
          code: `# ✗ engole o cancelamento: quem cancelou acha que parou, mas a tarefa segue viva
async def worker(fila):
    while True:
        try:
            await processar(await fila.get())
        except BaseException:          # pega CancelledError também!
            log.exception("falhou")    # ...e o laço continua

# ✓ limpeza no finally; o cancelamento propaga sozinho
async def baixar(pool, url):
    conexao = await pool.pegar()
    try:
        return await conexao.buscar(url)
    finally:
        pool.devolver(conexao)         # roda no sucesso, no erro E no cancelamento

# ✓ precisa reagir ao cancelamento? reaja e RE-LANCE
async def tarefa_longa():
    try:
        await trabalho()
    except asyncio.CancelledError:
        registrar("interrompida")
        raise`,
          caption: 'Desde o 3.8, `CancelledError` herda de `BaseException` — `except Exception` não o pega, mas `except:` e `except BaseException:` sim. `asyncio.timeout` e `TaskGroup` dependem dele chegando até eles (e contam cancelamentos com `Task.cancelling()`/`uncancel()`).',
        },
      },
      {
        type: 'say',
        text: [
          'Quinta: **estado por requisição**. Um id de requisição numa variável global funciona com uma requisição por vez… e mente com duas.',
          'A ferramenta certa é pouco conhecida: `contextvars`.',
        ],
        board: {
          title: 'contextvars: o "global" de cada tarefa',
          md: `Com uma **global**, requisições concorrentes se atropelam: A grava \`id=A\`, faz \`await\`, B grava \`id=B\`… e o log de A sai com **B**. E \`threading.local()\` não resolve: todas as tarefas vivem **no mesmo thread**.

\`\`\`python
import contextvars

request_id = contextvars.ContextVar("request_id", default="-")

def log(msg):                                  # funções profundas não recebem o id
    print(f"[{request_id.get()}] {msg}")

async def middleware(req, proximo):
    token = request_id.set(req.headers["X-Request-ID"])
    try:
        return await proximo(req)
    finally:
        request_id.reset(token)                # volta ao valor anterior
\`\`\`

> [!sabia] O \`contextvars\` (PEP 567, Python 3.7) nasceu para o asyncio: cada \`Task\` roda numa **cópia** do contexto de quem a criou — o filho enxerga os valores do pai, mas o que ele muda não vaza de volta. Detalhe que pouca gente conhece: \`asyncio.to_thread\` **propaga** o contexto para a thread, mas \`loop.run_in_executor\` **não** (aí é preciso \`contextvars.copy_context().run\`).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Por fim, um problema de design, não de bug: a **cor das funções**. Toda função `async` "pinta" quem a chama.',
          'Quem entende isso decide **onde** o async entra na arquitetura — em vez de deixá-lo se espalhar sozinho.',
        ],
        board: {
          title: 'Function coloring: "What Color is Your Function?"',
          md: `Em 2015, Bob Nystrom imaginou uma linguagem em que toda função é **azul** ou **vermelha**: a vermelha só pode ser chamada de dentro de outra vermelha, e chamá-la de uma azul é doloroso. Troque "vermelha" por \`async def\` e é o Python:

| Quem chama → quem é chamado | síncrona (azul) | assíncrona (vermelha) |
|---|---|---|
| **síncrona** | chamada normal | precisa de um loop: \`asyncio.run()\` — que **falha** se já houver um rodando |
| **assíncrona** | funciona, mas se **bloquear** trava o loop (\`to_thread\`) | \`await\` |

Consequências: o \`async\` sobe pela pilha de chamadas até o \`main\`; bibliotecas duplicadas (\`requests\` × \`httpx.AsyncClient\`, \`psycopg\` × \`asyncpg\`); testes, decoradores e context managers em dobro.

> [!sabia] Saídas conhecidas: **sans-I/O** — o núcleo do protocolo não faz I/O, só transforma bytes, e serve aos dois mundos (é assim que \`h11\` e \`h2\` são escritos); **green threads** (gevent) escondem a cor com *monkey-patching*; e runtimes como Go e as *virtual threads* do Java 21 simplesmente não têm cores.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Cace (e conserte) as armadilhas.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'conc-trap-q1',
        concept: 'await esquecido',
        say: 'Esse bug já passou em muito code review. Olhe com calma…',
        prompt: `Considere:

\`\`\`python
async def existe(usuario_id):
    return await db.buscar(usuario_id) is not None

async def pagina_perfil(usuario_id):
    if existe(usuario_id):
        return "200 OK"
    return "404 Not Found"
\`\`\`

O que acontece com \`await pagina_perfil(999)\` para um usuário que **não existe**?`,
        options: [
          { text: 'Devolve `"404 Not Found"` normalmente.', why: '`existe(usuario_id)` sem `await` nem chega a consultar o banco — o `if` testa outra coisa.' },
          { text: 'Devolve `"200 OK"`: sem `await`, `existe(...)` é um objeto corrotina, que é sempre verdadeiro; a consulta nem roda (e sai um `RuntimeWarning: coroutine \'existe\' was never awaited`).', correct: true, why: 'Objetos sem `__bool__`/`__len__` são *truthy*. A corrotina é criada, testada no `if` e descartada sem executar.' },
          { text: 'Lança `TypeError`, porque não dá para usar uma corrotina num `if`.', why: 'Python aceita qualquer objeto num contexto booleano; nada reclama em tempo de execução além do aviso.' },
          { text: 'Trava para sempre, esperando a corrotina terminar.', why: 'Ninguém espera nada: sem `await`, a corrotina nunca é agendada.' },
        ],
        explanation: 'Chamar uma função `async` **só cria** a corrotina; quem a executa é o `await` (ou uma `Task`). Num `if`, o objeto é *truthy* e o bug vira falha de **autorização** — todo usuário "existe". Defesas: não ignorar o `RuntimeWarning`, type checker (o mypy tem o código `unused-coroutine` para chamadas soltas) e testes do caminho **negativo**, não só do feliz.',
      },
      {
        type: 'match',
        id: 'conc-trap-q2',
        concept: 'Diagnóstico de armadilhas async',
        say: 'Todo sintoma conta uma história. Associe cada armadilha ao que você veria em produção.',
        prompt: 'Associe cada **armadilha** ao **sintoma** que ela produz.',
        pairs: [
          { left: '`time.sleep(1)` dentro de uma corrotina', right: 'Todas as requisições ficam ~1 s mais lentas ao mesmo tempo' },
          { left: '`asyncio.create_task(...)` sem guardar a referência', right: '`Task was destroyed but it is pending!`' },
          { left: 'Chamar uma corrotina sem `await`', right: '`RuntimeWarning: coroutine ... was never awaited`' },
          { left: '`except BaseException: pass` num worker', right: '`cancel()` e timeouts não conseguem parar a tarefa' },
          { left: 'Variável global para o id da requisição', right: 'Logs com o id de **outra** requisição' },
          { left: '`asyncio.run()` chamado dentro de uma corrotina', right: '`RuntimeError: asyncio.run() cannot be called from a running event loop`' },
        ],
        explanation: 'Bloqueio aparece como lentidão **coletiva** (não de uma requisição só); tarefa órfã aparece como destruição pelo GC ou exceção nunca lida; `await` esquecido gera o `RuntimeWarning`; engolir `CancelledError` faz `cancel()` e `timeout` perderem o efeito; global compartilhada mistura requisições; e `asyncio.run` dentro do loop é a "cor das funções" cobrando a conta.',
      },
      {
        type: 'code',
        id: 'conc-trap-q3',
        concept: 'Bloqueio do loop, await esquecido e tarefas órfãs',
        title: 'Conserte o serviço de pedidos',
        timeoutMs: 15000,
        say: 'Esse serviço tem três armadilhas. Os testes rodam um "batimento" em paralelo e chamam o coletor de lixo — os bugs aparecem de verdade!',
        prompt: `O código tem **três armadilhas** clássicas. Conserte-as sem mudar as assinaturas:

1. \`registrar(db, pedido)\` deve **realmente** salvar o pedido (via \`salvar\`) e devolver quantos pedidos há no \`db\`.
2. \`relatorio(itens, custo)\` soma \`custo(item)\` — uma função **síncrona e pesada**. Ele deve **ceder a vez ao event loop pelo menos a cada 100 itens**, para não congelar as outras tarefas.
3. \`Notificador\`: \`disparar(msg)\` inicia \`enviar(msg)\` em segundo plano e **guarda a tarefa** num \`set\` em \`self.pendentes\`, que deve se esvaziar sozinho conforme as tarefas terminam. \`aguardar()\` espera todas as pendentes; se algum envio falhar, os outros seguem e \`aguardar\` não lança.`,
        starter: `import asyncio

# 1) Registrar um pedido no "banco"
async def salvar(db, pedido):
    await asyncio.sleep(0)             # simula a ida ao banco
    db.append(pedido)

async def registrar(db, pedido):
    salvar(db, pedido)
    return len(db)

# 2) Relatório: custo(item) é síncrono e pesado (CPU)
async def relatorio(itens, custo):
    total = 0
    for item in itens:
        total += custo(item)
    return total

# 3) Notificações em segundo plano
class Notificador:
    def __init__(self, enviar):
        self.enviar = enviar           # async def enviar(msg)

    def disparar(self, msg):
        asyncio.create_task(self.enviar(msg))

    async def aguardar(self):
        """Espera todas as notificações disparadas terminarem."""
        pass
`,
        tests: [
          { name: 'registrar salva de verdade', code: `db = []
n = await registrar(db, "p1")
assert db == ["p1"], f"registrar não salvou nada (db = {db}): uma corrotina chamada sem await nunca executa"
assert n == 1, f"registrar deveria devolver 1, devolveu {n!r}"
n = await registrar(db, "p2")
assert db == ["p1", "p2"] and n == 2, f"db = {db}, n = {n!r}"
` },
          { name: 'relatorio soma os custos', expr: 'await relatorio(range(10), lambda x: x * 2)', expected: '90' },
          { name: 'relatorio cede a vez ao event loop', code: `import asyncio
_batidas = [0]

async def _batimento():
    while True:
        _batidas[0] += 1
        await asyncio.sleep(0)

_marcas = []
def _custo(x):
    _marcas.append(_batidas[0])
    return 1

_hb = asyncio.create_task(_batimento())
await asyncio.sleep(0)
try:
    _total = await relatorio(range(1000), _custo)
finally:
    _hb.cancel()
assert _total == 1000, f"total {_total!r}, esperado 1000"
_maior = _atual = 1
for _a, _b in zip(_marcas, _marcas[1:]):
    _atual = _atual + 1 if _a == _b else 1
    _maior = max(_maior, _atual)
assert _maior <= 100, f"relatorio processou {_maior} itens seguidos sem devolver a vez ao event loop (máximo: 100): enquanto isso, todas as outras tarefas ficaram congeladas"
` },
          { name: 'relatorio vazio', expr: 'await relatorio([], abs)', expected: '0' },
          { name: 'aguardar espera todos os envios', code: `import asyncio
_enviadas = []
async def _enviar(msg):
    await asyncio.sleep(0)
    _enviadas.append(msg)
n = Notificador(_enviar)
for m in ["a", "b", "c"]:
    n.disparar(m)
await asyncio.wait_for(n.aguardar(), 1)
assert sorted(_enviadas) == ["a", "b", "c"], f"aguardar() voltou antes de todos os envios terminarem: {_enviadas}"
` },
          { name: 'tarefas sobrevivem ao coletor de lixo', code: `import asyncio, gc, weakref
_loop = asyncio.get_running_loop()
_refs = []
_recebidos = []
async def _enviar(msg):
    fut = _loop.create_future()
    _refs.append(weakref.ref(fut))
    _recebidos.append((msg, await fut))
n = Notificador(_enviar)
n.disparar("oi")
await asyncio.sleep(0)
assert _refs, "disparar() deveria iniciar o envio em segundo plano com asyncio.create_task"
gc.collect()
_fut = _refs[0]()
assert _fut is not None, "a tarefa de envio foi destruída pelo coletor de lixo no meio da execução: o event loop só guarda referências FRACAS às tarefas. Guarde a sua em self.pendentes."
_fut.set_result(42)
del _fut
await asyncio.wait_for(n.aguardar(), 1)
assert _recebidos == [("oi", 42)], f"obtido {_recebidos}"
` },
          { name: 'self.pendentes guarda e se esvazia', code: `import asyncio
async def _enviar(msg):
    await asyncio.sleep(0)
n = Notificador(_enviar)
n.disparar("x")
n.disparar("y")
assert isinstance(getattr(n, "pendentes", None), set), "guarde as tarefas em self.pendentes (um set)"
assert len(n.pendentes) == 2, f"self.pendentes deveria ter 2 tarefas, tem {len(n.pendentes)}"
await asyncio.wait_for(n.aguardar(), 1)
await asyncio.sleep(0)
assert len(n.pendentes) == 0, "tarefas concluídas continuam em self.pendentes: use add_done_callback(self.pendentes.discard) para o set não vazar memória"
` },
          { name: 'falha num envio não derruba os outros', hidden: true, code: `import asyncio
_enviadas = []
async def _enviar(msg):
    await asyncio.sleep(0)
    if msg == "ruim":
        raise ConnectionError("SMTP fora do ar")
    _enviadas.append(msg)
n = Notificador(_enviar)
for m in ["a", "ruim", "b"]:
    n.disparar(m)
await asyncio.wait_for(n.aguardar(), 1)
assert sorted(_enviadas) == ["a", "b"], f"obtido {_enviadas}"
` },
          { name: 'aguardar sem nada pendente', hidden: true, code: `import asyncio
async def _enviar(msg):
    pass
await asyncio.wait_for(Notificador(_enviar).aguardar(), 1)
` },
        ],
        reviews: [
          {
            when: (m, code) => /time\.sleep/.test(code),
            text: '`time.sleep` dentro de código assíncrono dorme **segurando o loop**: nenhuma outra tarefa roda enquanto isso. Use `await asyncio.sleep(...)`.',
            concept: 'Bloqueio do event loop',
          },
          {
            when: (m, code) => /asyncio\.run\(/.test(code),
            text: '`asyncio.run()` cria um loop novo e falha se já houver um rodando — dentro de corrotinas, use `await`. `asyncio.run` é só para o ponto de entrada do programa.',
            concept: 'Function coloring',
          },
          {
            when: (m, code) => /asyncio\.wait\(/.test(code),
            text: 'Cuidado com `asyncio.wait()`: ele lança `ValueError` com um conjunto **vazio** e não propaga nem "lê" as exceções. Para "esperar todas", `gather(*tarefas, return_exceptions=True)` é mais direto.',
            concept: 'Tarefas órfãs',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo pega até `CancelledError` e `KeyboardInterrupt`, e esconde bugs. Capture exceções específicas (ou `Exception`).',
            concept: 'Cancelamento',
          },
        ],
        hints: [
          '`registrar`: uma corrotina chamada sem `await` só cria o objeto — nada executa. Falta um `await`.',
          '`relatorio`: dentro do laço, a cada 100 itens faça `await asyncio.sleep(0)` — é o "sleep zero", que só devolve a vez para as outras tarefas.',
          '`Notificador`: crie `self.pendentes = set()` no `__init__`; em `disparar`, adicione a tarefa e registre `tarefa.add_done_callback(self.pendentes.discard)`. Em `aguardar`: `await asyncio.gather(*self.pendentes, return_exceptions=True)`.',
        ],
        solution: `import asyncio

# 1) Registrar um pedido no "banco"
async def salvar(db, pedido):
    await asyncio.sleep(0)             # simula a ida ao banco
    db.append(pedido)

async def registrar(db, pedido):
    await salvar(db, pedido)           # sem await, a corrotina nunca roda
    return len(db)

# 2) Relatório: custo(item) é síncrono e pesado (CPU)
async def relatorio(itens, custo):
    total = 0
    for i, item in enumerate(itens, 1):
        total += custo(item)
        if i % 100 == 0:
            await asyncio.sleep(0)     # cede a vez ao event loop
    return total

# 3) Notificações em segundo plano
class Notificador:
    def __init__(self, enviar):
        self.enviar = enviar
        self.pendentes = set()         # referências FORTES às tarefas

    def disparar(self, msg):
        tarefa = asyncio.create_task(self.enviar(msg))
        self.pendentes.add(tarefa)
        tarefa.add_done_callback(self.pendentes.discard)
        return tarefa

    async def aguardar(self):
        await asyncio.gather(*self.pendentes, return_exceptions=True)
`,
        solutionExplanation: '(1) O `await` é o que **executa** a corrotina; sem ele, `salvar` só cria um objeto e o `RuntimeWarning` avisa depois. (2) O "sleep zero" a cada 100 itens transforma um bloco monolítico em fatias: entre elas, o loop atende as outras tarefas — o custo total é o mesmo, mas ninguém fica congelado. (3) O `set` segura referências **fortes** (o loop só tem fracas, e o GC destruiria a tarefa parada num futuro que só ela conhece); o `add_done_callback(discard)` evita que o `set` cresça para sempre; e o `gather(..., return_exceptions=True)` espera todas sem que uma falha interrompa a espera — e ainda "lê" as exceções, evitando o `Task exception was never retrieved`.',
      },
      {
        type: 'mcq',
        id: 'conc-trap-q4',
        concept: 'CPU pesado em código async',
        say: 'Agora um clássico de entrevista: e quando o trabalho pesado é CPU puro?',
        prompt: 'Um endpoint do seu servidor asyncio gera um relatório em PDF com **2 s de CPU em Python puro**. Enquanto isso, todas as outras requisições param. Qual a melhor correção?',
        options: [
          { text: 'Transformar `gerar_pdf` em `async def` e chamá-la com `await`.', why: '`async def` não torna código de CPU cooperativo: sem nenhum `await` lá dentro, a função roda os 2 s inteiros segurando o loop.' },
          { text: '`await asyncio.to_thread(gerar_pdf, dados)`.', why: 'Ajuda com I/O bloqueante, mas CPU em Python puro numa thread disputa o **GIL** com o thread do loop: o servidor fica lento em vez de parado. Processos resolvem de verdade (no CPython padrão).' },
          { text: '`await loop.run_in_executor(pool_de_processos, gerar_pdf, dados)`, com um `ProcessPoolExecutor` criado uma vez na inicialização.', correct: true, why: 'Outro processo tem o seu próprio interpretador e o seu próprio GIL; o loop fica livre para atender as demais requisições.' },
          { text: 'Chamar `await asyncio.sleep(0)` antes de `gerar_pdf(dados)`.', why: 'Cede a vez **uma** vez, antes — e depois bloqueia os mesmos 2 s.' },
        ],
        explanation: 'Regra prática: **I/O bloqueante** → `asyncio.to_thread`; **CPU pesado** → `ProcessPoolExecutor` via `run_in_executor` (pagando a serialização dos argumentos/resultado com `pickle` e limitando o tamanho do pool). Fatiar com `sleep(0)` é a alternativa quando o trabalho é divisível e não compensa sair do processo. No Python 3.13+ *free-threaded* (sem GIL), threads voltam a ser opção para CPU — mas ainda é uma build opcional.',
      },
      {
        type: 'code',
        id: 'conc-trap-q5',
        concept: 'contextvars e cancelamento',
        title: 'Contexto que vaza e cancelamento engolido',
        timeoutMs: 15000,
        say: 'Mais duas armadilhas: logs com o id errado e um download que engole o cancelamento. Os testes rodam requisições concorrentes e cancelam tarefas de verdade.',
        prompt: `**Parte 1 — id da requisição nos logs.** Hoje \`request_id\` é uma variável global, e requisições concorrentes misturam os ids.

- \`request_id\` deve ser uma \`contextvars.ContextVar\` com padrão \`"-"\`.
- \`log(linhas, msg)\` acrescenta \`"[<id atual>] msg"\` em \`linhas\`.
- \`atender(linhas, rid, consultar)\` define o id, loga \`"início"\`, aguarda \`consultar()\`, loga \`"fim"\` e, ao sair (**mesmo com erro**), restaura o valor anterior do id.

**Parte 2 — cancelamento.** \`baixar(pool, url)\` pega uma conexão com \`await pool.pegar()\` e devolve o resultado de \`await conexao.buscar(url)\`. A conexão deve **sempre** voltar com \`pool.devolver(conexao)\` — no sucesso, no erro e no cancelamento — e erros e \`CancelledError\` devem **propagar**.`,
        starter: `import asyncio

# Parte 1 — id da requisição nos logs
request_id = None                    # global: compartilhado por TODAS as tarefas

def log(linhas, msg):
    linhas.append(f"[{request_id}] {msg}")

async def atender(linhas, rid, consultar):
    global request_id
    request_id = rid
    log(linhas, "início")
    await consultar()                # outras requisições rodam aqui
    log(linhas, "fim")

# Parte 2 — download com conexão do pool
async def baixar(pool, url):
    conexao = await pool.pegar()
    try:
        dados = await conexao.buscar(url)
    except asyncio.CancelledError:
        return None
    pool.devolver(conexao)
    return dados
`,
        tests: [
          { name: 'requisições concorrentes não misturam o id', code: `import asyncio
_linhas = []
async def _consultar():
    await asyncio.sleep(0)
await asyncio.gather(atender(_linhas, "A", _consultar), atender(_linhas, "B", _consultar))
assert sorted(_linhas) == sorted(["[A] início", "[B] início", "[A] fim", "[B] fim"]), f"logs misturados: {_linhas}"
` },
          { name: 'request_id é uma ContextVar com padrão "-"', code: `import contextvars
assert isinstance(request_id, contextvars.ContextVar), "request_id deveria ser uma contextvars.ContextVar"
assert request_id.get() == "-", f"o valor padrão deveria ser '-', é {request_id.get()!r}"
_linhas = []
log(_linhas, "fora de requisição")
assert _linhas == ["[-] fora de requisição"], f"obtido {_linhas}"
` },
          { name: 'o id não vaza para quem chamou', code: `_linhas = []
async def _nada():
    pass
await atender(_linhas, "X", _nada)
assert _linhas == ["[X] início", "[X] fim"], f"obtido {_linhas}"
assert request_id.get() == "-", f"depois de atender(), o id deveria voltar a '-', mas ficou {request_id.get()!r}: guarde o token de set() e chame reset(token)"
` },
          { name: 'baixar devolve os dados e a conexão', code: POOL + `
p = _Pool()
_r = await baixar(p, "/a")
assert _r == "</a>", f"obtido {_r!r}"
assert p.livres == 1, "a conexão não voltou para o pool"
` },
          { name: 'erro na busca: propaga e devolve a conexão', code: POOL + `
p = _Pool(erro=ConnectionError("caiu"))
try:
    await baixar(p, "/a")
except ConnectionError:
    pass
else:
    raise AssertionError("o ConnectionError deveria propagar")
assert p.livres == 1, "a conexão vazou quando buscar() falhou: devolva no finally"
` },
          { name: 'cancelamento: propaga e devolve a conexão', code: POOL + `
p = _Pool(atraso=10)
_t = asyncio.create_task(baixar(p, "/lenta"))
for _ in range(3):
    await asyncio.sleep(0)
_t.cancel()
try:
    await _t
except asyncio.CancelledError:
    pass
assert _t.cancelled(), "baixar() engoliu o CancelledError: quem cancelou precisa ver a tarefa cancelada. Limpe no finally e deixe a exceção propagar."
assert p.livres == 1, "a conexão vazou no cancelamento: devolva no finally"
` },
          { name: 'restaura o id mesmo com erro', hidden: true, code: `_linhas = []
async def _falha():
    raise ValueError("banco fora do ar")
try:
    await atender(_linhas, "E", _falha)
except ValueError:
    pass
else:
    raise AssertionError("o erro de consultar() deveria propagar")
assert _linhas == ["[E] início"], f"obtido {_linhas}"
assert request_id.get() == "-", "quando consultar() falha, o id também deveria ser restaurado (use try/finally)"
` },
          { name: 'requisições aninhadas', hidden: true, code: `_linhas = []
async def _nada():
    pass
async def _interna():
    await atender(_linhas, "interna", _nada)
await atender(_linhas, "externa", _interna)
esperado = ["[externa] início", "[interna] início", "[interna] fim", "[externa] fim"]
assert _linhas == esperado, f"obtido {_linhas}"
` },
          { name: 'timeout vira TimeoutError', hidden: true, code: POOL + `
p = _Pool(atraso=10)
try:
    async with asyncio.timeout(0.02):
        await baixar(p, "/lenta")
except TimeoutError:
    pass
else:
    raise AssertionError("asyncio.timeout deveria lançar TimeoutError, mas baixar() engoliu o cancelamento que o timeout usa por baixo")
assert p.livres == 1, "a conexão vazou no timeout"
` },
        ],
        reviews: [
          {
            when: m => m.usesGlobal,
            text: '`global`/`nonlocal` para estado por requisição: em código concorrente, uma variável global é **compartilhada por todas as tarefas**. Use `ContextVar`.',
            concept: 'contextvars',
          },
          {
            when: (m, code) => /except\s*\(?\s*(asyncio\.)?CancelledError/.test(code) && !/\braise\b/.test(code),
            text: 'Você captura `CancelledError` e não re-lança. Quem cancelou (um `timeout`, um `TaskGroup`, o shutdown) nunca fica sabendo — e a tarefa continua viva. Reaja e faça `raise`.',
            concept: 'Cancelamento',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo engole também `CancelledError`. Se precisar de limpeza, use `finally`; se precisar capturar, seja específico.',
            concept: 'Cancelamento',
          },
          {
            when: (m, code) => /threading\.local|\blocal\(\)/.test(code),
            text: '`threading.local()` não separa tarefas asyncio: todas rodam **no mesmo thread** e veriam o mesmo valor. `ContextVar` é a versão que entende tarefas.',
            concept: 'contextvars',
          },
          {
            when: m => m.attributes.includes('set') && !m.attributes.includes('reset'),
            text: 'Você faz `request_id.set(...)` sem `reset(token)`: se `atender` for aguardada diretamente (sem uma tarefa nova), o id vaza para quem chamou. Guarde o token e restaure no `finally`.',
            concept: 'contextvars',
          },
        ],
        hints: [
          'Parte 1: `request_id = contextvars.ContextVar("request_id", default="-")` e, no `log`, `request_id.get()`.',
          'Em `atender`: `token = request_id.set(rid)` antes do `try` e `request_id.reset(token)` no `finally` — o `reset` volta exatamente ao valor anterior, mesmo em chamadas aninhadas.',
          'Parte 2: troque o `except CancelledError` por `try: return await conexao.buscar(url)` + `finally: pool.devolver(conexao)`. O `finally` roda no sucesso, no erro e no cancelamento — e a exceção continua subindo.',
        ],
        solution: `import asyncio
import contextvars

# Parte 1 — id da requisição nos logs
request_id = contextvars.ContextVar("request_id", default="-")

def log(linhas, msg):
    linhas.append(f"[{request_id.get()}] {msg}")

async def atender(linhas, rid, consultar):
    token = request_id.set(rid)
    try:
        log(linhas, "início")
        await consultar()
        log(linhas, "fim")
    finally:
        request_id.reset(token)      # volta ao valor anterior, com ou sem erro

# Parte 2 — download com conexão do pool
async def baixar(pool, url):
    conexao = await pool.pegar()
    try:
        return await conexao.buscar(url)
    finally:
        pool.devolver(conexao)       # sucesso, erro ou cancelamento
`,
        solutionExplanation: '**Parte 1:** cada tarefa criada pelo `gather` roda numa **cópia** do contexto, então o `set` de A não enxerga o de B. O par `token = set(...)` / `reset(token)` no `finally` devolve o valor anterior — inclusive em chamadas aninhadas e quando `atender` é aguardada diretamente, sem tarefa nova. **Parte 2:** o `finally` é o lugar da limpeza porque roda em todos os caminhos; sem `except`, o `CancelledError` segue subindo e quem cancelou (um `asyncio.timeout`, um `TaskGroup`) recebe o sinal que espera — o `timeout` só converte o cancelamento em `TimeoutError` se ele chegar até lá.',
      },
      {
        type: 'open',
        id: 'conc-trap-q6',
        concept: 'Function coloring',
        say: 'Para fechar, uma pergunta de arquitetura que separa quem usa async de quem entende async.',
        prompt: 'Seu time tem uma base **síncrona** grande (Flask + `requests` + driver de banco síncrono) e vai criar um serviço **asyncio** que reaproveita a lógica de negócio. Explique o problema da **cor das funções** (*function coloring*) e como você organizaria o código para os dois mundos conviverem.',
        minWords: 30,
        rubric: [
          { label: 'Explica que `async` é "contagioso": só pode ser aguardado por outra função async, e isso sobe pela cadeia de chamadas', keywords: ['contagi', 'viral', 'propaga', 'espalha', 'infect', 'cadeia de chamadas', 'pilha de chamadas', 'toda a cadeia', 'sobe pela', 'so pode ser', 'precisa ser async', 'vira async', 'tambem async', 'tambem precisa'], concept: 'Function coloring', why: 'Uma função vermelha só é chamada por outra vermelha: adotar async num ponto obriga os chamadores a virarem async também.' },
          { label: 'Aponta que código síncrono **bloqueante** chamado de dentro do async trava o event loop (e cita `to_thread`/executor)', keywords: ['bloque', 'trava o loop', 'trava o event loop', 'congela', 'to_thread', 'executor', 'thread'], concept: 'Bloqueio do event loop', why: 'Chamar `requests` ou o driver síncrono dentro de uma corrotina congela todas as tarefas; precisa ir para uma thread (ou ser trocado por uma biblioteca async).' },
          { label: 'Aponta que chamar async a partir de código síncrono exige um event loop (`asyncio.run` no ponto de entrada; não dá dentro de um loop já rodando)', keywords: ['asyncio.run', 'run_until_complete', 'na borda', 'nas bordas', 'ponto de entrada', 'entrypoint', 'entry point', 'loop ja rodando', 'loop rodando', 'running event loop', 'async_to_sync', 'sync_to_async', 'anyio'], concept: 'Event loop', why: 'Do lado azul, só dá para executar uma corrotina criando um loop — e `asyncio.run` falha se já houver um rodando.' },
          { label: 'Propõe separar a lógica de negócio **sem I/O** (núcleo puro / sans-I/O) do I/O nas bordas, ou alternativas como threads/gevent', keywords: ['sans-io', 'sans io', 'sem i/o', 'sem io', 'nucleo', 'dominio puro', 'logica pura', 'funcoes puras', 'regras de negocio puras', 'hexagonal', 'portas e adaptadores', 'adaptador', 'gevent', 'duas versoes', 'duplicar'], concept: 'Sans-I/O', why: 'Se a regra de negócio não faz I/O, ela não tem cor e serve aos dois mundos; só os adaptadores de I/O precisam existir em versão síncrona e assíncrona.' },
        ],
        modelAnswer: `A cor das funções (ensaio "What Color is Your Function?") descreve que uma função \`async\` só pode ser aguardada de dentro de outra \`async\`: adotar async num ponto é **contagioso**, e a mudança sobe pela cadeia de chamadas até o ponto de entrada.

Os dois sentidos doem:
- **async → sync**: chamar \`requests\` ou o driver síncrono dentro de uma corrotina **bloqueia** o event loop e congela todas as tarefas; ou se usa um cliente async (httpx, asyncpg) ou se empurra a chamada para uma thread com \`asyncio.to_thread\`.
- **sync → async**: a partir de código síncrono só dá para rodar uma corrotina criando um loop (\`asyncio.run\` no ponto de entrada), e isso falha se já houver um **loop rodando**.

Organização: manter a lógica de negócio **sem I/O** — um núcleo de funções puras (estilo *sans-I/O*, ou portas e adaptadores da arquitetura hexagonal) que recebe dados e devolve decisões. Esse núcleo não tem cor e é reaproveitado pelos dois serviços; só os adaptadores de I/O existem em versão síncrona (Flask/requests) e assíncrona (httpx/asyncpg). Onde isso não compensar, \`to_thread\` para o legado bloqueante é a ponte.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você reconhece as armadilhas pelo sintoma: lentidão coletiva, `RuntimeWarning`, tarefa destruída, log trocado, timeout que não dispara.',
          'E sabe as defesas: não bloquear o loop, `await` sempre, referências fortes ou `TaskGroup`, `ContextVar` e `finally` com cancelamento propagando. Nos vemos na entrevista!',
        ],
        board: null,
      },
    ],
  });
})();
