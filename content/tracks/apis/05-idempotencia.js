(function () {
  // Prelúdio dos testes do armazém de idempotência: relógio falso + handler que "cobra".
  const PRE_ARM = `class Relogio:
    def __init__(self, t=0.0):
        self.t = t
    def __call__(self):
        return self.t
    def avancar(self, s):
        self.t += s

chamadas = []
def criar_pagamento(payload):
    chamadas.append(payload["valor"])
    return 201, {"id": len(chamadas), "valor": payload["valor"]}

`;

  Game.registerModule('apis', {
    id: 'idempotencia',
    title: 'Idempotência e concorrência otimista',
    kind: 'lesson',
    level: 2,
    order: 12,
    unit: 'design',
    summary: 'Retries são inevitáveis: torne-os seguros com Idempotency-Key, evite lost update com ETag/If-Match e desconfie do "exactly-once".',
    concepts: ['Idempotency-Key', 'Retries seguros', 'Lost update', 'ETag / If-Match', 'Effectively-once'],
    takeaways: [
      'Timeout é **ambíguo**: a operação pode ter acontecido. Retries são inevitáveis, então quem precisa deduplicar é o **servidor**.',
      'Com `Idempotency-Key`, a chave é gerada **por operação** (não por tentativa); o servidor guarda a resposta e a devolve nos retries — `422` se o payload mudar, `409` se a original ainda estiver em andamento.',
      'Reserve a chave de forma **atômica** (restrição de unicidade) e libere-a se a operação falhar sem produzir efeito.',
      '*Lost update* se evita com concorrência otimista: `ETag` + `If-Match` → `412 Precondition Failed`; o `428 Precondition Required` obriga o cliente a mandar a condição.',
      '*Exactly-once* é ilusão: o alcançável é *at-least-once* + deduplicação (*effectively-once*), propagando a chave por toda a cadeia.',
    ],
    glossary: [
      { term: 'Idempotency-Key', aliases: ['Idempotency Key', 'chave de idempotência', 'chaves de idempotência'], definition: 'Cabeçalho HTTP com uma chave única **por operação**, gerada pelo cliente e repetida em todos os retries. O servidor guarda a resposta associada e a devolve sem reprocessar.' },
      { term: 'Lost update', aliases: ['atualização perdida', 'atualizações perdidas', 'lost updates'], definition: 'Anomalia em que duas escritas concorrentes partem da mesma versão e a última sobrescreve a primeira sem erro — a alteração de alguém simplesmente some.' },
      { term: 'Concorrência otimista', aliases: ['controle de concorrência otimista', 'optimistic concurrency', 'optimistic locking', 'lock otimista'], definition: 'Estratégia que não trava o recurso: cada escrita diz "só aplique se ainda estiver na versão que eu li" (ex.: `If-Match` com `ETag`). Se não estiver, falha (`412`) e o cliente relê e reaplica.' },
      { term: 'ETag', aliases: ['ETags', 'entity tag', 'entity tags'], definition: 'Identificador opaco de uma versão da representação, enviado no cabeçalho `ETag`. Usado em `If-Match` (escrita condicional) e `If-None-Match` (validação de cache). Pode ser forte (`"v4"`) ou fraco (`W/"v4"`).' },
      { term: 'Mid-air collision', aliases: ['mid-air collisions', 'colisão em pleno ar'], definition: 'Nome usado pelo MDN para o conflito de duas edições simultâneas do mesmo recurso — o cenário de *lost update* que `ETag` + `If-Match` detectam.' },
      { term: 'Effectively-once', aliases: ['effectively once', 'efetivamente uma vez'], definition: 'Garantia realista no lugar do "exactly-once": a mensagem pode ser entregue mais de uma vez (*at-least-once*), mas o **efeito** é aplicado uma única vez graças à deduplicação idempotente.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Imagine: o app envia um pagamento, a rede engasga e… **timeout**. O cliente tenta de novo. Resultado: duas cobranças.',
          'O culpado não é o retry — retry é obrigatório em sistemas distribuídos. O problema é o servidor não saber que é **a mesma** operação.',
        ],
        board: {
          title: 'Por que retries duplicam efeitos',
          md: `\`\`\`text
Cliente                              Servidor
   │── POST /pagamentos ──────────────▶│  cobra R$ 100      ✅
   │                                   │  grava no banco    ✅
   │◀─ ─ ─ resposta se perde ─ ─ ─ ✗   │
   │   (timeout: deu certo ou não?)    │
   │── POST /pagamentos (retry) ──────▶│  cobra R$ 100 de novo ❌
\`\`\`

O **timeout é ambíguo**. A requisição pode (1) nem ter chegado, (2) ter sido processada e a resposta se perdido, ou (3) ainda estar em processamento. O cliente **não consegue distinguir** os três casos.

| Estratégia do cliente | Resultado |
|---|---|
| Nunca repetir (*at-most-once*) | Pode **perder** o pagamento |
| Repetir até ter resposta (*at-least-once*) | Pode **cobrar duas vezes** |
| Repetir **+ servidor idempotente** | Efeito aplicado **uma vez** ✅ |

> [!atencao] Retries não vêm só do seu código: SDKs, proxies, load balancers, filas e o usuário apertando "Pagar" duas vezes também repetem requisições.`,
        },
      },
      {
        type: 'say',
        text: [
          '**Idempotente** é a operação que pode ser aplicada várias vezes com o mesmo efeito de aplicá-la uma vez só.',
          'Pela especificação HTTP, `GET`, `PUT`, `DELETE`, `HEAD` e `OPTIONS` são idempotentes. `POST` não — e é justamente ele que cria pedidos e pagamentos.',
        ],
        board: {
          title: 'Idempotência no HTTP',
          md: `\`\`\`python
# idempotente: aplicar 1 ou N vezes dá no mesmo
saldo = 100      # "defina o saldo como 100"   (estilo PUT)

# NÃO idempotente: cada repetição muda o estado
saldo += 100     # "some 100 ao saldo"          (estilo POST)
\`\`\`

| Método | Idempotente? | Observação |
|---|---|---|
| \`GET\` / \`HEAD\` | Sim (e *safe*) | Não alteram estado |
| \`PUT\` | Sim | "Substitua o recurso por **este** estado" |
| \`DELETE\` | Sim | O 2º pode responder \`404\`, mas o **estado** é o mesmo |
| \`POST\` | **Não** | "Crie **mais um**" |
| \`PATCH\` | Depende | \`{"op": "incrementar"}\` não é; \`{"nome": "Ana"}\` é |

> [!dica] Idempotência fala do **efeito no servidor**, não da resposta: o segundo \`DELETE\` devolver \`404\` não quebra nada. E é uma **promessa** que a implementação precisa cumprir — o verbo sozinho não garante coisa alguma.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'A solução padrão para tornar um `POST` seguro para retry é o cabeçalho **`Idempotency-Key`**, popularizado pela Stripe e hoje um *draft* da IETF.',
          'O cliente gera uma chave única **por operação** — não por tentativa! — e a reenvia em todos os retries. O servidor guarda a resposta associada a ela.',
        ],
        board: {
          title: 'O cabeçalho Idempotency-Key',
          md: `\`\`\`http
POST /pagamentos HTTP/1.1
Host: api.loja.com
Content-Type: application/json
Idempotency-Key: 5f0c2a8e-9b1d-4c6e-a3f7-1d2e3f4a5b6c

{"pedido": 981, "valor": 10000, "moeda": "BRL"}
\`\`\`

\`\`\`http
HTTP/1.1 201 Created
Location: /pagamentos/pay_42

{"id": "pay_42", "status": "aprovado"}
\`\`\`

| Ao receber a chave… | Resposta do servidor |
|---|---|
| Chave **nova** | Processa, **armazena** status + corpo e responde |
| Chave conhecida, **mesmo** payload, concluída | Devolve a resposta armazenada **sem reprocessar** |
| Chave conhecida, payload **diferente** | \`422 Unprocessable Content\` (uso indevido da chave) |
| Chave conhecida, original **ainda em andamento** | \`409 Conflict\` (tente de novo daqui a pouco) |
| Endpoint exige a chave e ela não veio | \`400 Bad Request\` |

> [!dica] A chave é gerada pelo **cliente** (um UUID v4 serve), tem **escopo** por cliente/conta e **expira** (a Stripe guarda por 24 h). Para detectar reuso indevido, o servidor compara uma **impressão digital** (*fingerprint*) do corpo — por exemplo, um hash do JSON canônico.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Na implementação mora uma sutileza: "ver se a chave existe" e "registrar a chave" precisam ser **uma única operação atômica**.',
          'Senão, dois retries simultâneos passam juntos pela verificação e os dois cobram. No banco, uma **restrição de unicidade** na coluna da chave resolve.',
        ],
        board: {
          title: 'Armazém de idempotência: o esqueleto',
          md: `\`\`\`python
def processar(chave, payload, handler):
    impressao = hash_canonico(payload)       # json.dumps(..., sort_keys=True) + sha256
    # 1) RESERVA atômica: INSERT ... ON CONFLICT DO NOTHING
    if not reservar(chave, impressao):       # a chave já existia
        entrada = buscar(chave)
        if entrada.impressao != impressao:
            return 422, "chave reutilizada com outro payload"
        if entrada.estado == "em_andamento":
            return 409, "requisição original ainda em andamento"
        return entrada.resposta              # replay: NÃO reprocessa
    # 2) EXECUTA o efeito
    try:
        resposta = handler(payload)
    except ErroTransitorio:
        liberar(chave)       # nada aconteceu: o próximo retry pode reexecutar
        raise
    # 3) GUARDA a resposta (de preferência na MESMA transação do efeito)
    concluir(chave, resposta)
    return resposta
\`\`\`

> [!atencao] O bug mais comum é do lado do **cliente**: gerar um UUID novo **dentro** do loop de retry. Cada tentativa vira uma operação diferente e a proteção evapora. Gere a chave **uma vez**, antes da primeira tentativa, e guarde-a junto com a operação pendente.`,
          caption: 'Se o efeito e o registro da resposta ficam em transações separadas, uma queda entre os dois deixa a chave "em andamento" para sempre — por isso existem TTL e rotinas de recuperação.',
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora outro tipo de estrago: dois clientes editando **o mesmo recurso**. Os dois leem a versão 3, cada um altera um campo e salva.',
          'Quem salva por último apaga a alteração do outro, sem erro nenhum. É o **lost update** — e o `PUT` ser idempotente não protege contra ele!',
        ],
        board: {
          title: 'Lost update e concorrência otimista',
          md: `\`\`\`text
t1  Ana    GET /produtos/7  → "v3" {preço: 50, estoque: 10}
t2  Bruno  GET /produtos/7  → "v3" {preço: 50, estoque: 10}
t3  Ana    PUT {preço: 45, estoque: 10}   → "v4"
t4  Bruno  PUT {preço: 50, estoque: 8}    → "v5"   ← o preço 45 da Ana sumiu!
\`\`\`

**Concorrência otimista**: nada fica travado; cada escrita diz "só aplique se o recurso **ainda** estiver na versão que eu li".

\`\`\`http
PUT /produtos/7 HTTP/1.1
If-Match: "v3"
Content-Type: application/json

{"preco": 50, "estoque": 8}
\`\`\`

\`\`\`http
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json

{"title": "O recurso mudou desde a sua leitura", "status": 412}
\`\`\`

| Cabeçalho | Significado |
|---|---|
| \`ETag: "v4"\` | (resposta) identifica a versão atual da representação |
| \`If-Match: "v3"\` | só aplique se a versão atual for \`"v3"\`; senão \`412\` |
| \`If-Match: *\` | só aplique se o recurso **existir** |
| \`If-None-Match: *\` | só aplique se **não existir** (cria sem sobrescrever) |

> [!sabia] O MDN chama esse cenário de ***mid-air collision*** ("colisão em pleno ar"). E existe um status pouco conhecido para obrigar o cliente a se proteger: **\`428 Precondition Required\`** (RFC 6585) — o servidor recusa escritas que chegam **sem** \`If-Match\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Recebeu `412`? Não repita às cegas: releia o recurso, reaplique a **sua mudança** sobre a versão nova (ou mostre o conflito ao usuário) e reenvie com o ETag novo.',
          'E um detalhe que pega muita gente: `If-Match` usa **comparação forte** — um ETag fraco (`W/"..."`) nunca casa numa escrita condicional.',
        ],
        board: {
          title: 'Depois do 412 — e ETags fortes × fracos',
          md: `\`\`\`python
def salvar(cliente, url, alterar, tentativas=3):
    for _ in range(tentativas):
        status, etag, corpo = cliente.get(url)
        novo = alterar(corpo)                  # reaplica sobre a versão ATUAL
        status, _ = cliente.put(url, novo, if_match=etag)
        if status != 412:
            return status
    raise ConflitoPersistente(url)             # disputa demais: avise o usuário
\`\`\`

| | ETag forte \`"v4"\` | ETag fraco \`W/"v4"\` |
|---|---|---|
| Promete | Bytes idênticos | Conteúdo equivalente |
| \`If-None-Match\` (cache) | Casa | Casa (comparação fraca) |
| \`If-Match\` (escrita) | Casa | **Nunca casa** |

| Otimista (\`ETag\` + \`If-Match\`) | Pessimista (lock) |
|---|---|
| Não trava; detecta o conflito na escrita | Trava o recurso durante a edição |
| Ideal com pouca disputa e HTTP *stateless* | Evita retrabalho quando a disputa é alta |
| Custo: reler e reaplicar no \`412\` | Custo: locks esquecidos, timeouts, deadlocks |`,
          caption: 'Use um contador de versão ou um hash do conteúdo como ETag — não o horário da última gravação (resolução de 1 s e relógios que discordam).',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Por fim, desconfie de quem promete **exactly-once**. Numa rede que perde mensagens, *entregar* exatamente uma vez é impossível.',
          'O que dá para construir é entrega *at-least-once* **mais** processamento idempotente: a mensagem pode chegar várias vezes, mas o efeito acontece uma.',
        ],
        board: {
          title: '"Exactly-once" é uma ilusão (útil)',
          md: `| Garantia | Como se obtém | Risco |
|---|---|---|
| *At-most-once* | Enviar e nunca repetir | Perder operações |
| *At-least-once* | Repetir até receber confirmação | Duplicar operações |
| *Exactly-once* na **entrega** | — | Impossível com falhas de rede |
| **Efeito único** | *at-least-once* + deduplicação idempotente | Custo de guardar chaves |

> [!sabia] Por isso há quem prefira o termo ***effectively-once*** — o Apache Pulsar o usa nas garantias do Pulsar Functions. Até o "exactly-once" do Kafka é, por baixo, *at-least-once* + deduplicação (produtor idempotente com número de sequência) + transações.

**A cadeia inteira precisa ser idempotente.** Se o seu serviço chama um gateway de pagamento, **propague** a chave — ou derive uma estável, como \`pedido-981-cobranca\`. Senão, o **seu** retry vira uma cobrança duplicada **lá**.

> [!atencao] Quando **não** vale a pena: leituras e operações naturalmente idempotentes (\`PUT\` de estado completo, \`DELETE\`). A chave tem custo: armazenamento, TTL, limpeza e clientes disciplinados.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Retries seguros, status de conflito e escrita condicional.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-idem-q1',
        concept: 'Idempotency-Key por operação',
        say: 'Primeira: um bug que aparece em code review toda semana. Olhe o laço com atenção.',
        prompt: `O app envia pagamentos assim. O que está errado?

\`\`\`python
for tentativa in range(3):
    try:
        resp = http.post("/pagamentos", json=pedido, timeout=5,
                         headers={"Idempotency-Key": str(uuid.uuid4())})
        break
    except TimeoutError:
        continue
\`\`\``,
        options: [
          { text: 'A chave muda a cada tentativa: para o servidor são operações **diferentes**, e um timeout seguido de retry ainda cobra duas vezes. A chave deve ser gerada **uma vez**, antes do laço.', correct: true, why: 'Exato. A chave identifica a **operação**, não a tentativa. Ela nasce junto com a intenção de pagar — e deve ser salva com a operação pendente, para sobreviver até a um reinício do app.' },
          { text: '`uuid4()` pode colidir; o certo seria `uuid1()`, baseado no relógio.', why: 'Um UUID v4 tem 122 bits aleatórios: colisão é desprezível. E o `uuid1()` ainda expõe o horário e o endereço MAC. O problema não é colisão — é a chave **mudar** a cada tentativa.' },
          { text: 'Nada: o servidor percebe que o corpo é idêntico e descarta a duplicata.', why: 'O servidor deduplica pela **chave**, não pelo corpo — e nem poderia usar só o corpo: duas compras legítimas de R$ 100 seguidas têm o mesmo JSON. Com chaves diferentes, ele processa as duas.' },
          { text: 'O erro é repetir um `POST`: sem garantia de exactly-once, o certo é nunca fazer retry de `POST`.', why: 'Isso é *at-most-once*: troca a cobrança duplicada por pagamentos **perdidos**. Com uma chave estável, o retry do `POST` fica seguro — é para isso que o cabeçalho existe.' },
        ],
        explanation: 'A `Idempotency-Key` é gerada pelo **cliente**, **uma vez por operação**, e repetida em todas as tentativas — inclusive depois de um reinício do app, por isso ela deve ser persistida junto com a operação pendente. SDKs maduros, como o da Stripe, fazem isso sozinhos: geram a chave antes da primeira tentativa e a reaproveitam nos retries automáticos.',
      },
      {
        type: 'match',
        id: 'api-idem-q2',
        concept: 'Status de idempotência e escrita condicional',
        say: 'Agora os status codes desse mundo. Associe cada situação à resposta certa.',
        prompt: 'Associe cada situação à resposta que o servidor deve dar.',
        pairs: [
          { left: 'Retry com a mesma chave e o mesmo corpo; a original já terminou', right: 'A resposta **guardada** da original (ex.: `201`), sem reprocessar' },
          { left: 'Mesma `Idempotency-Key`, corpo diferente', right: '`422 Unprocessable Content`' },
          { left: 'Mesma chave enquanto a original ainda está processando', right: '`409 Conflict`' },
          { left: '`PUT` com `If-Match` de uma versão que já não é a atual', right: '`412 Precondition Failed`' },
          { left: 'O servidor exige escrita condicional e o `PUT` veio sem `If-Match`', right: '`428 Precondition Required`' },
          { left: 'O endpoint exige `Idempotency-Key` e ela não veio', right: '`400 Bad Request`' },
        ],
        explanation: 'O replay, o `422`, o `409` e o `400` vêm do *draft* da IETF para o `Idempotency-Key`. O `412` e o `428` (RFC 6585) são das escritas condicionais. Repare na diferença de conselho para o cliente: o `409` diz "espere e repita **a mesma** requisição"; o `412` diz "sua premissa ficou velha: **releia** antes de tentar de novo".',
      },
      {
        type: 'code',
        id: 'api-idem-q3',
        concept: 'Armazém de idempotência',
        title: 'Middleware de Idempotency-Key',
        say: 'Agora implemente o armazém de idempotência — com relógio injetado e um retry "concorrente" simulado sem threads.',
        prompt: `Implemente \`ArmazemIdempotencia(ttl, relogio)\`, o "middleware" que fica na frente do handler de pagamentos. \`relogio()\` devolve o agora em segundos (nos testes, um relógio falso).

\`processar(chave, payload, handler)\` devolve uma tupla \`(status, corpo)\`:

- **Sem chave** (\`None\` ou \`""\`): \`(400, {...})\`, sem chamar o handler.
- **Chave nova:** **reserve** a chave como *em andamento*, chame \`handler(payload)\` e **guarde** a resposta que ele devolver — qualquer status (um \`402\` de cartão recusado também é resposta).
- **Chave conhecida:** payload diferente → \`(422, {...})\`; original ainda em andamento → \`(409, {...})\`; concluída → a resposta **guardada**, sem chamar o handler.
- Se o handler **lançar exceção**, nada foi feito: **libere** a chave e repasse a exceção — o próximo retry reexecuta.
- A chave **expira** \`ttl\` segundos depois de reservada; a partir daí, é tratada como nova.

Dois payloads com os mesmos campos em outra ordem são o **mesmo** payload. E como não há threads, o teste simula o retry concorrente chamando \`processar\` de novo **de dentro** do handler.`,
        starter: `import json
import time


class ArmazemIdempotencia:
    def __init__(self, ttl=86400, relogio=time.monotonic):
        self.ttl = ttl
        self._relogio = relogio
        self._entradas = {}   # chave -> o que você precisar guardar

    def processar(self, chave, payload, handler):
        # TODO: 400 / reserva / 422 / 409 / replay / libera na exceção / TTL
        pass
`,
        tests: [
          {
            name: 'chave nova: executa o handler e devolve a resposta',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
r = arm.processar("k1", {"valor": 100}, criar_pagamento)
assert r == (201, {"id": 1, "valor": 100}), f"a 1ª chamada deveria devolver a resposta do handler, veio {r!r}"
assert chamadas == [100], f"o handler deveria rodar uma vez, rodou {len(chamadas)}"`,
          },
          {
            name: 'retry com a mesma chave: resposta guardada, sem cobrar de novo',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
r1 = arm.processar("k1", {"valor": 100}, criar_pagamento)
r2 = arm.processar("k1", {"valor": 100}, criar_pagamento)
assert r2 == r1, f"o retry deveria devolver a MESMA resposta ({r1!r}), veio {r2!r}"
assert chamadas == [100], f"cobrou {len(chamadas)} vezes: o retry não pode chamar o handler"`,
          },
          {
            name: 'chaves diferentes são operações diferentes',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
assert arm.processar("k1", {"valor": 100}, criar_pagamento) == (201, {"id": 1, "valor": 100})
assert arm.processar("k2", {"valor": 100}, criar_pagamento) == (201, {"id": 2, "valor": 100})
assert chamadas == [100, 100], "duas chaves = duas operações legítimas"`,
          },
          {
            name: 'mesma chave com outro payload → 422, sem chamar o handler',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
arm.processar("k1", {"valor": 100}, criar_pagamento)
status, _ = arm.processar("k1", {"valor": 999}, criar_pagamento)
assert status == 422, f"reuso da chave com outro payload deveria dar 422, veio {status}"
assert chamadas == [100], "o payload diferente NÃO pode ser processado"`,
          },
          {
            name: 'sem chave → 400',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
for chave in (None, ""):
    status, _ = arm.processar(chave, {"valor": 100}, criar_pagamento)
    assert status == 400, f"chave {chave!r} deveria dar 400, veio {status}"
assert chamadas == [], "sem chave, o handler não pode rodar"`,
          },
          {
            name: 'retry durante o processamento da original → 409',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
retry = []
def pagamento_lento(payload):
    # enquanto a original processa, chega um retry com a MESMA chave
    retry.append(arm.processar("k1", payload, criar_pagamento))
    return criar_pagamento(payload)
r = arm.processar("k1", {"valor": 100}, pagamento_lento)
assert retry[0][0] == 409, f"o retry durante o processamento deveria dar 409, veio {retry[0]!r}"
assert chamadas == [100], f"cobrou {len(chamadas)} vezes: reserve a chave ANTES de chamar o handler"
assert r == (201, {"id": 1, "valor": 100}), f"a original deveria terminar normalmente, veio {r!r}"
assert arm.processar("k1", {"valor": 100}, criar_pagamento) == r, "depois de concluída, o retry recebe a resposta guardada"`,
          },
          {
            name: 'exceção no handler libera a chave; o retry reexecuta',
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
tentativas = []
def instavel(payload):
    tentativas.append(1)
    if len(tentativas) == 1:
        raise ConnectionError("gateway caiu antes de cobrar")
    return criar_pagamento(payload)
try:
    arm.processar("k1", {"valor": 100}, instavel)
    assert False, "a exceção do handler deveria ser repassada"
except ConnectionError:
    pass
r = arm.processar("k1", {"valor": 100}, instavel)
assert r == (201, {"id": 1, "valor": 100}), f"depois da falha, o retry deveria reexecutar; veio {r!r}"`,
          },
          {
            name: 'a chave expira depois de ttl segundos',
            hidden: true,
            setup: PRE_ARM,
            code: `rel = Relogio(1000)
arm = ArmazemIdempotencia(ttl=60, relogio=rel)
arm.processar("k1", {"valor": 100}, criar_pagamento)
rel.avancar(59)
assert arm.processar("k1", {"valor": 100}, criar_pagamento) == (201, {"id": 1, "valor": 100})
assert chamadas == [100], "antes do ttl, o retry ainda é deduplicado"
rel.avancar(1)
r = arm.processar("k1", {"valor": 100}, criar_pagamento)
assert r == (201, {"id": 2, "valor": 100}), f"passado o ttl, a chave expirou e a operação é nova; veio {r!r}"`,
          },
          {
            name: 'mesmos campos em outra ordem = mesmo payload',
            hidden: true,
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
arm.processar("k1", {"valor": 100, "moeda": "BRL"}, criar_pagamento)
r = arm.processar("k1", {"moeda": "BRL", "valor": 100}, criar_pagamento)
assert r == (201, {"id": 1, "valor": 100}), f"a ordem dos campos não muda o payload; veio {r!r}"`,
          },
          {
            name: 'resposta de erro devolvida pelo handler também é guardada',
            hidden: true,
            setup: PRE_ARM,
            code: `arm = ArmazemIdempotencia(ttl=86400, relogio=Relogio())
def recusado(payload):
    chamadas.append(payload["valor"])
    return 402, {"erro": "cartão recusado"}
arm.processar("k1", {"valor": 100}, recusado)
r = arm.processar("k1", {"valor": 100}, recusado)
assert r == (402, {"erro": "cartão recusado"}), f"o retry deveria receber o mesmo 402, veio {r!r}"
assert chamadas == [100], "a recusa é uma resposta: o retry não pode tentar cobrar de novo"`,
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('monotonic') || m.calls.includes('perf_counter') || (m.calls.includes('time') && m.imports.includes('time')),
            text: 'Você chamou o relógio do sistema dentro da lógica. Use sempre o `relogio` injetado: é ele que permite testar "a chave expirou depois de 24 h" sem esperar 24 horas.',
            concept: 'Injeção de relógio',
          },
          {
            when: m => m.calls.includes('hash'),
            text: 'Cuidado com `hash()` como impressão digital: para `str`, ele é **randomizado por processo** (`PYTHONHASHSEED`). Duas réplicas do servidor calculariam impressões diferentes para o mesmo payload — e um retry que caísse na outra réplica levaria `422`. Use `json.dumps(payload, sort_keys=True)` e, para encurtar, `hashlib.sha256`.',
            concept: 'Impressão digital do payload',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo captura também `KeyboardInterrupt` e o cancelamento de tarefas. Para liberar a chave, use `except Exception:` e **relance** com `raise`.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.maxComplexity > 10,
            text: '`processar` ficou com caminhos demais. Extraia `_buscar(chave)` (que já cuida da expiração) e um método para responder a uma chave conhecida — o fluxo principal deve caber numa leitura.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Guarde, por chave, um dict com `impressao` (o payload normalizado), `estado` (`"em_andamento"` ou `"concluida"`), `resposta` e `criada_em`. Para normalizar: `json.dumps(payload, sort_keys=True)`.',
          'A ordem importa: (1) sem chave → `400`; (2) busque a entrada — se `relogio() - criada_em >= ttl`, apague e trate como nova; (3) conhecida → `422`, `409` ou a resposta guardada; (4) nova → **reserve antes** de chamar o handler.',
          'Envolva a chamada ao handler em `try:` / `except Exception:` — no `except`, `del self._entradas[chave]` e `raise`. Depois do sucesso, marque a entrada como `"concluida"` e guarde a resposta.',
        ],
        solution: `import json
import time


class ArmazemIdempotencia:
    def __init__(self, ttl=86400, relogio=time.monotonic):
        self.ttl = ttl
        self._relogio = relogio
        self._entradas = {}   # chave -> {impressao, estado, resposta, criada_em}

    def processar(self, chave, payload, handler):
        if not chave:
            return 400, {"erro": "Idempotency-Key obrigatória"}
        impressao = json.dumps(payload, sort_keys=True)
        entrada = self._buscar(chave)
        if entrada is not None:
            if entrada["impressao"] != impressao:
                return 422, {"erro": "chave reutilizada com outro payload"}
            if entrada["estado"] == "em_andamento":
                return 409, {"erro": "requisição original ainda em andamento"}
            return entrada["resposta"]            # replay: NÃO reprocessa
        # reserva ANTES do efeito (num banco: INSERT com restrição de unicidade)
        self._entradas[chave] = {"impressao": impressao, "estado": "em_andamento",
                                 "resposta": None, "criada_em": self._relogio()}
        try:
            resposta = handler(payload)
        except Exception:
            del self._entradas[chave]             # nada aconteceu: libera para o retry
            raise
        self._entradas[chave].update(estado="concluida", resposta=resposta)
        return resposta

    def _buscar(self, chave):
        entrada = self._entradas.get(chave)
        if entrada is not None and self._relogio() - entrada["criada_em"] >= self.ttl:
            del self._entradas[chave]             # expirou: esquece a chave
            return None
        return entrada
`,
        solutionExplanation: 'O coração é a **reserva antes do efeito**: a entrada nasce `em_andamento`, então um retry que chega durante o processamento recebe `409` em vez de cobrar de novo. A impressão digital com `json.dumps(..., sort_keys=True)` torna a comparação independente da ordem dos campos (em produção, guarde um `sha256` dela). Exceção significa "nada aconteceu": a chave é **liberada** e a exceção, repassada. Já uma resposta devolvida — até um `402` — é guardada, como faz a Stripe. O TTL é checado de forma **preguiçosa**, na leitura, com o relógio injetado. Num banco de verdade, a reserva seria um `INSERT` com restrição de unicidade; aqui o `dict` só é "atômico" porque não há threads.',
      },
      {
        type: 'order',
        id: 'api-idem-q4',
        concept: 'Concorrência otimista',
        say: 'Agora a concorrência otimista em ação. Coloque a história na ordem.',
        prompt: 'Ana edita o produto 7 enquanto outra pessoa também o altera. Ordene o que acontece com concorrência otimista.',
        items: [
          '`GET /produtos/7` → `200` com `ETag: "v3"`',
          'Ana altera a representação localmente',
          '`PUT /produtos/7` com `If-Match: "v3"`',
          'O servidor vê que a versão atual já é `"v4"` e responde `412 Precondition Failed`',
          'Ana relê o produto e recebe `ETag: "v4"`',
          'Ela reaplica a mudança sobre a versão nova e reenvia com `If-Match: "v4"` → `200` e `ETag: "v5"`',
        ],
        explanation: 'É o laço **ler → modificar → escrever condicionalmente**. O `412` não é um erro fatal: é o servidor avisando que a premissa ("o recurso está na v3") ficou velha. O cliente relê e **reaplica a própria mudança** — nunca reenvia o documento antigo — ou, se as mudanças conflitarem, mostra o conflito para a pessoa decidir. Se o `412` virar rotina, a disputa é alta: considere um lock ou operações mais finas (um `PATCH` só do campo alterado).',
      },
      {
        type: 'code',
        id: 'api-idem-q5',
        concept: 'ETag e If-Match',
        title: 'Escrita condicional com ETag',
        say: 'Agora o outro lado: o servidor que recusa o lost update com ETag e If-Match.',
        prompt: `Implemente o lado **servidor** da escrita condicional: \`ServidorProdutos(produtos, exigir_if_match=False)\`. \`produtos\` é um dict \`{id: dados}\`; todo produto começa na **versão 1**, com o ETag **forte** \`"v1"\` — as aspas fazem parte do valor (em Python, \`'"v1"'\`).

- \`get(pid)\` → \`(200, etag, dados)\`; inexistente → \`(404, None, None)\`.
- \`put(pid, dados, if_match=None)\` → \`(status, etag)\`, checando **nesta ordem**:
  1. produto inexistente → \`(404, None)\`;
  2. sem \`if_match\` e o servidor exige condição → \`(428, None)\`;
  3. \`if_match\` presente que não casa → \`(412, None)\`;
  4. senão, substitui os dados, incrementa a versão e devolve \`(200, novo_etag)\`.
- \`if_match\` casa se for \`*\` (qualquer versão existente) ou se **algum** ETag da lista separada por vírgulas (\`'"v2", "v3"'\`) for **igual** ao atual. A comparação é **forte**: um ETag fraco (\`W/"v1"\`) nunca casa.
- O servidor nunca compartilha objetos com quem chama: copie os dados na **entrada** e na **saída** (\`copy.deepcopy\`). Só um \`PUT\` bem-sucedido muda o estado.`,
        starter: `import copy


class ServidorProdutos:
    def __init__(self, produtos, exigir_if_match=False):
        self.exigir_if_match = exigir_if_match
        # TODO: guarde uma cópia dos dados e a versão de cada produto (começa em 1)

    def get(self, pid):
        # TODO: (200, etag, cópia dos dados) ou (404, None, None)
        pass

    def put(self, pid, dados, if_match=None):
        # TODO: 404 → 428 → 412 → aplica e devolve (200, novo_etag)
        pass
`,
        tests: [
          {
            name: 'get devolve 200, o ETag forte e os dados',
            code: `s = ServidorProdutos({7: {"preco": 50, "estoque": 10}})
r = s.get(7)
assert r == (200, '"v1"', {"preco": 50, "estoque": 10}), f"veio {r!r} (as aspas fazem parte do ETag)"
assert s.get(99) == (404, None, None), "produto inexistente deveria dar (404, None, None)"`,
          },
          {
            name: 'PUT com o ETag atual aplica e gera um ETag novo',
            code: `s = ServidorProdutos({7: {"preco": 50, "estoque": 10}})
_, etag, dados = s.get(7)
dados["preco"] = 45
r = s.put(7, dados, if_match=etag)
assert r == (200, '"v2"'), f"veio {r!r}"
assert s.get(7) == (200, '"v2"', {"preco": 45, "estoque": 10}), f"estado depois do PUT: {s.get(7)!r}"`,
          },
          {
            name: 'lost update barrado: If-Match velho → 412 e nada muda',
            code: `s = ServidorProdutos({7: {"preco": 50, "estoque": 10}})
_, etag_ana, ana = s.get(7)
_, etag_bruno, bruno = s.get(7)
ana["preco"] = 45
assert s.put(7, ana, if_match=etag_ana) == (200, '"v2"')
bruno["estoque"] = 8
r = s.put(7, bruno, if_match=etag_bruno)
assert r == (412, None), f"Bruno leu a v1, mas a atual é a v2: deveria dar 412, veio {r!r}"
assert s.get(7) == (200, '"v2"', {"preco": 45, "estoque": 10}), "o 412 não pode alterar nada: o preço da Ana tem que continuar lá"`,
          },
          {
            name: 'sem If-Match: aplica — ou 428 se o servidor exige condição',
            code: `livre = ServidorProdutos({7: {"preco": 50}})
assert livre.put(7, {"preco": 40}) == (200, '"v2"'), "sem exigência, o PUT incondicional é aceito"
rigido = ServidorProdutos({7: {"preco": 50}}, exigir_if_match=True)
r = rigido.put(7, {"preco": 40})
assert r == (428, None), f"sem If-Match num servidor que exige condição: 428, veio {r!r}"
assert rigido.get(7) == (200, '"v1"', {"preco": 50}), "o 428 não pode alterar nada"`,
          },
          {
            name: 'If-Match: * casa com qualquer versão; produto inexistente → 404',
            code: `s = ServidorProdutos({7: {"preco": 50}})
s.put(7, {"preco": 40}, if_match='"v1"')
assert s.put(7, {"preco": 30}, if_match="*") == (200, '"v3"'), "* casa com qualquer versão existente"
assert s.put(99, {"preco": 1}, if_match="*") == (404, None)
assert s.put(99, {"preco": 1}) == (404, None)`,
          },
          {
            name: 'lista de ETags: basta um casar',
            hidden: true,
            code: `s = ServidorProdutos({7: {"preco": 50}})
r = s.put(7, {"preco": 40}, if_match='"v9", "v1"')
assert r == (200, '"v2"'), f"um dos ETags da lista é o atual: deveria aplicar; veio {r!r}"
r = s.put(7, {"preco": 30}, if_match='"v1", "v3"')
assert r == (412, None), f"nenhum ETag da lista é o atual (v2); veio {r!r}"`,
          },
          {
            name: 'ETag fraco nunca casa em If-Match',
            hidden: true,
            code: `s = ServidorProdutos({7: {"preco": 50}})
r = s.put(7, {"preco": 40}, if_match='W/"v1"')
assert r == (412, None), f"If-Match usa comparação FORTE: W/ nunca casa; veio {r!r}"
assert s.get(7) == (200, '"v1"', {"preco": 50})`,
          },
          {
            name: 'o servidor não compartilha objetos com quem chama',
            hidden: true,
            code: `original = {"preco": 50, "tags": ["promo"]}
s = ServidorProdutos({7: original})
original["preco"] = 1
_, _, lido = s.get(7)
lido["tags"].append("hack")
assert s.get(7) == (200, '"v1"', {"preco": 50, "tags": ["promo"]}), f"o estado do servidor vazou: {s.get(7)!r}"
novo = {"preco": 40, "tags": []}
s.put(7, novo, if_match='"v1"')
novo["tags"].append("hack")
assert s.get(7) == (200, '"v2"', {"preco": 40, "tags": []}), f"o put deveria guardar uma cópia: {s.get(7)!r}"`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'ETag derivado do **horário** da gravação é frágil: duas escritas no mesmo instante (ou relógios de réplicas discordando) geram o mesmo ETag, e a colisão passa despercebida. Um **contador de versão** — ou um hash do conteúdo — é determinístico.',
            concept: 'Geração de ETag',
          },
          {
            when: m => m.calls.includes('hash'),
            text: 'O `hash()` do Python é randomizado por processo para `str` (`PYTHONHASHSEED`): cada réplica calcularia um ETag diferente para o mesmo conteúdo, e o `If-Match` falharia à toa atrás do balanceador. Use um contador de versão ou `hashlib.sha256` sobre o JSON canônico.',
            concept: 'Geração de ETag',
          },
          {
            when: m => m.maxComplexity > 8,
            text: '`put` acumulou decisões demais. Extraia `_casa(pid, if_match)` para a comparação de ETags: é uma regra com vida própria (`*`, listas, comparação forte).',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Guarde dois dicts — `self._dados = {pid: copy.deepcopy(d) for pid, d in produtos.items()}` e `self._versao = {pid: 1 for pid in produtos}` — e um método `_etag(pid)` que monta `"v" + versão` **entre aspas**.',
          'Siga a ordem: `404` → `428` (só quando `if_match is None` **e** `self.exigir_if_match`) → `412` (quando `if_match` veio e não casa) → aplica, com `deepcopy` e `versao += 1`.',
          'Para casar: `if_match.strip() == "*"` ou `self._etag(pid) in [t.strip() for t in if_match.split(",")]`. Comparar cada item por **igualdade** (e não por substring) já dá a comparação forte: `W/"v1"` é diferente de `"v1"`.',
        ],
        solution: `import copy


class ServidorProdutos:
    def __init__(self, produtos, exigir_if_match=False):
        self.exigir_if_match = exigir_if_match
        self._dados = {pid: copy.deepcopy(d) for pid, d in produtos.items()}
        self._versao = {pid: 1 for pid in produtos}

    def _etag(self, pid):
        return f'"v{self._versao[pid]}"'          # ETag FORTE: as aspas fazem parte

    def get(self, pid):
        if pid not in self._dados:
            return 404, None, None
        return 200, self._etag(pid), copy.deepcopy(self._dados[pid])

    def put(self, pid, dados, if_match=None):
        if pid not in self._dados:
            return 404, None
        if if_match is None:
            if self.exigir_if_match:
                return 428, None
        elif not self._casa(pid, if_match):
            return 412, None
        self._dados[pid] = copy.deepcopy(dados)
        self._versao[pid] += 1
        return 200, self._etag(pid)

    def _casa(self, pid, if_match):
        if if_match.strip() == "*":
            return True
        candidatos = [t.strip() for t in if_match.split(",")]
        return self._etag(pid) in candidatos      # igualdade = comparação forte
`,
        solutionExplanation: 'O ETag nasce de um **contador de versão**: determinístico, barato e igual em qualquer réplica. As checagens seguem a ordem do enunciado, e o `412` e o `428` **não tocam** nos dados. A comparação por **igualdade** com cada item da lista implementa a comparação forte de graça: `W/"v1"` nunca é igual a `"v1"`. O `deepcopy` na entrada e na saída garante que só um `PUT` bem-sucedido muda o estado — e, portanto, a versão. Num banco relacional, a mesma ideia vira `UPDATE produtos SET ..., versao = versao + 1 WHERE id = ? AND versao = ?`, conferindo se exatamente **uma** linha foi afetada.',
      },
      {
        type: 'mcq',
        id: 'api-idem-q6',
        concept: 'Idempotência de ponta a ponta',
        say: 'Última: idempotência de ponta a ponta. Pense na cadeia inteira.',
        prompt: 'Seu `POST /pedidos` já exige `Idempotency-Key`. Para cobrar, ele chama um gateway de pagamento que **também** aceita `Idempotency-Key` — e o seu cliente HTTP faz até 3 retries em caso de timeout. Que chave você manda ao gateway?',
        options: [
          { text: 'Uma chave **estável derivada da sua operação** (ex.: `pedido-981-cobranca`), a mesma em todas as tentativas', correct: true, why: 'Isso: se a resposta do gateway se perder, o **seu** retry é deduplicado **lá**. E derivar da sua operação, em vez de repassar a chave do cliente, evita colisão entre chaves de clientes diferentes na **sua** conta do gateway.' },
          { text: 'Um UUID novo por tentativa, para o gateway não confundir as chamadas', why: 'É o bug do laço de novo, agora entre serviços: um timeout seguido de retry vira **duas cobranças** no gateway.' },
          { text: 'Nenhuma: como o seu endpoint já é idempotente, a cadeia inteira está protegida', why: 'A sua chave protege contra os retries **do cliente** para você. Os retries que **você** faz para o gateway são outro salto da cadeia — e precisam da própria proteção.' },
          { text: 'Nenhuma: basta trocar a chamada por uma fila com entrega *exactly-once*', why: 'Não existe entrega exactly-once numa rede que perde mensagens: o "exactly-once" dos brokers é *at-least-once* + deduplicação. O consumidor continuaria precisando ser idempotente.' },
        ],
        explanation: 'Idempotência é uma propriedade da **cadeia inteira**: cada salto com retry precisa de deduplicação no destino. O padrão é derivar chaves **estáveis e determinísticas** da operação de negócio — ou gerar a chave uma vez e salvá-la junto com o pedido, antes da primeira tentativa. É assim que se chega ao *effectively-once*: entrega *at-least-once*, efeito único.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora retry não te assusta mais: com a chave certa, repetir é seguro.',
          { text: 'Resumo: chave por operação, reserva atômica, 422 e 409 para os abusos, ETag + If-Match contra o lost update — e "exactly-once" só com deduplicação.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
