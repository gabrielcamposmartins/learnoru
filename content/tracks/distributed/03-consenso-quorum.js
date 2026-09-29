Game.registerModule('distributed', {
  id: 'consenso-quorum',
  title: 'Quóruns, consenso e fencing tokens',
  kind: 'lesson',
  level: 3,
  order: 10,
  unit: 'coordenacao',
  summary: 'Como réplicas concordam: quóruns R + W > N, read repair, sloppy quorum, eleição de líder, Raft em linhas gerais, split brain, leases e fencing tokens.',
  concepts: ['Quórum R + W > N', 'Read repair', 'Raft', 'Split brain', 'Fencing token'],
  takeaways: [
    'Com N réplicas, escrever em **W** e ler de **R** com **R + W > N** faz toda leitura encontrar pelo menos uma réplica com a última escrita confirmada — conjuntos de maioria sempre se cruzam.',
    'Quórum não é mágica: uma escrita que "falhou" pode ter sido **parcialmente aplicada**, e o **sloppy quorum** troca a garantia de interseção por disponibilidade. O **read repair** conserta réplicas atrasadas durante a própria leitura.',
    '**Raft** elege no máximo um líder por **termo**, com votos da maioria, e só confirma uma entrada quando a maioria a gravou. Não implemente consenso: use etcd, ZooKeeper ou Consul.',
    'Um líder ou dono de lock pode **não saber** que foi deposto (pausa de GC, partição): é o **split brain**. Lease sozinho não resolve.',
    '**Fencing token**: cada concessão do lock ganha um número crescente, e o **recurso** recusa tokens menores que o maior já visto — o zumbi é barrado no armazenamento, não no lock.',
  ],
  glossary: [
    { term: 'Quórum', aliases: ['quorum', 'quóruns', 'quorums'], definition: 'Número mínimo de réplicas que precisam responder para uma operação valer. Com N réplicas, escrever em W e ler de R com **R + W > N** faz toda leitura cruzar a última escrita confirmada em pelo menos uma réplica. O mais comum é a maioria: ⌊N/2⌋ + 1.' },
    { term: 'Read repair', aliases: ['read-repair', 'reparo na leitura'], definition: 'Durante uma leitura com quórum, as réplicas que devolveram uma versão **antiga** (ou nada) recebem ali mesmo a versão mais nova. Conserta as réplicas que são lidas; as demais dependem da **anti-entropia** em segundo plano.' },
    { term: 'Sloppy quorum', aliases: ['sloppy quorums', 'quórum relaxado'], definition: 'Quando as réplicas donas de uma chave estão inacessíveis, a escrita é aceita por **outros** nós, que a devolvem ao dono quando ele volta (*hinted handoff*). Aumenta a disponibilidade de escrita, mas R + W > N deixa de garantir que a leitura veja o último valor.' },
    { term: 'Split brain', aliases: ['split-brain', 'cérebro dividido'], definition: 'Situação em que **dois nós** agem como líder (ou dono de um lock) ao mesmo tempo — por partição de rede, pausa de GC ou lease expirado sem o dono perceber. Resultado típico: escritas conflitantes e dados corrompidos.' },
    { term: 'Fencing token', aliases: ['fencing tokens', 'token de fencing', 'tokens de fencing'], definition: 'Número **estritamente crescente** entregue a cada concessão de um lock. O cliente o envia em toda escrita, e o recurso recusa tokens menores que o maior já visto — assim um dono antigo (zumbi) é barrado mesmo sem saber que perdeu o lock.' },
    { term: 'Lease', aliases: ['leases'], definition: 'Lock com **prazo de validade**: o dono renova antes de expirar e, se morrer, o lock se libera sozinho. Não protege contra um dono que só **pausou** (GC, VM congelada) — para isso existem os fencing tokens.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Nova unidade: **coordenação**! Para sobreviver a falhas, guardamos cada dado em **N réplicas**. A pergunta é: quantas precisam responder para uma escrita ou uma leitura "valer"?',
        'Esperar **todas** é frágil — basta uma cair. Esperar **uma** é arriscado — ela pode estar atrasada. O meio-termo tem nome: **quórum**.',
      ],
      board: {
        title: 'Quóruns: R + W > N',
        md: `\`\`\`text
 réplicas:            r1   r2   r3   r4   r5          N = 5
 escrita (W = 3):     ■    ■    ■    ·    ·           confirmada por r1, r2, r3
 leitura (R = 3):     ·    ·    ■    ■    ■           consulta r3, r4, r5
                                ↑
          R + W = 6 > 5 → pelo menos UMA réplica está nos dois conjuntos
\`\`\`

Se **R + W > N**, qualquer conjunto de leitura cruza qualquer conjunto de escrita. Com uma **versão** em cada valor, a leitura escolhe a **maior** — e enxerga a última escrita confirmada.

| Configuração (N = 3) | R + W > N? | Aguenta fora do ar | Perfil |
|---|---|---|---|
| W = 2, R = 2 | ✓ | 1 na escrita, 1 na leitura | equilibrado (o clássico) |
| W = 3, R = 1 | ✓ | 0 na escrita, 2 na leitura | leitura rápida, escrita frágil |
| W = 1, R = 3 | ✓ | 2 na escrita, 0 na leitura | escrita rápida, leitura frágil |
| W = 1, R = 1 | ✗ | 2 e 2 | rápido, mas pode ler dado velho |

> [!dica] O quórum mais comum é a **maioria** (⌊N/2⌋ + 1): duas maiorias **sempre** se cruzam, e o sistema aguenta ⌊(N − 1)/2⌋ falhas. É por isso que clusters têm 3 ou 5 nós — com 4, você paga um nó a mais e continua tolerando só 1 falha.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Na prática, cada réplica guarda **(versão, valor)**. A escrita vai para todas e espera W confirmações; a leitura espera R respostas e fica com a **maior versão**.',
        'Mas atenção às letras miúdas: R + W > N fala de escritas **confirmadas**, em condições normais. Os furos dessa garantia caem em entrevista.',
      ],
      board: {
        title: 'Leitura e escrita com quórum',
        md: `\`\`\`text
 escrita (N = 3, W = 2)                    leitura depois (N = 3, R = 2)
 cliente ──▶ r1 ✗ fora do ar               cliente ──▶ r1: (v6, "azul")   ← voltou atrasada
         ──▶ r2 ✓ grava (v7, "verde")              ──▶ r2: (v7, "verde")
         ──▶ r3 ✓ grava (v7, "verde")      maior versão: v7 → devolve "verde"
 2 confirmações ≥ W = 2 → sucesso
\`\`\`

**Letras miúdas (os furos):**
- **Escrita que "falhou" pode ter sido aplicada**: com 1 confirmação de W = 2, o cliente recebe erro, mas a réplica que gravou **continua com o valor** — e uma leitura futura pode devolvê-lo. É o "não sei" da aula de falácias outra vez.
- **Escritas concorrentes** precisam de um desempate: com relógio de parede (LWW), uma delas some; com vector clocks, viram *siblings*.
- **Leitura durante uma escrita** pode ver o valor novo numa réplica e o antigo em outra: R + W > N **sozinho não** dá linearizabilidade.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E a réplica que ficou para trás? Ela é consertada de dois jeitos: na própria leitura (**read repair**) ou por um processo de fundo (**anti-entropia**).',
        'E quando as réplicas "donas" da chave estão inacessíveis? Alguns bancos aceitam a escrita em **qualquer** nó vivo. É o **sloppy quorum** — e ele muda as regras do jogo.',
      ],
      board: {
        title: 'Read repair, anti-entropia e sloppy quorum',
        md: `**Read repair** — a leitura já tem as respostas na mão: quem devolveu uma versão antiga (ou nada) recebe a mais nova ali mesmo.

\`\`\`text
 leitura R = 2:  r1 → (v6, "azul")    r2 → (v7, "verde")
                 resposta: "verde"    + reparo: r1 recebe (v7, "verde")
\`\`\`

**Anti-entropia** — um processo de fundo compara réplicas e copia o que falta. Para não trafegar tudo, compara **Merkle trees** (árvores de hashes): se as raízes batem, os dados batem; se não, desce só nos ramos diferentes.

> [!sabia] **Sloppy quorum** (Dynamo, Riak): se as réplicas donas de uma chave estão inacessíveis, a escrita vai para **outros** nós, que guardam uma "dica" (*hint*) e a entregam ao dono quando ele voltar — o *hinted handoff*. A escrita continua disponível, mas agora os W nós que confirmaram podem não ter **nenhuma** interseção com os R da próxima leitura: R + W > N deixa de garantir que você lê o último valor.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Quóruns sem líder servem para ler e gravar valores. Mas para decidir **uma sequência** de operações — quem é o dono do lock, qual é a configuração do cluster — precisamos de **consenso**.',
        'O algoritmo mais ensinado hoje é o **Raft**, criado em 2014 justamente para ser **entendível** (o Paxos tinha fama de que ninguém entendia). Vamos ao essencial.',
      ],
      board: {
        title: 'Raft em linhas gerais',
        md: `\`\`\`text
                election timeout                 votos da maioria
  ┌──────────┐ ───────────────────▶ ┌───────────┐ ──────────────────▶ ┌───────┐
  │ SEGUIDOR │                      │ CANDIDATO │                     │ LÍDER │
  └──────────┘ ◀─────────────────── └───────────┘                     └───────┘
       ▲        outro venceu ou termo maior                                │
       └───────────────────────────────────────────────────────────────────┘
                         viu um termo maior: foi deposto
\`\`\`

- **Termo** (*term*): número crescente, uma "era". Cada termo tem **no máximo um** líder.
- **Eleição**: o seguidor que não ouve o líder dentro do seu *election timeout* (**aleatório**, ex.: 150–300 ms, para evitar empates) vira candidato, incrementa o termo, vota em si e pede votos (\`RequestVote\`). Cada nó vota **uma vez por termo**, e só em quem tem o log pelo menos tão atualizado quanto o seu.
- **Replicação**: o líder envia entradas com \`AppendEntries\` (que também serve de *heartbeat*); uma entrada é **confirmada** (*committed*) quando a **maioria** a gravou.
- Quem usa: **etcd** (o cérebro do Kubernetes), **Consul**, **CockroachDB**, **Kafka** (KRaft).

> [!sabia] **FLP** (Fischer, Lynch e Paterson, 1985): num sistema totalmente **assíncrono**, nenhum algoritmo determinístico de consenso garante terminar se **um único** nó puder falhar. O Raft não refuta o FLP, ele o contorna com **timeouts** e aleatoriedade: é sempre seguro, mas só progride quando a rede se comporta "bem o bastante".

> [!dica] Não implemente consenso em produção. Use etcd, ZooKeeper ou Consul — algoritmos de consenso têm bugs sutis que só aparecem depois de anos de testes de falha.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o problema mais traiçoeiro da unidade: um nó pode **achar** que ainda é o líder — ou o dono do lock — quando o resto do cluster já seguiu em frente.',
        'Partição de rede, pausa de GC de 15 segundos, VM congelada pelo hypervisor… o nó acorda e continua agindo como chefe. Dois chefes ao mesmo tempo: **split brain**.',
      ],
      board: {
        title: 'Split brain e leases',
        md: `**Lease** = lock com **prazo**: "você é o dono por 10 s; renove antes de acabar". Se o dono morre, o lease expira sozinho e outro assume — sem prazo, um dono morto travaria o recurso para sempre.

O problema é o dono que **não morreu**, só **parou**:

\`\`\`text
 cliente 1:  pega o lease (10 s) ── pausa de GC de 15 s ───────────▶ acorda e escreve ✗
 lock:                  … aos 10 s o lease expira → concede ao cliente 2
 cliente 2:                              pega o lease ── escreve ✓
 armazenamento: aceita as DUAS escritas — cada cliente achava que era o dono
\`\`\`

- Checar "meu lease ainda vale?" **antes** de escrever não resolve: a pausa pode acontecer **entre** a checagem e a escrita.
- Medir o lease com relógio de parede piora (o NTP pode pular); use o monotônico — e, mesmo assim, a pausa continua lá.

> [!atencao] Em 2016, Martin Kleppmann usou exatamente esse cenário para criticar o **Redlock** (um algoritmo de lock distribuído sobre vários Redis): sem uma verificação no **recurso**, nenhum lock baseado em tempo é seguro quando a correção dos dados depende dele.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'A solução é elegante: **fencing tokens**. Cada vez que o serviço concede o lock, entrega junto um número **estritamente crescente**.',
        'O cliente manda o token em toda escrita, e o **armazenamento** lembra o maior que já viu. Chegou um token menor? É um zumbi: **recusado**.',
      ],
      board: {
        title: 'Fencing tokens',
        md: `\`\`\`text
 cliente 1:  lock → token 33 ── pausa de GC ────────────────▶ escreve(token=33) ✗ recusado
 cliente 2:        (lease expirou) lock → token 34 ── escreve(token=34) ✓
 armazenamento: maior token visto = 34 → qualquer token < 34 é de um dono antigo
\`\`\`

\`\`\`python
class Armazenamento:
    def escrever(self, chave, valor, token):
        if token < self.maior_token:              # dono antigo acordando
            raise TokenObsoleto(f"{token} < {self.maior_token}")
        self.maior_token = token
        self.dados[chave] = valor
\`\`\`

- O token vem do sistema de consenso: no **ZooKeeper**, o \`zxid\` ou a versão do znode; no **etcd**, a *revision* da chave. Um contador num Redis sem consenso não serve: depois de um failover, ele pode **repetir** números.
- É a mesma ideia do **termo** do Raft e da **época** (*epoch*) de líderes: o número mais alto vence, e o antigo é ignorado.
- Se o recurso não aceita tokens (uma API de terceiros), use escrita condicional (*compare-and-set*) ou torne a operação idempotente.

> [!sabia] O nome vem do **fencing** de clusters: isolar à força o nó suspeito. A versão mais brutal tem uma sigla ótima — **STONITH**, *Shoot The Other Node In The Head*: cortar a energia do nó antigo antes de promover o novo.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo leituras com quórum e um lock à prova de zumbis.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dist-quo-q1',
      concept: 'Quórum R + W > N',
      say: 'Vamos começar com uma conta de quórum — daquelas que aparecem em entrevista de system design.',
      prompt: 'Um banco sem líder guarda cada chave em **N = 5** réplicas. Você quer que toda leitura enxergue a última escrita confirmada (sem sloppy quorum) **e** que leituras e escritas continuem funcionando com **2 réplicas fora do ar**. Qual configuração?',
      options: [
        { text: 'W = 3, R = 3', correct: true, why: 'R + W = 6 > 5 garante a interseção; e com 2 nós fora ainda sobram 3 para escrever e 3 para ler.' },
        { text: 'W = 5, R = 1', why: 'R + W = 6 > 5 garante a interseção, mas a escrita exige **todas** as réplicas: com um único nó fora do ar, nenhuma escrita é confirmada.' },
        { text: 'W = 2, R = 3', why: 'R + W = 5 = N: os conjuntos podem ser disjuntos (escrita em r1 e r2; leitura em r3, r4 e r5) — e a leitura devolve dado velho.' },
        { text: 'W = 3, R = 2', why: 'Também soma 5 = N: dá para ler justamente as 2 réplicas que não receberam a escrita.' },
      ],
      explanation: 'São duas condições independentes: **R + W > N** (interseção) e **W ≤ N − f**, **R ≤ N − f** (disponibilidade com *f* réplicas fora). Com N = 5 e f = 2, W e R podem ser no máximo 3 — e 3 + 3 = 6 > 5. É a **maioria** dos dois lados: por isso quóruns de maioria são o padrão.',
    },
    {
      type: 'match',
      id: 'dist-quo-q2',
      concept: 'Replicação e coordenação',
      say: 'Termos pouco conhecidos, mas que aparecem em todo banco distribuído. Associe!',
      prompt: 'Associe cada **termo** ao que ele descreve.',
      pairs: [
        { left: 'Read repair', right: 'Na leitura, atualizar as réplicas que devolveram uma versão antiga' },
        { left: 'Anti-entropia', right: 'Processo de fundo que compara réplicas (com Merkle trees) e copia o que falta' },
        { left: 'Sloppy quorum', right: 'Aceitar a escrita em nós "de fora" quando os donos da chave estão inacessíveis' },
        { left: 'Hinted handoff', right: 'Entregar ao dono, quando ele volta, a escrita guardada por outro nó' },
        { left: 'Split brain', right: 'Dois nós agindo como líder (ou dono do lock) ao mesmo tempo' },
        { left: 'Fencing token', right: 'Número crescente que faz o recurso recusar donos antigos do lock' },
      ],
      explanation: 'Os quatro primeiros são sobre **fazer réplicas convergirem**: o *read repair* conserta o que a leitura enxergou, a anti-entropia conserta o resto em segundo plano, e o *sloppy quorum* com *hinted handoff* mantém as escritas disponíveis durante falhas — ao custo da garantia R + W > N. Os dois últimos são sobre **coordenação**: o *split brain* é o problema; o *fencing token*, a defesa no recurso.',
    },
    {
      type: 'order',
      id: 'dist-quo-q3',
      concept: 'Raft',
      say: 'Agora o Raft em movimento: ordene uma eleição de líder, do silêncio até o primeiro commit.',
      prompt: 'Ordene o que acontece numa **eleição do Raft**, desde que o líder antigo some até a primeira entrada confirmada pelo novo líder.',
      items: [
        'Um seguidor não recebe *heartbeat* do líder dentro do seu *election timeout* (aleatório)',
        'Ele vira **candidato**: incrementa o termo e vota em si mesmo',
        'Envia `RequestVote` para os outros nós',
        'Cada nó vota uma vez por termo, só em quem tem o log pelo menos tão atualizado quanto o seu',
        'Com votos da **maioria**, vira **líder** e passa a enviar `AppendEntries` como heartbeat',
        'Uma entrada nova é confirmada (*committed*) quando a maioria a gravou',
      ],
      explanation: 'O *timeout* **aleatório** evita que todos virem candidatos ao mesmo tempo e dividam os votos para sempre. "Um voto por termo" + "maioria" garante **no máximo um líder por termo**, e a restrição do log atualizado garante que o novo líder tem todas as entradas já confirmadas. Se o líder antigo reaparecer com um termo menor, é ignorado — e volta a ser seguidor assim que vê o termo maior.',
    },
    {
      type: 'code',
      id: 'dist-quo-q4',
      concept: 'Quórum R + W > N',
      title: 'Leituras e escritas com quórum',
      say: 'Mão na massa: um cliente de quórum sobre réplicas versionadas — com read repair e tudo. As réplicas caem e voltam, como na vida real.',
      prompt: `Cada \`Replica\` guarda \`chave -> (versao, valor)\`, nunca regride de versão e lança \`Indisponivel\` quando está fora do ar. Implemente \`ClienteQuorum(replicas, w, r)\`:

- **Construtor**: com \`N = len(replicas)\`, exija \`1 <= w <= N\`, \`1 <= r <= N\` e \`r + w > N\`; senão, lance \`ValueError\`.
- \`escrever(chave, versao, valor)\`: envie para **todas** as réplicas e conte as confirmações (as indisponíveis não confirmam). Menos de \`w\` → \`QuorumNaoAtingido\`; senão, devolva o número de confirmações.
- \`ler(chave)\`: consulte as réplicas **na ordem da lista**, pulando as indisponíveis, até juntar **\`r\` respostas** — e não consulte além disso. Uma resposta \`None\` ("não tenho a chave") também conta. Menos de \`r\` respostas → \`QuorumNaoAtingido\`.
  - Devolva o **valor** da maior versão entre as respostas (\`None\` se ninguém tem a chave).
  - Faça **read repair**: grave a versão mais nova nas réplicas consultadas que devolveram versão menor ou \`None\`.`,
      starter: `class Indisponivel(Exception):
    """A réplica não respondeu (fora do ar ou do outro lado de uma partição)."""


class QuorumNaoAtingido(Exception):
    """Menos respostas do que o quórum exige."""


class Replica:
    def __init__(self, nome):
        self.nome = nome
        self.dados = {}                            # chave -> (versao, valor)
        self.no_ar = True

    def escrever(self, chave, versao, valor):
        if not self.no_ar:
            raise Indisponivel(self.nome)
        atual = self.dados.get(chave)
        if atual is None or versao > atual[0]:     # nunca regride de versão
            self.dados[chave] = (versao, valor)

    def ler(self, chave):
        if not self.no_ar:
            raise Indisponivel(self.nome)
        return self.dados.get(chave)                # (versao, valor) ou None


class ClienteQuorum:
    def __init__(self, replicas, w, r):
        # TODO: valide 1 <= w <= N, 1 <= r <= N e r + w > N (senão ValueError)
        pass

    def escrever(self, chave, versao, valor):
        # TODO: envie para TODAS; conte as confirmações; menos que w -> QuorumNaoAtingido
        pass

    def ler(self, chave):
        # TODO: consulte em ordem até ter r respostas; maior versão; read repair
        pass
`,
      tests: [
        {
          name: 'o construtor exige R + W > N (e W, R entre 1 e N)',
          code: `rs = [Replica(n) for n in "abc"]
for w, r in [(1, 1), (1, 2), (4, 1), (1, 4), (0, 4)]:
    try:
        ClienteQuorum(rs, w=w, r=r)
        assert False, f"w={w}, r={r} com N=3 deveria lançar ValueError"
    except ValueError:
        pass
ClienteQuorum(rs, w=2, r=2)
ClienteQuorum(rs, w=3, r=1)`,
        },
        {
          name: 'escrita vai para todas as réplicas no ar',
          code: `rs = [Replica(n) for n in "abc"]
q = ClienteQuorum(rs, w=2, r=2)
assert q.escrever("cor", 1, "azul") == 3, "3 réplicas no ar = 3 confirmações"
assert all(rep.dados.get("cor") == (1, "azul") for rep in rs), "envie para todas, não só para as W primeiras"`,
        },
        {
          name: 'escrita com uma réplica fora do ar ainda atinge W = 2',
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
c.no_ar = False
q = ClienteQuorum([a, b, c], w=2, r=2)
assert q.escrever("cor", 1, "azul") == 2
assert a.dados["cor"] == (1, "azul") and b.dados["cor"] == (1, "azul")`,
        },
        {
          name: 'leitura escolhe a maior versão e faz read repair',
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
q = ClienteQuorum([a, b, c], w=2, r=2)
q.escrever("cor", 1, "azul")
a.no_ar = False
q.escrever("cor", 2, "verde")          # só b e c recebem
a.no_ar = True                         # a volta, atrasada
assert q.ler("cor") == "verde"
assert a.dados["cor"] == (2, "verde"), f"read repair: a deveria estar em (2, 'verde'), está em {a.dados['cor']}"`,
        },
        {
          name: 'sem quórum de escrita: erro — mas a réplica no ar gravou',
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
b.no_ar = c.no_ar = False
q = ClienteQuorum([a, b, c], w=2, r=2)
try:
    q.escrever("cor", 1, "azul")
    assert False, "1 confirmação de 2: QuorumNaoAtingido"
except QuorumNaoAtingido:
    pass
assert a.dados["cor"] == (1, "azul"), "a escrita 'falhou', mas a réplica a gravou — quórum não desfaz nada"`,
        },
        {
          name: 'leitura pula réplicas fora do ar e repara quem respondeu',
          hidden: true,
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
a.dados["k"] = (1, "velho")
b.dados["k"] = (1, "velho")
c.dados["k"] = (2, "novo")
a.no_ar = False
q = ClienteQuorum([a, b, c], w=2, r=2)
assert q.ler("k") == "novo"
assert b.dados["k"] == (2, "novo"), "b respondeu com versão antiga: precisa de read repair"
assert a.dados["k"] == (1, "velho"), "a estava fora do ar: não dá para repará-la agora"`,
        },
        {
          name: 'consulta só R réplicas',
          hidden: true,
          code: `class ReplicaEspia(Replica):
    def __init__(self, nome):
        super().__init__(nome)
        self.leituras = 0

    def ler(self, chave):
        self.leituras += 1
        return super().ler(chave)

rs = [ReplicaEspia(n) for n in "abcde"]
q = ClienteQuorum(rs, w=3, r=3)
q.escrever("k", 1, "x")
assert q.ler("k") == "x"
leituras = [rep.leituras for rep in rs]
assert leituras == [1, 1, 1, 0, 0], f"com r=3, pare depois de 3 respostas (uma leitura por réplica): {leituras}"`,
        },
        {
          name: 'chave inexistente devolve None; sem R respostas é erro',
          hidden: true,
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
q = ClienteQuorum([a, b, c], w=2, r=2)
assert q.ler("nada") is None
assert all("nada" not in rep.dados for rep in (a, b, c)), "não há o que reparar"
b.no_ar = c.no_ar = False
try:
    q.ler("nada")
    assert False, "só 1 resposta de 2: QuorumNaoAtingido"
except QuorumNaoAtingido:
    pass`,
        },
        {
          name: 'resposta None também é reparada',
          hidden: true,
          code: `a, b, c = Replica("a"), Replica("b"), Replica("c")
c.dados["k"] = (3, "z")                # só c tem a chave (a e b perderam o disco)
q = ClienteQuorum([a, b, c], w=1, r=3)
assert q.ler("k") == "z"
assert a.dados["k"] == (3, "z") and b.dados["k"] == (3, "z")`,
        },
        {
          name: 'propriedade: com R + W > N, a leitura vê a última escrita confirmada',
          hidden: true,
          code: `import random
rnd = random.Random(11)
rs = [Replica(f"r{i}") for i in range(5)]
q = ClienteQuorum(rs, w=3, r=3)
for versao in range(1, 60):
    for rep in rs:
        rep.no_ar = True
    for rep in rnd.sample(rs, 2):
        rep.no_ar = False
    q.escrever("k", versao, f"v{versao}")
    for rep in rs:
        rep.no_ar = True
    for rep in rnd.sample(rs, 2):
        rep.no_ar = False
    lido = q.ler("k")
    assert lido == f"v{versao}", f"versão {versao}: a leitura devolveu {lido!r}, não a última escrita confirmada"`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Você captura exceções genéricas. Capture só `Indisponivel`: senão um bug de programação (um `KeyError`, por exemplo) vira "réplica fora do ar" e some em silêncio — e o quórum passa a mentir.',
          concept: 'Tratamento de falhas',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O estado do cliente (réplicas, W e R) deve viver na instância — dois clientes com quóruns diferentes precisam conviver.',
          concept: 'Quórum R + W > N',
        },
      ],
      hints: [
        'No `__init__`, calcule `n = len(replicas)` e valide com `if not (1 <= w <= n and 1 <= r <= n and r + w > n): raise ValueError(...)`. Depois guarde `self.replicas`, `self.w` e `self.r`.',
        'Em `escrever`, percorra **todas** as réplicas com `try: replica.escrever(...); acks += 1` e `except Indisponivel: pass`. Só no fim compare `acks` com `self.w`.',
        'Em `ler`, junte pares `(replica, resposta)` até ter `self.r`. A mais nova é `max((resp for _, resp in respostas if resp is not None), key=lambda resp: resp[0], default=None)`; depois repare quem tem `resp is None or resp[0] < versao`.',
      ],
      solution: `class Indisponivel(Exception):
    """A réplica não respondeu (fora do ar ou do outro lado de uma partição)."""


class QuorumNaoAtingido(Exception):
    """Menos respostas do que o quórum exige."""


class Replica:
    def __init__(self, nome):
        self.nome = nome
        self.dados = {}                            # chave -> (versao, valor)
        self.no_ar = True

    def escrever(self, chave, versao, valor):
        if not self.no_ar:
            raise Indisponivel(self.nome)
        atual = self.dados.get(chave)
        if atual is None or versao > atual[0]:     # nunca regride de versão
            self.dados[chave] = (versao, valor)

    def ler(self, chave):
        if not self.no_ar:
            raise Indisponivel(self.nome)
        return self.dados.get(chave)                # (versao, valor) ou None


class ClienteQuorum:
    def __init__(self, replicas, w, r):
        n = len(replicas)
        if not (1 <= w <= n and 1 <= r <= n and r + w > n):
            raise ValueError(f"quórum inválido: N={n}, W={w}, R={r}")
        self.replicas = replicas
        self.w = w
        self.r = r

    def escrever(self, chave, versao, valor):
        acks = 0
        for replica in self.replicas:               # na vida real: em paralelo
            try:
                replica.escrever(chave, versao, valor)
                acks += 1
            except Indisponivel:
                pass
        if acks < self.w:
            raise QuorumNaoAtingido(f"{acks} de {self.w} confirmações")
        return acks

    def ler(self, chave):
        respostas = []                              # (replica, (versao, valor) ou None)
        for replica in self.replicas:
            if len(respostas) == self.r:
                break
            try:
                respostas.append((replica, replica.ler(chave)))
            except Indisponivel:
                pass
        if len(respostas) < self.r:
            raise QuorumNaoAtingido(f"{len(respostas)} de {self.r} respostas")
        existentes = [resp for _, resp in respostas if resp is not None]
        if not existentes:
            return None
        versao, valor = max(existentes, key=lambda resp: resp[0])
        for replica, resp in respostas:             # read repair
            if resp is None or resp[0] < versao:
                replica.escrever(chave, versao, valor)
        return valor
`,
      solutionExplanation: 'A escrita vai para **todas** as réplicas e só depois conta as confirmações — por isso, quando o quórum não é atingido, quem gravou **continua gravado**: erro de quórum é "não sei", não "não aconteceu". A leitura para assim que junta **R respostas** (é isso que a deixa rápida e tolerante a falhas: não espera as réplicas lentas ou caídas) e fica com a maior versão. Como R + W > N, pelo menos uma das R respostas viu a última escrita confirmada — o teste de propriedade derruba réplicas ao acaso e confere isso 59 vezes. Por fim, o **read repair** aproveita as respostas que já estão na mão para atualizar as réplicas atrasadas ou vazias, fazendo o sistema convergir a cada leitura.',
    },
    {
      type: 'code',
      id: 'dist-quo-q5',
      concept: 'Fencing token',
      title: 'Lock com lease e fencing tokens',
      say: 'Agora o grande final: um lock que não se deixa enganar por zumbis. O relógio é injetado — ninguém vai esperar a pausa de GC de verdade.',
      prompt: `Implemente um serviço de lock com **lease** e **fencing tokens**, e o armazenamento que barra zumbis. O relógio é **injetado**: \`relogio()\` devolve o "agora" em segundos (nos testes, um relógio falso que avançamos na mão).

\`ServicoDeLock(duracao, relogio)\`:
- \`adquirir(cliente)\` — se ninguém tem um lease **válido** (o lease vale enquanto \`relogio() < expira_em\`), concede ao \`cliente\`: gera um **token novo** (1, 2, 3…, nunca repetido), define \`expira_em = relogio() + duracao\` e devolve o token. Se há um lease válido — de outro cliente **ou do próprio** —, devolve \`None\`.
- \`liberar(cliente, token)\` — só libera se \`cliente\` for o dono atual **e** \`token\` for o da concessão atual, e aí devolve \`True\`. Senão, devolve \`False\` e não mexe em nada (um zumbi não pode liberar o lock de outro!).

\`Armazenamento()\`:
- \`escrever(chave, valor, token)\` — se \`token\` for **menor** que o maior token já visto, lança \`TokenObsoleto\` sem gravar nada. Senão, grava e passa a lembrar esse token como o maior. Token **igual** ao maior é aceito (o mesmo dono escrevendo de novo).
- \`ler(chave)\` já está pronto.`,
      starter: `class TokenObsoleto(Exception):
    """Escrita com token menor que o maior já visto: é um dono antigo do lock."""


class ServicoDeLock:
    def __init__(self, duracao, relogio):
        self.duracao = duracao        # validade do lease, em segundos
        self.relogio = relogio        # função que devolve o "agora" (injetada)
        # TODO: estado do lock (dono, último token, expiração)

    def adquirir(self, cliente):
        # TODO: livre ou expirado -> token novo; senão None
        pass

    def liberar(self, cliente, token):
        # TODO: só o dono atual, com o token atual
        pass


class Armazenamento:
    def __init__(self):
        self.dados = {}
        # TODO: lembrar o maior token já visto

    def escrever(self, chave, valor, token):
        # TODO: token menor que o maior visto -> TokenObsoleto
        pass

    def ler(self, chave):
        return self.dados.get(chave)
`,
      tests: [
        {
          name: 'um dono por vez',
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
assert lock.adquirir("c1") == 1
assert lock.adquirir("c2") is None, "c1 tem um lease válido"
assert lock.adquirir("c1") is None, "o lock não é reentrante: nem o próprio dono adquire de novo"`,
        },
        {
          name: 'o lease expira e o próximo token é maior',
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
assert lock.adquirir("c1") == 1
agora[0] = 10                       # expira_em = 0 + 10: no instante 10 já não vale
assert lock.adquirir("c2") == 2`,
        },
        {
          name: 'o armazenamento barra o zumbi (pausa de GC)',
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
disco = Armazenamento()
t1 = lock.adquirir("c1")
disco.escrever("arquivo", "c1 v1", t1)
agora[0] = 25                       # c1 fica 25 s pausado (GC)…
t2 = lock.adquirir("c2")            # …o lease expirou e c2 assume
disco.escrever("arquivo", "c2 v1", t2)
try:
    disco.escrever("arquivo", "c1 v2", t1)    # c1 acorda achando que ainda é o dono
    assert False, "token antigo deveria ser recusado (TokenObsoleto)"
except TokenObsoleto:
    pass
assert disco.ler("arquivo") == "c2 v1"`,
        },
        {
          name: 'só o dono atual libera',
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
t = lock.adquirir("c1")
assert lock.liberar("c2", t) is False, "c2 não é o dono"
assert lock.liberar("c1", t + 1) is False, "token errado"
assert lock.liberar("c1", t) is True
assert lock.adquirir("c2") == 2`,
        },
        {
          name: 'o lease ainda vale um instante antes de expirar',
          hidden: true,
          code: `agora = [100]
lock = ServicoDeLock(duracao=5, relogio=lambda: agora[0])
assert lock.adquirir("c1") == 1
agora[0] = 104.999
assert lock.adquirir("c2") is None, "o lease vale até 105"
agora[0] = 105
assert lock.adquirir("c2") == 2`,
        },
        {
          name: 'zumbi não consegue liberar o lock do novo dono',
          hidden: true,
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
t1 = lock.adquirir("c1")
agora[0] = 12
t2 = lock.adquirir("c2")
assert lock.liberar("c1", t1) is False, "c1 é um zumbi: não pode liberar o lock de c2"
assert lock.adquirir("c3") is None, "c2 continua dono"
assert lock.liberar("c2", t2) is True`,
        },
        {
          name: 'tokens nunca se repetem, nem para o mesmo cliente',
          hidden: true,
          code: `agora = [0]
lock = ServicoDeLock(duracao=10, relogio=lambda: agora[0])
tokens = []
for cliente in ["a", "a", "b", "a"]:
    t = lock.adquirir(cliente)
    tokens.append(t)
    assert lock.liberar(cliente, t) is True
agora[0] = 50
tokens.append(lock.adquirir("c"))
assert tokens == [1, 2, 3, 4, 5], f"tokens: {tokens}"`,
        },
        {
          name: 'armazenamento: token igual passa; menor é recusado sem gravar',
          hidden: true,
          code: `disco = Armazenamento()
disco.escrever("k", "a", 3)
disco.escrever("k", "b", 3)         # o mesmo dono escrevendo de novo
disco.escrever("k", "c", 7)
try:
    disco.escrever("k", "zumbi", 5)
    assert False, "5 < 7: recusar"
except TokenObsoleto:
    pass
assert disco.ler("k") == "c", "a escrita recusada não pode ter gravado nada"
disco.escrever("outra", "d", 7)
assert disco.ler("outra") == "d"`,
        },
        {
          name: 'cada serviço e cada armazenamento têm o seu estado',
          hidden: true,
          code: `agora = [0]
l1 = ServicoDeLock(10, lambda: agora[0])
l2 = ServicoDeLock(10, lambda: agora[0])
assert l1.adquirir("a") == 1 and l2.adquirir("a") == 1, "o estado vazou entre serviços de lock"
d1, d2 = Armazenamento(), Armazenamento()
d1.escrever("k", "x", 9)
d2.escrever("k", "y", 1)
assert d2.ler("k") == "y", "o maior token vazou entre armazenamentos"`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('time') || m.imports.includes('datetime'),
          text: 'Você importou `time`/`datetime`. Use o `relogio` **injetado**: além de deixar o teste determinístico, a hora da máquina pode pular (NTP) — prazos de lease devem vir de um relógio **monotônico**, e quem escolhe qual é quem monta o serviço.',
          concept: 'Relógio injetado',
        },
        {
          when: (m, code) => /^ {4}[A-Za-z_]\w*\s*=\s*(\{\}|\[\]|dict\(\)|list\(\))/m.test(code),
          text: 'Há um dicionário/lista criado como **atributo de classe** — ele seria compartilhado por todas as instâncias. Crie o estado no `__init__`.',
          concept: 'Estado por instância',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O estado do lock (dono, token, prazo) e o maior token visto devem viver nas instâncias.',
          concept: 'Estado por instância',
        },
      ],
      hints: [
        'No `ServicoDeLock`, guarde `self.dono = None`, `self.token = 0` e `self.expira_em = None`. O lease vale enquanto `self.dono is not None and self.relogio() < self.expira_em`.',
        'Em `adquirir`: se o lease vale, `return None`; senão, `self.token += 1`, `self.dono = cliente`, `self.expira_em = self.relogio() + self.duracao` e devolva o token. O contador **nunca** volta — nem ao liberar.',
        'Em `liberar`, confira `cliente == self.dono and token == self.token`. No `Armazenamento`, guarde `self.maior_token = 0`; se `token < self.maior_token`, `raise TokenObsoleto(...)`; senão, atualize o maior e grave.',
      ],
      solution: `class TokenObsoleto(Exception):
    """Escrita com token menor que o maior já visto: é um dono antigo do lock."""


class ServicoDeLock:
    def __init__(self, duracao, relogio):
        self.duracao = duracao
        self.relogio = relogio
        self.dono = None
        self.token = 0                    # último token concedido: só cresce
        self.expira_em = None

    def _lease_valido(self):
        return self.dono is not None and self.relogio() < self.expira_em

    def adquirir(self, cliente):
        if self._lease_valido():
            return None
        self.token += 1
        self.dono = cliente
        self.expira_em = self.relogio() + self.duracao
        return self.token

    def liberar(self, cliente, token):
        if cliente != self.dono or token != self.token:
            return False                  # zumbi ou engano: não mexe no lock de ninguém
        self.dono = None
        self.expira_em = None
        return True


class Armazenamento:
    def __init__(self):
        self.dados = {}
        self.maior_token = 0

    def escrever(self, chave, valor, token):
        if token < self.maior_token:      # dono antigo acordando de uma pausa
            raise TokenObsoleto(f"token {token} < {self.maior_token}")
        self.maior_token = token
        self.dados[chave] = valor

    def ler(self, chave):
        return self.dados.get(chave)
`,
      solutionExplanation: 'O serviço de lock garante duas coisas: no máximo **um lease válido** por vez (medido pelo relógio injetado) e tokens **estritamente crescentes**, que nunca voltam — nem depois de liberar. O `liberar` confere dono **e** token, porque o zumbi que acorda de uma pausa costuma tentar liberar um lock que já não é dele. Mas a peça que realmente salva os dados é o `Armazenamento`: o lease expirou sem o cliente 1 perceber, e nenhuma checagem do lado dele resolveria (a pausa pode cair entre a checagem e a escrita). Como o recurso lembra o **maior token visto**, a escrita atrasada com token 1 chega depois da escrita com token 2 e é recusada. Em produção, o token vem do sistema de consenso (a *revision* do etcd, o *zxid* do ZooKeeper), e o recurso guarda o token na mesma transação que o dado.',
    },
    {
      type: 'open',
      id: 'dist-quo-q6',
      concept: 'Fencing token',
      say: 'Para fechar, um postmortem de verdade. Explique como faria para o time.',
      prompt: 'Seu time usa um lock no Redis com expiração (`SET fatura:42 worker-1 NX PX 30000`) para garantir que só um worker processa cada fatura. Mesmo assim, uma fatura foi **processada duas vezes**: o worker-1 teve uma pausa de GC de 40 s. Explique o que aconteceu e como você corrigiria.',
      minWords: 30,
      rubric: [
        { label: 'Explica que o **lease expirou** durante a pausa e outro worker pegou o lock', keywords: ['expir', 'venceu', 'ttl', 'prazo', 'lease', '30 s', '30s', '30 segundos'], concept: 'Lease', why: 'O lock tem prazo de 30 s: durante a pausa de 40 s ele expirou e foi concedido a outro worker.' },
        { label: 'Aponta que o worker pausado **não sabe** que perdeu o lock (dois donos)', keywords: ['nao sab', 'nao perceb', 'achand', 'achav', 'acha que', 'ainda era o dono', 'ainda tinha', 'dois donos', 'dois workers', 'ambos', 'split brain', 'split-brain', 'zumbi', 'ao mesmo tempo'], concept: 'Split brain', why: 'Ao acordar, o worker-1 continua agindo como dono — e checar o lock antes de escrever não resolve, porque a pausa pode cair entre a checagem e a escrita.' },
        { label: 'Propõe **fencing token** (número crescente a cada concessão)', keywords: ['fencing', 'token', 'numero crescente', 'contador crescente', 'monoton', 'epoch', 'epoca', 'revision', 'zxid'], concept: 'Fencing token', why: 'Cada concessão do lock ganha um número maior que todos os anteriores, e ele acompanha cada escrita.' },
        { label: 'O **recurso** (banco) verifica e recusa o token antigo — ou a operação é idempotente', keywords: ['recus', 'rejeit', 'armazenamento', 'no banco', 'banco verific', 'where', 'condicional', 'compare-and-set', 'compare and set', 'idempot', 'maior token'], concept: 'Fencing token', why: 'Quem barra o zumbi é o recurso, que lembra o maior token visto; uma operação idempotente é a segunda linha de defesa.' },
      ],
      modelAnswer: `O lock do Redis é um **lease**: vale 30 s. O worker-1 pegou o lock e entrou numa pausa de GC de 40 s; enquanto ele estava parado, o prazo **expirou**, o worker-2 adquiriu o lock e processou a fatura. Quando o worker-1 acordou, ele **não sabia** que tinha perdido o lock — continuou achando que era o dono, e os dois processaram a mesma fatura (um *split brain* em miniatura). Checar o lock antes de escrever não resolve, porque a pausa pode acontecer entre a checagem e a escrita.

A correção é usar **fencing tokens**: cada concessão do lock recebe um número crescente (por exemplo, a *revision* do etcd ou o zxid do ZooKeeper — um contador num Redis sem consenso pode se repetir após um failover), o worker envia esse token em toda escrita e o **banco recusa** tokens menores que o maior já visto, com um \`UPDATE ... WHERE token <= :token\`. Como defesa extra, o processamento da fatura deve ser **idempotente** (marcar a fatura como processada numa escrita condicional), para que uma segunda execução não tenha efeito.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Que aula! Recapitulando: **R + W > N** faz leituras e escritas se cruzarem; read repair e anti-entropia fazem as réplicas convergirem; o Raft elege **um líder por termo**.',
        'E o recado mais importante: um lock com prazo **não impede** um zumbi — quem barra o zumbi é o **recurso**, com fencing tokens. Na próxima unidade: consistência e CRDTs!',
      ],
      board: null,
    },
  ],
});
