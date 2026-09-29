(function () {
  // Prelúdio dos testes: série sintética de um ponto (minuto, total, erros) por minuto.
  const SERIE = `def trecho(inicio, fim, total, erros):
    return [(m, total, erros) for m in range(inicio, fim + 1)]

# 13h00 (minuto 780) às 15h00 (minuto 900): 0,2% de erro, com um pico de 3% das 13h55 às 14h29
SERIE = trecho(780, 834, 1000, 2) + trecho(835, 869, 1000, 30) + trecho(870, 900, 1000, 2)
`;

  Game.registerModule('observability', {
    id: 'entrevista-sre',
    title: 'Entrevista: SRE',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'Um incidente ao vivo: o p99 do checkout dispara depois de um deploy. Priorize as ações, leia os sinais do painel, escreva o código que correlaciona mudanças e picos de erro — e defina os SLOs que deveriam ter avisado antes.',
    concepts: ['Resposta a incidentes', 'Diagnóstico por sinais', 'Lei de Little', 'Correlação de mudanças', 'SLOs'],
    takeaways: [
      'Em incidente, a ordem é **reconhecer → dimensionar e declarar → perguntar o que mudou → mitigar → confirmar → investigar**. Se o problema coincide com um deploy, desfaça o deploy — a causa raiz pode esperar.',
      'Leia os sinais **por dimensão** (versão, pod, região): se só os pods da versão nova sofrem, o problema está na mudança. **CPU baixa com latência alta** significa espera — por I/O, lock ou pool.',
      '**Lei de Little**: conexões em uso = taxa × tempo de posse. Segurar a conexão do banco durante uma chamada externa multiplica o tempo de posse — e nenhum pool maior resolve isso.',
      '**Correlação de mudanças**: cruze picos de erro com deploys, flags e configuração numa janela antes do início. Correlação não é causalidade, mas é o melhor ponto de partida — cerca de 70% das indisponibilidades vêm de mudanças.',
      'Troque alertas de limiar fixo por **SLOs**: SLIs em forma de proporção (sucesso e latência abaixo de um limiar), alvo e janela explícitos, alertas por **burn rate** e uma política de error budget.',
    ],
    glossary: [
      { term: 'Pool de conexões', aliases: ['pools de conexões', 'pool de conexoes', 'connection pool', 'connection pools'], definition: 'Conjunto de conexões com o banco abertas previamente e reaproveitadas pelas requisições. Quando todas estão em uso, as novas requisições **esperam na fila** até uma ser devolvida — ou estouram o timeout de aquisição.' },
      { term: 'Correlação de mudanças', aliases: ['change correlation', 'correlacao de mudancas'], definition: 'Técnica de diagnóstico que cruza o início de uma anomalia com as **mudanças** recentes (deploys, feature flags, configuração, infraestrutura) para levantar os primeiros suspeitos. Aponta onde olhar; não prova a causa.' },
      { term: 'Runbook', aliases: ['runbooks', 'playbook', 'playbooks'], definition: 'Documento ligado a um alerta com o passo a passo de diagnóstico e mitigação: o que olhar, quais comandos rodar, quando escalar e para quem. Bons runbooks encurtam o tempo até mitigar e são testados em game days.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Olá! Hoje eu sou sua **entrevistadora** para a vaga de SRE. Nada de teoria solta: vamos simular um plantão.',
          'Não existe resposta perfeita. Quero ver **prioridades**, leitura de sinais e como você pensa sob pressão.',
        ],
        board: {
          title: '📋 O cenário',
          md: `**Terça-feira, 14h02.** Você está de plantão no serviço **pedidos**, que atende o checkout de uma loja on-line.

- **Page:** \`checkout: p99 > 1 s por 5 minutos\` (hoje o alerta é um limiar fixo).
- 20 pods, cada um com um **pool de 10 conexões** com o banco PostgreSQL.
- Mudanças recentes, pelo log de deploys:

| Horário | Mudança |
|---|---|
| 11h15 | flag \`recomendacoes-v2\` ligada para 100% |
| 13h30 | canary da **v2.31** em 5% (1 pod) |
| 13h50 | canary da v2.31 promovido para **25%** (5 pods) pela análise automática |

A v2.31 traz uma novidade: antes de gravar o pedido, o checkout chama o serviço de **antifraude**.

> [!dica] Roteiro da entrevista: **priorizar as ações → ler os sinais → um follow-up de capacidade → código de diagnóstico → SLOs**. Pense em voz alta: numa entrevista de SRE, o raciocínio vale mais do que a resposta.`,
        },
      },
      {
        type: 'order',
        id: 'obs-ent-q1',
        concept: 'Resposta a incidentes',
        say: 'Primeira pergunta: o page acabou de tocar. Em que ordem você age?',
        prompt: 'Coloque em ordem as ações do plantão, do page à investigação.',
        items: [
          'Reconhecer o page, para parar o escalonamento',
          'Confirmar o impacto nos SLIs do checkout e declarar o incidente com severidade',
          'Perguntar "o que mudou?": deploys, flags e configuração recentes',
          'Fazer rollback da v2.31 (zerar o peso do canary)',
          'Confirmar nas métricas que p99 e erros voltaram ao normal',
          'Investigar a causa raiz com calma e agendar o postmortem',
        ],
        explanation: 'É o ciclo **detectar → triar → mitigar → confirmar → resolver**. Reconhecer primeiro evita que o page escale para mais gente à toa; dimensionar o impacto define a severidade (e se é preciso chamar reforço). A pergunta "o que mudou?" aponta a mitigação mais barata — aqui, zerar um canary que começou a crescer 12 minutos antes do alerta. E só depois de **confirmar** nos gráficos que o usuário parou de sofrer é que a investigação da causa raiz ganha prioridade. Candidatos fortes também falam de **comunicação** em paralelo: status page e suporte avisados desde a declaração.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Ótimo. Agora vamos voltar um pouco: antes do rollback, você abriu o painel e separou os pods **por versão**.',
          'Isto é o que você viu. O que esses números te dizem?',
        ],
        board: {
          title: 'O painel às 14h05',
          md: `| Sinal | 13h40 (tudo v2.30) | 14h05 — pods v2.30 | 14h05 — pods **v2.31** |
|---|---|---|---|
| Requisições/s por pod | 60 | 60 | 60 |
| Erros 5xx | 0,2% | 0,2% | **11%** (\`503: timeout ao obter conexão\`) |
| p50 | 45 ms | 45 ms | **1.400 ms** |
| p99 | 280 ms | 280 ms | **2.300 ms** |
| CPU do pod | 35% | 35% | **12%** |
| Conexões do pool em uso | 1 de 10 | 1 de 10 | **10 de 10** |
| Espera por conexão (p99) | 1 ms | 1 ms | **2.000 ms** (= timeout) |
| Chamadas ao antifraude | — | — | 15/s, p99 900 ms |

**Visão global:** 1.210 req/s (antes: 1.200) · p50 58 ms · p99 2.100 ms · 2,9% de erros · CPU do banco 38% (antes: 40%).

> [!dica] Quebrar os sinais por uma **dimensão** — versão, pod, região, cliente — é a forma mais rápida de isolar um problema. Na visão global, o p50 quase não mudou e esconde que um quarto dos pods está em colapso.

> [!sabia] **CPU baixa com latência alta** é uma das pistas mais valiosas do plantão: o processo não está trabalhando, está **esperando** — por I/O, por um lock, por uma conexão. Aumentar CPU ou pods nesse cenário não ajuda. É o que o método **USE** (*Utilization, Saturation, Errors*, de Brendan Gregg) ensina a procurar: qual recurso está **saturado**? Aqui, a resposta está na linha do pool.`,
        },
      },
      {
        type: 'mcq',
        id: 'obs-ent-q2',
        concept: 'Diagnóstico por sinais',
        say: 'Qual é a sua hipótese principal?',
        prompt: 'Com base no painel, qual hipótese é a **mais bem apoiada** pelos sinais?',
        options: [
          { text: 'A v2.31 segura a conexão do banco enquanto espera o antifraude; o pool dos pods novos satura e as requisições fazem fila por conexão até o timeout', correct: true, why: 'Tudo se encaixa: só os pods v2.31 sofrem, o pool está em 10 de 10, a espera por conexão bate no timeout (e vira `503`), a CPU **caiu** (threads esperando) e há uma chamada nova de 900 ms no caminho.' },
          { text: 'O banco de dados está sobrecarregado e precisa de mais réplicas', why: 'A CPU do banco está estável (38%) e os pods v2.30, que usam o **mesmo** banco, seguem com p99 de 280 ms. O gargalo está antes do banco: na fila por uma conexão.' },
          { text: 'Houve um pico de tráfego no checkout', why: 'As requisições por pod não mudaram (60/s) e o total subiu menos de 1%. Um pico de tráfego também afetaria as duas versões, não só a nova.' },
          { text: 'Os pods v2.31 estão sem CPU; é preciso dar mais CPU a eles', why: 'A CPU **caiu** de 35% para 12%. Latência alta com CPU baixa significa espera, não falta de processamento — mais CPU ficaria ociosa.' },
        ],
        explanation: 'O raciocínio de um bom diagnóstico é **eliminar hipóteses com os dados**: tráfego (estável), banco (estável e saudável para a v2.30), CPU (caiu). O que sobra é **saturação** de um recurso exclusivo dos pods novos: o pool de conexões, ocupado por requisições que chamam o antifraude **dentro da transação**. A correção de verdade (depois do rollback) é tirar a chamada externa de dentro da transação — chamar o antifraude antes de pegar a conexão —, com timeout curto e fallback.',
      },
      {
        type: 'mcq',
        id: 'obs-ent-q3',
        concept: 'Lei de Little',
        say: 'Follow-up de capacidade. Um colega aparece com uma sugestão bem comum.',
        prompt: 'Enquanto você prepara o rollback, um colega propõe: *"Vamos dobrar o pool de 10 para 20 conexões por pod e subir de 20 para 40 pods. Mais conexões, menos fila."* O que você responde?',
        options: [
          { text: 'Não ataca a causa e pode piorar: pela Lei de Little, conexões em uso = taxa × tempo de posse, e o problema é o tempo de posse (~0,9 s do antifraude dentro da transação). Mais pods e pools maiores multiplicam as conexões no banco, que tem limite e custo por conexão. Rollback primeiro.', correct: true, why: 'Cada pod v2.31 recebe 15 checkouts/s × 0,9 s ≈ **13,5 conexões** só para o checkout — mais que o pool de 10. A demanda cresce com o tráfego e com qualquer lentidão do antifraude; e 40 pods × 20 = 800 conexões podem estourar o `max_connections` do PostgreSQL, derrubando também a v2.30.' },
          { text: 'Boa ideia: escalar horizontalmente é a mitigação padrão para latência alta', why: 'Escalar ajuda quando o gargalo é **processamento**. Aqui os pods estão ociosos (CPU em 12%) esperando conexão; mais pods com o mesmo defeito só criam mais filas — e mais conexões no banco.' },
          { text: 'Só aumentar o pool para 20, sem mexer nos pods, resolve de vez', why: 'Talvez alivie hoje (13,5 < 20), mas é uma mudança de configuração sob pressão que esconde o defeito: com 100% dos pods na v2.31, mais tráfego ou um antifraude mais lento, o pool satura de novo. E conexões presas esperando uma API externa são desperdício no banco.' },
          { text: 'Reiniciar os pods v2.31 libera as conexões presas e resolve', why: 'Libera por segundos: com o mesmo tráfego e o mesmo tempo de posse, o pool volta a 10 de 10 quase na hora. Reiniciar só apaga as evidências.' },
        ],
        explanation: 'A **Lei de Little** (L = λ × W) dimensiona qualquer fila: itens no sistema = taxa de chegada × tempo de permanência. Antes da v2.31: 60 req/s × 12 ms ≈ **0,7 conexão** por pod. Depois: só os 15 checkouts/s × 0,9 s já pedem ~13,5 — a posse ficou 75 vezes mais longa. Quando W explode, aumentar a capacidade (L) é correr atrás do próprio rabo; a correção é **reduzir W**: nada de chamadas externas com a conexão aberta.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bom. Agora quero ver código. Este painel foi montado à mão, no susto — e se o sistema já apontasse os suspeitos sozinho?',
          'O primeiro passo é cruzar os **picos de erro** com o **log de mudanças**.',
        ],
        board: {
          title: 'Correlação de mudanças',
          md: `\`\`\`text
 taxa de erro
  3% ┤                ┌─────────────────────┐
     │                │  pico: minutos      │
     │                │  835 a 869          │
0,2% ┼────────────────┘                     └──────────► minuto
                  ▲    ▲
          v2.31 (830)  config-pool (842)
\`\`\`

| Mudança | Minuto | Em relação ao pico (835–869), janela de 15 min | Suspeita? |
|---|---|---|---|
| v2.30 | 700 | 135 min antes — fora da janela | não |
| **v2.31** | 830 | 5 min antes — dentro da janela | **sim, a principal** |
| config-pool | 842 | **depois** do início | não pode ter causado o pico |

Para cada pico, os suspeitos são as mudanças que aconteceram **pouco antes** do início, dentro de uma janela. A mais recente é a principal suspeita.

Cuidados de quem já fez isso de verdade:

- **correlação não é causalidade**: um deploy às 13h50 e um pico às 13h55 podem ser coincidência — e a causa pode ser uma mudança **de outro time** numa dependência;
- **relógios diferentes**: o log de deploys e o de métricas podem ter segundos ou minutos de diferença (*clock skew*); use uma janela com folga;
- **toda mudança conta**: deploys, flags, configuração, infraestrutura, dados — se só os deploys entram no log, o suspeito certo nunca aparece.

> [!sabia] Por volta de 2010, a **Etsy** popularizou um hábito simples: desenhar uma **linha vertical em todo gráfico** a cada deploy. Com dezenas de deploys por dia, bastava olhar um gráfico para ver se uma mudança de comportamento começou junto com uma linha. Hoje isso se chama *annotations* no Grafana e no Datadog — e continua sendo uma das ferramentas de diagnóstico mais baratas que existem.`,
        },
      },
      {
        type: 'code',
        id: 'obs-ent-q4',
        concept: 'Correlação de mudanças',
        title: 'Picos de erro × deploys',
        say: 'Implemente as duas funções. A série pode chegar fora de ordem — ela vem de vários coletores.',
        prompt: `A série de métricas é uma lista de tuplas \`(minuto, total, erros)\`, **não necessariamente em ordem**. Os deploys são tuplas \`(minuto, versao)\`, também em qualquer ordem.

1. \`picos(serie, limiar, min_duracao=1)\` → lista de \`(inicio, fim)\` (fim **inclusive**), em ordem, com os trechos de minutos **consecutivos** em que a taxa \`erros ÷ total\` é **maior ou igual** ao \`limiar\`.
   - minuto **sem tráfego** (\`total == 0\`) não é pico;
   - um minuto **ausente** da série quebra o trecho;
   - descarte trechos com menos de \`min_duracao\` minutos.
2. \`correlacionar(serie, deploys, limiar, janela=15, min_duracao=1)\` → para cada pico, \`(inicio, fim, versao)\`, em que \`versao\` é o deploy **mais recente** com \`inicio − janela <= minuto <= inicio\` — ou \`None\` se não houver. Um deploy **depois** do início não pode ter causado o pico.`,
        starter: `def picos(serie, limiar, min_duracao=1):
    """[(inicio, fim)] de minutos consecutivos com taxa de erro >= limiar."""
    pass


def correlacionar(serie, deploys, limiar, janela=15, min_duracao=1):
    """[(inicio, fim, versao ou None)] para cada pico."""
    pass
`,
        tests: [
          { name: 'um pico simples', setup: SERIE, expr: 'picos(trecho(1, 5, 100, 0) + trecho(6, 8, 100, 5) + trecho(9, 12, 100, 0), 0.05)', expected: '[(6, 8)]' },
          { name: 'minutos consecutivos se juntam; um minuto bom separa', expr: 'picos([(1, 10, 0), (2, 10, 5), (3, 10, 5), (4, 10, 0), (5, 10, 9)], 0.1)', expected: '[(2, 3), (5, 5)]' },
          { name: 'minuto sem tráfego não é pico (e não divide por zero)', expr: 'picos([(1, 0, 0), (2, 10, 5)], 0.1)', expected: '[(2, 2)]' },
          { name: 'minuto ausente quebra o trecho', expr: 'picos([(1, 10, 5), (2, 10, 5), (4, 10, 5)], 0.1)', expected: '[(1, 2), (4, 4)]' },
          { name: 'série fora de ordem', expr: 'picos([(3, 10, 5), (1, 10, 5), (2, 10, 5)], 0.1)', expected: '[(1, 3)]' },
          { name: 'min_duracao descarta soluços', setup: SERIE, expr: 'picos(trecho(1, 1, 100, 50) + trecho(2, 5, 100, 0) + trecho(6, 9, 100, 50), 0.1, min_duracao=3)', expected: '[(6, 9)]' },
          { name: 'o incidente: a v2.31 é a suspeita, não a config posterior', setup: SERIE, expr: 'correlacionar(SERIE, [(842, "config-pool"), (700, "v2.30"), (830, "v2.31")], 0.01)', expected: '[(835, 869, "v2.31")]' },
          { name: 'deploy no minuto exato do início conta', setup: SERIE, expr: 'correlacionar(SERIE, [(835, "v9")], 0.01)', expected: '[(835, 869, "v9")]' },
          { name: 'deploy fora da janela → None', setup: SERIE, expr: 'correlacionar(SERIE, [(810, "v2.31")], 0.01, janela=15)', expected: '[(835, 869, None)]' },
          {
            name: 'vários picos, cada um com o seu suspeito',
            hidden: true,
            setup: SERIE,
            code: `serie = trecho(1, 20, 100, 0) + trecho(21, 25, 100, 20) + trecho(26, 60, 100, 0) + trecho(61, 62, 100, 30) + trecho(63, 80, 100, 0)
deploys = [(58, "v3"), (10, "v1"), (18, "v2"), (5, "v0")]
r = correlacionar(serie, deploys, 0.1, janela=10)
assert r == [(21, 25, "v2"), (61, 62, "v3")], f"esperado [(21, 25, 'v2'), (61, 62, 'v3')], veio {r}"`,
          },
          { name: 'sem deploys → None em todos os picos', hidden: true, setup: SERIE, expr: 'correlacionar(SERIE, [], 0.01)', expected: '[(835, 869, None)]' },
          { name: 'min_duracao também vale na correlação', hidden: true, setup: SERIE, expr: 'correlacionar(trecho(1, 1, 100, 50) + trecho(2, 30, 100, 0), [(1, "v1")], 0.1, min_duracao=2)', expected: '[]' },
          { name: 'limiar é inclusivo', hidden: true, expr: 'picos([(1, 100, 5), (2, 100, 4)], 0.05)', expected: '[(1, 1)]' },
        ],
        reviews: [
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'O diagnóstico não deve depender do relógio real: os minutos já vêm na série e no log de deploys. Assim a mesma função roda em testes, sobre incidentes antigos e em produção.',
            concept: 'Relógio injetado',
          },
          {
            when: m => m.maxComplexity > 10,
            text: 'Alguma função ficou com decisões demais. Deixe `picos` só encontrar os trechos e `correlacionar` só escolher o suspeito de cada um — e reaproveite `picos` em vez de reimplementá-la.',
            concept: 'Funções pequenas',
          },
          {
            when: m => !m.calls.includes('sorted') && !m.calls.includes('sort'),
            text: 'A série pode chegar fora de ordem (vários coletores) — ordene por minuto antes de procurar trechos consecutivos.',
            concept: 'Dados fora de ordem',
          },
        ],
        hints: [
          'Em `picos`, percorra `sorted(serie)` e pule os minutos com `total == 0` ou `erros / total < limiar`. Para os demais: se o último trecho termina em `minuto - 1`, estenda-o; senão, abra um trecho novo `(minuto, minuto)`.',
          'No fim de `picos`, filtre: `[(i, f) for i, f in trechos if f - i + 1 >= min_duracao]`.',
          'Em `correlacionar`, para cada `(inicio, fim)` de `picos(...)`, junte os deploys com `inicio - janela <= minuto <= inicio` e pegue o de maior minuto: `max(candidatos, key=lambda d: d[0])[1]` — ou `None` se a lista estiver vazia.',
        ],
        solution: `def picos(serie, limiar, min_duracao=1):
    """[(inicio, fim)] de minutos consecutivos com taxa de erro >= limiar."""
    trechos = []
    for minuto, total, erros in sorted(serie):
        if total == 0 or erros / total < limiar:
            continue
        if trechos and trechos[-1][1] == minuto - 1:
            trechos[-1] = (trechos[-1][0], minuto)
        else:
            trechos.append((minuto, minuto))
    return [(i, f) for i, f in trechos if f - i + 1 >= min_duracao]


def correlacionar(serie, deploys, limiar, janela=15, min_duracao=1):
    """[(inicio, fim, versao ou None)] para cada pico."""
    resultado = []
    for inicio, fim in picos(serie, limiar, min_duracao):
        candidatos = [(m, v) for m, v in deploys if inicio - janela <= m <= inicio]
        suspeito = max(candidatos, key=lambda d: d[0])[1] if candidatos else None
        resultado.append((inicio, fim, suspeito))
    return resultado
`,
        solutionExplanation: 'Dois detalhes separam a solução correta da quase correta. Em `picos`, comparar com `minuto - 1` (em vez de "o minuto anterior da lista") faz tanto um minuto bom quanto um minuto **ausente** quebrarem o trecho — um buraco na série não pode virar parte de um pico. E ordenar a série antes é obrigatório quando os pontos vêm de vários coletores. Em `correlacionar`, a janela é **assimétrica**: só mudanças até o início do pico são suspeitas, e a mais recente vem primeiro. Numa entrevista, os follow-ups esperados são: (1) **escala** — com milhares de deploys, ordene-os uma vez e use `bisect` para achar a janela em O(log n) por pico; (2) **mais dimensões** — correlacionar por serviço e região, e incluir flags e configuração no mesmo log de mudanças; (3) **honestidade estatística** — isto levanta suspeitos, não culpados: a confirmação vem de desfazer a mudança e ver a métrica voltar, ou de comparar as versões lado a lado, como no painel.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Última etapa. O incidente acabou, o postmortem está marcado — e a diretora pergunta por que o alerta de "p99 > 1 s" só tocou 12 minutos depois do problema começar.',
          'Ela quer **SLOs** de verdade para o checkout. Proponha.',
        ],
        board: {
          title: 'De limiares fixos para SLOs',
          md: `O alerta atual: \`p99 > 1 s por 5 minutos\`.

| Problema | Consequência |
|---|---|
| limiar escolhido "no olho" | não diz quanto sofrimento é aceitável |
| p99 de toda a frota | 25% dos pods em colapso aparecem tarde e diluídos |
| sem janela de orçamento | não diferencia 5 minutos ruins de uma semana ruim |
| sem ligação com decisões | ninguém sabe quando congelar deploys |

Lembre dos ingredientes: **SLI** (proporção de eventos bons ÷ válidos), **SLO** (alvo numa janela), **error budget** (1 − SLO), alertas por **burn rate** em múltiplas janelas e uma **política** combinada antes do próximo incidente.

> [!dica] Latência vira SLI com um **limiar**: "proporção de requisições do checkout respondidas em menos de 500 ms". Contagens somam entre pods e janelas; percentis, não.`,
        },
      },
      {
        type: 'open',
        id: 'obs-ent-q5',
        concept: 'SLOs',
        say: 'Sua proposta de SLOs para o checkout — com alvo, janela e alertas.',
        prompt: 'Defina os **SLOs do checkout** para substituir o alerta de limiar fixo: quais SLIs (e onde medi-los), quais alvos e janela, e como alertar e agir quando o error budget estiver acabando.',
        rubric: [
          { label: 'SLI como proporção de eventos bons, do ponto de vista do usuário', keywords: ['proporcao', 'eventos bons', 'eventos validos', 'bem-sucedid', 'bem sucedid', 'sem 5xx', 'nao 5xx', 'nao-5xx', 'sucesso'], concept: 'SLI', why: 'Um SLI de disponibilidade mede a proporção de requisições válidas atendidas com sucesso, perto do usuário (load balancer ou cliente).' },
          { label: 'Latência com limiar (ou percentil), não média', keywords: ['limiar', 'menos de 500', 'menos de 300', 'menos de 1 s', 'abaixo de', 'p99', 'p95', 'percentil', 'threshold'], concept: 'SLI de latência', why: 'Latência entra no SLO como proporção abaixo de um limiar — o que o incidente mostrou é que a cauda, e não a média, é o que o usuário sente.' },
          { label: 'Alvo e janela explícitos', keywords: ['99,9', '99.9', '99,5', '99.5', '99,95', '99.95', '99%', '28 dias', '30 dias', 'janela movel', 'janela de'], concept: 'SLO', why: 'Um SLO precisa de alvo **e** janela (ex.: 99,9% em 28 dias móveis), escolhidos pelo histórico e pelo que deixa o usuário satisfeito.' },
          { label: 'Error budget, alertas por burn rate e política', keywords: ['error budget', 'orcamento de erro', 'burn rate', 'multi-janela', 'multijanela', 'politica'], concept: 'Error budget', why: 'Alertas por burn rate em duas janelas dão precisão e detecção rápida; a política de error budget diz o que acontece quando ele acaba (congelar features, investir em confiabilidade).' },
        ],
        minWords: 50,
        modelAnswer: 'Eu definiria dois SLIs medidos no load balancer, na forma **eventos bons ÷ eventos válidos**. **Disponibilidade:** proporção das requisições do checkout que terminam sem 5xx (os 4xx causados pelo cliente ficam fora do denominador). **Latência:** proporção das requisições respondidas em **menos de 500 ms** — um limiar, e não a média, porque foi a cauda que doeu neste incidente. Alvos, a partir do histórico: **99,9%** de disponibilidade e **99%** abaixo de 500 ms, numa **janela móvel de 28 dias**. Isso dá um **error budget** de 0,1% e de 1% das requisições. Os alertas seriam por **burn rate** em múltiplas janelas: 14,4× em 1 h e em 5 min, ou 6× em 6 h e em 30 min, geram page; 1× em 3 dias gera ticket. Como a latência é contada por requisição, 25% dos pods lentos queimariam o orçamento de latência a ~25× e disparariam o page em poucos minutos. Por fim, uma **política** de error budget assinada por produto e engenharia: orçamento esgotado congela features e prioriza confiabilidade — e todo deploy passa por canary com análise de erros **e** de latência.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Fim da entrevista! Você mitigou antes de investigar, leu os sinais por versão, usou a Lei de Little para barrar uma "solução" perigosa, automatizou a correlação de mudanças e propôs SLOs de verdade.',
          { text: 'É exatamente o que um time de SRE quer ver. Parabéns — pode ficar com o pager.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
