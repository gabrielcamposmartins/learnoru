Game.registerModule('architecture', {
  id: 'solid',
  title: 'Princípios SOLID',
  kind: 'lesson',
  level: 1,
  order: 1,
  unit: 'principios',
  summary: 'Os cinco princípios que tornam o código fácil de mudar — com exemplos em Python.',
  concepts: ['SRP', 'OCP', 'LSP', 'ISP', 'DIP'],
  takeaways: [
    '**SRP** é sobre **motivos para mudar** (quem pede as mudanças), não sobre "fazer uma coisa só".',
    '**OCP**: comportamento novo entra como **código novo** (polimorfismo, Strategy) — o `if/elif` por tipo é o sintoma clássico de violação.',
    '**LSP**: o subtipo honra o **contrato** da base — sem pré-condições mais fortes, pós-condições mais fracas ou mudanças de estado que a base proíbe. `NotImplementedError` num método herdado é alarme.',
    '**ISP** e **DIP**: interfaces pequenas (`typing.Protocol`) e regra de negócio dependendo de **abstrações**, com a implementação concreta injetada de fora.',
    'SOLID são **heurísticas**, não leis: aplique onde há mudança de verdade — abstração prematura também custa caro.',
  ],
  glossary: [
    { term: 'SRP', aliases: ['Single Responsibility Principle', 'Princípio da Responsabilidade Única', 'responsabilidade única'], definition: '*Single Responsibility Principle*: um módulo deve ter **um único motivo para mudar** — na formulação mais recente de Robert C. Martin, deve responder a **um único ator** (quem pede as mudanças).' },
    { term: 'OCP', aliases: ['Open/Closed Principle', 'Princípio Aberto/Fechado', 'aberto/fechado'], definition: '*Open/Closed Principle*: aberto para extensão, fechado para modificação. Comportamento novo entra como código novo (polimorfismo, Strategy), sem editar o que já funciona.' },
    { term: 'LSP', aliases: ['Liskov Substitution Principle', 'Princípio de Substituição de Liskov', 'substituição de Liskov'], definition: '*Liskov Substitution Principle*: um subtipo deve poder substituir o tipo base sem surpresas — sem pré-condições mais fortes, pós-condições mais fracas, invariantes quebradas ou mudanças de estado que a base proíbe.' },
    { term: 'ISP', aliases: ['Interface Segregation Principle', 'segregação de interfaces'], definition: '*Interface Segregation Principle*: nenhum cliente deve depender de métodos que não usa. Prefira interfaces pequenas e específicas — em Python, `typing.Protocol` enxutos.' },
    { term: 'DIP', aliases: ['Dependency Inversion Principle', 'Princípio da Inversão de Dependência', 'inversão de dependência'], definition: '*Dependency Inversion Principle*: módulos de alto nível não dependem de detalhes; ambos dependem de **abstrações**. Na prática, a regra de negócio recebe a implementação concreta de fora.' },
    { term: 'History constraint', aliases: ['history rule', 'restrição histórica'], definition: 'Regra do LSP introduzida por Barbara Liskov e Jeannette Wing (1994): um subtipo não pode permitir mudanças de estado que o tipo base proíbe. Ex.: um ponto mutável herdando de um ponto imutável quebra o contrato.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Vamos começar pela base de tudo: os princípios **SOLID**.',
        'São cinco ideias, popularizadas por Robert C. Martin, para que o código aguente mudanças sem virar um castelo de cartas.',
      ],
      board: {
        title: 'SOLID em uma frase cada',
        md: `| Letra | Princípio | Ideia central |
|---|---|---|
| **S** | Single Responsibility | Uma classe deve ter **um único motivo para mudar** |
| **O** | Open/Closed | Aberto para extensão, **fechado para modificação** |
| **L** | Liskov Substitution | Subtipos devem poder **substituir** o tipo base sem surpresas |
| **I** | Interface Segregation | Interfaces **pequenas e específicas** |
| **D** | Dependency Inversion | Dependa de **abstrações**, não de detalhes |

> [!dica] Em entrevistas, não basta recitar a sigla: mostre um exemplo de violação e como corrigi-la.`,
      },
    },
    {
      type: 'say',
      text: [
        'O **S** — responsabilidade única — é sobre **motivos para mudar**, não sobre "fazer uma coisa só".',
        'Se a regra do cálculo muda, o formato do relatório muda e o jeito de salvar muda… são três motivos na mesma classe.',
      ],
      board: {
        title: 'S — Single Responsibility',
        code: `# ❌ Três motivos para mudar na mesma classe
class Relatorio:
    def calcular_totais(self, vendas): ...
    def gerar_html(self, totais): ...
    def salvar_em_disco(self, html, caminho): ...


# ✅ Cada responsabilidade no seu lugar
class CalculadoraDeVendas:
    def totais(self, vendas): ...

class FormatadorHtml:
    def formatar(self, totais): ...

class ArmazenamentoEmDisco:
    def salvar(self, conteudo, caminho): ...`,
        caption: 'Agora trocar HTML por PDF não arrisca quebrar o cálculo.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O **O** — aberto/fechado — diz que adicionar comportamento novo não deveria exigir editar código que já funciona.',
        'O sintoma clássico de violação é aquele `if/elif` gigante verificando o **tipo** das coisas. Cada tipo novo = mexer no mesmo lugar.',
        'A cura é **polimorfismo**: cada tipo sabe fazer a sua parte, e o código cliente só chama o método comum.',
      ],
      board: {
        title: 'O — Open/Closed',
        code: `# ❌ Todo formato novo exige editar esta função
def exportar(dados, formato):
    if formato == "csv":
        ...
    elif formato == "json":
        ...
    elif formato == "xml":   # mais um elif...
        ...


# ✅ Novos formatos = novas classes; exportar() nunca muda
class ExportadorCsv:
    def exportar(self, dados): ...

class ExportadorJson:
    def exportar(self, dados): ...

def exportar(dados, exportador):
    return exportador.exportar(dados)`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'O **L** — substituição de Liskov — tem o exemplo mais famoso de todos: o **Quadrado que herda de Retângulo**.',
        'Matematicamente todo quadrado é um retângulo… mas em código, o quadrado quebra uma promessa do retângulo!',
      ],
      board: {
        title: 'L — Liskov Substitution',
        code: `class Retangulo:
    def __init__(self, largura, altura):
        self.largura = largura
        self.altura = altura

    def set_largura(self, v):
        self.largura = v

    def area(self):
        return self.largura * self.altura


class Quadrado(Retangulo):
    def set_largura(self, v):
        self.largura = v
        self.altura = v   # mantém o quadrado... e quebra a expectativa


def dobrar_largura(r: Retangulo):
    area_antes = r.area()
    r.set_largura(r.largura * 2)
    assert r.area() == area_antes * 2   # falha com Quadrado!`,
        caption: 'Se o código cliente precisa saber que é um Quadrado, a herança está errada.',
      },
    },
    {
      type: 'say',
      text: [
        'O **I** — segregação de interfaces — diz que ninguém deveria ser obrigado a depender de métodos que não usa.',
        'Em Python, fazemos isso com `typing.Protocol` pequenos: cada cliente declara só o que precisa.',
      ],
      board: {
        title: 'I — Interface Segregation',
        code: `from typing import Protocol

# ❌ Interface "gorda": uma impressora simples teria que fingir que escaneia
class Multifuncional(Protocol):
    def imprimir(self, doc): ...
    def escanear(self): ...
    def enviar_fax(self, doc): ...


# ✅ Interfaces pequenas e focadas
class Imprimivel(Protocol):
    def imprimir(self, doc): ...

class Escaneavel(Protocol):
    def escanear(self): ...


def imprimir_relatorio(impressora: Imprimivel, doc):
    impressora.imprimir(doc)   # só depende do que usa`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Por fim, o **D** — inversão de dependência: módulos de alto nível (regras de negócio) não devem depender de módulos de baixo nível (banco, e-mail, HTTP).',
        'Os dois devem depender de uma **abstração**. Na prática: a regra de negócio recebe um "repositório" pelo construtor, sem saber se é Postgres ou memória.',
      ],
      board: {
        title: 'D — Dependency Inversion',
        code: `from typing import Protocol

class RepositorioPedidos(Protocol):      # abstração
    def salvar(self, pedido): ...


class FinalizarPedido:                   # alto nível
    def __init__(self, repo: RepositorioPedidos):
        self.repo = repo                 # recebe a abstração

    def executar(self, pedido):
        pedido.status = "finalizado"
        self.repo.salvar(pedido)


class RepositorioPostgres:               # baixo nível (detalhe)
    def salvar(self, pedido): ...`,
        caption: 'A seta de dependência aponta para a abstração, não para o banco.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Curiosidade de entrevista: a sigla SOLID **não** foi criada pelo Uncle Bob — e o **L** esconde uma regra que quase ninguém conhece.',
        'Liskov não fala só de métodos que lançam exceção: fala de **contrato**. E contrato inclui o que o objeto **nunca** faz.',
      ],
      board: {
        title: 'O contrato por trás do L',
        md: `Um subtipo honra o contrato do tipo base quando:

| Regra | Em outras palavras |
|---|---|
| Pré-condições **não** ficam mais fortes | Não exija mais do que a base exigia (ex.: recusar valores que ela aceitava) |
| Pós-condições **não** ficam mais fracas | Entregue pelo menos o que a base prometia |
| Invariantes são preservadas | O que era sempre verdade continua sendo |
| **History constraint** | O subtipo não permite mudanças de estado que a base proíbe |

\`\`\`python
from dataclasses import dataclass

@dataclass(frozen=True)
class Ponto:                         # contrato: imutável (pode ir num set ou dict)
    x: int
    y: int

class PontoMovel(Ponto):             # ❌ viola a history constraint
    def mover(self, dx):
        object.__setattr__(self, "x", self.x + dx)   # burla o frozen

p = PontoMovel(1, 1)
visitados = {p}
p.mover(1)
p in visitados                       # False — o hash mudou e o set "perdeu" o ponto
\`\`\`

> [!sabia] A sigla **SOLID** foi cunhada por **Michael Feathers**, por volta de 2004, reorganizando princípios que Robert C. Martin tinha reunido em 2000. E a **history constraint** foi a grande novidade do artigo de **Barbara Liskov e Jeannette Wing** (1994): por ela, um "ponto mutável" herdando de um "ponto imutável" quebra o LSP — mesmo que nenhum método herdado mude de comportamento.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões sobre SOLID — incluindo uma refatoração de verdade.', icon: '🎯' },
    {
      type: 'match',
      id: 'arq-rx-solid-1',
      concept: 'SOLID — sintomas de violação',
      say: 'Aquecimento rápido: cada sintoma de código aponta para um princípio.',
      prompt: 'Associe cada **sintoma** ao princípio SOLID que ele viola.',
      pairs: [
        { left: 'Um `if/elif` por tipo que cresce a cada formato novo', right: '**OCP** — Aberto/Fechado' },
        { left: 'Subclasse que lança `NotImplementedError` num método herdado', right: '**LSP** — Substituição de Liskov' },
        { left: 'Classe que muda quando muda o layout do PDF **e** quando muda a regra fiscal', right: '**SRP** — Responsabilidade Única' },
        { left: 'Impressora simples obrigada a implementar `enviar_fax()`', right: '**ISP** — Segregação de Interfaces' },
        { left: 'Regra de negócio que faz `MySQLDatabase("prod")` no `__init__`', right: '**DIP** — Inversão de Dependência' },
      ],
      explanation: 'Sintomas são o que você enxerga em code review: **`if` por tipo** (OCP), **exceção em método herdado** (LSP), **vários motivos para mudar** (SRP), **método que o cliente não usa** (ISP) e **alto nível criando o detalhe** (DIP). Numa entrevista, cite o sintoma, o princípio e a correção: polimorfismo, hierarquia por comportamento, extração de classes, `Protocol` pequeno e injeção pelo construtor.',
    },
    {
      type: 'mcq',
      id: 'arq-solid-q1',
      concept: 'SRP — Responsabilidade Única',
      say: 'Olha essa classe e me diga qual princípio ela fere.',
      prompt: `Qual princípio SOLID esta classe viola **mais claramente**?

\`\`\`python
class Usuario:
    def __init__(self, nome, email):
        self.nome = nome
        self.email = email

    def validar_email(self): ...
    def salvar_no_banco(self): ...
    def enviar_email_boas_vindas(self): ...
    def gerar_pdf_do_perfil(self): ...
\`\`\``,
      options: [
        { text: 'Single Responsibility (SRP)', correct: true, why: 'Persistência, e-mail e PDF são motivos diferentes de mudança concentrados numa classe.' },
        { text: 'Liskov Substitution (LSP)', why: 'Não há herança aqui, então não há substituição de subtipos em jogo.' },
        { text: 'Interface Segregation (ISP)', why: 'ISP fala de clientes forçados a depender de métodos que não usam; o problema principal aqui é a classe acumular responsabilidades.' },
        { text: 'Nenhum — é uma classe coesa', why: 'Banco, e-mail e PDF não têm relação com o conceito de usuário em si.' },
      ],
      explanation: 'A classe tem **vários motivos para mudar**: regra de validação, banco de dados, provedor de e-mail e layout do PDF. O ideal é extrair `RepositorioUsuarios`, `NotificadorEmail` e `GeradorPdf`.',
    },
    {
      type: 'mcq',
      id: 'arq-solid-q2',
      concept: 'LSP — Substituição de Liskov',
      say: 'Pergunta de entrevista clássica sobre herança…',
      prompt: 'Uma classe `Pinguim` herda de `Ave`, que tem o método `voar()`. `Pinguim.voar()` lança `NotImplementedError`. Qual princípio é violado e qual a melhor correção?',
      options: [
        { text: 'LSP — separar a capacidade de voar (ex.: `AveVoadora`) em vez de todas as aves prometerem `voar()`.', correct: true, why: 'Quem recebe uma `Ave` espera poder chamar `voar()`; o Pinguim quebra essa promessa. A hierarquia deve refletir o comportamento.' },
        { text: 'OCP — adicionar um `if isinstance(ave, Pinguim)` antes de chamar `voar()`.', why: 'Isso piora: espalha verificação de tipo pelo código cliente e viola o OCP.' },
        { text: 'SRP — mover `voar()` para uma classe utilitária.', why: 'O problema não é excesso de responsabilidades, é a promessa quebrada pelo subtipo.' },
        { text: 'Nenhum — lançar exceção em métodos não suportados é uma boa prática.', why: 'Lançar exceção num método herdado é justamente o sintoma clássico de violação de Liskov.' },
      ],
      explanation: 'Pelo **LSP**, um subtipo deve honrar o contrato do tipo base. Se nem toda ave voa, `voar()` não pertence a `Ave` — crie uma abstração específica (`AveVoadora`) ou use composição.',
    },
    {
      type: 'mcq',
      id: 'arq-solid-q3',
      concept: 'DIP — Inversão de Dependência',
      say: 'Agora sobre o **D**.',
      prompt: 'Qual trecho segue o **Princípio da Inversão de Dependência**?',
      options: [
        { text: `\`\`\`python
class ServicoRelatorio:
    def __init__(self, fonte_dados):
        self.fonte = fonte_dados
\`\`\``, correct: true, why: 'O serviço recebe a dependência (qualquer objeto que cumpra o contrato) em vez de criá-la.' },
        { text: `\`\`\`python
class ServicoRelatorio:
    def __init__(self):
        self.fonte = MySQLDatabase("prod")
\`\`\``, why: 'O alto nível instancia um detalhe concreto: fica acoplado ao MySQL e difícil de testar.' },
        { text: `\`\`\`python
class ServicoRelatorio(MySQLDatabase):
    pass
\`\`\``, why: 'Herdar do banco acopla ainda mais o serviço ao detalhe de infraestrutura.' },
        { text: `\`\`\`python
fonte = MySQLDatabase("prod")
class ServicoRelatorio:
    def gerar(self):
        return fonte.consultar()
\`\`\``, why: 'Usa uma variável global concreta: dependência escondida e impossível de substituir num teste.' },
      ],
      explanation: 'No DIP, a regra de negócio depende de uma **abstração** e a implementação concreta é **injetada** de fora. Isso permite trocar o banco ou usar um fake em testes sem mexer no serviço.',
    },
    {
      type: 'open',
      id: 'arq-solid-q4',
      concept: 'OCP — Aberto/Fechado',
      say: 'Me explica com suas palavras, como numa entrevista.',
      prompt: 'O que diz o **Princípio Aberto/Fechado (OCP)**? Como você identificaria uma violação e como a corrigiria em Python?',
      minWords: 15,
      rubric: [
        { label: 'Explica **aberto para extensão, fechado para modificação**', keywords: ['extens', 'estend', ['sem', 'modific'], 'fechado', 'sem alterar', 'sem mexer'], concept: 'OCP', why: 'É a definição do princípio: comportamento novo sem editar código estável.' },
        { label: 'Cita o sintoma: **if/elif** ou verificação de tipo', keywords: ['elif', ' if ', 'if/', 'isinstance', 'switch', 'condiciona', 'por tipo', ['verifica', 'tipo']], concept: 'Code smell: switch por tipo', why: 'Cadeias de condicionais por tipo são o sinal mais comum de violação.' },
        { label: 'Propõe **polimorfismo** / Strategy / classes com método comum', keywords: ['polimorf', 'strategy', 'estrategia', 'heranc', 'interface', 'protocol', 'metodo comum', 'abstra'], concept: 'Polimorfismo', why: 'Cada tipo implementa o mesmo método; o cliente só chama esse método.' },
        { label: 'Menciona o benefício: menos risco de quebrar o que funciona', keywords: ['quebr', 'regress', 'risco', 'manuten', 'bug', 'testad'], concept: 'Manutenibilidade', why: 'Não editar código estável reduz regressões.' },
      ],
      modelAnswer: `O OCP diz que um módulo deve estar **aberto para extensão, mas fechado para modificação**: para adicionar um comportamento novo eu crio código novo, sem editar o que já funciona e está testado.

O sintoma típico de violação é uma cadeia de **if/elif** (ou \`isinstance\`) escolhendo o que fazer pelo **tipo** — cada tipo novo obriga a mexer na mesma função, com risco de regressão.

A correção é usar **polimorfismo**: cada tipo vira uma classe (ou função, no estilo Strategy) com um método comum, por exemplo \`desconto(valor)\`, e o código cliente só chama esse método. Um tipo novo é só uma classe nova.`,
    },
    {
      type: 'code',
      id: 'arq-solid-q5',
      concept: 'OCP — Aberto/Fechado',
      title: 'Refatore os descontos',
      say: 'Hora de refatorar! Tire esse `if/elif` por tipo e use polimorfismo.',
      prompt: `O código legado abaixo calcula o preço final com um \`if/elif\` por tipo de cliente. Refatore seguindo o **OCP**:

- Crie as classes \`Comum\` (0% de desconto), \`Vip\` (10%) e \`Funcionario\` (30%).
- Cada classe tem o método \`desconto(valor)\`, que devolve **quanto** será descontado.
- Reescreva \`preco_final(cliente, valor)\` recebendo um **objeto** cliente, **sem** \`if/elif\` nem \`isinstance\`.
- Um tipo novo de cliente (com \`desconto\`) deve funcionar **sem alterar** \`preco_final\`.`,
      starter: `# Código legado: cada novo tipo de cliente exige editar esta função (viola o OCP)
def preco_final(tipo_cliente, valor):
    if tipo_cliente == "comum":
        return valor
    elif tipo_cliente == "vip":
        return valor * 0.9
    elif tipo_cliente == "funcionario":
        return valor * 0.7


# TODO: crie Comum, Vip e Funcionario com o método desconto(valor)
# e reescreva preco_final(cliente, valor) usando polimorfismo.
`,
      tests: [
        { name: 'Comum paga o preço cheio', expr: 'preco_final(Comum(), 100)', expected: '100', compare: 'approx' },
        { name: 'Vip tem 10% de desconto', expr: 'preco_final(Vip(), 200)', expected: '180', compare: 'approx' },
        { name: 'Funcionario tem 30% de desconto', expr: 'preco_final(Funcionario(), 100)', expected: '70', compare: 'approx' },
        { name: 'desconto devolve o valor descontado', expr: 'Vip().desconto(50)', expected: '5', compare: 'approx' },
        {
          name: 'tipo novo funciona sem mudar preco_final',
          hidden: true,
          code: `class Parceiro:
    def desconto(self, valor):
        return 5

assert abs(preco_final(Parceiro(), 100) - 95) < 1e-9, "preco_final deveria funcionar com qualquer objeto que tenha desconto()"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
          text: 'Você ainda verifica o **tipo** do objeto (`isinstance`/`type`). Isso reintroduz o `if` por tipo: cada cliente novo exigiria mexer ali. Deixe cada classe responder por si mesma.',
          concept: 'OCP — polimorfismo',
        },
        {
          when: (m, code) => /\belif\b/.test(code),
          text: 'Ainda há `elif` no código. Se ele escolhe comportamento por tipo de cliente, a função continua **fechada para extensão** — mova essa decisão para as classes.',
          concept: 'Code smell: switch por tipo',
        },
      ],
      hints: [
        'Cada classe precisa só de um método: `def desconto(self, valor): return valor * 0.10` (para o Vip, por exemplo).',
        '`preco_final` vira uma linha: `return valor - cliente.desconto(valor)`.',
      ],
      solution: `class Comum:
    def desconto(self, valor):
        return 0


class Vip:
    def desconto(self, valor):
        return valor * 0.10


class Funcionario:
    def desconto(self, valor):
        return valor * 0.30


def preco_final(cliente, valor):
    return valor - cliente.desconto(valor)
`,
      solutionExplanation: 'Cada tipo de cliente encapsula a própria regra de desconto. `preco_final` depende apenas do **contrato** (ter `desconto(valor)`), então um tipo novo — como `Parceiro` — funciona sem alterar nada: o módulo está **aberto para extensão e fechado para modificação**. Em Python, esse contrato pode ser formalizado com `typing.Protocol`.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Resumindo: **S** separa motivos de mudança, **O** troca `if` por polimorfismo, **L** garante que subtipos cumpram o contrato…',
        '…**I** mantém interfaces pequenas e **D** faz a regra de negócio depender de abstrações. Tudo isso vai reaparecer nas próximas aulas!',
      ],
      board: null,
    },
  ],
});
