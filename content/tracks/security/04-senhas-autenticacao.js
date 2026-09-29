(function () {
  // Helpers Python dos testes: uma implementação de referência de HOTP, independente da do jogador,
  // para gerar os códigos esperados nos testes de verificar_totp.
  const AUX_TOTP = `import hashlib as _hashlib
import hmac as _hmac
import struct as _struct

SEMENTE = b"12345678901234567890"   # a semente SHA-1 dos vetores das RFCs 4226 e 6238

def _hotp(segredo, contador, digitos=6):
    mac = _hmac.new(segredo, _struct.pack(">Q", contador), _hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    return str((int.from_bytes(mac[o:o + 4], "big") & 0x7FFFFFFF) % 10 ** digitos).zfill(digitos)
`;

  const AUX_HASH = `import hashlib as _hashlib

def _armazenado(senha, salt, iteracoes):
    dk = _hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, iteracoes)
    return "$".join(["pbkdf2_sha256", str(iteracoes), salt.hex(), dk.hex()])
`;

  Game.registerModule('security', {
    id: 'senhas-autenticacao',
    title: 'Senhas, MFA e Sessões',
    kind: 'lesson',
    level: 3,
    order: 20,
    unit: 'identidade',
    summary: 'Por que SHA-256 não serve para senhas, salt e pepper, funções lentas de verdade, timing attacks, enumeração de usuários — e o TOTP por dentro, implementado e conferido com os vetores da RFC 6238.',
    concepts: ['Hash de senha (KDF)', 'Salt e pepper', 'Timing attack', 'TOTP e MFA', 'Sessões'],
    takeaways: [
      'Senha se guarda com **KDF lenta** (Argon2id, scrypt, bcrypt, PBKDF2) e **salt** único por usuário — nunca com SHA-256 puro, que é rápido demais e dá o mesmo hash para senhas iguais.',
      'O **pepper** é um segredo fora do banco: quem vazou só o banco não consegue nem começar a força bruta.',
      'Compare segredos com `hmac.compare_digest`, responda "e-mail ou senha inválidos" e gaste o **mesmo tempo** para usuário existente ou não — senão você entrega quem tem conta.',
      '**TOTP** é HMAC-SHA1 do contador `floor(agora / 30)`, truncado para 6 dígitos: aceite uma janela pequena, bloqueie replay e limite tentativas. Contra phishing, só **WebAuthn/passkeys**.',
      'Sessão no servidor revoga na hora; token autocontido escala sem consulta mas é difícil de revogar. Em ambos: regenerar o id no login e cookie `HttpOnly; Secure; SameSite`.',
    ],
    glossary: [
      { term: 'Salt', aliases: ['salts', 'sal'], definition: 'Valor aleatório **único por usuário**, guardado junto do hash, misturado à senha antes de derivar. Faz senhas iguais terem hashes diferentes e inutiliza tabelas pré-calculadas (*rainbow tables*). Não é segredo.' },
      { term: 'Pepper', aliases: ['peppers', 'pimenta'], definition: 'Segredo **global**, guardado **fora** do banco (KMS, HSM, cofre), aplicado a todas as senhas (ex.: HMAC antes da KDF). Se só o banco vazar, os hashes não podem ser atacados sem ele.' },
      { term: 'KDF', aliases: ['KDFs', 'key derivation function', 'função de derivação de chave', 'key stretching'], definition: '*Key Derivation Function*: função **deliberadamente lenta** (e às vezes *memory-hard*) para derivar hashes de senhas — Argon2id, scrypt, bcrypt, PBKDF2. O custo é ajustável e sobe com o hardware.' },
      { term: 'Timing attack', aliases: ['timing attacks', 'ataque de temporização', 'ataque de tempo'], definition: 'Ataque que deduz segredos pelo **tempo** de resposta: um `==` que para no primeiro byte diferente revela quantos bytes o atacante já acertou. Defesa: comparação em tempo constante (`hmac.compare_digest`).' },
      { term: 'TOTP', aliases: ['Time-based One-Time Password', 'HOTP', 'RFC 6238'], definition: '*Time-based One-Time Password* (RFC 6238): código de 6 dígitos = HMAC do contador `floor(agora / 30)` com um segredo compartilhado, truncado. É o HOTP (RFC 4226) com o contador trocado pelo relógio.' },
      { term: 'Credential stuffing', aliases: ['preenchimento de credenciais'], definition: 'Ataque que testa, em massa, pares e-mail/senha vazados de **outros** sites, apostando na reutilização de senhas. Defesas: MFA, checagem de senhas vazadas e limitação de tentativas.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Hoje o assunto é o dado mais sensível que você guarda: a **senha** das pessoas.',
          'Primeiro, o erro mais comum: "eu uso SHA-256, então está seguro". Não está — e o motivo é contraintuitivo.',
        ],
        board: {
          title: 'Por que SHA-256 puro é ruim para senhas',
          md: `\`\`\`python
import hashlib
hashlib.sha256(b"123456").hexdigest()
# '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'  ← igual para TODO mundo que usa 123456
\`\`\`

| Problema | Por quê |
|---|---|
| **Rápido demais** | uma única GPU calcula na casa de **20 bilhões** de SHA-256 por segundo — um dicionário de 1 bilhão de senhas cai em frações de segundo |
| **Determinístico** | mesma senha → mesmo hash: dá para ver quem compartilha senha e usar tabelas pré-calculadas (*rainbow tables*) |
| **Senhas humanas são previsíveis** | \`Verao2024!\` sai de "dicionário + regras" em segundos; não há 2²⁵⁶ possibilidades, há poucos bilhões prováveis |

Velocidade é **virtude** para verificar a integridade de arquivos — e **defeito** para senhas. Para senhas queremos o contrário: uma função **lenta de propósito** e com **sal**.

> [!atencao] Hash de senha não é criptografia: não existe "descriptografar". Se o "esqueci minha senha" manda a **senha antiga** por e-mail, ela está guardada de forma reversível — e vaza inteira junto com a chave.

> [!dica] Na aula de APIs vimos que SHA-256 **serve** para API keys. A diferença é a entropia: uma chave de \`secrets.token_urlsafe(32)\` tem 256 bits aleatórios, e não há dicionário para testar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Primeira correção: o **salt** — um valor aleatório por usuário, guardado ao lado do hash.',
          'E um tempero que pouca gente conhece: o **pepper**, que fica **fora** do banco.',
        ],
        board: {
          title: 'Salt e pepper',
          md: `\`\`\`python
import hashlib, hmac, secrets

salt = secrets.token_bytes(16)                 # único por usuário; vai para o banco, junto do hash
PEPPER = cofre.buscar("pepper-senhas-v1")      # um só, FORA do banco (KMS, HSM, secret manager)

com_pepper = hmac.new(PEPPER, senha.encode(), "sha256").digest()
dk = hashlib.scrypt(com_pepper, salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024**2)
\`\`\`

| | **Salt** | **Pepper** |
|---|---|---|
| É segredo? | não | **sim** |
| Onde fica | no banco, ao lado do hash | fora do banco (cofre, KMS, HSM) |
| Quantos | um **por usuário** | um global (por versão) |
| Protege contra | rainbow tables, atacar todos de uma vez, senhas iguais com hashes iguais | vazamento **só do banco** (backup, SQL injection) |

Guarde tudo o que é preciso para verificar **numa string só** — algoritmo, parâmetros, salt e hash. É isso que permite subir o custo no futuro:

\`\`\`text
pbkdf2_sha256$600000$9f86d081884c7d65$5e884898da28047151d0e56f8dc62927…
$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$Rdescudv…   ← formato PHC: algoritmo, versão, custos, salt, hash
\`\`\`

> [!sabia] O **pepper** é o "segredo do servidor" das senhas: com salt, um atacante com o banco ainda testa senhas prováveis; com pepper, ele nem sabe **qual função** calcular. O preço é operacional: trocar o pepper exige refazer os hashes no próximo login de cada um — por isso guarde a **versão** do pepper junto do hash (\`v1\`, \`v2\`).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Segunda correção: trocar o SHA-256 por uma **KDF** — uma função lenta de propósito, com custo ajustável.',
          'As boas ainda são *memory-hard*: exigem memória, que é justamente o que GPUs e ASICs têm pouco por núcleo.',
        ],
        board: {
          title: 'Funções lentas: Argon2id, scrypt, bcrypt, PBKDF2',
          md: `| Função | Tipo | Parâmetros mínimos (OWASP) | Observação |
|---|---|---|---|
| **Argon2id** | memory-hard | m = 19 MiB, t = 2, p = 1 | venceu a *Password Hashing Competition* (2015); primeira escolha |
| **scrypt** | memory-hard | N = 2¹⁷, r = 8, p = 1 | na stdlib: \`hashlib.scrypt\` |
| **bcrypt** | CPU-hard | custo ≥ 10 | usa só os **72 primeiros bytes** da senha |
| **PBKDF2-HMAC-SHA256** | CPU-hard | 600.000 iterações | aceita em ambientes FIPS; na stdlib: \`hashlib.pbkdf2_hmac\` |

\`\`\`python
import hashlib, secrets

salt = secrets.token_bytes(16)
dk = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, 600_000)
dk = hashlib.scrypt(senha.encode("utf-8"), salt=salt, n=2**17, r=8, p=1,
                    maxmem=256 * 1024**2)    # N=2¹⁷ usa 128 MiB; o limite padrão do OpenSSL é 32 MiB
\`\`\`

- **Calibre** o custo para ~100–500 ms no seu servidor — e suba com o tempo.
- **Rehash no login**: é o único momento em que você tem a senha em texto. Se o hash guardado usa parâmetros velhos, recalcule e salve o novo.
- Custo lento é também um alvo de **DoS**: limite o tamanho da senha (ex.: 1.024 bytes) e as tentativas por conta e por IP.

> [!sabia] O limite de **72 bytes** do bcrypt já causou incidente: em 2024, a Okta revelou que usava \`bcrypt(user_id + usuario + senha)\` como chave de um cache de login. Com um nome de usuário de 52+ caracteres, a senha ficava **além** do byte 72 e era ignorada — dava para entrar com qualquer senha (se houvesse uma autenticação anterior em cache).`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora os vazamentos sutis: **tempo** e **mensagens de erro**.',
          'Um login pode entregar quem tem conta no seu site sem mostrar nenhum dado — só pelo jeito como responde.',
        ],
        board: {
          title: 'Timing attacks e enumeração de usuários',
          md: `\`\`\`python
import hmac

token_recebido == token_esperado                      # ❌ para no 1º byte diferente: o tempo vaza o progresso
hmac.compare_digest(token_recebido, token_esperado)   # ✅ tempo constante, acertando ou errando
\`\`\`

| Onde vaza | ❌ Revela | ✅ Não revela |
|---|---|---|
| Mensagem do login | "usuário não existe" × "senha incorreta" | "e-mail ou senha inválidos" |
| **Tempo** do login | inexistente: 1 ms; existente: 300 ms (a KDF rodou) | calcula um hash **falso** quando o usuário não existe |
| Recuperar senha | "e-mail não cadastrado" | "se houver uma conta, enviamos um link" |
| Cadastro | "e-mail já em uso" | segue o fluxo e avisa o **dono** do e-mail por e-mail |

\`\`\`python
HASH_FALSO = hash_senha("senha-que-ninguem-usa")

def login(email, senha):
    usuario = repo.buscar(email)
    armazenado = usuario.senha_hash if usuario else HASH_FALSO
    ok = verificar_senha(senha, armazenado)            # SEMPRE paga o custo da KDF
    if usuario is None or not ok:
        raise CredenciaisInvalidas("e-mail ou senha inválidos")
    return usuario
\`\`\`

Contra **credential stuffing** (senhas vazadas de outros sites): limite de tentativas por conta **e** por IP, MFA, e recusar senhas que já apareceram em vazamentos. A NIST SP 800-63B recomenda justamente isso — e **desaconselha** regras de composição ("1 maiúscula, 1 símbolo") e troca periódica obrigatória.

> [!sabia] Como checar se uma senha vazou **sem enviá-la** a ninguém? O *Have I Been Pwned* usa **k-anonimato**: você calcula o SHA-1 da senha e manda só os **5 primeiros** caracteres hex; o serviço devolve algumas centenas de sufixos que começam assim, e a comparação final é feita **no seu servidor**. O serviço nunca sabe qual senha você testou.`,
        },
      },
      {
        type: 'say',
        text: [
          'Mesmo com tudo isso, senhas vazam, são reusadas e caem em phishing. Por isso existe o **MFA**.',
          'Mas nem todo segundo fator é igual — alguns caem para o mesmo phishing que roubou a senha.',
        ],
        board: {
          title: 'MFA: nem todo fator é igual',
          md: `Fatores: algo que você **sabe** (senha), algo que você **tem** (celular, chave), algo que você **é** (biometria). MFA combina fatores de tipos **diferentes**.

| Segundo fator | Fraqueza principal | Resiste a phishing? |
|---|---|---|
| **SMS / voz** | *SIM swap* (o golpista transfere o seu número), interceptação na rede telefônica | ❌ |
| **TOTP** (app autenticador) | um site falso repassa o código **em tempo real** (proxy *AiTM*) | ❌ |
| **Push** ("Foi você? Sim/Não") | *MFA fatigue*: dezenas de pushes até a vítima aceitar → exija **number matching** | ❌ (melhora com number matching) |
| **WebAuthn / passkeys** | perder o aparelho (tenha recuperação) | ✅ a assinatura é amarrada à **origem** |

\`\`\`text
 WebAuthn: o navegador inclui a ORIGEM no que o autenticador assina.
 site falso  logim-banco.com  →  assinatura para "logim-banco.com"  →  inútil em banco.com
\`\`\`

> [!atencao] O elo fraco costuma ser a **recuperação**: de nada adianta passkey se "perdi meu celular" reseta tudo por SMS. Dê **códigos de recuperação** de uso único (guardados com hash, como senhas) e trate a recuperação como login de alto risco.

> [!dica] Em 2022, um invasor entrou na Uber por *MFA fatigue*: disparou pushes repetidamente e mandou mensagem se passando pelo suporte até o funcionário aprovar. *Number matching* (digitar no celular o número mostrado na tela) mata esse ataque.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E como o app autenticador sabe o código **sem internet**? O **TOTP** é só um HMAC do relógio.',
          'App e servidor fazem a mesma conta, cada um sozinho — e chegam ao mesmo número.',
        ],
        board: {
          title: 'TOTP (RFC 6238) por dentro',
          md: `\`\`\`text
 cadastro: o servidor gera um segredo (160 bits) e mostra um QR code:
   otpauth://totp/Loja:ana@x.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Loja&period=30&digits=6
                                        └── segredo em base32

 a cada 30 s, no app e no servidor:
   T      = floor((agora − T0) / 30)                  ← passos de 30 s desde 1970 (T0 = 0)
   mac    = HMAC-SHA1(segredo, T em 8 bytes big-endian)      → 20 bytes
   offset = mac[19] & 0x0F                            ← "truncamento dinâmico": 0..15
   n      = (4 bytes de mac a partir de offset) & 0x7FFFFFFF   ← 31 bits, sem sinal
   código = n mod 10⁶, com zeros à esquerda           → "081804"
\`\`\`

| Na verificação | Por quê |
|---|---|
| Aceitar **T−1, T, T+1** (janela) | o relógio do celular erra alguns segundos |
| Guardar o **último T aceito** | um código visto por cima do ombro não pode ser reusado (*replay*) |
| **Limitar tentativas** | 6 dígitos = 1 milhão; com janela de 3, cada chute acerta com chance 3/1.000.000 — sem limite, cai em horas |
| Comparar com \`compare_digest\` | timing attack no código, como em qualquer segredo |
| **Cifrar o segredo** no banco | o servidor precisa dele em claro para calcular — não dá para guardar só um hash! |

> [!sabia] O TOTP é o **HOTP** (RFC 4226, 2005) com o contador trocado pelo relógio (RFC 6238, 2011). E a RFC traz um vetor de teste curioso: \`t = 20000000000\` — o ano **2603**. Ele existe para pegar quem guarda o contador em **32 bits**: o contador tem 8 bytes justamente para não ter "bug do milênio".`,
        },
      },
      {
        type: 'say',
        text: [
          'Depois do login, alguém precisa lembrar que você está logado. Duas escolas: **sessão no servidor** ou **token autocontido**.',
          'O JWT a fundo ficou na trilha de APIs; aqui, o essencial da escolha.',
        ],
        board: {
          title: 'Sessões × tokens',
          md: `| | **Sessão no servidor** | **Token autocontido** (JWT) |
|---|---|---|
| Onde está o estado | servidor (Redis, banco); o cookie só leva um id aleatório | no próprio token, assinado |
| Revogar (logout, conta bloqueada) | apagar a sessão: **imediato** | difícil: vale até o \`exp\` (tokens curtos, denylist) |
| Custo por requisição | uma consulta (em cache) | verificação local da assinatura |
| Bom para | app web com um backend | APIs entre serviços, federação |

\`\`\`python
import secrets
sessao_id = secrets.token_urlsafe(32)          # 256 bits: impossível de adivinhar
\`\`\`

\`\`\`http
Set-Cookie: sessao=Qm9hIHRlbnRhdGl2YSE…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800
\`\`\`

Higiene de sessão:

- **Regenere o id no login** (e ao ganhar privilégio): senão vale a *session fixation* — o atacante planta um id conhecido antes do login da vítima e herda a sessão autenticada.
- **Timeout ocioso** (ex.: 30 min) **e absoluto** (ex.: 8 h).
- Logout **apaga no servidor**; trocar a senha derruba as outras sessões.
- Nunca ponha o id da sessão na URL (vaza em logs e no \`Referer\`).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — com hash de senha de verdade e um TOTP conferido com os vetores oficiais da RFC.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-pwd-q1',
        concept: 'Hash de senha',
        say: 'Primeira: incidente real. O que você faz?',
        prompt: 'O banco de uma aplicação vazou. As senhas estão guardadas como `sha256(senha)` em hexadecimal. Além de avisar os usuários, qual é a **correção** certa no armazenamento?',
        options: [
          { text: 'Trocar para uma **KDF lenta** (Argon2id, scrypt ou PBKDF2) com **salt** por usuário. Os hashes atuais podem ser migrados já, "embrulhados": `kdf(sha256_antigo)`; no próximo login, recalcula-se direto da senha.', correct: true, why: 'Exato. A KDF torna cada tentativa cara, o salt impede atacar todos de uma vez, e o *hash wrapping* protege imediatamente quem ainda não logou — sem precisar das senhas originais.' },
          { text: 'Acrescentar um salt **fixo**, igual para todos, e manter o SHA-256.', why: 'Um salt global só invalida rainbow tables prontas. Senhas iguais continuam com hashes iguais, e o SHA-256 segue permitindo bilhões de tentativas por segundo.' },
          { text: 'Cifrar as senhas com AES-256 e guardar a chave no servidor.', why: 'Cifra é **reversível**: quem obtiver a chave (que mora no mesmo servidor) recupera **todas** as senhas em texto. E você nunca precisa da senha de volta — só de verificá-la.' },
          { text: 'Trocar para SHA-512, ou aplicar o SHA-256 duas vezes.', why: 'Continua rápido: duas rodadas só dobram um custo desprezível. O problema não é o tamanho do hash, é a **velocidade** — e a falta de salt.' },
        ],
        explanation: 'Hash de senha tem três requisitos: ser **lento** e com custo ajustável (KDF), ter **salt** único por usuário e guardar os **parâmetros** junto (para subir o custo no futuro). Numa migração, não dá para esperar todo mundo logar: o truque é o *hash wrapping* — aplicar a KDF sobre o hash antigo (`kdf(sha256(senha))`) e marcar o registro; no próximo login, com a senha em mãos, recalcula-se no formato novo. E, como o banco vazou, as senhas devem ser consideradas comprometidas: exija troca e ofereça MFA.',
      },
      {
        type: 'code',
        id: 'sec-pwd-q2',
        concept: 'PBKDF2 com salt',
        title: 'hash_senha e verificar_senha',
        say: 'Agora é com você: guardar e verificar senhas do jeito certo, com PBKDF2 e salt. Os testes usam poucas iterações só para rodar rápido.',
        prompt: `Implemente, com \`hashlib.pbkdf2_hmac("sha256", ...)\`:

- \`hash_senha(senha, iteracoes=ITERACOES_PADRAO, salt=None) -> str\`: se \`salt\` for \`None\`, gere **16 bytes** com \`secrets.token_bytes\`. Derive a chave da senha em UTF-8 e devolva a string

\`\`\`text
pbkdf2_sha256$<iteracoes>$<salt em hex>$<hash em hex>
\`\`\`

- \`verificar_senha(senha, armazenado) -> bool\`: leia algoritmo, iterações e salt **da string guardada**, recalcule e compare com \`hmac.compare_digest\`. Qualquer string malformada (partes faltando, algoritmo diferente, iterações não numéricas ou ≤ 0, hex inválido) devolve \`False\` — **nunca** uma exceção.
- \`precisa_rehash(armazenado, iteracoes=ITERACOES_PADRAO) -> bool\`: \`True\` se o hash guardado estiver malformado, usar outro algoritmo ou usar **menos** iterações que as pedidas.`,
        starter: `import hashlib
import hmac
import secrets

ALGORITMO = "pbkdf2_sha256"
ITERACOES_PADRAO = 600_000


def hash_senha(senha, iteracoes=ITERACOES_PADRAO, salt=None):
    # TODO: pbkdf2_sha256$<iteracoes>$<salt hex>$<hash hex>
    pass


def verificar_senha(senha, armazenado):
    # TODO: use os parâmetros GUARDADOS; nunca lance exceção
    pass


def precisa_rehash(armazenado, iteracoes=ITERACOES_PADRAO):
    # TODO
    pass
`,
        tests: [
          {
            name: 'formato e valor: pbkdf2_sha256$iterações$salt$hash (hex)',
            code: AUX_HASH + `
salt = bytes(range(16))
obtido = hash_senha("correcthorsebatterystaple", iteracoes=1000, salt=salt)
esperado = _armazenado("correcthorsebatterystaple", salt, 1000)
assert isinstance(obtido, str), f"hash_senha deve devolver str, veio {type(obtido).__name__}"
assert obtido == esperado, f"esperado {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'salt aleatório de 16 bytes: a mesma senha gera hashes diferentes',
            code: `a = hash_senha("123456", iteracoes=1000)
b = hash_senha("123456", iteracoes=1000)
assert a != b, "a mesma senha gerou o mesmo hash duas vezes: o salt precisa ser aleatório a cada chamada"
partes = a.split("$")
assert len(partes) == 4, f"o formato tem 4 partes separadas por '$', veio {a!r}"
assert len(bytes.fromhex(partes[2])) == 16, f"o salt deve ter 16 bytes (32 caracteres hex), veio {partes[2]!r}"
assert len(bytes.fromhex(partes[3])) == 32, "o hash do PBKDF2-SHA256 tem 32 bytes (64 caracteres hex)"`,
          },
          {
            name: 'verificar_senha: aceita a certa e recusa as parecidas',
            code: `h = hash_senha("S3nh@Forte", iteracoes=1000)
assert verificar_senha("S3nh@Forte", h) is True, "a senha certa deveria ser aceita (devolva True)"
for errada in ["s3nh@forte", "S3nh@Forte ", "", "S3nh@Fort"]:
    assert verificar_senha(errada, h) is False, f"a senha {errada!r} deveria ser recusada (devolva False)"`,
          },
          {
            name: 'verificar_senha usa as iterações e o salt GUARDADOS (e senha em UTF-8)',
            code: AUX_HASH + `
armazenado = _armazenado("pão de queijo 🧀", b"sal-de-teste-16b", 2500)
assert verificar_senha("pão de queijo 🧀", armazenado) is True, "use as iterações (2500) e o salt que estão na string guardada"
assert verificar_senha("pao de queijo 🧀", armazenado) is False, "sem acento é outra senha"`,
          },
          {
            name: 'precisa_rehash: parâmetros antigos pedem um hash novo',
            code: `velho = hash_senha("x", iteracoes=1000)
assert precisa_rehash(velho, iteracoes=2000) is True, "1000 < 2000 iterações: precisa de rehash"
assert precisa_rehash(velho, iteracoes=1000) is False, "mesmas iterações: não precisa"
assert precisa_rehash(hash_senha("x", iteracoes=3000), iteracoes=2000) is False, "mais iterações que o pedido: não precisa"
legado = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"
assert precisa_rehash(legado, iteracoes=1000) is True, "SHA-256 puro (legado) precisa de rehash"`,
          },
          {
            name: 'hash malformado → False, nunca exceção',
            hidden: true,
            code: `h = hash_senha("segredo", iteracoes=1000)
casos = ["", "abc", "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
         "pbkdf2_sha256$1000$zz$00", "pbkdf2_sha256$mil$00$00", "pbkdf2_sha256$-5$00$00",
         "pbkdf2_sha256$0$00$00", "md5$1000$00$00", "pbkdf2_sha256$1000$00",
         h + "$extra", h.replace("pbkdf2_sha256", "pbkdf2_sha1")]
for caso in casos:
    try:
        obtido = verificar_senha("segredo", caso)
    except Exception as e:
        raise AssertionError(f"verificar_senha(..., {caso[:40]!r}) lançou {type(e).__name__}: {e} — devolva False") from None
    assert obtido is False, f"hash malformado {caso[:40]!r} deveria dar False, veio {obtido!r}"
    try:
        obtido = precisa_rehash(caso, iteracoes=1000)
    except Exception as e:
        raise AssertionError(f"precisa_rehash({caso[:40]!r}) lançou {type(e).__name__}: {e} — devolva True") from None
    assert obtido is True, f"precisa_rehash({caso[:40]!r}) deveria ser True, veio {obtido!r}"`,
          },
          {
            name: 'salt informado é usado; salts diferentes geram hashes diferentes',
            hidden: true,
            code: AUX_HASH + `
s1, s2 = b"A" * 16, b"B" * 16
assert hash_senha("abc", iteracoes=1000, salt=s1) == _armazenado("abc", s1, 1000), "use o salt recebido"
assert hash_senha("abc", iteracoes=1000, salt=s1) != hash_senha("abc", iteracoes=1000, salt=s2), "salts diferentes → hashes diferentes"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou os hashes sem `hmac.compare_digest`. O `==` para no primeiro byte diferente e deixa o tempo vazar informação (*timing attack*). Em qualquer comparação de segredo, use a versão de tempo constante.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.imports.includes('random'),
            text: 'O módulo `random` é um PRNG **previsível** (Mersenne Twister): com saídas suficientes dá para reconstruir o estado. Para salt, tokens e ids de sessão, use `secrets` (ou `os.urandom`).',
            concept: 'Aleatoriedade criptográfica',
          },
          {
            when: (m, code) => /sha256\(/.test(code),
            text: 'Você chamou `hashlib.sha256(...)` direto. Para senhas, o hash precisa ser **lento** e com salt: é o PBKDF2 que repete o HMAC milhares de vezes — o SHA-256 puro permite bilhões de tentativas por segundo.',
            concept: 'KDF lenta',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Assim, um bug seu (um `NameError`, um `TypeError`) vira "senha incorreta" em silêncio. Capture o que a análise pode lançar: `ValueError` (de `int()`, `bytes.fromhex` e iterações inválidas).',
            concept: 'Tratamento de exceções',
          },
        ],
        hints: [
          '`dk = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, iteracoes)`. Para montar a string sem erro, use `"$".join([ALGORITMO, str(iteracoes), salt.hex(), dk.hex()])`.',
          'Crie um `_ler(armazenado)` que faz `split("$")`, exige 4 partes e o algoritmo certo, converte com `int(...)` e `bytes.fromhex(...)` e lança `ValueError` em qualquer problema (inclusive iterações ≤ 0).',
          '`verificar_senha`: `try: iteracoes, salt, esperado = _ler(armazenado) except ValueError: return False` e depois `hmac.compare_digest(dk, esperado)`. `precisa_rehash` reaproveita o mesmo `_ler`.',
        ],
        solution: `import hashlib
import hmac
import secrets

ALGORITMO = "pbkdf2_sha256"
ITERACOES_PADRAO = 600_000


def _derivar(senha, salt, iteracoes):
    return hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt, iteracoes)


def hash_senha(senha, iteracoes=ITERACOES_PADRAO, salt=None):
    if salt is None:
        salt = secrets.token_bytes(16)          # único por usuário, de fonte criptográfica
    dk = _derivar(senha, salt, iteracoes)
    return "$".join([ALGORITMO, str(iteracoes), salt.hex(), dk.hex()])


def _ler(armazenado):
    """Devolve (iteracoes, salt, hash) ou lança ValueError."""
    partes = armazenado.split("$")
    if len(partes) != 4 or partes[0] != ALGORITMO:
        raise ValueError("formato ou algoritmo desconhecido")
    iteracoes = int(partes[1])
    if iteracoes <= 0:
        raise ValueError("iterações inválidas")
    return iteracoes, bytes.fromhex(partes[2]), bytes.fromhex(partes[3])


def verificar_senha(senha, armazenado):
    try:
        iteracoes, salt, esperado = _ler(armazenado)
    except ValueError:
        return False
    return hmac.compare_digest(_derivar(senha, salt, iteracoes), esperado)


def precisa_rehash(armazenado, iteracoes=ITERACOES_PADRAO):
    try:
        guardadas, _, _ = _ler(armazenado)
    except ValueError:
        return True
    return guardadas < iteracoes
`,
        solutionExplanation: 'O coração é o `_ler`: ele concentra **toda** a validação da string guardada e transforma qualquer problema num `ValueError` — que `verificar_senha` traduz em `False` e `precisa_rehash` em `True`. A verificação usa os parâmetros **guardados** (iterações e salt), não os atuais: é isso que permite subir o `ITERACOES_PADRAO` sem invalidar as senhas antigas. A comparação é em tempo constante. E `precisa_rehash` fecha o ciclo: no login bem-sucedido, se ela disser `True`, você recalcula com os parâmetros novos e salva — o único momento em que a senha está em mãos. Em produção, prefira Argon2id (pacote `argon2-cffi`), que já faz tudo isso no formato PHC.',
      },
      {
        type: 'order',
        id: 'sec-pwd-q3',
        concept: 'TOTP',
        say: 'Antes de implementar o TOTP, ordene o algoritmo — do cadastro à verificação.',
        prompt: 'Ordene os passos do **TOTP**, do cadastro do app autenticador até a verificação no servidor.',
        items: [
          'O servidor gera um segredo aleatório e o entrega ao app num QR code `otpauth://`',
          'App e servidor calculam o contador `T = floor(agora / 30)`',
          'Calculam `HMAC-SHA1(segredo, T)`, com T em 8 bytes big-endian',
          'Truncamento dinâmico: os 4 últimos bits do HMAC dão o offset, e 4 bytes dali viram um inteiro de 31 bits',
          'O código é esse inteiro `mod 10^6`, com zeros à esquerda',
          'O servidor compara, com `compare_digest`, os códigos de T−1, T e T+1',
          'O servidor guarda o T aceito e recusa reusá-lo (anti-replay)',
        ],
        explanation: 'O segredo só trafega **uma vez**, no cadastro. Depois, app e servidor chegam ao mesmo código sem conversar: o relógio vira contador, o HMAC mistura contador e segredo, o **truncamento dinâmico** (offset escolhido pelo próprio HMAC) extrai 31 bits e o `mod 10^6` gera os 6 dígitos. Na verificação, a **janela** tolera relógios dessincronizados e o registro do último T aceito impede que um código observado seja reaproveitado nos 30–90 s em que ainda seria válido.',
      },
      {
        type: 'code',
        id: 'sec-pwd-q4',
        concept: 'TOTP (RFC 6238)',
        title: 'TOTP na unha, com os vetores da RFC',
        say: 'Agora implemente o TOTP — com relógio injetado, para testar o tempo sem esperar. Os testes usam os vetores oficiais das RFCs 4226 e 6238.',
        prompt: `Implemente, com \`hmac\`, \`hashlib.sha1\` e \`struct\`:

- \`hotp(segredo, contador, digitos=6) -> str\` (RFC 4226): HMAC-SHA1 de \`segredo\` sobre o contador em **8 bytes big-endian**; \`offset = mac[-1] & 0x0F\`; pegue 4 bytes a partir do offset como inteiro big-endian e aplique \`& 0x7FFFFFFF\`; o código é \`n % 10**digitos\` com **zeros à esquerda**.
- \`totp(segredo, relogio=time.time, passo=30, digitos=6) -> str\`: \`hotp\` do contador \`floor(relogio() / passo)\`.
- \`verificar_totp(segredo, codigo, relogio=time.time, janela=1, ultimo_usado=None, passo=30, digitos=6)\`: procura o código nos contadores de \`T - janela\` a \`T + janela\` (ignorando contadores negativos e os \`<= ultimo_usado\`, se informado) comparando com \`hmac.compare_digest\`. Devolve o **contador** aceito (um \`int\`) ou \`None\`. Se \`codigo\` não for uma string com exatamente \`digitos\` dígitos ASCII, devolve \`None\` — sem exceção.`,
        starter: `import hashlib
import hmac
import struct
import time


def hotp(segredo, contador, digitos=6):
    # TODO: RFC 4226
    pass


def totp(segredo, relogio=time.time, passo=30, digitos=6):
    # TODO: RFC 6238
    pass


def verificar_totp(segredo, codigo, relogio=time.time, janela=1, ultimo_usado=None, passo=30, digitos=6):
    # TODO: devolva o contador aceito ou None
    pass
`,
        tests: [
          {
            name: 'hotp: vetores da RFC 4226 (contadores 0 a 9)',
            code: `esperados = ["755224", "287082", "359152", "969429", "338314",
             "254676", "287922", "162583", "399871", "520489"]
for contador, esperado in enumerate(esperados):
    obtido = hotp(b"12345678901234567890", contador)
    assert obtido == esperado, f"hotp(semente, {contador}) deveria ser {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'totp: vetores da RFC 6238 (SHA-1, 8 dígitos)',
            code: `vetores = [(59, "94287082"), (1111111109, "07081804"), (1111111111, "14050471"),
           (1234567890, "89005924"), (2000000000, "69279037")]
for instante, esperado in vetores:
    obtido = totp(b"12345678901234567890", relogio=lambda: instante, digitos=8)
    assert obtido == esperado, f"em t={instante}, esperado {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'zeros à esquerda com 6 dígitos, e o código troca a cada 30 s',
            code: `s = b"12345678901234567890"
assert totp(s, relogio=lambda: 1111111109) == "081804", "o código tem sempre 6 caracteres: preencha com zeros à esquerda"
assert totp(s, relogio=lambda: 1234567890) == "005924", "o código tem sempre 6 caracteres: preencha com zeros à esquerda"
assert totp(s, relogio=lambda: 30) == totp(s, relogio=lambda: 59), "t=30 e t=59 estão no mesmo passo"
assert totp(s, relogio=lambda: 59) != totp(s, relogio=lambda: 60), "t=60 começa um passo novo"`,
          },
          {
            name: 'verificar_totp: aceita o passo atual e os vizinhos, devolve o contador',
            code: AUX_TOTP + `
agora = lambda: 1111111111        # contador 37037037
for contador in (37037036, 37037037, 37037038):
    obtido = verificar_totp(SEMENTE, _hotp(SEMENTE, contador), relogio=agora)
    assert obtido == contador, f"o código do contador {contador} está na janela: devolva {contador}, veio {obtido!r}"
for contador in (37037035, 37037039):
    obtido = verificar_totp(SEMENTE, _hotp(SEMENTE, contador), relogio=agora)
    assert obtido is None, f"o contador {contador} está fora da janela ±1: devolva None, veio {obtido!r}"
obtido = verificar_totp(SEMENTE, _hotp(SEMENTE, 37037036), relogio=agora, janela=0)
assert obtido is None, f"com janela=0 só o passo atual vale, veio {obtido!r}"
assert verificar_totp(SEMENTE, "000000", relogio=agora) is None, "código errado deveria dar None"`,
          },
          {
            name: 'anti-replay: contadores <= ultimo_usado são recusados',
            code: AUX_TOTP + `
agora = lambda: 1111111111        # contador 37037037
codigo = _hotp(SEMENTE, 37037037)
obtido = verificar_totp(SEMENTE, codigo, relogio=agora, ultimo_usado=37037037)
assert obtido is None, f"esse código já foi usado (ultimo_usado=37037037): devolva None, veio {obtido!r}"
obtido = verificar_totp(SEMENTE, _hotp(SEMENTE, 37037038), relogio=agora, ultimo_usado=37037037)
assert obtido == 37037038, f"o contador seguinte ainda vale, veio {obtido!r}"`,
          },
          {
            name: 'contador em 8 bytes: o vetor da RFC para t = 20000000000 (ano 2603)',
            hidden: true,
            code: `obtido = totp(b"12345678901234567890", relogio=lambda: 20000000000, digitos=8)
assert obtido == "65353130", f"em t=20000000000 o contador passa de 32 bits (use struct '>Q'): esperado '65353130', veio {obtido!r}"`,
          },
          {
            name: 'começo do tempo: contador 0 é devolvido (e sem contadores negativos)',
            hidden: true,
            code: AUX_TOTP + `
obtido = verificar_totp(SEMENTE, "755224", relogio=lambda: 10)
assert obtido == 0 and obtido is not False, f"o código do contador 0 deveria devolver 0, veio {obtido!r}"
assert verificar_totp(SEMENTE, "287082", relogio=lambda: 10) == 1, "o contador 1 está na janela de t=10"
assert verificar_totp(SEMENTE, "123456", relogio=lambda: 10) is None, "código errado em t=10: None (e nada de contador -1)"`,
          },
          {
            name: 'código com formato inválido → None, sem exceção',
            hidden: true,
            code: AUX_TOTP + `
agora = lambda: 59
for codigo in ["", "28708", "2870822", "abcdef", " 28708", "２８７０８２", None, 287082]:
    try:
        obtido = verificar_totp(SEMENTE, codigo, relogio=agora)
    except Exception as e:
        raise AssertionError(f"verificar_totp com codigo={codigo!r} lançou {type(e).__name__}: {e} — devolva None") from None
    assert obtido is None, f"codigo={codigo!r} deveria dar None, veio {obtido!r}"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou os códigos sem `hmac.compare_digest`. Um código de 6 dígitos é um segredo como outro qualquer: o `==` vaza pelo tempo quantos caracteres já batem.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: (m, code) => /["'][>!]?[iIlL]["']/.test(code),
            text: 'Você empacotou o contador em **4 bytes**. A RFC exige 8 (`struct.pack(">Q", contador)`) — em 2106 o contador de 32 bits estoura, e o vetor de teste de `t = 20000000000` existe justamente para pegar isso.',
            concept: 'Contador de 8 bytes',
          },
          {
            when: m => m.calls.includes('time') && m.imports.includes('time'),
            text: 'Você chamou `time.time()` dentro da lógica. Use o `relogio` injetado: é ele que permite testar a virada do passo (t=59 → t=60) e os vetores da RFC sem esperar o tempo passar.',
            concept: 'Injeção de relógio',
          },
          {
            when: (m, code) => /\bint\(\s*codigo/.test(code),
            text: 'Converter o código para `int` apaga os zeros à esquerda (`"081804"` vira `81804`) e aceita coisas como `" 81804"`. Compare **strings** de tamanho fixo, com `compare_digest`.',
            concept: 'Zeros à esquerda',
          },
        ],
        hints: [
          '`mac = hmac.new(segredo, struct.pack(">Q", contador), hashlib.sha1).digest()`; `o = mac[-1] & 0x0F`; `n = int.from_bytes(mac[o:o + 4], "big") & 0x7FFFFFFF`; `str(n % 10**digitos).zfill(digitos)`.',
          '`totp` é uma linha: `hotp(segredo, int(relogio() // passo), digitos)`.',
          'Em `verificar_totp`: valide com `isinstance(codigo, str) and len(codigo) == digitos and codigo.isascii() and codigo.isdigit()`; depois percorra `range(max(0, T - janela), T + janela + 1)`, pule os `<= ultimo_usado` e devolva o contador cujo `hotp` bate.',
        ],
        solution: `import hashlib
import hmac
import struct
import time


def hotp(segredo, contador, digitos=6):
    mac = hmac.new(segredo, struct.pack(">Q", contador), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F                                   # truncamento dinâmico
    n = int.from_bytes(mac[offset:offset + 4], "big") & 0x7FFFFFFF
    return str(n % 10 ** digitos).zfill(digitos)


def _contador(relogio, passo):
    return int(relogio() // passo)


def totp(segredo, relogio=time.time, passo=30, digitos=6):
    return hotp(segredo, _contador(relogio, passo), digitos)


def _formato_valido(codigo, digitos):
    return isinstance(codigo, str) and len(codigo) == digitos and codigo.isascii() and codigo.isdigit()


def verificar_totp(segredo, codigo, relogio=time.time, janela=1, ultimo_usado=None, passo=30, digitos=6):
    if not _formato_valido(codigo, digitos):
        return None
    atual = _contador(relogio, passo)
    minimo = max(0, atual - janela)
    if ultimo_usado is not None:
        minimo = max(minimo, ultimo_usado + 1)                # anti-replay
    for contador in range(minimo, atual + janela + 1):
        if hmac.compare_digest(hotp(segredo, contador, digitos), codigo):
            return contador
    return None
`,
        solutionExplanation: 'O `hotp` segue a RFC 4226 ao pé da letra: contador em **8 bytes** big-endian (`">Q"` — por isso o vetor de 2603 passa), truncamento dinâmico com o offset vindo do último byte, máscara `0x7FFFFFFF` para evitar o bit de sinal e `zfill` para manter os zeros à esquerda. O `totp` só troca o contador pelo relógio **injetado**. Na verificação, o formato é checado antes (e `isascii` importa: `compare_digest` recusa strings não ASCII); a janela começa em `max(0, T - janela)` e também depois do `ultimo_usado`, o que resolve de uma vez contadores negativos e *replay*. Devolver o **contador** (e não `True`) é o que permite ao chamador guardá-lo — e ele pode ser `0`, então o chamador testa `is not None`. Em produção, some-se limite de tentativas e o segredo cifrado no banco.',
      },
      {
        type: 'match',
        id: 'sec-pwd-q5',
        concept: 'Ataques a autenticação',
        say: 'Rodada rápida: cada ataque com a defesa que o neutraliza.',
        prompt: 'Associe cada **ataque** à **defesa** que o neutraliza.',
        pairs: [
          { left: 'Rainbow table aplicada aos hashes vazados', right: 'Salt aleatório por usuário' },
          { left: 'GPU testando bilhões de senhas por segundo', right: 'KDF lenta e memory-hard (Argon2id, scrypt)' },
          { left: 'Vazou só o banco (backup esquecido, SQL injection)', right: 'Pepper guardado fora do banco' },
          { left: 'Medir quanto tempo a comparação do token demora', right: '`hmac.compare_digest`' },
          { left: '"Usuário não encontrado" × "senha incorreta"', right: 'Mensagem genérica e tempo igual (hash falso)' },
          { left: 'Plantar um id de sessão antes do login da vítima', right: 'Regenerar o id da sessão no login' },
        ],
        explanation: 'Cada defesa quebra uma **premissa** do ataque: o salt tira o ganho do pré-cálculo; a KDF torna cada tentativa cara; o pepper faz o banco sozinho não bastar; a comparação em tempo constante cala o canal lateral; a resposta uniforme (em texto **e** em tempo) esconde quem tem conta; e o id novo no login faz o id plantado pelo atacante não valer nada (*session fixation*).',
      },
      {
        type: 'open',
        id: 'sec-pwd-q6',
        concept: 'Escolha do MFA',
        say: 'Última: uma decisão de produto e segurança. Me convença.',
        prompt: 'Seu produto vai adotar MFA. O time está em dúvida entre **SMS**, **TOTP** (app autenticador), **push** e **passkeys/WebAuthn**. Compare as opções quanto à segurança e diga o que você recomendaria.',
        minWords: 40,
        rubric: [
          { label: 'SMS é o mais fraco: **SIM swap** e interceptação', keywords: ['sim swap', 'sim-swap', 'swap', 'troca de chip', 'chip', 'ss7', 'portabilidade', 'operadora', 'intercept'], concept: 'Fraquezas do SMS', why: 'O número de telefone pode ser transferido por engenharia social na operadora (SIM swap) e a rede telefônica não foi feita para segredos.' },
          { label: 'SMS e TOTP são **phishable**: um site falso repassa o código em tempo real', keywords: ['phishing', 'proxy', 'aitm', 'in-the-middle', 'in the middle', 'mitm', 'tempo real', 'evilginx', 'site falso', 'pagina falsa', 'repass'], concept: 'Phishing em tempo real', why: 'O código não sabe em que site foi digitado: um proxy do atacante pede a senha e o código à vítima e os usa na hora, no site verdadeiro.' },
          { label: 'Push sofre **MFA fatigue**: exigir **number matching**', keywords: ['fatigue', 'fadiga', 'bombard', 'spam', 'number matching', 'numero na tela', 'digitar o numero', 'correspondencia', 'aprovar sem', 'aceitar sem'], concept: 'MFA fatigue', why: 'Bombardear a vítima com pushes até ela aprovar funcionou em incidentes reais; exigir que ela digite o número mostrado na tela neutraliza isso.' },
          { label: '**Passkeys/WebAuthn** resistem a phishing: a assinatura é amarrada à origem', keywords: ['webauthn', 'passkey', 'fido', 'chave de seguranca', 'yubikey', 'origem', 'dominio', 'resistente a phishing', 'resiste a phishing'], concept: 'WebAuthn', why: 'O navegador inclui a origem no desafio assinado: uma assinatura obtida num domínio falso não vale no verdadeiro.' },
        ],
        modelAnswer: `Eu recomendaria **passkeys/WebAuthn** como meta, com **TOTP** como alternativa amplamente suportada, e SMS apenas como último recurso.

O **SMS** é o fator mais fraco: o número pode ser sequestrado por **SIM swap** (engenharia social na operadora) e a rede telefônica permite interceptação. Além disso, tanto SMS quanto **TOTP** caem em **phishing em tempo real**: uma página falsa funciona como proxy (AiTM, como o evilginx), pede a senha e o código à vítima e os repassa ao site verdadeiro na hora.

O **push** é confortável, mas sofre **MFA fatigue**: o atacante dispara aprovações até a vítima aceitar (foi o caso da Uber em 2022). Se usar push, exija **number matching**, em que a pessoa digita no celular o número mostrado na tela.

Já **WebAuthn/passkeys** resistem a phishing por construção: a assinatura é amarrada à **origem**, então o que for obtido num domínio falso não vale no verdadeiro. Por fim, eu cuidaria da recuperação de conta — códigos de uso único guardados com hash —, que costuma ser o elo mais fraco de qualquer MFA.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou muito bem! Você acabou de implementar, com a stdlib, o que protege boa parte dos logins do mundo.',
          { text: 'Resumo: KDF lenta com salt (e pepper), compare_digest, respostas que não entregam quem tem conta, TOTP com janela e anti-replay — e passkeys contra phishing.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
