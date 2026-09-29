(function () {
  // Helpers Python dos testes de validar_cadastro (cada teste roda num namespace novo).
  const AUX = `def _ok(**mudancas):
    dados = {"usuario": "ana_99", "idade": 30, "pais": "BR"}
    dados.update(mudancas)
    return dados

def _rejeita(dados, motivo):
    try:
        obtido = validar_cadastro(dados)
    except ValueError:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar ValueError, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: a entrada foi ACEITA ({obtido!r}), mas deveria lançar ValueError")
`;

  Game.registerModule('security', {
    id: 'fundamentos',
    title: 'Fundamentos: CIA, STRIDE e defesa em profundidade',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'fundamentos',
    summary: 'Pensar como quem ataca para defender melhor: a tríade CIA, superfície de ataque, modelagem de ameaças com STRIDE, os princípios clássicos de design seguro e validação de entrada por allowlist.',
    concepts: ['Tríade CIA', 'STRIDE', 'Defesa em profundidade', 'Menor privilégio', 'Allowlist'],
    takeaways: [
      'Segurança é proteger **confidencialidade**, **integridade** e **disponibilidade** — e um incidente não precisa de atacante: um bug de cache que mostra dados alheios já é quebra de confidencialidade.',
      '**STRIDE** transforma "o que pode dar errado?" num checklist: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.',
      'Nenhuma defesa é perfeita: empilhe camadas (**defesa em profundidade**), dê a cada peça só o acesso de que ela precisa (**menor privilégio**) e, na dúvida, **negue** (*fail-safe defaults*).',
      'Valide entrada por **allowlist** (descreva o que é permitido), no servidor, na fronteira de confiança — e rejeite em vez de tentar "consertar".',
      'Validação é **uma** camada: ela não substitui consulta parametrizada, codificação de saída nem autorização.',
    ],
    glossary: [
      { term: 'Tríade CIA', aliases: ['CIA triad', 'tríade', 'triade CIA', 'confidencialidade, integridade e disponibilidade'], definition: 'As três propriedades clássicas de segurança: **confidencialidade** (só quem deve lê), **integridade** (ninguém altera sem autorização) e **disponibilidade** (funciona quando precisa). Nada a ver com a agência americana.' },
      { term: 'STRIDE', aliases: ['modelo STRIDE'], definition: 'Mnemônico da Microsoft (1999) para levantar ameaças: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege. Cada letra viola uma propriedade de segurança.' },
      { term: 'Superfície de ataque', aliases: ['attack surface', 'superficie de ataque', 'superfícies de ataque'], definition: 'Todos os pontos por onde um atacante pode tentar entrar ou extrair dados: endpoints, uploads, filas, webhooks, painéis de admin, dependências, pipelines e pessoas. Menos superfície, menos coisa para defender.' },
      { term: 'Defesa em profundidade', aliases: ['defense in depth', 'modelo do queijo suíço', 'swiss cheese model'], definition: 'Empilhar camadas **independentes** de proteção para que a falha de uma não comprometa o sistema — como fatias de queijo suíço cujos furos raramente se alinham.' },
      { term: 'Menor privilégio', aliases: ['princípio do menor privilégio', 'menor privilegio', 'least privilege', 'PoLP'], definition: 'Cada usuário, processo ou credencial recebe **só** as permissões necessárias para a sua tarefa, pelo tempo necessário. Limita o estrago quando algo é comprometido.' },
      { term: 'Fail-safe defaults', aliases: ['fail-safe', 'fail-closed', 'fail-open', 'default deny', 'negar por padrão', 'secure by default'], definition: 'Princípio de Saltzer & Schroeder: o padrão é **negar** e o acesso só existe por permissão explícita. Se algo falha (erro, timeout, papel desconhecido), o sistema fecha (*fail-closed*), em vez de abrir (*fail-open*).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à segurança! Antes de qualquer ataque, uma pergunta: **o que** exatamente estamos protegendo?',
          'A resposta clássica cabe em três letras: **CIA**. E não, não é a agência.',
        ],
        board: {
          title: 'A tríade CIA',
          md: `| Propriedade | Pergunta | Quebra típica | Controles |
|---|---|---|---|
| **C**onfidencialidade | Só quem deve **lê**? | vazamento de banco, log com senha, bug de cache mostrando dados alheios | autorização, cifragem, minimização de dados |
| **I**ntegridade | Ninguém **altera** sem permissão? | preço trocado no corpo da requisição, log apagado | validação no servidor, assinaturas/HMAC, auditoria |
| **D**isponibilidade | Funciona **quando precisa**? | DDoS, disco cheio, ransomware | limites, redundância, backups testados |

Duas propriedades costumam andar junto:

- **Autenticidade** — a mensagem (ou o usuário) é mesmo de quem diz ser?
- **Não repúdio** — dá para **provar** depois quem fez o quê?

> [!atencao] As três competem entre si. Cifrar tudo com uma chave que só uma pessoa tem aumenta a confidencialidade — e derruba a disponibilidade no dia em que ela sai de férias. Segurança é sempre **trade-off** consciente.

> [!sabia] Em 1998, Donn Parker achou a tríade pobre e propôs o **hexágono parkeriano**: CIA + **posse/controle**, **autenticidade** e **utilidade**. Exemplo de "utilidade": um backup cifrado cuja chave se perdeu continua íntegro, confidencial e disponível — mas é inútil.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para atacar, alguém precisa de uma porta. O conjunto de todas as portas é a **superfície de ataque**.',
          'E o lugar onde a desconfiança deve ser máxima é a **fronteira de confiança**: onde dado de fora entra no seu mundo.',
        ],
        board: {
          title: 'Superfície de ataque e fronteiras de confiança',
          md: `\`\`\`text
  Internet (não confiável)
 ───────────── fronteira de confiança ─────────────
  │ navegador → API → serviço de pedidos → banco
  │ webhook do gateway de pagamento → fila → worker
  │ upload de arquivo → storage
 ───────────── fronteira de confiança ─────────────
  Rede interna (mais confiável — mas não "confiável")
\`\`\`

| Ponto de entrada | Pergunta a fazer |
|---|---|
| Endpoints HTTP, formulários, query string, cabeçalhos | toda entrada é validada **no servidor**? |
| Uploads, webhooks, mensagens de fila | quem garante de onde veio e o que contém? |
| Painéis de admin, endpoints de debug, \`/metrics\` | estão expostos à internet sem necessidade? |
| Dependências, imagens base, pipeline de CI/CD | quem pode publicar código que roda em produção? |
| Pessoas (suporte, devs com acesso) | phishing e engenharia social também são entradas |

**Reduzir a superfície** costuma ser a defesa mais barata: desligar o que não é usado, remover rotas de debug, não expor o banco na internet, ter menos dependências e deixar *features* novas **desligadas por padrão**.

> [!dica] Todo dado que cruza uma fronteira de confiança é **suspeito até prova em contrário** — inclusive o que vem de "dentro" (outro serviço seu pode ter sido comprometido) e o que já está no banco (alguém gravou isso um dia).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Saber onde estão as portas não basta: é preciso perguntar **o que pode dar errado** em cada uma. Isso é **modelagem de ameaças**.',
          'A ferramenta mais usada para não esquecer nada tem nome de banda de rock: **STRIDE**.',
        ],
        board: {
          title: 'Modelagem de ameaças com STRIDE',
          md: `| Letra | Ameaça | Propriedade violada | Exemplo | Mitigação típica |
|---|---|---|---|---|
| **S** | *Spoofing* (falsificar identidade) | Autenticidade | login com a senha vazada de outra pessoa | MFA, autenticação forte |
| **T** | *Tampering* (adulterar) | Integridade | alterar o preço no corpo do \`POST\` | validação no servidor, HMAC/assinatura |
| **R** | *Repudiation* (repúdio) | Não repúdio | "não fui eu que apaguei" — e não há log | trilha de auditoria à prova de alteração |
| **I** | *Information disclosure* (vazamento) | Confidencialidade | stack trace com a senha do banco | erros genéricos, cifragem, minimizar dados |
| **D** | *Denial of service* | Disponibilidade | upload de 20 GB, regex catastrófica | limites de tamanho, timeouts, rate limiting |
| **E** | *Elevation of privilege* | Autorização | usuário comum chama \`/admin\` e vira admin | checar permissão em **toda** operação |

As **quatro perguntas** de Adam Shostack resumem o processo:

1. **No que estamos trabalhando?** — desenhe o fluxo de dados (DFD) e as fronteiras de confiança.
2. **O que pode dar errado?** — passe o STRIDE em cada elemento e fluxo.
3. **O que vamos fazer a respeito?** — mitigar, eliminar, transferir ou aceitar (conscientemente) cada risco.
4. **Fizemos um bom trabalho?** — valide com testes e revisões; revisite quando o design mudar.

> [!sabia] O STRIDE foi criado em **1999** por Loren Kohnfelder e Praerit Garg, na Microsoft. Existem "primos" para outros focos: **LINDDUN** (ameaças à *privacidade*: linkability, identifiability…), **PASTA** (centrado em risco de negócio) e as **árvores de ataque** de Bruce Schneier (1999), em que a raiz é o objetivo do atacante e os ramos são os caminhos até ele.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora aceite um fato desconfortável: **toda** defesa falha em algum momento.',
          'Por isso não se aposta numa muralha só. Empilham-se camadas — e cada peça recebe o **mínimo** de poder possível.',
        ],
        board: {
          title: 'Defesa em profundidade e menor privilégio',
          md: `**Defesa em profundidade** — camadas independentes contra a mesma ameaça. Para SQL injection, por exemplo:

\`\`\`text
 atacante ─▶ [validação de entrada] ─▶ [consulta parametrizada] ─▶ [usuário do banco
             │ furo: campo esquecido    │ furo: um f-string legado  │ sem DROP nem acesso
             ▼                          ▼                           │ a outras tabelas]
                                                                    ▼
                                         [dados sensíveis cifrados] ─▶ [alerta de consulta anômala]
\`\`\`

Uma camada falhar não pode significar "perdemos tudo": os furos precisam **não se alinhar**.

**Menor privilégio** — cada usuário, serviço e credencial com o mínimo necessário:

\`\`\`sql
-- ❌ a aplicação conecta como dono do banco (pode DROP, ler tudo, criar usuários)
-- ✅ um papel só para ela, só com o que ela usa
CREATE ROLE app_loja LOGIN;
GRANT SELECT, INSERT, UPDATE ON pedidos, itens_pedido TO app_loja;
GRANT SELECT ON produtos TO app_loja;          -- catálogo: só leitura
-- nada de DELETE, nada de DDL, nada na tabela de usuários internos
\`\`\`

| Onde aplicar | Exemplo |
|---|---|
| Processos | container sem \`root\`, sistema de arquivos só leitura |
| Credenciais | token de CI que só publica **um** pacote; chave de API com escopo \`pedidos:ler\` |
| Pessoas | acesso a produção **temporário** e auditado (*just-in-time*), não permanente |

> [!sabia] A imagem das camadas vem do **modelo do queijo suíço**, de James Reason (1990), criado para explicar acidentes em aviação e hospitais: cada fatia tem furos, e o desastre só acontece quando os furos de todas as fatias se alinham.`,
        },
      },
      {
        type: 'say',
        text: [
          'Esses princípios não são modinha: estão num artigo de **1975** que continua atualíssimo.',
          'O mais contraintuitivo para quem está começando: quando algo dá errado, o sistema deve **fechar**, não abrir.',
        ],
        board: {
          title: 'Os princípios de Saltzer & Schroeder (1975)',
          md: `| Princípio | Em uma frase |
|---|---|
| **Fail-safe defaults** | o padrão é **negar**; acesso só com permissão explícita |
| **Mediação completa** | **toda** operação checa a permissão — não só a primeira, nem só na tela |
| **Menor privilégio** | cada parte com o mínimo necessário |
| **Economia de mecanismo** | mecanismos de segurança simples, pequenos e auditáveis |
| **Design aberto** | a segurança não pode depender de o atacante não conhecer o design — só das chaves |
| **Separação de privilégios** | ações críticas exigem duas condições (duas pessoas, dois fatores) |
| **Aceitabilidade psicológica** | se for chato demais, as pessoas contornam |

\`\`\`python
PERMISSOES = {
    "admin":  {"ler", "editar", "excluir"},
    "editor": {"ler", "editar"},
    "leitor": {"ler"},
}

def pode(papel, acao):
    # papel desconhecido → conjunto vazio → nega (fail-safe default)
    return acao in PERMISSOES.get(papel, set())

pode("editor", "editar")   # True
pode("estagiario", "ler")  # False: ninguém cadastrou esse papel, então não pode nada
\`\`\`

> [!atencao] O oposto é o **fail-open**: um \`except\` que devolve \`True\`, um \`if papel == "leitor": negar\` que deixa passar qualquer papel novo, uma feature flag de segurança que "liga se a config carregar". Listar o que é **proibido** sempre esquece alguma coisa.

> [!sabia] O "design aberto" é uma releitura do **princípio de Kerckhoffs** (1883): um sistema de cifra deve continuar seguro mesmo que tudo sobre ele caia nas mãos do inimigo, **exceto a chave**. É por isso que desconfiamos de "criptografia caseira secreta" — o segredo do algoritmo é o primeiro a vazar.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Na prática, o princípio que você mais vai aplicar é este: valide a entrada por **allowlist**.',
          'Descreva o que é **permitido** e rejeite todo o resto. Tentar listar tudo o que é perigoso é uma corrida que você perde.',
        ],
        board: {
          title: 'Validação de entrada: allowlist × denylist',
          md: `| | **Allowlist** (lista de permitidos) | **Denylist** (lista de proibidos) |
|---|---|---|
| Ideia | "só \`a-z\`, \`0-9\` e \`_\`, de 3 a 20" | "sem \`<\`, \`'\`, \`;\` e \`--\`" |
| Quando o atacante inventa algo novo | continua rejeitado | passa |
| Falha típica | rejeitar algo legítimo (visível, corrigível) | aceitar um ataque (silencioso) |

Regras de ouro:

1. **No servidor**, na fronteira de confiança. Validação no front é conforto de UX — o atacante usa \`curl\`.
2. Verifique **tipo, tamanho, formato e faixa** — nessa ordem.
3. **Rejeite** em vez de "consertar": remover \`<script>\` com \`replace\` deixa passar \`<scr<script>ipt>\`.
4. Se for normalizar (minúsculas, Unicode NFC), normalize **antes** de validar — nunca depois.

\`\`\`python
import re, ipaddress

re.match(r"^[a-z]+$", "admin\\n")     # <re.Match ...>  😱 o $ aceita um \\n no fim
re.fullmatch(r"[a-z]+", "admin\\n")   # None ✅  (ou termine o padrão com \\Z)

re.fullmatch(r"\\d+", "١٢٣")          # casa! \\d aceita dígitos de qualquer alfabeto
re.fullmatch(r"[0-9]+", "١٢٣")        # None ✅
"²".isdigit(), isinstance(True, int)  # (True, True) — dois "números" traiçoeiros

ipaddress.ip_address("10.0.0.1")       # "parse, don't validate": o parser É a validação
ipaddress.ip_address("10.0.0.1; ls")  # ValueError
\`\`\`

> [!sabia] Em regex do Python, **\`$\` casa antes de um \`\\n\` final** — então \`^[a-z]+$\` aceita \`"admin\\n"\`. Esse detalhe já virou vulnerabilidade real em validadores de nomes de arquivo e de cabeçalhos HTTP (onde um \`\\n\` permite injetar linhas). Use \`re.fullmatch\` ou termine o padrão com \`\\Z\`.

> [!atencao] Validação reduz a superfície, mas **não** é a correção de injeção: um nome como \`O'Brien\` é legítimo e contém aspas. Contra SQL injection, a defesa é a consulta parametrizada (próximo módulo); contra XSS, codificar na saída.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para fechar a teoria: o **OWASP Top 10**, a lista que toda entrevista de segurança menciona.',
          'Não é um padrão a cumprir — é um retrato dos riscos que mais aparecem em aplicações reais.',
        ],
        board: {
          title: 'OWASP Top 10 em linhas gerais',
          md: `| 2021 | Risco | Em uma frase |
|---|---|---|
| A01 | **Broken Access Control** | acessar dados ou funções de outro (IDOR, \`/admin\` sem checagem) |
| A02 | Cryptographic Failures | dados sensíveis sem cifragem, algoritmos fracos, senhas sem hash lento |
| A03 | **Injection** | dado vira código: SQL, comandos do SO, LDAP — e XSS entrou aqui |
| A04 | Insecure Design | falha de **projeto**, não de implementação (ex.: recuperação de senha adivinhável) |
| A05 | Security Misconfiguration | debug em produção, bucket público, cabeçalhos ausentes |
| A06 | Vulnerable and Outdated Components | dependência com CVE conhecida |
| A07 | Identification and Authentication Failures | sem limite de tentativas, sessão que não expira |
| A08 | Software and Data Integrity Failures | atualização sem assinatura, pipeline comprometido, desserialização insegura |
| A09 | Security Logging and Monitoring Failures | o ataque aconteceu e ninguém viu |
| A10 | Server-Side Request Forgery (SSRF) | o servidor busca uma URL escolhida pelo atacante |

Repare que quase todo item é a violação de um princípio que você já viu: A01 é falta de **mediação completa**; A05, de **fail-safe defaults** e superfície mínima; A09, de **não repúdio**.

> [!dica] A edição **2025** mantém *Broken Access Control* no topo, amplia os componentes vulneráveis para **falhas de cadeia de suprimentos**, incorpora o SSRF ao controle de acesso e estreia *Mishandling of Exceptional Conditions* — o tratamento de erro que "abre" o sistema, ou seja, **fail-open**.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um validador por allowlist que resiste a entradas traiçoeiras.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-fund-q1',
        concept: 'Tríade CIA',
        say: 'Começando pelo básico. Pense na propriedade, não no culpado.',
        prompt: 'Depois de um deploy, uma configuração errada no cache da CDN passou a servir a página **"Minha conta"** de um cliente — com nome, endereço e últimos pedidos — para **outros** clientes. Nenhum dado foi alterado e o site ficou no ar o tempo todo. Qual propriedade da tríade CIA foi violada?',
        options: [
          { text: '**Confidencialidade**: dados pessoais foram exibidos a quem não deveria vê-los.', correct: true, why: 'Exato. Confidencialidade é "só quem deve **lê**". Não houve alteração nem indisponibilidade — houve leitura indevida.' },
          { text: '**Integridade**: o usuário recebeu uma página com dados errados.', why: 'Integridade é sobre **alteração** não autorizada. Os dados estavam intactos no banco e na página; o problema é **quem** os viu.' },
          { text: '**Disponibilidade**: o cliente não conseguiu ver a própria conta.', why: 'Pode ter havido incômodo, mas o site respondeu o tempo todo. O dano principal — e o que vira notificação de incidente pela LGPD — é a exposição de dados pessoais.' },
          { text: '**Nenhuma**: foi um bug de configuração, não um ataque.', why: 'A tríade descreve **propriedades**, não intenções. Um vazamento acidental é um incidente de segurança do mesmo jeito — e costuma ter as mesmas obrigações legais.' },
        ],
        explanation: 'Incidentes de segurança não exigem um atacante: bugs, configurações erradas e descuidos quebram a CIA com frequência. Esse cenário aconteceu de verdade: no Natal de 2015, uma mudança de configuração de cache fez a loja do **Steam** exibir páginas de conta (com dados pessoais) de cerca de 34 mil usuários para outras pessoas. Moral: cache de páginas **autenticadas** exige `Cache-Control: private`/`no-store` e testes que confirmem que a resposta de um usuário nunca é servida a outro.',
      },
      {
        type: 'match',
        id: 'sec-fund-q2',
        concept: 'STRIDE',
        say: 'Hora de treinar o olho de modelagem de ameaças. Cada cenário, uma letra do STRIDE!',
        prompt: 'Associe cada **cenário** à categoria do **STRIDE**.',
        pairs: [
          { left: 'Login com a senha vazada de outra pessoa', right: 'Spoofing' },
          { left: 'Trocar o preço no corpo do POST do checkout', right: 'Tampering' },
          { left: '"Não fui eu que apaguei" — e não há log de auditoria', right: 'Repudiation' },
          { left: 'Página de erro mostra a senha do banco no stack trace', right: 'Information disclosure' },
          { left: 'Upload de 20 GB enche o disco do servidor', right: 'Denial of service' },
          { left: 'Usuário comum chama /admin/usuarios e se promove', right: 'Elevation of privilege' },
        ],
        explanation: 'Cada letra é o avesso de uma propriedade: **S**poofing ataca a *autenticidade*, **T**ampering a *integridade*, **R**epudiation o *não repúdio*, **I**nformation disclosure a *confidencialidade*, **D**enial of service a *disponibilidade* e **E**levation of privilege a *autorização*. O valor do STRIDE não é classificar bonito — é servir de **checklist**: ao olhar um fluxo de dados, pergunte as seis coisas. A ameaça que ninguém perguntou é a que chega em produção.',
      },
      {
        type: 'order',
        id: 'sec-fund-q3',
        concept: 'Modelagem de ameaças',
        say: 'Agora o processo. Vai modelar as ameaças de uma feature nova: por onde começa?',
        prompt: 'Ordene as etapas de uma **modelagem de ameaças** de uma feature nova, da primeira à última.',
        items: [
          'Delimitar o escopo e desenhar o fluxo de dados (DFD) da feature',
          'Marcar as fronteiras de confiança por onde entra dado externo',
          'Levantar ameaças em cada elemento e fluxo com o STRIDE',
          'Priorizar as ameaças por risco (probabilidade × impacto)',
          'Decidir a resposta a cada uma: mitigar, eliminar, transferir ou aceitar',
          'Validar com testes e revisão — e revisitar quando o design mudar',
        ],
        explanation: 'É o roteiro das quatro perguntas de Shostack: *no que estamos trabalhando?* (DFD e fronteiras), *o que pode dar errado?* (STRIDE), *o que vamos fazer?* (priorizar e decidir) e *fizemos um bom trabalho?* (validar). Duas observações de quem faz isso de verdade: **aceitar** um risco é uma resposta legítima, desde que seja decisão registrada de quem pode assumi-lo; e o modelo é um documento **vivo** — a feature muda, o modelo também.',
      },
      {
        type: 'code',
        id: 'sec-fund-q4',
        concept: 'Validação por allowlist',
        title: 'Validador de cadastro por allowlist',
        say: 'Agora é com você: um validador que diz exatamente o que é permitido. Cuidado com as entradas traiçoeiras — os testes têm várias.',
        prompt: `Implemente \`validar_cadastro(dados)\` para o formulário de cadastro. Use **allowlist** em tudo: descreva o que é permitido e rejeite o resto com \`ValueError\` — **nunca** tente "consertar" a entrada.

- \`dados\` precisa ser um \`dict\` com **exatamente** as chaves \`"usuario"\`, \`"idade"\` e \`"pais"\` — chave faltando ou sobrando → \`ValueError\`.
- \`usuario\`: \`str\` de **3 a 20** caracteres, só letras minúsculas \`a\`–\`z\`, dígitos \`0\`–\`9\` e \`_\`. A string **inteira** precisa obedecer.
- \`idade\`: \`int\` de **13 a 120** (inclusive). \`True\`, \`"30"\` e \`30.0\` **não** contam.
- \`pais\`: exatamente um de \`"BR"\`, \`"PT"\`, \`"AO"\`, \`"MZ"\`, \`"CV"\`.

Devolva um **novo** \`dict\` com os três campos validados. Qualquer entrada inválida lança \`ValueError\` — nunca \`KeyError\`, \`TypeError\` ou outra exceção.`,
        starter: `import re


def validar_cadastro(dados):
    # TODO: allowlist de chaves, depois cada campo: tipo, tamanho, formato e faixa
    pass
`,
        tests: [
          {
            name: 'cadastro válido devolve um dict novo com os três campos',
            code: AUX + `
dados = _ok()
obtido = validar_cadastro(dados)
assert obtido == {"usuario": "ana_99", "idade": 30, "pais": "BR"}, f"cadastro válido: veio {obtido!r}"
assert obtido is not dados, "devolva um dict NOVO, não o próprio dados recebido"
for pais in ["PT", "AO", "MZ", "CV"]:
    assert validar_cadastro(_ok(pais=pais))["pais"] == pais, f"o país {pais!r} é permitido"`,
          },
          {
            name: 'idade: 13 e 120 valem; 12 e 121 não',
            code: AUX + `
assert validar_cadastro(_ok(idade=13))["idade"] == 13, "13 anos é o mínimo permitido"
assert validar_cadastro(_ok(idade=120))["idade"] == 120, "120 anos é o máximo permitido"
_rejeita(_ok(idade=12), "idade 12 (abaixo do mínimo)")
_rejeita(_ok(idade=121), "idade 121 (acima do máximo)")
_rejeita(_ok(idade=-5), "idade negativa")`,
          },
          {
            name: 'usuario: tamanho de 3 a 20',
            code: AUX + `
assert validar_cadastro(_ok(usuario="abc"))["usuario"] == "abc", "3 caracteres é o mínimo permitido"
assert validar_cadastro(_ok(usuario="a" * 20))["usuario"] == "a" * 20, "20 caracteres é o máximo permitido"
_rejeita(_ok(usuario="ab"), "usuario com 2 caracteres")
_rejeita(_ok(usuario="a" * 21), "usuario com 21 caracteres")
_rejeita(_ok(usuario=""), "usuario vazio")`,
          },
          {
            name: 'usuario: só a–z, 0–9 e _ (sem maiúsculas, espaços ou símbolos)',
            code: AUX + `
for usuario in ["Ana_99", "ana silva", "ana-99", "ana.99", "<script>", "ana'--", "ana;drop"]:
    _rejeita(_ok(usuario=usuario), f"usuario {usuario!r}")`,
          },
          {
            name: 'chave sobrando (is_admin) ou faltando → ValueError',
            code: AUX + `
_rejeita(_ok(is_admin=True), "chave extra is_admin (mass assignment)")
sem_pais = {"usuario": "ana_99", "idade": 30}
_rejeita(sem_pais, "chave pais faltando (KeyError não serve: use ValueError)")
_rejeita({}, "dict vazio")`,
          },
          {
            name: 'pais: só os códigos exatos da lista',
            code: AUX + `
for pais in ["br", "Brasil", "US", "BR ", "", "BRA"]:
    _rejeita(_ok(pais=pais), f"pais {pais!r}")`,
          },
          {
            name: 'usuario com \\n no final → ValueError',
            hidden: true,
            code: AUX + `
_rejeita(_ok(usuario="ana_99\\n"), "usuario terminando em \\\\n (o $ da regex aceita um \\\\n final: use fullmatch ou \\\\Z)")`,
          },
          {
            name: 'usuario com letras e dígitos Unicode → ValueError',
            hidden: true,
            code: AUX + `
for usuario in ["joão", "ana²", "ａｎａ", "١٢٣", "ana_ß"]:
    _rejeita(_ok(usuario=usuario), f"usuario {usuario!r} (\\\\w, \\\\d e isalnum() aceitam Unicode; use [a-z0-9_])")`,
          },
          {
            name: 'idade: bool, str, float e None → ValueError',
            hidden: true,
            code: AUX + `
for idade in [True, "30", 30.0, None]:
    _rejeita(_ok(idade=idade), f"idade {idade!r} ({type(idade).__name__}; lembre que isinstance(True, int) é True)")`,
          },
          {
            name: 'tipos errados nunca vazam TypeError: dados não-dict, usuario não-str, pais lista',
            hidden: true,
            code: AUX + `
for dados in [None, [], "usuario=ana_99", 42]:
    _rejeita(dados, f"dados = {dados!r}")
_rejeita(_ok(usuario=12345), "usuario numérico (não é str)")
_rejeita(_ok(pais=["BR"]), "pais como lista (não é hashable: cuidado com o 'in' num set)")
_rejeita(_ok(pais=None), "pais None")`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /\.(match|search)\s*\(/.test(code) && !/\\Z/.test(code),
            text: 'Você usou `match`/`search` na regex. Com `$`, o padrão aceita um `\\n` no final (`re.match(r"^[a-z]+$", "admin\\n")` casa!). Prefira `re.fullmatch`, que exige a string **inteira** — ou termine o padrão com `\\Z`.',
            concept: 'Regex de validação',
          },
          {
            when: (m, code) => /\.(strip|lower|upper|replace)\s*\(/.test(code),
            text: 'Você está transformando a entrada (`strip`, `lower`, `replace`…). Normalizar só é legítimo quando é **regra de negócio** documentada e feita **antes** de validar. "Limpar" o que parece perigoso é denylist disfarçada: rejeitar é mais simples e mais seguro.',
            concept: 'Rejeitar × sanitizar',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Num validador isso esconde bugs seus e pode transformar um erro inesperado em "aceito". Cheque os **tipos** antes (`isinstance`, `type(x) is int`) e só lance `ValueError`.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.maxComplexity > 10,
            text: 'A função ficou com muitos caminhos. Quebre em validadores pequenos por campo (`_usuario`, `_idade`, `_pais`), cada um lançando `ValueError` — código de segurança precisa ser fácil de **auditar** (economia de mecanismo).',
            concept: 'Economia de mecanismo',
          },
        ],
        hints: [
          'Comece pelo formato geral: `isinstance(dados, dict) and set(dados) == {"usuario", "idade", "pais"}` resolve chave faltando **e** sobrando de uma vez — sem `KeyError`.',
          'Para o usuário: confira que é `str` e use `re.fullmatch(r"[a-z0-9_]{3,20}", usuario)`. O `fullmatch` exige a string inteira; `\\w`, `\\d` e `isalnum()` aceitam letras e dígitos Unicode, e o `$` aceita um `\\n` no fim.',
          '`isinstance(True, int)` é `True` — use `type(idade) is int`. Para o país, cheque `isinstance(pais, str)` **antes** do `in` num `set` (uma lista não é hashable e lançaria `TypeError`).',
        ],
        solution: `import re

CAMPOS = {"usuario", "idade", "pais"}
PAISES = {"BR", "PT", "AO", "MZ", "CV"}
USUARIO = re.compile(r"[a-z0-9_]{3,20}")


def validar_cadastro(dados):
    if not isinstance(dados, dict) or set(dados) != CAMPOS:
        raise ValueError(f"campos esperados: {sorted(CAMPOS)}")
    usuario, idade, pais = dados["usuario"], dados["idade"], dados["pais"]
    if not isinstance(usuario, str) or USUARIO.fullmatch(usuario) is None:
        raise ValueError("usuario: 3 a 20 caracteres entre a-z, 0-9 e _")
    if type(idade) is not int or not 13 <= idade <= 120:     # bool é subclasse de int
        raise ValueError("idade: número inteiro de 13 a 120")
    if not isinstance(pais, str) or pais not in PAISES:
        raise ValueError("pais não permitido")
    return {"usuario": usuario, "idade": idade, "pais": pais}
`,
        solutionExplanation: 'Tudo é allowlist: um **conjunto exato** de chaves (o que também barra *mass assignment*, como um `is_admin` enfiado no formulário), uma classe de caracteres explícita `[a-z0-9_]` com `fullmatch` (sem a armadilha do `$` com `\\n` e sem os dígitos e letras Unicode que `\\w`/`\\d` aceitariam), `type(idade) is int` (porque `True` é um `int` para o `isinstance`) e um `set` de países. A ordem **tipo → formato/faixa** evita que uma entrada estranha (`None`, uma lista) exploda com `TypeError` em vez de ser rejeitada. E a função devolve um dict **novo** só com os campos validados — o resto do sistema nunca toca na entrada crua.',
      },
      {
        type: 'mcq',
        id: 'sec-fund-q5',
        concept: 'Fail-safe defaults',
        say: 'Revisão de código. O autor desse trecho estava com a melhor das intenções…',
        prompt: `Qual é o problema deste código?

\`\`\`python
def pode_excluir(usuario, documento):
    try:
        return servico_permissoes.permite(usuario.id, "excluir", documento.id)
    except Exception:
        log.exception("serviço de permissões indisponível")
        return True   # não vamos travar o usuário por uma falha nossa
\`\`\``,
        options: [
          { text: 'É **fail-open**: se o serviço de permissões cair (ou for derrubado de propósito), **todos** podem excluir tudo. O padrão seguro é negar (`return False`) e mostrar um erro temporário.', correct: true, why: 'Exato. Viola os *fail-safe defaults*: na dúvida, negue. E pior: o atacante pode **provocar** a falha — sobrecarregar o serviço de permissões vira um jeito de ganhar privilégio.' },
          { text: 'O problema é capturar `Exception`; capturando só `ConnectionError` fica correto.', why: 'Estreitar o `except` é boa prática, mas não resolve: o cenário descrito no comentário é justamente a **queda** do serviço — e nela o código continua devolvendo `True`.' },
          { text: 'Está correto: disponibilidade também faz parte da tríade CIA, e o usuário não deve ser bloqueado.', why: 'Disponibilidade importa, mas é uma troca: aqui se compra um pouco de disponibilidade com a **integridade** de todos os documentos. Para uma ação destrutiva e irreversível, fechar é a escolha certa.' },
          { text: 'Falta retry: tentar 3 vezes antes de devolver `True`.', why: 'Retries podem ajudar em falhas passageiras, mas o final do caminho continua sendo `True`. O problema não é quantas vezes tentar, é **o que fazer quando não dá**.' },
        ],
        explanation: 'Esse é o clássico **fail-open**, e a edição 2025 do OWASP Top 10 ganhou uma categoria para ele (*Mishandling of Exceptional Conditions*). A regra dos *fail-safe defaults*: o acesso nasce **negado** e só existe por decisão explícita — erro, timeout, papel desconhecido ou config ausente levam a "não". Existe fail-open **consciente** (um rate limiter que, ao cair, deixa o tráfego passar para não derrubar o site), mas ele é decisão documentada de disponibilidade — nunca em **autorização**.',
      },
      {
        type: 'open',
        id: 'sec-fund-q6',
        concept: 'Modelagem de ameaças',
        say: 'Última: um mini threat model, como numa revisão de design de verdade.',
        prompt: 'Sua equipe vai lançar **upload de foto de perfil**: o usuário envia um arquivo, o servidor guarda e a foto aparece para outros usuários. Faça um threat model rápido: que ameaças você levantaria e que defesas proporia?',
        minWords: 40,
        rubric: [
          { label: 'Estrutura a análise: STRIDE, fronteiras de confiança ou fluxo de dados', keywords: ['stride', 'fronteira', 'fluxo de dados', 'dfd', 'superficie', 'spoofing', 'tampering', 'repudi', 'disclosure', 'elevation', 'elevacao de privilegio'], concept: 'STRIDE', why: 'Um método (STRIDE sobre o fluxo, fronteiras marcadas) evita que a análise dependa da memória de quem está na sala.' },
          { label: 'Negação de serviço: limite de tamanho, dimensões e cota', keywords: ['tamanho', 'limite', 'disco', 'denial', 'negacao de servico', 'bomba', 'dimens', 'resolucao', 'cota', 'quota'], concept: 'Denial of service', why: 'Um arquivo gigante (ou uma "bomba de descompressão" de imagem) enche disco e memória — o D do STRIDE.' },
          { label: 'Conteúdo malicioso: allowlist de tipos, checar o conteúdo real e reprocessar a imagem', keywords: ['allowlist', 'lista de permit', 'extens', 'mime', 'magic', 'content-type', 'svg', 'xss', 'reprocess', 'recodific', 'reencod', 're-encod', 'converter', 'poliglot', 'polyglot', 'malware', 'antivirus'], concept: 'Validação por allowlist', why: 'Extensão e `Content-Type` são escolhidos pelo atacante; um SVG ou HTML "foto" executa script (XSS). Allowlist de formatos + reprocessar a imagem neutraliza isso.' },
          { label: 'Armazenamento e vazamento: nome aleatório, fora da raiz web/domínio separado, remover EXIF', keywords: ['nome aleatorio', 'uuid', 'renome', 'traversal', '../', 'fora da raiz', 'bucket', 'dominio separado', 'outro dominio', 'exif', 'metadad', 'gps'], concept: 'Information disclosure', why: 'Usar o nome do usuário permite path traversal e sobrescrita; servir do domínio principal amplia o XSS; e o EXIF pode vazar a localização (GPS) de quem tirou a foto.' },
        ],
        modelAnswer: `Eu desenharia o fluxo (navegador → API → storage → outros usuários), marcaria a **fronteira de confiança** no upload e passaria o **STRIDE**.

**Denial of service**: limite de **tamanho** do arquivo e das **dimensões** da imagem (contra "bombas" de descompressão), cota por usuário e rate limiting no endpoint.

**Tampering / XSS**: extensão e \`Content-Type\` são escolhidos pelo atacante. Faço **allowlist** de formatos (JPEG, PNG, WebP — nada de SVG ou HTML), confiro os *magic bytes* e **reprocesso** a imagem (decodificar e recodificar), o que elimina arquivos poliglotas e conteúdo escondido.

**Armazenamento**: gero um **nome aleatório** (UUID) em vez de usar o nome enviado — isso evita path traversal e sobrescrita —, guardo num **bucket** fora da raiz da aplicação e sirvo de um **domínio separado**, com \`Content-Disposition\` e \`X-Content-Type-Options: nosniff\`.

**Information disclosure**: removo os metadados **EXIF**, que podem conter o GPS de onde a foto foi tirada.

**Elevation of privilege / Spoofing**: só o próprio usuário troca a própria foto (autorização checada no servidor). E aplico **menor privilégio**: o serviço de upload só escreve naquele bucket.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente começo! Agora você tem o vocabulário e, mais importante, o jeito de pensar de quem defende.',
          { text: 'Resumo: proteja C, I e A; pergunte STRIDE em cada fronteira; empilhe camadas, dê o mínimo de poder e, na dúvida, negue. No próximo módulo, a gente vê a injeção de perto!', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
