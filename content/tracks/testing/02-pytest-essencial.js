(function () {
  const CONCEITO = `def conceito(nota):
    """Converte uma nota de 0 a 10 em conceito.

    - 9 a 10       -> "A"
    - 7 até < 9    -> "B"
    - 5 até < 7    -> "C"
    - abaixo de 5  -> "D"
    Notas fora do intervalo 0..10 levantam ValueError.
    """
    if not 0 <= nota <= 10:
        raise ValueError("nota deve estar entre 0 e 10")
    if nota >= 9:
        return "A"
    if nota >= 7:
        return "B"
    if nota >= 5:
        return "C"
    return "D"
`;

  const ESTOQUE = `class Estoque:
    """Controle simples de estoque por produto."""

    def __init__(self):
        self._itens = {}

    def adicionar(self, produto, qtd):
        if qtd <= 0:
            raise ValueError("quantidade deve ser positiva")
        self._itens[produto] = self._itens.get(produto, 0) + qtd

    def remover(self, produto, qtd):
        disponivel = self._itens.get(produto, 0)
        if qtd > disponivel:
            raise ValueError(f"estoque insuficiente de {produto}")
        self._itens[produto] = disponivel - qtd

    def quantidade(self, produto):
        return self._itens.get(produto, 0)
`;

  const mutOf = base => (from, to) => {
    const code = base.replace(from, to);
    if (code === base) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };
  const mutC = mutOf(CONCEITO);
  const mutE = mutOf(ESTOQUE);

  Game.registerModule('testing', {
    id: 'pytest-essencial',
    title: 'pytest essencial: raises, parametrize, fixtures',
    kind: 'lesson',
    level: 2,
    order: 2,
    unit: 'fundamentos',
    summary: 'Os recursos do pytest que você vai usar todo dia: exceções, testes parametrizados, floats, fixtures e marks.',
    concepts: ['pytest.raises', 'parametrize', 'pytest.approx', 'Fixtures', 'conftest.py'],
    takeaways: [
      '`pytest.raises` testa o **caminho triste** — com `match=` para conferir a mensagem — e, depois do `with`, vale verificar que o estado não mudou.',
      '`@pytest.mark.parametrize` transforma uma tabela de exemplos em testes separados no relatório; `ids=` deixa cada caso legível.',
      'Floats se comparam com **tolerância** — `pytest.approx` ou `math.isclose` —, nunca com `==` puro.',
      '**Fixtures** preparam o cenário e são injetadas pelo nome do parâmetro; com `yield`, fazem a limpeza. O escopo padrão (`function`) garante isolamento.',
      'Marks sinalizam intenção: `skip` pula, `xfail` documenta uma falha conhecida — e `strict=True` avisa quando ela for corrigida.',
    ],
    glossary: [
      { term: 'Fixture', aliases: ['fixtures'], definition: 'Função marcada com `@pytest.fixture` que prepara algo para os testes (dados, conexões, arquivos). O teste a recebe **pelo nome do parâmetro**; com `yield`, ela também faz a limpeza depois.' },
      { term: 'parametrize', aliases: ['pytest.mark.parametrize', 'teste parametrizado', 'testes parametrizados'], definition: 'Marca do pytest que roda o mesmo teste com vários conjuntos de argumentos; cada tupla vira um teste separado no relatório (ex.: `test_conceito[nove]`).' },
      { term: 'conftest.py', aliases: ['conftest'], definition: 'Arquivo especial do pytest: fixtures e hooks definidos nele ficam disponíveis para todos os testes da pasta (e das subpastas), **sem import**.' },
      { term: 'xfail', aliases: ['XPASS', 'falha esperada', 'falhas esperadas'], definition: 'Marca de **falha esperada** (ex.: um bug conhecido): o teste roda, mas não quebra a suíte. Com `strict=True`, se ele passar de repente (**XPASS**), a suíte falha — e você descobre que o bug foi corrigido.' },
      { term: 'Assertion rewriting', aliases: ['reescrita de asserts', 'reescrita de assert', 'assert rewriting'], definition: 'Mecanismo do pytest que reescreve a AST dos módulos de teste na importação, transformando cada `assert` num código que guarda os valores intermediários — é daí que vêm as mensagens detalhadas das falhas.' },
      { term: 'pytest.approx', aliases: ['approx'], definition: 'Comparação com tolerância para floats (e listas ou dicts de floats): `0.1 + 0.2 == pytest.approx(0.3)`. A tolerância padrão é relativa (1e-6); ajuste com `rel=` ou `abs=`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Agora que você sabe escrever um teste, vamos ver as ferramentas do `pytest` que fazem a diferença no dia a dia.',
          'Primeira: testar que o código **falha do jeito certo**. Para isso existe o `pytest.raises`.',
        ],
        board: {
          title: 'Testando exceções — pytest.raises',
          code: `import pytest
from conta import Conta


def test_saque_maior_que_saldo_levanta_erro():
    conta = Conta(saldo=100)

    with pytest.raises(ValueError, match="saldo insuficiente"):
        conta.sacar(150)


def test_saque_invalido_nao_altera_o_saldo():
    conta = Conta(saldo=100)
    with pytest.raises(ValueError):
        conta.sacar(150)
    assert conta.saldo == 100     # depois do with, verifique o estado`,
          caption: '`match=` é uma expressão regular aplicada à mensagem. Se o bloco **não** levantar a exceção, o teste falha.',
        },
      },
      {
        type: 'say',
        text: [
          'Segunda: quando você quer o **mesmo teste com vários exemplos**, não copie e cole. Use `@pytest.mark.parametrize`.',
          'Cada tupla vira um teste separado no relatório. Se um exemplo falhar, você vê exatamente qual.',
        ],
        board: {
          title: '@pytest.mark.parametrize',
          code: `import pytest
from texto import eh_palindromo


@pytest.mark.parametrize("texto, esperado", [
    ("arara", True),
    ("Arara", True),          # maiúsculas
    ("a man a plan", False),
    ("", True),               # caso de borda: vazio
    ("ab", False),
], ids=["simples", "maiuscula", "frase", "vazio", "dois-chars"])
def test_eh_palindromo(texto, esperado):
    assert eh_palindromo(texto) is esperado`,
          caption: 'No relatório: `test_eh_palindromo[simples]`, `test_eh_palindromo[vazio]`… O `ids=` é opcional, mas deixa a saída legível.',
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Terceira, uma pegadinha clássica: em Python, `0.1 + 0.2 == 0.3` é **False**!',
          'Floats são aproximações binárias. Para compará-los em testes, use `pytest.approx`.',
        ],
        board: {
          title: 'Floats: pytest.approx',
          code: `>>> 0.1 + 0.2
0.30000000000000004
>>> 0.1 + 0.2 == 0.3
False

# no teste:
import pytest

def test_media():
    assert media([0.1, 0.2]) == pytest.approx(0.15)

def test_lista_de_floats():
    assert converter([1, 2]) == pytest.approx([0.33, 0.67], abs=0.01)`,
          caption: 'Por padrão a tolerância é relativa (1e-6). Dá para ajustar com `rel=` ou `abs=`.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Quarta, e talvez a mais poderosa: **fixtures**. Elas preparam o que o teste precisa e são **injetadas pelo nome do parâmetro**.',
          'Com `yield`, a fixture também faz a **limpeza** depois do teste, mesmo se ele falhar.',
        ],
        board: {
          title: 'Fixtures',
          code: `import pytest
from estoque import Estoque


@pytest.fixture
def estoque():
    # Arrange compartilhado: cada teste recebe um Estoque NOVO
    e = Estoque()
    e.adicionar("caneta", 10)
    return e


@pytest.fixture
def estoque_com_lapis(estoque):          # fixture usando fixture
    estoque.adicionar("lapis", 3)
    return estoque


@pytest.fixture
def conexao():
    con = abrir_conexao()
    yield con                              # o teste roda aqui
    con.fechar()                           # teardown: sempre executa


def test_remover_diminui_quantidade(estoque):
    estoque.remover("caneta", 4)
    assert estoque.quantidade("caneta") == 6`,
        },
      },
      {
        type: 'say',
        text: [
          'Detalhes que aparecem em entrevistas: o **escopo** da fixture, o `conftest.py` e as fixtures prontas, como `tmp_path`.',
          'E os **marks**: `skip` para pular um teste e `xfail` para marcar uma falha esperada, como um bug conhecido.',
        ],
        board: {
          title: 'Escopo, conftest.py, tmp_path e marks',
          md: `| Recurso | Para quê |
|---|---|
| \`@pytest.fixture(scope="function")\` | padrão: recriada para **cada teste** (isolamento) |
| \`scope="module"\` / \`"session"\` | criada uma vez — útil para coisas caras (ex.: subir um banco) |
| \`conftest.py\` | fixtures definidas ali ficam disponíveis para todos os testes da pasta, **sem import** |
| \`tmp_path\` | fixture pronta: um diretório temporário exclusivo do teste (\`pathlib.Path\`) |
| \`monkeypatch\` | fixture pronta para trocar atributos/variáveis de ambiente durante o teste |
| \`@pytest.mark.skip(reason=...)\` | pula o teste |
| \`@pytest.mark.xfail\` | falha **esperada** — não quebra a suíte |

\`\`\`python
def test_salva_relatorio(tmp_path):
    arquivo = tmp_path / "relatorio.txt"
    salvar_relatorio(arquivo, ["a", "b"])
    assert arquivo.read_text() == "a\\nb"
\`\`\`

> [!atencao] Fixtures com escopo amplo compartilham estado entre testes. Se um teste modificar o objeto, o próximo vê a modificação.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Uma curiosidade: já se perguntou como um `assert` **puro** do Python mostra os valores de cada lado quando falha?',
          'Não é mágica: o pytest **reescreve** os seus testes na hora de importá-los. E isso tem uma pegadinha que pouca gente conhece.',
        ],
        board: {
          title: 'Por baixo do capô: assertion rewriting',
          md: `Ao importar um arquivo de teste, o pytest reescreve a **AST** de cada \`assert\`, guardando os valores intermediários para montar a mensagem de erro:

\`\`\`python
# o que você escreve
assert conceito(nota) == esperado

# o que roda (bem simplificado)
_obtido = conceito(nota)
if not (_obtido == esperado):
    raise AssertionError(f"assert {_obtido!r} == {esperado!r}")
\`\`\`

> [!sabia] A reescrita só vale para **módulos de teste**, \`conftest.py\` e plugins. Um \`assert\` dentro de um helper comum (\`tests/verificacoes.py\`) falha com um \`AssertionError\` **sem detalhes** — a não ser que você chame \`pytest.register_assert_rewrite("tests.verificacoes")\` no \`conftest.py\`, antes de importar o helper.
>
> Bônus: com \`@pytest.mark.xfail(strict=True)\` (ou \`xfail_strict = true\` na configuração), um teste marcado como falha esperada que **passa** de repente (o XPASS) quebra a suíte — assim ninguém esquece a marca lá depois que o bug é corrigido.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Três perguntas e dois desafios de escrever testes.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-pyess-q1',
        concept: 'pytest.approx',
        say: 'Esse aqui derruba muita gente…',
        prompt: `Este teste **falha**. Por quê, e qual a correção adequada?

\`\`\`python
def test_total_com_imposto():
    assert preco_com_imposto(0.1, taxa=2) == 0.2 + 0.1
\`\`\``,
        options: [
          { text: 'Floats são aproximações binárias; use `assert ... == pytest.approx(0.3)`.', correct: true, why: '`pytest.approx` compara com tolerância, que é o correto para floats.' },
          { text: 'O `assert` não funciona com floats; é preciso usar `self.assertEqual`.', why: '`assert` funciona com qualquer valor; o problema é a igualdade exata de floats. E `self.assertEqual` é do unittest.' },
          { text: 'Converter os dois lados com `int()` antes de comparar.', why: 'Isso esconde erros reais: `int(0.3)` e `int(0.9)` dão os dois `0`.' },
          { text: 'Usar `round(x, 1)` sempre resolve e é equivalente ao approx.', why: 'Arredondar às vezes funciona, mas escolher a casa decimal é frágil; o `approx` expressa a intenção e dá mensagens de erro melhores.' },
        ],
        explanation: '`0.1 + 0.2` vale `0.30000000000000004` por causa da representação binária. Para floats, compare com **tolerância**: `pytest.approx` (ou `math.isclose`). Dinheiro de verdade costuma usar `Decimal` ou centavos inteiros.',
      },
      {
        type: 'mcq',
        id: 'tst-pyess-q2',
        concept: 'Fixtures',
        say: 'Agora sobre fixtures e isolamento.',
        prompt: `Qual o risco desta fixture?

\`\`\`python
@pytest.fixture(scope="module")
def carrinho():
    return Carrinho()
\`\`\``,
        options: [
          { text: 'O mesmo `Carrinho` é compartilhado por todos os testes do módulo; um teste que adiciona itens afeta os outros, e o resultado passa a depender da ordem.', correct: true, why: 'Escopo `module` cria o objeto uma única vez. Estado mutável compartilhado quebra o isolamento.' },
          { text: 'Nenhum: fixtures sempre são recriadas para cada teste.', why: 'Só no escopo padrão (`function`). Com `scope="module"`, ela é criada uma vez por arquivo.' },
          { text: 'O pytest não aceita `scope` em fixtures que retornam objetos.', why: '`scope` funciona para qualquer fixture.' },
          { text: 'A fixture deveria usar `yield` em vez de `return` para ser válida.', why: '`return` é válido; `yield` só é necessário quando há limpeza (teardown).' },
        ],
        explanation: 'Escopos amplos (`module`, `session`) servem para recursos **caros e imutáveis**, como uma conexão. Para objetos com estado, use o escopo padrão `function`: cada teste recebe uma instância nova e os testes ficam **independentes da ordem**.',
      },
      {
        type: 'match',
        id: 'tst-rx-pyess1',
        concept: 'Resultados do pytest',
        say: 'Agora, leitura de relatório: o que cada letrinha do `pytest -q` quer dizer?',
        prompt: 'Na saída resumida do pytest (ex.: `..F.sxXE`), associe cada **símbolo** ao que aconteceu com o teste.',
        pairs: [
          { left: '`.`', right: 'Passou' },
          { left: '`F`', right: 'Falhou: um `assert` não passou ou o próprio teste levantou uma exceção' },
          { left: '`E`', right: 'Erro na preparação ou na limpeza — por exemplo, uma fixture que quebrou' },
          { left: '`s`', right: 'Pulado com `skip` ou `skipif`' },
          { left: '`x`', right: 'Falhou, mas estava marcado com `xfail` (falha esperada)' },
          { left: '`X`', right: 'Estava marcado com `xfail`, mas passou (XPASS)' },
        ],
        explanation: 'O `-q` resume cada teste num símbolo. A diferença entre **`F`** e **`E`** é **onde** o problema aconteceu: `F` é o próprio teste falhando (um assert ou qualquer exceção dentro dele); `E` é um erro na **preparação ou na limpeza**, como uma fixture quebrada — o teste nem chegou a ser avaliado. **`x`** é uma falha esperada, que não quebra a suíte, e **`X`** é o XPASS: o teste marcado com `xfail` passou. Com `strict=True`, esse XPASS vira falha, para você lembrar de tirar a marca.',
      },
      {
        type: 'pytest',
        id: 'tst-pyess-q3',
        concept: 'parametrize',
        title: 'Conceitos de nota com parametrize',
        module: 'notas',
        say: 'Primeiro desafio: vários exemplos, **um** teste parametrizado. E capriche nos limites!',
        prompt: `Escreva testes para \`conceito(nota)\` do arquivo \`notas.py\`.

- Use **\`@pytest.mark.parametrize\`** para cobrir vários exemplos com um único teste.
- Os bugs mais comuns aqui estão nas **fronteiras** entre os conceitos (9, 7, 5) e nos **extremos válidos** (0 e 10).
- Pelo menos **6 casos** (cada exemplo do parametrize conta como um teste).`,
        implementation: CONCEITO,
        starter: `import pytest
from notas import conceito


@pytest.mark.parametrize("nota, esperado", [
    (9.5, "A"),
    # adicione mais casos — principalmente os limites!
])
def test_conceito(nota, esperado):
    assert conceito(nota) == esperado
`,
        minTests: 6,
        mutants: [
          {
            name: 'nota 9 vira B (> em vez de >=)',
            code: mutC('if nota >= 9:', 'if nota > 9:'),
            why: 'faltou o caso **exatamente 9**, a fronteira entre A e B.',
            concept: 'Valores-limite',
          },
          {
            name: 'fronteira do B deslocada para 8',
            code: mutC('if nota >= 7:', 'if nota >= 8:'),
            why: 'faltou testar a nota **7**, o início do B.',
            concept: 'Valores-limite',
          },
          {
            name: 'nota 5 vira D (> em vez de >=)',
            code: mutC('if nota >= 5:', 'if nota > 5:'),
            why: 'faltou testar a nota **5**, o início do C.',
            concept: 'Valores-limite',
          },
          {
            name: 'nota 10 é rejeitada como inválida',
            code: mutC('if not 0 <= nota <= 10:', 'if not 0 <= nota < 10:'),
            why: 'o extremo **válido** 10 não foi testado.',
            concept: 'Extremos do domínio',
          },
        ],
        reviews: [
          {
            when: m => !m.decorators.includes('parametrize'),
            text: 'Você não usou `@pytest.mark.parametrize`. Vários testes quase iguais viram duplicação; o parametrize deixa os exemplos numa tabela e cada um aparece separado no relatório.',
            concept: 'parametrize',
          },
        ],
        hints: [
          'Para cada fronteira, teste o valor **exato**: `(9, "A")`, `(7, "B")`, `(5, "C")`.',
          'Não esqueça os extremos válidos: `(10, "A")` e `(0, "D")`.',
          'Um valor logo abaixo de cada fronteira também ajuda: `(8.9, "B")`, `(6.9, "C")`, `(4.9, "D")`.',
        ],
        solution: `import pytest
from notas import conceito


@pytest.mark.parametrize("nota, esperado", [
    (10, "A"),
    (9, "A"),
    (8.9, "B"),
    (7, "B"),
    (6.9, "C"),
    (5, "C"),
    (4.9, "D"),
    (0, "D"),
], ids=["dez", "nove", "quase-nove", "sete", "quase-sete", "cinco", "quase-cinco", "zero"])
def test_conceito(nota, esperado):
    assert conceito(nota) == esperado
`,
        solutionExplanation: 'Para cada fronteira, um caso **no** limite e outro **logo abaixo** — é a análise de valor-limite. Os extremos 0 e 10 garantem que o domínio válido inteiro está aceito. Com `parametrize`, os oito exemplos cabem numa tabela e cada um aparece com seu `id` no relatório.',
      },
      {
        type: 'pytest',
        id: 'tst-pyess-q4',
        concept: 'pytest.raises',
        title: 'Estoque: exceções e fixtures',
        module: 'estoque',
        say: 'Segundo desafio: testar também o **caminho triste**. Use uma fixture para não repetir o Arrange.',
        prompt: `Escreva testes para a classe \`Estoque\` do arquivo \`estoque.py\`.

- Crie uma **fixture** que devolve um estoque já com algum produto.
- Teste o caminho feliz (adicionar, remover, consultar)…
- …e o **caminho triste** com \`pytest.raises\`: quantidades inválidas e remoção maior que o disponível.
- Pelo menos **5 testes**.`,
        implementation: ESTOQUE,
        starter: `import pytest
from estoque import Estoque


@pytest.fixture
def estoque():
    e = Estoque()
    e.adicionar("caneta", 10)
    return e


def test_remover_diminui_a_quantidade(estoque):
    estoque.remover("caneta", 4)
    assert estoque.quantidade("caneta") == 6
`,
        minTests: 5,
        mutants: [
          {
            name: 'adicionar aceita quantidade zero ou negativa',
            code: mutE('        if qtd <= 0:\n            raise ValueError("quantidade deve ser positiva")\n', ''),
            why: 'faltou um `pytest.raises(ValueError)` para `adicionar` com quantidade inválida.',
            concept: 'pytest.raises',
          },
          {
            name: 'remover tudo o que há em estoque é recusado',
            code: mutE('if qtd > disponivel:', 'if qtd >= disponivel:'),
            why: 'faltou o limite: remover **exatamente** a quantidade disponível deve funcionar e zerar o estoque.',
            concept: 'Valores-limite',
          },
          {
            name: 'remover além do disponível zera em silêncio',
            code: mutE('        if qtd > disponivel:\n            raise ValueError(f"estoque insuficiente de {produto}")\n        self._itens[produto] = disponivel - qtd',
              '        self._itens[produto] = max(0, disponivel - qtd)'),
            why: 'faltou verificar que remover mais do que existe **levanta erro** em vez de "dar um jeito".',
            concept: 'pytest.raises',
          },
          {
            name: 'adicionar sobrescreve em vez de somar',
            code: mutE('self._itens[produto] = self._itens.get(produto, 0) + qtd', 'self._itens[produto] = qtd'),
            why: 'faltou adicionar o **mesmo produto duas vezes** e conferir a soma.',
            concept: 'Estado acumulado',
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('raises'),
            text: 'Seus testes não usam `pytest.raises`: o caminho de erro ficou sem verificação explícita.',
            concept: 'pytest.raises',
          },
          {
            when: m => !m.decorators.includes('fixture'),
            text: 'Você não criou nenhuma `@pytest.fixture` — o Arrange repetido em cada teste vira duplicação.',
            concept: 'Fixtures',
          },
        ],
        hints: [
          'Caminho triste: `with pytest.raises(ValueError): estoque.adicionar("lapis", 0)`.',
          'Limite: remover **10** de um estoque com 10 canetas deve funcionar e deixar `0`.',
          'Acúmulo: `estoque.adicionar("caneta", 5)` num estoque com 10 deve dar `15`.',
        ],
        solution: `import pytest
from estoque import Estoque


@pytest.fixture
def estoque():
    e = Estoque()
    e.adicionar("caneta", 10)
    return e


def test_produto_desconhecido_tem_quantidade_zero(estoque):
    assert estoque.quantidade("borracha") == 0


def test_adicionar_mesmo_produto_soma_as_quantidades(estoque):
    estoque.adicionar("caneta", 5)
    assert estoque.quantidade("caneta") == 15


@pytest.mark.parametrize("qtd", [0, -3])
def test_adicionar_quantidade_invalida_levanta_erro(estoque, qtd):
    with pytest.raises(ValueError, match="positiva"):
        estoque.adicionar("lapis", qtd)


def test_remover_diminui_a_quantidade(estoque):
    estoque.remover("caneta", 4)
    assert estoque.quantidade("caneta") == 6


def test_remover_tudo_zera_o_estoque(estoque):
    estoque.remover("caneta", 10)
    assert estoque.quantidade("caneta") == 0


def test_remover_mais_que_o_disponivel_levanta_erro_e_nao_altera(estoque):
    with pytest.raises(ValueError, match="insuficiente"):
        estoque.remover("caneta", 11)
    assert estoque.quantidade("caneta") == 10
`,
        solutionExplanation: 'A **fixture** entrega um estoque novo para cada teste, então eles não interferem entre si. Os testes com `pytest.raises` cobrem o caminho triste — e o último ainda confere que a operação inválida **não alterou** o estado. O teste de remover tudo verifica o limite exato; o de somar verifica o estado acumulado.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora você tem as ferramentas principais: `pytest.raises` para erros, `parametrize` para vários exemplos, `approx` para floats e **fixtures** para o Arrange.',
          'No próximo módulo vamos lidar com dependências difíceis de testar — banco, e-mail, relógio — usando **dublês de teste** e mocks.',
        ],
        board: null,
      },
    ],
  });
})();
