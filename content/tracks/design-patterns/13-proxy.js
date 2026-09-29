(function () {
  // Classes dadas no código inicial (e repetidas na solução).
  const BASE = `class Documento:
    def __init__(self, titulo, texto):
        self.titulo = titulo
        self.texto = texto
        self.versao = 1

    def ler(self):
        return self.texto

    def editar(self, texto):
        self.texto = texto
        self.versao += 1
        return self.versao


class Usuario:
    def __init__(self, nome, papel):
        self.nome = nome
        self.papel = papel
`;

  // Fábrica "espiã" dos testes: registra cada carga do documento real em `cargas`.
  const SETUP = `cargas = []

def fabrica():
    cargas.append(1)
    return Documento("Contrato", "v1")
`;

  Game.registerModule('design-patterns', {
    id: 'proxy',
    title: 'Proxy',
    kind: 'lesson',
    level: 2,
    order: 23,
    unit: 'estruturais',
    summary: 'Um substituto com a mesma interface que decide se, quando e como o objeto real é usado: lazy, permissões, cache e chamadas remotas.',
    concepts: ['Proxy', 'Proxy virtual (lazy)', 'Proxy de proteção', 'Delegação com __getattr__', 'cached_property'],
    takeaways: [
      'Um **Proxy** tem a **mesma interface** do objeto real e controla o acesso a ele: decide *se*, *quando* e *como* a chamada chega lá.',
      'Sabores clássicos: **virtual** (adia a criação cara), **de proteção** (checa permissão antes), **de cache** (reaproveita respostas) e **remoto** (esconde a rede — mas ela continua lá).',
      '`__getattr__` só roda quando a busca normal falha: ótimo para delegar o resto, mas **não intercepta dunders** (`len(proxy)` falha) e recursa se um atributo interno ainda não existir.',
      '`functools.cached_property` é um proxy virtual de um atributo só: calcula no 1º acesso e grava o valor no `__dict__` da instância.',
      'Proxy e Decorator têm a mesma estrutura; muda a **intenção**: controlar o acesso (e o ciclo de vida do real) × adicionar comportamento. O Adapter é o que **muda** a interface.',
    ],
    glossary: [
      { term: 'Proxy', aliases: ['proxies', 'padrão Proxy'], definition: 'Objeto intermediário com a **mesma interface** do objeto real, que controla o acesso a ele: adia a criação, checa permissões, cacheia ou representa algo remoto. Um *reverse proxy* HTTP aplica a mesma ideia a servidores.' },
      { term: 'Proxy virtual', aliases: ['virtual proxy', 'proxy preguiçoso', 'lazy proxy'], definition: 'Proxy que adia a criação de um objeto caro até o primeiro uso de verdade — e, se ninguém usar, ele nunca é criado.' },
      { term: 'Proxy de proteção', aliases: ['protection proxy', 'proxies de proteção'], definition: 'Proxy que verifica permissões antes de repassar a chamada ao objeto real, que fica livre da lógica de autorização.' },
      { term: 'Proxy remoto', aliases: ['remote proxy', 'proxies remotos'], definition: 'Representante local de um objeto que vive em outro processo ou máquina: transforma chamadas de método em mensagens de rede (ex.: `xmlrpc.client.ServerProxy`, stubs gRPC).' },
      { term: 'cached_property', aliases: ['functools.cached_property'], definition: 'Decorator da stdlib que calcula um atributo no primeiro acesso e grava o valor no `__dict__` da instância; os acessos seguintes nem chamam a função. `del obj.atributo` invalida o cache.' },
      { term: 'Ghost', aliases: ['ghost object', 'objeto fantasma', 'objetos fantasmas'], definition: 'Variante de *lazy load* descrita por Martin Fowler: o objeto já existe com a identidade (o id), mas só carrega os demais campos no primeiro acesso a qualquer um deles.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de um padrão que você usa todo dia sem perceber: o **Proxy**.',
          'Um proxy é um **substituto**: tem a mesma interface do objeto real e fica na frente dele, decidindo *se*, *quando* e *como* a chamada chega lá.',
        ],
        board: {
          title: 'Proxy — padrão estrutural',
          md: `**Problema:** às vezes você precisa **controlar o acesso** a um objeto sem que o cliente perceba:

- o objeto é **caro** de criar e talvez nem seja usado;
- nem todo usuário **pode** chamar todos os métodos;
- a mesma pergunta chega mil vezes e a resposta **quase não muda**;
- o objeto vive **em outra máquina**.

**Solução:** um substituto com a **mesma interface**, no meio do caminho:

\`\`\`text
Cliente ──► Proxy ─────────────► Objeto real
            mesma interface      (o "RealSubject" do GoF)
            decide SE, QUANDO e COMO
            a chamada chega lá
\`\`\`

| Sabor | O que o proxy controla | Exemplo |
|---|---|---|
| **Virtual** | *Quando* o objeto caro nasce | carregar a imagem só ao exibir |
| **De proteção** | *Quem* pode chamar | só \`admin\` chama \`excluir()\` |
| **De cache** | *Se* precisa chamar de novo | cotação guardada por 60 s |
| **Remoto** | *Onde* o objeto está | cliente RPC, stub gRPC |

> [!dica] O cliente não deveria saber se fala com o proxy ou com o real. Se ele precisa saber, você não tem um proxy — tem outra interface.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Começando pelo **proxy virtual**: imagine uma galeria com mil fotos em alta resolução. Carregar todas na abertura travaria a tela.',
          'O proxy guarda só o caminho e cria o objeto real **no primeiro uso**. Foto que ninguém abre nunca é carregada.',
        ],
        board: {
          title: 'Proxy virtual (lazy loading)',
          md: `\`\`\`python
class ImagemReal:
    def __init__(self, caminho):
        self.caminho = caminho
        self.pixels = ler_do_disco(caminho)     # lento e pesado!

    def exibir(self):
        return f"exibindo {self.caminho}"


class ImagemProxy:                              # mesma interface: exibir()
    def __init__(self, caminho):
        self.caminho = caminho
        self._real = None                       # nada carregado ainda

    def exibir(self):
        if self._real is None:                  # 1º uso: cria o real
            self._real = ImagemReal(self.caminho)
        return self._real.exibir()              # e delega


galeria = [ImagemProxy(f"foto{i}.png") for i in range(1000)]   # instantâneo
galeria[42].exibir()                            # só a foto 42 é lida do disco
\`\`\`

> [!sabia] Martin Fowler descreve quatro sabores de *lazy load*: *lazy initialization*, **virtual proxy**, *value holder* e **ghost** — um objeto "fantasma" que já nasce com o id, mas só busca os outros campos no primeiro acesso. ORMs fazem isso o tempo todo. No Django, \`request.user\` é um \`SimpleLazyObject\`: a consulta ao usuário só acontece se alguém tocar nele.`,
        },
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'O **proxy de proteção** checa permissões antes de repassar. O objeto real fica livre de regras de acesso.',
          'E o **proxy de cache** responde sozinho quando já sabe a resposta. Repare no relógio **injetado**: sem ele, testar a expiração exigiria esperar de verdade.',
        ],
        board: {
          title: 'Proxy de proteção e proxy de cache',
          code: `import time


class ContaProtegida:                           # proxy de PROTEÇÃO
    def __init__(self, conta, usuario):
        self._conta, self._usuario = conta, usuario

    def saldo(self):
        return self._conta.saldo()              # leitura: liberada

    def sacar(self, valor):
        if self._usuario.papel != "titular":
            raise PermissionError("só o titular pode sacar")
        return self._conta.sacar(valor)         # autorizado: delega


class CotacaoComCache:                          # proxy de CACHE
    def __init__(self, servico, ttl=60, relogio=time.monotonic):
        self._servico, self._ttl = servico, ttl
        self._relogio = relogio                 # injetado → testável
        self._cache = {}                        # moeda -> (valor, expira_em)

    def cotacao(self, moeda):                   # MESMA interface do serviço
        agora = self._relogio()
        if moeda in self._cache:
            valor, expira_em = self._cache[moeda]
            if agora < expira_em:
                return valor                    # hit: nem toca no serviço
        valor = self._servico.cotacao(moeda)    # miss ou expirado
        self._cache[moeda] = (valor, agora + self._ttl)
        return valor`,
          caption: 'O objeto real não sabe nada de permissões nem de cache: cada preocupação mora no seu proxy (responsabilidade única).',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Escrever um método de delegação para cada método do real cansa. Em Python, `__getattr__` resolve: ele só é chamado quando o atributo **não existe** no proxy.',
          { text: 'Mas ele tem duas pegadinhas que derrubam muita gente em entrevista. Olha o quadro com calma.', mood: 'concerned' },
        ],
        board: {
          title: 'Delegação genérica com __getattr__',
          md: `\`\`\`python
class ProxyComLog:
    def __init__(self, alvo):
        self._alvo = alvo
        self.chamadas = []

    def __getattr__(self, nome):     # só roda se o proxy NÃO tem esse atributo
        attr = getattr(self._alvo, nome)
        if callable(attr):
            def registrado(*args, **kwargs):
                self.chamadas.append(nome)
                return attr(*args, **kwargs)
            return registrado
        return attr


nums = ProxyComLog([3, 1, 2])
nums.append(0)
nums.sort()
nums.chamadas     # ['append', 'sort'] — delegado e registrado
len(nums)         # TypeError: object of type 'ProxyComLog' has no len()
\`\`\`

**Pegadinha 1 — dunders pulam o \`__getattr__\`.** \`len()\`, \`+\`, \`==\`, \`in\`, \`for\` e \`with\` procuram o método especial **no tipo**, não na instância. Um proxy genérico precisa declarar \`__len__\`, \`__iter__\`, \`__eq__\`… explicitamente.

**Pegadinha 2 — recursão infinita.** \`copy.copy\` e \`pickle\` recriam o objeto **sem** chamar o \`__init__\`. Aí \`self._alvo\` não existe, o \`__getattr__\` é chamado para buscá-lo… e chama a si mesmo até o \`RecursionError\`. Proteja-se:

\`\`\`python
    def __getattr__(self, nome):
        if nome.startswith("_"):          # internos nunca são delegados
            raise AttributeError(nome)
        return getattr(self._alvo, nome)
\`\`\``,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Dois proxies que já vêm prontos no Python: o **proxy remoto** do `xmlrpc` e o `cached_property`.',
          'O remoto faz uma chamada de rede parecer uma chamada de método comum — e é aí que mora o perigo.',
        ],
        board: {
          title: 'Proxy remoto e cached_property',
          md: `**Proxy remoto:** o objeto local finge ser o serviço; cada método vira uma mensagem de rede.

\`\`\`python
from xmlrpc.client import ServerProxy

estoque = ServerProxy("http://estoque.interno:8000")
estoque.reservar(42, 3)      # parece local... mas é um POST HTTP!
\`\`\`

> [!atencao] Esconder a rede não a torna confiável: cada chamada pode demorar, falhar ou ter efeito sem resposta. Evite interfaces "tagarelas" (*chatty*): um \`reservar_lote(itens)\` é melhor que 50 chamadas de \`reservar()\`.

**\`functools.cached_property\`:** um proxy virtual para **um atributo**.

\`\`\`python
from functools import cached_property

class Relatorio:
    def __init__(self, vendas):
        self.vendas = vendas

    @cached_property
    def total(self):              # roda só no 1º acesso
        print("calculando...")
        return sum(self.vendas)

r = Relatorio([10, 20, 30])
r.total      # calculando... → 60
r.total      # 60, lido direto de r.__dict__
del r.total  # invalida: o próximo acesso recalcula
\`\`\`

> [!sabia] O \`cached_property\` é um **descritor não-de-dados** (só tem \`__get__\`): depois do 1º acesso, o valor gravado no \`__dict__\` da instância tem prioridade e o descritor nem é mais chamado. Por isso ele exige \`__dict__\` e não funciona em classes só com \`__slots__\`. E até o Python 3.11 ele tinha um *lock* **por propriedade** — compartilhado por todas as instâncias — que virava gargalo com threads; foi removido no 3.12.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora a pergunta que aparece em toda entrevista: se Proxy e Decorator têm a mesma cara, qual a diferença?',
          'A resposta está na **intenção** — e em quem manda no objeto real.',
        ],
        board: {
          title: 'Proxy × Decorator × Adapter',
          md: `| | **Proxy** | **Decorator** | **Adapter** |
|---|---|---|---|
| Interface | A **mesma** do real | A **mesma** do real | **Outra**: a que o cliente espera |
| Intenção | **Controlar o acesso** | **Adicionar** comportamento | **Compatibilizar** interfaces |
| Objeto real | Muitas vezes o proxy **cria e gerencia** (pode nunca criar) | Recebe pronto do cliente | Recebe pronto |
| Empilhar? | Raro | É o normal: \`ComLeite(ComCanela(cafe))\` | Raro |
| Exemplos | carga lazy, permissão, cache, RPC | log, métricas, retry | SDK de pagamento → \`pagar()\` |

> [!dica] Frase para a entrevista: *"Decorator e Proxy têm a mesma estrutura. O Decorator **acrescenta responsabilidades** e é empilhado pelo cliente; o Proxy **controla o acesso** ao objeto — muitas vezes decidindo quando ele nasce. O Adapter é o único dos três que **muda a interface**."*`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Adiar, proteger, delegar — e não cair nas pegadinhas.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'dp-prx-q1',
        concept: 'Proxy virtual',
        say: 'Primeiro, um caso real. Qual solução mexe menos no resto do sistema?',
        prompt: 'O `ClienteERP` abre conexão e baixa 50 MB de catálogo **no construtor**, mas em 90% das requisições ninguém chama nenhum método dele. Você não pode alterar essa classe. Qual solução ataca o problema com **menos impacto** no resto do código?',
        options: [
          { text: 'Um **proxy virtual** com a mesma interface, que só cria o `ClienteERP` na primeira chamada de método.', correct: true, why: 'Adia o custo para quando (e se) ele for necessário, e os chamadores nem percebem a troca.' },
          { text: 'Um **proxy de proteção** que verifica se o usuário pode usar o ERP.', why: 'Proteção controla **quem** acessa, não **quando** o objeto caro é criado.' },
          { text: 'Um **Adapter** que converte a interface do `ClienteERP`.', why: 'Não há incompatibilidade de interface; o problema é o custo de criação.' },
          { text: 'Transformar o `ClienteERP` num **Singleton** criado na inicialização da aplicação.', why: 'O custo continua sendo pago sempre (só que uma vez, no boot) e ainda entra estado global — em 90% das requisições o objeto nem seria usado.' },
        ],
        explanation: 'Proxy virtual = *lazy loading* atrás da **mesma interface**: o custo só é pago no primeiro uso real e, se ninguém usar, nunca é pago. Em Python, para um único atributo caro, `functools.cached_property` resolve; para um objeto inteiro, um proxy com `__getattr__` delega todo o resto.',
      },
      {
        type: 'match',
        id: 'dp-prx-q2',
        concept: 'Proxy',
        say: 'Rodada rápida: cada sabor de proxy com a situação que ele resolve.',
        prompt: 'Associe cada tipo de proxy à situação em que ele é a ferramenta certa.',
        pairs: [
          { left: 'Proxy virtual', right: 'Carregar o PDF de 200 páginas só quando alguém abrir a pré-visualização' },
          { left: 'Proxy de proteção', right: 'Só quem tem papel `admin` pode chamar `excluir()`' },
          { left: 'Proxy de cache', right: 'Responder a mesma cotação por 60 s sem chamar a API de novo' },
          { left: 'Proxy remoto', right: '`estoque.reservar(42)` vira uma requisição HTTP para outro serviço' },
          { left: '`weakref.proxy`', right: 'Referenciar um objeto sem impedir que o coletor de lixo o libere' },
        ],
        explanation: 'Todos têm a **mesma interface** do objeto real; o que muda é o que o proxy controla: *quando* criar (virtual), *quem* chama (proteção), *se* precisa chamar (cache), *onde* o objeto está (remoto). O `weakref.proxy` da stdlib é um proxy que **não** mantém o objeto vivo: se o original for coletado, usar o proxy lança `ReferenceError`.',
      },
      {
        type: 'mcq',
        id: 'dp-prx-q3',
        concept: 'Delegação com __getattr__',
        say: 'Agora uma pegadinha clássica. Leia o código com atenção…',
        prompt: `O que acontece ao executar este código?

\`\`\`python
class Proxy:
    def __init__(self, alvo):
        self._alvo = alvo

    def __getattr__(self, nome):
        return getattr(self._alvo, nome)

p = Proxy([10, 20, 30])
print(p.count(20))
print(len(p))
\`\`\``,
        options: [
          { text: 'Imprime `1` e depois lança `TypeError`: `len()` procura `__len__` no **tipo** `Proxy`, e o `__getattr__` não é consultado.', correct: true, why: 'Funções embutidas e operadores fazem a busca implícita de métodos especiais direto na classe, pulando a instância e o `__getattr__`.' },
          { text: 'Imprime `1` e `3`: o `__getattr__` delega o `__len__` para a lista.', why: 'Chamar `p.__len__()` **explicitamente** funcionaria (passa pelo `__getattr__`), mas `len(p)` busca `__len__` direto em `type(p)`, que não o define.' },
          { text: 'Lança `RecursionError` já no `p.count(20)`.', why: 'A recursão só aconteceria se `_alvo` não existisse (ex.: objeto criado por `copy`/`pickle` sem `__init__`); aqui ele foi definido no construtor.' },
          { text: 'Lança `AttributeError` em `p.count(20)`, porque `count` não está definido em `Proxy`.', why: 'É justamente o caso em que o `__getattr__` entra: a busca normal falha e ele delega para a lista.' },
        ],
        explanation: 'Operadores e funções embutidas (`len`, `+`, `==`, `in`, `iter`, `with`…) procuram os métodos especiais **no tipo** — é a *busca implícita de métodos especiais*. Proxies genéricos precisam declarar os dunders que querem repassar. É por isso que o `unittest.mock` tem o `MagicMock` além do `Mock`: ele já vem com os métodos mágicos configurados.',
      },
      {
        type: 'code',
        id: 'dp-prx-q4',
        concept: 'Proxy virtual',
        title: 'Documento preguiçoso e protegido',
        say: 'Hora de escrever um proxy de verdade — virtual **e** de proteção ao mesmo tempo.',
        prompt: `Um \`Documento\` é caro de carregar (vem do banco). Implemente \`DocumentoProxy(fabrica, usuario)\`, um proxy **virtual** e **de proteção**:

- \`fabrica\` é uma função sem argumentos que devolve o \`Documento\` real. **Não** a chame no construtor: só no primeiro uso — e **uma única vez**;
- \`ler()\` é liberado para qualquer usuário;
- \`editar(texto)\` só para \`usuario.papel\` igual a \`"editor"\` ou \`"admin"\`; senão, lance \`PermissionError\` **sem carregar** o documento;
- qualquer outro atributo (\`titulo\`, \`versao\`…) é **delegado** ao documento real via \`__getattr__\`; atributo inexistente continua lançando \`AttributeError\`.

\`Documento\` e \`Usuario\` já estão no código inicial. Nos testes, a \`fabrica\` registra cada carga numa lista \`cargas\`.`,
        starter: `${BASE}

class DocumentoProxy:
    def __init__(self, fabrica, usuario):
        pass

    def ler(self):
        pass

    def editar(self, texto):
        pass

    def __getattr__(self, nome):
        pass
`,
        tests: [
          { name: 'criar o proxy não carrega nada', setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("ana", "leitor"))
assert cargas == [], "a fábrica foi chamada no construtor — o proxy virtual deve adiar a carga"` },
          { name: 'ler() carrega uma única vez', setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("ana", "leitor"))
assert p.ler() == "v1"
assert p.ler() == "v1"
assert len(cargas) == 1, f"a fábrica foi chamada {len(cargas)} vezes"` },
          { name: 'leitor não edita (e nada é carregado)', setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("ana", "leitor"))
try:
    p.editar("v2")
except PermissionError:
    pass
else:
    raise AssertionError("um leitor conseguiu editar")
assert cargas == [], "cheque a permissão ANTES de carregar o documento"` },
          { name: 'editor edita', setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("bia", "editor"))
assert p.editar("v2") == 2
assert p.ler() == "v2"
assert len(cargas) == 1` },
          { name: 'outros atributos são delegados', setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("ana", "leitor"))
assert p.titulo == "Contrato", f"titulo = {p.titulo!r}"
assert len(cargas) == 1` },
          { name: 'admin também edita', hidden: true, setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("caio", "admin"))
p.editar("x")
assert p.ler() == "x" and p.versao == 2
assert len(cargas) == 1` },
          { name: 'atributo inexistente → AttributeError', hidden: true, setup: SETUP, code: `p = DocumentoProxy(fabrica, Usuario("ana", "leitor"))
try:
    p.nao_existe
except AttributeError:
    pass
else:
    raise AssertionError("atributo inexistente deveria lançar AttributeError")` },
          { name: 'cada proxy tem o seu documento', hidden: true, setup: SETUP, code: `a = DocumentoProxy(fabrica, Usuario("a", "admin"))
b = DocumentoProxy(fabrica, Usuario("b", "leitor"))
a.editar("novo")
assert b.ler() == "v1", "o documento carregado não pode ser compartilhado entre proxies"
assert len(cargas) == 2` },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => c.name === 'DocumentoProxy' && c.bases.includes('Documento')),
            text: 'Seu proxy **herda** de `Documento`. Assim ele carrega o estado de um documento que nem deveria existir ainda, e fica amarrado a essa classe concreta. Proxy é **composição**: guarde o real (criado pela fábrica) e delegue.',
            concept: 'Composição > herança',
          },
          {
            when: m => !m.classes.some(c => c.name === 'DocumentoProxy' && c.methods.includes('__getattr__')),
            text: 'Você delegou atributo por atributo. Funciona, mas cada campo novo do `Documento` exigiria mexer no proxy. O `__getattr__` só é chamado para o que o proxy **não** define — delega todo o resto de uma vez.',
            concept: 'Delegação com __getattr__',
          },
          {
            when: (m, code) => m.classes.some(c => c.methods.includes('__getattr__')) && !/startswith\(\s*["']_/.test(code),
            text: 'Seu `__getattr__` delega **qualquer** nome, inclusive `_real` e `_fabrica`. Se o objeto for recriado sem `__init__` (`copy.copy`, `pickle`), acessar `self._real` chama o `__getattr__`, que acessa `self._real`… `RecursionError`. Um guard `if nome.startswith("_"): raise AttributeError(nome)` evita isso.',
            concept: 'Delegação com __getattr__',
          },
        ],
        hints: [
          'No `__init__`, guarde `fabrica` e `usuario` e comece com `self._real = None` — nada de chamar a fábrica aqui.',
          'Crie um método auxiliar `_obter()`: se `self._real is None`, chama a fábrica; depois devolve `self._real`. Use-o em `ler`, `editar` e `__getattr__`.',
          'Em `editar`, cheque o papel **antes** de chamar `_obter()`. No `__getattr__`, recuse nomes que começam com `_` e faça `return getattr(self._obter(), nome)`.',
        ],
        solution: `${BASE}

class DocumentoProxy:
    PAPEIS_EDITORES = {"editor", "admin"}

    def __init__(self, fabrica, usuario):
        self._fabrica = fabrica
        self._usuario = usuario
        self._real = None                      # proxy virtual: nada carregado

    def _obter(self):
        if self._real is None:
            self._real = self._fabrica()       # 1º uso: carrega uma única vez
        return self._real

    def ler(self):
        return self._obter().ler()

    def editar(self, texto):
        if self._usuario.papel not in self.PAPEIS_EDITORES:   # proteção primeiro
            raise PermissionError(f"{self._usuario.nome} não pode editar")
        return self._obter().editar(texto)

    def __getattr__(self, nome):
        # só chega aqui o que o proxy NÃO define
        if nome.startswith("_"):
            raise AttributeError(nome)         # evita recursão e não expõe internos
        return getattr(self._obter(), nome)
`,
        solutionExplanation: 'O proxy guarda a **fábrica** em vez do documento e só a chama em `_obter()`, na primeira necessidade (proxy virtual). Em `editar`, a permissão é checada **antes** de carregar — negar acesso não custa uma ida ao banco (proxy de proteção). O `__getattr__` delega todo o resto (`titulo`, `versao`…) sem listar campo por campo, e o guard para nomes com `_` evita a recursão infinita quando o objeto é copiado ou desserializado sem passar pelo `__init__`.',
      },
      {
        type: 'open',
        id: 'dp-prx-q5',
        concept: 'Proxy',
        say: 'Última, estilo entrevista: explique a diferença como se estivesse na lousa.',
        prompt: 'Proxy e Decorator têm estrutura quase idêntica: um objeto com a mesma interface que embrulha outro e delega. Como você explicaria a **diferença** entre eles numa entrevista — e onde entra o **Adapter**?',
        minWords: 25,
        rubric: [
          { label: 'Proxy **controla o acesso** (se/quando/quem chama o real)', keywords: ['control', 'acesso', 'permiss', 'proteg', 'lazy', 'preguic', 'adia', 'cache', 'restring'], concept: 'Proxy', why: 'A intenção do Proxy é ser um porteiro: decidir se, quando e como a chamada chega ao objeto real.' },
          { label: 'Decorator **adiciona comportamento/responsabilidades** (e é empilhável)', keywords: ['adiciona', 'acrescent', 'responsabilidad', 'funcionalidad', 'empilh', 'novo comportamento', 'comportamento extra', 'enriquec', 'estende', 'estender'], concept: 'Decorator (GoF)', why: 'O Decorator existe para somar comportamento, e o cliente costuma compor vários em camadas.' },
          { label: 'Proxy costuma **gerenciar o ciclo de vida** do real (cria, adia ou nunca cria)', keywords: ['ciclo de vida', 'cria o objeto', 'cria o real', 'criar o objeto', 'criar o real', 'instancia', 'nunca cria', 'sob demanda', 'lifecycle', 'gerencia', 'recebe pronto'], concept: 'Proxy virtual', why: 'O Decorator recebe o objeto pronto; o Proxy muitas vezes é quem decide quando (e se) ele nasce.' },
          { label: 'Adapter **muda a interface** (converte); os outros dois mantêm a mesma', keywords: ['interface diferente', 'outra interface', 'converte', 'convert', 'traduz', 'compatibiliz', 'incompativ', 'muda a interface', 'mudar a interface'], concept: 'Adapter', why: 'Dos três, só o Adapter expõe uma interface diferente da do objeto embrulhado.' },
        ],
        modelAnswer: `Os três embrulham um objeto e delegam, mas com **intenções** diferentes:

- **Proxy** tem a **mesma interface** do real e **controla o acesso** a ele: adia a criação (lazy), checa permissão, cacheia respostas ou esconde a rede. Muitas vezes o proxy **gerencia o ciclo de vida** do objeto real — cria sob demanda ou nunca cria.
- **Decorator** também mantém a mesma interface, mas existe para **adicionar comportamento/responsabilidades** (log, métricas, retry). Ele recebe o objeto pronto e é comum **empilhar** vários.
- **Adapter** é o único que **muda a interface**: **converte** a interface existente na que o cliente espera, para compatibilizar código incompatível.

Resumindo: Proxy controla, Decorator acrescenta, Adapter traduz.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Proxy é o porteiro: mesma interface, mas decide **se**, **quando** e **como** a chamada chega ao objeto real.',
          'Guarde os sabores — virtual, proteção, cache e remoto —, as pegadinhas do `__getattr__` e a diferença de intenção para o Decorator. Próximo: **Composite**!',
        ],
        board: null,
      },
    ],
  });
})();
