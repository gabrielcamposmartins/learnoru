Game.registerModule('architecture', {
  id: 'dependency-injection',
  title: 'Injeção de Dependência',
  kind: 'lesson',
  level: 2,
  order: 2,
  unit: 'principios',
  summary: 'Receber dependências em vez de criá-las: código testável, flexível e sem framework mágico.',
  concepts: ['Injeção de dependência', 'Inversão de controle', 'Composition root', 'Fakes'],
  takeaways: [
    '**Quem usa não cria**: as dependências chegam pelo construtor e aparecem na assinatura — nada escondido.',
    'Até o **relógio** é dependência: injete `relogio=date.today` e controle o tempo nos testes.',
    'Os objetos concretos são montados num lugar só, a **composition root** (ex.: `main.py`); o resto do código depende de contratos.',
    'Framework de DI é opcional: *Pure DI* (à mão) resolve a maioria dos casos. Cuidado com o **service locator** e com a *captive dependency*.',
    'Um construtor com dependências demais é alarme de **SRP**: a classe está fazendo coisas demais.',
  ],
  glossary: [
    { term: 'Injeção de dependência', aliases: ['injeções de dependência', 'dependency injection'], definition: 'Técnica em que um objeto **recebe** seus colaboradores (normalmente pelo construtor) em vez de criá-los. Deixa as dependências explícitas e permite trocar implementações — por exemplo, por fakes nos testes.' },
    { term: 'Inversão de controle', aliases: ['IoC', 'inversion of control'], definition: 'Quem decide quais implementações usar deixa de ser a própria classe e passa a ser algo de fora (a composition root, um framework). A injeção de dependência é uma forma de inversão de controle.' },
    { term: 'Composition root', aliases: ['composition roots', 'raiz de composição'], definition: 'O ponto de entrada da aplicação (ex.: `main.py`, a fábrica do app): o **único** lugar que conhece as classes concretas e monta o grafo de objetos.' },
    { term: 'Service locator', aliases: ['service locators', 'localizador de serviços'], definition: 'Registro global onde as classes **buscam** suas dependências (`Locator.get(Repo)`). Parece DI, mas esconde as dependências da assinatura — por isso é considerado um anti-pattern.' },
    { term: 'Captive dependency', aliases: ['captive dependencies', 'dependência cativa'], definition: 'Bug de tempo de vida batizado por Mark Seemann: um objeto de vida longa (um singleton) guarda uma dependência de vida curta (ex.: a sessão do banco de uma requisição), que fica "presa" e passa a ser compartilhada indevidamente.' },
    { term: 'Pure DI', aliases: ["Poor Man's DI", 'DI manual', 'injeção manual'], definition: 'Injeção de dependência feita **à mão**, sem container nem framework: a composition root instancia e conecta os objetos com código comum. Termo de Mark Seemann.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Na aula de camadas, o caso de uso **recebia** o repositório. Hoje vamos entender por que isso é tão importante.',
        'Esse "receber em vez de criar" tem nome: **injeção de dependência**, ou DI.',
      ],
      board: {
        title: 'O problema: dependências escondidas',
        code: `from datetime import date

class ServicoCobranca:
    def __init__(self):
        self.gateway = GatewayStripe(api_key="sk_live_...")   # criada aqui dentro
        self.repo = RepositorioPostgres("postgres://prod")    # criada aqui dentro

    def cobrar_vencidas(self):
        hoje = date.today()                                    # relógio real
        for fatura in self.repo.faturas_vencidas(hoje):
            self.gateway.cobrar(fatura)`,
        caption: 'Como testar isso sem cobrar cartões de verdade e sem esperar o dia virar?',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Olha quantos problemas nesse código: ele **esconde** as dependências, está preso ao Stripe e ao Postgres…',
        '…e depende do **relógio real**. Para testar "fatura vencida", você teria que mudar a data do computador!',
      ],
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'A solução é simples e não precisa de framework nenhum: **peça as dependências no construtor**.',
        'Até o relógio vira uma dependência — uma função que devolve a data de hoje.',
      ],
      board: {
        title: '✅ Injeção pelo construtor',
        code: `class ServicoCobranca:
    def __init__(self, gateway, repo, relogio):
        self.gateway = gateway
        self.repo = repo
        self.relogio = relogio          # ex.: date.today

    def cobrar_vencidas(self):
        hoje = self.relogio()
        for fatura in self.repo.faturas_vencidas(hoje):
            self.gateway.cobrar(fatura)`,
        caption: 'As dependências agora aparecem na assinatura — nada escondido.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Isso é **inversão de controle**: a classe não controla mais *quais* implementações usa. Alguém de fora decide.',
        'Esse "alguém" é a **composition root** — o ponto de entrada da aplicação, onde os objetos reais são montados e conectados.',
      ],
      board: {
        title: 'Composition root',
        code: `# main.py — o ÚNICO lugar que conhece as implementações concretas
from datetime import date

def montar_app():
    repo = RepositorioPostgres(os.environ["DATABASE_URL"])
    gateway = GatewayStripe(os.environ["STRIPE_KEY"])
    servico = ServicoCobranca(gateway=gateway, repo=repo, relogio=date.today)
    return servico


if __name__ == "__main__":
    montar_app().cobrar_vencidas()`,
      },
    },
    {
      type: 'say',
      text: [
        'E nos testes, injetamos **fakes**: implementações simples, em memória, que registram o que aconteceu.',
        'O teste fica rápido, determinístico e não toca em nada externo.',
      ],
      board: {
        title: 'Testando com fakes',
        code: `from datetime import date

class GatewayFake:
    def __init__(self):
        self.cobradas = []
    def cobrar(self, fatura):
        self.cobradas.append(fatura)

class RepoFake:
    def __init__(self, faturas):
        self.faturas = faturas
    def faturas_vencidas(self, hoje):
        return [f for f in self.faturas if f["vencimento"] < hoje]


def test_cobra_apenas_vencidas():
    gateway = GatewayFake()
    repo = RepoFake([{"id": 1, "vencimento": date(2024, 1, 1)},
                     {"id": 2, "vencimento": date(2024, 3, 1)}])
    servico = ServicoCobranca(gateway, repo, relogio=lambda: date(2024, 2, 1))

    servico.cobrar_vencidas()

    assert [f["id"] for f in gateway.cobradas] == [1]`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Alguns cuidados: não abuse de **valores padrão** que criam a dependência real (`gateway=None` → `GatewayStripe()`), pois isso volta a esconder o acoplamento.',
        'E frameworks de DI (como `dependency-injector` ou o `Depends` do FastAPI) são opcionais — o conceito é o mesmo: **quem usa não cria**.',
      ],
      board: {
        title: 'Formas de injeção',
        md: `| Forma | Exemplo | Quando usar |
|---|---|---|
| **Construtor** | \`Servico(repo)\` | Padrão — dependências obrigatórias |
| **Parâmetro de método** | \`servico.gerar(relatorio, formatador)\` | Dependência que varia a cada chamada |
| **Atributo/setter** | \`servico.logger = ...\` | Raro; dependências opcionais |

> [!dica] Muitas dependências no construtor (6, 7, 8…) indicam que a classe tem responsabilidades demais — é um alerta de SRP.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'DI tem uma armadilha que quase ninguém conhece pelo nome — e que causa bugs bem esquisitos em produção.',
        'Não basta saber **o que** injetar: importa **quanto tempo** cada objeto vive.',
      ],
      board: {
        title: 'Tempo de vida e a captive dependency',
        md: `| Tempo de vida | Criado… | Exemplo típico |
|---|---|---|
| **Singleton** | uma vez, no startup | configuração, pool de conexões, cliente HTTP |
| **Por escopo** (*scoped*) | uma vez por requisição ou tarefa | sessão do banco, unidade de trabalho, usuário logado |
| **Transiente** | a cada vez que alguém pede | objetos leves e sem estado |

\`\`\`python
# ❌ o singleton "captura" algo que deveria viver uma requisição
sessao = abrir_sessao()                    # escopo: UMA requisição
servico = ServicoPedidos(sessao)           # singleton, criado no startup
# todas as requisições dividem a MESMA sessão (e a mesma transação!)

# ✅ injete uma fábrica: cada operação abre (e fecha) a sua sessão
servico = ServicoPedidos(abrir_sessao=abrir_sessao)
\`\`\`

> [!sabia] Esse bug tem nome: **captive dependency** (Mark Seemann) — um objeto de vida **longa** segurando uma dependência de vida **curta**, que fica "presa" muito além do prazo. A regra: uma dependência nunca pode viver **menos** que quem a recebe. Seemann também batizou de **Pure DI** a injeção feita à mão, sem container — exatamente o que fizemos nesta aula.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — a última é uma refatoração testada com fakes.', icon: '🎯' },
    {
      type: 'match',
      id: 'arq-rx-di-1',
      concept: 'Vocabulário de injeção de dependência',
      say: 'Aquecimento: o vocabulário que aparece em toda conversa sobre DI.',
      prompt: 'Associe cada termo à sua descrição.',
      pairs: [
        { left: '**Composition root**', right: 'Único lugar que monta os objetos concretos (ex.: `main.py`)' },
        { left: '**Service locator**', right: 'A classe busca a dependência num registro global — ela continua escondida' },
        { left: '**Captive dependency**', right: 'Um singleton guardando algo que deveria viver só uma requisição' },
        { left: '**Pure DI**', right: 'Injeção feita à mão, sem framework nem container' },
        { left: '**Fake**', right: 'Implementação simples em memória, injetada nos testes' },
      ],
      explanation: 'A **composition root** é o único ponto que conhece as classes concretas; o **service locator** parece DI, mas esconde as dependências (a classe vai buscá-las em vez de recebê-las). **Pure DI** mostra que framework é opcional, e **fakes** são o grande prêmio da DI nos testes. Já a **captive dependency** lembra que tempo de vida importa: uma dependência nunca pode viver menos que quem a usa.',
    },
    {
      type: 'mcq',
      id: 'arq-di-q1',
      concept: 'Injeção de dependência',
      say: 'Qual destas classes usa injeção de dependência?',
      prompt: 'Qual versão de `EnviadorRelatorio` aplica **injeção de dependência**?',
      options: [
        { text: `\`\`\`python
class EnviadorRelatorio:
    def __init__(self, email_client):
        self.email = email_client
\`\`\``, correct: true, why: 'A dependência chega de fora; quem monta o objeto decide a implementação.' },
        { text: `\`\`\`python
class EnviadorRelatorio:
    def __init__(self):
        self.email = SmtpClient("smtp.empresa.com")
\`\`\``, why: 'A classe cria a própria dependência concreta — acoplamento direto ao SMTP.' },
        { text: `\`\`\`python
class EnviadorRelatorio:
    def enviar(self):
        SmtpClient.instance().send(...)
\`\`\``, why: 'Buscar um Singleton global é um **service locator** escondido: a dependência continua oculta.' },
        { text: `\`\`\`python
class EnviadorRelatorio(SmtpClient):
    pass
\`\`\``, why: 'Herança acopla ainda mais: o relatório "é um" cliente SMTP?' },
      ],
      explanation: 'Na injeção de dependência a classe **declara** o que precisa (normalmente no construtor) e **recebe** a implementação. Criar internamente, herdar ou buscar globalmente mantêm o acoplamento.',
    },
    {
      type: 'mcq',
      id: 'arq-di-q2',
      concept: 'Composition root',
      say: 'E onde os objetos reais devem ser montados?',
      prompt: 'Onde é o melhor lugar para instanciar as implementações concretas (`RepositorioPostgres`, `GatewayStripe`) e conectá-las aos serviços?',
      options: [
        { text: 'Na **composition root** — o ponto de entrada da aplicação (ex.: `main.py`, fábrica do app).', correct: true, why: 'Um único lugar conhece os detalhes concretos; o resto do código só depende de contratos.' },
        { text: 'Dentro de cada serviço, no `__init__`.', why: 'Isso é exatamente o acoplamento que a DI quer evitar.' },
        { text: 'Em variáveis globais em cada módulo que as usa.', why: 'Globais espalham o acoplamento e dificultam testes.' },
        { text: 'Nas entidades de domínio.', why: 'O domínio não deve conhecer infraestrutura (regra de dependência).' },
      ],
      explanation: 'A **composition root** é onde o grafo de objetos é montado. Ela fica na borda do sistema (ponto de entrada), e é o único lugar que precisa mudar ao trocar uma implementação.',
    },
    {
      type: 'open',
      id: 'arq-di-q3',
      concept: 'Injeção de dependência',
      say: 'Pergunta comum em entrevistas de pleno. Capricha!',
      prompt: 'Quais são os **benefícios** da injeção de dependência? Dê um exemplo de como ela facilita os testes.',
      minWords: 15,
      rubric: [
        { label: 'Cita **testabilidade** com fakes/mocks', keywords: ['test', 'mock', 'fake', 'dubl', 'stub'], concept: 'Testabilidade', why: 'É o benefício mais concreto: trocar dependências reais por dublês.' },
        { label: 'Cita **baixo acoplamento** / depender de abstrações', keywords: ['acopla', 'abstra', 'interface', 'contrato', 'protocol'], concept: 'Acoplamento', why: 'A classe depende de um contrato, não de uma implementação.' },
        { label: 'Cita a facilidade de **trocar implementações**', keywords: ['troc', 'substitu', 'flexib', 'outra implementa', 'mudar o banco', 'mudar de banco'], concept: 'Flexibilidade', why: 'Trocar Postgres por memória ou Stripe por outro gateway sem mexer no serviço.' },
        { label: 'Dá um **exemplo** concreto (relógio, banco, API externa…)', keywords: ['relogio', 'data', 'banco', 'api', 'email', 'e-mail', 'gateway', 'repositorio', 'http'], concept: 'Fakes', why: 'Exemplos concretos mostram domínio do assunto.' },
      ],
      modelAnswer: `A injeção de dependência faz a classe **receber** seus colaboradores em vez de criá-los. Os principais benefícios são:

- **Baixo acoplamento**: a classe depende de um contrato (abstração), não de uma implementação concreta.
- **Flexibilidade**: dá para **trocar** implementações (Postgres → memória, Stripe → outro gateway) só mudando a composition root.
- **Testabilidade**: nos testes injetamos **fakes** ou mocks.

Exemplo: um serviço que verifica assinaturas vencidas usa \`date.today()\`. Se o **relógio** for injetado (\`relogio=lambda: date(2024, 1, 10)\`), o teste controla a data e fica determinístico; se o notificador de **e-mail** for injetado, o teste usa um fake que só registra as mensagens, sem enviar nada de verdade.`,
    },
    {
      type: 'code',
      id: 'arq-di-q4',
      concept: 'Injeção de dependência',
      title: 'Assinaturas testáveis',
      say: 'Esse serviço é impossível de testar do jeito que está. Refatore para receber as dependências!',
      prompt: `O \`ServicoAssinatura\` abaixo cria o \`EmailSmtp\` sozinho e usa o relógio real. Refatore com **injeção de dependência**:

- Construtor: \`ServicoAssinatura(relogio, notificador)\`
  - \`relogio\`: função sem argumentos que devolve a data de hoje (\`date\`).
  - \`notificador\`: objeto com \`enviar(destino, mensagem)\`.
- \`verificar(email, vencimento)\`:
  - se hoje for **depois** do vencimento → envia uma notificação para \`email\` e devolve \`"vencida"\`;
  - senão → **não envia nada** e devolve \`"ativa"\`.

Os testes vão injetar um relógio fixo e um notificador fake.`,
      starter: `from datetime import date


class EmailSmtp:
    def enviar(self, destino, mensagem):
        raise RuntimeError("tentou abrir uma conexão SMTP de verdade!")


class ServicoAssinatura:
    def __init__(self):
        self.notificador = EmailSmtp()      # dependência concreta criada aqui dentro

    def verificar(self, email, vencimento):
        hoje = date.today()                 # relógio real: impossível testar datas
        if hoje > vencimento:
            self.notificador.enviar(email, "Sua assinatura venceu")
            return "vencida"
        return "ativa"
`,
      tests: [
        {
          name: 'assinatura vencida notifica',
          code: `from datetime import date

class NotificadorFake:
    def __init__(self):
        self.enviados = []
    def enviar(self, destino, mensagem):
        self.enviados.append((destino, mensagem))

n = NotificadorFake()
s = ServicoAssinatura(relogio=lambda: date(2024, 1, 10), notificador=n)
assert s.verificar("ana@x.com", date(2024, 1, 5)) == "vencida"
assert len(n.enviados) == 1 and n.enviados[0][0] == "ana@x.com", f"esperava 1 notificação para ana@x.com, obtido {n.enviados}"`,
        },
        {
          name: 'assinatura ativa não notifica',
          code: `from datetime import date

class NotificadorFake:
    def __init__(self):
        self.enviados = []
    def enviar(self, destino, mensagem):
        self.enviados.append((destino, mensagem))

n = NotificadorFake()
s = ServicoAssinatura(relogio=lambda: date(2024, 1, 10), notificador=n)
assert s.verificar("bia@x.com", date(2024, 2, 1)) == "ativa"
assert n.enviados == [], "assinatura ativa não deveria enviar notificação"`,
        },
        {
          name: 'no dia do vencimento ainda está ativa',
          hidden: true,
          code: `from datetime import date

class NotificadorFake:
    def __init__(self):
        self.enviados = []
    def enviar(self, destino, mensagem):
        self.enviados.append((destino, mensagem))

n = NotificadorFake()
s = ServicoAssinatura(relogio=lambda: date(2024, 3, 1), notificador=n)
assert s.verificar("caio@x.com", date(2024, 3, 1)) == "ativa"
assert n.enviados == []`,
        },
        {
          name: 'usa o relógio injetado a cada chamada',
          hidden: true,
          code: `from datetime import date

class NotificadorFake:
    def __init__(self):
        self.enviados = []
    def enviar(self, destino, mensagem):
        self.enviados.append((destino, mensagem))

dias = [date(2024, 1, 1), date(2024, 1, 20)]
n = NotificadorFake()
s = ServicoAssinatura(relogio=lambda: dias.pop(0), notificador=n)
assert s.verificar("d@x.com", date(2024, 1, 10)) == "ativa"
assert s.verificar("d@x.com", date(2024, 1, 10)) == "vencida"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('today') || m.calls.includes('now'),
          text: 'O código ainda chama `date.today()`/`datetime.now()`. O relógio real é uma **dependência oculta** — use sempre o `relogio` injetado.',
          concept: 'Dependências ocultas (relógio)',
        },
        {
          when: (m, code) => {
            // Só dentro da classe ServicoAssinatura, ignorando comentários.
            const cls = (code.replace(/#.*$/gm, '').split(/class\s+ServicoAssinatura\b/)[1] || '').split(/\nclass\s/)[0];
            return /EmailSmtp\(\)/.test(cls);
          },
          text: 'O serviço ainda cria `EmailSmtp()` (mesmo que como valor padrão). Isso esconde o acoplamento ao SMTP — a implementação concreta deve ser escolhida só na **composition root**.',
          concept: 'Inversão de controle',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. Estado global é o oposto de injeção: a dependência volta a ficar escondida.',
          concept: 'Injeção de dependência',
        },
      ],
      hints: [
        'Mude o construtor para `def __init__(self, relogio, notificador):` e guarde os dois em `self`.',
        'Em `verificar`, troque `date.today()` por `self.relogio()`.',
      ],
      solution: `from datetime import date


class EmailSmtp:
    def enviar(self, destino, mensagem):
        raise RuntimeError("tentou abrir uma conexão SMTP de verdade!")


class ServicoAssinatura:
    def __init__(self, relogio, notificador):
        self.relogio = relogio
        self.notificador = notificador

    def verificar(self, email, vencimento):
        if self.relogio() > vencimento:
            self.notificador.enviar(email, "Sua assinatura venceu")
            return "vencida"
        return "ativa"


# Composition root (produção):
# servico = ServicoAssinatura(relogio=date.today, notificador=EmailSmtp())
`,
      solutionExplanation: 'O serviço agora **declara** suas duas dependências no construtor e não sabe nada sobre SMTP ou sobre o relógio do sistema. Em produção, a composition root passa `date.today` e `EmailSmtp()`; nos testes, um relógio fixo e um fake que só registra mensagens — testes rápidos e **determinísticos**.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! Lembre: **quem usa não cria**. Dependências entram pelo construtor e são montadas na composition root.',
        'Com isso, trocar implementações e testar vira trivial. Na próxima aula vamos levar essa ideia ao extremo com a **arquitetura hexagonal**.',
      ],
      board: null,
    },
  ],
});
