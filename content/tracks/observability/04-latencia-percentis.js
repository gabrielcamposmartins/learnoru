(function () {
  Game.registerModule('observability', {
    id: 'latencia-percentis',
    title: 'Latência e percentis',
    kind: 'lesson',
    level: 3,
    order: 4,
    unit: 'sinais',
    summary: 'Por que a média mente, o que p50, p99 e p99,9 realmente dizem, como o fan-out transforma a cauda de um backend na experiência normal do usuário — e as armadilhas de medição que quase ninguém conhece: coordinated omission e a Lei de Little.',
    concepts: ['Percentis', 'Tail latency', 'Fan-out', 'Coordinated omission', 'Lei de Little'],
    takeaways: [
      'Latência tem **cauda longa**: a média não corresponde a nenhuma requisição real. Olhe **p50, p99, p99,9 e o máximo** — e lembre que percentis **não se agregam** (média de p99s não é p99); some histogramas.',
      'Com **fan-out**, a cauda vira regra: se uma requisição espera 100 chamadas paralelas, **1 − 0,99¹⁰⁰ ≈ 63%** dos usuários pegam pelo menos um p99 de backend. A latência percebida é a do **mais lento**.',
      '**Coordinated omission**: um gerador de carga em loop fechado espera o sistema lento e deixa de enviar — e de medir — exatamente as requisições que sofreriam. Meça a partir do horário **planejado** de envio (modelo aberto).',
      '**Lei de Little**: L = λ × W. Requisições em voo = taxa × latência. Dimensiona pools e workers, prevê cascatas quando uma dependência fica lenta e desmascara benchmarks impossíveis.',
      'Para medir percentis em escala, use **histogramas** mescláveis — de preferência log-lineares (HDR, exponenciais), com erro relativo fixo — e posicione buckets perto dos limiares do SLO.',
    ],
    glossary: [
      { term: 'Percentil', aliases: ['percentis', 'p50', 'p95', 'p99', 'p999', 'p99,9', 'percentile', 'mediana'], definition: 'O p-ésimo percentil é o valor abaixo do qual (ou igual) ficam p% das amostras. No método **nearest-rank**: ordene e pegue o elemento de posição ⌈p/100 × n⌉. O p50 é a mediana; o p99 é superado por só 1 em cada 100 requisições.' },
      { term: 'Tail latency', aliases: ['latência de cauda', 'cauda de latência', 'cauda longa'], definition: 'A latência das requisições mais lentas (p99, p99,9, máximo). Causada por GC, filas, vizinhos barulhentos, retransmissões. Com fan-out, a cauda de cada backend vira a experiência **típica** do usuário.' },
      { term: 'Fan-out', aliases: ['fanout', 'fan out'], definition: 'Quando uma requisição dispara várias chamadas paralelas (shards, microsserviços) e precisa esperar todas. A latência percebida é a do **mais lento**, e a chance de pegar ao menos uma cauda p99 é 1 − 0,99ⁿ.' },
      { term: 'Coordinated omission', aliases: ['omissão coordenada'], definition: 'Erro de medição em que o gerador de carga espera cada resposta antes de enviar a próxima: quando o sistema trava, ele para de enviar e deixa de registrar as requisições que teriam esperado. Os percentis saem absurdamente otimistas.' },
      { term: 'Lei de Little', aliases: ["Little's Law", 'lei de little', 'L = λW'], definition: '**L = λ × W**: em regime estável, o número médio de itens no sistema é a taxa de chegada vezes o tempo médio que cada um passa nele. Vale para qualquer distribuição e disciplina de fila.' },
      { term: 'HDR Histogram', aliases: ['HdrHistogram', 'histograma HDR', 'histogramas HDR'], definition: 'Histograma de alta faixa dinâmica (Gil Tene): buckets **log-lineares** com precisão relativa fixa (ex.: 3 dígitos significativos) de microssegundos a horas, com memória constante e que podem ser **somados** entre servidores e janelas.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'O dashboard diz: latência média de 80 ms. Todo mundo feliz. Enquanto isso, o suporte recebe reclamações de "site travando".',
          'Hoje você vai entender por que a **média mente** — e o que olhar no lugar dela.',
        ],
        board: {
          title: 'A média mente',
          md: `Cem requisições: **98** levaram 20 ms e **2** levaram 3 s.

\`\`\`python
lat = [20] * 98 + [3000] * 2
sum(lat) / len(lat)   # 79.6 → a média: nenhuma requisição levou isso
sorted(lat)[49]       # 20   → p50 (mediana): metade foi rápida
sorted(lat)[98]       # 3000 → p99: 1 em cada 100 esperou 3 s
\`\`\`

| Métrica | Valor | O que conta |
|---|---|---|
| Média | 79,6 ms | "tudo ótimo" — mas é uma ficção |
| p50 | 20 ms | a experiência típica |
| p99 | 3.000 ms | a experiência de 1 em cada 100 |
| Máximo | 3.000 ms | o pior caso |

Latência tem **cauda longa**: tem um piso físico (rede, disco), mas nenhum teto — pausa de GC, fila, retry, timeout. A distribuição fica torta para a direita, e muitas vezes é **bimodal**:

\`\`\`text
 cache hit (80%):  5 ms    ████████████████████
 cache miss (20%): 200 ms  █████
 média:            44 ms   ← ninguém viveu 44 ms
\`\`\`

> [!atencao] Média e desvio-padrão supõem uma distribuição simétrica, tipo curva normal. Latência não é. "Média ± 2 desvios" não descreve nada útil aqui.

> [!dica] A pergunta certa não é "quanto demora em média?", e sim "**quantos** usuários esperam mais do que X?" — é isso que um SLI de latência mede.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Percentil parece simples, mas tem pegadinhas: o método de cálculo, o tamanho da amostra e — a maior de todas — agregar.',
        ],
        board: {
          title: 'Percentis: p50, p95, p99, p99,9',
          md: `**Percentil p** = o valor que p% das amostras não ultrapassam. O método mais simples é o **nearest-rank**: ordene e pegue a posição **⌈p/100 × n⌉** (contando a partir de 1). Ele sempre devolve uma amostra **real**.

Com as amostras \`[15, 20, 35, 40, 50]\` (n = 5):

| p | Posição ⌈p/100 × 5⌉ | Valor |
|---|---|---|
| 30 | ⌈1,5⌉ = 2 | 20 |
| 40 | ⌈2,0⌉ = 2 | 20 |
| 50 | ⌈2,5⌉ = 3 | 35 |
| 100 | 5 | 50 (o máximo) |

| Percentil | Mais lentas que ele | Para que serve |
|---|---|---|
| p50 | 1 em 2 | experiência típica |
| p95 | 1 em 20 | "quase todo mundo" |
| p99 | 1 em 100 | a cauda — seus clientes mais ativos vivem aqui |
| p99,9 | 1 em 1.000 | cauda profunda: GC, timeouts, retries |
| máximo | nenhuma | o pior caso — nunca descarte |

> [!atencao] **Percentis não se agregam.** A média dos p99 de 4 servidores **não** é o p99 do serviço, e o p99 de cada minuto não dá o p99 da hora. Agregue **contagens** (histogramas, "quantas abaixo de 300 ms") e calcule o percentil no fim.

- **Tamanho da amostra:** com 100 requisições, o "p99,9" é simplesmente o máximo. Para um p99,9 confiável, você precisa de muitos milhares de amostras na janela.
- **Métodos diferentes, números diferentes:** o \`statistics.quantiles\` do Python e o \`percentile\` do numpy **interpolam** entre amostras; o nearest-rank não. Com poucas amostras a diferença é grande — saiba o que sua ferramenta calcula.

> [!dica] No código, cuidado com ponto flutuante: \`99.9 / 100 * 1000\` dá \`999.0000000000001\`, e o \`ceil\` pula para a posição errada. \`Fraction(str(p))\` ou \`Decimal(str(p))\` resolvem.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          '"Mas o p99 é só 1% das requisições!" — essa frase é verdadeira para **um** serviço. Para o usuário, quase nunca.',
          'A culpa é do **fan-out**.',
        ],
        board: {
          title: 'Tail latency e o fan-out',
          md: `A busca consulta **50 shards em paralelo** e só responde quando **todos** respondem. A latência que o usuário sente é a do **mais lento**:

\`\`\`text
            ┌─► shard 1     8 ms
 usuário ──►├─► shard 2     9 ms
 (espera    ├─► shard 3     7 ms       latência percebida = max(...) = 400 ms
  todos)    │      …
            └─► shard 50  400 ms   ← o p99 de UM shard
\`\`\`

Se cada chamada tem 1% de chance de cair na cauda, a chance de **pelo menos uma** das n cair é **1 − 0,99ⁿ**:

| Chamadas paralelas (n) | Requisições que pegam ≥ 1 p99 |
|---|---|
| 1 | 1% |
| 5 | 4,9% |
| 10 | 9,6% |
| 50 | 39,5% |
| 100 | **63,4%** |
| 500 | 99,3% |

Com 100 chamadas, o p99 do backend virou a **mediana** do usuário. O mesmo vale para uma página que carrega dezenas de recursos, ou uma sessão com dezenas de cliques: quase todo usuário encontra o seu p99.

**De onde vem a cauda:** pausas de GC, filas, vizinhos barulhentos na mesma máquina, compactação de disco, retransmissão TCP (o RTO mínimo no Linux é 200 ms), cache frio, *throttling* de CPU em containers.

> [!sabia] No artigo **The Tail at Scale** (Dean e Barroso, Google, 2013), num teste que lia 1.000 chaves espalhadas por 100 servidores, mandar uma **requisição de reserva** (*hedged request*) quando a primeira passava de 10 ms derrubou o p99,9 de **1.800 ms para 74 ms** — com só **2%** de requisições a mais. A lição: às vezes é mais barato **contornar** a cauda do que eliminá-la.

Outras defesas: timeouts com **resultados parciais** ("49 de 50 shards é bom o bastante"), reduzir o fan-out, *tied requests*, e atacar as causas (tuning de GC, isolamento). Hedging e timeouts aparecem em detalhe na trilha de APIs.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a armadilha mais traiçoeira de medição de latência — e quase nenhuma ferramenta antiga escapava dela.',
          'Chama-se **coordinated omission**, e ela pode transformar um p99 de 9 segundos em 1 milissegundo no relatório.',
        ],
        board: {
          title: 'Coordinated omission',
          md: `Um gerador de carga em **loop fechado** envia uma requisição, **espera a resposta** e só então agenda a próxima. Planejado: 100 req/s (uma a cada 10 ms) por 100 s. O servidor responde em 1 ms — mas **trava 10 s** uma vez.

\`\`\`text
 planejado:  │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │   (a cada 10 ms)
 enviado:    │ │ │ │ │ █████████████ trava 10 s ████████████ │ │ │ │
                          ▲ só UMA amostra de 10 s é registrada
                            as ~1.000 que chegariam durante a trava somem
\`\`\`

| | Medido (loop fechado) | Realidade (usuários chegando a 100/s) |
|---|---|---|
| Amostras | ~9.000 de 1 ms + **1** de 10 s | 9.000 de 1 ms + **1.000** esperando de 10 ms a 10 s |
| p50 | 1 ms | 1 ms |
| p99 | **1 ms** | **~9 s** |
| Máximo | 10 s | 10 s |

O gerador "se coordenou" com o sistema: justamente quando o sistema ia mal, ele parou de mandar trabalho — e de medir. Usuários de verdade não fazem isso: eles continuam chegando.

**Como corrigir:**

1. **Modelo aberto**: gerar carga a uma **taxa de chegada constante**, independente das respostas (wrk2, k6 com \`constant-arrival-rate\`, Vegeta, Gatling com \`injectOpen\`).
2. Medir a latência a partir do horário **planejado** de envio, não do envio real.
3. Corrigir depois: o HdrHistogram tem \`recordValueWithExpectedInterval\`, que **recria** as amostras que faltaram — você vai implementar isso.

> [!sabia] O nome foi cunhado por **Gil Tene** (Azul Systems), na palestra *How NOT to Measure Latency*. Ele mostrou que ferramentas populares — o \`wrk\` original, \`ab\`, a configuração padrão do JMeter — sofriam do problema, e criou o **wrk2** para corrigi-lo. O servidor também "omite": o cronômetro dele começa quando a requisição é **aceita**, então o tempo parado na fila do socket ou do load balancer nunca entra na métrica. Meça também do lado do cliente.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Agora a fórmula mais útil que quase ninguém aprende na faculdade: **L = λ × W**.',
          'Uma multiplicação que dimensiona pools, prevê cascatas e desmascara benchmarks.',
        ],
        board: {
          title: 'Lei de Little',
          md: `**L = λ × W**

| Símbolo | Significado | Exemplo |
|---|---|---|
| **L** | itens no sistema, em média (em voo) | requisições em andamento, conexões ocupadas |
| **λ** | taxa de chegada (= vazão, em regime estável) | 2.000 req/s |
| **W** | tempo médio dentro do sistema | 50 ms |

**Para que serve no dia a dia:**

1. **Dimensionar workers:** 2.000 req/s × 0,05 s = **100** requisições em voo. Com 40 workers, 60 ficam na fila.
2. **Pool de conexões:** 500 consultas/s × 20 ms = **10** conexões ocupadas em média. Deixe folga para a variação (utilização ≤ ~70%): ~15.
3. **Prever a cascata:** o banco passou de 20 ms para 200 ms com o mesmo tráfego → **100** conexões em voo. O pool de 15 esgota, tudo enfileira e a latência de **todo mundo** sobe — inclusive de quem nem usa o banco lento.
4. **Checar benchmarks:** 10 conexões em loop fechado reportando 1.000 req/s → a latência **média** tem que ser 10 ms. Se o relatório disser 2 ms, alguma coisa não foi medida.

E por que não rodar servidores a 95% de CPU? Teoria das filas (modelo M/M/1): tempo de resposta = S ÷ (1 − ρ), onde S é o tempo de serviço e ρ a utilização.

| Utilização ρ | Tempo de resposta |
|---|---|
| 50% | 2 × S |
| 80% | 5 × S |
| 90% | 10 × S |
| 99% | 100 × S |

Esse é o **joelho da curva**: perto de 100%, pequenos aumentos de carga explodem a fila.

> [!sabia] **John Little** provou a lei em 1961, e ela vale para **qualquer** sistema estável — não importa a distribuição das chegadas, dos tempos de serviço, a ordem de atendimento ou o número de servidores. Serve até para fila de mensagens: com *consumer lag* de 60.000 mensagens e vazão de 1.000 msg/s, cada mensagem espera ~60 s (W = L ÷ λ).

> [!atencao] É uma lei de **médias** em regime **estável** (entra o mesmo que sai). Ela não diz nada sobre o p99 — e, se as chegadas superam a capacidade, a fila cresce sem limite e não há regime estável para aplicá-la.`,
        },
      },
      {
        type: 'say',
        text: [
          'Última peça: com 50 mil requisições por segundo você não guarda cada amostra. E percentis não se somam.',
          'A saída são **histogramas** — de preferência, do tipo certo.',
        ],
        board: {
          title: 'Histogramas e HDR Histogram',
          md: `Um **histograma** guarda **contagens por faixa** (bucket). Contagens **somam** — entre servidores e entre janelas — e o percentil é calculado no fim.

\`\`\`text
http_request_duration_seconds_bucket{le="0.05"}   8123
http_request_duration_seconds_bucket{le="0.1"}    9310
http_request_duration_seconds_bucket{le="0.25"}   9870
http_request_duration_seconds_bucket{le="0.5"}    9950
http_request_duration_seconds_bucket{le="1"}      9990
http_request_duration_seconds_bucket{le="+Inf"}  10000

histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
\`\`\`

A 9.900ª requisição está entre 0,25 s e 0,5 s. O Prometheus **interpola linearmente** e responde ~0,34 s — mas o p99 real pode ser qualquer coisa nessa faixa. O erro depende de **onde estão os buckets**: se o SLO é "300 ms", tenha um bucket exatamente em 0,3.

**Buckets log-lineares** resolvem o dilema entre precisão e faixa: cada bucket é uma porcentagem fixa maior que o anterior, então o erro **relativo** é o mesmo em 1 µs ou em 1 hora.

\`\`\`python
import math

BASE = 1.02                        # cada bucket é 2% maior que o anterior

def bucket(valor):
    return math.floor(math.log(valor, BASE))

# de 1 µs a 1 hora (3,6 × 10⁹ µs): só ~1.100 buckets, com erro relativo ≤ 2%
# somar dois histogramas = somar as contagens bucket a bucket
\`\`\`

| Estrutura | Ideia | Onde aparece |
|---|---|---|
| Buckets fixos | limites escolhidos à mão | histograma clássico do Prometheus |
| **HDR Histogram** | log-linear, N dígitos significativos (ex.: 3 → erro ≤ 0,1%) | Java, Go, Rust, Python; ferramentas de benchmark |
| Histograma exponencial | limites em potências de uma base | OpenTelemetry, *native histograms* do Prometheus |
| Sketches (DDSketch, t-digest) | resumos compactos de quantis | Datadog, bancos analíticos |

> [!dica] O **HDR Histogram** também é do Gil Tene — criado justamente para medir latência sem perder a cauda: memória constante (dezenas de KB), gravação em tempo constante e histogramas que podem ser somados. Ele traz embutida a correção de coordinated omission.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Percentis, fan-out, coordinated omission e Lei de Little.', icon: '⏱️' },
      {
        type: 'mcq',
        id: 'obs-lat-q1',
        concept: 'Percentis nearest-rank',
        say: 'Para aquecer: faça as contas de cabeça.',
        prompt: 'Uma janela tem **100** requisições: 99 levaram 10 ms e **1** levou 5.000 ms. Pelo método **nearest-rank**, quais são a média, o p50 e o p99?',
        options: [
          { text: 'Média ≈ 60 ms; p50 = 10 ms; p99 = 10 ms — a lenta só aparece no máximo', correct: true, why: 'Média = (99 × 10 + 5.000) ÷ 100 = 59,9 ms. O p99 é a posição ⌈0,99 × 100⌉ = 99 da lista ordenada — ainda 10 ms. A de 5 s é a 100ª: o máximo.' },
          { text: 'Média ≈ 60 ms; p50 = 10 ms; p99 = 5.000 ms', why: 'Erro de posição clássico: o p99 de 100 amostras é a **99ª**, não a 100ª. Com uma única amostra lenta em 100, ela é o p100 (máximo). Com duas, apareceria no p99.' },
          { text: 'Média = 10 ms; p50 = 10 ms; p99 = 10 ms', why: 'A média é sensível a valores extremos: uma amostra de 5 s sobe a média para ~60 ms. Aqui a média **exagera** a experiência típica, enquanto o p99 a subestima — nenhuma delas conta a história sozinha.' },
          { text: 'Média ≈ 60 ms; p50 ≈ 60 ms; p99 = 5.000 ms', why: 'Confunde mediana com média. A mediana é o valor do meio da lista ordenada (10 ms) e ignora completamente o quanto a amostra lenta é lenta.' },
        ],
        explanation: 'Duas lições. **(1)** A média mistura o típico com o extremo e não descreve nenhuma requisição real. **(2)** Percentis de cauda precisam de **amostras suficientes**: com 100 requisições, o p99 tem só uma amostra acima dele, e o p99,9 é o próprio máximo. Por isso dashboards sérios mostram p50, p99, p99,9 **e o máximo**, em janelas com volume suficiente — e o máximo nunca é descartado como "outlier": às vezes ele é o único sinal de um problema real.',
      },
      {
        type: 'match',
        id: 'obs-lat-q2',
        concept: 'Vocabulário de latência',
        say: 'Jogo rápido de vocabulário.',
        prompt: 'Associe cada termo à sua descrição.',
        pairs: [
          { left: 'p50 (mediana)', right: 'Metade das requisições é mais rápida que este valor' },
          { left: 'p99', right: 'Só 1 em cada 100 requisições é mais lenta que este valor' },
          { left: 'Lei de Little', right: 'Itens em voo = taxa de chegada × tempo no sistema' },
          { left: 'Fan-out', right: 'Com 100 chamadas paralelas, 63% das requisições pegam ao menos um p99' },
          { left: 'Coordinated omission', right: 'O gerador de carga espera o sistema lento e deixa de medir quem sofreria' },
          { left: 'HDR Histogram', right: 'Buckets log-lineares com erro relativo fixo, que podem ser somados' },
        ],
        explanation: 'Repare como os termos se encadeiam: percentis descrevem a distribuição; o **fan-out** explica por que a cauda importa mais do que parece; **coordinated omission** e histogramas tratam de medir essa cauda sem enganar a si mesmo; e a **Lei de Little** conecta latência com concorrência — é ela que transforma "o banco ficou lento" em "o pool de conexões esgotou".',
      },
      {
        type: 'code',
        id: 'obs-lat-q3',
        concept: 'Percentis e fan-out',
        title: 'Percentis e latência percebida num fan-out',
        say: 'Hora do código: calcule percentis direito e veja o fan-out amplificar a cauda com números reais.',
        prompt: `Implemente:

1. \`percentil(amostras, p)\` → o percentil **nearest-rank**: ordene e devolva o elemento de posição **⌈p/100 × n⌉** (contando a partir de 1).
   - \`ValueError\` se \`amostras\` estiver vazia ou se \`p\` estiver fora de \`(0, 100]\`;
   - **não altere** a lista recebida;
   - cuidado com ponto flutuante: \`99.9 / 100 * 1000\` dá \`999.0000000000001\`. Use aritmética exata (ex.: \`Fraction(str(p))\`).
2. \`chance_de_cauda(p, n)\` → probabilidade de **pelo menos uma** de \`n\` chamadas paralelas independentes passar do percentil \`p\` do backend: \`1 − (p/100)ⁿ\`.
3. \`latencia_percebida(respostas, p)\` → \`respostas\` é uma lista de requisições do usuário; cada uma é a lista de latências das chamadas paralelas que ela fez. O usuário espera a **mais lenta** de cada requisição. Devolva o percentil \`p\` (nearest-rank) dessas latências percebidas.`,
        starter: `def percentil(amostras, p):
    """Percentil pelo método nearest-rank."""
    pass


def chance_de_cauda(p, n):
    """Chance de ao menos uma de n chamadas paralelas passar do percentil p."""
    pass


def latencia_percebida(respostas, p):
    """Percentil p da latência que o usuário sente (a chamada mais lenta de cada requisição)."""
    pass
`,
        tests: [
          { name: 'p30 de [15, 20, 35, 40, 50] → posição ⌈1,5⌉ = 2', expr: 'percentil([15, 20, 35, 40, 50], 30)', expected: '20' },
          { name: 'posição exata: p40 → ⌈2,0⌉ = 2 (sem somar 1)', expr: 'percentil([15, 20, 35, 40, 50], 40)', expected: '20' },
          { name: 'entrada fora de ordem; p50 e p100', code: `assert percentil([50, 15, 40, 20, 35], 50) == 35, "p50 → posição 3 da lista ORDENADA"
assert percentil([50, 15, 40, 20, 35], 100) == 50, "p100 é o máximo"` },
          { name: 'uma lenta em 100: o p99 ainda é rápido', expr: '(percentil([10] * 99 + [5000], 99), percentil([10] * 99 + [5000], 100))', expected: '(10, 5000)' },
          { name: 'p99,9 de 1.000 amostras (cuidado com o ponto flutuante)', expr: 'percentil(list(range(1, 1001)), 99.9)', expected: '999' },
          {
            name: 'entradas inválidas levantam ValueError',
            code: `for args in (([], 50), ([1, 2, 3], 0), ([1, 2, 3], 101), ([1, 2, 3], -5)):
    try:
        percentil(*args)
    except ValueError:
        pass
    else:
        raise AssertionError(f"percentil{args} deveria levantar ValueError")`,
          },
          { name: 'chance de cauda com 100 chamadas', expr: 'chance_de_cauda(99, 100)', expected: '1 - 0.99 ** 100', compare: 'approx' },
          {
            name: 'chance de cauda: 1 chamada e 0 chamadas',
            code: `import math
assert math.isclose(chance_de_cauda(99, 1), 0.01), "com 1 chamada, a chance é o próprio 1%"
assert chance_de_cauda(99.9, 0) == 0, "sem chamadas, não há cauda para pegar"`,
          },
          { name: 'latência percebida = a chamada mais lenta', expr: '(latencia_percebida([[5, 7, 6], [5, 300, 6], [8, 9, 7], [6, 5, 250]], 50), latencia_percebida([[5, 7, 6], [5, 300, 6], [8, 9, 7], [6, 5, 250]], 75))', expected: '(9, 250)' },
          {
            name: 'fan-out: 1% de chamadas lentas vira 10% de usuários lentos',
            code: `respostas = [[1000 if (i * 10 + j) % 100 == 0 else 5 for j in range(10)] for i in range(100)]
todas = [x for req in respostas for x in req]
assert percentil(todas, 99) == 5, "o p99 de cada chamada é rápido: só 1% delas é lenta"
assert latencia_percebida(respostas, 99) == 1000, "mas 10% dos usuários pegam uma chamada lenta"
assert latencia_percebida(respostas, 90) == 5 and latencia_percebida(respostas, 95) == 1000`,
          },
          { name: 'p99,9 de 10.000 amostras', hidden: true, expr: 'percentil(list(range(1, 10001)), 99.9)', expected: '9990' },
          {
            name: 'não altera a lista recebida',
            hidden: true,
            code: `dados = [30, 10, 20]
percentil(dados, 50)
assert dados == [30, 10, 20], f"a lista do chamador foi alterada: {dados}"`,
          },
          { name: 'p pequeno devolve o mínimo', hidden: true, expr: 'percentil([7, 3, 9], 0.1)', expected: '3' },
        ],
        reviews: [
          {
            when: (m, code) => /amostras\.sort\(/.test(code),
            text: '`amostras.sort()` reordena a lista **do chamador** — um efeito colateral surpresa (e um bug difícil de achar se ela for reutilizada, por exemplo para calcular outro indicador na ordem original). Use `sorted(amostras)`, que devolve uma cópia.',
            concept: 'Efeitos colaterais',
          },
          {
            when: m => !m.calls.includes('percentil'),
            text: '`latencia_percebida` recalcula o percentil por conta própria. Reaproveite `percentil`: a regra do nearest-rank (e o cuidado com ponto flutuante) fica num lugar só.',
            concept: 'DRY',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função ficou com decisões demais. `percentil` só valida, ordena e indexa; `latencia_percebida` é uma linha: o percentil dos máximos de cada requisição.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Em `percentil`: valide primeiro (`if not amostras` e `if not 0 < p <= 100` → `raise ValueError`). Depois `ordenadas = sorted(amostras)`.',
          'A posição é `math.ceil(Fraction(str(p)) * len(ordenadas) / 100)`, contando de 1: devolva `ordenadas[posicao - 1]`. O `str(p)` faz `99.9` virar exatamente 999/10.',
          '`chance_de_cauda` é uma linha: `1 - (p / 100) ** n`. E `latencia_percebida` também: `percentil([max(chamadas) for chamadas in respostas], p)`.',
        ],
        solution: `import math
from fractions import Fraction


def percentil(amostras, p):
    """Percentil pelo método nearest-rank."""
    if not amostras:
        raise ValueError("sem amostras")
    if not 0 < p <= 100:
        raise ValueError("p deve estar em (0, 100]")
    ordenadas = sorted(amostras)
    posicao = math.ceil(Fraction(str(p)) * len(ordenadas) / 100)
    return ordenadas[posicao - 1]


def chance_de_cauda(p, n):
    """Chance de ao menos uma de n chamadas paralelas passar do percentil p."""
    return 1 - (p / 100) ** n


def latencia_percebida(respostas, p):
    """Percentil p da latência que o usuário sente (a chamada mais lenta de cada requisição)."""
    return percentil([max(chamadas) for chamadas in respostas], p)
`,
        solutionExplanation: 'O **nearest-rank** é o método mais honesto para latência: devolve sempre uma amostra que aconteceu de verdade, sem inventar valores interpolados. O `Fraction(str(p))` evita o bug clássico em que `99.9 / 100 * 1000` vira `999.0000000000001` e o `ceil` pula para a posição 1000 — o tipo de erro que só aparece em alguns tamanhos de amostra e faz dashboards "pularem". O último teste é a lição do módulo em números: cada chamada tem p99 de 5 ms, mas, com fan-out de 10, **10% dos usuários** esperam 1 s — o p95 **percebido** já é a cauda. Por isso o SLI de latência deve ser medido **onde o usuário espera** (na borda, no serviço que agrega), não em cada backend isolado; e `chance_de_cauda(99, n)` é a conta de guardanapo que justifica investir em hedged requests, timeouts com resposta parcial ou menos fan-out.',
      },
      {
        type: 'mcq',
        id: 'obs-lat-q4',
        concept: 'Coordinated omission',
        say: 'Agora um relatório de teste de carga que parece bom demais para ser verdade.',
        prompt: 'O teste de carga usou **10 conexões em loop fechado** (cada conexão só envia a próxima requisição depois de receber a resposta). No meio do teste, o servidor ficou **3 s parado** numa pausa de GC. O relatório diz: **p99 = 15 ms, máximo = 3,01 s**. O que você conclui?',
        options: [
          { text: 'O p99 está subestimado por coordinated omission: durante a pausa o gerador parou de enviar, e as requisições que teriam chegado — e esperado segundos — nunca foram medidas', correct: true, why: 'Cada conexão registrou **uma** amostra lenta e ficou esperando. Usuários reais continuariam chegando: centenas de requisições teriam esperado de alguns ms a 3 s, e o p99 real seria de centenas de ms ou mais.' },
          { text: 'O p99 está correto: a pausa foi um evento raro, e o máximo de 3,01 s já a registra', why: 'O máximo registra **uma** requisição lenta, mas o impacto real da pausa foi em todas as que chegariam durante aqueles 3 s. O relatório trata um apagão de 3 s como um único caso isolado.' },
          { text: 'Basta repetir com 100 conexões em loop fechado para o problema desaparecer', why: 'Mais conexões diminuem o erro, mas não o eliminam: cada conexão continua parando de enviar durante a pausa. A correção é o **modelo aberto** (taxa de chegada constante) e medir a partir do horário planejado de envio.' },
          { text: 'O problema é olhar o p99; a mediana tornaria o resultado fiel', why: 'A mediana ignora a cauda por definição — ela esconderia ainda mais a pausa. O problema não é qual percentil olhar, é que as amostras que definiriam a cauda **nunca foram coletadas**.' },
        ],
        explanation: 'É a omissão **coordenada**: o gerador se sincroniza com o sistema e reduz a pressão exatamente quando o sistema está pior. A Lei de Little ajuda a desconfiar: com 10 conexões em loop fechado, vazão × latência média tem de dar 10 — se a vazão despencou durante a pausa, o gerador não estava mantendo a carga planejada. Soluções: gerador de **modelo aberto** (wrk2, k6 `constant-arrival-rate`), latência medida a partir do **horário planejado**, ou a correção do HdrHistogram, que recria as amostras perdidas com base no intervalo esperado.',
      },
      {
        type: 'code',
        id: 'obs-lat-q5',
        concept: 'Lei de Little e coordinated omission',
        title: 'Lei de Little e correção de coordinated omission',
        say: 'Agora as duas ferramentas contra números enganosos: a Lei de Little e a correção do HdrHistogram. Todos os dados são injetados.',
        prompt: `Implemente:

1. \`little(taxa=None, latencia=None, concorrencia=None)\` → recebe **exatamente duas** grandezas e devolve a terceira pela Lei de Little, **L = λ × W** (\`concorrencia = taxa × latencia\`). Unidades: \`taxa\` em req/s, \`latencia\` em segundos, \`concorrencia\` em requisições em voo. Se não vierem exatamente duas, \`ValueError\`. Atenção: **0** é um valor informado, não ausente.
2. \`corrigir_omissao(latencias, intervalo)\` → a correção de coordinated omission do HdrHistogram (\`recordValueWithExpectedInterval\`). \`latencias\` foram medidas por um gerador que deveria enviar uma requisição a cada \`intervalo\` (mesma unidade). Devolva uma **nova** lista em que, logo depois de cada valor \`v\`, entram as amostras que o gerador deixou de enviar enquanto esperava: \`v − intervalo\`, \`v − 2·intervalo\`, … enquanto o valor for **≥ intervalo**. Com \`intervalo <= 0\`, devolva uma cópia sem correção.

Exemplo: \`corrigir_omissao([1, 1, 35, 1], 10)\` → \`[1, 1, 35, 25, 15, 1]\`.`,
        starter: `def little(taxa=None, latencia=None, concorrencia=None):
    """Lei de Little (L = λ × W): recebe duas grandezas e devolve a terceira."""
    pass


def corrigir_omissao(latencias, intervalo):
    """Recria as amostras que o gerador deixou de enviar enquanto esperava respostas lentas."""
    pass
`,
        tests: [
          { name: 'concorrência: 200 req/s × 50 ms', expr: 'little(taxa=200, latencia=0.05)', expected: '10.0', compare: 'approx' },
          { name: 'benchmark: 10 conexões a 1.000 req/s → latência média', expr: 'little(taxa=1000, concorrencia=10)', expected: '0.01', compare: 'approx' },
          { name: 'vazão máxima: 64 workers com 200 ms cada', expr: 'little(latencia=0.2, concorrencia=64)', expected: '320.0', compare: 'approx' },
          {
            name: 'exatamente duas grandezas',
            code: `for kwargs in ({}, {"taxa": 1}, {"taxa": 1, "latencia": 1, "concorrencia": 1}):
    try:
        little(**kwargs)
    except ValueError:
        pass
    else:
        raise AssertionError(f"little(**{kwargs}) deveria levantar ValueError")`,
          },
          { name: 'exemplo do enunciado', expr: 'corrigir_omissao([1, 1, 35, 1], 10)', expected: '[1, 1, 35, 25, 15, 1]' },
          { name: 'limite: continua enquanto o valor for ≥ intervalo', expr: 'corrigir_omissao([10, 20, 9], 10)', expected: '[10, 20, 10, 9]' },
          { name: 'sem lentidão, nada muda', expr: 'corrigir_omissao([3, 1, 4, 1, 5], 10)', expected: '[3, 1, 4, 1, 5]' },
          {
            name: 'uma trava de 10 s: o p99 sai de 1 ms para ~8,9 s',
            code: `import math
medidas = [1] * 9999 + [10_000]          # ms; o gerador queria enviar a cada 10 ms
corrigidas = corrigir_omissao(medidas, 10)
assert len(corrigidas) == 10_999, f"esperadas 10.999 amostras (999 recriadas); vieram {len(corrigidas)}"
def p99(xs):
    ordenadas = sorted(xs)
    return ordenadas[math.ceil(len(ordenadas) * 99 / 100) - 1]
assert p99(medidas) == 1, "o p99 medido é 1 ms"
assert p99(corrigidas) == 8910, f"o p99 corrigido deveria ser 8910 ms; veio {p99(corrigidas)}"`,
          },
          {
            name: 'zero é um valor informado, não ausente',
            hidden: true,
            code: `assert little(taxa=0, latencia=0.5) == 0, "taxa 0 → nada em voo"
assert little(concorrencia=0, taxa=100) == 0, "nada em voo → latência 0"
try:
    little(taxa=0)
except ValueError:
    pass
else:
    raise AssertionError("little(taxa=0) tem só uma grandeza: ValueError")`,
          },
          {
            name: 'intervalo inválido e lista vazia',
            hidden: true,
            code: `assert corrigir_omissao([50, 7], 0) == [50, 7], "intervalo 0: sem correção (e sem laço infinito)"
assert corrigir_omissao([50, 7], -5) == [50, 7], "intervalo negativo: sem correção"
assert corrigir_omissao([], 10) == []`,
          },
          {
            name: 'devolve uma lista nova',
            hidden: true,
            code: `dados = [1, 30, 2]
novo = corrigir_omissao(dados, 10)
assert dados == [1, 30, 2], f"a lista original foi alterada: {dados}"
assert novo == [1, 30, 20, 10, 2]
dados2 = [1, 2]
assert corrigir_omissao(dados2, 10) is not dados2, "devolva uma lista nova, mesmo sem correção"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /if\s+not\s+(taxa|latencia|concorrencia)\b/.test(code) || /\b(taxa|latencia|concorrencia)\s+or\b/.test(code),
            text: 'Cuidado com o teste de "verdade": `if not taxa` trata **0** como ausente, e `little(taxa=0, latencia=0.5)` vira erro em vez de `0`. Para parâmetros opcionais, compare com `None` explicitamente: `taxa is None`.',
            concept: 'None × valores falsy',
          },
          {
            when: m => m.whileTrue,
            text: 'Um `while True` com `break` funciona, mas a condição de parada fica escondida no meio do corpo. Aqui ela é simples e cabe no cabeçalho: `while faltante >= intervalo:`.',
            concept: 'Laços com condição explícita',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função acumulou decisões demais. Em `little`, conte quantas grandezas vieram e resolva a que falta com três `return`s simples; em `corrigir_omissao`, um `for` com um `while` de recriação basta.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Em `little`: `informadas = sum(v is not None for v in (taxa, latencia, concorrencia))`; se for diferente de 2, `ValueError`. Depois: sem concorrência → `taxa * latencia`; sem latência → `concorrencia / taxa`; sem taxa → `concorrencia / latencia`.',
          'Em `corrigir_omissao`: para cada `v`, adicione `v` e, se `intervalo > 0`, faça `faltante = v - intervalo` e, `while faltante >= intervalo`, adicione `faltante` e subtraia `intervalo`.',
          'Confira com o exemplo: `35` com intervalo `10` recria `25` e `15` (o próximo seria `5`, menor que o intervalo — ela teria sido enviada de qualquer jeito).',
        ],
        solution: `def little(taxa=None, latencia=None, concorrencia=None):
    """Lei de Little (L = λ × W): recebe duas grandezas e devolve a terceira."""
    informadas = sum(v is not None for v in (taxa, latencia, concorrencia))
    if informadas != 2:
        raise ValueError("informe exatamente duas grandezas")
    if concorrencia is None:
        return taxa * latencia
    if latencia is None:
        return concorrencia / taxa
    return concorrencia / latencia


def corrigir_omissao(latencias, intervalo):
    """Recria as amostras que o gerador deixou de enviar enquanto esperava respostas lentas."""
    corrigidas = []
    for valor in latencias:
        corrigidas.append(valor)
        if intervalo <= 0:
            continue
        faltante = valor - intervalo
        while faltante >= intervalo:
            corrigidas.append(faltante)
            faltante -= intervalo
    return corrigidas
`,
        solutionExplanation: '`little` resolve a mesma equação nos três sentidos, e cada um é uma pergunta do dia a dia: "quantos workers preciso?" (L = λW), "qual deveria ser a latência média deste benchmark?" (W = L/λ) e "qual a vazão máxima deste pool?" (λ = L/W). O detalhe `is None` importa: taxa zero é um dado legítimo, não ausência de dado. `corrigir_omissao` é a ideia do HdrHistogram: se o gerador deveria enviar a cada 10 ms e uma resposta levou 10 s, então ~999 requisições **deveriam** ter sido enviadas durante a espera, e cada uma teria esperado um pouco menos que a anterior (9.990 ms, 9.980 ms, …). Recriá-las muda o p99 de **1 ms para ~8,9 s** — o valor que usuários chegando a 100/s teriam sentido. É uma aproximação feita depois do fato; o ideal continua sendo gerar carga em **modelo aberto** e medir a partir do horário planejado. E, assim como no resto da trilha, nada de relógio real: as latências e o intervalo chegam como dados, e o mesmo código serve para testes, para reprocessar resultados antigos e para produção.',
      },
      {
        type: 'open',
        id: 'obs-lat-q6',
        concept: 'Tail latency',
        say: 'Para fechar: convença o time de que o dashboard está mentindo.',
        prompt: 'O serviço de busca consulta **50 shards em paralelo** e só responde quando todos respondem. Cada shard tem p50 de 8 ms e p99 de 400 ms, e o dashboard mostra **latência média por shard de 12 ms**. O time acha que está tudo bem. Explique o que o usuário realmente sente e o que você faria.',
        rubric: [
          { label: 'Explica que o usuário espera o shard mais lento', keywords: ['mais lento', 'mais lenta', 'o pior', 'maximo', 'max(', 'espera todos', 'esperar todos', 'todos os 50', 'todos os shards', 'o ultimo', 'a ultima'], concept: 'Fan-out', why: 'Com fan-out, a latência percebida é o **máximo** das chamadas paralelas, não a latência típica de cada uma.' },
          { label: 'Estima a chance de pegar a cauda (1 − 0,99ⁿ)', keywords: ['0,99^', '0.99^', '0,99 elevado', '0.99 elevado', '1 - 0,99', '1 - 0.99', '1 − 0,99', '39%', '40%', '39,5', '4 em cada 10', 'probabilidade', 'chance'], concept: 'Tail latency', why: 'Com 50 chamadas, 1 − 0,99⁵⁰ ≈ 40% das buscas incluem pelo menos um shard no p99: a cauda do shard vira experiência comum.' },
          { label: 'Mostra que a média esconde a cauda e propõe medir percentis', keywords: [['media', 'escond'], ['media', 'engan'], ['media', 'ment'], ['media', 'nao mostra'], 'cauda', 'tail', 'percentil', 'p99'], concept: 'A média mente', why: 'A média por shard não enxerga a cauda nem o efeito do fan-out; o indicador certo é o percentil da latência **percebida**, medida no serviço que agrega.' },
          { label: 'Propõe mitigações para a cauda', keywords: ['hedg', 'duplicad', 'copia', 'replica', 'timeout', 'parcia', 'reduzir o fan', 'diminuir o fan', 'menos shards', 'tied', 'backup request', 'garbage', 'gc'], concept: 'Hedged requests', why: 'Hedged/tied requests, timeouts com resultado parcial, menos fan-out e atacar as causas (GC, filas) reduzem a cauda percebida.' },
        ],
        minWords: 40,
        modelAnswer: 'O usuário não sente a média de cada shard: como a busca espera **todos os 50 shards**, a latência percebida é a do **mais lento** — o máximo das 50 respostas. A chance de pelo menos um shard cair no seu p99 é 1 − 0,99^50 ≈ 40%, ou seja, cerca de 4 em cada 10 buscas levam 400 ms ou mais, mesmo com a média de 12 ms parecendo ótima: a média **esconde** a cauda. Eu passaria a medir o p99 da latência percebida no serviço de busca (não só por shard), com histogramas, e atacaria a cauda: **hedged requests** (uma cópia para outra réplica quando a primeira passa do p95), **timeout** com resultados parciais (responder com 49 shards), reduzir o fan-out e investigar as causas das pausas nos shards, como GC e filas.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Você nunca mais vai aceitar "a latência média está ótima" como resposta.',
          { text: 'Percentis, fan-out, coordinated omission e Lei de Little: agora você mede a cauda sem se enganar — e sabe por que ela importa.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
