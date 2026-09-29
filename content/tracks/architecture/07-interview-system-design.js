Game.registerModule('architecture', {
  id: 'interview-system-design',
  title: 'Entrevista: System Design — Encurtador de URL',
  kind: 'interview',
  level: 3,
  order: 91,
  unit: 'entrevistas',
  summary: 'Projete um encurtador de URL como numa entrevista real: requisitos, estimativas, IDs em base62, cache e escala.',
  concepts: ['System design', 'Estimativas', 'Base62', 'Cache', 'Escala de leitura'],
  takeaways: [
    'Siga o roteiro: **requisitos → estimativas → API → dados → alto nível → gargalos → trade-offs**. Perguntar antes de desenhar é sinal de maturidade.',
    'Estimativas são de **ordem de grandeza**: 1 dia ≈ 10⁵ s e 100 milhões/mês ≈ 40/s. A razão **leitura:escrita** (aqui, 100:1) mostra onde investir — no cache.',
    'IDs: contador + **base62** não colide, mas é previsível; códigos aleatórios ou hash truncado exigem checar colisão — pelo **paradoxo do aniversário**, elas chegam cedo.',
    '`301` é cacheado pelo navegador (menos carga, cliques invisíveis); `302`/`307` passa sempre pelo servidor. Registre os cliques numa **fila**, fora do caminho crítico.',
    'Para picos de leitura: cache-aside + LRU, apps stateless com autoscaling, réplicas/sharding e CDN — sempre dizendo o preço (dado desatualizado, mais peças para operar).',
  ],
  glossary: [
    { term: 'Estimativa de Fermi', aliases: ['estimativas de Fermi', 'problema de Fermi', 'problemas de Fermi', 'back-of-the-envelope'], definition: 'Conta rápida de **ordem de grandeza** com números redondos (requisições por segundo, armazenamento, banda). O objetivo não é precisão, e sim decidir se o problema cabe em 1 servidor ou em 1.000. O nome homenageia o físico Enrico Fermi.' },
    { term: 'Base62', aliases: ['base 62'], definition: 'Representação de números com 62 símbolos (`0-9`, `a-z`, `A-Z`). Com 6 caracteres cobre 62⁶ ≈ 56,8 bilhões de valores — por isso é o formato clássico de códigos curtos de URL.' },
    { term: 'Paradoxo do aniversário', aliases: ['birthday paradox'], definition: 'Com N valores possíveis, uma colisão fica provável (50%) após só ~1,18·√N sorteios aleatórios. Ex.: códigos aleatórios de 7 caracteres em base62 (3,5 trilhões de combinações) já têm 50% de chance de colidir com ~2,2 milhões de links.' },
    { term: 'Ticket server', aliases: ['ticket servers', 'servidor de tickets'], definition: 'Serviço dedicado a distribuir IDs únicos e crescentes — o Flickr usava MySQL com auto-increment em dois servidores (um gerava pares; o outro, ímpares). Para não virar gargalo, os servidores de aplicação costumam reservar **faixas** de IDs e consumi-las localmente.' },
    { term: 'CDN', aliases: ['CDNs', 'content delivery network'], definition: '*Content Delivery Network*: rede de servidores de **borda** (*edge*) espalhados pelo mundo que guardam cópias de respostas perto do usuário. Reduz latência e carga na origem, ao custo de uma invalidação mais lenta (a cópia vive até o TTL).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Olá! Hoje eu sou sua **entrevistadora**. Esta é uma entrevista de **system design** de 45 minutos.',
        'O desafio: projetar um **encurtador de URL**, como o bit.ly. Não existe resposta única — quero ver seu **raciocínio e seus trade-offs**.',
      ],
      board: {
        title: '📋 Enunciado',
        md: `**Projete um serviço de encurtamento de URLs.**

- O usuário envia uma URL longa e recebe uma curta: \`https://encurta.dev/aZ3k9Q\`
- Quem acessa a URL curta é **redirecionado** para a original.

> [!dica] Roteiro que entrevistadores esperam: **requisitos → estimativas → API → modelo de dados → design de alto nível → aprofundamentos (gargalos, escala) → trade-offs**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Ah, e uma coisa: em algum momento você vai fazer **contas de cabeça**. Ninguém espera precisão, só **ordem de grandeza**.',
        'Deixa esta cola por perto — ela serve para qualquer entrevista de system design.',
      ],
      board: {
        title: '🧮 Cola de estimativas',
        md: `| Número | Aproximação | Atalho |
|---|---|---|
| Segundos em um dia | 86.400 ≈ **10⁵** | 1 milhão/dia ≈ **12/s** |
| Segundos em um mês | ≈ **2,6 milhões** | 100 milhões/mês ≈ **40/s** |
| Segundos em um ano | ≈ **3,15 × 10⁷** | ≈ π × 10⁷ — fácil de lembrar! |
| 2¹⁰ · 2²⁰ · 2³⁰ · 2⁴⁰ | mil · milhão · bilhão · trilhão | KB · MB · GB · TB |
| Pico ÷ média | **2× a 10×** | dimensione pelo pico, não pela média |
| RAM · rede no datacenter · seek de HDD | ~100 ns · ~0,5 ms · ~10 ms | a RAM é ~5.000× mais rápida que uma ida e volta na rede |

> [!sabia] Esse tipo de conta tem nome: **estimativa de Fermi**. No primeiro teste nuclear, em 1945, Enrico Fermi soltou pedacinhos de papel enquanto a onda de choque passava e, pela distância que eles voaram, estimou a potência da bomba em ~10 quilotons — as medições apontaram depois algo na casa dos 20. Errar por um fator de 2 é um resultado **ótimo**: em system design, a estimativa serve para escolher entre **1 servidor e 1.000**, não para acertar a casa decimal.`,
      },
    },
    {
      type: 'mcq',
      id: 'arq-sd-q1',
      concept: 'Roteiro de system design',
      say: 'Antes de tudo: qual seria seu **primeiro passo**?',
      prompt: 'Qual deve ser o **primeiro passo** numa entrevista de system design?',
      options: [
        { text: 'Esclarecer requisitos funcionais e não funcionais, e a escala esperada.', correct: true, why: 'Sem saber o que construir e para quantos usuários, qualquer decisão técnica é chute.' },
        { text: 'Escolher o banco de dados (SQL ou NoSQL).', why: 'Escolher tecnologia antes de entender requisitos e padrões de acesso é um sinal de alerta para o entrevistador.' },
        { text: 'Desenhar os microsserviços e o Kubernetes.', why: 'Pular direto para infraestrutura mostra falta de método — e pode ser exagero para o problema.' },
        { text: 'Começar a escrever o código do algoritmo de encurtamento.', why: 'System design é sobre arquitetura; código só aparece em aprofundamentos pontuais.' },
      ],
      explanation: 'Comece **perguntando**: quais funcionalidades? (links customizados, expiração, analytics?) Quais requisitos não funcionais? (latência, disponibilidade) Qual a escala? Isso guia todo o resto e mostra maturidade.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Boa. Vou responder suas perguntas: são **100 milhões de URLs novas por mês**, e cada link é acessado em média **100 vezes**.',
        'Os links devem durar **10 anos**, o redirecionamento precisa ser **rápido** e o serviço, **altamente disponível**.',
      ],
      board: {
        title: 'Requisitos e estimativas',
        md: `**Funcionais:** encurtar URL · redirecionar · (opcional) expiração e alias customizado.

**Não funcionais:** latência baixa no redirect · alta disponibilidade · links difíceis de adivinhar (desejável).

**Estimativas (*back-of-the-envelope*):**

| Métrica | Conta | Resultado |
|---|---|---|
| Escritas | 100 M / mês ÷ ~2,6 M s | **≈ 40 /s** |
| Leituras | 100 × escritas | **≈ 4.000 /s** (picos maiores) |
| Total de links | 100 M × 12 × 10 anos | **12 bilhões** |
| Armazenamento | 12 bi × ~500 bytes | **≈ 6 TB** |

> [!dica] Proporção **leitura:escrita de 100:1** → o sistema é dominado por **leituras**. Cache vai ser protagonista.`,
      },
    },
    {
      type: 'mcq',
      id: 'arq-sd-q2',
      concept: 'Estimativas',
      say: 'Agora uma conta rápida. Usando o alfabeto **base62** (`0-9`, `a-z`, `A-Z`), quantos caracteres o código precisa ter?',
      prompt: 'Precisamos de códigos únicos para **12 bilhões** de URLs usando base62. Qual o **menor** tamanho de código que basta?\n\n*(Dica: 62⁵ ≈ 916 milhões · 62⁶ ≈ 56,8 bilhões · 62⁷ ≈ 3,5 trilhões)*',
      options: [
        { text: '5 caracteres', why: '62⁵ ≈ 916 milhões — não chega nem a 1 bilhão de links.' },
        { text: '6 caracteres', correct: true, why: '62⁶ ≈ 56,8 bilhões de combinações, mais que os 12 bilhões necessários.' },
        { text: '7 caracteres', why: 'Funciona e dá folga, mas não é o **menor** tamanho suficiente.' },
        { text: '10 caracteres', why: 'Muito maior do que o necessário — a URL deixa de ser curta.' },
      ],
      explanation: '62⁶ ≈ **56,8 bilhões** > 12 bilhões, então **6 caracteres** bastam (com folga de ~4,7×). Em entrevista, vale comentar que 7 caracteres dariam margem para crescimento e para códigos aleatórios com menos colisões.',
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Perfeito. Agora me mostra a **API** e o **modelo de dados**.',
        'Vou adiantar o que eu esperaria ver aqui — e depois vamos discutir como gerar esses códigos.',
      ],
      board: {
        title: 'API e modelo de dados',
        md: `**API**

\`\`\`text
POST /api/urls            { "url": "https://...", "expira_em": "2030-01-01" }
  → 201 { "codigo": "aZ3k9Q", "curta": "https://encurta.dev/aZ3k9Q" }

GET  /{codigo}
  → 302 Location: https://url-original...     (404 se não existir/expirou)
\`\`\`

**Tabela \`urls\`**

| coluna | tipo | obs |
|---|---|---|
| codigo | varchar(7) | **chave primária** |
| url_original | text | |
| criado_em | timestamp | |
| expira_em | timestamp | nullable |
| usuario_id | bigint | nullable |

O acesso é quase sempre **por chave** (\`codigo\`) → um banco **chave-valor** ou SQL particionado por \`codigo\` atendem bem.`,
      },
    },
    {
      type: 'mcq',
      id: 'arq-sd-q3',
      concept: 'Geração de IDs',
      say: 'Como você geraria os códigos? Tem uma armadilha comum aqui.',
      prompt: 'Um candidato sugere: "o código será os **6 primeiros caracteres do MD5** da URL longa". Qual o principal problema?',
      options: [
        { text: 'Colisões: URLs diferentes podem gerar o mesmo prefixo, exigindo verificação e tratamento.', correct: true, why: 'Truncar o hash descarta a unicidade; com bilhões de URLs, colisões são garantidas (paradoxo do aniversário).' },
        { text: 'MD5 é lento demais para 40 escritas por segundo.', why: 'MD5 é extremamente rápido; desempenho não é o problema.' },
        { text: 'MD5 gera apenas números, então não dá para usar base62.', why: 'MD5 gera 128 bits, que podem ser representados em qualquer base.' },
        { text: 'Não há problema algum — é a solução ideal.', why: 'Ignorar colisões levaria links a redirecionar para o destino errado.' },
      ],
      explanation: 'Alternativas comuns: **(1)** um **contador** único (ex.: ranges de IDs distribuídos entre servidores, ou um *ticket server*) convertido para **base62** — sem colisões, mas códigos sequenciais são previsíveis; **(2)** códigos **aleatórios** de 7 caracteres com checagem de unicidade (constraint no banco + retry). Hash truncado exige a mesma checagem de colisão.',
    },
    {
      type: 'code',
      id: 'arq-sd-q4',
      concept: 'Base62',
      title: 'Codificação base62',
      say: 'Vamos com a abordagem do contador. Implementa pra mim a conversão para **base62** — ida e volta.',
      prompt: `Cada URL recebe um **ID numérico** único (de um contador). Converta-o para um código curto em **base62** e de volta:

- \`codificar(n)\` → string em base62 usando \`ALFABETO\` (\`0-9\`, \`a-z\`, \`A-Z\`, nessa ordem). \`codificar(0) == "0"\`. Número negativo → \`ValueError\`.
- \`decodificar(codigo)\` → o número original.
- Deve valer: \`decodificar(codificar(n)) == n\` para todo \`n >= 0\`.

Exemplos: \`codificar(61) == "Z"\`, \`codificar(62) == "10"\`, \`codificar(125) == "21"\`.`,
      starter: `ALFABETO = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = len(ALFABETO)  # 62


def codificar(n):
    # TODO: divisões sucessivas por 62
    pass


def decodificar(codigo):
    # TODO: acumule n = n * 62 + valor_do_caractere
    pass
`,
      tests: [
        { expr: 'codificar(0)', expected: '"0"' },
        { expr: 'codificar(61)', expected: '"Z"' },
        { expr: 'codificar(62)', expected: '"10"' },
        { expr: 'codificar(125)', expected: '"21"' },
        { expr: 'decodificar("10")', expected: '62' },
        { name: 'ida e volta para 0..4999', code: 'for n in range(5000):\n    assert decodificar(codificar(n)) == n, f"falhou para n={n}"' },
        { name: 'maior código de 6 caracteres', hidden: true, code: 'assert codificar(62 ** 6 - 1) == "ZZZZZZ"\nassert decodificar("ZZZZZZ") == 62 ** 6 - 1' },
        { name: 'IDs grandes', hidden: true, code: 'for n in [10**9, 12 * 10**9, 2**63 - 1]:\n    assert decodificar(codificar(n)) == n' },
        {
          name: 'negativo lança ValueError',
          hidden: true,
          code: `try:
    codificar(-1)
    assert False, "codificar(-1) deveria lançar ValueError"
except ValueError:
    pass`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('index') || m.calls.includes('find'),
          text: '`ALFABETO.index(c)` percorre o alfabeto a cada caractere. Um dicionário pré-computado (`{c: i for i, c in enumerate(ALFABETO)}`) dá lookup **O(1)** — e é o que se espera num caminho quente como o redirecionamento.',
          concept: 'Hash map (lookup O(1))',
        },
        {
          when: m => m.imports.includes('hashlib') || m.imports.includes('random'),
          text: 'Não é preciso hash nem aleatoriedade aqui: a conversão de base é **determinística e bijetora**, o que garante zero colisões.',
          concept: 'Geração de IDs',
        },
      ],
      hints: [
        'Para codificar: enquanto `n > 0`, faça `n, resto = divmod(n, BASE)` e acumule `ALFABETO[resto]`. No fim, inverta a ordem.',
        'Trate `n == 0` à parte (devolva `"0"`) e `n < 0` com `raise ValueError`.',
        'Para decodificar, crie `INDICE = {c: i for i, c in enumerate(ALFABETO)}` e faça `n = n * BASE + INDICE[c]` para cada caractere.',
      ],
      solution: `ALFABETO = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = len(ALFABETO)  # 62
INDICE = {c: i for i, c in enumerate(ALFABETO)}


def codificar(n):
    if n < 0:
        raise ValueError("n deve ser >= 0")
    if n == 0:
        return ALFABETO[0]
    digitos = []
    while n > 0:
        n, resto = divmod(n, BASE)
        digitos.append(ALFABETO[resto])
    return "".join(reversed(digitos))


def decodificar(codigo):
    n = 0
    for c in codigo:
        n = n * BASE + INDICE[c]
    return n
`,
      solutionExplanation: '`codificar` faz **divisões sucessivas** por 62: cada resto é um dígito, do menos para o mais significativo (por isso o `reversed`). `decodificar` faz o caminho inverso com o **método de Horner**. O dicionário `INDICE` evita buscas lineares. Como a conversão é **bijetora**, IDs únicos do contador geram códigos únicos — sem colisões. Trade-off a citar: códigos sequenciais são **previsíveis**; dá para embaralhar o ID (ex.: permutação/XOR com segredo) antes de codificar.',
    },
    {
      type: 'mcq',
      id: 'arq-sd-q5',
      concept: 'HTTP 301 vs 302',
      say: 'Um detalhe de HTTP que muita gente esquece. O produto quer **contar os cliques** de cada link.',
      prompt: 'Para conseguir **registrar cada clique** (analytics), qual código de redirecionamento é mais adequado?',
      options: [
        { text: '`302 Found` (ou `307`) — redirecionamento temporário.', correct: true, why: 'O navegador volta ao nosso servidor a cada acesso, então conseguimos registrar todos os cliques.' },
        { text: '`301 Moved Permanently` — redirecionamento permanente.', why: 'O navegador **guarda em cache** o 301 e vai direto ao destino nos próximos acessos: perdemos esses cliques (embora a carga caia).' },
        { text: '`200 OK` com o HTML da página original.', why: 'Isso seria um proxy do conteúdo — caro, lento e problemático.' },
        { text: '`404 Not Found` com um link para clicar.', why: 'Semântica errada e péssima experiência.' },
      ],
      explanation: 'Trade-off clássico: **301** reduz a carga (o navegador cacheia), mas esconde cliques; **302/307** passa sempre pelo servidor, permitindo **analytics** e mudar o destino depois. Mencione que o registro de cliques deve ser **assíncrono** (ex.: publicar numa fila) para não atrasar o redirect.',
    },
    {
      type: 'open',
      id: 'arq-sd-q6',
      concept: 'Escala de leitura',
      say: 'Última pergunta, e a mais importante. Um link viralizou e está recebendo **100 mil acessos por segundo**. Como seu design aguenta?',
      prompt: 'Como você escalaria o **redirecionamento** (leituras) para suportar picos como um link viral com **100 mil acessos/s**? Descreva os componentes e trade-offs.',
      minWords: 25,
      rubric: [
        { label: 'Usa **cache** em memória (Redis/Memcached, cache-aside, LRU)', keywords: ['cache', 'redis', 'memcached', 'memoria'], concept: 'Cache-aside', why: 'Com leitura:escrita de 100:1 e links "quentes", o cache absorve quase todo o tráfego.' },
        { label: 'Servidores de aplicação **stateless** atrás de **load balancer** (escala horizontal)', keywords: ['load balancer', 'balancead', 'balanceamento', 'stateless', 'horizontal', 'mais instancias', 'replicas da aplica', 'autoscal'], concept: 'Escala horizontal', why: 'Instâncias sem estado podem ser multiplicadas conforme a demanda.' },
        { label: 'Escala do **banco**: réplicas de leitura e/ou particionamento (sharding)', keywords: ['replica', 'shard', 'particion', 'fragment', 'chave-valor', 'nosql', 'cassandra', 'dynamo'], concept: 'Replicação e sharding', why: 'Réplicas absorvem leituras que escapam do cache; sharding distribui os dados.' },
        { label: 'Usa **CDN/edge** ou processa analytics de forma **assíncrona** (fila)', keywords: ['cdn', 'edge', 'borda', 'fila', 'queue', 'kafka', 'assincron', 'async'], concept: 'Processamento assíncrono', why: 'Responder na borda e tirar o analytics do caminho crítico reduz latência.' },
      ],
      modelAnswer: `O redirecionamento é quase só **leitura por chave**, então:

1. **Cache em memória** (Redis/Memcached) no padrão **cache-aside** com política **LRU**: o link viral fica "quente" no cache e praticamente nenhuma requisição chega ao banco. Posso até ter um cache local (in-process) com TTL curto para os links mais quentes.
2. Servidores de aplicação **stateless** atrás de um **load balancer**, com **autoscaling** horizontal.
3. Banco com **réplicas de leitura** e **sharding** por \`codigo\` (um banco chave-valor como DynamoDB/Cassandra encaixa bem nesse acesso por chave).
4. **CDN/edge**: para links sem analytics fino, a resposta de redirect pode ser cacheada na borda, perto do usuário.
5. O registro de cliques vai para uma **fila** (Kafka/SQS) e é processado **assíncrono**, fora do caminho crítico.

**Trade-offs:** cache e CDN trazem risco de dado **desatualizado** (ex.: link desativado continua redirecionando até o TTL) — mitigado com TTL curto e invalidação; mais componentes significam mais complexidade operacional.`,
    },
    {
      type: 'match',
      id: 'arq-rx2-sd-q7',
      concept: 'Trade-offs de system design',
      say: 'Antes de fechar: toda decisão tem um preço. Associe cada escolha ao trade-off que ela traz.',
      prompt: 'Associe cada **decisão** do encurtador ao seu **trade-off**.',
      pairs: [
        { left: '`301 Moved Permanently`', right: 'O navegador guarda o redirect: menos carga, cliques somem' },
        { left: '`302 Found`', right: 'Todo clique passa pelo servidor: analytics completo, mais carga' },
        { left: 'Contador + base62', right: 'Zero colisões, mas códigos **previsíveis**' },
        { left: 'Código aleatório de 7 caracteres', right: 'Imprevisível, mas exige checar **colisão**' },
        { left: 'Redirect cacheado na CDN', right: 'Latência mínima, mas link desativado segue valendo até o TTL' },
        { left: 'Cliques publicados numa fila', right: 'Redirect rápido, contagem com **atraso**' },
      ],
      explanation: 'Não existe decisão grátis — e é isso que a entrevistadora quer ouvir. **301 × 302**: carga × visibilidade dos cliques. **Contador × aleatório**: previsibilidade × colisões (dá para embaralhar o ID do contador com um segredo antes de codificar). **CDN**: latência × frescor do dado. **Fila**: caminho crítico rápido × analytics com consistência eventual. Em cada escolha, diga o que ganha, o que paga e por que o preço vale a pena **para este problema**.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótima entrevista! Você passou por requisitos, estimativas, API, geração de IDs, detalhes de HTTP e escala.',
        'Este é o desenho final que eu esperaria no quadro. Guarde esse roteiro — ele serve para quase qualquer pergunta de system design.',
      ],
      board: {
        title: '🏁 Design final',
        md: `\`\`\`text
 usuário ─▶ CDN/edge ─▶ Load Balancer ─▶ [ app stateless × N ]
                                            │        │
                                  cache-aside│        │ publica clique
                                            ▼        ▼
                                      [ Redis LRU ]  [ fila ] ─▶ workers ─▶ analytics
                                            │ miss
                                            ▼
                              [ banco chave-valor, sharded por código + réplicas ]
 IDs: contador distribuído (ranges por servidor) ─▶ base62 (6–7 chars)
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Resumo do roteiro: **requisitos → estimativas → API → dados → alto nível → gargalos → trade-offs**.',
        'E lembre: em system design não existe resposta perfeita, existe decisão **bem justificada**. Parabéns por concluir a trilha de Arquitetura! 🏛️',
      ],
      board: null,
    },
  ],
});
