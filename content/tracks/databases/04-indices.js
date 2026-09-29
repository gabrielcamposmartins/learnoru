(function () {
  // Dataset da questão do índice composto.
  const PEDIDOS = `CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  total REAL NOT NULL
);
INSERT INTO pedidos (id, cliente_id, status, criado_em, total) VALUES
  (1, 7, 'pago', '2024-03-01 10:15', 120.00),
  (2, 3, 'pendente', '2024-03-02 09:40', 80.50),
  (3, 7, 'cancelado', '2024-03-03 18:05', 42.00),
  (4, 7, 'pago', '2024-03-05 14:30', 310.00),
  (5, 9, 'pago', '2024-03-05 16:00', 15.90),
  (6, 3, 'pago', '2024-03-07 11:20', 99.90),
  (7, 7, 'pago', '2024-03-09 08:45', 18.00),
  (8, 9, 'pendente', '2024-03-10 20:10', 250.00),
  (9, 7, 'pendente', '2024-03-11 13:00', 64.00),
  (10, 3, 'pago', '2024-03-12 17:35', 12.50);`;

  const CONSULTA_PEDIDOS = "SELECT id, total, criado_em FROM pedidos WHERE cliente_id = 7 AND status = 'pago' ORDER BY criado_em DESC";

  // Dataset da questão do covering index.
  const USUARIOS = `CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  pais TEXT NOT NULL,
  plano TEXT NOT NULL,
  bio TEXT
);
CREATE INDEX idx_usuarios_pais ON usuarios(pais);
INSERT INTO usuarios (email, nome, pais, plano, bio) VALUES
  ('ana@ex.com', 'Ana', 'BR', 'pro', 'Dev backend há 8 anos'),
  ('bruno@ex.com', 'Bruno', 'BR', 'free', NULL),
  ('carla@ex.com', 'Carla', 'PT', 'pro', 'SRE e corredora'),
  ('davi@ex.com', 'Davi', 'BR', 'free', 'Estudante de computação'),
  ('eva@ex.com', 'Eva', 'AR', 'team', NULL),
  ('fabio@ex.com', 'Fábio', 'BR', 'team', 'Tech lead'),
  ('gabi@ex.com', 'Gabi', 'BR', 'pro', 'Dados e SQL'),
  ('hugo@ex.com', 'Hugo', 'PT', 'free', NULL);`;

  const CONSULTA_PAINEL = "SELECT plano, COUNT(*) AS total FROM usuarios WHERE pais = 'BR' GROUP BY plano";

  Game.registerModule('databases', {
    id: 'indices',
    title: 'Índices e planos de execução',
    kind: 'lesson',
    level: 3,
    order: 10,
    unit: 'performance',
    summary: 'Como uma B-tree acha uma linha entre milhões, por que a ordem das colunas importa e como ler o EXPLAIN QUERY PLAN.',
    concepts: ['B-tree', 'Índice composto', 'Prefixo mais à esquerda', 'Covering index', 'EXPLAIN QUERY PLAN'],
    takeaways: [
      'Um índice B-tree mantém as chaves **ordenadas**: acha um valor em O(log n) leituras de página e entrega intervalos e ordenações "de graça".',
      'Índice composto só ajuda a partir da coluna **mais à esquerda**: primeiro as colunas de **igualdade**, depois a de ordenação e, por último, a de intervalo.',
      'Um **covering index** tem todas as colunas que a consulta usa: o banco responde sem tocar na tabela (`USING COVERING INDEX`).',
      'Função na coluna, `LIKE` com `%` no início, `OR` com coluna sem índice e baixa seletividade levam a **SCAN** — escreva filtros *SARGable*.',
      'Todo índice cobra na **escrita** e no espaço: crie a partir das consultas reais e confira com `EXPLAIN QUERY PLAN`.',
    ],
    glossary: [
      {
        term: 'B-tree',
        aliases: ['B-trees', 'btree', 'B+tree', 'B+ tree', 'árvore B', 'arvore B'],
        definition: 'Árvore balanceada, larga e rasa, usada pela maioria dos índices: cada nó é uma página com centenas de chaves **ordenadas**, então 3–4 níveis bastam para milhões de linhas e qualquer valor é achado em O(log n).',
      },
      {
        term: 'Seletividade',
        aliases: ['seletivo', 'seletiva', 'seletivos', 'selectivity'],
        definition: 'Fração das linhas que um filtro devolve. Filtro muito seletivo (`email = ?`, 1 linha) faz o índice valer a pena; pouco seletivo (`ativo = 1` em 95% das linhas) faz o banco preferir ler a tabela inteira.',
      },
      {
        term: 'Índice composto',
        aliases: ['índices compostos', 'indice composto', 'composite index', 'índice multicoluna', 'prefixo mais à esquerda', 'leftmost prefix'],
        definition: 'Índice sobre várias colunas, ordenado pela 1ª, depois pela 2ª, e assim por diante. Só é usado a partir de um **prefixo à esquerda**: `(a, b, c)` serve para filtros em `a`, `a + b` ou `a + b + c`, mas não em `b` sozinho.',
      },
      {
        term: 'Covering index',
        aliases: ['covering indexes', 'índice de cobertura', 'indice de cobertura', 'índices de cobertura', 'index-only scan'],
        definition: 'Índice que contém **todas** as colunas que a consulta usa (filtro, ordenação e SELECT). O banco responde lendo só o índice, sem o *lookup* na tabela — no SQLite aparece como `USING COVERING INDEX`.',
      },
      {
        term: 'SARGable',
        aliases: ['sargable', 'sargabilidade', 'search argument'],
        definition: '*Search ARGument ABLE*: filtro que o banco consegue transformar em busca no índice. Em geral, é a coluna **sozinha** de um lado da comparação — `criado_em >= ?` é SARGable; `date(criado_em) = ?` não é.',
      },
      {
        term: 'EXPLAIN QUERY PLAN',
        aliases: ['plano de execução', 'planos de execução', 'query plan', 'EXPLAIN ANALYZE'],
        definition: 'Comando que mostra **como** o banco vai executar uma consulta: `SCAN` (varre tudo) ou `SEARCH` (busca por índice), qual índice, se é *covering* e se precisa ordenar num temporário (`USE TEMP B-TREE`).',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia da ferramenta número 1 de performance em banco de dados: o **índice**.',
          'Sem índice, para achar os pedidos de um cliente o banco lê a tabela **inteira**. Com 10 milhões de linhas, isso dói.',
        ],
        board: {
          title: 'Por que índices existem',
          md: `A consulta mais comum do seu sistema:

\`\`\`sql
SELECT id, total FROM pedidos WHERE cliente_id = 42;
\`\`\`

| | Sem índice | Com índice em \`cliente_id\` |
|---|---|---|
| Estratégia | **full scan**: lê cada linha e testa o filtro | desce uma árvore até as entradas de \`42\` |
| Custo | O(n) — os 10 milhões de linhas | O(log n) — 3 ou 4 páginas + as linhas achadas |
| No plano (SQLite) | \`SCAN pedidos\` | \`SEARCH pedidos USING INDEX ... (cliente_id=?)\` |

É o mesmo princípio do **índice remissivo** de um livro: em vez de folhear 800 páginas, você vai ao fim, acha "transação → p. 412" e pula direto.

> [!dica] Índice é uma **estrutura de dados extra**, mantida pelo banco, que troca espaço em disco e custo de escrita por leituras muito mais rápidas.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Quase todo índice relacional é uma **B-tree** — mais precisamente, uma variante chamada B+tree.',
          'É uma árvore **larga e rasa**: cada nó é uma página de disco com centenas de chaves ordenadas. Por isso 3 ou 4 níveis bastam para milhões de linhas.',
        ],
        board: {
          title: 'Por dentro de uma B-tree',
          md: `\`\`\`text
                    [ 40 | 80 ]                     ← raiz (1 página)
          ┌──────────────┼───────────────┐
     [ 10 | 25 ]     [ 50 | 65 ]     [ 90 | 120 ]   ← nós internos
      │    │    │        ...             ...
 [3 7 9] → [10 18 22] → [25 31 37] → ...            ← folhas: chaves ORDENADAS
                                                      + rowid de cada linha,
                                                      encadeadas lado a lado
\`\`\`

- **Busca por igualdade** (\`= 18\`): raiz → nó interno → folha. Cada passo é **uma** leitura de página.
- **Fan-out alto**: com ~500 chaves por página, 3 níveis endereçam 500³ ≈ **125 milhões** de chaves.
- **Intervalos** (\`BETWEEN\`, \`>\`, "começa com"): acha o início e caminha pelas folhas encadeadas.
- **Ordem de graça**: as chaves já estão ordenadas, então \`ORDER BY\` na coluna indexada dispensa ordenar.

No SQLite, a própria tabela é uma B-tree ordenada pelo \`rowid\`, e cada índice é **outra** B-tree com \`(colunas do índice, rowid)\`. Achar a entrada no índice e depois buscar a linha na tabela é o **lookup**. (No MySQL/InnoDB a tabela é organizada pela chave primária — *clustered index*; no PostgreSQL ela é um *heap* e o índice aponta para a posição física da linha.)`,
        },
      },
      {
        type: 'say',
        text: [
          'Índice não é mágica: ele compensa quando o filtro devolve **poucas** linhas. Isso se chama **seletividade**.',
          'Se o filtro traz metade da tabela, pular do índice para a tabela linha a linha sai mais caro do que ler tudo em sequência.',
        ],
        board: {
          title: 'Seletividade: quando o índice compensa',
          md: `| Filtro | Linhas devolvidas | Índice ajuda? |
|---|---|---|
| \`email = 'ana@ex.com'\` | 1 em 10 milhões | ✅ muito — altíssima seletividade |
| \`cliente_id = 42\` | ~30 | ✅ sim |
| \`status = 'pendente'\` (2% das linhas) | 200 mil | 🤔 depende — pode valer |
| \`ativo = 1\` (95% das linhas) | 9,5 milhões | ❌ não — o full scan ganha |

- Cada linha achada pelo índice custa um **acesso aleatório** à tabela; ler a tabela em sequência é bem mais barato por linha. Regra de bolso: acima de **~5–20%** das linhas, o banco costuma preferir o scan.
- O otimizador decide por **custo**, usando estatísticas (\`ANALYZE\` no SQLite e no PostgreSQL). Estatística velha → plano ruim.
- Para colunas desbalanceadas existe o **índice parcial**, que indexa só o que interessa:

\`\`\`sql
-- só os 2% pendentes entram no índice: menor e mais útil
CREATE INDEX idx_pedidos_pendentes ON pedidos(criado_em) WHERE status = 'pendente';
\`\`\``,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora o ponto que mais cai em entrevista: o **índice composto**, com várias colunas.',
          'Ele é ordenado pela 1ª coluna, depois pela 2ª dentro de cada valor da 1ª, e assim por diante — como uma **lista telefônica** ordenada por sobrenome e depois por nome.',
          'Consequência: ele só serve a partir da coluna **mais à esquerda**. Achar todo mundo chamado "Ana" numa lista ordenada por sobrenome exige ler a lista inteira.',
        ],
        board: {
          title: 'A regra do prefixo mais à esquerda',
          md: `\`\`\`sql
CREATE INDEX idx_ped ON pedidos(cliente_id, status, criado_em);
\`\`\`

| Filtro | Usa o índice? | Plano (SQLite) |
|---|---|---|
| \`cliente_id = 7\` | ✅ prefixo de 1 coluna | \`(cliente_id=?)\` |
| \`cliente_id = 7 AND status = 'pago'\` | ✅ prefixo de 2 colunas | \`(cliente_id=? AND status=?)\` |
| \`... AND status = 'pago' ORDER BY criado_em\` | ✅ e **sem ordenar** | sem \`TEMP B-TREE\` |
| \`cliente_id = 7 AND criado_em > '2024-03-01'\` | ⚠️ só \`cliente_id\`; a data é filtrada depois | \`(cliente_id=?)\` |
| \`cliente_id > 7 AND status = 'pago'\` | ⚠️ intervalo na 1ª coluna "corta" as seguintes | \`(cliente_id>?)\` |
| \`status = 'pago'\` | ❌ não é prefixo | \`SCAN pedidos\` |

**Ordem das colunas:** primeiro as de **igualdade**, depois a de **ordenação** e, por último, a de **intervalo**. A documentação do MongoDB chama isso de regra **ESR** (*Equality, Sort, Range*), e ela vale para qualquer B-tree.

> [!atencao] Um índice em \`(a, b)\` torna um índice só em \`(a)\` **redundante**: o prefixo já atende. Índice duplicado é custo de escrita sem benefício nenhum.

Alguns bancos (Oracle, MySQL 8 e o SQLite depois de um \`ANALYZE\`) têm o **skip scan**, que "pula" a 1ª coluna quando ela tem pouquíssimos valores distintos — no SQLite aparece como \`ANY(coluna)\` no plano. É exceção; não projete contando com ele.`,
        },
      },
      {
        type: 'say',
        text: [
          'Mesmo achando as linhas pelo índice, o banco ainda precisa ir à **tabela** buscar as colunas que não estão nele. Esse vaivém é o *lookup*, e ele custa um acesso aleatório por linha.',
          { text: 'Agora, se o índice tiver **todas** as colunas que a consulta usa, o lookup desaparece. É o **índice de cobertura** — o *covering index*.', mood: 'surprised' },
        ],
        board: {
          title: 'Covering index: respondendo só com o índice',
          md: `\`\`\`sql
-- consulta do painel de assinaturas
SELECT plano, COUNT(*) FROM usuarios WHERE pais = 'BR' GROUP BY plano;
\`\`\`

| Índice | Plano | O que acontece |
|---|---|---|
| \`(pais)\` | \`SEARCH usuarios USING INDEX idx (pais=?)\` + \`USE TEMP B-TREE FOR GROUP BY\` | acha no índice, vai à tabela buscar \`plano\` **linha a linha** e agrupa num temporário |
| \`(pais, plano)\` | \`SEARCH usuarios USING COVERING INDEX idx (pais=?)\` | lê **só o índice**, e as entradas já vêm agrupadas por plano |

- No SQLite, o \`rowid\` (a \`INTEGER PRIMARY KEY\`) está em **toda** entrada de índice: \`SELECT id, email FROM usuarios WHERE pais = ?\` é coberta por \`(pais, email)\`.
- No PostgreSQL e no SQL Server dá para pendurar colunas só para cobrir, sem que façam parte da chave de busca: \`CREATE INDEX ... ON usuarios (pais) INCLUDE (plano)\`.
- Não exagere: índice "gordo" (com colunas de texto longo) ocupa espaço, cache e escrita.

> [!sabia] O que o covering index permite se chama **index-only scan**. No PostgreSQL há uma pegadinha pouco conhecida: por causa do MVCC, o índice não sabe se a linha é visível para a sua transação, então o banco consulta o **visibility map**. Se a página não estiver marcada como "toda visível" (tabela sem \`VACUUM\` recente), ele volta à tabela mesmo assim — veja o contador \`Heap Fetches\` no \`EXPLAIN ANALYZE\`.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora os casos em que você **tem** o índice e o banco não usa. Quase sempre é a consulta que esconde a coluna do índice.',
          'O índice guarda os valores **da coluna**. Se você filtra por uma transformação dela, o banco não tem onde procurar.',
        ],
        board: {
          title: 'Quando o índice NÃO é usado',
          md: `| Consulta (índice em \`email\` ou em \`criado_em\`) | Por que vira SCAN | Como reescrever |
|---|---|---|
| \`WHERE lower(email) = 'ana@ex.com'\` | função aplicada à coluna | normalize na escrita, ou crie um **índice de expressão**: \`ON usuarios(lower(email))\` |
| \`WHERE date(criado_em) = '2024-03-05'\` | função na coluna | intervalo: \`criado_em >= '2024-03-05' AND criado_em < '2024-03-06'\` |
| \`WHERE preco * 1.1 > 100\` | conta sobre a coluna | isole a coluna: \`preco > 100 / 1.1\` |
| \`WHERE email LIKE '%@gmail.com'\` | \`%\` no **início**: não há prefixo para descer a árvore | índice de trigramas (\`pg_trgm\`), busca textual, ou guarde o domínio numa coluna |
| \`WHERE email = 'ana@ex.com' OR nome = 'Ana'\` | um lado do \`OR\` não tem índice → o banco varre de qualquer jeito | índice nos dois lados (*MULTI-INDEX OR*) ou \`UNION\` |
| \`WHERE status <> 'cancelado'\` | desigualdade devolve quase tudo | filtre pelo que **é**: \`status IN ('pago', 'enviado')\` |

> [!sabia] Filtros que o banco consegue transformar em busca no índice são chamados de **SARGable** (*Search ARGument ABLE*). A regra de ouro: deixe a coluna **sozinha** de um lado da comparação.

> [!atencao] No SQLite até \`LIKE 'ana%'\` ignora um índice comum: o \`LIKE\` não diferencia maiúsculas e o índice é BINARY. Use \`GLOB 'ana*'\`, um intervalo, ou um índice \`COLLATE NOCASE\`. No PostgreSQL, o equivalente é criar o índice com \`text_pattern_ops\`.`,
        },
      },
      {
        type: 'say',
        text: [
          'Se índice acelera leitura, por que não indexar tudo? Porque **cada índice é outra árvore** que precisa ser atualizada em todo INSERT, UPDATE e DELETE.',
          'Uma tabela com 8 índices faz 9 escritas por INSERT — e todos disputam a mesma memória de cache.',
        ],
        board: {
          title: 'O preço de cada índice',
          md: `| Operação | Custo extra, por índice |
|---|---|
| \`INSERT\` | inserir uma entrada na B-tree (às vezes dividindo páginas — *page split*) |
| \`UPDATE\` de coluna indexada | remover a entrada antiga e inserir a nova |
| \`DELETE\` | remover a entrada |
| Espaço e memória | índices disputam o *buffer pool* com os dados |

- Crie índices a partir das **consultas reais** — as mais frequentes e as mais lentas —, não "por via das dúvidas".
- Remova índices **não usados** e **redundantes**. No PostgreSQL, \`idx_scan = 0\` em \`pg_stat_user_indexes\` denuncia índice que nunca foi usado.
- Chave primária aleatória (UUID v4) espalha as inserções pela árvore inteira; chaves crescentes (autoincremento, **UUID v7**) inserem sempre "no fim", bem mais amigável ao cache.
- Em cargas em massa, às vezes vale **remover** os índices, carregar os dados e recriá-los no fim.`,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Por fim, a ferramenta para parar de adivinhar: o **plano de execução**. No SQLite é `EXPLAIN QUERY PLAN`; no PostgreSQL, `EXPLAIN` — e `EXPLAIN ANALYZE`, que executa de verdade e mede.',
          'Leia sempre procurando três coisas: **SCAN** onde você esperava **SEARCH**, **TEMP B-TREE** (ordenação extra) e se aparece **COVERING**.',
        ],
        board: {
          title: 'Lendo o EXPLAIN QUERY PLAN do SQLite',
          md: `\`\`\`sql
EXPLAIN QUERY PLAN
SELECT id, total FROM pedidos WHERE cliente_id = 7 ORDER BY criado_em;
\`\`\`
\`\`\`text
QUERY PLAN
|--SEARCH pedidos USING INDEX idx_pedidos_cliente (cliente_id=?)
\`--USE TEMP B-TREE FOR ORDER BY
\`\`\`

| Trecho do plano | Significado |
|---|---|
| \`SCAN pedidos\` | lê a tabela inteira (full scan) |
| \`SCAN pedidos USING INDEX idx\` | percorre o índice **inteiro**, em ordem, sem busca |
| \`SEARCH pedidos USING INDEX idx (cliente_id=?)\` | busca no índice e faz *lookup* na tabela |
| \`SEARCH pedidos USING COVERING INDEX idx (...)\` | busca só no índice, **sem** tocar na tabela |
| \`SEARCH pedidos USING INTEGER PRIMARY KEY (rowid=?)\` | vai direto à linha pela chave da tabela |
| \`USE TEMP B-TREE FOR ORDER BY\` | precisou ordenar num temporário depois |

Equivalentes no PostgreSQL: \`Seq Scan\` ≈ SCAN, \`Index Scan\` ≈ SEARCH USING INDEX, \`Index Only Scan\` ≈ COVERING, \`Sort\` ≈ TEMP B-TREE.

> [!dica] Com poucos dados o banco pode **preferir** o scan — e estar certo. Avalie planos com volume realista e estatísticas atualizadas.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Prefixo, plano, índice composto, covering index e armadilhas.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'db-idx-q1',
        concept: 'Prefixo mais à esquerda',
        say: 'Primeira: a regra do prefixo. Olhe a ordem das colunas do índice.',
        prompt: `Existe o índice \`CREATE INDEX idx ON pedidos(cliente_id, status, criado_em)\`.

Qual consulta **não** consegue usar esse índice para **buscar** e acaba em \`SCAN pedidos\`?`,
        options: [
          { text: "`SELECT * FROM pedidos WHERE cliente_id = 7`", why: 'Usa: `cliente_id` é a coluna mais à esquerda — plano `SEARCH ... (cliente_id=?)`.' },
          { text: "`SELECT * FROM pedidos WHERE cliente_id = 7 AND status IN ('pago', 'enviado')`", why: 'Usa as duas primeiras colunas: o `IN` vira uma busca por igualdade para cada valor — `(cliente_id=? AND status=?)`.' },
          { text: "`SELECT * FROM pedidos WHERE status = 'pago' AND criado_em >= '2024-03-01'`", correct: true, why: 'Sem filtro em `cliente_id` não há prefixo por onde entrar na árvore. É como procurar "todos os Joões" numa lista ordenada por sobrenome.' },
          { text: "`SELECT * FROM pedidos WHERE cliente_id = 7 AND criado_em >= '2024-03-01'`", why: 'Usa, mas só o prefixo `cliente_id`: como `status` ficou de fora, a data não entra na busca e é filtrada depois. Ainda é `SEARCH`.' },
        ],
        explanation: 'O índice composto é ordenado por `cliente_id`, depois por `status`, depois por `criado_em`. A busca precisa de um **prefixo contínuo a partir da esquerda**: `cliente_id`, `cliente_id + status` ou as três. Pular a 1ª coluna obriga o banco a varrer — a exceção é o *skip scan*, que depende de estatísticas e de a 1ª coluna ter pouquíssimos valores distintos.',
      },
      {
        type: 'match',
        id: 'db-idx-q2',
        concept: 'EXPLAIN QUERY PLAN',
        say: 'Agora, leitura de plano. Associe cada trecho ao que o banco está fazendo.',
        prompt: 'Associe cada trecho do `EXPLAIN QUERY PLAN` ao seu significado.',
        pairs: [
          { left: '`SCAN pedidos`', right: 'Lê a tabela inteira, linha a linha' },
          { left: '`SEARCH pedidos USING INDEX idx (cliente_id=?)`', right: 'Busca no índice e vai à tabela buscar as outras colunas' },
          { left: '`SEARCH pedidos USING COVERING INDEX idx (cliente_id=?)`', right: 'Responde só com o índice, sem tocar na tabela' },
          { left: '`USE TEMP B-TREE FOR ORDER BY`', right: 'Ordena o resultado numa estrutura temporária' },
          { left: '`SEARCH pedidos USING INTEGER PRIMARY KEY (rowid=?)`', right: 'Vai direto à linha pela chave da própria tabela' },
        ],
        explanation: '`SCAN` é varredura; `SEARCH` é busca por índice. `COVERING` indica que nem foi preciso ir à tabela (sem *lookup*). `USE TEMP B-TREE` aparece quando a ordem do índice não atende o `ORDER BY`/`GROUP BY` e o banco precisa ordenar depois. E buscar pela `INTEGER PRIMARY KEY` é o caminho mais curto: a tabela do SQLite já é uma B-tree ordenada pelo `rowid`.',
      },
      {
        type: 'sql',
        id: 'db-idx-q3',
        concept: 'Índice composto',
        title: 'O índice certo para "meus pedidos pagos"',
        say: 'Mão na massa! Crie o índice que faz essa tela voar — o plano de execução vai ser conferido.',
        prompt: `A tela **"Meus pedidos pagos"** roda esta consulta a cada acesso, e ela está lenta:

\`\`\`sql
SELECT id, total, criado_em
FROM pedidos
WHERE cliente_id = 7 AND status = 'pago'
ORDER BY criado_em DESC;
\`\`\`

Escreva um script que crie **um único índice** para ela. O plano da consulta deve:

- **buscar** pelas duas igualdades — \`cliente_id=?\` **e** \`status=?\` aparecem no \`SEARCH\`;
- **não** ter \`SCAN\` nem \`USE TEMP B-TREE\`: as linhas já devem sair do índice na ordem certa.

Dica: deixe um \`EXPLAIN QUERY PLAN SELECT ...\` no fim do script e clique em **Executar** para ver o plano antes de enviar.`,
        schema: PEDIDOS,
        variants: [
          `INSERT INTO pedidos (cliente_id, status, criado_em, total) VALUES
  (7, 'pago', '2024-03-13 09:00', 77.00),
  (7, 'pago', '2024-02-28 23:59', 5.00),
  (7, 'enviado', '2024-03-14 10:00', 33.00),
  (5, 'pago', '2024-03-14 11:00', 48.00);`,
          "DELETE FROM pedidos WHERE cliente_id = 7 AND status = 'pago';",
        ],
        mode: 'script',
        verify: [
          CONSULTA_PEDIDOS,
          "SELECT COUNT(*) AS indices_criados FROM pragma_index_list('pedidos') WHERE origin = 'c'",
        ],
        plan: {
          sql: CONSULTA_PEDIDOS,
          mustContain: ['cliente_id=?', 'status=?'],
          mustNotContain: ['SCAN', 'TEMP B-TREE'],
          hint: 'O plano precisa **buscar** por `cliente_id` e por `status` e já sair ordenado por `criado_em`: colunas de igualdade primeiro, a coluna do `ORDER BY` por último.',
        },
        starter: `-- Crie o índice aqui (pense na ordem das colunas!)
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);

-- Para ver o plano ao clicar em Executar:
EXPLAIN QUERY PLAN
SELECT id, total, criado_em FROM pedidos
WHERE cliente_id = 7 AND status = 'pago'
ORDER BY criado_em DESC;
`,
        solution: `CREATE INDEX idx_pedidos_cliente_status_data
  ON pedidos(cliente_id, status, criado_em);`,
        solutionExplanation: `As duas colunas de **igualdade** vêm primeiro (a ordem entre elas tanto faz) e a coluna do \`ORDER BY\` fecha o índice — a regra ESR. Dentro do trecho \`cliente_id = 7 AND status = 'pago'\`, as entradas já estão ordenadas por \`criado_em\`; o banco só percorre esse trecho **de trás para frente** para atender o \`DESC\`, sem ordenar nada.

- Só \`(cliente_id)\`: busca, mas filtra \`status\` na tabela e ordena num \`TEMP B-TREE\`.
- \`(cliente_id, status)\`: busca pelas duas, mas ainda ordena depois.
- Começando por \`criado_em\`: vira \`SCAN ... USING INDEX\` — percorre o índice inteiro.`,
        reviews: [
          {
            when: sql => /create\s+unique\s+index/i.test(sql),
            text: 'Você criou um índice **UNIQUE**. Aqui isso inventa uma regra de negócio falsa: um cliente pode, sim, ter dois pedidos pagos no mesmo instante, e esses INSERTs legítimos passariam a falhar. Use UNIQUE só quando a unicidade é uma regra de verdade.',
            concept: 'Índice composto',
          },
        ],
        hints: [
          'Um índice só em `cliente_id` ainda precisa conferir `status` na tabela e ordenar no fim. Quais colunas faltam nele?',
          'Ordem das colunas: primeiro as comparadas com `=`, por último a coluna do `ORDER BY` (regra ESR).',
          'O `DESC` não precisa ir no índice: a B-tree pode ser percorrida nos dois sentidos. Algo como `CREATE INDEX nome ON pedidos(cliente_id, status, criado_em);`.',
        ],
      },
      {
        type: 'sql',
        id: 'db-idx-q4',
        concept: 'Covering index',
        title: 'Covering index para o painel',
        say: 'Agora vamos eliminar o lookup de vez — e fazer uma faxina de índice redundante.',
        prompt: `O painel de assinaturas roda esta consulta o tempo todo:

\`\`\`sql
SELECT plano, COUNT(*) AS total
FROM usuarios
WHERE pais = 'BR'
GROUP BY plano;
\`\`\`

Hoje existe só \`idx_usuarios_pais\`, em \`(pais)\`: o banco acha as linhas pelo índice, mas vai à tabela buscar \`plano\` linha a linha e agrupa num temporário.

1. Crie um **covering index** para essa consulta: o plano deve mostrar \`USING COVERING INDEX\` e \`pais=?\`, sem \`SCAN\` e sem \`USE TEMP B-TREE\`.
2. **Remova** o \`idx_usuarios_pais\`, que fica redundante com o seu índice novo (regra do prefixo!). No fim, \`usuarios\` deve ter **um** índice criado por você — o \`UNIQUE\` do e-mail não conta.`,
        schema: USUARIOS,
        variants: [
          `INSERT INTO usuarios (email, nome, pais, plano, bio) VALUES
  ('ines@ex.com', 'Inês', 'BR', 'enterprise', 'CTO'),
  ('joao@ex.com', 'João', 'BR', 'free', NULL),
  ('kaio@ex.com', 'Kaio', 'BR', 'enterprise', NULL),
  ('lia@ex.com', 'Lia', 'CL', 'pro', 'Instrutora');`,
          "UPDATE usuarios SET pais = 'CL' WHERE pais = 'BR';",
        ],
        mode: 'script',
        verify: [
          CONSULTA_PAINEL,
          "SELECT COUNT(*) AS indices_criados FROM pragma_index_list('usuarios') WHERE origin = 'c'",
        ],
        plan: {
          sql: CONSULTA_PAINEL,
          mustContain: ['COVERING INDEX', 'pais=?'],
          mustNotContain: ['SCAN', 'TEMP B-TREE'],
          hint: 'O índice precisa ter **todas** as colunas da consulta: `pais` (o filtro) primeiro e `plano` (o agrupamento) logo depois — assim as entradas já saem agrupadas.',
        },
        starter: `-- 1) crie o covering index


-- 2) remova o índice que ficou redundante


EXPLAIN QUERY PLAN
SELECT plano, COUNT(*) AS total FROM usuarios WHERE pais = 'BR' GROUP BY plano;
`,
        solution: `CREATE INDEX idx_usuarios_pais_plano ON usuarios(pais, plano);
DROP INDEX idx_usuarios_pais;`,
        solutionExplanation: `\`(pais, plano)\` contém tudo o que a consulta usa: \`pais\` para a busca e \`plano\` para o agrupamento — o \`COUNT(*)\` só conta entradas. Como as entradas de \`pais = 'BR'\` já estão ordenadas por \`plano\`, o \`GROUP BY\` sai de graça, sem \`TEMP B-TREE\`, e o banco nunca toca na tabela.

O índice antigo em \`(pais)\` virou **redundante**: qualquer busca por \`pais\` pode usar o prefixo do índice novo. Mantê-lo só cobraria mais uma escrita a cada INSERT/UPDATE. Repare também que \`(pais, nome, plano)\` seria *covering*, mas agruparia num temporário — a ordem das colunas continua importando.`,
        reviews: [
          {
            when: sql => /create\s+index[^;]*\bbio\b/i.test(sql),
            text: 'Você colocou `bio` (texto livre e longo) no índice, e a consulta nem usa essa coluna. Índice "gordo" ocupa disco e cache e deixa toda escrita mais cara: inclua só as colunas de que a consulta precisa.',
            concept: 'Custo de escrita de índices',
          },
        ],
        hints: [
          'Para **cobrir** a consulta, o índice precisa das colunas do `WHERE` e do `GROUP BY` — é tudo o que ela lê.',
          'A coluna de igualdade (`pais`) vem primeiro; `plano` logo depois deixa as entradas já agrupadas, sem TEMP B-TREE.',
          '`DROP INDEX idx_usuarios_pais;` remove o antigo: tudo o que ele atendia, o novo `(pais, plano)` também atende.',
        ],
      },
      {
        type: 'mcq',
        id: 'db-idx-q5',
        concept: 'SARGable',
        say: 'Agora, armadilhas: o índice existe, mas a consulta não deixa o banco usar.',
        prompt: `A tabela \`usuarios\` tem \`CREATE INDEX idx_email ON usuarios(email)\` e **nenhum** outro índice além da chave primária.

Quais consultas **não** conseguem usar \`idx_email\` para buscar e caem em \`SCAN\`? Marque **todas**.`,
        multiple: true,
        options: [
          { text: "`WHERE lower(email) = 'ana@ex.com'`", correct: true, why: 'Função na coluna: o índice guarda `email`, não `lower(email)`. Normalize na escrita ou crie um índice de expressão.' },
          { text: "`WHERE email LIKE '%@gmail.com'`", correct: true, why: '`%` no início: não existe prefixo para descer a árvore, então só resta ler tudo.' },
          { text: "`WHERE email = 'ana@ex.com' OR nome = 'Ana'`", correct: true, why: '`nome` não tem índice: para esse lado do `OR` o banco teria de varrer a tabela de qualquer jeito — então varre uma vez só.' },
          { text: "`WHERE email IN ('ana@ex.com', 'bia@ex.com')`", why: 'Usa: `IN` com uma lista de valores vira uma busca por igualdade para cada um.' },
          { text: "`WHERE email >= 'ana' AND email < 'anb'`", why: 'Usa: é um intervalo sobre a coluna pura — a forma *SARGable* de "começa com ana".' },
        ],
        explanation: 'As que falham **escondem a coluna** atrás de uma função, não têm **prefixo** (`%` no início) ou misturam um `OR` com coluna **sem índice**. A correção é deixar a coluna sozinha de um lado da comparação (filtro *SARGable*), criar um índice de expressão quando não dá para mudar a consulta, e indexar os dois lados do `OR` (ou reescrever com `UNION`).',
      },
      {
        type: 'open',
        id: 'db-idx-q6',
        concept: 'Custo de escrita de índices',
        say: 'Última — e essa aparece muito em revisão de código.',
        prompt: 'Um colega abriu um PR criando **um índice para cada uma das 12 colunas** da tabela `pedidos`, "para garantir que toda consulta fique rápida". Como você responderia na revisão?',
        minWords: 25,
        rubric: [
          {
            label: 'Aponta o custo: **escrita** mais lenta e **espaço/memória**',
            keywords: ['escrita', 'escrever', 'insert', 'update', 'delete', 'grava', 'write', 'espaco', 'memoria', 'disco', 'armazenamento'],
            concept: 'Custo de escrita de índices',
            why: 'Cada índice é uma B-tree extra atualizada em toda escrita e disputa cache com os dados.',
          },
          {
            label: 'Lembra que colunas **pouco seletivas** não se beneficiam (o banco nem usaria o índice)',
            keywords: ['seletiv', 'nao seria usado', 'nao vai ser usado', 'nao sera usado', 'nem usa', 'poucos valores', 'booleano', 'baixa cardinalidade', 'cardinalidade'],
            concept: 'Seletividade',
            why: 'Índice em `status` ou em booleano quase nunca vence o full scan.',
          },
          {
            label: 'Explica que consultas reais precisam de índices **compostos** (ordem das colunas / prefixo)',
            keywords: ['composto', 'multicoluna', 'varias colunas', 'mais de uma coluna', 'prefixo', 'ordem das colunas', 'esquerda'],
            concept: 'Índice composto',
            why: '12 índices de uma coluna não atendem `WHERE a = ? AND b = ? ORDER BY c`; um índice composto bem ordenado atende.',
          },
          {
            label: 'Propõe partir das **consultas reais** e validar com o **plano de execução**',
            keywords: ['explain', 'plano', 'query plan', 'consultas reais', 'consultas mais', 'mais lentas', 'mais frequentes', 'medir', 'metrica', 'slow query', 'pg_stat', 'log de consultas'],
            concept: 'EXPLAIN QUERY PLAN',
            why: 'Índice se justifica por consulta medida, não "por via das dúvidas".',
          },
        ],
        modelAnswer: `Eu pediria para não aprovar assim. Cada índice é uma B-tree extra: todo INSERT, UPDATE e DELETE passa a atualizar 12 estruturas, o que deixa a **escrita** bem mais lenta, além de ocupar **espaço** em disco e **memória** de cache.

E muitos desses índices nem seriam usados: em colunas pouco **seletivas**, como \`status\` ou um booleano, o otimizador prefere o full scan. Ao mesmo tempo, índices de uma coluna só não resolvem as consultas reais, que filtram e ordenam por várias colunas — para \`WHERE cliente_id = ? AND status = ? ORDER BY criado_em\` o certo é um índice **composto**, com a ordem das colunas pensada (prefixo mais à esquerda).

Minha proposta: levantar as **consultas mais frequentes e mais lentas** (log de slow queries, \`pg_stat_statements\`), criar poucos índices compostos para elas e validar cada um com o **EXPLAIN**, removendo os que não forem usados.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Recapitulando: índice é uma **B-tree** ordenada; composto funciona pelo **prefixo mais à esquerda**, com igualdades primeiro e ordenação depois…',
          '…um **covering index** elimina a ida à tabela, filtros precisam ser **SARGable**, e cada índice cobra na escrita. Na dúvida, pergunte ao **EXPLAIN**. No próximo módulo: modelagem e o famoso N+1!',
        ],
        board: null,
      },
    ],
  });
})();
