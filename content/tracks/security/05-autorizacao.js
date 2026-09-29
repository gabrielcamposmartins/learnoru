(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo).
  const AUX_MOTOR = `PAPEIS = {
    "leitor": {"doc:ler"},
    "editor": {"doc:ler", "doc:editar"},
    "admin": {"doc:ler", "doc:editar", "doc:apagar"},
}
ANA = {"id": 1, "papeis": ["editor"], "depto": "vendas"}
BIA = {"id": 2, "papeis": ["leitor"], "depto": "vendas"}
CAIO = {"id": 3, "papeis": ["admin"], "depto": "ti"}
DOC_VENDAS = {"id": 100, "dono": 1, "depto": "vendas"}
DOC_TI = {"id": 200, "dono": 3, "depto": "ti"}
`;

  const AUX_PEDIDOS = `import sqlite3 as _sqlite3

def _banco():
    conn = _sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER NOT NULL,
                              total REAL NOT NULL, status TEXT NOT NULL);
        INSERT INTO pedidos VALUES (1, 10, 99.9, 'aberto');
        INSERT INTO pedidos VALUES (2, 20, 250.0, 'aberto');
        INSERT INTO pedidos VALUES (3, 10, 15.5, 'aberto');
    """)
    return conn

ANA = {"id": 10, "papel": "cliente"}
BRUNO = {"id": 20, "papel": "cliente"}
SUPORTE = {"id": 99, "papel": "suporte"}

def _status(conn, pedido_id):
    return conn.execute("SELECT status FROM pedidos WHERE id = ?", (pedido_id,)).fetchone()[0]

def _erro(func, *args):
    try:
        func(*args)
    except Exception as e:
        return e
    return None
`;

  Game.registerModule('security', {
    id: 'autorizacao',
    title: 'Autorização: RBAC, ABAC, ReBAC, IDOR e o confused deputy',
    kind: 'lesson',
    level: 3,
    order: 21,
    unit: 'identidade',
    summary: 'Saber quem é o usuário é só metade: aqui você decide o que ele pode fazer — com papéis, atributos e relações —, fecha IDORs e conhece o confused deputy, o serviço bem-intencionado que trabalha para o atacante.',
    concepts: ['AuthN × AuthZ', 'RBAC × ABAC × ReBAC', 'IDOR e escalada de privilégio', 'Confused deputy', 'Deny by default'],
    takeaways: [
      '**Autenticação** descobre *quem* é; **autorização** decide, em **toda** operação, se *este* sujeito pode fazer *esta* ação com *este* recurso.',
      '**RBAC** (papéis) é simples e auditável; **ABAC** (atributos) expressa contexto; **ReBAC** (relações, estilo Zanzibar) resolve compartilhamento e hierarquias. Na prática, combinam-se.',
      '**IDOR** se fecha pondo o **dono na consulta** (`WHERE id = ? AND cliente_id = ?`), inclusive em `UPDATE`/`DELETE`; recurso alheio vira o mesmo `404` de um inexistente.',
      'Escalada **horizontal** = dados de um par; **vertical** = poderes de um nível acima. As duas são falhas de autorização, não de autenticação.',
      'O **confused deputy** usa a **própria** autoridade num alvo escolhido por quem pede. Defesa: agir com a autoridade do solicitante e checar o direito dele sobre o **alvo**. E sempre **deny by default** + **fail closed**.',
    ],
    glossary: [
      { term: 'RBAC', aliases: ['Role-Based Access Control', 'controle de acesso baseado em papéis', 'controle de acesso baseado em papeis'], definition: '*Role-Based Access Control*: permissões são agrupadas em **papéis** (`leitor`, `editor`, `admin`) e os usuários recebem papéis. Simples de auditar; sofre com a *explosão de papéis* quando as regras dependem de contexto.' },
      { term: 'ABAC', aliases: ['Attribute-Based Access Control', 'controle de acesso baseado em atributos'], definition: '*Attribute-Based Access Control*: a decisão é uma **política** sobre atributos do sujeito, do recurso, da ação e do ambiente (departamento, dono, horário, IP). Expressivo, mas mais difícil de auditar.' },
      { term: 'ReBAC', aliases: ['Relationship-Based Access Control', 'Zanzibar'], definition: '*Relationship-Based Access Control*: o acesso decorre de **relações** num grafo (Ana é membro do time, que é leitor da pasta, que contém o documento). Popularizado pelo **Zanzibar** do Google; implementações abertas: OpenFGA, SpiceDB.' },
      { term: 'Confused deputy', aliases: ['deputado confuso', 'problema do deputado confuso', 'confused deputy problem'], definition: 'Um programa com privilégios (o "deputado") é induzido a usar a **própria** autoridade em favor de quem não a tem — por exemplo, gravando onde o solicitante mandou. Descrito por Norm Hardy em 1988. CSRF e SSRF são casos particulares.' },
      { term: 'Escalada de privilégio', aliases: ['escalada de privilégios', 'escalação de privilégio', 'privilege escalation', 'escalada horizontal', 'escalada vertical'], definition: 'Obter acesso além do concedido. **Horizontal**: dados de outro usuário do mesmo nível (IDOR). **Vertical**: poderes de um nível acima (cliente executando ação de admin).' },
      { term: 'Deny by default', aliases: ['negar por padrão', 'negar por padrao', 'default deny', 'fail closed', 'fail-closed'], definition: 'Princípio de autorização: sem uma regra que **permita explicitamente**, a resposta é **negar** — inclusive quando a avaliação da política falha (*fail closed*).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje o assunto é **autorização** — a falha número 1 do OWASP Top 10.',
          'O login já disse *quem* é o usuário. Agora a pergunta é outra: ele pode fazer **isto**, com **este** recurso, **agora**?',
        ],
        board: {
          title: 'Autenticação × autorização',
          md: `| | **Autenticação** (authN) | **Autorização** (authZ) |
|---|---|---|
| Pergunta | **Quem** é você? | Você pode fazer **esta ação** com **este recurso**? |
| Resultado | uma identidade (o *sujeito*) | **permitir** ou **negar** |
| Quando | no login e ao validar sessão/token | em **toda** operação |
| Falhas típicas | senha fraca, sessão roubada | IDOR, escalada de privilégio, confused deputy |

Toda decisão de autorização tem quatro ingredientes: **sujeito** (quem), **ação** (o quê), **recurso** (em quê) e **contexto** (quando, de onde). Arquiteturas maduras separam quem **aplica** de quem **decide**:

\`\`\`text
 requisição ─▶ PEP  (ponto de aplicação: middleware, decorator, repositório)
                │  pergunta: (sujeito, ação, recurso, contexto)
                ▼
               PDP  (ponto de decisão: o motor de políticas)  ─▶  permitir | negar
\`\`\`

> [!atencao] No OWASP Top 10 de 2021, **Broken Access Control** subiu para o primeiro lugar (**A01**): 94% das aplicações testadas tinham alguma falha de controle de acesso. Autenticação forte não salva autorização fraca.

> [!sabia] Os nomes **PEP** e **PDP** vêm do **XACML**, um padrão XML da OASIS de 2003 que quase ninguém usa mais. Mas o vocabulário sobreviveu: motores modernos como o **OPA** (Rego) e o **Cedar** (linguagem de políticas da AWS) são PDPs, e o seu middleware é o PEP.`,
        },
      },
      {
        type: 'say',
        text: [
          'O modelo mais comum é o **RBAC**: permissões agrupadas em **papéis**, e papéis atribuídos a pessoas.',
          'Uma dica que evita muita dor: o código deve checar **permissões**, não nomes de papéis.',
        ],
        board: {
          title: 'RBAC: papéis e permissões',
          md: `\`\`\`python
PAPEIS = {
    "leitor": {"doc:ler"},
    "editor": {"doc:ler", "doc:editar"},
    "admin":  {"doc:ler", "doc:editar", "doc:apagar", "usuario:gerenciar"},
}

def pode(usuario, permissao):
    return any(permissao in PAPEIS.get(p, set()) for p in usuario["papeis"])

# ❌ espalhado pelo código: trocar quem pode apagar exige caçar todos os ifs
if "admin" in usuario["papeis"]: ...

# ✅ o código pergunta pela permissão; o mapa papel → permissões é configuração
if pode(usuario, "doc:apagar"): ...
\`\`\`

| Ponto forte | Ponto fraco |
|---|---|
| Fácil de **auditar**: "quem pode apagar?" é uma consulta | Não expressa "**o próprio** documento" nem contexto (horário, departamento) |
| Casa com a estrutura da empresa (cargos) | **Explosão de papéis**: \`editor_vendas_sp_noturno\`, \`editor_vendas_rj\`… |
| Barato de avaliar (conjuntos em memória) | Papéis acumulam permissões com o tempo (*privilege creep*) |

> [!dica] Duas extensões úteis: **hierarquia de papéis** (\`admin\` herda de \`editor\`) e **segregação de funções** (*separation of duties*): quem cria um pagamento não pode ser quem o aprova — mesmo que tenha os dois papéis.`,
        },
      },
      {
        type: 'say',
        text: [
          'Quando a regra depende de **contexto** — "só o departamento dele", "só em horário comercial" —, entra o **ABAC**.',
          'Em vez de uma lista de papéis, você escreve uma **política** sobre atributos.',
        ],
        board: {
          title: 'ABAC: políticas sobre atributos',
          md: `| Atributos do… | Exemplos |
|---|---|
| **Sujeito** | papéis, departamento, nível de acesso, MFA feito? |
| **Recurso** | dono, departamento, classificação (público/confidencial), status |
| **Ação** | ler, editar, exportar, apagar |
| **Ambiente** | horário, IP/rede, país, dispositivo gerenciado? |

\`\`\`python
def pode_editar(usuario, doc, ctx):
    return (
        pode(usuario, "doc:editar")                 # RBAC continua como base
        and doc["depto"] == usuario["depto"]        # sujeito × recurso
        and doc["status"] != "arquivado"            # recurso
        and 8 <= ctx["hora"] < 20                   # ambiente
    )
\`\`\`

| | **RBAC** | **ABAC** |
|---|---|---|
| Expressividade | baixa | alta (qualquer condição) |
| "Quem pode ver o doc X?" | consulta simples | difícil: depende de atributos em tempo de execução |
| Mudança de regra | reatribuir papéis | alterar a política (código/config) |
| Ferramentas | tabelas, grupos do IdP | OPA/Rego, Cedar, Casbin |

> [!dica] Na prática quase todo sistema é **híbrido**: RBAC dá a permissão bruta ("editores editam") e o ABAC a refina ("… do próprio departamento, se o doc não estiver arquivado").`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E um modelo que pouca gente conhece pelo nome, embora use todo dia: o **ReBAC**.',
          'No Google Drive você não tem "papel de leitor do documento X": você está num **time** que tem acesso a uma **pasta** que contém o documento. Acesso vira um **grafo**.',
        ],
        board: {
          title: 'ReBAC: autorização como grafo de relações',
          md: `No estilo **Zanzibar**, tudo são *tuplas* \`objeto#relação@sujeito\`:

\`\`\`text
doc:orcamento#pai@pasta:financeiro
pasta:financeiro#leitor@time:contabilidade#membro
time:contabilidade#membro@usuario:bruno

pergunta:  usuario:bruno pode "ler" doc:orcamento?
caminho:   bruno ─membro─▶ contabilidade ─leitor─▶ financeiro ─pai─▶ orcamento   ✅
\`\`\`

\`\`\`python
# o esquema diz como as relações se compõem
# leitor de um doc = leitor direto OU leitor da pasta-pai (herança)
def pode_ler(usuario, objeto):
    if usuario in leitores_diretos(objeto):
        return True
    pai = pasta_pai(objeto)
    return pai is not None and pode_ler(usuario, pai)
\`\`\`

| Bom para | Cuidado com |
|---|---|
| Compartilhamento ("convidar Ana"), times, pastas, organizações aninhadas | Consistência: a checagem precisa ver a remoção de acesso mais recente |
| Perguntas reversas: "o que o Bruno pode ver?" | Grafos profundos custam caro: cache e limites de profundidade |

> [!sabia] O **Zanzibar** (artigo do Google na USENIX ATC 2019) autoriza Drive, YouTube, Calendar e Photos, com trilhões de tuplas e milhões de checagens por segundo. O artigo batizou o **"new enemy problem"**: Ana tira o Bruno de uma pasta e **depois** põe lá um arquivo secreto; se a checagem usar uma réplica atrasada, o Bruno (o "novo inimigo") vê o arquivo. A solução foram os **zookies**, tokens de consistência que dizem "avalie com dados pelo menos tão novos quanto esta alteração". OpenFGA, SpiceDB e Ory Keto são implementações abertas da ideia.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a falha mais comum na vida real: o **IDOR**. O usuário está logado, tem o papel certo… e troca o id na URL.',
          'Na trilha de APIs ela aparece como **BOLA**. Aqui quero que você enxergue o padrão geral: **escalada horizontal** e **vertical**.',
        ],
        board: {
          title: 'IDOR e escalada de privilégio',
          md: `| | **Escalada horizontal** | **Escalada vertical** |
|---|---|---|
| O que é | acessar dados de **outro usuário do mesmo nível** | ganhar **poderes de um nível acima** |
| Exemplo | \`/pedidos/1002\` é de outro cliente | cliente chama \`/admin/reembolsos\`; \`{"papel": "admin"}\` no cadastro |
| Checagem que faltou | "este **objeto** é seu?" | "esta **função** é para o seu papel?" |

\`\`\`python
# ❌ IDOR: busca por id e confia
pedido = db.execute("SELECT * FROM pedidos WHERE id = ?", (pid,)).fetchone()

# ✅ o dono faz parte da consulta: pedido alheio é indistinguível de inexistente
pedido = db.execute(
    "SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?", (pid, usuario["id"])
).fetchone()
if pedido is None:
    raise NaoEncontrado(f"pedido {pid} não encontrado")      # 404

# ✅ o mesmo filtro em escritas: nada de "busca, confere e depois atualiza"
db.execute("UPDATE pedidos SET status = 'cancelado' WHERE id = ? AND cliente_id = ?",
           (pid, usuario["id"]))
\`\`\`

| Resposta | Quando |
|---|---|
| \`404\` | quem pede **nem pode saber** que o recurso existe (pedido de outro cliente) |
| \`403\` | quem pede **pode ver** o recurso, mas não executar a ação (suporte tentando cancelar) |

> [!atencao] Três "defesas" que não são autorização: **UUID** no lugar do id (ids vazam em links, logs e e-mails), **esconder o botão** no front-end (o atacante fala direto com o servidor) e mensagens de erro diferentes para "não existe" e "não é seu" — isso vira um **oráculo** para enumerar recursos.

> [!dica] Um bom hábito: o repositório já nasce **escopado** — \`pedidos_de(usuario).buscar(pid)\` — e buscar "sem dono" exige um método com nome feio, como \`buscar_sem_escopo_admin\`, que chama atenção na revisão.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora um conceito de 1988 que continua derrubando sistemas: o **confused deputy** — o "deputado confuso".',
          'Aqui ninguém rouba credencial nenhuma. O atacante convence um serviço **legítimo e poderoso** a usar o poder **dele** no lugar errado.',
        ],
        board: {
          title: 'Confused deputy: o procurador enganado',
          md: `A história original: um compilador num sistema de *time-sharing* tinha permissão para escrever no próprio diretório (onde gravava estatísticas e o arquivo de **cobrança**). O usuário escolhia o nome do arquivo de saída… e passou o nome do arquivo de cobrança. O compilador, com a **sua** permissão, sobrescreveu a cobrança de todo mundo.

| "Deputado" | Autoridade própria | Quem o engana |
|---|---|---|
| Navegador (**CSRF**) | os cookies de sessão da vítima | um site malicioso que dispara o \`POST\` |
| Servidor que busca URLs (**SSRF**) | acesso à rede interna e ao endpoint de metadados da nuvem | o usuário que escolhe a URL |
| SaaS que acessa a nuvem **do cliente** | um papel que pode assumir contas de clientes | o cliente que informa o identificador da conta **de outro** |
| Agente de IA com ferramentas | as credenciais das ferramentas | texto injetado num e-mail ou página (*prompt injection*) |

\`\`\`python
# ❌ deputado confuso: grava com a PRÓPRIA permissão onde o cliente mandar
def exportar(usuario, destino):
    storage_do_servico.gravar(destino, gerar_relatorio(usuario))

# ✅ checa o direito de QUEM PEDIU sobre o ALVO (ou age com a credencial dele)
def exportar(usuario, destino):
    if destino.conta_id != usuario["conta_id"]:
        raise AcessoNegado("o destino não pertence à sua conta")
    storage_do_servico.gravar(destino, gerar_relatorio(usuario))
\`\`\`

**Defesas:** agir com a autoridade **do solicitante** (propagar a identidade; *token exchange*/"on behalf of", RFC 8693) em vez da sua; verificar o direito dele sobre o **alvo**, não só sobre a ação; na AWS, exigir um **ExternalId** ao assumir papéis em contas de clientes.

> [!sabia] O termo vem do artigo de **Norm Hardy**, *"The Confused Deputy (or why capabilities might have been invented)"*, de 1988. A conclusão dele: o problema some com **capabilities** — em vez de passar um **nome** ("grave em /sysx/bill") e deixar o serviço usar a autoridade dele, o cliente passa uma **referência que já carrega a permissão** (um arquivo que *ele* abriu). Um *file descriptor* no Unix é uma capability.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para amarrar tudo, os princípios que valem para qualquer modelo — RBAC, ABAC ou ReBAC.',
          'O primeiro é o mais importante: na dúvida, **negue**.',
        ],
        board: {
          title: 'Deny by default, fail closed e companhia',
          md: `\`\`\`python
from functools import wraps

def requer(permissao):
    def decorador(func):
        @wraps(func)
        def envolvida(usuario, *args, **kwargs):
            if not motor.permite(usuario, permissao):      # PEP pergunta ao PDP
                raise AcessoNegado(permissao)
            return func(usuario, *args, **kwargs)
        return envolvida
    return decorador

@requer("pedido:cancelar")
def cancelar(usuario, pedido_id): ...
\`\`\`

| Princípio | Na prática |
|---|---|
| **Deny by default** | sem regra que permita explicitamente → nega. Ação nova, papel desconhecido, atributo ausente: **nega** |
| **Fail closed** | erro ao avaliar a política (exceção, timeout do serviço de autorização) → **nega**, e alerta |
| **Menor privilégio** | cada papel, token e conta de serviço com o mínimo; revisões periódicas de acesso |
| **Centralize a decisão** | um motor de políticas, não \`if\`s espalhados; aplique perto dos dados |
| **Teste a matriz** | para cada (papel × rota × dono/não dono), um teste com o resultado esperado |
| **Registre as negações** | muitas negações seguidas = alguém enumerando ids |

> [!atencao] O clássico *fail open*: \`except KeyError: return True  # tipo novo, ainda sem política\`. Todo recurso novo nasce **público**. Prefira que o framework **recuse subir** se uma rota não tiver política — ou um teste que varre as rotas e exige \`@requer(...)\` ou um \`@publica\` explícito.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um motor de políticas e um IDOR de verdade, com SQLite.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-authz-q1',
        concept: 'Confused deputy',
        say: 'Primeira: um incidente num SaaS. Qual é o diagnóstico?',
        prompt: 'A **ExportaFácil** salva relatórios no bucket de armazenamento **do cliente**. Cada cliente cadastra o nome do bucket de destino, e o serviço grava lá usando **a própria credencial** — que tem permissão de escrita nos buckets de todos os clientes. Um cliente mal-intencionado cadastra o bucket **de outra empresa** e sobrescreve os arquivos dela. Qual é o problema e a correção?',
        options: [
          { text: '**Confused deputy**: o serviço usa a **própria** autoridade num alvo escolhido pelo solicitante. Corrige-se agindo com a autoridade do cliente (um papel delegado por ele, com ExternalId) ou verificando que o destino pertence a quem pediu.', correct: true, why: 'Exato. O atacante não ganhou permissão nenhuma: ele **pegou emprestada** a do serviço. A pergunta que faltou foi "quem pediu tem direito sobre **este alvo**?" — e a melhor defesa é o serviço nem ter um poder tão amplo, usando a credencial que cada cliente delegou.' },
          { text: '**Escalada vertical**: o cliente virou administrador do serviço.', why: 'Ninguém ganhou papel novo: o atacante continua sendo um cliente comum. O poder era do **serviço**, que foi usado como procurador — é essa a assinatura do confused deputy.' },
          { text: '**IDOR** clássico: basta trocar os nomes previsíveis de bucket por UUIDs.', why: 'Tem parentesco com IDOR (faltou checar o direito sobre o alvo), mas esconder identificadores não é autorização — e nomes de bucket nem são segredo. O agravante aqui é o serviço agir com uma autoridade que o cliente não tem.' },
          { text: 'Validar o nome do bucket com uma regex (letras, números e hífens) resolve.', why: 'O nome do bucket da outra empresa é perfeitamente válido e passa na regex. Validar **formato** não prova **posse**.' },
        ],
        explanation: 'É o **confused deputy** (Norm Hardy, 1988): um programa com privilégios é induzido a usá-los em favor de quem não os tem. O padrão se repete em CSRF (o navegador usa os cookies da vítima), SSRF (o servidor usa o acesso à rede interna) e agentes de IA com ferramentas. As defesas: (1) agir com a autoridade **de quem pediu** — na AWS, assumir um papel na conta do cliente exigindo um **ExternalId** que só a ExportaFácil e aquele cliente conhecem; (2) checar o direito do solicitante sobre o **alvo**, não só sobre a ação; (3) **menor privilégio**: um serviço com escrita em todos os buckets é um deputado poderoso demais.',
      },
      {
        type: 'match',
        id: 'sec-authz-q2',
        concept: 'Modelos e falhas de autorização',
        say: 'Agora associe cada situação ao conceito certo.',
        prompt: 'Associe cada **situação** ao **conceito** de autorização que ela ilustra.',
        pairs: [
          { left: 'Papéis fixos (`admin`, `editor`, `leitor`), cada um com suas permissões', right: 'RBAC' },
          { left: '"Médico lê prontuários do **próprio hospital**, durante o **plantão**"', right: 'ABAC' },
          { left: 'Quem tem acesso a uma pasta vê tudo o que está dentro dela, como no Google Drive', right: 'ReBAC' },
          { left: 'Cliente troca o id na URL e lê o pedido de **outro cliente**', right: 'Escalada horizontal (IDOR)' },
          { left: 'Usuário comum chama `POST /admin/reembolsos` e a rota aceita', right: 'Escalada vertical' },
          { left: 'Serviço grava, com a **própria** permissão, num destino escolhido por quem pediu', right: 'Confused deputy' },
        ],
        explanation: 'Os três primeiros são **modelos** de decisão: RBAC pergunta pelo **papel**, ABAC avalia **atributos** (do sujeito, do recurso e do ambiente) e ReBAC percorre **relações** (membro do time → leitor da pasta → pai do documento). Os três últimos são **falhas**: a horizontal esquece o dono do **objeto**; a vertical esquece a permissão da **função**; e o confused deputy esquece de **quem** é a autoridade usada. Em todos os casos, o usuário estava devidamente autenticado.',
      },
      {
        type: 'code',
        id: 'sec-authz-q3',
        concept: 'Motor de políticas RBAC + ABAC',
        title: 'Um motor de políticas RBAC + ABAC',
        say: 'Hora de construir o seu PDP: papéis como base, regras de atributos por cima — e negar na dúvida.',
        prompt: `Implemente a classe \`MotorDePoliticas\`. Um usuário é um dict como \`{"id": 1, "papeis": ["editor"], "depto": "vendas"}\`; \`papeis\` (no construtor) mapeia papel → conjunto de permissões, como \`{"editor": {"doc:ler", "doc:editar"}}\`.

- \`regra(acao, condicao)\`: registra uma condição **ABAC** para a ação. \`condicao(usuario, recurso, contexto)\` devolve se permite. Uma ação pode ter **várias** regras.
- \`permite(usuario, acao, recurso=None, contexto=None) -> bool\`: devolve \`True\` **só se**:
  1. **RBAC:** algum papel do usuário concede a permissão \`acao\`; **e**
  2. **ABAC:** **todas** as regras registradas para \`acao\` permitem (sem regras, basta o RBAC).
- \`exigir(usuario, acao, recurso=None, contexto=None)\`: lança \`AcessoNegado\` se \`permite\` for falso.

Regras de segurança (**deny by default** e **fail closed**):

- ação sem permissão em papel nenhum, papel inexistente ou usuário sem a chave \`"papeis"\` → \`False\` (nunca \`KeyError\`);
- se uma condição **lançar exceção**, a resposta é \`False\` — a exceção não escapa;
- só o valor \`True\` conta como permissão: uma condição que devolve \`None\` (esqueceu o \`return\`), \`1\` ou \`"sim"\` **nega**;
- sem \`contexto\`, as condições recebem um dict **vazio** \`{}\`;
- \`permite\` devolve sempre um \`bool\` de verdade.`,
        starter: `class AcessoNegado(Exception):
    pass


class MotorDePoliticas:
    def __init__(self, papeis):
        self.papeis = papeis        # {"editor": {"doc:ler", "doc:editar"}, ...}
        self.regras = {}            # acao -> [condicao, ...]

    def regra(self, acao, condicao):
        # TODO: registre a condição ABAC para a ação
        pass

    def permite(self, usuario, acao, recurso=None, contexto=None):
        # TODO: RBAC e depois ABAC — negando na dúvida
        pass

    def exigir(self, usuario, acao, recurso=None, contexto=None):
        # TODO: lance AcessoNegado se não for permitido
        pass
`,
        tests: [
          {
            name: 'RBAC: cada papel faz só o que suas permissões dizem',
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
assert m.permite(BIA, "doc:ler") is True, "leitor deveria poder doc:ler"
assert m.permite(BIA, "doc:editar") is False, "leitor NÃO pode doc:editar"
assert m.permite(ANA, "doc:editar") is True, "editor deveria poder doc:editar"
assert m.permite(ANA, "doc:apagar") is False, "editor NÃO pode doc:apagar"
assert m.permite(CAIO, "doc:apagar") is True, "admin deveria poder doc:apagar"`,
          },
          {
            name: 'deny by default: ação desconhecida, sem papéis, papel inexistente',
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
assert m.permite(CAIO, "doc:publicar") is False, "ação que nenhum papel concede deve ser negada (até para admin)"
assert m.permite({"id": 9, "papeis": []}, "doc:ler") is False, "usuário sem papéis deve ser negado"
assert m.permite({"id": 9, "papeis": ["superuser"]}, "doc:ler") is False, "papel inexistente não concede nada (e não pode dar KeyError)"
assert m.permite({"id": 9}, "doc:ler") is False, "usuário sem a chave 'papeis' deve ser negado (e não pode dar KeyError)"`,
          },
          {
            name: 'ABAC: editor só edita documento do próprio departamento',
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
m.regra("doc:editar", lambda u, r, c: u["depto"] == r["depto"])
assert m.permite(ANA, "doc:editar", DOC_VENDAS) is True, "Ana (editora de vendas) edita doc de vendas"
assert m.permite(ANA, "doc:editar", DOC_TI) is False, "Ana NÃO edita doc de TI: a regra ABAC nega"
assert m.permite(BIA, "doc:editar", DOC_VENDAS) is False, "Bia é leitora: o RBAC nega mesmo com o depto certo"
assert m.permite(ANA, "doc:ler", DOC_TI) is True, "a regra é de doc:editar; ler continua liberado pelo RBAC"`,
          },
          {
            name: 'várias regras na mesma ação: todas precisam permitir',
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
m.regra("doc:editar", lambda u, r, c: u["depto"] == r["depto"])
m.regra("doc:editar", lambda u, r, c: 8 <= c["hora"] < 18)
assert m.permite(ANA, "doc:editar", DOC_VENDAS, {"hora": 10}) is True, "depto certo, 10h: permitido"
assert m.permite(ANA, "doc:editar", DOC_VENDAS, {"hora": 22}) is False, "depto certo, 22h: a segunda regra nega"
assert m.permite(ANA, "doc:editar", DOC_TI, {"hora": 10}) is False, "10h, depto errado: a primeira regra nega"`,
          },
          {
            name: 'exigir lança AcessoNegado quando não permitido',
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
m.exigir(ANA, "doc:editar")          # permitido: não pode lançar
try:
    m.exigir(BIA, "doc:editar")
except AcessoNegado:
    pass
else:
    raise AssertionError("exigir(leitor, 'doc:editar') deveria lançar AcessoNegado")`,
          },
          {
            name: 'fail closed: condição que lança exceção nega (e a exceção não escapa)',
            hidden: true,
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
m.regra("doc:editar", lambda u, r, c: r["dono"] == u["id"])
try:
    obtido = m.permite(ANA, "doc:editar")          # recurso None → TypeError dentro da regra
except Exception as e:
    raise AssertionError(f"a exceção da regra escapou ({type(e).__name__}): uma política quebrada deve NEGAR, não derrubar a requisição") from None
assert obtido is False, f"regra que lança exceção deve negar, veio {obtido!r}"
assert m.permite(ANA, "doc:editar", DOC_VENDAS) is True, "com o recurso certo a regra funciona"`,
          },
          {
            name: 'só True permite: None, 1, "sim" e listas negam',
            hidden: true,
            code: AUX_MOTOR + `
for valor in [None, 1, "sim", [1], {"ok": True}]:
    m = MotorDePoliticas(PAPEIS)
    m.regra("doc:ler", lambda u, r, c, v=valor: v)
    obtido = m.permite(BIA, "doc:ler")
    assert obtido is False, f"uma condição que devolve {valor!r} deveria NEGAR (só True permite), veio {obtido!r}"`,
          },
          {
            name: 'sem contexto, as regras recebem {} — um dict novo a cada chamada',
            hidden: true,
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
recebidos = []
def espia(u, r, c):
    recebidos.append(dict(c))   # cópia do que chegou
    c["sujei"] = True           # uma regra mal-educada que altera o contexto
    return True
m.regra("doc:ler", espia)
assert m.permite(BIA, "doc:ler") is True
assert m.permite(BIA, "doc:ler") is True
assert recebidos[0] == {}, f"sem contexto, a regra deveria receber {{}}, recebeu {recebidos[0]!r}"
assert recebidos[1] == {}, f"a 2ª chamada recebeu {recebidos[1]!r}: o {{}} foi compartilhado entre chamadas (default mutável?) e a regra anterior o sujou"`,
          },
          {
            name: 'admin também passa pelas regras ABAC; regra de uma ação não vaza para outra',
            hidden: true,
            code: AUX_MOTOR + `
m = MotorDePoliticas(PAPEIS)
m.regra("doc:apagar", lambda u, r, c: u["depto"] == r["depto"])
assert m.permite(CAIO, "doc:apagar", DOC_VENDAS) is False, "admin de TI apagando doc de vendas: a regra ABAC vale para todos"
assert m.permite(CAIO, "doc:apagar", DOC_TI) is True
assert m.permite(CAIO, "doc:editar", DOC_VENDAS) is True, "a regra é só de doc:apagar"`,
          },
        ],
        reviews: [
          {
            when: m => m.mutableDefaults > 0,
            text: 'Você usou um valor **mutável** como default (`contexto={}`). Esse dict é criado **uma vez**, na definição da função, e compartilhado entre todas as chamadas: uma regra que o altere contamina as decisões seguintes. Use `contexto=None` e crie o `{}` dentro da função.',
            concept: 'Default mutável',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo captura também `KeyboardInterrupt` e `SystemExit`. Para *fail closed*, `except Exception:` basta: qualquer erro da política vira "negar", sem engolir os sinais de parada do processo.',
            concept: 'Fail closed',
          },
          {
            when: m => m.maxComplexity > 8,
            text: '`permite` ficou com muitos caminhos. Separe as etapas em métodos com nome — `_rbac(usuario, acao)` e `_abac(usuario, acao, recurso, contexto)` — e combine com `and`. Código de autorização precisa ser fácil de **auditar**.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          '**RBAC:** `usuario.get("papeis", ())` evita o `KeyError`, e `self.papeis.get(papel, ())` trata papel inexistente. Combine com `any(acao in ... for papel in ...)`.',
          '**ABAC:** guarde as regras com `self.regras.setdefault(acao, []).append(condicao)`. Em `permite`, percorra `self.regras.get(acao, [])` e negue se alguma **não** devolver exatamente `True` (`resultado is not True`).',
          '**Fail closed:** envolva a chamada da condição em `try/except Exception: return False`. E para o contexto: `contexto=None` na assinatura e `if contexto is None: contexto = {}` no corpo.',
        ],
        solution: `class AcessoNegado(Exception):
    pass


class MotorDePoliticas:
    def __init__(self, papeis):
        self.papeis = papeis        # {"editor": {"doc:ler", "doc:editar"}, ...}
        self.regras = {}            # acao -> [condicao, ...]

    def regra(self, acao, condicao):
        self.regras.setdefault(acao, []).append(condicao)

    def _rbac(self, usuario, acao):
        return any(acao in self.papeis.get(papel, ()) for papel in usuario.get("papeis", ()))

    def _abac(self, usuario, acao, recurso, contexto):
        for condicao in self.regras.get(acao, []):
            try:
                if condicao(usuario, recurso, contexto) is not True:
                    return False
            except Exception:
                return False                    # fail closed: política quebrada nega
        return True

    def permite(self, usuario, acao, recurso=None, contexto=None):
        if contexto is None:
            contexto = {}
        return self._rbac(usuario, acao) and self._abac(usuario, acao, recurso, contexto)

    def exigir(self, usuario, acao, recurso=None, contexto=None):
        if not self.permite(usuario, acao, recurso, contexto):
            raise AcessoNegado(f"{acao} negado")
`,
        solutionExplanation: 'A decisão tem duas camadas combinadas com `and`: o **RBAC** dá a permissão bruta (algum papel concede a ação?) e o **ABAC** a refina (todas as condições da ação concordam?). Tudo o que não é explicitamente permitido é negado: `.get(..., ())` transforma papel inexistente e usuário sem papéis em "nenhuma permissão" (**deny by default**), e o `try/except Exception` transforma política quebrada em "negar" (**fail closed**) — o pior que pode acontecer é um falso "não", nunca um falso "sim". Exigir `is True` pelo mesmo motivo: uma regra que esqueceu o `return` devolve `None`, e uma que devolve uma lista não vazia por engano seria "verdadeira". Em produção, registre também **por que** negou (qual regra, qual exceção): negações silenciosas são um pesadelo de depurar.',
      },
      {
        type: 'code',
        id: 'sec-authz-q4',
        concept: 'IDOR',
        title: 'Feche o IDOR dos pedidos',
        say: 'Agora um endpoint de verdade, com SQLite. Ele autentica direitinho… e entrega o pedido de qualquer um. Conserte.',
        prompt: `As funções abaixo recebem uma conexão SQLite, o **usuário autenticado** (\`{"id": 10, "papel": "cliente"}\`) e o id do pedido vindo da URL. Hoje elas ignoram o usuário. Corrija:

**\`ver_pedido(conn, usuario, pedido_id) -> dict\`**
- um **cliente** só vê os **próprios** pedidos (\`cliente_id\` igual ao \`id\` dele);
- o **suporte** (\`papel == "suporte"\`) vê qualquer pedido;
- pedido de outro cliente lança \`NaoEncontrado\` **idêntico** (mesma classe e mesma mensagem) ao de um pedido inexistente — nada de oráculo.

**\`cancelar_pedido(conn, usuario, pedido_id)\`**
- só o **dono** cancela (\`status\` vira \`'cancelado'\`);
- cliente tentando cancelar pedido alheio → \`NaoEncontrado\` (404: ele nem pode saber que existe);
- suporte tentando cancelar pedido existente → \`AcessoNegado\` (403: ele pode ver o pedido, só não pode cancelar); inexistente → \`NaoEncontrado\`;
- uma tentativa negada **não altera nada** no banco.

**Deny by default:** papel desconhecido ou ausente não ganha privilégio nenhum — é tratado como cliente comum.`,
        starter: `import sqlite3


class NaoEncontrado(Exception):
    """Vira 404 na borda HTTP."""


class AcessoNegado(Exception):
    """Vira 403 na borda HTTP."""


def ver_pedido(conn, usuario, pedido_id):
    linha = conn.execute(
        "SELECT id, cliente_id, total, status FROM pedidos WHERE id = ?", (pedido_id,)
    ).fetchone()
    if linha is None:
        raise NaoEncontrado(f"pedido {pedido_id} não encontrado")
    return {"id": linha[0], "cliente_id": linha[1], "total": linha[2], "status": linha[3]}


def cancelar_pedido(conn, usuario, pedido_id):
    cursor = conn.execute(
        "UPDATE pedidos SET status = 'cancelado' WHERE id = ?", (pedido_id,)
    )
    if cursor.rowcount == 0:
        raise NaoEncontrado(f"pedido {pedido_id} não encontrado")
`,
        tests: [
          {
            name: 'Ana vê o próprio pedido',
            code: AUX_PEDIDOS + `
conn = _banco()
obtido = ver_pedido(conn, ANA, 1)
assert obtido == {"id": 1, "cliente_id": 10, "total": 99.9, "status": "aberto"}, f"pedido 1 da Ana: {obtido!r}"`,
          },
          {
            name: 'IDOR: Ana tenta ver o pedido do Bruno → NaoEncontrado',
            code: AUX_PEDIDOS + `
conn = _banco()
e = _erro(ver_pedido, conn, ANA, 2)
assert e is not None, "Ana leu o pedido 2, que é do Bruno — isso é um IDOR!"
assert isinstance(e, NaoEncontrado), f"deveria lançar NaoEncontrado (404), lançou {type(e).__name__}: {e}"`,
          },
          {
            name: 'pedido alheio e pedido inexistente dão exatamente o mesmo erro',
            code: AUX_PEDIDOS + `
conn = _banco()
alheio = _erro(ver_pedido, conn, ANA, 2)
conn.execute("DELETE FROM pedidos WHERE id = 2")
inexistente = _erro(ver_pedido, conn, ANA, 2)
assert type(alheio) is type(inexistente) is NaoEncontrado, f"tipos: alheio={type(alheio).__name__}, inexistente={type(inexistente).__name__}"
assert str(alheio) == str(inexistente), f"mensagens diferentes viram um oráculo de enumeração: {str(alheio)!r} × {str(inexistente)!r}"`,
          },
          {
            name: 'suporte vê qualquer pedido',
            code: AUX_PEDIDOS + `
conn = _banco()
assert ver_pedido(conn, SUPORTE, 2)["cliente_id"] == 20
assert ver_pedido(conn, SUPORTE, 1)["cliente_id"] == 10
e = _erro(ver_pedido, conn, SUPORTE, 999)
assert isinstance(e, NaoEncontrado), f"pedido inexistente para o suporte: {type(e).__name__}"`,
          },
          {
            name: 'Ana cancela o próprio pedido',
            code: AUX_PEDIDOS + `
conn = _banco()
cancelar_pedido(conn, ANA, 3)
assert _status(conn, 3) == "cancelado", f"status do pedido 3: {_status(conn, 3)!r}"
assert _status(conn, 1) == "aberto", "só o pedido 3 deveria mudar"`,
          },
          {
            name: 'Ana tenta cancelar o pedido do Bruno → NaoEncontrado e nada muda',
            code: AUX_PEDIDOS + `
conn = _banco()
e = _erro(cancelar_pedido, conn, ANA, 2)
assert isinstance(e, NaoEncontrado), f"deveria lançar NaoEncontrado, lançou {type(e).__name__ if e else 'nada'}"
assert _status(conn, 2) == "aberto", "o pedido do Bruno foi CANCELADO pela Ana! A tentativa negada não pode alterar o banco"`,
          },
          {
            name: 'suporte não cancela: AcessoNegado (403) e nada muda; inexistente → NaoEncontrado',
            hidden: true,
            code: AUX_PEDIDOS + `
conn = _banco()
e = _erro(cancelar_pedido, conn, SUPORTE, 2)
assert isinstance(e, AcessoNegado), f"suporte cancelando pedido existente: deveria ser AcessoNegado, veio {type(e).__name__ if e else 'nada'}"
assert _status(conn, 2) == "aberto", "o suporte conseguiu cancelar o pedido"
e = _erro(cancelar_pedido, conn, SUPORTE, 999)
assert isinstance(e, NaoEncontrado), f"suporte cancelando pedido inexistente: deveria ser NaoEncontrado, veio {type(e).__name__ if e else 'nada'}"`,
          },
          {
            name: 'deny by default: papel desconhecido ou ausente não ganha privilégio',
            hidden: true,
            code: AUX_PEDIDOS + `
conn = _banco()
for usuario in [{"id": 10, "papel": "admin"}, {"id": 10, "papel": "Suporte"}, {"id": 10}]:
    assert ver_pedido(conn, usuario, 1)["id"] == 1, f"{usuario}: o próprio pedido continua visível"
    e = _erro(ver_pedido, conn, usuario, 2)
    assert isinstance(e, NaoEncontrado), f"{usuario} leu o pedido do Bruno: papel desconhecido não pode virar privilégio"
    e = _erro(cancelar_pedido, conn, usuario, 2)
    assert isinstance(e, NaoEncontrado), f"{usuario} tentando cancelar pedido alheio: {type(e).__name__ if e else 'nada'}"
    assert _status(conn, 2) == "aberto"`,
          },
          {
            name: 'cancelar pedido inexistente → NaoEncontrado',
            hidden: true,
            code: AUX_PEDIDOS + `
conn = _banco()
e = _erro(cancelar_pedido, conn, ANA, 999)
assert isinstance(e, NaoEncontrado), f"pedido inexistente: {type(e).__name__ if e else 'nada'}"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => !/cliente_id\s*=\s*\?/i.test(code),
            text: 'Você buscou o pedido e conferiu o dono em Python. Funciona, mas é mais frágil: é fácil esquecer a checagem numa rota nova, e no `UPDATE` o padrão "busca, confere, atualiza" abre espaço para erro. Pôr o dono **na própria consulta** (`WHERE id = ? AND cliente_id = ?`) faz de "pedido alheio" e "pedido inexistente" literalmente o mesmo caso.',
            concept: 'Consulta escopada pelo dono',
          },
          {
            when: (m, code) => /!=\s*["']cliente["']/.test(code),
            text: 'Cuidado com `papel != "cliente"` como sinônimo de "é suporte": isso é uma **denylist** — qualquer papel novo (ou digitado errado) ganha o privilégio. Pergunte pelo que **concede** acesso: `papel == "suporte"`.',
            concept: 'Deny by default',
          },
        ],
        hints: [
          'Para clientes, acrescente o dono ao `WHERE`: `... WHERE id = ? AND cliente_id = ?` com `(pedido_id, usuario.get("id"))`. Se não voltar linha, é o **mesmo** `NaoEncontrado` de sempre.',
          'Só `usuario.get("papel") == "suporte"` usa a consulta sem o dono. Qualquer outro valor — inclusive ausente — cai no caminho do cliente.',
          'No `cancelar_pedido`: para o suporte, chame `ver_pedido` (que lança `NaoEncontrado` se não existir) e depois lance `AcessoNegado`. Para os demais, `UPDATE ... WHERE id = ? AND cliente_id = ?` e, se `cursor.rowcount == 0`, `NaoEncontrado`.',
        ],
        solution: `import sqlite3


class NaoEncontrado(Exception):
    """Vira 404 na borda HTTP."""


class AcessoNegado(Exception):
    """Vira 403 na borda HTTP."""


SELECT_PEDIDO = "SELECT id, cliente_id, total, status FROM pedidos WHERE id = ?"


def _eh_suporte(usuario):
    return usuario.get("papel") == "suporte"        # allowlist: só este valor concede


def _nao_encontrado(pedido_id):
    return NaoEncontrado(f"pedido {pedido_id} não encontrado")


def ver_pedido(conn, usuario, pedido_id):
    if _eh_suporte(usuario):
        linha = conn.execute(SELECT_PEDIDO, (pedido_id,)).fetchone()
    else:   # o dono é parte da consulta: alheio e inexistente são o mesmo caso
        linha = conn.execute(SELECT_PEDIDO + " AND cliente_id = ?",
                             (pedido_id, usuario.get("id"))).fetchone()
    if linha is None:
        raise _nao_encontrado(pedido_id)
    return {"id": linha[0], "cliente_id": linha[1], "total": linha[2], "status": linha[3]}


def cancelar_pedido(conn, usuario, pedido_id):
    if _eh_suporte(usuario):
        ver_pedido(conn, usuario, pedido_id)        # inexistente → NaoEncontrado
        raise AcessoNegado("o suporte não cancela pedidos de clientes")
    cursor = conn.execute(
        "UPDATE pedidos SET status = 'cancelado' WHERE id = ? AND cliente_id = ?",
        (pedido_id, usuario.get("id")),
    )
    if cursor.rowcount == 0:
        raise _nao_encontrado(pedido_id)
`,
        solutionExplanation: 'O conserto põe o **dono na consulta**: para um cliente, `WHERE id = ? AND cliente_id = ?`. Com isso, "pedido do Bruno" e "pedido que não existe" viram literalmente o mesmo resultado (nenhuma linha) e o mesmo erro — sem oráculo para enumerar ids. No `cancelar_pedido`, o filtro vai no próprio `UPDATE`: não há janela entre "conferir" e "alterar", e uma tentativa negada simplesmente não casa nenhuma linha. O suporte tem leitura ampla, então para ele a resposta honesta é `403` (ele sabe que o pedido existe), enquanto o cliente recebe `404`. E o privilégio é concedido por **allowlist** (`papel == "suporte"`): `"admin"`, `"Suporte"` ou papel ausente caem no caminho mais restrito — *deny by default*. Em produção, um teste "usuário A tenta ler/alterar o recurso de B" por rota pega regressões que a revisão deixa passar.',
      },
      {
        type: 'mcq',
        id: 'sec-authz-q5',
        concept: 'Deny by default',
        say: 'Revisão de código: esta função passou em todos os testes. Você aprovaria?',
        prompt: `\`\`\`python
POLITICAS = {
    "pedido": politica_pedido,
    "fatura": politica_fatura,
}

def pode_acessar(usuario, recurso):
    try:
        politica = POLITICAS[recurso.tipo]
    except KeyError:
        return True          # tipo novo, ainda sem política
    return politica(usuario, recurso)
\`\`\`

Qual é o problema?`,
        options: [
          { text: 'É *fail open*: todo tipo de recurso novo nasce **acessível a qualquer um** até alguém lembrar de escrever a política. Deve negar (e alertar) quando não há política — **deny by default**.', correct: true, why: 'Exato. O dia em que alguém criar o tipo `"contrato"` e esquecer de registrar a política, qualquer usuário autenticado lê todos os contratos. Negar por padrão transforma o esquecimento num erro visível ("ninguém consegue acessar contratos") em vez de um vazamento silencioso.' },
          { text: 'Deveria capturar `Exception` em vez de `KeyError`, para cobrir mais erros.', why: 'Capturar mais erros e devolver `True` pioraria: qualquer falha viraria "permitido". O problema não é **qual** exceção se captura, é o **valor** devolvido na dúvida.' },
          { text: 'Nenhum: trocar o `try` por `POLITICAS.get(recurso.tipo, lambda u, r: True)` só deixaria o código mais limpo.', why: 'Mais limpo, mas com exatamente o mesmo bug: a política padrão continua sendo "permitir tudo". O default seguro é `lambda u, r: False`.' },
          { text: 'Nenhum, porque o usuário já foi autenticado antes de chegar aqui.', why: 'Autenticado não quer dizer autorizado: saber quem é o usuário não diz se **ele** pode ver **este** recurso. Qualquer cliente logado leria os dados de todos.' },
        ],
        explanation: '**Deny by default** e **fail closed** são duas faces da mesma regra: na dúvida — sem política, papel desconhecido, erro ao avaliar, serviço de autorização fora do ar —, a resposta é **negar**. O custo de um falso "não" é um chamado de suporte; o de um falso "sim" é um vazamento. Para não depender de memória, faça o sistema **reclamar cedo**: um teste que percorre todos os tipos de recurso (ou todas as rotas) e falha se algum não tiver política.',
      },
      {
        type: 'open',
        id: 'sec-authz-q6',
        concept: 'Escolha do modelo de autorização',
        say: 'Última: uma discussão de arquitetura. Me convença da sua escolha.',
        prompt: 'Seu time está criando um SaaS de documentos (estilo Google Drive) para empresas: organizações, times, pastas aninhadas, compartilhamento com pessoas específicas e regras como "documentos confidenciais só podem ser baixados na rede da empresa". Como você modelaria a **autorização**? Compare RBAC, ABAC e ReBAC e diga o que levaria em conta.',
        minWords: 40,
        rubric: [
          { label: 'Aponta o limite do **RBAC** sozinho (papéis fixos, explosão de papéis, não expressa dono/compartilhamento)', keywords: ['explosao', 'role explosion', 'papeis demais', 'muitos papeis', 'papeis fixos', 'papel fixo', ['rbac', 'nao expressa'], ['rbac', 'nao resolve'], ['rbac', 'nao escala'], ['rbac', 'limit'], ['rbac', 'insuficiente'], ['rbac', 'simples']], concept: 'RBAC', why: 'RBAC é ótimo para funções amplas (admin da organização), mas "Ana pode editar **este** documento" viraria um papel por documento — a explosão de papéis.' },
          { label: 'Usa **ReBAC** para compartilhamento, times e herança de pastas', keywords: ['rebac', 'relacionamento', 'relacao', 'relacoes', 'zanzibar', 'openfga', 'spicedb', 'grafo', 'heranca', 'herda', 'tupla'], concept: 'ReBAC', why: 'Compartilhamento e hierarquias (membro do time → leitor da pasta → documentos dentro dela) são relações; o ReBAC as modela diretamente e responde "quem pode ver X?".' },
          { label: 'Usa **ABAC** para condições de contexto (rede, classificação, horário)', keywords: ['abac', 'atribut', 'contexto', 'rede da empresa', 'endereco ip', 'por ip', 'o ip', 'classificacao', 'confidencial', 'ambiente', 'horario'], concept: 'ABAC', why: 'Regras como "confidencial só na rede da empresa" dependem de atributos do recurso e do ambiente — o terreno do ABAC.' },
          { label: 'Princípios transversais: **deny by default**, decisão centralizada (PDP), testes/auditoria', keywords: ['deny by default', 'negar por padrao', 'nega por padrao', 'negar na duvida', 'fail closed', 'centraliz', 'pdp', 'motor de polit', 'servico de autoriza', 'auditor', 'logs', 'registr', 'teste', 'menor privilegio'], concept: 'Deny by default', why: 'Qualquer que seja o modelo, a decisão precisa ser única (um PDP), negar por padrão e ser testável e auditável.' },
        ],
        modelAnswer: `Eu combinaria os três, cada um onde é mais forte. **RBAC** só para funções amplas da organização (admin, cobrança, membro): papéis fixos não expressam "a Ana pode editar **este** documento" — tentar isso levaria à explosão de papéis.

O núcleo seria **ReBAC**, no estilo Zanzibar (OpenFGA ou SpiceDB): tuplas como "time contabilidade é leitor da pasta financeiro" e "o documento está na pasta", com herança pelas pastas aninhadas e compartilhamento direto com pessoas. Isso também responde bem "quem pode ver este documento?" e "o que o Bruno pode ver?".

Por cima, **ABAC** para condições de contexto: documento com classificação "confidencial" só pode ser baixado se o atributo de ambiente "rede da empresa" (IP/dispositivo gerenciado) for verdadeiro.

Transversalmente: a decisão fica **centralizada** num serviço de autorização (o PDP), consultado por todas as rotas; **deny by default** e *fail closed* se ele falhar; uma matriz de **testes** (papel × relação × ação) e log de auditoria das decisões — especialmente das negações.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você sabe que "está logado" é só o começo da conversa.',
          { text: 'Resumo: papéis, atributos e relações para decidir; o dono na consulta contra IDOR; a autoridade de quem pediu contra o confused deputy — e, na dúvida, negue.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
