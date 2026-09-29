(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const PARCELAMENTO = py(`
    def parcelar(total, parcelas):
        """Divide o valor de uma compra em parcelas iguais.

        Código de 2014, sem testes. Ninguém lembra das regras — só do que ele faz.
        """
        if parcelas < 1:
            raise ValueError("número de parcelas inválido")
        if parcelas > 12:
            parcelas = 12                          # teto silencioso: 18x vira 12x
        centavos = round(total * 100)
        valor = centavos // parcelas
        return [valor / 100] * parcelas            # os centavos que sobram somem
  `);

  const mutOf = base => (from, to) => {
    const code = base.replace(from, to);
    if (code === base) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };
  const mutP = mutOf(PARCELAMENTO);

  const BOLETO_LEGADO = py(`
    from datetime import datetime, timedelta


    def situacao_boleto(vencimento):
        hoje = datetime.now().date()
        prazo = vencimento
        while prazo.weekday() >= 5:            # vence no sábado/domingo? paga na segunda
            prazo = prazo + timedelta(days=1)
        if hoje <= prazo:
            return "em dia"
        dias = (hoje - prazo).days
        if dias > 59:
            return "protestado"
        return f"vencido há {dias} dia(s)"


    # TODO: introduza uma seam para o relógio — situacao_boleto(vencimento, relogio=datetime.now) —
    #       e extraia prazo_de_pagamento(vencimento), sem quebrar quem chama situacao_boleto(vencimento).
  `);

  Game.registerModule('clean-code', {
    id: 'codigo-legado',
    title: 'Domando código legado',
    kind: 'lesson',
    level: 3,
    order: 30,
    unit: 'legado',
    summary: 'Código legado é código sem testes. Aprenda o algoritmo de mudança de Michael Feathers: achar seams, quebrar dependências, fixar o comportamento com testes de caracterização e crescer o código novo com sprout e wrap.',
    concepts: ['Código legado', 'Seams', 'Testes de caracterização', 'Sprout e Wrap', 'Quebrar dependências'],
    takeaways: [
      'Para Michael Feathers, **código legado é código sem testes**: sem eles, você não sabe se a mudança preservou o comportamento — só torce (*edit and pray*).',
      'O dilema do legado: para mudar com segurança você precisa de testes; para pôr testes, precisa mudar o código. Saia dele com mudanças **mínimas e seguras** que criam *seams*.',
      'Uma **seam** é um lugar onde você altera o comportamento **sem editar ali**: um parâmetro com valor padrão, um objeto injetado, um módulo substituído no teste.',
      '**Testes de caracterização** documentam o que o código **faz**, não o que deveria fazer — inclusive os bugs. Corrigir um bug é outra mudança, consciente e com outro teste.',
      'Para adicionar comportamento sem mexer no emaranhado: ***sprout*** (código novo, testado, numa função/classe nova) e ***wrap*** (envolver o antigo e acrescentar antes/depois).',
    ],
    glossary: [
      { term: 'Código legado', aliases: ['legacy code', 'codigo legado', 'legado'], definition: 'Para Michael Feathers (*Working Effectively with Legacy Code*, 2004): **código sem testes**. A idade não importa — código escrito ontem sem testes já é legado, porque não dá para mudá-lo com segurança.' },
      { term: 'Seam', aliases: ['seams', 'costura', 'costuras', 'ponto de costura'], definition: 'Um lugar onde você pode alterar o comportamento do programa **sem editar naquele lugar** (Feathers). Todo seam tem um *enabling point*: onde se decide qual comportamento usar — por exemplo, o argumento passado a um parâmetro injetado.' },
      { term: 'Teste de caracterização', aliases: ['testes de caracterização', 'characterization test', 'characterization tests', 'teste de caracterizacao', 'testes de caracterizacao'], definition: 'Teste que fixa o comportamento **atual** do código, e não o desejado — inclusive bugs. Serve de rede de segurança antes de mudar código legado: qualquer mudança de comportamento, até uma "correção", faz ele falhar.' },
      { term: 'Sprout Method', aliases: ['sprout class', 'sprout', 'método broto', 'metodo broto'], definition: 'Técnica de Feathers para adicionar funcionalidade a código legado: escrever o código novo, com testes, numa **função (ou classe) nova** e só chamá-la do código antigo, mexendo nele o mínimo possível.' },
      { term: 'Wrap Method', aliases: ['wrap class', 'wrap', 'envolver método', 'envolver metodo'], definition: 'Técnica de Feathers: renomeie o método antigo e crie outro **com o nome original** que chama o antigo e acrescenta o comportamento novo antes ou depois. *Wrap Class* faz o mesmo com um objeto inteiro (é o padrão Decorator).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Todo dev já herdou aquele módulo que ninguém quer tocar. Hoje vamos aprender a domá-lo.',
          'Primeiro, uma definição que muda a forma de pensar: **código legado é código sem testes**.',
        ],
        board: {
          title: 'O que é código legado?',
          md: `> "Para mim, código legado é simplesmente **código sem testes**." — Michael Feathers, *Working Effectively with Legacy Code* (2004)

Não é sobre idade, linguagem antiga ou autor desconhecido. Código escrito **ontem** sem testes já é legado: ninguém consegue mudá-lo sabendo que o comportamento foi preservado.

| Estilo | Como é | Resultado |
|---|---|---|
| ***Edit and pray*** (edite e reze) | muda com cuidado, testa na mão, sobe e torce | medo de mexer, bugs em regiões "que nem foram tocadas" |
| ***Cover and modify*** (cubra e modifique) | primeiro cria uma rede de testes, depois muda | feedback em segundos, mudança com confiança |

**O dilema do código legado:**

\`\`\`text
 para mudar com segurança  ->  preciso de testes
 para escrever testes      ->  preciso mudar o código (ele depende de banco, relógio, rede...)
\`\`\`

A saída: fazer **mudanças mínimas e muito cuidadosas** — quase mecânicas, que dá para conferir no olho — só para abrir espaço para os testes. Depois, com a rede no lugar, refatorar à vontade.`,
        },
      },
      {
        type: 'say',
        text: [
          'Feathers propõe um roteiro de cinco passos para cada mudança em código legado.',
          'Repare que a mudança que você queria fazer é só o **último** passo.',
        ],
        board: {
          title: 'O algoritmo de mudança em código legado',
          md: `\`\`\`text
 1. identificar os pontos de mudança     onde o código precisa mudar?
 2. encontrar os pontos de teste         onde dá para observar o efeito?
 3. quebrar dependências                 abrir seams para o teste controlar banco, relógio, IO
 4. escrever testes                      caracterização: fixar o comportamento atual
 5. mudar e refatorar                    agora sim, com a rede de segurança
\`\`\`

- **Passo 2** costuma ser o mais difícil: o efeito de uma função pode aparecer longe dela (numa tabela, num e-mail, num arquivo). Feathers chama de *pinch point* um ponto estreito por onde passam muitos efeitos — ótimo lugar para um teste.
- **Passo 3** é feito **sem testes** ainda, então use refatorações minúsculas e automáticas (renomear, extrair, adicionar parâmetro com valor padrão).
- **Passo 5** segue os dois chapéus: primeiro a mudança pedida, depois a limpeza — ou o contrário —, nunca juntas.

> [!dica] **Refatoração de rascunho** (*scratch refactoring*): para **entender** um código assustador, refatore sem medo numa branch descartável — extraia, renomeie, apague. Depois **jogue tudo fora**. O objetivo era aprender, e o entendimento fica com você.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'O conceito central do livro tem um nome curioso: ***seam***, a "costura".',
          'Pouca gente conhece o termo, mas todo mundo que testa código já usou uma.',
        ],
        board: {
          title: 'Seams: mudar o comportamento sem editar ali',
          md: `> [!sabia] Uma ***seam*** (costura) é *"um lugar onde você pode alterar o comportamento do seu programa sem editar naquele lugar"* (Feathers). A imagem vem da costura de roupas: o ponto onde dois pedaços se juntam — e onde dá para separá-los. Cada seam tem um ***enabling point***: o lugar onde se escolhe qual comportamento usar.

\`\`\`python
# SEM seam: o teste não controla a hora
def eh_horario_comercial():
    return 9 <= datetime.now().hour < 18

# SEAM de objeto/parâmetro: o enabling point é o argumento
def eh_horario_comercial(relogio=datetime.now):
    return 9 <= relogio().hour < 18

eh_horario_comercial()                                   # produção: nada muda
eh_horario_comercial(relogio=lambda: datetime(2024, 3, 11, 20))   # teste: 20h
\`\`\`

| Tipo de seam | Em Python | Enabling point |
|---|---|---|
| **de objeto** | objeto/função recebido por parâmetro ou construtor | quem chama (o teste passa um dublê) |
| **de link / módulo** | trocar um nome importado: \`monkeypatch.setattr(modulo, "enviar", falso)\` | a configuração do teste |
| **de pré-processamento** | (C/C++: \`#define\`) — em Python, quase não existe | o build |

> [!atencao] Prefira a seam **de objeto**: ela deixa a dependência **explícita** na assinatura. O \`monkeypatch\` é útil para o primeiro teste num código que não dá para mudar ainda, mas testa por baixo do pano e quebra quando alguém muda um \`import\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Com a seam no lugar, dá para escrever o primeiro teste. Mas testar **o quê**, se ninguém sabe a regra?',
          'Resposta: teste o que o código **faz hoje**. Isso é um **teste de caracterização**.',
        ],
        board: {
          title: 'Testes de caracterização',
          md: `Um teste de caracterização **descreve o comportamento atual** — não o desejado. Receita de Feathers:

1. chame o código num teste;
2. escreva uma asserção que você **sabe** que vai falhar;
3. deixe a falha **contar** o valor real;
4. troque o esperado pelo valor real. Repita com outras entradas (limites, vazios, valores estranhos).

\`\`\`python
def test_caracteriza_parcelamento():
    assert parcelar(100, 3) == []
# AssertionError: assert [33.33, 33.33, 33.33] == []   <- o código contou a verdade

def test_caracteriza_parcelamento():
    # BUG CONHECIDO: o centavo que sobra some (3 x 33,33 = 99,99). Ver issue #812.
    assert parcelar(100, 3) == [33.33, 33.33, 33.33]
\`\`\`

**E quando o comportamento atual é um bug?** Fixe-o mesmo assim — e deixe isso **explícito** no nome ou num comentário. Alguém (um relatório, uma conciliação, outro sistema) pode depender dele. Corrigir é uma **decisão** separada: um PR próprio que muda o teste de propósito, e não um efeito colateral da refatoração.

> [!dica] Para saídas grandes (relatórios, HTML, JSON), a versão "em massa" do teste de caracterização é o *golden master*: grave a saída atual para muitas entradas e compare tudo depois de cada mudança.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando você precisa **adicionar** algo num método de 300 linhas que nem cabe num teste?',
          'Não force o monstro para dentro do teste. Faça o código novo **crescer ao lado**.',
        ],
        board: {
          title: 'Sprout e Wrap: código novo, testado, ao lado do antigo',
          md: `**Sprout Method** (broto): a lógica nova nasce numa função nova, com testes; o legado só ganha **uma linha**.

\`\`\`python
def processar_lote(pedidos, db):          # 300 linhas, sem testes...
    ...
    novos = filtrar_nao_duplicados(pedidos, ja_processados=db.ids_processados())   # <- única linha nova
    for pedido in novos:
        ...

def filtrar_nao_duplicados(pedidos, ja_processados):   # novo, puro, 100% testado
    return [p for p in pedidos if p.id not in ja_processados]
\`\`\`

**Sprout Class**: igual, mas numa classe nova — útil quando a classe legada nem consegue ser instanciada num teste.

**Wrap Method** (envolver): o comportamento novo acontece **antes ou depois** do antigo. Renomeie o antigo e crie um novo, com o nome original, que chama os dois.

\`\`\`python
def pagar(self, fatura):                   # o nome antigo agora é o "envelope"
    self._pagar_sem_auditoria(fatura)      # o código antigo, intocado
    self.auditoria.registrar("pagamento", fatura.id)

def _pagar_sem_auditoria(self, fatura):
    ...                                    # as 200 linhas de antes
\`\`\`

**Wrap Class**: envolver o objeto inteiro numa classe com a mesma interface (é o padrão **Decorator**).

| Técnica | Quando |
|---|---|
| Sprout Method / Class | a lógica nova é um **cálculo ou decisão** que dá para isolar |
| Wrap Method / Class | a lógica nova é **independente** e roda antes/depois (log, auditoria, métricas, cache) |

> [!atencao] Sprout e wrap não **limpam** o legado — só evitam piorá-lo e garantem que o código **novo** nasce testado. A limpeza do resto vem aos poucos, com testes de caracterização.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, o passo 3 do algoritmo: **quebrar dependências**. Os vilões de sempre são o relógio, o IO e o banco.',
          'Em Python, a ferramenta mais simples é um parâmetro com valor padrão.',
        ],
        board: {
          title: 'Quebrando dependências: relógio, IO e companhia',
          md: `\`\`\`python
# ANTES: depende de relógio, disco e aleatoriedade escondidos
def gerar_cupom():
    semente = random.randint(1000, 9999)
    with open("/var/log/cupons.txt", "a") as log:
        log.write(f"{datetime.now():%Y-%m-%d} {semente}\\n")
    return f"CUPOM-{semente}"

# DEPOIS: três seams, e quem chama gerar_cupom() nem percebe
def gerar_cupom(relogio=datetime.now, rng=random, saida=None):
    semente = rng.randint(1000, 9999)
    linha = f"{relogio():%Y-%m-%d} {semente}\\n"
    if saida is None:
        with open("/var/log/cupons.txt", "a") as log:
            log.write(linha)
    else:
        saida.write(linha)                 # no teste: io.StringIO()
    return f"CUPOM-{semente}"
\`\`\`

Técnicas do catálogo de Feathers, em versão Python:

| Técnica | Ideia | Em Python |
|---|---|---|
| **Parameterize Method** | a dependência vira parâmetro | \`relogio=datetime.now\` |
| **Parameterize Constructor** | o objeto recebe o colaborador | \`__init__(self, gateway=None)\` |
| **Extract Interface** | dependa de um contrato, não da classe concreta | \`typing.Protocol\` |
| **Subclass and Override Method** | no teste, uma subclasse troca só o método problemático | \`class PedidoTestavel(Pedido)\` |

> [!atencao] Cuidado com a armadilha clássica: \`def f(hoje=date.today())\` avalia \`date.today()\` **uma única vez**, quando o módulo é carregado. Um servidor que roda há três dias vai achar que ainda é o dia em que subiu. Passe a **função** (\`relogio=datetime.now\`), e não o **resultado** dela.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Caracterizar, abrir seams e escolher entre sprout e wrap.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'cc-leg-q1',
        concept: 'Código legado',
        say: 'Primeiro, a definição que abre o livro de Feathers.',
        prompt: 'Seu time diz: "o módulo de faturamento **não é legado** — foi escrito no ano passado, em Python 3.12, com type hints". Ele não tem nenhum teste automatizado. Pela definição de **Michael Feathers**, ele é legado?',
        options: [
          { text: 'Sim: código legado é código sem testes. Sem eles, ninguém consegue mudar o módulo sabendo que o comportamento foi preservado.', correct: true, why: 'É a definição de Feathers. O critério é a capacidade de mudar com segurança, e isso depende de testes, não da idade.' },
          { text: 'Não: legado é código antigo, em versões ou linguagens obsoletas.', why: 'Essa é a definição popular, mas não a de Feathers. Um sistema de 1998 com uma boa suíte de testes é mais fácil de mudar do que um módulo novo sem nenhum.' },
          { text: 'Não: legado é código escrito por pessoas que já saíram da empresa.', why: 'A perda de conhecimento piora a situação, mas não é a definição. O próprio autor, seis meses depois, também muda o código "rezando" se não houver testes.' },
          { text: 'Sim, porque type hints não garantem a qualidade do código.', why: 'A conclusão está certa, mas pelo motivo errado. Type hints ajudam; o que falta para mudar com segurança são testes que verifiquem o **comportamento**.' },
        ],
        explanation: 'A definição de Feathers é provocadora de propósito: ela troca uma característica que você não controla (a idade) por uma que você controla (a existência de testes). Com testes, você trabalha em *cover and modify*: muda, roda a suíte e sabe em segundos se algo quebrou. Sem eles, é *edit and pray*. E o dilema aparece logo: para pôr testes, muitas vezes é preciso mudar o código — por isso as primeiras mudanças devem ser mínimas e mecânicas, só para abrir *seams*.',
      },
      {
        type: 'order',
        id: 'cc-leg-q2',
        concept: 'Algoritmo de mudança em código legado',
        say: 'Agora a ordem do roteiro de Feathers. A mudança que você queria vem em qual passo?',
        prompt: 'Ordene os passos do **algoritmo de mudança em código legado** de Michael Feathers.',
        items: [
          'Identificar os pontos de mudança',
          'Encontrar os pontos de teste (onde dá para observar o efeito)',
          'Quebrar dependências (abrir seams)',
          'Escrever testes de caracterização',
          'Fazer a mudança e refatorar',
        ],
        explanation: 'A mudança pedida é só o **último** passo. Antes, você descobre **onde** mudar e **onde** observar o efeito (os pontos de teste); depois quebra as dependências que impedem o teste — com refatorações mínimas, porque ainda não há rede de segurança —; e então fixa o comportamento atual com testes de caracterização. Só com essa rede no lugar a mudança e a limpeza ficam seguras.',
      },
      {
        type: 'match',
        id: 'cc-leg-q3',
        concept: 'Sprout e Wrap',
        say: 'Hora de montar sua caixa de ferramentas: qual técnica para cada situação?',
        prompt: 'Associe cada **situação** à **técnica** de código legado mais indicada.',
        pairs: [
          { left: 'Uma regra de cálculo nova, que dá para isolar numa função pura e testar sozinha', right: 'Sprout Method' },
          { left: 'A lógica nova é grande, e a classe legada nem consegue ser instanciada num teste', right: 'Sprout Class' },
          { left: 'Registrar auditoria depois de cada `pagar()`, sem tocar nas 200 linhas do método', right: 'Wrap Method' },
          { left: 'Adicionar cache a um objeto inteiro, mantendo a mesma interface (padrão Decorator)', right: 'Wrap Class' },
          { left: 'Antes de mexer, fixar o que a função faz hoje, inclusive o bug conhecido', right: 'Teste de caracterização' },
          { left: 'Receber o relógio por parâmetro para o teste controlar a hora', right: 'Seam de objeto (Parameterize Method)' },
        ],
        explanation: 'Sprout e wrap resolvem o mesmo problema — adicionar comportamento sem precisar colocar o monstro inteiro sob teste — de jeitos diferentes: o **sprout** faz o código novo nascer ao lado, e o legado só ganha uma chamada; o **wrap** envolve o código antigo e acrescenta algo antes ou depois. Os testes de caracterização e as seams são o que permite, com o tempo, limpar o próprio legado.',
      },
      {
        type: 'pytest',
        id: 'cc-leg-q4',
        concept: 'Testes de caracterização',
        title: 'Caracterizando o parcelamento',
        module: 'parcelamento',
        points: 50,
        say: 'Desafio de caracterização! Aqui a regra é fixar o que o código **faz** — até o bug.',
        prompt: `A função \`parcelar\` (arquivo \`parcelamento.py\`) é de 2014 e não tem testes. O time vai refatorá-la e precisa de uma **rede de segurança**.

Escreva **testes de caracterização**: eles devem fixar o comportamento **atual**, e não o "correto". Qualquer mudança de comportamento — até uma correção bem-intencionada — deve fazer algum teste falhar.

Investigue (rode o código mentalmente ou use a receita "assert que falha"):
- uma divisão **não exata** (o que acontece com o centavo que sobra?);
- **mais de 12** parcelas;
- **zero** parcelas;
- um valor à vista "quebrado", como **19,99**.

Deixe claro, com um comentário ou no nome do teste, qual comportamento é um **bug conhecido**. Pelo menos **4 testes**.`,
        implementation: PARCELAMENTO,
        starter: py(`
          import pytest
          from parcelamento import parcelar


          def test_divisao_exata():
              assert parcelar(90, 3) == [30.0, 30.0, 30.0]
        `),
        minTests: 4,
        mutants: [
          {
            name: 'correção bem-intencionada: o centavo que sobra vai para a última parcela',
            code: mutP('    valor = centavos // parcelas\n    return [valor / 100] * parcelas            # os centavos que sobram somem',
              '    valor, resto = divmod(centavos, parcelas)\n    return [valor / 100] * (parcelas - 1) + [(valor + resto) / 100]'),
            why: 'faltou fixar o **bug** atual: `parcelar(100, 3)` devolve `[33.33, 33.33, 33.33]`. Um teste de caracterização pega até correções — corrigir precisa ser uma decisão explícita, não um efeito colateral.',
            concept: 'Testes de caracterização',
          },
          {
            name: 'teto de 12 parcelas removido',
            code: mutP('    if parcelas > 12:\n        parcelas = 12                          # teto silencioso: 18x vira 12x\n', ''),
            why: 'faltou caracterizar o que acontece com **mais de 12** parcelas: hoje, 18x vira 12x em silêncio.',
            concept: 'Testes de caracterização',
          },
          {
            name: 'teto "corrigido" para lançar erro',
            code: mutP('        parcelas = 12                          # teto silencioso: 18x vira 12x', '        raise ValueError("máximo de 12 parcelas")'),
            why: 'o comportamento estranho (reduzir para 12 em silêncio) também precisa ser fixado: alguma tela pode depender dele.',
            concept: 'Testes de caracterização',
          },
          {
            name: 'zero parcelas vira pagamento à vista',
            code: mutP('        raise ValueError("número de parcelas inválido")', '        parcelas = 1'),
            why: 'faltou um `pytest.raises(ValueError)` para `parcelar(..., 0)`.',
            concept: 'pytest.raises',
          },
          {
            name: 'round trocado por int (trunca os centavos)',
            code: mutP('centavos = round(total * 100)', 'centavos = int(total * 100)'),
            why: 'faltou um valor "quebrado": `19.99 * 100` é `1998.9999999999998` em ponto flutuante, e `int()` transforma isso em 19,98. Caracterize com valores reais, não só com números redondos.',
            concept: 'Valores-limite',
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('raises'),
            text: 'Nenhum `pytest.raises`: o caminho de erro (zero parcelas) também é comportamento e precisa ser caracterizado.',
            concept: 'pytest.raises',
          },
          {
            when: (m, code) => !/bug|conhecid|atual|hoje|estranh|sobra|perde|some/i.test(code),
            text: 'Deixe **explícito** que um dos testes fixa um bug (no nome, como `test_bug_conhecido_centavo_some`, ou num comentário com o link da issue). Sem isso, o próximo dev vai achar que 99,99 é a regra de negócio.',
            concept: 'Testes de caracterização',
          },
        ],
        hints: [
          'Use a receita de Feathers: escreva `assert parcelar(100, 3) == []`, rode e veja o valor real na mensagem de erro. Esse valor (com o centavo sumido) é o que o teste deve fixar.',
          'Para o teto: `parcelar(120, 18)` devolve **12** parcelas de 10,0. Para zero parcelas: `with pytest.raises(ValueError): parcelar(100, 0)`.',
          'Por fim, um valor à vista com centavos: `parcelar(19.99, 1) == [19.99]` — ele protege a conversão para centavos contra truncamentos.',
        ],
        solution: py(`
          import pytest
          from parcelamento import parcelar


          def test_divisao_exata():
              assert parcelar(90, 3) == [30.0, 30.0, 30.0]


          def test_bug_conhecido_centavo_que_sobra_some():
              # BUG CONHECIDO: 3 x 33,33 = 99,99 — o centavo some. Este teste fixa o
              # comportamento ATUAL; corrigir é outra mudança, com outro teste.
              assert parcelar(100, 3) == [33.33, 33.33, 33.33]


          def test_a_vista_com_centavos():
              assert parcelar(19.99, 1) == [19.99]


          def test_mais_de_12_parcelas_vira_12_em_silencio():
              assert parcelar(120, 18) == [10.0] * 12


          def test_zero_parcelas_lanca_erro():
              with pytest.raises(ValueError):
                  parcelar(100, 0)
        `),
        solutionExplanation: 'Cada teste fixa um aspecto do comportamento **atual**: a divisão exata, o centavo que some (o bug, com um nome que diz isso), o teto silencioso de 12 parcelas, o erro para zero parcelas e a conversão para centavos com um valor quebrado. Repare no mutante mais importante: a "correção" que joga o centavo na última parcela. Para um teste comum, ela seria bem-vinda; para um teste de caracterização, é uma **mudança de comportamento** — e precisa falhar. Se o time decidir corrigir o bug, faz isso num PR próprio, atualizando esse teste de propósito (e avisando quem consome o parcelamento).',
      },
      {
        type: 'code',
        id: 'cc-leg-q5',
        concept: 'Seams',
        title: 'Uma seam para o relógio',
        points: 50,
        say: 'Agora é a sua vez de abrir uma seam! Esta função chama `datetime.now()` lá dentro — e o teste não consegue controlar a hora.',
        prompt: `\`situacao_boleto(vencimento)\` diz se um boleto está em dia, vencido ou protestado. Ela funciona, mas lê a hora com \`datetime.now()\` **direto**: não dá para testar "vencido há 3 dias" sem esperar três dias.

Quebre a dependência **sem quebrar quem já chama a função**:

1. **Seam** — nova assinatura \`situacao_boleto(vencimento, relogio=datetime.now)\`: \`relogio\` é uma **função** que devolve um \`datetime\`. Quem chama \`situacao_boleto(vencimento)\` continua usando a hora real.
2. **Extract Function** — \`prazo_de_pagamento(vencimento)\`: se o vencimento cai no sábado ou no domingo, o prazo vai para a segunda-feira; senão, é o próprio vencimento.
3. Mesmas regras de hoje: em dia até o prazo (inclusive); vencido há N dia(s) até 59 dias; depois disso, \`"protestado"\`.`,
        starter: BOLETO_LEGADO,
        tests: [
          { name: 'em dia no próprio vencimento (terça, 23h59)', code: py(`
            from datetime import date, datetime
            assert situacao_boleto(date(2024, 3, 12), relogio=lambda: datetime(2024, 3, 12, 23, 59)) == "em dia"
          `) },
          { name: 'vencido há 3 dias', code: py(`
            from datetime import date, datetime
            obtido = situacao_boleto(date(2024, 3, 12), relogio=lambda: datetime(2024, 3, 15, 10, 0))
            assert obtido == "vencido há 3 dia(s)", obtido
          `) },
          { name: 'vence no sábado: pode pagar na segunda', code: py(`
            from datetime import date, datetime
            sabado = date(2024, 3, 9)
            assert situacao_boleto(sabado, relogio=lambda: datetime(2024, 3, 11, 9, 0)) == "em dia"
            obtido = situacao_boleto(sabado, relogio=lambda: datetime(2024, 3, 12, 9, 0))
            assert obtido == "vencido há 1 dia(s)", obtido
          `) },
          { name: 'prazo_de_pagamento', code: py(`
            from datetime import date
            assert prazo_de_pagamento(date(2024, 3, 9)) == date(2024, 3, 11)     # sábado -> segunda
            assert prazo_de_pagamento(date(2024, 3, 10)) == date(2024, 3, 11)    # domingo -> segunda
            assert prazo_de_pagamento(date(2024, 3, 12)) == date(2024, 3, 12)    # terça: não muda
          `) },
          {
            name: 'protestado depois de 59 dias',
            hidden: true,
            code: py(`
              from datetime import date, datetime, timedelta
              venc = date(2024, 1, 2)
              em = lambda d: (lambda: datetime.combine(venc + timedelta(days=d), datetime.min.time()))
              assert situacao_boleto(venc, relogio=em(59)) == "vencido há 59 dia(s)"
              assert situacao_boleto(venc, relogio=em(60)) == "protestado"
            `),
          },
          {
            name: 'a virada da meia-noite',
            hidden: true,
            code: py(`
              from datetime import date, datetime
              venc = date(2024, 3, 12)
              assert situacao_boleto(venc, relogio=lambda: datetime(2024, 3, 12, 23, 59, 59)) == "em dia"
              assert situacao_boleto(venc, relogio=lambda: datetime(2024, 3, 13, 0, 0, 0)) == "vencido há 1 dia(s)"
            `),
          },
          {
            name: 'quem chama sem relógio continua funcionando (compatibilidade)',
            hidden: true,
            code: py(`
              from datetime import date, timedelta
              assert situacao_boleto(date.today() + timedelta(days=30)) == "em dia"
              assert situacao_boleto(date(2000, 1, 3)) == "protestado"
            `),
          },
          {
            name: 'o relógio é consultado a cada chamada',
            hidden: true,
            code: py(`
              from datetime import date, datetime
              horas = iter([datetime(2024, 3, 12, 8, 0), datetime(2024, 3, 20, 8, 0)])
              relogio = lambda: next(horas)
              venc = date(2024, 3, 12)
              assert situacao_boleto(venc, relogio=relogio) == "em dia"
              assert situacao_boleto(venc, relogio=relogio) == "vencido há 8 dia(s)"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('now') || m.calls.includes('today'),
            text: 'O código ainda **chama** `datetime.now()`/`date.today()`. Na seam, passe a **função** como valor padrão (`relogio=datetime.now`) e chame `relogio()` lá dentro. Se o default for `datetime.now()`, com parênteses, ele é avaliado uma única vez, quando o módulo carrega.',
            concept: 'Seams',
          },
          {
            when: m => m.usesGlobal,
            text: 'Trocar o relógio com `global` é uma seam escondida: o teste mexe num estado compartilhado e esquece de desfazer. Deixe a dependência **explícita** na assinatura.',
            concept: 'Quebrar dependências',
          },
          {
            when: m => m.funcs.some(f => f.name === 'situacao_boleto' && f.complexity >= 4),
            text: '`situacao_boleto` ainda calcula o prazo lá dentro. Extraia `prazo_de_pagamento` e chame-a: a regra do fim de semana vira uma função pura, testável sem relógio nenhum.',
            concept: 'Extract Function',
          },
        ],
        hints: [
          'Comece pela seam: `def situacao_boleto(vencimento, relogio=datetime.now):` e troque `datetime.now()` por `relogio()`. Repare: `datetime.now` **sem** parênteses — o valor padrão é a função, não o horário.',
          'Extraia `prazo_de_pagamento(vencimento)` com o `while` do fim de semana (`weekday()` 5 é sábado e 6 é domingo) e devolva o prazo. Em `situacao_boleto`, use `prazo = prazo_de_pagamento(vencimento)`.',
          'Nos testes, o relógio é uma função sem argumentos: `relogio=lambda: datetime(2024, 3, 15, 10, 0)`. A função faz `hoje = relogio().date()` e o resto continua igual.',
        ],
        solution: py(`
          from datetime import datetime, timedelta

          SABADO = 5                    # weekday(): 5 = sábado, 6 = domingo
          DIAS_ATE_PROTESTO = 59


          def prazo_de_pagamento(vencimento):
              """Vencimento no fim de semana pode ser pago no próximo dia útil."""
              prazo = vencimento
              while prazo.weekday() >= SABADO:
                  prazo += timedelta(days=1)
              return prazo


          def situacao_boleto(vencimento, relogio=datetime.now):
              hoje = relogio().date()
              prazo = prazo_de_pagamento(vencimento)
              if hoje <= prazo:
                  return "em dia"
              dias = (hoje - prazo).days
              if dias > DIAS_ATE_PROTESTO:
                  return "protestado"
              return f"vencido há {dias} dia(s)"
        `),
        solutionExplanation: 'O parâmetro `relogio=datetime.now` é uma **seam de objeto**: o comportamento (que horas são) muda sem editar a função, e o *enabling point* é o argumento que quem chama passa. Em produção nada muda — o valor padrão é a própria `datetime.now`, chamada a **cada** execução (por isso sem parênteses no default). No teste, uma `lambda` devolve o instante que você quiser, inclusive a virada da meia-noite e o 60º dia. A regra do fim de semana saiu para `prazo_de_pagamento`, uma função pura, testável sem relógio nenhum. Foi uma mudança mínima e quase mecânica, exatamente o tipo que Feathers recomenda para abrir espaço para os primeiros testes.',
      },
      {
        type: 'open',
        id: 'cc-leg-q6',
        concept: 'Sprout e Wrap',
        say: 'Para fechar, uma situação de sexta-feira à tarde.',
        prompt: 'Você precisa adicionar um **log de auditoria** a cada chamada de `processar_pagamento`, um método de **400 linhas**, sem testes, que fala direto com o banco e com o gateway. O prazo é amanhã. Como você faria essa mudança com segurança, sem reescrever tudo?',
        minWords: 35,
        rubric: [
          { label: 'Usa **wrap** (ou sprout): o código novo fica ao lado, sem mexer nas 400 linhas', keywords: ['wrap', 'envolv', 'sprout', 'broto', 'decorator', 'decorador', 'metodo novo', 'funcao nova', 'classe nova', 'renomear o metodo', 'renomeio', 'ao lado'], concept: 'Wrap Method', why: 'O log de auditoria é independente e roda antes/depois: é o caso clássico de Wrap Method — o legado continua intocado.' },
          { label: 'O código **novo** nasce testado (TDD / teste isolado)', keywords: ['test', 'tdd', 'isolad', 'unitari'], concept: 'Sprout Method', why: 'A vantagem de sprout/wrap é que a parte nova pode ser testada sozinha, mesmo que o legado não possa.' },
          { label: 'Quebra dependências com **seams** (injetar logger/auditoria, dublês)', keywords: ['seam', 'costura', 'injet', 'depend', 'fake', 'falso', 'dubl', 'mock', 'stub', 'parametr', 'por parametro'], concept: 'Seams', why: 'Receber o registrador de auditoria por parâmetro/construtor permite verificar, no teste, que ele foi chamado, sem banco nem gateway reais.' },
          { label: 'Evita reescrever/refatorar tudo agora; planeja **caracterização** e limpeza em passos pequenos', keywords: ['caracteriza', 'golden master', 'comportamento atual', 'rede de seguranca', 'passos pequenos', 'aos poucos', 'depois', 'nao reescrev', 'sem reescrever', 'nao refator', 'escoteiro', 'minim'], concept: 'Testes de caracterização', why: 'Com prazo curto, a mudança deve ser mínima. A limpeza do método de 400 linhas vem depois, protegida por testes de caracterização.' },
        ],
        modelAnswer: `Eu não tocaria nas 400 linhas. Usaria **Wrap Method**: renomeio \`processar_pagamento\` para \`_processar_pagamento_sem_auditoria\` e crio um método **novo** com o nome original, que chama o antigo e depois registra a auditoria. Quem chama nem percebe a diferença.

O registrador de auditoria entra como uma **seam**: é **injetado** pelo construtor (ou por parâmetro com valor padrão), então no teste eu passo um dublê falso e verifico que ele foi chamado com os dados certos — sem banco nem gateway. Assim o código **novo** nasce testado, mesmo que o legado não tenha testes.

Não reescreveria nem refatoraria o método agora: com prazo curto, a mudança deve ser **mínima**. Depois, com calma, eu criaria **testes de caracterização** (talvez um *golden master* das chamadas ao gateway) e limparia o método **aos poucos**, em passos pequenos.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Parabéns! Agora você tem um método para encarar código legado: seams, caracterização, sprout e wrap.',
          'Na próxima etapa, a prova de fogo: uma **entrevista de code review ao vivo**.',
        ],
        board: null,
      },
    ],
  });
})();
