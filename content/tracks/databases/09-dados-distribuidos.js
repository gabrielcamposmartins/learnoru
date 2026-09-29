(function () {
  // Esquemas compartilhados pelo starter e pela solução da questão de outbox.
  const SCHEMAS = `import json
import sqlite3

SCHEMA_LOJA = """
CREATE TABLE pedidos (
  id      INTEGER PRIMARY KEY,
  cliente TEXT NOT NULL,
  total   REAL NOT NULL CHECK (total > 0)
);
CREATE TABLE outbox (
  id        INTEGER PRIMARY KEY,         -- ordem de gravação
  evento_id TEXT NOT NULL UNIQUE,
  tipo      TEXT NOT NULL,
  payload   TEXT NOT NULL,               -- JSON
  publicado INTEGER NOT NULL DEFAULT 0   -- 0 = pendente, 1 = publicado
);
"""

SCHEMA_CONSUMIDOR = """
CREATE TABLE processados (evento_id TEXT PRIMARY KEY);
CREATE TABLE totais (
  cliente TEXT PRIMARY KEY,
  pedidos INTEGER NOT NULL,
  valor   REAL NOT NULL
);
"""


def novo_banco(schema):
    conn = sqlite3.connect(":memory:")
    conn.executescript(schema)
    return conn
`;

  Game.registerModule('databases', {
    id: 'dados-distribuidos',
    title: 'Dual write, outbox e CDC',
    kind: 'lesson',
    level: 3,
    order: 32,
    unit: 'escala',
    summary: 'Gravar no banco e publicar um evento parece simples — até o processo cair no meio. Dual write, transactional outbox, CDC e consumidores idempotentes.',
    concepts: ['Dual write', 'Transactional outbox', 'CDC', 'At-least-once', 'Consumidor idempotente'],
    takeaways: [
      '**Dual write** — gravar o mesmo fato em dois sistemas (banco + broker, cache, índice de busca) em passos separados — não tem atomicidade: uma queda no meio ou uma corrida deixa os sistemas divergentes, sem erro nenhum.',
      '**Transactional outbox**: grave o evento numa tabela `outbox` **na mesma transação** do dado; um *relay* publica depois. O ACID local garante que os dois existem juntos — ou nenhum.',
      'O relay publica **pelo menos uma vez** (*at-least-once*): se cair entre publicar e marcar como publicado, o evento sai de novo. Duplicata é normal; perda, não.',
      '**CDC** lê o log do banco (WAL/binlog) e transforma commits em eventos, sem polling; cuidado com o *replication slot* parado, que segura o WAL e enche o disco.',
      '**Consumidor idempotente**: registre o `evento_id` processado **na mesma transação** do efeito e ignore os repetidos; se o efeito falhar, deixe a exceção subir.',
    ],
    glossary: [
      {
        term: 'Dual write',
        aliases: ['dual writes', 'escrita dupla', 'escritas duplas'],
        definition: 'Antipadrão em que a aplicação grava o mesmo fato em dois sistemas (banco + broker, banco + cache, banco + índice de busca) em passos separados. Sem uma transação que cubra os dois, uma falha no meio ou uma corrida os deixa inconsistentes.',
      },
      {
        term: 'Transactional outbox',
        aliases: ['outbox', 'padrão outbox', 'outbox pattern', 'tabela outbox'],
        definition: 'Padrão em que o evento é gravado numa tabela `outbox` **na mesma transação** da mudança de negócio; um processo separado (*relay*) lê a tabela e publica no broker. Garante que dado e evento existem juntos — ou nenhum dos dois.',
      },
      {
        term: 'CDC',
        aliases: ['change data capture', 'captura de dados de mudança', 'captura de mudanças'],
        definition: '*Change Data Capture*: ler o log de replicação do banco (WAL do PostgreSQL, binlog do MySQL) e transformar cada commit num evento de mudança. Ferramentas: Debezium, AWS DMS, DynamoDB Streams.',
      },
      {
        term: 'Message relay',
        aliases: ['relay', 'relays', 'polling publisher', 'transaction log tailing'],
        definition: 'Processo que lê os eventos pendentes da outbox — por *polling* ou lendo o log do banco (CDC) —, publica no broker e marca como publicados. Publica **pelo menos uma vez**: pode repetir eventos, nunca perdê-los.',
      },
      {
        term: 'Consumidor idempotente',
        aliases: ['consumidores idempotentes', 'idempotent consumer', 'idempotent consumers'],
        definition: 'Consumidor que pode receber a mesma mensagem várias vezes sem repetir o efeito: registra o id de cada mensagem processada, na mesma transação do efeito, e ignora as repetidas.',
      },
      {
        term: 'Inbox',
        aliases: ['inbox pattern', 'tabela inbox', 'padrão inbox'],
        definition: 'Contraparte do outbox no lado do consumidor: uma tabela com os ids das mensagens já processadas, gravada na mesma transação do efeito. É o que torna o consumidor idempotente.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Um pedido foi criado. O banco precisa guardá-lo **e** o resto do mundo precisa saber: estoque, e-mail, nota fiscal. O código óbvio é gravar e depois publicar um evento.',
          'Parece inofensivo. Agora imagine o processo morrendo **entre** as duas linhas.',
        ],
        board: {
          title: 'O problema: gravar e avisar',
          md: `\`\`\`python
def criar_pedido(conn, broker, cliente, total):
    with conn:
        conn.execute("INSERT INTO pedidos (cliente, total) VALUES (?, ?)", (cliente, total))
    broker.publish("PedidoCriado", {"cliente": cliente, "total": total})  # e se o processo morrer AQUI?
\`\`\`

| O que dá errado | Consequência |
|---|---|
| o processo cai entre o commit e o \`publish\` | o pedido existe, mas ninguém fica sabendo: sem e-mail, sem baixa de estoque, sem nota fiscal |
| o broker está fora do ar | desfazer o pedido? tentar de novo quantas vezes? guardar a mensagem onde? |
| o \`publish\` dá timeout | publicou ou não? Tentar de novo pode **duplicar** |
| publicar **antes** do commit | se o commit falhar, o mundo reage a um pedido que não existe |

> [!dica] Nenhuma ordem resolve: são **dois sistemas** e não existe uma transação que abrace os dois. Toda solução robusta começa por aceitar isso.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Esse padrão tem nome: **dual write**. E ele não quebra só com quedas — quebra também com **corridas**, sem erro nenhum no log.',
          'Duas requisições concorrentes podem chegar aos dois sistemas em ordens diferentes, e eles divergem para sempre.',
        ],
        board: {
          title: 'Dual write: a corrida silenciosa',
          md: `\`\`\`text
Cliente A: preço = 10            Cliente B: preço = 12
banco:   ──A(10)──────B(12)──▶   banco  = 12
índice:  ──────B(12)──A(10)──▶   índice = 10    divergiram, e ninguém recebeu erro
\`\`\`

Onde o dual write aparece:
- banco + **broker** (Kafka, RabbitMQ, SQS);
- banco + **cache** ("gravo no banco e atualizo o Redis");
- banco + **índice de busca** (Elasticsearch);
- banco + **API** de outro serviço, ou + arquivo no S3.

**E transação distribuída (2PC/XA)?** Resolveria no papel, mas a maioria dos brokers não participa de XA (o Kafka não participa), o protocolo **bloqueia** se o coordenador cair no meio e amarra a disponibilidade de um sistema à do outro. Na prática, quase ninguém usa.

> [!sabia] O nome **dual write** foi popularizado por Martin Kleppmann (autor de *Designing Data-Intensive Applications*): o problema não é um bug no seu código, é **estrutural** — sempre existe uma janela em que um sistema recebeu a escrita e o outro não. As saídas conhecidas fazem **um único** sistema ser a fonte da verdade e derivam o resto dele: o outbox, o CDC e o pouco conhecido ***listen to yourself***, em que o serviço só publica o evento e ele mesmo o consome para atualizar o próprio banco.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'A saída mais popular é elegante: se o banco é transacional, grave o **evento** no próprio banco, na **mesma transação** do pedido.',
          'Esse é o **transactional outbox**. Depois, um processo separado — o *relay* — lê essa tabela e publica no broker.',
        ],
        board: {
          title: 'Transactional outbox',
          md: `\`\`\`sql
CREATE TABLE outbox (
  id        INTEGER PRIMARY KEY,     -- ordem de gravação
  evento_id TEXT NOT NULL UNIQUE,    -- viaja com a mensagem (deduplicação)
  tipo      TEXT NOT NULL,           -- ex.: 'PedidoCriado'
  payload   TEXT NOT NULL,           -- JSON: o contrato do evento
  publicado INTEGER NOT NULL DEFAULT 0
);
\`\`\`
\`\`\`python
with conn:  # UMA transação: os dois ou nenhum
    cur = conn.execute("INSERT INTO pedidos (cliente, total) VALUES (?, ?)", (cliente, total))
    conn.execute("INSERT INTO outbox (evento_id, tipo, payload) VALUES (?, ?, ?)",
                 (f"pedido-{cur.lastrowid}-criado", "PedidoCriado", json.dumps(dados)))
\`\`\`
\`\`\`text
app ──(1 transação)──▶ [ pedidos + outbox ] ──relay──▶ broker ──▶ estoque, e-mail, nota fiscal
\`\`\`

| Ganha | Paga |
|---|---|
| atomicidade de verdade: evento sem pedido (ou pedido sem evento) é impossível | uma tabela a mais e um processo a mais para operar |
| broker fora do ar não derruba a venda: o evento espera na tabela | atraso extra (o intervalo do relay) |
| ordem natural pela coluna \`id\` | limpeza: apague ou arquive os eventos já publicados |`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o relay. Ele tem o mesmo problema de duas etapas: **publicar** e depois **marcar** como publicado.',
          'Se ele cair entre as duas, o evento sai **de novo** na próxima rodada. E não há como evitar isso do lado de quem publica.',
        ],
        board: {
          title: 'O relay e o at-least-once',
          md: `\`\`\`python
def relay(conn, publicar):
    pendentes = conn.execute(
        "SELECT id, evento_id, tipo, payload FROM outbox WHERE publicado = 0 ORDER BY id").fetchall()
    for id_, evento_id, tipo, payload in pendentes:
        publicar(evento_id, tipo, json.loads(payload))   # 1) publica
        # 💥 se cair aqui, o evento é publicado de novo na próxima rodada
        with conn:
            conn.execute("UPDATE outbox SET publicado = 1 WHERE id = ?", (id_,))   # 2) marca
\`\`\`

| Garantia de entrega | O que significa | Quem oferece |
|---|---|---|
| *at-most-once* | pode perder, nunca repete | "publica e esquece" |
| **at-least-once** | nunca perde, pode repetir | outbox + relay com retry |
| *exactly-once* | nem perde nem repete | só **dentro** de um sistema; de ponta a ponta, vira at-least-once + deduplicação |

- **Ordem**: se publicar falhar, **pare** ali. Pular o evento com erro e seguir publicaria o 3º antes do 2º.
- **Vários relays** em paralelo? Divida o trabalho com \`SELECT ... FOR UPDATE SKIP LOCKED\` e mantenha a ordem **por agregado** (ex.: particione por \`pedido_id\`).
- O \`evento_id\` viaja com a mensagem: é ele que o consumidor usa para reconhecer repetições.`,
        },
      },
      {
        type: 'say',
        text: [
          'Existe outro jeito de alimentar o broker: em vez de consultar a tabela de tempos em tempos, **ler o log do próprio banco**. Isso é **CDC**, *Change Data Capture*.',
          'O banco já escreve cada commit no WAL para replicar. O CDC se comporta como uma réplica e transforma esse log em eventos.',
        ],
        board: {
          title: 'CDC: lendo o log do banco',
          md: `\`\`\`text
app ──INSERT/UPDATE──▶ PostgreSQL ──WAL (replication slot)──▶ Debezium ──▶ Kafka ──▶ consumidores
\`\`\`

| | Polling da outbox | CDC (log tailing) |
|---|---|---|
| Latência | o intervalo do polling | quase tempo real |
| Carga no banco | consultas repetidas na outbox | lê o log, que já existe |
| Complexidade | só SQL | Kafka Connect/Debezium, permissões de replicação |
| Ordem | pela coluna \`id\` | a ordem dos commits |

- CDC **direto nas tabelas** transforma o seu schema interno num contrato público: renomear uma coluna quebra os consumidores. A combinação mais usada é **outbox + CDC**: o Debezium lê só os INSERTs da outbox (o *Outbox Event Router*) e publica eventos com contrato explícito.
- Com CDC, a linha da outbox pode ser apagada logo depois de inserida: o evento já está no log.

> [!atencao] No PostgreSQL, o CDC usa um **replication slot**, que impede o descarte do WAL ainda não lido. Conector parado = WAL acumulando = **disco do banco cheio**. Monitore o atraso do slot e limite o estrago com \`max_slot_wal_keep_size\` (PostgreSQL 13+).`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Se a entrega é *at-least-once*, a responsabilidade final é do **consumidor**: ele precisa aguentar a mesma mensagem duas, três, dez vezes.',
          'O truque: registrar o `evento_id` processado **na mesma transação** do efeito. Repetiu? A chave primária barra, e o efeito não acontece de novo.',
        ],
        board: {
          title: 'Consumidor idempotente (inbox)',
          md: `\`\`\`python
def consumir(conn, evento_id, tipo, payload):
    with conn:   # deduplicação + efeito: uma transação só
        cur = conn.execute("INSERT OR IGNORE INTO processados (evento_id) VALUES (?)", (evento_id,))
        if cur.rowcount == 0:
            return False            # repetido: só confirma o recebimento (ack)
        conn.execute("UPDATE estoque SET reservado = reservado + ? WHERE sku = ?",
                     (payload["qtd"], payload["sku"]))
    return True
\`\`\`

| Efeito | Idempotente por natureza? |
|---|---|
| \`UPDATE pedidos SET status = 'pago' WHERE id = ?\` | ✅ repetir não muda nada |
| \`UPDATE contas SET saldo = saldo + 10\` | ❌ cada repetição soma de novo |
| enviar e-mail, chamar API externa | ❌ — deduplique antes, ou use a *Idempotency-Key* da API |

- Se o efeito **falhar**, deixe a exceção subir: o registro em \`processados\` é desfeito junto, e o broker reentrega. Engolir o erro e dar *ack* = mensagem perdida.
- Eventos fora de ordem? Guarde a **versão** do agregado e ignore eventos mais velhos que o estado atual.

> [!sabia] O famoso *exactly-once* do Kafka (transações e produtor idempotente, desde 2017) vale para o ciclo **ler do Kafka → processar → gravar no Kafka**. Assim que o efeito sai do Kafka — um banco, um e-mail, uma API —, você volta ao mundo do *at-least-once* e precisa de deduplicação. Por isso muita gente prefere o termo ***effectively-once***.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Dual write, o fluxo do outbox, um pipeline outbox + relay + consumidor em sqlite3 e CDC.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'db-dist-q1',
        concept: 'Dual write',
        say: 'Primeira: um colega acha que resolveu o problema. Resolveu?',
        prompt: `Para não perder eventos, um colega propôs publicar **dentro** da transação:

\`\`\`python
with conn:
    conn.execute("INSERT INTO pedidos (cliente, total) VALUES (?, ?)", (cliente, total))
    broker.publish("PedidoCriado", {"cliente": cliente, "total": total})  # se falhar, o with faz rollback
\`\`\`

Qual é o problema dessa versão?`,
        options: [
          { text: 'Continua sendo **dual write**: se o `publish` der certo e o commit falhar (constraint, disco cheio, queda do processo), o mundo recebe um evento de um pedido que **não existe** — e a transação fica aberta esperando a rede.', correct: true, why: 'O rollback cobre só uma direção. O broker não participa da transação do banco: a mensagem publicada não "des-publica" quando o commit falha. E segurar a transação durante uma chamada de rede prende locks e conexões.' },
          { text: 'Nenhum: o `with conn:` desfaz tudo se o `publish` falhar, então banco e broker ficam sempre iguais.', why: 'Cobre só o caso "publish falhou". O caso "publish deu certo, commit falhou" continua aberto, e o broker não tem como desfazer a mensagem.' },
          { text: 'Só desempenho: basta publicar de forma assíncrona, numa thread, e está resolvido.', why: 'Piora: o processo pode morrer com a mensagem ainda em memória, e a ordem entre os eventos deixa de ser garantida. Continuam sendo dois sistemas sem commit atômico.' },
          { text: 'O problema é o broker: com um broker que tenha *exactly-once*, essa versão fica correta.', why: 'O *exactly-once* do Kafka vale dentro do Kafka. Ele não faz o commit do banco e a publicação acontecerem atomicamente.' },
        ],
        explanation: 'Qualquer combinação de "grava no banco" + "publica no broker" em passos separados é dual write, não importa a ordem nem o `try/except`. A saída é ter **um** sistema como fonte da verdade: gravar o evento na outbox, na mesma transação local, e deixar um relay (ou o CDC) levá-lo ao broker, com entrega *at-least-once* e consumidores idempotentes.',
      },
      {
        type: 'order',
        id: 'db-dist-q2',
        concept: 'Transactional outbox',
        say: 'Coloque em ordem a jornada de um evento pelo outbox, do pedido até o consumidor.',
        prompt: 'Ordene os passos do fluxo **transactional outbox**, do primeiro ao último.',
        items: [
          'A aplicação abre uma transação no banco',
          'Grava o pedido e, na tabela outbox, o evento PedidoCriado',
          'Commit: pedido e evento passam a existir juntos — ou nenhum dos dois',
          'O relay lê os eventos pendentes da outbox, em ordem de id',
          'O relay publica no broker e marca o evento como publicado',
          'O consumidor confere o evento_id na tabela de processados e aplica o efeito',
        ],
        explanation: 'Os três primeiros passos são **uma** transação local — é daí que vem a atomicidade. Os três últimos são assíncronos e tolerantes a falha: se o relay cair entre publicar e marcar, o evento sai de novo (*at-least-once*), e é o `evento_id` conferido pelo consumidor que impede o efeito duplicado.',
      },
      {
        type: 'code',
        id: 'db-dist-q3',
        concept: 'Transactional outbox',
        title: 'Outbox + relay + consumidor idempotente',
        say: 'Agora o pipeline completo, com sqlite3 de verdade: nada pode se perder e nada pode ser aplicado duas vezes.',
        prompt: `Implemente as três peças (os esquemas e \`novo_banco\` já estão prontos):

1. \`criar_pedido(conn, cliente, total)\` grava o pedido **e** o evento na \`outbox\` numa **única transação** e devolve o id do pedido. O evento: \`evento_id = f"pedido-{id}-criado"\`, \`tipo = "PedidoCriado"\`, \`payload\` = JSON de \`{"pedido_id": id, "cliente": cliente, "total": total}\`. Se algo falhar, **nada** fica gravado e a exceção sobe.
2. \`relay(conn, publicar)\` publica os eventos pendentes **em ordem de id**, chamando \`publicar(evento_id, tipo, payload_dict)\`, e marca cada um como publicado **logo depois** de publicá-lo. Se \`publicar\` lançar qualquer exceção, **pare** ali (o evento continua pendente). Devolve quantos eventos publicou nessa rodada.
3. \`consumir(conn, evento_id, tipo, payload)\` é o consumidor **idempotente** (no banco do consumidor): para \`PedidoCriado\`, soma 1 em \`pedidos\` e \`total\` em \`valor\` na linha do cliente em \`totais\` (criando a linha se preciso). Devolve \`True\` se aplicou e \`False\` se o evento já tinha sido processado. Se o efeito falhar, a exceção sobe e **nada** fica registrado.`,
        starter: SCHEMAS + `

def criar_pedido(conn, cliente, total):
    """Pedido + evento na outbox, numa ÚNICA transação. Devolve o id do pedido."""
    # TODO
    pass


def relay(conn, publicar):
    """Publica os pendentes em ordem de id; para no primeiro erro. Devolve quantos publicou."""
    # TODO
    pass


def consumir(conn, evento_id, tipo, payload):
    """Aplica o efeito uma única vez por evento_id. True = aplicou, False = repetido."""
    # TODO
    pass
`,
        tests: [
          {
            name: 'criar_pedido grava pedido e evento juntos',
            code: `conn = novo_banco(SCHEMA_LOJA)
pid = criar_pedido(conn, "ana", 120.0)
assert not conn.in_transaction, "faltou o commit: a transação ficou aberta"
assert conn.execute("SELECT cliente, total FROM pedidos WHERE id = ?", (pid,)).fetchone() == ("ana", 120.0)
eventos = conn.execute("SELECT evento_id, tipo, payload, publicado FROM outbox").fetchall()
assert len(eventos) == 1, f"esperado 1 evento na outbox, veio {len(eventos)}"
evento_id, tipo, payload, publicado = eventos[0]
assert (evento_id, tipo, publicado) == (f"pedido-{pid}-criado", "PedidoCriado", 0), eventos[0]
assert json.loads(payload) == {"pedido_id": pid, "cliente": "ana", "total": 120.0}`,
          },
          {
            name: 'falha ao gravar o evento desfaz o pedido',
            code: `conn = novo_banco(SCHEMA_LOJA)
conn.execute("CREATE TRIGGER disco_cheio BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disco cheio'); END")
try:
    criar_pedido(conn, "bia", 50.0)
except sqlite3.Error:
    pass
else:
    raise AssertionError("a falha na outbox deveria subir como exceção")
assert conn.execute("SELECT COUNT(*) FROM pedidos").fetchone()[0] == 0, "o pedido ficou gravado sem o evento: isso é dual write!"`,
          },
          {
            name: 'relay publica em ordem e marca como publicado',
            code: `conn = novo_banco(SCHEMA_LOJA)
ids = [criar_pedido(conn, c, t) for c, t in (("ana", 10.0), ("bia", 20.0), ("caio", 30.0))]
recebidos = []
n = relay(conn, lambda eid, tipo, payload: recebidos.append((eid, tipo, payload["cliente"])))
assert n == 3, f"relay deveria devolver 3, devolveu {n}"
assert recebidos == [(f"pedido-{i}-criado", "PedidoCriado", c) for i, c in zip(ids, ("ana", "bia", "caio"))], recebidos
assert conn.execute("SELECT COUNT(*) FROM outbox WHERE publicado = 0").fetchone()[0] == 0, "todos deveriam estar marcados"`,
          },
          {
            name: 'rodar o relay de novo não republica nada',
            code: `conn = novo_banco(SCHEMA_LOJA)
criar_pedido(conn, "ana", 10.0)
recebidos = []
relay(conn, lambda eid, tipo, payload: recebidos.append(eid))
assert relay(conn, lambda eid, tipo, payload: recebidos.append(eid)) == 0
assert recebidos == ["pedido-1-criado"], recebidos`,
          },
          {
            name: 'broker fora do ar: para, mantém a ordem e retoma depois',
            code: `conn = novo_banco(SCHEMA_LOJA)
for c in ("ana", "bia", "caio"):
    criar_pedido(conn, c, 10.0)
recebidos = []
def instavel(eid, tipo, payload):
    if payload["cliente"] == "bia":
        raise ConnectionError("broker fora do ar")
    recebidos.append(payload["cliente"])
assert relay(conn, instavel) == 1, "deveria publicar só a ana e parar na bia"
assert recebidos == ["ana"], "não pule a bia: a caio sairia antes dela e a ordem quebraria"
assert relay(conn, lambda eid, tipo, p: recebidos.append(p["cliente"])) == 2
assert recebidos == ["ana", "bia", "caio"], recebidos`,
          },
          {
            name: 'consumidor ignora evento repetido',
            code: `dest = novo_banco(SCHEMA_CONSUMIDOR)
p = {"pedido_id": 1, "cliente": "ana", "total": 10.0}
assert consumir(dest, "pedido-1-criado", "PedidoCriado", p) is True
assert consumir(dest, "pedido-1-criado", "PedidoCriado", p) is False, "o mesmo evento_id não pode ser aplicado de novo"
assert consumir(dest, "pedido-2-criado", "PedidoCriado", {"pedido_id": 2, "cliente": "ana", "total": 5.0}) is True
assert dest.execute("SELECT pedidos, valor FROM totais WHERE cliente = 'ana'").fetchone() == (2, 15.0)`,
          },
          {
            name: 'ack perdido: o evento sai duas vezes, o efeito acontece uma vez',
            hidden: true,
            code: `loja = novo_banco(SCHEMA_LOJA)
dest = novo_banco(SCHEMA_CONSUMIDOR)
criar_pedido(loja, "ana", 10.0)
criar_pedido(loja, "ana", 5.0)
entregas = []
def broker(eid, tipo, payload):
    entregas.append(eid)
    consumir(dest, eid, tipo, payload)
    if len(entregas) == 1:
        raise TimeoutError("o broker entregou, mas a confirmação se perdeu")
relay(loja, broker)   # entrega o 1º, "falha" e para
relay(loja, broker)   # reentrega o 1º (duplicata!) e entrega o 2º
assert entregas == ["pedido-1-criado", "pedido-1-criado", "pedido-2-criado"], entregas
assert dest.execute("SELECT pedidos, valor FROM totais WHERE cliente = 'ana'").fetchone() == (2, 15.0), "a duplicata não pode contar duas vezes"`,
          },
          {
            name: 'efeito que falha não "queima" o evento',
            hidden: true,
            code: `dest = novo_banco(SCHEMA_CONSUMIDOR)
dest.execute("CREATE TRIGGER falha BEFORE INSERT ON totais BEGIN SELECT RAISE(ABORT, 'falha no efeito'); END")
p = {"pedido_id": 9, "cliente": "caio", "total": 7.0}
try:
    consumir(dest, "pedido-9-criado", "PedidoCriado", p)
except sqlite3.Error:
    pass
else:
    raise AssertionError("se o efeito falha, a exceção deve subir: é assim que o broker sabe que precisa reentregar")
dest.execute("DROP TRIGGER falha")
assert consumir(dest, "pedido-9-criado", "PedidoCriado", p) is True, "o registro em processados e o efeito precisam estar na MESMA transação"
assert dest.execute("SELECT pedidos, valor FROM totais").fetchall() == [(1, 7.0)]`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /select[^"']*from\s+processados/i.test(code),
            text: 'Você consultou `processados` antes de inserir (*check-then-act*). Com dois consumidores em paralelo, os dois podem ver "não processado" e aplicar o efeito duas vezes. Deixe a **chave primária** decidir: `INSERT OR IGNORE` e confira `rowcount` (ou trate o `IntegrityError`).',
            concept: 'Consumidor idempotente',
          },
          {
            when: (m, code) => (code.match(/executescript/g) || []).length > 1,
            text: 'Você usou `executescript` fora do `novo_banco`. Cuidado: no `sqlite3` do Python, `executescript()` faz **COMMIT** de qualquer transação pendente antes de rodar o script — no meio de `criar_pedido`, isso quebraria a atomicidade sem nenhum aviso.',
            concept: 'Transactional outbox',
          },
        ],
        hints: [
          '`criar_pedido`: tudo dentro de um `with conn:`. O id do pedido vem de `cur.lastrowid`, e o payload vira texto com `json.dumps(...)`.',
          '`relay`: busque os pendentes com `WHERE publicado = 0 ORDER BY id`. Para cada um, `try: publicar(...)` / `except Exception: break`; só depois de publicar, marque (`UPDATE outbox SET publicado = 1 WHERE id = ?`) e faça o commit.',
          "`consumir`: dentro de um `with conn:`, faça `INSERT OR IGNORE INTO processados` e olhe `cur.rowcount` — `0` significa repetido. O efeito pode ser um UPSERT: `INSERT INTO totais VALUES (?, 1, ?) ON CONFLICT (cliente) DO UPDATE SET pedidos = pedidos + 1, valor = valor + excluded.valor`.",
        ],
        solution: SCHEMAS + `

def criar_pedido(conn, cliente, total):
    """Pedido + evento na outbox, numa ÚNICA transação. Devolve o id do pedido."""
    with conn:  # os dois INSERTs ou nenhum
        cur = conn.execute("INSERT INTO pedidos (cliente, total) VALUES (?, ?)", (cliente, total))
        pedido_id = cur.lastrowid
        payload = {"pedido_id": pedido_id, "cliente": cliente, "total": total}
        conn.execute(
            "INSERT INTO outbox (evento_id, tipo, payload) VALUES (?, ?, ?)",
            (f"pedido-{pedido_id}-criado", "PedidoCriado", json.dumps(payload)),
        )
    return pedido_id


def relay(conn, publicar):
    """Publica os pendentes em ordem de id; para no primeiro erro. Devolve quantos publicou."""
    pendentes = conn.execute(
        "SELECT id, evento_id, tipo, payload FROM outbox WHERE publicado = 0 ORDER BY id"
    ).fetchall()
    publicados = 0
    for id_, evento_id, tipo, payload in pendentes:
        try:
            publicar(evento_id, tipo, json.loads(payload))
        except Exception:
            break  # broker fora do ar: tenta na próxima rodada, sem furar a ordem
        with conn:
            conn.execute("UPDATE outbox SET publicado = 1 WHERE id = ?", (id_,))
        publicados += 1
    return publicados


def consumir(conn, evento_id, tipo, payload):
    """Aplica o efeito uma única vez por evento_id. True = aplicou, False = repetido."""
    with conn:  # deduplicação e efeito na MESMA transação
        cur = conn.execute("INSERT OR IGNORE INTO processados (evento_id) VALUES (?)", (evento_id,))
        if cur.rowcount == 0:
            return False  # já processado: só confirma o recebimento
        if tipo == "PedidoCriado":
            conn.execute(
                """INSERT INTO totais (cliente, pedidos, valor) VALUES (?, 1, ?)
                   ON CONFLICT (cliente) DO UPDATE
                   SET pedidos = pedidos + 1, valor = valor + excluded.valor""",
                (payload["cliente"], payload["total"]),
            )
    return True
`,
        solutionExplanation: `- **\`criar_pedido\`**: o \`with conn:\` faz dos dois INSERTs uma transação só. Se a outbox falhar, o rollback leva o pedido junto — é exatamente o que o dual write não consegue garantir.
- **\`relay\`**: publica **antes** de marcar. Se cair no meio, o evento sai de novo (*at-least-once*); o contrário (marcar e depois publicar) poderia **perder** o evento. Parar no primeiro erro preserva a ordem.
- **\`consumir\`**: a chave primária de \`processados\` é quem deduplica, e ela está na **mesma transação** do efeito. Se o efeito falha, o registro de "processado" é desfeito junto e a exceção sobe, para o broker reentregar.

O teste do "ack perdido" mostra as três peças juntas: o broker entregou, mas a confirmação se perdeu; o relay republicou; o consumidor reconheceu o \`evento_id\` e o total ficou certo. Em produção, troque o polling por CDC ou acrescente \`SKIP LOCKED\` para rodar vários relays, e apague os eventos antigos da outbox.`,
      },
      {
        type: 'mcq',
        id: 'db-dist-q4',
        concept: 'CDC',
        say: 'Agora um incidente de verdade com CDC. O que encheu o disco?',
        prompt: 'Vocês trocaram o polling da outbox por **CDC com Debezium**, lendo o WAL do PostgreSQL por um *replication slot*. Num feriado prolongado, o conector ficou parado por 3 dias — e o disco do **banco** encheu. Por quê?',
        options: [
          { text: 'O replication slot impede o descarte do WAL que o consumidor ainda não leu: com o conector parado, o WAL se acumula no disco. É preciso monitorar o atraso do slot e limitá-lo com `max_slot_wal_keep_size`.', correct: true, why: 'O slot é a promessa "não apague o log que eu ainda não li". Consumidor parado = promessa infinita. Por isso alertas sobre o atraso dos slots são obrigatórios em quem usa CDC ou réplicas lógicas.' },
          { text: 'O Debezium grava uma cópia de cada tabela dentro do próprio banco.', why: 'O Debezium lê o banco e escreve no Kafka; os offsets dele ficam fora do banco de origem. Ele não duplica tabelas no PostgreSQL.' },
          { text: 'A tabela outbox cresceu porque ninguém apagou os eventos.', why: 'Com CDC, a linha pode ser apagada logo após o INSERT (o evento já está no log). E a outbox cresceria igual com o conector rodando: o que muda com ele **parado** é o WAL retido pelo slot.' },
          { text: 'O CDC cria um trigger em cada tabela, que grava cada mudança numa tabela de auditoria.', why: 'CDC por trigger existe, mas o Debezium no PostgreSQL usa *logical decoding*, sem triggers — essa é justamente a vantagem do CDC baseado em log.' },
        ],
        explanation: 'CDC baseado em log é barato para o banco **enquanto o consumidor acompanha**. Um replication slot abandonado é uma das causas clássicas de disco cheio no PostgreSQL: monitore o atraso dos slots (`pg_replication_slots`), limite o WAL retido com `max_slot_wal_keep_size` (PostgreSQL 13+) e remova slots que ninguém mais usa.',
      },
      {
        type: 'open',
        id: 'db-dist-q5',
        concept: 'Transactional outbox',
        say: 'Última: explique a arquitetura completa, do produtor ao consumidor.',
        prompt: 'O serviço de pedidos faz `INSERT` no banco e, logo depois, publica `PedidoCriado` no Kafka. De vez em quando o time de estoque reclama de pedidos que "nunca chegaram" — e, às vezes, de pedidos processados **duas vezes**. Explique a causa dos dois sintomas e proponha a solução de ponta a ponta.',
        minWords: 35,
        rubric: [
          {
            label: 'Diagnostica o **dual write**: queda ou falha entre o commit e o publish deixa os sistemas divergentes',
            keywords: ['dual write', 'escrita dupla', 'entre o commit', 'depois do commit', 'antes do publish', 'no meio', 'nao e atomic', 'sem atomicidade', 'nao tem atomicidade', 'dois sistemas'],
            concept: 'Dual write',
            why: 'Não existe transação que abrace banco e broker: sempre há uma janela em que só um recebeu a escrita.',
          },
          {
            label: 'Propõe o **outbox**: o evento gravado na mesma transação do pedido',
            keywords: ['outbox', 'mesma transacao'],
            concept: 'Transactional outbox',
            why: 'Com o evento no próprio banco, pedido e evento existem juntos — ou nenhum dos dois.',
          },
          {
            label: 'Explica o **relay/CDC** e que a entrega é *at-least-once* (pode duplicar)',
            keywords: ['relay', 'cdc', 'debezium', 'polling', 'at-least-once', 'at least once', 'pelo menos uma vez', 'reenvi', 'republic', 'reentreg'],
            concept: 'Message relay',
            why: 'Quem publica a partir da outbox pode repetir um evento se cair entre publicar e marcar.',
          },
          {
            label: 'Exige **consumidor idempotente** (dedup pelo id do evento)',
            keywords: ['idempot', 'dedup', 'evento_id', 'id do evento', 'processados', 'inbox'],
            concept: 'Consumidor idempotente',
            why: 'As duplicatas são normais no at-least-once; o consumidor precisa reconhecê-las e ignorá-las.',
          },
        ],
        modelAnswer: `A causa dos dois sintomas é o **dual write**: gravar no banco e publicar no Kafka são dois sistemas sem uma transação comum. Se o processo cai **depois do commit** e antes do publish, o pedido existe mas o evento nunca sai ("nunca chegou"). E, quando o publish dá timeout e o código tenta de novo, o evento pode sair duas vezes.

A solução de ponta a ponta começa com o **transactional outbox**: o evento é gravado numa tabela \`outbox\` na **mesma transação** do pedido, então os dois existem juntos ou nenhum. Um **relay** (polling da tabela ou **CDC** com Debezium lendo o WAL) publica os eventos pendentes em ordem e os marca como publicados. Essa entrega é **at-least-once**: se o relay cair entre publicar e marcar, o evento é republicado.

Por isso o estoque precisa de um **consumidor idempotente**: ele grava o \`evento_id\` numa tabela de processados (inbox), na mesma transação do efeito, e ignora eventos repetidos. Assim nada se perde e nada é aplicado duas vezes.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você reconhece um **dual write** de longe e sabe a receita: **outbox** na mesma transação, **relay** ou **CDC** publicando *at-least-once* e **consumidores idempotentes** do outro lado.',
          'Essa combinação aparece em praticamente toda arquitetura de microsserviços séria — e em muita entrevista de system design.',
        ],
        board: null,
      },
    ],
  });
})();
