Game.registerModule('design-patterns', {
  id: 'mediator',
  title: 'Mediator',
  kind: 'lesson',
  level: 2,
  order: 37,
  unit: 'comportamentais',
  summary: 'Troque a malha de conversas entre objetos por um coordenador central — sem deixá-lo virar um God Object.',
  concepts: ['Mediator', 'Colleagues', 'Mediator × Observer × Facade', 'God Object'],
  takeaways: [
    'O **Mediator** troca a malha de referências entre colegas (até n(n−1)/2 ligações) por uma **estrela**: cada colega só conhece o mediator.',
    'A regra de interação fica **num lugar só** — ótimo para diálogos de UI, salas de chat e coordenação de recursos compartilhados, como a pista da torre de controle.',
    '**Observer**: um emissor avisa N ouvintes e a reação fica espalhada. **Mediator**: coordenação **centralizada**, muitos ↔ muitos. **Facade**: porta de entrada de mão única para um subsistema.',
    'O preço: o mediator tende a virar um **God Object**. Mantenha-o focado em coordenar (um por caso de uso) e deixe as regras de negócio no domínio.',
  ],
  glossary: [
    { term: 'Mediator', aliases: ['mediador', 'mediators'], definition: 'Padrão comportamental (GoF) que centraliza a comunicação entre objetos (*colleagues*): eles falam só com o mediator, que coordena quem reage a quê.' },
    { term: 'Colleague', aliases: ['colleagues'], definition: 'Nome dado pelo GoF a cada objeto coordenado por um Mediator. Um colleague conhece apenas o mediator — nunca os outros colleagues.' },
    { term: 'Event Aggregator', aliases: ['agregador de eventos'], definition: 'Padrão descrito por Martin Fowler: um canal único onde objetos publicam e assinam eventos. Mistura Observer e Mediator, mas sem regras de coordenação.' },
    { term: 'Blackboard', aliases: ['arquitetura blackboard', 'quadro-negro'], definition: 'Arquitetura em que especialistas independentes leem e escrevem num repositório de dados compartilhado, e um controle decide quem age a seguir. Nasceu no Hearsay-II (Carnegie Mellon, anos 1970).' },
    { term: 'Lei de Brooks', aliases: ["Brooks's law", 'Brooks law'], definition: '"Adicionar pessoas a um projeto de software atrasado o atrasa ainda mais" (Fred Brooks, 1975). Um dos motivos: os canais de comunicação crescem como n(n−1)/2.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje vamos conhecer o **Mediator**, o padrão das conversas organizadas.',
        'Imagine uma tela de checkout em que cada componente conversa direto com os outros. Funciona… até chegar a quinta regra nova.',
      ],
      board: {
        title: 'O problema: todo mundo conhece todo mundo',
        md: `\`\`\`python
class CheckboxOutroEndereco:
    def __init__(self, campo_endereco, botao_confirmar, resumo_frete):
        self.campo_endereco = campo_endereco      # conhece o campo…
        self.botao_confirmar = botao_confirmar    # …o botão…
        self.resumo_frete = resumo_frete          # …e o resumo do frete
        self.marcado = False

    def clicar(self):
        self.marcado = not self.marcado
        self.campo_endereco.habilitado = self.marcado
        self.botao_confirmar.habilitado = not self.marcado
        self.resumo_frete.recalcular()
\`\`\`

\`\`\`text
SEM mediator (6 ligações)      COM mediator (4 ligações)

Checkbox ◀──▶ Campo            Checkbox ──▶ ┌──────────┐ ◀── Campo
Checkbox ◀──▶ Botão                         │ Mediator │
Checkbox ◀──▶ Frete            Frete ─────▶ └──────────┘ ◀── Botão
Campo    ◀──▶ Botão
Campo    ◀──▶ Frete
Botão    ◀──▶ Frete
\`\`\`

- Com 4 componentes, até **6** ligações diretas; com 10, **45** — cresce como n(n−1)/2.
- O checkbox não é reutilizável: ele carrega regras de **outra** tela dentro dele.

> [!nota] É a mesma aritmética da **Lei de Brooks** (1975): uma equipe com n pessoas tem n(n−1)/2 canais de comunicação — por isso colocar mais gente num projeto atrasado pode atrasá-lo ainda mais.`,
      },
    },
    {
      type: 'say',
      text: [
        'A solução: os componentes deixam de se conhecer. Cada um só **avisa** o mediator que algo aconteceu.',
        'O mediator conhece todos e concentra a regra de interação: quem reage, em que ordem e como.',
      ],
      board: {
        title: 'Mediator: a regra de interação num lugar só',
        md: '**Intenção (GoF):** definir um objeto que encapsula **como** um conjunto de objetos interage. Os participantes (*colleagues*) não se referem uns aos outros: falam com o mediator, que decide quem reage.',
        code: `class Componente:
    mediator = None

    def avisar(self, evento):
        self.mediator.notificar(self, evento)     # fala só com o mediator


class Checkbox(Componente):
    def __init__(self):
        self.marcado = False

    def clicar(self):
        self.marcado = not self.marcado
        self.avisar("alternou")


class Campo(Componente):
    def __init__(self):
        self.habilitado = False
        self.texto = ""

    def digitar(self, texto):
        self.texto = texto
        self.avisar("digitou")


class Botao(Componente):
    def __init__(self):
        self.habilitado = True


class TelaDeEntrega:                              # o Mediator
    def __init__(self):
        self.outro_endereco = Checkbox()
        self.endereco = Campo()
        self.confirmar = Botao()
        for c in (self.outro_endereco, self.endereco, self.confirmar):
            c.mediator = self

    def notificar(self, emissor, evento):         # a regra mora AQUI
        self.endereco.habilitado = self.outro_endereco.marcado
        falta_endereco = self.outro_endereco.marcado and not self.endereco.texto.strip()
        self.confirmar.habilitado = not falta_endereco`,
        caption: '`Checkbox`, `Campo` e `Botao` não se conhecem — servem para qualquer tela. A regra "confirmar exige endereço" está escrita uma única vez.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Você convive com mediators o tempo todo. O exemplo clássico é a **torre de controle**: aviões não combinam a pista entre si, falam com a torre.',
        'Salas de chat, diálogos de UI e orquestradores de processos seguem a mesma ideia.',
      ],
      board: {
        title: 'Mediators do mundo real',
        md: `| Mediator | Colegas | O que ele coordena |
|---|---|---|
| **Torre de controle** | aviões | quem usa a pista e em que ordem — aviões não negociam entre si |
| **Sala de chat** | usuários | quem recebe cada mensagem: todos, privado, silenciados |
| **Diálogo de UI** | widgets | habilitar, preencher e validar campos em conjunto |
| **Orquestrador de saga** | serviços | a sequência de passos de um processo distribuído e suas compensações |

\`\`\`python
class SalaDeChat:
    def __init__(self):
        self.membros = {}

    def entrar(self, usuario):
        self.membros[usuario.nome] = usuario
        usuario.sala = self                      # o usuário só conhece a sala

    def enviar(self, remetente, texto, para=None):
        if para is not None:                     # privado: só o destinatário
            self.membros[para].receber(f"(privado) {remetente.nome}: {texto}")
            return
        for membro in self.membros.values():     # público: todos menos quem enviou
            if membro is not remetente:
                membro.receber(f"{remetente.nome}: {texto}")
\`\`\`

> [!dica] Em microsserviços, o mesmo dilema reaparece como **orquestração** (um coordenador central, no estilo Mediator) × **coreografia** (cada serviço reage a eventos, no estilo Observer).`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora a pergunta que todo entrevistador adora: qual a diferença entre **Mediator**, **Observer** e **Facade**?',
        'Os três "ficam no meio" de outros objetos. O que muda é **quem conhece quem** e **onde mora a regra**.',
      ],
      board: {
        title: 'Mediator × Observer × Facade',
        md: `| | Mediator | Observer | Facade |
|---|---|---|---|
| Direção | muitos ↔ muitos, via centro | um → muitos | cliente → subsistema |
| Quem conhece quem | colegas conhecem **só** o mediator | o emissor **não** conhece os ouvintes | o subsistema **não** sabe da fachada |
| Onde mora a regra | **centralizada** no mediator | **espalhada** pelos ouvintes | não há coordenação: só simplifica |
| Pergunta que responde | "quem reage a isto, e como?" | "quem quer saber disto?" | "como usar isto sem sofrer?" |

- Eles se **combinam**: é comum o mediator **assinar eventos** dos colegas (Observer por baixo) em vez de receber chamadas diretas.
- Um canal único de eventos **sem** regras de coordenação é outro padrão: o *Event Aggregator*, descrito por Martin Fowler.

> [!dica] Teste rápido: se você apagar o objeto do meio, os outros perdem só a **conveniência** (Facade) ou perdem a **coordenação** (Mediator)?`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o lado sombrio: toda a lógica de interação foi para **um** lugar. Com o tempo, esse lugar engorda.',
        'Um mediator que sabe de tudo e decide tudo vira um **God Object** — o acoplamento não sumiu, só se mudou para o centro.',
      ],
      board: {
        title: '⚠️ Quando o mediator vira God Object',
        md: `**Sinais de alerta**

- Regras de **negócio** (cálculo de frete, validação de CPF) dentro do mediator, além da coordenação.
- Um \`if/elif\` gigante por **emissor × evento**.
- Toda feature, de qualquer tela, passa por editar a **mesma** classe.

**Como conter**

\`\`\`python
class TelaDeEntrega:
    def __init__(self, calculadora_frete):
        self.frete = calculadora_frete           # regra de negócio fica FORA (injetada)
        self._reacoes = {                        # tabela no lugar do if/elif
            ("outro_endereco", "alternou"): self._ao_alternar_endereco,
            ("cep", "digitou"): self._ao_digitar_cep,
        }

    def notificar(self, emissor, evento):
        reacao = self._reacoes.get((emissor.nome, evento))
        if reacao is not None:
            reacao(emissor)
\`\`\`

- **Um mediator por caso de uso** (por tela, por fluxo) — nunca um "MediatorGeral" do sistema inteiro.
- O mediator **coordena**; quem **decide** regras de negócio é o domínio.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Então, quando vale a pena? Quando as interações são **cruzadas** e **mudam** com frequência.',
        'E uma curiosidade para fechar a teoria: o quadro onde eu escrevo também é um padrão!',
      ],
      board: {
        title: 'Quando usar (e quando não)',
        md: `| ✅ Use quando | ❌ Evite quando |
|---|---|
| Vários objetos interagem de formas **complexas e cruzadas** | A comunicação é **um → muitos** simples (Observer basta) |
| Você quer **reutilizar** os colegas em outros contextos | São só dois objetos: uma chamada direta é mais clara |
| A coordenação precisa de **estado compartilhado** (a pista está livre? quem está na fila?) | O "mediator" só repassaria chamadas, sem decidir nada |

> [!sabia] Na arquitetura **Blackboard** (quadro-negro), especialistas independentes nunca conversam entre si: todos leem e escrevem num repositório compartilhado, e um componente de controle decide quem age a seguir. Ela nasceu no **Hearsay-II**, sistema de reconhecimento de fala da Carnegie Mellon nos anos 1970 — um primo do Mediator em que o meio de comunicação são os **dados**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Diagnóstico, God Object, comparações e uma torre de controle.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-med-q1',
      concept: 'Mediator',
      say: 'Primeiro, um diagnóstico de arquitetura.',
      prompt: 'Num app de delivery, quando o cliente muda o **endereço**, o frete é recalculado, a lista de restaurantes abertos muda, o cupom pode deixar de valer e o botão "Pagar" é reavaliado. Hoje cada componente guarda referência a quase todos os outros, e as atualizações às vezes entram em **loop**. Qual refatoração ataca a raiz do problema?',
      options: [
        { text: 'Introduzir um **Mediator** para a tela: os componentes só avisam o que mudou, e ele decide quem reage e em que ordem.', correct: true, why: 'A interação é muitos ↔ muitos, com regras cruzadas e ordem importante: coordenação centralizada elimina a malha de referências e os ciclos.' },
        { text: 'Aplicar **Observer** em todos os componentes, para que cada um assine os eventos de todos os outros.', why: 'Desacopla quem emite, mas a regra continua espalhada pelos ouvintes — e assinaturas cruzadas são justamente a receita dos loops de atualização.' },
        { text: 'Criar uma **Facade** que agrupe os componentes numa interface simples.', why: 'A Facade simplifica o acesso de um cliente a um subsistema; ela não coordena a conversa **entre** os componentes.' },
        { text: 'Transformar cada componente em **Singleton** para facilitar o acesso entre eles.', why: 'Acesso global aumenta o acoplamento — é a mesma malha de referências, só que escondida.' },
      ],
      explanation: 'Sinais clássicos de Mediator: interações **muitos ↔ muitos**, regras que envolvem vários componentes ao mesmo tempo e **ordem** de atualização relevante. Com a coordenação num lugar só, também fica fácil evitar ciclos: o mediator sabe o que já atualizou.',
    },
    {
      type: 'mcq',
      id: 'dp-med-q2',
      concept: 'God Object',
      multiple: true,
      say: 'Agora marque **todas** as corretas.',
      prompt: 'Quais destes são **sinais** de que um mediator está virando um God Object?',
      options: [
        { text: 'Ele calcula o frete e valida CPF, além de coordenar os componentes.', correct: true, why: 'Regra de negócio dentro do coordenador: ele passou a **decidir**, não só a coordenar.' },
        { text: 'Features de telas diferentes exigem editar a mesma classe mediator.', correct: true, why: 'Um mediator "geral" concentra mudanças que não têm relação entre si.' },
        { text: 'O método `notificar` tem centenas de linhas de `if/elif` por emissor e evento.', correct: true, why: 'Falta divisão: uma tabela de reações, métodos pequenos ou um mediator por caso de uso.' },
        { text: 'Os componentes conhecem apenas o mediator, e não uns aos outros.', why: 'Esse é o **objetivo** do padrão, não um problema.' },
        { text: 'Existe um mediator separado para cada diálogo da aplicação.', why: 'Isso é justamente uma forma de **evitar** o God Object.' },
      ],
      explanation: 'O Mediator troca acoplamento **distribuído** por acoplamento **concentrado**. Para ele não engordar: um mediator por caso de uso, reações organizadas (tabela, métodos pequenos) e regras de negócio no domínio, injetadas.',
    },
    {
      type: 'match',
      id: 'dp-med-q3',
      concept: 'Mediator × Observer × Facade',
      say: 'Padrões parecidos, intenções diferentes. Associe.',
      prompt: 'Associe cada padrão à forma como os objetos se comunicam.',
      pairs: [
        { left: 'Mediator', right: 'Colegas falam só com um coordenador, que decide quem reage (muitos ↔ muitos)' },
        { left: 'Observer', right: 'Um emissor avisa N ouvintes que ele não conhece (um → muitos)' },
        { left: 'Facade', right: 'Uma porta de entrada simples para um subsistema que nem sabe que ela existe' },
        { left: 'Chain of Responsibility', right: 'O pedido percorre uma corrente até alguém tratá-lo' },
        { left: 'Blackboard', right: 'Especialistas leem e escrevem num repositório de dados compartilhado' },
      ],
      explanation: 'Todos "ficam no meio" de outros objetos, mas com intenções diferentes: **coordenar** (Mediator), **avisar** (Observer), **simplificar** (Facade), **encaminhar até alguém tratar** (Chain of Responsibility) e **compartilhar dados** entre especialistas (Blackboard).',
    },
    {
      type: 'code',
      id: 'dp-med-q4',
      concept: 'Mediator',
      title: 'Torre de controle',
      say: 'Agora é com você: a torre de controle. Os aviões já estão prontos — a coordenação é toda sua.',
      prompt: `Implemente a \`Torre\` (o mediator) de um aeroporto com **uma** pista. Os aviões (já prontos) nunca falam entre si — só com a torre — e guardam em \`mensagens\` tudo o que ouvem dela.

**\`pedir_pouso(aviao)\`**
- pista livre **e** ninguém esperando → o avião ocupa a pista (\`self.pista\`) e recebe \`"pouso autorizado"\`;
- senão → entra no fim da fila (\`self.fila\`) e recebe \`"aguarde: posição N"\` (N começa em 1);
- pedido repetido, de quem já está na pista ou na fila, **não muda nada**: só reenvia o status atual.

**\`liberar_pista(aviao)\`**
- só quem está na pista pode liberá-la; qualquer outro → \`ValueError\`, sem mudar nada;
- a pista fica livre; se houver fila, o primeiro ocupa a pista e recebe \`"pouso autorizado"\`, e **cada** avião que continua esperando recebe a sua nova posição.`,
      starter: `class Aviao:
    """Colega: só conhece a torre. (Não precisa mudar esta classe.)"""

    def __init__(self, prefixo, torre):
        self.prefixo = prefixo
        self.torre = torre
        self.mensagens = []

    def pedir_pouso(self):
        self.torre.pedir_pouso(self)

    def liberar_pista(self):
        self.torre.liberar_pista(self)

    def receber(self, mensagem):
        self.mensagens.append(mensagem)


class Torre:
    """Mediator: coordena a pista e a fila de espera."""

    def __init__(self):
        self.pista = None     # avião que está na pista (ou None)
        self.fila = []        # aviões esperando, em ordem de chegada

    def pedir_pouso(self, aviao):
        pass

    def liberar_pista(self, aviao):
        pass
`,
      tests: [
        { name: 'o primeiro avião pousa direto', code: `torre = Torre()
a = Aviao("PT-AAA", torre)
a.pedir_pouso()
assert a.mensagens == ["pouso autorizado"], a.mensagens
assert torre.pista is a` },
        { name: 'os seguintes entram na fila', code: `torre = Torre()
a, b, c = Aviao("A", torre), Aviao("B", torre), Aviao("C", torre)
a.pedir_pouso()
b.pedir_pouso()
c.pedir_pouso()
assert b.mensagens == ["aguarde: posição 1"], b.mensagens
assert c.mensagens == ["aguarde: posição 2"], c.mensagens
assert list(torre.fila) == [b, c]` },
        { name: 'liberar a pista chama o próximo e atualiza a fila', code: `torre = Torre()
a, b, c = Aviao("A", torre), Aviao("B", torre), Aviao("C", torre)
for aviao in (a, b, c):
    aviao.pedir_pouso()
a.liberar_pista()
assert torre.pista is b
assert b.mensagens[-1] == "pouso autorizado", b.mensagens
assert c.mensagens[-1] == "aguarde: posição 1", c.mensagens
assert list(torre.fila) == [c]` },
        { name: 'sem fila, a pista fica livre', code: `torre = Torre()
a = Aviao("A", torre)
a.pedir_pouso()
a.liberar_pista()
assert torre.pista is None and list(torre.fila) == []
b = Aviao("B", torre)
b.pedir_pouso()
assert b.mensagens == ["pouso autorizado"], b.mensagens` },
        { name: 'só quem está na pista pode liberá-la', hidden: true, code: `torre = Torre()
a, b = Aviao("A", torre), Aviao("B", torre)
a.pedir_pouso()
b.pedir_pouso()
try:
    b.liberar_pista()
except ValueError:
    pass
else:
    raise AssertionError("b não está na pista: liberar_pista deveria lançar ValueError")
assert torre.pista is a and list(torre.fila) == [b], "um pedido inválido não pode mudar o estado"` },
        { name: 'pedido repetido não duplica', hidden: true, code: `torre = Torre()
a, b = Aviao("A", torre), Aviao("B", torre)
a.pedir_pouso()
b.pedir_pouso()
b.pedir_pouso()
assert list(torre.fila) == [b], "b entrou duas vezes na fila"
assert b.mensagens == ["aguarde: posição 1", "aguarde: posição 1"], b.mensagens
a.pedir_pouso()
assert a.mensagens == ["pouso autorizado", "pouso autorizado"], a.mensagens
assert torre.pista is a and list(torre.fila) == [b]` },
        { name: 'todos na fila recebem a nova posição', hidden: true, code: `torre = Torre()
a, b, c, d = (Aviao(p, torre) for p in "ABCD")
for aviao in (a, b, c, d):
    aviao.pedir_pouso()
a.liberar_pista()
assert [c.mensagens[-1], d.mensagens[-1]] == ["aguarde: posição 1", "aguarde: posição 2"]
b.liberar_pista()
assert torre.pista is c and d.mensagens[-1] == "aguarde: posição 1", d.mensagens` },
        { name: 'torres independentes', hidden: true, code: `t1, t2 = Torre(), Torre()
a = Aviao("A", t1)
b = Aviao("B", t2)
a.pedir_pouso()
b.pedir_pouso()
assert b.mensagens == ["pouso autorizado"], "o estado vazou entre torres (atributo de classe?)"` },
      ],
      reviews: [
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: 'Você usou `lista.pop(0)`, que custa **O(n)**: todos os elementos são deslocados. Para filas, `collections.deque` com `popleft()` é O(1). Com três aviões tanto faz — mas entrevistadores reparam.',
          concept: 'Filas com deque',
        },
        {
          when: m => m.usesGlobal,
          text: 'O estado da torre deve viver na **instância** (`self.pista`, `self.fila`), não em variáveis globais — senão duas torres compartilham a mesma pista.',
          concept: 'Encapsulamento',
        },
      ],
      hints: [
        'Organize o `pedir_pouso` em casos: já está na pista? já está na fila? pista livre e fila vazia? Senão, entra na fila.',
        'A posição é o índice na fila + 1: `self.fila.index(aviao) + 1` (um `deque` também tem `.index()`).',
        'No `liberar_pista`, valide primeiro (`aviao is not self.pista` → `ValueError`); depois tire o primeiro da fila e avise quem continua esperando com `enumerate(self.fila, start=1)`.',
      ],
      solution: `from collections import deque


class Aviao:
    """Colega: só conhece a torre. (Não precisa mudar esta classe.)"""

    def __init__(self, prefixo, torre):
        self.prefixo = prefixo
        self.torre = torre
        self.mensagens = []

    def pedir_pouso(self):
        self.torre.pedir_pouso(self)

    def liberar_pista(self):
        self.torre.liberar_pista(self)

    def receber(self, mensagem):
        self.mensagens.append(mensagem)


class Torre:
    """Mediator: coordena a pista e a fila de espera."""

    def __init__(self):
        self.pista = None
        self.fila = deque()

    def pedir_pouso(self, aviao):
        if aviao is self.pista:
            aviao.receber("pouso autorizado")
        elif aviao in self.fila:
            self._avisar_posicao(aviao)
        elif self.pista is None and not self.fila:
            self.pista = aviao
            aviao.receber("pouso autorizado")
        else:
            self.fila.append(aviao)
            self._avisar_posicao(aviao)

    def liberar_pista(self, aviao):
        if aviao is not self.pista:
            raise ValueError(f"{aviao.prefixo} não está na pista")
        self.pista = None
        if self.fila:
            self.pista = self.fila.popleft()
            self.pista.receber("pouso autorizado")
            for posicao, esperando in enumerate(self.fila, start=1):
                esperando.receber(f"aguarde: posição {posicao}")

    def _avisar_posicao(self, aviao):
        aviao.receber(f"aguarde: posição {self.fila.index(aviao) + 1}")
`,
      solutionExplanation: 'A `Torre` concentra **toda** a coordenação: o estado da pista, a ordem da fila e quem precisa ser avisado. Os aviões continuam simples e reutilizáveis — só conhecem a torre. As regras "ninguém fura a fila", "só quem está na pista a libera" e "todos recebem a nova posição" ficariam espalhadas (e brigando entre si) se os aviões negociassem diretamente. O `deque` deixa o `popleft()` O(1).',
    },
    {
      type: 'open',
      id: 'dp-med-q5',
      concept: 'Mediator × Observer',
      say: 'Última: uma provocação de entrevista. Convença o seu colega.',
      prompt: 'Um colega diz: "Mediator é só um **Observer** com outro nome". Como você responderia? Inclua o principal **risco** do Mediator.',
      minWords: 20,
      rubric: [
        { label: 'Observer: **um → muitos**, o emissor não conhece os ouvintes e a reação fica **espalhada**', keywords: ['um para muitos', 'um-para-muitos', 'um → muitos', '1:n', 'emissor', 'publica', 'ouvinte', 'assinante', 'inscrit', 'espalhad', 'distribuid'], concept: 'Observer', why: 'No Observer cada ouvinte decide sozinho como reagir; ninguém coordena o conjunto.' },
        { label: 'Mediator: **coordenação centralizada** muitos ↔ muitos; colegas só conhecem o mediator', keywords: ['centraliz', 'coorden', 'muitos para muitos', 'muitos-para-muitos', 'so conhecem o mediator', 'conhecem so o mediator', 'conhecem apenas o mediator', 'nao se conhecem', 'num lugar so', 'um lugar so', 'num unico lugar', 'ponto central'], concept: 'Mediator', why: 'O mediator concentra a regra de interação: quem reage, em que ordem e como.' },
        { label: 'Os dois podem ser **combinados** (o mediator assina eventos dos colegas)', keywords: ['combin', 'juntos', 'em conjunto', 'implementado com', 'implementar com', 'usando observer', 'por baixo', 'assina', 'complement'], concept: 'Combinação de padrões', why: 'É comum o mediator ser implementado com eventos: os colegas publicam e ele decide o que fazer.' },
        { label: 'Risco: virar **God Object**; mitigar com um mediator por caso de uso', keywords: ['god object', 'god class', 'objeto deus', 'classe deus', 'inchad', 'engord', 'sabe tudo', 'faz tudo', 'gigante', 'enorme', 'blob', 'por caso de uso', 'por tela', 'concentra demais'], concept: 'God Object', why: 'Toda regra de interação num lugar só tende a crescer sem parar; dividir por caso de uso contém o problema.' },
      ],
      modelAnswer: `Não é bem assim — os dois até se combinam, mas resolvem problemas diferentes.

- No **Observer**, a relação é **um → muitos**: um emissor publica eventos para ouvintes que ele **não conhece**, e cada ouvinte decide sozinho como reagir. A lógica fica **espalhada** pelos assinantes.
- No **Mediator**, a relação é **muitos ↔ muitos**: os colegas não se conhecem, só conhecem o mediator, que **centraliza a coordenação** — quem reage, em que ordem e com que regra.

Eles se **combinam** com frequência: o mediator pode assinar os eventos dos colegas (Observer por baixo) e decidir o que fazer com eles.

O principal risco do Mediator é virar um **God Object**: toda regra de interação se concentra numa classe que cresce sem parar. Para evitar, uso **um mediator por caso de uso** (por tela ou fluxo) e deixo as regras de negócio no domínio.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Resumindo: o **Mediator** troca a malha de conversas por uma estrela, com a regra de interação num lugar só.',
        'Ele não é Observer nem Facade — mas combina com eles. E fique de olho no tamanho dele: coordenar sim, **saber tudo** não.',
      ],
      board: null,
    },
  ],
});
