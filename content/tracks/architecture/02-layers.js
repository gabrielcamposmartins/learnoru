Game.registerModule('architecture', {
  id: 'layers',
  title: 'Arquitetura em Camadas',
  kind: 'lesson',
  level: 1,
  order: 10,
  unit: 'estilos',
  summary: 'Apresentação, aplicação, domínio e infraestrutura — e a regra de dependência que as mantém saudáveis.',
  concepts: ['Camadas', 'Regra de dependência', 'DTO', 'Clean Architecture'],
  takeaways: [
    'Separe **apresentação**, **aplicação**, **domínio** e **infraestrutura**: cada camada tem um motivo para mudar.',
    'O controller é **fino**: traduz HTTP em chamada de caso de uso. Regras e invariantes moram no **domínio**.',
    'A **regra de dependência** aponta para dentro: o domínio não importa ORM, framework nem biblioteca de rede.',
    'Entre camadas trafegam **DTOs**, não entidades — assim o formato da API não fica acoplado ao modelo.',
    'Camadas custam indireção: muito *sinkhole* (requisições que só repassam dados) é sinal de camadas demais.',
  ],
  glossary: [
    { term: 'DTO', aliases: ['DTOs', 'Data Transfer Object', 'Data Transfer Objects'], definition: '*Data Transfer Object*: estrutura só de dados, sem comportamento, usada para cruzar fronteiras (entre camadas ou pela rede). Evita que a entidade de domínio vaze para a API.' },
    { term: 'Regra de dependência', aliases: ['dependency rule', 'regra da dependência'], definition: 'Princípio das camadas e da Clean Architecture: as dependências de código apontam **para dentro**, em direção ao domínio. O domínio não conhece banco, framework nem HTTP.' },
    { term: 'Clean Architecture', aliases: ['arquitetura limpa'], definition: 'Proposta de Robert C. Martin (2012) que desenha as camadas em círculos: entidades no centro, casos de uso em volta, adaptadores e frameworks por fora — com a regra de dependência apontando para o centro.' },
    { term: 'Architecture sinkhole', aliases: ['sinkhole', 'sinkhole anti-pattern', 'architecture sinkhole anti-pattern'], definition: 'Anti-pattern da arquitetura em camadas (Mark Richards): requisições que atravessam as camadas só repassando dados, sem lógica. Pela regra 80-20, até ~20% é normal; bem mais que isso sugere camadas demais ou camadas que deveriam ser abertas.' },
    { term: 'Camadas abertas e fechadas', aliases: ['camada fechada', 'camadas fechadas', 'camada aberta', 'camadas abertas', 'closed layer', 'open layer'], definition: 'Uma camada **fechada** precisa ser atravessada por toda requisição, o que isola as mudanças. Uma camada **aberta** pode ser pulada: útil para camadas de apoio, mas cada uma enfraquece o isolamento.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora vamos organizar um sistema inteiro. O estilo mais comum do mercado é a **arquitetura em camadas**.',
        'A ideia: separar o código por **tipo de responsabilidade**, e cada camada só conversa com a de baixo.',
      ],
      board: {
        title: 'As quatro camadas clássicas',
        md: `\`\`\`text
┌──────────────────────────────┐
│  Apresentação  (API, CLI, UI) │  recebe requisições, formata respostas
├──────────────────────────────┤
│  Aplicação  (casos de uso)    │  orquestra: "criar pedido", "pagar"
├──────────────────────────────┤
│  Domínio  (regras de negócio) │  entidades, invariantes, cálculos
├──────────────────────────────┤
│  Infraestrutura               │  banco, e-mail, filas, HTTP externo
└──────────────────────────────┘
\`\`\`

Cada camada tem **um motivo para mudar** — é o SRP aplicado ao sistema todo.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'O erro mais comum que vejo em revisão de código é o **controller gordo**: a rota HTTP valida, calcula, acessa o banco e manda e-mail.',
        'Funciona no começo… até você precisar da mesma regra num job noturno ou numa CLI. Aí começa o copia-e-cola.',
      ],
      board: {
        title: '❌ Anti-pattern: lógica de negócio no controller',
        code: `@app.post("/pedidos")
def criar_pedido(request):
    dados = request.json()
    total = 0
    for item in dados["itens"]:
        if item["qtd"] <= 0:                      # regra de negócio
            return {"erro": "quantidade inválida"}, 400
        total += item["preco"] * item["qtd"]     # regra de negócio
    if total > 10_000:
        total *= 0.95                            # regra de negócio
    conn = sqlite3.connect("app.db")             # infraestrutura
    conn.execute("INSERT INTO pedidos ...")
    return {"total": total}, 201`,
        caption: 'HTTP, regras e SQL misturados: impossível reutilizar ou testar a regra isoladamente.',
      },
    },
    {
      type: 'say',
      text: [
        'Separando em camadas, cada parte fica pequena e com um papel claro.',
        'O **domínio** guarda as regras e invariantes. O **caso de uso** orquestra. O **controller** só traduz HTTP para chamada de caso de uso.',
      ],
      board: {
        title: '✅ O mesmo fluxo em camadas',
        code: `# domínio — regras puras, sem banco nem HTTP
class Pedido:
    def __init__(self):
        self.itens = []

    def adicionar_item(self, preco, qtd):
        if qtd <= 0:
            raise ValueError("quantidade inválida")
        self.itens.append((preco, qtd))

    @property
    def total(self):
        bruto = sum(p * q for p, q in self.itens)
        return bruto * 0.95 if bruto > 10_000 else bruto


# aplicação — orquestra domínio + repositório
class CriarPedido:
    def __init__(self, repo):
        self.repo = repo

    def executar(self, itens):
        pedido = Pedido()
        for preco, qtd in itens:
            pedido.adicionar_item(preco, qtd)
        return self.repo.salvar(pedido)


# apresentação — só traduz HTTP
@app.post("/pedidos")
def criar_pedido(request):
    try:
        id_ = criar_pedido_uc.executar(request.json()["itens"])
    except ValueError as e:
        return {"erro": str(e)}, 400
    return {"id": id_}, 201`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Tem uma regra de ouro aqui: a **regra de dependência**. As dependências apontam para **dentro**, em direção ao domínio.',
        'O domínio não pode importar nada de banco, de framework web ou de e-mail. Ele é o coração — e deve ser o código mais estável do sistema.',
      ],
      board: {
        title: 'Regra de dependência',
        md: `| Camada | Pode depender de | Não pode depender de |
|---|---|---|
| Apresentação | Aplicação | Detalhes internos do domínio de outras telas |
| Aplicação | Domínio, **abstrações** de infra | Framework web |
| Domínio | Nada (só a linguagem) | Banco, HTTP, ORM, e-mail |
| Infraestrutura | Domínio (implementa as abstrações) | Apresentação |

> [!atencao] Se \`dominio/pedido.py\` tem \`import sqlalchemy\` ou \`import requests\`, a regra foi quebrada.`,
      },
    },
    {
      type: 'say',
      text: [
        'Entre camadas, trafegamos **DTOs** — Data Transfer Objects: estruturas simples, só dados, sem comportamento.',
        'Eles evitam que a entidade de domínio vaze para a API, expondo campos internos ou acoplando o formato do JSON ao modelo.',
      ],
      board: {
        title: 'DTOs com dataclasses',
        code: `from dataclasses import dataclass

@dataclass(frozen=True)
class PedidoCriadoDTO:
    id: int
    total: float
    quantidade_itens: int


# o caso de uso devolve o DTO, não a entidade
def executar(self, itens) -> PedidoCriadoDTO:
    pedido = Pedido()
    ...
    id_ = self.repo.salvar(pedido)
    return PedidoCriadoDTO(id_, pedido.total, len(pedido.itens))`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Você vai ouvir falar muito de **Clean Architecture**. Ela é a mesma ideia desenhada em círculos concêntricos.',
        'Entidades no centro, casos de uso em volta, adaptadores e frameworks por fora — e a regra de dependência sempre apontando para o centro.',
      ],
      board: {
        title: 'Clean Architecture em uma imagem',
        md: `\`\`\`text
        ┌───────────────────────────────────┐
        │ Frameworks & Drivers (web, banco) │
        │   ┌───────────────────────────┐   │
        │   │ Adaptadores (controllers, │   │
        │   │ repositórios, gateways)   │   │
        │   │   ┌───────────────────┐   │   │
        │   │   │  Casos de uso     │   │   │
        │   │   │   ┌───────────┐   │   │   │
        │   │   │   │ Entidades │   │   │   │
        │   │   │   └───────────┘   │   │   │
        │   │   └───────────────────┘   │   │
        │   └───────────────────────────┘   │
        └───────────────────────────────────┘
              dependências apontam  →  para dentro
\`\`\`

> [!dica] Não precisa de 4 pastas e 30 interfaces num CRUD simples. Camadas custam indireção — use a quantidade que o problema pede.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma pergunta que pega muita gente: se uma requisição **atravessa** todas as camadas sem lógica nenhuma, isso é bom ou ruim?',
        'Um pouco é normal. Muito é um anti-pattern com nome — e quase ninguém o conhece.',
      ],
      board: {
        title: 'Camadas fechadas, abertas e o sinkhole',
        md: `\`\`\`text
 TODAS FECHADAS (padrão)          COM UMA CAMADA ABERTA
 ┌──────────────────────┐         ┌──────────────────────┐
 │ Apresentação         │         │ Apresentação         │
 ├──────────────────────┤         ├──────────────────────┤
 │ Aplicação            │         │ Aplicação            │──┐
 ├──────────────────────┤         ├──────────────────────┤  │ pode
 │ Domínio              │         │ Serviços (aberta)    │  │ pular
 ├──────────────────────┤         ├──────────────────────┤  │
 │ Infraestrutura       │         │ Infraestrutura       │◀─┘
 └──────────────────────┘         └──────────────────────┘
\`\`\`

- **Camada fechada**: toda requisição passa por ela — é isso que isola as mudanças (*layers of isolation*).
- **Camada aberta**: pode ser pulada. Útil para camadas de apoio, mas cada exceção enfraquece o isolamento — documente o porquê.
- **Camada não é tier**: camada (*layer*) é organização **lógica** do código; *tier* é separação **física** (processos, máquinas). Um monólito pode ter quatro camadas num único *tier*.

\`\`\`python
# sinkhole: cada camada só repassa, sem regra nenhuma
@app.get("/clientes/{id}")
def get_cliente(id):                        # apresentação
    return servico.buscar_cliente(id)

class ServicoClientes:                      # aplicação
    def buscar_cliente(self, id):
        return self.repo.buscar(id)         # e o domínio? nem foi consultado
\`\`\`

> [!sabia] Esse é o **architecture sinkhole anti-pattern**, descrito por Mark Richards: requisições que atravessam as camadas só repassando dados, como água descendo pelo ralo. A heurística dele é a **regra 80-20**: tudo bem se uns 20% das requisições forem "ralo"; se a proporção se inverter, talvez camadas não sejam o estilo certo para esse sistema — ou algumas delas deveriam ser **abertas**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões sobre camadas e responsabilidades.', icon: '🎯' },
    {
      type: 'order',
      id: 'arq-rx-layers-1',
      concept: 'Fluxo de uma requisição em camadas',
      say: 'Aquecimento: siga uma requisição descendo e subindo pelas camadas.',
      prompt: 'Ordene o caminho de um `POST /pedidos` numa arquitetura em camadas, do início ao fim.',
      items: [
        'O controller recebe o `POST /pedidos` e converte o JSON em parâmetros simples',
        'O caso de uso `CriarPedido` é chamado e cria um `Pedido`',
        'A entidade `Pedido` valida os itens e calcula o total (invariantes)',
        'O repositório, na infraestrutura, grava o pedido no banco',
        'O caso de uso devolve um DTO com o id e o total',
        'O controller transforma o DTO numa resposta HTTP `201 Created`',
      ],
      explanation: 'A requisição **desce** e a resposta **sobe**: apresentação → aplicação → domínio → infraestrutura, e de volta. O domínio decide **antes** de qualquer coisa ser gravada, e a entidade nunca sai da aplicação: quem cruza a fronteira é o **DTO**. O controller só traduz HTTP ↔ caso de uso — por isso a mesma regra funciona numa CLI ou num job.',
    },
    {
      type: 'mcq',
      id: 'arq-layers-q1',
      concept: 'Camada de domínio',
      say: 'Onde você colocaria essa regra?',
      prompt: 'A regra "**um pedido não pode ter mais de 50 itens**" deve ficar em qual camada?',
      options: [
        { text: 'Domínio — na entidade `Pedido`', correct: true, why: 'É uma invariante de negócio: deve valer independentemente de quem cria o pedido (API, CLI, job).' },
        { text: 'Apresentação — no controller da rota `/pedidos`', why: 'Se a regra ficar no controller, outro ponto de entrada (uma CLI, um job) pode criar pedidos inválidos.' },
        { text: 'Infraestrutura — como uma constraint no banco apenas', why: 'Uma constraint pode ser uma defesa extra, mas a regra de negócio precisa existir e ser testável no domínio.' },
        { text: 'Em um arquivo `utils.py` compartilhado', why: '"Utils" genérico não tem dono nem significado de negócio — a regra se perde e ninguém sabe onde procurar.' },
      ],
      explanation: '**Invariantes de negócio** pertencem ao domínio. Assim elas são garantidas em qualquer caminho de entrada e podem ser testadas sem banco nem HTTP.',
    },
    {
      type: 'mcq',
      id: 'arq-layers-q2',
      concept: 'Regra de dependência',
      say: 'Agora sobre a direção das dependências.',
      prompt: 'Qual destes `import` **viola** a regra de dependência?',
      options: [
        { text: '`dominio/pedido.py` faz `from sqlalchemy.orm import Session`', correct: true, why: 'O domínio passou a depender de um detalhe de infraestrutura (ORM).' },
        { text: '`aplicacao/criar_pedido.py` faz `from dominio.pedido import Pedido`', why: 'Aplicação depender do domínio é a direção correta (para dentro).' },
        { text: '`infra/repositorio_sql.py` faz `from dominio.pedido import Pedido`', why: 'A infraestrutura implementa detalhes para o domínio — depender dele é permitido.' },
        { text: '`api/rotas.py` faz `from aplicacao.criar_pedido import CriarPedido`', why: 'A apresentação chamar casos de uso é exatamente o esperado.' },
      ],
      explanation: 'As dependências devem apontar **para o domínio**. Quando o domínio importa ORM, framework ou bibliotecas de rede, qualquer troca de tecnologia passa a exigir mexer nas regras de negócio.',
    },
    {
      type: 'open',
      id: 'arq-layers-q3',
      concept: 'Separação de responsabilidades',
      say: 'Imagine que um colega abriu um PR com um controller gordo. Como você explicaria o problema?',
      prompt: 'Por que colocar a **lógica de negócio dentro do controller** (rota HTTP) é considerado um problema? Qual seria a alternativa?',
      minWords: 15,
      rubric: [
        { label: 'Aponta a dificuldade de **reutilizar** a regra em outros pontos de entrada', keywords: ['reutiliz', 'reuso', 'duplica', 'copia', 'cli', 'job', 'outro ponto', 'outros lugares'], concept: 'Reuso', why: 'A mesma regra costuma ser necessária em CLIs, jobs, filas…' },
        { label: 'Aponta a dificuldade de **testar** sem HTTP/banco', keywords: ['test', 'isolad'], concept: 'Testabilidade', why: 'Testar a regra exigiria subir servidor e banco.' },
        { label: 'Menciona **acoplamento** / mistura de responsabilidades', keywords: ['acopla', 'mistur', 'responsabilidade', 'srp', 'framework'], concept: 'Separação de responsabilidades', why: 'HTTP, regra e SQL ficam presos uns aos outros.' },
        { label: 'Propõe mover para **domínio/caso de uso (serviço)**', keywords: ['dominio', 'caso de uso', 'casos de uso', 'servic', 'camada de aplicacao', 'use case', 'entidade'], concept: 'Camadas', why: 'O controller deve apenas traduzir a requisição e chamar o caso de uso.' },
      ],
      modelAnswer: `Quando a regra de negócio mora no controller, ela fica **acoplada ao HTTP e ao framework** e misturada com banco e formatação — várias responsabilidades no mesmo lugar.

Isso dificulta o **reuso**: se um job noturno ou uma CLI precisar da mesma regra, a tendência é duplicar código. Também dificulta os **testes**, pois para testar um cálculo é preciso simular requisição e banco.

A alternativa é mover as regras para o **domínio** (entidades com suas invariantes) e a orquestração para um **caso de uso/serviço** da camada de aplicação. O controller fica fino: traduz a requisição, chama o caso de uso e converte o resultado (ou erro) em resposta HTTP.`,
    },
    {
      type: 'code',
      id: 'arq-layers-q4',
      concept: 'Camadas — domínio e aplicação',
      title: 'Tirando a regra do controller',
      say: 'Mão na massa: extraia a regra de negócio para o domínio e crie o caso de uso.',
      prompt: `Separe o código em **domínio** e **aplicação**:

**Domínio — classe \`Pedido\`**
- \`adicionar_item(preco, qtd)\`: lança \`ValueError\` se \`qtd <= 0\` ou \`preco < 0\`; senão guarda o item.
- propriedade \`total\`: soma de \`preco * qtd\`; se passar de **1000**, aplica **5% de desconto**.

**Aplicação — classe \`CriarPedido\`**
- Recebe um repositório no construtor: \`CriarPedido(repo)\`. O repositório tem \`salvar(pedido) -> id\`.
- \`executar(itens)\` recebe uma lista de tuplas \`(preco, qtd)\`, monta o \`Pedido\`, salva e devolve um **DTO** (dict): \`{"id": ..., "total": ...}\`.
- Se algum item for inválido, o \`ValueError\` sobe e **nada é salvo**.`,
      starter: `class Pedido:
    def __init__(self):
        self.itens = []

    def adicionar_item(self, preco, qtd):
        # TODO: valide e guarde o item
        pass

    @property
    def total(self):
        # TODO: soma com 5% de desconto acima de 1000
        return 0


class CriarPedido:
    def __init__(self, repo):
        self.repo = repo

    def executar(self, itens):
        # TODO: monte o Pedido, salve no repositório e devolva {"id": ..., "total": ...}
        pass
`,
      tests: [
        { name: 'total simples', code: 'p = Pedido()\np.adicionar_item(10, 3)\np.adicionar_item(5, 2)\nassert abs(p.total - 40) < 1e-9, f"total esperado 40, obtido {p.total}"' },
        { name: 'desconto acima de 1000', code: 'p = Pedido()\np.adicionar_item(600, 2)\nassert abs(p.total - 1140) < 1e-9, f"1200 com 5% de desconto = 1140, obtido {p.total}"' },
        {
          name: 'quantidade inválida lança ValueError',
          code: `p = Pedido()
try:
    p.adicionar_item(10, 0)
    assert False, "qtd = 0 deveria lançar ValueError"
except ValueError:
    pass`,
        },
        {
          name: 'caso de uso salva e devolve DTO',
          code: `class RepoFake:
    def __init__(self):
        self.salvos = []
    def salvar(self, pedido):
        self.salvos.append(pedido)
        return len(self.salvos)

repo = RepoFake()
dto = CriarPedido(repo).executar([(100, 2), (50, 1)])
assert dto == {"id": 1, "total": 250}, f"DTO inesperado: {dto}"
assert len(repo.salvos) == 1 and isinstance(repo.salvos[0], Pedido)`,
        },
        {
          name: 'item inválido não salva nada',
          hidden: true,
          code: `class RepoFake:
    def __init__(self):
        self.salvos = []
    def salvar(self, pedido):
        self.salvos.append(pedido)
        return 1

repo = RepoFake()
try:
    CriarPedido(repo).executar([(10, 1), (-5, 1)])
    assert False, "preço negativo deveria lançar ValueError"
except ValueError:
    pass
assert repo.salvos == [], "nada deveria ser salvo quando há item inválido"`,
        },
        { name: 'exatamente 1000 não tem desconto', hidden: true, code: 'p = Pedido()\np.adicionar_item(500, 2)\nassert abs(p.total - 1000) < 1e-9' },
      ],
      reviews: [
        {
          when: m => m.imports.some(i => ['sqlite3', 'requests', 'flask', 'fastapi', 'sqlalchemy', 'django'].includes(i)),
          text: 'Você importou uma biblioteca de infraestrutura/framework. Domínio e aplicação devem depender só de abstrações — o banco real entra pelo repositório injetado.',
          concept: 'Regra de dependência',
        },
        {
          when: m => m.calls.includes('print'),
          text: 'Há `print` no domínio/aplicação. Exibir coisas é papel da **apresentação**; o caso de uso deve apenas devolver dados (o DTO).',
          concept: 'Separação de responsabilidades',
        },
        {
          when: (m, code) => /class\s+CriarPedido[\s\S]*(\*\s*0\.95|0\.05)/.test(code),
          text: 'A regra do desconto aparece dentro de `CriarPedido`. Regras de negócio pertencem ao **domínio** (`Pedido.total`); o caso de uso só orquestra.',
          concept: 'Camada de domínio',
        },
      ],
      hints: [
        'No `adicionar_item`, faça as validações primeiro: `if qtd <= 0 or preco < 0: raise ValueError(...)`.',
        'No `total`: `bruto = sum(p * q for p, q in self.itens)` e depois `return bruto * 0.95 if bruto > 1000 else bruto`.',
        'Em `executar`, adicione **todos** os itens ao pedido antes de chamar `self.repo.salvar(pedido)` — assim um item inválido interrompe antes de salvar.',
      ],
      solution: `class Pedido:
    def __init__(self):
        self.itens = []

    def adicionar_item(self, preco, qtd):
        if qtd <= 0 or preco < 0:
            raise ValueError("item inválido")
        self.itens.append((preco, qtd))

    @property
    def total(self):
        bruto = sum(preco * qtd for preco, qtd in self.itens)
        return bruto * 0.95 if bruto > 1000 else bruto


class CriarPedido:
    def __init__(self, repo):
        self.repo = repo

    def executar(self, itens):
        pedido = Pedido()
        for preco, qtd in itens:
            pedido.adicionar_item(preco, qtd)
        id_ = self.repo.salvar(pedido)
        return {"id": id_, "total": pedido.total}
`,
      solutionExplanation: '`Pedido` concentra as **invariantes** (validação) e o **cálculo** — é domínio puro, testável sem nada externo. `CriarPedido` apenas **orquestra**: monta a entidade, delega a persistência ao repositório recebido e devolve um DTO simples. Como todos os itens são validados antes do `salvar`, um item inválido nunca gera um pedido pela metade.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bom! Resumindo: separe **apresentação**, **aplicação**, **domínio** e **infraestrutura**; mantenha o controller fino…',
        '…e respeite a **regra de dependência**: tudo aponta para o domínio. Na próxima aula veremos como injetar essas dependências direitinho.',
      ],
      board: null,
    },
  ],
});
