Game.registerModule('design-patterns', {
  id: 'interview',
  title: 'Entrevista: Design Patterns',
  kind: 'interview',
  level: 2,
  order: 90,
  unit: 'entrevistas',
  summary: 'Identifique padrões em cenários reais, compare Strategy e State e faça live coding de Command e Builder.',
  concepts: ['Identificação de padrões', 'Strategy × State', 'Command', 'Builder'],
  takeaways: [
    'Reconheça padrões pela **intenção**, não pelo diagrama: Adapter, Decorator e Proxy têm estrutura quase igual, mas converter, adicionar e controlar acesso são propósitos diferentes.',
    'Antes de dizer o nome do padrão, descreva as **forças** do cenário — o que varia, com que frequência, quem decide — e diga quando **não** o usaria.',
    'Strategy × State: a estratégia é escolhida **de fora**, pelo cliente; no State, o próprio objeto troca de comportamento conforme a **fase**, por meio de transições.',
    'Command com desfazer/refazer usa **duas pilhas**: cada comando guarda só o necessário para se reverter, e um comando novo **limpa o refazer**.',
    'No Builder fluente, cada configuração **retorna `self`**, o `build()` valida e monta, e opcionais se testam com `is not None` — senão o `LIMIT 0` some.',
  ],
  glossary: [
    { term: 'Forces', aliases: ['forças de um padrão', 'forças do padrão', 'forças de design'], definition: 'Na literatura de padrões, de Christopher Alexander ao POSA, as exigências conflitantes que uma solução precisa equilibrar — flexibilidade × simplicidade, desempenho × legibilidade. Um padrão é uma forma testada de equilibrar certas forças num contexto.' },
    { term: 'Pilha de desfazer', aliases: ['pilhas de desfazer', 'pilha de refazer', 'undo stack', 'redo stack'], definition: 'Par de pilhas por trás do Ctrl+Z/Ctrl+Y: desfazer tira o comando do topo dos feitos e o põe nos desfeitos; refazer faz o caminho inverso; um comando novo esvazia a pilha de refazer.' },
    { term: 'Memento', aliases: ['padrão Memento', 'mementos'], definition: 'Padrão comportamental (GoF) que guarda um *snapshot* do estado interno de um objeto para restaurá-lo depois, sem expor seus detalhes. Para desfazer, é a alternativa ao Command: mais simples, porém gasta mais memória.' },
    { term: 'Falsy', aliases: ['valor falsy', 'valores falsy'], definition: 'Valor que conta como falso num `if`: `0`, `0.0`, `""`, `[]`, `{}`, `None` e `False`. Testar `if limite:` confunde "zero" com "ausente" — para opcionais, compare com `is None`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Bom dia! Obrigada por vir. Eu sou a Lia e vou conduzir sua entrevista técnica sobre **design patterns**.',
        'Vamos em três partes: identificar padrões em cenários, uma pergunta conceitual e, no fim, **live coding**. Pode pensar em voz alta, tá?',
      ],
      board: {
        title: '🎤 Formato da entrevista',
        md: `1. **Cenários** — qual padrão você aplicaria?
2. **Conceitual** — comparar padrões parecidos
3. **Live coding** — implementar Command (com desfazer) e Builder

> [!dica] Em entrevistas de design, justificar a escolha (e dizer quando **não** usaria) vale tanto quanto acertar o nome do padrão.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Antes do primeiro cenário, deixa eu contar como eu avalio as respostas.',
        'Não quero só o nome do padrão: quero ouvir **quais forças** você está equilibrando e **quanto custa** a sua escolha.',
      ],
      board: {
        title: 'Como responder "qual padrão você usaria?"',
        md: `1. **Nomeie as forças:** o que varia? Com que frequência? Quem decide, e quando?
2. **Escolha pela intenção**, não pelo diagrama — vários padrões têm a mesma estrutura de classes.
3. **Diga o preço** (classes a mais, indireção) e quando você **não** usaria.

**Exemplo:** "menus têm itens e submenus, e o código quer tratar os dois do mesmo jeito" → forças: estrutura em **árvore** × cliente que não quer distinguir **folha** de **grupo** → **Composite**. Preço: a interface comum pode obrigar a folha a ter métodos sem sentido, como \`adicionar()\`.

> [!sabia] Na literatura de padrões — do arquiteto Christopher Alexander aos livros *POSA* —, um padrão não resolve um problema solto: ele equilibra um conjunto de **forças** (*forces*), exigências que puxam em direções opostas, como flexibilidade × simplicidade. Muitos catálogos descrevem cada padrão como *contexto → problema e forças → solução → consequências*. Em entrevista, nomear as forças mostra raciocínio de design, e não decoreba de nomes.`,
      },
    },
    {
      type: 'mcq',
      id: 'dp-interview-q1',
      concept: 'Strategy',
      say: 'Primeiro cenário. Estamos construindo um sistema fiscal internacional.',
      prompt: 'O cálculo de imposto muda conforme o **país** do cliente (Brasil, Portugal, EUA…), novos países entram todo trimestre e o cálculo é escolhido no momento da venda. Qual padrão você usaria?',
      options: [
        { text: 'Strategy', correct: true, why: 'Uma família de algoritmos intercambiáveis (um por país), escolhida em tempo de execução e extensível sem mexer no contexto.' },
        { text: 'Singleton', why: 'Instância única não resolve a variação de algoritmos.' },
        { text: 'Observer', why: 'Não há evento sendo publicado para vários interessados.' },
        { text: 'Adapter', why: 'Não há interface incompatível a ser convertida.' },
      ],
      explanation: 'Cada país vira uma estratégia (`calcular_imposto(venda)`), guardada num registro por código de país. Novos países = novas estratégias, sem tocar no fluxo de venda.',
    },
    {
      type: 'mcq',
      id: 'dp-interview-q2',
      concept: 'Observer',
      say: 'Próximo cenário, agora de e-commerce.',
      prompt: 'Quando o status de um pedido muda para "enviado", o time de notificações quer mandar push, o de CRM quer atualizar o funil e o de BI quer registrar métricas. O time de pedidos **não quer depender** de nenhum deles. Qual padrão?',
      options: [
        { text: 'Facade', why: 'Facade simplifica o acesso a um subsistema; aqui a questão é quem reage a um evento.' },
        { text: 'Observer (pub/sub)', correct: true, why: 'O serviço de pedidos publica o evento; cada time se inscreve e reage, sem acoplamento.' },
        { text: 'Decorator', why: 'Não se trata de adicionar comportamento a um objeto com a mesma interface.' },
        { text: 'Factory Method', why: 'Não há problema de criação de objetos aqui.' },
      ],
      explanation: 'Clássico **Observer**/pub-sub: o emissor não conhece os receptores. Em sistemas distribuídos, a mesma ideia aparece como eventos numa fila/broker.',
    },
    {
      type: 'mcq',
      id: 'dp-interview-q3',
      concept: 'Command',
      say: 'Esse aqui é um queridinho das entrevistas.',
      prompt: 'Um editor de imagens precisa de **desfazer/refazer** (Ctrl+Z / Ctrl+Y), gravar **macros** e enfileirar operações para rodar depois. Qual padrão encaixa melhor?',
      options: [
        { text: 'Command', correct: true, why: 'Encapsular cada operação como objeto (com `executar` e `desfazer`) permite histórico, macros e filas.' },
        { text: 'Strategy', why: 'Strategy troca algoritmos, mas não modela operações armazenáveis e reversíveis.' },
        { text: 'Adapter', why: 'Não há conversão de interfaces.' },
        { text: 'Singleton', why: 'Não resolve histórico nem reversão de operações.' },
      ],
      explanation: 'O **Command** transforma uma requisição em objeto. Guardando esses objetos numa pilha, você ganha desfazer/refazer; numa lista, macros; numa fila, execução adiada.',
    },
    {
      type: 'mcq',
      id: 'dp-interview-q4',
      concept: 'Identificação de padrões',
      multiple: true,
      say: 'Agora marque todas as corretas.',
      prompt: 'Quais destes padrões funcionam **embrulhando outro objeto** (composição) e repassando chamadas para ele?',
      options: [
        { text: 'Adapter', correct: true, why: 'Embrulha o objeto adaptado e traduz as chamadas.' },
        { text: 'Decorator', correct: true, why: 'Embrulha o componente, mantém a interface e adiciona comportamento.' },
        { text: 'Proxy', correct: true, why: 'Embrulha o objeto real para controlar o acesso (cache, lazy loading, permissão).' },
        { text: 'Singleton', why: 'Controla a quantidade de instâncias; não embrulha outro objeto.' },
        { text: 'Factory Method', why: 'Trata de criação; não é um invólucro.' },
      ],
      explanation: '**Adapter, Decorator e Proxy** são "wrappers" com estrutura quase idêntica. O que os distingue é a **intenção**: converter interface, adicionar comportamento ou controlar acesso.',
    },
    {
      type: 'match',
      id: 'dp-rx2-interview-match',
      concept: 'Identificação de padrões',
      say: 'Rodada relâmpago! Cinco cenários, cinco padrões. Confie na intenção.',
      prompt: 'Associe cada **cenário** ao padrão que melhor o resolve:',
      pairs: [
        { left: 'O SDK oferece `efetuar_cobranca(centavos)`, mas seu código chama `pagar(reais)`', right: 'Adapter' },
        { left: 'Um `checkout()` simples na frente de estoque, pagamento, frete e e-mail', right: 'Facade' },
        { left: 'Empilhar log e métricas num serviço sem mudar a interface dele', right: 'Decorator' },
        { left: 'Adiar a criação de um objeto caro até o primeiro uso', right: 'Proxy' },
        { left: 'Montar passo a passo um objeto com muitas partes opcionais e validar no fim', right: 'Builder' },
      ],
      explanation: 'Cada um tem uma **intenção** própria: Adapter **converte** uma interface na esperada; Facade **simplifica** o acesso a um subsistema; Decorator **acrescenta** comportamento empilhável mantendo a interface; Proxy **controla o acesso** ao objeto real (aqui, criação preguiçosa); Builder **separa** a configuração da montagem. Em entrevista, diga a intenção junto com o nome.',
    },
    {
      type: 'open',
      id: 'dp-interview-q5',
      concept: 'Strategy × State',
      say: 'Pergunta conceitual. Strategy e State têm diagramas quase idênticos. Qual é a diferença?',
      prompt: 'Qual a diferença entre os padrões **Strategy** e **State**, já que a estrutura de classes dos dois é praticamente a mesma?',
      minWords: 15,
      rubric: [
        { label: 'No Strategy, o **cliente escolhe** o algoritmo', keywords: ['cliente escolhe', 'cliente define', 'escolhido pelo cliente', 'escolhe o algoritmo', 'escolhe a estrategia', 'de fora', 'externamente', 'injet', 'configura'], concept: 'Strategy', why: 'A estratégia costuma ser passada/configurada de fora e raramente muda sozinha.' },
        { label: 'No State, o comportamento muda conforme o **estado interno** e há **transições**', keywords: ['estado interno', 'transic', 'muda de estado', 'troca de estado', 'mudanca de estado', 'proprio objeto', 'sozinho', 'automatic'], concept: 'State', why: 'Os próprios estados costumam decidir o próximo estado (ex.: pedido novo → pago → enviado).' },
        { label: 'Reconhece que a **estrutura é parecida** (composição/delegação) e a diferença é a **intenção**', keywords: ['intencao', 'proposito', 'objetivo', 'estrutura', 'delega', 'composicao', 'parecid', 'semelhan'], concept: 'Identificação de padrões', why: 'Padrões se distinguem pela intenção, não pelo diagrama.' },
        { label: 'Estratégias são **independentes**; estados **se conhecem** / uma máquina de estados', keywords: ['independente', 'nao se conhecem', 'se conhecem', 'conhecem uns', 'maquina de estado', 'proximo estado'], concept: 'State', why: 'Estados formam uma máquina de estados; estratégias não sabem umas das outras.' },
      ],
      modelAnswer: `Estruturalmente os dois são iguais: um **contexto** guarda uma referência a um objeto e **delega** o comportamento a ele. A diferença está na **intenção**.

- **Strategy:** o **cliente escolhe** qual algoritmo usar (por injeção/configuração). As estratégias são **independentes** entre si e raramente mudam durante a vida do objeto — ex.: forma de cálculo de frete.
- **State:** o comportamento muda conforme o **estado interno** do objeto, e as **transições** acontecem durante a execução, muitas vezes decididas pelos próprios estados (que **conhecem o próximo estado**) — ex.: um pedido que vai de "novo" para "pago" e depois "enviado", onde \`cancelar()\` se comporta de forma diferente em cada fase.

Resumindo: Strategy = *como* fazer, escolhido de fora; State = *em que fase estou*, gerido por uma máquina de estados.`,
    },
    { type: 'section', title: 'Live coding', subtitle: 'Duas implementações. Rode os exemplos antes de enviar.', icon: '⌨️', mood: 'neutral', text: 'Ótimo. Agora vamos para o **live coding** — pode abrir o editor.' },
    {
      type: 'code',
      id: 'dp-interview-q6',
      concept: 'Command',
      title: 'Editor com desfazer/refazer',
      points: 50,
      say: 'Implemente o Command para um editor de texto com desfazer e refazer. Pense nos casos de borda.',
      prompt: `O \`Editor\` guarda um texto em \`editor.texto\`. Implemente os comandos e o histórico:

- \`Inserir(trecho)\`: \`executar(editor)\` acrescenta o trecho ao final; \`desfazer(editor)\` remove exatamente esse trecho.
- \`Apagar(n)\`: \`executar(editor)\` apaga os últimos \`n\` caracteres (ou todos, se houver menos); \`desfazer(editor)\` restaura **exatamente** o que foi apagado.
- \`Historico(editor)\`:
  - \`executar(comando)\` executa e registra o comando; **um novo comando descarta o que havia para refazer**;
  - \`desfazer()\` desfaz o último comando (sem histórico, não faz nada);
  - \`refazer()\` reexecuta o último comando desfeito (sem nada para refazer, não faz nada).`,
      starter: `class Editor:
    def __init__(self):
        self.texto = ""


class Inserir:
    def __init__(self, trecho):
        self.trecho = trecho

    def executar(self, editor):
        pass

    def desfazer(self, editor):
        pass


class Apagar:
    def __init__(self, n):
        self.n = n

    def executar(self, editor):
        pass

    def desfazer(self, editor):
        pass


class Historico:
    def __init__(self, editor):
        self.editor = editor

    def executar(self, comando):
        pass

    def desfazer(self):
        pass

    def refazer(self):
        pass
`,
      tests: [
        { name: 'inserir e desfazer', code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("olá"))\nh.executar(Inserir(" mundo"))\nassert e.texto == "olá mundo", repr(e.texto)\nh.desfazer()\nassert e.texto == "olá", repr(e.texto)' },
        { name: 'apagar e restaurar', code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("abcdef"))\nh.executar(Apagar(3))\nassert e.texto == "abc", repr(e.texto)\nh.desfazer()\nassert e.texto == "abcdef", repr(e.texto)' },
        { name: 'desfazer sem histórico', code: 'e = Editor()\nh = Historico(e)\nh.desfazer()\nh.refazer()\nassert e.texto == ""' },
        { name: 'refazer', code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("a"))\nh.executar(Inserir("b"))\nh.desfazer()\nh.desfazer()\nassert e.texto == ""\nh.refazer()\nassert e.texto == "a", repr(e.texto)\nh.refazer()\nassert e.texto == "ab", repr(e.texto)' },
        { name: 'novo comando limpa o refazer', hidden: true, code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("a"))\nh.executar(Inserir("b"))\nh.desfazer()\nh.executar(Inserir("c"))\nh.refazer()\nassert e.texto == "ac", repr(e.texto)' },
        { name: 'apagar mais do que existe', hidden: true, code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("ab"))\nh.executar(Apagar(5))\nassert e.texto == ""\nh.desfazer()\nassert e.texto == "ab", repr(e.texto)' },
        { name: 'desfazer inserção vazia', hidden: true, code: 'e = Editor()\nh = Historico(e)\nh.executar(Inserir("abc"))\nh.executar(Inserir(""))\nh.desfazer()\nassert e.texto == "abc", "texto[:-0] apaga tudo! " + repr(e.texto)' },
      ],
      reviews: [
        {
          when: m => m.calls.includes('deepcopy') || m.calls.includes('copy'),
          text: 'Você guarda **cópias do estado** para desfazer — isso é o padrão *Memento*. No Command, cada comando sabe se desfazer e guarda só o necessário (ex.: o trecho apagado), o que usa bem menos memória.',
          concept: 'Command × Memento',
        },
        {
          when: m => m.calls.includes('isinstance'),
          text: 'O `Historico` verifica o tipo do comando com `isinstance`. Ele deveria tratar todos os comandos igualmente via `executar()`/`desfazer()` — é o polimorfismo que torna o Command extensível.',
          concept: 'Polimorfismo',
        },
      ],
      hints: [
        'O `Historico` precisa de **duas pilhas**: `self._feitos = []` e `self._desfeitos = []`.',
        'Em `Apagar.executar`, calcule `corte = max(len(editor.texto) - self.n, 0)`, guarde `self.removido = editor.texto[corte:]` e corte o texto.',
        'Para desfazer `Inserir`, use `editor.texto[:len(editor.texto) - len(self.trecho)]` — cuidado: `texto[:-0]` devolve string vazia!',
      ],
      solution: `class Editor:
    def __init__(self):
        self.texto = ""


class Inserir:
    def __init__(self, trecho):
        self.trecho = trecho

    def executar(self, editor):
        editor.texto += self.trecho

    def desfazer(self, editor):
        editor.texto = editor.texto[:len(editor.texto) - len(self.trecho)]


class Apagar:
    def __init__(self, n):
        self.n = n
        self.removido = ""

    def executar(self, editor):
        corte = max(len(editor.texto) - self.n, 0)
        self.removido = editor.texto[corte:]
        editor.texto = editor.texto[:corte]

    def desfazer(self, editor):
        editor.texto += self.removido


class Historico:
    def __init__(self, editor):
        self.editor = editor
        self._feitos = []
        self._desfeitos = []

    def executar(self, comando):
        comando.executar(self.editor)
        self._feitos.append(comando)
        self._desfeitos.clear()

    def desfazer(self):
        if self._feitos:
            comando = self._feitos.pop()
            comando.desfazer(self.editor)
            self._desfeitos.append(comando)

    def refazer(self):
        if self._desfeitos:
            comando = self._desfeitos.pop()
            comando.executar(self.editor)
            self._feitos.append(comando)
`,
      solutionExplanation: 'Cada comando encapsula uma operação e **sabe desfazê-la**: `Apagar` guarda exatamente o que removeu, e `Inserir` corta pelo tamanho do trecho (evitando a armadilha de `texto[:-0]`). O `Historico` usa duas **pilhas**: desfazer move da pilha de feitos para a de desfeitos, refazer faz o caminho inverso, e um comando novo limpa o refazer — o mesmo comportamento dos editores reais.',
    },
    {
      type: 'code',
      id: 'dp-interview-q7',
      concept: 'Builder',
      title: 'Builder fluente de SQL',
      points: 50,
      say: 'Última questão: um **Builder** com interface fluente. Encadeamento de métodos, sabe?',
      prompt: `Implemente \`ConsultaSQL\`, um builder fluente (cada método de configuração **retorna \`self\`**):

- \`tabela(nome)\` — obrigatório;
- \`campos(*nomes)\` — padrão \`*\`;
- \`where(condicao)\` — pode ser chamado várias vezes (combinadas com \`AND\`);
- \`ordenar(campo)\` e \`limite(n)\` — opcionais;
- \`build()\` monta a string. Sem tabela, lança \`ValueError\`.

Os métodos podem ser chamados **em qualquer ordem**. Formato exato:

\`\`\`python
(ConsultaSQL().tabela("users").campos("id", "nome")
    .where("idade > 18").where("ativo = 1")
    .ordenar("nome").limite(10).build())
# 'SELECT id, nome FROM users WHERE idade > 18 AND ativo = 1 ORDER BY nome LIMIT 10'
\`\`\``,
      starter: `class ConsultaSQL:
    def __init__(self):
        pass

    def tabela(self, nome):
        pass

    def campos(self, *nomes):
        pass

    def where(self, condicao):
        pass

    def ordenar(self, campo):
        pass

    def limite(self, n):
        pass

    def build(self):
        pass
`,
      tests: [
        { name: 'consulta mínima', expr: 'ConsultaSQL().tabela("users").build()', expected: '"SELECT * FROM users"' },
        { name: 'campos', expr: 'ConsultaSQL().tabela("users").campos("id", "nome").build()', expected: '"SELECT id, nome FROM users"' },
        { name: 'vários where com AND', expr: 'ConsultaSQL().tabela("t").where("a = 1").where("b = 2").build()', expected: '"SELECT * FROM t WHERE a = 1 AND b = 2"' },
        { name: 'consulta completa', expr: 'ConsultaSQL().tabela("users").campos("id", "nome").where("idade > 18").where("ativo = 1").ordenar("nome").limite(10).build()', expected: '"SELECT id, nome FROM users WHERE idade > 18 AND ativo = 1 ORDER BY nome LIMIT 10"' },
        { name: 'sem tabela → ValueError', code: 'try:\n    ConsultaSQL().where("x = 1").build()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("build() sem tabela deveria lançar ValueError")' },
        { name: 'métodos retornam self', hidden: true, code: 'q = ConsultaSQL()\nassert q.tabela("t") is q and q.where("a") is q and q.campos("x") is q and q.ordenar("x") is q and q.limite(1) is q' },
        { name: 'qualquer ordem', hidden: true, expr: 'ConsultaSQL().limite(5).where("x = 1").tabela("t").build()', expected: '"SELECT * FROM t WHERE x = 1 LIMIT 5"' },
        { name: 'LIMIT 0', hidden: true, expr: 'ConsultaSQL().tabela("t").limite(0).build()', expected: '"SELECT * FROM t LIMIT 0"' },
        { name: 'instâncias independentes', hidden: true, code: 'a = ConsultaSQL().tabela("a").where("x = 1")\nb = ConsultaSQL().tabela("b")\nassert b.build() == "SELECT * FROM b", "condições vazaram entre instâncias (lista como atributo de classe?)"' },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'O builder usa `global`. O estado da consulta deve ficar na **instância**, senão dois builders se atrapalham.',
          concept: 'Encapsulamento',
        },
        {
          when: (m, code) => /if\s+(not\s+)?self\._?limite\s*:/.test(code),
          text: 'Testar `if self.limite:` trata `0` como "sem limite". Para valores opcionais, compare com `is None`.',
          concept: 'Valores falsy',
        },
      ],
      hints: [
        'No `__init__`, guarde as partes separadas: `self._tabela = None`, `self._campos = ["*"]`, `self._condicoes = []`, `self._ordem = None`, `self._limite = None`.',
        'Cada método de configuração altera um atributo e termina com `return self`.',
        'No `build`, monte uma lista de partes e junte com `" ".join(partes)`. Use `" AND ".join(...)` para as condições e `is not None` para o limite.',
      ],
      solution: `class ConsultaSQL:
    def __init__(self):
        self._tabela = None
        self._campos = ["*"]
        self._condicoes = []
        self._ordem = None
        self._limite = None

    def tabela(self, nome):
        self._tabela = nome
        return self

    def campos(self, *nomes):
        self._campos = list(nomes)
        return self

    def where(self, condicao):
        self._condicoes.append(condicao)
        return self

    def ordenar(self, campo):
        self._ordem = campo
        return self

    def limite(self, n):
        self._limite = n
        return self

    def build(self):
        if not self._tabela:
            raise ValueError("tabela é obrigatória")
        partes = [f"SELECT {', '.join(self._campos)} FROM {self._tabela}"]
        if self._condicoes:
            partes.append("WHERE " + " AND ".join(self._condicoes))
        if self._ordem:
            partes.append(f"ORDER BY {self._ordem}")
        if self._limite is not None:
            partes.append(f"LIMIT {self._limite}")
        return " ".join(partes)
`,
      solutionExplanation: 'O Builder **separa a configuração da montagem**: os métodos só registram partes (e retornam `self` para permitir o encadeamento), e o `build()` valida e monta o resultado final — por isso a ordem das chamadas não importa. Atributos criados no `__init__` evitam estado compartilhado entre instâncias, e `is not None` trata corretamente `LIMIT 0`. Em produção, lembre-se de usar **parâmetros** em vez de concatenar valores do usuário (SQL injection)!',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Obrigada! Foi uma ótima conversa.',
        'Você mostrou que sabe **reconhecer padrões pela intenção**, comparar os parecidos e implementar Command e Builder com atenção aos casos de borda. O resultado detalhado vem a seguir.',
      ],
      board: null,
    },
  ],
});
