Game.registerModule('architecture', {
  id: 'adrs-c4',
  title: 'ADRs e Modelo C4',
  kind: 'lesson',
  level: 2,
  order: 42,
  unit: 'qualidades',
  summary: 'Registrar o porquê das decisões com ADRs e desenhar o sistema em quatro níveis de zoom — porque arquitetura também é comunicação.',
  concepts: ['ADR', 'Modelo C4', 'Diagramas como código', 'Y-statement'],
  takeaways: [
    'Uma **ADR** registra **uma** decisão: contexto, decisão, status e consequências — inclusive o que **piora**. Fica no repositório, numerada e revisada em PR.',
    'ADR aceita é **imutável**: mudou de ideia? Escreva outra que a **substitui**; na antiga, só o status muda ("Substituída por ADR-0015"). Rejeitadas também ficam — evitam rediscutir.',
    'Escreva ADRs para decisões **arquiteturalmente significativas**: caras de reverter, que afetam qualidades ou vários times. Um *Y-statement* resume uma decisão numa frase.',
    'O **modelo C4** é zoom: contexto → contêineres → componentes → código. **Contêiner** é o que roda ou guarda dados separadamente — não é Docker.',
    'Diagramas **como código** (Structurizr, PlantUML, Mermaid) são versionados e revisados junto com a mudança; *fitness functions* checam se o código ainda obedece ao desenho.',
  ],
  glossary: [
    { term: 'ADR', aliases: ['ADRs', 'Architecture Decision Record', 'Architecture Decision Records', 'registro de decisão arquitetural', 'registros de decisão arquitetural'], definition: '*Architecture Decision Record*: documento curto e numerado que registra **uma** decisão de arquitetura — contexto, decisão, status e consequências. Fica versionado no repositório e, depois de aceito, não é reescrito: é **substituído** por outro.' },
    { term: 'Y-statement', aliases: ['Y-statements', 'Y statement'], definition: 'Formato de ADR em uma frase, proposto por Olaf Zimmermann: "No contexto de…, diante de…, decidimos por… e descartamos…, para atingir…, aceitando…". Obriga a registrar as alternativas e o custo aceito.' },
    { term: 'Requisito arquiteturalmente significativo', aliases: ['requisitos arquiteturalmente significativos', 'ASR', 'ASRs', 'architecturally significant requirement'], definition: 'Requisito que molda a estrutura do sistema, afeta suas qualidades (desempenho, segurança, custo…) ou é caro de mudar depois. É o gatilho para escrever uma ADR.' },
    { term: 'Modelo C4', aliases: ['C4 model', 'modelo C4 de Simon Brown', 'diagrama C4', 'diagramas C4'], definition: 'Modelo de Simon Brown para diagramar software em quatro níveis de zoom: **contexto**, **contêineres**, **componentes** e **código**. Não impõe notação, mas pede título, legenda e setas rotuladas.' },
    { term: 'Contêiner (C4)', aliases: ['contêineres (C4)', 'contêiner C4', 'contêineres C4'], definition: 'No modelo C4, algo que precisa **estar rodando ou guardando dados** para o sistema funcionar: SPA, API, worker, banco, bucket. Não tem relação com containers Docker.' },
    { term: 'Diagramas como código', aliases: ['diagrama como código', 'diagrams as code', 'diagrams-as-code'], definition: 'Descrever diagramas em texto (Structurizr DSL, PlantUML, Mermaid) e gerá-los automaticamente: versionados no Git, revisados em PR e com *diff* legível — em vez de desenhos soltos que envelhecem.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje, um tema subestimado: arquitetura também é **comunicação**.',
        'Toda base de código tem aquela pergunta sem dono: "por que usamos Kafka aqui?". Quem decidiu saiu da empresa, e o motivo foi junto.',
      ],
      board: {
        title: 'Decisões evaporam',
        md: `Sem registro, quem chega depois tem duas opções — ambas ruins:
- **Aceitar às cegas**: ninguém ousa mexer, mesmo quando o motivo original já não existe.
- **Mudar às cegas**: alguém "simplifica" e reabre o problema que a decisão resolvia (a *cerca de Chesterton*).

| Pergunta | Ferramenta |
|---|---|
| **Por que** escolhemos X e não Y? | **ADR** — registro de decisão arquitetural |
| **Quais** são as partes e como conversam? | Diagramas do **modelo C4** |
| A decisão **continua sendo respeitada**? | *Fitness functions* (aula anterior) |

> [!dica] Documentação de arquitetura boa é **pouca, perto do código e fácil de manter**. Um diretório \`docs/adr/\` e meia dúzia de diagramas versionados valem mais que uma wiki de 200 páginas que ninguém atualiza.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'O formato mais usado é o de **Michael Nygard**, de 2011: uma ADR é um arquivo curto, numerado, com quatro partes.',
        '**Contexto**, **decisão**, **status** e **consequências** — incluindo as ruins. ADR sem ponto negativo é propaganda.',
      ],
      board: {
        title: 'Anatomia de uma ADR',
        md: `\`\`\`text
# ADR-0007: Usar PostgreSQL como banco de pedidos

Status: Aceita (2024-03-12)

## Contexto
Pedidos precisam de transações envolvendo várias tabelas e de relatórios
com JOINs. O time já opera PostgreSQL; ninguém tem experiência com MongoDB.

## Decisão
Vamos usar PostgreSQL 16, gerenciado pelo provedor de nuvem, para todos os
dados de pedidos. Descartamos MongoDB e DynamoDB.

## Consequências
+ Transações ACID e SQL para relatórios, sem ferramenta nova para operar.
- Mudanças de esquema exigem migrações versionadas.
- A escrita escala na vertical; particionar exigirá uma nova decisão.
\`\`\`

- **Um arquivo por decisão**, como \`docs/adr/0007-usar-postgresql.md\`, revisado em **PR** como qualquer código.
- O **contexto** descreve as **forças** daquele momento (prazo, time, requisitos) — é o que permite julgar a decisão anos depois.
- **Decisão** em voz ativa: "Vamos usar…". **Consequências**: o que melhora **e** o que piora.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Regra de ouro: ADR aceita é **imutável**. Mudou de ideia? Você não edita a antiga — escreve uma **nova**, que a substitui.',
        'Parece burocracia, mas é o que preserva o **raciocínio**: a decisão antiga era boa com o que se sabia na época.',
      ],
      board: {
        title: 'Imutável: ninguém reescreve o passado',
        md: `\`\`\`text
 Proposta ──▶ Aceita ──▶ Substituída por ADR-0015
    │           └──────▶ Descontinuada
    └──▶ Rejeitada
\`\`\`

- A ADR nova diz **"Substitui a ADR-0007"**; na antiga, a **única** edição permitida é o status: **"Substituída por ADR-0015"**.
- **Descontinuada**: a decisão deixou de valer e não há substituta (ex.: o recurso foi removido).
- **Rejeitada** também fica no repositório — evita rediscutir a mesma ideia a cada seis meses.
- Ferramentas como o \`adr-tools\` automatizam o ritual: \`adr new -s 7 "Usar Kafka"\` cria a ADR nova e marca a 7 como substituída.

> [!atencao] ADR não é design doc nem RFC. O design doc **explora** opções antes de decidir; a ADR **registra** a decisão tomada, em uma ou duas páginas. Muitos times usam os dois: o RFC é a discussão, a ADR é a ata.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Nem toda decisão merece ADR. "Qual regra do linter?" — não. "Qual banco?", "monólito ou serviços?", "como autenticar?" — sim.',
        'Esse gatilho tem até nome técnico. E existe um formato de ADR que cabe em **uma frase**!',
      ],
      board: {
        title: 'Quando escrever — e em que formato',
        md: `Escreva uma ADR quando a decisão for **arquiteturalmente significativa**:
- **cara de reverter** (banco, estilo arquitetural, protocolo entre serviços);
- afeta **qualidades** do sistema: desempenho, segurança, disponibilidade, custo;
- afeta **vários times** ou escolhe entre alternativas reais, com trade-offs.

| Formato | Quando usar |
|---|---|
| **Nygard** (contexto, decisão, status, consequências) | O padrão: curto e suficiente na maioria dos casos |
| **MADR** (*Markdown ADR*) | Quando vale registrar as **opções consideradas** e os critérios de escolha |
| **Y-statement** | Uma frase só: bom para decisões menores ou para resumir uma ADR longa |

Um Y-statement de verdade: "No contexto do **checkout**, diante de **picos de 10× na Black Friday**, decidimos por **uma fila entre pedidos e pagamentos** e descartamos **chamadas síncronas**, para atingir **disponibilidade no pico**, aceitando **consistência eventual no status do pedido**."

> [!sabia] O **Y-statement** foi proposto por **Olaf Zimmermann** e colegas: "No contexto de **<caso de uso>**, diante de **<preocupação>**, decidimos por **<opção>** e descartamos **<alternativas>**, para atingir **<qualidade>**, aceitando **<custo>**." E o gatilho para escrever uma ADR tem nome na literatura: **requisito arquiteturalmente significativo** (*ASR*) — aquele que molda a estrutura, as qualidades ou é caro de mudar depois.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora o **o quê**. Diagramas de arquitetura costumam ser caixas e setas sem legenda — cada pessoa lê de um jeito.',
        'O **modelo C4**, de Simon Brown, organiza isso como um mapa: quatro **níveis de zoom**, do mundo inteiro até o código.',
      ],
      board: {
        title: 'Modelo C4: quatro níveis de zoom',
        md: `\`\`\`text
 1 · CONTEXTO      o sistema como uma caixa, com pessoas e sistemas externos
     [Cliente] ──compra──▶ (Loja online) ──cobra──▶ [Gateway de pagamento]

 2 · CONTÊINERES   zoom na Loja: o que roda ou guarda dados separadamente
     (SPA React) ──JSON──▶ (API FastAPI) ──SQL──▶ (PostgreSQL)
                                  └──fila──▶ (Worker de e-mails)

 3 · COMPONENTES   zoom na API: agrupamentos com uma interface clara
     [Pedidos]   [Pagamentos]   [Catálogo]   [Notificações]

 4 · CÓDIGO        zoom num componente: classes e funções (quase nunca desenhado)
\`\`\`

| Nível | Responde | Público |
|---|---|---|
| Contexto | O que é o sistema e com quem ele fala? | Todo mundo, inclusive o negócio |
| Contêineres | Quais aplicações e bancos existem e como conversam? | Devs, ops, arquitetura |
| Componentes | Como um contêiner se organiza por dentro? | Quem trabalha naquele contêiner |
| Código | Como um componente é implementado? | Gerado pela IDE, quando preciso |

Há também diagramas **complementares**: **paisagem** (vários sistemas da empresa), **dinâmico** (a sequência de um fluxo, como o checkout) e **implantação** (onde cada contêiner roda).

> [!atencao] **Contêiner (C4)** não é container Docker! É tudo que precisa **estar rodando ou guardando dados** para o sistema funcionar: SPA, API, worker, banco, bucket. O nome é mais antigo que a fama do Docker — e confunde até hoje.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Diagrama feito à mão numa ferramenta visual envelhece em semanas: ninguém lembra de atualizar, e ninguém revisa.',
        'A saída é tratar diagrama como **código**: texto versionado no Git, revisado em PR, com *diff* legível.',
      ],
      board: {
        title: 'Diagramas como código',
        md: `Com **diagramas como código**, o desenho é gerado a partir de um texto. O mesmo sistema, em Structurizr DSL:

\`\`\`text
workspace {
    model {
        cliente = person "Cliente"
        loja = softwareSystem "Loja online" {
            spa = container "SPA" "Vitrine e carrinho" "React"
            api = container "API" "Regras de pedidos" "Python/FastAPI"
            db = container "Banco" "Pedidos e clientes" "PostgreSQL"
        }
        gateway = softwareSystem "Gateway de pagamento"

        cliente -> spa "Compra usando" "HTTPS"
        spa -> api "Chama" "JSON/HTTPS"
        api -> db "Lê e grava" "SQL"
        api -> gateway "Cobra cartões" "HTTPS"
    }
    views {
        systemContext loja {
            include *
        }
        container loja {
            include *
        }
    }
}
\`\`\`

| Ferramenta | Estilo |
|---|---|
| **Structurizr DSL** (acima) | Um **modelo** só, várias **visões** geradas dele: renomeou a API, todos os diagramas mudam |
| **PlantUML** + C4-PlantUML | Cada diagrama é um arquivo, com macros como \`Person\`, \`Container\` e \`Rel\` |
| **Mermaid** | Renderiza direto nos arquivos markdown do GitHub/GitLab |

> [!dica] Mande a ADR e o diagrama atualizado **no mesmo PR** da mudança. E lembre da aula anterior: documentação **comunica**, mas não **verifica** — é uma *fitness function* no CI que pega o código se afastando do desenho (a erosão arquitetural).`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Um bom diagrama se explica sozinho: quem abre não deveria precisar de você do lado para entender.',
        'O C4 não impõe formas nem cores — mas pede disciplina em **títulos**, **legendas** e **setas**.',
      ],
      board: {
        title: 'Checklist de um diagrama que comunica',
        md: `| Item | Por quê |
|---|---|
| **Título** com tipo e escopo: "Contêineres — Loja online" | Diz o nível de zoom antes de qualquer caixa |
| **Legenda** para formas, cores e linhas | Sem ela, cada leitor inventa um significado |
| Cada elemento com **nome, tipo, tecnologia e uma frase** | "API — Python/FastAPI — regras de pedidos" |
| **Setas de uma direção, com rótulo**: intenção + tecnologia | "Lê e grava pedidos [SQL]" em vez de uma linha muda |
| **Um nível de zoom por diagrama** | Misturar classes com sistemas externos vira o "diagrama de tudo" |

- Conte uma **história** para cada público: o negócio para no **contexto**; quem vai mexer na API desce até os **componentes**.
- ADRs e diagramas se completam: o diagrama mostra **o quê**, a ADR explica **por quê** — um deve apontar para o outro.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo resolver cadeias de ADRs substituídas e escrever a sua própria ADR.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-adr-q1',
      concept: 'Imutabilidade de ADRs',
      say: 'Situação real: a decisão antiga não serve mais. E agora?',
      prompt: 'A **ADR-0007** (aceita há dois anos) escolheu RabbitMQ. Hoje, com 20 times e a necessidade de reprocessar eventos antigos, vocês decidiram migrar para Kafka. O que fazer com as ADRs?',
      options: [
        { text: 'Escrever a **ADR-0015** (Kafka), com o contexto atual, dizendo que ela substitui a 0007; na 0007, mudar só o status para "Substituída por ADR-0015".', correct: true, why: 'É o ritual: a decisão nova ganha registro e contexto próprios, e a antiga continua explicando por que RabbitMQ fez sentido naquela época.' },
        { text: 'Editar a ADR-0007, trocando RabbitMQ por Kafka, para a documentação refletir a realidade.', why: 'Apaga o raciocínio original: some o contexto que justificava RabbitMQ, e ninguém entende por que o código legado ainda o usa.' },
        { text: 'Apagar a ADR-0007: decisão antiga só confunde.', why: 'O histórico é o valor do registro. Sem ele, alguém pode propor RabbitMQ de novo daqui a um ano — sem saber por que foi abandonado.' },
        { text: 'Não escrever ADR: o commit que troca a biblioteca já documenta a mudança.', why: 'O commit diz **o que** mudou, raramente **por quê**, quais alternativas foram descartadas e quais custos foram aceitos — e se perde entre milhares de commits.' },
      ],
      explanation: 'ADRs aceitas são **imutáveis**: formam um *log* de decisões, como um diário de bordo. Para mudar de ideia, escreve-se uma ADR **nova** que aponta para a antiga ("Substitui a ADR-0007"), e a antiga só ganha o status "Substituída por ADR-0015". Assim, quem encontrar RabbitMQ num serviço antigo entende o contexto de cada época — e o motivo da troca.',
    },
    {
      type: 'order',
      id: 'arq-adr-q2',
      concept: 'Ciclo de vida de uma ADR',
      say: 'Do nascimento à aposentadoria de uma decisão. Ordene!',
      prompt: 'Ordene a vida de uma decisão de arquitetura, do primeiro ao último momento.',
      items: [
        'Surge uma decisão cara de reverter: qual broker de mensagens usar',
        'Alguém escreve a ADR com status **Proposta**: contexto, opções e consequências',
        'O time discute os trade-offs no PR e ajusta o texto',
        'O PR é aprovado: status **Aceita**, e o texto não muda mais',
        'Anos depois, o contexto muda: uma ADR nova é aceita e a antiga vira **Substituída por**',
      ],
      explanation: 'Uma ADR nasce de uma decisão **arquiteturalmente significativa**, começa como **Proposta** e é revisada como código, num PR — é ali que os trade-offs são discutidos. Aprovada, vira **Aceita** e o texto congela. Quando o contexto muda, a decisão não é reescrita: uma ADR nova assume, e a antiga ganha o status **Substituída por**, preservando o raciocínio de cada época.',
    },
    {
      type: 'match',
      id: 'arq-adr-q3',
      concept: 'Modelo C4',
      say: 'Agora o C4: cada diagrama no seu nível de zoom.',
      prompt: 'Associe cada diagrama do **modelo C4** ao que ele mostra.',
      pairs: [
        { left: '**Contexto**', right: 'O sistema como uma caixa, com usuários e sistemas externos' },
        { left: '**Contêineres**', right: 'SPA, API, worker e banco — o que roda ou guarda dados separadamente' },
        { left: '**Componentes**', right: 'Os módulos dentro da API: pedidos, pagamentos, catálogo' },
        { left: '**Código**', right: 'Classes e funções — quando preciso, gerado pela IDE' },
        { left: '**Dinâmico**', right: 'A sequência de chamadas de um fluxo, como o checkout' },
        { left: '**Implantação**', right: 'Onde cada contêiner roda: nós, clusters, regiões' },
      ],
      explanation: 'Os quatro níveis são **zoom**: contexto (o sistema e seus vizinhos) → contêineres (o que roda ou guarda dados) → componentes (a organização dentro de um contêiner) → código. Os diagramas **complementares** mostram outras dimensões: o **dinâmico** conta a sequência de um fluxo, e o de **implantação** mapeia contêineres para a infraestrutura. Na prática, contexto e contêineres cobrem a maior parte das conversas.',
    },
    {
      type: 'mcq',
      id: 'arq-adr-q4',
      concept: 'Contêiner (C4)',
      say: 'A pegadinha mais comum do C4. Conte comigo!',
      prompt: 'A loja tem: uma **SPA em React**, uma **API FastAPI** com os módulos `pedidos`, `pagamentos` e `catalogo`, um **worker** que envia e-mails e um **PostgreSQL**. Só a API e o worker rodam em Docker. Quantos **contêineres** aparecem no diagrama C4 de nível 2?',
      options: [
        { text: '4 — SPA, API, worker e PostgreSQL', correct: true, why: 'Cada um precisa estar rodando (ou guardando dados) separadamente para o sistema funcionar. Os módulos da API são **componentes** dela, no nível 3.' },
        { text: '2 — a API e o worker, que rodam em Docker', why: 'Contêiner no C4 **não** tem relação com Docker: a SPA, que roda no navegador, e o banco também são contêineres.' },
        { text: '6 — SPA, os três módulos da API, worker e banco', why: 'Os módulos rodam **dentro** do mesmo processo da API: são componentes (nível 3), não contêineres.' },
        { text: '1 — a Loja inteira', why: 'A Loja como uma caixa é o **sistema de software**, visto no diagrama de contexto (nível 1). O nível 2 abre essa caixa.' },
      ],
      explanation: 'No C4, **contêiner** é uma unidade que roda ou armazena dados de forma independente: aplicação web, SPA, app mobile, API, worker, banco, bucket. A regra prática: se precisa ser **implantado ou estar de pé separadamente** para o sistema funcionar, é contêiner. O que roda **dentro** dele — módulos, pacotes, classes — é componente ou código.',
    },
    {
      type: 'code',
      id: 'arq-adr-q5',
      concept: 'Cadeias de substituição de ADRs',
      title: 'Qual decisão vale hoje?',
      say: 'Mão na massa: o índice de ADRs que todo repositório deveria ter. Qual decisão vale hoje?',
      prompt: `ADRs aceitas são imutáveis, então a relação de substituição fica registrada na ADR **nova**, no campo \`substitui\`. Implemente duas consultas sobre a lista de ADRs:

- **\`vigentes(adrs)\`** → números das ADRs **em vigor**, em ordem crescente.
- **\`resolver(adrs, numero)\`** → números (em ordem crescente) das ADRs em vigor que valem **hoje** para o assunto da ADR \`numero\`, seguindo a cadeia de substituições. Uma decisão pode ser dividida em duas, e duas podem ser unidas numa só.

| Status | Está em vigor? | Substitui as ADRs de \`substitui\`? |
|---|---|---|
| \`"aceita"\` | sim — se nenhuma outra a substituiu | sim |
| \`"descontinuada"\` | não (valeu um dia e foi abandonada) | sim |
| \`"proposta"\` / \`"rejeitada"\` | não | **não** (nunca entrou em vigor) |

- Se \`numero\` está em vigor, a resposta é \`[numero]\`. Se a cadeia termina numa ADR que não está em vigor, ela não entra (pode sobrar \`[]\`).
- \`numero\` inexistente ou **ciclo** de substituições (a 1 substitui a 2, que substitui a 1) → \`ValueError\`.
- Não altere a lista recebida.`,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class Adr:
    numero: int
    titulo: str
    status: str             # "proposta" | "aceita" | "rejeitada" | "descontinuada"
    substitui: tuple = ()   # números das ADRs que esta decisão substitui


def vigentes(adrs):
    # TODO: números das ADRs em vigor, em ordem crescente
    return []


def resolver(adrs, numero):
    # TODO: ADRs em vigor que valem hoje para o assunto da ADR "numero"
    return []
`,
      tests: [
        {
          name: 'vigentes ignora substituídas e rejeitadas',
          code: `adrs = [Adr(1, "Monólito modular", "aceita"),
        Adr(2, "Filas com RabbitMQ", "aceita"),
        Adr(3, "Kafka no lugar do RabbitMQ", "aceita", substitui=(2,)),
        Adr(4, "GraphQL público", "rejeitada")]
assert vigentes(adrs) == [1, 3], f"vigentes: {vigentes(adrs)}"`,
        },
        {
          name: 'resolver segue a cadeia até o fim',
          code: `adrs = [Adr(1, "MySQL", "aceita"),
        Adr(5, "PostgreSQL", "aceita", substitui=(1,)),
        Adr(9, "PostgreSQL gerenciado", "aceita", substitui=(5,))]
assert resolver(adrs, 1) == [9], f"resolver(1): {resolver(adrs, 1)}"
assert resolver(adrs, 5) == [9], f"resolver(5): {resolver(adrs, 5)}"
assert resolver(adrs, 9) == [9], f"resolver(9): {resolver(adrs, 9)}"`,
        },
        {
          name: 'proposta e rejeitada não substituem ninguém',
          code: `adrs = [Adr(2, "RabbitMQ", "aceita"),
        Adr(6, "Kafka", "proposta", substitui=(2,)),
        Adr(7, "NATS", "rejeitada", substitui=(2,))]
assert vigentes(adrs) == [2], f"vigentes: {vigentes(adrs)}"
assert resolver(adrs, 2) == [2], f"resolver(2): {resolver(adrs, 2)}"
assert resolver(adrs, 6) == [] and resolver(adrs, 7) == [], "proposta e rejeitada não estão em vigor"`,
        },
        {
          name: 'ADR inexistente lança ValueError',
          code: `try:
    resolver([Adr(1, "Monólito", "aceita")], 42)
    assert False, "a ADR 42 não existe: deveria lançar ValueError"
except ValueError:
    pass`,
        },
        {
          name: 'decisão dividida em duas',
          hidden: true,
          code: `adrs = [Adr(1, "Um banco para tudo", "aceita"),
        Adr(2, "PostgreSQL para pedidos", "aceita", substitui=(1,)),
        Adr(3, "Elasticsearch para a busca", "aceita", substitui=(1,))]
assert resolver(adrs, 1) == [2, 3], f"resolver(1): {resolver(adrs, 1)}"
assert vigentes(adrs) == [2, 3], f"vigentes: {vigentes(adrs)}"`,
        },
        {
          name: 'descontinuada substitui, mas não está em vigor',
          hidden: true,
          code: `adrs = [Adr(1, "Cache no Redis", "aceita"),
        Adr(4, "Cache em memória", "descontinuada", substitui=(1,)),
        Adr(5, "Feature flags", "aceita")]
assert vigentes(adrs) == [5], f"vigentes: {vigentes(adrs)}"
assert resolver(adrs, 1) == [], f"a decisão foi abandonada: nada em vigor sobre o assunto, obtido {resolver(adrs, 1)}"`,
        },
        {
          name: 'caminhos que se juntam não são ciclo',
          hidden: true,
          code: `adrs = [Adr(1, "A", "aceita"),
        Adr(2, "B", "aceita", substitui=(1,)),
        Adr(3, "C", "aceita", substitui=(1,)),
        Adr(4, "D", "aceita", substitui=(2, 3))]
assert resolver(adrs, 1) == [4], f"resolver(1): {resolver(adrs, 1)}"
assert vigentes(adrs) == [4], f"vigentes: {vigentes(adrs)}"`,
        },
        {
          name: 'ciclo lança ValueError',
          hidden: true,
          code: `adrs = [Adr(1, "A", "aceita", substitui=(2,)), Adr(2, "B", "aceita", substitui=(1,))]
try:
    resolver(adrs, 1)
    assert False, "1 → 2 → 1 é um ciclo: deveria lançar ValueError"
except ValueError:
    pass`,
        },
        {
          name: 'ordem da entrada não importa e a lista não muda',
          hidden: true,
          code: `adrs = [Adr(12, "C", "aceita", substitui=(3,)), Adr(8, "B", "aceita"), Adr(3, "A", "aceita")]
copia = list(adrs)
assert vigentes(adrs) == [8, 12], f"vigentes: {vigentes(adrs)}"
assert resolver(adrs, 3) == [12], f"resolver(3): {resolver(adrs, 3)}"
assert adrs == copia, "não altere a lista recebida"`,
        },
      ],
      reviews: [
        {
          when: m => m.loopDepth >= 3,
          text: 'Há três laços aninhados: para cada ADR você varre a lista inteira de novo. Monte **uma vez** um índice `substituida_por` (número antigo → números novos) — cada passo da cadeia vira uma consulta O(1) ao dicionário.',
          concept: 'Índice com dicionário',
        },
        {
          when: (m, code) => /\badrs\.(sort|remove|pop|append|insert|clear|extend)\(/.test(code),
          text: 'Você altera a lista `adrs` recebida. Quem chamou não espera isso — e ADRs são um registro histórico: leia, não mexa. Use `sorted(...)` ou trabalhe numa cópia.',
          concept: 'Funções sem efeitos colaterais',
        },
        {
          when: (m, code) => /status\s*[!=]=\s*["']substitu/.test(code),
          text: 'Não existe status "substituída" neste modelo: a substituição é **derivada** do campo `substitui` das ADRs novas. Como o texto de uma ADR aceita não muda, é a ADR nova que declara quem ela substitui.',
          concept: 'Imutabilidade de ADRs',
        },
      ],
      hints: [
        'Monte um índice uma vez: `substituida_por = {}`, mapeando número antigo → lista de números novos. Só entram as ADRs com status `aceita` ou `descontinuada` (as que um dia valeram).',
        '`vigentes`: filtre as `aceita` cujo número **não** é chave do índice e devolva `sorted(...)`.',
        '`resolver`: uma busca em profundidade a partir de `numero`. Sem sucessores? É o fim da cadeia: entra no resultado se estiver `aceita`. Para achar ciclos, carregue o **caminho atual** — um `visitados` global confundiria dois caminhos que se juntam com um ciclo. Use um `set` para não repetir resultados.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class Adr:
    numero: int
    titulo: str
    status: str             # "proposta" | "aceita" | "rejeitada" | "descontinuada"
    substitui: tuple = ()   # números das ADRs que esta decisão substitui


QUE_SUBSTITUEM = {"aceita", "descontinuada"}      # entraram em vigor um dia


def _substituida_por(adrs):
    indice = {}                                     # antiga -> [novas]
    for adr in adrs:
        if adr.status in QUE_SUBSTITUEM:
            for antiga in adr.substitui:
                indice.setdefault(antiga, []).append(adr.numero)
    return indice


def vigentes(adrs):
    substituidas = _substituida_por(adrs)
    return sorted(a.numero for a in adrs if a.status == "aceita" and a.numero not in substituidas)


def resolver(adrs, numero):
    por_numero = {a.numero: a for a in adrs}
    if numero not in por_numero:
        raise ValueError(f"a ADR {numero} não existe")
    substituida_por = _substituida_por(adrs)
    em_vigor = set()

    def seguir(n, caminho):
        if n in caminho:
            raise ValueError(f"ciclo de substituições passando pela ADR {n}")
        novas = substituida_por.get(n, [])
        if not novas:                               # fim da cadeia
            if por_numero[n].status == "aceita":
                em_vigor.add(n)
            return
        for nova in novas:
            seguir(nova, caminho | {n})

    seguir(numero, frozenset())
    return sorted(em_vigor)
`,
      solutionExplanation: 'O truque é o **índice invertido**: as ADRs novas dizem quem substituem, então montamos uma vez `substituida_por` (antiga → novas), só com as que um dia entraram em vigor — uma proposta ou uma rejeitada não derruba ninguém. `vigentes` vira um filtro. `resolver` é uma **busca em profundidade** pelas cadeias: cada fim de cadeia `aceita` entra no resultado, e o `set` evita repetir a mesma ADR quando dois caminhos se juntam. Para detectar ciclo, carregamos o **caminho atual**, não um "visitados" global — senão um losango (1 → 2 → 4 e 1 → 3 → 4) seria confundido com ciclo. É o tipo de script que roda no CI para gerar o índice de `docs/adr/` e barrar dados inconsistentes.',
    },
    {
      type: 'open',
      id: 'arq-adr-q6',
      concept: 'Escrevendo uma ADR',
      say: 'Agora é a sua vez de escrever uma. Curta e honesta — com os pontos negativos!',
      prompt: 'Um time de **6 pessoas**, com um produto ainda em validação e regras que mudam toda semana, decidiu começar com um **monólito modular** em vez de microsserviços. Escreva a **ADR** dessa decisão no formato de Nygard: título numerado, **status**, **contexto**, **decisão** e **consequências**.',
      placeholder: '# ADR-0003: ...\n\nStatus: ...\n\n## Contexto\n...\n\n## Decisão\n...\n\n## Consequências\n...',
      minWords: 40,
      rubric: [
        { label: 'Informa o **status** (proposta, aceita…)', keywords: ['status', 'aceit', 'propost', 'accepted', 'proposed'], concept: 'Ciclo de vida de uma ADR', why: 'O status diz se a decisão vale — e é a única parte que muda depois ("Substituída por…").' },
        { label: 'Descreve o **contexto**: as forças por trás da decisão (time pequeno, domínio instável…)', keywords: ['contexto', 'time', 'equipe', 'pessoas', 'devs', 'validacao', 'instav', 'mudam', 'muda toda', 'prazo'], concept: 'Contexto de uma ADR', why: 'Sem o contexto, ninguém consegue julgar se a decisão ainda faz sentido quando as forças mudarem.' },
        { label: 'Registra a **decisão** em voz ativa ("Vamos…", "Decidimos…")', keywords: ['decisao', 'decidimos', 'decidiu', 'vamos', 'adotaremos', 'usaremos', 'optamos', 'escolhemos'], concept: 'ADR', why: 'A decisão precisa ser inequívoca: o que foi escolhido — e, idealmente, o que foi descartado.' },
        { label: 'Lista **consequências** — incluindo as negativas (trade-offs)', keywords: ['negativ', 'desvantag', 'trade-off', 'tradeoff', 'custo', 'risco', 'pior', 'aceitamos', 'abrimos mao', 'limitac', 'por outro lado', 'porem', 'em troca', 'dificulta'], concept: 'Consequências e trade-offs', why: 'ADR sem ponto negativo é propaganda: registrar o custo aceito ajuda quem for revisitar a decisão.' },
      ],
      modelAnswer: `# ADR-0003: Começar com um monólito modular

**Status:** Aceita (2024-05-10)

## Contexto
Somos um time de 6 pessoas, e o produto ainda está em validação: as regras mudam toda semana e os limites entre domínios não estão claros. Não temos plataforma para operar muitos serviços (tracing distribuído, CI/CD por serviço).

## Decisão
Vamos construir um **monólito modular** em Python: um deploy e um banco, com módulos por domínio (pedidos, pagamentos, catálogo) que só conversam pela API pública de cada um. Descartamos microsserviços por enquanto.

## Consequências
- (+) Deploy e transações simples; mudar as fronteiras entre módulos é barato.
- (+) Módulos com API pública facilitam extrair um serviço no futuro (Strangler Fig).
- (−) O app escala como um todo, e um bug grave pode derrubar tudo.
- (−) Risco de os módulos se acoplarem com o tempo: vamos verificar as fronteiras com fitness functions no CI e revisitar esta decisão quando houver mais de três times.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! **ADRs** guardam o *porquê* — contexto, decisão, status e consequências —, imutáveis e substituídas quando o mundo muda.',
        'O **C4** mostra o *o quê* em níveis de zoom, e diagramas **como código** evoluem junto com o sistema. Arquitetura boa é arquitetura que o time **entende**.',
      ],
      board: null,
    },
  ],
});
