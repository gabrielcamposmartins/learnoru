(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const GOD_OBJECT = py(`
    class Loja:
        """Faz TUDO: catálogo, carrinho, frete e e-mail. Refatore!"""

        def __init__(self, enviar_email):
            self.enviar_email = enviar_email
            self.precos = {}
            self.itens = {}

        def cadastrar_produto(self, nome, preco):
            if preco <= 0:
                raise ValueError("preço deve ser positivo")
            self.precos[nome] = preco

        def adicionar_ao_carrinho(self, nome, qtd=1):
            if nome not in self.precos:
                raise KeyError(nome)
            self.itens[nome] = self.itens.get(nome, 0) + qtd

        def subtotal(self):
            return round(sum(self.precos[n] * q for n, q in self.itens.items()), 2)

        def frete(self, uf):
            if self.subtotal() >= 200:
                return 0.0
            return 15.0 if uf == "SP" else 25.0

        def finalizar(self, email, uf):
            if not self.itens:
                raise ValueError("carrinho vazio")
            total = round(self.subtotal() + self.frete(uf), 2)
            self.enviar_email(email, f"Pedido confirmado: R$ {total:.2f}")
            self.itens = {}
            return total


    # TODO: extraia Catalogo, Carrinho e calcular_frete,
    #       e transforme a Loja numa fachada fina que delega para eles.
  `);

  Game.registerModule('design-patterns', {
    id: 'anti-patterns',
    title: 'Anti-patterns',
    kind: 'lesson',
    level: 2,
    order: 43,
    unit: 'pythonicos',
    summary: 'God Object, Lava Flow, Golden Hammer, Poltergeist e companhia: como reconhecer as "soluções" que viram problema — e como refatorar.',
    concepts: ['God Object', 'Lava Flow', 'Golden Hammer', 'Poltergeist', 'Modelo anêmico'],
    takeaways: [
      'Anti-pattern é uma solução **recorrente** que parece boa, mas gera mais problemas do que resolve — e tem uma refatoração conhecida.',
      '**God Object** se desmonta com testes de caracterização + *Extract Class* por grupos coesos, mantendo a classe antiga como fachada temporária.',
      '**Lava Flow** e **Boat Anchor** se resolvem investigando o uso e apagando com coragem: o controle de versão guarda o histórico.',
      '**Golden Hammer**, **Cargo Cult** e **patternite** nascem de aplicar soluções sem entender o problema: comece simples e introduza padrões quando a variação aparecer.',
      '**Modelo anêmico** deixa as regras fora da entidade e as invariantes desprotegidas — *tell, don\'t ask*.',
    ],
    glossary: [
      { term: 'God Object', aliases: ['God Class', 'Blob', 'objeto deus', 'classe deus'], definition: 'Classe que concentra responsabilidades demais (dados e regras de várias áreas) e da qual quase tudo depende. Sintomas: dezenas de métodos, nome genérico (`Manager`, `Sistema`) e conflitos de merge constantes.' },
      { term: 'Lava Flow', aliases: ['fluxo de lava'], definition: 'Código de experimentos ou versões antigas que "solidificou" em produção: ninguém sabe se ainda é usado, então ninguém o remove.' },
      { term: 'Poltergeist', aliases: ['poltergeists'], definition: 'Classe de vida curta e sem estado relevante que só aparece para repassar uma chamada a outro objeto e some — indireção sem responsabilidade própria.' },
      { term: 'Boat Anchor', aliases: ['âncora de barco', 'ancora de barco'], definition: 'Código, biblioteca ou infraestrutura mantidos "para quando precisarmos", sem uso atual. Custam build, atualizações, vulnerabilidades e atenção de quem lê.' },
      { term: 'Cargo Cult Programming', aliases: ['cargo cult', 'programação cargo cult', 'programacao cargo cult'], definition: 'Copiar código, rituais ou estruturas sem entender por que funcionam (ex.: `try/except: pass` copiado "porque o template tinha"). O nome vem da palestra *Cargo Cult Science* de Richard Feynman (1974).' },
      { term: 'Modelo de Domínio Anêmico', aliases: ['Anemic Domain Model', 'modelo anêmico', 'modelo anemico', 'domínio anêmico'], definition: 'Entidades só com dados (atributos, getters/setters) e todas as regras em classes de serviço. As invariantes ficam desprotegidas e o design vira procedural disfarçado de OO.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Até aqui vimos padrões: soluções que funcionam. Hoje é o outro lado da moeda — os **anti-patterns**.',
          'São "soluções" que aparecem em todo lugar, parecem boas no começo… e cobram juros depois.',
        ],
        board: {
          title: 'O que é um anti-pattern',
          md: `**Anti-pattern** = uma solução **recorrente** que parece boa, mas gera mais problemas do que resolve — e que tem uma **refatoração conhecida**.

| | Code smell | Anti-pattern |
|---|---|---|
| O que é | um **sintoma** no código | uma **solução ruim** que se repete |
| Escala | trecho, função, classe | design, arquitetura, processo, equipe |
| Exemplo | função longa, parâmetros demais | God Object, Golden Hammer |

Nesta aula: **God Object**, **Spaghetti Code**, **Lava Flow**, **Golden Hammer**, **Cargo Cult**, **patternite**, **Poltergeist**, **Boat Anchor** e **Modelo de Domínio Anêmico**.

> [!sabia] O termo *anti-pattern* foi cunhado por **Andrew Koenig** em 1995 e popularizado pelo livro *AntiPatterns* (1998), de Brown, Malveau, McCormick e Mowbray — foi ele que batizou o Lava Flow, o Poltergeist, o Boat Anchor, o Golden Hammer e o *Blob*, que hoje chamamos de God Object.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'O mais famoso: o **God Object**. Uma classe que sabe tudo e faz tudo.',
          'Ela nasce pequena e inocente; cada feature nova "só adiciona um método ali"… até virar o centro do universo.',
        ],
        board: {
          title: 'God Object (a.k.a. Blob)',
          md: `\`\`\`python
class Sistema:                        # 3.000 linhas, 80 métodos
    def __init__(self):
        self.usuarios = {}
        self.produtos = {}
        self.pedidos = []
        self.smtp = SMTP("mail.local")
        self.cache = {}

    def cadastrar_usuario(self, nome, email): ...
    def autenticar(self, email, senha): ...
    def cadastrar_produto(self, nome, preco): ...
    def calcular_frete(self, pedido, uf): ...
    def fechar_pedido(self, pedido_id): ...
    def enviar_email(self, para, texto): ...
    def gerar_relatorio_mensal(self, mes): ...
    # ...e mais 70
\`\`\`

**Como reconhecer**
- nome genérico: \`Sistema\`, \`Manager\`, \`Util\`, \`Helper\`, \`Core\`
- atributos e métodos que **não conversam entre si** (baixa coesão)
- todo módulo importa essa classe e toda feature mexe nela → conflitos de merge
- para testar uma regra, é preciso montar o mundo inteiro

**Como refatorar:** *Extract Class* por grupos coesos — atributos + métodos que andam juntos.

\`\`\`text
Sistema --> Usuarios    (usuarios, cadastrar_usuario, autenticar)
        --> Catalogo    (produtos, cadastrar_produto)
        --> Pedidos     (pedidos, fechar_pedido) --usa--> calcular_frete()
        --> Notificador (smtp, enviar_email)
\`\`\``,
        },
      },
      {
        type: 'say',
        text: [
          'Dois primos do God Object: o **Spaghetti Code**, em que o fluxo vira um emaranhado, e o **Lava Flow**, o código que endureceu.',
          'Lava Flow é aquele trecho que ninguém sabe se é usado — então ninguém tem coragem de apagar.',
        ],
        board: {
          title: 'Spaghetti Code e Lava Flow',
          md: `**Spaghetti Code** — flags, \`global\`, \`if\`s aninhados e caminhos que se cruzam:

\`\`\`python
def processar(p, modo, f=False, f2=None):
    global ultimo
    if modo == 1:
        if p["tipo"] == "A" and not f:
            ultimo = p
            if f2:
                ...
        else:
            ...
    elif modo == 2 or (modo == 3 and f):
        ...
\`\`\`

Refatorar: funções pequenas com nomes, *guard clauses*, dados explícitos no lugar de \`global\` e uma função (ou Strategy) por "modo". Na escala da arquitetura, o espaguete tem nome próprio: **Big Ball of Mud**.

**Lava Flow** — experimentos antigos que solidificaram em produção:

\`\`\`python
def calcular_preco_v2_antigo(produto):     # NÃO APAGAR — não sei o que faz
    ...

# def calcular_preco_promo(produto):
#     return produto.preco * 0.9           # promo de 2019?
\`\`\`

Tratamento: **investigar** (busca por usos, \`git log\`/\`git blame\`, cobertura de testes, logs em produção), entender **por que** existe e então **apagar** com testes. O git guarda o histórico — código comentado "por segurança" é só ruído.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora os anti-patterns de **atitude**: o **Golden Hammer**, o **Cargo Cult** e a **patternite**.',
          'Todos têm a mesma raiz: aplicar uma solução sem olhar direito para o problema.',
        ],
        board: {
          title: 'Golden Hammer, Cargo Cult e patternite',
          md: `- **Golden Hammer** — "para quem só tem martelo, tudo é prego": Kafka para tudo, microsserviços para um time de 3, regex para parsear HTML, o padrão favorito em todo lugar.
- **Cargo Cult Programming** — copiar rituais sem entender: \`try/except: pass\` "porque o template tinha", \`time.sleep(2)\` "que resolveu o bug", \`.copy()\` em tudo.
- **Patternite / Singletonitis** — padrões por padrões:

\`\`\`python
class SaudacaoStrategy(ABC):              # interface com 1 implementação
    @abstractmethod
    def saudar(self, nome): ...

class SaudacaoPadrao(SaudacaoStrategy):
    def saudar(self, nome):
        return f"Olá, {nome}"

class SaudacaoFactory:                    # e um Singleton, claro
    _instancia = None
    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
        return cls._instancia
    def criar(self):
        return SaudacaoPadrao()

SaudacaoFactory().criar().saudar("Ana")

# ...versus o que o problema pedia:
def saudar(nome):
    return f"Olá, {nome}"
\`\`\`

Refatorar: YAGNI, **regra de três** (abstraia na terceira repetição), *Inline Class* e *Collapse Hierarchy*.

> [!sabia] "Cargo cult" vem de uma palestra de **Richard Feynman** (1974): após a Segunda Guerra, moradores de ilhas do Pacífico construíram pistas e torres de controle de palha, imitando os militares, na esperança de que os aviões de carga voltassem. A forma estava lá; a substância, não.`,
        },
      },
      {
        type: 'say',
        text: [
          'Dois com nomes assustadores: o **Poltergeist**, uma classe que aparece, repassa uma chamada e some…',
          '…e o **Boat Anchor**, aquela âncora que você carrega "para quando precisar" — e que só te deixa mais lento.',
        ],
        board: {
          title: 'Poltergeist e Boat Anchor',
          md: `**Poltergeist** — vida curta, nenhum estado relevante, só repassa:

\`\`\`python
class IniciadorDeRelatorio:               # nasce, repassa e morre
    def __init__(self, dados):
        self.dados = dados

    def iniciar(self):
        GeradorDeRelatorio().gerar(self.dados)


IniciadorDeRelatorio(dados).iniciar()     # antes
GeradorDeRelatorio().gerar(dados)         # depois: é só chamar direto
\`\`\`

Nomes típicos: \`*Starter\`, \`*Invoker\`, \`*Launcher\`, um \`*Controller\` que só delega. Refatorar: remova e mova o comportamento para quem de fato tem a responsabilidade.

**Boat Anchor** — código, biblioteca ou infraestrutura sem uso hoje, mantidos "para o futuro":
- a lib de filas instalada e configurada que ninguém chama;
- o módulo de "multi-tenant" que nunca foi ligado;
- o servidor caro reservado "caso o tráfego cresça".

Custam build, atualizações de dependência, **vulnerabilidades** (CVEs) e atenção de quem lê. Refatorar: apague — se o futuro chegar, o git lembra.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E um que engana muita gente: o **Modelo de Domínio Anêmico**.',
          'As classes parecem objetos, mas só carregam dados; toda regra mora em "services". É programação procedural com fantasia de OO.',
        ],
        board: {
          title: 'Modelo de Domínio Anêmico',
          md: `\`\`\`python
# ANÊMICO: qualquer um pode fazer conta.saldo = -1000
@dataclass
class Conta:
    saldo: float

class ServicoConta:
    def sacar(self, conta, valor):
        if valor <= 0 or valor > conta.saldo:
            raise ValueError("saque inválido")
        conta.saldo -= valor


# RICO: a entidade protege as próprias invariantes
class Conta:
    def __init__(self, saldo=0.0):
        self._saldo = saldo

    @property
    def saldo(self):
        return self._saldo

    def sacar(self, valor):
        if valor <= 0 or valor > self._saldo:
            raise ValueError("saque inválido")
        self._saldo -= valor
\`\`\`

Martin Fowler chamou o modelo anêmico de anti-pattern em 2003: você paga o custo de ter objetos, mas não ganha o encapsulamento. A cura é *tell, don't ask* — em vez de perguntar o saldo e decidir fora, **mande a conta sacar**.

> [!atencao] Nem todo "dado + função" é anemia. Num CRUD sem regras, ou num estilo funcional com dados imutáveis, separar dados de funções é uma escolha legítima. O problema é quando há **invariantes** e ninguém as protege.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Para fechar a teoria, um quadro de bolso com sintomas e remédios.',
          'E um bônus: um anti-pattern que quase ninguém conhece pelo nome, mas todo mundo já viu.',
        ],
        board: {
          title: 'Guia de bolso: sintoma → remédio',
          md: `| Anti-pattern | Como reconhecer | Como refatorar |
|---|---|---|
| God Object | classe gigante, nome genérico, todos dependem dela | testes de caracterização + *Extract Class* |
| Spaghetti Code | flags, \`global\`, fluxo que ninguém consegue seguir | extrair funções, *guard clauses*, dados explícitos |
| Lava Flow | código morto "que ninguém ousa apagar" | investigar o uso, entender, apagar com testes |
| Golden Hammer | a mesma ferramenta para todo problema | escolher pela necessidade, comparar alternativas |
| Cargo Cult | código copiado que ninguém sabe explicar | entender antes de copiar; apagar o ritual |
| Patternite | abstrações com uma única implementação | YAGNI, regra de três, *Inline Class* |
| Poltergeist | classe que só repassa e some | remover e chamar o dono direto |
| Boat Anchor | dependência ou módulo sem uso "para o futuro" | apagar; o git lembra |
| Modelo anêmico | entidades só com dados; regras em services | mover o comportamento para a entidade |

> [!sabia] O **Inner-Platform Effect** é construir, dentro do seu sistema, uma cópia piorada da plataforma em que ele roda: uma tabela genérica \`entidade/atributo/valor\` que reimplementa o banco de dados **dentro** do banco, ou um "motor de regras configurável" que vira uma linguagem de programação sem depurador, sem testes e sem tipos.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Reconhecer, argumentar e refatorar um God Object de verdade.', icon: '🎯' },
      {
        type: 'match',
        id: 'dp-anti-q1',
        concept: 'Anti-patterns',
        say: 'Primeiro, um aquecimento: ligue cada anti-pattern ao sintoma.',
        prompt: 'Associe cada **anti-pattern** ao **sintoma** que o denuncia.',
        pairs: [
          { left: 'God Object', right: 'Uma classe `Sistema` com 60 métodos que todo módulo importa' },
          { left: 'Lava Flow', right: 'Funções `_v2_antigo` e blocos comentados de um protótipo que ninguém entende' },
          { left: 'Golden Hammer', right: 'O time usa Kafka para tudo, até para um CRUD de três telas' },
          { left: 'Poltergeist', right: 'Classe sem estado que nasce, repassa uma chamada e desaparece' },
          { left: 'Boat Anchor', right: 'Biblioteca cara instalada "para quando precisarmos", sem nenhum uso hoje' },
          { left: 'Cargo Cult Programming', right: '`try/except: pass` copiado em todo lugar "porque o template tinha"' },
        ],
        explanation: 'Lava Flow e Boat Anchor são parecidos (código sem uso), mas a origem muda: o Lava Flow é resto de experimentos que **endureceu** sem ninguém entender; o Boat Anchor é algo feito ou comprado **para um futuro** que não chegou. Nos dois casos, o remédio passa por investigar e apagar.',
      },
      {
        type: 'mcq',
        id: 'dp-anti-q2',
        concept: 'Modelo anêmico',
        say: 'Agora um code review. O que está errado aqui?',
        prompt: `Qualquer parte do sistema consegue fazer \`pedido.total = 0\` ou \`pedido.status = "fechado"\` diretamente:

\`\`\`python
@dataclass
class Pedido:
    itens: list
    status: str = "aberto"
    total: float = 0.0

class PedidoService:
    def adicionar_item(self, pedido, item):
        if pedido.status != "aberto":
            raise ValueError("pedido fechado")
        pedido.itens.append(item)
        pedido.total += item.preco

    def fechar(self, pedido):
        if not pedido.itens:
            raise ValueError("pedido vazio")
        pedido.status = "fechado"
\`\`\`

Qual é o anti-pattern e a melhor refatoração?`,
        options: [
          { text: 'Modelo de Domínio Anêmico: mover as regras para dentro do `Pedido` (`pedido.adicionar_item(item)`, `pedido.fechar()`) e proteger o estado.', correct: true, why: 'A entidade passa a garantir as próprias invariantes (não altera pedido fechado, total sempre coerente): *tell, don\'t ask*.' },
          { text: 'God Object: dividir o `PedidoService` em vários services menores.', why: 'O service nem é grande; dividi-lo espalha as regras ainda mais e mantém a entidade sem comportamento.' },
          { text: 'Poltergeist: apagar o `PedidoService` e deixar o código cliente mexer nos campos diretamente.', why: 'Isso remove o único lugar onde as regras existem — as invariantes ficam totalmente desprotegidas.' },
          { text: 'Nenhum: dataclasses devem conter só dados, e regras sempre ficam em services.', why: 'Essa é exatamente a definição do modelo anêmico. Em um domínio **com regras**, a entidade deve protegê-las (num CRUD sem regras, tudo bem).' },
        ],
        explanation: 'No modelo anêmico, a entidade é só um saco de dados e qualquer um pode deixá-la num estado inválido. Movendo `adicionar_item` e `fechar` para o `Pedido` (com o estado protegido), a regra "pedido fechado não muda" vale **sempre**, não só quando alguém lembra de passar pelo service.',
      },
      {
        type: 'mcq',
        id: 'dp-anti-q3',
        concept: 'Patternite',
        say: 'Próximo review. Esse aparece muito em código de quem acabou de estudar padrões…',
        prompt: 'Num PR, você encontra uma `LeitorConfigFactory` (implementada como Singleton) que cria uma `LeitorStrategy` abstrata com **uma única** implementação, `LeitorJsonPadrao` — tudo para ler um arquivo de configuração de 5 linhas. Qual é a melhor resposta?',
        options: [
          { text: 'Sugerir trocar tudo por uma função `ler_config(caminho)`; padrões entram quando surgir variação real (YAGNI, regra de três).', correct: true, why: 'Cada camada de indireção tem custo de leitura e manutenção. Sem variação real, a abstração é especulativa — e é fácil extraí-la depois, quando o segundo formato aparecer.' },
          { text: 'Aprovar: padrões sempre deixam o código mais extensível e profissional.', why: 'Isso é *patternite*: extensibilidade que ninguém pediu, paga com complexidade que todo mundo sente.' },
          { text: 'Pedir para acrescentar um Builder e um Observer, completando a arquitetura.', why: 'Mais do mesmo — o Golden Hammer dos padrões. O problema continua sendo ler 5 linhas de JSON.' },
          { text: 'Manter as classes e remover só o Singleton, o único anti-pattern ali.', why: 'O Singleton é o menor dos problemas: a Factory e a Strategy com uma única implementação são abstração especulativa do mesmo jeito.' },
        ],
        explanation: 'Padrão é resposta para uma **força** do problema (variação, extensão, desacoplamento). Sem a força, sobra só o custo. A heurística da **regra de três**: na primeira vez, escreva; na segunda, estranhe a repetição; na terceira, abstraia.',
      },
      {
        type: 'order',
        id: 'dp-anti-q4',
        concept: 'Refatorar God Object',
        say: 'Antes de pôr a mão no código: qual é a sequência segura para desmontar um God Object?',
        prompt: 'Ordene os passos para refatorar um **God Object** com segurança, sem parar o time.',
        items: [
          'Escrever testes de caracterização que fixam o comportamento atual',
          'Mapear quais atributos cada método usa e achar grupos coesos',
          'Extrair uma classe por grupo (ex.: `Catalogo`, `Carrinho`)',
          'Fazer a classe original delegar para as novas, mantendo a API',
          'Migrar os chamadores, aos poucos, para as classes novas',
          'Apagar os métodos de delegação que ficaram sem uso',
        ],
        explanation: 'Primeiro a **rede de segurança** (testes que descrevem o que o código faz hoje, certo ou errado). Depois, *Extract Class* guiado pela coesão, com a classe antiga virando uma **fachada temporária** — os chamadores continuam funcionando e migram no ritmo do time. Por fim, apague a fachada vazia (senão ela vira Lava Flow!).',
      },
      {
        type: 'code',
        id: 'dp-anti-q5',
        concept: 'Refatorar God Object',
        title: 'Desmontando um God Object',
        points: 50,
        say: 'Hora de refatorar de verdade! O primeiro teste é de **caracterização**: ele já passa hoje e tem que continuar passando depois.',
        prompt: `A classe \`Loja\` é um pequeno **God Object**: cuida de catálogo, carrinho, frete e e-mail. Refatore em peças coesas **sem quebrar a API antiga**:

- \`Catalogo\`: \`cadastrar(nome, preco)\` (preço ≤ 0 → \`ValueError\`) e \`preco(nome)\` (produto desconhecido → \`KeyError\`).
- \`Carrinho(catalogo)\`: \`adicionar(nome, qtd=1)\` (produto fora do catálogo → \`KeyError\`), \`subtotal()\` (2 casas), \`vazio()\` e \`limpar()\`. Ele usa o catálogo **apenas** por meio de \`catalogo.preco(nome)\`.
- \`calcular_frete(subtotal, uf)\`: função **pura** — grátis a partir de 200; senão, 15 para SP e 25 para os demais estados.
- \`Loja(enviar_email)\`: vira uma **fachada fina**, com \`self.catalogo\` e \`self.carrinho\`, que só delega os métodos antigos (\`cadastrar_produto\`, \`adicionar_ao_carrinho\`, \`subtotal\`, \`frete\`, \`finalizar\`) mantendo o mesmo comportamento.`,
        starter: GOD_OBJECT,
        tests: [
          {
            name: 'API antiga continua igual (caracterização)',
            code: py(`
              enviados = []
              loja = Loja(lambda para, msg: enviados.append((para, msg)))
              loja.cadastrar_produto("café", 30.0)
              loja.cadastrar_produto("caneca", 45.5)
              loja.adicionar_ao_carrinho("café", 2)
              loja.adicionar_ao_carrinho("caneca")
              assert loja.subtotal() == 105.5
              assert loja.frete("RJ") == 25.0
              assert loja.finalizar("ana@ex.com", "RJ") == 130.5
              assert enviados == [("ana@ex.com", "Pedido confirmado: R$ 130.50")], enviados
              assert loja.subtotal() == 0, "finalizar deve esvaziar o carrinho"
            `),
          },
          {
            name: 'Catalogo: cadastro, validação e consulta',
            code: py(`
              c = Catalogo()
              c.cadastrar("café", 30.0)
              assert c.preco("café") == 30.0
              for invalido in (0, -5):
                  try:
                      c.cadastrar("x", invalido)
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"preço {invalido} deveria lançar ValueError")
              try:
                  c.preco("fantasma")
              except KeyError:
                  pass
              else:
                  raise AssertionError("produto desconhecido deveria lançar KeyError")
            `),
          },
          {
            name: 'Carrinho usa o catálogo',
            code: py(`
              c = Catalogo()
              c.cadastrar("café", 30.0)
              car = Carrinho(c)
              assert car.vazio()
              car.adicionar("café", 3)
              assert not car.vazio()
              assert car.subtotal() == 90.0
              try:
                  car.adicionar("chá")
              except KeyError:
                  pass
              else:
                  raise AssertionError("produto fora do catálogo deveria lançar KeyError")
              car.limpar()
              assert car.vazio() and car.subtotal() == 0
            `),
          },
          {
            name: 'calcular_frete é uma função pura',
            code: py(`
              assert calcular_frete(199.99, "SP") == 15.0
              assert calcular_frete(199.99, "BA") == 25.0
              assert calcular_frete(200, "BA") == 0.0
            `),
          },
          {
            name: 'Loja delega para as partes',
            code: py(`
              loja = Loja(lambda para, msg: None)
              assert isinstance(loja.catalogo, Catalogo) and isinstance(loja.carrinho, Carrinho)
              loja.cadastrar_produto("chá", 12.0)
              assert loja.catalogo.preco("chá") == 12.0
              loja.adicionar_ao_carrinho("chá", 2)
              assert loja.carrinho.subtotal() == 24.0
            `),
          },
          {
            name: 'Carrinho aceita qualquer catálogo com preco()',
            hidden: true,
            code: py(`
              class CatalogoFake:
                  def preco(self, nome):
                      return {"a": 10.0, "b": 2.5}[nome]

              car = Carrinho(CatalogoFake())
              car.adicionar("a")
              car.adicionar("b", 4)
              car.adicionar("a")
              assert car.subtotal() == 30.0, "o Carrinho deve usar só catalogo.preco(nome)"
            `),
          },
          {
            name: 'carrinho vazio: ValueError e nenhum e-mail',
            hidden: true,
            code: py(`
              enviados = []
              loja = Loja(lambda para, msg: enviados.append(msg))
              try:
                  loja.finalizar("x@ex.com", "SP")
              except ValueError:
                  pass
              else:
                  raise AssertionError("finalizar com carrinho vazio deveria lançar ValueError")
              assert enviados == []
            `),
          },
          {
            name: 'frete grátis a partir de 200 pela fachada',
            hidden: true,
            code: py(`
              enviados = []
              loja = Loja(lambda para, msg: enviados.append(msg))
              loja.cadastrar_produto("fone", 250.0)
              loja.adicionar_ao_carrinho("fone")
              assert loja.frete("SP") == 0.0
              assert loja.finalizar("b@ex.com", "SP") == 250.0
              assert enviados == ["Pedido confirmado: R$ 250.00"], enviados
            `),
          },
          {
            name: 'lojas diferentes não compartilham estado',
            hidden: true,
            code: py(`
              a = Loja(lambda para, msg: None)
              b = Loja(lambda para, msg: None)
              a.cadastrar_produto("x", 1.0)
              a.adicionar_ao_carrinho("x")
              try:
                  b.adicionar_ao_carrinho("x")
              except KeyError:
                  pass
              else:
                  raise AssertionError("catálogos de lojas diferentes estão compartilhados (atributo de classe?)")
              assert b.subtotal() == 0
            `),
          },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => c.methods.length >= 8),
            text: 'Ainda existe uma classe com 8 ou mais métodos. Confira se ela não continua misturando responsabilidades — é o God Object tentando voltar.',
            concept: 'God Object',
          },
          {
            when: (m, code) => /catalogo\._\w+/.test(code),
            text: 'Algum código acessa atributos internos do catálogo (`catalogo._algo`). Peça o que precisa pela interface pública (`preco(nome)`, `cadastrar(...)`) — Lei de Deméter e encapsulamento.',
            concept: 'Encapsulamento',
          },
          {
            when: m => m.usesGlobal,
            text: 'Você usou `global`/`nonlocal`. O estado deve morar nos objetos (`Catalogo`, `Carrinho`); estado global é o caminho de volta para o espaguete.',
            concept: 'Spaghetti Code',
          },
          {
            when: (m, code) => /class\s+\w*(Manager|Gerenciador|Helper|Utils?)\b/.test(code),
            text: 'Nomes genéricos como `Manager`, `Helper` ou `Util` atraem responsabilidades — são o berço do próximo God Object. Prefira nomes do domínio (`Catalogo`, `Carrinho`).',
            concept: 'God Object',
          },
        ],
        hints: [
          'Agrupe o que anda junto: `precos` + `cadastrar_produto` → `Catalogo`; `itens` + `adicionar_ao_carrinho` + `subtotal` → `Carrinho`; `frete` não usa estado nenhum → função pura `calcular_frete(subtotal, uf)`.',
          'O `Carrinho` recebe o catálogo no construtor e só chama `self._catalogo.preco(nome)` — isso valida o produto (lança `KeyError`) e busca o preço, sem mexer no dict interno do catálogo.',
          'A `Loja` cria `self.catalogo = Catalogo()` e `self.carrinho = Carrinho(self.catalogo)`; cada método antigo vira uma linha que delega. Em `finalizar`, use `self.carrinho.vazio()` e `self.carrinho.limpar()`.',
        ],
        solution: py(`
          class Catalogo:
              def __init__(self):
                  self._precos = {}

              def cadastrar(self, nome, preco):
                  if preco <= 0:
                      raise ValueError("preço deve ser positivo")
                  self._precos[nome] = preco

              def preco(self, nome):
                  return self._precos[nome]            # KeyError se não existir


          class Carrinho:
              def __init__(self, catalogo):
                  self._catalogo = catalogo
                  self._itens = {}

              def adicionar(self, nome, qtd=1):
                  self._catalogo.preco(nome)           # valida: KeyError se não existir
                  self._itens[nome] = self._itens.get(nome, 0) + qtd

              def subtotal(self):
                  return round(sum(self._catalogo.preco(n) * q for n, q in self._itens.items()), 2)

              def vazio(self):
                  return not self._itens

              def limpar(self):
                  self._itens = {}


          def calcular_frete(subtotal, uf):
              if subtotal >= 200:
                  return 0.0
              return 15.0 if uf == "SP" else 25.0


          class Loja:
              """Fachada fina: mantém a API antiga e só coordena as partes."""

              def __init__(self, enviar_email):
                  self.enviar_email = enviar_email
                  self.catalogo = Catalogo()
                  self.carrinho = Carrinho(self.catalogo)

              def cadastrar_produto(self, nome, preco):
                  self.catalogo.cadastrar(nome, preco)

              def adicionar_ao_carrinho(self, nome, qtd=1):
                  self.carrinho.adicionar(nome, qtd)

              def subtotal(self):
                  return self.carrinho.subtotal()

              def frete(self, uf):
                  return calcular_frete(self.subtotal(), uf)

              def finalizar(self, email, uf):
                  if self.carrinho.vazio():
                      raise ValueError("carrinho vazio")
                  total = round(self.subtotal() + self.frete(uf), 2)
                  self.enviar_email(email, f"Pedido confirmado: R$ {total:.2f}")
                  self.carrinho.limpar()
                  return total
        `),
        solutionExplanation: 'Cada peça ficou com **uma** razão para mudar: `Catalogo` guarda preços e valida cadastro; `Carrinho` guarda quantidades e fala com o catálogo só pela interface pública (`preco`), por isso aceita qualquer catálogo — inclusive um fake nos testes; `calcular_frete` virou função pura, sem estado, testável com uma linha. A `Loja` continua existindo como **fachada fina**, então todo chamador antigo segue funcionando (é o que o teste de caracterização garante) e pode migrar aos poucos para as peças novas. Quando ninguém mais usar a fachada, apague-a.',
      },
      {
        type: 'open',
        id: 'dp-anti-q6',
        concept: 'Lava Flow',
        say: 'Última, e bem realista: código legado misterioso. Como você age?',
        prompt: 'Você herdou um módulo com funções `calcular_v2_antigo`, blocos comentados e um aviso "NÃO APAGAR — não sei o que faz". Como você lidaria com esse **Lava Flow** com segurança?',
        minWords: 30,
        rubric: [
          { label: '**Investigar** a origem antes de remover (por que existe?)', keywords: ['entend', 'investig', 'por que existe', 'porque existe', 'chesterton', 'historico', 'blame', 'git log', 'pergunt', 'contexto', 'origem'], concept: 'Lava Flow', why: 'Antes de derrubar a cerca, descubra por que ela foi erguida — o histórico e as pessoas costumam saber.' },
          { label: '**Medir o uso** real (busca, cobertura, logs/telemetria)', keywords: ['usad', 'uso real', 'chamad', 'grep', 'busca', 'referenc', 'cobertura', 'coverage', 'logs', 'telemetr', 'metrica', 'monitor', 'produca'], concept: 'Lava Flow', why: 'Busca estática não pega chamadas dinâmicas; logs ou contadores em produção confirmam se o código roda.' },
          { label: 'Criar uma **rede de testes** antes de mexer', keywords: ['teste', 'test', 'caracteriza'], concept: 'Testes de caracterização', why: 'Testes garantem que a remoção não muda o comportamento que importa.' },
          { label: '**Remover** com segurança (o git guarda o histórico; passos pequenos)', keywords: ['apag', 'remov', 'delet', 'exclu', 'controle de versao', 'versionamento', 'feature flag', 'aos poucos', 'pequenos passos', 'deprec', 'git guarda', 'historico do git'], concept: 'Lava Flow', why: 'Código comentado "por segurança" é ruído: o controle de versão já guarda tudo.' },
        ],
        modelAnswer: `Primeiro eu **investigaria** a origem: \`git log\`/\`git blame\` para achar o commit, o ticket e quem escreveu; perguntaria ao time. É a cerca de Chesterton: antes de remover, entender por que existe.

Depois mediria o **uso real**: busca por referências (grep, "find usages"), cobertura de testes e — como chamadas dinâmicas escapam da busca — um log ou métrica temporária em produção para ver se a função é chamada.

Antes de mexer, escreveria **testes** de caracterização do comportamento que depende desse módulo.

Confirmado que não é usado, eu **apagaria** as funções e os blocos comentados em commits pequenos. Se houver risco, dá para primeiro marcar como deprecated ou desligar atrás de uma feature flag. Não tenho medo de apagar: o controle de versão guarda o histórico se algum dia precisarmos.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo trabalho! Agora você reconhece os anti-patterns pelo cheiro — e sabe o remédio de cada um.',
          'Lembre: testes de caracterização primeiro, refatoração em passos pequenos e coragem para apagar. O git lembra de tudo!',
        ],
        board: null,
      },
    ],
  });
})();
