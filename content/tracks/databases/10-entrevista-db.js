(function () {
  // Banco do marketplace usado nas questões SQL da entrevista.
  const MARKET = `CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL
);
CREATE TABLE vendedores (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL
);
CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
  titulo TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
  estoque INTEGER NOT NULL CHECK (estoque >= 0)
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  comprador_id INTEGER NOT NULL REFERENCES usuarios(id),
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'enviado', 'cancelado')),
  criado_em TEXT NOT NULL
);
CREATE TABLE itens_pedido (
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario_centavos INTEGER NOT NULL,
  PRIMARY KEY (pedido_id, produto_id)
);
INSERT INTO usuarios (id, nome) VALUES (1, 'Ana'), (2, 'Bruno'), (3, 'Carla'), (4, 'Davi');
INSERT INTO vendedores (id, nome) VALUES (1, 'Loja Aurora'), (2, 'Bazar Beta'), (3, 'Casa Cedro'), (4, 'Doce Dália');
INSERT INTO produtos (id, vendedor_id, titulo, preco_centavos, estoque) VALUES
  (1, 1, 'Caneca esmaltada', 4500, 30),
  (2, 1, 'Bule de ferro', 18900, 5),
  (3, 2, 'Caderno pontilhado', 3200, 100),
  (4, 2, 'Caneta tinteiro', 12000, 12),
  (5, 3, 'Vaso de cerâmica', 9900, 8),
  (6, 4, 'Geleia artesanal', 2800, 40);
INSERT INTO pedidos (id, comprador_id, vendedor_id, status, criado_em) VALUES
  (1, 1, 1, 'pago', '2024-03-02 10:00'),
  (2, 2, 2, 'enviado', '2024-03-05 15:30'),
  (3, 3, 3, 'pago', '2024-03-10 09:15'),
  (4, 4, 2, 'cancelado', '2024-03-12 11:00'),
  (5, 1, 2, 'pago', '2024-03-31 22:10'),
  (6, 2, 1, 'pendente', '2024-03-20 18:00'),
  (7, 3, 3, 'pago', '2024-04-01 00:05'),
  (8, 4, 4, 'enviado', '2024-02-29 23:50'),
  (9, 2, 3, 'enviado', '2024-03-18 14:00'),
  (10, 3, 4, 'pago', '2024-03-25 08:30'),
  (11, 1, 4, 'pago', '2023-03-15 12:00');
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario_centavos) VALUES
  (1, 1, 2, 4000), (1, 2, 1, 18900), (2, 3, 3, 3200), (2, 4, 1, 12000), (3, 5, 2, 9900),
  (4, 4, 3, 12000), (5, 3, 5, 2800), (6, 2, 2, 18900), (7, 5, 3, 9900), (8, 6, 10, 2800),
  (9, 5, 1, 9900), (10, 6, 2, 2800), (11, 6, 20, 2800);`;

  const CONSULTA_PAINEL = "SELECT id, comprador_id, criado_em FROM pedidos WHERE vendedor_id = 1 AND status = 'pendente' ORDER BY criado_em LIMIT 50";

  Game.registerModule('databases', {
    id: 'entrevista-db',
    title: 'Entrevista: modelagem e escala de dados',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'Projete o banco de um marketplace como numa entrevista real: schema com constraints, consulta de receita, índice parcial para o painel do vendedor, estoque sem overselling e a evolução para réplicas e sharding.',
    concepts: ['Modelagem relacional', 'Constraints', 'Consultas analíticas', 'Índice parcial', 'Escala de dados'],
    takeaways: [
      'Comece pelas **consultas e pelos números** (leitura × escrita, volume, picos): o schema e os índices saem deles.',
      'Guarde o **fato histórico** no item do pedido (preço pago, em centavos inteiros) e deixe o banco proteger as regras com `NOT NULL`, `CHECK`, `UNIQUE` e chaves estrangeiras.',
      'Datas com hora: filtre com **intervalo semiaberto** (`>= início AND < fim`), que é SARGable e não perde o último dia.',
      'Estoque sem overselling: `UPDATE ... SET estoque = estoque - ? WHERE id = ? AND estoque >= ?`, conferindo as linhas afetadas, na mesma transação do pedido.',
      'Na escala: réplicas com read-your-writes, **chave de shard** escolhida pelas consultas principais e **projeções** sincronizadas por outbox/CDC para os demais acessos.',
    ],
    glossary: [
      {
        term: 'Índice parcial',
        aliases: ['índices parciais', 'indice parcial', 'partial index', 'partial indexes'],
        definition: "Índice que só inclui as linhas que satisfazem um `WHERE` (ex.: `... WHERE status = 'pendente'`). Fica menor e mais barato de manter, e o banco só o usa quando a consulta garante a mesma condição.",
      },
      {
        term: 'Chave de shard',
        aliases: ['chaves de shard', 'shard key', 'chave de particionamento', 'partition key', 'chave de partição'],
        definition: 'Coluna (ou colunas) que decide em qual shard cada linha mora. Uma boa chave tem alta cardinalidade, distribui bem a carga e aparece nas consultas principais — senão, cada consulta vira *scatter-gather*.',
      },
      {
        term: 'Scatter-gather',
        aliases: ['scatter gather'],
        definition: 'Consulta enviada a **todos** os shards (*scatter*), cujos resultados são combinados no fim (*gather*), porque o filtro não contém a chave de shard. A latência passa a ser a do shard mais lento.',
      },
      {
        term: 'Intervalo semiaberto',
        aliases: ['intervalos semiabertos', 'half-open interval', 'intervalo meio aberto'],
        definition: "Filtro `início <= x < fim`: fecha no começo e abre no fim. Com data e hora, não perde o último dia (`BETWEEN` até `'2024-03-31'` corta `'2024-03-31 18:00'`) e emenda períodos sem sobreposição.",
      },
      {
        term: 'Snowflake ID',
        aliases: ['Snowflake IDs', 'IDs Snowflake', 'ULID', 'UUIDv7'],
        definition: 'ID de 64 bits gerado sem coordenação central e ordenado pelo tempo: bits de timestamp + id da máquina + sequência (Twitter, 2010). Resolve o autoincremento, que colide entre shards; UUIDv7 e ULID seguem a mesma ideia.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Olá! Hoje eu sou sua **entrevistadora**. Esta é uma entrevista de **modelagem e escala de dados**, de uns 45 minutos.',
          'O desafio: projetar o banco de um **marketplace**. Vou pedir schema, consultas de verdade e decisões de escala — e quero ouvir seus **trade-offs**.',
        ],
        board: {
          title: '📋 Enunciado',
          md: `**Projete o banco de dados de um marketplace** (no estilo Mercado Livre ou Etsy): vendedores cadastram produtos, compradores fazem pedidos e depois avaliam o que compraram.

| Requisitos funcionais | Números |
|---|---|
| catálogo: produtos de cada vendedor, com estoque | 2 milhões de produtos, 20 mil vendedores |
| checkout: pedido com vários itens | 100 mil pedidos/dia, pico de 20× na Black Friday |
| "meus pedidos" para o comprador | leituras ≫ escritas (~100 : 1) |
| painel do vendedor: pendentes e receita do mês | estoque **nunca** pode ser vendido além do disponível |
| avaliações: nota de 1 a 5, uma por comprador e produto | |

> [!dica] Roteiro que entrevistadores esperam: **entidades → schema com constraints → consultas principais → índices → consistência nos pontos críticos → escala**. Pense em voz alta e nomeie os trade-offs.`,
        },
      },
      {
        type: 'mcq',
        id: 'db-ent-q1',
        concept: 'Modelagem relacional',
        say: 'Vamos começar pela modelagem. Primeira decisão, e ela diz muito sobre a sua experiência:',
        prompt: 'Na tabela `itens_pedido`, como você registraria o **preço** de cada item comprado?',
        options: [
          { text: 'Copiar o preço **do momento da compra** para `itens_pedido.preco_unitario_centavos`, como inteiro em centavos.', correct: true, why: 'O item registra um **fato histórico**: quanto o cliente pagou. O preço de catálogo muda amanhã e não pode reescrever pedidos, notas fiscais e relatórios. E centavos inteiros evitam erros de arredondamento.' },
          { text: 'Não guardar: o preço já está em `produtos`, basta um JOIN — copiar violaria a normalização.', why: 'Não é duplicação: "preço pago" e "preço atual" são **fatos diferentes**. Com o JOIN, uma promoção de hoje mudaria o valor de todos os pedidos antigos.' },
          { text: 'Guardar os itens como um JSON dentro de `pedidos`, com preço e tudo.', why: 'Perde chaves estrangeiras, constraints e a capacidade de consultar "vendas por produto" de forma eficiente. JSON serve para atributos flexíveis, não para o coração do negócio.' },
          { text: 'Guardar o preço como `REAL`, em reais, que é mais legível.', why: 'Ponto flutuante não representa 0,10 exatamente: somar milhares de itens faz os centavos "derivarem". Use centavos em `INTEGER` (ou `NUMERIC`/`DECIMAL`, nos bancos que têm).' },
        ],
        explanation: 'Normalizar é eliminar a repetição **do mesmo fato**. O preço pago é outro fato — pertence ao item, assim como o endereço de entrega pertence ao pedido, não ao cadastro atual do cliente. Em entrevista, dinheiro em **centavos inteiros** (ou `DECIMAL`) e preço **copiado** no item são sinais clássicos de quem já sofreu em produção.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo. Com isso, chegamos a este schema — repare que as regras moram no **banco**, não só na aplicação.',
          'Uma decisão de domínio importante: um carrinho com produtos de três vendedores vira **três pedidos**, porque cada vendedor envia, cancela e recebe separadamente.',
        ],
        board: {
          title: 'Schema proposto',
          md: `\`\`\`sql
CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
  titulo TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
  estoque INTEGER NOT NULL CHECK (estoque >= 0)          -- rede de segurança
);
CREATE TABLE pedidos (                                    -- um pedido por vendedor
  id INTEGER PRIMARY KEY,
  comprador_id INTEGER NOT NULL REFERENCES usuarios(id),
  vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'enviado', 'cancelado')),
  criado_em TEXT NOT NULL
);
CREATE TABLE itens_pedido (
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario_centavos INTEGER NOT NULL,               -- fato histórico
  PRIMARY KEY (pedido_id, produto_id)
);
\`\`\`

- **Constraints no banco**: \`NOT NULL\`, \`CHECK\`, \`UNIQUE\` e FKs valem para **todas** as aplicações, scripts e migrações que tocam o banco — são a última linha de defesa contra bugs.
- \`vendedor_id\` em \`pedidos\` é uma desnormalização consciente: dá para chegar nele pelos itens, mas o painel do vendedor filtra por ele o tempo todo.
- Ficou faltando uma tabela… e é a sua próxima tarefa.`,
        },
      },
      {
        type: 'sql',
        id: 'db-ent-q2',
        concept: 'Constraints',
        title: 'A tabela de avaliações',
        say: 'Escreva o DDL da tabela de avaliações. Quero ver o banco garantindo as regras sozinho.',
        prompt: `Crie a tabela \`avaliacoes\` de modo que o **banco** garanta as regras:

- colunas: \`id\` (\`INTEGER PRIMARY KEY\`), \`produto_id\`, \`autor_id\`, \`nota\`, \`comentario\` e \`criado_em\` (texto);
- \`produto_id\` referencia \`produtos(id)\` e \`autor_id\` referencia \`usuarios(id)\`;
- \`nota\` é um inteiro de **1 a 5**;
- cada usuário avalia um mesmo produto **no máximo uma vez** (em produtos diferentes, pode);
- tudo é obrigatório, **menos** \`comentario\`.

A verificação tenta inserir avaliações válidas e inválidas com \`INSERT OR IGNORE\` (que pula as linhas que violam constraints) e confere o que sobrou, além das chaves estrangeiras.`,
        schema: MARKET,
        variants: [
          "INSERT INTO usuarios (id, nome) VALUES (5, 'Eva'), (6, 'Fábio');",
        ],
        mode: 'script',
        verify: [
          `INSERT OR IGNORE INTO avaliacoes (produto_id, autor_id, nota, comentario, criado_em) VALUES
  (1, 1, 5, 'Linda e resistente', '2024-03-10'),
  (1, 2, 4, NULL, '2024-03-11'),
  (2, 1, 0, 'nota zero não existe', '2024-03-12'),
  (2, 1, 6, 'nota seis também não', '2024-03-12'),
  (1, 1, 3, 'segunda avaliação da Ana no mesmo produto', '2024-03-13'),
  (3, 2, NULL, 'sem nota', '2024-03-14'),
  (3, 3, 4, 'sem data', NULL),
  (3, NULL, 4, 'sem autor', '2024-03-15'),
  (NULL, 3, 5, 'sem produto', '2024-03-15'),
  (2, 2, 5, 'Bule ótimo', '2024-03-16'),
  (2, 3, 1, NULL, '2024-03-17');
SELECT produto_id, autor_id, nota FROM avaliacoes ORDER BY produto_id, autor_id`,
          `SELECT "table", "from" FROM pragma_foreign_key_list('avaliacoes') ORDER BY "from"`,
        ],
        starter: `-- Deixe o banco garantir as regras!
CREATE TABLE avaliacoes (
  id INTEGER PRIMARY KEY,
  produto_id INTEGER,
  autor_id INTEGER,
  nota INTEGER,
  comentario TEXT,
  criado_em TEXT
);
`,
        solution: `CREATE TABLE avaliacoes (
  id INTEGER PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TEXT NOT NULL,
  UNIQUE (produto_id, autor_id)
);`,
        solutionExplanation: `Cada regra virou uma constraint:

- \`CHECK (nota BETWEEN 1 AND 5)\` barra 0 e 6 — mas **não** barra \`NULL\`: um \`CHECK\` só rejeita o que é **falso**, e \`NULL BETWEEN 1 AND 5\` é *desconhecido* (lógica de três valores). Por isso o \`NOT NULL\` é indispensável.
- \`UNIQUE (produto_id, autor_id)\` impede a segunda avaliação do mesmo autor no mesmo produto, mas deixa o Bruno avaliar dois produtos diferentes. \`UNIQUE (autor_id)\` sozinho estaria errado.
- As FKs garantem que não exista avaliação de produto ou usuário inexistente. Um \`CREATE UNIQUE INDEX\` separado teria o mesmo efeito do \`UNIQUE\` na tabela.

Em entrevista, vale citar o que **não** coube em constraint simples: "só quem comprou pode avaliar" depende de outra tabela — é regra da aplicação (ou de um trigger), idealmente verificada na mesma transação do INSERT.`,
        reviews: [
          {
            when: sql => /create\s+trigger/i.test(sql),
            text: 'Você usou um **trigger** para uma regra que uma constraint resolve. Trigger que "consulta e depois barra" pode deixar passar duplicatas sob concorrência e é mais difícil de enxergar; `UNIQUE` e `CHECK` são declarativos, atômicos e aparecem no schema.',
            concept: 'Constraints',
          },
        ],
        hints: [
          'Comece pelas chaves estrangeiras: `produto_id INTEGER NOT NULL REFERENCES produtos(id)` — e o mesmo para `autor_id` com `usuarios(id)`.',
          'A nota: `nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5)`. Sem o `NOT NULL`, uma nota nula passa pelo `CHECK` (NULL não é falso!).',
          'Uma avaliação por usuário **e** produto: `UNIQUE (produto_id, autor_id)` no fim da tabela. `comentario TEXT` fica sem `NOT NULL`.',
        ],
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Schema aprovado. Agora, as **consultas principais** — são elas que decidem os índices e, mais tarde, a estratégia de escala.',
        ],
        board: {
          title: 'Consultas principais e índices',
          md: `| Tela | Consulta | Como atender |
|---|---|---|
| Página do produto | por \`produtos.id\` | chave primária |
| Meus pedidos | \`WHERE comprador_id = ? ORDER BY criado_em DESC\` | índice \`(comprador_id, criado_em)\` |
| Painel do vendedor | pendentes do vendedor, mais antigos primeiro | índice **parcial** (já, já!) |
| Receita do mês | agregação por vendedor | réplica de leitura ou tabela de resumo |
| Busca de produtos | texto livre + filtros | motor de busca (OpenSearch), alimentado por CDC |

- Relatórios pesados não devem rodar no primário: uma **réplica** ou um banco analítico (OLAP) protegem o checkout.
- Paginação: em listas longas, prefira **cursor/keyset** (\`WHERE (criado_em, id) < (?, ?)\`) a \`OFFSET\`, que relê tudo o que pula.

> [!sabia] O índice parcial também serve para **unicidade condicional**, um truque pouco conhecido: \`CREATE UNIQUE INDEX ... ON carrinhos(usuario_id) WHERE status = 'aberto'\` garante "no máximo um carrinho aberto por usuário", e \`... WHERE deleted_at IS NULL\` faz o \`UNIQUE\` conviver com *soft delete*. Funciona no PostgreSQL e no SQLite.`,
        },
      },
      {
        type: 'sql',
        id: 'db-ent-q3',
        concept: 'Consultas analíticas',
        title: 'Top vendedores do mês',
        say: 'Vamos à primeira consulta do painel da empresa. Cuidado com as armadilhas de data e de contagem.',
        prompt: `O time comercial quer o **top 3 de vendedores por receita em março de 2024**:

- só pedidos com status \`pago\` ou \`enviado\`;
- receita = soma de \`quantidade * preco_unitario_centavos\` dos itens;
- colunas: \`vendedor\` (nome), \`pedidos\` (número de pedidos **distintos**) e \`receita_centavos\`;
- ordem: receita decrescente; em caso de empate, nome do vendedor em ordem alfabética;
- só os 3 primeiros.

Atenção: \`criado_em\` tem data **e hora**.`,
        schema: MARKET,
        variants: [
          `INSERT INTO pedidos (id, comprador_id, vendedor_id, status, criado_em) VALUES (12, 4, 1, 'enviado', '2024-03-28 10:00');
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario_centavos) VALUES (12, 1, 1, 2800);`,
          `INSERT INTO vendedores (id, nome) VALUES (5, 'Empório Éden');
INSERT INTO produtos (id, vendedor_id, titulo, preco_centavos, estoque) VALUES (7, 5, 'Queijo curado', 7000, 20);
INSERT INTO pedidos (id, comprador_id, vendedor_id, status, criado_em) VALUES
  (13, 2, 5, 'pago', '2024-03-01 00:00'),
  (14, 3, 5, 'cancelado', '2024-03-09 10:00');
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario_centavos) VALUES (13, 7, 6, 7000), (14, 7, 10, 7000);`,
        ],
        mode: 'query',
        orderMatters: true,
        starter: `SELECT v.nome AS vendedor
FROM pedidos p
JOIN vendedores v ON v.id = p.vendedor_id;
`,
        solution: `SELECT v.nome AS vendedor,
       COUNT(DISTINCT p.id) AS pedidos,
       SUM(i.quantidade * i.preco_unitario_centavos) AS receita_centavos
FROM pedidos p
JOIN itens_pedido i ON i.pedido_id = p.id
JOIN vendedores v ON v.id = p.vendedor_id
WHERE p.status IN ('pago', 'enviado')
  AND p.criado_em >= '2024-03-01' AND p.criado_em < '2024-04-01'
GROUP BY v.id, v.nome
ORDER BY receita_centavos DESC, v.nome
LIMIT 3;`,
        solutionExplanation: `As armadilhas que este dataset tem de propósito:

- **\`COUNT(*)\`** contaria **itens**, não pedidos: depois do JOIN com \`itens_pedido\`, um pedido com 2 itens vira 2 linhas. Daí o \`COUNT(DISTINCT p.id)\`.
- **\`BETWEEN '2024-03-01' AND '2024-03-31'\`** perde o pedido de \`'2024-03-31 22:10'\`: como texto, ele é **maior** que \`'2024-03-31'\`. O **intervalo semiaberto** \`>= '2024-03-01' AND < '2024-04-01'\` não tem esse problema — e continua usando índice (é SARGable).
- **\`strftime('%m', ...) = '03'\`** ignora o ano (há um pedido de março de 2023) e impede o uso de índice.
- Somar \`produtos.preco_centavos\` daria o preço **de hoje**; a receita é o preço **pago**, guardado no item.
- Sem o filtro de status, entram pedidos cancelados e pendentes.`,
        reviews: [
          {
            when: sql => /between/i.test(sql),
            text: 'Você filtrou a data com `BETWEEN`. Funciona se o limite superior tiver a hora certa, mas é frágil: `BETWEEN ... AND \'2024-03-31\'` perde tudo depois da meia-noite do dia 31. Prefira o **intervalo semiaberto**: `criado_em >= \'2024-03-01\' AND criado_em < \'2024-04-01\'`.',
            concept: 'Intervalo semiaberto',
          },
          {
            when: sql => /(strftime|date|datetime|substr)\s*\(\s*[^)]*criado_em/i.test(sql),
            text: 'Você aplicou uma função em `criado_em` no filtro. O resultado até bate, mas a função esconde a coluna do índice (o filtro deixa de ser **SARGable**) e o banco precisa varrer todos os pedidos. Compare a coluna pura com um intervalo.',
            concept: 'SARGable',
          },
        ],
        hints: [
          'Junte `pedidos` → `itens_pedido` (para a receita) → `vendedores` (para o nome) e agrupe por vendedor.',
          "Filtros: `p.status IN ('pago', 'enviado')` e o intervalo `p.criado_em >= '2024-03-01' AND p.criado_em < '2024-04-01'` — um `BETWEEN` até `'2024-03-31'` perde o dia 31 depois da meia-noite.",
          'Cada pedido tem vários itens: conte com `COUNT(DISTINCT p.id)`. Ordene por `receita_centavos DESC, v.nome` e termine com `LIMIT 3`.',
        ],
      },
      {
        type: 'sql',
        id: 'db-ent-q4',
        concept: 'Índice parcial',
        title: 'Índice parcial para o painel do vendedor',
        say: 'Agora, performance. O painel do vendedor faz uma consulta a cada 10 segundos — para cada um dos 20 mil vendedores.',
        prompt: `O painel mostra os **pedidos pendentes** do vendedor, dos mais antigos para os mais novos:

\`\`\`sql
SELECT id, comprador_id, criado_em FROM pedidos
WHERE vendedor_id = 1 AND status = 'pendente'
ORDER BY criado_em LIMIT 50;
\`\`\`

Hoje ela faz \`SCAN pedidos\`. Só **~3%** dos pedidos estão pendentes a cada momento, então indexar a tabela inteira seria desperdício. Crie **um único índice parcial** — que só contenha pedidos pendentes — de modo que o plano:

- **busque** por \`vendedor_id=?\`;
- não tenha \`SCAN\` nem \`USE TEMP B-TREE\` (as linhas já saem na ordem de \`criado_em\`).`,
        schema: MARKET,
        variants: [
          `INSERT INTO pedidos (id, comprador_id, vendedor_id, status, criado_em) VALUES
  (20, 2, 1, 'pendente', '2024-03-21 09:00'),
  (21, 4, 1, 'pendente', '2024-03-19 07:45'),
  (22, 3, 2, 'pendente', '2024-03-22 10:00');`,
          "UPDATE pedidos SET status = 'pago' WHERE status = 'pendente';",
        ],
        mode: 'script',
        verify: [
          CONSULTA_PAINEL,
          "SELECT COUNT(*) AS indices_criados, SUM(partial) AS parciais FROM pragma_index_list('pedidos') WHERE origin = 'c'",
        ],
        plan: {
          sql: CONSULTA_PAINEL,
          mustContain: ['vendedor_id=?'],
          mustNotContain: ['SCAN', 'TEMP B-TREE'],
          hint: "O índice precisa começar por `vendedor_id` (a igualdade) e seguir com `criado_em` (a ordenação). A condição `status = 'pendente'` vai no `WHERE` do próprio índice.",
        },
        starter: `-- Crie o índice PARCIAL aqui


EXPLAIN QUERY PLAN
SELECT id, comprador_id, criado_em FROM pedidos
WHERE vendedor_id = 1 AND status = 'pendente'
ORDER BY criado_em LIMIT 50;
`,
        solution: `CREATE INDEX idx_pedidos_pendentes
  ON pedidos(vendedor_id, criado_em)
  WHERE status = 'pendente';`,
        solutionExplanation: `O \`WHERE status = 'pendente'\` do índice faz dele um **índice parcial**: só os ~3% de pedidos pendentes entram. Ele fica cerca de 30 vezes menor, cabe inteiro na memória e só é atualizado quando um pedido entra ou sai de "pendente" — pedidos já enviados nem passam por ele.

Dentro do índice, as colunas seguem a regra de sempre: a igualdade (\`vendedor_id\`) primeiro e a ordenação (\`criado_em\`) depois, então o \`ORDER BY\` sai de graça. O banco só usa um índice parcial quando a consulta **garante** a condição dele: aqui, o \`status = 'pendente'\` aparece literalmente no \`WHERE\`. Se a consulta viesse com \`status = ?\`, o planejador não teria como saber, na preparação, que o valor será \`'pendente'\`.`,
        reviews: [
          {
            when: sql => /create\s+index\s+\w+\s+on\s+pedidos\s*\([^)]*\bstatus\b[^)]*\)\s*where/i.test(sql),
            text: "Você incluiu `status` nas colunas de um índice que já é filtrado por `status = 'pendente'`. Dentro dele, a coluna tem sempre o mesmo valor: só ocupa espaço em cada entrada. Deixe nas colunas apenas o que varia (`vendedor_id`, `criado_em`).",
            concept: 'Índice parcial',
          },
        ],
        hints: [
          'Um índice parcial é um `CREATE INDEX ... ON tabela(colunas) WHERE condição`: só as linhas que satisfazem a condição entram nele.',
          "A condição do índice é `status = 'pendente'`. Nas colunas, a de igualdade (`vendedor_id`) vem primeiro e a do `ORDER BY` (`criado_em`), depois.",
          "Algo como `CREATE INDEX idx_pedidos_pendentes ON pedidos(vendedor_id, criado_em) WHERE status = 'pendente';`",
        ],
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Consultas e índices resolvidos. Agora o follow-up que separa quem já viu produção de quem não viu: **consistência** no checkout.',
          'Black Friday. Um produto com uma única unidade. Três compradores clicando ao mesmo tempo.',
        ],
      },
      {
        type: 'mcq',
        id: 'db-ent-q5',
        concept: 'Lost update',
        say: 'O que você muda neste código?',
        prompt: `O checkout atual faz:

\`\`\`python
estoque = conn.execute("SELECT estoque FROM produtos WHERE id = ?", (pid,)).fetchone()[0]
if estoque >= qtd:
    conn.execute("UPDATE produtos SET estoque = ? WHERE id = ?", (estoque - qtd, pid))
    # ... cria o pedido
\`\`\`

Na Black Friday, o bule que tinha **1** unidade foi vendido para **3** pessoas. Qual correção você propõe?`,
        options: [
          { text: 'Um update **condicional e atômico**, na mesma transação do pedido: `UPDATE produtos SET estoque = estoque - :qtd WHERE id = :pid AND estoque >= :qtd`; se nenhuma linha for afetada, esgotou. O `CHECK (estoque >= 0)` fica como rede de segurança.', correct: true, why: 'O banco faz a checagem e a subtração **num passo só**, com a linha travada durante o UPDATE: só uma das três compras encontra `estoque >= 1`. As outras recebem 0 linhas afetadas e mostram "esgotado".' },
          { text: 'Guardar o estoque no Redis, que é mais rápido.', why: 'Velocidade não elimina a corrida: ler e depois gravar continua sendo *check-then-act*. E agora são duas fontes da verdade para o estoque — um dual write.' },
          { text: 'Colocar o SELECT e o UPDATE numa transação `READ COMMITTED`.', why: '`READ COMMITTED` não impede lost update: as três transações leem 1 e as três gravam 0. A transação sozinha não serializa o ciclo ler-calcular-gravar.' },
          { text: 'Deixar vender e, se o estoque ficar negativo, cancelar o pedido e mandar um e-mail de desculpas.', why: 'Com esse código o estoque nem fica negativo: as três compras gravam `1 - 1 = 0`. O overselling é **invisível** — ninguém seria avisado.' },
        ],
        explanation: 'É o **lost update** clássico: cada transação calcula o novo estoque a partir de uma leitura que já ficou velha. A correção mais simples e robusta é deixar o banco decidir, com um UPDATE condicional (*compare-and-set*) conferindo `rowcount`. Alternativas: `SELECT ... FOR UPDATE` (lock pessimista) ou uma coluna `version` (lock otimista). Sob contenção extrema, dá para reservar o estoque em lotes ou dividir o contador em várias linhas.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Último bloco: **escala**. O marketplace deu certo — muito certo.',
          'Não quero uma lista de tecnologias; quero ver você escolhendo **o que muda primeiro** e por quê.',
        ],
        board: {
          title: 'Follow-up: o marketplace cresceu 50×',
          md: `**Cenário atual**
- 5 milhões de pedidos/dia, com picos de milhares de escritas por segundo — o primário está no limite de **escrita**;
- depois de comprar, clientes às vezes **não veem** o pedido em "meus pedidos";
- relatórios de receita competem com o checkout.

**Alavancas, da mais barata para a mais cara**

| Alavanca | Resolve | Custa |
|---|---|---|
| consultas e índices | leituras lentas | quase nada |
| cache | leituras repetidas | invalidação (e dual write!) |
| réplicas de leitura | escala de leitura | replication lag |
| banco analítico (OLAP) | relatórios pesados | um pipeline de dados (CDC) |
| particionar por data na mesma máquina | tabelas enormes, expurgo | consultas sem a data |
| **sharding** | escala de escrita | consultas e transações entre shards, resharding |

> [!atencao] Com sharding, o autoincremento deixa de funcionar: dois shards gerariam o mesmo \`id\`. Use IDs gerados sem coordenação e ordenados pelo tempo — Snowflake ID, UUIDv7 ou ULID.`,
        },
      },
      {
        type: 'open',
        id: 'db-ent-q6',
        concept: 'Escala de dados',
        say: 'Me conte como você evoluiria esse banco. Seja específico nas escolhas.',
        prompt: 'Com o cenário do quadro, como você evoluiria o banco do marketplace? Fale das **réplicas** (e do bug de "meus pedidos"), da **chave de shard** dos pedidos, de como o **painel do vendedor** continuaria rápido depois do sharding e de como manter os dados derivados **sincronizados**.',
        minWords: 45,
        rubric: [
          {
            label: 'Réplicas de leitura com **read-your-writes** para o "meus pedidos" logo após a compra',
            keywords: ['read-your-writes', 'read your writes', 'ler do lider', 'le do lider', 'leitura no lider', 'ler do primario', 'le do primario', 'replication lag', 'lag de replicacao', 'replica'],
            concept: 'Read-your-writes',
            why: 'O pedido some porque a leitura vai para uma réplica atrasada; quem acabou de comprar precisa ler do líder (ou de uma réplica que já aplicou a escrita).',
          },
          {
            label: 'Escolhe a **chave de shard** dos pedidos pelas consultas principais (ex.: `comprador_id`)',
            keywords: ['comprador_id', 'chave de shard', 'shard key', 'shard por', 'sharding por', 'particionar por', 'particionamento por', 'hash do comprador'],
            concept: 'Chave de shard',
            why: '"Meus pedidos" e o checkout filtram pelo comprador: cada operação toca um shard só.',
          },
          {
            label: 'Atende o **vendedor** sem *scatter-gather*: uma projeção/tabela organizada por vendedor',
            keywords: ['scatter', 'projecao', 'tabela por vendedor', 'copia por vendedor', 'visao do vendedor', 'read model', 'modelo de leitura', 'cqrs', 'desnormaliz', 'indice global', 'pedidos_por_vendedor'],
            concept: 'Scatter-gather',
            why: 'Com pedidos particionados por comprador, os pedidos de um vendedor ficam espalhados por todos os shards; uma segunda cópia particionada por vendedor evita perguntar a todos.',
          },
          {
            label: 'Sincroniza as cópias com **outbox/CDC** e consumidores idempotentes',
            keywords: ['outbox', 'cdc', 'debezium', 'change data capture', 'idempot'],
            concept: 'Transactional outbox',
            why: 'Gravar nas duas cópias pela aplicação seria dual write; a projeção deve ser derivada do log de mudanças.',
          },
        ],
        modelAnswer: `Primeiro, o barato: índices revisados e **réplicas** de leitura para catálogo e relatórios (idealmente um banco analítico alimentado por CDC). O bug de "meus pedidos" é **replication lag**: a leitura cai numa réplica que ainda não aplicou o pedido. Resolvo com **read-your-writes**: por alguns segundos depois de uma compra, as leituras daquele usuário vão para o **líder** (ou para uma réplica que já passou da posição do log da escrita).

Como o gargalo é escrita, parto para sharding. A **chave de shard** dos pedidos seria o \`comprador_id\` (por hash): checkout e "meus pedidos" filtram por ele, então cada operação toca um shard só, e a carga se espalha entre milhões de compradores. IDs passam a ser gerados sem coordenação, como Snowflake ou UUIDv7.

O problema é o **painel do vendedor**: com os pedidos particionados por comprador, os pedidos de um vendedor ficam espalhados, e cada consulta viraria **scatter-gather** em todos os shards. Então mantenho uma **projeção** \`pedidos_por_vendedor\`, particionada por \`vendedor_id\` (é CQRS: um modelo de leitura para cada padrão de acesso).

Para sincronizar sem dual write, cada mudança de pedido gera um evento na **outbox**, na mesma transação, e um relay ou **CDC** (Debezium) publica; o consumidor que atualiza a projeção é **idempotente**, deduplicando pelo id do evento. O painel aceita alguns segundos de atraso — um trade-off que eu combinaria com o produto.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Obrigada! Vou te dar o feedback como eu escreveria para o comitê de contratação.',
        ],
        board: {
          title: 'Feedback da entrevista',
          md: `| Critério | O que um sinal forte mostra |
|---|---|
| **Modelagem** | fatos históricos no lugar certo (preço pago no item), dinheiro em centavos, regras como constraints |
| **SQL** | JOINs sem inflar contagens, intervalo semiaberto nas datas, filtros SARGable |
| **Performance** | índices a partir das consultas: ordem das colunas, índice parcial, custo de escrita |
| **Consistência** | reconhece o lost update no estoque e usa um update condicional, lock ou versão |
| **Escala** | alavancas baratas primeiro; chave de shard pelas consultas; projeções via outbox/CDC; trade-offs explícitos |

> [!sabia] Em 2012, o Instagram contou como gerava IDs direto no PostgreSQL, sem serviço central: **41 bits** de tempo em milissegundos, **13 bits** com o id do shard lógico e **10 bits** de uma sequência — até 1 024 IDs por milissegundo em cada shard. Eles também criaram **milhares de shards lógicos** (schemas do PostgreSQL) espalhados por poucos servidores físicos: crescer era só mover shards lógicos inteiros para máquinas novas, sem refazer a distribuição.`,
        },
      },
      {
        type: 'say',
        mood: 'cheer',
        text: [
          'Parabéns: essa foi uma entrevista completa de dados — do DDL ao sharding. Você passou por modelagem, SQL com armadilhas, índice parcial, lost update e escala.',
          'Revise os pontos em que perdeu estrelas e tente de novo quando quiser. Boa sorte nas entrevistas de verdade!',
        ],
        board: null,
      },
    ],
  });
})();
