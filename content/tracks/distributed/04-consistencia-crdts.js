Game.registerModule('distributed', {
  id: 'consistencia-crdts',
  title: 'Modelos de consistência e CRDTs',
  kind: 'lesson',
  level: 3,
  order: 20,
  unit: 'dados',
  summary: 'Do linearizável ao eventual, garantias de sessão, conflitos em multi-líder, a perda silenciosa do last-writer-wins e os CRDTs: estruturas que convergem sozinhas.',
  concepts: ['Modelos de consistência', 'Garantias de sessão', 'Last-writer-wins', 'CRDT', 'Merge ACI'],
  takeaways: [
    'Modelos de consistência são um **contrato**: linearizável (uma cópia só, em tempo real) › sequencial › causal › eventual. Quanto mais forte, mais coordenação — e menos disponibilidade numa partição.',
    'Garantias de sessão (**read-your-writes**, **monotonic reads**) resolvem as anomalias que o usuário enxerga, com truques baratos: fixar réplica, ler do líder por um tempo, mandar a versão já vista.',
    '**Last-writer-wins** converge, mas **descarta** escritas concorrentes em silêncio — e, com skew de relógio, o "último" pode ser o mais antigo.',
    'Um **CRDT** converge sem coordenação porque o merge é **comutativo**, **associativo** e **idempotente**: ordem, agrupamento e duplicatas de mensagens não mudam o resultado.',
    'G-Counter faz merge pelo **máximo por nó**; PN-Counter são dois G-Counters (P − N). Mas CRDT não garante **invariantes** como "estoque ≥ 0": isso exige coordenação.',
  ],
  glossary: [
    { term: 'Linearizabilidade', aliases: ['linearizável', 'linearizáveis', 'linearizability', 'linearizable', 'consistência forte'], definition: 'O modelo mais forte para um registro: o sistema se comporta como se houvesse **uma única cópia**, e toda leitura que começa depois de uma escrita terminar enxerga essa escrita (ou uma mais nova). Exige coordenação em cada operação.' },
    { term: 'Last-writer-wins', aliases: ['LWW', 'last write wins', 'last-write-wins', 'último escritor vence'], definition: 'Resolução de conflitos em que fica a escrita com o **maior timestamp** e as outras são descartadas. Converge, mas perde escritas concorrentes em silêncio — e, com relógios dessincronizados, pode descartar justamente a mais recente.' },
    { term: 'CRDT', aliases: ['CRDTs', 'Conflict-free Replicated Data Type', 'Conflict-free Replicated Data Types', 'tipo de dado replicado livre de conflitos'], definition: '*Conflict-free Replicated Data Type*: estrutura de dados replicada em que cada réplica aceita escritas sem coordenação e um **merge** comutativo, associativo e idempotente garante que réplicas que viram as mesmas atualizações terminam iguais.' },
    { term: 'G-Counter', aliases: ['G-Counters', 'grow-only counter', 'GCounter'], definition: 'CRDT de contador que **só cresce**: cada nó incrementa apenas a sua própria entrada, o valor é a soma das entradas e o merge pega o **máximo por nó**.' },
    { term: 'PN-Counter', aliases: ['PN-Counters', 'PNCounter'], definition: 'CRDT de contador que sobe e desce: dois G-Counters, **P** (incrementos) e **N** (decrementos). O valor é P − N e o merge é o merge de cada um. Converge, mas não impede o valor de ficar negativo.' },
    { term: 'OR-Set', aliases: ['OR-Sets', 'Observed-Remove Set', 'ORSet'], definition: '*Observed-Remove Set*: CRDT de conjunto em que cada `add` ganha uma **tag única** e o `remove` apaga só as tags que a réplica já **observou**. Um add concorrente a um remove sobrevive (*add-wins*).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Nova unidade: **dados**! Quando um valor mora em várias réplicas, "qual é o valor atual?" deixa de ter resposta óbvia.',
        'O **modelo de consistência** é o contrato que o banco assina com você: o que uma leitura pode — e não pode — devolver.',
      ],
      board: {
        title: 'Do mais forte ao mais fraco',
        md: `| Modelo | Promete | Custo |
|---|---|---|
| **Linearizável** | tudo se comporta como **uma cópia só**; terminou a escrita, toda leitura posterior a vê | consenso ou líder + quórum em cada operação; para numa partição |
| **Sequencial** | existe **uma ordem total** que todos veem igual e que respeita a ordem de cada cliente — mas pode "atrasar" em relação ao relógio | coordenação para ordenar |
| **Causal** | quem viu a **causa** vê o **efeito** (a resposta nunca aparece antes da pergunta); concorrentes podem aparecer em ordens diferentes | metadados de causalidade (vector clocks); **disponível** numa partição |
| **Eventual** | sem novas escritas, as réplicas **um dia** convergem | quase nada — e quase nenhuma garantia no meio do caminho |

\`\`\`text
 linearizável?
 cliente A:  escreve x = 1 ────┤ ok
 cliente B:                         lê x → 0      ✗ a escrita já tinha terminado
 cliente C:                         lê x → 1, depois lê x → 0   ✗ voltou no tempo
\`\`\`

> [!atencao] **Linearizável ≠ serializável.** Serializável fala de **transações** (várias chaves, isolamento); linearizável fala de **uma chave** e de recência em tempo real. Ter as duas coisas se chama *strict serializability* (é o que o Spanner vende).`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Entre o forte e o fraco existem as **garantias de sessão**: promessas feitas a **um usuário**, não ao mundo inteiro.',
        'Elas resolvem justamente as anomalias que viram ticket de suporte — e custam pouco.',
      ],
      board: {
        title: 'Garantias de sessão',
        md: `\`\`\`text
 líder ──replica──▶ réplica 1 (em dia)      réplica 2 (5 s atrasada)
 Ana posta um comentário no líder … recarrega a página e cai na réplica 2: o comentário sumiu!
\`\`\`

| Garantia | Promete | Truque barato |
|---|---|---|
| **Read-your-writes** | você sempre vê o que **você** escreveu | ler do líder por alguns segundos após escrever, ou mandar a versão (LSN) da última escrita e esperar a réplica alcançar |
| **Monotonic reads** | suas leituras **não voltam no tempo** | fixar o usuário numa réplica (*sticky*), ou mandar a versão já vista |
| **Monotonic writes** | suas escritas são aplicadas **na ordem** em que você as fez | numerar as escritas por sessão |
| **Writes-follow-reads** | o que você escreve depois de ler algo é ordenado **depois** do que leu | levar a dependência junto (causalidade) |

As quatro juntas, por sessão, dão a **consistência causal** do ponto de vista de cada usuário.

> [!sabia] **Teorema CAC** (Mahajan, Alvisi e Dahlin, 2011): nenhum modelo mais forte que a **consistência causal** (na variante *real-time causal*) consegue ficar **sempre disponível** durante partições de rede. Ou seja: causal é o "teto" do que dá para oferecer sem nunca recusar uma requisição.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o cenário difícil: **multi-líder**. Duas regiões aceitam escritas na mesma chave, sem se consultar. Conflito é questão de tempo.',
        'O jeito mais popular de "resolver" é o **last-writer-wins**: fica o maior timestamp. Parece inocente. Não é.',
      ],
      board: {
        title: 'Conflitos e o preço do last-writer-wins',
        md: `\`\`\`text
 São Paulo:  lê curtidas = 10 → grava 11 (t = 100.002)
 Dublin:     lê curtidas = 10 → grava 11 (t = 100.001)      ← ao mesmo tempo
 replicação com LWW: fica o de maior t → 11.   Eram 12. Uma curtida sumiu em silêncio.
\`\`\`

**Estratégias para conflitos:**
- **LWW** (Cassandra, por coluna): converge sempre, mas **descarta** escritas concorrentes. Aceitável para cache ou "último status visto"; péssimo para contadores e carrinhos.
- **Versões irmãs** (*siblings*, Riak): guarda as concorrentes (detectadas com vector clocks) e a aplicação resolve na leitura.
- **Merge na aplicação**: regra de negócio (ex.: somar, unir, pedir ao usuário).
- **CRDT**: o tipo de dado já vem com um merge que **não perde nada**.

> [!atencao] Com **skew de relógio**, "último" é quem tem o relógio adiantado: uma escrita que aconteceu **depois** (e até leu a outra!) pode perder para uma anterior. O LWW converge — só não converge para o valor certo.

> [!sabia] No paper do **Dynamo** (Amazon, 2007), o carrinho resolvia conflitos pela **união** dos itens. Resultado conhecido: itens **removidos reapareciam** no carrinho. É o problema que o OR-Set resolve direito.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E se o próprio tipo de dado soubesse se fundir, sem perder nada e sem perguntar a ninguém? Isso existe: **CRDT**, *Conflict-free Replicated Data Type*.',
        'Cada réplica escreve localmente, troca estado com as outras quando der, e todas **convergem**. O segredo está nas três propriedades do merge.',
      ],
      board: {
        title: 'CRDTs: por que o merge converge',
        md: `| Propriedade | Fórmula | O que isso tolera na rede |
|---|---|---|
| **Comutativa** | \`merge(a, b) == merge(b, a)\` | mensagens chegando em **qualquer ordem** |
| **Associativa** | \`merge(merge(a, b), c) == merge(a, merge(b, c))\` | gossip agrupando estados de **qualquer jeito** |
| **Idempotente** | \`merge(a, a) == a\` | mensagens **duplicadas** |

Com as três, a rede pode reordenar, agrupar e duplicar à vontade: réplicas que receberam as mesmas atualizações ficam **iguais**. Isso se chama **strong eventual consistency** — convergência garantida, sem consenso e sem rollback.

**Dois sabores:**
- **Baseado em estado** (*CvRDT*): envia o estado inteiro; o merge é o "máximo" num semirreticulado (o estado só **sobe**). Funciona sobre qualquer rede ruim.
- **Baseado em operações** (*CmRDT*): envia só as operações, que precisam comutar; em troca, exige entrega **exatamente uma vez** e em ordem causal.

> [!sabia] Os CRDTs foram formalizados por **Marc Shapiro** e colegas em 2011. Hoje estão no **Riak** (data types), no **Redis Enterprise** (Active-Active), no presence do **Phoenix** (Elixir) e em bibliotecas de edição colaborativa *local-first*, como **Automerge** e **Yjs**.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'O CRDT mais simples é o **G-Counter**, um contador que só cresce. O truque: cada nó só mexe na **sua** entrada.',
        'E para descer também, junte dois deles: o **PN-Counter**.',
      ],
      board: {
        title: 'G-Counter e PN-Counter',
        md: `\`\`\`text
 nó a: {a: 3, b: 0}          nó b: {a: 1, b: 2}      (b ainda não viu os 2 últimos de a)
 merge = MÁXIMO por nó  →  {a: 3, b: 2}  →  valor = 3 + 2 = 5
\`\`\`

\`\`\`python
class GCounter:
    def __init__(self, no):
        self.no = no
        self.contagens = {}                      # nó -> incrementos feitos POR ESSE nó

    def incrementar(self, n=1):
        self.contagens[self.no] = self.contagens.get(self.no, 0) + n

    def valor(self):
        return sum(self.contagens.values())
\`\`\`

- **Por que máximo, e não soma?** Receber o mesmo estado duas vezes **dobraria** a contagem: soma não é idempotente.
- **Por que por nó, e não o maior total?** Cada entrada só é escrita pelo seu dono, então o máximo dela é o valor mais novo. Comparar totais jogaria fora incrementos concorrentes.
- **PN-Counter**: dois G-Counters, **P** (incrementos) e **N** (decrementos); \`valor = P − N\`. Não dá para "decrementar" um G-Counter: o merge pelo máximo ignoraria a descida.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Registros e conjuntos também têm versões CRDT. Mas atenção: **convergir** não é o mesmo que **preservar a intenção** de todo mundo.',
        'E há coisas que nenhum CRDT resolve. Guarde esta: **invariantes precisam de coordenação**.',
      ],
      board: {
        title: 'LWW-Register, OR-Set e os limites',
        md: `**LWW-Register**: guarda \`(timestamp, nó, valor)\`; o merge fica com o maior \`(timestamp, nó)\` — o nó desempata. É um CRDT legítimo (converge!), mas perde escritas concorrentes, como qualquer LWW.

**OR-Set** (*Observed-Remove Set*): cada \`add\` ganha uma **tag única**; o \`remove\` apaga só as tags que aquela réplica **observou**.

\`\`\`text
 réplica 1:  add("leite") → tag t1          réplica 2:  (viu t1)  remove("leite") → apaga t1
 réplica 1:  add("leite") → tag t2   ← concorrente com o remove
 merge: t1 removida, t2 não foi observada pelo remove → "leite" continua (add-wins)
\`\`\`

As tags removidas viram *tombstones* e crescem para sempre sem coleta de lixo — o custo escondido de muitos CRDTs.

> [!sabia] **Teorema CALM** (*Consistency As Logical Monotonicity*, Hellerstein): um programa roda sem coordenação **se e somente se** é **monotônico** — só acumula fatos, nunca "desdiz" uma conclusão. Contar curtidas é monotônico. "Estoque ≥ 0" não é: cada região vê estoque sobrando e vende o último ingresso ao mesmo tempo. Para invariantes assim: consenso, líder por chave, ou dividir a cota entre as regiões (*escrow*, *bounded counter*).`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo um contador que converge sozinho.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dist-crdt-q1',
      concept: 'Garantias de sessão',
      say: 'Começando por uma anomalia que todo mundo já viu em rede social.',
      prompt: 'Ana abre um post e vê **12 comentários**. Recarrega: **10** (dois sumiram). Recarrega de novo: **12**. Ana não escreveu nada nesse meio-tempo; o site lê de réplicas assíncronas atrás de um balanceador. Qual **garantia de sessão** foi violada, e qual a correção mais barata?',
      options: [
        { text: 'Monotonic reads — fixar cada usuário numa mesma réplica (ou mandar a versão já vista e só aceitar réplicas que a alcançaram)', correct: true, why: 'As leituras de Ana "voltaram no tempo" porque caíram em réplicas com atrasos diferentes. Sticky por usuário resolve sem coordenação global.' },
        { text: 'Read-your-writes — ler do líder por alguns segundos depois de cada escrita', why: 'Read-your-writes é sobre ver **as próprias** escritas. Ana não escreveu nada: o problema é ler uma réplica mais atrasada que a anterior.' },
        { text: 'Linearizabilidade — só se resolve com consenso em toda leitura', why: 'Não é uma garantia de sessão, e seria uma marreta: consenso em cada leitura custa latência e disponibilidade para resolver uma anomalia que tem correção local e barata.' },
        { text: 'Nenhuma: consistência eventual permite isso, então não há o que fazer', why: 'O eventual realmente permite — mas é uma experiência ruim e **evitável**. Garantias de sessão existem exatamente para isso, sem abrir mão da replicação assíncrona.' },
      ],
      explanation: '**Monotonic reads** promete que um usuário nunca vê um estado **mais antigo** do que um que ele já viu. Com réplicas assíncronas, cada uma tem um atraso diferente; se o balanceador sorteia a réplica a cada requisição, as leituras "pulam" para trás. Fixar a réplica por usuário (hash do id) ou levar a versão já vista (um LSN ou timestamp lógico) na sessão resolve — e é muito mais barato que consistência forte.',
    },
    {
      type: 'match',
      id: 'dist-crdt-q2',
      concept: 'Modelos de consistência',
      say: 'Agora associe cada modelo à sua promessa. São parecidos, mas não são iguais!',
      prompt: 'Associe cada **modelo ou garantia** ao que ele promete.',
      pairs: [
        { left: 'Linearizável', right: 'Como uma cópia única: terminada a escrita, toda leitura posterior a vê' },
        { left: 'Sequencial', right: 'Uma ordem total igual para todos, respeitando a ordem de cada cliente' },
        { left: 'Causal', right: 'Quem vê o efeito já viu a causa; concorrentes podem vir em qualquer ordem' },
        { left: 'Eventual', right: 'Sem novas escritas, as réplicas acabam convergindo' },
        { left: 'Read-your-writes', right: 'O usuário sempre vê o que ele mesmo escreveu' },
        { left: 'Monotonic reads', right: 'As leituras de um usuário nunca voltam no tempo' },
      ],
      explanation: 'Os quatro primeiros formam uma escada: **linearizável** acrescenta tempo real ao **sequencial**, que acrescenta uma ordem total ao **causal**, que acrescenta ordem entre causa e efeito ao **eventual**. Os dois últimos são **garantias de sessão**: valem para um usuário e são baratas de implementar. Pelo teorema CAC, nada acima do causal consegue ficar sempre disponível numa partição.',
    },
    {
      type: 'mcq',
      id: 'dist-crdt-q3',
      concept: 'G-Counter',
      say: 'Hora de escolher o merge certo — o coração de todo CRDT.',
      prompt: 'Duas réplicas de um **G-Counter** trocam estado: `a = {"a": 3, "b": 1}` e `b = {"a": 2, "b": 4}`. As mensagens de gossip podem chegar **duplicadas** e **fora de ordem**. Qual merge está correto?',
      options: [
        { text: 'Máximo por nó: `{"a": 3, "b": 4}` — valor 7', correct: true, why: 'Cada entrada só é escrita pelo seu nó, então o maior valor é o mais novo. Máximo é comutativo, associativo e idempotente.' },
        { text: 'Soma por nó: `{"a": 5, "b": 5}` — valor 10', why: 'Não é idempotente: `merge(a, a)` dobraria tudo, e cada mensagem duplicada inflaria o contador. O incremento 2 de `a` já estava contido no 3.' },
        { text: 'Ficar com o estado de maior total: `b` (total 6) — valor 6', why: 'Joga fora o terceiro incremento de `a`, que `b` ainda não tinha visto. Comparar totais não enxerga incrementos **concorrentes**.' },
        { text: 'Ficar com o estado cujo último incremento tem o maior timestamp (LWW)', why: 'É last-writer-wins: descarta incrementos concorrentes e ainda depende de relógios sincronizados — exatamente o que o CRDT quer evitar.' },
      ],
      explanation: 'Um CRDT baseado em estado precisa de um merge que seja o **menor limite superior** dos dois estados: o menor estado que "contém" ambos. No G-Counter, isso é o **máximo entrada a entrada**. Como o estado só sobe, receber de novo um estado antigo ou repetido não muda nada — e a ordem de chegada também não.',
    },
    {
      type: 'code',
      id: 'dist-crdt-q4',
      concept: 'CRDT',
      title: 'G-Counter e PN-Counter',
      say: 'Mão na massa! Implemente os dois contadores. Os testes vão provar as três propriedades e simular um gossip bagunçado entre três regiões.',
      prompt: `Implemente os métodos de dois CRDTs de contador. **Não renomeie** os atributos do \`__init__\` (os testes os usam).

\`GCounter(no)\` — \`self.no\` é o id da réplica; \`self.contagens\` mapeia **nó → incrementos feitos por esse nó**.
- \`incrementar(n=1)\`: soma \`n\` à entrada **do próprio nó**. \`n\` negativo → \`ValueError\` (G-Counter só cresce).
- \`valor()\`: a soma de todas as entradas.
- \`merge(outro)\`: devolve um **novo** \`GCounter\` (com o \`no\` de \`self\`) com o **máximo por nó** — sem alterar \`self\` nem \`outro\`.

\`PNCounter(no)\` — dois G-Counters: \`self.p\` (incrementos) e \`self.n\` (decrementos).
- \`incrementar(n=1)\` e \`decrementar(n=1)\` (\`n\` negativo → \`ValueError\`).
- \`valor()\`: P − N.
- \`merge(outro)\`: devolve um **novo** \`PNCounter\` (com o \`no\` de \`self\`), sem alterar os operandos.

Uma réplica aplica o merge assim: \`replica = replica.merge(estado_recebido)\`.`,
      starter: `class GCounter:
    """Contador que só cresce. Cada nó incrementa apenas a sua própria entrada."""

    def __init__(self, no):
        self.no = no                 # id desta réplica
        self.contagens = {}          # nó -> incrementos feitos POR ESSE nó

    def incrementar(self, n=1):
        # TODO: n < 0 -> ValueError; some n na entrada de self.no
        pass

    def valor(self):
        # TODO: soma de todas as entradas
        pass

    def merge(self, outro):
        # TODO: NOVO GCounter(self.no) com o máximo por nó
        pass


class PNCounter:
    """Contador que sobe e desce: dois G-Counters (P e N)."""

    def __init__(self, no):
        self.no = no
        self.p = GCounter(no)        # incrementos
        self.n = GCounter(no)        # decrementos

    def incrementar(self, n=1):
        pass

    def decrementar(self, n=1):
        pass

    def valor(self):
        pass

    def merge(self, outro):
        # TODO: NOVO PNCounter(self.no) com o merge de P e o merge de N
        pass
`,
      tests: [
        {
          name: 'G-Counter: cada nó incrementa a sua entrada',
          code: `a = GCounter("a")
a.incrementar()
a.incrementar(3)
assert a.valor() == 4, f"valor: {a.valor()}"
assert a.contagens == {"a": 4}, f"contagens: {a.contagens}"`,
        },
        {
          name: 'G-Counter só cresce: incremento negativo é erro',
          code: `a = GCounter("a")
a.incrementar(2)
try:
    a.incrementar(-1)
    assert False, "incrementar(-1) deveria lançar ValueError"
except ValueError:
    pass
assert a.valor() == 2`,
        },
        {
          name: 'merge não perde incrementos concorrentes nem altera os operandos',
          code: `a, b = GCounter("a"), GCounter("b")
a.incrementar(2)
b.incrementar(3)
m = a.merge(b)
assert m.valor() == 5, f"merge deveria valer 5, vale {m.valor()}"
assert a.valor() == 2 and b.valor() == 3, "merge deve devolver um NOVO contador, sem alterar a nem b"
assert m.no == "a", "o resultado continua sendo a réplica de self.no"`,
        },
        {
          name: 'merge é idempotente (estado duplicado não conta duas vezes)',
          code: `a, b = GCounter("a"), GCounter("b")
a.incrementar(2)
b.incrementar(3)
assert a.merge(a).valor() == 2, "merge(a, a) deve ser a"
m = a.merge(b).merge(b).merge(b)
assert m.valor() == 5, f"receber o mesmo estado 3 vezes não pode inflar o contador: {m.valor()}"`,
        },
        {
          name: 'merge é comutativo e associativo',
          code: `a, b, c = GCounter("a"), GCounter("b"), GCounter("c")
a.incrementar(1); b.incrementar(4); c.incrementar(2)
b2 = b.merge(a)
b2.incrementar(1)                     # b viu o 1 de a e incrementou de novo
ab, ba = a.merge(b2), b2.merge(a)
assert ab.contagens == ba.contagens, f"comutativa: {ab.contagens} != {ba.contagens}"
esq = a.merge(b2).merge(c)
dir = a.merge(b2.merge(c))
assert esq.contagens == dir.contagens and esq.valor() == 8, f"associativa: {esq.contagens} / {dir.contagens}"`,
        },
        {
          name: 'PN-Counter: incrementa, decrementa e faz merge',
          code: `sp, dub = PNCounter("sp"), PNCounter("dub")
sp.incrementar(5)
dub.decrementar(2)
dub.incrementar(1)
m = sp.merge(dub)
assert m.valor() == 4, f"5 - 2 + 1 = 4, veio {m.valor()}"
assert dub.merge(sp).valor() == 4
neg = PNCounter("x")
neg.decrementar(3)
assert neg.valor() == -3, "PN-Counter pode ficar negativo"
try:
    neg.decrementar(-1)
    assert False, "decrementar(-1) deveria lançar ValueError"
except ValueError:
    pass`,
        },
        {
          name: 'propriedades ACI em estados aleatórios (G-Counter)',
          hidden: true,
          code: `import random
rnd = random.Random(7)

def aleatorio():
    c = GCounter(rnd.choice("abc"))
    c.contagens = {no: rnd.randint(1, 9) for no in rnd.sample("abcd", rnd.randint(0, 4))}
    return c

def est(c):
    return {k: v for k, v in c.contagens.items() if v}

for _ in range(200):
    a, b, c = aleatorio(), aleatorio(), aleatorio()
    assert est(a.merge(b)) == est(b.merge(a)), f"não é comutativo: {est(a)} e {est(b)}"
    assert est(a.merge(b).merge(c)) == est(a.merge(b.merge(c))), "não é associativo"
    assert est(a.merge(a)) == est(a), f"não é idempotente: {est(a)}"`,
        },
        {
          name: 'propriedades ACI em estados aleatórios (PN-Counter)',
          hidden: true,
          code: `import random
rnd = random.Random(99)

def aleatorio():
    c = PNCounter(rnd.choice("abc"))
    c.p.contagens = {no: rnd.randint(1, 9) for no in rnd.sample("abc", rnd.randint(0, 3))}
    c.n.contagens = {no: rnd.randint(1, 9) for no in rnd.sample("abc", rnd.randint(0, 3))}
    return c

def est(c):
    return ({k: v for k, v in c.p.contagens.items() if v}, {k: v for k, v in c.n.contagens.items() if v})

for _ in range(200):
    a, b, c = aleatorio(), aleatorio(), aleatorio()
    assert est(a.merge(b)) == est(b.merge(a)), "PN-Counter: não é comutativo"
    assert est(a.merge(b).merge(c)) == est(a.merge(b.merge(c))), "PN-Counter: não é associativo"
    assert est(a.merge(a)) == est(a), "PN-Counter: não é idempotente"
    assert a.merge(b).no == a.no`,
        },
        {
          name: 'convergência: gossip fora de ordem, com duplicatas, entre 3 regiões',
          hidden: true,
          code: `import random
rnd = random.Random(42)
nos = ["sp", "dub", "tok"]
reps = {n: PNCounter(n) for n in nos}
esperado = 0
for _ in range(400):
    n = rnd.choice(nos)
    sorteio = rnd.random()
    if sorteio < 0.4:
        k = rnd.randint(1, 3)
        reps[n].incrementar(k)
        esperado += k
    elif sorteio < 0.6:
        k = rnd.randint(1, 3)
        reps[n].decrementar(k)
        esperado -= k
    else:
        reps[n] = reps[n].merge(reps[rnd.choice(nos)])     # gossip: pode repetir, pode ser consigo
for _ in range(2):                                          # anti-entropia final
    for n in nos:
        for o in nos:
            reps[n] = reps[n].merge(reps[o])
valores = {n: r.valor() for n, r in reps.items()}
assert set(valores.values()) == {esperado}, f"as réplicas deveriam convergir para {esperado}: {valores}"`,
        },
        {
          name: 'depois do merge, a réplica continua incrementando a própria entrada',
          hidden: true,
          code: `a, b = GCounter("a"), GCounter("b")
a.incrementar(2)
b.incrementar(5)
b = b.merge(a)
b.incrementar(1)
assert b.contagens.get("b") == 6 and b.contagens.get("a") == 2, f"contagens: {b.contagens}"
a = a.merge(b)
assert a.valor() == 8 and a.contagens.get("a") == 2`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('time') || m.imports.includes('datetime'),
          text: 'Você importou `time`/`datetime`. Um G-Counter não precisa de relógio: a ordem entre estados vem do **máximo por nó**, não de timestamps — e é justamente por não depender de relógio que ele não sofre com skew.',
          concept: 'CRDT',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. Cada réplica precisa do seu próprio estado: um contador global compartilhado entre réplicas é exatamente o que um sistema distribuído **não** tem.',
          concept: 'CRDT',
        },
        {
          when: (m, code) => /^ {4}[A-Za-z_]\w*\s*=\s*(\{\}|\[\]|dict\(\)|list\(\))/m.test(code),
          text: 'Há um dicionário/lista criado como **atributo de classe** — ele seria compartilhado por todas as réplicas. Crie o estado no `__init__`.',
          concept: 'Estado por instância',
        },
      ],
      hints: [
        'Em `GCounter.incrementar`: `if n < 0: raise ValueError(...)` e depois `self.contagens[self.no] = self.contagens.get(self.no, 0) + n`. O `valor` é `sum(self.contagens.values())`.',
        'Em `GCounter.merge`, crie `novo = GCounter(self.no)` e percorra a **união** das chaves (`self.contagens.keys() | outro.contagens.keys()`), guardando o `max` das duas entradas (`.get(no, 0)`).',
        'No `PNCounter`, delegue tudo: `decrementar` é `self.n.incrementar(n)`, `valor` é `self.p.valor() - self.n.valor()`, e o `merge` cria `PNCounter(self.no)` com `novo.p = self.p.merge(outro.p)` e `novo.n = self.n.merge(outro.n)`.',
      ],
      solution: `class GCounter:
    """Contador que só cresce. Cada nó incrementa apenas a sua própria entrada."""

    def __init__(self, no):
        self.no = no                 # id desta réplica
        self.contagens = {}          # nó -> incrementos feitos POR ESSE nó

    def incrementar(self, n=1):
        if n < 0:
            raise ValueError("G-Counter só cresce")
        self.contagens[self.no] = self.contagens.get(self.no, 0) + n

    def valor(self):
        return sum(self.contagens.values())

    def merge(self, outro):
        novo = GCounter(self.no)
        for no in self.contagens.keys() | outro.contagens.keys():
            novo.contagens[no] = max(self.contagens.get(no, 0), outro.contagens.get(no, 0))
        return novo


class PNCounter:
    """Contador que sobe e desce: dois G-Counters (P e N)."""

    def __init__(self, no):
        self.no = no
        self.p = GCounter(no)        # incrementos
        self.n = GCounter(no)        # decrementos

    def incrementar(self, n=1):
        self.p.incrementar(n)

    def decrementar(self, n=1):
        self.n.incrementar(n)        # decrementar = incrementar o contador de descidas

    def valor(self):
        return self.p.valor() - self.n.valor()

    def merge(self, outro):
        novo = PNCounter(self.no)
        novo.p = self.p.merge(outro.p)
        novo.n = self.n.merge(outro.n)
        return novo
`,
      solutionExplanation: 'Cada entrada do G-Counter tem **um único escritor** (o próprio nó), então o maior valor visto de uma entrada é sempre o mais novo — por isso o merge é o **máximo por nó**. O `max` é comutativo, associativo e idempotente, e daí vem a convergência: o teste de gossip reordena, agrupa e duplica estados à vontade, e as três regiões terminam com o mesmo valor. O `merge` devolve um objeto novo e preserva o `no` de `self`, para que a réplica continue incrementando a sua própria entrada. O PN-Counter não inventa nada: são dois G-Counters, e a subtração só acontece na leitura (`P − N`) — o estado continua sempre subindo, que é o que mantém o merge seguro.',
    },
    {
      type: 'open',
      id: 'dist-crdt-q5',
      concept: 'Limites dos CRDTs',
      say: 'Para fechar, uma proposta que parece genial numa reunião de arquitetura. Você aprovaria?',
      prompt: 'Um evento tem **100 ingressos**. O time quer vender em **3 regiões ativas** (multi-líder) e guardar o estoque num **PN-Counter**: cada venda faz `decrementar()` local e a região só vende se `valor() > 0`. "CRDT converge, então está resolvido." O que pode dar errado, e o que você proporia?',
      minWords: 30,
      rubric: [
        { label: 'Vendas **concorrentes** em regiões diferentes podem vender **mais de 100** (estoque negativo)', keywords: ['mais de 100', 'acima de 100', 'alem de 100', 'mais ingressos', 'vender mais', 'vende mais', 'overselling', 'oversell', 'negativ', 'abaixo de zero', 'menor que zero', 'concorrent', 'ao mesmo tempo', 'simultane'], concept: 'Limites dos CRDTs', why: 'Cada região vê o estoque local positivo e vende o "último" ingresso ao mesmo tempo; o merge soma todos os decrementos e o valor fica negativo.' },
        { label: 'Explica que convergir não garante **invariante** — isso exige **coordenação**', keywords: ['invariant', 'coordena', 'consenso', 'calm', 'monoton', 'nao garante', 'converg'], concept: 'Teorema CALM', why: '"Estoque ≥ 0" não é monotônico: decidir vender depende de saber que ninguém mais vendeu. Pelo CALM, isso precisa de coordenação.' },
        { label: 'Propõe uma alternativa: **dividir a cota** entre regiões (escrow) ou um **dono único/consenso** para o estoque', keywords: ['cota', 'quota', 'escrow', 'bounded', 'dividir', 'divid', 'reparti', 'fatia', 'reserv', 'lider', 'dono unico', 'uma regiao', 'regiao dona', 'consenso', 'lock', 'transac'], concept: 'Bounded counter', why: 'Com escrow, cada região vende só a sua cota (ex.: 34/33/33) e pede cota emprestada às outras; ou o estoque mora numa região líder/numa transação com consenso.' },
        { label: 'Discute o **trade-off**: latência/disponibilidade ou compensação (cancelar e reembolsar)', keywords: ['latenc', 'disponib', 'particao', 'trade', 'custo', 'compens', 'reembols', 'cancel', 'desculpa', 'lista de espera'], concept: 'Trade-offs de consistência', why: 'Coordenação custa latência e disponibilidade numa partição; a alternativa de negócio é aceitar o overselling raro e compensar.' },
      ],
      modelAnswer: `O PN-Counter **converge**, mas convergir não garante a **invariante** "vendidos ≤ 100". Com o estoque em 1, as três regiões podem vender **ao mesmo tempo**: cada uma vê \`valor() > 0\` localmente, decrementa, e quando o merge chega o valor fica **negativo** — vendemos mais de 100 ingressos. Pelo teorema CALM, "estoque ≥ 0" não é monotônico: decidir vender depende de saber que ninguém mais vendeu, e isso exige **coordenação**.

Eu proporia **dividir a cota** entre as regiões (*escrow* / *bounded counter*): 34, 33 e 33 ingressos, cada região vende só a sua cota sem falar com ninguém e, quando acaba, pede cota emprestada às outras. Outra opção é deixar o estoque com um **dono único** (uma região líder ou um banco com consenso) e aceitar a latência extra só na compra. O **trade-off** é latência e disponibilidade numa partição; se o negócio preferir, dá para aceitar um overselling raro e **compensar** (cancelar, reembolsar e pedir desculpas).`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Recapitulando: do **linearizável** ao **eventual**, cada degrau troca garantia por disponibilidade — e as **garantias de sessão** consertam barato o que o usuário vê.',
        '**LWW** converge perdendo dados; **CRDTs** convergem sem perder, graças ao merge ACI. Mas invariantes ainda pedem coordenação. Próxima parada: **mensageria**!',
      ],
      board: null,
    },
  ],
});
