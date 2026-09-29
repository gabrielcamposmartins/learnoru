Game.registerModule('architecture', {
  id: 'sagas',
  title: 'Sagas e Transações Distribuídas',
  kind: 'lesson',
  level: 3,
  order: 31,
  unit: 'dados-eventos',
  summary: 'Por que o 2PC não serve entre microsserviços e como sagas mantêm a consistência com compensações, transação pivô e semantic lock.',
  concepts: ['Sagas', '2PC', 'Compensações', 'Transação pivô', 'Semantic lock'],
  takeaways: [
    'Com **um banco por serviço**, não existe transação ACID que atravesse todos. O **2PC** resolve no papel, mas é **bloqueante**, derruba a disponibilidade e muita coisa (brokers, NoSQL, APIs de terceiros) nem o suporta.',
    'Uma **saga** é uma sequência de **transações locais**. Se um passo falha, os anteriores são desfeitos por **compensações**, em **ordem reversa** — e compensar é uma operação nova (estorno, cancelamento), não um *rollback*.',
    'Estruture a saga como **compensáveis → pivô → re-tentáveis**: depois que a **transação pivô** commita, a saga só anda para a frente.',
    'Sagas são **ACD**, sem o I: contramedidas como o **semantic lock** (um estado `*_PENDENTE`) impedem que alguém aja sobre um estado intermediário.',
    'Passos e compensações precisam ser **idempotentes**: mensagens duplicam, orquestradores retomam do meio e a compensação pode chegar **antes** da ação.',
  ],
  glossary: [
    { term: 'Saga', aliases: ['sagas', 'padrão saga', 'saga pattern'], definition: 'Sequência de **transações locais** (uma por serviço) em que cada passo tem uma **compensação**. Se um passo falha, as compensações dos anteriores rodam em ordem reversa. Dá atomicidade *eventual*, mas **sem isolamento**: estados intermediários ficam visíveis.' },
    { term: 'Two-phase commit', aliases: ['2PC', 'two phase commit', 'commit em duas fases'], definition: 'Protocolo de commit atômico distribuído: na fase 1 (*prepare*) o coordenador pergunta se todos podem commitar; na fase 2, manda commitar ou abortar. É **bloqueante**: se o coordenador cai entre as fases, os participantes ficam "em dúvida", segurando locks.' },
    { term: 'Transação de compensação', aliases: ['ação compensatória', 'ações compensatórias', 'transações de compensação', 'compensações', 'compensating transaction'], definition: 'Operação que **anula o efeito** de um passo já commitado — estorno, cancelamento, liberação — registrada como uma ação nova, em vez de apagar o histórico. Numa saga, precisa ser idempotente e re-tentável.' },
    { term: 'Transação pivô', aliases: ['pivot transaction', 'transações pivô', 'transacao pivo'], definition: 'O passo "sem volta" de uma saga: se ele commitar, a saga vai até o fim. Antes dele vêm os passos **compensáveis**; depois, só passos **re-tentáveis**.' },
    { term: 'Semantic lock', aliases: ['semantic locks', 'trava semântica', 'bloqueio semântico'], definition: '*Lock* no nível da aplicação: um passo compensável marca o registro com um estado como `APROVACAO_PENDENTE`, avisando que ele ainda pode mudar. Quem o encontra falha ("tente de novo") ou espera. A marca sai no fim da saga ou na compensação.' },
    { term: 'Transação re-tentável', aliases: ['transações re-tentáveis', 'retriable transaction', 'passo re-tentável', 'passos re-tentáveis'], definition: 'Passo que vem **depois do pivô** e não pode falhar por regra de negócio: se der erro técnico (timeout, serviço fora), é repetido até dar certo — por isso precisa ser idempotente. Nunca dispara compensações.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Até aqui, cada serviço cuidava dos próprios dados com transações locais. Mas e quando um processo de negócio atravessa **três serviços**, cada um com seu banco?',
        'Hoje vamos ver por que a transação distribuída "clássica" quase nunca é a resposta — e o que usar no lugar: **sagas**.',
      ],
      board: {
        title: 'O problema: uma operação, três bancos',
        md: `\`\`\`text
 finalizar_compra(pedido 42)
   ├─ Pedidos     INSERT pedido               → banco A
   ├─ Estoque     UPDATE saldo = saldo - 2    → banco B
   └─ Pagamentos  cobrar R$ 150 no cartão     → banco C + gateway externo

 💥 o cartão é recusado DEPOIS de o estoque ser reservado.
    Quem devolve os 2 itens? E o pedido, fica como?
\`\`\`

- No monólito, um \`BEGIN … COMMIT\` resolvia: ou tudo, ou nada.
- Com **um banco por serviço** (*database per service*), nenhum banco enxerga os outros: não existe transação ACID que atravesse os três.
- Duas famílias de solução: **commit atômico distribuído** (o famoso **2PC**) ou **sagas**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A primeira ideia costuma ser o **two-phase commit**: um coordenador pergunta a todos "vocês conseguem commitar?" e só depois manda commitar de verdade.',
        'Funciona — até o coordenador cair no meio. Aí todo mundo fica **esperando**, com as linhas travadas.',
      ],
      board: {
        title: 'Two-phase commit (2PC) — e por que ele não escala',
        md: `\`\`\`text
 FASE 1 — PREPARE                          FASE 2 — COMMIT
 coordenador ──"pode commitar?"──▶ todos   coordenador ──"commit!"──▶ todos
 coordenador ◀──"sim, prometo"──── todos   locks liberados só agora

 💥 o coordenador cai entre as fases → quem votou "sim" fica EM DÚVIDA:
    não pode commitar nem abortar sozinho, e segura os locks até ele voltar
\`\`\`

| Problema | Por quê |
|---|---|
| **Bloqueante** | Depois de votar "sim", o participante perde a autonomia: espera o coordenador |
| **Disponibilidade** | Todos precisam estar de pé ao mesmo tempo: 3 serviços com 99,9% → ~99,7% juntos |
| **Latência e locks** | Duas rodadas de rede e gravações em disco, com linhas travadas o tempo todo |
| **Suporte** | Muitos brokers, bancos NoSQL e APIs de terceiros (como um gateway de pagamento) não falam XA |

> [!atencao] 2PC não é "errado": ele garante atomicidade de verdade e ainda aparece dentro de bancos distribuídos ou entre recursos XA. Mas entre microsserviços — com donos, deploys e bancos independentes — ele recria o acoplamento que você tentou quebrar.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'A saga troca a pergunta. Em vez de "como commitar tudo junto?", ela pergunta: "se der errado no meio, como **desfazer** o que já foi feito?"',
        'Cada passo é uma transação **local**, que commita na hora. Se um passo falha, rodamos as **compensações** dos anteriores — em ordem **reversa**.',
      ],
      board: {
        title: 'Saga = transações locais + compensações',
        md: `\`\`\`text
 caminho feliz:  T1 ──▶ T2 ──▶ T3 ──▶ T4   ✅
 falha em T3:    T1 ──▶ T2 ──▶ T3 💥
                 C1 ◀── C2 ◀───┘           compensa na ordem REVERSA
\`\`\`

| # | Transação local | Compensação |
|---|---|---|
| 1 | Pedidos: criar o pedido como \`PENDENTE\` | marcar o pedido como \`CANCELADO\` |
| 2 | Estoque: reservar os itens | liberar a reserva |
| 3 | Pagamentos: cobrar o cartão | — (já já você entende por quê) |
| 4 | Pedidos: marcar como \`APROVADO\` | — |

- Nada fica travado entre os passos: cada transação **commita** no seu banco e libera os locks.
- Compensar **não é rollback**: o passado não é apagado. É uma operação **nova** que anula o efeito — cancelamento, estorno, liberação — e fica no histórico.
- O passo que falhou não precisa de compensação: a transação local dele não chegou a commitar.
- A garantia é **ACD**: atomicidade (eventual), consistência e durabilidade. **Falta o I**: durante a saga, outros enxergam o estado intermediário.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Você já viu **coreografia** e **orquestração** na aula de eventos. Numa saga, a diferença aparece mesmo é na **falha**: quem dispara as compensações?',
        'Na coreografada, eventos de falha se propagam de serviço em serviço. Na orquestrada, um coordenador — uma **máquina de estados** — decide tudo.',
      ],
      board: {
        title: 'Quem conduz a saga — e quem desfaz',
        md: `\`\`\`text
 COREOGRAFADA — eventos de falha disparam as compensações
   ida:    Pedidos ──PedidoCriado──▶ Estoque ──EstoqueReservado──▶ Pagamentos 💥
   volta:  Pagamentos ──PagamentoRecusado──▶ Estoque   (libera a reserva)
           Estoque ──EstoqueLiberado──▶ Pedidos        (marca CANCELADO)

 ORQUESTRADA — o orquestrador manda comandos e guarda o estado
   CriarPedido ✔ → ReservarEstoque ✔ → Cobrar ✘ → LiberarEstoque → CancelarPedido
   estado persistido: "saga 42: COMPENSANDO, passo 2 de 4"
\`\`\`

| | Coreografada | Orquestrada |
|---|---|---|
| Compensações | Cada serviço reage a eventos de falha | O orquestrador dispara, em ordem reversa |
| "Em que passo está o pedido 42?" | Espalhado pelos logs de vários serviços | No estado persistido da saga |
| Bom para | 2–4 passos, donos independentes | Fluxos longos, prazos, muitas compensações |

> [!dica] O orquestrador **persiste** o estado da saga a cada passo. Se ele cair, outro processo retoma de onde parou — e reenvia o último comando, que pode chegar **duas vezes**. Ferramentas de *durable execution* (Temporal, AWS Step Functions, Camunda) fazem esse trabalho pesado por você.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Lembra do "cobrar o cartão" sem compensação? Não foi esquecimento. Ele é a **transação pivô** — o ponto sem volta da saga.',
        'Pouca gente conhece essa estrutura, mas ela muda tudo: antes do pivô, tudo pode ser desfeito; depois dele, a saga **só anda para a frente**.',
      ],
      board: {
        title: 'Compensáveis → pivô → re-tentáveis',
        md: `\`\`\`text
    COMPENSÁVEIS            PIVÔ            RE-TENTÁVEIS
 ┌──────────────────┐   ┌───────────┐   ┌───────────────────┐
 │ criar pedido     │   │ cobrar o  │   │ aprovar o pedido  │
 │ reservar estoque │──▶│ cartão    │──▶│ agendar a entrega │
 └──────────────────┘   └───────────┘   └───────────────────┘
  falhou? compensa      commitou? vai   falhou? repete
  os anteriores         até o fim       até dar certo
\`\`\`

| Tipo | Regra | Exemplo |
|---|---|---|
| **Compensável** | Pode ser desfeita depois por uma compensação | reservar estoque ↔ liberar |
| **Pivô** | O *go/no-go*: se commitar, a saga vai até o fim | cobrar o cartão |
| **Re-tentável** | Vem depois do pivô e **não pode falhar por regra de negócio** — só por erro técnico, e então é repetida | aprovar o pedido, enviar e-mail |

Dica de desenho: coloque **cedo** os passos que mais falham por regra de negócio (validar, reservar) e deixe o pivô o mais tarde possível — menos compensações na prática.

> [!sabia] O termo **saga** é de **1987**: Hector Garcia-Molina e Kenneth Salem o criaram para *long-lived transactions* dentro de **um único banco** — transações que seguravam locks por horas. Três décadas depois, virou a resposta para microsserviços. Já **transação pivô**, **re-tentável** e **semantic lock** vêm da pesquisa em *multidatabases* dos anos 1990 e foram popularizados por Chris Richardson no livro *Microservices Patterns* (2018).`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o preço do "sem I": enquanto a saga roda, **outras operações** enxergam o estado intermediário — e tomam decisões com base nele.',
        'A defesa mais usada tem um nome que quase ninguém conhece: **semantic lock**, um "cadeado" feito de regra de negócio.',
      ],
      board: {
        title: 'Sem isolamento: anomalias e contramedidas',
        md: `**Anomalias típicas:**
- **Lost update** — o cliente cancela o pedido 42 no meio da saga; logo depois, a saga termina e grava \`APROVADO\` por cima do \`CANCELADO\`.
- **Dirty read** — outra operação lê um dado que ainda pode ser compensado (ex.: um limite de crédito reservado que vai voltar).

\`\`\`python
class Pedido:
    def cancelar(self):
        if self.status == "APROVACAO_PENDENTE":        # semantic lock
            raise PedidoEmProcessamento("tente de novo em instantes")
        if self.status == "APROVADO":
            self.status = "CANCELAMENTO_PENDENTE"      # inicia a saga de cancelamento
\`\`\`

| Contramedida | Ideia |
|---|---|
| **Semantic lock** | Um passo compensável marca o registro com um estado \`*_PENDENTE\`; quem o encontra **falha** ("tente de novo") ou **espera**. A marca sai no fim da saga ou na compensação |
| **Updates comutativos** | Operações que dão o mesmo resultado em qualquer ordem, como debitar e creditar |
| **Visão pessimista** | Reordenar os passos para reduzir o risco — ex.: liberar crédito só num passo re-tentável, no fim |
| **Reler o valor** | Antes de gravar, conferir se o dado não mudou (concorrência otimista) |`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Último ingrediente: **idempotência**. Mensageria entrega *at-least-once* e o orquestrador retoma do meio — o mesmo comando **vai** chegar duas vezes.',
        'E tem um caso mais traiçoeiro: a compensação pode chegar **antes** da ação. Depois de um timeout ambíguo, o orquestrador compensa algo que talvez nem tenha acontecido.',
      ],
      board: {
        title: 'Passos idempotentes (compensações também!)',
        code: `class Estoque:
    def __init__(self):
        self.reservas = {}          # saga_id -> quantidade
        self.canceladas = set()     # sagas já compensadas aqui

    def reservar(self, saga_id, qtd):
        if saga_id in self.reservas:
            return "duplicata"      # mesma mensagem de novo: não reserva 2x
        if saga_id in self.canceladas:
            return "ignorada"       # a compensação chegou antes: não reserve!
        self.reservas[saga_id] = qtd
        return "reservado"

    def liberar(self, saga_id):     # compensação: idempotente e tolerante
        self.canceladas.add(saga_id)
        self.reservas.pop(saga_id, None)    # nada a liberar? tudo bem`,
        caption: 'A chave de deduplicação é o id da saga (ou saga + passo). Lembrar da compensação evita a "reserva fantasma": a mensagem atrasada que chegaria depois e prenderia o estoque para sempre.',
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um orquestrador de saga testado de verdade.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-saga-q1',
      concept: '2PC — commit em duas fases',
      say: 'Começando pelo clássico de entrevista: por que não usar 2PC e pronto?',
      prompt: 'Qual é o principal motivo para evitar **two-phase commit (2PC)** entre microsserviços?',
      options: [
        { text: 'Ele é **bloqueante**: se o coordenador cai depois do *prepare*, os participantes ficam em dúvida segurando locks — e todos precisam estar disponíveis ao mesmo tempo.', correct: true, why: 'Esse é o custo central: o 2PC troca disponibilidade por atomicidade. Somando latência, locks longos e a falta de suporte a XA em brokers, NoSQL e APIs externas, ele não combina com serviços independentes.' },
        { text: 'Ele não garante atomicidade: um participante pode commitar enquanto outro aborta.', why: 'O 2PC existe justamente para garantir o "tudo ou nada". O problema dele não é correção, é o **preço**: bloqueio, disponibilidade e acoplamento.' },
        { text: 'Ele só funciona se todos os serviços usarem o mesmo banco de dados.', why: 'O XA coordena recursos heterogêneos (bancos diferentes, filas JMS). O problema é que muitas tecnologias modernas não o suportam — e o acoplamento de disponibilidade entre todos.' },
        { text: 'Ele é lento até para uma transação dentro de um único banco.', why: 'Dentro de um banco você usa uma transação local comum, sem 2PC. O custo aparece quando a transação atravessa vários participantes pela rede.' },
      ],
      explanation: 'No 2PC, depois de votar "sim" no *prepare*, o participante **perde a autonomia**: não pode commitar nem abortar sozinho até ouvir o coordenador. Se o coordenador cai, as linhas ficam travadas. Além disso, a disponibilidade vira o **produto** das disponibilidades de todos, e cada transação paga duas rodadas de rede com locks abertos. Sagas trocam o **isolamento** por **disponibilidade**: cada passo commita sozinho, e a atomicidade vem das compensações.',
    },
    {
      type: 'order',
      id: 'arq-saga-q2',
      concept: 'Compensação em ordem reversa',
      say: 'Agora com a saga rodando — e quebrando no meio. Ordene!',
      prompt: 'A saga **Finalizar compra** tem os passos: criar pedido `PENDENTE` → reservar estoque → reservar janela de entrega → **cobrar o cartão** (pivô) → aprovar o pedido. O cartão foi **recusado**. Ordene o que aconteceu, do primeiro ao último evento.',
      items: [
        'Pedidos cria o pedido como `PENDENTE`',
        'Estoque reserva os itens',
        'Logística reserva uma janela de entrega',
        'Pagamentos recusa a cobrança (a transação local dele não commita)',
        'Logística libera a janela de entrega',
        'Estoque libera os itens',
        'Pedidos marca o pedido como `CANCELADO`',
      ],
      explanation: 'Os passos compensáveis rodam em ordem; quando o pivô falha, as compensações rodam na ordem **reversa** — do passo mais recente para o mais antigo, como desempilhar. O passo que falhou não é compensado (ele não commitou), e "aprovar o pedido" nunca chega a rodar. Repare que o pedido não some: ele termina `CANCELADO`, e esse histórico fica registrado.',
    },
    {
      type: 'match',
      id: 'arq-saga-q3',
      concept: 'Vocabulário de sagas',
      say: 'Vocabulário pouco conhecido — e que impressiona numa entrevista. Associe!',
      prompt: 'Associe cada termo à sua descrição.',
      pairs: [
        { left: 'Transação **compensável**', right: 'Pode ser desfeita depois por uma operação que anula seu efeito' },
        { left: 'Transação **pivô**', right: 'O ponto sem volta: se commitar, a saga vai até o fim' },
        { left: 'Transação **re-tentável**', right: 'Vem depois do ponto sem volta e é repetida até dar certo' },
        { left: '**Semantic lock**', right: 'Um estado `*_PENDENTE` que avisa: "este registro ainda pode mudar"' },
        { left: '**Compensação**', right: 'Uma operação nova — estorno, cancelamento —, e não um rollback' },
        { left: '**2PC**', right: 'Coordenador com *prepare* e *commit*, segurando locks entre as fases' },
      ],
      explanation: 'Uma saga bem desenhada segue o esqueleto **compensáveis → pivô → re-tentáveis**. As **compensações** anulam efeitos com operações novas (o histórico fica), o **semantic lock** compensa a falta de isolamento marcando registros em trânsito, e o **2PC** é a alternativa bloqueante que as sagas evitam.',
    },
    {
      type: 'mcq',
      id: 'arq-saga-q4',
      concept: 'Semantic lock',
      say: 'Um bug real de produção. Qual contramedida você aplicaria?',
      prompt: `A saga **Finalizar compra** já criou o pedido 42 e reservou o estoque; a cobrança ainda está em andamento. Nesse instante, o cliente clica em **Cancelar**: o \`cancelar\` encontra o pedido e o marca como \`CANCELADO\`. Segundos depois, a cobrança passa e a saga grava \`APROVADO\` por cima.

Qual contramedida resolve isso da forma mais direta?`,
      options: [
        { text: 'Um **semantic lock**: criar o pedido como `APROVACAO_PENDENTE`; nesse estado, `cancelar` recusa ("em processamento, tente de novo") ou espera a saga terminar.', correct: true, why: 'O estado pendente torna o "em trânsito" **visível** para as regras de negócio. A marca sai no fim da saga (`APROVADO`) ou na compensação (`CANCELADO`), e aí o cancelamento segue normalmente.' },
        { text: 'Rodar cada passo da saga com isolamento `SERIALIZABLE` no banco.', why: 'O isolamento do banco só vale **dentro** de uma transação local. Entre um passo e outro da saga não há transação aberta — é ali que a anomalia acontece.' },
        { text: 'Tornar a operação `cancelar` idempotente.', why: 'Idempotência evita efeitos duplicados da **mesma** mensagem. Aqui são duas operações diferentes se intercalando — um *lost update*.' },
        { text: 'Envolver o `cancelar` em retries com backoff exponencial.', why: 'Retry não dá visibilidade do estado intermediário: o cancelamento continuaria "funcionando" em cima de um pedido pela metade.' },
      ],
      explanation: 'Sagas são **ACD**: sem o I, outras operações veem estados intermediários. O **semantic lock** é um *lock* no nível da aplicação — um estado `*_PENDENTE` — que avisa "este registro ainda pode mudar". Quem o encontra falha de forma explícita ou espera. O custo: o cliente pode receber um "tente de novo", e é preciso tratar sagas que morrem segurando a marca (um *timeout* que dispara a compensação resolve).',
    },
    {
      type: 'code',
      id: 'arq-saga-q5',
      concept: 'Orquestrador de saga',
      title: 'Orquestrador com compensação',
      say: 'Mão na massa: seu próprio orquestrador. Execute para a frente, compense para trás — e respeite o pivô!',
      prompt: `Implemente \`executar_saga(passos, ctx, max_tentativas=3)\`. Ela executa os passos **em ordem** e devolve um \`ResultadoSaga(status, log, pendentes)\`.

Cada \`Passo\` tem \`nome\`, \`acao(ctx)\`, \`compensacao(ctx)\` (ou \`None\`) e \`retentavel\` — \`True\` nos passos **depois do pivô**. Uma função **falha** quando lança exceção. \`ctx\` é um dict compartilhado: as ações guardam dados nele (ex.: o id da reserva) e as compensações os leem.

| Situação | O que fazer | \`log\` |
|---|---|---|
| a ação deu certo | segue para o próximo passo | \`"ok:<nome>"\` |
| passo **re-tentável** falhou | repete, até \`max_tentativas\` execuções no total; se esgotar, **para** a saga com status \`"intervencao"\` e \`pendentes=[nome]\`, **sem compensar** (o pivô já passou) | \`"falhou:<nome>"\` (só se esgotar) |
| outro passo falhou | **não** repete: compensa os passos **já concluídos** em **ordem reversa**, pulando os que não têm compensação; status \`"compensada"\` | \`"falhou:<nome>"\`, depois \`"compensou:<nome>"\` |
| uma compensação falhou | repete, até \`max_tentativas\` execuções; se esgotar, põe o nome em \`pendentes\`, **continua** compensando os outros e o status vira \`"intervencao"\` | \`"compensacao_falhou:<nome>"\` |
| todos deram certo | status \`"concluida"\` | — |

O passo que falhou **não** é compensado: a transação local dele não commitou.`,
      starter: `from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class Passo:
    nome: str
    acao: Callable
    compensacao: Callable | None = None
    retentavel: bool = False          # True nos passos depois do pivô


@dataclass
class ResultadoSaga:
    status: str                       # "concluida" | "compensada" | "intervencao"
    log: list = field(default_factory=list)
    pendentes: list = field(default_factory=list)


def executar_saga(passos, ctx, max_tentativas=3):
    # TODO: execute em ordem; se um passo falhar, compense os anteriores em ordem reversa
    return ResultadoSaga("concluida")
`,
      tests: [
        {
          name: 'caminho feliz executa tudo, em ordem',
          code: `chamadas = []
def acao(nome):
    return lambda ctx: chamadas.append(nome)

passos = [Passo("pedido", acao("pedido"), acao("cancelar_pedido")),
          Passo("estoque", acao("estoque"), acao("liberar_estoque")),
          Passo("cobrar", acao("cobrar")),
          Passo("aprovar", acao("aprovar"), retentavel=True)]
r = executar_saga(passos, {})
assert r.status == "concluida", f"status: {r.status}"
assert chamadas == ["pedido", "estoque", "cobrar", "aprovar"], f"chamadas: {chamadas}"
assert r.log == ["ok:pedido", "ok:estoque", "ok:cobrar", "ok:aprovar"], f"log: {r.log}"
assert r.pendentes == [], f"pendentes: {r.pendentes}"`,
        },
        {
          name: 'falha compensa os anteriores em ordem reversa',
          code: `chamadas = []
def acao(nome):
    return lambda ctx: chamadas.append(nome)
def recusar(ctx):
    raise RuntimeError("cartão recusado")

passos = [Passo("pedido", acao("pedido"), acao("cancelar_pedido")),
          Passo("estoque", acao("estoque"), acao("liberar_estoque")),
          Passo("cobrar", recusar, acao("estornar")),
          Passo("aprovar", acao("aprovar"), retentavel=True)]
r = executar_saga(passos, {})
assert r.status == "compensada", f"status: {r.status}"
assert chamadas == ["pedido", "estoque", "liberar_estoque", "cancelar_pedido"], f"chamadas: {chamadas} (o passo que falhou não se compensa; os outros, do mais recente ao mais antigo)"
assert r.log == ["ok:pedido", "ok:estoque", "falhou:cobrar", "compensou:estoque", "compensou:pedido"], f"log: {r.log}"`,
        },
        {
          name: 'passos sem compensação são pulados',
          code: `chamadas = []
def acao(nome):
    return lambda ctx: chamadas.append(nome)
def sem_estoque(ctx):
    raise ValueError("sem estoque")

passos = [Passo("validar", acao("validar")),
          Passo("pedido", acao("pedido"), acao("cancelar_pedido")),
          Passo("estoque", sem_estoque, acao("liberar_estoque"))]
r = executar_saga(passos, {})
assert r.status == "compensada", f"status: {r.status}"
assert chamadas == ["validar", "pedido", "cancelar_pedido"], f"chamadas: {chamadas}"
assert r.log == ["ok:validar", "ok:pedido", "falhou:estoque", "compensou:pedido"], f"log: {r.log}"`,
        },
        {
          name: 'compensação lê o que a ação guardou no ctx',
          code: `def reservar(ctx):
    ctx["reserva_id"] = "R-7"
liberadas = []
def liberar(ctx):
    liberadas.append(ctx["reserva_id"])
def recusar(ctx):
    raise RuntimeError("cartão recusado")

ctx = {}
r = executar_saga([Passo("estoque", reservar, liberar), Passo("cobrar", recusar)], ctx)
assert liberadas == ["R-7"], f"a compensação deveria receber o mesmo ctx: {liberadas}"
assert r.status == "compensada", f"status: {r.status}"`,
        },
        {
          name: 'passo re-tentável repete até dar certo',
          code: `tentativas = []
def aprovar_instavel(ctx):
    tentativas.append(1)
    if len(tentativas) < 3:
        raise TimeoutError("serviço lento")

compensados = []
passos = [Passo("cobrar", lambda ctx: None, lambda ctx: compensados.append("cobrar")),
          Passo("aprovar", aprovar_instavel, retentavel=True)]
r = executar_saga(passos, {}, max_tentativas=3)
assert r.status == "concluida", f"status: {r.status}"
assert len(tentativas) == 3, f"deveria executar 3 vezes, executou {len(tentativas)}"
assert compensados == [], "um passo re-tentável não dispara compensações"
assert r.log == ["ok:cobrar", "ok:aprovar"], f"log: {r.log}"`,
        },
        {
          name: 're-tentável esgotado pede intervenção, sem compensar',
          hidden: true,
          code: `execucoes = []
def fora_do_ar(ctx):
    execucoes.append(1)
    raise TimeoutError("fora do ar")

efeitos = []
passos = [Passo("pedido", lambda ctx: None, lambda ctx: efeitos.append("cancelar_pedido")),
          Passo("cobrar", lambda ctx: None),
          Passo("aprovar", fora_do_ar, retentavel=True),
          Passo("notificar", lambda ctx: efeitos.append("notificou"), retentavel=True)]
r = executar_saga(passos, {}, max_tentativas=2)
assert len(execucoes) == 2, f"deveria executar max_tentativas=2 vezes, executou {len(execucoes)}"
assert r.status == "intervencao", f"status: {r.status}"
assert r.pendentes == ["aprovar"], f"pendentes: {r.pendentes}"
assert efeitos == [], f"depois do pivô não se compensa, e a saga para no passo pendente: {efeitos}"
assert r.log == ["ok:pedido", "ok:cobrar", "falhou:aprovar"], f"log: {r.log}"`,
        },
        {
          name: 'compensação instável é re-tentada',
          hidden: true,
          code: `execucoes = {"liberar": 0}
def liberar_instavel(ctx):
    execucoes["liberar"] += 1
    if execucoes["liberar"] == 1:
        raise ConnectionError("timeout")
def recusar(ctx):
    raise RuntimeError("cartão recusado")

r = executar_saga([Passo("estoque", lambda ctx: None, liberar_instavel), Passo("cobrar", recusar)], {}, max_tentativas=3)
assert execucoes["liberar"] == 2, f"a compensação deveria ser repetida até dar certo: {execucoes}"
assert r.status == "compensada", f"status: {r.status}"
assert r.log == ["ok:estoque", "falhou:cobrar", "compensou:estoque"], f"log: {r.log}"`,
        },
        {
          name: 'compensação que nunca funciona vai para pendentes e as outras continuam',
          hidden: true,
          code: `chamadas = []
def quebrada(ctx):
    chamadas.append("liberar")
    raise ConnectionError("estoque fora do ar")
def recusar(ctx):
    raise RuntimeError("cartão recusado")

passos = [Passo("pedido", lambda ctx: None, lambda ctx: chamadas.append("cancelar")),
          Passo("estoque", lambda ctx: None, quebrada),
          Passo("cobrar", recusar)]
r = executar_saga(passos, {}, max_tentativas=2)
assert chamadas == ["liberar", "liberar", "cancelar"], f"tente max_tentativas vezes e continue compensando: {chamadas}"
assert r.status == "intervencao", f"status: {r.status}"
assert r.pendentes == ["estoque"], f"pendentes: {r.pendentes}"
assert r.log == ["ok:pedido", "ok:estoque", "falhou:cobrar", "compensacao_falhou:estoque", "compensou:pedido"], f"log: {r.log}"`,
        },
        {
          name: 'passo que não é re-tentável não se repete; o primeiro não tem o que compensar',
          hidden: true,
          code: `execucoes = []
def recusar(ctx):
    execucoes.append(1)
    raise RuntimeError("cartão recusado")

r = executar_saga([Passo("cobrar", recusar, lambda ctx: 1 / 0)], {}, max_tentativas=5)
assert len(execucoes) == 1, f"falha de regra de negócio antes do pivô não se repete: {len(execucoes)} execuções"
assert (r.status, r.log, r.pendentes) == ("compensada", ["falhou:cobrar"], []), (r.status, r.log, r.pendentes)`,
        },
        {
          name: 'cada execução tem seu próprio log',
          hidden: true,
          code: `a = executar_saga([Passo("x", lambda ctx: None)], {})
b = executar_saga([Passo("y", lambda ctx: None)], {})
assert a.log == ["ok:x"] and b.log == ["ok:y"], f"o log vazou entre sagas: {a.log}, {b.log}"
vazia = executar_saga([], {})
assert (vazia.status, vazia.log) == ("concluida", []), (vazia.status, vazia.log)`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo captura até `KeyboardInterrupt` e `SystemExit`: um Ctrl+C viraria "passo falhou" e dispararia compensações. Use `except Exception:`.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => m.tryBlocks >= 2,
          text: 'A lógica "tentar até N vezes" aparece em mais de um `try`. Extraia um helper, como `_tentar(funcao, ctx, vezes)`, e use-o nos passos re-tentáveis **e** nas compensações — é a mesma política de retry, num lugar só.',
          concept: 'Retry de passos idempotentes',
        },
        {
          when: m => m.mutableDefaults > 0,
          text: 'Há um parâmetro com default mutável (`[]`/`{}`): ele é criado **uma vez** e compartilhado entre chamadas — duas sagas acabariam dividindo o mesmo log. Use `None` e crie a lista dentro da função.',
          concept: 'Estado por execução',
        },
        {
          when: m => m.calls.includes('sleep'),
          text: 'Você chamou `sleep` entre tentativas. Num orquestrador real, a próxima tentativa é **agendada** (com backoff), sem travar o processo; aqui, só deixaria os testes lentos.',
          concept: 'Orquestrador de saga',
        },
      ],
      hints: [
        'Comece por um helper: `_tentar(funcao, ctx, vezes)` chama `funcao(ctx)` dentro de `try/except Exception`, num `for`, devolvendo `True` no primeiro sucesso e `False` se todas as tentativas falharem.',
        'Percorra os passos guardando os concluídos numa lista. Use `vezes = max_tentativas if passo.retentavel else 1`. Deu certo? Registre `f"ok:{passo.nome}"` e guarde o passo.',
        'Na falha: se o passo é re-tentável, devolva `ResultadoSaga("intervencao", log, [passo.nome])`. Senão, percorra `reversed(concluidos)`, pule quem tem `compensacao is None` e use `_tentar(feito.compensacao, ctx, max_tentativas)`, anotando no log e em `pendentes`.',
      ],
      solution: `from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class Passo:
    nome: str
    acao: Callable
    compensacao: Callable | None = None
    retentavel: bool = False          # True nos passos depois do pivô


@dataclass
class ResultadoSaga:
    status: str                       # "concluida" | "compensada" | "intervencao"
    log: list = field(default_factory=list)
    pendentes: list = field(default_factory=list)


def _tentar(funcao, ctx, vezes):
    for _ in range(vezes):
        try:
            funcao(ctx)
            return True
        except Exception:
            pass                      # em produção: registre o erro e aplique backoff
    return False


def executar_saga(passos, ctx, max_tentativas=3):
    log, concluidos = [], []
    for passo in passos:
        vezes = max_tentativas if passo.retentavel else 1
        if _tentar(passo.acao, ctx, vezes):
            log.append(f"ok:{passo.nome}")
            concluidos.append(passo)
            continue

        log.append(f"falhou:{passo.nome}")
        if passo.retentavel:                  # depois do pivô: nada de compensar
            return ResultadoSaga("intervencao", log, [passo.nome])

        pendentes = []
        for feito in reversed(concluidos):   # do mais recente ao mais antigo
            if feito.compensacao is None:
                continue
            if _tentar(feito.compensacao, ctx, max_tentativas):
                log.append(f"compensou:{feito.nome}")
            else:
                log.append(f"compensacao_falhou:{feito.nome}")
                pendentes.append(feito.nome)
        return ResultadoSaga("intervencao" if pendentes else "compensada", log, pendentes)

    return ResultadoSaga("concluida", log)
`,
      solutionExplanation: 'O orquestrador funciona como uma **pilha**: cada passo concluído é empilhado e, na falha, desempilhado com `reversed` — compensando do mais recente para o mais antigo. O passo que falhou fica de fora (ele não commitou), e passos sem compensação (leituras, validações) são pulados. As compensações são **re-tentadas**, o que só é seguro porque elas são **idempotentes**; se uma ainda assim falhar, o orquestrador **não para**: compensa o resto e marca a pendência para intervenção humana. Depois do **pivô**, a lógica se inverte — passo re-tentável não compensa nada, só repete. Num orquestrador real, o estado (passo atual, `concluidos`, `ctx`) é **persistido** a cada passo, para retomar depois de uma queda — é o que as ferramentas de *durable execution* fazem por você.',
    },
    {
      type: 'open',
      id: 'arq-saga-q6',
      concept: 'Desenho de sagas',
      say: 'Para fechar, uma entrevista de system design em miniatura.',
      prompt: 'Desenhe a saga de **reserva de viagem**: bloquear o assento do voo (API da companhia aérea), reservar o hotel e **cobrar o cliente**, cada um num serviço diferente. Quais são os passos e suas **compensações**? Qual é o **pivô** e o que acontece depois dele? E como você lida com **mensagens duplicadas**?',
      minWords: 35,
      rubric: [
        { label: 'Lista os passos com suas **compensações** (liberar o assento, cancelar o hotel…)', keywords: ['compens', 'cancel', 'liberar', 'libera o', 'libero', 'desfaz', 'estorn', 'desbloque'], concept: 'Transação de compensação', why: 'Cada passo compensável precisa de uma operação que anule seu efeito, executada em ordem reversa quando algo falha.' },
        { label: 'Identifica a **transação pivô** (o ponto sem volta)', keywords: ['pivo', 'pivot', 'sem volta', 'ponto de nao retorno', 'nao tem volta', 'irreversiv', 'go/no-go'], concept: 'Transação pivô', why: 'Saber qual passo é o ponto sem volta define o que é compensável e o que só pode ser re-tentado.' },
        { label: 'Depois do pivô, passos **re-tentáveis** (repetir em vez de compensar)', keywords: ['retent', 're-tent', 'retry', 'tentar de novo', 'tenta de novo', 'repet', 'reprocess', 'ate dar certo'], concept: 'Transação re-tentável', why: 'Depois do pivô a saga só anda para a frente: erros técnicos se resolvem repetindo.' },
        { label: 'Trata **duplicatas** com **idempotência** (id da saga, chave de deduplicação)', keywords: ['idempot', 'duplica', 'deduplic', 'id da saga', 'saga_id', 'chave', 'mesma mensagem'], concept: 'Idempotência', why: 'Mensageria entrega pelo menos uma vez e o orquestrador retoma do meio: passos e compensações vão rodar mais de uma vez.' },
      ],
      modelAnswer: `Eu usaria uma saga **orquestrada**, com o estado persistido a cada passo:

1. **Bloquear o assento** na companhia aérea — compensação: **liberar** o assento.
2. **Reservar o hotel** — compensação: **cancelar** a reserva (tarifa com cancelamento grátis).
3. **Cobrar o cliente** — é a **transação pivô**, o ponto sem volta: se a cobrança falha, compenso em ordem reversa (cancelo o hotel e libero o assento); se passa, a saga vai até o fim.
4. **Emitir a passagem** e **confirmar o hotel** — passos **re-tentáveis**: se a API cair, faço *retry* com backoff até dar certo, sem compensar; se esgotar, a saga vai para intervenção humana.

Coloco antes do pivô os passos que mais falham (assento e quarto disponíveis). Para **duplicatas**, todo comando leva o **id da saga** como chave de **idempotência**: cada serviço guarda os ids já processados e ignora repetições — inclusive nas compensações, que precisam aceitar "não havia nada para desfazer". E, enquanto a saga roda, a reserva fica \`PENDENTE\` (um *semantic lock*), para ninguém alterá-la no meio.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Recapitulando: o **2PC** trava tudo; a **saga** avança com transações locais e desfaz com **compensações**, em ordem reversa…',
        '…organizada em compensáveis → **pivô** → re-tentáveis, com **semantic locks** contra estados intermediários e passos **idempotentes**. Próxima unidade: qualidades e evolução da arquitetura!',
      ],
      board: null,
    },
  ],
});
