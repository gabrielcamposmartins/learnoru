Game.registerModule('testing', {
  id: 'tdd-kata',
  title: 'Kata TDD: String Calculator',
  kind: 'challenge',
  level: 3,
  order: 21,
  unit: 'tdd',
  summary: 'Cinco ciclos de TDD encadeados construindo uma calculadora de strings — do caso vazio às exceções.',
  concepts: ['TDD', 'Baby steps', 'Triangulação', 'Testes de regressão', 'pytest.raises'],
  takeaways: [
    'Cada ciclo começa com um teste **vermelho**; o código só cresce quando algum teste exige.',
    'Os testes dos ciclos anteriores ficam na suíte como **testes de regressão** — foi essa rede que permitiu trocar `int(texto)` por `split` sem medo.',
    '**Triangular** com dois ou mais exemplos derruba valores chumbados e força a generalização.',
    'O **refactor** acontece no verde: eliminar duplicação (como quebrar o texto duas vezes) sem mudar o comportamento.',
    'A **Transformation Priority Premise** sugere preferir as transformações mais simples (nil → constante → escalar → `if` → coleção) ao sair do vermelho.',
  ],
  glossary: [
    { term: 'Kata', aliases: ['katas', 'code kata', 'coding kata'], definition: 'Exercício curto e repetível para treinar uma técnica — como TDD — até o ritmo virar hábito. O nome vem das artes marciais; em software, foi popularizado por Dave Thomas.' },
    { term: 'Transformation Priority Premise', aliases: ['TPP', 'premissa da prioridade das transformações'], definition: 'Lista ordenada, proposta por Robert C. Martin, das transformações que levam o código do vermelho ao verde — nil → constante → escalar → `if` → coleção → laço… Preferir as mais simples evita saltos grandes.' },
    { term: 'Teste de regressão', aliases: ['testes de regressão', 'regression test', 'regression tests'], definition: 'Teste que protege um comportamento que já funcionava: falha se uma mudança nova o quebrar.' },
    { term: 'Baby steps', aliases: ['passos pequenos', 'passos de bebê'], definition: 'Ciclos de TDD bem curtos — um teste, o mínimo de código — para que qualquer erro esteja nas últimas linhas escritas.' },
    { term: 'Triangulação', aliases: ['triangulation'], definition: 'Adicionar um segundo (ou terceiro) exemplo de teste que derruba um valor chumbado e força a implementação geral.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hora de um kata de verdade: a **String Calculator**, criada pelo Roy Osherove para treinar TDD.',
        'São **cinco ciclos**. Em cada um, um requisito novo — e o código do ciclo anterior continua no editor.',
      ],
      board: {
        title: 'Relembrando o ritmo',
        md: `| Fase | Pergunta que você faz |
|---|---|
| 🔴 **Red** | Qual é o **menor** próximo comportamento? O teste falha pelo motivo certo? |
| 🟢 **Green** | Qual é o **mínimo** de código que faz passar? |
| 🔵 **Refactor** | O código está claro? Tem duplicação? Os testes continuam verdes? |

> [!dica] **Baby steps**: se um ciclo parecer grande demais, é porque ele é. Divida o requisito em um teste menor.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A regra do kata: **não leia os requisitos do próximo ciclo antes da hora**. O design deve emergir dos testes, não de um plano gigante.',
        'E um detalhe importante: os testes antigos **ficam na suíte**. Eles viram testes de regressão — se um ciclo novo quebrar um comportamento antigo, você descobre na hora.',
      ],
      board: {
        title: 'A calculadora',
        md: `Vamos construir a função \`somar(texto)\` no arquivo \`calculadora.py\`:

\`\`\`python
somar("")          # → 0
somar("5")         # → 5
somar("1,2,3")     # → 6
# … e mais requisitos a cada ciclo
\`\`\`

> [!atencao] Cada ciclo começa pelo **teste**. O botão só libera a implementação quando o teste estiver vermelho.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma curiosidade antes de começar: existe uma **ordem preferida** para as mudanças que você faz na fase verde.',
        'O Uncle Bob chamou isso de **Transformation Priority Premise**. Repare, durante o kata, como o código sobe essa escada degrau por degrau.',
      ],
      board: {
        title: 'Transformation Priority Premise (TPP)',
        md: `Na fase **verde**, cada mudança no código é uma *transformação*. Algumas delas, da mais simples para a mais complexa:

| Prioridade | Transformação | Exemplo |
|---|---|---|
| 1 | \`{}\` → nil | nenhum código → \`return None\` |
| 2 | nil → constante | \`return None\` → \`return 0\` |
| 3 | constante → escalar | \`return 0\` → \`return int(texto)\` |
| 4 | incondicional → \`if\` | surge \`if not texto: return 0\` |
| 5 | escalar → coleção | \`int(texto)\` → \`texto.split(",")\` |
| 6 | \`if\` → laço | um caso especial vira uma repetição (\`while\`) |

> [!sabia] A premissa, de Robert C. Martin, diz que preferir as transformações **do topo** — e escolher o próximo teste que exija a transformação mais simples possível — evita saltos grandes e tende a produzir algoritmos melhores. Se um teste obriga você a pular vários degraus de uma vez, talvez exista um teste **menor** para escrever antes.
>
> E para quem quer baby steps **radicais**: o **TCR** (*test && commit || revert*), de Kent Beck, faz commit automático quando os testes passam e **apaga** sua mudança quando falham.`,
      },
    },
    {
      type: 'section',
      title: 'Atividades de fixação: o kata',
      subtitle: '5 ciclos de Red → Green → Refactor, cada um com um requisito novo.',
      icon: '🥋',
      text: 'Vamos lá! Primeiro ciclo: o caso mais simples de todos.',
    },
    {
      type: 'tdd',
      id: 'tst-kata-c1',
      kata: 'calc',
      module: 'calculadora',
      concept: 'Red-Green-Refactor',
      title: 'Ciclo 1 — string vazia',
      say: 'Ciclo 1. O `calculadora.py` está vazio. Escreva o teste do caso mais simples — e veja ele falhar.',
      prompt: '**Requisito:** `somar("")` devolve `0`.',
      testStarter: `from calculadora import somar


def test_string_vazia_devolve_zero():
    # verifique com assert o resultado de somar("")
    ...
`,
      implStarter: '# calculadora.py — a implementação nasce guiada pelos testes.\n',
      stub: 'def somar(texto):\n    return None\n',
      reference: 'def somar(texto):\n    return 0\n',
      checks: [
        { name: 'somar("") == 0', expr: 'somar("")', expected: '0' },
        { name: 'devolve int', code: 'assert isinstance(somar(""), int)' },
      ],
      hints: [
        'O teste: `assert somar("") == 0`. O primeiro run falha com erro de import — esse é o seu vermelho.',
        'Na fase verde, `def somar(texto): return 0` é o mínimo. Sim, é "fake it" — os próximos ciclos vão generalizar.',
      ],
      solutionTests: `from calculadora import somar


def test_string_vazia_devolve_zero():
    assert somar("") == 0
`,
      solutionImpl: 'def somar(texto):\n    return 0\n',
      solutionExplanation: 'Para um único requisito, `return 0` **é** a implementação correta. Não antecipe o futuro: os próximos testes vão exigir mais.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Parece bobo devolver `0` direto, né? Mas é exatamente o ponto: você só escreve o código que algum teste exige.',
      ],
    },
    {
      type: 'tdd',
      id: 'tst-kata-c2',
      kata: 'calc',
      module: 'calculadora',
      concept: 'Baby steps',
      title: 'Ciclo 2 — um número',
      say: 'Ciclo 2. Adicione **um** teste novo — o da string vazia continua lá.',
      prompt: '**Requisito:** um único número devolve ele mesmo. Ex.: `somar("5") == 5`, `somar("42") == 42`.',
      reference: `def somar(texto):
    if texto == "":
        return 0
    return int(texto)
`,
      checks: [
        { name: 'somar("7") == 7', expr: 'somar("7")', expected: '7' },
        { name: 'somar("123") == 123', expr: 'somar("123")', expected: '123' },
        { name: 'string vazia continua 0', expr: 'somar("")', expected: '0' },
      ],
      hints: [
        'Novo teste: `def test_um_numero_devolve_ele_mesmo(): assert somar("5") == 5`.',
        'Na implementação: se o texto for vazio, `0`; senão, `int(texto)`.',
      ],
      solutionTests: `from calculadora import somar


def test_string_vazia_devolve_zero():
    assert somar("") == 0


def test_um_numero_devolve_ele_mesmo():
    assert somar("5") == 5
    assert somar("42") == 42
`,
      solutionImpl: `def somar(texto):
    if texto == "":
        return 0
    return int(texto)
`,
      solutionExplanation: 'Dois exemplos (`"5"` e `"42"`) já **triangulam**: um `return 5` chumbado não passaria. O teste do ciclo 1 segue protegendo o caso vazio.',
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Repare no teste do ciclo 1: ele continua rodando a cada ciclo. Se você mexer no `if` e quebrar o caso vazio, ele avisa na hora.',
        'Agora vem o primeiro requisito que realmente muda o design. Um teste de cada vez!',
      ],
    },
    {
      type: 'tdd',
      id: 'tst-kata-c3',
      kata: 'calc',
      module: 'calculadora',
      concept: 'Triangulação',
      title: 'Ciclo 3 — vários números',
      say: 'Ciclo 3: vírgulas! Pense em qual teste derruba a implementação atual.',
      prompt: '**Requisito:** números separados por vírgula são somados — qualquer quantidade. Ex.: `somar("1,2") == 3`, `somar("1,2,3,4") == 10`.',
      reference: `def somar(texto):
    if not texto:
        return 0
    return sum(int(parte) for parte in texto.split(","))
`,
      checks: [
        { name: 'somar("10,20") == 30', expr: 'somar("10,20")', expected: '30' },
        { name: 'somar("1,1,1,1,1") == 5', expr: 'somar("1,1,1,1,1")', expected: '5' },
        { name: 'um número continua funcionando', expr: 'somar("8")', expected: '8' },
        { name: 'string vazia continua 0', expr: 'somar("")', expected: '0' },
      ],
      refactorTip: 'Tudo verde! Dá para deixar mais expressivo? Um laço com `total += …` funciona, mas `sum(int(p) for p in texto.split(","))` diz a intenção numa linha. E `if not texto:` é o jeito pythônico de testar string vazia.',
      reviews: [
        {
          when: (m, code) => /\+=/.test(code),
          text: 'A soma ficou num laço com acumulador (`total += …`). `sum()` com uma expressão geradora expressa a intenção diretamente — é o tipo de melhoria que a fase de refactor existe para fazer.',
          concept: 'Refatoração: expressividade',
        },
      ],
      hints: [
        'Um teste com dois números (`"1,2"`) já falha: `int("1,2")` levanta `ValueError`.',
        'Use `texto.split(",")` para quebrar em partes e some cada `int(parte)`.',
        'Pense em triangular: `"1,2"` e `"1,2,3,4"` evitam uma solução que só funciona para dois números.',
      ],
      solutionTests: `from calculadora import somar


def test_string_vazia_devolve_zero():
    assert somar("") == 0


def test_um_numero_devolve_ele_mesmo():
    assert somar("5") == 5
    assert somar("42") == 42


def test_dois_numeros_separados_por_virgula():
    assert somar("1,2") == 3


def test_varios_numeros():
    assert somar("1,2,3,4") == 10
`,
      solutionImpl: `def somar(texto):
    if not texto:
        return 0
    return sum(int(parte) for parte in texto.split(","))
`,
      solutionExplanation: 'Com `split(",")` o caso de um número vira um caso particular (uma lista com um item) — o código ficou **mais geral e menor**. Os testes antigos garantiram que nada quebrou.',
    },
    {
      type: 'tdd',
      id: 'tst-kata-c4',
      kata: 'calc',
      module: 'calculadora',
      concept: 'Baby steps',
      title: 'Ciclo 4 — quebra de linha',
      say: 'Ciclo 4. Requisito novo do "cliente": quebras de linha também separam números.',
      prompt: '**Requisito:** a quebra de linha (`\\n`) também separa números, misturada ou não com vírgulas. Ex.: `somar("1\\n2,3") == 6`.',
      reference: `def somar(texto):
    if not texto:
        return 0
    partes = texto.replace("\\n", ",").split(",")
    return sum(int(parte) for parte in partes)
`,
      checks: [
        { name: 'somar("1\\n2\\n3") == 6', expr: 'somar("1\\n2\\n3")', expected: '6' },
        { name: 'somar("4\\n5,6") == 15', expr: 'somar("4\\n5,6")', expected: '15' },
        { name: 'vírgulas continuam funcionando', expr: 'somar("1,2,3")', expected: '6' },
        { name: 'string vazia continua 0', expr: 'somar("")', expected: '0' },
      ],
      refactorTip: 'Verde! Há mais de um jeito de tratar dois separadores: `texto.replace("\\n", ",")` antes do `split`, ou `re.split(r"[,\\n]", texto)`. Escolha o que ficar mais legível para você — e rode os testes.',
      hints: [
        'No teste, escreva a string com `\\n`: `assert somar("1\\n2,3") == 6`.',
        'Uma saída simples: troque `"\\n"` por `","` com `replace` antes de fazer o `split(",")`.',
      ],
      solutionTests: `from calculadora import somar


def test_string_vazia_devolve_zero():
    assert somar("") == 0


def test_um_numero_devolve_ele_mesmo():
    assert somar("5") == 5
    assert somar("42") == 42


def test_dois_numeros_separados_por_virgula():
    assert somar("1,2") == 3


def test_varios_numeros():
    assert somar("1,2,3,4") == 10


def test_quebra_de_linha_tambem_separa():
    assert somar("1\\n2,3") == 6
`,
      solutionImpl: `def somar(texto):
    if not texto:
        return 0
    partes = texto.replace("\\n", ",").split(",")
    return sum(int(parte) for parte in partes)
`,
      solutionExplanation: 'Normalizar os separadores (`\\n` → `,`) antes de dividir mantém uma única regra de parsing. Mudança pequena, protegida por todos os testes anteriores.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Último ciclo — e ele testa um **erro**. Comportamento de exceção também é comportamento, e também nasce de um teste.',
        'Lembra do `pytest.raises`? Com `match=` você verifica até a mensagem, que é uma regex.',
      ],
      board: {
        title: 'Testando exceções',
        code: `import pytest


def test_divisao_por_zero():
    with pytest.raises(ZeroDivisionError):
        1 / 0


def test_mensagem_do_erro():
    with pytest.raises(ValueError, match="inválido"):
        raise ValueError("valor inválido: -1")`,
      },
    },
    {
      type: 'tdd',
      id: 'tst-kata-c5',
      kata: 'calc',
      module: 'calculadora',
      concept: 'pytest.raises',
      title: 'Ciclo 5 — negativos',
      say: 'Ciclo 5! Números negativos não são permitidos — e a mensagem precisa dizer **quais** foram.',
      prompt: `**Requisito:** se houver números negativos, \`somar\` levanta \`ValueError\` com uma mensagem que lista **todos** os negativos, separados por vírgula e espaço.

Ex.: \`somar("1,-2,-3")\` → \`ValueError("negativos não permitidos: -2, -3")\`. Somas sem negativos continuam iguais.`,
      reference: `def somar(texto):
    if not texto:
        return 0
    numeros = [int(parte) for parte in texto.replace("\\n", ",").split(",")]
    negativos = [n for n in numeros if n < 0]
    if negativos:
        raise ValueError("negativos não permitidos: " + ", ".join(str(n) for n in negativos))
    return sum(numeros)
`,
      checks: [
        {
          name: 'lista todos os negativos',
          code: `try:
    somar("1,-2,-3")
    assert False, "deveria levantar ValueError"
except ValueError as erro:
    assert "-2" in str(erro) and "-3" in str(erro)`,
        },
        {
          name: 'um negativo sozinho',
          code: `try:
    somar("-5")
    assert False, "deveria levantar ValueError"
except ValueError as erro:
    assert "-5" in str(erro)`,
        },
        { name: 'negativo depois de quebra de linha', code: `try:
    somar("4\\n-1")
    assert False, "deveria levantar ValueError"
except ValueError as erro:
    assert "-1" in str(erro)` },
        { name: 'positivos continuam somando', expr: 'somar("1\\n2,3")', expected: '6' },
        { name: 'string vazia continua 0', expr: 'somar("")', expected: '0' },
      ],
      refactorTip: 'Verde! Repare se o texto está sendo **quebrado em números mais de uma vez** (uma vez para achar negativos, outra para somar). Converter tudo uma vez para uma lista `numeros` e reutilizá-la elimina a duplicação.',
      reviews: [
        {
          when: (m, code) => (code.match(/\.split\(/g) || []).length > 1,
          text: 'O texto é dividido (`split`) mais de uma vez — a regra de parsing ficou duplicada. Converta para uma lista de números uma única vez e use-a para validar e para somar.',
          concept: 'Refatoração: remover duplicação',
        },
      ],
      hints: [
        'No teste: `with pytest.raises(ValueError, match="-2, -3"): somar("1,-2,-3")` (lembre do `import pytest`).',
        'Na implementação, primeiro converta as partes em uma lista de inteiros; depois filtre `n < 0`.',
        'Monte a mensagem com `", ".join(str(n) for n in negativos)`.',
      ],
      solutionTests: `import pytest

from calculadora import somar


def test_string_vazia_devolve_zero():
    assert somar("") == 0


def test_um_numero_devolve_ele_mesmo():
    assert somar("5") == 5
    assert somar("42") == 42


def test_dois_numeros_separados_por_virgula():
    assert somar("1,2") == 3


def test_varios_numeros():
    assert somar("1,2,3,4") == 10


def test_quebra_de_linha_tambem_separa():
    assert somar("1\\n2,3") == 6


def test_negativos_levantam_erro_listando_todos():
    with pytest.raises(ValueError, match="-2, -3"):
        somar("1,-2,-3")
`,
      solutionImpl: `def somar(texto):
    if not texto:
        return 0
    numeros = [int(parte) for parte in texto.replace("\\n", ",").split(",")]
    negativos = [n for n in numeros if n < 0]
    if negativos:
        raise ValueError("negativos não permitidos: " + ", ".join(str(n) for n in negativos))
    return sum(numeros)
`,
      solutionExplanation: 'O `match=` do `pytest.raises` verifica a mensagem (é uma **regex** buscada no texto do erro). Na implementação, o texto é convertido em números **uma vez**; a lista `numeros` serve tanto para validar quanto para somar.',
    },
    {
      type: 'section',
      title: 'Reflexão',
      subtitle: 'O que o kata ensinou sobre o processo.',
      icon: '🪞',
      text: 'Kata concluído! Agora três perguntas rápidas sobre o que aconteceu no caminho.',
      mood: 'cheer',
    },
    {
      type: 'mcq',
      id: 'tst-kata-q1',
      concept: 'Testes de regressão',
      say: 'Pensa no ciclo 3, quando o `int(texto)` virou um `split`…',
      prompt: 'Durante o kata, por que os testes dos ciclos anteriores **continuam na suíte** em vez de serem apagados?',
      options: [
        { text: 'Eles viram testes de regressão: garantem que um requisito novo não quebrou um comportamento antigo.', correct: true, why: 'É isso que permitiu reescrever o parsing no ciclo 3 sem medo.' },
        { text: 'Porque o pytest não permite apagar testes que já passaram.', why: 'O pytest não tem nenhuma regra assim.' },
        { text: 'Só para aumentar o número de testes e a cobertura.', why: 'O valor não está na quantidade, e sim na proteção contra regressões.' },
        { text: 'Não deveriam continuar: cada ciclo deveria substituir os testes do anterior.', why: 'Aí você perderia a garantia de que os comportamentos antigos ainda funcionam.' },
      ],
      explanation: 'A suíte acumulada é a **rede de segurança** do TDD. No ciclo 3, o código mudou de `int(texto)` para `sum(... split(","))` — os testes do caso vazio e do número único provaram na hora que nada quebrou.',
    },
    {
      type: 'match',
      id: 'tst-rx2-kata1',
      concept: 'Transformation Priority Premise',
      say: 'Rodada rápida: qual transformação da TPP aconteceu em cada mudança?',
      prompt: 'Associe cada **mudança de código** (do kata, do FizzBuzz ou do kata de números romanos) à **transformação** da *Transformation Priority Premise* que ela representa.',
      pairs: [
        { left: '`return None` vira `return 0`', right: 'nil → constante' },
        { left: '`return "1"` vira `return str(n)`', right: 'constante → escalar' },
        { left: 'surge `if not texto: return 0` antes do `return int(texto)`', right: 'incondicional → `if`' },
        { left: '`int(texto)` vira `sum(int(p) for p in texto.split(","))`', right: 'escalar → coleção' },
        { left: '`if n >= 10: resultado += "X"` vira `while n >= 10: …`', right: '`if` → laço' },
      ],
      explanation: 'A TPP ordena as transformações da mais simples (nil → constante) para as mais complexas (coleções, laços, recursão). Em cada ciclo, prefira o teste que exija a transformação **mais simples** ainda não feita: foi assim que o kata saiu de `return 0` para o `split` sem nenhum salto grande. No kata de números romanos, o `if` que trata **um** "X" vira um `while` que trata **vários** — a triangulação empurrando a generalização.',
    },
    {
      type: 'open',
      id: 'tst-kata-q2',
      concept: 'Baby steps',
      say: 'Última: como numa retrospectiva do time.',
      prompt: 'O que você observou sobre **baby steps** neste kata? Como o TDD influenciou o design da função `somar`?',
      minWords: 18,
      rubric: [
        { label: 'Fala de **passos pequenos** / um teste por vez', keywords: ['pequen', 'baby', 'um teste por vez', 'um de cada vez', 'incremen', 'aos poucos', 'passo a passo'], concept: 'Baby steps' },
        { label: 'Cita a **suíte como rede de segurança** (regressão) ao mudar o código', keywords: ['regress', 'seguranca', 'confian', ['testes', 'antigos'], 'quebr'], concept: 'Testes de regressão' },
        { label: 'Percebe o **design emergindo** (generalização, código simples, sem antecipar requisitos)', keywords: ['emerg', 'generaliz', 'simples', 'antecip', 'design', 'minimo', 'yagni'], concept: 'Design emergente' },
        { label: 'Menciona **refatoração** como parte do ciclo', keywords: ['refator'], concept: 'Refatoração' },
      ],
      modelAnswer: `Trabalhar em **passos pequenos** — um teste por vez, o mínimo de código para passar — fez cada ciclo durar poucos minutos e deixou claro onde estava qualquer erro.

A suíte acumulada virou uma **rede de segurança**: no ciclo 3 reescrevi o parsing (de \`int(texto)\` para \`split\`) e os testes antigos mostraram na hora que nada tinha quebrado — isso é teste de regressão.

O **design emergiu** dos requisitos: não antecipei separadores nem exceções; o código foi generalizando só quando um teste exigiu, e a fase de **refatoração** removeu duplicações (como quebrar o texto duas vezes no ciclo dos negativos).`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Parabéns! Cinco ciclos, uma função completa, e **nenhuma linha** de código sem um teste pedindo por ela.',
        'Leve daqui: passos pequenos, testes antigos como rede de segurança, e o refactor como parte do ciclo — sempre no verde.',
      ],
      board: null,
    },
  ],
});
