Game.registerModule('design-patterns', {
  id: 'builder',
  title: 'Builder',
  kind: 'lesson',
  level: 2,
  order: 12,
  unit: 'criacionais',
  summary: 'Montar objetos complexos passo a passo, validar tudo no build() e entregar um produto imutável — e saber quando kwargs e dataclasses já bastam.',
  concepts: ['Builder', 'Interface fluente', 'Director', 'Construtor telescópico', 'Objeto imutável'],
  takeaways: [
    'O Builder separa a **configuração** (passos, em qualquer ordem) da **montagem** (`build()`), acabando com construtores telescópicos e listas enormes de parâmetros posicionais.',
    'Na interface fluente, todo método de configuração **retorna `self`** — sem isso, a próxima chamada da cadeia acontece em `None`.',
    'O `build()` é o lugar das **validações entre campos** e deve entregar um produto **imutável**, copiando e congelando as coleções do rascunho.',
    'O **Director** guarda receitas de construção; no Builder original do GoF, o mesmo processo gera **representações diferentes**.',
    'Em Python, **argumentos nomeados**, `@dataclass(frozen=True, kw_only=True)` e `dataclasses.replace` resolvem boa parte dos casos — use Builder quando a construção for realmente **em etapas**.',
  ],
  glossary: [
    { term: 'Builder', aliases: ['padrão Builder', 'builders'], definition: 'Padrão criacional que monta um objeto complexo passo a passo e o entrega pronto num método final (`build()`), separando a configuração da representação.' },
    { term: 'Construtor telescópico', aliases: ['construtores telescópicos', 'telescoping constructor', 'sobrecargas telescópicas'], definition: 'Anti-pattern de sobrecargas de construtor com cada vez mais parâmetros — ou de um construtor com dezenas de parâmetros posicionais impossíveis de ler.' },
    { term: 'Interface fluente', aliases: ['fluent interface', 'API fluente', 'encadeamento de métodos', 'method chaining'], definition: 'Estilo de API em que os métodos retornam o próprio objeto (`self`), permitindo encadear chamadas: `b.a().b().c()`.' },
    { term: 'Director', aliases: ['diretor do builder'], definition: 'No Builder do GoF, o objeto que conhece a **ordem** dos passos de construção e os executa sobre qualquer builder compatível.' },
    { term: 'Boolean trap', aliases: ['armadilha do booleano', 'boolean traps'], definition: 'Parâmetros booleanos posicionais (`f(x, True, False)`) que ninguém entende sem ler a assinatura. Em Python, a cura é torná-los somente-nomeados com `*`.' },
    { term: 'Wither', aliases: ['withers'], definition: 'Método que devolve uma **cópia** do objeto com um campo trocado, em vez de alterá-lo: `dataclasses.replace`, `Path.with_suffix`, `datetime.replace`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto é o **Builder** — o padrão para quando criar um objeto vira uma novela.',
        'Olha essa chamada e me responde: o que significa aquele `3`? E o `True`?',
      ],
      board: {
        title: 'O problema: construtor telescópico',
        code: `class Requisicao:
    def __init__(self, metodo, url, headers=None, params=None, corpo=None,
                 timeout=10.0, tentativas=0, verificar_tls=True, auth=None):
        ...


# Um mês depois, alguém lê isto no code review:
r = Requisicao("POST", "https://api.loja.com/pedidos", None, {"page": 2},
               b'{"sku": 42}', 5, 3, True, ("ana", "s3nh4"))
# 5? 3? True? Só abrindo a assinatura para descobrir 😵`,
        caption: 'Em Java, a versão clássica são as **sobrecargas telescópicas**: `Requisicao(url)`, `Requisicao(url, metodo)`, `Requisicao(url, metodo, headers)`… uma para cada combinação.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Antes de sair criando classes: em Python, a primeira defesa são os **argumentos nomeados**.',
        'Com um `*` na assinatura, tudo que vem depois **só** pode ser passado pelo nome — adeus, booleano misterioso.',
      ],
      board: {
        title: 'Primeira defesa: argumentos somente-nomeados',
        md: `\`\`\`python
class Requisicao:
    def __init__(self, metodo, url, *, headers=None, timeout=10.0,
                 tentativas=0, verificar_tls=True):
        ...


r = Requisicao("POST", "https://api.loja.com/pedidos",
               timeout=5, tentativas=3, verificar_tls=True)   # legível!

Requisicao("GET", "https://api.loja.com", 5)
# TypeError: Requisicao.__init__() takes 3 positional arguments but 4 were given
\`\`\`

> [!sabia] Esse problema tem nome: **boolean trap** (armadilha do booleano). Em \`Requisicao(url, True, False)\`, ninguém sabe o que cada booleano liga sem abrir a assinatura. A própria biblioteca padrão aplica a cura: em \`sorted(dados, key=len, reverse=True)\`, \`key\` e \`reverse\` **só** podem ser passados pelo nome — \`sorted(dados, None, True)\` dá \`TypeError\`.

Se o problema é só "muitos parâmetros opcionais", **isso já resolve** — sem padrão nenhum.`,
      },
    },
    {
      type: 'say',
      text: [
        'Mas às vezes a construção acontece **em etapas**: headers chegando um a um, dados vindos de lugares diferentes, validações que dependem de vários campos.',
        'Aí entra o **Builder**: um objeto-rascunho que acumula as partes e só entrega o produto no `build()`. O truque da **interface fluente** é cada método **retornar `self`**.',
      ],
      board: {
        title: 'Builder fluente',
        code: `class RequisicaoBuilder:
    def __init__(self, url):
        self._url = url
        self._metodo = "GET"
        self._headers = {}
        self._corpo = None
        self._timeout = 10.0

    def metodo(self, nome):
        self._metodo = nome.upper()
        return self                      # ← o segredo do encadeamento

    def header(self, nome, valor):
        self._headers[nome] = valor      # pode ser chamado N vezes
        return self

    def corpo(self, dados):
        self._corpo = dados
        return self

    def timeout(self, segundos):
        self._timeout = segundos
        return self

    def build(self):
        return Requisicao(metodo=self._metodo, url=self._url,
                          headers=dict(self._headers), corpo=self._corpo,
                          timeout=self._timeout)


req = (RequisicaoBuilder("https://api.loja.com/pedidos")
       .metodo("post")
       .header("Authorization", "Bearer abc123")
       .header("Accept", "application/json")
       .corpo(b'{"sku": 42}')
       .timeout(5)
       .build())`,
        caption: 'Os parênteses em volta da expressão permitem quebrar as linhas sem `\\`. Os passos podem vir em **qualquer ordem** — quem monta de verdade é o `build()`.',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'O `build()` é o **portão de saída**. Como os passos vêm em qualquer ordem, é só ali que dá para checar regras que envolvem **vários campos**.',
        'E o produto deve sair **imutável**. Cuidado: `frozen=True` é imutabilidade *rasa* — se você entregar o dict do próprio builder, o objeto "congelado" muda junto com ele!',
      ],
      board: {
        title: 'build(): validar e congelar',
        md: `\`\`\`python
from dataclasses import dataclass
from types import MappingProxyType


@dataclass(frozen=True)
class Requisicao:
    metodo: str
    url: str
    headers: MappingProxyType          # dict somente-leitura
    corpo: bytes | None
    timeout: float


class RequisicaoBuilder:
    ...  # passos como antes

    def build(self):
        if not self._url.startswith(("http://", "https://")):
            raise ValueError("URL precisa começar com http:// ou https://")
        if self._metodo == "GET" and self._corpo is not None:
            raise ValueError("GET não leva corpo")            # regra entre campos
        if self._timeout <= 0:
            raise ValueError("timeout deve ser positivo")
        return Requisicao(
            metodo=self._metodo,
            url=self._url,
            headers=MappingProxyType(dict(self._headers)),    # cópia + visão só-leitura
            corpo=self._corpo,
            timeout=self._timeout,
        )
\`\`\`

- \`req.url = "..."\` → \`FrozenInstanceError\` (o \`frozen=True\` barra reatribuição)
- \`req.headers["X"] = "1"\` → \`TypeError\` (o \`MappingProxyType\` barra a mutação)

> [!atencao] Sem a cópia \`dict(...)\`, reaproveitar o builder depois do \`build()\` (\`b.header(...)\`) alteraria requisições **já entregues**: produto e builder estariam compartilhando o mesmo dict. É o bug de **aliasing** — e ele vai aparecer nos exercícios.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E o tal **Director**? Ele guarda **receitas**: a sequência de passos para montar algo, sem espalhar essa coreografia pelo código.',
        'No livro do GoF, a graça era essa: o **mesmo** Director dirige builders diferentes e gera **representações diferentes** do mesmo conteúdo.',
      ],
      board: {
        title: 'Director: a receita separada dos ingredientes',
        md: `\`\`\`python
class RelatorioMarkdown:
    def __init__(self):
        self._linhas = []

    def titulo(self, texto):
        self._linhas.append(f"# {texto}")
        return self

    def item(self, rotulo, valor):
        self._linhas.append(f"- {rotulo}: {valor}")
        return self

    def build(self):
        return "\\n".join(self._linhas)


class RelatorioCSV:
    def __init__(self):
        self._linhas = ["rotulo,valor"]

    def titulo(self, texto):
        return self                          # CSV não tem título: ignora o passo

    def item(self, rotulo, valor):
        self._linhas.append(f"{rotulo},{valor}")
        return self

    def build(self):
        return "\\n".join(self._linhas)


def relatorio_de_vendas(builder, vendas):    # ← o Director
    builder.titulo("Vendas do mês")
    for produto, total in vendas.items():
        builder.item(produto, total)
    return builder.build()


vendas = {"livro": 1200, "caneca": 340}
relatorio_de_vendas(RelatorioMarkdown(), vendas)  # '# Vendas do mês\\n- livro: 1200\\n...'
relatorio_de_vendas(RelatorioCSV(), vendas)       # 'rotulo,valor\\nlivro,1200\\n...'
\`\`\`

> [!sabia] Existem **dois Builders**. O do GoF (1994) nasceu num leitor de RTF que convertia o mesmo documento para texto ASCII, TeX ou um widget editável: **um** Director, **vários** builders. O Builder **fluente**, com \`build()\` no fim, foi popularizado depois por Joshua Bloch em *Effective Java* para acabar com os construtores telescópicos. Em entrevista, saber separar os dois impressiona.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora a pergunta de sênior: **precisa mesmo** de Builder? Em Python, argumentos nomeados e `@dataclass` já eliminam o construtor telescópico.',
        'E para criar variações de um objeto imutável, `dataclasses.replace` devolve uma **cópia** com campos trocados — o chamado **wither**.',
      ],
      board: {
        title: 'Em Python, muitas vezes você não precisa de Builder',
        md: `\`\`\`python
from dataclasses import dataclass, replace


@dataclass(frozen=True, kw_only=True)
class Requisicao:
    url: str
    metodo: str = "GET"
    timeout: float = 10.0
    tentativas: int = 0

    def __post_init__(self):                   # valida em TODA criação
        if self.timeout <= 0:
            raise ValueError("timeout deve ser positivo")


base = Requisicao(url="https://api.loja.com", timeout=5)
com_retry = replace(base, tentativas=3)        # cópia com um campo trocado
print(base.tentativas, com_retry.tentativas)   # 0 3
replace(base, timeout=0)                       # ValueError: o __post_init__ roda de novo
\`\`\`

| Situação | Ferramenta |
|---|---|
| Muitos parâmetros opcionais, criação de uma vez só | argumentos nomeados, \`@dataclass(kw_only=True)\` |
| Variações de um objeto imutável | \`dataclasses.replace\` (um *wither*) |
| Partes acumuladas em etapas, validação entre campos no fim | **Builder** |
| Mesmo processo gerando formatos diferentes | **Builder + Director** |

> [!dica] *Withers* estão por toda a stdlib: \`datetime.replace(...)\`, \`Path.with_suffix(".txt")\`, \`str.replace\`. Nenhum altera o original — todos devolvem um objeto novo.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Encadear, validar, congelar — e saber quando nem precisa.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-bld-q1',
      concept: 'Interface fluente',
      say: 'Aquecimento: esse builder tem um defeito clássico. Consegue ver?',
      prompt: `O que acontece ao executar a **última linha**?

\`\`\`python
class PizzaBuilder:
    def __init__(self):
        self._sabores = []

    def sabor(self, nome):
        self._sabores.append(nome)

    def build(self):
        return tuple(self._sabores)


pizza = PizzaBuilder().sabor("calabresa").sabor("queijo").build()
\`\`\``,
      options: [
        { text: '`pizza` recebe `("calabresa", "queijo")`.', why: 'Só funcionaria se `sabor` retornasse `self`. Sem `return`, o método devolve `None`.' },
        { text: '`AttributeError: \'NoneType\' object has no attribute \'sabor\'`', correct: true, why: '`PizzaBuilder().sabor("calabresa")` devolve `None` (não há `return`), e o segundo `.sabor(...)` é chamado em `None`.' },
        { text: '`pizza` recebe `None`.', why: 'O erro acontece antes do `build()`: a segunda chamada da cadeia já é feita em `None`.' },
        { text: '`TypeError: sabor() missing 1 required positional argument`', why: 'Os argumentos estão corretos; o problema é o **valor de retorno** do método.' },
      ],
      explanation: 'Na interface fluente, **todo** método de configuração precisa terminar com `return self` — é o próprio builder que segue na cadeia. Em Python, função sem `return` devolve `None`, e `None.sabor(...)` levanta `AttributeError`. Anotar o retorno com `-> Self` (de `typing`) e rodar um type checker pega esse erro antes da execução.',
    },
    {
      type: 'mcq',
      id: 'dp-bld-q2',
      concept: 'Objeto imutável',
      say: 'Agora um bug sorrateiro: o produto é `frozen`… mas será que está seguro?',
      prompt: `O que este código imprime?

\`\`\`python
from dataclasses import dataclass

@dataclass(frozen=True)
class Relatorio:
    secoes: list

class RelatorioBuilder:
    def __init__(self):
        self._secoes = []

    def secao(self, titulo):
        self._secoes.append(titulo)
        return self

    def build(self):
        return Relatorio(self._secoes)

b = RelatorioBuilder().secao("Vendas")
r1 = b.build()
r2 = b.secao("Custos").build()
print(r1.secoes, r1 is r2)
\`\`\``,
      options: [
        { text: "`['Vendas'] False`", why: 'Seria o esperado se o `build()` copiasse a lista. Aqui, `r1.secoes` **é** a lista do builder.' },
        { text: "`['Vendas', 'Custos'] False`", correct: true, why: '`r1` e `r2` são objetos diferentes, mas os dois apontam para a **mesma lista** interna do builder, que recebeu `"Custos"` depois do primeiro `build()`.' },
        { text: '`FrozenInstanceError`', why: '`frozen=True` só impede **reatribuir** campos (`r1.secoes = ...`). Mutar a lista que o campo referencia continua permitido.' },
        { text: "`['Vendas', 'Custos'] True`", why: 'Cada `build()` cria um `Relatorio` novo, então `r1 is r2` é `False`.' },
      ],
      explanation: '`frozen=True` é imutabilidade **rasa**: protege os campos, não os objetos para os quais eles apontam. O `build()` deve **copiar e congelar** as coleções — `Relatorio(tuple(self._secoes))` — para que o builder possa ser reaproveitado sem alterar produtos já entregues.',
    },
    {
      type: 'match',
      id: 'dp-bld-q3',
      concept: 'Builder',
      say: 'Rapidinha: ligue cada peça do vocabulário à sua função.',
      prompt: 'Associe cada termo à sua descrição:',
      pairs: [
        { left: 'Construtor telescópico', right: 'Sobrecargas com cada vez mais parâmetros' },
        { left: '`return self`', right: 'Permite encadear chamadas (interface fluente)' },
        { left: '`build()`', right: 'Valida regras entre campos e entrega o produto' },
        { left: 'Director', right: 'Conhece a receita: a ordem dos passos' },
        { left: '`dataclasses.replace`', right: 'Cópia de um objeto imutável com campos trocados' },
      ],
      explanation: 'O construtor telescópico é o **problema**; `return self` e `build()` são a **mecânica** do Builder fluente; o Director guarda **receitas** reaproveitáveis; e `dataclasses.replace` é o *wither* que muitas vezes torna o Builder desnecessário em Python.',
    },
    {
      type: 'code',
      id: 'dp-bld-q4',
      concept: 'Builder',
      title: 'Builder de e-mail',
      say: 'Sua vez! Um builder de e-mail com validação no `build()` e produto imutável. Os testes ocultos vão reaproveitar o builder — cuidado com o aliasing!',
      prompt: `A classe \`Email\` (imutável) já existe. Implemente \`EmailBuilder\`, um builder **fluente** — todo método de configuração retorna \`self\`:

- \`EmailBuilder(remetente)\`;
- \`para(endereco)\` e \`cc(endereco)\` — podem ser chamados várias vezes; guardam os endereços **na ordem**, ignorando repetidos;
- \`assunto(texto)\` e \`corpo(texto)\` — o corpo é opcional (padrão \`""\`);
- \`anexo(nome_arquivo)\` — opcional; pode ser chamado várias vezes.

\`build()\` devolve um \`Email\` com **tuplas** em \`para\`, \`cc\` e \`anexos\`, e lança \`ValueError\` se:

1. não houver nenhum destinatário em \`para\`;
2. o assunto estiver vazio ou só com espaços;
3. algum endereço aparecer em \`para\` **e** em \`cc\`.

Os métodos podem ser chamados em **qualquer ordem**, e o builder pode ser **reutilizado**: e-mails já construídos nunca mudam.`,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class Email:
    remetente: str
    para: tuple
    cc: tuple
    assunto: str
    corpo: str
    anexos: tuple


class EmailBuilder:
    def __init__(self, remetente):
        pass

    def para(self, endereco):
        pass

    def cc(self, endereco):
        pass

    def assunto(self, texto):
        pass

    def corpo(self, texto):
        pass

    def anexo(self, nome_arquivo):
        pass

    def build(self):
        pass
`,
      tests: [
        { name: 'e-mail mínimo', code: 'e = EmailBuilder("lia@quest.dev").para("ana@x.com").assunto("Oi").build()\nassert e.para == ("ana@x.com",), f"para = {e.para!r}"\nassert (e.remetente, e.assunto, e.corpo, e.cc, e.anexos) == ("lia@quest.dev", "Oi", "", (), ()), repr(e)' },
        { name: 'todo método retorna self', code: 'b = EmailBuilder("lia@quest.dev")\nfor passo in (b.para("a@x.com"), b.cc("c@x.com"), b.assunto("s"), b.corpo("c"), b.anexo("f.pdf")):\n    assert passo is b, "todo método de configuração deve retornar self"' },
        { name: 'destinatários na ordem, sem repetidos', expr: 'EmailBuilder("l@q.dev").para("a@x.com").para("b@x.com").para("a@x.com").assunto("Oi").build().para', expected: '("a@x.com", "b@x.com")' },
        { name: 'sem destinatário → ValueError', code: 'try:\n    EmailBuilder("l@q.dev").assunto("Oi").build()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("build() sem destinatário deveria lançar ValueError")' },
        { name: 'assunto em branco → ValueError', code: 'try:\n    EmailBuilder("l@q.dev").para("a@x.com").assunto("   ").build()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("assunto só com espaços deveria lançar ValueError")' },
        { name: 'mesmo endereço em para e cc → ValueError', code: 'try:\n    EmailBuilder("l@q.dev").para("a@x.com").cc("a@x.com").assunto("Oi").build()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("endereço em para e cc ao mesmo tempo deveria lançar ValueError")' },
        { name: 'builder reutilizado não altera e-mails prontos', hidden: true, code: 'b = EmailBuilder("l@q.dev").para("a@x.com").assunto("Oi")\ne1 = b.build()\nb.para("b@x.com").anexo("x.pdf")\ne2 = b.build()\nassert e1.para == ("a@x.com",) and e1.anexos == (), "e1 mudou depois do build() — copie as coleções para tuplas"\nassert e2.para == ("a@x.com", "b@x.com") and e2.anexos == ("x.pdf",), repr(e2)' },
        { name: 'coleções do produto são tuplas', hidden: true, code: 'e = EmailBuilder("l@q.dev").para("a@x.com").cc("c@x.com").anexo("f.pdf").assunto("s").build()\nassert all(isinstance(v, tuple) for v in (e.para, e.cc, e.anexos)), "use tuplas no produto final"' },
        { name: 'qualquer ordem de chamadas', hidden: true, code: 'e = EmailBuilder("l@q.dev").anexo("a.pdf").assunto("Oi").corpo("texto").cc("c@x.com").para("a@x.com").build()\nassert (e.para, e.cc, e.assunto, e.corpo, e.anexos) == (("a@x.com",), ("c@x.com",), "Oi", "texto", ("a.pdf",)), repr(e)' },
        { name: 'builders independentes', hidden: true, code: 'b1 = EmailBuilder("l@q.dev").para("a@x.com")\nb2 = EmailBuilder("l@q.dev")\ntry:\n    b2.assunto("Oi").build()\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("destinatários vazaram entre builders (lista como atributo de classe?)")' },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'O builder usa `global`/`nonlocal`. O rascunho deve viver na **instância** (`self._...`) — com estado global, dois builders se atrapalham.',
          concept: 'Encapsulamento',
        },
        {
          when: (m, code) => /^ {4}\w+\s*(:[^=\n]+)?=\s*(\[\]|\{\}|list\(\)|dict\(\)|set\(\))/m.test(code),
          text: 'Há uma coleção criada como **atributo de classe** (no corpo da classe, fora dos métodos). Ela é compartilhada por **todas** as instâncias — crie as listas no `__init__`.',
          concept: 'Atributo de classe × de instância',
        },
      ],
      hints: [
        'No `__init__`, crie o rascunho: `self._para = []`, `self._cc = []`, `self._anexos = []`, `self._assunto = ""`, `self._corpo = ""`. E todo método termina com `return self`.',
        'Para ignorar repetidos mantendo a ordem: `if endereco not in self._para: self._para.append(endereco)`.',
        'No `build()`, valide primeiro (`if not self._para`, `if not self._assunto.strip()`, `set(self._para) & set(self._cc)`) e só então crie o `Email` com `tuple(...)` — a tupla é uma **cópia** congelada.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class Email:
    remetente: str
    para: tuple
    cc: tuple
    assunto: str
    corpo: str
    anexos: tuple


class EmailBuilder:
    def __init__(self, remetente):
        self._remetente = remetente
        self._para = []
        self._cc = []
        self._assunto = ""
        self._corpo = ""
        self._anexos = []

    def para(self, endereco):
        if endereco not in self._para:
            self._para.append(endereco)
        return self

    def cc(self, endereco):
        if endereco not in self._cc:
            self._cc.append(endereco)
        return self

    def assunto(self, texto):
        self._assunto = texto
        return self

    def corpo(self, texto):
        self._corpo = texto
        return self

    def anexo(self, nome_arquivo):
        self._anexos.append(nome_arquivo)
        return self

    def build(self):
        if not self._para:
            raise ValueError("informe ao menos um destinatário")
        if not self._assunto.strip():
            raise ValueError("o assunto não pode ficar vazio")
        repetidos = set(self._para) & set(self._cc)
        if repetidos:
            raise ValueError(f"em para e cc ao mesmo tempo: {sorted(repetidos)}")
        return Email(
            remetente=self._remetente,
            para=tuple(self._para),
            cc=tuple(self._cc),
            assunto=self._assunto,
            corpo=self._corpo,
            anexos=tuple(self._anexos),
        )
`,
      solutionExplanation: 'O builder guarda um **rascunho mutável** (listas criadas no `__init__`, uma por instância) e cada passo devolve `self` para permitir o encadeamento. Como os passos podem vir em qualquer ordem, a regra que cruza campos (`para` × `cc`) só pode ser checada no `build()`. Ao converter as listas com `tuple(...)`, o produto recebe **cópias imutáveis**: reaproveitar o builder não altera e-mails já construídos — e o `frozen=True` do `Email` impede reatribuir campos.',
    },
    {
      type: 'open',
      id: 'dp-bld-q5',
      concept: 'Builder',
      say: 'Pergunta de entrevista para fechar: quando o Builder se paga?',
      prompt: 'Em Python, quando você usaria um **Builder** e quando argumentos nomeados, `@dataclass` ou `dataclasses.replace` já resolvem? Justifique.',
      minWords: 15,
      rubric: [
        { label: 'Reconhece que **argumentos nomeados/dataclass** resolvem muitos parâmetros opcionais', keywords: ['nomeado', 'keyword', 'kwargs', 'kw_only', 'dataclass', 'valor padrao', 'valores padrao', 'default', 'replace'], concept: 'Argumentos nomeados', why: 'Em Python, nomes e valores padrão já eliminam o construtor telescópico.' },
        { label: 'Usa Builder quando a construção é **em etapas** / incremental', keywords: ['etapa', 'passo a passo', 'passos', 'increment', 'aos poucos', 'acumul', 'loop', 'varias chamadas', 'gradual', 'partes'], concept: 'Builder', why: 'O Builder brilha quando as partes chegam aos poucos, de lugares diferentes.' },
        { label: 'Cita **validação** no `build()` (regras entre campos)', keywords: ['valid', 'invariant', 'regra', 'consisten', 'entre campos'], concept: 'Validação no build()', why: 'Só no fim, com todas as partes informadas, dá para checar regras que cruzam campos.' },
        { label: 'Menciona produto **imutável** ou **representações diferentes** (Director)', keywords: ['imut', 'frozen', 'congela', 'representac', 'director', 'diretor', 'receita', 'formatos diferentes'], concept: 'Objeto imutável', why: 'O builder é o rascunho mutável; o produto sai pronto e imutável — ou em formatos diferentes, com um Director.' },
      ],
      modelAnswer: `Para a maioria dos objetos com muitos parâmetros opcionais, eu **não** usaria Builder: em Python, **argumentos nomeados** com valores padrão (e \`*\` para torná-los somente-nomeados) ou uma \`@dataclass(frozen=True, kw_only=True)\` já resolvem o construtor telescópico, e \`dataclasses.replace\` cria variações de um objeto imutável.

O Builder se paga quando a construção acontece **em etapas**: partes acumuladas aos poucos (em loops, vindas de várias fontes), métodos chamados várias vezes (\`header()\`, \`anexo()\`) e **validações entre campos** que só fazem sentido no \`build()\`, quando tudo já foi informado.

Ele também ajuda a entregar um produto **imutável** a partir de um rascunho mutável e, com um **Director**, a reaproveitar a mesma receita para gerar representações diferentes (Markdown, CSV…).`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Mandou bem! O Builder separa **configurar** de **montar**: passos encadeados com `return self`, validação no `build()` e um produto imutável no fim.',
        'E lembre: em Python, argumentos nomeados e dataclasses resolvem muita coisa. Próximo criacional: **Prototype** — criar objetos clonando outros!',
      ],
      board: null,
    },
  ],
});
