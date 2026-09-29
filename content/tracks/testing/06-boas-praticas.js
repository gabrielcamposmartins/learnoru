Game.registerModule('testing', {
  id: 'boas-praticas',
  title: 'Boas práticas: cobertura, mutação e testes confiáveis',
  kind: 'lesson',
  level: 2,
  order: 30,
  unit: 'qualidade',
  summary: 'Por que 100% de cobertura não garante nada, mutation testing, FIRST, test smells, testes flaky e integração com SQLite.',
  concepts: ['Cobertura', 'Mutation testing', 'FIRST', 'Test smells', 'Testes flaky', 'Valores-limite'],
  takeaways: [
    'Cobertura mede o que foi **executado**, não o que foi **verificado**: é necessária, mas não suficiente. Prefira a cobertura de **ramos**.',
    '**Mutation testing** planta bugs pequenos; mutantes sobreviventes apontam asserts fracos e limites não testados.',
    'Nem todo mutante pode ser morto: **mutantes equivalentes** mudam o código sem mudar o comportamento.',
    'Bons testes são **FIRST** — rápidos, isolados, repetíveis, autoverificáveis e escritos no momento certo — e evitam os **test smells**.',
    'Testes **flaky** destroem a confiança na suíte; tempo, aleatoriedade, ordem e rede se curam **injetando** a dependência.',
  ],
  glossary: [
    { term: 'Mutation testing', aliases: ['teste de mutação', 'testes de mutação', 'mutation score', 'mutante', 'mutantes'], definition: 'Técnica que avalia a suíte plantando pequenos bugs (**mutantes**, como `>=` → `>`) e rodando os testes contra cada um: se algum teste falha, o mutante morreu; se todos passam, ele sobreviveu e revela um buraco nos testes.' },
    { term: 'Mutante equivalente', aliases: ['mutantes equivalentes', 'equivalent mutant', 'equivalent mutants'], definition: 'Mutante que muda o código, mas não o comportamento (ex.: `i < len(xs)` → `i != len(xs)` num laço que nunca pula o fim). Nenhum teste consegue matá-lo, e detectá-lo é indecidível no caso geral.' },
    { term: 'Hipótese do programador competente', aliases: ['competent programmer hypothesis', 'programador competente'], definition: 'Premissa do mutation testing: programas escritos por profissionais estão **quase** certos, e os bugs reais são pequenos desvios — como `>` no lugar de `>=`. Por isso mutantes simples são bons modelos de bugs reais.' },
    { term: 'Teste flaky', aliases: ['testes flaky', 'flaky', 'flakiness', 'teste intermitente', 'testes intermitentes'], definition: 'Teste que passa ou falha **sem mudança no código**, por depender de relógio, aleatoriedade, ordem de execução, concorrência ou rede. Corrói a confiança na suíte: o time passa a ignorar o vermelho.' },
    { term: 'Cobertura de ramos', aliases: ['branch coverage', 'cobertura de branch', 'cobertura de branches'], definition: 'Métrica que verifica se cada lado de cada decisão (`if`, `while`…) foi percorrido. É mais exigente que a cobertura de linhas: um `if` sem `else` pode ter todas as linhas cobertas sem nunca testar o caso falso.' },
    { term: 'Princípios FIRST', aliases: ['FIRST principles'], definition: 'Acrônimo para testes de unidade confiáveis: **F**ast (rápido), **I**solated (isolado), **R**epeatable (repetível), **S**elf-validating (autoverificável) e **T**imely (escrito no momento certo).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Você já sabe escrever testes. Agora a pergunta difícil: **como saber se os seus testes são bons?**',
        'A métrica mais famosa é a **cobertura de código**, medida com o plugin `pytest-cov`. Ela diz quais linhas (e ramos) foram **executados** pelos testes.',
      ],
      board: {
        title: 'Cobertura com pytest-cov',
        md: `\`\`\`text
$ pip install pytest-cov
$ pytest --cov=loja --cov-branch --cov-report=term-missing

Name          Stmts   Miss Branch BrPart  Cover   Missing
----------------------------------------------------------
loja/frete.py    12      2      6      1    83%   18-19
\`\`\`

| Tipo | O que mede |
|---|---|
| **Linha** (statement) | Cada linha foi executada ao menos uma vez? |
| **Ramo** (branch) | Cada lado de cada \`if\` foi percorrido? |

> [!dica] Prefira \`--cov-branch\`: um \`if\` sem \`else\` pode ter 100% de linhas cobertas sem nunca testar o caso **falso**.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora o problema: cobertura mede **execução**, não **verificação**.',
        'Olha esse teste: ele executa todas as linhas da função — 100% de cobertura — e não verifica absolutamente nada.',
      ],
      board: {
        title: '⚠️ 100% de cobertura, 0% de garantia',
        code: `def desconto(valor, vip):
    if vip:
        return valor * 0.9
    return valor


def test_desconto():
    desconto(100, True)    # executa o ramo VIP…
    desconto(100, False)   # …e o ramo comum
    # nenhum assert! Se trocarmos 0.9 por 0.5, o teste continua verde.`,
        caption: 'Cobertura alta é **necessária** para confiar numa suíte, mas está longe de ser **suficiente**.',
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Quem mede a qualidade dos testes de verdade é o **mutation testing**. A ferramenta planta pequenos bugs — os **mutantes** — e roda a suíte para cada um.',
        'Se algum teste falhar, o mutante foi **morto**. Se tudo continuar verde, ele **sobreviveu**: existe um bug que seus testes não pegariam. Aliás, é exatamente assim que eu avalio os seus testes neste jogo!',
      ],
      board: {
        title: 'Mutation testing (ex.: mutmut)',
        md: `| Operador de mutação | Original | Mutante |
|---|---|---|
| Relacional | \`if idade >= 18\` | \`if idade > 18\` |
| Aritmético | \`total + frete\` | \`total - frete\` |
| Constante | \`return 0.9 * valor\` | \`return 1.9 * valor\` |
| Booleano | \`return True\` | \`return False\` |
| Remoção de chamada | \`lista.sort()\` | *(linha removida)* |

\`\`\`text
$ pip install mutmut
$ mutmut run
$ mutmut results     # lista os mutantes sobreviventes
\`\`\`

> [!dica] **Mutation score** = mutantes mortos ÷ total. Sobreviventes costumam apontar **valores-limite** não testados (\`>=\` vs \`>\`).`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Além de pegar bugs, um bom teste precisa ser **confiável** e **barato de manter**. O acrônimo **FIRST** resume isso.',
      ],
      board: {
        title: 'Princípios FIRST',
        md: `| Letra | Princípio | Na prática |
|---|---|---|
| **F** | Fast (rápido) | Milissegundos. Teste lento é teste que ninguém roda. |
| **I** | Isolated / Independent | Não depende de outro teste nem da ordem de execução. |
| **R** | Repeatable (repetível) | Mesmo resultado sempre: sem relógio real, rede ou aleatoriedade solta. |
| **S** | Self-validating | Passa ou falha sozinho, com \`assert\` — ninguém precisa ler um \`print\`. |
| **T** | Timely (oportuno) | Escrito junto com o código (ou antes, no TDD). |`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'E quando esses princípios são violados, aparecem os **test smells** — sinais de que um teste vai dar dor de cabeça.',
      ],
      board: {
        title: 'Test smells comuns',
        md: `| Smell | Sintoma | Tratamento |
|---|---|---|
| **Teste frágil** | Quebra a cada refatoração, pois verifica detalhes internos (métodos privados, ordem de chamadas) | Teste o **comportamento observável** pela API pública |
| **Dependência entre testes** | Um teste usa estado deixado por outro; falha se rodar sozinho | Cada teste monta o próprio cenário (fixtures) |
| **Lógica no teste** | \`for\`/\`if\` dentro do teste recalculando o esperado | Valores esperados literais; use \`parametrize\` |
| **Assert fraco / ausente** | \`assert resultado\` ou nenhum assert | Compare o valor exato esperado |
| **Asserts demais** | Um teste verifica 15 coisas; quando falha, ninguém sabe o porquê | Um comportamento por teste |
| **Sleep** | \`time.sleep(2)\` esperando algo acontecer | Injete relógio/eventos; espere por condição |`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'O pior de todos é o **teste flaky**: passa às vezes, falha às vezes, sem mudança no código. Ele destrói a confiança na suíte — o time começa a ignorar o vermelho.',
        'As causas clássicas são **tempo**, **aleatoriedade**, **ordem** e **rede**. E a cura quase sempre é a mesma: **injetar** a dependência.',
      ],
      board: {
        title: 'Tornando testes determinísticos',
        code: `from datetime import date
import random


# ❌ flaky: depende do dia em que o teste roda
def eh_fim_de_semana():
    return date.today().weekday() >= 5


# ✅ a data é injetada — o teste escolhe o dia
def eh_fim_de_semana(hoje: date) -> bool:
    return hoje.weekday() >= 5


def test_sabado_e_fim_de_semana():
    assert eh_fim_de_semana(date(2024, 6, 1)) is True


# ✅ aleatoriedade com gerador injetado (e seed fixa no teste)
def sortear(itens, rng: random.Random):
    return rng.choice(itens)


def test_sorteio_reprodutivel():
    assert sortear(["a", "b", "c"], random.Random(42)) == sortear(["a", "b", "c"], random.Random(42))`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Para testes de **integração** com banco, uma ótima opção em Python é o **SQLite em memória**: rápido, real e descartável a cada teste.',
        'E sobre organização: nomes que descrevem **comportamento e condição**, uma pasta `tests/` espelhando o pacote e fixtures compartilhadas no `conftest.py`.',
      ],
      board: {
        title: 'Integração com SQLite em memória',
        code: `import sqlite3

import pytest


@pytest.fixture
def conexao():
    con = sqlite3.connect(":memory:")          # banco novo a cada teste
    con.execute("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, email TEXT UNIQUE)")
    yield con
    con.close()


def test_email_duplicado_viola_restricao_unique(conexao):
    conexao.execute("INSERT INTO usuarios (email) VALUES ('ana@x.com')")
    with pytest.raises(sqlite3.IntegrityError):
        conexao.execute("INSERT INTO usuarios (email) VALUES ('ana@x.com')")`,
        caption: 'Nomeie pelo comportamento: `test_<o_que_acontece>_<quando>` — ex.: `test_frete_gratis_acima_de_200`.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma pegadinha do mutation testing: às vezes um mutante **sobrevive** e não existe teste no mundo capaz de matá-lo.',
        'Não é falha sua — é um **mutante equivalente**. E a ideia por trás da técnica é bem mais antiga do que parece.',
      ],
      board: {
        title: 'Mutantes equivalentes (e uma ideia dos anos 1970)',
        md: `\`\`\`python
def indice(xs, alvo):
    i = 0
    while i < len(xs):        # mutante: while i != len(xs):
        if xs[i] == alvo:
            return i
        i += 1
    return -1
\`\`\`

Como \`i\` começa em 0 e sobe de 1 em 1, ele **nunca pula** \`len(xs)\`: com \`<\` ou com \`!=\`, o comportamento é idêntico. Nenhum teste mata esse mutante. Decidir se um mutante é equivalente é **indecidível** no caso geral, então as ferramentas usam heurísticas e o time marca os casos conhecidos — no mutmut, com o comentário \`# pragma: no mutate\`.

> [!sabia] O mutation testing nasceu nos anos 1970: a ideia é de Richard Lipton, e o artigo de DeMillo, Lipton e Sayward (1978) a formalizou sobre duas hipóteses com nome. A **hipótese do programador competente**: programas reais estão *quase* certos, e os bugs são pequenos desvios. E o **efeito de acoplamento**: testes que pegam bugs simples tendem a pegar também os complexos, que são combinações deles. É por isso que trocar um \`>=\` por um \`>\` é um modelo tão bom de bug real.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Smells, cobertura, mutantes e um teste de datas cheio de limites.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'tst-bp-q1',
      concept: 'Test smells',
      say: 'Olha essa suíte. Passa no seu computador… às vezes.',
      prompt: `Qual é o **principal problema** destes testes?

\`\`\`python
usuarios = []

def test_cria_usuario():
    usuarios.append(criar_usuario("ana"))
    assert usuarios[0].nome == "ana"

def test_lista_tem_um_usuario():
    assert len(usuarios) == 1
\`\`\``,
      options: [
        { text: 'Dependência entre testes: o segundo só passa se o primeiro rodar antes, compartilhando estado global.', correct: true, why: 'Rodando sozinho (`pytest -k lista`) ou em outra ordem, ele falha. Viola o "I" do FIRST.' },
        { text: 'Teste lento, por causa do `append`.', why: '`append` é O(1); não há problema de velocidade aqui.' },
        { text: 'Asserts demais em um único teste.', why: 'Cada teste tem um único assert.' },
        { text: 'Lógica no teste, por usar uma lista.', why: 'Não há `if`/`for` recalculando o esperado; o problema é o estado compartilhado.' },
      ],
      explanation: 'O estado global `usuarios` acopla os testes: a ordem de execução passa a importar e rodar um teste isolado falha. Cada teste deve montar seu próprio cenário — por exemplo, com uma **fixture** que cria uma lista nova.',
    },
    {
      type: 'mcq',
      id: 'tst-bp-q2',
      concept: 'Cobertura',
      say: 'Agora um relatório de cobertura muito bonito…',
      prompt: `Esta função tem **100% de cobertura de linhas e de ramos** com os testes abaixo. O que dá para concluir?

\`\`\`python
def pode_votar(idade):
    return idade > 16          # a regra é: 16 anos ou mais

def test_adulto_pode_votar():
    assert pode_votar(30)

def test_crianca_nao_pode_votar():
    assert not pode_votar(10)
\`\`\``,
      options: [
        { text: 'Há um bug (`>` deveria ser `>=`) que a suíte não pega: cobertura mede o que foi executado, não se os limites foram verificados.', correct: true, why: 'Nenhum teste usa `idade = 16`, o valor-limite. Um mutante `>=` → `>` sobreviveria.' },
        { text: 'Como a cobertura é 100%, a função está correta.', why: 'Cobertura só diz que as linhas rodaram — o bug no limite passa despercebido.' },
        { text: 'A cobertura de ramos deveria ser 50%, então o relatório está errado.', why: 'Os dois resultados da expressão foram exercitados; os 100% estão corretos.' },
        { text: 'Os testes são flaky.', why: 'Eles são determinísticos; o problema é não testarem o limite.' },
      ],
      explanation: 'O bug está no **valor-limite**: com 16 anos a função devolve `False`. Os testes usam 30 e 10, longe do limite. Cobertura 100% não detecta isso; **mutation testing** detectaria (o mutante que troca `>` por `>=` sobreviveria… revelando que o limite não é testado).',
    },
    {
      type: 'order',
      id: 'tst-rx-bp1',
      concept: 'Mutation testing',
      say: 'Agora, o passo a passo de uma rodada de mutation testing — do jeito que o `mutmut` faz.',
      prompt: 'Ordene as etapas de uma rodada de **mutation testing**.',
      items: [
        'Rodar a suíte no código original — ela precisa estar **toda verde**',
        'Gerar os **mutantes** aplicando operadores de mutação (`>=` → `>`, `+` → `-`, `True` → `False`…)',
        'Rodar a suíte contra **cada mutante**',
        'Classificar cada mutante: **morto** se algum teste falhou, **sobrevivente** se tudo passou',
        'Calcular o **mutation score** e escrever testes para os sobreviventes (ou marcá-los como equivalentes)',
      ],
      explanation: 'A suíte precisa estar verde no código original — senão, um teste que já falha "mataria" todos os mutantes e o resultado não diria nada. Depois vêm a geração (um bug pequeno por mutante), a execução contra cada um e a classificação. O **mutation score** (mortos ÷ total) resume a qualidade dos testes, mas o valor real está nos **sobreviventes**: cada um é um bug que a suíte deixaria passar — ou um mutante equivalente, que não dá para matar.',
    },
    {
      type: 'open',
      id: 'tst-bp-q3',
      concept: 'Mutation testing',
      say: 'Pergunta de líder técnica.',
      prompt: 'Seu time exige **90% de cobertura** para aprovar um PR. Isso garante testes de qualidade? Como você avaliaria se a suíte realmente protege o código?',
      minWords: 20,
      rubric: [
        { label: 'Explica que cobertura mede **execução**, não verificação (asserts)', keywords: ['execu', ['sem', 'assert'], 'nao verifica', 'nao garante', 'rodou', 'passou pela linha'], concept: 'Cobertura' },
        { label: 'Propõe **mutation testing** (mutantes, mutmut, mutation score)', keywords: ['mutac', 'mutant', 'mutmut', 'mutation'], concept: 'Mutation testing' },
        { label: 'Cita **casos de borda / valores-limite** e asserts significativos', keywords: ['borda', 'limite', 'edge', 'assert', 'caso extremo'], concept: 'Valores-limite' },
        { label: 'Menciona **confiabilidade/manutenção** dos testes (flaky, FIRST, smells, revisão de testes)', keywords: ['flaky', 'first', 'smell', 'fragil', 'determin', 'isolad', 'revis', 'code review'], concept: 'Test smells' },
      ],
      modelAnswer: `Não garante. Cobertura mede quais linhas foram **executadas**, não se o resultado foi **verificado** — dá para ter 90% com testes sem assert ou com asserts fracos. Ela é útil para achar código **não testado**, mas não mede qualidade.

Para avaliar a suíte eu usaria **mutation testing** (ex.: \`mutmut\`): se mutantes sobrevivem, existem bugs que os testes não pegariam — geralmente em **valores-limite** e casos de borda que precisam de asserts específicos.

Também olharia a **confiabilidade**: testes flaky, frágeis ou dependentes de ordem (FIRST, test smells), e incluiria os testes na revisão de código, não só o número de cobertura.`,
    },
    {
      type: 'pytest',
      id: 'tst-bp-q4',
      concept: 'Valores-limite',
      module: 'assinatura',
      title: 'Status de assinatura por data',
      say: 'Agora é você quem testa. A data de "hoje" é **injetada** — nada de `date.today()` no teste. Vou plantar bugs nos limites!',
      prompt: `A função \`status_assinatura(vencimento, hoje)\` diz o status de uma assinatura:

- **"ativa"** até o dia do vencimento (**inclusive**);
- **"carencia"** nos **3 dias** seguintes ao vencimento;
- **"expirada"** depois disso.

Escreva testes com \`pytest\` (use \`datetime.date\` para as datas). Pense nos **limites** de cada faixa.`,
      implementation: `from datetime import date, timedelta

DIAS_DE_CARENCIA = 3


def status_assinatura(vencimento: date, hoje: date) -> str:
    if hoje <= vencimento:
        return "ativa"
    if hoje <= vencimento + timedelta(days=DIAS_DE_CARENCIA):
        return "carencia"
    return "expirada"
`,
      starter: `from datetime import date

from assinatura import status_assinatura

VENCIMENTO = date(2024, 3, 10)


def test_antes_do_vencimento_esta_ativa():
    assert status_assinatura(VENCIMENTO, date(2024, 3, 1)) == "ativa"
`,
      minTests: 4,
      mutants: [
        {
          name: 'No dia do vencimento já entra em carência',
          code: `from datetime import date, timedelta

DIAS_DE_CARENCIA = 3


def status_assinatura(vencimento: date, hoje: date) -> str:
    if hoje < vencimento:
        return "ativa"
    if hoje <= vencimento + timedelta(days=DIAS_DE_CARENCIA):
        return "carencia"
    return "expirada"
`,
          why: 'o limite é inclusivo: teste o próprio dia do vencimento.',
          concept: 'Valores-limite',
        },
        {
          name: 'Carência de só 2 dias',
          code: `from datetime import date, timedelta

DIAS_DE_CARENCIA = 3


def status_assinatura(vencimento: date, hoje: date) -> str:
    if hoje <= vencimento:
        return "ativa"
    if hoje < vencimento + timedelta(days=DIAS_DE_CARENCIA):
        return "carencia"
    return "expirada"
`,
          why: 'teste o último dia de carência (vencimento + 3 dias).',
          concept: 'Valores-limite',
        },
        {
          name: 'Carência de 4 dias',
          code: `from datetime import date, timedelta

DIAS_DE_CARENCIA = 3


def status_assinatura(vencimento: date, hoje: date) -> str:
    if hoje <= vencimento:
        return "ativa"
    if hoje <= vencimento + timedelta(days=DIAS_DE_CARENCIA + 1):
        return "carencia"
    return "expirada"
`,
          why: 'teste o primeiro dia expirado (vencimento + 4 dias), não só uma data bem distante.',
          concept: 'Valores-limite',
        },
        {
          name: 'Ignora o "hoje" injetado e usa date.today()',
          code: `from datetime import date, timedelta

DIAS_DE_CARENCIA = 3


def status_assinatura(vencimento: date, hoje: date) -> str:
    hoje = date.today()
    if hoje <= vencimento:
        return "ativa"
    if hoje <= vencimento + timedelta(days=DIAS_DE_CARENCIA):
        return "carencia"
    return "expirada"
`,
          why: 'use datas fixas e variadas — um teste que só cobre "expirada" com datas no passado não percebe o relógio real.',
          concept: 'Testes flaky',
        },
      ],
      reviews: [
        {
          when: m => !m.decorators.includes('parametrize'),
          text: 'Vários casos com a mesma estrutura (data → status esperado) em testes separados. `@pytest.mark.parametrize` deixaria a **tabela de limites** explícita e fácil de revisar.',
          concept: 'pytest.mark.parametrize',
        },
      ],
      hints: [
        'Liste os limites: o próprio vencimento, o dia seguinte, vencimento + 3 e vencimento + 4.',
        'Uma tabela com `@pytest.mark.parametrize("hoje, esperado", [...])` deixa todos os casos num lugar só.',
        'Não esqueça de pelo menos um caso "ativa" **antes** do vencimento e um "expirada" bem depois.',
      ],
      solution: `from datetime import date

import pytest

from assinatura import status_assinatura

VENCIMENTO = date(2024, 3, 10)


@pytest.mark.parametrize("hoje, esperado", [
    (date(2024, 3, 1), "ativa"),
    (date(2024, 3, 10), "ativa"),       # o próprio dia do vencimento
    (date(2024, 3, 11), "carencia"),    # 1º dia de carência
    (date(2024, 3, 13), "carencia"),    # último dia de carência
    (date(2024, 3, 14), "expirada"),    # 1º dia expirado
    (date(2025, 1, 1), "expirada"),
])
def test_status_por_data(hoje, esperado):
    assert status_assinatura(VENCIMENTO, hoje) == esperado
`,
      solutionExplanation: 'Cada fronteira aparece dos **dois lados**: 10/03 (último ativo) e 11/03 (primeiro de carência); 13/03 (último de carência) e 14/03 (primeiro expirado). É isso que mata os mutantes `<` vs `<=` e os de ±1 dia. Como `hoje` é injetado, o teste é **determinístico** — roda igual em qualquer dia.',
    },
    {
      type: 'code',
      id: 'tst-bp-q5',
      concept: 'Injeção de dependência (relógio)',
      title: 'Tornando a saudação testável',
      say: 'Última: esta função é impossível de testar de forma confiável. Conserta pra mim?',
      prompt: `A função abaixo depende do relógio real — o teste do "Bom dia" só passaria de manhã:

\`\`\`python
def saudacao(nome):
    hora = datetime.now().hour
    ...
\`\`\`

Reescreva como \`saudacao(nome, relogio=datetime.now)\`: **\`relogio\`** é uma função sem argumentos que devolve um \`datetime\`. Em produção, o padrão é o relógio real; nos testes, passamos um relógio falso.

- de **5h** até antes das **12h** → \`"Bom dia, <nome>!"\`
- de **12h** até antes das **18h** → \`"Boa tarde, <nome>!"\`
- nos demais horários → \`"Boa noite, <nome>!"\``,
      starter: `from datetime import datetime


def saudacao(nome):
    hora = datetime.now().hour
    if 5 <= hora < 12:
        return f"Bom dia, {nome}!"
    if 12 <= hora < 18:
        return f"Boa tarde, {nome}!"
    return f"Boa noite, {nome}!"
`,
      tests: [
        { name: '9h → Bom dia', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Ana", relogio=lambda: _dt(2024, 1, 1, 9))', expected: '"Bom dia, Ana!"' },
        { name: '14h → Boa tarde', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Ana", relogio=lambda: _dt(2024, 1, 1, 14))', expected: '"Boa tarde, Ana!"' },
        { name: '21h → Boa noite', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Ana", relogio=lambda: _dt(2024, 1, 1, 21))', expected: '"Boa noite, Ana!"' },
        { name: 'limite: 12h já é tarde', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Bia", relogio=lambda: _dt(2024, 1, 1, 12))', expected: '"Boa tarde, Bia!"', hidden: true },
        { name: 'limite: 5h já é dia', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Bia", relogio=lambda: _dt(2024, 1, 1, 5))', expected: '"Bom dia, Bia!"', hidden: true },
        { name: 'limite: 18h já é noite', setup: 'from datetime import datetime as _dt', expr: 'saudacao("Bia", relogio=lambda: _dt(2024, 1, 1, 18))', expected: '"Boa noite, Bia!"', hidden: true },
        { name: 'sem relógio usa o real', code: 'r = saudacao("Caio")\nassert r.startswith("Bo") and r.endswith("Caio!"), r', hidden: true },
      ],
      reviews: [
        {
          when: (m, code) => /datetime\.now\(\)/.test(code),
          text: 'Ainda há uma chamada direta a `datetime.now()`. Com o relógio injetado, a função deve usar **só** `relogio()` — o padrão `relogio=datetime.now` (sem parênteses) já cobre a produção.',
          concept: 'Injeção de dependência (relógio)',
        },
      ],
      hints: [
        'Mude a assinatura para `def saudacao(nome, relogio=datetime.now):` — repare: **sem** parênteses, você passa a função, não chama.',
        'Dentro da função, troque `datetime.now().hour` por `relogio().hour`.',
      ],
      solution: `from datetime import datetime


def saudacao(nome, relogio=datetime.now):
    hora = relogio().hour
    if 5 <= hora < 12:
        return f"Bom dia, {nome}!"
    if 12 <= hora < 18:
        return f"Boa tarde, {nome}!"
    return f"Boa noite, {nome}!"
`,
      solutionExplanation: 'O relógio virou uma **dependência injetada**: em produção, `datetime.now` (a função, sem chamar); nos testes, `lambda: datetime(2024, 1, 1, 9)`. Agora cada horário — inclusive os limites 5h, 12h e 18h — pode ser testado de forma **repetível**, a qualquer hora do dia.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Resumindo: cobertura mostra o que **não** foi testado; mutation testing mostra se o que foi testado está **bem** testado.',
        'E testes bons são FIRST: rápidos, isolados, repetíveis — com relógio, aleatoriedade e rede **injetados**, nunca soltos.',
      ],
      board: null,
    },
  ],
});
