(function () {
  // Código Python do exercício prático (String.raw preserva as barras das regex).
  const SNAP_STARTER = String.raw`import difflib
import re

UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
)
DATA_HORA_RE = re.compile(
    r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?"
)


def normalizar(texto):
    # TODO: cada UUID -> <UUID_1>, <UUID_2>... (o mesmo UUID recebe sempre o mesmo número)
    # TODO: cada data-hora ISO -> <DATA_HORA>  (datas sem hora ficam como estão)
    return texto


def verificar_snapshot(nome, recebido, aprovados):
    # TODO: devolva "novo" ou "ok" — ou levante AssertionError com um diff unificado
    pass
`;

  const SNAP_SOLUTION = String.raw`import difflib
import re

UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
)
DATA_HORA_RE = re.compile(
    r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?"
)


def normalizar(texto):
    vistos = {}  # estado de UMA chamada: a numeração recomeça a cada texto

    def marcador(m):
        uuid = m.group(0).lower()
        if uuid not in vistos:
            vistos[uuid] = f"<UUID_{len(vistos) + 1}>"
        return vistos[uuid]

    texto = UUID_RE.sub(marcador, texto)
    return DATA_HORA_RE.sub("<DATA_HORA>", texto)


def verificar_snapshot(nome, recebido, aprovados):
    recebido = normalizar(recebido)
    if nome not in aprovados:
        aprovados[nome] = recebido
        return "novo"
    aprovado = aprovados[nome]
    if recebido == aprovado:
        return "ok"
    diff = difflib.unified_diff(
        aprovado.splitlines(),
        recebido.splitlines(),
        fromfile=f"{nome}.approved",
        tofile=f"{nome}.received",
        lineterm="",
    )
    raise AssertionError("\n".join(diff))
`;

  Game.registerModule('testing', {
    id: 'snapshot-approval',
    title: 'Snapshot, golden master e approval tests',
    kind: 'lesson',
    level: 2,
    order: 33,
    unit: 'qualidade',
    summary: 'Congele uma saída aprovada, compare cada execução com um diff legível — e aprenda a não aprovar bug sem ler.',
    concepts: ['Snapshot testing', 'Golden master', 'Approval testing', 'Scrubbers', 'Aprovação cega'],
    takeaways: [
      'Snapshot/approval testing compara a saída atual com uma versão **aprovada** e versionada; qualquer diferença vira um **diff** para um humano julgar.',
      'Brilha em **código legado** (golden master antes de refatorar) e em **saídas grandes** — relatórios, JSON de API, HTML, SQL gerado.',
      'Snapshot detecta **mudança**, não **erro**: se a primeira saída estava errada, o bug foi aprovado junto. Revise o diff como código — nada de aprovação cega.',
      'Campos voláteis deixam o snapshot frágil: **injete** relógio e IDs quando der e passe *scrubbers* no resto, com marcadores numerados (`<UUID_1>`) que preservam relações.',
      'Prefira snapshots **pequenos e focados** e mantenha asserts explícitos para as regras de negócio críticas.',
    ],
    glossary: [
      { term: 'Snapshot testing', aliases: ['teste de snapshot', 'testes de snapshot', 'snapshot tests'], definition: 'Técnica que grava a saída de um código (o *snapshot*) e, nas execuções seguintes, compara a nova saída com a gravada: qualquer diferença deixa o teste vermelho e mostra um diff.' },
      { term: 'Golden master', aliases: ['golden file', 'golden files', 'golden masters'], definition: 'Saída de referência capturada do sistema atual (a "matriz") e usada para detectar qualquer mudança de comportamento. Técnica clássica para proteger código legado antes de refatorar.' },
      { term: 'Approval testing', aliases: ['approval tests', 'teste de aprovação', 'testes de aprovação', 'ApprovalTests'], definition: 'Variante do snapshot em que a saída nova vira um arquivo *received* e só passa a valer quando um humano a aprova (vira *approved*). Popularizada pela biblioteca ApprovalTests, de Llewellyn Falco.' },
      { term: 'Scrubber', aliases: ['scrubbers', 'scrubbing'], definition: 'Função que normaliza campos voláteis (datas, UUIDs, caminhos, portas) antes de comparar um snapshot, trocando-os por marcadores estáveis como `<DATA_HORA>` ou `<UUID_1>`.' },
      { term: 'Change-detector test', aliases: ['change detector test', 'change-detector tests', 'teste detector de mudanças'], definition: 'Teste que quebra a cada mudança do código, mesmo quando o comportamento continua correto. Custa manutenção, quase não pega bug e ensina o time a "aprovar" o vermelho sem ler.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Como você testaria um relatório de 80 linhas, um JSON com 40 campos ou o HTML de um e-mail? Um `assert` por detalhe não escala.',
          'A saída é o **snapshot testing**: você grava a saída uma vez, revisa com atenção, e daí em diante o teste compara cada execução com essa versão **aprovada**.',
        ],
        board: {
          title: 'Snapshot, golden master, approval: a mesma ideia',
          md: `\`\`\`text
1ª execução:  código ──▶ saída ──▶ revisão humana ──▶ grava como APROVADA
depois:       código ──▶ saída ──▶ compara com a aprovada
                                     ├── igual      ──▶ ✅ verde
                                     └── diferente  ──▶ ❌ vermelho + diff
\`\`\`

| Nome | De onde vem | Como se aprova |
|---|---|---|
| **Snapshot testing** | Popularizado pelo Jest (2016); em Python, o plugin \`syrupy\` | \`pytest --snapshot-update\` regrava |
| **Golden master** / *golden file* | A "matriz" de referência; idioma comum em Go (\`testdata/*.golden\`) | uma flag \`-update\` nos testes |
| **Approval testing** | Biblioteca ApprovalTests, de Llewellyn Falco | promover \`*.received.txt\` a \`*.approved.txt\` |

> [!dica] Os nomes mudam, a mecânica é a mesma: **saída aprovada + comparação + diff**. A diferença está em *como* se aprova — um comando ou um humano promovendo o arquivo.`,
        },
      },
      {
        type: 'say',
        text: [
          'Em Python, o plugin `syrupy` deixa o teste minúsculo: a fixture `snapshot` guarda e compara a saída. O ApprovalTests faz o mesmo com uma função `verify`.',
          'Os arquivos aprovados vão para o **repositório** e passam por code review como qualquer outro código.',
        ],
        board: {
          title: 'Snapshot na prática (pytest)',
          md: `\`\`\`python
# pip install syrupy  — plugin do pytest
def test_relatorio_mensal(snapshot):
    saida = relatorio_mensal(vendas_de_exemplo())
    assert saida == snapshot     # 1ª vez: pytest --snapshot-update grava em __snapshots__/


# pip install approvaltests
from approvaltests import verify


def test_relatorio_mensal_aprovado():
    verify(relatorio_mensal(vendas_de_exemplo()))
    # grava *.received.txt e compara com *.approved.txt — que você revisa e commita
\`\`\`

> [!dica] Existe também o **inline snapshot**: a ferramenta escreve o valor aprovado **dentro do próprio teste** — \`assert saida == snapshot("...")\` com a biblioteca \`inline-snapshot\`, ou \`toMatchInlineSnapshot\` no Jest. Ótimo para saídas curtas: o esperado fica visível no código.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Onde isso brilha? Primeiro, em **código legado**: antes de mexer em algo que ninguém entende, você captura o comportamento atual — certo ou errado — e refatora sem mudar a saída.',
          'Segundo, em **saídas grandes e estruturadas**: relatórios, serializadores, respostas de API, templates. Já para uma regra com um ou dois valores, um `assert` explícito continua melhor.',
        ],
        board: {
          title: 'Quando usar (e quando não)',
          md: `| ✅ Bom uso | ❌ Mau uso |
|---|---|
| Rede de segurança para refatorar **legado** (golden master) | Regra de negócio com 1–2 valores: \`assert\` explícito é mais claro |
| Saídas grandes: relatório, JSON de API, HTML, saída de CLI | Saída que muda a cada commit (markup de UI em evolução) |
| Formato que **não pode** mudar sem querer (serialização, arquivo exportado) | Saída não determinística que você não consegue normalizar |
| Cobrir **muitas combinações** de entrada de uma vez | Time que aprova diffs sem ler |

\`\`\`python
# golden master de um cálculo legado: muitas combinações num snapshot só
def test_golden_master_do_frete(snapshot):
    linhas = []
    for peso in (0, 1, 5, 30):
        for uf in ("SP", "AM", "RS"):
            for expresso in (False, True):
                valor = calcular_frete(peso, uf, expresso)
                linhas.append(f"{peso}kg {uf} expresso={expresso}: {valor}")
    assert "\\n".join(linhas) == snapshot
\`\`\`

> [!sabia] O ApprovalTests tem uma função só para isso: \`verify_all_combinations\`, que roda o código com o **produto cartesiano** das entradas e aprova tudo num arquivo. É a técnica clássica do kata **Gilded Rose** (mantido por Emily Bache): cobrir um código horroroso com golden master **antes** de refatorar — um *teste de caracterização* em escala.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o lado sombrio. Um snapshot não sabe o que é **certo** — só o que é **diferente**. Se a primeira saída tinha um bug, o bug foi aprovado junto.',
          'E quando o teste quebra, a tentação é rodar `--snapshot-update` e seguir a vida. Isso tem nome: **aprovação cega**.',
        ],
        board: {
          title: '⚠️ Armadilhas do snapshot',
          md: `| Armadilha | Sintoma | Antídoto |
|---|---|---|
| **Aprovação cega** | CI vermelho → \`--snapshot-update\` → commit, sem ler o diff | Revisar o diff do snapshot no PR como código; no CI, snapshot ausente ou diferente **falha** (no Jest, a flag \`--ci\`) |
| **Snapshot gigante** | 500 linhas; qualquer mudança quebra; ninguém lê o diff | Snapshots **pequenos e focados**, com nome que diga o que protegem |
| **Snapshot frágil** | Muda a cada execução: data, UUID, ordem de \`set\`, float, caminho | Injetar relógio e IDs; ordenar coleções; **scrubbers** no que sobrar |
| **Bug congelado** | A saída "aprovada" já estava errada | Conferir a 1ª versão com cuidado; asserts explícitos nas regras críticas |

> [!atencao] Teste que quebra a cada mudança legítima vira um **change-detector test**: custa manutenção, quase não pega bug e ensina o time a ignorar o vermelho.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E os campos que mudam sozinhos, como datas e UUIDs? Primeiro, **injete** o que der: relógio falso, gerador de IDs com semente.',
          'O que sobrar passa por um *scrubber*: uma função que troca o valor volátil por um marcador estável **antes** de comparar.',
        ],
        board: {
          title: 'Scrubbers: normalizando o que é volátil',
          md: `\`\`\`python
import re

UUID_RE = re.compile(r"\\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\b", re.IGNORECASE)
DATA_HORA_RE = re.compile(r"\\b\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?")


def scrub(texto):
    texto = UUID_RE.sub("<UUID>", texto)          # versão ingênua: todo UUID vira <UUID>
    return DATA_HORA_RE.sub("<DATA_HORA>", texto)


def test_recibo(snapshot):
    assert scrub(emitir_recibo(pedido_de_exemplo())) == snapshot
\`\`\`

O marcador fixo tem um problema: ele **apaga relações**. Com marcadores **numerados**, o mesmo valor ganha sempre o mesmo número:

\`\`\`text
saída real (muda a cada execução)       com scrubber numerado
pedido 9f1c0b7e-…-3a2e                  pedido <UUID_1>
criado em 2026-09-28T10:31:02.123Z      criado em <DATA_HORA>
cliente 4b7a2d19-…-77f0                 cliente <UUID_2>
reembolso do pedido 9f1c0b7e-…-3a2e     reembolso do pedido <UUID_1>   ← o mesmo pedido!
\`\`\`

> [!sabia] O nome *scrubber* vem das bibliotecas de approval testing. O **Verify**, do mundo .NET, troca GUIDs e datas por \`Guid_1\`, \`DateTime_1\`… **por padrão**, numerando como acima. E cuidado para não "limpar demais": uma data de vencimento (\`2026-10-10\`) é **dado de negócio** — o scrubber deve mirar só no que é volátil, como carimbos de tempo.`,
        },
      },
      {
        type: 'say',
        text: [
          'Última peça: o **diff legível**. "Esperado: 80 linhas, obtido: 80 linhas" não ajuda ninguém; o formato unificado mostra só o que mudou, com um pouco de contexto.',
          'Em Python, a biblioteca padrão resolve: `difflib.unified_diff`.',
        ],
        board: {
          title: 'Diff unificado com difflib',
          md: `\`\`\`python
import difflib

aprovado = "cliente: Ana\\nstatus: pago\\ntotal: 120.00"
recebido = "cliente: Ana\\nstatus: cancelado\\ntotal: 120.00"

diff = difflib.unified_diff(
    aprovado.splitlines(), recebido.splitlines(),
    fromfile="pedido.approved", tofile="pedido.received", lineterm="",
)
print("\\n".join(diff))
\`\`\`

\`\`\`text
--- pedido.approved
+++ pedido.received
@@ -1,3 +1,3 @@
 cliente: Ana
-status: pago
+status: cancelado
 total: 120.00
\`\`\`

> [!dica] É o mesmo formato do \`git diff\`: \`-\` saiu, \`+\` entrou, linhas começando com espaço são contexto. Nenhum revisor precisa aprender nada novo.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Duas situações reais, um jogo de termos, um comparador de snapshots para implementar e uma pergunta de entrevista.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-snap-q1',
        concept: 'Aprovação cega',
        say: 'Cena real de sexta-feira à tarde…',
        prompt: `O teste de snapshot do relatório de faturamento quebrou no CI depois de um PR que "só renomeou variáveis". A dev roda \`pytest --snapshot-update\`, o teste fica verde e ela faz o merge.

Qual é o problema?`,
        options: [
          { text: 'Um refactor não deveria mudar a saída: o diff era justamente o sinal de uma mudança de comportamento — e foi aprovado sem ser lido.', correct: true, why: 'Snapshot só detecta *diferença*; quem decide se ela é correta é a pessoa que lê o diff. Regravar sem ler desliga o teste.' },
          { text: 'Nenhum: se o teste ficou verde, a suíte está saudável.', why: 'Verde depois de `--snapshot-update` é verde por definição — o snapshot passou a ser a saída nova, certa ou errada.' },
          { text: 'O problema é usar snapshot: relatórios deveriam ser testados só com asserts linha a linha.', why: 'Para saídas grandes, snapshot é uma boa ferramenta. O que falhou foi o processo de aprovação, não a técnica.' },
          { text: 'Ela deveria apagar o snapshot antigo e deixar a próxima execução gravar um novo.', why: 'Dá no mesmo que o `--snapshot-update`: aprova a saída nova sem revisão.' },
        ],
        explanation: 'Isso é **aprovação cega** (*rubber stamping*). Um refactor, por definição, não muda comportamento — se o snapshot mudou, algo mudou de verdade. O diff do snapshot deve ser revisado no PR como código, e no CI um snapshot ausente ou diferente deve **falhar**, nunca ser regravado automaticamente.',
      },
      {
        type: 'mcq',
        id: 'tst-snap-q2',
        concept: 'Scrubbers',
        say: 'Agora um snapshot que ninguém aguenta mais…',
        prompt: `Este teste de snapshot da API de pedidos fica vermelho em **toda** execução, sempre com um diff assim:

\`\`\`text
--- pedido.approved
+++ pedido.received
@@ -1,6 +1,6 @@
 {
-  "id": "5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87",
-  "criado_em": "2026-09-27T18:02:11.482Z",
+  "id": "b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10",
+  "criado_em": "2026-09-28T09:15:40.007Z",
   "status": "pago",
   "itens": ["caneta", "caderno"]
 }
\`\`\`

Qual a melhor correção?`,
        options: [
          { text: 'Tornar a comparação determinística: injetar relógio e gerador de IDs onde der e aplicar um scrubber que troque UUIDs e datas por marcadores (`<UUID_1>`, `<DATA_HORA>`) antes de comparar.', correct: true, why: 'Remove só o ruído; `status`, `itens` e o formato continuam protegidos.' },
          { text: 'Rodar `--snapshot-update` como primeiro passo do CI, antes dos testes.', why: 'Aí o teste nunca falha — nem quando o `status` estiver errado.' },
          { text: 'Remover `id` e `criado_em` da resposta da API para o teste passar.', why: 'É mudar o produto para agradar o teste: os clientes da API precisam desses campos.' },
          { text: 'Trocar o snapshot por `assert "pago" in resposta`.', why: 'Resolve a fragilidade jogando fora quase toda a proteção: itens, campos e formato deixam de ser verificados.' },
        ],
        explanation: 'Campos voláteis tornam o snapshot **frágil**. A ordem de preferência: (1) **injetar** o que é não determinístico (relógio, gerador de IDs com semente); (2) **normalizar** com scrubbers o que não dá para injetar; (3) nunca desligar a verificação. Com marcadores **numerados**, o snapshot ainda mostra quais IDs eram iguais entre si.',
      },
      {
        type: 'match',
        id: 'tst-snap-q3',
        concept: 'Approval testing',
        say: 'Rodada rápida de vocabulário!',
        prompt: 'Associe cada termo ao seu significado.',
        pairs: [
          { left: 'Golden master', right: 'Saída de referência capturada do sistema atual para detectar qualquer mudança' },
          { left: 'Arquivo `.received`', right: 'Saída da execução atual, esperando a revisão de um humano' },
          { left: 'Arquivo `.approved`', right: 'Saída revisada e aceita, versionada junto com o código' },
          { left: 'Scrubber', right: 'Troca valores voláteis (datas, UUIDs) por marcadores estáveis' },
          { left: 'Inline snapshot', right: 'Valor aprovado que a ferramenta escreve dentro do próprio teste' },
          { left: 'Change-detector test', right: 'Teste que quebra a cada mudança, mesmo com o comportamento correto' },
        ],
        explanation: 'No approval testing, a execução produz um **received**; um humano compara com o **approved** e, se a mudança for desejada, promove um ao outro. **Golden master** é o nome clássico da saída de referência; o **inline snapshot** guarda esse valor no próprio teste. **Scrubbers** evitam snapshots frágeis — e snapshots frágeis demais viram **change-detector tests**.',
      },
      {
        type: 'code',
        id: 'tst-snap-q4',
        concept: 'Scrubbers',
        title: 'Comparador de snapshots com scrubbers',
        say: 'Agora é com você: um mini approval testing, com scrubber numerado e diff legível.',
        prompt: `Implemente duas funções. As regex \`UUID_RE\` e \`DATA_HORA_RE\` já estão prontas.

**\`normalizar(texto)\`** — o *scrubber*:
- cada **UUID** vira \`<UUID_1>\`, \`<UUID_2>\`… na ordem em que aparece **pela primeira vez**; o **mesmo** UUID (ignorando maiúsculas/minúsculas) recebe sempre o **mesmo** número;
- cada **data-hora** ISO 8601 (ex.: \`2026-09-28T10:31:02.123Z\`) vira \`<DATA_HORA>\`; datas **sem** hora (\`2026-10-10\`) são dado de negócio e ficam como estão;
- a numeração **recomeça** a cada chamada.

**\`verificar_snapshot(nome, recebido, aprovados)\`** — \`aprovados\` é um \`dict\` *nome → texto aprovado*:
- normalize \`recebido\`;
- se ainda não há snapshot com esse \`nome\`, grave-o em \`aprovados\` e devolva \`"novo"\`;
- se é igual ao aprovado, devolva \`"ok"\`;
- se é diferente, **não** altere o aprovado: levante \`AssertionError\` cuja mensagem é o **diff unificado** (aprovado → recebido, linha a linha) com os cabeçalhos \`--- <nome>.approved\` e \`+++ <nome>.received\`.`,
        starter: SNAP_STARTER,
        tests: [
          { name: 'UUIDs viram marcadores numerados', expr: 'normalizar("pedido 5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87 do cliente b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10")', expected: '"pedido <UUID_1> do cliente <UUID_2>"' },
          { name: 'o mesmo UUID recebe o mesmo número', expr: 'normalizar("a=5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87 b=b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10 c=5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87")', expected: '"a=<UUID_1> b=<UUID_2> c=<UUID_1>"' },
          { name: 'data-hora vira <DATA_HORA>; data pura fica', expr: 'normalizar("criado_em: 2026-09-28T10:31:02.123Z\\nvencimento: 2026-10-10")', expected: '"criado_em: <DATA_HORA>\\nvencimento: 2026-10-10"' },
          {
            name: 'primeira vez: grava e devolve "novo"',
            code: String.raw`aprovados = {}
assert verificar_snapshot("pedido", "status: pago", aprovados) == "novo"
assert aprovados == {"pedido": "status: pago"}, aprovados`,
          },
          {
            name: 'só o ID e o horário mudaram: "ok"',
            code: String.raw`aprovados = {}
verificar_snapshot("pedido", "id=5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87 em 2026-09-27T18:02:11Z", aprovados)
r = verificar_snapshot("pedido", "id=b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10 em 2026-09-28T09:15:40.007Z", aprovados)
assert r == "ok", f"esperado 'ok', obtido {r!r}"`,
          },
          {
            name: 'saída diferente: AssertionError com diff',
            code: String.raw`aprovados = {}
verificar_snapshot("pedido", "cliente: Ana\nstatus: pago\ntotal: 120.00", aprovados)
erro = None
try:
    verificar_snapshot("pedido", "cliente: Ana\nstatus: cancelado\ntotal: 120.00", aprovados)
except AssertionError as e:
    erro = e
assert erro is not None, "uma saída diferente deveria levantar AssertionError"
msg = str(erro)
assert "--- pedido.approved" in msg and "+++ pedido.received" in msg, "faltam os cabeçalhos do diff:\n" + msg
assert "-status: pago" in msg and "+status: cancelado" in msg, "o diff deveria ter -status: pago e +status: cancelado:\n" + msg`,
          },
          { name: 'UUID em maiúsculas é o mesmo UUID', hidden: true, expr: 'normalizar("5D0C7A4E-1F0B-4A57-9D8E-3C2B1A0F9E87 / 5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87")', expected: '"<UUID_1> / <UUID_1>"' },
          {
            name: 'a numeração recomeça a cada chamada',
            hidden: true,
            code: String.raw`normalizar("x 5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87")
r = normalizar("y b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10")
assert r == "y <UUID_1>", f"a numeração deveria recomeçar em cada chamada, obtido {r!r}"`,
          },
          { name: 'data-hora com fuso e sem fração', hidden: true, expr: 'normalizar("inicio=2026-01-02T03:04:05-03:00 fim=2026-01-02T03:04:05")', expected: '"inicio=<DATA_HORA> fim=<DATA_HORA>"' },
          {
            name: 'o snapshot gravado já vem normalizado',
            hidden: true,
            code: String.raw`aprovados = {}
verificar_snapshot("p", "id=5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87", aprovados)
assert aprovados["p"] == "id=<UUID_1>", aprovados["p"]`,
          },
          {
            name: 'uma falha não sobrescreve o aprovado',
            hidden: true,
            code: String.raw`aprovados = {}
verificar_snapshot("r", "a\nb", aprovados)
try:
    verificar_snapshot("r", "a\nc", aprovados)
except AssertionError:
    pass
assert aprovados["r"] == "a\nb", "um snapshot diferente não pode sobrescrever o aprovado"`,
          },
          {
            name: 'o diff compara os textos já normalizados',
            hidden: true,
            code: String.raw`aprovados = {}
verificar_snapshot("p", "id=5d0c7a4e-1f0b-4a57-9d8e-3c2b1a0f9e87\nstatus: pago", aprovados)
erro = None
try:
    verificar_snapshot("p", "id=b91e22d3-7c4a-4f1e-8a2b-6d5e4c3b2a10\nstatus: cancelado", aprovados)
except AssertionError as e:
    erro = e
assert erro is not None, "uma saída diferente deveria levantar AssertionError"
assert "b91e22d3" not in str(erro), "o diff deveria comparar os textos já normalizados"`,
          },
          {
            name: 'snapshots com nomes diferentes são independentes',
            hidden: true,
            code: String.raw`aprovados = {}
assert verificar_snapshot("a", "um", aprovados) == "novo"
assert verificar_snapshot("b", "dois", aprovados) == "novo"
assert verificar_snapshot("a", "um", aprovados) == "ok"
assert verificar_snapshot("b", "dois", aprovados) == "ok"`,
          },
        ],
        reviews: [
          {
            when: (m, code) => !/unified_diff/.test(code),
            text: 'Você montou o diff na mão. O `difflib.unified_diff` da biblioteca padrão já gera o formato unificado com contexto — o mesmo do `git diff`, que todo revisor sabe ler — e lida com linhas inseridas ou removidas no meio.',
            concept: 'Diff legível',
          },
          {
            when: (m, code) => /^\s*global\s/m.test(code),
            text: 'Você usou `global` para a numeração dos UUIDs. Esse estado pertence a **uma** chamada: um `dict` local (visto por uma função interna) evita que um texto contamine o próximo — o mesmo princípio de testes isolados.',
            concept: 'Estado compartilhado',
          },
        ],
        hints: [
          'Em `normalizar`, use `UUID_RE.sub(funcao, texto)`: o `re.sub` aceita uma **função** que recebe o *match* e devolve o texto de troca. Guarde num `dict` local os UUIDs já vistos.',
          'Use `m.group(0).lower()` como chave (maiúsculas e minúsculas contam como o mesmo UUID) e `f"<UUID_{len(vistos) + 1}>"` como marcador. Depois, `DATA_HORA_RE.sub("<DATA_HORA>", texto)`.',
          'No diff: `"\\n".join(difflib.unified_diff(aprovado.splitlines(), recebido.splitlines(), fromfile=f"{nome}.approved", tofile=f"{nome}.received", lineterm=""))` — e então `raise AssertionError(diff)`.',
        ],
        solution: SNAP_SOLUTION,
        solutionExplanation: 'O `re.sub` com função permite decidir o marcador de cada UUID: um `dict` **local** lembra quais já apareceram, então o mesmo valor ganha o mesmo número e cada chamada recomeça do 1. A comparação acontece **depois** de normalizar, e o diff unificado (com cabeçalhos `.approved`/`.received`) mostra só o que mudou. Repare que uma falha **não** toca em `aprovados`: aprovar é decisão de um humano, não do teste.',
      },
      {
        type: 'open',
        id: 'tst-snap-q5',
        concept: 'Snapshot testing',
        say: 'Para fechar, como numa entrevista de líder técnica.',
        prompt: 'Seu time quer adotar snapshot testing no projeto inteiro. **Quando** você recomendaria a técnica e que **cuidados** exigiria para os snapshots não virarem ruído?',
        minWords: 25,
        rubric: [
          { label: 'Cita bons usos: **legado** (golden master) ou **saídas grandes** (relatório, JSON, HTML)', keywords: ['legado', 'legacy', 'golden', 'caracteriza', 'saida grande', 'saidas grandes', 'relatorio', 'json', 'html', 'serializ'], concept: 'Golden master' },
          { label: 'Alerta para a **aprovação cega**: o diff precisa ser revisado (PR/CI não regrava sozinho)', keywords: ['aprovacao cega', 'aprovar sem', 'aprova sem', 'sem ler', 'revis', 'code review', 'rubber stamp', 'rubber-stamp', 'snapshot-update', 'regrav'], concept: 'Aprovação cega', why: 'Snapshot detecta mudança, não erro: quem garante a corretude é quem lê o diff.' },
          { label: 'Trata **campos voláteis**: injeção de relógio/IDs e **scrubbers**', keywords: ['volat', 'scrub', 'normaliz', 'mascar', 'uuid', 'timestamp', 'carimbo', 'relogio', 'determin', 'fragil'], concept: 'Scrubbers' },
          { label: 'Mantém snapshots **pequenos/focados** e **asserts explícitos** nas regras críticas', keywords: ['pequen', 'focad', 'explicit', 'regra de negocio', 'regras de negocio', 'regras critic', 'granular', 'change-detector', 'change detector'], concept: 'Snapshots focados' },
        ],
        modelAnswer: `Eu recomendaria snapshot onde ele brilha: como **golden master** para proteger **código legado** antes de refatorar, e em **saídas grandes** e estruturadas — relatórios, respostas JSON, HTML de e-mails, serialização.

Os cuidados: primeiro, combater a **aprovação cega** — o diff do snapshot é **revisado** no PR como código, e o CI nunca regrava snapshots sozinho (\`--snapshot-update\` só localmente, com leitura do diff). Segundo, tratar **campos voláteis**: injetar relógio e gerador de IDs e aplicar **scrubbers** para datas e UUIDs, senão o teste fica frágil. Terceiro, manter snapshots **pequenos e focados**, e usar asserts **explícitos** para as regras de negócio críticas — senão o snapshot vira um *change-detector test* que ninguém lê.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Snapshot é uma ferramenta poderosa para **legado** e **saídas grandes** — desde que alguém leia o diff.',
          'Lembre: injete o que é volátil, passe *scrubbers* no resto, mantenha snapshots pequenos e nunca aprove sem ler. No próximo módulo vamos testar com **dependências de verdade**: bancos, contêineres e contratos.',
        ],
        board: null,
      },
    ],
  });
})();
