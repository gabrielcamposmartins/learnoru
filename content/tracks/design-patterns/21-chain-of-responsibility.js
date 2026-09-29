Game.registerModule('design-patterns', {
  id: 'chain-of-responsibility',
  title: 'Chain of Responsibility',
  kind: 'lesson',
  level: 2,
  order: 36,
  unit: 'comportamentais',
  summary: 'Passe o pedido por uma corrente de handlers — das alçadas de aprovação aos middlewares do Django e ao logging.',
  concepts: ['Chain of Responsibility', 'Middleware', 'Curto-circuito', 'Propagação no logging', 'Fim da cadeia'],
  takeaways: [
    'No **Chain of Responsibility**, quem pede só conhece o **primeiro elo**; cada elo decide **tratar ou repassar**, e a corrente é montada fora, por configuração.',
    'Há dois sabores: o CoR **puro**, em que um elo trata e a corrente para (alçadas, `try/except`), e o **pipeline**, em que todos agem e um elo pode dar **curto-circuito** (middlewares, `logging`).',
    'Middlewares seguem o **modelo cebola**: a ida percorre a lista em ordem e a volta, na ordem inversa. A ordem importa: autenticação antes do cache!',
    'Decida o **fim da cadeia**: um elo terminal padrão ou uma exceção explícita, nunca um `None` silencioso. No `logging`, esse elo é o `logging.lastResort`.',
  ],
  glossary: [
    { term: 'Chain of Responsibility', aliases: ['cadeia de responsabilidade', 'corrente de responsabilidade'], definition: 'Padrão comportamental (GoF) em que o pedido percorre uma corrente de handlers: cada um decide **tratar** ou **repassar** ao próximo, e quem pede só conhece o primeiro elo.' },
    { term: 'Middleware', aliases: ['middlewares'], definition: 'Camada que envolve o tratamento de uma requisição: age antes e/ou depois de chamar o próximo elo e pode responder sozinha (curto-circuito). Ex.: WSGI, Django, ASGI.' },
    { term: 'Modelo cebola', aliases: ['onion model', 'modelo de cebola'], definition: 'Como middlewares aninhados executam: a requisição atravessa as camadas de fora para dentro e a resposta volta de dentro para fora, na ordem inversa.' },
    { term: 'logging.lastResort', aliases: ['lastResort'], definition: 'Handler "de último recurso" do módulo `logging` (nível WARNING, escreve no stderr), usado quando nenhum handler é encontrado na subida até o logger raiz.' },
    { term: 'Alçada', aliases: ['alçadas', 'alcada', 'alcadas'], definition: 'Limite de autoridade de um aprovador (ex.: a gerência aprova até R$ 10 mil). Alçadas em sequência são o exemplo clássico de Chain of Responsibility.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje é dia de **Chain of Responsibility**, a "corrente de responsabilidade".',
        'Em vez de um objeto decidir quem cuida de cada pedido, montamos uma **corrente** de tratadores. Cada elo olha o pedido e escolhe: **trato eu** ou **passo adiante**.',
      ],
      board: {
        title: 'O problema: quem aprova este reembolso?',
        md: `\`\`\`python
def aprovar_reembolso(valor, gerente_de_ferias=False):
    if valor <= 1_000:
        return "coordenação"
    elif valor <= 10_000 and not gerente_de_ferias:
        return "gerência"
    elif valor <= 100_000:
        return "diretoria"
    else:
        return "conselho"
\`\`\`

- Quem **pede** conhece todos os aprovadores **e** a ordem entre eles.
- Mudou a política (compliance antes de tudo, um nível novo, alguém de férias)? Edita-se esta função — e cada \`if\` novo traz seus casos especiais.

**Intenção (GoF):** evitar acoplar o remetente de um pedido ao seu receptor, dando a **mais de um objeto** a chance de tratá-lo. Os receptores formam uma corrente, e o pedido passa por ela até que alguém o trate.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na versão clássica, cada aprovador guarda uma referência ao **próximo**. Se o valor cabe na sua alçada, ele aprova; se não, repassa.',
        'Repare que quem pede só conversa com o **primeiro** elo e não faz ideia de quantos existem depois dele.',
      ],
      board: {
        title: 'A corrente clássica: alçadas de aprovação',
        code: `class Aprovador:
    def __init__(self, nome, limite):
        self.nome = nome
        self.limite = limite
        self.proximo = None

    def encadear(self, proximo):
        self.proximo = proximo
        return proximo                     # permite a.encadear(b).encadear(c)

    def aprovar(self, valor):
        if valor <= self.limite:
            return self.nome               # TRATA: a corrente para aqui
        if self.proximo is None:
            raise LookupError(f"ninguém aprova {valor}")   # fim da corrente
        return self.proximo.aprovar(valor) # REPASSA


coord = Aprovador("coordenação", 1_000)
coord.encadear(Aprovador("gerência", 10_000)).encadear(Aprovador("diretoria", 100_000))

print(coord.aprovar(800))       # coordenação
print(coord.aprovar(50_000))    # diretoria`,
        caption: 'Reordenar, inserir ou remover níveis é mexer na **montagem** da corrente (que pode vir de configuração), não no código de quem pede.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora um detalhe que quase ninguém explica: existem **dois sabores** de corrente.',
        'No CoR "puro", **um** elo trata e a corrente para. No **pipeline**, todos fazem a sua parte e repassam — parar cedo é a exceção.',
      ],
      board: {
        title: 'Quem termina × quem repassa',
        md: `| | CoR "puro" (GoF) | Pipeline (middlewares) |
|---|---|---|
| Quem trata | **um** elo, e a corrente para | **vários** elos agem, na ida e na volta |
| Repassar significa… | "não é comigo" | "fiz a minha parte, segue" |
| Parar cedo é… | o normal | um **curto-circuito** (401, resposta do cache) |
| Exemplos | alçadas, suporte N1 → N2 → N3, \`try/except\` | WSGI, Django, filtros de servlet, \`logging\` |

**E se ninguém tratar?** O próprio GoF avisa: *o recebimento não é garantido*. Escolha de propósito:

- ✅ **Elo terminal padrão** no fim — um "conselho" que sempre decide, uma página 404;
- ✅ **Exceção explícita** — falha alta e clara, como o \`LookupError\` do quadro anterior;
- ❌ devolver \`None\` em silêncio — o bug aparece longe dali.

> [!atencao] Pedido que escorrega pelo fim da corrente **sem ninguém perceber** é o bug clássico do padrão. O último elo precisa de uma decisão explícita.`,
      },
    },
    {
      type: 'say',
      text: [
        'O sabor mais comum no dia a dia é o **pipeline de middlewares**. Todo framework web Python tem um.',
        'Cada middleware recebe o **próximo** elo e decide: faz algo antes, chama o próximo, faz algo depois — ou responde sozinho.',
      ],
      board: {
        title: 'Middlewares: a corrente dos frameworks web',
        md: `\`\`\`python
# Django: o middleware recebe o próximo elo (get_response) ao ser criado
class TempoDeResposta:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        inicio = time.perf_counter()               # na IDA
        response = self.get_response(request)      # repassa
        response["X-Tempo"] = f"{time.perf_counter() - inicio:.3f}s"   # na VOLTA
        return response


class SoParaLogados:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            return HttpResponse(status=401)        # curto-circuito: a view nem roda
        return self.get_response(request)
\`\`\`

\`\`\`text
MIDDLEWARE = [TempoDeResposta, SoParaLogados]

request  ──▶ TempoDeResposta ──▶ SoParaLogados ──▶ view
response ◀── TempoDeResposta ◀── SoParaLogados ◀──┘
\`\`\`

- **Ida** na ordem da lista; **volta** na ordem inversa — é o *modelo cebola*.
- No **WSGI** é igual: um middleware é um app que embrulha outro app — \`app = Gzip(Sessao(app))\`.

> [!atencao] A ordem importa! Um cache de páginas **por fora** da autenticação pode servir a página privada de um usuário para outro.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E tem uma corrente escondida num lugar que você usa todo dia: o módulo `logging`.',
        'Loggers formam uma **hierarquia** pelo nome (`app.pagamentos` é filho de `app`), e cada registro **sobe** por ela passando pelos handlers de cada nível.',
      ],
      board: {
        title: 'O logging é um pipeline de handlers',
        md: `\`\`\`python
import logging

logging.basicConfig()                           # põe um handler no logger raiz (root)
pag = logging.getLogger("app.pagamentos")       # filho de "app", neto do root
pag.addHandler(logging.FileHandler("pagamentos.log"))

pag.error("cartão recusado")
# 1. handlers de "app.pagamentos"  → grava em pagamentos.log
# 2. propagate=True → handlers de "app" (não há nenhum)
# 3. propagate=True → handlers do root → imprime no terminal

pag.propagate = False                           # agora a corrente para no próprio logger
\`\`\`

Aqui **todos** os handlers do caminho recebem o registro; quem encerra a corrente é o \`propagate = False\`.

> [!atencao] Na subida, o **nível dos loggers ancestrais é ignorado** — só contam o nível e os filtros de cada **handler**. Um \`debug\` de \`app.pagamentos\` (com nível próprio DEBUG) chega aos handlers de \`app\` mesmo que \`app\` esteja em ERROR.

> [!sabia] E se ninguém tiver handler? O \`logging\` tem um **elo terminal** escondido: o \`logging.lastResort\`, um handler "de último recurso" (nível WARNING, escreve no \`stderr\`). É por isso que \`logging.getLogger("x").warning("oi")\` aparece mesmo sem configurar nada — só a mensagem crua, sem formatação.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Como todo padrão, este também cobra o seu preço. A pergunta de sempre: **quando não usar?**',
        'Se só existe um tratador, ou se a escolha é por uma chave conhecida, a corrente só adiciona voltas.',
      ],
      board: {
        title: 'Quando usar (e quando não)',
        md: `| ✅ Use quando | ❌ Evite quando |
|---|---|
| Vários objetos **podem** tratar e quem trata só se sabe em execução | Há um único tratador — é só uma chamada de função |
| As etapas mudam por **configuração** (lista de middlewares, níveis de aprovação) | A escolha é por uma **chave** conhecida: um \`dict\` de handlers resolve em O(1) |
| Preocupações transversais: autenticação, log, cache, compressão | Ninguém consegue dizer, lendo o código, **quem** trata o quê |

**Custos:** depurar "quem tratou isto?", bugs de **ordem**, latência de correntes longas e pedidos que **ninguém** trata.

> [!dica] Repare na semelhança com o **Decorator**: os dois encadeiam objetos que guardam "o próximo". Qual é a diferença? Ela vai aparecer nas atividades 😉`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cebolas, correntes reais, logs duplicados e um mini-framework.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-cor-q1',
      concept: 'Curto-circuito',
      say: 'Primeiro, siga a requisição pela cebola com calma.',
      prompt: `Cada middleware recebe o próximo handler e devolve um novo. O que este código imprime?

\`\`\`python
def log(proximo):
    def handler(req):
        print("log: ida")
        resp = proximo(req)
        print("log: volta")
        return resp
    return handler

def auth(proximo):
    def handler(req):
        if "usuario" not in req:
            print("auth: bloqueou")
            return 401
        return proximo(req)
    return handler

def view(req):
    print("view")
    return 200

app = log(auth(view))
print(app({}))
\`\`\``,
      options: [
        { text: '`log: ida` → `auth: bloqueou` → `log: volta` → `401`', correct: true, why: '`auth` não chama o próximo (curto-circuito), então a `view` não roda. Mas a resposta **volta** pela camada de fora, que continua depois de `proximo(req)` e imprime `log: volta`.' },
        { text: '`log: ida` → `auth: bloqueou` → `view` → `log: volta` → `200`', why: 'Bloquear significa justamente **não** chamar `proximo(req)`: a view nunca executa.' },
        { text: '`log: ida` → `auth: bloqueou` → `401`', why: 'O curto-circuito só pula as camadas **internas**. A camada de fora recebe o 401 de volta e termina o seu código normalmente.' },
        { text: '`auth: bloqueou` → `log: ida` → `log: volta` → `401`', why: '`log` é a camada mais **externa** (`log(auth(view))`): é a primeira a ver a requisição.' },
      ],
      explanation: 'É o **modelo cebola**: a requisição entra de fora para dentro e a resposta sai de dentro para fora. Um elo que responde sem chamar o próximo **interrompe a ida**, mas as camadas externas continuam recebendo a resposta na volta — por isso logs, métricas e cabeçalhos colocados por fora funcionam até para requisições bloqueadas.',
    },
    {
      type: 'match',
      id: 'dp-cor-q2',
      concept: 'Fim da cadeia',
      say: 'Toda corrente precisa de uma regra de parada. Vamos ver as do mundo real.',
      prompt: 'Associe cada corrente real a **como ela termina**.',
      pairs: [
        { left: 'Alçadas de aprovação', right: 'O **primeiro** elo com limite suficiente decide; os seguintes nem ficam sabendo' },
        { left: 'Middlewares do Django', right: 'Todos agem na ida e na volta; um deles pode responder **sem chamar** o próximo' },
        { left: 'Hierarquia do `logging`', right: 'Todos os handlers do caminho recebem o registro; `propagate = False` corta a subida' },
        { left: '`try`/`except` na pilha de chamadas', right: 'A exceção sobe pelas funções até o primeiro `except` compatível' },
        { left: 'Eventos do DOM (*bubbling*)', right: 'O evento sobe pelos elementos pais até alguém chamar `stopPropagation()`' },
      ],
      explanation: 'Alçadas e `try/except` são o CoR **puro**: um elo trata e a corrente para. Middlewares, `logging` e o *bubbling* do DOM são **pipelines**: vários elos agem, e parar é uma decisão explícita (curto-circuito, `propagate = False`, `stopPropagation()`).',
    },
    {
      type: 'mcq',
      id: 'dp-cor-q3',
      concept: 'Propagação no logging',
      say: 'Esse bug aparece em quase todo projeto. Já aconteceu com você?',
      prompt: `Este código imprime **duas vezes** a mesma mensagem. Por quê?

\`\`\`python
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("loja.pedidos")
log.addHandler(logging.StreamHandler())
log.info("pedido 42 criado")
\`\`\``,
      options: [
        { text: 'O registro é tratado pelo handler de `loja.pedidos` e depois **propaga** até o logger raiz, cujo handler (criado pelo `basicConfig`) imprime de novo.', correct: true, why: 'É a corrente do `logging`: todos os handlers no caminho até o root recebem o registro.' },
        { text: '`getLogger` criou um segundo logger com o mesmo nome, e cada um imprime uma vez.', why: '`getLogger("loja.pedidos")` sempre devolve o **mesmo** objeto: o módulo mantém um registro de loggers por nome.' },
        { text: 'O `StreamHandler` escreve no `stdout` e no `stderr` ao mesmo tempo.', why: 'Ele escreve num único stream — o `stderr`, por padrão.' },
        { text: '`level=logging.INFO` faz cada mensagem INFO ser registrada duas vezes.', why: 'Nível só **filtra**, não duplica. Com `level=logging.WARNING`, a mensagem nem apareceria.' },
      ],
      explanation: 'Log duplicado é o sintoma nº 1 de uma corrente que **não para**. Correções: configure handlers **só no root** (o mais comum em aplicações) ou faça `log.propagate = False` no logger que tem handler próprio. E bibliotecas não deveriam adicionar handlers (no máximo um `NullHandler`): quem decide a saída é a aplicação.',
    },
    {
      type: 'code',
      id: 'dp-cor-q4',
      concept: 'Middleware',
      title: 'Mini-framework de middlewares',
      say: 'Hora de construir o seu próprio pipeline: montar a corrente, barrar quem não tem token e cachear respostas.',
      prompt: `Um **app** é uma função \`app(req) -> (status, corpo)\`, em que \`req\` é um dicionário como \`{"caminho": "/perfil", "token": "segredo"}\`. Um **middleware** recebe o próximo handler e devolve um novo: \`mw(proximo) -> handler\`.

1. \`montar_pipeline(middlewares, app)\` devolve o handler final. \`middlewares[0]\` é a camada **mais externa** (a primeira a ver a requisição, como na lista \`MIDDLEWARE\` do Django). Com a lista vazia, as requisições vão direto para o \`app\`. Não altere a lista recebida.
2. \`exige_token(proximo)\`: se \`req.get("token") != "segredo"\`, responde \`(401, "não autorizado")\` **sem chamar** o próximo; senão, repassa.
3. \`cache_por_caminho(proximo)\`: se já existe resposta guardada para \`req["caminho"]\`, devolve-a **sem chamar** o próximo; senão, repassa e guarda a resposta — **só** se o status for 200. Cada middleware criado tem o **seu próprio** cache.`,
      starter: `def montar_pipeline(middlewares, app):
    # middlewares[0] deve ser a camada mais externa
    pass


def exige_token(proximo):
    def handler(req):
        pass
    return handler


def cache_por_caminho(proximo):
    def handler(req):
        pass
    return handler
`,
      tests: [
        { name: 'lista vazia: vai direto ao app', code: `def app(req):
    return (200, "eco " + req["caminho"])

h = montar_pipeline([], app)
assert h({"caminho": "/a"}) == (200, "eco /a")` },
        { name: 'o primeiro da lista é a camada de fora', code: `eventos = []

def rastreia(nome):
    def mw(proximo):
        def handler(req):
            eventos.append(nome + " ida")
            resp = proximo(req)
            eventos.append(nome + " volta")
            return resp
        return handler
    return mw

def app(req):
    eventos.append("app")
    return (200, "ok")

h = montar_pipeline([rastreia("A"), rastreia("B")], app)
assert h({"caminho": "/"}) == (200, "ok")
assert eventos == ["A ida", "B ida", "app", "B volta", "A volta"], eventos` },
        { name: 'exige_token barra sem chamar o app', code: `chamadas = []

def app(req):
    chamadas.append(req["caminho"])
    return (200, "dados de " + req["caminho"])

h = montar_pipeline([exige_token], app)
assert h({"caminho": "/admin"}) == (401, "não autorizado")
assert h({"caminho": "/admin", "token": "errado"}) == (401, "não autorizado")
assert chamadas == [], "com token inválido o app não pode rodar (curto-circuito)"
assert h({"caminho": "/admin", "token": "segredo"}) == (200, "dados de /admin")` },
        { name: 'cache evita chamar o app de novo', code: `chamadas = []

def app(req):
    chamadas.append(req["caminho"])
    return (200, "página " + req["caminho"])

h = montar_pipeline([cache_por_caminho], app)
assert h({"caminho": "/a"}) == (200, "página /a")
assert h({"caminho": "/a"}) == (200, "página /a")
assert h({"caminho": "/b"}) == (200, "página /b")
assert chamadas == ["/a", "/b"], chamadas` },
        { name: 'curto-circuito ainda volta pela camada de fora', hidden: true, code: `eventos = []

def rastreia(proximo):
    def handler(req):
        eventos.append("ida")
        resp = proximo(req)
        eventos.append("volta " + str(resp[0]))
        return resp
    return handler

h = montar_pipeline([rastreia, exige_token], lambda req: (200, "ok"))
assert h({"caminho": "/"}) == (401, "não autorizado")
assert eventos == ["ida", "volta 401"], eventos` },
        { name: 'cache só guarda status 200', hidden: true, code: `respostas = iter([(500, "erro"), (200, "ok")])
h = montar_pipeline([cache_por_caminho], lambda req: next(respostas))
assert h({"caminho": "/x"}) == (500, "erro")
assert h({"caminho": "/x"}) == (200, "ok"), "uma resposta 500 não pode ficar no cache"` },
        { name: 'cada pipeline tem o seu cache', hidden: true, code: `h1 = montar_pipeline([cache_por_caminho], lambda req: (200, "app 1"))
h2 = montar_pipeline([cache_por_caminho], lambda req: (200, "app 2"))
assert h1({"caminho": "/"}) == (200, "app 1")
assert h2({"caminho": "/"}) == (200, "app 2"), "o cache vazou entre pipelines (dicionário global ou compartilhado?)"` },
        { name: 'token antes do cache: página privada não vaza', hidden: true, code: `h = montar_pipeline([exige_token, cache_por_caminho], lambda req: (200, "extrato da Ana"))
assert h({"caminho": "/extrato", "token": "segredo"}) == (200, "extrato da Ana")
assert h({"caminho": "/extrato"}) == (401, "não autorizado"), "sem token, nem o cache pode responder"` },
        { name: 'a lista recebida não muda', hidden: true, code: `mws = [exige_token, cache_por_caminho]
montar_pipeline(mws, lambda req: (200, "ok"))
assert mws == [exige_token, cache_por_caminho], "montar_pipeline não deveria alterar a lista recebida"` },
      ],
      reviews: [
        {
          when: (m, code) => /\bmiddlewares\.reverse\(\)/.test(code),
          text: 'Você usou `middlewares.reverse()`, que **altera a lista de quem chamou** — um efeito colateral surpresa (a configuração de middlewares ficaria invertida para o resto do programa). Prefira `reversed(middlewares)` ou `middlewares[::-1]`, que não mexem no original.',
          concept: 'Efeitos colaterais',
        },
        {
          when: (m, code) => /^\s*global\s/m.test(code),
          text: 'Você usou `global`. O estado de um middleware (como o cache) deve viver na **closure** de cada instância — um dicionário criado dentro de `cache_por_caminho` —, senão pipelines diferentes compartilham o mesmo estado.',
          concept: 'Closures',
        },
      ],
      hints: [
        'Um middleware é uma **fábrica de handlers**: `def mw(proximo):` define um `def handler(req): ...` lá dentro e termina com `return handler`.',
        'Para que `middlewares[0]` fique por fora, embrulhe de **dentro para fora**: comece com `handler = app` e percorra `reversed(middlewares)` fazendo `handler = mw(handler)`.',
        'No cache, crie o dicionário **dentro** de `cache_por_caminho`, antes do `def handler`: cada chamada ganha o seu próprio dicionário, preso na closure.',
      ],
      solution: `def montar_pipeline(middlewares, app):
    handler = app
    for mw in reversed(middlewares):
        handler = mw(handler)
    return handler


def exige_token(proximo):
    def handler(req):
        if req.get("token") != "segredo":
            return (401, "não autorizado")
        return proximo(req)
    return handler


def cache_por_caminho(proximo):
    guardadas = {}

    def handler(req):
        caminho = req["caminho"]
        if caminho in guardadas:
            return guardadas[caminho]
        resposta = proximo(req)
        if resposta[0] == 200:
            guardadas[caminho] = resposta
        return resposta
    return handler
`,
      solutionExplanation: 'O `montar_pipeline` embrulha de **dentro para fora** (`reversed`), então o primeiro da lista vira a camada externa — o modelo cebola. Os middlewares são **closures**: `exige_token` decide repassar ou encerrar (curto-circuito), e `cache_por_caminho` guarda o dicionário na closure, o que dá a cada pipeline o seu próprio cache. Repare no teste da ordem: com `[exige_token, cache_por_caminho]` o cache só é consultado **depois** da autenticação; invertendo, a primeira resposta autenticada ficaria no cache e seria servida a quem não tem token. Alternativa de uma linha: `functools.reduce(lambda h, mw: mw(h), reversed(middlewares), app)`.',
    },
    {
      type: 'open',
      id: 'dp-cor-q5',
      concept: 'Chain × Decorator',
      say: 'Para fechar, a comparação que eu prometi. Responda como numa entrevista.',
      prompt: 'Um colega olha o código dos middlewares e diz: "isso é só um **Decorator**". Ele tem razão? Compare **Chain of Responsibility** e **Decorator**.',
      minWords: 20,
      rubric: [
        { label: 'Reconhece a **estrutura parecida**: cada objeto guarda/embrulha o próximo', keywords: ['estrutura', 'parecid', 'semelhan', 'igual', 'embrulh', 'envolv', 'guarda o proximo', 'referencia ao proximo', 'encade', 'wrapper', 'composicao'], concept: 'Composição recursiva', why: 'Nos dois, cada elo tem uma referência ao seguinte e repassa a chamada — o diagrama é quase o mesmo.' },
        { label: 'No **Decorator** todos acrescentam comportamento e o objeto do fim **sempre** é chamado', keywords: ['sempre chama', 'sempre repassa', 'sempre delega', 'sempre executa', 'sempre e chamado', 'sempre roda', 'todos agem', 'todos executam', 'adiciona comportamento', 'adicionar comportamento', 'acrescenta comportamento', 'acrescentar comportamento', 'adiciona responsabilidade', 'adicionar responsabilidade', 'adiciona funcionalidade', 'acrescenta funcionalidade', 'enriquece', 'mesma interface'], concept: 'Decorator', why: 'Um decorator embrulha para **enriquecer**; ele não decide se o componente vai rodar.' },
        { label: 'No **Chain** qualquer elo pode **encerrar** (curto-circuito) — e o pedido pode ficar sem tratamento', keywords: ['interromp', 'encerr', 'para a cadeia', 'parar a cadeia', 'para a corrente', 'parar a corrente', 'curto-circuito', 'curto circuito', 'short-circuit', 'nao repassa', 'nao chama o proximo', 'sem chamar o proximo', 'sem tratamento', 'ninguem trat', 'decide se repassa', 'decide se trata', 'tratar ou repassar', 'bloque', 'responde sozinho'], concept: 'Curto-circuito', why: 'A essência do Chain é a decisão de **tratar ou repassar**: um elo pode responder sem chamar o próximo.' },
        { label: 'Conclui que a diferença é a **intenção** (um pipeline de middlewares mistura os dois)', keywords: ['intencao', 'proposito', 'objetivo', 'hibrid', 'mistura', 'meio termo', 'em parte', 'parcialmente', 'depende'], concept: 'Identificação de padrões', why: 'Middlewares que só enriquecem são Decorators; os que podem barrar o pedido (auth, cache) são Chain. Padrões se distinguem pela intenção.' },
      ],
      modelAnswer: `Em parte. A **estrutura** é quase a mesma: nos dois padrões cada objeto guarda uma referência ao **próximo** (ou ao objeto embrulhado) e repassa a chamada — composição recursiva.

A diferença está na **intenção**:

- No **Decorator**, cada camada **acrescenta comportamento** mantendo a mesma interface, e o objeto do fim sempre é chamado. Ninguém decide se ele roda.
- No **Chain of Responsibility**, cada elo decide **tratar ou repassar**: pode **encerrar** a corrente (curto-circuito), e um pedido pode até ficar **sem tratamento** se nenhum elo o aceitar.

Um pipeline de middlewares é um **híbrido**: um middleware que só mede o tempo age como Decorator; um de autenticação, que devolve 401 sem chamar o próximo, é Chain of Responsibility.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Resumindo: no Chain of Responsibility cada elo **trata ou repassa**, e quem pede só conhece o primeiro.',
        'Lembre dos dois sabores — CoR puro e pipeline —, do **modelo cebola** dos middlewares e de sempre decidir o que acontece no **fim da corrente**.',
      ],
      board: null,
    },
  ],
});
