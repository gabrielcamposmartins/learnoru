Game.registerModule('design-patterns', {
  id: 'template-method',
  title: 'Template Method',
  kind: 'lesson',
  level: 2,
  order: 34,
  unit: 'comportamentais',
  summary: 'O esqueleto do algoritmo fica na classe base e as subclasses só preenchem os passos — e quando trocar herança por composição.',
  concepts: ['Template Method', 'ABC e @abstractmethod', 'Hooks', 'Princípio de Hollywood', 'Herança × composição'],
  takeaways: [
    'Template Method fixa a **ordem dos passos** num método da classe base e deixa as subclasses preencherem só o que varia — sem duplicar o fluxo.',
    'Passos **abstratos** (`@abstractmethod`) são obrigatórios e falham cedo, na instanciação; **hooks** têm implementação padrão e são opcionais.',
    'Princípio de Hollywood: "não nos chame, nós chamamos você". A base controla o fluxo e chama as subclasses — por isso o template em si não deve ser sobrescrito.',
    'Template Method usa **herança** (fixada ao definir a classe); Strategy usa **composição** (trocável em runtime). Muitas variações combinadas pedem composição.',
  ],
  glossary: [
    { term: 'Template Method', aliases: ['método template', 'template methods'], definition: 'Padrão comportamental: um método da classe base define o esqueleto de um algoritmo e delega passos específicos a métodos que as subclasses implementam.' },
    { term: 'Hook', aliases: ['hooks', 'método gancho', 'métodos gancho'], definition: 'Ponto de extensão: método que o código-base chama num momento definido e que você pode sobrescrever para se encaixar ali (ex.: `setUp` no unittest). No Template Method, tem implementação padrão, geralmente vazia.' },
    { term: 'Princípio de Hollywood', aliases: ['Hollywood Principle', "don't call us, we'll call you"], definition: '"Não nos chame, nós chamamos você": o código de alto nível (framework, classe base) controla o fluxo e chama o seu código nos momentos certos.' },
    { term: 'Inversão de controle', aliases: ['IoC', 'inversion of control'], definition: 'Quem comanda o fluxo é um framework que chama o seu código, e não o contrário. Template Method, callbacks e injeção de dependência são formas de IoC.' },
    { term: 'Classe base frágil', aliases: ['fragile base class', 'fragile base class problem', 'classes base frágeis'], definition: 'Problema da herança: mudanças aparentemente seguras na classe base quebram subclasses que dependiam de detalhes dela (quais métodos ela chama, e em que ordem).' },
    { term: 'Call Super', aliases: ['call super smell'], definition: 'Smell descrito por Martin Fowler: a classe base exige que quem sobrescreve um método se lembre de chamar `super()`. Esquecer gera bugs silenciosos; a cura é um template method com hooks.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é o **Template Method**. Começo com dois importadores de dados que nasceram de um copia-e-cola…',
        'O fluxo é idêntico: ler, validar, salvar. Só o *parse* muda. Adivinha onde o próximo bug vai ser corrigido pela metade?',
      ],
      board: {
        title: 'O problema: o mesmo fluxo, copiado',
        code: `import json


class ImportadorCSV:
    def importar(self, texto):
        linhas = texto.strip().splitlines()[1:]             # varia
        registros = [dict(zip(("nome", "idade"), l.split(",")))
                     for l in linhas]
        validos = [r for r in registros if r.get("nome")]   # igual
        print(f"{len(validos)} registros importados")        # igual
        return validos


class ImportadorJSON:
    def importar(self, texto):
        registros = json.loads(texto)                        # varia
        validos = [r for r in registros if r.get("nome")]   # igual (copiado!)
        print(f"{len(validos)} registros importados")        # igual (copiado!)
        return validos`,
        caption: 'Quando a regra de validação mudar, alguém vai lembrar de mudar nos dois? E no terceiro formato, que chega mês que vem?',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O **Template Method** sobe o fluxo para a classe base, num método que define a **ordem dos passos**.',
        'Os passos que variam viram métodos que as subclasses implementam. Com `ABC` e `@abstractmethod`, o Python garante que ninguém esqueça um passo obrigatório.',
      ],
      board: {
        title: 'Template Method com ABC',
        md: `\`\`\`python
from abc import ABC, abstractmethod
import json


class Importador(ABC):
    def importar(self, texto):                  # ◀ o TEMPLATE METHOD
        registros = self.parse(texto)           # passo abstrato
        validos = [r for r in registros if self.valido(r)]
        self.salvar(validos)
        return validos

    @abstractmethod
    def parse(self, texto):                     # obrigatório
        ...

    def valido(self, registro):                 # passo com padrão
        return bool(registro.get("nome"))

    def salvar(self, registros):
        print(f"{len(registros)} registros importados")


class ImportadorCSV(Importador):
    def parse(self, texto):
        linhas = texto.strip().splitlines()[1:]
        return [dict(zip(("nome", "idade"), l.split(","))) for l in linhas]


class ImportadorJSON(Importador):
    def parse(self, texto):
        return json.loads(texto)
\`\`\`

\`Importador()\` → \`TypeError: Can't instantiate abstract class Importador…\` — a base existe para ser **estendida**, não usada direto.

> [!dica] Marque o template com \`@final\` (de \`typing\`): mypy e pyright acusam qualquer subclasse que tente sobrescrevê-lo. Em runtime nada muda — é um contrato para as ferramentas.`,
      },
    },
    {
      type: 'say',
      text: [
        'Nem todo passo precisa ser obrigatório. **Hooks** são métodos com implementação padrão — muitas vezes vazia — que a base chama em pontos estratégicos.',
        'A subclasse sobrescreve só se quiser se encaixar ali. E repara: ela nunca precisa chamar `super()`.',
      ],
      board: {
        title: 'Passos abstratos × hooks',
        md: `\`\`\`python
class Importador(ABC):
    def importar(self, texto):
        self.antes()                                        # hook
        registros = [self.transformar(r) for r in self.parse(texto)]
        validos = [r for r in registros if self.valido(r)]
        self.salvar(validos)
        self.depois(validos)                                # hook
        return validos

    def antes(self):                   # hooks: vazios por padrão
        pass

    def depois(self, registros):
        pass

    def transformar(self, registro):   # hook "neutro": identidade
        return registro


class ImportadorClientes(ImportadorCSV):
    def transformar(self, registro):   # só o que interessa
        return {**registro, "nome": registro["nome"].strip().title()}
\`\`\`

| Tipo de passo | Na classe base | A subclasse… |
|---|---|---|
| **Template** (o esqueleto) | implementado; não deve ser sobrescrito | não mexe |
| **Abstrato** | \`@abstractmethod\` | **precisa** implementar |
| **Hook** | implementação padrão (vazia ou neutra) | **pode** sobrescrever |

> [!sabia] Martin Fowler batizou de **Call Super** o *smell* de frameworks que dizem "ao sobrescrever \`processar()\`, lembre-se de chamar \`super().processar()\` primeiro". Esquecer é fácil e o bug é silencioso. A cura é justamente o Template Method: a base chama o hook no momento certo, e a subclasse não precisa lembrar de nada.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Esse controle invertido tem nome: **Princípio de Hollywood** — "não nos chame, nós chamamos você".',
        'Você já vive isso em Python: você não chama o `setUp()` dos seus testes, o `unittest` chama. E a biblioteca padrão tem um exemplo ainda mais esperto.',
      ],
      board: {
        title: 'Hollywood na biblioteca padrão',
        md: `| Framework | O template (na base) | Você implementa |
|---|---|---|
| \`unittest.TestCase\` | \`run()\` | \`setUp\`, \`test_*\`, \`tearDown\` |
| \`threading.Thread\` | \`start()\` | \`run()\` |
| \`socketserver.BaseRequestHandler\` | o ciclo de atendimento | \`handle()\` |
| \`html.parser.HTMLParser\` | \`feed()\` | \`handle_starttag\`, \`handle_data\`… |
| \`collections.abc.Sequence\` | \`__contains__\`, \`index\`, \`count\`… | \`__getitem__\`, \`__len__\` |

\`\`\`python
from collections.abc import Sequence

class Playlist(Sequence):
    def __init__(self, musicas):
        self._musicas = list(musicas)

    def __getitem__(self, i):      # passo abstrato 1
        return self._musicas[i]

    def __len__(self):             # passo abstrato 2
        return len(self._musicas)


p = Playlist(["a", "b", "c"])
"b" in p            # True — __contains__ veio de graça
p.index("c")        # 2    — idem
list(reversed(p))   # ['c', 'b', 'a']
\`\`\`

Os métodos prontos de \`Sequence\` são templates: eles chamam os **seus** \`__getitem__\` e \`__len__\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora a comparação que cai em entrevista: **Template Method × Strategy**.',
        'Os dois deixam uma parte do algoritmo variar. A diferença é o mecanismo: um usa **herança**, o outro **composição**.',
      ],
      board: {
        title: 'Herança × composição',
        md: `\`\`\`python
class Importador:                      # versão Strategy: sem herança
    def __init__(self, parse, valido=lambda r: bool(r.get("nome"))):
        self.parse = parse             # estratégias injetadas
        self.valido = valido

    def importar(self, texto):
        return [r for r in self.parse(texto) if self.valido(r)]


json_import = Importador(parse=json.loads)
csv_rigoroso = Importador(parse=ler_csv, valido=tem_nome_e_idade)
\`\`\`

| | Template Method | Strategy |
|---|---|---|
| Mecanismo | **herança** | **composição** |
| Quando a variação é escolhida | ao definir a subclasse | em tempo de execução |
| Granularidade | passos de **um** algoritmo | o algoritmo inteiro (ou uma peça) |
| Risco | classe base frágil, explosão de subclasses | mais peças para montar |

Com 3 formatos × 2 validações × 2 destinos, a herança pede até **12 subclasses**; a composição, **7 peças** (3 + 2 + 2) combináveis.

> [!atencao] **Classe base frágil:** subclasses dependem de detalhes da base (quais métodos ela chama, e em que ordem). Uma mudança "inofensiva" na base pode quebrar todas elas. Mantenha o template pequeno e documente os hooks como contrato.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'ABC, fluxo de controle, um exportador e a escolha entre herança e composição.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-tpl-q1',
      concept: 'ABC e @abstractmethod',
      say: 'Primeira: um erro de digitação e uma classe abstrata. Quando o Python reclama?',
      prompt: `Em que momento este código falha?

\`\`\`python
from abc import ABC, abstractmethod

class Relatorio(ABC):
    def gerar(self):
        return self.cabecalho() + self.corpo()

    def cabecalho(self):
        return "== Relatório ==\\n"

    @abstractmethod
    def corpo(self): ...


class RelatorioVendas(Relatorio):      # linha A
    def copro(self):                   # erro de digitação!
        return "vendas: 42"


r = RelatorioVendas()                  # linha B
print(r.gerar())                       # linha C
\`\`\``,
      options: [
        { text: 'Na linha A: o Python recusa definir a subclasse sem `corpo`.', why: 'Definir a classe funciona. O ABC só confere os métodos abstratos na hora de **instanciar**.' },
        { text: 'Na linha B: `TypeError` ao instanciar, porque `corpo` continua abstrato.', correct: true, why: 'O ABC guarda os métodos abstratos pendentes em `__abstractmethods__`; como `copro` não substitui `corpo`, a instanciação falha com `TypeError`.' },
        { text: 'Na linha C: `AttributeError`, porque `corpo` não existe.', why: '`corpo` existe (herdado e abstrato) — e a execução nem chega aqui, porque a linha B já falha.' },
        { text: 'Não falha: `corpo()` herdado devolve `None` e só o cabeçalho é impresso.', why: 'Com `@abstractmethod`, a instância nem é criada. (E, sem o ABC, somar `str + None` também quebraria.)' },
      ],
      explanation: 'Esse é o grande ganho de `ABC` + `@abstractmethod` no Template Method: um passo obrigatório esquecido — ou digitado errado — falha **cedo**, ao criar o objeto, e não no meio do algoritmo, em produção. A checagem é na instanciação, não na definição da classe; ferramentas como mypy e pyright pegam o problema ainda antes.',
    },
    {
      type: 'order',
      id: 'dp-tpl-q2',
      concept: 'Princípio de Hollywood',
      say: 'Agora siga o fluxo de controle: quem chama quem?',
      prompt: `Coloque as linhas na ordem em que são **impressas** por \`Meu().rodar()\`:

\`\`\`python
from abc import ABC, abstractmethod

class Pipeline(ABC):
    def rodar(self):
        self.antes()
        for item in self.itens():
            print("processa", item)
        self.depois()

    def antes(self):
        print("antes (base)")

    def depois(self):
        pass

    @abstractmethod
    def itens(self): ...


class Meu(Pipeline):
    def antes(self):
        super().antes()
        print("antes (meu)")

    def itens(self):
        print("carregando itens")
        return ["a", "b"]

    def depois(self):
        print("fim")
\`\`\``,
      items: ['`antes (base)`', '`antes (meu)`', '`carregando itens`', '`processa a`', '`processa b`', '`fim`'],
      explanation: 'Quem manda é o **template** `rodar()`: ele chama o hook `antes()` (que, na subclasse, reaproveita a base com `super()`), depois o passo abstrato `itens()` — uma única vez, quando o `for` começa — e por fim o hook `depois()`, que na base não fazia nada. A subclasse nunca decide a **ordem**; só preenche os passos. É o Princípio de Hollywood em ação.',
    },
    {
      type: 'code',
      id: 'dp-tpl-q3',
      concept: 'Template Method',
      title: 'Exportador de relatórios (CSV e Markdown)',
      say: 'Hora de codar! Um esqueleto, dois formatos — e hooks para quem quiser personalizar.',
      prompt: `Implemente o **Template Method** \`Exportador.exportar(registros)\`, em que \`registros\` é uma lista de dicionários com as mesmas chaves (ex.: \`{"produto": "café", "qtd": 2}\`):

1. Lista vazia → retorna \`""\`.
2. \`colunas\` são as chaves do **primeiro** dicionário, em ordem.
3. As partes são, nesta ordem: \`self.cabecalho(colunas)\` (**abstrato**); \`self.linha(valores)\` (**abstrato**) para cada registro aceito pelo hook \`self.incluir(registro)\` — padrão: aceita todos —, com \`valores\` na **ordem de \`colunas\`**; e o hook \`self.rodape(total)\`, em que \`total\` é o número de linhas incluídas — padrão: \`None\` (sem rodapé).
4. Retorna as partes que **não são \`None\`**, unidas por \`"\\n"\`.
5. \`Exportador\` é uma \`ABC\`: instanciá-lo — ou uma subclasse sem os passos abstratos — lança \`TypeError\`.

Depois, crie as subclasses:

- \`ExportadorCSV\`: cabeçalho \`"produto,qtd"\`, linhas \`"café,2"\` (valores com \`str\`, separados por vírgula), sem rodapé.
- \`ExportadorMarkdown\`: cabeçalho em duas linhas (títulos e um \`---\` por coluna), linhas em formato de tabela e rodapé \`"Total: N"\`:

\`\`\`python
dados = [{"produto": "café", "qtd": 2}, {"produto": "pão", "qtd": 10}]
print(ExportadorMarkdown().exportar(dados))
# | produto | qtd |
# |---|---|
# | café | 2 |
# | pão | 10 |
# Total: 2
\`\`\``,
      starter: `from abc import ABC, abstractmethod


class Exportador(ABC):
    def exportar(self, registros):
        # TODO: o esqueleto do algoritmo (o template method)
        pass

    # TODO: passos abstratos cabecalho(colunas) e linha(valores)

    def incluir(self, registro):
        return True

    def rodape(self, total):
        return None


class ExportadorCSV(Exportador):
    pass


class ExportadorMarkdown(Exportador):
    pass
`,
      tests: [
        {
          name: 'CSV',
          expr: 'ExportadorCSV().exportar([{"produto": "café", "qtd": 2}, {"produto": "pão", "qtd": 10}])',
          expected: '"produto,qtd\\ncafé,2\\npão,10"',
        },
        {
          name: 'Markdown com rodapé',
          expr: 'ExportadorMarkdown().exportar([{"produto": "café", "qtd": 2}, {"produto": "pão", "qtd": 10}])',
          expected: '"| produto | qtd |\\n|---|---|\\n| café | 2 |\\n| pão | 10 |\\nTotal: 2"',
        },
        { name: 'lista vazia', expr: 'ExportadorCSV().exportar([])', expected: '""' },
        {
          name: 'Exportador é abstrato',
          code: `try:
    Exportador()
except TypeError:
    pass
else:
    raise AssertionError("Exportador() deveria lançar TypeError (use ABC + @abstractmethod)")`,
        },
        {
          name: 'hook incluir numa subclasse',
          code: `class SoComEstoque(ExportadorMarkdown):
    def incluir(self, registro):
        return registro["qtd"] > 0
dados = [{"produto": "café", "qtd": 0}, {"produto": "pão", "qtd": 3}]
saida = SoComEstoque().exportar(dados)
assert saida == "| produto | qtd |\\n|---|---|\\n| pão | 3 |\\nTotal: 1", repr(saida)`,
        },
        {
          name: 'subclasse incompleta não instancia',
          hidden: true,
          code: `class Incompleto(Exportador):
    def cabecalho(self, colunas):
        return "x"
try:
    Incompleto()
except TypeError:
    pass
else:
    raise AssertionError("uma subclasse sem linha() não deveria ser instanciável")`,
        },
        {
          name: 'valores na ordem das colunas',
          hidden: true,
          expr: 'ExportadorCSV().exportar([{"b": 1, "a": 2}, {"a": 4, "b": 3}])',
          expected: '"b,a\\n1,2\\n3,4"',
        },
        {
          name: 'tudo filtrado, com rodapé personalizado',
          hidden: true,
          code: `class Nada(ExportadorCSV):
    def incluir(self, registro):
        return False
    def rodape(self, total):
        return f"# {total} linhas"
saida = Nada().exportar([{"a": 1}])
assert saida == "a\\n# 0 linhas", repr(saida)`,
        },
        {
          name: 'rodapé "" não é None',
          hidden: true,
          code: `class RodapeVazio(ExportadorCSV):
    def rodape(self, total):
        return ""
saida = RodapeVazio().exportar([{"a": 1}])
assert saida == "a\\n1\\n", f"{saida!r} — descarte só as partes que são None"`,
        },
        { name: 'valores convertidos com str', hidden: true, expr: 'ExportadorCSV().exportar([{"x": None, "y": 1.5}])', expected: '"x,y\\nNone,1.5"' },
        { name: 'Markdown com uma coluna', hidden: true, expr: 'ExportadorMarkdown().exportar([{"x": 1}])', expected: '"| x |\\n|---|\\n| 1 |\\nTotal: 1"' },
      ],
      reviews: [
        {
          when: m => m.classes.some(c => c.name !== 'Exportador' && c.methods.includes('exportar')),
          text: 'Uma subclasse sobrescreveu `exportar` — o próprio template method. Isso duplica o esqueleto e quebra o Princípio de Hollywood: sobrescreva só os **passos** (`cabecalho`, `linha`, hooks).',
          concept: 'Template Method',
        },
        {
          when: (m, code) => m.calls.includes('isinstance') || /type\(\s*self\s*\)\s*(==|is)/.test(code),
          text: 'A classe base pergunta qual é a subclasse (`isinstance`/`type(self)`) para decidir o formato. O Template Method existe para evitar isso: o que varia fica nos métodos sobrescritos, não num `if` na base.',
          concept: 'Polimorfismo',
        },
        {
          when: m => !m.imports.includes('abc'),
          text: 'Você não usou o módulo `abc`. Com `ABC` + `@abstractmethod`, o Python impede instanciar a base (ou uma subclasse incompleta) sem nenhuma checagem manual.',
          concept: 'ABC e @abstractmethod',
        },
      ],
      hints: [
        'Declare os passos obrigatórios na base com `@abstractmethod`: `def cabecalho(self, colunas): ...` e `def linha(self, valores): ...`.',
        'No `exportar`: trate a lista vazia, pegue `colunas = list(registros[0])`, comece `partes = [self.cabecalho(colunas)]`, acrescente `self.linha([r[c] for c in colunas])` para cada registro aceito por `self.incluir(r)` e, no fim, `self.rodape(total)`.',
        'Para juntar: `"\\n".join(p for p in partes if p is not None)`. No Markdown, o separador pode ser `"|" + "|".join("---" for _ in colunas) + "|"`.',
      ],
      solution: `from abc import ABC, abstractmethod
from typing import final


class Exportador(ABC):
    @final
    def exportar(self, registros):
        if not registros:
            return ""
        colunas = list(registros[0])
        partes = [self.cabecalho(colunas)]
        total = 0
        for registro in registros:
            if self.incluir(registro):
                partes.append(self.linha([registro[c] for c in colunas]))
                total += 1
        partes.append(self.rodape(total))
        return "\\n".join(p for p in partes if p is not None)

    @abstractmethod
    def cabecalho(self, colunas):
        ...

    @abstractmethod
    def linha(self, valores):
        ...

    def incluir(self, registro):
        return True

    def rodape(self, total):
        return None


class ExportadorCSV(Exportador):
    def cabecalho(self, colunas):
        return ",".join(colunas)

    def linha(self, valores):
        return ",".join(str(v) for v in valores)


class ExportadorMarkdown(Exportador):
    def cabecalho(self, colunas):
        titulos = "| " + " | ".join(colunas) + " |"
        separador = "|" + "|".join("---" for _ in colunas) + "|"
        return titulos + "\\n" + separador

    def linha(self, valores):
        return "| " + " | ".join(str(v) for v in valores) + " |"

    def rodape(self, total):
        return f"Total: {total}"
`,
      solutionExplanation: 'O `exportar` é o **template**: decide a ordem (cabeçalho → linhas aceitas → rodapé) e nunca muda. Os passos obrigatórios são `@abstractmethod` — por isso `Exportador()` e subclasses incompletas falham já na instanciação — e os hooks `incluir`/`rodape` têm padrões neutros, então o CSV nem precisa mencioná-los. Os valores seguem a ordem de `colunas` (e não a de cada dicionário), e o filtro usa `is not None` para não descartar um rodapé vazio de propósito. O `@final` documenta, para mypy e pyright, que o template não deve ser sobrescrito.',
    },
    {
      type: 'open',
      id: 'dp-tpl-q4',
      concept: 'Herança × composição',
      say: 'Última: uma discussão de design que aparece muito em code review.',
      prompt: 'Um colega quer suportar **3 formatos** de entrada (CSV, JSON, XML), **2 regras de validação** (simples e rigorosa) e **2 destinos** (banco e arquivo) criando uma subclasse de `Importador` para cada combinação. O que você sugeriria, e por quê? Em que caso o Template Method ainda é uma boa escolha?',
      minWords: 25,
      rubric: [
        { label: 'Aponta a **explosão de subclasses** (3 × 2 × 2 = 12)', keywords: ['explos', 'combinac', '12', 'doze', 'multiplic', 'subclasses demais', 'muitas subclasses', 'produto cartesiano'], concept: 'Herança × composição', why: 'Cada dimensão nova multiplica o número de subclasses; o código de cada peça acaba duplicado entre elas.' },
        { label: 'Propõe **composição / Strategy**: injetar formato, validação e destino', keywords: ['composic', 'compor', 'strategy', 'estrategia', 'injet', 'injecao', 'passar como parametro', 'no construtor', 'objetos separados', 'pecas'], concept: 'Strategy', why: 'Com composição, cada dimensão vira uma peça independente e as combinações são montadas, não herdadas.' },
        { label: 'Cita um ganho: **troca em runtime**, teste isolado, reuso ou menos acoplamento', keywords: ['runtime', 'tempo de execucao', 'isolad', 'test', 'reuso', 'reutiliz', 'acopla', 'independ', 'combinaveis', 'combinar livremente'], concept: 'Testabilidade', why: 'Peças pequenas são testadas sozinhas, reaproveitadas e trocadas por configuração.' },
        { label: 'Reconhece quando o **Template Method** serve (esqueleto fixo, pouca variação) ou os riscos da **herança**', keywords: ['esqueleto', 'fluxo fixo', 'ordem fixa', 'pouca variac', 'poucas variac', 'uma dimensao', 'fragil', 'heranca', 'hibrid', 'framework'], concept: 'Template Method', why: 'Herança funciona bem quando o fluxo é estável e a variação é pequena; com muitas dimensões, a base vira um ponto frágil.' },
      ],
      modelAnswer: `Criar uma subclasse por combinação gera uma **explosão de subclasses**: 3 × 2 × 2 = 12 classes hoje, e cada formato ou destino novo multiplica o total. Além disso, a herança amarra tudo à classe base — o problema da **classe base frágil**.

Eu usaria **composição (Strategy)**: um \`Importador\` que recebe no construtor três peças injetadas — o parser, o validador e o destino. São 3 + 2 + 2 = 7 peças, **combináveis** livremente, cada uma **testada isoladamente** e trocável em tempo de execução (por configuração, por exemplo).

O Template Method ainda é uma boa escolha quando o **esqueleto é fixo** e há poucas variações numa única dimensão — como um framework que define o fluxo e deixa a subclasse preencher um ou dois passos. Dá até para combinar: um template que fixa a ordem e chama estratégias injetadas.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Template Method = **esqueleto na base, passos nas subclasses** — e é a base quem chama.',
        'Abstratos obrigam, hooks oferecem; e quando as variações se multiplicam, troque herança por **composição**. Próximo: Iterator!',
      ],
      board: null,
    },
  ],
});
