(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const CHECKOUT_TREM = py(`
    class Endereco:
        def __init__(self, cidade, uf):
            self.cidade = cidade
            self.uf = uf


    class Carteira:
        def __init__(self, saldo):
            self.saldo = saldo


    class Cliente:
        def __init__(self, nome, endereco, carteira):
            self.nome = nome
            self.endereco = endereco
            self.carteira = carteira


    class Pedido:
        def __init__(self, cliente, total):
            self.cliente = cliente
            self.total = total
            self.pago = False


    def frete(pedido):
        if pedido.cliente.endereco.uf == "SP":
            return 10.0
        return 25.0


    def pagar(pedido):
        valor = pedido.total + frete(pedido)
        if pedido.cliente.carteira.saldo < valor:
            raise ValueError("saldo insuficiente")
        pedido.cliente.carteira.saldo -= valor
        pedido.pago = True
        return valor


    def etiqueta(pedido):
        return f"{pedido.cliente.nome} - {pedido.cliente.endereco.cidade}/{pedido.cliente.endereco.uf}"


    # TODO: Carteira.debitar(valor); Pedido.frete(), Pedido.pagar() e Pedido.etiqueta()
    #       falando só com amigos imediatos; as funções antigas apenas delegam ao pedido.
  `);

  const LCOM_INICIAL = py(`
    import ast


    def lcom4(codigo):
        """Devolve {nome_da_classe: LCOM4} para cada classe do código."""
        resultado = {}
        for no in ast.walk(ast.parse(codigo)):
            if isinstance(no, ast.ClassDef):
                metodos = [m for m in no.body if isinstance(m, ast.FunctionDef) and m.name != "__init__"]
                # TODO: ligar métodos que usam o mesmo self.<atributo> (ou que chamam um ao outro
                #       via self.metodo()) e contar os componentes conexos do grafo.
                resultado[no.name] = len(metodos)
        return resultado
  `);

  const demeterHelper = py(`
    def _pedido(uf="SP", saldo=500.0, total=100.0, nome="Ana", cidade="São Paulo"):
        return Pedido(Cliente(nome, Endereco(cidade, uf), Carteira(saldo)), total)
  `);

  Game.registerModule('clean-code', {
    id: 'acoplamento-coesao',
    title: 'Acoplamento, coesão e connascence',
    kind: 'lesson',
    level: 3,
    order: 20,
    unit: 'design',
    summary: 'Coesão alta e acoplamento baixo — mas com vocabulário preciso: connascence (força, localidade e grau), Lei de Demeter além de "contar pontos", tell don\'t ask e LCOM para medir coesão com `ast`.',
    concepts: ['Acoplamento e coesão', 'Connascence', 'Lei de Demeter', "Tell, Don't Ask", 'LCOM'],
    takeaways: [
      '**Coesão** mede o quanto o que está dentro de um módulo pertence junto; **acoplamento**, o quanto ele depende do que está fora. Queremos coesão alta e acoplamento baixo.',
      '**Connascence**: dois elementos são connascentes se mudar um obriga a mudar o outro. Tipos, do mais fraco ao mais forte: nome, tipo, significado, posição, algoritmo, execução, tempo, valor, identidade.',
      'Julgue connascence por **força**, **localidade** e **grau**: refatore para formas mais fracas (posição → nome com argumentos nomeados; significado → `Enum`) e mantenha as fortes **perto**.',
      '*Train wrecks* (`pedido.cliente.carteira.saldo`) espalham conhecimento da estrutura. O remédio é **tell, don\'t ask** — mover o comportamento para quem tem os dados —, sem cair no *Middle Man*.',
      '**LCOM4** conta os componentes do grafo "métodos que compartilham atributos": 1 é coeso; 2 ou mais sugere *Extract Class*.',
    ],
    glossary: [
      { term: 'Coesão', aliases: ['cohesion', 'coesao', 'coeso', 'coesa'], definition: 'O quanto os elementos de um módulo (funções, métodos, dados) **pertencem juntos** e servem a um único propósito. A melhor é a coesão funcional; a pior, a coincidental (o clássico `utils.py`).' },
      { term: 'Connascence', aliases: ['conascência', 'conascencia', 'connascent', 'connascentes'], definition: 'Conceito de Meilir Page-Jones (1992): dois elementos são connascentes quando mudar um **obriga** a mudar o outro para o sistema continuar correto. Classifica o acoplamento por tipo (nome, posição, algoritmo…), força, localidade e grau.' },
      { term: 'Lei de Demeter', aliases: ['Law of Demeter', 'LoD', 'princípio do menor conhecimento', 'principio do menor conhecimento', 'lei de demeter'], definition: 'Um método só deveria conversar com seus **amigos imediatos**: o próprio objeto, seus parâmetros, objetos que ele cria e os atributos diretos. Evita que o código dependa da estrutura interna de objetos distantes.' },
      { term: 'Train wreck', aliases: ['train wrecks', 'trem descarrilado', 'message chain', 'message chains', 'cadeia de mensagens'], definition: 'Cadeia de navegação como `pedido.cliente.endereco.cidade.nome`: o chamador passa a conhecer (e depender de) cada elo da estrutura. Violação típica da Lei de Demeter.' },
      { term: "Tell, Don't Ask", aliases: ['tell dont ask', 'diga, não pergunte', 'diga nao pergunte'], definition: 'Em vez de **perguntar** o estado de um objeto e decidir fora dele, **diga** o que ele deve fazer — a regra fica junto dos dados. Ex.: `conta.sacar(valor)` em vez de checar e alterar `conta.saldo` de fora.' },
      { term: 'LCOM', aliases: ['LCOM4', 'Lack of Cohesion of Methods', 'falta de coesão dos métodos', 'falta de coesao dos metodos'], definition: '*Lack of Cohesion of Methods*. Na variante **LCOM4** (Hitz e Montazeri, 1995), é o número de componentes conexos do grafo em que métodos se ligam quando usam o mesmo atributo ou chamam um ao outro. 1 = coesa; 2+ = candidata a *Extract Class*.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à unidade de design! Até aqui olhamos para dentro das funções. Agora vamos olhar **entre** elas.',
          'O mantra você já ouviu: "coesão alta, acoplamento baixo". Hoje vamos dar a ele um vocabulário preciso.',
        ],
        board: {
          title: 'Acoplamento × coesão',
          md: `- **Coesão**: o quanto o que está **dentro** de um módulo pertence junto.
- **Acoplamento**: o quanto um módulo **depende** do que está fora dele.

Os termos vêm de Larry Constantine e Ed Yourdon (*Structured Design*, 1979), que também classificaram os tipos — do pior para o melhor:

| Coesão | Sintoma em Python |
|---|---|
| **Coincidental** | \`utils.py\` com \`formatar_cpf\`, \`enviar_email\` e \`calcular_frete\` |
| **Lógica** | \`processar(dados, tipo)\` que faz coisas diferentes conforme a flag |
| **Temporal** | \`inicializar()\` que abre log, conecta ao banco e aquece cache só porque "acontece no começo" |
| **Procedural / comunicacional** | passos em sequência, ou que operam sobre os mesmos dados |
| **Sequencial** | a saída de uma etapa é a entrada da próxima |
| **Funcional** | tudo contribui para **uma** tarefa bem definida (\`calcular_imposto\`) |

| Acoplamento | Exemplo |
|---|---|
| **De conteúdo** | \`conta._saldo = 0\` — mexer nas entranhas do outro |
| **Comum** | módulos que leem e escrevem o mesmo estado global |
| **De controle** | \`gerar(relatorio, modo="resumido")\` — o chamador dita o fluxo interno |
| **De carimbo** (*stamp*) | passar o \`pedido\` inteiro quando só o \`cep\` é usado |
| **De dados** | passar só os dados necessários, como parâmetros simples |

> [!dica] As métricas de acoplamento **entre pacotes** (Ca, Ce, instabilidade) estão na trilha de Arquitetura. Aqui o foco é o nível do código: funções, classes e módulos.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          '"Acoplamento baixo" é vago: acoplado **como**? Quanto? Existe um conceito que responde isso — e quase ninguém conhece.',
          'Chama-se **connascence**: dois elementos são connascentes quando mudar um **obriga** a mudar o outro.',
        ],
        board: {
          title: 'Connascence: os tipos',
          md: `**Estáticas** — dá para ver lendo o código:

| Tipo | O que precisa concordar | Exemplo |
|---|---|---|
| **Nome** | nomes | renomear \`pedido.total()\` quebra todos os chamadores |
| **Tipo** | tipos | a função espera \`Decimal\`, o chamador passa \`float\` |
| **Significado** (convenção) | o sentido de um valor | \`status == 2\` quer dizer "cancelado" em três módulos |
| **Posição** | a ordem | \`criar_usuario("Ana", "ana@x.com", True, False)\`; tupla \`(lat, lon)\` × \`(lon, lat)\` |
| **Algoritmo** | o mesmo algoritmo dos dois lados | o front e o back calculam o mesmo dígito verificador; \`encode\`/\`decode\` |

**Dinâmicas** — só aparecem em execução:

| Tipo | O que precisa concordar | Exemplo |
|---|---|---|
| **Execução** (ordem) | a ordem das chamadas | \`conexao.abrir()\` antes de \`conexao.enviar()\` |
| **Tempo** | *quando* as coisas acontecem | teste que depende de \`sleep(0.1)\`; timeout de 2 s × latência de 3 s |
| **Valor** | valores que mudam juntos | percentuais que precisam somar 100; o mesmo default copiado em dois lugares |
| **Identidade** | o **mesmo** objeto | dois componentes precisam compartilhar a mesma instância de sessão ou lock |

> [!sabia] O termo foi criado por **Meilir Page-Jones** em 1992 (do latim *con* + *nascere*, "nascidos juntos") e ficou esquecido por anos, até **Jim Weirich** — autor do Rake — resgatá-lo na palestra *The Grand Unified Theory of Software Design*. A ideia central: acoplamento não é "tem ou não tem"; é uma **escala**, e dá para refatorar de uma forma forte para uma mais fraca.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Connascence não se elimina: um sistema sem nenhuma seria um monte de peças que não conversam.',
          'O jogo é outro: enfraquecer a connascence que cruza fronteiras, e deixar a forte bem **perto**.',
        ],
        board: {
          title: 'Força, localidade e grau',
          md: `\`\`\`text
 mais fraca                                                                  mais forte
 Nome < Tipo < Significado < Posição < Algoritmo < Execução < Tempo < Valor < Identidade
 \\______________ estáticas _______________/     \\______________ dinâmicas ______________/
\`\`\`

- **Força**: quanto custa descobrir e fazer a mudança. Nome se resolve com um *rename* da IDE; tempo e identidade só aparecem em produção.
- **Localidade**: connascence forte entre duas linhas da **mesma função** é aceitável; entre dois **serviços**, é um desastre.
- **Grau**: quantos elementos são afetados — 2 chamadores ou 200?

Regras de Page-Jones: minimize a connascence que **cruza** fronteiras de encapsulamento e concentre a forte **dentro** delas.

**Refatorando para formas mais fracas**

\`\`\`python
# Posição -> Nome: argumentos keyword-only
def criar_usuario(nome, email, *, admin=False, ativo=True): ...
criar_usuario("Ana", "ana@x.com", admin=True, ativo=False)

# Significado -> Nome: o número mágico vira um Enum
class Status(Enum):
    PAGO = 1
    CANCELADO = 2

if pedido.status is Status.CANCELADO: ...

# Algoritmo -> Nome: uma única implementação, compartilhada
def digito_verificador(numero: str) -> int: ...

# Execução -> Tipo: impossível enviar sem ter aberto
with Conexao.abrir(url) as conexao:
    conexao.enviar(dados)
\`\`\`

> [!atencao] Uma \`dataclass\` com campos nomeados no lugar de uma tupla \`(lat, lon)\` é o mesmo movimento: a posição deixa de importar e o nome passa a carregar o significado.`,
        },
      },
      {
        type: 'say',
        text: [
          'Você já conhece a regra dos "amigos imediatos" da Lei de Demeter. Vamos além do básico.',
          'Um *train wreck* nada mais é do que connascence de nome com **cada** elo da cadeia — e com grau alto.',
        ],
        board: {
          title: 'Demeter além de "contar pontos"',
          md: `\`\`\`python
# o relatório agora conhece Pedido, Cliente, Endereco e Cidade
nome = pedido.cliente.endereco.cidade.nome
\`\`\`

Se \`Cliente\` passar a ter vários endereços, **todo** código que navega essa cadeia quebra. Mas atenção ao que **não** é violação:

| Não é problema | Por quê |
|---|---|
| \`texto.strip().lower().split()\` | cada chamada devolve um **valor** novo; ninguém navega estrutura |
| \`Query().filtrar(...).ordenar(...).limitar(10)\` | interface **fluente**: o mesmo objeto, de propósito |
| \`resposta["cliente"]["endereco"]["cep"]\` num JSON | **estrutura de dados** existe para ser navegada |

> [!dica] Robert C. Martin separa **objetos** (escondem dados, expõem comportamento) de **estruturas de dados** (expõem dados, não têm comportamento). Demeter vale para objetos. O pior caso é o **híbrido**: metade objeto, metade struct com getters para tudo.

**O remédio — e o seu excesso**

- **Hide Delegate** (Fowler): \`pedido.cidade_de_entrega()\` esconde o caminho.
- Exagerou? Se \`Pedido\` vira uma lista de \`cliente_nome()\`, \`cliente_email()\`, \`cliente_cep()\`… é o cheiro **Middle Man** — e a refatoração oposta, *Remove Middle Man*, existe no mesmo catálogo.
- O equilíbrio costuma vir do próximo princípio: em vez de **expor** o dado por mais um método, **mova o comportamento** que precisava dele.`,
        },
      },
      {
        type: 'say',
        text: [
          'E esse princípio tem nome: **Tell, Don\'t Ask**. Diga ao objeto o que fazer, em vez de perguntar o estado dele e decidir do lado de fora.',
          { text: 'Lembra da *Feature Envy*? É exatamente o sintoma de quem vive perguntando.', mood: 'thinking' },
        ],
        board: {
          title: "Tell, Don't Ask",
          md: `> "Código procedural obtém informação e então toma decisões. Código orientado a objetos **manda** os objetos fazerem coisas." — Alec Sharp, *Smalltalk by Example* (1997)

\`\`\`python
# ASK: a regra do saque mora fora da conta (e é copiada em cada chamador)
if conta.saldo + conta.limite >= valor and not conta.bloqueada:
    conta.saldo -= valor
else:
    raise SaldoInsuficiente()
\`\`\`

\`\`\`python
# TELL: a conta protege a própria invariante
class Conta:
    def sacar(self, valor):
        if self.bloqueada or valor > self.saldo + self.limite:
            raise SaldoInsuficiente()
        self.saldo -= valor

conta.sacar(valor)
\`\`\`

- A regra existe em **um** lugar; ninguém consegue deixar o saldo inconsistente "por fora".
- Combina com **Command-Query Separation**: \`sacar\` é comando (muda estado); \`saldo_disponivel()\` é consulta (não muda nada).
- **Perguntar não é pecado**: telas, relatórios e serialização precisam ler dados. O problema é perguntar **para decidir** algo que o objeto poderia decidir sozinho.

> [!sabia] O nome foi popularizado por **Andy Hunt e Dave Thomas** (*The Pragmatic Programmer*). E Martin Fowler faz uma ressalva conhecida: ele não usa o princípio como dogma — prefere a regra mais geral de **manter dados e comportamento juntos** e diz que caçar todos os getters (o que ele chama de *GetterEradicator*) atrapalha mais do que ajuda.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Última ferramenta: dá para **medir** coesão de classe. A métrica se chama **LCOM** — *Lack of Cohesion of Methods*.',
          'A ideia é linda: se os métodos de uma classe formam grupos que não se tocam, você tem duas classes vestidas de uma.',
        ],
        board: {
          title: 'LCOM4: coesão como grafo',
          md: `\`\`\`python
class Relatorio:
    def total(self):              return sum(self.vendas)
    def media(self):              return self.total() / len(self.vendas)
    def adicionar(self, email):   self.destinatarios.append(email)
    def enviar(self, texto):
        for d in self.destinatarios:
            self.smtp.send(d, texto)
\`\`\`

Ligue dois métodos quando usam o **mesmo atributo** ou quando um **chama** o outro:

\`\`\`text
  total ---- media           adicionar ---- enviar
    (vendas, total())          (destinatarios)

  LCOM4 = 2 componentes  ->  Extract Class: Relatorio + Distribuicao
\`\`\`

| LCOM4 | Leitura |
|---|---|
| 0 | sem métodos (além do \`__init__\`) |
| **1** | coesa: tudo conversa com tudo, direta ou indiretamente |
| 2+ | cada componente é candidato a virar uma classe |

**Cuidados**
- **Exclua o \`__init__\`**: ele toca todos os atributos e faria qualquer classe parecer coesa.
- Método que não usa \`self\` vira um componente sozinho — talvez devesse ser uma função.
- Getters/setters triviais e \`dataclasses\` distorcem o número: é **sinal** para investigar, não veredito.

Medir com \`ast\` é direto: para cada método, colete os \`self.<nome>\` (nós \`ast.Attribute\` cujo \`value\` é \`ast.Name(id="self")\`), monte o grafo e conte componentes com uma busca em profundidade.

> [!sabia] LCOM nasceu em 1991 na famosa suíte **CK** de **Chidamber e Kemerer** (junto com WMC, DIT, NOC, CBO e RFC), mas a versão original contava *pares* de métodos e dava 0 para classes bem diferentes. Hoje existem pelo menos cinco variantes (LCOM1 a LCOM5, além da de Henderson-Sellers). A **LCOM4**, de Hitz e Montazeri (1995), é a mais intuitiva — e ferramentas diferentes podem dar números diferentes para a mesma classe.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Reconhecer connascence, desmontar train wrecks e medir coesão com ast.', icon: '🎯' },
      {
        type: 'match',
        id: 'cc-acop-q1',
        concept: 'Connascence',
        say: 'Primeiro, o vocabulário novo: que tipo de connascence aparece em cada situação?',
        prompt: 'Associe cada **situação** ao **tipo de connascence**.',
        pairs: [
          { left: 'Renomear `calcular_total()` quebra 40 chamadores', right: 'Nome' },
          { left: 'A função espera `Decimal` e um chamador passa `float`', right: 'Tipo' },
          { left: '`criar_usuario("Ana", "ana@x.com", True, False)` — trocar a ordem muda tudo', right: 'Posição' },
          { left: 'Front e back precisam calcular o mesmo dígito verificador', right: 'Algoritmo' },
          { left: '`abrir()` precisa ser chamado antes de `enviar()`', right: 'Execução' },
          { left: 'O teste só passa se a tarefa terminar antes do `sleep(0.1)`', right: 'Tempo' },
        ],
        explanation: 'Os quatro primeiros são **estáticos** — dá para achar lendo o código (e a IDE ajuda com nome e tipo). Execução e tempo são **dinâmicos**: só aparecem rodando, por isso são mais fortes e mais caros de descobrir. A escala guia a refatoração: posição vira nome com argumentos nomeados; algoritmo vira nome com uma função compartilhada; execução vira tipo com um context manager que torna a ordem obrigatória.',
      },
      {
        type: 'mcq',
        id: 'cc-acop-q2',
        concept: 'Connascence',
        say: 'Agora, na prática: como enfraquecer uma connascence que se espalhou?',
        prompt: `Esta função é chamada em **40 lugares** do sistema:

\`\`\`python
def registrar(nome, email, admin, ativo, nivel):
    ...

registrar("Ana", "ana@x.com", True, False, 3)
\`\`\`

Qual mudança **reduz** a connascence da forma mais eficaz?`,
        options: [
          { text: 'Tornar `admin`, `ativo` e `nivel` keyword-only (`*`) e trocar o `3` por um `Enum` (`Nivel.GERENTE`).', correct: true, why: 'Posição e significado — formas fortes, com grau 40 — viram connascence de **nome**, a mais fraca: trocar a ordem não quebra ninguém e o `3` ganha um sentido verificável.' },
          { text: 'Adicionar um comentário `# admin, ativo, nivel` em cada uma das 40 chamadas.', why: 'Comentário não muda a connascence: ela continua sendo de posição. Pior, agora os comentários também precisam mudar juntos quando a assinatura mudar.' },
          { text: 'Trocar os booleanos por inteiros `0`/`1`, documentando a tabela no README.', why: 'Isso **fortalece** a connascence: além da posição, cria connascence de significado (convenção) que nem o interpretador nem a IDE conseguem verificar.' },
          { text: 'Mover as 40 chamadas para o mesmo módulo de `registrar`.', why: 'Aumentar a localidade ajuda quando é natural, mas aqui é impraticável e não enfraquece nada — a regra é **reduzir a força** do que cruza fronteiras, não juntar tudo num lugar só.' },
        ],
        explanation: 'Connascence tem três dimensões: **força** (posição e significado são fortes), **localidade** (40 módulos diferentes é baixa) e **grau** (40 chamadores é alto). Força alta + localidade baixa + grau alto é a pior combinação. A saída é converter para uma forma mais fraca: argumentos nomeados transformam posição em nome, e o `Enum` transforma um número mágico em nome. Em Python, `*` na assinatura torna isso **obrigatório**, não só recomendado.',
      },
      {
        type: 'mcq',
        id: 'cc-acop-q3',
        concept: "Tell, Don't Ask",
        say: 'E agora um train wreck clássico. Qual é a melhor saída?',
        prompt: `Um método de \`Checkout\` tem este trecho:

\`\`\`python
carteira = pedido.cliente.carteira
if carteira.saldo >= total:
    carteira.saldo -= total
else:
    raise SaldoInsuficiente()
\`\`\`

Qual refatoração resolve o problema de design?`,
        options: [
          { text: '`pedido.cliente.pagar(total)`, com `Cliente` delegando para `Carteira.debitar(total)`, que verifica o saldo e lança a exceção.', correct: true, why: '**Tell, don\'t ask**: a regra "só debita se houver saldo" passa a morar junto do dado que ela protege. O `Checkout` não conhece mais a carteira nem o saldo — e ninguém consegue deixar a carteira negativa por fora.' },
          { text: 'Criar `pedido.get_saldo_do_cliente()` e `pedido.set_saldo_do_cliente(valor)` para usar um ponto só.', why: 'Respeita a **letra** da lei e ignora o espírito: o `Checkout` continua perguntando e decidindo, e `Pedido` vira um *Middle Man* de getters e setters.' },
          { text: 'Nada a mudar: a primeira linha guarda a carteira numa variável, então não há mais cadeia de chamadas.', why: 'Quebrar a cadeia em variáveis é cosmético. O conhecimento da estrutura (`pedido` → `cliente` → `carteira` → `saldo`) continua todo aqui.' },
          { text: 'Converter os objetos para dicionários: `pedido["cliente"]["carteira"]["saldo"]`.', why: 'O acoplamento com a estrutura é idêntico — e agora sem tipos. Estruturas de dados podem ser navegadas, mas aqui existe uma **regra de negócio** que merece morar num objeto.' },
        ],
        explanation: 'O problema não são os pontos: é o `Checkout` **perguntar** o estado da carteira para tomar uma decisão que é dela. Isso é *Feature Envy* com um *train wreck* na frente. A saída é mover o comportamento (`debitar`) para onde estão os dados e deixar cada objeto conversar só com o vizinho: `Checkout` → `Cliente` → `Carteira`. Getters extras só trocam o *train wreck* por um *Middle Man*.',
      },
      {
        type: 'code',
        id: 'cc-acop-q4',
        concept: 'Lei de Demeter',
        title: 'Desmontando os train wrecks do checkout',
        points: 60,
        say: 'Agora com código de verdade! O checkout funciona — mas cada função atravessa a estrutura inteira.',
        prompt: `As funções \`frete\`, \`pagar\` e \`etiqueta\` navegam \`pedido.cliente.endereco...\` e \`pedido.cliente.carteira.saldo\`, e \`pagar\` **pergunta** o saldo para decidir fora da carteira. Refatore **sem mudar nenhum resultado** (valores, mensagens, \`pago\` e saldos):

1. **Tell, don't ask** — \`Carteira.debitar(valor)\`: a carteira decide. Sem saldo → \`ValueError("saldo insuficiente")\`, e o saldo não muda. (Debitar **exatamente** o saldo é permitido.)
2. **Hide Delegate / Move Function** — \`Pedido\` ganha \`frete()\`, \`pagar()\` e \`etiqueta()\`, falando só com amigos imediatos: **nenhum método de \`Pedido\`** pode mencionar \`endereco\`, \`carteira\` ou \`saldo\`. Crie em \`Cliente\` e \`Endereco\` os métodos de que precisar.
3. \`Cliente\` também não mexe em \`saldo\`: ele **pede** à carteira.
4. As funções antigas \`frete(pedido)\`, \`pagar(pedido)\` e \`etiqueta(pedido)\` continuam existindo (há chamadores legados), mas só **delegam** ao pedido — sem tocar em \`cliente\`.

Os testes criam os objetos assim: \`Pedido(Cliente(nome, Endereco(cidade, uf), Carteira(saldo)), total)\`.`,
        starter: CHECKOUT_TREM,
        tests: [
          {
            name: 'Carteira.debitar: a carteira decide',
            code: py(`
              c = Carteira(100.0)
              c.debitar(30.0)
              assert c.saldo == 70.0, c.saldo
              c.debitar(70.0)
              assert c.saldo == 0.0, "debitar exatamente o saldo é permitido"
              try:
                  c.debitar(0.01)
              except ValueError as e:
                  assert "saldo insuficiente" in str(e), str(e)
              else:
                  raise AssertionError("sem saldo, debitar deveria lançar ValueError")
              assert c.saldo == 0.0, "um débito recusado não pode mudar o saldo"
            `),
          },
          {
            name: 'Pedido.frete() e Pedido.etiqueta()',
            code: demeterHelper + py(`
              assert _pedido(uf="SP").frete() == 10.0
              assert _pedido(uf="RJ").frete() == 25.0
              assert _pedido(nome="Bia", cidade="Niterói", uf="RJ").etiqueta() == "Bia - Niterói/RJ"
            `),
          },
          {
            name: 'Pedido.pagar(): debita total + frete e marca como pago',
            code: demeterHelper + py(`
              p = _pedido(uf="RJ", saldo=200.0, total=100.0)
              assert p.pagar() == 125.0
              assert p.pago is True
              assert p.cliente.carteira.saldo == 75.0
              sem_saldo = _pedido(uf="SP", saldo=50.0, total=100.0)
              try:
                  sem_saldo.pagar()
              except ValueError:
                  pass
              else:
                  raise AssertionError("sem saldo, pagar() deveria lançar ValueError")
              assert sem_saldo.pago is False and sem_saldo.cliente.carteira.saldo == 50.0
            `),
          },
          {
            name: 'as funções antigas continuam funcionando',
            code: demeterHelper + py(`
              p = _pedido(uf="SP", saldo=500.0, total=100.0, nome="Caio", cidade="Santos")
              assert frete(p) == 10.0
              assert etiqueta(p) == "Caio - Santos/SP"
              assert pagar(p) == 110.0 and p.pago and p.cliente.carteira.saldo == 390.0
            `),
          },
          {
            name: 'Lei de Demeter: ninguém atravessa a estrutura',
            hidden: true,
            code: py(`
              import types

              def _nomes(alvo):
                  funcoes = []
                  membros = vars(alvo).values() if isinstance(alvo, type) else [alvo]
                  for membro in membros:
                      if isinstance(membro, (staticmethod, classmethod)):
                          membro = membro.__func__
                      elif isinstance(membro, property):
                          membro = membro.fget
                      if hasattr(membro, "__code__"):
                          funcoes.append(membro)
                  nomes, pilha = set(), [f.__code__ for f in funcoes]
                  while pilha:
                      codigo = pilha.pop()
                      nomes.update(codigo.co_names)
                      pilha.extend(c for c in codigo.co_consts if isinstance(c, types.CodeType))
                  return nomes

              proibidos = {"endereco", "carteira", "saldo"}
              assert hasattr(Carteira, "debitar"), "falta Carteira.debitar(valor)"
              invasao = _nomes(Pedido) & proibidos
              assert not invasao, f"Pedido ainda atravessa a estrutura: usa {sorted(invasao)}"
              assert "saldo" not in _nomes(Cliente), "Cliente não deve mexer no saldo: peça à carteira (tell, don't ask)"
              for funcao in (frete, pagar, etiqueta):
                  usados = _nomes(funcao) & (proibidos | {"cliente"})
                  assert not usados, f"{funcao.__name__}() deveria só delegar ao pedido, mas usa {sorted(usados)}"
            `),
          },
          {
            name: 'mesmo comportamento da versão original (caracterização)',
            hidden: true,
            code: demeterHelper + py(`
              for uf in ("SP", "RJ", "sp", "MG"):
                  for saldo in (0.0, 50.0, 110.0, 124.99, 125.0, 1000.0):
                      for total in (0.0, 100.0, 99.9):
                          p = _pedido(uf=uf, saldo=saldo, total=total, nome="Duda", cidade="Campinas")
                          esperado_frete = 10.0 if uf == "SP" else 25.0
                          assert frete(p) == esperado_frete and p.frete() == esperado_frete, (uf, frete(p))
                          assert etiqueta(p) == f"Duda - Campinas/{uf}", etiqueta(p)
                          valor = total + esperado_frete
                          if saldo < valor:
                              try:
                                  pagar(p)
                              except ValueError as e:
                                  assert str(e) == "saldo insuficiente", str(e)
                              else:
                                  raise AssertionError(f"saldo {saldo} < {valor}: deveria recusar")
                              assert p.pago is False and p.cliente.carteira.saldo == saldo
                          else:
                              assert pagar(p) == valor
                              assert p.pago is True and p.cliente.carteira.saldo == saldo - valor

              duas_vezes = _pedido(uf="SP", saldo=1000.0, total=100.0)
              duas_vezes.pagar()
              duas_vezes.pagar()
              assert duas_vezes.cliente.carteira.saldo == 780.0, "o comportamento original cobra de novo a cada pagamento"
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /\b\w+(?:\.\w+){3,}/.test(code),
            text: 'Ainda há um *train wreck* (`a.b.c.d`) no código: quem escreve essa linha depende de cada elo da cadeia. Peça ao vizinho imediato — `self.cliente.etiqueta()`, `self.endereco.formatado()` — e deixe cada objeto esconder a própria estrutura.',
            concept: 'Lei de Demeter',
          },
          {
            when: (m, code) => /\w+\.carteira\.saldo/.test(code),
            text: 'Alguém ainda **pergunta** `carteira.saldo` para decidir do lado de fora. A regra "só debita se houver saldo" pertence à `Carteira`: diga a ela o que fazer (`carteira.debitar(valor)`) — *tell, don\'t ask*.',
            concept: "Tell, Don't Ask",
          },
          {
            when: (m, code) => /def\s+get_\w+\s*\(\s*self\s*\)\s*:\s*\n\s*return\s+self\.\w+(?:\.\w+)*\s*$/m.test(code),
            text: 'Getters do tipo `get_x()` que só devolvem um atributo não escondem nada: o chamador continua perguntando e decidindo. Em vez de expor o dado, **mova o comportamento** que precisava dele (e evite transformar o `Pedido` num *Middle Man*).',
            concept: 'Middle Man',
          },
        ],
        hints: [
          'Comece pela `Carteira`: `debitar(valor)` lança `ValueError("saldo insuficiente")` se `valor > self.saldo`; senão, subtrai. Depois, em `Cliente`, crie `pagar(valor)` (que chama `self.carteira.debitar(valor)`), `etiqueta()` e algo como `mora_em(uf)`. Em `Endereco`, um `formatado()` que devolve `"Cidade/UF"`.',
          '`Pedido` só conversa com `self.cliente`: `frete()` usa `self.cliente.mora_em("SP")`; `etiqueta()` devolve `self.cliente.etiqueta()`; `pagar()` calcula `self.total + self.frete()`, chama `self.cliente.pagar(valor)`, marca `self.pago = True` e devolve o valor.',
          'As funções antigas viram uma linha cada: `return pedido.frete()`, `return pedido.pagar()`, `return pedido.etiqueta()`. Mantenha a mesma mensagem de erro e a mesma comparação (`valor > saldo` recusa; igual passa) para o comportamento não mudar.',
        ],
        solution: py(`
          FRETE_SP = 10.0
          FRETE_OUTROS_ESTADOS = 25.0


          class Endereco:
              def __init__(self, cidade, uf):
                  self.cidade = cidade
                  self.uf = uf

              def formatado(self):
                  return f"{self.cidade}/{self.uf}"


          class Carteira:
              def __init__(self, saldo):
                  self.saldo = saldo

              def debitar(self, valor):
                  if valor > self.saldo:
                      raise ValueError("saldo insuficiente")
                  self.saldo -= valor


          class Cliente:
              def __init__(self, nome, endereco, carteira):
                  self.nome = nome
                  self.endereco = endereco
                  self.carteira = carteira

              def mora_em(self, uf):
                  return self.endereco.uf == uf

              def pagar(self, valor):
                  self.carteira.debitar(valor)

              def etiqueta(self):
                  return f"{self.nome} - {self.endereco.formatado()}"


          class Pedido:
              def __init__(self, cliente, total):
                  self.cliente = cliente
                  self.total = total
                  self.pago = False

              def frete(self):
                  return FRETE_SP if self.cliente.mora_em("SP") else FRETE_OUTROS_ESTADOS

              def pagar(self):
                  valor = self.total + self.frete()
                  self.cliente.pagar(valor)
                  self.pago = True
                  return valor

              def etiqueta(self):
                  return self.cliente.etiqueta()


          # API antiga: mantida para os chamadores legados, só delega.
          def frete(pedido):
              return pedido.frete()


          def pagar(pedido):
              return pedido.pagar()


          def etiqueta(pedido):
              return pedido.etiqueta()
        `),
        solutionExplanation: 'Cada objeto passou a conversar só com o vizinho: `Pedido` → `Cliente` → `Carteira`/`Endereco`. A regra de saldo foi para dentro da `Carteira` (*tell, don\'t ask*), então ninguém mais consegue debitar "por fora" — antes, qualquer função podia fazer `carteira.saldo -= x`. `Pedido` não sabe que existe endereço nem carteira: se amanhã o cliente tiver vários endereços ou pagar com cartão, só `Cliente` muda. Repare no equilíbrio com o *Middle Man*: em vez de criar `pedido.uf_do_cliente()` e `pedido.saldo_do_cliente()`, os métodos novos carregam **comportamento** (`mora_em`, `pagar`, `etiqueta`). E as funções antigas continuam existindo como fachada fina para os chamadores legados — o primeiro passo de um *parallel change*: dá para migrá-los aos poucos e apagar as funções depois.',
      },
      {
        type: 'code',
        id: 'cc-acop-q5',
        concept: 'LCOM',
        title: 'Medindo coesão com LCOM4',
        points: 60,
        say: 'Agora, a ferramenta de medição: vamos calcular LCOM4 percorrendo a árvore sintática.',
        prompt: `Escreva \`lcom4(codigo)\`: recebe o **texto** de um programa Python e devolve \`{nome_da_classe: LCOM4}\` para **cada classe** do código.

**Como calcular** (por classe):
- os nós do grafo são os **métodos** definidos diretamente no corpo da classe (\`def\` e \`async def\`), **exceto \`__init__\`**;
- dois métodos estão **ligados** se ambos acessam o mesmo \`self.<nome>\` **ou** se um deles acessa \`self.<outro_metodo>\` (uma chamada como \`self.total()\` conta);
- LCOM4 = número de **componentes conexos** (a ligação é transitiva: se A–B e B–C, os três formam um componente só);
- método que não usa \`self\` (ex.: \`@staticmethod\`) é um componente sozinho;
- classe sem métodos (além do \`__init__\`) → **0**.

"Acessar \`self.x\`" é qualquer nó \`ast.Attribute\` cujo \`value\` é \`ast.Name(id="self")\` — leitura, escrita, chamada ou dentro de \`self.x.y\`.`,
        starter: LCOM_INICIAL,
        tests: [
          {
            name: 'classe coesa: LCOM4 = 1',
            code: py(`
              CODIGO = '''
              class Conta:
                  def __init__(self, saldo):
                      self.saldo = saldo
                      self.extrato = []

                  def depositar(self, valor):
                      self.saldo += valor
                      self.extrato.append(valor)

                  def sacar(self, valor):
                      self.saldo -= valor
                      self.extrato.append(-valor)

                  def resumo(self):
                      return f"{len(self.extrato)} movimentações"
              '''
              assert lcom4(CODIGO) == {"Conta": 1}, lcom4(CODIGO)
            `),
          },
          {
            name: 'duas responsabilidades: LCOM4 = 2',
            code: py(`
              CODIGO = '''
              class Relatorio:
                  def __init__(self, vendas, smtp):
                      self.vendas = vendas
                      self.smtp = smtp
                      self.destinatarios = []

                  def total(self):
                      return sum(self.vendas)

                  def media(self):
                      return self.total() / len(self.vendas)

                  def adicionar_destinatario(self, email):
                      self.destinatarios.append(email)

                  def enviar(self, texto):
                      for d in self.destinatarios:
                          self.smtp.send(d, texto)
              '''
              assert lcom4(CODIGO) == {"Relatorio": 2}, lcom4(CODIGO)
            `),
          },
          {
            name: 'chamar outro método liga; não usar self isola',
            code: py(`
              CODIGO = '''
              class Pedido:
                  def total(self):
                      return sum(i.preco for i in self.itens)

                  def total_com_frete(self):
                      return self.total() + 10

                  def formatar_moeda(self, valor):
                      return f"{valor:.2f} reais"
              '''
              assert lcom4(CODIGO) == {"Pedido": 2}, lcom4(CODIGO)
            `),
          },
          {
            name: 'a ligação é transitiva',
            code: py(`
              CODIGO = '''
              class Cadeia:
                  def a(self):
                      return self.x

                  def b(self):
                      return self.x + self.y

                  def c(self):
                      self.y = 0
              '''
              assert lcom4(CODIGO) == {"Cadeia": 1}, "a e c não compartilham nada, mas estão ligados através de b"
            `),
          },
          {
            name: 'classes sem métodos e várias classes',
            code: py(`
              CODIGO = '''
              class Ponto:
                  def __init__(self, x, y):
                      self.x, self.y = x, y

              class Vazia:
                  pass
              '''
              assert lcom4(CODIGO) == {"Ponto": 0, "Vazia": 0}, lcom4(CODIGO)
            `),
          },
          {
            name: 'serviço com async, property e staticmethod',
            hidden: true,
            code: py(`
              CODIGO = '''
              class Servico:
                  def __init__(self, repo, cache, smtp):
                      self.repo = repo
                      self.cache = cache
                      self.smtp = smtp

                  @property
                  def conectado(self):
                      return self.repo.ping()

                  async def buscar(self, chave):
                      if chave in self.cache:
                          return self.cache[chave]
                      valor = await self.repo.buscar(chave)
                      self.cache[chave] = valor
                      return valor

                  def limpar_cache(self):
                      self.cache.clear()

                  def notificar(self, email, texto):
                      self.smtp.enviar(email, self._assinar(texto))

                  def _assinar(self, texto):
                      return texto + " -- Equipe"

                  @staticmethod
                  def validar_email(email):
                      return "@" in email

              class Contador:
                  def incrementar(self):
                      self.n += 1

                  def zerar(self):
                      self.n = 0
              '''
              esperado = {"Servico": 3, "Contador": 1}
              obtido = lcom4(CODIGO)
              assert obtido == esperado, f"esperado {esperado}, obtido {obtido}"
            `),
          },
        ],
        reviews: [
          {
            when: m => !m.imports.includes('ast'),
            text: 'Procurar `self.` com regex no texto confunde strings, comentários e `self.x.y`. Use `ast.parse` e olhe os nós `ast.Attribute` cujo `value` é `ast.Name(id="self")`.',
            concept: 'Módulo ast',
          },
          {
            when: m => m.maxComplexity > 8,
            text: 'Alguma função do seu medidor passou de complexidade 8. Separe as etapas, cada uma com um nome: coletar os `self.<nome>` de um método, montar o grafo e contar componentes. É a coesão funcional aplicada ao próprio medidor de coesão.',
            concept: 'Coesão',
          },
          {
            when: m => m.maxNesting >= 4,
            text: 'O código ficou com 4 ou mais níveis de aninhamento. Extraia a busca de componentes (DFS com pilha) para uma função própria e use `itertools.combinations` para comparar os pares de métodos sem dois `for` aninhados.',
            concept: 'Complexidade cognitiva',
          },
        ],
        hints: [
          'Para cada método (`ast.FunctionDef`/`ast.AsyncFunctionDef` em `classe.body`, exceto `__init__`), colete o conjunto de nomes acessados via self: `{no.attr for no in ast.walk(metodo) if isinstance(no, ast.Attribute) and isinstance(no.value, ast.Name) and no.value.id == "self"}`.',
          'Dois métodos `a` e `b` estão ligados se `a in usos[b]`, `b in usos[a]` ou `usos[a] & usos[b]` não for vazio. Monte um dicionário de vizinhos percorrendo `itertools.combinations(usos, 2)`.',
          'Para contar componentes: para cada método ainda não visitado, some 1 e faça uma busca em profundidade com uma pilha, marcando os vizinhos alcançáveis. Classe sem métodos dá 0 naturalmente (o laço não roda).',
        ],
        solution: py(`
          import ast
          from itertools import combinations

          METODOS = (ast.FunctionDef, ast.AsyncFunctionDef)


          def _usos_de_self(metodo):
              """Nomes acessados como self.<nome> (atributos e métodos)."""
              return {
                  no.attr
                  for no in ast.walk(metodo)
                  if isinstance(no, ast.Attribute) and isinstance(no.value, ast.Name) and no.value.id == "self"
              }


          def _metodos(classe):
              return [no for no in classe.body if isinstance(no, METODOS) and no.name != "__init__"]


          def _componentes(vizinhos):
              visitados, componentes = set(), 0
              for inicio in vizinhos:
                  if inicio in visitados:
                      continue
                  componentes += 1
                  pendentes = [inicio]
                  while pendentes:
                      atual = pendentes.pop()
                      visitados.add(atual)
                      pendentes.extend(vizinhos[atual] - visitados)
              return componentes


          def _lcom4_da_classe(classe):
              usos = {metodo.name: _usos_de_self(metodo) for metodo in _metodos(classe)}
              vizinhos = {nome: set() for nome in usos}
              for a, b in combinations(usos, 2):
                  if a in usos[b] or b in usos[a] or usos[a] & usos[b]:
                      vizinhos[a].add(b)
                      vizinhos[b].add(a)
              return _componentes(vizinhos)


          def lcom4(codigo):
              return {
                  no.name: _lcom4_da_classe(no)
                  for no in ast.walk(ast.parse(codigo))
                  if isinstance(no, ast.ClassDef)
              }
        `),
        solutionExplanation: 'O cálculo tem três etapas, cada uma numa função: `_usos_de_self` coleta os `self.<nome>` de um método (atributos **e** métodos, porque `self.total()` também é um `ast.Attribute`); `_lcom4_da_classe` monta o grafo ligando pares que compartilham um nome ou em que um referencia o outro; `_componentes` conta os componentes com uma busca em profundidade iterativa. Excluir o `__init__` é essencial: ele toca todos os atributos e faria qualquer classe parecer coesa. No teste oculto, `Servico` dá 3: {conectado, buscar, limpar_cache} giram em torno de repositório e cache; {notificar, _assinar} cuidam de e-mail; e `validar_email` nem usa `self`. É um diagnóstico concreto: extrair um `Notificador` e transformar a validação numa função.',
      },
      {
        type: 'open',
        id: 'cc-acop-q6',
        concept: 'Lei de Demeter',
        say: 'Para fechar, uma discussão que aparece em todo code review.',
        prompt: 'Um colega bloqueou seu PR dizendo: "a Lei de Demeter proíbe mais de um ponto por linha". Seu PR tem `nome.strip().lower()`, `resposta_json["cliente"]["endereco"]["cep"]` e `pedido.cliente.carteira.debitar(total)`. Como você explicaria o que a lei realmente diz, o que de fato é problema aqui e como corrigir?',
        minWords: 40,
        rubric: [
          { label: 'A lei é sobre **conhecer a estrutura** de objetos distantes (amigos imediatos), não sobre pontos', keywords: ['amigo', 'imediat', 'estrutura', 'estranho', 'conhec', 'navega', 'atravess', 'intern', 'acoplamento', 'acoplad', 'connascence', 'vizinho'], concept: 'Lei de Demeter', why: 'O problema de um *train wreck* é o chamador depender de cada elo da cadeia — mudou um objeto no meio, quebrou quem navegava.' },
          { label: 'Encadear chamadas sobre **valores/mesmo tipo** (strings, interfaces fluentes, builders) é ok', keywords: ['fluent', 'fluente', 'builder', 'mesmo tipo', 'mesmo objeto', 'strip', 'lower', 'string', 'str ', 'pandas', 'queryset', 'imutav', 'value object', 'novo valor', 'nova string'], concept: 'Lei de Demeter', why: '`strip().lower()` devolve valores novos: ninguém navega a estrutura de outro objeto.' },
          { label: '**Estruturas de dados** (JSON, dict, DTO) existem para ser navegadas', keywords: ['estrutura de dados', 'estruturas de dados', 'dto', 'dict', 'json', 'dataclass', 'dados puros', 'namedtuple', 'registro'], concept: 'Objetos × estruturas de dados', why: 'Demeter se aplica a objetos que escondem comportamento; um JSON não tem comportamento a esconder.' },
          { label: 'O problema real é o terceiro: corrigir com **tell, don\'t ask** / delegação, sem virar Middle Man', keywords: ['tell', 'dont ask', 'pedir ao', 'delega', 'hide delegate', 'middle man', 'intermediario', 'mover', 'cliente.pagar', 'pedido.pagar', 'debitar'], concept: "Tell, Don't Ask", why: '`pedido.cliente.carteira.debitar(total)` conhece três objetos; `pedido.pagar()` (ou `cliente.pagar(total)`) deixa cada um conversar só com o vizinho.' },
        ],
        modelAnswer: `A Lei de Demeter não fala de pontos: ela diz que um método só deveria conversar com seus **amigos imediatos** — o próprio objeto, os parâmetros, os objetos que cria e os atributos diretos. O que ela combate é o código que **conhece a estrutura** de objetos distantes e passa a depender de cada elo da cadeia.

Por isso \`nome.strip().lower()\` não é problema: cada chamada devolve uma **nova string** (valor do mesmo tipo), como numa interface fluente ou num builder — ninguém está navegando a estrutura de outro objeto.

\`resposta_json["cliente"]["endereco"]["cep"]\` também não: é uma **estrutura de dados** (um dict vindo de JSON), feita para ser navegada; não há comportamento escondido ali.

O problema real é \`pedido.cliente.carteira.debitar(total)\`: meu código conhece pedido, cliente **e** carteira. Se o cliente passar a pagar com cartão, ele quebra. Eu corrigiria com **tell, don't ask**: \`pedido.pagar()\` delega a \`cliente.pagar(total)\`, que delega à carteira. Cuidaria só para não criar um **Middle Man** cheio de getters — os métodos novos devem carregar comportamento, não só repassar dados.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora "acoplamento" deixou de ser uma palavra vaga: você sabe dizer **que tipo**, **quão forte** e **quão longe**.',
          'E ainda sabe medir coesão com LCOM4. Na próxima aula, os princípios de design — e os exageros que cometemos em nome deles.',
        ],
        board: null,
      },
    ],
  });
})();
