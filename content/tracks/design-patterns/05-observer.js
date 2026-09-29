Game.registerModule('design-patterns', {
  id: 'observer',
  title: 'Observer',
  kind: 'lesson',
  level: 2,
  order: 31,
  unit: 'comportamentais',
  summary: 'Publicar eventos e deixar que interessados reajam — com acoplamento fraco.',
  concepts: ['Observer', 'Pub/Sub', 'Acoplamento fraco', 'weakref'],
  takeaways: [
    'O **Observer** inverte a dependência: o sujeito só avisa "aconteceu X" e quem quiser reagir se inscreve — novos interessados entram sem mexer no emissor.',
    'Em Python, observadores costumam ser **callables**, e um **Event Bus** (pub/sub) organiza as inscrições por nome de evento.',
    'Ao notificar, itere sobre uma **cópia** da lista: remover um callback durante a iteração faz o seguinte ser pulado em silêncio.',
    'Observador esquecido é *memory leak* (**lapsed listener**): ofereça `unsubscribe` ou use referências fracas — e `WeakMethod` para métodos ligados.',
    'Defina uma política para **erros** (um callback que falha não deve calar os outros), não dependa da **ordem** de notificação e mande trabalho pesado para filas ou async.',
  ],
  glossary: [
    { term: 'Observer', aliases: ['padrão Observer', 'observers', 'observador', 'observadores'], definition: 'Padrão comportamental (GoF) em que um objeto, o *sujeito*, mantém uma lista de dependentes (os observadores) e os avisa quando algo muda, sem conhecer suas classes concretas. O GoF lista como apelidos *Dependents* e *Publish-Subscribe*.' },
    { term: 'Pub/Sub', aliases: ['publish/subscribe', 'publish-subscribe', 'pub-sub', 'publicar/assinar'], definition: 'Estilo de comunicação em que emissores **publicam** eventos num canal, por nome ou tópico, e assinantes se **inscrevem** nele — nenhum lado conhece o outro. Entre serviços, o canal é um broker (Kafka, RabbitMQ, Redis).' },
    { term: 'Event Bus', aliases: ['barramento de eventos', 'barramentos de eventos', 'event buses'], definition: 'Objeto central que guarda as inscrições por nome de evento e repassa cada evento emitido aos callbacks inscritos. É o Observer com um intermediário: emissor e ouvintes só conhecem o barramento.' },
    { term: 'Lapsed listener', aliases: ['lapsed listener problem', 'lapsed listeners', 'ouvinte esquecido', 'ouvintes esquecidos'], definition: 'Vazamento de memória típico do Observer: um observador que ninguém desinscreveu continua referenciado pelo sujeito, nunca é coletado e segue recebendo (e processando) eventos.' },
    { term: 'Referência fraca', aliases: ['referências fracas', 'weak reference', 'weak references'], definition: 'Referência que **não** mantém o objeto vivo: quando só restam referências fracas, o coletor pode liberá-lo. Em Python: `weakref.ref`, `WeakSet`, `WeakValueDictionary` e `WeakMethod`.' },
    { term: 'Método ligado', aliases: ['métodos ligados', 'bound method', 'bound methods'], definition: 'Objeto criado **a cada acesso** `obj.metodo`, que junta a função (`__func__`) e a instância (`__self__`). Por ser temporário, uma referência fraca a ele morre na hora — para isso existe `weakref.WeakMethod`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Cenário: quando um pedido é pago, precisamos enviar e-mail, baixar o estoque e registrar no analytics.',
        'A solução ingênua é chamar tudo direto de dentro do serviço de pedidos. Veja o que acontece:',
      ],
      board: {
        title: 'O problema: um serviço que conhece todo mundo',
        code: `class ServicoPedidos:
    def pagar(self, pedido):
        pedido.status = "pago"
        EmailService().enviar_confirmacao(pedido)
        Estoque().baixar(pedido.itens)
        Analytics().registrar("pedido_pago", pedido.id)
        # nova exigência: gerar nota fiscal… mais uma linha aqui
        # e mais um import, e mais uma dependência para testar`,
        caption: 'O serviço de pedidos depende de TODOS os interessados. Qualquer novo interessado exige modificá-lo.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O **Observer** inverte essa relação. O objeto observado — o **sujeito** — mantém uma lista de **observadores** e só avisa: "aconteceu tal coisa".',
        'Ele não sabe quem são os observadores nem o que fazem. Isso é **acoplamento fraco**.',
      ],
      board: {
        title: 'Observer clássico',
        code: `class Pedido:                          # o sujeito
    def __init__(self):
        self._observadores = []
        self.status = "novo"

    def anexar(self, observador):
        self._observadores.append(observador)

    def pagar(self):
        self.status = "pago"
        for obs in self._observadores:
            obs.atualizar(self)             # notifica


class EmailObserver:
    def atualizar(self, pedido):
        print("e-mail: pedido", pedido.status)

pedido = Pedido()
pedido.anexar(EmailObserver())
pedido.pagar()   # e-mail: pedido pago`,
      },
    },
    {
      type: 'say',
      text: [
        'Uma variação muito usada é o **Event Bus** (pub/sub): em vez de cada objeto ter sua lista, um barramento central guarda inscrições **por nome de evento**.',
        'Em Python, os observadores costumam ser simplesmente **funções** (callbacks).',
      ],
      board: {
        title: 'Event Bus (pub/sub) com callbacks',
        code: `from collections import defaultdict

class EventBus:
    def __init__(self):
        self._inscritos = defaultdict(list)

    def subscribe(self, evento, callback):
        self._inscritos[evento].append(callback)

    def emit(self, evento, *args, **kwargs):
        for callback in list(self._inscritos[evento]):
            callback(*args, **kwargs)


bus = EventBus()
bus.subscribe("pedido_pago", lambda p: print("e-mail para", p))
bus.subscribe("pedido_pago", lambda p: print("baixar estoque de", p))
bus.emit("pedido_pago", "pedido #42")`,
        caption: 'Novo interessado? Um `subscribe` a mais — o emissor não muda.',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora os cuidados, que são ótimos temas de entrevista.',
        'Primeiro: **vazamento de memória**. A lista do sujeito mantém referências fortes aos observadores — eles nunca são coletados enquanto o sujeito existir, a menos que se desinscrevam.',
        'Segundo: se um callback se desinscrever **durante** o `emit`, iterar sobre a lista original pode pular observadores. Por isso iteramos sobre uma **cópia**.',
      ],
      board: {
        title: '⚠️ Armadilhas do Observer',
        md: `| Armadilha | Solução |
|---|---|
| Observadores esquecidos nunca são liberados (**memory leak**) | Oferecer \`unsubscribe\`; ou guardar referências fracas com \`weakref.WeakSet\` / \`WeakMethod\` |
| Modificar a lista enquanto itera | Iterar sobre uma cópia: \`for cb in list(inscritos):\` |
| Um callback lança exceção e os outros não rodam | Decidir a política: capturar e logar por callback? |
| Ordem de notificação implícita | Não dependa da ordem entre observadores |
| Fluxo difícil de rastrear ("quem reage a isso?") | Nomes de evento claros, logs, não abusar |

\`\`\`python
import weakref

class Sujeito:
    def __init__(self):
        self._obs = weakref.WeakSet()   # não impede a coleta
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Vamos ver as **referências fracas** funcionando — e uma pegadinha que pega até gente experiente.',
        { text: 'Um `WeakSet` de **métodos** esvazia na hora, porque `obj.metodo` cria um objeto novo a cada acesso!', mood: 'surprised' },
      ],
      board: {
        title: 'Referências fracas na prática',
        md: `\`\`\`python
import weakref

class Tela:
    def atualizar(self, pedido):
        print("tela:", pedido)

tela = Tela()
inscritos = weakref.WeakSet()
inscritos.add(tela)
len(inscritos)      # 1
del tela            # some a última referência forte…
len(inscritos)      # 0 — o observador saiu sozinho da lista

# ⚠️ Pegadinha: cada acesso a t.atualizar cria um "método ligado" NOVO
t = Tela()
callbacks = weakref.WeakSet()
callbacks.add(t.atualizar)
len(callbacks)      # 0 — o objeto temporário morreu na hora!

ref = weakref.WeakMethod(t.atualizar)   # guarda objeto e função separados
ref()("pedido #42")                     # tela: pedido #42 (ref() vira None se t sumir)
\`\`\`

> [!sabia] Esse vazamento tem nome: **lapsed listener problem** — o problema do ouvinte "caducado", que ninguém desinscreveu. É uma das causas mais comuns de *memory leak* em linguagens com coletor de lixo: telas fechadas continuam vivas (e reagindo a eventos!) só porque um barramento ainda guarda uma referência a elas. É tão comum que o WPF, do .NET, ganhou um padrão só para isso: o *weak event pattern*.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Eventos, inscrições e armadilhas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-observer-q1',
      concept: 'Acoplamento fraco',
      say: 'Qual o principal ganho do Observer?',
      prompt: 'Qual é o principal benefício do **Observer** no exemplo do serviço de pedidos?',
      options: [
        { text: 'O serviço de pedidos deixa de depender diretamente de e-mail, estoque e analytics.', correct: true, why: 'O sujeito só publica o evento; quem reage se inscreve por conta própria.' },
        { text: 'As notificações passam a ser executadas em paralelo automaticamente.', why: 'O Observer não implica concorrência; a implementação básica é síncrona e sequencial.' },
        { text: 'Garante que cada observador seja notificado exatamente uma vez, mesmo com falhas de rede.', why: 'Garantias de entrega são assunto de filas/mensageria, não do padrão em si.' },
        { text: 'Reduz o número de classes do sistema.', why: 'Em geral aumenta — o ganho é o desacoplamento, não a quantidade de código.' },
      ],
      explanation: 'O Observer promove **acoplamento fraco**: o emissor não conhece os receptores, então novos interessados entram sem modificá-lo.',
    },
    {
      type: 'mcq',
      id: 'dp-observer-q2',
      concept: 'Iterar sobre cópia',
      say: 'Olha esse bug sutil…',
      prompt: `Com dois callbacks inscritos, \`a\` (que se desinscreve ao rodar) e depois \`b\`, o que acontece neste \`emit\`?

\`\`\`python
def emit(self, evento):
    for cb in self._inscritos[evento]:   # sem cópia
        cb()
\`\`\``,
      options: [
        { text: 'Os dois rodam normalmente.', why: 'Ao remover `a` durante a iteração, os índices andam e o laço pula o elemento seguinte.' },
        { text: '`b` é pulado, porque a lista foi modificada durante a iteração.', correct: true, why: 'Remover o item 0 desloca `b` para a posição 0, mas o iterador já avançou para a 1.' },
        { text: 'Lança `RuntimeError: list changed size during iteration`.', why: 'Esse erro ocorre com **dicionários** e sets; listas não reclamam — simplesmente pulam elementos.' },
        { text: 'Entra em loop infinito.', why: 'Remover elementos não faz a lista crescer, então o laço termina.' },
      ],
      explanation: 'Modificar uma lista enquanto se itera sobre ela pula elementos silenciosamente. A correção é iterar sobre uma **cópia**: `for cb in list(self._inscritos[evento]):`.',
    },
    {
      type: 'code',
      id: 'dp-observer-q3',
      concept: 'Pub/Sub',
      title: 'Implemente um EventBus',
      say: 'Agora é sua vez de construir um Event Bus completo. Atenção aos testes das armadilhas!',
      prompt: `Implemente a classe \`EventBus\`:

- \`subscribe(evento, callback)\` — inscreve o callback no evento. Inscrever **o mesmo callback duas vezes** no mesmo evento **não** deve duplicá-lo.
- \`unsubscribe(evento, callback)\` — remove a inscrição; se não existir, **não faz nada** (sem erro).
- \`emit(evento, *args, **kwargs)\` — chama cada callback do evento, na ordem de inscrição, repassando os argumentos, e **retorna a lista com os valores retornados**. Evento sem inscritos retorna \`[]\`.
- Um callback pode se desinscrever durante o \`emit\` sem fazer os outros serem pulados.
- Cada \`EventBus\` tem suas **próprias** inscrições.`,
      starter: `class EventBus:
    def __init__(self):
        pass

    def subscribe(self, evento, callback):
        pass

    def unsubscribe(self, evento, callback):
        pass

    def emit(self, evento, *args, **kwargs):
        pass
`,
      tests: [
        { name: 'emit retorna os resultados', code: 'bus = EventBus()\nbus.subscribe("x", lambda v: v * 2)\nassert bus.emit("x", 21) == [42]' },
        { name: 'ordem de inscrição', code: 'bus = EventBus()\nbus.subscribe("e", lambda: "primeiro")\nbus.subscribe("e", lambda: "segundo")\nassert bus.emit("e") == ["primeiro", "segundo"]' },
        { name: 'evento sem inscritos', expr: 'EventBus().emit("nada")', expected: '[]' },
        { name: 'unsubscribe', code: 'bus = EventBus()\nf = lambda: 1\nbus.subscribe("e", f)\nbus.unsubscribe("e", f)\nbus.unsubscribe("e", f)  # segunda vez não pode dar erro\nbus.unsubscribe("outro", f)\nassert bus.emit("e") == []' },
        { name: 'callback que se desinscreve durante o emit', code: 'bus = EventBus()\nchamadas = []\ndef uma_vez():\n    chamadas.append("uma")\n    bus.unsubscribe("e", uma_vez)\ndef sempre():\n    chamadas.append("sempre")\nbus.subscribe("e", uma_vez)\nbus.subscribe("e", sempre)\nbus.emit("e")\nassert chamadas == ["uma", "sempre"], f"chamadas = {chamadas} — itere sobre uma cópia"\nbus.emit("e")\nassert chamadas == ["uma", "sempre", "sempre"]' },
        { name: 'sem inscrição duplicada', hidden: true, code: 'bus = EventBus()\nf = lambda: "ok"\nbus.subscribe("e", f)\nbus.subscribe("e", f)\nassert bus.emit("e") == ["ok"]' },
        { name: 'repassa kwargs', hidden: true, code: 'bus = EventBus()\nbus.subscribe("soma", lambda a, b=0: a + b)\nassert bus.emit("soma", 1, b=2) == [3]' },
        { name: 'buses independentes', hidden: true, code: 'a = EventBus()\nb = EventBus()\na.subscribe("e", lambda: 1)\nassert b.emit("e") == [], "as inscrições não podem ser compartilhadas entre instâncias (atributo de classe mutável?)"' },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`/`nonlocal`. O estado das inscrições deve viver na **instância** (`self`), senão todos os buses compartilham os mesmos dados.',
          concept: 'Encapsulamento',
        },
        {
          when: (m, code) => /except\s*:/.test(code),
          text: 'Um `except:` genérico esconde erros de verdade (até `KeyboardInterrupt`). Se quiser tolerar ausência, verifique antes (`if callback in lista`) ou capture só `ValueError`/`KeyError`.',
          concept: 'Tratamento de exceções',
        },
      ],
      hints: [
        'Use um dicionário de listas criado no `__init__`: `self._inscritos = {}` (ou `defaultdict(list)`).',
        'No `subscribe`, só adicione se `callback not in lista`. No `unsubscribe`, remova apenas se estiver na lista.',
        'No `emit`, itere sobre uma **cópia**: `return [cb(*args, **kwargs) for cb in list(self._inscritos.get(evento, []))]`.',
      ],
      solution: `class EventBus:
    def __init__(self):
        self._inscritos = {}

    def subscribe(self, evento, callback):
        lista = self._inscritos.setdefault(evento, [])
        if callback not in lista:
            lista.append(callback)

    def unsubscribe(self, evento, callback):
        lista = self._inscritos.get(evento, [])
        if callback in lista:
            lista.remove(callback)

    def emit(self, evento, *args, **kwargs):
        callbacks = list(self._inscritos.get(evento, []))
        return [cb(*args, **kwargs) for cb in callbacks]
`,
      solutionExplanation: 'As inscrições ficam num dicionário **da instância**, criado no `__init__` — por isso buses diferentes não se misturam. O `emit` itera sobre uma **cópia** da lista, então um callback pode se desinscrever sem que os seguintes sejam pulados. `subscribe` e `unsubscribe` são idempotentes, o que evita notificações duplicadas e erros bobos.',
    },
    {
      type: 'open',
      id: 'dp-observer-q4',
      concept: 'weakref',
      say: 'Pergunta de sênior: quais os riscos do Observer em produção?',
      prompt: 'Quais **riscos ou desvantagens** o Observer traz num sistema real e como você os mitigaria?',
      minWords: 14,
      rubric: [
        { label: 'Vazamento de memória por **referências** mantidas', keywords: ['memoria', 'memory', 'leak', 'vazamento', 'referencia', 'weakref', 'garbage', 'coleta'], concept: 'weakref', why: 'O sujeito mantém os observadores vivos; use unsubscribe ou referências fracas.' },
        { label: 'Fluxo difícil de **rastrear/depurar**', keywords: ['rastre', 'depur', 'debug', 'dificil de seguir', 'dificil entender', 'implicit', 'fluxo', 'quem reage'], concept: 'Observabilidade', why: 'Efeitos colaterais ficam espalhados; nomes de evento claros e logs ajudam.' },
        { label: 'Exceção em um observador afeta os demais / **tratamento de erros**', keywords: ['excec', 'erro', 'falha', 'exception'], concept: 'Tratamento de exceções', why: 'Defina se um erro interrompe a notificação ou é isolado por callback.' },
        { label: 'Ordem de notificação ou **desempenho** (muitos observadores, síncrono)', keywords: ['ordem', 'desempenho', 'performance', 'lento', 'sincron', 'assincron', 'fila', 'bloque'], concept: 'Observer', why: 'Notificações síncronas bloqueiam o emissor; para trabalho pesado, use filas/async.' },
      ],
      modelAnswer: `1. **Vazamento de memória**: o sujeito guarda referências fortes aos observadores, que nunca são coletados se esquecerem de se desinscrever. Mitigação: oferecer \`unsubscribe\` e/ou usar \`weakref.WeakSet\`/\`WeakMethod\`.
2. **Fluxo difícil de rastrear**: quem emite não sabe quem reage, então depurar "por que isso aconteceu?" fica difícil. Mitigação: nomes de eventos claros, logging e não abusar do padrão.
3. **Tratamento de erros**: uma exceção em um callback pode impedir que os outros rodem. Mitigação: definir a política (isolar cada callback com try/except e logar, por exemplo).
4. **Ordem e desempenho**: a ordem de notificação é implícita e, como a notificação é síncrona, observadores lentos bloqueiam o emissor. Mitigação: não depender da ordem e mover trabalho pesado para filas ou execução assíncrona.`,
    },
    {
      type: 'match',
      id: 'dp-rx2-observer-match',
      concept: 'Armadilhas do Observer',
      say: 'Rodada rápida: cada armadilha com o seu remédio.',
      prompt: 'Associe cada **armadilha** do Observer à mitigação adequada:',
      pairs: [
        { left: 'Observador esquecido fica vivo para sempre', right: 'Oferecer `unsubscribe` ou guardar referências fracas' },
        { left: '`WeakSet` com `obj.metodo` esvazia na hora', right: 'Guardar com `weakref.WeakMethod`' },
        { left: 'Callback se desinscreve no meio do `emit` e o seguinte é pulado', right: 'Iterar sobre uma **cópia** da lista' },
        { left: 'Um callback lança exceção e os demais não rodam', right: 'Isolar cada callback com `try/except` e logar' },
        { left: 'Observador lento trava quem emitiu o evento', right: 'Mandar o trabalho pesado para uma fila ou task assíncrona' },
      ],
      explanation: 'Cada armadilha tem um remédio conhecido: **desinscrever** (ou usar referências fracas) contra o *lapsed listener*; `WeakMethod` porque `obj.metodo` é um objeto temporário; **cópia** da lista para iterar com segurança; **isolamento** de erros por callback; e **filas/async** quando a notificação síncrona vira gargalo.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Observer = o sujeito **publica**, observadores **reagem**, e ninguém precisa conhecer ninguém.',
        'Lembre dos cuidados: `unsubscribe`/`weakref`, iterar sobre **cópia** e uma política clara para erros. Próximo: Decorator!',
      ],
      board: null,
    },
  ],
});
