Game.registerModule('design-patterns', {
  id: 'factory',
  title: 'Factory',
  kind: 'lesson',
  level: 1,
  order: 11,
  unit: 'criacionais',
  summary: 'Simple Factory, Factory Method, construtores alternativos com @classmethod e Abstract Factory.',
  concepts: ['Factory Method', 'Registro com dict', '@classmethod', 'Aberto/Fechado'],
  takeaways: [
    'Uma factory **isola a criação**: o cliente pede o que precisa e não depende de classes concretas.',
    'Em Python, classes são objetos: um **dicionário de registro** vira uma Simple Factory aberta a novos tipos sem editar a fábrica (Aberto/Fechado).',
    'No **Factory Method**, a base define o algoritmo e um método de criação; as subclasses decidem o que criar.',
    'Construtores alternativos usam `@classmethod` e `cls(...)` para respeitar subclasses — como `dict.fromkeys` e `datetime.fromisoformat`.',
    'O **Abstract Factory** cria **famílias** de objetos que precisam combinar entre si, como os componentes de um mesmo tema.',
  ],
  glossary: [
    { term: 'Factory Method', aliases: ['Virtual Constructor', 'construtor virtual', 'construtores virtuais'], definition: 'Padrão criacional do GoF (também chamado de *Virtual Constructor*): a classe base declara um método de criação e as **subclasses** o sobrescrevem para decidir qual classe concreta instanciar.' },
    { term: 'Simple Factory', aliases: ['fábrica simples', 'simple factories'], definition: 'Função (ou método) que centraliza a escolha da classe concreta a partir de um valor — em Python, em geral um `dict` nome → classe. Não está no livro do GoF: é um idioma.' },
    { term: 'Abstract Factory', aliases: ['fábrica abstrata', 'fábricas abstratas'], definition: 'Padrão criacional do GoF (também chamado de *Kit*): um objeto com vários métodos de criação que produzem uma **família** de objetos compatíveis entre si, como os componentes de um tema.' },
    { term: 'Construtor alternativo', aliases: ['construtores alternativos', 'alternative constructor'], definition: 'Método de classe (`@classmethod`) que cria instâncias a partir de outro formato de entrada, como `dict.fromkeys` ou `datetime.fromisoformat`. Usa `cls(...)` para respeitar subclasses.' },
    { term: 'default_factory', aliases: ['default factory'], definition: 'Parâmetro de `collections.defaultdict` e de `dataclasses.field`: um callable sem argumentos chamado para **criar** um valor novo quando preciso — uma fábrica dentro da stdlib.' },
    { term: 'Princípio Aberto/Fechado', aliases: ['Aberto/Fechado', 'Open/Closed', 'OCP'], definition: 'O "O" do SOLID (Bertrand Meyer, 1988): módulos devem ser **abertos para extensão** e **fechados para modificação** — comportamento novo entra por código novo, sem editar o que já funciona.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é dia de **Factory** — a família de padrões que cuida de **criar objetos** sem espalhar `if`s pelo código.',
        'Olha esse código. Sabe qual é o problema dele?',
      ],
      board: {
        title: 'O problema: criação espalhada',
        code: `def exportar(relatorio, formato):
    if formato == "pdf":
        exportador = ExportadorPDF()
    elif formato == "csv":
        exportador = ExportadorCSV()
    elif formato == "html":
        exportador = ExportadorHTML()
    else:
        raise ValueError(formato)
    return exportador.exportar(relatorio)

# ...e o MESMO if/elif aparece em outros 5 lugares 😩`,
        caption: 'Cada novo formato exige caçar e editar todos os if/elif.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O código cliente está decidindo **qual classe concreta** instanciar. Isso é acoplamento com a implementação.',
        'A **Simple Factory** centraliza essa decisão num único lugar. E em Python, o jeito mais elegante é um **dicionário de registro**.',
      ],
      board: {
        title: 'Simple Factory com registro (dict)',
        code: `EXPORTADORES = {
    "pdf": ExportadorPDF,
    "csv": ExportadorCSV,
    "html": ExportadorHTML,
}

def criar_exportador(formato):
    try:
        classe = EXPORTADORES[formato.lower()]
    except KeyError:
        raise ValueError(f"Formato desconhecido: {formato}") from None
    return classe()


# Novo formato? Só registrar — a fábrica não muda.
EXPORTADORES["xlsx"] = ExportadorXLSX`,
        caption: 'Classes são objetos em Python: dá para guardá-las num dict e chamá-las depois.',
      },
    },
    {
      type: 'say',
      text: [
        'Esse registro respeita o **Princípio Aberto/Fechado**: o sistema fica aberto para novos formatos e fechado para modificação da fábrica.',
        'Dá até para registrar automaticamente com um decorator. Olha que bonito:',
      ],
      board: {
        title: 'Registro automático com decorator',
        code: `EXPORTADORES = {}

def registrar(nome):
    def decorador(classe):
        EXPORTADORES[nome] = classe
        return classe
    return decorador


@registrar("csv")
class ExportadorCSV:
    def exportar(self, dados):
        return ",".join(map(str, dados))`,
      },
    },
    {
      type: 'say',
      text: [
        'Já o **Factory Method** do GoF é um pouco diferente: uma classe base define um método de criação, e as **subclasses decidem** o que criar.',
      ],
      board: {
        title: 'Factory Method (GoF)',
        code: `from abc import ABC, abstractmethod

class Logistica(ABC):
    @abstractmethod
    def criar_transporte(self):          # ← o factory method
        ...

    def planejar_entrega(self, carga):
        transporte = self.criar_transporte()
        return transporte.entregar(carga)   # lógica comum


class LogisticaRodoviaria(Logistica):
    def criar_transporte(self):
        return Caminhao()


class LogisticaMaritima(Logistica):
    def criar_transporte(self):
        return Navio()`,
        caption: 'A lógica de negócio fica na base; só a criação varia nas subclasses.',
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Um caso muito pythônico de factory é o **construtor alternativo** com `@classmethod`. Você já usou: `dict.fromkeys`, `datetime.fromisoformat`…',
        'Por que `@classmethod` e não `@staticmethod`? Porque ele recebe `cls` — então uma **subclasse** que chama o método recebe uma instância dela mesma.',
      ],
      board: {
        title: 'Construtores alternativos com @classmethod',
        code: `class Usuario:
    def __init__(self, nome, email):
        self.nome = nome
        self.email = email

    @classmethod
    def de_dict(cls, dados):
        return cls(dados["nome"], dados["email"])

    @classmethod
    def de_csv(cls, linha):
        nome, email = linha.split(";")
        return cls(nome.strip(), email.strip())


class Admin(Usuario):
    pass

a = Admin.de_csv("Ana; ana@x.com")
print(type(a).__name__)   # Admin — graças ao cls`,
      },
    },
    {
      type: 'say',
      text: [
        'Por fim, o **Abstract Factory**: uma fábrica que cria **famílias** de objetos relacionados que precisam combinar entre si.',
      ],
      board: {
        title: 'Abstract Factory (em resumo)',
        md: `Exemplo: temas de interface. Botão e janela precisam ser **do mesmo tema**.

\`\`\`python
class TemaEscuro:
    def criar_botao(self):  return BotaoEscuro()
    def criar_janela(self): return JanelaEscura()

class TemaClaro:
    def criar_botao(self):  return BotaoClaro()
    def criar_janela(self): return JanelaClara()

def montar_tela(fabrica):          # não sabe qual tema é
    return fabrica.criar_janela(), fabrica.criar_botao()
\`\`\`

| Variante | Quando usar |
|---|---|
| **Simple Factory** (função + dict) | Escolher uma classe a partir de um valor (string, config) |
| **Factory Method** | Subclasses decidem o que criar dentro de um algoritmo comum |
| **@classmethod** | Formas alternativas de construir o mesmo objeto |
| **Abstract Factory** | Famílias de objetos que precisam ser consistentes |`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Sabia que você usa fábricas o tempo todo sem perceber? A biblioteca padrão está cheia delas.',
        'E uma delas faz algo que parece mágica: você chama uma classe e recebe **outra**.',
      ],
      board: {
        title: 'Fábricas escondidas na stdlib',
        md: `\`\`\`python
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

grupos = defaultdict(list)       # o parâmetro se chama default_factory!
grupos["a"].append(1)            # list() é chamada para criar o valor que faltava

@dataclass
class Pedido:
    itens: list = field(default_factory=list)   # uma lista NOVA por pedido

p = Path("dados.csv")
print(type(p).__name__)          # 'WindowsPath' ou 'PosixPath', conforme o sistema
\`\`\`

- \`defaultdict\` e \`field\` recebem uma **fábrica** (qualquer callable sem argumentos), não um valor pronto — por isso cada pedido ganha a própria lista.
- \`Path(...)\` funciona como um **construtor virtual**: quem escolhe a subclasse concreta é o \`__new__\`, em tempo de execução.

> [!sabia] O livro do GoF lista **Virtual Constructor** como outro nome do Factory Method — e **Kit** como outro nome do Abstract Factory. Em Python, o \`__new__\` pode devolver uma instância de uma **subclasse**: é exatamente o que \`pathlib.Path\` faz, e é por isso que \`Path("x")\` nunca é um \`Path\` "puro".`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Fábricas, registros e construtores alternativos.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-factory-q1',
      concept: 'Aberto/Fechado',
      say: 'Qual a principal vantagem de trocar o if/elif pelo dicionário de registro?',
      prompt: 'Qual é a principal vantagem de uma fábrica baseada em **dicionário de registro** em vez de uma cadeia de `if/elif`?',
      options: [
        { text: 'O código fica mais rápido porque dicionários são O(1).', why: 'É verdade que a busca é O(1), mas com meia dúzia de tipos a diferença é irrelevante. Não é a motivação do padrão.' },
        { text: 'Novos tipos podem ser adicionados sem modificar a função fábrica (Aberto/Fechado).', correct: true, why: 'Basta registrar a nova classe; a fábrica e os clientes não mudam.' },
        { text: 'Elimina a necessidade de tratar tipos desconhecidos.', why: 'Tipos desconhecidos continuam existindo — a fábrica deve lançar um erro claro (ex.: `ValueError`).' },
        { text: 'Garante que só exista uma instância de cada classe.', why: 'Isso seria o Singleton; a fábrica cria uma nova instância a cada chamada.' },
      ],
      explanation: 'O registro deixa a fábrica **aberta para extensão e fechada para modificação**: um novo tipo é só uma nova entrada no dicionário.',
    },
    {
      type: 'mcq',
      id: 'dp-factory-q2',
      concept: '@classmethod',
      say: 'Agora um detalhe de Python que cai em entrevista…',
      prompt: `O que este código imprime?

\`\`\`python
class Forma:
    @staticmethod
    def criar():
        return Forma()

class Quadrado(Forma):
    pass

print(type(Quadrado.criar()).__name__)
\`\`\``,
      options: [
        { text: '`Quadrado`', why: 'O `@staticmethod` não recebe `cls`; ele sempre executa `Forma()`, mesmo chamado pela subclasse.' },
        { text: '`Forma`', correct: true, why: 'Como o método instancia `Forma` explicitamente, a subclasse é ignorada.' },
        { text: '`TypeError`', why: 'Métodos estáticos podem ser chamados pela classe ou subclasse sem erro.' },
        { text: '`NoneType`', why: 'O método retorna uma instância de `Forma`, não `None`.' },
      ],
      explanation: 'Com `@classmethod def criar(cls): return cls()`, `Quadrado.criar()` devolveria um `Quadrado`. É por isso que construtores alternativos usam **`@classmethod`**: eles respeitam a herança.',
    },
    {
      type: 'match',
      id: 'dp-rx-factory-q6',
      concept: 'Variantes de Factory',
      say: 'Rapidinha: cada situação pede uma variante diferente de fábrica. Associe!',
      prompt: 'Associe cada **situação** à variante de fábrica que a resolve.',
      pairs: [
        { left: 'Criar o exportador a partir da string `"pdf"` lida da configuração', right: 'Simple Factory com `dict` de registro' },
        { left: '`Usuario.de_csv(linha)` e `Usuario.de_dict(dados)`', right: 'Construtor alternativo com `@classmethod`' },
        { left: 'Botão e janela precisam ser do mesmo tema', right: 'Abstract Factory' },
        { left: 'A base `Logistica` planeja a entrega; cada subclasse escolhe o transporte', right: 'Factory Method' },
        { left: 'Cada `Pedido` precisa da **própria** lista de itens', right: '`field(default_factory=list)`' },
      ],
      explanation: 'O fio condutor é **isolar a criação**, mas a pergunta muda: *qual classe*, a partir de um valor (Simple Factory); *de que formato*, para a mesma classe (`@classmethod`); *qual família* coerente (Abstract Factory); *qual peça* dentro de um algoritmo comum (Factory Method); e *quando* criar um valor novo (`default_factory`, que evita o objeto mutável compartilhado entre instâncias).',
    },
    {
      type: 'code',
      id: 'dp-factory-q3',
      concept: 'Registro com dict',
      title: 'Fábrica de formas',
      say: 'Mão na massa: monte uma fábrica com **registro**. Um teste oculto vai registrar uma forma nova — seu código precisa aguentar!',
      prompt: `As classes \`Circulo(raio)\` e \`Retangulo(largura, altura)\` já existem, cada uma com \`area()\`.

1. Preencha o dicionário \`FORMAS\` mapeando \`"circulo"\` e \`"retangulo"\` para as classes.
2. Implemente \`criar_forma(tipo, **params)\`:
   - procura o tipo no \`FORMAS\` **ignorando maiúsculas/minúsculas**;
   - retorna uma instância criada com os \`params\`;
   - se o tipo não existir, lança \`ValueError\` com o nome do tipo na mensagem.

Novos tipos adicionados ao \`FORMAS\` depois devem funcionar **sem mudar** \`criar_forma\`.`,
      starter: `import math


class Circulo:
    def __init__(self, raio):
        self.raio = raio

    def area(self):
        return math.pi * self.raio ** 2


class Retangulo:
    def __init__(self, largura, altura):
        self.largura = largura
        self.altura = altura

    def area(self):
        return self.largura * self.altura


FORMAS = {}


def criar_forma(tipo, **params):
    pass
`,
      tests: [
        { name: 'círculo de raio 1', expr: 'round(criar_forma("circulo", raio=1).area(), 2)', expected: '3.14' },
        { name: 'retângulo 2×3', expr: 'criar_forma("retangulo", largura=2, altura=3).area()', expected: '6' },
        { name: 'ignora maiúsculas', expr: 'type(criar_forma("CIRCULO", raio=2)).__name__', expected: '"Circulo"' },
        { name: 'tipo desconhecido → ValueError', code: 'try:\n    criar_forma("hexagono")\nexcept ValueError as e:\n    assert "hexagono" in str(e), "a mensagem deve conter o tipo"\nelse:\n    raise AssertionError("tipo desconhecido deveria lançar ValueError")' },
        { name: 'nova forma registrada depois', hidden: true, code: 'class Triangulo:\n    def __init__(self, base, altura):\n        self.base, self.altura = base, altura\n    def area(self):\n        return self.base * self.altura / 2\n\nFORMAS["triangulo"] = Triangulo\nassert criar_forma("triangulo", base=4, altura=3).area() == 6' },
      ],
      reviews: [
        {
          when: (m, code) => /\belif\b/.test(code) || /==\s*["'](circulo|retangulo)["']/i.test(code),
          text: 'Sua fábrica compara o tipo com `if/elif`. Cada forma nova exige editar a função — use o dicionário `FORMAS` como fonte única (Aberto/Fechado).',
          concept: 'Aberto/Fechado',
        },
        {
          when: m => m.calls.includes('eval') || m.calls.includes('globals'),
          text: 'Você usou `eval`/`globals()` para achar a classe pelo nome. Isso permite instanciar **qualquer coisa** a partir de uma string externa — um risco de segurança. Um registro explícito é mais seguro.',
          concept: 'Registro com dict',
        },
      ],
      hints: [
        'O dicionário guarda as **classes** (sem parênteses): `FORMAS = {"circulo": Circulo, "retangulo": Retangulo}`.',
        'Busque com `FORMAS.get(tipo.lower())`; se vier `None`, lance `ValueError(f"Forma desconhecida: {tipo}")`.',
        'Para criar a instância, desempacote os parâmetros: `return classe(**params)`.',
      ],
      solution: `import math


class Circulo:
    def __init__(self, raio):
        self.raio = raio

    def area(self):
        return math.pi * self.raio ** 2


class Retangulo:
    def __init__(self, largura, altura):
        self.largura = largura
        self.altura = altura

    def area(self):
        return self.largura * self.altura


FORMAS = {
    "circulo": Circulo,
    "retangulo": Retangulo,
}


def criar_forma(tipo, **params):
    classe = FORMAS.get(tipo.lower())
    if classe is None:
        raise ValueError(f"Forma desconhecida: {tipo}")
    return classe(**params)
`,
      solutionExplanation: 'A fábrica consulta o registro **no momento da chamada**, então qualquer classe adicionada ao `FORMAS` passa a funcionar sem alterar `criar_forma`. O `**params` repassa os argumentos nomeados para o construtor certo, e o `ValueError` dá uma mensagem clara para tipos inválidos.',
    },
    {
      type: 'code',
      id: 'dp-factory-q4',
      concept: '@classmethod',
      title: 'Construtor alternativo',
      say: 'Mais uma, curtinha: um construtor alternativo que respeita subclasses.',
      prompt: `A classe \`Data(dia, mes, ano)\` guarda três inteiros nos atributos \`dia\`, \`mes\` e \`ano\`.

Crie o construtor alternativo \`Data.de_texto(texto)\`, que recebe \`"AAAA-MM-DD"\` (ex.: \`"2024-03-15"\`) e devolve uma instância.

Ele deve funcionar também em **subclasses**: \`DataBR.de_texto(...)\` precisa devolver um \`DataBR\`.`,
      starter: `class Data:
    def __init__(self, dia, mes, ano):
        self.dia = dia
        self.mes = mes
        self.ano = ano

    # TODO: de_texto(texto) -> Data
`,
      tests: [
        { name: 'converte o texto', code: 'd = Data.de_texto("2024-03-15")\nassert (d.dia, d.mes, d.ano) == (15, 3, 2024), f"obtido {(d.dia, d.mes, d.ano)}"' },
        { name: 'atributos são inteiros', code: 'd = Data.de_texto("1999-12-01")\nassert all(isinstance(x, int) for x in (d.dia, d.mes, d.ano)), "converta as partes com int()"' },
        { name: 'retorna uma Data', expr: 'type(Data.de_texto("2000-01-01")).__name__', expected: '"Data"' },
        { name: 'subclasse recebe a própria classe', hidden: true, code: 'class DataBR(Data):\n    pass\n\nassert type(DataBR.de_texto("2024-01-02")) is DataBR, "use cls() para respeitar subclasses"' },
      ],
      reviews: [
        {
          when: m => m.decorators.includes('staticmethod'),
          text: 'Com `@staticmethod` o método não recebe `cls` e acaba fixando a classe `Data`. Construtores alternativos devem usar `@classmethod` e `cls(...)`.',
          concept: '@classmethod',
        },
      ],
      hints: [
        'Declare com `@classmethod` e receba `cls` como primeiro parâmetro.',
        '`ano, mes, dia = map(int, texto.split("-"))` e depois `return cls(dia, mes, ano)`.',
      ],
      solution: `class Data:
    def __init__(self, dia, mes, ano):
        self.dia = dia
        self.mes = mes
        self.ano = ano

    @classmethod
    def de_texto(cls, texto):
        ano, mes, dia = map(int, texto.split("-"))
        return cls(dia, mes, ano)
`,
      solutionExplanation: 'O `@classmethod` recebe a classe pela qual foi chamado. Ao usar `cls(dia, mes, ano)` em vez de `Data(...)`, `DataBR.de_texto` cria um `DataBR` automaticamente.',
    },
    {
      type: 'open',
      id: 'dp-factory-q5',
      concept: 'Factory Method',
      say: 'Para fechar: me explica quando você usaria uma factory.',
      prompt: 'Em que situações você usaria uma **Factory** (simples ou Factory Method)? Que benefício ela traz para o código cliente?',
      minWords: 12,
      rubric: [
        { label: 'Desacopla o cliente das **classes concretas**', keywords: ['concret', 'desacopl', 'acopla', 'nao precisa saber', 'nao conhece', 'abstrai'], concept: 'Acoplamento', why: 'O cliente depende da interface, não de qual classe foi instanciada.' },
        { label: 'Centraliza a **lógica de criação** num único lugar', keywords: ['centraliz', 'unico lugar', 'um lugar', 'logica de criacao', 'encapsula a criacao', 'encapsular a criacao'], concept: 'Encapsulamento da criação', why: 'Evita o mesmo if/elif espalhado pelo código.' },
        { label: 'Quando o tipo é decidido **em tempo de execução** (config, entrada do usuário)', keywords: ['execucao', 'runtime', 'config', 'entrada', 'usuario', 'string', 'parametro'], concept: 'Factory Method', why: 'É o caso clássico: o tipo vem de um valor que só se conhece em runtime.' },
        { label: 'Facilita **adicionar novos tipos** (Aberto/Fechado)', keywords: ['novos tipos', 'novo tipo', 'adicionar', 'extens', 'aberto', 'fechado', 'registr'], concept: 'Aberto/Fechado', why: 'Novos tipos entram sem alterar os clientes.' },
      ],
      modelAnswer: `Uso uma factory quando **o tipo do objeto só é conhecido em tempo de execução** — por exemplo, a partir de uma configuração, de uma string vinda do usuário ou de um formato de arquivo.

Ela **centraliza a lógica de criação** num único lugar e **desacopla o cliente das classes concretas**: quem usa só conhece a interface (\`exportar()\`, \`area()\`), não qual classe foi instanciada.

Com um registro (dict), **adicionar novos tipos** não exige modificar a fábrica nem os clientes, respeitando o princípio Aberto/Fechado. Também facilita testes, pois dá para registrar implementações falsas.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Resumo: **Simple Factory** com dict para escolher a classe, **Factory Method** para subclasses decidirem, `@classmethod` para construtores alternativos e **Abstract Factory** para famílias.',
        'O fio condutor é sempre o mesmo: **isolar a criação** para que o resto do código não dependa de classes concretas.',
      ],
      board: null,
    },
  ],
});
