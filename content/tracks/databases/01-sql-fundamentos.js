(function () {
  // Catálogo da loja (paginação). `nome` é único: serve de desempate total.
  const CATALOGO = `CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  preco REAL NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);
INSERT INTO produtos (id, nome, preco, ativo) VALUES
  (1, 'Teclado mecânico', 350.00, 1),
  (2, 'Mouse sem fio', 120.00, 1),
  (3, 'Monitor 27 pol.', 1500.00, 1),
  (4, 'Headset gamer', 350.00, 1),
  (5, 'Webcam HD', 900.00, 0),
  (6, 'Hub USB-C', 120.00, 1);`;

  // Clientes e pedidos (LEFT JOIN).
  const CLIENTES_PEDIDOS = `CREATE TABLE clientes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  criado_em TEXT NOT NULL,
  status TEXT NOT NULL
);
INSERT INTO clientes (id, nome, cidade) VALUES
  (1, 'Ana', 'Recife'),
  (2, 'Bruno', 'Curitiba'),
  (3, 'Carla', 'Recife'),
  (4, 'Davi', 'Belém');
INSERT INTO pedidos (id, cliente_id, criado_em, status) VALUES
  (10, 1, '2024-03-01', 'pago'),
  (11, 1, '2024-03-04', 'cancelado'),
  (12, 2, '2024-03-05', 'cancelado'),
  (13, 1, '2024-03-09', 'pago'),
  (14, 4, '2024-03-10', 'pago'),
  (15, 4, '2024-03-12', 'pendente');`;

  // Produtos, pedidos e itens (anti-join).
  const VENDAS = `CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  preco REAL NOT NULL
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE itens_pedido (
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL,
  PRIMARY KEY (pedido_id, produto_id)
);
INSERT INTO produtos (id, nome, preco) VALUES
  (1, 'Teclado mecânico', 350.00),
  (2, 'Mouse sem fio', 120.00),
  (3, 'Monitor 27 pol.', 1500.00),
  (4, 'Headset gamer', 350.00),
  (5, 'Webcam HD', 900.00),
  (6, 'Hub USB-C', 120.00);
INSERT INTO pedidos (id, cliente_id, criado_em, status) VALUES
  (10, 1, '2024-03-01', 'pago'),
  (11, 2, '2024-03-02', 'cancelado'),
  (12, 3, '2024-03-05', 'enviado'),
  (13, 1, '2024-03-07', 'pendente');
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade) VALUES
  (10, 1, 1),
  (10, 2, 2),
  (11, 5, 1),
  (11, 6, 1),
  (12, 2, 1),
  (13, 6, 3);`;

  Game.registerModule('databases', {
    id: 'sql-fundamentos',
    title: 'SQL essencial: consultas e JOINs',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'sql',
    summary: 'SELECT, filtros, ordenação, paginação e JOINs — e a ordem em que o banco realmente avalia cada cláusula.',
    concepts: ['SELECT/WHERE/ORDER BY', 'Ordem lógica de execução', 'INNER × LEFT JOIN', 'Anti-join', 'Paginação determinística'],
    takeaways: [
      'SQL é **declarativo**: você descreve o resultado e o otimizador escolhe o caminho. Sem `ORDER BY`, a ordem das linhas **não é garantida**.',
      'A ordem **lógica** é FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT: por isso um alias do SELECT não existe no WHERE, mas existe no ORDER BY.',
      '`INNER JOIN` só devolve os pares que casam; `LEFT JOIN` preserva todas as linhas da esquerda e preenche a direita com NULL.',
      'Filtrar a tabela da **direita** no `WHERE` desfaz o LEFT JOIN (vira INNER): a condição sobre a tabela opcional vai no `ON`.',
      'Para "quem **não** tem", use um anti-join com `NOT EXISTS`. E paginação precisa de um `ORDER BY` com desempate **único**.',
    ],
    glossary: [
      {
        term: 'Ordem lógica de execução',
        aliases: ['ordem lógica', 'ordem logica', 'ordem de avaliação', 'logical query processing'],
        definition: 'Sequência em que as cláusulas são **avaliadas**: FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. Explica por que um alias do SELECT não existe no WHERE. Fisicamente o otimizador pode fazer diferente, desde que o resultado seja o mesmo.',
      },
      {
        term: 'LEFT JOIN',
        aliases: ['left outer join', 'outer join', 'junção externa'],
        definition: 'Junção que mantém **todas** as linhas da tabela da esquerda; quando não há par na direita, as colunas da direita vêm como NULL.',
      },
      {
        term: 'Anti-join',
        aliases: ['anti join', 'antijoin', 'anti-joins'],
        definition: 'Devolve as linhas da esquerda **sem** correspondente na direita ("clientes que nunca compraram"). Em SQL: `NOT EXISTS (...)` ou `LEFT JOIN ... WHERE direita.id IS NULL`.',
      },
      {
        term: 'Semi-join',
        aliases: ['semi join', 'semijoin', 'semi-joins'],
        definition: 'Devolve as linhas da esquerda que **têm** pelo menos um par na direita, sem repeti-las — é o que `EXISTS` e `IN (subconsulta)` fazem, ao contrário do JOIN, que repete a linha para cada par.',
      },
      {
        term: 'Produto cartesiano',
        aliases: ['cross join', 'cartesian product', 'produtos cartesianos'],
        definition: 'Combinação de **cada** linha de uma tabela com cada linha da outra (N × M linhas). É o `CROSS JOIN` — ou o que acontece sem querer quando falta a condição de junção.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à trilha de bancos de dados! Vamos começar pelo idioma que todo banco relacional fala: o **SQL**.',
          'E aqui é SQL **de verdade**: um SQLite roda no seu navegador, e tudo o que você escrever vai ser executado.',
        ],
        board: {
          title: 'Nossa loja de exemplo',
          md: `As aulas desta unidade usam sempre a mesma **loja virtual**:

\`\`\`text
clientes (id, nome, cidade)
   │ 1        um cliente faz N pedidos
   ▼ N
pedidos (id, cliente_id, criado_em, status, total)
   │ 1        um pedido tem N itens
   ▼ N
itens_pedido (pedido_id, produto_id, quantidade, preco_unit)
   ▲ N        um produto aparece em N itens
   │ 1
produtos (id, nome, categoria_id, preco, ativo) ──N:1──▶ categorias (id, nome, pai_id)
\`\`\`

- **Chave primária** (\`id\`): identifica cada linha. **Chave estrangeira** (\`cliente_id\`, \`produto_id\`…): aponta para uma linha de outra tabela.
- Cada questão mostra só as tabelas e colunas de que precisa.

SQL é **declarativo**: você descreve *o resultado*, e o banco decide *como* chegar nele.

\`\`\`python
# Python (imperativo): você diz COMO
caros = []
for p in produtos:          # percorre tudo
    if p.preco > 100:       # filtra
        caros.append(p.nome)
caros.sort()                # ordena
\`\`\`

\`\`\`sql
-- SQL (declarativo): você diz O QUÊ
SELECT nome FROM produtos WHERE preco > 100 ORDER BY nome;
\`\`\`

> [!dica] Quem escolhe o *como* é o **otimizador**: ler a tabela inteira ou usar um índice, em que ordem juntar as tabelas… O resultado é o mesmo; a velocidade, não. (Índices e planos de execução têm um módulo só deles.)`,
        },
      },
      {
        type: 'say',
        text: [
          'O esqueleto de quase toda consulta: **SELECT** escolhe as colunas, **WHERE** filtra as linhas, **ORDER BY** ordena e **LIMIT** corta.',
          { text: 'Um detalhe que pega muita gente: sem `ORDER BY`, a ordem das linhas é **indefinida**. Pode mudar de uma execução para outra.', mood: 'concerned' },
        ],
        board: {
          title: 'SELECT, WHERE, ORDER BY e LIMIT',
          md: `\`\`\`sql
SELECT id, nome, preco               -- projeção: quais colunas
FROM produtos                        -- de onde vêm as linhas
WHERE ativo = 1                      -- filtro de linhas
  AND preco BETWEEN 50 AND 200       -- inclusivo nas duas pontas
ORDER BY preco DESC, nome            -- ordena; o nome desempata
LIMIT 10 OFFSET 20;                  -- 3ª página de 10 itens
\`\`\`

| Filtro | Exemplo | Observação |
|---|---|---|
| Comparação | \`preco >= 100\`, \`status <> 'cancelado'\` | \`<>\` é o padrão; \`!=\` também funciona |
| Lista | \`status IN ('pago', 'enviado')\` | atalho para vários \`OR\` |
| Intervalo de datas | \`criado_em >= '2024-03-01' AND criado_em < '2024-04-01'\` | semiaberto: \`BETWEEN '2024-03-01' AND '2024-03-31'\` perderia \`'2024-03-31 18:00'\` |
| Padrão de texto | \`nome LIKE 'Mouse%'\` | \`%\` = qualquer sequência, \`_\` = um caractere |
| Ausência de valor | \`cidade IS NULL\` | **nunca** \`= NULL\` (o próximo módulo explica por quê) |

- Datas em texto no formato ISO (\`'2024-03-01 10:15'\`) comparam e ordenam corretamente como strings — é assim que o SQLite costuma guardá-las.
- NULL no \`ORDER BY\`: no SQLite e no MySQL ele é o **menor** valor (vem primeiro no ASC); no PostgreSQL e no Oracle, o **maior**. Deixe explícito com \`NULLS FIRST\` / \`NULLS LAST\`.

> [!atencao] Paginação precisa de uma ordem **total**. Com \`ORDER BY preco\`, produtos de mesmo preço podem trocar de lugar entre uma página e outra — o usuário vê itens repetidos e outros somem. Termine o \`ORDER BY\` com uma coluna **única** (o \`id\` ou um nome único).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora um segredo que muda o jeito de ler SQL: o banco **não** avalia a consulta na ordem em que você escreve.',
          'Você começa escrevendo o SELECT, mas logicamente ele é um dos **últimos** passos.',
        ],
        board: {
          title: 'A ordem lógica de execução',
          md: `\`\`\`text
 Ordem em que você ESCREVE        Ordem LÓGICA de avaliação
 ─────────────────────────        ──────────────────────────────────────────
 SELECT   ...                     1. FROM / JOIN   monta as linhas de origem
 FROM     ...                     2. WHERE         filtra linhas
 WHERE    ...                     3. GROUP BY      forma os grupos
 GROUP BY ...                     4. HAVING        filtra grupos
 HAVING   ...                     5. SELECT        calcula colunas e aliases (+ DISTINCT)
 ORDER BY ...                     6. ORDER BY      ordena
 LIMIT    ...                     7. LIMIT/OFFSET  corta
\`\`\`

Cada passo só enxerga o que os anteriores produziram:

| Consequência | Exemplo | Por quê |
|---|---|---|
| Alias do SELECT **não** existe no WHERE | \`SELECT preco * 0.9 AS promo ... WHERE promo < 50\` → erro no PostgreSQL | o WHERE (2) roda antes do SELECT (5) |
| Alias **existe** no ORDER BY | \`... ORDER BY promo\` ✅ | o ORDER BY (6) vem depois do SELECT |
| Agregação não vai no WHERE | \`WHERE COUNT(*) > 2\` → erro | os grupos só nascem no passo 3; filtro de grupo é no \`HAVING\` |
| LIMIT corta **depois** de ordenar | \`ORDER BY preco DESC LIMIT 3\` | são os 3 mais caros, não "3 quaisquer, ordenados" |

> [!sabia] Essa sequência se chama **ordem lógica de processamento** (*logical query processing*) e define o **significado** da consulta — não a execução física: o otimizador pode empurrar filtros para dentro de um join ou usar um índice para nem precisar ordenar, desde que o resultado seja o mesmo. As *window functions*, que você verá daqui a dois módulos, são calculadas no passo 5, depois do HAVING: por isso também não podem aparecer no WHERE.

> [!atencao] O SQLite é permissivo e aceita alias do SELECT no WHERE e no GROUP BY, como extensão. Não se acostume: PostgreSQL, SQL Server e Oracle recusam (o MySQL aceita no GROUP BY e no HAVING, mas não no WHERE).`,
        },
      },
      {
        type: 'say',
        text: [
          'Dados relacionais vivem **espalhados** em tabelas. O **JOIN** junta as linhas que se correspondem.',
          'Com **INNER JOIN**, só sobrevivem os pares que casam dos dois lados. Quem não tem par some do resultado.',
        ],
        board: {
          title: 'INNER JOIN: só o que casa',
          md: `\`\`\`sql
SELECT c.nome, p.id AS pedido, p.status
FROM clientes AS c
JOIN pedidos AS p ON p.cliente_id = c.id;   -- JOIN sozinho = INNER JOIN
\`\`\`

| clientes | | pedidos | | |
|---|---|---|---|---|
| **id** | **nome** | **id** | **cliente_id** | **status** |
| 1 | Ana | 10 | 1 | pago |
| 2 | Bruno | 11 | 1 | cancelado |
| 3 | Carla | 12 | 2 | pago |

Resultado:

| nome | pedido | status |
|---|---|---|
| Ana | 10 | pago |
| Ana | 11 | cancelado |
| Bruno | 12 | pago |

- **Carla some**: não tem nenhum pedido para casar.
- **Ana aparece duas vezes**: juntar uma relação 1:N **multiplica** as linhas do lado "1". Lembre disso quando for somar — é assunto do próximo módulo.
- Esqueceu a condição do \`ON\`? Vira **produto cartesiano**: 1.000 clientes × 50.000 pedidos = 50 milhões de linhas.

> [!dica] Prefira a sintaxe explícita \`JOIN ... ON\` à antiga \`FROM clientes c, pedidos p WHERE p.cliente_id = c.id\`: a regra de junção fica separada dos filtros, e esquecer uma condição salta aos olhos.`,
        },
      },
      {
        type: 'say',
        text: [
          'Quando você precisa de **todos** os clientes, inclusive os sem pedido, entra o **LEFT JOIN**: sem par, as colunas da direita vêm como NULL.',
          { text: 'E aqui mora o erro mais clássico de SQL: filtrar a tabela da **direita** no WHERE. Isso transforma o LEFT JOIN num INNER JOIN, em silêncio.', mood: 'concerned' },
        ],
        board: {
          title: 'LEFT JOIN e o filtro no lugar errado',
          md: `Objetivo: **todos os clientes** e seus pedidos **pagos** (NULL para quem não tem).

\`\`\`sql
-- ❌ ERRADO: quem não tem pedido pago some do resultado
SELECT c.nome, p.id
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
WHERE p.status = 'pago';

-- ✅ CERTO: a condição sobre a tabela da direita vai no ON
SELECT c.nome, p.id
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
                   AND p.status = 'pago';
\`\`\`

Por que o primeiro falha? Siga a **ordem lógica**:

1. O LEFT JOIN gera \`(Carla, NULL)\` para quem não tem par.
2. O WHERE roda **depois** e testa \`NULL = 'pago'\` — que não é verdadeiro. A linha é descartada.
3. Sobram só as linhas com par: exatamente um INNER JOIN.

| Onde fica o filtro | Efeito num LEFT JOIN |
|---|---|
| No \`ON\` | decide **quais linhas da direita** casam; a esquerda é sempre preservada |
| No \`WHERE\` | filtra o **resultado final**; testar coluna da direita derruba as linhas com NULL |

> [!atencao] O "conserto" \`WHERE p.status = 'pago' OR p.id IS NULL\` também está errado: quem só tem pedido **cancelado** ganha uma linha com \`status = 'cancelado'\` (não é NULL, não é pago) e continua sumindo.

> [!dica] Filtros sobre a tabela da **esquerda** (ex.: \`c.cidade = 'Recife'\`) podem ficar no WHERE sem problema. A regra é sobre a tabela **opcional** do join.`,
        },
      },
      {
        type: 'say',
        text: [
          'Uma pergunta muito comum: "quem **não** tem"? Clientes que nunca compraram, produtos que nunca venderam.',
          'Isso tem nome: **anti-join**. E o contrário, "quem tem pelo menos um", é o **semi-join**.',
        ],
        board: {
          title: 'Anti-join e semi-join',
          md: `\`\`\`sql
-- Anti-join com NOT EXISTS: clientes sem nenhum pedido
SELECT c.id, c.nome
FROM clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id   -- subconsulta correlacionada
);

-- Anti-join com LEFT JOIN: mantém todos e fica só com os sem par
SELECT c.id, c.nome
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
WHERE p.id IS NULL;          -- aqui o WHERE na direita é PROPOSITAL

-- Semi-join: clientes com pelo menos um pedido (cada um aparece uma vez)
SELECT c.id, c.nome
FROM clientes c
WHERE EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id);
\`\`\`

| Forma do anti-join | Observação |
|---|---|
| \`NOT EXISTS\` | a mais clara e segura; o banco para no primeiro par encontrado |
| \`LEFT JOIN ... IS NULL\` | equivalente; teste uma coluna **NOT NULL** da direita (a chave primária) |
| \`NOT IN (subconsulta)\` | ⚠️ esconde uma armadilha com NULL — assunto do próximo módulo |

- **EXISTS × JOIN**: o JOIN repete o cliente para cada pedido (e aí aparece um \`DISTINCT\` "para consertar"); o \`EXISTS\` só pergunta "existe?".
- O \`SELECT 1\` dentro do \`EXISTS\` é convenção: as colunas da subconsulta não importam, só se ela devolve alguma linha.

> [!sabia] **Semi-join** (⋉) e **anti-join** (▷) são operadores da álgebra relacional, e os otimizadores reconhecem esses padrões: no \`EXPLAIN\` do PostgreSQL aparecem nós como \`Hash Semi Join\` e \`Hash Anti Join\` — sinal de que o banco entendeu a intenção e pode parar no primeiro par, sem montar o join inteiro.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Ordem lógica, paginação, LEFT JOIN e anti-join.', icon: '🎯' },
      {
        type: 'order',
        id: 'db-sql-q1',
        concept: 'Ordem lógica de execução',
        say: 'Aquecimento: a ordem em que o banco realmente avalia as cláusulas.',
        prompt: 'Coloque as cláusulas na **ordem lógica** em que o banco as avalia — não na ordem em que você escreve.',
        items: ['`FROM` / `JOIN`', '`WHERE`', '`GROUP BY`', '`HAVING`', '`SELECT`', '`ORDER BY`', '`LIMIT`'],
        explanation: 'Primeiro o banco monta as linhas de origem (FROM/JOIN), filtra linhas (WHERE), forma grupos (GROUP BY), filtra grupos (HAVING), calcula as colunas de saída e seus aliases (SELECT, com DISTINCT e window functions), ordena (ORDER BY) e só então corta (LIMIT). Daí as regras práticas: alias do SELECT não existe no WHERE, agregação se filtra no HAVING e o LIMIT sempre age sobre o resultado já ordenado.',
      },
      {
        type: 'mcq',
        id: 'db-sql-q2',
        concept: 'Ordem lógica de execução',
        multiple: true,
        say: 'Agora, as consequências dessa ordem. Pense como o PostgreSQL, que segue o padrão à risca.',
        prompt: 'Quais consultas dão **erro** no PostgreSQL (SQL padrão)? Marque **todas**.',
        options: [
          { text: '`SELECT nome, preco * 0.9 AS promo FROM produtos WHERE promo < 50`', correct: true, why: 'O WHERE é avaliado antes do SELECT: o alias `promo` ainda não existe. Repita a expressão (`WHERE preco * 0.9 < 50`) ou use uma subconsulta. O SQLite aceita como extensão — não conte com isso.' },
          { text: '`SELECT nome, preco * 0.9 AS promo FROM produtos ORDER BY promo`', why: 'Válida: o ORDER BY vem depois do SELECT, então o alias já existe.' },
          { text: '`SELECT categoria_id, COUNT(*) FROM produtos WHERE COUNT(*) > 2 GROUP BY categoria_id`', correct: true, why: 'Agregação no WHERE é erro: quando o WHERE roda, os grupos nem existem. Filtro de grupo é `HAVING COUNT(*) > 2`.' },
          { text: '`SELECT categoria_id, COUNT(*) AS qtd FROM produtos GROUP BY categoria_id HAVING COUNT(*) > 2`', why: 'Válida: o HAVING é justamente o filtro que roda depois do GROUP BY.' },
          { text: '`SELECT nome FROM produtos ORDER BY preco DESC LIMIT 3`', why: 'Válida: dá para ordenar por uma coluna que não está no SELECT (exceto com `DISTINCT`), e o LIMIT corta depois de ordenar — são os 3 mais caros.' },
        ],
        explanation: 'Leia a consulta na ordem lógica: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. O que nasce num passo só pode ser usado nos seguintes: aliases nascem no SELECT (e servem no ORDER BY); grupos nascem no GROUP BY (e se filtram no HAVING).',
      },
      {
        type: 'sql',
        id: 'db-sql-q3',
        concept: 'Paginação determinística',
        title: 'Página 2 do catálogo',
        say: 'Primeiro SQL! Uma listagem paginada — e o desempate faz toda a diferença.',
        prompt: `A vitrine mostra os **produtos ativos** do mais caro para o mais barato, **3 por página**. Produtos com o **mesmo preço** aparecem em ordem **alfabética de nome**.

Escreva a consulta da **página 2**, com as colunas \`id\`, \`nome\` e \`preco\`, já na ordem em que devem aparecer na tela.`,
        schema: CATALOGO,
        variants: [
          `INSERT INTO produtos (id, nome, preco, ativo) VALUES
  (7, 'Cadeira ergonômica', 2100.00, 1),
  (8, 'Suporte articulado', 350.00, 1),
  (9, 'SSD 1 TB', 480.00, 0),
  (10, 'Cabo HDMI', 120.00, 1);`,
          `UPDATE produtos SET preco = 120.00 WHERE id = 3;
UPDATE produtos SET ativo = 1 WHERE id = 5;`,
        ],
        orderMatters: true,
        starter: `-- Vitrine: ativos, do mais caro ao mais barato, 3 por página.
-- Empate de preço: ordem alfabética de nome.
SELECT id, nome, preco
FROM produtos
ORDER BY preco DESC;
`,
        solution: `SELECT id, nome, preco
FROM produtos
WHERE ativo = 1
ORDER BY preco DESC, nome
LIMIT 3 OFFSET 3;`,
        solutionExplanation: `Três ingredientes: o filtro \`ativo = 1\`, um \`ORDER BY\` **total** e o corte da página.

- \`ORDER BY preco DESC, nome\`: sem o \`nome\`, a ordem entre produtos de mesmo preço fica por conta do banco — e pode mudar entre a consulta da página 1 e a da página 2, repetindo ou escondendo itens.
- Página *n* com *k* itens: \`LIMIT k OFFSET (n - 1) * k\` → \`LIMIT 3 OFFSET 3\`.

Para páginas profundas, \`OFFSET\` fica caro: o banco lê e descarta todas as linhas anteriores. A alternativa é a **paginação por cursor** (*keyset*): lembrar o último item visto e pedir "os próximos depois dele" — \`WHERE (preco < ? OR (preco = ? AND nome > ?))\`, com um índice que siga a mesma ordem.`,
        reviews: [
          {
            when: sql => /limit\s+\d+\s*,\s*\d+/i.test(sql),
            text: 'Você usou `LIMIT 3, 3`. Funciona no SQLite e no MySQL, mas é fácil de ler ao contrário (o **primeiro** número é o OFFSET!) e não existe no PostgreSQL. Prefira `LIMIT 3 OFFSET 3`.',
            concept: 'Paginação determinística',
          },
        ],
        hints: [
          'Três partes: filtre só os **ativos** (`WHERE`), ordene por preço **decrescente** com desempate por nome e pule a primeira página.',
          'A página *n* com *k* itens começa depois de `(n - 1) × k` linhas: `LIMIT 3 OFFSET 3`.',
          '`ORDER BY preco DESC, nome` — sem o `nome`, a ordem entre produtos de mesmo preço fica por conta do banco.',
        ],
      },
      {
        type: 'sql',
        id: 'db-sql-q4',
        concept: 'LEFT JOIN',
        title: 'Todos os clientes e seus pedidos pagos',
        say: 'Agora o clássico. Um colega escreveu esta consulta e alguns clientes sumiram do relatório.',
        prompt: `O time de CRM quer **todos os clientes** e, para cada um, os pedidos com status \`'pago'\`: colunas \`nome\` (do cliente) e \`id\` (do pedido).

- Cliente com vários pedidos pagos aparece uma vez para cada um.
- Cliente **sem nenhum pedido pago** aparece **uma vez**, com o pedido \`NULL\`.

O SQL que está no editor deixa clientes de fora. Conserte. (A ordem das linhas não importa.)`,
        schema: CLIENTES_PEDIDOS,
        variants: [
          `INSERT INTO clientes (id, nome, cidade) VALUES (5, 'Eva', 'Natal'), (6, 'Fábio', 'Recife');
INSERT INTO pedidos (id, cliente_id, criado_em, status) VALUES
  (16, 6, '2024-03-15', 'pendente'),
  (17, 3, '2024-03-16', 'pago'),
  (18, 2, '2024-03-18', 'pago');`,
          "UPDATE pedidos SET status = 'enviado' WHERE status = 'pago';",
        ],
        starter: `SELECT c.nome, p.id
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
WHERE p.status = 'pago';
`,
        solution: `SELECT c.nome, p.id
FROM clientes c
LEFT JOIN pedidos p
  ON p.cliente_id = c.id
 AND p.status = 'pago';`,
        solutionExplanation: `A condição sobre a tabela **opcional** (\`pedidos\`) foi para o \`ON\`. Assim ela decide quais pedidos casam com cada cliente, e o LEFT JOIN continua garantindo uma linha para todo cliente — com \`NULL\` quando nenhum pedido casou.

No \`WHERE\`, o filtro roda **depois** do join: a linha \`(Carla, NULL)\` é testada com \`NULL = 'pago'\`, que não é verdadeiro, e some. O falso conserto \`OR p.id IS NULL\` salva a Carla, mas não o Bruno: ele tem um pedido cancelado, então a linha dele tem \`status = 'cancelado'\` — nem pago, nem NULL.`,
        reviews: [
          {
            when: sql => /\bunion\b/i.test(sql),
            text: 'Funciona, mas o `UNION` (pagos + clientes sem pedido pago) lê as tabelas duas vezes e duplica a lógica. O LEFT JOIN com o filtro no `ON` resolve numa passada só.',
            concept: 'LEFT JOIN',
          },
          {
            when: sql => /\bright\s+(outer\s+)?join\b/i.test(sql),
            text: 'O `RIGHT JOIN` dá o resultado certo, mas a convenção é escrever primeiro a tabela **preservada** e usar LEFT JOIN: fica mais fácil de ler, e nem todo banco/ORM suporta RIGHT (o SQLite só ganhou na 3.39).',
            concept: 'LEFT JOIN',
          },
        ],
        hints: [
          'Rode o SQL do editor: quem sumiu? Carla não tem pedido nenhum, e Bruno só tem um pedido cancelado.',
          'O WHERE roda **depois** do JOIN. Para a Carla, `p.status` é NULL — e `NULL = \'pago\'` não é verdadeiro, então a linha é descartada.',
          'Leve a condição sobre `pedidos` para o `ON`: `LEFT JOIN pedidos p ON p.cliente_id = c.id AND p.status = \'pago\'`.',
        ],
      },
      {
        type: 'match',
        id: 'db-sql-q5',
        concept: 'INNER × LEFT JOIN',
        say: 'Rodada rápida: cada construção e o que ela devolve.',
        prompt: 'Associe cada construção ao que ela devolve (`dir` é a tabela da direita).',
        pairs: [
          { left: '`INNER JOIN`', right: 'Só as combinações que casam dos dois lados' },
          { left: '`LEFT JOIN`', right: 'Todas as linhas da esquerda, com NULL onde falta par' },
          { left: '`LEFT JOIN ... WHERE dir.id IS NULL`', right: 'Só as linhas da esquerda sem nenhum par' },
          { left: '`WHERE EXISTS (subconsulta)`', right: 'As linhas da esquerda com algum par, sem repeti-las' },
          { left: '`CROSS JOIN`', right: 'Cada linha de um lado com cada linha do outro' },
          { left: "`LEFT JOIN ... WHERE dir.status = 'pago'`", right: 'Na prática, um INNER JOIN disfarçado' },
        ],
        explanation: 'INNER guarda só os pares; LEFT preserva a esquerda e completa com NULL. Filtrar `dir.id IS NULL` depois de um LEFT JOIN é o **anti-join** ("quem não tem"); `EXISTS` é o **semi-join** ("quem tem", sem duplicar). CROSS JOIN é o produto cartesiano. E filtrar uma coluna comum da direita no WHERE descarta as linhas com NULL — o LEFT vira INNER.',
      },
      {
        type: 'sql',
        id: 'db-sql-q6',
        concept: 'Anti-join',
        title: 'Produtos encalhados',
        say: 'Última: um anti-join com uma condição a mais. Aqui o NOT EXISTS brilha.',
        prompt: `Liste \`id\` e \`nome\` dos produtos **encalhados**: os que **não** aparecem em nenhum item de um pedido **não cancelado**.

Um produto que só apareceu em pedidos **cancelados** também está encalhado — venda cancelada não é venda. (A ordem das linhas não importa.)`,
        schema: VENDAS,
        variants: [
          `INSERT INTO produtos (id, nome, preco) VALUES (7, 'Cabo HDMI', 45.00);
INSERT INTO pedidos (id, cliente_id, criado_em, status) VALUES
  (14, 4, '2024-03-09', 'cancelado'),
  (15, 2, '2024-03-10', 'pago');
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade) VALUES
  (14, 3, 1),
  (15, 4, 1),
  (15, 5, 2);`,
          "UPDATE pedidos SET status = 'cancelado';",
        ],
        starter: `SELECT pr.id, pr.nome
FROM produtos pr;
`,
        solution: `SELECT pr.id, pr.nome
FROM produtos pr
WHERE NOT EXISTS (
  SELECT 1
  FROM itens_pedido i
  JOIN pedidos pe ON pe.id = i.pedido_id
  WHERE i.produto_id = pr.id
    AND pe.status <> 'cancelado'
);`,
        solutionExplanation: `Para cada produto, o \`NOT EXISTS\` pergunta: "existe algum item deste produto num pedido não cancelado?". A subconsulta é **correlacionada** (\`i.produto_id = pr.id\`) e para no primeiro par encontrado.

Repare no Hub USB-C: ele está num pedido cancelado **e** num pendente, então vendeu. Por isso a versão com dois LEFT JOINs falha:

\`\`\`sql
-- ❌ lista o Hub: a linha do item cancelado sobra com pe.id NULL
SELECT pr.id, pr.nome
FROM produtos pr
LEFT JOIN itens_pedido i ON i.produto_id = pr.id
LEFT JOIN pedidos pe ON pe.id = i.pedido_id AND pe.status <> 'cancelado'
WHERE pe.id IS NULL;
\`\`\`

O LEFT JOIN avalia **cada item** separadamente; o que você quer saber é se existe **algum** item válido — exatamente a pergunta que o \`NOT EXISTS\` faz.`,
        reviews: [
          {
            when: sql => /not\s+in\s*\(\s*select/i.test(sql),
            text: 'Passou, mas `NOT IN (subconsulta)` esconde uma armadilha: se a subconsulta devolver **um único NULL**, o resultado fica vazio, sem erro. Aqui `produto_id` é NOT NULL e deu certo — no próximo módulo você vai ver por quê. Prefira `NOT EXISTS`.',
            concept: 'Anti-join',
          },
          {
            when: sql => /\bdistinct\b/i.test(sql),
            text: 'Precisar de `DISTINCT` é um sinal de alerta: o JOIN multiplicou linhas (um produto por item vendido) e o DISTINCT está limpando depois. Um `NOT EXISTS`/`EXISTS` responde "existe?" sem duplicar nada.',
            concept: 'Semi-join',
          },
        ],
        hints: [
          'Pense em "não existe item deste produto em pedido não cancelado": `WHERE NOT EXISTS (SELECT 1 FROM ... WHERE ...)`.',
          'A subconsulta junta `itens_pedido` com `pedidos` (para ver o status) e se **correlaciona** com o produto de fora: `i.produto_id = pr.id`.',
          'Dentro do NOT EXISTS: `FROM itens_pedido i JOIN pedidos pe ON pe.id = i.pedido_id WHERE i.produto_id = pr.id AND pe.status <> \'cancelado\'`.',
        ],
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Recapitulando: o banco avalia **FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT**, e paginação exige desempate único.',
          'No LEFT JOIN, o filtro da tabela opcional vai no **ON**; para "quem não tem", **NOT EXISTS**. No próximo módulo: agregações e o temido NULL.',
        ],
        board: null,
      },
    ],
  });
})();
