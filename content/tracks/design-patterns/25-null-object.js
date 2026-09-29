(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const BASE = py(`
    class LoggerMemoria:
        """Logger de verdade: guarda as linhas em memória."""

        def __init__(self):
            self.linhas = []

        def __len__(self):
            return len(self.linhas)

        def info(self, msg):
            self.linhas.append(msg)


    class CupomPercentual:
        def __init__(self, codigo, percentual):
            self.codigo = codigo
            self.percentual = percentual

        def aplicar(self, valor):
            return round(valor * (100 - self.percentual) / 100, 2)

        def descricao(self):
            return f"{self.codigo} (-{self.percentual}%)"
  `);

  Game.registerModule('design-patterns', {
    id: 'null-object',
    title: 'Null Object',
    kind: 'lesson',
    level: 1,
    order: 40,
    unit: 'pythonicos',
    summary: 'Troque o `if x is None` espalhado por um objeto que sabe não fazer nada — e aprenda quando isso esconde bugs.',
    concepts: ['Null Object', 'Special Case', 'None × Optional × exceção', 'Polimorfismo'],
    takeaways: [
      'O **Null Object** implementa o mesmo contrato do objeto real com comportamento **neutro**, eliminando os `if x is None` espalhados.',
      'A ausência é convertida **uma vez, na borda** (construtor ou entrada) — com `is None`, nunca com `x or Padrao()`, que descarta objetos *falsy*.',
      'Comportamento neutro óbvio → Null Object; o chamador precisa decidir → `None` tipado (`X | None`); ausência é erro → **exceção** (*fail fast*).',
      'Nunca finja sucesso no que importa: um Null Object que "aprova" pagamentos ou inventa dados transforma um erro barulhento num bug silencioso.',
      'A stdlib já tem Null Objects prontos: `logging.NullHandler` e `contextlib.nullcontext`.',
    ],
    glossary: [
      { term: 'Null Object', aliases: ['objeto nulo', 'objetos nulos', 'Null Objects', 'NullObject'], definition: 'Objeto com a mesma interface de um colaborador real, mas com comportamento **neutro** (não faz nada, devolve valores inofensivos). Elimina checagens de `None` no código cliente.' },
      { term: 'Special Case', aliases: ['caso especial', 'Special Case pattern'], definition: 'Generalização do Null Object descrita por Martin Fowler: um objeto para um caso particular (ex.: `ClienteAnonimo`) que devolve valores sensatos em vez de `None`.' },
      { term: 'Fail fast', aliases: ['falhar cedo', 'falha rápida', 'falha rapida'], definition: 'Princípio de sinalizar um erro o mais cedo e alto possível (ex.: exceção na inicialização) em vez de seguir com um estado inválido que quebra longe da causa.' },
      { term: 'nullcontext', aliases: ['contextlib.nullcontext'], definition: 'Context manager da stdlib (`contextlib`) que não faz nada. Permite usar `with` quando o recurso é opcional, sem duplicar o bloco num `if/else`.' },
      { term: 'Elemento neutro', aliases: ['elemento identidade', 'elementos neutros'], definition: 'Valor que não altera o resultado de uma operação: 0 na soma, 1 na multiplicação, `""` na concatenação. O Null Object é a versão orientada a objetos dessa ideia.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje vamos ver um padrão pequeno que limpa **muito** código: o **Null Object**.',
          'Sabe aquele `if x is not None` que aparece em todo canto? Vamos aposentá-lo.',
        ],
        board: {
          title: 'O problema: checagens de None espalhadas',
          code: `class ServicoPedidos:
    def __init__(self, logger=None, notificador=None):
        self.logger = logger              # opcional
        self.notificador = notificador    # opcional

    def fechar(self, pedido):
        if self.logger is not None:
            self.logger.info(f"fechando {pedido.id}")
        total = pedido.total()
        if pedido.cupom is not None:
            total = pedido.cupom.aplicar(total)
        if self.notificador is not None:
            self.notificador.enviar(pedido.cliente, "pedido fechado")
        if self.logger is not None:
            self.logger.info(f"total {total:.2f}")
        return total`,
          caption: 'Quatro `if` só para lidar com ausências. Esqueça um deles e o `AttributeError: NoneType object has no attribute...` aparece em produção.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A ideia: em vez de **não ter** um objeto, você tem um objeto que **não faz nada** — com a mesma interface do real.',
          'O código cliente para de perguntar "você existe?" e simplesmente chama o método.',
        ],
        board: {
          title: 'Null Object: mesmo contrato, comportamento neutro',
          md: `\`\`\`text
             «contrato» Logger
                info(msg)
              /           \\
     LoggerArquivo       NullLogger
     (escreve)           (não faz nada)
\`\`\`

\`\`\`python
class NullLogger:
    """Mesmo contrato do logger real; ignora tudo de propósito."""
    def info(self, msg):
        pass


class ServicoPedidos:
    def __init__(self, logger=None):
        # a ÚNICA checagem fica na borda, na construção
        self.logger = NullLogger() if logger is None else logger

    def fechar(self, pedido):
        self.logger.info(f"fechando {pedido.id}")   # sem if!
        ...
\`\`\`

> [!dica] É polimorfismo puro — *tell, don't ask*: o cliente manda fazer, e cada objeto decide como (inclusive "não fazer nada").`,
        },
      },
      {
        type: 'say',
        text: [
          '"Não fazer nada" depende do contrato: um desconto neutro devolve o valor intacto; um cliente anônimo tem nome "visitante" e zero pontos.',
          'Quando o "nulo" tem dados e regras próprias, o Martin Fowler chama de **Special Case**.',
        ],
        board: {
          title: 'Comportamento neutro e Special Case',
          md: `| Objeto real | Null Object / Special Case | Comportamento neutro |
|---|---|---|
| \`Logger\` | \`NullLogger\` | ignora as mensagens |
| \`Cupom\` | \`SemCupom\` | \`aplicar(total)\` devolve \`total\` |
| \`Notificador\` | \`NotificadorNulo\` | não envia nada |
| \`Cliente\` | \`ClienteAnonimo\` | nome "visitante", desconto 0, sem crédito |
| callback | \`lambda *args: None\` | não reage |

\`\`\`python
class ClienteAnonimo:                  # Special Case
    nome = "visitante"
    pontos = 0

    def desconto(self):
        return 0

    def pode_comprar_a_prazo(self):
        return False


CLIENTE_ANONIMO = ClienteAnonimo()    # sem estado: uma instância basta


def cliente_da_sessao(sessao, clientes):
    return clientes.get(sessao.get("cliente_id"), CLIENTE_ANONIMO)
\`\`\`

> [!dica] Lembra da estratégia \`sem_desconto\` da aula de Strategy? Ela já era um Null Object: o desconto que não desconta nada.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'A biblioteca padrão do Python tem Null Objects prontos — e pouca gente repara.',
          'O `logging.NullHandler` e o `contextlib.nullcontext` existem exatamente para poupar `if`s.',
        ],
        board: {
          title: 'Null Objects na stdlib',
          md: `\`\`\`python
import logging
from contextlib import nullcontext

# 1) Numa BIBLIOTECA: não imponha configuração de log a quem usa
logging.getLogger("minha_lib").addHandler(logging.NullHandler())

# 2) Context manager opcional, sem duplicar o bloco em if/else
def processar(itens, trava=None):
    with trava if trava is not None else nullcontext():
        return sum(itens)

# 3) Elementos neutros: o "nada" que não altera o resultado
sum([])                 # 0
"".join([])             # ''
max([], default=0)      # 0
\`\`\`

> [!sabia] O Null Object **não está** no livro do GoF: foi descrito por Bobby Woolf nos anos 1990, na série *Pattern Languages of Program Design*. Martin Fowler o generalizou como **Special Case**, e a refatoração *Introduce Null Object* virou *Introduce Special Case* na 2ª edição do *Refactoring*. No fundo, é a versão OO do **elemento neutro** da matemática: 0 na soma, 1 na multiplicação, \`""\` na concatenação.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Mas atenção: Null Object não é a resposta para **toda** ausência.',
          'A pergunta certa é: o que a ausência **significa** para quem chama?',
        ],
        board: {
          title: 'Null Object × None × exceção',
          md: `| A ausência… | Use | Exemplo |
|---|---|---|
| tem um comportamento neutro óbvio | **Null Object** | logger, métricas, notificação opcional, desconto |
| é informação que o chamador precisa tratar | **\`None\`** com tipo \`Optional\` | \`buscar_usuario(id)\` → a rota responde 404 |
| é um erro que impede seguir | **exceção** (*fail fast*) | \`DATABASE_URL\` ausente ao subir o serviço |

\`\`\`python
def buscar_usuario(uid: int) -> Usuario | None:    # o type checker obriga a tratar
    ...

def carregar_config(env: dict) -> Config:
    if "DATABASE_URL" not in env:
        raise ConfigAusente("DATABASE_URL")           # falha alto e cedo
    ...
\`\`\`

> [!dica] \`Usuario | None\` (ou \`Optional[Usuario]\`) documenta a ausência na assinatura. Com \`mypy\`/\`pyright\`, esquecer o \`if\` vira erro de análise — e não bug em produção.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o lado sombrio: um Null Object mal usado **esconde erros**.',
          'Se a ausência é um bug, fingir que está tudo bem só adia a explosão — e ela acontece longe da causa.',
        ],
        board: {
          title: '⚠️ Quando o Null Object vira problema',
          md: `- **Fingir sucesso no que importa**: um \`GatewayNulo\` que "aprova" pagamentos quando a configuração falta = pedidos enviados sem cobrança. Aqui o certo é *fail fast*.
- **Null Object que mente**: \`ClienteNulo.email = "nao-informado@loja.com"\` faz o sistema mandar e-mails para um endereço inventado.
- **Perguntar o tipo**: \`if isinstance(logger, NullLogger)\` espalhado traz os \`if\`s de volta — a abstração vazou.
- **\`x or Padrao()\`** troca **qualquer** objeto *falsy* pelo padrão, em silêncio:

\`\`\`python
class LoggerMemoria:
    def __init__(self):
        self.linhas = []
    def __len__(self):                 # vazio → len 0 → FALSY!
        return len(self.linhas)
    def info(self, msg):
        self.linhas.append(msg)

log = LoggerMemoria()
servico = ServicoPedidos(log or NullLogger())   # recebeu o NullLogger...
# ...e nenhuma linha é registrada. Nenhum erro, nenhum aviso.
\`\`\`

> [!atencao] Na borda, use \`NullLogger() if logger is None else logger\`. E lembre: Null Object não verifica nada — em testes que precisam conferir chamadas, use um *spy* ou um *fake*.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Reconhecer, escolher e refatorar com Null Objects.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'dp-nul-q1',
        concept: 'Null Object',
        say: 'Primeira: olha esse trecho. Que refatoração você faria?',
        prompt: `A auditoria e as métricas abaixo são **opcionais**: quando ausentes, simplesmente não devem fazer nada. Já o \`gateway\` é obrigatório.

\`\`\`python
def cobrar(pedido, gateway, auditoria=None, metricas=None):
    if auditoria is not None:
        auditoria.registrar("cobranca_iniciada", pedido.id)
    resultado = gateway.cobrar(pedido.total)
    if metricas is not None:
        metricas.incrementar("cobrancas")
    if auditoria is not None:
        auditoria.registrar("cobranca_concluida", pedido.id)
    return resultado
\`\`\`

Qual é a melhor refatoração?`,
        options: [
          { text: 'Criar `AuditoriaNula` e `MetricasNulas`, com os mesmos métodos e sem efeito, e usá-las quando nada for passado.', correct: true, why: 'A função passa a chamar `auditoria.registrar(...)` e `metricas.incrementar(...)` sem perguntar nada; a ausência vira um objeto neutro, decidido uma vez só, na borda.' },
          { text: 'Envolver cada chamada em `try/except AttributeError` e ignorar o erro.', why: 'Isso engole **qualquer** `AttributeError` — inclusive bugs reais dentro de `registrar` — e usa exceção como controle de fluxo. Esconde erros em vez de modelar a ausência.' },
          { text: 'Transformar auditoria e métricas em Singletons globais, sempre disponíveis.', why: 'Estado global não modela a ausência: quem não quer auditoria passa a tê-la à força, e os testes ficam acoplados ao Singleton.' },
          { text: 'Trocar `if auditoria is not None` por `if auditoria:`, que é mais curto.', why: 'É a mesma checagem, só mais curta — os `if`s continuam espalhados. E `if auditoria:` ainda erra com objetos *falsy* (por exemplo, com `__len__` igual a 0).' },
        ],
        explanation: 'O Null Object substitui a **ausência** por um objeto com o mesmo contrato e comportamento neutro. Repare que o `gateway` continua obrigatório: cobrança não tem "comportamento neutro" — se ele faltar, o certo é falhar.',
      },
      {
        type: 'match',
        id: 'dp-nul-q2',
        concept: 'None × Optional × exceção',
        say: 'Agora associe: para cada situação, o melhor jeito de lidar com a ausência.',
        prompt: 'Associe cada **situação** ao melhor **tratamento da ausência**.',
        pairs: [
          { left: 'Biblioteca que aceita um logger opcional', right: 'Null Object (`NullLogger`)' },
          { left: '`buscar_usuario(id)` numa API: se não existir, a rota responde 404', right: 'Devolver `None`, com tipo `Usuario | None`' },
          { left: 'Variável `DATABASE_URL` ausente ao subir o serviço', right: 'Lançar exceção na inicialização (*fail fast*)' },
          { left: 'Visitante sem login navegando na loja', right: 'Special Case (`ClienteAnonimo`)' },
          { left: '`ordenar(itens, chave=None)`: sem chave, ordena pelo próprio valor', right: 'Função identidade como padrão (`lambda x: x`)' },
        ],
        explanation: 'A pergunta é sempre **o que a ausência significa**. Comportamento neutro óbvio → Null Object (ou Special Case, quando o "nulo" tem dados, como o visitante). O chamador precisa decidir → `None` tipado. É um erro → exceção o mais cedo possível. E, para funções, o "objeto nulo" é a **função identidade**.',
      },
      {
        type: 'mcq',
        id: 'dp-nul-q3',
        concept: 'Riscos do Null Object',
        multiple: true,
        say: 'Essa pega muita gente. Marque **todas** as corretas.',
        prompt: 'Quais destes usos de Null Object são **perigosos** — escondem erros ou vazam a abstração?',
        options: [
          { text: '`GatewayPagamentoNulo` que devolve "aprovado" quando o gateway real não foi configurado.', correct: true, why: 'Falha silenciosa no que mais importa: pedidos saem sem cobrança. Configuração obrigatória ausente pede *fail fast*.' },
          { text: '`ClienteNulo` com `email = "sem-email@loja.com"` para o envio de e-mails "não quebrar".', correct: true, why: 'É um Null Object que **mente**: dados inventados vazam para relatórios e integrações. Neutro seria "não enviar", e não "enviar para um endereço falso".' },
          { text: 'Vários pontos do código fazendo `if isinstance(logger, NullLogger): ...`.', correct: true, why: 'Os condicionais voltaram, agora disfarçados. Se o cliente precisa saber que é o nulo, a abstração vazou.' },
          { text: 'Uma biblioteca que faz `logging.getLogger("minha_lib").addHandler(logging.NullHandler())`.', why: 'É a prática **recomendada** pela documentação do `logging`: a biblioteca não impõe configuração, e a aplicação decide o que fazer com os logs.' },
          { text: 'Um `NotificadorNulo` passado em testes que não verificam notificações.', why: 'Uso legítimo: esse teste não se importa com notificações. Se precisasse verificá-las, aí sim o certo seria um *spy* ou *fake*.' },
        ],
        explanation: 'Null Object é seguro quando "não fazer nada" é **de fato** o comportamento correto. Se a ausência é um erro (pagamento, dado obrigatório), ele transforma uma falha barulhenta num bug silencioso — o pior tipo, porque aparece longe da causa.',
      },
      {
        type: 'code',
        id: 'dp-nul-q4',
        concept: 'Null Object',
        title: 'Checkout sem ifs',
        say: 'Mão na massa! Refatore o `Checkout` para não precisar de nenhum `if` por causa de ausência. E cuidado com uma armadilha escondida no logger…',
        prompt: `O \`Checkout\` funciona, mas está cheio de \`if ... is None\`. Refatore com **Null Objects**:

- \`NullLogger\`: mesmo contrato do \`LoggerMemoria\` (\`info(msg)\`), sem fazer nada e **sem guardar estado**.
- \`SemCupom\`: \`codigo\` igual a \`""\`, \`aplicar(valor)\` devolve o valor intacto e \`descricao()\` devolve \`"sem cupom"\`.
- \`Checkout(logger=None)\`: sem logger, usa um \`NullLogger\` (guardado em \`self.logger\`).
- \`fechar(valor, cupom=None)\`: sem cupom (ou com \`None\`), usa \`SemCupom\`. Registra \`"desconto: <descricao>"\` e depois \`"total: <total com 2 casas>"\`, e devolve o total.

A conversão de \`None\` deve acontecer **uma vez, na borda**; o resto do \`fechar\` não precisa de nenhum \`if\`. Não altere \`LoggerMemoria\` nem \`CupomPercentual\`.`,
        starter: BASE + '\n\n' + py(`
    class NullLogger:
        """TODO: mesmo contrato do LoggerMemoria, sem fazer nada."""


    class SemCupom:
        """TODO: cupom neutro."""


    class Checkout:
        # Refatore: troque os ifs por Null Objects.
        def __init__(self, logger=None):
            self.logger = logger

        def fechar(self, valor, cupom=None):
            if cupom is not None:
                total = cupom.aplicar(valor)
                if self.logger is not None:
                    self.logger.info(f"desconto: {cupom.descricao()}")
            else:
                total = valor
                if self.logger is not None:
                    self.logger.info("desconto: sem cupom")
            if self.logger is not None:
                self.logger.info(f"total: {total:.2f}")
            return total
  `),
        tests: [
          { name: 'sem logger e sem cupom', expr: 'Checkout().fechar(100.0)', expected: '100.0' },
          { name: 'cupom percentual', expr: 'Checkout().fechar(200.0, CupomPercentual("BEMVINDO", 10))', expected: '180.0' },
          {
            name: 'o logger recebe as mensagens',
            code: py(`
              log = LoggerMemoria()
              Checkout(log).fechar(200.0, CupomPercentual("BEMVINDO", 10))
              assert log.linhas == ["desconto: BEMVINDO (-10%)", "total: 180.00"], f"linhas = {log.linhas} — o Checkout está mesmo usando o logger que recebeu?"
            `),
          },
          {
            name: 'NullLogger é neutro',
            code: py(`
              nulo = NullLogger()
              assert nulo.info("qualquer coisa") is None
              assert not hasattr(nulo, "linhas"), "o Null Object não deve acumular estado"
            `),
          },
          { name: 'Checkout sem logger usa NullLogger', code: 'assert isinstance(Checkout().logger, NullLogger), "sem logger, o Checkout deveria guardar um NullLogger em self.logger"' },
          {
            name: 'SemCupom é neutro',
            code: py(`
              s = SemCupom()
              assert s.aplicar(59.9) == 59.9
              assert s.descricao() == "sem cupom"
              assert s.codigo == ""
            `),
          },
          {
            name: 'cupom None explícito (vindo do banco, por exemplo)',
            hidden: true,
            code: py(`
              log = LoggerMemoria()
              assert Checkout(log).fechar(80.0, None) == 80.0
              assert log.linhas == ["desconto: sem cupom", "total: 80.00"], log.linhas
            `),
          },
          {
            name: 'qualquer objeto com o contrato de cupom funciona',
            hidden: true,
            code: py(`
              class CupomFixo:
                  codigo = "DEZ"
                  def aplicar(self, valor):
                      return max(valor - 10, 0)
                  def descricao(self):
                      return "DEZ (-R$10)"

              log = LoggerMemoria()
              assert Checkout(log).fechar(8.0, CupomFixo()) == 0
              assert log.linhas == ["desconto: DEZ (-R$10)", "total: 0.00"], log.linhas
            `),
          },
          {
            name: 'LoggerMemoria vazio continua sendo usado',
            hidden: true,
            code: py(`
              log = LoggerMemoria()
              assert Checkout(log).logger is log, "um LoggerMemoria vazio é falsy (tem __len__): use 'is None', não 'logger or NullLogger()'"
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => (code.match(/\bis\s+not\s+None\b|\bis\s+None\b|[!=]=\s*None\b/g) || []).length >= 4,
            text: 'Ainda há muitas checagens de `None`. Converta a ausência em Null Object **uma vez, na borda** (construtor/entrada) e deixe o resto do código só chamar os métodos.',
            concept: 'Null Object',
          },
          {
            when: m => m.calls.includes('isinstance'),
            text: 'Você verifica o tipo com `isinstance`. Perguntar "é o objeto nulo?" traz de volta os condicionais que o padrão elimina — confie no polimorfismo.',
            concept: 'Polimorfismo',
          },
          {
            when: (m, code) => /\bor\s+(NullLogger|SemCupom)\s*\(/.test(code),
            text: 'O atalho `x or Padrao()` troca **qualquer** objeto *falsy* pelo padrão — um objeto real com `__len__` igual a 0 seria descartado em silêncio. Prefira `Padrao() if x is None else x`.',
            concept: 'Valores falsy',
          },
          {
            when: m => m.classes.some(c => c.name === 'NullLogger' && c.bases.includes('LoggerMemoria')),
            text: '`NullLogger` herda de `LoggerMemoria`. Um Null Object não deve herdar estado nem comportamento real: implemente o mesmo **contrato** (duck typing ou `Protocol`).',
            concept: 'Null Object',
          },
        ],
        hints: [
          '`NullLogger` só precisa de `def info(self, msg): pass`. `SemCupom` tem `codigo = ""`, `aplicar` que devolve `valor` e `descricao` que devolve `"sem cupom"`.',
          'No construtor: `self.logger = NullLogger() if logger is None else logger`. Evite `logger or NullLogger()`: um `LoggerMemoria` vazio é *falsy* por causa do `__len__`!',
          'Na primeira linha de `fechar`, troque `None` por `SemCupom()`. Depois é só `total = cupom.aplicar(valor)` e dois `self.logger.info(...)` — nenhum `if`.',
        ],
        solution: BASE + '\n\n' + py(`
          class NullLogger:
              """Mesmo contrato do LoggerMemoria; ignora tudo de propósito."""

              def info(self, msg):
                  pass


          class SemCupom:
              """Cupom neutro: não altera o valor."""

              codigo = ""

              def aplicar(self, valor):
                  return valor

              def descricao(self):
                  return "sem cupom"


          class Checkout:
              def __init__(self, logger=None):
                  self.logger = NullLogger() if logger is None else logger   # borda

              def fechar(self, valor, cupom=None):
                  cupom = SemCupom() if cupom is None else cupom             # borda
                  total = cupom.aplicar(valor)
                  self.logger.info(f"desconto: {cupom.descricao()}")
                  self.logger.info(f"total: {total:.2f}")
                  return total
        `),
        solutionExplanation: 'Os dois Null Objects seguem o **mesmo contrato** dos objetos reais, com comportamento neutro: `NullLogger.info` não faz nada e `SemCupom.aplicar` devolve o valor intacto. A ausência é convertida **uma única vez, na borda** — no construtor (`logger`) e na entrada de `fechar` (`cupom`) — sempre com `is None`: `logger or NullLogger()` descartaria um `LoggerMemoria` vazio, que é *falsy* por causa do `__len__`. Depois disso, `fechar` é uma linha reta, sem nenhum `if`, e aceita qualquer cupom que respeite o contrato.',
      },
      {
        type: 'open',
        id: 'dp-nul-q5',
        concept: 'None × Optional × exceção',
        say: 'Para fechar, uma pergunta de entrevista. Responda com exemplos.',
        prompt: 'Um colega propõe: "vamos eliminar **todos** os `None` do sistema com Null Objects". Você concorda? Explique quando usaria **Null Object**, quando devolveria **`None`/Optional** e quando lançaria uma **exceção** — e qual é o risco de exagerar.',
        minWords: 30,
        rubric: [
          { label: 'Null Object quando há um **comportamento neutro** óbvio', keywords: ['neutro', 'nao faz nada', 'nao fazer nada', 'faz nada', 'sem efeito', 'comportamento padrao', 'nulllogger', 'logger', 'desconto zero', 'dependencia opcional', 'notificacao opcional'], concept: 'Null Object', why: 'Quando "não fazer nada" é a resposta certa, o objeto neutro elimina os `if`s do código cliente.' },
          { label: '`None`/Optional quando o **chamador precisa decidir**', keywords: ['chamador', 'quem chama', 'decid', 'optional', 'type checker', 'mypy', 'pyright', '404', 'nao encontrad', 'nao existir', 'tratar a ausencia', '| none'], concept: 'Optional', why: 'A ausência é informação relevante: cada chamador reage de um jeito (404, criar, perguntar).' },
          { label: 'Exceção quando a ausência é um **erro** (*fail fast*)', keywords: ['excec', 'exception', 'raise', 'lanc', 'fail fast', 'falhar cedo', 'falhe cedo', 'falha cedo', 'falhar alto'], concept: 'Fail fast', why: 'Configuração ou dependência obrigatória ausente deve falhar alto e cedo, perto da causa.' },
          { label: 'Risco de **esconder erros** (falha silenciosa)', keywords: ['escond', 'mascar', 'silenc', 'engol', 'ocult', 'mente', 'mentir', 'finge', 'fingir', 'longe da causa', 'dificil de depurar'], concept: 'Riscos do Null Object', why: 'Um Null Object onde a ausência é bug transforma uma falha barulhenta num problema silencioso.' },
        ],
        modelAnswer: `Não concordo com **todos**. A escolha depende do que a ausência significa:

- **Null Object** quando existe um comportamento **neutro** óbvio: logger, métricas, notificação opcional, desconto zero. O \`NullLogger\` não faz nada, e o código cliente para de espalhar \`if\`.
- **\`None\` com Optional** (\`Usuario | None\`) quando o **chamador precisa decidir**: \`buscar_usuario(id)\` pode não achar ninguém, e uma rota responde 404 enquanto outro fluxo cria o usuário. O type checker (mypy) obriga a tratar.
- **Exceção** quando a ausência é um **erro**: configuração obrigatória, gateway de pagamento. *Fail fast*: falhar alto e cedo, na inicialização.

O risco de exagerar é **esconder erros**: um Null Object onde a ausência é bug vira uma falha silenciosa (pedido sem cobrança, e-mail para endereço inventado) que aparece longe da causa e é difícil de depurar.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Resumindo: o Null Object troca `if x is None` por um objeto que sabe **não fazer nada** — e a checagem fica uma vez só, na borda.',
          'Neutro óbvio → Null Object; o chamador decide → `None`; é erro → exceção. E nunca finja sucesso no que importa!',
        ],
        board: null,
      },
    ],
  });
})();
