Game.registerModule('apis', {
  id: 'entrevista-api',
  title: 'Entrevista: desenhe uma API de pagamentos',
  kind: 'interview',
  level: 3,
  order: 90,
  unit: 'entrevistas',
  summary: 'Uma entrevista de design de ponta a ponta: recursos e endpoints de uma API de pagamentos, cobrança idempotente, máquina de estados com autorização e captura, webhooks fora de ordem, rate limiting, versionamento e erros.',
  concepts: ['Design de API', 'Idempotência', 'Máquina de estados', 'Webhooks', 'Versionamento'],
  takeaways: [
    'Recursos claros (`/pagamentos`, `/reembolsos`) e transições como **ações explícitas** (`POST /pagamentos/{id}/captura`): o `status` é somente leitura para o cliente.',
    'Cobrança exige **Idempotency-Key**: mesma chave e mesmo corpo devolvem a **resposta original**; corpo diferente → `422`; original em andamento → `409`. A reserva da chave precisa ser **atômica** entre instâncias.',
    'O pagamento é uma **máquina de estados** (pendente → autorizado → capturado → reembolsado): transição inválida é `409`; repetir a ação já aplicada é *no-op*, sem evento duplicado.',
    'Webhooks chegam **pelo menos uma vez** e **fora de ordem**: assine com HMAC + timestamp, deduplique pelo ID do evento e, na dúvida, busque o estado atual (*thin events*).',
    'Dinheiro em **inteiro na menor unidade** + moeda ISO 4217; rate limit **por lojista**; versão **fixada por conta** para integrações que duram anos; erros com Problem Details e códigos estáveis.',
  ],
  glossary: [
    { term: 'Autorização e captura', aliases: ['pré-autorização', 'pre-autorizacao', 'auth/capture', 'autorização/captura', 'autorizacao e captura'], definition: 'Pagamento com cartão em duas fases: a **autorização** reserva o valor no limite do cliente e a **captura** efetiva a cobrança (por exemplo, quando o pedido é despachado). Uma reserva não capturada pode ser cancelada sem estorno — ou expira.' },
    { term: 'Menor unidade da moeda', aliases: ['menor unidade', 'minor unit', 'minor units'], definition: 'Representar dinheiro como **inteiro** na menor unidade da moeda — centavos, no real: `15990` = R$ 159,90. Evita erros de ponto flutuante. O número de casas vem da ISO 4217 e varia: o iene (JPY) tem 0, o dinar kuwaitiano (KWD) tem 3.' },
    { term: 'Webhook', aliases: ['webhooks'], definition: 'Requisição HTTP que o **provedor** faz para uma URL do cliente quando algo acontece (ex.: pagamento capturado). A entrega costuma ser **pelo menos uma vez** e sem ordem garantida: quem recebe verifica a assinatura, deduplica pelo ID do evento e responde `2xx` rápido.' },
    { term: 'Evento magro', aliases: ['eventos magros', 'thin event', 'thin events', 'evento gordo', 'eventos gordos'], definition: 'Evento que carrega só o **identificador** do que mudou; o consumidor busca o estado atual com um `GET`. O **evento gordo** traz o objeto inteiro (*Event-Carried State Transfer*): poupa a chamada, mas um evento atrasado pode sobrescrever um estado mais novo.' },
    { term: 'Chargeback', aliases: ['chargebacks'], definition: 'Contestação de uma compra feita pelo portador do cartão junto ao banco emissor. O valor é retirado do lojista enquanto a disputa é analisada, e ele pode apresentar provas (entrega, uso) para revertê-la.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Olá! Hoje eu sou sua **entrevistadora**. O problema é um clássico de fintech e e-commerce — e quase ninguém acerta tudo de primeira.',
        'Você vai desenhar uma **API de pagamentos**. Não existe resposta única: quero ver **decisões** e **trade-offs**.',
      ],
      board: {
        title: '📋 Enunciado',
        md: `**Projete a API de pagamentos de um PSP** (provedor de serviços de pagamento, como Stripe, Adyen ou Pagar.me).

- Lojistas, autenticados por **API key**, cobram o **cartão** dos seus clientes.
- O valor é **reservado** na compra e **cobrado** quando o pedido é despachado.
- O lojista pode **cancelar** antes da cobrança e **reembolsar** depois.
- O lojista precisa ser **avisado** quando algo muda: aprovado, recusado, reembolsado.

**Requisitos não funcionais:** nunca cobrar duas vezes · aguentar retries de redes instáveis · integrações que duram **anos** · picos de Black Friday.

> [!dica] Roteiro: **recursos e endpoints → idempotência → estados → webhooks → proteção e evolução** (rate limit, versionamento, erros). Numa entrevista real é você quem conduz — mas hoje eu vou dando as pistas.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Comece pelos **recursos**: o que o lojista manipula? Pagamentos, os reembolsos deles… e os eventos que avisam das mudanças.',
        'E repare num detalhe que reprova candidatos: **como representar dinheiro**.',
      ],
      board: {
        title: 'Recursos e endpoints',
        md: `| Método e caminho | O que faz | Sucesso |
|---|---|---|
| \`POST /v1/pagamentos\` | cria o pagamento (nasce \`pendente\`) e pede a autorização — exige \`Idempotency-Key\` | \`201\` |
| \`GET /v1/pagamentos/{id}\` | estado **atual** do pagamento | \`200\` |
| \`GET /v1/pagamentos?status=capturado&cursor=…\` | lista com paginação por cursor | \`200\` |
| \`POST /v1/pagamentos/{id}/captura\` | captura o valor autorizado (total ou parcial) | \`200\` |
| \`POST /v1/pagamentos/{id}/cancelamento\` | libera a reserva antes da captura | \`200\` |
| \`POST /v1/pagamentos/{id}/reembolsos\` | cria um reembolso — pode haver vários, parciais | \`201\` |

\`\`\`http
POST /v1/pagamentos HTTP/1.1
Host: api.pagamentos.dev
Authorization: Bearer chave_live_…
Idempotency-Key: 5b1f7c2e-8d4a-4e8b-9a61-0c3f2d7e9b14
Content-Type: application/json

{"valor": 15990, "moeda": "BRL", "cartao": "tok_9f2a", "descricao": "Pedido 1042"}
\`\`\`

\`\`\`json
{
  "id": "pag_3KfT9x",
  "status": "pendente",
  "valor": 15990,
  "moeda": "BRL",
  "valor_capturado": 0,
  "criado_em": "2026-09-28T14:03:11Z"
}
\`\`\`

- **Dinheiro é inteiro** na menor unidade da moeda: \`15990\` = R$ 159,90. Nada de \`float\` (\`0.1 + 0.2 != 0.3\`) nem de string formatada.
- **IDs opacos com prefixo** (\`pag_\`, \`reemb_\`, \`evt_\`): não são sequenciais (ninguém enumera pagamentos alheios), não revelam volume e já dizem o tipo num log.
- O cartão chega como **token** (\`tok_…\`), gerado no navegador pelo SDK do PSP: o número nunca passa pelo servidor do lojista — o que encolhe muito o escopo de PCI DSS dele.

> [!sabia] "Menor unidade" nem sempre é centavo: pela ISO 4217, o **iene (JPY)** não tem casas decimais e o **dinar kuwaitiano (KWD)** tem **três**. Uma API que faz \`valor / 100\` para toda moeda cobra cem vezes menos no Japão. Guarde o expoente de cada moeda.`,
      },
    },
    {
      type: 'mcq',
      id: 'api-ent-q1',
      concept: 'Ações não-CRUD em REST',
      say: 'Primeira decisão: o lojista despachou o pedido e quer **cobrar** o valor reservado. Como fica o endpoint?',
      prompt: 'O lojista quer **capturar** um pagamento autorizado. Qual endpoint você exporia?',
      options: [
        { text: '`POST /v1/pagamentos/{id}/captura`, com o valor a capturar no corpo (opcional, para captura parcial)', correct: true, why: 'A transição vira um **comando explícito**: o servidor valida se ela é permitida no estado atual, registra quem capturou e aceita parâmetros próprios (valor parcial). E `POST` combina com `Idempotency-Key`.' },
        { text: '`PATCH /v1/pagamentos/{id}` com `{"status": "capturado"}`', why: 'Deixa o cliente **escrever o estado** direto: nada impede um `{"status": "reembolsado"}` sem reembolso nenhum. O servidor fica adivinhando a intenção a partir de um diff, e a transição perde seus parâmetros próprios.' },
        { text: '`GET /v1/pagamentos/{id}/capturar`', why: '`GET` precisa ser **seguro** (sem efeitos colaterais). Crawlers, prefetch do navegador, caches e retries automáticos disparam GETs à vontade — alguém capturaria sem querer.' },
        { text: '`PUT /v1/pagamentos/{id}` com a representação completa, incluindo `"status": "capturado"`', why: 'Tem o mesmo problema do PATCH (estado escrito pelo cliente) e ainda obriga a mandar o recurso inteiro, com risco de *lost update* em campos que mudaram no meio-tempo.' },
      ],
      explanation: 'Operações que **não são CRUD** — capturar, cancelar, reembolsar — ficam melhores como **ações ou sub-recursos** com `POST`: `/captura`, `/cancelamento`, `/reembolsos` (este é um recurso de verdade: um pagamento pode ter vários reembolsos parciais). O `status` do pagamento é **somente leitura** para o cliente: ele só muda por transições que o servidor valida. A Stripe segue esse desenho (`POST /v1/payment_intents/{id}/capture`).',
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o ponto que mais reprova: o app do lojista manda `POST /v1/pagamentos`, a rede cai e ele **não sabe** se a cobrança aconteceu.',
        'Se ele tentar de novo sem proteção, o cliente paga **duas vezes**. O que o seu design faz?',
      ],
      board: {
        title: 'Idempotência da cobrança',
        md: `\`\`\`text
 lojista ── POST /v1/pagamentos (Idempotency-Key: K) ──▶ API   cobrou… e a resposta se perdeu
 lojista ── retry com a MESMA chave K ─────────────────▶ API   devolve a resposta guardada
                                                               (não cobra de novo)
\`\`\`

| Situação | Resposta |
|---|---|
| Chave nova | processa e **guarda a resposta** junto com a chave |
| Mesma chave, mesmo corpo | devolve a **resposta original**, sem reprocessar |
| Mesma chave, corpo **diferente** | \`422\` — uso indevido da chave |
| Mesma chave, original **ainda rodando** | \`409\` — tente de novo em instantes |
| Falhou na **validação** (\`400\`) | nada é guardado: a chave não fica "queimada" |

Dois tipos de idempotência convivem aqui:

- **Por chave**, para **criar**: ainda não existe \`id\`, então só a chave do cliente identifica "a mesma operação".
- **Pelo estado**, para **transições**: capturar um pagamento **já capturado** não muda nada — a máquina de estados faz o trabalho.

> [!atencao] A resposta repetida é **a mesma da primeira vez**, mesmo que o pagamento tenha mudado depois — quem quer o estado atual faz \`GET\`. A chave tem **escopo por lojista** (a \`abc\` do lojista A não colide com a do B) e **expira** (a Stripe guarda por 24 h).`,
      },
    },
    {
      type: 'say',
      text: [
        'Pagamento com cartão tem **duas fases**: a **autorização** reserva o valor no limite do cliente; a **captura** efetiva a cobrança.',
        'Por isso o pagamento é uma **máquina de estados** — e transição inválida é erro de contrato, não detalhe.',
      ],
      board: {
        title: 'Estados do pagamento',
        md: `\`\`\`text
 pendente ──autorizar──▶ autorizado ──capturar──▶ capturado ──reembolsar──▶ reembolsado
  │  │                       │
  │  └─recusar──▶ falhou     │
  │                          │
  └─cancelar──▶ cancelado ◀──┘ cancelar

 terminais: falhou · cancelado · reembolsado
\`\`\`

| Estado | Significa | Terminal? |
|---|---|---|
| \`pendente\` | criado, aguardando a resposta do emissor do cartão | não |
| \`autorizado\` | valor **reservado** no limite do cliente — a reserva expira (em compras online, costuma ser ~7 dias) | não |
| \`capturado\` | cobrança efetivada; o dinheiro segue para o lojista na liquidação | não |
| \`falhou\` | o emissor recusou: saldo, suspeita de fraude, cartão vencido… | **sim** |
| \`cancelado\` | reserva liberada antes da captura | **sim** |
| \`reembolsado\` | valor devolvido ao cliente | **sim** |

**Transição inválida** — capturar um cancelado, reembolsar um pendente — é conflito com o estado atual do recurso: **\`409 Conflict\`**, com o estado atual na resposta.

> [!dica] Por que duas fases? A loja autoriza na compra (garante o dinheiro) e só captura quando **despacha**. Se o produto acabou, cancela a reserva — sem estorno e sem taxa de reembolso. Hotéis e locadoras fazem o mesmo com cauções.

> [!sabia] Mesmo um pagamento \`capturado\` e "encerrado" pode voltar: no **chargeback**, o portador contesta a compra direto com o banco emissor, e o valor é retirado do lojista enquanto a disputa corre. Numa API real, isso vira mais estados (\`em_disputa\`) e mais eventos.`,
      },
    },
    {
      type: 'order',
      id: 'api-ent-q2',
      concept: 'Ciclo de vida do pagamento',
      say: 'Antes do código, me mostra que o fluxo está claro: ordene o ciclo de vida.',
      prompt: 'Ordene o ciclo de vida de um pagamento com cartão que termina em reembolso.',
      items: [
        'O lojista cria o pagamento com uma Idempotency-Key e ele nasce pendente',
        'O emissor aprova e reserva o valor no cartão: autorizado',
        'O pedido é despachado e o lojista captura o valor: capturado',
        'A plataforma envia o webhook pagamento.capturado ao lojista',
        'O cliente devolve o produto e o lojista pede o reembolso: reembolsado',
      ],
      explanation: 'Autorização **antes** da captura: primeiro se garante o dinheiro (reserva), depois se cobra quando há o que entregar. O webhook sai **depois** da transição — o evento é um fato consumado, nunca uma promessa. E reembolso só existe para o que foi capturado; antes disso, o caminho é **cancelar** a reserva.',
    },
    {
      type: 'code',
      id: 'api-ent-q3',
      concept: 'Máquina de estados com idempotência',
      title: 'Núcleo do serviço de pagamentos',
      say: 'Hora do código. Implemente o núcleo do serviço — idempotência e máquina de estados, em memória.',
      prompt: `Implemente \`Pagamentos(gerar_id)\`, em memória. \`gerar_id()\` devolve o próximo ID (nos testes: \`"pag_1"\`, \`"pag_2"\`…). Um pagamento é o dict \`{"id", "valor", "moeda", "status"}\`, e **todo método devolve uma cópia** — ninguém de fora mexe no estado interno.

**\`criar(valor, moeda, chave)\`** — cobrança idempotente:
- \`valor\` precisa ser um \`int\` positivo (centavos); senão, \`ValueError\` — e nada fica registrado (a chave não é "queimada").
- Chave nova: cria o pagamento em \`"pendente"\`, registra o evento \`("pagamento.criado", id)\` e guarda a resposta.
- Chave repetida com os **mesmos** \`valor\` e \`moeda\`: devolve **a resposta original** — mesmo que o pagamento tenha mudado depois —, sem novo ID e sem novo evento.
- Chave repetida com dados **diferentes**: \`ConflitoIdempotencia\`.

**\`obter(pagamento_id)\`** devolve o estado **atual**; ID desconhecido → \`KeyError\`.

**\`transicionar(pagamento_id, acao)\`** aplica uma ação e devolve o pagamento:

| Ação | De | Para |
|---|---|---|
| \`autorizar\` | pendente | autorizado |
| \`recusar\` | pendente | falhou |
| \`capturar\` | autorizado | capturado |
| \`cancelar\` | pendente ou autorizado | cancelado |
| \`reembolsar\` | capturado | reembolsado |

- Ação fora da tabela → \`ValueError\`; pagamento inexistente → \`KeyError\`.
- Pagamento **já** no destino da ação (um retry): não muda nada nem gera evento — só devolve o pagamento.
- Estado atual fora da coluna "De" → \`TransicaoInvalida\`, sem mudar nada.
- Transição válida: muda o status e registra em \`self.eventos\` o evento \`("pagamento." + novo_status, id)\` — por exemplo, \`("pagamento.capturado", "pag_1")\`.`,
      starter: `class TransicaoInvalida(Exception):
    """Ação não permitida no estado atual (na API: 409 Conflict)."""


class ConflitoIdempotencia(Exception):
    """Mesma Idempotency-Key com outros parâmetros (na API: 422)."""


class Pagamentos:
    def __init__(self, gerar_id):
        self._gerar_id = gerar_id
        self.eventos = []     # [(tipo, pagamento_id)] — o que viraria webhook

    def criar(self, valor, moeda, chave):
        # TODO: idempotência pela chave
        pass

    def obter(self, pagamento_id):
        # TODO
        pass

    def transicionar(self, pagamento_id, acao):
        # TODO: máquina de estados
        pass
`,
      tests: [
        {
          name: 'criar devolve um pagamento pendente e registra o evento',
          code: `svc = Pagamentos(iter(["pag_1", "pag_2"]).__next__)
p = svc.criar(15990, "BRL", "k-1")
assert p == {"id": "pag_1", "valor": 15990, "moeda": "BRL", "status": "pendente"}, f"veio {p}"
assert svc.obter("pag_1")["status"] == "pendente"
assert svc.eventos == [("pagamento.criado", "pag_1")], f"eventos: {svc.eventos}"`,
        },
        {
          name: 'retry com a mesma chave e os mesmos dados não cria outro pagamento',
          code: `svc = Pagamentos(iter(["pag_1", "pag_2"]).__next__)
p1 = svc.criar(15990, "BRL", "k-1")
p2 = svc.criar(15990, "BRL", "k-1")
assert p2 == p1, f"o retry deveria devolver o mesmo pagamento; veio {p2}"
assert svc.eventos == [("pagamento.criado", "pag_1")], f"o retry não pode gerar outro evento (nem outra cobrança!): {svc.eventos}"
p3 = svc.criar(15990, "BRL", "k-2")
assert p3["id"] == "pag_2", f"chave nova é cobrança nova — e o retry não deveria ter consumido um ID; veio {p3['id']!r}"`,
        },
        {
          name: 'mesma chave com outros dados: ConflitoIdempotencia',
          code: `svc = Pagamentos(iter(["pag_1", "pag_2"]).__next__)
svc.criar(15990, "BRL", "k-1")
for valor, moeda in [(99, "BRL"), (15990, "USD")]:
    try:
        svc.criar(valor, moeda, "k-1")
        assert False, f"reusar a chave com ({valor}, {moeda!r}) deveria lançar ConflitoIdempotencia"
    except ConflitoIdempotencia:
        pass
assert len(svc.eventos) == 1, f"nenhum pagamento novo deveria ter sido criado: {svc.eventos}"`,
        },
        {
          name: 'caminho feliz: autorizar, capturar e reembolsar',
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
svc.criar(5000, "BRL", "k-1")
for acao, esperado in [("autorizar", "autorizado"), ("capturar", "capturado"), ("reembolsar", "reembolsado")]:
    p = svc.transicionar("pag_1", acao)
    assert p["status"] == esperado, f"depois de {acao!r}: {p['status']!r} (esperado {esperado!r})"
assert svc.obter("pag_1")["status"] == "reembolsado"
tipos = [t for t, _ in svc.eventos]
assert tipos == ["pagamento.criado", "pagamento.autorizado", "pagamento.capturado", "pagamento.reembolsado"], f"eventos: {tipos}"`,
        },
        {
          name: 'transição inválida lança TransicaoInvalida e não muda nada',
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
svc.criar(5000, "BRL", "k-1")
for acao in ["capturar", "reembolsar"]:
    try:
        svc.transicionar("pag_1", acao)
        assert False, f"{acao!r} num pagamento pendente deveria lançar TransicaoInvalida"
    except TransicaoInvalida:
        pass
svc.transicionar("pag_1", "cancelar")
try:
    svc.transicionar("pag_1", "capturar")
    assert False, "capturar um pagamento cancelado deveria lançar TransicaoInvalida"
except TransicaoInvalida:
    pass
assert svc.obter("pag_1")["status"] == "cancelado"
tipos = [t for t, _ in svc.eventos]
assert tipos == ["pagamento.criado", "pagamento.cancelado"], f"transição inválida não gera evento: {tipos}"`,
        },
        {
          name: 'repetir a ação já aplicada é no-op, sem evento duplicado',
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
svc.criar(5000, "BRL", "k-1")
svc.transicionar("pag_1", "autorizar")
svc.transicionar("pag_1", "capturar")
p = svc.transicionar("pag_1", "capturar")      # retry depois de um timeout
assert p["status"] == "capturado", f"o retry deveria devolver o pagamento capturado; veio {p}"
tipos = [t for t, _ in svc.eventos]
assert tipos.count("pagamento.capturado") == 1, f"o retry da captura não pode capturar (nem notificar) duas vezes: {tipos}"`,
        },
        {
          name: 'ação desconhecida → ValueError; pagamento inexistente → KeyError',
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
svc.criar(5000, "BRL", "k-1")
try:
    svc.transicionar("pag_1", "estornar_tudo")
    assert False, "ação desconhecida deveria lançar ValueError (na API: 400)"
except ValueError:
    pass
for nome, chamada in [("transicionar", lambda: svc.transicionar("pag_404", "capturar")), ("obter", lambda: svc.obter("pag_404"))]:
    try:
        chamada()
        assert False, f"{nome} com pagamento inexistente deveria lançar KeyError (na API: 404)"
    except KeyError:
        pass`,
        },
        {
          name: 'valor inválido → ValueError, sem queimar a chave',
          hidden: true,
          code: `svc = Pagamentos(iter(["pag_1", "pag_2"]).__next__)
for ruim in (0, -100, 10.5, "100"):
    try:
        svc.criar(ruim, "BRL", "k-1")
        assert False, f"valor {ruim!r} deveria lançar ValueError"
    except ValueError:
        pass
p = svc.criar(100, "BRL", "k-1")
assert p == {"id": "pag_1", "valor": 100, "moeda": "BRL", "status": "pendente"}, f"requisição rejeitada na validação não pode queimar a chave nem consumir ID; veio {p}"
assert svc.eventos == [("pagamento.criado", "pag_1")]`,
        },
        {
          name: 'o retry devolve a resposta original, mesmo depois de mudanças',
          hidden: true,
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
svc.criar(5000, "BRL", "k-1")
svc.transicionar("pag_1", "autorizar")
p = svc.criar(5000, "BRL", "k-1")
assert p == {"id": "pag_1", "valor": 5000, "moeda": "BRL", "status": "pendente"}, f"a repetição devolve a MESMA resposta da primeira vez (quem quer o estado atual usa obter); veio {p}"
assert svc.obter("pag_1")["status"] == "autorizado"`,
        },
        {
          name: 'devolve cópias: mexer no dict retornado não altera o estado',
          hidden: true,
          code: `svc = Pagamentos(iter(["pag_1"]).__next__)
p = svc.criar(5000, "BRL", "k-1")
p["status"] = "capturado"
assert svc.obter("pag_1")["status"] == "pendente", "criar deveria devolver uma cópia"
q = svc.obter("pag_1")
q["valor"] = 1
assert svc.obter("pag_1")["valor"] == 5000, "obter deveria devolver uma cópia"
r = svc.transicionar("pag_1", "autorizar")
r["status"] = "reembolsado"
assert svc.obter("pag_1")["status"] == "autorizado", "transicionar deveria devolver uma cópia"
assert svc.criar(5000, "BRL", "k-1")["status"] == "pendente", "a resposta guardada para a chave também não pode ser alterada por fora"`,
        },
        {
          name: 'só as transições da tabela: terminais não saem mais',
          hidden: true,
          code: `acoes = ["autorizar", "recusar", "capturar", "cancelar", "reembolsar"]
for terminal, caminho in [("falhou", ["recusar"]), ("cancelado", ["autorizar", "cancelar"]), ("reembolsado", ["autorizar", "capturar", "reembolsar"])]:
    svc = Pagamentos(iter(["pag_1"]).__next__)
    svc.criar(5000, "BRL", "k-1")
    for acao in caminho:
        svc.transicionar("pag_1", acao)
    for acao in acoes:
        if acao == caminho[-1]:
            continue                      # repetir a última ação é no-op
        try:
            svc.transicionar("pag_1", acao)
            assert False, f"{terminal!r} é terminal: {acao!r} deveria lançar TransicaoInvalida"
        except TransicaoInvalida:
            pass
    assert svc.obter("pag_1")["status"] == terminal
for estado, caminho, proibidas in [("autorizado", ["autorizar"], ["recusar", "reembolsar"]), ("capturado", ["autorizar", "capturar"], ["autorizar", "recusar", "cancelar"])]:
    svc = Pagamentos(iter(["pag_1"]).__next__)
    svc.criar(5000, "BRL", "k-1")
    for acao in caminho:
        svc.transicionar("pag_1", acao)
    for acao in proibidas:
        try:
            svc.transicionar("pag_1", acao)
            assert False, f"um pagamento {estado!r} não aceita {acao!r} (depois da captura, o caminho é reembolsar; recusa só vale para pendente)"
        except TransicaoInvalida:
            pass
    assert svc.obter("pag_1")["status"] == estado`,
        },
      ],
      reviews: [
        {
          when: m => m.maxComplexity > 9,
          text: 'Muitos `if/elif` para as transições. Modele a máquina de estados como **dado** — `{acao: (origens, destino)}`: a regra vira uma consulta à tabela, e revisar (ou acrescentar `em_disputa`) é editar uma linha.',
          concept: 'Máquina de estados',
        },
        {
          when: m => m.usesGlobal,
          text: 'Estado global faz duas instâncias de `Pagamentos` compartilharem chaves e pagamentos: testes interferem uns nos outros e, num servidor, lojistas também. Guarde tudo em `self`.',
          concept: 'Estado encapsulado',
        },
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: '`except` genérico numa API de pagamentos é perigoso: um bug vira "sucesso silencioso" ou um erro com o código HTTP errado. Deixe as exceções de domínio (`TransicaoInvalida`, `ConflitoIdempotencia`) subirem até a camada HTTP, que as traduz em 409 e 422.',
          concept: 'Erros de domínio',
        },
      ],
      hints: [
        'Guarde três coisas: `_pagamentos` (id → dict), `_por_chave` (chave → (parâmetros, resposta guardada)) e a lista `eventos`. Devolva sempre `dict(...)`, uma cópia.',
        'Em `criar`: valide **primeiro** (valor inválido não queima a chave). Chave conhecida? Compare `(valor, moeda)`: igual → devolva uma cópia da resposta **guardada**; diferente → `ConflitoIdempotencia`. Chave nova → crie, guarde uma **cópia** da resposta e registre `("pagamento.criado", id)`.',
        'Transições como **dado**: `TRANSICOES = {"capturar": ({"autorizado"}, "capturado"), ...}`. Em `transicionar`: ação desconhecida → `ValueError`; status já igual ao destino → devolva sem evento; status fora das origens → `TransicaoInvalida`; senão, mude o status e registre `("pagamento." + destino, id)`.',
      ],
      solution: `class TransicaoInvalida(Exception):
    """Ação não permitida no estado atual (na API: 409 Conflict)."""


class ConflitoIdempotencia(Exception):
    """Mesma Idempotency-Key com outros parâmetros (na API: 422)."""


# a máquina de estados como DADO: ação -> (estados de origem, estado de destino)
TRANSICOES = {
    "autorizar": ({"pendente"}, "autorizado"),
    "recusar": ({"pendente"}, "falhou"),
    "capturar": ({"autorizado"}, "capturado"),
    "cancelar": ({"pendente", "autorizado"}, "cancelado"),
    "reembolsar": ({"capturado"}, "reembolsado"),
}


class Pagamentos:
    def __init__(self, gerar_id):
        self._gerar_id = gerar_id
        self._pagamentos = {}   # id -> pagamento (estado atual)
        self._por_chave = {}    # chave -> ((valor, moeda), resposta original)
        self.eventos = []       # [(tipo, pagamento_id)] — o que viraria webhook

    def criar(self, valor, moeda, chave):
        if not isinstance(valor, int) or valor <= 0:
            raise ValueError("valor deve ser um inteiro positivo, em centavos")
        parametros = (valor, moeda)
        if chave in self._por_chave:
            anteriores, resposta = self._por_chave[chave]
            if anteriores != parametros:
                raise ConflitoIdempotencia(f"a chave {chave!r} já foi usada com outros parâmetros")
            return dict(resposta)                    # replay: a resposta ORIGINAL
        pagamento = {"id": self._gerar_id(), "valor": valor, "moeda": moeda, "status": "pendente"}
        self._pagamentos[pagamento["id"]] = pagamento
        self._por_chave[chave] = (parametros, dict(pagamento))
        self.eventos.append(("pagamento.criado", pagamento["id"]))
        return dict(pagamento)

    def obter(self, pagamento_id):
        return dict(self._pagamentos[pagamento_id])  # KeyError -> 404

    def transicionar(self, pagamento_id, acao):
        if acao not in TRANSICOES:
            raise ValueError(f"ação desconhecida: {acao!r}")
        pagamento = self._pagamentos[pagamento_id]   # KeyError -> 404
        origens, destino = TRANSICOES[acao]
        if pagamento["status"] == destino:
            return dict(pagamento)                   # retry: no-op, sem evento
        if pagamento["status"] not in origens:
            raise TransicaoInvalida(f"não dá para {acao} um pagamento {pagamento['status']}")
        pagamento["status"] = destino
        self.eventos.append(("pagamento." + destino, pagamento_id))
        return dict(pagamento)
`,
      solutionExplanation: 'A máquina de estados é **dado**: `TRANSICOES` diz, para cada ação, de onde ela pode partir e aonde chega — revisar as regras é ler uma tabela, e acrescentar `em_disputa` é uma linha. A ordem das verificações espelha a API: ação desconhecida (`400`) → recurso inexistente (`404`) → já no destino (retry, *no-op*) → origem inválida (`409`). Na criação, a validação vem **antes** de olhar a chave, então requisições inválidas não queimam a chave; e a resposta guardada é uma **cópia congelada** do que foi devolvido — por isso o retry devolve o "pendente" original mesmo depois da autorização. Em produção, `_por_chave` seria uma tabela com `UNIQUE (lojista_id, chave)`, gravada na **mesma transação** do pagamento.',
    },
    {
      type: 'mcq',
      id: 'api-ent-q4',
      concept: 'Idempotência entre instâncias',
      say: 'Passou! Agora o follow-up que todo entrevistador sênior faz: e com **várias instâncias**?',
      prompt: 'Seu `dict` em memória passou nos testes. Em produção, a API roda em **8 instâncias** atrás de um balanceador, e o app do lojista às vezes dispara o retry **antes** de a primeira tentativa terminar. Como garantir que duas requisições com a mesma `Idempotency-Key` nunca cobrem duas vezes?',
      options: [
        { text: 'Reservar a chave de forma **atômica** num armazenamento compartilhado — `INSERT` com `UNIQUE (lojista_id, chave)` ou `SET NX` no Redis — com o estado "em processamento"; quem perde a corrida recebe `409` e tenta de novo depois.', correct: true, why: 'A atomicidade elege **um** vencedor entre todas as instâncias. O perdedor recebe `409`; quando a original termina, os próximos retries recebem a resposta guardada.' },
        { text: 'Consultar a chave no Redis com `GET` e, se ela não existir, gravar com `SET` — são duas operações rápidas.', why: 'É *check-then-act*: entre o `GET` e o `SET`, as duas instâncias podem ver "não existe" e ambas cobram. Rapidez não é atomicidade.' },
        { text: 'Envolver o `criar` num `threading.Lock`.', why: 'O lock vale só dentro de **um** processo; as outras 7 instâncias nem sabem que ele existe.' },
        { text: 'Usar *sticky sessions* no balanceador, para o mesmo lojista cair sempre na mesma instância.', why: 'Ajuda por acaso, mas não garante: instâncias reiniciam, escalam e o balanceador redistribui — e o `dict` em memória some no próximo deploy. Correção não pode depender de roteamento.' },
      ],
      explanation: 'O registro da chave precisa ser **compartilhado, durável e atômico**. Um desenho comum: (1) `INSERT` da chave com status "em processamento" — a restrição `UNIQUE` elege o vencedor; (2) processar a cobrança; (3) gravar a resposta **na mesma transação** que o pagamento, para nunca existir "cobrado, mas sem resposta guardada". Brandur Leach detalha esse desenho, com fases atômicas e pontos de recuperação, em *Implementing Stripe-like Idempotency Keys in Postgres*.',
    },
    {
      type: 'say',
      text: [
        'Falta **avisar** o lojista. Ninguém vai fazer polling em milhões de pagamentos — a plataforma chama **ele**: webhooks.',
        'Só que webhook é HTTP pela internet: chega **atrasado**, **repetido** e **fora de ordem**. O design precisa assumir isso.',
      ],
      board: {
        title: 'Webhooks confiáveis',
        md: `\`\`\`http
POST /webhooks/pagamentos HTTP/1.1
Host: loja.exemplo.com
Content-Type: application/json
X-Assinatura: t=1790604303,v1=5f0c2a9d…e91b

{"id": "evt_81Qd", "tipo": "pagamento.capturado", "criado_em": "2026-09-28T14:05:02Z", "dados": {"pagamento_id": "pag_3KfT9x"}}
\`\`\`

| Lado da plataforma | Lado do lojista |
|---|---|
| assina \`timestamp.corpo\` com **HMAC-SHA256** e um segredo por endpoint | recalcula a assinatura, compara com \`hmac.compare_digest\` e **recusa timestamps velhos** (anti-*replay*) |
| entrega **pelo menos uma vez**: sem \`2xx\`, tenta de novo com backoff, por horas ou dias | **deduplica** pelo \`id\` do evento — o mesmo evento pode chegar duas vezes |
| **não garante ordem** | não confia na ordem: consulta o estado atual ou compara versões |
| registra cada tentativa e permite **reenviar** pelo painel | responde \`2xx\` **rápido** e processa numa fila |

\`\`\`python
import hashlib
import hmac

def assinatura_valida(segredo, corpo, cabecalho, agora, tolerancia=300):
    """Confere 'X-Assinatura: t=<unix>,v1=<hex>' — HMAC-SHA256 de 't.corpo'."""
    partes = dict(item.split("=", 1) for item in cabecalho.split(","))
    if abs(agora - int(partes["t"])) > tolerancia:
        return False                               # velho demais: possível replay
    mensagem = partes["t"].encode() + b"." + corpo
    esperado = hmac.new(segredo, mensagem, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, partes["v1"])
\`\`\`

> [!sabia] O evento acima é **magro** (*thin event*): só traz o ID, e o lojista busca o estado atual com \`GET\`. Parece desperdício, mas resolve a ordem de graça — o \`GET\` sempre devolve a verdade de agora. O evento **gordo**, com o objeto inteiro (*Event-Carried State Transfer*, na classificação de Martin Fowler), poupa a chamada, mas um evento velho que chega atrasado pode **sobrescrever** um estado mais novo.`,
      },
    },
    {
      type: 'mcq',
      id: 'api-ent-q5',
      concept: 'Webhooks fora de ordem',
      say: 'Um caso real de suporte. O que a sua documentação recomendaria?',
      prompt: 'Um lojista reclama: o endpoint de webhooks dele recebeu `pagamento.reembolsado` **antes** de `pagamento.capturado`, e o sistema dele gravou "capturado" por último — o pedido ficou com o estado errado. O que a sua documentação deveria recomendar?',
      options: [
        { text: 'Tratar cada evento como um **aviso**: deduplicar pelo `id` do evento e, em vez de confiar na ordem de chegada, buscar o estado atual (`GET /v1/pagamentos/{id}`) antes de atualizar o pedido.', correct: true, why: 'O `GET` devolve a verdade de **agora**, seja qual for a ordem em que os avisos chegaram — e a deduplicação absorve as entregas repetidas.' },
        { text: 'Responder `500` aos eventos fora de ordem, para a plataforma reenviar depois na ordem certa.', why: 'Reenvio não restabelece ordem nenhuma: só gera retries, atraso e o risco de o endpoint ser desativado por excesso de falhas.' },
        { text: 'Ordenar os eventos pelo `criado_em` do payload conforme eles chegam.', why: 'Você não sabe se o evento anterior já chegou (ou vai chegar): ordenar o que já chegou não resolve o que ainda está a caminho — e timestamps podem empatar.' },
        { text: 'Exigir da plataforma entrega **exatamente uma vez** e **em ordem**.', why: 'Por HTTP, a entrega é *at-least-once* (um timeout é ambíguo), e ordem global exigiria entregar em série: um evento travado bloquearia todos os outros. Nenhum grande provedor promete isso.' },
      ],
      explanation: 'Webhooks são entregues **pelo menos uma vez** e **sem ordem garantida** — a documentação da Stripe, por exemplo, diz isso com todas as letras. O consumidor robusto (1) verifica a assinatura, (2) deduplica pelo ID do evento, (3) responde `2xx` rápido e processa numa fila e (4) trata o evento como **gatilho**: consulta o estado atual — ou compara uma versão/sequência do recurso e descarta o que for mais velho do que já tem. É a grande vantagem dos *thin events*.',
    },
    {
      type: 'say',
      text: [
        'Reta final: o que separa uma API de brinquedo de uma API **pública** — limites, evolução e erros.',
        'Lembre: lojista integra **uma vez** e some por anos. Cada decisão aqui vira compromisso de longo prazo.',
      ],
      board: {
        title: 'Rate limiting, versionamento e erros',
        md: `**Rate limiting** — por **lojista** (API key), não por IP; cotas separadas para escrita (criar, capturar) e leitura (listar); estourou → \`429\` + \`Retry-After\`. Na Black Friday, priorize o que movimenta dinheiro: captura e reembolso passam antes de relatórios e listagens.

\`\`\`http
HTTP/1.1 429 Too Many Requests
Retry-After: 2
Content-Type: application/problem+json

{"type": "https://docs.pagamentos.dev/erros/limite", "title": "Limite de requisições excedido", "status": 429}
\`\`\`

**Versionamento** — mudança **aditiva** (campo novo, evento novo) não precisa de versão; breaking change precisa. Para integrações longas, uma estratégia comprovada: versão **por data**, **fixada na conta** do lojista no primeiro uso, com um cabeçalho para testar a nova antes de migrar (\`Api-Version: 2026-09-01\`). Os **webhooks** saem na versão da conta — eles também são contrato.

> [!sabia] É assim que a Stripe mantém dezenas de versões vivas: o código só conhece a versão **mais nova**, e cada breaking change vira um *version change module* que sabe transformar a resposta nova na antiga. Para um lojista fixado numa versão de anos atrás, a resposta atravessa a cadeia de transformações **de trás para frente** até chegar à versão dele.

**Erros** — Problem Details (RFC 9457) com um \`codigo\` **estável** para máquinas:

\`\`\`json
{
  "type": "https://docs.pagamentos.dev/erros/transicao-invalida",
  "title": "Transição de estado inválida",
  "status": 409,
  "detail": "Não é possível capturar um pagamento cancelado.",
  "codigo": "transicao_invalida",
  "status_atual": "cancelado"
}
\`\`\`

> [!dica] E a recusa do cartão? Há dois estilos no mercado: \`402\` com o erro (a Stripe faz assim — o \`402 Payment Required\` está "reservado para uso futuro" na especificação do HTTP) ou \`201\` com o pagamento em \`falhou\` e um \`motivo_recusa\` estável (\`saldo_insuficiente\`, \`cartao_vencido\`). Escolha um e seja **consistente**.`,
      },
    },
    {
      type: 'match',
      id: 'api-ent-q6',
      concept: 'Status HTTP de erro',
      say: 'Rodada rápida de erros: qual status para cada situação?',
      prompt: 'Associe cada situação da API de pagamentos ao **status HTTP** mais adequado.',
      pairs: [
        { left: 'Faltou o cabeçalho Idempotency-Key num POST de cobrança', right: '400 Bad Request' },
        { left: 'API key inválida ou revogada', right: '401 Unauthorized' },
        { left: 'Lojista A consulta um pagamento do lojista B', right: '404 Not Found' },
        { left: 'Capturar um pagamento já cancelado', right: '409 Conflict' },
        { left: 'Mesma Idempotency-Key com outro corpo', right: '422 Unprocessable Content' },
        { left: 'Passou da cota de requisições da conta', right: '429 Too Many Requests' },
      ],
      explanation: '**404, e não 403**, para o pagamento de outro lojista: um 403 confirma que o recurso existe — informação útil para quem tenta enumerar IDs (BOLA). O GitHub faz o mesmo com repositórios privados. **409** é conflito com o **estado atual** do recurso; **422**, um pedido bem formado mas inaceitável — é o que o draft da IETF sobre `Idempotency-Key` recomenda para chave reusada com outro corpo (e **400** quando falta a chave obrigatória). **429** vem com `Retry-After`, e **401** quer dizer "não sei quem você é" — diferente de 403, "sei, mas você não pode".',
    },
    {
      type: 'open',
      id: 'api-ent-q7',
      concept: 'Versionamento de API',
      say: 'Última pergunta — e ela vale ouro em fintech.',
      prompt: 'Lojistas integram **uma vez** e ficam anos sem mexer no código — e os webhooks também fazem parte do contrato. Como você **evoluiria** essa API sem quebrá-los? Justifique os trade-offs da estratégia de versionamento que escolher.',
      minWords: 40,
      rubric: [
        { label: 'Separa mudança **compatível** (aditiva) de **breaking** — e prefere as compatíveis', keywords: ['aditiv', 'compativel', 'compatibilidade', 'retrocompat', 'breaking', 'nao quebr', 'sem quebrar', 'campo novo', 'campos novos', 'tolerant', 'tolerante'], concept: 'Versionamento', why: 'A maioria das evoluções (campo novo, evento novo, parâmetro opcional) não precisa de versão nenhuma — desde que os clientes sejam leitores tolerantes.' },
        { label: 'Escolhe **como** o cliente fica numa versão (fixada por conta/data, cabeçalho ou URL)', keywords: ['fixad', 'pinad', 'pinning', 'por conta', 'por data', 'baseada em data', 'versao da conta', 'cabecalho', 'header', '/v1', '/v2', 'na url', 'no caminho'], concept: 'Estratégias de versionamento', why: 'Fixar a versão da conta garante que ninguém quebra sem pedir; a versão na URL é mais visível, mas cada `/v2` tende a virar uma migração "big bang".' },
        { label: 'Reconhece o **custo** de manter versões antigas (camada de transformação/compatibilidade)', keywords: ['transform', 'camada de compat', 'adaptador', 'adapter', 'traduz', 'convers', 'custo', 'manter varias', 'manter as versoes', 'manutencao', 'complexidade'], concept: 'Custo do versionamento', why: 'Toda versão viva é código a manter e testar; uma camada que transforma a resposta nova nas antigas concentra esse custo num lugar só.' },
        { label: 'Cobre os **webhooks** e a **depreciação** comunicada (Deprecation/Sunset, prazos, changelog)', keywords: ['webhook', 'evento', 'deprecat', 'deprecia', 'sunset', 'changelog', 'prazo', 'comunic', 'aviso', 'migra'], concept: 'Evolução de contratos', why: 'Webhooks quebram lojistas do mesmo jeito que respostas; e nenhuma versão deve morrer sem aviso, prazo e caminho de migração.' },
      ],
      modelAnswer: `Primeiro, eu evitaria quebrar: a maioria das evoluções é **aditiva** — campo novo, evento novo, parâmetro opcional — e isso não precisa de versão, desde que a documentação exija clientes **tolerantes** a campos desconhecidos. Só uma mudança **breaking** (remover ou renomear campo, mudar tipo ou semântica) ganha versão nova.

Para essas, eu usaria versões **por data**, **fixadas na conta** do lojista no primeiro uso, com um **cabeçalho** para testar a nova antes de migrar. O trade-off: ninguém quebra sem pedir, mas eu passo a ter muitas versões vivas. Uma versão na URL (\`/v2\`) seria mais visível e simples de rotear, mas força migrações "big bang".

Para conter o **custo**, o código só conhece a versão mais nova e cada breaking change vira uma **camada de transformação** que converte a resposta nova na antiga — a complexidade fica isolada e testável.

Por fim, os **webhooks** saem na versão da conta, porque também são contrato. E versões antigas são aposentadas com **depreciação** comunicada: cabeçalhos \`Deprecation\` e \`Sunset\`, changelog, prazo generoso e contato direto com quem ainda usa — o tráfego por versão mostra quem são.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Fim da entrevista! Você passou por recursos, idempotência, estados, webhooks, limites, versionamento e erros — exatamente o roteiro que um painel sênior espera.',
        { text: 'Meu feedback: em API de pagamentos, o que aprova é pensar na **falha** — o retry, a corrida entre instâncias, o evento fora de ordem, o lojista que não atualiza há anos. Leve esse roteiro para a próxima!', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
