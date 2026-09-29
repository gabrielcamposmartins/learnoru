Game.registerModule('apis', {
  id: 'resiliencia',
  title: 'Timeouts, Retries e Deadlines',
  kind: 'lesson',
  level: 3,
  order: 21,
  unit: 'confiabilidade',
  summary: 'A rede vai falhar — a questão é como você reage: timeouts de conexão e de leitura, deadlines propagados, retries só no que é seguro, backoff exponencial com jitter e dois termos pouco conhecidos: retry budget e retry storm.',
  concepts: ['Timeouts', 'Deadlines', 'Backoff + jitter', 'Retry budget', 'Retry storm'],
  takeaways: [
    '**Sempre** defina timeout: de conexão (curto) e de leitura (um pouco acima do p99). Sem timeout, uma dependência travada prende threads, conexões e o usuário.',
    'Pense em **deadline** por requisição, não em timeout por chamada: converta o orçamento em prazo absoluto na borda, propague o **restante** a cada salto e falhe rápido quando ele acabar.',
    'Só repita o que é **passageiro** (conexão, timeout, `408`/`429`/`502`/`503`/`504`) **e** seguro de repetir (idempotente ou com `Idempotency-Key`) — nunca um `4xx` de validação ou um bug.',
    'Backoff exponencial **com jitter** (full ou decorrelated) espalha os retries; sem jitter, os clientes voltam em sincronia e derrubam o servidor de novo. Se vier `Retry-After`, ele é o piso.',
    'Retries **se multiplicam** entre camadas (*retry storm*): repita numa camada só e limite tudo com um *retry budget*.',
  ],
  glossary: [
    { term: 'Deadline', aliases: ['deadlines', 'prazo absoluto', 'deadline propagation'], definition: 'Instante absoluto até o qual uma resposta ainda é útil. Diferente do timeout (uma duração por chamada), é definido uma vez na borda e **propagado** pela cadeia: cada salto usa só o tempo que resta.' },
    { term: 'Timeout de leitura', aliases: ['timeouts de leitura', 'read timeout', 'read timeouts'], definition: 'Quanto esperar por dados depois de conectado. Em muitas bibliotecas (como o `requests`), ele mede o **silêncio entre bytes**, não o tempo total: um servidor que pinga um byte de vez em quando nunca o estoura.' },
    { term: 'Backoff exponencial', aliases: ['exponential backoff', 'backoff'], definition: 'Esperar cada vez mais entre tentativas — `base × 2ⁿ`, com um teto — para dar tempo de a dependência se recuperar em vez de martelá-la. Quase sempre combinado com **jitter**.' },
    { term: 'Jitter', aliases: ['full jitter', 'equal jitter', 'decorrelated jitter'], definition: 'Aleatoriedade na espera entre retries, para os clientes não voltarem todos no mesmo instante. No *full jitter*, a espera é sorteada entre 0 e o teto exponencial da tentativa.' },
    { term: 'Retry budget', aliases: ['retry budgets', 'orçamento de retries'], definition: 'Teto para a fração de chamadas que podem ser retries (ex.: no máximo 10%). Quando a dependência adoece, os retries param sozinhos em vez de multiplicar a carga sobre ela.' },
    { term: 'Retry storm', aliases: ['retry storms', 'tempestade de retries', 'amplificação de retries'], definition: 'Avalanche de retries que multiplica a carga sobre quem já está sofrendo — pior quando várias camadas repetem: 4 tentativas em 3 camadas viram 64 chamadas no fundo por ação do usuário.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o tema é o que fazer quando a rede falha — e ela **vai** falhar. Primeira regra: **toda** chamada de rede tem timeout.',
        'Sem timeout, uma dependência travada segura a sua thread, a sua conexão e o seu usuário… para sempre.',
      ],
      board: {
        title: 'Timeouts: sempre, e de dois tipos',
        md: `\`\`\`text
  cliente                                     servidor
     │──── SYN ──────────────────────────────────▶│  ┐
     │◀─────────────────────────────── SYN-ACK ───│  │ timeout de CONEXÃO
     │──── ACK + handshake TLS ──────────────────▶│  ┘ (curto: ~1–3 s)
     │──── GET /cotacoes?cep=01001000 ───────────▶│  ┐
     │                              (processando) │  │ timeout de LEITURA
     │◀─────────────────────── bytes da resposta ─│  ┘ (p99 + folga)
\`\`\`

| Timeout | Mede | Valor típico |
|---|---|---|
| **Conexão** | até a conexão TCP (e, em geral, o TLS) se estabelecer | curto: se nem conecta, o host está fora ou inalcançável |
| **Leitura** | a espera por bytes da resposta | um pouco acima do **p99** da dependência |
| **Total (deadline)** | a operação inteira, retries incluídos | o que o **usuário** aguenta esperar |

\`\`\`python
import requests

# ❌ sem timeout: o padrão do requests é esperar PARA SEMPRE
r = requests.get("https://frete.exemplo/cotacoes")

# ✅ (conexão, leitura), em segundos
r = requests.get("https://frete.exemplo/cotacoes", timeout=(3.05, 2))
\`\`\`

> [!atencao] O \`requests\` **não tem timeout padrão**, e o \`urllib\` herda o do socket (\`None\` = infinito). Já o \`httpx\` usa 5 s por padrão. Confira sempre a sua biblioteca — e a do banco de dados, a da fila, o SDK da nuvem…

> [!sabia] O timeout de leitura do \`requests\` **não** limita o tempo total da resposta: ele mede o **silêncio entre bytes**. Um servidor que pinga 1 byte a cada 9 s nunca estoura um \`timeout=10\` — e a resposta pode levar horas. Para limitar o total, você precisa de um **deadline** por fora. E o \`3.05\`? A documentação do \`requests\` sugere um timeout de conexão um pouco acima de um múltiplo de 3 s, a janela padrão de retransmissão de pacotes do TCP.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Timeout por chamada tem um ponto cego: numa **cadeia** de serviços, cada um conta o próprio relógio.',
        'O usuário desistiu em 2 s, mas lá no fundo o banco continua trabalhando para ninguém. A saída é um **deadline** propagado.',
      ],
      board: {
        title: 'Deadlines: um prazo para a cadeia inteira',
        md: `\`\`\`text
 SEM propagação — cada salto com o seu timeout fixo de 2 s:

   gateway ──2 s──▶ pedidos ──2 s──▶ estoque ──2 s──▶ banco
   o gateway desiste aos 2 s… mas estoque e banco seguem trabalhando
   para ninguém: trabalho zumbi

 COM deadline propagado — orçamento de 2 s definido na borda:

   gateway ───────▶ pedidos ───────▶ estoque ───────▶ banco
   restam 2,0 s     restam 1,8 s     restam 1,1 s     restam 0,4 s
\`\`\`

**As regras:**

1. Na **borda**, converta o orçamento em prazo **absoluto**: \`fim = agora + 2.0\`.
2. Antes de cada chamada: \`timeout = min(limite_da_chamada, fim - agora)\`.
3. **Não comece** o que não dá para terminar: se não sobrou tempo, falhe **já**.
4. **Propague** o que sobra num cabeçalho; quem recebe recalcula o prazo com o **próprio** relógio.

\`\`\`http
GET /estoque/sku-42 HTTP/1.1
Host: estoque.interno
X-Timeout-Ms: 1100
\`\`\`

\`\`\`python
def reservar(req):
    prazo = Deadline.de_cabecalhos(req.headers, padrao=2.0)  # quanto o chamador me deu
    validar(req)                                             # trabalho local: o prazo encolhe
    return prazo.chamar(estoque, maximo=0.5)                 # timeout = min(0,5 s, o que resta)
\`\`\`

> [!sabia] No gRPC, o deadline viaja no cabeçalho \`grpc-timeout\` como uma duração **relativa** (ex.: \`850m\` = 850 ms), não como um horário absoluto. É de propósito: os relógios das máquinas nunca estão perfeitamente sincronizados (*clock skew*), então cada servidor converte o "quanto falta" num prazo medido pelo **próprio** relógio. No Go, esse prazo anda pelo \`context.Context\`; no asyncio, \`asyncio.timeout_at()\` faz o papel do prazo absoluto.

> [!dica] Desconte uma pequena **margem** a cada salto (rede, serialização) e tenha um **mínimo útil**: se sobraram 5 ms para uma consulta que leva 50 ms, nem tente — falhe e libere o recurso.`,
      },
    },
    {
      type: 'say',
      text: [
        'Deu erro. Tento de novo? Antes, **duas** perguntas: o erro é **passageiro**? E é **seguro** repetir?',
        'Repetir um `400` só gera mais carga. E repetir um `POST` de pagamento pode cobrar o cliente **duas vezes**.',
      ],
      board: {
        title: 'Quando vale tentar de novo',
        md: `| Falha | Repetir? | Por quê |
|---|---|---|
| Conexão recusada, falha temporária de DNS | ✅ | o pedido **nem chegou** ao servidor |
| Timeout de **conexão** | ✅ | idem: não houve conversa |
| Timeout de **leitura** | ⚠️ só se for seguro repetir | o servidor **pode ter processado** — você não sabe! |
| \`408\`, \`429\`, \`502\`, \`503\`, \`504\` | ✅ | sobrecarga ou instabilidade passageira (respeite o \`Retry-After\`) |
| \`500\` | ⚠️ com moderação | pode ser passageiro… ou um bug que falha sempre |
| \`400\`, \`401\`, \`403\`, \`404\`, \`409\`, \`422\` | ❌ | o problema é o **pedido**: repetir dá o mesmo erro |

**Seguro repetir?** Pela RFC 9110, \`GET\`, \`HEAD\`, \`OPTIONS\`, \`TRACE\`, \`PUT\` e \`DELETE\` são **idempotentes**; \`POST\` e \`PATCH\` não. Para repetir um \`POST\` com segurança, mande uma **Idempotency-Key**: o servidor reconhece a repetição e devolve a resposta original.

\`\`\`python
import uuid

def cobrar(cliente, pedido):
    chave = str(uuid.uuid4())              # gerada UMA vez, antes da 1ª tentativa
    def tentativa():
        return cliente.post("/cobrancas", json=pedido, timeout=(1, 5),
                            headers={"Idempotency-Key": chave})   # a MESMA em todas
    return com_retry(tentativa)            # agora repetir o POST é seguro
\`\`\`

> [!atencao] Timeout é **ambíguo**: "não recebi resposta" não quer dizer "não aconteceu". E gerar uma Idempotency-Key **nova** a cada tentativa anula a proteção — para o servidor, cada tentativa vira uma cobrança diferente.`,
      },
    },
    {
      type: 'say',
      text: [
        'Vai repetir? Então **espere** entre as tentativas — e cada vez mais: é o **backoff exponencial**.',
        'Mas se mil clientes esperam exatamente 1, 2, 4 segundos, eles voltam **juntos**. O remédio é o **jitter**: sortear a espera.',
      ],
      board: {
        title: 'Backoff exponencial + jitter',
        md: `\`\`\`text
 SEM jitter: 1.000 clientes falham juntos… e voltam juntos
   carga ▲
         │ █        █                  █
         │ █        █                  █
         └─┴────────┴──────────────────┴────────▶ tempo
           0 s      1 s                3 s    (esperas de 1 s e 2 s)

 COM full jitter: as mesmas tentativas, espalhadas
   carga ▲
         │ ▃▂▃▃▂▂▃▂▃▂▂▃▂▂▂▃▂▂▃▂▂▃▂▂▂▃▂▂▃▂▂▂▂▃▂▂▁
         └──────────────────────────────────────▶ tempo
\`\`\`

| Estratégia | Espera no retry *n* (0, 1, 2…) | Comentário |
|---|---|---|
| Exponencial puro | \`min(teto, base * 2 ** n)\` | clientes sincronizados: rajadas |
| **Full jitter** | \`uniform(0, min(teto, base * 2 ** n))\` | simples e eficaz — um ótimo padrão |
| **Equal jitter** | \`m + uniform(0, m)\`, com \`m = min(teto, base * 2 ** n) / 2\` | garante uma espera mínima |
| **Decorrelated jitter** | \`min(teto, uniform(base, anterior * 3))\` | cada espera depende da **anterior**, não de *n* |

\`\`\`python
import random

def decorrelated_jitter(base, teto, rng):
    """Gera as esperas: cada uma sorteada entre base e 3x a anterior."""
    espera = base
    while True:
        espera = min(teto, rng.uniform(base, espera * 3))
        yield espera

esperas = decorrelated_jitter(0.1, 10.0, random.Random(42))   # semente fixa = reproduzível
primeira, segunda = next(esperas), next(esperas)
\`\`\`

> [!sabia] Os nomes *full*, *equal* e *decorrelated jitter* vêm de um post de 2015 de Marc Brooker no blog de arquitetura da AWS, *Exponential Backoff And Jitter*. Nas simulações dele, o backoff **sem** jitter foi de longe o pior; o *equal* ficou atrás; e *full* e *decorrelated* praticamente empataram — o *full* fazendo um pouco menos chamadas no total.

> [!dica] Injete \`sleep\` e \`rng\` (\`random.Random(seed)\`) na sua função de retry: os testes rodam instantâneos e **determinísticos**, sem dormir um segundo sequer.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o lado sombrio: retries **se multiplicam**. Se cada camada tenta 4 vezes, três camadas viram **64** chamadas no banco por clique.',
        'É a *retry storm*: o retry que devia ajudar vira a carga que mantém o sistema no chão.',
      ],
      board: {
        title: 'Retry storm e retry budget',
        md: `\`\`\`text
 navegador ──4×──▶ frontend ──4×──▶ backend ──4×──▶ banco (sobrecarregado)

 1 clique          =  4 × 4 × 4  =  64 tentativas no banco
 1.000 cliques/s   →  até 64.000 chamadas/s em quem JÁ estava caindo
\`\`\`

**Como domar:**

| Técnica | Ideia |
|---|---|
| **Repetir numa camada só** | em geral a mais próxima da falha; as de cima só repassam o erro |
| **Limite por requisição** | poucas tentativas (ex.: 3), sempre dentro do deadline |
| **Retry budget por cliente** | repetir só enquanto os retries forem menos de **10%** das chamadas (sugestão do livro de SRE do Google) |
| **Sinalizar "não repita"** | quem está sobrecarregado avisa (\`503\` com \`Retry-After\` longo, ou um erro "overloaded") e as camadas de cima param de insistir |
| **Circuit breaker** | dependência doente? pare de chamar — é a próxima aula! |

\`\`\`python
class RetryBudget:
    """Libera retries enquanto forem no máximo uma fração das chamadas."""

    def __init__(self, fracao=0.1, piso=10):
        self.fracao, self.piso = fracao, piso
        self.chamadas = 0
        self.retries = 0

    def registrar_chamada(self):
        self.chamadas += 1

    def pode_repetir(self):
        # o piso evita que um cliente com pouco tráfego fique sem retry nenhum;
        # na vida real, conte numa janela de tempo deslizante (ex.: últimos 10 s)
        if self.retries < max(self.piso, self.chamadas * self.fracao):
            self.retries += 1
            return True
        return False
\`\`\`

> [!sabia] O gRPC tem *retry throttling* embutido: cada canal mantém um saldo de fichas (\`maxTokens\`); cada falha tira 1, cada sucesso devolve uma fração (\`tokenRatio\`), e os retries **param** quando o saldo chega à metade. O Finagle, do Twitter, faz algo parecido com um *RetryBudget* que, por padrão, libera retries de até 20% das requisições (mais 10 por segundo).`,
      },
    },
    {
      type: 'say',
      text: [
        'Quando o servidor diz **quando** voltar, com `Retry-After`, ele sabe mais que o seu backoff. Obedeça.',
        'Só dois cuidados: se a espera estoura o seu deadline, desista **agora** — e some um pouco de jitter para não voltar junto com todo mundo.',
      ],
      board: {
        title: 'Respeitando o Retry-After',
        md: `\`\`\`http
HTTP/1.1 503 Service Unavailable
Retry-After: 30
\`\`\`

\`\`\`http
HTTP/1.1 429 Too Many Requests
Retry-After: Wed, 21 Oct 2026 07:28:00 GMT
\`\`\`

\`\`\`python
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

def segundos_do_retry_after(valor, agora=None):
    """Retry-After vem em segundos ("30") ou como data HTTP."""
    if valor.strip().isdigit():
        return int(valor)
    agora = agora or datetime.now(timezone.utc)
    return max(0.0, (parsedate_to_datetime(valor) - agora).total_seconds())
\`\`\`

| Situação | O que fazer |
|---|---|
| Veio \`Retry-After\` | espere **pelo menos** isso — e some um jitter pequeno |
| A espera passa do deadline | desista já: devolva o erro (ou o fallback) sem esperar à toa |
| \`Retry-After\` enorme numa chamada síncrona | não segure o usuário: falhe rápido ou mande o trabalho para uma fila |
| Não veio \`Retry-After\` | backoff exponencial com jitter, como sempre |

> [!atencao] Um \`Retry-After\` igual para todo mundo é um *thundering herd* com hora marcada: 10 mil clientes que ouviram "volte em 30 s" voltam no **mesmo** segundo. Por isso o cliente soma jitter — e servidores cuidadosos já variam o valor que enviam.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — com retry e deadline de verdade, sem dormir um segundo sequer.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'api-res-q1',
      concept: 'Retries e idempotência',
      say: 'Primeira: um clássico de entrevista — e de incidente.',
      prompt: 'Seu serviço faz `POST /cobrancas` (sem `Idempotency-Key`) num gateway de pagamento e recebe um **timeout de leitura** depois de 5 s. O que fazer?',
      options: [
        { text: 'Não repetir às cegas: a cobrança pode ter acontecido. Consultar o estado antes — e passar a enviar uma `Idempotency-Key` para poder repetir com segurança.', correct: true, why: 'Timeout de leitura é **ambíguo**: o pedido chegou, e a cobrança pode ter sido feita. Com a chave de idempotência, o gateway reconhece a repetição e devolve a resposta original.' },
        { text: 'Repetir imediatamente: timeout é falha passageira, então é retentável.', why: 'Passageira, talvez — mas `POST` não é idempotente. Repetir pode cobrar o cliente duas vezes: além de passageiro, o erro precisa ser **seguro** de repetir.' },
        { text: 'Repetir com backoff exponencial e jitter, no máximo 3 vezes.', why: 'O backoff decide **quando** repetir, não **se** é seguro repetir. Sem idempotência, 3 retries podem virar até 4 cobranças.' },
        { text: 'Aumentar o timeout de leitura para 60 s, para nunca mais perder uma resposta.', why: 'Só troca de problema: prende threads e o usuário por um minuto e ainda pode estourar. A ambiguidade continua — e a falta de idempotência também.' },
      ],
      explanation: 'Duas perguntas antes de repetir: o erro é **passageiro**? E a operação é **segura** de repetir (idempotente ou com `Idempotency-Key`)? Conexão recusada e timeout de **conexão** garantem que o pedido nem chegou; um timeout de **leitura** não garante nada — é o problema dos dois generais em miniatura. Por isso APIs de pagamento, como a do Stripe, aceitam `Idempotency-Key` nos `POST`.',
    },
    {
      type: 'match',
      id: 'api-res-q2',
      concept: 'Vocabulário de resiliência',
      say: 'Agora associe cada termo ao seu significado.',
      prompt: 'Associe cada **termo** ao que ele significa.',
      pairs: [
        { left: 'Timeout de conexão', right: 'Quanto esperar para estabelecer a conexão com o servidor' },
        { left: 'Timeout de leitura', right: 'Quanto esperar por bytes da resposta depois de conectado' },
        { left: 'Deadline', right: 'Instante absoluto em que a resposta deixa de ser útil, propagado pela cadeia' },
        { left: 'Full jitter', right: 'Espera sorteada entre zero e o teto exponencial da tentativa' },
        { left: 'Retry budget', right: 'Teto para a fração de chamadas que podem ser retries' },
        { left: 'Retry storm', right: 'Retries em várias camadas multiplicando a carga sobre quem já está doente' },
      ],
      explanation: 'Os timeouts limitam **uma** chamada; o **deadline** limita a requisição inteira e viaja pela cadeia. O **full jitter** espalha os retries no tempo, o **retry budget** limita quantos acontecem — e a **retry storm** é o que acontece sem esses dois, sobretudo com retries em várias camadas.',
    },
    {
      type: 'code',
      id: 'api-res-q3',
      concept: 'Retry com backoff e jitter',
      title: 'com_retry: backoff exponencial + full jitter',
      say: 'Agora implemente o seu retry. O sono e a sorte são injetados: os testes conferem cada espera com uma semente fixa.',
      prompt: `Implemente \`eh_retentavel(erro)\` e \`com_retry(operacao, *, tentativas, base, teto, sleep, rng)\`.

**\`eh_retentavel(erro)\`** devolve \`True\` para \`ConnectionError\` e \`TimeoutError\` (e subclasses) e para \`ErroHTTP\` com \`status\` em \`RETENTAVEIS\`; \`False\` para todo o resto.

**\`com_retry\`** chama \`operacao()\` até \`tentativas\` vezes **no total**:

- sucesso → devolve o resultado;
- erro **não** retentável → relança **na hora**, sem esperar;
- erro retentável na **última** tentativa → relança a exceção original (sem esperar à toa);
- senão, antes da próxima tentativa chama \`sleep(espera)\` com **full jitter**: na *n*-ésima falha (\`n = 1, 2, …\`), \`espera = rng.uniform(0, min(teto, base * 2 ** (n - 1)))\`;
- se o erro trouxer \`retry_after\` (diferente de \`None\`), **some** esse valor à espera: o servidor define o piso, e o jitter só espalha.

Use **exatamente uma** chamada a \`rng.uniform(...)\` por espera — é assim que os testes reproduzem a sequência com a semente.`,
      starter: `import random
import time

RETENTAVEIS = {408, 429, 500, 502, 503, 504}


class ErroHTTP(Exception):
    def __init__(self, status, retry_after=None):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.retry_after = retry_after     # segundos, vindos do cabeçalho Retry-After


def eh_retentavel(erro):
    # TODO
    pass


def com_retry(operacao, *, tentativas=4, base=0.1, teto=10.0, sleep=time.sleep, rng=None):
    rng = rng or random.Random()
    # TODO
    pass
`,
      tests: [
        {
          name: 'eh_retentavel: o que vale repetir',
          code: `casos = [(ErroHTTP(503), True), (ErroHTTP(404), False), (ConnectionError("recusada"), True), (TimeoutError(), True), (ValueError("bug"), False)]
for erro, esperado in casos:
    obtido = bool(eh_retentavel(erro))
    assert obtido == esperado, f"eh_retentavel({erro!r}) deveria ser {esperado}, veio {obtido}"`,
        },
        {
          name: 'sucesso de primeira: devolve o resultado e não espera',
          code: `import random
esperas = []
resultado = com_retry(lambda: "ok", sleep=esperas.append, rng=random.Random(1))
assert resultado == "ok", f"deveria devolver o resultado de operacao(); veio {resultado!r}"
assert esperas == [], f"sem falha não há espera; vieram {esperas}"`,
        },
        {
          name: 'falha passageira e depois sucesso: esperas com full jitter',
          code: `import math
import random
chamadas = []
def instavel():
    chamadas.append(1)
    if len(chamadas) < 3:
        raise ConnectionError("conexão recusada")
    return "saldo: 100"
esperas = []
resultado = com_retry(instavel, tentativas=4, base=0.1, teto=10, sleep=esperas.append, rng=random.Random(42))
assert resultado == "saldo: 100", f"deveria devolver o resultado da 3ª tentativa; veio {resultado!r}"
assert len(chamadas) == 3, f"deveria ter chamado 3 vezes; chamou {len(chamadas)}"
ref = random.Random(42)
esperado = [ref.uniform(0, 0.1), ref.uniform(0, 0.2)]
assert len(esperas) == 2, f"2 falhas = 2 esperas; vieram {len(esperas)}"
assert all(math.isclose(a, b) for a, b in zip(esperas, esperado)), f"com seed 42, as esperas deveriam ser {esperado}; vieram {esperas}"`,
        },
        {
          name: 'erro não retentável (422): relança na hora',
          code: `import random
chamadas = []
def invalido():
    chamadas.append(1)
    raise ErroHTTP(422)
esperas = []
try:
    com_retry(invalido, sleep=esperas.append, rng=random.Random(1))
    assert False, "um 422 deveria ser relançado para quem chamou"
except ErroHTTP as e:
    assert e.status == 422, f"deveria relançar o 422 original; veio {e.status}"
assert len(chamadas) == 1, f"422 não é retentável: deveria chamar 1 vez, chamou {len(chamadas)}"
assert esperas == [], f"sem retry, sem espera; vieram {esperas}"`,
        },
        {
          name: 'bug no código (ValueError) não é repetido',
          code: `import random
chamadas = []
def bug():
    chamadas.append(1)
    raise ValueError("índice errado")
try:
    com_retry(bug, sleep=lambda s: None, rng=random.Random(1))
    assert False, "o ValueError deveria ser relançado"
except ValueError:
    pass
assert len(chamadas) == 1, f"bug não se resolve tentando de novo: deveria chamar 1 vez, chamou {len(chamadas)}"`,
        },
        {
          name: 'esgota as tentativas: relança o original, sem esperar depois da última',
          code: `import math
import random
chamadas = []
def fora_do_ar():
    chamadas.append(1)
    raise ErroHTTP(503)
esperas = []
try:
    com_retry(fora_do_ar, tentativas=4, base=0.5, teto=10, sleep=esperas.append, rng=random.Random(7))
    assert False, "depois da última tentativa o erro deveria ser relançado"
except ErroHTTP as e:
    assert e.status == 503, f"deveria relançar o 503 original; veio {e.status}"
assert len(chamadas) == 4, f"tentativas=4 é o total de chamadas; foram {len(chamadas)}"
assert len(esperas) == 3, f"4 tentativas = 3 esperas (nada de esperar depois da última); vieram {len(esperas)}"
ref = random.Random(7)
esperado = [ref.uniform(0, 0.5), ref.uniform(0, 1.0), ref.uniform(0, 2.0)]
assert all(math.isclose(a, b) for a, b in zip(esperas, esperado)), f"com seed 7, esperado {esperado}; vieram {esperas}"`,
        },
        {
          name: 'respeita o Retry-After (somado ao jitter)',
          code: `import math
import random
respostas = [ErroHTTP(429, retry_after=2.0), "ok"]
def limitado():
    r = respostas.pop(0)
    if isinstance(r, Exception):
        raise r
    return r
esperas = []
assert com_retry(limitado, base=0.1, sleep=esperas.append, rng=random.Random(3)) == "ok", "depois do 429, a 2ª tentativa deveria devolver 'ok'"
ref = random.Random(3)
esperado = 2.0 + ref.uniform(0, 0.1)
assert len(esperas) == 1 and math.isclose(esperas[0], esperado), f"com Retry-After de 2 s, a espera deveria ser 2 + jitter = {esperado}; veio {esperas}"`,
        },
        {
          name: 'o teto limita o crescimento exponencial',
          hidden: true,
          code: `import math
import random
def sempre_timeout():
    raise TimeoutError("lento demais")
esperas = []
try:
    com_retry(sempre_timeout, tentativas=7, base=1, teto=4, sleep=esperas.append, rng=random.Random(99))
    assert False, "depois de 7 timeouts o TimeoutError deveria ser relançado"
except TimeoutError:
    pass
ref = random.Random(99)
esperado = [ref.uniform(0, limite) for limite in (1, 2, 4, 4, 4, 4)]
assert len(esperas) == 6, f"7 tentativas = 6 esperas; vieram {len(esperas)}"
assert all(math.isclose(a, b) for a, b in zip(esperas, esperado)), f"a partir da 3ª espera, o teto (4 s) deveria limitar o sorteio; esperado {esperado}, veio {esperas}"`,
        },
        {
          name: 'eh_retentavel: todos os status e exceções',
          hidden: true,
          code: `casos = [
    (ErroHTTP(408), True), (ErroHTTP(429), True), (ErroHTTP(500), True), (ErroHTTP(502), True),
    (ErroHTTP(503), True), (ErroHTTP(504), True), (ErroHTTP(400), False), (ErroHTTP(401), False),
    (ErroHTTP(403), False), (ErroHTTP(404), False), (ErroHTTP(409), False), (ErroHTTP(422), False),
    (ErroHTTP(501), False), (ConnectionRefusedError(), True), (ConnectionResetError(), True),
    (TimeoutError(), True), (KeyError("x"), False), (RuntimeError("x"), False),
]
for erro, esperado in casos:
    obtido = bool(eh_retentavel(erro))
    status = getattr(erro, "status", "-")
    assert obtido == esperado, f"eh_retentavel({erro!r}) (status {status}) deveria ser {esperado}, veio {obtido}"`,
        },
        {
          name: 'tentativas=1: nenhuma repetição',
          hidden: true,
          code: `import random
chamadas = []
def falha():
    chamadas.append(1)
    raise ConnectionResetError("reset")
esperas = []
try:
    com_retry(falha, tentativas=1, sleep=esperas.append, rng=random.Random(5))
    assert False, "com tentativas=1, a falha deveria ser relançada"
except ConnectionResetError:
    pass
assert len(chamadas) == 1 and esperas == [], f"tentativas=1: uma chamada e nenhuma espera; chamadas={len(chamadas)}, esperas={esperas}"`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /\btime\.sleep\s*\(/.test(code),
          text: 'Você chamou `time.sleep(...)` direto. Use o `sleep` **injetado**: é ele que deixa os testes instantâneos e permite conferir cada espera. Em produção, o valor padrão continua sendo o `time.sleep`.',
          concept: 'Injeção de dependências',
        },
        {
          when: (m, code) => /\brandom\.(random|uniform|randint|randrange|choice|gauss)\s*\(/.test(code),
          text: 'Você usou o `random` global do módulo. Com o `rng` injetado (`random.Random(seed)`), o jitter fica **reproduzível**: a mesma semente gera as mesmas esperas — nos testes e na hora de investigar um incidente.',
          concept: 'Aleatoriedade injetada',
        },
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo captura também `KeyboardInterrupt`, `SystemExit` e o cancelamento de tarefas. Use `except Exception as erro:`, decida com `eh_retentavel(erro)` e relance com `raise` puro.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => (m.recursive || []).includes('com_retry'),
          text: 'Retry recursivo funciona, mas cada tentativa empilha um frame e o traceback final fica confuso. Um `for n in range(1, tentativas + 1)` deixa o limite de tentativas explícito e fácil de ler.',
          concept: 'Retry',
        },
      ],
      hints: [
        'Em `eh_retentavel`, `isinstance(erro, (ConnectionError, TimeoutError))` já cobre as subclasses (`ConnectionResetError`…). Para `ErroHTTP`, confira `erro.status in RETENTAVEIS`.',
        'Estrutura: `for n in range(1, tentativas + 1):` com `try: return operacao()` e `except Exception as erro:`. Dentro do `except`, se o erro não for retentável **ou** se `n == tentativas`, use `raise` puro — ele relança a exceção original.',
        'A espera: `rng.uniform(0, min(teto, base * 2 ** (n - 1)))`; se `getattr(erro, "retry_after", None)` não for `None`, some esse valor. Depois, `sleep(espera)` — e o laço segue para a próxima tentativa.',
      ],
      solution: `import random
import time

RETENTAVEIS = {408, 429, 500, 502, 503, 504}


class ErroHTTP(Exception):
    def __init__(self, status, retry_after=None):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.retry_after = retry_after     # segundos, vindos do cabeçalho Retry-After


def eh_retentavel(erro):
    if isinstance(erro, (ConnectionError, TimeoutError)):
        return True
    return isinstance(erro, ErroHTTP) and erro.status in RETENTAVEIS


def com_retry(operacao, *, tentativas=4, base=0.1, teto=10.0, sleep=time.sleep, rng=None):
    rng = rng or random.Random()
    for n in range(1, tentativas + 1):
        try:
            return operacao()
        except Exception as erro:
            if not eh_retentavel(erro) or n == tentativas:
                raise                                             # relança o original
            espera = rng.uniform(0, min(teto, base * 2 ** (n - 1)))  # full jitter
            if getattr(erro, "retry_after", None) is not None:
                espera += erro.retry_after                        # o servidor define o piso
            sleep(espera)
`,
      solutionExplanation: 'O `for` deixa o limite explícito: `tentativas` é o **total** de chamadas. Dentro do `except` há duas saídas imediatas com `raise` puro, que preserva tipo e traceback: erro não retentável (repetir um `422` ou um bug só gera carga) e última tentativa (esperar depois dela seria tempo jogado fora). A espera usa **full jitter** — um sorteio entre 0 e o teto exponencial —, e o `Retry-After` entra como piso, com o jitter por cima para os clientes não voltarem todos juntos. Como `sleep` e `rng` são injetados, os testes checam cada espera com uma semente, sem dormir um milissegundo. Em produção, você ainda somaria um **deadline** (não esperar além do prazo) e um **retry budget**.',
    },
    {
      type: 'code',
      id: 'api-res-q4',
      concept: 'Propagação de deadline',
      title: 'Deadline propagado numa cadeia de serviços',
      say: 'Agora o deadline. Os testes montam uma cadeia de serviços simulados — pedidos, estoque, banco — movidos a relógio falso.',
      prompt: `Implemente a classe \`Deadline\`, que guarda um prazo **absoluto** medido pelo \`relogio\` injetado (em segundos):

- \`Deadline(segundos, relogio)\`: o prazo termina \`segundos\` depois de **agora**.
- \`restante()\`: quantos segundos faltam — **nunca negativo** (depois do prazo, \`0.0\`).
- \`expirou()\`: \`True\` quando não resta tempo.
- \`Deadline.de_cabecalhos(cabecalhos, relogio, padrao)\` (*classmethod*): lê o orçamento **relativo** do cabeçalho \`"X-Timeout-Ms"\` (milissegundos, em texto) e cria o prazo no relógio **local**; sem o cabeçalho, usa \`padrao\` segundos.
- \`chamar(servico, maximo)\` chama o próximo salto propagando o prazo:
  - se o prazo já expirou, lança \`DeadlineExcedido\` **sem chamar** \`servico\`;
  - senão, calcula \`timeout = min(maximo, restante())\` e devolve \`servico({"X-Timeout-Ms": str(int(timeout * 1000))})\`.

Nos testes, cada serviço simulado lê o cabeçalho com \`de_cabecalhos\`, "trabalha" (avança o relógio) e chama o próximo com \`chamar\` — e dá para ver o prazo encolhendo a cada salto.`,
      starter: `import time

CABECALHO = "X-Timeout-Ms"


class DeadlineExcedido(Exception):
    """O prazo acabou: nem vale a pena chamar o próximo salto."""


class Deadline:
    def __init__(self, segundos, relogio=time.monotonic):
        self._relogio = relogio
        # TODO: guarde o prazo ABSOLUTO

    @classmethod
    def de_cabecalhos(cls, cabecalhos, relogio=time.monotonic, padrao=5.0):
        # TODO: orçamento relativo (ms) do cabeçalho → novo Deadline
        pass

    def restante(self):
        # TODO
        pass

    def expirou(self):
        # TODO
        pass

    def chamar(self, servico, maximo):
        # TODO: falhe rápido ou chame servico({CABECALHO: "<ms>"})
        pass
`,
      tests: [
        {
          name: 'restante encolhe com o tempo e nunca fica negativo',
          code: `agora = [100.0]
d = Deadline(2.0, relogio=lambda: agora[0])
assert d.restante() == 2.0, f"recém-criado com 2 s: restante 2.0, veio {d.restante()}"
agora[0] = 101.5
assert d.restante() == 0.5, f"1.5 s depois: restante 0.5, veio {d.restante()}"
assert not d.expirou(), "ainda restam 0.5 s: não expirou"
agora[0] = 105.0
assert d.restante() == 0.0, f"depois do prazo, restante deveria ser 0.0 (nunca negativo), veio {d.restante()}"
assert d.expirou(), "depois do prazo, expirou() deveria ser True"`,
        },
        {
          name: 'chamar propaga o restante em milissegundos',
          code: `agora = [0.0]
d = Deadline(1.0, relogio=lambda: agora[0])
recebidos = []
def estoque(cabecalhos):
    recebidos.append(cabecalhos)
    return "12 unidades"
agora[0] = 0.25
resposta = d.chamar(estoque, maximo=5.0)
assert resposta == "12 unidades", f"chamar deveria devolver a resposta do serviço; veio {resposta!r}"
assert recebidos == [{"X-Timeout-Ms": "750"}], f"restavam 0.75 s → cabeçalho '750'; veio {recebidos}"`,
        },
        {
          name: 'o maximo da chamada limita o timeout',
          code: `agora = [0.0]
d = Deadline(10.0, relogio=lambda: agora[0])
recebidos = []
d.chamar(lambda cab: recebidos.append(cab), maximo=0.5)
assert recebidos == [{"X-Timeout-Ms": "500"}], f"restam 10 s, mas o limite desta chamada é 0.5 s → '500'; veio {recebidos}"`,
        },
        {
          name: 'prazo esgotado: falha rápido sem chamar o serviço',
          code: `agora = [0.0]
d = Deadline(1.0, relogio=lambda: agora[0])
agora[0] = 1.0
chamadas = []
try:
    d.chamar(lambda cab: chamadas.append(cab), maximo=5.0)
    assert False, "sem tempo restante, chamar deveria lançar DeadlineExcedido"
except DeadlineExcedido:
    pass
assert chamadas == [], "com o prazo esgotado, o serviço NÃO pode ser chamado (seria trabalho zumbi)"`,
        },
        {
          name: 'de_cabecalhos: orçamento relativo vira prazo no relógio local',
          code: `agora = [5000.0]
d = Deadline.de_cabecalhos({"X-Timeout-Ms": "1500"}, relogio=lambda: agora[0], padrao=30.0)
assert d.restante() == 1.5, f"'1500' ms → 1.5 s; veio {d.restante()}"
agora[0] = 5001.0
assert d.restante() == 0.5, f"1 s depois, restam 0.5 s; veio {d.restante()}"
sem = Deadline.de_cabecalhos({}, relogio=lambda: agora[0], padrao=30.0)
assert sem.restante() == 30.0, f"sem o cabeçalho, deveria usar o padrão (30 s); veio {sem.restante()}"`,
        },
        {
          name: 'cadeia pedidos → estoque → banco: o prazo encolhe a cada salto',
          code: `tempo = [0.0]
visitas = []

def servico(nome, custo, proximo=None, maximo=10.0):
    def handler(cabecalhos):
        prazo = Deadline.de_cabecalhos(cabecalhos, relogio=lambda: tempo[0], padrao=30.0)
        visitas.append((nome, prazo.restante()))
        tempo[0] += custo                          # o trabalho local consome tempo
        if proximo is None:
            return f"resposta do {nome}"
        return prazo.chamar(proximo, maximo)
    return handler

banco = servico("banco", 0.25)
estoque = servico("estoque", 0.25, banco)
pedidos = servico("pedidos", 0.25, estoque)
resposta = pedidos({"X-Timeout-Ms": "1000"})
assert resposta == "resposta do banco", f"a cadeia deveria chegar ao banco; veio {resposta!r}"
assert visitas == [("pedidos", 1.0), ("estoque", 0.75), ("banco", 0.5)], f"cada salto deveria receber só o que sobrou; visitas: {visitas}"`,
        },
        {
          name: 'cadeia sem tempo: o banco nem é chamado',
          code: `tempo = [0.0]
visitas = []

def servico(nome, custo, proximo=None, maximo=10.0):
    def handler(cabecalhos):
        prazo = Deadline.de_cabecalhos(cabecalhos, relogio=lambda: tempo[0], padrao=30.0)
        visitas.append((nome, prazo.restante()))
        tempo[0] += custo
        if proximo is None:
            return f"resposta do {nome}"
        return prazo.chamar(proximo, maximo)
    return handler

banco = servico("banco", 0.25)
estoque = servico("estoque", 0.25, banco)
pedidos = servico("pedidos", 0.25, estoque)
try:
    pedidos({"X-Timeout-Ms": "500"})
    assert False, "o orçamento acaba no estoque: deveria lançar DeadlineExcedido"
except DeadlineExcedido:
    pass
nomes = [nome for nome, _ in visitas]
assert nomes == ["pedidos", "estoque"], f"o banco não deveria ser chamado (trabalho zumbi); visitas: {visitas}"`,
        },
        {
          name: 'o prazo é absoluto: chamadas em sequência dividem o mesmo orçamento',
          hidden: true,
          code: `agora = [0.0]
d = Deadline(1.0, relogio=lambda: agora[0])
recebidos = []
agora[0] = 0.125
d.chamar(lambda cab: recebidos.append(cab["X-Timeout-Ms"]), maximo=5.0)
agora[0] = 0.875
d.chamar(lambda cab: recebidos.append(cab["X-Timeout-Ms"]), maximo=5.0)
assert recebidos == ["875", "125"], f"a 2ª chamada deveria receber só o que restou do MESMO prazo; veio {recebidos}"`,
        },
        {
          name: 'na cadeia, o salto com limite menor manda no cabeçalho',
          hidden: true,
          code: `tempo = [0.0]
visitas = []

def servico(nome, custo, proximo=None, maximo=10.0):
    def handler(cabecalhos):
        prazo = Deadline.de_cabecalhos(cabecalhos, relogio=lambda: tempo[0], padrao=30.0)
        visitas.append((nome, prazo.restante()))
        tempo[0] += custo
        if proximo is None:
            return f"resposta do {nome}"
        return prazo.chamar(proximo, maximo)
    return handler

banco = servico("banco", 0.125)
estoque = servico("estoque", 0.125, banco, maximo=0.25)
pedidos = servico("pedidos", 0.125, estoque)
pedidos({"X-Timeout-Ms": "2000"})
assert visitas == [("pedidos", 2.0), ("estoque", 1.875), ("banco", 0.25)], f"o estoque só espera 0.25 s pelo banco; visitas: {visitas}"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('monotonic') || m.calls.includes('perf_counter') || (m.calls.includes('time') && m.imports.includes('time')),
          text: 'Você chamou o relógio do sistema dentro da lógica. Use o `relogio` injetado: é ele que permite simular uma cadeia inteira de serviços — com o tempo andando exatamente quanto cada um "trabalha" — sem esperar nada.',
          concept: 'Injeção de relógio',
        },
        {
          when: m => m.calls.includes('sleep'),
          text: 'O deadline serve para **desistir cedo**, não para esperar: nada de `sleep` aqui. Se falta tempo, lance `DeadlineExcedido` na hora e libere o recurso.',
          concept: 'Propagação de deadline',
        },
        {
          when: m => m.maxComplexity > 8,
          text: 'Algum método ficou com muitos caminhos. Guarde **um** instante absoluto (`_fim`) e derive tudo dele: `restante()` é uma conta, `expirou()` usa `restante()` e `chamar()` só decide entre falhar e repassar.',
          concept: 'Coesão',
        },
      ],
      hints: [
        'No `__init__`, guarde o fim do prazo: `self._fim = relogio() + segundos`. Então `restante()` é `max(0.0, self._fim - self._relogio())`, e `expirou()` é `self.restante() <= 0`.',
        '`de_cabecalhos`: `ms = cabecalhos.get("X-Timeout-Ms")`; se veio, são `int(ms) / 1000` segundos, senão `padrao`. Devolva `cls(segundos, relogio)` — o prazo é recalculado no relógio **deste** servidor.',
        '`chamar`: se `self.restante() <= 0`, `raise DeadlineExcedido(...)` antes de tocar no serviço. Senão, `timeout = min(maximo, self.restante())` e `return servico({"X-Timeout-Ms": str(int(timeout * 1000))})`.',
      ],
      solution: `import time

CABECALHO = "X-Timeout-Ms"


class DeadlineExcedido(Exception):
    """O prazo acabou: nem vale a pena chamar o próximo salto."""


class Deadline:
    def __init__(self, segundos, relogio=time.monotonic):
        self._relogio = relogio
        self._fim = relogio() + segundos          # prazo ABSOLUTO, no relógio local

    @classmethod
    def de_cabecalhos(cls, cabecalhos, relogio=time.monotonic, padrao=5.0):
        ms = cabecalhos.get(CABECALHO)
        segundos = int(ms) / 1000 if ms is not None else padrao
        return cls(segundos, relogio)

    def restante(self):
        return max(0.0, self._fim - self._relogio())

    def expirou(self):
        return self.restante() <= 0

    def chamar(self, servico, maximo):
        restante = self.restante()
        if restante <= 0:
            raise DeadlineExcedido("prazo esgotado: nem vou chamar o próximo salto")
        timeout = min(maximo, restante)
        return servico({CABECALHO: str(int(timeout * 1000))})
`,
      solutionExplanation: 'O `Deadline` guarda **um instante absoluto** (`_fim`) e deriva tudo dele: `restante()` encolhe sozinho conforme o relógio anda, então várias chamadas em sequência dividem o **mesmo** orçamento. Entre serviços, porém, o prazo viaja **relativo** ("restam 750 ms"), e `de_cabecalhos` o converte de volta usando o relógio **local** — o mesmo truque do `grpc-timeout`, imune a relógios dessincronizados. `chamar` faz as duas coisas que importam: falha rápido quando não há tempo (o banco nem é incomodado) e manda ao próximo salto só o menor entre o seu limite e o que sobrou. O `int()` arredonda para baixo de propósito: nunca prometa mais tempo do que você tem.',
    },
    {
      type: 'mcq',
      id: 'api-res-q5',
      concept: 'Retry storm',
      say: 'Agora um pouco de aritmética de incidente.',
      prompt: 'Um clique passa por três saltos até o banco: `app → API → serviço de estoque → banco`. Cada salto usa a mesma política: até **3 tentativas** por chamada (1 + 2 retries). O banco está fora do ar. Quantas chamadas **o banco** recebe por clique?',
      options: [
        { text: '27', correct: true, why: 'Cada tentativa de um salto vira 3 tentativas no salto de baixo: 3 × 3 × 3 = 27. Os retries se **multiplicam** — é a *retry storm*.' },
        { text: '9', why: 'Seria o caso com só dois saltos repetindo. Aqui são três (app→API, API→estoque, estoque→banco): 3³ = 27.' },
        { text: '7', why: 'Seria verdade se os retries **somassem** (1 + 2 + 2 + 2). Mas cada retry de cima dispara uma nova rodada inteira de retries embaixo: eles **multiplicam**.' },
        { text: '3', why: 'Só o estoque chama o banco, mas cada chamada que **ele recebe** já foi multiplicada pelos saltos de cima.' },
      ],
      explanation: 'Retries em camadas se multiplicam: com *k* tentativas em cada um de *n* saltos, o fundo recebe *kⁿ* chamadas. O livro de SRE do Google dá o exemplo de 4 tentativas em 3 camadas: **64** chamadas no banco por ação do usuário. A defesa: repetir em **uma** camada só (em geral a mais próxima da falha), usar um *retry budget* e, quando estiver sobrecarregado, responder de um jeito que diga às camadas de cima "não repita".',
    },
    {
      type: 'open',
      id: 'api-res-q6',
      concept: 'Política de timeouts e retries',
      say: 'Última: uma revisão de design de integração. Me convença.',
      prompt: 'O checkout vai chamar um **provedor de frete** (`GET /cotacoes`) e um **gateway de pagamento** (`POST /cobrancas`). O time quer "colocar retry em tudo". Como você configuraria timeouts, retries e esperas para as duas chamadas?',
      minWords: 40,
      rubric: [
        { label: 'Define **timeouts** explícitos (conexão e leitura) e um **deadline** total', keywords: ['timeout', 'deadline', 'prazo', 'tempo limite', 'tempo maximo'], concept: 'Timeouts e deadlines', why: 'Sem timeout, uma dependência lenta prende threads e conexões; o deadline limita o tempo total, retries incluídos.' },
        { label: 'Repete só erros **passageiros** e operações **idempotentes** — o `POST` só com `Idempotency-Key`', keywords: ['idempot', 'retentav', 'chave de idempotencia', 'passageir', 'transitori', 'temporari', 'nao repetir', '4xx'], concept: 'Retries seguros', why: 'Repetir um 4xx só gera carga, e repetir um POST sem idempotência pode cobrar o cliente duas vezes.' },
        { label: 'Usa **backoff exponencial com jitter** e respeita o `Retry-After`', keywords: ['jitter', 'backoff', 'exponencial', 'retry-after', 'retry after', 'aleatori'], concept: 'Backoff + jitter', why: 'Sem espera crescente e aleatória, os retries martelam a dependência em sincronia justamente quando ela está fraca.' },
        { label: 'Limita os retries: poucas tentativas, **retry budget**, uma camada só (evita *retry storm*)', keywords: ['budget', 'orcamento de retr', 'retry storm', 'tempestade', 'amplifica', 'multiplica', 'maximo de tentativas', 'limite de tentativas', '3 tentativas', 'tres tentativas', 'uma camada', 'uma unica camada', 'circuit breaker'], concept: 'Retry budget', why: 'Retries sem teto multiplicam a carga entre camadas e podem manter a dependência caída.' },
      ],
      modelAnswer: `Primeiro, **timeouts** explícitos em tudo: conexão curta (~1 s) e leitura um pouco acima do p99 de cada provedor, dentro de um **deadline** total do checkout (ex.: 3 s) — nenhuma espera ou retry pode passar dele.

**Frete** (\`GET\`, idempotente): retry só para erros **passageiros** — conexão recusada, timeout, 429, 502, 503, 504 —, nunca para 4xx. No máximo 3 tentativas, com **backoff exponencial e full jitter**, respeitando o \`Retry-After\` quando vier; se a espera estourar o deadline, desisto e uso a última tabela de frete em cache.

**Pagamento** (\`POST\`, não idempotente): só repito com uma **Idempotency-Key** — a mesma chave em todas as tentativas —, porque um timeout de leitura é ambíguo e a cobrança pode ter acontecido. Sem a chave, consulto o estado da cobrança antes de repetir.

Por fim, limito a amplificação: retry numa **camada só** (o cliente HTTP do checkout, e não também o app e o gateway), um **retry budget** de uns 10% das chamadas e um circuit breaker por provedor — para não virar uma *retry storm* justamente quando eles estiverem caindo.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo trabalho! Agora suas integrações sabem **desistir na hora certa** e **insistir do jeito certo**.',
        { text: 'Resumo: timeout sempre, deadline propagado, retry só no que é passageiro e seguro, backoff com jitter, Retry-After como piso — e nada de retry storm.', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
