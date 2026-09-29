(function () {
  // Prelúdio dos testes de paginação: monta um pedido mínimo.
  const PRE_PAG = `def ped(i, t):
    return {"id": i, "criado_em": t}

`;

  Game.registerModule('apis', {
    id: 'paginacao-erros',
    title: 'Paginação, filtros e erros (Problem Details)',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'design',
    summary: 'Listas que não pulam nem repetem itens (offset × cursor/keyset, cursores opacos, filtros e ordenação) e erros num formato que qualquer cliente entende: RFC 9457 Problem Details — com 400 × 422 sem confusão.',
    concepts: ['Offset × keyset', 'Cursor opaco', 'Filtros e ordenação', 'Problem Details (RFC 9457)', '400 × 422'],
    takeaways: [
      '**Offset** é simples e permite saltar para a página N, mas o banco lê e descarta todas as linhas puladas — e inserções ou remoções entre as páginas fazem a lista **repetir** ou **pular** itens.',
      '**Keyset/cursor** continua a partir da chave do último item visto: custo estável com índice e nenhuma repetição — desde que a ordenação seja **total** (desempate por um campo único, como `id`).',
      'O cursor é **opaco** (ex.: base64url de JSON): o cliente só o repassa. Amarre-o a filtros e ordenação, valide-o como entrada não confiável e assine-o se não puder ser adulterado.',
      'Erros em **Problem Details** (RFC 9457, `application/problem+json`): `type` identifica o problema para máquinas, `title`/`detail` explicam para humanos e extensões como `errors` apontam cada campo.',
      '**400** para requisição malformada (JSON quebrado, parâmetro ilegível); **422** para conteúdo bem-formado que viola as regras. Mais importante que a escolha: ser consistente e documentar.',
    ],
    glossary: [
      { term: 'Keyset pagination', aliases: ['paginação por keyset', 'paginacao por keyset', 'paginação keyset', 'keyset', 'seek method'], definition: 'Paginação que continua **depois do último item visto** (`WHERE (criado_em, id) < (:c, :i) ORDER BY criado_em DESC, id DESC LIMIT n`) em vez de pular N linhas. Custo estável com índice e sem pular nem repetir itens quando a lista muda.' },
      { term: 'Cursor opaco', aliases: ['cursores opacos', 'opaque cursor', 'cursor de paginação', 'cursor de paginacao'], definition: 'Token de paginação que o cliente só **repassa**, sem interpretar (ex.: base64url de um JSON com a chave do último item). Opaco não é secreto: se não pode ser adulterado, assine-o (HMAC).' },
      { term: 'Problem Details', aliases: ['RFC 9457', 'RFC 7807', 'application/problem+json', 'problem+json'], definition: 'Formato padrão para erros de APIs HTTP (RFC 9457, que substituiu a RFC 7807): um JSON `application/problem+json` com `type`, `title`, `status`, `detail`, `instance` e extensões como `errors`.' },
      { term: 'Paginação profunda', aliases: ['paginacao profunda', 'deep pagination'], definition: 'Pedir páginas muito distantes com offset (`OFFSET 1000000`): o banco precisa ler e descartar todas as linhas anteriores, então cada página fica mais lenta que a anterior.' },
      { term: 'Unprocessable Content', aliases: ['422 Unprocessable Content', 'Unprocessable Entity', '422 Unprocessable Entity'], definition: 'Status **422**: a requisição está bem-formada (JSON válido, `Content-Type` certo), mas o conteúdo viola regras de validação ou de negócio. Nasceu no WebDAV e entrou no núcleo do HTTP na RFC 9110 (2022), com o nome novo.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje vamos falar de duas coisas que toda API faz — e quase toda API faz meio mal: **listar muita coisa** e **reclamar de erros**.',
          'Começando pela lista: devolver 2 milhões de pedidos num JSON só derruba o servidor, a rede e o celular do cliente. Então a gente **pagina**.',
        ],
        board: {
          title: 'Por que paginar (e sempre com limite)',
          md: `\`\`\`http
GET /pedidos?limit=20&offset=40 HTTP/1.1
Host: api.loja.dev
Accept: application/json
\`\`\`

\`\`\`json
{
  "dados": [{"id": 1508, "status": "pago", "total": 99.9}],
  "limit": 20,
  "offset": 40,
  "total": 1532
}
\`\`\`

| Sem paginação | Com paginação |
|---|---|
| resposta de tamanho **imprevisível** (hoje 2 KB, amanhã 200 MB) | tamanho **limitado** por página |
| uma consulta enorme por requisição | custo por página sob controle |
| timeout no cliente, falta de memória no servidor | respostas rápidas e previsíveis |

> [!dica] Imponha um **teto** no servidor (ex.: \`limit\` padrão 20, máximo 100). Se o cliente pedir \`limit=100000\`, você decide: **limitar** ao máximo (e dizer isso na resposta) ou responder **400**. Nunca confie que o cliente vai pedir pouco.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O jeito mais comum é **offset/limit**: "pule 40, me dê 20". É simples e deixa saltar direto para a página 37.',
          'Mas tem dois defeitos sérios: fica **mais lento** a cada página e **pula ou repete** itens quando a lista muda entre uma página e outra.',
        ],
        board: {
          title: 'Offset: lento no fundo, instável no meio',
          md: `\`\`\`sql
-- página 5.001, com 20 itens por página
SELECT id, criado_em, total
FROM pedidos
ORDER BY criado_em DESC
LIMIT 20 OFFSET 100000;   -- o banco lê 100.020 linhas e joga fora 100.000
\`\`\`

**Defeito 1 — custo linear.** O \`OFFSET\` não "pula" de graça: o banco percorre (e descarta) todas as linhas anteriores, mesmo com índice. A página 1 leva 2 ms; a página 5.000 leva segundos. É a **paginação profunda** (*deep pagination*).

**Defeito 2 — janela deslizante.** O offset é uma **posição** na lista **atual**. Se a lista muda entre as requisições, as posições mudam junto:

\`\`\`text
 Página 1 (offset=0, limit=3):    E  D  C
 ── chega o pedido F, o mais novo ──
 Lista agora:                     F  E  D  C  B  A
 Página 2 (offset=3, limit=3):             C  B  A    ← o C aparece DE NOVO

 E se, em vez disso, alguém apagar o D antes da página 2?
 Lista agora:                     E  C  B  A
 Página 2 (offset=3, limit=3):             A          ← o B nunca aparece: PULOU
\`\`\`

> [!sabia] O Elasticsearch recusa, por padrão, qualquer busca com \`from + size\` acima de **10.000** (\`index.max_result_window\`) — justamente por causa do custo da paginação profunda. Para ir além, a própria documentação manda usar \`search_after\`, que é paginação por **keyset**.`,
        },
      },
      {
        type: 'say',
        text: [
          'A alternativa é a paginação por **keyset** (ou por **cursor**): em vez de "pule 40", o cliente diz "continue **depois deste item**".',
          'Com um índice, o banco vai direto ao ponto — a página 5.000 custa o mesmo que a primeira. E um pedido novo no topo não empurra nada.',
        ],
        board: {
          title: 'Keyset: continue depois do último item visto',
          md: `\`\`\`sql
-- índice composto na MESMA ordem da listagem
CREATE INDEX idx_pedidos_lista ON pedidos (criado_em DESC, id DESC);

-- página seguinte: tudo que vem DEPOIS do (criado_em, id) do último item entregue
SELECT id, criado_em, total
FROM pedidos
WHERE (criado_em, id) < (:ultimo_criado_em, :ultimo_id)   -- "row values"
ORDER BY criado_em DESC, id DESC
LIMIT 21;                                                -- 20 + 1: sobrou um? há próxima página
\`\`\`

| | Offset | Keyset / cursor |
|---|---|---|
| Custo da página N | cresce com N (lê e descarta) | constante (busca no índice) |
| Inserções/remoções entre páginas | repete ou pula itens | estável |
| Saltar para a página 37 | sim | não (só próxima/anterior) |
| "Total de resultados" | fácil de pedir (mas \`COUNT(*)\` é caro) | à parte |
| Ordenação | qualquer uma | precisa de índice e de **ordem total** |

> [!atencao] A ordenação precisa ser **total**: se dois pedidos têm o mesmo \`criado_em\`, o \`id\` desempata. Sem desempate, itens com a mesma chave podem sumir na fronteira entre duas páginas. Onde não há *row values*, escreva a forma expandida: \`criado_em < :c OR (criado_em = :c AND id < :i)\`.

> [!sabia] Markus Winand, autor do *Use The Index, Luke*, chama essa técnica de **seek method** e mantém a campanha **#NoOffset**. E o truque do \`LIMIT n + 1\` responde "tem mais?" sem nenhum \`COUNT(*)\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'O cliente não precisa saber **qual** é a chave: ele recebe um **cursor opaco** e só o devolve na próxima chamada.',
          'Opaco quer dizer: "não interprete, não monte na mão". Isso deixa você livre para mudar a implementação sem quebrar ninguém.',
        ],
        board: {
          title: 'Cursores opacos',
          md: `\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json
Link: <https://api.loja.dev/pedidos?limit=20&cursor=WzE3MjAwMDAwMDAsIDQyXQ==>; rel="next"
\`\`\`

\`\`\`json
{
  "dados": [{"id": 42, "criado_em": 1720000000, "total": 99.9}],
  "proximo": "WzE3MjAwMDAwMDAsIDQyXQ==",
  "tem_mais": true
}
\`\`\`

\`\`\`python
import base64
import json

def codificar_cursor(chave):
    """(1720000000, 42) → 'WzE3MjAwMDAwMDAsIDQyXQ=='  (base64url de um JSON)"""
    return base64.urlsafe_b64encode(json.dumps(list(chave)).encode()).decode()

def decodificar_cursor(cursor):
    return tuple(json.loads(base64.urlsafe_b64decode(cursor)))   # e valide o formato!
\`\`\`

- **base64url** (alfabeto com \`-\` e \`_\`) porque o cursor viaja na URL; \`+\` e \`/\` exigiriam escape.
- Guarde no cursor o que a consulta precisa: a chave do último item, uma **versão** do formato e um resumo dos **filtros e da ordenação** — cursor reaproveitado com outro filtro vira **400**.
- O cabeçalho \`Link\` com \`rel="next"\` (RFC 8288) é o jeito "HTTP puro" de apontar a próxima página; a API do GitHub pagina assim.

> [!atencao] **Opaco não é secreto**: qualquer um decodifica base64. Trate o cursor como **entrada não confiável** (valide tipo e formato; jamais \`pickle\` ou \`eval\`) e, se ele carregar algo que não pode ser adulterado, **assine** com HMAC.`,
        },
      },
      {
        type: 'say',
        text: [
          'Listas de verdade vêm com **filtros** e **ordenação**. Aqui o segredo é ser previsível — e desconfiado.',
          'Cada combinação de filtro e ordem é uma consulta que o banco precisa aguentar. Você escolhe o que oferece; o resto é **400**.',
        ],
        board: {
          title: 'Filtros e ordenação sem surpresas',
          md: `\`\`\`http
GET /pedidos?status=pago,enviado&criado_desde=2025-01-01T00:00:00Z&ordem=-criado_em&limit=50 HTTP/1.1
Host: api.loja.dev
\`\`\`

| Decisão | Convenção comum |
|---|---|
| Igualdade e listas | \`status=pago\` · \`status=pago,enviado\` |
| Intervalos | \`criado_desde=…&criado_ate=…\` ou \`total[gte]=100\` (estilo Stripe) |
| Ordenação | \`ordem=-criado_em\` (o \`-\` indica decrescente, como no JSON:API) |
| Campos permitidos | **lista branca**: só filtra/ordena por campos com índice |
| Datas | ISO 8601 com fuso (\`2025-01-01T00:00:00Z\`) |

\`\`\`python
ORDENAVEIS = {"criado_em", "total"}            # lista branca: campos com índice

def order_by(ordem):
    campo = ordem.removeprefix("-")
    if campo not in ORDENAVEIS:                # nada do cliente vai cru para o SQL
        raise ValueError(f"ordem não suportada: {ordem!r}")
    direcao = "DESC" if ordem.startswith("-") else "ASC"
    return f"ORDER BY {campo} {direcao}, id {direcao}"   # desempate por campo único
\`\`\`

> [!dica] O cursor precisa "lembrar" filtros e ordenação. Se o cliente mudar o \`status\` mas reaproveitar o cursor antigo, responda **400** — a posição salva não faz sentido na lista nova.

> [!atencao] \`total\` exato custa caro: um \`COUNT(*)\` com filtros lê o conjunto inteiro a cada página. Muitas APIs (a do Stripe, por exemplo) devolvem só \`has_more\`. Se o produto precisa do número, ofereça uma **estimativa** ou um total em cache.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora os erros. Cada API inventa o seu formato: `{"erro": …}`, `{"message": …}`, `{"errors": […]}` — e cada cliente escreve um parser diferente.',
          'Existe um padrão para isso: **Problem Details**, a RFC 9457. Um formato só, para todos os erros.',
        ],
        board: {
          title: 'RFC 9457: Problem Details',
          md: `\`\`\`http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: pt-BR
\`\`\`

\`\`\`json
{
  "type": "https://api.loja.dev/problemas/validacao",
  "title": "Dados do pedido inválidos",
  "status": 422,
  "detail": "2 campos precisam de correção.",
  "instance": "/erros/7f3a9c",
  "errors": [
    {"pointer": "#/itens/0/quantidade", "detail": "deve ser maior que zero"},
    {"pointer": "#/cep", "detail": "formato esperado: 00000-000"}
  ]
}
\`\`\`

| Membro | Para quem | O que é |
|---|---|---|
| \`type\` | **máquinas** | URI que identifica o **tipo** do problema — é o que o código do cliente checa. Ausente = \`about:blank\` |
| \`title\` | humanos | resumo curto, **igual** em todas as ocorrências do tipo |
| \`status\` | ambos | cópia do status HTTP (útil quando o JSON vai parar num log ou numa fila) |
| \`detail\` | humanos | explicação **desta** ocorrência, focada em como corrigir |
| \`instance\` | suporte | URI **desta** ocorrência (correlação com logs) |
| extensões | máquinas | campos extras, como \`errors\`, \`saldo_atual\`, \`trace_id\` |

> [!atencao] O cliente **não** deve fazer parsing do \`detail\` (é texto para gente: muda e pode até ser traduzido). Dado que o código precisa ler vira **extensão**. E nada de stack trace ou SQL no \`detail\`: isso é vazamento de informação.

> [!sabia] A RFC 9457 (2023) substituiu a RFC 7807 (2016). Entre as novidades: um **registro na IANA** de tipos de problema comuns e orientação para relatar **vários erros de uma vez** — exatamente o \`errors\` com \`pointer\` (um *JSON Pointer* para o campo) do exemplo.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, a dúvida clássica: **400 ou 422**? A regra prática é separar **forma** de **conteúdo**.',
          'Se não deu nem para entender a requisição, é 400. Se deu para entender, mas o conteúdo viola as regras, é 422.',
        ],
        board: {
          title: '400 × 422 (e os vizinhos)',
          md: `| Situação | Status |
|---|---|
| JSON quebrado (\`{"cep": \`), parâmetro ilegível (\`limit=abc\`), cursor adulterado | **400** Bad Request |
| \`Content-Type: text/xml\` num endpoint que só entende JSON | **415** Unsupported Media Type |
| JSON válido, mas \`quantidade: -3\` ou CEP com formato errado | **422** Unprocessable Content |
| Conflito com o estado atual (e-mail já cadastrado) | **409** Conflict |
| Não autenticado / autenticado sem permissão | **401** / **403** |

\`\`\`python
def criar_pedido(corpo):
    try:
        dados = json.loads(corpo)                  # 1) FORMA: dá para ler?
    except ValueError:
        return problema(400, "json-invalido", "JSON malformado")
    erros = validar(dados)                         # 2) CONTEÚDO: faz sentido?
    if erros:                                      #    junte TODOS os erros de uma vez
        return problema(422, "validacao", "Dados inválidos", errors=erros)
    ...
\`\`\`

Não existe consenso absoluto: o **GitHub** responde **422** para erros de validação; o **Stripe** usa **400**. No mundo Python, o **FastAPI** devolve **422** quando a validação do Pydantic falha, e o **Django REST Framework**, **400**. O importante é ser **consistente** e documentar.

> [!sabia] O 422 nasceu no **WebDAV** (RFC 4918) como *Unprocessable Entity*. Só em 2022, com a RFC 9110, ele entrou no núcleo do HTTP — rebatizado de **Unprocessable Content**.

> [!dica] Devolva **todos** os erros de validação de uma vez. Um erro por requisição transforma o formulário num jogo de tentativa e erro.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo um paginador por cursor e um validador que fala Problem Details.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-pag-q1',
        concept: 'Offset × keyset',
        say: 'Primeira: o bug mais silencioso da paginação.',
        prompt: 'O app lista pedidos do mais novo para o mais antigo com `?limit=3&offset=...`. O usuário carrega a página 1 e vê **E, D, C**. Antes de ele pedir a página 2 (`offset=3`), chega o pedido **F**, o mais novo de todos. O que a página 2 mostra?',
        options: [
          { text: '**C, B, A** — o C aparece de novo, porque tudo "desceu" uma posição', correct: true, why: 'A lista agora é F, E, D, C, B, A. Pular 3 posições descarta F, E e D — e o C, que já estava na página 1, volta a aparecer.' },
          { text: '**B, A** — o offset é calculado sobre a lista que existia na página 1', why: 'O servidor não guarda a lista da página 1: cada requisição aplica o offset sobre os dados **atuais**. É justamente por isso que o offset é instável.' },
          { text: '**F, B, A** — o pedido novo entra na página 2', why: 'O F é o mais novo, então fica na posição 0 — e o `offset=3` pula as posições 0, 1 e 2.' },
          { text: 'O servidor responde **409**, porque a lista mudou desde a página 1', why: 'Com offset, o servidor não tem como perceber que a lista mudou — e esse é o problema: o erro é **silencioso**.' },
        ],
        explanation: 'O offset é uma **posição** na lista atual: inserções antes do ponto de corte fazem itens **repetirem**; remoções fazem itens **sumirem**. Com keyset, a página 2 seria "tudo depois de (criado_em, id) do C" — B e A, com ou sem o F. Por isso feeds, timelines e exportações usam cursor.',
      },
      {
        type: 'match',
        id: 'api-pag-q2',
        concept: 'Problem Details (RFC 9457)',
        say: 'Agora associe cada membro do Problem Details ao seu papel.',
        prompt: 'Associe cada membro de um corpo `application/problem+json` ao que ele representa.',
        pairs: [
          { left: '`type`', right: 'URI do **tipo** de problema — o que o código do cliente deve checar' },
          { left: '`title`', right: 'Resumo curto para humanos, igual em todas as ocorrências do tipo' },
          { left: '`status`', right: 'Cópia do status HTTP, útil quando o corpo viaja sozinho (logs, filas)' },
          { left: '`detail`', right: 'Explicação **desta** ocorrência, para ajudar a corrigir — não para parsing' },
          { left: '`instance`', right: 'URI desta ocorrência específica, para suporte e correlação com logs' },
          { left: '`errors`', right: 'Extensão com os campos inválidos (`pointer` + `detail`)' },
        ],
        explanation: 'O `type` é o **identificador estável**: o cliente decide o que fazer olhando para ele (e para as extensões), nunca fazendo parsing do `detail`. `title` e `detail` podem até ser traduzidos (com `Content-Language`). O `instance` ajuda o suporte a achar a ocorrência nos logs, e extensões como `errors` carregam o que o código do cliente precisa ler.',
      },
      {
        type: 'code',
        id: 'api-pag-q3',
        concept: 'Keyset pagination',
        title: 'Paginação por cursor que não pula nem repete',
        say: 'Agora é com você: implemente um paginador por cursor que aguenta inserções e remoções entre as páginas.',
        prompt: `Implemente \`paginar(itens, limite, cursor=None)\` — a paginação por cursor de \`GET /pedidos\`.

- \`itens\` é a "tabela": uma lista de dicts com \`"id"\` (único) e \`"criado_em"\` (int), **em qualquer ordem**. Ela pode **mudar entre as chamadas** (inserções e remoções).
- A listagem vai dos mais recentes para os mais antigos: **\`criado_em\` DESC, \`id\` DESC** (o \`id\` desempata).
- Devolva \`{"dados": [...], "proximo": ...}\`: até \`limite\` itens e, **se ainda houver itens** depois do último entregue, um cursor (\`str\`) em \`"proximo"\`; senão, \`None\`.
- Com \`cursor\`, continue **estritamente depois** do item que ele representa — mesmo que esse item tenha sido apagado.
- O cursor é **opaco**: base64url de um JSON com a chave do último item. Se ele não decodificar ou não tiver o formato esperado (uma lista com dois inteiros), lance \`CursorInvalido\`.`,
        starter: `import base64
import json


class CursorInvalido(ValueError):
    """Cursor que não foi gerado por nós (ou foi adulterado)."""


def paginar(itens, limite, cursor=None):
    """Página de \`itens\` em ordem criado_em DESC, id DESC.

    Devolve {"dados": [...], "proximo": str ou None}.
    """
    # TODO
    pass
`,
        tests: [
          {
            name: 'primeira página: os mais recentes primeiro',
            code: PRE_PAG + `itens = [ped(1, 100), ped(2, 200), ped(3, 300), ped(4, 400)]
r = paginar(itens, 2)
ids = [p["id"] for p in r["dados"]]
assert ids == [4, 3], f"a primeira página deveria ser [4, 3], veio {ids}"
assert isinstance(r["proximo"], str) and r["proximo"], "ainda há itens: 'proximo' deveria ser um cursor (str)"`,
          },
          {
            name: 'percorre tudo sem repetir nem pular; a última página traz proximo None',
            code: PRE_PAG + `itens = [ped(i, i * 10) for i in range(1, 8)]
vistos, cursor, paginas = [], None, 0
while True:
    r = paginar(itens, 3, cursor)
    vistos += [p["id"] for p in r["dados"]]
    paginas += 1
    cursor = r["proximo"]
    if cursor is None or paginas > 10:
        break
assert vistos == [7, 6, 5, 4, 3, 2, 1], f"ordem percorrida: {vistos}"
assert paginas == 3, f"7 itens com limite 3 = 3 páginas, vieram {paginas}"`,
          },
          {
            name: 'empate em criado_em: o id desempata e ninguém some na fronteira',
            code: PRE_PAG + `itens = [ped(i, 500) for i in range(1, 6)]
r1 = paginar(itens, 2)
r2 = paginar(itens, 2, r1["proximo"])
r3 = paginar(itens, 2, r2["proximo"])
paginas = [[p["id"] for p in r["dados"]] for r in (r1, r2, r3)]
assert paginas == [[5, 4], [3, 2], [1]], f"páginas: {paginas} (esperado [[5, 4], [3, 2], [1]])"
assert r3["proximo"] is None, "na última página, 'proximo' deveria ser None"`,
          },
          {
            name: 'pedido novo entre as páginas não causa repetição (o bug do offset)',
            code: PRE_PAG + `itens = [ped(i, i * 10) for i in range(1, 7)]
r1 = paginar(itens, 3)
itens.append(ped(99, 1000))
r2 = paginar(itens, 3, r1["proximo"])
ids = [p["id"] for p in r2["dados"]]
assert ids == [3, 2, 1], f"depois de [6, 5, 4], a página 2 deveria ser [3, 2, 1] mesmo com um pedido novo no topo; veio {ids}"`,
          },
          {
            name: 'o item do cursor foi apagado: a próxima página continua certa',
            code: PRE_PAG + `itens = [ped(i, i * 10) for i in range(1, 7)]
r1 = paginar(itens, 3)
itens = [p for p in itens if p["id"] != 4]
r2 = paginar(itens, 3, r1["proximo"])
ids = [p["id"] for p in r2["dados"]]
assert ids == [3, 2, 1], f"o pedido 4 (último da página 1) foi apagado; a página 2 ainda deveria ser [3, 2, 1], veio {ids}"`,
          },
          {
            name: 'cursor inválido ou adulterado lança CursorInvalido',
            code: PRE_PAG + `import base64
ruins = ["!!!", "abc", base64.urlsafe_b64encode(b"lixo").decode(),
         base64.urlsafe_b64encode(b'{"pagina": 2}').decode()]
for c in ruins:
    try:
        paginar([ped(1, 10)], 2, c)
        assert False, f"o cursor {c!r} deveria ser rejeitado com CursorInvalido"
    except CursorInvalido:
        pass`,
          },
          {
            name: 'lista vazia e última página exata',
            hidden: true,
            code: PRE_PAG + `r = paginar([], 5)
assert r == {"dados": [], "proximo": None}, f"lista vazia: {r}"
itens = [ped(i, i) for i in range(1, 5)]
r = paginar(itens, 4)
assert r["proximo"] is None, "se não sobrou nada, 'proximo' deve ser None (nada de página vazia no fim)"
r = paginar(itens, 2)
r = paginar(itens, 2, r["proximo"])
assert [p["id"] for p in r["dados"]] == [2, 1] and r["proximo"] is None`,
          },
          {
            name: 'entrada fora de ordem: a função ordena',
            hidden: true,
            code: PRE_PAG + `itens = [ped(3, 30), ped(1, 10), ped(4, 30), ped(2, 20)]
r = paginar(itens, 3)
assert [p["id"] for p in r["dados"]] == [4, 3, 2], "ordem esperada: criado_em DESC, id DESC"
r = paginar(itens, 3, r["proximo"])
assert [p["id"] for p in r["dados"]] == [1] and r["proximo"] is None`,
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('eval') || m.calls.includes('exec') || m.imports.includes('pickle'),
            text: 'O cursor vem do **cliente**: é entrada não confiável. `eval`, `exec` ou `pickle` sobre ele é execução remota de código esperando para acontecer. Decodifique com `json.loads` e valide o formato.',
            concept: 'Cursor como entrada não confiável',
          },
          {
            when: m => m.calls.includes('b64encode') && !m.calls.includes('urlsafe_b64encode'),
            text: 'O `b64encode` padrão usa `+` e `/`, que têm significado em URLs (numa query string, `+` vira espaço!). Para um cursor que viaja na URL, use `base64.urlsafe_b64encode`.',
            concept: 'base64url',
          },
          {
            when: m => m.calls.includes('index'),
            text: 'Procurar a **posição** do item do cursor (`.index`) é offset disfarçado: se o item for apagado a busca falha, e inserções antes dele mudam as posições. Filtre pela **chave** (`chave < cursor`), como faz o `WHERE` do keyset.',
            concept: 'Keyset pagination',
          },
        ],
        hints: [
          'Ordene com `sorted(itens, key=lambda p: (p["criado_em"], p["id"]), reverse=True)`. A **chave** de cada item é essa tupla — e o cursor guarda a chave do último item entregue.',
          'Com cursor, filtre os itens com `chave(item) < chave_do_cursor`: a comparação de tuplas do Python faz exatamente o `WHERE (criado_em, id) < (:c, :i)` do SQL. Não procure a *posição* do item — ele pode ter sido apagado.',
          'Pegue `limite + 1` itens para saber se há mais sem contar tudo. Cursor: `base64.urlsafe_b64encode(json.dumps([c, i]).encode()).decode()`. Na volta, `json.loads(base64.urlsafe_b64decode(cursor))` dentro de um `try` que converte `ValueError` em `CursorInvalido` — e confira se veio uma lista com dois inteiros.',
        ],
        solution: `import base64
import json


class CursorInvalido(ValueError):
    """Cursor que não foi gerado por nós (ou foi adulterado)."""


def _chave(item):
    return (item["criado_em"], item["id"])


def _codificar(chave):
    return base64.urlsafe_b64encode(json.dumps(list(chave)).encode()).decode()


def _decodificar(cursor):
    try:
        chave = json.loads(base64.urlsafe_b64decode(cursor.encode()))
    except ValueError as erro:          # base64 ou JSON inválidos (ambos são ValueError)
        raise CursorInvalido("cursor inválido") from erro
    valido = (isinstance(chave, list) and len(chave) == 2
              and all(isinstance(x, int) and not isinstance(x, bool) for x in chave))
    if not valido:
        raise CursorInvalido("cursor com formato inesperado")
    return tuple(chave)


def paginar(itens, limite, cursor=None):
    ordenados = sorted(itens, key=_chave, reverse=True)       # ORDER BY criado_em DESC, id DESC
    if cursor is not None:
        ultima = _decodificar(cursor)
        ordenados = [p for p in ordenados if _chave(p) < ultima]   # WHERE (criado_em, id) < (:c, :i)
    pagina = ordenados[:limite + 1]                                # LIMIT n + 1
    dados = pagina[:limite]
    proximo = _codificar(_chave(dados[-1])) if len(pagina) > limite else None
    return {"dados": dados, "proximo": proximo}
`,
        solutionExplanation: 'A listagem é `sorted(..., key=(criado_em, id), reverse=True)` — o `ORDER BY criado_em DESC, id DESC`. O cursor guarda a **chave** do último item entregue, não uma posição; por isso inserções no topo e até a remoção do próprio item do cursor não afetam a página seguinte: o filtro `chave < cursor` (comparação de tuplas, o *row value* do SQL) continua valendo. Pegar `limite + 1` itens responde "tem mais?" sem contar nada. O cursor é base64url de JSON — opaco para o cliente, mas **validado** na volta: falha de base64 ou de JSON (ambas são `ValueError`) e formato inesperado viram `CursorInvalido`, que a API traduziria num **400** em Problem Details. Num banco de verdade, o `sorted` + filtro vira `WHERE ... ORDER BY ... LIMIT` sobre um índice composto.',
      },
      {
        type: 'code',
        id: 'api-pag-q4',
        concept: 'Problem Details e 400 × 422',
        title: 'Um handler que fala Problem Details',
        say: 'Agora os erros: escreva um handler que separa forma de conteúdo e responde no padrão da RFC 9457.',
        prompt: `Implemente \`criar_pedido(corpo)\`, o handler de \`POST /pedidos\`. \`corpo\` é o texto cru da requisição; devolva \`(status, cabecalhos, dados)\`.

1. **Forma:** se \`corpo\` não for JSON válido — ou se o JSON não for um **objeto** — devolva **400** com \`type\` \`"https://api.loja.dev/problemas/json-invalido"\`.
2. **Conteúdo:** junte **todos** os erros de campo. Se houver algum, devolva **422** com \`type\` \`"https://api.loja.dev/problemas/validacao"\` e a extensão \`errors\`: uma lista de \`{"pointer": ..., "detail": ...}\`, na ordem \`email\`, \`quantidade\`, \`cupom\`.
   - \`email\`: obrigatório, texto contendo \`@\` → \`"#/email"\`
   - \`quantidade\`: obrigatório, **inteiro** de 1 a 100 (\`true\` não conta como número) → \`"#/quantidade"\`
   - \`cupom\`: opcional; se vier, precisa ser texto → \`"#/cupom"\`
3. Todo erro sai com \`{"Content-Type": "application/problem+json"}\` e um corpo com \`type\`, \`title\` e \`status\` (igual ao status HTTP).
4. **Sucesso:** \`201\`, \`{"Content-Type": "application/json"}\` e um dict só com os campos conhecidos que vieram (\`email\`, \`quantidade\` e, se houver, \`cupom\`).`,
        starter: `import json

BASE = "https://api.loja.dev/problemas/"


def problema(status, tipo, titulo, **extras):
    """Monta uma resposta Problem Details (RFC 9457)."""
    # TODO: devolva (status, cabecalhos, corpo)
    pass


def criar_pedido(corpo):
    # TODO
    pass
`,
        tests: [
          {
            name: 'JSON malformado → 400 em application/problem+json',
            code: `status, cab, corpo = criar_pedido('{"email": "ana@x.com", ')
assert status == 400, f"JSON quebrado é erro de FORMA (400), veio {status}"
assert cab.get("Content-Type") == "application/problem+json", f"Content-Type deveria ser application/problem+json, veio {cab.get('Content-Type')!r}"
assert corpo.get("type") == "https://api.loja.dev/problemas/json-invalido", f"type: {corpo.get('type')!r}"
assert corpo.get("status") == 400 and corpo.get("title"), "o corpo precisa de title e de status igual ao HTTP"`,
          },
          {
            name: 'JSON válido que não é objeto → 400',
            code: `for bruto in ("[1, 2]", '"texto"', "42"):
    status, cab, corpo = criar_pedido(bruto)
    assert status == 400, f"{bruto!r} é JSON válido, mas não é um objeto: deveria ser 400, veio {status}"`,
          },
          {
            name: 'campo inválido → 422 com errors e pointer',
            code: `status, cab, corpo = criar_pedido('{"email": "ana-sem-arroba", "quantidade": 3}')
assert status == 422, f"JSON bem-formado com dado inválido é 422, veio {status}"
assert cab.get("Content-Type") == "application/problem+json"
assert corpo.get("type") == "https://api.loja.dev/problemas/validacao", f"type: {corpo.get('type')!r}"
assert corpo.get("status") == 422 and corpo.get("title"), "o corpo precisa de title e de status 422"
ponteiros = [e["pointer"] for e in corpo.get("errors", [])]
assert ponteiros == ["#/email"], f"errors deveria apontar só #/email, veio {ponteiros}"
assert all(e.get("detail") for e in corpo["errors"]), "cada erro precisa de um detail para humanos"`,
          },
          {
            name: 'todos os erros de uma vez',
            code: `status, _, corpo = criar_pedido('{}')
assert status == 422, f"objeto vazio: faltam campos obrigatórios (422), veio {status}"
ponteiros = [e["pointer"] for e in corpo.get("errors", [])]
assert ponteiros == ["#/email", "#/quantidade"], f"vieram {ponteiros}: junte TODOS os erros, na ordem email, quantidade, cupom"`,
          },
          {
            name: 'pedido válido → 201 só com os campos conhecidos',
            code: `status, cab, dados = criar_pedido('{"email": "ana@x.com", "quantidade": 2, "cupom": "BEMVINDA", "extra": 1}')
assert status == 201, f"pedido válido deveria dar 201, veio {status}"
assert cab.get("Content-Type") == "application/json"
assert dados == {"email": "ana@x.com", "quantidade": 2, "cupom": "BEMVINDA"}, f"dados: {dados}"`,
          },
          {
            name: 'quantidade: bool, float, texto e limites',
            hidden: true,
            code: `for q in ("true", "2.5", '"2"', "0", "101"):
    status, _, corpo = criar_pedido('{"email": "a@b.com", "quantidade": ' + q + '}')
    assert status == 422, f"quantidade {q} deveria ser rejeitada (422), veio {status}"
    assert [e["pointer"] for e in corpo["errors"]] == ["#/quantidade"]
for q in ("1", "100"):
    status, _, _ = criar_pedido('{"email": "a@b.com", "quantidade": ' + q + '}')
    assert status == 201, f"quantidade {q} está no intervalo e deveria passar"`,
          },
          {
            name: 'cupom é opcional, mas tipado',
            hidden: true,
            code: `status, _, corpo = criar_pedido('{"email": 7, "quantidade": 1, "cupom": 123}')
assert status == 422
ponteiros = [e["pointer"] for e in corpo["errors"]]
assert ponteiros == ["#/email", "#/cupom"], f"vieram {ponteiros}"
status, _, dados = criar_pedido('{"email": "a@b.com", "quantidade": 1}')
assert status == 201 and "cupom" not in dados`,
          },
        ],
        reviews: [
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo engole **qualquer** erro — inclusive bugs seus, que virariam um 400 enganoso para o cliente. Capture só `ValueError` (o `json.JSONDecodeError` herda dela).',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.calls.includes('eval') || m.calls.includes('literal_eval'),
            text: 'JSON não é Python (`true`, `null`…), e `eval` sobre o corpo de uma requisição é execução remota de código. Use `json.loads`.',
            concept: 'Parsing seguro',
          },
          {
            when: m => m.maxComplexity > 12,
            text: 'Uma função concentrou todas as regras. Extraia `problema(...)` e um validador por campo (ou uma lista de regras `(pointer, checagem, mensagem)`): um campo novo vira uma linha, não mais um `if`.',
            concept: 'Coesão',
          },
        ],
        hints: [
          'Separe as duas etapas: `json.loads` dentro de `try/except ValueError` (o `JSONDecodeError` é subclasse) responde pela **forma** (400); só depois valide o **conteúdo** (422).',
          'Monte uma lista `erros` e acrescente `{"pointer": "#/campo", "detail": "..."}` para cada regra violada — sem retornar no primeiro erro. Cuidado: `isinstance(True, int)` é `True` em Python; exclua `bool` explicitamente.',
          'Centralize o formato em `problema(status, tipo, titulo, **extras)`: devolva `(status, {"Content-Type": "application/problem+json"}, {"type": BASE + tipo, "title": titulo, "status": status, **extras})`.',
        ],
        solution: `import json

BASE = "https://api.loja.dev/problemas/"


def problema(status, tipo, titulo, **extras):
    """Monta uma resposta Problem Details (RFC 9457)."""
    corpo = {"type": BASE + tipo, "title": titulo, "status": status, **extras}
    return status, {"Content-Type": "application/problem+json"}, corpo


def _erros_de_campo(dados):
    erros = []
    email = dados.get("email")
    if not isinstance(email, str) or "@" not in email:
        erros.append({"pointer": "#/email", "detail": "obrigatório; precisa ser um e-mail"})
    qtd = dados.get("quantidade")
    if isinstance(qtd, bool) or not isinstance(qtd, int) or not 1 <= qtd <= 100:
        erros.append({"pointer": "#/quantidade", "detail": "obrigatório; inteiro de 1 a 100"})
    if "cupom" in dados and not isinstance(dados["cupom"], str):
        erros.append({"pointer": "#/cupom", "detail": "se enviado, precisa ser texto"})
    return erros


def criar_pedido(corpo):
    try:
        dados = json.loads(corpo)
    except ValueError:
        return problema(400, "json-invalido", "JSON malformado",
                        detail="O corpo da requisição não é um JSON válido.")
    if not isinstance(dados, dict):
        return problema(400, "json-invalido", "JSON malformado",
                        detail="O corpo precisa ser um objeto JSON.")
    erros = _erros_de_campo(dados)
    if erros:
        return problema(422, "validacao", "Dados do pedido inválidos",
                        detail=f"{len(erros)} campo(s) precisam de correção.", errors=erros)
    pedido = {k: dados[k] for k in ("email", "quantidade", "cupom") if k in dados}
    return 201, {"Content-Type": "application/json"}, pedido
`,
        solutionExplanation: 'O handler tem duas barreiras, na ordem certa: primeiro a **forma** (dá para ler? é um objeto?) → **400**; depois o **conteúdo** (as regras de cada campo) → **422** com **todos** os erros de uma vez, cada um com um `pointer` no formato JSON Pointer. O helper `problema` garante que todo erro sai igual: `Content-Type: application/problem+json`, `type` como identificador estável e `status` repetido no corpo. Dois detalhes de Python: `json.JSONDecodeError` é subclasse de `ValueError`, e `bool` é subclasse de `int` (daí o `isinstance(qtd, bool)` explícito). Campos desconhecidos (`extra`) são ignorados — e nunca copiados às cegas para o modelo, o que seria *mass assignment*.',
      },
      {
        type: 'open',
        id: 'api-pag-q5',
        concept: 'Design de paginação',
        say: 'Última: uma conversa com o time de produto. Me convença.',
        prompt: 'No painel administrativo, a listagem de **50 milhões** de pedidos usa `offset` e as páginas finais levam 9 segundos. O produto quer manter um seletor "ir para a página 8.000" e o texto "Mostrando 1–20 de 49.873.112". Como você redesenharia a paginação — e o que diria ao produto?',
        minWords: 40,
        rubric: [
          { label: 'Explica por que o offset degrada: o banco lê e descarta as linhas puladas', keywords: ['descart', 'joga fora', 'jogar fora', 'percorr', 'varre', 'varrer', 'scan', 'le todas', 'ler todas', 'linhas puladas', 'proporcional', 'linear', 'o(n)', 'paginacao profunda', 'deep pagination'], concept: 'Custo do offset', why: 'Sem entender o custo linear do `OFFSET`, a "solução" vira índice novo ou máquina maior — e a página 8.000 continua lendo 160 mil linhas.' },
          { label: 'Propõe paginação por **keyset/cursor** com índice e desempate', keywords: ['keyset', 'cursor', 'seek', 'search_after', 'ultimo item', 'ultimo visto', 'ultimo id', 'desempate', 'indice composto', 'row value'], concept: 'Keyset pagination', why: 'Continuar a partir da chave do último item tem custo constante por página e não pula nem repete itens com pedidos chegando o tempo todo.' },
          { label: 'Trata o **total**: estimativa, cache ou `tem_mais` no lugar do `COUNT(*)` exato', keywords: ['count', 'estimativ', 'estimad', 'aproximad', 'tem_mais', 'has_more', 'has more', 'contagem', 'total em cache'], concept: 'Custo do total', why: 'Um `COUNT(*)` exato sobre 50 milhões de linhas a cada página custa quase tanto quanto o próprio problema.' },
          { label: 'Negocia a **UX**: filtros e pesquisa, com navegação próxima/anterior', keywords: ['filtro', 'filtrar', 'pesquis', 'campo de busca', 'barra de busca', 'proxima pagina', 'pagina anterior', 'proxima e anterior', 'rolagem', 'scroll', 'por periodo', 'por data', 'intervalo de data', 'inverter a ordem', 'inverter a ordenacao'], concept: 'Design de listagem', why: 'Ninguém acha um pedido navegando até a página 8.000: o que resolve o problema do usuário são filtros e pesquisa — e isso libera a API para usar cursor.' },
        ],
        modelAnswer: `Primeiro eu explicaria o porquê da lentidão: com \`OFFSET\`, o banco **percorre e descarta** todas as linhas anteriores, então a página 8.000 lê 160 mil linhas para devolver 20 — o custo é linear no offset. E, com pedidos chegando o tempo todo, o offset ainda repete e pula itens.

Na API, eu trocaria para paginação por **keyset/cursor**: ordenação \`criado_em DESC, id DESC\` (o \`id\` desempata), índice composto nessa ordem e um cursor opaco com a chave do último item visto. Cada página custa o mesmo, seja a primeira ou a milésima.

Para o total, nada de \`COUNT(*)\` exato a cada página: a API devolve \`tem_mais\` e, se o produto fizer questão do número, uma **estimativa** ("cerca de 49,8 milhões") tirada das estatísticas do banco ou um total em cache, atualizado de tempos em tempos.

E eu negociaria a UX: ninguém navega até a página 8.000 procurando algo — as pessoas precisam de **filtros** (status, cliente, período) e **pesquisa**, com navegação **próxima página / página anterior**. Se "ir para o fim" for mesmo necessário, basta inverter a ordenação.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora suas listas não pulam nem repetem itens, e seus erros falam uma língua que qualquer cliente entende.',
          { text: 'Resumo: offset só para listas pequenas e estáveis, cursor opaco para o resto — e Problem Details com 400 para forma e 422 para conteúdo.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
