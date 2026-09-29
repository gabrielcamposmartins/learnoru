(function () {
  const REEMBOLSO = `from dataclasses import dataclass, replace
from datetime import date, timedelta


@dataclass(frozen=True)
class Cliente:
    nome: str
    email: str
    vip: bool = False


@dataclass(frozen=True)
class Item:
    produto: str
    preco: int
    em_promocao: bool = False


@dataclass(frozen=True)
class Pedido:
    cliente: Cliente
    itens: tuple
    status: str          # "pago", "enviado", "entregue" ou "cancelado"
    entregue_em: date


def pode_reembolsar(pedido, hoje):
    """Diz se o pedido ainda pode ser reembolsado.

    - Só pedidos com status "entregue".
    - Se QUALQUER item estiver em promoção, não há reembolso.
    - Prazo: até 7 dias corridos após a entrega (o 7º dia ainda vale);
      clientes VIP têm 30 dias.
    """
    if pedido.status != "entregue":
        return False
    if any(item.em_promocao for item in pedido.itens):
        return False
    prazo = 30 if pedido.cliente.vip else 7
    return hoje <= pedido.entregue_em + timedelta(days=prazo)


# ── builder de testes (num projeto real, ficaria em tests/builders.py) ──

class PedidoBuilder:
    """Padrões: cliente comum, uma caneca de R$ 50, status "entregue", entregue em 01/03/2024."""

    def __init__(self):
        self._cliente = Cliente("Ana", "ana@exemplo.com")
        self._itens = [Item("Caneca", 50)]
        self._status = "entregue"
        self._entregue_em = date(2024, 3, 1)

    def de_cliente_vip(self):
        self._cliente = replace(self._cliente, vip=True)
        return self

    def com_item(self, produto="Camiseta", preco=80, em_promocao=False):
        self._itens.append(Item(produto, preco, em_promocao))
        return self

    def com_status(self, status):
        self._status = status
        return self

    def entregue_em(self, data):
        self._entregue_em = data
        return self

    def build(self):
        return Pedido(self._cliente, tuple(self._itens), self._status, self._entregue_em)


def um_pedido():
    return PedidoBuilder()
`;

  /** Cria um mutante trocando um trecho do código correto. */
  const mut = (from, to) => {
    const code = REEMBOLSO.replace(from, to);
    if (code === REEMBOLSO) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };

  const USUARIO = `import itertools
from dataclasses import dataclass, field


@dataclass
class Usuario:
    nome: str
    email: str
    idade: int
    pais: str
    papeis: list = field(default_factory=list)
    ativo: bool = True


def validar(usuario):
    """Regras do domínio: levanta ValueError se o usuário for inválido."""
    if not usuario.nome:
        raise ValueError("nome obrigatório")
    if "@" not in usuario.email:
        raise ValueError("e-mail inválido")
    if usuario.idade < 18:
        raise ValueError("é preciso ter 18 anos ou mais")
    if len(usuario.pais) != 2:
        raise ValueError("país deve ser um código de 2 letras, como 'BR'")
`;

  Game.registerModule('testing', {
    id: 'test-data-builders',
    title: 'Dados de teste: Object Mother, builders e factories',
    kind: 'lesson',
    level: 2,
    order: 32,
    unit: 'qualidade',
    summary: 'Monte dados de teste sem duplicação nem ruído: Object Mother, Test Data Builder fluente, factories como fixtures — e os smells Mystery Guest e informação irrelevante.',
    concepts: ['Object Mother', 'Test Data Builder', 'Factory as fixture', 'Mystery Guest', 'Informação irrelevante'],
    takeaways: [
      'Um **Object Mother** centraliza objetos prontos com nomes do domínio, mas tende à **explosão de variações** — um método para cada combinação.',
      'O **Test Data Builder** parte de **padrões válidos e neutros** e deixa cada teste declarar só a diferença: `um_pedido().de_cliente_vip().build()`.',
      'No pytest, o padrão **factory as fixture** devolve uma **função** que fabrica objetos: o teste cria quantos quiser, e o teardown limpa o que foi criado.',
      'Builders bons **copiam as coleções** no `build()`, geram **valores únicos** (`itertools.count`) e **não validam** — quem valida é o domínio.',
      'Teste legível mostra **tudo o que importa e só o que importa**: sem *Mystery Guest* (dados invisíveis) nem *informação irrelevante* (ruído).',
    ],
    glossary: [
      { term: 'Object Mother', aliases: ['object mothers', 'ObjectMother'], definition: 'Padrão de testes: uma classe ou módulo central com métodos de fábrica que devolvem objetos prontos, com nomes do domínio (`cliente_vip()`, `pedido_pago()`). Simples, mas tende a ganhar um método novo para cada variação.' },
      { term: 'Test Data Builder', aliases: ['test data builders', 'builder de dados de teste', 'builders de dados de teste', 'builder de teste', 'builders de teste'], definition: 'Builder com **valores padrão sensatos** e métodos fluentes para mudar só o que o teste precisa (`um_pedido().de_cliente_vip().build()`). Proposto por Nat Pryce como alternativa ao Object Mother.' },
      { term: 'Factory as fixture', aliases: ['factories as fixtures', 'factory fixture', 'fábrica como fixture', 'fábricas como fixtures'], definition: 'Padrão do pytest em que a fixture devolve uma **função** que cria objetos. O teste chama a fábrica quantas vezes quiser, com os detalhes que importam, e o teardown da fixture limpa o que foi criado.' },
      { term: 'Mystery Guest', aliases: ['convidado misterioso'], definition: 'Test smell: o resultado do teste depende de dados que o leitor **não vê** — um arquivo, um registro semeado no banco, uma fixture distante. É uma das causas do *Obscure Test*, o teste que não se entende só olhando para ele.' },
      { term: 'Informação irrelevante', aliases: ['irrelevant information', 'detalhes irrelevantes', 'dados irrelevantes'], definition: 'Test smell: o teste mostra tantos dados que o que decide o resultado se perde no ruído. O remédio é partir de padrões sensatos e mencionar só o que importa para o comportamento verificado.' },
      { term: 'DAMP', aliases: ['DAMP, not DRY', 'Descriptive And Meaningful Phrases'], definition: '*Descriptive And Meaningful Phrases*: princípio de que testes devem priorizar a **legibilidade** — um pouco de repetição é aceitável se cada teste puder ser entendido sozinho. Contrasta com o DRY do código de produção.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Você já abriu um teste e encontrou **quinze linhas** montando um pedido — cliente, endereço, itens, pagamento — só para verificar **uma** regra?',
          'E pior: quando o construtor de `Cliente` ganha um campo obrigatório, **oitenta testes** quebram de uma vez. Hoje o assunto é montar dados de teste sem sofrer.',
        ],
        board: {
          title: 'O problema: um Arrange gigante e duplicado',
          md: `\`\`\`python
def test_cliente_vip_tem_frete_gratis():
    endereco = Endereco("Rua das Flores", "123", "01000-000", "São Paulo", "SP")
    cliente = Cliente("Ana Souza", "ana@exemplo.com", "123.456.789-09",
                      endereco, vip=True, criado_em=date(2020, 1, 1))
    itens = [Item("Caneca", preco=35, quantidade=2),
             Item("Camiseta", preco=80, quantidade=1)]
    pagamento = Pagamento("cartao", parcelas=1, aprovado=True)
    pedido = Pedido(cliente, itens, pagamento, status="pago",
                    criado_em=date(2024, 3, 1))

    assert calcular_frete(pedido) == 0     # afinal, o que importava aqui?
\`\`\`

- **Duplicação:** o mesmo Arrange copiado em dezenas de testes.
- **Fragilidade:** um campo obrigatório novo em \`Cliente\` quebra todos eles — inclusive os que nem se importam com clientes.
- **Ruído:** a única informação relevante, \`vip=True\`, está escondida no meio do resto.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A primeira solução clássica é o **Object Mother**: um lugar central com métodos que devolvem objetos prontos, com nomes do domínio.',
          'Funciona muito bem no começo… até cada teste precisar de uma **variação** um pouquinho diferente.',
        ],
        board: {
          title: 'Object Mother',
          md: `\`\`\`python
# tests/mae.py
class Mae:
    @staticmethod
    def cliente_vip():
        return Cliente("Ana", "ana@exemplo.com", vip=True)

    @staticmethod
    def pedido_entregue():
        return Pedido(Mae.cliente_comum(), [Item("Caneca", 50)], status="entregue")

    @staticmethod
    def pedido_entregue_de_vip_com_item_em_promocao_ha_10_dias():
        ...   # 😱 uma variação nova para cada teste
\`\`\`

| ✅ Ganhos | ⚠️ Problemas |
|---|---|
| Arrange reutilizável, com **nomes do domínio** | **Explosão de variações**: um método para cada combinação |
| Um lugar só para ajustar quando o construtor muda | Vira uma classe gigante que todo mundo edita |
| Ótimo para as poucas **personas** mais usadas | O leitor do teste **não vê** os dados: precisa abrir a mãe para entender |`,
          caption: 'O nome surgiu em projetos da ThoughtWorks por volta de 2000. Cada método da mãe é o que Gerard Meszaros chama de **Creation Method**.',
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'A alternativa que o Nat Pryce propôs é o **Test Data Builder**: um builder com **valores padrão sensatos** e métodos fluentes para mudar **só o que o teste precisa**.',
          'Cada teste parte de um objeto **válido** e diz, em uma linha, o que ele tem de especial.',
        ],
        board: {
          title: 'Test Data Builder',
          md: `\`\`\`python
from dataclasses import replace
from datetime import date


class PedidoBuilder:
    def __init__(self):
        # padrões: um pedido VÁLIDO e sem nada de especial
        self._cliente = Cliente("Ana", "ana@exemplo.com", vip=False)
        self._itens = [Item("Caneca", 50)]
        self._status = "entregue"
        self._entregue_em = date(2024, 3, 1)

    def de_cliente_vip(self):
        self._cliente = replace(self._cliente, vip=True)
        return self                          # devolve o builder: interface fluente

    def com_item(self, produto="Camiseta", preco=80, em_promocao=False):
        self._itens.append(Item(produto, preco, em_promocao))
        return self

    def build(self):
        return Pedido(self._cliente, tuple(self._itens), self._status, self._entregue_em)


def um_pedido():                             # lê como uma frase
    return PedidoBuilder()


def test_cliente_vip_tem_30_dias_para_pedir_reembolso():
    pedido = um_pedido().de_cliente_vip().build()
    assert pode_reembolsar(pedido, hoje=date(2024, 3, 25)) is True
\`\`\`

> [!dica] Em testes, legibilidade vale mais que DRY a qualquer custo. O Google resume isso como **"DAMP, not DRY"** (*Descriptive And Meaningful Phrases*): cada teste precisa ser entendido **sozinho**. O builder entrega os dois — a construção fica num lugar só, e o teste mostra só o que importa.`,
          caption: 'Os padrões são **válidos** e **sem graça** de propósito: se o padrão já fosse VIP, um teste de cliente comum poderia passar por acaso.',
        },
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Em Python, nem sempre você precisa de uma classe: uma função com **argumentos nomeados** e padrões sensatos resolve muitos casos.',
          'Mas, com classe ou sem, cuidado com quatro armadilhas clássicas.',
        ],
        board: {
          title: 'Variações pythônicas e armadilhas',
          md: `\`\`\`python
import itertools

_ids = itertools.count(1)


def um_cliente(**campos):
    padrao = dict(nome="Ana", email=f"cliente{next(_ids)}@exemplo.com", vip=False)
    return Cliente(**(padrao | campos))        # só sobrescreve o que foi passado


def test_vip_tem_desconto():
    assert desconto(um_cliente(vip=True)) == 0.1
\`\`\`

| Armadilha | Sintoma | Remédio |
|---|---|---|
| **Lista compartilhada** | dois objetos do mesmo builder dividem a mesma lista de itens | copie as coleções no \`build()\` (\`list(...)\`, \`tuple(...)\`) |
| **Valores que colidem** | dois clientes com o mesmo e-mail violam um \`UNIQUE\` | gere valores únicos com \`itertools.count()\` |
| **Builder que valida** | impossível montar um objeto inválido para testar a validação | o builder **monta**; quem valida é o domínio |
| **Padrões "espertos"** | o padrão já é VIP, em promoção… e o teste passa por acaso | padrões neutros: o caso mais comum e sem graça |

> [!dica] Com dataclasses, \`dataclasses.replace(objeto, campo=valor)\` cria uma cópia alterada — ótimo para variações de um objeto padrão. Em projetos grandes, a biblioteca **factory_boy** faz tudo isso por você: \`factory.Sequence\` gera valores únicos, \`SubFactory\` monta objetos aninhados e \`Trait\` dá nome a variações.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E no pytest? Uma fixture comum devolve **um** objeto pronto — mas muitos testes precisam de **vários**, cada um com um detalhe diferente.',
          'A saída é o padrão **factory as fixture**: a fixture devolve uma **função** que fabrica objetos. E, com `yield`, ela ainda limpa tudo o que criou.',
        ],
        board: {
          title: 'Factory as fixture',
          code: `import itertools

import pytest


@pytest.fixture
def criar_usuario(banco):                  # banco: outra fixture (ex.: SQLite em memória)
    ids = itertools.count(1)
    criados = []

    def _criar(nome="Ana", admin=False):
        n = next(ids)
        usuario = banco.inserir_usuario(nome=nome, email=f"u{n}@exemplo.com", admin=admin)
        criados.append(usuario)
        return usuario

    yield _criar                            # o teste recebe a FÁBRICA, não um objeto
    for usuario in criados:                 # teardown: apaga só o que este teste criou
        banco.remover_usuario(usuario.id)


def test_admin_ve_todos_os_usuarios(criar_usuario, servico):
    admin = criar_usuario(admin=True)
    criar_usuario(nome="Bia")
    criar_usuario(nome="Caio")

    assert len(servico.listar_para(admin)) == 3


def test_usuario_comum_ve_so_a_si_mesmo(criar_usuario, servico):
    bia = criar_usuario(nome="Bia")
    criar_usuario(nome="Caio")

    assert servico.listar_para(bia) == [bia]`,
          caption: 'A documentação do pytest descreve esse padrão como *factories as fixtures*. Coloque a fábrica no `conftest.py` e ela fica disponível para a pasta inteira de testes.',
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'A regra de ouro dos dados de teste: **o teste deve mostrar tudo o que importa — e só o que importa**.',
          'Quando ela é violada, aparecem dois smells de nomes curiosos: o **Mystery Guest** e a **informação irrelevante**.',
        ],
        board: {
          title: 'Mystery Guest × informação irrelevante',
          md: `\`\`\`python
# ❌ Mystery Guest: de onde vem o cliente 42? Por que ele tem desconto?
def test_cliente_tem_desconto():
    cliente = carregar_clientes("dados/clientes.json")[42]
    assert desconto(cliente) == 0.1


# ❌ Informação irrelevante: qual destes dados decide o desconto?
def test_cliente_tem_desconto():
    cliente = Cliente("Ana Souza", "ana@exemplo.com", "123.456.789-09",
                      nascimento=date(1990, 5, 17), cidade="Recife",
                      vip=True, pontos=1200, criado_em=date(2019, 2, 1))
    assert desconto(cliente) == 0.1


# ✅ Só o que importa, visível no próprio teste
def test_cliente_vip_tem_10_por_cento_de_desconto():
    assert desconto(um_cliente(vip=True)) == 0.1
\`\`\`

| Smell | O que é | Remédio |
|---|---|---|
| **Mystery Guest** | o teste depende de dados que o leitor **não vê**: arquivo, registro semeado no banco, fixture distante | traga o dado relevante para dentro do teste (builder, factory) |
| **Informação irrelevante** | dados demais; o que decide o resultado se perde no ruído | padrões sensatos + mencionar só o que muda o resultado |
| **General Fixture** | uma fixture enorme, montada para servir a **todos** os testes | fixtures pequenas ou factories: cada teste monta o seu cenário |

> [!sabia] O *Mystery Guest* e o *General Fixture* vêm do primeiro catálogo de **test smells**, o artigo *"Refactoring Test Code"* (van Deursen, Moonen, van den Bergh e Kok, 2001), que também batizou o *Assertion Roulette* e o *Eager Test*. Anos depois, no livro *xUnit Test Patterns* (2007), Gerard Meszaros juntou a *Irrelevant Information* e agrupou todos como causas de um smell maior: o **Obscure Test** — o teste que não dá para entender só olhando para ele.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Smells, padrões, um builder feito por você e testes que dizem só o que importa.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-tdb-q1',
        concept: 'Mystery Guest',
        say: 'Olho de revisora: o que tem de errado aqui?',
        prompt: `Este teste passa, mas o time reclama que ninguém entende o que aconteceu quando ele quebra:

\`\`\`python
@pytest.fixture(scope="session")
def banco():
    return carregar_banco("fixtures/dados_de_teste.sql")   # 3.000 linhas de INSERT


def test_reembolso_negado(banco):
    pedido = banco.buscar_pedido(1017)
    assert pode_reembolsar(pedido, hoje=date(2024, 5, 2)) is False
\`\`\`

Qual é o **principal** problema?`,
        options: [
          { text: '**Mystery Guest**: o motivo da recusa (status? prazo? item em promoção?) está escondido no pedido 1017 do arquivo SQL — o leitor não vê os dados que decidem o resultado.', correct: true, why: 'O teste depende de um dado invisível. Montar o pedido no próprio teste, com um builder, deixaria a causa explícita: `um_pedido().com_item(em_promocao=True).build()`.' },
          { text: '**Informação irrelevante**: o teste mostra dados demais.', why: 'É o oposto: o teste não mostra dado **nenhum** — tudo está num arquivo externo.' },
          { text: 'O teste é lento porque usa `scope="session"`.', why: '`scope="session"` até deixa a carga mais rápida (acontece uma vez só). O problema é de **legibilidade** e de acoplamento a um dado invisível — e o estado compartilhado ainda pode criar dependência entre testes.' },
          { text: 'Falta `@pytest.mark.parametrize` para testar vários pedidos.', why: 'Parametrizar vários IDs misteriosos só multiplicaria o problema: continuaria sem dizer **por que** cada pedido é recusado.' },
        ],
        explanation: 'O **Mystery Guest** é um convidado que ninguém apresentou: o teste depende de dados definidos longe dele (arquivo, banco semeado, fixture distante). Quando ele quebra, alguém precisa abrir 3.000 linhas de SQL para descobrir o que o pedido 1017 tinha de especial — e qualquer colega que alterar esse registro para outro teste quebra este sem saber. O remédio é trazer o dado relevante para dentro do teste: `um_pedido().com_status("cancelado").build()`.',
      },
      {
        type: 'match',
        id: 'tst-tdb-q2',
        concept: 'Padrões de dados de teste',
        say: 'Rodada rápida de vocabulário.',
        prompt: 'Associe cada **padrão ou smell** à sua descrição.',
        pairs: [
          { left: 'Object Mother', right: 'Classe central com métodos que devolvem objetos prontos: `cliente_vip()`, `pedido_pago()`' },
          { left: 'Test Data Builder', right: 'Padrões válidos e métodos fluentes para mudar só o necessário: `um_pedido().de_cliente_vip().build()`' },
          { left: 'Factory as fixture', right: 'Fixture do pytest que devolve uma **função** para criar quantos objetos o teste quiser' },
          { left: 'Mystery Guest', right: 'O resultado depende de dados que o leitor não vê, como um registro num arquivo externo' },
          { left: 'Informação irrelevante', right: 'Dez campos preenchidos à mão quando só um deles decide o resultado' },
          { left: 'General Fixture', right: 'Uma fixture gigante que monta o cenário de todos os testes de uma vez' },
        ],
        explanation: 'O **Object Mother** centraliza objetos prontos (e sofre com a explosão de variações); o **Test Data Builder** parte de padrões válidos e deixa cada teste declarar só a diferença; a **factory as fixture** leva essa ideia para o pytest, com limpeza no teardown. Do lado dos smells, o **Mystery Guest** esconde os dados, a **informação irrelevante** os afoga em ruído e a **General Fixture** monta mais do que qualquer teste precisa — os três deixam o teste obscuro.',
      },
      {
        type: 'code',
        id: 'tst-tdb-q3',
        concept: 'Test Data Builder',
        title: 'Seu próprio Test Data Builder',
        say: 'Sua vez de construir um builder. Atenção às armadilhas do quadro — os testes ocultos vão atrás delas!',
        prompt: `Complete o **Test Data Builder** de \`Usuario\`:

- \`um_usuario().build()\` devolve um usuário **válido** (passa em \`validar\`), **ativo** e **sem papéis** — padrões sensatos e sem graça.
- Cada método de configuração devolve o próprio builder, para encadear: \`um_usuario().com_nome("Bia").com_idade(40).build()\`.
- \`admin()\` acrescenta o papel \`"admin"\`; \`inativo()\` deixa \`ativo=False\`; \`do_pais("PT")\` troca o país.
- **E-mails únicos:** sem \`com_email(...)\`, **cada** \`build()\` gera um e-mail diferente (\`usuario1@exemplo.com\`, \`usuario2@exemplo.com\`…). Com \`com_email(...)\`, vale o e-mail informado.
- O builder **não valida**: \`um_usuario().com_idade(16).build()\` precisa devolver o usuário de 16 anos — é assim que se testa a própria \`validar\`.
- **Objetos independentes:** usuários construídos pelo mesmo builder não podem compartilhar a lista de papéis.`,
        starter: `${USUARIO}

class UsuarioBuilder:
    def __init__(self):
        ...  # TODO: padrões sensatos — um usuário VÁLIDO e sem nada de especial

    def com_nome(self, nome):
        ...

    def com_email(self, email):
        ...

    def com_idade(self, idade):
        ...

    def do_pais(self, pais):
        ...

    def admin(self):
        ...

    def inativo(self):
        ...

    def build(self):
        ...


def um_usuario():
    return UsuarioBuilder()
`,
        tests: [
          { name: 'o padrão é um usuário válido', code: 'u = um_usuario().build()\nassert isinstance(u, Usuario), f"build() devolveu {u!r}"\nvalidar(u)  # não pode levantar ValueError' },
          { name: 'o padrão é ativo e sem papéis', code: 'u = um_usuario().build()\nassert u.ativo is True and u.papeis == [], f"ativo={u.ativo}, papeis={u.papeis}"' },
          { name: 'interface fluente', code: 'u = um_usuario().com_nome("Bia").com_idade(40).do_pais("PT").build()\nassert (u.nome, u.idade, u.pais) == ("Bia", 40, "PT"), u' },
          { name: 'admin() acrescenta o papel', expr: 'um_usuario().admin().build().papeis', expected: '["admin"]' },
          { name: 'inativo() desativa o usuário', expr: 'um_usuario().inativo().build().ativo', expected: 'False' },
          { name: 'com_email() define o e-mail', expr: 'um_usuario().com_email("bia@empresa.com").build().email', expected: '"bia@empresa.com"' },
          { name: 'e-mails únicos', code: 'emails = [um_usuario().build().email for _ in range(5)]\nassert len(set(emails)) == 5, f"e-mails repetidos: {emails}"\nassert all("@" in e for e in emails), emails' },
          { name: 'o builder não valida', code: 'u = um_usuario().com_idade(16).build()\nassert u is not None and u.idade == 16, "o builder deve montar o usuário de 16 anos: quem valida é o domínio"' },
          { name: 'dois build() do mesmo builder são independentes', hidden: true, code: 'b = um_usuario().admin()\nu1, u2 = b.build(), b.build()\nu1.papeis.append("financeiro")\nassert u2.papeis == ["admin"], f"os usuários compartilham a lista de papéis: {u2.papeis}"' },
          { name: 'build() repetido gera e-mails diferentes', hidden: true, code: 'b = um_usuario()\ne1, e2 = b.build().email, b.build().email\nassert e1 != e2, f"o mesmo builder gerou {e1} duas vezes"' },
          { name: 'mexer no builder não altera usuários já construídos', hidden: true, code: 'b = um_usuario()\ncomum = b.build()\nb.admin()\nassert comum.papeis == [], "chamar admin() no builder mudou um usuário já construído"' },
        ],
        reviews: [
          {
            when: m => m.mutableDefaults > 0,
            text: 'Você usou uma lista ou um dict como **valor padrão de parâmetro** (`def f(x=[])`). Esse padrão é criado **uma vez só**, na definição da função, e compartilhado entre as chamadas — exatamente o estado vazado que um builder precisa evitar. Use `None` e crie a lista dentro da função.',
            concept: 'Argumento padrão mutável',
          },
          {
            when: m => m.usesGlobal,
            text: 'Você usou `global` para o contador de e-mails. Funciona, mas um `itertools.count(1)` no nível do módulo dispensa o `global`: `next(_ids)` já devolve o próximo número — é o mesmo papel do `factory.Sequence` do factory_boy.',
            concept: 'Valores únicos',
          },
          {
            when: m => m.calls.includes('validar'),
            text: 'Seu código chama `validar()`. Se o builder validar, fica impossível montar um usuário inválido para testar a própria validação. Deixe a validação para o domínio: o builder só **monta**.',
            concept: 'Builder que valida',
          },
        ],
        hints: [
          'No `__init__`, guarde os padrões em atributos: `self._nome = "Ana"`, `self._idade = 30`, `self._pais = "BR"`, `self._papeis = []`, `self._ativo = True` e `self._email = None` (sem e-mail fixo).',
          'Cada método muda um atributo e termina com `return self` — é isso que permite encadear as chamadas.',
          'No `build()`, use `self._email or f"usuario{next(_ids)}@exemplo.com"`, com `_ids = itertools.count(1)` no nível do módulo, e passe `papeis=list(self._papeis)` — uma **cópia**, para cada usuário ter a sua lista.',
        ],
        solution: `${USUARIO}

_ids = itertools.count(1)          # sequência para gerar e-mails únicos


class UsuarioBuilder:
    def __init__(self):
        self._nome = "Ana"
        self._email = None             # None = gerar um e-mail único no build()
        self._idade = 30
        self._pais = "BR"
        self._papeis = []
        self._ativo = True

    def com_nome(self, nome):
        self._nome = nome
        return self

    def com_email(self, email):
        self._email = email
        return self

    def com_idade(self, idade):
        self._idade = idade
        return self

    def do_pais(self, pais):
        self._pais = pais
        return self

    def admin(self):
        self._papeis.append("admin")
        return self

    def inativo(self):
        self._ativo = False
        return self

    def build(self):
        email = self._email or f"usuario{next(_ids)}@exemplo.com"
        return Usuario(self._nome, email, self._idade, self._pais,
                       papeis=list(self._papeis), ativo=self._ativo)


def um_usuario():
    return UsuarioBuilder()
`,
        solutionExplanation: 'Os padrões descrevem o usuário mais **comum e sem graça** possível — válido, ativo, sem papéis —, então cada teste só declara a diferença. O `return self` cria a interface fluente. O `itertools.count` gera **valores únicos** a cada `build()` (como o `Sequence` do factory_boy), evitando colisões em restrições `UNIQUE`. E o `build()` copia a lista de papéis: sem a cópia, todos os usuários do mesmo builder dividiriam **a mesma lista**, e mexer em um mudaria os outros. Repare também no que o builder **não** faz: validar — ele precisa conseguir montar o usuário de 16 anos para você testar a validação.',
      },
      {
        type: 'pytest',
        id: 'tst-tdb-q4',
        concept: 'Especificar só o que importa',
        title: 'Reembolso: testes que dizem só o que importa',
        module: 'reembolso',
        say: 'Agora com um builder de verdade. Os bugs que plantei só aparecem quando o teste diz **exatamente** o que importa.',
        prompt: `O arquivo \`reembolso.py\` tem a regra \`pode_reembolsar(pedido, hoje)\` e, no fim, um **Test Data Builder** pronto: \`um_pedido()\`, com padrões sensatos (cliente comum, uma caneca, status \`"entregue"\`, entregue em 01/03/2024) e os métodos \`de_cliente_vip()\`, \`com_item(...)\`, \`com_status(...)\` e \`entregue_em(...)\`.

Escreva testes que cubram **cada regra** da docstring — com seus **limites** e **combinações**. Use o builder para que cada teste mencione **só** o que importa para ele. Pelo menos **4 testes**.`,
        implementation: REEMBOLSO,
        starter: `from datetime import date

from reembolso import pode_reembolsar, um_pedido


def test_pedido_comum_dentro_do_prazo_pode_ser_reembolsado():
    pedido = um_pedido().build()                     # entregue em 01/03/2024
    assert pode_reembolsar(pedido, hoje=date(2024, 3, 2)) is True
`,
        minTests: 4,
        mutants: [
          {
            name: 'o 7º dia após a entrega já é recusado (< em vez de <=)',
            code: mut('return hoje <= pedido.entregue_em', 'return hoje < pedido.entregue_em'),
            why: 'faltou o **limite**: entregue em 01/03, o dia 08/03 ainda está no prazo. Testes longe do limite (dia 2, dia 20) não percebem a troca.',
            concept: 'Valores-limite',
          },
          {
            name: 'prazo de 30 dias do VIP ignorado',
            code: mut('prazo = 30 if pedido.cliente.vip else 7', 'prazo = 7'),
            why: 'faltou um cliente **VIP** fora dos 7 dias e dentro dos 30 — com o builder, é uma linha: `um_pedido().de_cliente_vip()`.',
            concept: 'Especificar só o que importa',
          },
          {
            name: 'só o primeiro item é conferido',
            code: mut('if any(item.em_promocao for item in pedido.itens):', 'if pedido.itens[0].em_promocao:'),
            why: 'faltou um pedido com item em promoção **depois** de um item comum. Com `com_item(em_promocao=True)`, o item entra depois da caneca padrão e o bug aparece.',
            concept: 'Casos de borda',
          },
          {
            name: 'só pedidos cancelados são recusados',
            code: mut('if pedido.status != "entregue":', 'if pedido.status == "cancelado":'),
            why: 'faltou um pedido **ainda não entregue** (`"pago"` ou `"enviado"`): testar só o cancelado não pega a regra trocada.',
            concept: 'Partição de equivalência',
          },
          {
            name: 'cliente VIP escapa da regra da promoção',
            code: mut('    if any(item.em_promocao for item in pedido.itens):\n        return False\n    prazo = 30 if pedido.cliente.vip else 7',
              '    if pedido.cliente.vip:\n        return hoje <= pedido.entregue_em + timedelta(days=30)\n    if any(item.em_promocao for item in pedido.itens):\n        return False\n    prazo = 7'),
            why: 'faltou **combinar** regras: um VIP que comprou item em promoção também não tem reembolso. Com o builder, a combinação cabe numa linha: `um_pedido().de_cliente_vip().com_item(em_promocao=True)`.',
            concept: 'Combinação de regras',
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('um_pedido'),
            text: 'Seus testes não usam o builder `um_pedido()`. Montar os pedidos à mão repete o Arrange e espalha **informação irrelevante**: o leitor não sabe qual campo decide o resultado. Com o builder, cada teste declara só a diferença.',
            concept: 'Test Data Builder',
          },
          {
            when: m => ['Pedido', 'Cliente', 'Item'].some(c => m.calls.includes(c)),
            text: 'Você chamou os construtores de `Pedido`/`Cliente`/`Item` direto no teste. Quando um deles ganhar um campo obrigatório, todos esses testes quebram; passando pelo builder, só o builder muda.',
            concept: 'Fragilidade de testes',
          },
        ],
        hints: [
          'Teste uma regra por vez, mudando **só** o campo que importa: `um_pedido().com_status("enviado")`, `um_pedido().de_cliente_vip()`, `um_pedido().com_item(em_promocao=True)`.',
          'Limites do prazo: entregue em 01/03, o dia **08/03** ainda vale e o **09/03** não. Para VIP, **31/03** vale e **01/04** não.',
          'Pense nas **combinações**: um cliente VIP escapa da regra da promoção? `um_pedido().de_cliente_vip().com_item(em_promocao=True)` responde.',
        ],
        solution: `from datetime import date

import pytest

from reembolso import pode_reembolsar, um_pedido

ENTREGA = date(2024, 3, 1)


@pytest.mark.parametrize("hoje, esperado", [
    (date(2024, 3, 2), True),
    (date(2024, 3, 8), True),       # 7º dia após a entrega: ainda vale
    (date(2024, 3, 9), False),      # 8º dia: fora do prazo
])
def test_prazo_comum_de_7_dias(hoje, esperado):
    pedido = um_pedido().entregue_em(ENTREGA).build()
    assert pode_reembolsar(pedido, hoje) is esperado


@pytest.mark.parametrize("hoje, esperado", [
    (date(2024, 3, 20), True),      # fora dos 7 dias, dentro dos 30
    (date(2024, 3, 31), True),      # 30º dia
    (date(2024, 4, 1), False),      # 31º dia
])
def test_cliente_vip_tem_30_dias(hoje, esperado):
    pedido = um_pedido().de_cliente_vip().entregue_em(ENTREGA).build()
    assert pode_reembolsar(pedido, hoje) is esperado


@pytest.mark.parametrize("status", ["pago", "enviado", "cancelado"])
def test_pedido_nao_entregue_nao_tem_reembolso(status):
    pedido = um_pedido().com_status(status).entregue_em(ENTREGA).build()
    assert pode_reembolsar(pedido, date(2024, 3, 2)) is False


def test_item_em_promocao_bloqueia_o_reembolso():
    pedido = um_pedido().com_item(em_promocao=True).entregue_em(ENTREGA).build()
    assert pode_reembolsar(pedido, date(2024, 3, 2)) is False


def test_vip_tambem_nao_tem_reembolso_de_item_em_promocao():
    pedido = um_pedido().de_cliente_vip().com_item(em_promocao=True).entregue_em(ENTREGA).build()
    assert pode_reembolsar(pedido, date(2024, 3, 2)) is False
`,
        solutionExplanation: 'Cada teste declara apenas o que o diferencia do pedido padrão — `de_cliente_vip()`, `com_status("pago")`, `com_item(em_promocao=True)` —, então o nome e a linha do builder contam a regra testada. Os limites dos dois prazos (8º e 31º dias) matam o `<` no lugar de `<=` e o prazo VIP ignorado; os status não entregues pegam a regra trocada; o item em promoção entra **depois** da caneca padrão, o que pega quem só confere o primeiro item; e a **combinação** VIP + promoção pega o atalho que deixava o VIP escapar da regra. Sem o builder, cada um desses testes teria dez linhas de Arrange.',
      },
      {
        type: 'open',
        id: 'tst-tdb-q5',
        concept: 'Object Mother',
        say: 'Última, como numa conversa sobre a arquitetura dos testes do time.',
        prompt: 'O `ObjectMother` do seu time já tem **60 métodos** (`pedido_vip_com_cupom_expirado()`, `pedido_vip_com_cupom_expirado_e_frete_internacional()`…), e cada mudança no construtor de `Pedido` quebra dezenas de testes. **O que você proporia — e como garantiria que os testes continuem legíveis?**',
        minWords: 25,
        rubric: [
          { label: 'Propõe **Test Data Builder** (ou factories) com **padrões sensatos** no lugar da explosão de métodos', keywords: ['builder', 'fluente', 'padrao sensat', 'padroes sensat', 'valores padrao', 'valor padrao', 'default', 'factory', 'factories', 'fabrica'], concept: 'Test Data Builder' },
          { label: 'Cada teste **especifica só o que importa** (sem informação irrelevante)', keywords: ['so o que importa', 'somente o que importa', 'apenas o que importa', 'so o necessario', 'apenas o necessario', 'irrelevante', 'relevante', 'so a diferenca', 'o que muda', 'ruido'], concept: 'Informação irrelevante' },
          { label: 'Centraliza a **construção** num lugar só, para mudanças no construtor não quebrarem os testes', keywords: ['um so lugar', 'um lugar so', 'unico lugar', 'centraliz', 'construtor', 'campo novo', 'campo obrigatorio', 'fragil', 'manutenc'], concept: 'Fragilidade de testes' },
          { label: 'Evita o **Mystery Guest**: os dados que decidem o resultado ficam visíveis no próprio teste', keywords: ['mystery', 'misterio', 'visivel', 'visiveis', 'dentro do teste', 'no proprio teste', 'escondid', 'legib'], concept: 'Mystery Guest', why: 'Trocar 60 métodos de nome enigmático por dados escondidos em outro lugar só muda o problema de endereço.' },
        ],
        modelAnswer: `Eu trocaria a explosão de métodos por um **Test Data Builder** (ou factories, como o factory_boy): um \`um_pedido()\` com padrões sensatos — um pedido válido e comum — e métodos fluentes como \`de_cliente_vip()\`, \`com_cupom(expirado=True)\` e \`com_frete_internacional()\`, que se **combinam** em vez de exigir um método para cada combinação.

Assim cada teste declara só o que importa para ele — \`um_pedido().de_cliente_vip().com_cupom(expirado=True).build()\` —, sem informação irrelevante e sem depender de um método cujo nome eu preciso decifrar.

A construção fica centralizada num só lugar: se o construtor de \`Pedido\` ganhar um campo obrigatório, eu ajusto o builder e os testes não quebram.

E eu cuidaria para não criar um **Mystery Guest**: os dados que decidem o resultado ficam visíveis no próprio teste, e não escondidos numa fixture distante ou num arquivo. Os métodos mais usados da mãe podem até continuar existindo, mas implementados em cima do builder.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora seus testes montam dados sem sofrimento: **builders** com padrões sensatos, **factories** como fixtures e, quando fizer sentido, um Object Mother enxuto.',
          'E a regra de ouro fica: cada teste mostra **tudo o que importa e só o que importa** — nada de mystery guests nem de informação irrelevante.',
        ],
        board: null,
      },
    ],
  });
})();
