Game.registerModule('apis', {
  id: 'gateway-contratos',
  title: 'API Gateway, BFF e Contratos',
  kind: 'lesson',
  level: 2,
  order: 41,
  unit: 'arquitetura',
  summary: 'Quem fica na porta da arquitetura e como os serviços combinam o que vão conversar: API gateway, BFF, service mesh com sidecars, correlation ID de ponta a ponta, OpenAPI como contrato e contract testing guiado pelo consumidor.',
  concepts: ['API gateway', 'BFF', 'Service mesh', 'Correlation ID', 'Contract testing'],
  takeaways: [
    'O **API gateway** concentra o que é transversal na borda — autenticação, rate limit, roteamento, agregação — e deve continuar **burro**: regra de negócio no gateway recria o velho ESB.',
    'Um **BFF** (*Backend for Frontend*) é um backend **por experiência** (app, site), mantido pelo time daquela interface: agrega chamadas e molda a resposta para a tela — e fica **fino**.',
    'O **service mesh** cuida do tráfego **leste-oeste** (serviço ↔ serviço) com proxies **sidecar**: mTLS, retries e métricas sem mudar o código. O gateway cuida do **norte-sul**.',
    'Gere o **correlation ID** na borda (ou aceite o do cliente, **validado**), guarde-o em `contextvars`, carimbe em todo log, **propague** em toda chamada e devolva na resposta.',
    '**OpenAPI** descreve o contrato; **contract testing** guiado pelo consumidor (Pact) prova, antes do deploy, que o provedor ainda entrega o que cada consumidor **usa**.',
  ],
  glossary: [
    { term: 'API gateway', aliases: ['API gateways', 'gateway de API', 'gateways de API'], definition: 'Ponto de entrada único na borda da arquitetura: recebe as requisições de fora, aplica o que é transversal (autenticação, rate limiting, TLS, CORS) e as roteia para os serviços internos — às vezes agregando várias chamadas numa resposta só.' },
    { term: 'BFF', aliases: ['BFFs', 'Backend for Frontend', 'Backends for Frontends', 'backend para o front'], definition: '*Backend for Frontend*: cada experiência de usuário (app, site, TV) ganha o **seu próprio** backend fino, mantido pelo time daquela interface, que agrega e adapta as APIs internas ao que a tela precisa.' },
    { term: 'Service mesh', aliases: ['service meshes', 'malha de serviços', 'malha de servicos'], definition: 'Camada de infraestrutura para a comunicação **entre serviços**: proxies ao lado de cada instância (plano de dados) aplicam mTLS, timeouts e retries e coletam métricas, configurados por um plano de controle central. Ex.: Istio, Linkerd.' },
    { term: 'Sidecar', aliases: ['sidecars', 'proxy sidecar'], definition: 'Processo auxiliar implantado **junto** de cada instância do serviço (no mesmo pod, no Kubernetes). Como proxy, intercepta o tráfego de entrada e saída e adiciona TLS, retries e telemetria sem mudar o código da aplicação.' },
    { term: 'Correlation ID', aliases: ['correlation IDs', 'X-Request-ID', 'request ID', 'ID de correlação', 'id de correlacao'], definition: 'Identificador único de uma requisição, gerado na borda e **propagado** em cada chamada entre serviços e em cada linha de log. Com ele dá para reconstruir tudo o que aconteceu com aquela requisição — e o cliente pode citá-lo ao suporte.' },
    { term: 'OpenAPI', aliases: ['OpenAPI Specification', 'Swagger', 'especificação OpenAPI', 'especificacao OpenAPI'], definition: 'Formato padrão (JSON ou YAML) para descrever APIs HTTP: caminhos, parâmetros, corpos e respostas, com schemas em JSON Schema. Vira contrato legível por máquina: documentação, geração de clientes, mocks, lint e detecção de breaking changes.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto é a **porta de entrada** da arquitetura — e como vários serviços combinam o que vão conversar sem quebrar uns aos outros.',
        'Imagine 20 microsserviços e um app chamando cada um direto. Quem valida o token? Quem barra abuso? Quem sabe onde mora cada rota?',
      ],
      board: {
        title: 'O problema: todo mundo expondo tudo',
        md: `\`\`\`text
 SEM gateway                              COM gateway
 app ──▶ pedidos   (auth? cota?)          app ──▶ ┌─────────────┐ ──▶ pedidos
 app ──▶ usuarios  (auth? cota?)                  │ API gateway │ ──▶ usuarios
 app ──▶ estoque   (auth? CORS?)                  │ auth · 429  │ ──▶ estoque
 app ──▶ frete     (auth? TLS?)                   │ rotas · TLS │ ──▶ frete
                                                  └─────────────┘
 cada serviço reimplementa o transversal  o transversal mora num lugar só
\`\`\`

| Responsabilidade | O que o gateway faz |
|---|---|
| **Autenticação** | valida o token ou a API key **uma vez**, na borda → \`401\` |
| **Rate limiting** | cota por cliente → \`429\` + \`Retry-After\` |
| **Roteamento** | \`/pedidos/*\` → serviço de pedidos; 5% do tráfego para a versão nova (*canary*) |
| **Protocolo** | termina TLS, aplica CORS, comprime respostas |
| **Agregação** | uma chamada do cliente vira várias internas, com a resposta combinada |
| **Observabilidade** | gera o *correlation ID*, mede latência e erros por rota |

Exemplos: Kong, NGINX, Envoy Gateway, AWS API Gateway, Apigee.

> [!dica] Tráfego **norte-sul** é o que entra de fora (cliente → sistema): território do gateway. O tráfego **leste-oeste** (serviço ↔ serviço) a gente vê daqui a pouco.`,
      },
    },
    {
      type: 'say',
      text: [
        'Por dentro, um gateway é uma **cadeia de filtros**: cada etapa pode barrar a requisição ou enriquecê-la antes de repassar.',
        'E uma regra de ouro: o gateway é **burro de propósito**. Protocolo e política, sim; regra de negócio, nunca.',
      ],
      board: {
        title: 'Por dentro de um gateway',
        md: `\`\`\`python
ROTAS = {"/pedidos": "http://pedidos:8080", "/usuarios": "http://usuarios:8080"}

def gateway(req):
    usuario = autenticar(req.headers.get("Authorization"))   # None se inválido
    if usuario is None:
        return Resposta(401)
    if not limitador.permitir(usuario):                       # cota por cliente
        return Resposta(429, headers={"Retry-After": "1"})
    destino = next((url for prefixo, url in ROTAS.items()
                    if req.path.startswith(prefixo)), None)
    if destino is None:
        return Resposta(404)
    headers = {k: v for k, v in req.headers.items() if k.lower() != "x-user-id"}
    headers["X-User-Id"] = usuario        # só o gateway escreve esse cabeçalho
    return encaminhar(destino, req.path, headers, req.body)
\`\`\`

Chega do cliente — com um cabeçalho forjado:

\`\`\`http
GET /pedidos/42 HTTP/1.1
Host: api.loja.dev
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
X-User-Id: admin
\`\`\`

Sai do gateway para o serviço interno:

\`\`\`http
GET /pedidos/42 HTTP/1.1
Host: pedidos:8080
X-User-Id: u_381
X-Request-ID: 7f3c9a1e-5b2d-4c8e-9f10-2a6b8d4e1c35
\`\`\`

> [!atencao] Se o gateway repassa a identidade num cabeçalho, ele precisa **apagar** o que o cliente mandou com o mesmo nome — senão qualquer um vira \`admin\` com um \`curl\`. E os serviços internos só devem aceitar tráfego vindo do gateway (rede privada ou mTLS).

> [!sabia] Gateway que acumula regra de negócio, orquestração e transformações virou antipadrão com nome: o *Technology Radar* da Thoughtworks colocou os **overambitious API gateways** em **Hold** ("evite"). É o ESB de volta — o oposto de *smart endpoints and dumb pipes*, o lema do artigo de Lewis e Fowler sobre microsserviços.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora um problema de **front**: a tela inicial do app precisa de perfil, pedidos e recomendações. São três idas e voltas no 4G — e cada resposta traz campos que a tela nem usa.',
        'Dá para **agregar** no gateway… ou dar a cada experiência o seu próprio backend: o **BFF**, *Backend for Frontend*.',
      ],
      board: {
        title: 'Agregação e Backend for Frontend (BFF)',
        md: `\`\`\`text
               ┌─ BFF web ─── time do site ──┐        ┌─▶ perfil
 navegador ───▶│ página rica, muitos campos  │───┐    ├─▶ pedidos
               └─────────────────────────────┘   ├───▶├─▶ recomendações
               ┌─ BFF mobile ── time do app ─┐   │    └─▶ estoque
 app ─────────▶│ payload enxuto, 1 chamada   │───┘
               └─────────────────────────────┘
\`\`\`

\`\`\`python
import asyncio

async def home_mobile(usuario_id):
    """BFF do app: 1 chamada do celular → 3 chamadas internas em paralelo."""
    perfil, pedidos, recos = await asyncio.gather(
        buscar_perfil(usuario_id),
        buscar_pedidos(usuario_id, limite=3),
        buscar_recomendacoes(usuario_id),
        return_exceptions=True,
    )
    if isinstance(perfil, Exception):
        raise perfil                               # sem perfil não há tela
    return {
        "nome": perfil["nome"].split()[0],         # o app só mostra o primeiro nome
        "pedidos": [] if isinstance(pedidos, Exception) else [p["id"] for p in pedidos],
        "recomendacoes": [] if isinstance(recos, Exception) else recos[:5],
    }
\`\`\`

| | Gateway genérico com agregação | **BFF** (um por experiência) |
|---|---|---|
| Quem mantém | time de plataforma | o **time da interface** que o usa |
| Formato da resposta | igual para todos os clientes | sob medida para cada tela |
| Risco | virar a fila de todos os times | duplicar lógica entre BFFs |

> [!sabia] O termo **BFF** nasceu na SoundCloud (Phil Calçado descreveu o padrão por lá) e foi popularizado por Sam Newman em 2015. A regra dele: **um BFF por experiência** de usuário, mantido pelo **mesmo time** da interface. Regra de negócio compartilhada desce para os serviços; o BFF fica **fino**.

> [!dica] GraphQL ataca parte do mesmo problema (o cliente escolhe os campos) — não é raro ver um servidor GraphQL fazendo o papel de BFF.`,
      },
    },
    {
      type: 'say',
      text: [
        'E lá dentro, entre os serviços? Cada chamada interna também precisa de TLS, timeout, retry e métricas.',
        'Em vez de repetir isso em cada linguagem, o **service mesh** põe um proxy — o **sidecar** — ao lado de cada instância. O código nem fica sabendo.',
      ],
      board: {
        title: 'Service mesh e sidecars (conceito)',
        md: `\`\`\`text
          ┌────────── plano de controle (Istio, Linkerd…) ──────────┐
          │  distribui configuração, políticas e certificados       │
          └──────────────┬──────────────────────────┬───────────────┘
                         ▼                          ▼
 ┌─ pod "pedidos" ──────────────┐        ┌─ pod "estoque" ──────────────┐
 │  app ⇄ sidecar ══════════════╪══mTLS══╪══▶ sidecar ⇄ app             │
 └──────────────────────────────┘        └──────────────────────────────┘
       plano de dados: os proxies (ex.: Envoy) no caminho de cada chamada
\`\`\`

| | API gateway | Service mesh | Biblioteca no código |
|---|---|---|---|
| Tráfego | **norte-sul** (de fora para dentro) | **leste-oeste** (serviço ↔ serviço) | o que o serviço chama |
| Onde roda | na borda | um proxy por instância | dentro do processo |
| Oferece | auth, cotas, rotas | mTLS, retries, timeouts, métricas, canary | o que você programar |
| Exemplos | Kong, AWS API Gateway, Apigee | Istio, Linkerd | tenacity, pybreaker |

**Custos:** um salto de proxy **em cada ponta** da chamada (latência), CPU e memória por pod, e mais um sistema distribuído para operar. Com cinco serviços numa linguagem só, uma boa biblioteca costuma bastar.

> [!atencao] Retry no mesh **e** retry no código se multiplicam: 3 tentativas × 3 tentativas = 9 chamadas para uma dependência que já está sofrendo. Escolha **uma** camada dona dos retries.

> [!sabia] O sidecar deixou de ser obrigatório: o **modo ambient** do Istio (estável desde 2024) usa um proxy por **nó** (o *ztunnel*) para o mTLS e só acrescenta proxies L7 (*waypoints*) onde você precisa — menos memória e nada de reiniciar pods para entrar na malha.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Uma requisição falha no quarto serviço da cadeia. Você tem logs de quatro serviços, milhares de linhas por segundo. Como achar as linhas **daquela** requisição?',
        'Com um **correlation ID**: gerado na borda, carimbado em todo log, **propagado** em toda chamada — e devolvido ao cliente.',
      ],
      board: {
        title: 'Correlation ID: o fio da meada',
        md: `\`\`\`text
 cliente ──▶ gateway ─────────────▶ pedidos ─────────────▶ estoque
             gera 7f3c…             loga [7f3c…]           loga [7f3c…]
             X-Request-ID: 7f3c… ──▶ X-Request-ID: 7f3c… ──▶
 ◀── resposta com X-Request-ID: 7f3c…   → "informe este código ao suporte"
\`\`\`

1. **Na borda:** aceite o \`X-Request-ID\` do cliente só se for **válido** (tamanho e caracteres limitados); senão, gere um novo (UUID).
2. **Em cada serviço:** guarde o ID no **contexto** da requisição e coloque-o em **toda** linha de log.
3. **Em cada chamada de saída:** repasse o cabeçalho — mensagens em filas também levam o ID.
4. **Na resposta:** devolva o ID; o cliente cita no chamado de suporte.

\`\`\`python
import contextvars
import logging

request_id = contextvars.ContextVar("request_id", default="-")

class ComRequestId(logging.Filter):
    """Carimba o ID da requisição atual em toda linha de log."""
    def filter(self, registro):
        registro.request_id = request_id.get()
        return True

# formato: "%(asctime)s %(levelname)s [%(request_id)s] %(message)s"
\`\`\`

Por que \`contextvars\` e não uma variável global? Com \`asyncio\`, **centenas** de requisições se intercalam no mesmo thread: uma global seria sobrescrita no meio do caminho. Cada tarefa enxerga a **sua** cópia do contexto.

> [!atencao] Não confie cegamente no ID que vem de fora: um valor com \`\\n\` forja linhas no seu log (*log injection*) e um valor gigante incha cada linha. Valide o valor **inteiro** — em Python, com \`re.fullmatch\`.

> [!dica] Correlation ID × *trace ID*: com OpenTelemetry, o cabeçalho W3C \`traceparent\` (\`00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\`) propaga o ID do trace e a árvore de spans. O \`X-Request-ID\` continua útil como identificador **simples e humano**. A trilha de observabilidade aprofunda o tracing.`,
      },
    },
    {
      type: 'say',
      text: [
        'Agora, **contratos**. Se o time de pedidos muda um campo, como os consumidores ficam sabendo — antes de quebrar em produção?',
        'O primeiro passo é ter o contrato escrito num formato que **máquinas** leem: o **OpenAPI**.',
      ],
      board: {
        title: 'OpenAPI: o contrato legível por máquina',
        md: `\`\`\`json
{
  "openapi": "3.1.0",
  "info": { "title": "Pedidos", "version": "1.4.0" },
  "paths": {
    "/pedidos/{id}": {
      "get": {
        "responses": {
          "200": {
            "description": "O pedido",
            "content": { "application/json": { "schema": {
              "type": "object",
              "required": ["id", "status", "total_centavos"],
              "properties": {
                "id": { "type": "integer" },
                "status": { "type": "string", "enum": ["pendente", "pago", "enviado"] },
                "total_centavos": { "type": "integer" },
                "cupom": { "type": ["string", "null"] }
              }
            } } }
          },
          "404": { "description": "Pedido não encontrado" }
        }
      }
    }
  }
}
\`\`\`

| Com o contrato em mãos você ganha… | Ferramentas |
|---|---|
| Documentação navegável | Swagger UI, Redoc |
| Clientes e *stubs* de servidor gerados | openapi-generator |
| Mock para o front trabalhar antes do back | Prism |
| Lint de estilo (nomes, paginação, erros) | Spectral |
| Detecção de **breaking changes** no CI | oasdiff |
| Testes gerados a partir do schema (em Python) | Schemathesis |

**Contract-first** (escreve o contrato, depois o código) favorece a conversa entre times; **code-first** (o contrato é gerado do código, como no FastAPI) evita que os dois divirjam. Nos dois casos, o inimigo é o **drift**: a documentação diz uma coisa e a API faz outra.

> [!atencao] **Obrigatório ≠ anulável.** No exemplo, \`cupom\` é **opcional** (fora de \`required\`: pode faltar) e **anulável** (\`"null"\` no tipo: pode vir \`null\`). São eixos independentes — confundir os dois é fonte clássica de quebra entre cliente e servidor.`,
      },
    },
    {
      type: 'say',
      text: [
        'Contrato escrito não é contrato cumprido. Testes ponta a ponta pegariam a quebra — mas são lentos, frágeis e exigem subir tudo.',
        'O **contract testing guiado pelo consumidor** inverte a conversa: cada consumidor declara **o que usa**, e o provedor prova que continua entregando.',
      ],
      board: {
        title: 'Contract testing guiado pelo consumidor (Pact)',
        md: `\`\`\`text
 CONSUMIDOR (app)                  PACT BROKER                  PROVEDOR (pedidos)
 1. teste contra o mock do Pact
 2. gera o contrato (pact) ──────▶ 3. guarda por versão ──────▶ 4. reproduz cada interação
                                                                   contra o serviço real
                                   5. resultado ◀────────────────
 6. can-i-deploy? ◀────────────── matriz de compatibilidade
\`\`\`

O contrato gerado pelo consumidor (simplificado):

\`\`\`json
{
  "consumer": { "name": "app-mobile" },
  "provider": { "name": "pedidos" },
  "interactions": [{
    "description": "busca um pedido existente",
    "providerState": "existe o pedido 42",
    "request": { "method": "GET", "path": "/pedidos/42" },
    "response": { "status": 200, "body": { "id": 42, "status": "pago" } }
  }]
}
\`\`\`

Repare: o app só declarou \`id\` e \`status\`. O provedor pode **acrescentar** campos ou mudar \`total_centavos\` à vontade — o build só quebra se ele tirar ou alterar algo que **algum** consumidor usa.

| | Ponta a ponta | Validação por schema | Contract testing (CDC) |
|---|---|---|---|
| Pega | o fluxo inteiro | resposta fora do OpenAPI | quebra de algo que um consumidor **usa** |
| Custo | alto, lento, instável | baixo | baixo |
| Sabe quem usa o quê? | não | não | **sim** |

> [!sabia] O padrão foi descrito por Ian Robinson em *Consumer-Driven Contracts: A Service Evolution Pattern* (2006). No Pact, o comando **\`can-i-deploy\`** consulta a matriz "versão do consumidor × versão do provedor" e barra o deploy de quem quebraria alguém que já está em produção.

> [!atencao] Contrato testa a **conversa**, não a regra de negócio do provedor. Se o pact começa a conferir cálculo de frete, ele virou um teste funcional frágil no lugar errado.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um middleware de correlation ID e um validador de contrato.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'api-gw-q1',
      concept: 'Responsabilidades do API gateway',
      say: 'Primeira: uma proposta que aparece em toda empresa. O que você responde?',
      prompt: 'O time de pedidos quer implementar **no API gateway** a regra "clientes VIP têm frete grátis", porque "o gateway já vê todas as requisições e já decodificou o token". Qual a melhor resposta numa revisão de arquitetura?',
      options: [
        { text: 'Não: regra de negócio fica no serviço dono do conceito. O gateway cuida do que é transversal (autenticação, cotas, roteamento); lógica de domínio ali vira acoplamento central que todos os times precisam alterar e implantar.', correct: true, why: 'É o antipadrão *overambitious API gateway*: o componente mais crítico da borda passa a mudar a cada regra de negócio, longe dos testes e do time que entende de frete.' },
        { text: 'Sim: centralizar no gateway evita duplicar a regra em cada serviço.', why: 'A duplicação se resolve colocando a regra no serviço **dono** (frete ou preço), não na borda. No gateway, todo ajuste de regra passa a exigir deploy do componente por onde passa todo o tráfego.' },
        { text: 'Sim, desde que seja um plugin do gateway, isolado num arquivo próprio.', why: 'Organizar o código não muda o problema: a regra continua executando no ponto único de falha, fora do serviço que entende de frete e sem os testes de domínio dele.' },
        { text: 'Não: o certo é colocar a regra no service mesh, que roda perto de cada serviço.', why: 'O mesh é infraestrutura de rede (mTLS, retries, telemetria) e nem enxerga o domínio. Regra de negócio num proxy é ainda mais difícil de testar e versionar.' },
      ],
      explanation: 'O gateway resolve o que é **igual para todas as rotas** — autenticação, cotas, roteamento, TLS, correlation ID. Regra de negócio mora no **serviço dono** do conceito, com seus testes e seu ciclo de deploy. Gateway que acumula lógica, orquestração e transformações vira gargalo organizacional (todo time precisa mexer nele) e ponto único de falha — o velho ESB com roupa nova. O lema dos microsserviços é o contrário: *smart endpoints and dumb pipes*.',
    },
    {
      type: 'match',
      id: 'api-gw-q2',
      concept: 'Peças da arquitetura de integração',
      say: 'Hora de organizar as peças. Associe cada uma à sua função.',
      prompt: 'Associe cada peça à sua **função**.',
      pairs: [
        { left: 'API gateway', right: 'Porta de entrada única: autenticação, cotas e roteamento na borda' },
        { left: 'BFF', right: 'Backend fino dedicado a uma experiência, mantido pelo time da interface' },
        { left: 'Service mesh', right: 'Proxies ao lado de cada serviço cuidando de mTLS, retries e métricas' },
        { left: 'Correlation ID', right: 'Identificador que acompanha a requisição por todos os serviços e logs' },
        { left: 'OpenAPI', right: 'Descrição dos endpoints e schemas legível por máquina' },
        { left: 'Contract testing', right: 'Provar que o provedor ainda entrega o que cada consumidor usa' },
      ],
      explanation: 'Elas se complementam: o **gateway** guarda a porta (norte-sul), o **BFF** adapta a resposta a cada tela, o **mesh** cuida do corredor entre serviços (leste-oeste), o **correlation ID** costura os logs de tudo isso, o **OpenAPI** descreve o contrato e o **contract testing** prova que ele continua sendo cumprido.',
    },
    {
      type: 'code',
      id: 'api-gw-q3',
      concept: 'Correlation ID',
      title: 'Middleware de correlation ID',
      say: 'Agora, código: o middleware de correlation ID. É pequeno, mas cheio de detalhes que aparecem em produção.',
      prompt: `Uma requisição é um dict \`{"path": ..., "headers": {...}}\`; uma resposta, \`{"status": ..., "headers": {...}, "body": ...}\`; um **handler** é uma função \`handler(req) -> resp\`.

**\`com_request_id(handler, gerar_id)\`** devolve um novo handler que:

1. Lê o \`X-Request-ID\` da requisição — o **nome** do cabeçalho não diferencia maiúsculas (\`x-request-id\` também vale). Se o valor for **válido** (1 a 64 caracteres, só letras ASCII, dígitos, \`.\`, \`_\` e \`-\`), usa esse; senão, chama \`gerar_id()\` — **só** nesse caso.
2. Chama o handler com uma **cópia** da requisição em que o cabeçalho aparece uma única vez, com a grafia \`X-Request-ID\`. A requisição original não pode mudar.
3. Enquanto o handler roda, \`request_id_atual.get()\` devolve o ID; depois — **mesmo se o handler lançar exceção** — o contexto volta ao valor anterior.
4. Devolve a resposta do handler com \`X-Request-ID\` nos cabeçalhos, sem apagar os outros.

**\`chamar(handler, req)\`** faz uma chamada de saída: se houver um ID atual, chama o handler com uma cópia de \`req\` levando esse \`X-Request-ID\`; senão, repassa \`req\` como está.`,
      starter: `import contextvars
import re

HEADER = "X-Request-ID"
request_id_atual = contextvars.ContextVar("request_id_atual", default=None)


def com_request_id(handler, gerar_id):
    """Middleware: garante um X-Request-ID válido e o deixa no contexto."""
    def envolvido(req):
        # TODO
        pass
    return envolvido


def chamar(handler, req):
    """Chamada de saída: propaga o ID atual."""
    # TODO
    pass
`,
      tests: [
        {
          name: 'gera um ID quando a requisição não traz',
          code: `def eco(req):
    return {"status": 200, "headers": {"Content-Type": "application/json"},
            "body": {"recebidos": dict(req["headers"]), "rid": request_id_atual.get()}}
app = com_request_id(eco, lambda: "gerado-1")
resp = app({"path": "/pedidos", "headers": {}})
assert resp["body"]["recebidos"].get("X-Request-ID") == "gerado-1", f"o handler deveria receber o X-Request-ID gerado; recebeu {resp['body']['recebidos']}"
assert resp["body"]["rid"] == "gerado-1", "durante o handler, request_id_atual.get() deveria devolver o ID"
assert resp["headers"].get("X-Request-ID") == "gerado-1", "a resposta deveria levar o X-Request-ID"
assert resp["headers"].get("Content-Type") == "application/json", "não apague os outros cabeçalhos da resposta"`,
        },
        {
          name: 'reaproveita um ID válido do cliente (sem chamar gerar_id)',
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": {"recebidos": dict(req["headers"]), "rid": request_id_atual.get()}}
def gerar():
    raise AssertionError("gerar_id() não deveria ser chamado: o cliente mandou um ID válido")
app = com_request_id(eco, gerar)
resp = app({"path": "/", "headers": {"X-Request-ID": "abc-123", "Accept": "application/json"}})
assert resp["body"]["rid"] == "abc-123", f"deveria reaproveitar o ID do cliente, veio {resp['body']['rid']!r}"
assert resp["body"]["recebidos"] == {"X-Request-ID": "abc-123", "Accept": "application/json"}, f"o handler recebeu {resp['body']['recebidos']}"
assert resp["headers"]["X-Request-ID"] == "abc-123"`,
        },
        {
          name: 'o nome do cabeçalho não diferencia maiúsculas',
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": dict(req["headers"])}
app = com_request_id(eco, lambda: "gerado-1")
resp = app({"path": "/", "headers": {"x-request-id": "abc-123"}})
assert resp["body"] == {"X-Request-ID": "abc-123"}, f"o handler deveria receber só 'X-Request-ID' (grafia canônica) com o ID do cliente; recebeu {resp['body']}"
assert resp["headers"]["X-Request-ID"] == "abc-123"`,
        },
        {
          name: 'IDs inválidos são trocados por um novo',
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": None}
for ruim in ["", "a" * 65, "abc def", "abc\\nINFO pagamento aprovado", "ação-1", "id;DROP"]:
    app = com_request_id(eco, lambda: "novo")
    resp = app({"path": "/", "headers": {"X-Request-ID": ruim}})
    assert resp["headers"]["X-Request-ID"] == "novo", f"o ID {ruim!r} é inválido e deveria ter sido trocado por um novo"`,
        },
        {
          name: 'não altera a requisição original',
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": None}
original = {"path": "/", "headers": {"x-request-id": "abc-123", "Accept": "application/json"}}
app = com_request_id(eco, lambda: "novo")
app(original)
assert original == {"path": "/", "headers": {"x-request-id": "abc-123", "Accept": "application/json"}}, f"o middleware não pode alterar a requisição recebida — trabalhe numa cópia; ficou {original}"`,
        },
        {
          name: 'o contexto é limpo mesmo quando o handler lança exceção',
          code: `def explode(req):
    raise RuntimeError("bug no handler")
app = com_request_id(explode, lambda: "gerado-1")
try:
    app({"path": "/", "headers": {}})
    assert False, "a exceção do handler deveria ser repassada"
except RuntimeError:
    pass
assert request_id_atual.get() is None, f"depois da requisição (mesmo com erro), o ID não pode vazar para o contexto; ficou {request_id_atual.get()!r}"`,
        },
        {
          name: 'propaga o mesmo ID pela cadeia gateway → pedidos → estoque',
          code: `ids = iter(["gerado-1", "gerado-2", "gerado-3"])
vistos = []

def estoque(req):
    vistos.append(("estoque", req["headers"].get("X-Request-ID"), request_id_atual.get()))
    return {"status": 200, "headers": {}, "body": {"disponivel": True}}

servico_estoque = com_request_id(estoque, lambda: next(ids))

def pedidos(req):
    vistos.append(("pedidos", req["headers"].get("X-Request-ID"), request_id_atual.get()))
    r = chamar(servico_estoque, {"path": "/estoque/7", "headers": {}})
    return {"status": 201, "headers": {"Location": "/pedidos/1"}, "body": r["body"]}

servico_pedidos = com_request_id(pedidos, lambda: next(ids))

def borda(req):
    return chamar(servico_pedidos, {"path": "/pedidos", "headers": {"Content-Type": "application/json"}})

gateway = com_request_id(borda, lambda: next(ids))
resp = gateway({"path": "/api/pedidos", "headers": {}})
assert vistos == [("pedidos", "gerado-1", "gerado-1"), ("estoque", "gerado-1", "gerado-1")], f"todos deveriam ver o ID gerado na borda: {vistos}"
assert resp["headers"]["X-Request-ID"] == "gerado-1" and resp["headers"]["Location"] == "/pedidos/1", f"cabeçalhos da resposta: {resp['headers']}"
assert request_id_atual.get() is None, "ao terminar, o contexto deveria voltar a None"`,
        },
        {
          name: 'ID terminado em quebra de linha é inválido',
          hidden: true,
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": None}
app = com_request_id(eco, lambda: "novo")
resp = app({"path": "/", "headers": {"X-Request-ID": "abc-123\\n"}})
assert resp["headers"]["X-Request-ID"] == "novo", "'abc-123\\\\n' deveria ser rejeitado. Cuidado: numa regex, '$' também casa ANTES de uma quebra de linha final — valide a string inteira com re.fullmatch"`,
        },
        {
          name: 'limites: 64 caracteres e os símbolos . _ - são válidos',
          hidden: true,
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": None}
for bom in ["a" * 64, "A.b_c-9", "7f3c9a1e-5b2d-4c8e-9f10-2a6b8d4e1c35", "x"]:
    app = com_request_id(eco, lambda: "novo")
    resp = app({"path": "/", "headers": {"X-Request-ID": bom}})
    assert resp["headers"]["X-Request-ID"] == bom, f"o ID {bom!r} é válido e deveria ser mantido"`,
        },
        {
          name: 'chamar: sem ID atual repassa como está; com ID, propaga numa cópia',
          hidden: true,
          code: `def eco(req):
    return {"status": 200, "headers": {}, "body": dict(req["headers"])}
resp = chamar(eco, {"path": "/estoque", "headers": {"Accept": "application/json"}})
assert resp["body"] == {"Accept": "application/json"}, f"fora de uma requisição não há ID para propagar; recebeu {resp['body']}"
saida = {"path": "/estoque", "headers": {"x-request-id": "velho", "Accept": "application/json"}}
token = request_id_atual.set("abc-123")
try:
    resp = chamar(eco, saida)
finally:
    request_id_atual.reset(token)
assert resp["body"] == {"X-Request-ID": "abc-123", "Accept": "application/json"}, f"chamar deveria propagar o ID atual, uma única vez: {resp['body']}"
assert saida == {"path": "/estoque", "headers": {"x-request-id": "velho", "Accept": "application/json"}}, "chamar não pode alterar a requisição recebida"`,
        },
        {
          name: 'aninhado: ao voltar, o contexto é o do chamador',
          hidden: true,
          code: `interno = com_request_id(lambda req: {"status": 200, "headers": {}, "body": request_id_atual.get()}, lambda: "interno-1")
def externo(req):
    r = interno({"path": "/x", "headers": {}})
    return {"status": 200, "headers": {}, "body": (r["body"], request_id_atual.get())}
app = com_request_id(externo, lambda: "externo-1")
resp = app({"path": "/", "headers": {}})
assert resp["body"] == ("interno-1", "externo-1"), f"depois da chamada interna, o contexto deveria voltar a 'externo-1' (use reset(token), não set(None)): {resp['body']}"`,
        },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global` para guardar o ID. Com `asyncio`, várias requisições se intercalam no mesmo thread e uma sobrescreveria o ID da outra — é para isso que existe `contextvars`: cada tarefa enxerga a **sua** cópia do contexto.',
          concept: 'contextvars',
        },
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Para limpar o contexto quando o handler falha, não capture a exceção: `try/finally` roda a limpeza **e** deixa a exceção seguir intacta, sem risco de engoli-la.',
          concept: 'try/finally',
        },
        {
          when: m => m.maxComplexity > 8,
          text: 'O middleware ficou com muitos caminhos. Extraia `_id_valido(valor)` e `_com_header(req, rid)` — este último serve também para o `chamar`, e as regras de cabeçalho passam a morar num lugar só.',
          concept: 'Extrair função',
        },
      ],
      hints: [
        'Procure o cabeçalho sem diferenciar caixa: `next((v for k, v in headers.items() if k.lower() == "x-request-id"), None)`. Valide com `re.fullmatch(r"[A-Za-z0-9._-]{1,64}", valor)`; se não servir, use `gerar_id()`.',
        'Monte a cópia com um **novo** dict de headers, sem nenhuma variação de `x-request-id`; depois `headers["X-Request-ID"] = rid` e `{**req, "headers": headers}`. Essa mesma função serve para o `chamar`.',
        '`token = request_id_atual.set(rid)`; chame o handler dentro de `try:` e faça `request_id_atual.reset(token)` no `finally:`. Por fim, `resp["headers"]["X-Request-ID"] = rid`. No `chamar`, só monte a cópia se `request_id_atual.get()` não for `None`.',
      ],
      solution: `import contextvars
import re

HEADER = "X-Request-ID"
request_id_atual = contextvars.ContextVar("request_id_atual", default=None)

_FORMATO_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


def _id_valido(valor):
    # fullmatch exige que a string INTEIRA case (com "^...$", "abc\\n" passaria)
    return isinstance(valor, str) and _FORMATO_ID.fullmatch(valor) is not None


def _ler_id(headers):
    return next((v for k, v in headers.items() if k.lower() == HEADER.lower()), None)


def _com_header(req, rid):
    """Cópia da requisição com o X-Request-ID canônico, sem variações de caixa."""
    headers = {k: v for k, v in req["headers"].items() if k.lower() != HEADER.lower()}
    headers[HEADER] = rid
    return {**req, "headers": headers}


def com_request_id(handler, gerar_id):
    """Middleware: garante um X-Request-ID válido e o deixa no contexto."""
    def envolvido(req):
        recebido = _ler_id(req["headers"])
        rid = recebido if _id_valido(recebido) else gerar_id()
        token = request_id_atual.set(rid)
        try:
            resp = handler(_com_header(req, rid))
        finally:
            request_id_atual.reset(token)      # volta ao valor do chamador
        resp["headers"][HEADER] = rid
        return resp
    return envolvido


def chamar(handler, req):
    """Chamada de saída: propaga o ID atual."""
    rid = request_id_atual.get()
    return handler(req if rid is None else _com_header(req, rid))
`,
      solutionExplanation: 'Três helpers pequenos carregam as regras: `_ler_id` busca o cabeçalho sem diferenciar caixa, `_id_valido` usa `re.fullmatch` (com `^...$` e `re.match`, um `\\n` no fim passaria — e forjaria linhas de log) e `_com_header` monta uma **cópia** com a grafia canônica, reaproveitada pelo `chamar`. No middleware, `set` devolve um **token** e `reset(token)` no `finally` restaura exatamente o valor anterior — por isso chamadas aninhadas funcionam e uma exceção não deixa o ID vazar. É o mesmo mecanismo que o OpenTelemetry usa para propagar o contexto de trace em código síncrono e `asyncio`.',
    },
    {
      type: 'order',
      id: 'api-gw-q4',
      concept: 'Contract testing com Pact',
      say: 'Agora o fluxo do Pact, do teste do consumidor até o deploy.',
      prompt: 'Ordene o fluxo do contract testing guiado pelo consumidor com Pact, do começo ao fim.',
      items: [
        'O consumidor escreve um teste contra o mock do Pact, dizendo que requisição faz e que resposta espera',
        'O teste passa e o Pact grava o contrato (pact file) com as interações',
        'O contrato é publicado no Pact Broker, marcado com a versão do consumidor',
        'O provedor prepara os provider states e reproduz cada interação contra o serviço real',
        'O resultado da verificação é publicado no Broker',
        'Antes do deploy, o can-i-deploy consulta a matriz de compatibilidade',
      ],
      explanation: 'O contrato **nasce do consumidor** (é ele quem sabe o que usa) e é **verificado pelo provedor** contra o código real — cada lado roda só os próprios testes, sem subir o outro. Os *provider states* ("existe o pedido 42") deixam o provedor montar os dados de cada interação. O Broker guarda quais versões são compatíveis entre si, e o `can-i-deploy` usa essa matriz para barrar um deploy que quebraria alguém em produção.',
    },
    {
      type: 'code',
      id: 'api-gw-q5',
      concept: 'Validação de contrato',
      title: 'Validador de resposta contra um contrato',
      say: 'Próximo código: um validador de contrato. É a versão em miniatura do que ferramentas de contrato fazem por baixo.',
      prompt: `Escreva \`validar(dados, contrato)\`, que confere uma resposta JSON (já convertida em dict) contra um contrato e devolve a **lista de violações** — vazia se estiver tudo certo. No contrato, cada chave aponta para um **esquema**:

| Esquema | Significa | Exemplo |
|---|---|---|
| um tipo (\`int\`, \`str\`, \`bool\`…) | o valor tem **exatamente** esse tipo | \`"id": int\` |
| um dict | objeto aninhado, com o seu próprio contrato | \`"cliente": {"id": int}\` |
| uma lista \`[esquema]\` | lista em que **cada** item segue o esquema | \`"itens": [{"sku": str}]\`, \`"tags": [str]\` |

Regras:
- Chave terminada em \`?\` é **opcional**: pode faltar, mas, se vier (mesmo \`None\`), é validada. O caminho usa o nome **sem** o \`?\`.
- Campos **extras** na resposta são permitidos (*Tolerant Reader*: acrescentar campo não quebra ninguém).
- \`True\` **não** vale como \`int\` (em Python, \`bool\` é subclasse de \`int\`; em JSON, não).
- Mensagens — o caminho usa \`.\` para objetos e \`[i]\` para listas, e os tipos aparecem pelo \`__name__\` (\`NoneType\` para \`None\`):
  - \`"ausente: cliente.nome"\`
  - \`"tipo: itens[1].qtd (esperado int, veio str)"\`
- Se o valor de um objeto ou lista tem o tipo errado, reporte **uma** violação (\`esperado dict\` / \`esperado list\`) e não desça nele.

A ordem das violações não importa.`,
      starter: `def validar(dados, contrato):
    """Devolve a lista de violações dos dados contra o contrato ([] = ok)."""
    violacoes = []
    # TODO: percorra o contrato (e desça em objetos e listas)
    return violacoes
`,
      tests: [
        { name: 'resposta que cumpre o contrato: nenhuma violação', expr: 'validar({"id": 42, "status": "pago", "pago": True}, {"id": int, "status": str, "pago": bool})', expected: '[]' },
        { name: 'campos extras são permitidos (Tolerant Reader)', expr: 'validar({"id": 1, "status": "pago", "campo_novo": "x"}, {"id": int, "status": str})', expected: '[]' },
        { name: 'campo obrigatório ausente', expr: 'validar({"id": 1}, {"id": int, "status": str})', expected: "['ausente: status']" },
        { name: 'tipo errado mostra o esperado e o recebido', expr: 'validar({"id": "42"}, {"id": int})', expected: "['tipo: id (esperado int, veio str)']" },
        {
          name: 'bool não vale como int, e None não vale como str',
          code: `r = validar({"qtd": True}, {"qtd": int})
assert r == ["tipo: qtd (esperado int, veio bool)"], f"True não é um int válido no contrato; veio {r}"
r = validar({"nome": None}, {"nome": str})
assert r == ["tipo: nome (esperado str, veio NoneType)"], f"None não é str; veio {r}"`,
        },
        { name: 'objeto aninhado usa caminho com ponto', expr: 'validar({"cliente": {"id": 7}}, {"cliente": {"id": int, "nome": str}})', expected: "['ausente: cliente.nome']" },
        { name: 'listas: cada item é validado, com o índice no caminho', expr: 'validar({"itens": [{"sku": "A1", "qtd": 1}, {"sku": "B2", "qtd": "2"}]}, {"itens": [{"sku": str, "qtd": int}]})', expected: "['tipo: itens[1].qtd (esperado int, veio str)']" },
        { name: 'lista de tipos simples', expr: 'validar({"tags": ["a", 2, "c"]}, {"tags": [str]})', expected: "['tipo: tags[1] (esperado str, veio int)']" },
        {
          name: 'opcional (sufixo ?) pode faltar, mas se vier é validado',
          code: `contrato = {"id": int, "cupom?": str}
r = validar({"id": 1}, contrato)
assert r == [], f"campo opcional ausente não é violação; veio {r}"
r = validar({"id": 1, "cupom": "BLACK10"}, contrato)
assert r == [], f"veio {r}"
r = validar({"id": 1, "cupom": 10}, contrato)
assert r == ["tipo: cupom (esperado str, veio int)"], f"opcional presente é validado — e o caminho usa o nome sem '?'; veio {r}"
r = validar({"id": 1, "cupom": None}, contrato)
assert r == ["tipo: cupom (esperado str, veio NoneType)"], f"opcional não é anulável: None é violação; veio {r}"`,
        },
        {
          name: 'várias violações de uma vez',
          hidden: true,
          code: `contrato = {
    "id": int,
    "status": str,
    "cliente": {"id": int, "email": str},
    "itens": [{"sku": str, "qtd": int}],
}
dados = {"id": "1", "cliente": {"id": 3}, "itens": [{"sku": 9, "qtd": 1}, {"qtd": True}], "extra": [1, 2]}
esperado = [
    "tipo: id (esperado int, veio str)",
    "ausente: status",
    "ausente: cliente.email",
    "tipo: itens[0].sku (esperado str, veio int)",
    "ausente: itens[1].sku",
    "tipo: itens[1].qtd (esperado int, veio bool)",
]
r = validar(dados, contrato)
assert sorted(r) == sorted(esperado), f"violações: {sorted(r)}"`,
        },
        {
          name: 'objeto ou lista com tipo errado: uma violação, sem descer',
          hidden: true,
          code: `contrato = {"cliente": {"id": int}, "itens": [{"sku": str}]}
r = validar({"cliente": "ana", "itens": {"sku": "A"}}, contrato)
assert sorted(r) == sorted(["tipo: cliente (esperado dict, veio str)", "tipo: itens (esperado list, veio dict)"]), f"tipo errado num objeto/lista gera uma violação e não desce; veio {r}"
r = validar({"cliente": {"id": 1}, "itens": []}, contrato)
assert r == [], f"lista vazia é válida; veio {r}"`,
        },
        {
          name: 'aninhamento profundo e validações seguidas',
          hidden: true,
          code: `contrato = {"pedido": {"entrega": {"endereco": {"cep": str}}, "pacotes": [[{"peso_g": int}]]}}
dados = {"pedido": {"entrega": {"endereco": {}}, "pacotes": [[{"peso_g": 10}], [{"peso_g": "x"}]]}}
r = validar(dados, contrato)
assert sorted(r) == sorted(["ausente: pedido.entrega.endereco.cep", "tipo: pedido.pacotes[1][0].peso_g (esperado int, veio str)"]), f"veio {r}"
ok = {"pedido": {"entrega": {"endereco": {"cep": "01001-000"}}, "pacotes": []}}
assert validar(ok, contrato) == [], "uma segunda validação não pode herdar violações da primeira"`,
        },
      ],
      reviews: [
        {
          when: m => m.mutableDefaults > 0,
          text: 'Um parâmetro com default mutável (`violacoes=[]`) é criado **uma vez só**, quando a função é definida: uma segunda chamada herdaria as violações da primeira. Use `None` e crie a lista dentro — ou acumule num helper interno.',
          concept: 'Default mutável',
        },
        {
          when: m => m.maxComplexity > 10,
          text: 'Uma função concentra todos os casos. Separe **validar um objeto** (percorre as chaves do contrato) de **validar um valor** (tipo, dict ou lista): cada uma fica curta e a recursão aparece naturalmente.',
          concept: 'Recursão sobre esquemas',
        },
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Um `try/except` genérico num validador esconde bugs do próprio validador: um erro inesperado vira "tudo certo". Aqui não há exceção a tratar — confira com `in` e `isinstance`.',
          concept: 'Tratamento de exceções',
        },
      ],
      hints: [
        'Separe em duas funções: uma valida um **objeto** (percorre as chaves do contrato) e outra valida **um valor** contra um esquema (tipo, dict ou lista). Elas se chamam mutuamente.',
        'Para cada chave: `opcional = chave.endswith("?")` e `nome = chave.rstrip("?")`. Ausente? Só é violação se não for opcional. Presente? Valide o valor com o caminho `f"{prefixo}.{nome}"` (ou só `nome` na raiz).',
        'No valor: esquema `dict` → confira `isinstance(valor, dict)` e valide o objeto; esquema `list` → confira `isinstance(valor, list)` e valide cada item com `esquema[0]` e o caminho `f"{caminho}[{i}]"`; senão, compare `type(valor) is esquema` — lembre que `isinstance(True, int)` é `True`.',
      ],
      solution: `def validar(dados, contrato):
    """Devolve a lista de violações dos dados contra o contrato ([] = ok)."""
    violacoes = []
    _validar_objeto(dados, contrato, "", violacoes)
    return violacoes


def _validar_objeto(dados, contrato, prefixo, violacoes):
    for chave, esquema in contrato.items():
        opcional = chave.endswith("?")
        nome = chave.rstrip("?")
        caminho = f"{prefixo}.{nome}" if prefixo else nome
        if nome not in dados:
            if not opcional:
                violacoes.append(f"ausente: {caminho}")
            continue
        _validar_valor(dados[nome], esquema, caminho, violacoes)


def _validar_valor(valor, esquema, caminho, violacoes):
    if isinstance(esquema, dict):
        if isinstance(valor, dict):
            _validar_objeto(valor, esquema, caminho, violacoes)
        else:
            violacoes.append(_erro_tipo(caminho, dict, valor))
    elif isinstance(esquema, list):
        if isinstance(valor, list):
            for i, item in enumerate(valor):
                _validar_valor(item, esquema[0], f"{caminho}[{i}]", violacoes)
        else:
            violacoes.append(_erro_tipo(caminho, list, valor))
    elif type(valor) is not esquema:        # tipo exato: True não passa por int
        violacoes.append(_erro_tipo(caminho, esquema, valor))


def _erro_tipo(caminho, esperado, valor):
    return f"tipo: {caminho} (esperado {esperado.__name__}, veio {type(valor).__name__})"
`,
      solutionExplanation: 'O contrato é uma **árvore**, então a solução natural é recursiva: `_validar_objeto` percorre as chaves do **contrato** (não dos dados — por isso campos extras passam, como pede o *Tolerant Reader*) e `_validar_valor` decide pelo tipo do esquema: dict desce no objeto, lista valida cada item com `[i]` no caminho, tipo simples compara com `type(valor) is esquema` — exato, porque `isinstance(True, int)` é `True`. As violações vão para uma lista criada **dentro** de `validar`, nunca num default mutável. Ferramentas reais (JSON Schema, Pact, Schemathesis) seguem a mesma ideia, com mais vocabulário: formatos, enums, `nullable`, `oneOf`.',
    },
    {
      type: 'open',
      id: 'api-gw-q6',
      concept: 'BFF',
      say: 'Última: uma revisão de design. Me convença.',
      prompt: 'O app móvel faz **6 chamadas** para montar a tela inicial e baixa campos que nunca mostra; o site precisa de outros dados para a mesma tela. Alguém propõe um **BFF** por experiência. Como você defenderia (ou não) a proposta numa revisão de design: o que ela resolve, quem deve ser o dono e quais os riscos?',
      minWords: 35,
      rubric: [
        { label: 'Explica o ganho: **agrega** chamadas e **molda** a resposta para a tela', keywords: ['agreg', 'round trip', 'roundtrip', 'ida e volta', 'idas e voltas', 'uma chamada', 'uma unica chamada', 'menos chamadas', 'fan-out', 'fan out', 'paralel', 'sob medida', 'molda', 'overfetch', 'over-fetch', 'payload', 'campos que'], concept: 'BFF', why: 'O BFF existe para que cada tela receba **exatamente** o que precisa numa chamada, com o fan-out acontecendo na rede interna (rápida), não no 4G.' },
        { label: 'Um BFF **por experiência**, mantido pelo **time da interface**', keywords: ['time do front', 'time de front', 'time do app', 'time da web', 'time do site', 'time mobile', 'time do mobile', 'time da interface', 'mesmo time', 'por experiencia', 'cada experiencia', 'um para cada', 'cada front', 'dono', 'autonomia'], concept: 'BFF', why: 'Se o BFF é do time da interface, ele evolui no ritmo da tela, sem fila num time de plataforma — é isso que o diferencia de um gateway genérico.' },
        { label: 'Aponta o risco de **duplicar lógica** ou de regra de negócio no BFF (mantê-lo fino)', keywords: ['duplic', 'regra de negocio', 'regras de negocio', 'logica de negocio', 'logica de dominio', 'regra de dominio', 'fino', 'magro'], concept: 'BFF', why: 'Dois BFFs com a mesma regra divergem com o tempo; o que é comum desce para os serviços de domínio.' },
        { label: 'Considera o **custo operacional** (mais um serviço, salto extra) ou alternativas (GraphQL)', keywords: ['operar', 'operacao', 'operacional', 'salto', 'hop', 'latencia', 'mais um servico', 'mais um componente', 'mais um deploy', 'monitor', 'observab', 'graphql', 'custo', 'infra'], concept: 'Trade-offs de arquitetura', why: 'Todo componente novo precisa ser implantado, monitorado e ter plantão; com uma única interface, talvez um endpoint agregador baste.' },
      ],
      modelAnswer: `Eu defenderia, com cuidados. O ganho é **agregar**: em vez de 6 idas e voltas pelo 4G, o app faz **uma chamada** e o BFF faz o fan-out em paralelo na rede interna, devolvendo uma resposta **sob medida** para a tela — sem os campos que o app não usa.

Seria **um BFF por experiência** (um para o app, outro para o site), e o dono de cada um é o **time do front** correspondente: a API da tela evolui no ritmo da tela, com autonomia, sem fila num time de plataforma.

O risco principal é **duplicar lógica**: regra de negócio no BFF acaba copiada nos dois e diverge. O BFF deve ser **fino** — agrega, filtra e formata; a regra fica nos serviços de domínio.

Também pesa o **custo operacional**: é mais um serviço para implantar, monitorar e manter, e mais um salto de latência. Se houvesse um único front, talvez um endpoint agregador no gateway ou um GraphQL resolvesse sem BFF dedicado.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Agora você sabe quem fica na **porta** (gateway e BFF), quem cuida do **corredor** (service mesh) e como seguir o **fio** de uma requisição (correlation ID).',
        { text: 'E aprendeu que contrato bom é contrato **verificado**: OpenAPI para descrever, contract testing para provar. Seus consumidores agradecem!', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
