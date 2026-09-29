Game.registerModule('architecture', {
  id: 'evolutionary',
  title: 'Arquitetura Evolutiva e Fitness Functions',
  kind: 'lesson',
  level: 3,
  order: 41,
  unit: 'qualidades',
  summary: 'Como impedir que a arquitetura apodreça em silêncio: fitness functions, testes de arquitetura e as métricas de acoplamento de Robert Martin.',
  concepts: ['Arquitetura evolutiva', 'Fitness functions', 'Testes de arquitetura', 'Instabilidade (Ca/Ce)', 'Sequência principal e zona de dor'],
  takeaways: [
    'Arquitetura **erode** commit a commit: regra que só existe na wiki não se sustenta.',
    'Uma **fitness function** dá uma avaliação **objetiva** de uma característica da arquitetura — no CI (testes de arquitetura) ou em produção (métricas, caos).',
    'Testes de arquitetura em Python: o `ast` lê os imports **sem executar** o código; ferramentas como o **import-linter** transformam camadas em contratos.',
    '**I = Ce / (Ca + Ce)**: dependa na direção da **estabilidade** (SDP) — o I deve cair ao longo das setas.',
    'Pacotes estáveis devem ser **abstratos** (SAP); estável + concreto + volátil = **zona de dor**.',
  ],
  glossary: [
    { term: 'Fitness function', aliases: ['fitness functions', 'função de aptidão', 'funções de aptidão'], definition: 'Mecanismo que dá uma avaliação **objetiva** de uma característica da arquitetura (ex.: "o domínio não importa infraestrutura", "p99 < 300 ms"). Termo emprestado dos algoritmos genéticos e popularizado pelo livro *Building Evolutionary Architectures* (2017).' },
    { term: 'Acoplamento aferente', aliases: ['afferent coupling', 'aferente', 'aferentes'], definition: '**Ca**: quantos pacotes de fora dependem deste. Ca alto significa que muita gente sente qualquer mudança nele.' },
    { term: 'Acoplamento eferente', aliases: ['efferent coupling', 'eferente', 'eferentes'], definition: '**Ce**: de quantos pacotes este depende. Ce alto significa muitas razões externas para ele quebrar.' },
    { term: 'Instabilidade (I)', aliases: ['métrica de instabilidade', 'instability metric'], definition: '**I = Ce / (Ca + Ce)**, de 0 (maximamente estável: muitos dependem dele) a 1 (maximamente instável: depende de outros e ninguém depende dele). Métrica de Robert C. Martin (1994).' },
    { term: 'Sequência principal', aliases: ['main sequence'], definition: 'A linha **A + I = 1** no gráfico abstração × instabilidade, onde os pacotes equilibram estabilidade e abstração. A distância **D = |A + I − 1|** mede o quanto um pacote se afasta dela.' },
    { term: 'Zona de dor', aliases: ['zone of pain', 'zona da dor'], definition: 'Região do gráfico de Martin com I ≈ 0 e A ≈ 0: pacote **concreto** do qual muitos dependem. Se ele muda com frequência, cada alteração se propaga — daí a dor.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o assunto é o que acontece **depois** do desenho bonito: a arquitetura **apodrece**, commit a commit, sem ninguém perceber.',
        'Como garantir que as decisões de hoje ainda valham daqui a dois anos? Esse é o tema da **arquitetura evolutiva**.',
      ],
      board: {
        title: 'Erosão: a arquitetura que ninguém vê apodrecer',
        md: `\`\`\`text
 mês 0    api ──▶ aplicacao ──▶ dominio ◀── infra      ✔ limpo
 mês 3    "só um import do ORM no domínio, depois eu arrumo"
 mês 9    dominio ──▶ infra ──▶ dominio                 ✖ ciclo
 mês 18   "não dá para mexer no frete sem quebrar o checkout"
\`\`\`

Nenhum commit, sozinho, "quebrou a arquitetura". Foi a **soma** deles.

**Arquitetura evolutiva** (Ford, Parsons e Kua, 2017) é a que suporta **mudança guiada e incremental em múltiplas dimensões**:

- **guiada** → por verificações objetivas das características que importam;
- **incremental** → mudanças pequenas, entregues por um pipeline confiável;
- **múltiplas dimensões** → código, dados, segurança, operação… não só a estrutura de pacotes.

> [!dica] Perry e Wolf (1992) já distinguiam **erosão** (violar a arquitetura planejada) de **deriva** (*drift*: ir se afastando dela por descuido, sem violar nada explicitamente). As duas acontecem em silêncio.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'A ferramenta central é a **fitness function**: qualquer mecanismo que dá uma **avaliação objetiva** de uma característica da arquitetura.',
        'Pode ser um teste no CI, uma métrica monitorada em produção, até um experimento de caos. O importante: dá para dizer **passou ou falhou**, sem opinião.',
      ],
      board: {
        title: 'Fitness functions: testes para a arquitetura',
        md: `| Característica | Fitness function | Tipo |
|---|---|---|
| Manutenibilidade | "\`dominio\` não importa \`infra\`" | atômica · disparada no CI |
| Modularidade | "nenhum ciclo entre pacotes" | atômica · disparada no CI |
| Desempenho | "p99 do checkout < 300 ms no teste de carga" | holística · disparada |
| Resiliência | Chaos Monkey derrubando instâncias em produção | holística · contínua |
| Segurança | "nenhuma dependência com CVE crítica" | atômica · disparada |

- **Atômica × holística**: mede uma característica isolada ou várias interagindo.
- **Disparada × contínua**: roda num evento (commit, deploy) ou o tempo todo, em produção.

> [!sabia] O nome vem da **computação evolutiva**: num algoritmo genético, a *fitness function* dá uma nota a cada candidato, e só os mais aptos passam para a próxima geração. Na arquitetura, ela decide quais mudanças "sobrevivem" ao pipeline.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'A fitness function mais útil no dia a dia é o **teste de arquitetura**: um teste comum, rodando no CI, que verifica **quem importa quem**.',
        'Em Python, o módulo `ast` lê o código como árvore sintática, **sem executá-lo**. Ele enxerga imports dentro de funções e não se confunde com comentários.',
      ],
      board: {
        title: 'Testes de arquitetura em Python',
        md: `Com o **import-linter**, a regra de camadas vira configuração (e \`lint-imports\` roda no CI):

\`\`\`ini
[importlinter]
root_package = loja
include_external_packages = True

[importlinter:contract:camadas]
name = Camadas da loja
type = layers
layers =
    loja.api
    loja.aplicacao
    loja.dominio

[importlinter:contract:dominio-puro]
name = Domínio não conhece infraestrutura
type = forbidden
source_modules =
    loja.dominio
forbidden_modules =
    loja.infra
    sqlalchemy
\`\`\`

Por baixo, a ideia é simples — dá para fazer à mão com \`ast\`:`,
        code: `import ast
from pathlib import Path

PROIBIDOS = ("loja.infra", "loja.api", "sqlalchemy", "requests")


def imports(codigo):
    for no in ast.walk(ast.parse(codigo)):         # visita a árvore INTEIRA
        if isinstance(no, ast.Import):
            yield from (alias.name for alias in no.names)
        elif isinstance(no, ast.ImportFrom) and no.module:
            yield no.module


def proibido(nome):
    return any(nome == p or nome.startswith(p + ".") for p in PROIBIDOS)


def test_dominio_nao_depende_de_infra():
    for arquivo in Path("loja/dominio").rglob("*.py"):
        for nome in imports(arquivo.read_text()):
            assert not proibido(nome), f"{arquivo}: import {nome}"`,
        caption: 'Versão simplificada: ela deixa escapar imports **relativos** (`from ..infra import db`) — você vai resolvê-los no exercício. Em Java, o equivalente é o **ArchUnit**.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora vamos **medir** acoplamento. Robert C. Martin propôs, em 1994, métricas simples por pacote: **Ca**, **Ce** e a **instabilidade**.',
        'A sacada: "estável" não quer dizer "não muda", e sim **difícil de mudar** — porque muita gente depende de você.',
      ],
      board: {
        title: 'Acoplamento aferente, eferente e instabilidade',
        md: `- **Ca — acoplamento aferente** (chega): quantos pacotes de fora **dependem deste**.
- **Ce — acoplamento eferente** (sai): de quantos pacotes **este depende**.
- **Instabilidade (I)** = Ce / (Ca + Ce): de **0** (maximamente estável) a **1** (maximamente instável).

\`\`\`text
 api ─────▶ aplicacao ─────▶ dominio ◀───── infra
  │                            ▲
  └────────────────────────────┘
\`\`\`

| pacote | Ca | Ce | I |
|---|---|---|---|
| api | 0 | 2 | **1,0** — ninguém depende dele: livre para mudar |
| aplicacao | 1 | 1 | **0,5** |
| dominio | 3 | 0 | **0,0** — todos dependem dele: mudar custa caro |
| infra | 0 | 1 | **1,0** |

**Princípio das Dependências Estáveis (SDP):** *dependa na direção da estabilidade* — o I deve **diminuir** ao longo das setas. Se \`dominio\` (I = 0) passar a importar um \`utils_http\` com I = 0,8, cada mudança nesse pacote volátil ameaça o coração do sistema.

> [!dica] Martin conta **classes** dentro e fora do pacote; muitas ferramentas contam módulos ou pacotes. A leitura é a mesma.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Falta uma peça: a **abstração**. Um pacote estável precisa ser estendido **sem** ser modificado — e isso se faz com abstrações.',
        'Cruzando abstração e instabilidade, Martin desenhou um gráfico com uma linha ideal… e duas zonas que você quer evitar.',
      ],
      board: {
        title: 'Sequência principal e zona de dor',
        md: `- **A (abstração)** = classes abstratas e interfaces ÷ total de classes do pacote (0 = tudo concreto).
- **Princípio das Abstrações Estáveis (SAP):** um pacote deve ser **tão abstrato quanto é estável**.
- **Sequência principal:** a linha A + I = 1. Distância **D = |A + I − 1|** (0 = em cima da linha).

\`\`\`text
   A ▲
   1 ┼ ●                     ░ zona da inutilidade
     │   ╲                   ░ (abstrato e sem uso)
     │     ╲
     │       ╲  sequência principal
     │         ╲  (A + I = 1)
     │ ▓ zona    ╲
     │ ▓ de dor    ╲
   0 ┼───────────────●──▶ I
     0               1
\`\`\`

> [!sabia] **Zona de dor** e **zona da inutilidade** são termos do próprio Martin. Na zona de dor (I ≈ 0, A ≈ 0) mora o pacote concreto do qual todo mundo depende — \`utils\`, \`comum\`, o schema do banco: qualquer mudança dói em dezenas de lugares. E o nome "sequência principal" ecoa a astronomia: no diagrama de Hertzsprung–Russell, é a faixa onde vive a maioria das estrelas.

> [!atencao] A zona de dor só dói se o pacote é **volátil**. A \`str\` do Python é concreta e ultraestável — e tudo bem, porque ela quase nunca muda.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Antes de sair medindo tudo, cuidado: fitness function demais vira burocracia, e métrica transformada em meta acaba contornada.',
        'Comece com duas ou três regras ligadas às características que **realmente** importam para o seu sistema.',
      ],
      board: {
        title: 'Na prática: adotando sem travar o time',
        md: `1. **Escolha as características** que importam (ex.: domínio independente, latência do checkout).
2. **Escreva a verificação** mais simples que falha quando a característica piora.
3. **Rode no pipeline**: violação quebra o build, como um teste unitário.
4. **Legado?** Use uma **catraca** (*ratchet*): registre as violações atuais como linha de base e falhe só se o número **crescer**; a cada limpeza, baixe a linha.

\`\`\`python
LINHA_DE_BASE = 14          # violações conhecidas hoje (só pode diminuir)

def test_catraca_imports_do_dominio():
    atuais = len(violacoes(MODULOS, REGRAS))
    assert atuais <= LINHA_DE_BASE, f"{atuais} violações: surgiram novas!"
\`\`\`

> [!atencao] **Lei de Goodhart**: quando uma medida vira meta, deixa de ser uma boa medida. Um time cobrado por "D < 0,2" cria interfaces vazias só para subir o A. Métricas de acoplamento são **sinais para investigar**, não notas.

**Quando não usar:** protótipos descartáveis e sistemas pequenos, em que manter as regras custa mais que o risco de erosão.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Fitness functions, métricas de Martin e dois testes de arquitetura em código.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-evo-q1',
      concept: 'Fitness functions',
      say: 'Começando por um caso que eu já vi acontecer em mais de um time…',
      prompt: 'O time decidiu que o **domínio não importa infraestrutura** e registrou isso na wiki. Seis meses depois, há 14 `import sqlalchemy` dentro de `dominio/`. Qual mecanismo teria evitado a erosão de forma **objetiva e contínua**?',
      options: [
        { text: 'Uma **fitness function** no pipeline: um teste de arquitetura que analisa os imports e quebra o build na primeira violação.', correct: true, why: 'A regra vira verificação executável: o feedback chega no PR que introduz o problema, não meses depois.' },
        { text: 'Revisões de código mais rigorosas, com um checklist de arquitetura.', why: 'Ajuda, mas depende da atenção humana em cada PR — é subjetivo, não escala e falha justamente sob pressão de prazo.' },
        { text: 'Um diagrama C4 atualizado mostrando as camadas.', why: 'Documentação **comunica** a intenção, mas não **verifica** nada: o código pode divergir do desenho em silêncio.' },
        { text: 'Separar domínio e infraestrutura em microsserviços diferentes.', why: 'A rede impõe a fronteira, mas a um custo enorme (latência, falhas parciais, deploys coordenados). É um canhão para matar uma mosca.' },
      ],
      explanation: 'Regras que só existem em documentos sofrem **erosão**. Uma **fitness function** transforma a regra em verificação automática e objetiva — como um teste unitário, mas para uma característica da arquitetura. Code review e diagramas continuam úteis para **comunicar**; a fitness function serve para **garantir**.',
    },
    {
      type: 'mcq',
      id: 'arq-evo-q2',
      concept: 'Instabilidade (Ca/Ce)',
      say: 'Agora uma conta rápida — cuidado com a direção das setas.',
      prompt: 'O pacote `pagamentos` é importado por **3** pacotes (`pedidos`, `assinaturas`, `faturas`) e importa apenas **1** (`dinheiro`). Qual é a instabilidade **I** de `pagamentos`?',
      options: [
        { text: '`I = 0,25` — bem estável.', correct: true, why: 'Ce = 1 (de quem ele depende) e Ca = 3 (quem depende dele): I = 1 / (3 + 1) = 0,25.' },
        { text: '`I = 0,75` — bem instável.', why: 'Você trocou Ca por Ce. O numerador é o acoplamento **de saída**: I = Ce / (Ca + Ce).' },
        { text: '`I = 0,33`', why: 'Isso é Ce / Ca. O denominador é o **total** de acoplamentos, Ca + Ce.' },
        { text: '`I = 3`', why: 'I é uma razão entre 0 e 1; 3 é só o número de dependentes (Ca).' },
      ],
      explanation: '"Estável" aqui quer dizer **difícil de mudar**: três pacotes dependem de `pagamentos`, então qualquer mudança na API dele se propaga. Pelo **Princípio das Dependências Estáveis**, ele só deveria depender de coisas **ainda mais estáveis** — como `dinheiro`, com I = 0.',
    },
    {
      type: 'match',
      id: 'arq-evo-q3',
      concept: 'Métricas de acoplamento',
      say: 'Hora de fixar o vocabulário. Associe cada métrica ao que ela diz.',
      prompt: 'Associe cada **métrica de Martin** ao seu significado.',
      pairs: [
        { left: '`Ca` (aferente)', right: 'Quantos pacotes de fora dependem deste' },
        { left: '`Ce` (eferente)', right: 'De quantos pacotes este depende' },
        { left: '`I = Ce / (Ca + Ce)`', right: '0 = maximamente estável; 1 = maximamente instável' },
        { left: '`A`', right: 'Fração de classes abstratas e interfaces do pacote' },
        { left: '`D = |A + I − 1|`', right: 'Distância até a sequência principal' },
        { left: 'Zona de dor', right: 'Estável e concreto: todos dependem, ninguém consegue mudar' },
      ],
      explanation: 'Ca e Ce contam setas que **chegam** e que **saem**; I resume as duas numa escala de 0 a 1; A mede o quanto o pacote é feito de abstrações; e D mostra o quanto ele se afasta do equilíbrio **A + I = 1**. Um pacote com D alto está na **zona de dor** (estável e concreto) ou na **zona da inutilidade** (abstrato e sem uso).',
    },
    {
      type: 'open',
      id: 'arq-evo-q4',
      concept: 'Zona de dor',
      say: 'Pergunta de revisão de arquitetura. Me explica como você leria esse número.',
      prompt: 'O relatório de métricas mostrou o pacote `comum` com **Ca = 40, Ce = 2** e **A = 0** (só funções e classes concretas). Onde ele fica no gráfico A × I, qual é o risco e o que você proporia?',
      minWords: 25,
      rubric: [
        { label: 'Identifica a **zona de dor** (estável e concreto, longe da sequência principal)', keywords: ['zona de dor', 'zona da dor', 'zone of pain', ['estavel', 'concret'], 'sequencia principal', 'main sequence', 'distancia'], concept: 'Zona de dor', why: 'I = 2/42 ≈ 0,05 e A = 0: D ≈ 0,95, quase o máximo.' },
        { label: 'Explica o risco: **muitos dependentes**, mudanças se propagam e custam caro', keywords: ['dependentes', 'dependem dele', 'dependem do', '40 pacotes', 'propag', 'cascata', 'quebr', 'dificil de mudar', 'caro de mudar', 'custo de mudanca', 'rigid', 'impacto'], concept: 'Acoplamento aferente', why: 'Com Ca = 40, qualquer alteração no pacote pode quebrar 40 lugares.' },
        { label: 'Propõe **abstrações** (Protocol/ABC, inversão de dependência) ou **dividir** o pacote por coesão', keywords: ['abstra', 'interface', 'protocol', 'abc', 'inversao', 'dip', 'dividir', 'divisao', 'quebrar o pacote', 'separar', 'extrair', 'coes', 'menores'], concept: 'Princípio das Abstrações Estáveis', why: 'Subir o A (ou reduzir o Ca de cada parte) aproxima o pacote da sequência principal.' },
        { label: 'Considera a **volatilidade**: se o pacote quase não muda, o risco é baixo', keywords: ['volat', 'raramente muda', 'quase nao muda', 'muda pouco', 'nao muda', 'frequencia de mudanca', 'historico', 'git log', 'churn', 'depende de quanto'], concept: 'Volatilidade', why: 'A zona de dor só dói para pacotes que mudam: a `str` do Python mora lá e está tudo bem.' },
      ],
      modelAnswer: `Com Ca = 40 e Ce = 2, a instabilidade é I = 2 / 42 ≈ **0,05** — o pacote é extremamente **estável** (difícil de mudar). Como A = 0, ele é totalmente **concreto**: D = |0 + 0,05 − 1| ≈ 0,95. Ele está em cheio na **zona de dor**, longe da sequência principal.

O risco: **40 pacotes dependem dele**, então qualquer mudança se **propaga em cascata** — alterar uma função pode quebrar dezenas de lugares, e o time passa a ter medo de mexer.

Antes de agir, eu olharia a **volatilidade** (histórico no \`git log\`): se \`comum\` quase nunca muda, o risco é baixo e está tudo bem. Se ele muda com frequência, eu **dividiria** o pacote por coesão (um "comum" costuma ser um saco de coisas sem relação) e, nas partes que mudam, introduziria **abstrações** (\`Protocol\`/ABC, inversão de dependência) para que os dependentes conheçam só o contrato estável.`,
    },
    {
      type: 'code',
      id: 'arq-evo-q5',
      concept: 'Princípio das Dependências Estáveis',
      title: 'Instabilidade e dependências estáveis',
      say: 'Mão no código: calcule a instabilidade de cada pacote e aponte quem desrespeita a regra das dependências estáveis.',
      prompt: `Um grafo de dependências entre pacotes chega como \`{pacote: [pacotes dos quais ele depende]}\`.

**\`instabilidade(deps)\`** → \`dict\` com **I = Ce / (Ca + Ce)** para **todo** pacote que aparece no grafo — como chave **ou** como dependência.
- **Ce**: quantos pacotes **diferentes** ele usa · **Ca**: quantos pacotes **diferentes** o usam.
- Depender de si mesmo não conta; dependências repetidas contam uma vez.
- Pacote isolado (Ca + Ce = 0) tem I = \`0.0\`.

**\`violacoes_sdp(deps)\`** → lista **ordenada** de tuplas \`(a, b)\` para cada dependência \`a → b\` que viola o **Princípio das Dependências Estáveis**: \`b\` é **mais instável** que \`a\` (I(b) > I(a)). Empate não é violação.

Exemplo: \`instabilidade({"api": ["dominio"], "infra": ["dominio"]})\` → \`{"api": 1.0, "infra": 1.0, "dominio": 0.0}\`.`,
      starter: `def instabilidade(deps):
    """{pacote: [dependências]} -> {pacote: I}, com I = Ce / (Ca + Ce)."""
    pass


def violacoes_sdp(deps):
    """Lista ordenada de (a, b) em que a depende de b e I(b) > I(a)."""
    pass
`,
      tests: [
        {
          name: 'camadas clássicas',
          code: `r = instabilidade({"api": ["aplicacao", "dominio"], "aplicacao": ["dominio"], "infra": ["dominio"]})
esperado = {"api": 1.0, "aplicacao": 0.5, "dominio": 0.0, "infra": 1.0}
assert isinstance(r, dict), "instabilidade deve devolver um dict"
assert set(r) == set(esperado), f"pacotes esperados {sorted(esperado)}, obtidos {sorted(r)}"
for p, v in esperado.items():
    assert abs(r[p] - v) < 1e-9, f"I({p}) deveria ser {v}, obtido {r[p]}"`,
        },
        { name: 'I = Ce / (Ca + Ce)', expr: 'instabilidade({"a": ["b"], "c": ["b"], "d": ["b"], "b": ["e"]})["b"]', expected: '0.25', compare: 'approx' },
        { name: 'dependência sem chave própria também entra', expr: 'instabilidade({"app": ["libx"]})', expected: '{"app": 1.0, "libx": 0.0}' },
        {
          name: 'domínio dependendo de pacote instável',
          code: `deps = {
    "api": ["aplicacao", "dominio"],
    "aplicacao": ["dominio"],
    "infra": ["dominio"],
    "dominio": ["utils_http"],
    "utils_http": ["requests_wrapper", "config"],
}
v = violacoes_sdp(deps)
assert v == [("dominio", "utils_http")], f"esperado [('dominio', 'utils_http')], obtido {v}"`,
        },
        { name: 'grafo saudável não tem violações', expr: 'violacoes_sdp({"api": ["aplicacao", "dominio"], "aplicacao": ["dominio"], "infra": ["dominio"]})', expected: '[]' },
        {
          name: 'pacote isolado e auto-dependência',
          hidden: true,
          code: `r = instabilidade({"solo": [], "a": ["a", "b"]})
assert r["solo"] == 0.0, "pacote isolado (Ca + Ce = 0) deve valer 0.0"
assert abs(r["a"] - 1.0) < 1e-9 and r["b"] == 0.0, "depender de si mesmo não conta como acoplamento"
assert violacoes_sdp({"a": ["a"]}) == [], "auto-dependência não é violação"`,
        },
        { name: 'dependências repetidas contam uma vez', hidden: true, expr: 'instabilidade({"x": ["a"], "a": ["b", "b"]})["a"]', expected: '0.5', compare: 'approx' },
        {
          name: 'várias violações em ordem; empate não conta',
          hidden: true,
          code: `deps = {"p1": ["s"], "p2": ["s"], "p3": ["s"], "s": ["u", "v"], "u": ["w1", "w2", "w3"], "v": ["w1"]}
v = violacoes_sdp(deps)
assert v == [("s", "u"), ("s", "v")], f"obtido {v}"
assert violacoes_sdp({"a": ["b"], "b": ["a"]}) == [], "instabilidades iguais não violam o SDP"`,
        },
      ],
      reviews: [
        {
          when: m => m.calls.includes('round'),
          text: 'Você arredondou a instabilidade. Arredondar **antes de comparar** pode esconder violações (0,334 e 0,331 viram 0,33). Guarde o valor exato e arredonde só para exibir.',
          concept: 'Instabilidade (Ca/Ce)',
        },
        {
          when: m => m.names.includes('ZeroDivisionError'),
          text: 'Capturar `ZeroDivisionError` para o pacote isolado usa exceção como controle de fluxo e pode esconder outros bugs. Trate o caso `Ca + Ce == 0` explicitamente.',
          concept: 'Casos de borda explícitos',
        },
        {
          when: (m, code) => (code.match(/instabilidade\s*\(/g) || []).length < 2,
          text: '`violacoes_sdp` recalcula Ca e Ce por conta própria. Reaproveite `instabilidade(deps)`: uma única fonte de verdade para a métrica — e menos código para manter.',
          concept: 'DRY',
        },
      ],
      hints: [
        'Percorra o grafo **uma vez** montando dois dicionários de conjuntos: `eferentes[a]` (de quem `a` depende) e `aferentes[b]` (quem depende de `b`). `collections.defaultdict(set)` ajuda.',
        'Guarde num `set` todos os pacotes vistos — chaves **e** destinos — e ignore `destino == origem`. Depois: `I = ce / (ca + ce) if ca + ce else 0.0`.',
        'Em `violacoes_sdp`, calcule `i = instabilidade(deps)` uma vez e filtre as arestas com `i[b] > i[a]`; devolva `sorted(...)` de um conjunto de tuplas.',
      ],
      solution: `from collections import defaultdict


def instabilidade(deps):
    eferentes = defaultdict(set)   # pacote -> de quem ele depende
    aferentes = defaultdict(set)   # pacote -> quem depende dele
    pacotes = set(deps)
    for origem, destinos in deps.items():
        for destino in destinos:
            pacotes.add(destino)
            if destino != origem:              # depender de si mesmo não é acoplamento
                eferentes[origem].add(destino)
                aferentes[destino].add(origem)
    resultado = {}
    for pacote in pacotes:
        ca, ce = len(aferentes[pacote]), len(eferentes[pacote])
        resultado[pacote] = ce / (ca + ce) if ca + ce else 0.0
    return resultado


def violacoes_sdp(deps):
    i = instabilidade(deps)
    return sorted({(a, b) for a, destinos in deps.items() for b in destinos
                   if a != b and i[b] > i[a]})
`,
      solutionExplanation: 'Uma passada pelo grafo monta os conjuntos de aferentes e eferentes: conjuntos eliminam repetições e a auto-dependência é descartada. A instabilidade é **Ce / (Ca + Ce)**, com o caso 0/0 tratado explicitamente. `violacoes_sdp` reaproveita a métrica e aponta cada seta que vai de um pacote **mais estável** para um **mais instável** — exatamente o que o SDP proíbe. A correção típica é **inverter a dependência**: o `dominio` define um `Protocol` e o pacote instável o implementa, fazendo a seta apontar para o lado estável.',
    },
    {
      type: 'code',
      id: 'arq-evo-q6',
      concept: 'Testes de arquitetura',
      title: 'Fitness function: imports proibidos entre camadas',
      say: 'Último desafio: transforme a regra de dependência num teste de arquitetura de verdade. E sim, vou tentar te enganar com imports relativos!',
      prompt: `Os módulos chegam como \`{nome_do_modulo: código-fonte}\` — todo módulo é um arquivo \`.py\` (nenhum é \`__init__\`).

**\`regras_de_camadas(camadas)\`** — recebe as camadas da mais **alta** para a mais **baixa** e devolve \`{camada: conjunto das camadas que ela não pode importar}\` (ninguém importa camadas acima de si).

**\`imports_do_modulo(nome_modulo, codigo)\`** — conjunto dos nomes **absolutos** importados, **sem executar** o código:
- \`import a.b\` e \`import a.b as x\` → \`"a.b"\`
- \`from a.b import c, d\` → \`"a.b.c"\` e \`"a.b.d"\`
- import **relativo** dentro de \`loja.dominio.pedido\`: \`from . import x\` → \`"loja.dominio.x"\`; \`from ..infra import db\` → \`"loja.infra.db"\`
- import dentro de função conta; comentários e strings **não**

**\`violacoes(modulos, regras)\`** — \`regras\` é \`{prefixo: {prefixos proibidos}}\`. Um nome **casa** com um prefixo se for igual a ele ou começar com \`prefixo + "."\` (\`loja.api_client\` **não** é \`loja.api\`). Aplique a cada módulo todas as regras cujo prefixo casa com o nome dele e devolva a lista **ordenada** e **sem repetições** de tuplas \`(modulo, nome_importado)\`.`,
      starter: `import ast


def regras_de_camadas(camadas):
    """Camadas da mais ALTA para a mais BAIXA -> {camada: {camadas que ela NÃO pode importar}}."""
    pass


def imports_do_modulo(nome_modulo, codigo):
    """Conjunto dos nomes ABSOLUTOS importados pelo código (sem executá-lo)."""
    pass


def violacoes(modulos, regras):
    """Lista ORDENADA de (modulo, nome_importado) que violam as regras."""
    pass
`,
      tests: [
        {
          name: 'regras a partir das camadas',
          expr: '{k: set(v) for k, v in regras_de_camadas(["loja.api", "loja.aplicacao", "loja.dominio"]).items()}',
          expected: '{"loja.api": set(), "loja.aplicacao": {"loja.api"}, "loja.dominio": {"loja.api", "loja.aplicacao"}}',
        },
        {
          name: 'import, import … as e from … import',
          expr: 'imports_do_modulo("loja.dominio.pedido", "import os\\nimport sqlalchemy.orm as orm\\nfrom loja.infra.db import sessao, engine\\n")',
          expected: '{"os", "sqlalchemy.orm", "loja.infra.db.sessao", "loja.infra.db.engine"}',
          compare: 'set',
        },
        {
          name: 'comentários e strings não contam; import em função conta',
          code: `codigo = "# import sqlalchemy\\nTEXTO = 'from loja.infra import db'\\ndef enviar():\\n    import requests\\n    return requests\\n"
achados = imports_do_modulo("loja.dominio.email", codigo)
assert set(achados) == {"requests"}, f"esperado só {{'requests'}}, obtido {achados}"`,
        },
        {
          name: 'violações entre camadas',
          code: `REGRAS = {
    "loja.dominio": {"loja.api", "loja.aplicacao", "loja.infra", "sqlalchemy"},
    "loja.aplicacao": {"loja.api"},
}
MODULOS = {
    "loja.api.rotas": "from loja.aplicacao.criar_pedido import CriarPedido\\n",
    "loja.aplicacao.criar_pedido": "from loja.dominio.pedido import Pedido\\nfrom loja.api.rotas import app\\n",
    "loja.dominio.pedido": "from dataclasses import dataclass\\nimport sqlalchemy\\n",
    "loja.infra.repo": "from loja.dominio.pedido import Pedido\\nimport sqlalchemy\\n",
}
v = violacoes(MODULOS, REGRAS)
assert v == [("loja.aplicacao.criar_pedido", "loja.api.rotas.app"), ("loja.dominio.pedido", "sqlalchemy")], f"obtido {v}"`,
        },
        {
          name: '"from loja import infra" também importa infra',
          expr: 'violacoes({"loja.dominio.frete": "from loja import infra\\n"}, {"loja.dominio": {"loja.infra"}})',
          expected: '[("loja.dominio.frete", "loja.infra")]',
        },
        {
          name: 'imports relativos são resolvidos',
          hidden: true,
          code: `achados = imports_do_modulo("loja.dominio.pedido", "from ..infra import db\\nfrom .dinheiro import Dinheiro\\nfrom . import regras\\n")
assert set(achados) == {"loja.infra.db", "loja.dominio.dinheiro.Dinheiro", "loja.dominio.regras"}, f"obtido {achados}"
v = violacoes({"loja.dominio.pedido": "from ..infra import db\\n"}, {"loja.dominio": {"loja.infra"}})
assert v == [("loja.dominio.pedido", "loja.infra.db")], f"o import relativo escapou: {v}"`,
        },
        {
          name: 'prefixo respeita o ponto',
          hidden: true,
          code: `REGRAS = {"loja.dominio": {"loja.api", "sqlalchemy"}}
MODULOS = {
    "loja.dominio_legado.x": "import sqlalchemy\\n",
    "loja.dominio.y": "from loja import api_client\\nimport sqlalchemy_utils\\n",
}
v = violacoes(MODULOS, REGRAS)
assert v == [], f"loja.dominio_legado não é loja.dominio, e loja.api_client não é loja.api — obtido {v}"`,
        },
        {
          name: 'sem repetições, em ordem; módulos sem regra são ignorados',
          hidden: true,
          code: `REGRAS = {"loja.dominio": {"loja.api", "loja.infra", "sqlalchemy"}}
MODULOS = {
    "loja.dominio.b": "import sqlalchemy\\nimport sqlalchemy\\nfrom loja.api import rotas\\n",
    "loja.dominio.a": "def f():\\n    from loja.infra.fila import publicar\\n",
    "loja.util.x": "import sqlalchemy\\n",
}
v = violacoes(MODULOS, REGRAS)
assert v == [("loja.dominio.a", "loja.infra.fila.publicar"), ("loja.dominio.b", "loja.api.rotas"), ("loja.dominio.b", "sqlalchemy")], f"obtido {v}"`,
        },
      ],
      reviews: [
        {
          when: m => m.imports.includes('re'),
          text: 'Regex sobre o código-fonte é frágil: confunde comentários e strings com imports e tropeça em imports quebrados em várias linhas, entre parênteses. O `ast` enxerga a **estrutura** real do código.',
          concept: 'Análise estática com ast',
        },
        {
          when: m => ['exec', 'eval', '__import__', 'import_module'].some(c => m.calls.includes(c)),
          text: 'Executar ou importar o código para descobrir dependências dispara efeitos colaterais (conexões, variáveis de ambiente) e exige todas as bibliotecas instaladas. Uma fitness function de imports deve ser **análise estática**: `ast.parse` não executa nada.',
          concept: 'Análise estática com ast',
        },
      ],
      hints: [
        '`ast.walk(ast.parse(codigo))` visita **todos** os nós — inclusive imports dentro de funções. Comentários somem no parse, e texto dentro de strings nunca vira `ast.Import`.',
        'Para `ast.Import`, use `alias.name` de cada item de `no.names`. Para `ast.ImportFrom`, o nome é `origem + "." + alias.name`. Se `no.level > 0`, parta do pacote do módulo (`nome_modulo.split(".")[:-1]`), suba `no.level - 1` níveis e acrescente `no.module` (que pode ser `None`).',
        'Crie um auxiliar `casa(nome, prefixo)` com `nome == prefixo or nome.startswith(prefixo + ".")`, junte as violações num `set` e devolva `sorted(...)`. E `regras_de_camadas` cabe numa linha: `{c: set(camadas[:i]) for i, c in enumerate(camadas)}`.',
      ],
      solution: `import ast


def regras_de_camadas(camadas):
    return {camada: set(camadas[:i]) for i, camada in enumerate(camadas)}


def imports_do_modulo(nome_modulo, codigo):
    pacote = nome_modulo.split(".")[:-1]        # o módulo é um arquivo: o pacote é o "pai"
    nomes = set()
    for no in ast.walk(ast.parse(codigo)):
        if isinstance(no, ast.Import):
            nomes.update(alias.name for alias in no.names)
        elif isinstance(no, ast.ImportFrom):
            if no.level:                          # relativo: sobe (level - 1) níveis
                base = pacote[: len(pacote) - (no.level - 1)]
                origem = ".".join(base + ([no.module] if no.module else []))
            else:
                origem = no.module
            nomes.update(f"{origem}.{alias.name}" for alias in no.names)
    return nomes


def casa(nome, prefixo):
    return nome == prefixo or nome.startswith(prefixo + ".")


def violacoes(modulos, regras):
    encontradas = set()
    for nome, codigo in modulos.items():
        proibidos = set()
        for camada, lista in regras.items():
            if casa(nome, camada):
                proibidos |= set(lista)
        for importado in imports_do_modulo(nome, codigo):
            if any(casa(importado, p) for p in proibidos):
                encontradas.add((nome, importado))
    return sorted(encontradas)
`,
      solutionExplanation: 'A fitness function é **análise estática**: o `ast` lê a estrutura do código sem executá-lo, enxerga imports dentro de funções e ignora comentários e strings — onde uma regex tropeçaria. Imports relativos são resolvidos para nomes **absolutos** antes da checagem; senão `from ..infra import db` passaria escondido. O casamento de prefixos respeita o ponto (`loja.api` ≠ `loja.api_client`). Rodando no CI, a regra de dependência deixa de ser um desenho na wiki e vira um teste que quebra o build — é o que o **import-linter** faz com os contratos `layers` e `forbidden`.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Recapitulando: a arquitetura **erode** em silêncio, e **fitness functions** transformam decisões em verificações objetivas no pipeline…',
        '…enquanto as métricas de Martin — **Ca, Ce, I, A e D** — mostram quem é estável, quem deveria ser abstrato e quem está na **zona de dor**. Na próxima aula: como **registrar** e **comunicar** essas decisões com ADRs e o modelo C4!',
      ],
      board: null,
    },
  ],
});
