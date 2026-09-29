(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo). Montam tokens "na mão",
  // sem usar as funções do jogador — assim um bug em assinar_jwt não mascara os testes de verificar_jwt.
  const AUX = `import base64 as _base64
import hashlib as _hashlib
import hmac as _hmac
import json as _json

HS256 = {"alg": "HS256", "typ": "JWT"}

def _b64(dados):
    return _base64.urlsafe_b64encode(dados).rstrip(b"=").decode()

def _token(cabecalho, payload, segredo, digest="sha256"):
    h = _b64(_json.dumps(cabecalho, separators=(",", ":")).encode())
    p = _b64(_json.dumps(payload, separators=(",", ":")).encode())
    if segredo is None:                      # sem assinatura, como num token "alg: none"
        return f"{h}.{p}."
    assinatura = _hmac.new(segredo, f"{h}.{p}".encode(), digest).digest()
    return f"{h}.{p}.{_b64(assinatura)}"

def _rejeita(token, segredo, agora=0, motivo="token inválido"):
    try:
        verificar_jwt(token, segredo, relogio=lambda: agora)
    except TokenInvalido:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar TokenInvalido, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: o token foi ACEITO, mas deveria lançar TokenInvalido")
`;

  const JWT_IO = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  Game.registerModule('apis', {
    id: 'seguranca-api',
    title: 'Segurança de APIs: OAuth 2.0, JWT, CORS e BOLA',
    kind: 'lesson',
    level: 3,
    order: 30,
    unit: 'seguranca',
    summary: 'Quem é você e o que pode fazer: API keys, OAuth 2.0 com PKCE, JWT sem armadilhas, o que o CORS NÃO protege — e BOLA e mass assignment, as falhas que mais vazam dados em APIs.',
    concepts: ['AuthN × AuthZ', 'OAuth 2.0 + PKCE', 'JWT', 'CORS', 'BOLA e mass assignment'],
    takeaways: [
      '**Autenticação** responde *quem é você* (falhou: `401`); **autorização**, *o que você pode fazer com este recurso* (falhou: `403` — ou `404`, para não revelar que ele existe).',
      'Com usuário, **authorization code + PKCE**; entre máquinas, **client credentials**. O *implicit* morreu: o token vinha na URL e nada o amarrava ao app que o pediu.',
      'JWT é **assinado, não criptografado**: o servidor fixa o algoritmo (nada de `alg: none`), compara com `hmac.compare_digest`, valida `exp`, `aud` e `iss` — e planeja a revogação (access token curto + refresh com rotação).',
      '**CORS** é o navegador relaxando a *same-origin policy*: não protege a API de `curl`, scripts ou servidores. Quem protege é autenticação e autorização em cada requisição.',
      '**BOLA** (o API1 do OWASP) se evita checando o **dono** do objeto em toda consulta; **mass assignment**, com uma **allowlist** de campos graváveis.',
    ],
    glossary: [
      { term: 'JWT', aliases: ['JWTs', 'JSON Web Token', 'JSON Web Tokens'], definition: '*JSON Web Token* (RFC 7519): `header.payload.assinatura`, cada parte em base64url. É **assinado**, não criptografado — qualquer um lê o payload; a assinatura só garante que ninguém o alterou.' },
      { term: 'OAuth 2.0', aliases: ['OAuth', 'OAuth2', 'OAuth 2', 'OAuth 2.1'], definition: 'Protocolo de **delegação de autorização** (RFC 6749): um app obtém um *access token* para agir em nome do usuário sem ver a senha dele. O "quem é o usuário" fica com o **OpenID Connect**, construído por cima.' },
      { term: 'PKCE', aliases: ['Proof Key for Code Exchange'], definition: '*Proof Key for Code Exchange* (RFC 7636, pronuncia-se "pixy"): o app manda o hash de um segredo aleatório no início do fluxo e o segredo em si na troca do code, provando ser o mesmo app. Um code interceptado sozinho não vale nada.' },
      { term: 'BOLA', aliases: ['Broken Object Level Authorization', 'IDOR', 'Insecure Direct Object Reference'], definition: '*Broken Object Level Authorization*, o API1 do OWASP API Top 10: a API autentica, mas não confere se **aquele** objeto pertence a quem pede — trocar o id na URL expõe dados de outra pessoa. Também chamado de IDOR.' },
      { term: 'Mass assignment', aliases: ['atribuição em massa', 'atribuicao em massa', 'BOPLA', 'Broken Object Property Level Authorization'], definition: 'Falha em que a API copia **todos** os campos do corpo para o objeto, deixando o cliente gravar atributos proibidos (`is_admin`, `saldo`). Faz parte do **BOPLA** (API3:2023). Defesa: allowlist de campos graváveis.' },
      { term: 'CORS', aliases: ['Cross-Origin Resource Sharing'], definition: '*Cross-Origin Resource Sharing*: cabeçalhos com que o servidor diz ao **navegador** quais origens podem ler suas respostas, relaxando a *same-origin policy*. Não protege a API de clientes fora do navegador.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **segurança de APIs** — o assunto em que um detalhe esquecido vira manchete de jornal.',
          'Começando pelo básico que muita gente embaralha: **autenticação** e **autorização** são perguntas diferentes.',
        ],
        board: {
          title: 'AuthN × AuthZ',
          md: `| | **Autenticação** (authN) | **Autorização** (authZ) |
|---|---|---|
| Pergunta | **Quem** é você? | **O que** você pode fazer — com **este** recurso? |
| Evidências | senha, token, API key, certificado (mTLS) | papéis, escopos, dono do recurso, políticas |
| Se falhar | \`401 Unauthorized\` + \`WWW-Authenticate\` | \`403 Forbidden\` — ou \`404\`, para não revelar que existe |
| Onde acontece | uma vez por requisição, na borda | em **toda** operação, perto dos dados |

\`\`\`http
GET /api/faturas/1002 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="token expirado"
\`\`\`

> [!atencao] O nome é histórico e confuso: \`401 Unauthorized\` significa **não autenticado**. O "não autorizado" de verdade é o \`403\`.

> [!dica] O gateway pode cuidar da autenticação (validar o token, a API key). A autorização fina — "esta fatura é **sua**?" — não dá para terceirizar: ela depende dos dados e mora no serviço.`,
        },
      },
      {
        type: 'say',
        text: [
          'O jeito mais simples de autenticar uma integração é a **API key**: uma string secreta enviada em cada requisição.',
          'Simples não quer dizer ingênuo: dá para errar feio em como ela trafega e em como ela é guardada.',
        ],
        board: {
          title: 'API keys: simples, mas com cuidado',
          md: `Uma API key identifica **a aplicação** (a integração, o parceiro), não a pessoa — ótima para servidor ↔ servidor, cotas e cobrança. Para agir **em nome de um usuário**, o caminho é o OAuth.

| Faça | Evite |
|---|---|
| Enviar no cabeçalho: \`Authorization: Bearer sk_live_...\` | Query string (\`?api_key=...\`): vaza em logs, histórico e \`Referer\` |
| Guardar só o **hash** e mostrar a chave uma única vez | Guardar a chave em texto puro no banco |
| **Prefixo** por tipo e ambiente (\`sk_live_\`, \`sk_test_\`) | Chaves sem formato reconhecível |
| Escopos, expiração e **duas chaves ativas** para rotacionar sem downtime | Uma chave "master" eterna, compartilhada por todos |

\`\`\`python
import hashlib, hmac, secrets

def emitir_chave(prefixo="sk_live_"):
    chave = prefixo + secrets.token_urlsafe(32)                 # 256 bits aleatórios
    registro = {"hash": hashlib.sha256(chave.encode()).hexdigest(), "final": chave[-4:]}
    return chave, registro   # a chave vai UMA vez para o cliente; o banco só guarda o hash

def chave_valida(recebida, registro):
    h = hashlib.sha256(recebida.encode()).hexdigest()
    return hmac.compare_digest(h, registro["hash"])            # comparação em tempo constante
\`\`\`

> [!dica] Por que SHA-256 serve aqui, se para senhas exigimos hash **lento** (scrypt, bcrypt)? Porque a chave tem 256 bits aleatórios: não existe dicionário para testar. Senhas humanas são previsíveis; chaves geradas com \`secrets\`, não.

> [!sabia] Em 2021 o GitHub mudou o formato dos seus tokens para prefixos como \`ghp_\` e \`gho_\`, com um **checksum** no final. O prefixo deixa *secret scanners* reconhecerem um token vazado num commit com quase zero falso positivo — e o dono pode ser avisado (e a chave revogada) minutos depois do vazamento.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando um app precisa agir **em nome de um usuário** — sem nunca ver a senha dele? É para isso que existe o **OAuth 2.0**.',
          'OAuth é **delegação de autorização**. Quem acrescenta "quem é o usuário" por cima é o **OpenID Connect**.',
        ],
        board: {
          title: 'OAuth 2.0: papéis e fluxos',
          md: `\`\`\`text
 Usuário (resource owner) ──consente──▶ Servidor de autorização (Google, Auth0, Keycloak…)
                                              │ emite tokens
 App (client) ◀──────── access token ─────────┘
     │
     └── Authorization: Bearer … ──▶ API (resource server)
\`\`\`

| Fluxo (*grant*) | Quando usar | Situação |
|---|---|---|
| **Authorization code + PKCE** | apps com usuário: web, SPA, mobile, CLI | ✅ o padrão |
| **Client credentials** | máquina ↔ máquina, sem usuário (jobs, integrações) | ✅ |
| **Device authorization** | TV, console, terminal sem navegador | ✅ |
| **Refresh token** | renovar o access token sem novo login | ✅ com rotação |
| Implicit | SPAs de 2012 | ❌ desaconselhado |
| Password (ROPC) | o app recebe a senha do usuário | ❌ desaconselhado |

**Por que o implicit morreu:** ele devolvia o **access token direto na URL** do redirect (\`#access_token=...\`). O token ficava exposto no histórico, a extensões e a *open redirects*; nada provava que o app que o recebeu era o que o pediu; e não havia refresh token. Ele existia porque, em 2012, o navegador não conseguia fazer um \`POST\` cross-origin para o \`/token\`. Com CORS em todo lugar, o authorization code + PKCE funciona também em SPAs.

\`\`\`http
POST /oauth/token HTTP/1.1
Host: auth.loja.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic Y2xpZW50LWpvYnM6c2VncmVkbw==

grant_type=client_credentials&scope=pedidos:ler
\`\`\`

> [!dica] A RFC 9700 (*Best Current Practice for OAuth 2.0 Security*, 2025) e o rascunho do **OAuth 2.1** consolidam as regras: PKCE para todos, implicit e password fora, \`redirect_uri\` comparada de forma **exata**.`,
        },
      },
      {
        type: 'say',
        text: [
          'Vamos ao fluxo principal, passo a passo: **authorization code com PKCE**.',
          'O truque do PKCE é elegante: o app prova que é **o mesmo** que começou o fluxo, sem precisar de um segredo fixo guardado no app.',
        ],
        board: {
          title: 'Authorization code + PKCE',
          md: `\`\`\`text
 App                            Servidor de autorização
  │ 1. gera code_verifier (aleatório) e
  │    code_challenge = BASE64URL(SHA256(verifier))
  │ 2. abre /authorize?response_type=code&client_id=…&redirect_uri=…
  │         &scope=…&state=xyz&code_challenge=…&code_challenge_method=S256
  │                             3. usuário faz login e consente
  │ ◀── 4. redirect_uri?code=abc&state=xyz        (code de uso único)
  │ 5. confere o state; POST /token com code + code_verifier
  │                             6. SHA256(verifier) == challenge? emite os tokens
  │ ◀── access_token (+ refresh_token)
  │ 7. GET /api/pedidos   Authorization: Bearer …
\`\`\`

\`\`\`python
import base64, hashlib, secrets

verifier = secrets.token_urlsafe(64)     # fica no app; só viaja no passo 5
challenge = base64.urlsafe_b64encode(
    hashlib.sha256(verifier.encode()).digest()
).rstrip(b"=").decode()                  # vai no /authorize (passo 2)

# exemplo da RFC 7636: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
#                   →  "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
\`\`\`

| Parâmetro | Protege contra |
|---|---|
| \`state\` | **CSRF** no callback: alguém "injetar" o code dele na sua sessão |
| \`code_challenge\` + \`code_verifier\` | **interceptação do code**: sem o verifier, o code roubado não vale nada |
| \`redirect_uri\` exata | o code ser entregue num endereço do atacante |

> [!sabia] **PKCE** (RFC 7636) se pronuncia **"pixy"** — está escrito na própria RFC. Ele nasceu para apps **mobile**, onde outro app instalado podia registrar o mesmo *custom scheme* (\`minhaapp://callback\`) e capturar o code. Hoje é recomendado para **todos** os clientes, inclusive os que têm client secret.`,
        },
      },
      {
        type: 'say',
        text: [
          'O access token muitas vezes é um **JWT**: três pedaços em base64url separados por pontos.',
          'E já adianto o mais importante: JWT é **assinado**, não **criptografado**. Qualquer um lê o conteúdo.',
        ],
        board: {
          title: 'Anatomia de um JWT',
          md: `\`\`\`text
  xxxxx.yyyyy.zzzzz
  │     │     └─ assinatura = HMAC-SHA256(segredo, "xxxxx.yyyyy")   ← no HS256
  │     └─ payload (as claims), em base64url
  └─ header (algoritmo e tipo), em base64url
\`\`\`

\`\`\`json
{"alg": "HS256", "typ": "JWT", "kid": "chave-2026-09"}
\`\`\`

\`\`\`json
{
  "iss": "https://auth.loja.com",
  "sub": "usuario-42",
  "aud": "api-pedidos",
  "iat": 1790000000,
  "exp": 1790000900,
  "jti": "b1f7c0de-4e1a",
  "scope": "pedidos:ler"
}
\`\`\`

| Claim | Significado | Se você não validar… |
|---|---|---|
| \`exp\` | expira em (segundos Unix) | um token roubado vale para sempre |
| \`aud\` | para **qual** API o token foi emitido | o token de outro serviço é aceito no seu |
| \`iss\` | quem emitiu | tokens de outro emissor passam |
| \`jti\` | id único do token | não há como colocar **este** token numa denylist |

| | **HS256** (HMAC) | **RS256 / ES256** (assimétrico) |
|---|---|---|
| Chave | **um segredo** compartilhado | **privada** assina, **pública** verifica |
| Quem verifica também pode… | **emitir** tokens! | só verificar |
| Bom para | um serviço que emite e verifica | muitos serviços; chaves publicadas em JWKS (\`kid\`) |

\`\`\`python
import base64, json

def espiar(token):
    """Lê o payload SEM verificar nada — qualquer um consegue."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)      # base64url vem sem padding
    return json.loads(base64.urlsafe_b64decode(payload))
\`\`\`

> [!atencao] Nunca ponha dados sensíveis (CPF, endereço, detalhes internos de permissão) no payload. Existe JWT criptografado (**JWE**), mas quase sempre a resposta certa é "não mande isso no token".`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora as armadilhas — algumas derrubaram bibliotecas inteiras.',
          'A pior delas: deixar o **próprio token** escolher o algoritmo com que ele vai ser verificado.',
        ],
        board: {
          title: 'JWT: armadilhas e revogação',
          md: `| Armadilha | O ataque | Defesa |
|---|---|---|
| \`alg: none\` | o atacante manda \`{"alg": "none"}\` e assinatura vazia; a biblioteca "verifica" sem chave | **allowlist** de algoritmos no servidor |
| *Algorithm confusion* | token RS256 reescrito como HS256 e assinado com a **chave pública** (que é pública!) usada como segredo HMAC | algoritmo fixo por chave; nunca lido do token |
| Segredo HS256 fraco | força bruta *offline*: com um token em mãos, testa-se segredos à vontade | segredo aleatório de 256+ bits |
| Não validar \`exp\`/\`aud\`/\`iss\` | token velho, ou de outro serviço, aceito | validar todas as claims |
| Comparar com \`==\` | *timing attack* | \`hmac.compare_digest\` |

\`\`\`python
# PyJWT: SEMPRE passe a lista de algoritmos aceitos (e exija as claims)
payload = jwt.decode(token, chave, algorithms=["HS256"], audience="api-pedidos",
                     options={"require": ["exp", "iat"]})
\`\`\`

**Revogação, o calcanhar de Aquiles.** O servidor não guarda estado, então não há sessão para apagar: um token vazado vale até o \`exp\`. As saídas:

| Estratégia | Como funciona |
|---|---|
| **Access token curto** (5–15 min) + **refresh token** | o refresh — esse sim, guardado no servidor — pode ser revogado |
| **Rotação** do refresh com detecção de reuso | cada uso gera um refresh novo; um antigo reaparecer indica roubo → revoga a família inteira |
| **Denylist** por \`jti\` até o \`exp\` | uma consulta (rápida, em cache) por requisição |
| **Versão de token** por usuário | "sair de todos os dispositivos" = incrementar um número |

> [!sabia] Em 2015, Tim McLean mostrou que várias bibliotecas populares de JWT aceitavam \`alg: none\` e caíam na *algorithm confusion* — no Node, virou a **CVE-2015-9235**. A lição virou regra na RFC 8725 (*JWT Best Current Practices*): quem decide o algoritmo é o **servidor**, nunca o cabeçalho do token.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o assunto que mais gera "conserto" errado em fórum: **CORS**.',
          'Guarde isto: CORS **não protege a sua API**. Ele é o navegador **afrouxando** uma proteção que já existe — a *same-origin policy*.',
        ],
        board: {
          title: 'CORS: o que é — e o que NÃO é',
          md: `Por padrão, o JavaScript de \`https://evil.com\` **não pode ler** respostas de \`https://api.banco.com\` (*same-origin policy*) — senão ele leria o seu extrato usando os seus cookies. O **CORS** deixa a API dizer ao navegador quais origens **podem** ler.

\`\`\`http
OPTIONS /api/pedidos/42 HTTP/1.1
Origin: https://app.loja.com
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.loja.com
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600
Vary: Origin
\`\`\`

| O CORS **faz** | O CORS **não faz** |
|---|---|
| Liberar a **leitura** da resposta para origens permitidas | Bloquear \`curl\`, Postman, scripts ou outros servidores |
| Perguntar antes (*preflight* \`OPTIONS\`) nas requisições "não simples" | Impedir que um \`POST\` "simples" (de formulário) **chegue** e seja executado — isso é CSRF |
| Proteger o **usuário** de sites maliciosos | Autenticar ou autorizar quem chama a API |

> [!atencao] Anti-padrões clássicos: devolver qualquer \`Origin\` recebido junto com \`Access-Control-Allow-Credentials: true\` (qualquer site lê respostas com os cookies da vítima); validar a origem com \`endswith("loja.com")\` (aceita \`evil-loja.com\`); e esquecer o \`Vary: Origin\`, deixando um cache servir a resposta de uma origem para outra.

> [!sabia] Liberar a origem **\`null\`** parece inofensivo, mas é perigoso: páginas em \`iframe\` com *sandbox*, arquivos \`file://\` e alguns redirecionamentos enviam \`Origin: null\` — e qualquer atacante produz isso com um iframe sandboxed.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para fechar a teoria: o **OWASP API Security Top 10**, a lista das falhas que mais aparecem em APIs de verdade.',
          'Vou focar em duas que pouca gente conhece pelo nome, mas que vazam dados toda semana: **BOLA** e **mass assignment**.',
        ],
        board: {
          title: 'OWASP API Top 10: BOLA e mass assignment',
          md: `| 2023 | Risco | Em uma frase |
|---|---|---|
| API1 | **BOLA** (*Broken Object Level Authorization*) | acessar o objeto **de outro** trocando o id |
| API2 | Broken Authentication | tokens fracos, sem expiração, login sem limite de tentativas |
| API3 | **BOPLA** (*Broken Object Property Level Authorization*) | ler ou **gravar** campos que não deveria |
| API4 | Unrestricted Resource Consumption | sem limite de taxa, de tamanho ou de custo |
| API5 | Broken Function Level Authorization | usuário comum chamando rota de admin |
| API6 | Unrestricted Access to Sensitive Business Flows | robôs comprando o estoque inteiro |
| API7 | Server Side Request Forgery (SSRF) | a API busca uma URL escolhida pelo atacante |
| API8 | Security Misconfiguration | CORS aberto, erros verbosos, TLS fraco |
| API9 | Improper Inventory Management | a \`/v1\` esquecida, sem as correções da \`/v2\` |
| API10 | Unsafe Consumption of APIs | confiar cegamente em respostas de terceiros |

\`\`\`python
# ❌ BOLA: autenticado não quer dizer autorizado
def ver_fatura(usuario, fatura_id):
    return db.buscar_fatura(fatura_id)                  # de QUALQUER cliente!

# ✅ o dono faz parte da consulta — e "não é sua" vira 404
def ver_fatura(usuario, fatura_id):
    fatura = db.buscar_fatura(fatura_id, cliente_id=usuario.id)
    if fatura is None:
        raise NaoEncontrado()      # 404: nem confirma que a fatura existe
    return fatura
\`\`\`

\`\`\`python
# ❌ mass assignment: o cliente escolhe quais atributos mudar
def atualizar_perfil(usuario, dados):
    for campo, valor in dados.items():
        setattr(usuario, campo, valor)         # {"is_admin": true} 😱

# ✅ allowlist explícita (ou um schema/DTO que rejeita campos extras)
EDITAVEIS = {"nome", "bio", "avatar_url"}

def atualizar_perfil(usuario, dados):
    proibidos = dados.keys() - EDITAVEIS
    if proibidos:
        raise ValueError(f"campos não editáveis: {sorted(proibidos)}")
    for campo, valor in dados.items():
        setattr(usuario, campo, valor)
\`\`\`

> [!sabia] O BOLA é o **API1** tanto na edição de 2019 quanto na de 2023. Em 2023, *mass assignment* (gravar campo proibido) e *excessive data exposure* (devolver campo demais, como \`senha_hash\` no JSON) foram fundidos num risco novo, o **BOPLA**: a mesma falha vista pelos dois lados — autorização por **propriedade** do objeto. O antídoto dos dois é o mesmo: DTOs explícitos na entrada e na saída.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um JWT assinado e verificado na unha, só com a stdlib.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'api-sec-q1',
        concept: 'BOLA',
        say: 'Primeira: chegou um relatório de pentest. Qual é o diagnóstico?',
        prompt: 'A Ana está logada com um token válido e chama `GET /api/faturas/1001` — a fatura **dela**. Por curiosidade, troca para `/api/faturas/1002` e recebe a fatura de **outro cliente**, com nome e endereço. O que está errado e qual a correção?',
        options: [
          { text: '**BOLA**: a API autentica, mas não confere se a fatura pertence a quem pede. A correção é checar o dono em **toda** consulta (`WHERE id = ? AND cliente_id = ?`) e responder `404` quando não for dela.', correct: true, why: 'Exato. A falha é de autorização **no nível do objeto**: saber quem é a Ana não basta, é preciso conferir se **aquela** fatura é dela — perto dos dados, em toda rota que recebe um id.' },
          { text: 'Os ids são sequenciais: trocá-los por UUIDs aleatórios resolve.', why: 'UUIDs só dificultam **adivinhar** ids, e ids vazam em URLs, logs, e-mails e respostas de outras rotas. Sem checar o dono, quem obtém o UUID lê a fatura. É obscuridade, não autorização.' },
          { text: 'É falha de **autenticação**: o token da Ana deveria expirar mais rápido.', why: 'A autenticação funcionou — a API sabe exatamente que é a Ana. O que falhou foi a **autorização**. Um token de 5 minutos continuaria abrindo faturas alheias durante esses 5 minutos.' },
          { text: 'Faltou **rate limiting**: limitar a 10 requisições por minuto impede o ataque.', why: 'Rate limiting só deixa a enumeração mais lenta: cada requisição ainda devolve dados de outro cliente. É defesa complementar (contra raspagem em massa), não a correção.' },
        ],
        explanation: 'Esse é o **BOLA** (*Broken Object Level Authorization*, também chamado de **IDOR**), o API1 do OWASP API Security Top 10 nas edições de 2019 e 2023. A regra: toda rota que recebe um id precisa verificar se **aquele** objeto pode ser acessado por **aquele** usuário — de preferência na própria consulta ao banco. Responder `404` em vez de `403` evita confirmar que a fatura 1002 existe. E vale um teste automatizado "o usuário A tenta ler o recurso de B" em cada rota: ele pega regressões que a revisão de código deixa passar.',
      },
      {
        type: 'order',
        id: 'api-sec-q2',
        concept: 'OAuth 2.0 + PKCE',
        say: 'Agora coloque o fluxo do OAuth na ordem — do clique em "Entrar" até a primeira chamada à API.',
        prompt: 'Um app mobile usa **authorization code + PKCE**. Ordene os passos, do primeiro ao último.',
        items: [
          'O app gera um `code_verifier` aleatório e calcula o `code_challenge` (SHA-256 em base64url)',
          'O app abre o `/authorize` do servidor de autorização com o `code_challenge` e um `state`',
          'O usuário faz login e consente com os escopos pedidos',
          'O servidor redireciona para o `redirect_uri` com um `code` de uso único e o mesmo `state`',
          'O app confere o `state` e envia o `code` + o `code_verifier` ao `/token`',
          'O servidor confere que o SHA-256 do verifier bate com o challenge e emite os tokens',
          'O app chama a API com o cabeçalho `Authorization: Bearer` e o access token',
        ],
        explanation: 'O ponto-chave: o **challenge** viaja pelo navegador (visível, interceptável), mas o **verifier** só aparece no passo 5, numa chamada direta do app ao servidor. Quem roubar o `code` no redirect não tem o verifier — e o code sozinho não vale nada. O `state` amarra o callback à sessão que iniciou o fluxo (contra CSRF), e o `code` é de **uso único** e dura poucos segundos.',
      },
      {
        type: 'match',
        id: 'api-sec-q3',
        concept: 'Ataques e defesas em APIs',
        say: 'Cada ataque tem a sua defesa certeira. Associe!',
        prompt: 'Associe cada **ataque ou falha** à **defesa** que o resolve.',
        pairs: [
          { left: 'O servidor aceita um JWT com `alg: none`', right: 'Allowlist fixa de algoritmos no verificador' },
          { left: 'Trocar o id na URL mostra a fatura de outro cliente', right: 'Checar o dono do objeto em toda consulta' },
          { left: '`{"is_admin": true}` no corpo do PATCH vira admin', right: 'Allowlist de campos graváveis (DTO/schema)' },
          { left: 'Um app malicioso intercepta o authorization code', right: 'PKCE: `code_verifier` + `code_challenge`' },
          { left: 'Um token vazado continua valendo por dias', right: 'Access token curto + rotação de refresh token' },
          { left: 'A API key aparece nos logs do proxy', right: 'Chave no cabeçalho, nunca na query string' },
        ],
        explanation: 'Repare no padrão: quase toda defesa é uma **allowlist** (de algoritmos, de campos, de donos) ou uma forma de **encurtar a vida e o alcance** de um segredo — o PKCE torna o code inútil sozinho, tokens curtos limitam o estrago de um vazamento, e cabeçalhos não vão parar em logs de acesso. Segurança de API é, em boa parte, **dizer explicitamente o que é permitido** em vez de tentar listar o que é proibido.',
      },
      {
        type: 'code',
        id: 'api-sec-q4',
        concept: 'JWT HS256',
        title: 'JWT HS256 na unha',
        say: 'Agora é com você: assinar e verificar um JWT só com a stdlib. O verificador é o que importa — pense em cada token torto que um atacante pode mandar.',
        prompt: `Implemente um JWT **HS256** usando só \`base64\`, \`hmac\`, \`hashlib\` e \`json\`:

- \`b64url_encode(dados: bytes) -> str\`: base64url **sem** o padding \`=\`.
- \`b64url_decode(texto: str) -> bytes\`: o inverso — recoloque o padding que falta antes de decodificar.
- \`assinar_jwt(payload, segredo) -> str\`: monta \`header.payload.assinatura\` com o cabeçalho \`{"alg": "HS256", "typ": "JWT"}\`. Serialize o JSON **compacto**, com \`json.dumps(obj, separators=(",", ":"))\`. A assinatura é o HMAC-SHA256 (com \`segredo\`) do texto \`"<header>.<payload>"\` já codificado.
- \`verificar_jwt(token, segredo, relogio=time.time) -> dict\`: devolve o payload de um token válido. \`relogio()\` devolve o "agora" em segundos Unix — nos testes, um relógio falso.

\`verificar_jwt\` lança \`TokenInvalido\` quando:

1. o token não tem exatamente 3 partes, ou alguma parte não decodifica (base64url/JSON) — **nunca** deixe escapar outra exceção;
2. o \`alg\` do cabeçalho não é exatamente \`"HS256"\` (inclusive \`"none"\`);
3. a assinatura não bate — recalcule-a sobre \`header.payload\` **exatamente como chegaram** e compare com \`hmac.compare_digest\`;
4. o payload tem \`exp\` e \`relogio() >= exp\` (expirado).`,
        starter: `import base64
import hashlib
import hmac
import json
import time


class TokenInvalido(Exception):
    """Token malformado, com assinatura errada, algoritmo não permitido ou expirado."""


def b64url_encode(dados):
    # TODO: base64url SEM padding
    pass


def b64url_decode(texto):
    # TODO: recoloque o padding que falta e decodifique
    pass


def assinar_jwt(payload, segredo):
    # TODO: header.payload.assinatura
    pass


def verificar_jwt(token, segredo, relogio=time.time):
    # TODO: devolva o payload ou lance TokenInvalido
    pass
`,
        tests: [
          {
            name: 'b64url_encode: alfabeto URL-safe e sem padding',
            code: `obtido = b64url_encode(b"a")
assert obtido == "YQ", f"b64url_encode(b'a') deveria ser 'YQ' (sem '='), veio {obtido!r}"
obtido = b64url_encode(b"\\xfb\\xff\\xbf")
assert obtido == "-_-_", f"use o alfabeto URL-safe ('+' vira '-', '/' vira '_'): veio {obtido!r}"
assert b64url_encode(b"abc") == "YWJj"
assert b64url_encode(b"") == ""`,
          },
          {
            name: 'b64url_decode: recoloca o padding que falta',
            code: `for texto, esperado in [("YQ", b"a"), ("YWI", b"ab"), ("YWJj", b"abc"), ("-_-_", b"\\xfb\\xff\\xbf"), ("", b"")]:
    obtido = b64url_decode(texto)
    assert obtido == esperado, f"b64url_decode({texto!r}) deveria ser {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'assinar_jwt gera exatamente o token de exemplo do jwt.io',
            code: `token = assinar_jwt({"sub": "1234567890", "name": "John Doe", "iat": 1516239022}, b"your-256-bit-secret")
esperado = "${JWT_IO}"
assert isinstance(token, str), f"assinar_jwt deve devolver str, veio {type(token).__name__}"
partes = token.split(".")
assert len(partes) == 3, f"um JWT tem 3 partes separadas por '.', o seu tem {len(partes)}"
for nome, obtida, certa in zip(["header", "payload", "assinatura"], partes, esperado.split(".")):
    assert obtida == certa, f"{nome} diferente do jwt.io: {obtida!r} (esperado {certa!r}). JSON compacto? base64url sem '='?"`,
          },
          {
            name: 'verificar_jwt devolve o payload (inclusive o do token do jwt.io)',
            code: AUX + `
segredo = b"s3gr3d0-de-teste-com-32-bytes!!"
payload = {"sub": "42", "papel": "leitor", "exp": 1_700_000_600}
obtido = verificar_jwt(_token(HS256, payload, segredo), segredo, relogio=lambda: 1_700_000_000)
assert obtido == payload, f"token HS256 válido deveria devolver o payload, veio {obtido!r}"
obtido = verificar_jwt(assinar_jwt(payload, segredo), segredo, relogio=lambda: 1_700_000_000)
assert obtido == payload, f"o token gerado por assinar_jwt deveria ser aceito, veio {obtido!r}"
obtido = verificar_jwt("${JWT_IO}", b"your-256-bit-secret", relogio=lambda: 1_700_000_000)
assert obtido == {"sub": "1234567890", "name": "John Doe", "iat": 1516239022}, f"payload do jwt.io: {obtido!r}"`,
          },
          {
            name: 'payload adulterado (papel trocado para admin) → TokenInvalido',
            code: AUX + `
segredo = b"s3gr3d0"
h, p, s = _token(HS256, {"sub": "42", "papel": "leitor"}, segredo).split(".")
p_falso = _b64(_json.dumps({"sub": "42", "papel": "admin"}, separators=(",", ":")).encode())
_rejeita(f"{h}.{p_falso}.{s}", segredo, motivo="payload trocado mantendo a assinatura antiga")`,
          },
          {
            name: 'alg "none" (sem assinatura) → TokenInvalido',
            code: AUX + `
_rejeita(_token({"alg": "none", "typ": "JWT"}, {"sub": "42", "papel": "admin"}, None), b"s3gr3d0", motivo='alg "none"')`,
          },
          {
            name: 'exp: vale 1 s antes, expirou 1 s depois (relógio injetado)',
            code: AUX + `
segredo = b"s3gr3d0"
token = _token(HS256, {"sub": "42", "exp": 1000}, segredo)
obtido = verificar_jwt(token, segredo, relogio=lambda: 999)
assert obtido == {"sub": "42", "exp": 1000}, f"em t=999 o token (exp=1000) ainda vale, veio {obtido!r}"
_rejeita(token, segredo, agora=1001, motivo="em t=1001 o token com exp=1000 já expirou")`,
          },
          {
            name: 'no instante exato do exp o token já expirou',
            hidden: true,
            code: AUX + `
segredo = b"s3gr3d0"
_rejeita(_token(HS256, {"sub": "42", "exp": 1000}, segredo), segredo, agora=1000,
         motivo="relogio() == exp: a RFC 7519 exige que o agora seja ANTERIOR ao exp")`,
          },
          {
            name: 'aceita JSON com espaços e outra ordem de chaves (assinatura sobre os bytes recebidos)',
            hidden: true,
            code: AUX + `
segredo = b"s3gr3d0"
h = _b64(b'{"typ": "JWT",  "alg": "HS256"}')
p = _b64(b'{ "papel": "leitor", "sub": "42" }')
s = _b64(_hmac.new(segredo, f"{h}.{p}".encode(), "sha256").digest())
try:
    obtido = verificar_jwt(f"{h}.{p}.{s}", segredo, relogio=lambda: 0)
except TokenInvalido as e:
    raise AssertionError(f"um token válido gerado por outra biblioteca (JSON com espaços e outra ordem de chaves) foi recusado ({e}): confira a assinatura sobre o header.payload RECEBIDO, sem reserializar") from None
assert obtido == {"sub": "42", "papel": "leitor"}, f"payload: {obtido!r}"`,
          },
          {
            name: 'assinado com outro segredo → TokenInvalido',
            hidden: true,
            code: AUX + `
_rejeita(_token(HS256, {"sub": "42"}, b"segredo-do-atacante"), b"segredo-do-servidor", motivo="token assinado com outro segredo")`,
          },
          {
            name: 'só HS256 passa: HS512, "hs256", "nOnE" e cabeçalho sem alg → TokenInvalido',
            hidden: true,
            code: AUX + `
segredo = b"s3gr3d0"
payload = {"sub": "42"}
_rejeita(_token({"alg": "HS512", "typ": "JWT"}, payload, segredo), segredo, motivo='cabeçalho com alg "HS512"')
_rejeita(_token({"alg": "hs256", "typ": "JWT"}, payload, segredo), segredo, motivo='alg "hs256" (o valor diferencia maiúsculas)')
_rejeita(_token({"typ": "JWT"}, payload, segredo), segredo, motivo="cabeçalho sem alg")
_rejeita(_token({"alg": "nOnE", "typ": "JWT"}, payload, None), segredo, motivo='alg "nOnE"')`,
          },
          {
            name: 'token malformado → TokenInvalido (nunca outra exceção)',
            hidden: true,
            code: AUX + `
segredo = b"s3gr3d0"
valido = _token(HS256, {"sub": "42"}, segredo)
casos = ["", "abc", "a.b", "a.b.c", "!!!.@@@.###", valido + ".extra",
         _b64(b"nao sou json") + "." + valido.split(".", 1)[1]]
for caso in casos:
    _rejeita(caso, segredo, motivo=f"token malformado {caso[:30]!r}")`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou as assinaturas sem `hmac.compare_digest`. O `==` para no **primeiro byte diferente**, então o tempo de resposta vaza quantos bytes o atacante já acertou (*timing attack*). O `compare_digest` leva o mesmo tempo, acertando ou errando.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.calls.includes('time') && m.imports.includes('time'),
            text: 'Você chamou `time.time()` dentro da lógica. Use o `relogio` injetado: é ele que permite testar "um segundo depois do `exp`" sem esperar — e simular exatamente o instante de borda.',
            concept: 'Injeção de relógio',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Assim, um bug **seu** — um `TypeError`, um `KeyError` — vira silenciosamente "token inválido". Capture só `ValueError`: `binascii.Error`, `json.JSONDecodeError` e `UnicodeDecodeError` são todas subclasses dela.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.maxComplexity > 10,
            text: '`verificar_jwt` ficou com muitos caminhos. Quebre em passos com nome — decodificar, checar o algoritmo, checar a assinatura, checar as claims —, cada um lançando `TokenInvalido`. Código de segurança precisa ser fácil de **auditar**.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          '**base64url:** `base64.urlsafe_b64encode(dados).rstrip(b"=").decode()`. Na volta, recoloque o padding com `texto + "=" * (-len(texto) % 4)` e use `base64.urlsafe_b64decode`.',
          '**Assinar:** `h = b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())`, o mesmo para o payload, e a terceira parte é `b64url_encode(hmac.new(segredo, f"{h}.{p}".encode(), hashlib.sha256).digest())`.',
          '**Verificar, nesta ordem:** 3 partes? → decodifique o header (transforme `ValueError` em `TokenInvalido`) → `alg == "HS256"`? → recalcule o HMAC sobre o `h.p` **recebido** e compare com `hmac.compare_digest` → decodifique o payload → se houver `exp` e `relogio() >= exp`, expirou.',
        ],
        solution: `import base64
import hashlib
import hmac
import json
import time


class TokenInvalido(Exception):
    """Token malformado, com assinatura errada, algoritmo não permitido ou expirado."""


CABECALHO = {"alg": "HS256", "typ": "JWT"}


def b64url_encode(dados):
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def b64url_decode(texto):
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def _json_compacto(obj):
    return json.dumps(obj, separators=(",", ":")).encode()


def _hmac_sha256(conteudo, segredo):
    return hmac.new(segredo, conteudo.encode(), hashlib.sha256).digest()


def assinar_jwt(payload, segredo):
    conteudo = b64url_encode(_json_compacto(CABECALHO)) + "." + b64url_encode(_json_compacto(payload))
    return conteudo + "." + b64url_encode(_hmac_sha256(conteudo, segredo))


def _decodificar(parte):
    try:
        return b64url_decode(parte)
    except ValueError as erro:          # binascii.Error é subclasse de ValueError
        raise TokenInvalido("base64url inválido") from erro


def _decodificar_json(parte):
    try:
        return json.loads(_decodificar(parte))
    except ValueError as erro:          # JSONDecodeError e UnicodeDecodeError também
        raise TokenInvalido("JSON inválido") from erro


def verificar_jwt(token, segredo, relogio=time.time):
    partes = token.split(".")
    if len(partes) != 3:
        raise TokenInvalido("um JWT tem exatamente 3 partes")
    h64, p64, s64 = partes
    cabecalho = _decodificar_json(h64)
    if not isinstance(cabecalho, dict) or cabecalho.get("alg") != "HS256":
        raise TokenInvalido("algoritmo não permitido")      # barra "none", HS512, RS256…
    esperada = _hmac_sha256(h64 + "." + p64, segredo)         # sobre os bytes RECEBIDOS
    if not hmac.compare_digest(esperada, _decodificar(s64)):
        raise TokenInvalido("assinatura inválida")
    payload = _decodificar_json(p64)                        # só agora o conteúdo é confiável
    if not isinstance(payload, dict):
        raise TokenInvalido("o payload precisa ser um objeto JSON")
    if "exp" in payload and relogio() >= payload["exp"]:
        raise TokenInvalido("token expirado")
    return payload
`,
        solutionExplanation: 'A ordem das verificações importa. Primeiro o **formato** (3 partes); depois o **algoritmo** — a allowlist é do servidor, então `none`, `HS512` ou `RS256` param ali; depois a **assinatura**, recalculada sobre o `header.payload` **exatamente como recebido** (reserializar o JSON mudaria os bytes) e comparada com `hmac.compare_digest`. Só então o payload é confiável para ler o `exp` — com `>=`, porque a RFC 7519 exige que o agora seja **anterior** ao `exp`. Todo erro de decodificação (`binascii.Error`, `JSONDecodeError`, `UnicodeDecodeError`) é um `ValueError` e vira `TokenInvalido`. Em produção, use uma biblioteca madura (`jwt.decode(token, chave, algorithms=["HS256"], audience=...)` no PyJWT) e valide também `aud`, `iss` e `nbf`.',
      },
      {
        type: 'mcq',
        id: 'api-sec-q5',
        concept: 'CORS',
        say: 'Agora um clássico de revisão de código. Cuidado com a pegadinha.',
        prompt: 'A API de pagamentos só responde com `Access-Control-Allow-Origin: https://app.loja.com`. Na revisão, alguém comenta: *"Então ela está protegida: só o nosso front consegue chamá-la."* O comentário está certo?',
        options: [
          { text: 'Não: o CORS é aplicado pelo **navegador**. `curl`, scripts e outros servidores ignoram esses cabeçalhos — quem protege a API é autenticação e autorização em cada requisição.', correct: true, why: 'Exato. O CORS só decide se o **JavaScript de uma página** pode ler a resposta. Fora do navegador ninguém consulta esses cabeçalhos — e o `Origin` pode ser forjado à vontade.' },
          { text: 'Sim: o servidor recusa as requisições cujo `Origin` não esteja liberado.', why: 'O CORS não recusa nada no servidor: a requisição chega, é processada, e a resposta sai **anotada** com cabeçalhos. Quem bloqueia a **leitura** é o navegador.' },
          { text: 'Sim, desde que o preflight `OPTIONS` também só libere essa origem.', why: 'O preflight é o navegador **perguntando** antes de requisições "não simples". Quem não é navegador simplesmente não faz preflight.' },
          { text: 'Não, mas basta trocar para `Access-Control-Allow-Origin: *`, que é mais restrito.', why: '`*` é o mais **permissivo**: libera a leitura para qualquer origem (só não combina com credenciais). Nenhuma configuração de CORS substitui autenticação.' },
        ],
        explanation: 'A *same-origin policy* é do navegador, e o **CORS** é o jeito de o servidor **relaxá-la** de forma controlada. Ele protege os **usuários** (um site malicioso não consegue **ler** respostas obtidas com os cookies deles), não a API. E mesmo no navegador uma requisição "simples" — um `POST` de formulário — **chega** ao servidor e é executada; o CORS só barra a leitura da resposta. Contra isso existem tokens anti-CSRF e cookies `SameSite`.',
      },
      {
        type: 'open',
        id: 'api-sec-q6',
        concept: 'JWT em produção',
        say: 'Última: uma revisão de design. Me convença.',
        prompt: 'Seu time quer trocar as sessões guardadas no servidor por **JWT** "porque é stateless e escala melhor". Que pontos você levantaria na revisão antes de aprovar?',
        minWords: 30,
        rubric: [
          { label: 'Planeja a **revogação** (logout, bloqueio): denylist por `jti` ou versão de token', keywords: ['revog', 'logout', 'denylist', 'deny list', 'blacklist', 'blocklist', 'lista de bloqueio', 'lista negra', 'jti', 'invalidar', 'token_version', 'versao do token', 'versao de token'], concept: 'Revogação de JWT', why: 'Sem estado no servidor não há sessão para apagar: um token roubado vale até o `exp`. Revogar exige reintroduzir algum estado.' },
          { label: 'Access token **curto** + **refresh token** (com rotação)', keywords: ['refresh', 'curto', 'curta dura', 'vida curta', 'minutos', 'short-lived', 'rotacao', 'rotacion'], concept: 'Refresh token', why: 'Tokens curtos limitam a janela de um vazamento; o refresh token — esse sim revogável e rotacionado — evita pedir login a toda hora.' },
          { label: 'Validação rigorosa: **algoritmo fixo** (nada de `alg: none`), assinatura, `exp`, `aud`, `iss`', keywords: ['algoritmo', 'alg:', 'alg none', 'assinatura', 'audience', 'issuer', 'claim', 'hs256', 'rs256', 'jwks', 'allowlist', 'whitelist'], concept: 'Validação de JWT', why: 'Boa parte dos incidentes com JWT vem de validação frouxa: aceitar `alg: none`, confundir algoritmos, ignorar `exp` ou `aud`.' },
          { label: 'Payload **legível** e armazenamento seguro (cookie `HttpOnly` × `localStorage`/XSS)', keywords: ['legivel', 'qualquer um le', 'qualquer pessoa le', 'nao e criptograf', 'nao criptograf', 'dados sensiveis', 'base64', 'httponly', 'localstorage', 'xss', 'cookie'], concept: 'Armazenamento de tokens', why: 'O payload é só base64url — nada de segredos nele. E um token em `localStorage` é roubado por qualquer XSS; um cookie `HttpOnly` não é lido por JavaScript.' },
        ],
        modelAnswer: `Eu aprovaria com quatro condições. **Validação rigorosa**: o servidor fixa o algoritmo numa allowlist (\`HS256\` com um só serviço; com vários, \`RS256\` e chaves publicadas em JWKS) — nada de \`alg: none\` —, verifica a assinatura e valida \`exp\`, \`aud\` e \`iss\` em toda requisição.

**Revogação**: JWT não tem logout nativo; um token vazado vale até expirar. Para bloqueio imediato, uma **denylist** por \`jti\` (ou uma versão de token por usuário) consultada em cache.

**Tokens curtos**: o access token dura de 5 a 15 minutos, e a renovação usa um **refresh token** guardado no servidor, trocado a cada uso (rotação); se um refresh antigo reaparecer, revogo a família inteira.

**Conteúdo e armazenamento**: o payload é só base64url — qualquer um lê —, então nada de dados sensíveis nele; no navegador, o token vai num cookie \`HttpOnly\` + \`Secure\` + \`SameSite\`, não no \`localStorage\`, onde qualquer XSS o rouba. E vale lembrar: com denylist e refresh no servidor, o "stateless" fica parcial — para um único backend, sessão no servidor continua uma ótima escolha.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou muito bem! Hoje você viu por que "está logado" nunca é o fim da conversa.',
          { text: 'Resumo: authN diz quem é, authZ decide o quê — objeto por objeto, campo por campo. PKCE no fluxo, algoritmo fixo no JWT, e CORS não é firewall.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
