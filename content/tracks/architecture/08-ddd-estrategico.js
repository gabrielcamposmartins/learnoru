Game.registerModule('architecture', {
  id: 'ddd-estrategico',
  title: 'DDD Estratégico',
  kind: 'lesson',
  level: 2,
  order: 20,
  unit: 'ddd',
  summary: 'Linguagem ubíqua, subdomínios, bounded contexts e context map — onde o Domain-Driven Design realmente começa.',
  concepts: ['DDD', 'Linguagem ubíqua', 'Subdomínios', 'Bounded Context', 'Context Map', 'Anticorruption Layer'],
  takeaways: [
    'O maior ganho do DDD está no **estratégico**: errar uma fronteira custa muito mais caro que errar uma classe.',
    'A **linguagem ubíqua** vale nas conversas **e no código**: `assinatura.cancelar()`, não `set_status(4)`.',
    'Invista o melhor time no **subdomínio core** (o diferencial da empresa); compre ou reutilize os **genéricos**.',
    'Cada **bounded context** tem o seu modelo — "Produto" no Catálogo ≠ "Produto" na Logística — e eles se integram por id, eventos ou tradução.',
    'O **context map** explicita como os contextos (e os times) se relacionam; diante de um legado confuso, uma **Anticorruption Layer** — ou um *Bubble Context* — protege o seu modelo.',
  ],
  glossary: [
    { term: 'Linguagem ubíqua', aliases: ['ubiquitous language'], definition: 'Vocabulário construído **junto** por especialistas do negócio e devs e usado nas conversas, nos documentos e **no código**. Vale dentro de um bounded context: se o termo muda na conversa, muda no código também.' },
    { term: 'Bounded Context', aliases: ['bounded contexts', 'contexto delimitado', 'contextos delimitados'], definition: 'Fronteira explícita dentro da qual um modelo e sua linguagem são consistentes: cada termo tem um único significado. Fora dela, o mesmo termo ("Produto") pode ter outro modelo — e está tudo bem.' },
    { term: 'Context Map', aliases: ['context maps', 'mapa de contextos'], definition: 'Visão explícita dos bounded contexts e de **como** cada par se relaciona: Shared Kernel, Customer–Supplier, Conformist, Anticorruption Layer, Open Host Service, Separate Ways… Costuma espelhar a relação entre os times.' },
    { term: 'Anticorruption Layer', aliases: ['anticorruption layers', 'camada anticorrupção', 'camada de anticorrupção'], definition: 'Camada que **traduz** o modelo de um sistema externo ou legado para o modelo do seu contexto, impedindo que os conceitos dele "contaminem" o seu domínio. Se o sistema externo muda, só o tradutor muda.' },
    { term: 'Event Storming', aliases: ['EventStorming'], definition: 'Workshop criado por Alberto Brandolini: especialistas do negócio e devs colam post-its com **eventos de domínio** numa linha do tempo e depois acrescentam comandos, agregados e políticas, para descobrir o processo e as fronteiras entre contextos.' },
    { term: 'Bubble Context', aliases: ['bubble contexts', 'contexto-bolha', 'contexto bolha', 'autonomous bubble'], definition: 'Estratégia de Eric Evans (2013) para começar DDD cercado de legado: um contexto **pequeno e limpo**, isolado do sistema antigo por uma Anticorruption Layer. Se ganha dados próprios e sincroniza de forma assíncrona, vira uma *Autonomous Bubble*.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje vamos falar de **Domain-Driven Design**, o DDD — proposto pelo Eric Evans em 2003.',
        'A premissa é simples: em sistemas de negócio, a complexidade difícil não está no framework nem no banco. Está no **domínio** — nas regras do negócio.',
        'Então o design do software deve nascer de um entendimento profundo desse domínio, construído **junto** com os especialistas do negócio.',
      ],
      board: {
        title: 'DDD — duas metades',
        md: `| | **DDD estratégico** | **DDD tático** |
|---|---|---|
| Pergunta | *Onde* traçar as fronteiras? | *Como* modelar dentro delas? |
| Ferramentas | Linguagem ubíqua, subdomínios, bounded contexts, context map | Entities, Value Objects, Aggregates, Repositories, Domain Events |
| Escala | Organização, times, sistemas | Classes e módulos |

> [!dica] Muita gente começa pelo tático (entidades, repositórios…). Mas o maior ganho do DDD está no **estratégico**: errar uma fronteira custa muito mais caro que errar uma classe.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'O primeiro pilar é a **linguagem ubíqua**: um vocabulário comum entre devs e especialistas do negócio, usado nas conversas, nos documentos **e no código**.',
        'Se o time de negócio fala em "matricular aluno" e o código tem `processar_registro`, alguém está traduzindo na cabeça — e traduções geram bugs.',
      ],
      board: {
        title: 'Linguagem ubíqua no código',
        code: `# ❌ Linguagem técnica/genérica — o negócio não reconhece nada aqui
def processar_dados(obj, flag):
    if flag == 2:
        obj.st = 7
        db.update(obj)


# ✅ Linguagem ubíqua — um especialista do negócio consegue ler
def confirmar_matricula(matricula):
    if matricula.pagamento_aprovado():
        matricula.confirmar()
        repositorio_matriculas.salvar(matricula)`,
        caption: 'Os nomes vêm do negócio: se o termo muda na conversa, muda no código também.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Nem todo pedaço do negócio merece o mesmo esforço. O DDD divide o domínio em **subdomínios**.',
        'O **core** é o que diferencia a empresa da concorrência — é ali que você coloca os melhores devs e o modelo mais cuidadoso.',
        'Os **genéricos** são problemas que todo mundo tem, como login ou envio de e-mail: normalmente vale mais **comprar** ou usar uma biblioteca do que construir.',
      ],
      board: {
        title: 'Subdomínios — exemplo: app de delivery',
        md: `| Tipo | Exemplo no delivery | Estratégia |
|---|---|---|
| 🔥 **Core** | Alocação de entregadores e previsão de tempo de entrega | Construir, investir, modelo rico, melhores devs |
| 🧩 **Supporting** | Cadastro de cardápios dos restaurantes | Construir, mas de forma simples |
| 📦 **Generic** | Autenticação, pagamentos, envio de SMS | Comprar/SaaS/biblioteca |

> [!atencao] Um erro comum é gastar meses construindo um sistema de autenticação "perfeito" (genérico) enquanto o core — o que faz a empresa ganhar dinheiro — fica com código improvisado.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Agora o conceito mais importante do DDD: o **bounded context**, ou contexto delimitado.',
        'Pense na palavra "Produto". Para o time de **Catálogo**, produto tem nome, fotos e descrição. Para **Estoque**, tem quantidade e localização. Para **Logística**, tem peso e dimensões.',
        'Tentar criar **um** modelo de Produto que sirva para todos gera uma classe gigante que ninguém consegue mudar. O DDD aceita: cada contexto tem **seu próprio modelo**.',
      ],
      board: {
        title: 'Um termo, vários modelos',
        md: `\`\`\`text
┌──────── Catálogo ────────┐  ┌──────── Estoque ────────┐  ┌─────── Logística ───────┐
│ Produto                  │  │ Produto                 │  │ Produto                 │
│  - nome, descrição       │  │  - sku                  │  │  - peso_gramas          │
│  - fotos, categoria      │  │  - quantidade           │  │  - dimensões            │
│  - preço de vitrine      │  │  - localização (galpão) │  │  - frágil?              │
└──────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
            ligados apenas pelo identificador: produto_id / sku
\`\`\`

\`\`\`python
# catalogo/modelo.py
@dataclass
class Produto:
    produto_id: str
    nome: str
    descricao: str

# logistica/modelo.py  — outra classe, outro modelo, mesmo id
@dataclass
class Produto:
    produto_id: str
    peso_gramas: int
    fragil: bool
\`\`\`

> [!dica] Dentro de um bounded context, cada termo tem **um único significado**. Entre contextos, o mesmo termo pode significar coisas diferentes — e está tudo bem.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Contextos precisam conversar. O **context map** descreve **como** cada par de contextos se relaciona — e isso reflete, muitas vezes, a relação entre os times.',
        'O padrão que mais aparece em entrevistas é a **Anticorruption Layer**: uma camada que traduz o modelo de um sistema externo ou legado para o seu, sem deixar os conceitos "tortos" dele contaminarem o seu domínio.',
      ],
      board: {
        title: 'Padrões do context map',
        md: `| Padrão | Quando usar |
|---|---|
| **Shared Kernel** | Dois times compartilham um pedaço pequeno do modelo (e coordenam cada mudança) |
| **Customer–Supplier** | O time *upstream* atende às necessidades do *downstream*, que negocia o que precisa |
| **Conformist** | O downstream simplesmente adota o modelo do upstream (não tem poder de negociação) |
| **Anticorruption Layer (ACL)** | O downstream **traduz** o modelo externo para o seu — protege o próprio domínio |
| **Open Host Service / Published Language** | O upstream oferece uma API/protocolo público e estável (ex.: JSON documentado, eventos versionados) |

\`\`\`text
 [ ERP legado ] ──▶ [ ACL: tradutor ] ──▶ [ Nosso contexto de Vendas ]
   CLI_STS="A"         status="ativo"         Cliente(status="ativo")
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E como isso se liga a microsserviços? Um bounded context é uma ótima **candidata** a fronteira de serviço: modelo coeso, linguagem própria, time dono.',
        'Mas atenção: bounded context é uma fronteira **de modelo**, não de deploy. Um monólito modular pode ter vários contextos bem separados.',
        'Para **descobrir** os contextos, uma técnica popular é o **Event Storming**: devs e especialistas do negócio colam post-its com os eventos do domínio numa parede e procuram onde a linguagem muda.',
      ],
      board: {
        title: 'Event Storming em 1 minuto',
        md: `- 🟧 **Eventos de domínio** no passado: *Pedido Realizado*, *Pagamento Aprovado*, *Entregador Alocado*
- 🟦 **Comandos** que os disparam: *Realizar Pedido*, *Aprovar Pagamento*
- 🟨 **Agregados** que recebem os comandos: *Pedido*, *Pagamento*
- 🟪 **Políticas**: "quando *Pagamento Aprovado*, então *Alocar Entregador*"

> [!dica] Onde o vocabulário muda ("cliente" vira "destinatário", "pedido" vira "entrega"), provavelmente há uma **fronteira de contexto**.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Antes dos exercícios: o context map tem padrões que quase ninguém cita em entrevista — e que mostram maturidade.',
        { text: 'E tem um truque do próprio Evans para começar DDD no meio de um sistema legado.', mood: 'happy' },
      ],
      board: {
        title: 'Context map: os padrões esquecidos',
        md: `| Padrão | Ideia |
|---|---|
| **Partnership** | Dois times que só têm sucesso juntos: planejam e integram em conjunto, sem hierarquia de "fornecedor" |
| **Separate Ways** | Integrar custa mais do que vale: cada contexto resolve sozinho, mesmo duplicando um pouco de lógica |
| **Big Ball of Mud** | Uma área sem modelo claro: desenhe uma fronteira em volta, **não** tente modelar lá dentro e não deixe a bagunça vazar |

\`\`\`text
┌─ Bubble Context ─┐     ┌───── ACL ─────┐     ┌──── Legado ──────┐
│ modelo limpo,    │ ◀─▶ │ traduz nos    │ ◀─▶ │ CLI_STS, DT_CAD  │
│ time pequeno     │     │ dois sentidos │     │ dados moram aqui │
└──────────────────┘     └───────────────┘     └──────────────────┘
\`\`\`

> [!sabia] Eric Evans chama isso de **Bubble Context** (contexto-bolha), no artigo *Getting Started with DDD When Surrounded by Legacy Systems* (2013). Em vez de "consertar o legado inteiro", você cria uma **bolha**: um contexto pequeno, com modelo limpo, que lê e grava os dados do sistema antigo através de uma Anticorruption Layer. Quando a bolha ganha banco próprio e se sincroniza com o legado de forma assíncrona, vira uma **Autonomous Bubble** — e pode ir crescendo aos poucos.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Subdomínios, context map e uma Anticorruption Layer em código.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-ddd-est-q1',
      concept: 'Subdomínios',
      say: 'Pensa como a pessoa que decide onde investir o time mais forte.',
      prompt: 'Uma startup de **delivery de comida** compete prometendo entregas mais rápidas que a concorrência. Qual destes é o **subdomínio core**?',
      options: [
        { text: 'O algoritmo de alocação de entregadores e previsão do tempo de entrega.', correct: true, why: 'É exatamente o diferencial competitivo da empresa: entregas mais rápidas.' },
        { text: 'O login de usuários com e-mail e senha.', why: 'Autenticação é um subdomínio **genérico**: todo sistema precisa, e dá para usar uma solução pronta.' },
        { text: 'A emissão de notas fiscais.', why: 'Obrigatório, mas genérico/supporting — não diferencia a empresa. Normalmente se integra com um serviço pronto.' },
        { text: 'O cadastro dos cardápios dos restaurantes.', why: 'É **supporting**: necessário para o negócio, mas não é o que faz o cliente escolher esse app.' },
      ],
      explanation: 'O **core** é o que diferencia a empresa no mercado — aqui, a promessa de entrega rápida depende da alocação de entregadores. É onde vale investir o melhor modelo e o melhor time; subdomínios genéricos podem ser comprados.',
    },
    {
      type: 'mcq',
      id: 'arq-ddd-est-q2',
      concept: 'Context Map',
      say: 'Agora um cenário de integração bem comum.',
      prompt: 'Seu time vai integrar o novo contexto de **Vendas** com um **ERP legado** de 20 anos. O modelo do ERP é confuso: status em códigos de uma letra, nomes de campos como `CLI_STS`, regras implícitas. O time do ERP não vai mudar nada. Qual padrão do context map você usaria?',
      options: [
        { text: 'Anticorruption Layer: uma camada que traduz o modelo do ERP para o modelo de Vendas.', correct: true, why: 'Protege o seu domínio: os conceitos confusos do legado ficam isolados no tradutor.' },
        { text: 'Conformist: adotar o modelo do ERP dentro de Vendas.', why: 'Os códigos e nomes estranhos do legado se espalhariam pelo novo contexto — exatamente o que queremos evitar.' },
        { text: 'Shared Kernel: compartilhar as classes de domínio com o ERP.', why: 'Shared kernel exige coordenação entre times e um modelo que ambos aceitem — o time do ERP não vai colaborar.' },
        { text: 'Published Language: pedir ao ERP que publique uma API bem documentada.', why: 'Seria ótimo, mas depende do upstream — e o enunciado diz que o time do ERP não vai mudar nada.' },
      ],
      explanation: 'Quando o upstream tem um modelo ruim e você não pode mudá-lo, a **Anticorruption Layer** traduz os dados e conceitos dele para a linguagem do seu contexto. O resto do seu código nunca vê `CLI_STS`.',
    },
    {
      type: 'mcq',
      id: 'arq-ddd-est-q3',
      concept: 'Linguagem ubíqua',
      say: 'Mais uma, sobre linguagem.',
      prompt: 'Nas reuniões, o time de negócio sempre fala em **"cancelar a assinatura"**. No código, o método se chama `set_status(4)`. Segundo o DDD, qual é o problema?',
      options: [
        { text: 'O código não usa a linguagem ubíqua: deveria existir algo como `assinatura.cancelar()`, com o termo do negócio.', correct: true, why: 'A linguagem do negócio deve aparecer no código — sem tradução mental.' },
        { text: 'Nenhum: nomes no código são detalhe técnico e não precisam refletir o negócio.', why: 'Para o DDD o código **é** uma expressão do modelo; a distância entre fala e código gera erros de entendimento.' },
        { text: 'O problema é usar número; bastaria trocar para `set_status("cancelado")`.', why: 'Melhora um pouco, mas continua um setter genérico: a **operação de negócio** (cancelar, com suas regras) não aparece.' },
        { text: 'O time de negócio deveria aprender os nomes do código.', why: 'É o contrário: a linguagem é construída **junto**, e o código acompanha o vocabulário do domínio.' },
      ],
      explanation: 'A **linguagem ubíqua** é compartilhada por negócio e devs e aparece no código. `assinatura.cancelar()` expressa a operação de negócio e é o lugar natural para as regras dela (ex.: cancelar só se estiver ativa).',
    },
    {
      type: 'open',
      id: 'arq-ddd-est-q4',
      concept: 'Bounded Context',
      say: 'Pergunta clássica de entrevista sobre DDD. Me explica com calma.',
      prompt: 'Uma empresa quer criar **um único modelo `Cliente`** para ser usado por todos os sistemas: Vendas, Suporte, Cobrança e Marketing. Por que isso tende a dar errado? O que o DDD propõe no lugar?',
      minWords: 20,
      rubric: [
        { label: 'Explica que "Cliente" tem **significados diferentes** em cada área', keywords: ['significa', 'significado', 'semantic', 'sentido', 'coisas diferentes', 'definic', 'ambigu', 'conceito diferente', 'visao diferente'], concept: 'Bounded Context', why: 'Para Cobrança, cliente é quem paga; para Marketing, é um lead; para Suporte, quem abre chamados.' },
        { label: 'Aponta o modelo **gigante/acoplado** que ninguém consegue mudar', keywords: ['acopl', 'gigante', 'inchad', 'enorme', 'god', 'muitos campos', 'complex', 'monstro', 'deus'], concept: 'Acoplamento' },
        { label: 'Cita o impacto entre **times**: toda mudança exige coordenação e pode quebrar outros sistemas', keywords: ['time', 'equipe', 'coorden', 'quebr', 'impact', 'afeta', 'mudanca'], concept: 'Autonomia dos times' },
        { label: 'Propõe **um modelo por bounded context**, integrados por id, eventos ou tradução', keywords: ['bounded context', 'contexto delimitado', ['cada', 'contexto'], ['modelo', 'proprio'], ['contexto', 'separ'], 'anticorrup', 'traduc'], concept: 'Bounded Context' },
      ],
      modelAnswer: `O termo **"Cliente" significa coisas diferentes** em cada área: para Cobrança é quem paga (dados fiscais, forma de pagamento); para Suporte é quem abre chamados (histórico, SLA); para Marketing é um lead (preferências, campanhas). Um modelo único precisa acomodar tudo isso e vira uma **classe gigante e acoplada**, cheia de campos opcionais que só fazem sentido para alguém.

Pior: **todo time depende dele**. Qualquer mudança exige coordenação entre todos, e uma alteração para Marketing pode quebrar Cobrança. A evolução fica lenta e arriscada.

O DDD propõe separar em **bounded contexts**: cada contexto tem **seu próprio modelo** de Cliente, com só o que importa para ele e com a linguagem daquele time. Os contextos se integram pelo **identificador** (cliente_id), por **eventos** (ex.: *ClienteCadastrado*) ou por uma camada de **tradução** (anticorruption layer).`,
    },
    {
      type: 'code',
      id: 'arq-ddd-est-q5',
      concept: 'Anticorruption Layer',
      title: 'Anticorruption Layer para o ERP legado',
      say: 'Mão no código: implemente o tradutor entre o ERP legado e o nosso domínio. O resto do sistema nunca deve ver `CLI_STS`!',
      prompt: `O ERP legado devolve clientes assim:

\`\`\`python
{
    "CLI_NM": "  MARIA SILVA ",     # nome com espaços sobrando, em maiúsculas
    "CLI_DOC": "123.456.789-09",    # CPF formatado
    "CLI_STS": "A",                 # A = ativo, I = inativo, B = bloqueado
    "DT_CAD": "20230115",           # data de cadastro AAAAMMDD
    "VL_LIM": "150000",             # limite de crédito em CENTAVOS, como texto (pode faltar ou vir vazio)
}
\`\`\`

Implemente \`traduzir_cliente(dados)\`, que devolve um \`Cliente\` do **nosso** modelo:

- \`nome\`: sem espaços nas pontas e com as iniciais maiúsculas (\`"Maria Silva"\`)
- \`cpf\`: **só os dígitos** (\`"12345678909"\`)
- \`status\`: \`"ativo"\`, \`"inativo"\` ou \`"bloqueado"\` — código desconhecido deve levantar \`ValueError\`
- \`cadastrado_em\`: um \`date\`
- \`limite_centavos\`: \`int\`; se \`VL_LIM\` faltar ou vier vazio, use \`0\`
- não modifique o dicionário recebido`,
      starter: `from dataclasses import dataclass
from datetime import date


# ── Modelo do NOSSO domínio (não altere) ────────────────────────
@dataclass(frozen=True)
class Cliente:
    nome: str
    cpf: str
    status: str            # "ativo" | "inativo" | "bloqueado"
    cadastrado_em: date
    limite_centavos: int


# ── Anticorruption Layer ────────────────────────────────────────
def traduzir_cliente(dados: dict) -> Cliente:
    """Traduz um registro do ERP legado para o modelo do domínio."""
    pass
`,
      tests: [
        {
          name: 'tradução completa',
          expr: 'traduzir_cliente({"CLI_NM": "  MARIA SILVA ", "CLI_DOC": "123.456.789-09", "CLI_STS": "A", "DT_CAD": "20230115", "VL_LIM": "150000"})',
          expected: 'Cliente(nome="Maria Silva", cpf="12345678909", status="ativo", cadastrado_em=date(2023, 1, 15), limite_centavos=150000)',
        },
        {
          name: 'status B vira "bloqueado"',
          expr: 'traduzir_cliente({"CLI_NM": "joao", "CLI_DOC": "98765432100", "CLI_STS": "B", "DT_CAD": "19991231", "VL_LIM": "0"}).status',
          expected: '"bloqueado"',
        },
        {
          name: 'status desconhecido levanta ValueError',
          code: 'try:\n    traduzir_cliente({"CLI_NM": "Ana", "CLI_DOC": "1", "CLI_STS": "X", "DT_CAD": "20200101", "VL_LIM": "1"})\n    assert False, "esperava ValueError para status desconhecido"\nexcept ValueError:\n    pass',
        },
        {
          name: 'VL_LIM ausente vira 0',
          expr: 'traduzir_cliente({"CLI_NM": "Ana", "CLI_DOC": "111.222.333-44", "CLI_STS": "I", "DT_CAD": "20200229"}).limite_centavos',
          expected: '0',
        },
        {
          hidden: true,
          name: 'VL_LIM vazio vira 0 e status I',
          code: 'c = traduzir_cliente({"CLI_NM": "ana souza", "CLI_DOC": "111.222.333-44", "CLI_STS": "I", "DT_CAD": "20200229", "VL_LIM": ""})\nassert c.limite_centavos == 0 and c.status == "inativo" and c.nome == "Ana Souza"',
        },
        {
          hidden: true,
          name: 'não modifica a entrada',
          code: 'dados = {"CLI_NM": " X ", "CLI_DOC": "1.2-3", "CLI_STS": "A", "DT_CAD": "20240710", "VL_LIM": "5"}\ncopia = dict(dados)\nc = traduzir_cliente(dados)\nassert dados == copia, "a ACL não deve alterar o dicionário do legado"\nassert isinstance(c, Cliente) and c.cadastrado_em == date(2024, 7, 10) and c.cpf == "123"',
        },
      ],
      reviews: [
        {
          when: (m, code) => (code.match(/\belif\b/g) || []).length >= 2,
          text: 'A tradução dos códigos de status virou uma cadeia de `if/elif`. Uma **tabela de tradução** (`{"A": "ativo", ...}`) deixa o mapeamento explícito, fácil de revisar e de estender — o coração de uma ACL.',
          concept: 'Anticorruption Layer: tabela de tradução',
        },
        {
          when: m => m.calls.includes('float'),
          text: 'Você converteu o limite com `float`. Dinheiro em ponto flutuante acumula erros de arredondamento; como o valor já vem em centavos, use `int`.',
          concept: 'Dinheiro sem float',
        },
      ],
      hints: [
        'Crie um dicionário `STATUS_LEGADO = {"A": "ativo", "I": "inativo", "B": "bloqueado"}` e levante `ValueError` se o código não estiver nele.',
        'Para o CPF: `"".join(c for c in texto if c.isdigit())`. Para o nome: `.strip().title()`.',
        'A data: `date(int(s[:4]), int(s[4:6]), int(s[6:8]))`. O limite: `int(dados.get("VL_LIM") or "0")`.',
      ],
      solution: `from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Cliente:
    nome: str
    cpf: str
    status: str
    cadastrado_em: date
    limite_centavos: int


STATUS_LEGADO = {"A": "ativo", "I": "inativo", "B": "bloqueado"}


def traduzir_cliente(dados: dict) -> Cliente:
    codigo = dados.get("CLI_STS")
    if codigo not in STATUS_LEGADO:
        raise ValueError(f"status legado desconhecido: {codigo!r}")
    bruto = dados["DT_CAD"]
    return Cliente(
        nome=dados["CLI_NM"].strip().title(),
        cpf="".join(c for c in dados["CLI_DOC"] if c.isdigit()),
        status=STATUS_LEGADO[codigo],
        cadastrado_em=date(int(bruto[:4]), int(bruto[4:6]), int(bruto[6:8])),
        limite_centavos=int(dados.get("VL_LIM") or "0"),
    )
`,
      solutionExplanation: 'Toda a "sujeira" do legado — nomes de campo, códigos de uma letra, datas em texto, CPF formatado — fica **concentrada** na ACL. O resto do contexto de Vendas só conhece `Cliente` com a linguagem do nosso domínio. Se o ERP mudar, só o tradutor muda. A tabela `STATUS_LEGADO` deixa o mapeamento explícito, e código desconhecido falha alto (`ValueError`) em vez de virar um status inválido silencioso.',
    },
    {
      type: 'match',
      id: 'arq-rx2-ddd-est-q6',
      concept: 'Context Map',
      say: 'Rodada relâmpago de context map: cada situação pede um padrão.',
      prompt: 'Associe cada **situação** ao padrão do context map que ela descreve.',
      pairs: [
        { left: 'ERP legado com `CLI_STS = "A"` que ninguém vai mudar', right: 'Anticorruption Layer' },
        { left: 'API de frete de uma gigante: sem negociação, e o modelo dela serve bem', right: 'Conformist' },
        { left: 'Dois times coeditam um pequeno módulo de tipos comuns', right: 'Shared Kernel' },
        { left: 'Pagamentos oferece uma API estável e eventos versionados para qualquer consumidor', right: 'Open Host Service + Published Language' },
        { left: 'O time upstream inclui as demandas do downstream no próprio planejamento', right: 'Customer–Supplier' },
        { left: 'Integrar custaria mais do que duplicar um pouco de lógica', right: 'Separate Ways' },
      ],
      explanation: 'O padrão descreve uma **relação** — técnica e entre times. Sem poder de negociação, você se **conforma** (se o modelo externo é bom) ou **traduz** com uma ACL (se ele é ruim). Com colaboração, cabe um **Customer–Supplier** ou até um **Shared Kernel** pequeno e bem vigiado. Quem atende muitos consumidores publica um **Open Host Service** com uma **Published Language**. E às vezes a melhor integração é **nenhuma**: *Separate Ways*.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Resumindo o DDD estratégico: **linguagem ubíqua** no código, investimento no **subdomínio core**, **bounded contexts** com modelos próprios…',
        '…e um **context map** explícito, com Anticorruption Layers protegendo o seu domínio de modelos externos. Na próxima aula, vamos ao DDD **tático**!',
      ],
      board: null,
    },
  ],
});
