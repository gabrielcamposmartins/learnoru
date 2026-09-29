(function () {
  // Servidor falso compartilhado pelos testes das duas partes (cada teste roda num namespace novo).
  const WEB = `import asyncio

class _Web:
    """Servidor falso: latência por URL, falhas programadas e medição de concorrência."""
    def __init__(self, paginas, atrasos=None, padrao=0.01):
        self.paginas = paginas            # url -> conteúdo (parte 1) ou lista de links (parte 2)
        self.atrasos = atrasos or {}
        self.padrao = padrao
        self.chamadas = []
        self.canceladas = []
        self.ativos = 0
        self.pico = 0

    async def buscar(self, url):
        self.chamadas.append(url)
        self.ativos += 1
        self.pico = max(self.pico, self.ativos)
        try:
            await asyncio.sleep(self.atrasos.get(url, self.padrao))
            if url not in self.paginas:
                raise ConnectionError(f"{url} fora do ar")
            conteudo = self.paginas[url]
            if isinstance(conteudo, Exception):
                raise conteudo
            return conteudo
        except asyncio.CancelledError:
            self.canceladas.append(url)
            raise
        finally:
            self.ativos -= 1

async def _sem_travar(coro, prazo=3):
    try:
        return await asyncio.wait_for(coro, prazo)
    except TimeoutError:
        raise AssertionError(f"não terminou em {prazo} s: alguma tarefa ficou esperando para sempre") from None

SITE = {
    "/": ["/a", "/b"],
    "/a": ["/c", "/"],
    "/b": ["/c", "/d"],
    "/c": ["/a"],
    "/d": [],
}
`;

  Game.registerModule('concurrency', {
    id: 'entrevista-concorrencia',
    title: 'Entrevista: concorrência',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'GIL e modelos de concorrência, um agregador assíncrono com limite, deduplicação, timeout e falhas parciais — e um crawler que sabe quando parar.',
    concepts: ['Threads × processos × async', 'Limite de concorrência', 'Timeout por requisição', 'Falhas parciais', 'Detecção de término'],
    takeaways: [
      'Comece pelo **tipo de carga**: I/O → async (ou threads); CPU → processos. Misturou? Async para o I/O e um pool de processos para a parte pesada.',
      'Um agregador robusto tem quatro defesas: **limite** de concorrência, **deduplicação**, timeout **por requisição** (contado depois de ganhar a vaga) e **falhas parciais** tratadas como dado.',
      'Para milhões de itens, troque "uma tarefa por item" por **K workers + fila limitada** alimentada em *streaming*: memória O(K).',
      'Num crawler, os workers produzem o próprio trabalho: marque URLs como vistas **ao enfileirar** e detecte o fim com `join()` + `task_done()` — nunca com `empty()`.',
      'Em produção: *politeness* por domínio, retries com backoff + jitter, fronteira persistente e parsing (CPU) fora do event loop.',
    ],
    glossary: [
      { term: 'Crawl frontier', aliases: ['fronteira de rastreamento', 'fronteira do crawler', 'URL frontier'], definition: 'A "fronteira" de um crawler: o conjunto de URLs **descobertas e ainda não visitadas**, com as regras de prioridade e de *politeness*. Em escala, fica num armazenamento persistente (fila, banco) para sobreviver a reinícios.' },
      { term: 'Detecção de término', aliases: ['termination detection', 'deteccao de termino', 'detecção de terminação'], definition: 'Problema de saber quando uma computação concorrente **acabou** de verdade: fila vazia não basta se algum worker ainda pode gerar trabalho. No asyncio, `Queue.join()` + `task_done()` resolve contando o trabalho pendente.' },
      { term: 'Politeness', aliases: ['polidez', 'crawl-delay', 'crawl delay'], definition: 'A "boa educação" de um crawler: limite de requisições **por domínio**, intervalo mínimo entre elas (`Crawl-delay`), respeito ao `robots.txt` e um `User-Agent` identificável.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Olá! Obrigada por vir. Hoje eu conduzo a sua entrevista de **concorrência**.',
          { text: 'Vamos de uma pergunta de conceito a um problema prático em duas partes — e, no fim, conversamos sobre produção.', mood: 'neutral' },
          'Pense em voz alta: aqui, **justificar** a escolha do modelo vale tanto quanto o código.',
        ],
        board: {
          title: '🎤 Roteiro da entrevista',
          md: `1. **Aquecimento** — GIL, threads × processos × async
2. **Parte 1** — um agregador assíncrono: limite de concorrência, deduplicação, timeout e falhas parciais
3. **Follow-up** — e se forem 1 milhão de URLs?
4. **Parte 2** — um crawler que descobre páginas e sabe quando parar
5. **Produção** — trade-offs e escala

> [!dica] Em entrevista de concorrência, diga **em voz alta** os riscos que está tratando: "aqui pode haver corrida", "isto precisa de timeout", "e se o serviço cair no meio?".`,
        },
      },
      {
        type: 'mcq',
        id: 'conc-ent-q1',
        concept: 'Threads × processos × async',
        say: 'Aquecimento, com um cenário real.',
        prompt: 'Um serviço recebe fotos por HTTP, gera **miniaturas** (redimensionamento em Python puro, ~200 ms de CPU por foto) e faz **upload** para um storage (~300 ms esperando a rede). Ele precisa atender centenas de requisições simultâneas. Que arquitetura você proporia?',
        options: [
          { text: 'Tudo em `asyncio`, inclusive o redimensionamento dentro das corrotinas.', why: '200 ms de CPU dentro de uma corrotina **bloqueiam o event loop**: durante esse tempo, nenhuma outra requisição anda.' },
          { text: 'Tudo com threads: um `ThreadPoolExecutor` grande resolve as duas partes.', why: 'Threads ajudam no upload (o GIL é solto na espera), mas o redimensionamento em Python puro disputa o GIL — na prática, um núcleo só para a parte pesada.' },
          { text: '`asyncio` para o HTTP e o upload; o redimensionamento vai para um `ProcessPoolExecutor` (via `loop.run_in_executor`), com um worker por núcleo.', correct: true, why: 'Cada parte com a ferramenta certa: I/O concorrente no event loop e CPU em paralelo nos processos, sem bloquear o loop.' },
          { text: 'Um processo novo (`multiprocessing.Process`) por requisição, fazendo tudo.', why: 'Criar um processo por requisição custa caro (milissegundos e megabytes cada) e não limita o paralelismo: centenas de processos disputando poucos núcleos.' },
        ],
        explanation: 'O segredo é **separar as cargas**. A parte IO-bound (receber, fazer upload) escala com concorrência: `asyncio` segura centenas de conexões numa thread. A parte CPU-bound escala com núcleos: um pool de **processos** do tamanho do número de núcleos, cada um com o seu GIL. `await loop.run_in_executor(pool, redimensionar, foto)` junta os dois mundos sem bloquear o loop. (No build *free-threaded*, um pool de **threads** também passaria a paralelizar a CPU.)',
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Agora o problema principal: um **agregador** que busca várias URLs ao mesmo tempo e junta os resultados.',
          'Há quatro armadilhas escondidas no enunciado. Os requisitos estão no quadro.',
        ],
        board: {
          title: '🧩 Parte 1: o agregador',
          md: `\`\`\`python
resultados, falhas = await coletar(urls, buscar, limite=3, timeout=0.1)
\`\`\`

| Requisito | Por quê |
|---|---|
| No máximo \`limite\` buscas **ao mesmo tempo** | não derrubar o servidor (nem estourar os *file descriptors*) |
| Cada URL distinta buscada **uma vez só** | a lista de entrada tem repetidas |
| **Timeout por requisição**, contado do início da busca | uma URL lenta não pode segurar as outras |
| **Falhas parciais**: erro numa URL não derruba as demais | um serviço fora do ar não pode apagar os outros resultados |
| Cancelamento de fora **cancela tudo** | quem chamou desistiu: nada fica rodando |

\`buscar(url)\` é uma função assíncrona **injetada** — nos testes, um servidor falso com latências e falhas programadas.

> [!atencao] Cuidado com **onde** o timeout começa a contar: se ele envolver a espera pela vaga do semáforo, as URLs do fim da fila estouram o prazo sem nem terem começado.`,
        },
      },
      {
        type: 'code',
        id: 'conc-ent-q2',
        concept: 'Limite de concorrência e falhas parciais',
        title: 'Parte 1: coletar',
        timeoutMs: 15000,
        say: 'Pode codar. O servidor falso mede quantas buscas rodam ao mesmo tempo — e conta as repetidas.',
        prompt: `Implemente a corrotina \`coletar(urls, buscar, limite=3, timeout=0.1)\`, que devolve a tupla \`(resultados, falhas)\`:

- \`resultados\`: dict **url → conteúdo** devolvido por \`await buscar(url)\`, só para as buscas bem-sucedidas.
- \`falhas\`: dict **url → motivo**: \`"timeout"\` se a busca passar de \`timeout\` segundos; senão, o **nome da classe** da exceção (ex.: \`"ConnectionError"\`).
- No máximo \`limite\` buscas em andamento ao mesmo tempo (sem lotes: terminou uma, começa a próxima).
- URLs repetidas são buscadas **uma única vez**.
- O timeout vale para **cada busca** e conta a partir do momento em que ela **começa** (a espera por uma vaga não conta).
- Uma falha não interrompe as outras buscas. Mas, se quem chamou \`coletar\` for **cancelado**, todas as buscas devem ser canceladas.
- \`limite < 1\` → \`ValueError\`.`,
        starter: `import asyncio

async def coletar(urls, buscar, limite=3, timeout=0.1):
    resultados, falhas = {}, {}
    # TODO: limite de concorrência, deduplicação, timeout por busca e falhas parciais
    for url in urls:
        resultados[url] = await buscar(url)      # sequencial e sem proteção nenhuma
    return resultados, falhas
`,
        tests: [
          { name: 'coleta tudo quando dá tudo certo', code: WEB + `
web = _Web({"/a": "A", "/b": "B", "/c": "C"})
res, fal = await _sem_travar(coletar(["/a", "/b", "/c"], web.buscar))
assert res == {"/a": "A", "/b": "B", "/c": "C"}, f"resultados: {res!r}"
assert fal == {}, f"falhas: {fal!r}"
` },
          { name: 'URLs repetidas são buscadas uma vez só', code: WEB + `
web = _Web({"/a": "A", "/b": "B"})
res, fal = await _sem_travar(coletar(["/a", "/b", "/a", "/a", "/b"], web.buscar))
assert sorted(web.chamadas) == ["/a", "/b"], f"buscas feitas: {web.chamadas}"
assert res == {"/a": "A", "/b": "B"}, f"resultados: {res!r}"
` },
          { name: 'no máximo `limite` buscas ao mesmo tempo', code: WEB + `
paginas = {f"/p{i}": i for i in range(10)}
web = _Web(paginas, padrao=0.02)
res, fal = await _sem_travar(coletar(list(paginas), web.buscar, limite=3))
assert len(res) == 10, f"{len(res)} resultados, esperado 10 (falhas: {fal!r})"
assert web.pico <= 3, f"{web.pico} buscas simultâneas, mas o limite é 3"
assert web.pico == 3, f"pico de só {web.pico}: com 10 URLs e limite 3, deveriam rodar 3 ao mesmo tempo"
` },
          { name: 'falhas parciais: o nome da exceção vai para falhas', code: WEB + `
web = _Web({"/ok": "OK", "/json": ValueError("json inválido")})
res, fal = await _sem_travar(coletar(["/ok", "/json", "/fora"], web.buscar))
assert res == {"/ok": "OK"}, f"resultados: {res!r}"
assert fal == {"/json": "ValueError", "/fora": "ConnectionError"}, f"falhas: {fal!r}"
` },
          { name: 'timeout por busca: a lenta não segura as outras', code: WEB + `
web = _Web({"/rapida": 1, "/lenta": 2, "/outra": 3}, atrasos={"/lenta": 1.0})
loop = asyncio.get_running_loop()
t0 = loop.time()
res, fal = await _sem_travar(coletar(["/rapida", "/lenta", "/outra"], web.buscar, timeout=0.05))
dt = loop.time() - t0
assert fal == {"/lenta": "timeout"}, f"falhas: {fal!r}"
assert res == {"/rapida": 1, "/outra": 3}, f"resultados: {res!r}"
assert dt < 0.5, f"levou {dt:.2f} s: a busca lenta deveria ter sido interrompida em ~0.05 s"
` },
          { name: 'a espera por uma vaga não conta no timeout', code: WEB + `
paginas = {f"/p{i}": i for i in range(16)}
web = _Web(paginas, padrao=0.02)
res, fal = await _sem_travar(coletar(list(paginas), web.buscar, limite=2, timeout=0.1))
assert fal == {}, f"{len(fal)} busca(s) estouraram o prazo sem motivo ({sorted(fal)[:3]}…): o timeout deve contar a partir do início da busca, não durante a espera pela vaga"
assert len(res) == 16, f"{len(res)} resultados, esperado 16"
` },
          { name: 'limite < 1 lança ValueError', code: WEB + `
web = _Web({"/a": 1})
try:
    await coletar(["/a"], web.buscar, limite=0)
except ValueError:
    pass
else:
    raise AssertionError("limite=0 deveria lançar ValueError")
` },
          { name: 'lista vazia', hidden: true, expr: 'coletar([], None)', expected: '({}, {})' },
          { name: 'cancelamento de fora cancela todas as buscas', hidden: true, code: WEB + `
paginas = {f"/p{i}": i for i in range(6)}
web = _Web(paginas, padrao=0.5)
try:
    async with asyncio.timeout(0.05):
        await coletar(list(paginas), web.buscar, limite=3, timeout=1)
except TimeoutError:
    pass
else:
    raise AssertionError("o timeout de fora deveria ter estourado")
for _ in range(3):
    await asyncio.sleep(0)
assert len(web.chamadas) == 3, f"nenhuma busca nova deveria começar depois do cancelamento: {web.chamadas}"
assert sorted(web.canceladas) == sorted(web.chamadas), f"as buscas em andamento deveriam ser canceladas (iniciadas: {web.chamadas}, canceladas: {web.canceladas})"
` },
        ],
        reviews: [
          {
            when: (m, code) => m.bareExcepts > 0 || /except\s*\(?[^:\n]*\bBaseException\b/.test(code),
            text: '`except:` puro ou `except BaseException` engolem o `CancelledError`: a tarefa cancelada segue como se nada tivesse acontecido e registra "CancelledError" como se fosse uma falha da URL. Aqui o `TaskGroup` ainda propaga o cancelamento, mas num worker em laço ela continuaria buscando URLs depois que quem chamou desistiu. Capture `Exception` — o cancelamento precisa passar.',
            concept: 'Não engolir CancelledError',
          },
          {
            when: m => m.calls.includes('sleep'),
            text: 'Há `sleep` na sua solução — sinal de *polling* ou de espera fixa. O `Semaphore` acorda a próxima busca **exatamente** quando uma vaga abre, e o `asyncio.timeout` interrompe a busca na hora certa: nenhuma espera manual é necessária.',
            concept: 'Polling × espera por evento',
          },
        ],
        hints: [
          'Deduplique **antes** de disparar: `dict.fromkeys(urls)` remove as repetidas e preserva a ordem. Crie **um** `asyncio.Semaphore(limite)` para todas as buscas.',
          'Uma corrotina auxiliar por URL: `async with sem:` e, **dentro** dele, `async with asyncio.timeout(timeout): conteudo = await buscar(url)`. Assim o prazo só começa quando a busca ganha a vaga.',
          'Trate os erros dentro da auxiliar: `except TimeoutError` → `"timeout"`; `except Exception as e` → `type(e).__name__`. Rode todas num `async with asyncio.TaskGroup() as tg:` — o cancelamento de fora chega às filhas sozinho.',
        ],
        solution: `import asyncio

async def coletar(urls, buscar, limite=3, timeout=0.1):
    if limite < 1:
        raise ValueError("limite deve ser >= 1")
    sem = asyncio.Semaphore(limite)
    resultados, falhas = {}, {}

    async def uma(url):
        async with sem:                                # espera a vaga (sem prazo)
            try:
                async with asyncio.timeout(timeout):   # prazo só da busca
                    resultados[url] = await buscar(url)
            except TimeoutError:
                falhas[url] = "timeout"
            except Exception as erro:                  # CancelledError passa direto
                falhas[url] = type(erro).__name__

    async with asyncio.TaskGroup() as tg:
        for url in dict.fromkeys(urls):                # dedup preservando a ordem
            tg.create_task(uma(url))
    return resultados, falhas
`,
        solutionExplanation: '`dict.fromkeys(urls)` deduplica preservando a ordem. O semáforo limita as buscas simultâneas numa janela deslizante, e o `asyncio.timeout` fica **dentro** do `async with sem` — o prazo mede a busca, não a fila. Cada auxiliar transforma a própria falha em dado (`"timeout"` ou o nome da exceção), então nenhuma exceção chega ao `TaskGroup` e as outras buscas seguem: **falhas parciais** viram resultado, não erro. `except Exception` deixa o `CancelledError` passar — se quem chamou desistir, o `TaskGroup` cancela as filhas (inclusive as que ainda esperam vaga) e nada fica pendurado. E não há corrida nos dicts: no asyncio só há troca de tarefa nos `await`, e cada escrita acontece sem `await` no meio.',
      },
      {
        type: 'mcq',
        id: 'conc-ent-q3',
        concept: 'Workers + fila × uma tarefa por item',
        say: 'Funciona! Agora o follow-up que eu sempre faço…',
        prompt: 'O seu `coletar` vai rodar com **1 milhão** de URLs, lidas de um arquivo enorme, com `limite=50`. O que você mudaria?',
        options: [
          { text: 'Nada: o semáforo já garante no máximo 50 buscas ao mesmo tempo.', why: 'O semáforo limita as buscas **em andamento**, mas as 1 milhão de tarefas (e a lista de URLs) são criadas de uma vez: memória e agendamento explodem antes de a primeira busca terminar.' },
          { text: 'Trocar por **50 workers** consumindo uma `asyncio.Queue(maxsize=...)` alimentada pelo arquivo em *streaming*, gravando os resultados conforme chegam.', correct: true, why: 'Memória O(workers + fila): só existem 50 tarefas, a leitura do arquivo é freada pela fila (backpressure) e os resultados não se acumulam todos na RAM.' },
          { text: 'Aumentar o `limite` para 1 milhão, para terminar mais rápido.', why: 'Isso derruba o servidor e esgota os *file descriptors* do seu processo: mais concorrência só ajuda até o gargalo do outro lado.' },
          { text: 'Trocar `asyncio` por 1 milhão de threads.', why: 'Cada thread reserva uma pilha e custa trocas de contexto: o sistema operacional não aguenta — e a concorrência continuaria sem limite.' },
        ],
        explanation: 'Semáforo + uma tarefa por item é ótimo até alguns milhares de itens. Acima disso, o custo está em **criar tudo de uma vez**: um milhão de corrotinas vivas, a lista inteira na memória e um dict de resultados gigante. O padrão escalável é **K workers + fila limitada**: o produtor lê o arquivo aos poucos (o `await fila.put()` segura a leitura quando os workers estão ocupados) e cada resultado é gravado assim que chega. Mesmo limite de concorrência, memória O(K).',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Última etapa de código: o **crawler**. Agora cada página devolve links, e esses links viram trabalho novo.',
          'A pergunta difícil deixa de ser "como paralelizar" e vira: **como saber que acabou?**',
        ],
        board: {
          title: '🕷️ Parte 2: o crawler',
          md: `\`\`\`python
visitadas, falhas = await rastrear("/", buscar, limite=3, max_paginas=100, timeout=0.1)
# agora buscar(url) devolve a LISTA de links da página
\`\`\`

\`\`\`text
"/" ──▶ "/a" ──▶ "/c"
 │        └────▶ "/"      ← ciclo: sem deduplicação, o crawler nunca para
 └───▶ "/b" ──▶ "/c"      ← duas páginas apontam para "/c": buscar UMA vez
\`\`\`

Os requisitos da parte 1 continuam (limite, timeout por busca, falhas parciais), e chegam mais três:

| Requisito | Armadilha |
|---|---|
| Cada URL buscada **no máximo uma vez** | marcar como "vista" só **depois** de buscar deixa duas tarefas buscarem a mesma URL |
| No máximo \`max_paginas\` buscas | sem teto, um site "infinito" (calendários!) prende o crawler para sempre |
| **Terminar** quando não houver mais nada | fila vazia ≠ fim: um worker ainda pode estar buscando e prestes a descobrir links |

> [!sabia] Saber quando uma computação concorrente terminou é um problema clássico, com nome próprio: **detecção de término** (*termination detection*). O algoritmo de **Dijkstra e Scholten** (1980) resolve a versão distribuída contando o trabalho "em aberto" — e o \`Queue.join()\` do asyncio aplica a mesma ideia: um contador que sobe a cada \`put\` e desce a cada \`task_done()\`.`,
        },
      },
      {
        type: 'code',
        id: 'conc-ent-q4',
        concept: 'Detecção de término',
        title: 'Parte 2: rastrear',
        timeoutMs: 15000,
        say: 'Pode escrever. Os testes têm ciclos, links quebrados, páginas lentas e um site "infinito".',
        prompt: `Implemente a corrotina \`rastrear(raiz, buscar, limite=3, max_paginas=100, timeout=0.1)\`, que devolve \`(visitadas, falhas)\`:

- \`await buscar(url)\` devolve a **lista de links** da página. Comece pela \`raiz\` e siga os links (em largura ou em qualquer ordem).
- \`visitadas\`: dict **url → lista de links**, para as buscas bem-sucedidas. \`falhas\`: dict **url → motivo** (\`"timeout"\` ou o nome da classe da exceção), como na parte 1. Os links de uma página que falhou, claro, não são seguidos.
- Cada URL é buscada **no máximo uma vez**, com no máximo \`limite\` buscas ao mesmo tempo e \`timeout\` por busca.
- No máximo \`max_paginas\` buscas **no total** (contando as que falham); URLs além do teto são ignoradas.
- A função deve **terminar** quando não houver mais nada para buscar — sem deixar tarefas penduradas.
- \`limite < 1\` → \`ValueError\`.`,
        starter: `import asyncio

async def rastrear(raiz, buscar, limite=3, max_paginas=100, timeout=0.1):
    visitadas, falhas = {}, {}
    # TODO: fila de URLs + workers; dedup; limite; timeout; saber quando terminou
    links = await buscar(raiz)
    visitadas[raiz] = links
    return visitadas, falhas
`,
        tests: [
          { name: 'visita todas as páginas alcançáveis, uma vez cada (há ciclos)', code: WEB + `
web = _Web(SITE)
vis, fal = await _sem_travar(rastrear("/", web.buscar))
assert vis == SITE, f"visitadas: {sorted(vis)}"
assert fal == {}, f"falhas: {fal!r}"
assert sorted(web.chamadas) == sorted(SITE), f"cada URL deveria ser buscada uma vez só: {sorted(web.chamadas)}"
` },
          { name: 'link quebrado e página lenta viram falhas; o resto continua', code: WEB + `
site = {"/": ["/ok", "/quebrado", "/lento"], "/ok": ["/fim"], "/lento": ["/escondido"], "/fim": [], "/escondido": []}
web = _Web(site, atrasos={"/lento": 1.0})
vis, fal = await _sem_travar(rastrear("/", web.buscar, timeout=0.05))
assert sorted(vis) == ["/", "/fim", "/ok"], f"visitadas: {sorted(vis)}"
assert fal == {"/quebrado": "ConnectionError", "/lento": "timeout"}, f"falhas: {fal!r}"
` },
          { name: 'no máximo `limite` buscas ao mesmo tempo', code: WEB + `
site = {"/": [f"/p{i}" for i in range(12)]}
site.update({f"/p{i}": [] for i in range(12)})
web = _Web(site, padrao=0.02)
vis, fal = await _sem_travar(rastrear("/", web.buscar, limite=3))
assert len(vis) == 13, f"{len(vis)} páginas visitadas, esperado 13 (falhas: {fal!r})"
assert web.pico <= 3, f"{web.pico} buscas simultâneas, mas o limite é 3"
assert web.pico == 3, f"pico de só {web.pico}: as buscas deveriam rodar em paralelo"
` },
          { name: 'site enorme: respeita max_paginas', code: WEB + `
site = {f"/p{i}": [f"/p{2 * i + 1}", f"/p{2 * i + 2}"] for i in range(500)}
web = _Web(site)
vis, fal = await _sem_travar(rastrear("/p0", web.buscar, max_paginas=10))
assert len(set(web.chamadas)) == len(web.chamadas), "alguma URL foi buscada duas vezes"
assert len(web.chamadas) == 10, f"{len(web.chamadas)} buscas feitas: o site tem centenas de páginas, então deveriam ser exatamente max_paginas=10"
assert len(vis) + len(fal) == 10
` },
          { name: 'raiz fora do ar', code: WEB + `
web = _Web({})
vis, fal = await _sem_travar(rastrear("/", web.buscar))
assert vis == {} and fal == {"/": "ConnectionError"}, f"obtido {vis!r}, {fal!r}"
` },
          { name: 'links repetidos e autorreferência', hidden: true, code: WEB + `
site = {"/": ["/", "/x", "/x", "/y"], "/x": ["/y", "/x"], "/y": ["/"]}
web = _Web(site)
vis, fal = await _sem_travar(rastrear("/", web.buscar, limite=2))
assert vis == site and fal == {}, f"obtido {vis!r}, {fal!r}"
assert sorted(web.chamadas) == ["/", "/x", "/y"], f"buscas: {web.chamadas}"
` },
          { name: 'nenhuma tarefa fica pendurada', hidden: true, code: WEB + `
web = _Web(SITE)
antes = asyncio.all_tasks()
await _sem_travar(rastrear("/", web.buscar, limite=4))
for _ in range(3):
    await asyncio.sleep(0)
eu = asyncio.current_task()
sobrando = [t for t in asyncio.all_tasks() - antes if t is not eu]
assert not sobrando, f"{len(sobrando)} tarefa(s) continuam pendentes depois que rastrear() retornou: encerre os workers"
` },
          { name: 'limite < 1 lança ValueError', hidden: true, code: WEB + `
web = _Web(SITE)
try:
    await rastrear("/", web.buscar, limite=0)
except ValueError:
    pass
else:
    raise AssertionError("limite=0 deveria lançar ValueError")
` },
        ],
        reviews: [
          {
            when: m => m.attributes.includes('empty'),
            text: 'Se você decide o fim com `fila.empty()`, cuidado: a fila pode estar vazia só **por um instante**, enquanto um worker ainda busca uma página que vai trazer links novos. Isso só é seguro combinado com um contador de buscas em andamento — que é exatamente o que `join()` + `task_done()` fazem por você.',
            concept: 'Detecção de término',
          },
          {
            when: (m, code) => m.attributes.includes('task_done') && !/finally/.test(code),
            text: 'Chame `task_done()` num `finally`: se a busca lançar exceção antes dele, o contador do `join()` nunca zera e o crawler espera para sempre.',
            concept: 'Queue: task_done e join',
          },
          {
            when: (m, code) => /Queue\(\s*(maxsize\s*=\s*)?[1-9]/.test(code) && /await\s+[\w.]+\.put\(/.test(code),
            text: 'Aqui os **próprios workers** enfileiram links. Com fila limitada e `await put()`, todos os workers podem ficar presos no `put` com a fila cheia — e ninguém mais consome: um **deadlock** (produtores e consumidores são as mesmas tarefas). O teto vem de `max_paginas`; a fila pode ser ilimitada, com `put_nowait`.',
            concept: 'Deadlock em filas autoalimentadas',
          },
        ],
        hints: [
          'Use uma `asyncio.Queue` com as URLs a buscar e `limite` workers (`while True: url = await fila.get()`). O número de workers já é o limite de concorrência.',
          'Deduplique **ao enfileirar**: um `set` de URLs já vistas (comece com a raiz). Só enfileire um link se ele ainda não foi visto **e** se `len(vistas) < max_paginas`.',
          'Para saber que acabou: `task_done()` no `finally` de cada item e `await fila.join()` no coordenador; depois, `cancel()` nos workers (parados no `get`) e `gather(..., return_exceptions=True)`. Use `put_nowait`: com os workers produzindo, uma fila limitada com `await put()` pode travar.',
        ],
        solution: `import asyncio

async def rastrear(raiz, buscar, limite=3, max_paginas=100, timeout=0.1):
    if limite < 1:
        raise ValueError("limite deve ser >= 1")
    visitadas, falhas = {}, {}
    vistas = {raiz}                        # dedup AO ENFILEIRAR, não depois de buscar
    fila = asyncio.Queue()                 # sem maxsize: os próprios workers produzem
    fila.put_nowait(raiz)

    async def worker():
        while True:
            url = await fila.get()
            try:
                async with asyncio.timeout(timeout):
                    links = await buscar(url)
                visitadas[url] = links
                for link in links:
                    if link not in vistas and len(vistas) < max_paginas:
                        vistas.add(link)
                        fila.put_nowait(link)
            except TimeoutError:
                falhas[url] = "timeout"
            except Exception as erro:
                falhas[url] = type(erro).__name__
            finally:
                fila.task_done()           # SEMPRE: é o que faz o join() funcionar

    workers = [asyncio.create_task(worker()) for _ in range(limite)]
    try:
        await fila.join()                  # o contador de pendentes chegou a zero
    finally:
        for w in workers:
            w.cancel()                     # estão parados no get(): encerra
        await asyncio.gather(*workers, return_exceptions=True)
    return visitadas, falhas
`,
        solutionExplanation: 'A fila é a **fronteira** do crawler, e os `limite` workers dão o limite de concorrência. A deduplicação acontece **ao enfileirar** (o `set` `vistas`): se fosse feita depois de buscar, duas tarefas poderiam pegar a mesma URL. O mesmo `set` impõe o teto de `max_paginas`. O fim é detectado pelo `join()`: o contador de pendentes sobe a cada `put` e só desce no `task_done()` — e um item só é concluído **depois** de enfileirar os links que descobriu, então o contador nunca zera cedo demais (fila vazia com um worker ainda buscando não engana ninguém). O `finally` garante o `task_done()` até em falhas; no fim, os workers parados no `get()` são cancelados e aguardados. A fila é ilimitada de propósito: os workers são produtores **e** consumidores, e um `await put()` numa fila cheia poderia travar todos eles.',
      },
      {
        type: 'open',
        id: 'conc-ent-q5',
        concept: 'Crawler em produção',
        say: 'Última pergunta, de sênior: como você levaria esse crawler para produção?',
        prompt: 'O crawler agora precisa rodar em produção, em **milhões** de páginas de **milhares de sites**, 24 horas por dia. Que problemas aparecem e o que você mudaria no design? Fale de trade-offs.',
        minWords: 40,
        rubric: [
          { label: '**Politeness**: limite e intervalo **por domínio**, `robots.txt`, respeito a `429`/`Retry-After`', keywords: ['dominio', 'por host', 'por site', 'por servidor', 'robots', 'polidez', 'politeness', 'crawl-delay', 'crawl delay', 'rate limit', '429', 'retry-after'], concept: 'Politeness', why: 'O limite global não protege um site pequeno de receber todas as suas requisições ao mesmo tempo — e crawlers mal-educados são bloqueados.' },
          { label: '**Retries** com backoff exponencial + jitter, só para falhas transitórias', keywords: ['retry', 'retri', 'retent', 'tentar de novo', 'nova tentativa', 'novas tentativas', 'backoff', 'jitter', 'transit'], concept: 'Retries com backoff', why: 'Em milhões de páginas, falhas transitórias são certas; repetir sem backoff e jitter vira uma tempestade de retries.' },
          { label: '**Escala e durabilidade**: fronteira persistente, deduplicação em escala (ex.: Bloom filter), vários workers ou máquinas', keywords: ['persist', 'redis', 'kafka', 'fila duravel', 'banco', 'bloom', 'checkpoint', 'distribu', 'varias maquinas', 'particion', 'shard', 'frontier', 'fronteira'], concept: 'Crawl frontier', why: 'A fronteira e o conjunto de vistas não cabem na memória nem podem sumir num reinício.' },
          { label: 'Tira o **parsing** (CPU-bound) do event loop, com um pool de processos', keywords: ['parse', 'parsing', 'html', 'cpu', 'processo', 'processpool', 'process pool', 'multiprocessing', 'bloquear o loop', 'bloqueia o loop', 'executor'], concept: 'CPU fora do event loop', why: 'Extrair links de HTML é trabalho de CPU: dentro do event loop, ele trava todas as buscas.' },
        ],
        modelAnswer: `Em escala, os problemas mudam de natureza:

- **Politeness**: o limite global não basta — preciso de limite e intervalo **por domínio** (um semáforo ou token bucket por host), respeitar o \`robots.txt\` e o \`Crawl-delay\`, e recuar ao receber \`429\`/\`Retry-After\`. Senão, derrubo sites pequenos e sou bloqueado.
- **Falhas**: retries com **backoff** exponencial e jitter, só para falhas transitórias (timeout, 5xx) e com limite de tentativas; o resto vai para uma lista de falhas para análise.
- **Escala e durabilidade**: a fronteira (URLs a visitar) não cabe na memória nem pode sumir num reinício — vai para uma fila **persistente** (Kafka, Redis ou banco), particionada por domínio entre vários workers e máquinas. A deduplicação em escala pode usar um **Bloom filter** (aceitando raros falsos positivos) ou um banco de URLs normalizadas.
- **CPU**: fazer o parsing do HTML dentro do event loop bloquearia as buscas; eu mandaria o parsing para um **pool de processos**, deixando o loop só com I/O.

Trade-offs: durabilidade e distribuição trazem complexidade operacional; o Bloom filter economiza memória em troca de pular algumas páginas; e a politeness reduz a vazão, mas é o que mantém o crawler aceito pelos sites.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Obrigada, foi uma ótima conversa! Feedback: você separou **I/O de CPU**, tratou falhas parciais como dado e fez o crawler **terminar** do jeito certo.',
          { text: 'O que diferencia um sênior aqui: saber onde o timeout começa a contar, pensar em **quem cancela quem** e lembrar da *politeness* — o crawler mais rápido é o primeiro a ser bloqueado.', mood: 'neutral' },
          'Boa sorte nas entrevistas de verdade!',
        ],
        board: null,
      },
    ],
  });
})();
