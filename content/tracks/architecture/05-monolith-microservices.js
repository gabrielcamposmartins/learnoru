Game.registerModule('architecture', {
  id: 'monolith-microservices',
  title: 'Monólito vs Microsserviços',
  kind: 'lesson',
  level: 2,
  order: 12,
  unit: 'estilos',
  summary: 'Monólito, monólito modular e microsserviços: trade-offs, lei de Conway, strangler fig e falhas de rede.',
  concepts: ['Monólito modular', 'Microsserviços', 'Lei de Conway', 'Strangler Fig', 'Retry com backoff'],
  takeaways: [
    'Monólito não é palavrão: para um time só e um domínio instável, um **monólito modular** (módulos com API pública) é quase sempre a melhor escolha.',
    'Microsserviços compram **autonomia de times** e deploy independente pagando um **prêmio** alto: rede, observabilidade, consistência eventual.',
    'Serviços que dividem o banco ou exigem deploy conjunto formam um **monólito distribuído** — o pior dos dois mundos.',
    'A **Lei de Conway** liga arquitetura e organização: corte serviços por **domínio de negócio**, não por camada técnica nem por entidade.',
    'Migre com **Strangler Fig**, uma fatia por vez, e trate a rede como algo que falha: timeouts, retries com backoff e idempotência.',
  ],
  glossary: [
    { term: 'Monólito modular', aliases: ['monólitos modulares', 'modular monolith'], definition: 'Aplicação com **um deploy** (e, em geral, um banco) dividida em módulos por domínio que só conversam por APIs públicas. Une a simplicidade do monólito a fronteiras que facilitam extrair serviços depois.' },
    { term: 'Monólito distribuído', aliases: ['monólitos distribuídos', 'distributed monolith'], definition: 'Anti-pattern: "microsserviços" que dividem o banco ou precisam de deploy conjunto. Pagam a complexidade da rede sem ganhar independência — o pior dos dois mundos.' },
    { term: 'Lei de Conway', aliases: ["Conway's law", 'manobra inversa de Conway', 'inverse Conway maneuver'], definition: 'Observação de Melvin Conway (1968): organizações projetam sistemas que **espelham suas estruturas de comunicação**. A "manobra inversa" organiza os times do jeito que se quer a arquitetura.' },
    { term: 'Strangler Fig', aliases: ['figueira estranguladora', 'strangler fig pattern', 'Strangler Fig Application'], definition: 'Padrão de migração incremental batizado por Martin Fowler: um roteador na frente do legado desvia funcionalidades, uma a uma, para o sistema novo, até o antigo poder ser desligado. Evita o *big bang rewrite*.' },
    { term: 'Microservice premium', aliases: ['microservices premium', 'prêmio dos microsserviços'], definition: 'Custo fixo de produtividade que microsserviços impõem: deploys, observabilidade, contratos entre serviços, consistência eventual. Para Martin Fowler, só se paga quando o sistema é complexo demais para um monólito.' },
    { term: 'Entity service', aliases: ['entity services', 'serviço de entidade', 'serviços de entidade'], definition: 'Anti-pattern descrito por Michael Nygard: um microsserviço por entidade (`ServicoCliente`, `ServicoProduto`). Todo caso de uso vira uma conversa entre vários serviços — acoplamento alto, agora pela rede.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Essa é talvez a discussão de arquitetura mais popular — e mais cheia de hype: **monólito ou microsserviços?**',
        'Spoiler: a resposta de sênior quase sempre começa com "**depende**"… e termina explicando *do quê* depende.',
      ],
      board: {
        title: 'Três estilos',
        md: `\`\`\`text
 MONÓLITO             MONÓLITO MODULAR          MICROSSERVIÇOS
┌────────────┐       ┌────────────────┐       ┌──────┐  ┌──────┐
│ tudo junto │       │┌──────┐┌──────┐│       │Pedido│  │Pagto │
│ um deploy  │       ││Pedido││Pagto ││       │  +DB │  │  +DB │
│ um banco   │       │└──────┘└──────┘│       └──┬───┘  └──┬───┘
└────────────┘       │┌──────┐ 1 deploy│          └─ rede ─┘
                     ││Estoq.│ fronteiras│       ┌──────┐
                     │└──────┘ claras  │       │Estoq.│ deploys
                     └────────────────┘       │  +DB │ independentes
                                               └──────┘
\`\`\``,
      },
    },
    {
      type: 'say',
      text: [
        'O **monólito** é uma única aplicação, com um deploy e geralmente um banco. Ele tem uma fama injusta!',
        'Chamadas são funções locais, transações são simples e o deploy é um só. Para times pequenos, é quase sempre a escolha certa.',
        'O problema aparece quando ele vira uma **grande bola de lama**: tudo acessa tudo, e qualquer mudança quebra algo distante.',
      ],
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'O meio-termo que eu mais recomendo é o **monólito modular**: um deploy só, mas com **módulos bem separados**.',
        'Cada módulo expõe uma API pública pequena e esconde o resto. Os outros módulos só conversam por essa API — nunca mexem nas tabelas alheias.',
      ],
      board: {
        title: 'Monólito modular em Python',
        code: `# loja/
#   pedidos/
#     __init__.py     ← API pública do módulo
#     _dominio.py     ← privado (prefixo _)
#     _repositorio.py
#   estoque/
#     __init__.py
#     ...

# estoque/__init__.py — só isso é "público"
from ._servico import reservar, disponivel

__all__ = ["reservar", "disponivel"]


# pedidos/_servico.py
from loja import estoque          # ✅ usa a API pública

def criar_pedido(itens):
    for sku, qtd in itens:
        estoque.reservar(sku, qtd)
    ...

# from loja.estoque._repositorio import ...   ❌ atravessa a fronteira`,
        caption: 'Fronteiras bem definidas hoje = microsserviço fácil de extrair amanhã (se precisar).',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Já os **microsserviços** são serviços pequenos, com **deploy independente** e **banco próprio**, que conversam pela rede.',
        'O ganho é autonomia: cada time evolui, escala e publica o seu serviço sem esperar os outros.',
        'O custo é enorme: rede que falha, dados espalhados, observabilidade distribuída, versões de API… a complexidade operacional explode.',
      ],
      board: {
        title: 'Trade-offs',
        md: `| Critério | Monólito (modular) | Microsserviços |
|---|---|---|
| Deploy | Único, simples | Independente por serviço |
| Escala | O app inteiro | Cada serviço separadamente |
| Consistência | Transações ACID locais | Eventual, sagas, compensações |
| Comunicação | Chamada de função | Rede (latência, falhas, timeouts) |
| Operação | Um app para monitorar | Dezenas: tracing, service mesh, CI/CD por serviço |
| Autonomia de times | Menor (coordenação) | Maior |
| Tecnologia | Uma stack | Poliglota (se quiser) |

> [!atencao] Microsserviços que compartilham o **mesmo banco** ou precisam de **deploy conjunto** são um **monólito distribuído**: os custos dos dois mundos, sem os benefícios.`,
      },
    },
    {
      type: 'say',
      text: [
        'Um conceito que sempre impressiona em entrevistas: a **Lei de Conway**.',
        '"Organizações projetam sistemas que espelham suas estruturas de comunicação." Ou seja: a arquitetura acaba parecendo o organograma.',
        'Por isso microsserviços fazem mais sentido quando há **vários times** independentes, cada um dono de um domínio de negócio.',
      ],
      board: {
        title: 'Lei de Conway e bounded contexts',
        md: `- **3 devs, 1 time** → um serviço por time = **um** serviço. Monólito modular!
- **8 times** pisando no mesmo código e brigando por deploys → sinal para separar.
- Os cortes devem seguir **domínios de negócio** (*bounded contexts* do DDD): Pedidos, Pagamentos, Catálogo — nunca camadas técnicas ("serviço de banco", "serviço de validação").

> [!dica] "Manobra inversa de Conway": organize os times do jeito que você quer que a arquitetura fique.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Martin Fowler tem um nome para o custo que ninguém coloca na planilha: o **prêmio dos microsserviços**.',
        'Microsserviços cobram uma taxa fixa de produtividade — e ela só se paga quando o sistema fica complexo o bastante.',
      ],
      board: {
        title: 'O prêmio dos microsserviços',
        md: `| Complexidade do sistema | Monólito (modular) | Microsserviços |
|---|---|---|
| Baixa — produto novo, um time | 🚀 rápido e barato | 🐢 paga o prêmio sem retorno |
| Média — alguns times | ✅ ainda funciona bem | ⚖️ empate |
| Alta — muitos times, domínios estáveis | 🐢 deploys travados, bola de lama | 🚀 a autonomia compensa |

O que compõe o prêmio: deploy e monitoramento de muitos serviços, *tracing* distribuído, contratos de API versionados, consistência eventual (sagas!) e testes de integração entre serviços.

Um anti-pattern escondido aqui: o **entity service** — um serviço por entidade (\`ServicoCliente\`, \`ServicoProduto\`). Todo caso de uso vira uma conversa entre vários serviços: o acoplamento continua alto, só que agora pela rede.

> [!sabia] Fowler chamou esse custo de **microservice premium** (2015) e resumiu: "nem considere microsserviços, a menos que o sistema seja complexo demais para gerenciar como monólito". E a Lei de Conway tem uma história curiosa: Melvin Conway mandou o artigo para a *Harvard Business Review*, que o **recusou** por "falta de provas". Ele saiu em 1968 na revista *Datamation* — e quem o batizou de "Lei de Conway" foi Fred Brooks, em *O Mítico Homem-Mês*.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'E se o monólito já existe e precisa ser quebrado? **Nunca** reescreva tudo do zero de uma vez.',
        'Use o padrão **Strangler Fig** (figueira estranguladora): um roteador na frente, e funcionalidades migram uma a uma para serviços novos até o monólito "secar".',
      ],
      board: {
        title: 'Strangler Fig',
        md: `\`\`\`text
             ┌──────────────┐
 clientes ──▶│  roteador /  │── /pagamentos ──▶ [ novo serviço Pagamentos ]
             │  API gateway │
             └──────┬───────┘
                    └──── todo o resto ──▶ [ monólito legado ]

 passo 1: extrai Pagamentos · passo 2: extrai Catálogo · … · monólito some
\`\`\`

Cada passo é pequeno, reversível e entrega valor — ao contrário do "big bang rewrite".`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Uma última coisa: em sistemas distribuídos, **a rede vai falhar**. Timeouts, instabilidade, serviços reiniciando…',
        'Por isso chamadas remotas usam **retry com backoff exponencial**: tenta de novo esperando cada vez mais (0,1s, 0,2s, 0,4s…) para não afogar o serviço que está se recuperando.',
      ],
      board: {
        title: 'Resiliência: retry, backoff e circuit breaker',
        md: `- **Timeout**: nunca espere para sempre por outro serviço.
- **Retry com backoff exponencial**: \`espera = base * 2 ** tentativa\` (+ um *jitter* aleatório para os clientes não sincronizarem).
- **Circuit breaker**: depois de muitas falhas seguidas, "abre o circuito" e falha rápido por um tempo, dando fôlego ao serviço.
- **Idempotência**: só faça retry de operações que podem ser repetidas com segurança!

\`\`\`python
espera = 0.1
for tentativa in range(3):
    try:
        return chamar_servico()
    except ConnectionError:
        time.sleep(espera)
        espera *= 2
\`\`\``,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões sobre estilos arquiteturais e resiliência.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-micro-q1',
      concept: 'Monólito modular',
      say: 'Cenário real de startup. O que você recomendaria?',
      prompt: 'Uma startup com **6 desenvolvedores** (um único time) está validando o produto e muda regras de negócio toda semana. Qual arquitetura você recomendaria?',
      options: [
        { text: 'Monólito modular, com fronteiras claras entre domínios.', correct: true, why: 'Um time pequeno ganha velocidade com um deploy só, e as fronteiras deixam a porta aberta para extrair serviços no futuro.' },
        { text: 'Microsserviços desde o início, para já nascer escalável.', why: 'O custo operacional seria enorme para 6 pessoas, e os limites de domínio ainda estão mudando — cortar errado sai caro.' },
        { text: 'Um microsserviço por tabela do banco.', why: 'Cortes por entidade/tabela geram serviços extremamente acoplados (monólito distribuído).' },
        { text: 'Serverless com uma função por endpoint, sem módulos.', why: 'Sem fronteiras de domínio, vira uma bola de lama espalhada em dezenas de funções.' },
      ],
      explanation: 'Com **um time** e domínio ainda instável, o **monólito modular** oferece simplicidade (um deploy, transações locais) e organização (módulos com API pública). Microsserviços resolvem problemas de **escala organizacional** que essa empresa ainda não tem.',
    },
    {
      type: 'mcq',
      id: 'arq-micro-q2',
      concept: 'Monólito distribuído',
      say: 'Agora um anti-pattern bem comum.',
      prompt: 'Uma empresa tem 10 "microsserviços" que **leem e escrevem nas mesmas tabelas** de um banco compartilhado e precisam ser publicados **juntos**. Como isso é chamado?',
      options: [
        { text: 'Monólito distribuído', correct: true, why: 'Tem o acoplamento de um monólito (banco e deploy compartilhados) somado à complexidade da rede.' },
        { text: 'Monólito modular', why: 'Monólito modular é um único deploy com fronteiras claras — aqui as fronteiras não existem.' },
        { text: 'Arquitetura hexagonal', why: 'Hexagonal fala da organização interna de uma aplicação (portas e adapters), não disso.' },
        { text: 'Microsserviços bem feitos — compartilhar o banco evita duplicação.', why: 'Banco compartilhado impede evolução independente: mudar uma coluna quebra vários serviços.' },
      ],
      explanation: 'Um sinal essencial de microsserviços é o **deploy independente**, e para isso cada serviço precisa ser **dono dos seus dados**. Banco compartilhado + deploy conjunto = **monólito distribuído**.',
    },
    {
      type: 'mcq',
      id: 'arq-micro-q3',
      concept: 'Strangler Fig',
      say: 'Como você migraria um sistema legado?',
      prompt: 'O que é o padrão **Strangler Fig** na migração de um monólito?',
      options: [
        { text: 'Colocar um roteador na frente e migrar funcionalidades **aos poucos** para novos serviços, até o legado poder ser desligado.', correct: true, why: 'Migração incremental, reversível e que entrega valor a cada passo.' },
        { text: 'Congelar o monólito e reescrever tudo do zero em microsserviços, trocando num único dia.', why: 'Esse é o "big bang rewrite" — altíssimo risco, que o Strangler Fig justamente evita.' },
        { text: 'Dividir o banco de dados em vários schemas mantendo o mesmo código.', why: 'Mexer só no banco não é o padrão, e não muda a estrutura da aplicação.' },
        { text: 'Remover funcionalidades pouco usadas para diminuir o monólito.', why: 'Limpeza é boa, mas não é o Strangler Fig.' },
      ],
      explanation: 'Inspirado na figueira que cresce em volta de uma árvore até substituí-la: um **roteador/gateway** redireciona rotas específicas para os serviços novos, uma de cada vez. O risco de cada passo é pequeno e sempre dá para voltar atrás.',
    },
    {
      type: 'order',
      id: 'arq-rx-micro-1',
      concept: 'Strangler Fig — passo a passo',
      say: 'Agora na prática: coloque a migração na ordem certa.',
      prompt: 'Ordene os passos de uma migração com **Strangler Fig**, do primeiro ao último.',
      items: [
        'Colocar um roteador na frente do monólito — por enquanto, tudo ainda vai para o legado',
        'Escolher uma fatia de domínio com fronteira clara (ex.: Pagamentos)',
        'Construir o serviço novo dessa fatia, com seus próprios dados',
        'Desviar no roteador só as rotas dessa fatia, mantendo o caminho de volta',
        'Apagar o código morto do monólito e repetir com a próxima fatia',
      ],
      explanation: 'O roteador vem **primeiro**: sem ele, não há como desviar o tráfego aos poucos. Cada fatia segue um *bounded context*, migra com os seus dados, e o desvio é **reversível** — basta voltar a rota. Só depois de estabilizar em produção o código antigo é removido, e o ciclo recomeça até o legado "secar".',
    },
    {
      type: 'open',
      id: 'arq-micro-q4',
      concept: 'Microsserviços — trade-offs',
      say: 'Clássica de entrevista: quando vale a pena migrar para microsserviços?',
      prompt: 'Quando faz sentido migrar de um monólito para **microsserviços**? Cite os benefícios e os custos dessa decisão.',
      minWords: 20,
      rubric: [
        { label: 'Cita **vários times / escala organizacional** (ou Lei de Conway)', keywords: ['times', 'equipes', 'conway', 'organiza', 'autonom'], concept: 'Lei de Conway', why: 'O principal motivador de microsserviços é permitir que vários times trabalhem com autonomia.' },
        { label: 'Cita **deploy independente** / escalar partes separadamente', keywords: ['deploy', 'implanta', ['escal', 'independ'], ['escal', 'separad'], 'publicar'], concept: 'Deploy independente', why: 'Publicar e escalar um serviço sem mexer nos outros é o grande benefício.' },
        { label: 'Aponta a **complexidade operacional** / rede / observabilidade', keywords: ['complex', 'operac', 'rede', 'latencia', 'observab', 'monitor', 'infra', 'falha'], concept: 'Complexidade operacional', why: 'Rede, deploys, monitoramento e tracing viram problemas de primeira ordem.' },
        { label: 'Aponta **consistência de dados** distribuídos (eventual, sagas)', keywords: ['consisten', 'transac', 'saga', 'dados distribu', 'eventual', ['banco', 'proprio'], ['banco', 'compartilh'], 'integridade'], concept: 'Consistência eventual', why: 'Sem transações ACID entre serviços, é preciso lidar com consistência eventual.' },
      ],
      modelAnswer: `Faz sentido quando o monólito virou um gargalo **organizacional**: vários **times** disputando o mesmo código e o mesmo deploy (Lei de Conway), ou quando partes do sistema têm necessidades de **escala** muito diferentes. Os domínios também precisam estar maduros, para cortar pelos *bounded contexts* certos.

**Benefícios:** **deploy independente**, autonomia dos times, escalar só o que precisa, isolamento de falhas e liberdade de tecnologia.

**Custos:** grande **complexidade operacional** (rede, latência, timeouts, retries, observabilidade/tracing distribuído, CI/CD por serviço) e **consistência de dados**: cada serviço tem seu banco, então transações viram consistência eventual, sagas e compensações.

Por isso eu começaria com um **monólito modular** e migraria de forma incremental (Strangler Fig) quando a dor justificar.`,
    },
    {
      type: 'code',
      id: 'arq-micro-q5',
      concept: 'Retry com backoff exponencial',
      title: 'Retry com backoff exponencial',
      say: 'Chamadas entre serviços falham. Implemente um retry com backoff — e teste sem esperar de verdade!',
      prompt: `Implemente \`chamar_com_retry(funcao, tentativas, espera_base, dormir)\`:

- Chama \`funcao()\` e devolve o resultado assim que der certo.
- Se \`funcao()\` lançar uma exceção e ainda houver tentativas, chama \`dormir(segundos)\` e tenta de novo.
- A espera dobra a cada falha: \`espera_base\`, \`espera_base * 2\`, \`espera_base * 4\`…
- Se **todas** as \`tentativas\` falharem, **relança a última exceção** (sem dormir depois da última).
- \`dormir\` é **injetado** (em produção seria \`time.sleep\`; nos testes, um fake que só registra).`,
      starter: `def chamar_com_retry(funcao, tentativas, espera_base, dormir):
    # TODO: tente até 'tentativas' vezes, dormindo espera_base * 2**i entre as falhas
    return funcao()
`,
      tests: [
        {
          name: 'sucesso na primeira tentativa não dorme',
          code: `esperas = []
assert chamar_com_retry(lambda: "ok", 3, 0.1, esperas.append) == "ok"
assert esperas == [], f"não deveria dormir, mas dormiu {esperas}"`,
        },
        {
          name: 'falha 2x e depois funciona',
          code: `esperas = []
respostas = [ConnectionError("fora"), ConnectionError("fora"), "pedido criado"]
def instavel():
    r = respostas.pop(0)
    if isinstance(r, Exception):
        raise r
    return r

assert chamar_com_retry(instavel, 5, 0.1, esperas.append) == "pedido criado"
assert [round(e, 6) for e in esperas] == [0.1, 0.2], f"esperas esperadas [0.1, 0.2], obtidas {esperas}"`,
        },
        {
          name: 'todas falham: relança a exceção',
          code: `esperas = []
chamadas = []
def sempre_falha():
    chamadas.append(1)
    raise TimeoutError("serviço indisponível")

try:
    chamar_com_retry(sempre_falha, 3, 0.5, esperas.append)
    assert False, "deveria relançar a exceção"
except TimeoutError:
    pass
assert len(chamadas) == 3, f"deveria tentar 3 vezes, tentou {len(chamadas)}"
assert [round(e, 6) for e in esperas] == [0.5, 1.0], f"não durma após a última tentativa: {esperas}"`,
        },
        {
          name: 'backoff com 4 tentativas',
          hidden: true,
          code: `esperas = []
def falha():
    raise ConnectionError()
try:
    chamar_com_retry(falha, 4, 1, esperas.append)
except ConnectionError:
    pass
assert esperas == [1, 2, 4], esperas`,
        },
        {
          name: 'uma tentativa só não dorme',
          hidden: true,
          code: `esperas = []
def falha():
    raise ValueError("x")
try:
    chamar_com_retry(falha, 1, 1, esperas.append)
    assert False
except ValueError:
    pass
assert esperas == []`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('time') && m.calls.includes('sleep'),
          text: 'Você chamou `time.sleep` diretamente. Use o `dormir` **injetado** — assim os testes rodam instantaneamente e o comportamento é verificável.',
          concept: 'Testabilidade (relógio injetado)',
        },
        {
          when: (m, code) => /except\s*:/.test(code),
          text: '`except:` sem tipo captura até `KeyboardInterrupt` e `SystemExit`. Prefira `except Exception:` (ou exceções específicas, como `ConnectionError`).',
          concept: 'Tratamento de exceções',
        },
      ],
      hints: [
        'Use `for tentativa in range(tentativas):` com um `try/except Exception` dentro.',
        'No `except`, se `tentativa == tentativas - 1`, use `raise` para relançar; senão, `dormir(espera_base * 2 ** tentativa)`.',
      ],
      solution: `def chamar_com_retry(funcao, tentativas, espera_base, dormir):
    for tentativa in range(tentativas):
        try:
            return funcao()
        except Exception:
            if tentativa == tentativas - 1:
                raise
            dormir(espera_base * 2 ** tentativa)
`,
      solutionExplanation: 'O laço tenta até `tentativas` vezes. Na falha, se for a última tentativa, `raise` sem argumento **relança a exceção original** (preservando tipo e traceback); senão, espera `espera_base * 2 ** tentativa` — o **backoff exponencial**. Em produção, some-se um *jitter* aleatório e retry só para operações **idempotentes**. Injetar `dormir` torna tudo testável sem esperar de verdade.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Resumo: comece com um **monólito modular**, corte serviços por **domínio** quando houver dor real (times, escala)…',
        '…migre aos poucos com **Strangler Fig** e trate a rede como algo que falha: **timeouts, retries com backoff e idempotência**.',
      ],
      board: null,
    },
  ],
});
