Game.registerModule('distributed', {
  id: 'mensageria',
  title: 'Mensageria: entrega, ordem e falhas',
  kind: 'lesson',
  level: 3,
  order: 21,
  unit: 'dados',
  summary: 'Filas × logs, at-most/at-least/exactly-once, ordem por partição e chave, consumer groups, poison messages, DLQ e o par outbox/inbox.',
  concepts: ['Garantias de entrega', 'Ordem por partição', 'Consumer group', 'Dead letter queue', 'Consumidor idempotente'],
  takeaways: [
    'Numa **fila**, consumir apaga a mensagem; num **log** (Kafka), a mensagem fica e cada consumidor anda com o seu **offset** — dá para reprocessar e ter vários leitores independentes.',
    'A ordem entre **commit do offset** e **processamento** define a garantia: commit antes = at-most-once (perde); commit depois = at-least-once (duplica).',
    '"Exactly-once" na prática é **at-least-once + idempotência**: o consumidor deduplica pelo id da mensagem, de preferência na mesma transação do efeito (inbox).',
    'A ordem só é garantida **dentro de uma partição**: mesma chave → mesma partição → mesma ordem. O paralelismo de um consumer group é limitado pelo número de partições.',
    'Uma **poison message** falha para sempre e trava a partição: depois de N tentativas, vai para a **DLQ** — com alerta, reprocessamento e cuidado com a ordem daquela chave.',
  ],
  glossary: [
    { term: 'Consumer group', aliases: ['consumer groups', 'grupo de consumidores', 'grupos de consumidores'], definition: 'Conjunto de consumidores que dividem as partições de um tópico: cada partição é lida por **um** membro do grupo por vez. Grupos diferentes leem o mesmo tópico de forma independente, cada um com os seus offsets.' },
    { term: 'Poison message', aliases: ['poison messages', 'poison pill', 'mensagem envenenada', 'mensagens envenenadas'], definition: 'Mensagem que faz o consumidor falhar **toda vez** (formato inválido, bug, dado inesperado). Sem limite de tentativas, ela é reentregue para sempre e trava tudo o que vem atrás dela.' },
    { term: 'Dead letter queue', aliases: ['DLQ', 'dead-letter queue', 'dead letter queues', 'fila de mensagens mortas'], definition: 'Fila (ou tópico) para onde vão as mensagens que falharam depois de N tentativas, com o erro anotado. Destrava o fluxo principal e guarda a mensagem para investigação e reprocessamento (*redrive*).' },
    { term: 'Exactly-once', aliases: ['exactly once', 'exatamente uma vez', 'effectively-once'], definition: 'Garantia de que cada mensagem tem efeito **uma única vez**. Entrega exatamente uma vez é impossível numa rede que perde mensagens; na prática, é **at-least-once + idempotência** (o *effectively-once*).' },
    { term: 'At-least-once', aliases: ['at least once', 'pelo menos uma vez'], definition: 'Garantia de entrega em que nenhuma mensagem se perde, mas algumas podem chegar **duplicadas**: o consumidor só confirma (ack/commit) **depois** de processar. É o padrão da maioria dos brokers.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Serviços que conversam por **mensagens** não precisam estar no ar ao mesmo tempo: o broker guarda, o consumidor processa quando puder.',
        'Mas existem dois bichos bem diferentes atrás da palavra "mensageria": a **fila** e o **log**.',
      ],
      board: {
        title: 'Fila × log',
        md: `\`\`\`text
 FILA (RabbitMQ, SQS)                       LOG (Kafka, Kinesis, Redpanda)
 produtor ─▶ [m3][m2][m1] ─▶ consumidor     produtor ─▶ | m1 | m2 | m3 | m4 | m5 | ─▶ (fica lá)
             ack apaga a mensagem                          ▲              ▲
                                                   grupo "fiscal"   grupo "email"
                                                   offset = 2       offset = 5
\`\`\`

| | Fila | Log |
|---|---|---|
| Depois de consumir | a mensagem **some** (ack) | a mensagem **fica** (por retenção) |
| Progresso | o broker controla | cada grupo guarda o seu **offset** |
| Vários leitores | competem pela mesma mensagem | cada grupo lê **tudo**, independente |
| Reprocessar | difícil | volte o offset e releia |
| Ordem | geralmente nenhuma (com vários consumidores) | total **dentro da partição** |
| Bom para | tarefas (*jobs*), trabalho a distribuir | eventos, integração, *event sourcing*, CDC |

> [!dica] Pergunta útil numa entrevista: "o consumidor precisa **reler** o histórico, ou vários sistemas precisam ver os mesmos eventos?" Se sim, log. Se é só distribuir trabalho, fila.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora a pergunta clássica: quantas vezes cada mensagem é processada? A resposta depende de **uma linha de código**: quando você confirma.',
        'Confirmou antes de processar e caiu? Perdeu. Confirmou depois e caiu antes do commit? Vai processar de novo.',
      ],
      board: {
        title: 'At-most, at-least, exactly-once',
        md: `\`\`\`python
# at-most-once: commit ANTES — se cair no meio, a mensagem se perde
msg = consumidor.poll()
consumidor.commit()
processar(msg)

# at-least-once: commit DEPOIS — se cair no meio, a mensagem volta (duplicada)
msg = consumidor.poll()
processar(msg)
consumidor.commit()
\`\`\`

| Garantia | Perde? | Duplica? | Onde se usa |
|---|---|---|---|
| **At-most-once** | pode perder | nunca | métricas, logs descartáveis |
| **At-least-once** | nunca | pode duplicar | quase tudo — é o padrão |
| **Exactly-once** | — | — | na prática: at-least-once + **idempotência** |

**Consumidor idempotente**: guarda os ids das mensagens já processadas e ignora repetidas — de preferência na **mesma transação** do efeito (a tabela *inbox*). Ou torna o próprio efeito idempotente: \`SET saldo = 50\` repete sem problema; \`saldo += 10\` não.

> [!sabia] O **exactly-once semantics** do Kafka (produtor idempotente + transações) é real, mas vale **dentro do Kafka**: ler de um tópico, processar e escrever em outro, atomicamente. Mandar um e-mail ou chamar uma API externa continua sendo at-least-once — o Kafka não consegue "desenviar" um e-mail. Por isso muita gente prefere o termo **effectively-once**.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Ordem! Um tópico do Kafka é dividido em **partições**, e a ordem só existe **dentro** de cada uma.',
        'O truque: a **chave** da mensagem escolhe a partição. Mesma chave, mesma partição, mesma ordem.',
      ],
      board: {
        title: 'Partições, chaves e consumer groups',
        md: `\`\`\`text
 partição = hash(chave) % n_particoes
 pedido-7: criado ─ pago ─ enviado     → sempre na partição 2 → consumidos NESSA ordem
 pedido-9: criado ─ cancelado          → partição 0            (sem ordem em relação ao pedido-7)

 consumer group "faturamento" (4 partições, 3 consumidores):
   c1 ← p0, p3      c2 ← p1      c3 ← p2          um 5º consumidor ficaria OCIOSO
\`\`\`

- **Consumer group**: cada partição é lida por **um** membro do grupo por vez — é isso que preserva a ordem. O paralelismo máximo é o **número de partições**.
- **Rebalance**: quando um consumidor entra ou sai, as partições são redistribuídas. Durante a troca, mensagens sem commit são reentregues ao novo dono — mais um motivo para ser idempotente.
- **Hash estável**: o \`hash()\` de \`str\` no Python muda a cada processo (*hash randomization*, \`PYTHONHASHSEED\`). Para particionar, use algo como \`zlib.crc32\` (o Kafka usa *murmur2*).

> [!atencao] **Mudar o número de partições** muda \`hash % n\`: a mesma chave passa a cair em outra partição, e eventos novos podem ser consumidos **antes** dos antigos daquela chave. Escolha o número de partições com folga desde o início. E cuidado com a **partição quente**: uma chave muito popular concentra carga num único consumidor.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora um vilão pouco conhecido: a **poison message**. Um evento com um campo malformado faz o consumidor lançar exceção… toda vez.',
        'Sem limite, ela é reentregue para sempre — e, num log, **trava a partição inteira** atrás dela.',
      ],
      board: {
        title: 'Poison messages e DLQ',
        md: `\`\`\`text
 partição 3:  | m40 | m41 ☠ | m42 | m43 | m44 | …     consumidor: m41 falha, falha, falha…
                        ▲ head-of-line blocking: m42, m43, m44 esperam para sempre

 com DLQ:    m41 falha 3× ─▶ DLQ (com o erro anotado) ─▶ alerta
             o consumidor segue para m42 ✓
\`\`\`

- **Erro transitório** (timeout, banco reiniciando): vale tentar de novo, com **backoff**.
- **Erro permanente** (JSON inválido, bug): tentar de novo não adianta — mande direto (ou após N tentativas) para a **dead letter queue**.
- DLQ **não é lixeira**: precisa de **alerta** (tamanho > 0), dono e um jeito de **reprocessar** depois da correção (*redrive*). No SQS, isso é a *redrive policy* com \`maxReceiveCount\`.

> [!sabia] Pular a poison message quebra a **ordem daquela chave**: se "pedido-7 pago" foi para a DLQ, "pedido-7 enviado" é processado sem o pagamento. Uma saída é **estacionar a chave** (*parking lot*): as próximas mensagens do pedido-7 também vão para a área de espera, e as outras chaves seguem. Outra é o consumidor checar a **versão** do agregado e recusar eventos fora de sequência.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Falta a ponta do produtor. Gravar no banco **e** publicar no broker são duas escritas em dois sistemas — o famoso *dual write*. Uma pode falhar sem a outra.',
        'A dupla que resolve: **outbox** no produtor e **inbox** no consumidor.',
      ],
      board: {
        title: 'Outbox e inbox: ponta a ponta',
        md: `\`\`\`text
 PRODUTOR                                          CONSUMIDOR
 BEGIN                                             recebe m (id = 81)
   INSERT pedido                                   BEGIN
   INSERT outbox (id=81, evento)                     INSERT inbox (id=81)  ← já existe? ignora
 COMMIT       ← atômico: os dois ou nenhum             aplica o efeito
 relay lê a outbox ─▶ publica ─▶ marca enviado     COMMIT
       (pode publicar 2× se cair no meio)          ack / commit do offset
\`\`\`

- **Outbox**: o evento vai para uma tabela **na mesma transação** do dado; um *relay* (ou CDC, como o Debezium) publica depois. Nunca perde — mas pode publicar **duas vezes**.
- **Inbox**: o consumidor registra o id da mensagem **na mesma transação** do efeito. Duplicata? A chave primária recusa e o efeito não se repete.
- Juntos: **at-least-once** no transporte + **deduplicação** no destino = efeito exatamente uma vez.

> [!dica] A tabela de ids processados não pode crescer para sempre: guarde por uma **janela** (ex.: 7 dias) maior que o maior atraso possível de uma reentrega. Duplicatas mais velhas que a janela passariam — dimensione com folga.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — com um consumidor idempotente e um tópico particionado com DLQ.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dist-msg-q1',
      concept: 'Garantias de entrega',
      say: 'Começando por um bug que já custou caro para muita empresa.',
      prompt: 'Um consumidor faz, para cada mensagem: `poll()` → `commit()` do offset → `enviar_nota_fiscal(msg)`. O processo é morto (deploy) logo depois de um `commit()`, antes de enviar a nota. O que acontece com aquela mensagem, e que garantia é essa?',
      options: [
        { text: 'A nota nunca é enviada: o offset já avançou. É **at-most-once**', correct: true, why: 'Ao reiniciar, o consumidor continua do offset commitado — depois da mensagem. Commit antes do efeito troca duplicatas por perdas.' },
        { text: 'A nota é enviada duas vezes: é **at-least-once**', why: 'Duplicaria se o commit viesse **depois** do envio e o processo caísse entre os dois. Aqui o commit veio antes: a mensagem é pulada.' },
        { text: 'Nada se perde: o Kafka reentrega mensagens de consumidores que morreram', why: 'O broker reentrega a partir do último offset **commitado**. Como o commit já tinha acontecido, para o broker aquela mensagem foi processada.' },
        { text: 'É **exactly-once**, porque cada mensagem foi commitada uma única vez', why: 'Commitar uma vez não significa processar uma vez. O efeito (a nota) aconteceu **zero** vezes.' },
      ],
      explanation: 'A garantia de entrega é decidida pela ordem entre **commit** e **efeito**. Commit antes = **at-most-once** (pode perder); commit depois = **at-least-once** (pode duplicar). Para nota fiscal, perder é inaceitável: use commit depois e torne o envio **idempotente** (id da nota como chave de deduplicação). Cuidado com o *auto-commit* de bibliotecas: ele pode commitar em segundo plano antes de você terminar de processar.',
    },
    {
      type: 'match',
      id: 'dist-msg-q2',
      concept: 'Mensageria',
      say: 'Um vocabulário que aparece em toda entrevista de sistemas orientados a eventos. Associe!',
      prompt: 'Associe cada **termo** ao que ele descreve.',
      pairs: [
        { left: 'Offset', right: 'Posição até onde um consumer group já leu uma partição' },
        { left: 'Consumer group', right: 'Consumidores que dividem as partições: cada uma com um só leitor por vez' },
        { left: 'Poison message', right: 'Mensagem que faz o consumidor falhar toda vez' },
        { left: 'Dead letter queue', right: 'Destino das mensagens que esgotaram as tentativas, para investigar depois' },
        { left: 'Outbox', right: 'Tabela gravada na mesma transação do dado, publicada depois por um relay' },
        { left: 'Inbox', right: 'Registro dos ids já processados, gravado na mesma transação do efeito' },
      ],
      explanation: '**Offset** e **consumer group** são a mecânica do log: cada grupo avança o seu offset, e cada partição tem um único leitor no grupo — daí a ordem. **Poison message** é o problema e a **DLQ**, o escape. **Outbox** e **inbox** fecham as duas pontas: o produtor nunca perde um evento, e o consumidor nunca aplica o mesmo evento duas vezes.',
    },
    {
      type: 'order',
      id: 'dist-msg-q3',
      concept: 'Outbox e inbox',
      say: 'Agora siga um evento de ponta a ponta, do banco do produtor ao efeito no consumidor.',
      prompt: 'Ordene o caminho de um evento com **outbox** no produtor e **inbox** no consumidor.',
      items: [
        'O serviço grava o pedido e a linha da outbox na **mesma transação**',
        'O relay lê a outbox e publica o evento no broker',
        'O relay marca a linha como enviada (se cair antes disso, o evento sai duplicado)',
        'O consumidor recebe o evento',
        'Numa transação, grava o id na inbox (ignorando se já existe) e aplica o efeito',
        'O consumidor faz o ack / commit do offset',
      ],
      explanation: 'Cada passo tolera falhas do anterior: a transação do produtor impede "gravou mas não publicou"; o relay pode publicar **duas vezes** (entre publicar e marcar), então o transporte é **at-least-once**; a inbox, na mesma transação do efeito, transforma a duplicata num no-op; e o commit do offset vem **por último** — se cair antes dele, a mensagem volta e a inbox a ignora.',
    },
    {
      type: 'code',
      id: 'dist-msg-q4',
      concept: 'Consumidor idempotente',
      title: 'Consumidor idempotente com janela de deduplicação',
      say: 'Mão na massa! O broker entrega pelo menos uma vez — às vezes duas, às vezes três. Seu consumidor precisa aplicar cada efeito uma vez só.',
      prompt: `Implemente \`ConsumidorIdempotente(handler, capacidade=1000)\`. Cada mensagem é um \`dict\` com um \`"id"\` único (e o conteúdo que for).

\`receber(msg)\`:
- Se o \`id\` já foi **processado com sucesso**, não chame o handler e devolva \`False\`.
- Senão, chame \`handler(msg)\`. Se o handler **lançar exceção**, deixe-a propagar e **não** registre o id — a mensagem será reentregue e precisa ser processada de novo.
- Se deu certo, registre o id e devolva \`True\`.

**Janela**: lembre no máximo \`capacidade\` ids. Ao passar do limite, esqueça o **mais antigo** (na ordem em que foi processado; receber uma duplicata **não** renova a posição dele).`,
      starter: `class ConsumidorIdempotente:
    def __init__(self, handler, capacidade=1000):
        self.handler = handler            # função que aplica o efeito da mensagem
        self.capacidade = capacidade      # quantos ids lembrar, no máximo
        # TODO: estruturas para lembrar os ids processados (e a ordem deles)

    def receber(self, msg):
        # TODO: duplicata -> False; senão handler(msg), registra o id -> True
        pass
`,
      tests: [
        {
          name: 'processa uma vez e ignora a duplicata',
          code: `efeitos = []
c = ConsumidorIdempotente(efeitos.append)
m = {"id": "m1", "valor": 10}
assert c.receber(m) is True
assert c.receber(m) is False, "a mesma mensagem de novo: duplicata"
assert c.receber({"id": "m1", "valor": 10}) is False
assert efeitos == [m], f"o handler deveria ter rodado uma vez: {efeitos}"`,
        },
        {
          name: 'at-least-once: reentregas não mudam o saldo',
          code: `saldo = [0]
def creditar(msg):
    saldo[0] += msg["valor"]
c = ConsumidorIdempotente(creditar)
entregas = ["a", "b", "a", "c", "b", "b", "a"]          # o broker reentregou algumas
valores = {"a": 10, "b": 25, "c": 5}
for i in entregas:
    c.receber({"id": i, "valor": valores[i]})
assert saldo[0] == 40, f"saldo deveria ser 10 + 25 + 5 = 40, é {saldo[0]}"`,
        },
        {
          name: 'falha no handler: não registra o id, e a reentrega processa',
          code: `tentativas = []
def instavel(msg):
    tentativas.append(msg["id"])
    if len(tentativas) == 1:
        raise TimeoutError("banco fora do ar")
c = ConsumidorIdempotente(instavel)
try:
    c.receber({"id": "x"})
    assert False, "a exceção do handler deve propagar (para o broker reentregar)"
except TimeoutError:
    pass
assert c.receber({"id": "x"}) is True, "a primeira tentativa falhou: a reentrega precisa processar"
assert c.receber({"id": "x"}) is False
assert tentativas == ["x", "x"]`,
        },
        {
          name: 'janela: com capacidade 2, o id mais antigo é esquecido',
          code: `efeitos = []
c = ConsumidorIdempotente(lambda m: efeitos.append(m["id"]), capacidade=2)
for i in ["m1", "m2", "m3"]:
    assert c.receber({"id": i}) is True
assert c.receber({"id": "m3"}) is False
assert c.receber({"id": "m2"}) is False
assert c.receber({"id": "m1"}) is True, "m1 saiu da janela: é processado de novo (por isso a janela precisa de folga)"
assert efeitos == ["m1", "m2", "m3", "m1"]`,
        },
        {
          name: 'duplicata não renova a posição na janela',
          hidden: true,
          code: `c = ConsumidorIdempotente(lambda m: None, capacidade=2)
assert c.receber({"id": 1}) is True
assert c.receber({"id": 2}) is True
assert c.receber({"id": 1}) is False
assert c.receber({"id": 3}) is True              # esquece o 1 (o mais antigo processado)
assert c.receber({"id": 2}) is False, "2 ainda está na janela"
assert c.receber({"id": 1}) is True, "1 foi o primeiro processado: saiu da janela"
assert c.receber({"id": 3}) is False`,
        },
        {
          name: 'deduplica pelo id, não pelo conteúdo',
          hidden: true,
          code: `efeitos = []
c = ConsumidorIdempotente(efeitos.append)
assert c.receber({"id": "p1", "valor": 10}) is True
assert c.receber({"id": "p2", "valor": 10}) is True, "conteúdo igual, id diferente: são duas mensagens"
assert len(efeitos) == 2`,
        },
        {
          name: 'janela longa: lembra exatamente os últimos N ids',
          hidden: true,
          code: `c = ConsumidorIdempotente(lambda m: None, capacidade=100)
for i in range(5000):
    assert c.receber({"id": i}) is True
assert c.receber({"id": 4900}) is False, "4900 está entre os 100 últimos"
assert c.receber({"id": 4999}) is False
assert c.receber({"id": 4899}) is True, "4899 já saiu da janela"`,
        },
        {
          name: 'cada consumidor tem a sua memória',
          hidden: true,
          code: `c1 = ConsumidorIdempotente(lambda m: None)
c2 = ConsumidorIdempotente(lambda m: None)
assert c1.receber({"id": "z"}) is True
assert c2.receber({"id": "z"}) is True, "os ids vazaram entre consumidores"`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Você captura exceções do handler. Não engula a falha: se o efeito não foi aplicado, a mensagem **não pode** ser confirmada — deixe a exceção subir para que o broker a reentregue (e, depois de N tentativas, a mande para a DLQ).',
          concept: 'At-least-once',
        },
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: 'Você usa `list.pop(0)`, que é **O(n)**: desloca a lista inteira a cada remoção. Para uma janela FIFO, use `collections.deque` com `popleft()` (O(1)) — ou um `dict`, que preserva a ordem de inserção.',
          concept: 'Estruturas de dados',
        },
        {
          when: m => m.usesGlobal || m.mutableDefaults > 0,
          text: 'Há estado compartilhado (`global` ou argumento padrão mutável). Os ids processados devem viver na instância: dois consumidores não podem dividir a mesma memória por acidente.',
          concept: 'Estado por instância',
        },
      ],
      hints: [
        'Use um `set` para responder "já vi este id?" em O(1) e uma `collections.deque` para lembrar a **ordem** em que os ids foram processados.',
        'Chame `self.handler(msg)` **antes** de registrar o id. Se ele lançar exceção, a função termina ali e o id nunca é registrado — sem `try` nenhum.',
        'Depois de registrar, `if len(self._ordem) > self.capacidade: self._vistos.discard(self._ordem.popleft())`. Duplicatas saem cedo com `return False` e não mexem na deque.',
      ],
      solution: `from collections import deque


class ConsumidorIdempotente:
    def __init__(self, handler, capacidade=1000):
        self.handler = handler            # função que aplica o efeito da mensagem
        self.capacidade = capacidade      # quantos ids lembrar, no máximo
        self._vistos = set()              # "já processei?" em O(1)
        self._ordem = deque()             # ordem de processamento, para esquecer o mais antigo

    def receber(self, msg):
        msg_id = msg["id"]
        if msg_id in self._vistos:
            return False                  # duplicata: o efeito já foi aplicado
        self.handler(msg)                 # se falhar, a exceção sobe e o id NÃO é registrado
        self._vistos.add(msg_id)
        self._ordem.append(msg_id)
        if len(self._ordem) > self.capacidade:
            self._vistos.discard(self._ordem.popleft())
        return True
`,
      solutionExplanation: 'A ordem das linhas é a garantia: o id só é registrado **depois** que o handler terminou. Se o handler falha, a exceção sobe, nada é registrado e a reentrega do broker processa de novo — at-least-once sem perda. Se o handler deu certo, duplicatas futuras batem no `set` e viram no-op. O `set` responde em O(1) e a `deque` guarda a ordem para esquecer o mais antigo, limitando a memória. O teste da janela mostra o preço: uma duplicata que chega depois de o id sair da janela é processada de novo — por isso a janela deve ser maior que o maior atraso de reentrega. Em produção, o registro do id e o efeito vão na **mesma transação** (a inbox); aqui, se o processo caísse entre o handler e o registro, o efeito se repetiria.',
    },
    {
      type: 'code',
      id: 'dist-msg-q5',
      concept: 'Ordem por partição',
      title: 'Tópico particionado com DLQ',
      say: 'Agora monte um mini-Kafka: chaves escolhem partições, a ordem por chave é sagrada, e a poison message não pode travar ninguém.',
      prompt: `Implemente:

- \`particao_de(chave, n_particoes)\` — \`zlib.crc32(chave.encode()) % n_particoes\` (estável entre processos, ao contrário de \`hash()\`).
- \`distribuir(n_particoes, consumidores)\` — atribui as partições a um consumer group em rodízio: a partição \`p\` vai para \`consumidores[p % len(consumidores)]\`. Devolve \`{consumidor: [partições]}\` com **todos** os consumidores (os ociosos com \`[]\`).
- \`Topico(n_particoes, max_tentativas=3)\` com \`self.particoes\` (lista de listas de \`(chave, valor)\`), \`self.offsets\` (um por partição, começando em 0) e \`self.dlq\` (lista).
  - \`publicar(chave, valor)\`: anexa \`(chave, valor)\` à partição da chave e devolve o índice da partição.
  - \`consumir(particao, handler)\`: processa, **em ordem**, as mensagens da partição a partir do offset atual, chamando \`handler(chave, valor)\`. Se o handler lançar exceção, tente de novo **imediatamente**, até \`max_tentativas\` chamadas no total. Esgotou? Anexe \`(chave, valor, str(ultimo_erro))\` à \`self.dlq\` e siga para a próxima. Depois de cada mensagem (sucesso ou DLQ), avance o offset. Devolva quantas mensagens foram processadas **com sucesso** nesta chamada.`,
      starter: `import zlib


def particao_de(chave, n_particoes):
    # TODO: hash estável da chave (zlib.crc32), módulo n_particoes
    pass


def distribuir(n_particoes, consumidores):
    # TODO: partição p -> consumidores[p % len(consumidores)]
    pass


class Topico:
    def __init__(self, n_particoes, max_tentativas=3):
        self.particoes = [[] for _ in range(n_particoes)]   # cada uma: lista de (chave, valor)
        self.offsets = [0] * n_particoes                     # próximo índice a consumir
        self.max_tentativas = max_tentativas
        self.dlq = []                                        # (chave, valor, erro)

    def publicar(self, chave, valor):
        # TODO: anexar à partição da chave; devolver o índice
        pass

    def consumir(self, particao, handler):
        # TODO: em ordem, a partir do offset; retries; DLQ; avançar offset
        pass
`,
      tests: [
        {
          name: 'particao_de é estável e fica no intervalo',
          code: `import zlib
assert particao_de("pedido-42", 8) == zlib.crc32(b"pedido-42") % 8
for chave in ["a", "b", "pedido-7", "cliente-99", ""]:
    p = particao_de(chave, 5)
    assert 0 <= p < 5 and p == particao_de(chave, 5)`,
        },
        {
          name: 'mesma chave, mesma partição',
          code: `t = Topico(4)
ps = {t.publicar("pedido-7", evento) for evento in ["criado", "pago", "enviado"]}
assert len(ps) == 1, f"a mesma chave caiu em partições diferentes: {ps}"
p = ps.pop()
assert p == particao_de("pedido-7", 4)
assert t.particoes[p] == [("pedido-7", "criado"), ("pedido-7", "pago"), ("pedido-7", "enviado")]`,
        },
        {
          name: 'a ordem por chave é preservada no consumo',
          code: `t = Topico(3)
publicados = {}
for i in range(30):
    chave = f"conta-{i % 7}"
    t.publicar(chave, i)
    publicados.setdefault(chave, []).append(i)
vistos = {}
for p in [2, 0, 1]:                        # a ordem ENTRE partições não importa
    t.consumir(p, lambda chave, valor: vistos.setdefault(chave, []).append(valor))
assert vistos == publicados, f"ordem por chave quebrada: {vistos}"`,
        },
        {
          name: 'o offset avança: nada é reprocessado',
          code: `t = Topico(1)
t.publicar("k", 1)
t.publicar("k", 2)
vistos = []
assert t.consumir(0, lambda k, v: vistos.append(v)) == 2
assert t.consumir(0, lambda k, v: vistos.append(v)) == 0, "já consumidas: nada a fazer"
t.publicar("k", 3)
assert t.consumir(0, lambda k, v: vistos.append(v)) == 1
assert vistos == [1, 2, 3] and t.offsets == [3]`,
        },
        {
          name: 'falha transitória: tenta de novo e processa',
          code: `t = Topico(1, max_tentativas=3)
t.publicar("k", "v")
chamadas = []
def instavel(k, v):
    chamadas.append(v)
    if len(chamadas) < 3:
        raise ConnectionError("timeout")
assert t.consumir(0, instavel) == 1
assert len(chamadas) == 3 and t.dlq == []`,
        },
        {
          name: 'poison message vai para a DLQ e não trava a partição',
          code: `t = Topico(1, max_tentativas=3)
for v in ["ok-1", "veneno", "ok-2"]:
    t.publicar("k", v)
chamadas = []
def handler(k, v):
    chamadas.append(v)
    if v == "veneno":
        raise ValueError("json inválido")
assert t.consumir(0, handler) == 2, "2 mensagens processadas com sucesso"
assert chamadas == ["ok-1", "veneno", "veneno", "veneno", "ok-2"], f"chamadas: {chamadas}"
assert t.dlq == [("k", "veneno", "json inválido")], f"dlq: {t.dlq}"
assert t.offsets == [3]`,
        },
        {
          name: 'consumer group: rodízio e consumidores ociosos',
          code: `assert distribuir(6, ["c1", "c2", "c3"]) == {"c1": [0, 3], "c2": [1, 4], "c3": [2, 5]}
g = distribuir(2, ["a", "b", "c", "d"])
assert g == {"a": [0], "b": [1], "c": [], "d": []}, f"mais consumidores que partições: sobram ociosos — {g}"`,
        },
        {
          name: 'max_tentativas = 1: falhou, DLQ',
          hidden: true,
          code: `t = Topico(2, max_tentativas=1)
p = t.publicar("x", 1)
chamadas = []
def sempre_falha(k, v):
    chamadas.append(v)
    raise RuntimeError("bug")
assert t.consumir(p, sempre_falha) == 0
assert chamadas == [1] and t.dlq == [("x", 1, "bug")]
assert t.consumir(p, sempre_falha) == 0 and chamadas == [1], "a mensagem da DLQ não volta a ser consumida"`,
        },
        {
          name: 'guarda o ÚLTIMO erro e não mexe em outras partições',
          hidden: true,
          code: `t = Topico(4, max_tentativas=3)
chaves = ["pedido-1", "pedido-2", "pedido-3", "pedido-4", "pedido-5", "pedido-6"]
for c in chaves:
    t.publicar(c, c.upper())
alvo = t.publicar("pedido-1", "extra")
tentativa = [0]
def handler(k, v):
    if k == "pedido-1":
        tentativa[0] += 1
        raise ValueError(f"tentativa {tentativa[0]}")
t.consumir(alvo, handler)
assert t.dlq[0] == ("pedido-1", "PEDIDO-1", "tentativa 3"), f"dlq: {t.dlq}"
for p in range(4):
    if p != alvo:
        assert t.offsets[p] == 0, "consumir uma partição não pode avançar as outras"
assert t.offsets[alvo] == len(t.particoes[alvo])`,
        },
        {
          name: 'um grupo, várias partições: cada consumidor processa só as suas',
          hidden: true,
          code: `t = Topico(4)
for i in range(40):
    t.publicar(f"u{i}", i)
grupo = distribuir(4, ["c1", "c2"])
processado_por = {}
for consumidor, particoes in grupo.items():
    for p in particoes:
        t.consumir(p, lambda k, v, c=consumidor: processado_por.__setitem__(v, c))
assert sorted(processado_por) == list(range(40)), "toda mensagem deve ser processada exatamente uma vez"
assert all(processado_por[v] == ("c1" if particao_de(f"u{v}", 4) % 2 == 0 else "c2") for v in range(40))
t2 = Topico(4)
assert t2.dlq == [] and t2.offsets == [0, 0, 0, 0], "o estado vazou entre tópicos"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('hash'),
          text: 'Você usou `hash()`. O hash de `str` no Python é **aleatorizado por processo** (`PYTHONHASHSEED`): o produtor e o consumidor — ou o mesmo serviço depois de um restart — mandariam a mesma chave para partições diferentes. Use um hash estável, como `zlib.crc32`.',
          concept: 'Ordem por partição',
        },
        {
          when: m => m.bareExcepts > 0,
          text: 'Um `except:` sem tipo também captura `KeyboardInterrupt` e `SystemExit` — o consumidor não conseguiria nem ser desligado. Use `except Exception as erro:`.',
          concept: 'Tratamento de falhas',
        },
        {
          when: m => m.imports.includes('random') || m.imports.includes('time'),
          text: 'Você importou `random`/`time`. O roteamento precisa ser **determinístico** (a mesma chave sempre na mesma partição), e esperar entre tentativas com `time.sleep` travaria o teste — em produção, o backoff seria injetado ou feito pelo broker.',
          concept: 'Ordem por partição',
        },
      ],
      hints: [
        '`particao_de` é uma linha: `return zlib.crc32(chave.encode()) % n_particoes`. Em `distribuir`, comece com `{c: [] for c in consumidores}` e percorra `range(n_particoes)`.',
        'Em `consumir`, use `while self.offsets[particao] < len(self.particoes[particao]):` e leia a mensagem no índice do offset. Para as tentativas, um `for tentativa in range(self.max_tentativas):` com `try/except Exception as erro:` e `break` no sucesso.',
        'O `for ... else` do Python ajuda: o `else` só roda se o laço **não** saiu por `break` — ou seja, se todas as tentativas falharam. Ali vai o `self.dlq.append((chave, valor, str(ultimo_erro)))`. Avance o offset fora do `for`, nos dois casos.',
      ],
      solution: `import zlib


def particao_de(chave, n_particoes):
    return zlib.crc32(chave.encode()) % n_particoes


def distribuir(n_particoes, consumidores):
    atribuicao = {c: [] for c in consumidores}
    for p in range(n_particoes):
        atribuicao[consumidores[p % len(consumidores)]].append(p)
    return atribuicao


class Topico:
    def __init__(self, n_particoes, max_tentativas=3):
        self.particoes = [[] for _ in range(n_particoes)]   # cada uma: lista de (chave, valor)
        self.offsets = [0] * n_particoes                     # próximo índice a consumir
        self.max_tentativas = max_tentativas
        self.dlq = []                                        # (chave, valor, erro)

    def publicar(self, chave, valor):
        p = particao_de(chave, len(self.particoes))
        self.particoes[p].append((chave, valor))
        return p

    def consumir(self, particao, handler):
        mensagens = self.particoes[particao]
        sucesso = 0
        while self.offsets[particao] < len(mensagens):
            chave, valor = mensagens[self.offsets[particao]]
            ultimo_erro = None
            for _ in range(self.max_tentativas):
                try:
                    handler(chave, valor)
                    sucesso += 1
                    break
                except Exception as erro:
                    ultimo_erro = erro
            else:                                            # esgotou as tentativas
                self.dlq.append((chave, valor, str(ultimo_erro)))
            self.offsets[particao] += 1                      # sucesso ou DLQ: segue em frente
        return sucesso
`,
      solutionExplanation: 'A ordem por chave nasce no produtor: `particao_de` usa um hash **estável**, então todos os eventos de uma chave vão para a mesma partição, e `consumir` os processa em sequência a partir do offset. O `distribuir` mostra por que o paralelismo de um consumer group é limitado pelas partições: com mais consumidores que partições, os excedentes ficam ociosos. No consumo, erros transitórios ganham novas tentativas; se todas falham, a mensagem vai para a **DLQ** com o último erro e o offset avança mesmo assim — a poison message não trava a partição. Repare no trade-off que a aula mostrou: ao pular a mensagem, as próximas **da mesma chave** são processadas sem ela; em produção, você estacionaria a chave ou validaria a versão do agregado.',
    },
    {
      type: 'open',
      id: 'dist-msg-q6',
      concept: 'Poison message',
      say: 'Para fechar, um incidente de madrugada. Como você conduziria?',
      prompt: 'O tópico `pagamentos` é particionado por `conta_id`. Um evento com um campo malformado faz o consumidor lançar exceção; ele tenta de novo sem parar e a **partição inteira parou** — milhares de contas sem processar. Um colega sugere: "é só dar `except`, logar e seguir em frente". O que está acontecendo, e como você trataria o problema?',
      minWords: 30,
      rubric: [
        { label: 'Diagnostica a **poison message** travando a partição (head-of-line blocking)', keywords: ['poison', 'envenen', 'head-of-line', 'head of line', 'hol', 'bloque', 'trav', 'parou', 'parad', 'para sempre', 'infinit', 'loop', 'reentreg'], concept: 'Poison message', why: 'A mensagem falha sempre; sem limite de tentativas, ela volta para a cabeça da partição e segura todas as de trás.' },
        { label: 'Limita as tentativas e manda para a **DLQ** (distinguindo erro transitório de permanente)', keywords: ['dlq', 'dead letter', 'dead-letter', 'fila de mensagens mortas', 'fila morta', 'tentativas', 'limite', 'max_tentativas', 'maxreceivecount', 'backoff', 'transit', 'permanent'], concept: 'Dead letter queue', why: 'Erros transitórios merecem retry com backoff; permanentes vão para a DLQ depois de N tentativas, destravando a partição.' },
        { label: 'Não perde em silêncio: **alerta**/monitora a DLQ e **reprocessa** depois da correção', keywords: ['alert', 'monitor', 'reprocess', 'redrive', 'replay', 'reenvi', 'reinjet', 'investig', 'dashboard', 'silenc', 'perder', 'perda', 'corrig'], concept: 'Dead letter queue', why: '"Logar e seguir" vira perda silenciosa de um pagamento. A DLQ guarda a mensagem, dispara alerta e permite o redrive depois do fix.' },
        { label: 'Aponta o risco à **ordem daquela conta** e como mitigar (estacionar a chave, checar versão, idempotência)', keywords: ['ordem', 'mesma chave', 'mesma conta', 'conta_id', 'estacion', 'parking', 'versao', 'sequencia', 'fora de ordem', 'idempot'], concept: 'Ordem por partição', why: 'Pular o evento faz os próximos da mesma conta serem aplicados sem ele; estacionar a chave ou validar a versão protege a consistência daquela conta.' },
      ],
      modelAnswer: `É uma **poison message**: o evento malformado falha toda vez, é reentregue para sempre e, como a ordem é por partição, **trava** todas as mensagens atrás dele (head-of-line blocking) — as outras contas daquela partição param.

"Dar except e seguir" destrava, mas vira **perda silenciosa** de um pagamento. Eu limitaria as **tentativas**: erros transitórios (timeout, banco reiniciando) ganham retry com **backoff**; depois de N falhas — ou na hora, se o erro é permanente, como um campo inválido — a mensagem vai para a **DLQ** com o erro anotado. A DLQ precisa de **alerta** e de um dono: corrigido o bug (ou o dado), fazemos o **redrive** e reprocessamos.

Por fim, a **ordem daquela conta**: se pularmos o evento, os próximos da mesma \`conta_id\` seriam aplicados sem ele. Para evitar isso, eu **estacionaria a chave** (parking lot: os próximos eventos dessa conta também esperam) ou faria o consumidor checar a **versão** do agregado e recusar eventos fora de sequência — e manteria o consumidor **idempotente** para o reprocessamento ser seguro.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Recapitulando: **log** guarda e deixa reler; o momento do **commit** decide entre perder e duplicar; e "exactly-once" é **at-least-once + idempotência**.',
        'Ordem só por **partição** (escolhida pela chave), poison messages vão para a **DLQ** com alerta, e outbox + inbox fecham as duas pontas. Você está pronta(o) para a entrevista de distribuídos!',
      ],
      board: null,
    },
  ],
});
