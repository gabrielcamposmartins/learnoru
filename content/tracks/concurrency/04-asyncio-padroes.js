(function () {
  // Helpers Python compartilhados pelos testes (cada teste roda num namespace novo).
  const MEDIDOR = `import asyncio

class _Medidor:
    """Mede o pico de trabalhos rodando ao mesmo tempo e registra início/fim."""
    def __init__(self):
        self.ativos = 0
        self.pico = 0
        self.eventos = []

    def trabalho(self, i, passos=2):
        async def job():
            self.ativos += 1
            self.pico = max(self.pico, self.ativos)
            self.eventos.append(("inicio", i))
            try:
                for _ in range(passos):
                    await asyncio.sleep(0)
                return i * 10
            finally:
                self.ativos -= 1
                self.eventos.append(("fim", i))
        return job

async def _rodar(fabricas, limite):
    try:
        return await asyncio.wait_for(executar_limitado(fabricas, limite), 1)
    except TimeoutError:
        raise AssertionError("executar_limitado não terminou em 1 s: alguma tarefa ficou esperando uma vaga que nunca abre") from None
`;

  const RASTRO = `import asyncio

class _Rastro:
    """Fonte e processador instrumentados: medem backpressure e paralelismo."""
    def __init__(self):
        self.retirados = 0
        self.concluidos = 0
        self.maior_folga = 0
        self.ativos = 0
        self.pico = 0

    def fonte(self, n):
        for i in range(n):
            self.retirados += 1
            self.maior_folga = max(self.maior_folga, self.retirados - self.concluidos)
            yield i

    def processador(self, passos=2, falha=()):
        async def processar(item):
            self.ativos += 1
            self.pico = max(self.pico, self.ativos)
            try:
                for _ in range(passos):
                    await asyncio.sleep(0)
                if item in falha:
                    raise ValueError(f"item {item} com defeito")
                return item * 10
            finally:
                self.ativos -= 1
                self.concluidos += 1
        return processar

async def _sem_travar(coro):
    try:
        return await asyncio.wait_for(coro, 1)
    except TimeoutError:
        raise AssertionError("o pipeline travou (1 s): algum consumidor nunca terminou ou o produtor ficou preso num put. Faltou sentinela, task_done ou cancelamento?") from None
`;

  Game.registerModule('concurrency', {
    id: 'asyncio-padroes',
    title: 'Padrões com asyncio',
    kind: 'lesson',
    level: 3,
    order: 11,
    unit: 'async',
    summary: 'Semaphore, filas limitadas e backpressure: como fazer mil coisas ao mesmo tempo sem derrubar ninguém (nem a si mesmo).',
    concepts: ['asyncio.Semaphore', 'asyncio.Queue', 'Produtor/consumidor', 'Backpressure', 'Rate limiting assíncrono'],
    takeaways: [
      '`Semaphore(k)` limita quantas operações rodam **ao mesmo tempo**; um limitador de taxa limita quantas **por segundo**. Pela Lei de Little, 10 em voo com 50 ms cada = 200 req/s.',
      'Prefira **janela deslizante** (Semaphore ou K workers) a lotes com `gather`: o lote sempre espera o trabalho mais lento.',
      'Uma fila **limitada** é o jeito mais simples de *backpressure*: `await fila.put()` segura o produtor quando o consumidor não dá conta.',
      'Encerre consumidores explicitamente: **uma sentinela por consumidor** ou `join()` + `cancel()` — e `task_done()` sempre no `finally`.',
      'Retry assíncrono: prazo **por tentativa** com `asyncio.timeout`, backoff com jitter, prazo total por fora e nunca engolir `CancelledError`.',
    ],
    glossary: [
      { term: 'Semáforo', aliases: ['semaphore', 'semáforos', 'semaforo', 'semaforos'], definition: 'Primitiva de sincronização com um contador de vagas: `acquire` ocupa uma vaga (ou espera, se não houver) e `release` devolve. Com `asyncio.Semaphore(k)`, no máximo *k* tarefas ficam dentro do `async with`.' },
      { term: 'Backpressure', aliases: ['contrapressão', 'contrapressao', 'back-pressure'], definition: 'Mecanismo pelo qual um consumidor lento **freia** um produtor rápido (ex.: fila limitada em que `put` espera), em vez de acumular trabalho sem limite na memória.' },
      { term: 'Produtor/consumidor', aliases: ['produtor-consumidor', 'producer/consumer', 'producer-consumer', 'produtores e consumidores'], definition: 'Padrão em que tarefas produtoras colocam itens numa fila e tarefas consumidoras os retiram e processam, desacoplando o ritmo de cada lado.' },
      { term: 'Sentinela', aliases: ['sentinelas', 'sentinel', 'poison pill', 'valor sentinela'], definition: 'Valor especial colocado na fila para avisar "acabou": o consumidor que o recebe encerra. Use um objeto único (`FIM = object()`) e envie **um por consumidor**.' },
      { term: 'Bufferbloat', aliases: [], definition: 'Excesso de buffer: filas grandes demais não aumentam a vazão, só a **latência** — cada item espera atrás de todos os outros. O termo nasceu em redes (Jim Gettys, 2010), mas vale para qualquer fila.' },
      { term: 'Lei de Little', aliases: ["Little's Law", 'Little’s Law'], definition: 'Em regime estável, **L = λ × W**: itens no sistema = taxa de chegada × tempo médio no sistema. Ex.: 10 requisições em voo que levam 50 ms cada sustentam 200 req/s.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Você já sabe disparar tarefas com `gather` e `TaskGroup`. Hoje o problema é o **oposto**: segurar o freio.',
          'Disparar 10 mil requisições de uma vez é fácil… e é o jeito mais rápido de derrubar uma API — ou o seu próprio processo.',
        ],
        board: {
          title: '🚦 O problema: concorrência sem freio',
          md: `Com \`gather\` é tentador disparar **tudo de uma vez**:

\`\`\`python
urls = carregar_urls()                       # 10.000 URLs
paginas = await asyncio.gather(*(baixar(u) for u in urls))
\`\`\`

| O que acontece | Por quê |
|---|---|
| \`429 Too Many Requests\` | a API tem limite de taxa |
| \`OSError: Too many open files\` | cada conexão é um *file descriptor* (limite comum: 1024) |
| Memória explode | 10.000 corrotinas e respostas vivas ao mesmo tempo |
| Timeouts em cascata | o pool de conexões (seu ou do servidor) satura |

**Três perguntas** guiam esta aula:

1. Quantas operações **ao mesmo tempo**? → \`asyncio.Semaphore\`
2. Quantas operações **por segundo**? → limitador de taxa
3. E se quem produz for **mais rápido** que quem consome? → \`asyncio.Queue(maxsize=...)\` e *backpressure*`,
        },
      },
      {
        type: 'say',
        text: [
          'A ferramenta número um é o **semáforo**: um contador de vagas. Entrou, ocupa uma; saiu, devolve.',
          'Quando as vagas acabam, quem chega **espera** no `async with` — sem gastar CPU — até alguém sair.',
        ],
        board: {
          title: 'asyncio.Semaphore — no máximo k ao mesmo tempo',
          code: `import asyncio

async def baixar_todas(urls, baixar, limite=10):
    sem = asyncio.Semaphore(limite)        # UM semáforo, compartilhado por todas

    async def com_vaga(url):
        async with sem:                    # acquire: ocupa uma vaga (ou espera)
            return await baixar(url)       # no máximo \`limite\` corrotinas aqui dentro
        # release automático — mesmo com exceção ou cancelamento

    return await asyncio.gather(*(com_vaga(u) for u in urls))`,
          caption: 'Os que esperam são acordados em ordem de chegada (FIFO). `BoundedSemaphore` ainda acusa `release()` a mais com `ValueError`.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Um erro clássico é rodar em **lotes**: `gather` de 10 em 10. Parece a mesma coisa, mas cada lote espera o trabalho mais lento.',
          'Com o semáforo, a vaga liberada é ocupada **na hora** — é uma janela deslizante.',
        ],
        board: {
          title: 'Lotes × janela deslizante',
          md: `\`\`\`text
limite = 3, trabalhos com durações diferentes

LOTES (gather de 3 em 3)
vaga 1: [A..........][D....]
vaga 2: [B..]~~~~~~~~[E..]
vaga 3: [C....]~~~~~~[F.]
        ~~~ = vaga ociosa, esperando o A (o mais lento do lote)

JANELA DESLIZANTE (Semaphore)
vaga 1: [A..........]
vaga 2: [B..][D....][F.]
vaga 3: [C....][E..]
        vaga liberada = próximo trabalho começa na hora
\`\`\`

Duas formas corretas de limitar concorrência:

| | Semaphore + \`gather\` | K workers + \`Queue\` |
|---|---|---|
| Código | bem curto | um pouco maior |
| Memória | cria as **N** corrotinas de uma vez | só **K** tarefas + a fila |
| Entrada | precisa da lista inteira | aceita gerador infinito / stream |
| Ordem dos resultados | \`gather\` já devolve na ordem | precisa guardar o índice |

> [!atencao] Crie o semáforo **uma vez**, fora das tarefas. Um \`Semaphore(10)\` criado *dentro* de cada tarefa dá 10 vagas **para cada uma** — ou seja, nenhum limite.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o padrão **produtor/consumidor**: um lado coloca itens numa fila, outro lado retira e processa.',
          'O detalhe que separa código de produção de código de tutorial: a fila tem **tamanho máximo**, e o fim é avisado com uma **sentinela**.',
        ],
        board: {
          title: 'asyncio.Queue — produtor/consumidor com sentinela',
          code: `import asyncio

FIM = object()                            # sentinela: objeto único, impossível de confundir

async def produtor(fila, fonte, n_consumidores):
    for item in fonte:
        await fila.put(item)              # fila cheia? ESPERA (backpressure)
    for _ in range(n_consumidores):
        await fila.put(FIM)               # uma sentinela POR consumidor

async def consumidor(fila, processar, saida):
    while (item := await fila.get()) is not FIM:   # fila vazia? espera
        saida.append(await processar(item))

async def main(fonte, processar):
    fila = asyncio.Queue(maxsize=100)     # LIMITADA
    saida = []
    async with asyncio.TaskGroup() as tg:
        tg.create_task(produtor(fila, fonte, 4))
        for _ in range(4):
            tg.create_task(consumidor(fila, processar, saida))
    return saida`,
          caption: '`maxsize=0` (o padrão) significa fila **sem limite**: `put` nunca espera — e o produtor nunca é freado.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'A outra forma de encerrar é contar trabalho: cada `get` é pareado com um `task_done()`, e `join()` espera a conta zerar.',
          'Cuidado: se o consumidor lançar exceção **antes** do `task_done()`, o `join()` espera para sempre. Por isso ele mora no `finally`.',
        ],
        board: {
          title: 'join() + task_done() + cancel()',
          code: `async def consumidor(fila, processar, saida):
    while True:
        item = await fila.get()
        try:
            saida.append(await processar(item))
        except Exception:
            pass                          # item com defeito: registre e siga
        finally:
            fila.task_done()              # SEMPRE — senão join() nunca retorna

async def main(fonte, processar):
    fila = asyncio.Queue(maxsize=100)
    saida = []
    workers = [asyncio.create_task(consumidor(fila, processar, saida)) for _ in range(4)]
    for item in fonte:
        await fila.put(item)
    await fila.join()                     # todos os itens tiveram task_done()
    for w in workers:
        w.cancel()                        # consumidores estão parados no get()
    await asyncio.gather(*workers, return_exceptions=True)
    return saida`,
          caption: 'Sentinela × join: a sentinela encerra "de dentro" da fila; o join precisa cancelar os workers depois. No Python 3.13+ há ainda `Queue.shutdown()`.',
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Esse `await fila.put()` que espera tem nome: **backpressure**. É o consumidor lento empurrando de volta o produtor rápido.',
          'Sem isso, a fila vira um depósito: a memória cresce e cada item espera cada vez mais para ser atendido.',
        ],
        board: {
          title: 'Backpressure: quando o consumidor não dá conta',
          md: `Se o produtor gera 10 mil itens/s e o consumidor processa 2 mil/s, sobram **8 mil itens por segundo**. Só existem quatro saídas:

| Estratégia | Como | Custo |
|---|---|---|
| **Frear** (backpressure) | fila limitada: \`await put()\` espera | o produtor fica mais lento |
| **Descartar** (*load shedding*) | \`put_nowait()\` + \`QueueFull\` → descarta ou responde 429 | perde itens |
| **Amostrar/agregar** | processa 1 a cada N, ou soma em lotes | perde detalhe |
| **Acumular** | fila sem limite | memória e latência **sem limite** |

"Acumular" só adia o problema: pela **Lei de Little**, com a fila crescendo, o tempo de espera de cada item cresce junto.

> [!sabia] O termo *backpressure* vem da mecânica dos fluidos: a pressão que resiste ao fluxo num cano. Em software ele foi formalizado pela especificação **Reactive Streams** (2015), em que o consumidor pede \`request(n)\` itens. O TCP faz isso desde sempre com a *janela de recepção* — e no asyncio o \`await writer.drain()\` depois de \`writer.write()\` é backpressure: esquecê-lo deixa o buffer de envio crescer sem limite.

> [!sabia] **Bufferbloat**: buffers grandes demais não aumentam a vazão, só a latência. O termo surgiu em redes (Jim Gettys, 2010), quando roteadores com filas enormes deixavam a internet "lenta" sem perder um único pacote.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Pegadinha frequente: "a API aceita 10 req/s, então usei `Semaphore(10)`". Semáforo limita **quantas ao mesmo tempo**, não **quantas por segundo**.',
          'Para taxa, dá para reservar um "horário" para cada chamada — e no asyncio isso é seguro sem lock, se não houver `await` no meio da reserva.',
        ],
        board: {
          title: 'Rate limiting assíncrono',
          code: `import asyncio

class LimitadorDeTaxa:
    """Até \`por_segundo\` liberações por segundo, espaçadas uniformemente."""

    def __init__(self, por_segundo):
        self.intervalo = 1 / por_segundo
        self.proximo = 0.0                      # horário do próximo slot livre

    async def esperar_vez(self):
        agora = asyncio.get_running_loop().time()
        slot = max(agora, self.proximo)
        self.proximo = slot + self.intervalo    # reserva ANTES de qualquer await
        await asyncio.sleep(slot - agora)       # dorme até o seu horário

taxa = LimitadorDeTaxa(10)                      # no máximo 10 por segundo...
sem = asyncio.Semaphore(5)                      # ...e no máximo 5 em voo

async def chamar(req):
    await taxa.esperar_vez()
    async with sem:
        return await api(req)`,
          caption: 'Lei de Little: vazão = concorrência ÷ latência. 10 em voo × 50 ms cada = 200 req/s. O `proximo` é o *TAT* do GCRA; token bucket (rajadas) está na trilha de APIs.',
        },
      },
      {
        type: 'say',
        text: [
          'Último padrão: **retry com timeout**. O prazo vale **por tentativa**, e um prazo total fica por fora.',
          'E repare no que o `except` **não** pega: `CancelledError`. Se alguém cancelou, não é hora de tentar de novo.',
        ],
        board: {
          title: 'Retry com timeout, backoff e jitter',
          code: `import asyncio
import random

async def com_retry(operacao, *, tentativas=4, timeout=0.5, base=0.1, rng=None):
    rng = rng or random.Random()
    for n in range(1, tentativas + 1):
        try:
            async with asyncio.timeout(timeout):      # prazo POR tentativa
                return await operacao()
        except (TimeoutError, ConnectionError):       # só falhas transitórias
            if n == tentativas:
                raise
            teto = base * 2 ** (n - 1)                 # 0.1, 0.2, 0.4...
            await asyncio.sleep(rng.uniform(0, teto))  # "full jitter"

# prazo TOTAL (tentativas + esperas) por fora:
async with asyncio.timeout(2):
    saldo = await com_retry(lambda: cliente.get("/saldo"))`,
          caption: 'Só repita operações **idempotentes**. Timeouts aninhados funcionam porque o asyncio conta cancelamentos (`Task.uncancel()`): o de fora não é confundido com o de dentro.',
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Semaphore, filas, backpressure e taxa na prática.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'conc-pat-q1',
        concept: 'Concorrência × taxa (Lei de Little)',
        say: 'Começando pela pegadinha favorita dos code reviews…',
        prompt: 'A API de pagamentos aceita no máximo **10 requisições por segundo**. Cada chamada leva ~**50 ms**. Um colega protegeu o cliente com `asyncio.Semaphore(10)`. O que acontece?',
        options: [
          { text: 'Resolve: o semáforo garante no máximo 10 requisições por segundo.', why: 'O semáforo limita quantas estão **em voo ao mesmo tempo**, não quantas começam por segundo. Ele não sabe nada de tempo.' },
          { text: 'Não resolve: com 10 em voo e 50 ms cada, a vazão chega a ~200 req/s. É preciso um limitador de **taxa** (e o semáforo pode continuar, para limitar conexões).', correct: true, why: 'Lei de Little: vazão = concorrência ÷ latência = 10 ÷ 0,05 s = 200 req/s — vinte vezes o permitido.' },
          { text: 'Não resolve, porque `asyncio.Semaphore` só funciona com threads; com corrotinas ele é ignorado.', why: '`asyncio.Semaphore` foi feito justamente para corrotinas (`async with`). O de threads é `threading.Semaphore`.' },
          { text: 'Resolve só se as chamadas forem feitas com `gather`; com `TaskGroup` o limite deixa de valer.', why: 'O limite vale independentemente de como as tarefas foram criadas — e continua sendo de concorrência, não de taxa.' },
        ],
        explanation: '**Concorrência** (quantas ao mesmo tempo) e **taxa** (quantas por segundo) se relacionam pela Lei de Little: `L = λ × W`. Com `L = 10` e `W = 0,05 s`, `λ = 200/s`. Para respeitar 10 req/s, reserve um horário por chamada (limitador de taxa, token bucket, GCRA). Na prática, usamos **os dois**: taxa para respeitar o contrato da API e semáforo para não abrir conexões demais se a latência subir.',
      },
      {
        type: 'match',
        id: 'conc-pat-q2',
        concept: 'Primitivas do asyncio',
        say: 'Cada problema tem a sua ferramenta. Associe!',
        prompt: 'Associe cada **necessidade** à ferramenta do asyncio que a resolve.',
        pairs: [
          { left: 'No máximo 5 downloads **ao mesmo tempo**', right: '`asyncio.Semaphore(5)`' },
          { left: 'No máximo 10 chamadas **por segundo**', right: 'Limitador de taxa (reserva de horário com `loop.time()`)' },
          { left: 'Produtor mais rápido que o consumidor', right: '`asyncio.Queue(maxsize=...)`' },
          { left: 'Cada tentativa pode levar no máximo 2 s', right: '`async with asyncio.timeout(2)`' },
          { left: 'Falha transitória sem sincronizar os clientes', right: 'Retry com backoff exponencial + jitter' },
          { left: 'Esperar todos os itens da fila serem processados', right: '`await fila.join()`' },
        ],
        explanation: 'Semáforo limita **concorrência**; limitador de taxa limita **vazão**; fila limitada cria **backpressure**; `asyncio.timeout` põe prazo num bloco; jitter espalha os retries para não virar uma rajada sincronizada; `join()` espera todos os `task_done()`.',
      },
      {
        type: 'code',
        id: 'conc-pat-q3',
        concept: 'asyncio.Semaphore',
        title: 'N tarefas, no máximo K simultâneas',
        timeoutMs: 15000,
        say: 'Sua vez! Os testes vão medir o pico de concorrência de verdade — nada de passar rodando tudo em sequência.',
        prompt: `Implemente a corrotina \`executar_limitado(fabricas, limite)\`:

- \`fabricas\` é uma lista de **funções assíncronas sem argumentos**: chamar \`f()\` cria a corrotina de um trabalho.
- Rode todas com **no máximo \`limite\` ao mesmo tempo** — e sem lotes: assim que um trabalho termina, o próximo começa.
- Devolva os resultados **na mesma ordem** de \`fabricas\`.
- \`limite < 1\` → \`ValueError\` (um \`Semaphore(0)\` travaria para sempre). Lista vazia → \`[]\`.

Os testes usam trabalhos instrumentados que medem o **pico** de execuções simultâneas.`,
        starter: `import asyncio

async def executar_limitado(fabricas, limite):
    # TODO: no máximo \`limite\` trabalhos rodando ao mesmo tempo
    resultados = []
    for fabrica in fabricas:
        resultados.append(await fabrica())   # sequencial: correto, mas lento
    return resultados
`,
        tests: [
          { name: 'resultados na ordem de entrada', code: MEDIDOR + `
m = _Medidor()
res = await _rodar([m.trabalho(i, passos=5 - i) for i in range(5)], 2)
assert res == [0, 10, 20, 30, 40], f"esperado [0, 10, 20, 30, 40], obtido {res!r}"
` },
          { name: 'pico de concorrência = limite (10 trabalhos, limite 3)', code: MEDIDOR + `
m = _Medidor()
await _rodar([m.trabalho(i, 3) for i in range(10)], 3)
assert m.pico <= 3, f"pico de {m.pico} trabalhos simultâneos, mas o limite é 3"
assert m.pico == 3, f"pico de só {m.pico}: com 10 trabalhos e limite 3, deveriam rodar 3 ao mesmo tempo"
` },
          { name: 'janela deslizante, não lotes', code: MEDIDOR + `
m = _Medidor()
fabricas = [m.trabalho(0, passos=60)] + [m.trabalho(i, passos=1) for i in range(1, 6)]
await _rodar(fabricas, 2)
assert m.pico == 2, f"pico de {m.pico}, esperado 2"
fim_lento = m.eventos.index(("fim", 0))
inicio_ultimo = m.eventos.index(("inicio", 5))
assert inicio_ultimo < fim_lento, "o trabalho 5 só começou depois que o 0 (lento) terminou: parece execução em LOTES. Libere a vaga assim que cada trabalho acaba."
` },
          { name: 'lista vazia', expr: 'await executar_limitado([], 3)', expected: '[]' },
          { name: 'limite maior que a quantidade de trabalhos', code: MEDIDOR + `
m = _Medidor()
res = await _rodar([m.trabalho(i, 2) for i in range(4)], 10)
assert res == [0, 10, 20, 30], f"obtido {res!r}"
assert m.pico == 4, f"com limite 10 e 4 trabalhos, todos deveriam rodar juntos (pico medido: {m.pico})"
` },
          { name: 'limite < 1 lança ValueError', code: MEDIDOR + `
m = _Medidor()
try:
    await _rodar([m.trabalho(0)], 0)
except ValueError:
    pass
else:
    raise AssertionError("limite=0 deveria lançar ValueError")
` },
          { name: 'limite 1 = um de cada vez', hidden: true, code: MEDIDOR + `
m = _Medidor()
res = await _rodar([m.trabalho(i, 2) for i in range(3)], 1)
assert res == [0, 10, 20], f"obtido {res!r}"
esperado = [("inicio", 0), ("fim", 0), ("inicio", 1), ("fim", 1), ("inicio", 2), ("fim", 2)]
assert m.eventos == esperado, f"com limite 1 os trabalhos deveriam rodar um de cada vez: {m.eventos}"
` },
          { name: '200 trabalhos, limite 7', hidden: true, code: MEDIDOR + `
m = _Medidor()
res = await _rodar([m.trabalho(i, i % 4) for i in range(200)], 7)
assert res == [i * 10 for i in range(200)], "resultados fora de ordem"
assert m.pico == 7, f"pico {m.pico}, esperado 7"
` },
        ],
        reviews: [
          {
            when: m => m.calls.includes('sleep'),
            text: 'Você usou `sleep` para "esperar vaga" (polling). Isso gasta ciclos do loop e adiciona latência: o `Semaphore` acorda a tarefa **exatamente** quando uma vaga abre, sem ficar perguntando.',
            concept: 'Polling × espera por evento',
          },
          {
            when: (m, code) => m.attributes.includes('acquire') && !/finally/.test(code),
            text: 'Você chama `acquire()`/`release()` na mão sem `try/finally`. Se o trabalho lançar exceção ou for cancelado, a vaga **nunca** é devolvida e o sistema vai travando aos poucos. Prefira `async with sem:`.',
            concept: 'Liberação garantida de recursos',
          },
        ],
        hints: [
          'Crie **um** `asyncio.Semaphore(limite)` antes de disparar os trabalhos — ele é o contador de vagas compartilhado.',
          'Envolva cada trabalho numa corrotina auxiliar: `async with sem: return await fabrica()`.',
          'Dispare tudo com `await asyncio.gather(*(auxiliar(f) for f in fabricas))` — o `gather` já devolve os resultados na ordem de entrada. Valide `limite < 1` logo no início.',
        ],
        solution: `import asyncio

async def executar_limitado(fabricas, limite):
    if limite < 1:
        raise ValueError("limite deve ser >= 1")
    sem = asyncio.Semaphore(limite)

    async def com_vaga(fabrica):
        async with sem:
            return await fabrica()

    return await asyncio.gather(*(com_vaga(f) for f in fabricas))
`,
        solutionExplanation: 'Um único `Semaphore(limite)` é o contador de vagas: cada trabalho entra no `async with` (ocupa uma vaga) e, ao terminar — com sucesso, erro ou cancelamento —, devolve a vaga e acorda o próximo da fila (FIFO). Isso é uma **janela deslizante**: nenhuma vaga fica ociosa esperando o lote. O `gather` preserva a ordem de entrada. Custo: as N corrotinas são criadas de uma vez; para N enorme ou fonte infinita, prefira **K workers + `Queue`** (memória O(K)).',
      },
      {
        type: 'order',
        id: 'conc-pat-q4',
        concept: 'Queue: task_done e join',
        say: 'Agora a vida de um item numa fila com `join()`, do nascimento ao encerramento.',
        prompt: 'Coloque em ordem o ciclo de um item num pipeline com `asyncio.Queue(maxsize=...)`, `task_done()` e `join()`.',
        items: [
          'O produtor chama `await fila.put(item)` — e espera se a fila estiver cheia',
          'Um consumidor recebe o item com `await fila.get()`',
          'O consumidor processa o item',
          'O consumidor chama `fila.task_done()` (no `finally`)',
          'Com todos os itens marcados, `await fila.join()` retorna',
          'O coordenador cancela os consumidores e aguarda com `gather(..., return_exceptions=True)`',
        ],
        explanation: 'O `join()` espera o contador de "itens não concluídos" zerar: ele sobe a cada `put` e desce a cada `task_done()`. Por isso o `task_done()` fica no `finally` — uma exceção no processamento não pode impedir a contagem. Depois do `join()`, os consumidores estão parados em `get()` para sempre; cancelá-los (e aguardar) evita tarefas penduradas.',
      },
      {
        type: 'code',
        id: 'conc-pat-q5',
        concept: 'Produtor/consumidor com fila limitada',
        title: 'Pipeline com backpressure',
        timeoutMs: 15000,
        say: 'Hora do pipeline! Os testes medem quantos itens o produtor puxa à frente — fila sem limite não passa.',
        prompt: `Implemente a corrotina \`pipeline(fonte, processar, consumidores=2, maxsize=2)\` no padrão **produtor/consumidor**:

- Um **produtor** percorre \`fonte\` (um iterável — pode ser um gerador lento) **uma única vez** e coloca os itens numa \`asyncio.Queue(maxsize=maxsize)\`.
- \`consumidores\` tarefas retiram itens da fila e chamam \`await processar(item)\`.
- Devolva a lista de resultados (**em qualquer ordem**).
- Se \`processar\` lançar exceção para um item, **descarte** esse item e continue: um item com defeito não pode travar nem derrubar o pipeline.
- Quando \`pipeline\` retornar, nenhum consumidor pode ficar pendurado.

Os testes medem o **pico de consumidores** trabalhando e **quantos itens o produtor puxa à frente** do processamento (backpressure).`,
        starter: `import asyncio

async def pipeline(fonte, processar, consumidores=2, maxsize=2):
    fila = asyncio.Queue(maxsize=maxsize)
    resultados = []

    async def produtor():
        # TODO: coloque cada item na fila e, no fim, avise os consumidores
        pass

    async def consumidor():
        # TODO: retire itens até receber o aviso de fim
        pass

    # TODO: rode o produtor e os consumidores ao mesmo tempo
    return resultados
`,
        tests: [
          { name: 'processa todos os itens', code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(6), r.processador()))
assert sorted(res) == [0, 10, 20, 30, 40, 50], f"obtido {sorted(res)!r}"
` },
          { name: 'consumidores em paralelo (pico = consumidores)', code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(12), r.processador(passos=3), consumidores=3, maxsize=2))
assert sorted(res) == [i * 10 for i in range(12)], "faltaram resultados"
assert r.pico <= 3, f"{r.pico} itens processados ao mesmo tempo, mas só há 3 consumidores"
assert r.pico == 3, f"pico de só {r.pico}: os 3 consumidores deveriam trabalhar ao mesmo tempo"
` },
          { name: 'backpressure: o produtor não dispara na frente', code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(30), r.processador(passos=3), consumidores=2, maxsize=2))
assert sorted(res) == [i * 10 for i in range(30)], "faltaram resultados"
teto = 2 + 2 + 1
assert r.maior_folga <= teto, f"o produtor chegou a puxar {r.maior_folga} itens à frente do processamento (máximo esperado: {teto}). Sem fila limitada não há backpressure."
` },
          { name: 'item com defeito é descartado, o resto segue', code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(8), r.processador(falha={2, 5})))
assert sorted(res) == [0, 10, 30, 40, 60, 70], f"obtido {sorted(res)!r}"
` },
          { name: 'fonte vazia termina', code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(iter([]), r.processador(), consumidores=3))
assert res == [], f"obtido {res!r}"
` },
          { name: 'nenhum consumidor fica pendurado', code: RASTRO + `
r = _Rastro()
antes = asyncio.all_tasks()
res = await _sem_travar(pipeline(r.fonte(5), r.processador(), consumidores=3))
assert sorted(res) == [0, 10, 20, 30, 40], f"obtido {sorted(res)!r}"
for _ in range(5):
    await asyncio.sleep(0)
eu = asyncio.current_task()
sobrando = [t for t in asyncio.all_tasks() - antes if t is not eu]
assert not sobrando, f"{len(sobrando)} tarefa(s) continuam pendentes depois que pipeline() retornou: encerre os consumidores (sentinela ou cancel)"
` },
          { name: 'um consumidor preserva a ordem (FIFO)', hidden: true, code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(6), r.processador(), consumidores=1, maxsize=1))
assert res == [0, 10, 20, 30, 40, 50], f"com um consumidor a ordem da fila deveria ser mantida: {res!r}"
assert r.maior_folga <= 3, f"folga de {r.maior_folga} itens com maxsize=1 e 1 consumidor"
` },
          { name: 'mais consumidores que itens', hidden: true, code: RASTRO + `
r = _Rastro()
res = await _sem_travar(pipeline(r.fonte(2), r.processador(falha={1}), consumidores=5, maxsize=1))
assert res == [0], f"obtido {res!r}"
` },
        ],
        reviews: [
          {
            when: (m, code) => /Queue\(\s*\)/.test(code),
            text: '`asyncio.Queue()` sem `maxsize` é uma fila **ilimitada**: `put` nunca espera, o produtor nunca é freado e a memória cresce com a diferença de ritmo. Use `Queue(maxsize=...)`.',
            concept: 'Backpressure',
          },
          {
            when: m => m.attributes.includes('empty'),
            text: 'Decidir o fim com `fila.empty()` é frágil: a fila pode estar vazia só **por um instante** (o produtor está prestes a colocar mais). Sinalize o fim de forma explícita: sentinela ou `join()` + `cancel()`.',
            concept: 'Encerramento de consumidores',
          },
          {
            when: (m, code) => m.attributes.includes('task_done') && !/finally/.test(code),
            text: 'Chame `task_done()` num `finally`: se `processar` lançar exceção antes dele, o contador do `join()` nunca zera e o pipeline espera para sempre.',
            concept: 'Queue: task_done e join',
          },
          {
            when: (m, code) => /put(_nowait)?\(\s*None\s*\)/.test(code),
            text: 'Usar `None` como sentinela funciona… até alguém precisar enfileirar um `None` de verdade. Um objeto único (`FIM = object()`) comparado com `is` é impossível de confundir.',
            concept: 'Sentinela',
          },
          {
            when: m => m.calls.includes('sleep'),
            text: 'Há `sleep` no seu pipeline — sinal de *polling* (verificar a fila de tempos em tempos). `await fila.get()` e `await fila.put()` já esperam pelo evento certo, sem custo.',
            concept: 'Polling × espera por evento',
          },
        ],
        hints: [
          'Produtor: `for item in fonte: await fila.put(item)`. O `await put` espera quando a fila está cheia — é isso que gera backpressure.',
          'Para encerrar, depois dos itens coloque **uma sentinela por consumidor** (`FIM = object()`); cada consumidor sai do laço ao recebê-la. (Alternativa: `await fila.join()` + `cancel()`.)',
          'Consumidor: `try: resultados.append(await processar(item))` / `except Exception: continue`. Rode tudo junto num `async with asyncio.TaskGroup() as tg:` — ele só sai quando todas as tarefas terminarem.',
        ],
        solution: `import asyncio

FIM = object()   # sentinela: objeto único

async def pipeline(fonte, processar, consumidores=2, maxsize=2):
    fila = asyncio.Queue(maxsize=maxsize)
    resultados = []

    async def produtor():
        for item in fonte:
            await fila.put(item)       # fila cheia? espera: backpressure
        for _ in range(consumidores):
            await fila.put(FIM)        # uma sentinela por consumidor

    async def consumidor():
        while (item := await fila.get()) is not FIM:
            try:
                resultados.append(await processar(item))
            except Exception:
                continue               # item com defeito: descarta e segue

    async with asyncio.TaskGroup() as tg:
        tg.create_task(produtor())
        for _ in range(consumidores):
            tg.create_task(consumidor())
    return resultados
`,
        solutionExplanation: 'A fila **limitada** faz o `await fila.put()` esperar quando os consumidores estão atrasados: o produtor nunca fica mais do que `maxsize + consumidores + 1` itens à frente (backpressure). O fim é avisado com **uma sentinela por consumidor** — um objeto único, comparado com `is`. O `try/except` dentro do laço impede que um item com defeito mate o consumidor (o que deixaria itens sem processar ou o produtor preso num `put`). O `TaskGroup` só sai quando produtor e consumidores terminam, então nada fica pendurado. Alternativa igualmente correta: `join()` com `task_done()` no `finally` e depois `cancel()` nos consumidores.',
      },
      {
        type: 'open',
        id: 'conc-pat-q6',
        concept: 'Backpressure',
        say: 'Para fechar, uma discussão de design — do tipo que aparece em entrevista de sênior.',
        prompt: 'Seu serviço lê eventos de um *stream* a **10 mil/s** e grava num banco que aguenta **2 mil/s**. Um colega sugere colocar um `asyncio.Queue()` **sem limite** entre as etapas "para não perder nada". O que acontece com o tempo? Que alternativas você proporia, e com quais trade-offs?',
        minWords: 30,
        rubric: [
          { label: 'Aponta que a **memória** cresce sem limite (até o processo cair)', keywords: ['memoria', 'oom', 'out of memory', 'estoura', 'estourar', 'cresce sem limite', 'cresce indefinidamente', 'crescer sem limite', 'crescer indefinidamente', 'heap', 'swap', 'derruba o processo'], concept: 'Fila ilimitada', why: 'Sobram 8 mil eventos por segundo: a fila cresce ~480 mil itens por minuto até o processo ser morto.' },
          { label: 'Aponta que a **latência** de cada item cresce (bufferbloat / Lei de Little)', keywords: ['latencia', 'atraso', 'demora', 'esperam', 'espera mais', 'tempo na fila', 'bufferbloat', 'envelhec', 'lei de little', 'defasag'], concept: 'Bufferbloat', why: 'Cada evento novo espera atrás de todos os acumulados; o atraso cresce sem parar, mesmo sem perder nada.' },
          { label: 'Propõe **backpressure**: fila limitada que freia o produtor', keywords: ['backpressure', 'back-pressure', 'contrapressao', 'maxsize', 'fila limitada', 'limitar a fila', 'fila com limite', 'bloque', 'desaceler', 'frear', 'freia', 'segurar o produtor'], concept: 'Backpressure', why: 'Com `maxsize`, o `await put()` segura a leitura do stream e a pressão chega à origem (que pode reter os dados, como o Kafka faz).' },
          { label: 'Discute outras saídas e seus custos: descartar/rejeitar, amostrar, lotes ou escalar o consumidor', keywords: ['descart', 'load shedding', 'shed', 'amostr', 'rejeit', '429', 'drop', 'escalar', 'mais consumidores', 'mais workers', 'lote', 'batch', 'agreg'], concept: 'Estratégias de sobrecarga', why: 'Se não dá para frear a origem, sobra escolher o que perder (itens, detalhe) ou aumentar a capacidade — cada opção tem um custo explícito.' },
        ],
        modelAnswer: `Com fila **sem limite**, sobram 8 mil eventos por segundo: a fila cresce sem parar e a **memória** estoura em algum momento (OOM) — e aí perdemos **tudo** o que estava em memória, o contrário do objetivo. Antes disso, a **latência** também explode: cada evento espera atrás de todos os acumulados (Lei de Little; é o *bufferbloat*).

Alternativas:
- **Backpressure**: \`Queue(maxsize=...)\`; o \`await put()\` freia a leitura do stream e a pressão volta para a origem, que retém os dados (ex.: o offset do Kafka simplesmente não avança). Custo: o consumo fica no ritmo do banco.
- **Aumentar a capacidade** do consumidor: gravar em **lotes** (batch insert) e/ou ter mais consumidores, se o banco aguentar.
- **Descartar/rejeitar** (*load shedding*, 429) ou **amostrar/agregar** quando perder parte dos dados é aceitável (métricas, por exemplo).

Eu usaria fila limitada + gravação em lote, e monitoraria o *lag* do consumidor.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Resumindo: **Semaphore** limita quantas ao mesmo tempo, **limitador de taxa** limita quantas por segundo, e **fila limitada** cria backpressure.',
          'Encerre consumidores com sentinela ou `join()` + `cancel()`, e trate retries com prazo por tentativa. Na próxima aula: as **armadilhas** que fazem código async travar em produção.',
        ],
        board: null,
      },
    ],
  });
})();
