(function () {
  // Prelúdio dos testes de alerta: séries sintéticas, um ponto por minuto.
  const CENARIOS = `def trecho(inicio, fim, total, erros):
    """Um ponto (minuto, total, erros) por minuto, de inicio a fim (inclusive)."""
    return [(m, total, erros) for m in range(inicio, fim + 1)]

AGORA = 3 * 24 * 60   # minuto 4320: três dias de histórico
`;

  Game.registerModule('observability', {
    id: 'slos',
    title: 'SLOs e error budgets',
    kind: 'lesson',
    level: 3,
    order: 10,
    unit: 'confiabilidade',
    summary: 'Confiabilidade medida do ponto de vista do usuário: SLIs que importam, "noves" realistas, error budgets que viram política — e alertas por burn rate que só acordam alguém quando vale a pena.',
    concepts: ['SLI × SLO × SLA', 'Noves', 'Error budget', 'Burn rate', 'Alertas multi-janela'],
    takeaways: [
      '**SLI** é a medida (eventos bons ÷ eventos válidos), **SLO** é o alvo interno (ex.: 99,9% em 30 dias) e **SLA** é o contrato com multa — sempre mais frouxo que o SLO.',
      'Bons SLIs medem o que o **usuário sente** (sucesso e latência das requisições, frescor dos dados), o mais perto dele possível. CPU e memória são causas, não sintomas.',
      'O **error budget** é 1 − SLO: com 99,9% em 30 dias, sobram 43 minutos (ou 0,1% das requisições) para falhar. A **política de error budget**, combinada antes, diz o que acontece quando ele acaba: congelar features e investir em confiabilidade.',
      '**Burn rate** = taxa de erro ÷ (1 − SLO). Alerte com **duas janelas** — a longa dá significância, a curta confirma que ainda está acontecendo: 14,4× em 1 h e 5 min → page; 6× em 6 h e 30 min → page; 1× em 3 dias e 6 h → ticket.',
      '100% é o alvo errado: o usuário não percebe a diferença, o custo explode a cada nove e orçamento zero significa **nenhuma mudança** — nenhum deploy.',
    ],
    glossary: [
      { term: 'SLI', aliases: ['SLIs', 'service level indicator', 'indicador de nível de serviço'], definition: '*Service Level Indicator*: medida quantitativa do serviço do ponto de vista do usuário, em geral a proporção **eventos bons ÷ eventos válidos** (ex.: requisições respondidas com sucesso em menos de 300 ms).' },
      { term: 'SLO', aliases: ['SLOs', 'service level objective', 'objetivo de nível de serviço'], definition: '*Service Level Objective*: o **alvo** de um SLI numa janela de tempo — ex.: 99,9% das requisições bem-sucedidas nos últimos 30 dias. É um acordo interno entre produto, desenvolvimento e operação.' },
      { term: 'SLA', aliases: ['SLAs', 'service level agreement', 'acordo de nível de serviço'], definition: '*Service Level Agreement*: **contrato** com o cliente, com consequências (créditos, multa) se o nível prometido não for cumprido. Deve ser mais frouxo que o SLO interno, para que você perceba o problema antes de pagar por ele.' },
      { term: 'Error budget', aliases: ['error budgets', 'orçamento de erros', 'orçamento de erro'], definition: 'Quanto de falha o SLO **permite**: 1 − SLO. Com 99,9% em 30 dias, são ~43 minutos fora do ar ou 0,1% das requisições. Gastá-lo com deploys e experimentos é legítimo; esgotá-lo aciona a política de error budget.' },
      { term: 'Burn rate', aliases: ['burn rates', 'taxa de queima'], definition: 'Velocidade de consumo do error budget em relação ao ritmo que o esgotaria exatamente no fim da janela: **taxa de erro ÷ (1 − SLO)**. Burn rate 1 gasta o orçamento em 30 dias; 14,4 gasta 2% dele em uma hora.' },
      { term: 'Alerta multi-janela', aliases: ['alertas multi-janela', 'multiwindow', 'multi-window'], definition: 'Alerta por burn rate que exige o limiar em **duas janelas** ao mesmo tempo: uma longa (1 h, 6 h, 3 dias), que dá significância, e uma curta (1/12 da longa), que confirma que o problema ainda acontece e desliga o alerta logo depois da correção.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje a pergunta parece filosófica, mas é muito prática: o que significa o sistema estar **funcionando**?',
          'Spoiler: não é "o servidor responde ao ping". É "o **usuário** consegue fazer o que veio fazer".',
        ],
        board: {
          title: 'SLI, SLO e SLA',
          md: `| Sigla | O que é | Exemplo | Quem se importa |
|---|---|---|---|
| **SLI** — *indicator* | uma **medida** | proporção de requisições do checkout que terminam com sucesso em menos de 1 s | engenharia |
| **SLO** — *objective* | o **alvo** do SLI numa janela | 99,9% nos últimos 30 dias | produto + engenharia + SRE |
| **SLA** — *agreement* | um **contrato** com consequência | 99,5% no mês, senão 10% de crédito na fatura | clientes, jurídico, financeiro |

\`\`\`text
 SLI (medida)      ──►  SLO (alvo interno)   ──►  SLA (promessa externa)
 99,95% agora           99,9% em 30 dias          99,5% no mês, com multa
                        ▲ alerta antes            ▲ dói no bolso
\`\`\`

O SLI quase sempre tem a forma de uma **proporção**:

**SLI = eventos bons ÷ eventos válidos**

Assim todo SLI vai de 0% a 100%, dá para comparar serviços diferentes e somar contagens ao longo do tempo e entre réplicas.

> [!dica] O SLA deve ser **mais frouxo** que o SLO. Com SLO de 99,9% e SLA de 99,5%, você recebe o alerta, conserta e ainda tem margem antes de pagar multa. SLA igual ao SLO é assinar embaixo de cada incidente.

> [!atencao] Muita empresa não tem SLA nenhum — e tudo bem. O SLO é o que orienta a engenharia; o SLA é um instrumento **comercial**.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Escolher o SLI é a parte mais importante — e onde mais se erra.',
          'A regra de ouro: meça **sintomas** que o usuário sente, não **causas** internas.',
        ],
        board: {
          title: 'O que faz um bom SLI',
          md: `| Tipo de sistema | SLIs típicos | Evento "bom" |
|---|---|---|
| API / site (requisição-resposta) | **disponibilidade**, **latência** | resposta sem 5xx; resposta em menos de 300 ms |
| Pipeline de dados / batch | **frescor** (*freshness*), **corretude**, **cobertura** | dado atualizado há menos de 10 min; registro processado sem erro |
| Armazenamento | **durabilidade**, disponibilidade de leitura | objeto lido de volta intacto |

**Onde medir** — quanto mais perto do usuário, mais fiel (e mais ruidoso):

| Fonte | Vantagem | Ponto cego |
|---|---|---|
| Métricas do próprio servidor | fácil e barato | não vê o que falhou antes de chegar (DNS, LB, rede) |
| Load balancer / gateway | vê quase tudo o que chegou | não vê o cliente |
| Sondas sintéticas (*probers*) | detectam falha mesmo sem tráfego | não são o tráfego real |
| Instrumentação no cliente (RUM) | é literalmente o que o usuário viveu | ruído de rede móvel e navegadores antigos |

Sinais ruins como SLI: **CPU**, **memória**, "o processo está de pé", **latência média**. Todos podem estar ótimos enquanto o usuário sofre — ou péssimos sem ninguém perceber. Eles servem para **diagnosticar**, não para definir se o serviço está bom.

> [!dica] Latência vira proporção com um **limiar**: "requisições servidas em menos de 300 ms ÷ requisições válidas". É equivalente a perguntar por um percentil — com a vantagem de que contagens **somam** entre janelas e réplicas, e percentis não.

> [!atencao] Decida o que é **válido**. Um \`400\` por JSON malformado do cliente não é falha sua e costuma ficar fora do denominador. Já um \`429\` porque *você* subdimensionou o rate limit é falha, sim.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora a matemática dos **noves**. Cada nove a mais divide por 10 o tempo que você pode ficar fora do ar.',
          'E as dependências entram na conta — para pior.',
        ],
        board: {
          title: '"Noves" e indisponibilidade permitida',
          md: `Indisponibilidade permitida = **(1 − SLO) × janela**

| SLO | Apelido | Em 30 dias | Em um ano |
|---|---|---|---|
| 99% | "dois noves" | 7,2 h | 3,65 dias |
| 99,5% | | 3,6 h | 1,83 dia |
| 99,9% | "três noves" | 43,2 min | 8,77 h |
| 99,95% | | 21,6 min | 4,38 h |
| 99,99% | "quatro noves" | 4,32 min | 52,6 min |
| 99,999% | "cinco noves" | 26 s | 5,26 min |

**Dependências críticas em série multiplicam.** Se o checkout precisa do pagamento (99,9%), do estoque (99,9%) e do banco (99,95%), o teto teórico é:

0,999 × 0,999 × 0,9995 ≈ **99,75%**

— pior que qualquer peça isolada. O que sobe esse número é **redundância**: duas réplicas independentes de 99% em paralelo dão 1 − 0,01² = **99,99%**.

> [!sabia] O Google chama isso de **regra do nove extra** (*rule of the extra 9*, do artigo *The Calculus of Service Availability*): cada dependência **crítica** deve ter um nove a mais que o serviço que depende dela. Se você promete 99,99%, suas dependências críticas precisam de ~99,999% — e, quando não têm, a arquitetura precisa tolerar a falha delas (cache, fallback, degradação graciosa).

> [!atencao] Disponibilidade **por tempo** ("minutos fora") e **por requisições** ("% de falhas") não são a mesma coisa: 10 minutos fora às 4h da manhã custam muito menos requisições do que 10 minutos na Black Friday. Para serviços com tráfego, prefira a proporção de requisições.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Aqui está a ideia mais poderosa do SRE: o que sobra do SLO não é falha tolerada a contragosto — é um **orçamento** para gastar.',
          'Deploys, migrações, experimentos: tudo isso consome error budget. E quando ele acaba, a **política** entra em ação.',
        ],
        board: {
          title: 'Error budget e política de error budget',
          md: `Com SLO de **99,9%** e **10 milhões** de requisições válidas nos últimos 30 dias:

| Conta | Valor |
|---|---|
| Orçamento (falhas permitidas) | 10.000.000 × 0,001 = **10.000** |
| Falhas até agora | 6.500 |
| Consumido | 6.500 ÷ 10.000 = **65%** |
| Restante | **35%** (3.500 falhas) |

\`\`\`python
def orcamento_restante(total, ruins, slo):
    if total == 0:
        return 1.0                        # sem tráfego, nada foi gasto
    permitidos = total * (1 - slo)        # quantas falhas o SLO tolera
    return 1 - ruins / permitidos         # 1.0 intacto · 0 zerado · < 0 estourado
\`\`\`

A **política de error budget** é combinada **antes** do incidente e assinada por produto, engenharia e SRE:

| Situação | O que acontece |
|---|---|
| Orçamento saudável | deploys normais, experimentos e migrações arriscadas liberados |
| Queimando rápido (ex.: metade na 1ª semana) | revisão dos incidentes recentes; deploys com mais cautela |
| **Esgotado** | congela features — só correções e trabalho de confiabilidade — até a janela recuperar |
| Um único incidente gastou mais de 20% | postmortem obrigatório, com pelo menos uma ação prioritária |

> [!dica] O error budget transforma a briga eterna "dev quer lançar × ops quer estabilidade" num **número compartilhado**: sobrou orçamento, lança; acabou, estabiliza. Ninguém precisa ganhar a discussão no grito.

> [!atencao] A janela costuma ser **móvel** (*rolling*: os últimos 28 ou 30 dias), não o mês do calendário — senão o orçamento "renasce" no dia 1º e o incidente do dia 30 some da conta. Janelas de **28 dias** têm a vantagem de conter sempre 4 fins de semana.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E se o chefe pedir **100%**? Parece ambição. Na prática, é o alvo errado.',
          'Deixa eu te mostrar por quê — incluindo a vez em que o Google derrubou um serviço **de propósito**.',
        ],
        board: {
          title: 'Por que 100% é o alvo errado',
          md: `1. **O usuário não percebe.** O Wi-Fi, a operadora e o celular dele falham muito mais que 0,01% das vezes. Entre 99,99% e 100% ele não vê diferença — mas você paga por ela.
2. **O custo cresce exponencialmente.** Cada nove costuma exigir mais redundância, mais regiões, mais automação e mais gente de plantão — algo como **10× mais caro** para ter 10× menos falha.
3. **Orçamento zero = mudança zero.** Todo deploy carrega risco. Com 100% como meta, o único comportamento racional é **não mudar nada** — e o produto para no tempo.
4. **Quem depende de você passa a assumir o impossível.** Se você nunca falha, os clientes internos não implementam timeout, retry nem fallback — e, quando a falha vier (ela vem), a queda é em cascata.

> [!sabia] O **Chubby**, o serviço de locks distribuídos do Google, ficava tão acima do SLO que outros times passaram a tratá-lo como infalível. A solução do time de SRE: quando o trimestre estava "bom demais", eles **derrubavam o Chubby de propósito**, numa queda planejada e controlada, para gastar o orçamento e expor quem dependia dele de forma indevida. Um SLO também funciona como **teto**: ficar muito acima dele cria dependências perigosas.

Escolha o SLO pelo que deixa os usuários **felizes** — medido no histórico, em reclamações e em dados de produto —, não pelo número que fica bonito numa apresentação.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Último conceito, e o menos conhecido: como **alertar** sobre um SLO sem acordar ninguém à toa.',
          'Alertar em "taxa de erro acima de 0,1% por 5 minutos" parece lógico — e é uma fábrica de falsos alarmes. A resposta é o **burn rate**.',
        ],
        board: {
          title: 'Alertas por burn rate multi-janela',
          md: `**Burn rate** é a velocidade com que você gasta o orçamento, comparada ao ritmo que o esgotaria **exatamente** no fim da janela:

**burn rate = taxa de erro observada ÷ (1 − SLO)**

| Burn rate (SLO 99,9% em 30 dias) | Taxa de erro | O orçamento acaba em |
|---|---|---|
| 1 | 0,1% | 30 dias (no limite) |
| 6 | 0,6% | 5 dias |
| 14,4 | 1,44% | ~2 dias |
| 1000 | 100% (fora do ar) | 43 minutos |

Orçamento consumido numa janela = **burn rate × janela ÷ período do SLO**. Ex.: 14,4 × 1 h ÷ 720 h = **2%** do orçamento do mês em uma hora.

A receita do *SRE Workbook* — **múltiplas janelas, múltiplos burn rates**:

| Ação | Burn rate | Janela longa | Janela curta | Consumo que dispara |
|---|---|---|---|---|
| **Page** (acorda alguém) | 14,4 | 1 h | 5 min | 2% do orçamento |
| **Page** | 6 | 6 h | 30 min | 5% do orçamento |
| **Ticket** (horário comercial) | 1 | 3 dias | 6 h | 10% do orçamento |

Cada regra só dispara se o burn rate passa do limiar nas **duas** janelas:

- a **longa** garante que não é um soluço de 30 segundos;
- a **curta** (1/12 da longa) garante que o problema **ainda está acontecendo** — depois da correção, o alerta se desliga em minutos, não em horas.

> [!sabia] O *SRE Workbook* avalia estratégias de alerta por quatro critérios: **precisão** (todo alerta é um problema real), **recall** (todo problema real gera alerta), **tempo de detecção** e **tempo de reset**. O limiar simples perde em precisão; uma janela longa sozinha perde em reset; a combinação *multiwindow, multi-burn-rate* equilibra os quatro — e quase ninguém fora do mundo SRE a conhece.

> [!atencao] Serviço com **pouco tráfego** faz o burn rate pular: 1 erro em 20 requisições já é 5% de erro. Nesses casos, some tráfego sintético, agregue serviços parecidos ou exija um número mínimo de eventos antes de alertar.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'SLIs, noves, burn rate e um avaliador de alertas multi-janela.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'obs-slo-q1',
        concept: 'Bons SLIs',
        say: 'Primeira: escolher o SLI certo.',
        prompt: 'Você vai definir o SLI de disponibilidade do **checkout** de uma loja on-line. Qual é a melhor escolha?',
        options: [
          { text: 'Proporção das requisições válidas ao checkout, medidas no load balancer, que terminam sem 5xx em menos de 1 s', correct: true, why: 'É um **sintoma** que o usuário sente (sucesso + latência), medido perto dele e no formato eventos bons ÷ eventos válidos.' },
          { text: 'Uso médio de CPU dos servidores do checkout abaixo de 70%', why: 'CPU é **causa**, não sintoma: pode estar em 30% com o banco travado (usuário sofrendo) ou em 90% com tudo funcionando. Ótimo para planejar capacidade; ruim como SLI.' },
          { text: 'Latência **média** do checkout abaixo de 300 ms', why: 'A média esconde a cauda: 95% das requisições em 50 ms e 5% em 5 s dão uma média "ótima" de ~300 ms — com 1 em cada 20 clientes desistindo da compra. Use a proporção abaixo de um limiar.' },
          { text: 'Porcentagem do tempo em que o health check `/ping` dos servidores responde `200`', why: 'O processo estar de pé não significa que o usuário é atendido: o `/ping` responde `200` enquanto o pagamento falha, o DNS aponta errado ou o load balancer derruba conexões.' },
        ],
        explanation: 'Um bom SLI é a **proporção de eventos bons** do ponto de vista do usuário, medida o mais perto dele que for viável (load balancer, cliente). A divisão de trabalho é: **sintomas** viram SLI e alertas; **causas** (CPU, memória, filas, pool de conexões) vão para dashboards de diagnóstico. É o *symptom-based alerting*: alerte no que dói, investigue pelas causas.',
      },
      {
        type: 'match',
        id: 'obs-slo-q2',
        concept: 'Noves',
        say: 'Jogo rápido: quanto tempo fora do ar cada SLO permite em 30 dias?',
        prompt: 'Associe cada SLO à indisponibilidade máxima permitida numa janela de **30 dias**.',
        pairs: [
          { left: '99%', right: '7,2 horas' },
          { left: '99,5%', right: '3,6 horas' },
          { left: '99,9%', right: '43,2 minutos' },
          { left: '99,95%', right: '21,6 minutos' },
          { left: '99,99%', right: '4,32 minutos' },
          { left: '99,999%', right: '~26 segundos' },
        ],
        explanation: 'A conta é sempre **(1 − SLO) × janela**: 30 dias têm 43.200 minutos, então 99,9% deixa 0,1% × 43.200 = 43,2 minutos. Cada nove divide o tempo por 10 — e com cinco noves, 26 segundos por mês não dão tempo nem de alguém abrir o laptop: só automação (failover, rollback automático) protege um alvo desses.',
      },
      {
        type: 'mcq',
        id: 'obs-slo-q3',
        concept: 'Burn rate',
        say: 'Agora uma conta de plantão, dessas que se faz de cabeça.',
        prompt: 'SLO: **99,9%** de sucesso em **30 dias**. Na última hora, a taxa de erro foi de **1,44%**. Qual é o burn rate, e quanto do error budget do período essa hora consumiu?',
        options: [
          { text: 'Burn rate 14,4; consumiu ~2% do orçamento', correct: true, why: '1,44% ÷ 0,1% = 14,4. Uma hora é 1/720 de 30 dias: 14,4 ÷ 720 = 2%. É exatamente o limiar do alerta de page mais rápido.' },
          { text: 'Burn rate 1,44; consumiu ~0,2% do orçamento', why: 'Isso trata a taxa de erro (em %) como se fosse o burn rate. O burn rate divide pelo erro **permitido** (0,1%), então 1,44% vira 14,4.' },
          { text: 'Burn rate 14,4; consumiu 14,4% do orçamento', why: 'O burn rate é uma **velocidade**, não o total gasto. Para saber o consumo, multiplique pela fração do período: 14,4 × 1 h ÷ 720 h = 2%.' },
          { text: 'Burn rate 0,0144; consumiu 1,44% do orçamento', why: '0,0144 é a taxa de erro em fração, não o burn rate. O burn rate compara com o ritmo "sustentável": 1 significa que o orçamento acaba exatamente no fim da janela.' },
        ],
        explanation: 'Guarde as duas fórmulas: **burn rate = taxa de erro ÷ (1 − SLO)** e **consumo = burn rate × janela ÷ período**. Com burn 14,4, o orçamento de 30 dias some em ~50 horas — por isso vale acordar alguém. Com burn 1, você gasta exatamente o que o SLO permite: não é incidente, é o combinado.',
      },
      {
        type: 'code',
        id: 'obs-slo-q4',
        concept: 'Alertas por burn rate',
        title: 'Error budget e alerta multi-janela',
        say: 'Agora o código por trás de um bom sistema de alertas. Relógio injetado: nada de tempo real aqui.',
        prompt: `As métricas chegam agregadas **por minuto**: \`serie\` é uma lista de tuplas \`(minuto, total, erros)\` em ordem crescente de minuto. O relógio é injetado: \`agora\` é o minuto atual.

Implemente:

1. \`orcamento_restante(total, ruins, slo)\` → fração do error budget que **resta**: \`1 − ruins ÷ (total × (1 − slo))\`. \`1.0\` = intacto, \`0\` = zerado, **negativo** = estourado. Sem tráfego (\`total == 0\`), devolva \`1.0\`.
2. \`burn_rate(serie, agora, janela, slo)\` → taxa de erro dos pontos com \`agora − janela < minuto ≤ agora\`, dividida por \`1 − slo\`. A taxa é **soma dos erros ÷ soma do total** da janela (não a média das taxas por minuto). Janela sem tráfego → \`0.0\`.
3. \`decidir_alerta(serie, agora, slo)\` → \`"page"\`, \`"ticket"\` ou \`None\`. Percorra a tabela \`REGRAS\` (já no código inicial) **em ordem**: uma regra dispara quando o burn rate atinge o limiar (\`>=\`) na janela longa **e** na curta. A primeira que disparar vence.`,
        starter: `# (limiar de burn rate, janela longa, janela curta, ação) — janelas em minutos
REGRAS = [
    (14.4, 60, 5, "page"),
    (6.0, 360, 30, "page"),
    (1.0, 3 * 24 * 60, 360, "ticket"),
]


def orcamento_restante(total, ruins, slo):
    """Fração do error budget que resta (1.0 intacto; negativo = estourado)."""
    pass


def burn_rate(serie, agora, janela, slo):
    """Taxa de erro em (agora - janela, agora] dividida por (1 - slo)."""
    pass


def decidir_alerta(serie, agora, slo):
    """'page', 'ticket' ou None, segundo REGRAS."""
    pass
`,
        tests: [
          { name: 'orçamento: 6.500 falhas de 10.000 permitidas → restam 35%', expr: 'orcamento_restante(10_000_000, 6_500, 0.999)', expected: '0.35', compare: 'approx' },
          { name: 'orçamento estourado fica negativo', expr: 'orcamento_restante(1_000_000, 1_500, 0.999)', expected: '-0.5', compare: 'approx' },
          { name: 'sem tráfego → orçamento intacto', expr: 'orcamento_restante(0, 0, 0.999)', expected: '1.0' },
          { name: 'burn rate usa a taxa ponderada pelo tráfego', expr: 'burn_rate([(1, 1000, 0), (2, 10, 5)], 2, 5, 0.99)', expected: '(5 / 1010) / (1 - 0.99)', compare: 'approx' },
          {
            name: 'a janela é (agora − janela, agora]',
            code: `serie = [(m, 100, 10 if m in (5, 11) else 0) for m in range(1, 12)]
b = burn_rate(serie, 10, 5, 0.9)
assert b == 0.0, f"com agora=10 e janela=5 entram só os minutos 6 a 10 (sem erros); veio {b}"
b = burn_rate(serie, 10, 6, 0.9)
esperado = (10 / 600) / (1 - 0.9)
assert abs(b - esperado) < 1e-9, f"com janela=6 o minuto 5 entra e o 11 (depois de agora) não; esperado {esperado}, veio {b}"`,
          },
          {
            name: 'janela sem tráfego → 0.0',
            code: `assert burn_rate([], 100, 60, 0.999) == 0.0, "série vazia deveria dar burn rate 0.0"
assert burn_rate([(1, 0, 0)], 1, 60, 0.999) == 0.0, "janela com total 0 deveria dar 0.0, sem ZeroDivisionError"`,
          },
          { name: 'incêndio: 2% de erro na última hora → page', setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA - 60, 2000, 1) + trecho(AGORA - 59, AGORA, 2000, 40), AGORA, 0.999)', expected: '"page"' },
          { name: 'vazamento: 0,8% de erro há 6 horas → page', setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA - 360, 2000, 1) + trecho(AGORA - 359, AGORA, 2000, 16), AGORA, 0.999)', expected: '"page"' },
          { name: 'queima lenta de 3 dias → ticket', setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA, 2000, 3), AGORA, 0.999)', expected: '"ticket"' },
          { name: 'pico já mitigado (últimos 10 min limpos) → None', setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA - 60, 2000, 1) + trecho(AGORA - 59, AGORA - 10, 2000, 60) + trecho(AGORA - 9, AGORA, 2000, 0), AGORA, 0.999)', expected: 'None' },
          { name: 'soluço de 5 minutos não acorda ninguém', hidden: true, setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA - 5, 2000, 1) + trecho(AGORA - 4, AGORA, 2000, 100), AGORA, 0.999)', expected: 'None' },
          { name: 'page tem prioridade sobre ticket', hidden: true, setup: CENARIOS, expr: 'decidir_alerta(trecho(1, AGORA - 60, 2000, 3) + trecho(AGORA - 59, AGORA, 2000, 40), AGORA, 0.999)', expected: '"page"' },
          { name: 'sem dados → None', hidden: true, setup: CENARIOS, expr: 'decidir_alerta([], AGORA, 0.999)', expected: 'None' },
        ],
        reviews: [
          {
            when: (m, code) => /14\.4|\b360\b|4320/.test(code.replace(/REGRAS\s*=\s*\[[\s\S]*?\n\]/, '')),
            text: 'Os limiares ou janelas aparecem repetidos no código, fora da tabela `REGRAS`. Deixe a política **dirigida por dados**: percorra `REGRAS`, e mudar um limiar vira a edição de uma linha (ou de um arquivo de configuração), sem risco de as duas cópias divergirem.',
            concept: 'Configuração dirigida por dados',
          },
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'Não leia o relógio de verdade: `agora` é injetado para que o mesmo código rode em testes, em *backtesting* de alertas com dados históricos e em produção.',
            concept: 'Relógio injetado',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função acumulou decisões demais. Separe responsabilidades: `burn_rate` só mede uma janela; `decidir_alerta` só percorre as regras e combina duas medições.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Em `orcamento_restante`, trate `total == 0` primeiro; depois `permitidos = total * (1 - slo)` e `return 1 - ruins / permitidos`.',
          'Em `burn_rate`, some `total` e `erros` só dos pontos com `agora - janela < minuto <= agora` e divida **uma vez** no fim: `(erros / total) / (1 - slo)`. Se o total da janela for 0, devolva `0.0`.',
          'Em `decidir_alerta`: `for limiar, longa, curta, acao in REGRAS:` — se `burn_rate(..., longa, ...) >= limiar and burn_rate(..., curta, ...) >= limiar`, devolva `acao`. Depois do laço, `return None`.',
        ],
        solution: `# (limiar de burn rate, janela longa, janela curta, ação) — janelas em minutos
REGRAS = [
    (14.4, 60, 5, "page"),
    (6.0, 360, 30, "page"),
    (1.0, 3 * 24 * 60, 360, "ticket"),
]


def orcamento_restante(total, ruins, slo):
    """Fração do error budget que resta (1.0 intacto; negativo = estourado)."""
    if total == 0:
        return 1.0
    permitidos = total * (1 - slo)
    return 1 - ruins / permitidos


def burn_rate(serie, agora, janela, slo):
    """Taxa de erro em (agora - janela, agora] dividida por (1 - slo)."""
    total = erros = 0
    for minuto, n, e in serie:
        if agora - janela < minuto <= agora:
            total += n
            erros += e
    if total == 0:
        return 0.0
    return (erros / total) / (1 - slo)


def decidir_alerta(serie, agora, slo):
    """'page', 'ticket' ou None, segundo REGRAS."""
    for limiar, longa, curta, acao in REGRAS:
        if (burn_rate(serie, agora, longa, slo) >= limiar
                and burn_rate(serie, agora, curta, slo) >= limiar):
            return acao
    return None
`,
        solutionExplanation: 'Três ideias de SRE em 30 linhas. **(1)** O orçamento é relativo ao tráfego: 1.500 falhas são meio orçamento estourado com 1 milhão de requisições e quase nada com 100 milhões. **(2)** A taxa da janela é **soma dos erros ÷ soma das requisições** — a média das taxas por minuto faria um minuto de madrugada com 10 requisições pesar tanto quanto um minuto de pico com 10.000. É também por isso que SLIs em forma de proporção somam bem entre janelas e réplicas. **(3)** A política vive numa **tabela** avaliada em ordem: a janela longa filtra soluços (o teste do pico de 5 minutos), a curta faz o alerta se desligar poucos minutos depois da mitigação (o teste do pico já resolvido). Como o relógio é injetado, o mesmo código serve para *backtesting*: rode `decidir_alerta` sobre os incidentes do último trimestre e veja quais regras teriam disparado — e quantos falsos alarmes gerariam — antes de ligá-las em produção. Na vida real, isso vira *recording rules* e regras de alerta no Prometheus sobre contadores, sem percorrer a série a cada avaliação. (Com `slo = 1.0` as divisões explodem — coerente: um SLO de 100% não tem orçamento nenhum.)',
      },
      {
        type: 'open',
        id: 'obs-slo-q5',
        concept: 'Error budget',
        say: 'Para fechar: uma conversa que todo SRE já teve com alguém da diretoria.',
        prompt: 'A diretora de produto diz: *"O checkout é crítico. Quero **100% de disponibilidade** — nenhum deploy pode derrubar nada."* Como você responderia, e o que proporia no lugar?',
        rubric: [
          { label: 'Explica que o usuário não perceberia a diferença', keywords: ['nao percebe', 'nao perceb', 'nao nota', 'imperceptivel', 'celular', 'wi-fi', 'wifi', 'operadora', 'internet do usuario', 'rede do usuario', 'nao faz diferenca', 'nao ve diferenca'], concept: '100% é o alvo errado', why: 'Acima de certo ponto, a rede, o aparelho e as dependências do usuário falham mais que você: a diferença entre 99,99% e 100% é invisível para ele.' },
          { label: 'Cita o custo crescente de cada nove', keywords: ['custo', 'caro', 'exponencial', 'cada nove', 'redundancia', 'investimento'], concept: 'Noves', why: 'Cada nove adicional costuma custar uma ordem de grandeza a mais em redundância, automação e pessoas.' },
          { label: 'Explica que orçamento zero impede mudanças', keywords: ['error budget', 'orcamento', ['nenhum', 'deploy'], ['nunca', 'deploy'], ['sem', 'deploy'], 'congela', 'inovacao', 'nao mudar', 'mudanca zero'], concept: 'Error budget', why: 'Todo deploy tem risco. Sem orçamento para falhar, a única atitude racional é não mudar nada — o oposto do que o produto quer.' },
          { label: 'Propõe um SLO realista com política de error budget', keywords: ['politica', '99,9', '99.9', 'slo de', 'burn rate', 'historico', 'janela'], concept: 'Política de error budget', why: 'A alternativa madura é um SLO baseado em dados do usuário, com uma política acordada que diz o que fazer quando o orçamento acaba.' },
        ],
        minWords: 40,
        modelAnswer: 'Eu diria que 100% é o alvo errado, por três motivos. Primeiro, o usuário **não percebe** a diferença entre 99,95% e 100%: o Wi-Fi, a operadora e o celular dele falham muito mais do que isso. Segundo, o **custo** cresce exponencialmente a cada nove — mais redundância, mais regiões, mais gente de plantão. Terceiro, todo deploy tem risco: com meta de 100% o **error budget** é zero, e a única atitude racional seria **nunca fazer deploy**, o que congela a inovação — o contrário do que o produto quer. No lugar, eu proporia um **SLO** baseado no histórico e no que deixa os clientes satisfeitos — por exemplo, 99,95% das requisições do checkout com sucesso em menos de 1 s, numa janela móvel de 28 dias —, alertas por **burn rate** e uma **política de error budget** assinada por produto e engenharia: com orçamento sobrando, lançamos com segurança (canary, feature flags); se ele acabar, congelamos features e investimos em confiabilidade até recuperar.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você fala a língua do SRE: SLI, SLO, error budget e burn rate.',
          { text: 'Lembre: confiabilidade é uma feature com orçamento — gaste com sabedoria e alerte pelo que o usuário sente.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
