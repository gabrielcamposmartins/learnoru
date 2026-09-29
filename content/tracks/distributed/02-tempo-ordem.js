Game.registerModule('distributed', {
  id: 'tempo-ordem',
  title: 'Tempo e ordem: relógios físicos e lógicos',
  kind: 'lesson',
  level: 3,
  order: 2,
  unit: 'fundamentos',
  summary: 'Relógios de máquinas diferentes discordam: skew, drift, NTP, monotonic × wall clock, *happens-before*, relógios de Lamport, vector clocks e HLC.',
  concepts: ['Clock skew', 'Happens-before', 'Relógio de Lamport', 'Vector clock', 'Hybrid logical clock'],
  takeaways: [
    'Relógios físicos **derivam** (drift, medido em ppm) e discordam entre máquinas (**skew**). O NTP reduz a diferença, mas pode fazer o relógio **pular para trás**.',
    'Para medir duração, timeouts e leases, use o relógio **monotônico** (`time.monotonic()`); o de parede (`time.time()`) serve para datas — e não ordena eventos de máquinas diferentes.',
    '*Happens-before* é a ordem **causal**: mesmo processo, envio → recebimento e transitividade. O que não está ligado por ela é **concorrente**.',
    '**Lamport**: `a → b` implica `L(a) < L(b)`, mas não o contrário. Com desempate pelo id do nó, dá uma **ordem total** consistente com a causalidade.',
    '**Vector clocks** capturam a causalidade exata — antes, depois ou **concorrente** — e por isso detectam conflitos (*siblings*). O **HLC** junta tempo físico e contador lógico.',
  ],
  glossary: [
    { term: 'Clock skew', aliases: ['clock skews', 'skew de relógio', 'desvio de relógio', 'clock drift'], definition: 'Diferença entre os relógios de duas máquinas **no mesmo instante**. Não confunda com *drift* (deriva): a **taxa** com que um relógio se afasta do tempo real, medida em ppm — 20 ppm ≈ 1,7 s por dia.' },
    { term: 'Relógio monotônico', aliases: ['relógios monotônicos', 'monotonic clock', 'monotonic clocks'], definition: 'Relógio que **nunca anda para trás**, nem quando o NTP ajusta a hora. Serve para medir intervalos e prazos **na mesma máquina**; o valor absoluto não significa nada e não é comparável entre máquinas. Em Python: `time.monotonic()`.' },
    { term: 'Happens-before', aliases: ['happened-before', 'aconteceu-antes'], definition: 'Ordem causal de Lamport (1978): a → b se estão no mesmo processo e a veio antes, se a é o envio e b o recebimento da mesma mensagem, ou por transitividade. Se nem a → b nem b → a, os eventos são **concorrentes**.' },
    { term: 'Relógio de Lamport', aliases: ['relógios de Lamport', 'Lamport clock', 'Lamport clocks', 'Lamport timestamp', 'Lamport timestamps', 'carimbo de Lamport', 'carimbos de Lamport'], definition: 'Contador por processo: incrementa a cada evento e, ao receber uma mensagem, vira max(local, recebido) + 1. Garante que a → b implica L(a) < L(b) — mas não detecta concorrência.' },
    { term: 'Vector clock', aliases: ['vector clocks', 'relógio vetorial', 'relógios vetoriais'], definition: 'Um contador **por nó**, levado em cada mensagem e mesclado pelo máximo elemento a elemento. Comparando dois vetores, dá para saber se um evento veio antes, depois ou é **concorrente** — base da detecção de conflitos no Dynamo e no Riak.' },
    { term: 'Hybrid logical clock', aliases: ['hybrid logical clocks', 'HLC', 'relógio lógico híbrido'], definition: 'Carimbo (tempo físico, contador lógico): fica próximo da hora real, mas respeita a causalidade mesmo com skew entre máquinas. Usado por CockroachDB e YugabyteDB.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Pergunta aparentemente boba: se dois servidores gravam a mesma chave, **qual escrita veio por último**? "Fácil, é só comparar o horário!"… e é aí que o dado some.',
        'Cada máquina tem o **seu** relógio, e eles não concordam. Um atraso de 80 ms basta para a escrita mais nova perder.',
      ],
      board: {
        title: 'Last-write-wins com relógio de parede',
        md: `\`\`\`text
 tempo real ───────────────────────────────────────────────▶
 nó A (relógio certo)     grava x = 1 → carimbo 10:00:05.000
 nó B (80 ms atrasado)       grava x = 2 → carimbo 10:00:04.950
                             (30 ms DEPOIS de A, no tempo real)

 réplica com "maior carimbo vence":  x = 1   ← a escrita mais nova sumiu
\`\`\`

Nenhum erro, nenhum log: a escrita de B **desaparece em silêncio**. É o risco do *last-write-wins* (LWW) com relógio de parede — a estratégia padrão de bancos como o Cassandra.

> [!atencao] "Mas os servidores usam NTP!" Sim — e ainda assim a diferença entre eles vai de frações de milissegundo a segundos (ou muito mais, se o NTP quebrar e ninguém perceber). Quanto mais próximas as escritas concorrentes, maior o risco.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Por que os relógios discordam? O relógio do computador é um **cristal de quartzo** cuja frequência varia com a temperatura. Ele **deriva**.',
        'O **NTP** corrige a deriva sincronizando pela rede — mas a rede tem latência variável, então a correção também é aproximada.',
      ],
      board: {
        title: 'Skew, drift e NTP',
        md: `| Termo | O que é | Ordem de grandeza |
|---|---|---|
| **Drift** (deriva) | a velocidade com que um relógio se afasta do real | quartzo comum: 10–50 ppm ≈ 1–4 s por dia |
| **Skew** (desvio) | a diferença entre dois relógios num instante | com NTP: ~1 ms na LAN, dezenas de ms pela internet |
| **Step** | o NTP **salta** o relógio — inclusive para trás | erro grande (no ntpd, > 128 ms por padrão) |
| **Slew** | o NTP acelera ou freia o relógio aos poucos | ajuste padrão para erros pequenos |

\`\`\`text
 cliente                        servidor NTP
   t0 ──── requisição ─────────▶ t1
   t3 ◀─── resposta ──────────── t2

 atraso de ida e volta   δ = (t3 − t0) − (t2 − t1)
 diferença estimada      θ = ((t1 − t0) + (t2 − t3)) / 2
\`\`\`

O NTP supõe que ida e volta demoram **o mesmo tempo**. Se a rota for assimétrica, o erro pode chegar a **metade do round-trip** — e ninguém percebe.

> [!sabia] Também existe o **segundo bissexto** (*leap second*): às vezes o dia UTC tem um 23:59:60. Em 2012, ele fez servidores Linux pelo mundo travarem processos Java e MySQL a 100% de CPU. Por isso Google, AWS e outros fazem o *leap smear*: espalham o segundo extra ao longo de horas. Em 2022, decidiu-se **abolir** o segundo bissexto até 2035.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Consequência prática: o relógio **de parede** pode pular para trás. Meça uma duração com ele e um ajuste do NTP no meio dá tempo **negativo** — ou um timeout que nunca dispara.',
        'Para intervalos existe o relógio **monotônico**: ele não sabe que horas são, mas nunca volta.',
      ],
      board: {
        title: 'Wall clock × monotonic em Python',
        code: `import time

# ✗ ERRADO para medir duração: time.time() segue o relógio de parede
inicio = time.time()
processar()
duracao = time.time() - inicio          # o NTP deu um "step" para trás? duração negativa

# ✓ CERTO: monotônico — nunca anda para trás
inicio = time.monotonic()
processar()
duracao = time.monotonic() - inicio

# ✓ benchmarks: time.perf_counter() — monotônico e com mais resolução
# ✓ prazos, timeouts e leases:  prazo = time.monotonic() + 5.0
# ✓ "quando aconteceu" (logs, auditoria, telas): time.time() / datetime.now(timezone.utc)`,
        caption: 'Wall clock é para **datas**; monotônico é para **intervalos na mesma máquina** — seu valor absoluto não significa nada e não é comparável entre máquinas. Nenhum dos dois ordena eventos de máquinas diferentes.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Se não dá para confiar no relógio, como ordenar eventos? Em 1978, Leslie Lamport percebeu que muitas vezes não precisamos de **horário** — precisamos de **causalidade**.',
        'Ele definiu a relação **happens-before** (→): o que pode ter **influenciado** o quê. O que não está ligado por ela é **concorrente**, diga o relógio o que disser.',
      ],
      board: {
        title: 'Happens-before (→)',
        md: `\`\`\`text
 P1 ──a─────b───────────────────────────▶
             ╲ m1
 P2 ──────────c──────d──────────────────▶
                      ╲ m2
 P3 ──e────────────────f────────────────▶
\`\`\`

**a → b** quando:
1. **mesmo processo**: a acontece antes de b (a → b, c → d, e → f);
2. **mensagem**: a é o envio e b o recebimento da mesma mensagem (b → c por m1, d → f por m2);
3. **transitividade**: se a → b e b → c, então a → c (logo, a → f).

**Concorrentes (a ∥ b)**: nem a → b nem b → a. No diagrama, **e** é concorrente com a, b, c e d — nenhuma cadeia de mensagens liga um ao outro. Não importa o que os relógios de P1 e P3 digam: não existe uma ordem "verdadeira" entre eles.

> [!sabia] Lamport conta que a ideia veio da **relatividade restrita**: dois eventos entre os quais nenhum sinal pode ter viajado não têm uma ordem absoluta — observadores diferentes podem vê-los em ordens diferentes. O artigo *Time, Clocks, and the Ordering of Events in a Distributed System* (1978) é um dos mais citados da computação e ajudou a render a ele o Prêmio Turing de 2013.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora o truque: um **relógio de Lamport** é só um contador inteiro por processo, com três regras. Nada de quartzo, nada de NTP.',
        'Ele garante: se a → b, então L(a) < L(b). Mas cuidado com a volta: L(a) < L(b) **não** prova que a → b.',
      ],
      board: {
        title: 'Relógio de Lamport',
        md: `**Regras** (cada processo tem um contador L, começando em 0):
1. **evento local**: L = L + 1
2. **enviar**: L = L + 1, e o valor de L vai junto na mensagem
3. **receber** uma mensagem com carimbo t: L = max(L, t) + 1

\`\`\`text
 P1 ──a(1)──b(2)────────────────────────────▶
              ╲ m1 carrega 2
 P2 ───────────c(3)───d(4)──────────────────▶
                        ╲ m2 carrega 4
 P3 ──e(1)───────────────f(5)───────────────▶

 c = max(0, 2) + 1 = 3        f = max(1, 4) + 1 = 5
\`\`\`

**Ordem total**: ordene por (L, id do nó) → a(1, P1), e(1, P3), b(2, P1), c(3, P2), d(4, P2), f(5, P3). Ela **respeita a causalidade**, e o desempate por id é arbitrário — mas igual em todos os nós, sem precisar conversar. É a base da exclusão mútua de Lamport e do *total order broadcast*.

> [!atencao] L(e) = 1 < L(b) = 2, mas **e não aconteceu antes de b**: são concorrentes. O relógio de Lamport **perde** a informação de concorrência. Para recuperá-la, precisamos de um vetor.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O **vector clock** guarda um contador **por nó**. Cada nó incrementa só a própria posição e, ao receber uma mensagem, faz o **máximo elemento a elemento**.',
        'Assim, comparar dois carimbos diz exatamente se um evento veio antes, depois ou se são **concorrentes** — sem nenhum relógio físico.',
      ],
      board: {
        title: 'Vector clocks',
        md: `**Regras** (nó *i*, vetor V):
1. evento local ou envio: V[i] += 1 (no envio, o vetor vai junto na mensagem)
2. ao receber W: V = max(V, W) elemento a elemento; depois V[i] += 1

| Comparando V e W | Conclusão |
|---|---|
| V[k] ≤ W[k] em **todas** as posições, e V ≠ W | V **antes** de W |
| W[k] ≤ V[k] em todas as posições, e V ≠ W | V **depois** de W |
| V = W | mesmo evento (mesma versão) |
| V é menor em alguma posição **e** maior em outra | **concorrentes** (V ∥ W) |

\`\`\`text
 carrinho gravado via nó A:  {A: 2, B: 1}   ["livro", "caneta"]
 carrinho gravado via nó B:  {A: 1, B: 2}   ["livro", "café"]

 A ganha na posição A, B ganha na posição B → CONCORRENTES → conflito!
 o banco guarda as duas versões (siblings) e o app as mescla:
 ["livro", "caneta", "café"], gravado com um vetor que domina as duas: {A: 3, B: 2}
\`\`\`

> [!sabia] Vector clocks foram inventados de forma independente por **Colin Fidge** e **Friedemann Mattern**, em 1988. O preço é o tamanho: um contador por nó que já escreveu. O Riak sofria com *sibling explosion* e migrou para **dotted version vectors**, uma variante que distingue melhor escritas concorrentes que passam pelo mesmo servidor.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Lógico ou físico? Muitos bancos modernos querem os dois: carimbos **perto da hora real** (para consultar "o estado às 14h") que **respeitem a causalidade**.',
        'É o **Hybrid Logical Clock**: o tempo físico na frente e um contador lógico para desempatar quando os relógios discordam.',
      ],
      board: {
        title: 'HLC, TrueTime e quando usar cada um',
        md: `**Hybrid Logical Clock** — carimbo \`(l, c)\`: \`l\` acompanha o maior tempo físico já visto e \`c\` é um contador que desempata dentro do mesmo \`l\`.
- evento local: se o relógio físico passou de \`l\`, então \`l = físico\` e \`c = 0\`; senão, \`c += 1\`;
- ao receber \`(l', c')\`: \`l\` vira o máximo entre \`l\`, \`l'\` e o físico, e \`c\` se ajusta para o carimbo ficar **maior** que os dois lados.
- Resultado: respeita a causalidade como Lamport, mas fica a no máximo ~um *skew* da hora real. Usado por **CockroachDB** e **YugabyteDB**.

| Relógio | Respeita a causalidade? | Detecta concorrência? | Perto da hora real? | Tamanho |
|---|---|---|---|---|
| Parede (NTP) | não | não | sim | 1 número |
| Lamport | sim | não | não | 1 número |
| Vector clock | sim | **sim** | não | 1 contador por nó |
| HLC | sim | não | sim | 1 número + contador |

> [!dica] O **Spanner**, do Google, vai por outro caminho: em vez de ignorar a incerteza do relógio, ele a **mede**. A API **TrueTime** (GPS + relógios atômicos) devolve um intervalo \`[mais cedo, mais tarde]\` de poucos milissegundos, e cada commit **espera** o intervalo passar (*commit-wait*) antes de ficar visível — assim a ordem dos carimbos bate com a ordem real.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo implementar um relógio de Lamport e comparar vector clocks.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dist-time-q1',
      concept: 'Relógio monotônico',
      say: 'Um bug que aparece "de vez em quando" em produção…',
      prompt: 'Um serviço mede a duração de cada requisição com `inicio = time.time()` … `duracao = time.time() - inicio`. Raramente, aparecem durações **negativas** nas métricas. Qual a causa mais provável e a correção?',
      options: [
        { text: 'O NTP ajustou o relógio de parede **para trás** no meio da medição; use `time.monotonic()` (ou `perf_counter()`) para intervalos.', correct: true, why: 'Isso. `time.time()` segue o relógio de parede, que pode dar *step* para trás; o monotônico nunca volta.' },
        { text: 'O horário de verão mudou no meio da requisição; use `datetime.now()` com fuso horário.', why: '`time.time()` conta segundos desde a época em **UTC**: fuso e horário de verão não o afetam. E `datetime.now()` também é relógio de parede.' },
        { text: 'Imprecisão de ponto flutuante ao subtrair dois `float` grandes.', why: 'Um `float` representa timestamps atuais com precisão de sub-microssegundos; arredondamento não produz durações negativas visíveis.' },
        { text: 'Cada núcleo da CPU tem o seu relógio; é preciso um lock ao ler a hora.', why: 'O kernel expõe um relógio consistente entre núcleos; o problema não é concorrência, e um lock não impede o NTP de ajustar a hora.' },
      ],
      explanation: 'Relógio de parede é para **datas** ("quando aconteceu"); relógio monotônico é para **intervalos** ("quanto demorou", "quando expira"). Em Python: `time.monotonic()` para timeouts e leases e `time.perf_counter()` para benchmarks. E nenhum dos dois serve para ordenar eventos entre máquinas — para isso existem os relógios lógicos.',
    },
    {
      type: 'match',
      id: 'dist-time-q2',
      concept: 'Tempo em sistemas distribuídos',
      say: 'Muitos nomes parecidos nesta aula. Associe cada um ao seu significado!',
      prompt: 'Associe cada **termo** à sua **definição**.',
      pairs: [
        { left: 'Clock skew', right: 'Diferença entre dois relógios no mesmo instante' },
        { left: 'Clock drift', right: 'Taxa com que um relógio se afasta do tempo real (em ppm)' },
        { left: 'Relógio monotônico', right: 'Nunca volta; serve para medir intervalos na mesma máquina' },
        { left: 'Happens-before', right: 'Ordem causal: mesmo processo, envio → recebimento e transitividade' },
        { left: 'Eventos concorrentes', right: 'Nenhum dos dois pode ter influenciado o outro' },
        { left: 'Hybrid logical clock', right: 'Tempo físico + contador lógico: perto da hora real e causal' },
      ],
      explanation: '*Drift* é a velocidade com que cada relógio erra; *skew* é o tamanho da discordância num instante — o NTP ataca o skew corrigindo o drift de tempos em tempos. O relógio monotônico resolve a medição de intervalos, não a ordem entre máquinas. *Happens-before* e concorrência são a linguagem dos relógios lógicos, e o HLC tenta unir os dois mundos.',
    },
    {
      type: 'order',
      id: 'dist-time-q3',
      concept: 'Relógio de Lamport',
      say: 'Hora de fazer as contas na mão. Papel e caneta ajudam!',
      prompt: `Três nós com relógios de Lamport, todos começando em 0 (lembre: **enviar também é um evento**):

- **A**: faz um evento local; depois envia **m1** para B.
- **B**: faz um evento local; depois recebe **m1**; depois envia **m2** para C.
- **C**: recebe **m2**.

Ordene os eventos pela **ordem total de Lamport**: carimbo crescente e, no empate, o nome do nó (A < B < C).`,
      items: [
        'A: evento local',
        'B: evento local',
        'A: envia m1',
        'B: recebe m1',
        'B: envia m2',
        'C: recebe m2',
      ],
      explanation: 'Carimbos: A = 1 (local) e 2 (envio de m1); B = 1 (local), max(1, 2) + 1 = **3** (recebe m1) e 4 (envio de m2); C = max(0, 4) + 1 = **5**. Os dois eventos locais empatam em 1, e o desempate pelo nome põe A antes de B — uma escolha arbitrária, mas **igual em todos os nós**. Repare que a ordem total respeita cada seta causal (envio antes do recebimento), mas também ordena eventos concorrentes, como os dois eventos locais.',
    },
    {
      type: 'code',
      id: 'dist-time-q4',
      concept: 'Relógio de Lamport',
      title: 'Relógio de Lamport e ordem total',
      say: 'Agora é com você: implemente o relógio de Lamport. Os testes embaralham a entrega das mensagens, como uma rede de verdade.',
      prompt: `Implemente o relógio de Lamport de um nó e a ordem total dos eventos.

\`RelogioLamport()\` começa com \`tempo = 0\` e tem três métodos — **todos** devolvem o novo \`tempo\`:
- \`evento_local()\` — um evento qualquer no próprio nó: incrementa.
- \`enviar()\` — enviar **também é um evento**: incrementa e devolve o carimbo que vai na mensagem.
- \`receber(carimbo)\` — \`tempo = max(tempo, carimbo) + 1\`.

\`ordem_total(eventos)\` recebe uma lista de tuplas \`(carimbo, no, descricao)\` e devolve só as **descrições**, ordenadas por carimbo e, no empate, pelo nome do nó.`,
      starter: `class RelogioLamport:
    def __init__(self):
        self.tempo = 0

    def evento_local(self):
        # TODO: um evento qualquer no próprio nó
        pass

    def enviar(self):
        # TODO: enviar também é um evento; devolva o carimbo da mensagem
        pass

    def receber(self, carimbo):
        # TODO: max(local, recebido) + 1
        pass


def ordem_total(eventos):
    # eventos: lista de (carimbo, no, descricao)
    # TODO: devolva as descrições em ordem de (carimbo, nó)
    return []
`,
      tests: [
        {
          name: 'evento local e envio incrementam',
          code: `r = RelogioLamport()
assert r.tempo == 0
assert r.evento_local() == 1
assert r.enviar() == 2, "enviar também é um evento: incrementa"
assert r.tempo == 2`,
        },
        {
          name: 'receber um carimbo "do futuro": max + 1',
          code: `r = RelogioLamport()
r.evento_local()
assert r.receber(5) == 6, "max(1, 5) + 1 = 6"
assert r.evento_local() == 7`,
        },
        {
          name: 'receber um carimbo "do passado" ainda avança',
          code: `r = RelogioLamport()
for _ in range(4):
    r.evento_local()
assert r.receber(2) == 5, "max(4, 2) + 1 = 5 — receber também é um evento"`,
        },
        {
          name: 'ordem total: carimbo e, no empate, o nó',
          expr: 'ordem_total([(2, "A", "a2"), (1, "B", "b1"), (1, "A", "a1"), (3, "B", "b3")])',
          expected: '["a1", "b1", "a2", "b3"]',
        },
        {
          name: 'receber um carimbo igual ao local',
          hidden: true,
          code: `r = RelogioLamport()
r.evento_local()
r.evento_local()
assert r.receber(2) == 3, "max(2, 2) + 1 = 3"`,
        },
        {
          name: 'simulação com rede que reordena: todo recebimento é maior que o envio',
          hidden: true,
          code: `import random
rnd = random.Random(2024)
nos = {n: RelogioLamport() for n in "ABC"}
ultimo = {n: 0 for n in "ABC"}
em_transito = []
for _ in range(300):
    n = rnd.choice("ABC")
    x = rnd.random()
    if x < 0.3:
        t = nos[n].evento_local()
    elif x < 0.65 or not em_transito:
        t = nos[n].enviar()
        em_transito.append((t, rnd.choice([d for d in "ABC" if d != n])))
    else:
        t_envio, n = em_transito.pop(rnd.randrange(len(em_transito)))
        t = nos[n].receber(t_envio)
        assert t > t_envio, f"o recebimento ({t}) precisa ter carimbo maior que o envio ({t_envio})"
    assert t > ultimo[n], f"o relógio de {n} não avançou: {ultimo[n]} -> {t}"
    assert nos[n].tempo == t, "o valor devolvido deve ser o novo tempo"
    ultimo[n] = t`,
        },
        {
          name: 'ordem total não depende da ordem de entrada',
          hidden: true,
          code: `eventos = [(3, "C", "c3"), (1, "C", "c1"), (2, "B", "b2"), (1, "A", "a1"), (2, "A", "a2"), (3, "A", "a3")]
esperado = ["a1", "c1", "a2", "b2", "a3", "c3"]
assert ordem_total(eventos) == esperado, f"obtido {ordem_total(eventos)}"
assert ordem_total(list(reversed(eventos))) == esperado
assert ordem_total([]) == []`,
        },
        {
          name: 'cada nó tem o seu relógio',
          hidden: true,
          code: `a, b = RelogioLamport(), RelogioLamport()
a.evento_local()
a.evento_local()
assert b.tempo == 0 and b.evento_local() == 1, "o estado vazou entre relógios"`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('time') || m.imports.includes('datetime'),
          text: 'Você importou `time`/`datetime`. O relógio de Lamport **não usa** o relógio físico: é só um contador — a hora da máquina não entra em nenhuma das regras. É justamente isso que o torna imune a skew e ao NTP.',
          concept: 'Relógio de Lamport',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. Cada nó tem o **seu** contador — o estado do relógio deve viver na instância.',
          concept: 'Relógio de Lamport',
        },
      ],
      hints: [
        '`evento_local` e `enviar` fazem a mesma coisa: `self.tempo += 1` e `return self.tempo`. A diferença é só o que o chamador faz com o valor (no envio, ele vai na mensagem).',
        '`receber(carimbo)`: `self.tempo = max(self.tempo, carimbo) + 1` — o `+ 1` existe porque receber também é um evento.',
        '`ordem_total`: `sorted(eventos, key=lambda e: (e[0], e[1]))` e depois fique só com a descrição: `[desc for _, _, desc in ordenados]`.',
      ],
      solution: `class RelogioLamport:
    def __init__(self):
        self.tempo = 0

    def evento_local(self):
        self.tempo += 1
        return self.tempo

    def enviar(self):
        self.tempo += 1                  # enviar é um evento
        return self.tempo                # carimbo que vai na mensagem

    def receber(self, carimbo):
        self.tempo = max(self.tempo, carimbo) + 1
        return self.tempo


def ordem_total(eventos):
    ordenados = sorted(eventos, key=lambda e: (e[0], e[1]))    # (carimbo, nó)
    return [descricao for _, _, descricao in ordenados]
`,
      solutionExplanation: 'O relógio de Lamport é só um contador com três regras: todo evento incrementa, a mensagem carrega o carimbo e o recebimento pula para `max(local, recebido) + 1`. O teste de simulação embaralha a entrega das mensagens (a rede reordena!) e verifica a garantia central: **o recebimento sempre tem carimbo maior que o envio** — ou seja, se a → b, então L(a) < L(b). A `ordem_total` desempata pelo nome do nó: como os carimbos de um mesmo nó nunca se repetem, o par (carimbo, nó) é único, e todos os nós que conhecem os mesmos eventos chegam à **mesma ordem** sem conversar. É a ideia por trás do *total order broadcast* e da exclusão mútua de Lamport.',
    },
    {
      type: 'mcq',
      id: 'dist-time-q5',
      concept: 'Lamport × causalidade',
      say: 'Esta cai muito em entrevista — e muita gente escorrega.',
      prompt: 'Dois eventos têm carimbos de Lamport **L(x) = 3** e **L(y) = 7**. O que dá para afirmar com certeza?',
      options: [
        { text: '**y não aconteceu antes de x** — mas x pode ter acontecido antes de y **ou** os dois podem ser concorrentes.', correct: true, why: 'Pela contrapositiva da garantia: se y → x, teríamos L(y) < L(x). Como 7 > 3, y não aconteceu antes de x. Já L(x) < L(y) não prova causalidade.' },
        { text: 'x aconteceu antes de y (x → y), porque 3 < 7.', why: 'É a pegadinha clássica: a garantia é só a → b ⇒ L(a) < L(b). Um nó muito ativo acumula carimbos altos sem nunca ter falado com o outro.' },
        { text: 'x e y são concorrentes, porque os carimbos não são consecutivos.', why: 'A distância entre carimbos não significa nada: pode haver uma cadeia de mensagens ligando os dois, ou não.' },
        { text: 'Nada: carimbos de Lamport de nós diferentes não são comparáveis.', why: 'São comparáveis, sim — é assim que se monta a ordem total. Só não dá para concluir causalidade a partir de L(x) < L(y).' },
      ],
      explanation: 'O relógio de Lamport é **consistente** com a causalidade (a → b ⇒ L(a) < L(b)), mas não a **caracteriza**: a volta não vale. Para decidir entre "antes" e "concorrente", é preciso mais informação — um **vector clock**, em que V(a) < V(b) se e somente se a → b.',
    },
    {
      type: 'code',
      id: 'dist-time-q6',
      concept: 'Vector clock',
      title: 'Comparar e mesclar vector clocks',
      say: 'Último desafio: vector clocks, do jeito que um banco no estilo Dynamo usa para detectar conflitos.',
      prompt: `Aqui, vector clocks são dicionários \`{nó: contador}\`, e um nó **ausente vale 0** (\`{"A": 1}\` é igual a \`{"A": 1, "B": 0}\`). Implemente:

- \`comparar(v, w)\` → \`"antes"\` (v aconteceu antes de w), \`"depois"\`, \`"igual"\` ou \`"concorrente"\`.
- \`mesclar(v, w)\` → um dicionário **novo** com o máximo de cada posição (sem modificar \`v\` nem \`w\`).
- \`siblings(versoes)\` → recebe uma lista de \`(valor, vetor)\` lidas de réplicas diferentes e devolve só as versões que **não são ancestrais** de nenhuma outra — as concorrentes, que o app precisa resolver —, na ordem de entrada. Versões com vetores **iguais** aparecem uma vez só (a primeira).

Exemplo: \`[("x", {"A": 1}), ("y", {"A": 2}), ("z", {"A": 1, "B": 1})]\` → \`[("y", {"A": 2}), ("z", {"A": 1, "B": 1})]\`: \`{"A": 1}\` é ancestral das outras duas, que são concorrentes entre si.`,
      starter: `def comparar(v, w):
    # TODO: "antes", "depois", "igual" ou "concorrente" (ausente vale 0)
    pass


def mesclar(v, w):
    # TODO: novo dict com o máximo de cada posição
    pass


def siblings(versoes):
    # TODO: descarte as versões que são ancestrais de outra (e as repetidas)
    return versoes
`,
      tests: [
        {
          name: 'antes e depois',
          code: `assert comparar({"A": 1, "B": 2}, {"A": 2, "B": 2}) == "antes"
assert comparar({"A": 2, "B": 2}, {"A": 1, "B": 2}) == "depois"`,
        },
        { name: 'concorrentes', expr: 'comparar({"A": 2, "B": 1}, {"A": 1, "B": 2})', expected: '"concorrente"' },
        { name: 'mesclar pega o máximo de cada posição', expr: 'mesclar({"A": 2, "B": 1}, {"A": 1, "B": 3, "C": 1})', expected: '{"A": 2, "B": 3, "C": 1}' },
        {
          name: 'siblings descarta ancestrais',
          expr: 'siblings([("x", {"A": 1}), ("y", {"A": 2}), ("z", {"A": 1, "B": 1})])',
          expected: '[("y", {"A": 2}), ("z", {"A": 1, "B": 1})]',
        },
        {
          name: 'nó ausente vale 0',
          hidden: true,
          code: `assert comparar({"A": 1}, {"A": 1, "B": 0}) == "igual"
assert comparar({}, {"A": 1}) == "antes"
assert comparar({"B": 1}, {"A": 1}) == "concorrente"
assert comparar({}, {}) == "igual"`,
        },
        {
          name: 'mesclar não modifica as entradas',
          hidden: true,
          code: `v, w = {"A": 1}, {"B": 2}
m = mesclar(v, w)
assert m == {"A": 1, "B": 2}, f"obtido {m}"
assert v == {"A": 1} and w == {"B": 2}, "mesclar deve devolver um dicionário NOVO"
m["A"] = 99
assert v == {"A": 1}, "o resultado não pode ser o próprio v"`,
        },
        {
          name: 'o vetor mesclado domina os dois lados',
          hidden: true,
          code: `import random
rnd = random.Random(7)
for _ in range(200):
    v = {n: rnd.randint(0, 3) for n in "ABC" if rnd.random() < 0.8}
    w = {n: rnd.randint(0, 3) for n in "ABCD" if rnd.random() < 0.8}
    m = mesclar(v, w)
    assert comparar(v, m) in ("antes", "igual") and comparar(w, m) in ("antes", "igual"), f"{m} não domina {v} e {w}"
    assert comparar(m, v) in ("depois", "igual")
    if comparar(v, w) == "concorrente":
        assert comparar(v, m) == "antes" and comparar(w, m) == "antes"`,
        },
        {
          name: 'siblings: cadeia, repetidos, vazio e três concorrentes',
          hidden: true,
          code: `assert siblings([("a", {"A": 1}), ("b", {"A": 2}), ("c", {"A": 3})]) == [("c", {"A": 3})]
assert siblings([("x", {"A": 2}), ("x", {"A": 2, "B": 0})]) == [("x", {"A": 2})], "versões iguais aparecem uma vez (a primeira)"
assert siblings([]) == []
tres = [("p", {"A": 1}), ("q", {"B": 1}), ("r", {"C": 1})]
assert siblings(tres) == tres, "três versões concorrentes: todas sobrevivem, na ordem de entrada"`,
        },
        {
          name: 'conflito do carrinho, resolvido pelo app',
          hidden: true,
          code: `v0 = {"A": 1}
va = mesclar(v0, {"A": 2})
vb = mesclar(v0, {"B": 1})
assert comparar(va, vb) == "concorrente"
resolvido = mesclar(va, vb)
resolvido["A"] += 1
assert comparar(va, resolvido) == "antes" and comparar(vb, resolvido) == "antes"
assert siblings([("A2", va), ("B1", vb), ("M", resolvido)]) == [("M", resolvido)]`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('time') || m.imports.includes('datetime'),
          text: 'Você importou `time`/`datetime`. Vector clocks **não usam** relógio físico: a causalidade vem só dos contadores — e é isso que os torna imunes a skew.',
          concept: 'Vector clock',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. Estas funções devem ser **puras**: recebem vetores e devolvem resultados, sem estado escondido.',
          concept: 'Funções puras',
        },
      ],
      hints: [
        'Em `comparar`, percorra a **união** das chaves (`v.keys() | w.keys()`) usando `.get(no, 0)` e descubra se existe alguma posição em que `v` é **menor** e alguma em que é **maior**.',
        'Menor e maior ao mesmo tempo → `"concorrente"`; só menor → `"antes"`; só maior → `"depois"`; nenhum dos dois → `"igual"`. `mesclar` cabe numa *dict comprehension* com `max(v.get(n, 0), w.get(n, 0))`.',
        'Em `siblings`, uma versão sai se `comparar(ela, outra) == "antes"` para alguma outra — ou se for `"igual"` a uma que apareceu **antes** na lista.',
      ],
      solution: `def comparar(v, w):
    nos = v.keys() | w.keys()
    menor = any(v.get(n, 0) < w.get(n, 0) for n in nos)
    maior = any(v.get(n, 0) > w.get(n, 0) for n in nos)
    if menor and maior:
        return "concorrente"
    if menor:
        return "antes"
    if maior:
        return "depois"
    return "igual"


def mesclar(v, w):
    return {n: max(v.get(n, 0), w.get(n, 0)) for n in v.keys() | w.keys()}


def siblings(versoes):
    vivas = []
    for i, (valor, vetor) in enumerate(versoes):
        obsoleta = False
        for j, (_, outro) in enumerate(versoes):
            if i == j:
                continue
            relacao = comparar(vetor, outro)
            if relacao == "antes" or (relacao == "igual" and j < i):
                obsoleta = True          # ancestral de outra, ou repetida
                break
        if not obsoleta:
            vivas.append((valor, vetor))
    return vivas
`,
      solutionExplanation: 'O coração é o `comparar`: vetores formam uma **ordem parcial**, não total. Se um vetor é ≤ ao outro em todas as posições, há causalidade (antes/depois); se cada um ganha em alguma posição, **nenhum viu a escrita do outro** — são concorrentes. Tratar ausente como 0 deixa o vetor crescer conforme nós novos escrevem. O `mesclar` produz o menor vetor que **domina** os dois lados: é o que um nó faz ao receber uma mensagem (antes de incrementar a própria posição) e o que o app usa ao gravar a resolução de um conflito. E `siblings` é exatamente o que um banco no estilo Dynamo faz numa leitura: descarta as versões que são **ancestrais** de outras (foram sobrescritas por alguém que as conhecia) e devolve as concorrentes para a aplicação mesclar — como o carrinho de compras da Amazon.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ufa! Recapitulando: relógio de parede serve para **datas**, o monotônico para **intervalos**, e nenhum dos dois ordena eventos entre máquinas.',
        'Para isso existem **Lamport** (ordem total consistente com a causalidade), **vector clocks** (detectam concorrência) e o **HLC** (os dois mundos). Na próxima unidade: como réplicas **concordam** — quóruns e consenso!',
      ],
      board: null,
    },
  ],
});
