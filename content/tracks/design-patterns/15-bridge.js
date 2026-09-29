(function () {
  // Implementações (formatos) já prontas no código inicial — e repetidas na solução.
  const FORMATOS_PRONTOS = `# ── Implementações (formatos) ─────────────────────────────
class Texto:
    def titulo(self, texto):
        return f"== {texto} =="

    def linha(self, celulas):
        return " ; ".join(celulas)

    def documento(self, partes):
        return "\\n".join(partes)


class HTML:
    def titulo(self, texto):
        return f"<h1>{texto}</h1>"

    def linha(self, celulas):
        return "<tr>" + "".join(f"<td>{c}</td>" for c in celulas) + "</tr>"

    def documento(self, partes):
        return partes[0] + "<table>" + "".join(partes[1:]) + "</table>"
`;

  Game.registerModule('design-patterns', {
    id: 'bridge',
    title: 'Bridge',
    kind: 'lesson',
    level: 3,
    order: 25,
    unit: 'estruturais',
    summary: 'Separar a abstração da implementação para que as duas variem sozinhas — e fugir da explosão de classes N×M.',
    concepts: ['Bridge', 'Abstração × implementação', 'Explosão N×M', 'Composição sobre herança', 'Bridge × Strategy'],
    takeaways: [
      'Quando **duas dimensões** variam juntas (tipo × canal, forma × renderizador), herança gera **N × M** classes; o Bridge as separa em duas hierarquias: **N + M**.',
      'A **abstração** guarda uma referência à **implementação** (a ponte, por composição) e escreve suas operações de alto nível usando só as **primitivas** dela.',
      '"Abstração" e "implementação" são **camadas** (o quê × como), não "classe abstrata" e "subclasse concreta".',
      'Bridge e Strategy têm a mesma forma; o Strategy troca **um algoritmo**, o Bridge separa **hierarquias inteiras** — e é planejado **antes**, enquanto o Adapter conserta **depois**.',
      'Com uma dimensão só de variação, o Bridge é indireção sem retorno (YAGNI).',
    ],
    glossary: [
      { term: 'Bridge', aliases: ['padrão Bridge', 'bridge pattern'], definition: 'Padrão estrutural que separa uma abstração da sua implementação em duas hierarquias ligadas por composição, para que as duas variem de forma independente.' },
      { term: 'Implementor', aliases: ['implementors', 'implementador'], definition: 'No Bridge, a interface das operações **primitivas** (de baixo nível) que a abstração usa. Cada plataforma, canal ou tecnologia é uma implementação concreta dela.' },
      { term: 'Explosão combinatória de classes', aliases: ['explosão de classes', 'explosão de subclasses', 'explosão N×M', 'class explosion'], definition: 'Quando cada combinação de duas (ou mais) dimensões de variação vira uma subclasse: N × M classes em vez de N + M. Sintoma clássico de herança usada onde caberia composição.' },
      { term: 'Handle/Body', aliases: ['handle-body'], definition: 'Outro nome do Bridge no livro do GoF: um *handle* público e leve, que o cliente usa, aponta para um *body* que contém a implementação.' },
      { term: 'Pimpl', aliases: ['pimpl idiom', 'pointer to implementation', 'd-pointer'], definition: 'Idioma de C++ (*pointer to implementation*): a classe pública guarda só um ponteiro para a implementação privada, isolando mudanças e preservando a compatibilidade binária (ABI). É um Bridge degenerado.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Hoje o problema é de **multiplicação**. Imagine notificações de vários tipos — alerta, lembrete, promoção — enviadas por vários canais: e-mail, SMS, push.',
          { text: 'Se cada combinação vira uma subclasse, o número de classes **multiplica**. É a explosão N×M.', mood: 'concerned' },
        ],
        board: {
          title: 'O problema: explosão N×M',
          md: `\`\`\`python
class Notificacao: ...
class AlertaPorEmail(Notificacao): ...
class AlertaPorSMS(Notificacao): ...
class AlertaPorPush(Notificacao): ...
class LembretePorEmail(Notificacao): ...
class LembretePorSMS(Notificacao): ...
class LembretePorPush(Notificacao): ...
class PromocaoPorEmail(Notificacao): ...
class PromocaoPorSMS(Notificacao): ...
class PromocaoPorPush(Notificacao): ...
# 3 tipos × 3 canais = 9 classes
# + canal WhatsApp   → +3 classes
# + tipo "Cobrança"  → +4 classes
\`\`\`

| Tipos | Canais | Herança (N × M) | Bridge (N + M) |
|---|---|---|---|
| 3 | 3 | 9 | 6 |
| 4 | 4 | 16 | 8 |
| 10 | 5 | 50 | 15 |

E não é só a contagem: a regra "SMS corta em 160 caracteres" fica **copiada** em \`AlertaPorSMS\`, \`LembretePorSMS\` e \`PromocaoPorSMS\`. Mudou a regra? Três lugares para lembrar.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A saída é perceber que há **duas perguntas independentes**: *o que* a notificação diz e *como* ela é entregue.',
          'Cada pergunta ganha a sua hierarquia, e uma **referência** liga as duas. Essa referência é a ponte!',
        ],
        board: {
          title: 'A ponte: duas hierarquias ligadas por composição',
          md: `\`\`\`text
  ABSTRAÇÃO (o quê)                        IMPLEMENTAÇÃO (como)
  Notificacao ──── self.canal ─────────►  «interface» Canal
   ├── Alerta          (a ponte)            entregar(destino, texto)
   ├── Lembrete                              ├── Email
   └── Promocao                              ├── SMS
                                             └── Push
  3 classes          +                      3 classes  =  6 (e não 9)
\`\`\`

\`\`\`python
from typing import Protocol


class Canal(Protocol):                    # IMPLEMENTAÇÃO: operações primitivas
    def entregar(self, destino: str, texto: str) -> None: ...


class Email:
    def entregar(self, destino, texto):
        print(f"[e-mail → {destino}] {texto}")


class SMS:
    def entregar(self, destino, texto):
        print(f"[sms → {destino}] {texto[:160]}")   # regra do canal mora AQUI


class Notificacao:                         # ABSTRAÇÃO: o que o cliente usa
    def __init__(self, canal: Canal):
        self.canal = canal                 # ← a ponte

    def enviar(self, destino, assunto):
        self.canal.entregar(destino, self.formatar(assunto))

    def formatar(self, assunto):
        return assunto


class Alerta(Notificacao):                 # abstração refinada
    def formatar(self, assunto):
        return f"URGENTE: {assunto.upper()}"


Alerta(SMS()).enviar("+55 11 99999-0000", "servidor fora do ar")
Alerta(Email()).enviar("ops@empresa.com", "servidor fora do ar")
\`\`\``,
          caption: 'Canal novo? Uma classe, e todos os tipos de notificação já funcionam com ele. Tipo novo? Uma classe, e ele já sai por todos os canais.',
        },
      },
      {
        type: 'say',
        text: [
          'Agora o detalhe que separa quem decorou de quem entendeu: a abstração escreve suas operações de alto nível **usando só as primitivas** da implementação.',
          'Veja com formas e renderizadores: o `Alvo` não sabe se vai virar SVG ou texto — ele só pede círculos e linhas.',
        ],
        board: {
          title: 'A abstração fala em primitivas',
          code: `class SVG:                                    # implementação 1
    def circulo(self, x, y, r):
        return f'<circle cx="{x}" cy="{y}" r="{r}"/>'

    def linha(self, x1, y1, x2, y2):
        return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"/>'


class ASCII:                                  # implementação 2
    def circulo(self, x, y, r):
        return f"(o) em ({x},{y}) raio {r}"

    def linha(self, x1, y1, x2, y2):
        return f"({x1},{y1})----({x2},{y2})"


class Forma:                                  # abstração
    def __init__(self, renderizador):
        self.renderizador = renderizador      # a ponte


class Alvo(Forma):                            # abstração refinada
    def __init__(self, renderizador, x, y):
        super().__init__(renderizador)
        self.x, self.y = x, y

    def desenhar(self):                       # alto nível = combinação de primitivas
        r = self.renderizador
        return [r.circulo(self.x, self.y, 10),
                r.circulo(self.x, self.y, 5),
                r.linha(self.x - 12, self.y, self.x + 12, self.y)]


Alvo(SVG(), 50, 50).desenhar()      # três tags SVG
Alvo(ASCII(), 50, 50).desenhar()    # o mesmo desenho em outro "motor"`,
          caption: 'Trocar SVG por ASCII — ou por um renderizador de teste que só registra as chamadas — não muda uma linha das formas.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Cuidado com os nomes: no Bridge, "abstração" **não** é classe abstrata, e "implementação" **não** é subclasse concreta.',
          'São duas **camadas**: a de cima decide *o quê*, a de baixo sabe *como* fazer em cada plataforma.',
        ],
        board: {
          title: '"Abstração" e "implementação" não são o que parecem',
          md: `| Papel no Bridge | Significa | No exemplo |
|---|---|---|
| **Abstração** | A camada de alto nível que o cliente usa | \`Notificacao\`, \`Forma\` |
| **Abstração refinada** | Variações dessa camada | \`Alerta\`, \`Lembrete\`, \`Alvo\` |
| **Implementor** | A interface das operações primitivas | \`Canal.entregar()\`; \`circulo()\` e \`linha()\` |
| **Implementação concreta** | Cada plataforma ou tecnologia | \`Email\`, \`SMS\`, \`SVG\`, \`ASCII\` |

**Use quando:**

- há **duas (ou mais) dimensões** que variam de forma independente;
- você quer trocar a implementação **em tempo de execução** (ex.: se o push falhar, reenviar por SMS);
- você quer isolar código de plataforma: drivers, SDKs, sistemas operacionais, motores gráficos.

**Evite quando:** só existe **uma** dimensão de variação. Aí um Strategy, uma função ou até um \`if\` resolvem — criar a ponte "para o futuro" é indireção sem retorno (YAGNI).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Se você achou o Bridge parecido com o Strategy, parabéns: a estrutura é quase a mesma. A diferença é **intenção** e **momento**.',
          'E o GoF tem uma frase ótima para separar Bridge de Adapter. Está no quadro.',
        ],
        board: {
          title: 'Bridge × Strategy × Adapter',
          md: `| | **Bridge** | **Strategy** | **Adapter** |
|---|---|---|---|
| Família | Estrutural | Comportamental | Estrutural |
| Quando entra | **Antes**: no design, para as partes evoluírem separadas | Quando um **algoritmo** precisa ser trocável | **Depois**: para encaixar algo que já existe |
| O que separa | Uma hierarquia inteira em **duas dimensões** | Um **comportamento** do contexto | Nada: **traduz** uma interface |
| Granularidade | Várias operações primitivas | Em geral, uma operação | A interface toda |

No Strategy, o cliente escolhe *como* fazer **uma tarefa** (calcular frete, ordenar). No Bridge, a abstração **inteira** é escrita em termos das primitivas de uma implementação que varia por plataforma.

> [!sabia] O GoF resume assim: *"o Adapter faz as coisas funcionarem **depois** de projetadas; o Bridge, **antes**"*. O livro também chama o Bridge de **Handle/Body**, e em C++ sua forma mais famosa é o **Pimpl** (*pointer to implementation*): a classe pública guarda só um ponteiro para a implementação privada — um "firewall de compilação" que bibliotecas como o Qt usam para manter a compatibilidade binária entre versões. Na stdlib do Python, o \`logging\` é uma ponte: \`Logger\` (o que registrar) × \`Handler\` (para onde enviar: arquivo, stderr, e-mail…).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Duas dimensões, uma ponte.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'dp-brg-q1',
        concept: 'Explosão combinatória de classes',
        say: 'Primeiro, a matemática da explosão.',
        prompt: 'Um sistema tem **4 tipos** de relatório (Vendas, Estoque, Financeiro, RH) e **3 formatos** de saída (PDF, CSV, HTML). Quantas classes de relatório-formato você precisa com **herança pura** e com **Bridge**? E quanto custa adicionar o formato XLSX?',
        options: [
          { text: 'Herança: 12 classes, e o XLSX custa +4. Bridge: 4 + 3 = 7 classes, e o XLSX custa +1.', correct: true, why: 'N × M contra N + M: com Bridge, um formato novo serve na hora para todos os tipos de relatório.' },
          { text: 'Herança: 7 classes (+1 para XLSX). Bridge: 12 classes (+4 para XLSX).', why: 'Invertido: é a herança que multiplica as combinações.' },
          { text: '12 classes nos dois casos (+4 para XLSX); o Bridge só organiza melhor o código.', why: 'O Bridge elimina as classes combinadas: cada dimensão ganha a própria hierarquia, e elas **se somam** em vez de se multiplicar.' },
          { text: 'Herança: 12 classes. Bridge: 1 classe genérica que recebe tipo e formato como strings e decide com `if`s.', why: 'Isso não é Bridge: é trocar polimorfismo por um `if/elif` gigante, que cresce a cada tipo **e** a cada formato.' },
        ],
        explanation: 'Com herança, cada combinação é uma classe: `4 × 3 = 12`, e cada formato novo exige uma classe **por tipo** (+4). Com Bridge, tipos e formatos são hierarquias separadas: `4 + 3 = 7`, e o XLSX é **uma** classe nova que funciona com todos os relatórios.',
      },
      {
        type: 'mcq',
        id: 'dp-brg-q2',
        concept: 'Bridge × Strategy',
        say: 'Agora um debate que aparece em code review…',
        prompt: 'Um colega diz: *"Bridge é só um Strategy com outro nome."* Qual resposta é a **mais precisa**?',
        options: [
          { text: 'A estrutura é parecida (composição + delegação), mas o Bridge separa uma hierarquia em **duas dimensões** que evoluem de forma independente, e a abstração é escrita com as **primitivas** da implementação; o Strategy troca **um algoritmo** do contexto.', correct: true, why: 'Mesma forma, intenções e granularidades diferentes — e padrões são definidos pela intenção.' },
          { text: 'Ele está certo: os dois padrões são idênticos; o GoF só os descreveu em capítulos diferentes.', why: 'Forma igual não significa padrão igual: o GoF classifica o Bridge como estrutural e o Strategy como comportamental justamente pela intenção.' },
          { text: 'A diferença é que o Bridge liga abstração e implementação por **herança**, e o Strategy usa composição.', why: 'O Bridge usa **composição**: a abstração guarda uma referência à implementação. Ligar por herança seria voltar à explosão N×M.' },
          { text: 'O Bridge serve para adaptar interfaces incompatíveis de bibliotecas de terceiros.', why: 'Esse é o **Adapter**, aplicado depois que as interfaces já existem; o Bridge é planejado de antemão.' },
        ],
        explanation: 'Os dois guardam uma referência a uma interface e delegam. No **Strategy**, o foco é um comportamento pontual que o cliente escolhe (qual desconto, qual ordenação). No **Bridge**, o design inteiro é dividido em duas camadas — o quê × como — que crescem de forma independente, e a camada de cima só conversa com a de baixo por primitivas.',
      },
      {
        type: 'order',
        id: 'dp-brg-q3',
        concept: 'Bridge',
        say: 'Você herdou as 9 classes combinadas. Vamos refatorar na ordem certa.',
        prompt: 'Ordene os passos para transformar `AlertaPorEmail`, `LembretePorSMS` & cia. num **Bridge**.',
        items: [
          'Identificar as duas dimensões que variam: **tipo** de notificação × **canal** de entrega',
          'Definir a interface de implementação com as operações primitivas: `Canal.entregar(destino, texto)`',
          'Mover o código específico de cada canal para `Email`, `SMS` e `Push`',
          'Fazer `Notificacao` receber um canal no construtor e delegar a entrega a ele (a ponte)',
          'Trocar os usos de `AlertaPorSMS()` por `Alerta(SMS())` e apagar as classes combinadas',
        ],
        explanation: 'Primeiro enxergue as **dimensões**; depois extraia a interface da implementação (o que cada canal sabe fazer), mova o código de plataforma para as implementações concretas e ligue a abstração a elas por **composição**. Só no fim as combinações viram montagem — `Alerta(SMS())` — e as classes N×M podem ser apagadas.',
      },
      {
        type: 'code',
        id: 'dp-brg-q4',
        concept: 'Bridge',
        title: 'Relatórios × formatos',
        say: 'Mão na massa: relatórios em vários formatos, sem nenhuma classe por combinação.',
        prompt: `**Implementação (formatos):** \`Texto\` e \`HTML\` já estão prontos, com três primitivas: \`titulo(texto)\`, \`linha(celulas)\` e \`documento(partes)\`. Escreva o formato **\`CSV\`**:

- \`titulo("Vendas")\` → \`"# Vendas"\`
- \`linha(["caneta", "7.50"])\` → \`"caneta,7.50"\`
- \`documento(partes)\` → as partes unidas por quebra de linha

**Abstração (relatórios):** escreva \`Relatorio\`, \`RelatorioVendas\` e \`RelatorioEstoque\`:

- \`Relatorio(formato)\` guarda o formato em \`self.formato\` (a ponte);
- \`gerar(itens)\` monta, **nesta ordem**, o título, a linha de cabeçalho e uma linha por item — usando **só** as primitivas do formato — e devolve \`self.formato.documento(partes)\`;
- \`RelatorioVendas\`: título \`"Vendas"\`, cabeçalho \`["produto", "total"]\`; o item \`{"produto": "caneta", "qtd": 3, "preco": 2.5}\` vira \`["caneta", "7.50"]\` (qtd × preço, 2 casas);
- \`RelatorioEstoque\`: título \`"Estoque"\`, cabeçalho \`["produto", "qtd"]\`; o item \`{"produto": "caneta", "qtd": 30}\` vira \`["caneta", "30"]\`.

Um formato **novo** deve funcionar com os relatórios sem mudar nada neles.`,
        starter: `${FORMATOS_PRONTOS}

class CSV:
    pass


# ── Abstração (relatórios) ────────────────────────────────
class Relatorio:
    titulo = "Relatório"
    cabecalho = ()

    def __init__(self, formato):
        pass

    def celulas(self, item):
        raise NotImplementedError

    def gerar(self, itens):
        pass


class RelatorioVendas(Relatorio):
    pass


class RelatorioEstoque(Relatorio):
    pass
`,
        tests: [
          { name: 'Vendas em Texto', expr: 'RelatorioVendas(Texto()).gerar([{"produto": "caneta", "qtd": 3, "preco": 2.5}, {"produto": "caderno", "qtd": 1, "preco": 12.0}])', expected: '"== Vendas ==\\nproduto ; total\\ncaneta ; 7.50\\ncaderno ; 12.00"' },
          { name: 'Estoque em HTML', expr: 'RelatorioEstoque(HTML()).gerar([{"produto": "caneta", "qtd": 30}])', expected: '"<h1>Estoque</h1><table><tr><td>produto</td><td>qtd</td></tr><tr><td>caneta</td><td>30</td></tr></table>"' },
          { name: 'Vendas em CSV (seu formato)', expr: 'RelatorioVendas(CSV()).gerar([{"produto": "caneta", "qtd": 3, "preco": 2.5}])', expected: '"# Vendas\\nproduto,total\\ncaneta,7.50"' },
          { name: 'sem itens: só título e cabeçalho', expr: 'RelatorioEstoque(Texto()).gerar([])', expected: '"== Estoque ==\\nproduto ; qtd"' },
          { name: 'Estoque em CSV', hidden: true, expr: 'RelatorioEstoque(CSV()).gerar([{"produto": "lápis", "qtd": 7}, {"produto": "borracha", "qtd": 0}])', expected: '"# Estoque\\nproduto,qtd\\nlápis,7\\nborracha,0"' },
          { name: 'formato novo, criado no teste', hidden: true, code: `class Espiao:
    def __init__(self):
        self.chamadas = []

    def titulo(self, t):
        self.chamadas.append(("titulo", t))
        return "T"

    def linha(self, c):
        self.chamadas.append(("linha", list(c)))
        return "L"

    def documento(self, p):
        self.chamadas.append(("documento", list(p)))
        return "DOC"


e = Espiao()
assert RelatorioEstoque(e).gerar([{"produto": "lápis", "qtd": 7}]) == "DOC"
esperado = [("titulo", "Estoque"), ("linha", ["produto", "qtd"]), ("linha", ["lápis", "7"]), ("documento", ["T", "L", "L"])]
assert e.chamadas == esperado, f"chamadas: {e.chamadas}"` },
          { name: 'trocar o formato em tempo de execução', hidden: true, code: `r = RelatorioVendas(Texto())
r.formato = HTML()
saida = r.gerar([{"produto": "caneta", "qtd": 2, "preco": 1.25}])
assert saida == "<h1>Vendas</h1><table><tr><td>produto</td><td>total</td></tr><tr><td>caneta</td><td>2.50</td></tr></table>", saida` },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => /^Relatorio\w+(Texto|Html|HTML|Csv|CSV)$/.test(c.name)),
            text: 'Você criou classes por **combinação** (ex.: `RelatorioVendasHTML`). É exatamente a explosão N×M que o Bridge evita: cada relatório recebe o formato por composição.',
            concept: 'Explosão combinatória de classes',
          },
          {
            when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
            text: 'Checar o tipo do formato (`isinstance`/`type`) acopla a abstração às implementações concretas — um formato novo exigiria mexer no relatório. Converse só pelas primitivas (`titulo`, `linha`, `documento`).',
            concept: 'Implementor',
          },
          {
            when: m => m.classes.some(c => c.name !== 'Relatorio' && c.bases.includes('Relatorio') && c.methods.includes('gerar')),
            text: 'Uma subclasse reescreveu `gerar()`. A montagem do documento é igual para todos os relatórios: deixe-a só em `Relatorio` e faça as subclasses dizerem apenas o que muda (título, cabeçalho e células).',
            concept: 'Bridge',
          },
        ],
        hints: [
          'O `CSV` é uma **implementação**: `titulo` → `f"# {texto}"`, `linha` → `",".join(celulas)` e `documento` → `"\\n".join(partes)`.',
          'No `Relatorio.__init__`, guarde a ponte: `self.formato = formato`. Em `gerar`, monte `partes` com `self.formato.titulo(self.titulo)`, `self.formato.linha(self.cabecalho)` e uma `self.formato.linha(self.celulas(item))` por item; termine com `return self.formato.documento(partes)`.',
          'As subclasses só definem `titulo`, `cabecalho` e `celulas(item)`. Para o total com 2 casas: `f"{item[\'qtd\'] * item[\'preco\']:.2f}"`.',
        ],
        solution: `${FORMATOS_PRONTOS}

class CSV:
    def titulo(self, texto):
        return f"# {texto}"

    def linha(self, celulas):
        return ",".join(celulas)

    def documento(self, partes):
        return "\\n".join(partes)


# ── Abstração (relatórios) ────────────────────────────────
class Relatorio:
    titulo = "Relatório"
    cabecalho = ()

    def __init__(self, formato):
        self.formato = formato                 # a ponte

    def celulas(self, item):
        raise NotImplementedError

    def gerar(self, itens):
        f = self.formato                       # só primitivas daqui para baixo
        partes = [f.titulo(self.titulo), f.linha(list(self.cabecalho))]
        partes += [f.linha(self.celulas(item)) for item in itens]
        return f.documento(partes)


class RelatorioVendas(Relatorio):
    titulo = "Vendas"
    cabecalho = ("produto", "total")

    def celulas(self, item):
        return [item["produto"], f"{item['qtd'] * item['preco']:.2f}"]


class RelatorioEstoque(Relatorio):
    titulo = "Estoque"
    cabecalho = ("produto", "qtd")

    def celulas(self, item):
        return [item["produto"], str(item["qtd"])]
`,
        solutionExplanation: 'Duas hierarquias, **N + M** classes: formatos (`Texto`, `HTML`, `CSV`) sabem *como* escrever título, linha e documento; relatórios (`RelatorioVendas`, `RelatorioEstoque`) sabem *o quê* mostrar. O `gerar` fica só na abstração base e conversa com o formato **apenas pelas primitivas** — por isso o formato espião do teste, que o relatório nunca viu, funciona sem mudar nada, e dá até para trocar `self.formato` em tempo de execução. As subclasses dizem só o que muda (título, cabeçalho, células).',
      },
      {
        type: 'open',
        id: 'dp-brg-q5',
        concept: 'Bridge',
        say: 'Para fechar: explique o Bridge como se fosse para um colega de time.',
        prompt: 'Explique o **Bridge** para um colega: que problema ele resolve, como funciona e **quando não vale a pena** usá-lo.',
        minWords: 25,
        rubric: [
          { label: 'Problema: **explosão de classes** por combinação (N×M)', keywords: ['explos', 'combina', 'multiplic', 'n x m', 'nxm', 'n*m', 'n × m', 'n×m', 'produto cartesiano', 'muitas subclasses', 'muitas classes'], concept: 'Explosão combinatória de classes', why: 'Sem nomear a explosão N×M, fica difícil justificar a indireção extra do padrão.' },
          { label: 'Separa **duas dimensões/hierarquias** que variam de forma independente', keywords: ['duas hierarquias', 'duas dimens', 'dois eixos', 'independen', 'separa', 'desacopl', 'abstracao e implementacao', 'abstracao da implementacao'], concept: 'Bridge', why: 'O coração do padrão é tratar "o quê" e "como" como eixos que evoluem sozinhos.' },
          { label: 'Funciona por **composição**: a abstração guarda uma referência à implementação e delega', keywords: ['composic', 'referencia', 'delega', 'ponte', 'atributo', 'injet', 'recebe no construtor', 'recebe a implementacao', 'guarda'], concept: 'Implementor', why: 'A ponte é uma referência — trocá-la não exige herança nem classes combinadas.' },
          { label: 'Quando **não** usar: uma só dimensão de variação / indireção desnecessária (YAGNI)', keywords: ['yagni', 'uma unica', 'uma so', 'so uma', 'apenas uma', 'so tem uma', 'indirec', 'complexidade', 'overengineering', 'over-engineering', 'prematur', 'desnecess', 'exagero'], concept: 'YAGNI', why: 'Com um eixo só de variação, Strategy, uma função ou um `if` resolvem com menos peças.' },
        ],
        modelAnswer: `O Bridge resolve a **explosão de classes** que aparece quando duas coisas variam juntas: 3 tipos de notificação × 3 canais viram 9 subclasses combinadas (N×M), com código de canal duplicado.

A solução é **separar** em **duas hierarquias independentes**: a **abstração** (o quê — \`Alerta\`, \`Lembrete\`) e a **implementação** (como — \`Email\`, \`SMS\`). A abstração guarda uma **referência** para a implementação (a ponte, por **composição**) e **delega** a ela as operações primitivas. Assim ficam N+M classes, e cada lado evolui sozinho.

**Quando não vale a pena:** se só existe **uma** dimensão de variação, a ponte vira **indireção desnecessária** — YAGNI. Aí um Strategy, uma função ou um \`if\` simples resolvem.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Mandou muito bem! Bridge é dividir para não multiplicar: duas hierarquias — o quê × como — ligadas por uma referência.',
          'Lembre: a abstração fala por **primitivas**, o padrão nasce no design (o Adapter conserta depois), e com um eixo só de variação ele é exagero. Próximo: **Flyweight**!',
        ],
        board: null,
      },
    ],
  });
})();
