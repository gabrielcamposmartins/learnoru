(function () {
  // Dataset da questão de normalização.
  const PLANILHA = `CREATE TABLE planilha_pedidos (
  pedido_id INTEGER PRIMARY KEY,
  cliente_email TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_cidade TEXT NOT NULL,
  total REAL NOT NULL
);
INSERT INTO planilha_pedidos VALUES
  (101, 'ana@ex.com', 'Ana Souza', 'Recife', 120.00),
  (102, 'bia@ex.com', 'Bia Lima', 'Natal', 80.00),
  (103, 'ana@ex.com', 'Ana Souza', 'Recife', 45.50),
  (104, 'caio@ex.com', 'Caio Reis', 'Recife', 300.00),
  (105, 'bia@ex.com', 'Bia Lima', 'Natal', 19.90),
  (106, 'ana@ex.com', 'Ana Souza', 'Olinda', 60.00);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL
);

CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  total REAL NOT NULL
);`;

  // Banco do blog + wrapper que conta consultas (usado no setup dos testes da questão N+1).
  const SETUP_BLOG = `import sqlite3


class ConexaoContadora:
    """Repassa tudo para a conexão real e registra cada comando SQL executado."""

    def __init__(self, conn):
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "consultas", [])
        conn.set_trace_callback(self.consultas.append)

    def __getattr__(self, nome):
        return getattr(self._conn, nome)

    def __setattr__(self, nome, valor):
        setattr(self._conn, nome, valor)


def _novo_banco(extras=0):
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE autores (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, autor_id INTEGER NOT NULL REFERENCES autores(id), titulo TEXT NOT NULL);
        CREATE TABLE comentarios (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id), texto TEXT NOT NULL);
        INSERT INTO autores VALUES (1, 'Ana'), (2, 'Bruno'), (3, 'Carla'), (4, 'Davi');
        INSERT INTO posts VALUES (1, 1, 'Índices na prática'), (2, 2, 'O problema N+1'), (3, 1, 'MVCC sem mistério'), (4, 3, 'Normalização');
        INSERT INTO comentarios (post_id, texto) VALUES
            (1, 'Ótimo!'), (1, 'Salvou meu dia'), (2, 'Aconteceu comigo'), (1, 'E o covering index?'), (4, 'Faltou a 4FN');
    """)
    for i in range(extras):
        post_id = 100 + i
        conn.execute("INSERT INTO posts VALUES (?, ?, ?)", (post_id, 1 + i % 3, "Post extra " + str(i)))
        for k in range(i % 4):
            conn.execute("INSERT INTO comentarios (post_id, texto) VALUES (?, ?)", (post_id, "comentário " + str(k)))
    return conn


def _esperado(conn):
    # a versão N+1 — lenta, mas correta — serve de referência
    resumo = []
    for post_id, autor_id, titulo in conn.execute("SELECT id, autor_id, titulo FROM posts ORDER BY id").fetchall():
        autor = conn.execute("SELECT nome FROM autores WHERE id = ?", (autor_id,)).fetchone()[0]
        qtd = conn.execute("SELECT COUNT(*) FROM comentarios WHERE post_id = ?", (post_id,)).fetchone()[0]
        resumo.append((titulo, autor, qtd))
    return resumo
`;

  Game.registerModule('databases', {
    id: 'modelagem',
    title: 'Modelagem: normalização, chaves e N+1',
    kind: 'lesson',
    level: 2,
    order: 11,
    unit: 'performance',
    summary: 'Normalizar para evitar anomalias, desnormalizar com consciência, escolher chaves — e matar o N+1 que o ORM esconde.',
    concepts: ['Normalização (1FN–3FN)', 'Anomalias', 'Desnormalização', 'Chave natural × substituta', 'N+1'],
    takeaways: [
      'Dado repetido vira **anomalia**: de inserção (não dá para cadastrar), de atualização (muda aqui, esquece ali) e de remoção (apaga demais).',
      '1FN: valores atômicos, sem grupos repetidos · 2FN: nada depende de **parte** da chave · 3FN: nada depende de coluna **não-chave**.',
      'Desnormalize **de propósito**, para uma leitura medida, e defina quem mantém a cópia em dia (mesma transação, trigger, evento).',
      'Use **chave substituta** estável como chave primária e proteja a chave natural com `UNIQUE`.',
      '**N+1** = 1 consulta para a lista + 1 por item. Resolva com JOIN, IN/prefetch ou batching — e conte as consultas nos testes.',
    ],
    glossary: [
      {
        term: 'Normalização',
        aliases: ['normalizar', 'normalizada', 'normalizado', 'formas normais', 'forma normal', 'normal form', '1FN', '2FN', '3FN'],
        definition: 'Organizar as tabelas para que cada fato fique guardado em **um só lugar**. As formas normais (1FN, 2FN, 3FN…) eliminam, passo a passo, a redundância que causa anomalias de inserção, atualização e remoção.',
      },
      {
        term: 'Anomalias de modificação',
        aliases: ['anomalia de inserção', 'anomalia de atualização', 'anomalia de remoção', 'anomalias de inserção', 'anomalias de atualização', 'anomalias de remoção', 'update anomaly'],
        definition: 'Problemas causados por dados redundantes: não conseguir inserir um fato sem outro (**inserção**), precisar alterar várias cópias do mesmo dado (**atualização**) ou perder informação ao apagar uma linha (**remoção**).',
      },
      {
        term: 'Desnormalização',
        aliases: ['desnormalizar', 'desnormalizado', 'desnormalizada', 'denormalization'],
        definition: 'Duplicar dados **de propósito** — contadores, colunas copiadas, views materializadas — para acelerar leituras, aceitando o custo e o risco de manter as cópias sincronizadas.',
      },
      {
        term: 'Chave substituta',
        aliases: ['chaves substitutas', 'surrogate key', 'chave artificial', 'chave natural', 'chaves naturais', 'natural key'],
        definition: 'Identificador sem significado de negócio (autoincremento, UUID) usado como chave primária, em oposição à **chave natural** do domínio (CPF, e-mail, ISBN), que pode mudar. A natural continua protegida por `UNIQUE`.',
      },
      {
        term: 'Problema N+1',
        aliases: ['N+1', 'select N+1', 'consultas N+1'],
        definition: 'Anti-padrão em que o código faz 1 consulta para buscar uma lista e mais 1 consulta **por item** para buscar dados relacionados — típico do *lazy loading* de ORMs. Resolve-se com JOIN, `IN` (prefetch) ou batching.',
      },
      {
        term: 'Explosão cartesiana',
        aliases: ['cartesian explosion', 'produto cartesiano'],
        definition: 'Multiplicação de linhas ao fazer JOIN com **duas ou mais coleções** "para muitos" ao mesmo tempo: 10 itens × 5 pagamentos viram 50 linhas por pedido, inflando tráfego e contagens. Por isso ORMs oferecem consultas separadas (*split queries*, prefetch).',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje o assunto é **modelagem**: como organizar as tabelas para que o banco não vire uma planilha bagunçada.',
          'Começando por um clássico de todo sistema que nasceu de um Excel: a "tabelona" que guarda tudo junto.',
        ],
        board: {
          title: 'A tabelona — e suas anomalias',
          md: `| pedido_id | cliente_email | cliente_nome | cliente_cidade | produto | preco | qtd |
|---|---|---|---|---|---|---|
| 101 | ana@ex.com | Ana Souza | Recife | Teclado | 150 | 1 |
| 102 | ana@ex.com | Ana Souza | Recife | Mouse | 80 | 2 |
| 103 | bia@ex.com | Bia Lima | Natal | Teclado | 150 | 1 |

Os dados da Ana se repetem em **todo** pedido dela; o preço do teclado, em todo pedido de teclado. Redundância não é só espaço desperdiçado — ela gera **anomalias**:

| Anomalia | Exemplo |
|---|---|
| **Inserção** | não dá para cadastrar um produto novo (ou um cliente) sem inventar um pedido |
| **Atualização** | a Ana mudou de cidade: são 300 linhas para alterar — esquecer uma deixa o banco **contraditório** |
| **Remoção** | apagar o único pedido da Bia apaga tudo o que se sabia sobre ela |`,
        },
      },
      {
        type: 'say',
        text: [
          'A cura é a **normalização**: uma sequência de formas normais, cada uma eliminando um tipo de redundância.',
          'A 1ª forma normal pede o básico: cada célula guarda **um** valor, e nada de colunas repetidas como `telefone1`, `telefone2`, `telefone3`.',
        ],
        board: {
          title: '1FN — valores atômicos, sem grupos repetidos',
          md: `❌ Viola a 1FN:

| cliente_id | nome | telefones |
|---|---|---|
| 1 | Ana | 81 9999-0000, 81 3333-1111 |

Como achar "quem tem o telefone 3333-1111"? Com \`LIKE '%3333%'\` — lento (sem índice!) e frágil. E colunas \`telefone1..3\` limitam a três e enchem a tabela de NULL.

✅ Em 1FN, o grupo repetido vira **outra tabela**:

\`\`\`sql
CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE telefones (
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  numero     TEXT NOT NULL,
  PRIMARY KEY (cliente_id, numero)
);
\`\`\`

> [!dica] "Atômico" depende do uso: guardar o endereço inteiro numa coluna é aceitável se você nunca filtra por cidade. Colunas JSON (\`jsonb\` no PostgreSQL) são uma exceção **consciente** à 1FN — ótimas para atributos variáveis, ruins para o que você filtra e junta o tempo todo.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'As próximas formas tratam de **dependências**: de que coluna cada informação realmente depende?',
          'Na 2FN, nada pode depender de só **parte** de uma chave composta. Na 3FN, nada pode depender de outra coluna que **não** é chave.',
        ],
        board: {
          title: '2FN e 3FN — dependências',
          md: `**2FN** — em \`itens_pedido\`, a chave é \`(pedido_id, produto_id)\`:

| pedido_id | produto_id | quantidade | nome_produto |
|---|---|---|---|
| 101 | 7 | 1 | Teclado |
| 102 | 7 | 3 | Teclado |

\`nome_produto\` depende **só** de \`produto_id\`, que é parte da chave → dependência **parcial**. O nome vai para \`produtos(id, nome)\`.

**3FN** — em \`clientes(id, nome, cep, cidade)\`, a \`cidade\` depende do \`cep\`, que depende do \`id\` → dependência **transitiva** (\`id → cep → cidade\`). A cidade vai para \`ceps(cep, cidade)\`.

| Forma | Pergunta a fazer |
|---|---|
| 1FN | Cada célula tem um único valor? Há grupos repetidos? |
| 2FN | Toda coluna depende da chave **inteira**? |
| 3FN | Alguma coluna depende de outra coluna que não é chave? |

> [!sabia] O resumo clássico (William Kent, 1983): cada atributo deve depender "da **chave**, da **chave inteira** e de **nada além da chave**" — e muita gente completa com *"so help me Codd"*, homenagem a Edgar F. Codd, o criador do modelo relacional. Depois da 3FN ainda existem a BCNF, a 4FN (dependências **multivaloradas**) e a 5FN, raras no dia a dia.`,
        },
      },
      {
        type: 'say',
        text: [
          'Então é sempre normalizar até o fim? Não. Em sistemas com muito mais leitura do que escrita, às vezes vale **duplicar de propósito**.',
          'A palavra-chave é **consciente**: você mede o gargalo, duplica o mínimo e define **quem** mantém a cópia em dia.',
        ],
        board: {
          title: 'Desnormalização consciente',
          md: `| Técnica | Exemplo | Como manter consistente |
|---|---|---|
| Contador | \`posts.qtd_comentarios\` | na **mesma transação** do INSERT, ou com trigger |
| Coluna copiada | \`pedidos.cliente_nome\`, para a listagem | trigger/evento quando o nome muda — ou aceitar atraso |
| View materializada | vendas por dia | \`REFRESH MATERIALIZED VIEW\` periódico ("dados de ontem") |
| Read model / cache | documento pronto para a tela | eventos (CQRS), com consistência eventual |

\`\`\`sql
-- contador mantido na mesma transação: nunca fica inconsistente
BEGIN;
INSERT INTO comentarios (post_id, texto) VALUES (42, 'Ótimo post!');
UPDATE posts SET qtd_comentarios = qtd_comentarios + 1 WHERE id = 42;
COMMIT;
\`\`\`

> [!atencao] Nem toda cópia é desnormalização. \`itens_pedido.preco_unitario\` guarda o preço **pago naquele dia** — é outro fato, não uma cópia de \`produtos.preco\`. Se o produto subir de preço amanhã, o pedido antigo **não pode** mudar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Outra decisão que parece simples: qual é a **chave primária**?',
          'A chave **natural** vem do domínio — CPF, e-mail, ISBN. A chave **substituta** é um identificador sem significado, como um autoincremento ou um UUID.',
        ],
        board: {
          title: 'Chave natural × chave substituta',
          md: `| | Natural (\`email\`, \`cpf\`) | Substituta (\`id\`) |
|---|---|---|
| Significado | tem — dá para "ler" | nenhum |
| Estabilidade | **muda**: e-mail troca, CPF vem com e sem pontos, ISBN-10 virou ISBN-13 | nunca muda |
| Tamanho em FKs e índices | texto longo repetido em cada tabela filha | 8 bytes |
| Privacidade | espalha dado pessoal por URLs, logs e FKs | neutra |
| Duplicatas | a própria PK impede | **precisa** de \`UNIQUE\` na chave natural! |

\`\`\`sql
CREATE TABLE usuarios (
  id    INTEGER PRIMARY KEY,     -- substituta: estável e pequena
  email TEXT NOT NULL UNIQUE,    -- natural: continua única!
  nome  TEXT NOT NULL
);
\`\`\`

- **Autoincremento** é compacto e crescente (ótimo para a B-tree), mas previsível — dá para enumerar \`/usuarios/1, 2, 3…\` — e difícil de gerar em vários servidores.
- **UUID v4** é aleatório: gera em qualquer lugar, mas espalha as inserções pelo índice. **UUID v7** começa com o timestamp: único globalmente **e** ordenado.

> [!dica] Chave natural brilha em tabelas de referência pequenas e estáveis: código de país (\`BR\`), moeda (\`BRL\`), aeroporto (\`GRU\`).`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora um vilão de performance que não aparece no código: o **problema N+1**.',
          'O ORM carrega relacionamentos sob demanda (*lazy loading*). Um laço inocente sobre 100 pedidos dispara **101 consultas** — e cada uma paga a ida e volta até o banco.',
        ],
        board: {
          title: 'O problema N+1',
          md: `\`\`\`python
# Django — parece uma consulta só...
for pedido in Pedido.objects.all()[:100]:
    print(pedido.id, pedido.cliente.nome)   # ← cada .cliente é uma consulta!
\`\`\`

O que chega ao banco:

\`\`\`sql
SELECT * FROM pedidos LIMIT 100;          -- 1
SELECT * FROM clientes WHERE id = 7;      -- +1
SELECT * FROM clientes WHERE id = 3;      -- +1
-- ... mais 98 consultas                  -- = N + 1
\`\`\`

- Cada consulta isolada é rápida (1 ms), então nenhuma aparece no log de *slow queries* — o que pesa é a **soma**, com a latência de rede de cada ida e volta.
- Cresce com os dados: a página que fazia 11 consultas em desenvolvimento faz 1.001 em produção.
- O mesmo acontece em templates, serializers e resolvers GraphQL — em qualquer lugar que acesse \`objeto.relacionamento\` dentro de um laço.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'A solução é buscar os relacionados **em lote**. Existem três jeitos, e todo ORM decente oferece os três.',
          'E o melhor: dá para **testar** isso contando as consultas — é o que você vai fazer daqui a pouco.',
        ],
        board: {
          title: 'Resolvendo o N+1',
          md: `| Estratégia | SQL gerado | Django | SQLAlchemy |
|---|---|---|---|
| **JOIN** | 1 consulta: \`... FROM pedidos JOIN clientes ON ...\` | \`select_related('cliente')\` | \`joinedload(Pedido.cliente)\` |
| **IN / prefetch** | 2 consultas: pedidos + \`... WHERE pedido_id IN (7, 3, ...)\` | \`prefetch_related('itens')\` | \`selectinload(Pedido.itens)\` |
| **Batching** | junta os ids pedidos num "tick" e faz 1 consulta | — | DataLoader (GraphQL) |

- **JOIN** é ideal para relações "para um" (pedido → cliente).
- **IN** é melhor para coleções "para muitos" (pedido → itens): não repete as colunas do pedido em cada linha de item.
- Para **detectar**: conte consultas nos testes (\`assertNumQueries\` no Django, \`django_assert_num_queries\` no pytest-django), ligue o log de SQL em desenvolvimento, use APM.

> [!sabia] Fazer JOIN com **duas coleções** ao mesmo tempo (pedido → itens **e** pedido → pagamentos) causa a **explosão cartesiana**: um pedido com 10 itens e 5 pagamentos vira 10 × 5 = 50 linhas, e um \`COUNT(*)\` passa a contar errado. É por isso que o EF Core tem *split queries* e o \`prefetch_related\` faz consultas separadas com \`IN\`.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Formas normais, anomalias, chaves e um N+1 de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'db-mod-q1',
        concept: 'Normalização (2FN)',
        say: 'Primeira: diagnóstico de forma normal. De que cada coluna depende?',
        prompt: `A chave primária desta tabela é \`(pedido_id, produto_id)\`. Qual é a **primeira** forma normal que ela deixa de cumprir?

| pedido_id | produto_id | quantidade | preco_pago | nome_produto |
|---|---|---|---|---|
| 101 | 7 | 1 | 150.00 | Teclado |
| 102 | 7 | 3 | 140.00 | Teclado |
| 102 | 9 | 1 | 80.00 | Mouse |`,
        options: [
          { text: '1FN', why: 'Todas as células têm um único valor e não há grupos repetidos: a 1FN está cumprida.' },
          { text: '2FN', correct: true, why: '`nome_produto` depende só de `produto_id`, que é **parte** da chave composta — dependência parcial. O nome deve morar em `produtos`.' },
          { text: '3FN', why: 'A 3FN trata de dependência **transitiva** entre colunas não-chave. O problema aqui aparece antes: uma coluna depende de parte da chave.' },
          { text: 'Nenhuma — a tabela está normalizada', why: 'O nome do produto se repete em cada pedido: renomear o produto exige atualizar todas essas linhas (anomalia de atualização).' },
        ],
        explanation: 'Na 2FN, toda coluna não-chave depende da chave **inteira**. `quantidade` e `preco_pago` dependem de `(pedido_id, produto_id)` — são fatos daquele item naquele pedido. Já `nome_produto` só depende de `produto_id`: é um fato do **produto**. Repare que `preco_pago` **não** é redundância: é o preço daquela venda, que não pode mudar quando o catálogo mudar.',
      },
      {
        type: 'match',
        id: 'db-mod-q2',
        concept: 'Anomalias',
        say: 'Agora associe cada problema ao sintoma que ele causa.',
        prompt: 'Associe cada problema de modelagem ao exemplo que o ilustra.',
        pairs: [
          { left: 'Anomalia de inserção', right: 'Não dá para cadastrar um produto sem criar um pedido para ele' },
          { left: 'Anomalia de atualização', right: 'O cliente trocou de e-mail e 2 das 300 linhas ficaram com o antigo' },
          { left: 'Anomalia de remoção', right: 'Apagar o último pedido da cliente apagou o único registro do telefone dela' },
          { left: 'Violação da 1FN', right: 'Coluna `tags` guardando o texto "sql, índices, python"' },
          { left: 'Violação da 3FN', right: '`cidade` depende do `cep`, que depende do `id`' },
        ],
        explanation: 'As três anomalias são sintomas de **redundância**: o mesmo fato guardado em vários lugares (atualização), ou fatos diferentes presos na mesma linha (inserção e remoção). As formas normais atacam as causas: a 1FN elimina valores compostos e grupos repetidos; a 2FN e a 3FN separam fatos que dependem de parte da chave ou de colunas não-chave.',
      },
      {
        type: 'sql',
        id: 'db-mod-q3',
        concept: 'Normalização',
        title: 'Normalizando a planilha de pedidos',
        say: 'Prática: vamos tirar os clientes da tabelona. E cuidado — a planilha tem uma anomalia escondida!',
        prompt: `A loja importou uma planilha para \`planilha_pedidos\`, com os dados do cliente repetidos em cada pedido. As tabelas normalizadas já existem, **vazias**:

- \`clientes(id, email, nome, cidade)\` — um cliente por **e-mail** (\`email\` é \`UNIQUE\`; o \`id\` é gerado pelo banco)
- \`pedidos(id, cliente_id, total)\` — o \`id\` é o mesmo \`pedido_id\` da planilha, e \`cliente_id\` aponta para \`clientes.id\`

Escreva o script que **preenche** \`clientes\` e \`pedidos\` a partir da planilha.

⚠️ A planilha sofreu uma **anomalia de atualização**: a Ana se mudou e só o pedido mais novo dela tem a cidade nova. Quando os dados de um mesmo e-mail divergirem, vale o do pedido **mais recente** (maior \`pedido_id\`).`,
        schema: PLANILHA,
        variants: [
          `INSERT INTO planilha_pedidos VALUES
  (107, 'ana.souza@outro.com', 'Ana Souza', 'Caruaru', 55.00),
  (108, 'bia@ex.com', 'Beatriz Lima', 'Natal', 42.00),
  (99, 'caio@ex.com', 'Caio Reis', 'Olinda', 10.00);`,
          'DELETE FROM planilha_pedidos WHERE pedido_id = 106;',
          'DELETE FROM planilha_pedidos;',
        ],
        mode: 'script',
        verify: [
          'SELECT email, nome, cidade FROM clientes',
          'SELECT p.id, c.email, p.total FROM pedidos AS p JOIN clientes AS c ON c.id = p.cliente_id',
        ],
        starter: `-- 1) Um cliente por e-mail — com os dados do pedido mais recente
INSERT INTO clientes (email, nome, cidade)
SELECT DISTINCT cliente_email, cliente_nome, cliente_cidade
FROM planilha_pedidos;

-- 2) Os pedidos, apontando para o cliente certo
`,
        solution: `INSERT INTO clientes (email, nome, cidade)
SELECT cliente_email, cliente_nome, cliente_cidade
FROM planilha_pedidos AS p
WHERE pedido_id = (
  SELECT MAX(pedido_id)
  FROM planilha_pedidos
  WHERE cliente_email = p.cliente_email
);

INSERT INTO pedidos (id, cliente_id, total)
SELECT p.pedido_id, c.id, p.total
FROM planilha_pedidos AS p
JOIN clientes AS c ON c.email = p.cliente_email;`,
        solutionExplanation: `O \`DISTINCT\` do código inicial esbarra na anomalia: a Ana aparece com **duas** cidades, e o \`UNIQUE\` do e-mail recusa a segunda linha — a constraint pegou a inconsistência na hora da migração. A subconsulta correlacionada escolhe, para cada e-mail, só a linha do pedido mais recente. (Também funcionam \`ROW_NUMBER() OVER (PARTITION BY cliente_email ORDER BY pedido_id DESC)\` ou um UPSERT processando os pedidos em ordem.)

Depois, cada pedido descobre o \`id\` gerado para o seu cliente por um JOIN pela **chave natural** (\`email\`). Repare que o nome nunca serve de chave: existem duas "Ana Souza" diferentes nos dados ocultos.`,
        reviews: [
          {
            when: sql => /insert\s+or\s+replace|\breplace\s+into/i.test(sql),
            text: '`INSERT OR REPLACE` resolve o conflito **apagando** a linha antiga e inserindo outra — com um `id` novo. Numa tabela que já tem filhos, isso quebra referências ou dispara `ON DELETE CASCADE`. Prefira escolher a linha certa (MAX, `ROW_NUMBER`) ou usar `ON CONFLICT ... DO UPDATE`.',
            concept: 'Chave substituta',
          },
        ],
        hints: [
          'O `DISTINCT` devolve duas linhas para a Ana (Recife e Olinda), e o `UNIQUE` do e-mail reclama. Você precisa escolher **uma linha por e-mail**.',
          'Uma subconsulta correlacionada acha o pedido mais recente de cada e-mail: `WHERE pedido_id = (SELECT MAX(pedido_id) FROM planilha_pedidos WHERE cliente_email = p.cliente_email)`.',
          'Para os pedidos, junte a planilha com `clientes` pelo **e-mail** e use o `id` gerado: `INSERT INTO pedidos (id, cliente_id, total) SELECT p.pedido_id, c.id, p.total FROM planilha_pedidos p JOIN clientes c ON c.email = p.cliente_email;`',
        ],
      },
      {
        type: 'mcq',
        id: 'db-mod-q4',
        concept: 'Chave natural × substituta',
        say: 'Discussão clássica de revisão de schema. Qual é a melhor resposta?',
        prompt: 'Você está modelando `usuarios`, e um colega propõe: "o e-mail já é único, então vamos usá-lo como **chave primária** — e como chave estrangeira em `pedidos`, `enderecos` e `sessoes`". Qual é a melhor resposta?',
        options: [
          { text: 'Boa ideia: a chave natural evita uma coluna extra e já garante a unicidade.', why: 'Garante unicidade, mas e-mail **muda**: trocar a PK exigiria atualizar todas as FKs das tabelas filhas. E ainda espalha dado pessoal por todo o banco.' },
          { text: 'Usar um `id` substituto como PK, manter `email` com `UNIQUE NOT NULL` e fazer as FKs apontarem para o `id`.', correct: true, why: 'A PK fica estável e pequena; a regra "e-mail único" continua garantida pelo `UNIQUE`; e trocar o e-mail vira o `UPDATE` de uma linha só.' },
          { text: 'Usar um `id` substituto como PK e **não** declarar nada no e-mail: a aplicação confere se ele já existe antes de inserir.', why: 'Conferir na aplicação é *check-then-act*: duas requisições simultâneas passam pela checagem e criam duplicatas. Quem garante unicidade é a constraint `UNIQUE`.' },
          { text: 'Usar um UUID v4 como PK, porque é o único jeito de evitar colisões.', why: 'Autoincremento também não colide dentro de um banco. UUID ajuda a gerar ids fora do banco, mas o v4 é aleatório e espalha inserções no índice (prefira o v7). E continuaria faltando o `UNIQUE` no e-mail.' },
        ],
        explanation: 'Chave substituta como PK + chave natural protegida por `UNIQUE` é o padrão mais seguro: estabilidade para as referências e a regra de negócio garantida **pelo banco**, não pela aplicação. A chave natural como PK faz sentido em tabelas de referência estáveis, como códigos de país ou de moeda.',
      },
      {
        type: 'code',
        id: 'db-mod-q5',
        concept: 'N+1',
        title: 'Acabando com o N+1',
        say: 'Hora de caçar um N+1 de verdade. Os testes contam **cada** comando SQL que chega ao banco!',
        prompt: `A função abaixo monta o resumo da página inicial do blog: para cada post, o **título**, o **nome do autor** e a **quantidade de comentários**. Ela funciona... mas faz \`2N + 1\` consultas: 1 para os posts e mais 2 por post.

Reescreva \`resumo_posts(conn)\` para fazer **uma única consulta** ao banco.

- Devolva uma **lista de tuplas** \`(titulo, nome_do_autor, qtd_comentarios)\`, ordenada pelo \`id\` do post.
- Posts **sem comentários** aparecem com \`0\`.
- Tabelas: \`autores(id, nome)\`, \`posts(id, autor_id, titulo)\` e \`comentarios(id, post_id, texto)\`.

Nos testes, \`conn\` é um *wrapper* que repassa tudo para a conexão \`sqlite3\` real e registra cada comando SQL executado — o mesmo truque do \`assertNumQueries\` do Django:

\`\`\`python
class ConexaoContadora:
    def __init__(self, conn):
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "consultas", [])
        conn.set_trace_callback(self.consultas.append)  # chamado a cada comando SQL

    def __getattr__(self, nome):          # execute, cursor... vão para a conexão real
        return getattr(self._conn, nome)

    def __setattr__(self, nome, valor):   # ex.: conn.row_factory = sqlite3.Row
        setattr(self._conn, nome, valor)
\`\`\``,
        starter: `def resumo_posts(conn):
    resumo = []
    posts = conn.execute("SELECT id, autor_id, titulo FROM posts ORDER BY id").fetchall()
    for post_id, autor_id, titulo in posts:
        # N+1: duas consultas extras POR post
        autor = conn.execute("SELECT nome FROM autores WHERE id = ?", (autor_id,)).fetchone()[0]
        qtd = conn.execute("SELECT COUNT(*) FROM comentarios WHERE post_id = ?", (post_id,)).fetchone()[0]
        resumo.append((titulo, autor, qtd))
    return resumo
`,
        tests: [
          {
            name: 'mesmo resultado da versão N+1',
            setup: SETUP_BLOG,
            code: 'conn = _novo_banco()\nesperado = _esperado(conn)\nobtido = [tuple(linha) for linha in resumo_posts(ConexaoContadora(conn))]\nassert obtido == esperado, f"esperado {esperado}, obtido {obtido}"',
          },
          {
            name: 'faz uma única consulta',
            setup: SETUP_BLOG,
            code: 'cc = ConexaoContadora(_novo_banco())\nresumo_posts(cc)\nassert len(cc.consultas) == 1, f"sua função executou {len(cc.consultas)} consultas (esperado: 1): {cc.consultas}"',
          },
          {
            name: 'post sem comentários aparece com 0',
            setup: SETUP_BLOG,
            code: 'obtido = [tuple(linha) for linha in resumo_posts(ConexaoContadora(_novo_banco()))]\nassert ("MVCC sem mistério", "Ana", 0) in obtido, f"o post 3 não tem comentários e deveria aparecer com 0; obtido {obtido}"',
          },
          {
            name: 'blog sem posts devolve lista vazia',
            setup: SETUP_BLOG,
            code: 'conn = _novo_banco()\nconn.execute("DELETE FROM comentarios")\nconn.execute("DELETE FROM posts")\nobtido = [tuple(linha) for linha in resumo_posts(ConexaoContadora(conn))]\nassert obtido == [], f"sem posts, o resumo deveria ser [], obtido {obtido}"',
          },
          {
            name: '54 posts: continua 1 consulta',
            hidden: true,
            setup: SETUP_BLOG,
            code: 'conn = _novo_banco(extras=50)\nesperado = _esperado(conn)\ncc = ConexaoContadora(conn)\nobtido = [tuple(linha) for linha in resumo_posts(cc)]\nassert obtido == esperado, "com mais posts, o resultado não bateu com o da versão N+1"\nassert len(cc.consultas) == 1, f"com 54 posts sua função executou {len(cc.consultas)} consultas"',
          },
        ],
        reviews: [
          {
            when: (m, code) => /select\s+\*/i.test(code),
            text: 'Evite `SELECT *`: traga só as colunas que a tela usa — menos dados trafegando, chance de *covering index* e nada quebra quando alguém adicionar uma coluna.',
            concept: 'Covering index',
          },
          {
            when: (m, code) => /execute\(\s*f["']/.test(code) || /\.format\(/.test(code),
            text: 'Você montou SQL com f-string/`format`. Use placeholders (`?`): concatenar valores no SQL abre espaço para **SQL injection** e impede o banco de reaproveitar a consulta preparada.',
            concept: 'SQL injection',
          },
        ],
        hints: [
          'Uma consulta só: comece com `FROM posts p JOIN autores a ON a.id = p.autor_id` — isso já resolve o nome do autor.',
          'Para contar os comentários: `LEFT JOIN comentarios c ON c.post_id = p.id` + `GROUP BY`. Use `COUNT(c.id)`, e não `COUNT(*)`: ele ignora o NULL que o LEFT JOIN cria para posts sem comentários.',
          'Alternativa sem GROUP BY: uma subconsulta na lista do SELECT, `(SELECT COUNT(*) FROM comentarios c WHERE c.post_id = p.id)`. Continua sendo **uma** consulta enviada ao banco.',
        ],
        solution: `def resumo_posts(conn):
    sql = """
        SELECT p.titulo, a.nome, COUNT(c.id) AS qtd_comentarios
        FROM posts AS p
        JOIN autores AS a ON a.id = p.autor_id
        LEFT JOIN comentarios AS c ON c.post_id = p.id
        GROUP BY p.id, p.titulo, a.nome
        ORDER BY p.id
    """
    return [tuple(linha) for linha in conn.execute(sql)]
`,
        solutionExplanation: 'Um único `SELECT` resolve os dois relacionamentos: o `JOIN` traz o autor (relação "para um") e o `LEFT JOIN` + `GROUP BY` conta os comentários (relação "para muitos") sem perder os posts sem comentário — `COUNT(c.id)` ignora os `NULL` criados pelo `LEFT JOIN`, enquanto `COUNT(*)` contaria 1. Agora o número de consultas não depende do número de posts: é **1**, sejam 4 ou 4 mil. Se você precisasse contar comentários **e** curtidas, dois `LEFT JOIN` multiplicariam as linhas (explosão cartesiana): aí use subconsultas ou `COUNT(DISTINCT ...)`.',
      },
      {
        type: 'open',
        id: 'db-mod-q6',
        concept: 'Desnormalização',
        say: 'Para fechar, uma decisão de trade-off. Explique como faria numa revisão de design.',
        prompt: 'A página de um produto mostra a **nota média** e o **total de avaliações**, calculados com `AVG` e `COUNT` sobre a tabela `avaliacoes` a cada visita — e ficou lenta. Você decide desnormalizar. O que você guardaria, como manteria os dados consistentes e qual risco aceitaria?',
        minWords: 30,
        rubric: [
          {
            label: 'Propõe **guardar o valor pronto** (colunas de contador/soma, view materializada ou cache)',
            keywords: ['coluna', 'contador', 'pre-calcul', 'precalcul', 'pre calcul', 'materializ', 'cache', 'guardar', 'armazenar', 'soma', 'total_avaliacoes', 'qtd_avaliacoes'],
            concept: 'Desnormalização',
            why: 'Desnormalizar é gravar o resultado pronto para a leitura não precisar recalcular.',
          },
          {
            label: 'Define **como sincronizar**: mesma transação, trigger, job ou evento',
            keywords: ['transacao', 'trigger', 'gatilho', 'job', 'evento', 'fila', 'refresh', 'mesma operacao'],
            concept: 'Desnormalização',
            why: 'Toda cópia precisa de um "dono" que a mantenha em dia — senão ela diverge.',
          },
          {
            label: 'Aponta o risco de **inconsistência** / dado desatualizado',
            keywords: ['inconsist', 'desatualiz', 'diverg', 'dessincron', 'fora de sincronia', 'stale', 'errad', 'reconcilia'],
            concept: 'Anomalias',
            why: 'Qualquer caminho que altere avaliações sem atualizar o contador deixa o dado errado.',
          },
          {
            label: 'Considera **concorrência** e o custo extra na **escrita**',
            keywords: ['concorren', 'escrita', 'lost update', 'atomic', 'lock', 'contencao', 'linha quente', 'hot row', 'simultane'],
            concept: 'Custo da desnormalização',
            why: 'Duas avaliações ao mesmo tempo podem perder um incremento se o UPDATE não for atômico.',
          },
        ],
        modelAnswer: `Eu guardaria em \`produtos\` duas colunas desnormalizadas: \`qtd_avaliacoes\` e \`soma_notas\` — a média vira \`soma_notas / qtd_avaliacoes\` na leitura. Guardar a **soma** (e não a média) permite atualizar de forma incremental.

Para manter a consistência, o \`INSERT\` da avaliação e o \`UPDATE produtos SET qtd_avaliacoes = qtd_avaliacoes + 1, soma_notas = soma_notas + ?\` rodariam na **mesma transação** (ou num trigger). O incremento é **atômico**, relativo ao valor atual, para que duas avaliações **concorrentes** não percam uma atualização.

O risco é a **inconsistência**: qualquer caminho que altere avaliações sem passar por essa lógica — um script manual, uma exclusão, um bug — deixa o contador desatualizado. Por isso eu teria um job de reconciliação que recalcula os valores periodicamente. Também aceito o custo extra em cada **escrita** e a disputa pela linha do produto em momentos de pico.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Resumindo: redundância gera **anomalias**; as formas normais eliminam dependências parciais e transitivas; desnormalizar é uma decisão **medida** e com dono.',
          'Chave substituta como PK com `UNIQUE` na natural — e N+1 se resolve com JOIN, IN ou batching, **contando consultas** nos testes. Próxima parada: transações!',
        ],
        board: null,
      },
    ],
  });
})();
