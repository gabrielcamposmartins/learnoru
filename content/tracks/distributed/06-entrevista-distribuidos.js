(function () {
  // Relógio falso compartilhado pelos testes (cada teste roda num namespace novo).
  const RELOGIO = `_E = 1_704_067_200_000          # 2024-01-01T00:00:00Z em ms (o EPOCH do enunciado)


class RelogioFalso:
    """Relógio em ms que só anda quando o teste manda ou quando alguém chama esperar()."""
    def __init__(self, agora):
        self.agora = agora
        self.esperas = []

    def __call__(self):
        return self.agora

    def esperar(self, ms):
        assert ms > 0, f"esperar({ms}): o tempo de espera precisa ser positivo"
        assert len(self.esperas) < 100_000, "esperar() chamado 100.000 vezes: loop infinito?"
        self.esperas.append(ms)
        self.agora += ms


def _partes(i, epoch=_E):
    return (i >> 22) + epoch, (i >> 12) & 1023, i & 4095

`;

  Game.registerModule('distributed', {
    id: 'entrevista-distribuidos',
    title: 'Entrevista: sistemas distribuídos',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'Projete um gerador de IDs únicos distribuído: Snowflake × UUIDv4 × UUIDv7 × ticket server, relógio andando para trás, worker ids durante partições e a ordenação que é só aproximada.',
    concepts: ['Snowflake ID', 'UUIDv4 × UUIDv7', 'Relógio para trás', 'Worker id com lease', 'K-sorted'],
    takeaways: [
      'Comece pelos requisitos: **tamanho** (64 × 128 bits), **ordenação** por tempo, **vazão**, coordenação aceitável e o que o ID pode **vazar**. Cada opção (UUIDv4, UUIDv7, ticket server, Snowflake) ganha em um eixo diferente.',
      '**Snowflake** = 41 bits de timestamp (ms desde um **epoch customizado**) + 10 bits de worker id + 12 bits de sequência: 4.096 IDs por milissegundo por worker, sem conversar com ninguém.',
      'Esgotou a sequência do milissegundo? **Espere** o próximo. O relógio voltou? Nunca gere com o timestamp menor: **espere** se o salto for pequeno, **falhe** (e alerte) se for grande.',
      'O ponto frágil numa partição não é gerar, é o **worker id**: dois nós com o mesmo id geram duplicatas. Pegue-o com lease e **pare de gerar antes** do lease expirar.',
      'IDs Snowflake são só **k-sorted**: entre máquinas, o skew de relógio embaralha a ordem, e um ID gerado antes do *commit* pode aparecer "no passado". Não use o ID como cursor de sincronização sem margem.',
    ],
    glossary: [
      { term: 'UUIDv4', aliases: ['UUID v4', 'UUIDs v4', 'UUID aleatório', 'UUIDs aleatórios'], definition: 'UUID de 128 bits com **122 bits aleatórios**. Não precisa de coordenação e a chance de colisão é desprezível, mas não tem ordem: como chave primária, espalha as inserções por todo o índice B-tree (page splits, cache frio).' },
      { term: 'K-sorted', aliases: ['k-ordenado', 'k-ordenados', 'aproximadamente ordenado', 'aproximadamente ordenados', 'roughly sorted', 'roughly ordered'], definition: 'Sequência "quase ordenada": cada item está no máximo a uma distância *k* da sua posição correta. IDs Snowflake e UUIDv7 são k-sorted por tempo — ordenados dentro de um gerador, mas embaralhados entre máquinas pelo skew de relógio.' },
      { term: 'Epoch customizado', aliases: ['epoch personalizado', 'custom epoch', 'epochs customizados'], definition: 'O "marco zero" que um gerador de IDs subtrai do timestamp antes de guardá-lo. Começar a contar da data do projeto (e não de 1970) faz 41 bits de milissegundos durarem ~69 anos a partir de agora. O Twitter usa 1288834974657 (4/nov/2010).' },
      { term: 'Worker id', aliases: ['worker ids', 'worker_id', 'machine id', 'id do worker', 'id de worker'], definition: 'Número que identifica o gerador dentro de um ID Snowflake (10 bits: 0 a 1023). Tem de ser **único entre os geradores vivos**: dois nós com o mesmo worker id no mesmo milissegundo produzem IDs idênticos.' },
      { term: 'Problema do tanque alemão', aliases: ['German tank problem', 'tanque alemão'], definition: 'Na Segunda Guerra, os Aliados estimaram a produção de tanques alemães a partir dos **números de série** capturados, com precisão muito maior que a da espionagem. Moral para APIs: IDs sequenciais ou com timestamp **vazam** volume e ritmo do negócio.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à entrevista! Hoje eu sou a entrevistadora — e o problema é um clássico de system design que parece simples: **gerar IDs únicos**.',
          'Parece `AUTO_INCREMENT`, né? Até você ter três datacenters, duzentos mil pedidos por segundo e nenhuma vontade de ter um ponto único de falha.',
        ],
        board: {
          title: 'O problema: um gerador de IDs distribuído',
          md: `A plataforma de pedidos vai ser **shardeada** em 3 datacenters. Cada pedido, item e evento precisa de um ID.

**Requisitos**
- **Único** globalmente — sem colisões, nunca.
- **64 bits**: as tabelas e os clientes já usam \`BIGINT\`.
- **Aproximadamente ordenado por tempo**: índices B-tree felizes e "mais recentes primeiro" sem coluna extra.
- **~200 mil IDs/s** no pico, com latência de microssegundos.
- **Sem coordenação por ID**: sem ponto único de falha, e cada datacenter continua gerando durante uma **partição** entre eles.

**Fora do escopo**: ordem causal exata entre máquinas (para isso existem relógios lógicos — aula de tempo e ordem).

> [!dica] Em entrevista, **esclareça os requisitos antes de desenhar**: tamanho do ID, se precisa de ordem, vazão, se pode haver coordenação e se o ID pode vazar informação (volume, horário de criação). Metade da resposta está nessas perguntas.`,
        },
      },
      {
        type: 'mcq',
        id: 'dist-ent-q1',
        concept: 'Snowflake ID',
        say: 'Primeira pergunta, antes de qualquer código: qual abordagem você escolheria?',
        prompt: 'Com os requisitos do quadro (64 bits, aproximadamente ordenado por tempo, ~200 mil IDs/s, sem coordenação por ID e funcionando durante partições entre datacenters), qual abordagem atende **todos**?',
        options: [
          { text: 'IDs no estilo **Snowflake**: timestamp em ms + worker id + sequência, gerados localmente em cada nó', correct: true, why: 'Cabe em 64 bits, é ordenado pelo tempo (os bits mais altos são o timestamp) e cada nó gera sozinho — só o worker id precisa ser combinado, uma vez, na inicialização.' },
          { text: '**UUIDv7**: timestamp de 48 bits + bits aleatórios, gerado localmente', why: 'Resolve ordenação e coordenação — é a escolha moderna quando 128 bits cabem. Mas o requisito é **64 bits**: um UUID tem 128 e não entra no `BIGINT` existente.' },
          { text: '**UUIDv4** gerado em cada serviço', why: 'Tem 128 bits (não cabe) e é **aleatório**: não há ordenação por tempo, e como chave primária espalha inserções por todo o índice.' },
          { text: 'Um **ticket server**: um banco central com `AUTO_INCREMENT` que entrega o próximo número', why: 'Os IDs são perfeitos (64 bits, crescentes), mas **cada ID** exige uma ida ao servidor central: ponto único de falha, latência entre datacenters e, numa partição, quem fica do lado errado não gera nada.' },
        ],
        explanation: 'Os quatro candidatos trocam coisas diferentes: o **ticket server** dá ordem perfeita ao custo de coordenação; o **UUIDv4** dispensa coordenação mas perde ordem; o **UUIDv7** tem as duas coisas mas usa 128 bits; o **Snowflake** espreme timestamp, máquina e sequência em 64 bits. O preço do Snowflake é ser só *aproximadamente* ordenado e depender do relógio — que é exatamente o que vamos atacar.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Boa. Antes de desenhar os bits, vale ter a tabela inteira na cabeça — o entrevistador adora perguntar "e por que não X?".',
          'Repare na última coluna: todo ID ordenado pelo tempo **conta uma história** para quem o vê.',
        ],
        board: {
          title: 'As opções lado a lado',
          md: `| Abordagem | Bits | Ordenado? | Coordenação | Pontos fracos |
|---|---|---|---|---|
| \`AUTO_INCREMENT\` num banco só | 64 | ✓ estrito | toda escrita | não escala com shards; ponto único de falha |
| **Ticket server** (Flickr) | 64 | ✓ por servidor | por ID ou por faixa | dois servidores (pares/ímpares) perdem a ordem global; faixas reservadas também |
| **UUIDv4** | 128 | ✗ | nenhuma | índice fragmentado; 36 caracteres em texto |
| **UUIDv7** (RFC 9562, 2024) | 128 | ≈ ms | nenhuma | 128 bits; expõe a hora de criação |
| **Snowflake** | 64 | ≈ ms (k-sorted) | só o worker id | depende do relógio; expõe hora e ritmo |

\`\`\`text
 UUIDv7:  |   unix_ts_ms (48)   | ver(4) | rand_a(12) | var(2) |     rand_b (62)     |
 UUIDv4:  | aleatório ...       | ver(4) | aleatório  | var(2) | aleatório ...       |
\`\`\`

- **Ticket server com faixas**: cada servidor de aplicação reserva 1.000 IDs de uma vez e os consome localmente — coordena 1 vez a cada 1.000, mas IDs de servidores diferentes saem fora de ordem, e uma faixa não usada vira buraco.
- **UUIDv7 × v4 como chave primária**: inserções com v7 caem sempre no "fim" do índice (como um autoincremento); com v4, cada inserção cai numa página aleatória.

> [!sabia] **Problema do tanque alemão**: na Segunda Guerra, os Aliados estimaram a produção mensal de tanques a partir dos **números de série** capturados — e acertaram muito mais que a espionagem (estimaram 246 por mês; eram 245). IDs sequenciais ou com timestamp vazam o mesmo tipo de coisa: quantos pedidos você recebe por dia e a que horas. Se isso importa, exponha um ID **opaco** na API e guarde o ordenado por dentro.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Agora a anatomia do **Snowflake**, criado pelo Twitter em 2010 quando o MySQL com autoincremento não aguentou mais.',
          'São 64 bits, e cada faixa tem um trabalho. A mágica: o **timestamp** fica nos bits mais altos — então ordenar os IDs é ordenar pelo tempo.',
        ],
        board: {
          title: 'Anatomia de um Snowflake ID',
          md: `\`\`\`text
  1 bit  |          41 bits               |   10 bits   |   12 bits
  sinal  |  ms desde o epoch customizado  |  worker id  |  sequência
    0    |  00010100001001011001...       |  0000100101 |  000000000101
\`\`\`

\`\`\`python
EPOCH = 1_704_067_200_000                      # 2024-01-01T00:00:00Z em ms

def compor(ts_ms, worker_id, seq):
    return ((ts_ms - EPOCH) << 22) | (worker_id << 12) | seq

def decodificar(id_):
    return (id_ >> 22) + EPOCH, (id_ >> 12) & 0x3FF, id_ & 0xFFF

compor(1_790_596_800_123, 37, 5)               # 28/09/2026 12:00:00.123 UTC
# 362931447914450949
\`\`\`

| Faixa | Capacidade |
|---|---|
| 41 bits de ms | 2⁴¹ ms ≈ **69,7 anos** a partir do epoch |
| 10 bits de worker | **1.024** geradores simultâneos (o Twitter dividia em 5 de datacenter + 5 de máquina) |
| 12 bits de sequência | **4.096** IDs por ms por worker ≈ 4 milhões/s |

- O **bit de sinal** fica em 0 para o ID caber num \`BIGINT\` com sinal (Java, Postgres) e continuar positivo.
- Dentro do mesmo milissegundo, a **sequência** sobe; num milissegundo novo, volta a 0. Se as 4.096 acabarem, o gerador **espera** o próximo milissegundo.
- Variações famosas: **Instagram** (41 bits de tempo + 13 de *shard* + 10 de sequência, gerado numa função do Postgres), **Discord** (epoch em 2015), **Sonyflake** (unidades de 10 ms e 16 bits de máquina: dura 174 anos).

> [!sabia] O **epoch customizado** é o truque que faz 41 bits bastarem: contando desde 1970, metade da capacidade já teria sido gasta. O Twitter conta a partir de \`1288834974657\` (4 de novembro de 2010) — por isso dá para extrair a data de qualquer tweet só pelo ID.

> [!atencao] **JavaScript** representa números como *double*: inteiros acima de 2⁵³ perdem precisão. \`JSON.parse('{"id": 362931447914450949}')\` devolve \`362931447914450944\` — outro ID! Por isso a API do Twitter devolve também \`id_str\`. Mande IDs de 64 bits como **string** no JSON.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E aqui mora o perigo: o Snowflake **confia no relógio**. E relógio de parede, como vimos, anda para trás.',
          'Se o relógio voltar 5 ms e você gerar com esse timestamp, vai reemitir combinações de timestamp, worker e sequência que **já foram usadas**. IDs duplicados — o único bug que um gerador de IDs não pode ter.',
        ],
        board: {
          title: 'Quando o relógio anda para trás',
          md: `**Por que acontece:** o NTP dá um *step* (ajuste brusco) quando o erro é grande — no \`ntpd\`, acima de 128 ms; menor que isso, ele faz *slew* (acelera ou freia o relógio aos poucos). Também: segundo bissexto, VM restaurada de snapshot, migração ao vivo, alguém rodando \`date -s\`.

\`\`\`text
 relógio:   ...  1000  1001  1002  │ NTP: -3 ms │  999  1000  1001  1002  1003
 IDs:            (1000,7,0) ...    │            │  (999,7,0)? (1000,7,0)? ← JÁ EMITIDO
\`\`\`

| Estratégia | Como | Custo |
|---|---|---|
| **Esperar** | salto pequeno (≤ tolerância, ex.: 5 ms): dorme até o relógio alcançar o último timestamp | alguns ms de latência |
| **Falhar** | salto grande: lança erro, alerta, tira o nó do balanceador | o nó fica indisponível até o relógio alcançar |
| **"Pegar emprestado do futuro"** | segue usando o último timestamp como relógio lógico, só incrementando a sequência | o timestamp embutido fica adiantado; com salto grande, a sequência se esgota |
| **Trocar de worker id** | pede um id novo e recomeça | exige coordenação e ids livres |

O Snowflake original do Twitter simplesmente **recusava** (\`InvalidSystemClock\`) e contava com o NTP em modo *slew*.

> [!dica] O último timestamp vive **em memória**. Se o processo reiniciar logo depois de um salto para trás, ele "esquece" onde parou. Defesas: na inicialização, esperar mais que a tolerância antes de gerar, ou persistir periodicamente um limite superior do último timestamp usado e só começar quando o relógio passar dele.

> [!atencao] \`time.monotonic()\` nunca volta, mas **não serve** como timestamp de ID: a origem é arbitrária (geralmente o boot da máquina), não se compara entre máquinas e recomeça quando ela reinicia. Ele é ótimo para **medir intervalos** — como o tempo de validade de um lease.`,
        },
      },
      { type: 'section', title: 'Parte 1 — o gerador', subtitle: 'Gere e decodifique IDs Snowflake com relógio injetado, estouro de sequência e relógio voltando.', icon: '❄️' },
      {
        type: 'code',
        id: 'dist-ent-q2',
        concept: 'Snowflake ID',
        title: 'Gerador de IDs Snowflake',
        say: 'Mão na massa. O relógio e a espera são **injetados** — ninguém vai dormir de verdade nos testes, e nós vamos fazer o relógio voltar de propósito.',
        prompt: `Implemente o gerador com o layout do quadro: \`id = ((ts - epoch) << 22) | (worker_id << 12) | sequencia\`.

- \`decodificar(id_, epoch=EPOCH)\` devolve a **tupla** \`(timestamp_ms, worker_id, sequencia)\`.
- \`GeradorSnowflake(worker_id, relogio, esperar, epoch=EPOCH, tolerancia_ms=5)\`: \`relogio()\` devolve o "agora" em ms (int) e \`esperar(ms)\` dorme \`ms\` milissegundos (\`ms > 0\`). Se \`worker_id\` não estiver em \`0..MAX_WORKER\`, lance \`ValueError\`.
- \`proximo()\` lê \`ts = relogio()\` e compara com o **último timestamp usado**:
  - \`ts\` **menor** (o relógio voltou): se o atraso for **≤ \`tolerancia_ms\`**, chame \`esperar\` e releia o relógio até \`ts >= último\`; se for **maior**, lance \`RelogioVoltou\` — **sem alterar** o estado do gerador.
  - \`ts\` **igual** ao último: a sequência sobe 1. Se passar de \`MAX_SEQ\`, espere (com \`esperar\` e relendo o relógio) até \`ts > último\` e use sequência 0.
  - \`ts\` **maior**: sequência 0.
- Os IDs de um mesmo gerador são **estritamente crescentes** e nunca se repetem.`,
        starter: `EPOCH = 1_704_067_200_000            # 2024-01-01T00:00:00Z em ms
BITS_WORKER = 10
BITS_SEQ = 12
MAX_WORKER = (1 << BITS_WORKER) - 1   # 1023
MAX_SEQ = (1 << BITS_SEQ) - 1         # 4095


class RelogioVoltou(Exception):
    """O relógio andou para trás além da tolerância: gerar agora poderia repetir IDs."""


def decodificar(id_, epoch=EPOCH):
    # TODO: devolva (timestamp_ms, worker_id, sequencia)
    pass


class GeradorSnowflake:
    def __init__(self, worker_id, relogio, esperar, epoch=EPOCH, tolerancia_ms=5):
        # relogio() -> agora em ms (int); esperar(ms) -> dorme ms milissegundos
        # TODO: valide worker_id; guarde o último timestamp usado e a sequência
        pass

    def proximo(self):
        # TODO: relógio voltou? mesmo ms (sequência, estouro)? ms novo?
        pass
`,
        tests: [
          {
            name: 'layout dos bits e sequência no mesmo milissegundo',
            code: RELOGIO + `r = RelogioFalso(_E + 1000)
g = GeradorSnowflake(7, r, r.esperar)
a = g.proximo()
esperado = (1000 << 22) | (7 << 12)
assert a == esperado, f"primeiro ID: esperado {esperado}, obtido {a}"
b = g.proximo()
assert b == a + 1, f"mesmo milissegundo: a sequência sobe 1 ({_partes(b)})"`,
          },
          {
            name: 'decodificar desfaz a composição',
            code: `i = (123456 << 22) | (1023 << 12) | 4095
assert decodificar(i) == (EPOCH + 123456, 1023, 4095), decodificar(i)
assert decodificar(0) == (EPOCH, 0, 0)
assert decodificar((5 << 22) | (1 << 12)) == (EPOCH + 5, 1, 0)`,
          },
          {
            name: 'milissegundo novo zera a sequência (sem esperar à toa)',
            code: RELOGIO + `r = RelogioFalso(_E + 5)
g = GeradorSnowflake(1, r, r.esperar)
ids = [g.proximo() for _ in range(3)]
r.agora += 1
ids.append(g.proximo())
partes = [_partes(i) for i in ids]
assert partes == [(_E + 5, 1, 0), (_E + 5, 1, 1), (_E + 5, 1, 2), (_E + 6, 1, 0)], partes
assert r.esperas == [], "o relógio andou normalmente: não havia por que esperar"`,
          },
          {
            name: 'sequência esgotada: espera o próximo milissegundo',
            code: RELOGIO + `r = RelogioFalso(_E + 50)
g = GeradorSnowflake(3, r, r.esperar)
ids = [g.proximo() for _ in range(4096)]
assert _partes(ids[-1]) == (_E + 50, 3, 4095), _partes(ids[-1])
extra = g.proximo()
assert r.esperas, "a sequência 4095 era a última do milissegundo: era preciso esperar"
assert _partes(extra) == (_E + 51, 3, 0), f"depois do estouro: {_partes(extra)}"
assert len(set(ids + [extra])) == 4097, "IDs repetidos!"`,
          },
          {
            name: 'relógio voltou pouco: espera alcançar',
            code: RELOGIO + `r = RelogioFalso(_E + 100)
g = GeradorSnowflake(2, r, r.esperar, tolerancia_ms=5)
a = g.proximo()
r.agora = _E + 97                     # ajuste do NTP: 3 ms para trás
b = g.proximo()
assert r.esperas, "3 ms <= tolerância: espere o relógio alcançar"
assert b > a, f"IDs de um gerador nunca diminuem: {_partes(a)} -> {_partes(b)}"`,
          },
          {
            name: 'relógio voltou muito: RelogioVoltou, sem estragar o estado',
            code: RELOGIO + `r = RelogioFalso(_E + 10_000)
g = GeradorSnowflake(2, r, r.esperar, tolerancia_ms=5)
a = g.proximo()
r.agora = _E + 9_000                  # 1 s para trás
try:
    g.proximo()
    assert False, "1 s para trás: lance RelogioVoltou em vez de gerar"
except RelogioVoltou:
    pass
assert r.esperas == [], "não fique esperando 1 s: falhe rápido"
r.agora = _E + 10_000                 # o relógio alcançou
b = g.proximo()
assert _partes(b) == (_E + 10_000, 2, 1), f"a chamada que falhou não podia mexer na sequência: {_partes(b)}"`,
          },
          {
            name: 'worker id precisa caber em 10 bits',
            hidden: true,
            code: RELOGIO + `r = RelogioFalso(_E)
for w in (-1, 1024, 5000):
    try:
        GeradorSnowflake(w, r, r.esperar)
        assert False, f"worker_id={w} não cabe em 10 bits: ValueError"
    except ValueError:
        pass
assert _partes(GeradorSnowflake(0, r, r.esperar).proximo()) == (_E, 0, 0)
assert _partes(GeradorSnowflake(1023, r, r.esperar).proximo()) == (_E, 1023, 0)`,
          },
          {
            name: 'tolerância: exatamente no limite espera; um ms além falha',
            hidden: true,
            code: RELOGIO + `r = RelogioFalso(_E + 100)
g = GeradorSnowflake(0, r, r.esperar, tolerancia_ms=5)
a = g.proximo()
r.agora = _E + 95                     # exatamente 5 ms atrás: ainda espera
b = g.proximo()
assert b > a
r.agora = _E + 94                     # 6 ms atrás do último (100)
try:
    g.proximo()
    assert False, "6 ms > tolerância de 5 ms: RelogioVoltou"
except RelogioVoltou:
    pass`,
          },
          {
            name: 'workers diferentes no mesmo milissegundo nunca colidem',
            hidden: true,
            code: RELOGIO + `r = RelogioFalso(_E + 7)
g1 = GeradorSnowflake(1, r, r.esperar)
g2 = GeradorSnowflake(2, r, r.esperar)
ids = [g.proximo() for _ in range(100) for g in (g1, g2)]
assert len(set(ids)) == 200, "colisão entre workers"
assert max(i for i in ids if _partes(i)[1] == 1) < min(i for i in ids if _partes(i)[1] == 2), "o worker id fica acima da sequência nos bits"`,
          },
          {
            name: 'epoch customizado (o do Twitter)',
            hidden: true,
            code: RELOGIO + `TWITTER = 1288834974657
r = RelogioFalso(TWITTER + 42)
g = GeradorSnowflake(9, r, r.esperar, epoch=TWITTER)
i = g.proximo()
assert i == (42 << 22) | (9 << 12), f"use o epoch recebido: {i}"
assert decodificar(i, epoch=TWITTER) == (TWITTER + 42, 9, 0)`,
          },
          {
            name: 'propriedade: com o relógio tremendo, IDs sempre crescentes e únicos',
            hidden: true,
            code: RELOGIO + `import random
rnd = random.Random(7)
r = RelogioFalso(_E + 1_000)
g = GeradorSnowflake(5, r, r.esperar, tolerancia_ms=5)
anterior = -1
vistos = set()
for _ in range(10_000):
    r.agora += rnd.choice([0, 0, 0, 1, 2, -1, -3])
    i = g.proximo()
    assert i > anterior, f"ID diminuiu: {_partes(anterior)} -> {_partes(i)}"
    anterior = i
    vistos.add(i)
assert len(vistos) == 10_000`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime') || m.imports.includes('random'),
            text: 'Você importou `time`, `datetime` ou `random`. Use o `relogio` e o `esperar` **injetados**: além de deixar os testes determinísticos, quem monta o gerador escolhe a fonte de tempo — e é isso que permite simular o NTP puxando o relógio para trás.',
            concept: 'Relógio injetado',
          },
          {
            when: m => ['bin', 'zfill', 'format', 'rjust'].some(c => m.calls.includes(c)),
            text: 'Você montou ou desmontou o ID passando por **texto** (`bin`, `format`, `zfill`…). Use só aritmética de bits: `<<` e `|` para compor, `>>` e `&` com máscaras (`MAX_WORKER`, `MAX_SEQ`) para extrair — é mais rápido e não tem armadilha de zeros à esquerda.',
            concept: 'Snowflake ID',
          },
          {
            when: m => m.usesGlobal,
            text: 'Você usou `global`. O último timestamp e a sequência pertencem a **cada gerador**: dois geradores (workers diferentes) no mesmo processo não podem dividir estado.',
            concept: 'Estado por instância',
          },
        ],
        hints: [
          '`decodificar`: `(id_ >> 22) + epoch`, `(id_ >> BITS_SEQ) & MAX_WORKER` e `id_ & MAX_SEQ`. No construtor, guarde `self.ultimo_ts = -1` e `self.sequencia = 0` — assim a primeira chamada sempre cai no caso "ms novo".',
          'Escreva um auxiliar `_esperar_ate(alvo)`: lê o relógio e, enquanto `ts < alvo`, chama `self.esperar(alvo - ts)` e relê. Ele serve para os dois casos: relógio voltou (`alvo = self.ultimo_ts`) e estouro (`alvo = self.ultimo_ts + 1`).',
          'Em `proximo`, cheque o relógio voltando **antes** de mexer no estado: `if ts < self.ultimo_ts:` calcule o atraso, lance `RelogioVoltou` se passar da tolerância, senão `ts = self._esperar_ate(self.ultimo_ts)`. Depois: `if ts == self.ultimo_ts: self.sequencia = (self.sequencia + 1) & MAX_SEQ` e, se deu 0, `ts = self._esperar_ate(self.ultimo_ts + 1)`; `else: self.sequencia = 0`. Por fim, `self.ultimo_ts = ts` e monte o ID.',
        ],
        solution: `EPOCH = 1_704_067_200_000            # 2024-01-01T00:00:00Z em ms
BITS_WORKER = 10
BITS_SEQ = 12
MAX_WORKER = (1 << BITS_WORKER) - 1   # 1023
MAX_SEQ = (1 << BITS_SEQ) - 1         # 4095


class RelogioVoltou(Exception):
    """O relógio andou para trás além da tolerância: gerar agora poderia repetir IDs."""


def decodificar(id_, epoch=EPOCH):
    return (
        (id_ >> (BITS_WORKER + BITS_SEQ)) + epoch,
        (id_ >> BITS_SEQ) & MAX_WORKER,
        id_ & MAX_SEQ,
    )


class GeradorSnowflake:
    def __init__(self, worker_id, relogio, esperar, epoch=EPOCH, tolerancia_ms=5):
        if not 0 <= worker_id <= MAX_WORKER:
            raise ValueError(f"worker_id deve estar entre 0 e {MAX_WORKER}: {worker_id}")
        self.worker_id = worker_id
        self.relogio = relogio
        self.esperar = esperar
        self.epoch = epoch
        self.tolerancia_ms = tolerancia_ms
        self.ultimo_ts = -1               # nenhum ID gerado ainda
        self.sequencia = 0

    def _esperar_ate(self, alvo):
        ts = self.relogio()
        while ts < alvo:
            self.esperar(alvo - ts)
            ts = self.relogio()
        return ts

    def proximo(self):
        ts = self.relogio()
        if ts < self.ultimo_ts:                        # o relógio voltou
            atraso = self.ultimo_ts - ts
            if atraso > self.tolerancia_ms:
                raise RelogioVoltou(f"relógio {atraso} ms atrás do último ID")
            ts = self._esperar_ate(self.ultimo_ts)
        if ts == self.ultimo_ts:
            self.sequencia = (self.sequencia + 1) & MAX_SEQ
            if self.sequencia == 0:                    # 4096 IDs neste ms: acabou
                ts = self._esperar_ate(self.ultimo_ts + 1)
        else:
            self.sequencia = 0
        self.ultimo_ts = ts
        return (
            ((ts - self.epoch) << (BITS_WORKER + BITS_SEQ))
            | (self.worker_id << BITS_SEQ)
            | self.sequencia
        )
`,
        solutionExplanation: 'O gerador guarda só dois números — o **último timestamp usado** e a **sequência** — e toda a correção sai de uma regra: *nunca emitir um par (timestamp, sequência) menor ou igual a um já emitido*. Por isso o relógio voltando é checado **antes** de tocar no estado: se o atraso passa da tolerância, a exceção sai com o gerador intacto (o teste que falha e depois volta confere justamente isso — zerar a sequência antes de lançar faria o próximo ID repetir um antigo). Atrasos pequenos e o estouro da sequência usam o mesmo auxiliar `_esperar_ate`, que dorme pelo `esperar` injetado e **relê** o relógio, porque dormir não garante que o relógio andou o quanto você pediu. O `& MAX_SEQ` faz a sequência dar a volta para 0 exatamente quando os 12 bits se esgotam. Por fim, compor e decodificar são só *shifts* e máscaras — a mesma ideia de empacotar campos em bits que aparece em cabeçalhos de protocolos.',
      },
      {
        type: 'mcq',
        id: 'dist-ent-q3',
        concept: 'Relógio para trás',
        say: 'Seu código passou. Agora o follow-up de produção: e quando o salto não é de 3 ms?',
        prompt: 'Em produção, o NTP de um nó dá um *step* e o relógio volta **2 segundos**. O gerador desse nó percebe que `relogio()` está 2.000 ms atrás do último timestamp usado. O que fazer?',
        options: [
          { text: 'Recusar: lançar erro, alertar e tirar o nó do balanceador até o relógio passar do último timestamp — os outros workers continuam gerando', correct: true, why: 'Nenhum ID repetido é emitido, e o impacto fica restrito a um nó por ~2 s. Como cada worker gera sozinho, o resto do cluster nem percebe.' },
          { text: 'Continuar com o relógio atual: a sequência volta a 0 e o worker id garante a unicidade', why: 'O worker id só distingue **máquinas**. Os 2 s que o relógio vai repetir já foram usados **por este mesmo worker**: cada (timestamp, worker, sequência) seria emitido de novo — IDs duplicados.' },
          { text: 'Trocar `time.time()` por `time.monotonic()`, que nunca volta', why: 'O monotônico não volta, mas sua origem é arbitrária (o boot): não se compara entre máquinas, perde o significado de "data" e **recomeça** quando o nó reinicia — aí sim os IDs se repetem. Serve para medir intervalos, não como timestamp de ID.' },
          { text: 'Dormir 2 s dentro da própria chamada até o relógio alcançar', why: 'Não gera duplicatas, mas segura **todas** as requisições desse nó por 2 s (timeouts em cascata a montante). Esperar é para saltos de poucos milissegundos; para saltos grandes, falhe rápido e deixe o balanceador desviar o tráfego.' },
        ],
        explanation: 'Um gerador de IDs pode ficar **indisponível** por um tempo, mas nunca pode emitir **duplicatas** — é um trade-off assimétrico, e ele guia a política: esperar quando o salto é pequeno (custa milissegundos), falhar rápido quando é grande. A causa raiz se trata na operação: NTP em modo *slew* (ajustes graduais), *leap smearing* para segundos bissextos e alertas de offset de relógio.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Ótimo. Agora o entrevistador aperta: "e numa **partição de rede**?". Gerar IDs não depende de ninguém — mas o **worker id** depende.',
          'E depois vem a pergunta de consistência que derruba muita gente: esses IDs são **mesmo** ordenados?',
        ],
        board: {
          title: 'Follow-ups: partições e consistência',
          md: `**De onde vem o worker id?**
- Configuração estática ou o ordinal de um \`StatefulSet\` no Kubernetes: simples, mas um erro de deploy (duas réplicas com o mesmo número) gera duplicatas **em silêncio**.
- Um **lease** no etcd/ZooKeeper: o nó pega um id livre ao subir e o renova; se morrer, o id volta para o pool.

**Na partição:** o nó isolado não consegue renovar o lease. O lease expira no etcd, o id é entregue a **outro** nó — e se o nó isolado continuar gerando, são **dois donos do mesmo worker id**: split brain, de novo! A regra é a mesma dos leases: o gerador **para de gerar antes** do lease expirar (medindo pelo relógio **monotônico**, com margem para o skew).

| Abordagem | Durante a partição |
|---|---|
| Ticket server único | o lado sem o servidor **não gera** (CP) |
| Dois ticket servers (pares/ímpares) | os dois lados geram, mas a ordem global se perde |
| Snowflake com worker id em lease | todos geram (AP) enquanto o lease vale; quem não renova, para |

**Consistência da ordem:** dentro de um gerador, os IDs são estritamente crescentes. **Entre** geradores, são só **k-sorted**: se o relógio do nó A está 5 ms adiantado, um ID de A pode ser "maior" que um ID de B gerado depois.
- Ótimo para ordenar um feed ou para a localidade do índice.
- **Não** serve para ordem causal ("a resposta veio depois da pergunta") — para isso, relógios lógicos.

> [!atencao] **O ID nasce antes do commit.** A transação T1 pega o ID 100 e demora; T2 pega o 101 e faz *commit* primeiro. Um consumidor que sincroniza com \`WHERE id > :ultimo_visto\` lê o 101, avança o cursor — e quando o 100 finalmente aparece, ninguém mais olha para ele. O mesmo vale para \`SERIAL\` do Postgres. Soluções: ler só até "agora menos uma margem", reler uma janela sobreposta (com consumidor idempotente) ou consumir o log do banco (CDC/outbox).`,
        },
      },
      {
        type: 'order',
        id: 'dist-ent-q4',
        concept: 'Worker id com lease',
        say: 'Ordene o ciclo de vida seguro de um worker id quando uma partição isola o gerador.',
        prompt: 'Um gerador Snowflake obtém seu worker id com **lease** no etcd. Ordene o que acontece, do início ao fim, quando uma partição o isola — sem nunca haver dois donos do mesmo id.',
        items: [
          'Ao subir, o gerador pega um worker id livre no etcd com um lease de 30 s',
          'Enquanto renova o lease, gera IDs localmente sem falar com ninguém',
          'Uma partição isola o gerador, e as renovações do lease começam a falhar',
          'Pelo relógio monotônico e com margem de segurança, o gerador para de emitir IDs antes do fim do lease',
          'O lease expira no etcd e o worker id volta para o pool',
          'Outro gerador recebe o mesmo worker id e começa a emitir IDs sem colisão',
        ],
        explanation: 'O passo que importa é o 4 vir **antes** do 5: o nó isolado não sabe o que o etcd decidiu, então precisa desistir por conta própria, **antes** que o id possa ser reatribuído. Ele mede o prazo com o relógio monotônico (o de parede pode pular) e deixa uma margem para o skew entre o seu relógio e o do etcd. É o mesmo raciocínio do split brain da aula de consenso — só que aqui a "escrita do zumbi" seria um ID duplicado.',
      },
      {
        type: 'open',
        id: 'dist-ent-q5',
        concept: 'K-sorted',
        say: 'Última pergunta, e é de consistência. Explique como você explicaria no postmortem.',
        prompt: 'Um serviço sincroniza pedidos com o ERP a cada minuto usando `SELECT ... WHERE id > :ultimo_id ORDER BY id`, onde `id` é um Snowflake gerado por vários workers. Às vezes, **pedidos nunca chegam ao ERP**. Explique por que isso acontece e como você corrigiria.',
        minWords: 35,
        rubric: [
          { label: 'Explica que os IDs são só **aproximadamente ordenados** entre workers (skew de relógio)', keywords: ['skew', 'relogio', 'aproximad', 'k-sorted', 'k sorted', 'maquinas diferentes', 'workers diferentes', 'outro worker', 'entre workers', 'entre maquinas', 'ntp', 'adiantad', 'atrasad', 'nao sao ordenad', 'nao e ordenad', 'nao estritamente'], concept: 'K-sorted', why: 'Cada worker usa o próprio relógio: um ID gerado depois, noutro nó, pode ser menor que um já sincronizado.' },
          { label: 'Aponta que o ID é gerado **antes do commit** — um ID menor pode ficar visível depois', keywords: ['commit', 'transac', 'antes de gravar', 'antes de salvar', 'visivel depois', 'aparece depois', 'demor', 'mais tarde', 'fora de ordem', 'chega depois'], concept: 'K-sorted', why: 'A transação com ID 100 pode fazer commit depois da de ID 101; quando ela aparece, o cursor já passou.' },
          { label: 'Diagnostica que o **cursor já passou** do ID e o registro é pulado para sempre', keywords: ['cursor', 'ultimo_id', 'ultimo id', 'ja passou', 'pul', 'perdid', 'nunca mais', 'ignorad', 'avanc'], concept: 'Keyset pagination', why: '`WHERE id > :ultimo_id` só olha para frente: o que aparece "atrás" do cursor nunca mais é lido.' },
          { label: 'Propõe correção: **margem/janela sobreposta** com consumidor idempotente, ou **CDC/outbox**', keywords: ['margem', 'janela', 'sobrepos', 'overlap', 'reler', 'relei', 'lag', 'cdc', 'change data capture', 'outbox', 'binlog', 'idempot', 'dedup', 'upsert'], concept: 'Consumidor idempotente', why: 'Ler só até "agora menos uma margem" ou reler uma janela (deduplicando no ERP) tolera a desordem; o CDC usa a ordem de commit do próprio banco.' },
        ],
        modelAnswer: `IDs Snowflake são só **aproximadamente ordenados**: cada worker usa o próprio relógio, e o skew entre máquinas (alguns ms, ou mais depois de um problema de NTP) faz um ID gerado depois, em outro worker, ser menor que um já visto. Além disso, o ID é gerado **antes do commit**: a transação com ID 100 pode demorar e fazer commit depois da de ID 101. Nos dois casos, a sincronização lê o 101, avança o cursor \`ultimo_id\` — e quando o 100 fica visível, ele já está atrás do cursor e é **pulado para sempre**.

Para corrigir, eu leria com **margem**: só IDs cujo timestamp embutido seja mais velho que, digamos, 1 minuto (maior que a transação mais longa + o skew), e reprocessaria uma **janela sobreposta** a cada rodada, com o ERP recebendo os pedidos de forma **idempotente** (upsert pelo ID, deduplicando). A solução mais robusta é trocar o polling por **CDC** (ler o WAL/binlog, que segue a ordem de commit) ou por um **outbox** transacional.`,
      },
      {
        type: 'say',
        mood: 'cheer',
        text: [
          'Entrevista concluída — e foi muito bem! Você comparou UUIDv4, UUIDv7, ticket server e **Snowflake**, e implementou o gerador com sequência, estouro e relógio voltando.',
          'O recado final: o ID é fácil; o difícil é o que está em volta — o **relógio**, o **worker id** numa partição e a ordem que é só **aproximada**. Com isso, você fecha a trilha de sistemas distribuídos!',
        ],
        board: null,
      },
    ],
  });
})();
