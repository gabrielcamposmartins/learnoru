Game.registerModule('design-patterns', {
  id: 'state',
  title: 'State',
  kind: 'lesson',
  level: 2,
  order: 33,
  unit: 'comportamentais',
  summary: 'Objetos que mudam de comportamento conforme a fase: máquinas de estado com classes ou com tabela de transições.',
  concepts: ['State', 'Máquina de estados', 'Tabela de transições', 'Transição inválida', 'State × Strategy'],
  takeaways: [
    'Quando o mesmo método se comporta diferente conforme a **fase** do objeto e os `if status == ...` se espalham, é hora de uma **máquina de estados** explícita.',
    'Um único campo de estado com valores bem definidos (um `Enum`) evita os **estados impossíveis** que várias flags booleanas permitem.',
    'Classes de estado (GoF) brilham quando cada fase tem muito comportamento próprio; a tabela `(estado, evento) → próximo` transforma as transições em **dados** fáceis de ler e testar.',
    '**Transição inválida é bug**: lance uma exceção específica em vez de ignorar em silêncio — e, no banco, transicione com `UPDATE ... WHERE status = <esperado>`.',
    'State × Strategy: mesma estrutura, intenção diferente. No State, o **próprio objeto** troca de comportamento ao longo da vida; no Strategy, o cliente escolhe de fora.',
  ],
  glossary: [
    { term: 'Máquina de estados', aliases: ['máquina de estado', 'máquinas de estados', 'state machine', 'FSM', 'máquina de estados finita'], definition: 'Modelo com um conjunto finito de estados, um estado atual e **transições** disparadas por eventos. Em código, substitui flags booleanas que podem se contradizer.' },
    { term: 'Tabela de transições', aliases: ['tabela de transição', 'transition table'], definition: 'A máquina de estados representada como dados: um dicionário `(estado, evento) → próximo estado`. O que não está na tabela é inválido.' },
    { term: 'Estado final', aliases: ['estados finais', 'estado terminal', 'estados terminais'], definition: 'Estado do qual nenhuma transição sai (ex.: ENTREGUE, CANCELADO). Chegou nele, o ciclo de vida acabou.' },
    { term: 'Statechart', aliases: ['statecharts', 'Harel statecharts'], definition: 'Extensão das máquinas de estados criada por David Harel (1987), com estados aninhados, regiões paralelas e histórico. É a base dos diagramas de estado da UML e do SCXML.' },
    { term: 'Compare-and-set', aliases: ['compare and set', 'compare-and-swap'], definition: 'Atualização condicional atômica: "mude para X **somente se** o valor atual ainda for Y". Em SQL: `UPDATE ... SET status = X WHERE id = ? AND status = Y`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é dia de **State**. Começo com um pedido de e-commerce que parece inocente…',
        'Três booleanos, oito combinações — e só quatro fazem sentido. Cada método vira um novelo de `if`.',
      ],
      board: {
        title: 'O problema: flags que se contradizem',
        md: `\`\`\`python
class Pedido:
    def __init__(self):
        self.pago = False
        self.enviado = False
        self.cancelado = False

    def pagar(self):
        if self.cancelado:
            raise ValueError("pedido cancelado")
        if self.pago:
            raise ValueError("já pago")
        self.pago = True

    def enviar(self):
        if self.cancelado or not self.pago or self.enviado:
            raise ValueError("não dá para enviar")
        self.enviado = True

    def cancelar(self):
        if self.enviado:
            raise ValueError("já saiu para entrega")
        self.cancelado = True      # e o estorno, se já estava pago?
\`\`\`

3 flags = 2³ = **8 combinações**, mas só 4 fazem sentido. O que significa \`enviado=True, pago=False\`? Nada impede esse estado — e um dia ele aparece no banco.

> [!sabia] Yaron Minsky, da Jane Street, resumiu o antídoto numa frase famosa: **"make illegal states unrepresentable"** — modele os dados de forma que estados impossíveis nem possam ser escritos. Um único campo \`status\` com valores bem definidos faz exatamente isso.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Antes de codar, desenhe a **máquina de estados**: quais fases existem, quais eventos movem o pedido e o que é proibido.',
        'Tudo que não é uma seta no diagrama é uma **transição inválida**.',
      ],
      board: {
        title: 'A máquina de estados do pedido',
        md: `\`\`\`text
         pagar            enviar            entregar
  NOVO ────────▶ PAGO ─────────▶ ENVIADO ─────────▶ ENTREGUE
   │               │
   │ cancelar      │ cancelar (+ estorno)
   ▼               │
  CANCELADO ◀──────┘
\`\`\`

| Estado / evento | pagar | enviar | entregar | cancelar |
|---|---|---|---|---|
| **NOVO** | PAGO | ✗ | ✗ | CANCELADO |
| **PAGO** | ✗ | ENVIADO | ✗ | CANCELADO |
| **ENVIADO** | ✗ | ✗ | ENTREGUE | ✗ |
| **ENTREGUE** | ✗ | ✗ | ✗ | ✗ |
| **CANCELADO** | ✗ | ✗ | ✗ | ✗ |

ENTREGUE e CANCELADO são **estados finais**: nenhuma seta sai deles. Das 20 células, só 5 são transições válidas — as outras 15 são bugs esperando uma chance.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na versão clássica do GoF, cada estado vira uma **classe**, e o objeto principal — o **contexto** — só delega para o estado atual.',
        'O truque está na classe base: por padrão, **tudo é proibido**. Cada estado libera só o que faz sentido nele.',
      ],
      board: {
        title: 'State com classes (GoF)',
        code: `class TransicaoInvalida(Exception):
    pass


class Estado:
    """Padrão: tudo é proibido. Cada estado libera o que pode."""
    def pagar(self, pedido):
        raise TransicaoInvalida(f"não dá para pagar: {self.nome}")
    def enviar(self, pedido):
        raise TransicaoInvalida(f"não dá para enviar: {self.nome}")
    def cancelar(self, pedido):
        raise TransicaoInvalida(f"não dá para cancelar: {self.nome}")


class Novo(Estado):
    nome = "novo"
    def pagar(self, pedido):
        pedido.estado = Pago()
    def cancelar(self, pedido):
        pedido.estado = Cancelado()


class Pago(Estado):
    nome = "pago"
    def enviar(self, pedido):
        pedido.estado = Enviado()
    def cancelar(self, pedido):
        pedido.estornar()                  # comportamento só desta fase
        pedido.estado = Cancelado()


class Enviado(Estado):
    nome = "enviado"                       # (entregar ficaria aqui)


class Cancelado(Estado):
    nome = "cancelado"


class Pedido:                              # o contexto
    def __init__(self):
        self.estado = Novo()

    def pagar(self):
        self.estado.pagar(self)            # delega!

    def enviar(self):
        self.estado.enviar(self)

    def cancelar(self):
        self.estado.cancelar(self)

    def estornar(self):
        print("estornando o pagamento…")`,
        caption: 'O `Pedido` não tem nenhum `if`: quem sabe o que fazer é o estado atual — e cada estado conhece os seus próximos.',
      },
    },
    {
      type: 'say',
      text: [
        'Em Python, muitas vezes dá para ser mais direto: as transições viram **dados**.',
        'Um `Enum` para os estados e um `dict` de `(estado, evento)` para o próximo. Leu a tabela, entendeu o sistema.',
      ],
      board: {
        title: 'State com tabela: Enum + dict',
        md: `\`\`\`python
from enum import Enum, auto


class Status(Enum):
    NOVO = auto()
    PAGO = auto()
    ENVIADO = auto()
    ENTREGUE = auto()
    CANCELADO = auto()


TRANSICOES = {
    (Status.NOVO, "pagar"): Status.PAGO,
    (Status.NOVO, "cancelar"): Status.CANCELADO,
    (Status.PAGO, "enviar"): Status.ENVIADO,
    (Status.PAGO, "cancelar"): Status.CANCELADO,
    (Status.ENVIADO, "entregar"): Status.ENTREGUE,
}


class Pedido:
    def __init__(self):
        self.status = Status.NOVO

    def disparar(self, evento):
        chave = (self.status, evento)
        if chave not in TRANSICOES:
            raise TransicaoInvalida(f"{evento!r} inválido em {self.status.name}")
        self.status = TRANSICOES[chave]
\`\`\`

> [!atencao] **Falhe alto.** Transição inválida quase sempre é bug ou requisição fora de ordem (clique duplo, webhook repetido). Ignorar em silêncio deixa o sistema divergir da realidade. Lance uma exceção específica — numa API, ela vira um **409 Conflict**.

> [!dica] A tabela é fácil de **testar** (dá para percorrer todos os pares) e até de **desenhar**: o diagrama pode ser gerado a partir do dicionário. Bibliotecas como \`transitions\` e \`python-statemachine\` seguem essa linha.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'No mundo real, o estado mora no **banco**. E aí aparece um inimigo: duas requisições ao mesmo tempo.',
        'O cliente clica em "cancelar" enquanto o webhook do pagamento chega. As duas leem NOVO… e as duas transicionam.',
      ],
      board: {
        title: 'Transições no banco: compare-and-set',
        md: `\`\`\`text
 requisição A (cancelar)        requisição B (webhook: pago)
 lê status = NOVO               lê status = NOVO
 NOVO → CANCELADO? ok           NOVO → PAGO? ok
 grava CANCELADO                grava PAGO      ◀ a última escrita vence
\`\`\`

A correção é fazer a checagem e a escrita **numa operação só** — um *compare-and-set*:

\`\`\`sql
UPDATE pedidos
   SET status = 'CANCELADO'
 WHERE id = 42
   AND status = 'NOVO';   -- só muda se ninguém mudou antes
\`\`\`

\`\`\`python
cur = conn.execute(
    "UPDATE pedidos SET status = ? WHERE id = ? AND status = ?",
    (novo.name, pedido_id, atual.name),
)
if cur.rowcount == 0:      # alguém transicionou antes de nós
    raise TransicaoInvalida("o pedido mudou de estado no meio do caminho")
\`\`\`

- **0 linhas afetadas** → conflito: recarregue e decida (responder 409, estornar o pagamento que chegou atrasado…).
- Uma coluna \`versao\` (lock otimista) generaliza a ideia para qualquer campo.
- Grave cada transição numa tabela de **histórico** (\`pedido_id, de, para, evento, quando\`): auditoria e depuração de graça.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Para fechar a teoria: State e Strategy têm o **mesmo diagrama de classes**. O que muda é a intenção.',
        'E quando a máquina cresce demais, existe um upgrade com nome e sobrenome.',
      ],
      board: {
        title: 'Classes, tabela… ou Strategy?',
        md: `| | Classes de estado | Tabela (Enum + dict) | Strategy |
|---|---|---|---|
| Quem troca o comportamento | os próprios estados | o método \`disparar\` | o cliente, de fora |
| Brilha quando | cada fase tem muita regra própria | só importa o que é permitido | há algoritmos intercambiáveis |
| Ponto fraco | transições espalhadas em várias classes | regras por estado viram \`if\`s | não modela ciclo de vida |

No State, o objeto **muda sozinho** de comportamento ao longo da vida (novo → pago → enviado). No Strategy, alguém de fora escolhe *como* fazer — e a escolha raramente muda.

> [!sabia] Máquinas de estados "planas" explodem rápido: um player com *tocando/pausado* × *mudo/com som* × *tela cheia/janela* já tem 8 estados. Em 1987, David Harel propôs os **statecharts**, com estados **aninhados** e **regiões paralelas** — a base dos diagramas de estado da UML, do padrão W3C **SCXML** e de bibliotecas como o XState, do JavaScript.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Falhar alto, escolher a abordagem e implementar duas máquinas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-sta-q1',
      concept: 'Transição inválida',
      say: 'Primeira: um "atalho" perigoso.',
      prompt: `Um colega "simplificou" o \`disparar\` do pedido (com a mesma \`TRANSICOES\` do quadro). O que acontece ao chamar \`p.disparar("enviar")\` num pedido **NOVO**?

\`\`\`python
def disparar(self, evento):
    self.status = TRANSICOES.get((self.status, evento), self.status)
\`\`\``,
      options: [
        { text: 'Lança `KeyError`, porque a chave `(NOVO, "enviar")` não existe.', why: '`dict.get` nunca lança `KeyError`: devolve o valor padrão — aqui, o próprio status atual.' },
        { text: 'O pedido continua NOVO e **ninguém fica sabendo** que o evento foi rejeitado.', correct: true, why: 'O `.get` com padrão transforma a transição inválida num no-op silencioso. Quem chamou acha que enviou; nada aconteceu.' },
        { text: 'O pedido vai para ENVIADO, pulando o pagamento.', why: 'Só aconteceria se existisse a chave `(NOVO, "enviar")` na tabela.' },
        { text: 'O status vira `None`.', why: 'Isso aconteceria com `.get(chave)` **sem** padrão — um bug ainda pior, que corromperia o estado.' },
      ],
      explanation: 'Transição inválida quase sempre indica **bug ou requisição fora de ordem** (clique duplo, webhook repetido, integração errada). Engolir o erro esconde o problema e deixa o sistema divergir da realidade. **Falhe alto**: lance uma exceção específica (`TransicaoInvalida`) com o estado e o evento na mensagem — a API pode traduzi-la para **409 Conflict**.',
    },
    {
      type: 'match',
      id: 'dp-sta-q2',
      concept: 'State × Strategy',
      say: 'Agora, escolha a ferramenta certa para cada situação.',
      prompt: 'Associe cada **situação** à abordagem mais adequada.',
      pairs: [
        { left: 'Cada fase tem regras e cálculos próprios (multa, estorno, frete)', right: 'Classes de estado (State do GoF)' },
        { left: 'Só importa quais transições são permitidas — e quero vê-las num lugar só', right: 'Tabela de transições (`Enum` + `dict`)' },
        { left: 'O cliente escolhe o algoritmo de fora e ele não muda sozinho', right: 'Strategy' },
        { left: 'Estados aninhados e regiões paralelas (tocando/pausado × mudo/com som)', right: 'Statechart' },
        { left: 'Dois estados, uma regra e nenhuma perspectiva de crescer', right: 'Um `if` simples — padrão seria exagero' },
      ],
      explanation: 'Classes brilham quando o **comportamento** varia muito por fase; a tabela, quando o que importa são as **transições**. Strategy não modela ciclo de vida: o cliente escolhe e pronto. Statecharts domam a explosão de estados com hierarquia e paralelismo. E, às vezes, a resposta sênior é **não usar padrão nenhum**.',
    },
    {
      type: 'code',
      id: 'dp-sta-q3',
      concept: 'Tabela de transições',
      title: 'Chamados de suporte com tabela de transições',
      say: 'Hora de codar! A tabela de um sistema de chamados já está pronta. Faça a máquina funcionar — e falhar alto.',
      prompt: `Um sistema de suporte tem estas transições (já declaradas no editor em \`TRANSICOES\`):

| De | Evento | Para |
|---|---|---|
| ABERTO | \`atender\` | EM_ANDAMENTO |
| EM_ANDAMENTO | \`pedir_info\` | AGUARDANDO_CLIENTE |
| AGUARDANDO_CLIENTE | \`responder\` | EM_ANDAMENTO |
| EM_ANDAMENTO | \`resolver\` | RESOLVIDO |
| RESOLVIDO | \`reabrir\` | EM_ANDAMENTO |
| RESOLVIDO | \`fechar\` | FECHADO |

Implemente a classe \`Chamado\`:

- Começa em \`Status.ABERTO\`; o atributo \`status\` guarda o estado atual.
- \`disparar(evento)\` aplica a transição e **retorna o novo status**. Evento inválido no status atual (inclusive evento desconhecido) lança \`TransicaoInvalida\` com o **nome do status** e o **evento** na mensagem — e o status **não muda**.
- \`pode(evento)\` → \`True\`/\`False\`, sem alterar nada.
- \`eventos_validos()\` → lista dos eventos possíveis no status atual, em **ordem alfabética** (\`[]\` num estado final).
- \`historico\` → lista dos status visitados, começando por \`ABERTO\` (tentativas inválidas não entram).`,
      starter: `from enum import Enum


class Status(Enum):
    ABERTO = "aberto"
    EM_ANDAMENTO = "em andamento"
    AGUARDANDO_CLIENTE = "aguardando cliente"
    RESOLVIDO = "resolvido"
    FECHADO = "fechado"


TRANSICOES = {
    (Status.ABERTO, "atender"): Status.EM_ANDAMENTO,
    (Status.EM_ANDAMENTO, "pedir_info"): Status.AGUARDANDO_CLIENTE,
    (Status.AGUARDANDO_CLIENTE, "responder"): Status.EM_ANDAMENTO,
    (Status.EM_ANDAMENTO, "resolver"): Status.RESOLVIDO,
    (Status.RESOLVIDO, "reabrir"): Status.EM_ANDAMENTO,
    (Status.RESOLVIDO, "fechar"): Status.FECHADO,
}


class TransicaoInvalida(Exception):
    pass


class Chamado:
    def __init__(self):
        self.status = Status.ABERTO

    def disparar(self, evento):
        pass

    def pode(self, evento):
        pass

    def eventos_validos(self):
        pass
`,
      tests: [
        {
          name: 'caminho feliz',
          code: `c = Chamado()
c.disparar("atender")
c.disparar("resolver")
c.disparar("fechar")
assert c.status is Status.FECHADO, c.status`,
        },
        { name: 'disparar retorna o novo status', expr: 'Chamado().disparar("atender")', expected: 'Status.EM_ANDAMENTO' },
        {
          name: 'transição inválida lança TransicaoInvalida',
          code: `c = Chamado()
try:
    c.disparar("fechar")
except TransicaoInvalida:
    pass
else:
    raise AssertionError("fechar um chamado ABERTO deveria lançar TransicaoInvalida")
assert c.status is Status.ABERTO, f"o status mudou para {c.status} mesmo com erro"`,
        },
        {
          name: 'pode() não altera nada',
          code: `c = Chamado()
assert c.pode("atender") is True
assert c.pode("fechar") is False
assert c.status is Status.ABERTO, "pode() não deveria alterar o status"`,
        },
        {
          name: 'eventos válidos em ordem alfabética',
          code: `c = Chamado()
c.disparar("atender")
assert c.eventos_validos() == ["pedir_info", "resolver"], c.eventos_validos()
c.disparar("resolver")
assert c.eventos_validos() == ["fechar", "reabrir"], c.eventos_validos()`,
        },
        {
          name: 'estado final não tem saída',
          hidden: true,
          code: `c = Chamado()
for e in ("atender", "resolver", "fechar"):
    c.disparar(e)
assert c.eventos_validos() == [], c.eventos_validos()
assert c.pode("reabrir") is False`,
        },
        {
          name: 'histórico ignora tentativas inválidas',
          hidden: true,
          code: `c = Chamado()
for e in ("atender", "pedir_info", "responder", "resolver"):
    c.disparar(e)
try:
    c.disparar("atender")
except TransicaoInvalida:
    pass
esperado = [Status.ABERTO, Status.EM_ANDAMENTO, Status.AGUARDANDO_CLIENTE, Status.EM_ANDAMENTO, Status.RESOLVIDO]
assert c.historico == esperado, c.historico`,
        },
        {
          name: 'evento desconhecido também é inválido',
          hidden: true,
          code: `c = Chamado()
try:
    c.disparar("voar")
except TransicaoInvalida:
    pass
else:
    raise AssertionError("evento desconhecido deveria lançar TransicaoInvalida")`,
        },
        {
          name: 'mensagem com status e evento',
          hidden: true,
          code: `try:
    Chamado().disparar("fechar")
except TransicaoInvalida as e:
    msg = str(e)
    assert "fechar" in msg and "ABERTO" in msg.upper(), f"mensagem pouco útil: {msg!r}"
else:
    raise AssertionError("deveria lançar TransicaoInvalida")`,
        },
        {
          name: 'chamados independentes',
          hidden: true,
          code: `a, b = Chamado(), Chamado()
a.disparar("atender")
assert b.status is Status.ABERTO and b.historico == [Status.ABERTO], (b.status, b.historico)`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /(==|\bis)\s*Status\.\w+/.test(code),
          text: 'Você comparou o status com `==`/`is` em condicionais. A tabela já responde "o que é permitido em cada estado" — deixe as regras nos **dados** e o código genérico.',
          concept: 'Tabela de transições',
        },
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo transforma **qualquer** erro (até um erro de digitação) em "transição inválida". Se usar `try`, capture só `KeyError` — ou teste com `in` antes.',
          concept: 'Tratamento de exceções',
        },
      ],
      hints: [
        'A chave da tabela é a tupla `(self.status, evento)`. Verifique com `if chave not in TRANSICOES:` e lance `TransicaoInvalida(...)` **antes** de mudar qualquer coisa.',
        'Crie `self.historico = [Status.ABERTO]` no `__init__` e faça `append` do novo status a cada transição bem-sucedida.',
        'Para `eventos_validos`: `sorted(ev for (st, ev) in TRANSICOES if st == self.status)`.',
      ],
      solution: `from enum import Enum


class Status(Enum):
    ABERTO = "aberto"
    EM_ANDAMENTO = "em andamento"
    AGUARDANDO_CLIENTE = "aguardando cliente"
    RESOLVIDO = "resolvido"
    FECHADO = "fechado"


TRANSICOES = {
    (Status.ABERTO, "atender"): Status.EM_ANDAMENTO,
    (Status.EM_ANDAMENTO, "pedir_info"): Status.AGUARDANDO_CLIENTE,
    (Status.AGUARDANDO_CLIENTE, "responder"): Status.EM_ANDAMENTO,
    (Status.EM_ANDAMENTO, "resolver"): Status.RESOLVIDO,
    (Status.RESOLVIDO, "reabrir"): Status.EM_ANDAMENTO,
    (Status.RESOLVIDO, "fechar"): Status.FECHADO,
}


class TransicaoInvalida(Exception):
    pass


class Chamado:
    def __init__(self):
        self.status = Status.ABERTO
        self.historico = [Status.ABERTO]

    def disparar(self, evento):
        chave = (self.status, evento)
        if chave not in TRANSICOES:
            raise TransicaoInvalida(f"evento {evento!r} inválido no status {self.status.name}")
        self.status = TRANSICOES[chave]
        self.historico.append(self.status)
        return self.status

    def pode(self, evento):
        return (self.status, evento) in TRANSICOES

    def eventos_validos(self):
        return sorted(ev for (st, ev) in TRANSICOES if st == self.status)
`,
      solutionExplanation: 'Toda a regra de negócio mora na **tabela**; a classe só consulta. `disparar` valida **antes** de alterar — por isso status e histórico ficam intactos no erro — e põe `self.status.name` e o evento na mensagem: é isso que aparece no log quando um webhook chega fora de ordem. `pode` e `eventos_validos` são consultas puras sobre a mesma tabela, ótimas para habilitar ou esconder botões na interface. E como `historico` nasce no `__init__`, cada chamado tem o seu.',
    },
    {
      type: 'code',
      id: 'dp-sta-q4',
      concept: 'State',
      title: 'Máquina de venda com classes de estado',
      say: 'Agora a versão GoF: uma máquina de venda — pergunta clássica de entrevista de design orientado a objetos.',
      prompt: `Implemente uma máquina de venda de **um único produto** com o padrão **State**. O contexto \`Maquina(preco, estoque)\` já delega cada ação para \`self.estado\`, que deve ser uma instância de \`SemCredito\`, \`ComCredito\` ou \`Esgotada\`. A classe base \`Estado\` já traz o comportamento padrão: \`inserir\` e \`comprar\` lançam \`OperacaoInvalida\`, \`cancelar\` devolve \`0\` e \`repor\` soma ao estoque.

- A \`Maquina\` começa em \`SemCredito\` — ou em \`Esgotada\`, se \`estoque == 0\`.
- **\`SemCredito\`**: \`inserir(v)\` soma \`v\` ao crédito e vai para \`ComCredito\`.
- **\`ComCredito\`**: \`inserir(v)\` soma ao crédito; \`cancelar()\` devolve o crédito, zera e vai para \`SemCredito\`.
- **\`ComCredito.comprar()\`**: com crédito **menor** que o preço, lança \`OperacaoInvalida\` e nada muda. Senão, entrega o produto (estoque − 1), zera o crédito, **retorna o troco** e vai para \`SemCredito\` — ou \`Esgotada\`, se o estoque acabou.
- **\`Esgotada\`**: \`repor(qtd)\` soma ao estoque e, se ele ficou positivo, vai para \`SemCredito\`.

\`\`\`python
m = Maquina(preco=5, estoque=1)
m.inserir(2)
m.inserir(5)      # SemCredito → ComCredito
m.comprar()       # 2 (troco) → Esgotada
m.inserir(1)      # OperacaoInvalida
\`\`\``,
      starter: `class OperacaoInvalida(Exception):
    pass


class Estado:
    """Comportamento padrão. Cada estado sobrescreve o que pode fazer."""

    def inserir(self, maquina, valor):
        raise OperacaoInvalida(f"não é possível inserir no estado {type(self).__name__}")

    def comprar(self, maquina):
        raise OperacaoInvalida(f"não é possível comprar no estado {type(self).__name__}")

    def cancelar(self, maquina):
        return 0

    def repor(self, maquina, qtd):
        maquina.estoque += qtd


class SemCredito(Estado):
    pass


class ComCredito(Estado):
    pass


class Esgotada(Estado):
    pass


class Maquina:
    def __init__(self, preco, estoque):
        self.preco = preco
        self.estoque = estoque
        self.credito = 0
        self.estado = None   # TODO: SemCredito() ou Esgotada()

    def inserir(self, valor):
        self.estado.inserir(self, valor)

    def comprar(self):
        return self.estado.comprar(self)

    def cancelar(self):
        return self.estado.cancelar(self)

    def repor(self, qtd):
        self.estado.repor(self, qtd)
`,
      tests: [
        { name: 'começa em SemCredito', code: 'm = Maquina(5, 3)\nassert isinstance(m.estado, SemCredito), type(m.estado).__name__' },
        {
          name: 'inserir e comprar com troco',
          code: `m = Maquina(5, 3)
m.inserir(2)
m.inserir(5)
assert isinstance(m.estado, ComCredito), type(m.estado).__name__
troco = m.comprar()
assert troco == 2, f"troco = {troco}"
assert (m.estoque, m.credito) == (2, 0), (m.estoque, m.credito)
assert isinstance(m.estado, SemCredito), type(m.estado).__name__`,
        },
        {
          name: 'comprar sem crédito é inválido',
          code: `m = Maquina(5, 3)
try:
    m.comprar()
except OperacaoInvalida:
    pass
else:
    raise AssertionError("comprar sem crédito deveria lançar OperacaoInvalida")`,
        },
        {
          name: 'crédito insuficiente não muda nada',
          code: `m = Maquina(5, 3)
m.inserir(3)
try:
    m.comprar()
except OperacaoInvalida:
    pass
else:
    raise AssertionError("crédito insuficiente deveria lançar OperacaoInvalida")
assert (m.credito, m.estoque) == (3, 3), (m.credito, m.estoque)
assert isinstance(m.estado, ComCredito), type(m.estado).__name__`,
        },
        {
          name: 'cancelar devolve o crédito',
          code: `m = Maquina(5, 3)
m.inserir(4)
assert m.cancelar() == 4
assert m.credito == 0 and isinstance(m.estado, SemCredito), (m.credito, type(m.estado).__name__)
assert m.cancelar() == 0`,
        },
        {
          name: 'último item: Esgotada',
          hidden: true,
          code: `m = Maquina(5, 1)
m.inserir(5)
assert m.comprar() == 0
assert isinstance(m.estado, Esgotada), type(m.estado).__name__
for acao in (lambda: m.inserir(1), m.comprar):
    try:
        acao()
    except OperacaoInvalida:
        pass
    else:
        raise AssertionError("máquina esgotada deveria recusar inserir e comprar")
assert m.cancelar() == 0 and m.credito == 0`,
        },
        { name: 'estoque inicial zero', hidden: true, code: 'm = Maquina(5, 0)\nassert isinstance(m.estado, Esgotada), type(m.estado).__name__' },
        {
          name: 'repor tira de Esgotada',
          hidden: true,
          code: `m = Maquina(5, 0)
m.repor(2)
assert isinstance(m.estado, SemCredito) and m.estoque == 2, (type(m.estado).__name__, m.estoque)
m.inserir(5)
assert m.comprar() == 0 and m.estoque == 1`,
        },
        {
          name: 'repor com crédito continua ComCredito',
          hidden: true,
          code: `m = Maquina(5, 1)
m.inserir(3)
m.repor(1)
assert isinstance(m.estado, ComCredito), type(m.estado).__name__
assert (m.credito, m.estoque) == (3, 2), (m.credito, m.estoque)`,
        },
        { name: 'repor(0) em Esgotada continua Esgotada', hidden: true, code: 'm = Maquina(5, 0)\nm.repor(0)\nassert isinstance(m.estado, Esgotada), type(m.estado).__name__' },
        {
          name: 'compras seguidas com crédito exato',
          hidden: true,
          code: `m = Maquina(3, 5)
for _ in range(2):
    m.inserir(3)
    assert m.comprar() == 0
assert m.estoque == 3 and isinstance(m.estado, SemCredito), (m.estoque, type(m.estado).__name__)`,
        },
      ],
      reviews: [
        {
          when: (m, code) => m.calls.includes('isinstance') || /type\(\s*(self|maquina)\.estado\s*\)/.test(code),
          text: 'O código pergunta **qual é o estado** (`isinstance`/`type`) para decidir o que fazer — isso recria o `if/elif` que o State elimina. Deixe cada classe de estado responder pela própria ação.',
          concept: 'State',
        },
      ],
      hints: [
        'Comece pelo `__init__` da `Maquina`: `self.estado = SemCredito() if estoque > 0 else Esgotada()`.',
        'Cada estado sobrescreve só o que pode fazer e troca o estado do contexto. Em `SemCredito.inserir`: `maquina.credito += valor` e `maquina.estado = ComCredito()`.',
        'Em `ComCredito.comprar`, valide primeiro (`if maquina.credito < maquina.preco: raise OperacaoInvalida(...)`), calcule o troco, atualize estoque e crédito e escolha o próximo estado com `Esgotada() if maquina.estoque == 0 else SemCredito()`. Em `Esgotada.repor`, chame `super().repor(maquina, qtd)` antes de decidir a transição.',
      ],
      solution: `class OperacaoInvalida(Exception):
    pass


class Estado:
    """Comportamento padrão. Cada estado sobrescreve o que pode fazer."""

    def inserir(self, maquina, valor):
        raise OperacaoInvalida(f"não é possível inserir no estado {type(self).__name__}")

    def comprar(self, maquina):
        raise OperacaoInvalida(f"não é possível comprar no estado {type(self).__name__}")

    def cancelar(self, maquina):
        return 0

    def repor(self, maquina, qtd):
        maquina.estoque += qtd


class SemCredito(Estado):
    def inserir(self, maquina, valor):
        maquina.credito += valor
        maquina.estado = ComCredito()


class ComCredito(Estado):
    def inserir(self, maquina, valor):
        maquina.credito += valor

    def comprar(self, maquina):
        if maquina.credito < maquina.preco:
            raise OperacaoInvalida(f"crédito insuficiente: {maquina.credito} < {maquina.preco}")
        troco = maquina.credito - maquina.preco
        maquina.credito = 0
        maquina.estoque -= 1
        maquina.estado = Esgotada() if maquina.estoque == 0 else SemCredito()
        return troco

    def cancelar(self, maquina):
        devolvido = maquina.credito
        maquina.credito = 0
        maquina.estado = SemCredito()
        return devolvido


class Esgotada(Estado):
    def repor(self, maquina, qtd):
        super().repor(maquina, qtd)
        if maquina.estoque > 0:
            maquina.estado = SemCredito()


class Maquina:
    def __init__(self, preco, estoque):
        self.preco = preco
        self.estoque = estoque
        self.credito = 0
        self.estado = SemCredito() if estoque > 0 else Esgotada()

    def inserir(self, valor):
        self.estado.inserir(self, valor)

    def comprar(self):
        return self.estado.comprar(self)

    def cancelar(self):
        return self.estado.cancelar(self)

    def repor(self, qtd):
        self.estado.repor(self, qtd)
`,
      solutionExplanation: 'A `Maquina` não tem nenhum `if` sobre o estado: cada ação é delegada, e **cada estado decide** o que acontece e para onde ir. A classe base concentra o comportamento padrão ("proibido", "devolve 0", "soma ao estoque"), então cada estado só sobrescreve o que muda nele — `Esgotada.repor` reaproveita a base com `super()` e só acrescenta a transição. Validar antes de alterar garante que uma compra com crédito insuficiente não deixa a máquina pela metade. E como os estados não guardam dados próprios, daria até para compartilhar uma instância de cada (eles são *flyweights*).',
    },
    {
      type: 'open',
      id: 'dp-sta-q5',
      concept: 'Compare-and-set',
      say: 'Pergunta de entrevista sênior: o seu pedido agora mora num banco, atrás de uma API com várias instâncias.',
      prompt: 'O status do pedido fica numa tabela `pedidos`. Duas requisições chegam juntas: o cliente pede **cancelar** e o webhook do gateway avisa que o pagamento foi **aprovado**. Como você evita que as duas transições "vençam" e deixem o pedido inconsistente?',
      minWords: 25,
      rubric: [
        { label: 'Identifica a **condição de corrida** (as duas leem NOVO e gravam)', keywords: ['corrida', 'race', 'concorren', 'simultane', 'ao mesmo tempo', 'lost update', 'ultima escrita', 'last write', 'as duas leem', 'ambas leem'], concept: 'Condição de corrida', why: 'Ler, validar na memória e depois gravar deixa uma janela em que as duas requisições enxergam o mesmo estado.' },
        { label: 'Transição **atômica**: `UPDATE ... WHERE status = <esperado>` (compare-and-set)', keywords: [['update', 'where'], 'compare-and-set', 'compare and set', 'compare-and-swap', 'condicional', 'atomic', 'atomica', 'status esperado', 'estado esperado'], concept: 'Compare-and-set', why: 'A checagem e a escrita acontecem numa operação só no banco: apenas uma requisição consegue sair de NOVO.' },
        { label: 'Detecta o conflito (**linhas afetadas**, versão, lock) e o trata (409, recarregar, estornar)', keywords: ['linhas afetadas', 'rowcount', 'afetad', 'versao', 'version', 'otimista', 'optimistic', 'conflito', '409', 'pessimista', 'for update', 'lock', 'trava', 'estorn'], concept: 'Lock otimista', why: 'Quem perdeu a corrida precisa saber: recarregar e decidir (ex.: estornar o pagamento que chegou num pedido cancelado).' },
        { label: 'Registra as transições (**histórico**) ou trata o webhook de forma **idempotente**', keywords: ['histor', 'auditor', 'idempot', 'registr', 'trilha', 'log de transic', 'tabela de eventos'], concept: 'Auditoria de transições', why: 'Um histórico explica o que aconteceu; e gateways reenviam webhooks, então processá-los precisa ser idempotente.' },
      ],
      modelAnswer: `O problema é uma **condição de corrida**: as duas requisições leem NOVO, cada uma valida a transição na memória e grava — a última escrita vence, e o pedido pode acabar PAGO depois de o cliente ver "cancelado".

A correção é tornar a transição **atômica** no banco, com *compare-and-set*: \`UPDATE pedidos SET status = 'CANCELADO' WHERE id = 42 AND status = 'NOVO'\`. A checagem e a escrita viram uma operação só, e apenas uma das requisições consegue sair de NOVO.

A outra vê **0 linhas afetadas** e trata o conflito: recarrega o pedido e decide — responde **409** ou, se o pedido já foi cancelado, **estorna** o pagamento aprovado. Uma coluna de versão (lock otimista) generaliza a ideia; \`SELECT ... FOR UPDATE\` (lock pessimista) também resolve, com mais contenção.

Por fim, eu registraria cada transição numa tabela de **histórico** (de, para, evento, quando) e processaria o webhook de forma **idempotente**, porque gateways reenviam notificações.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! State = o objeto **muda de comportamento conforme a fase**, com transições explícitas.',
        'Classes quando cada fase tem muita regra; tabela quando o que importa são as setas. E sempre: transição inválida **falha alto**. Próximo: Template Method!',
      ],
      board: null,
    },
  ],
});
