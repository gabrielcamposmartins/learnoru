Game.registerModule('testing', {
  id: 'entrevista-testes',
  title: 'Entrevista: Qualidade & Testes',
  kind: 'interview',
  level: 3,
  order: 90,
  unit: 'entrevistas',
  summary: 'Estratégia de testes, APIs externas, testes flaky, casos de borda com dinheiro e um TDD ao vivo.',
  concepts: ['Pirâmide de testes', 'Fakes e contratos', 'Testes flaky', 'Valores-limite', 'TDD'],
  takeaways: [
    'Estratégia de testes em entrevista = **pirâmide** + trade-offs: unitários na regra de negócio, integração com as dependências que você controla e poucos E2E nos fluxos críticos.',
    'APIs externas ficam atrás de uma **fronteira** (adapter), com fake nos testes, **testes de contrato** e cenários de falha — timeout, 5xx, retry e **idempotência**.',
    'Teste flaky não se resolve com `sleep` nem com retry cego: ache a **causa raiz** (relógio, ordem, aleatoriedade, rede), **injete** a dependência e use **quarentena** enquanto isso.',
    'Com dinheiro, teste **limites dos dois lados** e **invariantes** (a soma das partes é o total), além dos valores exatos.',
    'Quando o requisito muda, os testes mudam junto: eles são a **especificação** executável.',
  ],
  glossary: [
    { term: 'Cone de sorvete', aliases: ['casquinha de sorvete', 'ice cream cone', 'ice-cream cone'], definition: 'Anti-padrão da pirâmide de testes: muitos testes manuais e ponta a ponta no topo e poucos de unidade na base. A suíte fica lenta, cara e frágil — e diz pouco sobre **onde** está o erro.' },
    { term: 'Quarentena de testes', aliases: ['teste em quarentena', 'testes em quarentena', 'test quarantine'], definition: 'Prática para testes flaky: o teste continua rodando, mas sai do caminho que bloqueia o merge, com um ticket aberto, até a causa raiz ser corrigida. Evita que o time se acostume a ignorar o vermelho — sem apagar a verificação.' },
    { term: 'Especificação executável', aliases: ['especificações executáveis', 'executable specification', 'testes como especificação', 'teste como especificação'], definition: 'Visão de que a suíte de testes **é** a especificação do sistema — uma que roda. Quando o requisito muda, os testes mudam junto: um teste que contradiz a regra nova está desatualizado, e não "quebrado".' },
    { term: 'Relógio injetado', aliases: ['relógio falso', 'relógios falsos', 'fake clock'], definition: 'Técnica de testabilidade: em vez de chamar `datetime.now()` por dentro, o código recebe o relógio (ou o "agora") como parâmetro. Em produção vai o relógio real; nos testes, uma data fixa — e o teste fica determinístico.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Olá! Obrigada por vir. Hoje eu conduzo sua entrevista sobre **qualidade e testes**.',
        'Vamos conversar sobre estratégia, depois você escreve testes de verdade e, no fim, fazemos um pouco de **TDD ao vivo**.',
        { text: 'Pense em voz alta — em entrevista de testes, o raciocínio sobre **o que** testar vale tanto quanto o código.', mood: 'neutral' },
      ],
      board: {
        title: '🎤 Roteiro da entrevista',
        md: `1. **Estratégia** — como distribuir os testes de um serviço
2. **Dependências externas** — API de pagamento
3. **Diagnóstico** — um teste flaky no CI
4. **Mão na massa** — testes para uma função cheia de casos de borda
5. **TDD ao vivo** — dois ciclos curtos

> [!dica] Entrevistadores gostam de ouvir **trade-offs**: custo, velocidade e confiança de cada tipo de teste.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Antes da primeira pergunta, um número de bastidor que vale ouro em entrevista.',
        { text: 'Quando falarmos de testes flaky, lembre dele: ninguém — nem o Google — está livre do problema.', mood: 'thinking' },
      ],
      board: {
        title: '📊 Um dado para levar à entrevista',
        md: `> [!sabia] Em 2016, o blog de testes do Google contou que cerca de **16% dos testes** da empresa tinham algum grau de flakiness, que **1,5% de todas as execuções** davam resultado flaky e que **84%** das transições de verde para vermelho no CI envolviam um teste flaky — e não um bug de verdade. A resposta deles não foi apagar testes: foi **medir** a flakiness de cada um e colocar os piores em **quarentena** — fora do caminho crítico, com um bug aberto para o time corrigir a causa raiz.

| O que o entrevistador quer ouvir | O que evitar |
|---|---|
| "Eu **reproduzo**, acho a causa raiz e **injeto** a dependência" | "Eu aumento o \`sleep\`" |
| "Coloco em **quarentena** e abro um ticket, sem perder a verificação" | "Eu apago o teste" |
| "Acompanho a taxa de flakiness da suíte" | "Ligo o retry automático e esqueço o assunto" |`,
      },
    },
    {
      type: 'mcq',
      id: 'tst-int-q1',
      concept: 'Pirâmide de testes',
      say: 'Primeira pergunta, de estratégia.',
      prompt: `Você vai testar um serviço de **pedidos**: uma API HTTP que valida regras de negócio (descontos, estoque), grava no **PostgreSQL** e chama um **gateway de pagamento** externo.

Qual estratégia de testes você proporia?`,
      options: [
        { text: 'Muitos testes unitários nas regras de negócio; alguns testes de integração com banco real (ex.: contêiner) e o gateway substituído por um fake; poucos testes ponta a ponta nos fluxos críticos.', correct: true, why: 'É a pirâmide: a base rápida e barata, com poucos testes caros no topo.' },
        { text: 'Principalmente testes ponta a ponta pela API, com o gateway de pagamento real, porque eles testam "tudo de verdade".', why: 'É o anti-padrão do "cone de sorvete": lento, flaky e caro — e cobrar cartões reais em testes é um risco.' },
        { text: 'Só testes unitários com mocks para tudo, inclusive o banco; integração não é necessária.', why: 'Mocks do banco não pegam erros de SQL, migrações ou constraints. Falta a camada de integração.' },
        { text: 'Nenhum teste automatizado para o gateway; ele é de terceiros e já é testado pelo fornecedor.', why: 'O que precisa ser testado é a **sua integração** com ele: formatos, erros, timeouts, idempotência.' },
      ],
      explanation: 'A **pirâmide de testes**: a base são testes unitários rápidos da lógica de domínio; no meio, testes de integração com dependências reais que você controla (banco em contêiner, SQLite) e **fakes** para as externas; no topo, poucos testes e2e para os fluxos mais críticos.',
    },
    {
      type: 'open',
      id: 'tst-int-q2',
      concept: 'Fakes e contratos',
      say: 'Agora me conta: como você testaria a parte do pagamento?',
      prompt: 'Como você testaria um serviço que chama uma **API externa de pagamento**? Fale de onde isolar, que tipos de teste usaria e quais cenários não podem faltar.',
      minWords: 25,
      rubric: [
        { label: 'Isola a API numa **fronteira** (adapter/porta) e usa **fake/mock/stub** nos testes', keywords: ['fake', 'mock', 'stub', 'dubl', 'adapter', 'adaptador', 'porta', 'fronteira', 'interface'], concept: 'Test doubles' },
        { label: 'Cita **testes de contrato** ou sandbox do fornecedor', keywords: ['contrato', 'contract', 'pact', 'sandbox', 'ambiente de teste do', 'homolog'], concept: 'Testes de contrato' },
        { label: 'Testa **falhas**: timeout, erro 5xx, recusa, retry', keywords: ['timeout', 'erro', 'falha', 'retry', 'retent', 'indisponi', 'recus', '500', '5xx'], concept: 'Cenários de falha' },
        { label: 'Garante **idempotência** / não cobrar duas vezes', keywords: ['idempot', 'duas vezes', 'duplic', 'cobranca dupla', 'chave de'], concept: 'Idempotência', why: 'Com retries, o maior risco em pagamentos é cobrar o cliente duas vezes.' },
      ],
      modelAnswer: `Eu colocaria a chamada ao gateway atrás de uma **fronteira** (uma porta/adapter, ex.: \`GatewayPagamento\`). A lógica de negócio é testada em unitários com um **fake** desse gateway, que eu consigo programar para aprovar, recusar ou falhar.

O adapter real ganha **testes de contrato** (ou testes contra o **sandbox** do fornecedor) para garantir que o formato das requisições e respostas continua o esperado.

Cenários que não podem faltar: pagamento aprovado e recusado, **timeout** e erros 5xx (com a política de **retry**), resposta malformada — e principalmente **idempotência**: se houver retry, o cliente não pode ser **cobrado duas vezes** (uso de chave de idempotência).`,
    },
    {
      type: 'mcq',
      id: 'tst-int-q3',
      concept: 'Testes flaky',
      say: 'Situação real do dia a dia…',
      prompt: `Este teste falha mais ou menos **1 vez em cada 20** execuções no CI, sem nenhuma mudança no código:

\`\`\`python
def test_token_expira_em_uma_hora():
    token = gerar_token()          # usa datetime.now() internamente
    time.sleep(0.01)
    assert token.expira_em - datetime.now() == timedelta(hours=1)
\`\`\`

Qual a melhor correção?`,
      options: [
        { text: 'Injetar o relógio em `gerar_token` (ex.: parâmetro `agora`) e comparar com um horário fixo no teste.', correct: true, why: 'Sem o relógio real, o teste fica determinístico e dispensa o `sleep`.' },
        { text: 'Aumentar o `sleep` para 1 segundo, para dar tempo.', why: 'O teste fica mais lento e continua dependendo do relógio real.' },
        { text: 'Marcar o teste com retry automático no CI até passar.', why: 'Esconde o problema — e retries em testes flaky corroem a confiança na suíte.' },
        { text: 'Apagar o teste, já que é flaky.', why: 'Você perde a verificação de uma regra importante (expiração de token).' },
      ],
      explanation: 'O teste depende de **dois** `datetime.now()` em momentos diferentes — a diferença nunca é exatamente uma hora. A cura é **injetar o tempo**: `gerar_token(agora=datetime(2024, 1, 1, 12))` e verificar `expira_em == datetime(2024, 1, 1, 13)`. Determinístico, rápido e sem `sleep`.',
    },
    {
      type: 'match',
      id: 'tst-rx-int1',
      concept: 'Testes flaky',
      say: 'Follow-up: e se o sintoma fosse outro? Diagnóstico rápido.',
      prompt: 'Associe cada **sintoma** de teste flaky à **causa mais provável**.',
      pairs: [
        { left: 'Falha só perto da meia-noite ou na virada do mês', right: 'Relógio real (`datetime.now()`) no código ou no teste' },
        { left: 'Passa sozinho, mas falha quando roda com a suíte inteira', right: 'Estado compartilhado entre testes (dependência de ordem)' },
        { left: 'Falha mais quando o CI está sobrecarregado', right: 'Espera com `sleep` fixo em vez de esperar por uma condição' },
        { left: 'A cada falha, os valores da mensagem de erro mudam', right: 'Aleatoriedade sem seed fixa' },
        { left: 'Falha quando a API do parceiro está lenta', right: 'Chamada de rede real, sem fake na fronteira' },
      ],
      explanation: 'Cada sintoma aponta uma **fonte de não determinismo**: tempo (injete o relógio), ordem e estado compartilhado (cada teste monta o seu cenário; plugins como o `pytest-randomly` embaralham a ordem para expor o problema), timing (espere por **condições**, não por tempo), aleatoriedade (injete um `random.Random(seed)`) e rede (fake na fronteira, testes de contrato à parte). Em entrevista, nomear a causa **antes** da correção mostra método de diagnóstico.',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Ótimo. Agora mão na massa: uma função pequena, mas com dinheiro — e dinheiro é **cheio** de casos de borda.',
      ],
    },
    {
      type: 'pytest',
      id: 'tst-int-q4',
      concept: 'Valores-limite',
      module: 'conta',
      title: 'Dividindo a conta em centavos',
      say: 'Escreva os testes. Vou plantar bugs sutis — os testes do "caminho feliz" não vão pegar.',
      prompt: `A função \`dividir_conta(total_centavos, pessoas)\` divide uma conta entre várias pessoas:

- cada parte é um número **inteiro** de centavos, e a **soma** das partes é exatamente o total;
- os centavos que sobram vão, **um para cada**, às **primeiras** pessoas (ex.: 100 entre 3 → \`[34, 33, 33]\`);
- \`ValueError\` se \`pessoas < 1\` ou se o total for **negativo** (total zero é válido).

Escreva testes que realmente protejam essas regras.`,
      implementation: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos < 0:
        raise ValueError("total não pode ser negativo")
    base, resto = divmod(total_centavos, pessoas)
    return [base + 1 if i < resto else base for i in range(pessoas)]
`,
      starter: `import pytest

from conta import dividir_conta


def test_divisao_exata():
    assert dividir_conta(100, 4) == [25, 25, 25, 25]
`,
      minTests: 5,
      mutants: [
        {
          name: 'Sobra vai para as últimas pessoas',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos < 0:
        raise ValueError("total não pode ser negativo")
    base, resto = divmod(total_centavos, pessoas)
    return [base + 1 if i >= pessoas - resto else base for i in range(pessoas)]
`,
          why: 'verifique a lista exata numa divisão com sobra (ex.: 100 entre 3 → [34, 33, 33]), não só a soma.',
          concept: 'Asserts precisos',
        },
        {
          name: 'Arredonda cada parte e perde centavos',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos < 0:
        raise ValueError("total não pode ser negativo")
    parte = round(total_centavos / pessoas)
    return [parte] * pessoas
`,
          why: 'teste uma divisão não exata e confira que a soma das partes é o total.',
          concept: 'Invariantes',
        },
        {
          name: 'Toda a sobra vai para a primeira pessoa',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos < 0:
        raise ValueError("total não pode ser negativo")
    base, resto = divmod(total_centavos, pessoas)
    return [base + resto] + [base] * (pessoas - 1)
`,
          why: 'com sobra de 1 centavo o resultado é igual; teste uma sobra de 2 ou mais (ex.: 101 entre 3 → [34, 34, 33]).',
          concept: 'Valores-limite',
        },
        {
          name: 'Aceita zero pessoas (ZeroDivisionError)',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 0:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos < 0:
        raise ValueError("total não pode ser negativo")
    base, resto = divmod(total_centavos, pessoas)
    return [base + 1 if i < resto else base for i in range(pessoas)]
`,
          why: 'teste o limite pessoas = 0 com pytest.raises(ValueError).',
          concept: 'pytest.raises',
        },
        {
          name: 'Aceita total negativo',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    base, resto = divmod(total_centavos, pessoas)
    return [base + 1 if i < resto else base for i in range(pessoas)]
`,
          why: 'teste que um total negativo levanta ValueError.',
          concept: 'pytest.raises',
        },
        {
          name: 'Rejeita total zero',
          code: `def dividir_conta(total_centavos: int, pessoas: int) -> list[int]:
    if pessoas < 1:
        raise ValueError("é preciso pelo menos uma pessoa")
    if total_centavos <= 0:
        raise ValueError("total não pode ser negativo")
    base, resto = divmod(total_centavos, pessoas)
    return [base + 1 if i < resto else base for i in range(pessoas)]
`,
          why: 'total zero é válido — teste o limite do lado permitido também (0 entre 3 → [0, 0, 0]).',
          concept: 'Valores-limite',
        },
      ],
      hints: [
        'Divisões com sobra 1 **e** com sobra 2 revelam bugs diferentes: `dividir_conta(100, 3)` e `dividir_conta(101, 3)`.',
        'Teste os dois lados de cada limite de erro: `pessoas=0` falha, `pessoas=1` funciona; total `-1` falha, total `0` funciona.',
        'Uma verificação de invariante ajuda: `sum(dividir_conta(total, n)) == total` para vários valores.',
      ],
      solution: `import pytest

from conta import dividir_conta


@pytest.mark.parametrize("total, pessoas, esperado", [
    (100, 4, [25, 25, 25, 25]),     # divisão exata
    (100, 3, [34, 33, 33]),         # sobra 1: vai para a primeira pessoa
    (101, 3, [34, 34, 33]),         # sobra 2: uma para cada, nas primeiras
    (0, 3, [0, 0, 0]),              # total zero é válido
    (7, 1, [7]),                    # uma pessoa paga tudo
])
def test_partes(total, pessoas, esperado):
    assert dividir_conta(total, pessoas) == esperado


@pytest.mark.parametrize("total, pessoas", [(1000, 7), (1, 3), (99, 10)])
def test_soma_das_partes_e_o_total(total, pessoas):
    assert sum(dividir_conta(total, pessoas)) == total


@pytest.mark.parametrize("total, pessoas", [(100, 0), (100, -2), (-1, 3)])
def test_entradas_invalidas_levantam_value_error(total, pessoas):
    with pytest.raises(ValueError):
        dividir_conta(total, pessoas)
`,
      solutionExplanation: 'Três grupos de testes: **valores exatos** (inclusive sobras de 1 e de 2 centavos, que pegam bugs diferentes), um **invariante** (a soma é sempre o total) e os **erros** com `pytest.raises` — testando também o lado válido de cada limite (`total = 0`, `pessoas = 1`).',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bom. Para fechar: um pouquinho de **TDD ao vivo**. Validador de senhas, dois ciclos.',
        { text: 'No segundo ciclo o requisito muda — e talvez um teste antigo precise mudar junto. Acontece no mundo real!', mood: 'thinking' },
      ],
    },
    {
      type: 'tdd',
      id: 'tst-int-tdd1',
      kata: 'senha',
      module: 'senha',
      concept: 'TDD',
      title: 'TDD ao vivo — ciclo 1: tamanho mínimo',
      say: 'Ciclo 1. Comece pelo teste. Lembre do limite: exatamente 8 caracteres.',
      prompt: '**Requisito:** `senha_forte(senha)` devolve `True` se a senha tiver **pelo menos 8 caracteres**, e `False` caso contrário.',
      testStarter: `from senha import senha_forte


def test_senha_com_8_caracteres_e_forte():
    ...
`,
      implStarter: '# senha.py\n',
      stub: 'def senha_forte(senha):\n    return None\n',
      reference: 'def senha_forte(senha):\n    return len(senha) >= 8\n',
      checks: [
        { name: 'exatamente 8 → True', code: 'assert senha_forte("abcdefg1") is True' },
        { name: '7 caracteres → False', code: 'assert senha_forte("abcde12") is False' },
        { name: 'vazia → False', code: 'assert senha_forte("") is False' },
        { name: 'longa → True', code: 'assert senha_forte("abcdefghij12345") is True' },
      ],
      hints: [
        'Teste os dois lados do limite: `assert senha_forte("abcdefgh") is True` e `assert senha_forte("abcdefg") is False`.',
        'A implementação: `return len(senha) >= 8`.',
      ],
      solutionTests: `from senha import senha_forte


def test_senha_com_8_caracteres_e_forte():
    assert senha_forte("abcdefgh") is True


def test_senha_com_7_caracteres_e_fraca():
    assert senha_forte("abcdefg") is False
`,
      solutionImpl: 'def senha_forte(senha):\n    return len(senha) >= 8\n',
      solutionExplanation: 'Dois testes, um de cada lado do limite (8 e 7 caracteres), já triangulam: nenhum valor chumbado passa nos dois.',
    },
    {
      type: 'tdd',
      id: 'tst-int-tdd2',
      kata: 'senha',
      module: 'senha',
      concept: 'Testes como especificação',
      title: 'TDD ao vivo — ciclo 2: precisa de um dígito',
      say: 'Ciclo 2: o requisito mudou. Atenção aos seus testes antigos!',
      prompt: `**Requisito novo:** além de ter pelo menos 8 caracteres, a senha precisa conter **pelo menos um dígito**. Ex.: \`senha_forte("abcdefg1")\` → \`True\`, \`senha_forte("abcdefgh")\` → \`False\`.

> [!atencao] Se algum teste antigo espera \`True\` para uma senha **sem dígito**, ele descreve uma regra que não vale mais: atualize-o. Testes são a **especificação** — quando o requisito muda, eles mudam junto.`,
      reference: 'def senha_forte(senha):\n    return len(senha) >= 8 and any(c.isdigit() for c in senha)\n',
      checks: [
        { name: 'com dígito e 8+ → True', code: 'assert senha_forte("abcdefg1") is True' },
        { name: 'sem dígito → False', code: 'assert senha_forte("abcdefghij") is False' },
        { name: 'dígito mas curta → False', code: 'assert senha_forte("a1") is False' },
        { name: 'só dígitos, 8+ → True', code: 'assert senha_forte("12345678") is True' },
      ],
      refactorTip: 'Verde! Uma forma expressiva de checar "existe algum dígito" é `any(c.isdigit() for c in senha)`. Se você usou um laço com flag, experimente trocar — os testes garantem que nada muda.',
      hints: [
        'Novo teste: `assert senha_forte("abcdefghij") is False` — ele falha no código atual (que só olha o tamanho).',
        'Se o teste antigo usa `"abcdefgh"` esperando `True`, troque por algo como `"abcdefg1"`.',
        'Implementação: `return len(senha) >= 8 and any(c.isdigit() for c in senha)`.',
      ],
      solutionTests: `from senha import senha_forte


def test_senha_com_8_caracteres_e_digito_e_forte():
    assert senha_forte("abcdefg1") is True


def test_senha_com_7_caracteres_e_fraca():
    assert senha_forte("abcdef1") is False


def test_senha_sem_digito_e_fraca():
    assert senha_forte("abcdefghij") is False
`,
      solutionImpl: 'def senha_forte(senha):\n    return len(senha) >= 8 and any(c.isdigit() for c in senha)\n',
      solutionExplanation: 'O teste antigo `"abcdefgh" → True` passou a contradizer o requisito, então foi **atualizado** para `"abcdefg1"`. O novo teste (`"abcdefghij" → False`) é o vermelho do ciclo. Suíte e código evoluem juntos.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'É isso! Obrigada pela conversa. Você falou de estratégia, pensou em falhas e idempotência, caçou casos de borda e mostrou o ciclo de TDD funcionando.',
        { text: 'Feedback final: nesse nível, o diferencial é testar **limites dos dois lados** e tratar o relógio e as APIs externas como dependências **injetadas**.', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
