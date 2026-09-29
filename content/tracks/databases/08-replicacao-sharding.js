Game.registerModule('databases', {
  id: 'replicacao-sharding',
  title: 'Replicação, sharding e consistent hashing',
  kind: 'lesson',
  level: 3,
  order: 31,
  unit: 'escala',
  summary: 'Quando uma máquina não basta: réplicas líder/seguidor, replication lag e suas anomalias, sharding por faixa × hash, consistent hashing com nós virtuais e o trade-off PACELC.',
  concepts: ['Replicação líder/seguidor', 'Replication lag', 'Sharding', 'Consistent hashing', 'PACELC'],
  takeaways: [
    'Replicação **líder/seguidor** escala leitura e dá alta disponibilidade: a síncrona não perde escrita confirmada; a assíncrona é rápida, mas pode perder o fim do log num failover.',
    'Réplicas assíncronas têm **replication lag**: garanta *read-your-writes* (ler do líder logo após escrever) e *monotonic reads* (fixar o usuário numa réplica).',
    'Sharding por **faixa** preserva a ordem (consultas por intervalo), mas chave crescente vira hot spot; por **hash** espalha a carga, mas intervalos viram *scatter-gather*.',
    '`hash(chave) % N` remapeia quase tudo quando N muda; **consistent hashing** com **nós virtuais** move só ~1/N das chaves e equilibra a carga.',
    '**PACELC**: com partição de rede, escolha entre disponibilidade e consistência (o CAP); **senão**, entre latência e consistência — o trade-off de todo dia.',
  ],
  glossary: [
    {
      term: 'Replication lag',
      aliases: ['atraso de replicação', 'lag de replicação', 'replica lag'],
      definition: 'Atraso entre o commit no líder e a aplicação da mesma mudança numa réplica assíncrona. Normalmente são milissegundos; sob carga ou falha, segundos ou minutos — e as leituras nas réplicas mostram dados velhos.',
    },
    {
      term: 'Read-your-writes',
      aliases: ['read your writes', 'read-after-write', 'read-after-write consistency'],
      definition: 'Garantia de que o usuário sempre enxerga o que **ele mesmo** acabou de gravar (outros podem ver depois). Implementação comum: ler do líder por alguns segundos após uma escrita, ou só de réplicas que já aplicaram a posição do log dessa escrita.',
    },
    {
      term: 'Monotonic reads',
      aliases: ['leituras monotônicas', 'leitura monotônica', 'monotonic read'],
      definition: 'Garantia de que um usuário nunca "volta no tempo": depois de ver um dado novo, não verá uma versão mais antiga dele. Implementação comum: sempre ler da mesma réplica (escolhida pelo hash do id do usuário).',
    },
    {
      term: 'Consistent hashing',
      aliases: ['hashing consistente', 'hash consistente', 'anel de hash', 'hash ring'],
      definition: 'Técnica que posiciona nós e chaves num **anel** de hash: cada chave pertence ao primeiro nó no sentido horário. Adicionar ou remover um nó move só ~1/N das chaves, em vez de quase todas, como em `hash % N`.',
    },
    {
      term: 'Nó virtual',
      aliases: ['nós virtuais', 'vnode', 'vnodes', 'virtual node', 'virtual nodes'],
      definition: 'Cada servidor físico ocupa **vários** pontos do anel de consistent hashing. Isso equilibra a carga e, quando um servidor sai, espalha as chaves dele por vários vizinhos, em vez de sobrecarregar um só.',
    },
    {
      term: 'PACELC',
      aliases: ['teorema PACELC'],
      definition: 'Extensão do CAP (Daniel Abadi, 2010): se há **P**artição, escolha entre **A**vailability e **C**onsistency; **E**lse (sem partição), entre **L**atency e **C**onsistency. Dynamo e Cassandra são PA/EL; Spanner e VoltDB, PC/EC.',
    },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Seu banco está no limite: CPU no talo, disco enchendo, leituras lentas. Existem duas ferramentas para sair de uma máquina só — e elas resolvem problemas **diferentes**.',
        '**Replicação** copia os mesmos dados em várias máquinas. **Sharding** divide os dados, e cada máquina fica com um pedaço.',
      ],
      board: {
        title: 'Replicação × sharding',
        md: `\`\`\`text
REPLICAÇÃO: os mesmos dados em várias máquinas
   escritas ─▶ [ líder ] ──log──▶ [ réplica ] ◀── leituras
                         └─log──▶ [ réplica ] ◀── leituras

SHARDING: cada máquina guarda uma parte
   usuários A–H ─▶ [ shard 1 ]    I–P ─▶ [ shard 2 ]    Q–Z ─▶ [ shard 3 ]
\`\`\`

| | Replicação | Sharding (particionamento) |
|---|---|---|
| Resolve | escala de **leitura**, alta disponibilidade, latência geográfica | escala de **escrita** e de **volume** de dados |
| Não resolve | escrita: tudo ainda passa pelo líder | disponibilidade: um shard fora do ar = dados fora do ar |
| Dor principal | réplicas atrasadas (*replication lag*) | consultas e transações **entre** shards |

> [!dica] Na prática se combinam as duas: cada shard é um pequeno grupo líder + réplicas. E antes de qualquer uma delas: índices, cache e uma máquina maior resolvem mais do que parece.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Comecemos pela replicação mais comum: **líder e seguidores**. Todas as escritas vão para o líder, que envia o log de mudanças (o WAL, ou o binlog do MySQL) para os seguidores.',
        'A grande decisão é: o commit **espera** a réplica confirmar ou não?',
      ],
      board: {
        title: 'Síncrona × assíncrona',
        md: `\`\`\`text
cliente ──INSERT──▶ LÍDER ──log──▶ seguidor 1   síncrono: o commit espera o "ok" dele
                      │    └─log──▶ seguidor 2   assíncrono: aplica quando der
                      ▼
               "commit ok" ao cliente
\`\`\`

| | Síncrona | Assíncrona | Semi-síncrona |
|---|---|---|---|
| O commit é confirmado quando… | o seguidor também gravou | o líder gravou | pelo menos **um** seguidor gravou |
| Latência da escrita | + ida e volta até a réplica | mínima | + a réplica mais rápida |
| Se o líder morrer | nada confirmado se perde | as últimas escritas podem **sumir** | nada se perde, se o failover promover a réplica síncrona |
| Se a réplica travar | as escritas **param** | nada muda | outra réplica assume o papel |

**Failover** (trocar de líder) em quatro passos: detectar a falha (heartbeats sem resposta), escolher a réplica mais atualizada, apontar as escritas para ela e impedir que o líder antigo volte achando que ainda manda (*split brain* — assunto da trilha de Sistemas Distribuídos).

> [!atencao] Em 2012, no GitHub, uma réplica MySQL **desatualizada** foi promovida a líder. Ela reutilizou chaves primárias autoincrementais que o líder antigo já tinha usado — e que também estavam no Redis. Resultado: alguns usuários viram dados privados de outros. Failover com réplica assíncrona não é só "perder as últimas escritas".`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Réplicas assíncronas escalam leitura lindamente… até o dia em que o usuário edita o perfil, recarrega a página e a edição **sumiu**.',
        'Não sumiu: a leitura foi para uma réplica que ainda não aplicou a escrita. É o **replication lag** — e ele pede garantias explícitas.',
      ],
      board: {
        title: 'Replication lag e as garantias de sessão',
        md: `\`\`\`text
t=0,0s  Ana salva a bio  ──▶ LÍDER: bio = "Nova"  (commit ok)
t=0,3s  Ana recarrega    ──▶ réplica 2: bio = "Antiga"   (lag de 2 s)  😱
t=0,9s  Ana recarrega    ──▶ réplica 1: bio = "Nova"
t=1,4s  Ana recarrega    ──▶ réplica 2: bio = "Antiga"   (voltou no tempo!)
\`\`\`

| Garantia | Evita | Como implementar |
|---|---|---|
| **Read-your-writes** | não ver o que você mesmo gravou | ler do líder por alguns segundos após uma escrita; ou guardar a posição do log da escrita (LSN no PostgreSQL, GTID no MySQL) e só ler de réplicas que já passaram dela |
| **Monotonic reads** | o dado "voltar no tempo" entre duas leituras | sempre a mesma réplica para o mesmo usuário (hash do \`user_id\`) |
| **Consistent prefix reads** | ver a resposta antes da pergunta | gravar dados causalmente ligados na mesma partição, na ordem |

> [!dica] Meça o lag: \`replay_lag\` em \`pg_stat_replication\` (PostgreSQL) ou \`Seconds_Behind_Source\` (MySQL). Alerte quando ele passar do que o produto tolera — e tire da rotação a réplica muito atrasada.`,
      },
    },
    {
      type: 'say',
      text: [
        'Quando o problema é **escrita** ou **volume**, replicar não adianta: é hora de **sharding**. A pergunta central é: qual **chave** decide o shard de cada linha?',
        'Há dois jeitos clássicos de distribuir: por **faixa** de valores ou por **hash** da chave.',
      ],
      board: {
        title: 'Sharding por faixa × por hash',
        md: `| | Por faixa (*range*) | Por hash |
|---|---|---|
| Como | \`A–H → S1\`, \`I–P → S2\`, ou por mês | \`hash(chave)\` decide o shard |
| Consulta por intervalo | ✅ um shard (ou poucos) | ❌ todos os shards (*scatter-gather*) |
| Distribuição | ⚠️ desigual (sobrenomes, datas) | ✅ uniforme |
| Hot spot típico | chave **crescente** (data, autoincremento): toda escrita cai no último shard | chave "celebridade": milhões de acessos a **uma** chave |
| Exemplos | HBase, Bigtable, MongoDB (*range*) | Cassandra, DynamoDB, MongoDB (*hashed*) |

**Boa chave de shard:**
- alta **cardinalidade** e carga bem distribuída;
- presente nas **consultas principais** — senão, cada consulta pergunta a todos os shards;
- mantém junto o que é transacionado junto (ex.: \`tenant_id\` num SaaS: os dados de cada cliente ficam num shard só).

> [!atencao] **Hot key** não se resolve trocando a função de hash: a chave é **uma** só. Saídas comuns: cache na frente, réplicas de leitura dessa chave ou *salting* — gravar em \`chave#0\` … \`chave#9\` e somar as 10 partes na leitura.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'A forma ingênua de sharding por hash é `hash(chave) % N`. Funciona… até você precisar adicionar o 5º servidor.',
        'Com `% N`, mudar N remapeia **quase todas** as chaves. A solução elegante é o **consistent hashing**.',
      ],
      board: {
        title: 'hash % N × consistent hashing',
        md: `\`\`\`text
hash % N, de 4 para 5 servidores:
chave:   k1  k2  k3  k4  k5  k6  k7  k8 ...
N = 4 →  S1  S3  S0  S2  S1  S0  S3  S2
N = 5 →  S3  S0  S4  S2  S1  S4  S0  S3        ~80% das chaves mudam de servidor!

Consistent hashing: nós e chaves no mesmo anel (0 … 2³² − 1)
            ● S1#0
      k2 ○        ○ k7          cada chave pertence ao primeiro
   ● S3#1          ● S2#0       nó virtual no sentido horário
      k9 ○        ○ k4
            ● S1#1
\`\`\`

| | \`hash % N\` | Consistent hashing |
|---|---|---|
| Chaves que mudam ao ir de N para N+1 | ~N/(N+1) — quase todas | ~1/(N+1) — só as que o nó novo "rouba" |
| Busca do dono | O(1) | O(log P) com busca binária nos P pontos |

**Nós virtuais:** cada servidor ocupa dezenas ou centenas de pontos (\`S1#0\`, \`S1#1\`, …). Isso reduz o desequilíbrio, permite dar mais pontos a servidores maiores e, quando um servidor sai, divide as chaves dele entre **vários** vizinhos. O Cassandra usa isso (\`num_tokens\`), assim como o Dynamo da Amazon e clientes de memcached.

> [!sabia] O consistent hashing foi publicado em 1997 por pesquisadores do MIT — entre eles Tom Leighton e Danny Lewin, que no ano seguinte fundaram a **Akamai** para usá-lo em CDN. Há alternativas pouco conhecidas: o **rendezvous hashing** (HRW), em que cada chave escolhe o servidor com o maior \`hash(chave, servidor)\`, sem anel; e o **jump consistent hash** do Google (2014), com cinco linhas de código e zero memória, mas só para servidores numerados de 0 a N−1.`,
      },
    },
    {
      type: 'say',
      text: [
        'Adicionar um servidor é só metade do trabalho: os dados precisam **mudar de casa** sem derrubar o sistema. Isso é o **rebalanceamento**.',
      ],
      board: {
        title: 'Rebalanceamento',
        md: `| Estratégia | Como funciona | Quem usa |
|---|---|---|
| **Muitas partições fixas** | crie, de saída, bem mais partições que nós (ex.: 1 000 para 10 nós); um nó novo "rouba" partições inteiras | Elasticsearch, Riak, Couchbase |
| **Particionamento dinâmico** | a partição que passa de um tamanho é dividida em duas (*split*) | HBase, MongoDB, DynamoDB |
| **Proporcional aos nós** | cada nó tem um número fixo de pontos no anel (vnodes) | Cassandra |

- Mova os dados **aos poucos** e com limite de banda: o rebalanceamento compete com o tráfego real.
- Cuidado com o rebalanceamento **automático**: um nó lento é dado como morto, os dados dele começam a ser copiados, os outros nós ficam sobrecarregados, mais nós "morrem"… uma falha em cascata. Muitos times preferem um humano confirmando o plano.
- Alguém precisa saber **onde** cada chave mora: um roteador (o \`mongos\` do MongoDB), um cliente que conhece o mapa, ou qualquer nó que repassa a requisição. O mapa costuma viver num serviço de coordenação (ZooKeeper, etcd).`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Por fim, o teorema mais citado — e mais mal interpretado — de sistemas distribuídos: o **CAP**. E o sucessor dele, que quase ninguém conhece: o **PACELC**.',
        'O CAP só fala do momento da **falha de rede**. Mas a rede funciona 99,9% do tempo — e aí também existe uma escolha.',
      ],
      board: {
        title: 'CAP e PACELC',
        md: `**CAP**: durante uma **partição de rede** (P), um sistema replicado precisa escolher entre **consistência** (C, toda leitura vê a última escrita — linearizabilidade) e **disponibilidade** (A, todo nó que está de pé responde). "P" não é opção: redes falham.

**PACELC**: se há **P**artição → **A** ou **C**; **E**lse (sem partição) → **L**atência ou **C**onsistência. Replicar de forma síncrona para ser consistente custa uma ida e volta a cada escrita — mesmo com a rede perfeita.

| Sistema (configuração padrão) | Na partição | Sem partição | Leitura |
|---|---|---|---|
| Dynamo, Cassandra, Riak | **PA** | **EL** | responde sempre e rápido; reconcilia depois |
| Spanner, VoltDB, HBase | **PC** | **EC** | consistência sempre, pagando latência |
| PNUTS (Yahoo) | **PC** | **EL** | o caso curioso: rápido no dia a dia, rígido na falha |

> [!sabia] O **PACELC** foi proposto por Daniel Abadi em 2010: para ele, o CAP ensinava a pensar só na falha, quando o custo que você paga **todo dia** é latência. E um detalhe que derruba candidatos: o **C** do CAP (linearizabilidade entre réplicas) não tem nada a ver com o **C** do ACID (regras de integridade).

> [!dica] O carrinho de compras da Amazon, no artigo do Dynamo (2007), é o exemplo clássico de PA/EL: "adicionar ao carrinho" **nunca** pode falhar. Versões divergentes são mescladas depois — e, às vezes, um item removido reaparece. Para um saldo bancário, a escolha seria a oposta.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Réplicas atrasadas, chave de shard, um anel de consistent hashing de verdade e PACELC.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'db-rep-q1',
      concept: 'Read-your-writes',
      say: 'Primeiro, um bug clássico de quem acabou de colocar réplicas de leitura.',
      prompt: `Uma rede social passou a mandar **todas as leituras** para 3 réplicas assíncronas, atrás de um balanceador. Desde então chegam reclamações: "editei minha bio, a página recarregou e a bio antiga voltou". Depois de alguns segundos, tudo se acerta.

Qual é a correção mais adequada?`,
      options: [
        { text: 'Tornar as três réplicas **síncronas**.', why: 'Resolve o sintoma a um custo alto: toda escrita passa a esperar três réplicas, e **qualquer** réplica lenta ou fora do ar trava as escritas do sistema inteiro. O problema é só de uma sessão ler a própria escrita.' },
        { text: 'Garantir **read-your-writes**: por alguns segundos após o usuário gravar (ou ao ler o próprio perfil), ler do **líder** — ou de uma réplica que já aplicou a posição do log daquela escrita.', correct: true, why: 'A garantia que falta é exatamente essa: quem escreveu precisa ver a própria escrita. Os demais usuários continuam lendo das réplicas, e o ganho de escala se mantém.' },
        { text: 'Colocar um cache na frente das réplicas.', why: 'O cache pode guardar justamente a versão antiga e **aumentar** a janela de dado velho. Cache não cria garantia de consistência para a sessão.' },
        { text: 'Adicionar mais réplicas para dividir a carga.', why: 'Mais réplicas não diminuem o lag — e, se todas replicam do líder, até o aumentam. O usuário ainda cai numa réplica que não aplicou a escrita.' },
      ],
      explanation: 'Réplicas assíncronas quebram garantias de **sessão**. *Read-your-writes* (ver o que você mesmo gravou) se resolve roteando a leitura para o líder logo após uma escrita, ou esperando a réplica chegar na posição do log (LSN/GTID) da escrita. Para a bio não "voltar no tempo" entre recarregamentos, some-se *monotonic reads*: fixar o usuário numa mesma réplica.',
    },
    {
      type: 'match',
      id: 'db-rep-q2',
      concept: 'Replicação e sharding',
      say: 'Fixação rápida: associe cada técnica ao seu efeito.',
      prompt: 'Associe cada **técnica** ao seu efeito principal.',
      pairs: [
        { left: 'Replicação síncrona', right: 'O commit espera a réplica: sem perda no failover, mas escrita mais lenta' },
        { left: 'Replicação assíncrona', right: 'O líder confirma na hora: rápida, mas pode perder o fim do log' },
        { left: 'Monotonic reads', right: 'O usuário nunca vê um dado "voltar no tempo"' },
        { left: 'Sharding por faixa', right: 'Intervalos baratos, mas chave crescente vira hot spot' },
        { left: 'Sharding por hash', right: 'Carga espalhada, mas intervalos consultam todos os shards' },
        { left: 'Nós virtuais', right: 'Vários pontos por servidor no anel, para equilibrar a carga' },
      ],
      explanation: 'Replicação troca **latência** por **durabilidade** (síncrona) ou o contrário (assíncrona) — e a assíncrona pede garantias de sessão como *monotonic reads*. No sharding, faixa preserva a **ordem** (bom para intervalos, ruim para chaves crescentes) e hash preserva o **equilíbrio** (bom para carga, ruim para intervalos). Nós virtuais são o ajuste fino do consistent hashing.',
    },
    {
      type: 'code',
      id: 'db-rep-q3',
      concept: 'Consistent hashing',
      title: 'Anel de consistent hashing com nós virtuais',
      say: 'Hora de construir o anel! Ele precisa responder rápido: essa função roda a cada requisição.',
      prompt: `Implemente um **anel de consistent hashing** com **nós virtuais**:

- \`self.pontos\` é uma lista **ordenada** de tuplas \`(posicao, no)\`. Cada nó ocupa \`vnodes\` pontos: o i-ésimo fica na posição \`hash_estavel(f"{no}#{i}")\`, para \`i = 0 … vnodes - 1\`.
- \`adicionar(no)\` e \`remover(no)\` incluem ou retiram **todos** os pontos do nó.
- \`no_para(chave)\` devolve o nó do **primeiro ponto com posição ≥ \`hash_estavel(chave)\`**; se não houver nenhum, a busca dá a volta no anel (primeiro ponto). Anel vazio → \`None\`.

Use **busca binária** (módulo \`bisect\`): o anel pode ter milhares de pontos.`,
      starter: `import bisect
import hashlib


def hash_estavel(texto):
    """Posição no anel (0 a 2**32 - 1), estável entre execuções — não use hash()."""
    return int.from_bytes(hashlib.md5(texto.encode("utf-8")).digest()[:4], "big")


class AnelConsistente:
    def __init__(self, nos=(), vnodes=100):
        self.vnodes = vnodes
        self.pontos = []   # lista ORDENADA de (posicao, no)
        for no in nos:
            self.adicionar(no)

    def adicionar(self, no):
        # TODO: um ponto por nó virtual: hash_estavel(f"{no}#{i}")
        pass

    def remover(self, no):
        # TODO: retire todos os pontos do nó
        pass

    def no_para(self, chave):
        # TODO: primeiro ponto com posicao >= hash_estavel(chave), com volta no anel
        pass
`,
      tests: [
        { name: 'anel vazio devolve None', expr: 'AnelConsistente().no_para("user:1")', expected: 'None' },
        {
          name: 'pontos: vnodes por nó, em ordem',
          code: `a = AnelConsistente(["s1", "s2"], vnodes=3)
esperado = sorted((hash_estavel(f"{n}#{i}"), n) for n in ("s1", "s2") for i in range(3))
assert a.pontos == esperado, f"pontos deveriam ser {esperado}"`,
        },
        {
          name: 'no_para segue o sentido horário',
          code: `nos = ["s1", "s2", "s3"]
a = AnelConsistente(nos, vnodes=10)
pts = sorted((hash_estavel(f"{n}#{i}"), n) for n in nos for i in range(10))
def dono(chave):
    h = hash_estavel(chave)
    for pos, n in pts:
        if pos >= h:
            return n
    return pts[0][1]
erradas = [k for k in (f"user:{i}" for i in range(500)) if a.no_para(k) != dono(k)]
assert not erradas, f"chaves no nó errado: {erradas[:3]}"`,
        },
        {
          name: 'chave exatamente sobre um ponto fica nesse nó',
          code: `a = AnelConsistente(["s1", "s2", "s3"], vnodes=5)
assert a.no_para("s2#3") == "s2", "a chave cai exatamente no ponto s2#3: 'posição >= hash' inclui o próprio ponto"`,
        },
        {
          name: 'depois do último ponto, dá a volta no anel',
          code: `a = AnelConsistente(["s1", "s2"], vnodes=2)
pts = sorted((hash_estavel(f"{n}#{i}"), n) for n in ("s1", "s2") for i in range(2))
chave = next(f"k{i}" for i in range(100000) if hash_estavel(f"k{i}") > pts[-1][0])
assert a.no_para(chave) == pts[0][1], "depois do último ponto, a chave pertence ao primeiro ponto do anel"`,
        },
        {
          name: 'remover só move as chaves do nó removido',
          code: `a = AnelConsistente(["s1", "s2", "s3", "s4"], vnodes=50)
antes = {f"k{i}": a.no_para(f"k{i}") for i in range(2000)}
a.remover("s3")
assert all(n != "s3" for _, n in a.pontos), "remover deve tirar todos os pontos do nó"
depois = {k: a.no_para(k) for k in antes}
movidas = [k for k in antes if antes[k] != depois[k]]
assert movidas and all(antes[k] == "s3" for k in movidas), "só as chaves que estavam no s3 podem mudar de nó"`,
        },
        {
          name: 'um 5º nó recebe ~1/5 das chaves — e só ele',
          hidden: true,
          code: `a = AnelConsistente(["s1", "s2", "s3", "s4"], vnodes=100)
antes = {f"k{i}": a.no_para(f"k{i}") for i in range(5000)}
a.adicionar("s5")
movidas = [k for k in antes if a.no_para(k) != antes[k]]
assert all(a.no_para(k) == "s5" for k in movidas), "as chaves que mudam de lugar devem ir para o nó novo"
assert 0.1 < len(movidas) / 5000 < 0.3, f"moveram {len(movidas)} de 5000 chaves; o esperado é perto de 1/5"`,
        },
        {
          name: 'nós virtuais equilibram a carga',
          hidden: true,
          code: `from collections import Counter
a = AnelConsistente(["s1", "s2", "s3", "s4"], vnodes=200)
carga = Counter(a.no_para(f"user:{i}") for i in range(20000))
assert set(carga) == {"s1", "s2", "s3", "s4"}
assert all(0.18 < c / 20000 < 0.32 for c in carga.values()), f"carga desequilibrada: {dict(carga)}"`,
        },
        {
          name: 'remover o único nó esvazia o anel',
          hidden: true,
          code: `a = AnelConsistente(["s1"], vnodes=5)
a.remover("s1")
assert a.pontos == [] and a.no_para("x") is None`,
        },
      ],
      perfTests: [
        {
          name: '40 nós × 100 vnodes, 4 000 consultas',
          setup: 'anel = AnelConsistente([f"s{i}" for i in range(40)], vnodes=100)\nchaves = [f"user:{i}" for i in range(4000)]',
          expr: 'len({anel.no_para(c) for c in chaves})',
          expected: '40',
          maxMs: 120,
        },
      ],
      slowConcept: 'Busca binária no anel',
      reviews: [
        {
          when: m => m.calls.includes('hash'),
          text: 'Você usou `hash()`. Para strings ele é **randomizado a cada processo** (PYTHONHASHSEED): cada servidor da sua frota colocaria as chaves em lugares diferentes do anel. Consistent hashing exige um hash **estável**, como o `hash_estavel` (MD5).',
          concept: 'Hash estável',
        },
      ],
      hints: [
        '`adicionar`: para cada `i` em `range(self.vnodes)`, insira `(hash_estavel(f"{no}#{i}"), no)` mantendo a lista ordenada — `bisect.insort` faz isso.',
        '`no_para`: com `h = hash_estavel(chave)`, `bisect.bisect_left(self.pontos, (h,))` devolve o índice do primeiro ponto com posição ≥ `h` (a tupla `(h,)` é menor que qualquer `(h, "nó")`).',
        'Se o índice for igual a `len(self.pontos)`, a chave passou do último ponto: dê a volta com `% len(self.pontos)`. `remover` pode reconstruir a lista sem os pontos do nó.',
      ],
      solution: `import bisect
import hashlib


def hash_estavel(texto):
    """Posição no anel (0 a 2**32 - 1), estável entre execuções — não use hash()."""
    return int.from_bytes(hashlib.md5(texto.encode("utf-8")).digest()[:4], "big")


class AnelConsistente:
    def __init__(self, nos=(), vnodes=100):
        self.vnodes = vnodes
        self.pontos = []   # lista ORDENADA de (posicao, no)
        for no in nos:
            self.adicionar(no)

    def adicionar(self, no):
        for i in range(self.vnodes):
            bisect.insort(self.pontos, (hash_estavel(f"{no}#{i}"), no))

    def remover(self, no):
        self.pontos = [p for p in self.pontos if p[1] != no]

    def no_para(self, chave):
        if not self.pontos:
            return None
        i = bisect.bisect_left(self.pontos, (hash_estavel(chave),))
        return self.pontos[i % len(self.pontos)][1]   # passou do fim? volta ao início
`,
      solutionExplanation: `O anel é só uma **lista ordenada** de posições. Achar o dono de uma chave é uma busca binária — O(log P), com P = nós × vnodes — e o \`% len\` fecha o círculo. Quando um nó entra, ele "rouba" só as chaves que caem logo antes de cada um dos seus pontos (~1/N do total); quando sai, cada ponto dele devolve as chaves ao próximo ponto — que, graças aos vnodes, pertence a servidores **diferentes**, e a carga se espalha.

Extensões usadas em produção:
- **Pesos**: servidor com o dobro de memória recebe o dobro de vnodes.
- **Réplicas**: continue andando no sentido horário até achar R servidores **distintos** — é a *preference list* do Dynamo.
- **Hash estável**: o \`hash()\` do Python muda a cada processo; aqui cada cliente precisa calcular exatamente as mesmas posições.`,
    },
    {
      type: 'mcq',
      id: 'db-rep-q4',
      concept: 'Chave de shard',
      say: 'Agora, a decisão mais cara de desfazer em sharding: a chave.',
      prompt: `Um SaaS de notas fiscais atende **5 mil empresas**. Quase todas as consultas são "notas da empresa X no mês Y" e relatórios por empresa; as transações sempre envolvem uma empresa só. Algumas empresas são enormes. O banco não aguenta mais as escritas e vocês vão fazer sharding da tabela \`notas\`.

Qual chave de shard é a melhor escolha?`,
      options: [
        { text: '`data_emissao`, por faixa (um shard por mês).', why: 'Chave crescente: **todas** as escritas do dia caem no shard do mês atual — um hot spot que anula o sharding. E os relatórios de uma empresa varrem vários shards.' },
        { text: '`tenant_id` (a empresa), por hash — e as empresas gigantes isoladas em shards próprios.', correct: true, why: 'É o filtro de **todas** as consultas e transações: cada operação toca um shard só, os dados de cada cliente ficam juntos e a carga se espalha entre 5 mil empresas. Clientes enormes viram exceção tratada à parte.' },
        { text: '`id` da nota, por hash.', why: 'Distribui perfeitamente, mas nenhuma consulta filtra por `id` da nota: "notas da empresa X" vira *scatter-gather* em **todos** os shards.' },
        { text: 'Nenhuma: adicionar réplicas de leitura resolve.', why: 'Réplicas escalam **leitura**. Toda escrita continua passando pelo líder — e o gargalo aqui é escrita.' },
      ],
      explanation: 'A chave de shard deve ser a que aparece nas **consultas e transações principais**, com cardinalidade alta e carga bem distribuída. Em SaaS multi-tenant, `tenant_id` quase sempre ganha: isola clientes, evita transações entre shards e permite tratar os gigantes à parte (shard dedicado ou sub-particionamento por `tenant_id + mês`).',
    },
    {
      type: 'open',
      id: 'db-rep-q5',
      concept: 'PACELC',
      say: 'Última: use o PACELC como faria numa entrevista de system design.',
      prompt: 'Uma loja vai guardar dois dados num banco replicado entre regiões: o **carrinho de compras** e o **saldo da carteira digital** do cliente. Um colega quer usar a mesma configuração para os dois. Use o **PACELC** para explicar quais trade-offs cada dado pede — na partição de rede **e** no dia a dia sem falhas.',
      minWords: 35,
      rubric: [
        {
          label: 'Explica o lado **PAC**: numa partição, ou responde (disponível) ou recusa (consistente)',
          keywords: ['particao', 'partition', 'rede cai', 'rede dividida', 'falha de rede', 'split', 'disponib', 'availability', 'indisponi'],
          concept: 'PACELC',
          why: 'Na partição, um lado não fala com o outro: responder com o que tem (A) ou recusar até reconectar (C).',
        },
        {
          label: 'Explica o lado **ELC**: sem partição, consistência forte custa **latência**',
          keywords: ['latencia', 'latency', 'ida e volta', 'round trip', 'round-trip', 'sincron', 'esperar a replica', 'esperar as replicas'],
          concept: 'PACELC',
          why: 'Mesmo com a rede perfeita, confirmar em outra região antes de responder custa uma ida e volta a cada escrita.',
        },
        {
          label: 'Carrinho → **PA/EL**: sempre disponível e rápido, aceitando mesclar versões',
          keywords: ['pa/el', ['carrinho', 'eventual'], ['carrinho', 'mescl'], ['carrinho', 'merge'], ['carrinho', 'sempre disponivel'], ['carrinho', 'nunca pode falhar'], ['carrinho', 'dynamo'], ['carrinho', 'cassandra']],
          concept: 'Consistência eventual',
          why: 'Um item duplicado no carrinho é corrigível; recusar o "adicionar ao carrinho" perde a venda.',
        },
        {
          label: 'Saldo → **PC/EC**: consistência forte, mesmo pagando latência ou recusando na partição',
          keywords: ['pc/ec', ['saldo', 'consistencia forte'], ['saldo', 'linearizav'], ['saldo', 'gastar duas'], ['saldo', 'gasto duplo'], ['saldo', 'double spend'], ['saldo', 'spanner'], ['saldo', 'recusar']],
          concept: 'PACELC',
          why: 'Gastar o mesmo saldo duas vezes em regiões diferentes é inaceitável: melhor recusar ou esperar.',
        },
      ],
      modelAnswer: `O PACELC separa dois momentos. Se há **partição** de rede entre as regiões, o sistema escolhe entre **disponibilidade** (cada região responde com o que tem) e **consistência** (recusa até reconectar). E, **sem partição**, ainda escolhe entre **latência** e consistência: replicar de forma síncrona para outra região custa uma ida e volta a cada escrita.

O **carrinho** pede **PA/EL**: "adicionar ao carrinho" nunca pode falhar e precisa ser rápido. Se as regiões divergirem, as versões são mescladas depois (consistência eventual, como no Dynamo da Amazon) — no pior caso, um item removido reaparece, o que é corrigível.

O **saldo** pede **PC/EC**: consistência forte (linearizável), mesmo pagando latência no dia a dia e recusando operações durante a partição, porque gastar o mesmo saldo duas vezes em regiões diferentes é inaceitável. Por isso, usar a mesma configuração para os dois seria errado: o carrinho ficaria lento à toa, ou o saldo, inseguro.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Você viu **replicação** síncrona e assíncrona, as garantias de sessão contra o **replication lag**, sharding por faixa e por hash, **consistent hashing** com nós virtuais — construído por você — e o **PACELC**.',
        'Na próxima aula: como manter **vários** sistemas sincronizados sem cair na armadilha do *dual write*.',
      ],
      board: null,
    },
  ],
});
