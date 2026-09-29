(function () {
  const TAREFAS = `import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY,
    dono TEXT NOT NULL,
    titulo TEXT NOT NULL,
    concluida INTEGER NOT NULL DEFAULT 0,
    UNIQUE (dono, titulo)
)
"""


class TarefaDuplicada(Exception):
    """O mesmo dono já tem uma tarefa com esse título."""


class RepositorioTarefas:
    """Guarda tarefas no SQLite. Toda escrita é confirmada (commit) antes de retornar."""

    def __init__(self, conexao: sqlite3.Connection):
        self.con = conexao
        self.con.execute(SCHEMA)

    def adicionar(self, dono: str, titulo: str) -> int:
        try:
            cur = self.con.execute(
                "INSERT INTO tarefas (dono, titulo) VALUES (?, ?)", (dono, titulo)
            )
        except sqlite3.IntegrityError:
            self.con.rollback()
            raise TarefaDuplicada(f"{dono} já tem a tarefa {titulo!r}") from None
        self.con.commit()
        return cur.lastrowid

    def concluir(self, tarefa_id: int) -> bool:
        cur = self.con.execute(
            "UPDATE tarefas SET concluida = 1 WHERE id = ?", (tarefa_id,)
        )
        self.con.commit()
        return cur.rowcount == 1

    def pendentes(self, dono: str) -> list[str]:
        linhas = self.con.execute(
            "SELECT titulo FROM tarefas WHERE dono = ? AND concluida = 0 ORDER BY id",
            (dono,),
        ).fetchall()
        return [titulo for (titulo,) in linhas]
`;

  const mutT = (from, to) => {
    const code = TAREFAS.replace(from, to);
    if (code === TAREFAS) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };

  Game.registerModule('testing', {
    id: 'testes-integracao',
    title: 'Testes de integração: banco real, contêineres e contratos',
    kind: 'lesson',
    level: 3,
    order: 34,
    unit: 'qualidade',
    summary: 'Testar o código conversando com dependências de verdade — SQLite por fixture, transação por teste, Testcontainers, contratos guiados pelo consumidor — e escolher o formato da suíte.',
    concepts: ['Teste de integração', 'Transação por teste', 'Testcontainers', 'Contract testing', 'Testing trophy'],
    takeaways: [
      'Mock não pega SQL errado, constraint esquecida nem `commit` faltando: para isso existe o teste de **integração** com banco real.',
      'Isole cada teste: banco novo em memória (barato no SQLite) ou **transação por teste com rollback** — com *savepoints* se o código testado faz `commit`.',
      'Se produção roda Postgres, algum teste precisa rodar em Postgres: o **Testcontainers** sobe um contêiner descartável por sessão.',
      '**Contract testing** guiado pelo consumidor (Pact) troca o ambiente e2e compartilhado por contratos verificados no CI do provedor.',
      'Pirâmide, **troféu** e **favo de mel** expressam o mesmo trade-off (confiança × custo); o que importa é cobrir as **fronteiras**, onde os bugs moram.',
    ],
    glossary: [
      { term: 'Teste de integração', aliases: ['testes de integração', 'integration test', 'integration tests'], definition: 'Teste que exercita seu código junto com uma dependência real — banco, fila, sistema de arquivos, outro serviço — para verificar a conversa entre as partes.' },
      { term: 'Testcontainers', aliases: ['testcontainer'], definition: 'Biblioteca (Java, Python, Go, .NET…) que sobe contêineres Docker descartáveis durante os testes — um Postgres, um Kafka — e os destrói no final.' },
      { term: 'Contract testing', aliases: ['teste de contrato', 'testes de contrato', 'consumer-driven contracts', 'contratos guiados pelo consumidor'], definition: 'Testes que verificam o **formato** da conversa entre dois serviços. Na versão guiada pelo consumidor (ex.: Pact), o consumidor gera um contrato com o que usa e o provedor o verifica contra a implementação real.' },
      { term: 'Testing trophy', aliases: ['troféu de testes', 'testing trophy'], definition: 'Formato de suíte proposto por Kent C. Dodds: análise estática na base, poucos unitários, **muitos testes de integração** e poucos e2e.' },
      { term: 'Honeycomb', aliases: ['favo de mel', 'testing honeycomb'], definition: 'Formato de suíte do Spotify para microsserviços: poucos testes de detalhe de implementação, **muitos testes de integração** do serviço e poucos *integrated tests*, que dependem de outros serviços no ar.' },
      { term: 'Polluter', aliases: ['polluters', 'teste poluidor', 'victim', 'teste vítima'], definition: 'Em testes dependentes de ordem, o *polluter* deixa estado compartilhado sujo e o *victim* falha quando roda depois dele — mas passa quando roda sozinho.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Você já testou regras de negócio com unitários e trocou dependências por fakes. Mas quem garante que o **SQL** está certo?',
          'Um mock do banco devolve exatamente o que você mandou devolver. Ele nunca vai reclamar de uma coluna com nome errado, de uma constraint esquecida ou de um `commit` que faltou.',
        ],
        board: {
          title: 'O que só uma dependência real revela',
          md: `\`\`\`python
from unittest.mock import MagicMock


# ✅ verde com mock… e quebrado em produção
def test_pendentes_com_mock():
    con = MagicMock()
    con.execute.return_value.fetchall.return_value = [("Pagar boleto",)]
    repo = RepositorioTarefas(con)
    assert repo.pendentes("ana") == ["Pagar boleto"]
    # o SQL podia estar sem "WHERE dono = ?", com coluna errada
    # ou nem compilar: o mock devolve o que mandaram, sempre
\`\`\`

| Bug | Mock pega? | Banco real pega? |
|---|---|---|
| SQL com erro de sintaxe ou coluna errada | ❌ | ✅ |
| Filtro faltando no \`WHERE\` | ❌ | ✅ |
| \`UNIQUE\`, \`NOT NULL\` ou FK esquecidos no schema | ❌ | ✅ |
| \`commit\` esquecido (o dado some depois) | ❌ | ✅ |
| Migração que não roda | ❌ | ✅ |

> [!dica] Mocks são ótimos para os **papéis** que você define (uma porta \`Notificador\`, por exemplo). Já o adaptador que fala SQL precisa ser testado contra um banco de verdade — é ali que os bugs dele moram.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Em Python, o jeito mais barato de ter banco real é o `sqlite3` da biblioteca padrão com `":memory:"`: cada teste ganha um banco novinho em microssegundos.',
          'Quando o banco é caro de criar — um Postgres com 80 tabelas —, o truque é outro: o schema é criado **uma vez** e cada teste roda dentro de uma **transação** desfeita no final.',
        ],
        board: {
          title: 'Duas formas de isolar testes com banco',
          code: `import sqlite3

import pytest

SCHEMA = "CREATE TABLE tarefas (id INTEGER PRIMARY KEY, dono TEXT, titulo TEXT)"


# 1) Banco NOVO por teste — no SQLite custa microssegundos
@pytest.fixture
def conexao():
    con = sqlite3.connect(":memory:")
    con.execute(SCHEMA)
    yield con
    con.close()


# 2) Schema UMA vez + transação por teste — o padrão para bancos caros de criar
@pytest.fixture(scope="session")
def banco():
    con = sqlite3.connect(":memory:", isolation_level=None)  # nós controlamos BEGIN/ROLLBACK
    con.execute(SCHEMA)
    yield con
    con.close()


@pytest.fixture
def transacao(banco):
    banco.execute("BEGIN")
    yield banco
    banco.execute("ROLLBACK")   # desfaz tudo o que o teste gravou`,
          caption: 'Com o rollback, o próximo teste encontra o banco **exatamente** como estava: sem `DELETE` manual e sem depender da ordem dos testes.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Só que a transação por teste tem uma armadilha clássica: o código testado também faz `commit`.',
          'Esse `commit` confirma a transação **da fixture**. O rollback do final não tem mais o que desfazer, e os dados vazam para o próximo teste.',
        ],
        board: {
          title: 'A armadilha: o código testado faz commit',
          md: `\`\`\`text
fixture:  BEGIN ─────────────────────────────────────── ROLLBACK 💥
código:          INSERT …   con.commit()
                            └─ confirma a transação da fixture: o ROLLBACK
                               falha ("no transaction is active") e o dado fica
\`\`\`

| Saída | Como funciona | Custo |
|---|---|---|
| **Savepoints** | A transação do teste fica por fora; as "confirmações" do código viram \`SAVEPOINT\`/\`RELEASE\` | Rápido. É a ideia por trás do \`TestCase\` do Django e do \`join_transaction_mode="create_savepoint"\` do SQLAlchemy |
| **Unit of Work** | O repositório não faz commit; quem confirma é a camada de serviço, que o teste controla | Pede desenho — e melhora o design |
| **Truncar tabelas** | O código confirma de verdade; um \`DELETE\`/\`TRUNCATE\` limpa depois de cada teste | Mais lento, mas funciona com **várias conexões** e processos |

\`\`\`python
class ConexaoDeTeste:
    """Repassa tudo à conexão real, mas commit() só libera um savepoint."""

    def __init__(self, con):
        self._con = con
        con.execute("SAVEPOINT teste")

    def commit(self):
        self._con.execute("RELEASE SAVEPOINT teste")   # "confirma" DENTRO da transação do teste
        self._con.execute("SAVEPOINT teste")

    def rollback(self):
        self._con.execute("ROLLBACK TO SAVEPOINT teste")

    def __getattr__(self, nome):                       # execute, cursor… vão direto
        return getattr(self._con, nome)
\`\`\`

> [!dica] E para testar que o código **confirma** a gravação? Com uma conexão só, simule a queda: chame \`conexao.rollback()\` logo depois da operação. O que foi commitado sobrevive; o que não foi, some.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Um alerta honesto: SQLite **não é** Postgres. Tipos, funções de data, locks, `ON CONFLICT`… tudo tem diferenças. Se produção roda Postgres, algum teste precisa rodar em Postgres.',
          'Para isso existe o **Testcontainers**: ele sobe um contêiner Docker descartável durante os testes e o destrói no final. Aqui no navegador não dá para rodar, mas o código é assim.',
        ],
        board: {
          title: 'Testcontainers (conceito)',
          md: `\`\`\`python
# pip install "testcontainers[postgres]" psycopg   — precisa de Docker na máquina ou no CI
import psycopg
import pytest
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres_url():
    with PostgresContainer("postgres:16-alpine", driver=None) as pg:  # sobe e espera ficar pronto
        yield pg.get_connection_url()      # porta aleatória: sem conflito entre execuções
    # saiu do with → contêiner destruído


@pytest.fixture
def conexao(postgres_url):
    with psycopg.connect(postgres_url) as con:
        yield con
        con.rollback()                     # transação por teste, como antes
\`\`\`

| Opção | Fidelidade | Custo |
|---|---|---|
| SQLite em memória | média: outro dialeto de SQL | microssegundos, zero infraestrutura |
| Testcontainers (Postgres real) | alta: o mesmo banco da produção | segundos por sessão; precisa de Docker |
| Banco compartilhado de homologação | alta, mas com os dados de todo mundo | flaky: testes brigam pelos mesmos registros |

> [!sabia] Se o processo de testes morrer no meio (Ctrl+C, falta de memória), quem apaga os contêineres? O Testcontainers sobe junto um contêiner auxiliar chamado **Ryuk**, o *resource reaper* (ceifador de recursos): ele vigia a conexão com a sessão de testes e, quando ela cai, remove tudo o que foi criado.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando a dependência é **outro serviço**, de outro time? Subir tudo num ambiente e2e compartilhado é lento, caro e vive quebrando.',
          'O **contract testing guiado pelo consumidor** inverte a conversa: o consumidor declara o que usa da API, e o provedor verifica, no CI **dele**, que continua cumprindo isso.',
        ],
        board: {
          title: 'Consumer-driven contracts (Pact)',
          md: `\`\`\`text
CONSUMIDOR (serviço de pedidos)              PROVEDOR (serviço de clientes)
1. testa contra o mock do Pact:
   "GET /clientes/42 → 200 {id, nome}"
2. gera o contrato (pact) ──publica──▶ Pact Broker ◀── 3. o CI do provedor reproduz as
                                           │              requisições contra o serviço
                                           │              REAL e publica o resultado
4. antes do deploy: can-i-deploy? ◀────────┘
\`\`\`

| | Contract test | Teste e2e |
|---|---|---|
| Verifica | o **formato** da conversa (campos, status, tipos) | o fluxo inteiro funcionando |
| Precisa de | um lado por vez | todos os serviços no ar |
| Quebra quando | o provedor muda algo que **algum consumidor usa** | qualquer coisa, em qualquer lugar |

> [!atencao] Contrato não testa a **regra de negócio** do provedor — só que a resposta tem o formato combinado. Em compensação, revela **quem** usa **o quê**: campos que nenhum consumidor usa podem mudar livremente.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Com integração barata, a pirâmide clássica ganhou concorrentes. O **testing trophy**, do Kent C. Dodds, põe o maior volume no meio — o lema, de Guillermo Rauch, é *"Write tests. Not too many. Mostly integration."*',
          'E o **honeycomb** (favo de mel), do Spotify, faz o mesmo para microsserviços: o serviço é testado por fora, com as dependências que ele controla de verdade.',
        ],
        board: {
          title: 'Pirâmide × troféu × favo de mel',
          md: `| Formato | Proposto por | Maior camada | Contexto |
|---|---|---|---|
| **Pirâmide** | Mike Cohn (2009) | unidade | integração era cara e lenta |
| **Troféu** (*testing trophy*) | Kent C. Dodds (2018) | integração, com análise estática na base | front-end e ferramentas que testam "como o usuário usa" |
| **Favo de mel** (*honeycomb*) | Spotify (2018) | integração do serviço | microsserviços: a complexidade mora nas **interações** |
| **Casquinha de sorvete** 🍦 | (anti-padrão) | e2e e testes manuais | suíte lenta, cara e frágil |

> [!sabia] O favo de mel separa dois termos que quase todo mundo confunde: **integration test** (seu serviço + dependências reais que você controla, como o banco) e ***integrated test*** (um teste que só passa se **outro** sistema estiver correto e no ar). J. B. Rainsberger tem uma palestra famosa chamada *"Integrated Tests Are a Scam"* — o problema não é integrar, é depender de tudo ao mesmo tempo.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'O preço da integração: testes mais **lentos** e mais sujeitos a ser **flaky**. Dá para controlar os dois.',
          'Um tipo traiçoeiro de flaky é o que depende da **ordem**: sozinho ele passa, na suíte completa ele falha.',
        ],
        board: {
          title: 'Suíte de integração rápida e confiável',
          md: `| Problema | Causa típica | Remédio |
|---|---|---|
| Suíte lenta | subir banco ou contêiner a cada teste | fixture \`scope="session"\` + isolamento por transação; \`pytest --durations=10\` mostra os mais lentos |
| Tudo roda sempre | unitários e integração no mesmo comando | marcar com \`@pytest.mark.integracao\` e rodar \`pytest -m "not integracao"\` no ciclo rápido |
| Flaky por espera | \`time.sleep(2)\` esperando algo assíncrono | esperar por **condição** com prazo (*polling*), nunca por tempo fixo |
| Flaky por ordem | teste deixa dados ou estado global sujos | isolamento real: banco novo ou rollback, fixtures sem estado compartilhado |
| Flaky por recurso | porta fixa, arquivo compartilhado | porta aleatória, \`tmp_path\` |

\`\`\`python
import time


def esperar_ate(condicao, prazo=5.0, intervalo=0.05, relogio=time.monotonic, dormir=time.sleep):
    limite = relogio() + prazo
    while not condicao():
        if relogio() > limite:
            raise TimeoutError("a condição não ocorreu dentro do prazo")
        dormir(intervalo)       # relógio e sleep injetáveis: o próprio helper é testável
\`\`\`

> [!sabia] Pesquisas sobre testes dependentes de ordem batizaram os personagens: o ***polluter*** deixa estado sujo; a ***victim*** falha quando roda depois dele; e o ***brittle*** é o contrário — só passa se outro teste (o *state-setter*) rodar antes. Plugins como o \`pytest-randomly\` embaralham a ordem justamente para expor essas duplas.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Uma armadilha de transação, testes de um repositório SQLite de verdade, formatos de suíte, contratos e flakiness.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-intg-q1',
        concept: 'Transação por teste',
        say: 'Primeiro, um vazamento misterioso…',
        prompt: `\`test_deposito\` passa, mas o **teardown** dele quebra com \`OperationalError: cannot rollback - no transaction is active\` — e o teste seguinte falha com \`UNIQUE constraint failed: contas.id\`.

\`\`\`python
@pytest.fixture(scope="session")
def banco():
    con = sqlite3.connect(":memory:", isolation_level=None)
    con.execute("CREATE TABLE contas (id INTEGER PRIMARY KEY, saldo INTEGER)")
    return con


@pytest.fixture
def transacao(banco):
    banco.execute("BEGIN")
    yield banco
    banco.execute("ROLLBACK")


def test_deposito(transacao):
    contas = ServicoContas(transacao)    # abrir_conta() e depositar() chamam con.commit()
    contas.abrir_conta(1)
    contas.depositar(1, 100)
    assert contas.saldo(1) == 100
\`\`\`

O que está acontecendo?`,
        options: [
          { text: 'O `commit()` dentro do serviço confirmou a transação aberta pela fixture: o `ROLLBACK` não tem mais o que desfazer, e a conta 1 vazou para os testes seguintes.', correct: true, why: 'Com o `BEGIN` da fixture ativo, o `commit()` do código emite `COMMIT`. Os dados ficam, e o `ROLLBACK` do teardown encontra a conexão sem transação.' },
          { text: 'SQLite em memória não suporta transações de verdade; seria preciso usar um arquivo.', why: 'Suporta: `BEGIN`, `COMMIT`, `ROLLBACK` e até `SAVEPOINT` funcionam normalmente em `:memory:`.' },
          { text: 'A fixture `banco` deveria ter escopo `function`: escopo de sessão é sempre errado para bancos.', why: 'Um banco novo por teste até contornaria o sintoma, mas schema compartilhado + transação por teste é um padrão legítimo — e o único viável quando criar o banco é caro. O defeito é o commit interno.' },
          { text: '`isolation_level=None` faz o SQLite ignorar o `ROLLBACK`.', why: 'Com `isolation_level=None` o módulo `sqlite3` só deixa de abrir transações sozinho; os `BEGIN`/`ROLLBACK` explícitos da fixture funcionam normalmente.' },
        ],
        explanation: 'Rollback por teste só isola se **ninguém** confirmar a transação no meio do caminho. Quando o código testado faz `commit`, as saídas são: transformar as confirmações em **savepoints** (a ideia do `TestCase` do Django e do `join_transaction_mode="create_savepoint"` do SQLAlchemy), tirar o commit do repositório (**Unit of Work**) ou **truncar** as tabelas depois de cada teste.',
      },
      {
        type: 'pytest',
        id: 'tst-intg-q2',
        concept: 'Teste de integração',
        title: 'Repositório de tarefas com SQLite de verdade',
        module: 'tarefas',
        say: 'Mão na massa: testes de integração com banco **real**. Vou plantar bugs que nenhum mock pegaria.',
        prompt: `O \`RepositorioTarefas\` (arquivo \`tarefas.py\`) guarda tarefas num SQLite. Escreva **testes de integração** com um banco real em memória — nada de mock.

Regras que os testes devem proteger:
- \`pendentes(dono)\` devolve os títulos **não concluídos** daquele dono, em **ordem de criação**;
- \`concluir(id)\` marca a tarefa e devolve \`True\` (ou \`False\` se o id não existe);
- o mesmo dono não pode ter duas tarefas com o mesmo título (\`TarefaDuplicada\`), mas donos diferentes podem;
- toda escrita é **confirmada** (\`commit\`) antes de o método retornar.

Vou plantar bugs de integração: SQL errado, filtro faltando, constraint esquecida, commit esquecido. Pelo menos **5 testes**.`,
        implementation: TAREFAS,
        starter: `import sqlite3

import pytest

from tarefas import RepositorioTarefas, TarefaDuplicada


@pytest.fixture
def conexao():
    con = sqlite3.connect(":memory:")   # banco REAL, novo a cada teste
    yield con
    con.close()


@pytest.fixture
def repo(conexao):
    return RepositorioTarefas(conexao)


def test_tarefa_nova_aparece_nas_pendentes(repo):
    repo.adicionar("ana", "Pagar boleto")
    assert repo.pendentes("ana") == ["Pagar boleto"]
`,
        minTests: 5,
        mutants: [
          {
            name: 'pendentes mostra tarefas de outros donos',
            code: mutT('            "SELECT titulo FROM tarefas WHERE dono = ? AND concluida = 0 ORDER BY id",\n            (dono,),\n',
              '            "SELECT titulo FROM tarefas WHERE concluida = 0 ORDER BY id",\n'),
            why: 'faltou um cenário com **dois donos**: as pendentes da Ana não podem trazer as tarefas do Bruno.',
            concept: 'Filtro no WHERE',
          },
          {
            name: 'pendentes inclui tarefas já concluídas',
            code: mutT('WHERE dono = ? AND concluida = 0 ORDER BY id', 'WHERE dono = ? ORDER BY id'),
            why: 'faltou concluir uma tarefa e verificar que ela **sai** da lista de pendentes.',
            concept: 'Filtro no WHERE',
          },
          {
            name: 'pendentes em ordem alfabética (ORDER BY errado)',
            code: mutT('AND concluida = 0 ORDER BY id', 'AND concluida = 0 ORDER BY titulo'),
            why: 'faltou criar tarefas **fora** da ordem alfabética e conferir a ordem de criação.',
            concept: 'SQL errado',
          },
          {
            name: 'schema sem UNIQUE: duplicata passa em silêncio',
            code: mutT('    concluida INTEGER NOT NULL DEFAULT 0,\n    UNIQUE (dono, titulo)\n', '    concluida INTEGER NOT NULL DEFAULT 0\n'),
            why: 'faltou adicionar a **mesma tarefa duas vezes** para o mesmo dono e esperar `TarefaDuplicada` — constraint só se testa com banco real.',
            concept: 'Constraints',
          },
          {
            name: 'adicionar não faz commit',
            code: mutT('            raise TarefaDuplicada(f"{dono} já tem a tarefa {titulo!r}") from None\n        self.con.commit()\n',
              '            raise TarefaDuplicada(f"{dono} já tem a tarefa {titulo!r}") from None\n'),
            why: 'na mesma conexão o dado aparece mesmo sem commit. Simule uma queda com `conexao.rollback()` depois de `adicionar` e confira que a tarefa **continua lá**.',
            concept: 'Transações',
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('unittest') || m.calls.includes('MagicMock') || m.calls.includes('Mock'),
            text: 'Você usou mock num teste de **integração**. O valor aqui é justamente executar o SQL de verdade: um mock da conexão aceitaria um `WHERE` incompleto ou um `commit` esquecido sem reclamar.',
            concept: 'Teste de integração',
          },
          {
            when: m => !m.calls.includes('raises'),
            text: 'A regra de duplicata ficou sem `pytest.raises(TarefaDuplicada)`. Constraints (`UNIQUE`, `NOT NULL`, FKs) são exatamente o tipo de regra que só um banco real verifica — vale um teste explícito.',
            concept: 'Constraints',
          },
        ],
        hints: [
          'Pense em **cada cláusula** do SQL: o que acontece se o `WHERE` perder um filtro? Crie dados que **não** deveriam aparecer: tarefa de outro dono, tarefa concluída.',
          'Ordem: crie `"Pagar boleto"` antes de `"Comprar pão"` — fora da ordem alfabética. Constraint: adicione a mesma tarefa duas vezes para o mesmo dono dentro de `pytest.raises(TarefaDuplicada)`.',
          'Commit: na mesma conexão o dado aparece mesmo sem commit. Peça a fixture `conexao` no teste, chame `conexao.rollback()` logo depois de `adicionar` (como se o processo tivesse caído) e confira que a tarefa continua nas pendentes.',
        ],
        solution: `import sqlite3

import pytest

from tarefas import RepositorioTarefas, TarefaDuplicada


@pytest.fixture
def conexao():
    con = sqlite3.connect(":memory:")   # banco real, novo a cada teste
    yield con
    con.close()


@pytest.fixture
def repo(conexao):
    return RepositorioTarefas(conexao)


def test_pendentes_em_ordem_de_criacao(repo):
    repo.adicionar("ana", "Pagar boleto")
    repo.adicionar("ana", "Comprar pão")
    assert repo.pendentes("ana") == ["Pagar boleto", "Comprar pão"]


def test_pendentes_sao_so_do_dono(repo):
    repo.adicionar("ana", "Pagar boleto")
    repo.adicionar("bruno", "Lavar o carro")
    assert repo.pendentes("ana") == ["Pagar boleto"]
    assert repo.pendentes("bruno") == ["Lavar o carro"]


def test_tarefa_concluida_sai_das_pendentes(repo):
    boleto = repo.adicionar("ana", "Pagar boleto")
    repo.adicionar("ana", "Comprar pão")
    assert repo.concluir(boleto) is True
    assert repo.pendentes("ana") == ["Comprar pão"]


def test_concluir_tarefa_inexistente_devolve_false(repo):
    assert repo.concluir(999) is False


def test_mesma_tarefa_para_o_mesmo_dono_e_recusada(repo):
    repo.adicionar("ana", "Pagar boleto")
    with pytest.raises(TarefaDuplicada):
        repo.adicionar("ana", "Pagar boleto")
    assert repo.pendentes("ana") == ["Pagar boleto"]


def test_donos_diferentes_podem_repetir_o_titulo(repo):
    repo.adicionar("ana", "Pagar boleto")
    repo.adicionar("bruno", "Pagar boleto")
    assert repo.pendentes("bruno") == ["Pagar boleto"]


def test_adicionar_confirma_a_transacao(repo, conexao):
    repo.adicionar("ana", "Pagar boleto")
    conexao.rollback()   # simula uma queda logo depois: o que foi commitado sobrevive
    assert repo.pendentes("ana") == ["Pagar boleto"]
`,
        solutionExplanation: 'Cada teste cria dados que **deveriam ser filtrados** — outro dono, tarefa concluída, títulos fora da ordem alfabética —, e é isso que mata os mutantes de `WHERE` e `ORDER BY`. A duplicata com `pytest.raises` só funciona porque o banco é real: a constraint `UNIQUE` vive no schema, não no Python. E o `rollback()` depois de `adicionar` prova a **durabilidade**: sem commit, a tarefa some. Um mock teria deixado passar os cinco bugs.',
      },
      {
        type: 'match',
        id: 'tst-intg-q3',
        concept: 'Formatos de suíte',
        say: 'Rodada rápida: formatos de suíte e um termo que confunde muita gente.',
        prompt: 'Associe cada formato (ou termo) à sua descrição.',
        pairs: [
          { left: 'Pirâmide de testes', right: 'Base larga de unitários e poucos e2e no topo' },
          { left: 'Testing trophy', right: 'Análise estática na base e o maior volume em integração' },
          { left: 'Honeycomb', right: 'Microsserviços: muita integração do serviço, pouco teste de detalhe interno' },
          { left: 'Casquinha de sorvete', right: 'Anti-padrão: quase tudo e2e ou manual, poucos unitários' },
          { left: '*Integrated test*', right: 'Só passa se **outro** sistema estiver correto e no ar' },
        ],
        explanation: 'Os formatos não competem de verdade: todos buscam **confiança por custo**. A pirâmide nasceu quando integração era cara; troféu e favo de mel refletem ferramentas que deixaram a integração barata (SQLite, Testcontainers, clientes HTTP de teste). O que todos condenam é a casquinha de sorvete — e o excesso de *integrated tests*.',
      },
      {
        type: 'order',
        id: 'tst-intg-q4',
        concept: 'Contract testing',
        say: 'Agora coloque o fluxo do Pact na ordem, do teste do consumidor ao deploy.',
        prompt: 'Ordene as etapas do **contract testing guiado pelo consumidor** (Pact):',
        items: [
          'O consumidor escreve um teste contra o mock do Pact, descrevendo a requisição que faz e a resposta de que precisa',
          'O teste gera o arquivo de contrato (o *pact*) com essas interações',
          'O contrato é publicado no Pact Broker',
          'O CI do provedor reproduz as interações contra o serviço **real** e publica o resultado da verificação',
          'Antes do deploy, o `can-i-deploy` consulta o broker: as versões são compatíveis?',
        ],
        explanation: 'O contrato nasce do **consumidor** (daí *consumer-driven*): ele só declara o que realmente usa. O provedor verifica esse contrato no próprio CI, sem precisar subir o consumidor, e o `can-i-deploy` impede o deploy de uma versão que quebraria alguém.',
      },
      {
        type: 'mcq',
        id: 'tst-intg-q5',
        concept: 'Testes flaky',
        say: 'Um clássico das suítes de integração…',
        prompt: 'Na suíte completa, `test_relatorio_sem_vendas` falha. Rodando **sozinho** (`pytest -k relatorio_sem_vendas`), ele passa. Depois que o time instalou o `pytest-randomly`, ele passou a falhar só **às vezes**. Qual o diagnóstico e a correção?',
        options: [
          { text: 'Teste dependente de ordem: algum teste anterior (o *polluter*) deixa dados ou estado global sujos. Corrigir o isolamento — banco novo ou rollback por teste, nada de estado compartilhado — e usar a ordem aleatória para achar o par.', correct: true, why: 'Passar sozinho e falhar em grupo é a assinatura de estado vazando entre testes.' },
          { text: 'Lentidão do banco na suíte completa; aumentar os timeouts resolve.', why: 'Rodando sozinho ele passa na hora — o que muda é a **ordem**, não o tempo.' },
          { text: 'Desinstalar o `pytest-randomly` e fixar a ordem dos testes.', why: 'Esconde o acoplamento; ele volta quando alguém adicionar, renomear ou paralelizar testes.' },
          { text: 'Marcar com `@pytest.mark.flaky(reruns=3)` (plugin `pytest-rerunfailures`).', why: 'Rerun mascara um bug de isolamento que é determinístico — e ensina o time a conviver com o vermelho.' },
        ],
        explanation: 'O teste que falha é a **vítima** (*victim*); o culpado é um *polluter* que rodou antes. O `pytest-randomly` imprime a semente usada (`--randomly-seed=...`) para reproduzir a mesma ordem, e ferramentas como o `detect-test-pollution` fazem uma busca binária para achar o polluter. A correção é sempre de **isolamento**, nunca de ordem nem de retry.',
      },
      {
        type: 'open',
        id: 'tst-intg-q6',
        concept: 'Estratégia de integração',
        say: 'Para fechar, uma pergunta de arquitetura de testes.',
        prompt: 'O serviço de **pedidos** do seu time grava no **Postgres** e consome a API de **clientes** de outro time. Hoje, os testes de integração rodam num ambiente de homologação compartilhado que vive quebrando. Como você reorganizaria essa estratégia?',
        minWords: 30,
        rubric: [
          { label: 'Testa o repositório contra um **banco real do mesmo tipo** (Postgres via Testcontainers/contêiner)', keywords: ['testcontainer', 'container', 'conteiner', 'docker', 'postgres real', 'postgres de verdade', 'banco real', 'banco de verdade', 'mesmo banco'], concept: 'Testcontainers' },
          { label: 'Garante **isolamento** entre testes (transação com rollback, savepoint, truncar, banco novo)', keywords: ['rollback', 'transac', 'savepoint', 'isola', 'trunc', 'banco novo', 'independ'], concept: 'Transação por teste' },
          { label: 'Usa **contract testing** guiado pelo consumidor (Pact) para a API de clientes', keywords: ['contrato', 'contract', 'pact', 'consumer-driven', 'guiado pelo consumidor', 'can-i-deploy'], concept: 'Contract testing' },
          { label: 'Deixa **poucos e2e** para fluxos críticos e ataca a flakiness do ambiente compartilhado', keywords: ['poucos e2e', 'poucos testes e2e', 'poucos testes de ponta', 'fluxos critic', 'fluxo critic', 'flaky', 'integrated', 'ambiente compartilhado', 'trofeu', 'honeycomb', 'favo de mel', 'piramide'], concept: 'Formato da suíte', why: 'O ambiente compartilhado é a maior fonte de testes lentos e flaky; ele deve sobrar só para poucos fluxos críticos.' },
        ],
        modelAnswer: `Eu tiraria a dependência do ambiente compartilhado em três frentes.

**Banco:** os testes do repositório rodariam contra um **Postgres real** com **Testcontainers** — o mesmo banco da produção, num contêiner descartável por sessão, com porta aleatória. Cada teste ficaria **isolado** por uma transação com rollback (com savepoints, se o código faz commit) ou por truncamento das tabelas.

**API de clientes:** em vez de chamar o serviço de verdade, eu usaria **contract testing** guiado pelo consumidor (**Pact**): nossos testes geram o contrato com o que usamos da API, o outro time verifica esse contrato no CI dele e o \`can-i-deploy\` bloqueia deploys incompatíveis. Nos testes do nosso serviço, a API vira um fake.

**Formato da suíte:** o maior volume fica em testes de integração do próprio serviço (o formato *honeycomb*), e só **poucos e2e** cobrem os fluxos críticos — o que elimina a maior fonte de testes flaky: o ambiente compartilhado.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você sabe testar a conversa com o banco de verdade, isolar cada teste e trocar ambientes compartilhados por contratos.',
          'Resumo de bolso: mock para os papéis que você define, banco real para o SQL que você escreve, contrato para a API dos outros — e poucos e2e, só nos fluxos que não podem falhar.',
        ],
        board: null,
      },
    ],
  });
})();
