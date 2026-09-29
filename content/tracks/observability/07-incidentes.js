(function () {
  // Prelúdio dos testes: eventos de incidentes vindos de fontes diferentes (alertas, pager, chat), fora de ordem.
  const EVENTOS = `EVENTOS = [
    {"incidente": "INC-1", "tipo": "resolvido", "ts": 190},
    {"incidente": "INC-2", "tipo": "inicio", "ts": 500},
    {"incidente": "INC-1", "tipo": "inicio", "ts": 100},
    {"incidente": "INC-1", "tipo": "reconhecido", "ts": 110},
    {"incidente": "INC-1", "tipo": "detectado", "ts": 106},
    {"incidente": "INC-2", "tipo": "detectado", "ts": 520},
    {"incidente": "INC-1", "tipo": "detectado", "ts": 108},
    {"incidente": "INC-2", "tipo": "reconhecido", "ts": 522},
    {"incidente": "INC-1", "tipo": "mitigado", "ts": 130},
    {"incidente": "INC-2", "tipo": "comentario", "ts": 530},
    {"incidente": "INC-2", "tipo": "mitigado", "ts": 540},
    {"incidente": "INC-2", "tipo": "resolvido", "ts": 560},
]
`;

  Game.registerModule('observability', {
    id: 'incidentes',
    title: 'Gestão de incidentes e postmortems',
    kind: 'lesson',
    level: 2,
    order: 21,
    unit: 'operacao',
    summary: 'Quando tudo quebra: detectar, triar, mitigar primeiro e só depois resolver — com um incident commander, severidades claras, postmortems sem culpados e experimentos de caos para quebrar as coisas antes que elas quebrem sozinhas.',
    concepts: ['Ciclo do incidente', 'Incident commander', 'Postmortem blameless', '5 porquês', 'Chaos engineering'],
    takeaways: [
      'O ciclo é **detectar → triar → mitigar → resolver → aprender**. Mitigar vem **antes** de entender: rollback, desligar uma flag ou drenar uma região param o sofrimento do usuário; a causa raiz pode esperar.',
      'O **incident commander** coordena e **não** debuga: define a severidade, distribui papéis (operações, comunicação, registro) e decide. Declare cedo — rebaixar a severidade é barato.',
      'Severidade mede o **impacto no usuário**, não a dificuldade técnica. MTTD, MTTA e MTTR ajudam a ver tendências, mas durações de incidentes têm cauda longa: olhe a **mediana** e os casos, não só a média.',
      'Postmortem **blameless** pergunta "o que no sistema permitiu o erro?", não "quem errou?". Os **5 porquês** são um ponto de partida: em sistemas complexos há vários **fatores contribuintes**, não uma causa raiz única.',
      '**Chaos engineering** e **game days** provocam falhas de propósito, com hipótese e raio de impacto controlados, para treinar pessoas e achar fragilidades antes do incidente real.',
    ],
    glossary: [
      { term: 'Incident commander', aliases: ['incident commanders', 'comandante do incidente', 'comandante de incidente'], definition: 'Pessoa que **coordena** a resposta a um incidente: define a severidade, distribui os papéis, mantém o foco na mitigação e toma decisões. Não mexe no teclado — delega a investigação para enxergar o todo.' },
      { term: 'Postmortem', aliases: ['postmortems', 'post-mortem', 'post-mortems', 'postmortem blameless', 'blameless'], definition: 'Documento escrito depois de um incidente com impacto, linha do tempo, fatores contribuintes e ações com dono e prazo. **Blameless** significa buscar as condições do sistema que permitiram a falha, em vez de culpados.' },
      { term: '5 porquês', aliases: ['cinco porquês', 'cinco porques', '5 porques', '5 whys', 'five whys'], definition: 'Técnica criada na Toyota: perguntar "por quê?" repetidamente, a partir do sintoma, até chegar a algo que se possa corrigir. Útil para começar, mas produz uma cadeia **linear** e tende a parar numa pessoa.' },
      { term: 'Chaos engineering', aliases: ['engenharia do caos', 'engenharia de caos', 'chaos monkey'], definition: 'Disciplina de fazer **experimentos controlados** em produção — derrubar instâncias, injetar latência, cortar dependências — com uma hipótese sobre o estado estável, para descobrir fraquezas antes que elas virem incidentes.' },
      { term: 'Game day', aliases: ['game days', 'dia de jogo'], definition: 'Exercício planejado em que o time simula ou provoca uma falha realista (queda de região, banco lento) e pratica a resposta: detecção, runbooks, papéis e comunicação.' },
      { term: 'MTTR', aliases: ['MTTD', 'MTTA', 'mean time to recovery', 'mean time to repair', 'tempo médio de recuperação'], definition: 'Família de métricas de incidentes: **MTTD** (tempo médio até detectar), **MTTA** (até alguém reconhecer o alerta) e **MTTR** (até recuperar; o "R" varia entre *repair*, *recover*, *resolve* — defina qual).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          '3h12 da manhã. O pager toca. O checkout está devolvendo erro para um em cada três clientes.',
          'O que você faz primeiro? Spoiler: **não** é abrir o código para achar o bug.',
        ],
        board: {
          title: 'O ciclo de um incidente',
          md: `\`\`\`text
 impacto começa ─► DETECTAR ─► TRIAR ─► MITIGAR ─► RESOLVER ─► APRENDER
                   alerta      severidade  usuário     causa       postmortem
                   ou cliente  papéis      para de     corrigida   e ações
                               canal       sofrer
\`\`\`

| Fase | Objetivo | Exemplos |
|---|---|---|
| **Detectar** | saber do problema antes do cliente | alerta por burn rate, sonda sintética |
| **Triar** | dimensionar e organizar | declarar o incidente, definir severidade e incident commander, abrir o canal |
| **Mitigar** | **parar o sofrimento** do usuário | rollback, desligar flag, drenar região, escalar, bloquear um cliente abusivo, degradar uma feature |
| **Resolver** | corrigir a causa | correção de código, ajuste de capacidade, troca de dependência |
| **Aprender** | não repetir | postmortem, ações com dono e prazo |

**Mitigar primeiro.** Entender a causa pode levar horas; um rollback leva minutos. Se o problema começou junto com uma mudança, desfaça a mudança — mesmo sem ter certeza de que foi ela. Voltar a um estado conhecido é barato e reversível.

> [!dica] Pergunta de ouro do plantão: **"o que mudou?"** Deploys, flags, configuração, tráfego, dependências. O livro de SRE do Google estima que cerca de **70%** das indisponibilidades vêm de mudanças em sistemas que estavam funcionando.

> [!atencao] "Resolvido" não é "mitigado". Depois do rollback, o bug continua no código, esperando o próximo deploy. Feche o incidente só com a causa tratada — ou com um ticket prioritário para isso.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Incidente com dez pessoas depurando ao mesmo tempo, sem ninguém coordenando, vira caos.',
          'A solução veio de um lugar inesperado: os **bombeiros**.',
        ],
        board: {
          title: 'Papéis: quem faz o quê',
          md: `| Papel | Responsabilidade | Não faz |
|---|---|---|
| **Incident commander (IC)** | coordena, define a severidade, decide, distribui tarefas, pede ajuda | não depura — precisa enxergar o todo |
| **Operações** (*ops lead*) | investiga e executa a mitigação, com os especialistas | não fala com clientes |
| **Comunicação** | status page, suporte, liderança, atualizações a cada 30 min | não investiga |
| **Registro** (*scribe*) | anota a linha do tempo: o que se viu, decidiu e fez, e quando | — |

Regras que salvam madrugadas:

- **Declare cedo.** Abrir um incidente que depois se mostra pequeno custa pouco; demorar para abrir custa caro.
- **Um canal só**, com nome previsível (\`#inc-2026-03-14-checkout\`), e uma pessoa com a palavra final.
- **Passagem explícita** de comando: "Ana, você é a IC a partir de agora" — "Confirmado, sou a IC."
- Em incidente pequeno, uma pessoa acumula papéis; o que importa é saber **quem** está em cada um.

> [!sabia] O modelo vem do **Incident Command System** (ICS), criado nos anos 1970 pelos bombeiros da Califórnia depois de incêndios florestais em que dezenas de corporações não conseguiam trabalhar juntas: cada uma tinha seus termos, rádios e chefes. O ICS padronizou papéis e uma **cadeia de comando única** — e empresas como Google (com o IMAG, *Incident Management at Google*) e PagerDuty o adaptaram quase sem mudanças.`,
        },
      },
      {
        type: 'say',
        text: [
          'Nem todo incidente merece acordar o diretor. A severidade diz quanto barulho fazer.',
          'E ela mede o **impacto no usuário** — não o quão difícil é o bug.',
        ],
        board: {
          title: 'Severidades e plantão',
          md: `| Severidade | Critério (exemplo) | Resposta |
|---|---|---|
| **SEV1** | função crítica fora para muitos usuários; perda de dados; vazamento de segurança | page imediato, IC dedicado, comunicação externa, liderança avisada |
| **SEV2** | degradação séria ou falha de funcionalidade importante; burn rate de page | page, IC, status page se houver impacto visível |
| **SEV3** | impacto pequeno ou com contorno | ticket no horário comercial |
| **SEV4** | sem impacto no usuário (quase-incidente) | registrar e aprender |

**Plantão (*on-call*) saudável:**

- alerta que acorda alguém precisa ser **urgente, acionável e real** — se ninguém faz nada ao recebê-lo, ele vira ruído (*alert fatigue*);
- cada alerta aponta para um **runbook**: o que olhar, como mitigar, quem chamar;
- a carga é medida (quantos pages por turno?) e tratada como problema de engenharia quando cresce.

> [!atencao] "Bug bizarro e difícil" não é SEV1 se ninguém é afetado. "Um botão sem estilo" também não. Mas "o checkout falha para 2% dos clientes" pode ser SEV2 — é dinheiro indo embora a cada minuto.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Como saber se estamos melhorando? A resposta tradicional são as métricas "MTT-alguma-coisa".',
          'Úteis — desde que você não confie cegamente na **média**.',
        ],
        board: {
          title: 'MTTD, MTTA, MTTR — e por que desconfiar da média',
          md: `\`\`\`text
 início do impacto   detectado   reconhecido     mitigado        resolvido
        │─── TTD ───────│── TTA ──────│               │               │
        │─── TTM (tempo até mitigar) ─────────────────│               │
        │─── TTR (tempo até resolver) ────────────────────────────────│
\`\`\`

| Métrica | Mede | Melhora com |
|---|---|---|
| **MTTD** — *time to detect* | cobertura dos alertas | SLIs certos, alertas por burn rate, sondas sintéticas |
| **MTTA** — *time to acknowledge* | saúde do plantão | rotação clara, alertas acionáveis, escalonamento automático |
| **MTTM** — *time to mitigate* | capacidade de parar o sangramento | rollback rápido, kill switches, runbooks |
| **MTTR** — *time to recover/resolve* | ciclo completo | tudo acima + correções duradouras |

O "início do impacto" costuma ser descoberto **depois**, olhando os gráficos: por isso a linha do tempo do postmortem é reconstruída a partir dos eventos de várias fontes — alertas, pager, chat, deploys.

> [!sabia] O relatório **VOID** (*Verica Open Incident Database*), que analisou milhares de incidentes públicos, mostrou que a duração dos incidentes tem uma distribuição de **cauda longa**: a maioria é curta e alguns duram dias. Com essa forma, a **média** (o "M" do MTTR) oscila muito de um trimestre para outro sem que nada tenha mudado — um único incidente longo move tudo. A recomendação: olhe a **mediana** e os percentis e, principalmente, estude os incidentes um a um.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Incidente mitigado, todo mundo dormiu. Agora vem a parte mais valiosa: o **postmortem**.',
          'E a regra número um dele é não procurar culpados.',
        ],
        board: {
          title: 'Postmortem blameless',
          md: `| Seção | Conteúdo |
|---|---|
| **Resumo** | o que aconteceu, em três frases |
| **Impacto** | quem, quanto, por quanto tempo: usuários, pedidos, % de erro, error budget |
| **Linha do tempo** | eventos com horário: início, detecção, decisões, mitigação |
| **Fatores contribuintes** | as condições técnicas e organizacionais que permitiram o problema |
| **O que funcionou / onde tivemos sorte** | o que ajudou — e o que poderia ter sido muito pior |
| **Ações** | cada uma com **dono**, **prazo** e ticket |

**Blameless** não é "ninguém é responsável". É reconhecer que pessoas agem de forma razoável com as informações que têm, e que punir quem errou só ensina a esconder erros.

| Com culpa | Blameless |
|---|---|
| "O João rodou o script no banco errado." | "O script aceitava qualquer banco sem confirmação, e os de produção e de staging tinham nomes parecidos." |
| "Faltou atenção na revisão." | "A mudança de configuração não passava por revisão nem por canary." |

"Erro humano" é o **começo** da investigação, não a conclusão: por que o erro era fácil de cometer e difícil de perceber?

> [!sabia] A seção **"onde tivemos sorte"** (*where we got lucky*), do modelo de postmortem do Google, é das mais reveladoras: "o incidente foi às 10h, com o time todo online", "a pessoa de plantão por acaso conhecia aquele serviço". Sorte não é um mecanismo de defesa — cada item dessa lista é um risco escondido que merece uma ação.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'A técnica mais famosa para achar a causa é perguntar "por quê?" cinco vezes.',
          'Ela ajuda — mas tem limitações que quase ninguém menciona.',
        ],
        board: {
          title: '5 porquês e suas limitações',
          md: `\`\`\`text
 Checkout falhou com 503.
  └ por quê? O pool de conexões com o banco esgotou.
     └ por quê? O pool foi reduzido de 50 para 5.
        └ por quê? Um valor de teste foi para o arquivo de produção.
           └ por quê? A configuração não tem validação nem revisão.
              └ por quê? Mudança de config era vista como "sem risco".
\`\`\`

Boa para **começar**. As limitações:

| Limitação | O que acontece |
|---|---|
| **Linear** | incidentes têm vários fatores simultâneos; a técnica segue um só caminho |
| **Depende de quem pergunta** | pessoas diferentes chegam a "causas raiz" diferentes |
| **Para na pessoa** | "por que o valor errado foi para produção? Porque o Pedro errou" — e a investigação acaba |
| **Número arbitrário** | por que 5 e não 3 ou 8? |

Alternativas: listar **fatores contribuintes** (em vez de uma causa), árvores causais, diagrama de Ishikawa, análise de sistemas (CAST/STAMP).

> [!sabia] No ensaio **"How Complex Systems Fail"**, o médico e pesquisador de segurança **Richard Cook** escreveu que atribuir um acidente a uma "causa raiz" é fundamentalmente errado: sistemas complexos convivem o tempo todo com falhas latentes, e o acidente só acontece quando **várias** delas se alinham. Foi desse campo — segurança na aviação e na medicina — que a engenharia de software herdou a ideia de postmortem blameless.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'E se, em vez de esperar o próximo incidente, você **provocasse** um — de propósito, em horário comercial, com todo mundo preparado?',
          'É a ideia do **chaos engineering** e dos **game days**.',
        ],
        board: {
          title: 'Chaos engineering e game days',
          md: `**Chaos engineering** é experimentação, não bagunça. Os princípios:

1. defina o **estado estável** por uma métrica do usuário (ex.: taxa de sucesso do checkout);
2. formule a **hipótese**: "se uma zona de disponibilidade cair, o sucesso continua acima de 99,9%";
3. injete **eventos do mundo real**: matar instâncias, latência numa dependência, disco cheio, DNS falhando;
4. rode **em produção** (ou o mais perto possível), com **raio de impacto** mínimo e botão de abortar;
5. **automatize** para rodar sempre — sistemas mudam, e a resiliência de ontem apodrece.

**Game day** é o treino do time: uma falha planejada (simulada ou real), com IC, canal, runbooks e cronômetro. Mede-se o que importa: os alertas dispararam? O runbook funcionou? Quanto tempo levou para mitigar?

> [!sabia] O **Chaos Monkey**, da Netflix (2011), desligava instâncias de produção aleatoriamente em horário comercial: se o seu serviço não aguentava perder uma máquina, você descobria às 14h, e não às 3h. Os game days vieram antes: na Amazon, **Jesse Robbins** — bombeiro voluntário, com o título de *Master of Disaster* — organizava exercícios em que datacenters inteiros eram desligados de verdade. O Google faz algo parecido há anos com o **DiRT** (*Disaster Recovery Testing*).

> [!atencao] Comece pequeno: staging, uma instância, horário comercial, com rollback pronto. Chaos engineering sem observabilidade é só causar incidentes.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Ciclo do incidente, papéis, postmortem e métricas a partir de eventos reais.', icon: '🚨' },
      {
        type: 'order',
        id: 'obs-inc-q1',
        concept: 'Ciclo do incidente',
        say: 'Primeira: o incidente de ponta a ponta, na ordem certa.',
        prompt: 'O checkout começou a falhar logo depois de um deploy. Coloque as ações na ordem em que devem acontecer.',
        items: [
          'O alerta de burn rate dispara e o on-call reconhece o page',
          'Declarar o incidente: severidade, incident commander e canal',
          'Fazer rollback do deploy suspeito',
          'Confirmar que a taxa de sucesso voltou ao normal',
          'Corrigir a causa no código e publicar a correção pelo pipeline',
          'Escrever o postmortem e acompanhar as ações até o fim',
        ],
        explanation: 'Detectar → triar → **mitigar** → verificar → resolver → aprender. O rollback vem **antes** de corrigir a causa: parar o sofrimento do usuário é mais urgente do que entender o bug. E "mitigado" só vale depois de **confirmado** nas métricas do usuário — rollbacks também falham. O postmortem fecha o ciclo, mas só vale se as ações tiverem dono e forem de fato concluídas.',
      },
      {
        type: 'mcq',
        id: 'obs-inc-q2',
        concept: 'Mitigar primeiro',
        say: 'Uma situação clássica de sala de guerra.',
        prompt: 'O serviço de busca está com **12% de erros** desde as 10h04. Houve um deploy às 10h01. Um engenheiro sênior diz: *"Não acho que seja o deploy — a mudança foi só num log. Me dá 30 minutos que eu acho a causa."* Você é a incident commander. O que decide?',
        options: [
          { text: 'Rollback agora, em paralelo com a investigação: é barato, reversível e a mudança coincide com o início do problema', correct: true, why: 'Mitigar primeiro. Mesmo que o deploy pareça inocente, a correlação temporal é forte e o rollback custa minutos. Se os erros continuarem, você descartou uma hipótese rápido — e a investigação segue.' },
          { text: 'Dar os 30 minutos: quem conhece o código sabe melhor', why: 'São 30 minutos com 12% de erros, apostando numa intuição. Mudanças "inofensivas" (um log que serializa um objeto enorme, uma dependência atualizada junto) derrubam sistemas o tempo todo.' },
          { text: 'Esperar a causa raiz para não fazer um rollback à toa', why: 'Rollback "à toa" custa quase nada; esperar custa usuários e error budget. A assimetria favorece agir.' },
          { text: 'Assumir o teclado e depurar junto, para acelerar', why: 'A IC que depura perde a visão do todo: ninguém coordena, comunica ou decide. O papel dela é decidir e delegar.' },
        ],
        explanation: 'Durante o incidente, a pergunta é **"qual é a ação mais rápida e segura para o usuário parar de sofrer?"**, não "o que causou isso?". Um rollback que acaba sendo desnecessário custa minutos; um diagnóstico demorado custa horas de impacto. Investigar e mitigar podem andar **em paralelo** — e a IC existe justamente para tomar essa decisão com a cabeça fria.',
      },
      {
        type: 'match',
        id: 'obs-inc-q3',
        concept: 'Papéis e práticas',
        say: 'Jogo rápido de vocabulário de plantão.',
        prompt: 'Associe cada termo à sua descrição.',
        pairs: [
          { left: 'Incident commander', right: 'Coordena, define a severidade e decide — sem depurar' },
          { left: 'Scribe', right: 'Registra a linha do tempo de observações, decisões e ações' },
          { left: 'Runbook', right: 'Passo a passo de diagnóstico e mitigação ligado a um alerta' },
          { left: 'Game day', right: 'Exercício planejado em que o time pratica a resposta a uma falha' },
          { left: 'Chaos engineering', right: 'Experimentos controlados com hipótese sobre o estado estável' },
          { left: 'MTTD', right: 'Tempo médio entre o início do impacto e a detecção' },
        ],
        explanation: 'Papéis claros (IC, operações, comunicação, registro) evitam que dez pessoas façam a mesma coisa enquanto ninguém fala com os clientes. **Runbooks** encurtam o tempo até mitigar; **game days** e **chaos engineering** testam se os runbooks, os alertas e as pessoas funcionam de verdade — antes que um incidente real faça esse teste por você.',
      },
      {
        type: 'mcq',
        id: 'obs-inc-q4',
        concept: 'Postmortem blameless',
        say: 'Agora, o tom do postmortem.',
        prompt: 'Qual destes trechos de "fatores contribuintes" está escrito no espírito **blameless** e leva a melhores ações?',
        options: [
          { text: '"O comando de limpeza aceitava o ambiente como argumento livre, sem confirmação, e os nomes `prod-db` e `pred-db` diferem em uma letra; nada no terminal indicava o ambiente atual."', correct: true, why: 'Descreve as **condições** que tornaram o erro fácil de cometer e difícil de perceber. Cada uma vira uma ação concreta: confirmação, nomes distintos, prompt colorido por ambiente.' },
          { text: '"A Carla rodou o comando no banco errado por falta de atenção. Ela já foi orientada a ter mais cuidado."', why: 'Aponta uma pessoa e propõe "mais cuidado" — que não é uma ação verificável. O próximo engenheiro cansado cometerá o mesmo erro, e o time aprende a esconder deslizes.' },
          { text: '"Erro humano."', why: 'É onde a investigação deveria **começar**: por que o sistema deixou um humano causar isso tão facilmente? Como conclusão, não gera nenhuma melhoria.' },
          { text: '"Causa raiz: a Carla não seguiu o runbook. Ação: advertência formal."', why: 'Punição torna o próximo postmortem menos honesto — as pessoas passam a omitir o que fizeram. E não pergunta por que o runbook não foi seguido: estava desatualizado? Era difícil de achar?' },
        ],
        explanation: 'Um postmortem blameless troca "quem errou?" por **"o que no sistema tornou esse erro possível, provável e difícil de detectar?"**. Não é falta de responsabilidade: as ações ficam **mais fortes**, porque mudam o sistema (salvaguardas, automação, nomes, alertas) em vez de pedir perfeição às pessoas. E a honestidade do relato — a matéria-prima do aprendizado — depende de ninguém temer punição.',
      },
      {
        type: 'code',
        id: 'obs-inc-q5',
        concept: 'Métricas de incidentes',
        title: 'Linha do tempo e MTTR a partir de eventos',
        say: 'Agora você vai reconstruir linhas do tempo e calcular as métricas a partir dos eventos brutos — que chegam fora de ordem e duplicados, como na vida real.',
        prompt: `Os eventos vêm de várias fontes (alertas, pager, chat) como dicionários \`{"incidente": "INC-1", "tipo": "detectado", "ts": 106}\`, **fora de ordem**. \`ts\` é um inteiro em minutos (o relógio já vem nos eventos: não leia a hora atual). Pode haver **duplicatas** (dois alertas "detectado") e tipos fora de \`ORDEM\` (como \`"comentario"\`), que devem ser **ignorados**.

1. \`marcos(eventos)\` → \`{incidente: {tipo: ts}}\`, com o **menor** \`ts\` de cada tipo.
2. \`linha_do_tempo(eventos, incidente)\` → lista de \`(ts, tipo)\` do incidente, ordenada por \`ts\`; em empate, pela posição em \`ORDEM\`. Incidente desconhecido → \`[]\`.
3. \`metricas(eventos)\` → dicionário com \`"mttd"\`, \`"mtta"\`, \`"mttm"\`, \`"mttr"\` (médias das durações de \`DURACOES\`, só dos incidentes que têm **os dois** marcos) e \`"mediana_ttr"\`. Sem dados para uma métrica → \`None\`.`,
        starter: `ORDEM = ["inicio", "detectado", "reconhecido", "mitigado", "resolvido"]

# métrica: (marco final, marco inicial)
DURACOES = {
    "ttd": ("detectado", "inicio"),
    "tta": ("reconhecido", "detectado"),
    "ttm": ("mitigado", "inicio"),
    "ttr": ("resolvido", "inicio"),
}


def marcos(eventos):
    """{incidente: {tipo: primeiro ts}}, ignorando tipos fora de ORDEM."""
    pass


def linha_do_tempo(eventos, incidente):
    """[(ts, tipo)] do incidente, por ts (empate: ordem do ciclo)."""
    pass


def metricas(eventos):
    """{'mttd', 'mtta', 'mttm', 'mttr', 'mediana_ttr'} — None quando não há dados."""
    pass
`,
        tests: [
          { name: 'marcos usam o primeiro ts de cada tipo', setup: EVENTOS, expr: 'marcos(EVENTOS)["INC-1"]', expected: '{"inicio": 100, "detectado": 106, "reconhecido": 110, "mitigado": 130, "resolvido": 190}' },
          { name: 'tipos desconhecidos são ignorados', setup: EVENTOS, expr: 'sorted(marcos(EVENTOS)["INC-2"])', expected: '["detectado", "inicio", "mitigado", "reconhecido", "resolvido"]' },
          { name: 'linha do tempo ordenada', setup: EVENTOS, expr: 'linha_do_tempo(EVENTOS, "INC-2")', expected: '[(500, "inicio"), (520, "detectado"), (522, "reconhecido"), (540, "mitigado"), (560, "resolvido")]' },
          {
            name: 'empate de horário segue a ordem do ciclo',
            code: `ev = [
    {"incidente": "X", "tipo": "reconhecido", "ts": 12},
    {"incidente": "X", "tipo": "detectado", "ts": 12},
    {"incidente": "X", "tipo": "inicio", "ts": 5},
]
lt = linha_do_tempo(ev, "X")
assert lt == [(5, "inicio"), (12, "detectado"), (12, "reconhecido")], f"detectado vem antes de reconhecido no empate; veio {lt}"`,
          },
          { name: 'incidente desconhecido → lista vazia', setup: EVENTOS, expr: 'linha_do_tempo(EVENTOS, "INC-99")', expected: '[]' },
          { name: 'métricas de dois incidentes completos', setup: EVENTOS, expr: 'metricas(EVENTOS)', expected: '{"mttd": 13, "mtta": 3, "mttm": 35, "mttr": 75, "mediana_ttr": 75}' },
          {
            name: 'incidente em aberto entra no MTTD, mas não no MTTR',
            setup: EVENTOS,
            code: `ev = EVENTOS + [
    {"incidente": "INC-3", "tipo": "detectado", "ts": 910},
    {"incidente": "INC-3", "tipo": "inicio", "ts": 900},
    {"incidente": "INC-3", "tipo": "reconhecido", "ts": 915},
]
m = metricas(ev)
assert m["mttd"] == 12, f"MTTD = (6 + 20 + 10) / 3 = 12; veio {m['mttd']}"
assert abs(m["mtta"] - 11 / 3) < 1e-9, f"MTTA = (4 + 2 + 5) / 3; veio {m['mtta']}"
assert m["mttr"] == 75, f"o INC-3 ainda não foi resolvido e não entra no MTTR; veio {m['mttr']}"`,
          },
          { name: 'sem eventos → tudo None', expr: 'metricas([])', expected: '{"mttd": None, "mtta": None, "mttm": None, "mttr": None, "mediana_ttr": None}' },
          {
            name: 'um incidente longo puxa a média, não a mediana',
            hidden: true,
            code: `ev = []
for i, ttr in enumerate([30, 40, 50, 600]):
    base = i * 1000
    ev += [{"incidente": f"I{i}", "tipo": "inicio", "ts": base},
           {"incidente": f"I{i}", "tipo": "resolvido", "ts": base + ttr}]
m = metricas(ev)
assert m["mttr"] == 180, f"MTTR (média) = 180; veio {m['mttr']}"
assert m["mediana_ttr"] == 45, f"mediana = 45; veio {m['mediana_ttr']}"
assert m["mttd"] is None and m["mtta"] is None and m["mttm"] is None, "sem 'detectado' nem 'mitigado', essas métricas ficam None"`,
          },
          {
            name: 'duplicatas fora de ordem não mudam os marcos',
            hidden: true,
            setup: EVENTOS,
            code: `ev = list(reversed(EVENTOS)) + [{"incidente": "INC-2", "tipo": "detectado", "ts": 519}]
assert marcos(ev)["INC-2"]["detectado"] == 519, "o menor ts de 'detectado' deve valer, em qualquer ordem"
assert marcos(ev)["INC-1"]["detectado"] == 106, "INC-1 tem dois 'detectado' (106 e 108): vale o primeiro"`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'Não consulte o relógio: todos os horários já vêm nos eventos. Uma métrica calculada com "agora" muda a cada execução e não pode ser reproduzida no postmortem.',
            concept: 'Relógio injetado',
          },
          {
            when: (m, code) => /["']ttd["'][\s\S]*["']ttd["']/.test(code.replace(/DURACOES\s*=\s*\{[\s\S]*?\n\}/, '')),
            text: 'As durações foram repetidas à mão em vez de percorrer `DURACOES`. Com a tabela, acrescentar uma métrica nova (ex.: tempo entre mitigar e resolver) é uma linha.',
            concept: 'Configuração dirigida por dados',
          },
          {
            when: m => m.maxComplexity > 11,
            text: 'Alguma função ficou com decisões demais. Deixe `marcos` fazer a limpeza (duplicatas e tipos desconhecidos) uma vez só, e faça `linha_do_tempo` e `metricas` partirem dela.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Em `marcos`, use `resultado.setdefault(ev["incidente"], {})` e guarde `ts` quando o tipo ainda não existe ou quando o novo `ts` é menor. Pule os eventos com `ev["tipo"] not in ORDEM`.',
          'Em `linha_do_tempo`: `m = marcos(eventos).get(incidente, {})` e `sorted(((ts, tipo) for tipo, ts in m.items()), key=lambda p: (p[0], ORDEM.index(p[1])))`.',
          'Em `metricas`: para cada incidente e cada `nome, (fim, ini)` de `DURACOES`, se os dois marcos existem, acrescente `m[fim] - m[ini]` numa lista. No fim, `statistics.mean` e `statistics.median` — ou `None` para listas vazias.',
        ],
        solution: `from statistics import mean, median

ORDEM = ["inicio", "detectado", "reconhecido", "mitigado", "resolvido"]

# métrica: (marco final, marco inicial)
DURACOES = {
    "ttd": ("detectado", "inicio"),
    "tta": ("reconhecido", "detectado"),
    "ttm": ("mitigado", "inicio"),
    "ttr": ("resolvido", "inicio"),
}


def marcos(eventos):
    """{incidente: {tipo: primeiro ts}}, ignorando tipos fora de ORDEM."""
    resultado = {}
    for ev in eventos:
        tipo, ts = ev["tipo"], ev["ts"]
        if tipo not in ORDEM:
            continue
        m = resultado.setdefault(ev["incidente"], {})
        if tipo not in m or ts < m[tipo]:
            m[tipo] = ts
    return resultado


def linha_do_tempo(eventos, incidente):
    """[(ts, tipo)] do incidente, por ts (empate: ordem do ciclo)."""
    m = marcos(eventos).get(incidente, {})
    return sorted(((ts, tipo) for tipo, ts in m.items()),
                  key=lambda p: (p[0], ORDEM.index(p[1])))


def metricas(eventos):
    """{'mttd', 'mtta', 'mttm', 'mttr', 'mediana_ttr'} — None quando não há dados."""
    amostras = {nome: [] for nome in DURACOES}
    for m in marcos(eventos).values():
        for nome, (fim, ini) in DURACOES.items():
            if fim in m and ini in m:
                amostras[nome].append(m[fim] - m[ini])
    resultado = {"m" + nome: mean(v) if v else None for nome, v in amostras.items()}
    resultado["mediana_ttr"] = median(amostras["ttr"]) if amostras["ttr"] else None
    return resultado
`,
        solutionExplanation: 'Todo o trabalho sujo fica em `marcos`: ignorar o que não é marco do ciclo e ficar com o **primeiro** horário de cada tipo — o segundo alerta de "detectado" não muda quando o time soube do problema. A partir daí, `linha_do_tempo` é uma ordenação com critério de desempate explícito (eventos no mesmo minuto seguem a ordem do ciclo), e `metricas` percorre a tabela `DURACOES`, contando cada incidente só nas métricas para as quais ele tem os dois marcos — um incidente ainda aberto informa o MTTD, mas não pode entrar no MTTR. O teste oculto mostra a lição do relatório VOID: com durações de 30, 40, 50 e 600 minutos, a média é **180** e a mediana é **45**. Qual das duas descreve o seu plantão típico? Reporte as duas e, para comparar trimestres, prefira a mediana e os percentis. Na prática, esses eventos vêm da API do PagerDuty/Opsgenie, do histórico do canal de incidente e do log de deploys — e o "início do impacto" costuma ser preenchido à mão no postmortem, olhando os gráficos.',
      },
      {
        type: 'open',
        id: 'obs-inc-q6',
        concept: 'Postmortem blameless',
        say: 'Para fechar: escreva o resumo do postmortem de verdade.',
        prompt: `Ontem, às **14h05**, um deploy de configuração reduziu o pool de conexões do serviço de pedidos de 50 para 5 — um valor de teste que foi parar no arquivo de produção. Das **14h07** às **14h49**, **31%** dos checkouts falharam com \`503\` (cerca de **4.200 pedidos**). O alerta de burn rate disparou às **14h13**; o rollback da configuração, às 14h49, resolveu. Mudanças de configuração não passam por validação nem por canary.

Escreva o **resumo do postmortem** (blameless): impacto, linha do tempo e detecção, fatores contribuintes e ações.`,
        rubric: [
          { label: 'Quantifica o impacto', keywords: ['4.200', '4200', '31%', '31 %', '42 min', '42 minutos', 'error budget', 'orcamento de erro', 'pedidos perdidos', 'pedidos falharam', 'clientes afetados', 'usuarios afetados'], concept: 'Impacto', why: 'O impacto em números (usuários, pedidos, duração, error budget) define a severidade e a prioridade das ações.' },
          { label: 'Apresenta a linha do tempo e a detecção', keywords: ['14h05', '14h07', '14h13', '14h49', '14:05', '14:07', '14:13', '14:49', 'linha do tempo', 'timeline', 'detectad', 'deteccao'], concept: 'Linha do tempo', why: 'A linha do tempo mostra onde se perdeu tempo: entre o início e a detecção (6 min) e entre o alerta e a mitigação (36 min).' },
          { label: 'Aponta fatores contribuintes do sistema, sem culpados', keywords: ['fatores contribuintes', 'fator contribuinte', 'blameless', 'sem culpa', 'sem culpados', 'ninguem errou', 'nao e culpa', 'sem validacao', 'nao tem validacao', 'faltou validacao', 'nao passa por canary', 'sem canary', 'processo permit', 'sistema permit'], concept: 'Postmortem blameless', why: 'O foco são as condições que permitiram o erro — configuração sem validação nem canary —, não a pessoa que editou o arquivo.' },
          { label: 'Define ações com dono e prazo', keywords: ['dono', 'responsavel', 'prazo', 'owner', 'action item', ['acoes', 'semana'], ['acoes', 'time de']], concept: 'Ações do postmortem', why: 'Sem dono e prazo, a ação vira desejo. Cada uma deve atacar um fator contribuinte e ter um ticket.' },
        ],
        minWords: 60,
        modelAnswer: '**Resumo:** das 14h07 às 14h49 (**42 minutos**), **31%** dos checkouts falharam com 503 — cerca de **4.200 pedidos** perdidos e uma boa parte do error budget do mês. **Linha do tempo:** 14h05, um deploy de configuração reduz o pool de conexões do serviço de pedidos de 50 para 5; 14h07, começa o impacto; 14h13, o alerta de burn rate dispara (**detectado** em 6 min) e o on-call assume como incident commander; 14h49, o rollback da configuração resolve (36 min entre o alerta e a mitigação, porque não havia painel de saturação do pool). **Fatores contribuintes (blameless):** um valor de teste chegou à produção porque a configuração **não tem validação** de limites nem revisão, **não passa por canary** e é aplicada em todos os pods ao mesmo tempo; nada mostrava que o pool estava esgotado. Ninguém errou sozinho: o processo permitia o erro. **Ações:** (1) validar limites de configuração no CI — dono: time de plataforma, prazo: 2 semanas; (2) aplicar configuração por canary com análise automática — dono: SRE, prazo: 1 mês; (3) painel e alerta de saturação do pool — dono: time de pedidos, prazo: 1 semana.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo trabalho! Agora você sabe conduzir um incidente: mitigar primeiro, papéis claros, severidade pelo impacto.',
          { text: 'E, no dia seguinte, aprender sem procurar culpados — e quebrar as coisas de propósito antes que elas quebrem sozinhas.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
