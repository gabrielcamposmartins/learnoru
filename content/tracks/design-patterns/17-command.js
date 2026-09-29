Game.registerModule('design-patterns', {
  id: 'command',
  title: 'Command',
  kind: 'lesson',
  level: 2,
  order: 32,
  unit: 'comportamentais',
  summary: 'Transformar ações em objetos: filas de jobs com retry, macros tudo-ou-nada e desfazer com estorno.',
  concepts: ['Command', 'Invoker × Receiver', 'Macro command', 'Fila de jobs', 'Compensação'],
  takeaways: [
    'Command **reifica** uma chamada: ação, receptor e argumentos viram um objeto que pode ser guardado, enfileirado, repetido ou desfeito.',
    'O **Invoker** decide *quando* e *quantas vezes* executar; o **Receiver** sabe *como* fazer o trabalho. Separar os dois é o que viabiliza filas, retry e agendamento.',
    'Em Python, comando sem desfazer costuma ser só um **callable**: função, `lambda` ou `functools.partial` — um *thunk*.',
    'Desfazer é **LIFO**: a macro desfaz na ordem inversa e, se falhar no meio, compensa o que já executou (tudo ou nada).',
    'Com dinheiro, desfazer não apaga: vira um **comando de compensação** (estorno). E comando sujeito a retry precisa ser **idempotente**.',
  ],
  glossary: [
    { term: 'Command', aliases: ['padrão Command', 'Command pattern'], definition: 'Padrão comportamental do GoF que encapsula uma requisição como objeto — com receptor e argumentos — para que ela possa ser enfileirada, registrada, repetida ou desfeita.' },
    { term: 'Invoker', aliases: ['invocador'], definition: 'No Command, quem dispara a execução (botão, fila de jobs, agendador) sem saber o que o comando faz por dentro.' },
    { term: 'Receiver', aliases: ['receptor do comando'], definition: 'No Command, o objeto que sabe fazer o trabalho de verdade (ex.: a carteira que deposita). O comando guarda uma referência a ele.' },
    { term: 'Macro command', aliases: ['macro commands', 'MacroCommand', 'comando composto'], definition: 'Comando formado por uma lista de comandos: executa em ordem e desfaz na ordem inversa. É Command + Composite.' },
    { term: 'Thunk', aliases: ['thunks'], definition: 'Função sem argumentos que embrulha uma computação para rodar depois, como `lambda: conta.sacar(20)`. O nome vem da implementação do *call-by-name* do ALGOL 60 (1961).' },
    { term: 'Transação de compensação', aliases: ['compensating transaction', 'comando de compensação', 'estorno'], definition: 'Operação que anula o **efeito** de outra registrando um lançamento inverso (ex.: estorno), em vez de apagar o histórico.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é dia de **Command**: transformar uma ação em **objeto**.',
        'Pensa na carteira digital de um app. O produto pediu três coisas: desfazer operações, agendar cobranças e **tentar de novo** o que falhou.',
        'Com chamadas diretas de método, nada disso tem onde se encaixar. Olha só:',
      ],
      board: {
        title: 'O problema: a chamada acontece e some',
        code: `class Carteira:
    def __init__(self, saldo=0):
        self.saldo = saldo

    def depositar(self, valor):
        self.saldo += valor

    def sacar(self, valor):
        if valor > self.saldo:
            raise SaldoInsuficiente(f"saldo {self.saldo} < {valor}")
        self.saldo -= valor


carteira = Carteira(100)
carteira.sacar(30)     # executou… e acabou.

# E agora?
# - Como DESFAZER esse saque?
# - Como AGENDAR uma cobrança para amanhã?
# - Como TENTAR DE NOVO se o banco estiver fora do ar?
# - Como REGISTRAR o que foi feito, para auditoria?`,
        caption: 'Uma chamada de método é efêmera: depois que roda, não sobra nada para guardar, repetir ou reverter.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A saída do Command é **congelar a chamada** num objeto: quem vai fazer o trabalho, com quais argumentos — e, se possível, como desfazer.',
        'São quatro papéis. Guarde bem a diferença entre **Invoker** e **Receiver**: é a pegadinha favorita em entrevista.',
      ],
      board: {
        title: 'Os papéis do Command',
        md: `\`\`\`text
  Client ──monta──▶ Command ──guarda──▶ Receiver
                      ▲                (sabe fazer)
                      │ executar()
                   Invoker
     (decide QUANDO e QUANTAS vezes)
\`\`\`

| Papel | Responsabilidade | Na carteira |
|---|---|---|
| **Command** | Guarda receptor + argumentos e expõe \`executar()\` (às vezes \`desfazer()\`) | \`Sacar(carteira, 30)\` |
| **Receiver** | Sabe fazer o trabalho de verdade | \`Carteira\` |
| **Invoker** | Dispara comandos sem saber o que eles fazem | botão, fila de jobs, agendador |
| **Client** | Monta o comando e o entrega ao invoker | o handler da API |

> [!dica] Em uma frase: Command transforma um **verbo** (\`sacar\`) num **substantivo** (\`Sacar(...)\`). E substantivos cabem em listas, filas, bancos de dados…

> [!atencao] **Não confunda com Strategy.** Os dois embrulham comportamento num objeto, mas a estratégia responde *como* o contexto faz algo (e recebe os dados na hora); o comando é *o que* fazer — um pedido completo, já com os argumentos, pronto para ser guardado e executado depois.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na versão clássica, cada operação vira uma classe com `executar()` e, quando faz sentido, `desfazer()`.',
        'O comando guarda **tudo** que precisa para rodar depois. Dá para criar agora e executar amanhã — ou nunca.',
      ],
      board: {
        title: 'Command clássico, com desfazer',
        code: `class Depositar:
    def __init__(self, carteira, valor):
        self.carteira = carteira     # o receiver
        self.valor = valor           # argumentos "congelados"

    def executar(self):
        self.carteira.depositar(self.valor)

    def desfazer(self):
        self.carteira.sacar(self.valor)


class Sacar:
    def __init__(self, carteira, valor):
        self.carteira = carteira
        self.valor = valor

    def executar(self):
        self.carteira.sacar(self.valor)

    def desfazer(self):
        self.carteira.depositar(self.valor)


historico = []                           # pilha de comandos executados
for cmd in [Depositar(carteira, 50), Sacar(carteira, 20)]:
    cmd.executar()
    historico.append(cmd)

historico.pop().desfazer()               # desfaz o ÚLTIMO (LIFO)`,
        caption: 'Cada comando sabe se desfazer. O histórico é só uma **pilha**: desfazer = `pop()` + `desfazer()`.',
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora o jeito pythônico: se o comando só precisa ser **executado**, ele pode ser qualquer *callable*.',
        'Função, `lambda`, método ligado ou `functools.partial` — o invoker só precisa saber chamar `()`.',
      ],
      board: {
        title: 'Callables como comandos',
        md: `\`\`\`python
from functools import partial

def avisar_cliente():
    print("operação concluída")

fila = [
    partial(carteira.depositar, 50),   # chamada "congelada"
    lambda: carteira.sacar(20),        # closure: a mesma ideia
    avisar_cliente,                    # função sem argumentos
]

for comando in fila:       # o invoker só sabe chamar ()
    comando()
\`\`\`

| Use um **callable** quando… | Use uma **classe** quando… |
|---|---|
| só precisa executar depois | precisa de \`desfazer()\` |
| não há metadados | quer nome, id, descrição para log |
| vive só na memória | vai **serializar** (fila, banco, rede) |

> [!sabia] Um callable sem argumentos que embrulha uma computação para depois tem nome: **thunk**. O termo nasceu em 1961, na implementação do *call-by-name* do ALGOL 60, e segue vivo em compiladores, na avaliação preguiçosa do Haskell e no \`redux-thunk\` do JavaScript. Todo \`lambda: carteira.sacar(20)\` é um thunk.`,
      },
    },
    {
      type: 'say',
      text: [
        'Comandos também se **compõem**: uma macro é um comando feito de outros comandos — é o Composite dando as caras.',
        'E aqui mora a regra de ouro do desfazer: sempre na **ordem inversa** em que as coisas foram feitas.',
      ],
      board: {
        title: 'Macro command: vários passos, um só comando',
        md: `\`\`\`python
class Macro:
    """Um comando feito de comandos (Command + Composite)."""

    def __init__(self, comandos):
        self.comandos = list(comandos)

    def executar(self):
        for cmd in self.comandos:
            cmd.executar()

    def desfazer(self):
        for cmd in reversed(self.comandos):    # LIFO!
            cmd.desfazer()


pagar_fatura = Macro([
    Sacar(carteira, 80),        # paga a fatura
    Depositar(carteira, 4),     # cashback de 5%
])
pagar_fatura.executar()         # para o usuário, é UM passo…
pagar_fatura.desfazer()         # …e desfaz como um só
\`\`\`

Como a \`Macro\` tem a mesma interface de qualquer comando, uma macro pode conter **outras macros**.

> [!atencao] E se o 2º comando falhar depois que o 1º já rodou? A carteira fica "pela metade". Uma macro **atômica** (tudo ou nada) precisa desfazer — em ordem inversa — só os comandos que **já executaram**, e depois relançar o erro. Você vai implementar isso daqui a pouco.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora o invoker mais comum do mundo real: a **fila de jobs**.',
        'Como o comando é um objeto, a fila pode guardá-lo, executá-lo em outro momento, repetir quando falha e separar o que nunca deu certo.',
      ],
      board: {
        title: 'O poder está no Invoker',
        md: `\`\`\`text
 enfileirar(cmd) ─▶ [ cmd3 | cmd2 | cmd1 ] ─▶ worker (invoker)
                                               │
                     falhou? tenta de novo ◀───┤  até N vezes
                                               │
              esgotou? ─▶ dead letter: guarda o comando + o erro
\`\`\`

| Invoker | O que ele faz com o comando |
|---|---|
| Pilha de histórico | desfazer / refazer |
| Fila + worker | executar depois, em outro processo |
| Agendador | executar às 3h da manhã |
| Retry | executar de novo quando falha |
| Log de comandos | auditar e reexecutar após um crash |

> [!atencao] Retry só é seguro se o comando for **idempotente** (rodar duas vezes = rodar uma). "Cobrar R$ 50" repetido cobra duas vezes; "cobrar a fatura #123", checando se ela já foi paga, não.

> [!dica] No Celery, \`enviar_email.s("ana@x.com")\` cria uma *signature*: um comando serializável (nome da tarefa + argumentos) que viaja pela rede até um worker. É o Command atravessando processos.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Um detalhe que separa júnior de sênior: com dinheiro, **desfazer não é apagar**.',
        'O desfazer de um saque é um **novo lançamento**, o estorno. O extrato continua contando a história inteira — e a auditoria agradece.',
      ],
      board: {
        title: 'Três jeitos de desfazer',
        md: `| Desfazer por… | Como funciona | Quando usar |
|---|---|---|
| **Comando inverso** | \`Sacar.desfazer()\` deposita o valor de volta | operações reversíveis em memória (editor, jogo) |
| **Memento** | guarda uma "foto" do estado e restaura | o inverso é difícil de calcular |
| **Compensação** | um **novo** comando anula o efeito (estorno) | dinheiro, estoque, auditoria |

\`\`\`text
extrato (append-only: nada é apagado)
  #1  saque          -30,00
  #2  estorno de #1  +30,00   ◀ o "desfazer" também é um comando
\`\`\`

Nem tudo tem volta: e-mail enviado não se "desenvia", e dinheiro que já saiu para outro banco depende de regras, prazos e autorização. Nesses casos, a compensação é **outra ação de negócio** (pedir a devolução, mandar uma correção).

> [!sabia] O livro do GoF lista outros dois nomes para o Command: **Action** e **Transaction**. E o Emacs leva a ideia ao extremo: lá, *desfazer* é um comando como outro qualquer e entra no próprio histórico — por isso dá para "desfazer o desfazer" sem perder nenhum estado anterior.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Papéis, ordem de desfazer, macros atômicas e fila com retry.', icon: '🎯' },
    {
      type: 'match',
      id: 'dp-cmd-q1',
      concept: 'Invoker × Receiver',
      say: 'Primeiro, os papéis. Um sistema de assinaturas cobra os clientes todo mês usando uma fila de jobs.',
      prompt: 'Associe cada **papel do Command** ao elemento correspondente no sistema de cobrança de assinaturas.',
      pairs: [
        { left: '**Command**', right: '`CobrarAssinatura(cliente_id=7, centavos=2990)`' },
        { left: '**Receiver**', right: '`GatewayPagamento`, que sabe cobrar de verdade' },
        { left: '**Invoker**', right: '`FilaDeJobs`, que decide quando e quantas vezes executar' },
        { left: '**Client**', right: 'O endpoint que monta a cobrança e a enfileira' },
      ],
      explanation: 'O **Command** guarda o pedido completo (quem cobrar e quanto); o **Receiver** faz o trabalho; o **Invoker** dispara sem saber o que o comando faz — por isso a mesma fila serve para cobranças, e-mails e relatórios; e o **Client** só monta e entrega. Trocar Invoker por Receiver é o erro mais comum em entrevista.',
    },
    {
      type: 'mcq',
      id: 'dp-cmd-q2',
      concept: 'Desfazer LIFO',
      say: 'Agora um bug sutil de desfazer. Lê com calma.',
      prompt: `Um colega desfez os comandos na **mesma ordem** em que foram executados. O que o código imprime?

\`\`\`python
class Carteira:
    def __init__(self, saldo):
        self.saldo = saldo

class Depositar:
    def __init__(self, c, valor):
        self.c, self.valor = c, valor
    def executar(self):
        self.c.saldo += self.valor
    def desfazer(self):
        self.c.saldo -= self.valor

class Zerar:
    def __init__(self, c):
        self.c = c
    def executar(self):
        self.anterior = self.c.saldo
        self.c.saldo = 0
    def desfazer(self):
        self.c.saldo = self.anterior

c = Carteira(100)
cmds = [Depositar(c, 50), Zerar(c)]
for cmd in cmds:
    cmd.executar()
for cmd in cmds:            # mesma ordem!
    cmd.desfazer()
print(c.saldo)
\`\`\``,
      options: [
        { text: '`100`', why: 'Esse seria o resultado desfazendo na ordem **inversa**: `Zerar` restaura 150 e depois o depósito tira 50.' },
        { text: '`150`', correct: true, why: 'Desfazer o depósito primeiro leva o saldo de 0 para -50; depois `Zerar.desfazer()` **sobrescreve** com o valor guardado, 150. O depósito "desfeito" simplesmente some.' },
        { text: '`-50`', why: 'É o estado intermediário, mas o `Zerar.desfazer()` ainda roda depois e restaura 150.' },
        { text: '`0`', why: '0 é o saldo logo após executar os comandos; os dois `desfazer()` ainda o alteram.' },
      ],
      explanation: 'Comandos que **restauram estado** (como `Zerar`, que guarda o saldo anterior) não comutam com os outros: a ordem importa. Por isso o histórico é uma **pilha** e a macro desfaz com `reversed(...)` — o último a ser feito é o primeiro a ser desfeito (LIFO). Na ordem certa, o saldo voltaria a 100.',
    },
    {
      type: 'code',
      id: 'dp-cmd-q3',
      concept: 'Macro command',
      title: 'Macro tudo-ou-nada na carteira',
      say: 'Hora de codar! A carteira e os comandos simples já estão prontos. Falta a **macro atômica** — e uma transferência.',
      prompt: `A \`Carteira\`, a exceção \`SaldoInsuficiente\` e os comandos \`Depositar\` e \`Sacar\` já estão prontos no editor. Implemente:

**\`Macro(comandos)\`** — um comando feito de comandos (\`comandos\` pode ser qualquer iterável, inclusive um gerador):

- \`executar()\` executa os comandos **em ordem**. Se algum lançar exceção, desfaz **só os que já tinham executado**, em ordem **inversa**, e **relança** a mesma exceção (tudo ou nada).
- \`desfazer()\` desfaz todos os comandos, em ordem inversa.
- Uma \`Macro\` é um comando como outro qualquer: pode estar dentro de outra \`Macro\` e pode ser executada de novo depois de desfeita.

**\`Transferir(origem, destino, valor)\`** — saca de \`origem\` e deposita em \`destino\`. Sem saldo, lança \`SaldoInsuficiente\` e **nenhuma** carteira muda. \`desfazer()\` devolve tudo como estava.`,
      starter: `class SaldoInsuficiente(Exception):
    pass


class Carteira:
    def __init__(self, saldo=0):
        self.saldo = saldo

    def depositar(self, valor):
        self.saldo += valor

    def sacar(self, valor):
        if valor > self.saldo:
            raise SaldoInsuficiente(f"saldo {self.saldo} < {valor}")
        self.saldo -= valor


class Depositar:
    def __init__(self, carteira, valor):
        self.carteira = carteira
        self.valor = valor

    def executar(self):
        self.carteira.depositar(self.valor)

    def desfazer(self):
        self.carteira.sacar(self.valor)


class Sacar:
    def __init__(self, carteira, valor):
        self.carteira = carteira
        self.valor = valor

    def executar(self):
        self.carteira.sacar(self.valor)

    def desfazer(self):
        self.carteira.depositar(self.valor)


class Macro:
    def __init__(self, comandos):
        pass

    def executar(self):
        pass

    def desfazer(self):
        pass


class Transferir:
    def __init__(self, origem, destino, valor):
        pass

    def executar(self):
        pass

    def desfazer(self):
        pass
`,
      tests: [
        {
          name: 'executa em ordem',
          code: `c = Carteira(0)
Macro([Depositar(c, 100), Sacar(c, 80)]).executar()
assert c.saldo == 20, f"saldo = {c.saldo} (esperado 20)"`,
        },
        {
          name: 'desfaz em ordem inversa',
          code: `log = []
class Registro:
    def __init__(self, nome):
        self.nome = nome
    def executar(self):
        log.append("+" + self.nome)
    def desfazer(self):
        log.append("-" + self.nome)
m = Macro([Registro("a"), Registro("b"), Registro("c")])
m.executar()
m.desfazer()
assert log == ["+a", "+b", "+c", "-c", "-b", "-a"], log`,
        },
        {
          name: 'falha no meio: desfaz e relança',
          code: `c = Carteira(50)
m = Macro([Depositar(c, 10), Sacar(c, 20), Sacar(c, 100)])
try:
    m.executar()
except SaldoInsuficiente:
    pass
else:
    raise AssertionError("a exceção deveria ser relançada")
assert c.saldo == 50, f"saldo = {c.saldo}: a macro deveria desfazer o que já tinha executado"`,
        },
        {
          name: 'transferir e desfazer',
          code: `a, b = Carteira(100), Carteira(0)
t = Transferir(a, b, 30)
t.executar()
assert (a.saldo, b.saldo) == (70, 30), (a.saldo, b.saldo)
t.desfazer()
assert (a.saldo, b.saldo) == (100, 0), (a.saldo, b.saldo)`,
        },
        {
          name: 'transferência sem saldo não muda nada',
          code: `a, b = Carteira(10), Carteira(5)
try:
    Transferir(a, b, 50).executar()
except SaldoInsuficiente:
    pass
else:
    raise AssertionError("deveria lançar SaldoInsuficiente")
assert (a.saldo, b.saldo) == (10, 5), (a.saldo, b.saldo)`,
        },
        {
          name: 'só desfaz quem executou',
          hidden: true,
          code: `log = []
class Registro:
    def __init__(self, nome):
        self.nome = nome
    def executar(self):
        log.append("+" + self.nome)
    def desfazer(self):
        log.append("-" + self.nome)
class Falha:
    def executar(self):
        raise RuntimeError("boom")
    def desfazer(self):
        raise AssertionError("desfez um comando que nem chegou a executar")
m = Macro([Registro("a"), Registro("b"), Falha(), Registro("c")])
try:
    m.executar()
except RuntimeError:
    pass
else:
    raise AssertionError("a exceção deveria ser relançada")
assert log == ["+a", "+b", "-b", "-a"], log`,
        },
        {
          name: 'macro dentro de macro',
          hidden: true,
          code: `c = Carteira(0)
interna = Macro([Depositar(c, 10), Depositar(c, 5)])
externa = Macro([interna, Sacar(c, 12)])
externa.executar()
assert c.saldo == 3, c.saldo
externa.desfazer()
assert c.saldo == 0, c.saldo
falha = Macro([Macro([Depositar(c, 10)]), Sacar(c, 999)])
try:
    falha.executar()
except SaldoInsuficiente:
    pass
assert c.saldo == 0, f"saldo = {c.saldo}: a macro interna não foi desfeita"`,
        },
        { name: 'macro vazia', hidden: true, code: 'm = Macro([])\nm.executar()\nm.desfazer()' },
        {
          name: 'executar de novo depois de desfazer',
          hidden: true,
          code: `log = []
class Registro:
    def __init__(self, nome):
        self.nome = nome
    def executar(self):
        log.append("+" + self.nome)
    def desfazer(self):
        log.append("-" + self.nome)
m = Macro([Registro("a"), Registro("b")])
m.executar()
m.desfazer()
m.executar()
assert log == ["+a", "+b", "-b", "-a", "+a", "+b"], f"{log} — não inverta a lista de comandos no lugar"`,
        },
        {
          name: 'aceita gerador',
          hidden: true,
          code: `c = Carteira(0)
m = Macro(Depositar(c, v) for v in (10, 20))
m.executar()
assert c.saldo == 30, c.saldo
m.desfazer()
assert c.saldo == 0, f"saldo = {c.saldo}: guarde list(comandos) — um gerador só pode ser percorrido uma vez"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('isinstance'),
          text: 'A `Macro` pergunta o tipo dos comandos com `isinstance`. Não precisa: todo comando tem `executar()`/`desfazer()` — inclusive outra `Macro`. É o polimorfismo que faz o Composite funcionar.',
          concept: 'Polimorfismo / Composite',
        },
        {
          when: m => m.calls.includes('deepcopy'),
          text: 'Você tirou uma cópia profunda do estado para poder voltar atrás — isso é o padrão **Memento**. No Command, cada comando sabe se desfazer: a macro só precisa lembrar **quais** comandos já rodaram.',
          concept: 'Command × Memento',
        },
      ],
      hints: [
        'No `__init__`, guarde uma **lista**: `self.comandos = list(comandos)` — assim geradores funcionam e a lista pode ser percorrida quantas vezes for preciso.',
        'Em `executar`, mantenha uma lista `feitos`: execute cada comando e só então o acrescente. Envolva o laço num `try/except Exception:`; no `except`, desfaça `reversed(feitos)` e use `raise` (sem argumentos) para relançar a mesma exceção.',
        '`Transferir` pode ser uma macro! `class Transferir(Macro)` com `super().__init__([Sacar(origem, valor), Depositar(destino, valor)])`.',
      ],
      solution: `class SaldoInsuficiente(Exception):
    pass


class Carteira:
    def __init__(self, saldo=0):
        self.saldo = saldo

    def depositar(self, valor):
        self.saldo += valor

    def sacar(self, valor):
        if valor > self.saldo:
            raise SaldoInsuficiente(f"saldo {self.saldo} < {valor}")
        self.saldo -= valor


class Depositar:
    def __init__(self, carteira, valor):
        self.carteira = carteira
        self.valor = valor

    def executar(self):
        self.carteira.depositar(self.valor)

    def desfazer(self):
        self.carteira.sacar(self.valor)


class Sacar:
    def __init__(self, carteira, valor):
        self.carteira = carteira
        self.valor = valor

    def executar(self):
        self.carteira.sacar(self.valor)

    def desfazer(self):
        self.carteira.depositar(self.valor)


class Macro:
    def __init__(self, comandos):
        self.comandos = list(comandos)

    def executar(self):
        feitos = []
        try:
            for comando in self.comandos:
                comando.executar()
                feitos.append(comando)
        except Exception:
            for comando in reversed(feitos):
                comando.desfazer()
            raise

    def desfazer(self):
        for comando in reversed(self.comandos):
            comando.desfazer()


class Transferir(Macro):
    def __init__(self, origem, destino, valor):
        super().__init__([Sacar(origem, valor), Depositar(destino, valor)])
`,
      solutionExplanation: 'A macro guarda uma **cópia em lista** dos comandos (um gerador só pode ser percorrido uma vez) e, ao executar, anota em `feitos` apenas o que realmente rodou. Se algo falha, ela desfaz esses comandos em ordem **inversa** e relança a exceção com `raise` — o chamador fica sabendo e a carteira volta ao estado original (tudo ou nada). Como a `Macro` tem a mesma interface de qualquer comando, ela pode conter outras macros (**Composite**), e `Transferir` vira só uma macro de dois passos. Alternativa elegante: `contextlib.ExitStack`, empilhando `stack.callback(cmd.desfazer)` a cada passo e chamando `stack.pop_all()` quando tudo dá certo.',
    },
    {
      type: 'code',
      id: 'dp-cmd-q4',
      concept: 'Fila de jobs',
      title: 'Fila de jobs com retry e dead letter',
      say: 'Agora o lado do invoker: uma fila em que cada job é só um **callable** — e que não desiste na primeira falha.',
      prompt: `Implemente \`FilaDeJobs(max_tentativas=3)\`, o **invoker** de um sistema de jobs. Cada job é **qualquer callable sem argumentos** (função, \`lambda\`, \`functools.partial\`…).

- \`enfileirar(job)\` coloca o job no fim da fila.
- \`processar()\` executa os jobs em ordem **FIFO** até a fila esvaziar — inclusive jobs enfileirados **durante** o processamento (um job pode enfileirar outro).
- Job que retorna normalmente: o valor retornado (qualquer um, inclusive \`None\`) vai para a lista \`resultados\`.
- Job que lança exceção: tente de novo, até \`max_tentativas\` execuções no total. Se todas falharem, guarde a tupla \`(job, ultima_excecao)\` na lista \`mortos\` (a *dead letter*) e siga para o próximo.
- \`resultados\` e \`mortos\` começam vazias e pertencem a cada fila.

\`\`\`python
fila = FilaDeJobs(max_tentativas=2)
fila.enfileirar(lambda: 1 + 1)
fila.enfileirar(lambda: 1 / 0)
fila.processar()
fila.resultados   # [2]
fila.mortos       # [(<lambda>, ZeroDivisionError(...))]
\`\`\``,
      starter: `from collections import deque


class FilaDeJobs:
    def __init__(self, max_tentativas=3):
        self.max_tentativas = max_tentativas
        self.resultados = []
        self.mortos = []

    def enfileirar(self, job):
        pass

    def processar(self):
        pass
`,
      tests: [
        {
          name: 'ordem FIFO',
          code: `f = FilaDeJobs()
f.enfileirar(lambda: "a")
f.enfileirar(lambda: "b")
f.processar()
assert f.resultados == ["a", "b"], f.resultados`,
        },
        {
          name: 'aceita partial',
          code: `from functools import partial
f = FilaDeJobs()
f.enfileirar(partial(pow, 2, 10))
f.enfileirar(partial(sorted, [3, 1, 2], reverse=True))
f.processar()
assert f.resultados == [1024, [3, 2, 1]], f.resultados`,
        },
        {
          name: 'retry até dar certo',
          code: `tentativas = []
def instavel():
    tentativas.append(1)
    if len(tentativas) < 3:
        raise ConnectionError("fora do ar")
    return "ok"
f = FilaDeJobs(max_tentativas=3)
f.enfileirar(instavel)
f.processar()
assert f.resultados == ["ok"], f.resultados
assert len(tentativas) == 3, f"executou {len(tentativas)} vezes"
assert f.mortos == [], f.mortos`,
        },
        {
          name: 'esgota as tentativas e vai para mortos',
          code: `chamadas = []
def sempre_falha():
    chamadas.append(1)
    raise TimeoutError(f"tentativa {len(chamadas)}")
f = FilaDeJobs(max_tentativas=2)
f.enfileirar(sempre_falha)
f.enfileirar(lambda: "seguinte")
f.processar()
assert len(chamadas) == 2, f"executou {len(chamadas)} vezes (esperado 2)"
assert len(f.mortos) == 1 and f.mortos[0][0] is sempre_falha, f.mortos
assert str(f.mortos[0][1]) == "tentativa 2", "guarde a ÚLTIMA exceção"
assert f.resultados == ["seguinte"], f.resultados`,
        },
        { name: 'fila vazia', code: 'f = FilaDeJobs()\nf.processar()\nassert f.resultados == [] and f.mortos == []' },
        {
          name: 'job que enfileira outro job',
          hidden: true,
          code: `f = FilaDeJobs()
def pai():
    f.enfileirar(lambda: "filho")
    return "pai"
f.enfileirar(pai)
f.enfileirar(lambda: "irmão")
f.processar()
assert f.resultados == ["pai", "irmão", "filho"], f.resultados`,
        },
        {
          name: 'None também é sucesso',
          hidden: true,
          code: `chamadas = []
def registra():
    chamadas.append(1)
f = FilaDeJobs()
f.enfileirar(registra)
f.processar()
assert chamadas == [1], "um job que retorna None não falhou: não tente de novo"
assert f.resultados == [None] and f.mortos == [], (f.resultados, f.mortos)`,
        },
        {
          name: 'max_tentativas=1 não repete',
          hidden: true,
          code: `chamadas = []
def falha():
    chamadas.append(1)
    raise ValueError("x")
f = FilaDeJobs(max_tentativas=1)
f.enfileirar(falha)
f.processar()
assert len(chamadas) == 1 and len(f.mortos) == 1, (chamadas, f.mortos)`,
        },
        {
          name: 'filas independentes',
          hidden: true,
          code: `a, b = FilaDeJobs(), FilaDeJobs()
a.enfileirar(lambda: 1)
b.processar()
assert b.resultados == [], "a fila B executou um job da fila A (estado compartilhado?)"
a.processar()
assert a.resultados == [1], a.resultados`,
        },
        {
          name: 'processar de novo não repete jobs',
          hidden: true,
          code: `f = FilaDeJobs()
f.enfileirar(lambda: "x")
f.processar()
f.processar()
assert f.resultados == ["x"], f.resultados`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0,
          text: '`except:` sem tipo captura até `KeyboardInterrupt` e `SystemExit` — um Ctrl+C viraria "mais uma tentativa". Use `except Exception as e:`.',
          concept: 'Tratamento de exceções',
        },
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: '`lista.pop(0)` é O(n): cada remoção desloca todos os elementos. Para fila, use `collections.deque` com `popleft()`, que é O(1).',
          concept: 'deque (fila O(1))',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`/`nonlocal`: o estado da fila deve viver na instância (`self`), senão filas diferentes se misturam.',
          concept: 'Encapsulamento',
        },
      ],
      hints: [
        'Crie a fila no `__init__` com `self._fila = deque()`: `enfileirar` faz `append` e o processamento usa `popleft()`.',
        'Use `while self._fila:` em vez de um `for`: assim o laço enxerga os jobs enfileirados no meio do caminho.',
        'Para as tentativas: `for _ in range(self.max_tentativas):` com `try/except Exception as e`. No sucesso, guarde o resultado e dê `break`. O `else` do `for` só roda se não houve `break` — é ali que o job vai para `mortos`.',
      ],
      solution: `from collections import deque


class FilaDeJobs:
    def __init__(self, max_tentativas=3):
        self.max_tentativas = max_tentativas
        self.resultados = []
        self.mortos = []
        self._fila = deque()

    def enfileirar(self, job):
        self._fila.append(job)

    def processar(self):
        while self._fila:
            job = self._fila.popleft()
            ultimo_erro = None
            for _ in range(self.max_tentativas):
                try:
                    resultado = job()
                except Exception as e:
                    ultimo_erro = e
                else:
                    self.resultados.append(resultado)
                    break
            else:
                self.mortos.append((job, ultimo_erro))
`,
      solutionExplanation: 'A fila é um **invoker**: não sabe o que cada job faz, só decide *quando* e *quantas vezes* chamá-lo. O `deque` dá `append`/`popleft` em O(1), e o `while self._fila` processa também os jobs criados durante o processamento. O `for ... else` expressa "tentei N vezes e nenhuma deu `break`" sem flags extras, e sucesso é simplesmente "não lançou exceção" — por isso `None` também conta. Em produção, você somaria **backoff com jitter** entre as tentativas e exigiria jobs **idempotentes**, porque um job pode rodar mais de uma vez.',
    },
    {
      type: 'open',
      id: 'dp-cmd-q5',
      concept: 'Transação de compensação',
      say: 'Última, e é de entrevista sênior. Pense em auditoria, cliques duplos e no mundo fora do seu sistema.',
      prompt: 'O suporte quer um botão **"desfazer"** para saques já confirmados na carteira digital. Por que não basta apagar o registro do saque (ou mexer direto no saldo)? Como você modelaria esse desfazer com Command?',
      minWords: 25,
      rubric: [
        { label: 'Desfazer vira um **novo comando de compensação** (estorno), não uma exclusão', keywords: ['estorn', 'compens', 'lancamento inverso', 'novo lancamento', 'novo comando', 'comando inverso', 'operacao inversa', 'credito de volta'], concept: 'Transação de compensação', why: 'O efeito é anulado por uma operação nova e explícita, que também fica registrada.' },
        { label: 'Preserva a **trilha de auditoria** (histórico imutável)', keywords: ['auditor', 'historico', 'rastro', 'rastreab', 'append', 'imutavel', 'extrato', 'trilha', 'compliance', 'regulat', 'nada e apagado', 'nao apagar'], concept: 'Auditoria', why: 'Em sistemas financeiros, o registro do que aconteceu não pode sumir; apagar esconde a história e quebra a conciliação.' },
        { label: 'Garante **idempotência** (clique duplo ou retry não estorna duas vezes)', keywords: ['idempot', 'duas vezes', 'duplic', 'uma unica vez', 'so uma vez', 'uma vez so', 'id da operacao', 'id do saque', 'chave'], concept: 'Idempotência', why: 'O estorno referencia o saque original e deve ser aplicado no máximo uma vez.' },
        { label: 'Reconhece que **nem tudo é reversível** (regras, prazos, efeitos externos)', keywords: ['irreversi', 'nao e reversivel', 'nem tudo', 'nao tem volta', 'externo', 'outro banco', 'ja saiu', 'prazo', 'regra', 'autoriza', 'aprova', 'permiss'], concept: 'Efeitos colaterais', why: 'Se o dinheiro já saiu do sistema, "desfazer" depende de regras de negócio e aprovação — às vezes é outra ação, como pedir a devolução.' },
      ],
      modelAnswer: `Apagar o registro destrói a **trilha de auditoria**: num sistema financeiro o extrato é *append-only* — ele precisa contar tudo o que aconteceu, inclusive o engano. Mexer direto no saldo tem o mesmo problema e ainda deixa saldo e histórico inconsistentes.

Com Command, o desfazer vira um **novo comando de compensação**: \`Estornar(saque_id)\` registra um lançamento inverso (um crédito que referencia o saque original). O \`Sacar\` continua no histórico e o \`Estornar\` também — os dois auditáveis.

O estorno precisa ser **idempotente**: usando o id do saque como chave, um clique duplo ou um retry não gera dois créditos.

E **nem tudo é reversível**: se o dinheiro já saiu para outro banco, o estorno depende de regras, prazos e autorização — às vezes a compensação é outra ação de negócio, como pedir a devolução.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Command = **ação vira objeto**: dá para guardar, enfileirar, repetir e desfazer.',
        'Lembre: invoker decide *quando*, receiver sabe *como*; desfazer é LIFO; com dinheiro, desfazer é **estorno**; e retry pede idempotência. Próximo: State!',
      ],
      board: null,
    },
  ],
});
