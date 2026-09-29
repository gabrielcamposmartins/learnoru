(function () {
  // Prelúdio dos testes do cache coalescente: relógio falso + origem que só responde quando o teste libera.
  const PRE_COAL = `import asyncio

agora = [0.0]
def relogio():
    return agora[0]

chamadas = []
portao = asyncio.Event()

async def buscar(chave):
    chamadas.append(chave)
    await portao.wait()
    return f"{chave}#{len(chamadas)}"

async def rodar_pendentes():
    for _ in range(10):
        await asyncio.sleep(0)

`;

  Game.registerModule('apis', {
    id: 'cache-http',
    title: 'Cache HTTP: frescor, validação e stampedes',
    kind: 'lesson',
    level: 2,
    order: 13,
    unit: 'design',
    summary: 'A requisição mais rápida é a que não acontece: Cache-Control, ETag e 304, Vary, CDNs e stale-while-revalidate — e como impedir que a expiração de uma única chave derrube a origem (cache stampede e request coalescing).',
    concepts: ['Cache-Control', 'ETag e 304', 'Vary', 'stale-while-revalidate', 'Cache stampede'],
    takeaways: [
      '`max-age` diz por quanto tempo a resposta está **fresca**; `no-cache` **guarda, mas revalida** antes de usar; `no-store` **não guarda**; `private` barra caches compartilhados e `s-maxage` vale só para eles.',
      'Revalidar é barato: com `ETag` + `If-None-Match` (ou `Last-Modified` + `If-Modified-Since`), a origem responde **304 Not Modified**, sem corpo.',
      '`Vary` entra na **chave** do cache: esqueça-o e um usuário recebe a resposta feita para outro (idioma, compressão); abuse dele e a taxa de acerto despenca.',
      '`stale-while-revalidate` entrega a cópia velha **na hora** e atualiza em segundo plano; `stale-if-error` usa a cópia velha quando a origem falha.',
      'Quando uma chave quente expira, mil misses simultâneos viram mil chamadas à origem — o **cache stampede**. Defenda-se com **request coalescing** (uma busca por chave), TTL com jitter e expiração antecipada probabilística.',
    ],
    glossary: [
      { term: 'Cache-Control', aliases: ['cache control'], definition: 'Cabeçalho HTTP com as regras de cache de uma resposta (ou requisição): `max-age`, `s-maxage`, `no-cache`, `no-store`, `private`, `public`, `must-revalidate`, `stale-while-revalidate`…' },
      { term: 'stale-while-revalidate', aliases: ['stale while revalidate', 'SWR'], definition: 'Diretiva (RFC 5861) que permite servir a resposta **vencida** por mais N segundos enquanto o cache a revalida em segundo plano: ninguém fica esperando a origem.' },
      { term: 'Cache compartilhado', aliases: ['caches compartilhados', 'shared cache', 'shared caches'], definition: 'Cache que atende vários usuários (CDN, proxy reverso). Não pode guardar respostas `private` e obedece ao `s-maxage` — ao contrário do cache **privado** do navegador.' },
      { term: 'Vary', aliases: ['cabeçalho Vary', 'cabecalho Vary'], definition: 'Cabeçalho de resposta que lista os cabeçalhos da **requisição** que também entram na chave do cache (ex.: `Vary: Accept-Encoding, Accept-Language`).' },
      { term: 'Cache stampede', aliases: ['cache stampedes', 'thundering herd', 'dogpile', 'dog-pile', 'efeito manada'], definition: 'Quando uma entrada muito acessada expira e muitas requisições simultâneas dão *miss* ao mesmo tempo, todas recalculam o mesmo valor — e a origem é esmagada.' },
      { term: 'Request coalescing', aliases: ['coalescing', 'single-flight', 'singleflight', 'coalescência de requisições', 'coalescencia de requisicoes', 'collapsed forwarding'], definition: 'Juntar requisições concorrentes pela mesma chave numa **única** busca à origem: a primeira busca, as outras esperam e recebem o mesmo resultado. Em Go, `singleflight`; no nginx, `proxy_cache_lock`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **cache HTTP** — a otimização mais barata que existe, porque a requisição mais rápida é a que **nem sai** do cliente.',
          'O HTTP tem um sistema de cache inteiro embutido. Quem entende os cabeçalhos ganha latência, economia e uma origem que não cai na Black Friday.',
        ],
        board: {
          title: 'Onde o cache mora',
          md: `\`\`\`text
 navegador ──▶ CDN (borda) ──▶ proxy reverso ──▶ aplicação ──▶ banco
 [privado]     [compartilhado]  [compartilhado]   [Redis/memória]
     ▲              ▲                 ▲
     └──── cada camada pode responder sem incomodar as de trás
\`\`\`

| Cache | Atende | Exemplos | Pode guardar resposta \`private\`? |
|---|---|---|---|
| **Privado** | um usuário | navegador, app | sim |
| **Compartilhado** | muitos usuários | CDN, Varnish, nginx | **não** |
| **De aplicação** | o seu código | Redis, \`functools.lru_cache\` | você decide (fora do HTTP) |

As regras estão na **RFC 9111** (2022), e giram em torno de duas perguntas:

1. **Frescor:** posso usar a cópia **sem perguntar** à origem?
2. **Validação:** se não posso, dá para perguntar "mudou?" **sem baixar tudo de novo**?`,
        },
      },
      {
        type: 'say',
        text: [
          'Primeira pergunta: a cópia está **fresca**? Quem responde é o `Cache-Control`, com a vida útil em segundos.',
          'Cuidado com os nomes, que enganam: `no-cache` **não** significa "não faça cache". Quem proíbe guardar é o `no-store`.',
        ],
        board: {
          title: 'Cache-Control e a idade da resposta',
          md: `\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=30
ETag: "v42"
Age: 12
\`\`\`

| Diretiva | Significado |
|---|---|
| \`max-age=60\` | fresca por 60 s |
| \`s-maxage=300\` | vida útil só para caches **compartilhados** (lá, ganha do \`max-age\`) |
| \`no-cache\` | pode guardar, mas **revalida** antes de cada uso |
| \`no-store\` | **não guarda** em lugar nenhum (dados sensíveis) |
| \`private\` | só cache **privado** (navegador); a CDN não guarda |
| \`public\` | cache compartilhado pode guardar, mesmo com \`Authorization\` |
| \`must-revalidate\` | depois de vencer, **nunca** serve a cópia velha sem revalidar |
| \`immutable\` | nem revalida no reload — para arquivos com hash no nome |

\`\`\`text
 idade     = Age (tempo já passado em outros caches) + (agora − recebido_em)
 fresca?   = idade < vida_util
 vida_util : s-maxage (cache compartilhado) → max-age → Expires − Date → heurística
\`\`\`

> [!sabia] Sem \`Cache-Control\` nem \`Expires\`, a resposta **ainda pode ser cacheada**: a RFC 9111 permite frescor **heurístico**, e a sugestão típica é 10% do tempo desde o \`Last-Modified\`. Um arquivo alterado há 10 dias pode ficar cerca de 1 dia em cache "por conta própria". Moral: **sempre** declare o \`Cache-Control\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Segunda pergunta: a cópia venceu — preciso baixar tudo de novo? Não! O cache pergunta à origem **"mudou?"** com uma **requisição condicional**.',
          'Se não mudou, a origem responde **304 Not Modified**, sem corpo. Para um JSON de 200 KB, a diferença é enorme.',
        ],
        board: {
          title: 'Requisição condicional: ETag e 304',
          md: `Primeira visita: a origem manda o corpo, o validador (\`ETag\`) e a vida útil.

\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "v42"
Cache-Control: max-age=60
\`\`\`

\`\`\`json
{"id": 7, "nome": "Teclado mecânico", "preco": 349.9, "estoque": 12}
\`\`\`

Um minuto depois a cópia venceu, e o cache pergunta se mudou:

\`\`\`http
GET /produtos/7 HTTP/1.1
Host: api.loja.dev
If-None-Match: "v42"
\`\`\`

\`\`\`http
HTTP/1.1 304 Not Modified
ETag: "v42"
Cache-Control: max-age=60
\`\`\`

| Validador | Na resposta | Na revalidação | Observação |
|---|---|---|---|
| **ETag** | \`ETag: "v42"\` | \`If-None-Match: "v42"\` | preciso; aceita lista e \`*\` |
| **Data** | \`Last-Modified: Tue, 01 Jul 2025 10:00:00 GMT\` | \`If-Modified-Since: …\` | resolução de **1 segundo** |

- Se a requisição traz os **dois**, o servidor **ignora** o \`If-Modified-Since\`: o \`If-None-Match\` manda.
- O \`If-None-Match\` usa **comparação fraca**: \`W/"v42"\` casa com \`"v42"\` (o \`W/\` marca um ETag fraco — "equivalente", não idêntico byte a byte).
- O 304 **renova** a cópia: o cache atualiza os cabeçalhos, a idade recomeça e o corpo guardado continua valendo.

\`\`\`python
def get_produto(req, produto):
    etag = f'"{produto.versao}"'                     # ETag de VERSÃO: nem precisa montar o JSON
    if req.headers.get("If-None-Match") == etag:     # simplificado (o exercício faz direito)
        return 304, {"ETag": etag, "Cache-Control": "max-age=60"}, b""
    return 200, {"ETag": etag, "Cache-Control": "max-age=60"}, serializar(produto)
\`\`\`

> [!dica] O mesmo ETag protege **escritas**: \`If-Match\` + **412** evita o *lost update* (está na aula de idempotência). Aqui ele serve às **leituras**: \`If-None-Match\` + **304**.`,
        },
      },
      {
        type: 'say',
        text: [
          'Qual é a **chave** do cache? Por padrão, método + URL. Mas e se a mesma URL responde em português para uns e em inglês para outros?',
          'Para isso existe o `Vary`: ele diz quais cabeçalhos da requisição também entram na chave. Esquecê-lo é um bug; exagerar nele também.',
        ],
        board: {
          title: 'Vary: o que entra na chave do cache',
          md: `\`\`\`http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Encoding: br
Content-Language: pt-BR
Vary: Accept-Encoding, Accept-Language
Cache-Control: public, max-age=300
\`\`\`

\`\`\`text
 chave = GET + https://loja.dev/ofertas + Accept-Encoding=br + Accept-Language=pt-BR
\`\`\`

| Erro | Sintoma |
|---|---|
| **Esquecer** \`Vary: Accept-Encoding\` | cliente sem suporte a Brotli recebe bytes comprimidos ilegíveis |
| **Esquecer** \`Vary: Accept-Language\` | o primeiro visitante define o idioma de todo mundo |
| \`Vary: User-Agent\` ou \`Vary: Cookie\` | milhares de variações → **taxa de acerto perto de zero** |

> [!atencao] Resposta **personalizada** (carrinho, perfil, extrato) não vai para cache compartilhado: use \`private\` (ou \`no-store\`). E, por padrão, um cache compartilhado **não reutiliza** respostas a requisições com \`Authorization\` — a menos que a resposta diga explicitamente \`public\` ou \`s-maxage\`.

> [!sabia] **Web Cache Deception** (Omer Gil, 2017): o atacante faz a vítima abrir \`https://loja.dev/minha-conta/foto.css\`. A aplicação ignora o sufixo e devolve a página **privada**; a CDN, que cacheia "tudo que termina em \`.css\`", guarda a página — e o atacante a lê do cache. Defesa: a CDN deve obedecer ao \`Cache-Control\` da origem, não à extensão da URL.`,
        },
      },
      {
        type: 'say',
        text: [
          'Numa **CDN**, o conteúdo fica em centenas de servidores de borda, perto do usuário. E aí entram diretivas que servem **coisa velha de propósito**.',
          'Parece heresia, mas é genial: um dado com 5 segundos de atraso, entregue em 10 ms, costuma valer mais que um dado exato entregue em 2 s.',
        ],
        board: {
          title: 'CDN, stale-while-revalidate e stale-if-error',
          md: `\`\`\`http
Cache-Control: max-age=60, stale-while-revalidate=30, stale-if-error=86400
\`\`\`

\`\`\`text
 idade:  0 s ─────────────── 60 s ─────────────────── 90 s ──────────────▶
         │   FRESCA (HIT)    │ VENCIDA, mas é servida │ precisa revalidar
         │                   │ na hora + revalida em  │ (o cliente espera
         │                   │ segundo plano (SWR)    │  pela origem)
 stale-if-error: se a origem responder com erro (5xx), serve a cópia por até 1 dia
\`\`\`

| Técnica | Para quê |
|---|---|
| \`s-maxage\` longo + \`max-age\` curto | a CDN segura a carga; o navegador revalida logo |
| \`CDN-Cache-Control\` (RFC 9213) | regras **só** para a CDN, sem afetar navegadores |
| **Purga** por URL ou por *tag* (\`Surrogate-Key\`, \`Cache-Tag\`) | invalidar na hora quando o dado muda |
| Arquivo com hash no nome (\`app.3f9a1c.js\`) + \`max-age=31536000, immutable\` | cache "eterno": mudou o conteúdo, muda o nome |

> [!dica] "Só existem duas coisas difíceis em computação: invalidação de cache e dar nomes às coisas" (Phil Karlton). O truque do hash no nome é ótimo justamente porque você **nunca invalida** — só publica um nome novo.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o perigo. Imagine a home do site, com 5.000 acessos por segundo, cacheada por 60 s. O que acontece no segundo 60?',
          'A chave expira e **todas** as requisições daquele instante dão *miss* juntas — e correm para o banco ao mesmo tempo. É o **cache stampede**.',
        ],
        board: {
          title: 'Cache stampede (thundering herd)',
          md: `\`\`\`text
 t = 59,9 s   5.000 req/s ──▶ [cache: HIT] ──▶ banco tranquilo
 t = 60,0 s   a chave "home" EXPIRA
 t = 60,0 s   300 requisições simultâneas ──▶ MISS, MISS, MISS…
                                          └──▶ 300 × a mesma consulta pesada ──▶ banco 🔥
                                               timeouts → retries → MAIS carga
\`\`\`

| Defesa | Ideia |
|---|---|
| **Request coalescing** (*single-flight*) | só o **primeiro** miss busca na origem; os outros **esperam o mesmo resultado** |
| **Lock / lease** | num cache distribuído, quem pega a trava recalcula; os outros servem o velho ou esperam |
| **stale-while-revalidate** | serve o velho e dispara **uma** atualização em segundo plano |
| **TTL com jitter** | \`ttl = 300 * random.uniform(0.9, 1.1)\`: chaves criadas juntas não vencem juntas |
| **Expiração antecipada probabilística** | cada leitura pode recalcular um pouco **antes** de vencer, com chance crescente |
| **Aquecimento** (*warming*) | popular o cache antes de o tráfego chegar (deploy, virada do dia) |

\`\`\`python
import math
import random

def recalcular_cedo(agora, expira_em, custo, beta=1.0, rng=random.random):
    """XFetch: perto de expirar (e quanto mais caro recalcular), maior a chance de recalcular antes."""
    return agora - custo * beta * math.log(rng()) >= expira_em
\`\`\`

> [!sabia] Os nomes variam: *cache stampede*, *thundering herd*, *dogpile effect*. O **Varnish** faz coalescing por padrão; no **nginx** é \`proxy_cache_lock on\`; em Go existe o pacote \`singleflight\`. O Facebook descreveu **leases** contra esse problema no artigo *Scaling Memcache at Facebook* (2013), e a função acima, o **XFetch**, vem do artigo *Optimal Probabilistic Cache Stampede Prevention* (VLDB 2015).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo a decisão de frescor com 304 e um cache assíncrono com request coalescing.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-cache-q1',
        concept: 'no-cache × no-store',
        say: 'Primeira: a confusão de nomes mais famosa do HTTP.',
        prompt: 'A página de **extrato bancário** não pode ficar gravada em **nenhum** cache — nem na CDN, nem no disco do navegador. Qual `Cache-Control` usar?',
        options: [
          { text: '`no-store`', correct: true, why: 'É a única diretiva que proíbe **armazenar**: nenhum cache, privado ou compartilhado, guarda a resposta.' },
          { text: '`no-cache`', why: 'Apesar do nome, permite guardar: só exige **revalidar** com a origem antes de cada uso. A cópia fica no disco.' },
          { text: '`private, max-age=0`', why: 'Tira a CDN da jogada, mas o navegador ainda pode guardar a cópia (vencida) no disco.' },
          { text: '`max-age=0, must-revalidate`', why: 'A resposta nasce vencida e precisa ser revalidada — mas pode ser armazenada, em qualquer cache. Não atende a "nunca gravar".' },
        ],
        explanation: '`no-cache` = "guarde, mas pergunte antes de usar"; `no-store` = "não guarde". Para conteúdo **personalizado, mas não sensível** (um carrinho, por exemplo), `private, no-cache` costuma bastar — e ainda aproveita o 304. Para dados **sensíveis** (extrato, saúde), `no-store`.',
      },
      {
        type: 'match',
        id: 'api-cache-q2',
        concept: 'Cabeçalhos de cache',
        say: 'Agora associe cada cabeçalho ao seu papel no cache.',
        prompt: 'Associe cada **cabeçalho, diretiva ou status** ao que ele significa.',
        pairs: [
          { left: '`ETag: "v42"`', right: 'Identifica a versão da representação (o validador)' },
          { left: '`If-None-Match: "v42"`', right: 'Pergunta condicional: "só me mande se mudou"' },
          { left: '`304 Not Modified`', right: 'Não mudou: use a sua cópia (resposta sem corpo)' },
          { left: '`Vary: Accept-Language`', right: 'O idioma pedido entra na chave do cache' },
          { left: '`Age: 42`', right: 'Há quantos segundos a resposta circula por caches no caminho' },
          { left: '`s-maxage=300`', right: 'Vida útil só para caches compartilhados (CDN, proxy)' },
        ],
        explanation: 'O ciclo completo: a origem manda `ETag` e `Cache-Control`; enquanto a cópia está fresca, ninguém pergunta nada; quando vence, o cache envia `If-None-Match` e, se nada mudou, recebe um `304` sem corpo. O `Age` impede que uma cópia "rejuvenesça" ao passar de um cache para outro, e o `Vary` garante que variações diferentes não se misturem.',
      },
      {
        type: 'code',
        id: 'api-cache-q3',
        concept: 'Frescor e validação condicional',
        title: 'Fresco, vencido ou 304?',
        say: 'Hora de pensar como um cache — e como a origem que responde a ele. Relógio injetado, como sempre.',
        prompt: `Dois lados do cache HTTP, em duas funções.

**1. \`decidir(cabecalhos, recebido_em, agora, compartilhado=False)\`** — o cache olha para uma resposta guardada e devolve:

- \`"nao_armazenar"\` se o \`Cache-Control\` tem \`no-store\` — ou tem \`private\` e o cache é \`compartilhado\`;
- \`"revalidar"\` se tem \`no-cache\`;
- senão, calcula a **idade** = \`Age\` (se houver) + (\`agora\` − \`recebido_em\`) e a **vida útil** = \`s-maxage\` (só se \`compartilhado\`), senão \`max-age\`, senão 0:
  - \`"fresco"\` se idade < vida útil;
  - \`"stale_revalidando"\` se idade < vida útil + \`stale-while-revalidate\` (0 se ausente);
  - \`"revalidar"\` caso contrário.

As diretivas vêm separadas por vírgula, com espaços opcionais, e **não diferenciam maiúsculas**. O dict \`cabecalhos\` usa as chaves \`"Cache-Control"\` e \`"Age"\` (ambas podem faltar).

**2. \`responder(req_cabecalhos, etag_atual, corpo)\`** — a origem devolve \`(status, cabecalhos, corpo)\`:

- se o \`If-None-Match\` casar com \`etag_atual\`: \`(304, {"ETag": etag_atual}, "")\`;
- senão: \`(200, {"ETag": etag_atual}, corpo)\`.

O \`If-None-Match\` pode trazer uma **lista** separada por vírgulas, \`*\` (casa com qualquer versão) e ETags **fracos** (\`W/"v1"\`) — a comparação é **fraca**: ignore o \`W/\` dos dois lados.`,
        starter: `def decidir(cabecalhos, recebido_em, agora, compartilhado=False):
    """'nao_armazenar', 'fresco', 'stale_revalidando' ou 'revalidar'."""
    # TODO
    pass


def responder(req_cabecalhos, etag_atual, corpo):
    """(status, cabecalhos, corpo): 304 se o If-None-Match casar; senão, 200."""
    # TODO
    pass
`,
        tests: [
          { name: 'max-age: fresca dentro da vida útil', expr: 'decidir({"Cache-Control": "max-age=60"}, 100, 130)', expected: '"fresco"' },
          { name: 'no segundo 60 ela já venceu (fresca só se idade < vida útil)', expr: 'decidir({"Cache-Control": "max-age=60"}, 100, 160)', expected: '"revalidar"' },
          { name: 'o Age conta: 50 s em outros caches + 15 s aqui', expr: 'decidir({"Cache-Control": "max-age=60", "Age": "50"}, 100, 115)', expected: '"revalidar"' },
          {
            name: 'no-store não guarda; no-cache sempre revalida',
            code: `r = decidir({"Cache-Control": "no-store"}, 0, 0)
assert r == "nao_armazenar", f"no-store: esperado 'nao_armazenar', veio {r!r}"
r = decidir({"Cache-Control": "no-cache, max-age=600"}, 0, 1)
assert r == "revalidar", f"no-cache guarda, mas SEMPRE revalida antes de usar; veio {r!r}"`,
          },
          {
            name: 'private e s-maxage dependem do tipo de cache',
            code: `cab = {"Cache-Control": "private, max-age=60"}
r = decidir(cab, 0, 10, compartilhado=True)
assert r == "nao_armazenar", f"a CDN não guarda resposta private; veio {r!r}"
r = decidir(cab, 0, 10)
assert r == "fresco", f"o navegador (cache privado) pode guardar; veio {r!r}"
cab = {"Cache-Control": "public, max-age=60, s-maxage=300"}
r = decidir(cab, 0, 100, compartilhado=True)
assert r == "fresco", f"na CDN vale o s-maxage (300); veio {r!r}"
r = decidir(cab, 0, 100)
assert r == "revalidar", f"no navegador vale o max-age (60); veio {r!r}"`,
          },
          {
            name: 'stale-while-revalidate: janela extra servindo o velho',
            code: `cab = {"Cache-Control": "max-age=60, stale-while-revalidate=30"}
r = decidir(cab, 0, 75)
assert r == "stale_revalidando", f"idade 75: vencida, mas dentro da janela de 30 s; veio {r!r}"
r = decidir(cab, 0, 90)
assert r == "revalidar", f"idade 90: passou da janela (60 + 30); veio {r!r}"`,
          },
          { name: 'sem If-None-Match → 200 com ETag', expr: `responder({}, '"v42"', "dados")`, expected: `(200, {"ETag": '"v42"'}, "dados")` },
          { name: 'If-None-Match igual → 304 sem corpo', expr: `responder({"If-None-Match": '"v42"'}, '"v42"', "dados")`, expected: `(304, {"ETag": '"v42"'}, "")` },
          { name: 'If-None-Match diferente → 200', expr: `responder({"If-None-Match": '"v41"'}, '"v42"', "dados")`, expected: `(200, {"ETag": '"v42"'}, "dados")` },
          {
            name: 'lista e comparação fraca',
            code: `assert responder({"If-None-Match": '"v1", "v42"'}, '"v42"', "x")[0] == 304, "qualquer ETag da lista pode casar"
assert responder({"If-None-Match": 'W/"v42"'}, '"v42"', "x")[0] == 304, "comparação fraca: o W/ do pedido é ignorado"
assert responder({"If-None-Match": '"v42"'}, 'W/"v42"', "x")[0] == 304, "comparação fraca: o W/ do ETag atual também"`,
          },
          {
            name: 'formatação livre das diretivas e cabeçalho ausente',
            hidden: true,
            code: `r = decidir({"Cache-Control": "Public,MAX-AGE=120 ,  Stale-While-Revalidate=10"}, 0, 125)
assert r == "stale_revalidando", f"diretivas não diferenciam maiúsculas e podem ter espaços; veio {r!r}"
assert decidir({}, 0, 0) == "revalidar", "sem Cache-Control, a vida útil é 0"
assert decidir({"Cache-Control": "public"}, 0, 0) == "revalidar"
assert decidir({"Cache-Control": "s-maxage=300"}, 0, 10) == "revalidar", "cache privado ignora o s-maxage"
assert decidir({"Cache-Control": "max-age=60", "Age": "10"}, 0, 49, compartilhado=True) == "fresco"`,
          },
          {
            name: 'asterisco, espaços e tags parecidas',
            hidden: true,
            code: `assert responder({"If-None-Match": "*"}, '"v7"', "x") == (304, {"ETag": '"v7"'}, "")
assert responder({"If-None-Match": ' "a" ,W/"b"  '}, '"b"', "x")[0] == 304
assert responder({"If-None-Match": '"v4", "v420"'}, '"v42"', "x")[0] == 200, "v42 não está na lista"`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'A função recebe `agora` de propósito: com o relógio **injetado**, dá para testar "exatamente 60 segundos depois" sem esperar e sem bordas instáveis. Não consulte o relógio do sistema dentro da lógica de cache.',
            concept: 'Injeção de relógio',
          },
          {
            when: m => m.maxComplexity > 10,
            text: 'A decisão ficou com muitos caminhos numa função só. Separe o **parsing** do `Cache-Control` (um dict de diretivas), o cálculo da **vida útil** e a **decisão**: cada parte fica pequena e fácil de testar na borda.',
            concept: 'Coesão',
          },
        ],
        hints: [
          'Comece por um parser: `"public, Max-Age=60"` → `{"public": None, "max-age": "60"}`. Com `split(",")`, `strip()`, `partition("=")` e `lower()` no nome, sai em poucas linhas.',
          'Na ordem: `no-store` (ou `private` num cache compartilhado) → `"nao_armazenar"`; `no-cache` → `"revalidar"`; depois idade = `int(cabecalhos.get("Age", 0)) + (agora - recebido_em)` e vida útil (`s-maxage` só se `compartilhado` e presente).',
          'Em `responder`, não compare a string crua do cabeçalho: ela pode ser uma lista, ter espaços, `W/` ou `*`. Normalize cada ETag (tire espaços e o `W/`), monte um conjunto e confira `"*"` ou a ETag atual normalizada.',
        ],
        solution: `def _diretivas(valor):
    """'public, Max-Age=60' → {'public': None, 'max-age': '60'}"""
    diretivas = {}
    for parte in valor.split(","):
        nome, _, arg = parte.strip().partition("=")
        if nome:
            diretivas[nome.strip().lower()] = arg.strip().strip('"') or None
    return diretivas


def _segundos(diretivas, nome):
    valor = diretivas.get(nome)
    return int(valor) if valor else 0


def _vida_util(diretivas, compartilhado):
    if compartilhado and "s-maxage" in diretivas:
        return _segundos(diretivas, "s-maxage")
    return _segundos(diretivas, "max-age")


def decidir(cabecalhos, recebido_em, agora, compartilhado=False):
    d = _diretivas(cabecalhos.get("Cache-Control", ""))
    if "no-store" in d or ("private" in d and compartilhado):
        return "nao_armazenar"
    if "no-cache" in d:
        return "revalidar"
    idade = int(cabecalhos.get("Age", 0)) + (agora - recebido_em)
    vida = _vida_util(d, compartilhado)
    if idade < vida:
        return "fresco"
    if idade < vida + _segundos(d, "stale-while-revalidate"):
        return "stale_revalidando"
    return "revalidar"


def _opaca(etag):
    etag = etag.strip()
    return etag[2:] if etag.startswith("W/") else etag     # comparação fraca: ignora o W/


def responder(req_cabecalhos, etag_atual, corpo):
    cabecalhos = {"ETag": etag_atual}
    pedido = req_cabecalhos.get("If-None-Match")
    if pedido is not None:
        candidatas = {_opaca(e) for e in pedido.split(",")}
        if "*" in candidatas or _opaca(etag_atual) in candidatas:
            return 304, cabecalhos, ""
    return 200, cabecalhos, corpo
`,
        solutionExplanation: 'O parser de diretivas transforma o cabeçalho num dict — e todo o resto vira consulta a esse dict. A **ordem** das regras importa: proibições primeiro (`no-store`, `private` num cache compartilhado), depois a obrigação de revalidar (`no-cache`), e só então o cálculo de frescor. A idade soma o `Age` — o tempo que a resposta já passou em outros caches — ao tempo local; sem isso, uma CDN atrás de outra "rejuvenesceria" a cópia. Na origem, `If-None-Match` exige comparação **fraca** (ignorar o `W/`), e o `*` casa com qualquer versão existente. O 304 volta **sem corpo**, mas com o `ETag`: o cache precisa dele para a próxima revalidação. (Um parser de produção ainda trataria vírgulas dentro de ETags entre aspas.)',
      },
      {
        type: 'code',
        id: 'api-cache-q4',
        concept: 'Request coalescing',
        title: 'Cache com request coalescing (asyncio)',
        say: 'Agora a defesa contra o stampede: um cache assíncrono em que mil misses simultâneos viram uma única busca.',
        prompt: `Implemente \`CacheCoalescente(buscar, ttl, relogio)\` com o método assíncrono \`obter(chave)\`. \`buscar\` é uma função \`async\` que vai à origem (lenta e cara); \`relogio()\` devolve o "agora" em segundos — nos testes, um relógio falso.

- **Hit:** se há valor guardado para a chave e \`relogio() - salvo_em < ttl\`, devolva-o **sem** chamar \`buscar\`.
- **Miss (ou vencido):** se já existe uma busca **em andamento** para essa chave, **espere por ela** — nada de chamar \`buscar\` de novo. Senão, inicie **uma** busca.
- **Sucesso:** guarde o valor com \`salvo_em = relogio()\` lido quando a busca **terminou**; todos os que esperavam recebem o mesmo valor.
- **Falha:** todos os que esperavam recebem a exceção, **nada** é guardado, e a próxima chamada tenta de novo.
- **Cancelamento:** se um dos chamadores for cancelado (o cliente dele desistiu), a busca **continua** para os outros.
- Chaves diferentes não se misturam.`,
        starter: `import asyncio
import time


class CacheCoalescente:
    def __init__(self, buscar, ttl, relogio=time.monotonic):
        self._buscar = buscar          # async def buscar(chave) -> valor
        self.ttl = ttl
        self._relogio = relogio

    async def obter(self, chave):
        # TODO: hit fresco → devolve; miss → UMA busca por chave, compartilhada
        pass
`,
        tests: [
          {
            name: 'hit dentro do TTL; vencido busca de novo',
            code: PRE_COAL + `portao.set()
cache = CacheCoalescente(buscar, ttl=30, relogio=relogio)
v1 = await cache.obter("home")
assert v1 == "home#1", f"o primeiro obter deveria buscar na origem e devolver 'home#1', veio {v1!r}"
agora[0] = 29.9
v2 = await cache.obter("home")
assert v2 == "home#1" and chamadas == ["home"], f"dentro do TTL deveria ser HIT (origem chamada {len(chamadas)} vez(es))"
agora[0] = 30.0
v3 = await cache.obter("home")
assert v3 == "home#2", f"com idade 30 e ttl 30 o valor venceu: deveria buscar de novo ('home#2'), veio {v3!r}"`,
          },
          {
            name: '50 misses simultâneos viram UMA busca',
            code: PRE_COAL + `cache = CacheCoalescente(buscar, ttl=30, relogio=relogio)
tarefas = [asyncio.ensure_future(cache.obter("home")) for _ in range(50)]
try:
    await rodar_pendentes()
    assert chamadas == ["home"], f"50 misses simultâneos deveriam virar 1 busca na origem, viraram {len(chamadas)}"
finally:
    portao.set()
valores = await asyncio.gather(*tarefas)
assert set(valores) == {"home#1"}, f"todos deveriam receber o mesmo valor, vieram {set(valores)}"`,
          },
          {
            name: 'falha: todos recebem a exceção e nada fica guardado',
            code: PRE_COAL + `falhar = [True]
async def buscar_instavel(chave):
    chamadas.append(chave)
    await asyncio.sleep(0)
    if falhar[0]:
        raise ConnectionError("origem fora do ar")
    return "ok"

cache = CacheCoalescente(buscar_instavel, ttl=30, relogio=relogio)
resultados = await asyncio.gather(*(cache.obter("k") for _ in range(3)), return_exceptions=True)
assert len(chamadas) == 1, f"3 chamadas simultâneas deveriam virar 1 busca, viraram {len(chamadas)}"
assert all(isinstance(r, ConnectionError) for r in resultados), f"todos deveriam receber a ConnectionError, vieram {resultados}"
falhar[0] = False
v = await cache.obter("k")
assert v == "ok" and len(chamadas) == 2, "depois de uma falha, a próxima chamada deve buscar de novo"`,
          },
          {
            name: 'cancelar um chamador não cancela a busca dos outros',
            code: PRE_COAL + `cache = CacheCoalescente(buscar, ttl=30, relogio=relogio)
apressado = asyncio.ensure_future(cache.obter("home"))
paciente = asyncio.ensure_future(cache.obter("home"))
await rodar_pendentes()
apressado.cancel()
await rodar_pendentes()
portao.set()
try:
    valor = await asyncio.wait_for(paciente, timeout=1)
except asyncio.CancelledError:
    raise AssertionError("cancelar UM chamador cancelou a busca de TODOS: proteja a busca compartilhada") from None
except TimeoutError:
    raise AssertionError("o outro chamador ficou esperando para sempre: a busca morreu junto com o cancelado") from None
assert valor == "home#1", f"o chamador paciente deveria receber 'home#1', recebeu {valor!r}"
assert chamadas == ["home"], f"a origem deveria ter sido chamada 1 vez, foi {len(chamadas)}"`,
          },
          {
            name: 'chaves diferentes não se misturam',
            hidden: true,
            code: PRE_COAL + `portao.set()
cache = CacheCoalescente(buscar, ttl=30, relogio=relogio)
a, b = await asyncio.gather(cache.obter("a"), cache.obter("b"))
assert sorted(chamadas) == ["a", "b"], f"cada chave precisa da sua própria busca: {chamadas}"
assert a.startswith("a#") and b.startswith("b#"), f"valores trocados: a={a!r}, b={b!r}"`,
          },
          {
            name: 'a idade conta a partir do fim da busca',
            hidden: true,
            code: PRE_COAL + `cache = CacheCoalescente(buscar, ttl=10, relogio=relogio)
tarefa = asyncio.ensure_future(cache.obter("k"))
await rodar_pendentes()
agora[0] = 5.0
portao.set()
await tarefa
agora[0] = 14.0
await cache.obter("k")
assert len(chamadas) == 1, "salvo_em é o instante em que a busca TERMINOU (t=5), não o início (t=0)"
agora[0] = 15.0
await cache.obter("k")
assert len(chamadas) == 2, "em t=15 o valor tem 10 s de idade (ttl=10): venceu"`,
          },
        ],
        reviews: [
          {
            when: m => m.bareExcepts > 0,
            text: 'Um `except:` sem tipo também captura `asyncio.CancelledError` — e engolir cancelamento deixa tarefas zumbis e chamadores pendurados. Capture `Exception` ou, melhor, use só `try/finally` para limpar o estado.',
            concept: 'Cancelamento em asyncio',
          },
          {
            when: m => m.calls.includes('sleep'),
            text: 'Nada de `sleep` ou *polling* para esperar a busca terminar: quem chega depois deve aguardar o **mesmo** `Task`/`Future` — sem atraso extra e sem gastar CPU.',
            concept: 'Request coalescing',
          },
          {
            when: m => m.imports.includes('threading'),
            text: 'Em código `asyncio`, `threading.Lock` bloqueia o event loop inteiro. Use as primitivas do asyncio — ou um dict de tarefas em andamento, que dispensa lock porque o loop só troca de tarefa nos `await`.',
            concept: 'Concorrência com asyncio',
          },
          {
            when: m => m.calls.includes('monotonic') || m.calls.includes('time') || m.calls.includes('perf_counter'),
            text: 'Você chamou o relógio do sistema dentro da lógica. Use sempre o `relogio` injetado: é ele que permite testar "30 segundos depois" sem esperar 30 segundos.',
            concept: 'Injeção de relógio',
          },
        ],
        hints: [
          'Guarde dois dicts: `_valores[chave] = (valor, salvo_em)` e `_em_voo[chave] = tarefa` (a busca em andamento). No miss, se a chave já está em `_em_voo`, **aguarde a mesma tarefa**.',
          'Crie a busca com `asyncio.create_task(self._carregar(chave))`. Em `_carregar`, use `try/finally` para tirar a chave de `_em_voo` quando a busca terminar — com sucesso **ou** erro — e só grave em `_valores` no sucesso, lendo o relógio depois do `await`.',
          'Cancelar quem está fazendo `await tarefa` cancela a **própria tarefa** — e todo mundo que a esperava junto. Use `await asyncio.shield(tarefa)`: o chamador cancelado sai, e a busca segue para os outros.',
        ],
        solution: `import asyncio
import time


class CacheCoalescente:
    def __init__(self, buscar, ttl, relogio=time.monotonic):
        self._buscar = buscar          # async def buscar(chave) -> valor
        self.ttl = ttl
        self._relogio = relogio
        self._valores = {}             # chave -> (valor, salvo_em)
        self._em_voo = {}              # chave -> Task da busca em andamento

    async def obter(self, chave):
        guardado = self._valores.get(chave)
        if guardado is not None and self._relogio() - guardado[1] < self.ttl:
            return guardado[0]                                    # HIT fresco
        tarefa = self._em_voo.get(chave)
        if tarefa is None:                                        # 1º miss: UMA busca por chave
            tarefa = asyncio.create_task(self._carregar(chave))
            self._em_voo[chave] = tarefa
        # shield: se ESTE chamador for cancelado, a busca segue para os outros
        return await asyncio.shield(tarefa)

    async def _carregar(self, chave):
        try:
            valor = await self._buscar(chave)
            self._valores[chave] = (valor, self._relogio())       # idade conta do FIM da busca
            return valor
        finally:
            self._em_voo.pop(chave, None)                         # sucesso ou erro: libera a vaga
`,
        solutionExplanation: 'O dict `_em_voo` é o coração do *single-flight*: o primeiro miss cria **uma** `Task` e a publica; quem chega depois só aguarda a mesma. Não precisa de lock porque o event loop só troca de tarefa nos `await` — entre o `get` e a atribuição em `_em_voo`, ninguém interrompe. O `try/finally` em `_carregar` libera a vaga com sucesso **ou** erro (senão uma falha ficaria "grudada" para sempre), e só o sucesso vai para `_valores`, com o relógio lido **depois** da busca. O `asyncio.shield` isola a busca compartilhada do cancelamento de um chamador individual — sem ele, o timeout de um único cliente cancelaria a resposta de todos. Em produção, você ainda somaria *stale-while-revalidate* (servir o valor velho enquanto a tarefa roda) e jitter no TTL.',
      },
      {
        type: 'open',
        id: 'api-cache-q5',
        concept: 'Cache stampede',
        say: 'Última: um incidente de Black Friday. Me explique o que está acontecendo.',
        prompt: 'Na Black Friday, a home de um e-commerce fica no Redis com **TTL de 60 s** e recebe 5.000 req/s. A cada minuto, **em ponto**, o banco vai a 100% de CPU por alguns segundos e surgem timeouts — depois tudo normaliza até o minuto seguinte. Explique o que está acontecendo e proponha pelo menos três defesas.',
        minWords: 40,
        rubric: [
          { label: 'Diagnostica o **cache stampede**: a chave expira e milhares de misses simultâneos recalculam o mesmo valor', keywords: ['stampede', 'thundering', 'herd', 'manada', 'dogpile', 'dog-pile', 'misses simultaneos', 'miss simultaneo', 'expira ao mesmo tempo', 'expiram ao mesmo tempo', 'todas recalcul', 'todos recalcul', 'todas as requisicoes vao', 'todas vao ao banco'], concept: 'Cache stampede', why: 'O padrão "a cada minuto, em ponto" é a assinatura da expiração de uma chave quente: todas as requisições daquele instante viram miss juntas.' },
          { label: 'Propõe **coalescing** ou lock: uma única busca por chave, os outros esperam', keywords: ['coalesc', 'single-flight', 'singleflight', 'single flight', 'lock', 'trava', 'lease', 'mutex', 'uma unica busca', 'uma so busca', 'apenas uma requisicao', 'so uma requisicao'], concept: 'Request coalescing', why: 'Com uma busca por chave, o banco vê 1 consulta por expiração, não centenas.' },
          { label: 'Serve o **valor velho** enquanto atualiza (stale-while-revalidate, refresh em segundo plano)', keywords: ['stale', 'segundo plano', 'background', 'assincron', 'valor antigo', 'versao antiga', 'valor velho', 'copia velha', 'refresh antecipado', 'renovar antes'], concept: 'stale-while-revalidate', why: 'Servir a cópia velha por alguns segundos tira a origem do caminho crítico: ninguém espera pela consulta pesada.' },
          { label: '**Espalha ou antecipa** a expiração: TTL com jitter, expiração probabilística, aquecimento', keywords: ['jitter', 'aleatori', 'probabil', 'xfetch', 'antecipad', 'aquec', 'warm', 'pre-carreg', 'precarreg', 'nunca expir'], concept: 'Prevenção de stampede', why: 'Se a chave nunca expira sob carga (reaquecida antes) ou expira em momentos espalhados, o pico sincronizado desaparece.' },
        ],
        modelAnswer: `É um **cache stampede** (*thundering herd*): a chave da home expira a cada 60 s, em ponto, e todas as requisições daquele instante dão miss juntas — centenas de consultas idênticas e pesadas chegam ao banco ao mesmo tempo, e os timeouts ainda geram retries que pioram o pico.

Defesas, em camadas:

1. **Request coalescing / lock**: só a primeira requisição que dá miss recalcula (um lock com expiração no Redis, como \`SET NX PX\`, ou single-flight dentro de cada processo); as outras esperam esse resultado ou recebem a versão anterior.
2. **Servir o velho enquanto atualiza** (*stale-while-revalidate*): guardar o valor com uma validade "suave" e outra "dura"; passada a suave, uma única tarefa atualiza em segundo plano enquanto todos continuam recebendo o valor antigo.
3. **Expiração espalhada ou antecipada**: TTL com jitter aleatório, expiração antecipada probabilística (XFetch) ou um job que reaquece a home a cada 50 s — assim ela nunca expira sob carga.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Agora você sabe fazer o HTTP trabalhar por você — e proteger a origem quando a multidão chega.',
          { text: 'Resumo: Cache-Control para o frescor, ETag e 304 para revalidar barato, Vary com moderação — e coalescing para que uma chave expirando não vire uma avalanche.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
