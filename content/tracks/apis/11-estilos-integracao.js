(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo).
  const AUX_DL = `import asyncio

class _Banco:
    """Função de lote instrumentada: registra cada lista de chaves recebida."""
    def __init__(self):
        self.lotes = []
        self.falhar = False

    async def buscar(self, chaves):
        self.lotes.append(list(chaves))
        await asyncio.sleep(0)                     # finge uma ida ao banco
        if self.falhar:
            raise ConnectionError("banco fora do ar")
        return [f"autor-{c}" for c in chaves]

    def lotes_ordenados(self):
        return [sorted(lote) for lote in self.lotes]

async def _sem_travar(aguardavel):
    try:
        return await asyncio.wait_for(aguardavel, 1)
    except TimeoutError:
        raise AssertionError("travou por 1 s: algum load ficou esperando um valor que nunca chegou. O lote foi despachado? Todos os Futures foram resolvidos?") from None
`;

  const AUX_WH = `import hashlib as _hashlib
import hmac as _hmac

SEGREDO = b"whsec_segredo_de_teste"
AGORA = 1_700_000_000
CORPO = b'{"id": "evt_81", "tipo": "pagamento.aprovado",  "valor": 4990}'

def _assinar(t, corpo=CORPO, segredo=SEGREDO):
    return _hmac.new(segredo, f"{t}.".encode() + corpo, _hashlib.sha256).hexdigest()

def _verificar(corpo, cabecalho, agora=AGORA, **opcoes):
    return verificar_webhook(corpo, cabecalho, SEGREDO, relogio=lambda: agora, **opcoes)
`;

  Game.registerModule('apis', {
    id: 'estilos-integracao',
    title: 'Estilos de integração: REST, GraphQL, gRPC, tempo real e webhooks',
    kind: 'lesson',
    level: 2,
    order: 40,
    unit: 'arquitetura',
    summary: 'REST, GraphQL, gRPC, WebSocket, SSE, long polling e webhooks: o que cada um resolve, o N+1 dos resolvers (e o DataLoader), compatibilidade no protobuf e como receber webhooks sem cair em replay.',
    concepts: ['GraphQL e N+1', 'DataLoader', 'gRPC e Protocol Buffers', 'WebSocket × SSE × long polling', 'Webhooks com HMAC'],
    takeaways: [
      'Não existe estilo vencedor: **REST** para APIs públicas e cacheáveis, **GraphQL** para clientes com necessidades de dados diferentes, **gRPC** para chamadas internas tipadas e rápidas.',
      'Resolvers ingênuos geram **N+1** consultas; o **DataLoader** junta as chaves do mesmo ciclo do event loop num único lote e memoriza os valores durante a requisição.',
      'No protobuf, o **número** do campo é a identidade no fio: adicione campos com números novos, nunca reaproveite números e marque os removidos como `reserved`.',
      'Só o servidor fala: **SSE** (reconecta sozinho com `Last-Event-ID`); os dois falam o tempo todo: **WebSocket** (confira o `Origin`!); nada disso passa pela rede: **long polling**.',
      'Webhooks chegam **pelo menos uma vez** e fora de ordem: verifique o HMAC sobre **timestamp + corpo cru** com `compare_digest`, recuse timestamps velhos, deduplique pelo id e responda 2xx rápido.',
    ],
    glossary: [
      { term: 'GraphQL', aliases: [], definition: 'Linguagem de consulta para APIs (Facebook, 2015): o cliente manda uma query com exatamente os campos que quer, num único endpoint, e o servidor resolve cada campo com um *resolver*. Evita over/under-fetching, mas complica cache HTTP e controle de custo.' },
      { term: 'DataLoader', aliases: ['DataLoaders', 'data loader'], definition: 'Utilitário que junta as chaves pedidas no mesmo ciclo do event loop numa única chamada em lote (*batching*) e memoriza os resultados durante a requisição. É a solução clássica para o N+1 em resolvers GraphQL.' },
      { term: 'Protocol Buffers', aliases: ['protobuf', 'protobufs', 'proto3'], definition: 'Formato binário de serialização do Google, usado pelo gRPC. O contrato fica num arquivo `.proto` e cada campo é identificado no fio pelo **número**, não pelo nome — por isso números nunca devem ser reaproveitados.' },
      { term: 'Server-Sent Events', aliases: ['SSE', 'EventSource'], definition: 'Streaming de eventos do servidor para o cliente numa resposta HTTP longa (`text/event-stream`). Só vai num sentido, mas o navegador reconecta sozinho e retoma do último evento com o cabeçalho `Last-Event-ID`.' },
      { term: 'Long polling', aliases: ['long-polling', 'long poll'], definition: 'O cliente faz uma requisição e o servidor **segura** a resposta até ter novidade (ou dar timeout); ao receber, o cliente pergunta de novo. "Quase tempo real" com HTTP comum.' },
      { term: 'Webhook', aliases: ['webhooks'], definition: 'Chamada HTTP que um provedor faz para uma URL **sua** quando um evento acontece — uma "API reversa". A entrega costuma ser **pelo menos uma vez**, então quem recebe deve verificar a assinatura e deduplicar.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje vamos passear pelo **cardápio de estilos de integração**: REST, GraphQL, gRPC, tempo real e webhooks.',
          'Spoiler: não existe vencedor. Cada estilo resolve um problema — e cria outros.',
        ],
        board: {
          title: 'O cardápio',
          md: `| Estilo | Quem inicia | Formato típico | Brilha em |
|---|---|---|---|
| **REST** | cliente | JSON sobre HTTP | APIs públicas, cache HTTP, simplicidade |
| **GraphQL** | cliente | uma query num \`POST /graphql\` | clientes diferentes pedindo formatos diferentes |
| **gRPC** | cliente (ou *streams*) | Protocol Buffers sobre HTTP/2 | chamadas internas, contrato tipado, baixa latência |
| **Long polling** | cliente (e espera) | HTTP comum | "quase tempo real" sem infraestrutura nova |
| **SSE** | servidor empurra | \`text/event-stream\` | notificações e progresso, servidor → cliente |
| **WebSocket** | os dois lados | *frames* sobre uma conexão TCP | chat, jogos, edição colaborativa |
| **Webhook** | o **provedor** chama **você** | \`POST\` HTTP | avisar outro sistema que algo aconteceu |

\`\`\`text
 REST / GraphQL / gRPC:  cliente ──pergunta──▶ servidor ──resposta──▶ cliente
 Webhook:                provedor ──POST /webhooks──▶ SEU servidor      ("API reversa")
 SSE:                    servidor ══evento══▶ evento══▶ evento══▶ cliente
 WebSocket:              cliente ◀═══════ mensagens nos dois sentidos ═══════▶ servidor
\`\`\``,
        },
      },
      {
        type: 'say',
        text: [
          'O **GraphQL** nasceu no Facebook, em 2012, para o app mobile: em vez de várias rotas REST, **uma** query que diz exatamente os campos que o cliente quer.',
          'Acaba o *over-fetching* e o *under-fetching*… e aparece um problema traiçoeiro no servidor: o **N+1**.',
        ],
        board: {
          title: 'GraphQL e o problema N+1',
          md: `\`\`\`text
query {
  posts(ultimos: 3) {       # o cliente escolhe os campos…
    titulo
    autor { nome }          # …e até os "joins"
  }
}
\`\`\`

\`\`\`json
{"data": {"posts": [
  {"titulo": "Cache HTTP", "autor": {"nome": "Lia"}},
  {"titulo": "Webhooks",   "autor": {"nome": "Rafa"}},
  {"titulo": "gRPC",       "autor": {"nome": "Lia"}}
]}}
\`\`\`

Cada campo tem um **resolver** — e resolvers ingênuos consultam o banco **item a item**:

\`\`\`python
async def resolver_posts(ultimos):
    return await db.fetch("SELECT * FROM posts ORDER BY id DESC LIMIT ?", ultimos)    # 1 consulta

async def resolver_autor(post):
    return await db.fetchrow("SELECT * FROM autores WHERE id = ?", post["autor_id"])  # +1 POR post
\`\`\`

\`\`\`text
SELECT * FROM posts ORDER BY id DESC LIMIT 3
SELECT * FROM autores WHERE id = 1
SELECT * FROM autores WHERE id = 2
SELECT * FROM autores WHERE id = 1        ← repetida!
\`\`\`

Com 100 posts, **101 consultas**: o clássico **N+1** — agora espalhado por resolvers independentes, sem um ORM para culpar.

| GraphQL resolve | GraphQL complica |
|---|---|
| *over/under-fetching*: o cliente pede só o que usa | **cache HTTP**: quase tudo é \`POST /graphql\` |
| várias entidades numa ida só (ótimo no 4G) | **custo** imprevisível: quem monta a query é o cliente |
| schema tipado e introspecção | erros costumam vir com \`200 OK\`, no array \`errors\` |

> [!sabia] Com **aliases**, uma única requisição GraphQL pode carregar mil tentativas de login ou de cupom (\`t1: login(...)\`, \`t2: login(...)\`, …). Um rate limit **por requisição** nem percebe — por isso APIs GraphQL limitam **profundidade e custo** da query, e não só o número de chamadas.`,
        },
      },
      {
        type: 'say',
        text: [
          'A solução clássica é o **DataLoader**: em vez de buscar na hora, ele **anota** a chave e espera o fim do ciclo do event loop.',
          'Aí faz **uma** consulta com todas as chaves juntas. E, de brinde, memoriza o que já buscou.',
        ],
        board: {
          title: 'DataLoader: batching + cache por requisição',
          md: `\`\`\`text
 ciclo N do event loop:
   resolver_autor(post 1) → loader.load(1) ┐
   resolver_autor(post 2) → loader.load(2) ├─ só anotam a chave e esperam um Future
   resolver_autor(post 3) → loader.load(1) ┘   (a chave 1 repetida é deduplicada)
 fim do ciclo → despacho:
   funcao_lote([1, 2])  →  SELECT * FROM autores WHERE id IN (1, 2)
   → cada Future recebe o valor da sua chave
\`\`\`

\`\`\`python
async def autores_por_id(ids):
    """Função de LOTE: recebe N chaves e devolve N valores, NA MESMA ORDEM."""
    marcadores = ", ".join("?" * len(ids))
    linhas = await db.fetch(f"SELECT * FROM autores WHERE id IN ({marcadores})", ids)
    por_id = {linha["id"]: linha for linha in linhas}
    return [por_id.get(i) for i in ids]          # None para id inexistente

async def resolver_autor(post, contexto):
    return await contexto.loader_autores.load(post["autor_id"])   # um loader POR requisição
\`\`\`

| Regra | Por quê |
|---|---|
| A função de lote devolve os valores **na ordem das chaves** | é assim que cada \`load\` recebe o **seu** valor |
| **Um loader por requisição** | o cache é memoização de curto prazo: compartilhado entre usuários, vaza dados e serve valor velho |
| Erro no lote → erro para **todos** do lote, sem cachear | a próxima tentativa busca de novo |

> [!dica] É o mesmo remédio do N+1 de ORM (\`selectinload\` no SQLAlchemy, \`prefetch_related\` no Django): trocar N buscas por **uma com \`IN\`**. A diferença é que aqui os pedidos vêm de resolvers que não se conhecem — quem os junta é o **tempo**.

> [!sabia] O DataLoader foi publicado pelo Facebook em 2015, junto com o GraphQL, mas é o porte de uma API interna chamada **Loader**, criada em **2010** para juntar chamadas a vários *backends* de chave-valor. O truque é o *timing*: em JavaScript, o despacho roda logo depois das *promises* do ciclo atual; em Python, um \`loop.call_soon\` faz o mesmo papel.`,
        },
      },
      {
        type: 'say',
        text: [
          'Dentro de casa, entre microsserviços, o **gRPC** costuma brilhar: contrato num arquivo `.proto`, código gerado e mensagens binárias sobre HTTP/2.',
          'E o detalhe que decide se um deploy quebra clientes antigos: os **números** dos campos.',
        ],
        board: {
          title: 'gRPC e Protocol Buffers',
          md: `\`\`\`text
syntax = "proto3";

service Pedidos {
  rpc Buscar (BuscarPedido) returns (Pedido);              // unário
  rpc Acompanhar (BuscarPedido) returns (stream Status);   // streaming do servidor
}

message Pedido {
  string id = 1;              // o NÚMERO é a identidade do campo no fio
  int64 valor_centavos = 2;
  repeated Item itens = 3;
  reserved 4;                 // era "cupom": removido, número aposentado para sempre
  reserved "cupom";
  string observacao = 5;      // campo novo: clientes antigos simplesmente ignoram
}
\`\`\`

No fio não viajam nomes, só **número + tipo + valor**. Daí as regras de compatibilidade:

| Mudança | Compatível? |
|---|---|
| Adicionar campo com número **novo** | ✅ quem não conhece ignora; quem lê dado antigo vê o valor padrão |
| Remover campo e marcar o número como \`reserved\` | ✅ |
| **Renomear** mantendo o número | ✅ no binário (⚠️ quebra o JSON e o código gerado) |
| **Reaproveitar** o número de um campo removido | ❌ clientes antigos mandam e leem o dado com o significado antigo |
| Mudar o tipo (ex.: \`int32\` → \`string\`) | ❌ na prática, quebra |

| O gRPC traz | Custa |
|---|---|
| contrato forte e código gerado em várias linguagens | não roda direto no navegador (precisa de gRPC-Web + proxy) |
| HTTP/2: multiplexação e 4 tipos de chamada (unária e 3 de streaming) | binário: nada de \`curl\` e resposta lida a olho |
| **deadlines** que se propagam de serviço em serviço | balanceamento por requisição (L7): conexões HTTP/2 longas grudam num servidor só |

> [!sabia] Números de campo de **1 a 15** ocupam **1 byte** na codificação (número + tipo); de 16 a 2047, dois. Por isso a dica oficial é reservar 1–15 para os campos mais frequentes. E uma curiosidade: o proto3 começou **descartando** campos desconhecidos, e a versão 3.5 voltou a **preservá-los** — senão um serviço intermediário antigo apagava, no caminho, os campos novos que só repassava.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E quando é o **servidor** que tem novidade? O HTTP clássico é pergunta e resposta: o servidor não fala sem ser perguntado.',
          'Três jeitos de contornar isso, do mais simples ao mais poderoso: **long polling**, **SSE** e **WebSocket**.',
        ],
        board: {
          title: 'Tempo real: long polling × SSE × WebSocket',
          md: `| | **Long polling** | **SSE** | **WebSocket** |
|---|---|---|---|
| Direção | servidor → cliente, um evento por resposta | servidor → cliente | **dois sentidos** |
| Protocolo | HTTP comum | HTTP com \`text/event-stream\` | *upgrade* para protocolo próprio |
| Reconexão | o cliente refaz o pedido | **automática**, com \`Last-Event-ID\` | você implementa |
| Proxies e firewalls | passa em tudo | passa quase sempre | às vezes bloqueado |
| Pegadinha | cada evento custa uma requisição inteira | HTTP/1.1: só **6 conexões por domínio** no navegador | conexão com estado: escalar e balancear é mais difícil |
| Casos | fallback, integrações simples | notificações, progresso, tokens de um LLM | chat, jogos, edição colaborativa |

\`\`\`http
GET /eventos HTTP/1.1
Accept: text/event-stream
Last-Event-ID: 41

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

retry: 5000
id: 42
event: pedido.enviado
data: {"pedido": "p-17", "status": "enviado"}
\`\`\`

\`\`\`http
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://app.loja.com

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
\`\`\`

> [!atencao] O WebSocket **não passa pelo CORS**: o navegador abre a conexão para qualquer origem, levando os cookies junto. Se o servidor não conferir o cabeçalho \`Origin\` no handshake, um site malicioso conversa com a sua API em nome da vítima — é o *Cross-Site WebSocket Hijacking*.

> [!sabia] O \`Sec-WebSocket-Accept\` é o SHA-1 da chave enviada pelo cliente concatenada a um GUID fixo, \`258EAFA5-E914-47DA-95CA-C5AB0DC85B11\`, escrito na RFC 6455. Não é segurança: serve só para provar que o servidor **entende** WebSocket, e não é um servidor HTTP qualquer respondendo por engano.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, os **webhooks**: em vez de você perguntar "e aí, pagou?" a cada minuto, o provedor **te chama** quando acontece.',
          'Parece simples, mas o seu endpoint é público: qualquer um pode mandar um `POST` para ele. Como saber que foi mesmo o provedor?',
        ],
        board: {
          title: 'Webhooks: entrega, assinatura e replay',
          md: `\`\`\`http
POST /webhooks/pagamentos HTTP/1.1
Host: api.minhaloja.com
Content-Type: application/json
Assinatura-Webhook: t=1700000000,v1=5f2b0c3a…e81d

{"id": "evt_81", "tipo": "pagamento.aprovado", "pedido": "p-17"}
\`\`\`

A assinatura é um **HMAC-SHA256** com um segredo que só você e o provedor conhecem, calculado sobre o **timestamp + os bytes crus do corpo**:

\`\`\`text
v1 = HMAC_SHA256(segredo, "1700000000" + "." + corpo_cru)      (em hexadecimal)
\`\`\`

| Ameaça | Defesa |
|---|---|
| Alguém forja um \`POST\` | HMAC: sem o segredo, não há assinatura válida |
| Alguém captura um webhook legítimo e o **reenvia** depois (*replay*) | o timestamp é **assinado** e só vale numa janela (ex.: 5 min) |
| *Timing attack* na comparação | \`hmac.compare_digest\` |
| Trocar o segredo sem parar de receber | aceitar **várias** assinaturas \`v1\` durante a rotação |

**Garantias de entrega:** o provedor reenvia até receber um \`2xx\` — então a entrega é **pelo menos uma vez**, e a ordem **não** é garantida:

- **deduplique** pelo id do evento (uma tabela com \`UNIQUE(evento_id)\`);
- responda \`2xx\` **rápido** e processe numa fila — se demorar, o provedor dá timeout e reenvia;
- não confie na ordem: para eventos de estado, busque o estado atual na API do provedor.

> [!atencao] Verifique a assinatura sobre os **bytes crus**. Fazer \`json.loads\` e depois \`json.dumps\` muda espaços e ordem de chaves — a assinatura nunca bate, e alguém acaba "desligando a verificação só para destravar".

> [!sabia] Quem **envia** webhooks também corre risco: o cliente cadastra a URL de destino, e se ela for \`http://169.254.169.254/...\` (o endpoint de metadados da nuvem), o seu servidor vira um proxy para a rede interna — é **SSRF**, o API7 do OWASP. E nem todo provedor assina o timestamp: o GitHub assina só o corpo (\`X-Hub-Signature-256\`); para barrar replays ali, guarde os ids de entrega (\`X-GitHub-Delivery\`) já processados.`,
        },
      },
      {
        type: 'say',
        text: [
          'Então, qual escolher? Comece pela pergunta certa: **quem precisa iniciar a conversa** — e quem está do outro lado.',
          'E sem purismo: um mesmo sistema costuma misturar vários estilos, cada um na sua fronteira.',
        ],
        board: {
          title: 'Como escolher',
          md: `\`\`\`text
 Quem inicia a conversa?
 ├─ o cliente pergunta
 │   ├─ terceiros / API pública, cacheável ....... REST (+ OpenAPI)
 │   ├─ vários front-ends, dados sob medida ....... GraphQL (ou um BFF por front)
 │   └─ serviço ↔ serviço, interno, tipado ....... gRPC
 ├─ o servidor avisa um NAVEGADOR ou APP
 │   ├─ só servidor → cliente ................... SSE
 │   ├─ nos dois sentidos, baixa latência ....... WebSocket
 │   └─ rede hostil a conexões longas ........... long polling
 └─ o servidor avisa OUTRO SISTEMA .............. webhook (ou um broker de eventos)
\`\`\`

| Sistema | Mistura típica |
|---|---|
| E-commerce | REST para parceiros, gRPC entre serviços internos, webhooks do gateway de pagamento |
| App de delivery | GraphQL (ou BFF) para o app, SSE ou WebSocket para o mapa do entregador |
| Plataforma de CI | REST + webhooks do GitHub, SSE para o log do build ao vivo |

> [!dica] Na dúvida, comece com **REST**: é o que qualquer cliente sabe consumir, o que o cache HTTP entende e o que o \`curl\` depura. Adote GraphQL, gRPC ou WebSocket quando a dor que eles resolvem **aparecer de verdade**.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — com um DataLoader assíncrono de verdade e um verificador de webhooks.', icon: '🎯' },
      {
        type: 'match',
        id: 'api-int-q1',
        concept: 'Escolha do estilo de integração',
        say: 'Primeira: cada cenário pede um estilo. Associe!',
        prompt: 'Associe cada **cenário** ao estilo de integração mais adequado.',
        pairs: [
          { left: 'Chat com mensagens e "digitando…" nos dois sentidos', right: 'WebSocket' },
          { left: 'Painel que só recebe atualizações do servidor (progresso de um build)', right: 'SSE (Server-Sent Events)' },
          { left: 'App mobile e site web precisam de campos diferentes dos mesmos dados', right: 'GraphQL' },
          { left: 'Chamadas internas entre microsserviços, com contrato tipado e baixa latência', right: 'gRPC + Protocol Buffers' },
          { left: 'Avisar o sistema de um parceiro quando um pagamento é aprovado', right: 'Webhook' },
          { left: 'API pública para terceiros, cacheável e fácil de testar com curl', right: 'REST' },
        ],
        explanation: 'Pense em **quem inicia** e em **quem consome**. REST é o denominador comum para terceiros (cache HTTP, `curl`, OpenAPI); GraphQL resolve clientes com necessidades diferentes; gRPC brilha dentro de casa, com contrato tipado; SSE basta quando só o servidor fala; WebSocket, quando os dois falam o tempo todo; e webhook é o servidor chamando **outro sistema**. O **long polling** fica de reserva para quando nada disso passa pela rede do cliente.',
      },
      {
        type: 'mcq',
        id: 'api-int-q2',
        concept: 'N+1 e DataLoader',
        say: 'Agora, contas de padeiro. Quantas consultas vão ao banco?',
        prompt: 'Uma query GraphQL pede os **50 posts** mais recentes e o **autor** de cada um. Entre esses posts há **12 autores distintos**. O resolver de `posts` faz um `SELECT`, e o de `autor` faz um `SELECT` por post. Quantas consultas acontecem **sem** e **com** DataLoader (um loader por requisição)?',
        options: [
          { text: '51 sem DataLoader; 2 com DataLoader', correct: true, why: 'Sem DataLoader: 1 consulta de posts + 50 de autores (uma por post, inclusive as repetidas). Com DataLoader: os 50 `load` do mesmo ciclo viram **um** lote com as 12 chaves distintas — 1 + 1 = 2.' },
          { text: '51 sem DataLoader; 13 com DataLoader', why: 'Isso seria só **cache**, sem batching: cada autor distinto buscado uma vez (1 + 12). O DataLoader também **agrupa** as chaves do mesmo ciclo numa única chamada.' },
          { text: '2 sem DataLoader; 2 com DataLoader: o GraphQL faz o JOIN sozinho', why: 'O GraphQL não conhece o seu banco: ele só chama resolvers, campo a campo. Quem transforma N buscas em uma é você (DataLoader, JOIN, prefetch).' },
          { text: '51 sem DataLoader; 51 com DataLoader: ele só ajuda entre requisições diferentes', why: 'É o contrário: o DataLoader vive **dentro de uma requisição**. Compartilhá-lo entre requisições é justamente o que não se deve fazer (vaza dados e serve valor velho).' },
        ],
        explanation: 'O ganho vem de duas coisas: **batching** (todas as chaves do mesmo ciclo do event loop numa chamada só) e **deduplicação/cache** (a mesma chave não é buscada duas vezes). Em queries mais profundas — posts → autores → avatares — o padrão se repete por nível: com DataLoader, o número de consultas cresce com a **profundidade** da query, e não com a quantidade de itens.',
      },
      {
        type: 'code',
        id: 'api-int-q3',
        concept: 'DataLoader',
        title: 'Um DataLoader com asyncio',
        timeoutMs: 15000,
        say: 'Sua vez: implemente o DataLoader. Os testes contam quantas vezes a função de lote é chamada — N+1 não passa!',
        prompt: `Implemente a classe \`DataLoader(funcao_lote)\`:

- \`funcao_lote\` é uma função **assíncrona** que recebe uma **lista de chaves** e devolve uma **lista de valores na mesma ordem** (pense num \`SELECT ... WHERE id IN (...)\`).
- \`await loader.load(chave)\` devolve o valor da chave. Todos os \`load\` feitos no **mesmo ciclo** do event loop — por exemplo, dentro de um mesmo \`asyncio.gather\` — viram **uma única** chamada a \`funcao_lote\`.
- **Deduplicação:** a mesma chave pedida duas vezes no mesmo ciclo vai **uma vez só** na lista.
- **Cache:** uma chave já carregada não é buscada de novo (o loader vive o tempo de uma requisição).
- **Erros:** se \`funcao_lote\` lançar uma exceção, **todos** os \`load\` daquele lote a recebem — e essas chaves **não** ficam no cache (a próxima \`load\` tenta de novo).

Os testes usam uma função de lote instrumentada, que registra cada lista de chaves recebida.`,
        starter: `import asyncio


class DataLoader:
    def __init__(self, funcao_lote):
        self._funcao_lote = funcao_lote

    async def load(self, chave):
        # TODO: juntar as chaves do mesmo ciclo do event loop num único lote
        valores = await self._funcao_lote([chave])   # ingênuo: um lote por chave (é o N+1!)
        return valores[0]
`,
        tests: [
          {
            name: 'um load devolve o valor da chave',
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
valor = await _sem_travar(loader.load(7))
assert valor == "autor-7", f"esperado 'autor-7', veio {valor!r}"
assert b.lotes == [[7]], f"lotes recebidos pela função de lote: {b.lotes!r}"`,
          },
          {
            name: 'loads do mesmo gather viram UM lote',
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
res = await _sem_travar(asyncio.gather(loader.load(1), loader.load(2), loader.load(3)))
assert res == ["autor-1", "autor-2", "autor-3"], f"cada load deve receber o valor da SUA chave: {res!r}"
assert b.lotes_ordenados() == [[1, 2, 3]], f"esperado UM lote com [1, 2, 3]; a função de lote recebeu {b.lotes!r}"`,
          },
          {
            name: 'chave repetida no mesmo ciclo vai uma vez só',
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
res = await _sem_travar(asyncio.gather(loader.load(5), loader.load(9), loader.load(5)))
assert res == ["autor-5", "autor-9", "autor-5"], f"resultados: {res!r}"
assert b.lotes_ordenados() == [[5, 9]], f"a chave 5 deveria ir uma vez só: {b.lotes!r}"`,
          },
          {
            name: 'cache: chave já carregada não volta ao banco',
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
await _sem_travar(asyncio.gather(loader.load(1), loader.load(2)))
res = await _sem_travar(asyncio.gather(loader.load(2), loader.load(3)))
assert res == ["autor-2", "autor-3"], f"resultados: {res!r}"
assert b.lotes_ordenados() == [[1, 2], [3]], f"a chave 2 já estava carregada; lotes: {b.lotes!r}"`,
          },
          {
            name: 'resolvers de GraphQL: 10 posts, 3 autores distintos → 1 lote',
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
posts = [{"id": i, "autor_id": i % 3} for i in range(10)]

async def resolver_autor(post):
    return await loader.load(post["autor_id"])

autores = await _sem_travar(asyncio.gather(*(resolver_autor(p) for p in posts)))
assert autores == [f"autor-{i % 3}" for i in range(10)], f"autores: {autores!r}"
assert b.lotes_ordenados() == [[0, 1, 2]], f"esperado 1 lote com os 3 autores distintos (e não N+1): {b.lotes!r}"`,
          },
          {
            name: 'erro no lote chega a todos e não fica no cache',
            hidden: true,
            code: AUX_DL + `
b = _Banco()
b.falhar = True
loader = DataLoader(b.buscar)
res = await _sem_travar(asyncio.gather(loader.load(1), loader.load(2), return_exceptions=True))
assert all(isinstance(r, ConnectionError) for r in res), f"os dois load deveriam receber o ConnectionError do lote: {res!r}"
b.falhar = False
valor = await _sem_travar(loader.load(1))
assert valor == "autor-1", f"depois da falha, load(1) deveria buscar de novo: {valor!r}"
assert b.lotes_ordenados() == [[1, 2], [1]], f"a chave que falhou não pode ficar no cache: {b.lotes!r}"`,
          },
          {
            name: 'ciclos separados viram lotes separados, e a ordem dos resultados segue a dos pedidos',
            hidden: true,
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
assert await _sem_travar(loader.load(30)) == "autor-30"
res = await _sem_travar(asyncio.gather(loader.load(20), loader.load(10), loader.load(30)))
assert res == ["autor-20", "autor-10", "autor-30"], f"resultados fora de ordem: {res!r}"
assert b.lotes_ordenados() == [[30], [10, 20]], f"lotes: {b.lotes!r}"`,
          },
          {
            name: '200 loads com 50 chaves distintas → 1 lote de 50',
            hidden: true,
            code: AUX_DL + `
b = _Banco()
loader = DataLoader(b.buscar)
res = await _sem_travar(asyncio.gather(*(loader.load(i % 50) for i in range(200))))
assert res == [f"autor-{i % 50}" for i in range(200)], "algum load recebeu o valor de outra chave"
assert b.lotes_ordenados() == [list(range(50))], f"esperado 1 lote com 50 chaves, vieram {len(b.lotes)} lote(s)"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /^\s*(?:[\w.]+\.)?(?:create_task|ensure_future)\(/m.test(code),
            text: 'Você criou uma tarefa com `create_task`/`ensure_future` sem guardar a referência. O event loop só mantém referências **fracas** às tarefas: uma tarefa solta pode ser coletada pelo GC no meio da execução (a documentação do asyncio avisa). Guarde-a num `set` e remova no `add_done_callback`.',
            concept: 'Tarefa órfã',
          },
          {
            when: m => m.calls.includes('sleep'),
            text: 'Você usou `sleep` para dar tempo de as chaves chegarem. `sleep(0.01)` soma 10 ms a **toda** requisição e ainda pode partir um lote ao meio; `sleep(0)` funciona, mas depende de quantas voltas o loop dá. O idiomático é agendar o despacho com `loop.call_soon(...)` na **primeira** chave do ciclo: ele roda logo depois das tarefas que já estavam prontas.',
            concept: 'Agendamento no event loop',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo também captura `CancelledError`, `KeyboardInterrupt` e `SystemExit`. Para repassar a falha da função de lote aos `load` que esperam, `except Exception as erro:` basta.',
            concept: 'Tratamento de exceções',
          },
        ],
        hints: [
          'Guarde dois estados: `_cache` (chave → `Future`) e `_fila` (chaves esperando o despacho). Em `load`, se a chave não está no cache, crie `loop.create_future()` (com `loop = asyncio.get_running_loop()`), guarde-o e ponha a chave na fila. No fim, `return await self._cache[chave]` — várias corrotinas podem esperar o **mesmo** Future.',
          'Na **primeira** chave da fila (`len(self._fila) == 1`), agende o despacho uma única vez: `loop.call_soon(self._despachar, loop)`. O `call_soon` roda depois das tarefas que já estavam prontas no loop — ou seja, depois de todos os `load` do mesmo `gather`.',
          '`_despachar` troca a fila (`chaves, self._fila = self._fila, []`) e cria uma tarefa (guarde a referência!) que faz `valores = await self._funcao_lote(chaves)` e `futuro.set_result(valor)` para cada par. No `except Exception as erro:`, tire as chaves do cache e chame `futuro.set_exception(erro)`.',
        ],
        solution: `import asyncio


class DataLoader:
    """Junta as chaves pedidas no mesmo ciclo do event loop numa única chamada."""

    def __init__(self, funcao_lote):
        self._funcao_lote = funcao_lote
        self._cache = {}          # chave -> Future (memoização por requisição)
        self._fila = []           # chaves esperando o próximo despacho
        self._tarefas = set()     # referências fortes: o loop só guarda referências fracas

    async def load(self, chave):
        if chave not in self._cache:
            loop = asyncio.get_running_loop()
            self._cache[chave] = loop.create_future()
            self._fila.append(chave)
            if len(self._fila) == 1:                    # 1ª chave do ciclo: agenda o despacho
                loop.call_soon(self._despachar, loop)
        return await self._cache[chave]

    def _despachar(self, loop):
        chaves, self._fila = self._fila, []
        tarefa = loop.create_task(self._executar(chaves))
        self._tarefas.add(tarefa)
        tarefa.add_done_callback(self._tarefas.discard)

    async def _executar(self, chaves):
        futuros = [self._cache[chave] for chave in chaves]
        try:
            valores = await self._funcao_lote(chaves)
        except Exception as erro:
            for chave, futuro in zip(chaves, futuros):
                del self._cache[chave]                  # falhou: a próxima load tenta de novo
                futuro.set_exception(erro)
            return
        for futuro, valor in zip(futuros, valores):
            futuro.set_result(valor)
`,
        solutionExplanation: 'Cada chave nova ganha um `Future` no cache e entra na fila; a **primeira** chave do ciclo agenda `_despachar` com `call_soon`, que roda depois de todas as tarefas já prontas — por isso os `load` de um mesmo `gather` caem no mesmo lote. Quem pede uma chave repetida só aguarda o **mesmo** Future: deduplicação e cache saem de graça. `_executar` chama a função de lote uma vez e resolve cada Future na ordem das chaves; se ela falha, todos recebem a exceção e as chaves saem do cache, para a próxima tentativa buscar de novo. A tarefa do despacho fica num `set` até terminar, porque o event loop só guarda referências fracas. Bibliotecas reais (o `aiodataloader`, o DataLoader do Strawberry) acrescentam `max_batch_size` e `load_many`, mas o coração é este.',
      },
      {
        type: 'mcq',
        id: 'api-int-q4',
        concept: 'Compatibilidade no protobuf',
        say: 'Agora compatibilidade. Qual destes deploys quebra os clientes antigos?',
        prompt: `Você mantém um serviço gRPC com clientes antigos em produção, que você não controla. A versão atual do contrato é:

\`\`\`text
message Pedido {
  string id = 1;
  int64 valor_centavos = 2;
  string cupom = 3;
}
\`\`\`

Qual destas mudanças é **perigosa**?`,
        options: [
          { text: 'Remover `cupom` e, na versão seguinte, criar `int32 prioridade = 3;` reaproveitando o número 3.', correct: true, why: 'Clientes antigos continuam mandando o campo 3 como **texto** (o cupom), e o servidor novo tenta lê-lo como `prioridade` — dado corrompido ou erro de parse. No fio, o número **é** o campo.' },
          { text: 'Adicionar `string observacao = 4;`.', why: 'Seguro: quem não conhece o campo 4 o ignora (e, desde o protobuf 3.5, o preserva ao repassar a mensagem); quem lê uma mensagem antiga vê o valor padrão, `""`.' },
          { text: 'Renomear `valor_centavos` para `total_centavos`, mantendo o número 2.', why: 'No binário o nome não viaja — só número e tipo —, então o fio continua compatível. O cuidado é com quem usa o **mapeamento JSON** do protobuf ou o código gerado, que muda de nome.' },
          { text: 'Remover `cupom` e declarar `reserved 3;` e `reserved "cupom";`.', why: 'É a prática recomendada: o compilador passa a **impedir** que alguém reaproveite esse número ou esse nome no futuro.' },
        ],
        explanation: 'No Protocol Buffers, cada campo é codificado como **número + tipo + valor** — o nome só existe no seu código. Daí as regras de ouro: campos novos ganham números **novos**; campos removidos têm o número (e o nome) marcados como `reserved`; e nunca se muda o tipo ou o significado de um número em uso. Ferramentas como o `buf breaking` checam essas regras no CI, comparando o `.proto` novo com o anterior.',
      },
      {
        type: 'code',
        id: 'api-int-q5',
        concept: 'Assinatura de webhooks',
        title: 'Verificando a assinatura de um webhook',
        say: 'Agora o lado de quem recebe: provar que o webhook veio mesmo do provedor — e que não é um replay de ontem.',
        prompt: `Implemente \`verificar_webhook(corpo, cabecalho, segredo, relogio=time.time, tolerancia=300)\`, no estilo do Stripe:

- \`corpo\`: os **bytes crus** recebidos — trate como bytes opacos (nem precisam ser UTF-8).
- \`cabecalho\`: o valor do cabeçalho de assinatura, no formato \`t=1700000000,v1=<hex>\`. Pode haver **vários** \`v1=\` (rotação de segredo) e esquemas desconhecidos (ex.: \`v0=\`), que devem ser ignorados.
- A assinatura esperada é \`HMAC-SHA256(segredo, <t> + "." + corpo)\` em **hexadecimal**, onde \`<t>\` é o timestamp exatamente como veio no cabeçalho.
- Devolva \`True\` se **alguma** \`v1\` bater (compare com \`hmac.compare_digest\`) **e** \`t\` estiver a no máximo \`tolerancia\` segundos de \`relogio()\` — para trás **ou** para a frente.
- Em qualquer outro caso — sem \`t\`, \`t\` não numérico, sem \`v1\`, assinatura errada, fora da janela, cabeçalho malformado — devolva \`False\`, **sem** lançar exceção.`,
        starter: `import hashlib
import hmac
import time


def verificar_webhook(corpo, cabecalho, segredo, relogio=time.time, tolerancia=300):
    # TODO: ler t e os v1 do cabeçalho, conferir a janela de tempo e o HMAC
    pass
`,
        tests: [
          {
            name: 'assinatura válida e timestamp atual → True',
            code: AUX_WH + `
obtido = _verificar(CORPO, f"t={AGORA},v1={_assinar(AGORA)}")
assert obtido is True, f"assinatura correta e timestamp atual: esperado True, veio {obtido!r}"`,
          },
          {
            name: 'corpo adulterado → False',
            code: AUX_WH + `
obtido = _verificar(CORPO.replace(b"4990", b"1"), f"t={AGORA},v1={_assinar(AGORA)}")
assert obtido is False, f"o valor no corpo mudou de 4990 para 1: a assinatura não pode bater (veio {obtido!r})"`,
          },
          {
            name: 'assinado com outro segredo → False',
            code: AUX_WH + `
obtido = _verificar(CORPO, f"t={AGORA},v1={_assinar(AGORA, segredo=b'segredo-do-atacante')}")
assert obtido is False, f"uma assinatura feita com outro segredo foi aceita (veio {obtido!r})"`,
          },
          {
            name: 'o t é assinado: trocar o timestamp de um webhook velho → False',
            code: AUX_WH + `
velho = AGORA - 3600
obtido = _verificar(CORPO, f"t={AGORA},v1={_assinar(velho)}")
assert obtido is False, f"o atacante pôs o horário atual num webhook de 1 hora atrás; como o t faz parte do conteúdo assinado, deveria dar False (veio {obtido!r})"`,
          },
          {
            name: 'replay: webhook de 10 minutos atrás → False (e a tolerância é respeitada)',
            code: AUX_WH + `
t = AGORA - 600
cab = f"t={t},v1={_assinar(t)}"
obtido = _verificar(CORPO, cab)
assert obtido is False, f"assinatura válida, mas de 10 minutos atrás: fora da tolerância de 300 s (veio {obtido!r})"
obtido = _verificar(CORPO, cab, tolerancia=900)
assert obtido is True, f"com tolerancia=900, o mesmo webhook está dentro da janela (veio {obtido!r})"`,
          },
          {
            name: 'rotação de segredo: vários v1, em qualquer ordem; v0 é ignorado',
            code: AUX_WH + `
antiga = _assinar(AGORA, segredo=b"segredo-antigo")
nova = _assinar(AGORA)
for cab in (f"t={AGORA},v1={antiga},v1={nova},v0=deadbeef", f"t={AGORA},v1={nova},v1={antiga}"):
    obtido = _verificar(CORPO, cab)
    assert obtido is True, f"durante a rotação chegam várias assinaturas v1 — basta UMA bater, em qualquer posição (veio {obtido!r} para {cab[:45]}…)"`,
          },
          {
            name: 'bordas da janela: 300 s vale, 301 s não — para trás e para a frente',
            hidden: true,
            code: AUX_WH + `
for delta, esperado in [(-300, True), (-301, False), (300, True), (301, False)]:
    t = AGORA + delta
    obtido = _verificar(CORPO, f"t={t},v1={_assinar(t)}")
    assert obtido is esperado, f"timestamp com {delta:+d} s em relação ao relógio: esperado {esperado}, veio {obtido!r}"`,
          },
          {
            name: 'cabeçalho malformado → False, sem exceção',
            hidden: true,
            code: AUX_WH + `
sig = _assinar(AGORA)
casos = ["", "lixo", ",,,", f"v1={sig}", f"t={AGORA}", f"t={AGORA},v1=", f"t=abc,v1={sig}", f"t=,v1={sig}", f"t={AGORA};v1={sig}"]
for cab in casos:
    try:
        obtido = _verificar(CORPO, cab)
    except Exception as e:
        raise AssertionError(f"o cabeçalho {cab[:40]!r} lançou {type(e).__name__}: devolva False") from None
    assert obtido is False, f"cabeçalho {cab[:40]!r}: esperado False, veio {obtido!r}"`,
          },
          {
            name: 'corpo binário (não UTF-8): verifique os bytes crus',
            hidden: true,
            code: AUX_WH + `
corpo = b"\\x00\\xff\\xfe binario \\x80"
obtido = _verificar(corpo, f"t={AGORA},v1={_assinar(AGORA, corpo=corpo)}")
assert obtido is True, f"o corpo é um bytes opaco: não decodifique nem faça parse antes de verificar (veio {obtido!r})"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou as assinaturas sem `hmac.compare_digest`. O `==` de strings para no primeiro caractere diferente, e o tempo de resposta vaza quanto da assinatura o atacante já acertou (*timing attack*). Com tentativas suficientes, dá para montá-la pedaço a pedaço.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.calls.includes('loads') || m.calls.includes('dumps'),
            text: 'Você fez parse (ou reserializou) o JSON antes de verificar. A assinatura é sobre os **bytes crus**: `json.dumps(json.loads(corpo))` muda espaços e ordem de chaves, e a assinatura deixa de bater. Verifique primeiro; faça o parse só depois.',
            concept: 'Assinatura sobre o corpo cru',
          },
          {
            when: m => m.calls.includes('time') && m.imports.includes('time'),
            text: 'Você chamou `time.time()` dentro da lógica. Use o `relogio` injetado: é ele que permite testar "301 segundos atrás" sem esperar — e acertar exatamente a borda da janela.',
            concept: 'Injeção de relógio',
          },
        ],
        hints: [
          'Separe o cabeçalho: `for item in cabecalho.split(","):` e `chave, _, valor = item.strip().partition("=")`. Guarde o `t` e uma **lista** com todos os `v1` — um `dict` perderia as assinaturas repetidas.',
          'Antes de qualquer conta: existe `t`, `t.isdecimal()` e pelo menos um `v1`? Depois, a janela: `abs(relogio() - int(t)) <= tolerancia` — o `abs` cobre o passado e o futuro.',
          '`esperada = hmac.new(segredo, t.encode() + b"." + corpo, hashlib.sha256).hexdigest()` e, no fim, `return any(hmac.compare_digest(esperada, v1) for v1 in assinaturas)`.',
        ],
        solution: `import hashlib
import hmac
import time


def _ler_cabecalho(cabecalho):
    """'t=1700000000,v1=ab12,v1=cd34' → ('1700000000', ['ab12', 'cd34'])."""
    t, assinaturas = None, []
    for item in cabecalho.split(","):
        chave, _, valor = item.strip().partition("=")
        if chave == "t":
            t = valor
        elif chave == "v1":
            assinaturas.append(valor)
    return t, assinaturas


def verificar_webhook(corpo, cabecalho, segredo, relogio=time.time, tolerancia=300):
    t, assinaturas = _ler_cabecalho(cabecalho)
    if t is None or not t.isdecimal() or not assinaturas:
        return False
    if abs(relogio() - int(t)) > tolerancia:          # velho demais (replay) ou do futuro
        return False
    esperada = hmac.new(segredo, t.encode() + b"." + corpo, hashlib.sha256).hexdigest()
    # compara bytes: com str, compare_digest lança TypeError se houver caractere não ASCII
    return any(hmac.compare_digest(esperada.encode(), v1.encode()) for v1 in assinaturas)
`,
        solutionExplanation: 'O parse do cabeçalho é **tolerante** (ignora esquemas desconhecidos como `v0` e aceita vários `v1`), mas a validação é **estrita**: sem `t` numérico ou sem `v1`, nem calcula nada. A janela usa `abs()` para barrar tanto o **replay** de um webhook antigo quanto timestamps do futuro. O HMAC cobre `t` + `.` + **corpo cru**, então trocar o `t` invalida a assinatura. `hmac.compare_digest` compara em tempo constante — e recebe **bytes** porque, com `str`, ele lança `TypeError` diante de um caractere não ASCII (um cabeçalho malicioso derrubaria o endpoint com um 500). Em produção, some a isso a deduplicação pelo id do evento: a janela de 5 minutos encolhe o replay, mas não o elimina.',
      },
      {
        type: 'open',
        id: 'api-int-q6',
        concept: 'Webhooks confiáveis',
        say: 'Última: um design de verdade. Me convença de que esse endpoint aguenta produção.',
        prompt: 'Você vai receber os webhooks de **pagamento aprovado** de um provedor para liberar pedidos. Como você desenharia o endpoint `POST /webhooks/pagamentos` para ser **seguro** e **correto** mesmo com reenvios, atrasos e eventos fora de ordem?',
        minWords: 30,
        rubric: [
          { label: 'Verifica a **assinatura HMAC** sobre timestamp + corpo cru, com janela contra **replay**', keywords: ['hmac', 'assinatura', 'assinad', 'signature', 'replay', 'compare_digest', 'segredo compartilhado'], concept: 'Assinatura de webhooks', why: 'O endpoint é público: sem assinatura, qualquer um "aprova" um pagamento com um `curl`. O timestamp assinado limita o reaproveitamento de um webhook capturado.' },
          { label: '**Deduplica** pelo id do evento: a entrega é pelo menos uma vez', keywords: ['idempot', 'dedup', 'duplica', 'id do evento', 'evento_id', 'event id', 'ja processad', 'pelo menos uma vez', 'at-least-once', 'at least once', 'unique', 'repetid'], concept: 'Consumidor idempotente', why: 'O provedor reenvia até receber 2xx; sem deduplicação, o mesmo pagamento libera o pedido duas vezes (ou dispara dois e-mails, dois estornos…).' },
          { label: 'Responde **2xx rápido** e processa de forma **assíncrona** (fila)', keywords: ['fila', 'enfileir', 'queue', 'assincron', 'background', 'worker', '2xx', '200', '202', 'responder rapido', 'responde rapido', 'rapidamente', 'outbox'], concept: 'Processamento assíncrono', why: 'Se o processamento demora, o provedor dá timeout e reenvia — gerando duplicatas e tempestades de retry. Aceite, enfileire e processe depois.' },
          { label: 'Trata eventos **fora de ordem** (consulta o estado atual ou compara versões)', keywords: ['ordem', 'sequencia', 'versao', 'estado atual', 'consultar a api', 'consulta a api', 'buscar o estado', 'busca o estado', 'mais recente'], concept: 'Ordem de eventos', why: 'Um "pagamento.estornado" pode chegar antes do "pagamento.aprovado". Buscar o estado atual na API do provedor (ou comparar versões) evita regredir o pedido.' },
        ],
        modelAnswer: `Primeiro, **autenticidade**: o endpoint lê o corpo **cru** e verifica a assinatura **HMAC-SHA256** sobre \`timestamp.corpo\` com \`hmac.compare_digest\`, recusando timestamps fora de uma janela de 5 minutos (contra **replay**). Sem assinatura válida, \`400\` e nada acontece.

Depois, **idempotência**: a entrega é **pelo menos uma vez**, então gravo o id do evento numa tabela com \`UNIQUE(evento_id)\` — se ele já foi processado, respondo \`200\` e ignoro a duplicata.

Terceiro, **responder rápido**: dentro da requisição só verifico, deduplico e **enfileiro**; devolvo \`2xx\` em milissegundos, e um worker assíncrono libera o pedido. Se eu demorasse, o provedor daria timeout e reenviaria.

Por fim, **ordem**: não confio que os eventos cheguem na sequência. Para mudar o status do pedido, o worker **consulta o estado atual** do pagamento na API do provedor (ou compara a versão do evento com a que já tenho), assim um estorno que chegou antes da aprovação não é sobrescrito.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você conhece o cardápio inteiro — e sabe quando cada prato cai bem.',
          { text: 'Resumo: REST por padrão, GraphQL com DataLoader, gRPC com números sagrados, SSE ou WebSocket conforme quem fala, e webhooks assinados, deduplicados e processados numa fila.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
