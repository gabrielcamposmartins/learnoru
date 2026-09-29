Game.registerModule('observability', {
  id: 'deploy-seguro',
  title: 'Deploy seguro e feature flags',
  kind: 'lesson',
  level: 2,
  order: 20,
  unit: 'operacao',
  summary: 'Separar deploy de release, ligar funcionalidades por feature flag com rollout determinístico, crescer por canary com análise automática — e ter sempre um caminho de volta, inclusive no banco de dados.',
  concepts: ['Deploy × release', 'Feature flags', 'Canary e blue-green', 'Dark launch e shadow traffic', 'Expand/contract'],
  takeaways: [
    '**Deploy** coloca o código em produção; **release** o mostra ao usuário. Separar os dois (com feature flags) transforma um lançamento arriscado num clique reversível.',
    'Rollout percentual precisa de um **balde estável**: `sha256(f"{flag}:{usuario}") % 100 < pct`. Nada de `random` (a feature pisca) nem de `hash()` do Python (muda a cada processo). O nome da flag no hash evita que os mesmos usuários sejam cobaias de tudo.',
    'Toda flag de release é **dívida**: tem dono, data de validade e é removida quando chega a 100%. Flags velhas multiplicam caminhos e já custaram US$ 460 milhões à Knight Capital.',
    '**Canary** compara a versão nova com uma **baseline** do mesmo tamanho, de forma automática, e só avança com evidência; **blue-green** troca tudo de uma vez e volta com a mesma rapidez. **Dark launch** e **shadow traffic** testam carga e respostas sem o usuário ver nada.',
    'Rollback de código é fácil; de dados, não. Mudanças de schema seguem **expand/contract**, em deploys separados, para que as versões N e N−1 convivam e o rollback continue possível.',
  ],
  glossary: [
    { term: 'Feature flag', aliases: ['feature flags', 'feature toggle', 'feature toggles'], definition: 'Condicional no código controlada **em tempo de execução** (por configuração ou serviço) que liga ou desliga uma funcionalidade sem novo deploy — para todos, por segmento ou por porcentagem de usuários.' },
    { term: 'Canary release', aliases: ['canary', 'canaries', 'canary deploy', 'deploy canário', 'canário'], definition: 'Estratégia em que a versão nova recebe primeiro uma **fatia pequena** do tráfego real (1%, 5%, 25%…) e só avança se suas métricas não forem piores que as da versão atual. O nome vem dos canários que os mineiros levavam para detectar gás.' },
    { term: 'Blue-green', aliases: ['blue-green deployment', 'blue/green', 'azul-verde'], definition: 'Dois ambientes de produção completos: um atende (azul) enquanto o outro recebe a versão nova (verde). O roteador troca **todo** o tráfego de uma vez — e o rollback é trocar de volta.' },
    { term: 'Dark launch', aliases: ['dark launches', 'dark launching', 'lançamento às escuras'], definition: 'Colocar uma funcionalidade para **rodar em produção com tráfego real** sem que o usuário veja o resultado — para medir carga, erros e latência antes do lançamento de verdade.' },
    { term: 'Shadow traffic', aliases: ['tráfego sombra', 'trafego sombra', 'traffic mirroring', 'espelhamento de tráfego', 'shadowing'], definition: 'Cópia das requisições reais enviada também à versão nova; as respostas dela são **descartadas** (ou só comparadas com as da versão atual). Exige cuidado com efeitos colaterais como gravações, e-mails e cobranças.' },
    { term: 'Kill switch', aliases: ['kill switches', 'botão de desligar'], definition: 'Feature flag **operacional** que desliga uma funcionalidade na hora, sem deploy — por exemplo, recomendações pesadas durante um pico de carga. É a mitigação mais rápida que existe.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto é o momento mais perigoso da vida de um sistema: a **mudança**.',
        'A maior parte dos incidentes começa com um deploy. A boa notícia: dá para mudar muito, com frequência — e com segurança.',
      ],
      board: {
        title: 'CI/CD, deploy × release',
        md: `\`\`\`text
 commit ─► CI: build + testes + lint ─► artefato imutável ─► staging ─► produção
                                        (imagem sha256:9f2…)            canary 1% → 5% → 25% → 100%
\`\`\`

| Prática | O que garante |
|---|---|
| **Continuous Integration** | todo commit é integrado ao tronco e testado em minutos |
| **Continuous Delivery** | todo commit que passa **pode** ir para produção com um clique |
| **Continuous Deployment** | todo commit que passa **vai** para produção, sem clique |

A ideia que muda tudo: **deploy não é release**.

| | Deploy | Release |
|---|---|---|
| O que é | código novo rodando em produção | usuário passa a ver a funcionalidade |
| Quem decide | pipeline de CI/CD | produto, com uma **feature flag** |
| Desfazer | outro deploy (minutos) | desligar a flag (segundos) |

> [!dica] **Build once, deploy many**: o **mesmo** artefato (a mesma imagem, pelo mesmo hash) passa por staging e produção; só a configuração muda. Recompilar para cada ambiente é testar uma coisa e publicar outra.

> [!sabia] As pesquisas do **DORA** (*DevOps Research and Assessment*, livro *Accelerate*) mediram milhares de times com quatro métricas — frequência de deploy, *lead time*, taxa de falha de mudanças e tempo de recuperação — e acharam algo contraintuitivo: **velocidade e estabilidade andam juntas**. Os times de elite fazem deploy várias vezes ao dia **e** falham menos, porque mudanças pequenas são fáceis de revisar, testar e desfazer.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Feature flag parece só um `if`. Mas existem tipos bem diferentes — e cada um tem prazo de validade diferente.',
        'E flag esquecida é dívida que cobra juros. Às vezes, juros de centenas de milhões.',
      ],
      board: {
        title: 'Feature flags: tipos e dívida',
        md: `\`\`\`python
if flags.ativa("novo-checkout", usuario):
    return checkout_v2(carrinho)
return checkout_v1(carrinho)
\`\`\`

| Tipo | Para quê | Vive quanto | Quem mexe |
|---|---|---|---|
| **Release** | esconder código incompleto; lançar aos poucos | dias a semanas | dev / produto |
| **Experimento** | teste A/B, por usuário, com métrica de negócio | semanas | produto / dados |
| **Operacional** (*kill switch*) | desligar algo pesado ou quebrado na hora | curto — ou permanente | on-call |
| **Permissão** | beta fechado, plano premium, funcionários | anos | produto / comercial |

**Dívida de flags.** Cada flag ativa dobra os caminhos possíveis: 10 flags são 2¹⁰ = 1.024 combinações que ninguém testou. Práticas que funcionam:

- toda flag nasce com **dono** e **data de validade**;
- flag de release que chegou a 100% vira tarefa de **remoção** (do código **e** do serviço de flags);
- o CI avisa sobre flags vencidas; nunca **reaproveite** o nome de uma flag antiga.

> [!sabia] Em 1º de agosto de 2012, a **Knight Capital** perdeu cerca de **US$ 460 milhões em 45 minutos**. Um deploy manual reaproveitou uma flag que, anos antes, ligava um código morto chamado *Power Peg* — e um dos oito servidores não recebeu a versão nova. Com a flag ligada, esse servidor executou o código antigo e disparou milhões de ordens sozinho. A empresa não sobreviveu ao incidente.

> [!atencao] Flag de **permissão** não substitui autorização no servidor: se o botão some mas o endpoint continua aberto, a "segurança" é só visual.`,
      },
    },
    {
      type: 'say',
      text: [
        '"Ligar para 10% dos usuários" parece trivial. Três implementações óbvias estão erradas — por motivos diferentes.',
        'O truque é um **balde estável** para cada par flag + usuário.',
      ],
      board: {
        title: 'Rollout percentual com hash estável',
        md: `\`\`\`python
import hashlib

def bucket(nome_flag, usuario_id):
    chave = f"{nome_flag}:{usuario_id}".encode()
    return int(hashlib.sha256(chave).hexdigest(), 16) % 100    # 0..99, sempre o mesmo

def no_rollout(nome_flag, usuario_id, percentual):
    return bucket(nome_flag, usuario_id) < percentual
\`\`\`

| Propriedade | Por quê |
|---|---|
| **Determinístico** | o mesmo usuário cai no mesmo balde em qualquer pod, a cada requisição e depois de um restart |
| **Monotônico** | subir de 10% para 20% só **acrescenta** usuários (baldes 10 a 19); ninguém que já via a feature a perde |
| **Com sal (nome da flag)** | cada flag embaralha os usuários de um jeito: não existe um "grupo cobaia" que recebe todo experimento |
| **Uniforme** | o SHA-256 espalha bem até ids sequenciais (\`u1\`, \`u2\`, …) |

Por que não as alternativas óbvias?

- \`random.random() < 0.1\` — a feature **pisca**: aparece numa requisição e some na seguinte, e as métricas do experimento viram ruído.
- \`int(usuario_id) % 100\` — estável, mas sem sal: os ids terminados em 00–09 entram em **todos** os rollouts, e ids sequenciais correlacionam com a data de cadastro.

**Segmentação**: antes da porcentagem, a flag pode ter um *kill switch*, uma lista de ids sempre incluídos (QA, funcionários) e regras por atributo avaliadas **em ordem** — "plano interno: 100%", "país BR: 20%", "demais: 5%".

> [!sabia] Por que não usar o \`hash()\` do Python? Desde o Python 3.3, o hash de \`str\` e \`bytes\` é **aleatorizado por processo** (\`PYTHONHASHSEED\`) para evitar ataques de *hash flooding* contra dicionários. \`hash("u42") % 100\` dá um valor diferente em cada pod e muda a cada restart — o usuário ganha e perde a feature conforme o load balancer o distribui.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Com o código em produção, como trocar a versão sem derrubar ninguém? Há várias estratégias — com custos e tempos de rollback bem diferentes.',
        'E o canary só é seguro de verdade quando a **análise** é automática e justa.',
      ],
      board: {
        title: 'Rolling, blue-green e canary',
        md: `| Estratégia | Como funciona | Rollback | Custo / cuidado |
|---|---|---|---|
| **Recreate** | derruba tudo, sobe a versão nova | outro deploy | tem **downtime** |
| **Rolling update** | troca instâncias em lotes | outro rolling (lento) | as versões N e N−1 convivem durante a troca |
| **Blue-green** | dois ambientes; o roteador troca 100% de uma vez | trocar de volta (segundos) | infraestrutura em dobro; o banco é compartilhado |
| **Canary** | fatia crescente do tráfego: 1% → 5% → 25% → 100% | zerar o peso do canary | precisa de métricas boas e análise automática |

\`\`\`text
                ┌──► v41 (baseline, 5%) ─┐
 tráfego ──► LB ├──► v42 (canary,   5%) ─┼──► compara erros, latência, saturação
                └──► v41 (produção, 90%) ┘       ▲ pior? rollback · igual? próxima etapa
\`\`\`

**Análise automática de canary**, em cada etapa:

1. espere tráfego suficiente (significância) — com 30 requisições, 1 erro já é 3%;
2. compare as métricas do canary com as da baseline (taxa de erro, p99, CPU);
3. regressão clara → **rollback** automático; empate → **promove**; dúvida → **aguarda**.

> [!sabia] Na análise automática de canary da Netflix e do Google (a ferramenta **Kayenta**), o canary **não** é comparado com a produção: um cluster **baseline** novinho, com a versão antiga e do **mesmo tamanho** do canary, sobe junto com ele. A produção tem caches quentes, processos rodando há dias e outro volume de carga — compará-la com um canary recém-nascido acusaria diferenças que não vêm do código.

> [!atencao] Canary só vale se recebe tráfego **representativo**. Um canary que só atende requisições internas, ou só um tipo de cliente, passa sem ter sido testado de verdade.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E se desse para testar a versão nova com o tráfego de produção **sem nenhum usuário perceber**?',
        'Existem duas técnicas pouco conhecidas para isso: **dark launch** e **shadow traffic**.',
      ],
      board: {
        title: 'Dark launch e shadow traffic',
        md: `| Técnica | O código novo roda? | O usuário vê o resultado? | Bom para |
|---|---|---|---|
| **Canary** | sim, para uma fatia | **sim** | validar comportamento com risco limitado |
| **Dark launch** | sim, com tráfego real | **não** (a interface está escondida) | medir carga e erros antes do lançamento |
| **Shadow traffic** | sim, com uma **cópia** das requisições | **não** (a resposta é descartada) | comparar respostas e desempenho, lado a lado |

\`\`\`text
 cliente ──► proxy ──► v41 ──► resposta devolvida ao cliente
               │
               └─ cópia ──► v42 ──► resposta descartada (só comparada e medida)
\`\`\`

**Cuidados com shadow traffic:**

- **efeitos colaterais**: a cópia não pode gravar no banco de verdade, mandar e-mail nem cobrar cartão — use dependências falsas ou só rotas de leitura;
- **carga dobrada** nas dependências compartilhadas (banco, APIs de terceiros, cotas);
- **dados pessoais** passam a trafegar num lugar novo: vale a mesma política de privacidade.

> [!sabia] Em 2008, antes de lançar o chat, o Facebook fez um **dark launch**: as páginas de milhões de usuários passaram a abrir conexões com o backend do chat e trocar mensagens invisíveis, com a interface escondida. Semanas de carga real depois, o lançamento foi um clique. Já o **Diffy**, do Twitter, aperfeiçoou o shadow traffic: manda cada requisição para a versão candidata **e para duas instâncias da versão atual**. O que difere entre as duas atuais (timestamps, ids aleatórios) é **ruído**, e é descontado das diferenças da candidata.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Deu errado. Você volta (**rollback**) ou corrige para frente (**roll forward**)?',
        'Na maioria das vezes, volte primeiro. Mas o banco de dados pode ter fechado essa porta — a não ser que a migração tenha sido feita em **expand/contract**.',
      ],
      board: {
        title: 'Rollback × roll forward e migrações expand/contract',
        md: `| | Rollback | Roll forward |
|---|---|---|
| O que é | voltar à versão anterior | publicar uma correção nova |
| Quando | **padrão** quando o problema coincide com uma mudança recente | a correção é trivial e o pipeline é rápido; ou voltar ficou impossível |
| Risco | baixo — volta a um estado conhecido | médio — mudança nova, feita sob pressão |

**Rollback de código é fácil; de dados, não.** Se a v42 apagou a coluna que a v41 lê, voltar para a v41 quebra tudo. A saída é que **toda** mudança de schema seja compatível com as duas versões que rodam juntas (durante um rolling ou um canary, N e N−1 convivem):

Renomear \`nome\` → \`nome_completo\` em **expand/contract**:

| # | Passo | O que roda |
|---|---|---|
| 1 | **Expand**: \`ALTER TABLE ... ADD COLUMN nome_completo\` (nullable) | só migração |
| 2 | código grava nas **duas** colunas, lê \`nome\` | deploy |
| 3 | *backfill* das linhas antigas, em lotes | job |
| 4 | código passa a ler \`nome_completo\` (ainda grava nas duas) | deploy |
| 5 | código para de gravar em \`nome\` | deploy |
| 6 | **Contract**: \`ALTER TABLE ... DROP COLUMN nome\` | só migração |

Cada passo pode ser revertido sem perder dados — até o 6, que só acontece quando ninguém mais precisa voltar.

> [!atencao] Nunca junte **código novo + migração destrutiva** no mesmo deploy. É exatamente a combinação que transforma um rollback de 2 minutos numa madrugada de restauração de backup.

> [!dica] Durante o incidente, a pergunta não é "qual é a causa raiz?", e sim "qual é a forma **mais rápida e segura** de o usuário parar de sofrer?". Quase sempre é rollback ou desligar uma flag — a investigação vem depois.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Baldes estáveis, estratégias de deploy, um avaliador de flags e um juiz de canary.', icon: '🚦' },
    {
      type: 'mcq',
      id: 'obs-dep-q1',
      concept: 'Rollout determinístico',
      say: 'Primeira: qual destes rollouts sobrevive a 40 pods e a um aumento de porcentagem?',
      prompt: 'O novo checkout vai de **10%** para **20%** dos usuários ao longo do dia, servido por **40 pods**. Qual implementação de `no_rollout(flag, usuario_id, pct)` é a correta?',
      options: [
        { text: '`int(sha256(f"{flag}:{usuario_id}".encode()).hexdigest(), 16) % 100 < pct`', correct: true, why: 'Determinística em qualquer pod, monotônica (de 10% para 20% só entram os baldes 10 a 19) e com o nome da flag como **sal**, para que cada flag sorteie um grupo diferente.' },
        { text: '`random.random() * 100 < pct`', why: 'A decisão muda a cada requisição: a feature **pisca** para o mesmo usuário, o carrinho pode ser criado numa versão e pago na outra, e o experimento não mede nada.' },
        { text: '`hash(usuario_id) % 100 < pct`', why: 'O `hash()` de `str` é **aleatorizado por processo** (`PYTHONHASHSEED`): cada pod calcula um balde diferente, e ele muda a cada restart. E, sem o nome da flag, todas as flags escolheriam os mesmos usuários.' },
        { text: '`int(usuario_id) % 100 < pct`', why: 'É estável e monotônico, mas **sem sal**: os ids terminados em 00–09 caem nos primeiros 10% de **todas** as flags — um grupo cobaia fixo. E, com ids sequenciais, o balde se correlaciona com a data de cadastro.' },
      ],
      explanation: 'Um bom rollout percentual precisa de três propriedades: **determinismo** (mesmo usuário, mesma resposta, em qualquer processo), **monotonicidade** (aumentar a porcentagem só acrescenta usuários) e **independência entre flags** (sal). Uma função de hash estável — SHA-256, MurmurHash, xxHash — sobre `flag:usuario` resolve as três. Serviços como LaunchDarkly e Unleash fazem exatamente isso, com mais baldes (até 100.000) para porcentagens fracionárias.',
    },
    {
      type: 'match',
      id: 'obs-dep-q2',
      concept: 'Estratégias de deploy',
      say: 'Jogo rápido: cada estratégia com o que ela faz.',
      prompt: 'Associe cada técnica à sua descrição.',
      pairs: [
        { left: 'Blue-green', right: 'Dois ambientes completos; o roteador troca todo o tráfego de uma vez' },
        { left: 'Canary', right: 'Fatia pequena e crescente do tráfego real, comparada com a versão atual' },
        { left: 'Rolling update', right: 'Instâncias substituídas em lotes, sem ambiente duplicado' },
        { left: 'Dark launch', right: 'Código novo roda com tráfego real, mas o usuário não vê o resultado' },
        { left: 'Shadow traffic', right: 'Cópia das requisições enviada à versão nova; as respostas são descartadas' },
        { left: 'Kill switch', right: 'Flag operacional que desliga uma funcionalidade na hora, sem deploy' },
      ],
      explanation: 'Elas se combinam: um time maduro faz **dark launch** ou **shadow traffic** para validar carga e respostas, lança por **canary** com análise automática (ou **blue-green**, quando precisa trocar tudo de uma vez) e deixa um **kill switch** pronto para o plantão. O **rolling update** é o padrão de orquestradores como o Kubernetes — e lembra que, durante a troca, as versões N e N−1 atendem ao mesmo tempo.',
    },
    {
      type: 'code',
      id: 'obs-dep-q3',
      concept: 'Feature flags',
      title: 'Avaliador de feature flags',
      say: 'Agora você vai escrever o coração de um serviço de feature flags. Sem sorteios: tudo determinístico.',
      prompt: `Uma flag é um dicionário assim (as chaves \`permitidos\` e \`regras\` são **opcionais**):

\`\`\`python
{
    "nome": "novo-checkout",
    "ativa": True,                      # kill switch: False desliga para todo mundo
    "permitidos": ["qa-1", "lia"],      # ids que sempre veem a feature
    "regras": [                         # segmentação, avaliada em ordem
        {"atributo": "plano", "valores": ["interno"], "rollout": 100},
        {"atributo": "pais", "valores": ["BR"], "rollout": 20},
    ],
    "rollout": 5,                       # % para quem não casou nenhuma regra
}
\`\`\`

O usuário é um dicionário como \`{"id": "u42", "pais": "BR", "plano": "free"}\` — atributos podem **faltar**.

1. \`bucket(nome_flag, usuario_id)\` → inteiro de 0 a 99: \`int(sha256(f"{nome_flag}:{usuario_id}".encode()).hexdigest(), 16) % 100\`.
2. \`no_rollout(nome_flag, usuario_id, percentual)\` → \`True\` se o balde é **menor** que o percentual (0 → ninguém; 100 → todos).
3. \`avaliar(flag, usuario)\` → \`bool\`, nesta ordem:
   - flag inativa → \`False\` (o kill switch vence tudo);
   - id em \`permitidos\` → \`True\`;
   - a **primeira** regra cujo atributo do usuário está em \`valores\` decide, com o rollout **dela**;
   - nenhuma regra casou → rollout padrão da flag.`,
      starter: `import hashlib


def bucket(nome_flag, usuario_id):
    """Balde estável de 0 a 99 para o par (flag, usuário)."""
    pass


def no_rollout(nome_flag, usuario_id, percentual):
    """True se o usuário cai dentro dos primeiros 'percentual' baldes."""
    pass


def avaliar(flag, usuario):
    """True se a flag está ligada para este usuário."""
    pass
`,
      tests: [
        { name: 'bucket usa sha256 de "flag:usuario"', expr: 'bucket("novo-checkout", "u42")', expected: 'int(__import__("hashlib").sha256(b"novo-checkout:u42").hexdigest(), 16) % 100' },
        {
          name: 'baldes ficam entre 0 e 99 e se espalham',
          code: `baldes = [bucket("busca-v2", f"u{i}") for i in range(2000)]
assert all(0 <= b <= 99 for b in baldes), "todo balde deve estar entre 0 e 99"
assert len(set(baldes)) == 100, "2.000 usuários deveriam ocupar os 100 baldes"`,
        },
        {
          name: 'subir de 10% para 20% só acrescenta usuários',
          code: `dez = {i for i in range(2000) if no_rollout("novo-checkout", f"u{i}", 10)}
vinte = {i for i in range(2000) if no_rollout("novo-checkout", f"u{i}", 20)}
assert dez <= vinte, "quem estava nos 10% precisa continuar nos 20% (monotonicidade)"
assert 150 < len(dez) < 250, f"~10% de 2.000 usuários deveriam entrar; entraram {len(dez)}"`,
        },
        {
          name: 'flags diferentes sorteiam grupos diferentes',
          code: `a = {i for i in range(2000) if no_rollout("flag-a", f"u{i}", 10)}
b = {i for i in range(2000) if no_rollout("flag-b", f"u{i}", 10)}
assert len(a & b) < len(a) / 2, "o nome da flag deve entrar no hash: senão os mesmos usuários caem em todo rollout"`,
        },
        { name: 'kill switch vence até a lista de permitidos', expr: 'avaliar({"nome": "x", "ativa": False, "permitidos": ["u1"], "rollout": 100}, {"id": "u1"})', expected: 'False' },
        { name: 'permitidos veem a feature mesmo com rollout 0', expr: 'avaliar({"nome": "x", "ativa": True, "permitidos": ["qa-1"], "rollout": 0}, {"id": "qa-1"})', expected: 'True' },
        {
          name: 'segmentação por atributo',
          code: `flag = {"nome": "pix-parcelado", "ativa": True, "rollout": 0,
        "regras": [{"atributo": "pais", "valores": ["BR", "PT"], "rollout": 100}]}
assert avaliar(flag, {"id": "u1", "pais": "BR"}) is True, "usuário do BR casa a regra de 100%"
assert avaliar(flag, {"id": "u2", "pais": "PT"}) is True, "usuário de PT também casa"
assert avaliar(flag, {"id": "u3", "pais": "US"}) is False, "US não casa nenhuma regra: vale o rollout padrão (0)"`,
        },
        {
          name: 'a primeira regra que casa decide',
          code: `flag = {"nome": "x", "ativa": True, "rollout": 100, "regras": [
    {"atributo": "pais", "valores": ["BR"], "rollout": 0},
    {"atributo": "plano", "valores": ["interno"], "rollout": 100},
]}
assert avaliar(flag, {"id": "u1", "pais": "BR", "plano": "interno"}) is False, "a regra de país vem antes e decide (rollout 0)"
assert avaliar(flag, {"id": "u1", "pais": "AR", "plano": "interno"}) is True, "sem casar o país, a regra de plano decide"`,
        },
        { name: 'atributo ausente não quebra e não casa', expr: 'avaliar({"nome": "x", "ativa": True, "rollout": 100, "regras": [{"atributo": "pais", "valores": ["BR"], "rollout": 0}]}, {"id": "u9"})', expected: 'True' },
        {
          name: 'o rollout da regra usa o mesmo balde estável',
          hidden: true,
          code: `flag = {"nome": "novo-checkout", "ativa": True, "rollout": 0,
        "regras": [{"atributo": "pais", "valores": ["BR"], "rollout": 50}]}
for i in range(300):
    uid = f"u{i}"
    esperado = bucket("novo-checkout", uid) < 50
    assert avaliar(flag, {"id": uid, "pais": "BR"}) == esperado, f"{uid}: a regra deveria usar bucket(nome da flag, id) < 50"`,
        },
        {
          name: 'rollout 0 não liga ninguém; 100 liga todos',
          hidden: true,
          code: `assert not any(no_rollout("x", f"u{i}", 0) for i in range(500)), "0% não inclui ninguém"
assert all(no_rollout("x", f"u{i}", 100) for i in range(500)), "100% inclui todo mundo"`,
        },
        { name: 'flag sem chaves opcionais usa só o rollout padrão', hidden: true, expr: '[avaliar({"nome": "y", "ativa": True, "rollout": 100}, {"id": "a"}), avaliar({"nome": "y", "ativa": True, "rollout": 0}, {"id": "a"})]', expected: '[True, False]' },
      ],
      reviews: [
        {
          when: m => m.calls.includes('hash'),
          text: 'Cuidado com o `hash()` embutido: para `str`, ele é **aleatorizado por processo** (`PYTHONHASHSEED`). Cada pod calcularia um balde diferente, e o usuário ganharia e perderia a feature a cada requisição. Use um hash estável como `hashlib.sha256`.',
          concept: 'Hash estável',
        },
        {
          when: m => m.imports.includes('random'),
          text: 'Sorteio não serve para rollout: a mesma pessoa veria a feature numa requisição e não na seguinte. A decisão precisa ser uma **função pura** de (flag, usuário).',
          concept: 'Rollout determinístico',
        },
        {
          when: m => m.maxComplexity > 8,
          text: '`avaliar` ficou com decisões demais. Reaproveite `no_rollout` nas regras e no padrão e use *guard clauses*: kill switch, permitidos, regras, padrão — nessa ordem, cada um com o seu `return`.',
          concept: 'Guard clauses',
        },
      ],
      hints: [
        '`bucket`: `chave = f"{nome_flag}:{usuario_id}".encode()` e `return int(hashlib.sha256(chave).hexdigest(), 16) % 100`.',
        '`no_rollout` é uma linha: `return bucket(nome_flag, usuario_id) < percentual`.',
        'Em `avaliar`, use `flag.get("permitidos", [])` e `flag.get("regras", [])`, e `usuario.get(regra["atributo"])` — `None` nunca estará em `valores`. Dentro do laço, a primeira regra que casar já faz `return no_rollout(flag["nome"], usuario["id"], regra["rollout"])`.',
      ],
      solution: `import hashlib


def bucket(nome_flag, usuario_id):
    """Balde estável de 0 a 99 para o par (flag, usuário)."""
    chave = f"{nome_flag}:{usuario_id}".encode()
    return int(hashlib.sha256(chave).hexdigest(), 16) % 100


def no_rollout(nome_flag, usuario_id, percentual):
    """True se o usuário cai dentro dos primeiros 'percentual' baldes."""
    return bucket(nome_flag, usuario_id) < percentual


def avaliar(flag, usuario):
    """True se a flag está ligada para este usuário."""
    if not flag["ativa"]:
        return False
    if usuario["id"] in flag.get("permitidos", []):
        return True
    for regra in flag.get("regras", []):
        if usuario.get(regra["atributo"]) in regra["valores"]:
            return no_rollout(flag["nome"], usuario["id"], regra["rollout"])
    return no_rollout(flag["nome"], usuario["id"], flag["rollout"])
`,
      solutionExplanation: 'O avaliador é uma **função pura** de (flag, usuário): nenhum estado, nenhum sorteio, nenhum relógio — por isso pode rodar dentro de cada serviço (os SDKs de LaunchDarkly e Unleash baixam as regras e avaliam localmente, sem uma chamada de rede por decisão). A ordem das regras é a política: o **kill switch** vem primeiro porque, às 3h da manhã, "desligar" tem de significar desligar para todo mundo, inclusive para a lista de QA. O balde usa o **nome da flag como sal**, o que torna flags independentes, e a comparação `< percentual` torna o rollout **monotônico**: ir de 10% para 20% só acrescenta os baldes 10 a 19. Um detalhe que costuma passar batido: como o balde é o mesmo nas regras e no padrão, mover um usuário de segmento não o sorteia de novo. Em produção, some a isso *telemetria de avaliação* (qual flag, qual variante, para quem) — sem ela, "a feature estava ligada para esse cliente?" vira arqueologia durante o incidente.',
    },
    {
      type: 'code',
      id: 'obs-dep-q4',
      concept: 'Análise de canary',
      title: 'Juiz de canary',
      say: 'Agora o juiz que decide se o canary avança, espera ou volta. Voltar exige pouca evidência; avançar exige muita.',
      prompt: `Um controlador de *progressive delivery* leva o canary pelas \`ETAPAS\` (% do tráfego). A cada análise, recebe as contagens do período para a **baseline** e o **canary**: \`{"total": int, "erros": int}\`.

1. \`taxa_erro(amostra)\` → \`erros ÷ total\`; sem tráfego, \`0.0\`.
2. \`decidir(baseline, canary, min_req=1000, min_erros=10, razao_max=1.5, margem=0.002)\` → \`"rollback"\`, \`"aguardar"\` ou \`"promover"\`. O canary é **pior** quando a taxa dele é **maior** que \`taxa_baseline × razao_max\` **e** também **maior** que \`taxa_baseline + margem\`. Regras, nesta ordem:
   - **freio de emergência**: pior e o canary já tem pelo menos \`min_erros\` erros → \`"rollback"\`, mesmo com pouco tráfego;
   - canary **ou** baseline com menos de \`min_req\` requisições → \`"aguardar"\`;
   - pior → \`"rollback"\`; senão → \`"promover"\`.
3. \`proxima_etapa(atual, decisao)\` → \`0\` no rollback, \`atual\` ao aguardar e, ao promover, a **primeira** etapa de \`ETAPAS\` maior que \`atual\` (se não houver, fica em \`atual\`).`,
      starter: `ETAPAS = [1, 5, 25, 50, 100]   # % do tráfego no canary, em ordem


def taxa_erro(amostra):
    """erros / total; 0.0 sem tráfego."""
    pass


def decidir(baseline, canary, min_req=1000, min_erros=10, razao_max=1.5, margem=0.002):
    """'rollback', 'aguardar' ou 'promover'."""
    pass


def proxima_etapa(atual, decisao):
    """% de tráfego do canary depois da decisão."""
    pass
`,
      tests: [
        { name: 'taxa de erro', expr: 'taxa_erro({"total": 2000, "erros": 10})', expected: '0.005', compare: 'approx' },
        { name: 'sem tráfego → 0.0', expr: 'taxa_erro({"total": 0, "erros": 0})', expected: '0.0' },
        { name: 'canary parecido com a baseline → promover', expr: 'decidir({"total": 5000, "erros": 10}, {"total": 5000, "erros": 12})', expected: '"promover"' },
        { name: 'regressão clara (0,2% → 1,2%) → rollback', expr: 'decidir({"total": 5000, "erros": 10}, {"total": 5000, "erros": 60})', expected: '"rollback"' },
        { name: 'baseline sem erros e canary com 0,1%: abaixo da margem → promover', expr: 'decidir({"total": 5000, "erros": 0}, {"total": 5000, "erros": 5})', expected: '"promover"' },
        { name: 'pouco tráfego e nada de errado → aguardar', expr: 'decidir({"total": 300, "erros": 0}, {"total": 300, "erros": 0})', expected: '"aguardar"' },
        { name: 'freio de emergência: metade falhando com pouco tráfego → rollback', expr: 'decidir({"total": 300, "erros": 0}, {"total": 300, "erros": 150})', expected: '"rollback"' },
        { name: 'pior, mas com só 3 erros e pouco tráfego → aguardar', expr: 'decidir({"total": 50, "erros": 0}, {"total": 50, "erros": 3})', expected: '"aguardar"' },
        { name: 'próximas etapas', expr: '[proxima_etapa(1, "promover"), proxima_etapa(25, "aguardar"), proxima_etapa(50, "rollback"), proxima_etapa(100, "promover")]', expected: '[5, 25, 0, 100]' },
        { name: 'taxa base alta: 5% → 6% fica dentro da razão → promover', hidden: true, expr: 'decidir({"total": 5000, "erros": 250}, {"total": 5000, "erros": 300})', expected: '"promover"' },
        { name: 'baseline com pouco tráfego → aguardar', hidden: true, expr: 'decidir({"total": 200, "erros": 0}, {"total": 5000, "erros": 1})', expected: '"aguardar"' },
        { name: 'etapa fora da tabela promove para a próxima maior', hidden: true, expr: 'proxima_etapa(10, "promover")', expected: '25' },
        {
          name: 'simulação: sobe até 25% e volta na regressão',
          hidden: true,
          code: `analises = [
    ({"total": 400, "erros": 0}, {"total": 400, "erros": 0}),
    ({"total": 4000, "erros": 4}, {"total": 4000, "erros": 5}),
    ({"total": 9000, "erros": 9}, {"total": 9000, "erros": 8}),
    ({"total": 9000, "erros": 9}, {"total": 9000, "erros": 90}),
]
etapa, historico = 1, []
for base, can in analises:
    etapa = proxima_etapa(etapa, decidir(base, can))
    historico.append(etapa)
assert historico == [1, 5, 25, 0], f"esperado [1, 5, 25, 0], veio {historico}"`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /\b(25|50)\b/.test(code.replace(/ETAPAS\s*=\s*\[[^\]]*\]/, '')),
          text: 'As etapas aparecem chumbadas fora de `ETAPAS`. Percorra a tabela (ex.: `next((e for e in ETAPAS if e > atual), atual)`): mudar a cadência do rollout deve ser a edição de uma linha.',
          concept: 'Configuração dirigida por dados',
        },
        {
          when: m => m.maxComplexity > 10,
          text: '`decidir` acumulou ramos demais. Calcule `pior` uma vez, numa variável com nome, e escreva as três regras como *guard clauses* na ordem do enunciado.',
          concept: 'Guard clauses',
        },
      ],
      hints: [
        '`taxa_erro`: `return amostra["erros"] / amostra["total"] if amostra["total"] else 0.0`.',
        'Em `decidir`, calcule `tb` e `tc` e depois `pior = tc > tb * razao_max and tc > tb + margem`. As duas condições juntas evitam alarmes com taxas minúsculas (0% → 0,1%) **e** com taxas altas (5% → 6%).',
        'Ordem: `if pior and canary["erros"] >= min_erros: return "rollback"`; depois `if canary["total"] < min_req or baseline["total"] < min_req: return "aguardar"`; por fim `return "rollback" if pior else "promover"`. Em `proxima_etapa`, `next((e for e in ETAPAS if e > atual), atual)`.',
      ],
      solution: `ETAPAS = [1, 5, 25, 50, 100]   # % do tráfego no canary, em ordem


def taxa_erro(amostra):
    """erros / total; 0.0 sem tráfego."""
    if amostra["total"] == 0:
        return 0.0
    return amostra["erros"] / amostra["total"]


def decidir(baseline, canary, min_req=1000, min_erros=10, razao_max=1.5, margem=0.002):
    """'rollback', 'aguardar' ou 'promover'."""
    tb, tc = taxa_erro(baseline), taxa_erro(canary)
    pior = tc > tb * razao_max and tc > tb + margem
    if pior and canary["erros"] >= min_erros:
        return "rollback"            # freio de emergência: voltar exige pouca evidência
    if canary["total"] < min_req or baseline["total"] < min_req:
        return "aguardar"            # avançar exige volume
    return "rollback" if pior else "promover"


def proxima_etapa(atual, decisao):
    """% de tráfego do canary depois da decisão."""
    if decisao == "rollback":
        return 0
    if decisao == "aguardar":
        return atual
    return next((e for e in ETAPAS if e > atual), atual)
`,
      solutionExplanation: 'O juiz é **assimétrico** de propósito. Voltar é barato e seguro, então o freio de emergência dispara com poucos erros: 150 falhas em 300 requisições não precisam de mais estatística. Avançar expõe mais usuários, então exige **volume** nos dois lados — com 50 requisições, 3 erros podem ser azar. O critério "pior" combina **razão** e **margem absoluta** porque cada uma sozinha falha: só a razão faria 0 → 1 erro em 5.000 parecer uma regressão infinita; só a margem aceitaria triplicar uma taxa de 0,05%. E compare sempre com uma **baseline** do mesmo tamanho e da mesma idade, não com a produção inteira. Ferramentas como Kayenta, Argo Rollouts e Flagger fazem isso com várias métricas ao mesmo tempo (erros, p99, CPU) e testes estatísticos (Mann-Whitney), mas a estrutura é esta: **medir → comparar → promover, aguardar ou voltar**, em etapas.',
    },
    {
      type: 'order',
      id: 'obs-dep-q5',
      concept: 'Expand/contract',
      say: 'Agora o banco de dados: renomear uma coluna sem downtime e sem perder o rollback.',
      prompt: 'Coloque em ordem os passos para renomear a coluna `nome` para `nome_completo`, com as versões N e N−1 do código rodando juntas durante cada deploy.',
      items: [
        'Migração aditiva: criar `nome_completo` (nullable), sem tocar em `nome`',
        'Deploy: o código grava nas duas colunas e continua lendo `nome`',
        'Backfill: copiar `nome` para `nome_completo` nas linhas antigas, em lotes',
        'Deploy: o código passa a ler `nome_completo`, ainda gravando nas duas',
        'Deploy: o código para de gravar em `nome`',
        'Migração de contração: remover a coluna `nome`',
      ],
      explanation: 'É o padrão **expand/contract** (ou *parallel change*): primeiro **expandir** (o novo convive com o antigo), depois **migrar** leitores e escritores, e só no fim **contrair**. Em cada passo, a versão anterior do código continua funcionando, então qualquer deploy pode ser revertido sem perda de dados. O backfill vem **depois** da gravação dupla — senão as linhas escritas durante o backfill ficariam sem o valor novo — e roda em lotes, para não travar a tabela. Parece burocrático, mas são seis passos pequenos e reversíveis no lugar de um grande e irreversível.',
    },
    {
      type: 'mcq',
      id: 'obs-dep-q6',
      concept: 'Rollback × roll forward',
      say: 'Última: quando o rollback deixa de ser uma opção.',
      prompt: 'A v42 foi para produção às 14h00 com uma migração que **removeu** a coluna `apelido` (a v42 não a usa mais). Às 14h10, 8% das requisições do serviço de perfis falham por um bug **não relacionado** à coluna, numa funcionalidade nova protegida por feature flag. O que fazer?',
      options: [
        { text: 'Desligar a flag da funcionalidade nova agora; depois corrigir o bug com uma v43 (roll forward) — e, no postmortem, registrar que a migração destrutiva não deveria ter ido junto com o código', correct: true, why: 'Desligar a flag é a mitigação mais rápida e não depende do banco. O rollback para a v41 está bloqueado porque ela lê `apelido`, que não existe mais; por isso a correção vai para frente. A lição é separar o *contract* em um deploy próprio.' },
        { text: 'Fazer rollback para a v41 imediatamente: rollback é sempre a primeira opção', why: 'A v41 lê a coluna `apelido`, que foi apagada: o rollback trocaria 8% de erros por ~100%. Rollback é o padrão **quando é seguro** — e a migração destrutiva tirou essa segurança.' },
        { text: 'Restaurar o backup do banco das 13h59 e então fazer rollback para a v41', why: 'Perde todas as escritas feitas depois do backup, leva muito tempo e tem um raio de impacto enorme — para um problema que uma flag resolve em segundos. Restaurar backup é o último recurso.' },
        { text: 'Deixar como está e investigar a causa raiz antes de mexer em qualquer coisa', why: 'Com 8% de falhas, o usuário sofre enquanto você investiga. **Mitigue primeiro**: a flag existe exatamente para isso. A causa raiz vem depois, com calma.' },
      ],
      explanation: 'A ordem das perguntas durante um incidente é: **o que para o sofrimento mais rápido e com menos risco?** Desligar uma flag, voltar a versão, drenar tráfego. Aqui, a flag resolve; o rollback, que seria o padrão, foi bloqueado pela migração destrutiva — é o preço de juntar código novo e *contract* no mesmo deploy. **Roll forward** é legítimo quando voltar é impossível ou mais arriscado, mas é uma mudança nova feita sob pressão: mantenha-a pequena, e passe pelo mesmo pipeline e pelo mesmo canary.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Agora você separa deploy de release, faz rollout com baldes estáveis e deixa o canary decidir com dados.',
        { text: 'E nunca mais junta código novo com migração destrutiva no mesmo deploy, combinado?', mood: 'cheer' },
      ],
      board: null,
    },
  ],
});
