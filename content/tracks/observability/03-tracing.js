(function () {
  // Prelúdio dos testes de traceparent: IDs do exemplo da especificação W3C e um gerador de IDs injetado.
  const IDS = `TID = "4bf92f3577b34da6a3ce929d0e0e4736"
PID = "00f067aa0ba902b7"
EXEMPLO = "00-" + TID + "-" + PID + "-01"

def GERAR_ID(n):
    """Gerador determinístico: devolve n caracteres hexadecimais."""
    return {32: "ab" * 16, 16: "cd" * 8}[n]
`;

  // Prelúdio dos testes de caminho crítico: o trace do checkout do quadro (tempos em ms, relógio injetado).
  const TRACE = `def _s(id, parent, name, start, end):
    return {"id": id, "parent": parent, "name": name, "start": start, "end": end}

# fora de ordem de propósito: os spans chegam ao backend na ordem em que terminam/são exportados
CHECKOUT = [
    _s("e", "a", "pagamento", 120, 470),
    _s("a", None, "POST /checkout", 0, 480),
    _s("h", "g", "POST /adquirente", 135, 455),
    _s("c", "a", "carrinho", 30, 110),
    _s("b", "a", "auth", 5, 25),
    _s("f", "e", "antifraude", 125, 300),
    _s("i", "a", "publica e-mail", 118, 122),
    _s("g", "e", "gateway do cartão", 130, 460),
    _s("d", "c", "SELECT itens", 35, 100),
]
`;

  Game.registerModule('observability', {
    id: 'tracing',
    title: 'Tracing distribuído',
    kind: 'lesson',
    level: 2,
    order: 3,
    unit: 'sinais',
    summary: 'Siga uma requisição por dez serviços: traces, spans, propagação de contexto com o cabeçalho W3C traceparent, amostragem head × tail, OpenTelemetry e o caminho crítico que explica para onde foi o tempo.',
    concepts: ['Trace e span', 'Propagação de contexto', 'W3C traceparent', 'Amostragem head × tail', 'Caminho crítico'],
    takeaways: [
      'Um **trace** é a árvore de **spans** de uma requisição: todos compartilham o `trace_id`, e cada span aponta para o pai pelo `parent_span_id`.',
      '**Propagação de contexto** é o que costura o trace: dentro do processo via `contextvars`; entre processos via cabeçalho — *inject* no cliente, *extract* no servidor. Um salto sem propagação parte o trace em dois.',
      '`traceparent` = **versão-traceid-parentid-flags** (`00-<32 hex>-<16 hex>-01`). Ao chamar adiante, mantenha o trace-id e as flags e troque o parent-id pelo **seu** span. Header inválido: ignore e comece um trace novo — nunca derrube a requisição.',
      '**Head sampling** decide na raiz (barato, mas cego); **tail sampling** decide com o trace completo (guarda erros e lentos, mas exige buffer e que todos os spans cheguem ao mesmo Collector).',
      'O **caminho crítico** mostra o que realmente determinou a duração: acelerar um span fora dele (em paralelo com outro mais lento) não muda nada para o usuário.',
    ],
    glossary: [
      { term: 'Trace', aliases: ['traces', 'rastro', 'rastreamento distribuído', 'tracing distribuído', 'distributed tracing'], definition: 'Registro do caminho completo de uma requisição pelo sistema: uma **árvore de spans** que compartilham o mesmo `trace_id`.' },
      { term: 'Span', aliases: ['spans'], definition: 'Uma operação dentro de um trace — com nome, início, fim, atributos, eventos, status e o id do **span pai**. Uma chamada remota costuma gerar dois: CLIENT em quem chama e SERVER em quem atende.' },
      { term: 'Propagação de contexto', aliases: ['context propagation', 'propagação do contexto'], definition: 'Transporte do `trace_id` e do span atual entre funções (via `contextvars`) e entre processos (via cabeçalhos como `traceparent`), para que spans de lugares diferentes caiam no mesmo trace.' },
      { term: 'traceparent', aliases: ['W3C Trace Context', 'trace context'], definition: 'Cabeçalho padrão do W3C Trace Context: `versão-traceid-parentid-flags`, ex.: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. O bit 0 das flags diz se o trace é amostrado.' },
      { term: 'Tail sampling', aliases: ['tail-based sampling', 'amostragem tail-based', 'amostragem pela cauda'], definition: 'Amostragem decidida **depois** que o trace termina, olhando o trace inteiro (erro? lento?). Contrasta com o *head sampling*, decidido na raiz antes de saber como a requisição vai acabar.' },
      { term: 'OpenTelemetry', aliases: ['OTel', 'OTLP'], definition: 'Padrão aberto da CNCF para gerar e exportar traces, métricas e logs: API, SDKs, instrumentação automática, o protocolo **OTLP** e o **Collector** — independente do fornecedor do backend.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'O p99 do checkout foi para 480 ms. As métricas avisam **que** piorou; os logs de doze serviços contam pedaços soltos.',
          'Hoje você vai aprender a responder **onde** foi parar o tempo: com um **trace**.',
        ],
        board: {
          title: 'Traces e spans',
          md: `Um **trace** é a história de **uma** requisição atravessando o sistema. Ele é uma **árvore de spans**: cada span é uma operação com início, fim e um pai.

\`\`\`text
ms                    0         120       240       360      480
                      |---------|---------|---------|---------|
POST /checkout        ████████████████████████████████████████  480
  auth                ██                                         20
  carrinho              ███████                                  80
    SELECT itens         █████                                   65
  publica e-mail                █                                 4
  pagamento                     █████████████████████████████   350
    antifraude                  ███████████████                 175
    gateway do cartão            ███████████████████████████    330
      POST /adquirente           ███████████████████████████    320
\`\`\`

Essa visão em **cascata** (*waterfall*) mostra de cara: 320 dos 480 ms foram esperando o adquirente do cartão.

| Sinal | Responde | Exemplo |
|---|---|---|
| Métricas | **quanto**, agregado | "o p99 do checkout subiu para 480 ms" |
| Logs | **o que aconteceu** num ponto | "pagamento recusado: saldo insuficiente" |
| Traces | **onde** e **em que ordem**, numa requisição | "320 ms esperando o adquirente, em série com o carrinho" |

> [!dica] Coloque o \`trace_id\` em **todo log** estruturado. Aí, do trace lento você pula direto para os logs daquela requisição — em todos os serviços — sem caçar por horário.

A ideia vem do **Dapper**, o sistema interno do Google descrito num artigo de 2010. Zipkin (Twitter) e Jaeger (Uber) são descendentes abertos; hoje o padrão da indústria para gerar os dados é o **OpenTelemetry**.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Vamos abrir um span e ver o que tem dentro.',
          'Repare no **kind**: uma chamada entre serviços vira **dois** spans — um de cada lado da rede.',
        ],
        board: {
          title: 'Anatomia de um span',
          md: `| Campo | Exemplo | Para quê |
|---|---|---|
| \`trace_id\` | \`4bf92f35…0e4736\` (16 bytes) | igual em **todos** os spans do trace |
| \`span_id\` | \`00f067aa0ba902b7\` (8 bytes) | identifica este span |
| \`parent_span_id\` | id do pai (vazio na **raiz**) | monta a árvore |
| \`name\` | \`POST /checkout\`, \`SELECT itens\` | a operação — com **baixa cardinalidade** |
| \`start\` / \`end\` | timestamps | duração e posição na cascata |
| \`kind\` | \`SERVER\`, \`CLIENT\`, \`PRODUCER\`, \`CONSUMER\`, \`INTERNAL\` | papel do span na comunicação |
| \`attributes\` | \`http.response.status_code=200\`, \`pedido.itens=3\` | contexto para filtrar e agrupar |
| \`events\` | \`retry 1\`, exceção com stack trace | marcos com horário **dentro** do span |
| \`status\` | \`UNSET\`, \`OK\`, \`ERROR\` | falhou ou não |

\`\`\`python
from opentelemetry import trace

tracer = trace.get_tracer("checkout")

def finalizar_compra(pedido):
    with tracer.start_as_current_span("finalizar_compra") as span:
        span.set_attribute("pedido.itens", len(pedido.itens))
        reservar_estoque(pedido)       # spans abertos aqui dentro viram FILHOS deste
        cobrar(pedido)
        span.add_event("pagamento aprovado")
\`\`\`

Quando o checkout chama o estoque, nascem **dois** spans: um \`CLIENT\` no checkout e um \`SERVER\` no estoque, filho do primeiro. A diferença de duração entre eles é **rede + fila** — tempo que nenhum dos dois serviços vê sozinho.

> [!atencao] O **nome** do span entra em índices e agrupamentos: use \`GET /usuarios/{id}\`, nunca \`GET /usuarios/4812\`. O id vai num **atributo**. Nome com alta cardinalidade explode o custo do backend e impede comparar "todas as chamadas desta rota".`,
        },
      },
      {
        type: 'say',
        text: [
          'Um span sozinho não sabe que faz parte de um trace. Alguém precisa **carregar o contexto** até ele.',
          'Dentro do processo, isso é trabalho do `contextvars`. Entre processos, de um **cabeçalho**.',
        ],
        board: {
          title: 'Propagação de contexto',
          md: `**Dentro do processo**, o SDK guarda o "span atual" numa \`contextvars.ContextVar\`: todo span aberto enquanto outro está ativo vira filho dele. Tasks do \`asyncio\` copiam o contexto ao serem criadas, então o trace sobrevive ao \`await\`.

**Entre processos**, o contexto viaja serializado: o cliente faz **inject** nos cabeçalhos e o servidor faz **extract**.

\`\`\`python
from opentelemetry.propagate import inject, extract
from opentelemetry.trace import SpanKind

# cliente: grava o contexto atual nos cabeçalhos da chamada
def consultar_estoque(sku):
    with tracer.start_as_current_span("GET /itens/{sku}", kind=SpanKind.CLIENT):
        headers = {}
        inject(headers)            # {"traceparent": "00-<trace_id>-<id deste span>-01"}
        return http.get(f"http://estoque/itens/{sku}", headers=headers)

# servidor: lê o contexto e continua o MESMO trace
def handler(request):
    ctx = extract(request.headers)
    with tracer.start_as_current_span("GET /itens/{sku}", context=ctx, kind=SpanKind.SERVER):
        ...
\`\`\`

\`\`\`text
 checkout (processo A)                          estoque (processo B)
 ┌──────────────────────────┐   traceparent    ┌──────────────────────────┐
 │ span CLIENT   id=b7…     │ ───────────────► │ span SERVER  parent=b7…  │
 │ trace=4bf9…              │  cabeçalho HTTP  │ trace=4bf9…  id=e4…      │
 └──────────────────────────┘                  └──────────────────────────┘
\`\`\`

O mesmo vale para metadados do gRPC, cabeçalhos de mensagens no Kafka e atributos de mensagens no SQS.

> [!atencao] A propagação quebra **em silêncio**: um proxy que descarta cabeçalhos, um cliente HTTP sem instrumentação, um \`ThreadPoolExecutor\` (que **não** copia o \`contextvars\` — o \`asyncio.to_thread\` copia), um job enfileirado sem o contexto na mensagem. O sintoma: traces partidos ao meio e spans **órfãos**, cujo pai nunca chega ao backend.

> [!dica] Um consumidor que processa um **lote** de 100 mensagens de 100 traces diferentes não tem um pai único. Para isso existem os **span links**: o span do lote aponta para os 100 contextos de origem sem fingir que é filho de algum.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o cabeçalho que faz tudo isso funcionar entre linguagens e fornecedores: o `traceparent`.',
          'São 55 caracteres que quase ninguém sabe ler. Você vai sair daqui sabendo.',
        ],
        board: {
          title: 'W3C Trace Context: o cabeçalho traceparent',
          md: `\`\`\`http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
\`\`\`

\`\`\`text
00 - 4bf92f3577b34da6a3ce929d0e0e4736 - 00f067aa0ba902b7 - 01
│    │                                  │                  └─ trace-flags: 8 bits; bit 0 (01) = sampled
│    │                                  └─ parent-id: span_id de QUEM CHAMOU (8 bytes = 16 hex)
│    └─ trace-id: 16 bytes = 32 hex, o mesmo do começo ao fim
└─ version: 2 hex; hoje "00"
\`\`\`

| Regra | Por quê |
|---|---|
| só hex **minúsculo**, tamanhos exatos 2-32-16-2 | parse trivial e sem ambiguidade |
| trace-id ou parent-id **só de zeros** é inválido | zero significa "não inicializado" |
| versão \`ff\` é proibida | reservada como inválida |
| versão \`00\` tem **exatamente** 4 campos (55 caracteres) | versões futuras podem **acrescentar** campos: leia os 4 primeiros e ignore o resto |
| cabeçalho inválido → **ignore** e comece um trace novo | tracing nunca pode derrubar uma requisição |

**Ao chamar o próximo serviço:** mantenha o **trace-id** e as **flags**; troque o parent-id pelo id do **seu** span. Quem decidiu amostrar (ou não) foi a raiz — você segue a decisão.

- \`tracestate\`: pares chave=valor **de cada fornecedor**, que viajam junto sem ninguém precisar entendê-los.
- \`baggage\` (outra especificação W3C): pares **da aplicação**, como \`baggage: tenant=acme,plano=pro\`, legíveis em todo serviço a jusante.

> [!sabia] Antes do W3C Trace Context, cada ferramenta tinha o seu cabeçalho: Zipkin usava \`X-B3-TraceId\`/\`X-B3-SpanId\`/\`X-B3-Sampled\` — **B3** vem de *BigBrotherBird*, o nome original do Zipkin no Twitter —, Jaeger usava \`uber-trace-id\`, a AWS \`X-Amzn-Trace-Id\`. Uma requisição que passava por um proxy de outro fornecedor perdia o trace. A revisão *Level 2* do padrão ainda define o bit \`02\` (*random*): avisa que o trace-id é aleatório, o que permite a todos os serviços amostrar de forma consistente só olhando o ID.

> [!atencao] \`baggage\` é propagado para **todo** serviço a jusante — inclusive APIs de terceiros que você chama. Nada de e-mail, CPF ou token ali.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Guardar todos os traces de um sistema com 50 mil requisições por segundo sai caro. Então a gente **amostra**.',
          'A pergunta é **quando** decidir: no começo, sem saber nada, ou no fim, sabendo tudo?',
        ],
        board: {
          title: 'Amostragem head × tail',
          md: `| | **Head-based** | **Tail-based** |
|---|---|---|
| Quando decide | na **raiz**, antes de saber como a requisição vai terminar | depois que o trace termina (o Collector espera alguns segundos) |
| Como se espalha | flag \`sampled\` no \`traceparent\`: todos seguem a raiz | todos os spans são exportados; o Collector descarta depois |
| Custo | baixíssimo: span não amostrado quase não custa nada | alto: buffer em memória e todo o tráfego de spans |
| Pega o erro raro? | só por sorte (com taxa de 1%, vê 1% dos erros) | sim: "100% dos erros e dos lentos, 1% do resto" |
| Armadilha | decide às cegas | todos os spans de um trace precisam chegar à **mesma** instância do Collector |

\`\`\`python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import ParentBased, TraceIdRatioBased

# raiz: amostra 1% (decisão derivada do trace_id); todos os outros: seguem o pai
provider = TracerProvider(sampler=ParentBased(TraceIdRatioBased(0.01)))
\`\`\`

Tail sampling no **OpenTelemetry Collector**:

\`\`\`text
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - { name: erros,  type: status_code,   status_code: { status_codes: [ERROR] } }
      - { name: lentos, type: latency,       latency: { threshold_ms: 2000 } }
      - { name: resto,  type: probabilistic, probabilistic: { sampling_percentage: 1 } }
\`\`\`

Para o tail sampling funcionar com várias instâncias, uma camada na frente distribui os spans **por trace_id** (o exporter \`loadbalancing\`), garantindo que o trace inteiro chegue ao mesmo lugar.

> [!atencao] Nunca deixe cada serviço "jogar sua própria moeda": com 1% em cada um de dois serviços, só 0,01% dos traces sai completo. Por isso o \`TraceIdRatioBased\` decide a partir do **trace_id** — todos que olham o mesmo ID chegam à mesma resposta — e o \`ParentBased\` respeita a flag que veio no cabeçalho.

> [!dica] Amostrar traces **não** estraga suas métricas: contagens, taxas de erro e percentis vêm das **métricas**, que não são amostradas. Os traces são os **exemplos** que explicam os números.`,
        },
      },
      {
        type: 'say',
        text: [
          'Quem gera tudo isso hoje, em praticamente qualquer linguagem, é o **OpenTelemetry**.',
          'Instrumente uma vez; troque de fornecedor sem reescrever nada.',
        ],
        board: {
          title: 'OpenTelemetry',
          md: `\`\`\`text
 app: API + SDK  ──OTLP──►  Collector  ──────────────►  Jaeger · Tempo · Datadog · Honeycomb …
 (spans, métricas,           receivers → processors → exporters
  logs)                      (batch, tail sampling, remoção de PII, enriquecimento)
\`\`\`

| Peça | O que faz |
|---|---|
| **API** | o que o código chama (\`start_as_current_span\`); sem SDK configurado, vira no-op barato |
| **SDK** | amostragem, processamento em lote, exporters |
| **Instrumentação automática** | \`opentelemetry-instrument python app.py\` cria spans de Flask, FastAPI, requests, SQLAlchemy… sem mudar o código |
| **OTLP** | protocolo padrão de exportação (gRPC ou HTTP) |
| **Collector** | processo separado que recebe, filtra, amostra e reenvia |
| **Convenções semânticas** | nomes padronizados: \`http.request.method\`, \`http.response.status_code\`, \`db.system\` |

O projeto nasceu em 2019 da fusão de dois rivais, **OpenTracing** e **OpenCensus**, e é um dos mais ativos da CNCF.

> [!sabia] **Exemplars** ligam métricas a traces: um histograma de latência guarda, junto com a contagem de cada bucket, o \`trace_id\` de uma requisição **de exemplo** que caiu ali. No gráfico, você clica no pico do p99 e abre exatamente um trace lento daquele minuto. Prometheus e OpenTelemetry suportam — e pouca gente liga.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Com o trace na mão, a pergunta de ouro: **o que eu preciso acelerar** para o usuário esperar menos?',
          'Não é o span mais longo nem o com mais filhos. É o **caminho crítico**.',
        ],
        board: {
          title: 'Lendo um trace: o caminho crítico',
          md: `O **caminho crítico** é a cadeia de spans que determinou quando a requisição terminou. Na cascata do checkout:

\`\`\`text
POST /checkout (termina em 480)
 └─ pagamento          ← dos filhos da raiz, o que termina por último (470)
     └─ gateway do cartão   ← termina em 460; o antifraude, em paralelo, terminou em 300
         └─ POST /adquirente  ← folha: 320 ms esperando o adquirente
\`\`\`

- Deixar o **antifraude** 2× mais rápido: o checkout continua com 480 ms — ele roda **em paralelo** com o gateway, que é mais lento.
- Cortar 100 ms do **adquirente** (timeout menor, outra região, cache de tokenização): o checkout cai para ~380 ms.

Algoritmo simplificado (a "espinha" do trace): comece na raiz e desça sempre para o filho que **termina por último**.

> [!dica] A versão completa, usada por ferramentas como o CRISP da Uber, anda **para trás no tempo**: a partir do fim do pai, pega o filho que terminou por último, depois o que terminou por último **antes do início** dele, e assim por diante. Assim, filhos em **série** (carrinho → pagamento) também entram no caminho.

**Tempo próprio** (*self time*) = duração do span − tempo coberto pelos filhos. Um span de 300 ms com filhos cobrindo 100 ms passou 200 ms "sozinho": CPU, espera por lock… ou uma chamada **sem instrumentação**.

> [!atencao] Spans de máquinas diferentes usam relógios diferentes. Com **clock skew**, um filho pode parecer começar antes do pai. Durações medidas num mesmo host são confiáveis; a posição relativa entre hosts é aproximada (alguns backends até corrigem isso sozinhos).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Propagação, traceparent, amostragem e caminho crítico.', icon: '🧵' },
      {
        type: 'mcq',
        id: 'obs-trc-q1',
        concept: 'Propagação de contexto',
        say: 'Primeira: você é o serviço do meio da cadeia.',
        prompt: 'Seu serviço recebe `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`, cria o span SERVER `a1a1a1a1a1a1a1a1` e, dentro dele, o span CLIENT `b2b2b2b2b2b2b2b2` para chamar o estoque. Que `traceparent` vai na chamada ao estoque?',
        options: [
          { text: '`00-4bf92f3577b34da6a3ce929d0e0e4736-b2b2b2b2b2b2b2b2-01`', correct: true, why: 'Mesmo trace-id, flags preservadas e parent-id = o span **CLIENT** que está fazendo a chamada. O span SERVER do estoque vira filho dele.' },
          { text: '`00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01` (repassar o recebido)', why: 'Repassar sem trocar o parent-id faz o span do estoque parecer filho de quem chamou **você**: seu serviço some da árvore, e o tempo gasto nele fica invisível.' },
          { text: '`00-<trace-id novo>-b2b2b2b2b2b2b2b2-01`', why: 'Trace-id novo parte o trace em dois: no backend aparecem dois traces sem ligação, e ninguém vê a requisição de ponta a ponta.' },
          { text: '`00-4bf92f3577b34da6a3ce929d0e0e4736-a1a1a1a1a1a1a1a1-01`', why: 'Quase: funciona, mas pula o span CLIENT. A diferença entre o CLIENT (visto por você) e o SERVER (visto pelo estoque) é justamente rede + fila — ligar o estoque ao SERVER esconde esse tempo.' },
        ],
        explanation: 'A regra do *hop*: o **trace-id** nunca muda dentro de um trace; o **parent-id** é sempre o span de quem está fazendo a chamada **naquele momento** (o span CLIENT); as **flags** seguem a decisão de amostragem da raiz. Na prática, o `inject()` do OpenTelemetry faz isso sozinho, usando o span atual — é por isso que a chamada precisa acontecer **dentro** do `with` do span CLIENT.',
      },
      {
        type: 'order',
        id: 'obs-trc-q2',
        concept: 'Ciclo de vida de um trace',
        say: 'Agora coloque em ordem a vida de um trace, do primeiro byte ao gráfico em cascata.',
        prompt: 'Ordene o que acontece com o trace de uma requisição que entra pelo gateway e chama o serviço de pedidos.',
        items: [
          'O gateway recebe a requisição sem `traceparent` e gera um trace-id novo para o span raiz',
          'O sampler da raiz decide amostrar e liga o bit `sampled` das flags',
          'Antes de chamar pedidos, o gateway abre um span CLIENT e injeta o `traceparent` com o id dele',
          'O serviço de pedidos extrai o contexto do cabeçalho e abre um span SERVER filho',
          'Os spans terminam e o SDK os exporta em lote via OTLP para o Collector',
          'O backend agrupa os spans pelo trace-id e monta a árvore pelo parent-id',
        ],
        explanation: 'Repare que a **decisão de amostragem** acontece no início (head sampling) e viaja nas flags — por isso todos os serviços concordam. E a montagem da árvore acontece **só no backend**: cada serviço exporta seus spans de forma independente e em qualquer ordem, e é o par trace-id + parent-id que permite reconstruir tudo depois.',
      },
      {
        type: 'code',
        id: 'obs-trc-q3',
        concept: 'W3C traceparent',
        title: 'Parse e propagação do traceparent',
        say: 'Hora de escrever o parser que todo SDK tem por dentro. Os IDs são injetados: nada de aleatoriedade nos testes.',
        prompt: `Implemente as duas pontas da propagação do cabeçalho W3C \`traceparent\`.

1. \`parse_traceparent(header)\` → um dict \`{"version", "trace_id", "parent_id", "flags", "sampled"}\` ou \`None\` se o cabeçalho for inválido. \`flags\` é o **int** do campo de flags; \`sampled\` é \`True\` se o bit 0 estiver ligado. Regras:
   - campos separados por \`-\`: version (2), trace-id (32), parent-id (16) e flags (2) caracteres, **só hex minúsculo** (\`0-9a-f\`);
   - trace-id só de zeros ou parent-id só de zeros → inválido; version \`ff\` → inválido;
   - version \`00\` deve ter **exatamente** 4 campos; versões futuras podem ter campos extras depois das flags (aceite e ignore);
   - \`None\` ou string vazia → \`None\`.
2. \`proximo_traceparent(recebido, gerar_id, amostrar)\` → o \`traceparent\` (versão \`00\`) a enviar na chamada seguinte:
   - se \`recebido\` for válido: mesmo trace-id, **mesmas flags**, parent-id novo \`gerar_id(16)\` (o id do seu span); \`amostrar\` é ignorado — quem decide é a raiz;
   - senão: trace novo com \`gerar_id(32)\` e \`gerar_id(16)\`, flags \`01\` se \`amostrar\` for verdadeiro, senão \`00\`.

\`gerar_id(n)\` é injetado e devolve \`n\` caracteres hexadecimais. Formate as flags com dois dígitos hex (\`f"{flags:02x}"\`).`,
        starter: `def parse_traceparent(header):
    """Dict com version, trace_id, parent_id, flags e sampled — ou None se inválido."""
    pass


def proximo_traceparent(recebido, gerar_id, amostrar):
    """traceparent da próxima chamada: continua o trace recebido ou começa um novo."""
    pass
`,
        tests: [
          {
            name: 'exemplo da especificação',
            setup: IDS,
            expr: 'parse_traceparent(EXEMPLO)',
            expected: '{"version": "00", "trace_id": TID, "parent_id": PID, "flags": 1, "sampled": True}',
          },
          {
            name: 'flags é um campo de bits: 00 e 03',
            setup: IDS,
            code: `r = parse_traceparent("00-" + TID + "-" + PID + "-00")
assert r is not None and r["sampled"] is False and r["flags"] == 0, f"flags 00 = não amostrado; veio {r}"
r = parse_traceparent("00-" + TID + "-" + PID + "-03")
assert r is not None and r["sampled"] is True and r["flags"] == 3, f"flags 03 = bit 0 (sampled) + bit 1 (random); veio {r}"`,
          },
          {
            name: 'maiúsculas e caracteres fora de 0-9a-f são inválidos',
            setup: IDS,
            code: `assert parse_traceparent("00-" + TID.upper() + "-" + PID + "-01") is None, "trace-id em maiúsculas deve ser rejeitado"
assert parse_traceparent("00-" + TID + "-" + PID[:-1] + "g-01") is None, "'g' não é hexadecimal"`,
          },
          {
            name: 'IDs só de zeros e versão ff são inválidos',
            setup: IDS,
            code: `assert parse_traceparent("00-" + "0" * 32 + "-" + PID + "-01") is None, "trace-id só de zeros é inválido"
assert parse_traceparent("00-" + TID + "-" + "0" * 16 + "-01") is None, "parent-id só de zeros é inválido"
assert parse_traceparent("ff-" + TID + "-" + PID + "-01") is None, "a versão ff é proibida"`,
          },
          {
            name: 'tamanhos e número de campos',
            setup: IDS,
            code: `assert parse_traceparent("00-" + TID[:-1] + "-" + PID + "-01") is None, "trace-id com 31 caracteres"
assert parse_traceparent("00-" + TID + "-" + PID + "-1") is None, "flags com 1 caractere"
assert parse_traceparent("00-" + TID + "-" + PID) is None, "faltou o campo de flags"
assert parse_traceparent("00-" + TID + "-" + PID + "-01-extra") is None, "a versão 00 tem exatamente 4 campos"
assert parse_traceparent("") is None and parse_traceparent(None) is None, "vazio ou None → None"`,
          },
          {
            name: 'continua o trace recebido com um parent-id novo',
            setup: IDS,
            expr: 'proximo_traceparent(EXEMPLO, GERAR_ID, False)',
            expected: '"00-" + TID + "-" + "cd" * 8 + "-01"',
          },
          {
            name: 'não amostrado continua não amostrado',
            setup: IDS,
            expr: 'proximo_traceparent("00-" + TID + "-" + PID + "-00", GERAR_ID, True)',
            expected: '"00-" + TID + "-" + "cd" * 8 + "-00"',
          },
          {
            name: 'sem cabeçalho: trace novo segundo a decisão da raiz',
            setup: IDS,
            code: `novo = proximo_traceparent(None, GERAR_ID, True)
assert novo == "00-" + "ab" * 16 + "-" + "cd" * 8 + "-01", f"trace novo amostrado; veio {novo}"
novo = proximo_traceparent(None, GERAR_ID, False)
assert novo == "00-" + "ab" * 16 + "-" + "cd" * 8 + "-00", f"trace novo não amostrado; veio {novo}"`,
          },
          {
            name: 'int(x, 16) aceita coisas que o padrão não aceita',
            hidden: true,
            setup: IDS,
            code: `assert parse_traceparent("00-" + TID + "-0x" + PID[2:] + "-01") is None, "'0x...' passa em int(x, 16), mas não é hex válido aqui"
assert parse_traceparent("00-+" + TID[1:] + "-" + PID + "-01") is None, "'+...' passa em int(x, 16), mas não é hex válido aqui"
assert parse_traceparent("00-" + TID + "-" + PID + "- 1") is None, "espaço passa em int(x, 16), mas não é hex válido aqui"`,
          },
          {
            name: 'versão futura: lê os 4 primeiros campos e ignora o resto',
            hidden: true,
            setup: IDS,
            code: `r = parse_traceparent("cc-" + TID + "-" + PID + "-01-what-the-future-will-be-like")
assert r == {"version": "cc", "trace_id": TID, "parent_id": PID, "flags": 1, "sampled": True}, f"veio {r}"
assert parse_traceparent("cc-" + TID + "-" + PID) is None, "mesmo em versão futura, os 4 campos são obrigatórios"
assert proximo_traceparent("cc-" + TID + "-" + PID + "-01-extra", GERAR_ID, False) == "00-" + TID + "-" + "cd" * 8 + "-01"`,
          },
          {
            name: 'cabeçalho inválido reinicia o trace; flags preservadas bit a bit',
            hidden: true,
            setup: IDS,
            code: `assert proximo_traceparent("00-" + TID.upper() + "-" + PID + "-01", GERAR_ID, False) == "00-" + "ab" * 16 + "-" + "cd" * 8 + "-00"
assert proximo_traceparent("00-" + TID + "-" + PID + "-03", GERAR_ID, False) == "00-" + TID + "-" + "cd" * 8 + "-03"`,
          },
        ],
        reviews: [
          {
            when: m => ['random', 'secrets', 'uuid', 'os'].some(x => m.imports.includes(x)),
            text: 'Os IDs vêm de `gerar_id`, injetado. Em produção ele seria algo como `lambda n: secrets.token_hex(n // 2)` — mas, recebendo a função por parâmetro, o código fica **determinístico** nos testes e você pode trocar o gerador (ex.: IDs compatíveis com a flag *random*) sem mexer na lógica.',
            concept: 'Injeção de dependências',
          },
          {
            when: (m, code) => /\.lower\(\)/.test(code),
            text: 'Não normalize com `.lower()`: o padrão exige hex **minúsculo** justamente para o parse ser estrito e sem ambiguidade. Aceitar maiúsculas esconde um emissor com bug — e dois serviços podem acabar tratando o "mesmo" trace-id como IDs diferentes.',
            concept: 'Validação estrita',
          },
          {
            when: m => m.maxComplexity > 12,
            text: 'O parser acumulou muitos `if`s. Tente uma tabela de tamanhos `(2, 32, 16, 2)` e uma única verificação por campo — `len(campo) == tamanho and set(campo) <= HEX` — seguida das regras especiais (zeros, `ff`, campos extras).',
            concept: 'Validação dirigida por dados',
          },
        ],
        hints: [
          'Comece com `partes = (header or "").split("-")`. Se houver menos de 4 partes, é inválido. Os 4 primeiros campos são version, trace-id, parent-id e flags.',
          'Para validar o alfabeto, **não** use `int(campo, 16)` — ele aceita `0x`, `+`, `_` e espaços. Compare com um conjunto: `set(campo) <= set("0123456789abcdef")`, junto com o tamanho exato.',
          'Regras especiais: `version == "ff"` → inválido; `version == "00"` com mais de 4 partes → inválido; `trace_id == "0" * 32` ou `parent_id == "0" * 16` → inválido. Depois: `flags = int(campo, 16)` e `sampled = bool(flags & 1)`.',
          'Em `proximo_traceparent`: `ctx = parse_traceparent(recebido)`. Se `ctx` existe, use `ctx["trace_id"]` e `ctx["flags"]`; senão, `gerar_id(32)` e `1 if amostrar else 0`. Monte com `f"00-{trace_id}-{gerar_id(16)}-{flags:02x}"`.',
        ],
        solution: `HEX = frozenset("0123456789abcdef")
TAMANHOS = (2, 32, 16, 2)   # version, trace-id, parent-id, flags


def _campos_validos(campos):
    return all(len(c) == t and set(c) <= HEX for c, t in zip(campos, TAMANHOS))


def parse_traceparent(header):
    """Dict com version, trace_id, parent_id, flags e sampled — ou None se inválido."""
    partes = (header or "").split("-")
    campos = partes[:4]
    if len(campos) < 4 or not _campos_validos(campos):
        return None
    versao, trace_id, parent_id, flags = campos
    if versao == "ff" or (versao == "00" and len(partes) > 4):
        return None
    if trace_id == "0" * 32 or parent_id == "0" * 16:
        return None
    n = int(flags, 16)
    return {"version": versao, "trace_id": trace_id, "parent_id": parent_id,
            "flags": n, "sampled": bool(n & 1)}


def proximo_traceparent(recebido, gerar_id, amostrar):
    """traceparent da próxima chamada: continua o trace recebido ou começa um novo."""
    ctx = parse_traceparent(recebido)
    if ctx is None:
        trace_id, flags = gerar_id(32), (1 if amostrar else 0)
    else:
        trace_id, flags = ctx["trace_id"], ctx["flags"]
    return f"00-{trace_id}-{gerar_id(16)}-{flags:02x}"
`,
        solutionExplanation: 'O coração é uma **validação estrita e dirigida por dados**: uma tabela de tamanhos e um conjunto de caracteres permitidos, em vez de `int(x, 16)` — que aceitaria `0x1f`, `+1f`, `1_f` e espaços e deixaria passar cabeçalhos que outro SDK rejeitaria (e dois serviços discordando sobre o mesmo cabeçalho é a receita de um trace partido). A regra das versões futuras é um belo exemplo de **compatibilidade para frente**: quem só entende a versão `00` ainda consegue ler os 4 primeiros campos de uma versão nova. Em `proximo_traceparent` está a regra do *hop*: trace-id e flags continuam, só o parent-id muda — e a decisão de amostragem é da **raiz** (*parent-based*), por isso `amostrar` só vale para traces novos. Por fim, cabeçalho inválido nunca vira exceção: vira um trace novo, porque tracing jamais pode derrubar a requisição que ele observa.',
      },
      {
        type: 'match',
        id: 'obs-trc-q4',
        concept: 'Span kind',
        say: 'Jogo rápido: cada situação gera um span de qual tipo?',
        prompt: 'Associe cada `SpanKind` do OpenTelemetry à situação em que ele é usado.',
        pairs: [
          { left: 'SERVER', right: 'Handler HTTP atendendo `POST /pedidos` que chegou de outro serviço' },
          { left: 'CLIENT', right: 'Chamada síncrona que sai para outro serviço ou para o banco' },
          { left: 'PRODUCER', right: 'Publicação de uma mensagem numa fila para ser processada depois' },
          { left: 'CONSUMER', right: 'Processamento de uma mensagem retirada de um tópico' },
          { left: 'INTERNAL', right: 'Cálculo do frete dentro do próprio processo, sem rede' },
        ],
        explanation: 'O *kind* diz ao backend como **ligar** os spans e interpretar o tempo: um par CLIENT → SERVER é uma chamada síncrona (a diferença entre os dois é rede + fila); PRODUCER → CONSUMER é assíncrono, e o intervalo entre eles é o tempo que a mensagem ficou **parada na fila** — muitas vezes o maior vilão da latência em sistemas orientados a eventos. INTERNAL é o padrão para tudo que não cruza a fronteira do processo.',
      },
      {
        type: 'mcq',
        id: 'obs-trc-q5',
        concept: 'Amostragem head × tail',
        say: 'Agora uma decisão de arquitetura — e de orçamento.',
        prompt: 'Seu sistema recebe 40 mil req/s e só dá para armazenar ~1% dos traces. O time quer **todos** os traces com erro e **todos** os acima de 2 s — que somam menos de 0,5% do tráfego. Qual estratégia atende?',
        options: [
          { text: 'Tail sampling no OpenTelemetry Collector (erros + latência > 2 s + 1% probabilístico do resto), com um *load balancer* de spans por trace_id na frente', correct: true, why: 'Só decidindo **depois** que o trace termina dá para saber se ele teve erro ou foi lento. O balanceamento por trace_id garante que todos os spans de um trace cheguem à mesma instância que decide.' },
          { text: 'Head sampling de 1% na raiz com `ParentBased(TraceIdRatioBased(0.01))`', why: 'É barato e mantém os traces completos, mas decide **antes** de saber o resultado: você guardaria só 1% dos erros e 1% dos lentos — exatamente os que o time mais quer ver.' },
          { text: 'Cada serviço decide ao terminar o próprio span: exporta se ele deu erro ou demorou, senão sorteia 1%', why: 'Gera traces **partidos**: você guarda o span do serviço que falhou, mas não os pais e irmãos que foram descartados em outros serviços — sem contexto, o trace perde quase todo o valor.' },
          { text: 'Amostrar 100% no SDK e filtrar no banco do backend depois de gravar', why: 'Funciona na teoria, mas paga o custo de transmitir e **gravar** 100x mais dados só para apagá-los — exatamente o que o limite de ~1% queria evitar.' },
        ],
        explanation: 'Head sampling responde "quanto guardar" de forma barata; tail sampling responde "**quais** guardar" de forma inteligente, ao custo de buffer (o Collector segura os spans por alguns segundos) e de uma topologia em duas camadas (balanceamento por trace_id → instâncias com o processador `tail_sampling`). Muitas empresas combinam os dois: um head sampling generoso (ex.: 20%) para aliviar o volume, e tail sampling em cima para escolher os interessantes. Lembre de registrar a **taxa de amostragem** usada: quem calcula volumes a partir dos traces precisa multiplicar de volta.',
      },
      {
        type: 'code',
        id: 'obs-trc-q6',
        concept: 'Caminho crítico',
        title: 'Árvore de spans e caminho crítico',
        say: 'Por último: o que o backend de tracing faz quando você abre um trace. Os tempos vêm nos spans — nada de relógio de verdade.',
        prompt: `Cada span é um dict \`{"id", "parent", "name", "start", "end"}\` (tempos em ms; \`parent\` é \`None\` na raiz). Os spans chegam **em qualquer ordem**, como no backend.

1. \`montar_arvore(spans)\` → \`(raiz, filhos)\`: \`raiz\` é o id do span sem pai (\`None\` se a lista for vazia) e \`filhos\` é um dict **id → lista de ids dos filhos**, ordenada por \`start\` (empate: por id). **Todo** span aparece como chave, inclusive folhas (lista vazia).
2. \`orfaos(spans)\` → lista **ordenada** dos ids dos spans cujo \`parent\` não é \`None\` mas não está entre os spans recebidos — o sintoma de propagação quebrada ou de spans perdidos.
3. \`caminho_critico(spans)\` → lista dos **nomes** da raiz até uma folha, descendo sempre para o filho que **termina por último** (maior \`end\`; empate: o que começou antes). Lista vazia → \`[]\`. Spans órfãos não entram no caminho.`,
        starter: `def montar_arvore(spans):
    """(id da raiz, {id: [ids dos filhos ordenados por start]})."""
    pass


def orfaos(spans):
    """Ids (ordenados) dos spans cujo pai não chegou."""
    pass


def caminho_critico(spans):
    """Nomes da raiz até a folha, seguindo o filho que termina por último."""
    pass
`,
        tests: [
          { name: 'a raiz é o span sem pai', setup: TRACE, expr: 'montar_arvore(CHECKOUT)[0]', expected: '"a"' },
          { name: 'filhos da raiz ordenados por start', setup: TRACE, expr: 'montar_arvore(CHECKOUT)[1]["a"]', expected: '["b", "c", "i", "e"]' },
          {
            name: 'todo span é chave; folhas têm lista vazia',
            setup: TRACE,
            code: `raiz, filhos = montar_arvore(CHECKOUT)
assert sorted(filhos) == list("abcdefghi"), f"chaves esperadas a..i; vieram {sorted(filhos)}"
assert filhos["e"] == ["f", "g"] and filhos["g"] == ["h"], f"filhos de e/g errados: {filhos['e']}, {filhos['g']}"
assert filhos["h"] == [] and filhos["b"] == [], "folhas devem ter lista vazia"`,
          },
          { name: 'caminho crítico do checkout', setup: TRACE, expr: 'caminho_critico(CHECKOUT)', expected: '["POST /checkout", "pagamento", "gateway do cartão", "POST /adquirente"]' },
          {
            name: 'o filho mais longo nem sempre é o crítico',
            setup: TRACE,
            expr: 'caminho_critico([_s("r", None, "req", 0, 300), _s("x", "r", "longo", 10, 200), _s("y", "r", "tardio", 150, 290)])',
            expected: '["req", "tardio"]',
          },
          { name: 'sem spans → caminho vazio', expr: 'caminho_critico([])', expected: '[]' },
          {
            name: 'órfãos: pai que nunca chegou',
            setup: TRACE,
            code: `assert orfaos(CHECKOUT) == [], "no checkout todos os pais estão presentes"
spans = CHECKOUT + [_s("z", "sumiu", "worker", 200, 260), _s("y", "sumiu2", "cron", 10, 20)]
assert orfaos(spans) == ["y", "z"], f"esperado ['y', 'z']; veio {orfaos(spans)}"`,
          },
          {
            name: 'empate no end: vence o que começou antes',
            hidden: true,
            setup: TRACE,
            expr: 'caminho_critico([_s("r", None, "req", 0, 100), _s("q", "r", "curto", 60, 90), _s("p", "r", "comprido", 20, 90)])',
            expected: '["req", "comprido"]',
          },
          {
            name: 'órfãos não atrapalham a árvore nem o caminho',
            hidden: true,
            setup: TRACE,
            code: `spans = CHECKOUT + [_s("z", "sumiu", "worker atrasado", 0, 999)]
assert caminho_critico(spans) == ["POST /checkout", "pagamento", "gateway do cartão", "POST /adquirente"]
raiz, filhos = montar_arvore(spans)
assert raiz == "a" and filhos["z"] == [] and "z" not in filhos["a"]`,
          },
          {
            name: 'empate no start ordena por id; cadeia profunda',
            hidden: true,
            setup: TRACE,
            code: `spans = [_s("n0", None, "n0", 0, 100)] + [_s("n" + str(k), "n" + str(k - 1), "n" + str(k), k, 100 - k) for k in range(1, 30)]
assert caminho_critico(spans) == ["n" + str(k) for k in range(30)]
raiz, filhos = montar_arvore([_s("r", None, "r", 0, 10), _s("m2", "r", "b", 1, 5), _s("m1", "r", "a", 1, 6)])
assert filhos["r"] == ["m1", "m2"], f"empate no start: ordem por id; veio {filhos['r']}"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('montar_arvore'),
            text: '`caminho_critico` reconstrói a árvore por conta própria. Reaproveite `montar_arvore`: a regra de quem é filho de quem (e a ordenação) fica num lugar só, e um ajuste futuro — como tratar órfãos — vale para as duas.',
            concept: 'DRY',
          },
          {
            when: m => m.loopDepth >= 3,
            text: 'Há laços aninhados em três níveis. Se, para cada span, você percorre a lista inteira procurando filhos, montar a árvore vira **O(n²)** — e traces reais têm dezenas de milhares de spans. Indexe uma vez (`{id: span}` e `{pai: [filhos]}`) e consulte em O(1).',
            concept: 'Indexação com dicionários',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função acumulou decisões demais. Separe: `montar_arvore` só indexa, `orfaos` só compara conjuntos de ids e `caminho_critico` só desce pela árvore escolhendo o filho com maior `(end, -start)`.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Em `montar_arvore`, comece com `filhos = {s["id"]: [] for s in spans}` e, num laço, anexe cada span à lista do pai (se o pai existir). A raiz é o span com `parent is None`.',
          'Ordene cada lista de filhos com `key=lambda i: (por_id[i]["start"], i)`, onde `por_id = {s["id"]: s for s in spans}`. Em `orfaos`: `ids = {s["id"] for s in spans}` e filtre os que têm `parent` fora desse conjunto.',
          'Em `caminho_critico`: `atual = raiz`; enquanto `atual` não for `None`, guarde o nome e vá para `max(filhos[atual], key=lambda i: (por_id[i]["end"], -por_id[i]["start"]), default=None)`.',
        ],
        solution: `def montar_arvore(spans):
    """(id da raiz, {id: [ids dos filhos ordenados por start]})."""
    por_id = {s["id"]: s for s in spans}
    filhos = {s["id"]: [] for s in spans}
    raiz = None
    for s in spans:
        if s["parent"] is None:
            raiz = s["id"]
        elif s["parent"] in filhos:
            filhos[s["parent"]].append(s["id"])
    for lista in filhos.values():
        lista.sort(key=lambda i: (por_id[i]["start"], i))
    return raiz, filhos


def orfaos(spans):
    """Ids (ordenados) dos spans cujo pai não chegou."""
    ids = {s["id"] for s in spans}
    return sorted(s["id"] for s in spans if s["parent"] is not None and s["parent"] not in ids)


def caminho_critico(spans):
    """Nomes da raiz até a folha, seguindo o filho que termina por último."""
    por_id = {s["id"]: s for s in spans}
    raiz, filhos = montar_arvore(spans)
    caminho = []
    atual = raiz
    while atual is not None:
        caminho.append(por_id[atual]["name"])
        atual = max(filhos[atual], key=lambda i: (por_id[i]["end"], -por_id[i]["start"]), default=None)
    return caminho
`,
        solutionExplanation: 'É exatamente o que um backend de tracing faz ao abrir um trace: os spans chegam **soltos e fora de ordem** (cada serviço exporta os seus quando terminam), e dois dicionários — `id → span` e `pai → filhos` — reconstroem a árvore em **O(n log n)** (por causa das ordenações). `orfaos` é um diagnóstico valioso: pai ausente significa span perdido no caminho (exporter lotado, amostragem inconsistente entre serviços) ou **propagação quebrada** num salto. O caminho crítico simplificado desce pelo filho que termina por último: no checkout, ele ignora o antifraude (175 ms, mas em paralelo) e aponta o adquirente — o único lugar onde otimizar muda o que o usuário sente. A versão completa percorreria o tempo de trás para frente para incluir filhos em série, como o carrinho antes do pagamento; e, com relógios de hosts diferentes, valeria compensar o *clock skew* antes de comparar `end`s.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora um trace não é mais um desenho bonito: é uma árvore que você sabe montar, propagar e ler.',
          { text: 'Da próxima vez que o p99 subir, você vai direto ao caminho crítico — e sabe exatamente o que vai naquele `traceparent`.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
