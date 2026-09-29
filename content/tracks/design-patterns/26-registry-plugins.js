(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  Game.registerModule('design-patterns', {
    id: 'registry-plugins',
    title: 'Registry e plugins',
    kind: 'lesson',
    level: 3,
    order: 41,
    unit: 'pythonicos',
    summary: 'Plugins que se registram sozinhos com `__init_subclass__`, descoberta por entry points e o Open/Closed de verdade — com os custos na mesa.',
    concepts: ['Registry', '__init_subclass__', 'Metaclasses', 'Entry points', 'Aberto/Fechado'],
    takeaways: [
      'Um **registro** (dict nome → classe) deixa o núcleo **fechado para modificação e aberto para extensão**: plugin novo = código novo, não edição.',
      'Registro de produção **barra duplicados**, **devolve a classe original** e erra com mensagem útil (listando as opções).',
      '`__init_subclass__` registra subclasses automaticamente e aceita argumentos na linha `class`; repasse o resto dos `**kwargs` para `super()` e deixe metaclasses para quando precisar mudar a **criação** da classe.',
      'Registro automático depende de **import**: garanta a descoberta (imports explícitos, `pkgutil`, entry points) e isole o registro nos testes.',
      '**Entry points** (`importlib.metadata`) trazem plugins de outros pacotes instalados — é assim que o pytest acha plugins pelo grupo `pytest11`.',
    ],
    glossary: [
      { term: '__init_subclass__', aliases: ['init_subclass', 'PEP 487'], definition: 'Gancho (Python 3.6+, PEP 487) chamado na classe-mãe sempre que uma subclasse é **definida**. Recebe a nova subclasse e os argumentos nomeados da linha `class`; ideal para registrar ou validar subclasses.' },
      { term: 'Metaclasse', aliases: ['metaclasses', 'metaclass'], definition: 'A classe de uma classe (por padrão, `type`). Controla a criação das classes (`__new__`, `__prepare__`, `__call__`); poderosa, mas complexa e sujeita a conflitos quando bases têm metaclasses diferentes.' },
      { term: 'Entry point', aliases: ['entry points', 'ponto de entrada', 'pontos de entrada'], definition: 'Metadado de um pacote instalado que anuncia um objeto (`modulo:atributo`) num grupo nomeado. A aplicação o descobre com `importlib.metadata.entry_points(group=...)` e carrega com `ep.load()`.' },
      { term: 'Registry', aliases: ['registro de plugins', 'plugin registry', 'registries'], definition: 'Estrutura (em geral um dict nome → classe ou função) onde componentes se cadastram para serem encontrados depois pelo núcleo, sem que ele os conheça de antemão.' },
      { term: 'Arquitetura microkernel', aliases: ['microkernel', 'arquitetura de plugins', 'plug-in architecture'], definition: 'Estilo em que um núcleo mínimo define pontos de extensão e as funcionalidades chegam como plugins — ex.: VS Code e o próprio pytest.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Na aula de Factory você viu o registro com dicionário. Hoje vamos transformar essa ideia num **sistema de plugins** de verdade.',
          'A meta: adicionar um formato novo **sem tocar em uma linha** do núcleo.',
        ],
        board: {
          title: 'Sistemas de plugins: o núcleo não conhece os plugins',
          md: `\`\`\`text
 plugins (código novo)              núcleo (não muda)
 ---------------------              ------------------------------
 ExportadorCSV  --registra-->       registro = {"csv": ...,
 ExportadorPDF  --registra-->                   "pdf": ...}
                                    criar("pdf") -> consulta o dict
\`\`\`

Registros estão por toda a **stdlib** — você provavelmente já usou algum:

- \`atexit.register(func)\` — funções chamadas quando o interpretador encerra
- \`functools.singledispatch\` — \`@f.register(int)\` escolhe a implementação pelo **tipo** do 1º argumento
- \`abc.ABC.register(Classe)\` — declara uma "subclasse virtual"
- \`codecs.register(busca)\` — adiciona novos encodings

> [!dica] Registro = **inversão de controle**: o plugin se apresenta, e o núcleo o chama quando precisar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Primeiro, vamos deixar o registro com cara de produção: um **objeto**, não um dict global solto.',
          'Três detalhes fazem a diferença: barrar duplicados, devolver a classe original e errar com uma mensagem útil.',
        ],
        board: {
          title: 'Um registro de produção',
          code: `class Registro:
    def __init__(self, tipo):
        self.tipo = tipo                  # só para mensagens de erro
        self._itens = {}

    def registrar(self, nome):
        def decorador(obj):
            chave = nome.lower()
            if chave in self._itens:      # duplicado = bug de configuração
                raise ValueError(f"{self.tipo} '{chave}' já registrado")
            self._itens[chave] = obj
            return obj                    # devolve o original: continua usável
        return decorador

    def criar(self, nome, *args, **kwargs):
        try:
            classe = self._itens[nome.lower()]
        except KeyError:
            opcoes = ", ".join(sorted(self._itens))
            raise KeyError(f"{self.tipo} '{nome}' desconhecido; opções: {opcoes}") from None
        return classe(*args, **kwargs)


exportadores = Registro("exportador")

@exportadores.registrar("csv")
class ExportadorCSV:
    def exportar(self, linhas): ...`,
          caption: 'Sobrescrever em silêncio é o bug clássico: dois plugins com o mesmo nome e "ganha o último importado". Um registro por **instância** também facilita os testes: cada teste cria o seu.',
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E se o registro fosse **automático**, só de herdar da classe base? Para isso existe o `__init_subclass__`.',
          'Ele roda na classe-mãe toda vez que uma subclasse é **definida** — não quando é instanciada.',
        ],
        board: {
          title: 'Registro automático com __init_subclass__',
          md: `\`\`\`python
class Exportador:
    _registro: dict[str, type] = {}

    def __init_subclass__(cls, nome=None, abstrato=False, **kwargs):
        super().__init_subclass__(**kwargs)     # coopera com outras bases
        if abstrato:
            return                              # bases intermediárias ficam de fora
        chave = (nome or cls.__name__).lower()
        if chave in Exportador._registro:
            raise ValueError(f"exportador '{chave}' duplicado")
        Exportador._registro[chave] = cls


class ExportadorTexto(Exportador, abstrato=True):   # base intermediária
    def exportar(self, linhas):
        return self.separador.join(linhas)

class CSV(ExportadorTexto, nome="csv"):             # argumento na linha class!
    separador = ","

class TSV(ExportadorTexto):                          # nome padrão: "tsv"
    separador = "\\t"

print(sorted(Exportador._registro))                  # ['csv', 'tsv']
\`\`\`

- É implicitamente um \`classmethod\`: \`cls\` é a **nova subclasse**.
- **Não** roda para a própria classe que o define — só para as descendentes, em qualquer nível.
- Palavras-chave da linha \`class X(Base, nome="x")\` chegam como argumentos.
- Consuma os seus argumentos e repasse o resto a \`super()\`: \`object.__init_subclass__\` não aceita nenhum e dá \`TypeError\` (*takes no keyword arguments*).

> [!sabia] O \`__init_subclass__\` chegou no Python 3.6 (PEP 487) justamente para tirar das metaclasses seus dois usos mais comuns: **registrar** e **validar** subclasses. A mesma PEP trouxe o \`__set_name__\` dos descritores. Muita gente experiente ainda escreve uma metaclasse para isso sem saber que o gancho existe.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Antes do Python 3.6, o jeito era uma **metaclasse** — e ela ainda funciona.',
          'Mas é uma ferramenta bem mais pesada: controla a criação da classe inteira e briga com outras metaclasses.',
        ],
        board: {
          title: 'A alternativa pesada: metaclasses',
          md: `\`\`\`python
class MetaPlugin(type):
    registro = {}

    def __init__(cls, nome, bases, ns, **kwargs):
        super().__init__(nome, bases, ns, **kwargs)
        if bases:                         # a própria base também passa aqui!
            MetaPlugin.registro[nome.lower()] = cls


class Plugin(metaclass=MetaPlugin):
    pass

class Pdf(Plugin): ...                    # registro == {"pdf": Pdf}


from abc import ABC
class Base(ABC): ...
class Quebra(Base, metaclass=MetaPlugin): ...
# TypeError: metaclass conflict: the metaclass of a derived class must be
# a (non-strict) subclass of the metaclasses of all its bases
\`\`\`

| | \`__init_subclass__\` | Metaclasse |
|---|---|---|
| Roda | depois que a subclasse existe | durante a **criação** da classe |
| Roda para a própria base? | não | sim (precisa pular) |
| Combina com \`ABC\`, ORMs, \`Enum\`? | sim | pode dar *metaclass conflict* |
| Pode mudar o namespace (\`__prepare__\`) ou \`Classe()\` (\`__call__\`)? | não | sim |

> [!dica] "Metaclasses são uma mágica mais profunda do que 99% dos usuários precisam. Se você está se perguntando se precisa delas, não precisa." — Tim Peters`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Registro automático tem uma pegadinha: a classe só se registra se o módulo dela for **importado**.',
          'Se ninguém importa `pdf.py`, o PDF simplesmente não existe para o núcleo — sem erro nenhum.',
        ],
        board: {
          title: 'Descoberta: o registro depende de import',
          md: `\`\`\`text
meu_app/exportadores/
    __init__.py
    base.py     <- class Exportador (com __init_subclass__)
    csv.py      <- class Csv(Exportador): registra SÓ se csv.py for importado
    pdf.py
\`\`\`

\`\`\`python
# Opção 1 — explícita, em exportadores/__init__.py
from . import csv, pdf  # noqa: F401  (importados pelo efeito colateral)

# Opção 2 — varrer o pacote
import importlib
import pkgutil

def carregar_plugins(pacote):
    for info in pkgutil.iter_modules(pacote.__path__):
        importlib.import_module(f"{pacote.__name__}.{info.name}")
\`\`\`

Registro global também **vaza entre testes**: uma classe criada num teste continua registrada no seguinte. Isole:

\`\`\`python
# conftest.py — cada teste trabalha numa cópia do registro
@pytest.fixture(autouse=True)
def registro_isolado(monkeypatch):
    monkeypatch.setattr(Exportador, "_registro", dict(Exportador._registro))
\`\`\`

> [!atencao] \`Base.__subclasses__()\` parece uma alternativa sem registro, mas lista só as subclasses **diretas** e **já importadas** — netas ficam de fora.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando o plugin vem de **outro pacote**, instalado com `pip`? Aí entram os **entry points**.',
          'O pacote do plugin anuncia o que oferece nos metadados, e a aplicação descobre em tempo de execução com `importlib.metadata`.',
        ],
        board: {
          title: 'Entry points: plugins de outros pacotes',
          md: `\`\`\`toml
# pyproject.toml do pacote de TERCEIROS "exportador-xlsx"
[project.entry-points."meu_app.exportadores"]
xlsx = "exportador_xlsx:ExportadorXLSX"
\`\`\`

\`\`\`python
from importlib.metadata import entry_points

def carregar_exportadores(registro):
    for ep in entry_points(group="meu_app.exportadores"):   # Python 3.10+
        try:
            classe = ep.load()          # só agora importa "exportador_xlsx"
        except Exception as erro:       # plugin quebrado não derruba o app
            log.warning("plugin %s ignorado: %s", ep.name, erro)
            continue
        registro.registrar(ep.name)(classe)
\`\`\`

Você usa isso todo dia sem perceber: o grupo \`console_scripts\` é como o \`pip\` cria comandos de terminal, e o \`pytest\` descobre plugins pelo grupo \`pytest11\`.

> [!atencao] Entry point = código de terceiros rodando no seu processo. Carregue só pacotes confiáveis, permita desligar plugins (*allowlist*) e isole falhas no \`load()\`.

> [!sabia] Núcleo mínimo + plugins tem nome: **arquitetura microkernel**. O próprio pytest é assim — boa parte dele é implementada como plugins internos. É o *Hollywood Principle* em ação: "não nos chame; nós chamamos você".`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Com registro, o princípio **Aberto/Fechado** sai do slide e vira prática: formato novo é arquivo novo.',
          'Mas cada mecanismo cobra seu preço — e às vezes o preço não se paga.',
        ],
        board: {
          title: 'Open/Closed na prática — e o preço',
          md: `| Mecanismo | Melhor quando | Custo |
|---|---|---|
| dict literal | poucos tipos, mesmo pacote | editar o dict (mas é explícito e fácil de achar) |
| decorator \`@registrar\` | plugins no mesmo projeto | o módulo precisa ser importado |
| \`__init_subclass__\` | hierarquia de classes | registro implícito, "mágico" |
| metaclasse | mudar a criação da classe | complexidade e conflitos |
| entry points | plugins de outros pacotes | empacotamento, segurança, debug |

Perguntas de revisão para qualquer registro:

1. O que acontece com **nomes duplicados**?
2. Como o núcleo **descobre** os plugins (quem importa o quê)?
3. Os testes **isolam** o registro?
4. Um plugin quebrado derruba a aplicação inteira?

> [!dica] Com dois formatos que nunca mudam, um \`if\` ou um dict literal ganha de qualquer framework de plugins. Registro automático se paga quando **outras pessoas** — outros times, outros pacotes — precisam estender sem pedir licença.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Registros, `__init_subclass__`, metaclasses e entry points.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'dp-reg-q1',
        concept: '__init_subclass__',
        say: 'Primeira: leia com calma e diga o que é impresso.',
        prompt: `O que este código imprime?

\`\`\`python
class Plugin:
    registro = {}

    def __init_subclass__(cls, abstrato=False, **kwargs):
        super().__init_subclass__(**kwargs)
        if not abstrato:
            Plugin.registro[cls.__name__] = cls

class Base(Plugin, abstrato=True): pass
class A(Base): pass
class B(A): pass
class C(B, abstrato=True): pass

print(sorted(Plugin.registro))
\`\`\``,
        options: [
          { text: "`['A', 'B']`", correct: true, why: '`Plugin` não passa pelo próprio gancho, `Base` e `C` pediram `abstrato=True`, e `A` e `B` são registradas — o gancho roda para descendentes em **qualquer** nível.' },
          { text: "`['A']`", why: 'O gancho não é só para filhos diretos: `B` herda de `A` e também dispara o `__init_subclass__` herdado de `Plugin`.' },
          { text: "`['Plugin', 'A', 'B']`", why: '`__init_subclass__` **não** roda para a classe que o define — só para as subclasses dela.' },
          { text: "`['A', 'B', 'C']`", why: '`C` passou `abstrato=True` na própria linha `class`, então foi pulada. O argumento vale para aquela definição.' },
        ],
        explanation: 'Quando uma classe é criada, o Python chama o `__init_subclass__` do **próximo da MRO** (aqui, o de `Plugin`), passando a nova classe e os argumentos nomeados da linha `class`. A classe que define o gancho nunca passa por ele.',
      },
      {
        type: 'match',
        id: 'dp-reg-q2',
        concept: 'Registry',
        say: 'Agora associe cada mecanismo ao cenário em que ele brilha.',
        prompt: 'Associe cada **mecanismo de registro/descoberta** ao cenário em que ele é a melhor escolha.',
        pairs: [
          { left: 'dict literal `{"csv": Csv}`', right: 'Poucos tipos fixos, todos no mesmo pacote' },
          { left: 'decorator `@registro.registrar("csv")`', right: 'Nome explícito ao lado da classe, sem editar o núcleo' },
          { left: '`__init_subclass__`', right: 'Registrar sozinha toda subclasse de uma hierarquia' },
          { left: 'Metaclasse', right: 'Mudar a própria criação da classe (namespace, instanciação)' },
          { left: 'Entry points', right: 'Descobrir plugins de outros pacotes instalados com pip' },
          { left: '`Base.__subclasses__()`', right: 'Listar só as subclasses diretas já importadas' },
        ],
        explanation: 'Do mais explícito ao mais automático: dict literal → decorator → `__init_subclass__` → entry points. Quanto mais automático, menos o núcleo muda — e mais difícil fica responder "de onde veio esse plugin?". Metaclasse só quando o gancho simples não alcança.',
      },
      {
        type: 'order',
        id: 'dp-reg-q3',
        concept: 'Entry points',
        say: 'Coloque em ordem a jornada de um plugin, do `pyproject.toml` até o registro.',
        prompt: 'Ordene os passos para um plugin de **outro pacote** chegar ao registro da aplicação via entry points.',
        items: [
          'O pacote do plugin declara o grupo e o objeto no `pyproject.toml`',
          'O `pip install` grava esses metadados no `.dist-info` do pacote',
          'A aplicação chama `entry_points(group="meu_app.exportadores")`',
          'Para cada `EntryPoint`, `ep.load()` importa o módulo e devolve o objeto',
          'O objeto carregado é validado e entra no registro — sem mudar o núcleo',
        ],
        explanation: 'Os entry points são **metadados de instalação**: nada é importado até a aplicação pedir. Por isso dá para listar plugins barato (`ep.name`, `ep.value`) e carregar só os usados — e isolar com `try/except` um plugin que quebre no `load()`.',
      },
      {
        type: 'code',
        id: 'dp-reg-q4',
        concept: '__init_subclass__',
        title: 'Plugins que se registram sozinhos',
        points: 50,
        say: 'Mão na massa: uma base de plugins que registra toda subclasse no momento da definição. Os testes ocultos vão testar herança cooperativa — capriche no `super()`!',
        prompt: `Complete a classe base \`Exportador\` usando \`__init_subclass__\`:

- Toda subclasse é registrada **ao ser definida**, com a chave \`nome\` passada na linha da classe (\`class Csv(Exportador, nome="csv")\`) ou, sem \`nome\`, o **nome da classe em minúsculas**.
- As chaves não diferenciam maiúsculas: guarde sempre em minúsculas.
- \`abstrato=True\` na linha da classe: **não** registra (bases intermediárias). As filhas dela são registradas normalmente.
- Nome repetido → \`ValueError\`, e o registro original **não** pode ser sobrescrito.
- Repasse os demais \`**kwargs\` para \`super().__init_subclass__\` (outras bases podem precisar deles).
- \`Exportador.criar(nome, *args, **kwargs)\` instancia o plugin; nome desconhecido → \`KeyError\`.
- \`Exportador.disponiveis()\` devolve a lista **ordenada** de nomes registrados.`,
        starter: py(`
          class Exportador:
              """Base de plugins: toda subclasse se registra sozinha."""

              _registro = {}

              def __init_subclass__(cls, nome=None, abstrato=False, **kwargs):
                  # TODO: repasse **kwargs para super(), pule abstratos,
                  #       normalize a chave e barre duplicados
                  pass

              @classmethod
              def criar(cls, nome, *args, **kwargs):
                  pass

              @classmethod
              def disponiveis(cls):
                  pass
        `),
        tests: [
          {
            name: 'nome explícito na linha class',
            code: py(`
              class Csv(Exportador, nome="csv"):
                  def exportar(self, linhas):
                      return ";".join(",".join(map(str, l)) for l in linhas)

              assert Exportador.disponiveis() == ["csv"], Exportador.disponiveis()
              assert Exportador.criar("csv").exportar([[1, 2], [3, 4]]) == "1,2;3,4"
            `),
          },
          {
            name: 'sem nome: classe em minúsculas, lista ordenada',
            code: py(`
              class Markdown(Exportador):
                  pass

              class Asciidoc(Exportador):
                  pass

              assert Exportador.disponiveis() == ["asciidoc", "markdown"], Exportador.disponiveis()
              assert isinstance(Exportador.criar("markdown"), Markdown)
            `),
          },
          {
            name: 'maiúsculas não importam',
            code: py(`
              class Json(Exportador, nome="JSON"):
                  pass

              assert Exportador.disponiveis() == ["json"], Exportador.disponiveis()
              assert isinstance(Exportador.criar("Json"), Json)
            `),
          },
          {
            name: 'base abstrata fica de fora; as filhas entram',
            code: py(`
              class Texto(Exportador, abstrato=True):
                  separador = ","
                  def exportar(self, valores):
                      return self.separador.join(valores)

              class Tsv(Texto):
                  separador = "|"

              assert Exportador.disponiveis() == ["tsv"], Exportador.disponiveis()
              assert Exportador.criar("tsv").exportar(["a", "b"]) == "a|b"
            `),
          },
          {
            name: 'nome duplicado → ValueError (sem sobrescrever)',
            code: py(`
              class A(Exportador, nome="x"):
                  pass

              try:
                  class B(Exportador, nome="X"):
                      pass
              except ValueError:
                  pass
              else:
                  raise AssertionError("nome duplicado deveria lançar ValueError")
              assert type(Exportador.criar("x")) is A, "o registro original foi sobrescrito"
            `),
          },
          {
            name: 'nome desconhecido → KeyError',
            code: py(`
              try:
                  Exportador.criar("pdf")
              except KeyError:
                  pass
              else:
                  raise AssertionError("criar() com nome desconhecido deveria lançar KeyError")
            `),
          },
          {
            name: 'a base não se registra',
            hidden: true,
            code: 'assert Exportador.disponiveis() == [], "a própria base não deve aparecer no registro"',
          },
          {
            name: 'criar repassa argumentos',
            hidden: true,
            code: py(`
              class Html(Exportador):
                  def __init__(self, titulo, *, tema="claro"):
                      self.titulo, self.tema = titulo, tema

              h = Exportador.criar("HTML", "Relatório", tema="escuro")
              assert (h.titulo, h.tema) == ("Relatório", "escuro")
            `),
          },
          {
            name: 'herança cooperativa com outro __init_subclass__',
            hidden: true,
            code: py(`
              class Auditado:
                  vistos = []
                  def __init_subclass__(cls, **kwargs):
                      super().__init_subclass__(**kwargs)
                      Auditado.vistos.append(cls.__name__)

              class Pdf(Exportador, Auditado, nome="pdf"):
                  pass

              assert Exportador.disponiveis() == ["pdf"], Exportador.disponiveis()
              assert Auditado.vistos == ["Pdf"], "o gancho do Auditado não rodou: faltou super().__init_subclass__(**kwargs)?"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => c.bases.includes('type')),
            text: 'Você criou uma **metaclasse**. Para registrar e validar subclasses, `__init_subclass__` resolve sem o risco de *metaclass conflict* e é bem mais simples de ler.',
            concept: 'Metaclasses',
          },
          {
            when: (m, code) => /\bglobals\s*\(|\beval\s*\(|__subclasses__/.test(code),
            text: 'Descobrir classes por varredura (`globals()`, `eval`, `__subclasses__()`) é frágil: pega só o que está visível naquele momento (`__subclasses__` nem vê netas). O registro explícito no gancho é previsível.',
            concept: 'Registry',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Um `except` amplo transforma qualquer erro — até um `TypeError` no construtor do plugin — em outra coisa e esconde a causa. Capture só o que você espera (`KeyError` na busca).',
            concept: 'Tratamento de erros',
          },
        ],
        hints: [
          'Dentro de `__init_subclass__`, `cls` é a **subclasse nova**. Comece com `super().__init_subclass__(**kwargs)` e depois `if abstrato: return`.',
          'A chave é `(nome or cls.__name__).lower()`. Grave em `Exportador._registro` (o dict da base), não num dict novo por subclasse.',
          'Antes de gravar: `if chave in Exportador._registro: raise ValueError(...)`. No `criar`, busque `Exportador._registro[nome.lower()]` e instancie com `(*args, **kwargs)`; em `disponiveis`, `sorted(...)`.',
        ],
        solution: py(`
          class Exportador:
              """Base de plugins: toda subclasse se registra sozinha."""

              _registro = {}

              def __init_subclass__(cls, nome=None, abstrato=False, **kwargs):
                  super().__init_subclass__(**kwargs)      # coopera com outras bases
                  if abstrato:
                      return
                  chave = (nome or cls.__name__).lower()
                  if chave in Exportador._registro:
                      existente = Exportador._registro[chave].__name__
                      raise ValueError(f"exportador '{chave}' já registrado por {existente}")
                  Exportador._registro[chave] = cls

              @classmethod
              def criar(cls, nome, *args, **kwargs):
                  try:
                      classe = Exportador._registro[nome.lower()]
                  except KeyError:
                      opcoes = ", ".join(sorted(Exportador._registro)) or "nenhum"
                      raise KeyError(f"exportador '{nome}' desconhecido; disponíveis: {opcoes}") from None
                  return classe(*args, **kwargs)

              @classmethod
              def disponiveis(cls):
                  return sorted(Exportador._registro)
        `),
        solutionExplanation: 'O gancho roda uma vez por subclasse, no momento da **definição**. Ele primeiro coopera com a MRO (`super().__init_subclass__(**kwargs)` — sem isso, o `Auditado` nunca seria avisado), consome os próprios argumentos (`nome`, `abstrato`) e grava no dict da **base**, compartilhado por toda a hierarquia. Como `abstrato` é argumento da linha `class`, e não atributo herdado, as filhas de uma base abstrata entram normalmente. O duplicado é barrado **antes** de gravar, e o erro de busca lista as opções — o tipo de mensagem que poupa uma hora de depuração.',
      },
      {
        type: 'mcq',
        id: 'dp-reg-q5',
        concept: 'Metaclasses',
        say: 'Pergunta de sênior: metaclasse ainda tem vez?',
        prompt: 'Em qual cenário uma **metaclasse** ainda se justifica, em vez de `__init_subclass__`?',
        options: [
          { text: 'Quando é preciso controlar a **criação** da classe em si — por exemplo, um namespace customizado com `__prepare__` ou mudar o que `Classe()` faz com `__call__`.', correct: true, why: '`__init_subclass__` só roda depois que a classe já existe: ele não troca o namespace do corpo da classe nem intercepta a instanciação. O `Enum` usa metaclasse justamente para coisas como `len(Cor)` e iterar os membros.' },
          { text: 'Para registrar automaticamente cada subclasse num dicionário.', why: 'É exatamente o caso de uso para o qual o `__init_subclass__` foi criado (PEP 487).' },
          { text: 'Para validar que toda subclasse define certos atributos.', why: '`__init_subclass__` também valida: basta checar os atributos e lançar `TypeError`. `abc.abstractmethod` é outra opção.' },
          { text: 'Sempre que o sistema precisar ser "extensível e profissional".', why: 'Isso é *cargo cult*: metaclasse aumenta a complexidade e pode causar *metaclass conflict* ao combinar com `ABC`, ORMs ou `Enum`.' },
        ],
        explanation: 'Regra prática: comece com decorator de classe ou `__init_subclass__`. Metaclasse só quando você precisa mexer **antes** ou **durante** a criação da classe (`__prepare__`, `__new__`) ou no comportamento da **classe como objeto** (`__call__`, `__iter__`, `__len__`).',
      },
      {
        type: 'open',
        id: 'dp-reg-q6',
        concept: 'Registry',
        say: 'Última: um code review de verdade. Aponte os riscos e diga como mitigar.',
        prompt: 'Você está revisando um PR que troca um dict explícito `{"csv": Csv, "pdf": Pdf}` por registro automático com `__init_subclass__` + varredura dos módulos do pacote. Que **riscos** você apontaria e como os mitigaria — inclusive nos **testes**?',
        minWords: 30,
        rubric: [
          { label: 'Depende de **import** (efeito colateral): módulo não importado = plugin sumido', keywords: ['importad', 'importar', 'importacao', 'import ', 'efeito colateral', 'side effect', 'carregad', 'pkgutil', 'descoberta'], concept: 'Descoberta de plugins', why: 'A classe só existe para o registro depois que o módulo roda; a descoberta precisa ser garantida.' },
          { label: 'Fica **implícito**: mais difícil achar de onde vem cada plugin', keywords: ['implicit', 'magic', 'magia', 'dificil de achar', 'dificil de encontrar', 'rastre', 'grep', 'legib', 'explicit', 'indirec', 'de onde vem'], concept: 'Explícito × implícito', why: 'O dict literal era "grepável"; o registro automático troca clareza por extensibilidade.' },
          { label: 'Nomes **duplicados** / colisões', keywords: ['duplic', 'colis', 'conflit', 'sobrescr', 'mesmo nome', 'repetid'], concept: 'Registry', why: 'Dois plugins com o mesmo nome e "ganha o último importado" é um bug silencioso.' },
          { label: '**Isolar** o registro global nos testes', keywords: ['isol', 'monkeypatch', 'fixture', 'vaz', 'copia do registro', 'limpar o registro', 'restaur', ['estado', 'global'], ['test', 'reset']], concept: 'Testabilidade', why: 'Classes criadas num teste continuam registradas no próximo; os testes ficam dependentes da ordem.' },
        ],
        modelAnswer: `Eu apontaria quatro riscos:

1. **Dependência de import (efeito colateral):** a subclasse só se registra quando o módulo é importado. Se a varredura falhar ou alguém criar um plugin fora do pacote, ele some sem erro. Mitigo com uma função de descoberta única (\`pkgutil.iter_modules\` + \`importlib.import_module\`) chamada na inicialização, e um teste que verifica a lista esperada de plugins.
2. **Código implícito:** o dict literal era explícito e fácil de achar com grep; agora é preciso saber do gancho para entender de onde vem cada exportador. Mitigo documentando na classe base e expondo \`disponiveis()\` para inspeção.
3. **Nomes duplicados:** dois plugins com o mesmo nome e "ganha o último importado". O gancho deve lançar erro ao detectar colisão.
4. **Testes:** o registro é estado global e **vaza** entre testes. Uso uma fixture com \`monkeypatch.setattr\` que troca o registro por uma cópia em cada teste, isolando e restaurando no fim.

Se só existem dois formatos que raramente mudam, eu questionaria se a troca vale a pena — o dict explícito é mais simples.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Registro dá o Aberto/Fechado de verdade; `__init_subclass__` automatiza sem metaclasse; entry points trazem plugins de fora.',
          'E lembre as perguntas do revisor: duplicados, descoberta, isolamento nos testes — e se a mágica se paga.',
        ],
        board: null,
      },
    ],
  });
})();
