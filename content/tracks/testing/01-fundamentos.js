(function () {
  const FRETE = `def calcular_frete(valor_compra, peso_kg):
    """Calcula o frete de um pedido.

    - Compras de R$ 200 ou mais têm frete grátis.
    - Até 5 kg (inclusive), o frete custa R$ 15.
    - Acima de 5 kg: R$ 15 + R$ 2 por kg excedente.
    """
    if valor_compra >= 200:
        return 0
    if peso_kg <= 5:
        return 15
    return 15 + (peso_kg - 5) * 2
`;

  /** Cria um mutante trocando um trecho do código correto. */
  const mut = (from, to) => {
    const code = FRETE.replace(from, to);
    if (code === FRETE) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };

  Game.registerModule('testing', {
    id: 'fundamentos',
    title: 'Fundamentos de testes com pytest',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'fundamentos',
    summary: 'Por que testar, a pirâmide de testes, Arrange-Act-Assert e o básico do pytest.',
    concepts: ['Pirâmide de testes', 'Arrange-Act-Assert', 'pytest', 'Valores-limite'],
    takeaways: [
      'Testes automatizados dão **confiança para mudar**: evitam regressões, documentam o comportamento e dão feedback em segundos.',
      'A **pirâmide de testes**: muitos testes de unidade (rápidos e precisos), alguns de integração e poucos ponta a ponta.',
      'Todo teste segue **Arrange-Act-Assert** e verifica **um** comportamento — com um nome que diz qual.',
      'O pytest coleta funções `test_*` em arquivos `test_*.py`; um teste **sem `assert`** passa sempre, mesmo com o código errado.',
      'Bugs moram nos **limites**: teste o valor exato da fronteira e um passo antes dele — e um representante de cada **partição**.',
    ],
    glossary: [
      { term: 'Pirâmide de testes', aliases: ['pirâmide de teste', 'test pyramid'], definition: 'Modelo, popularizado por Mike Cohn, que distribui a suíte pelo custo: muitos testes de **unidade** na base, alguns de **integração** no meio e poucos **ponta a ponta** no topo.' },
      { term: 'Arrange-Act-Assert', aliases: ['AAA', 'Arrange Act Assert', 'Given-When-Then'], definition: 'Estrutura de um teste em três blocos: **preparar** os dados, **executar** o comportamento e **verificar** o resultado. O *Given-When-Then*, do BDD, é a mesma ideia com outros nomes.' },
      { term: 'Análise de valor-limite', aliases: ['valor-limite', 'valores-limite', 'valor limite', 'valores limite', 'boundary value analysis'], definition: 'Técnica que concentra os testes nas **fronteiras** das regras: o valor exato do limite e um passo antes/depois dele (ex.: R$ 200 e R$ 199,99). É onde aparecem os `>` no lugar de `>=`.' },
      { term: 'Partição de equivalência', aliases: ['partições de equivalência', 'classe de equivalência', 'classes de equivalência', 'equivalence partitioning'], definition: 'Técnica que divide as entradas em grupos que o código trata do mesmo jeito (ex.: pedido leve × pesado) e testa **um representante** de cada grupo, em vez de vários exemplos redundantes.' },
      { term: 'Regra Beyoncé', aliases: ['Beyoncé Rule', 'regra da Beyoncé'], definition: '"*If you liked it, then you shoulda put a test on it*": regra do Google segundo a qual, se uma mudança de infraestrutura quebra algo que nenhum teste cobria, a culpa não é de quem fez a mudança. Quer garantia? Escreva o teste.' },
      { term: 'Paradoxo do pesticida', aliases: ['pesticide paradox'], definition: 'Observação de Boris Beizer: os mesmos testes, repetidos para sempre, deixam de achar bugs novos — como pragas que ficam imunes ao pesticida. A suíte precisa evoluir junto com o código.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Vamos começar pelo começo: **por que** escrever testes automatizados?',
          'Não é burocracia. Testes te dão **confiança para mudar** o código: você refatora, adiciona uma feature, e em segundos sabe se quebrou algo.',
        ],
        board: {
          title: 'Por que testar?',
          md: `- 🛡️ **Evitar regressões** — um bug corrigido não volta sem ninguém perceber.
- 🔧 **Confiança para refatorar** — mudar a estrutura sem medo.
- 📖 **Documentação viva** — o teste mostra, com exemplos, como o código deve se comportar.
- ⚡ **Feedback rápido** — descobrir o erro em segundos, não em produção.
- 🧩 **Design melhor** — código difícil de testar costuma estar acoplado demais.

> [!dica] Em entrevistas, "como você testaria isso?" aparece quase sempre. Ter um vocabulário claro sobre testes conta muito.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Nem todo teste é igual. A **pirâmide de testes** organiza os tipos pelo custo e pela velocidade.',
          'Na base, muitos **testes de unidade**: rápidos e baratos. No meio, **integração**. No topo, poucos testes **ponta a ponta**, lentos e frágeis, mas que dão a confiança de que o sistema todo funciona.',
        ],
        board: {
          title: 'A pirâmide de testes',
          md: `\`\`\`text
                 ▲
                ╱ ╲        E2E / UI          poucos · lentos · caros · frágeis
               ╱───╲
              ╱     ╲      Integração        banco, APIs, filas de verdade
             ╱───────╲
            ╱         ╲    Unidade           muitos · rápidos (ms) · baratos
           ╱───────────╲
\`\`\`

| Tipo | Testa | Velocidade | Quando quebra, diz… |
|---|---|---|---|
| **Unidade** | uma função/classe isolada | milissegundos | exatamente onde está o erro |
| **Integração** | peças juntas (ex.: código + banco) | segundos | que a conversa entre partes falhou |
| **E2E** | o sistema como o usuário usa | minutos | que *algo* está errado |`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora a anatomia de um bom teste: o padrão **Arrange-Act-Assert** — preparar, agir, verificar.',
          'Cada teste verifica **um comportamento**, e o nome diz qual. Quando ele falhar, o nome já conta o que quebrou.',
        ],
        board: {
          title: 'Arrange · Act · Assert',
          code: `# carrinho.py
def total(itens, cupom=None):
    soma = sum(preco * qtd for preco, qtd in itens)
    if cupom == "DEZ":
        soma *= 0.9
    return round(soma, 2)


# test_carrinho.py
from carrinho import total


def test_total_soma_preco_vezes_quantidade():
    # Arrange — prepara os dados
    itens = [(10.0, 2), (5.0, 1)]

    # Act — executa o comportamento
    resultado = total(itens)

    # Assert — verifica o resultado
    assert resultado == 25.0


def test_cupom_dez_da_dez_por_cento_de_desconto():
    assert total([(100.0, 1)], cupom="DEZ") == 90.0`,
          caption: 'Também é comum ouvir **Given-When-Then** — é a mesma ideia, com nomes vindos do BDD.',
        },
      },
      {
        type: 'say',
        text: [
          'O `pytest` é a ferramenta mais usada em Python. Ele **descobre** os testes sozinho: arquivos `test_*.py` e funções que começam com `test_`.',
          'E você usa o `assert` puro do Python. Quando falha, o pytest mostra os valores envolvidos — a tal **introspecção** de asserts.',
        ],
        board: {
          title: 'Rodando o pytest',
          md: `\`\`\`text
$ pytest -q
.F                                                        [100%]
=========================== FAILURES ===========================
_____________ test_cupom_dez_da_dez_por_cento_de_desconto ______

    def test_cupom_dez_da_dez_por_cento_de_desconto():
>       assert total([(100.0, 1)], cupom="DEZ") == 90.0
E       assert 100.0 == 90.0
E        +  where 100.0 = total([(100.0, 1)], cupom='DEZ')

test_carrinho.py:17: AssertionError
1 failed, 1 passed in 0.02s
\`\`\`

- \`.\` = passou, \`F\` = falhou, \`E\` = erro na preparação ou na limpeza (ex.: numa fixture)
- As linhas com **E** mostram o valor obtido (\`100.0\`) e de onde ele veio
- Funções **sem** o prefixo \`test_\` são ignoradas — um erro clássico

> [!atencao] Um teste sem \`assert\` sempre passa. Ele executa o código, mas não verifica nada.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Última ideia antes de praticar: onde os bugs se escondem? Muito frequentemente, nos **limites**.',
          'Se a regra diz "a partir de 200", teste **exatamente 200**, e também 199,99. É lá que um `>` no lugar de `>=` aparece.',
        ],
        board: {
          title: 'Análise de valor-limite',
          md: `Para a regra **"compras de R$ 200 ou mais têm frete grátis"**:

| Valor testado | Por quê |
|---|---|
| \`150\` | caso "comum" abaixo do limite |
| \`199.99\` | logo abaixo do limite |
| \`200\` | **exatamente** no limite — pega \`>\` vs \`>=\` |
| \`250\` | caso "comum" acima do limite |

> [!dica] Casos de borda frequentes: vazio, zero, um elemento, negativo, o limite exato e um passo antes/depois dele.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Antes de praticar, uma técnica que completa a dos limites — e duas ideias com nomes curiosos.',
          'Uma diz **de quem é a culpa** quando algo sem teste quebra; a outra explica por que uma suíte sempre verde pode estar ficando **cega**.',
        ],
        board: {
          title: 'Escolhendo casos — e duas leis pouco conhecidas',
          md: `| Técnica | Ideia | No frete |
|---|---|---|
| **Partição de equivalência** | entradas que o código trata igual formam um grupo; basta **um representante** de cada | barato e leve · barato e pesado · caro |
| **Análise de valor-limite** | teste as **fronteiras** entre os grupos | R$ 200 e R$ 199,99 · 5 kg exatos |

> [!sabia] No Google existe a **Regra Beyoncé**: *"If you liked it, then you shoulda put a test on it"*. Se uma mudança de infraestrutura — um compilador novo, uma biblioteca atualizada — quebra o seu sistema e **nenhum teste do CI** acusou, a culpa não é de quem fez a mudança. Gostou do comportamento? Proteja-o com um teste.
>
> E o **paradoxo do pesticida** (Boris Beizer, 1990): os mesmos testes, rodados para sempre, deixam de achar bugs novos — assim como as pragas ficam imunes ao mesmo pesticida. Uma suíte verde há meses pode estar só **cega**: acrescente um teste a cada bug encontrado e revise os casos quando o código muda.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Quatro perguntas rápidas e depois você escreve seus próprios testes.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-fund-q1',
        concept: 'Pirâmide de testes',
        say: 'Começando pela pirâmide…',
        prompt: 'Segundo a **pirâmide de testes**, como costuma ser a distribuição saudável de uma suíte?',
        options: [
          { text: 'Muitos testes de unidade, alguns de integração e poucos ponta a ponta.', correct: true, why: 'É a forma da pirâmide: a base rápida e barata sustenta o resto.' },
          { text: 'Principalmente testes ponta a ponta, porque testam o sistema como o usuário usa.', why: 'Isso é a "casquinha de sorvete" invertida: suíte lenta, frágil e que diz pouco sobre *onde* está o erro.' },
          { text: 'A mesma quantidade de cada tipo.', why: 'Os tipos têm custos muito diferentes; distribuir igualmente deixa a suíte lenta.' },
          { text: 'Só testes de unidade: integração e E2E são desnecessários.', why: 'Unidades isoladas passando não garantem que as peças conversam direito. Os outros níveis são poucos, mas necessários.' },
        ],
        explanation: 'Testes de unidade são rápidos e apontam o erro com precisão, por isso ficam na base. Integração e E2E dão confiança no conjunto, mas são lentos e frágeis — então são **poucos** e focados nos fluxos críticos.',
      },
      {
        type: 'mcq',
        id: 'tst-fund-q2',
        concept: 'Descoberta de testes do pytest',
        say: 'Agora um olho clínico: quantos testes o pytest vai rodar aqui?',
        prompt: `Arquivo \`test_calculo.py\`:

\`\`\`python
from calculo import dobro


def test_dobro_de_dois():
    assert dobro(2) == 4


def verifica_dobro_de_zero():
    assert dobro(0) == 0


def test_dobro_de_negativo():
    dobro(-3) == -6
\`\`\`

Quantos testes o pytest **coleta** e quantos realmente **verificam** algo?`,
        options: [
          { text: 'Coleta 2; só 1 verifica algo de verdade.', correct: true, why: '`verifica_dobro_de_zero` não começa com `test_`, e `test_dobro_de_negativo` compara mas esquece o `assert`.' },
          { text: 'Coleta 3; todos verificam algo.', why: 'A função sem prefixo `test_` não é coletada.' },
          { text: 'Coleta 2; os 2 verificam algo.', why: 'Sem `assert`, a comparação `dobro(-3) == -6` é calculada e descartada — o teste sempre passa.' },
          { text: 'Coleta 1; só `test_dobro_de_dois`.', why: '`test_dobro_de_negativo` tem o prefixo certo e é coletado — ele só não verifica nada.' },
        ],
        explanation: 'O pytest coleta **funções `test_*`** em **arquivos `test_*.py`**. E uma comparação sem `assert` é só uma expressão descartada: o teste passa sempre, mesmo com o código errado. Por isso vale ver o teste **falhar** pelo menos uma vez.',
      },
      {
        type: 'match',
        id: 'tst-rx-fund1',
        concept: 'Tipos de teste e técnicas',
        say: 'Rodada rápida: ligue cada termo ao que ele descreve.',
        prompt: 'Associe cada **tipo de teste ou técnica** à descrição certa.',
        pairs: [
          { left: 'Teste de unidade', right: 'Uma função isolada, em milissegundos — aponta exatamente onde está o erro' },
          { left: 'Teste de integração', right: 'Peças reais conversando, como o código e o banco de dados' },
          { left: 'Teste ponta a ponta (E2E)', right: 'O sistema inteiro, do jeito que o usuário usa — lento e mais frágil' },
          { left: 'Análise de valor-limite', right: 'Testar exatamente R$ 200 e também R$ 199,99' },
          { left: 'Partição de equivalência', right: 'Um exemplo de cada grupo tratado igual: leve, pesado, caro' },
        ],
        explanation: 'Os três primeiros são os andares da **pirâmide**: quanto mais alto, mais realista — e mais lento, caro e vago quando falha. Os dois últimos são técnicas para **escolher os casos**: a partição de equivalência evita exemplos redundantes (um representante por grupo) e a análise de valor-limite testa as **fronteiras** entre os grupos, onde moram os `>` no lugar de `>=`.',
      },
      {
        type: 'open',
        id: 'tst-fund-q3',
        concept: 'Anatomia de um bom teste',
        say: 'Explique como faria num code review.',
        prompt: 'O que caracteriza um **bom teste de unidade**? Cite pelo menos três características.',
        minWords: 15,
        rubric: [
          { label: 'Estrutura **Arrange-Act-Assert** (ou Given-When-Then)', keywords: ['arrange', 'given', ['prepar', 'verific'], 'aaa'], concept: 'Arrange-Act-Assert' },
          { label: 'Testa **um comportamento** por vez, com **nome descritivo**', keywords: ['um comportamento', 'uma coisa', 'nome descritivo', 'nome claro', 'nomes descritivos', 'unico comportamento', 'responsabilidade'], concept: 'Um comportamento por teste' },
          { label: 'É **rápido, isolado/independente** e determinístico', keywords: ['rapido', 'isolad', 'independente', 'determinist', 'repetivel', 'ordem'], concept: 'Princípios FIRST' },
          { label: 'Cobre **casos de borda / limites**, não só o caminho feliz', keywords: ['borda', 'limite', 'caminho feliz', 'extremo', 'vazio', 'excec'], concept: 'Valores-limite' },
        ],
        modelAnswer: `Um bom teste de unidade segue **Arrange-Act-Assert**: prepara os dados, executa **um** comportamento e verifica o resultado. Ele testa **uma coisa só** e tem um **nome descritivo** (ex.: \`test_cupom_expirado_nao_da_desconto\`), para que a falha já diga o que quebrou.

Ele é **rápido**, **isolado** (não depende de outros testes, da ordem de execução, de rede ou do relógio) e **determinístico** — dá o mesmo resultado sempre.

E não fica só no caminho feliz: cobre **casos de borda** como vazio, zero, negativos e os **limites** das regras.`,
      },
      {
        type: 'pytest',
        id: 'tst-fund-q4',
        concept: 'Valores-limite',
        title: 'Testando o cálculo de frete',
        module: 'frete',
        say: 'Agora o jogo inverte: **você** escreve os testes. Eu vou plantar bugs no código para ver se eles pegam!',
        prompt: `Escreva testes com **pytest** para \`calcular_frete(valor_compra, peso_kg)\`, do arquivo \`frete.py\`.

As regras estão na docstring. Pense no **caminho feliz**, mas principalmente nos **limites**: o que acontece exatamente em R$ 200? E exatamente em 5 kg? E um pedido caro **e** pesado?

Escreva pelo menos **4 testes**, cada um verificando um comportamento.`,
        implementation: FRETE,
        starter: `from frete import calcular_frete


def test_pedido_leve_paga_frete_fixo():
    # Arrange / Act / Assert
    assert calcular_frete(100, 2) == 15
`,
        minTests: 4,
        mutants: [
          {
            name: 'frete grátis só acima de R$ 200 (> em vez de >=)',
            code: mut('valor_compra >= 200', 'valor_compra > 200'),
            why: 'um teste com o valor **exatamente** no limite (R$ 200) pegaria a troca de `>=` por `>`.',
            concept: 'Valores-limite',
          },
          {
            name: 'excedente de peso não é cobrado',
            code: mut('return 15 + (peso_kg - 5) * 2', 'return 15'),
            why: 'faltou um teste com pedido **acima de 5 kg**.',
            concept: 'Partição de equivalência',
          },
          {
            name: 'excedente calculado sobre o peso total',
            code: mut('return 15 + (peso_kg - 5) * 2', 'return 15 + peso_kg * 2'),
            why: 'um teste com peso acima de 5 kg verificando o **valor exato** (ex.: 8 kg → R$ 21) pegaria a conta errada.',
            concept: 'Asserts precisos',
          },
          {
            name: 'frete grátis só vale para pedidos leves',
            code: mut('if valor_compra >= 200:', 'if valor_compra >= 200 and peso_kg <= 5:'),
            why: 'faltou combinar as regras: um pedido **caro e pesado** também tem frete grátis.',
            concept: 'Combinação de regras',
          },
        ],
        reviews: [
          {
            when: (m, code) => (code.match(/\bassert\b/g) || []).length < m.functions.filter(f => f.startsWith('test_')).length,
            text: 'Algum teste parece não ter `assert` — ele executa o código mas não verifica nada, e passa sempre.',
            concept: 'Anatomia do teste (Assert)',
          },
        ],
        hints: [
          'Liste os cenários: barato e leve, barato e pesado, exatamente R$ 200, caro e pesado. Um teste para cada.',
          'Para o limite: `assert calcular_frete(200, 1) == 0`. Para o excedente: 8 kg dá `15 + 3 * 2 = 21`.',
          'Não esqueça o pedido **caro e pesado**: `calcular_frete(300, 10)` deve ser `0`.',
        ],
        solution: `from frete import calcular_frete


def test_pedido_barato_e_leve_paga_frete_fixo():
    assert calcular_frete(100, 2) == 15


def test_exatamente_5_kg_ainda_paga_frete_fixo():
    assert calcular_frete(100, 5) == 15


def test_peso_acima_de_5_kg_cobra_2_reais_por_kg_excedente():
    assert calcular_frete(100, 8) == 21


def test_exatamente_200_reais_tem_frete_gratis():
    assert calcular_frete(200, 1) == 0


def test_logo_abaixo_de_200_reais_paga_frete():
    assert calcular_frete(199.99, 1) == 15


def test_pedido_caro_e_pesado_tambem_tem_frete_gratis():
    assert calcular_frete(300, 10) == 0
`,
        solutionExplanation: 'Cada teste verifica **um** comportamento, e o nome diz qual. Os testes de **limite** (R$ 200 e 5 kg exatos) pegam trocas de `>=` por `>`; o teste de 8 kg com valor exato pega erros de conta; e o pedido **caro e pesado** verifica a combinação das regras — um cenário que só o caminho feliz nunca exercita.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Resumindo: testes dão **confiança para mudar**; a **pirâmide** diz quantos de cada tipo; cada teste segue **Arrange-Act-Assert** e verifica um comportamento.',
          'E os bugs moram nos **limites**. No próximo módulo, vamos ver os recursos do pytest que deixam isso muito mais fácil: `parametrize`, fixtures e `pytest.raises`.',
        ],
        board: null,
      },
    ],
  });
})();
