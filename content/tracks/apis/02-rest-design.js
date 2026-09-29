Game.registerModule('apis', {
  id: 'rest-design',
  title: 'Design REST: recursos, maturidade e PATCH',
  kind: 'lesson',
  level: 2,
  order: 2,
  unit: 'fundamentos',
  summary: 'Desenhe recursos, não rotas: URIs e sub-recursos, o modelo de maturidade de Richardson, HATEOAS, ações que não são CRUD e PUT × PATCH — com um JSON Merge Patch implementado por você.',
  concepts: ['Recursos e URIs', 'Modelo de Richardson', 'HATEOAS', 'Ações não-CRUD', 'PUT × PATCH'],
  takeaways: [
    'REST é um **estilo arquitetural** (Fielding, 2000) com restrições — stateless, cache, interface uniforme —, não "JSON sobre HTTP".',
    'URIs nomeiam **recursos** (substantivos, plural, poucos níveis); o **método** é o verbo; filtro, ordenação e paginação vão na query string.',
    'Richardson: nível 0 (túnel POX) → 1 (recursos) → 2 (verbos + status) → 3 (hipermídia/HATEOAS). A maioria das APIs para, com razão, no nível 2.',
    'Ação que não é CRUD vira **recurso substantivado** (`POST /pedidos/42/cancelamento`), *custom method* (`:cancelar`) ou operação assíncrona (`202` + `Location`).',
    '`PUT` substitui o recurso **inteiro**; `PATCH` altera uma parte — **JSON Merge Patch** (`null` remove, listas inteiras) ou **JSON Patch** (operações atômicas, com `test`).',
  ],
  glossary: [
    { term: 'REST', aliases: ['RESTful', 'Representational State Transfer'], definition: '*Representational State Transfer*: estilo arquitetural descrito por Roy Fielding (2000), com restrições como cliente-servidor, **stateless**, cache, **interface uniforme** e sistema em camadas. Não é sinônimo de "JSON sobre HTTP".' },
    { term: 'HATEOAS', aliases: ['Hypermedia as the Engine of Application State', 'hipermídia como motor do estado'], definition: '*Hypermedia As The Engine Of Application State*: a resposta traz **links** para as próximas ações possíveis, e o cliente navega por eles em vez de montar URLs na mão. É o nível 3 de Richardson.' },
    { term: 'Modelo de maturidade de Richardson', aliases: ['Richardson Maturity Model', 'maturidade de Richardson', 'modelo de Richardson'], definition: 'Escala criada por Leonard Richardson (2008) para APIs web: nível 0 (um endpoint, tudo via `POST`), 1 (recursos), 2 (verbos e status HTTP) e 3 (controles de hipermídia).' },
    { term: 'JSON Merge Patch', aliases: ['merge patch', 'RFC 7396', 'RFC 7386'], definition: 'Formato de `PATCH` (RFC 7396, `application/merge-patch+json`): um JSON com o mesmo formato do alvo, em que objetos são mesclados recursivamente, listas são substituídas inteiras e `null` **remove** o campo.' },
    { term: 'JSON Patch', aliases: ['RFC 6902'], definition: 'Formato de `PATCH` (RFC 6902, `application/json-patch+json`): uma **lista de operações** (`add`, `remove`, `replace`, `move`, `copy`, `test`) com caminhos em JSON Pointer (`/itens/0/qtd`), aplicada de forma atômica.' },
    { term: 'Custom method', aliases: ['custom methods', 'método customizado', 'métodos customizados'], definition: 'Convenção do Google (AIP-136) para ações que não cabem no CRUD: `POST` no recurso com o verbo depois de dois-pontos, como `POST /pedidos/42:cancelar`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Todo mundo diz que faz API **REST**. Pouca gente sabe de onde o termo veio: da tese de doutorado de **Roy Fielding**, em 2000.',
        'REST não é "JSON sobre HTTP" — é um **estilo arquitetural**, com restrições. E cada uma existe por um motivo.',
      ],
      board: {
        title: 'REST: um estilo, não um formato',
        md: `| Restrição | O que exige | O que você ganha |
|---|---|---|
| Cliente-servidor | interface e dados separados | os dois lados evoluem de forma independente |
| **Stateless** | cada requisição traz tudo de que precisa (ex.: o token) | qualquer réplica atende; escala horizontal |
| Cacheável | as respostas dizem se podem ser guardadas | menos carga e menos latência |
| **Interface uniforme** | recursos com URIs, representações, mensagens autodescritivas, hipermídia | clientes genéricos; intermediários entendem o tráfego |
| Sistema em camadas | o cliente não sabe se fala com o servidor ou com um proxy | CDNs, gateways, balanceadores |
| Código sob demanda (opcional) | o servidor pode mandar código (JS) | clientes extensíveis |

A peça central é o **recurso**: qualquer coisa que mereça um nome — um pedido, um cliente, até um cancelamento. O cliente nunca toca o recurso em si, só **representações** dele (um JSON, um HTML) — daí o nome *Representational State Transfer*.

> [!sabia] Em 2008, o próprio Fielding escreveu um post irritado — *REST APIs must be hypertext-driven* — dizendo que a maioria das "APIs REST" não é REST, porque ignora a hipermídia. A indústria seguiu chamando assim mesmo.`,
      },
    },
    {
      type: 'say',
      text: [
        'Primeira regra prática: URIs nomeiam **coisas** (substantivos). O verbo quem dá é o **método HTTP**.',
        'Coleções no plural, um item pelo ID, sub-recursos para relações — e a query string para filtrar.',
      ],
      board: {
        title: 'Recursos e URIs',
        md: `\`\`\`text
 GET    /pedidos                  lista a coleção
 POST   /pedidos                  cria um pedido na coleção
 GET    /pedidos/42               lê o pedido 42
 PUT    /pedidos/42               substitui o pedido 42 por inteiro
 PATCH  /pedidos/42               altera parte do pedido 42
 DELETE /pedidos/42               remove o pedido 42
 GET    /clientes/7/pedidos       sub-recurso: os pedidos do cliente 7
 GET    /pedidos?status=pago&sort=-criado_em&limit=20
                                  filtro, ordenação e paginação
\`\`\`

| ❌ Evite | ✅ Prefira | Por quê |
|---|---|---|
| \`POST /criarPedido\` | \`POST /pedidos\` | o verbo já está no método |
| \`GET /getPedido?id=42\` | \`GET /pedidos/42\` | o ID faz parte do nome do recurso |
| \`POST /pedidos/42/delete\` | \`DELETE /pedidos/42\` | use a semântica do HTTP (e o retry seguro que vem com ela) |
| \`GET /clientes/7/pedidos/42/itens/3/produto\` | \`GET /produtos/99\` | aninhe no máximo 1–2 níveis; quem tem ID próprio merece URI própria |
| \`GET /pedidos.json\` | \`GET /pedidos\` + \`Accept: application/json\` | formato é negociação de conteúdo, não parte do nome |

> [!dica] Convenções que evitam discussão: coleções no **plural**, \`kebab-case\` nos caminhos (\`/notas-fiscais\`), IDs **opacos** (um auto-incremento exposto revela o volume do negócio) e **consistência** acima de gosto pessoal.

> [!sabia] *Cool URIs don't change* — Tim Berners-Lee, 1998. Uma URI é **contrato**: mudou, quebrou cliente, favorito e link em e-mail antigo. Se precisar mudar, responda \`301\` ou \`308\` apontando para a nova.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Quão REST é a sua API? O **modelo de maturidade de Richardson** mede isso numa escada de quatro degraus.',
        'A maioria das APIs do mercado para no **nível 2** — e tudo bem, desde que seja uma escolha consciente.',
      ],
      board: {
        title: 'Modelo de maturidade de Richardson',
        md: `\`\`\`text
 Nível 3 ─ Controles de hipermídia (HATEOAS)   ← "a glória do REST"
 Nível 2 ─ Verbos HTTP + status codes
 Nível 1 ─ Recursos: uma URI por coisa
 Nível 0 ─ O pântano do POX: um endpoint, tudo via POST
\`\`\`

**Nível 0** — o HTTP é só um túnel. Até o erro volta \`200\`:

\`\`\`http
POST /api HTTP/1.1
Content-Type: application/json

{"acao": "buscarPedido", "id": 42}
\`\`\`

\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json

{"erro": "pedido não encontrado"}
\`\`\`

**Nível 2** — o próprio protocolo carrega o significado:

\`\`\`http
GET /pedidos/42 HTTP/1.1
Host: api.loja.dev
\`\`\`

\`\`\`http
HTTP/1.1 404 Not Found
\`\`\`

| Nível | O que usa do HTTP | Exemplo típico |
|---|---|---|
| 0 | só o transporte | SOAP, XML-RPC, "RPC em JSON" |
| 1 | uma URI por recurso | \`POST /pedidos/42\` com \`{"acao": "cancelar"}\` |
| 2 | + métodos e status codes | a maioria das APIs "REST" |
| 3 | + links nas respostas | APIs hipermídia (HAL, JSON:API, Siren) |

> [!sabia] Leonard Richardson apresentou o modelo na QCon de 2008, e ele ficou famoso com um artigo de Martin Fowler (2010): *Richardson Maturity Model: steps toward the glory of REST*. **POX** é *Plain Old XML* — do tempo em que o túnel era XML.`,
      },
    },
    {
      type: 'say',
      text: [
        'No nível 3, a resposta diz **o que dá para fazer a seguir**. O cliente segue links em vez de montar URLs na mão.',
        'É como navegar num site: você não decora URLs, você clica. E o link "cancelar" só aparece quando cancelar é possível.',
      ],
      board: {
        title: 'HATEOAS: hipermídia como motor do estado',
        md: `\`\`\`json
{
  "id": 42,
  "status": "aguardando_pagamento",
  "total": 199.9,
  "_links": {
    "self":         {"href": "/pedidos/42"},
    "cliente":      {"href": "/clientes/7"},
    "pagamento":    {"href": "/pedidos/42/pagamento"},
    "cancelamento": {"href": "/pedidos/42/cancelamento"}
  }
}
\`\`\`

Depois de pago, \`pagamento\` e \`cancelamento\` somem e aparece \`reembolso\`: é o **estado** que decide quais links existem (o formato acima segue o estilo do HAL). Na paginação, os links podem ir até no cabeçalho \`Link\` (RFC 8288):

\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json
Link: <https://api.loja.dev/pedidos?cursor=b3Jk>; rel="next", <https://api.loja.dev/pedidos>; rel="first"
\`\`\`

| A favor | Contra |
|---|---|
| o servidor pode mudar URLs sem quebrar quem segue links | na prática, muitos clientes ignoram os links e fixam URLs |
| a regra "pode cancelar?" fica **só** no servidor | respostas maiores; pouco suporte em geradores de SDK |
| navegação e paginação padronizadas | exige disciplina dos dois lados |

> [!dica] Mesmo sem HATEOAS completo, dois usos pagam o custo: links de **paginação** (o GitHub usa o cabeçalho \`Link\` com \`rel="next"\`) e links **condicionais ao estado**, que evitam duplicar no front-end a regra de quando um pedido pode ser cancelado.`,
      },
    },
    {
      type: 'say',
      text: [
        'E quando a ação não é CRUD? **Cancelar** um pedido, **aprovar** um reembolso, **reenviar** um e-mail…',
        'O truque é **substantivar** a ação: o cancelamento vira um recurso que você cria com `POST`.',
      ],
      board: {
        title: 'Ações que não são CRUD',
        md: `\`\`\`http
POST /pedidos/42/cancelamento HTTP/1.1
Content-Type: application/json
Idempotency-Key: 8c1e0f3a-6d2b-4c1e-9a7f-2b3c4d5e6f70

{"motivo": "cliente desistiu"}
\`\`\`

\`\`\`http
HTTP/1.1 201 Created
Location: /pedidos/42/cancelamento
Content-Type: application/json

{"pedido": 42, "motivo": "cliente desistiu", "estorno": "pendente"}
\`\`\`

| Opção | Exemplo | Quando usar |
|---|---|---|
| **Recurso substantivado** | \`POST /pedidos/42/cancelamento\` | ação com regras, efeitos e histórico próprios (dá até para fazer \`GET\` depois) |
| Mudança de estado via \`PATCH\` | \`PATCH /pedidos/42\` com \`{"status": "cancelado"}\` | transições simples, sem efeitos colaterais relevantes |
| *Custom method* | \`POST /pedidos/42:cancelar\` | quando substantivar fica forçado (\`:traduzir\`, \`:reiniciar\`) |
| Operação assíncrona | \`POST /relatorios\` → \`202 Accepted\` + \`Location: /operacoes/abc\` | trabalho demorado: o cliente consulta o status depois |

> [!atencao] \`PATCH {"status": "cancelado"}\` parece elegante, mas esconde uma **ação de negócio** (estorno, e-mail, estoque) numa "edição de campo" — e convida o cliente a mandar \`{"status": "entregue"}\`. Se a transição tem regras, dê um nome a ela.

> [!sabia] O Google padronizou os *custom methods* na **AIP-136**: o verbo vem depois de **dois-pontos** no fim da URI (\`/v1/livros/123:arquivar\`), normalmente com \`POST\`. Os dois-pontos deixam claro que aquilo **não** é um sub-recurso.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Última peça: **PUT × PATCH**. O `PUT` manda o recurso **inteiro** — o que ficar de fora, some.',
        'Para alterar só um pedaço, use `PATCH`, em um de dois formatos padronizados com filosofias bem diferentes.',
      ],
      board: {
        title: 'PUT × PATCH: JSON Merge Patch e JSON Patch',
        md: `Recurso atual:

\`\`\`json
{"nome": "Ana", "email": "ana@x.dev", "telefone": "1199", "tags": ["vip", "beta"]}
\`\`\`

**JSON Merge Patch** (RFC 7396, que substituiu a RFC 7386) — um "pedaço" com o mesmo formato do alvo:

\`\`\`http
PATCH /clientes/7 HTTP/1.1
Content-Type: application/merge-patch+json

{"email": "ana@loja.dev", "telefone": null, "tags": ["vip"]}
\`\`\`

Resultado: \`email\` trocado, \`telefone\` **removido** (\`null\` apaga) e \`tags\` **substituída inteira**.

**JSON Patch** (RFC 6902) — uma lista de operações:

\`\`\`http
PATCH /clientes/7 HTTP/1.1
Content-Type: application/json-patch+json

[
  {"op": "test",    "path": "/email", "value": "ana@x.dev"},
  {"op": "replace", "path": "/email", "value": "ana@loja.dev"},
  {"op": "remove",  "path": "/tags/1"}
]
\`\`\`

| | \`PUT\` | JSON Merge Patch | JSON Patch |
|---|---|---|---|
| Envia | o recurso inteiro | um pedaço com o mesmo formato | uma lista de operações |
| Remover um campo | omitir | \`null\` | \`{"op": "remove"}\` |
| Mexer num item de lista | reenviar tudo | reenviar a lista toda | caminho \`/tags/1\` |
| Gravar \`null\` de verdade | sim | **impossível** | sim |
| Idempotente | sim | sim | não necessariamente (\`add\` em \`/tags/-\` acrescenta de novo) |

> [!sabia] O JSON Patch tem uma operação pouco conhecida: \`test\`. Se o valor no caminho não for o esperado, o patch **inteiro** falha — as operações são aplicadas de forma **atômica**. É concorrência otimista **dentro** do corpo da requisição, sem precisar de \`ETag\`.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'PUT × PATCH, a escada de Richardson, desenho de URIs e um merge patch de verdade.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'api-rest-q1',
      concept: 'PUT × PATCH',
      say: 'Primeira: um mal-entendido que já apagou muito dado em produção.',
      prompt: `O cliente 7 está assim no servidor:

\`\`\`json
{"nome": "Ana", "email": "ana@x.dev", "telefone": "1199"}
\`\`\`

O app envia \`PUT /clientes/7\` com o corpo \`{"email": "ana@loja.dev"}\`. Pela semântica do HTTP, qual deve ser o estado final?`,
      options: [
        { text: 'Só `{"email": "ana@loja.dev"}`: o `PUT` substitui a representação **inteira**, e o que não foi enviado deixa de existir', correct: true, why: 'Isso: `PUT` é "o estado agora é **este**". Um servidor cuidadoso pode até recusar com `422` um `PUT` sem campos obrigatórios — mas nunca deve tratá-lo como alteração parcial.' },
        { text: '`{"nome": "Ana", "email": "ana@loja.dev", "telefone": "1199"}`: o `PUT` só altera os campos enviados', why: 'Esse é o comportamento de um `PATCH` com merge. Muita API implementa `PUT` assim, e os clientes que se acostumam apagam dados no primeiro servidor que segue a especificação.' },
        { text: 'O servidor deve responder `405 Method Not Allowed`, porque `PUT` só serve para criar recursos', why: '`PUT` cria **ou substitui** o recurso na URI indicada. O `405` é para quando o método não é suportado naquele recurso.' },
        { text: 'Depende do `Content-Type`: com `application/json`, o `PUT` vira merge automaticamente', why: 'O tipo de mídia define o **formato** do corpo, não a semântica do método. Quem diz "parcial" é o `PATCH`, com `application/merge-patch+json` ou `application/json-patch+json`.' },
      ],
      explanation: '`PUT` tem semântica de **substituição** — e é por isso que ele é idempotente: mandar o mesmo estado duas vezes dá no mesmo. Para alterar um campo, use `PATCH` com **JSON Merge Patch** (`{"email": "..."}`, com `null` para remover) ou **JSON Patch** (lista de operações). Uma defesa comum: aceitar `PUT` só com `If-Match`, para que um cliente desatualizado não sobrescreva o recurso inteiro com dados velhos.',
    },
    {
      type: 'order',
      id: 'api-rest-q2',
      concept: 'Modelo de maturidade de Richardson',
      say: 'Agora suba a escada de Richardson, do pântano à glória.',
      prompt: 'Ordene os níveis do modelo de maturidade de Richardson, do **mais baixo** ao **mais alto**.',
      items: [
        'Um único endpoint recebe `POST` com o nome da ação no corpo',
        'Cada entidade ganha sua própria URI, mas tudo ainda passa por `POST`',
        'Métodos HTTP e status codes usados com a semântica certa',
        'As respostas trazem links para as próximas ações possíveis',
      ],
      explanation: 'Nível 0 (**pântano do POX**) usa o HTTP só como túnel; o nível 1 introduz **recursos**; o nível 2 usa **verbos e status** — e ganha de graça cache, retries seguros e ferramentas que entendem o tráfego; o nível 3 acrescenta **controles de hipermídia** (HATEOAS). Numa entrevista, vale dizer que o nível 2 é o padrão de mercado e que o 3 compensa quando os clientes precisam descobrir ações dinamicamente.',
    },
    {
      type: 'match',
      id: 'api-rest-q3',
      concept: 'Design de URIs e métodos',
      say: 'Hora de desenhar. Associe cada necessidade à requisição certa.',
      prompt: 'Associe cada necessidade à requisição mais adequada.',
      pairs: [
        { left: 'Listar os pedidos do cliente 7', right: '`GET /clientes/7/pedidos`' },
        { left: 'Pedidos pagos, mais recentes primeiro', right: '`GET /pedidos?status=pago&sort=-criado_em`' },
        { left: 'Cancelar o pedido 42, com estorno e auditoria', right: '`POST /pedidos/42/cancelamento`' },
        { left: 'Trocar só o e-mail do cliente 7', right: '`PATCH /clientes/7`' },
        { left: 'Substituir por completo as preferências do cliente 7', right: '`PUT /clientes/7/preferencias`' },
        { left: 'Gerar um relatório que leva minutos', right: '`POST /relatorios` → `202 Accepted`' },
      ],
      explanation: 'Sub-recurso para relação de posse (`/clientes/7/pedidos`); **query string** para filtrar, ordenar e paginar a mesma coleção; ação de negócio **substantivada**; `PATCH` para mudança parcial e `PUT` para substituição completa; e `202 Accepted`, com um `Location` apontando para o status da operação, quando o trabalho é demorado — o cliente consulta depois (ou recebe um webhook).',
    },
    {
      type: 'code',
      id: 'api-rest-q4',
      concept: 'JSON Merge Patch',
      title: 'Aplicar um JSON Merge Patch',
      say: 'Agora é código: implemente o JSON Merge Patch. O algoritmo da RFC cabe em dez linhas — mas os casos de borda são traiçoeiros.',
      prompt: `Implemente \`aplicar_merge_patch(alvo, patch)\` seguindo o **JSON Merge Patch** (RFC 7396). Os documentos já chegam como Python: objeto JSON = \`dict\`, array = \`list\`, \`null\` = \`None\`.

- Se o \`patch\` **não** for um dict, ele **substitui** o alvo inteiro (listas, strings, números e \`None\` também).
- Se o \`patch\` for um dict:
  - se o \`alvo\` não for um dict, comece de um dict **vazio**;
  - para cada campo do patch: valor \`None\` → **remove** o campo (se existir); qualquer outro valor → aplique o merge patch **recursivamente** sobre o valor atual do campo.
- Listas **não** são mescladas: são substituídas por inteiro.
- Não modifique \`alvo\` nem \`patch\`: devolva um documento novo.

\`\`\`python
aplicar_merge_patch({"a": "b", "c": {"d": "e", "f": "g"}},
                    {"a": "z", "c": {"f": None}})
# {"a": "z", "c": {"d": "e"}}
\`\`\``,
      starter: `def aplicar_merge_patch(alvo, patch):
    """Aplica um JSON Merge Patch (RFC 7396) e devolve um documento novo."""
    # TODO
    pass
`,
      tests: [
        {
          name: 'troca e acrescenta campos',
          expr: `aplicar_merge_patch({"a": "b"}, {"a": "c", "b": "d"})`,
          expected: `{"a": "c", "b": "d"}`,
        },
        {
          name: 'None remove o campo (e ignora campo inexistente)',
          expr: `aplicar_merge_patch({"a": "b", "b": "c"}, {"a": None, "x": None})`,
          expected: `{"b": "c"}`,
        },
        {
          name: 'objetos aninhados são mesclados recursivamente',
          expr: `aplicar_merge_patch({"titulo": "Olá", "autor": {"nome": "Ana", "email": "a@x.dev"}}, {"titulo": "Oi", "autor": {"email": None, "site": "ana.dev"}})`,
          expected: `{"titulo": "Oi", "autor": {"nome": "Ana", "site": "ana.dev"}}`,
        },
        {
          name: 'listas são substituídas inteiras',
          expr: `aplicar_merge_patch({"tags": ["vip", "beta"], "n": 1}, {"tags": ["vip"]})`,
          expected: `{"tags": ["vip"], "n": 1}`,
        },
        {
          name: 'não modifica o alvo nem o patch',
          code: `import copy
alvo = {"a": {"b": 1, "c": [1, 2]}, "d": 4}
patch = {"a": {"b": None, "e": {"f": None, "g": 5}}, "d": None}
alvo0, patch0 = copy.deepcopy(alvo), copy.deepcopy(patch)
r = aplicar_merge_patch(alvo, patch)
assert r == {"a": {"c": [1, 2], "e": {"g": 5}}}, f"resultado errado: {r!r}"
assert alvo == alvo0, f"o alvo foi modificado: {alvo!r}"
assert patch == patch0, f"o patch foi modificado: {patch!r}"`,
        },
        {
          name: 'patch que não é dict substitui tudo',
          hidden: true,
          code: `assert aplicar_merge_patch({"a": "foo"}, "bar") == "bar", "patch string substitui o alvo"
assert aplicar_merge_patch({"a": "b"}, ["c"]) == ["c"], "patch lista substitui o alvo"
assert aplicar_merge_patch({"a": "foo"}, None) is None, "patch null substitui o alvo por null"
assert aplicar_merge_patch({"a": [{"b": "c"}]}, {"a": [1]}) == {"a": [1]}, "listas não são mescladas"`,
        },
        {
          name: 'alvo que não é dict vira {}',
          hidden: true,
          code: `r = aplicar_merge_patch([1, 2], {"a": "b", "c": None})
assert r == {"a": "b"}, f"alvo lista + patch objeto deveria dar {{'a': 'b'}}, veio {r!r}"
r = aplicar_merge_patch({"a": "texto"}, {"a": {"b": 1}})
assert r == {"a": {"b": 1}}, f"campo string + patch objeto deveria virar objeto, veio {r!r}"`,
        },
        {
          name: 'None dentro de objeto novo é descartado',
          hidden: true,
          expr: `aplicar_merge_patch({}, {"a": {"bb": {"ccc": None}}})`,
          expected: `{"a": {"bb": {}}}`,
        },
        {
          name: 'None que já estava no alvo é preservado',
          hidden: true,
          expr: `aplicar_merge_patch({"e": None}, {"a": 1})`,
          expected: `{"e": None, "a": 1}`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /type\([^)]*\)\s*(==|is)\s*dict/.test(code),
          text: 'Prefira `isinstance(x, dict)` a `type(x) == dict`: o `isinstance` aceita subclasses (`OrderedDict`, `defaultdict`) — e documentos JSON vindos de outras bibliotecas às vezes são exatamente isso.',
          concept: 'isinstance',
        },
        {
          when: (m, code) => /[=!]=\s*None\b/.test(code),
          text: 'Compare com `None` usando `is` / `is not` (PEP 8). O `==` passa pelo `__eq__`, que pode ser sobrescrito — e aqui o `None` tem significado especial (remover), então a checagem precisa ser exata.',
          concept: 'Comparação com None',
        },
        {
          when: m => m.maxComplexity > 8,
          text: 'A função ficou com caminhos demais. O algoritmo da RFC tem só dois casos — patch que não é objeto (substitui) e patch objeto (laço com remoção ou recursão). Deixe a **recursão** tratar os níveis, em vez de ramificar por tipo em cada nível.',
          concept: 'Recursão',
        },
      ],
      hints: [
        'Comece pelo caso-base: se o `patch` não é `dict`, ele **é** o resultado (devolva uma cópia, para não compartilhar objetos com quem chamou).',
        'Se o patch é `dict`: `resultado = dict(alvo) if isinstance(alvo, dict) else {}`. Uma cópia **rasa** basta, porque a recursão copia cada nível que ela tocar.',
        'No laço: `if valor is None: resultado.pop(campo, None)`; senão, `resultado[campo] = aplicar_merge_patch(resultado.get(campo), valor)`. A recursão com `alvo=None` já resolve os objetos novos — e descarta os `None` dentro deles.',
      ],
      solution: `import copy


def aplicar_merge_patch(alvo, patch):
    """Aplica um JSON Merge Patch (RFC 7396) e devolve um documento novo."""
    if not isinstance(patch, dict):
        return copy.deepcopy(patch)              # não-objeto substitui tudo
    resultado = dict(alvo) if isinstance(alvo, dict) else {}
    for campo, valor in patch.items():
        if valor is None:
            resultado.pop(campo, None)           # null remove
        else:
            resultado[campo] = aplicar_merge_patch(resultado.get(campo), valor)
    return resultado
`,
      solutionExplanation: 'É a tradução direta do pseudocódigo da RFC 7396: se o patch não é objeto, ele **é** o resultado; se é, cada campo com `null` remove e os demais são mesclados **recursivamente**. A cópia rasa em cada nível garante que o `alvo` nunca é modificado — só os níveis tocados são copiados, e o resto é compartilhado sem risco. Os casos de borda saem de graça: objetos novos são construídos a partir de `{}` (por isso `{"ccc": null}` some) e listas nunca entram no laço (são substituídas). A limitação do formato fica evidente: não há como **gravar** `null` num campo — para isso, só `PUT` ou JSON Patch.',
    },
    {
      type: 'open',
      id: 'api-rest-q5',
      concept: 'Design REST',
      say: 'Última: uma revisão de design. Me convença.',
      prompt: `Um colega propôs esta API para o app de pedidos:

\`\`\`http
POST /api HTTP/1.1
Content-Type: application/json

{"acao": "cancelarPedido", "pedidoId": 42}
\`\`\`

Toda resposta volta \`200 OK\`, com \`{"erro": ...}\` no corpo quando algo falha. Em que nível de Richardson isso está, que problemas traz e como você redesenharia?`,
      minWords: 30,
      rubric: [
        { label: 'Identifica o **nível 0** de Richardson (pântano do POX: RPC num endpoint só)', keywords: ['nivel 0', 'nivel zero', 'pox', 'pantano', 'rpc', 'tunel', 'endpoint unico', 'unico endpoint', 'um endpoint so', 'so um endpoint'], concept: 'Modelo de maturidade de Richardson', why: 'Um endpoint que recebe o nome da ação no corpo é RPC tunelado no HTTP: o degrau zero da escada.' },
        { label: 'Aponta o que se perde: cache, retries seguros e monitoração por status', keywords: ['cache', 'retry', 'retries', 'retent', 'repeti', 'monitor', 'alerta', 'observab', 'metrica', 'proxy', 'intermediar', 'idempot'], concept: 'Semântica do HTTP', why: 'Com tudo em `POST` e `200`, nenhum intermediário entende o tráfego: nada de cache, nada de retry automático seguro, e o dashboard mostra 100% de sucesso enquanto os erros se escondem no corpo.' },
        { label: 'Redesenha com **recursos** e métodos (ex.: `POST /pedidos/42/cancelamento`)', keywords: ['/pedidos', 'recurso', 'substantiv', 'cancelamento', 'uri', 'verbo', 'metodo'], concept: 'Recursos e URIs', why: 'Cada coisa ganha uma URI, o método carrega a intenção e a ação de negócio vira um recurso com nome.' },
        { label: 'Usa status codes com semântica no sucesso e nos erros (`201`, `404`, `409`, `422`…)', keywords: ['404', '409', '422', '400', '201', '412', 'status code', 'codigo de status', 'codigos de status', 'codigo http', 'codigos http'], concept: 'Status codes', why: 'O status é o resumo que clientes, proxies e monitoração leem — erro de negócio com `200` é invisível para todos eles.' },
      ],
      modelAnswer: `Isso é o **nível 0** de Richardson — o pântano do POX: um único endpoint, tudo via \`POST\`, e o HTTP usado só como túnel para um RPC.

Os problemas: como tudo é \`POST\` e tudo volta \`200\`, nenhum intermediário entende o tráfego. Não dá para usar **cache** nas leituras, a biblioteca HTTP não sabe quando um **retry** é seguro, e a **monitoração** por status code enxerga 100% de sucesso enquanto os erros se escondem no corpo.

Eu redesenharia com **recursos** e métodos: \`GET /pedidos/42\` para ler e o cancelamento como recurso substantivado, \`POST /pedidos/42/cancelamento\` (com \`Idempotency-Key\`), respondendo \`201 Created\`. Nos erros, status com semântica: \`404\` se o pedido não existe, \`409\` se ele já foi enviado e não pode mais ser cancelado, \`422\` para um motivo inválido — com o corpo no formato Problem Details. Isso leva a API ao nível 2; links de hipermídia (nível 3) seriam um bônus para o app descobrir se "cancelar" está disponível.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo trabalho! Agora você desenha **recursos**, não só rotas.',
        { text: 'Resumo: substantivos nas URIs, verbos no método, ações substantivadas, PUT substitui e PATCH mescla — e hipermídia quando o cliente precisa descobrir o caminho.', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
