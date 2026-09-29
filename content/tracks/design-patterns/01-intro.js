Game.registerModule('design-patterns', {
  id: 'intro',
  title: 'O que são Design Patterns',
  kind: 'lesson',
  level: 1,
  order: 1,
  unit: 'fundamentos',
  summary: 'GoF, as três categorias, composição sobre herança e quando NÃO usar padrões.',
  concepts: ['GoF', 'Categorias de padrões', 'Composição > herança', 'Over-engineering'],
  takeaways: [
    'Um design pattern é uma **solução reutilizável** para um problema recorrente: tem nome, problema, solução e consequências — é um molde, não código pronto.',
    'O GoF organiza seus 23 padrões em **criacionais** (criar), **estruturais** (montar) e **comportamentais** (conversar).',
    'Prefira **composição a herança**: comportamentos viram peças trocáveis em runtime, e N + M peças substituem N × M subclasses.',
    'Em Python, funções de primeira classe, módulos e generators deixam vários padrões quase **invisíveis** — muitas vezes uma função ou um dict bastam.',
    'Padrão sem problema concreto é **over-engineering**: siga o YAGNI e introduza o padrão quando a dor aparecer.',
  ],
  glossary: [
    { term: 'Gang of Four', aliases: ['GoF'], definition: 'Apelido dos quatro autores de *Design Patterns: Elements of Reusable Object-Oriented Software* (1994) — Erich Gamma, Richard Helm, Ralph Johnson e John Vlissides —, o catálogo dos 23 padrões clássicos.' },
    { term: 'Linguagem de padrões', aliases: ['linguagens de padrões', 'pattern language', 'pattern languages'], definition: 'Conceito do arquiteto Christopher Alexander (*A Pattern Language*, 1977): uma rede de padrões em que cada um resolve um problema e prepara o terreno para outros. Inspirou os padrões de software.' },
    { term: 'Proto-pattern', aliases: ['proto-patterns', 'proto-padrão', 'protopadrão'], definition: 'Solução promissora que ainda não tem usos conhecidos suficientes para ser chamada de padrão. Pela **regra de três** da comunidade de padrões, ela precisa aparecer em pelo menos três sistemas independentes.' },
    { term: 'YAGNI', aliases: ["You Aren't Gonna Need It"], definition: '*You Aren\'t Gonna Need It*: princípio da Extreme Programming que manda não construir funcionalidade nem abstração antes de precisar dela de verdade.' },
    { term: 'Over-engineering', aliases: ['overengineering', 'superengenharia'], definition: 'Projetar além do que o problema pede: camadas, interfaces e padrões "para o futuro" que só adicionam indireção e custo de manutenção.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Oi! Antes de mergulhar em cada padrão, vamos entender **o que é** um design pattern.',
        'Um padrão de projeto é uma **solução reutilizável para um problema recorrente** de design de software. Não é código pronto: é uma ideia, um molde.',
      ],
      board: {
        title: 'Design Patterns em uma frase',
        md: `> "Cada padrão descreve um problema que ocorre repetidamente e o núcleo da sua solução, de forma que você possa usá-la um milhão de vezes sem nunca fazer igual duas vezes." — Christopher Alexander

Todo padrão tem quatro partes:

- **Nome** — vocabulário comum ("aqui cabe um Observer")
- **Problema** — quando aplicar
- **Solução** — os elementos e como colaboram
- **Consequências** — os trade-offs`,
      },
    },
    {
      type: 'say',
      text: [
        'O catálogo mais famoso é o livro da **Gang of Four** (GoF), de 1994, com 23 padrões.',
        'Eles são divididos em três categorias: **criacionais**, **estruturais** e **comportamentais**.',
      ],
      board: {
        title: 'As três categorias do GoF',
        md: `| Categoria | Pergunta que responde | Exemplos |
|---|---|---|
| **Criacionais** | *Como* os objetos são criados? | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| **Estruturais** | Como objetos e classes são *compostos*? | Adapter, Decorator, Facade, Composite, Proxy |
| **Comportamentais** | Como objetos *se comunicam* e dividem responsabilidades? | Strategy, Observer, Command, State, Iterator, Template Method |

> [!dica] Truque para decorar: **criar**, **montar**, **conversar**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Um princípio atravessa quase todos os padrões: **prefira composição a herança**.',
        'Herança cria um acoplamento forte e rígido — decidido em tempo de escrita. Composição permite trocar peças **em tempo de execução**.',
      ],
      board: {
        title: 'Composição > herança',
        code: `# Herança: uma subclasse para cada combinação 😬
class PatoQueVoaEGrasna: ...
class PatoDeBorrachaQueChia: ...
class PatoDeMadeiraMudo: ...

# Composição: o pato TEM comportamentos, e eles podem mudar
class Pato:
    def __init__(self, voo, som):
        self.voo = voo
        self.som = som

    def apresentar(self):
        return f"{self.voo()} e {self.som()}"


def voar_com_asas(): return "voa com asas"
def nao_voa():       return "não voa"
def quack():         return "faz quack"

pato = Pato(voar_com_asas, quack)
pato.voo = nao_voa          # trocou o comportamento em runtime!
print(pato.apresentar())    # não voa e faz quack`,
        caption: 'Com herança, N comportamentos × M sons viram N×M classes. Com composição, são N + M peças.',
      },
    },
    {
      type: 'say',
      text: [
        'Repare numa coisa: em `Python`, **funções são objetos de primeira classe**. Dá para passá-las como argumento, guardar em dicionários, devolver de outras funções.',
        'Por isso vários padrões do GoF — pensados para C++ e Java — ficam bem mais enxutos aqui. Muitas vezes uma função substitui uma hierarquia inteira de classes.',
      ],
      board: {
        title: 'Padrões "de graça" em Python',
        md: `| Padrão | Em Java | Em Python |
|---|---|---|
| Strategy | Interface + uma classe por estratégia | Passar uma **função** |
| Command | Classe \`Command\` com \`execute()\` | Função ou \`functools.partial\` |
| Iterator | Classe com \`hasNext()/next()\` | **Generators** (\`yield\`) |
| Singleton | Construtor privado + \`getInstance()\` | **Módulo** |
| Decorator | Classe que embrulha outra | Sintaxe \`@decorator\` |

\`\`\`python
estrategias = {"pix": pagar_pix, "cartao": pagar_cartao}
estrategias[forma](valor)   # Strategy sem nenhuma classe
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o alerta mais importante: **padrões não são objetivos**, são ferramentas.',
        'Aplicar padrão onde não há problema é **over-engineering**: mais classes, mais indireção, código mais difícil de ler.',
        'Uma boa regra é o **YAGNI** — *You Aren\'t Gonna Need It*. Comece simples e introduza o padrão quando a dor aparecer.',
      ],
      board: {
        title: '⚠️ Quando NÃO usar',
        md: `**Sinais de over-engineering:**

- \`FactoryFactoryManager\` para criar um único tipo de objeto
- Uma interface com **uma** implementação "para o futuro"
- Strategy para um \`if\` com dois ramos que nunca vai crescer

**Pergunte antes de aplicar:**

1. Qual problema **concreto** isso resolve hoje?
2. O código fica mais fácil ou mais difícil de ler?
3. Existe uma solução mais simples na linguagem (uma função, um dicionário)?

> [!dica] Em entrevistas, dizer "aqui eu **não** usaria um padrão, porque…" demonstra maturidade.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma curiosidade: os padrões de software nasceram da **arquitetura de prédios**, não da computação.',
        'E existe até um critério para uma solução merecer o título de "padrão". Olha a linha do tempo:',
      ],
      board: {
        title: 'De onde vieram os padrões',
        md: `| Ano | Marco |
|---|---|
| 1977 | O arquiteto **Christopher Alexander** publica *A Pattern Language*: 253 padrões para cidades, bairros e casas |
| 1987 | **Kent Beck** e **Ward Cunningham** levam a ideia para o software, com 5 padrões de interface em Smalltalk (OOPSLA) |
| 1994 | A **Gang of Four** lança *Design Patterns*: 23 padrões, com exemplos em C++ e Smalltalk |
| 1996 | **Peter Norvig** mostra que 16 dos 23 ficam "invisíveis ou mais simples" em linguagens dinâmicas |

Um padrão não é inventado: é **descoberto** em sistemas que já funcionam. Por isso cada padrão do GoF traz uma seção *Known Uses* (usos conhecidos), com sistemas reais que o aplicam.

> [!sabia] A comunidade de padrões segue a **regra de três**: uma solução só vira padrão depois de aparecer em pelo menos **três** sistemas independentes. Antes disso, ela é um **proto-pattern** — uma boa ideia ainda não comprovada. É o mesmo espírito do YAGNI: primeiro a repetição real, depois a abstração.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Categorias, composição e bom senso.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-intro-q1',
      concept: 'Categorias de padrões',
      say: 'Vamos aquecer: em que categoria entra o Observer?',
      prompt: 'O padrão **Observer** — em que objetos são notificados quando outro muda de estado — pertence a qual categoria do GoF?',
      options: [
        { text: 'Criacional', why: 'Criacionais tratam de **como criar** objetos (Factory, Builder, Singleton).' },
        { text: 'Estrutural', why: 'Estruturais tratam de **composição** de objetos (Adapter, Decorator, Facade).' },
        { text: 'Comportamental', correct: true, why: 'O Observer define como objetos **se comunicam**: um publica, outros reagem.' },
        { text: 'Arquitetural', why: 'Não é uma categoria do GoF — padrões arquiteturais (MVC, camadas) são outro nível.' },
      ],
      explanation: 'Observer é **comportamental**: organiza a comunicação e a distribuição de responsabilidades entre objetos.',
    },
    {
      type: 'mcq',
      id: 'dp-intro-q2',
      concept: 'Categorias de padrões',
      multiple: true,
      say: 'Agora várias podem estar certas. Marque todas as corretas.',
      prompt: 'Quais destes padrões são **estruturais**?',
      options: [
        { text: 'Adapter', correct: true, why: 'Converte uma interface em outra — trata de como objetos se **encaixam**.' },
        { text: 'Strategy', why: 'Strategy é **comportamental**: encapsula algoritmos intercambiáveis.' },
        { text: 'Decorator', correct: true, why: 'Embrulha um objeto para adicionar comportamento — composição de objetos.' },
        { text: 'Builder', why: 'Builder é **criacional**: constrói objetos complexos passo a passo.' },
        { text: 'Facade', correct: true, why: 'Oferece uma interface simples para um subsistema — estrutural.' },
      ],
      explanation: 'Estruturais (**Adapter, Decorator, Facade**, Composite, Proxy…) falam de como **montar** objetos maiores a partir de menores.',
    },
    {
      type: 'match',
      id: 'dp-rx-intro-q5',
      concept: 'Padrões em Python',
      say: 'Rapidinha: em Python, vários padrões viram um recurso da linguagem. Associe cada um.',
      prompt: 'Associe cada **padrão** ao recurso do Python que muitas vezes o substitui.',
      pairs: [
        { left: 'Strategy', right: 'Passar uma função como argumento (o `key=` do `sorted`)' },
        { left: 'Iterator', right: 'Um generator com `yield`' },
        { left: 'Singleton', right: 'Uma instância criada no nível do **módulo**' },
        { left: 'Command', right: 'Uma closure ou `functools.partial` guardada para depois' },
        { left: 'Simple Factory', right: 'Um `dict` que mapeia nomes a classes' },
      ],
      explanation: 'Em Python, funções, classes e módulos são **objetos de primeira classe**: dá para passá-los, guardá-los e chamá-los depois. Por isso o Strategy vira uma função, o Command vira um callable guardado, o Iterator vira um generator, o Singleton vira um módulo (importado uma única vez) e a fábrica vira um dicionário de classes. O padrão continua lá — só a cerimônia sumiu.',
    },
    {
      type: 'open',
      id: 'dp-intro-q3',
      concept: 'Over-engineering',
      say: 'Pergunta de maturidade: quando você NÃO usaria um design pattern?',
      prompt: 'Quando **não** vale a pena aplicar um design pattern? Dê argumentos que você usaria numa revisão de código.',
      minWords: 12,
      rubric: [
        { label: 'Fala em **over-engineering** / complexidade desnecessária', keywords: ['over-engineering', 'overengineering', 'complexidade', 'complexo', 'complica', 'excesso', 'desnecessari'], concept: 'Over-engineering', why: 'Cada padrão adiciona indireção; sem um problema real, é só custo.' },
        { label: 'Menciona que deve existir um **problema concreto** / necessidade real', keywords: ['problema real', 'problema concreto', 'necessidade', 'precisa', 'dor', 'nao existe problema', 'sem problema'], concept: 'Padrões resolvem problemas', why: 'Padrão é resposta a um problema recorrente — não um objetivo em si.' },
        { label: 'Cita **YAGNI** / não antecipar o futuro', keywords: ['yagni', 'futuro', 'antecip', 'prematur', 'talvez precise', 'nao vai precisar'], concept: 'YAGNI', why: 'Abstrações "para o futuro" costumam errar o futuro e ficar como peso morto.' },
        { label: 'Valoriza **simplicidade/legibilidade** (ou uma solução mais simples da linguagem)', keywords: ['simpl', 'legib', 'leitura', 'ler', 'funcao', 'dicionario', 'kiss'], concept: 'Simplicidade (KISS)', why: 'Em Python, uma função ou um dicionário frequentemente substitui o padrão inteiro.' },
      ],
      modelAnswer: `Não vale a pena quando **não existe um problema concreto** que o padrão resolva. Aplicar padrões "por precaução" gera **over-engineering**: mais classes, mais indireção e um código mais difícil de ler e manter.

Sigo o **YAGNI**: se hoje só existe uma implementação, não crio interface, fábrica e registro "para o futuro" — introduzo o padrão quando a necessidade aparecer (por exemplo, quando surge o terceiro \`elif\`).

Também prefiro a **solução mais simples** da linguagem: em Python, muitas vezes uma função passada como argumento ou um dicionário resolve o que em Java exigiria uma hierarquia de classes (KISS).`,
    },
    {
      type: 'code',
      id: 'dp-intro-q4',
      concept: 'Composição > herança',
      title: 'Notificador por composição',
      say: 'Agora código! Use **composição**: o notificador *tem* um canal, em vez de *ser* um canal.',
      prompt: `Implemente um sistema de notificações usando **composição**:

- \`CanalEmail\` e \`CanalSMS\`: cada um tem o método \`enviar(msg)\` que **retorna** a string \`"[email] <msg>"\` ou \`"[sms] <msg>"\`.
- \`Notificador(canal)\`: guarda o canal no atributo \`canal\` e tem \`notificar(usuario, msg)\`, que retorna \`canal.enviar(f"{usuario}: {msg}")\`.
- O \`Notificador\` deve funcionar com **qualquer** objeto que tenha um método \`enviar\` (duck typing), e o canal pode ser trocado depois de criado.`,
      starter: `class CanalEmail:
    def enviar(self, msg):
        pass


class CanalSMS:
    def enviar(self, msg):
        pass


class Notificador:
    def __init__(self, canal):
        pass

    def notificar(self, usuario, msg):
        pass
`,
      tests: [
        { name: 'e-mail', expr: 'Notificador(CanalEmail()).notificar("ana", "oi")', expected: '"[email] ana: oi"' },
        { name: 'SMS', expr: 'Notificador(CanalSMS()).notificar("bob", "olá")', expected: '"[sms] bob: olá"' },
        { name: 'qualquer objeto com enviar()', code: 'class Fake:\n    def enviar(self, m):\n        return m.upper()\n\nassert Notificador(Fake()).notificar("x", "y") == "X: Y", "Notificador deve delegar para canal.enviar"' },
        { name: 'trocar o canal em runtime', hidden: true, code: 'n = Notificador(CanalEmail())\nn.canal = CanalSMS()\nassert n.notificar("a", "b") == "[sms] a: b"' },
      ],
      reviews: [
        {
          when: m => m.classes.some(c => c.name === 'Notificador' && c.bases.some(b => b !== 'object')),
          text: 'O `Notificador` herda de outra classe. Aqui a relação é "**tem** um canal", não "**é** um canal" — composição deixa trocar o canal sem criar subclasses.',
          concept: 'Composição > herança',
        },
        {
          when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
          text: 'Você checou o tipo do canal (`isinstance`/`type`). Basta chamar `enviar` — isso é **duck typing** e mantém o notificador aberto a novos canais.',
          concept: 'Duck typing / polimorfismo',
        },
      ],
      hints: [
        'No `__init__` do `Notificador`, apenas guarde: `self.canal = canal`.',
        'Em `notificar`, delegue: `return self.canal.enviar(f"{usuario}: {msg}")`.',
      ],
      solution: `class CanalEmail:
    def enviar(self, msg):
        return f"[email] {msg}"


class CanalSMS:
    def enviar(self, msg):
        return f"[sms] {msg}"


class Notificador:
    def __init__(self, canal):
        self.canal = canal

    def notificar(self, usuario, msg):
        return self.canal.enviar(f"{usuario}: {msg}")
`,
      solutionExplanation: 'O `Notificador` não sabe nada sobre e-mail ou SMS: ele só **delega** para o objeto que recebeu. Novos canais (Slack, push…) entram sem alterar o notificador, e o canal pode ser trocado em tempo de execução — flexibilidade que a herança não daria.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo começo! Recapitulando: padrões são **vocabulário** e soluções para problemas recorrentes, divididos em **criacionais, estruturais e comportamentais**.',
        'Prefira **composição**, aproveite as funções de primeira classe do Python e, acima de tudo, **não use padrão sem problema**. Próxima parada: Singleton!',
      ],
      board: null,
    },
  ],
});
