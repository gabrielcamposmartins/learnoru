Game.registerModule('architecture', {
  id: 'hexagonal',
  title: 'Arquitetura Hexagonal',
  kind: 'lesson',
  level: 2,
  order: 11,
  unit: 'estilos',
  summary: 'Ports & Adapters: o núcleo da aplicação isolado de bancos, frameworks e APIs com typing.Protocol.',
  concepts: ['Ports & Adapters', 'typing.Protocol', 'Adapters de entrada/saída', 'Testes em memória'],
  takeaways: [
    'O **núcleo** (domínio + casos de uso) não importa nada de infraestrutura: conversa com o mundo só por **portas**.',
    'Portas de **entrada** (*driving*) dizem o que a aplicação oferece; portas de **saída** (*driven*) dizem o que ela precisa — e **as duas são definidas pelo núcleo**.',
    '**Adapters** traduzem entre uma tecnologia e uma porta: rota HTTP, CLI e fila de um lado; SQL, HTTP externo e SMTP do outro.',
    'Em Python, `typing.Protocol` declara portas com **tipagem estrutural**: o adapter cumpre a porta sem herdar dela.',
    'Testes são um **ator primário** como qualquer outro: com adapters em memória, as regras rodam em milissegundos.',
  ],
  glossary: [
    { term: 'Ports & Adapters', aliases: ['Ports and Adapters', 'arquitetura hexagonal', 'hexagonal architecture', 'portas e adaptadores'], definition: 'Arquitetura proposta por Alistair Cockburn (2005): o núcleo da aplicação fica isolado e fala com o exterior só por **portas** (interfaces definidas por ele); **adapters** ligam cada porta a uma tecnologia concreta.' },
    { term: 'Driving port', aliases: ['driving ports', 'porta primária', 'portas primárias', 'adapter condutor', 'adapters condutores'], definition: 'Porta de **entrada**: por ela o mundo *dirige* a aplicação, usando os casos de uso que ela oferece. É chamada por adapters condutores — rotas HTTP, comandos de CLI, consumidores de fila e testes.' },
    { term: 'Driven port', aliases: ['driven ports', 'porta secundária', 'portas secundárias', 'adapter dirigido', 'adapters dirigidos'], definition: 'Porta de **saída**: por ela o núcleo usa o mundo (salvar, cobrar, notificar). O núcleo define a interface na língua do negócio; adapters dirigidos a implementam com SQL, HTTP, SMTP…' },
    { term: 'Tipagem estrutural', aliases: ['structural typing', 'subtipagem estrutural', 'structural subtyping'], definition: 'Compatibilidade de tipos pela **forma** (ter os métodos certos), não pela herança declarada. É como o `typing.Protocol` funciona: um adapter satisfaz a porta sem importá-la.' },
    { term: 'Ator primário', aliases: ['atores primários', 'primary actor', 'primary actors'], definition: 'Na hexagonal, quem **dirige** a aplicação por uma porta de entrada: um usuário, outro sistema, um script de lote — ou um teste automatizado. Os atores **secundários** são os dirigidos por ela: banco, gateway de pagamento, e-mail.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é dia de **Arquitetura Hexagonal**, também chamada de **Ports & Adapters**, proposta por Alistair Cockburn.',
        'A pergunta que ela responde é: como deixar a lógica da aplicação **totalmente independente** de banco, framework web e APIs externas?',
      ],
      board: {
        title: 'A ideia em um desenho',
        md: `\`\`\`text
   HTTP ─┐                                   ┌─ Postgres
   CLI  ─┤  adapters      ┌──────────┐       ├─ Memória (testes)
  Fila  ─┼──(entrada)──▶ ● NÚCLEO   ● ──────▶┤
 Testes ─┘     port ▲    │ domínio + │  port  ├─ API de pagamento
                         │ casos de  │  ▲     └─ E-mail
                         │   uso     │  │
                         └──────────┘  adapters (saída)
\`\`\`

- **Núcleo**: domínio + casos de uso. Não importa nada de infraestrutura.
- **Ports**: interfaces que o núcleo define ("preciso salvar produtos").
- **Adapters**: implementações concretas que se encaixam nas portas.`,
      },
    },
    {
      type: 'say',
      text: [
        'Existem dois tipos de porta. As **portas de entrada** (driving) dizem o que a aplicação *oferece*: os casos de uso.',
        'As **portas de saída** (driven) dizem o que a aplicação *precisa* do mundo: salvar dados, enviar e-mail, cobrar um cartão.',
      ],
      board: {
        title: 'Portas de entrada e de saída',
        md: `| | Porta de **entrada** (driving) | Porta de **saída** (driven) |
|---|---|---|
| Quem chama | O mundo chama o núcleo | O núcleo chama o mundo |
| Exemplo de port | \`CadastrarProduto.executar()\` | \`RepositorioProdutos.salvar()\` |
| Exemplo de adapter | Rota FastAPI, comando CLI, consumidor de fila | Repositório SQL, cliente HTTP, SMTP |
| Quem define a interface | O núcleo | **O núcleo** também! |

> [!dica] O ponto-chave: é o **núcleo** quem define as portas de saída, no vocabulário do negócio. A infraestrutura é que se adapta a ele — isso é a inversão de dependência em ação.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Em Python, a forma mais elegante de declarar uma porta é com `typing.Protocol`.',
        'Um Protocol é **tipagem estrutural**: qualquer classe que tenha os métodos certos satisfaz a porta — sem precisar herdar de nada.',
      ],
      board: {
        title: 'Port com typing.Protocol',
        code: `from dataclasses import dataclass
from typing import Protocol


@dataclass
class Produto:
    sku: str
    nome: str
    preco: float


class RepositorioProdutos(Protocol):        # PORTA DE SAÍDA
    def salvar(self, produto: Produto) -> None: ...
    def buscar(self, sku: str) -> Produto | None: ...
    def listar(self) -> list[Produto]: ...`,
        caption: 'A porta fala a língua do negócio: produtos e SKUs — nada de SQL ou tabelas.',
      },
    },
    {
      type: 'say',
      text: [
        'O caso de uso depende apenas da porta. Ele não sabe — nem quer saber — se os produtos estão em Postgres, DynamoDB ou num dicionário.',
      ],
      board: {
        title: 'O núcleo: caso de uso',
        code: `class CadastrarProduto:                    # PORTA DE ENTRADA
    def __init__(self, repo: RepositorioProdutos):
        self.repo = repo

    def executar(self, sku: str, nome: str, preco: float) -> Produto:
        if preco <= 0:
            raise ValueError("preço deve ser positivo")
        if self.repo.buscar(sku) is not None:
            raise ValueError("SKU já cadastrado")
        produto = Produto(sku, nome, preco)
        self.repo.salvar(produto)
        return produto`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora os **adapters**. Um de produção, com banco de verdade, e outro **em memória** — perfeito para testes e protótipos.',
        'Os dois cumprem a mesma porta, então o caso de uso funciona igualzinho com qualquer um.',
      ],
      board: {
        title: 'Adapters de saída',
        code: `class RepositorioSql:                      # adapter de produção
    def __init__(self, conexao):
        self.conexao = conexao

    def salvar(self, produto):
        self.conexao.execute(
            "INSERT INTO produtos (sku, nome, preco) VALUES (?, ?, ?)",
            (produto.sku, produto.nome, produto.preco),
        )

    def buscar(self, sku): ...
    def listar(self): ...


class RepositorioEmMemoria:                 # adapter para testes
    def __init__(self):
        self._dados = {}
    ...`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'E quando isso vale a pena? A hexagonal brilha quando o domínio é rico e a infraestrutura muda ou é difícil de testar.',
        'Para um CRUD simples, pode ser cerimônia demais. Arquitetura é sempre **trade-off**.',
      ],
      board: {
        title: 'Trade-offs',
        md: `| ✅ Vantagens | ❌ Custos |
|---|---|
| Núcleo testável sem banco/rede (testes rápidos) | Mais arquivos e indireção |
| Trocar tecnologia sem tocar nas regras | Mapeamento entre modelos (domínio ↔ ORM ↔ API) |
| Vários pontos de entrada para o mesmo caso de uso | Curva de aprendizado para o time |
| Adiar decisões de infraestrutura | Exagero em sistemas simples |

**Relação com o que já vimos:** hexagonal = **camadas** + **inversão de dependência** + **injeção de dependência**, com foco nas bordas.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Pergunta capciosa: por que um **hexágono**? Seis portas? Seis lados importantes?',
        'Nada disso! E a resposta revela a ideia mais bonita do padrão: **o teste é um cliente como outro qualquer**.',
      ],
      board: {
        title: 'Por que um hexágono?',
        md: `\`\`\`text
   lado que DIRIGE (primário)             lado DIRIGIDO (secundário)
   usuário via HTTP ──┐                 ┌──▶ PostgreSQL
   script de lote ────┼──▶ [ NÚCLEO ] ──┼──▶ API de pagamento
   teste automatizado ┘                 └──▶ fake em memória
\`\`\`

- Nos diagramas em camadas, a UI fica **em cima** e o banco **embaixo**, como se fossem coisas de natureza diferente. O hexágono quebra essa assimetria: **toda** tecnologia é só algo plugado numa porta.
- Os **testes automatizados** são um **ator primário**, igual ao usuário: dirigem o núcleo por uma porta de entrada, com adapters em memória do outro lado.
- Do lado que dirige, o **adapter condutor** chama a porta; do lado dirigido, o núcleo chama a porta e o **adapter dirigido** a implementa.

> [!sabia] Alistair Cockburn escolheu o hexágono **só para ter espaço** para desenhar várias portas e adapters — o número seis não significa nada, e o nome *Ports & Adapters* diz mais que o desenho. A intenção declarada do padrão é permitir que a aplicação seja **dirigida igualmente por usuários, programas, testes automatizados ou scripts de lote**, e desenvolvida isolada dos bancos e dispositivos de produção.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo implementar um adapter e um caso de uso.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-hex-q1',
      concept: 'Ports & Adapters',
      say: 'Vamos classificar as peças.',
      prompt: 'Numa arquitetura hexagonal, uma classe `ClienteHttpCorreios` que implementa `CalculadoraFrete` (definida pelo núcleo) é um…',
      options: [
        { text: 'Adapter de **saída** (driven)', correct: true, why: 'O núcleo precisa calcular frete e define a porta; o cliente HTTP dos Correios é a implementação concreta dessa necessidade.' },
        { text: 'Adapter de **entrada** (driving)', why: 'Adapters de entrada são quem **chama** o núcleo (rotas HTTP, CLI, consumidores de fila).' },
        { text: 'Porta de saída', why: 'A porta é a interface `CalculadoraFrete`; a classe HTTP é quem a implementa.' },
        { text: 'Entidade de domínio', why: 'Entidades não conhecem HTTP nem serviços externos.' },
      ],
      explanation: '`CalculadoraFrete` é a **porta de saída** (definida pelo núcleo, na linguagem do negócio). `ClienteHttpCorreios` é o **adapter de saída** que traduz essa necessidade para chamadas HTTP.',
    },
    {
      type: 'mcq',
      id: 'arq-hex-q2',
      concept: 'typing.Protocol',
      say: 'Agora um detalhe de Python que cai em entrevistas.',
      prompt: 'Qual a principal diferença entre usar `typing.Protocol` e `abc.ABC` para definir uma porta?',
      options: [
        { text: '`Protocol` usa tipagem **estrutural**: basta ter os métodos; `ABC` exige **herança** explícita.', correct: true, why: 'Com Protocol, um adapter satisfaz a porta sem importar nem herdar dela (duck typing checado pelo mypy).' },
        { text: '`Protocol` é verificado em tempo de execução e `ABC` só pelo mypy.', why: 'É praticamente o contrário: `ABC` impede instanciar classes incompletas em runtime; `Protocol` é checado principalmente por type checkers.' },
        { text: '`Protocol` só funciona com dataclasses.', why: 'Não há essa restrição.' },
        { text: 'Não há diferença; são sinônimos.', why: 'São mecanismos diferentes: estrutural vs nominal.' },
      ],
      explanation: '`Protocol` implementa **subtipagem estrutural** (duck typing tipado): o adapter não precisa conhecer a porta. `ABC` é **nominal**: exige herdar e dá erro ao instanciar sem implementar os métodos abstratos. Ambos servem para portas; Protocol reduz o acoplamento.',
    },
    {
      type: 'match',
      id: 'arq-rx-hex-1',
      concept: 'Peças da arquitetura hexagonal',
      say: 'Vamos montar o hexágono peça por peça. Associe!',
      prompt: 'Associe cada peça do sistema de produtos ao seu papel na arquitetura hexagonal.',
      pairs: [
        { left: '`RepositorioProdutos(Protocol)`', right: 'Porta de **saída**: o que o núcleo precisa do mundo' },
        { left: '`CadastrarProduto.executar()`', right: 'Porta de **entrada**: o que o núcleo oferece' },
        { left: '`RepositorioSql`', right: 'Adapter **dirigido**: cumpre a porta usando SQL' },
        { left: 'Rota `POST /produtos` do FastAPI', right: 'Adapter **condutor**: traduz HTTP em chamada de caso de uso' },
        { left: '`main.py`, que monta tudo', right: 'Composition root: escolhe qual adapter vai em cada porta' },
      ],
      explanation: 'Porta = contrato na língua do negócio, **definido pelo núcleo**; adapter = tradução para uma tecnologia. No lado **condutor** (*driving*), o adapter chama a porta; no lado **dirigido** (*driven*), o núcleo chama a porta e o adapter a implementa. A composition root, na borda, conecta cada adapter à sua porta — e nos testes ela pluga fakes em memória.',
    },
    {
      type: 'open',
      id: 'arq-hex-q3',
      concept: 'Arquitetura Hexagonal',
      say: 'Me convença: por que eu usaria hexagonal no meu próximo projeto?',
      prompt: 'Explique a **arquitetura hexagonal** (Ports & Adapters): o que são portas e adapters e qual o principal benefício?',
      minWords: 15,
      rubric: [
        { label: 'Explica **portas** como interfaces/contratos definidos pelo núcleo', keywords: ['porta', 'port', 'interface', 'contrato', 'protocol'], concept: 'Ports', why: 'As portas são os contratos do núcleo com o mundo externo.' },
        { label: 'Explica **adapters** como implementações concretas (banco, HTTP…)', keywords: ['adapter', 'adaptador', 'implementa'], concept: 'Adapters', why: 'Adapters traduzem entre o núcleo e uma tecnologia específica.' },
        { label: 'Destaca o **núcleo isolado** da infraestrutura', keywords: ['isola', 'independ', 'desacopl', 'nucleo', 'dominio', 'nao depende', 'nao conhece'], concept: 'Isolamento do domínio', why: 'A lógica de negócio não conhece banco nem framework.' },
        { label: 'Cita benefício: **testes** ou **troca de tecnologia**', keywords: ['test', 'troc', 'substitu', 'memoria', 'mudar'], concept: 'Testabilidade', why: 'Adapters em memória e trocas de tecnologia sem tocar nas regras.' },
      ],
      modelAnswer: `Na arquitetura hexagonal, o **núcleo** (domínio + casos de uso) fica isolado no centro e se comunica com o exterior apenas por **portas** — interfaces definidas pelo próprio núcleo, na linguagem do negócio (ex.: \`RepositorioProdutos\`, \`CalculadoraFrete\`).

Os **adapters** são as implementações concretas dessas portas: um repositório SQL, um cliente HTTP, uma rota FastAPI ou um consumidor de fila. Há adapters de entrada (que chamam o núcleo) e de saída (que o núcleo chama).

O principal benefício é que o núcleo **não depende** de infraestrutura: dá para **testar** as regras com adapters em memória, rápido e sem banco, e **trocar tecnologias** (outro banco, outro provedor) sem alterar a lógica de negócio.`,
    },
    {
      type: 'code',
      id: 'arq-hex-q4',
      concept: 'Ports & Adapters',
      title: 'Adapter em memória + caso de uso',
      say: 'Agora implemente o adapter em memória e o caso de uso que usa a porta.',
      prompt: `A porta \`RepositorioProdutos\` e a entidade \`Produto\` já estão prontas. Implemente:

**\`RepositorioEmMemoria\`** (adapter que cumpre a porta):
- \`salvar(produto)\` — guarda (ou substitui) pelo \`sku\`;
- \`buscar(sku)\` — devolve o \`Produto\` ou \`None\`;
- \`listar()\` — devolve a lista de produtos salvos.

**\`CadastrarProduto(repo)\`** (caso de uso):
- \`executar(sku, nome, preco)\` → cria, salva e devolve o \`Produto\`;
- lança \`ValueError\` se \`preco <= 0\` ou se o \`sku\` **já existir** (nesses casos, nada é salvo).

O caso de uso deve usar **apenas os métodos da porta** — nunca os detalhes internos do adapter.`,
      starter: `from dataclasses import dataclass
from typing import Protocol


@dataclass
class Produto:
    sku: str
    nome: str
    preco: float


class RepositorioProdutos(Protocol):
    def salvar(self, produto: Produto) -> None: ...
    def buscar(self, sku: str) -> "Produto | None": ...
    def listar(self) -> list: ...


class RepositorioEmMemoria:
    # TODO: implemente salvar, buscar e listar
    pass


class CadastrarProduto:
    def __init__(self, repo: RepositorioProdutos):
        self.repo = repo

    def executar(self, sku, nome, preco):
        # TODO
        pass
`,
      tests: [
        { name: 'salvar e buscar', code: 'r = RepositorioEmMemoria()\nr.salvar(Produto("A1", "Caneca", 25.0))\nassert r.buscar("A1") == Produto("A1", "Caneca", 25.0)' },
        { name: 'buscar inexistente devolve None', expr: 'RepositorioEmMemoria().buscar("nada")', expected: 'None' },
        { name: 'caso de uso cadastra', code: 'r = RepositorioEmMemoria()\np = CadastrarProduto(r).executar("B2", "Camiseta", 59.9)\nassert p == Produto("B2", "Camiseta", 59.9)\nassert r.buscar("B2") == p' },
        {
          name: 'SKU duplicado lança ValueError',
          code: `r = RepositorioEmMemoria()
uc = CadastrarProduto(r)
uc.executar("C3", "Boné", 30.0)
try:
    uc.executar("C3", "Outro", 10.0)
    assert False, "SKU duplicado deveria lançar ValueError"
except ValueError:
    pass
assert r.buscar("C3").nome == "Boné", "o produto original não pode ser sobrescrito"`,
        },
        {
          name: 'preço inválido não salva',
          hidden: true,
          code: `r = RepositorioEmMemoria()
try:
    CadastrarProduto(r).executar("D4", "Grátis", 0)
    assert False, "preço 0 deveria lançar ValueError"
except ValueError:
    pass
assert r.listar() == [], "nada deveria ser salvo"`,
        },
        {
          name: 'caso de uso funciona com qualquer adapter (fake)',
          hidden: true,
          code: `class RepoFake:
    def __init__(self):
        self.chamadas = []
    def salvar(self, produto):
        self.chamadas.append(("salvar", produto.sku))
    def buscar(self, sku):
        self.chamadas.append(("buscar", sku))
        return None
    def listar(self):
        return []

fake = RepoFake()
CadastrarProduto(fake).executar("E5", "Livro", 80.0)
assert ("salvar", "E5") in fake.chamadas, "o caso de uso deve salvar pelo repositório recebido"`,
        },
        { name: 'listar devolve todos', hidden: true, code: 'r = RepositorioEmMemoria()\nuc = CadastrarProduto(r)\nuc.executar("X", "x", 1.0)\nuc.executar("Y", "y", 2.0)\nassert sorted(p.sku for p in r.listar()) == ["X", "Y"]' },
      ],
      reviews: [
        {
          when: (m, code) => {
            const uc = (code.replace(/#.*$/gm, '').split(/class\s+CadastrarProduto\b/)[1] || '').split(/\nclass\s/)[0];
            return /RepositorioEmMemoria\s*\(/.test(uc);
          },
          text: 'O caso de uso cria `RepositorioEmMemoria()` por conta própria. O núcleo deve depender só da **porta** e receber o adapter de fora.',
          concept: 'Inversão de dependência',
        },
        {
          when: (m, code) => {
            const uc = (code.split(/class\s+CadastrarProduto\b/)[1] || '').split(/\nclass\s/)[0];
            return /self\.repo\._\w+/.test(uc);
          },
          text: 'O caso de uso acessa atributos internos do adapter (`self.repo._...`). Isso o acopla a uma implementação — use apenas `salvar`, `buscar` e `listar`.',
          concept: 'Ports & Adapters',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você guardou os produtos numa variável global. Cada instância do adapter deve ter seu próprio estado (ex.: `self._dados = {}` no `__init__`).',
          concept: 'Encapsulamento',
        },
      ],
      hints: [
        'No adapter, use um dicionário indexado por SKU: `self._dados = {}` no `__init__`, e `self._dados[produto.sku] = produto` no `salvar`.',
        '`buscar` pode ser `return self._dados.get(sku)`; `listar`, `return list(self._dados.values())`.',
        'No caso de uso, valide o preço, depois `if self.repo.buscar(sku) is not None: raise ValueError(...)`, e só então crie e salve.',
      ],
      solution: `from dataclasses import dataclass
from typing import Protocol


@dataclass
class Produto:
    sku: str
    nome: str
    preco: float


class RepositorioProdutos(Protocol):
    def salvar(self, produto: Produto) -> None: ...
    def buscar(self, sku: str) -> "Produto | None": ...
    def listar(self) -> list: ...


class RepositorioEmMemoria:
    def __init__(self):
        self._dados = {}

    def salvar(self, produto):
        self._dados[produto.sku] = produto

    def buscar(self, sku):
        return self._dados.get(sku)

    def listar(self):
        return list(self._dados.values())


class CadastrarProduto:
    def __init__(self, repo: RepositorioProdutos):
        self.repo = repo

    def executar(self, sku, nome, preco):
        if preco <= 0:
            raise ValueError("preço deve ser positivo")
        if self.repo.buscar(sku) is not None:
            raise ValueError("SKU já cadastrado")
        produto = Produto(sku, nome, preco)
        self.repo.salvar(produto)
        return produto
`,
      solutionExplanation: 'O `RepositorioEmMemoria` satisfaz a porta **estruturalmente** — nem precisa herdar de `RepositorioProdutos`. O `CadastrarProduto` conhece apenas a porta: por isso funciona com o adapter em memória, com um fake de teste ou com um repositório SQL, sem mudar uma linha. As validações acontecem **antes** do `salvar`, então nada inválido chega ao armazenamento.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Perfeito! Na hexagonal, o **núcleo define as portas**, a infraestrutura fornece **adapters**, e tudo se conecta na composition root.',
        'Com isso você testa as regras em milissegundos e troca tecnologia sem medo. Próxima parada: **monólitos e microsserviços**!',
      ],
      board: null,
    },
  ],
});
