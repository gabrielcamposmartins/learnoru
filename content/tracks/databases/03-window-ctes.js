(function () {
  // Pedidos com horário: dois pedidos do cliente 3 no mesmo minuto (empate).
  const PEDIDOS_CLIENTES = `CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL,
  total REAL NOT NULL
);
INSERT INTO pedidos (id, cliente_id, criado_em, total) VALUES
  (1, 7, '2024-03-01 10:15', 120.00),
  (2, 3, '2024-03-02 09:40', 80.50),
  (3, 7, '2024-03-05 14:30', 310.00),
  (4, 9, '2024-03-05 16:00', 15.90),
  (5, 3, '2024-03-07 11:20', 99.90),
  (6, 7, '2024-03-09 08:45', 18.00),
  (7, 9, '2024-03-04 13:00', 42.00),
  (8, 3, '2024-03-07 11:20', 12.50);`;

  // Pedidos de vários meses (faturamento mensal).
  const PEDIDOS_MESES = `CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL,
  status TEXT NOT NULL,
  total REAL NOT NULL
);
INSERT INTO pedidos (id, cliente_id, criado_em, status, total) VALUES
  (1, 7, '2024-01-10 10:00', 'pago', 100.00),
  (2, 3, '2024-01-25 15:30', 'pago', 50.00),
  (3, 7, '2024-02-03 09:00', 'cancelado', 400.00),
  (4, 9, '2024-02-14 20:10', 'pago', 120.00),
  (5, 3, '2024-03-01 08:00', 'pago', 90.00),
  (6, 9, '2024-03-18 11:45', 'pago', 200.00),
  (7, 7, '2024-03-31 23:59', 'pendente', 70.00),
  (8, 3, '2024-04-02 10:00', 'pago', 40.00);`;

  // Carteira de cashback: créditos e débitos, com movimentos no mesmo dia.
  const MOVIMENTOS = `CREATE TABLE movimentos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  valor REAL NOT NULL
);
INSERT INTO movimentos (id, cliente_id, data, valor) VALUES
  (1, 7, '2024-03-01', 100.00),
  (2, 7, '2024-03-02', -30.00),
  (3, 9, '2024-03-02', 50.00),
  (4, 7, '2024-03-02', 20.00),
  (5, 9, '2024-03-04', -50.00),
  (6, 7, '2024-03-05', -60.00);`;

  // Árvore de categorias (pai_id NULL = raiz).
  const CATEGORIAS = `CREATE TABLE categorias (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  pai_id INTEGER REFERENCES categorias(id)
);
INSERT INTO categorias (id, nome, pai_id) VALUES
  (1, 'Eletrônicos', NULL),
  (2, 'Informática', 1),
  (3, 'Áudio', 1),
  (4, 'Notebooks', 2),
  (5, 'Periféricos', 2),
  (6, 'Casa', NULL),
  (7, 'Teclados', 5),
  (8, 'Cozinha', 6);`;

  Game.registerModule('databases', {
    id: 'window-ctes',
    title: 'Window functions e CTEs',
    kind: 'lesson',
    level: 3,
    order: 3,
    unit: 'sql',
    summary: 'Ranking, top-N por grupo, LAG/LEAD e saldos acumulados sem perder as linhas — e CTEs, inclusive recursivas, para percorrer hierarquias.',
    concepts: ['Window functions', 'RANK × DENSE_RANK', 'Frames ROWS × RANGE', 'Top-N por grupo', 'CTE recursiva'],
    takeaways: [
      'Uma window function calcula sobre um conjunto de linhas **sem colapsá-las**: `f() OVER (PARTITION BY ... ORDER BY ...)`.',
      'Nos empates, `ROW_NUMBER` dá 1, 2, 3; `RANK` dá 1, 1, 3 (pula); `DENSE_RANK` dá 1, 1, 2.',
      'Com `ORDER BY` e sem frame explícito, a janela é `RANGE ... CURRENT ROW`, que inclui os **empatados**: para acumular linha a linha, use um desempate único e/ou `ROWS`.',
      'Window functions são avaliadas depois do WHERE: para filtrar por elas (top-N por grupo), calcule numa CTE e filtre fora.',
      'CTE recursiva = **âncora** + **passo recursivo** com `UNION ALL`, repetido até não surgirem linhas novas; em dados com ciclos, limite a profundidade.',
    ],
    glossary: [
      {
        term: 'Window function',
        aliases: ['window functions', 'função de janela', 'funções de janela', 'função analítica', 'funções analíticas'],
        definition: 'Função calculada sobre uma **janela** de linhas relacionadas à linha atual, sem agrupá-las: `SUM(total) OVER (PARTITION BY cliente_id)`. Cada linha continua no resultado, com o valor calculado ao lado.',
      },
      {
        term: 'Window frame',
        aliases: ['frame da janela', 'frames da janela', 'window frames', 'ROWS BETWEEN', 'RANGE BETWEEN'],
        definition: 'Subconjunto da partição que a função enxerga em cada linha, ex.: `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`. `ROWS` conta linhas físicas; `RANGE` usa o valor do ORDER BY e inclui os empatados (*peers*). Com ORDER BY e sem frame, o padrão é `RANGE UNBOUNDED PRECEDING`.',
      },
      {
        term: 'CTE',
        aliases: ['CTEs', 'common table expression', 'common table expressions', 'CTE recursiva', 'CTEs recursivas'],
        definition: '*Common Table Expression*: subconsulta com nome, declarada no início com `WITH nome AS (...)`. Organiza consultas longas em passos e, com `WITH RECURSIVE`, percorre hierarquias e grafos.',
      },
      {
        term: 'Greatest-n-per-group',
        aliases: ['top-N por grupo', 'top N por grupo', 'greatest n per group'],
        definition: 'O problema de pegar as N "melhores" linhas de cada grupo — o pedido mais recente de cada cliente, os 3 mais vendidos por categoria. Solução portátil: `ROW_NUMBER() OVER (PARTITION BY grupo ORDER BY critério)` numa CTE, filtrando `rn <= N` fora dela.',
      },
      {
        term: 'Gaps and islands',
        aliases: ['gaps-and-islands', 'ilhas e lacunas', 'lacunas e ilhas'],
        definition: 'Problema clássico de achar sequências contínuas (ilhas) e buracos (lacunas) em dados ordenados, como dias seguidos de login. Truque: `dia - ROW_NUMBER()` é constante dentro de cada ilha, então basta agrupar por essa diferença.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Último módulo de SQL puro — e o mais poderoso. **Window functions** fazem contas sobre um grupo de linhas **sem** colapsar o resultado.',
          'Com GROUP BY, cada cliente vira uma linha. Com uma window function, cada pedido continua lá — com o total do cliente ao lado.',
        ],
        board: {
          title: 'GROUP BY × window function',
          md: `\`\`\`sql
-- GROUP BY: uma linha por cliente
SELECT cliente_id, SUM(total) FROM pedidos GROUP BY cliente_id;

-- Window: todas as linhas, com o total do cliente ao lado
SELECT id, cliente_id, total,
       SUM(total) OVER (PARTITION BY cliente_id)                 AS total_cliente,
       total * 100.0 / SUM(total) OVER (PARTITION BY cliente_id) AS pct_do_cliente
FROM pedidos;
\`\`\`

| id | cliente_id | total | total_cliente | pct_do_cliente |
|---|---|---|---|---|
| 1 | 7 | 100 | 400 | 25.0 |
| 2 | 7 | 300 | 400 | 75.0 |
| 3 | 9 | 50 | 50 | 100.0 |

Anatomia de uma janela:

\`\`\`text
função() OVER (
  PARTITION BY ...   -- divide em grupos (como o GROUP BY, mas sem colapsar)
  ORDER BY ...       -- ordem dentro de cada partição
  ROWS / RANGE ...   -- frame: quais linhas da partição a função enxerga
)
\`\`\`

> [!atencao] Window functions são avaliadas **depois** do WHERE, do GROUP BY e do HAVING — no passo do SELECT. Por isso \`WHERE ROW_NUMBER() OVER (...) = 1\` é erro: para filtrar pelo resultado de uma janela, calcule-a numa subconsulta ou CTE e filtre do lado de fora. (E dá para aplicar uma janela **sobre** agregações: \`SUM(SUM(total)) OVER ()\` numa consulta com GROUP BY.)`,
        },
      },
      {
        type: 'say',
        text: [
          'As mais cobradas em entrevista são as de **ranking**. A diferença entre elas só aparece nos **empates**.',
          'E empate é justamente onde os bugs moram.',
        ],
        board: {
          title: 'ROW_NUMBER × RANK × DENSE_RANK',
          md: `\`\`\`sql
SELECT nome, pontos,
       ROW_NUMBER() OVER (ORDER BY pontos DESC) AS rn,
       RANK()       OVER (ORDER BY pontos DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY pontos DESC) AS dense
FROM jogadores;
\`\`\`

| nome | pontos | ROW_NUMBER | RANK | DENSE_RANK |
|---|---|---|---|---|
| Ana | 100 | 1 | 1 | 1 |
| Bia | 90 | 2 | 2 | 2 |
| Caio | 90 | 3 | 2 | 2 |
| Duda | 80 | 4 | **4** | **3** |

- \`ROW_NUMBER\`: numeração única; entre empatados, a ordem é **arbitrária** — adicione um desempate no ORDER BY.
- \`RANK\`: empatados dividem a posição e a seguinte é **pulada**, como num pódio olímpico (dois ouros, nenhuma prata).
- \`DENSE_RANK\`: empatados dividem a posição, **sem** buracos.
- Outras: \`NTILE(4)\` (quartis), \`PERCENT_RANK()\`, \`CUME_DIST()\`.

| Pergunta | Função |
|---|---|
| "o pedido mais recente de cada cliente" (exatamente 1) | \`ROW_NUMBER\` + desempate |
| "top 3, e quem empatar no 3º lugar também entra" | \`RANK() <= 3\` |
| "os produtos com os 3 **maiores preços distintos**" | \`DENSE_RANK() <= 3\` |

> [!dica] \`RANK() <= N\` equivale ao \`FETCH FIRST N ROWS WITH TIES\` do SQL padrão (PostgreSQL 13+, Oracle) e ao \`TOP N WITH TIES\` do SQL Server.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora o padrão que mais cai em entrevista de SQL: o **top-N por grupo**. "O pedido mais recente de cada cliente", "os 3 mais vendidos por categoria".',
          'Ele tem até nome próprio em inglês: *greatest-n-per-group*.',
        ],
        board: {
          title: 'Top-N por grupo',
          md: `\`\`\`sql
WITH ranqueados AS (
  SELECT p.*,
         ROW_NUMBER() OVER (
           PARTITION BY cliente_id            -- a numeração recomeça em cada cliente
           ORDER BY criado_em DESC, id DESC   -- mais recente primeiro; id desempata
         ) AS rn
  FROM pedidos p
)
SELECT id, cliente_id, criado_em
FROM ranqueados
WHERE rn = 1;                                 -- rn <= 3 para o top-3
\`\`\`

| Técnica | Problema |
|---|---|
| \`WHERE criado_em = (SELECT MAX(criado_em) ... do mesmo cliente)\` | subconsulta por linha; empate no máximo devolve 2 linhas |
| \`GROUP BY cliente_id\` + \`MAX(criado_em)\` | perde as outras colunas (as colunas "nuas" só funcionam no SQLite) |
| \`DISTINCT ON (cliente_id)\` | atalho elegante, mas só no PostgreSQL |
| **\`ROW_NUMBER\` numa CTE** | ✅ portátil, controla empates e generaliza para N |

> [!dica] Snowflake, BigQuery, DuckDB e Databricks têm \`QUALIFY\`, um "WHERE para window functions": \`SELECT ... QUALIFY ROW_NUMBER() OVER (...) = 1\`, sem subconsulta. O SQLite e o PostgreSQL não têm.`,
        },
      },
      {
        type: 'say',
        text: [
          'Para comparar uma linha com a **anterior** ou a **próxima**, existem `LAG` e `LEAD`. Adeus, self-join!',
          'Servem para "variação em relação ao mês anterior", "dias desde a última compra" e afins.',
        ],
        board: {
          title: 'LAG, LEAD e companhia',
          md: `\`\`\`sql
SELECT cliente_id, criado_em, total,
       LAG(criado_em) OVER w                                    AS compra_anterior,
       julianday(criado_em) - julianday(LAG(criado_em) OVER w)  AS dias_desde_anterior,
       LEAD(total, 1, 0) OVER w                                 AS proximo_total  -- 0 se não houver
FROM pedidos
WINDOW w AS (PARTITION BY cliente_id ORDER BY criado_em);
\`\`\`

- \`LAG(expr, n, padrão)\`: o valor de *n* linhas **antes** (n = 1 e padrão NULL, se omitidos); \`LEAD\`: *n* linhas **depois**.
- Na primeira linha de cada partição, \`LAG\` devolve NULL (ou o padrão) — e qualquer conta com ele também dá NULL.
- \`WINDOW w AS (...)\` dá nome a uma janela para reusá-la (padrão SQL; SQLite e PostgreSQL aceitam).
- Outras funções "de valor": \`FIRST_VALUE\`, \`LAST_VALUE\`, \`NTH_VALUE\`.
- \`LAG\` pega a **linha** anterior, não o mês ou dia anterior do calendário: se um mês não teve vendas, ele não vira linha — e o "anterior" do mês seguinte é o último que teve.

> [!atencao] \`LAST_VALUE(x) OVER (ORDER BY data)\` quase sempre devolve a **própria linha**: com o frame padrão, a janela termina na linha atual. Use \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\` — ou \`FIRST_VALUE\` com a ordem invertida.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Soma acumulada é uma janela com ORDER BY: `SUM(valor) OVER (ORDER BY data)`. Simples… até aparecer um **empate**.',
          { text: 'Com ORDER BY e sem frame explícito, o padrão é **RANGE**, que trata as linhas empatadas como se fossem uma só. Pouca gente sabe disso.', mood: 'surprised' },
        ],
        board: {
          title: 'Frames: ROWS × RANGE',
          md: `\`\`\`sql
SELECT id, data, valor,
       SUM(valor) OVER (ORDER BY data)     AS padrao,        -- RANGE implícito
       SUM(valor) OVER (ORDER BY data, id) AS com_desempate
FROM movimentos;
\`\`\`

| id | data | valor | padrao | com_desempate |
|---|---|---|---|---|
| 1 | 03-01 | 100 | 100 | 100 |
| 2 | 03-02 | 50 | **80** | 150 |
| 3 | 03-02 | -70 | **80** | 80 |
| 4 | 03-05 | 20 | 100 | 100 |

As linhas 2 e 3 têm a mesma data: são *peers*. No frame \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\` (o padrão), "até a linha atual" inclui **todos os peers dela** — as duas recebem 80, e o saldo intermediário de 150 nunca aparece.

| Frame | O que entra na janela |
|---|---|
| sem ORDER BY | a partição inteira |
| \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\` | o padrão com ORDER BY: tudo até a linha atual **e seus peers** |
| \`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\` | tudo até a linha atual, contando linhas físicas |
| \`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` | a linha atual e as 2 anteriores (média móvel de 3) |
| \`RANGE BETWEEN 7 PRECEDING AND CURRENT ROW\` | linhas cujo valor do ORDER BY está até 7 unidades antes |
| \`GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW\` | o grupo de peers atual e o anterior |

- \`ROWS\` sozinho **não** resolve: entre peers, a ordem física é arbitrária, e o saldo intermediário pode mudar a cada execução. O conserto de verdade é um ORDER BY **único** (\`data, id\`); o \`ROWS\` explícito documenta a intenção.

> [!sabia] O frame padrão ser \`RANGE\` (e não \`ROWS\`) vem do padrão SQL e vale no PostgreSQL, no SQLite, no SQL Server e no Oracle. É por isso que uma "soma acumulada" às vezes repete o mesmo valor em duas linhas e depois "pula" — e por isso \`ROWS\` costuma ser até mais rápido: o banco não precisa procurar os peers.`,
        },
      },
      {
        type: 'say',
        text: [
          'Um truque avançado que impressiona em entrevista: achar **sequências consecutivas**, como os dias seguidos em que um usuário fez login.',
          'O problema tem nome — *gaps and islands* — e a solução cabe em uma subtração.',
        ],
        board: {
          title: 'Gaps and islands',
          md: `Numa sequência sem buracos, o dia e o ROW_NUMBER crescem **juntos**; logo, a diferença entre eles é constante dentro de cada ilha e muda a cada lacuna:

| dia | nº do dia | ROW_NUMBER | dia − ROW_NUMBER |
|---|---|---|---|
| 03-01 | 1 | 1 | **0** |
| 03-02 | 2 | 2 | **0** |
| 03-03 | 3 | 3 | **0** |
| 03-07 | 7 | 4 | **3** |
| 03-08 | 8 | 5 | **3** |

\`\`\`sql
WITH dias AS (
  SELECT DISTINCT usuario_id, date(momento) AS dia    -- um registro por dia
  FROM logins
),
numerados AS (
  SELECT usuario_id, dia,
         julianday(dia) - ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY dia) AS ilha
  FROM dias
)
SELECT usuario_id, MIN(dia) AS inicio, MAX(dia) AS fim, COUNT(*) AS dias_seguidos
FROM numerados
GROUP BY usuario_id, ilha;
\`\`\`

Resultado para o exemplo: uma ilha de 03-01 a 03-03 (3 dias) e outra de 03-07 a 03-08 (2 dias).

> [!sabia] O padrão **gaps and islands** resolve uma família inteira de problemas: sessões de navegação, períodos em que um servidor ficou fora do ar, sequências de vitórias, faixas de números de nota fiscal faltando. Outra variação usa \`LAG\`: marque 1 quando a linha **não** continua a anterior e faça uma soma acumulada dessas marcas — cada valor da soma é uma ilha.`,
        },
      },
      {
        type: 'say',
        text: [
          'Consultas com janelas crescem rápido. Para organizá-las, use **CTEs**: subconsultas com nome, declaradas no `WITH`.',
          'Cada CTE é um passo com nome, e a consulta vira uma receita lida de cima para baixo.',
        ],
        board: {
          title: 'CTEs: dando nome aos passos',
          md: `\`\`\`sql
WITH vendas_mes AS (                     -- passo 1: agrega por mês
  SELECT strftime('%Y-%m', criado_em) AS mes, SUM(total) AS faturamento
  FROM pedidos
  WHERE status = 'pago'
  GROUP BY mes
),
com_anterior AS (                        -- passo 2: usa o passo 1
  SELECT mes, faturamento,
         LAG(faturamento) OVER (ORDER BY mes) AS anterior
  FROM vendas_mes
)
SELECT mes, faturamento,
       ROUND((faturamento - anterior) * 100.0 / anterior, 1) AS crescimento_pct
FROM com_anterior;
\`\`\`

- Uma CTE pode usar as anteriores; a consulta final pode usar todas.
- **CTE × subconsulta**: mesmo poder, mas a CTE se lê de cima para baixo e pode ser referenciada **mais de uma vez**.
- **CTE × view**: a CTE só existe durante aquela consulta; a view fica salva no banco.

> [!dica] Até a versão 11, o PostgreSQL **sempre** materializava as CTEs — uma "barreira de otimização": filtros de fora não entravam nelas. Da 12 em diante, CTEs simples são incorporadas à consulta, e dá para escolher com \`AS MATERIALIZED\` / \`AS NOT MATERIALIZED\` (sintaxe que o SQLite também aceita, desde a 3.35).`,
        },
      },
      {
        type: 'say',
        text: [
          'E o truque final: a **CTE recursiva**. Ela percorre hierarquias de profundidade desconhecida — organogramas, categorias, dependências.',
          'Pense num laço: uma **âncora** dá o ponto de partida, um **passo recursivo** anda um nível, e tudo se repete até não aparecer nada novo.',
        ],
        board: {
          title: 'WITH RECURSIVE: descendo um organograma',
          md: `\`\`\`text
Marta (1, CEO)
├── Rui (2)
│   ├── Sofia (4)
│   └── Téo (5)
│       └── Vera (7)
└── Paula (3)
    └── Ivo (6)
\`\`\`

\`\`\`sql
WITH RECURSIVE equipe(id, nome, nivel) AS (
  -- âncora: o ponto de partida
  SELECT id, nome, 0
  FROM funcionarios
  WHERE nome = 'Rui'

  UNION ALL

  -- passo recursivo: quem responde a alguém já encontrado
  SELECT f.id, f.nome, e.nivel + 1
  FROM funcionarios f
  JOIN equipe e ON f.gerente_id = e.id
)
SELECT * FROM equipe;     -- Rui (0), Sofia (1), Téo (1), Vera (2)
\`\`\`

Como o banco executa:

1. Roda a **âncora**: \`{Rui}\`.
2. Roda o **passo recursivo** usando só as linhas **novas**: \`{Sofia, Téo}\`.
3. Repete com as novas: \`{Vera}\` → depois, nada novo: **para**.

**Ciclos** (A gerente de B, B gerente de A) viram laço infinito. Defesas: limite de profundidade (\`WHERE e.nivel < 20\`); guardar o caminho percorrido e não revisitar; ou \`UNION\` no lugar de \`UNION ALL\` — que só ajuda se as linhas se repetem **por inteiro** (sem nível ou caminho). O PostgreSQL 14+ tem a cláusula \`CYCLE\`.

CTE recursiva também **gera dados**, como um calendário para preencher com LEFT JOIN os dias sem venda:

\`\`\`sql
WITH RECURSIVE dias(d) AS (
  SELECT '2024-03-01'
  UNION ALL
  SELECT date(d, '+1 day') FROM dias WHERE d < '2024-03-07'
)
SELECT d FROM dias;
\`\`\`

> [!sabia] Apesar do nome, uma CTE "recursiva" roda como uma **iteração**: o banco mantém uma *working table* só com as linhas novas de cada rodada — a **avaliação semi-ingênua** (*semi-naive evaluation*), herdada do Datalog. Por isso o passo recursivo enxerga só a rodada anterior, e não o resultado inteiro acumulado.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Ranking, top-N, LAG, frames e recursão.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'db-win-q1',
        concept: 'RANK × DENSE_RANK',
        say: 'Primeira: empates num ranking de premiação.',
        prompt: `Vendas do mês: **Ana 500, Bia 500, Caio 400, Duda 400, Edu 300**.

A regra do prêmio: *"ganham as 3 primeiras posições, como num pódio olímpico — empatados dividem a posição, e a posição seguinte é pulada"*.

Qual filtro implementa a regra — e quantas pessoas ganham?`,
        options: [
          { text: '`ROW_NUMBER() OVER (ORDER BY vendas DESC) <= 3` → 3 pessoas', why: 'ROW_NUMBER ignora empates: numera de 1 a 5 e corta no meio do empate entre Caio e Duda — um deles fica de fora de forma **arbitrária**.' },
          { text: '`RANK() OVER (ORDER BY vendas DESC) <= 3` → 4 pessoas', correct: true, why: 'RANK imita o pódio: 1, 1, 3, 3, 5. Ana e Bia dividem o 1º lugar, o 2º é pulado, Caio e Duda dividem o 3º; Edu fica em 5º.' },
          { text: '`DENSE_RANK() OVER (ORDER BY vendas DESC) <= 3` → 5 pessoas', why: 'DENSE_RANK não pula posições (1, 1, 2, 2, 3): Edu vira 3º e leva prêmio — contra a regra do pódio.' },
          { text: '`RANK() OVER (ORDER BY vendas DESC) <= 3` → 3 pessoas', why: 'RANK não corta empates: Caio e Duda têm os dois rank 3, então os dois entram — são 4 pessoas.' },
        ],
        explanation: 'RANK imita o pódio (1, 1, 3, 3, 5); DENSE_RANK "comprime" as posições (1, 1, 2, 2, 3); ROW_NUMBER ignora empates (1 a 5, com ordem arbitrária entre empatados). ROW_NUMBER é ótimo quando você quer **exatamente** N linhas — e aí precisa de desempate —, mas péssimo para "empatou, leva". `RANK() <= N` equivale a `FETCH FIRST N ROWS WITH TIES`.',
      },
      {
        type: 'sql',
        id: 'db-win-q2',
        concept: 'Greatest-n-per-group',
        title: 'O pedido mais recente de cada cliente',
        say: 'Agora o clássico top-N por grupo, com um empate de propósito.',
        prompt: `A tela de atendimento mostra o **pedido mais recente de cada cliente**: colunas \`cliente_id\`, \`id\`, \`criado_em\` e \`total\` — **uma linha por cliente**.

Se dois pedidos do mesmo cliente tiverem exatamente o mesmo \`criado_em\`, vale o de **maior \`id\`**. Repare que o \`id\` não acompanha a data: não dá para usar "o maior id" como atalho. (A ordem das linhas não importa.)`,
        schema: PEDIDOS_CLIENTES,
        variants: [
          `INSERT INTO pedidos (id, cliente_id, criado_em, total) VALUES
  (9, 9, '2024-03-12 10:00', 64.00),
  (10, 7, '2024-03-12 10:00', 5.00),
  (11, 12, '2024-03-01 00:00', 250.00);`,
          `INSERT INTO pedidos (id, cliente_id, criado_em, total) VALUES
  (20, 7, '2024-03-20 09:00', 70.00),
  (15, 7, '2024-03-20 09:00', 30.00);`,
        ],
        starter: `-- o pedido mais recente de cada cliente (uma linha por cliente)
SELECT cliente_id, id, criado_em, total
FROM pedidos
ORDER BY cliente_id, criado_em DESC;
`,
        solution: `WITH ranqueados AS (
  SELECT cliente_id, id, criado_em, total,
         ROW_NUMBER() OVER (
           PARTITION BY cliente_id
           ORDER BY criado_em DESC, id DESC
         ) AS rn
  FROM pedidos
)
SELECT cliente_id, id, criado_em, total
FROM ranqueados
WHERE rn = 1;`,
        solutionExplanation: `\`ROW_NUMBER\` numera os pedidos **dentro de cada cliente** (\`PARTITION BY\`), do mais recente para o mais antigo; o \`id DESC\` resolve o empate de horário do cliente 3. Como a janela é calculada **depois** do WHERE, a numeração vai numa CTE e o filtro \`rn = 1\` fica do lado de fora.

- Com \`RANK()\`, os dois pedidos empatados do cliente 3 ficariam com 1 — duas linhas para o mesmo cliente.
- Com \`MAX(id)\` por cliente, o cliente 9 sairia errado: o pedido 7 tem id maior, mas é mais antigo que o 4.
- Para o top-3 de cada cliente, basta trocar para \`rn <= 3\`.`,
        reviews: [
          {
            when: sql => /\bmax\s*\(/i.test(sql) && !/\bover\s*\(/i.test(sql),
            text: 'Você resolveu com `MAX()` em vez de uma window function. Se usou colunas "nuas" no GROUP BY, isso só funciona no SQLite; e o caminho "junta com o MAX" precisa de mais um nível só para desempatar. `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` trata o empate num lugar só e vira top-N trocando `= 1` por `<= N`.',
            concept: 'Greatest-n-per-group',
          },
        ],
        hints: [
          'Numere os pedidos **dentro de cada cliente**, do mais recente para o mais antigo: `ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY ...)`.',
          'Não dá para filtrar a window function no WHERE da mesma consulta (ela é calculada depois). Calcule-a numa CTE e filtre `rn = 1` do lado de fora.',
          'O desempate vai dentro da janela: `ORDER BY criado_em DESC, id DESC`. Com `RANK()`, os dois pedidos empatados ficariam com 1.',
        ],
      },
      {
        type: 'sql',
        id: 'db-win-q3',
        concept: 'LAG/LEAD',
        title: 'Crescimento mês a mês',
        say: 'Agora uma janela sobre dados agregados: faturamento mensal com LAG.',
        prompt: `O financeiro quer o **faturamento mensal** (só pedidos \`'pago'\`) e a **variação** em relação ao mês anterior. Colunas:

- \`mes\`, no formato \`'2024-03'\`;
- \`faturamento\`: soma do \`total\` no mês;
- \`faturamento_anterior\`: o faturamento do mês anterior;
- \`variacao\`: \`faturamento - faturamento_anterior\`.

No primeiro mês, as duas últimas colunas ficam NULL. Um mês sem nenhuma venda paga não aparece — e o "anterior" do mês seguinte passa a ser o último mês que teve vendas. **Ordene por mês.**`,
        schema: PEDIDOS_MESES,
        variants: [
          "UPDATE pedidos SET status = 'cancelado' WHERE criado_em LIKE '2024-03%';",
          `INSERT INTO pedidos (id, cliente_id, criado_em, status, total) VALUES
  (9, 7, '2023-12-20 10:00', 'pago', 80.00),
  (10, 9, '2024-05-05 10:00', 'pago', 35.50),
  (11, 3, '2024-04-20 10:00', 'pago', 60.00);`,
        ],
        orderMatters: true,
        starter: `SELECT strftime('%Y-%m', criado_em) AS mes, SUM(total) AS faturamento
FROM pedidos
GROUP BY mes
ORDER BY mes;
`,
        solution: `WITH mensal AS (
  SELECT strftime('%Y-%m', criado_em) AS mes,
         SUM(total) AS faturamento
  FROM pedidos
  WHERE status = 'pago'
  GROUP BY mes
)
SELECT mes,
       faturamento,
       LAG(faturamento) OVER (ORDER BY mes)               AS faturamento_anterior,
       faturamento - LAG(faturamento) OVER (ORDER BY mes) AS variacao
FROM mensal
ORDER BY mes;`,
        solutionExplanation: `A CTE \`mensal\` resolve a agregação (uma linha por mês, só pedidos pagos); a consulta de fora aplica \`LAG\` sobre essas linhas, na ordem do mês. Como \`'2023-12' < '2024-01'\` em texto, o formato \`AAAA-MM\` ordena certo até na virada do ano.

- Na primeira linha, \`LAG\` devolve NULL, e \`faturamento - NULL\` também é NULL — sem tratamento especial.
- Dá para fazer sem CTE, aplicando a janela direto sobre a agregação: \`LAG(SUM(total)) OVER (ORDER BY strftime('%Y-%m', criado_em))\` numa consulta com GROUP BY. Funciona porque as janelas são calculadas depois do GROUP BY.
- Se o pedido fosse "mês anterior **do calendário**" (NULL quando o mês anterior não teve vendas), você geraria os meses com uma CTE recursiva e faria LEFT JOIN — \`LAG\` sempre olha a **linha** anterior.`,
        reviews: [
          {
            when: sql => !/\b(lag|lead)\s*\(/i.test(sql),
            text: 'Você achou o mês anterior sem `LAG` (com subconsulta ou self-join). Funciona, mas cada linha dispara uma busca extra e a lógica fica mais difícil de ler. `LAG(faturamento) OVER (ORDER BY mes)` resolve numa passada ordenada.',
            concept: 'LAG/LEAD',
          },
        ],
        hints: [
          'Primeiro agregue por mês (`strftime(\'%Y-%m\', criado_em)`), só com pedidos pagos — de preferência numa CTE.',
          'Sobre o resultado mensal, `LAG(faturamento) OVER (ORDER BY mes)` traz o valor da linha anterior.',
          '`variacao` é `faturamento - LAG(faturamento) OVER (ORDER BY mes)`; na primeira linha, NULL menos qualquer coisa já dá NULL.',
        ],
      },
      {
        type: 'sql',
        id: 'db-win-q4',
        concept: 'Frames ROWS × RANGE',
        title: 'Extrato com saldo acumulado',
        say: 'Um extrato bancário: o saldo depois de cada movimento. Rode o SQL do editor e confira o dia 03-02.',
        prompt: `Monte o **extrato** da carteira de cashback: \`cliente_id\`, \`id\`, \`data\`, \`valor\` e o **saldo** depois daquele movimento.

- O saldo é acumulado **por cliente**, na ordem de \`data\` e, no mesmo dia, na ordem de \`id\`.
- Ordene o resultado por \`cliente_id\`, \`data\` e \`id\`.

O SQL no editor tem **dois** problemas. Encontre e conserte.`,
        schema: MOVIMENTOS,
        variants: [
          `INSERT INTO movimentos (id, cliente_id, data, valor) VALUES
  (7, 9, '2024-03-04', 25.00),
  (8, 7, '2024-03-05', 10.00),
  (9, 7, '2024-03-05', -5.50),
  (10, 12, '2024-03-06', 40.00);`,
          "UPDATE movimentos SET data = '2024-03-10' WHERE cliente_id = 7;",
        ],
        orderMatters: true,
        starter: `SELECT cliente_id, id, data, valor,
       SUM(valor) OVER (ORDER BY data) AS saldo
FROM movimentos
ORDER BY cliente_id, data, id;
`,
        solution: `SELECT cliente_id, id, data, valor,
       SUM(valor) OVER (
         PARTITION BY cliente_id
         ORDER BY data, id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS saldo
FROM movimentos
ORDER BY cliente_id, data, id;`,
        solutionExplanation: `Os dois problemas do SQL original:

1. **Sem \`PARTITION BY cliente_id\`**, o saldo acumulava os movimentos de todos os clientes juntos.
2. **Empates de data**: com \`ORDER BY data\` e o frame padrão (\`RANGE ... CURRENT ROW\`), os movimentos 2 e 4 do cliente 7 — ambos em 03-02 — são *peers* e recebem o mesmo saldo (90). O saldo de 70, depois do débito de 30, nunca aparecia.

Com \`ORDER BY data, id\` não sobra empate, e RANGE e ROWS passam a dar o mesmo resultado. O \`ROWS\` explícito documenta a intenção ("linha a linha") e poupa o banco de procurar peers. Só o \`ROWS\`, sem o \`id\`, não bastaria: entre peers, a ordem física é arbitrária.`,
        reviews: [
          {
            when: sql => {
              const janelas = sql.match(/(?:\bover|\bwindow\s+\w+\s+as)\s*\(([^)]*)\)/gi) || [];
              return janelas.some(j => /order\s+by/i.test(j) && !/order\s+by[^)]*\bid\b/i.test(j));
            },
            text: 'Sua janela ordena só por `data`. Entre movimentos do mesmo dia, a ordem fica **indefinida**: mesmo com `ROWS`, o saldo intermediário pode mudar de uma execução para outra. Termine o ORDER BY da janela com uma coluna única: `ORDER BY data, id`.',
            concept: 'Frames ROWS × RANGE',
          },
          {
            when: sql => !/\bover\b/i.test(sql),
            text: 'Funciona, mas sem window function o saldo vira uma subconsulta que relê todo o histórico do cliente para **cada** movimento — O(n²). `SUM(valor) OVER (PARTITION BY ... ORDER BY ...)` calcula o acumulado numa passada ordenada.',
            concept: 'Window functions',
          },
        ],
        hints: [
          'Rode o SQL do editor e olhe o cliente 7 em 03-02: os dois movimentos ficaram com o **mesmo** saldo. E o cliente 9 começa com um saldo que não é dele.',
          'O saldo é por cliente: falta `PARTITION BY cliente_id` na janela.',
          'Com ORDER BY e sem frame, o padrão é `RANGE ... CURRENT ROW`, que inclui os empatados (*peers*). Desempate com `ORDER BY data, id` — e, se quiser deixar explícito, `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.',
        ],
      },
      {
        type: 'order',
        id: 'db-win-q5',
        concept: 'CTE recursiva',
        say: 'Antes da última, a mecânica: o que o banco faz ao rodar um WITH RECURSIVE?',
        prompt: 'Coloque em ordem o que o banco faz ao executar um `WITH RECURSIVE`.',
        items: [
          'Executa o membro **âncora** e guarda as linhas como a primeira tabela de trabalho',
          'Executa o membro **recursivo** usando só as linhas da tabela de trabalho',
          'Acrescenta as linhas produzidas ao resultado; elas viram a nova tabela de trabalho',
          'Repete o passo recursivo até uma rodada não produzir nenhuma linha',
          'Entrega o resultado acumulado para a consulta principal',
        ],
        explanation: 'A âncora roda **uma vez** e semeia a tabela de trabalho. Cada rodada do membro recursivo enxerga só as linhas **novas** da rodada anterior (avaliação semi-ingênua), e o que ela produz vira a próxima tabela de trabalho. Quando uma rodada não produz nada, a recursão termina e a consulta principal lê o acumulado. Se os dados tiverem um ciclo, as rodadas nunca ficam vazias — daí o limite de profundidade.',
      },
      {
        type: 'sql',
        id: 'db-win-q6',
        concept: 'CTE recursiva',
        title: 'A árvore de categorias',
        say: 'Última! Uma CTE recursiva de verdade, percorrendo a árvore de categorias da loja.',
        prompt: `As categorias formam uma árvore: \`pai_id\` aponta para a categoria-mãe, e as raízes têm \`pai_id\` NULL.

\`\`\`text
Eletrônicos (1)                Casa (6)
├── Informática (2)            └── Cozinha (8)
│   ├── Notebooks (4)
│   └── Periféricos (5)
│       └── Teclados (7)
└── Áudio (3)
\`\`\`

Liste **"Eletrônicos" e todas as suas descendentes**, em qualquer profundidade, com as colunas:

- \`id\` e \`nome\`;
- \`nivel\`: 0 para Eletrônicos, 1 para as filhas, 2 para as netas…;
- \`caminho\`: no formato \`'Eletrônicos > Informática > Notebooks'\`.

Parta do **nome** da categoria, não de um id fixo. (A ordem das linhas não importa.)`,
        schema: CATEGORIAS,
        variants: [
          "UPDATE categorias SET nome = CASE id WHEN 1 THEN 'Casa' WHEN 6 THEN 'Eletrônicos' END WHERE id IN (1, 6);",
          `INSERT INTO categorias (id, nome, pai_id) VALUES
  (9, 'Mecânicos', 7),
  (10, 'Fones', 3),
  (11, 'Sem fio', 10),
  (12, 'Jardim', 6);`,
        ],
        starter: `WITH RECURSIVE arvore(id, nome, nivel, caminho) AS (
  -- 1) âncora: a categoria 'Eletrônicos' (nível 0)

  UNION ALL

  -- 2) passo recursivo: as filhas das categorias já encontradas

)
SELECT id, nome, nivel, caminho
FROM arvore;
`,
        solution: `WITH RECURSIVE arvore(id, nome, nivel, caminho) AS (
  SELECT id, nome, 0, nome
  FROM categorias
  WHERE nome = 'Eletrônicos'

  UNION ALL

  SELECT c.id, c.nome, a.nivel + 1, a.caminho || ' > ' || c.nome
  FROM categorias c
  JOIN arvore a ON c.pai_id = a.id
)
SELECT id, nome, nivel, caminho
FROM arvore;`,
        solutionExplanation: `A **âncora** encontra Eletrônicos pelo nome, com nível 0 e o caminho começando pelo próprio nome. O **passo recursivo** junta \`categorias\` com a própria CTE: as filhas (\`c.pai_id = a.id\`) das linhas achadas na rodada anterior, com \`nivel + 1\` e o caminho da mãe concatenado com \`' > '\` e o nome da filha.

Rodadas: {Eletrônicos} → {Informática, Áudio} → {Notebooks, Periféricos} → {Teclados} → {} — fim. A profundidade não precisa ser conhecida: nos dados ocultos há um nível a mais, e a mesma consulta dá conta.

Na vida real, proteja-se de ciclos (um \`pai_id\` errado cria um laço): \`WHERE a.nivel < 50\` no passo recursivo é um seguro barato.`,
        reviews: [
          {
            when: sql => /\bunion\b(?!\s+all\b)/i.test(sql),
            text: 'Você usou `UNION` em vez de `UNION ALL`. Numa árvore não há linhas repetidas, e o `UNION` obriga o banco a comparar cada linha nova com as anteriores. E, como cada linha carrega `nivel` e `caminho`, ele nem protegeria contra ciclos. Prefira `UNION ALL` com um limite de profundidade.',
            concept: 'CTE recursiva',
          },
        ],
        hints: [
          'Âncora: `SELECT id, nome, 0, nome FROM categorias WHERE nome = \'Eletrônicos\'` — nível 0, e o caminho começa com o próprio nome.',
          'Passo recursivo: junte `categorias c` com a própria CTE — `JOIN arvore a ON c.pai_id = a.id` — para achar as filhas das linhas já encontradas.',
          'No passo, o nível é `a.nivel + 1` e o caminho é `a.caminho || \' > \' || c.nome`. Una as duas partes com `UNION ALL`.',
        ],
      },
      {
        type: 'say',
        mood: 'cheer',
        text: [
          'Você fechou a unidade de SQL! Window functions calculam **sem colapsar**; nos empates, escolha entre ROW_NUMBER, RANK e DENSE_RANK — e cuidado com o frame **RANGE** padrão.',
          'Top-N por grupo é ROW_NUMBER numa CTE, e hierarquias saem com **WITH RECURSIVE**. Na próxima unidade, vamos fazer tudo isso ficar rápido: índices e planos de execução!',
        ],
        board: null,
      },
    ],
  });
})();
