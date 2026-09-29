(function () {
  // Clientes e pedidos com valor (relatório por cliente).
  const CLIENTES_PEDIDOS = `CREATE TABLE clientes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  criado_em TEXT NOT NULL,
  status TEXT NOT NULL,
  total REAL NOT NULL
);
INSERT INTO clientes (id, nome, cidade) VALUES
  (1, 'Ana', 'Recife'),
  (2, 'Bruno', 'Curitiba'),
  (3, 'Carla', 'Recife'),
  (4, 'Davi', 'Belém');
INSERT INTO pedidos (id, cliente_id, criado_em, status, total) VALUES
  (10, 1, '2024-03-01', 'pago', 120.00),
  (11, 1, '2024-03-04', 'cancelado', 80.00),
  (12, 2, '2024-03-05', 'cancelado', 45.50),
  (13, 1, '2024-03-09', 'pago', 99.90),
  (14, 4, '2024-03-10', 'pago', 310.00),
  (15, 4, '2024-03-12', 'pendente', 60.00);`;

  // Cupons e pedidos: a maioria dos pedidos não usa cupom (cupom NULL).
  const CUPONS = `CREATE TABLE cupons (
  codigo TEXT PRIMARY KEY,
  desconto_pct INTEGER NOT NULL
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL,
  total REAL NOT NULL,
  cupom TEXT REFERENCES cupons(codigo)
);
INSERT INTO cupons (codigo, desconto_pct) VALUES
  ('BEMVINDO10', 10),
  ('BLACK30', 30),
  ('VOLTA15', 15),
  ('NATAL20', 20);
INSERT INTO pedidos (id, cliente_id, criado_em, total, cupom) VALUES
  (1, 7, '2024-03-01', 120.00, 'BEMVINDO10'),
  (2, 3, '2024-03-02', 80.50, NULL),
  (3, 7, '2024-03-05', 310.00, NULL),
  (4, 9, '2024-03-05', 15.90, 'VOLTA15'),
  (5, 3, '2024-03-07', 99.90, 'BEMVINDO10');`;

  // Pedidos por canal: pedidos antigos não têm canal registrado (NULL).
  const CANAIS = `CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  canal TEXT,
  total REAL NOT NULL
);
INSERT INTO pedidos (id, cliente_id, canal, total) VALUES
  (1, 1, 'app', 120.00),
  (2, 1, 'app', 80.00),
  (3, 2, 'site', 45.50),
  (4, 3, 'site', 99.90),
  (5, 2, NULL, 310.00),
  (6, 4, NULL, 60.00),
  (7, 4, 'loja', 25.00),
  (8, 4, 'loja', 18.00);`;

  Game.registerModule('databases', {
    id: 'agregacoes',
    title: 'Agregações, NULL e lógica de três valores',
    kind: 'lesson',
    level: 2,
    order: 2,
    unit: 'sql',
    summary: 'COUNT, SUM e AVG sem surpresas: GROUP BY e HAVING, o que o NULL faz com cada agregação e por que um `NOT IN` pode devolver zero linhas.',
    concepts: ['COUNT(*) × COUNT(coluna)', 'GROUP BY/HAVING', 'Lógica de três valores', 'NOT IN com NULL', 'COALESCE'],
    takeaways: [
      '`COUNT(*)` conta **linhas**; `COUNT(coluna)` conta valores **não nulos**; `COUNT(DISTINCT coluna)`, os distintos não nulos.',
      'Agregações ignoram NULL: `AVG` divide só pelos valores presentes, e `SUM` de nada é **NULL** — use `COALESCE(SUM(x), 0)`.',
      '`WHERE` filtra linhas antes de agrupar; `HAVING` filtra grupos depois. Some cada tabela no seu **grão** antes de juntar, ou o JOIN infla os totais (*fan trap*).',
      'SQL tem **três** valores lógicos: comparar com NULL dá UNKNOWN, e o WHERE só mantém TRUE — `canal <> \'app\'` também descarta os canais NULL.',
      '`x NOT IN (subconsulta)` com um único NULL na subconsulta nunca é verdadeiro: prefira `NOT EXISTS`.',
    ],
    glossary: [
      {
        term: 'Lógica de três valores',
        aliases: ['logica de tres valores', 'lógica trivalente', 'three-valued logic', '3VL', 'três valores lógicos'],
        definition: 'Em SQL, uma condição pode ser TRUE, FALSE ou **UNKNOWN** — o resultado de comparar qualquer coisa com NULL. WHERE, HAVING e ON só mantêm as linhas TRUE; já um `CHECK` só rejeita FALSE.',
      },
      {
        term: 'COALESCE',
        aliases: ['IFNULL', 'NVL'],
        definition: 'Função que devolve o **primeiro argumento não nulo**: `COALESCE(desconto, 0)`. É padrão SQL; `IFNULL` (SQLite/MySQL) e `NVL` (Oracle) são versões de dois argumentos.',
      },
      {
        term: 'HAVING',
        aliases: [],
        definition: 'Cláusula que filtra **grupos** depois do GROUP BY e por isso aceita agregações: `HAVING COUNT(*) >= 2`. Filtros que não dependem de agregação devem ir no WHERE, antes de agrupar.',
      },
      {
        term: 'Fan trap',
        aliases: ['fan traps', 'chasm trap', 'armadilha do leque'],
        definition: 'Soma ou contagem **inflada** porque um JOIN com uma tabela 1:N repetiu as linhas do lado "1" antes de agregar. Solução: agregar cada tabela no seu próprio grão (subconsulta/CTE) e só então juntar.',
      },
      {
        term: 'Agregação condicional',
        aliases: ['agregações condicionais', 'conditional aggregation'],
        definition: 'Agregar só parte das linhas de cada grupo, com `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` ou `COUNT(*) FILTER (WHERE ...)`. Dá várias contagens diferentes numa única passada — é o jeito de fazer um *pivot* em SQL.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Até agora, cada linha do resultado era uma linha da tabela. Hoje vamos **resumir**: contar, somar, tirar médias.',
          'E vamos encarar o personagem mais traiçoeiro do SQL: o **NULL**.',
        ],
        board: {
          title: 'Funções de agregação',
          md: `Uma tabela \`pedidos\` pequena, com NULLs de propósito:

| id | total | desconto | cupom |
|---|---|---|---|
| 1 | 100 | 10 | BEMVINDO10 |
| 2 | 200 | NULL | NULL |
| 3 | 50 | 5 | VOLTA15 |
| 4 | 150 | NULL | BEMVINDO10 |

| Expressão | Resultado | Por quê |
|---|---|---|
| \`COUNT(*)\` | 4 | conta **linhas** |
| \`COUNT(cupom)\` | 3 | conta valores **não nulos** |
| \`COUNT(DISTINCT cupom)\` | 2 | valores distintos, sem o NULL |
| \`SUM(desconto)\` | 15 | soma ignorando os NULLs |
| \`AVG(desconto)\` | 7.5 | 15 ÷ **2**: só as linhas com valor |
| \`AVG(COALESCE(desconto, 0))\` | 3.75 | 15 ÷ 4: NULL tratado como zero |
| \`MIN(total)\` / \`MAX(total)\` | 50 / 200 | também ignoram NULL |

\`AVG(desconto)\` responde "qual o desconto médio **de quem teve desconto**?"; "qual o desconto médio **por pedido**?" é 3.75. As duas contas estão certas — para perguntas diferentes. Antes de escrever a agregação, decida **qual é o denominador**.

> [!atencao] Entre inteiros, SQLite e PostgreSQL fazem **divisão inteira**: \`7 / 2\` dá \`3\`. Para taxas e médias "na mão", force o decimal: \`SUM(x) * 1.0 / COUNT(*)\`. (No MySQL, \`/\` sempre devolve decimal.)`,
        },
      },
      {
        type: 'say',
        text: [
          'Com **GROUP BY**, as agregações são calculadas **por grupo** — uma linha de resultado para cada valor distinto da chave.',
          'E para filtrar grupos existe o **HAVING**. O WHERE não serve: ele roda antes de os grupos existirem.',
        ],
        board: {
          title: 'GROUP BY, HAVING e agregação condicional',
          md: `\`\`\`sql
SELECT cliente_id,
       COUNT(*)   AS pedidos,
       SUM(total) AS faturamento
FROM pedidos
WHERE status = 'pago'        -- 1) filtra LINHAS, antes de agrupar
GROUP BY cliente_id          -- 2) um grupo por cliente
HAVING COUNT(*) >= 2         -- 3) filtra GRUPOS
ORDER BY faturamento DESC;
\`\`\`

- Toda coluna do SELECT que **não** está numa agregação precisa estar no GROUP BY. (O PostgreSQL também aceita colunas que dependem da chave primária agrupada.)
- Filtro que não depende de agregação vai no **WHERE**: menos linhas para agrupar.
- Agrupe pela **chave**, não pelo nome: \`GROUP BY nome\` junta duas clientes "Ana" diferentes num grupo só.
- Todos os NULLs da chave caem num **grupo próprio**.

**Agregação condicional** — várias contagens numa passada só:

\`\`\`sql
SELECT cliente_id,
       COUNT(*)                                               AS total,
       SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END)  AS cancelados,
       COUNT(*) FILTER (WHERE status = 'pago')                AS pagos  -- padrão SQL: PostgreSQL, SQLite 3.30+
FROM pedidos
GROUP BY cliente_id;
\`\`\`

> [!sabia] O SQLite aceita colunas **"nuas"** (fora do GROUP BY e de qualquer agregação). E, se a consulta tem um único \`MIN()\` ou \`MAX()\`, a coluna nua vem **da linha que tem o mínimo ou o máximo**: \`SELECT cliente_id, MAX(total), id FROM pedidos GROUP BY cliente_id\` devolve o \`id\` do maior pedido de cada cliente. É uma extensão só do SQLite: o PostgreSQL recusa, e o MySQL moderno (com \`ONLY_FULL_GROUP_BY\`, padrão desde a 5.7) também.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora um bug que aparece em relatório de empresa grande: **somar depois de um JOIN** com uma tabela 1:N.',
          'O JOIN repete as linhas do lado "1" — e a soma conta a mesma coisa várias vezes, sem erro nenhum.',
        ],
        board: {
          title: 'Fan trap: a soma inflada',
          md: `\`\`\`sql
-- frete é uma coluna de pedidos; cada pedido tem N itens
SELECT p.cliente_id, SUM(p.frete) AS frete_total      -- ❌ inflado!
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
GROUP BY p.cliente_id;
\`\`\`

\`\`\`text
pedido 10 (frete 20) ── item A ─┐
                     ── item B ─┼─▶ o frete 20 entra 3 vezes na soma: 60
                     ── item C ─┘
\`\`\`

A correção é **agregar cada tabela no seu próprio grão** e só depois juntar:

\`\`\`sql
WITH valor_itens AS (                    -- 1 linha por pedido
  SELECT pedido_id, SUM(quantidade * preco_unit) AS valor
  FROM itens_pedido
  GROUP BY pedido_id
)
SELECT p.cliente_id,
       SUM(p.frete)  AS frete_total,     -- agora cada pedido aparece 1 vez
       SUM(v.valor)  AS valor_itens
FROM pedidos p
JOIN valor_itens v ON v.pedido_id = p.id
GROUP BY p.cliente_id;
\`\`\`

(O \`WITH\` é uma **CTE**, uma subconsulta com nome — ela é assunto do próximo módulo.)

- \`COUNT(DISTINCT p.id)\` conserta **contagens**, mas não somas: \`SUM(DISTINCT p.frete)\` somaria **uma vez só** dois pedidos com o mesmo frete — errado de outro jeito.

> [!sabia] Em BI isso tem nome: **fan trap** — a relação 1:N "abre um leque" e duplica o lado 1. A prima dela é a **chasm trap**: juntar a um cliente duas tabelas filhas independentes (pedidos **e** chamados de suporte) gera um produto cartesiano por cliente, e as duas somas saem infladas.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora, o NULL. Ele não é zero nem string vazia: significa **valor desconhecido** ou inexistente.',
          'Por isso, qualquer comparação com NULL dá… **desconhecido**. O SQL tem três valores lógicos: TRUE, FALSE e UNKNOWN.',
        ],
        board: {
          title: 'Lógica de três valores',
          md: `| Expressão | Resultado |
|---|---|
| \`NULL = NULL\` | UNKNOWN (aparece como NULL) |
| \`NULL <> 'app'\` | UNKNOWN |
| \`NULL + 10\` | NULL |
| \`NULL IS NULL\` | TRUE |
| \`'app' IS NOT NULL\` | TRUE |

| AND | TRUE | FALSE | UNKNOWN |
|---|---|---|---|
| **TRUE** | TRUE | FALSE | UNKNOWN |
| **FALSE** | FALSE | FALSE | FALSE |
| **UNKNOWN** | UNKNOWN | FALSE | UNKNOWN |

| OR | TRUE | FALSE | UNKNOWN |
|---|---|---|---|
| **TRUE** | TRUE | TRUE | TRUE |
| **FALSE** | TRUE | FALSE | UNKNOWN |
| **UNKNOWN** | TRUE | UNKNOWN | UNKNOWN |

E \`NOT UNKNOWN\` continua UNKNOWN. **O WHERE só mantém as linhas TRUE**:

\`\`\`sql
SELECT COUNT(*) FROM pedidos WHERE canal = 'app';    -- os do app
SELECT COUNT(*) FROM pedidos WHERE canal <> 'app';   -- "todos os outros"?
-- os pedidos com canal NULL não entram em NENHUMA das duas contagens
\`\`\`

Comparações que tratam NULL como um valor comum:

| Forma | Onde |
|---|---|
| \`canal IS DISTINCT FROM 'app'\` | padrão SQL (PostgreSQL; SQLite 3.39+) |
| \`canal IS NOT 'app'\` | SQLite (\`IS\` e \`IS NOT\` aceitam qualquer valor) |
| \`canal <> 'app' OR canal IS NULL\` | qualquer banco |

> [!sabia] Essa é a **lógica de três valores** (de Kleene). Um detalhe que quase ninguém sabe: \`CHECK\` faz o contrário do WHERE. A restrição \`CHECK (preco > 0)\` só **rejeita** quando o resultado é FALSE — então um preço NULL **passa** no CHECK. Filtros exigem TRUE; restrições só barram FALSE. Quer proibir o NULL? Some um \`NOT NULL\` à coluna.`,
        },
      },
      {
        type: 'say',
        text: [
          'Juntando tudo, chegamos à armadilha mais famosa do SQL: o `NOT IN` com NULL.',
          { text: 'Basta **um** NULL na subconsulta para o `NOT IN` devolver zero linhas. Sem erro, sem aviso.', mood: 'surprised' },
        ],
        board: {
          title: 'A armadilha do NOT IN',
          md: `\`\`\`sql
-- "cupons que ninguém usou"
SELECT codigo FROM cupons
WHERE codigo NOT IN (SELECT cupom FROM pedidos);   -- pedido sem cupom tem cupom NULL
-- resultado: ZERO linhas 😱
\`\`\`

\`NOT IN\` é uma cadeia de \`<>\` ligados por AND:

\`\`\`text
'NATAL20' NOT IN ('BEMVINDO10', NULL)
= 'NATAL20' <> 'BEMVINDO10'  AND  'NATAL20' <> NULL
=          TRUE              AND       UNKNOWN
=                     UNKNOWN          → o WHERE descarta a linha
\`\`\`

| Forma | Com NULL na subconsulta |
|---|---|
| \`NOT IN (SELECT cupom FROM pedidos)\` | ❌ nunca é TRUE: resultado vazio |
| \`NOT IN (SELECT cupom FROM pedidos WHERE cupom IS NOT NULL)\` | ✅ funciona, mas é fácil esquecer o filtro |
| \`NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cupom = c.codigo)\` | ✅ imune: só pergunta se existe par |
| \`LEFT JOIN pedidos p ON p.cupom = c.codigo WHERE p.id IS NULL\` | ✅ imune |

- O \`IN\` positivo não sofre disso: \`'BEMVINDO10' IN ('BEMVINDO10', NULL)\` é TRUE (no OR, um TRUE basta).
- Além de perigoso, \`NOT IN (subconsulta)\` costuma ser **mais lento** no PostgreSQL: por causa da semântica do NULL, o otimizador não pode transformá-lo num *anti-join*, coisa que faz com o \`NOT EXISTS\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para domar o NULL, três ferramentas: **COALESCE**, **NULLIF** e saber como o DISTINCT enxerga os NULLs.',
          'Spoiler: para o DISTINCT, dois NULLs são **iguais** — mesmo que `NULL = NULL` não seja verdadeiro.',
        ],
        board: {
          title: 'COALESCE, NULLIF e DISTINCT',
          md: `| Ferramenta | Exemplo | Para quê |
|---|---|---|
| \`COALESCE(a, b, ...)\` | \`COALESCE(SUM(p.total), 0)\` | primeiro valor não nulo: padrões e "zero em vez de NULL" |
| \`NULLIF(a, b)\` | \`total / NULLIF(qtd, 0)\` | devolve NULL quando \`a = b\` — evita divisão por zero |
| \`IFNULL(a, b)\` | \`IFNULL(canal, 'loja')\` | COALESCE de dois argumentos (SQLite/MySQL) |

- **\`SUM\` de nada é NULL; \`COUNT\` de nada é 0.** Num relatório por cliente com LEFT JOIN, \`COUNT(p.id)\` já dá 0 para quem não comprou, mas \`SUM(p.total)\` precisa de \`COALESCE\`.
- **\`COUNT(*)\` num LEFT JOIN conta a linha "vazia"**: o cliente sem pedidos ganha \`COUNT(*) = 1\`. Conte uma coluna da direita: \`COUNT(p.id)\`.
- **DISTINCT e GROUP BY tratam NULLs como iguais**: \`SELECT DISTINCT canal\` devolve **um** NULL. O padrão chama isso de *not distinct* — daí o operador \`IS [NOT] DISTINCT FROM\`.
- **UNIQUE aceita vários NULLs** no SQLite e no PostgreSQL (no SQL Server, só um). O PostgreSQL 15 criou \`UNIQUE NULLS NOT DISTINCT\` para mudar isso.

> [!dica] O SQLite tem uma função pouco conhecida, \`total()\`: um SUM que devolve \`0.0\` (em vez de NULL) quando não há valores. Prático, mas não existe em outros bancos — \`COALESCE(SUM(x), 0)\` é o jeito portátil.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'COUNT, NULL, HAVING, NOT IN e fan trap.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'db-agg-q1',
        concept: 'COUNT(*) × COUNT(coluna)',
        say: 'Primeira: faça as contas de cabeça. Cuidado com os NULLs — e com a divisão.',
        prompt: `A tabela \`avaliacoes\` tem a coluna \`nota INTEGER\` com os valores \`5, 3, NULL, 4, NULL\`. O que esta consulta devolve no SQLite?

\`\`\`sql
SELECT COUNT(*), COUNT(nota), AVG(nota), SUM(nota) / COUNT(*)
FROM avaliacoes;
\`\`\``,
        options: [
          { text: '`5 | 3 | 4.0 | 2`', correct: true, why: '`COUNT(*)` conta as 5 linhas; `COUNT(nota)`, só as 3 com nota; `AVG` = 12 ÷ 3 = 4.0; e 12 ÷ 5 entre inteiros é divisão **inteira**: 2.' },
          { text: '`5 | 5 | 2.4 | 2.4`', why: 'Isso trataria NULL como zero. As agregações **ignoram** NULL: `COUNT(nota)` é 3 e o `AVG` divide por 3.' },
          { text: '`3 | 3 | 4.0 | 4.0`', why: '`COUNT(*)` conta **linhas**, com ou sem NULL: são 5. E `SUM(nota) / COUNT(*)` é 12 ÷ 5.' },
          { text: '`5 | 3 | 4.0 | 2.4`', why: 'Quase! Mas `SUM(nota)` e `COUNT(*)` são inteiros, e no SQLite (e no PostgreSQL) inteiro dividido por inteiro dá inteiro: 12 ÷ 5 = 2. Use `SUM(nota) * 1.0 / COUNT(*)`.' },
        ],
        explanation: 'Três lições numa consulta: `COUNT(*)` conta linhas e `COUNT(coluna)` conta não nulos; `AVG` ignora NULL (é a média de quem **tem** nota); e divisão entre inteiros trunca. Qual média é a certa depende da pergunta: "nota média de quem avaliou" é `AVG(nota)` = 4.0; "média tratando sem-nota como zero" seria `AVG(COALESCE(nota, 0))` = 2.4.',
      },
      {
        type: 'sql',
        id: 'db-agg-q2',
        concept: 'COALESCE',
        title: 'Relatório de clientes',
        say: 'Agora um relatório de verdade. Todo cliente precisa aparecer — inclusive quem nunca comprou.',
        prompt: `Para **cada cliente**, inclusive quem nunca comprou, mostre:

- \`nome\`;
- \`pedidos_pagos\`: a quantidade de pedidos com status \`'pago'\`;
- \`total_pago\`: a soma do \`total\` desses pedidos.

Quem não tem pedido pago aparece com \`0\` e \`0\` — **nada de NULL**. Pedidos com outros status não contam. Atenção: dois clientes diferentes podem ter o **mesmo nome**. (A ordem das linhas não importa.)`,
        schema: CLIENTES_PEDIDOS,
        variants: [
          `INSERT INTO clientes (id, nome, cidade) VALUES (5, 'Ana', 'Natal'), (6, 'Eva', 'Recife');
INSERT INTO pedidos (id, cliente_id, criado_em, status, total) VALUES
  (16, 5, '2024-03-15', 'pago', 50.00),
  (17, 5, '2024-03-16', 'pago', 25.25),
  (18, 6, '2024-03-17', 'pendente', 70.00),
  (19, 3, '2024-03-18', 'pago', 10.00);`,
          "UPDATE pedidos SET status = 'enviado' WHERE status = 'pago';",
        ],
        starter: `-- nome | pedidos_pagos | total_pago   (uma linha por cliente, 0 em vez de NULL)
SELECT c.nome
FROM clientes c;
`,
        solution: `SELECT c.nome,
       COUNT(p.id)               AS pedidos_pagos,
       COALESCE(SUM(p.total), 0) AS total_pago
FROM clientes c
LEFT JOIN pedidos p
  ON p.cliente_id = c.id
 AND p.status = 'pago'
GROUP BY c.id, c.nome;`,
        solutionExplanation: `Quatro detalhes, cada um derruba o relatório de um jeito:

- **LEFT JOIN com o status no ON**: mantém todo cliente; no WHERE, quem não tem pedido pago sumiria (módulo anterior).
- **\`COUNT(p.id)\`**, não \`COUNT(*)\`: para quem não comprou, o LEFT JOIN gera uma linha com \`p.id\` NULL — \`COUNT(*)\` contaria 1.
- **\`COALESCE(SUM(p.total), 0)\`**: SUM de nenhum valor é NULL, não zero.
- **\`GROUP BY c.id\`**: agrupe pela chave. Com \`GROUP BY c.nome\`, duas clientes chamadas "Ana" virariam uma só — os dados ocultos têm exatamente esse caso.

Uma alternativa válida é a agregação condicional sem filtro no ON: \`COUNT(CASE WHEN p.status = 'pago' THEN 1 END)\` e \`SUM(CASE WHEN p.status = 'pago' THEN p.total ELSE 0 END)\`.`,
        reviews: [
          {
            when: sql => /(^|[^.\w])total\s*\(/i.test(sql),
            text: 'Você usou `total()`, extensão do SQLite que devolve 0.0 em vez de NULL. Funciona aqui, mas não existe em PostgreSQL, MySQL ou SQL Server: `COALESCE(SUM(...), 0)` é o jeito portátil.',
            concept: 'COALESCE',
          },
          {
            when: sql => /select[\s\S]*,\s*\(\s*select\b/i.test(sql),
            text: 'Funciona! Mas são subconsultas correlacionadas no SELECT: cada uma relê `pedidos` para **cada** cliente, e sem índice em `cliente_id` isso pesa em tabelas grandes. O LEFT JOIN + GROUP BY calcula tudo numa passada só.',
            concept: 'GROUP BY/HAVING',
          },
        ],
        hints: [
          'Comece pelo esqueleto do módulo anterior: `clientes LEFT JOIN pedidos`, com o filtro de status **no ON**, e `GROUP BY c.id`.',
          '`COUNT(*)` conta a linha "vazia" que o LEFT JOIN gera para quem não tem pedido — dá 1. Conte uma coluna da direita: `COUNT(p.id)`.',
          '`SUM` de nenhum valor é NULL. Troque por zero com `COALESCE(SUM(p.total), 0)`.',
        ],
      },
      {
        type: 'match',
        id: 'db-agg-q3',
        concept: 'Lógica de três valores',
        say: 'Rodada rápida de lógica de três valores. Pense em TRUE, FALSE e UNKNOWN.',
        prompt: 'Associe cada expressão ao seu resultado em SQL.',
        pairs: [
          { left: '`NULL = NULL`', right: 'NULL: comparar com desconhecido dá desconhecido' },
          { left: '`NULL IS NULL`', right: 'TRUE: `IS` testa a ausência de valor' },
          { left: '`NULL OR 1 = 1`', right: 'TRUE: no OR, um lado verdadeiro basta' },
          { left: '`NULL AND 1 = 0`', right: 'FALSE: no AND, um lado falso basta' },
          { left: '`3 NOT IN (1, 2, NULL)`', right: 'NULL: vira `3 <> 1 AND 3 <> 2 AND 3 <> NULL`' },
          { left: '`COALESCE(NULL, NULL, 7)`', right: '7: o primeiro valor não nulo' },
        ],
        explanation: 'UNKNOWN se propaga — exceto quando o outro lado decide sozinho: TRUE no OR, FALSE no AND. `IS NULL` e `IS NOT NULL` são as comparações que nunca dão UNKNOWN. E `NOT IN` é uma cadeia de `<>` ligada por AND: basta um NULL na lista para ela nunca ser TRUE — e o WHERE descarta tudo que não é TRUE.',
      },
      {
        type: 'sql',
        id: 'db-agg-q4',
        concept: 'NOT IN com NULL',
        title: 'Cupons que ninguém usou',
        say: 'Agora a armadilha ao vivo. Rode o SQL do editor antes de mexer nele.',
        prompt: `O marketing quer desativar os **cupons que nunca foram usados** em nenhum pedido: colunas \`codigo\` e \`desconto_pct\`.

Pedidos sem cupom têm \`cupom\` NULL. A consulta no editor parece certa, mas devolve **zero linhas**. Descubra por quê e conserte. (A ordem das linhas não importa.)`,
        schema: CUPONS,
        variants: [
          "UPDATE pedidos SET cupom = 'BLACK30' WHERE cupom IS NULL;",
          `INSERT INTO cupons (codigo, desconto_pct) VALUES ('PIX5', 5);
UPDATE pedidos SET cupom = NULL WHERE id = 4;`,
        ],
        starter: `SELECT codigo, desconto_pct
FROM cupons
WHERE codigo NOT IN (SELECT cupom FROM pedidos);
`,
        solution: `SELECT c.codigo, c.desconto_pct
FROM cupons c
WHERE NOT EXISTS (
  SELECT 1 FROM pedidos p WHERE p.cupom = c.codigo
);`,
        solutionExplanation: `A subconsulta do \`NOT IN\` devolve \`('BEMVINDO10', NULL, NULL, 'VOLTA15', 'BEMVINDO10')\`. Para \`'NATAL20'\`, o teste vira \`... AND 'NATAL20' <> NULL\` — UNKNOWN —, e o WHERE descarta. Isso acontece com **todo** cupom: zero linhas.

O \`NOT EXISTS\` faz outra pergunta — "existe pedido com este cupom?" —, e a comparação \`p.cupom = c.codigo\` com cupom NULL simplesmente não casa. Não há como um NULL "contaminar" o resultado.

Também valeria \`LEFT JOIN pedidos p ON p.cupom = c.codigo WHERE p.id IS NULL\`. Já \`NOT IN (SELECT cupom FROM pedidos WHERE cupom IS NOT NULL)\` funciona, mas depende de ninguém esquecer o filtro no futuro.`,
        reviews: [
          {
            when: sql => /not\s+in\s*\(\s*select/i.test(sql),
            text: 'Você manteve o `NOT IN` e filtrou os NULLs. Funciona, mas é frágil: basta alguém mexer na subconsulta e esquecer o filtro para o relatório voltar a sair vazio, em silêncio. `NOT EXISTS` é imune a NULL por construção (e o PostgreSQL consegue executá-lo como anti-join).',
            concept: 'NOT IN com NULL',
          },
        ],
        hints: [
          'Com um NULL na lista, `x NOT IN (a, b, NULL)` vira `x <> a AND x <> b AND x <> NULL` — e o último termo é UNKNOWN.',
          'Troque a pergunta: "não existe pedido com este cupom" → `WHERE NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cupom = c.codigo)`.',
          'Alternativa: `LEFT JOIN pedidos p ON p.cupom = c.codigo` e fique com as linhas em que `p.id IS NULL`.',
        ],
      },
      {
        type: 'sql',
        id: 'db-agg-q5',
        concept: 'GROUP BY/HAVING',
        title: 'Relatório por canal de venda',
        say: 'Mais um relatório: agora com grupos, NULL virando grupo e filtro de grupo.',
        prompt: `Para cada **canal de venda**, mostre o canal, a quantidade de **pedidos** e a quantidade de **clientes distintos**.

- Pedidos antigos têm \`canal\` NULL (de antes de registrarmos o canal): agrupe-os como \`'desconhecido'\`.
- Mostre só os canais com **pelo menos 2 clientes distintos**.

(A ordem das linhas não importa.)`,
        schema: CANAIS,
        variants: [
          `INSERT INTO pedidos (id, cliente_id, canal, total) VALUES
  (9, 5, 'app', 70.00),
  (10, 2, NULL, 12.00),
  (11, 5, 'loja', 33.00);`,
          "UPDATE pedidos SET canal = 'site' WHERE canal IS NULL;",
        ],
        starter: `SELECT canal, COUNT(*) AS pedidos
FROM pedidos
GROUP BY canal;
`,
        solution: `SELECT COALESCE(canal, 'desconhecido') AS canal,
       COUNT(*)                   AS pedidos,
       COUNT(DISTINCT cliente_id) AS clientes
FROM pedidos
GROUP BY canal
HAVING COUNT(DISTINCT cliente_id) >= 2;`,
        solutionExplanation: `- O GROUP BY já coloca todos os NULLs num **grupo próprio**; o \`COALESCE\` só dá um nome a ele.
- \`COUNT(*)\` conta pedidos; \`COUNT(DISTINCT cliente_id)\` conta clientes. No app, um único cliente fez 2 pedidos: \`COUNT(*) >= 2\` o deixaria passar.
- O filtro é sobre o **grupo**, então vai no \`HAVING\` — e repete a agregação, em vez de usar o alias \`clientes\`, porque no SQL padrão o HAVING roda antes do SELECT (o SQLite aceita o alias, o PostgreSQL não).`,
        reviews: [
          {
            when: sql => /\bunion\b/i.test(sql),
            text: 'Não precisava de `UNION` para tratar os NULLs à parte: o GROUP BY já junta todos os NULLs num grupo só. Basta nomeá-lo com `COALESCE(canal, \'desconhecido\')`.',
            concept: 'GROUP BY/HAVING',
          },
          {
            when: sql => /\bifnull\s*\(/i.test(sql),
            text: '`IFNULL` funciona no SQLite e no MySQL, mas `COALESCE` é o padrão SQL — roda em qualquer banco e aceita vários argumentos.',
            concept: 'COALESCE',
          },
          {
            when: sql => {
              const aliases = [...sql.matchAll(/\bas\s+(\w+)/gi)].map(m => m[1]);
              const having = (sql.match(/\bhaving\b([\s\S]*?)(?:\border\s+by\b|\blimit\b|;|$)/i) || [])[1] || '';
              return aliases.some(a => new RegExp('\\b' + a + '\\b', 'i').test(having));
            },
            text: 'Seu HAVING usa um alias do SELECT. O SQLite aceita, mas no SQL padrão o HAVING é avaliado **antes** do SELECT (ordem lógica!) — o PostgreSQL daria erro. Repita a agregação: `HAVING COUNT(DISTINCT cliente_id) >= 2`.',
            concept: 'Ordem lógica de execução',
          },
        ],
        hints: [
          'O GROUP BY junta todos os NULLs num **grupo próprio** — você só precisa dar um nome a ele com `COALESCE(canal, \'desconhecido\')`.',
          '"Clientes distintos" é `COUNT(DISTINCT cliente_id)`; `COUNT(*)` contaria pedidos.',
          'Filtro sobre grupo vai no `HAVING`: `HAVING COUNT(DISTINCT cliente_id) >= 2`.',
        ],
      },
      {
        type: 'open',
        id: 'db-agg-q6',
        concept: 'Fan trap',
        say: 'Última — e esta é de investigação. Um número "errado" num dashboard.',
        prompt: `O dashboard mostra o **frete médio por cliente** com esta consulta, adaptada de um relatório antigo:

\`\`\`sql
SELECT AVG(frete_total) AS frete_medio
FROM (
  SELECT c.id, SUM(p.frete) AS frete_total
  FROM clientes c
  LEFT JOIN pedidos p       ON p.cliente_id = c.id
  LEFT JOIN itens_pedido i  ON i.pedido_id = p.id
  GROUP BY c.id
);
\`\`\`

O financeiro jura que o número está **alto demais**. Que problemas você aponta e como corrigiria?`,
        minWords: 30,
        rubric: [
          {
            label: 'Aponta a **duplicação** pelo JOIN com itens: o frete de cada pedido é somado uma vez por item (fan trap)',
            keywords: ['duplic', 'multiplic', 'repet', 'fan trap', 'infla', 'uma vez por item', 'para cada item', 'por item', 'varias vezes', 'mais de uma vez', 'cartesiano', 'leque', 'somado mais', 'contado mais'],
            concept: 'Fan trap',
            why: 'Cada pedido aparece N vezes depois do JOIN com seus N itens, e o SUM do frete conta N vezes.',
          },
          {
            label: 'Nota que o **AVG ignora NULL**: clientes sem pedido ficam fora do denominador',
            keywords: ['ignora null', 'ignora o null', 'ignora os null', 'ignora nulo', 'ignora valores nulos', 'avg ignora', 'media ignora', 'fora da media', 'fora do denominador', 'nao entram na media', 'nao entra na media', 'sem pedido', 'nunca compr', 'denominador', 'coalesce'],
            concept: 'COUNT(*) × COUNT(coluna)',
            why: 'Para quem não tem pedido, `SUM(p.frete)` é NULL e o AVG simplesmente pula esse cliente — a média vira "por cliente que comprou".',
          },
          {
            label: 'Corrige **agregando no grão certo**: remover o JOIN desnecessário ou pré-agregar numa subconsulta/CTE',
            keywords: ['remover o join', 'remova o join', 'removeria o join', 'remove o join', 'tirar o join', 'tire o join', 'tiraria o join', 'sem o join', 'retirar o join', 'nao precisa do join', 'join desnecessario', 'desnecessario', 'pre-agreg', 'pre agreg', 'preagreg', 'agregar antes', 'agregue antes', 'agregando antes', 'subconsulta', 'subquery', ' cte', 'grao', 'granularidade'],
            concept: 'Fan trap',
            why: 'Frete é uma coluna de pedido: some no grão do pedido, sem juntar os itens (ou agregue os itens antes, se precisar deles).',
          },
          {
            label: 'Sugere **validar** o número com contagens ou um caso conhecido',
            keywords: ['count(distinct', 'count distinct', 'contagem', 'conferir', 'confira', 'validar', 'valide', 'comparar', 'compare', 'teste', 'testar', 'caso conhecido', 'reconcili', 'bater com', 'checar', 'verificar'],
            concept: 'GROUP BY/HAVING',
            why: 'Comparar `COUNT(*)` com `COUNT(DISTINCT p.id)`, ou recalcular o frete de um cliente à mão, denuncia a duplicação na hora.',
          },
        ],
        modelAnswer: `Vejo dois problemas, e os dois empurram o número para cima.

1. **Fan trap**: o JOIN com \`itens_pedido\` **duplica** cada pedido uma vez por item. Um pedido com 3 itens tem o frete somado 3 vezes. E o JOIN nem é necessário: frete é coluna de \`pedidos\`. Eu removeria o JOIN com itens — ou, se o relatório precisar dos itens, agregaria os itens numa subconsulta/CTE **antes** de juntar, para manter o grão de um pedido por linha.
2. **AVG ignora NULL**: cliente sem pedido tem \`SUM(p.frete)\` NULL, e o AVG o deixa fora do **denominador**. A média vira "frete médio por cliente que comprou". Se a pergunta é "por cliente cadastrado", uso \`COALESCE(SUM(p.frete), 0)\`; se é por comprador, deixo isso explícito no nome da métrica.

Para validar, compararia \`COUNT(*)\` com \`COUNT(DISTINCT p.id)\` depois do JOIN (se forem diferentes, há duplicação) e conferiria à mão o frete de um cliente conhecido.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo trabalho! Recapitulando: `COUNT(*)` conta linhas, agregações **ignoram NULL**, `SUM` de nada é NULL e o JOIN 1:N pode inflar somas.',
          'E o NULL traz a **lógica de três valores**: o WHERE só aceita TRUE, e `NOT IN` com NULL devolve nada. No próximo módulo: window functions e CTEs recursivas!',
        ],
        board: null,
      },
    ],
  });
})();
