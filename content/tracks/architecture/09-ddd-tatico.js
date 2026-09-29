Game.registerModule('architecture', {
  id: 'ddd-tatico',
  title: 'DDD Tático',
  kind: 'lesson',
  level: 2,
  order: 21,
  unit: 'ddd',
  summary: 'Entities, Value Objects, Aggregates, Repositories e Domain Events — modelando regras de negócio em Python.',
  concepts: ['Entity', 'Value Object', 'Aggregate', 'Repository', 'Domain Event', 'Modelo rico'],
  takeaways: [
    '**Entity** tem identidade e ciclo de vida; **Value Object** é definido pelos valores — imutável, validado na criação e comparado por `==`.',
    'O **agregado** é uma unidade de consistência: todo acesso passa pela **raiz**, que protege as invariantes; outros agregados são referenciados **pelo id**.',
    'Prefira agregados **pequenos**: uma transação altera **um** agregado; entre agregados, **eventos de domínio** e consistência eventual.',
    'Modelo **rico**, não anêmico: comportamento e regras moram no objeto de domínio, e não em services cheios de setters.',
    'Em Python: `@dataclass(frozen=True)` + `__post_init__` para value objects; coleções internas saem como **tupla**, sem porta dos fundos.',
  ],
  glossary: [
    { term: 'Entity', aliases: ['entities', 'entidade de domínio', 'entidades de domínio'], definition: 'Objeto de domínio definido pela **identidade**: muda ao longo do tempo e continua sendo "o mesmo" (Cliente, Pedido, Conta). Dois objetos com os mesmos dados e ids diferentes são entidades diferentes.' },
    { term: 'Value Object', aliases: ['value objects', 'objeto de valor', 'objetos de valor'], definition: 'Objeto definido pelos seus **valores**, sem identidade própria: imutável, validado na criação e comparado por igualdade de atributos (Dinheiro, Endereço, Período). Para "mudar", cria-se outro.' },
    { term: 'Aggregate', aliases: ['aggregates', 'agregado', 'agregados', 'aggregate root', 'raiz do agregado'], definition: 'Grupo de objetos tratado como **uma unidade de consistência**, com uma **raiz** que é a única porta de entrada e protege as invariantes. Uma transação altera um agregado; entre agregados, a consistência é eventual.' },
    { term: 'Invariante', aliases: ['invariantes', 'invariant', 'invariants'], definition: 'Condição que precisa ser **sempre** verdadeira — no domínio, uma regra como "pedido confirmado não muda". Em DDD, quem a protege é a raiz de um agregado, e o conjunto de invariantes define a fronteira dele.' },
    { term: 'Domain Event', aliases: ['domain events', 'evento de domínio', 'eventos de domínio'], definition: 'Fato relevante que **já aconteceu** no domínio, nomeado no passado (`PedidoConfirmado`) e imutável. O agregado o registra; depois de salvo, ele é publicado para outros agregados e contextos reagirem.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Com as fronteiras definidas, vamos para **dentro** de um bounded context: o DDD **tático**.',
        'O primeiro par de conceitos é a diferença entre **Entity** e **Value Object**. A pergunta-chave é: *o que importa, a identidade ou o valor?*',
      ],
      board: {
        title: 'Entity × Value Object',
        md: `| | **Entity** | **Value Object** |
|---|---|---|
| Igualdade | Pela **identidade** (id) | Pelos **valores** dos atributos |
| Ciclo de vida | Muda ao longo do tempo, continua sendo "a mesma" | **Imutável** — para "mudar", cria outro |
| Exemplos | Cliente, Pedido, Conta | Dinheiro, Endereço, CPF, Período |

> [!dica] Duas notas de R$ 10 são intercambiáveis: dinheiro é **value object**. Dois clientes chamados "Ana Souza" continuam sendo pessoas diferentes: cliente é **entity**.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Em Python, value objects ficam elegantes com `@dataclass(frozen=True)`: imutáveis, com `==` por valor e hashable de graça.',
        'E a validação vai no `__post_init__`: um value object **nunca existe em estado inválido**. Se alguém tentar criar um e-mail sem "@", a construção falha.',
      ],
      board: {
        title: 'Entity e Value Object em Python',
        code: `from dataclasses import dataclass


@dataclass(frozen=True)
class Email:                      # Value Object
    endereco: str

    def __post_init__(self):
        if "@" not in self.endereco:
            raise ValueError(f"e-mail inválido: {self.endereco}")


class Cliente:                    # Entity
    def __init__(self, cliente_id: str, email: Email):
        self.id = cliente_id
        self.email = email

    def trocar_email(self, novo: Email):
        self.email = novo         # a entidade muda; o VO é substituído

    def __eq__(self, outro):
        return isinstance(outro, Cliente) and self.id == outro.id

    def __hash__(self):
        return hash(self.id)


print(Email("a@x.com") == Email("a@x.com"))   # True  — igualdade por valor
print(Cliente("1", Email("a@x.com")) == Cliente("2", Email("a@x.com")))  # False`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora o conceito mais importante do DDD tático: o **Aggregate**.',
        'Um agregado é um grupo de objetos tratados como **uma unidade de consistência**. Ele tem uma **raiz** — a única porta de entrada. Ninguém mexe nos objetos internos diretamente.',
        'Por quê? Porque as **invariantes** — regras que precisam ser sempre verdadeiras — ficam protegidas num lugar só.',
      ],
      board: {
        title: 'Aggregate e Aggregate Root',
        md: `\`\`\`text
┌──────────── Aggregate: Pedido ────────────┐
│  Pedido (raiz)                            │   ◀── todo acesso passa por aqui
│   ├── ItemPedido (café × 2)               │
│   ├── ItemPedido (pão × 1)                │
│   └── cliente_id = "c-42"  ───────────────┼──▶ outro agregado: só pelo ID
└───────────────────────────────────────────┘
 invariantes: quantidade > 0 · pedido confirmado não muda · total consistente
\`\`\`

**Regras de ouro:**
1. Acesse os objetos internos **só pela raiz** (\`pedido.adicionar_item(...)\`, nunca \`pedido.itens.append(...)\`)
2. Referencie **outros agregados pelo id**, não pelo objeto
3. **Uma transação altera um agregado**; entre agregados, consistência eventual
4. Prefira agregados **pequenos**`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Um anti-pattern muito comum é o **modelo anêmico**: classes que são só sacos de dados com getters e setters, e toda a regra espalhada em "services".',
        'O DDD defende o **modelo rico**: o comportamento e as regras moram no próprio objeto de domínio.',
      ],
      board: {
        title: 'Anêmico × rico',
        code: `# ❌ Modelo anêmico: qualquer um pode deixar o pedido inválido
class Pedido:
    def __init__(self):
        self.itens = []
        self.status = "aberto"

def adicionar_item_service(pedido, item):
    if pedido.status == "confirmado":   # regra fora do objeto…
        raise Exception("fechado")
    pedido.itens.append(item)           # …e repetida em outros services?

pedido.itens.append(item_invalido)      # nada impede isto!


# ✅ Modelo rico: a regra mora no agregado
class Pedido:
    def __init__(self):
        self._itens = []
        self._confirmado = False

    def adicionar_item(self, item):
        if self._confirmado:
            raise PedidoFechadoError()
        self._itens.append(item)

    @property
    def itens(self):
        return tuple(self._itens)       # cópia imutável: sem porta dos fundos`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Completando a caixa de ferramentas: o **Repository** salva e carrega agregados inteiros — um repositório **por agregado**, com uma interface que parece uma coleção.',
        'Um **Domain Service** guarda regras que não pertencem naturalmente a nenhuma entidade, como transferir dinheiro entre duas contas.',
        'E os **Domain Events** registram fatos que aconteceram no domínio, no passado: *PedidoConfirmado*. Outros agregados e contextos reagem a eles — é assim que se mantém a consistência **eventual** entre agregados.',
      ],
      board: {
        title: 'Repository, Domain Service e Domain Events',
        code: `from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class PedidoConfirmado:            # Domain Event: fato no passado, imutável
    pedido_id: str
    total_centavos: int


class RepositorioPedidos(Protocol):  # um repositório por AGREGADO
    def obter(self, pedido_id: str) -> "Pedido": ...
    def salvar(self, pedido: "Pedido") -> None: ...


def transferir(origem: "Conta", destino: "Conta", valor: "Dinheiro"):
    # Domain Service: a regra envolve duas entidades
    origem.debitar(valor)
    destino.creditar(valor)


# Caso de uso: carrega, executa, salva e publica eventos
pedido = repo.obter("p-1")
pedido.confirmar()                 # registra PedidoConfirmado em pedido.eventos
repo.salvar(pedido)
for evento in pedido.eventos:
    barramento.publicar(evento)    # Estoque e Entregas reagem depois`,
        caption: 'A **Factory** completa o time: encapsula a criação de agregados complexos (ex.: `Pedido.a_partir_do_carrinho(carrinho)`).',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Uma dúvida clássica antes dos exercícios: qual o **tamanho** certo de um agregado?',
        'A tentação é juntar tudo "para garantir consistência". A conta chega na **concorrência**.',
      ],
      board: {
        title: 'Agregados pequenos — por quê?',
        md: `Exemplo clássico de Vaughn Vernon (*Effective Aggregate Design*, 2011): um app de Scrum em que \`Produto\` guardava **todos** os itens de backlog, releases e sprints.

| | ❌ Um agregado grande | ✅ Vários agregados pequenos |
|---|---|---|
| Modelo | \`Produto\` contém itens, releases e sprints | \`Produto\`, \`ItemBacklog\`, \`Sprint\` — ligados por \`produto_id\` |
| Carregar | Centenas de objetos para mudar um campo | Só o que a operação precisa |
| Concorrência | Ana cria um item e Bruno agenda um sprint → as duas gravações disputam a **mesma versão** e uma falha | Gravações em agregados diferentes não disputam nada |
| Invariantes | "Tudo protegido" — inclusive o que não precisava | Só as invariantes **verdadeiras** ficam juntas |

**Pergunta-teste:** esta regra precisa valer no fim da **mesma** transação? Se "alguns segundos depois" basta, são dois agregados ligados por um **evento**.

> [!sabia] A mesma ideia apareceu no mundo dos bancos de dados. No artigo *Life beyond Distributed Transactions* (2007), Pat Helland argumenta que sistemas de escala "quase infinita" só conseguem transações atômicas **dentro** de uma *entidade* com chave única — que pode mudar de máquina, mas nunca é dividida. Entre entidades, só **mensagens**, entregues pelo menos uma vez e, por isso, processadas de forma **idempotente**. É o agregado do DDD visto pelo lado da escala.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Entity ou VO, invariantes e dois desafios de modelagem em código.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-ddd-tat-q1',
      concept: 'Value Object',
      say: 'Pergunta rápida: entity ou value object?',
      prompt: 'Num sistema de e-commerce, o **endereço de entrega** de um pedido (rua, número, CEP) deve ser modelado como:',
      options: [
        { text: 'Value Object: dois endereços com os mesmos dados são equivalentes, e para "mudar" o endereço basta trocar por outro.', correct: true, why: 'O que importa são os valores; não há identidade própria nem ciclo de vida a acompanhar.' },
        { text: 'Entity: todo objeto persistido no banco precisa ser uma entidade com id.', why: 'Persistência não define o tipo: value objects também são salvos (por exemplo, como colunas do pedido).' },
        { text: 'Aggregate Root: o endereço deve controlar o pedido.', why: 'O endereço é um detalhe do pedido; quem protege as invariantes é o Pedido.' },
        { text: 'Domain Service: endereços têm muita regra de validação.', why: 'Validação de um valor cabe no próprio value object (no `__post_init__`), não num service.' },
      ],
      explanation: 'Se o que importa é **o valor** e não a identidade, é **Value Object**. Endereço, dinheiro, período e CPF são clássicos. Imutável e comparado por valor, ele é mais simples e mais seguro que uma entidade.',
    },
    {
      type: 'mcq',
      id: 'arq-ddd-tat-q2',
      concept: 'Aggregate',
      say: 'Agora sobre onde as regras devem morar.',
      prompt: 'A regra de negócio é: **"um pedido confirmado não pode receber novos itens"**. Onde ela deve ficar?',
      options: [
        { text: 'No método `adicionar_item` da raiz do agregado `Pedido`.', correct: true, why: 'A raiz é a porta de entrada: a invariante fica protegida num lugar só, qualquer que seja quem chama.' },
        { text: 'No controller da API, antes de chamar o banco.', why: 'Qualquer outro caminho (um job, outro endpoint) poderia ignorar a regra — e ela ficaria duplicada.' },
        { text: 'No repositório, ao salvar o pedido.', why: 'Repositórios cuidam de persistência; regras de negócio lá ficam escondidas e são verificadas tarde demais.' },
        { text: 'Na classe `ItemPedido`, que é quem é adicionado.', why: 'O item não sabe o estado do pedido; a invariante é do agregado como um todo.' },
      ],
      explanation: 'Invariantes do agregado são protegidas pela **raiz**. Como todo acesso passa por `Pedido`, é impossível criar um pedido inválido por "porta dos fundos". Esse é o coração do **modelo rico**.',
    },
    {
      type: 'open',
      id: 'arq-ddd-tat-q3',
      concept: 'Aggregate',
      say: 'Explica como se estivesse numa revisão de design.',
      prompt: 'Por que, em DDD, outros objetos devem acessar os itens de um pedido **somente através da raiz do agregado** (`Pedido`), e por que um agregado referencia outros agregados **apenas pelo id**?',
      minWords: 20,
      rubric: [
        { label: 'A raiz protege as **invariantes** (regras sempre verdadeiras)', keywords: ['invariante', 'regra', 'consistenc', 'estado valido', 'estado invalido'], concept: 'Aggregate Root' },
        { label: 'Evita alterações por "porta dos fundos" / **encapsulamento**', keywords: ['encapsul', 'porta dos fundos', 'diretamente', 'por fora', 'burlar', 'contorn', 'unico ponto', 'ponto de entrada'], concept: 'Encapsulamento' },
        { label: 'Referência por id mantém agregados **pequenos e desacoplados**', keywords: ['desacopl', 'acoplamento', 'pequeno', 'carregar', 'grafo', 'independ', 'fronteira'], concept: 'Referência por identidade' },
        { label: 'Cita **transação por agregado** / consistência eventual entre agregados', keywords: ['transac', 'eventual', 'evento', 'lock', 'concorr'], concept: 'Consistência eventual' },
      ],
      modelAnswer: `O agregado é uma **fronteira de consistência**. A raiz (\`Pedido\`) é o único ponto de entrada, e é nela que ficam as **invariantes**: quantidade positiva, pedido confirmado não muda, total sempre coerente. Se outros objetos pudessem mexer nos itens diretamente, qualquer código poderia **contornar** as regras e deixar o pedido em estado inválido — o **encapsulamento** garante que a regra é verificada sempre, num lugar só.

Referenciar outros agregados **pelo id** (ex.: \`cliente_id\`) mantém cada agregado **pequeno e desacoplado**: carregar um pedido não carrega o cliente inteiro, e não há um grafo gigante de objetos. Isso também define o limite da **transação**: uma transação altera **um** agregado; mudanças em outros acontecem por **eventos**, com consistência eventual — o que reduz locks e conflitos de concorrência.`,
    },
    {
      type: 'code',
      id: 'arq-ddd-tat-q4',
      concept: 'Value Object',
      title: 'Value Object Dinheiro',
      say: 'Primeiro desafio: um value object de verdade. Imutável, validado — e nada de `float`!',
      prompt: `Implemente o value object \`Dinheiro\`:

- atributos \`centavos: int\` e \`moeda: str\` (padrão \`"BRL"\`)
- **imutável** (atribuir a um campo deve levantar erro) e com **igualdade por valor**
- moedas aceitas: \`"BRL"\`, \`"USD"\`, \`"EUR"\` — outra moeda levanta \`ValueError\`
- \`centavos\` precisa ser \`int\` — um \`float\` levanta \`TypeError\` (dinheiro não é ponto flutuante!)
- \`somar(outro)\` devolve um **novo** \`Dinheiro\`; moedas diferentes levantam \`ValueError\`
- \`multiplicar(fator)\` devolve um **novo** \`Dinheiro\` (\`fator\` inteiro)`,
      starter: `from dataclasses import dataclass


@dataclass
class Dinheiro:
    centavos: int
    moeda: str = "BRL"

    def somar(self, outro):
        pass

    def multiplicar(self, fator):
        pass
`,
      tests: [
        { name: 'igualdade por valor', expr: 'Dinheiro(1050, "BRL") == Dinheiro(1050, "BRL")', expected: 'True' },
        { name: 'somar', expr: 'Dinheiro(1000).somar(Dinheiro(250))', expected: 'Dinheiro(1250, "BRL")' },
        { name: 'multiplicar', expr: 'Dinheiro(333, "USD").multiplicar(3)', expected: 'Dinheiro(999, "USD")' },
        { name: 'somar não altera os originais', code: 'a = Dinheiro(100)\nb = Dinheiro(50)\nc = a.somar(b)\nassert a == Dinheiro(100) and b == Dinheiro(50) and c == Dinheiro(150)' },
        { name: 'moedas diferentes → ValueError', code: 'try:\n    Dinheiro(100, "BRL").somar(Dinheiro(100, "USD"))\n    assert False, "somar BRL com USD deveria levantar ValueError"\nexcept ValueError:\n    pass' },
        { name: 'imutável', code: 'd = Dinheiro(100)\ntry:\n    d.centavos = 999\n    assert False, "Dinheiro deveria ser imutável"\nexcept AttributeError:\n    pass\nassert d.centavos == 100' },
        { hidden: true, name: 'moeda inválida → ValueError', code: 'try:\n    Dinheiro(100, "BTC")\n    assert False\nexcept ValueError:\n    pass' },
        { hidden: true, name: 'float → TypeError', code: 'try:\n    Dinheiro(10.5)\n    assert False, "float não deveria ser aceito"\nexcept TypeError:\n    pass' },
        { hidden: true, name: 'hashable (usável em set/dict)', expr: 'len({Dinheiro(1), Dinheiro(1), Dinheiro(2)})', expected: '2' },
      ],
      reviews: [
        {
          when: (m, code) => !/frozen\s*=\s*True/.test(code),
          text: 'A imutabilidade foi feita "à mão". `@dataclass(frozen=True)` já garante imutabilidade, `==` por valor e `__hash__` — menos código, menos chance de erro.',
          concept: 'Value Object imutável',
        },
        {
          when: m => m.calls.includes('float') || m.calls.includes('round'),
          text: 'Aparecem `float`/`round` no seu value object. Dinheiro em centavos inteiros (ou `Decimal`) evita erros de arredondamento como `0.1 + 0.2 != 0.3`.',
          concept: 'Dinheiro sem float',
        },
      ],
      hints: [
        'Troque `@dataclass` por `@dataclass(frozen=True)`: resolve imutabilidade, igualdade e hash de uma vez.',
        'Valide no `__post_init__(self)`: `isinstance(self.centavos, int)` (cuidado: `bool` também é `int`!) e se a moeda está num conjunto permitido.',
        '`somar` compara `self.moeda != outro.moeda` e devolve `Dinheiro(self.centavos + outro.centavos, self.moeda)`.',
      ],
      solution: `from dataclasses import dataclass

MOEDAS = {"BRL", "USD", "EUR"}


@dataclass(frozen=True)
class Dinheiro:
    centavos: int
    moeda: str = "BRL"

    def __post_init__(self):
        if isinstance(self.centavos, bool) or not isinstance(self.centavos, int):
            raise TypeError("centavos deve ser int — dinheiro não é ponto flutuante")
        if self.moeda not in MOEDAS:
            raise ValueError(f"moeda inválida: {self.moeda}")

    def somar(self, outro):
        if outro.moeda != self.moeda:
            raise ValueError("não é possível somar moedas diferentes")
        return Dinheiro(self.centavos + outro.centavos, self.moeda)

    def multiplicar(self, fator):
        return Dinheiro(self.centavos * fator, self.moeda)
`,
      solutionExplanation: '`frozen=True` entrega imutabilidade, `==` por valor e `__hash__`. A validação no `__post_init__` garante que um `Dinheiro` inválido **nunca existe**. As operações devolvem **novos** objetos em vez de alterar o atual — é assim que value objects "mudam". Centavos inteiros eliminam os erros de arredondamento do `float`.',
    },
    {
      type: 'code',
      id: 'arq-ddd-tat-q5',
      concept: 'Aggregate',
      title: 'Aggregate Pedido',
      say: 'Agora o grande: um agregado que protege as próprias invariantes e registra um evento de domínio.',
      prompt: `Implemente o agregado \`Pedido\` (raiz). As classes \`ItemPedido\`, \`PedidoConfirmado\` e \`PedidoFechadoError\` já estão prontas.

- \`Pedido(pedido_id)\` começa aberto, sem itens, com \`eventos == []\`
- \`adicionar_item(produto_id, preco_centavos, quantidade=1)\`:
  - \`quantidade <= 0\` ou preço negativo → \`ValueError\`
  - o mesmo produto adicionado de novo **soma a quantidade** (um único item)
- \`remover_item(produto_id)\` — produto inexistente → \`KeyError\`
- \`itens\` (propriedade) devolve os itens **sem expor a coleção interna** (quem receber não pode alterar o pedido por fora)
- \`total\` (propriedade) = soma de preço × quantidade
- \`confirmar()\`: pedido vazio → \`ValueError\`; registra \`PedidoConfirmado(pedido_id, total)\` em \`eventos\`
- depois de confirmado, **qualquer** alteração (adicionar, remover, confirmar de novo) → \`PedidoFechadoError\``,
      starter: `from dataclasses import dataclass


class PedidoFechadoError(Exception):
    """Operação inválida: o pedido já foi confirmado."""


@dataclass(frozen=True)
class ItemPedido:
    produto_id: str
    preco_centavos: int
    quantidade: int

    @property
    def subtotal(self):
        return self.preco_centavos * self.quantidade


@dataclass(frozen=True)
class PedidoConfirmado:          # Domain Event
    pedido_id: str
    total_centavos: int


class Pedido:                    # Aggregate Root
    def __init__(self, pedido_id):
        pass

    @property
    def itens(self):
        pass

    @property
    def total(self):
        pass

    def adicionar_item(self, produto_id, preco_centavos, quantidade=1):
        pass

    def remover_item(self, produto_id):
        pass

    def confirmar(self):
        pass
`,
      tests: [
        { name: 'total', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000, 2)\np.adicionar_item("pao", 250)\nassert p.total == 2250, f"total esperado 2250, obtido {p.total}"' },
        { name: 'mesmo produto soma quantidade', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000)\np.adicionar_item("cafe", 1000, 2)\nassert len(p.itens) == 1 and p.itens[0].quantidade == 3' },
        { name: 'quantidade inválida → ValueError', code: 'p = Pedido("p1")\ntry:\n    p.adicionar_item("cafe", 1000, 0)\n    assert False, "quantidade 0 deveria levantar ValueError"\nexcept ValueError:\n    pass' },
        { name: 'confirmar registra evento', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000, 2)\np.confirmar()\nassert p.eventos == [PedidoConfirmado("p1", 2000)]' },
        { name: 'confirmado não aceita itens', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000)\np.confirmar()\ntry:\n    p.adicionar_item("pao", 250)\n    assert False, "pedido confirmado não pode receber itens"\nexcept PedidoFechadoError:\n    pass\nassert p.total == 1000' },
        { name: 'pedido vazio não confirma', code: 'p = Pedido("p1")\ntry:\n    p.confirmar()\n    assert False, "pedido vazio não deveria ser confirmado"\nexcept ValueError:\n    pass\nassert p.eventos == []' },
        { hidden: true, name: 'remover item', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000)\np.adicionar_item("pao", 250, 4)\np.remover_item("cafe")\nassert p.total == 1000 and len(p.itens) == 1\ntry:\n    p.remover_item("cafe")\n    assert False\nexcept KeyError:\n    pass' },
        { hidden: true, name: 'confirmado: remover e confirmar de novo', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000)\np.confirmar()\nfor acao in (lambda: p.remover_item("cafe"), p.confirmar):\n    try:\n        acao()\n        assert False\n    except PedidoFechadoError:\n        pass\nassert len(p.eventos) == 1' },
        { hidden: true, name: 'itens não expõe a coleção interna', code: 'p = Pedido("p1")\np.adicionar_item("cafe", 1000)\nitens = p.itens\ntry:\n    itens.append(ItemPedido("x", 1, 1))\nexcept AttributeError:\n    pass\ntry:\n    itens.clear()\nexcept AttributeError:\n    pass\nassert len(p.itens) == 1 and p.total == 1000, "alterar o retorno de itens mudou o pedido!"' },
        { hidden: true, name: 'preço negativo → ValueError', code: 'p = Pedido("p1")\ntry:\n    p.adicionar_item("cafe", -1)\n    assert False\nexcept ValueError:\n    pass' },
      ],
      reviews: [
        {
          when: (m, code) => /self\.itens\s*=/.test(code),
          text: 'O estado interno ficou num atributo público (`self.itens = ...`). Mesmo com a propriedade, qualquer código pode fazer `pedido.itens...` e burlar as regras. Guarde em `self._itens` e exponha uma **cópia imutável** (tupla).',
          concept: 'Aggregate Root: encapsulamento',
        },
        {
          when: (m, code) => /def\s+set_\w+/.test(code),
          text: 'Setters genéricos (`set_...`) são sinal de **modelo anêmico**: permitem mudar o estado sem passar pelas regras. Exponha operações de negócio (`confirmar`, `adicionar_item`).',
          concept: 'Modelo rico vs anêmico',
        },
      ],
      hints: [
        'Guarde os itens num dicionário interno `self._itens = {}` (produto_id → ItemPedido) e um `self._confirmado = False`. A propriedade `itens` devolve `tuple(self._itens.values())`.',
        'Crie um método auxiliar `_garantir_aberto()` que levanta `PedidoFechadoError` se estiver confirmado, e chame-o no início de cada operação.',
        'Como `ItemPedido` é imutável, para somar a quantidade crie um **novo** `ItemPedido` com a quantidade somada e substitua no dicionário.',
      ],
      solution: `from dataclasses import dataclass


class PedidoFechadoError(Exception):
    """Operação inválida: o pedido já foi confirmado."""


@dataclass(frozen=True)
class ItemPedido:
    produto_id: str
    preco_centavos: int
    quantidade: int

    @property
    def subtotal(self):
        return self.preco_centavos * self.quantidade


@dataclass(frozen=True)
class PedidoConfirmado:
    pedido_id: str
    total_centavos: int


class Pedido:
    def __init__(self, pedido_id):
        self.id = pedido_id
        self._itens = {}
        self._confirmado = False
        self.eventos = []

    @property
    def itens(self):
        return tuple(self._itens.values())

    @property
    def total(self):
        return sum(item.subtotal for item in self._itens.values())

    def _garantir_aberto(self):
        if self._confirmado:
            raise PedidoFechadoError(f"pedido {self.id} já foi confirmado")

    def adicionar_item(self, produto_id, preco_centavos, quantidade=1):
        self._garantir_aberto()
        if quantidade <= 0:
            raise ValueError("quantidade deve ser positiva")
        if preco_centavos < 0:
            raise ValueError("preço não pode ser negativo")
        atual = self._itens.get(produto_id)
        if atual:
            quantidade += atual.quantidade
        self._itens[produto_id] = ItemPedido(produto_id, preco_centavos, quantidade)

    def remover_item(self, produto_id):
        self._garantir_aberto()
        if produto_id not in self._itens:
            raise KeyError(produto_id)
        del self._itens[produto_id]

    def confirmar(self):
        self._garantir_aberto()
        if not self._itens:
            raise ValueError("pedido vazio não pode ser confirmado")
        self._confirmado = True
        self.eventos.append(PedidoConfirmado(self.id, self.total))
`,
      solutionExplanation: 'Toda operação passa pela **raiz** e começa checando a invariante "pedido confirmado não muda" (`_garantir_aberto`). O estado fica em `_itens` e sai como **tupla**: quem recebe não consegue alterar o pedido por fora. O `total` é **calculado**, então nunca fica inconsistente. Ao confirmar, o agregado registra o **evento de domínio** `PedidoConfirmado` — o caso de uso depois salva o pedido e publica os eventos para outros agregados (Estoque, Entregas) reagirem.',
    },
    {
      type: 'order',
      id: 'arq-rx2-ddd-tat-q6',
      concept: 'Caso de uso com agregado',
      say: 'Para fechar: o caminho completo de um caso de uso, do repositório ao evento.',
      prompt: 'Ordene o que acontece no caso de uso **confirmar pedido**, do início ao fim.',
      items: [
        'Carregar o agregado inteiro pelo repositório: `repo.obter("p-1")`',
        'Chamar a operação de negócio na raiz: `pedido.confirmar()`',
        'A raiz checa as invariantes e registra `PedidoConfirmado` em `pedido.eventos`',
        'Salvar o agregado numa única transação: `repo.salvar(pedido)`',
        'Publicar os eventos registrados no barramento',
        'Estoque e Entregas reagem ao evento, cada um na **sua** transação',
      ],
      explanation: 'O caso de uso **orquestra**, mas quem decide é o agregado: a raiz valida as invariantes **antes** de mudar o estado e só então registra o evento. Os eventos saem **depois** que a gravação deu certo — publicar antes arriscaria anunciar uma mudança que ainda pode falhar (em produção, o padrão *transactional outbox* grava os eventos na mesma transação e os publica em seguida). Quem reage faz isso em **outras** transações: consistência eventual entre agregados.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Recapitulando: **Value Objects** imutáveis e validados, **Entities** com identidade, **Aggregates** protegendo invariantes pela raiz…',
        '…**Repositories** por agregado e **Domain Events** para integrar agregados com consistência eventual. E sempre: modelo **rico**, não anêmico.',
      ],
      board: null,
    },
  ],
});
