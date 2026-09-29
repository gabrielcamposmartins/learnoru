(function () {
  const CADASTRO = `class ServicoCadastro:
    """Cadastra usuários e envia um e-mail de boas-vindas.

    Dependências injetadas:
    - repositorio: tem existe(email) -> bool e salvar(usuario: dict)
    - enviador_email: tem enviar(destinatario, mensagem)
    """

    def __init__(self, repositorio, enviador_email):
        self.repositorio = repositorio
        self.enviador_email = enviador_email

    def cadastrar(self, nome, email):
        if self.repositorio.existe(email):
            return False
        self.repositorio.salvar({"nome": nome, "email": email})
        self.enviador_email.enviar(email, f"Bem-vindo(a), {nome}!")
        return True
`;

  const LEMBRETES = `from datetime import datetime, timedelta


def enviar_lembretes(tarefas, agora, notificador):
    """Notifica as tarefas pendentes que vencem nas próximas 24 horas (ou já venceram).

    - tarefas: lista de dicts com "titulo", "prazo" (datetime) e "concluida" (bool)
    - agora: função sem argumentos que devolve o datetime atual (relógio injetado)
    - notificador: objeto com notificar(titulo)
    Devolve quantos lembretes foram enviados.
    """
    limite = agora() + timedelta(hours=24)
    enviados = 0
    for tarefa in tarefas:
        if tarefa["concluida"]:
            continue
        if tarefa["prazo"] <= limite:
            notificador.notificar(tarefa["titulo"])
            enviados += 1
    return enviados
`;

  const mutOf = base => (from, to) => {
    const code = base.replace(from, to);
    if (code === base) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };
  const mutC = mutOf(CADASTRO);
  const mutL = mutOf(LEMBRETES);

  Game.registerModule('testing', {
    id: 'mocks',
    title: 'Dublês de teste e mocks',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'dubles',
    summary: 'Stubs, fakes, spies e mocks; unittest.mock, patch e monkeypatch — e quando NÃO mockar.',
    concepts: ['Dublês de teste', 'unittest.mock', 'patch', 'monkeypatch', 'Injeção de dependência'],
    takeaways: [
      'Dublês substituem dependências difíceis: **stub** e **fake** para verificar **estado**; **mock** e **spy** para verificar **interações**.',
      'Prefira **injetar** as dependências; quando precisar de `patch`, faça-o **onde o nome é usado**, não onde ele foi definido.',
      'Mocke só as **fronteiras** (rede, banco, e-mail, relógio): mockar detalhes internos acopla o teste à implementação.',
      'Um `Mock()` aceita **qualquer** chamada; `create_autospec` (ou `autospec=True` no `patch`) faz o dublê respeitar a interface real e impede que ele "minta".',
      'Nunca dependa do relógio real num teste: injete `agora` e use datas fixas.',
    ],
    glossary: [
      { term: 'Dublê de teste', aliases: ['dublês de teste', 'dublê', 'dublês', 'test double', 'test doubles'], definition: 'Termo de Gerard Meszaros para qualquer objeto que substitui uma dependência real durante um teste — como o dublê de um ator. Os tipos são dummy, stub, fake, spy e mock.' },
      { term: 'Stub', aliases: ['stubs'], definition: 'Dublê que devolve **respostas prontas** (`repo.existe.return_value = False`), sem lógica. Serve para controlar as entradas indiretas do código testado.' },
      { term: 'Fake', aliases: ['fakes'], definition: 'Dublê com uma implementação **funcional, porém simplificada** — como um repositório em memória com um `dict`. Ótimo para verificar estado.' },
      { term: 'Spy', aliases: ['spies'], definition: 'Dublê que **registra** como foi chamado (argumentos, quantidade de chamadas) para o teste verificar depois.' },
      { term: 'Mock', aliases: ['mocks', 'mock object', 'mock objects'], definition: 'Dublê com **expectativas de interação**: o teste verifica se ele foi chamado do jeito certo (`assert_called_once_with`). Em Python, o `unittest.mock.Mock` também faz papel de stub e de spy.' },
      { term: 'Autospec', aliases: ['create_autospec', 'spec_set'], definition: 'Recurso do `unittest.mock` que cria um dublê com a **mesma interface** do objeto real: métodos inexistentes levantam `AttributeError` e chamadas com a assinatura errada levantam `TypeError`.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Até agora testamos funções "puras": entra valor, sai valor. Mas e um código que **envia e-mail**, **grava no banco** ou depende da **hora atual**?',
          'Você não quer mandar e-mail de verdade a cada `pytest`. Para isso existem os **dublês de teste**: objetos que substituem a dependência real durante o teste.',
        ],
        board: {
          title: 'O problema: dependências do mundo real',
          code: `class ServicoCadastro:
    def cadastrar(self, nome, email):
        banco = PostgresRepositorio("postgres://producao")  # 😱 banco real
        if banco.existe(email):
            return False
        banco.salvar({"nome": nome, "email": email})
        SmtpEnviador().enviar(email, "Bem-vindo(a)!")        # 😱 e-mail real
        return True`,
          caption: 'Como testar isso sem banco nem servidor de e-mail? Primeiro passo: **injetar** as dependências (recebê-las no construtor).',
        },
      },
      {
        type: 'say',
        text: [
          '"Mock" virou nome genérico, mas existem **cinco tipos** de dublê, cada um com um propósito.',
          'Saber a diferença é pergunta clássica de entrevista.',
        ],
        board: {
          title: 'Os dublês de teste (Gerard Meszaros)',
          md: `| Dublê | O que faz | Exemplo |
|---|---|---|
| **Dummy** | só preenche um parâmetro; nunca é usado | \`None\` ou \`object()\` num argumento obrigatório |
| **Stub** | devolve **respostas prontas** | \`repo.existe.return_value = False\` |
| **Fake** | implementação **funcional e simples** | repositório em memória com um \`dict\` |
| **Spy** | registra **como** foi chamado, para verificar depois | lista \`enviados\` que guarda as chamadas |
| **Mock** | objeto com **expectativas** de interação verificadas | \`enviador.enviar.assert_called_once_with(...)\` |

> [!dica] Regra prática: use **stub/fake** para *estado* ("qual o resultado?") e **mock/spy** para *interações* ("o e-mail foi enviado?").`,
        },
      },
      {
        type: 'say',
        text: [
          'Em Python, o módulo `unittest.mock` resolve quase tudo. Um `Mock()` aceita qualquer chamada e **grava** todas elas.',
          'Com `return_value` você programa a resposta, com `side_effect` levanta exceções ou devolve uma sequência, e com os `assert_called...` você verifica as interações.',
        ],
        board: {
          title: 'unittest.mock na prática',
          code: `from unittest.mock import Mock
from cadastro import ServicoCadastro


def test_cadastro_novo_envia_boas_vindas():
    repo = Mock()
    repo.existe.return_value = False          # stub: resposta pronta
    enviador = Mock()                          # mock: vamos verificar a interação
    servico = ServicoCadastro(repo, enviador)

    assert servico.cadastrar("Ana", "ana@x.com") is True

    repo.salvar.assert_called_once_with({"nome": "Ana", "email": "ana@x.com"})
    enviador.enviar.assert_called_once_with("ana@x.com", "Bem-vindo(a), Ana!")


def test_falha_no_banco_propaga_erro():
    repo = Mock()
    repo.existe.side_effect = ConnectionError("banco fora do ar")
    ...

# outras verificações úteis:
# mock.assert_not_called()      mock.call_count      mock.call_args`,
          caption: '`MagicMock` é igual ao `Mock`, mas também implementa métodos mágicos (`__len__`, `__iter__`, `__enter__`…).',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E quando o código **não** recebe a dependência, e sim a importa direto? Aí entra o `patch`, que troca o objeto durante o teste.',
          'A pegadinha: faça o patch **onde o nome é usado**, e não onde ele foi definido.',
        ],
        board: {
          title: 'patch e monkeypatch',
          code: `# relatorio.py
from datetime import datetime          # o nome "datetime" agora vive em relatorio

def cabecalho():
    return f"Relatório de {datetime.now():%d/%m/%Y}"


# test_relatorio.py
from unittest.mock import patch
from datetime import datetime as dt
import relatorio

def test_cabecalho_usa_data_de_hoje():
    with patch("relatorio.datetime") as falso:        # ✅ onde é USADO
        falso.now.return_value = dt(2024, 1, 31)
        assert relatorio.cabecalho() == "Relatório de 31/01/2024"

# ❌ patch("datetime.datetime") não afetaria relatorio.py


# A fixture monkeypatch do pytest faz o mesmo, com desfazer automático:
def test_modo_debug(monkeypatch):
    monkeypatch.setenv("DEBUG", "1")
    monkeypatch.setattr(relatorio, "cabecalho", lambda: "fixo")`,
          caption: 'Se você precisa de muitos `patch`, é um sinal de design: provavelmente a dependência deveria ser **injetada**.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o outro lado: **não exagere nos mocks**. Mockar tudo faz o teste verificar *como* o código foi escrito, não *o que* ele faz.',
          'Qualquer refatoração quebra esse tipo de teste, mesmo sem mudar o comportamento. Mocke as **fronteiras** — rede, banco, disco, relógio — e use objetos reais para o resto.',
        ],
        board: {
          title: 'Quando mockar — e quando não',
          md: `| ✅ Bons candidatos a dublê | ❌ Evite mockar |
|---|---|
| Rede / APIs de terceiros | Suas próprias classes de domínio simples |
| Banco de dados (ou use um **fake** em memória) | Estruturas de dados (\`list\`, \`dict\`…) |
| Envio de e-mail / SMS / fila | Funções puras (é só chamar!) |
| Relógio (\`datetime.now\`), aleatoriedade | Detalhes internos da classe testada |

**Sinais de over-mocking:**
- o teste tem mais linhas de configuração de mock do que de verificação
- você verifica a **ordem** de chamadas internas que não importam para o resultado
- o teste passa, mas o sistema real quebra (o mock "mentiu" sobre a dependência)

> [!dica] Um **fake** em memória (ex.: \`RepositorioEmMemoria\` com um \`dict\`) costuma deixar os testes mais legíveis e robustos que um mock configurado chamada a chamada.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Um alerta sobre o `Mock()`: ele é **educado demais**. Aceita qualquer método, com quaisquer argumentos — até os que não existem.',
          'Se a classe real mudar, o mock continua dizendo "sim, senhora". Para isso existe o **autospec**.',
        ],
        board: {
          title: 'Mocks que não mentem: spec e autospec',
          md: `\`\`\`python
from unittest.mock import Mock, create_autospec


class Enviador:
    def enviar(self, destinatario, mensagem): ...


solto = Mock()
solto.envia("ana@x.com")            # nome errado: aceito em silêncio 😬
solto.enviar("ana@x.com")           # faltou a mensagem: aceito também 😬

seguro = create_autospec(Enviador, instance=True)
seguro.envia("ana@x.com")           # AttributeError: esse método não existe
seguro.enviar("ana@x.com")          # TypeError: missing a required argument: 'mensagem'

# com patch: patch("cadastro.Enviador", autospec=True)
\`\`\`

> [!sabia] O próprio \`Mock\` já sofreu com typos: \`enviador.enviar.assert_called_onec()\` (com o erro de digitação) simplesmente **passava**, porque virava um atributo novo e inofensivo. Desde o Python 3.5, nomes que começam com \`assert\` ou \`assret\` levantam \`AttributeError\`, e versões recentes pegam também \`asert\`, \`assrt\` e até \`called_once_with\` sem o \`assert_\` — que, dentro de um \`assert\`, era **sempre verdadeiro**. Quem precisar mesmo desses nomes tem o parâmetro \`unsafe=True\`.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Uma associação, duas perguntas, uma reflexão e dois desafios com dublês.', icon: '🎯' },
      {
        type: 'match',
        id: 'tst-rx-mock1',
        concept: 'Dublês de teste',
        say: 'Aquecimento: qual dublê é cada um?',
        prompt: 'Associe cada **tipo de dublê** ao exemplo que ele descreve.',
        pairs: [
          { left: 'Dummy', right: 'Um `object()` passado só porque o construtor exige um logger que o teste nunca usa' },
          { left: 'Stub', right: '`cotacao.buscar.return_value = 5.0` — só devolve uma resposta pronta' },
          { left: 'Fake', right: 'Um `RepositorioEmMemoria` que guarda e devolve pedidos num `dict` de verdade' },
          { left: 'Spy', right: 'Um notificador que anota numa lista cada mensagem recebida, para o teste conferir depois' },
          { left: 'Mock', right: '`gateway.cobrar.assert_called_once_with(100)` — verifica a interação esperada' },
        ],
        explanation: 'O **dummy** só ocupa um parâmetro; o **stub** controla as entradas do código com respostas prontas; o **fake** é uma implementação simples, mas funcional; o **spy** grava as chamadas para você inspecionar; e o **mock** carrega a **expectativa** da interação. Na prática, o `unittest.mock.Mock` faz papel de stub, spy e mock ao mesmo tempo — mas saber o nome certo ajuda a escolher entre verificar **estado** (stub/fake) e **interação** (spy/mock).',
      },
      {
        type: 'mcq',
        id: 'tst-mock-q1',
        concept: 'Dublês de teste',
        say: 'Qual dublê você escolheria?',
        prompt: 'Você testa um serviço que salva pedidos num repositório. Em vários testes, você quer salvar pedidos e depois **consultá-los**, verificando o estado final. Qual dublê é mais adequado?',
        options: [
          { text: 'Um **fake**: um repositório em memória que realmente guarda e devolve os pedidos.', correct: true, why: 'O fake tem comportamento real (simples), então você verifica o **estado**, e os testes não dependem de como as chamadas foram feitas.' },
          { text: 'Um **dummy**, porque o repositório não importa.', why: 'O repositório importa: você quer salvar e consultar. Dummy só preenche parâmetros não usados.' },
          { text: 'Um **mock** verificando cada `salvar(...)` com `assert_called_with`.', why: 'Funciona, mas acopla o teste à forma das chamadas. Para verificar estado, um fake é mais robusto.' },
          { text: 'O banco de dados de produção, para ter mais realismo.', why: 'Nunca em teste de unidade: lento, não isolado e perigoso. Para realismo, faça testes de integração com um banco de teste.' },
        ],
        explanation: '**Fakes** são implementações simplificadas, mas funcionais: ótimos para verificar **estado** (salvou → consulta → está lá). **Mocks** brilham quando o que importa é a **interação** em si, como "enviou o e-mail com esta mensagem".',
      },
      {
        type: 'mcq',
        id: 'tst-mock-q2',
        concept: 'patch',
        say: 'E essa pegadinha do patch?',
        prompt: `O arquivo \`pagamentos.py\` tem \`from gateway import cobrar\` e usa \`cobrar(...)\` dentro de \`finalizar_pedido()\`. Qual patch faz o teste **não** chamar o gateway real?`,
        options: [
          { text: '`patch("pagamentos.cobrar")`', correct: true, why: 'O `from ... import` criou o nome `cobrar` dentro de `pagamentos`; é esse nome que `finalizar_pedido` procura.' },
          { text: '`patch("gateway.cobrar")`', why: 'Troca o nome dentro de `gateway`, mas `pagamentos` já guardou a referência à função original quando fez o import.' },
          { text: '`patch("cobrar")`', why: '`patch` precisa do caminho completo `modulo.nome`.' },
          { text: 'Não dá para usar patch com funções, só com classes.', why: '`patch` substitui qualquer atributo de módulo: funções, classes, constantes…' },
        ],
        explanation: '**Faça o patch onde o nome é usado.** `from gateway import cobrar` copia a referência para o namespace de `pagamentos`. Trocar `gateway.cobrar` depois não afeta essa cópia. (Se o código fizesse `import gateway` e chamasse `gateway.cobrar(...)`, aí o patch seria em `gateway.cobrar`.)',
      },
      {
        type: 'open',
        id: 'tst-mock-q3',
        concept: 'Over-mocking',
        say: 'Reflexão de sênior agora.',
        prompt: 'Quais são os **riscos de usar mocks demais** numa suíte de testes? Como você equilibra isso?',
        minWords: 15,
        rubric: [
          { label: 'Testes acoplados à **implementação** (quebram ao refatorar)', keywords: ['implementa', 'refator', 'acopla', 'fragil', 'detalhe interno', 'detalhes internos'], concept: 'Testar comportamento, não implementação' },
          { label: 'O mock pode **divergir do real** (teste passa, produção quebra)', keywords: ['falsa seguranca', 'falso positivo', 'mentir', 'mente', 'diverg', 'nao reflete', 'producao quebra', 'contrato', 'passa mas'], concept: 'Fidelidade dos dublês' },
          { label: 'Mockar só **fronteiras** (rede, banco, relógio, e-mail)', keywords: ['fronteira', 'borda', 'externo', 'rede', 'banco', 'relogio', 'api', 'i/o', 'io '], concept: 'Mockar fronteiras' },
          { label: 'Preferir **fakes**, objetos reais ou **testes de integração** complementares', keywords: ['fake', 'integrac', 'objeto real', 'objetos reais', 'em memoria', 'injecao'], concept: 'Fakes e testes de integração' },
        ],
        modelAnswer: `O maior risco é o teste ficar **acoplado à implementação**: ele verifica quais métodos internos foram chamados, e não o comportamento. Qualquer **refatoração** quebra o teste, mesmo sem mudar o resultado — e a suíte vira um freio em vez de uma rede de segurança.

Outro risco é a **falsa segurança**: o mock diz que a dependência se comporta de um jeito, mas a real mudou (ou nunca foi assim). O teste passa e a produção quebra.

Para equilibrar, eu mocko só as **fronteiras** — rede, banco, e-mail, relógio — e uso objetos reais para o resto. Quando possível, prefiro **fakes** em memória, que verificam estado. E complemento com alguns **testes de integração** contra as dependências reais, para garantir que o contrato continua válido.`,
      },
      {
        type: 'pytest',
        id: 'tst-mock-q4',
        concept: 'Verificação de interações',
        title: 'Cadastro com repositório e e-mail',
        module: 'cadastro',
        say: 'Primeiro desafio: as dependências já são **injetadas**. Use `Mock` (ou fakes) para verificar o que o serviço faz com elas.',
        prompt: `Escreva testes para \`ServicoCadastro\` do arquivo \`cadastro.py\`.

Verifique não só o valor devolvido, mas as **interações** com as dependências:
- num cadastro novo: salva o usuário **e** envia o e-mail de boas-vindas (para quem? com qual mensagem?);
- num e-mail **já cadastrado**: devolve \`False\` e **não** salva nem envia nada.

Pelo menos **3 testes**.`,
        implementation: CADASTRO,
        starter: `from unittest.mock import Mock
from cadastro import ServicoCadastro


def test_cadastro_novo_devolve_true():
    repo = Mock()
    repo.existe.return_value = False
    enviador = Mock()
    servico = ServicoCadastro(repo, enviador)

    assert servico.cadastrar("Ana", "ana@x.com") is True
`,
        minTests: 3,
        mutants: [
          {
            name: 'não envia o e-mail de boas-vindas',
            code: mutC('        self.enviador_email.enviar(email, f"Bem-vindo(a), {nome}!")\n', ''),
            why: 'verificar só o `True` não basta: faltou `enviador.enviar.assert_called_once_with(...)`.',
            concept: 'Verificação de interações',
          },
          {
            name: 'envia o e-mail para o nome em vez do endereço',
            code: mutC('self.enviador_email.enviar(email, f"Bem-vindo(a), {nome}!")', 'self.enviador_email.enviar(nome, f"Bem-vindo(a), {nome}!")'),
            why: 'verificar só que houve chamada não basta: confira os **argumentos** com `assert_called_once_with`.',
            concept: 'Verificação de argumentos',
          },
          {
            name: 'reenvia boas-vindas para e-mail já cadastrado',
            code: mutC('        if self.repositorio.existe(email):\n            return False',
              '        if self.repositorio.existe(email):\n            self.enviador_email.enviar(email, f"Bem-vindo(a), {nome}!")\n            return False'),
            why: 'faltou o cenário de e-mail **duplicado** com `enviador.enviar.assert_not_called()`.',
            concept: 'Verificar o que NÃO acontece',
          },
          {
            name: 'salva usuário duplicado',
            code: mutC('        if self.repositorio.existe(email):\n            return False',
              '        if self.repositorio.existe(email):\n            self.repositorio.salvar({"nome": nome, "email": email})\n            return False'),
            why: 'no cenário duplicado, faltou `repo.salvar.assert_not_called()`.',
            concept: 'Verificar o que NÃO acontece',
          },
          {
            name: 'salva sem o nome do usuário',
            code: mutC('self.repositorio.salvar({"nome": nome, "email": email})', 'self.repositorio.salvar({"email": email})'),
            why: 'faltou verificar **o que** foi salvo: `repo.salvar.assert_called_once_with({...})`.',
            concept: 'Verificação de argumentos',
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('patch'),
            text: 'Você usou `patch`, mas aqui as dependências já são **injetadas** pelo construtor — basta passar os dublês. Patch desnecessário acopla o teste a detalhes de import.',
            concept: 'Injeção de dependência vs patch',
          },
        ],
        hints: [
          'Depois de chamar `cadastrar`, verifique: `enviador.enviar.assert_called_once_with("ana@x.com", "Bem-vindo(a), Ana!")`.',
          'Verifique também o que foi salvo: `repo.salvar.assert_called_once_with({"nome": "Ana", "email": "ana@x.com"})`.',
          'Cenário duplicado: `repo.existe.return_value = True` e depois `repo.salvar.assert_not_called()` e `enviador.enviar.assert_not_called()`.',
        ],
        solution: `from unittest.mock import Mock
import pytest
from cadastro import ServicoCadastro


@pytest.fixture
def repo():
    r = Mock()
    r.existe.return_value = False
    return r


@pytest.fixture
def enviador():
    return Mock()


def test_cadastro_novo_devolve_true(repo, enviador):
    assert ServicoCadastro(repo, enviador).cadastrar("Ana", "ana@x.com") is True


def test_cadastro_novo_salva_nome_e_email(repo, enviador):
    ServicoCadastro(repo, enviador).cadastrar("Ana", "ana@x.com")
    repo.salvar.assert_called_once_with({"nome": "Ana", "email": "ana@x.com"})


def test_cadastro_novo_envia_boas_vindas_para_o_email(repo, enviador):
    ServicoCadastro(repo, enviador).cadastrar("Ana", "ana@x.com")
    enviador.enviar.assert_called_once_with("ana@x.com", "Bem-vindo(a), Ana!")


def test_email_duplicado_nao_salva_nem_envia(repo, enviador):
    repo.existe.return_value = True

    resultado = ServicoCadastro(repo, enviador).cadastrar("Ana", "ana@x.com")

    assert resultado is False
    repo.salvar.assert_not_called()
    enviador.enviar.assert_not_called()
`,
        solutionExplanation: 'Os mocks funcionam como **stub** (`existe.return_value`) e como **mock** (verificação das chamadas). `assert_called_once_with` pega tanto a ausência da chamada quanto argumentos errados; `assert_not_called` verifica o que **não** pode acontecer no caminho do e-mail duplicado — um cenário que o caminho feliz nunca exercita.',
      },
      {
        type: 'pytest',
        id: 'tst-mock-q5',
        concept: 'Relógio injetado',
        title: 'Lembretes com relógio controlado',
        module: 'lembretes',
        say: 'Segundo desafio: código que depende do **tempo**. O segredo é controlar o relógio no teste.',
        prompt: `Escreva testes para \`enviar_lembretes(tarefas, agora, notificador)\` do arquivo \`lembretes.py\`.

O relógio é **injetado** (\`agora\` é uma função): nos testes, passe uma função que devolve uma data **fixa**, como \`lambda: datetime(2024, 1, 10, 9, 0)\`. Assim o teste é determinístico.

Cubra: tarefa que vence em poucas horas, tarefa que vence **depois** de 24h, tarefa **já vencida**, tarefa **concluída** e o argumento passado ao notificador. Pelo menos **4 testes**.`,
        implementation: LEMBRETES,
        starter: `from datetime import datetime
from unittest.mock import Mock
from lembretes import enviar_lembretes

AGORA = datetime(2024, 1, 10, 9, 0)


def relogio():
    return AGORA


def test_tarefa_que_vence_em_2_horas_gera_lembrete():
    notificador = Mock()
    tarefas = [{"titulo": "Relatório", "prazo": datetime(2024, 1, 10, 11, 0), "concluida": False}]

    assert enviar_lembretes(tarefas, relogio, notificador) == 1
`,
        minTests: 4,
        mutants: [
          {
            name: 'ignora o relógio injetado e usa datetime.now()',
            code: mutL('limite = agora() + timedelta(hours=24)', 'limite = datetime.now() + timedelta(hours=24)'),
            why: 'com uma data **fixa** no passado, faltou um teste em que a tarefa vence **depois** de 24h desse "agora" e não deve gerar lembrete.',
            concept: 'Relógio injetado',
          },
          {
            name: 'notifica tarefas já concluídas',
            code: mutL('        if tarefa["concluida"]:\n            continue\n', ''),
            why: 'faltou um teste com tarefa **concluída** verificando que ela não gera lembrete.',
            concept: 'Partição de equivalência',
          },
          {
            name: 'janela de 48 horas em vez de 24',
            code: mutL('timedelta(hours=24)', 'timedelta(hours=48)'),
            why: 'faltou uma tarefa que vence entre 24h e 48h (ex.: daqui a 30h), que **não** deve ser notificada.',
            concept: 'Valores-limite',
          },
          {
            name: 'não avisa tarefas já vencidas',
            code: mutL('if tarefa["prazo"] <= limite:', 'if agora() <= tarefa["prazo"] <= limite:'),
            why: 'faltou uma tarefa **atrasada** (prazo no passado), que também precisa de lembrete.',
            concept: 'Casos de borda',
          },
          {
            name: 'notifica com o dicionário inteiro em vez do título',
            code: mutL('notificador.notificar(tarefa["titulo"])', 'notificador.notificar(tarefa)'),
            why: 'faltou verificar o **argumento**: `notificador.notificar.assert_called_once_with("Relatório")`.',
            concept: 'Verificação de argumentos',
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('now') || m.calls.includes('today'),
            text: 'Seus testes usam o relógio real (`datetime.now()`/`today()`). Testes que dependem da hora atual são **não determinísticos** (flaky): passam hoje e falham amanhã. Use datas fixas.',
            concept: 'Testes determinísticos',
          },
        ],
        hints: [
          'Com `AGORA = 10/01 09:00`, uma tarefa com prazo `11/01 15:00` (30h depois) **não** deve gerar lembrete.',
          'Uma tarefa atrasada (prazo `09/01`) **deve** gerar lembrete; uma tarefa `"concluida": True` vencendo em 1h, **não**.',
          'Verifique o argumento: `notificador.notificar.assert_called_once_with("Relatório")`.',
        ],
        solution: `from datetime import datetime
from unittest.mock import Mock
import pytest
from lembretes import enviar_lembretes

AGORA = datetime(2024, 1, 10, 9, 0)


def relogio():
    return AGORA


def tarefa(titulo, prazo, concluida=False):
    return {"titulo": titulo, "prazo": prazo, "concluida": concluida}


@pytest.fixture
def notificador():
    return Mock()


def test_tarefa_que_vence_em_2_horas_notifica_pelo_titulo(notificador):
    tarefas = [tarefa("Relatório", datetime(2024, 1, 10, 11, 0))]
    assert enviar_lembretes(tarefas, relogio, notificador) == 1
    notificador.notificar.assert_called_once_with("Relatório")


def test_tarefa_que_vence_depois_de_24h_nao_notifica(notificador):
    tarefas = [tarefa("Planejamento", datetime(2024, 1, 11, 15, 0))]  # 30h depois
    assert enviar_lembretes(tarefas, relogio, notificador) == 0
    notificador.notificar.assert_not_called()


def test_tarefa_atrasada_tambem_notifica(notificador):
    tarefas = [tarefa("Imposto", datetime(2024, 1, 9, 18, 0))]
    assert enviar_lembretes(tarefas, relogio, notificador) == 1


def test_tarefa_concluida_nao_notifica(notificador):
    tarefas = [tarefa("Feita", datetime(2024, 1, 10, 10, 0), concluida=True)]
    assert enviar_lembretes(tarefas, relogio, notificador) == 0
    notificador.notificar.assert_not_called()


def test_tarefa_no_limite_exato_de_24h_notifica(notificador):
    tarefas = [tarefa("Limite", datetime(2024, 1, 11, 9, 0))]
    assert enviar_lembretes(tarefas, relogio, notificador) == 1
`,
        solutionExplanation: 'O relógio **injetado** com uma data fixa torna tudo determinístico: o mesmo teste dá o mesmo resultado hoje, amanhã e no CI. Cada partição tem seu teste — dentro da janela, fora dela, atrasada, concluída e o limite exato de 24h — e o `Mock` do notificador verifica o argumento. Repare que nenhum `patch` foi necessário: **injeção de dependência** deixa o código testável por design.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Resumindo: dublês substituem as dependências difíceis — **stub** e **fake** para estado, **mock** e **spy** para interações.',
          'Prefira **injetar** as dependências a usar `patch`, mocke só as **fronteiras**, e nunca dependa do relógio real num teste. No próximo módulo: **TDD**!',
        ],
        board: null,
      },
    ],
  });
})();
