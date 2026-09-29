(function () {
  // Prelúdio dos testes do detector: monta esquemas curtos e compara sem depender da ordem.
  const PRE_VER = `def esq(req=None, resp=None):
    """esq(req={"nome": ("str", True)}) → esquema no formato do enunciado."""
    def lado(campos):
        return {c: {"tipo": t, "obrigatorio": o} for c, (t, o) in (campos or {}).items()}
    return {"requisicao": lado(req), "resposta": lado(resp)}

def confere(antigo, novo, esperado):
    obtido = sorted(map(tuple, detectar_quebras(antigo, novo)))
    assert obtido == sorted(esperado), f"esperado {sorted(esperado)}, obtido {obtido}"

`;

  Game.registerModule('apis', {
    id: 'versionamento',
    title: 'Versionamento e evolução de APIs',
    kind: 'lesson',
    level: 2,
    order: 11,
    unit: 'design',
    summary: "Evoluir sem quebrar quem depende de você: estratégias de versão, mudanças compatíveis × incompatíveis, Hyrum's Law, Tolerant Reader, expand/contract, os cabeçalhos Deprecation e Sunset — e semver sem pegadinhas.",
    concepts: ['Breaking changes', "Hyrum's Law", 'Tolerant Reader', 'Expand/contract', 'Semver'],
    takeaways: [
      'Avalie toda mudança do ponto de vista de quem **já** consome: na **resposta** dá para acrescentar; na **requisição** dá para afrouxar. Remover, renomear, mudar tipo ou apertar validação **quebra**.',
      'Versão na **URL** é explícita e fácil de rotear; em **cabeçalho** ou **media type** deixa a URL estável. Escolha uma — e crie versões novas **raramente**: cada uma é um produto a manter.',
      "*Hyrum's Law*: com usuários suficientes, **todo comportamento observável** vira contrato — ordem, mensagens, tempos. Documentar o que não é garantido ajuda; às vezes é preciso **esconder** ou **aleatorizar**.",
      'Clientes devem ser *Tolerant Readers* (ler só o que usam, ignorar o desconhecido); servidores migram com **expand/contract** e avisam com `Deprecation`, `Sunset` e `Link`.',
      '**Semver**: MAJOR quebra, MINOR acrescenta, PATCH corrige. Compare versões **numericamente** (`1.10.0 > 1.9.0`) e lembre que pré-release vem **antes** da versão final.',
    ],
    glossary: [
      { term: 'Breaking change', aliases: ['breaking changes', 'mudança incompatível', 'mudanças incompatíveis', 'mudanca incompativel', 'mudancas incompativeis'], definition: 'Mudança que faz um cliente que funcionava parar de funcionar sem que ele tenha mudado nada: remover ou renomear campo, mudar tipo, exigir algo que era opcional, apertar validação, mudar semântica.' },
      { term: "Hyrum's Law", aliases: ['Lei de Hyrum', "Hyrum's law", 'Hyrums Law'], definition: 'Observação de Hyrum Wright (Google): com um número suficiente de usuários, **todo comportamento observável** do sistema passa a ser dependido por alguém — não importa o que o contrato promete.' },
      { term: 'Tolerant Reader', aliases: ['tolerant readers', 'leitor tolerante', 'leitores tolerantes'], definition: 'Padrão para consumidores de APIs: leia só o que você precisa, ignore campos desconhecidos e não dependa de ordem nem de detalhes não prometidos. Assim o provedor pode evoluir sem quebrar você.' },
      { term: 'Princípio de Postel', aliases: ['principio de Postel', 'Lei de Postel', "Postel's law", 'princípio da robustez', 'principio da robustez', 'robustness principle'], definition: '"Seja conservador no que envia e liberal no que aceita" (Jon Postel, TCP). Criticado por deixar desvios se acumularem até virarem padrão de fato; a RFC 9413 (2023) recomenda tolerância só onde a especificação prevê extensão.' },
      { term: 'Expand/contract', aliases: ['expand and contract', 'expandir/contrair', 'parallel change', 'mudança paralela', 'mudanca paralela'], definition: 'Migração em passos compatíveis: **expandir** (o novo convive com o antigo), migrar os consumidores, medir o uso e só então **contrair** (remover o antigo). Vale para APIs e para esquemas de banco.' },
      { term: 'Sunset', aliases: ['cabeçalho Sunset', 'cabecalho Sunset', 'Sunset header'], definition: 'Cabeçalho HTTP (RFC 8594) com a data em que um recurso deve deixar de responder. Complementa o `Deprecation` (RFC 9745), que avisa desde quando ele está obsoleto.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje o assunto é **evoluir uma API sem quebrar quem depende dela**. Parece fácil até você descobrir quantos clientes existem que você nem conhece.',
          'App de celular que ninguém atualiza, script de parceiro rodando num cron desde 2019… tudo isso depende do seu **contrato**.',
        ],
        board: {
          title: 'Uma API publicada é uma promessa',
          md: `\`\`\`text
 servidor:  deploy ──── deploy ──── deploy ──── deploy ──────▶  (você controla)
 clientes:  app 3.2 (2023) ─────────────────────────────────▶  (ninguém atualiza)
            app 4.0 (2024) ─────────────────────────────────▶
            ERP do parceiro, script num cron ───────────────▶  (você nem sabe que existe)
\`\`\`

Você faz deploy do servidor quando quiser; os clientes, não. Por isso toda mudança passa por uma pergunta só: **um cliente que funcionava ontem continua funcionando hoje, sem mudar nada?**

| Estratégia | Consequência |
|---|---|
| Nunca mudar | a API apodrece |
| Mudar e quebrar | incidentes em clientes que você nem conhece |
| **Evoluir de forma compatível** e versionar só o inevitável | exige disciplina — o assunto de hoje |

> [!dica] Versão nova é **produto novo**: documentação, testes, monitoração e suporte em dobro. Crie versões **raramente**; a regra é evoluir sem quebrar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Quando a quebra é inevitável, onde fica a versão? Há quatro lugares comuns — e cada um tem torcida.',
          'Nenhum é "o certo". O que importa é escolher um, ser consistente e facilitar a vida de quem chama.',
        ],
        board: {
          title: 'Onde colocar a versão',
          md: `\`\`\`http
GET /v2/pedidos/42 HTTP/1.1
Host: api.loja.dev
\`\`\`

\`\`\`http
GET /pedidos/42 HTTP/1.1
Host: api.loja.dev
Accept: application/vnd.loja.v2+json
\`\`\`

| Estratégia | Exemplo real | A favor | Contra |
|---|---|---|---|
| **Caminho** | \`/v1/charges\` (Stripe) | explícita; fácil de rotear, cachear e ver no log | a "mesma" coisa ganha outra URL |
| **Query string** | \`?api-version=2024-06-01\` (Azure) | fácil de testar no navegador | fácil de esquecer; polui a URL |
| **Cabeçalho próprio** | \`X-GitHub-Api-Version: 2022-11-28\` | URL estável; versão por **data** | invisível no navegador e em muitos logs |
| **Media type** | \`Accept: application/vnd.loja.v2+json\` | negociação de conteúdo "purista"; versão por recurso | complexa; exige \`Vary: Accept\` nos caches |

> [!sabia] O Stripe **fixa** cada conta na versão (uma data, como \`2024-06-20\`) da sua primeira chamada. O servidor só fala a versão mais nova, e uma cadeia de **módulos de mudança** converte a resposta "para trás", versão por versão, até a data da conta. Uma base de código, dezenas de versões vivas.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o coração da aula: o que **quebra** um cliente? Depende de **que lado** do contrato a mudança está.',
          'Na **resposta**, dá para acrescentar. Na **requisição**, dá para afrouxar. O resto quase sempre quebra.',
        ],
        board: {
          title: 'Compatível × incompatível',
          md: `| Mudança | Lado | Veredito |
|---|---|---|
| Adicionar um campo | resposta | ✅ compatível (para clientes tolerantes) |
| Adicionar um campo **opcional** | requisição | ✅ compatível |
| Adicionar um campo **obrigatório** | requisição | ❌ quebra: os clientes antigos não o enviam |
| Obrigatório → opcional | requisição | ✅ a entrada ficou mais permissiva |
| Obrigatório → opcional (pode faltar ou vir \`null\`) | resposta | ❌ quebra quem faz \`pedido["email"]\` |
| Remover ou renomear um campo | qualquer | ❌ quebra |
| Mudar o tipo (\`"preco": 19.9\` → \`"19.90"\`) | qualquer | ❌ quebra |
| Apertar a validação (CPF agora é conferido) | requisição | ❌ quebra quem enviava o que antes passava |
| Novo valor num enum (\`"status": "estornado"\`) | resposta | ⚠️ zona cinzenta: quebra quem trata o enum como fechado |
| Mudar status code, formato de erro ou valor padrão | comportamento | ❌ quebra (semântica) |

\`\`\`text
 REQUISIÇÃO (o cliente escreve)  → só pode AFROUXAR    (aceitar mais)
 RESPOSTA   (o cliente lê)       → só pode FORTALECER  (garantir mais)
\`\`\`

> [!sabia] É a mesma regra do **Princípio de Substituição de Liskov**: um subtipo pode **enfraquecer pré-condições** (aceitar mais) e **fortalecer pós-condições** (garantir mais) — nunca o contrário. Uma versão nova da API é, na prática, um "subtipo" da antiga.

> [!atencao] Documente desde o primeiro dia que **novos valores de enum podem aparecer** e que o cliente deve tratar valores desconhecidos. Assim, acrescentar um status deixa de ser zona cinzenta.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          "Agora uma lei que todo mundo que mantém API já sentiu na pele, mas pouca gente conhece pelo nome: a **Hyrum's Law**.",
          'Ela diz que o contrato **real** não é o que está documentado. É **tudo** que o cliente consegue observar.',
        ],
        board: {
          title: "Hyrum's Law: todo comportamento observável vira contrato",
          md: `> "Com um número suficiente de usuários de uma API, não importa o que você promete no contrato: **todos os comportamentos observáveis** do seu sistema serão dependidos por alguém." — Hyrum Wright, Google

| Comportamento "não prometido" | Alguém dependia dele |
|---|---|
| Ordem dos itens de uma lista | "o primeiro é sempre o mais barato" |
| Ordem das chaves no JSON | parser caseiro que lê por posição |
| Texto da mensagem de erro | \`if "saldo insuficiente" in erro["detail"]:\` |
| Formato dos IDs (hoje numéricos) | cliente guardava o ID num \`int\` |
| Tempo de resposta | o endpoint ficou mais rápido e expôs uma *race condition* no cliente |

**Defesas:** documente explicitamente o que **não** é garantido; exponha a ordenação como parâmetro (\`ordem=\`) em vez de deixá-la implícita; use IDs e cursores **opacos**; **aleatorize** o que é indefinido; e rode **testes de contrato** com os maiores consumidores.

> [!sabia] O Go **embaralha de propósito** a ordem de iteração dos maps para que ninguém dependa dela. O Python fez o caminho inverso: no CPython 3.6 a ordem de inserção dos dicts era detalhe de implementação — e, com código já dependendo dela, no 3.7 virou **garantia da linguagem**. A tirinha 1172 do *xkcd* ("Workflow") é a lei em quadrinhos: um usuário reclama que a correção de um bug que esquentava a CPU "quebrou o fluxo de trabalho" dele.`,
        },
      },
      {
        type: 'say',
        text: [
          'Do lado de quem **consome**, a defesa tem nome: **Tolerant Reader**. Leia só o que você usa e ignore o resto.',
          'Parece óbvio, mas o jeito mais "pythônico" de ler JSON — desempacotar tudo com `**` — é justamente o mais frágil.',
        ],
        board: {
          title: 'Tolerant Reader (e as críticas a Postel)',
          md: `\`\`\`python
from dataclasses import dataclass

@dataclass
class Pedido:
    id: int
    total: float

dados = {"id": 42, "total": 99.9, "moeda": "BRL"}   # o servidor ACRESCENTOU "moeda"

# ❌ frágil: TypeError: Pedido.__init__() got an unexpected keyword argument 'moeda'
pedido = Pedido(**dados)

# ✅ leitor tolerante: pega só o que usa e ignora o resto
pedido = Pedido(id=dados["id"], total=dados["total"])

# ✅ enum tolerante: um valor novo não derruba o cliente
match dados.get("status"):
    case "pago":
        liberar_envio()
    case "cancelado":
        estornar()
    case desconhecido:
        registrar_status_novo(desconhecido)
\`\`\`

**Tolerant Reader** (Martin Fowler, 2011): consuma o mínimo necessário, ignore campos desconhecidos, não valide o que você não usa e não dependa de ordem. É o que permite ao provedor **acrescentar** sem quebrar.

Ele costuma ser associado ao **princípio de Postel** (o *robustness principle* do TCP): *"seja conservador no que envia e liberal no que aceita"*. Mas a parte "liberal" tem críticas sérias:

- Aceitar entrada **malformada** faz o desvio virar padrão de fato — todo mundo passa a ter que aceitá-lo também (vide a "sopa de tags" do HTML).
- Parsers lenientes que discordam entre si abrem brechas de segurança, como o *HTTP request smuggling*.

> [!sabia] Em 2023, a **RFC 9413** (*Maintaining Robust Protocols*) revisou o princípio de Postel e defende a **intolerância virtuosa**: tolerância só onde a especificação **prevê** extensão (como ignorar campos desconhecidos); diante de entrada **inválida**, falhe de forma clara e visível. Tolerant Reader não é aceitar lixo.`,
        },
      },
      {
        type: 'say',
        text: [
          'E do lado de quem **provê**? Para mudar sem quebrar, a técnica é **expand/contract**: primeiro o novo convive com o velho; só depois o velho sai.',
          'No meio do caminho, a API **avisa** quem ainda usa o velho — com cabeçalhos padronizados, não só com um post no blog.',
        ],
        board: {
          title: 'Expand/contract, Deprecation e Sunset',
          md: `Renomear \`nome\` para \`nome_completo\` sem quebrar ninguém:

\`\`\`text
 1. EXPANDIR   a API aceita e devolve "nome_completo", mantendo "nome"
 2. ANUNCIAR   respostas com "nome" ganham Deprecation, Sunset e Link
 3. MIGRAR     SDKs, documentação e clientes passam a usar "nome_completo"
 4. VERIFICAR  telemetria por cliente: alguém ainda lê ou envia "nome"?
 5. CONTRAIR   passada a data do Sunset (e com uso ≈ 0), "nome" sai
\`\`\`

Durante a expansão, a resposta carrega os dois campos — clientes antigos e novos funcionam juntos:

\`\`\`json
{
  "id": 42,
  "nome": "Ana Souza",
  "nome_completo": "Ana Souza"
}
\`\`\`

\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json
Deprecation: @1767225600
Sunset: Wed, 30 Jun 2027 23:59:59 GMT
Link: <https://api.loja.dev/docs/migracao-nome>; rel="deprecation"; type="text/html"
\`\`\`

| Cabeçalho | Diz | Formato |
|---|---|---|
| \`Deprecation\` (RFC 9745) | **desde quando** está obsoleto (mas ainda funciona!) | data estruturada: \`@\` + segundos Unix |
| \`Sunset\` (RFC 8594) | **quando** vai parar de responder | data HTTP |
| \`Link\` com \`rel="deprecation"\` | **onde** ler sobre a migração | URL |

A mesma técnica vale para **bancos de dados**: coluna nova → escrita dupla → *backfill* → leitura da nova → remoção da antiga.

> [!sabia] Antes de desligar de vez, várias empresas fazem ***brownouts***: desligam a funcionalidade obsoleta por algumas horas, em datas anunciadas. É o jeito de acordar quem não lê e-mails nem cabeçalhos — o erro aparece enquanto ainda dá tempo de migrar. O GitHub já fez isso em remoções importantes.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, **semver**: o jeito de uma versão dizer, só com números, se a mudança quebra ou não.',
          'Em APIs web você costuma expor só o MAJOR (`v1`, `v2`). Já SDKs e bibliotecas usam as três partes — e comparar versões tem pegadinhas.',
        ],
        board: {
          title: 'Semver: MAJOR.MINOR.PATCH',
          md: `\`\`\`text
   2 . 4 . 1 - rc.1 + build.77
   │   │   │    │       └─ metadados de build: IGNORADOS na comparação
   │   │   │    └───────── pré-release: vem ANTES da versão final
   │   │   └────────────── PATCH: correção compatível
   │   └────────────────── MINOR: funcionalidade nova, compatível
   └────────────────────── MAJOR: mudança INCOMPATÍVEL
\`\`\`

**Precedência** (exemplo da especificação semver 2.0.0):

\`\`\`text
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
            < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
\`\`\`

- Compare **números como números**: \`1.10.0 > 1.9.0\`, mas como texto \`"1.10.0" < "1.9.0"\`!
- Na pré-release, identificadores numéricos comparam como número (\`beta.11 > beta.2\`), os alfanuméricos em ordem ASCII, e **numérico < alfanumérico**. Se tudo empatar, a lista **mais longa** vence (\`alpha < alpha.1\`).
- \`0.y.z\` é zona livre: qualquer coisa pode mudar a qualquer momento.

\`\`\`python
>>> "1.10.0" > "1.9.0"
False                  # comparação de texto: '1' < '9'
>>> (1, 10, 0) > (1, 9, 0)
True                   # tuplas de inteiros: o jeito certo
\`\`\`

> [!sabia] No npm, \`^1.2.3\` aceita tudo até \`<2.0.0\` — mas \`^0.2.3\` só aceita até \`<0.3.0\`, porque em \`0.x\` o MINOR faz o papel do MAJOR. O circunflexo nunca deixa mudar o **primeiro número diferente de zero**.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um detector de breaking changes e um comparador semver de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-ver-q1',
        concept: "Hyrum's Law",
        say: 'Primeira: um incidente que ninguém previu.',
        prompt: 'A documentação de `GET /produtos` diz "ordem não garantida". Vocês trocaram um índice do banco, a lista passou a vir em outra ordem e o maior parceiro quebrou: o app dele mostrava sempre o **primeiro item** como "destaque". Qual conceito descreve melhor o que aconteceu?',
        options: [
          { text: "**Hyrum's Law**: com usuários suficientes, todo comportamento observável vira dependência de alguém — documentado ou não", correct: true, why: 'A ordem nunca foi prometida, mas era **observável** e estável — e isso bastou para virar contrato de fato.' },
          { text: '**Princípio de Postel**: o servidor foi liberal demais no que aceitou', why: 'Postel fala de como tratar a **entrada** recebida. Aqui o problema é o cliente depender de um detalhe da **saída**.' },
          { text: '**Tolerant Reader**: o parceiro leu a resposta de forma tolerante demais', why: 'É o contrário: um leitor tolerante **não** dependeria da ordem. O parceiro dependeu de um detalhe não prometido.' },
          { text: 'Uma breaking change comum: bastava ter publicado a mudança numa `/v2`', why: 'O contrato documentado não mudou. Criar uma versão nova para cada comportamento observável seria impossível — a lição é sobre o contrato **implícito**.' },
        ],
        explanation: "É a **Hyrum's Law**: o contrato real é o comportamento observável. Defesas: tornar a ordem **explícita** (um parâmetro `ordem=`), aleatorizar o que não é garantido (como o Go faz com maps), testes de contrato com consumidores importantes e comunicação prévia de mudanças \"invisíveis\". E, do lado do cliente, ser um *Tolerant Reader*.",
      },
      {
        type: 'order',
        id: 'api-ver-q2',
        concept: 'Expand/contract',
        say: 'Agora coloque a migração na ordem certa.',
        prompt: 'Você precisa renomear o campo `nome` para `nome_completo` sem quebrar nenhum cliente. Ordene os passos do **expand/contract**.',
        items: [
          'Expandir: a API aceita e devolve `nome_completo`, mantendo `nome` funcionando',
          'Anunciar: respostas com `nome` ganham `Deprecation`, `Sunset` e `Link` para o guia de migração',
          'Migrar: SDKs e clientes passam a usar `nome_completo`',
          'Verificar: a telemetria mostra uso zero de `nome` (e um brownout não gera reclamações)',
          'Contrair: passada a data do `Sunset`, remover `nome` do código e do contrato',
        ],
        explanation: 'Cada passo é **compatível** com o anterior: durante a expansão, clientes velhos e novos funcionam juntos. O anúncio vem quando a alternativa já existe; a remoção só acontece com **evidência** (telemetria) e depois da data prometida no `Sunset`. Pular a verificação é apostar que ninguém mais usa — e a Hyrum\'s Law diz que alguém usa.',
      },
      {
        type: 'match',
        id: 'api-ver-q3',
        concept: 'Estratégias e cabeçalhos de versionamento',
        say: 'Associe cada linha ao que ela comunica.',
        prompt: 'Associe cada **requisição ou cabeçalho** ao que ele comunica.',
        pairs: [
          { left: '`GET /v2/pedidos/42`', right: 'Versão no **caminho**: explícita, fácil de rotear e de ver nos logs' },
          { left: '`Accept: application/vnd.loja.v2+json`', right: 'Versão no **media type**, por negociação de conteúdo' },
          { left: '`X-GitHub-Api-Version: 2022-11-28`', right: 'Versão num **cabeçalho próprio**, identificada por data' },
          { left: '`Deprecation: @1767225600`', right: 'O recurso está **obsoleto** desde essa data (mas ainda funciona)' },
          { left: '`Sunset: Wed, 30 Jun 2027 23:59:59 GMT`', right: 'Data em que o recurso deve **parar de responder**' },
          { left: '`Link: <…/migracao>; rel="deprecation"`', right: 'Aponta a **documentação** da migração' },
        ],
        explanation: 'As três primeiras são **estratégias** para escolher a versão; as três últimas formam o **aviso de obsolescência**: `Deprecation` (desde quando), `Sunset` (até quando) e `Link` (como migrar). Um bom cliente registra um alerta quando vê `Deprecation` numa resposta — é o aviso chegando pelo próprio protocolo.',
      },
      {
        type: 'code',
        id: 'api-ver-q4',
        concept: 'Breaking changes',
        title: 'Detector de breaking changes',
        say: 'Hora de automatizar: um detector de breaking changes que poderia rodar no CI a cada pull request.',
        prompt: `Implemente \`detectar_quebras(antigo, novo)\`: compara dois esquemas de um endpoint e devolve a lista de mudanças **incompatíveis**, como tuplas \`(lado, campo, motivo)\` — a ordem da lista não importa.

Cada esquema é \`{"requisicao": {campo: {"tipo": str, "obrigatorio": bool}}, "resposta": {...}}\`. Um lado pode estar **ausente** (ex.: GET sem corpo): trate-o como vazio.

| Lado | Mudança | Motivo |
|---|---|---|
| \`"requisicao"\` | campo removido | \`"removido"\` |
| \`"requisicao"\` | tipo mudou | \`"tipo"\` |
| \`"requisicao"\` | campo **novo obrigatório**, ou opcional → obrigatório | \`"obrigatorio"\` |
| \`"resposta"\` | campo removido | \`"removido"\` |
| \`"resposta"\` | tipo mudou | \`"tipo"\` |
| \`"resposta"\` | obrigatório → opcional | \`"opcional"\` |

Todo o resto é compatível e **não** entra na lista. Um campo removido gera só \`"removido"\`; se um campo mudou de tipo **e** de obrigatoriedade de forma incompatível, gere as duas tuplas.`,
        starter: `def detectar_quebras(antigo, novo):
    """Devolve [(lado, campo, motivo), ...] com as mudanças incompatíveis."""
    quebras = []
    # TODO: compare a requisição e a resposta dos dois esquemas
    return quebras
`,
        tests: [
          {
            name: 'nada mudou → nenhuma quebra',
            code: PRE_VER + `v1 = esq(req={"nome": ("str", True)}, resp={"id": ("int", True), "nome": ("str", True)})
confere(v1, v1, [])`,
          },
          {
            name: 'resposta: acrescentar campos é compatível',
            code: PRE_VER + `antigo = esq(resp={"id": ("int", True)})
novo = esq(resp={"id": ("int", True), "moeda": ("str", True), "apelido": ("str", False)})
confere(antigo, novo, [])`,
          },
          {
            name: 'resposta: remover campo e mudar tipo quebram',
            code: PRE_VER + `antigo = esq(resp={"id": ("int", True), "preco": ("float", True), "nome": ("str", True)})
novo = esq(resp={"id": ("int", True), "preco": ("str", True)})
confere(antigo, novo, [("resposta", "nome", "removido"), ("resposta", "preco", "tipo")])`,
          },
          {
            name: 'resposta: obrigatório → opcional quebra; o contrário, não',
            code: PRE_VER + `antigo = esq(resp={"email": ("str", True), "fone": ("str", False)})
novo = esq(resp={"email": ("str", False), "fone": ("str", True)})
confere(antigo, novo, [("resposta", "email", "opcional")])`,
          },
          {
            name: 'requisição: campo novo obrigatório quebra; opcional, não',
            code: PRE_VER + `antigo = esq(req={"nome": ("str", True)})
novo = esq(req={"nome": ("str", True), "cpf": ("str", True), "apelido": ("str", False)})
confere(antigo, novo, [("requisicao", "cpf", "obrigatorio")])`,
          },
          {
            name: 'requisição: apertar quebra, afrouxar não',
            code: PRE_VER + `antigo = esq(req={"fone": ("str", False), "qtd": ("int", True)})
novo = esq(req={"fone": ("str", True), "qtd": ("int", False)})
confere(antigo, novo, [("requisicao", "fone", "obrigatorio")])`,
          },
          {
            name: 'requisição: remover campo e mudar tipo quebram',
            code: PRE_VER + `antigo = esq(req={"nome": ("str", True), "idade": ("int", False)})
novo = esq(req={"idade": ("str", False)})
confere(antigo, novo, [("requisicao", "nome", "removido"), ("requisicao", "idade", "tipo")])`,
          },
          {
            name: 'tipo e obrigatoriedade juntos; removido gera só "removido"',
            hidden: true,
            code: PRE_VER + `antigo = esq(req={"cep": ("int", False), "rua": ("str", True)},
             resp={"total": ("float", True), "obs": ("str", True)})
novo = esq(req={"cep": ("str", True)}, resp={"total": ("str", False)})
confere(antigo, novo, [
    ("requisicao", "cep", "tipo"), ("requisicao", "cep", "obrigatorio"), ("requisicao", "rua", "removido"),
    ("resposta", "total", "tipo"), ("resposta", "total", "opcional"), ("resposta", "obs", "removido"),
])`,
          },
          {
            name: 'lado ausente conta como vazio',
            hidden: true,
            code: PRE_VER + `so_resposta = {"resposta": {"id": {"tipo": "int", "obrigatorio": True}}}
com_corpo = {"requisicao": {"filtro": {"tipo": "str", "obrigatorio": True}},
             "resposta": {"id": {"tipo": "int", "obrigatorio": True}}}
confere(so_resposta, com_corpo, [("requisicao", "filtro", "obrigatorio")])
confere(com_corpo, so_resposta, [("requisicao", "filtro", "removido")])`,
          },
        ],
        reviews: [
          {
            when: m => m.maxComplexity > 12,
            text: 'Uma função concentrou todas as regras. Separe por lado (`_quebras_requisicao` e `_quebras_resposta`): as regras são **espelhadas** — a entrada só pode afrouxar, a saída só pode fortalecer — e ficam muito mais claras lado a lado.',
            concept: 'Coesão',
          },
          {
            when: m => m.calls.includes('dumps'),
            text: 'Comparar esquemas como texto (`json.dumps`) acusa diferença até na ordem das chaves e não diz **o que** mudou nem se quebra. Compare campo a campo, com a regra de cada lado.',
            concept: 'Breaking changes',
          },
        ],
        hints: [
          'Trate cada lado separadamente — as regras são **espelhadas**: na requisição o cliente **escreve** (só dá para afrouxar); na resposta ele **lê** (só dá para acrescentar). Use `esquema.get("requisicao", {})` para o lado ausente.',
          'Percorra os campos do esquema **antigo** para achar os removidos (`campo not in novo_lado`) e as mudanças de tipo. Na requisição, percorra também os campos do **novo**, para achar obrigatórios que surgiram.',
          'Requisição quebra se o campo agora é obrigatório e antes não era: `spec["obrigatorio"] and not (velho and velho["obrigatorio"])`. Resposta quebra se antes era obrigatório e agora não é. Campo removido: registre `"removido"` e passe para o próximo (`continue`).',
        ],
        solution: `def _quebras_requisicao(antes, depois):
    """O cliente ESCREVE a requisição: ela só pode afrouxar."""
    quebras = [("requisicao", campo, "removido") for campo in antes if campo not in depois]
    for campo, spec in depois.items():
        velho = antes.get(campo)
        if velho is not None and velho["tipo"] != spec["tipo"]:
            quebras.append(("requisicao", campo, "tipo"))
        if spec["obrigatorio"] and not (velho and velho["obrigatorio"]):
            quebras.append(("requisicao", campo, "obrigatorio"))
    return quebras


def _quebras_resposta(antes, depois):
    """O cliente LÊ a resposta: ela só pode fortalecer."""
    quebras = []
    for campo, velho in antes.items():
        spec = depois.get(campo)
        if spec is None:
            quebras.append(("resposta", campo, "removido"))
            continue
        if velho["tipo"] != spec["tipo"]:
            quebras.append(("resposta", campo, "tipo"))
        if velho["obrigatorio"] and not spec["obrigatorio"]:
            quebras.append(("resposta", campo, "opcional"))
    return quebras


def detectar_quebras(antigo, novo):
    return (_quebras_requisicao(antigo.get("requisicao", {}), novo.get("requisicao", {}))
            + _quebras_resposta(antigo.get("resposta", {}), novo.get("resposta", {})))
`,
        solutionExplanation: 'A solução separa os dois lados porque as regras são **espelhadas**, como no Princípio de Liskov: a requisição (entrada) só pode afrouxar — quebra ao remover, mudar tipo ou exigir algo novo; a resposta (saída) só pode fortalecer — quebra ao remover, mudar tipo ou deixar de garantir um campo. Acrescentar na resposta e tornar opcional na requisição passam em silêncio. Ferramentas reais fazem exatamente isso sobre especificações OpenAPI (como o *oasdiff*) e rodam no CI para barrar uma breaking change sem bump de MAJOR.',
      },
      {
        type: 'code',
        id: 'api-ver-q5',
        concept: 'Semver',
        title: 'Comparador semver',
        say: 'Agora o semver: comparar versões parece trivial até aparecer a primeira pré-release.',
        prompt: `Implemente \`comparar_semver(a, b)\`, que devolve **-1** se \`a\` tem precedência menor que \`b\`, **0** se empatam e **1** se \`a\` é maior — seguindo o semver 2.0.0:

- \`MAJOR.MINOR.PATCH\` são comparados **numericamente**, nessa ordem.
- A pré-release (\`-alpha.1\`) tem precedência **menor** que a versão final. Entre duas pré-releases, compare identificador a identificador (separados por \`.\`): numéricos como números, alfanuméricos em ordem ASCII, e numérico **<** alfanumérico; se todos empatarem e um lado acabar antes, o mais curto é menor.
- Os metadados de build (\`+build.7\`) são **ignorados**.
- Se o núcleo não tiver exatamente três números (\`"1.2"\`, \`"1.x.0"\`), lance \`ValueError\`.`,
        starter: `def comparar_semver(a, b):
    """-1 se a < b, 0 se empatam, 1 se a > b (precedência do semver 2.0.0)."""
    # TODO
    pass
`,
        tests: [
          { name: 'versões iguais', expr: 'comparar_semver("1.2.3", "1.2.3")', expected: '0' },
          { name: 'números comparam como números, não como texto', expr: 'comparar_semver("1.10.0", "1.9.0")', expected: '1' },
          { name: 'MAJOR decide primeiro', expr: 'comparar_semver("2.0.0", "10.0.0")', expected: '-1' },
          { name: 'pré-release vem antes da versão final', expr: 'comparar_semver("1.0.0-rc.1", "1.0.0")', expected: '-1' },
          { name: 'identificador numérico da pré-release compara como número', expr: 'comparar_semver("1.0.0-beta.11", "1.0.0-beta.2")', expected: '1' },
          { name: 'empate no prefixo: a lista mais longa vence', expr: 'comparar_semver("1.0.0-alpha", "1.0.0-alpha.1")', expected: '-1' },
          { name: 'numérico < alfanumérico', expr: 'comparar_semver("1.0.0-alpha.1", "1.0.0-alpha.beta")', expected: '-1' },
          { name: 'metadados de build são ignorados', expr: 'comparar_semver("1.0.0+build.9", "1.0.0+build.10")', expected: '0' },
          {
            name: 'ordena a cadeia da especificação',
            hidden: true,
            code: `from functools import cmp_to_key
cadeia = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2",
          "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.0.1", "1.1.0", "2.0.0"]
baguncada = cadeia[5:] + cadeia[:5]
baguncada.reverse()
ordenada = sorted(baguncada, key=cmp_to_key(comparar_semver))
assert ordenada == cadeia, f"ordenação obtida: {ordenada}"
assert comparar_semver("1.0.0", "1.0.0-rc.1") == 1, "a comparação precisa ser simétrica"
assert comparar_semver("1.0.0-rc.1+build.5", "1.0.0-rc.1") == 0, "build é ignorado também com pré-release"`,
          },
          {
            name: 'núcleo inválido lança ValueError',
            hidden: true,
            code: `for ruim in ("1.2", "1.x.0", "1.2.3.4", ""):
    try:
        comparar_semver(ruim, "1.0.0")
        assert False, f"{ruim!r} não é semver válido: deveria lançar ValueError"
    except ValueError:
        pass`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('packaging') || m.imports.includes('distutils'),
            text: 'O `distutils` foi removido no Python 3.12, e o `packaging.version` segue a **PEP 440**, não o semver: ele normaliza `1.0.0-rc.1` para `1.0.0rc1` e tem regras próprias de pré-release. Para semver, implemente a regra (ou use uma biblioteca de semver de verdade).',
            concept: 'Semver × PEP 440',
          },
          {
            when: m => m.maxComplexity > 12,
            text: 'Muitos `if`s encadeados. Experimente transformar cada versão numa **chave** — `((major, minor, patch), marcador_da_pre_release)` — e deixe a comparação de tuplas do Python aplicar as regras. A mesma chave serve direto no `sorted(..., key=...)`.',
            concept: 'Chave de ordenação',
          },
        ],
        hints: [
          'Transforme cada versão numa **chave comparável**: descarte o build (`split("+")[0]`), separe a pré-release na **primeira** `-` (`partition("-")`) e converta o núcleo em `(int, int, int)` — validando que são três partes numéricas.',
          'Para a versão final vir **depois** de qualquer pré-release, dê a ela um marcador maior: por exemplo, `(1,)` para "sem pré-release" e `(0, identificadores)` para "com pré-release".',
          'Cada identificador da pré-release vira uma tupla: numérico → `(0, int(x), "")`, alfanumérico → `(1, 0, x)`. A comparação de tuplas faz o resto — inclusive "a lista mais curta é menor". No fim: `(ka > kb) - (ka < kb)`.',
        ],
        solution: `def _chave(versao):
    sem_build = versao.split("+", 1)[0]
    nucleo, _, pre = sem_build.partition("-")
    partes = nucleo.split(".")
    if len(partes) != 3 or not all(p.isdigit() for p in partes):
        raise ValueError(f"versão semver inválida: {versao!r}")
    numeros = tuple(int(p) for p in partes)
    if not pre:
        return numeros, (1,)                      # versão final: depois de qualquer pré-release
    ids = tuple((0, int(i), "") if i.isdigit() else (1, 0, i) for i in pre.split("."))
    return numeros, (0, ids)                      # numérico < alfanumérico; mais curta < mais longa


def comparar_semver(a, b):
    ka, kb = _chave(a), _chave(b)
    return (ka > kb) - (ka < kb)
`,
        solutionExplanation: 'Em vez de um emaranhado de `if`s, cada versão vira uma **chave** de tuplas, e a comparação de tuplas do Python aplica as regras: o núcleo vira `(major, minor, patch)`; a versão final ganha `(1,)` e as pré-releases `(0, ...)`, então qualquer pré-release fica antes; identificadores numéricos viram `(0, n, "")` e alfanuméricos `(1, 0, s)`, garantindo número < texto; e, com prefixo empatado, a tupla mais curta perde — exatamente "alpha < alpha.1". O build é descartado logo no início. Com a chave pronta, `sorted(versoes, key=_chave)` funciona direto, sem `cmp_to_key`.',
      },
      {
        type: 'open',
        id: 'api-ver-q6',
        concept: 'Tolerant Reader',
        say: 'Última: um parceiro irritado na sua caixa de entrada. Quem tem razão?',
        prompt: "Um deploy do servidor só **acrescentou** o campo `moeda` na resposta de `GET /pedidos`. No dia seguinte, o app de um parceiro começou a falhar com `TypeError: Pedido.__init__() got an unexpected keyword argument 'moeda'` — o código dele faz `Pedido(**resposta.json())`. O parceiro diz que vocês quebraram o contrato. Quem tem razão? O que você mudaria no cliente — e o que o servidor pode fazer para diminuir esse risco?",
        minWords: 40,
        rubric: [
          { label: 'Reconhece que acrescentar campo é **compatível**: o cliente é que não era um **leitor tolerante**', keywords: ['tolerant', 'tolerante', 'ignor', 'desconhecid', 'compativel', 'nao quebrou o contrato', 'nao e breaking', 'nao e uma breaking'], concept: 'Tolerant Reader', why: 'Pelo contrato, acrescentar na resposta é compatível; o `**` transformou qualquer campo novo em erro.' },
          { label: "Cita a **Hyrum's Law**: na prática, todo comportamento observável vira contrato", keywords: ['hyrum', 'comportamento observavel', 'comportamentos observaveis', 'todo comportamento', 'contrato implicito', 'contrato de fato', 'contrato real'], concept: "Hyrum's Law", why: 'Mesmo sem culpa formal, o provedor precisa contar com clientes que dependem de detalhes — é por isso que "compatível" não significa "sem risco".' },
          { label: 'Corrige o cliente: extrair **só os campos usados**, sem `**dados`', keywords: ['so os campos', 'somente os campos', 'apenas os campos', 'campos que usa', 'campos que precisa', 'campos necessarios', 'explicit', 'extrair', 'extraia', 'from_dict', 'mapear', 'mapeamento', 'filtrar os campos', 'filtrar as chaves'], concept: 'Tolerant Reader', why: 'Ler explicitamente os campos usados (e ignorar o resto) torna o cliente imune a acréscimos.' },
          { label: 'Do lado do servidor: comunicar e testar com os consumidores (changelog, testes de contrato, SDK, sandbox)', keywords: ['changelog', 'release notes', 'avisar', 'aviso previo', 'comunicar', 'comunicacao', 'contract test', 'teste de contrato', 'testes de contrato', 'pact', 'sdk', 'sandbox', 'consumer-driven', 'orientado ao consumidor', 'preview'], concept: 'Evolução de APIs', why: 'Aviso prévio, ambiente de testes e testes de contrato transformam uma surpresa em produção num alerta antes do deploy.' },
        ],
        modelAnswer: `Pelo contrato, o parceiro **não** tem razão: acrescentar um campo na resposta é uma mudança **compatível**. O cliente quebrou porque não era um **leitor tolerante** — o \`Pedido(**dados)\` transforma qualquer campo novo em \`TypeError\`. Mas, na prática, é a **Hyrum's Law** em ação: com clientes suficientes, todo comportamento observável — até "a resposta tem exatamente estes campos" — vira contrato de fato, e o provedor precisa contar com isso.

No cliente: extrair **só os campos que usa** (\`Pedido(id=dados["id"], total=dados["total"])\` ou um \`from_dict\` explícito), ignorar campos desconhecidos e tratar valores novos de enum com um \`case\` genérico.

No servidor: documentar desde o início que campos novos podem aparecer a qualquer momento; publicar changelog com aviso prévio; oferecer um ambiente de sandbox e um SDK oficial (que já nasce tolerante); e rodar **testes de contrato** orientados ao consumidor (ex.: Pact) com os parceiros mais importantes, para descobrir essas dependências antes do deploy.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você evolui uma API como quem mexe no motor com o carro andando — sem derrubar ninguém.',
          { text: 'Resumo: resposta só acrescenta, requisição só afrouxa, leitores tolerantes, expand/contract com Deprecation e Sunset — e nunca compare versões como texto.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
