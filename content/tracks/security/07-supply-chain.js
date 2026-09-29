(function () {
  // Nos testes, os "segredos" são montados por concatenação: assim este arquivo de conteúdo
  // não contém nenhum token literal que dispare um secret scanner de verdade (ironia evitada).
  const SEGREDOS_AUX = `AWS = "AKIA" + "IOSFODNN7EXAMPLE"
ASIA = "ASIA" + "Q3EXAMPLE7KEY2XY"
SUFIXO_GH = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"
GH = "gh" + "p_" + SUFIXO_GH
PEM = "-----BEGIN " + "RSA PRIVATE KEY-----"
SEGREDO_AWS = "wJalrXUtnFEMI/K7MDENG/" + "bPxRfiCYEXAMPLEKEY"
SENHA_BANCO = "q8Zr2LmX0vTa7" + "KcN4pWd9FhJ"
`;

  const POPULARES = `POPULARES = ["requests", "numpy", "django", "python-dateutil", "urllib3", "jellyfish", "PyYAML", "boto", "boto3"]
`;

  Game.registerModule('security', {
    id: 'supply-chain',
    title: 'Segredos e cadeia de suprimentos',
    kind: 'lesson',
    level: 2,
    order: 31,
    unit: 'pratica',
    summary: 'O código que você escreve é a menor parte do que vai para produção: segredos fora do repositório, dependências fixadas com hash, typosquatting, dependency confusion, SBOM, SLSA e CVEs — com um detector de segredos e um caçador de typosquatting escritos por você.',
    concepts: ['Gestão de segredos', 'Secret scanning', 'Pinning e lock files', 'Typosquatting e dependency confusion', 'SBOM, SLSA e CVEs'],
    takeaways: [
      'Segredo **nunca** no código: variáveis de ambiente no mínimo, **cofre** (auditoria, rotação) no ideal — e identidade de workload (OIDC) para nem existir segredo de longa duração.',
      'Segredo vazado é segredo **revogado**: rotacione primeiro, limpe o histórico depois. Scanners (regex de formatos conhecidos + **entropia**) no pre-commit e no CI evitam o vazamento.',
      'Aplicação usa **lock file com hashes** (inclusive as dependências transitivas); biblioteca declara faixas. Pinning exige atualização contínua (Dependabot, Renovate).',
      '**Typosquatting** explora o dedo de quem digita; **dependency confusion** explora o resolvedor (`--extra-index-url` + versão maior). Defesas: índice único, nomes reservados e hashes.',
      '**SBOM** diz o que há dentro do artefato; **SLSA**, como ele foi construído. CVSS mede a gravidade; **EPSS** e o catálogo **KEV** mostram o que está sendo explorado de fato.',
    ],
    glossary: [
      { term: 'Typosquatting', aliases: ['typosquat', 'typosquats', 'slopsquatting'], definition: 'Publicar um pacote malicioso com nome **quase igual** ao de um popular (`reqeusts`, `python3-dateutil`) esperando um erro de digitação. A variante *slopsquatting* registra nomes que LLMs costumam **alucinar**.' },
      { term: 'Dependency confusion', aliases: ['confusão de dependências', 'confusao de dependencias', 'dependency substitution', 'substitution attack'], definition: 'Ataque em que alguém publica no registro **público** um pacote com o nome de um pacote **interno** e uma versão maior. Se o instalador consulta os dois índices, escolhe a versão do atacante. Demonstrado por Alex Birsan em 2021.' },
      { term: 'SBOM', aliases: ['SBOMs', 'Software Bill of Materials', 'lista de materiais de software'], definition: '*Software Bill of Materials*: inventário legível por máquina de **todos** os componentes (e versões) de um artefato, nos formatos **SPDX** ou **CycloneDX**. Responde em minutos a "estamos expostos à CVE X?".' },
      { term: 'SLSA', aliases: ['Supply-chain Levels for Software Artifacts'], definition: '*Supply-chain Levels for Software Artifacts* (pronuncia-se "salsa"), da OpenSSF: níveis de garantia sobre **como** um artefato foi construído — de "sem proveniência" (L0) a build isolado com proveniência assinada e não forjável (L3).' },
      { term: 'Lock file', aliases: ['lock files', 'lockfile', 'lockfiles', 'arquivo de lock', 'uv.lock', 'poetry.lock'], definition: 'Arquivo gerado que fixa a versão **exata** de todas as dependências, inclusive as transitivas — de preferência com o **hash** de cada pacote —, para que todo build instale os mesmos bytes.' },
      { term: 'CVE', aliases: ['CVEs', 'Common Vulnerabilities and Exposures'], definition: '*Common Vulnerabilities and Exposures*: identificador público de uma vulnerabilidade conhecida, como `CVE-2021-44228` (Log4Shell). A gravidade costuma vir no **CVSS** (0–10); a chance de exploração, no **EPSS**.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Pergunta rápida: quanto do código que roda na sua produção foi **você** que escreveu?',
          'Spoiler: bem pouco. O resto veio de dependências, do CI, de imagens base… e cada elo dessa **cadeia de suprimentos** é uma porta de entrada.',
        ],
        board: {
          title: 'A cadeia de suprimentos de software',
          md: `\`\`\`text
 código-fonte ──▶ dependências ──▶ build (CI) ──▶ artefato ──▶ registro ──▶ deploy
      │                │               │              │            │
  segredo          pacote          runner ou      binário      imagem ou
  commitado        malicioso       script         adulterado   pacote trocado
                   ou vulnerável   comprometido
\`\`\`

Estimativas do setor dizem que **70–90%** do código de uma aplicação moderna vem de open source. Atacar um elo compartilhado rende milhares de vítimas de uma vez.

| Ano | Incidente | Elo atacado |
|---|---|---|
| 2018 | **event-stream** (npm) | um "mantenedor" novo adicionou uma dependência que roubava carteiras de bitcoin |
| 2020 | **SolarWinds** (SUNBURST) | o **build**: um backdoor injetado na compilação saiu assinado, como atualização oficial |
| 2021 | **Codecov** | um script de upload adulterado copiou as **variáveis de ambiente** (segredos!) dos CIs dos clientes |
| 2021 | **Log4Shell** (\`CVE-2021-44228\`) | uma dependência vulnerável em todo lugar — e ninguém sabia **onde** usava |
| 2024 | **xz utils** (\`CVE-2024-3094\`) | um backdoor inserido por um "colaborador" após ~2 anos de engenharia social |

> [!sabia] O backdoor do **xz** foi descoberto quase por acaso: Andres Freund, desenvolvedor do PostgreSQL, estranhou que logins SSH numa máquina de testes gastavam CPU demais e demoravam **cerca de meio segundo** a mais. Puxando esse fio, achou código malicioso escondido em arquivos de teste binários da biblioteca de compressão — semanas antes de ele chegar às versões estáveis das grandes distribuições.`,
        },
      },
      {
        type: 'say',
        text: [
          'O elo mais frágil costuma ser o mais bobo: um **segredo** colado no código.',
          'Senha de banco, chave de API, token de CI — nada disso pode morar no repositório. Nem "só por enquanto".',
        ],
        board: {
          title: 'Segredos: onde (não) guardar',
          md: `| Onde | Veredito | Por quê |
|---|---|---|
| No código ou num \`.env\` commitado | ❌ | vai para todo clone, fork, backup e log de CI — e fica **para sempre** no histórico do git |
| Variável de ambiente | ✅ o mínimo | fora do código; mas vaza em dumps de erro, \`docker inspect\`, \`/proc/<pid>/environ\` e logs de CI |
| **Cofre** (Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault) | ✅✅ | controle de acesso, **auditoria**, **rotação** e até segredos dinâmicos de curta duração |
| **Identidade de workload** (OIDC) | 🏆 | nenhum segredo de longa duração: a plataforma atesta quem é o processo e recebe credenciais temporárias |

\`\`\`python
import os

def exigir(nome):
    valor = os.environ.get(nome)
    if not valor:                         # falha cedo, no boot — e não na 1ª requisição
        raise RuntimeError(f"variável de ambiente {nome} não definida")
    return valor

DB_PASSWORD = exigir("DB_PASSWORD")
# ❌ logger.info(f"conectando com {DB_PASSWORD}")   ← segredo em log também é vazamento
\`\`\`

**Rotação** é o teste de maturidade: se trocar um segredo exige um deploy manual numa sexta à noite, ninguém troca. Planeje **duas credenciais válidas ao mesmo tempo** (a antiga e a nova) para girar sem downtime — e automatize.

> [!atencao] Apagou o arquivo e fez um commit novo? O segredo continua no histórico (\`git log -p\`). Reescrever o histórico não adianta se alguém já clonou — ou se um robô já coletou. **Segredo vazado é segredo revogado.**

> [!sabia] Se o app busca os segredos num cofre, com **qual credencial** ele se autentica no cofre? É o problema do **segredo zero** (*secret zero*). A saída moderna é a identidade de workload: Kubernetes, AWS ou o GitHub Actions (via **OIDC**) atestam quem é o processo, e o cofre ou a nuvem confiam nessa atestação. Não existe senha inicial para vazar.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Como uma ferramenta acha um segredo perdido no meio de milhares de linhas? Com duas técnicas complementares.',
          'Padrões conhecidos pegam os formatos famosos; **entropia** pega o resto — strings que "parecem aleatórias demais".',
        ],
        board: {
          title: 'Secret scanning: regex + entropia',
          md: `**1. Padrões conhecidos** — precisos, quase sem falso positivo:

| Segredo | Formato |
|---|---|
| AWS access key id | \`AKIA\` ou \`ASIA\` + 16 caracteres \`[A-Z0-9]\` |
| Token do GitHub | \`ghp_\`, \`gho_\`, \`ghu_\`, \`ghs_\`, \`ghr_\` + 36 caracteres alfanuméricos |
| Chave privada | \`-----BEGIN … PRIVATE KEY-----\` |

**2. Entropia de Shannon** — quantos bits de "surpresa" cada caractere carrega:

\`\`\`text
H = Σ p(c) · log₂(1 / p(c))      (soma sobre cada caractere distinto c do texto)
\`\`\`

| Texto | H (bits/caractere) |
|---|---|
| \`aaaaaaaa\` | 0,0 |
| \`senha123\` (8 caracteres distintos) | 3,0 |
| \`configuracao_do_banco\` | ≈ 3,4 |
| chave aleatória em base64 (40 caracteres) | ≈ 4,7 |

\`\`\`python
import math
from collections import Counter

def entropia(texto):
    n = len(texto)
    return sum(c / n * math.log2(n / c) for c in Counter(texto).values())
\`\`\`

| Onde rodar | Ferramentas |
|---|---|
| Na máquina, antes do commit (hook \`pre-commit\`) | gitleaks, detect-secrets |
| No CI e no **histórico inteiro** | trufflehog, gitleaks |
| No servidor git, bloqueando o push | GitHub *push protection*, GitLab secret detection |

> [!atencao] O limiar é um trade-off: alto demais deixa segredos passarem; baixo demais gera alarmes em hashes de integridade, UUIDs e identificadores longos. Um SHA-1 em hexadecimal tem no máximo 4 bits/caractere (só 16 símbolos) — por isso o detect-secrets usa limiares diferentes para hex (3,0) e base64 (4,5). Falsos positivos conhecidos vão para uma allowlist, como o comentário \`# pragma: allowlist secret\`.

> [!sabia] Existem segredos feitos para vazar: **canary tokens** (ou *honeytokens*), credenciais falsas plantadas em repositórios, wikis e máquinas. Ninguém legítimo as usa — então **qualquer** uso dispara um alarme e denuncia o invasor. Experimentos com chaves-isca publicadas no GitHub registram tentativas de uso em **minutos**, e a AWS chega a aplicar automaticamente uma política de quarentena às chaves que aparecem em repositórios públicos.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora as dependências. Um \`requests\` sem versão no \`requirements.txt\` significa: "instale o que existir no dia do build".',
          'O build de hoje e o de amanhã podem ser diferentes — e você nem fica sabendo.',
        ],
        board: {
          title: 'Pinning e lock files',
          md: `\`\`\`text
requests               ← qualquer versão: o build de amanhã pode ser outro
requests>=2.31,<3      ← faixa: o certo para BIBLIOTECAS (convivem com o resto do ecossistema)
requests==2.32.3       ← versão exata: bom para APLICAÇÕES… e as dependências transitivas?
\`\`\`

O **lock file** fixa a árvore **inteira** — inclusive as dependências das dependências — e, de preferência, o **hash** de cada pacote:

\`\`\`text
# requirements.txt — gerado por: pip-compile --generate-hashes requirements.in
certifi==2024.8.30 \\
    --hash=sha256:9a3f…
requests==2.32.3 \\
    --hash=sha256:70c1…
urllib3==2.2.3 \\
    --hash=sha256:ca89…      # via requests
\`\`\`

\`\`\`text
pip install --require-hashes -r requirements.txt   # bytes diferentes → a instalação FALHA
\`\`\`

| | Biblioteca (publicada no PyPI) | Aplicação (vai para produção) |
|---|---|---|
| Declara | **faixas** compatíveis (\`>=2.31,<3\`) | as dependências diretas |
| Trava | nada — quem instala resolve | **tudo**, com hashes (\`uv.lock\`, \`poetry.lock\`, pip-tools) |

- **Pinning não é congelar**: é atualizar **de propósito**, com PR, testes e changelog. Dependabot ou Renovate abrem esses PRs sozinhos; pinado e esquecido é acumular CVEs.
- Um *sdist* (\`.tar.gz\`) pode executar código arbitrário no \`setup.py\` **durante a instalação**. *Wheels* não executam nada ao instalar — \`--only-binary :all:\` impõe isso.

> [!sabia] Em 2016, um desenvolvedor despublicou do npm o **left-pad** — 11 linhas que completavam strings com espaços à esquerda. Os builds de milhares de projetos (Babel e React entre eles) quebraram na hora, e o npm mudou suas regras para impedir a remoção de pacotes dos quais outros dependem. Cada dependência é uma relação de confiança com um estranho.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'E se o pacote que você instalou **não for** o que você pensou? Dois ataques exploram exatamente isso.',
          'O **typosquatting** explora o seu dedo. A **dependency confusion** explora o seu instalador.',
        ],
        board: {
          title: 'Typosquatting e dependency confusion',
          md: `**Typosquatting**: um pacote malicioso com nome quase igual ao de um popular.

| Técnica | Exemplo (alvo) |
|---|---|
| Erro de digitação | \`reqeusts\`, \`requets\` (\`requests\`) |
| Separador ou prefixo | \`python3-dateutil\` (\`python-dateutil\`) |
| Caractere parecido | \`jeIlyfish\`, com "I" maiúsculo (\`jellyfish\`) |
| *Combosquatting* | nome popular + sufixo plausível: \`requests-toolkit\` |

Em 2019, descobriu-se que \`jeIlyfish\` (no ar havia quase um ano) e \`python3-dateutil\` roubavam chaves SSH e GPG de quem os instalava.

**Dependency confusion**: o nome do seu pacote **interno** publicado no índice **público**, com versão maior.

\`\`\`text
 requirements: acme-billing>=1.4                  (pacote INTERNO)
 pip install --extra-index-url https://pypi.acme.local ...
      ├── índice interno: acme-billing 1.4
      └── PyPI público:   acme-billing 99.0   ← publicado pelo atacante
             o pip junta os índices e escolhe a MAIOR versão → 99.0
             o setup.py do atacante roda no seu CI 💥
\`\`\`

Em 2021, Alex Birsan achou nomes de pacotes internos em manifestos públicos e arquivos JavaScript e publicou versões inofensivas "que ligavam para casa": executou código dentro de **mais de 35 empresas**, como Apple, Microsoft e PayPal.

| Defesa | Contra |
|---|---|
| **Um único índice**: um proxy (Artifactory, Nexus, devpi) que espelha o PyPI, usado com \`--index-url\` — nunca \`--extra-index-url\` | confusion |
| **Reservar** os nomes internos no registro público (ou usar escopos, como \`@acme/\` no npm) | confusion |
| **Lock file com hashes** | os dois: bytes inesperados não instalam |
| Revisar dependência **nova**: idade, mantenedores, downloads, repositório | typosquatting |

> [!sabia] O termo **slopsquatting** (2025) nomeia uma variante nova: assistentes de código às vezes **alucinam** nomes de pacotes plausíveis, e os mesmos nomes inventados se repetem. Atacantes registram esses nomes e esperam alguém copiar o \`pip install\` sugerido. Um pesquisador publicou um pacote vazio com um nome alucinado com frequência, \`huggingface-cli\`, e ele recebeu milhares de downloads em poucos meses.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, três siglas que aparecem em toda conversa séria sobre supply chain: **CVE**, **SBOM** e **SLSA**.',
          'Uma diz qual é a falha, outra diz o que você tem, e a última diz como aquilo foi construído.',
        ],
        board: {
          title: 'CVEs, SBOM e SLSA',
          md: `**CVE**: o "RG" de uma vulnerabilidade conhecida (\`CVE-2021-44228\`). Para priorizar:

| Métrica | Pergunta que responde |
|---|---|
| **CVSS** (0–10) | quão grave é **se** for explorada? |
| **EPSS** (0–100%) | qual a probabilidade de ser explorada nos **próximos 30 dias**? |
| **KEV** (catálogo da CISA) | já **está** sendo explorada por aí? |
| Alcançabilidade | o **meu** código chama a função vulnerável? |

\`\`\`text
$ pip-audit -r requirements.txt
Name     Version ID                  Fix Versions
-------- ------- ------------------- ------------
jinja2   3.1.2   GHSA-h5c8-rqwp-cp95 3.1.3
\`\`\`

**SBOM** (*Software Bill of Materials*): o inventário do artefato, gerado no build (\`cyclonedx-py\`, \`syft\`). Com ele, "estamos expostos ao Log4Shell?" vira uma consulta, não uma força-tarefa.

\`\`\`json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "components": [
    {"type": "library", "name": "requests", "version": "2.32.3", "purl": "pkg:pypi/requests@2.32.3"},
    {"type": "library", "name": "urllib3", "version": "2.2.3", "purl": "pkg:pypi/urllib3@2.2.3"}
  ]
}
\`\`\`

**SLSA** (*Supply-chain Levels for Software Artifacts*): quanto dá para confiar em **como** o artefato foi construído.

| Nível (trilha de build) | Garantia |
|---|---|
| L0 | nenhuma |
| L1 | existe **proveniência**: um registro de qual código, qual build e quais parâmetros geraram o artefato |
| L2 | build numa plataforma hospedada, com proveniência **assinada** |
| L3 | plataforma **endurecida**: builds isolados, proveniência que nem o próprio projeto consegue forjar |

No PyPI, o **Trusted Publishing** faz o GitHub Actions publicar via OIDC, sem nenhum token guardado no repositório — e as **attestations** (PEP 740) ligam cada pacote ao build que o gerou.

> [!sabia] O **EPSS** existe porque o CVSS sozinho não prioriza nada: só em 2024 foram publicadas **mais de 40 mil CVEs**, e apenas uma pequena fração chega a ser explorada de verdade. Já o **VEX** (*Vulnerability Exploitability eXchange*) é o documento que diz "usamos a biblioteca vulnerável, mas **não somos afetados** — o trecho vulnerável não é alcançável", e poupa o time de alarmes falsos vindos do SBOM.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Cinco questões — incluindo um secret scanner e um caçador de typosquatting de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'sec-sup-q1',
        concept: 'Resposta a segredo vazado',
        say: 'Primeira, um incidente real de sexta-feira à tarde. O que você faz primeiro?',
        prompt: 'Um dev percebe que commitou uma chave de acesso da AWS (`AKIA…`) num repositório **público** há 40 minutos. Qual deve ser a **primeira** ação?',
        options: [
          { text: '**Revogar** a chave imediatamente, emitir uma nova para quem precisa dela e investigar nos logs (CloudTrail) o que foi feito com a antiga. Limpar o histórico fica para depois.', correct: true, why: 'Exato. Em 40 minutos a chave provavelmente já foi coletada. Só a revogação garante que ela deixe de funcionar; a investigação diz se alguém a usou (e para quê).' },
          { text: 'Apagar o arquivo e fazer um novo commit removendo a chave.', why: 'A chave continua no **histórico** do git — e em todo clone, fork e cache feito nesse intervalo. O commit novo só esconde o problema de quem olha a versão atual.' },
          { text: 'Reescrever o histórico com `git filter-repo` e fazer *force push*.', why: 'É uma boa **limpeza**, mas não é a primeira ação: robôs varrem commits públicos em minutos, e forks, PRs e caches guardam cópias. Com a chave ainda válida, o estrago continua.' },
          { text: 'Tornar o repositório privado até resolver.', why: 'Tarde demais: as cópias já existem. E a chave continuaria válida — inclusive para qualquer pessoa com acesso ao repositório privado.' },
        ],
        explanation: 'A ordem de um vazamento de segredo é: **revogar** (ou rotacionar) → **investigar** o uso no período → **limpar** o histórico → **prevenir** (secret scanning no pre-commit, *push protection*, segredos num cofre). Tratar o repositório como a vítima é o erro clássico: a vítima é tudo o que a chave abre. E vale um postmortem sem culpados — a pergunta útil é "por que era possível commitar uma chave?", não "quem foi?".',
      },
      {
        type: 'match',
        id: 'sec-sup-q2',
        concept: 'Vocabulário de supply chain',
        say: 'Agora, vocabulário. Associe cada situação ao nome dela.',
        prompt: 'Associe cada **situação ou descrição** ao **termo** correspondente.',
        pairs: [
          { left: '`reqeusts` publicado no PyPI imitando o `requests`', right: 'Typosquatting' },
          { left: 'O pacote público `acme-billing 99.0` "vence" o interno `1.4`', right: 'Dependency confusion' },
          { left: 'Inventário dos componentes e versões de um artefato (SPDX, CycloneDX)', right: 'SBOM' },
          { left: 'Níveis de garantia sobre **como** um artefato foi construído', right: 'SLSA' },
          { left: 'Probabilidade de uma CVE ser explorada nos próximos 30 dias', right: 'EPSS' },
          { left: 'Todo build instala os mesmos bytes: versões exatas + `--hash=sha256:…`', right: 'Lock file com hashes' },
        ],
        explanation: 'Repare que os termos cobrem perguntas diferentes: **o que** eu tenho (SBOM), **de onde** veio e **como** foi feito (SLSA, lock file com hashes), **é mesmo o pacote certo?** (typosquatting, dependency confusion) e **com o que me preocupar primeiro** (EPSS). Nenhum resolve tudo sozinho — segurança de supply chain é defesa em profundidade.',
      },
      {
        type: 'code',
        id: 'sec-sup-q3',
        concept: 'Secret scanning',
        title: 'Um secret scanner em miniatura',
        say: 'Hora de construir o seu próprio *secret scanner*: padrões conhecidos + entropia. Cuidado para não gritar "segredo!" em todo hash de commit.',
        prompt: `Complete o detector de segredos:

- \`PADROES\`: acrescente \`"github_token"\` — \`ghp_\`, \`gho_\`, \`ghu_\`, \`ghs_\` ou \`ghr_\` seguido de **exatamente 36** caracteres \`[A-Za-z0-9]\`.
- \`entropia(texto) -> float\`: entropia de Shannon em bits por caractere, \`H = Σ p·log₂(1/p)\`, com \`p\` a frequência de cada caractere distinto. Texto vazio → \`0.0\`.
- \`encontrar_segredos(texto) -> list[tuple[int, str]]\`: devolve os achados como \`(número_da_linha, tipo)\`, com linhas numeradas **a partir de 1**:
  1. uma linha que contém \`pragma: allowlist secret\` é ignorada inteira;
  2. para cada padrão de \`PADROES\` que aparece na linha → \`(linha, nome_do_padrão)\`;
  3. se algum trecho da linha casa com \`CANDIDATO\` e tem \`entropia >= LIMIAR\` → \`(linha, "alta_entropia")\`. Um trecho já reconhecido por um padrão conhecido **não conta de novo** como alta entropia;
  4. cada par \`(linha, tipo)\` aparece **uma vez só**, e a lista vem **ordenada** (\`sorted\`).`,
        starter: String.raw`import math
import re
from collections import Counter

PADROES = {
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "chave_privada": re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"),
    # TODO: "github_token"
}
CANDIDATO = re.compile(r"[A-Za-z0-9+/_\-]{20,}")   # trechos "com cara" de chave
LIMIAR = 4.5                                        # bits por caractere


def entropia(texto):
    # TODO: entropia de Shannon (bits por caractere)
    pass


def encontrar_segredos(texto):
    # TODO: lista ordenada de (linha, tipo)
    return []
`,
        tests: [
          {
            name: 'entropia: exemplos clássicos',
            code: `import math
for texto, esperado in [("", 0.0), ("aaaa", 0.0), ("ab", 1.0), ("abcd", 2.0), ("senha123", 3.0), ("aab", 0.9183)]:
    obtido = entropia(texto)
    assert isinstance(obtido, float), f"entropia({texto!r}) deve devolver float, veio {type(obtido).__name__}"
    assert math.isclose(obtido, esperado, abs_tol=1e-3), f"entropia({texto!r}) deveria ser ≈ {esperado}, veio {obtido!r}"`,
          },
          {
            name: 'padrões conhecidos: AWS, GitHub e chave privada, com o número da linha',
            code: SEGREDOS_AUX + `
texto = f'import os\\n\\nAWS_KEY = "{AWS}"\\ntoken = "{GH}"\\n\\n{PEM}\\n'
obtido = encontrar_segredos(texto)
esperado = [(3, "aws_access_key"), (4, "github_token"), (6, "chave_privada")]
assert obtido == esperado, f"esperado {esperado}, veio {obtido}. (O token do GitHub não pode aparecer também como alta_entropia: tire o trecho já reconhecido antes de medir a entropia.)"`,
          },
          {
            name: 'alta entropia: segredos sem formato conhecido',
            code: SEGREDOS_AUX + `
texto = f'SECRET_KEY = "{SEGREDO_AWS}"\\nx = 1\\nsenha_do_banco = "{SENHA_BANCO}"'
obtido = encontrar_segredos(texto)
assert obtido == [(1, "alta_entropia"), (3, "alta_entropia")], f"esperado [(1, 'alta_entropia'), (3, 'alta_entropia')], veio {obtido}"`,
          },
          {
            name: 'sem falsos positivos em código comum (hash de commit, UUID, URL, identificadores)',
            code: `texto = """import os
DB_URL = os.environ["DATABASE_URL"]
commit = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4"
uuid = "3f2b8c1e-9d4a-4e7b-a1c6-0f5d2e8b7a93"
url = "https://github.com/org/repo/blob/main/src/modulo_de_pagamentos"
class AbstractSingletonProxyFactoryBean:
    def test_deve_rejeitar_token_expirado(self):
        return configuracao_do_banco_de_dados"""
obtido = encontrar_segredos(texto)
assert obtido == [], f"nada disso é segredo, mas o detector apontou {obtido}"`,
          },
          {
            name: 'a linha com "pragma: allowlist secret" é ignorada',
            code: SEGREDOS_AUX + `
sri = "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
texto = f'<script integrity="{sri}"></script>  <!-- pragma: allowlist secret -->\\nEXEMPLO = "{AWS}"  # pragma: allowlist secret\\n<script integrity="{sri}"></script>'
obtido = encontrar_segredos(texto)
assert obtido == [(3, "alta_entropia")], f"as linhas 1 e 2 têm o pragma e devem ser ignoradas; a 3 não tem. Esperado [(3, 'alta_entropia')], veio {obtido}"`,
          },
          {
            name: 'cada (linha, tipo) aparece uma vez, em ordem',
            hidden: true,
            code: SEGREDOS_AUX + `
texto = f'chaves = ["{AWS}", "{ASIA}"]\\nok = 1\\ncfg = {{"a": "{SEGREDO_AWS}", "b": "{SENHA_BANCO}", "gh": "{GH}"}}'
obtido = encontrar_segredos(texto)
esperado = [(1, "aws_access_key"), (3, "alta_entropia"), (3, "github_token")]
assert obtido == esperado, f"esperado {esperado} (sem repetições, ordenado), veio {obtido}"`,
          },
          {
            name: 'todos os prefixos do GitHub; prefixo inválido cai só na entropia; texto vazio',
            hidden: true,
            code: SEGREDOS_AUX + `
for prefixo in ["gh" + "o_", "gh" + "u_", "gh" + "s_", "gh" + "r_"]:
    obtido = encontrar_segredos(f'T = "{prefixo}{SUFIXO_GH}"')
    assert obtido == [(1, "github_token")], f"{prefixo!r} + 36 caracteres é um token do GitHub; veio {obtido}"
obtido = encontrar_segredos(f'T = "{"gh" + "x_"}{SUFIXO_GH}"')
assert obtido == [(1, "alta_entropia")], f"'ghx_' não é prefixo do GitHub, mas a string é aleatória: esperado [(1, 'alta_entropia')], veio {obtido}"
assert encontrar_segredos("") == [], "texto vazio → []"
obtido = encontrar_segredos(f"\\r\\n{PEM}\\r\\n")
assert obtido == [(2, "chave_privada")], f"quebras de linha do Windows (\\\\r\\\\n): esperado [(2, 'chave_privada')], veio {obtido}"`,
          },
        ],
        reviews: [
          {
            when: m => m.calls.includes('count'),
            text: 'Você contou as ocorrências com `texto.count(c)` para cada caractere: isso percorre o texto inteiro de novo a cada caractere distinto. Um `collections.Counter(texto)` conta tudo numa passada só — e um scanner roda sobre repositórios **inteiros**, histórico incluído.',
            concept: 'Complexidade',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou `Exception` (ou usou `except:` sem tipo). Num scanner de segurança, engolir erros é perigoso: uma linha que quebra o detector vira, em silêncio, "nenhum segredo encontrado". Prefira deixar o erro aparecer — **falhar fechado**.',
            concept: 'Falhar fechado',
          },
          {
            when: m => m.maxComplexity > 10,
            text: '`encontrar_segredos` ficou com muitos caminhos. Separe em passos com nome — por exemplo, uma função que devolve os achados de **uma** linha —, e o laço principal só numera as linhas e junta os resultados.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          '**Entropia:** `n = len(texto)` e `Counter(texto).values()` dá a contagem `c` de cada caractere; some `c / n * math.log2(n / c)`. Trate o texto vazio antes (divisão por zero).',
          '**Linhas:** `for numero, linha in enumerate(texto.splitlines(), start=1)`; pule a linha se `"pragma: allowlist secret" in linha`. Para cada padrão, se `padrao.search(linha)`, registre o achado e **apague** o trecho: `linha = padrao.sub(" ", linha)` — assim ele não conta de novo na entropia.',
          '**Entropia e saída:** depois dos padrões, `any(entropia(t) >= LIMIAR for t in CANDIDATO.findall(linha))` → `"alta_entropia"`. Junte tudo num `set` de tuplas e devolva `sorted(achados)`. O GitHub: `re.compile(r"\\bgh[pousr]_[A-Za-z0-9]{36}\\b")`.',
        ],
        solution: String.raw`import math
import re
from collections import Counter

PADROES = {
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "chave_privada": re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"),
    "github_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36}\b"),
}
CANDIDATO = re.compile(r"[A-Za-z0-9+/_\-]{20,}")   # trechos "com cara" de chave
LIMIAR = 4.5                                        # bits por caractere
PRAGMA = "pragma: allowlist secret"


def entropia(texto):
    if not texto:
        return 0.0
    n = len(texto)
    return sum(c / n * math.log2(n / c) for c in Counter(texto).values())


def _achados_da_linha(linha):
    for nome, padrao in PADROES.items():
        if padrao.search(linha):
            yield nome
            linha = padrao.sub(" ", linha)      # já reconhecido: não conta de novo
    if any(entropia(trecho) >= LIMIAR for trecho in CANDIDATO.findall(linha)):
        yield "alta_entropia"


def encontrar_segredos(texto):
    achados = set()
    for numero, linha in enumerate(texto.splitlines(), start=1):
        if PRAGMA in linha:
            continue
        achados.update((numero, tipo) for tipo in _achados_da_linha(linha))
    return sorted(achados)
`,
        solutionExplanation: 'As duas técnicas se completam. Os **padrões conhecidos** vêm primeiro porque são precisos e dizem **o que** vazou (e, portanto, onde revogar). Depois de reconhecido, o trecho é **apagado** da linha (`padrao.sub(" ", linha)`), para que o token do GitHub não seja relatado duas vezes. A **entropia** pega o que não tem formato: com limiar 4,5 bits/caractere, a chave secreta da AWS (≈ 4,7) é apontada, mas o hash de commit (≈ 3,6 — hexadecimal nunca passa de 4) e os identificadores longos não. O `set` elimina repetições e o `sorted` dá uma saída estável. As ferramentas reais somam a isso validação ativa (testar se a chave funciona), *baselines* dos achados já conhecidos e a varredura do **histórico** inteiro.',
      },
      {
        type: 'code',
        id: 'sec-sup-q4',
        concept: 'Typosquatting',
        title: 'Caçador de typosquatting',
        say: 'Agora do outro lado: antes de aceitar uma dependência nova no projeto, vamos checar se o nome não é um primo suspeito de um pacote famoso.',
        prompt: `Implemente um detector de typosquatting:

- \`normalizar(nome) -> str\`: normalização de nomes do PyPI (PEP 503) — cada sequência de \`-\`, \`_\` e \`.\` vira um único \`-\`, e tudo fica minúsculo. \`"Python_Dateutil"\` → \`"python-dateutil"\`.
- \`distancia(a, b) -> int\`: distância de **Damerau-Levenshtein** (variante *optimal string alignment*): o menor número de **inserções**, **remoções**, **substituições** e **transposições de dois caracteres vizinhos** que transformam \`a\` em \`b\`. \`distancia("reqeusts", "requests") == 1\`.
- \`verificar(nome, populares, max_dist=1) -> list[str]\`: os pacotes de \`populares\` dos quais \`nome\` é um **primo suspeito**:
  1. compare os nomes **normalizados**;
  2. se \`nome\` normalizado **é** um dos populares, ele é o pacote legítimo → \`[]\`;
  3. senão, devolva os populares com \`distancia <= max_dist\`, **com a grafia original** da lista, ordenados pela distância e, no empate, pelo nome.`,
        starter: `import re


def normalizar(nome):
    # TODO: PEP 503
    pass


def distancia(a, b):
    # TODO: Damerau-Levenshtein (inserção, remoção, substituição e transposição)
    pass


def verificar(nome, populares, max_dist=1):
    # TODO: populares dos quais "nome" é um primo suspeito
    return []
`,
        tests: [
          {
            name: 'normalizar segue a PEP 503',
            code: `for nome, esperado in [("Python_Dateutil", "python-dateutil"), ("zope.interface", "zope-interface"), ("PyYAML", "pyyaml"), ("a__b.-c", "a-b-c"), ("requests", "requests")]:
    obtido = normalizar(nome)
    assert obtido == esperado, f"normalizar({nome!r}) deveria ser {esperado!r}, veio {obtido!r}"`,
          },
          {
            name: 'distancia: inserção, remoção e substituição',
            code: `for a, b, esperado in [("", "abc", 3), ("abc", "", 3), ("requests", "requests", 0), ("kitten", "sitting", 3), ("requets", "requests", 1), ("nunpy", "numpy", 1)]:
    obtido = distancia(a, b)
    assert obtido == esperado, f"distancia({a!r}, {b!r}) deveria ser {esperado}, veio {obtido!r}"`,
          },
          {
            name: 'distancia: trocar dois vizinhos de lugar custa 1 (transposição)',
            code: `for a, b in [("reqeusts", "requests"), ("djagno", "django"), ("ab", "ba")]:
    obtido = distancia(a, b)
    assert obtido == 1, f"distancia({a!r}, {b!r}) deveria ser 1 (uma transposição), veio {obtido!r} — Levenshtein puro daria 2"`,
          },
          {
            name: 'verificar pega os casos clássicos',
            code: POPULARES + `for nome, esperado in [("reqeusts", ["requests"]), ("python3-dateutil", ["python-dateutil"]), ("jeIlyfish", ["jellyfish"]), ("urllib", ["urllib3"]), ("flask", [])]:
    obtido = verificar(nome, POPULARES)
    assert obtido == esperado, f"verificar({nome!r}) deveria ser {esperado}, veio {obtido!r}"`,
          },
          {
            name: 'o próprio pacote (em qualquer grafia) não é suspeito',
            code: POPULARES + `for nome in ["requests", "Requests", "python_dateutil", "Python.Dateutil", "pyyaml", "boto"]:
    obtido = verificar(nome, POPULARES)
    assert obtido == [], f"{nome!r} normalizado É um pacote popular (o legítimo): esperado [], veio {obtido!r}"`,
          },
          {
            name: 'grafia original, empates em ordem alfabética e max_dist',
            hidden: true,
            code: POPULARES + `obtido = verificar("pyyml", POPULARES)
assert obtido == ["PyYAML"], f"devolva a grafia original da lista: esperado ['PyYAML'], veio {obtido!r}"
obtido = verificar("botox", POPULARES)
assert obtido == ["boto", "boto3"], f"'botox' está a 1 de 'boto' e de 'boto3': esperado ['boto', 'boto3'], veio {obtido!r}"
obtido = verificar("reqeust", POPULARES)
assert obtido == [], f"'reqeust' está a 2 de 'requests': com max_dist=1, esperado [], veio {obtido!r}"
obtido = verificar("reqeust", POPULARES, max_dist=2)
assert obtido == ["requests"], f"com max_dist=2, esperado ['requests'], veio {obtido!r}"`,
          },
          {
            name: 'ordena pela distância antes do nome',
            hidden: true,
            code: `obtido = verificar("reqests", ["request", "requests"], max_dist=2)
assert obtido == ["requests", "request"], f"'requests' (distância 1) vem antes de 'request' (distância 2): veio {obtido!r}"
obtido = verificar("Reqeusts", ["Requests"])
assert obtido == ["Requests"], f"compare normalizado, devolva o original: veio {obtido!r}"
assert verificar("qualquer", []) == [], "lista de populares vazia → []"`,
          },
        ],
        reviews: [
          {
            when: m => m.recursion > 0 && !m.decorators.includes('cache') && !m.decorators.includes('lru_cache'),
            text: 'Sua distância é recursiva e sem memorização: os mesmos subproblemas são recalculados um número **exponencial** de vezes. Use programação dinâmica — uma matriz `d[i][j]` com a distância entre os prefixos `a[:i]` e `b[:j]` — ou, no mínimo, `@functools.cache`.',
            concept: 'Programação dinâmica',
          },
          {
            when: m => m.loopDepth >= 3,
            text: 'Você tem três laços aninhados. A matriz da distância precisa de dois (sobre `i` e `j`); o laço sobre os populares pode chamar `distancia` como uma função separada — e até pular, antes do cálculo, quem difere em tamanho mais que `max_dist` (a distância é, no mínimo, a diferença de tamanhos).',
            concept: 'Funções pequenas',
          },
          {
            when: m => m.maxComplexity > 14,
            text: 'Alguma função ficou com muitos caminhos. Separe normalização, distância e seleção dos suspeitos — cada uma pode ser testada sozinha, como os testes fazem.',
            concept: 'Funções pequenas',
          },
        ],
        hints: [
          '**Normalizar:** `re.sub(r"[-_.]+", "-", nome).lower()` — é literalmente a regra da PEP 503.',
          '**Distância:** monte a matriz `d` de `(len(a)+1) × (len(b)+1)`, com `d[i][0] = i` e `d[0][j] = j`. Cada célula é o mínimo de `d[i-1][j] + 1` (remoção), `d[i][j-1] + 1` (inserção) e `d[i-1][j-1] + custo` (substituição, custo 0 se os caracteres são iguais). **Transposição:** se `a[i-1] == b[j-2]` e `a[i-2] == b[j-1]`, considere também `d[i-2][j-2] + 1`.',
          '**Verificar:** `alvo = normalizar(nome)`; monte `{normalizar(p): p for p in populares}`; se `alvo` for uma chave → `[]`. Senão, junte `(distancia, original)` dos que têm `distancia <= max_dist` e devolva os nomes na ordem de `sorted(...)`.',
        ],
        solution: `import re


def normalizar(nome):
    return re.sub(r"[-_.]+", "-", nome).lower()


def distancia(a, b):
    """Damerau-Levenshtein, variante optimal string alignment."""
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            custo = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1,           # remoção
                          d[i][j - 1] + 1,           # inserção
                          d[i - 1][j - 1] + custo)   # substituição
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)   # transposição
    return d[len(a)][len(b)]


def verificar(nome, populares, max_dist=1):
    alvo = normalizar(nome)
    conhecidos = {normalizar(p): p for p in populares}
    if alvo in conhecidos:
        return []                     # é o pacote legítimo
    suspeitos = []
    for normalizado, original in conhecidos.items():
        if abs(len(normalizado) - len(alvo)) > max_dist:
            continue                  # a distância é no mínimo a diferença de tamanhos
        dist = distancia(alvo, normalizado)
        if dist <= max_dist:
            suspeitos.append((dist, original))
    return [original for _, original in sorted(suspeitos)]
`,
        solutionExplanation: 'Três ideias. **Normalizar primeiro**: para o PyPI, `Python_Dateutil` e `python-dateutil` são o **mesmo** pacote (PEP 503), e o minúsculo transforma o `jeIlyfish` em `jeilyfish`, a uma substituição de `jellyfish`. **Damerau-Levenshtein** em vez de Levenshtein: trocar duas letras vizinhas (`reqeusts`) é o erro de digitação mais comum, e com transposição ele custa 1, não 2. **Nome legítimo não é suspeito**: `boto` e `boto3` estão a 1 de distância e são ambos reais — por isso quem já é popular sai com `[]`. O corte por diferença de tamanho evita calcular a matriz para quem nem tem chance. Na vida real, com milhares de pacotes populares, `max_dist` precisa ser **menor para nomes curtos** (em `six`, uma letra de diferença já é outro pacote legítimo), e a lista de suspeitos vira um alerta para revisão humana, não um bloqueio automático.',
      },
      {
        type: 'open',
        id: 'sec-sup-q5',
        concept: 'Dependency confusion',
        say: 'Última: uma revisão de pipeline. Me explique o risco como se eu fosse do time de plataforma.',
        prompt: 'Sua empresa publica pacotes internos (como `acme-billing`) num índice privado, e o CI instala as dependências com `pip install --extra-index-url https://pypi.acme.local -r requirements.txt`. Qual é o risco dessa configuração, e como você o mitigaria?',
        minWords: 35,
        rubric: [
          { label: 'Explica o ataque: mesmo nome no índice **público** com versão **maior**, e o código do atacante roda na instalação', keywords: ['versao maior', 'maior versao', 'versao mais alta', 'versao mais nova', 'numero de versao', 'versao 99', 'dependency confusion', 'confusao de dependencia', 'indice publico', 'pypi publico', 'registro publico', 'mesmo nome', 'setup.py'], concept: 'Dependency confusion', why: 'Com `--extra-index-url`, o pip junta os índices e escolhe a maior versão — venha de onde vier. O `setup.py` do atacante roda no CI, com acesso aos segredos dele.' },
          { label: 'Usa **um único índice** (um proxy/espelho que serve o interno e o PyPI) em vez de `--extra-index-url`', keywords: ['proxy', 'espelho', 'mirror', 'artifactory', 'nexus', 'devpi', 'indice unico', 'unico indice', 'um so indice', 'um indice so', 'apenas o indice interno', 'so o indice interno', 'first-index', 'nao usar --extra', 'nao usar extra', 'sem --extra', 'sem extra-index', 'remover o --extra', 'trocar o --extra', 'trocar --extra'], concept: 'Índice único', why: 'Se só existe uma fonte, e ela prioriza os pacotes internos, não há "disputa" de versões entre índices. O uv faz isso por padrão (`first-index`).' },
          { label: '**Reserva** os nomes internos no registro público (ou usa namespace/escopo)', keywords: ['reserv', 'registrar o nome', 'registrar os nomes', 'registrar nomes', 'publicar um placeholder', 'placeholder', 'namespace', 'escopo', 'scope', 'squat'], concept: 'Reserva de nomes', why: 'Se o nome já é seu no PyPI público, ninguém mais pode publicá-lo — uma defesa barata que também protege quem configurar o pip errado no futuro.' },
          { label: 'Fixa versões e **hashes** num lock file (`--require-hashes`)', keywords: ['hash', 'lock', 'require-hashes', 'pinning', 'pinar', 'fixar a versao', 'fixar as versoes', 'versao fixa', 'versoes fixas', 'versao exata', 'versoes exatas'], concept: 'Lock file com hashes', why: 'Com o hash de cada pacote travado, um artefato inesperado — mesmo com o nome e a versão "certos" — faz a instalação falhar em vez de executar.' },
        ],
        modelAnswer: `O risco é **dependency confusion**. Com \`--extra-index-url\`, o pip consulta o índice interno **e** o PyPI público e escolhe a **maior versão** que encontrar. Se alguém publicar \`acme-billing 99.0\` no PyPI público — os nomes internos vazam em manifestos, logs e mensagens de erro —, o CI instala o pacote do atacante, e o \`setup.py\` dele roda durante a instalação, com acesso aos segredos do pipeline.

Mitigações: primeiro, usar **um único índice** — um proxy como Artifactory, Nexus ou devpi, que serve os pacotes internos e espelha o PyPI —, configurado com \`--index-url\` e sem nenhum \`--extra-index-url\`. Segundo, **reservar** os nomes internos no PyPI público com pacotes vazios (ou adotar um prefixo que a empresa controla). Terceiro, instalar a partir de um **lock file com hashes** (\`pip install --require-hashes\`): um pacote com bytes diferentes do esperado faz o build falhar. E, de quebra, rodar o CI com o mínimo de segredos possível, para limitar o estrago caso algo escape.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você olha para um `requirements.txt` e enxerga uma cadeia de confiança inteira.',
          { text: 'Resumo: segredo no cofre e revogado ao vazar, dependências travadas com hash, nome conferido antes de instalar — e SBOM para saber o que você tem quando a próxima CVE famosa aparecer.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
