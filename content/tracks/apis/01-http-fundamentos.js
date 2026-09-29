(function () {
  // Prelúdio dos testes do parser: monta requisições brutas com CRLF.
  const REQ = `def req(*linhas, corpo=""):
    """Linhas unidas por CRLF + linha vazia + corpo."""
    return "\\r\\n".join(linhas) + "\\r\\n\\r\\n" + corpo

`;

  Game.registerModule('apis', {
    id: 'http-fundamentos',
    title: 'Fundamentos de HTTP',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'fundamentos',
    summary: 'O chão de fábrica de toda API: anatomia de requisições e respostas, métodos safe e idempotentes, status codes sem confusão, cabeçalhos que importam — e por que o HTTP/3 trocou o TCP pelo QUIC.',
    concepts: ['Anatomia HTTP', 'Safe × idempotente', 'Status codes', 'Cabeçalhos', 'HTTP/2 e HTTP/3'],
    takeaways: [
      'No HTTP/1.1 a mensagem é texto: linha inicial, cabeçalhos, **linha vazia** e corpo — e o `Host` é obrigatório.',
      '**Safe** = não pede mudança de estado (`GET`, `HEAD`, `OPTIONS`); **idempotente** = repetir tem o mesmo efeito de fazer uma vez (os safe + `PUT` e `DELETE`). `POST` e `PATCH` não prometem nenhuma das duas.',
      '`401` = não sei quem você é; `403` = sei, e você não pode. `400` = não entendi; `422` = entendi, mas é inválido. `502`/`503`/`504` = upstream respondeu mal, sem capacidade, upstream demorou.',
      'O HTTP/2 multiplexa streams numa conexão, mas herda o *head-of-line blocking* do TCP; o HTTP/3 roda sobre **QUIC** (UDP) e isola a perda de pacotes por stream.',
    ],
    glossary: [
      { term: 'Método seguro', aliases: ['métodos seguros', 'safe method', 'safe methods', 'método safe', 'métodos safe'], definition: 'Método HTTP cuja semântica é **somente leitura**: o cliente não pede mudança de estado (`GET`, `HEAD`, `OPTIONS`, `TRACE`). O servidor ainda pode registrar logs e métricas.' },
      { term: 'Idempotente', aliases: ['idempotentes', 'idempotência', 'idempotent', 'idempotence'], definition: 'Operação que, repetida N vezes, tem no servidor o **mesmo efeito** de uma só. No HTTP: os métodos seguros, `PUT` e `DELETE`. É o que torna um retry automático seguro.' },
      { term: 'Head-of-line blocking', aliases: ['HOL blocking', 'head of line blocking', 'bloqueio de cabeça de fila'], definition: 'Quando o primeiro item de uma fila trava e segura todos os de trás. No HTTP/1.1, uma resposta lenta bloqueia a conexão; no HTTP/2, um pacote TCP perdido paralisa **todas** as streams; o HTTP/3 (QUIC) isola a perda por stream.' },
      { term: 'QUIC', aliases: [], definition: 'Protocolo de transporte sobre **UDP** (RFC 9000) usado pelo HTTP/3: streams independentes, TLS 1.3 embutido, handshake em 1 RTT (ou 0-RTT) e migração de conexão entre redes.' },
      { term: 'Negociação de conteúdo', aliases: ['content negotiation'], definition: 'O cliente diz o que aceita (`Accept`, `Accept-Language`, `Accept-Encoding`) e o servidor escolhe a representação — ou responde `406 Not Acceptable` se nenhuma servir.' },
      { term: 'Request smuggling', aliases: ['HTTP request smuggling', 'contrabando de requisições'], definition: 'Ataque que explora divergências entre proxy e servidor sobre **onde termina** uma requisição (`Content-Length` × `Transfer-Encoding`, espaço antes dos dois-pontos…): o pedaço "sobrando" vira outra requisição. Por isso parsers HTTP devem ser estritos.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Vamos começar pelo chão de fábrica: o **HTTP**. Toda API REST, GraphQL ou webhook viaja em cima dele.',
          'E no HTTP/1.1 ele é **texto puro** — dá para ler uma requisição inteira com os olhos.',
        ],
        board: {
          title: 'Anatomia de uma requisição e de uma resposta',
          md: `\`\`\`http
POST /pedidos?origem=app HTTP/1.1
Host: api.loja.dev
Content-Type: application/json
Accept: application/json
Content-Length: 24

{"produto": 7, "qtd": 2}
\`\`\`

\`\`\`http
HTTP/1.1 201 Created
Location: /pedidos/42
Content-Type: application/json
Content-Length: 34

{"id": 42, "status": "aguardando"}
\`\`\`

| Parte | Na requisição | Na resposta |
|---|---|---|
| 1ª linha | **método**, **alvo** e **versão** | versão, **status** e frase |
| Cabeçalhos | \`Nome: valor\`, um por linha | idem |
| Linha vazia | obrigatória: separa cabeçalhos do corpo | idem |
| Corpo | opcional; tamanho no \`Content-Length\` (ou \`Transfer-Encoding: chunked\`) | idem |

> [!dica] As linhas terminam em \`\\r\\n\` (CRLF). Nomes de cabeçalho **não** diferenciam maiúsculas: \`content-type\` e \`Content-Type\` são o mesmo — no HTTP/2 eles até viajam em minúsculas.

> [!atencao] No HTTP/1.1 o \`Host\` é **obrigatório**: é ele que permite hospedar vários sites no mesmo IP (*virtual hosting*). Requisição 1.1 sem \`Host\` deve levar \`400\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Os métodos têm duas propriedades que valem ouro para retries e caches: **safe** e **idempotente**.',
          '**Safe** é "só leitura". **Idempotente** é "repetir dá no mesmo". Todo safe é idempotente — mas não o contrário.',
        ],
        board: {
          title: 'Métodos e suas garantias',
          md: `| Método | Para quê | Safe | Idempotente | Cacheável |
|---|---|---|---|---|
| \`GET\` | ler um recurso | ✅ | ✅ | ✅ |
| \`HEAD\` | só os cabeçalhos do \`GET\` | ✅ | ✅ | ✅ |
| \`OPTIONS\` | capacidades (ex.: *preflight* de CORS) | ✅ | ✅ | ❌ |
| \`PUT\` | criar ou substituir **por inteiro** | ❌ | ✅ | ❌ |
| \`DELETE\` | remover | ❌ | ✅ | ❌ |
| \`POST\` | processar, criar "mais um" | ❌ | ❌ | raramente |
| \`PATCH\` | alterar uma parte | ❌ | ❌ (depende do formato) | ❌ |

**Por que isso importa:** navegadores, proxies e bibliotecas **repetem sozinhos** uma requisição idempotente quando a conexão cai no meio. Com um \`POST\` eles não podem fazer isso — a especificação (RFC 9110) manda não repetir automaticamente um método não idempotente.

> [!dica] *Safe* fala da **semântica pedida**, não da implementação: um \`GET\` que grava log de acesso continua safe. O que ele não pode é **significar** "apague" ou "compre".

> [!sabia] Em 2005, o *Google Web Accelerator* pré-carregava os links das páginas para acelerar a navegação — e apps que excluíam itens com links \`GET\` (\`<a href="/itens/9/apagar">\`) perderam dados, porque o "acelerador" seguiu os links de exclusão. Um \`GET\` com efeito colateral é uma bomba esperando um crawler.`,
        },
      },
      {
        type: 'say',
        text: [
          'O status code é o **resumo** da resposta, e o primeiro dígito já conta a história: 2xx deu certo, 4xx a culpa é do cliente, 5xx do servidor.',
          'Os pares que mais confundem aparecem em entrevista — e em code review — o tempo todo.',
        ],
        board: {
          title: 'Status codes e as confusões clássicas',
          md: `| Família | Significado | Exemplos |
|---|---|---|
| 1xx | informativo | \`100 Continue\`, \`101 Switching Protocols\`, \`103 Early Hints\` |
| 2xx | sucesso | \`200 OK\`, \`201 Created\`, \`202 Accepted\`, \`204 No Content\` |
| 3xx | redirecionamento | \`301\`, \`302\`, \`304 Not Modified\`, \`307\`, \`308\` |
| 4xx | erro do **cliente** | \`400\`, \`401\`, \`403\`, \`404\`, \`409\`, \`422\`, \`429\` |
| 5xx | erro do **servidor** | \`500\`, \`502\`, \`503\`, \`504\` |

| Par | A diferença |
|---|---|
| \`401\` × \`403\` | \`401\`: **não sei quem você é** (credencial ausente ou inválida; vem com \`WWW-Authenticate\`). \`403\`: sei quem você é, e você **não pode**. |
| \`400\` × \`422\` | \`400\`: **não entendi** (JSON quebrado, tipo errado). \`422\`: entendi, mas as **regras** recusam (\`"idade": -3\`). |
| \`404\` × \`410\` | \`404\`: não achei (talvez nunca tenha existido, talvez volte). \`410\`: existiu e foi removido **de propósito, para sempre**. |
| \`200\` × \`201\` × \`204\` | \`200\`: ok, com corpo. \`201\`: **criei** — a URL vai no \`Location\`. \`204\`: ok, **sem corpo**. |
| \`502\` × \`503\` × \`504\` | \`502\`: o gateway recebeu uma resposta **inválida** do upstream (ou a conexão caiu). \`503\`: sem capacidade **agora** (sobrecarga, manutenção) — mande \`Retry-After\`. \`504\`: o gateway **cansou de esperar** o upstream. |

> [!dica] Para não revelar que um recurso existe, muitas APIs respondem \`404\` em vez de \`403\` a quem não tem acesso — o GitHub faz isso com repositórios privados.

> [!sabia] Com \`301\` e \`302\`, os navegadores trocavam um \`POST\` por \`GET\` ao seguir o redirecionamento. Por isso nasceram o \`307\` e o \`308\`: os mesmos redirecionamentos (temporário e permanente), mas **preservando o método e o corpo**. E o \`103 Early Hints\` deixa o servidor mandar \`Link: </app.css>; rel=preload\` **antes** da resposta final, para o navegador ir baixando o CSS enquanto o backend pensa.`,
        },
      },
      {
        type: 'say',
        text: [
          'Cabeçalhos são os **metadados** da conversa: formato, autenticação, cache, versões, rastreio.',
          'Não precisa decorar todos — mas estes aparecem em qualquer API séria.',
        ],
        board: {
          title: 'Cabeçalhos que importam',
          md: `| Cabeçalho | Onde | Para quê |
|---|---|---|
| \`Host\` | req | qual site/API (obrigatório no HTTP/1.1) |
| \`Content-Type\` | ambos | formato do corpo (\`application/json\`); o servidor responde \`415\` se não aceita o formato enviado |
| \`Accept\` | req | formatos aceitos — negociação de conteúdo (\`406\` se nenhum serve) |
| \`Authorization\` | req | credenciais: \`Bearer <token>\`, \`Basic ...\` |
| \`Location\` | resp | URL do recurso criado (\`201\`) ou destino do redirecionamento (\`3xx\`) |
| \`Cache-Control\` / \`ETag\` | resp | por quanto tempo guardar / versão da representação |
| \`If-None-Match\` / \`If-Match\` | req | requisições condicionais: \`304\` no cache, \`412\` na escrita |
| \`Retry-After\` | resp | quando tentar de novo (\`429\`, \`503\`) |
| \`traceparent\` | req | rastreamento distribuído (W3C Trace Context) |

Uma requisição **condicional** economiza banda: se a versão não mudou, volta um \`304\` sem corpo.

\`\`\`http
GET /produtos/7 HTTP/1.1
Host: api.loja.dev
Accept: application/json
If-None-Match: "v4"
\`\`\`

\`\`\`http
HTTP/1.1 304 Not Modified
ETag: "v4"
Cache-Control: max-age=60
\`\`\`

> [!sabia] O prefixo \`X-\` para cabeçalhos customizados (\`X-Request-Id\`, \`X-Forwarded-For\`) foi **desencorajado** em 2012 pela RFC 6648: quando um \`X-\` vira padrão, o nome fica preso para sempre. Foi o que aconteceu com o \`X-Forwarded-For\` — ganhou um sucessor oficial, o \`Forwarded\` (RFC 7239), e continua dominante mesmo assim.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o que quase ninguém sabe explicar direito: por que existem HTTP/2 **e** HTTP/3?',
          'A resposta é um vilão de nome comprido: **head-of-line blocking** — o primeiro da fila travado segurando todo mundo.',
        ],
        board: {
          title: 'HTTP/1.1 × HTTP/2 × HTTP/3',
          md: `\`\`\`text
 HTTP/1.1 — uma requisição por vez em cada conexão
   conexão 1: [ GET /app.js ██████████ lento ][ GET /logo.png ]  ← esperou o anterior
   (os navegadores abrem ~6 conexões por host para compensar)

 HTTP/2 — várias streams multiplexadas em UMA conexão TCP
   TCP: [js][css][img][js][css] ✗ [img][js]…
                                └ 1 pacote perdido: o TCP entrega EM ORDEM,
                                  então TODAS as streams esperam a retransmissão

 HTTP/3 — streams independentes sobre QUIC (UDP)
   stream js : [js][js] ✗ ·· [js]    ← só esta espera a retransmissão
   stream css: [css][css][css]       ← segue a vida
\`\`\`

| | HTTP/1.1 (1997) | HTTP/2 (2015) | HTTP/3 (2022) |
|---|---|---|---|
| Formato | texto | binário (frames) | binário (frames) |
| Transporte | TCP (+ TLS) | TCP + TLS | **QUIC** sobre UDP, com TLS 1.3 embutido |
| Concorrência | 1 requisição por vez por conexão | streams multiplexadas | streams multiplexadas **independentes** |
| Cabeçalhos | texto repetido a cada requisição | comprimidos (HPACK) | comprimidos (QPACK) |
| *Head-of-line blocking* | na conexão | resolvido no HTTP, **mas fica no TCP** | resolvido: a perda afeta só a própria stream |

O *pipelining* do HTTP/1.1 tentou mandar várias requisições sem esperar, mas as respostas precisam voltar **na ordem** — o mesmo problema — e os navegadores o desativaram.

> [!sabia] Em redes com muita perda de pacotes (4G ruim, Wi-Fi lotado), o HTTP/2 pode ficar **mais lento** que o HTTP/1.1: com uma só conexão TCP, cada perda congela tudo; com 6 conexões, só uma para. O QUIC ainda sobrevive à troca de rede — o *connection ID* permite sair do Wi-Fi para o 4G sem refazer a conexão.

> [!atencao] O TLS 1.3 e o QUIC permitem enviar dados já no primeiro voo de uma reconexão (**0-RTT**) — mas esses dados podem ser **reenviados por um atacante** (*replay*). Por isso só requisições idempotentes devem ir em 0-RTT, e existe até um status para recusar o resto: \`425 Too Early\` (RFC 8470).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Métodos, status codes, HTTP/2 × HTTP/3 e um parser HTTP de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-http-q1',
        concept: 'Safe × idempotente',
        say: 'Primeira: as duas propriedades dos métodos.',
        prompt: 'Qual afirmação sobre métodos HTTP está **correta**?',
        options: [
          { text: '`PUT` e `DELETE` são idempotentes, mas **não** são safe', correct: true, why: 'Os dois mudam estado (então não são safe), mas repeti-los dá no mesmo: substituir pelo mesmo conteúdo, ou apagar o que já foi apagado.' },
          { text: 'Um `POST` com o mesmo corpo é idempotente, porque o servidor recebe a mesma coisa', why: 'Mesmo corpo não é mesmo efeito: dois `POST /pedidos` iguais criam **dois** pedidos. Idempotência se promete no desenho da operação (ou com `Idempotency-Key`), não se deduz do payload.' },
          { text: 'Um `GET` que grava log de acesso deixa de ser safe', why: 'Safe é sobre a semântica que o cliente **pede**: ler. Efeitos que o cliente não pediu — logs, métricas, aquecer um cache — não quebram a propriedade.' },
          { text: 'O segundo `DELETE /itens/9` responder `404` prova que `DELETE` não é idempotente', why: 'Idempotência fala do **estado do servidor**, não da resposta: depois de 1 ou de 5 `DELETE`s, o item continua apagado. A resposta pode variar.' },
        ],
        explanation: '**Safe** ⊂ **idempotente**: `GET`, `HEAD`, `OPTIONS` e `TRACE` são as duas coisas; `PUT` e `DELETE` são só idempotentes; `POST` e `PATCH` não prometem nenhuma das duas. Essas garantias são o que permite a navegadores, proxies e bibliotecas **repetirem sozinhos** uma requisição que falhou no meio — e o que os impede de fazer isso com um `POST`.',
      },
      {
        type: 'match',
        id: 'api-http-q2',
        concept: 'Status codes',
        say: 'Hora do jogo dos status codes!',
        prompt: 'Associe cada situação ao status code mais adequado.',
        pairs: [
          { left: 'O token de acesso está ausente ou expirou', right: '`401 Unauthorized`' },
          { left: 'Usuário autenticado, mas sem permissão para ver a fatura', right: '`403 Forbidden`' },
          { left: 'JSON bem-formado, mas `"idade": -3` não passa na validação', right: '`422 Unprocessable Content`' },
          { left: 'O cupom foi desativado de propósito e não volta mais', right: '`410 Gone`' },
          { left: 'Pedido criado; a URL dele vai no `Location`', right: '`201 Created`' },
          { left: 'O gateway esperou o serviço de estoque e desistiu', right: '`504 Gateway Timeout`' },
        ],
        explanation: 'Dois pares merecem carinho. `401` é **autenticação** (quem é você?) e `403` é **autorização** (você pode?) — o nome "Unauthorized" do `401` é um nome infeliz que ficou da especificação original. E o `504` é o timeout **entre** o gateway e o upstream: se o upstream tivesse devolvido lixo ou derrubado a conexão, seria `502`; se o próprio serviço recusasse por sobrecarga, `503`.',
      },
      {
        type: 'mcq',
        id: 'api-http-q3',
        concept: 'Head-of-line blocking',
        say: 'Agora um caso de performance que confunde até gente experiente.',
        prompt: 'Um app móvel migrou de HTTP/1.1 (6 conexões por host) para HTTP/2 (1 conexão). No Wi-Fi do escritório ficou mais rápido — mas em 4G, com ~2% de perda de pacotes, o **p99 piorou**. Qual a explicação mais provável?',
        options: [
          { text: '*Head-of-line blocking* do **TCP**: todas as streams dividem uma conexão, e um pacote perdido faz **todas** esperarem a retransmissão', correct: true, why: 'Exato. O HTTP/2 resolveu o bloqueio na camada HTTP, mas o TCP entrega os bytes em ordem: uma perda congela todas as streams multiplexadas. Com 6 conexões, uma perda parava só uma delas.' },
          { text: 'O HTTP/2 não suporta multiplexação em redes móveis', why: 'Multiplexação é o recurso central do HTTP/2 e não depende do tipo de rede. O problema está **embaixo** dele, no TCP, quando há perda.' },
          { text: 'A compressão de cabeçalhos HPACK consome CPU demais no celular', why: 'O HPACK é barato e **reduz** os bytes transmitidos — ajuda em rede lenta. Não explica uma piora que só aparece com perda de pacotes.' },
          { text: 'O HTTP/2 exige TLS 1.3, cujo handshake é mais lento', why: 'O HTTP/2 exige TLS 1.2 ou superior, e o TLS 1.3 tem handshake **mais rápido** (1 RTT). Além disso, handshake pesa no início da conexão, não no p99 de uma conexão já aberta.' },
        ],
        explanation: 'É o motivo de existir o **HTTP/3**: ele roda sobre **QUIC** (UDP), em que cada stream tem a própria entrega ordenada — perder um pacote atrasa só a stream dele. De quebra, o QUIC junta transporte e TLS 1.3 num handshake só e sobrevive à troca de rede. Moral para entrevistas: multiplexar não basta; importa **onde** fica a fila.',
      },
      {
        type: 'order',
        id: 'api-http-q4',
        concept: 'Ciclo de uma requisição',
        say: 'Clássico de entrevista: o que acontece quando você digita uma URL e aperta Enter?',
        prompt: 'Você digita `https://loja.dev/produtos/7` num navegador que nunca acessou esse site. Ordene as etapas.',
        items: [
          'Resolver `loja.dev` para um endereço IP (DNS)',
          'Abrir a conexão TCP (*three-way handshake*)',
          'Handshake TLS: negociar as chaves e validar o certificado',
          'Enviar `GET /produtos/7` com o cabeçalho `Host`',
          'O servidor processa e devolve status, cabeçalhos e corpo',
          'O navegador renderiza o HTML e busca os sub-recursos (CSS, JS, imagens)',
        ],
        explanation: 'Cada etapa custa **idas e voltas** (RTTs): DNS, TCP (1 RTT) e TLS 1.3 (1 RTT) antes do primeiro byte útil. Por isso as conexões são **reaproveitadas** (*keep-alive*) — e o HTTP/3 junta transporte e criptografia: o QUIC faz o papel de TCP + TLS em **1 RTT**, ou 0 numa reconexão. Detalhes que rendem pontos extras: cache de DNS, HSTS (força HTTPS antes do primeiro pedido) e SNI, que diz ao servidor qual certificado apresentar.',
      },
      {
        type: 'code',
        id: 'api-http-q5',
        concept: 'Anatomia HTTP',
        title: 'Parser de requisição HTTP/1.1',
        say: 'Agora mão na massa: escreva um parser de requisição HTTP — estrito, do jeito que servidor sério faz.',
        prompt: `Implemente \`parse_requisicao(bruta)\`, que recebe o texto de uma requisição HTTP/1.x e devolve um dict:

\`\`\`python
{"metodo": "GET", "alvo": "/produtos/7?cor=azul", "versao": "HTTP/1.1",
 "headers": {"host": "api.loja.dev"}, "corpo": ""}
\`\`\`

- As linhas terminam em \`\\r\\n\`. A **linha vazia** separa os cabeçalhos do corpo; sem ela, a requisição está incompleta → \`ValueError\`.
- A 1ª linha tem **exatamente** 3 partes separadas por espaço: método, alvo e versão. Senão → \`ValueError\`.
- Cada cabeçalho é \`Nome: valor\`: o nome vira **minúsculas** e o valor perde os espaços das pontas. Linha sem \`:\` → \`ValueError\`.
- Espaço **entre o nome e os dois-pontos** (\`Host : x\`) → \`ValueError\`: a RFC 9112 manda rejeitar, porque isso é vetor de *request smuggling*.
- Cabeçalho repetido: junte os valores com \`", "\`, na ordem em que chegaram.
- \`HTTP/1.1\` sem \`Host\` → \`ValueError\`.
- O corpo é o que vem depois da linha vazia; se houver \`Content-Length\`, use só os \`N\` primeiros caracteres (o resto seria a próxima requisição).`,
        starter: `def parse_requisicao(bruta):
    """Interpreta uma requisição HTTP/1.x em texto e devolve um dict."""
    # TODO: linha inicial, cabeçalhos, linha vazia e corpo
    pass
`,
        tests: [
          {
            name: 'GET simples',
            setup: REQ,
            expr: `parse_requisicao(req("GET /produtos/7?cor=azul HTTP/1.1", "Host: api.loja.dev", "Accept: application/json"))`,
            expected: `{"metodo": "GET", "alvo": "/produtos/7?cor=azul", "versao": "HTTP/1.1", "headers": {"host": "api.loja.dev", "accept": "application/json"}, "corpo": ""}`,
          },
          {
            name: 'POST com corpo e Content-Length',
            setup: REQ,
            expr: `parse_requisicao(req("POST /pedidos HTTP/1.1", "Host: api.loja.dev", "Content-Type: application/json", "Content-Length: 24", corpo='{"produto": 7, "qtd": 2}'))`,
            expected: `{"metodo": "POST", "alvo": "/pedidos", "versao": "HTTP/1.1", "headers": {"host": "api.loja.dev", "content-type": "application/json", "content-length": "24"}, "corpo": '{"produto": 7, "qtd": 2}'}`,
          },
          {
            name: 'nomes em minúsculas; valores sem espaços nas pontas',
            setup: REQ,
            expr: `parse_requisicao(req("GET / HTTP/1.1", "HOST:   api.loja.dev  ", "X-Request-Id:abc-123"))["headers"]`,
            expected: `{"host": "api.loja.dev", "x-request-id": "abc-123"}`,
          },
          {
            name: 'cabeçalho repetido: valores unidos com vírgula',
            setup: REQ,
            expr: `parse_requisicao(req("GET / HTTP/1.1", "Host: api.loja.dev", "Accept: text/html", "accept: application/json"))["headers"]["accept"]`,
            expected: `"text/html, application/json"`,
          },
          {
            name: 'linha de requisição malformada → ValueError',
            setup: REQ,
            code: `for linha in ["GET /produtos", "GET /a b HTTP/1.1"]:
    try:
        parse_requisicao(req(linha, "Host: api.loja.dev"))
        assert False, f"deveria rejeitar a linha de requisição {linha!r}"
    except ValueError:
        pass`,
          },
          {
            name: 'cabeçalho sem dois-pontos → ValueError',
            setup: REQ,
            code: `try:
    parse_requisicao(req("GET / HTTP/1.1", "Host api.loja.dev"))
    assert False, "uma linha de cabeçalho sem ':' deveria gerar ValueError"
except ValueError:
    pass`,
          },
          {
            name: 'HTTP/1.1 sem Host → ValueError',
            setup: REQ,
            code: `try:
    parse_requisicao(req("GET /produtos HTTP/1.1", "Accept: application/json"))
    assert False, "HTTP/1.1 sem Host deveria gerar ValueError"
except ValueError:
    pass`,
          },
          {
            name: 'HTTP/1.0 sem Host é válido',
            hidden: true,
            setup: REQ,
            expr: `parse_requisicao(req("GET / HTTP/1.0"))`,
            expected: `{"metodo": "GET", "alvo": "/", "versao": "HTTP/1.0", "headers": {}, "corpo": ""}`,
          },
          {
            name: 'espaço entre o nome e os dois-pontos → ValueError',
            hidden: true,
            setup: REQ,
            code: `try:
    parse_requisicao(req("GET / HTTP/1.1", "Host : api.loja.dev"))
    assert False, "espaço antes dos dois-pontos deveria gerar ValueError (vetor de request smuggling)"
except ValueError:
    pass`,
          },
          {
            name: 'valor com dois-pontos; Content-Length corta o corpo',
            hidden: true,
            setup: REQ,
            code: `r = parse_requisicao(req("POST /a HTTP/1.1", "Host: api.loja.dev:8080", "Content-Length: 5", corpo="helloGET /proxima HTTP/1.1"))
assert r["headers"]["host"] == "api.loja.dev:8080", f"o valor mantém tudo depois do 1º ':'; veio {r['headers']['host']!r}"
assert r["corpo"] == "hello", f"Content-Length: 5 deveria dar o corpo 'hello'; veio {r['corpo']!r}"`,
          },
          {
            name: 'sem a linha vazia, a requisição está incompleta',
            hidden: true,
            code: `try:
    parse_requisicao("GET / HTTP/1.1\\r\\nHost: api.loja.dev")
    assert False, "sem a linha vazia (CRLF CRLF) a requisição está incompleta: ValueError"
except ValueError:
    pass`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /\.split\(\s*["']:["']\s*\)/.test(code),
            text: '`split(":")` sem limite quebra valores que têm dois-pontos (`Host: api.loja.dev:8080`, datas, URLs). Prefira `partition(":")` ou `split(":", 1)`: eles cortam só no **primeiro** separador.',
            concept: 'Parsing robusto',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo engole qualquer erro — inclusive bugs seus. Num parser, deixe as exceções inesperadas subirem e lance `ValueError` de propósito, com uma mensagem clara.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.maxComplexity > 10,
            text: 'A função principal acumulou decisões demais. Extraia `_parse_headers(linhas)`: cada regra do protocolo fica num lugar só e pode ser testada isoladamente.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Comece separando cabeça e corpo com `bruta.partition("\\r\\n\\r\\n")` — se o separador voltar vazio, a requisição está incompleta.',
          'Na cabeça, `split("\\r\\n")`: a 1ª linha vai para `linha.split(" ")` (tem que dar 3 partes). Em cada cabeçalho, `nome, sep, valor = linha.partition(":")` — o `partition` corta só no **primeiro** `:` e preserva `api.loja.dev:8080`.',
          'Rejeite quando `not sep` ou quando `nome != nome.strip()` (espaço antes dos dois-pontos). Repetidos: `headers[nome] + ", " + valor`. No fim: `Host` obrigatório no 1.1 e `corpo = resto[:int(headers["content-length"])]` quando houver.',
        ],
        solution: `def parse_requisicao(bruta):
    """Interpreta uma requisição HTTP/1.x em texto e devolve um dict."""
    cabeca, sep, resto = bruta.partition("\\r\\n\\r\\n")
    if not sep:
        raise ValueError("requisição incompleta: falta a linha vazia")
    linha_inicial, *linhas = cabeca.split("\\r\\n")
    partes = linha_inicial.split(" ")
    if len(partes) != 3:
        raise ValueError(f"linha de requisição inválida: {linha_inicial!r}")
    metodo, alvo, versao = partes
    headers = _parse_headers(linhas)
    if versao == "HTTP/1.1" and "host" not in headers:
        raise ValueError("HTTP/1.1 exige o cabeçalho Host")
    corpo = resto
    if "content-length" in headers:
        corpo = resto[:int(headers["content-length"])]
    return {"metodo": metodo, "alvo": alvo, "versao": versao,
            "headers": headers, "corpo": corpo}


def _parse_headers(linhas):
    headers = {}
    for linha in linhas:
        nome, sep, valor = linha.partition(":")
        if not sep or not nome or nome != nome.strip():   # inclui "Host : x"
            raise ValueError(f"cabeçalho inválido: {linha!r}")
        nome, valor = nome.lower(), valor.strip()
        headers[nome] = f"{headers[nome]}, {valor}" if nome in headers else valor
    return headers
`,
        solutionExplanation: 'O `partition` é a ferramenta certa aqui: corta no **primeiro** separador e diz se ele existia — serve para "cabeça × corpo" e para "nome × valor". O parser é **estrito** de propósito: rejeitar espaço antes dos dois-pontos e ambiguidades de tamanho é o que fecha a porta para o *request smuggling*, em que proxy e servidor discordam sobre onde termina uma requisição. O `Content-Length` corta o corpo porque, com conexões persistentes, o que vem depois já é a **próxima** requisição. Parsers reais trabalham com **bytes** (o `Content-Length` conta bytes, não caracteres), tratam `Transfer-Encoding: chunked` e não juntam `Set-Cookie` com vírgula — a exceção histórica à regra dos repetidos.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Agora você enxerga o HTTP por dentro — do CRLF ao QUIC.',
          { text: 'Resumo: safe ⊂ idempotente, status com semântica precisa, cabeçalhos como metadados — e o head-of-line blocking explica o HTTP/3.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
