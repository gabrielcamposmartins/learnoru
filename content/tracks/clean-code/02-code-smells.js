(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const RESERVAS_SUJO = py(`
    from datetime import date


    def noites(inicio, fim):
        return (fim - inicio).days


    def sobrepoe(inicio1, fim1, inicio2, fim2):
        return inicio1 < fim2 and inicio2 < fim1


    def contem(inicio, fim, dia):
        return inicio <= dia < fim


    def preco_total(inicio, fim, diaria):
        if fim <= inicio:
            raise ValueError("período inválido")
        return noites(inicio, fim) * diaria


    def pode_reservar(reservas, inicio, fim):
        # reservas: lista de tuplas (inicio, fim)
        if fim <= inicio:
            raise ValueError("período inválido")
        for r in reservas:
            if sobrepoe(r[0], r[1], inicio, fim):
                return False
        return True


    # TODO: crie a classe Periodo e reescreva preco_total e pode_reservar usando-a
  `);

  Game.registerModule('clean-code', {
    id: 'code-smells',
    title: 'Code smells',
    kind: 'lesson',
    level: 2,
    order: 2,
    unit: 'fundamentos',
    summary: 'Treine o nariz: Long Method, Primitive Obsession, Data Clumps, Feature Envy, Shotgun Surgery, Divergent Change e companhia — e qual refatoração cada cheiro pede.',
    concepts: ['Code smells', 'Primitive Obsession', 'Data Clumps', 'Feature Envy', 'Shotgun Surgery × Divergent Change'],
    takeaways: [
      'Code smell é um **sintoma**, não um bug nem uma regra: um indício de que o design está dificultando mudanças. Investigue antes de refatorar.',
      '**Primitive Obsession** e **Data Clumps** pedem objetos de valor: um `Periodo` ou `Dinheiro` imutável valida uma vez e concentra o comportamento.',
      '**Feature Envy**: a função usa mais os dados de outro objeto do que os próprios — mova o comportamento para perto dos dados.',
      '**Divergent Change** (uma classe muda por muitos motivos) e **Shotgun Surgery** (uma mudança mexe em muitas classes) são opostos: um pede separar, o outro pede juntar.',
      'Comentário que explica código confuso é **desodorante**: renomeie e extraia até ele sobrar. Bons comentários explicam o **porquê**.',
    ],
    glossary: [
      { term: 'Code smell', aliases: ['code smells', 'cheiro de código', 'cheiros de código', 'cheiro no código', 'mau cheiro'], definition: 'Sintoma superficial no código que costuma indicar um problema mais profundo de design (Kent Beck e Martin Fowler, *Refactoring*, 1999). Não é bug nem regra: é um convite para investigar.' },
      { term: 'Primitive Obsession', aliases: ['obsessão por primitivos', 'obsessao por primitivos'], definition: 'Usar tipos primitivos (`str`, `float`, tuplas, dicts) para conceitos do domínio — CPF, dinheiro, período, e-mail. A validação e as regras se espalham; a cura é criar pequenos objetos de valor.' },
      { term: 'Data Clumps', aliases: ['data clump', 'aglomerado de dados', 'aglomerados de dados'], definition: 'Grupos de dados que sempre andam juntos (`inicio, fim`; `lat, lon`; `rua, numero, cep`). Teste: se remover um deles, os outros perdem o sentido? Então são um objeto esperando para nascer.' },
      { term: 'Feature Envy', aliases: ['inveja de funcionalidade', 'inveja de recursos'], definition: 'Função mais interessada nos dados de outro objeto do que nos do próprio (vive fazendo `pedido.cliente.x`, `pedido.cliente.y`). Remédio: mover o comportamento para perto dos dados (*Move Function*).' },
      { term: 'Shotgun Surgery', aliases: ['cirurgia com espingarda', 'cirurgia de espingarda'], definition: 'Uma única mudança lógica obriga a editar muitos arquivos ou classes (ex.: uma nova moeda mexe em 7 lugares). O conhecimento está espalhado; o remédio é juntá-lo (*Move Function*, *Combine Functions into Class*).' },
      { term: 'Divergent Change', aliases: ['mudança divergente', 'mudanca divergente'], definition: 'Uma mesma classe muda por muitos motivos diferentes (banco, regra fiscal, layout do relatório). É o oposto do Shotgun Surgery e uma violação do SRP; o remédio é separar (*Extract Class*, *Split Phase*).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Na aula passada cuidamos de nomes e funções. Agora vamos treinar o **nariz**.',
          'Um *code smell* é um cheiro estranho no código: não prova que há problema, mas manda você olhar mais de perto.',
        ],
        board: {
          title: 'O que é um code smell',
          md: `**Code smell** = um **sintoma** superficial que costuma indicar um problema mais profundo de design.

- Não é **bug**: o código funciona.
- Não é **regra**: é uma heurística — às vezes o cheiro é aceitável.
- É um **convite**: investigue e, se o design estiver mesmo atrapalhando, refatore.

| Família (adaptado de Mäntylä et al., 2003) | Exemplos |
|---|---|
| **Bloaters** (inchaços) | Long Method, Large Class, Long Parameter List, Primitive Obsession, Data Clumps |
| **Abusos de OO** | switch repetido, Refused Bequest, Temporary Field |
| **Change Preventers** | Divergent Change, Shotgun Surgery |
| **Dispensables** | Speculative Generality, código morto, código duplicado, comentário desodorante |
| **Couplers** | Feature Envy, Message Chains, Middle Man |

> [!sabia] O termo foi criado por **Kent Beck** enquanto ajudava Martin Fowler a escrever *Refactoring* (1999). O capítulo sobre cheiros abre com um conselho da avó dele sobre como criar filhos (e trocar fraldas): *"If it stinks, change it"* — se está cheirando mal, troque.`,
        },
      },
      {
        type: 'say',
        text: [
          'Começando pelos **inchaços**: coisas que cresceram demais, um pouquinho por vez.',
          'Ninguém escreve uma função de 300 linhas de uma vez. Ela ganha "só mais um if" por sprint.',
        ],
        board: {
          title: 'Long Method, Large Class, Long Parameter List',
          md: `| Smell | Sintomas | Refatorações |
|---|---|---|
| **Long Method** | rolar a tela para ler; comentários de seção; muitas variáveis temporárias | *Extract Function*, *Replace Temp with Query*, *Decompose Conditional* |
| **Large Class** | dezenas de atributos e métodos; grupos que não conversam entre si | *Extract Class*, *Extract Superclass* |
| **Long Parameter List** | 4+ parâmetros, booleanos, parâmetros que sempre andam juntos | *Introduce Parameter Object*, *Preserve Whole Object*, *Remove Flag Argument* |

\`\`\`python
# Long Parameter List: desmontamos o objeto só para remontá-lo lá dentro
def cabe_no_orcamento(nome, limite, gasto_no_mes, valor): ...
cabe_no_orcamento(cli.nome, cli.limite, cli.gasto_no_mes, 250.0)

# Preserve Whole Object: passe o objeto inteiro
def cabe_no_orcamento(cliente, valor): ...
cabe_no_orcamento(cli, 250.0)
\`\`\`

> [!dica] Heurística de Fowler para funções longas: sempre que sentir vontade de **comentar** um bloco, extraia-o numa função cujo nome diga o que o comentário dizia. O que importa não é o número de linhas, e sim a **distância** entre *o que* a função faz e *como* ela faz.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Dois cheiros que andam de mãos dadas: **Primitive Obsession** e **Data Clumps**.',
          'CPF como `str`, dinheiro como `float`, período como duas datas soltas… e a validação espalhada pelo sistema inteiro.',
        ],
        board: {
          title: 'Primitive Obsession e Data Clumps',
          md: `\`\`\`python
# Primitive Obsession: tudo é str, float ou tupla
def cadastrar(nome: str, cpf: str, saldo: float): ...
cpf = "123.456.789-09"    # quem valida? onde? quantas vezes?
0.1 + 0.2                 # 0.30000000000000004 — float para dinheiro!

# Data Clumps: os mesmos dados sempre juntos
def noites(inicio, fim): ...
def sobrepoe(inicio1, fim1, inicio2, fim2): ...
def preco_total(inicio, fim, diaria): ...
\`\`\`

\`\`\`python
from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class Periodo:
    inicio: date
    fim: date

    def __post_init__(self):
        if self.fim <= self.inicio:
            raise ValueError("o fim deve ser depois do início")

    def noites(self):
        return (self.fim - self.inicio).days
\`\`\`

- **Teste do data clump** (Fowler): apague um dos valores do grupo. Os outros ainda fazem sentido sozinhos? Se não, são um objeto esperando para nascer.
- O objeto de valor **valida uma vez**, no construtor: todo \`Periodo\` que existe é válido, e ninguém mais precisa checar.
- Ele também **atrai comportamento**: \`noites()\`, \`sobrepoe()\`, \`contem()\`.

> [!atencao] Dinheiro em \`float\` é Primitive Obsession com bug embutido. Use \`Decimal\` ou centavos em \`int\` — e, idealmente, um tipo \`Dinheiro\` que carregue a moeda junto.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora um cheiro de **acoplamento**: a *Feature Envy*.',
          'É a função que vive espiando a casa do vizinho — usa mais os dados de outro objeto do que os próprios.',
        ],
        board: {
          title: 'Feature Envy',
          md: `\`\`\`python
class CalculadoraDeFrete:
    def frete(self, pedido):
        uf = pedido.cliente.endereco.uf                        # message chain
        peso = sum(i.peso * i.quantidade for i in pedido.itens)
        if uf in ("SP", "RJ") and peso < 10:
            return 15.0
        return 25.0 + peso * 1.2
\`\`\`

Quase tudo aqui é dado **do pedido**: itens, pesos, endereço do cliente. A calculadora só tem inveja.

\`\`\`python
class Pedido:
    def peso_total(self):
        return sum(item.peso * item.quantidade for item in self.itens)

    def uf_de_entrega(self):
        return self.cliente.endereco.uf
\`\`\`

**Remédio:** *Move Function* — leve o comportamento para perto dos dados que ele usa (ou extraia só a parte invejosa e mova-a). De quebra, some a **message chain** \`pedido.cliente.endereco.uf\` espalhada pelo código.

> [!atencao] Nem toda separação é inveja. **Strategy** e **Visitor** separam comportamento e dados **de propósito**, para variar o algoritmo sem tocar nas classes. A regra de Fowler: **junte o que muda junto**.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Estes dois são os mais confundidos — e são **opostos**!',
          'Um é uma classe que muda por mil motivos; o outro é um motivo que muda mil classes.',
        ],
        board: {
          title: 'Divergent Change × Shotgun Surgery',
          md: `| | **Divergent Change** | **Shotgun Surgery** |
|---|---|---|
| Sintoma | **uma** classe muda por **muitos** motivos | **uma** mudança mexe em **muitas** classes |
| Frase típica | "para trocar o banco, a regra fiscal ou o layout do PDF, mexo sempre no \`Pedido\`" | "para aceitar uma nova moeda, mexi em 7 arquivos" |
| Causa | responsabilidades demais juntas (viola o SRP) | uma responsabilidade espalhada |
| Remédio | **separar**: *Extract Class*, *Split Phase* | **juntar**: *Move Function*, *Combine Functions into Class* |

\`\`\`text
Divergent Change               Shotgun Surgery

 banco  --+                    nova moeda --+--> Pedido
 fiscal --+--> [ Pedido ]                   +--> Carrinho
 PDF    --+                                 +--> Relatorio
                                            +--> Checkout ...
\`\`\`

O ideal é um mapeamento **1 para 1**: cada motivo de mudança corresponde a um lugar no código.

> [!sabia] **Parallel Inheritance Hierarchies** é um caso especial de Shotgun Surgery: toda vez que você cria uma subclasse numa hierarquia (\`PedidoNacional\`), precisa criar a gêmea em outra (\`RelatorioPedidoNacional\`). Prefixos iguais nas duas árvores são a pista.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, os **dispensáveis**: coisas que, se sumissem, deixariam o código melhor.',
          { text: 'Os campeões: a generalidade especulativa, "para quando precisarmos", e o comentário **desodorante**.', mood: 'concerned' },
        ],
        board: {
          title: 'Speculative Generality e comentário desodorante',
          md: `**Speculative Generality** — ganchos para um futuro que não chegou:

\`\`\`python
class ExportadorBase(ABC):                  # uma única subclasse
    @abstractmethod
    def exportar(self, dados, formato="csv", compressao=None, plugin=None): ...
    #                                        ^ ninguém nunca passou esses dois
\`\`\`

Remédios: *Collapse Hierarchy*, *Inline Function/Class*, remover parâmetros e código mortos. Se o futuro chegar, o código novo vem junto com o requisito de verdade.

**Comentário desodorante** — o comentário existe para disfarçar o cheiro de um código confuso:

\`\`\`python
# verifica se o cliente tem frete grátis: premium ativo há mais de 1 ano
# ou compras acima de 500 nos últimos 30 dias
if (c.t == 2 and c.a and (hoje - c.d).days > 365) or sum(x.v for x in c.cs if (hoje - x.dt).days <= 30) > 500:
    ...

# depois: o código diz o que o comentário dizia
if cliente.tem_frete_gratis(hoje):
    ...
\`\`\`

Bons comentários explicam o **porquê** (uma decisão, uma restrição externa, um aviso de consequência), não **o quê**. Docstrings de API pública, links para tickets e referências a RFCs são bem-vindos.

> [!sabia] Na 2ª edição do *Refactoring* (2018), Fowler incluiu cheiros novos: **Mysterious Name**, **Global Data**, **Mutable Data** e até **Loops** — laços que poderiam ser um *pipeline* (\`filter\`, \`map\`, compreensões), que diz **o que** está sendo feito em vez de **como**.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Farejar, diagnosticar e refatorar um Primitive Obsession de verdade.', icon: '🎯' },
      {
        type: 'match',
        id: 'cc-smell-q1',
        concept: 'Code smells',
        say: 'Primeiro, o teste do nariz: qual cheiro cada sintoma denuncia?',
        prompt: 'Associe cada **code smell** ao **sintoma** que o denuncia.',
        pairs: [
          { left: 'Long Parameter List', right: '`criar_usuario(nome, email, rua, numero, cidade, cep, ativo, admin)`' },
          { left: 'Primitive Obsession', right: 'CPF e dinheiro circulam como `str` e `float`, com a mesma validação repetida em vários lugares' },
          { left: 'Data Clumps', right: '`lat, lon` aparecem juntos em 12 assinaturas diferentes' },
          { left: 'Feature Envy', right: 'Um método do `Relatorio` que só lê campos de `pedido.cliente`' },
          { left: 'Divergent Change', right: 'A classe `Pedido` muda por causa do banco, do fisco e do layout do PDF' },
          { left: 'Shotgun Surgery', right: 'Aceitar uma nova moeda exigiu mexer em 7 arquivos' },
        ],
        explanation: 'Repare como vários cheiros se sobrepõem: a lista longa de `criar_usuario` também esconde um *data clump* (`rua, numero, cidade, cep` = um `Endereco`) e dois *flag arguments*. Cheiros são sintomas, não diagnósticos exclusivos — o que importa é enxergar o problema de design por trás e escolher a refatoração que o resolve.',
      },
      {
        type: 'mcq',
        id: 'cc-smell-q2',
        concept: 'Feature Envy',
        say: 'Code review. Conte quantas vezes esse método fala com o `self`…',
        prompt: `\`\`\`python
class Relatorio:
    def linha_do_cliente(self, cliente):
        nome = f"{cliente.nome} {cliente.sobrenome}".strip()
        idade = (date.today() - cliente.nascimento).days // 365
        vip = cliente.total_compras > 10_000 and cliente.ativo
        return f"{nome} ({idade} anos)" + (" ★" if vip else "")
\`\`\`

Qual cheiro é mais forte aqui e o que fazer?`,
        options: [
          { text: 'Feature Envy: nome completo, idade e "é VIP" são conhecimento do `Cliente`. Mova esses cálculos para o `Cliente` e deixe o `Relatorio` só montar a linha.', correct: true, why: 'O método acessa seis atributos de `cliente` e nenhum do `self`. Movendo o conhecimento para o `Cliente`, a regra de VIP fica num lugar só — e qualquer outra tela pode reusá-la.' },
          { text: 'Long Method: extraia cada linha para um método privado do `Relatorio`.', why: 'O método fica menor, mas o conhecimento continua no lugar errado: a próxima tela que precisar da idade ou da regra de VIP vai duplicar a lógica.' },
          { text: 'Primitive Obsession: troque `date` por uma string ISO para simplificar.', why: 'Isso é o contrário da cura — `date` já é um tipo rico; trocá-lo por `str` criaria Primitive Obsession.' },
          { text: 'Speculative Generality: crie uma interface `IRelatorio` antes de mexer.', why: 'Uma abstração sem uma segunda implementação real só adiciona indireção. O problema é *onde* mora o conhecimento, não a falta de interface.' },
        ],
        explanation: 'Um teste rápido para Feature Envy: conte os acessos a `self` e a cada outro objeto. Aqui são seis acessos a `cliente` e **zero** a `self`. Com `cliente.nome_completo()`, `cliente.idade(hoje)` e `cliente.eh_vip()`, a regra de negócio (quem é VIP) passa a ter um único dono — e corrigir o cálculo aproximado da idade vira uma mudança num lugar só.',
      },
      {
        type: 'mcq',
        id: 'cc-smell-q3',
        concept: 'Shotgun Surgery × Divergent Change',
        say: 'Agora o par mais confundido. Leia o histórico de mudanças do trimestre com atenção.',
        prompt: `No último trimestre, o histórico do repositório mostra:

- **(a)** para adicionar o **Pix** como meio de pagamento, foram alterados \`Checkout\`, \`Pedido\`, \`Recibo\`, \`Relatorio\` e \`Webhook\`;
- **(b)** a classe \`Pedido\` foi alterada por causa do Pix, de uma mudança no cálculo do ICMS e de um novo layout de nota fiscal.

Qual diagnóstico está correto?`,
        options: [
          { text: '(a) é **Shotgun Surgery** — o conhecimento sobre meios de pagamento está espalhado e deve ser juntado; (b) é **Divergent Change** — o `Pedido` acumula motivos de mudança e deve ser dividido.', correct: true, why: 'Um motivo → muitas classes é Shotgun Surgery; uma classe → muitos motivos é Divergent Change. Os remédios são opostos: juntar e separar.' },
          { text: 'Os dois são Shotgun Surgery.', why: '(b) é o oposto: uma **única** classe mudando por **vários** motivos diferentes.' },
          { text: '(a) é Divergent Change e (b) é Shotgun Surgery.', why: 'Está invertido: em (a) uma mudança se espalha por muitas classes; em (b) muitas mudanças caem numa classe só.' },
          { text: 'Os dois são Large Class: basta dividir o `Pedido` em classes menores.', why: 'Dividir o `Pedido` ajuda em (b), mas (a) pede o contrário — juntar o conhecimento de pagamentos num lugar. Dividir sem critério pode até piorar (a).' },
        ],
        explanation: 'O ideal é um mapeamento **1 para 1** entre motivo de mudança e lugar no código. Uma técnica prática para achar esses cheiros é minerar o controle de versão: arquivos que sempre mudam **juntos** no mesmo commit (*change coupling*) indicam Shotgun Surgery; um arquivo que aparece em commits de assuntos muito diferentes indica Divergent Change.',
      },
      {
        type: 'match',
        id: 'cc-smell-q4',
        concept: 'Catálogo de refatorações',
        say: 'Cheiro identificado — e agora? Cada um tem sua refatoração preferida.',
        prompt: 'Associe cada **code smell** à **refatoração** mais indicada.',
        pairs: [
          { left: 'Data Clumps', right: 'Introduce Parameter Object' },
          { left: 'Feature Envy', right: 'Move Function' },
          { left: 'Speculative Generality', right: 'Collapse Hierarchy / Inline Class' },
          { left: 'Primitive Obsession', right: 'Replace Primitive with Object' },
          { left: 'Divergent Change', right: 'Extract Class' },
          { left: 'Comentário desodorante', right: 'Extract Function com o nome que o comentário dizia' },
        ],
        explanation: 'O catálogo do *Refactoring* é um vocabulário: dizer "isso é Feature Envy, vamos fazer um *Move Function*" comunica em uma frase o problema e o plano. Repare que *Introduce Parameter Object* e *Replace Primitive with Object* costumam ser o primeiro passo — o objeto novo depois **atrai** o comportamento (aí entra o *Move Function*).',
      },
      {
        type: 'mcq',
        id: 'cc-smell-q5',
        concept: 'Comentários',
        multiple: true,
        say: 'Nem todo comentário é desodorante. Quais destes você manteria?',
        prompt: 'Quais destes comentários **valem a pena manter**? Marque **todas** as corretas.',
        options: [
          { text: '`# Usamos SHA-1 só porque o parceiro exige (contrato de 2019); não use em nada novo.`', correct: true, why: 'Explica um **porquê** que o código não consegue expressar (restrição externa) e avisa sobre uma consequência. Comentário valioso.' },
          { text: '`# Contorna o bug do driver (issue #4521); remover ao migrar para a versão 3.x.`', correct: true, why: 'Dá contexto, aponta a fonte (issue) e diz quando o código pode sumir. Sem ele, alguém "limparia" o workaround e reabriria o bug.' },
          { text: '`# pega os clientes ativos que compraram nos últimos 30 dias e não são funcionários`, acima de uma condição de três linhas.', why: 'Desodorante clássico: o comentário descreve **o que** a condição faz. Extraia uma função `clientes_elegiveis(...)` e o comentário sobra.' },
          { text: 'Um bloco `# def calcular_antigo(...):` comentado "por segurança".', why: 'Código comentado é ruído que ninguém ousa apagar (Lava Flow em formação). O controle de versão já guarda o histórico.' },
        ],
        explanation: 'Regra prática: comentário bom responde **por que** o código é assim — restrições externas, decisões não óbvias, avisos, links para tickets e RFCs. Comentário que responde **o que** o código faz geralmente é um sintoma: renomeie e extraia até o código dizer isso sozinho.',
      },
      {
        type: 'code',
        id: 'cc-smell-q6',
        concept: 'Primitive Obsession',
        title: 'De duas datas soltas a um `Periodo`',
        points: 50,
        say: 'Hora de refatorar! O par `inicio, fim` está implorando para virar um objeto.',
        prompt: `O sistema de reservas de uma pousada passa \`inicio, fim\` (datas) soltos por toda parte — um **Data Clump** com **Primitive Obsession**: \`sobrepoe\` recebe 4 datas, as reservas são tuplas acessadas por índice e a validação "fim depois do início" aparece em alguns lugares e falta em outros.

Refatore criando um **objeto de valor**:

- \`Periodo(inicio, fim)\` — **imutável**, com igualdade por valor (e *hashable*). Se \`fim <= inicio\`, o construtor lança \`ValueError\`.
- Métodos: \`noites()\`, \`sobrepoe(outro)\` e \`contem(dia)\`, com o **mesmo comportamento** das funções atuais (o dia do \`fim\` é o dia da saída: não pertence ao período, e períodos "encostados" não se sobrepõem).
- \`preco_total(periodo, diaria)\` e \`pode_reservar(reservas, periodo)\`, onde \`reservas\` é uma lista de \`Periodo\`.

As funções antigas com datas soltas podem ser apagadas.`,
        starter: RESERVAS_SUJO,
        tests: [
          { name: 'noites de um período', setup: 'from datetime import date', expr: 'Periodo(date(2024, 3, 1), date(2024, 3, 4)).noites()', expected: '3' },
          {
            name: 'período inválido lança ValueError no construtor',
            code: py(`
              from datetime import date
              for inicio, fim in ((date(2024, 3, 4), date(2024, 3, 1)), (date(2024, 3, 1), date(2024, 3, 1))):
                  try:
                      Periodo(inicio, fim)
                  except ValueError:
                      pass
                  else:
                      raise AssertionError(f"Periodo({inicio}, {fim}) deveria lançar ValueError")
            `),
          },
          {
            name: 'sobrepoe e contem (o dia do fim é o dia da saída)',
            code: py(`
              from datetime import date
              a = Periodo(date(2024, 3, 1), date(2024, 3, 5))
              assert a.sobrepoe(Periodo(date(2024, 3, 4), date(2024, 3, 8)))
              assert not a.sobrepoe(Periodo(date(2024, 3, 5), date(2024, 3, 7))), "períodos encostados não se sobrepõem"
              assert a.contem(date(2024, 3, 1))
              assert not a.contem(date(2024, 3, 5)), "o dia da saída não pertence ao período"
            `),
          },
          { name: 'preco_total', setup: 'from datetime import date', expr: 'preco_total(Periodo(date(2024, 3, 1), date(2024, 3, 4)), 250)', expected: '750' },
          {
            name: 'pode_reservar',
            code: py(`
              from datetime import date
              reservas = [Periodo(date(2024, 3, 1), date(2024, 3, 5)), Periodo(date(2024, 3, 10), date(2024, 3, 12))]
              assert pode_reservar(reservas, Periodo(date(2024, 3, 5), date(2024, 3, 10)))
              assert not pode_reservar(reservas, Periodo(date(2024, 3, 4), date(2024, 3, 6)))
            `),
          },
          {
            name: 'Periodo é um objeto de valor imutável',
            hidden: true,
            code: py(`
              from datetime import date
              p = Periodo(date(2024, 3, 1), date(2024, 3, 4))
              assert p == Periodo(date(2024, 3, 1), date(2024, 3, 4)), "períodos com as mesmas datas devem ser iguais"
              assert len({p, Periodo(date(2024, 3, 1), date(2024, 3, 4))}) == 1, "Periodo deve ser hashable e igual por valor"
              try:
                  p.fim = date(2030, 1, 1)
              except AttributeError:
                  pass
              else:
                  raise AssertionError("Periodo deve ser imutável (dica: @dataclass(frozen=True))")
            `),
          },
          {
            name: 'mesmo comportamento das funções antigas (caracterização)',
            hidden: true,
            code: py(`
              from datetime import date, timedelta

              def _noites(inicio, fim):
                  return (fim - inicio).days

              def _sobrepoe(inicio1, fim1, inicio2, fim2):
                  return inicio1 < fim2 and inicio2 < fim1

              def _contem(inicio, fim, dia):
                  return inicio <= dia < fim

              base = date(2024, 2, 26)          # atravessa o 29 de fevereiro
              dias = [base + timedelta(days=k) for k in range(8)]
              pares = [(a, b) for a in dias for b in dias if a < b]
              reservas = [Periodo(dias[0], dias[2]), Periodo(dias[5], dias[7])]
              for a, b in pares:
                  p = Periodo(a, b)
                  assert p.noites() == _noites(a, b), f"Periodo({a}, {b}).noites() mudou de comportamento"
                  assert preco_total(p, 199.9) == _noites(a, b) * 199.9, f"preco_total(Periodo({a}, {b}), 199.9) mudou de comportamento"
                  for dia in dias:
                      assert p.contem(dia) == _contem(a, b, dia), f"Periodo({a}, {b}).contem({dia}) mudou de comportamento"
                  for c, d in pares:
                      assert p.sobrepoe(Periodo(c, d)) == _sobrepoe(a, b, c, d), f"Periodo({a}, {b}).sobrepoe(Periodo({c}, {d})) mudou de comportamento"
                  esperado = not any(_sobrepoe(r.inicio, r.fim, a, b) for r in reservas)
                  assert pode_reservar(reservas, p) == esperado, f"pode_reservar(..., Periodo({a}, {b})) mudou de comportamento"
              assert pode_reservar([], Periodo(dias[0], dias[1])), "sem reservas, sempre dá para reservar"
            `),
          },
          {
            name: 'o data clump sumiu das assinaturas',
            hidden: true,
            code: py(`
              import inspect
              assert len(inspect.signature(preco_total).parameters) == 2, "preco_total(periodo, diaria)"
              assert len(inspect.signature(pode_reservar).parameters) == 2, "pode_reservar(reservas, periodo)"
              for nome, obj in list(globals().items()):
                  if inspect.isfunction(obj) and obj.__module__ == __name__:
                      n = len(inspect.signature(obj).parameters)
                      assert n < 4, f"{nome} ainda recebe {n} parâmetros: o par (inicio, fim) continua solto"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.maxParams >= 4,
            text: 'Ainda há função com **4 ou mais parâmetros**: o *data clump* `(inicio, fim)` continua solto em alguma assinatura. Passe um `Periodo`.',
            concept: 'Data Clumps',
          },
          {
            when: (m, code) => /\w\[\s*[01]\s*\]/.test(code),
            text: 'Acesso por índice (`r[0]`, `r[1]`): uma tupla anônima obriga o leitor a lembrar o que é cada posição — é Primitive Obsession. Use atributos com nome (`reserva.inicio`).',
            concept: 'Primitive Obsession',
          },
          {
            when: (m, code) => (code.match(/fim\s*<=\s*(\w+\.)?inicio|inicio\s*>=\s*(\w+\.)?fim/g) || []).length > 1,
            text: 'A validação "fim depois do início" aparece em mais de um lugar. Num objeto de valor, ela mora **só no construtor** (`__post_init__`): todo `Periodo` que existe já é válido.',
            concept: 'Objeto de valor',
          },
          {
            when: m => m.functions.includes('__eq__') || m.functions.includes('__hash__'),
            text: 'Você escreveu `__eq__`/`__hash__` à mão. `@dataclass(frozen=True)` gera igualdade por valor, `hash` e imutabilidade de graça — menos código para manter.',
            concept: 'Objeto de valor',
          },
        ],
        hints: [
          '`@dataclass(frozen=True)` com os campos `inicio: date` e `fim: date` já dá imutabilidade, `==` por valor e `hash`. A validação vai no `__post_init__`: `if self.fim <= self.inicio: raise ValueError(...)`.',
          'Mova as funções para dentro da classe: `noites(self)`, `sobrepoe(self, outro)` → `self.inicio < outro.fim and outro.inicio < self.fim`, e `contem(self, dia)` → `self.inicio <= dia < self.fim`.',
          '`preco_total(periodo, diaria)` vira uma linha (`periodo.noites() * diaria`) e `pode_reservar(reservas, periodo)` pode ser `not any(periodo.sobrepoe(r) for r in reservas)`. A validação sumiu das funções: todo `Periodo` já nasce válido.',
        ],
        solution: py(`
          from dataclasses import dataclass
          from datetime import date


          @dataclass(frozen=True)
          class Periodo:
              """Intervalo de datas [inicio, fim): o dia do fim é o dia da saída."""

              inicio: date
              fim: date

              def __post_init__(self):
                  if self.fim <= self.inicio:
                      raise ValueError("período inválido: o fim deve ser depois do início")

              def noites(self):
                  return (self.fim - self.inicio).days

              def sobrepoe(self, outro):
                  return self.inicio < outro.fim and outro.inicio < self.fim

              def contem(self, dia):
                  return self.inicio <= dia < self.fim


          def preco_total(periodo, diaria):
              return periodo.noites() * diaria


          def pode_reservar(reservas, periodo):
              return not any(periodo.sobrepoe(reserva) for reserva in reservas)
        `),
        solutionExplanation: 'O par `(inicio, fim)` virou o objeto de valor `Periodo`. Com `@dataclass(frozen=True)` ele é imutável, comparável por valor e *hashable* sem uma linha extra — e a validação mora **só** no `__post_init__`: todo `Periodo` que existe é válido, então `preco_total` e `pode_reservar` não precisam mais checar nada (antes, `noites` e `sobrepoe` nem checavam!). O comportamento migrou para perto dos dados (`noites`, `sobrepoe`, `contem`), as assinaturas encolheram (`sobrepoe` foi de 4 parâmetros para 1) e as tuplas acessadas por índice sumiram. A regra "o dia do fim é o dia da saída" agora está documentada num lugar só, na docstring da classe.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Nariz calibrado! Agora você reconhece os cheiros clássicos — e sabe qual refatoração cada um pede.',
          'Na unidade de refatoração, vamos aprender a aplicar essas técnicas **com segurança**, em passos pequenos e sob testes.',
        ],
        board: null,
      },
    ],
  });
})();
