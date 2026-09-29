(function () {
  // Prelúdio dos testes: logger isolado (fora do registro global do logging) que escreve em memória.
  const PRELUDIO = `import io, json, logging

def montar(relogio=lambda: "2026-09-28T12:00:00Z", nivel=logging.INFO):
    saida = io.StringIO()
    handler = logging.StreamHandler(saida)
    handler.setFormatter(FormatadorJson(relogio))
    logger = logging.Logger("checkout", nivel)
    logger.addHandler(handler)
    logger.propagate = False
    return logger, saida

def linhas(saida):
    return [json.loads(l) for l in saida.getvalue().splitlines()]
`;

  Game.registerModule('observability', {
    id: 'logs',
    title: 'Logs estruturados',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'sinais',
    summary: 'Logs que respondem perguntas às 3h da manhã: JSON em vez de frases soltas, níveis que significam algo, um correlation id em cada linha, amostragem para caber no orçamento — e nenhum segredo vazado.',
    concepts: ['Log estruturado', 'Níveis de log', 'Correlation ID', 'Amostragem', 'Redação de PII'],
    takeaways: [
      'Log **estruturado** (uma linha JSON por evento) troca regex frágil por filtros e agregações: **mensagem fixa**, dados variáveis em **campos**.',
      'Níveis precisam significar algo: **ERROR** = uma operação falhou e alguém talvez precise agir; recuperou sozinho é **WARNING**. E logue uma vez: **ou trate, ou propague**.',
      'Um **correlation id** (request_id/trace_id) em **todas** as linhas de todos os serviços transforma milhares de linhas soltas na história de uma requisição.',
      'No `logging` do Python: Logger → Filter → Handler → **Formatter**. Contexto entra por `extra`, `Filter` ou `LoggerAdapter`; bibliotecas só usam `getLogger(__name__)` e nunca configuram nada.',
      'Nunca logue segredos nem PII em claro: **redija** na origem (allowlist > denylist), serialize com JSON (evita *log injection*) e **amostre** por requisição, mantendo sempre os erros.',
    ],
    glossary: [
      { term: 'Log estruturado', aliases: ['logs estruturados', 'structured logging', 'logging estruturado'], definition: 'Log emitido como **dados** (em geral uma linha JSON por evento, com campos nomeados como `nivel`, `msg`, `request_id`) em vez de frases livres. Permite filtrar, agrupar e contar sem regex.' },
      { term: 'PII', aliases: ['personally identifiable information', 'dado pessoal', 'dados pessoais'], definition: '*Personally Identifiable Information*: dado que identifica uma pessoa, direta ou indiretamente (nome, CPF, e-mail, telefone, endereço, IP). Protegido pela LGPD/GDPR — não deve aparecer em claro em logs.' },
      { term: 'Redação de dados', aliases: ['redaction', 'redação de logs', 'mascaramento de dados'], definition: 'Remover ou mascarar dados sensíveis (senhas, tokens, PII) antes que o evento saia do processo — ex.: `"senha": "***"`. Faça na origem e, como segunda camada, no coletor de logs.' },
      { term: 'Canonical log line', aliases: ['canonical log lines', 'linha canônica', 'wide event', 'wide events'], definition: 'Uma linha de log **larga** por requisição, emitida no fim, com tudo o que importa (rota, status, duração, usuário, versão, contagens). Popularizada pela Stripe; a Honeycomb chama de *wide events*.' },
      { term: 'Amostragem de logs', aliases: ['log sampling', 'sampling de logs'], definition: 'Guardar só uma fração dos eventos de rotina para controlar custo, mantendo sempre os de erro. Decidir por **hash do request_id** mantém ou descarta a requisição inteira, sem histórias pela metade.' },
      { term: 'Log injection', aliases: ['log forging', 'CWE-117', 'injeção em logs'], definition: 'Ataque em que um texto do usuário com quebras de linha ou caracteres de controle **forja** linhas falsas no log. Serializar o evento como JSON escapa esses caracteres.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Três da manhã, o checkout está falhando e você só tem uma arma: os logs.',
          'Hoje vamos garantir que eles respondam perguntas — em vez de só existirem.',
        ],
        board: {
          title: 'Texto livre × log estruturado',
          md: `**Texto livre** — feito para humanos lerem uma linha por vez:

\`\`\`text
2026-09-28 03:12:07 ERROR Falha no pagamento do pedido 8812 (timeout após 3s) cliente=u-42
\`\`\`

**Estruturado** — o mesmo evento como **dados**, uma linha JSON por evento:

\`\`\`json
{"ts": "2026-09-28T03:12:07Z", "nivel": "ERROR", "logger": "pagamentos", "msg": "falha no pagamento",
 "pedido_id": 8812, "cliente_id": "u-42", "erro": "timeout", "duracao_ms": 3004, "request_id": "req-7f3a"}
\`\`\`

| Pergunta no incidente | Texto livre | Estruturado |
|---|---|---|
| Quantas falhas por timeout na última hora? | regex frágil sobre frases | \`erro = "timeout"\` + contagem |
| Tudo o que aconteceu com o pedido 8812? | \`grep 8812\` (e torcer) | filtro \`pedido_id = 8812\` |
| Qual cliente foi mais afetado? | parse manual | agrupar por \`cliente_id\` |
| Alguém mudou a frase do log… | o parser quebra em silêncio | os campos continuam iguais |

> [!dica] **Mensagem fixa, dados nos campos.** \`"falha no pagamento"\` é sempre igual, então dá para agrupar e contar por mensagem. \`"Falha no pagamento do pedido 8812"\` gera uma mensagem **diferente** para cada pedido.

> [!atencao] Humanos continuam lendo logs. O truque é usar **o mesmo evento com formatadores diferentes**: console colorido e legível no desenvolvimento, JSON em produção.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Níveis de log parecem burocracia, mas são o primeiro filtro de um incidente.',
          'Se tudo é ERROR, nada é ERROR.',
        ],
        board: {
          title: 'Níveis que significam algo',
          md: `| Nível | Quando usar | Em produção | Exemplo |
|---|---|---|---|
| **DEBUG** | detalhe para quem está depurando | desligado (ou ligado por alguns minutos) | "cache miss para a chave X" |
| **INFO** | fatos normais e relevantes do negócio | ligado | "pedido criado", "deploy v42 iniciado" |
| **WARNING** | algo anormal, mas **recuperado** ou degradado | ligado; observe a tendência | "gateway lento; retry 1/3 funcionou" |
| **ERROR** | a operação **falhou**; alguém talvez precise agir | ligado; vira métrica e alerta | "pagamento falhou após 3 tentativas" |
| **CRITICAL** | o serviço inteiro está em risco | ligado; acorda alguém | "pool de conexões do banco esgotado" |

> [!dica] Teste rápido para ERROR: *"um usuário sentiu essa falha?"* Se o sistema se recuperou sozinho, é WARNING. Se cada \`404\` causado pelo cliente vira ERROR, o time aprende a **ignorar** os ERRORs — e perde o que importa.

> [!atencao] **Log-and-rethrow**: logar a exceção e relançá-la em cada camada produz cinco cópias do mesmo stack trace para um único erro. Regra: **ou trate (e logue), ou propague**. Loga-se uma vez, na borda que decide o destino da requisição.

Níveis são ajustáveis **em tempo de execução** e por logger: durante um incidente dá para ligar DEBUG só em \`app.pagamentos\` com \`logging.getLogger("app.pagamentos").setLevel(logging.DEBUG)\` — sem inundar o resto.`,
        },
      },
      {
        type: 'say',
        text: [
          'Uma linha de log sozinha raramente conta a história toda.',
          'O que costura as linhas de vários serviços numa história só é o **contexto** — principalmente o correlation id.',
        ],
        board: {
          title: 'Contexto e correlation id',
          md: `\`\`\`text
 cliente ─► gateway ─► pedidos ─► pagamentos ─► antifraude
            gera       X-Request-ID: req-7f3a (propagado em cada chamada)
            req-7f3a   └─ cada linha de log, em cada serviço, carrega "request_id": "req-7f3a"
\`\`\`

Um filtro \`request_id = "req-7f3a"\` reconstrói a requisição inteira, em ordem, atravessando os quatro serviços.

Em Python, o jeito idiomático de carregar o contexto sem passá-lo por todas as funções é um **\`contextvars.ContextVar\`** (funciona com threads e com \`asyncio\`) somado a um **\`logging.Filter\`** que o injeta em todo record:

\`\`\`python
import contextvars
import logging

request_id = contextvars.ContextVar("request_id", default="-")

class InjetaContexto(logging.Filter):
    def filter(self, record):
        record.request_id = request_id.get()   # todo record ganha o campo
        return True                            # True = não descarta o record

def middleware(requisicao, proximo, gerar_id):
    token = request_id.set(requisicao.headers.get("X-Request-ID") or gerar_id())
    try:
        return proximo(requisicao)
    finally:
        request_id.reset(token)                # não vaza para a próxima requisição
\`\`\`

**Campos que valem ouro:** \`request_id\`/\`trace_id\`, serviço e **versão** (qual deploy?), rota, status, \`duracao_ms\`, id do usuário ou do tenant (pseudonimizado), nome da feature flag ativa.

> [!sabia] **Canonical log lines** (a Stripe popularizou o termo): além dos logs do caminho, emita **uma linha larga por requisição**, no fim, com tudo — rota, status, duração, usuário, número de queries, flags, versão. Uma linha = uma requisição, então quase toda pergunta vira um \`GROUP BY\` sem juntar linhas. A Honeycomb leva a ideia ao extremo com os *wide events*: centenas de campos por evento.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora, o módulo `logging` da stdlib. Ele tem fama de confuso, mas são só quatro peças.',
          'Entendendo o caminho de um record, tudo o mais se encaixa.',
        ],
        board: {
          title: 'O módulo logging por dentro',
          md: `\`\`\`text
log.info("pedido %s criado", 42, extra={...})
  │ 1. nível do logger permite?          (senão, nem cria o record: custo ~zero)
  ▼
LogRecord (msg, args, levelname, name, exc_info + os campos de extra)
  │ 2. filtros do logger
  ▼
handlers do logger e dos ancestrais      ("app.pagamentos" → "app" → root, se propagate)
  │ 3. nível e filtros de cada handler
  ▼
Formatter.format(record) ──► emit: stdout, arquivo, fila, rede
\`\`\`

| Peça | Papel |
|---|---|
| **Logger** | ponto de entrada; nome hierárquico (\`getLogger(__name__)\`) e nível |
| **Handler** | destino: \`StreamHandler\` (stdout), \`FileHandler\`, \`QueueHandler\` (não bloqueia a requisição) |
| **Formatter** | transforma o record em texto — ou em JSON |
| **Filter** | descarta records ou os **enriquece** (como o \`InjetaContexto\`) |
| **LoggerAdapter** | embrulha um logger e injeta um contexto fixo em toda chamada |

\`\`\`python
log = logging.getLogger(__name__)

log.info("pedido %s criado", pedido_id)    # ✅ preguiçoso: só formata se o nível passar
log.info(f"pedido {pedido_id} criado")     # ❌ formata sempre e cria uma mensagem única por pedido

try:
    cobrar(pedido)
except GatewayTimeout:
    log.exception("falha na cobrança")     # nível ERROR + traceback; aqui é a borda:
    return resposta(503)                   # trata e responde, sem relançar
\`\`\`

> [!atencao] **Bibliotecas não configuram logging.** Elas só fazem \`getLogger(__name__)\` (no máximo um \`NullHandler\`). Handlers, níveis e formato são decisão da **aplicação**, uma vez, na inicialização — por exemplo com \`logging.config.dictConfig\`.

> [!atencao] Duas pegadinhas do \`extra\`: \`extra={"msg": ...}\` estoura \`KeyError\` (não dá para sobrescrever atributos do LogRecord) — por isso é comum aninhar tudo numa chave só, como \`extra={"ctx": {...}}\`. E o \`LoggerAdapter\` padrão **substitui** o \`extra\` da chamada pelo dele, em vez de juntar (o \`merge_extra=True\` só chegou no 3.13). Vamos escrever o nosso adapter.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a parte que dá manchete: log é um dos lugares onde **mais** vaza senha, token e dado pessoal.',
          'E log costuma ser lido por muito mais gente — e guardado por muito mais tempo — do que o banco de produção.',
        ],
        board: {
          title: 'Segredos e PII: o que nunca vai para o log',
          md: `**Nunca em claro:** senhas, tokens e API keys, o header \`Authorization\`, cookies de sessão, número de cartão (PCI DSS proíbe), CPF, e-mail, telefone, endereço (**PII**, protegidos pela LGPD) e o **corpo inteiro** da requisição ("vou logar tudo, depois eu filtro").

| Técnica | Como fica | Quando |
|---|---|---|
| **Não logar** (allowlist) | só entram campos declarados | a melhor defesa |
| **Redigir** | \`"senha": "***"\` | segredos que escaparam para o contexto |
| **Mascarar parcialmente** | \`"cartao": "**** 1111"\` | quando o suporte precisa reconhecer o dado |
| **Pseudonimizar** | \`"cliente": "hmac:9f2c…"\` | correlacionar o mesmo usuário sem expô-lo |
| **Redigir no coletor** | regra no pipeline de logs | segunda camada, para o que escapar do código |

\`\`\`python
SENSIVEIS = {"senha", "password", "token", "authorization", "cpf", "cartao"}

def redigir(dados):
    if isinstance(dados, dict):
        return {k: "***" if str(k).lower() in SENSIVEIS else redigir(v) for k, v in dados.items()}
    if isinstance(dados, list):
        return [redigir(item) for item in dados]
    return dados
\`\`\`

> [!atencao] Uma **denylist** como essa sempre esquece o campo novo (\`senha_nova\`, \`x-api-key\`, \`refresh_token\`). **Allowlist** — só loga o que foi declarado — é mais segura. Na prática, combine as duas.

> [!sabia] **Log injection** (CWE-117): se você loga texto do usuário numa linha livre, um nome como \`ana\\n2026-09-28 INFO admin autenticado\` **forja uma linha inteira** no log — e engana a auditoria. Com JSON bem serializado, a quebra de linha vira \`\\n\` dentro de uma string, e o ataque vira só um campo esquisito. O Log4Shell (2021) foi o parente famoso: o logger **interpretava** o texto logado.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Último ponto: logs custam **caro**. Às vezes mais que os próprios servidores.',
          'A resposta não é logar menos no escuro — é amostrar com critério.',
        ],
        board: {
          title: 'Amostragem e custo',
          md: `2.000 req/s × 20 linhas por requisição × 500 bytes = **20 MB/s ≈ 1,7 TB por dia** — antes de réplicas e retenção.

| Estratégia | Como | Cuidado |
|---|---|---|
| Nível por ambiente | DEBUG desligado em produção | ligue por logger, e só durante a investigação |
| **Amostragem por requisição** | decide pelo hash do \`request_id\`: fica 1% das **requisições**, com todas as linhas | amostrar 1% das **linhas** ao acaso produz histórias pela metade |
| Sempre manter problemas | WARNING e acima nunca são amostrados | o raro é justamente o que você procura |
| *Tail sampling* | decide **no fim**: requisição lenta ou com erro fica inteira | exige guardar o buffer até o fim |
| Dedup / rate limit | a mesma mensagem 10.000×/s vira "suprimidas: 9.990" | registre o que foi suprimido |
| Métrica em vez de log | contar eventos é trabalho de um **counter** | assunto do próximo módulo |

\`\`\`python
import zlib

def manter(evento, taxa=0.01):
    if evento["nivel"] in ("WARNING", "ERROR", "CRITICAL"):
        return True                                       # problemas: sempre
    balde = zlib.crc32(evento["request_id"].encode()) % 10_000
    return balde < taxa * 10_000                          # mesmo request_id → mesma decisão
\`\`\`

> [!atencao] Não use \`hash()\` para isso: o hash de \`str\` em Python é **aleatorizado por processo** (\`PYTHONHASHSEED\`), então cada réplica decidiria diferente para a mesma requisição. Use um hash estável, como \`zlib.crc32\` ou \`hashlib\`.

> [!dica] Grave a taxa no próprio evento (\`"amostragem": 0.01\`). Assim, quem contar linhas depois sabe que cada uma representa **100** requisições.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Níveis, contexto, o caminho de um record e um logger estruturado com redação.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'obs-log-q1',
        concept: 'Níveis de log',
        say: 'Primeira: escolher o nível certo.',
        prompt: 'O serviço de pedidos chama o gateway de pagamento, recebe **timeout** na primeira tentativa, faz retry e a **segunda tentativa funciona**. O cliente não percebeu nada. Qual nível para o log da primeira falha?',
        options: [
          { text: '`WARNING` — algo anormal aconteceu, mas o sistema se recuperou sozinho', correct: true, why: 'É o caso típico de WARNING: não houve falha para o usuário, mas é um sinal de degradação que vale acompanhar. Muitos WARNINGs seguidos são o aviso de que o próximo passo é ERROR.' },
          { text: '`ERROR` — um timeout é sempre um erro', why: 'Nada falhou do ponto de vista do usuário. Marcar recuperações como ERROR enche o painel de falsos problemas, e o time aprende a ignorar os ERRORs — inclusive os reais.' },
          { text: '`INFO` — deu certo no fim, então é um evento normal', why: 'Retry não é o caminho feliz. Como INFO, esse sinal se perde no meio de milhões de "pedido criado", e você só descobre que o gateway estava degradando quando ele cai de vez.' },
          { text: '`DEBUG` — é detalhe interno do retry', why: 'DEBUG fica desligado em produção: você perderia exatamente o sinal que antecede o incidente.' },
        ],
        explanation: 'Níveis são um **contrato** com quem opera o sistema: ERROR significa "uma operação falhou e alguém talvez precise agir"; WARNING, "algo saiu do normal, mas foi contornado". Melhor ainda: além do log, conte os retries numa **métrica** — um aumento na taxa de retries é um ótimo alerta precoce.',
      },
      {
        type: 'match',
        id: 'obs-log-q2',
        concept: 'Contexto e correlação',
        say: 'Jogo rápido: cada dor de plantão tem sua técnica.',
        prompt: 'Associe cada **problema** à técnica de logging que o resolve.',
        pairs: [
          { left: 'Não dá para juntar as linhas de uma requisição que passou por 4 serviços', right: 'Correlation id propagado em header' },
          { left: 'Cada dev escreve `user=42`, `usuario: 42` ou `uid 42`, e o grep nunca acha tudo', right: 'Log estruturado (JSON) com campos fixos' },
          { left: 'Um token de acesso apareceu na ferramenta de busca de logs', right: 'Redação de campos sensíveis' },
          { left: 'A fatura do provedor de logs dobrou por causa de linhas de rotina', right: 'Amostragem por requisição' },
          { left: 'Repetir `extra={"tenant": ...}` em toda chamada de log', right: '`LoggerAdapter` ou `Filter` com contexto' },
        ],
        explanation: 'Cada técnica ataca uma dor diferente: **correlação** costura serviços, **estrutura** padroniza campos, **redação** protege dados, **amostragem** controla custo e **adapters/filtros** eliminam a repetição (e o esquecimento) do contexto.',
      },
      {
        type: 'order',
        id: 'obs-log-q3',
        concept: 'Pipeline do logging',
        say: 'Agora, por dentro do `logging`: o caminho de uma chamada até virar texto.',
        prompt: 'Ordene o que acontece, no módulo `logging` do Python, desde `log.info("pedido criado")` até a linha aparecer no stdout.',
        items: [
          'O logger compara o nível INFO com o seu nível efetivo',
          'Um `LogRecord` é criado, com os campos de `extra`',
          'Os filtros do logger podem descartar ou enriquecer o record',
          'O record segue para os handlers do logger e dos ancestrais (propagação)',
          'Cada handler checa o próprio nível e os próprios filtros',
          'O `Formatter` do handler transforma o record em texto',
          'O handler escreve o texto no stream',
        ],
        explanation: 'O nível do logger é checado **antes** de criar o record — por isso `log.debug("x=%s", x)` desligado custa quase nada, enquanto `log.debug(f"x={x}")` formata a string à toa. Filtros de logger atuam só naquele logger; filtros de **handler** valem para tudo o que chega ao destino (bom lugar para redação ou para injetar contexto). E a formatação acontece por último, dentro do `emit` de cada handler — o mesmo record pode virar texto colorido no console e JSON no arquivo.',
      },
      {
        type: 'code',
        id: 'obs-log-q4',
        concept: 'Log estruturado com contexto',
        title: 'Logger estruturado com contexto e redação',
        say: 'Hora de construir o logger que você gostaria de ter às 3h da manhã. Relógio injetado, nada de tempo real.',
        prompt: `Complete as quatro peças, usando o \`logging\` de verdade:

1. \`redigir(dados)\` → **cópia** de \`dados\` em que o valor de toda chave presente em \`SENSIVEIS\` vira \`MASCARA\`. Compare as chaves **sem diferenciar maiúsculas**, desça em **dicts e listas** aninhados e **não altere** o original.
2. \`FormatadorJson.format(record)\` → **uma linha** JSON (use \`json.dumps\`) com:
   - \`ts\`: \`self.relogio()\`, chamado **a cada evento**; \`nivel\`: \`record.levelname\`; \`logger\`: \`record.name\`; \`msg\`: \`record.getMessage()\` (aplica os argumentos \`%s\`);
   - os campos de \`record.ctx\` (quando existir), **redigidos** — mas eles **não** podem sobrescrever os quatro campos acima;
   - \`exc\` com \`self.formatException(record.exc_info)\` quando houver \`record.exc_info\`;
   - valores não serializáveis viram texto (\`default=str\`): um log nunca pode derrubar a aplicação.
3. \`ContextoAdapter.process(msg, kwargs)\` → junta o contexto fixo \`self.extra\` com o \`extra\` da chamada (que **vence** em conflito) e devolve \`msg, kwargs\` com \`kwargs["extra"] = {"ctx": contexto}\`.
4. \`ContextoAdapter.vincular(**mais)\` → **novo** adapter com o mesmo logger e o contexto acrescido de \`mais\`; o original não muda.

Uso esperado:

\`\`\`python
log = ContextoAdapter(logger, {"request_id": "req-7"})
log.vincular(usuario="u-9").info("login de %s", "ana", extra={"senha": "hunter2"})
# {"request_id": "req-7", "usuario": "u-9", "senha": "***", "ts": "...", "nivel": "INFO", "logger": "checkout", "msg": "login de ana"}
\`\`\``,
        starter: `import json
import logging

SENSIVEIS = {"senha", "password", "token", "authorization", "cpf", "cartao"}
MASCARA = "***"


def redigir(dados):
    """Cópia de dados com o valor de toda chave sensível trocado por MASCARA."""
    pass


class FormatadorJson(logging.Formatter):
    """Transforma cada LogRecord em UMA linha JSON."""

    def __init__(self, relogio):
        super().__init__()
        self.relogio = relogio

    def format(self, record):
        pass


class ContextoAdapter(logging.LoggerAdapter):
    """Logger com contexto fixo (self.extra) somado ao extra de cada chamada."""

    def process(self, msg, kwargs):
        pass

    def vincular(self, **mais):
        pass
`,
        tests: [
          { name: 'redigir troca só as chaves sensíveis', expr: 'redigir({"usuario": "ana", "senha": "hunter2"})', expected: '{"usuario": "ana", "senha": "***"}' },
          {
            name: 'redigir ignora maiúsculas e desce em dicts e listas',
            expr: 'redigir({"Authorization": "Bearer x", "itens": [{"cartao": "4111"}, {"sku": "A1"}], "cliente": {"CPF": "123", "nome": "Ana"}})',
            expected: '{"Authorization": "***", "itens": [{"cartao": "***"}, {"sku": "A1"}], "cliente": {"CPF": "***", "nome": "Ana"}}',
          },
          {
            name: 'redigir não altera o original',
            code: `dados = {"token": "abc", "extra": {"senha": "x"}, "lista": [{"cpf": "1"}]}
redigir(dados)
assert dados == {"token": "abc", "extra": {"senha": "x"}, "lista": [{"cpf": "1"}]}, f"o original foi alterado: {dados}"`,
          },
          {
            name: 'uma linha JSON por evento, com ts, nivel, logger e msg',
            setup: PRELUDIO,
            code: `logger, saida = montar()
logger.info("pedido %s criado", 42)
logger.warning("estoque baixo")
logger.debug("não deveria aparecer")
ls = linhas(saida)
assert len(ls) == 2, f"esperava 2 linhas (DEBUG está abaixo do nível), vieram {len(ls)}"
assert ls[0] == {"ts": "2026-09-28T12:00:00Z", "nivel": "INFO", "logger": "checkout", "msg": "pedido 42 criado"}, ls[0]
assert ls[1]["nivel"] == "WARNING" and ls[1]["msg"] == "estoque baixo", ls[1]`,
          },
          {
            name: 'o adapter junta o contexto fixo com o extra da chamada',
            setup: PRELUDIO,
            code: `logger, saida = montar()
log = ContextoAdapter(logger, {"request_id": "req-7"})
log.info("pagamento aprovado", extra={"valor": 99.9})
log.info("sem extra")
ls = linhas(saida)
assert ls[0]["request_id"] == "req-7" and ls[0]["valor"] == 99.9, ls[0]
assert ls[1]["request_id"] == "req-7", f"o contexto fixo deve ir também em chamadas sem extra: {ls[1]}"`,
          },
          {
            name: 'campos sensíveis do contexto saem redigidos',
            setup: PRELUDIO,
            code: `logger, saida = montar()
ContextoAdapter(logger, {"token": "tk-123"}).info("login", extra={"usuario": "ana", "senha": "hunter2"})
texto = saida.getvalue()
assert "hunter2" not in texto and "tk-123" not in texto, f"segredo vazou: {texto}"
l = linhas(saida)[0]
assert l["senha"] == "***" and l["token"] == "***" and l["usuario"] == "ana", l`,
          },
          {
            name: 'vincular cria um logger filho sem mexer no pai',
            setup: PRELUDIO,
            code: `logger, saida = montar()
pai = ContextoAdapter(logger, {"request_id": "r1"})
filho = pai.vincular(usuario="u-9")
filho.info("a")
pai.info("b")
ls = linhas(saida)
assert ls[0]["usuario"] == "u-9" and ls[0]["request_id"] == "r1", ls[0]
assert "usuario" not in ls[1], f"o pai não deveria ganhar o contexto do filho: {ls[1]}"
assert pai.extra == {"request_id": "r1"}, pai.extra`,
          },
          {
            name: 'o relógio injetado é consultado a cada evento',
            hidden: true,
            setup: PRELUDIO,
            code: `logger, saida = montar(relogio=iter(["t1", "t2", "t3"]).__next__)
logger.info("a")
logger.info("b")
assert [l["ts"] for l in linhas(saida)] == ["t1", "t2"]`,
          },
          {
            name: 'log.exception inclui o traceback em exc',
            hidden: true,
            setup: PRELUDIO,
            code: `logger, saida = montar()
try:
    1 / 0
except ZeroDivisionError:
    ContextoAdapter(logger, {"request_id": "r1"}).exception("falhou")
l = linhas(saida)[0]
assert l["nivel"] == "ERROR" and "ZeroDivisionError" in l.get("exc", ""), l`,
          },
          {
            name: 'o contexto não sobrescreve campos base; o extra da chamada vence o fixo',
            hidden: true,
            setup: PRELUDIO,
            code: `logger, saida = montar()
ContextoAdapter(logger, {"etapa": "a"}).info("real", extra={"msg": "forjada", "nivel": "DEBUG", "etapa": "b"})
l = linhas(saida)[0]
assert l["msg"] == "real" and l["nivel"] == "INFO", l
assert l["etapa"] == "b", l`,
          },
          {
            name: 'valores não serializáveis viram texto',
            hidden: true,
            setup: PRELUDIO,
            code: `from decimal import Decimal
logger, saida = montar()
ContextoAdapter(logger, {}).info("cobrança", extra={"valor": Decimal("10.50")})
assert linhas(saida)[0]["valor"] == "10.50"`,
          },
          {
            name: 'quebra de linha na mensagem não forja outra linha',
            hidden: true,
            setup: PRELUDIO,
            code: `logger, saida = montar()
logger.info("usuario ana\\nINFO admin autenticado")
ls = linhas(saida)
assert len(ls) == 1 and ls[0]["msg"] == "usuario ana\\nINFO admin autenticado", ls`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('dumps'),
            text: 'Monte a linha com `json.dumps`, não concatenando strings ou f-strings. Montar JSON à mão quebra com aspas e quebras de linha no conteúdo — e é assim que nasce o *log injection* (CWE-117).',
            concept: 'Log injection',
          },
          {
            when: (m, code) => /record\.msg\b/.test(code),
            text: '`record.msg` é o **template** sem os argumentos (`"pedido %s criado"`). Use `record.getMessage()`, que aplica os `args` — é ele que permite a formatação preguiçosa do `logging`.',
            concept: 'Formatação preguiçosa',
          },
          {
            when: m => m.calls.includes('print'),
            text: 'Nada de `print` num logger: ele ignora níveis, handlers e formatadores. Quem decide o destino é o handler; o formatter só devolve o texto.',
            concept: 'Handlers e formatters',
          },
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'Não leia o relógio de verdade dentro do formatter: `self.relogio` é injetado para que os testes sejam determinísticos (e para trocar a fonte de tempo sem mexer no formatter).',
            concept: 'Relógio injetado',
          },
        ],
        hints: [
          'Em `redigir`: se for `dict`, devolva um **novo** dict com `MASCARA` quando `str(chave).lower() in SENSIVEIS` e `redigir(valor)` nos demais; se for `list`, `[redigir(x) for x in dados]`; senão, devolva o próprio valor.',
          'Em `format`: comece com `evento = redigir(getattr(record, "ctx", {}))` e **depois** faça `evento.update({...})` com `ts`, `nivel`, `logger` e `msg` — assim os campos base vencem. Termine com `json.dumps(evento, ensure_ascii=False, default=str)`.',
          'Em `process`: `ctx = {**self.extra, **kwargs.get("extra", {})}`, depois `kwargs["extra"] = {"ctx": ctx}` e `return msg, kwargs`. Em `vincular`: `return ContextoAdapter(self.logger, {**self.extra, **mais})`.',
        ],
        solution: `import json
import logging

SENSIVEIS = {"senha", "password", "token", "authorization", "cpf", "cartao"}
MASCARA = "***"


def redigir(dados):
    """Cópia de dados com o valor de toda chave sensível trocado por MASCARA."""
    if isinstance(dados, dict):
        return {
            chave: MASCARA if str(chave).lower() in SENSIVEIS else redigir(valor)
            for chave, valor in dados.items()
        }
    if isinstance(dados, list):
        return [redigir(item) for item in dados]
    return dados


class FormatadorJson(logging.Formatter):
    """Transforma cada LogRecord em UMA linha JSON."""

    def __init__(self, relogio):
        super().__init__()
        self.relogio = relogio

    def format(self, record):
        evento = redigir(getattr(record, "ctx", {}))    # cópia: não mexe no record
        evento.update({                                 # campos base por último: vencem o contexto
            "ts": self.relogio(),
            "nivel": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        })
        if record.exc_info:
            evento["exc"] = self.formatException(record.exc_info)
        return json.dumps(evento, ensure_ascii=False, default=str)


class ContextoAdapter(logging.LoggerAdapter):
    """Logger com contexto fixo (self.extra) somado ao extra de cada chamada."""

    def process(self, msg, kwargs):
        ctx = {**self.extra, **kwargs.get("extra", {})}
        kwargs["extra"] = {"ctx": ctx}
        return msg, kwargs

    def vincular(self, **mais):
        """Novo adapter com o contexto atual + mais; o original não muda."""
        return ContextoAdapter(self.logger, {**self.extra, **mais})
`,
        solutionExplanation: 'O desenho separa responsabilidades como o próprio `logging` faz. O **adapter** só junta contexto (fixo + da chamada) e o entrega aninhado em `extra={"ctx": ...}` — aninhar evita o `KeyError` de chaves como `msg` colidindo com atributos do `LogRecord`. O **formatter** só transforma o record em uma linha: redige **antes** de serializar (o segredo nunca vira texto), aplica os campos base **por último** (o contexto não consegue forjar `nivel` ou `msg`), usa `getMessage()` para respeitar a formatação preguiçosa e `default=str` para que um `Decimal` ou `datetime` não derrube a requisição. O `json.dumps` escapa a quebra de linha, então uma mensagem maliciosa não forja uma segunda linha. E `vincular` devolve um **novo** adapter — o mesmo padrão *bind* do `structlog`: o handler de uma requisição faz `log = log.vincular(request_id=...)` uma vez, e todo o resto herda o contexto. Na vida real, a redação por denylist seria complementada por uma allowlist de campos e por uma segunda camada no coletor de logs.',
      },
      {
        type: 'open',
        id: 'obs-log-q5',
        concept: 'Log estruturado',
        say: 'Para fechar: um código de verdade, desses que a gente herda.',
        prompt: 'Você entrou num time cujo serviço loga assim: `print(f"erro no pedido {id}: {e} user={email} auth={token}")`. Os incidentes levam horas para diagnosticar e a fatura do provedor de logs dobrou. Que mudanças você proporia, e por quê?',
        rubric: [
          { label: 'Logs estruturados com campos fixos (e o módulo logging)', keywords: ['estruturad', 'json', 'campos', 'chave-valor', 'chave valor', 'key-value', 'structured', 'logging', 'getlogger'], concept: 'Log estruturado', why: 'Com campos nomeados, dá para filtrar e agregar sem regex; com o `logging`, ganham-se níveis, handlers e formatadores.' },
          { label: 'Correlation id em todas as linhas', keywords: ['correlation', 'correlacao', 'request_id', 'request id', 'requestid', 'trace_id', 'trace id', 'traceid', 'x-request-id', 'id da requisicao', 'id de requisicao'], concept: 'Correlation ID', why: 'É o que permite juntar as linhas de uma requisição entre serviços — o maior acelerador de diagnóstico.' },
          { label: 'Tirar segredos e PII do log (redação)', keywords: ['redig', 'redac', 'redact', 'mascar', 'pii', 'lgpd', 'dado pessoal', 'dados pessoais', 'segredo', 'sensive', 'vazamento', 'vazar', 'pseudonim', 'anonimiz', ['remov', 'token'], ['nao', 'logar']], concept: 'Redação de dados', why: 'Token e e-mail em claro são incidente de segurança e de LGPD; quem lê o log não deveria conseguir se autenticar como o usuário.' },
          { label: 'Controlar volume: níveis e amostragem', keywords: ['amostr', 'sampl', 'nivel', 'niveis', 'debug', 'warning', 'volume', 'retencao', 'custo'], concept: 'Amostragem de logs', why: 'Níveis corretos e amostragem por requisição (mantendo todos os erros) cortam o custo sem perder o que importa.' },
        ],
        minWords: 40,
        modelAnswer: 'Primeiro, trocar o `print` pelo módulo **logging** com um formatter **JSON**: mensagem fixa ("falha no pedido") e os dados em **campos** (`pedido_id`, `erro`, `duracao_ms`), para filtrar e agrupar sem regex. Segundo, colocar um **correlation id** (`request_id`, ou o `trace_id`) em todas as linhas, recebido no header `X-Request-ID` e propagado para os outros serviços — com um `LoggerAdapter` ou um `Filter` com `contextvars`, para ninguém esquecer. Terceiro, **tirar o token e o e-mail** do log: o token nunca deveria ser logado, e o e-mail é **PII** protegida pela LGPD; eu faria **redação** no formatter (senha, token, authorization → `***`), uma allowlist de campos e **pseudonimizaria** o usuário com um id ou HMAC. Por fim, o custo: usar **níveis** direito (DEBUG desligado em produção, ERROR só quando algo falhou de fato) e **amostrar** os logs de rotina por requisição, mantendo sempre WARNING e ERROR — e contar eventos com métricas em vez de linhas de log.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Seus logs agora contam histórias: estruturados, correlacionados, sem segredos e com custo sob controle.',
          { text: 'Próxima parada: métricas — o sinal barato que acorda você antes do cliente reclamar.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
