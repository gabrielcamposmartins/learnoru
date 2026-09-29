Game.registerModule('databases', {
  id: 'nosql',
  title: 'NoSQL e motores de armazenamento',
  kind: 'lesson',
  level: 2,
  order: 30,
  unit: 'escala',
  summary: 'Documento, chave-valor, wide-column e grafo: como modelar a partir das consultas — e o que acontece por baixo, de B-tree × LSM-tree a Bloom filters.',
  concepts: ['Modelos NoSQL', 'Modelagem orientada a consultas', 'LSM-tree × B-tree', 'Write amplification', 'Bloom filter'],
  takeaways: [
    'NoSQL não é um banco, são **famílias** (documento, chave-valor, wide-column, grafo) — escolha pelo **padrão de acesso**, não pela moda.',
    'Em documento, **embuta** o que é lido junto e tem tamanho limitado; **referencie** o que cresce sem limite ou é compartilhado.',
    'Em wide-column você modela **uma tabela por consulta** (query-first) e aceita gravar o mesmo dado em várias tabelas.',
    '**B-tree** atualiza páginas no lugar (ótima para ler); **LSM-tree** só anexa e compacta depois (ótima para escrever), pagando com **write amplification**.',
    'Um **Bloom filter** responde "com certeza não está" ou "talvez esteja": nunca dá falso negativo, e o falso positivo cai com mais bits por item.',
  ],
  glossary: [
    { term: 'LSM-tree', aliases: ['LSM', 'LSM-trees', 'log-structured merge-tree', 'árvore LSM'], definition: '*Log-Structured Merge-tree*: acumula escritas numa **memtable** em memória e as despeja em arquivos ordenados e imutáveis (SSTables), fundidos depois pela compactação. Otimizada para escrita (Cassandra, RocksDB).' },
    { term: 'SSTable', aliases: ['SSTables', 'Sorted String Table'], definition: '*Sorted String Table*: arquivo imutável de pares chave-valor **ordenados por chave**, gerado quando a memtable de uma LSM-tree é despejada no disco. Costuma ter um índice esparso e um Bloom filter próprios.' },
    { term: 'Compactação', aliases: ['compaction', 'compactações'], definition: 'Processo em segundo plano de uma LSM-tree que **funde SSTables**, mantém só a versão mais nova de cada chave e descarta dados apagados (tombstones). Estratégias comuns: *size-tiered* e *leveled*.' },
    { term: 'Write amplification', aliases: ['amplificação de escrita'], definition: 'Razão entre os bytes que o banco **realmente grava** no disco e os bytes que a aplicação pediu para gravar. Vem do WAL, de regravar páginas inteiras (B-tree) ou de reescrever dados a cada compactação (LSM).' },
    { term: 'Bloom filter', aliases: ['Bloom filters', 'filtro de Bloom', 'filtros de Bloom'], definition: 'Estrutura probabilística (um vetor de *m* bits e *k* hashes) que responde "**com certeza não está**" ou "**talvez esteja**". Não tem falso negativo; a taxa de falso positivo cai com mais bits por item.' },
    { term: 'Wide-column', aliases: ['wide column', 'banco wide-column', 'column family', 'família de colunas'], definition: 'Modelo NoSQL (Cassandra, HBase, Bigtable) em que as linhas são agrupadas por uma **chave de partição** e ordenadas dentro dela por uma **chave de clustering**. Consultas eficientes informam a partição.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Bem-vindo(a) à unidade de **escala**! Vamos começar pelo famoso **NoSQL** — que hoje se lê *"not only SQL"*.',
        'NoSQL não é **um** banco: são famílias com modelos de dados bem diferentes. Cada uma brilha num **padrão de acesso** e sofre em outros.',
      ],
      board: {
        title: 'As quatro famílias NoSQL',
        md: `| Família | Unidade de dado | Brilha em | Sofre em | Exemplos |
|---|---|---|---|---|
| **Documento** | documento JSON aninhado | ler/gravar um agregado inteiro de uma vez | JOINs e relações N:N | MongoDB, Couchbase, Firestore |
| **Chave-valor** | valor opaco, acessado pela chave | \`GET\`/\`PUT\` por chave: cache, sessão, TTL | qualquer busca que não seja pela chave | Redis, DynamoDB, etcd |
| **Wide-column** | linhas agrupadas por partição e ordenadas dentro dela | escrita massiva, séries temporais | consultas que não informam a partição | Cassandra, ScyllaDB, HBase |
| **Grafo** | nós e arestas com propriedades | travessias: amigos de amigos, caminhos | agregar a base inteira, particionar | Neo4j, Amazon Neptune |

> [!atencao] **Wide-column não é banco colunar analítico.** O Cassandra guarda *linhas* agrupadas por partição; já ClickHouse, Redshift e o formato Parquet guardam **cada coluna separada** no disco para agregar bilhões de linhas (OLAP). Nomes parecidos, problemas opostos.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'No modelo de **documento**, a grande decisão de modelagem é: **embutir** ou **referenciar**?',
        'A regra de ouro: o que é **lido junto** fica junto. Mas o que cresce **sem limite** precisa morar em outro lugar.',
      ],
      board: {
        title: 'Documento: embutir × referenciar',
        md: `\`\`\`json
{
  "_id": "pedido-1042",
  "cliente": { "id": "c-7", "nome": "Ana" },
  "itens": [
    { "sku": "LIV-01", "qtd": 2, "preco": 39.9 },
    { "sku": "CAF-10", "qtd": 1, "preco": 24.5 }
  ],
  "status": "pago"
}
\`\`\`

| Embutir quando… | Referenciar quando… |
|---|---|
| é lido **sempre junto** do pai (itens do pedido) | cresce **sem limite** (comentários de um post viral) |
| é **pequeno e limitado** | é **compartilhado** por muitos (o cadastro do produto) |
| muda **junto** com o pai (atomicidade no documento) | muda **sozinho** e com frequência |

> [!dica] O pedido guarda uma **cópia** do nome do cliente e do preço: é o valor *no momento da compra*. Essa desnormalização é intencional — o preço de hoje não deve alterar um pedido antigo.`,
        caption: 'No MongoDB, um documento tem no máximo **16 MB**: um array que só cresce um dia estoura — e bem antes disso já deixa cada leitura e escrita mais cara.',
      },
    },
    {
      type: 'say',
      text: [
        'Em **chave-valor** e **wide-column** o jogo muda: você não modela as entidades, modela as **consultas**.',
        'No Cassandra, toda consulta eficiente informa a **chave de partição**. Consulta nova? Muitas vezes, **tabela nova**.',
      ],
      board: {
        title: 'Modelagem orientada a consultas (query-first)',
        md: `\`\`\`sql
-- Consulta 1: "últimas mensagens de uma conversa"
CREATE TABLE mensagens_por_conversa (
  conversa_id uuid,
  enviada_em  timeuuid,
  autor_id    uuid,
  texto       text,
  PRIMARY KEY ((conversa_id), enviada_em)   -- (partição), clustering
) WITH CLUSTERING ORDER BY (enviada_em DESC);

-- Consulta 2: "mensagens enviadas por um usuário" → OUTRA tabela
CREATE TABLE mensagens_por_autor (
  autor_id    uuid,
  enviada_em  timeuuid,
  conversa_id uuid,
  texto       text,
  PRIMARY KEY ((autor_id), enviada_em)
);
\`\`\`

| Relacional | Wide-column (Cassandra) |
|---|---|
| normaliza e depois escreve as consultas | lista as consultas e cria **uma tabela por consulta** |
| JOINs e índices atendem consultas novas | sem JOIN: consulta nova ⇒ tabela nova |
| grava uma vez, lê de vários jeitos | **grava em várias tabelas**, lê barato e previsível |

> [!dica] Em chave-valor vale o mesmo: o **desenho da chave** é o seu índice. Chaves como \`sessao:{token}\` ou \`carrinho:{usuario_id}\` já dizem como o dado será lido.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'E o **grafo**? Ele trata relações como cidadãs de primeira classe: cada nó aponta direto para os vizinhos.',
        'Perguntas como "quem os meus amigos seguem e eu ainda não sigo?" viram **travessias**, sem uma pilha de self-joins.',
      ],
      board: {
        title: 'Grafo: quando as relações são o dado',
        md: `\`\`\`text
(Ana) ──SEGUE──▶ (Bia) ──SEGUE──▶ (Caio)
  │                                  │
  └──COMPROU──▶ [Livro] ◀──COMPROU───┘

// Cypher (Neo4j): sugestões para a Ana
MATCH (a:Pessoa {nome: 'Ana'})-[:SEGUE]->(:Pessoa)-[:SEGUE]->(s:Pessoa)
WHERE s <> a AND NOT (a)-[:SEGUE]->(s)
RETURN s.nome, count(*) AS em_comum ORDER BY em_comum DESC
\`\`\`

| Use grafo para | Evite quando |
|---|---|
| recomendações e redes sociais | o acesso é por chave ou por agregado |
| detecção de fraude (anéis de contas, cartões, endereços) | você precisa agregar a base inteira (OLAP) |
| dependências, rotas, hierarquias de permissão | o grafo não cabe numa máquina (particionar grafo é difícil) |

> [!dica] O SQL também percorre grafos com **CTE recursiva** — suficiente para hierarquias e poucos saltos. O banco de grafo vence quando travessias de profundidade variável são o **caso principal**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora vamos olhar **por baixo do capô**. Quase todo banco guarda os dados de um de dois jeitos: **B-tree** ou **LSM-tree**.',
        'A B-tree atualiza páginas **no lugar**. A LSM-tree nunca sobrescreve: ela **anexa** e arruma a casa depois.',
      ],
      board: {
        title: 'B-tree × LSM-tree',
        md: `\`\`\`text
LSM-tree: o caminho de uma escrita
PUT(k, v) ─▶ commit log / WAL   (append sequencial: sobrevive a crash)
          └▶ memtable           (árvore ordenada, em memória)
                 │ encheu?
                 ▼ flush
             SSTable nova   ─┐
             SSTable        ─┼─ imutáveis e ordenadas; a compactação
             SSTable antiga ─┘  funde tudo e descarta versões velhas
Leitura: memtable → SSTables, da mais nova para a mais antiga
\`\`\`

| | **B-tree** | **LSM-tree** |
|---|---|---|
| Quem usa | PostgreSQL, MySQL (InnoDB), SQLite | Cassandra, RocksDB, ScyllaDB, HBase |
| Escrita | lê e regrava uma **página** (I/O aleatório) | **append** + memtable (I/O sequencial) |
| Leitura pontual | um caminho raiz → folha | memtable + possivelmente vários SSTables |
| UPDATE/DELETE | no lugar | nova versão / **tombstone** |
| Custo escondido | páginas meio vazias, WAL + página | **compactação** em segundo plano |
| Brilha em | leituras e consultas por faixa | ingestão massiva de escritas |`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Aqui mora um custo que pouca gente conhece: a **write amplification**.',
        'Você grava 1 KB, mas o disco escreve 10, 20, 30 KB — por causa do WAL, de páginas inteiras regravadas ou de compactações que reescrevem o mesmo dado várias vezes.',
      ],
      board: {
        title: 'Amplificação: o trabalho que você não pediu',
        md: `| Amplificação | Definição | Quem sofre mais |
|---|---|---|
| **de escrita** | bytes gravados no disco ÷ bytes gravados pela aplicação | LSM com compactação *leveled*; B-tree com linhas pequenas em páginas grandes |
| **de leitura** | leituras de disco por consulta | LSM (vários SSTables por chave) |
| **de espaço** | espaço ocupado ÷ tamanho real dos dados | LSM *size-tiered* (versões antigas esperando compactação) |

- **Size-tiered** (padrão histórico do Cassandra): funde arquivos de tamanho parecido → menos escrita, porém mais espaço e leituras mais caras.
- **Leveled** (RocksDB, LevelDB): níveis sem sobreposição de chaves → leitura e espaço melhores, mas write amplification de 10× a 30×.

> [!sabia] Existe até uma "lei" para isso: a **conjectura RUM** (*Read, Update, Memory*, 2016) diz que um método de acesso consegue otimizar no máximo **dois** entre custo de leitura, custo de escrita e espaço extra — o terceiro piora. B-tree, LSM-tree e Bloom filter são só pontos diferentes desse triângulo.

> [!atencao] Numa LSM, **apagar é escrever**: o \`DELETE\` grava um *tombstone*. Usar o Cassandra como fila (insere, lê, apaga) faz cada leitura pular milhares de tombstones — um antipadrão famoso.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'E como a LSM evita abrir **todos** os SSTables só para descobrir que uma chave não existe? Com um **Bloom filter** por arquivo.',
        'É um vetor de bits com *k* funções de hash. Ele pode dizer "talvez" por engano, mas **nunca** diz "não" para algo que está lá.',
      ],
      board: {
        title: 'Bloom filter: "com certeza não" ou "talvez"',
        md: `\`\`\`text
m = 12 bits, k = 3 hashes
adicionar("ana") → liga os bits 1, 5, 9
adicionar("bia") → liga os bits 3, 5, 10

bits: [0 1 0 1 0 1 0 0 0 1 1 0]    (posições 0 a 11)

"caio" → 1, 4, 9  → o bit 4 está em 0 → com CERTEZA não está
"duda" → 3, 9, 10 → todos em 1      → "TALVEZ" (falso positivo!)
\`\`\`

| Fórmula | Para quê |
|---|---|
| \`p ≈ (1 − e^(−k·n/m))^k\` | taxa de falso positivo com \`n\` itens |
| \`m = −n·ln(p) / (ln 2)²\` | bits necessários para a taxa \`p\` |
| \`k = (m/n)·ln 2\` | número ótimo de hashes |

Regra de bolso: **~9,6 bits por item → 1%** de falso positivo; cada ~4,8 bits a mais por item dividem a taxa por 10.

> [!sabia] CDNs usam Bloom filters para não desperdiçar cache com *one-hit wonders* — objetos pedidos uma única vez. A Akamai relatou que cerca de três quartos dos objetos eram assim; com um Bloom filter, o objeto só entra no cache no **segundo** pedido.`,
        caption: 'Não dá para remover itens (zerar um bit afetaria outros itens). Para isso existem variantes como o *counting Bloom filter* e o *cuckoo filter*.',
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Então, quando escolher cada um? Comece pelas **consultas**, pelo volume e pelas exigências de **consistência** — o banco vem depois.',
        'E um segredo de entrevista: "um PostgreSQL bem indexado, com JSONB onde fizer sentido" é uma resposta respeitável para muita coisa.',
      ],
      board: {
        title: 'Guia rápido de escolha',
        md: `| Se o problema é… | Considere | Porque |
|---|---|---|
| transações entre entidades, consultas ad hoc, relatórios | **Relacional** | JOINs, ACID, SQL flexível |
| agregados autocontidos com schema variável (catálogo, CMS) | **Documento** | lê e grava o agregado inteiro |
| cache, sessão, contador, rate limit | **Chave-valor** | O(1) por chave, TTL, em memória |
| escrita massiva por chave e tempo (IoT, logs, chat) | **Wide-column** | LSM + partições espalhadas pelo cluster |
| relações profundas e variáveis | **Grafo** | travessias baratas |

> [!dica] Muitos sistemas combinam vários bancos, cada um no que faz melhor — a chamada **persistência poliglota**. O preço: mais operação e dados para manter sincronizados entre eles (assunto da aula sobre *outbox* e CDC).`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Modelos, modelagem, LSM-tree e um Bloom filter de verdade.', icon: '🎯' },
    {
      type: 'match',
      id: 'db-nosql-q1',
      concept: 'Modelos NoSQL',
      say: 'Para aquecer: associe cada cenário ao modelo que se encaixa melhor.',
      prompt: 'Associe cada **cenário** ao **modelo de dados** mais adequado.',
      pairs: [
        { left: 'Sessões de login com expiração, lidas sempre pelo token', right: 'Chave-valor (ex.: Redis com TTL)' },
        { left: 'Catálogo com atributos que variam por categoria de produto', right: 'Documento (ex.: MongoDB)' },
        { left: 'Leituras de 2 milhões de sensores, gravadas a cada segundo', right: 'Wide-column (ex.: Cassandra)' },
        { left: 'Detectar anéis de contas que compartilham cartões e endereços', right: 'Grafo (ex.: Neo4j)' },
        { left: 'Transferências entre contas cujo saldo nunca pode ficar negativo', right: 'Relacional com transações ACID' },
      ],
      explanation: 'O critério é o **padrão de acesso**: acesso por chave com TTL → chave-valor; agregado com schema variável → documento; ingestão massiva particionada por chave e tempo → wide-column (LSM); relações de profundidade variável → grafo. E quando a regra de negócio exige atomicidade entre várias linhas, o relacional com ACID continua imbatível.',
    },
    {
      type: 'mcq',
      id: 'db-nosql-q2',
      concept: 'Embutir × referenciar',
      say: 'Um caso real de modelagem de documento…',
      prompt: `Numa rede social em MongoDB, cada post é um documento. A primeira versão **embutiu** os comentários:

\`\`\`json
{ "_id": "post-1", "autor": "ana", "texto": "...",
  "comentarios": [ { "autor": "bia", "texto": "..." } ] }
\`\`\`

Um post viralizou e passou de **2 milhões** de comentários. Qual é a melhor correção?`,
      options: [
        { text: 'Mover os comentários para uma coleção própria, com `post_id` indexado, e manter no post só um contador e os comentários mais recentes.', correct: true, why: 'Comentários crescem **sem limite** e são paginados — não são lidos todos junto com o post. Referenciar resolve o limite de 16 MB, e guardar os mais recentes no post (padrão *subset*) mantém a leitura comum barata.' },
        { text: 'Manter embutido: ler o post e todos os comentários numa única consulta é sempre mais rápido.', why: 'Só vale para dados **pequenos e limitados** lidos juntos. Aqui cada leitura do post traria megabytes, e o documento estouraria o limite de 16 MB do MongoDB.' },
        { text: 'Migrar para um banco de grafo, já que comentários ligam usuários a posts.', why: 'O acesso é "comentários do post X, paginados": uma consulta por chave e ordem, não uma travessia. Trocar de banco não conserta um erro de modelagem.' },
        { text: 'Comprimir o array de comentários para caber no documento.', why: 'Só adia o problema: o array continua crescendo sem limite, e cada comentário novo ainda mexe num documento gigante.' },
      ],
      explanation: 'Regra prática: **embuta** o que é lido junto e tem tamanho limitado (itens de um pedido); **referencie** o que cresce sem limite, é paginado ou é compartilhado. Os padrões *subset* (guardar só os N comentários mais recentes no post) e *bucket* (agrupar comentários em documentos de tamanho fixo) são meios-termos muito usados.',
    },
    {
      type: 'mcq',
      id: 'db-nosql-q3',
      concept: 'Modelagem orientada a consultas',
      say: 'Agora no Cassandra, onde a chave de partição manda em tudo.',
      prompt: `Você tem esta tabela no Cassandra:

\`\`\`sql
CREATE TABLE mensagens_por_conversa (
  conversa_id uuid, enviada_em timeuuid, autor_id uuid, texto text,
  PRIMARY KEY ((conversa_id), enviada_em)
);
\`\`\`

O produto agora quer a tela **"todas as mensagens que um usuário enviou"**, com muito acesso. Qual é a abordagem idiomática?`,
      options: [
        { text: 'Criar a tabela `mensagens_por_autor`, com partição `autor_id`, e gravar cada mensagem **nas duas tabelas**.', correct: true, why: 'Em wide-column, cada consulta frequente ganha uma tabela cuja chave de partição é o filtro. Gravar duas vezes é barato numa LSM; ler de uma única partição é o que escala.' },
        { text: 'Rodar `SELECT * FROM mensagens_por_conversa WHERE autor_id = ? ALLOW FILTERING`.', why: '`ALLOW FILTERING` sem a chave de partição varre **todas as partições de todos os nós**: funciona no teste, derruba o cluster em produção.' },
        { text: 'Fazer um JOIN entre `mensagens_por_conversa` e uma tabela de usuários.', why: 'O Cassandra não tem JOIN. Juntar dados é trabalho da modelagem (desnormalizar) ou da aplicação.' },
        { text: 'Criar um índice secundário em `autor_id`: funciona igual a um índice do PostgreSQL.', why: 'O índice secundário do Cassandra é **local a cada nó**: a consulta precisa perguntar a todos os nós (*scatter-gather*). Serve para casos pontuais e de baixo volume, não para uma tela principal.' },
      ],
      explanation: 'Modelagem *query-first*: liste as consultas e desenhe uma tabela por consulta, com a **chave de partição** igual ao filtro principal e a **chave de clustering** igual à ordenação. O preço é gravar o mesmo dado em várias tabelas — o que numa LSM-tree custa pouco.',
    },
    {
      type: 'order',
      id: 'db-nosql-q4',
      concept: 'LSM-tree',
      say: 'Coloque em ordem o caminho de uma escrita numa LSM-tree.',
      prompt: 'Ordene o que acontece com um `PUT(chave, valor)` num banco baseado em **LSM-tree**, do primeiro ao último passo.',
      items: [
        'A escrita é anexada ao **commit log (WAL)**, sequencialmente, para sobreviver a um crash',
        'O par entra na **memtable** (ordenada, em memória) e o cliente recebe a confirmação',
        'A memtable enche, é congelada e despejada no disco como um **SSTable** imutável',
        'O trecho do commit log coberto por esse SSTable pode ser descartado',
        'Mais tarde, a **compactação** funde SSTables e descarta versões antigas e tombstones vencidos',
      ],
      explanation: 'O segredo da LSM é que **nada é sobrescrito no lugar**: o WAL garante durabilidade com escrita sequencial, a memtable mantém a ordem em memória, o flush gera arquivos ordenados e imutáveis (e libera o log) e a compactação faz a faxina depois — é aí que aparece a write amplification.',
    },
    {
      type: 'code',
      id: 'db-nosql-q5',
      concept: 'Bloom filter',
      title: 'Seu próprio Bloom filter',
      say: 'Hora de construir um Bloom filter de verdade — e dimensioná-lo como um banco faria.',
      prompt: `Implemente um **Bloom filter**:

- \`tamanho_ideal(n, p)\` devolve a tupla \`(m, k)\` para \`n\` itens e taxa de falso positivo \`p\`:
  \`m = ceil(-n · ln(p) / (ln 2)²)\` e \`k = max(1, round(m / n · ln 2))\`.
- \`BloomFilter(m, k)\` começa com \`m\` bits zerados.
- \`posicoes(item)\` devolve a **lista** das \`k\` posições do item com *double hashing*: \`(h1 + i * h2) % m\` para \`i = 0, 1, …, k - 1\`, onde \`h1, h2 = dois_hashes(item)\` (já pronta).
- \`adicionar(item)\` liga os bits dessas posições.
- \`item in filtro\` (método \`__contains__\`) é \`True\` só se **todos** os bits do item estiverem ligados.

Nunca pode haver **falso negativo**, e os falsos positivos devem ficar perto de \`p\`.`,
      starter: `import hashlib
import math


def dois_hashes(item):
    """Dois hashes de 64 bits, estáveis entre execuções (não use hash())."""
    d = hashlib.sha256(item.encode("utf-8")).digest()
    return int.from_bytes(d[:8], "big"), int.from_bytes(d[8:16], "big")


def tamanho_ideal(n, p):
    # TODO: devolva (m, k)
    pass


class BloomFilter:
    def __init__(self, m, k):
        self.m = m
        self.k = k
        # TODO: crie o vetor de m bits (dica: bytearray(m))

    def posicoes(self, item):
        # TODO: k posições com double hashing
        pass

    def adicionar(self, item):
        pass

    def __contains__(self, item):
        pass
`,
      tests: [
        { name: 'tamanho_ideal(1000, 0.01)', expr: 'tamanho_ideal(1000, 0.01)', expected: '(9586, 7)' },
        { name: 'caso de borda: k nunca é zero', expr: 'tamanho_ideal(10, 0.9)', expected: '(3, 1)' },
        {
          name: 'posicoes devolve k valores entre 0 e m - 1',
          code: `bf = BloomFilter(100, 4)
ps = bf.posicoes("ana")
assert isinstance(ps, list) and len(ps) == 4, "posicoes deve devolver uma lista com k posições"
assert all(0 <= p < 100 for p in ps), f"posição fora do intervalo 0..m-1: {ps}"`,
        },
        {
          name: 'posicoes segue o double hashing',
          code: `h1, h2 = dois_hashes("bia")
bf = BloomFilter(1000, 5)
assert bf.posicoes("bia") == [(h1 + i * h2) % 1000 for i in range(5)], "use (h1 + i * h2) % m para i = 0..k-1"`,
        },
        { name: 'filtro vazio não contém nada', expr: '"qualquer" in BloomFilter(64, 3)', expected: 'False' },
        {
          name: 'sem falso negativo',
          code: `bf = BloomFilter(2000, 5)
nomes = [f"user-{i}" for i in range(200)] + ["ação", ""]
for nome in nomes:
    bf.adicionar(nome)
faltando = [n for n in nomes if n not in bf]
assert not faltando, f"falso negativo para {faltando[:3]}"`,
        },
        {
          name: 'taxa de falso positivo perto de p',
          hidden: true,
          code: `m, k = tamanho_ideal(1000, 0.01)
bf = BloomFilter(m, k)
for i in range(1000):
    bf.adicionar(f"dentro-{i}")
fp = sum(f"fora-{i}" in bf for i in range(10000))
assert fp < 200, f"falsos positivos demais: {fp} em 10000 (o esperado é perto de 1%)"`,
        },
        {
          name: 'filtro saturado dá falso positivo (é um vetor de bits, não um set)',
          hidden: true,
          code: `bf = BloomFilter(64, 3)
for i in range(500):
    bf.adicionar(f"item-{i}")
assert "nunca-inserido" in bf, "com 64 bits e 500 itens todos os bits ligam: o filtro deveria responder 'talvez'"`,
        },
        { name: 'dimensionamento para 1 milhão de itens e 0,1%', hidden: true, expr: 'tamanho_ideal(1_000_000, 0.001)', expected: '(14377588, 10)' },
      ],
      reviews: [
        {
          when: m => m.calls.includes('hash'),
          text: 'Você usou `hash()`. Para strings ele é **randomizado a cada processo** (PYTHONHASHSEED): um filtro salvo em disco ou montado em outro servidor daria **falso negativo**. Use um hash estável, como o `dois_hashes` (SHA-256).',
          concept: 'Hash estável',
        },
        {
          when: m => m.calls.includes('set'),
          text: 'Você usou `set()`. Se ele guarda os **itens** (ou as posições), a memória cresce com os dados e some a graça do Bloom filter: ocupar **m bits fixos**, não importa quantos nem quão grandes sejam os itens. Use um `bytearray` (ou um `int`) como mapa de bits.',
          concept: 'Bloom filter',
        },
      ],
      hints: [
        '`tamanho_ideal`: use `math.log` (logaritmo natural) e `math.ceil`, e não esqueça o `max(1, …)` do `k`.',
        'Em `posicoes`, desempacote `h1, h2 = dois_hashes(item)` e monte a lista com `range(self.k)`.',
        '`__contains__` pode ser `all(self.bits[p] for p in self.posicoes(item))`: basta **um** bit desligado para ter certeza de que o item nunca foi inserido.',
      ],
      solution: `import hashlib
import math


def dois_hashes(item):
    """Dois hashes de 64 bits, estáveis entre execuções (não use hash())."""
    d = hashlib.sha256(item.encode("utf-8")).digest()
    return int.from_bytes(d[:8], "big"), int.from_bytes(d[8:16], "big")


def tamanho_ideal(n, p):
    m = math.ceil(-n * math.log(p) / math.log(2) ** 2)
    k = max(1, round(m / n * math.log(2)))
    return m, k


class BloomFilter:
    def __init__(self, m, k):
        self.m = m
        self.k = k
        self.bits = bytearray(m)  # didático: 1 byte por bit

    def posicoes(self, item):
        h1, h2 = dois_hashes(item)
        return [(h1 + i * h2) % self.m for i in range(self.k)]

    def adicionar(self, item):
        for pos in self.posicoes(item):
            self.bits[pos] = 1

    def __contains__(self, item):
        return all(self.bits[pos] for pos in self.posicoes(item))
`,
      solutionExplanation: 'O filtro é só um `bytearray` de `m` posições (um filtro real empacota 8 bits por byte). Cada item liga `k` bits calculados por *double hashing* — o truque de Kirsch e Mitzenmacher: dois hashes bastam para gerar os `k`. Inserir e consultar custam O(k), **independente do número de itens**. Se algum bit estiver desligado, o item com certeza nunca foi inserido; se todos estiverem ligados, pode ser coincidência — daí o falso positivo, que `tamanho_ideal` controla: com ~9,6 bits por item ele fica perto de 1%.',
    },
    {
      type: 'open',
      id: 'db-nosql-q6',
      concept: 'B-tree × LSM-tree',
      say: 'Última: explique como se estivesse numa entrevista.',
      prompt: 'Seu time vai ingerir **200 mil eventos de telemetria por segundo**, quase sem atualizações, e ler por dispositivo e janela de tempo. Explique por que um motor baseado em **LSM-tree** aguenta essa carga de escrita melhor que uma **B-tree**, qual é o **preço** dessa escolha e como o **Bloom filter** ajuda nas leituras.',
      minWords: 30,
      rubric: [
        { label: 'Explica que a LSM transforma escritas em **append sequencial** (WAL + memtable)', keywords: ['sequencia', 'append', 'anexa', 'memtable', 'em memoria', 'nao sobrescreve', 'imutave'], concept: 'LSM-tree', why: 'A LSM nunca atualiza no lugar: anexa no log e acumula na memtable, evitando o I/O aleatório de regravar páginas.' },
        { label: 'Contrasta com a B-tree regravando **páginas** no lugar (I/O aleatório)', keywords: ['pagina', 'aleatori', 'no lugar', 'in place', 'in-place', 'random'], concept: 'B-tree', why: 'Cada escrita numa B-tree lê e regrava uma página de vários KB em posições espalhadas do disco.' },
        { label: 'Cita o preço: **compactação**, write amplification ou leitura em vários SSTables', keywords: ['compacta', 'compaction', 'amplifica', 'amplification', 'varios sstables', 'varias sstables', 'varios arquivos', 'tombstone'], concept: 'Write amplification', why: 'A faxina em segundo plano regrava os dados várias vezes e, até ela acontecer, uma leitura pode precisar consultar vários arquivos.' },
        { label: 'Explica o **Bloom filter**: pula SSTables que com certeza não têm a chave', keywords: ['falso positivo', 'falsos positivos', 'falso negativo', 'com certeza', ['bloom', 'evit'], ['bloom', 'pul'], ['bloom', 'nao tem'], ['bloom', 'nao est']], concept: 'Bloom filter', why: 'Cada SSTable tem seu Bloom filter; se ele responde "não está", o arquivo nem é lido.' },
      ],
      modelAnswer: `Numa **LSM-tree**, cada escrita vira um **append sequencial** no commit log (WAL) e uma inserção na **memtable**, em memória. Quando a memtable enche, ela é despejada como um SSTable imutável e ordenado — nada é sobrescrito no lugar. Já numa **B-tree**, cada escrita lê e regrava uma **página** inteira em posições espalhadas do disco (I/O aleatório), o que limita a vazão com 200 mil escritas por segundo.

O preço é a **compactação**: em segundo plano, o motor funde SSTables e regrava os mesmos dados várias vezes (**write amplification**), gastando disco e CPU. Até a compactação acontecer, uma leitura pode ter que consultar **vários SSTables** (read amplification), e os deletes viram tombstones.

O **Bloom filter** de cada SSTable responde "com certeza não está" ou "talvez esteja": a leitura **pula** os arquivos em que a chave com certeza não está e só abre os candidatos, com poucos falsos positivos e nenhum falso negativo.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Você viu as quatro famílias NoSQL, aprendeu a modelar **a partir das consultas** e abriu o capô: B-tree, LSM-tree, compactação e Bloom filter.',
        'Na próxima aula a pergunta é outra: o que fazer quando **uma máquina só** não basta? Replicação, sharding e consistent hashing.',
      ],
      board: null,
    },
  ],
});
