Game.registerModule('architecture', {
  id: 'event-driven',
  title: 'Arquitetura Orientada a Eventos',
  kind: 'lesson',
  level: 2,
  order: 13,
  unit: 'estilos',
  summary: 'Comandos, eventos e consultas; pub/sub, event-carried state transfer, coreografia × orquestração e o preço da consistência eventual.',
  concepts: ['Eventos × comandos', 'Pub/Sub', 'Event-carried state transfer', 'Coreografia × orquestração', 'Consistência eventual'],
  takeaways: [
    'Um **comando** é uma intenção com um destinatário (pode ser recusado); um **evento** é um fato no passado para zero ou N ouvintes; uma **consulta** só lê.',
    'Pub/sub desacopla no **espaço** e no **tempo**: quem publica não conhece os assinantes nem espera por eles — adeus, **acoplamento temporal**.',
    '**Event notification** manda só o id e obriga o consumidor a consultar a fonte; **event-carried state transfer** manda os dados e dá autonomia, ao custo de cópias eventualmente consistentes.',
    '**Coreografia**: cada serviço reage a eventos (baixo acoplamento, fluxo espalhado). **Orquestração**: um coordenador manda comandos (fluxo explícito, lógica concentrada).',
    'Eventos trazem **consistência eventual** e duplicatas: consumidores **idempotentes**, falhas isoladas por assinante e dead letters não são opcionais.',
  ],
  glossary: [
    { term: 'Event-carried state transfer', aliases: ['ECST', 'event carried state transfer', 'transferência de estado por eventos'], definition: 'Estilo de evento que **carrega os dados** de que os consumidores precisam (ex.: o novo endereço), para que eles mantenham uma cópia local e não precisem consultar a fonte. Ganha autonomia; paga com dados duplicados e consistência eventual.' },
    { term: 'Event notification', aliases: ['notificação de evento', 'eventos de notificação'], definition: 'Estilo de evento **mínimo** ("o cliente 42 mudou"): avisa que algo aconteceu e, se o consumidor quiser detalhes, ele precisa consultar a fonte — o que cria acoplamento em tempo de execução.' },
    { term: 'Acoplamento temporal', aliases: ['temporal coupling'], definition: 'Quando dois componentes precisam estar **disponíveis ao mesmo tempo** para uma operação funcionar (ex.: chamada HTTP síncrona). Mensageria assíncrona remove esse acoplamento: a mensagem espera no broker.' },
    { term: 'Coreografia', aliases: ['choreography', 'saga coreografada'], definition: 'Coordenação **descentralizada**: cada serviço reage a eventos e publica os seus; nenhum componente conhece o fluxo inteiro. Baixo acoplamento, mas o processo fica espalhado e difícil de acompanhar.' },
    { term: 'Orquestração', aliases: ['orchestration', 'saga orquestrada'], definition: 'Coordenação **centralizada**: um orquestrador envia comandos aos serviços, acompanha as respostas e decide o próximo passo. O fluxo fica explícito e monitorável, mas o orquestrador concentra a lógica do processo.' },
    { term: 'Consistência eventual', aliases: ['eventual consistency', 'eventualmente consistente'], definition: 'Garantia de que, **se não houver novas escritas**, todas as cópias de um dado acabam convergindo para o mesmo valor — mas, por um tempo, leitores diferentes podem ver versões diferentes.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Até aqui, nossos módulos conversavam dando **ordens**: "reserve o estoque", "mande o e-mail".',
        'Hoje vamos virar a chave: em vez de mandar, o serviço **anuncia o que aconteceu** — e quem se interessar reage. Bem-vindo à **arquitetura orientada a eventos**!',
      ],
      board: {
        title: 'Orientado a requisições × orientado a eventos',
        md: `\`\`\`text
 ANTES — orientado a requisições (síncrono)

   Pedidos ──reservar()──────▶ Estoque
      │   (e espera cada resposta…)
      ├───enviar_email()─────▶ E-mail
      └───registrar_venda()──▶ Analytics

 DEPOIS — orientado a eventos (assíncrono)

   Pedidos ──PedidoCriado──▶ [ broker ] ──┬──▶ Estoque
                                          ├──▶ E-mail
                                          └──▶ Analytics
\`\`\`

- **Novo interessado** (ex.: programa de fidelidade)? Antes: mexer em Pedidos. Depois: ele só **assina** \`PedidoCriado\`.
- **E-mail fora do ar?** Antes: o pedido falha ou fica lento. Depois: a mensagem **espera** no broker.

> [!dica] Evento não é bala de prata: ele troca acoplamento **explícito** (uma chamada que você lê no código) por acoplamento **implícito** (quem assina o quê?). Vamos ver os custos também.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Primeiro, vocabulário. Nem toda mensagem é um evento! Existem três sabores: **comando**, **evento** e **consulta**.',
        'A diferença mais importante: um comando pode ser **recusado**; um evento, não — ele já aconteceu.',
      ],
      board: {
        title: 'Comando × evento × consulta',
        md: `| | **Comando** | **Evento** | **Consulta** |
|---|---|---|---|
| Significa | Intenção: "faça isto" | Fato: "isto aconteceu" | Pergunta: "como está?" |
| Nome | Imperativo: \`ReservarEstoque\` | Passado: \`EstoqueReservado\` | \`ObterSaldo\` |
| Destinatários | **Exatamente um** | **Zero, um ou vários** | Um |
| Pode ser recusado? | Sim | Não — já aconteceu | — |
| Muda estado? | Sim, se aceito | Já mudou, no emissor | **Não** |
| Quem conhece quem | Emissor conhece o destino | Emissor não conhece ninguém | Leitor conhece a fonte |

\`\`\`python
from dataclasses import dataclass

@dataclass(frozen=True)
class ReservarEstoque:      # comando: intenção, pode ser recusado
    pedido_id: str
    sku: str
    quantidade: int

@dataclass(frozen=True)
class EstoqueReservado:     # evento: fato imutável, nome no passado
    pedido_id: str
    sku: str
    quantidade: int
\`\`\`

> [!atencao] Cuidado com o **evento passivo-agressivo** (termo de Martin Fowler): \`FaturaPrecisaSerEmitida\` tem cara de evento, mas o emissor *espera* que alguém específico aja. É um comando disfarçado — se você precisa que algo aconteça, mande o comando \`EmitirFatura\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'No **pub/sub**, quem publica entrega a mensagem a um intermediário — o *broker* (Kafka, RabbitMQ, SNS…) — e segue a vida.',
        'Isso elimina o **acoplamento temporal**: numa cadeia de chamadas síncronas, todo mundo precisa estar no ar **ao mesmo tempo**, e as indisponibilidades se somam.',
      ],
      board: {
        title: 'Pub/sub e acoplamento temporal',
        md: `O pub/sub desacopla em **três dimensões**:

| Dimensão | O que significa |
|---|---|
| **Espaço** | Quem publica não sabe quem (nem quantos) assinam |
| **Tempo** | Os dois lados não precisam estar no ar ao mesmo tempo |
| **Sincronização** | Quem publica não fica bloqueado esperando o processamento |

**Acoplamento temporal em números:** uma cadeia síncrona de 3 serviços com 99,9% de disponibilidade cada fica com 0,999³ ≈ **99,7%** — cerca de **26 horas** fora do ar por ano, contra ~9 horas de um serviço sozinho.

\`\`\`text
 fan-out (pub/sub): cada ASSINANTE recebe sua cópia
   PedidoCriado ──┬──▶ Estoque
                  ├──▶ E-mail
                  └──▶ Analytics

 competing consumers: instâncias do MESMO serviço dividem a fila
   fila do E-mail ──┬──▶ email-1  (mensagens 1, 3, 5…)
                    └──▶ email-2  (mensagens 2, 4, 6…)
\`\`\``,
        caption: 'Fan-out distribui **cópias** entre serviços diferentes; competing consumers distribuem **trabalho** entre réplicas do mesmo serviço.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora um detalhe que pouca gente conhece: existem **dois jeitos** bem diferentes de desenhar um evento.',
        'No **event notification**, o evento é magrinho — só um id — e quem recebe precisa **perguntar à fonte**. No **event-carried state transfer**, o evento já **carrega os dados**.',
      ],
      board: {
        title: 'Event notification × event-carried state transfer',
        md: `\`\`\`python
# EVENT NOTIFICATION — "algo mudou"; detalhes? pergunte à fonte
@dataclass(frozen=True)
class ClienteAlterado:
    cliente_id: str

def ao_alterar_cliente(evento):                       # no serviço de Faturamento
    cliente = api_clientes.buscar(evento.cliente_id)  # ☎️ chamada síncrona de volta!
    enderecos[cliente.id] = cliente.endereco


# EVENT-CARRIED STATE TRANSFER — o evento leva o estado necessário
@dataclass(frozen=True)
class EnderecoDoClienteAlterado:
    cliente_id: str
    endereco: str
    versao: int

def ao_alterar_endereco(evento):                      # réplica local, sem callback
    atual = copia_local.get(evento.cliente_id)
    if atual is None or evento.versao > atual.versao:  # ignora eventos atrasados
        copia_local[evento.cliente_id] = evento
\`\`\`

| | Event notification | Event-carried state transfer |
|---|---|---|
| Tamanho do evento | Mínimo (ids) | Maior (os dados relevantes) |
| Consumidor consulta a fonte? | Sim, a cada evento | Não |
| Se a fonte cair… | O consumidor para junto | O consumidor segue com a cópia |
| Custo | Carga e acoplamento na fonte | Dados duplicados, consistência eventual, esquema do evento vira **contrato** |

> [!sabia] Em 2017, Martin Fowler notou que "event-driven" é usado para **quatro** coisas diferentes: *event notification*, *event-carried state transfer*, *event sourcing* e *CQRS*. O **event-carried state transfer** (ECST) é o menos conhecido — e é ele que deixa um serviço funcionando mesmo com a fonte dos dados fora do ar. Os dois últimos você vê na unidade **Dados & eventos**.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Quando um processo de negócio envolve vários serviços, alguém precisa conduzir o fluxo. Ou ninguém!',
        'Na **coreografia**, cada serviço reage a eventos e publica os seus. Na **orquestração**, um coordenador manda comandos e decide o próximo passo.',
      ],
      board: {
        title: 'Coreografia × orquestração',
        md: `\`\`\`text
 COREOGRAFIA — cada serviço reage ao que ouve
   Pedidos ──PedidoCriado──▶ Pagamentos
   Pagamentos ──PagamentoAprovado──▶ Estoque
   Estoque ──EstoqueReservado──▶ Entregas
   (o fluxo só existe "na soma" dos serviços)

 ORQUESTRAÇÃO — um coordenador rege o processo
                    ┌──ReservarEstoque──▶ Estoque
   Orquestrador ────┼──CobrarCartao─────▶ Pagamentos
   (sabe o fluxo)   └──AgendarEntrega───▶ Entregas
                    respostas voltam para o orquestrador
\`\`\`

| | Coreografia | Orquestração |
|---|---|---|
| Quem conhece o fluxo | Ninguém sozinho | O orquestrador |
| Acoplamento | Baixo: só eventos | Serviços recebem comandos do orquestrador |
| Visibilidade | Difícil: "em que passo está o pedido 42?" | Fácil: o estado do processo está num lugar |
| Mudar o processo | Mexe em vários serviços | Mexe (quase só) no orquestrador |
| Risco típico | Ciclos e "sopa de eventos" | Orquestrador vira um **god service** |

> [!dica] Regra prática: poucos passos e donos independentes → **coreografia**. Processo longo, com prazos, regras e compensações → **orquestração**. Misturar os dois é comum — e é o assunto da aula de **sagas**.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Nada disso é de graça. O primeiro preço é a **consistência eventual**: por alguns instantes, serviços diferentes enxergam versões diferentes da verdade.',
        'E brokers costumam entregar **pelo menos uma vez**: seu consumidor vai receber duplicatas, então ele precisa ser **idempotente**.',
      ],
      board: {
        title: 'O preço dos eventos',
        md: `| Problema | O que acontece | Remédio |
|---|---|---|
| Consistência eventual | O cliente cria o pedido e "meus pedidos" ainda não mostra | Estados explícitos ("processando…"), ler de quem escreveu |
| Entrega *at-least-once* | O mesmo \`PedidoCriado\` chega duas vezes | Consumidor **idempotente** (dedup pelo id do evento) |
| Ordem | \`PedidoCancelado\` chega antes de \`PedidoCriado\` | Ordem só por chave/partição; versão no evento |
| Dual write | Salvou no banco e caiu antes de publicar | **Transactional outbox** (trilha de Bancos de Dados) |
| Depuração | "Quem reagiu a isso?" | Correlation id, tracing, catálogo de eventos |

\`\`\`python
class ConsumidorDeEmail:
    def __init__(self, enviar_email):
        self.enviar_email = enviar_email
        self.processados = set()     # em produção: tabela com UNIQUE(evento_id)

    def ao_receber(self, evento):
        if evento.evento_id in self.processados:
            return                   # duplicata: já tratei, ignoro
        self.enviar_email(evento.pedido_id)
        self.processados.add(evento.evento_id)
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Para fechar a teoria, vamos olhar por dentro de um **barramento em memória** — igual ao que você vai implementar.',
        'O bug clássico: um assinante lança exceção e os **outros nunca recebem** o evento. Cada assinante precisa falhar **sozinho**.',
      ],
      board: {
        title: 'Por dentro de um barramento de eventos',
        md: `\`\`\`python
class BusIngenuo:
    def __init__(self):
        self.assinantes = {}      # tipo do evento -> lista de handlers

    def assinar(self, tipo, handler):
        self.assinantes.setdefault(tipo, []).append(handler)

    def publicar(self, evento):
        for handler in self.assinantes.get(type(evento), []):
            handler(evento)       # 💥 se o 1º falhar, o 2º e o 3º nunca recebem
\`\`\`

**Regras de um bom barramento:**
- Assinatura **por tipo** de evento (a classe), entregue na ordem de inscrição.
- Cada assinante falha **sozinho**: \`try/except\` **por assinante**, nunca em volta do laço inteiro.
- Falha transitória? **Retente** com limite. Esgotou? Guarde numa **dead letter** para inspecionar e reprocessar.
- Retry significa que o handler pode rodar de novo → ele precisa ser **idempotente**.`,
        caption: 'Comandos falham **alto** (a exceção volta para quem enviou); eventos falham **isolados** (registra, retenta, segue).',
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — a última é um barramento de eventos testado de verdade.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-eda-q1',
      concept: 'Eventos × comandos',
      say: 'Vamos começar pelo vocabulário. Qual destas mensagens é um evento de verdade?',
      prompt: 'Qual destas mensagens é um **evento** bem nomeado?',
      options: [
        { text: '`PagamentoAprovado(pedido_id, valor)`', correct: true, why: 'Fato no passado e imutável: quem publica não sabe quem vai reagir (e-mail, estoque, analytics…).' },
        { text: '`AprovarPagamento(pedido_id)`', why: 'Imperativo: é um **comando**, endereçado a quem pode aprovar — e que pode recusar.' },
        { text: '`ObterStatusDoPagamento(pedido_id)`', why: 'É uma **consulta**: pede dados e não muda estado.' },
        { text: '`PagamentoPrecisaSerEstornado(pedido_id)`', why: 'Tem cara de evento, mas é um **evento passivo-agressivo**: o emissor espera que alguém específico estorne. Isso é o comando `EstornarPagamento` disfarçado.' },
      ],
      explanation: 'Eventos são **fatos**: nome no passado, imutáveis, publicados sem saber quem vai ouvir — por isso não podem ser "recusados". Comandos são **intenções** endereçadas a quem pode executá-las (e recusá-las); consultas só leem. O *evento passivo-agressivo* é um comando disfarçado: o emissor finge anunciar um fato, mas depende de alguém agir — o acoplamento continua lá, só que escondido.',
    },
    {
      type: 'match',
      id: 'arq-eda-q2',
      concept: 'Vocabulário orientado a eventos',
      say: 'Fixação rápida: associe cada conceito à sua definição.',
      prompt: 'Associe cada conceito à sua definição.',
      pairs: [
        { left: '**Comando**', right: 'Intenção dirigida a um destinatário, que pode recusá-la' },
        { left: '**Evento**', right: 'Fato no passado, anunciado a quem quiser ouvir' },
        { left: '**Consulta**', right: 'Pede dados sem mudar o estado' },
        { left: '**Event-carried state transfer**', right: 'O evento leva os dados e o consumidor mantém uma cópia local' },
        { left: '**Acoplamento temporal**', right: 'Os dois lados precisam estar no ar ao mesmo tempo' },
      ],
      explanation: 'Comandos e consultas têm destinatário conhecido; eventos, não. O **event-carried state transfer** leva essa independência ao extremo: com os dados no evento, o consumidor nem precisa da fonte no ar. E é a comunicação assíncrona que elimina o **acoplamento temporal**.',
    },
    {
      type: 'mcq',
      id: 'arq-eda-q3',
      concept: 'Event-carried state transfer',
      say: 'Agora um incidente de Black Friday. O que você mudaria?',
      prompt: 'O serviço de **Frete** consome `PedidoCriado(pedido_id)` e, a cada evento, faz `GET /pedidos/{id}` no serviço de Pedidos para descobrir endereço e peso. Na Black Friday, Pedidos fica lento e o Frete **para junto**. Qual mudança ataca a causa?',
      options: [
        { text: 'Publicar `PedidoCriado` com os dados que o Frete precisa (endereço, peso) — **event-carried state transfer** — e o Frete guarda sua própria cópia.', correct: true, why: 'Some o callback: o Frete deixa de depender de Pedidos em tempo de execução. O custo são dados duplicados, consistência eventual e um evento maior, que vira contrato.' },
        { text: 'Aumentar o timeout e o número de retries do `GET /pedidos/{id}`.', why: 'Trata o sintoma — e mais retries num serviço já sobrecarregado pioram tudo (*retry storm*).' },
        { text: 'Trocar o evento por uma chamada síncrona de Pedidos para Frete (`POST /fretes`).', why: 'Aumenta o **acoplamento temporal**: agora é Pedidos que depende de Frete estar no ar.' },
        { text: 'Deixar o Frete ler direto as tabelas do banco de Pedidos.', why: 'Banco compartilhado acopla o Frete ao esquema interno de Pedidos — caminho direto para o monólito distribuído. E o banco continua sobrecarregado.' },
      ],
      explanation: 'Com **event notification**, cada evento vira uma chamada de volta à fonte: o consumidor ganha um acoplamento em tempo de execução e a fonte recebe carga extra justamente no pico. Com **event-carried state transfer**, o evento traz endereço e peso; o Frete mantém sua cópia e segue funcionando mesmo com Pedidos fora do ar. O preço: dados duplicados, consistência eventual e um evento que vira **contrato** — mude-o com versionamento.',
    },
    {
      type: 'open',
      id: 'arq-eda-q4',
      concept: 'Coreografia × orquestração',
      say: 'Pergunta de design, como numa entrevista: coreografia ou orquestração?',
      prompt: 'Sua empresa vai implementar o fluxo **pedido → pagamento → estoque → entrega** entre quatro serviços. Compare **coreografia** e **orquestração**: como cada uma funciona, vantagens e riscos — e qual você escolheria, e em que situação.',
      minWords: 25,
      rubric: [
        { label: 'Explica a **coreografia**: serviços reagem a eventos, sem coordenador central', keywords: ['reage', 'reagem', 'reagindo', 'escuta', 'escutam', 'assina', 'descentraliz', 'sem coordenador', 'sem um coordenador', 'sem orquestrador', 'nenhum coordenador', 'ninguem coordena', 'sem controle central'], concept: 'Coreografia', why: 'Na coreografia, o fluxo emerge das reações de cada serviço aos eventos dos outros.' },
        { label: 'Explica a **orquestração**: um coordenador envia comandos e decide o próximo passo', keywords: ['coordenador', 'orquestrador', 'central', 'comando', 'maestro', 'decide o proximo', 'controla o fluxo'], concept: 'Orquestração', why: 'Na orquestração, um componente conhece o processo e comanda cada passo.' },
        { label: 'Aponta os **trade-offs**: acoplamento × visibilidade/depuração do fluxo', keywords: ['visibil', 'rastre', 'depur', 'debug', 'monitor', 'observab', 'espalhad', 'dificil de entender', 'dificil de acompanhar', 'god', 'gargalo', 'ponto unico', 'ciclo', 'acopla'], concept: 'Coreografia × orquestração', why: 'Coreografia reduz acoplamento mas espalha o fluxo; orquestração dá visibilidade mas concentra lógica.' },
        { label: 'Dá um **critério de escolha** (complexidade, compensações, número de passos)', keywords: ['poucos passos', 'muitos passos', 'simples', 'complex', 'compens', 'prazo', 'timeout', 'regra', 'depende', 'mistur', 'hibrid', 'saga'], concept: 'Decisão arquitetural', why: 'Não há resposta única: dar o critério mostra maturidade.' },
      ],
      modelAnswer: `Na **coreografia**, não há coordenador central: cada serviço **reage** aos eventos dos outros e publica os seus — Pedidos publica \`PedidoCriado\`, Pagamentos reage e publica \`PagamentoAprovado\`, Estoque reage e publica \`EstoqueReservado\`, e assim por diante. O acoplamento é baixo (ninguém chama ninguém), mas o fluxo fica **espalhado**: é difícil responder "em que passo está o pedido 42?", **depurar** e evitar ciclos de eventos.

Na **orquestração**, um **orquestrador** central conhece o processo: envia **comandos** (\`CobrarCartao\`, \`ReservarEstoque\`) e decide o próximo passo pelas respostas. O fluxo fica explícito, fácil de **monitorar** e de mudar, e as compensações ficam num lugar só — o risco é o orquestrador virar um *god service*, acumulando regras que pertencem aos serviços.

Critério: para fluxos **simples**, com poucos passos e donos independentes, eu usaria coreografia. Para este fluxo, que envolve pagamento, prazos e **compensações** (estornar se o estoque falhar), eu escolheria **orquestração** — e manteria eventos para quem só precisa ser notificado, como e-mail e analytics.`,
    },
    {
      type: 'code',
      id: 'arq-eda-q5',
      concept: 'Isolamento de falhas por assinante',
      title: 'Event bus com falhas isoladas',
      say: 'Agora é com você: um barramento em memória em que um assinante com defeito **não derruba** os outros.',
      prompt: `Implemente a classe \`EventBus\` (em memória) com **falhas isoladas por assinante**:

- \`EventBus(max_tentativas=1)\` — o padrão é 1 tentativa (sem retry).
- \`assinar(tipo_evento, handler)\` — inscreve \`handler\` para eventos da classe \`tipo_evento\`. A ordem de inscrição é a ordem de entrega.
- \`publicar(evento)\` — entrega o evento a **todos** os handlers inscritos em \`type(evento)\` e devolve **quantos processaram com sucesso**.
  - Evento sem assinantes não é erro: devolve \`0\`.
  - Se um handler lançar uma exceção (\`Exception\`), o bus **não propaga**: tenta de novo, até \`max_tentativas\` vezes no total. Se ainda falhar, registra **uma** tupla \`(evento, handler, erro)\` em \`self.dead_letters\` — com o erro da última tentativa — e **segue** para o próximo handler.
- Cada bus tem suas **próprias** inscrições e dead letters.`,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class PedidoCriado:
    pedido_id: str
    total: int


@dataclass(frozen=True)
class PedidoCancelado:
    pedido_id: str


class EventBus:
    def __init__(self, max_tentativas=1):
        self.max_tentativas = max_tentativas
        self.dead_letters = []   # (evento, handler, erro)

    def assinar(self, tipo_evento, handler):
        pass

    def publicar(self, evento):
        # TODO: entregue a cada handler, isolando as falhas de cada um
        return 0
`,
      tests: [
        {
          name: 'entrega a todos, na ordem de inscrição',
          code: `bus = EventBus()
recebidos = []
bus.assinar(PedidoCriado, lambda e: recebidos.append(("estoque", e.pedido_id)))
bus.assinar(PedidoCriado, lambda e: recebidos.append(("email", e.pedido_id)))
n = bus.publicar(PedidoCriado("p1", 100))
assert recebidos == [("estoque", "p1"), ("email", "p1")], f"entregas inesperadas: {recebidos}"
assert n == 2, f"publicar deveria devolver 2 (sucessos), devolveu {n}"`,
        },
        {
          name: 'só recebe quem assinou aquele tipo',
          code: `bus = EventBus()
criados, cancelados = [], []
bus.assinar(PedidoCriado, criados.append)
bus.assinar(PedidoCancelado, cancelados.append)
bus.publicar(PedidoCancelado("p9"))
assert criados == [], "quem assinou PedidoCriado não deveria receber PedidoCancelado"
assert cancelados == [PedidoCancelado("p9")]`,
        },
        { name: 'evento sem assinantes devolve 0', expr: 'EventBus().publicar(PedidoCriado("p1", 10))', expected: '0' },
        {
          name: 'assinante com defeito não derruba os outros',
          code: `bus = EventBus()
recebidos = []
def estoque(e):
    raise ConnectionError("estoque fora do ar")
bus.assinar(PedidoCriado, estoque)
bus.assinar(PedidoCriado, lambda e: recebidos.append(e.pedido_id))
evento = PedidoCriado("p2", 50)
n = bus.publicar(evento)
assert recebidos == ["p2"], "o segundo assinante deveria receber mesmo com o primeiro falhando"
assert n == 1, f"só 1 handler teve sucesso, mas publicar devolveu {n}"
assert len(bus.dead_letters) == 1, f"esperava 1 dead letter, obtido {bus.dead_letters}"
ev, handler, erro = bus.dead_letters[0]
assert ev == evento and handler is estoque and isinstance(erro, ConnectionError)`,
        },
        {
          name: 'falha transitória se recupera no retry',
          code: `bus = EventBus(max_tentativas=3)
chamadas = []
def instavel(e):
    chamadas.append(e.pedido_id)
    if len(chamadas) < 2:
        raise TimeoutError("tente de novo")
bus.assinar(PedidoCriado, instavel)
assert bus.publicar(PedidoCriado("p3", 10)) == 1
assert chamadas == ["p3", "p3"], f"deveria tentar 2 vezes, tentou {len(chamadas)}"
assert bus.dead_letters == [], "o handler se recuperou: não há dead letter"`,
        },
        {
          name: 'esgota as tentativas: uma dead letter com o último erro',
          hidden: true,
          code: `bus = EventBus(max_tentativas=3)
tentativas = []
def quebrado(e):
    tentativas.append(1)
    raise ValueError(f"falha {len(tentativas)}")
bus.assinar(PedidoCriado, quebrado)
assert bus.publicar(PedidoCriado("p4", 1)) == 0
assert len(tentativas) == 3, f"deveria tentar exatamente 3 vezes, tentou {len(tentativas)}"
assert len(bus.dead_letters) == 1, "registre UMA dead letter por handler, não uma por tentativa"
assert str(bus.dead_letters[0][2]) == "falha 3", "guarde o erro da última tentativa"`,
        },
        {
          name: 'sem retry por padrão',
          hidden: true,
          code: `bus = EventBus()
tentativas = []
def falha(e):
    tentativas.append(1)
    raise RuntimeError("x")
bus.assinar(PedidoCriado, falha)
assert bus.publicar(PedidoCriado("p5", 1)) == 0
assert len(tentativas) == 1, f"com max_tentativas=1 deveria tentar 1 vez, tentou {len(tentativas)}"`,
        },
        {
          name: 'cada bus tem suas próprias inscrições',
          hidden: true,
          code: `a, b = EventBus(), EventBus()
recebidos = []
a.assinar(PedidoCriado, recebidos.append)
assert b.publicar(PedidoCriado("p6", 1)) == 0 and recebidos == [], "as inscrições vazaram de um bus para outro"
assert a.dead_letters is not b.dead_letters`,
        },
        {
          name: 'handler pode publicar outro evento (cascata)',
          hidden: true,
          code: `bus = EventBus()
log = []
def cancelar_se_vazio(e):
    if e.total == 0:
        bus.publicar(PedidoCancelado(e.pedido_id))
bus.assinar(PedidoCriado, cancelar_se_vazio)
bus.assinar(PedidoCancelado, lambda e: log.append(e.pedido_id))
bus.publicar(PedidoCriado("p7", 0))
assert log == ["p7"]`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo captura até `KeyboardInterrupt` e `SystemExit` — o processo nem consegue ser encerrado. Use `except Exception:`: é a fronteira de isolamento certa para erros de handler.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => m.calls.includes('sleep'),
          text: 'Dormir dentro do `publicar` bloqueia a entrega para **todos** os outros assinantes. Em produção, o retry com backoff é agendado pelo broker (ou por uma fila de retry), não feito com `sleep` no meio do laço.',
          concept: 'Isolamento de falhas por assinante',
        },
        {
          when: (m, code) => /^ {4}[A-Za-z_]\w*\s*=\s*(\{\}|\[\]|dict\(\)|list\(\)|defaultdict\()/m.test(code),
          text: 'Há um dicionário/lista criado como **atributo de classe**. Ele é compartilhado por todas as instâncias: as inscrições de um bus vazariam para outro. Crie o estado no `__init__` (`self._assinantes = {}`).',
          concept: 'Estado por instância',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O estado do barramento deve viver na instância — assim cada bus (e cada teste) é independente.',
          concept: 'Estado por instância',
        },
      ],
      hints: [
        'Guarde as inscrições num dicionário criado no `__init__`: `self._assinantes = {}` e, no `assinar`, `self._assinantes.setdefault(tipo_evento, []).append(handler)`.',
        'Em `publicar`, percorra `self._assinantes.get(type(evento), [])` e chame cada handler dentro do **seu próprio** `try/except Exception` — o `try` fica **dentro** do `for`, não em volta dele.',
        'Para o retry, um laço `for tentativa in range(self.max_tentativas)`: no sucesso, conte e pare; se a **última** tentativa falhar, faça `self.dead_letters.append((evento, handler, erro))`.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class PedidoCriado:
    pedido_id: str
    total: int


@dataclass(frozen=True)
class PedidoCancelado:
    pedido_id: str


class EventBus:
    def __init__(self, max_tentativas=1):
        self.max_tentativas = max_tentativas
        self.dead_letters = []   # (evento, handler, erro)
        self._assinantes = {}    # tipo do evento -> [handlers]

    def assinar(self, tipo_evento, handler):
        self._assinantes.setdefault(tipo_evento, []).append(handler)

    def publicar(self, evento):
        sucessos = 0
        for handler in list(self._assinantes.get(type(evento), [])):
            if self._entregar(evento, handler):
                sucessos += 1
        return sucessos

    def _entregar(self, evento, handler):
        for tentativa in range(1, self.max_tentativas + 1):
            try:
                handler(evento)
                return True
            except Exception as erro:
                if tentativa == self.max_tentativas:
                    self.dead_letters.append((evento, handler, erro))
        return False
`,
      solutionExplanation: 'Cada assinante é tratado como um **consumidor independente**: o `try/except` fica em `_entregar`, por handler, então a falha de um não impede a entrega aos outros — e o `publicar` nunca propaga o erro, porque quem publica um evento não deveria depender de quem o consome (ao contrário de um comando, que falha "alto"). Falhas transitórias ganham novas tentativas; esgotadas, viram **uma** dead letter com o último erro, para inspeção e reprocessamento. Em produção, o broker faz esse papel por grupo de consumidores, com backoff e DLQ — e, como o retry reexecuta o handler, ele precisa ser **idempotente**.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Resumindo: **comandos** pedem, **eventos** anunciam, **consultas** perguntam — e o pub/sub tira o acoplamento temporal.',
        'Event-carried state transfer dá autonomia aos consumidores, e coreografia × orquestração é uma troca entre acoplamento e visibilidade. Na unidade **Dados & eventos**, os próprios eventos viram a fonte da verdade!',
      ],
      board: null,
    },
  ],
});
