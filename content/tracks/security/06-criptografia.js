(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo). Montam tokens "na mão",
  // sem usar o código do jogador — assim um bug em assinar() não mascara os testes de verificar().
  const AUX_CHAVEIRO = `import base64 as _base64
import hashlib as _hashlib
import hmac as _hmac

K1 = b"k1-" + bytes(range(29))
K2 = b"k2-" + bytes(range(100, 129))
K3 = b"k3-segredo-de-teste-com-32-bytes"

def _b64(dados):
    return _base64.urlsafe_b64encode(dados).rstrip(b"=").decode()

def _token(versao, mensagem, chave):
    corpo = f"{versao}.{_b64(mensagem)}"
    tag = _hmac.new(chave, corpo.encode(), _hashlib.sha256).digest()
    return f"{corpo}.{_b64(tag)}"

def _rejeita(chaveiro, token, motivo):
    try:
        chaveiro.verificar(token)
    except AssinaturaInvalida:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar AssinaturaInvalida, mas lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: o token foi ACEITO, mas deveria lançar AssinaturaInvalida")

def _value_error(func, *args, motivo=""):
    try:
        func(*args)
    except ValueError:
        return
    except Exception as e:
        raise AssertionError(f"{motivo}: deveria lançar ValueError, lançou {type(e).__name__}: {e}") from None
    raise AssertionError(f"{motivo}: deveria lançar ValueError, mas não lançou nada")
`;

  const AUX_TOKENS = `import hashlib as _hashlib

ALFABETO_URL = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
DIGITOS = set("0123456789")

def _sha(texto):
    return _hashlib.sha256(texto.encode()).hexdigest()
`;

  Game.registerModule('security', {
    id: 'criptografia',
    title: 'Criptografia na prática: hash, HMAC, cifras e assinaturas',
    kind: 'lesson',
    level: 2,
    order: 30,
    unit: 'pratica',
    summary: 'Encoding não é cifra, hash não é assinatura e ECB desenha pinguins: escolha a ferramenta certa, use nonces e aleatoriedade de verdade, rotacione chaves — e nunca invente a sua própria criptografia.',
    concepts: ['Encoding × hash × HMAC × cifra × assinatura', 'AEAD, ECB e nonces', 'secrets × random', 'Rotação de chaves', 'Envelope encryption'],
    takeaways: [
      '**Encoding** (base64) não protege nada; **hash** dá integridade só com uma fonte confiável; **HMAC** autentica entre quem tem o segredo; **cifra** dá sigilo; **assinatura** prova a autoria para qualquer um.',
      'Cifre com um modo **AEAD** (AES-GCM, ChaCha20-Poly1305) e um **nonce único** por mensagem. **ECB** vaza padrões (o pinguim) e cifra sem autenticação é convite a adulteração.',
      'Segredos (tokens, chaves, códigos) vêm do **`secrets`**, nunca do `random`: o Mersenne Twister é previsível depois de 624 saídas.',
      '**Não invente criptografia**: `sha256(segredo + msg)` sofre *length extension* — use `hmac`. Compare com `hmac.compare_digest` e use bibliotecas maduras.',
      'Chaves têm **versão** e **ciclo de vida** (assinar com a atual, verificar com as ativas, aposentar a velha). **Envelope encryption**: a DEK cifra os dados, a KEK (no KMS) cifra a DEK.',
    ],
    glossary: [
      { term: 'HMAC', aliases: ['HMAC-SHA256', 'Hash-based Message Authentication Code'], definition: '*Hash-based Message Authentication Code* (RFC 2104): um código de autenticação calculado com uma **chave secreta** e uma função hash. Prova integridade e origem para quem compartilha a chave. Em Python: `hmac.new(chave, msg, hashlib.sha256)`.' },
      { term: 'AEAD', aliases: ['Authenticated Encryption with Associated Data', 'cifra autenticada', 'cifragem autenticada', 'AES-GCM', 'ChaCha20-Poly1305'], definition: '*Authenticated Encryption with Associated Data*: modo de cifra que entrega **sigilo e integridade** juntos — um texto cifrado adulterado é rejeitado na decifragem. Exemplos: AES-GCM e ChaCha20-Poly1305.' },
      { term: 'ECB', aliases: ['Electronic Codebook', 'modo ECB', 'pinguim do ECB'], definition: '*Electronic Codebook*: modo de cifra de bloco que cifra cada bloco de forma independente e determinística. Blocos iguais viram cifrados iguais, e os padrões dos dados aparecem — o famoso "pinguim do ECB". Não use.' },
      { term: 'Nonce', aliases: ['nonces', 'IV', 'IVs', 'vetor de inicialização', 'vetores de inicialização', 'number used once'], definition: '*Number used once*: valor que **nunca pode se repetir** num mesmo contexto (com a mesma chave, numa cifra; por resposta, num CSP). Não precisa ser secreto. Em cifras, também chamado de **IV** (vetor de inicialização).' },
      { term: 'Envelope encryption', aliases: ['criptografia envelope', 'cifragem em envelope', 'DEK', 'KEK', 'data encryption key', 'key encryption key'], definition: 'Padrão em que uma **DEK** (chave de dados) cifra os dados localmente e uma **KEK** (chave mestra, guardada num KMS/HSM) cifra só a DEK. Rotacionar a KEK exige recifrar chaves pequenas, não terabytes de dados.' },
      { term: 'CSPRNG', aliases: ['gerador criptograficamente seguro', 'cryptographically secure pseudorandom number generator'], definition: '*Cryptographically Secure PseudoRandom Number Generator*: gerador cujas saídas não podem ser previstas nem com o histórico das anteriores. Em Python: o módulo `secrets` (ou `os.urandom`). O módulo `random` **não** é um.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **criptografia na prática** — sem matemática assustadora, prometo.',
          'O erro mais comum não é quebrar o AES: é usar a **ferramenta errada**. Então vamos começar separando as seis que todo mundo confunde.',
        ],
        board: {
          title: 'Seis ferramentas, seis garantias',
          md: `| Ferramenta | Chave? | Reversível? | O que garante | Em Python |
|---|---|---|---|---|
| **Encoding** (base64, hex, URL) | não | sim, **por qualquer um** | nada — só muda o formato | \`base64.b64encode\` |
| **Hash** (SHA-256) | não | não | **integridade**, se o hash vier de fonte confiável | \`hashlib.sha256\` |
| **HMAC** | segredo compartilhado | não | integridade + **autenticidade** (entre quem tem a chave) | \`hmac.new\` |
| **Cifra simétrica** (AES-GCM) | segredo compartilhado | sim, com a chave | **sigilo** (+ integridade, se AEAD) | lib \`cryptography\` |
| **Cifra assimétrica** (RSA-OAEP, X25519) | par pública/privada | sim, com a privada | sigilo **sem segredo combinado antes** | lib \`cryptography\` |
| **Assinatura digital** (Ed25519) | privada assina, pública verifica | — | integridade + autoria **verificável por qualquer um** (não repúdio) | lib \`cryptography\` |

\`\`\`python
import base64
base64.b64encode(b"senha123")      # b'c2VuaGExMjM='  ← isto NÃO é cifrado
base64.b64decode("c2VuaGExMjM=")   # b'senha123'      ← qualquer um desfaz
\`\`\`

> [!atencao] "A senha está criptografada em base64" é uma frase que aparece em relatório de pentest toda semana. Encoding serve para **transportar** bytes (num JSON, numa URL, num e-mail), nunca para **proteger**.

> [!dica] E senhas de usuário? Nenhuma das seis: senha se guarda com um **hash lento e com salt** (scrypt, bcrypt, Argon2, PBKDF2) — assunto do módulo de senhas. SHA-256 puro é rápido demais: bilhões de tentativas por segundo numa GPU.`,
        },
      },
      {
        type: 'say',
        text: [
          'Começando pelos que a stdlib já traz: **hash** e **HMAC**.',
          'Um hash sozinho não prova quem mandou a mensagem: qualquer um recalcula o SHA-256 de um texto adulterado. Para isso existe o HMAC.',
        ],
        board: {
          title: 'Hash × HMAC',
          md: `| Propriedade de um hash criptográfico | Significa |
|---|---|
| **Resistência à pré-imagem** | dado \`h\`, é inviável achar \`m\` com \`sha256(m) == h\` |
| **Resistência à colisão** | é inviável achar \`m1 ≠ m2\` com o mesmo hash |
| **Efeito avalanche** | mudar 1 bit na entrada muda ~metade dos bits da saída |

| Algoritmo | Situação |
|---|---|
| MD5, SHA-1 | ❌ **colisões práticas** (SHA-1 caiu em 2017, no ataque *SHAttered*) — só para checksums não adversariais |
| SHA-256, SHA-512, SHA-3, BLAKE2 | ✅ |

\`\`\`python
import hashlib, hmac

hashlib.sha256(b"release-1.4.2.tar.gz ...").hexdigest()     # integridade (com hash publicado em canal confiável)

SEGREDO = b"chave-do-webhook-com-32-bytes-ou-mais"
corpo = b'{"pedido": 42, "status": "pago"}'
tag = hmac.new(SEGREDO, corpo, hashlib.sha256).hexdigest()  # quem envia

def webhook_valido(corpo, tag_recebida):                   # quem recebe
    esperada = hmac.new(SEGREDO, corpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, tag_recebida)      # tempo constante
\`\`\`

> [!sabia] Por que não simplesmente \`sha256(SEGREDO + corpo)\`? Por causa do **length extension attack**: em hashes de construção *Merkle–Damgård* (MD5, SHA-1, SHA-256, SHA-512), quem conhece \`H(segredo ‖ msg)\` e o tamanho total consegue calcular \`H(segredo ‖ msg ‖ padding ‖ extra)\` **sem saber o segredo** — e anexar parâmetros à mensagem. Em 2009, Thai Duong e Juliano Rizzo forjaram assim chamadas assinadas da API do **Flickr**. O HMAC, com suas duas passadas de hash, é imune.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora **cifras simétricas**: a mesma chave cifra e decifra. O AES é excelente… desde que você escolha o **modo** certo.',
          'E aqui mora uma das imagens mais famosas da segurança: o **pinguim do ECB**.',
        ],
        board: {
          title: 'AES: o modo importa — ECB e AEAD',
          md: `O AES cifra **blocos de 16 bytes**. O *modo de operação* diz como encadear os blocos de uma mensagem maior. No **ECB**, cada bloco é cifrado sozinho, sempre do mesmo jeito:

\`\`\`python
import hashlib, hmac

def bloco_cifrado(chave, bloco):     # uma "cifra de bloco" de brinquedo, só para a demo
    return hmac.new(chave, bloco, hashlib.sha256).digest()[:16]

def ecb(chave, dados):
    return [bloco_cifrado(chave, dados[i:i + 16]).hex()[:8] for i in range(0, len(dados), 16)]

ecb(b"chave-secreta", b"SALARIO=5000;;;;" * 2 + b"SALARIO=9000;;;;")
# ['e0c25e6e', 'e0c25e6e', '148dd97a']   ← quem não tem a chave vê que 1 e 2 são iguais
\`\`\`

\`\`\`text
 imagem original        cifrada em ECB           cifrada em GCM/CTR
   🐧 contorno    ──▶   🐧 contorno visível  │   ░░░░ ruído uniforme
\`\`\`

O certo hoje é um modo **AEAD** — sigilo **e** integridade no mesmo pacote:

\`\`\`python
# biblioteca "cryptography" (pip install cryptography): fora da stdlib, não roda aqui
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

chave = AESGCM.generate_key(bit_length=256)
aes = AESGCM(chave)
nonce = os.urandom(12)                                    # 96 bits, NOVO a cada mensagem
cifrado = aes.encrypt(nonce, b"CPF 123.456.789-00", b"cliente:42")   # dado associado
registro = nonce + cifrado                                # o nonce não é segredo: vai junto
aes.decrypt(nonce, cifrado, b"cliente:42")                # adulterado? lança InvalidTag
\`\`\`

> [!sabia] O **pinguim do ECB** é a imagem do Tux cifrada em modo ECB: o contorno continua lá, nítido. E não é só teoria: no vazamento da **Adobe em 2013** (cerca de 150 milhões de contas), as senhas estavam **cifradas** com 3DES em modo **ECB**. Senhas iguais geravam cifrados iguais — e, junto com as *dicas de senha* em texto puro, o arquivo virou um gigantesco jogo de palavras cruzadas (o xkcd 1286 fez a piada).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Reparou no \`nonce\` do exemplo? Ele é a peça que mais se erra em cifras modernas.',
          'E ele depende de outra coisa que se erra muito: gerar números **aleatórios de verdade**.',
        ],
        board: {
          title: 'Nonces, IVs e aleatoriedade: secrets × random',
          md: `| Regra do nonce/IV | Se quebrar… |
|---|---|
| **Nunca** repetir com a mesma chave (GCM, CTR, ChaCha20) | \`c1 ⊕ c2 = p1 ⊕ p2\`: o XOR dos textos claros vaza; no GCM, a chave de autenticação também — e o atacante **forja** mensagens |
| Pode ser **público** (vai junto do cifrado) | — |
| Nonce aleatório de 96 bits: no máximo ~2³² mensagens por chave (recomendação do NIST) | o *paradoxo do aniversário* torna uma repetição provável; rotacione a chave antes |
| Em CBC, o IV precisa ser **imprevisível** | ataques como o BEAST (TLS 1.0) |

| | \`random\` | \`secrets\` |
|---|---|---|
| Gerador | Mersenne Twister (determinístico) | CSPRNG do sistema operacional (\`os.urandom\`) |
| Previsível? | **sim**: com a semente ou saídas suficientes | não |
| Use para | simulações, jogos, amostragem, testes com semente | tokens, senhas, chaves, códigos, nonces, salts |

\`\`\`python
import secrets

secrets.token_urlsafe(32)              # 'Xq3...' — 32 bytes (256 bits) em base64url: tokens de sessão/reset
secrets.token_hex(16)                  # 32 caracteres hex
secrets.token_bytes(32)                # chave de HMAC
f"{secrets.randbelow(10**6):06d}"      # código de 6 dígitos uniforme, com zeros à esquerda
secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")   # sorteio seguro de um caractere
\`\`\`

> [!sabia] O Mersenne Twister do \`random\` tem um estado de 624 números de 32 bits — e cada saída é uma transformação **reversível** de um deles. Observando **624 saídas consecutivas** de \`random.getrandbits(32)\`, dá para reconstruir o estado inteiro e prever todos os "sorteios" seguintes. Ferramentas prontas fazem isso em segundos. Tokens de reset gerados com \`random\` são, na prática, sequenciais.`,
        },
      },
      {
        type: 'say',
        text: [
          'E quando as duas pontas **não** combinaram um segredo antes? Entra a criptografia **assimétrica**: um par de chaves, uma pública e uma privada.',
          'Ela serve para duas coisas diferentes: **cifrar** para alguém e **assinar** algo seu.',
        ],
        board: {
          title: 'Assimétrica: cifrar para alguém, assinar o que é seu',
          md: `| Uso | Quem usa a chave **pública** | Quem usa a **privada** | Algoritmos |
|---|---|---|---|
| **Cifrar** / trocar chaves | qualquer um cifra para você | só você decifra | RSA-OAEP, X25519 (ECDH) |
| **Assinar** | qualquer um **verifica** | só você **assina** | Ed25519, ECDSA, RSA-PSS |

\`\`\`python
# biblioteca "cryptography": fora da stdlib, não roda aqui
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

privada = Ed25519PrivateKey.generate()          # fica no servidor de build, num cofre
publica = privada.public_key()                  # vai no site, no README, no app

assinatura = privada.sign(b"release-1.4.2.tar.gz sha256=9f86d0...")
publica.verify(assinatura, b"release-1.4.2.tar.gz sha256=9f86d0...")   # adulterado? InvalidSignature
\`\`\`

| | **HMAC** | **Assinatura digital** |
|---|---|---|
| Chave | um segredo, dos dois lados | privada assina, pública verifica |
| Quem verifica também pode… | **gerar** tags válidas | só verificar |
| Prova para terceiros? | não (os dois lados sabem gerar) | **sim** — não repúdio |
| Custo | microssegundos | bem mais caro |
| Bom para | webhooks, cookies, tokens internos | releases, e-mails, certificados, JWT entre muitos serviços |

> [!dica] Na prática, o assimétrico é caro e limitado em tamanho, então quase tudo é **híbrido**: o TLS usa assimétrico (ECDHE + certificado assinado) para **combinar** uma chave e autenticar o servidor, e depois cifra os dados com **AES-GCM** ou **ChaCha20-Poly1305** — simétrico e rápido.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a regra de ouro: **não invente criptografia**. Nem algoritmo, nem protocolo, nem "combinação esperta".',
          'Não é falta de confiança em você — é que a criptografia falha **em silêncio**. O código funciona, os testes passam… e está quebrado.',
        ],
        board: {
          title: 'Por que não inventar criptografia',
          md: `| Criação caseira | O ataque conhecido | Use no lugar |
|---|---|---|
| XOR com uma chave fixa | XOR de dois cifrados cancela a chave | AEAD (AES-GCM, ChaCha20-Poly1305) |
| \`sha256(segredo + msg)\` como assinatura | *length extension* | \`hmac.new(segredo, msg, sha256)\` |
| Cifrar **sem** autenticar (AES-CBC puro) | *padding oracle*: decifra tudo pelas mensagens de erro | AEAD, ou *encrypt-then-MAC* |
| Comparar tags com \`==\` | *timing attack* | \`hmac.compare_digest\` |
| \`random\` para tokens | previsão do gerador | \`secrets\` |
| Chave derivada de senha com \`sha256(senha)\` | força bruta com GPU | \`hashlib.scrypt\` / \`pbkdf2_hmac\` com salt |
| Nonce fixo ou contador que reinicia | reuso de nonce | nonce aleatório de 96 bits, ou a biblioteca gerando |

**O que usar:** TLS para dados em trânsito; na stdlib, \`hashlib\`, \`hmac\` e \`secrets\`; para cifrar, bibliotecas de alto nível e difíceis de usar errado — \`cryptography\` (\`Fernet\` ou \`AESGCM\`), **libsodium/PyNaCl** (\`SecretBox\`), **Tink**; e para chaves, um **KMS**.

> [!sabia] A **Lei de Schneier** (*Schneier's Law*): "qualquer pessoa, do amador mais sem noção ao melhor criptógrafo, consegue criar um algoritmo que **ela mesma** não consegue quebrar". Não conseguir quebrar o próprio esquema não prova nada; só anos de ataques públicos provam. Um primo dela é o **Cryptographic Doom Principle**, de Moxie Marlinspike (2011): "se você precisa fazer **qualquer** operação criptográfica antes de verificar o MAC de uma mensagem, isso vai, de algum jeito, levar à desgraça" — foi exatamente o que aconteceu com os *padding oracles*.`,
        },
      },
      {
        type: 'say',
        text: [
          'Última peça: **chaves têm ciclo de vida**. Elas vazam, pessoas saem da empresa, algoritmos envelhecem.',
          'Se trocar uma chave exige derrubar o sistema, ninguém troca. Então a rotação precisa ser planejada desde o primeiro dia.',
        ],
        board: {
          title: 'Rotação de chaves e envelope encryption',
          md: `**Versione as chaves.** Todo token ou dado cifrado carrega o **id da chave** (o \`kid\` do JWT faz isso), e o sistema mantém um *chaveiro*: assina com a **atual**, verifica com qualquer chave **ativa**.

\`\`\`text
 fase 1   v1 assina │ v1 verifica
 fase 2   v2 assina │ v1 e v2 verificam       ← tokens antigos continuam valendo
 fase 3   (espera a vida máxima dos tokens v1)
 fase 4   v2 assina │ v2 verifica             ← v1 aposentada
\`\`\`

\`\`\`python
token = "v2." + corpo_b64 + "." + tag_b64    # a versão viaja junto (e é assinada!)
\`\`\`

**Envelope encryption** — como os KMS (AWS KMS, Google Cloud KMS, Vault) cifram volumes enormes:

\`\`\`text
                 KMS / HSM  ── a KEK (chave mestra) nunca sai daqui
                     │   cifra/decifra só chaves pequenas
        ┌────────────┴────────────┐
   DEK_A cifrada             DEK_B cifrada       ← guardadas ao lado dos dados
        │                         │
   dados do cliente A       dados do cliente B   ← cifrados LOCALMENTE com a DEK (AES-GCM)
\`\`\`

1. Gere uma **DEK** (chave de dados) nova — por cliente, arquivo ou tabela.
2. Cifre os dados localmente com a DEK.
3. Peça ao KMS para cifrar a DEK com a **KEK** e guarde a DEK cifrada junto dos dados; descarte a DEK em claro.
4. Para ler: mande a DEK cifrada ao KMS, receba a DEK, decifre localmente.

| Vantagem | Por quê |
|---|---|
| Rotacionar a KEK é barato | recifra só as DEKs (bytes), não os terabytes de dados |
| A chave mestra nunca sai do HSM | vazar o banco não vaza a KEK; todo uso fica em log de auditoria |
| Escala | o KMS não vira gargalo: o volume pesado é cifrado localmente |

> [!sabia] Um efeito colateral valioso é o **crypto-shredding**: para "apagar" os dados de um cliente de **todos** os lugares — inclusive backups e réplicas que você não consegue editar —, basta destruir a DEK dele. Sem a chave, os bytes viram ruído. É uma técnica usada para atender pedidos de exclusão da LGPD/GDPR em sistemas *append-only*.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um chaveiro HMAC com rotação e tokens gerados do jeito certo.', icon: '🎯' },
      {
        type: 'match',
        id: 'sec-cry-q1',
        concept: 'Escolha da ferramenta criptográfica',
        say: 'Aquecimento: para cada necessidade, a ferramenta certa. Associe!',
        prompt: 'Associe cada **necessidade** à **ferramenta** que a resolve.',
        pairs: [
          { left: 'Transportar bytes binários dentro de um JSON', right: 'Encoding (base64)' },
          { left: 'Conferir se o arquivo baixado bate com o valor publicado no site oficial', right: 'Hash (SHA-256)' },
          { left: 'Garantir que o webhook veio de quem conhece o segredo combinado', right: 'HMAC' },
          { left: 'Guardar o CPF cifrado no banco e lê-lo de volta depois', right: 'Cifra simétrica (AES-GCM)' },
          { left: 'Receber dados que só você consegue ler, sem ter combinado um segredo antes', right: 'Cifra assimétrica (chave pública)' },
          { left: 'Provar a qualquer pessoa que o release foi publicado por você', right: 'Assinatura digital (Ed25519)' },
        ],
        explanation: 'A pergunta-chave é **qual garantia** você precisa. *Formato*: encoding (e nenhuma proteção). *Integridade* com um valor de referência confiável: hash. *Integridade + origem* entre duas partes com um segredo: HMAC. *Sigilo*: cifra — simétrica quando as duas pontas já têm a chave, assimétrica quando não. *Autoria verificável por terceiros*: assinatura, porque só o dono da chave privada consegue produzi-la (com HMAC, o receptor também saberia gerar a tag).',
      },
      {
        type: 'mcq',
        id: 'sec-cry-q2',
        concept: 'Modo ECB',
        say: 'Uma auditoria num sistema legado. O que o atacante enxerga?',
        prompt: 'Para "proteger" as fotos de documentos dos clientes, um sistema legado cifra cada imagem com **AES-256 em modo ECB**, usando uma chave aleatória guardada num cofre. O time se defende: *"AES-256 é padrão militar"*. Um atacante que roube os arquivos cifrados (mas não a chave) consegue ver o quê?',
        options: [
          { text: 'Os **padrões** das imagens: no ECB cada bloco de 16 bytes é cifrado sozinho e do mesmo jeito, então blocos iguais geram cifrados iguais — contornos e áreas uniformes continuam visíveis. O conserto é um modo **AEAD** (AES-GCM, ChaCha20-Poly1305) com nonce único.', correct: true, why: 'Exato — é o pinguim do ECB. O AES em si continua forte; o que vaza é a **igualdade** entre blocos, que o modo ECB preserva. Modos como GCM e CTR misturam um nonce/contador em cada bloco, e o resultado parece ruído uniforme.' },
          { text: 'Nada: sem a chave, o AES-256 não vaza informação nenhuma.', why: 'A força do AES não é o problema — o **modo** é. O ECB é determinístico por bloco, então vaza a estrutura dos dados mesmo com uma chave perfeita.' },
          { text: 'Nada de útil, mas convém migrar para AES-512 por garantia.', why: 'AES-512 não existe: o AES tem chaves de 128, 192 ou 256 bits e blocos sempre de 128 bits. E nenhum tamanho de chave conserta o ECB.' },
          { text: 'Só o tamanho dos arquivos — o mesmo que qualquer cifra vazaria.', why: 'O tamanho vaza em quase toda cifra, é verdade. Mas o ECB vaza muito mais: quais blocos se repetem, o que em imagens e dados estruturados revela o conteúdo.' },
        ],
        explanation: 'Uma cifra de bloco (AES) só define como cifrar **16 bytes**; o **modo de operação** decide como tratar mensagens maiores — e é aí que mora o perigo. O ECB é determinístico bloco a bloco: vaza padrões (o pinguim, as senhas iguais da Adobe) e não detecta adulteração (blocos podem ser recortados e reordenados). Modos **AEAD** como AES-GCM e ChaCha20-Poly1305 usam um nonce por mensagem e autenticam o resultado. Melhor ainda: use uma API de alto nível (`Fernet`, `AESGCM`, libsodium), que nem deixa você escolher o modo errado.',
      },
      {
        type: 'mcq',
        id: 'sec-cry-q3',
        concept: 'Não invente criptografia',
        say: 'Revisão de código. O autor garante que está seguro, porque "SHA-256 é seguro". Você aprova?',
        prompt: 'Para autenticar webhooks, o time escreveu:\n\n```python\nassinatura = hashlib.sha256(SEGREDO + corpo).hexdigest()\n```\n\nO receptor recalcula o mesmo valor e compara. *"O segredo está lá dentro e ninguém inverte um SHA-256"*, argumenta o autor. O que você diz na revisão?',
        options: [
          { text: 'Está vulnerável a **length extension**: com `sha256(segredo ‖ corpo)` em mãos, um atacante calcula o hash de `segredo ‖ corpo ‖ padding ‖ extra` sem saber o segredo. Use `hmac.new(SEGREDO, corpo, hashlib.sha256)` e compare com `hmac.compare_digest`.', correct: true, why: 'Exato. SHA-256 é Merkle–Damgård: o hash final **é** o estado interno, então dá para "continuar" o cálculo a partir dele. O HMAC foi desenhado (e provado) para ser um MAC seguro com esses mesmos hashes.' },
          { text: 'Basta trocar por SHA-512, que tem mais bits.', why: 'SHA-512 também é Merkle–Damgård e sofre do mesmo ataque. Mais bits não conserta uma construção errada.' },
          { text: 'Basta pôr o segredo no final: `sha256(corpo + SEGREDO)`.', why: 'Isso evita a extensão de comprimento, mas é outra construção improvisada: a segurança passa a depender da resistência a **colisões** do hash (achar dois corpos com o mesmo hash permite trocar um pelo outro). O HMAC existe justamente para você não precisar desse raciocínio.' },
          { text: 'O único problema é o `hexdigest()`: com `digest()` binário fica seguro.', why: 'Hex ou binário é só **encoding** da mesma saída — não muda nada na segurança. O problema é a construção `hash(segredo + mensagem)`.' },
        ],
        explanation: 'Este é o exemplo perfeito de **não invente criptografia**: cada peça é segura (SHA-256, um segredo forte), mas a **combinação** caseira não é. Em 2009, a API do Flickr assinava chamadas com `MD5(segredo + argumentos)` e caiu exatamente com *length extension*. A regra prática: para autenticar mensagens com um segredo, use **HMAC** (RFC 2104) — ou um MAC com chave nativa, como o BLAKE2 com `key=` (`hashlib.blake2b(msg, key=segredo)`). E sempre compare com `hmac.compare_digest`, em tempo constante.',
      },
      {
        type: 'code',
        id: 'sec-cry-q4',
        concept: 'HMAC com rotação de chaves',
        title: 'Chaveiro HMAC com versão de chave',
        say: 'Agora é com você: assinar e verificar mensagens com HMAC — e trocar a chave sem invalidar tudo de uma vez.',
        prompt: `Implemente a classe \`Chaveiro\`, que assina mensagens com HMAC-SHA256 e suporta **rotação de chaves**:

- \`Chaveiro(chaves, atual)\`: \`chaves\` é um dict \`{versao: chave_em_bytes}\` e \`atual\` é a versão usada para **assinar**. Se \`atual\` não estiver em \`chaves\`, lance \`ValueError\`.
- \`assinar(mensagem: bytes) -> str\`: devolve \`"<versao>.<msg>.<tag>"\`, onde \`<msg>\` é a mensagem em **base64url sem padding** e \`<tag>\` é o HMAC-SHA256 (com a chave da versão atual) do texto \`"<versao>.<msg>"\`, também em base64url sem padding. A versão faz parte do que é assinado.
- \`verificar(token: str) -> bytes\`: devolve a mensagem original se o token for válido para **qualquer versão ativa**. Senão, lance \`AssinaturaInvalida\` — formato errado, versão desconhecida ou aposentada, base64 inválido, tag errada — e **nunca** outra exceção. Compare com \`hmac.compare_digest\`.
- \`rotacionar(versao, chave)\`: adiciona a chave nova e passa a assinar com ela. Versão que já existe → \`ValueError\`.
- \`aposentar(versao)\`: remove a chave; tokens dela deixam de valer. Aposentar a versão **atual** (ou uma inexistente) → \`ValueError\`.`,
        starter: `import base64
import hashlib
import hmac


class AssinaturaInvalida(Exception):
    """Token malformado, de versão desconhecida/aposentada ou com assinatura errada."""


class Chaveiro:
    def __init__(self, chaves, atual):
        # TODO: guarde as chaves e a versão atual (valide!)
        pass

    def assinar(self, mensagem):
        # TODO: "<versao>.<b64url(mensagem)>.<b64url(tag)>"
        pass

    def verificar(self, token):
        # TODO: devolva a mensagem ou lance AssinaturaInvalida
        pass

    def rotacionar(self, versao, chave):
        # TODO
        pass

    def aposentar(self, versao):
        # TODO
        pass
`,
        tests: [
          {
            name: 'assinar: formato versao.mensagem.tag, com a chave atual',
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
obtido = c.assinar(b"pedido=42;valor=100")
esperado = _token("v1", b"pedido=42;valor=100", K1)
assert isinstance(obtido, str), f"assinar deve devolver str, veio {type(obtido).__name__}"
assert obtido == esperado, f"token: {obtido!r}\\nesperado: {esperado!r}\\n(base64url sem '='? a tag é sobre 'v1.<msg>'?)"`,
          },
          {
            name: 'verificar devolve a mensagem (inclusive vazia, com pontos e binária)',
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
for msg in [b"ola", b"", b"a.b.c", bytes(range(256))]:
    obtido = c.verificar(c.assinar(msg))
    assert obtido == msg, f"ida e volta de {msg[:20]!r}: veio {obtido[:20] if isinstance(obtido, bytes) else obtido!r}"
assert c.verificar(_token("v1", b"feito por fora", K1)) == b"feito por fora"`,
          },
          {
            name: 'mensagem ou tag adulterada → AssinaturaInvalida',
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
v, m, t = c.assinar(b"valor=100").split(".")
_rejeita(c, f"{v}.{_b64(b'valor=1')}.{t}", "mensagem trocada mantendo a tag antiga")
outra_tag = _token("v1", b"valor=100", K3).split(".")[2]
_rejeita(c, f"{v}.{m}.{outra_tag}", "tag calculada com outra chave")`,
          },
          {
            name: 'rotação: tokens antigos continuam válidos; novos saem com a versão nova',
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
antigo = c.assinar(b"antes")
c.rotacionar("v2", K2)
novo = c.assinar(b"depois")
assert novo == _token("v2", b"depois", K2), f"depois de rotacionar, assine com v2: {novo!r}"
assert c.verificar(antigo) == b"antes", "o token v1 ainda deveria valer (v1 continua ativa)"
assert c.verificar(novo) == b"depois"`,
          },
          {
            name: 'aposentar: tokens da versão aposentada são rejeitados',
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
antigo = c.assinar(b"antes")
c.rotacionar("v2", K2)
novo = c.assinar(b"depois")
c.aposentar("v1")
_rejeita(c, antigo, "token assinado com a versão aposentada v1")
assert c.verificar(novo) == b"depois", "o token v2 continua valendo"`,
          },
          {
            name: 'versão desconhecida ou trocada → AssinaturaInvalida (nunca KeyError)',
            hidden: true,
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1, "v2": K2}, "v2")
_rejeita(c, _token("v9", b"x", K1), "versão v9 desconhecida")
_rejeita(c, _token("v2", b"x", K1), "assinado com a chave v1, mas rotulado como v2")
_rejeita(c, _token("__class__", b"x", K1), "versão '__class__'")`,
          },
          {
            name: 'tokens malformados → AssinaturaInvalida (nunca outra exceção)',
            hidden: true,
            code: AUX_CHAVEIRO + `
c = Chaveiro({"v1": K1}, "v1")
valido = c.assinar(b"ok")
casos = ["", "v1", "v1.abc", "..", "v1..", "v1.a.b.c", valido + ".extra",
         "v1.!!!.@@@", "v1.é.ção", "v1." + _b64(b"ok") + ".curta"]
for caso in casos:
    _rejeita(c, caso, f"token malformado {caso[:30]!r}")`,
          },
          {
            name: 'regras do chaveiro: atual inexistente, versão repetida e aposentar a atual → ValueError',
            hidden: true,
            code: AUX_CHAVEIRO + `
_value_error(Chaveiro, {"v1": K1}, "v2", motivo="Chaveiro com atual='v2' fora do dict")
c = Chaveiro({"v1": K1}, "v1")
_value_error(c.rotacionar, "v1", K3, motivo="rotacionar para uma versão que já existe (sobrescreveria a chave!)")
_value_error(c.aposentar, "v1", motivo="aposentar a versão atual (ninguém mais conseguiria assinar)")
_value_error(c.aposentar, "v7", motivo="aposentar uma versão inexistente")
assert c.verificar(c.assinar(b"ainda funciona")) == b"ainda funciona"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou as tags sem `hmac.compare_digest`. O `==` para no **primeiro byte diferente**, e o tempo de resposta vaza quantos bytes o atacante já acertou (*timing attack*) — com medições suficientes, ele monta uma tag válida byte a byte. O `compare_digest` leva o mesmo tempo, acertando ou errando.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Assim, um bug **seu** vira silenciosamente "assinatura inválida". Capture só o que a decodificação lança: `binascii.Error` e o erro de texto não ASCII são subclasses de `ValueError`.',
            concept: 'Tratamento de exceções',
          },
          {
            when: m => m.imports.includes('random'),
            text: 'O módulo `random` não tem lugar num código de assinatura: ele é previsível. Se algum dia precisar gerar chaves, use `secrets.token_bytes(32)`.',
            concept: 'CSPRNG',
          },
        ],
        hints: [
          '**base64url:** `base64.urlsafe_b64encode(dados).rstrip(b"=").decode()`. Na volta, recoloque o padding (`texto + "=" * (-len(texto) % 4)`) e use `base64.urlsafe_b64decode`, transformando `ValueError` em `AssinaturaInvalida`.',
          '**assinar:** `corpo = f"{versao}.{b64(mensagem)}"` e `tag = hmac.new(chave, corpo.encode(), hashlib.sha256).digest()`. O token é `corpo + "." + b64(tag)`.',
          '**verificar, nesta ordem:** 3 partes? → versão está no chaveiro? → recalcule a tag sobre `"<versao>.<msg>"` **como chegou** e compare os **bytes** com `hmac.compare_digest` (comparar `str` com caracteres não ASCII lança `TypeError`) → só então decodifique a mensagem.',
        ],
        solution: `import base64
import hashlib
import hmac


class AssinaturaInvalida(Exception):
    """Token malformado, de versão desconhecida/aposentada ou com assinatura errada."""


def _b64(dados):
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _unb64(texto):
    try:
        return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))
    except ValueError as erro:            # binascii.Error e texto não ASCII
        raise AssinaturaInvalida("base64url inválido") from erro


class Chaveiro:
    def __init__(self, chaves, atual):
        if atual not in chaves:
            raise ValueError(f"a versão atual {atual!r} não está no chaveiro")
        self._chaves = dict(chaves)       # cópia: ninguém altera por fora
        self._atual = atual

    def _tag(self, versao, corpo):
        return hmac.new(self._chaves[versao], corpo.encode(), hashlib.sha256).digest()

    def assinar(self, mensagem):
        corpo = f"{self._atual}.{_b64(mensagem)}"
        return f"{corpo}.{_b64(self._tag(self._atual, corpo))}"

    def verificar(self, token):
        partes = token.split(".")
        if len(partes) != 3:
            raise AssinaturaInvalida("formato esperado: versao.mensagem.tag")
        versao, msg64, tag64 = partes
        if versao not in self._chaves:
            raise AssinaturaInvalida("versão de chave desconhecida ou aposentada")
        esperada = self._tag(versao, f"{versao}.{msg64}")        # sobre o texto RECEBIDO
        if not hmac.compare_digest(esperada, _unb64(tag64)):
            raise AssinaturaInvalida("assinatura inválida")
        return _unb64(msg64)                                     # só agora é confiável

    def rotacionar(self, versao, chave):
        if versao in self._chaves:
            raise ValueError(f"a versão {versao!r} já existe")
        self._chaves[versao] = chave
        self._atual = versao

    def aposentar(self, versao):
        if versao == self._atual or versao not in self._chaves:
            raise ValueError(f"não é possível aposentar {versao!r}")
        del self._chaves[versao]
`,
        solutionExplanation: 'O token carrega a **versão da chave** — o mesmo papel do `kid` num JWT —, e a versão entra no texto assinado, então não dá para trocá-la sem invalidar a tag. Na verificação, a ordem importa: formato → versão **ativa** (uma consulta a um dict, sem `KeyError`) → tag recalculada sobre o texto **exatamente como chegou**, comparada em **bytes** com `hmac.compare_digest` → só então a mensagem é decodificada e devolvida. A rotação segue as fases da aula: `rotacionar` passa a assinar com a chave nova, mas a antiga continua verificando; depois que os tokens antigos expiram, `aposentar` a remove. As travas (`ValueError`) impedem os dois acidentes clássicos: sobrescrever uma chave em uso (todos os tokens dela quebram de uma vez) e aposentar a chave com que se assina. Em produção, as chaves viriam de um KMS ou cofre de segredos, geradas com `secrets.token_bytes(32)`.',
      },
      {
        type: 'code',
        id: 'sec-cry-q5',
        concept: 'Tokens seguros com secrets',
        title: 'Tokens e códigos do jeito certo',
        say: 'Agora os tokens do dia a dia: link de redefinição de senha e código de verificação. Aleatoriedade de verdade, e o banco guardando só o hash.',
        prompt: `Implemente, com o módulo \`secrets\` (e \`hashlib\`/\`hmac\`):

- \`gerar_token(nbytes=32) -> str\`: token **URL-safe** com \`nbytes\` bytes aleatórios de um CSPRNG (32 bytes → 43 caracteres).
- \`gerar_codigo(digitos=6) -> str\`: código numérico com exatamente \`digitos\` dígitos, **uniforme** em todo o intervalo — de \`"000000"\` a \`"999999"\`, zeros à esquerda incluídos.
- \`emitir_reset(agora, validade=900) -> (token, registro)\`: gera um token de redefinição de senha e devolve o registro que vai para o banco: \`{"hash": <SHA-256 hex do token>, "expira_em": agora + validade, "usado": False}\`. O banco **nunca** guarda o token em si.
- \`usar_reset(recebido, registro, agora) -> bool\`: \`True\` só se o SHA-256 de \`recebido\` bate com o hash (compare com \`hmac.compare_digest\`), \`agora < expira_em\` e o registro ainda não foi usado. Quando der certo, marque \`registro["usado"] = True\` (**uso único**). Um token errado **não** gasta o registro.

Os testes chamam \`random.seed(...)\` antes de gerar tokens: se eles saírem iguais duas vezes, o seu gerador é previsível.`,
        starter: `import hashlib
import hmac
import random


def gerar_token(nbytes=32):
    alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    return "".join(random.choice(alfabeto) for _ in range(43))     # 🤔


def gerar_codigo(digitos=6):
    return str(random.randint(100000, 999999))                      # 🤔


def emitir_reset(agora, validade=900):
    # TODO: (token, {"hash": ..., "expira_em": ..., "usado": False})
    pass


def usar_reset(recebido, registro, agora):
    # TODO
    pass
`,
        tests: [
          {
            name: 'gerar_token: tamanho e alfabeto URL-safe',
            code: AUX_TOKENS + `
t = gerar_token()
assert isinstance(t, str), f"gerar_token deve devolver str, veio {type(t).__name__}"
assert len(t) == 43, f"32 bytes em base64url sem padding têm 43 caracteres; veio {len(t)}"
assert set(t) <= ALFABETO_URL, f"caracteres fora do alfabeto URL-safe: {set(t) - ALFABETO_URL}"
assert len(gerar_token(16)) == 22, f"gerar_token(16) deveria ter 22 caracteres, veio {len(gerar_token(16))}"`,
          },
          {
            name: 'random.seed não pode tornar tokens e códigos reproduzíveis',
            code: AUX_TOKENS + `
import random
random.seed(2024)
tokens_a = [gerar_token() for _ in range(3)]
codigos_a = [gerar_codigo() for _ in range(5)]
random.seed(2024)
tokens_b = [gerar_token() for _ in range(3)]
codigos_b = [gerar_codigo() for _ in range(5)]
assert tokens_a != tokens_b, "com a mesma semente do random, os tokens se repetiram: o gerador é PREVISÍVEL. Use secrets."
assert codigos_a != codigos_b, "com a mesma semente do random, os códigos se repetiram: o gerador é PREVISÍVEL. Use secrets."`,
          },
          {
            name: 'gerar_codigo: só dígitos, tamanho exato e zeros à esquerda possíveis',
            code: AUX_TOKENS + `
codigos = [gerar_codigo() for _ in range(3000)]
for c in codigos:
    assert isinstance(c, str) and len(c) == 6 and set(c) <= DIGITOS, f"código inválido: {c!r}"
assert any(c.startswith("0") for c in codigos), "em 3000 códigos, nenhum começou com 0: o intervalo não é uniforme (\\"012345\\" é um código válido!)"
for n in (4, 8):
    c = gerar_codigo(n)
    assert len(c) == n and set(c) <= DIGITOS, f"gerar_codigo({n}) = {c!r}"`,
          },
          {
            name: 'emitir_reset: o registro guarda só o hash',
            code: AUX_TOKENS + `
token, registro = emitir_reset(1000)
assert isinstance(token, str) and len(token) >= 43, f"o token de reset deveria ter pelo menos 256 bits (43 caracteres), veio {token!r}"
assert registro == {"hash": _sha(token), "expira_em": 1900, "usado": False}, f"registro: {registro!r}"
assert token not in repr(registro), "o token em si não pode ir para o banco"
assert emitir_reset(0, validade=60)[1]["expira_em"] == 60`,
          },
          {
            name: 'usar_reset: vale uma vez só; token errado é recusado',
            code: AUX_TOKENS + `
token, registro = emitir_reset(1000)
assert usar_reset(gerar_token(), registro, 1001) is False, "token errado deveria ser recusado"
assert usar_reset(token, registro, 1001) is True, "token certo, dentro do prazo, deveria ser aceito"
assert registro["usado"] is True, "depois do uso, marque registro['usado'] = True"
assert usar_reset(token, registro, 1002) is False, "o mesmo token não pode ser usado duas vezes"`,
          },
          {
            name: 'expiração: no instante exato do expira_em já não vale',
            hidden: true,
            code: AUX_TOKENS + `
token, registro = emitir_reset(1000)
assert usar_reset(token, registro, 1900) is False, "agora == expira_em: já expirou (a regra é agora < expira_em)"
assert registro["usado"] is False, "uma tentativa expirada não deve marcar o registro como usado"
token, registro = emitir_reset(1000)
assert usar_reset(token, registro, 1899) is True, "1 s antes de expirar ainda vale"`,
          },
          {
            name: 'token errado não gasta o registro',
            hidden: true,
            code: AUX_TOKENS + `
token, registro = emitir_reset(1000)
for _ in range(3):
    assert usar_reset("chute-" + gerar_token(), registro, 1001) is False
assert registro["usado"] is False, "tentativas erradas não podem marcar o registro como usado"
assert usar_reset(token, registro, 1001) is True, "o dono do token ainda deveria conseguir usá-lo"`,
          },
          {
            name: 'gerar_codigo cobre o intervalo todo de forma uniforme',
            hidden: true,
            code: AUX_TOKENS + `
from collections import Counter
primeiros = Counter(gerar_codigo()[0] for _ in range(5000))
for d in "0123456789":
    assert primeiros[d] >= 300, f"o primeiro dígito {d!r} apareceu só {primeiros[d]} vezes em 5000 (esperado ~500): distribuição enviesada"`,
          },
          {
            name: '1000 tokens seguidos, nenhum repetido',
            hidden: true,
            code: AUX_TOKENS + `
tokens = [gerar_token() for _ in range(1000)]
assert len(set(tokens)) == 1000, "houve tokens repetidos"`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('random'),
            text: 'O `import random` continua no seu código. Mesmo que não seja usado para os tokens, ele é um convite para alguém usá-lo depois. O `random` é um Mersenne Twister: **determinístico**, e previsível depois de 624 saídas. Para qualquer coisa que proteja algo — tokens, códigos, senhas, nonces —, `secrets`.',
            concept: 'CSPRNG',
          },
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou os hashes com `==`. Aqui o risco é menor (compara-se o **hash** do token, não o token), mas o hábito certo é sempre `hmac.compare_digest` para segredos e derivados — em tempo constante, sem vazar quantos caracteres bateram.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.imports.includes('time') || m.imports.includes('datetime'),
            text: 'O relógio já chega por parâmetro (`agora`). Ler `time.time()` ou `datetime.now()` por dentro deixa o código difícil de testar — como provar que o token expira no segundo exato sem esperar 15 minutos?',
            concept: 'Injeção de relógio',
          },
        ],
        hints: [
          '`secrets.token_urlsafe(nbytes)` já devolve base64url sem padding. Para o código: `secrets.randbelow(10 ** digitos)` sorteia de 0 a 999999, e `f"{n:0{digitos}d}"` completa com zeros à esquerda.',
          'O registro guarda `hashlib.sha256(token.encode()).hexdigest()`. Como o token tem 256 bits aleatórios, um hash rápido basta aqui (diferente de senhas humanas).',
          'Em `usar_reset`, recuse primeiro se `registro["usado"]` ou `agora >= registro["expira_em"]`; depois compare os hashes com `hmac.compare_digest`; só no sucesso marque `usado = True`.',
        ],
        solution: `import hashlib
import hmac
import secrets


def gerar_token(nbytes=32):
    return secrets.token_urlsafe(nbytes)


def gerar_codigo(digitos=6):
    return f"{secrets.randbelow(10 ** digitos):0{digitos}d}"


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def emitir_reset(agora, validade=900):
    token = gerar_token()
    return token, {"hash": _hash(token), "expira_em": agora + validade, "usado": False}


def usar_reset(recebido, registro, agora):
    if registro["usado"] or agora >= registro["expira_em"]:
        return False
    if not hmac.compare_digest(_hash(recebido), registro["hash"]):
        return False
    registro["usado"] = True                  # uso único
    return True
`,
        solutionExplanation: 'Tudo que protege algo vem do **`secrets`**, o CSPRNG do sistema operacional — a semente do `random` não o afeta, e as saídas passadas não ajudam a prever as próximas. `token_urlsafe(32)` dá 256 bits, impossíveis de adivinhar. O código de 6 dígitos usa `randbelow(10**6)` com zeros à esquerda: `randint(100000, 999999)` desperdiça 10% do espaço, e truques como `n % 10**6` sobre um número aleatório introduzem viés. O banco guarda só o **SHA-256** do token: se vazar, os links de reset não podem ser usados. Um hash rápido basta porque o token tem alta entropia (para senhas humanas, seria scrypt/Argon2). E o token é de **uso único**, com expiração injetada (`agora`) e verificada com `<`, e tentativas erradas não gastam o registro. Em produção, some a isso um limite de tentativas: 6 dígitos são só um milhão de possibilidades.',
      },
      {
        type: 'open',
        id: 'sec-cry-q6',
        concept: 'Gestão de chaves',
        say: 'Última: uma consultoria. Me convença do seu plano.',
        prompt: 'Uma empresa guarda documentos de clientes cifrados com **uma única chave AES**, escrita no arquivo de configuração do repositório. Ela precisa trocar essa chave (um ex-funcionário teve acesso) e quer um desenho que torne a próxima troca simples. O que você propõe?',
        minWords: 40,
        rubric: [
          { label: 'Tira a chave do repositório: **KMS/HSM** ou cofre de segredos', keywords: ['kms', 'hsm', 'cofre', 'vault', 'secret manager', 'secrets manager', 'gerenciador de segredo', 'key management', 'fora do repositorio', 'fora do codigo', 'fora da config', 'fora do arquivo'], concept: 'Gestão de segredos', why: 'Chave em arquivo de configuração versionado vaza com o repositório, com backups e com qualquer pessoa que já teve acesso. Um KMS/HSM guarda a chave mestra, controla quem a usa e registra cada uso.' },
          { label: 'Usa **envelope encryption** (DEK cifra os dados, KEK cifra a DEK)', keywords: ['envelope', 'dek', 'kek', 'chave de dados', 'data key', 'chave mestra', 'master key', 'chave por cliente', 'chave por documento', 'chave por arquivo'], concept: 'Envelope encryption', why: 'Com DEKs por cliente/documento e uma KEK no KMS, trocar a KEK significa recifrar só as DEKs — e a chave mestra nunca sai do HSM.' },
          { label: 'Planeja **versões** de chave e rotação sem downtime (recifrar os dados antigos)', keywords: ['versao', 'versoes', 'versiona', 'kid', 'key id', 'id da chave', 'rotac', 'rewrap', 're-wrap', 'recifr', 're-cifr', 'reencrypt', 'chave antiga', 'duas chaves', 'migra'], concept: 'Rotação de chaves', why: 'Cada dado cifrado precisa dizer com qual chave foi cifrado; assim, a chave nova passa a cifrar, a antiga só decifra até os dados serem migrados, e então é destruída.' },
          { label: 'Cifra com **AEAD**/nonce único e biblioteca madura, sem inventar', keywords: ['aead', 'gcm', 'chacha', 'poly1305', 'nonce', 'fernet', 'biblioteca', 'autenticad', 'libsodium', 'nacl', 'tink', 'nao inventar', 'nao invente'], concept: 'AEAD', why: 'O desenho novo precisa cifrar do jeito certo: modo autenticado (AES-GCM, ChaCha20-Poly1305), nonce único por operação e uma API de alto nível que não deixe errar.' },
        ],
        modelAnswer: `Primeiro, a emergência: a chave atual está comprometida, então gero uma chave nova e **recifro** todos os documentos, removendo a antiga do repositório (e do histórico do git) e destruindo-a quando a migração terminar.

Para o desenho novo, a chave sai do código e vai para um **KMS** (ou HSM/cofre de segredos): a aplicação nunca vê a chave mestra, o acesso é controlado por identidade e todo uso fica em log de auditoria.

Uso **envelope encryption**: cada cliente (ou documento) tem sua **DEK**, gerada pelo KMS; os dados são cifrados localmente com a DEK, e a DEK é guardada cifrada pela **KEK** do KMS, ao lado dos dados. Bônus: apagar a DEK de um cliente "apaga" os dados dele até dos backups (crypto-shredding).

Toda DEK cifrada carrega a **versão** (id) da KEK que a cifrou. Rotacionar vira rotina: a versão nova da KEK passa a cifrar DEKs novas, as antigas continuam decifrando, um job faz o *re-wrap* das DEKs existentes — só bytes, não os documentos — e a versão velha é aposentada.

Por fim, a cifra dos documentos usa um modo **AEAD** (AES-GCM) com **nonce** único por operação, via biblioteca madura (\`cryptography\`/Tink) — nada de montar a criptografia na mão.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Arrasou! Agora você sabe escolher a ferramenta, e sabe que o perigo mora nos detalhes: o modo, o nonce, o gerador, a comparação.',
          { text: 'Resumo: base64 não protege, HMAC autentica, AEAD cifra, assinatura prova autoria — tudo com secrets, chaves versionadas, e nada de criptografia caseira.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
