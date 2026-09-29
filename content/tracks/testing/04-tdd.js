Game.registerModule('testing', {
  id: 'tdd',
  title: 'TDD: Red → Green → Refactor',
  kind: 'lesson',
  level: 2,
  order: 20,
  unit: 'tdd',
  summary: 'Test-Driven Development na prática: o ciclo, baby steps, fake it, triangulação — e um kata FizzBuzz guiado.',
  concepts: ['TDD', 'Red-Green-Refactor', 'Baby steps', 'Triangulação', 'Refatoração'],
  takeaways: [
    'O ciclo é **Red → Green → Refactor**: um teste pequeno falhando, o mínimo de código para passar e a limpeza com tudo verde.',
    'Ver o teste **falhar** primeiro prova que ele detecta a ausência do comportamento — um teste que nunca falhou pode não testar nada.',
    'Na fase verde, **fake it** é um passo válido; a **triangulação** com outro exemplo força a generalização. Quando a solução é óbvia, escreva-a direto.',
    'O **refactor** faz parte do ciclo: é ali que o design melhora, protegido pelos testes.',
    'Existem duas escolas — **Detroit** (estado, objetos reais) e **Londres** (interações, mocks) — e o TDD rende pouco em protótipos e requisitos incertos.',
  ],
  glossary: [
    { term: 'TDD', aliases: ['Test-Driven Development', 'desenvolvimento guiado por testes'], definition: '*Test-Driven Development*: escrever um teste pequeno **antes** do código, vê-lo falhar, fazê-lo passar com o mínimo e refatorar — em ciclos de minutos. Popularizado por Kent Beck.' },
    { term: 'Red-Green-Refactor', aliases: ['red → green → refactor', 'red, green, refactor'], definition: 'As três fases do ciclo de TDD: **red** (um teste falhando), **green** (o mínimo para passar) e **refactor** (melhorar a estrutura com todos os testes verdes).' },
    { term: 'Fake it', aliases: ['fake it till you make it'], definition: 'Estratégia da fase verde: devolver um valor **chumbado** só para o teste passar. Parece trapaça, mas é um passo seguro — o próximo exemplo (triangulação) força a generalização.' },
    { term: 'Implementação óbvia', aliases: ['obvious implementation'], definition: 'Estratégia da fase verde em que você escreve direto a solução geral, porque ela é simples e clara. Se o teste falhar de um jeito inesperado, volte a passos menores.' },
    { term: 'Escola de Detroit', aliases: ['escola de Chicago', 'Detroit school', 'Chicago school', 'TDD clássico', 'classicista', 'classicistas'], definition: 'Estilo de TDD (Kent Beck e a turma do XP) que avança **de dentro para fora**, usa objetos reais sempre que possível e verifica **estado**; dublês só nas fronteiras.' },
    { term: 'Escola de Londres', aliases: ['London school', 'TDD mockista', 'mockista', 'mockistas'], definition: 'Estilo de TDD, associado ao livro *GOOS* (Freeman e Pryce), que avança **de fora para dentro**, a partir de testes de aceitação, e usa **mocks** para desenhar as colaborações entre objetos; verifica **interações**.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Chegou a hora do **TDD** — *Test-Driven Development*, popularizado pelo Kent Beck.',
        'A ideia vira a ordem de costume de cabeça para baixo: você escreve o **teste antes** do código. O teste descreve o que você quer; o código vem para satisfazê-lo.',
      ],
      board: {
        title: 'O ciclo do TDD',
        md: `\`\`\`text
   ┌───────────┐      ┌───────────┐      ┌──────────────┐
   │  🔴 RED   │ ───▶ │ 🟢 GREEN  │ ───▶ │ 🔵 REFACTOR  │ ──┐
   └───────────┘      └───────────┘      └──────────────┘   │
         ▲───────────────────────────────────────────────────┘
\`\`\`

| Fase | O que fazer | Regra de ouro |
|---|---|---|
| 🔴 **Red** | Escreva **um** teste pequeno para o próximo comportamento | Ele precisa **falhar** — e pelo motivo certo |
| 🟢 **Green** | Escreva o **mínimo** de código para passar | Vale até "trapacear" (fake it) |
| 🔵 **Refactor** | Melhore nomes, remova duplicação | Os testes continuam **verdes** o tempo todo |`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Por que ver o teste **falhar** primeiro? Porque um teste que nunca falhou pode estar testando nada — um `assert` esquecido, um nome sem `test_`, um import errado.',
        'O vermelho prova que o teste consegue detectar a ausência do comportamento. Só então o verde significa alguma coisa.',
      ],
      board: {
        title: 'As três leis do TDD (Robert C. Martin)',
        md: `1. Você não escreve código de produção **a não ser** para fazer passar um teste que está falhando.
2. Você não escreve **mais teste** do que o suficiente para falhar (erro de import também conta como falha).
3. Você não escreve **mais código** do que o suficiente para o teste passar.

> [!dica] O resultado são **baby steps**: ciclos de poucos minutos. Se algo quebrar, o erro está nas últimas linhas que você escreveu.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na fase verde existem três estratégias. A mais curiosa é o **fake it**: devolver um valor "chumbado" só para passar.',
        'Parece trapaça, mas é um passo seguro. O próximo teste, com outro exemplo, **força** a generalização — isso se chama **triangulação**.',
      ],
      board: {
        title: 'Fake it → triangulação → implementação óbvia',
        code: `# 🔴 teste 1
def test_soma_simples():
    assert soma(2, 3) == 5

# 🟢 fake it: passa, mas está "chumbado"
def soma(a, b):
    return 5

# 🔴 teste 2 — triangulação: outro exemplo derruba o fake
def test_soma_outros_valores():
    assert soma(10, 1) == 11

# 🟢 agora a implementação geral é inevitável
def soma(a, b):
    return a + b`,
        caption: 'Quando a implementação é **óbvia**, pode escrevê-la direto. Fake it e triangulação são para quando você não tem certeza.',
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'E o **refactor** não é opcional: é ali que o design melhora. Com testes verdes, você pode mudar a estrutura com segurança.',
        'Resumindo os ganhos: design que nasce testável, rede de segurança para refatorar e testes que documentam o comportamento. Os custos: exige disciplina, e em código exploratório ou muito visual o ciclo rende menos.',
      ],
      board: {
        title: 'TDD — ganhos e críticas',
        md: `| ✅ Ganhos | ⚠️ Críticas / cuidados |
|---|---|
| Design emerge **testável** e desacoplado | Mais lento no começo |
| Rede de segurança para refatorar | Pouco útil em protótipos/exploração |
| Testes viram **documentação viva** | Testes acoplados à implementação atrapalham refatorações |
| Bugs aparecem minutos depois de criados | Não substitui testes de integração/e2e |

> [!atencao] TDD **não** é "ter 100% de cobertura" nem "escrever todos os testes antes". É um ciclo curto, **um** teste por vez.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma coisa que quase ninguém conta: existem **duas escolas** de TDD, e elas discordam justamente sobre os mocks.',
        'Nenhuma está "certa" — mas saber a diferença é um ótimo sinal numa entrevista de sênior.',
      ],
      board: {
        title: 'Duas escolas de TDD',
        md: `| | **Detroit / Chicago** (clássica) | **Londres** (mockista) |
|---|---|---|
| Direção | de dentro para fora: começa pelas regras do domínio | de fora para dentro: começa por um teste de aceitação |
| Dublês | só nas fronteiras (rede, banco, relógio) | mocks para desenhar cada colaboração |
| Verifica | **estado**: o resultado final | **interações**: quem chama quem |
| Risco | o desenho das colaborações aparece tarde | testes acoplados à implementação |
| Referência | Kent Beck, *TDD by Example* | Freeman e Pryce, *Growing Object-Oriented Software, Guided by Tests* (GOOS) |

> [!sabia] Kent Beck diz que **redescobriu** o TDD, e não que o inventou: ele conta que leu, num livro antigo de programação, a sugestão de pegar a fita de entrada, **digitar à mão a fita de saída esperada** e programar até a saída real bater com ela. Em 2023, ele publicou o *Canon TDD* para desfazer mal-entendidos: o ciclo começa com uma **lista de cenários de teste**, e só **um** item da lista vira teste executável por vez.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Três perguntas e depois um kata guiado.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'tst-tdd-q1',
      concept: 'Red-Green-Refactor',
      say: 'Qual o objetivo real da fase vermelha?',
      prompt: 'No TDD, por que é importante **ver o teste falhar** antes de escrever a implementação?',
      options: [
        { text: 'Para provar que o teste consegue detectar a ausência do comportamento — um teste que nunca falhou pode não testar nada.', correct: true, why: 'Exatamente: o vermelho valida o próprio teste.' },
        { text: 'Porque o pytest exige que o primeiro run de um arquivo falhe.', why: 'O pytest não tem essa regra.' },
        { text: 'Para aumentar a cobertura de código.', why: 'Cobertura mede linhas executadas; ver o teste falhar não muda isso.' },
        { text: 'Não é importante; o que importa é o teste passar no final.', why: 'Um teste que passa sem nunca ter falhado pode ter um `assert` faltando ou verificar a coisa errada.' },
      ],
      explanation: 'O vermelho é a **prova de que o teste funciona**: ele detecta a falta do comportamento. Um teste que já nasce verde pode estar sem `assert`, com nome sem `test_` (não coletado) ou verificando algo que já era verdade.',
    },
    {
      type: 'mcq',
      id: 'tst-tdd-q2',
      concept: 'Triangulação',
      say: 'Agora sobre a fase verde…',
      prompt: `Você escreveu \`test_dobro(): assert dobro(3) == 6\` e implementou:

\`\`\`python
def dobro(n):
    return 6
\`\`\`

O que o TDD recomenda como próximo passo?`,
      options: [
        { text: 'Isso é "fake it": válido como passo. Escreva outro teste (ex.: `dobro(5) == 10`) para forçar a generalização — triangulação.', correct: true, why: 'O segundo exemplo derruba o valor chumbado e leva à implementação geral.' },
        { text: 'Isso é errado; o TDD proíbe retornar valores fixos.', why: 'Fake it é uma estratégia clássica do próprio Kent Beck.' },
        { text: 'Apagar o teste, porque ele passou fácil demais.', why: 'O teste é válido; o que falta é outro exemplo.' },
        { text: 'Adicionar 100% de cobertura antes de continuar.', why: 'Cobertura não resolve: `return 6` tem 100% de cobertura e continua errado.' },
      ],
      explanation: '**Fake it** faz o teste passar rápido com um valor chumbado; a **triangulação** adiciona um segundo exemplo que só uma implementação geral satisfaz. Repare que `return 6` teria 100% de cobertura — cobertura não prova corretude.',
    },
    {
      type: 'order',
      id: 'tst-rx-tdd1',
      concept: 'Red-Green-Refactor',
      say: 'Agora ponha uma sessão de TDD em ordem — do jeito que o próprio Kent Beck descreve no *Canon TDD*.',
      prompt: 'Coloque os passos de uma sessão de TDD na **ordem certa**.',
      items: [
        'Escrever uma **lista de cenários** de teste que você quer cobrir',
        'Transformar **um** item da lista num teste concreto e executável',
        'Rodar e ver o teste **falhar** pelo motivo certo',
        'Mudar o código até esse teste — e todos os anteriores — **passarem**',
        '**Refatorar**, se preciso, mantendo tudo verde',
        'Voltar ao segundo passo até a lista **esvaziar**',
      ],
      explanation: 'A lista de cenários evita tentar resolver tudo de uma vez — e ela cresce conforme você descobre casos novos. Depois, **um** teste por vez: vermelho (pelo motivo certo, não por um erro de digitação), verde com o mínimo, refatoração protegida pelos testes e de volta à lista. Escrever todos os testes antes, ou refatorar com testes vermelhos, são desvios clássicos do ciclo.',
    },
    {
      type: 'section',
      title: 'Kata: FizzBuzz',
      subtitle: '`fizzbuzz(n)` devolve `"Fizz"` para múltiplos de 3, `"Buzz"` para múltiplos de 5, `"FizzBuzz"` para múltiplos de ambos e o próprio número como texto nos outros casos. Vamos construir isso **em 3 ciclos**.',
      icon: '🥋',
      text: 'Um **kata** é um exercício curto para treinar o ritmo. Vamos fazer o FizzBuzz em três ciclos — cada um começa pelo teste!',
    },
    {
      type: 'tdd',
      id: 'tst-tdd-kata1',
      kata: 'fizzbuzz',
      module: 'fizzbuzz',
      concept: 'Red-Green-Refactor',
      title: 'Ciclo 1 — números comuns',
      say: 'Ciclo 1. O arquivo `fizzbuzz.py` está **vazio** — escreva o teste primeiro. Ele vai falhar (nem existe a função ainda), e tudo bem!',
      prompt: '**Requisito:** para números comuns, `fizzbuzz(n)` devolve o número **como texto**. Ex.: `fizzbuzz(1) == "1"`.',
      testStarter: `from fizzbuzz import fizzbuzz


def test_numero_comum_vira_texto():
    # verifique com assert o que fizzbuzz(1) deve devolver
    ...
`,
      implStarter: '# fizzbuzz.py — a implementação nasce aqui, guiada pelos testes.\n',
      stub: 'def fizzbuzz(n):\n    return None\n',
      reference: 'def fizzbuzz(n):\n    return str(n)\n',
      checks: [
        { name: 'fizzbuzz(1) == "1"', expr: 'fizzbuzz(1)', expected: '"1"' },
        { name: 'fizzbuzz(2) == "2"', expr: 'fizzbuzz(2)', expected: '"2"' },
        { name: 'fizzbuzz(7) == "7"', expr: 'fizzbuzz(7)', expected: '"7"' },
        { name: 'devolve str, não int', code: 'assert isinstance(fizzbuzz(4), str)' },
      ],
      hints: [
        'No teste, basta `assert fizzbuzz(1) == "1"`. Rode: vai dar erro de import — é o seu vermelho.',
        'Na fase verde, `return str(n)` resolve. Se quiser praticar fake it, `return "1"` passa… mas a verificação do requisito vai pedir a generalização.',
      ],
      solutionTests: `from fizzbuzz import fizzbuzz


def test_numero_comum_vira_texto():
    assert fizzbuzz(1) == "1"
    assert fizzbuzz(2) == "2"
`,
      solutionImpl: 'def fizzbuzz(n):\n    return str(n)\n',
      solutionExplanation: 'O primeiro teste falha com **erro de import** — pela 2ª lei do TDD isso já conta como vermelho. A implementação mínima e geral é `str(n)`.',
    },
    {
      type: 'tdd',
      id: 'tst-tdd-kata2',
      kata: 'fizzbuzz',
      module: 'fizzbuzz',
      concept: 'Baby steps',
      title: 'Ciclo 2 — Fizz',
      say: 'Ciclo 2! Seu código do ciclo anterior continua aí. Adicione **um** teste novo para o Fizz.',
      prompt: '**Requisito:** múltiplos de **3** devolvem `"Fizz"`. Ex.: `fizzbuzz(3) == "Fizz"`, `fizzbuzz(9) == "Fizz"`. Os números comuns continuam funcionando.',
      testStarter: '',
      reference: `def fizzbuzz(n):
    if n % 3 == 0:
        return "Fizz"
    return str(n)
`,
      checks: [
        { name: 'fizzbuzz(3) == "Fizz"', expr: 'fizzbuzz(3)', expected: '"Fizz"' },
        { name: 'fizzbuzz(6) == "Fizz"', expr: 'fizzbuzz(6)', expected: '"Fizz"' },
        { name: 'fizzbuzz(99) == "Fizz"', expr: 'fizzbuzz(99)', expected: '"Fizz"' },
        { name: 'números comuns intactos', code: 'assert fizzbuzz(1) == "1" and fizzbuzz(4) == "4"' },
      ],
      hints: [
        'Novo teste: `def test_multiplo_de_3_vira_fizz(): assert fizzbuzz(3) == "Fizz"`.',
        'Na implementação, use o resto da divisão: `if n % 3 == 0: return "Fizz"`.',
      ],
      solutionTests: `from fizzbuzz import fizzbuzz


def test_numero_comum_vira_texto():
    assert fizzbuzz(1) == "1"
    assert fizzbuzz(2) == "2"


def test_multiplo_de_3_vira_fizz():
    assert fizzbuzz(3) == "Fizz"
    assert fizzbuzz(9) == "Fizz"
`,
      solutionImpl: `def fizzbuzz(n):
    if n % 3 == 0:
        return "Fizz"
    return str(n)
`,
      solutionExplanation: 'Um teste novo, um comportamento novo. Repare que o teste do ciclo 1 **continua** na suíte: ele protege contra regressões enquanto o código evolui.',
    },
    {
      type: 'tdd',
      id: 'tst-tdd-kata3',
      kata: 'fizzbuzz',
      module: 'fizzbuzz',
      concept: 'Refatoração',
      title: 'Ciclo 3 — Buzz e FizzBuzz',
      say: 'Último ciclo: Buzz e FizzBuzz. E dessa vez capriche no **refactor**!',
      prompt: '**Requisito:** múltiplos de **5** devolvem `"Buzz"`, e múltiplos de **3 e 5** devolvem `"FizzBuzz"`. Ex.: `fizzbuzz(5) == "Buzz"`, `fizzbuzz(15) == "FizzBuzz"`.',
      testStarter: '',
      reference: `def fizzbuzz(n):
    resultado = ""
    if n % 3 == 0:
        resultado += "Fizz"
    if n % 5 == 0:
        resultado += "Buzz"
    return resultado or str(n)
`,
      checks: [
        { name: 'fizzbuzz(5) == "Buzz"', expr: 'fizzbuzz(5)', expected: '"Buzz"' },
        { name: 'fizzbuzz(10) == "Buzz"', expr: 'fizzbuzz(10)', expected: '"Buzz"' },
        { name: 'fizzbuzz(15) == "FizzBuzz"', expr: 'fizzbuzz(15)', expected: '"FizzBuzz"' },
        { name: 'fizzbuzz(45) == "FizzBuzz"', expr: 'fizzbuzz(45)', expected: '"FizzBuzz"' },
        { name: 'Fizz e números comuns intactos', code: 'assert fizzbuzz(9) == "Fizz" and fizzbuzz(7) == "7"' },
      ],
      refactorTip: 'Tudo verde! Repare na **duplicação**: um `if` especial para 15 repete a lógica do 3 e do 5. Consegue montar o texto **concatenando** `"Fizz"` e `"Buzz"`? Rode os testes a cada mudança.',
      reviews: [
        {
          when: (m, code) => /%\s*15\b/.test(code) || /%\s*3\s*==\s*0\s+and\s+\w+\s*%\s*5/.test(code),
          text: 'Ficou um caso especial para múltiplos de 15 (`% 15` ou `% 3 == 0 and … % 5 == 0`), que duplica a regra do 3 e do 5. Concatenando `"Fizz"` + `"Buzz"` o caso combinado sai de graça.',
          concept: 'Refatoração: remover duplicação',
        },
      ],
      hints: [
        'Primeiro o teste: `assert fizzbuzz(5) == "Buzz"` e `assert fizzbuzz(15) == "FizzBuzz"`.',
        'Para passar rápido, a ordem dos `if` importa: o caso de 15 precisa vir antes do 3 e do 5.',
        'No refactor: comece com `resultado = ""`, some `"Fizz"` e `"Buzz"` e devolva `resultado or str(n)`.',
      ],
      solutionTests: `from fizzbuzz import fizzbuzz


def test_numero_comum_vira_texto():
    assert fizzbuzz(1) == "1"
    assert fizzbuzz(2) == "2"


def test_multiplo_de_3_vira_fizz():
    assert fizzbuzz(3) == "Fizz"
    assert fizzbuzz(9) == "Fizz"


def test_multiplo_de_5_vira_buzz():
    assert fizzbuzz(5) == "Buzz"


def test_multiplo_de_3_e_5_vira_fizzbuzz():
    assert fizzbuzz(15) == "FizzBuzz"
`,
      solutionImpl: `def fizzbuzz(n):
    resultado = ""
    if n % 3 == 0:
        resultado += "Fizz"
    if n % 5 == 0:
        resultado += "Buzz"
    return resultado or str(n)
`,
      solutionExplanation: 'No **green** é normal chegar num `if n % 15 == 0` (é o mínimo que passa). No **refactor**, a concatenação elimina a duplicação: o caso "FizzBuzz" deixa de ser especial. Os quatro testes garantiram que a refatoração não mudou nada.',
    },
    {
      type: 'open',
      id: 'tst-tdd-q3',
      concept: 'TDD',
      say: 'Para fechar, como numa entrevista: me convença sobre TDD — e mostre que conhece os limites.',
      prompt: 'Explique o ciclo do TDD e seus benefícios. Em que situações você **não** usaria TDD?',
      minWords: 20,
      rubric: [
        { label: 'Descreve o ciclo **red → green → refactor** (teste primeiro, falhando)', keywords: [['red', 'green'], ['vermelho', 'verde'], ['falh', 'primeiro'], ['teste', 'antes']], concept: 'Red-Green-Refactor' },
        { label: 'Cita a **refatoração com segurança** / rede de proteção', keywords: ['refator', 'seguranca', 'rede de protecao', 'regress'], concept: 'Refatoração' },
        { label: 'Cita efeito no **design** (código testável, desacoplado) ou documentação', keywords: ['design', 'desacopl', 'testavel', 'document', 'acoplamento'], concept: 'Design emergente' },
        { label: 'Aponta **limites**: protótipos, exploração, UI, spikes, requisitos incertos', keywords: ['prototip', 'explorat', 'spike', 'interface grafica', 'ui', 'incert', 'descart', 'poc'], concept: 'Limites do TDD', why: 'Mostrar quando não usar uma prática é sinal de senioridade.' },
      ],
      modelAnswer: `No TDD eu escrevo **um teste pequeno antes** do código e vejo ele **falhar** (red); depois escrevo o **mínimo** para ele passar (green) e então **refatoro** mantendo tudo verde. O ciclo dura minutos.

Benefícios: a suíte vira uma **rede de segurança** para refatorar e evita regressões; o **design** tende a sair mais desacoplado e testável, porque o código nasce sendo usado por um teste; e os testes documentam o comportamento esperado.

Eu **não** usaria TDD à risca em **protótipos/spikes** descartáveis, em exploração de uma API desconhecida ou quando os requisitos são muito incertos — ali eu exploro primeiro e escrevo testes depois de estabilizar. Também rende menos em código muito visual (UI), onde outros tipos de teste funcionam melhor.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Você praticou o ciclo completo: **teste falhando**, **mínimo para passar**, **refatorar no verde**.',
        'Lembre: ciclos curtos, um teste por vez — e o refactor faz parte do ciclo, não é "se sobrar tempo".',
      ],
      board: null,
    },
  ],
});
