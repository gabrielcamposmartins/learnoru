(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo).
  const AUX_SQL = `import sqlite3 as _sqlite3

def _db():
    conn = _sqlite3.connect(":memory:")
    conn.executescript("""
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, email TEXT, senha_hash TEXT);
    INSERT INTO usuarios VALUES
      (1, 'Ana', 'ana@ex.com', 'hash-da-ana'),
      (2, 'Bruno', 'bruno@ex.com', 'hash-do-bruno'),
      (3, 'Joana D''Arc', 'joana.d''arc@ex.com', 'hash-da-joana');
    CREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, preco REAL);
    INSERT INTO produtos VALUES
      (1, 'Caneca', 35.0), (2, 'Camiseta', 80.0), (3, 'Cupom 10% off', 5.0),
      (4, 'Caderno_A5', 22.5), (5, 'Boné', 60.0);
    """)
    return conn

def _rejeita_ordem(conn, ordenar_por):
    try:
        obtido = buscar_produtos(conn, "ca", ordenar_por)
    except ValueError:
        return
    except Exception as e:
        raise AssertionError(f"ordenar_por={ordenar_por!r}: deveria lançar ValueError, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"ordenar_por={ordenar_por!r} foi ACEITO (resultado {obtido!r}), mas deveria lançar ValueError")
`;

  const AUX_PATH = `from pathlib import Path as _Path

BASE = "srv/uploads"
RAIZ = _Path(BASE).resolve()

def _rejeita(nome, motivo, base=BASE):
    try:
        obtido = caminho_seguro(base, nome)
    except ValueError:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar ValueError, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: {nome!r} foi ACEITO (→ {obtido}), mas deveria lançar ValueError")
`;

  Game.registerModule('security', {
    id: 'injecao',
    title: 'Injeção: SQL, comandos e path traversal',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'ataques',
    summary: 'Quando dado vira código: SQL injection com sqlite3 (e por que escapar aspas na mão não basta), command injection com e sem shell, e path traversal — com consertos testados contra payloads clássicos.',
    concepts: ['SQL injection', 'Consulta parametrizada', 'Command injection', 'Path traversal', 'Allowlist de identificadores'],
    takeaways: [
      'Injeção acontece quando **dado e código dividem o mesmo canal**: a entrada é colada num texto que um interpretador (SQL, shell, sistema de arquivos) vai analisar.',
      'Contra SQL injection, **consulta parametrizada** (`?`): o SQL é compilado antes e o valor entra como dado. Escapar aspas na mão falha em números, identificadores, `LIKE`, dialetos e esquecimentos.',
      'O que não pode ser parâmetro — nomes de coluna, `ORDER BY`, `ASC/DESC` — passa por **allowlist**, de preferência mapeando para trechos SQL fixos.',
      'Comandos do SO: **lista de argumentos, sem `shell=True`**; valide o valor (de preferência com um parser) e use `--` contra *argument injection*. Melhor ainda: use uma biblioteca em vez de um processo externo.',
      'Caminhos: **canonicalize** com `Path.resolve()` e só então confira com `is_relative_to(base)` — nada de `replace("../", "")` nem `startswith` em string.',
    ],
    glossary: [
      { term: 'SQL injection', aliases: ['SQLi', 'injeção de SQL', 'injecao de SQL', 'injeção SQL', 'injecao SQL'], definition: 'Falha em que a entrada do usuário é concatenada numa consulta e passa a ser **interpretada como SQL**: `\' OR \'1\'=\'1` vira condição, `UNION SELECT` vira exfiltração. A defesa é a consulta parametrizada.' },
      { term: 'Consulta parametrizada', aliases: ['consultas parametrizadas', 'query parametrizada', 'prepared statement', 'prepared statements', 'bind parameters', 'placeholder', 'placeholders'], definition: 'Consulta com marcadores (`?`, `:nome`) no lugar dos valores, que o driver envia **separados** do SQL. O banco compila o comando antes e trata cada valor só como dado — ele nunca é analisado como código.' },
      { term: 'Command injection', aliases: ['injeção de comandos', 'injecao de comandos', 'OS command injection', 'shell injection'], definition: 'Injeção em comandos do sistema operacional: com `shell=True` (ou `os.system`), metacaracteres como `;`, `|`, `$( )` e crases na entrada fazem o shell executar comandos extras. Defesa: lista de argumentos, sem shell.' },
      { term: 'Argument injection', aliases: ['injeção de argumentos', 'injecao de argumentos', 'option injection'], definition: 'Variante sem shell: um valor que começa com `-` vira **opção** do programa chamado (ex.: `--checkpoint-action=exec=...` no `tar`). Defesa: validar o valor e usar `--` para encerrar as opções.' },
      { term: 'Path traversal', aliases: ['directory traversal', 'travessia de diretório', 'travessia de diretorio', 'dot-dot-slash', 'Zip Slip'], definition: 'Uso de `../`, caminhos absolutos ou links simbólicos num nome de arquivo para sair da pasta permitida e ler ou gravar arquivos arbitrários. Defesa: canonicalizar (`resolve()`) e conferir que o resultado está dentro da base.' },
      { term: 'Injeção de segunda ordem', aliases: ['second-order injection', 'second-order SQL injection', 'injecao de segunda ordem', 'SQL injection de segunda ordem'], definition: 'O payload é **gravado** com segurança e só explode depois, quando o valor já armazenado é reutilizado numa consulta montada por concatenação. Engana quem só protege "a entrada do usuário".' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **injeção** — a família de ataques mais antiga e mais teimosa da web.',
          'A ideia cabe numa frase: **dado vira código** quando você cola a entrada do usuário num texto que outro programa vai interpretar.',
        ],
        board: {
          title: 'Injeção: quando dado e código dividem o canal',
          md: `| Interpretador | Onde o dado vira código | Nome |
|---|---|---|
| Banco de dados | \`f"... WHERE email = '{email}'"\` | **SQL injection** |
| Shell do SO | \`subprocess.run(f"ping {host}", shell=True)\` | **command injection** |
| Sistema de arquivos | \`open(BASE + "/" + nome)\` com \`../\` | **path traversal** |
| Navegador (HTML/JS) | \`f"<p>{comentario}</p>"\` | XSS (próximo módulo) |
| Arquivo de log | um \`\\n\` num campo forja uma linha de log | *log injection* |
| Motor de templates | \`Template(texto_do_usuario)\` | SSTI |

O padrão é sempre o mesmo: um **texto** mistura instruções (escritas por você) com dados (vindos de fora), e o interpretador não tem como saber onde termina um e começa o outro. A correção também segue um padrão: **manter os canais separados** — parâmetros no SQL, lista de argumentos no processo, caminho canonicalizado e conferido no arquivo.

> [!sabia] A primeira descrição pública de SQL injection saiu na revista hacker **Phrack**, edição 54, no Natal de **1998**: Jeff Forristal (o *rain.forest.puppy*) mostrou como anexar comandos a consultas de um servidor Microsoft. Mais de 25 anos depois, injeção continua no OWASP Top 10.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Vamos ver o ataque de perto — só o suficiente para entender o conserto.',
          'Uma busca de usuário por e-mail, montada com f-string. Parece inofensiva, né?',
        ],
        board: {
          title: 'SQL injection na prática (sqlite3)',
          md: `\`\`\`python
import sqlite3

conn = sqlite3.connect(":memory:")
conn.executescript("""
CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, email TEXT, senha_hash TEXT);
INSERT INTO usuarios VALUES (1, 'Ana', 'ana@ex.com', 'h1'), (2, 'Bruno', 'bruno@ex.com', 'h2');
""")

def buscar(email):                                   # ❌ VULNERÁVEL
    sql = f"SELECT id, nome FROM usuarios WHERE email = '{email}'"
    return conn.execute(sql).fetchall()

buscar("ana@ex.com")      # [(1, 'Ana')]
buscar("' OR '1'='1")     # [(1, 'Ana'), (2, 'Bruno')]   ← todos!
\`\`\`

| Entrada | O banco recebe | Efeito |
|---|---|---|
| \`' OR '1'='1\` | \`WHERE email = '' OR '1'='1'\` | condição sempre verdadeira: todas as linhas |
| \`ana@ex.com' --\` | \`WHERE email = 'ana@ex.com' --'\` | o resto vira comentário (adeus, \`AND senha = ...\`) |
| \`x' UNION SELECT id, senha_hash FROM usuarios --\` | uma segunda consulta "colada" | a resposta traz os hashes de senha |
| \`'; DROP TABLE usuarios; --\` | dois comandos | o \`execute\` do \`sqlite3\` recusa (*"one statement at a time"*) — mas \`executescript\` e outros drivers aceitam |

E quando a página não mostra o resultado? O atacante faz perguntas de sim/não (*blind SQL injection*): "a primeira letra do hash é \`a\`?" — e observa se a página muda, ou quanto tempo ela demora.

> [!atencao] Repare no bônus: com f-string, um e-mail **legítimo** como \`joana.d'arc@ex.com\` também quebra a consulta. SQL injection não é só falha de segurança — é bug de correção esperando para acontecer.`,
        },
      },
      {
        type: 'say',
        text: [
          'O conserto é simples e definitivo: **consulta parametrizada**.',
          'O SQL vai com um `?` no lugar do valor, e o valor vai **separado**. O banco nunca analisa a entrada como código.',
        ],
        board: {
          title: 'Consulta parametrizada — e o que não pode ser parâmetro',
          md: `\`\`\`python
def buscar(email):                                   # ✅ parametrizada
    return conn.execute(
        "SELECT id, nome FROM usuarios WHERE email = ?", (email,)   # tupla de 1 elemento!
    ).fetchall()

buscar("' OR '1'='1")     # []  — procurou alguém cujo e-mail é literalmente "' OR '1'='1"

# estilo nomeado
conn.execute("SELECT * FROM pedidos WHERE cliente_id = :cid AND status = :st",
             {"cid": 42, "st": "pago"})

# listas no IN: gere só os MARCADORES, nunca os valores
ids = [3, 7, 9]
marcas = ", ".join("?" * len(ids))                   # "?, ?, ?"
conn.execute(f"SELECT * FROM produtos WHERE id IN ({marcas})", ids)
\`\`\`

\`\`\`text
 concatenação:  "... WHERE email = '" + entrada + "'" ──▶ parser ──▶ a entrada pode virar código
 parametrizada: "... WHERE email = ?"                   ──▶ parser ──▶ comando compilado
                                     entrada ──────────────────────▶ encaixada só como VALOR
\`\`\`

Parâmetros substituem **valores**. Não substituem **nomes**: tabela, coluna, \`ORDER BY\`, \`ASC\`/\`DESC\`. Para esses, **allowlist** — de preferência mapeando a escolha do usuário para um trecho SQL fixo:

\`\`\`python
ORDENACOES = {"nome": "nome", "preco": "preco", "recentes": "criado_em DESC"}

def listar(conn, ordenar_por):
    if ordenar_por not in ORDENACOES:
        raise ValueError(f"ordenação inválida: {ordenar_por!r}")
    sql = "SELECT nome FROM produtos ORDER BY " + ORDENACOES[ordenar_por]
    return conn.execute(sql).fetchall()
\`\`\`

> [!dica] No \`LIKE\`, o parâmetro impede a injeção, mas \`%\` e \`_\` continuam sendo **curingas**: buscar \`"%"\` devolve tudo (e numa tabela grande, é uma consulta cara de graça). Se forem para ser literais, escape-os e declare o caractere de escape: \`nome LIKE ? ESCAPE '!'\`.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          '"Mas eu escapo as aspas: troco `\'` por `\'\'`!" — ouço isso toda semana.',
          'Escapar na mão é tentar adivinhar como o parser vai ler o texto. E ele tem mais contextos do que você lembra.',
        ],
        board: {
          title: 'Por que escapar na mão falha',
          md: `| Contexto | Exemplo | Por que o escape de aspas não salva |
|---|---|---|
| Número sem aspas | \`WHERE id = {pedido_id}\` | \`0 OR 1=1\` não tem aspa nenhuma para escapar |
| Identificador | \`ORDER BY {coluna}\` | não há aspas simples ali; \`(SELECT ...)\` entra direto |
| \`LIKE\` | \`LIKE '%{termo}%'\` | \`%\` e \`_\` não são aspas — o escape nem olha para eles |
| Dialeto | MySQL também usa \`\\\` como escape | \`\\'\` vira \`\\''\`: a barra "come" uma aspa e a outra fecha a string |
| Codificação | conexões em GBK e similares | um byte multibyte "engole" a barra do escape (o *bypass* clássico do \`addslashes\`) |
| Esquecimento | 1 consulta entre 200 | basta uma |

**E o ORM?** Ele parametriza nas APIs normais (\`filter(email=email)\`), mas as saídas de emergência — \`raw()\`, \`extra()\`, \`text()\`, SQL montado com f-string — voltam ao mundo da concatenação. E APIs que recebem **nomes** também sangram: em 2022 o próprio Django corrigiu SQL injections em aliases passados ao \`annotate()\` e no parâmetro \`kind\` do \`Trunc\`.

> [!sabia] Existe a **injeção de segunda ordem**: o payload entra com segurança (INSERT parametrizado) e explode **depois**. Exemplo clássico: alguém se cadastra como \`admin'--\`; meses depois, a rotina "trocar senha" monta \`UPDATE usuarios SET senha = ... WHERE nome = '{usuario_logado}'\` — e troca a senha do **admin**. Moral: dado que veio do seu próprio banco também é dado não confiável. Parametrize **tudo**, sempre.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o shell. Chamar um programa externo com `shell=True` é entregar a entrada do usuário para um interpretador **muito** poderoso.',
          'Aqui só vamos ler — nada de `subprocess` nos exercícios, combinado?',
        ],
        board: {
          title: 'Command injection: shell=True × lista de argumentos',
          md: `\`\`\`python
import subprocess, shlex

host = "8.8.8.8; cat /etc/passwd"          # veio de um formulário "testar conectividade"

# ❌ o shell interpreta ; | & $( ) \` > < e quebras de linha
subprocess.run(f"ping -c 1 {host}", shell=True)
#    o shell roda:  ping -c 1 8.8.8.8   e depois   cat /etc/passwd

# ✅ lista de argumentos, sem shell: host chega ao ping como UM argumento literal
subprocess.run(["ping", "-c", "1", host])  # o ping recebe "8.8.8.8; cat /etc/passwd" e falha

# ✅✅ e valide com um parser antes: só IP de verdade passa
import ipaddress
subprocess.run(["ping", "-c", "1", str(ipaddress.ip_address(host))])   # ValueError aqui

# ⚠️ se o shell for inevitável (pipes, globs), cite cada pedaço
comando = f"ping -c 1 {shlex.quote(host)}"   # ping -c 1 '8.8.8.8; cat /etc/passwd'
\`\`\`

| Abordagem | Veredito |
|---|---|
| \`os.system(...)\`, \`os.popen(...)\`, \`shell=True\` com f-string | ❌ sempre passam pelo shell |
| Remover \`;\`, \`&\` e o *pipe* da entrada | ❌ denylist: sobram \`$( )\`, crases, \`\\n\`… |
| \`shlex.quote\` + \`shell=True\` | ⚠️ funciona no \`sh\` POSIX, não no \`cmd.exe\`; não impede *argument injection* |
| Lista de argumentos, sem shell | ✅ o padrão |
| Nem chamar processo: \`shutil\`, \`pathlib\`, \`zipfile\`, bibliotecas | ✅✅ zero superfície de shell |

> [!sabia] Sem shell ainda existe a **argument injection**: um valor que começa com \`-\` vira **opção** do programa. No \`tar\`, um "nome de arquivo" \`--checkpoint-action=exec=sh x.sh\` executa um script; e a **CVE-2017-1000117** do Git usava uma URL \`ssh://-oProxyCommand=...\`, que o \`ssh\` lia como opção. Defesas: validar o valor (um IP não começa com \`-\`) e usar \`--\`, que diz ao programa "daqui em diante, só argumentos": \`["rm", "--", nome]\`.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Por último, o **path traversal**: o usuário escolhe um nome de arquivo e sai passeando pelo seu disco com `../`.',
          'A defesa tem uma ordem que importa: primeiro **canonicalizar**, depois **conferir**.',
        ],
        board: {
          title: 'Path traversal: resolve() + is_relative_to()',
          md: `\`\`\`python
import os
from pathlib import Path

BASE = Path("/srv/app/anexos")

def baixar(nome):                             # ❌ VULNERÁVEL
    return open(os.path.join(BASE, nome), "rb").read()

baixar("../../../etc/passwd")   # /srv/app/anexos/../../../etc/passwd → /etc/passwd
baixar("/etc/passwd")           # os.path.join DESCARTA a base quando o 2º é absoluto!

def caminho(nome):                            # ✅ canonicalize, depois confira
    raiz = BASE.resolve()
    destino = (raiz / nome).resolve()         # tira "." e "..", segue symlinks
    if not destino.is_relative_to(raiz):
        raise ValueError(f"fora da pasta permitida: {nome!r}")
    return destino
\`\`\`

| Tentativa ingênua | Por que falha |
|---|---|
| \`if ".." in nome: rejeita\` | barra \`notas..v2.txt\` (legítimo) e deixa passar \`/etc/passwd\` |
| \`nome.replace("../", "")\` | \`....//\` vira \`../\` **depois** do replace |
| \`str(destino).startswith(str(raiz))\` | \`/srv/app/anexos_privados\` começa com \`/srv/app/anexos\` |
| \`os.path.normpath\` / \`abspath\` | resolvem \`..\` só no texto — não seguem symlinks |
| decodificar a URL de novo depois de validar | \`%252e%252e%252f\` → \`%2e%2e%2f\` → \`../\` |
| esquecer o Windows | lá \`..\\\` também sobe de pasta, e \`C:\\\` e \`\\\\servidor\\pasta\` são absolutos |

\`\`\`python
from urllib.parse import unquote
unquote("..%2F..%2Fetc%2Fpasswd")     # '../../etc/passwd' — decodifique UMA vez, e só então valide
unquote(unquote("%252e%252e%252f"))   # '../' — a segunda decodificação reabre a porta
\`\`\`

> [!dica] Melhor ainda é **não usar o nome do usuário** como caminho: guarde o arquivo com um id aleatório (\`secrets.token_hex(16)\`) e mantenha o nome original só como metadado no banco.

> [!sabia] Arquivos compactados também atacam: um \`.zip\` ou \`.tar\` com uma entrada chamada \`../../app/config.py\` sobrescreve arquivos ao ser extraído — o **Zip Slip** (Snyk, 2018). No Python, o \`tarfile\` ficou vulnerável por anos (**CVE-2007-4559**); a correção veio no 3.12 com os filtros de extração — \`tar.extractall(destino, filter="data")\` barra \`../\`, caminhos absolutos e links perigosos —, e o \`"data"\` virou o padrão no 3.14.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo consertar uma busca vulnerável e blindar um download contra path traversal.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-inj-q1',
        concept: 'Escape manual × parâmetros',
        say: 'Começando com uma "correção" que eu já vi em produção.',
        prompt: `O dev "corrigiu" a SQL injection escapando as aspas. Um atacante envia \`pedido_id = "0 OR 1=1"\`. O que acontece?

\`\`\`python
def buscar_pedido(conn, pedido_id):        # pedido_id vem da query string, como texto
    pedido_id = pedido_id.replace("'", "''")
    return conn.execute(f"SELECT * FROM pedidos WHERE id = {pedido_id}").fetchall()
\`\`\``,
        options: [
          { text: 'Devolve **todos** os pedidos: no contexto numérico não há aspas, e o payload não precisa de nenhuma. A correção é `WHERE id = ?` com o valor como parâmetro (e, de quebra, `int(pedido_id)`).', correct: true, why: 'Exato. O escape protege um contexto específico (dentro de aspas simples). Aqui o valor é colado **fora** de aspas, então `OR 1=1` vira SQL diretamente.' },
          { text: 'Nada: o `replace` neutraliza a injeção.', why: 'O `replace` só mexe em aspas — e o payload `0 OR 1=1` não tem nenhuma. O SQL final é `WHERE id = 0 OR 1=1`, sempre verdadeiro.' },
          { text: 'O `sqlite3` lança erro, porque só aceita um comando por `execute`.', why: 'Essa proteção vale contra `; DROP TABLE ...` (dois comandos). `WHERE id = 0 OR 1=1` é **um** comando só, perfeitamente válido.' },
          { text: 'Devolve só o pedido 0, porque o SQLite converte o texto para número.', why: 'Não há conversão de tipo aqui: o texto foi colado **dentro do SQL** antes de o banco vê-lo, então ele é analisado como código, não como um valor.' },
        ],
        explanation: 'Escapar exige saber **em que contexto** o dado vai cair — string entre aspas, número, identificador, padrão de `LIKE` — e **qual dialeto** vai ler (MySQL trata `\\` como escape; o SQLite, não). Basta errar um contexto ou esquecer uma consulta. A consulta parametrizada elimina a pergunta: o SQL é compilado antes e o valor nunca é analisado. Converter para `int` é uma ótima camada extra (defesa em profundidade), mas não substitui o parâmetro.',
      },
      {
        type: 'code',
        id: 'sec-inj-q2',
        concept: 'Consulta parametrizada',
        title: 'Conserte a busca da loja',
        say: 'Agora é com você: esta busca foi escrita com f-strings e o pentest achou injeção. Os testes incluem os payloads clássicos!',
        prompt: `Reescreva as duas funções sem SQL injection. \`conn\` é uma conexão \`sqlite3\` já aberta, com as tabelas \`usuarios(id, nome, email, senha_hash)\` e \`produtos(id, nome, preco)\`.

- \`buscar_usuario(conn, email)\`: lista de tuplas \`(id, nome)\` dos usuários cujo e-mail é **exatamente** \`email\`. E-mails com apóstrofo (\`joana.d'arc@ex.com\`) são legítimos e precisam funcionar.
- \`buscar_produtos(conn, termo, ordenar_por="nome")\`: lista com os **nomes** dos produtos cujo nome **contém** \`termo\`, sem diferenciar maiúsculas de minúsculas (ASCII), ordenada pela coluna \`ordenar_por\`.
  - \`ordenar_por\` só pode ser \`"nome"\` ou \`"preco"\` (ordem crescente); qualquer outra coisa → \`ValueError\`.
  - Em \`termo\`, \`%\` e \`_\` são caracteres **literais**, não curingas: buscar \`"%"\` encontra só nomes que contêm \`%\`.

O código atual funciona nos casos normais — o problema está nos outros.`,
        starter: `import sqlite3


def buscar_usuario(conn, email):
    sql = f"SELECT id, nome FROM usuarios WHERE email = '{email}'"
    return conn.execute(sql).fetchall()


def buscar_produtos(conn, termo, ordenar_por="nome"):
    sql = f"SELECT nome FROM produtos WHERE nome LIKE '%{termo}%' ORDER BY {ordenar_por}"
    return [linha[0] for linha in conn.execute(sql).fetchall()]
`,
        tests: [
          {
            name: 'buscar_usuario: e-mail existente e inexistente',
            code: AUX_SQL + `
conn = _db()
obtido = buscar_usuario(conn, "ana@ex.com")
assert obtido == [(1, "Ana")], f"buscar_usuario(conn, 'ana@ex.com'): esperado [(1, 'Ana')], veio {obtido!r}"
obtido = buscar_usuario(conn, "ninguem@ex.com")
assert obtido == [], f"e-mail inexistente deveria devolver [], veio {obtido!r}"`,
          },
          {
            name: "buscar_usuario: e-mail legítimo com apóstrofo (joana.d'arc@ex.com)",
            code: AUX_SQL + `
conn = _db()
obtido = buscar_usuario(conn, "joana.d'arc@ex.com")
assert obtido == [(3, "Joana D'Arc")], f"esperado [(3, \\"Joana D'Arc\\")], veio {obtido!r}"`,
          },
          {
            name: "buscar_usuario: o payload ' OR '1'='1 não devolve ninguém",
            code: AUX_SQL + `
conn = _db()
obtido = buscar_usuario(conn, "' OR '1'='1")
assert obtido == [], f"a injeção ' OR '1'='1 devolveu {obtido!r} — deveria ser [] (ninguém tem esse e-mail)"`,
          },
          {
            name: 'buscar_produtos: trecho do nome, sem diferenciar maiúsculas',
            code: AUX_SQL + `
conn = _db()
for termo in ["ca", "CA", "Ca"]:
    obtido = buscar_produtos(conn, termo)
    assert obtido == ["Caderno_A5", "Camiseta", "Caneca"], f"buscar_produtos(conn, {termo!r}): veio {obtido!r}"
obtido = buscar_produtos(conn, "xyz")
assert obtido == [], f"termo sem resultado deveria devolver [], veio {obtido!r}"`,
          },
          {
            name: 'buscar_produtos: ordenar por preço',
            code: AUX_SQL + `
conn = _db()
obtido = buscar_produtos(conn, "ca", "preco")
assert obtido == ["Caderno_A5", "Caneca", "Camiseta"], f"'ca' por preço: veio {obtido!r}"
obtido = buscar_produtos(conn, "", "preco")
assert obtido == ["Cupom 10% off", "Caderno_A5", "Caneca", "Boné", "Camiseta"], f"termo vazio por preço: veio {obtido!r}"`,
          },
          {
            name: 'ordenar_por fora da allowlist → ValueError (e a tabela sobrevive)',
            code: AUX_SQL + `
conn = _db()
for valor in ["preco DESC", "nome; DROP TABLE produtos", "(SELECT senha_hash FROM usuarios)", "1", "id", ""]:
    _rejeita_ordem(conn, valor)
total = conn.execute("SELECT COUNT(*) FROM produtos").fetchone()[0]
assert total == 5, f"a tabela produtos deveria continuar com 5 linhas, tem {total}"`,
          },
          {
            name: '% e _ no termo são literais, não curingas',
            code: AUX_SQL + `
conn = _db()
obtido = buscar_produtos(conn, "%")
assert obtido == ["Cupom 10% off"], f"buscar '%' deveria achar só nomes com '%' literal, veio {obtido!r}"
obtido = buscar_produtos(conn, "_")
assert obtido == ["Caderno_A5"], f"buscar '_' deveria achar só nomes com '_' literal, veio {obtido!r}"
obtido = buscar_produtos(conn, "e_a")
assert obtido == [], f"'e_a' não aparece literalmente em nenhum nome (o _ não é curinga!), veio {obtido!r}"`,
          },
          {
            name: 'buscar_usuario: UNION e comentário (--) não funcionam',
            hidden: true,
            code: AUX_SQL + `
conn = _db()
obtido = buscar_usuario(conn, "x' UNION SELECT id, senha_hash FROM usuarios --")
assert obtido == [], f"a injeção com UNION vazou {obtido!r}"
obtido = buscar_usuario(conn, "ana@ex.com' --")
assert obtido == [], f"'ana@ex.com' --' não é o e-mail de ninguém, veio {obtido!r}"`,
          },
          {
            name: 'buscar_produtos: injeção pelo termo não funciona',
            hidden: true,
            code: AUX_SQL + `
conn = _db()
for termo in ["' OR '1'='1", "%' OR 1=1 --", "' UNION SELECT senha_hash FROM usuarios --"]:
    obtido = buscar_produtos(conn, termo)
    assert obtido == [], f"buscar_produtos(conn, {termo!r}) deveria devolver [], veio {obtido!r}"`,
          },
          {
            name: 'outro catálogo (mais produtos, acentos e %)',
            hidden: true,
            code: AUX_SQL + `
conn = _db()
conn.executemany("INSERT INTO produtos (nome, preco) VALUES (?, ?)",
                 [("Café 100%", 42.0), ("Xícara", 30.0), ("Bloco", 12.0)])
obtido = buscar_produtos(conn, "ca", "preco")
assert obtido == ["Caderno_A5", "Xícara", "Caneca", "Café 100%", "Camiseta"], f"'ca' por preço: veio {obtido!r}"
obtido = buscar_produtos(conn, "100%")
assert obtido == ["Café 100%"], f"'100%': veio {obtido!r}"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /\.replace\(\s*("'"|'\\'')/.test(code),
            text: 'Você está escapando aspas na mão (`replace("\'", "\'\'")`). Com parâmetros isso é desnecessário — e, sozinho, é frágil: não protege números sem aspas, identificadores, `LIKE` nem outros dialetos. Deixe o driver separar dado de código.',
            concept: 'Escape manual × parâmetros',
          },
          {
            when: (m, code) => /executescript/.test(code),
            text: '`executescript` roda **vários** comandos de uma vez e não aceita parâmetros — é exatamente o que um `; DROP TABLE` quer. Para consultas com dados do usuário, use `execute` com `?`.',
            concept: 'Consulta parametrizada',
          },
          {
            when: (m, code) => /execute\s*\(\s*f["']/.test(code) || /\.format\s*\(/.test(code),
            text: 'Você ainda monta SQL com interpolação (f-string ou `.format`) dentro do `execute`. Se o que entra é um identificador que já passou pela allowlist, está seguro — mas prefira mapear a escolha para trechos SQL **fixos** (`{"nome": "nome", "preco": "preco"}`): assim um refactor não consegue remover a checagem e deixar o valor do usuário ir direto para o SQL.',
            concept: 'Allowlist de identificadores',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Engolir erros do banco esconde tanto bugs quanto **tentativas de ataque** — e mensagens de erro de SQL são justamente o que o atacante usa para calibrar o payload. Deixe o erro subir (e logue) ou trate só o tipo esperado.',
            concept: 'Tratamento de exceções',
          },
        ],
        hints: [
          '**buscar_usuario:** troque a f-string por um marcador: `conn.execute("SELECT id, nome FROM usuarios WHERE email = ?", (email,))`. Repare na vírgula: `(email,)` é uma tupla de 1 elemento.',
          '**ordenar_por:** coluna não pode ser parâmetro. Crie uma allowlist — `ORDENACOES = {"nome": "nome", "preco": "preco"}` —, lance `ValueError` se a chave não existir e concatene só o valor **do dicionário**.',
          '**LIKE literal:** escolha um caractere de escape (ex.: `!`), escape-o primeiro e depois `%` e `_`: `termo.replace("!", "!!").replace("%", "!%").replace("_", "!_")`. Use `nome LIKE ? ESCAPE \'!\'` com o parâmetro `"%" + termo_escapado + "%"`.',
        ],
        solution: `import sqlite3

ORDENACOES = {"nome": "nome", "preco": "preco"}      # escolha do usuário → trecho SQL fixo


def buscar_usuario(conn, email):
    return conn.execute(
        "SELECT id, nome FROM usuarios WHERE email = ?", (email,)
    ).fetchall()


def _escapar_like(texto):
    # o próprio caractere de escape primeiro; depois os curingas
    return texto.replace("!", "!!").replace("%", "!%").replace("_", "!_")


def buscar_produtos(conn, termo, ordenar_por="nome"):
    if ordenar_por not in ORDENACOES:
        raise ValueError(f"ordenação não permitida: {ordenar_por!r}")
    sql = ("SELECT nome FROM produtos WHERE nome LIKE ? ESCAPE '!' "
           "ORDER BY " + ORDENACOES[ordenar_por])
    padrao = "%" + _escapar_like(termo) + "%"
    return [nome for (nome,) in conn.execute(sql, (padrao,))]
`,
        solutionExplanation: 'Três contextos, três ferramentas. **Valores** (`email`, `termo`) vão como parâmetros `?` — o SQL é compilado antes e a entrada nunca é analisada, por isso `\' OR \'1\'=\'1` vira só um texto procurado (e `joana.d\'arc` volta a funcionar). **Identificadores** (`ORDER BY`) não podem ser parâmetros, então passam por uma allowlist que mapeia para trechos SQL fixos: `"1"`, `"id"`, `"preco DESC"` e subconsultas são recusados com `ValueError`. E os **curingas do `LIKE`** continuam ativos mesmo com parâmetros, então são escapados com um caractere declarado em `ESCAPE` — que precisa ser escapado primeiro, senão um `!` no termo vira escape de outra coisa.',
      },
      {
        type: 'match',
        id: 'sec-inj-q3',
        concept: 'Defesas contra injeção',
        say: 'Cada entrada maliciosa tem sua defesa certeira. Associe!',
        prompt: 'Associe cada **ataque** à **defesa** que o neutraliza.',
        pairs: [
          { left: "`email = \"' OR '1'='1\"` numa consulta", right: 'Consulta parametrizada (`?`)' },
          { left: '`?ordem=(SELECT senha_hash ...)` no `ORDER BY`', right: 'Allowlist de colunas' },
          { left: '`termo = "%"` num `LIKE ?` devolve a tabela toda', right: '`ESCAPE` para `%` e `_`' },
          { left: '`host = "8.8.8.8; rm -rf ~"` com `shell=True`', right: 'Lista de argumentos, sem shell' },
          { left: 'Um "nome de arquivo" `--checkpoint-action=...` no `tar`', right: '`--` para encerrar as opções' },
          { left: '`nome = "../../etc/passwd"` no download', right: '`resolve()` + `is_relative_to(base)`' },
        ],
        explanation: 'O fio condutor é **separar dado de código** em cada interpretador: o parâmetro separa valor de SQL; a allowlist troca um nome livre por um conjunto fechado; o `ESCAPE` tira o poder dos curingas; a lista de argumentos tira o shell do caminho; o `--` separa opções de argumentos; e o `resolve()` + `is_relative_to` transforma um caminho "texto" num caminho real e conferido. Nenhuma dessas defesas depende de adivinhar qual payload o atacante vai usar — por isso funcionam.',
      },
      {
        type: 'code',
        id: 'sec-inj-q4',
        concept: 'Path traversal',
        title: 'Download sem path traversal',
        say: 'Agora blinde um download de anexos. O atacante vai tentar `../`, caminho absoluto e uma pegadinha com o nome da pasta vizinha.',
        prompt: `Os usuários baixam anexos por nome: \`GET /anexos?nome=fotos/gato.png\`. Implemente \`caminho_seguro(base, nome)\`:

- \`base\` (\`str\` ou \`Path\`) é a pasta permitida; \`nome\` é o caminho relativo **vindo do usuário** (já decodificado da URL).
- Devolva o \`Path\` **absoluto e canonicalizado** do arquivo (\`resolve()\`), que precisa ficar **dentro** de \`base\` — a própria \`base\` não conta como arquivo.
- Caso contrário, lance \`ValueError\`. Também lance \`ValueError\` se \`nome\` for vazio ou tiver um byte nulo (\`"\\x00"\`).
- O arquivo não precisa existir, e \`..\` que **não sai** da base é permitido: \`fotos/../gato.png\` é \`base/gato.png\`.`,
        starter: `from pathlib import Path


def caminho_seguro(base, nome):
    # TODO: canonicalize e confira que o resultado continua dentro da base
    return Path(base) / nome
`,
        tests: [
          {
            name: 'nome normal devolve o caminho absoluto dentro da base',
            code: AUX_PATH + `
obtido = caminho_seguro(BASE, "fotos/gato.png")
assert isinstance(obtido, _Path), f"devolva um Path, veio {type(obtido).__name__}"
assert obtido == RAIZ / "fotos" / "gato.png", f"esperado {RAIZ / 'fotos' / 'gato.png'}, veio {obtido}"
obtido = caminho_seguro(_Path(BASE), "relatorio.pdf")
assert obtido == RAIZ / "relatorio.pdf", f"base como Path: esperado {RAIZ / 'relatorio.pdf'}, veio {obtido}"`,
          },
          {
            name: '".." que não sai da base é permitido (e "notas..v2.txt" é um nome legítimo)',
            code: AUX_PATH + `
obtido = caminho_seguro(BASE, "fotos/../gato.png")
assert obtido == RAIZ / "gato.png", f"'fotos/../gato.png' é base/gato.png (canonicalizado), veio {obtido}"
obtido = caminho_seguro(BASE, "notas..v2.txt")
assert obtido == RAIZ / "notas..v2.txt", f"'notas..v2.txt' é um nome legítimo, veio {obtido}"`,
          },
          {
            name: '../../etc/passwd → ValueError',
            code: AUX_PATH + `
_rejeita("../../etc/passwd", "subir de pasta com ../")
_rejeita("../segredo.txt", "um nível acima da base")`,
          },
          {
            name: 'caminho absoluto (/etc/passwd) → ValueError',
            code: AUX_PATH + `
_rejeita("/etc/passwd", "caminho absoluto (a junção com a base o descarta!)")`,
          },
          {
            name: 'pasta vizinha com o mesmo prefixo → ValueError',
            hidden: true,
            code: AUX_PATH + `
_rejeita("../uploads_privado/chave.pem", "pasta vizinha 'uploads_privado' (startswith em string cai nessa)")`,
          },
          {
            name: '../ escondido no meio do caminho → ValueError',
            hidden: true,
            code: AUX_PATH + `
_rejeita("fotos/../../segredo.txt", "'fotos/../../' sai da base")
_rejeita("fotos/./../../../etc/passwd", "'./' e '../' misturados")`,
          },
          {
            name: 'vazio, "." e "fotos/.." (a própria base) → ValueError',
            hidden: true,
            code: AUX_PATH + `
for nome in ["", ".", "fotos/.."]:
    _rejeita(nome, f"{nome!r} aponta para a própria base, não para um arquivo dentro dela")`,
          },
          {
            name: 'byte nulo no nome → ValueError',
            hidden: true,
            code: AUX_PATH + `
_rejeita("gato.png\\x00.txt", "nome com byte nulo")`,
          },
        ],
        reviews: [
          {
            when: (m, code) => /\.replace\(\s*["']\.\./.test(code),
            text: 'Remover `../` com `replace` é denylist: `....//` vira `../` **depois** da remoção, e caminhos absolutos nem têm `..`. Não "limpe" o nome — canonicalize com `resolve()` e confira o resultado.',
            concept: 'Rejeitar × sanitizar',
          },
          {
            when: (m, code) => /startswith/.test(code),
            text: 'Você usou `startswith`. Em string, `/srv/uploads_privado` começa com `/srv/uploads` — só funciona se você acrescentar o separador. `Path.is_relative_to(raiz)` compara **componentes** de caminho e deixa a intenção clara.',
            concept: 'Path traversal',
          },
          {
            when: (m, code) => /(abspath|normpath)/.test(code) && !/resolve|realpath/.test(code),
            text: '`os.path.normpath`/`abspath` resolvem `..` só **no texto**: não seguem links simbólicos. Um symlink dentro da base apontando para `/etc` passaria. `Path.resolve()` (ou `os.path.realpath`) consulta o sistema de arquivos.',
            concept: 'Canonicalização',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Numa checagem de segurança, um erro inesperado precisa **negar** — e ficar visível —, não virar um caminho aceito por acidente.',
            concept: 'Fail-safe defaults',
          },
        ],
        hints: [
          'Primeiro, canonicalize a base: `raiz = Path(base).resolve()`. Depois o destino: `destino = (raiz / nome).resolve()` — o `resolve()` elimina `.` e `..` (e segue symlinks).',
          'Confira com `destino.is_relative_to(raiz)` — ele compara componentes do caminho, então a pasta vizinha `uploads_privado` não engana. Lembre que um `nome` absoluto faz a junção descartar a base: o `is_relative_to` pega esse caso também.',
          'Faltam as bordas: rejeite `nome` vazio ou com `"\\x00"` logo no início, e rejeite `destino == raiz` (a própria pasta não é um arquivo).',
        ],
        solution: `from pathlib import Path


def caminho_seguro(base, nome):
    if not nome or "\\x00" in nome:
        raise ValueError("nome vazio ou com byte nulo")
    raiz = Path(base).resolve()
    destino = (raiz / nome).resolve()           # canonicaliza: ".", "..", symlinks
    if destino == raiz or not destino.is_relative_to(raiz):
        raise ValueError(f"caminho fora da pasta permitida: {nome!r}")
    return destino
`,
        solutionExplanation: 'A ordem é o segredo: **canonicalizar primeiro, conferir depois**. O `resolve()` transforma o texto num caminho real — sem `.`, sem `..`, com symlinks seguidos — e só então o `is_relative_to` pergunta se ele está dentro da base, comparando **componentes** (por isso `uploads_privado` não engana, ao contrário de um `startswith` em string). O mesmo teste cobre o caminho absoluto, que a junção `raiz / "/etc/passwd"` transformaria em `/etc/passwd`. O byte nulo é recusado explicitamente porque o comportamento varia entre sistemas, e `destino == raiz` barra `""`, `"."` e `"fotos/.."`. Em produção, some a isso: não usar o nome do usuário no disco (ids aleatórios) e, onde houver risco de corrida entre a checagem e a abertura, abrir sem seguir links.',
      },
      {
        type: 'mcq',
        id: 'sec-inj-q5',
        concept: 'Command injection',
        say: 'Agora uma de shell. Qual correção você aprovaria no code review?',
        prompt: 'Um endpoint de diagnóstico roda `subprocess.run(f"ping -c 1 {host}", shell=True)`, com `host` vindo do usuário. Um atacante envia `8.8.8.8; cat /etc/passwd`. Qual é a correção **mais robusta**?',
        options: [
          { text: 'Validar com `ip = ipaddress.ip_address(host)` e rodar `subprocess.run(["ping", "-c", "1", str(ip)])`, **sem shell**.', correct: true, why: 'Exato. Duas camadas: o parser só deixa passar um IP de verdade (nada de `;`, nada de `-` no início), e a lista de argumentos tira o shell do caminho — mesmo que algo escape da validação, não há interpretador para executá-lo.' },
          { text: 'Manter `shell=True` e remover `;`, `&` e `|` de `host` antes.', why: 'Denylist: sobram `$( )`, crases, `\\n`, redirecionamentos… O atacante só precisa de **um** metacaractere que você esqueceu.' },
          { text: 'Manter `shell=True` e usar `shlex.quote(host)`.', why: 'Neutraliza os metacaracteres no `sh` POSIX, mas mantém um shell desnecessário, não serve para o `cmd.exe` do Windows e não impede *argument injection*: um `host` que começa com `-` continua virando opção do `ping`.' },
          { text: 'Trocar por `os.system("ping -c 1 " + host)` dentro de um `try/except`.', why: '`os.system` **sempre** passa pelo shell — é o mesmo problema com outro nome. E o `try/except` não impede nada: o comando injetado já rodou.' },
        ],
        explanation: 'A defesa em camadas contra command injection: **1)** evite o processo externo quando houver biblioteca; **2)** se precisar dele, passe uma **lista de argumentos** sem shell; **3)** valide o valor com um **parser** (`ipaddress`, um regex de allowlist) — o que também barra *argument injection*; **4)** onde fizer sentido, use `--` para encerrar as opções. O `shlex.quote` é o remendo para quando o shell é inevitável (pipes, globs), não o padrão.',
      },
      {
        type: 'open',
        id: 'sec-inj-q6',
        concept: 'SQL injection e ORMs',
        say: 'Última: um papo de revisão de arquitetura. Me convença!',
        prompt: 'Um colega afirma: *"Usamos ORM, então estamos imunes a SQL injection."* Como você responderia? Em que situações o ORM **não** protege, e o que você faria a respeito?',
        minWords: 35,
        rubric: [
          { label: 'Reconhece que o ORM **parametriza** nas APIs normais (o caso comum é seguro)', keywords: ['parametriz', 'placeholder', 'bind', 'prepared', 'por padrao', 'na maioria', 'caso comum', 'filter('], concept: 'Consulta parametrizada', why: 'É verdade que `filter(email=email)` gera SQL com parâmetros — o erro é generalizar isso para **todo** acesso a dados.' },
          { label: 'Aponta as saídas de emergência: SQL cru (`raw`, `extra`, `text`) montado com concatenação/f-string', keywords: ['raw', 'text(', 'extra(', 'sql cru', 'sql puro', 'sql bruto', 'sql manual', 'f-string', 'fstring', 'concaten', 'interpol', '.format'], concept: 'SQL injection', why: 'Toda API de SQL cru volta ao mundo da concatenação: se alguém usa f-string ali, o ORM não tem como salvar.' },
          { label: 'Identificadores dinâmicos (`ORDER BY`, nomes de coluna) exigem **allowlist**', keywords: ['order by', 'ordenac', 'identificador', 'nome de coluna', 'nomes de coluna', 'coluna dinamica', 'colunas dinamicas', 'allowlist', 'lista de permit', 'whitelist'], concept: 'Allowlist de identificadores', why: 'Nomes não podem ser parâmetros; ORMs que aceitam nomes vindos do usuário (ordenação, aliases) já tiveram CVEs de injeção.' },
          { label: 'Defesa em profundidade: menor privilégio no banco, revisão/SAST, testes com payloads, segunda ordem', keywords: ['menor privilegio', 'least privilege', 'defesa em profundidade', 'camada', 'segunda ordem', 'second-order', 'second order', 'sast', 'semgrep', 'bandit', 'code review', 'revisao', 'teste', 'permiss'], concept: 'Defesa em profundidade', why: 'Mesmo com ORM, alguém vai escrever SQL cru um dia: limite o estrago (usuário do banco com o mínimo) e detecte cedo (análise estática, testes).' },
        ],
        modelAnswer: `O ORM ajuda muito, mas "imune" é forte demais. Nas APIs normais — \`filter(email=email)\`, \`where(Usuario.email == email)\` — ele gera SQL **parametrizado**, então o caso comum é seguro.

O risco está nas saídas de emergência: \`raw()\`, \`extra()\`, \`text()\` ou qualquer **SQL cru** montado com **f-string** ou concatenação volta a ser injetável. E há o que nem o ORM consegue parametrizar: **identificadores** — \`ORDER BY\` escolhido pelo usuário, nomes de coluna, aliases. Esses precisam de **allowlist**; o próprio Django já corrigiu CVEs de injeção por nomes passados ao \`annotate()\`.

O que eu faria: regra de lint/**SAST** (Bandit, Semgrep) proibindo f-string em SQL cru, **revisão** obrigatória de todo \`raw()\`, **testes** com payloads como \`' OR '1'='1\` nas buscas, atenção à injeção de **segunda ordem** (dado lido do banco também é parâmetro) e, como **defesa em profundidade**, um usuário de banco com **menor privilégio** — sem DDL e só com as tabelas de que a aplicação precisa.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou bem! Você acabou de fechar três das portas mais exploradas da história da web.',
          { text: 'Resumo: valor vai em parâmetro, nome passa por allowlist, processo roda sem shell, e caminho é canonicalizado antes de ser conferido. Dado nunca vira código!', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
