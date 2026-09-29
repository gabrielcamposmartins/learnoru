Game.registerModule('design-patterns', {
  id: 'singleton',
  title: 'Singleton',
  kind: 'lesson',
  level: 1,
  order: 10,
  unit: 'criacionais',
  summary: 'Garantir uma única instância — e entender por que ele é o padrão mais polêmico.',
  concepts: ['Singleton', 'Estado global', '__new__', 'Testabilidade'],
  takeaways: [
    'O Singleton garante **uma única instância** com um ponto de acesso global; em Python, quem controla a criação é o `__new__`.',
    'O `__init__` roda a **cada** chamada da classe, mesmo quando o `__new__` devolve a instância existente — inicialize o estado uma única vez, dentro do `__new__`.',
    '**Módulos já são singletons**: são importados uma vez e ficam em cache em `sys.modules`.',
    'Singleton é **estado global** disfarçado: acoplamento oculto e testes que vazam estado. Prefira criar a instância na inicialização e **injetá-la**.',
    'Quando importa o estado compartilhado, e não a identidade, existe o **Borg** (*Monostate*): instâncias diferentes com o mesmo `__dict__`.',
  ],
  glossary: [
    { term: 'Singleton', aliases: ['padrão Singleton', 'singletons'], definition: 'Padrão criacional do GoF que garante que uma classe tenha **uma única instância** e oferece um ponto de acesso global a ela. É o padrão mais criticado do livro, por ser estado global disfarçado.' },
    { term: 'Monostate', aliases: ['padrão Borg', 'Borg pattern', 'Monostate pattern'], definition: 'Alternativa ao Singleton: várias instâncias **distintas** compartilham o mesmo estado. Em Python, é o *Borg* de Alex Martelli, que aponta o `__dict__` de cada instância para um único dicionário.' },
    { term: 'Estado global', aliases: ['estados globais', 'global state'], definition: 'Dado mutável acessível de qualquer ponto do programa. Esconde dependências (elas não aparecem nas assinaturas), acopla módulos e faz um teste vazar estado para o outro.' },
    { term: 'Composition root', aliases: ['raiz de composição'], definition: 'O único ponto da aplicação — em geral perto do `main` — onde os objetos são criados e ligados entre si. É ali que o objeto "único" nasce, para então ser injetado em quem precisa.' },
    { term: 'Inicialização preguiçosa', aliases: ['lazy initialization', 'inicialização lazy'], definition: 'Adiar a criação de um objeto caro até o primeiro uso. O Singleton clássico faz isso no `__new__`; com threads, exige um lock para não criar duas instâncias.' },
    { term: 'sys.modules', aliases: ['cache de módulos'], definition: 'Dicionário nome → módulo já importado. Um `import` repetido devolve o objeto que já está ali, sem reexecutar o arquivo — por isso módulos se comportam como singletons.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Vamos começar pelo padrão mais famoso — e mais polêmico: o **Singleton**.',
        'A ideia é simples: garantir que uma classe tenha **uma única instância** e oferecer um ponto global de acesso a ela.',
      ],
      board: {
        title: 'Singleton — padrão criacional',
        md: `**Problema:** alguns recursos devem existir uma única vez na aplicação.

- Configuração carregada de um arquivo
- Pool de conexões com o banco
- Logger central

**Solução:** a própria classe controla a criação e sempre devolve **a mesma instância**.

> [!dica] Em entrevistas, o ponto mais valorizado não é implementar, é saber **quando evitar**.`,
      },
    },
    {
      type: 'say',
      text: [
        'Em Python, quem cria o objeto é o método `__new__`; o `__init__` só inicializa um objeto que já existe.',
        'Então sobrescrevemos o `__new__` para guardar a instância num atributo de classe e devolvê-la nas próximas chamadas.',
      ],
      board: {
        title: 'Implementação clássica com __new__',
        code: `class Logger:
    _instancia = None  # atributo de CLASSE, compartilhado

    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
            cls._instancia.mensagens = []   # inicializa UMA vez
        return cls._instancia

    def log(self, msg):
        self.mensagens.append(msg)


a = Logger()
b = Logger()
print(a is b)       # True — mesmo objeto
a.log("oi")
print(b.mensagens)  # ['oi']`,
        caption: 'Repare: a inicialização fica dentro do `if`, e não no `__init__`.',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Cuidado com uma armadilha clássica: o `__init__` roda **toda vez** que você chama `Logger()`, mesmo devolvendo a mesma instância.',
        'Se você fizer `self.mensagens = []` no `__init__`, cada chamada apaga o estado anterior!',
      ],
      board: {
        title: '⚠️ Armadilha do __init__',
        code: `class LoggerBugado:
    _instancia = None

    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
        return cls._instancia

    def __init__(self):
        self.mensagens = []   # roda a cada LoggerBugado()!


a = LoggerBugado()
a.mensagens.append("importante")
b = LoggerBugado()          # __init__ roda de novo...
print(a.mensagens)          # [] — perdemos o dado`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E tem um jeito ainda mais pythônico: **módulos já são singletons**. Um módulo é importado uma única vez e fica em cache em `sys.modules`.',
        'Na prática, muitas vezes basta criar uma instância no módulo e importá-la.',
      ],
      board: {
        title: 'O jeito pythônico: módulo como singleton',
        code: `# config.py
class _Config:
    def __init__(self):
        self.valores = {"debug": False}

config = _Config()   # criado uma vez, na primeira importação


# em qualquer outro arquivo:
from config import config
config.valores["debug"] = True`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Agora a parte que diferencia um sênior: **por que o Singleton é considerado um anti-pattern** por muita gente?',
        'Ele é, no fundo, **estado global** disfarçado. Isso cria acoplamento escondido e dificulta testes, porque o estado vaza de um teste para outro.',
        'A alternativa mais comum é a **injeção de dependência**: cria-se um objeto só, na inicialização, e ele é passado para quem precisa.',
      ],
      board: {
        title: 'Prós e contras',
        md: `| ✅ Prós | ❌ Contras |
|---|---|
| Garante instância única | Estado global → acoplamento oculto |
| Acesso fácil de qualquer lugar | Difícil de testar/mockar |
| Inicialização preguiçosa (lazy) | Viola o Princípio da Responsabilidade Única (cria + faz o trabalho) |
| | Problemas com concorrência (threads) |

**Alternativa:** criar uma instância na composição da aplicação e **injetá-la**:

\`\`\`python
class Servico:
    def __init__(self, logger):   # recebe, não busca globalmente
        self.logger = logger
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E se o que você quer não é **um objeto só**, mas **um estado só**? Aí entra um padrão pouco conhecido: o **Borg**.',
        'As instâncias são diferentes, mas todas enxergam os mesmos dados. Resistir é inútil. 😄',
      ],
      board: {
        title: 'Borg (Monostate): estado compartilhado, identidade não',
        md: `\`\`\`python
class Borg:
    _estado = {}                       # UM dicionário para todas as instâncias

    def __init__(self):
        self.__dict__ = self._estado   # cada instância usa o mesmo __dict__


class Config(Borg):
    pass


a, b = Config(), Config()
a.tema = "dark"
print(b.tema)    # 'dark'  — o estado é compartilhado
print(a is b)    # False   — mas são objetos diferentes!
\`\`\`

| | Singleton | Borg (Monostate) |
|---|---|---|
| Garante | a **mesma identidade** (\`a is b\`) | o **mesmo estado** |
| Com herança | a subclasse pode receber a instância da mãe (o \`_instancia\` é herdado) | as subclasses compartilham o estado, a menos que redefinam \`_estado\` |
| Problema de fundo | estado global | estado global (igualzinho) |

> [!sabia] O padrão Borg foi proposto por **Alex Martelli** (autor do *Python Cookbook*), com a provocação de que quase nunca importa a **identidade** do objeto, e sim o **estado** que ele compartilha. Em C++ e Java, a mesma ideia se chama **Monostate**. E o próprio **Erich Gamma**, do GoF, disse numa entrevista em 2009 que era a favor de tirar o Singleton do livro: "seu uso quase sempre é um *design smell*".`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Consolide o Singleton e suas alternativas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-singleton-q1',
      concept: 'Singleton',
      say: 'Primeira: qual é o objetivo principal do Singleton?',
      prompt: 'Qual é o **objetivo** do padrão Singleton?',
      options: [
        { text: 'Garantir que uma classe tenha uma única instância e fornecer um ponto de acesso global a ela.', correct: true, why: 'Essa é a definição do GoF.' },
        { text: 'Permitir criar objetos sem especificar a classe concreta.', why: 'Isso é o objetivo do **Factory Method** / **Abstract Factory**.' },
        { text: 'Adicionar responsabilidades a um objeto dinamicamente.', why: 'Isso é o **Decorator**.' },
        { text: 'Garantir que uma classe não possa ser herdada.', why: 'Isso seria uma classe "final" — não tem relação com o Singleton.' },
      ],
      explanation: 'O Singleton controla a **criação** (por isso é criacional) para que exista apenas uma instância, acessível globalmente.',
    },
    {
      type: 'mcq',
      id: 'dp-singleton-q2',
      concept: '__new__ vs __init__',
      say: 'Agora olha esse código com atenção…',
      prompt: `O que este código imprime?

\`\`\`python
class Contador:
    _inst = None
    def __new__(cls):
        if cls._inst is None:
            cls._inst = super().__new__(cls)
        return cls._inst
    def __init__(self):
        self.total = 0

a = Contador()
a.total += 5
b = Contador()
print(a.total, a is b)
\`\`\``,
      options: [
        { text: '`5 True`', why: 'A instância é a mesma, mas o `__init__` rodou de novo quando chamamos `Contador()`.' },
        { text: '`0 True`', correct: true, why: '`b = Contador()` devolve o mesmo objeto, mas executa `__init__` de novo, zerando `total`.' },
        { text: '`0 False`', why: 'O `__new__` garante que `a is b` é `True`.' },
        { text: '`5 False`', why: 'Os dois nomes apontam para o mesmo objeto.' },
      ],
      explanation: 'O `__init__` é chamado **toda vez** que a classe é chamada, mesmo quando `__new__` devolve uma instância existente. Por isso a inicialização do estado deve ficar dentro do `if` no `__new__` (ou ser protegida).',
    },
    {
      type: 'match',
      id: 'dp-rx-singleton-q5',
      concept: 'Alternativas ao Singleton',
      say: 'Agora associe: cada técnica garante uma coisa diferente.',
      prompt: 'Associe cada **técnica** ao que ela garante.',
      pairs: [
        { left: 'Singleton com `__new__`', right: 'Sempre o **mesmo objeto**: `a is b` é `True`' },
        { left: 'Borg (Monostate)', right: 'Objetos **diferentes** que compartilham o mesmo estado' },
        { left: 'Instância no nível do módulo', right: 'Criada na 1ª importação e reaproveitada via `sys.modules`' },
        { left: '`@functools.cache` numa função `obter_config()`', right: 'Criada só no **primeiro uso** e devolvida nas chamadas seguintes' },
        { left: 'Injeção de dependência', right: 'Criada uma vez na inicialização e **passada explicitamente** a quem precisa' },
      ],
      explanation: 'Todas evitam criar o objeto duas vezes, mas com garantias diferentes. Singleton e Borg controlam isso **dentro da classe** (identidade × estado); o módulo e o `functools.cache` usam caches da própria linguagem — o segundo, de forma preguiçosa. Só a **injeção de dependência** deixa a dependência visível na assinatura, e por isso é a mais fácil de testar: no teste, basta passar outra instância.',
    },
    {
      type: 'open',
      id: 'dp-singleton-q3',
      concept: 'Estado global e testabilidade',
      say: 'Pergunta clássica de entrevista. Responda como se estivesse falando com o entrevistador.',
      prompt: 'Por que muitos desenvolvedores consideram o Singleton um **anti-pattern**? Qual alternativa você usaria?',
      minWords: 12,
      rubric: [
        { label: 'Menciona que ele funciona como **estado global**', keywords: ['global', 'estado compartilhado'], concept: 'Estado global', why: 'Estado global torna o comportamento dependente de onde e quando algo foi alterado.' },
        { label: 'Aponta o **acoplamento** escondido', keywords: ['acopla', 'dependencia oculta', 'dependencia escondida', 'dependencias ocultas', 'implicit'], concept: 'Acoplamento', why: 'Quem usa o Singleton depende dele sem que isso apareça na assinatura.' },
        { label: 'Cita a dificuldade de **testar/mockar**', keywords: ['test', 'mock'], concept: 'Testabilidade', why: 'O estado vaza entre testes e é difícil substituir por um dublê.' },
        { label: 'Propõe **injeção de dependência** como alternativa', keywords: ['injecao', 'injetar', 'injeta', 'dependency injection', ['passar', 'construtor'], ['receb', 'parametro']], concept: 'Injeção de dependência', why: 'Criar a instância uma vez e passá-la explicitamente mantém a unicidade sem o acesso global.' },
      ],
      modelAnswer: `O Singleton é, na prática, **estado global**: qualquer parte do código pode ler e alterar a instância, o que cria **acoplamento oculto** (a dependência não aparece na assinatura das funções) e torna o comportamento difícil de raciocinar.

Isso prejudica a **testabilidade**: o estado vaza entre testes e é difícil substituir o objeto por um mock. Ele também mistura duas responsabilidades (controlar a criação e fazer o trabalho).

Como alternativa, eu criaria o objeto **uma vez** na inicialização da aplicação (composition root) e usaria **injeção de dependência**, passando a instância pelo construtor para quem precisa.`,
    },
    {
      type: 'code',
      id: 'dp-singleton-q4',
      concept: 'Singleton',
      title: 'Configuração global',
      say: 'Agora é com você! Implemente um Singleton de configuração — e cuidado com a armadilha do `__init__`.',
      prompt: `Implemente a classe \`Configuracao\` como **Singleton** usando \`__new__\`.

- \`Configuracao()\` deve devolver **sempre a mesma instância**.
- Ela guarda um dicionário \`valores\`, compartilhado por toda a aplicação.
- \`set(chave, valor)\` grava um valor; \`get(chave, padrao=None)\` lê (devolvendo \`padrao\` se não existir).
- Chamar \`Configuracao()\` de novo **não pode apagar** os valores já gravados.`,
      starter: `class Configuracao:
    _instancia = None

    def __new__(cls):
        # TODO: crie a instância apenas na primeira vez
        pass

    def set(self, chave, valor):
        pass

    def get(self, chave, padrao=None):
        pass
`,
      tests: [
        { name: 'Configuracao() is Configuracao()', code: 'a = Configuracao()\nb = Configuracao()\nassert a is b, "Configuracao() deve devolver sempre a mesma instância"' },
        { name: 'set/get funcionam', code: 'c = Configuracao()\nc.set("tema", "dark")\nassert c.get("tema") == "dark", "get deveria devolver o valor gravado"' },
        { name: 'valor padrão', expr: 'Configuracao().get("inexistente", 42)', expected: '42' },
        { name: 'novo Configuracao() não apaga valores', code: 'Configuracao().set("idioma", "pt")\nassert Configuracao().get("idioma") == "pt", "Chamar Configuracao() de novo apagou os valores — cuidado com o __init__!"' },
        { name: 'valores compartilhado', hidden: true, code: 'a = Configuracao()\na.set("x", 1)\nb = Configuracao()\nassert b.valores is a.valores and b.valores["x"] == 1' },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`/`nonlocal`. O próprio atributo de classe (`cls._instancia`) já guarda o estado — `global` aumenta o acoplamento.',
          concept: 'Encapsulamento',
        },
        {
          when: m => m.classes.some(c => c.methods.includes('__init__')),
          text: 'Sua classe define `__init__`. Ele roda a cada `Configuracao()`; mesmo funcionando, é frágil — prefira inicializar o estado dentro do `__new__`, só na primeira criação.',
          concept: '__new__ vs __init__',
        },
      ],
      hints: [
        'Dentro do `__new__`, verifique `if cls._instancia is None:` e só então crie com `super().__new__(cls)`.',
        'Inicialize `valores = {}` **dentro** desse `if`, logo após criar a instância — assim só acontece uma vez.',
        'Para o `get`, use `self.valores.get(chave, padrao)`.',
      ],
      solution: `class Configuracao:
    _instancia = None

    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
            cls._instancia.valores = {}
        return cls._instancia

    def set(self, chave, valor):
        self.valores[chave] = valor

    def get(self, chave, padrao=None):
        return self.valores.get(chave, padrao)
`,
      solutionExplanation: 'O `__new__` cria a instância só na primeira chamada e já inicializa `valores` ali dentro. Como não há `__init__`, chamadas seguintes a `Configuracao()` devolvem o mesmo objeto **sem** reiniciar o estado.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Resumindo: Singleton garante instância única, em Python pode ser feito com `__new__` ou simplesmente com um **módulo**…',
        '…e em entrevistas, sempre mencione os riscos de **estado global** e a alternativa de **injeção de dependência**.',
      ],
      board: null,
    },
  ],
});
