(function () {
  // Dataset da questão de lock otimista.
  const PRODUTOS = `CREATE TABLE produtos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  preco REAL NOT NULL,
  estoque INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
INSERT INTO produtos (id, nome, preco, estoque, version) VALUES
  (1, 'Teclado mecânico', 199.90, 10, 3),
  (2, 'Mouse sem fio', 89.90, 25, 1),
  (3, 'Monitor 27 polegadas', 1299.00, 4, 7);
CREATE TABLE conflitos (
  id INTEGER PRIMARY KEY,
  produto_id INTEGER NOT NULL,
  usuario TEXT NOT NULL
);`;

  Game.registerModule('databases', {
    id: 'transacoes',
    title: 'Transações, isolamento e locks',
    kind: 'lesson',
    level: 3,
    order: 20,
    unit: 'consistencia',
    summary: 'ACID de verdade, níveis de isolamento e as anomalias que cada um deixa passar — de dirty read a write skew — e como MVCC e locks otimista e pessimista resolvem.',
    concepts: ['ACID', 'Níveis de isolamento', 'Write skew', 'MVCC', 'Lock otimista × pessimista'],
    takeaways: [
      'Transação é **tudo ou nada**, mas o "I" do ACID quase nunca é serializável por padrão: PostgreSQL, Oracle e SQL Server usam `READ COMMITTED`; o MySQL (InnoDB), `REPEATABLE READ`.',
      'Cada nível de isolamento é uma lista de **anomalias permitidas**: dirty read, non-repeatable read, phantom, lost update e write skew.',
      '**Write skew**: duas transações leem o mesmo dado, cada uma grava uma linha **diferente** e juntas quebram uma regra. Snapshot isolation não impede: use `SERIALIZABLE` (com retry) ou materialize o conflito com lock ou constraint.',
      '**MVCC** guarda várias versões de cada linha: leitores não bloqueiam escritores, e cada transação lê um **snapshot** consistente.',
      'Lock **pessimista** (`SELECT ... FOR UPDATE`) trava antes de mexer; **otimista** (coluna `version` + `WHERE version = ?`) detecta o conflito na escrita, pela contagem de linhas afetadas, e tenta de novo.',
    ],
    glossary: [
      {
        term: 'ACID',
        aliases: ['propriedades ACID'],
        definition: 'As quatro garantias de uma transação: **A**tomicidade (tudo ou nada), **C**onsistência (as regras valem antes e depois), **I**solamento (transações concorrentes não se atrapalham — em algum grau) e **D**urabilidade (commit confirmado sobrevive a uma queda).',
      },
      {
        term: 'Write skew',
        aliases: ['write skews', 'distorção de escrita'],
        definition: 'Anomalia em que duas transações leem o mesmo conjunto de dados, cada uma grava uma linha **diferente** com base no que leu e, juntas, violam uma regra (ex.: "pelo menos um médico de plantão"). Snapshot isolation não impede.',
      },
      {
        term: 'MVCC',
        aliases: ['multiversion concurrency control', 'multi-version concurrency control', 'controle de concorrência multiversão'],
        definition: '*Multi-Version Concurrency Control*: o banco guarda várias versões de cada linha e cada transação enxerga as versões visíveis no seu **snapshot**. Leitores não bloqueiam escritores, e vice-versa (PostgreSQL, InnoDB, Oracle).',
      },
      {
        term: 'Snapshot isolation',
        aliases: ['isolamento de snapshot', 'isolamento por snapshot'],
        definition: 'Nível em que cada transação lê uma **foto consistente** do banco tirada no início e só consegue gravar uma linha se ninguém a alterou antes (*first-committer-wins*). Evita dirty read, non-repeatable read, phantom e lost update — mas **não** o write skew.',
      },
      {
        term: 'Phantom read',
        aliases: ['phantom reads', 'phantom', 'phantoms', 'leitura fantasma', 'leituras fantasmas', 'fantasma', 'fantasmas'],
        definition: 'Anomalia em que a mesma consulta com filtro, repetida na mesma transação, devolve **linhas novas** (ou some com linhas), porque outra transação inseriu ou apagou linhas que satisfazem o filtro.',
      },
      {
        term: 'Lock pessimista',
        aliases: ['locks pessimistas', 'bloqueio pessimista', 'pessimistic locking', 'lock pessimístico'],
        definition: 'Estratégia que **trava** as linhas antes de alterá-las (`SELECT ... FOR UPDATE`): quem chega depois espera o commit. Seguro sob alta contenção, mas segura conexões, reduz a vazão e pode gerar deadlocks.',
      },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje é dia de **transações** — o motivo de o seu saldo bancário não sumir quando o servidor cai no meio de uma transferência.',
          'Transação é um grupo de comandos que o banco trata como **um só**: ou tudo acontece, ou nada acontece.',
        ],
        board: {
          title: 'Tudo ou nada: ACID',
          md: `\`\`\`python
import sqlite3

def transferir(conn, origem, destino, valor):
    with conn:  # BEGIN ... COMMIT — ou ROLLBACK se sair com exceção
        conn.execute("UPDATE contas SET saldo = saldo - ? WHERE id = ?", (valor, origem))
        conn.execute("UPDATE contas SET saldo = saldo + ? WHERE id = ?", (valor, destino))
\`\`\`

| Letra | Garante | Como o banco faz |
|---|---|---|
| **A**tomicidade | se cair no meio, **nada** é aplicado | log de *undo*/rollback |
| **C**onsistência | as regras (constraints, FKs, \`CHECK\`) valem antes e depois | constraints + a **sua** lógica |
| **I**solamento | transações concorrentes não enxergam o trabalho pela metade uma da outra — em algum **grau** | locks, MVCC |
| **D**urabilidade | commit confirmado sobrevive a uma queda de energia | WAL + \`fsync\` |

> [!dica] No \`sqlite3\` do Python, \`with conn:\` faz commit no fim ou rollback se houver exceção — mas **não** fecha a conexão.

> [!sabia] A sigla ACID é de 1983 (Härder e Reuter). Segundo Joe Hellerstein, citado no livro *Designing Data-Intensive Applications*, o **C** entrou "para a sigla funcionar": consistência é, na maior parte, responsabilidade da **aplicação** — o banco só garante as regras que você declarou.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Atomicidade é a parte fácil. O difícil é o **I**: o que uma transação enxerga enquanto outras rodam ao mesmo tempo?',
          'Isolamento perfeito é o **serializável**: o resultado é igual ao de alguma execução **em fila**. Só que isso custa caro, então os bancos oferecem níveis mais fracos — e o padrão quase nunca é o serializável.',
        ],
        board: {
          title: 'Níveis de isolamento (padrão SQL)',
          md: `| Nível | Dirty read | Non-repeatable read | Phantom |
|---|---|---|---|
| \`READ UNCOMMITTED\` | ⚠️ pode | ⚠️ pode | ⚠️ pode |
| \`READ COMMITTED\` | ✅ evita | ⚠️ pode | ⚠️ pode |
| \`REPEATABLE READ\` | ✅ evita | ✅ evita | ⚠️ pode |
| \`SERIALIZABLE\` | ✅ evita | ✅ evita | ✅ evita |

| Banco | Nível padrão |
|---|---|
| PostgreSQL, Oracle, SQL Server | \`READ COMMITTED\` |
| MySQL (InnoDB) | \`REPEATABLE READ\` |
| SQLite | serializável (um escritor por vez) |

\`\`\`sql
BEGIN ISOLATION LEVEL SERIALIZABLE;   -- PostgreSQL: por transação
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;   -- MySQL: por sessão
\`\`\`

> [!atencao] O padrão SQL define os níveis pelas anomalias que eles **proíbem**, e cada banco implementa do seu jeito. No PostgreSQL, \`REPEATABLE READ\` é *snapshot isolation* (não tem phantom) e \`READ UNCOMMITTED\` se comporta como \`READ COMMITTED\`. Leia a documentação do **seu** banco.`,
        },
      },
      {
        type: 'say',
        text: [
          'Vamos às anomalias clássicas. Leia cada linha do tempo de cima para baixo: T1 e T2 são transações rodando ao mesmo tempo.',
          'Repare que nas três alguém toma uma decisão com base num dado que **muda por baixo dos pés**.',
        ],
        board: {
          title: 'Dirty read, non-repeatable read e phantom',
          md: `\`\`\`text
DIRTY READ — lê o que ainda não foi confirmado
T1: UPDATE contas SET saldo = 0 WHERE id = 1
T2:                      SELECT saldo FROM contas WHERE id = 1  → 0
T1: ROLLBACK             (T2 decidiu com um valor que nunca existiu)

NON-REPEATABLE READ — a mesma linha muda entre duas leituras
T1: SELECT saldo FROM contas WHERE id = 1  → 100
T2:                      UPDATE contas SET saldo = 50 WHERE id = 1; COMMIT
T1: SELECT saldo FROM contas WHERE id = 1  → 50

PHANTOM — o mesmo filtro devolve linhas novas
T1: SELECT COUNT(*) FROM plantoes WHERE dia = '2024-03-10'  → 2
T2:                      INSERT INTO plantoes (..., '2024-03-10'); COMMIT
T1: SELECT COUNT(*) FROM plantoes WHERE dia = '2024-03-10'  → 3
\`\`\`

| Anomalia | Problema real | Nível mínimo que evita |
|---|---|---|
| Dirty read | relatório soma dinheiro de uma transferência que foi desfeita | \`READ COMMITTED\` |
| Non-repeatable read | fechamento de caixa lê o saldo duas vezes e os números não batem | \`REPEATABLE READ\` |
| Phantom | a checagem "cabe mais um?" conta 2, mas na hora de gravar já são 3 | \`SERIALIZABLE\` (ou snapshot) |`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Agora a anomalia mais comum em código de aplicação: o **lost update**. É o ciclo *ler → calcular em Python → gravar*.',
          'Duas vendas simultâneas leem estoque 10, as duas gravam 9 — e uma venda simplesmente some.',
        ],
        board: {
          title: 'Lost update: o ciclo ler-calcular-gravar',
          md: `\`\`\`python
estoque = conn.execute("SELECT estoque FROM produtos WHERE id = ?", (pid,)).fetchone()[0]
conn.execute("UPDATE produtos SET estoque = ? WHERE id = ?", (estoque - 1, pid))   # 💥
\`\`\`
\`\`\`text
T1: SELECT estoque → 10
T2:                      SELECT estoque → 10
T1: UPDATE ... SET estoque = 9; COMMIT
T2:                      UPDATE ... SET estoque = 9; COMMIT   ← deveria ser 8
\`\`\`

| Correção | Como fica |
|---|---|
| **Update atômico** (a melhor, quando dá) | \`UPDATE produtos SET estoque = estoque - 1 WHERE id = ? AND estoque > 0\` |
| **Lock pessimista** | \`SELECT ... FOR UPDATE\` antes de calcular: a outra transação espera |
| **Lock otimista** | coluna \`version\`: \`UPDATE ... WHERE id = ? AND version = ?\` |
| **Detecção pelo banco** | no PostgreSQL, \`REPEATABLE READ\` aborta a segunda transação (*could not serialize access due to concurrent update*) |

> [!atencao] O \`REPEATABLE READ\` do MySQL/InnoDB **não** detecta lost update: o \`UPDATE\` sempre enxerga a versão mais recente da linha, e o valor calculado a partir do snapshot antigo sobrescreve o da outra transação sem erro.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E agora a anomalia que derruba gente experiente: o **write skew**.',
          'Não tem dirty read, não tem lost update, cada transação grava uma linha **diferente**… e mesmo assim a regra de negócio quebra.',
        ],
        board: {
          title: 'Write skew: os médicos de plantão',
          md: `Regra do hospital: **pelo menos um** médico de plantão. Alice e Bob estão de plantão e os dois passam mal ao mesmo tempo.

\`\`\`text
T1 (Alice)                                  T2 (Bob)
SELECT COUNT(*) FROM medicos                SELECT COUNT(*) FROM medicos
 WHERE de_plantao → 2                        WHERE de_plantao → 2
"tem outro, posso sair"                     "tem outro, posso sair"
UPDATE medicos SET de_plantao = false       UPDATE medicos SET de_plantao = false
 WHERE nome = 'Alice'                        WHERE nome = 'Bob'
COMMIT ✅                                   COMMIT ✅   → ninguém de plantão!
\`\`\`

- Padrão: **ler → decidir → gravar**, e a gravação de um muda a **premissa** da leitura do outro.
- Como as linhas gravadas são diferentes, não há conflito de escrita: *snapshot isolation* deixa passar.
- Outros casos: duas reservas da mesma sala no mesmo horário, saque duplo em contas "irmãs", dois jogadores ocupando a mesma casa do tabuleiro.

| Correção | Quando usar |
|---|---|
| \`SERIALIZABLE\` + retry do erro de serialização | solução geral; o banco aborta uma das duas |
| \`SELECT ... FOR UPDATE\` nas linhas **lidas** | a premissa depende de linhas que existem (os médicos) |
| **materializar o conflito** ou constraint | a premissa é a **ausência** de linhas (sala livre): não há linha para travar |

> [!sabia] O termo *write skew* nasceu no artigo **"A Critique of ANSI SQL Isolation Levels"** (Berenson, Bernstein, Gray e outros, 1995), que mostrou que os níveis do padrão SQL deixavam anomalias de fora. Por anos, o \`SERIALIZABLE\` do Oracle foi, na verdade, *snapshot isolation* — e deixa passar o write skew. O PostgreSQL só ganhou um serializável de verdade em 2011 (versão 9.1), com o **SSI** (*Serializable Snapshot Isolation*).`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Como os bancos modernos isolam transações sem travar tudo? Com **MVCC**: em vez de sobrescrever uma linha, eles criam uma **nova versão** dela.',
          'Cada transação enxerga só as versões que existiam no seu **snapshot**. Assim, quem lê nunca espera por quem escreve.',
        ],
        board: {
          title: 'MVCC e snapshot isolation',
          md: `\`\`\`text
conta 1 — versões guardadas pelo banco
  v1: saldo = 100   criada pela tx 90    apagada pela tx 105
  v2: saldo =  70   criada pela tx 105   (atual)

tx 100 (começou antes do commit da 105) → enxerga v1: saldo = 100
tx 110 (começou depois)                 → enxerga v2: saldo = 70
\`\`\`

- **Leitores não bloqueiam escritores, e escritores não bloqueiam leitores.** Dois escritores na **mesma linha** ainda disputam: sob snapshot isolation, o segundo a gravar é abortado (*first-committer-wins*).
- \`READ COMMITTED\` tira um snapshot **por comando**; \`REPEATABLE READ\`/snapshot isolation, um **por transação**.
- Versões velhas precisam de faxina: \`VACUUM\` no PostgreSQL, *purge* do *undo log* no InnoDB. Uma transação esquecida aberta por horas impede a limpeza e **incha** as tabelas.

> [!dica] No SQLite há um só escritor por vez. Se a transação vai gravar, comece com \`BEGIN IMMEDIATE\`: ela pega o lock de escrita logo no início, em vez de ler primeiro e falhar com \`SQLITE_BUSY\` ao tentar gravar.`,
        },
      },
      {
        type: 'say',
        text: [
          'Por fim, as duas famílias de controle de concorrência que você vai usar no código: **pessimista** e **otimista**.',
          'O pessimista trava antes, "vai que alguém mexe". O otimista não trava nada e só confere, na hora de gravar, se alguém mexeu.',
        ],
        board: {
          title: 'Lock pessimista × lock otimista',
          md: `\`\`\`sql
-- PESSIMISTA (PostgreSQL/MySQL): trava a linha até o COMMIT
BEGIN;
SELECT saldo FROM contas WHERE id = 1 FOR UPDATE;   -- quem quiser esta linha espera
UPDATE contas SET saldo = saldo - 30 WHERE id = 1;
COMMIT;

-- OTIMISTA: sem trava; a versão lida vai no WHERE
SELECT id, titulo, version FROM docs WHERE id = 7;           -- version = 3
UPDATE docs SET titulo = 'Novo', version = version + 1
 WHERE id = 7 AND version = 3;          -- 0 linhas afetadas = alguém salvou antes
\`\`\`

| | Pessimista | Otimista |
|---|---|---|
| Quando age | antes de ler (\`FOR UPDATE\`) | na escrita (\`WHERE version = ?\`) |
| No conflito | espera na fila | 0 linhas afetadas → reler e tentar de novo, ou avisar o usuário |
| Bom para | contenção alta, operações curtas | conflito raro, usuário "pensando" por minutos num formulário |
| Riscos | deadlock, conexões presas, vazão menor | tempestade de retries sob contenção alta |

Variações úteis: \`FOR UPDATE NOWAIT\` (falha em vez de esperar) e \`FOR UPDATE SKIP LOCKED\` (pula as linhas travadas — perfeito para filas de jobs). Nos ORMs: \`select_for_update()\` no Django, \`version_id_col\` no SQLAlchemy, \`@Version\` no JPA. Em HTTP, \`ETag\` + \`If-Match\` é o mesmo lock otimista.

> [!atencao] O lock otimista só protege se **toda** escrita conferir e incrementar a \`version\`. Um script de manutenção que faz \`UPDATE\` "por fora" reabre a porta para o lost update.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Anomalias, write skew, lock otimista em SQL e um mini-MVCC em Python.', icon: '🎯' },
      {
        type: 'match',
        id: 'db-tx-q1',
        concept: 'Anomalias de isolamento',
        say: 'Aquecimento: associe cada anomalia ao que acontece nela.',
        prompt: 'Associe cada **anomalia de concorrência** à sua descrição.',
        pairs: [
          { left: 'Dirty read', right: 'Lê um valor que outra transação ainda não confirmou — e pode desfazer' },
          { left: 'Non-repeatable read', right: 'Relê a mesma linha na mesma transação e o valor mudou' },
          { left: 'Phantom', right: 'Repete uma consulta com filtro e aparecem linhas novas' },
          { left: 'Lost update', right: 'Duas transações leem, calculam e gravam a mesma linha; uma escrita some' },
          { left: 'Write skew', right: 'Cada transação grava uma linha diferente, mas juntas quebram uma regra' },
        ],
        explanation: 'As três primeiras são as anomalias **de leitura** do padrão SQL. **Lost update** e **write skew** são anomalias **de escrita**, descritas só em 1995 no artigo que criticou o padrão: no lost update, as duas transações disputam a **mesma** linha (snapshot isolation detecta); no write skew, cada uma grava uma linha **diferente** a partir da mesma premissa — e só o serializável, um lock nas linhas lidas ou uma constraint impedem.',
      },
      {
        type: 'mcq',
        id: 'db-tx-q2',
        concept: 'Write skew',
        say: 'Um bug real de sistema de reservas. O que aconteceu aqui?',
        prompt: `Um sistema de reservas de salas usa PostgreSQL com \`REPEATABLE READ\` (snapshot isolation). Cada reserva roda:

\`\`\`sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM reservas
 WHERE sala = 3 AND inicio < '10:00' AND fim > '09:00';   -- 0 → livre
INSERT INTO reservas (sala, inicio, fim, pessoa) VALUES (3, '09:00', '10:00', 'Ana');
COMMIT;
\`\`\`

Ana e Bruno reservaram a sala 3, das 9h às 10h, **no mesmo instante**. Os dois commits passaram e a sala ficou com duas reservas. O que aconteceu e como corrigir?`,
        options: [
          { text: '**Write skew** com fantasma: as duas leram "nenhuma reserva" e inseriram linhas **novas** e diferentes. Use `SERIALIZABLE` (com retry do erro de serialização) ou uma constraint que proíba sobreposição, como a `EXCLUDE USING gist` do PostgreSQL.', correct: true, why: 'É o padrão ler → decidir → gravar com premissa quebrada. Como nenhuma linha existente foi alterada pelas duas, o snapshot isolation não vê conflito. O `SERIALIZABLE` (SSI) detecta a dependência e aborta uma delas; a constraint faz o próprio banco recusar a segunda reserva.' },
          { text: '**Dirty read**: uma transação leu a reserva ainda não confirmada da outra. Basta usar `READ COMMITTED`.', why: '`REPEATABLE READ` já impede dirty read — e o problema é o contrário: nenhuma das duas **viu** a reserva da outra. Baixar para `READ COMMITTED` não muda nada.' },
          { text: '**Lost update**: basta acrescentar `FOR UPDATE` ao `SELECT COUNT(*)`.', why: 'Nenhuma linha foi sobrescrita. E `FOR UPDATE` trava linhas que **existem**: aqui a premissa é a **ausência** de linhas, então não há o que travar (o PostgreSQL nem aceita `FOR UPDATE` com funções de agregação).' },
          { text: '**Deadlock**: o banco deveria ter abortado uma delas; é um bug do PostgreSQL.', why: 'Ninguém esperou por ninguém, então não houve deadlock. É o comportamento documentado do snapshot isolation: como as escritas não se cruzam, as duas transações podem fazer commit.' },
        ],
        explanation: 'Write skew aparece sempre que uma transação **lê**, **decide** e **grava**, e a gravação de outra transação invalida a premissa dessa leitura. Quando a premissa depende de linhas que existem (os médicos de plantão), um `SELECT ... FOR UPDATE` nelas resolve. Quando depende da **ausência** de linhas (sala livre, username disponível), não há linha para travar: use `SERIALIZABLE`, uma constraint (`UNIQUE`, `EXCLUDE`) ou **materialize o conflito** — por exemplo, uma tabela com uma linha por sala e horário, que então pode ser travada.',
      },
      {
        type: 'sql',
        id: 'db-tx-q3',
        concept: 'Lock otimista',
        title: 'Lock otimista com a coluna version',
        say: 'Mão na massa: dois administradores editando o mesmo produto. Ninguém pode apagar a edição do outro sem perceber!',
        prompt: `A Ana e o Bruno abriram a tela de edição do **Teclado mecânico** (produto \`1\`) ao mesmo tempo — os dois leram \`version = 3\`.

1. A **Ana** salva primeiro: novo \`preco\` = **179.90**.
2. O **Bruno** salva depois: novo \`estoque\` = **8** (a tela dele ainda acha que a versão é 3).

Escreva o script dos dois salvamentos, nessa ordem, com **lock otimista**:

- cada \`UPDATE\` só vale se o produto ainda estiver na versão que **aquele usuário leu**, e **incrementa** \`version\`;
- logo depois de cada \`UPDATE\`, registre o conflito em \`conflitos\` (\`produto_id\`, \`usuario\` = \`'ana'\` ou \`'bruno'\`) **somente se** aquele \`UPDATE\` não alterou nenhuma linha. Para isso, use \`changes()\`: ela devolve quantas linhas o **último** INSERT/UPDATE/DELETE alterou.

Atenção: a Ana também pode perder a corrida, se outra pessoa tiver salvo antes dela — trate os dois salvamentos do mesmo jeito.`,
        schema: PRODUTOS,
        variants: [
          'UPDATE produtos SET preco = 205.00, version = 4 WHERE id = 1;',
          `INSERT INTO produtos (id, nome, preco, estoque, version) VALUES (4, 'Headset', 349.00, 12, 3);
UPDATE produtos SET version = 3 WHERE id = 2;`,
        ],
        mode: 'script',
        verify: [
          'SELECT id, preco, estoque, version FROM produtos ORDER BY id',
          'SELECT produto_id, usuario FROM conflitos ORDER BY id',
        ],
        starter: `-- Salvamento da Ana (ela leu version = 3): preço -> 179.90
UPDATE produtos SET preco = 179.90 WHERE id = 1;

-- Salvamento do Bruno (ele também leu version = 3): estoque -> 8
UPDATE produtos SET estoque = 8 WHERE id = 1;

SELECT * FROM produtos;
`,
        solution: `-- Ana: só grava se ainda estiver na versão 3
UPDATE produtos SET preco = 179.90, version = version + 1
 WHERE id = 1 AND version = 3;
INSERT INTO conflitos (produto_id, usuario) SELECT 1, 'ana' WHERE changes() = 0;

-- Bruno: também leu a versão 3
UPDATE produtos SET estoque = 8, version = version + 1
 WHERE id = 1 AND version = 3;
INSERT INTO conflitos (produto_id, usuario) SELECT 1, 'bruno' WHERE changes() = 0;`,
        solutionExplanation: `O \`WHERE id = 1 AND version = 3\` transforma o \`UPDATE\` num **compare-and-set**: ele só encontra a linha se ninguém tiver salvo depois da leitura. O salvamento da Ana leva a versão para 4; o do Bruno, que ainda carrega a versão 3, não encontra nada — **0 linhas afetadas** é o sinal de conflito. Nos dados ocultos, alguém salvou antes dos dois e **ambos** perdem.

Na aplicação, você olharia \`cursor.rowcount\` (Python) em vez de \`changes()\` e decidiria: recarregar e mostrar "este produto foi alterado por outra pessoa", ou reler e reaplicar a mudança automaticamente, se ela for combinável. Sem a checagem de versão, o \`UPDATE\` do Bruno teria passado por cima — no caso, sem estragar o preço da Ana, mas um formulário que envia **todos** os campos apagaria a edição dela sem ninguém perceber: o *lost update*.`,
        reviews: [
          {
            when: sql => !/changes\s*\(\s*\)/i.test(sql),
            text: 'Você detectou o conflito **relendo a tabela** depois do `UPDATE`. Com concorrência de verdade, outra transação pode mexer na linha entre o `UPDATE` e a releitura (*check-then-act*). O sinal confiável é quantas linhas **o próprio UPDATE** alterou: `changes()` no SQLite, `cursor.rowcount` no Python, `RETURNING` no PostgreSQL.',
            concept: 'Lock otimista',
          },
        ],
        hints: [
          'Lock otimista em SQL: `UPDATE ... SET <campos>, version = version + 1 WHERE id = 1 AND version = <versão lida>`. Se alguém salvou antes, a versão mudou e o `UPDATE` não encontra a linha.',
          'Os **dois** usam `version = 3` no `WHERE`: é a versão que cada um leu. O do Bruno falha porque o da Ana já levou a versão para 4.',
          "Logo depois de cada `UPDATE`: `INSERT INTO conflitos (produto_id, usuario) SELECT 1, 'ana' WHERE changes() = 0;` — o `SELECT` sem `FROM` devolve uma linha só quando a condição é verdadeira.",
        ],
      },
      {
        type: 'code',
        id: 'db-tx-q4',
        concept: 'Snapshot isolation',
        title: 'Mini-MVCC: snapshot × serializável',
        say: 'Agora vamos construir um mini banco MVCC e intercalar transações passo a passo — de forma determinística — para ver o lost update e o write skew acontecendo.',
        prompt: `Implemente um mini banco **MVCC** em memória (chave → valor):

- \`Banco(dados, modo)\` guarda o estado confirmado em \`self.dados\`; \`modo\` é \`"snapshot"\` ou \`"serializavel"\`. \`begin()\` devolve uma \`Transacao\`.
- A transação lê de um **snapshot** tirado no \`begin()\`: nunca vê commits posteriores, mas vê as **próprias** escritas. Chave inexistente → \`None\`.
- \`escrever\` guarda a mudança só **na transação**; o banco muda apenas no \`commit()\`.
- No \`commit()\`, olhe os commits feitos **depois do begin** desta transação:
  - \`"snapshot"\`: se algum deles escreveu uma chave que esta transação **escreveu** → \`raise Conflito\` (*first-committer-wins*: barra o lost update);
  - \`"serializavel"\`: a regra anterior **e** também há conflito se algum deles escreveu uma chave que esta transação **leu** (barra o write skew);
  - sem conflito, aplique **todas** as escritas de uma vez; com conflito, **nada** é aplicado.

Dica de estrutura: numere os commits e guarde no banco um histórico \`(numero, chaves_escritas)\`.`,
        starter: `class Conflito(Exception):
    """A transação não pode fazer commit: outra transação mexeu no que ela usou."""


class Banco:
    def __init__(self, dados, modo="snapshot"):
        self.dados = dict(dados)   # estado confirmado (commitado)
        self.modo = modo           # "snapshot" ou "serializavel"
        # TODO: contador de commits e histórico [(numero, chaves_escritas)]

    def begin(self):
        return Transacao(self)


class Transacao:
    def __init__(self, banco):
        self.banco = banco
        # TODO: snapshot, último commit visto, chaves lidas e escritas

    def ler(self, chave):
        # TODO: próprias escritas primeiro; senão, o snapshot (ausente -> None)
        pass

    def escrever(self, chave, valor):
        # TODO: guarde só na transação
        pass

    def commit(self):
        # TODO: conflito com commits feitos depois do begin? senão, aplique tudo
        pass
`,
        tests: [
          {
            name: 'lê as próprias escritas; o banco só muda no commit',
            code: `b = Banco({"x": 1})
t = b.begin()
t.escrever("x", 5)
assert t.ler("x") == 5, "a transação deve enxergar a própria escrita"
assert b.dados["x"] == 1, "antes do commit o banco não pode mudar"
t.commit()
assert b.dados["x"] == 5, "depois do commit a escrita deve estar em dados"
assert b.begin().ler("nada") is None, "chave inexistente deve devolver None"`,
          },
          {
            name: 'snapshot: não enxerga commits posteriores ao begin',
            code: `b = Banco({"saldo": 100, "limite": 500})
t1 = b.begin()
assert t1.ler("saldo") == 100
t2 = b.begin()
t2.escrever("saldo", 50)
t2.escrever("limite", 0)
t2.commit()
assert t1.ler("saldo") == 100, "t1 deve continuar vendo o snapshot (sem non-repeatable read)"
assert t1.ler("limite") == 500, "o snapshot vale para todas as chaves, mesmo as lidas pela 1ª vez depois do commit de t2"
assert b.begin().ler("saldo") == 50, "uma transação nova enxerga o commit"`,
          },
          {
            name: 'snapshot: lost update vira Conflito (first-committer-wins)',
            code: `b = Banco({"estoque": 10}, modo="snapshot")
t1, t2 = b.begin(), b.begin()
t1.escrever("estoque", t1.ler("estoque") - 1)
t2.escrever("estoque", t2.ler("estoque") - 1)
t1.commit()
try:
    t2.commit()
except Conflito:
    pass
else:
    raise AssertionError("t2 deveria falhar: t1 gravou 'estoque' depois do begin de t2")
assert b.dados["estoque"] == 9
t3 = b.begin()  # retry: relê e reaplica
t3.escrever("estoque", t3.ler("estoque") - 1)
t3.commit()
assert b.dados["estoque"] == 8`,
          },
          {
            name: 'snapshot: o write skew dos médicos passa',
            code: `b = Banco({"alice": True, "bob": True}, modo="snapshot")
t1, t2 = b.begin(), b.begin()
for t, eu in ((t1, "alice"), (t2, "bob")):
    if sum(1 for m in ("alice", "bob") if t.ler(m)) >= 2:   # "tem outro de plantão"
        t.escrever(eu, False)
t1.commit()
t2.commit()  # chaves escritas diferentes: o snapshot não vê conflito
assert b.dados == {"alice": False, "bob": False}, "no modo snapshot os dois commits passam — é o write skew"`,
          },
          {
            name: 'serializável: o write skew vira Conflito',
            code: `b = Banco({"alice": True, "bob": True}, modo="serializavel")
t1, t2 = b.begin(), b.begin()
for t, eu in ((t1, "alice"), (t2, "bob")):
    if sum(1 for m in ("alice", "bob") if t.ler(m)) >= 2:
        t.escrever(eu, False)
t1.commit()
try:
    t2.commit()
except Conflito:
    pass
else:
    raise AssertionError("t2 leu 'alice', que t1 alterou depois do begin de t2: deveria dar Conflito")
assert b.dados == {"alice": False, "bob": True}, "o commit que falhou não pode aplicar nada"`,
          },
          {
            name: 'conflito não aplica escrita parcial (atomicidade)',
            hidden: true,
            code: `b = Banco({"a": 1, "b": 1}, modo="snapshot")
t1, t2 = b.begin(), b.begin()
t1.escrever("b", 2)
t1.commit()
t2.escrever("a", 99)   # chave livre
t2.escrever("b", 99)   # conflita com t1
try:
    t2.commit()
except Conflito:
    pass
else:
    raise AssertionError("deveria dar Conflito em 'b'")
assert b.dados == {"a": 1, "b": 2}, "com conflito, NENHUMA escrita da transação pode ser aplicada"`,
          },
          {
            name: 'sem falso conflito: chaves diferentes e commits anteriores ao begin',
            hidden: true,
            code: `b = Banco({"a": 0, "b": 0}, modo="serializavel")
t0 = b.begin()
t0.escrever("a", t0.ler("a") + 1)
t0.commit()
t1 = b.begin()   # começou DEPOIS do commit de t0
t2 = b.begin()
t1.escrever("a", t1.ler("a") + 1)
t2.escrever("b", t2.ler("b") + 1)
t1.commit()
t2.commit()      # leu e escreveu só 'b': não conflita com t1
assert b.dados == {"a": 2, "b": 1}`,
          },
          {
            name: 'problema ABA: o valor voltou, mas houve commits no meio',
            hidden: true,
            code: `b = Banco({"x": 1}, modo="snapshot")
t1 = b.begin()
t1.escrever("x", t1.ler("x") + 1)
for valor in (5, 1):   # alguém muda e depois "desmuda"
    t = b.begin()
    t.escrever("x", valor)
    t.commit()
assert b.dados["x"] == 1
try:
    t1.commit()
except Conflito:
    pass
else:
    raise AssertionError("o valor voltou a 1, mas houve commits em 'x' depois do begin: compare pelo histórico, não pelo valor (problema ABA)")`,
          },
          {
            name: 'ler uma chave ausente também é leitura (fantasma)',
            hidden: true,
            code: `b = Banco({"alice": True}, modo="serializavel")
t1 = b.begin()
assert t1.ler("carol") is None
t2 = b.begin()
t2.escrever("carol", True)
t2.commit()
t1.escrever("alice", False)
try:
    t1.commit()
except Conflito:
    pass
else:
    raise AssertionError("t1 leu 'carol' (ausente) e t2 a criou depois do begin de t1: pela regra do serializável, é conflito")`,
          },
          {
            name: 'serializável também vale a regra do snapshot',
            hidden: true,
            code: `b = Banco({"x": 0}, modo="serializavel")
t1, t2 = b.begin(), b.begin()
t1.escrever("x", 1)
t2.escrever("x", 2)
t1.commit()
try:
    t2.commit()
except Conflito:
    pass
else:
    raise AssertionError("no modo serializável o conflito de escrita também vale")
assert b.dados["x"] == 1`,
          },
        ],
        reviews: [
          {
            when: m => m.imports.includes('threading'),
            text: 'Você importou `threading`. No navegador não há threads — e nem precisa: a graça da simulação é controlar a **intercalação** passo a passo, de forma determinística. Com threads reais, o bug apareceria "às vezes" e o teste ficaria instável (*flaky*).',
            concept: 'Simulação determinística',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: 'Você capturou exceções de forma genérica. O `Conflito` precisa **subir** para quem chamou decidir: em bancos reais, o erro de serialização (SQLSTATE `40001`) significa "repita a transação inteira", e engoli-lo esconde a perda de dados.',
            concept: 'Serialização e retry',
          },
        ],
        hints: [
          'No `__init__` da transação, guarde `dict(banco.dados)` (o snapshot) e o número do último commit do banco. `ler` consulta `self.escritas` primeiro e depois `self.snapshot.get(chave)` — e registra a chave em `self.lidas`, exista ela ou não.',
          'No `commit`, monte o conjunto de chaves "vigiadas": só as escritas (snapshot) ou escritas + lidas (serializável). Há conflito se algum commit **com número maior que o seu início** escreveu uma chave vigiada.',
          'Só faça `banco.dados.update(self.escritas)` **depois** de verificar tudo — assim um conflito não deixa escrita parcial. Em seguida, incremente o contador e registre `(numero, set(self.escritas))` no histórico. Não compare valores (problema ABA): compare pelo histórico.',
        ],
        solution: `class Conflito(Exception):
    """A transação não pode fazer commit: outra transação mexeu no que ela usou."""


class Banco:
    def __init__(self, dados, modo="snapshot"):
        self.dados = dict(dados)
        self.modo = modo
        self.commits = 0       # número do último commit
        self.historico = []    # [(numero_do_commit, chaves_escritas)]

    def begin(self):
        return Transacao(self)


class Transacao:
    def __init__(self, banco):
        self.banco = banco
        self.inicio = banco.commits          # último commit visível
        self.snapshot = dict(banco.dados)    # a "foto" do begin
        self.lidas = set()
        self.escritas = {}

    def ler(self, chave):
        self.lidas.add(chave)                # ler a ausência também conta
        if chave in self.escritas:
            return self.escritas[chave]
        return self.snapshot.get(chave)

    def escrever(self, chave, valor):
        self.escritas[chave] = valor

    def commit(self):
        banco = self.banco
        vigiadas = set(self.escritas)
        if banco.modo == "serializavel":
            vigiadas |= self.lidas
        for numero, chaves in banco.historico:
            if numero > self.inicio and chaves & vigiadas:
                raise Conflito(f"conflito em {sorted(chaves & vigiadas)}")
        banco.dados.update(self.escritas)    # tudo de uma vez
        banco.commits += 1
        banco.historico.append((banco.commits, set(self.escritas)))
`,
        solutionExplanation: `O \`begin\` tira a "foto" (\`snapshot\`) e anota o último commit visível; leituras e escritas ficam **dentro** da transação. No \`commit\`, o histórico diz quem gravou o quê **depois** do nosso início:

- **Snapshot** confere só escrita × escrita: é o *first-committer-wins* do PostgreSQL e do Oracle. Barra o lost update, mas deixa o write skew passar — os médicos escrevem chaves diferentes.
- **Serializável** também confere o que **lemos**: se alguém alterou uma premissa nossa, abortamos. É a ideia do **controle de concorrência otimista** com validação de leituras (Kung e Robinson, 1981). É conservador — pode abortar transações que seriam serializáveis —, o mesmo trade-off do SSI do PostgreSQL, que rastreia dependências de leitura e escrita com mais precisão.

Comparar pelo **histórico** (e não pelo valor atual) evita o **problema ABA**: o valor pode ter ido de 1 a 5 e voltado a 1, e a transação, mesmo assim, se baseou num estado que não é mais o de ninguém. Um banco real não copia a base inteira a cada \`begin\`: ele guarda **versões por linha**, marcadas com ids de transação, e decide a visibilidade de cada versão — mas as regras de conflito são essas.`,
      },
      {
        type: 'mcq',
        id: 'db-tx-q5',
        concept: 'Lock pessimista',
        say: 'Agora um cenário de contenção altíssima. Pense em quem espera por quem.',
        prompt: 'Abertura de vendas de um show: **1 000 assentos numerados** e 50 mil pessoas clicando no mesmo minuto. Cada compra precisa garantir um assento livre **só para ela**. Qual abordagem aguenta melhor essa contenção no PostgreSQL?',
        options: [
          { text: 'Lock otimista: cada assento tem `version`; a compra lê um assento livre e faz `UPDATE ... WHERE id = ? AND version = ?`, tentando de novo se falhar.', why: 'Com contenção altíssima, milhares de compras leem o **mesmo** "primeiro assento livre" e quase todas falham no `UPDATE`: vira uma tempestade de retries. O lock otimista brilha quando o conflito é **raro**.' },
          { text: '`SELECT id FROM assentos WHERE show_id = ? AND comprador IS NULL LIMIT 1 FOR UPDATE SKIP LOCKED`, depois `UPDATE` e `COMMIT`.', correct: true, why: 'Cada transação trava um assento **diferente**, pulando os que outras já travaram: ninguém faz fila na mesma linha e ninguém precisa repetir a compra. É o mesmo padrão usado para filas de jobs dentro do banco.' },
          { text: '`SELECT ... FOR UPDATE` no primeiro assento livre, sem `SKIP LOCKED`.', why: 'É correto, mas todas as transações disputam **a mesma linha** e esperam em fila: a vazão cai para uma venda por vez, com timeouts e conexões presas.' },
          { text: 'Usar `READ UNCOMMITTED`, para ninguém esperar ninguém.', why: 'No PostgreSQL, `READ UNCOMMITTED` se comporta como `READ COMMITTED`. E isolamento mais fraco não cria **exclusividade**: duas compras poderiam pegar o mesmo assento.' },
        ],
        explanation: '`FOR UPDATE SKIP LOCKED` (PostgreSQL 9.5+, MySQL 8+, Oracle) transforma a disputa por **uma** linha em trabalho paralelo sobre linhas **diferentes**. Regra de bolso: contenção alta pede lock pessimista (de preferência com `SKIP LOCKED` ou `NOWAIT`); conflito raro, operações longas e usuários "pensando" pedem lock otimista. Para ingressos **sem** numeração, um update atômico basta: `UPDATE shows SET vendidos = vendidos + 1 WHERE id = ? AND vendidos < capacidade` — mas ele concentra tudo numa única linha "quente".',
      },
      {
        type: 'open',
        id: 'db-tx-q6',
        concept: 'Write skew',
        say: 'Última: explique como se fosse para o seu time, no post-mortem.',
        prompt: 'Numa escala de plantão (PostgreSQL, isolamento padrão `READ COMMITTED`), a regra é ter **pelo menos um médico de plantão**. O código faz `BEGIN` → `SELECT COUNT(*)` dos médicos de plantão → se for 2 ou mais, `UPDATE medicos SET de_plantao = false WHERE id = :eu` → `COMMIT`. Na sexta, Alice e Bob pediram saída ao mesmo tempo e o hospital ficou sem ninguém. Explique ao time o que aconteceu e proponha **duas** correções.',
        minWords: 30,
        rubric: [
          {
            label: 'Identifica o **write skew**: as duas leram a mesma premissa e cada uma alterou uma linha **diferente**',
            keywords: ['write skew', 'linhas diferentes', 'linha diferente', 'registros diferentes', 'cada um alterou', 'cada uma alterou', 'cada um atualizou', 'cada transacao alterou', 'leram o mesmo', 'leram a mesma', 'mesma leitura', 'premissa'],
            concept: 'Write skew',
            why: 'Não há conflito de escrita: Alice e Bob gravam linhas diferentes a partir da mesma contagem.',
          },
          {
            label: 'Explica por que o isolamento não pegou: `READ COMMITTED`/snapshot só barram conflito na **mesma** linha',
            keywords: ['read committed', 'snapshot', 'repeatable read', 'mesma linha', 'conflito de escrita', 'nao detecta', 'nao detectou', 'nao pega', 'nao percebe', 'nivel de isolamento', 'isolamento padrao'],
            concept: 'Níveis de isolamento',
            why: 'Os dois `SELECT` rodaram antes de qualquer commit, e os `UPDATE`s tocam linhas diferentes: nada para o banco barrar.',
          },
          {
            label: 'Propõe `SERIALIZABLE`, tratando o erro de serialização com retry',
            keywords: ['serializ', 'ssi'],
            concept: 'Serializable Snapshot Isolation',
            why: 'O SSI detecta a dependência entre as transações e aborta uma delas (SQLSTATE 40001); a aplicação repete.',
          },
          {
            label: 'Ou trava/materializa o conflito: `SELECT ... FOR UPDATE` nas linhas lidas, constraint ou trigger',
            keywords: ['for update', 'lock', 'trav', 'bloque', 'materializ', 'constraint', 'restricao', 'trigger'],
            concept: 'Lock pessimista',
            why: 'Travando as linhas dos médicos de plantão, a segunda transação espera a primeira e recalcula a contagem.',
          },
        ],
        modelAnswer: `Foi um **write skew**. As duas transações rodaram o \`SELECT COUNT(*)\` antes de qualquer commit e leram a mesma premissa ("somos 2"). Depois, **cada uma alterou uma linha diferente** — a Alice a dela, o Bob a dele. Em \`READ COMMITTED\` (e até em snapshot isolation), o banco só barra conflito de escrita na **mesma linha**; como as linhas eram diferentes, não havia nada para detectar, e os dois commits passaram.

Correção 1: rodar essa operação em **SERIALIZABLE**. O PostgreSQL (SSI) percebe que cada transação leu o que a outra alterou e aborta uma delas com erro de serialização; a aplicação faz **retry**, relê a contagem (agora 1) e recusa a saída.

Correção 2: **travar** as linhas lidas com \`SELECT ... FROM medicos WHERE de_plantao AND turno = ? FOR UPDATE\`. A segunda transação espera a primeira terminar e recalcula a contagem. Quando a premissa depende de linhas que não existem, dá para **materializar o conflito** numa tabela de turnos ou usar uma constraint/trigger.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Você viu que **ACID** não é sinônimo de "serializável", conheceu as cinco anomalias — com destaque para o traiçoeiro **write skew** — e viu o MVCC por dentro.',
          'E aprendeu a escolher entre travar antes (**pessimista**) e conferir na escrita (**otimista**). Na próxima unidade: o que acontece quando os dados passam a morar em **várias máquinas**.',
        ],
        board: null,
      },
    ],
  });
})();
