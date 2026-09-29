Game.registerModule('apis', {
  id: 'circuit-breaker',
  title: 'Circuit Breaker, Bulkhead e Load Shedding',
  kind: 'lesson',
  level: 3,
  order: 22,
  unit: 'confiabilidade',
  summary: 'Pare de insistir em quem está caindo: estados do circuit breaker, bulkhead, fallback, load shedding e backpressure — e dois termos que quase ninguém conhece: hedged requests e falhas metaestáveis.',
  concepts: ['Circuit breaker', 'Bulkhead', 'Load shedding', 'Hedged requests', 'Falhas metaestáveis'],
  takeaways: [
    'O circuit breaker troca falhas **lentas** por falhas **rápidas**: fechado conta falhas, aberto nem tenta, meio-aberto libera uma **sonda**.',
    'Prefira **taxa de falhas numa janela** (com mínimo de chamadas) e conte como falha só o que é culpa da dependência — timeout, conexão, 5xx; nunca 4xx.',
    '**Bulkhead** isola recursos por dependência, **fallback** degrada com honestidade, e **load shedding** + **backpressure** evitam filas infinitas e trabalho zumbi.',
    '*Hedged requests* cortam a cauda de latência com uma cópia disparada após ~p95 — só em operações idempotentes.',
    'Numa *falha metaestável* o sistema segue caído depois que o gatilho some: saia reduzindo a carga de propósito (shedding, retry budget), não esperando.',
  ],
  glossary: [
    { term: 'Circuit breaker', aliases: ['circuit breakers', 'disjuntor'], definition: 'Padrão de resiliência que para de chamar uma dependência quando as falhas passam de um limiar (estado **aberto**) e, depois de um tempo, libera uma chamada de sonda (**meio-aberto**) para testar se ela se recuperou.' },
    { term: 'Meio-aberto', aliases: ['half-open', 'meio aberto'], definition: 'Estado do circuit breaker após o tempo de espera: só uma (ou poucas) chamada(s) de **sonda** passa(m). Sucesso fecha o circuito; falha o reabre e reinicia a espera.' },
    { term: 'Bulkhead', aliases: ['bulkheads', 'anteparo'], definition: 'Isolar recursos (pools, semáforos, filas) por dependência ou cliente, como os compartimentos estanques de um navio: um compartimento lotado não afunda os outros.' },
    { term: 'Load shedding', aliases: ['descarte de carga'], definition: 'Recusar cedo e barato (ex.: `503` + `Retry-After`) o trabalho que passa da capacidade — de preferência o menos prioritário — em vez de enfileirar até tudo ficar lento.' },
    { term: 'Hedged request', aliases: ['hedged requests', 'requisição especulativa', 'requisicao especulativa'], definition: 'Enviar uma cópia da requisição para outra réplica quando a primeira passa de ~p95 e usar a resposta que chegar antes, cancelando a outra. Corta a cauda de latência com pouca carga extra; só para operações idempotentes.' },
    { term: 'Falha metaestável', aliases: ['falhas metaestáveis', 'falha metaestavel', 'falhas metaestaveis', 'metastable failure', 'metastable failures'], definition: 'Falha que continua depois que o gatilho some, porque um ciclo de realimentação (retries, cache frio, filas longas) mantém a carga acima da capacidade. Sai-se dela reduzindo a carga de propósito.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto é o que fazer quando uma dependência **começa a cair**. Spoiler: insistir é a pior ideia.',
        'E uma dependência **lenta** é mais perigosa que uma fora do ar: ela prende threads, conexões e memória de quem chama — e a falha se espalha **em cascata**.',
      ],
      board: {
        title: 'O problema: falha em cascata',
        md: `\`\`\`text
 cliente ──▶ API de checkout ──▶ serviço de frete (lento: 30 s por resposta)
                   │
                   ├─ worker 1  ⏳ esperando o frete
                   ├─ worker 2  ⏳ esperando o frete
                   ├─ ...
                   └─ worker 50 ⏳ esperando o frete  → pool esgotado!
                                                   → /pagar, /carrinho, /login… tudo trava
\`\`\`

**Timeouts** limitam o estrago de **uma** chamada. Mas se a dependência continua doente, cada nova requisição ainda paga o timeout inteiro — e ainda dispara retries em cima de quem já está sofrendo.

Falta um mecanismo que **pare de tentar** por um tempo: o **circuit breaker**, popularizado por Michael Nygard no livro *Release It!* (2007).

> [!dica] A ideia vem do disjuntor elétrico: quando a corrente passa do limite, ele **desarma** para proteger a casa, em vez de deixar a fiação pegar fogo. Depois, alguém testa se já dá para religar.`,
      },
    },
    {
      type: 'say',
      text: [
        'O circuit breaker é uma **máquina de três estados** que fica entre você e a dependência.',
        '**Fechado** deixa passar, **aberto** falha rápido sem nem tentar, e **meio-aberto** libera uma **sonda** para ver se a dependência voltou.',
      ],
      board: {
        title: 'Os três estados',
        md: `\`\`\`text
               falhas ≥ limiar
   ┌─────────┐ ──────────────▶ ┌─────────┐
   │ FECHADO │                 │ ABERTO  │
   └─────────┘                 └─────────┘
        ▲                        │     ▲
        │ sonda OK   tempo_reset │     │ sonda falhou
        │                        ▼     │
        │                 ┌─────────────┐
        └─────────────────┤ MEIO-ABERTO │
                          └─────────────┘
\`\`\`

| Estado | O que acontece com a chamada | Sai quando… |
|---|---|---|
| **Fechado** | passa normalmente; o breaker **conta** as falhas | as falhas atingem o limiar → **aberto** |
| **Aberto** | **nem tenta**: falha na hora (ou usa o fallback) | passa o \`tempo_reset\` → **meio-aberto** |
| **Meio-aberto** | deixa passar **uma** (ou poucas) sonda(s) | sonda ok → **fechado**; sonda falha → **aberto** de novo |

> [!atencao] No meio-aberto, **limite** as sondas. Soltar de uma vez todo o tráfego represado derruba a dependência que estava se recuperando.

> [!dica] Use um breaker **por dependência** (às vezes por endpoint), do lado de quem chama. Em Python existe o \`pybreaker\`; em Java, o Resilience4j; em .NET, o Polly.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Quando abrir? O jeito ingênuo é contar **N falhas seguidas**. Funciona, mas tem pontos cegos.',
        'Bibliotecas maduras usam a **taxa de falhas numa janela deslizante** — com um **mínimo de chamadas** para não abrir por puro azar.',
      ],
      board: {
        title: 'Limiar: contagem × taxa em janela',
        md: `| Estratégia | Como decide | Ponto cego |
|---|---|---|
| **N falhas consecutivas** | abre na 5ª falha seguida | 40% de erro **intercalado** com sucessos nunca abre |
| **Taxa em janela por contagem** | abre se ≥ 50% das últimas 100 chamadas falharam | com pouco tráfego, a janela demora a encher |
| **Taxa em janela por tempo** | abre se ≥ 50% das chamadas dos últimos 60 s falharam | exige **mínimo de chamadas** (1 de 1 = 100%!) |
| **Chamadas lentas** | abre se ≥ 80% das chamadas passam de 2 s | exige medir latência, não só erro |

\`\`\`python
from collections import deque

class JanelaDeFalhas:
    """Janela deslizante POR CONTAGEM: o resultado das últimas N chamadas."""

    def __init__(self, tamanho=100, taxa_max=0.5, minimo=20):
        self.resultados = deque(maxlen=tamanho)   # True = falhou
        self.taxa_max = taxa_max
        self.minimo = minimo

    def registrar(self, falhou):
        self.resultados.append(falhou)

    def deve_abrir(self):
        n = len(self.resultados)
        if n < self.minimo:              # pouca amostra: não decide no azar
            return False
        return sum(self.resultados) / n >= self.taxa_max
\`\`\`

> [!atencao] **O que conta como falha?** Timeout, conexão recusada e **5xx**: sim — são culpa da dependência. **4xx** (400, 404, 422): **não** — é o *seu* pedido que está errado, e abrir o circuito por isso bloquearia pedidos válidos. O **429** merece tratamento à parte: é a dependência pedindo calma — respeite o \`Retry-After\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'Circuito aberto: e agora, o que devolver? Aí entra o **fallback** — uma resposta **degradada**, mas útil.',
        'Um bom fallback é barato e **não depende** de quem acabou de falhar. E precisa ser testado: fallback que nunca roda é um bug esperando o pior dia.',
      ],
      board: {
        title: 'Fallback: degradar com elegância',
        md: `| Dependência caiu | Fallback razoável |
|---|---|
| Recomendações | lista vazia ou "mais vendidos" do cache |
| Cálculo de frete | última tabela conhecida (**stale**) + aviso |
| Câmbio | cotação do cache, com \`cotado_em\` na resposta |
| Pagamento | **não invente**: falhe rápido e deixe o cliente tentar depois |

\`\`\`python
def recomendacoes(usuario_id):
    try:
        return breaker.chamar(servico_reco.buscar, usuario_id)
    except (CircuitoAberto, TimeoutError):
        return cache.get("mais_vendidos", [])   # degradado, mas a página abre
\`\`\`

Quando não existe fallback honesto, **falhe rápido e diga quando voltar**:

\`\`\`http
HTTP/1.1 503 Service Unavailable
Retry-After: 30
Content-Type: application/problem+json

{"type": "https://api.loja.dev/erros/indisponivel", "title": "Frete temporariamente indisponível", "status": 503}
\`\`\`

> [!atencao] Fallback que chama **outra** dependência frágil só muda o problema de lugar. E fallback que mente é pior que erro: mostrar "saldo R$ 0,00" porque o serviço de saldo caiu assusta mais do que um aviso claro.`,
      },
    },
    {
      type: 'say',
      text: [
        'O circuit breaker reage **depois** que as falhas aparecem. O **bulkhead** é preventivo: ele limita o estrago que uma dependência consegue causar.',
        'O nome vem dos navios: o casco é dividido em **compartimentos estanques**. Um furo alaga um compartimento, não o navio inteiro.',
      ],
      board: {
        title: 'Bulkhead: compartimentos estanques',
        md: `\`\`\`text
 SEM bulkhead — um pool único de 50 workers:
   [reco ⏳][reco ⏳][reco ⏳] … [reco ⏳]   → /pagar não acha worker livre 💥

 COM bulkhead — vagas separadas por dependência:
   pagamentos     ■■■■■■■■■■■■■■■■■■■■   20 vagas
   frete          ■■■■■■■■■■             10 vagas
   recomendações  ■■■■■                   5 vagas → lotou? só recomendações sofre
\`\`\`

\`\`\`python
import asyncio

class Bulkhead:
    """Limita quantas chamadas simultâneas UMA dependência pode ocupar."""

    def __init__(self, vagas):
        self._sem = asyncio.Semaphore(vagas)

    async def executar(self, fn, *args):
        if self._sem.locked():                     # compartimento cheio:
            raise RuntimeError("bulkhead cheio")   # rejeita já, não enfileira
        async with self._sem:
            return await fn(*args)

bulkheads = {"pagamentos": Bulkhead(20), "frete": Bulkhead(10), "recomendacoes": Bulkhead(5)}
\`\`\`

Bulkhead aparece em vários níveis: semáforos por dependência (como acima), **pools de conexão separados**, filas separadas por cliente (contra o *noisy neighbor*) e até **células** de infraestrutura isoladas.

> [!sabia] No Envoy (e no Istio), o que se chama *circuit breaking* são limites de conexões e de requisições pendentes — na prática, um **bulkhead**. O comportamento "tirar de circulação quem está falhando" lá se chama *outlier detection*.`,
      },
    },
    {
      type: 'say',
      text: [
        'E quando o sobrecarregado é **você**? Enfileirar tudo parece gentil, mas é uma armadilha.',
        '**Load shedding** é recusar cedo o que não dá para atender; **backpressure** é avisar quem produz que precisa **desacelerar**.',
      ],
      board: {
        title: 'Load shedding e backpressure',
        md: `**Por que filas infinitas são perigosas:** a requisição espera 40 s na fila, mas o cliente desistiu (timeout) aos 10 s. O servidor gasta CPU com uma resposta que ninguém vai ler — **trabalho zumbi**. O *throughput* até sobe, mas o **goodput** (respostas úteis) despenca.

| Técnica | Ideia | Exemplo |
|---|---|---|
| **Load shedding** | recusar **cedo e barato** acima da capacidade | \`503\` + \`Retry-After\` antes de tocar no banco |
| **Priorização** | descartar primeiro o que é menos crítico | \`/checkout\` entra, \`/recomendacoes\` sai |
| **Prazo na fila** | descartar o que já esperou mais do que o cliente aguenta | esperou mais de 2 s? nem processa |
| **Backpressure** | sinalizar ao produtor para desacelerar | fila limitada que bloqueia, \`429\`, controle de fluxo do HTTP/2 |

\`\`\`python
import asyncio

fila = asyncio.Queue(maxsize=100)   # LIMITADA: é isso que cria backpressure

async def produtor(item):
    await fila.put(item)            # fila cheia → o produtor ESPERA (desacelera)

def admitir(req, em_andamento, capacidade):
    """Load shedding com prioridade: acima da capacidade, só o crítico entra."""
    if em_andamento < capacidade:
        return True
    return req["critica"] and em_andamento < capacidade * 1.2
\`\`\`

> [!sabia] O Facebook descreveu uma técnica curiosa para filas sob sobrecarga: **LIFO adaptativo** combinado com **CoDel** (*Controlled Delay*, um algoritmo de gestão de filas de roteadores). Em sobrecarga, atender o **mais novo** primeiro favorece quem ainda está esperando — os mais antigos provavelmente já desistiram.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora dois termos que pouca gente conhece. O primeiro: **hedged requests**, do artigo *The Tail at Scale*, do Google.',
        'Se a resposta passa do p95, você dispara **uma cópia** para outra réplica e fica com a que chegar primeiro. A cauda de latência despenca com pouca carga extra.',
      ],
      board: {
        title: 'Hedged requests: cortando a cauda',
        md: `\`\`\`text
 t = 0     ──▶ réplica A ································ (GC, disco lento, vizinho barulhento)
 t = p95   ──▶ réplica B ·········✓ respondeu!   → usa B e CANCELA A
\`\`\`

\`\`\`python
import asyncio

async def hedged(chamar, replicas, atraso):
    """Dispara na réplica 0; se não responder em \`atraso\` (≈ p95), dispara na 1."""
    primeira = asyncio.ensure_future(chamar(replicas[0]))
    prontas, _ = await asyncio.wait({primeira}, timeout=atraso)
    if prontas:
        return primeira.result()
    segunda = asyncio.ensure_future(chamar(replicas[1]))
    prontas, pendentes = await asyncio.wait(
        {primeira, segunda}, return_when=asyncio.FIRST_COMPLETED)
    for tarefa in pendentes:
        tarefa.cancel()                  # a perdedora é cancelada
    return prontas.pop().result()
\`\`\`

> [!sabia] No artigo *The Tail at Scale* (Dean e Barroso, 2013), esperar até o **p95** antes de disparar a cópia limitou a carga extra a cerca de **5%**. Num teste com o BigTable, cópias enviadas após 10 ms derrubaram o p99,9 de **1.800 ms para 74 ms** com só **2%** a mais de requisições.

> [!atencao] Só para operações **idempotentes** (leituras, ou escritas com Idempotency-Key). E nunca dispare a cópia em t = 0: isso **dobra** a carga — o oposto do que um sistema estressado precisa.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'O segundo termo é assustador: **falha metaestável**. O gatilho vai embora… e o sistema **continua caído**.',
        'Um ciclo de realimentação — retries, cache frio, timeouts — mantém a carga acima da capacidade. Esperar não resolve: é preciso **quebrar o ciclo**.',
      ],
      board: {
        title: 'Falhas metaestáveis',
        md: `\`\`\`text
  ESTÁVEL ──carga alta──▶ VULNERÁVEL ──gatilho──▶ METAESTÁVEL
                          (eficiente, mas         (o gatilho some,
                           sem folga)               a falha fica)

  O ciclo que sustenta a falha:

     lentidão ──▶ timeouts ──▶ retries ──▶ MAIS carga
        ▲                                      │
        └──────────────────────────────────────┘
\`\`\`

| Estado | O que significa |
|---|---|
| **Estável** | se a carga cair, o sistema se recupera sozinho |
| **Vulnerável** | operando perto do limite (eficiente!) — um gatilho pode derrubá-lo |
| **Metaestável** | um **efeito sustentador** mantém a sobrecarga mesmo sem o gatilho |

**Gatilhos comuns:** pico de tráfego, deploy ruim, cache reiniciado, failover de banco. **Efeitos sustentadores:** retries, cache frio (cada miss vira consulta cara), filas longas de trabalho zumbi.

**Como sair (e evitar):** derrubar a carga **abaixo** do ponto de recuperação — load shedding, **retry budget** (ex.: no máximo 10% das chamadas podem ser retries), circuit breakers nos clientes, reaquecer o cache aos poucos e priorizar o tráfego que "cura" o sistema.

> [!sabia] O termo foi cunhado por Bronson e colegas no artigo *Metastable Failures in Distributed Systems* (HotOS 2021). Um estudo de 2022, *Metastable Failures in the Wild* (OSDI), encontrou esse padrão em incidentes públicos de vários grandes provedores de nuvem — com **retries** entre os efeitos sustentadores mais comuns.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um circuit breaker de verdade, com relógio injetado.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'api-cb-q1',
      concept: 'O que conta como falha',
      say: 'Primeira: o que deve fazer o circuito abrir?',
      prompt: 'Seu breaker protege as chamadas para a API de frete. Qual destas respostas **não** deveria contar como falha para abrir o circuito?',
      options: [
        { text: '`422 Unprocessable Content`, porque o CEP enviado é inválido', correct: true, why: 'É erro do **cliente** (o seu pedido). A dependência está saudável; se isso abrisse o circuito, um CEP mal digitado bloquearia o frete de todo mundo.' },
        { text: 'Timeout depois de 2 s', why: 'Timeout é o sintoma clássico de dependência sobrecarregada — deve contar, e é justamente o caso mais caro de não cortar.' },
        { text: '`503 Service Unavailable`', why: 'A própria dependência está dizendo que não consegue atender: conta como falha.' },
        { text: '`ConnectionRefusedError` ao abrir a conexão', why: 'Ninguém está escutando do outro lado — é falha da dependência e conta.' },
      ],
      explanation: 'Conte como falha só o que indica **dependência doente**: timeouts, erros de conexão e 5xx. Erros **4xx** falam do pedido e devem ir direto para quem chamou, sem mexer no circuito. O **429** merece tratamento à parte (é a dependência pedindo calma: respeite o `Retry-After`). Bibliotecas como o Resilience4j têm listas explícitas de exceções que **registram** falha e de exceções **ignoradas**.',
    },
    {
      type: 'order',
      id: 'api-cb-q2',
      concept: 'Estados do circuit breaker',
      say: 'Agora coloque o ciclo de vida do circuito na ordem.',
      prompt: 'Uma dependência cai e depois se recupera. Ordene o que acontece com o circuit breaker, do começo ao fim.',
      items: [
        'Fechado: as chamadas passam e as falhas são contadas',
        'As falhas atingem o limiar e o circuito abre',
        'Aberto: as chamadas falham na hora (fallback), sem tocar a dependência',
        'Passa o tempo de espera e o circuito fica meio-aberto',
        'Meio-aberto: uma única chamada de sonda é liberada',
        'A sonda tem sucesso: o circuito fecha e a contagem zera',
      ],
      explanation: 'É um ciclo: **fechado → aberto → meio-aberto → fechado**. Se a sonda tivesse falhado no último passo, o circuito voltaria para **aberto** e o tempo de espera recomeçaria. O meio-aberto existe para testar a recuperação **sem** soltar todo o tráfego de uma vez.',
    },
    {
      type: 'match',
      id: 'api-cb-q3',
      concept: 'Padrões de resiliência',
      say: 'Vários padrões com nomes parecidos. Associe cada um à sua intenção.',
      prompt: 'Associe cada padrão à sua **intenção**.',
      pairs: [
        { left: 'Circuit breaker', right: 'Parar de chamar uma dependência que está falhando e falhar rápido' },
        { left: 'Bulkhead', right: 'Isolar recursos por dependência para conter o estrago' },
        { left: 'Load shedding', right: 'Recusar cedo o excedente quando o próprio serviço está sobrecarregado' },
        { left: 'Backpressure', right: 'Sinalizar ao produtor que ele precisa desacelerar' },
        { left: 'Hedged request', right: 'Disparar uma cópia após ~p95 e ficar com a primeira resposta' },
        { left: 'Fallback', right: 'Devolver uma resposta degradada quando a principal não é possível' },
      ],
      explanation: 'Eles se combinam: o **bulkhead** limita o raio de explosão, o **circuit breaker** para de insistir, o **fallback** decide o que responder, o **load shedding** protege o serviço de si mesmo e a **backpressure** empurra o limite para quem produz. Os **hedged requests** atacam outro problema: a cauda de latência.',
    },
    {
      type: 'code',
      id: 'api-cb-q4',
      concept: 'Circuit breaker',
      title: 'Circuit breaker com relógio injetado',
      say: 'Agora é com você: implemente o circuit breaker. O relógio é injetado — ninguém vai esperar 10 segundos de verdade nos testes.',
      prompt: `Implemente \`CircuitBreaker(limite_falhas, tempo_reset, relogio)\`. \`relogio()\` devolve o "agora" em segundos — nos testes, um relógio falso que a gente avança na mão.

- \`estado\` (propriedade): \`"fechado"\`, \`"aberto"\` ou \`"meio-aberto"\`. Começa **fechado**.
- \`chamar(fn, *args)\` executa \`fn(*args)\` e devolve o resultado — ou **repassa** a exceção de \`fn\`, sem engolir.
- **Fechado:** cada exceção conta uma falha **consecutiva** (um sucesso zera a contagem). Na \`limite_falhas\`-ésima falha seguida, o circuito **abre**.
- **Aberto:** \`chamar\` lança \`CircuitoAberto\` **sem chamar** \`fn\`. Quando \`relogio() - aberto_em >= tempo_reset\`, o circuito passa a **meio-aberto** — e a propriedade \`estado\` já deve refletir isso.
- **Meio-aberto:** a próxima chamada é a **sonda**. Sucesso → **fechado**, com a contagem zerada. Falha → **aberto** de novo, com o tempo de espera **recomeçando**.`,
      starter: `import time


class CircuitoAberto(Exception):
    """Chamada rejeitada sem tocar a dependência: o circuito está aberto."""


class CircuitBreaker:
    def __init__(self, limite_falhas=3, tempo_reset=10.0, relogio=time.monotonic):
        self.limite_falhas = limite_falhas
        self.tempo_reset = tempo_reset
        self._relogio = relogio

    @property
    def estado(self):
        # TODO: "fechado", "aberto" ou "meio-aberto"
        pass

    def chamar(self, fn, *args):
        # TODO
        pass
`,
      tests: [
        {
          name: 'começa fechado e devolve o resultado de fn',
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=3, tempo_reset=10, relogio=lambda: agora[0])
assert cb.estado == "fechado", f"estado inicial deveria ser 'fechado', veio {cb.estado!r}"
assert cb.chamar(lambda x: x * 2, 21) == 42, "chamar deve devolver o resultado de fn(*args)"`,
        },
        {
          name: 'abre na 3ª falha seguida e repassa a exceção original',
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=3, tempo_reset=10, relogio=lambda: agora[0])
def falha():
    raise ValueError("frete caiu")
for i in range(3):
    try:
        cb.chamar(falha)
        assert False, "a exceção de fn deveria ser repassada para quem chamou"
    except ValueError:
        pass
    esperado = "aberto" if i == 2 else "fechado"
    assert cb.estado == esperado, f"depois de {i + 1} falha(s): {cb.estado!r} (esperado {esperado!r})"`,
        },
        {
          name: 'aberto: lança CircuitoAberto sem chamar fn',
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=2, tempo_reset=10, relogio=lambda: agora[0])
def falha():
    raise ValueError("frete caiu")
for _ in range(2):
    try:
        cb.chamar(falha)
    except ValueError:
        pass
chamadas = []
try:
    cb.chamar(lambda: chamadas.append("tocou"))
    assert False, "com o circuito aberto, chamar deveria lançar CircuitoAberto"
except CircuitoAberto:
    pass
assert chamadas == [], "com o circuito aberto, fn NÃO pode ser chamada"`,
        },
        {
          name: 'continua aberto antes de completar o tempo_reset',
          code: `agora = [100.0]
cb = CircuitBreaker(limite_falhas=1, tempo_reset=10, relogio=lambda: agora[0])
try:
    cb.chamar(lambda: 1 / 0)
except ZeroDivisionError:
    pass
agora[0] = 109.9
assert cb.estado == "aberto", f"aberto em t=100; em t=109.9 ainda deveria estar aberto, veio {cb.estado!r}"
try:
    cb.chamar(lambda: "ok")
    assert False, "antes do tempo_reset a chamada deveria ser rejeitada com CircuitoAberto"
except CircuitoAberto:
    pass`,
        },
        {
          name: 'depois do tempo_reset: meio-aberto; sonda ok fecha',
          code: `agora = [100.0]
cb = CircuitBreaker(limite_falhas=1, tempo_reset=10, relogio=lambda: agora[0])
try:
    cb.chamar(lambda: 1 / 0)
except ZeroDivisionError:
    pass
agora[0] = 110.0
assert cb.estado == "meio-aberto", f"passado o tempo_reset deveria estar 'meio-aberto', veio {cb.estado!r}"
assert cb.chamar(lambda: "pong") == "pong", "a sonda deveria executar fn e devolver o resultado"
assert cb.estado == "fechado", f"sonda com sucesso deveria fechar o circuito, veio {cb.estado!r}"`,
        },
        {
          name: 'sonda falha: reabre e o tempo de espera recomeça',
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=3, tempo_reset=10, relogio=lambda: agora[0])
def falha():
    raise ValueError("ainda caído")
for _ in range(3):
    try:
        cb.chamar(falha)
    except ValueError:
        pass
agora[0] = 10.0
try:
    cb.chamar(falha)
    assert False, "a exceção da sonda deveria ser repassada"
except ValueError:
    pass
assert cb.estado == "aberto", f"uma única falha no meio-aberto deveria reabrir o circuito, veio {cb.estado!r}"
agora[0] = 15.0
assert cb.estado == "aberto", "o tempo de espera deveria recomeçar a partir da falha da sonda (t=10)"
agora[0] = 20.0
assert cb.estado == "meio-aberto", f"em t=20 (10 s após a sonda) deveria estar meio-aberto, veio {cb.estado!r}"`,
        },
        {
          name: 'um sucesso zera a contagem de falhas consecutivas',
          hidden: true,
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=3, tempo_reset=10, relogio=lambda: agora[0])
def falha():
    raise ValueError("x")
for f in (falha, falha, lambda: "ok", falha, falha):
    try:
        cb.chamar(f)
    except ValueError:
        pass
assert cb.estado == "fechado", "falhas NÃO consecutivas (com um sucesso no meio) não deveriam abrir o circuito"`,
        },
        {
          name: 'depois de fechar, precisa de N falhas novas para reabrir',
          hidden: true,
          code: `agora = [0.0]
cb = CircuitBreaker(limite_falhas=2, tempo_reset=5, relogio=lambda: agora[0])
def falha():
    raise ValueError("x")
for _ in range(2):
    try:
        cb.chamar(falha)
    except ValueError:
        pass
agora[0] = 5.0
assert cb.chamar(lambda: "ok") == "ok"
assert cb.estado == "fechado"
try:
    cb.chamar(falha)
except ValueError:
    pass
assert cb.estado == "fechado", "ao fechar, a contagem de falhas deveria recomeçar do zero"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('monotonic') || m.calls.includes('perf_counter') || (m.calls.includes('time') && m.imports.includes('time')),
          text: 'Você chamou o relógio do sistema (`time.time()`/`time.monotonic()`) dentro da lógica. Use sempre o `relogio` injetado: é ele que permite testar "10 segundos depois" sem esperar 10 segundos — e simular exatamente os instantes de borda.',
          concept: 'Injeção de relógio',
        },
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo captura também `KeyboardInterrupt`, `SystemExit` e o cancelamento de tarefas. Para registrar falhas da dependência, use `except Exception:` e **relance** com `raise`.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => m.maxComplexity > 9,
          text: 'Algum método ficou com muitos caminhos. Extraia `_registrar_sucesso()`, `_registrar_falha()` e `_abrir()` — ou modele cada estado como um objeto (padrão **State**) — para cada transição morar num lugar só.',
          concept: 'Máquina de estados',
        },
      ],
      hints: [
        'Guarde três coisas: `_estado`, `_falhas` (consecutivas) e `_aberto_em`. Abrir é `_estado = "aberto"` e `_aberto_em = self._relogio()`.',
        'Na propriedade `estado`: se está `"aberto"` e `self._relogio() - self._aberto_em >= self.tempo_reset`, mude para `"meio-aberto"` antes de devolver. Assim a transição acontece "sozinha", sem timer.',
        'Em `chamar`: se `self.estado == "aberto"`, lance `CircuitoAberto` sem chamar `fn`. Senão, `try: resultado = fn(*args)`; no `except Exception:` registre a falha (abre se estava meio-aberto **ou** se atingiu o limite) e use `raise`; no sucesso, zere `_falhas` e feche.',
      ],
      solution: `import time


class CircuitoAberto(Exception):
    """Chamada rejeitada sem tocar a dependência: o circuito está aberto."""


class CircuitBreaker:
    def __init__(self, limite_falhas=3, tempo_reset=10.0, relogio=time.monotonic):
        self.limite_falhas = limite_falhas
        self.tempo_reset = tempo_reset
        self._relogio = relogio
        self._estado = "fechado"
        self._falhas = 0
        self._aberto_em = None

    @property
    def estado(self):
        # transição preguiçosa: aberto → meio-aberto quando o tempo de espera passou
        if self._estado == "aberto" and self._relogio() - self._aberto_em >= self.tempo_reset:
            self._estado = "meio-aberto"
        return self._estado

    def chamar(self, fn, *args):
        if self.estado == "aberto":
            raise CircuitoAberto("dependência em quarentena: tente mais tarde")
        try:
            resultado = fn(*args)
        except Exception:
            self._registrar_falha()
            raise
        self._registrar_sucesso()
        return resultado

    def _registrar_falha(self):
        self._falhas += 1
        if self._estado == "meio-aberto" or self._falhas >= self.limite_falhas:
            self._abrir()

    def _registrar_sucesso(self):
        self._falhas = 0
        self._estado = "fechado"

    def _abrir(self):
        self._estado = "aberto"
        self._aberto_em = self._relogio()
`,
      solutionExplanation: 'A propriedade `estado` faz a transição **preguiçosa** aberto → meio-aberto consultando o relógio injetado — sem timer nem thread. `chamar` só decide **se** chama; o registro de sucesso e falha fica em métodos pequenos. Três detalhes importam: a exceção original é **relançada** com `raise` (quem chamou continua sabendo o que houve); no meio-aberto **uma** falha basta para reabrir; e `_abrir()` atualiza `_aberto_em`, então o tempo de espera recomeça. Com concorrência de verdade, você ainda limitaria quantas sondas passam ao mesmo tempo no meio-aberto.',
    },
    {
      type: 'mcq',
      id: 'api-cb-q5',
      concept: 'Falhas metaestáveis',
      say: 'Agora um incidente de verdade. Leia com calma.',
      prompt: 'Às 14h, um deploy com bug esvaziou o cache de produtos. Às 14h05 o deploy foi **revertido** — mas às 15h o banco segue a 100% de CPU, a taxa de erro não cai e os clientes continuam reenviando as requisições que dão timeout. O que está acontecendo e qual a melhor ação?',
      options: [
        { text: 'Uma **falha metaestável**: o gatilho passou, mas retries + cache frio mantêm a carga acima da capacidade. É preciso quebrar o ciclo: descartar carga, cortar retries e reaquecer o cache aos poucos.', correct: true, why: 'Exatamente: o efeito sustentador (retries e cache miss) não depende mais do gatilho. Enquanto a carga não cair abaixo do ponto de recuperação, o sistema não sai sozinho.' },
        { text: 'O bug do deploy ainda está ativo; é só reverter de novo.', why: 'O enunciado diz que a reversão já aconteceu — o gatilho foi removido. Essa é justamente a marca de uma falha metaestável: remover a causa não basta.' },
        { text: 'Basta esperar: removido o gatilho, o sistema sempre volta sozinho.', why: 'Isso vale para os estados estável e vulnerável. No metaestável, o ciclo de realimentação se sustenta sem o gatilho — esperar pode levar horas.' },
        { text: 'Aumentar o timeout dos clientes para 60 s, para as requisições terem tempo de terminar.', why: 'Timeouts maiores aumentam o trabalho em andamento e os recursos presos no servidor, enquanto o usuário já desistiu. Só piora a sobrecarga.' },
      ],
      explanation: 'Falhas metaestáveis têm um **gatilho** (deploy, pico, failover) e um **efeito sustentador** (retries, cache frio, filas longas). A saída é derrubar a carga de propósito: **load shedding**, **retry budget** e circuit breakers nos clientes, limite de taxa temporário e reaquecimento gradual do cache. Aumentar a capacidade também ajuda — mas só se passar do ponto em que o ciclo se quebra.',
    },
    {
      type: 'open',
      id: 'api-cb-q6',
      concept: 'Bulkhead e fallback',
      say: 'Última: uma revisão de arquitetura. Me convença.',
      prompt: 'O checkout chama três dependências: **pagamentos** (crítica), **frete** (crítica, mas dá para usar a última tabela conhecida) e **recomendações** (opcional). Ontem, recomendações ficou lenta e **derrubou o checkout inteiro**. Como você usaria timeout, circuit breaker, bulkhead e fallback para isso não se repetir?',
      minWords: 30,
      rubric: [
        { label: 'Isola recursos por dependência (**bulkhead**: pools/semáforos separados)', keywords: ['bulkhead', 'isola', 'pool separado', 'pools separados', 'semaforo', 'compartiment', 'limite de concorrencia', 'vagas'], concept: 'Bulkhead', why: 'Sem isolamento, a dependência mais lenta ocupa todos os workers e derruba justamente o que é crítico.' },
        { label: 'Usa **circuit breaker** para falhar rápido quando a dependência está doente', keywords: ['circuit', 'circuito', 'disjuntor', 'falhar rapido', 'falha rapido', 'falhe rapido', 'fail fast'], concept: 'Circuit breaker', why: 'Com o circuito aberto, cada requisição deixa de pagar o timeout inteiro de uma dependência que já se sabe doente.' },
        { label: 'Define **fallback/degradação** por dependência (recomendações vazia, frete do cache)', keywords: ['fallback', 'degrad', 'cache', 'lista vazia', 'mais vendidos', 'ultima tabela', 'stale'], concept: 'Fallback', why: 'Cada dependência merece uma resposta degradada diferente — e a crítica sem fallback honesto deve falhar rápido.' },
        { label: 'Coloca **timeouts** curtos, proporcionais à importância da dependência', keywords: ['timeout', 'tempo limite', 'deadline', 'prazo'], concept: 'Timeouts', why: 'O timeout limita quanto tempo uma chamada pode prender recursos; o de uma dependência opcional deve ser bem curto.' },
      ],
      modelAnswer: `Primeiro, **timeouts** curtos e explícitos em cada chamada — recomendações com poucas centenas de milissegundos, porque é opcional.

Depois, **bulkhead**: um limite de concorrência (semáforo/pool) **separado** por dependência, com recomendações num compartimento pequeno. Se ele lotar, só recomendações é rejeitada; pagamentos e frete continuam com as suas vagas.

Em cada dependência, um **circuit breaker** por taxa de falhas numa janela: quando recomendações estiver doente, o circuito abre e o checkout **falha rápido** sem nem tentar; depois, uma sonda no meio-aberto testa a volta.

Por fim, **fallback** por dependência: recomendações devolve lista vazia ou "mais vendidos" do cache; frete usa a última tabela conhecida (stale) com aviso; pagamentos **não** tem fallback honesto — falha rápido com 503 e \`Retry-After\`. E eu testaria esses fallbacks de propósito (injeção de falhas), porque fallback que nunca roda apodrece.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Hoje você aprendeu a **parar de insistir** na hora certa — e a proteger o sistema dele mesmo.',
        { text: 'Resumo: breaker para cortar, bulkhead para isolar, shedding e backpressure para não afogar, hedge para a cauda — e olho vivo no ciclo metaestável.', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
