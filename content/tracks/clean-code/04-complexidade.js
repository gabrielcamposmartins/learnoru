(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const CALCULADOR_INICIAL = py(`
    import ast


    def complexidade_ciclomatica(codigo):
        """Devolve {nome: complexidade} para cada função (e método) do código."""
        resultado = {}
        for no in ast.walk(ast.parse(codigo)):
            if isinstance(no, ast.FunctionDef):
                complexidade = 1
                for filho in ast.walk(no):
                    if isinstance(filho, ast.If):
                        complexidade += 1
                resultado[no.name] = complexidade
        return resultado


    # TODO: laços, except, and/or, ternário, comprehensions e match;
    #       métodos como "Classe.metodo" e async def;
    #       funções internas medidas à parte ("externa.interna"), sem somar na externa.
  `);

  const INGRESSO_SETA = py(`
    def preco_ingresso(idade, estudante, dia, hora, sessao_3d):
        if idade >= 0:
            if sessao_3d:
                preco = 40.0
            else:
                preco = 30.0
            if idade < 12 or idade >= 60 or estudante:
                preco = preco / 2
            else:
                if dia == "quarta":
                    preco = preco * 0.8
                else:
                    if hora < 14:
                        if dia != "sabado" and dia != "domingo":
                            preco = preco - 5
            return round(preco, 2)
        else:
            raise ValueError("idade inválida")


    # TODO: extraia tem_meia_entrada(idade, estudante) e preco_inteira(preco_base, dia, hora),
    #       achate a seta e dê nome aos números — sem mudar nenhum preço.
  `);

  Game.registerModule('clean-code', {
    id: 'complexidade',
    title: 'Medindo complexidade',
    kind: 'lesson',
    level: 3,
    order: 11,
    unit: 'refatoracao',
    summary: 'Complexidade ciclomática (McCabe) e sua ligação com testes, complexidade cognitiva (onde o aninhamento pesa mais) e por que métricas são sinal, não meta — medindo tudo com o módulo `ast`.',
    concepts: ['Complexidade ciclomática', 'Complexidade cognitiva', 'Módulo ast', 'Lei de Goodhart', 'Hotspots'],
    takeaways: [
      '**Complexidade ciclomática** = 1 + pontos de decisão (`if`, `elif`, laços, `except`, `and`/`or`, ternário…). É o número de caminhos independentes e o **teto** de testes para cobrir todos os ramos.',
      'A ciclomática mede **testabilidade**, não legibilidade: um `match` de dez casos e dez `if`s aninhados podem ter o mesmo número.',
      '**Complexidade cognitiva** soma um extra a cada nível de **aninhamento** e ignora o que não atrapalha a leitura (como o `return` antecipado). Guard clauses e extrações a derrubam.',
      'Com `ast.parse` + `ast.walk`/`NodeVisitor` você mede o próprio código em poucas linhas — é assim que ruff, radon e o SonarQube trabalham.',
      '**Lei de Goodhart**: quando a métrica vira meta, ela é burlada. Use complexidade como **sinal** — tendência, *hotspots* (complexidade × frequência de mudança) e gatilho de conversa no review.',
    ],
    glossary: [
      { term: 'Complexidade ciclomática', aliases: ['cyclomatic complexity', 'complexidade de McCabe', 'complexidade ciclomatica', 'McCabe'], definition: 'Métrica de Thomas McCabe (1976): número de caminhos linearmente independentes do grafo de fluxo de uma função. Na prática, **1 + pontos de decisão**. É o teto de testes para cobrir todos os ramos.' },
      { term: 'Complexidade cognitiva', aliases: ['cognitive complexity', 'complexidade cognitiva'], definition: 'Métrica criada por G. Ann Campbell (SonarSource, 2017) para medir o **esforço de leitura**: soma 1 por quebra do fluxo linear e um extra por nível de **aninhamento**. Um `match` inteiro vale 1; `return` antecipado não soma.' },
      { term: 'Lei de Goodhart', aliases: ["Goodhart's Law", 'Goodhart', 'lei de goodhart'], definition: '"Quando uma medida se torna uma meta, ela deixa de ser uma boa medida." As pessoas otimizam o número, não o que ele representava — e a métrica perde o valor informativo.' },
      { term: 'Hotspot', aliases: ['hotspots', 'ponto quente', 'pontos quentes'], definition: 'Arquivo ou função que é **complexo e muda com frequência** (alto *churn* no git). Ideia de Adam Tornhill: é onde a complexidade realmente custa caro — e onde refatorar primeiro.' },
      { term: 'AST', aliases: ['árvore sintática abstrata', 'arvore sintatica abstrata', 'abstract syntax tree', 'módulo ast', 'modulo ast'], definition: 'Árvore que representa a estrutura do código (sem espaços nem comentários). Em Python, `ast.parse(codigo)` a devolve; linters, formatadores e medidores de complexidade trabalham sobre ela.' },
      { term: 'Complexidade acidental', aliases: ['accidental complexity', 'complexidade essencial', 'essential complexity'], definition: 'Fred Brooks (*No Silver Bullet*, 1986): a complexidade **essencial** vem do próprio problema; a **acidental**, da forma como o resolvemos (aninhamento, duplicação, flags). Refatorar só remove a acidental.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Na aula passada, a gente achatou setas e trocou switches por classes. Mas como saber se o código ficou **mesmo** mais simples?',
          'Hoje vamos **medir** — e depois escrever nosso próprio medidor.',
        ],
        board: {
          title: 'Complexidade ciclomática (McCabe, 1976)',
          md: `Thomas McCabe propôs contar os **caminhos independentes** do grafo de fluxo de controle de uma função:

\`\`\`text
 def sinal(n):              (entrada)
     if n > 0:                  |
         return 1           [n > 0?]----sim----> return 1
     if n < 0:                  | não
         return -1          [n < 0?]----sim----> return -1
     return 0                   | não
                             return 0
\`\`\`

**M = E − N + 2P** (arestas − nós + 2 × componentes). Na prática, ninguém desenha o grafo:

> **M = 1 + número de pontos de decisão** → \`sinal\` tem M = 1 + 2 = **3**.

| Soma 1 | Não soma |
|---|---|
| \`if\` e cada \`elif\` | \`else\` (é o caminho que "sobra") |
| \`for\`, \`while\`, \`async for\` | \`try\`, \`finally\`, \`with\` |
| cada \`except\` | \`return\`, \`raise\`, \`break\` |
| cada \`and\` / \`or\` (curto-circuito é um desvio!) | chamadas de função |
| ternário \`x if c else y\` | atribuições |
| \`for\`/\`if\` dentro de comprehensions, cada \`case\` (menos o curinga \`_\`) | |

> [!sabia] O nome vem da teoria dos grafos: o **número ciclomático** de um grafo — quantos ciclos independentes ele tem — já era usado por **Kirchhoff** em 1847 para achar as malhas independentes de um circuito elétrico. McCabe só acrescentou uma aresta imaginária da saída de volta para a entrada: cada caminho do programa vira um ciclo, e contar ciclos é problema resolvido há 130 anos.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O número de McCabe tem uma leitura muito prática: ele diz **quantos testes** você precisa, no mínimo, para exercitar cada caminho base.',
          'E explica por que função gigante é tão difícil de testar direito.',
        ],
        board: {
          title: 'Complexidade e testes',
          md: `\`\`\`python
def frete(pedido):                                     # M = 1 + 3 = 4
    if pedido.total >= 200:                            # +1
        return 0.0
    base = 15.0 if pedido.uf == "SP" else 30.0         # +1
    if pedido.expresso:                                # +1
        base *= 2
    return base
\`\`\`

| Caminho base | Entrada de teste | Esperado |
|---|---|---|
| frete grátis | total 250 | 0.0 |
| SP, normal | total 50, SP | 15.0 |
| fora de SP, normal | total 50, RJ | 30.0 |
| expresso | total 50, SP, expresso | 30.0 |

- **M é um teto** para o número de testes que cobre todos os ramos (*branch coverage*) e exatamente o tamanho de um conjunto de **caminhos base** (*basis path testing*, de McCabe).
- **M não é o número de caminhos totais**: 10 \`if\`s em sequência dão M = 11, mas **2¹⁰ = 1024** combinações possíveis. Por isso funções com M alto escondem bugs nas combinações que ninguém testou.

**Limites usuais**

| Ferramenta | Regra |
|---|---|
| McCabe (artigo original) | acima de **10**, quebre a função |
| ruff / flake8 | \`C901\` com \`max-complexity\` (ex.: 10) |
| radon | notas **A** (1–5), **B** (6–10), **C** (11–20)… até **F** (41+) |
| pylint | \`too-many-branches\` (12), \`too-many-nested-blocks\` (5) |`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o truque que eu adoro: o Python entrega a própria árvore sintática. Medir complexidade é **percorrer uma árvore**.',
          'É exatamente assim que ruff, radon e pylint funcionam por dentro.',
        ],
        board: {
          title: 'Medindo com o módulo ast',
          md: `\`\`\`python
import ast

arvore = ast.parse("""
def classificar(n):
    if n < 0 or n > 100:
        return "inválido"
    elif n >= 60:
        return "aprovado"
    return "reprovado"
""")
print(ast.dump(arvore.body[0].body[0], indent=2))
\`\`\`

\`\`\`text
If(
  test=BoolOp(op=Or(), values=[Compare(...), Compare(...)]),   <- or: +1
  body=[Return(...)],
  orelse=[If(test=Compare(...), ...)])                          <- o elif é um If dentro do orelse!
\`\`\`

Dois jeitos de percorrer:

\`\`\`python
# 1) ast.walk: todos os nós, sem se importar com a hierarquia
ifs = sum(isinstance(no, ast.If) for no in ast.walk(arvore))

# 2) NodeVisitor: um método visit_<Tipo> por tipo de nó
class ContaDecisoes(ast.NodeVisitor):
    def __init__(self):
        self.total = 1

    def visit_If(self, no):
        self.total += 1
        self.generic_visit(no)          # continua descendo

    def visit_BoolOp(self, no):         # a or b or c -> +2
        self.total += len(no.values) - 1
        self.generic_visit(no)
\`\`\`

Detalhes que mudam o resultado:
- **\`elif\`** não tem nó próprio: é um \`If\` no \`orelse\` do anterior (e soma 1, como deve).
- **Funções internas**: \`ast.walk\` entra nelas e soma as decisões na função de fora. Decida: medir à parte (o usual) ou somar.
- **Ferramentas divergem** nos detalhes (comprehensions, \`match\`, \`assert\`…). Compare números da **mesma** ferramenta.

> [!dica] \`python -m ast arquivo.py\` imprime a árvore de um arquivo inteiro (Python 3.9+). Ótimo para descobrir qual nó representa aquela sintaxe que você quer medir.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Só que tem um problema: a ciclomática mede **testabilidade**, não **legibilidade**.',
          'Olha estas duas funções: mesmo número de McCabe, esforço de leitura completamente diferente.',
        ],
        board: {
          title: 'Complexidade cognitiva: o aninhamento pesa mais',
          md: `\`\`\`python
def status_http(codigo):             # ciclomática 5 · cognitiva 1
    match codigo:                    # +1 (o match inteiro)
        case 200: return "OK"
        case 301: return "Moved Permanently"
        case 404: return "Not Found"
        case 500: return "Internal Server Error"
        case _: return "Desconhecido"
\`\`\`

\`\`\`python
def soma_dos_primos(limite):         # ciclomática 5 · cognitiva 8
    total = 0
    for i in range(2, limite + 1):   # +1
        eh_primo = True
        for j in range(2, i):        # +2 (1 + aninhamento 1)
            if i % j == 0:           # +3 (1 + aninhamento 2)
                eh_primo = False
                break
        if eh_primo:                 # +2 (1 + aninhamento 1)
            total += i
    return total
\`\`\`

**Regras da complexidade cognitiva**

| Estrutura | Incremento |
|---|---|
| \`if\`, ternário, \`for\`, \`while\`, \`except\`, \`match\` | **+1, mais 1 por nível de aninhamento** |
| \`elif\`, \`else\` | +1 (sem extra de aninhamento) |
| sequência de operadores iguais (\`a and b and c\`) | +1 por sequência; \`a and b or c\` = +2 |
| recursão | +1 |
| \`return\` antecipado, \`try\`, \`finally\`, \`with\` | **0** |

Por isso *guard clauses* derrubam a cognitiva: o caso especial sai cedo (custo 0) e o resto perde um nível de aninhamento.

> [!sabia] A complexidade cognitiva foi criada em **2017** por **G. Ann Campbell**, da SonarSource, justamente porque a ciclomática "foi desenhada para medir testabilidade, não entendimento". É a regra **S3776** do SonarQube, com limite padrão **15** por função. Pouca gente sabe que existe — e ela explica por que aquele \`switch\` enorme e organizado incomoda muito menos do que três \`if\`s um dentro do outro.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora o alerta mais importante da aula. Métrica é ótima para **enxergar**; péssima para **perseguir**.',
          'Quando um número vira meta, as pessoas otimizam o número — não o código.',
        ],
        board: {
          title: 'Métrica é sinal, não meta',
          md: `> **Lei de Goodhart**: "quando uma medida se torna uma meta, ela deixa de ser uma boa medida."

Como times burlam o limite de complexidade sem melhorar nada:

\`\`\`python
def processar_parte1(pedido): ...     # quebrado ao meio só para o linter calar:
def processar_parte2(pedido): ...     # nomes sem sentido, estado passado de mão em mão
\`\`\`

- trocar \`if\`s por um \`dict\` de lambdas **ilegível**, só porque o dict "não conta";
- \`# noqa: C901\` em massa, sem justificativa;
- cobertura 100% com testes **sem asserts**.

**Como usar bem**

| Uso saudável | Por quê |
|---|---|
| **Tendência** (catraca: não pode piorar) | direção importa mais que o valor absoluto |
| **Hotspots** = complexidade × frequência de mudança | código complexo que ninguém toca custa pouco |
| **Gatilho de conversa** no review | "por que esta função tem 25?" — às vezes há boa razão |
| Exceção **justificada** (\`# noqa: C901 — tabela de regras fiscais\`) | a métrica serve ao time, não o contrário |

\`\`\`bash
# arquivos que mais mudaram no último ano (o "churn" dos hotspots)
git log --since=1.year --name-only --format= | sort | uniq -c | sort -rn | head
\`\`\`

> [!sabia] **Charles Goodhart** era economista do Banco da Inglaterra e escreveu sobre política monetária em **1975**; a frase famosa é uma reformulação da antropóloga **Marilyn Strathern** (1997). Já a ideia de *hotspots* é de **Adam Tornhill** (*Your Code as a Crime Scene*): cruzar complexidade com o histórico do git revela que uma fração pequena dos arquivos concentra a maior parte do esforço de manutenção.`,
        },
      },
      {
        type: 'say',
        text: [
          'Então, como **reduzir** complexidade de verdade? Primeiro, aceitando que parte dela não vai embora.',
          'A regra do problema é essencial. O aninhamento, as flags e as duplicações são por nossa conta.',
        ],
        board: {
          title: 'Reduzindo a complexidade acidental',
          md: `| Técnica | Efeito |
|---|---|
| **Guard clauses** | tiram níveis de aninhamento (a cognitiva despenca) |
| **Extract Function** com nome de regra | distribui decisões; cada função cabe na cabeça |
| **Decompose Conditional** | \`if fora_da_temporada(data)\` em vez de três comparações |
| **Tabela** (\`dict\`) em vez de \`if/elif\` de dados | a decisão vira dado |
| **Conjuntos** e \`any\`/\`all\` | \`dia not in FIM_DE_SEMANA\` em vez de \`dia != "sabado" and dia != "domingo"\` |
| **Polimorfismo** | o switch repetido some das funções |
| Trocar **variável-flag** por \`return\` | um estado a menos para acompanhar |

\`\`\`python
# antes: M = 5
def taxa(uf):
    if uf == "SP":
        return 0.18
    elif uf == "RJ":
        return 0.20
    elif uf == "MG":
        return 0.18
    elif uf == "RS":
        return 0.17
    return 0.12

# depois: M = 1 — a regra virou dado (e dá para carregar de um arquivo)
ALIQUOTAS = {"SP": 0.18, "RJ": 0.20, "MG": 0.18, "RS": 0.17}
ALIQUOTA_PADRAO = 0.12

def taxa(uf):
    return ALIQUOTAS.get(uf, ALIQUOTA_PADRAO)
\`\`\`

> [!atencao] Extrair função **não reduz** a complexidade total do módulo — só a distribui. O ganho é que cada pedaço ganha um **nome** e pode ser entendido e testado sozinho. Se a extração não gera um bom nome, provavelmente é só fuga do linter.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Contar caminhos, comparar métricas, construir um medidor com ast e achatar uma função.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'cc-cx-q1',
        concept: 'Complexidade ciclomática',
        say: 'Aquecimento: conte os caminhos na mão, como o McCabe faria.',
        prompt: `Qual é a complexidade ciclomática desta função?

\`\`\`python
def classificar(pedido):
    if not pedido.itens:
        return "vazio"
    for item in pedido.itens:
        if item.preco < 0 or item.qtd <= 0:
            raise ValueError(item)
    if pedido.total > 1000 and pedido.cliente.vip:
        return "prioritario"
    return "normal"
\`\`\``,
        options: [
          { text: '4', why: 'Contou só os três `if` (+1 da base). Faltou o `for` (o laço pode rodar ou não) e os operadores `or`/`and`, que também desviam o fluxo por curto-circuito.' },
          { text: '5', why: 'Contou `if`s e o `for`, mas esqueceu os operadores booleanos: `a or b` só avalia `b` se `a` for falso — isso é um desvio a mais.' },
          { text: '7', correct: true, why: '1 (base) + 3 `if` + 1 `for` + 1 `or` + 1 `and` = 7. São 7 caminhos base — e, no mínimo, 7 testes para exercitar cada um.' },
          { text: '8', why: 'Parece que o `raise` entrou na conta. `raise` e `return` encerram caminhos, mas não criam decisões novas: quem cria o desvio é o `if` antes deles.' },
        ],
        explanation: 'A regra prática é **1 + pontos de decisão**. Pontos de decisão são tudo o que pode seguir por dois caminhos: `if`/`elif`, laços (entrar ou não), `except`, ternários e cada `and`/`or` (por causa do curto-circuito). `else`, `return` e `raise` não contam. Com M = 7, uma suíte que exercita os caminhos base tem pelo menos 7 casos — um bom indicador de quanto essa função custa para testar.',
      },
      {
        type: 'mcq',
        id: 'cc-cx-q2',
        concept: 'Complexidade cognitiva',
        say: 'Agora compare as duas métricas numa refatoração real.',
        prompt: `Um PR trocou a versão **A** pela **B**:

\`\`\`python
# A
def aplicar_descontos(pedidos):
    for pedido in pedidos:
        if pedido.cliente.vip:
            for item in pedido.itens:
                if item.em_promocao:
                    item.preco *= 0.9
\`\`\`

\`\`\`python
# B
def aplicar_descontos(pedidos):
    for pedido in pedidos:
        aplicar_desconto_vip(pedido)

def aplicar_desconto_vip(pedido):
    if not pedido.cliente.vip:
        return
    for item in pedido.itens:
        if item.em_promocao:
            item.preco *= 0.9
\`\`\`

Qual afirmação é correta?`,
        options: [
          { text: 'A ciclomática total praticamente não mudou (5 → 2 + 4 = 6), mas a cognitiva caiu de 10 para 1 + 4 = 5: o que pesava era o aninhamento, e a guard clause mais a extração o reduziram.', correct: true, why: 'Em A, cada estrutura paga +1 por nível: 1 + 2 + 3 + 4 = 10. Em B, nenhuma passa do nível 1. As decisões são as mesmas (a regra é essencial), mas ficaram mais rasas e com nome.' },
          { text: 'A refatoração não adiantou: a complexidade ciclomática até subiu de 5 para 6.', why: 'A ciclomática conta caminhos (testabilidade); ela sobe 1 com cada função nova e não enxerga aninhamento. O ganho de B está na leitura, e é isso que a cognitiva mede.' },
          { text: 'A cognitiva também não mudou, porque ela conta as mesmas estruturas que a ciclomática.', why: 'A diferença central da cognitiva é o **incremento por aninhamento**: o mesmo `if` custa 1 no nível zero e 4 dentro de três estruturas.' },
          { text: 'O ganho veio do `return` antecipado, que a complexidade cognitiva conta como −1.', why: 'Não existe decremento. O `return` antecipado simplesmente custa **0** — e, de quebra, evita que o resto da função ganhe um nível de aninhamento.' },
        ],
        explanation: 'Mesma regra, mesmas decisões — a complexidade **essencial** não muda. O que muda é a **acidental**: em A, quem lê precisa segurar quatro contextos ao mesmo tempo ("estou num pedido, que é VIP, num item, que está em promoção"). Em B, cada função tem no máximo um nível e um nome que conta a regra. É por isso que a ciclomática serve para dimensionar testes, e a cognitiva, para decidir onde a leitura dói.',
      },
      {
        type: 'match',
        id: 'cc-cx-q3',
        concept: 'Métricas de complexidade',
        say: 'Rodada rápida de vocabulário: associe cada termo à sua ideia.',
        prompt: 'Associe cada **conceito** à sua **definição**.',
        pairs: [
          { left: 'Complexidade ciclomática', right: 'Caminhos independentes; teto de testes para cobrir todos os ramos' },
          { left: 'Complexidade cognitiva', right: 'Esforço de leitura; cada nível de aninhamento pesa mais' },
          { left: 'Lei de Goodhart', right: 'Quando a medida vira meta, deixa de ser uma boa medida' },
          { left: 'Hotspot', right: 'Código complexo que também muda com frequência' },
          { left: 'Complexidade essencial', right: 'A que vem do próprio problema; nenhuma refatoração remove' },
          { left: 'Complexidade acidental', right: 'A que criamos na solução: aninhamento, flags, duplicação' },
        ],
        explanation: 'As duas métricas respondem perguntas diferentes: "quantos testes preciso?" (ciclomática) e "quanto custa entender?" (cognitiva). Nenhuma distingue a complexidade essencial da acidental — isso é julgamento humano. E como toda métrica vira alvo de otimização (Goodhart), o melhor uso é apontar **onde olhar**: os *hotspots*, que são complexos **e** vivem mudando.',
      },
      {
        type: 'code',
        id: 'cc-cx-q4',
        concept: 'Complexidade ciclomática',
        title: 'Seu próprio medidor de McCabe',
        points: 60,
        say: 'Hora de construir a ferramenta! O esqueleto só conta `if` — e ainda soma as funções internas na de fora.',
        prompt: `Complete \`complexidade_ciclomatica(codigo)\`: ela recebe o **texto** de um programa Python e devolve um \`dict\` \`{nome: complexidade}\` para cada função.

**Regras de contagem** (por função):
- começa em **1**;
- **+1** por \`if\` (cada \`elif\` também), \`for\`, \`async for\`, \`while\`, \`except\` e ternário (\`x if c else y\`);
- **\`and\`/\`or\`**: +1 por operador — \`a and b and c\` soma **2**;
- **comprehensions**: +1 por \`for\` e +1 por \`if\` dentro dela;
- **\`match\`**: +1 por \`case\`, exceto o curinga \`case _:\` sem guarda (ele faz o papel do \`else\`);
- \`else\`, \`try\`, \`finally\`, \`with\`, \`return\` e \`raise\` não somam.

**Nomes e escopos**:
- métodos aparecem como \`"Classe.metodo"\` (classes aninhadas: \`"A.B.metodo"\`); \`async def\` também conta;
- funções internas são medidas **à parte**, como \`"externa.interna"\`, e suas decisões **não** somam na externa;
- **lambdas** não são medidas à parte: suas decisões somam na função que as contém;
- código fora de funções não entra no resultado (sem funções → \`{}\`).`,
        starter: CALCULADOR_INICIAL,
        tests: [
          { name: 'função sem decisões', expr: 'complexidade_ciclomatica("def f(x): return x + 1")', expected: '{"f": 1}' },
          {
            name: 'if / elif / else',
            code: py(`
              CODIGO = '''
              def classificar(n):
                  if n < 0:
                      return "negativo"
                  elif n == 0:
                      return "zero"
                  else:
                      return "positivo"
              '''
              assert complexidade_ciclomatica(CODIGO) == {"classificar": 3}, complexidade_ciclomatica(CODIGO)
            `),
          },
          {
            name: 'laços e except somam; with, try, else e finally não',
            code: py(`
              CODIGO = '''
              def processar(itens):
                  total = 0
                  for item in itens:
                      while item > 10:
                          item -= 10
                      try:
                          total += 100 // item
                      except ZeroDivisionError:
                          pass
                      except TypeError:
                          pass
                  return total

              def salvar(arquivo, dados):
                  with arquivo:
                      try:
                          arquivo.write(dados)
                      except OSError:
                          return False
                      else:
                          return True
                      finally:
                          arquivo.flush()
              '''
              obtido = complexidade_ciclomatica(CODIGO)
              assert obtido == {"processar": 5, "salvar": 2}, obtido
            `),
          },
          {
            name: 'and/or, ternário e comprehensions',
            code: py(`
              CODIGO = '''
              def pode_editar(u):
                  return u.ativo and not u.bloqueado and (u.admin or u.dono)

              def rotulo(x):
                  return "par" if x % 2 == 0 else "ímpar"

              def positivos_pares(xs):
                  return [x for x in xs if x > 0 if x % 2 == 0]
              '''
              obtido = complexidade_ciclomatica(CODIGO)
              assert obtido == {"pode_editar": 4, "rotulo": 2, "positivos_pares": 4}, obtido
            `),
          },
          {
            name: 'match: cada case soma, menos o curinga',
            code: py(`
              CODIGO = '''
              def comando(c):
                  match c:
                      case "start":
                          return 1
                      case "stop" | "halt":
                          return 2
                      case _:
                          return 0
              '''
              assert complexidade_ciclomatica(CODIGO) == {"comando": 3}, complexidade_ciclomatica(CODIGO)
            `),
          },
          {
            name: 'métodos e funções internas medidos à parte',
            code: py(`
              CODIGO = '''
              class Conta:
                  def sacar(self, valor):
                      if valor <= 0:
                          raise ValueError(valor)
                      self.saldo -= valor

              def externa(xs):
                  def chave(x):
                      return x if x > 0 else -x
                  return sorted(xs, key=chave) if xs else []
              '''
              obtido = complexidade_ciclomatica(CODIGO)
              assert obtido == {"Conta.sacar": 2, "externa": 2, "externa.chave": 2}, obtido
            `),
          },
          { name: 'código sem funções', expr: 'complexidade_ciclomatica("x = 1 if True else 2\\nfor i in range(3):\\n    x += i\\n")', expected: '{}' },
          {
            name: 'programa completo (async, classes aninhadas, lambdas)',
            hidden: true,
            code: py(`
              CODIGO = '''
              LIMITE = 10 if True else 20

              class Estoque:
                  def __init__(self):
                      self.itens = {}

                  def baixar(self, sku, qtd):
                      if qtd <= 0 or sku not in self.itens:
                          raise ValueError(sku)
                      while qtd > 0 and self.itens[sku] > 0:
                          self.itens[sku] -= 1
                          qtd -= 1
                      return qtd == 0

                  class Relatorio:
                      def linhas(self, estoque):
                          return [f"{k}: {v}" for k, v in estoque.itens.items() if v > 0]

              async def sincronizar(fonte, destino):
                  async for lote in fonte:
                      try:
                          await destino.enviar(lote)
                      except (TimeoutError, ConnectionError):
                          continue
                      except Exception:
                          break

              def ordenar(pedidos):
                  def chave(p):
                      return (0 if p.vip else 1, p.data)
                  filtrados = filter(lambda p: p.ativo and not p.cancelado, pedidos)
                  return sorted(filtrados, key=chave)
              '''
              esperado = {
                  "Estoque.__init__": 1,
                  "Estoque.baixar": 5,
                  "Estoque.Relatorio.linhas": 3,
                  "sincronizar": 4,
                  "ordenar": 2,
                  "ordenar.chave": 2,
              }
              obtido = complexidade_ciclomatica(CODIGO)
              assert obtido == esperado, f"esperado {esperado}, obtido {obtido}"
            `),
          },
        ],
        reviews: [
          {
            when: m => !m.imports.includes('ast'),
            text: 'Contar palavras-chave no **texto** (`codigo.count("if")`) quebra com strings, comentários e nomes como `verificar`. Use `ast.parse` e conte **nós** da árvore: é o que as ferramentas de verdade fazem.',
            concept: 'Módulo ast',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Ironia do dia: alguma função do seu medidor tem complexidade acima de 8. Separe as responsabilidades — por exemplo, `_decisoes(no)` diz quanto **um** nó soma, `_complexidade(funcao)` percorre o corpo e `complexidade_ciclomatica` só cuida dos nomes. E use tuplas no `isinstance` (`isinstance(no, (ast.If, ast.For, ...))`) em vez de um `if` por tipo.',
            concept: 'Extract Function',
          },
          {
            when: m => m.maxNesting >= 5,
            text: 'O medidor ficou com 5 ou mais níveis de aninhamento. Uma função recursiva (ou uma pilha explícita) que recebe o **prefixo** do nome resolve métodos e funções internas sem `if` dentro de `for` dentro de `if`.',
            concept: 'Complexidade cognitiva',
          },
        ],
        hints: [
          'Separe o problema em dois: (1) quanto **um nó** soma — `isinstance(no, (ast.If, ast.IfExp, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler))` vale 1; `ast.BoolOp` vale `len(no.values) - 1`; `ast.comprehension` vale `1 + len(no.ifs)`; `ast.match_case` vale 1, exceto o curinga; (2) como **percorrer** uma função sem entrar nas funções internas.',
          'Para não somar as funções internas, não use `ast.walk` no corpo: percorra com uma pilha (`ast.iter_child_nodes`) e **não empilhe** os filhos de `FunctionDef`/`AsyncFunctionDef`/`ClassDef`. Lambdas continuam sendo percorridas (elas somam na função de fora). O curinga é `isinstance(caso.pattern, ast.MatchAs) and caso.pattern.pattern is None and caso.guard is None`.',
          'Para os nomes, use uma função recursiva `visitar(no, prefixo)` sobre `ast.iter_child_nodes`: ao achar uma função, registre `prefixo + nome` e visite o corpo dela com `prefixo + nome + "."`; ao achar uma classe, só visite com `prefixo + classe + "."`; nos demais nós, visite mantendo o prefixo.',
        ],
        solution: py(`
          import ast

          FUNCOES = (ast.FunctionDef, ast.AsyncFunctionDef)
          ESCOPOS = FUNCOES + (ast.ClassDef,)
          DECISOES_SIMPLES = (ast.If, ast.IfExp, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler)


          def _eh_curinga(caso):
              return isinstance(caso.pattern, ast.MatchAs) and caso.pattern.pattern is None and caso.guard is None


          def _decisoes(no):
              """Quantos caminhos novos este nó abre."""
              if isinstance(no, DECISOES_SIMPLES):
                  return 1
              if isinstance(no, ast.BoolOp):
                  return len(no.values) - 1          # a and b and c: dois desvios
              if isinstance(no, ast.comprehension):
                  return 1 + len(no.ifs)
              if isinstance(no, ast.match_case):
                  return 0 if _eh_curinga(no) else 1
              return 0


          def _complexidade(funcao):
              total, pendentes = 1, list(ast.iter_child_nodes(funcao))
              while pendentes:
                  no = pendentes.pop()
                  if isinstance(no, ESCOPOS):
                      continue                       # funções e classes internas são medidas à parte
                  total += _decisoes(no)
                  pendentes.extend(ast.iter_child_nodes(no))
              return total


          def complexidade_ciclomatica(codigo):
              resultado = {}

              def visitar(no, prefixo):
                  for filho in ast.iter_child_nodes(no):
                      if isinstance(filho, FUNCOES):
                          resultado[prefixo + filho.name] = _complexidade(filho)
                          visitar(filho, prefixo + filho.name + ".")
                      elif isinstance(filho, ast.ClassDef):
                          visitar(filho, prefixo + filho.name + ".")
                      else:
                          visitar(filho, prefixo)

              visitar(ast.parse(codigo), "")
              return resultado
        `),
        solutionExplanation: 'A solução separa três responsabilidades. `_decisoes` responde "quanto este nó soma?" com uma tupla de tipos simples e três casos especiais (`BoolOp` soma um por operador, `comprehension` soma o `for` e cada `if`, `match_case` ignora o curinga). `_complexidade` percorre o corpo com uma **pilha** em vez de `ast.walk`, justamente para poder **parar** nas funções e classes internas — lambdas não são escopo nomeado e continuam sendo percorridas. `complexidade_ciclomatica` só cuida dos **nomes**: a recursão carrega o prefixo (`"Estoque.Relatorio."`), e é por isso que métodos, classes aninhadas e funções internas ganham nomes qualificados. Repare que o próprio medidor respeita o que mede: nenhuma função passa de complexidade 6. É, em miniatura, o que o `mccabe` (usado pelo flake8) e o radon fazem.',
      },
      {
        type: 'code',
        id: 'cc-cx-q5',
        concept: 'Reduzir complexidade',
        title: 'Achatando o preço do ingresso',
        points: 50,
        say: 'Agora use o que mediu: esta função tem complexidade 10 e cinco níveis de aninhamento. Deixe cada função com no máximo 4 e um nível só — sem mudar nenhum preço.',
        prompt: `\`preco_ingresso\` funciona, mas tem **complexidade ciclomática 10** e **5 níveis** de aninhamento. As regras do cinema:

- idade negativa → \`ValueError\`;
- sessão 3D custa 40, as demais 30;
- **meia-entrada** (metade) para menores de 12, pessoas com 60 anos ou mais e estudantes;
- quem paga inteira ganha **20% na quarta-feira**, ou **5 reais de desconto** nas sessões antes das 14h de segunda a sexta (os descontos não se acumulam);
- o preço final é arredondado em 2 casas.

Refatore **sem mudar nenhum resultado**, com a meta de **nenhuma função acima de complexidade 4** e **aninhamento máximo 1**:

1. **Extract Function** — \`tem_meia_entrada(idade, estudante)\` → \`bool\`.
2. **Extract Function** — \`preco_inteira(preco_base, dia, hora)\` → o preço de quem paga inteira, já com a promoção do dia/horário (sem arredondar).
3. **Guard clauses** em \`preco_ingresso\`, que deve **usar** as duas funções.
4. **Replace Magic Literal** nos números das regras (e \`dia not in FIM_DE_SEMANA\` no lugar das duas comparações).`,
        starter: INGRESSO_SETA,
        tests: [
          {
            name: 'inteira: 2D, 3D e idade limite',
            code: py(`
              assert preco_ingresso(30, False, "sexta", 20, False) == 30.0
              assert preco_ingresso(30, False, "sexta", 20, True) == 40.0
              assert preco_ingresso(12, False, "sexta", 20, False) == 30.0
              assert preco_ingresso(59, False, "sexta", 20, False) == 30.0
            `),
          },
          {
            name: 'meia-entrada: criança, idoso e estudante',
            code: py(`
              assert preco_ingresso(0, False, "sexta", 20, False) == 15.0
              assert preco_ingresso(11, False, "sexta", 20, False) == 15.0
              assert preco_ingresso(60, False, "sexta", 20, True) == 20.0
              assert preco_ingresso(25, True, "sexta", 20, False) == 15.0
            `),
          },
          {
            name: 'quarta-feira e matinê não se acumulam; meia não ganha promoção',
            code: py(`
              assert preco_ingresso(30, False, "quarta", 20, False) == 24.0
              assert preco_ingresso(30, False, "quarta", 10, False) == 24.0
              assert preco_ingresso(30, True, "quarta", 20, False) == 15.0
              assert preco_ingresso(30, False, "terca", 13, False) == 25.0
              assert preco_ingresso(30, False, "terca", 14, False) == 30.0
              assert preco_ingresso(30, False, "sabado", 10, False) == 30.0
              assert preco_ingresso(30, False, "domingo", 10, True) == 40.0
            `),
          },
          {
            name: 'idade negativa lança ValueError',
            code: py(`
              try:
                  preco_ingresso(-1, False, "sexta", 20, False)
              except ValueError:
                  pass
              else:
                  raise AssertionError("idade negativa deveria lançar ValueError")
            `),
          },
          {
            name: 'funções extraídas',
            code: py(`
              assert tem_meia_entrada(11, False) and tem_meia_entrada(60, False) and tem_meia_entrada(30, True)
              assert not tem_meia_entrada(12, False) and not tem_meia_entrada(59, False)
              assert abs(preco_inteira(30.0, "quarta", 10) - 24.0) < 1e-9
              assert abs(preco_inteira(40.0, "segunda", 13) - 35.0) < 1e-9
              assert abs(preco_inteira(30.0, "domingo", 9) - 30.0) < 1e-9
              assert abs(preco_inteira(40.0, "sexta", 21) - 40.0) < 1e-9
            `),
          },
          {
            name: 'mesmo resultado da versão original (caracterização)',
            hidden: true,
            code: py(`
              def _original(idade, estudante, dia, hora, sessao_3d):
                  if idade < 0:
                      raise ValueError("idade inválida")
                  preco = 40.0 if sessao_3d else 30.0
                  if idade < 12 or idade >= 60 or estudante:
                      preco = preco / 2
                  elif dia == "quarta":
                      preco = preco * 0.8
                  elif hora < 14 and dia != "sabado" and dia != "domingo":
                      preco = preco - 5
                  return round(preco, 2)

              dias = ("segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
              for idade in (0, 5, 11, 12, 30, 59, 60, 80):
                  for estudante in (False, True):
                      for dia in dias:
                          for hora in (9, 13, 14, 22):
                              for sessao_3d in (False, True):
                                  args = (idade, estudante, dia, hora, sessao_3d)
                                  esperado, obtido = _original(*args), preco_ingresso(*args)
                                  assert obtido == esperado, f"{args}: o original dava {esperado}, a refatoração deu {obtido}"
            `),
          },
          {
            name: 'preco_ingresso usa as funções extraídas',
            hidden: true,
            code: py(`
              import types

              def _nomes_usados(funcao):
                  nomes, pilha = set(), [funcao.__code__]
                  while pilha:
                      codigo = pilha.pop()
                      nomes.update(codigo.co_names)
                      pilha.extend(c for c in codigo.co_consts if isinstance(c, types.CodeType))
                  return nomes

              usados = _nomes_usados(preco_ingresso)
              for extraida in ("tem_meia_entrada", "preco_inteira"):
                  assert extraida in usados, f"preco_ingresso deve chamar {extraida}() — senão a decisão continua duplicada lá dentro"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.maxNesting >= 2,
            text: 'Ainda há **2 ou mais níveis de aninhamento** — e cada nível encarece a leitura (é o que a complexidade cognitiva mede). Trate a idade inválida e a meia-entrada como *guard clauses* que saem cedo; a promoção do dia fica em `preco_inteira`, com `return`s em vez de `else`.',
            concept: 'Complexidade cognitiva',
          },
          {
            when: m => m.funcs.some(f => f.complexity > 4),
            text: 'Alguma função ainda tem **complexidade ciclomática acima de 4**. Distribua as decisões em funções com nome de regra e troque `dia != "sabado" and dia != "domingo"` por `dia not in FIM_DE_SEMANA`: um conjunto no lugar de dois desvios.',
            concept: 'Complexidade ciclomática',
          },
          {
            when: (m, code) => /^[ \t]+[^#\n]*(\b0\.8\b|\b(12|14|60)\b|\b(30|40)\.0\b|-\s*5\b)/m.test(code),
            text: 'Ainda há **números mágicos** dentro das funções (12, 60, 30.0, 40.0, 0.8, 5, 14). São regras do negócio: dê nome a eles (`IDADE_IDOSO`, `PRECO_3D`, `HORA_FIM_MATINE`…) para que mudem num lugar só.',
            concept: 'Replace Magic Literal',
          },
        ],
        hints: [
          'Comece pelas extrações, que não mexem no resto: `tem_meia_entrada` é um único `return` com `or`; `preco_inteira` tem dois `if` com `return` (quarta-feira primeiro, depois a matinê em dia útil) e um `return preco_base` no fim.',
          'Em `preco_ingresso`: `if idade < 0: raise ValueError(...)`; depois `preco = PRECO_3D if sessao_3d else PRECO_2D`; depois `if tem_meia_entrada(idade, estudante): return round(preco / 2, 2)`. O que sobra é o caminho de quem paga inteira.',
          'Cuidado com a ordem: na quarta, a matinê **não** se aplica — por isso o teste da quarta vem antes. Mantenha as mesmas contas (`preco * 0.8`, `preco - 5`, arredondamento só no fim) para os centavos baterem.',
        ],
        solution: py(`
          PRECO_2D = 30.0
          PRECO_3D = 40.0
          IDADE_LIMITE_CRIANCA = 12
          IDADE_IDOSO = 60
          DIA_PROMOCIONAL = "quarta"
          FATOR_DIA_PROMOCIONAL = 0.8          # 20% de desconto
          DESCONTO_MATINE = 5
          HORA_FIM_MATINE = 14
          FIM_DE_SEMANA = frozenset({"sabado", "domingo"})


          def tem_meia_entrada(idade, estudante):
              return idade < IDADE_LIMITE_CRIANCA or idade >= IDADE_IDOSO or estudante


          def preco_inteira(preco_base, dia, hora):
              if dia == DIA_PROMOCIONAL:
                  return preco_base * FATOR_DIA_PROMOCIONAL
              if hora < HORA_FIM_MATINE and dia not in FIM_DE_SEMANA:
                  return preco_base - DESCONTO_MATINE
              return preco_base


          def preco_ingresso(idade, estudante, dia, hora, sessao_3d):
              if idade < 0:
                  raise ValueError("idade inválida")
              preco = PRECO_3D if sessao_3d else PRECO_2D
              if tem_meia_entrada(idade, estudante):
                  return round(preco / 2, 2)
              return round(preco_inteira(preco, dia, hora), 2)
        `),
        solutionExplanation: 'Antes: uma função com complexidade 10 e cinco níveis de aninhamento. Depois: três funções com complexidade 3, 4 e 4, nenhuma com mais de um nível. A complexidade **total** quase não mudou — as regras do cinema são essenciais —, mas cada decisão ganhou um nome (`tem_meia_entrada`, `preco_inteira`) e pode ser lida e testada sozinha. As *guard clauses* tiraram o `else` gigante do fim, o `frozenset` trocou duas comparações por uma pergunta de pertinência, e as constantes transformaram números soltos em regras buscáveis. Repare também no que **não** mudou: a ordem das contas, o arredondamento só no fim e a regra de que a promoção da quarta não se acumula com a matinê — o teste de caracterização oculto compara 896 combinações com a versão original.',
      },
      {
        type: 'open',
        id: 'cc-cx-q6',
        concept: 'Lei de Goodhart',
        say: 'Para fechar, uma conversa difícil com a liderança.',
        prompt: 'Seu tech lead propõe: "a partir de agora, o CI reprova qualquer função com complexidade ciclomática acima de 10, e o bônus do time vai depender de reduzir a complexidade **média** em 30% neste trimestre". O que você responderia? Que riscos vê e como usaria a métrica?',
        minWords: 40,
        rubric: [
          { label: 'Cita a **Lei de Goodhart**: métrica que vira meta é burlada', keywords: ['goodhart', 'vira meta', 'virar meta', 'vira alvo', 'target', 'burla', 'burlar', 'gaming', 'trapac', 'manipul', 'maquia', 'distorc', 'incentivo'], concept: 'Lei de Goodhart', why: 'Com bônus atrelado, o time otimiza o número — não a legibilidade. A métrica perde o valor informativo justamente quando passa a importar.' },
          { label: 'Mostra **como** o número seria burlado (quebrar funções sem sentido, noqa, mover a complexidade)', keywords: ['parte1', 'parte 1', 'quebrar', 'fragment', 'picot', 'sem sentido', 'sem nome', 'nomes ruins', 'noqa', 'dividir', 'funcoes pequenas', 'funcoes triviais', 'getters', 'mover a complexidade', 'esconde'], concept: 'Métricas de complexidade', why: 'A média cai criando dezenas de funções triviais; o limite é contornado partindo funções ao meio. O código não fica mais simples — só mais espalhado.' },
          { label: 'Propõe usar como **sinal**: tendência/catraca, hotspots, conversa no review', keywords: ['sinal', 'tendencia', 'catraca', 'ratchet', 'nao piorar', 'hotspot', 'churn', 'frequencia de mudanca', 'mudam com frequencia', 'conversa', 'review', 'revisao', 'alerta', 'aviso', 'investig', 'priorizar'], concept: 'Hotspots', why: 'A métrica é ótima para apontar onde olhar (complexo **e** mudando muito) e para impedir que piore, deixando a decisão para as pessoas.' },
          { label: 'Lembra que ciclomática **não mede legibilidade** e que exceções justificadas existem', keywords: ['cognitiv', 'legib', 'leitura', 'entendimento', 'entender', 'aninhamento', 'essencial', 'excec', 'justific', 'contexto', 'match', 'tabela'], concept: 'Complexidade cognitiva', why: 'Um `match` com 15 casos tem ciclomática alta e é fácil de ler; três `if`s aninhados têm ciclomática baixa e doem. Uma regra cega pune o primeiro e ignora o segundo.' },
        ],
        modelAnswer: `Eu apoiaria medir, mas não transformar o número em meta com bônus: pela **Lei de Goodhart**, quando a medida vira meta ela deixa de ser uma boa medida — o time passaria a otimizar o número, não o código.

Na prática, a **média** cai criando dezenas de funções triviais, e o limite de 10 é contornado partindo funções ao meio (\`processar_parte1\`, \`processar_parte2\`) ou espalhando \`# noqa\`. A complexidade não some, só fica mais espalhada e com nomes ruins.

Além disso, a ciclomática mede testabilidade, **não legibilidade**: um \`match\` com 15 casos é fácil de ler e seria reprovado, enquanto três \`if\`s aninhados passariam. A complexidade cognitiva, que pesa o aninhamento, é um sinal melhor para leitura — e às vezes uma exceção justificada (uma tabela de regras fiscais) é a escolha certa.

Minha proposta: usar a métrica como **sinal**. Uma **catraca** no CI (nenhuma função pode piorar), um relatório de **hotspots** (complexidade × frequência de mudança no git) para priorizar refatorações, e números altos como **gatilho de conversa** no review, não como bloqueio automático nem como bônus.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora você sabe contar caminhos, enxergar o custo do aninhamento e até construir o seu próprio medidor com `ast`.',
          'E, principalmente, sabe que o número serve para apontar **onde olhar** — quem decide é você. Na próxima unidade, saímos da função e vamos para o design: acoplamento, coesão e connascence.',
        ],
        board: null,
      },
    ],
  });
})();
