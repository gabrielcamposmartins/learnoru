Game.registerModule('apis', {
  id: 'rate-limiting',
  title: 'Rate Limiting',
  kind: 'lesson',
  level: 3,
  order: 20,
  unit: 'confiabilidade',
  summary: 'Quem pode chamar sua API, quanto e com que rapidez: janela fixa e o furo da borda, sliding window, token e leaky bucket, o pouco conhecido GCRA, 429 + Retry-After e limites distribuídos com Redis.',
  concepts: ['Token bucket', 'Sliding window counter', 'GCRA', '429 + Retry-After', 'Rate limiting distribuído'],
  takeaways: [
    'Rate limiting protege **capacidade**, **custo** e **justiça** entre clientes: limite por chave, usuário, IP e rota, com um teto global por trás. *Throttling* controla a taxa; *quota*, o volume do plano.',
    'A **janela fixa** é barata, mas deixa passar até **2×** o limite na virada; o **sliding window counter** fecha o furo com dois contadores e uma média ponderada.',
    '**Token bucket** aceita rajadas até a capacidade; **leaky bucket** entrega ritmo constante; o **GCRA** faz o papel do balde guardando **um único timestamp** (o TAT).',
    'Barrou? Responda **429** com `Retry-After` e cabeçalhos de quota restante — e, do lado do cliente, respeite-os.',
    'Com várias réplicas, o contador precisa ser **compartilhado e atômico** (Redis com `MULTI`/Lua e o índice da janela na chave) — e decida antes se o limitador falha **aberto** ou **fechado**.',
  ],
  glossary: [
    { term: 'Token bucket', aliases: ['token buckets', 'balde de fichas'], definition: 'Algoritmo de rate limiting: um balde de capacidade **C** ganha fichas a uma taxa fixa, e cada requisição gasta uma. Balde vazio → recusa. Permite rajadas de até C requisições mantendo a taxa média.' },
    { term: 'Leaky bucket', aliases: ['leaky buckets', 'balde furado'], definition: 'Algoritmo em que as requisições entram numa fila de tamanho fixo que "vaza" a uma taxa constante: a saída sai lisa, sem rajadas. Fila cheia → recusa. O `limit_req` do NGINX usa essa ideia.' },
    { term: 'Sliding window counter', aliases: ['janela deslizante com contadores'], definition: 'Rate limiting que estima as requisições dos últimos N segundos somando o contador da janela fixa atual ao da anterior, ponderado pela fração que ainda se sobrepõe. Memória O(1) por cliente e sem o furo da borda da janela fixa.' },
    { term: 'GCRA', aliases: ['Generic Cell Rate Algorithm'], definition: '*Generic Cell Rate Algorithm*: rate limiting equivalente a um leaky bucket, mas que guarda **um único timestamp** por cliente — o TAT (*theoretical arrival time*). Veio das redes ATM e aparece no módulo redis-cell.' },
    { term: 'Retry-After', aliases: ['Retry After'], definition: 'Cabeçalho HTTP que diz **quando** tentar de novo: em segundos (`Retry-After: 30`) ou como data HTTP. Acompanha respostas `429` e `503` — e um cliente educado obedece.' },
    { term: 'Quota', aliases: ['quotas', 'cota', 'cotas'], definition: 'Limite de **volume** num período longo (ex.: 100 mil chamadas/mês), ligado ao plano e à cobrança. Diferente do *throttling*, que limita a **taxa** de curto prazo (ex.: 10 req/s) para proteger a infraestrutura.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje vamos colocar um porteiro na frente da API: o **rate limiter**. Ele decide quem entra, quanto e com que rapidez.',
        'Sem ele, um único cliente com um loop mal escrito derruba o serviço para **todo mundo** — e às vezes esse cliente é o seu próprio app.',
      ],
      board: {
        title: 'Por que limitar?',
        md: `| Motivo | Sem limite… |
|---|---|
| **Proteger a capacidade** | um script com \`while True\` manda 5 mil req/s e derruba a API para todos |
| **Justiça entre clientes** | um *noisy neighbor* consome a capacidade que era de todo mundo |
| **Custo** | cada chamada gasta dinheiro de verdade: GPU, SMS, API paga de terceiros |
| **Segurança** | força bruta no \`/login\`, *credential stuffing*, *scraping* do catálogo |
| **Produto** | o plano free e o pro viram a mesma coisa |

O limitador fica na **borda** — API gateway, *reverse proxy* ou um middleware logo na entrada —, antes de qualquer trabalho caro (banco, chamadas externas). Recusar tem que ser **muito mais barato** que atender.

**Throttling × quota** — dois limites que convivem:

| | Throttling (taxa) | Quota (volume) |
|---|---|---|
| Horizonte | segundos, minutos | dia, mês |
| Protege | a infraestrutura | o contrato: plano e cobrança |
| Exemplo | 10 req/s por chave | 100 mil chamadas/mês no plano pro |
| Ao estourar | \`429\` + \`Retry-After\` de segundos | \`429\` até virar o período — ou cobrança do excedente |

> [!dica] Ter quota sobrando não dá direito de gastá-la num segundo: o plano pro pode ter **quota** de 1 milhão de chamadas por mês **e** throttling de 50 req/s.`,
      },
    },
    {
      type: 'say',
      text: [
        'O algoritmo mais simples é a **janela fixa**: um contador por minuto do relógio, zerado na virada.',
        'Barato e fácil de explicar. Mas repare no que acontece bem na **borda** entre dois minutos.',
      ],
      board: {
        title: 'Fixed window e o furo da borda',
        md: `\`\`\`python
class JanelaFixa:
    """Um contador por janela do relógio: [0, 60), [60, 120), ..."""

    def __init__(self, limite, janela, relogio):
        self.limite, self.janela, self._relogio = limite, janela, relogio
        self._indice, self._contagem = None, 0

    def permitir(self):
        indice = int(self._relogio() // self.janela)   # em qual janela estamos?
        if indice != self._indice:                     # virou: zera o contador
            self._indice, self._contagem = indice, 0
        if self._contagem < self.limite:
            self._contagem += 1
            return True
        return False
\`\`\`

Um número por cliente e fácil de pôr no Redis. O problema está na **virada** da janela:

\`\`\`text
 limite: 100 por minuto

 ──── janela 12:00 ──────────────────┬──── janela 12:01 ──────────────────
                            100 req  │  100 req
                           12:00:59  │  12:01:00
                         └─ 200 aceitas em ~2 s ─┘
\`\`\`

O limite vale por **minuto do relógio**, não por "quaisquer 60 segundos". Na virada, o cliente gasta o limite **duas vezes seguidas**: até **2×** a taxa prometida, justamente num pico.

> [!atencao] Janelas alinhadas ao relógio têm um segundo efeito colateral: **todos** os clientes bloqueados são liberados no mesmo instante (12:01:00) e voltam juntos — um pico sincronizado a cada minuto.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Para fechar o furo, a janela precisa **deslizar**: contar sempre os últimos 60 segundos, não o minuto do relógio.',
        'O jeito exato guarda um timestamp por requisição. O jeito esperto guarda **dois números** e faz uma média ponderada.',
      ],
      board: {
        title: 'Sliding window: log × contador',
        md: `**Sliding window log** — guarda o horário de **cada** requisição aceita e conta as dos últimos 60 s. É exato, mas a memória é O(limite) por cliente: com limite de 10 mil por hora e 1 milhão de chaves, são bilhões de timestamps. (No Redis: um *sorted set* com \`ZADD\`, \`ZREMRANGEBYSCORE\` e \`ZCARD\`.)

**Sliding window counter** — guarda só **dois contadores** (janela anterior e atual) e supõe que as requisições da anterior estavam espalhadas **por igual**:

\`\`\`text
 janela anterior: 42 aceitas     janela atual: 18 até agora
 ├──────┬──────────────────────┼──────┬──────────────────────┤
 0 s   15 s                   60 s   75 s                120 s
        └── últimos 60 s até agora ───┘
        └─ 45 s (75%) ─────────┴ 15 s ┘

 estimativa = 42 × 0,75 + 18 = 49,5    →   limite 50: ainda passa
\`\`\`

\`\`\`python
def estimativa(anterior, atual, decorrido, janela):
    peso = 1 - decorrido / janela      # fração da janela anterior que ainda "conta"
    return anterior * peso + atual     # 42 * (1 - 15/60) + 18 = 49.5
\`\`\`

É uma **aproximação** (a anterior pode ter concentrado tudo no começo ou no fim), mas custa O(1) por cliente e acaba com o "2× na virada".

> [!sabia] Essa é a técnica que a Cloudflare descreveu para o rate limiting dela, em 2017: numa análise de cerca de 400 milhões de requisições, só **0,003%** foram liberadas ou barradas indevidamente pela aproximação — com dois contadores por cliente em vez de uma lista de timestamps.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora os dois baldes clássicos. No **token bucket**, fichas pingam no balde a uma taxa fixa, e cada requisição leva uma.',
        'No **leaky bucket**, as requisições entram numa fila que escoa em ritmo constante. Um aceita rajadas; o outro as alisa.',
      ],
      board: {
        title: 'Token bucket × leaky bucket',
        md: `\`\`\`text
    TOKEN BUCKET                               LEAKY BUCKET (fila)

   fichas entram a 2/s                    requisições chegam em rajadas
          │                                       ▼ ▼ ▼
     ┌────▼────┐                             ┌─────────────┐
     │ ● ● ● ● │  capacidade = 5             │ ▒▒▒▒▒▒▒▒▒▒▒ │  fila de tamanho fixo
     └────┬────┘  (a maior rajada)           └──────┬──────┘  cheia? recusa (429)
          ▼                                         ▼
   cada requisição leva 1 ficha             saem em ritmo CONSTANTE:
   sem ficha? recusa (429)                  1 a cada 100 ms, sem rajadas
\`\`\`

O token bucket **não precisa de timer**: as fichas são calculadas na hora, a partir do tempo que passou.

\`\`\`python
# reabastecimento "preguiçoso": uma conta, O(1), com frações de ficha
fichas = min(capacidade, fichas + (agora - ultimo) * taxa)
\`\`\`

| | Token bucket | Leaky bucket (fila) |
|---|---|---|
| Rajadas | aceitas, até a capacidade | absorvidas na fila, mas liberadas **devagar** |
| Saída | irregular: acompanha a entrada | constante |
| Latência | nenhuma extra: passa ou não passa | a fila **adiciona espera** |
| Bom para | APIs públicas: o cliente "gasta a economia" | proteger quem só aguenta ritmo fixo (ex.: um provedor de SMS) |
| Onde aparece | AWS API Gateway (*rate* + *burst*), rate limit local do Envoy | \`limit_req\` do NGINX (\`rate\`, \`burst\`, \`nodelay\`) |

> [!atencao] "Leaky bucket" tem **dois** sentidos na literatura: como **fila** (suaviza a saída, como acima) e como **medidor** (só decide aceitar ou recusar). Como medidor, ele é o espelho do token bucket: com os mesmos parâmetros, toma exatamente as mesmas decisões.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora um algoritmo que quase ninguém conhece: o **GCRA**, *Generic Cell Rate Algorithm*.',
        'Ele toma as mesmas decisões do balde guardando **um único número** por cliente: o horário em que a próxima requisição "deveria" chegar.',
      ],
      board: {
        title: 'GCRA: um timestamp e pronto',
        md: `Parâmetros: taxa \`r\` → **intervalo** \`T = 1/r\` entre requisições; rajada \`b\` → **tolerância** \`τ = T × (b − 1)\`.
O estado é o **TAT** (*theoretical arrival time*): quando a próxima requisição chegaria se o cliente seguisse a taxa certinho.

\`\`\`python
class GCRA:
    def __init__(self, taxa, rajada, relogio):
        self.T = 1 / taxa                        # intervalo "ideal" entre requisições
        self.tau = self.T * (rajada - 1)         # quanto o cliente pode se adiantar
        self._relogio = relogio
        self.tat = 0.0                           # o ÚNICO estado por cliente

    def permitir(self):
        agora = self._relogio()
        tat = max(self.tat, agora)
        if tat - agora > self.tau:               # adiantou demais: recusa
            return False, tat - agora - self.tau  # ...e o Retry-After exato
        self.tat = tat + self.T
        return True, 0.0
\`\`\`

Com taxa de 1/s e rajada 3 (\`T = 1\`, \`τ = 2\`):

| t | TAT antes | TAT − t | Decisão | TAT depois |
|---|---|---|---|---|
| 0 | 0 | 0 | ✅ passa | 1 |
| 0 | 1 | 1 | ✅ passa | 2 |
| 0 | 2 | 2 | ✅ passa (= τ) | 3 |
| 0 | 3 | 3 > τ | ❌ \`Retry-After: 1\` | 3 |
| 1 | 3 | 2 | ✅ passa | 4 |

> [!sabia] O GCRA vem das redes **ATM** dos anos 90, onde policiava o ritmo das "células" de 53 bytes. Hoje aparece no módulo **redis-cell** (comando \`CL.THROTTLE\`) e na biblioteca Go **throttled**. Guardar um só número por cliente o torna perfeito para o Redis — e o \`Retry-After\` exato vem de brinde. Matematicamente, é o leaky bucket como medidor com outra roupa.`,
      },
    },
    {
      type: 'say',
      text: [
        'Barrou? Então responda direito: **429 Too Many Requests**, dizendo **quando** o cliente pode voltar.',
        'E um bom limitador avisa **antes** de estourar: cabeçalhos com a quota restante deixam o cliente desacelerar sozinho.',
      ],
      board: {
        title: 'Como dizer "calma" em HTTP',
        md: `\`\`\`http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 17
RateLimit-Policy: "por-chave";q=100;w=60
RateLimit: "por-chave";r=0;t=17

{"type": "https://api.loja.dev/erros/limite", "title": "Limite de requisições excedido", "status": 429, "detail": "100 requisições por minuto por chave. Tente de novo em 17 s."}
\`\`\`

| Cabeçalho | O que diz |
|---|---|
| \`Retry-After\` | quando tentar de novo: segundos (\`17\`) ou data HTTP — padrão desde o HTTP/1.1 |
| \`X-RateLimit-Limit\`, \`-Remaining\`, \`-Reset\` | a família "de fato" (GitHub e muitas outras); o \`Reset\` ora é *epoch*, ora segundos — confuso! |
| \`RateLimit-Policy\` e \`RateLimit\` | rascunho da IETF para padronizar: a política (\`q\` = quota, \`w\` = janela em s) e o estado (\`r\` = restante, \`t\` = segundos até renovar) |

**429 × 503:** \`429\` = "**você** passou do seu limite"; \`503\` = "**eu** estou sobrecarregado" (load shedding). Os dois combinam com \`Retry-After\`.

Do lado do **cliente**: leia o \`Retry-After\` em vez de martelar, e acompanhe o \`Remaining\` para desacelerar **antes** do 429.

> [!sabia] O status **429** só entrou no HTTP em 2012, na RFC 6585. Antes disso, a API do Twitter respondia a quem abusava com um **420 Enhance Your Calm** ("acalme-se") — um código que nunca existiu em padrão nenhum.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Limitar **o quê**? Por chave de API, por usuário, por IP, por rota — e ainda um teto global. A requisição precisa passar por **todas** as camadas.',
        'E com várias réplicas atrás do balanceador, o contador precisa ser **compartilhado**. Senão, cada réplica deixa passar o limite inteiro.',
      ],
      board: {
        title: 'Chaves, camadas e o limitador distribuído',
        md: `| Chave do limite | Protege contra | Cuidado |
|---|---|---|
| **API key / cliente** | cliente abusivo; é a base dos planos | chave vazada vira o limite de outra pessoa |
| **Usuário** | um usuário com vários tokens | exige autenticar antes de contar |
| **IP** | anônimos e força bruta no \`/login\` | CGNAT e redes corporativas: milhares de pessoas atrás de **um** IP |
| **Rota / custo** | endpoints caros (\`/relatorios\`) | dê "peso" por requisição: busca = 1, exportação = 50 |
| **Global** | o serviço inteiro | é a última linha de defesa — já é quase *load shedding* |

\`\`\`text
 3 réplicas, limite de 100/min, contador LOCAL em cada uma:

   cliente ──▶ LB ─┬──▶ réplica A (100/min)
                   ├──▶ réplica B (100/min)    → o cliente consegue até 300/min
                   └──▶ réplica C (100/min)
\`\`\`

Contador **compartilhado** no Redis (janela fixa), com os dois comandos numa transação:

\`\`\`python
def permitir(redis, cliente, agora, limite=100, janela=60):
    chave = f"rl:{cliente}:{int(agora // janela)}"   # o ÍNDICE da janela no nome
    pipe = redis.pipeline()                          # MULTI/EXEC: tudo ou nada
    pipe.incr(chave)                                 # INCR é atômico: 1, 2, 3...
    pipe.expire(chave, janela * 2)                   # a chave velha some sozinha
    contagem, _ = pipe.execute()
    return contagem <= limite
\`\`\`

Com o índice no nome, cada janela usa uma chave **nova**: se um \`EXPIRE\` se perdesse, sobraria só lixo na memória — ninguém ficaria bloqueado. Para token bucket ou GCRA no Redis, o padrão é um **script Lua**, que o Redis executa de forma atômica.

> [!atencao] E se o Redis cair? **Fail open** (deixar passar) preserva a disponibilidade; **fail closed** (recusar tudo) preserva a proteção. O comum é falhar aberto com um limitador **local** de reserva (limite ÷ réplicas) — mas no \`/login\` talvez valha falhar fechado.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um token bucket e uma janela deslizante de verdade, com relógio injetado.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'api-rl-q1',
      concept: 'Fixed window e a borda',
      say: 'Primeira: vamos ver se o furo da janela fixa ficou claro.',
      prompt: 'Sua API limita cada chave a **100 requisições por minuto** com **janela fixa** (o contador zera a cada minuto cheio do relógio). Qual o **máximo** de requisições que um cliente consegue ter aceitas num intervalo de **2 segundos**?',
      options: [
        { text: '200 — 100 no último segundo de um minuto e mais 100 no primeiro segundo do minuto seguinte', correct: true, why: 'É o furo da borda: a janela fixa só olha o minuto do relógio, então duas janelas cheias podem ficar coladas na virada.' },
        { text: '100 — o limite é por minuto, e 2 segundos cabem dentro de um minuto', why: 'Valeria para uma janela **deslizante**. A fixa zera o contador na virada do minuto, e um intervalo de 2 s pode atravessar essa virada.' },
        { text: '101 — o contador só percebe o excesso depois que a 101ª requisição já passou', why: 'Um contador bem feito checa **antes** de aceitar. O furo real é bem maior: o dobro do limite.' },
        { text: 'Depende de quantas réplicas estão atrás do balanceador', why: 'Contadores locais por réplica pioram tudo (multiplicam o limite), mas a pergunta é sobre o algoritmo com um contador único — e ele sozinho já deixa passar 200.' },
      ],
      explanation: 'Na janela fixa, o limite vale por **janela do relógio**, não por "quaisquer 60 segundos". Na virada, o cliente gasta o limite inteiro duas vezes seguidas: até **2×** a taxa prometida em poucos segundos. O **sliding window counter** fecha o furo com a média ponderada; o **token bucket** e o **GCRA** limitam qualquer rajada à capacidade do balde.',
    },
    {
      type: 'match',
      id: 'api-rl-q2',
      concept: 'Algoritmos de rate limiting',
      say: 'Agora associe cada algoritmo à característica que o define.',
      prompt: 'Associe cada **algoritmo** de rate limiting à sua **característica**.',
      pairs: [
        { left: 'Fixed window', right: 'Um contador por janela do relógio; na virada, deixa passar até o dobro' },
        { left: 'Sliding window log', right: 'Guarda o horário de cada requisição: exato, mas memória O(limite)' },
        { left: 'Sliding window counter', right: 'Pondera a janela anterior pela sobreposição: memória O(1), quase exato' },
        { left: 'Token bucket', right: 'Fichas repostas a taxa fixa; aceita rajadas até a capacidade' },
        { left: 'Leaky bucket', right: 'Fila que escoa em ritmo constante: saída suave, sem rajadas' },
        { left: 'GCRA', right: 'Guarda só o horário teórico da próxima chegada (TAT)' },
      ],
      explanation: 'Todos respondem "passa ou não passa", mas trocam **precisão**, **memória** e **tolerância a rajadas**. Na prática: token bucket (ou GCRA) quando rajadas curtas são bem-vindas; leaky bucket quando quem está atrás só aguenta ritmo constante; sliding window counter quando você quer limites "por minuto" sem o furo da borda e com memória mínima.',
    },
    {
      type: 'code',
      id: 'api-rl-q3',
      concept: 'Token bucket',
      title: 'Token bucket com relógio injetado',
      say: 'Hora de construir o seu token bucket. O relógio é injetado: os testes viajam no tempo sem esperar nada.',
      prompt: `Implemente \`TokenBucket(capacidade, taxa, relogio)\`. \`taxa\` é quantas fichas entram **por segundo**; \`relogio()\` devolve o "agora" em segundos — nos testes, um relógio falso que a gente avança na mão.

- O balde começa **cheio** (\`capacidade\` fichas) e **nunca** passa da capacidade.
- \`permitir(custo=1)\`: se houver fichas suficientes, gasta \`custo\` fichas e devolve \`True\`; senão devolve \`False\` **sem gastar nada**.
- \`espera(custo=1)\`: quantos segundos faltam para haver \`custo\` fichas — \`0.0\` se já houver. É o valor que iria no \`Retry-After\`.
- Reabastecimento **preguiçoso**: nada de timer. A cada chamada, veja quanto tempo passou desde a última e credite \`decorrido * taxa\` fichas — **frações contam**.`,
      starter: `import time


class TokenBucket:
    def __init__(self, capacidade, taxa, relogio=time.monotonic):
        self.capacidade = capacidade
        self.taxa = taxa              # fichas por segundo
        self._relogio = relogio

    def permitir(self, custo=1):
        # TODO: reabastecer e, se houver fichas, gastar \`custo\`
        pass

    def espera(self, custo=1):
        # TODO: segundos até haver \`custo\` fichas (0.0 se já houver)
        pass
`,
      tests: [
        {
          name: 'começa cheio: libera uma rajada do tamanho da capacidade',
          code: `agora = [0.0]
tb = TokenBucket(capacidade=3, taxa=1, relogio=lambda: agora[0])
resultados = [tb.permitir() for _ in range(4)]
assert resultados == [True, True, True, False], f"com 3 fichas: esperado [True, True, True, False], veio {resultados}"`,
        },
        {
          name: 'reabastece conforme o tempo passa',
          code: `agora = [0.0]
tb = TokenBucket(capacidade=2, taxa=2, relogio=lambda: agora[0])
assert tb.permitir() and tb.permitir(), "o balde deveria começar cheio (2 fichas)"
assert not tb.permitir(), "sem fichas, deveria recusar"
agora[0] = 0.5
assert tb.permitir(), "0.5 s a 2 fichas/s = 1 ficha: deveria liberar"
assert not tb.permitir(), "só 1 ficha foi reposta: a segunda deveria ser recusada"`,
        },
        {
          name: 'nunca passa da capacidade',
          code: `agora = [0.0]
tb = TokenBucket(capacidade=3, taxa=10, relogio=lambda: agora[0])
agora[0] = 1000.0
aceitas = sum(tb.permitir() for _ in range(10))
assert aceitas == 3, f"depois de muito tempo parado, a maior rajada é a capacidade (3); aceitou {aceitas}"`,
        },
        {
          name: 'custo maior que 1 — e recusar não gasta fichas',
          code: `agora = [0.0]
tb = TokenBucket(capacidade=5, taxa=1, relogio=lambda: agora[0])
assert tb.permitir(custo=4), "com 5 fichas, uma operação de custo 4 deveria passar"
assert not tb.permitir(custo=2), "sobrou 1 ficha: custo 2 deveria ser recusado"
assert tb.permitir(custo=1), "a recusa não pode gastar fichas: a ficha restante ainda deveria estar lá"`,
        },
        {
          name: 'espera() calcula o Retry-After',
          code: `import math
agora = [0.0]
tb = TokenBucket(capacidade=2, taxa=4, relogio=lambda: agora[0])
assert tb.espera() == 0, f"balde cheio: a espera deveria ser 0, veio {tb.espera()}"
tb.permitir()
tb.permitir()
assert math.isclose(tb.espera(), 0.25), f"sem fichas, a 4 fichas/s, falta 0.25 s para 1 ficha; veio {tb.espera()}"
assert math.isclose(tb.espera(custo=2), 0.5), f"para 2 fichas a 4/s faltam 0.5 s; veio {tb.espera(custo=2)}"
agora[0] = 0.125
assert math.isclose(tb.espera(), 0.125), f"com meia ficha reposta, falta 0.125 s; veio {tb.espera()}"
assert not tb.permitir(), "com meia ficha, permitir() ainda deveria recusar"`,
        },
        {
          name: 'frações de ficha não se perdem',
          hidden: true,
          code: `agora = [0.0]
tb = TokenBucket(capacidade=5, taxa=2, relogio=lambda: agora[0])
for _ in range(5):
    tb.permitir()
agora[0] = 0.75
assert tb.permitir(), "0.75 s a 2 fichas/s = 1.5 ficha: deveria liberar uma"
agora[0] = 1.0
assert tb.permitir(), "a meia ficha que sobrou + 0.25 s a 2/s = 1 ficha: as frações não podem ser descartadas"
assert not tb.permitir(), "depois disso o balde deveria estar vazio"`,
        },
        {
          name: 'recusas no meio do caminho não atrasam o reabastecimento',
          hidden: true,
          code: `agora = [0.0]
tb = TokenBucket(capacidade=2, taxa=1, relogio=lambda: agora[0])
tb.permitir()
tb.permitir()
for t in (0.25, 0.5, 0.75):
    agora[0] = t
    assert not tb.permitir(), f"em t={t} ainda não há uma ficha inteira"
agora[0] = 1.0
assert tb.permitir(), "em t=1.0, a 1 ficha/s, deveria haver 1 ficha — mesmo com recusas no meio"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('monotonic') || m.calls.includes('perf_counter') || (m.calls.includes('time') && m.imports.includes('time')),
          text: 'Você chamou o relógio do sistema dentro da lógica. Use sempre o `relogio` injetado: é ele que permite testar "meio segundo depois" sem esperar meio segundo — e reproduzir exatamente os instantes de borda.',
          concept: 'Injeção de relógio',
        },
        {
          when: m => m.loops > 0,
          text: 'Reabastecer não precisa de laço nem de timer: uma conta resolve — `fichas = min(capacidade, fichas + decorrido * taxa)`. Assim cada requisição custa O(1), não importa quanto tempo passou desde a última.',
          concept: 'Reabastecimento preguiçoso',
        },
        {
          when: m => m.calls.includes('int') || m.calls.includes('floor'),
          text: 'Cuidado ao arredondar fichas com `int()`/`floor()`: frações de ficha são tempo acumulado. Jogá-las fora faz o balde repor **menos** do que a taxa prometida. Guarde as fichas como `float`.',
          concept: 'Token bucket',
        },
      ],
      hints: [
        'Guarde dois estados: `_fichas` (começa em `capacidade`, como `float`) e `_ultimo` (o `relogio()` do último reabastecimento).',
        'Crie `_reabastecer()`: `agora = self._relogio()`, depois `self._fichas = min(self.capacidade, self._fichas + (agora - self._ultimo) * self.taxa)` e `self._ultimo = agora`. Chame-o no começo de `permitir` e de `espera`.',
        '`permitir`: se `self._fichas >= custo`, subtraia e devolva `True`; senão, `False`. `espera`: `falta = custo - self._fichas`; devolva `0.0` se `falta <= 0`, senão `falta / self.taxa`.',
      ],
      solution: `import time


class TokenBucket:
    def __init__(self, capacidade, taxa, relogio=time.monotonic):
        self.capacidade = capacidade
        self.taxa = taxa              # fichas por segundo
        self._relogio = relogio
        self._fichas = float(capacidade)      # começa cheio
        self._ultimo = relogio()              # instante do último reabastecimento

    def _reabastecer(self):
        agora = self._relogio()
        decorrido = agora - self._ultimo
        self._fichas = min(self.capacidade, self._fichas + decorrido * self.taxa)
        self._ultimo = agora

    def permitir(self, custo=1):
        self._reabastecer()
        if self._fichas >= custo:
            self._fichas -= custo
            return True
        return False

    def espera(self, custo=1):
        self._reabastecer()
        falta = custo - self._fichas
        return 0.0 if falta <= 0 else falta / self.taxa
`,
      solutionExplanation: 'O segredo é o **reabastecimento preguiçoso**: em vez de um timer pingando fichas, cada chamada calcula quanto tempo passou e credita `decorrido * taxa` de uma vez — O(1), sem thread e exato com frações. O `min(...)` impede acumular além da capacidade, que é a maior rajada possível. A recusa não mexe nas fichas, e `espera()` é a conta inversa: fichas que faltam ÷ taxa — exatamente o que vai no `Retry-After` (arredondado para cima, porque o cabeçalho usa segundos inteiros). Num cluster, o mesmo par (`fichas`, `ultimo`) viveria no Redis, atualizado por um script Lua atômico.',
    },
    {
      type: 'code',
      id: 'api-rl-q4',
      concept: 'Sliding window counter',
      title: 'Sliding window counter',
      say: 'Agora a janela deslizante com contadores — a que fecha o furo da borda gastando só dois números.',
      prompt: `Implemente \`JanelaDeslizante(limite, janela, relogio)\` com o algoritmo **sliding window counter**.

- As janelas fixas começam em múltiplos de \`janela\`: com \`janela=60\`, são \`[0, 60)\`, \`[60, 120)\`, \`[120, 180)\`…
- Guarde só o contador da janela **atual** e o da **anterior** (a imediatamente antes dela). Se o relógio pular mais de uma janela, a anterior conta **0**.
- \`estimativa()\` devolve \`anterior * (1 - decorrido / janela) + atual\`, em que \`decorrido\` é quanto tempo passou desde o **início da janela atual**.
- \`permitir()\` libera — e conta — a requisição se \`estimativa() < limite\`; senão devolve \`False\`. Requisições recusadas **não** contam.`,
      starter: `import time


class JanelaDeslizante:
    def __init__(self, limite, janela, relogio=time.monotonic):
        self.limite = limite
        self.janela = janela
        self._relogio = relogio

    def estimativa(self):
        # TODO: anterior * (1 - decorrido / janela) + atual
        pass

    def permitir(self):
        # TODO
        pass
`,
      tests: [
        {
          name: 'dentro da primeira janela, funciona como um contador',
          code: `agora = [0.0]
jd = JanelaDeslizante(limite=3, janela=60, relogio=lambda: agora[0])
resultados = [jd.permitir() for _ in range(4)]
assert resultados == [True, True, True, False], f"limite 3: esperado [True, True, True, False], veio {resultados}"`,
        },
        {
          name: 'fecha o furo da borda',
          code: `agora = [59.0]
jd = JanelaDeslizante(limite=10, janela=60, relogio=lambda: agora[0])
assert all(jd.permitir() for _ in range(10)), "as 10 primeiras deveriam passar"
agora[0] = 60.0
assert jd.estimativa() == 10, f"em t=60 a janela anterior ainda pesa 100%: estimativa 10, veio {jd.estimativa()}"
assert not jd.permitir(), "a janela fixa virou, mas a deslizante ainda vê 10 requisições: deveria recusar"`,
        },
        {
          name: 'a janela anterior perde peso com o tempo',
          code: `agora = [0.0]
jd = JanelaDeslizante(limite=10, janela=60, relogio=lambda: agora[0])
for _ in range(10):
    jd.permitir()
agora[0] = 90.0
assert jd.estimativa() == 5, f"na metade da janela [60, 120): 10 × 0.5 + 0 = 5; veio {jd.estimativa()}"
aceitas = sum(jd.permitir() for _ in range(10))
assert aceitas == 5, f"com estimativa 5 e limite 10, deveriam passar 5; passaram {aceitas}"`,
        },
        {
          name: 'o exemplo do quadro: 42 na anterior, 15 s na atual',
          code: `agora = [10.0]
jd = JanelaDeslizante(limite=50, janela=60, relogio=lambda: agora[0])
for _ in range(42):
    jd.permitir()
agora[0] = 75.0
assert jd.estimativa() == 31.5, f"42 × 0.75 + 0 = 31.5; veio {jd.estimativa()}"
aceitas = sum(jd.permitir() for _ in range(30))
assert aceitas == 19, f"deveriam passar 19 (31.5 + 18 = 49.5 < 50; a próxima daria 50.5); passaram {aceitas}"`,
        },
        {
          name: 'requisições recusadas não contam',
          code: `agora = [0.0]
jd = JanelaDeslizante(limite=2, janela=10, relogio=lambda: agora[0])
jd.permitir()
jd.permitir()
for _ in range(50):
    jd.permitir()
agora[0] = 15.0
assert jd.estimativa() == 1, f"as 50 recusas não deveriam contar: 2 × 0.5 = 1; veio {jd.estimativa()}"
assert jd.permitir(), "com estimativa 1 e limite 2, deveria liberar"`,
        },
        {
          name: 'pular mais de uma janela zera a anterior',
          hidden: true,
          code: `agora = [0.0]
jd = JanelaDeslizante(limite=5, janela=60, relogio=lambda: agora[0])
for _ in range(5):
    jd.permitir()
agora[0] = 130.0
assert jd.estimativa() == 0, f"a janela imediatamente anterior [60, 120) ficou vazia: estimativa 0, veio {jd.estimativa()}"
aceitas = sum(jd.permitir() for _ in range(6))
assert aceitas == 5, f"deveriam passar 5; passaram {aceitas}"`,
        },
        {
          name: 'relógio que não começa em zero e várias viradas seguidas',
          hidden: true,
          code: `agora = [1000.0]
jd = JanelaDeslizante(limite=4, janela=100, relogio=lambda: agora[0])
assert sum(jd.permitir() for _ in range(6)) == 4, "na janela [1000, 1100) deveriam passar 4"
agora[0] = 1150.0
assert sum(jd.permitir() for _ in range(6)) == 2, "em t=1150: 4 × 0.5 = 2, então passam 2"
agora[0] = 1275.0
assert jd.estimativa() == 0.5, f"em t=1275: 2 × 0.25 + 0 = 0.5; veio {jd.estimativa()}"
assert sum(jd.permitir() for _ in range(6)) == 4, "com estimativa 0.5, passam 4 (0.5 + 3 = 3.5 < 4)"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('monotonic') || m.calls.includes('perf_counter') || (m.calls.includes('time') && m.imports.includes('time')),
          text: 'Você chamou o relógio do sistema dentro da lógica. Use o `relogio` injetado: é ele que permite testar a virada da janela e o peso da anterior em instantes exatos.',
          concept: 'Injeção de relógio',
        },
        {
          when: m => m.calls.includes('append') || m.names.includes('deque'),
          text: 'Guardar um timestamp por requisição é o *sliding window log*: exato, mas com memória O(limite) por cliente. O sliding window counter precisa de **dois contadores** e do índice da janela — é essa economia que faz ele escalar para milhões de chaves.',
          concept: 'Sliding window counter',
        },
        {
          when: m => m.maxComplexity > 8,
          text: 'Algum método ficou com muitos caminhos. Extraia a virada da janela para um `_girar(agora)`: ele decide se a atual vira a anterior (janela vizinha) ou se a anterior zera (salto maior). O resto vira uma conta.',
          concept: 'Coesão',
        },
      ],
      hints: [
        'Descubra em qual janela fixa o `agora` cai: `indice = int(agora // janela)`. Guarde `_indice`, `_atual` e `_anterior`.',
        'Quando o índice mudar: se o novo for exatamente `_indice + 1`, a atual vira a anterior; se pulou mais, a anterior é `0`. Nos dois casos, a atual zera.',
        '`decorrido = agora - _indice * janela` e `estimativa = _anterior * (1 - decorrido / janela) + _atual`. Em `permitir`, só incremente `_atual` quando `estimativa() < limite`.',
      ],
      solution: `import time


class JanelaDeslizante:
    def __init__(self, limite, janela, relogio=time.monotonic):
        self.limite = limite
        self.janela = janela
        self._relogio = relogio
        self._indice = 0          # qual janela fixa é a atual: 0, 1, 2...
        self._atual = 0           # aceitas na janela atual
        self._anterior = 0        # aceitas na janela imediatamente anterior

    def _girar(self, agora):
        indice = int(agora // self.janela)
        if indice != self._indice:
            vizinha = indice == self._indice + 1
            self._anterior = self._atual if vizinha else 0
            self._atual = 0
            self._indice = indice

    def estimativa(self):
        agora = self._relogio()
        self._girar(agora)
        decorrido = agora - self._indice * self.janela
        peso = 1 - decorrido / self.janela
        return self._anterior * peso + self._atual

    def permitir(self):
        if self.estimativa() < self.limite:
            self._atual += 1
            return True
        return False
`,
      solutionExplanation: 'O estado é mínimo: o índice da janela fixa atual e **dois contadores**. `_girar()` resolve a virada: janela vizinha → a atual vira a anterior; salto maior → a anterior não teve nada. A estimativa supõe que as requisições da anterior estavam **espalhadas por igual** e, por isso, pesa só a fração dela que ainda cai nos últimos `janela` segundos. É uma aproximação, mas com memória O(1) por cliente e sem o furo da borda — no Redis, vira dois `INCR` em chaves com o índice da janela no nome (`rl:cliente42:28371650`).',
    },
    {
      type: 'mcq',
      id: 'api-rl-q5',
      concept: 'Rate limiting distribuído',
      say: 'Agora um incidente de produção. Investigue comigo.',
      prompt: `Seu limitador guarda os contadores no Redis assim:

\`\`\`python
n = redis.incr(f"rl:{chave}")
if n == 1:
    redis.expire(f"rl:{chave}", 60)
return n <= 100
\`\`\`

Um cliente reclama que recebe **429 há três dias**, mesmo depois de passar horas sem chamar a API. Qual a causa mais provável?`,
      options: [
        { text: 'O processo caiu (ou a conexão falhou) entre o `INCR` e o `EXPIRE`: a chave ficou **sem TTL** e o contador nunca mais zera.', correct: true, why: 'Dois comandos separados não são atômicos. Se o `EXPIRE` nunca chega, a chave vive para sempre acima do limite — e o cliente fica bloqueado até alguém apagá-la na mão.' },
        { text: 'O `INCR` não é atômico: duas réplicas leram o mesmo valor e o contador se corrompeu.', why: 'O `INCR` é atômico no Redis — é justamente por isso que ele é usado. O problema está no **par** de comandos, não em cada um.' },
        { text: 'O `EXPIRE` reinicia o contador a cada chamada, então a janela nunca termina.', why: 'Aqui o `EXPIRE` só roda quando `n == 1`, e ele não mexe no valor: só define o TTL. (Chamar `EXPIRE` em **toda** requisição criaria outro bug: para um cliente constante, a chave nunca expiraria.)' },
        { text: 'O relógio da réplica está adiantado, e por isso a janela nunca vira.', why: 'O TTL é contado pelo **próprio Redis**, não pelo relógio das réplicas. Relógios desalinhados causam outros problemas, mas não este.' },
      ],
      explanation: 'Operações em dois passos precisam ser **atômicas** ou **autocorretivas**. Saídas: (1) `MULTI`/`EXEC` ou um **script Lua** com `INCR` + `EXPIRE`; (2) no Redis 7+, `EXPIRE chave 60 NX` — que só define o TTL se ainda não houver um — em **toda** requisição; (3) o **índice da janela no nome** da chave (`rl:cliente42:28371650`): se um `EXPIRE` se perder, sobra só lixo na memória, porque na próxima janela a chave já é outra.',
    },
    {
      type: 'open',
      id: 'api-rl-q6',
      concept: 'Design de rate limiting',
      say: 'Última: uma revisão de design. Me convença.',
      prompt: 'Você vai lançar uma API pública com planos **free** e **pro**, rodando em **8 réplicas** atrás de um balanceador. Como você desenharia o rate limiting? Fale do **algoritmo**, das **chaves** e camadas de limite, de **onde fica o estado** e de como a API **responde** quando o cliente passa do limite.',
      minWords: 40,
      rubric: [
        { label: 'Escolhe e justifica o **algoritmo** (token bucket/GCRA para rajadas, sliding window counter…)', keywords: ['token bucket', 'balde', 'gcra', 'sliding window', 'janela deslizante', 'leaky', 'rajada', 'burst'], concept: 'Algoritmos de rate limiting', why: 'Cada algoritmo troca precisão, memória e tolerância a rajadas — a escolha precisa combinar com o tráfego real dos clientes.' },
        { label: 'Limita **por chave/cliente** (o plano) em camadas: API key, usuário ou IP, rota e um teto global', keywords: ['por chave', 'api key', 'chave de api', 'por cliente', 'por usuario', 'por ip', 'plano', 'global', 'camada', 'por rota', 'por endpoint', 'tenant'], concept: 'Chaves de limite', why: 'Um limite só global deixa um cliente abusivo consumir a capacidade de todos; limites por chave, IP e rota isolam o estrago.' },
        { label: 'Estado **compartilhado e atômico** entre réplicas (Redis, Lua/INCR) e um plano para quando ele cair', keywords: ['redis', 'compartilhad', 'centraliz', 'atomic', 'lua', 'incr', 'fail open', 'fail closed', 'falhar aberto', 'falha aberta', 'distribuid'], concept: 'Rate limiting distribuído', why: 'Com 8 réplicas, contadores locais deixam passar até 8× o limite; o estado compartilhado precisa de atualização atômica — e de um plano B.' },
        { label: 'Responde **429** com `Retry-After` (e cabeçalhos de quota restante)', keywords: ['429', 'retry-after', 'retry after', 'too many requests', 'ratelimit', 'remaining'], concept: '429 + Retry-After', why: 'O 429 com Retry-After diz o que houve e quando voltar; sem isso, o cliente tenta de novo na hora e piora a situação.' },
      ],
      modelAnswer: `**Algoritmo:** token bucket por cliente, porque rajadas curtas são normais em apps (abrir uma tela dispara várias chamadas). Free: 10 req/s com rajada de 20; pro: 100 req/s com rajada de 200. A quota mensal do plano fica num contador separado.

**Chaves e camadas:** o limite principal é por **API key** (é ela que carrega o plano); rotas anônimas como \`/login\` também têm limite **por IP**; rotas caras pesam mais (uma exportação custa 50 fichas); e um teto **global** protege o serviço como um todo.

**Estado:** com 8 réplicas, contadores locais deixariam passar 8× o limite. O balde fica no **Redis**, atualizado de forma **atômica** por um script Lua. Se o Redis cair, falho **aberto** com um limitador local de reserva (limite ÷ 8 por réplica) — exceto no \`/login\`, que falha fechado.

**Resposta:** \`429 Too Many Requests\` com \`Retry-After\` calculado pelo próprio balde, um corpo Problem Details explicando o limite, e cabeçalhos \`RateLimit\`/\`X-RateLimit-Remaining\` em **todas** as respostas, para o cliente desacelerar antes de estourar.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Agora você sabe escolher o algoritmo, a chave e o lugar do seu limitador — e como dizer "calma" do jeito certo.',
        { text: 'Resumo: janela fixa fura na borda, sliding window conserta, token bucket aceita rajadas, GCRA resolve tudo com um timestamp — e 429 sempre com Retry-After.', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
