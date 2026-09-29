(function () {
  // Prelúdio dos testes de percentil: 100 latências conhecidas (em segundos).
  const LATENCIAS = `def latencias():
    """50 × 0,05 s · 30 × 0,2 s · 15 × 0,4 s · 5 × 2,0 s — o p99 real é 2,0 s."""
    h = Histogram([0.1, 0.25, 0.5, 1, 2.5])
    for valor, vezes in [(0.05, 50), (0.2, 30), (0.4, 15), (2.0, 5)]:
        for _ in range(vezes):
            h.observar(valor)
    return h
`;

  Game.registerModule('observability', {
    id: 'metricas',
    title: 'Métricas',
    kind: 'lesson',
    level: 2,
    order: 2,
    unit: 'sinais',
    summary: 'O sinal mais barato da observabilidade: counters, gauges e histogramas, os métodos RED e USE, os quatro sinais de ouro — e a explosão de cardinalidade que derruba o Prometheus.',
    concepts: ['Counter × gauge × histogram × summary', 'Método RED', 'Método USE', 'Cardinalidade', 'Baldes de histograma'],
    takeaways: [
      '**Counter** só sobe (consulte a **taxa**, nunca o valor cru); **gauge** sobe e desce (valor instantâneo); **histogram** conta observações por **balde** e agrega entre réplicas; **summary** calcula quantis no cliente e **não** agrega.',
      '**RED** (Rate, Errors, Duration) para **serviços**; **USE** (Utilization, Saturation, Errors) para **recursos**; os **quatro sinais de ouro** (latência, tráfego, erros, saturação) juntam os dois olhares.',
      'Cada combinação de rótulos é uma **série temporal**: a cardinalidade é o **produto** dos valores possíveis. `user_id`, `request_id`, e-mail e URL crua não são rótulos — vão para logs e traces.',
      'Percentis vindos de histograma são **estimativas**: o erro é limitado pela largura do balde. Ponha um limite exatamente no limiar do SLO e cubra a cauda — acima do último balde, a estimativa trava no último limite.',
      '**Nunca faça média de percentis**: some os baldes de todas as réplicas e só então estime o quantil.',
    ],
    glossary: [
      { term: 'Série temporal', aliases: ['séries temporais', 'time series'], definition: 'Sequência de pares (instante, valor) identificada por **nome da métrica + conjunto de rótulos**. `http_requests_total{rota="/pedidos",status="500"}` é uma série; mudar qualquer rótulo cria outra.' },
      { term: 'Método RED', aliases: ['RED method'], definition: 'Checklist de métricas para **serviços** orientados a requisições: **R**ate (requisições por segundo), **E**rrors (falhas por segundo) e **D**uration (distribuição da latência). Proposto por Tom Wilkie.' },
      { term: 'Método USE', aliases: ['USE method'], definition: 'Checklist de Brendan Gregg para **recursos** (CPU, disco, pool de conexões, fila): **U**tilization (quanto está ocupado), **S**aturation (trabalho esperando na fila) e **E**rrors.' },
      { term: 'Quatro sinais de ouro', aliases: ['four golden signals', 'golden signals', 'sinais de ouro'], definition: 'Os quatro sinais que o livro de SRE do Google recomenda medir em todo sistema voltado ao usuário: **latência**, **tráfego**, **erros** e **saturação**.' },
      { term: 'Explosão de cardinalidade', aliases: ['cardinality explosion', 'alta cardinalidade de rótulos'], definition: 'Crescimento descontrolado do número de séries temporais quando um rótulo tem valores ilimitados (`user_id`, `request_id`, URL crua). Como o custo de memória e armazenamento é **por série**, o banco de métricas fica lento ou cai.' },
      { term: 'Balde de histograma', aliases: ['baldes de histograma', 'histogram bucket', 'histogram buckets'], definition: 'Faixa de valores de um histograma, definida pelo limite superior (`le`, *less or equal*). O histograma guarda só **quantas** observações caíram em cada balde, e os percentis são estimados por interpolação.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Logs contam a história de **uma** requisição. Métricas contam a história de **todas** — por uma fração do custo.',
          'São elas que viram gráfico, alerta e SLO. Vamos entender como funcionam por dentro.',
        ],
        board: {
          title: 'O que é uma métrica',
          md: `Uma métrica é um **número agregado ao longo do tempo**, identificado por um **nome** e por **rótulos** (*labels*). Cada combinação de rótulos é uma **série temporal**. No formato de exposição do Prometheus:

\`\`\`text
# HELP http_requests_total Requisições HTTP atendidas.
# TYPE http_requests_total counter
http_requests_total{metodo="GET",rota="/pedidos/{id}",status="200"} 10432
http_requests_total{metodo="POST",rota="/pedidos",status="201"} 2210
http_requests_total{metodo="POST",rota="/pedidos",status="500"} 17
\`\`\`

| | Logs | Métricas |
|---|---|---|
| Unidade | um evento | um número agregado por intervalo |
| Custo cresce com | o **tráfego** | o número de **séries** (não com o tráfego) |
| Responde | "o que aconteceu com **esta** requisição?" | "quantas? quão rápido? está piorando?" |
| Bom para | investigar | **alertar**, dashboards, SLOs, capacidade |

Coleta: no modelo **pull**, o Prometheus raspa (*scrape*) o endpoint \`/metrics\` de cada instância a cada 15–60 s; no modelo **push**, o processo envia (StatsD, OTLP do OpenTelemetry). O processo guarda só os contadores atuais — a história fica no banco de séries temporais.

> [!dica] **Convenções de nome** que poupam confusão: unidade no nome e em unidade **base** (\`_seconds\`, \`_bytes\`, nunca \`_ms\`), sufixo \`_total\` em counters, nomes no formato \`<domínio>_<o que>_<unidade>\` — ex.: \`http_request_duration_seconds\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Existem quatro tipos de métrica, e escolher o errado dá gráficos que mentem.',
          'Vale decorar a semântica de cada um.',
        ],
        board: {
          title: 'Counter, gauge, histogram e summary',
          md: `| Tipo | Semântica | Exemplos | Como consultar |
|---|---|---|---|
| **Counter** | só **sobe**; volta a zero no restart | requisições, erros, bytes enviados | a **taxa**: \`rate(x[5m])\` |
| **Gauge** | sobe e desce; valor **instantâneo** | conexões abertas, tamanho da fila, memória | o valor, \`max_over_time\` |
| **Histogram** | contagens por **balde** + \`_sum\` + \`_count\` | latência, tamanho de payload | \`histogram_quantile(0.99, ...)\` |
| **Summary** | quantis **calculados no cliente** | p50/p99 prontos | não agrega entre réplicas |

\`\`\`python
from prometheus_client import Counter, Gauge, Histogram

REQS = Counter("http_requests_total", "Requisições atendidas", ["metodo", "rota", "status"])
EM_CURSO = Gauge("http_requests_in_flight", "Requisições em andamento")
LATENCIA = Histogram("http_request_duration_seconds", "Latência", ["rota"],
                     buckets=(0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5))

def atender(req):
    EM_CURSO.inc()
    try:
        with LATENCIA.labels(rota=req.rota).time():
            resp = processar(req)
        REQS.labels(req.metodo, req.rota, resp.status).inc()
        return resp
    finally:
        EM_CURSO.dec()
\`\`\`

> [!atencao] O valor cru de um counter **não significa nada** (depende de quando o processo subiu). Consulte sempre a **taxa** (\`rate\`, \`increase\`), que também detecta o reset do restart. E não use gauge para contar eventos: entre duas raspagens, o que subiu e desceu **some** — um gauge amostrado a cada 15 s não vê um pico de 3 s.`,
        },
      },
      {
        type: 'say',
        text: [
          'O histograma é o tipo mais esperto — e o mais mal entendido.',
          'Ele não guarda as latências: guarda só **quantas** caíram em cada faixa. O percentil sai de uma interpolação.',
        ],
        board: {
          title: 'Baldes de histograma e percentis aproximados',
          md: `100 requisições: 50 × 0,05 s · 30 × 0,2 s · 15 × 0,4 s · 5 × 2,0 s. O Prometheus expõe os baldes **acumulados** (\`le\` = *less or equal*):

\`\`\`text
http_request_duration_seconds_bucket{le="0.1"}   50
http_request_duration_seconds_bucket{le="0.25"}  80
http_request_duration_seconds_bucket{le="0.5"}   95
http_request_duration_seconds_bucket{le="1"}     95
http_request_duration_seconds_bucket{le="2.5"}  100
http_request_duration_seconds_bucket{le="+Inf"} 100
http_request_duration_seconds_sum    24.5
http_request_duration_seconds_count  100
\`\`\`

**Estimando o p90** (como o \`histogram_quantile\`): o alvo é a 90ª observação. Ela está no balde (0,25; 0,5], que contém as observações 81 a 95. Supondo que elas se espalham **uniformemente** dentro do balde:

**p90 ≈ 0,25 + (0,5 − 0,25) × (90 − 80) ÷ 15 ≈ 0,417 s** (o real é 0,4 s)

**p99** ≈ 1 + (2,5 − 1) × (99 − 95) ÷ 5 = **2,2 s** (o real é 2,0 s). O erro é limitado pela **largura do balde**.

| Regra prática | Por quê |
|---|---|
| Um limite **exatamente** no limiar do SLO (ex.: 0,3 s) | "requisições abaixo de 300 ms" vira uma contagem **exata** |
| Baldes cobrindo a cauda | acima do último limite, a estimativa **trava** nele |
| Poucos baldes (10–15) | cada balde é **uma série a mais** para cada combinação de rótulos |

> [!atencao] **Summary** calcula o p99 dentro de cada processo, e **percentis não se somam**: a média dos p99 de 10 réplicas não é o p99 do serviço. Com histogramas você **soma os baldes** de todas as réplicas e só então estima o quantil.

> [!sabia] Os **native histograms** do Prometheus e os **exponential histograms** do OpenTelemetry acabam com a escolha manual de baldes: os limites crescem em progressão geométrica (cada um ~9% maior que o anterior, por exemplo), o que garante **erro relativo** constante em qualquer escala — de microssegundos a minutos. É a mesma ideia de estruturas como o *DDSketch* e o *HdrHistogram*.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Tudo bem, mas **quais** métricas coletar? Existem dois checklists famosos — e quase ninguém conhece os dois.',
          'Um olha para os **serviços**; o outro, para os **recursos**.',
        ],
        board: {
          title: 'RED, USE e os quatro sinais de ouro',
          md: `| Método | Para quê | Sinais | Origem |
|---|---|---|---|
| **RED** | **serviços** (quem recebe requisições) | **R**ate · **E**rrors · **D**uration | Tom Wilkie, ~2015 |
| **USE** | **recursos** (CPU, disco, pool, fila) | **U**tilization · **S**aturation · **E**rrors | Brendan Gregg, ~2012 |
| **Quatro sinais de ouro** | sistemas voltados ao usuário | latência · tráfego · erros · **saturação** | livro de SRE do Google, 2016 |

**USE na prática** — para cada recurso, pergunte as três coisas:

| Recurso | Utilização | Saturação | Erros |
|---|---|---|---|
| CPU | % de tempo ocupada | fila de execução (*run queue*) | — |
| Pool de conexões do banco | conexões em uso ÷ máximo | threads **esperando** uma conexão | timeouts ao obter conexão |
| Disco | % de tempo ocupado | fila de I/O | erros de I/O |
| Fila de mensagens | consumidores ocupados | **lag** / mensagens acumuladas | mensagens na DLQ |

> [!sabia] **Saturação** é o sinal que quase todo mundo esquece. Utilização de 100% não é um problema em si — um pool com 20 de 20 conexões em uso e **ninguém esperando** está perfeito. O problema começa quando o trabalho **enfileira**: é aí que a latência dispara. O Brendan Gregg criou o USE justamente para achar gargalos em minutos, percorrendo recurso por recurso, em vez de chutar hipóteses.

> [!dica] Na latência, **separe sucessos de falhas**: um \`500\` que falha em 2 ms puxa a latência "média" para baixo justamente quando tudo está quebrando. E prefira percentis e contagens abaixo de um limiar à média (assunto do módulo de latência).`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o jeito mais comum de derrubar um Prometheus: um rótulo inocente.',
          'O nome disso é **explosão de cardinalidade**, e ela costuma chegar num pull request de uma linha.',
        ],
        board: {
          title: 'Explosão de cardinalidade',
          md: `Cada combinação **distinta** de rótulos é uma série, com custo fixo de memória, índice e armazenamento. A cardinalidade é o **produto** das possibilidades:

\`\`\`text
http_requests_total{metodo, rota, status}
   5 métodos × 40 rotas × 10 status        =       2.000 séries por pod
   × 50 pods                               =     100.000 séries          ✅ tranquilo

   + user_id (2 milhões de usuários ativos) → milhões a bilhões de séries  💥
\`\`\`

E o **histograma multiplica**: 12 baldes + \`_sum\` + \`_count\` = 14 séries por combinação de rótulos.

| Nunca como rótulo | Use no lugar |
|---|---|
| \`user_id\`, e-mail, \`request_id\`, \`trace_id\`, IP | logs e traces (alta cardinalidade é barata lá) |
| URL crua: \`/pedidos/8812\` | o **template** da rota: \`/pedidos/{id}\` |
| mensagem de erro livre | classe do erro: \`timeout\`, \`conexao_recusada\` |
| timestamps, versões que mudam a cada build | \`version\` numa métrica *info* separada |

\`\`\`python
ROTAS = {"/pedidos", "/pedidos/{id}", "/pagamentos"}

def rotulo_rota(template):
    return template if template in ROTAS else "outras"   # conjunto FECHADO de valores
\`\`\`

> [!sabia] **Exemplars**: um balde de histograma pode carregar um **exemplo** — "esta requisição de 2,3 s foi o trace \`4bf92f…\`". No Grafana, você clica no pico do gráfico e cai direto no trace, **sem** transformar o \`trace_id\` em rótulo. É a ponte oficial entre métricas e tracing, com cardinalidade zero.

> [!atencao] Clientes de métricas raramente impedem a explosão por você. Por isso muitos times colocam um **limite de séries** por métrica ou por alvo (\`sample_limit\` no Prometheus): melhor falhar alto na criação da série número 10.001 do que derrubar o monitoramento inteiro às 3h da manhã.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Tipos de métrica, RED × USE, cardinalidade e um mini-registro com percentis por balde.', icon: '🎯' },
      {
        type: 'match',
        id: 'obs-met-q1',
        concept: 'Tipos de métrica',
        say: 'Aquecimento: cada medida com o seu tipo.',
        prompt: 'Associe cada **medida** ao **tipo de métrica** mais adequado.',
        pairs: [
          { left: 'Total de pedidos criados desde que o processo subiu', right: 'Counter' },
          { left: 'Conexões abertas no pool neste instante', right: 'Gauge' },
          { left: 'Latência das requisições, somada entre 30 réplicas para calcular o p99', right: 'Histogram' },
          { left: 'p50 e p99 calculados no próprio processo, sem precisar escolher baldes', right: 'Summary' },
        ],
        explanation: 'Pergunte: **só sobe?** → counter (e consulte a taxa). **Sobe e desce, e o que importa é o valor agora?** → gauge. **É uma distribuição?** → histogram, se precisar agregar entre instâncias (quase sempre); summary só quando há uma única instância ou quando o quantil exato de um processo basta — ele não soma entre réplicas.',
      },
      {
        type: 'mcq',
        id: 'obs-met-q2',
        concept: 'RED × USE',
        say: 'Agora, dois painéis para montar.',
        prompt: 'Você vai montar dois dashboards: um para a **API de pedidos** e outro para o **pool de conexões** dessa API com o Postgres. Qual combinação de métodos faz mais sentido?',
        options: [
          { text: '**RED** para a API (taxa, erros e duração das requisições) e **USE** para o pool (utilização, saturação — quem espera por conexão — e erros)', correct: true, why: 'A API é orientada a requisições: RED mostra o que o cliente sente. O pool é um **recurso**: USE mostra se ele está esgotado e, principalmente, se há trabalho **esperando** por ele.' },
          { text: '**USE** para a API e **RED** para o pool', why: 'Invertido: "utilização" de uma API é vago, e RED no pool mede pedidos de conexão, mas não mostra a fila de espera — justamente o sinal que antecede o aumento de latência.' },
          { text: 'CPU e memória para os dois: se estiverem baixas, está tudo bem', why: 'CPU e memória são **causas**, não sintomas. A API pode estar devolvendo 500 com CPU a 10%, e o pool pode estar travado sem gastar CPU nenhuma.' },
          { text: '**RED** para os dois: taxa, erros e duração dos pedidos de conexão bastam', why: 'Falta a **saturação**. Um pool com 100% de uso e ninguém esperando está ótimo; com 100% de uso e 40 threads na fila, a latência da API explode. Só o USE pergunta por isso explicitamente.' },
        ],
        explanation: 'Os dois métodos se complementam: **RED** descreve a experiência de quem chama o serviço (ótimo para SLOs e alertas); **USE** descreve a saúde de cada recurso (ótimo para achar o **porquê**). Num incidente, o caminho típico é: o RED da API acusa latência alta → o USE dos recursos mostra o pool **saturado** → a causa está numa query lenta segurando conexões.',
      },
      {
        type: 'mcq',
        id: 'obs-met-q3',
        concept: 'Cardinalidade',
        say: 'Chegou um pull request de uma linha. Aprova?',
        prompt: 'A métrica `http_requests_total` tem os rótulos `metodo` (5 valores), `rota` (40) e `status` (10), e o serviço roda em 50 pods. Um dev adiciona o rótulo `user_id` para "descobrir quem mais usa a API" — são 2 milhões de usuários ativos. O que acontece, e o que fazer?',
        options: [
          { text: 'O número de séries salta de ~100 mil para milhões ou bilhões: memória e custo do Prometheus disparam e as consultas travam. Tire `user_id` dos rótulos e responda "quem mais usa" com logs, eventos ou traces', correct: true, why: 'É a explosão de cardinalidade: cada usuário multiplica as combinações de rótulos. Logs e eventos lidam bem com alta cardinalidade; métricas não.' },
          { text: 'Nada grave: o Prometheus comprime séries parecidas', why: 'A compressão atua nas **amostras dentro de cada série**. Cada série nova ainda custa memória no *head block*, uma entrada no índice e trabalho em toda consulta — o custo cresce com o número de séries.' },
          { text: 'Basta trocar `user_id` por um hash dele para economizar espaço', why: 'O hash tem exatamente a **mesma cardinalidade**: 2 milhões de valores distintos continuam sendo 2 milhões de séries.' },
          { text: 'Só os dashboards ficam mais lentos; a coleta e os alertas não são afetados', why: 'O primeiro a sofrer é o próprio banco de métricas: a ingestão e a memória explodem, o Prometheus pode morrer por falta de memória — e, junto com ele, **todos** os alertas.' },
        ],
        explanation: 'Regra de ouro: rótulo de métrica é para dimensões **pequenas e fechadas** (método, rota como template, classe de status, região). O que é ilimitado — usuário, requisição, IP, URL crua — vai para **logs e traces**, e os **exemplars** fazem a ponte do gráfico para um trace específico. "Quem mais usa" é uma pergunta de análise (logs agregados, tabela de eventos), não de monitoramento.',
      },
      {
        type: 'code',
        id: 'obs-met-q4',
        concept: 'Histogramas e cardinalidade',
        title: 'Mini-registro de métricas',
        say: 'Hora de construir um mini-Prometheus em memória: counter, histogram com percentil por balde e um registro que barra a explosão de cardinalidade.',
        prompt: `O \`Gauge\` já está pronto, como exemplo. Implemente:

1. \`Counter.inc(n=1)\` → soma \`n\` a \`valor\`; \`n\` negativo → \`ValueError\` (counter só sobe).
2. \`Histogram.observar(v)\` → incrementa a contagem do **primeiro limite >= v** (limite **inclusivo**: \`0.1\` cai no balde \`0.1\`); acima de todos os limites, a última posição (\`+Inf\`). Atualize \`soma\` e \`total\`. As contagens **não** são acumuladas.
3. \`Histogram.percentil(q)\` → estimativa do quantil \`q\` (\`0.99\` = p99):
   - \`q\` fora de \`(0, 1]\` → \`ValueError\`; sem observações → \`None\`;
   - \`alvo = q * total\`; percorra os baldes finitos acumulando as contagens até o acumulado atingir o alvo (\`>=\`);
   - interpole dentro desse balde: \`inferior + (limite − inferior) × (alvo − acumulado_antes) ÷ contagem_do_balde\`, sendo \`inferior\` o limite anterior (\`0\` no primeiro balde);
   - se só o \`+Inf\` alcança o alvo, devolva o **último limite finito** (é o que o Prometheus faz).
4. \`Registro.counter(nome, **rotulos)\`, \`.gauge(nome, **rotulos)\` e \`.histogram(nome, baldes=BALDES_PADRAO, **rotulos)\`:
   - devolvem a **mesma** métrica para o mesmo nome + rótulos (a **ordem** dos rótulos não importa), criando-a na primeira vez;
   - criar uma série **nova** quando já existem \`limite_series\` séries (somando todos os tipos) → \`CardinalidadeExcedida\`; séries já existentes continuam acessíveis;
   - um nome já registrado com **outro tipo** → \`TypeError\`.`,
        starter: `from bisect import bisect_left   # útil para achar o balde

BALDES_PADRAO = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)


class CardinalidadeExcedida(Exception):
    """Criar esta série passaria do limite de séries do registro."""


class Counter:
    """Só sobe (volta a zero apenas quando o processo reinicia)."""

    def __init__(self):
        self.valor = 0.0

    def inc(self, n=1):
        pass


class Gauge:
    """Valor instantâneo: sobe e desce. (Pronto, como exemplo.)"""

    def __init__(self):
        self.valor = 0.0

    def set(self, v):
        self.valor = v

    def inc(self, n=1):
        self.valor += n

    def dec(self, n=1):
        self.valor -= n


class Histogram:
    """Contagens por balde (limite superior inclusivo, 'le') + um balde +Inf no fim."""

    def __init__(self, baldes=BALDES_PADRAO):
        self.limites = sorted(baldes)
        self.contagens = [0] * (len(self.limites) + 1)   # a última posição é o +Inf
        self.soma = 0.0
        self.total = 0

    def observar(self, v):
        pass

    def percentil(self, q):
        """Estimativa do quantil q (0 < q <= 1) por interpolação linear no balde."""
        pass


class Registro:
    def __init__(self, limite_series=1000):
        self.limite_series = limite_series
        self._series = {}   # (nome, rótulos) -> métrica
        self._tipos = {}    # nome -> classe da métrica

    def counter(self, nome, **rotulos):
        pass

    def gauge(self, nome, **rotulos):
        pass

    def histogram(self, nome, baldes=BALDES_PADRAO, **rotulos):
        pass
`,
        tests: [
          {
            name: 'counter acumula incrementos',
            code: `c = Counter()
c.inc()
c.inc(2.5)
assert c.valor == 3.5, f"esperava 3.5, veio {c.valor}"`,
          },
          {
            name: 'counter não desce',
            code: `c = Counter()
try:
    c.inc(-1)
except ValueError:
    pass
else:
    raise AssertionError("inc(-1) deveria lançar ValueError")
assert c.valor == 0, "o valor não pode mudar depois do erro"`,
          },
          {
            name: 'histogram conta por balde (le inclusivo) e no +Inf',
            code: `h = Histogram([0.1, 0.5, 1])
for v in [0.05, 0.1, 0.3, 7]:
    h.observar(v)
assert h.contagens == [2, 1, 0, 1], f"contagens: {h.contagens}"
assert h.total == 4 and abs(h.soma - 7.45) < 1e-9, (h.total, h.soma)`,
          },
          { name: 'p90 interpolado dentro do balde (0,25; 0,5]', setup: LATENCIAS, expr: 'latencias().percentil(0.9)', expected: '0.25 + (0.5 - 0.25) * (90 - 80) / 15', compare: 'approx' },
          { name: 'p99 estimado em 2,2 s (o real é 2,0 s)', setup: LATENCIAS, expr: 'latencias().percentil(0.99)', expected: '2.2', compare: 'approx' },
          { name: 'histograma vazio → None', expr: 'Histogram([1, 2]).percentil(0.5)', expected: 'None' },
          {
            name: 'mesma série para os mesmos rótulos, em qualquer ordem',
            code: `r = Registro()
a = r.counter("http_requests_total", metodo="GET", status="200")
b = r.counter("http_requests_total", status="200", metodo="GET")
c = r.counter("http_requests_total", metodo="GET", status="500")
assert a is b, "mesmo nome e mesmos rótulos devem devolver o MESMO counter"
assert a is not c, "rótulos diferentes são outra série"
a.inc()
assert b.valor == 1`,
          },
          {
            name: 'limite de séries barra a explosão de cardinalidade',
            code: `r = Registro(limite_series=3)
for i in range(3):
    r.counter("req", usuario=str(i)).inc()
try:
    r.counter("req", usuario="3")
except CardinalidadeExcedida:
    pass
else:
    raise AssertionError("a 4ª série deveria lançar CardinalidadeExcedida")
assert r.counter("req", usuario="0").valor == 1, "séries existentes continuam acessíveis"`,
          },
          {
            name: 'um nome, um tipo',
            code: `r = Registro()
r.counter("fila")
try:
    r.gauge("fila", particao="1")
except TypeError:
    pass
else:
    raise AssertionError("'fila' já é um counter: gauge('fila') deveria lançar TypeError")`,
          },
          { name: 'p50 exatamente no limite do balde', hidden: true, setup: LATENCIAS, expr: 'latencias().percentil(0.5)', expected: '0.1', compare: 'approx' },
          {
            name: 'acima do último balde, a estimativa trava no último limite',
            hidden: true,
            code: `h = Histogram([0.1, 1])
for v in [0.05, 5, 7, 9]:
    h.observar(v)
assert h.contagens == [1, 0, 3], h.contagens
assert h.percentil(0.9) == 1, f"esperava 1 (último limite finito), veio {h.percentil(0.9)}"
assert abs(h.percentil(0.25) - 0.1) < 1e-9, h.percentil(0.25)`,
          },
          {
            name: 'q fora de (0, 1] → ValueError',
            hidden: true,
            code: `h = Histogram([1])
h.observar(0.5)
for q in (0, 1.5, -0.1):
    try:
        h.percentil(q)
    except ValueError:
        pass
    else:
        raise AssertionError(f"percentil({q}) deveria lançar ValueError")
assert abs(h.percentil(1) - 1) < 1e-9`,
          },
          {
            name: 'gauges e histogramas também contam no limite',
            hidden: true,
            code: `r = Registro(limite_series=2)
g = r.gauge("fila_tamanho")
h = r.histogram("latencia_seconds", baldes=[0.1, 1], rota="/pedidos")
h.observar(0.5)
assert r.histogram("latencia_seconds", baldes=[0.1, 1], rota="/pedidos") is h
assert h.contagens == [0, 1, 0], h.contagens
assert r.gauge("fila_tamanho") is g
try:
    r.counter("erros_total")
except CardinalidadeExcedida:
    pass
else:
    raise AssertionError("com 2 séries (gauge + histogram) e limite 2, a 3ª deveria falhar")`,
          },
        ],
        reviews: [
          {
            when: (m, code) => m.imports.includes('statistics') || m.calls.includes('quantiles') || /def observar[\s\S]*?\.append\(/.test(code),
            text: 'Parece que você guarda as **observações brutas**. A graça do histograma é guardar só as **contagens por balde**: memória constante (O(baldes)) em vez de O(requisições), e contagens que **somam** entre réplicas. O preço é o percentil ser uma estimativa.',
            concept: 'Histograma × amostras brutas',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função acumulou decisões demais. No `Registro`, extraia um método auxiliar (ex.: `_obter(tipo, nome, rotulos, *args)`) que valida o tipo, monta a chave, checa o limite e cria a série — e deixe `counter`, `gauge` e `histogram` com uma linha cada.',
            concept: 'Extrair método',
          },
          {
            when: m => m.usesGlobal,
            text: 'Evite estado global mutável (`global`): cada `Registro` deve ter as próprias séries. Registro global dificulta testes — é por isso que o `prometheus_client` aceita um `CollectorRegistry` injetado.',
            concept: 'Estado global',
          },
        ],
        hints: [
          '`Counter.inc`: `if n < 0: raise ValueError(...)` antes de somar. `Histogram.observar`: `bisect_left(self.limites, v)` devolve exatamente o índice do primeiro limite `>= v` (e `len(limites)` quando passa de todos) — some 1 em `self.contagens` nesse índice.',
          '`percentil`: `alvo = q * self.total`; percorra `zip(self.limites, self.contagens)` com `acumulado = 0` e `inferior = 0.0`. Se `acumulado + n >= alvo`, devolva `inferior + (limite - inferior) * (alvo - acumulado) / n`; senão, `acumulado += n` e `inferior = limite`. Depois do laço, `return self.limites[-1]`.',
          '`Registro`: crie `_obter(self, tipo, nome, rotulos, *args)`. Use `self._tipos.setdefault(nome, tipo)` para detectar tipo trocado; a chave é `(nome, tuple(sorted(rotulos.items())))`; se a chave for nova e `len(self._series) >= self.limite_series`, lance `CardinalidadeExcedida`; senão, crie com `tipo(*args)`.',
        ],
        solution: `from bisect import bisect_left   # útil para achar o balde

BALDES_PADRAO = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)


class CardinalidadeExcedida(Exception):
    """Criar esta série passaria do limite de séries do registro."""


class Counter:
    """Só sobe (volta a zero apenas quando o processo reinicia)."""

    def __init__(self):
        self.valor = 0.0

    def inc(self, n=1):
        if n < 0:
            raise ValueError("counter só sobe; para subir e descer, use um gauge")
        self.valor += n


class Gauge:
    """Valor instantâneo: sobe e desce. (Pronto, como exemplo.)"""

    def __init__(self):
        self.valor = 0.0

    def set(self, v):
        self.valor = v

    def inc(self, n=1):
        self.valor += n

    def dec(self, n=1):
        self.valor -= n


class Histogram:
    """Contagens por balde (limite superior inclusivo, 'le') + um balde +Inf no fim."""

    def __init__(self, baldes=BALDES_PADRAO):
        self.limites = sorted(baldes)
        self.contagens = [0] * (len(self.limites) + 1)   # a última posição é o +Inf
        self.soma = 0.0
        self.total = 0

    def observar(self, v):
        self.contagens[bisect_left(self.limites, v)] += 1   # primeiro limite >= v
        self.soma += v
        self.total += 1

    def percentil(self, q):
        """Estimativa do quantil q (0 < q <= 1) por interpolação linear no balde."""
        if not 0 < q <= 1:
            raise ValueError("q deve estar em (0, 1]")
        if self.total == 0:
            return None
        alvo = q * self.total
        acumulado = 0
        inferior = 0.0
        for limite, n in zip(self.limites, self.contagens):
            if acumulado + n >= alvo:
                return inferior + (limite - inferior) * (alvo - acumulado) / n
            acumulado += n
            inferior = limite
        return self.limites[-1]   # só o +Inf alcança o alvo: o melhor palpite é o último limite


class Registro:
    def __init__(self, limite_series=1000):
        self.limite_series = limite_series
        self._series = {}   # (nome, rótulos) -> métrica
        self._tipos = {}    # nome -> classe da métrica

    def _obter(self, tipo, nome, rotulos, *args):
        if self._tipos.setdefault(nome, tipo) is not tipo:
            raise TypeError(f"{nome!r} já está registrado como {self._tipos[nome].__name__}")
        chave = (nome, tuple(sorted(rotulos.items())))
        if chave not in self._series:
            if len(self._series) >= self.limite_series:
                raise CardinalidadeExcedida(f"{nome}: limite de {self.limite_series} séries atingido")
            self._series[chave] = tipo(*args)
        return self._series[chave]

    def counter(self, nome, **rotulos):
        return self._obter(Counter, nome, rotulos)

    def gauge(self, nome, **rotulos):
        return self._obter(Gauge, nome, rotulos)

    def histogram(self, nome, baldes=BALDES_PADRAO, **rotulos):
        return self._obter(Histogram, nome, rotulos, baldes)
`,
        solutionExplanation: 'Três ideias de bancos de métricas em 80 linhas. **(1)** O histograma troca exatidão por escala: guardar só as contagens por balde custa memória constante, e contagens de réplicas diferentes **somam** — basta somar os vetores e chamar `percentil` sobre o resultado, o que um summary nunca permite. O preço aparece no teste do p99: a estimativa é 2,2 s quando o real é 2,0 s, porque a interpolação supõe observações espalhadas uniformemente dentro do balde (1; 2,5]. E acima do último limite não há como saber nada: a estimativa trava nele — por isso os baldes precisam cobrir a cauda e ter um limite exatamente no limiar do SLO. **(2)** A identidade de uma série é **nome + conjunto de rótulos**: `tuple(sorted(...))` torna a chave independente da ordem dos kwargs (um `frozenset` dos itens também serviria). **(3)** O limite de séries é a defesa contra a explosão de cardinalidade: falha **alto e cedo**, na criação da série nova, em vez de deixar a memória crescer até o processo morrer. No Prometheus real, o equivalente é o `sample_limit` por alvo de coleta; do lado do código, a prevenção é nunca usar valores ilimitados como rótulo. O `_tipos` reproduz outra regra do Prometheus: um nome de métrica tem **um único tipo**.',
      },
      {
        type: 'open',
        id: 'obs-met-q5',
        concept: 'Agregação de percentis',
        say: 'Para fechar: um painel que parece certo, mas mente.',
        prompt: 'Seu serviço roda em **10 réplicas**, e cada uma exporta o próprio p99 de latência (um *summary*). Um colega monta o painel com a **média dos 10 p99** e o chama de "p99 do serviço". O que está errado, e como você mediria o p99 de verdade?',
        rubric: [
          { label: 'Percentis não são agregáveis: média de p99 não é p99', keywords: ['agreg', 'media de percent', 'media dos percent', 'media dos p99', 'media de p99', 'nao se soma', 'nao somam', 'nao soma', 'nao compoe', 'matematicamente'], concept: 'Agregação de percentis', why: 'Percentil é uma estatística de ordem: não existe fórmula que combine os p99 das partes no p99 do todo.' },
          { label: 'Explica o efeito do tráfego desigual ou da cauda concentrada', keywords: ['trafego', 'peso', 'pondera', 'volume', 'mesmo peso', 'cauda', 'replica lenta', 'uma replica', 'distribuic'], concept: 'Tail latency', why: 'Uma réplica com pouco tráfego pesa tanto quanto uma sobrecarregada, e uma réplica doente com cauda enorme pode sumir ou dominar a média.' },
          { label: 'Propõe histograma: somar os baldes de todas as réplicas e então estimar o quantil', keywords: ['histogram', 'balde', 'bucket', 'histogram_quantile'], concept: 'Baldes de histograma', why: 'Contagens por balde somam entre réplicas; o quantil é estimado sobre a distribuição combinada.' },
          { label: 'Menciona a aproximação e a escolha dos limites (ou a contagem abaixo de um limiar)', keywords: ['aproxim', 'estimativ', 'interpol', 'limiar', 'largura', 'limite do balde', 'limites dos baldes', 'proporcao', 'abaixo de'], concept: 'Baldes de histograma', why: 'O quantil vindo de histograma é uma estimativa limitada pela largura do balde; a proporção de requisições abaixo de um limiar é exata se houver um balde nele.' },
        ],
        minWords: 35,
        modelAnswer: 'O erro é que **percentis não são agregáveis**: a média dos 10 p99 não é o p99 do serviço, e não existe conta que combine percentis das partes no percentil do todo. Na prática, a média dá o **mesmo peso** a uma réplica com pouco tráfego e a outra sobrecarregada, e uma única réplica doente com **cauda** enorme pode sumir na média (ou distorcê-la). Eu trocaria o summary por um **histograma**: cada réplica exporta as contagens por **balde**, o Prometheus **soma os baldes** de todas as réplicas (`sum by (le)` sobre a taxa) e só então calcula o quantil com `histogram_quantile(0.99, ...)`. O resultado é uma **estimativa** — o erro é limitado pela largura do balde, por **interpolação** —, então eu escolheria limites que cubram a cauda e colocaria um limite exatamente no **limiar** do SLO, para que a proporção de requisições abaixo dele seja exata.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você escolhe o tipo certo, sabe o que medir com RED e USE e não deixa um `user_id` derrubar o Prometheus.',
          { text: 'Próximo sinal: tracing — seguir uma requisição de serviço em serviço.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
