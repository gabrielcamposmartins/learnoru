# Guia de autoria de conteúdo — Code Interview Quest

Este guia é para quem escreve **módulos** (aulas e entrevistas). Leia inteiro antes de começar.
Modelos de referência (leia também):

- `content/tracks/design-patterns/02-singleton.js` — aula completa (say + board + mcq + open + code)
- `content/tracks/testing/04-tdd.js` — aula com kata TDD encadeado
- `content/tracks/testing/02-pytest-essencial.js` — questões `pytest` com mutantes
- Cabeçalhos de `js/steps/*.js` — formato exato de cada tipo de etapa

## 1. Objetivo

O jogador quer **aprender** engenharia de software (em Python) e se preparar para entrevistas.
Cada módulo deve:

1. **Ensinar de verdade**: explicar o problema que o conceito resolve, o *porquê*, exemplos em Python,
   trade-offs e quando **não** usar.
2. Apresentar **pelo menos um conceito ou termo pouco conhecido** que a maioria dos devs nunca ouviu
   (ex.: *Hyrum's Law*, *write skew*, *coordinated omission*, *connascence*, *GCRA*, *hedged requests*,
   *Chesterton's fence*, *confused deputy*). Use um callout `> [!sabia]` (renderiza como "💡 Você sabia?").
3. Fixar com **atividades variadas** e dar feedback que ensina (o `why` de cada alternativa, reviews com conceito).

## 2. Arquivo de módulo

Um arquivo por módulo em `content/tracks/<trilha>/NN-nome.js` (o caminho já está em `content/manifest.js`):

```js
Game.registerModule('apis', {
  id: 'rate-limiting',                 // único na trilha, kebab-case
  title: 'Rate Limiting',
  kind: 'lesson',                      // 'lesson' | 'interview' | 'challenge'
  level: 2,                            // 1 fácil · 2 médio · 3 difícil
  order: 20,                           // ordem dentro da trilha (use o número do plano)
  unit: 'confiabilidade',              // id de uma unidade de track.units (ver _track.js)
  summary: 'Uma frase que vende o módulo.',
  concepts: ['Token bucket', 'Sliding window', '429'],   // 3–5 tags
  takeaways: [                         // 3–5 frases: o que o jogador deve lembrar (aparece no fim)
    'Token bucket permite **rajadas** controladas; leaky bucket suaviza a vazão.',
  ],
  glossary: [                          // 3–6 termos; viram tooltips nos quadros e entram no glossário
    { term: 'Token bucket', aliases: ['balde de fichas'], definition: 'Algoritmo de rate limiting: um balde enche a uma taxa fixa; cada requisição consome uma ficha.' },
  ],
  steps: [ /* ... */ ],
});
```

- **glossary**: definição curta (1–3 frases, < 400 caracteres), em markdown inline. `aliases` cobre plural,
  sem acento, sigla, inglês. Termos aparecem como dicas no texto dos quadros de **qualquer** módulo.
- Não edite `manifest.js`, `_track.js`, arquivos do motor (`js/`, `css/`, `index.html`, `tools/`) nem módulos de outros autores.

## 3. Estrutura recomendada de uma aula

1. **3–8 etapas `say`** ensinando, cada uma com `board` (quadro): markdown, tabelas, código Python realçado,
   diagramas em bloco ` ```text `, e callouts `> [!dica]`, `> [!atencao]`, `> [!sabia]`.
   Blocos ` ```sql `, ` ```json ` e ` ```http ` também são realçados.
2. Uma `section` "Atividades de fixação".
3. **4–6 questões** pontuadas, variando os tipos:
   - pelo menos 1 `mcq`;
   - pelo menos 1 `order` **ou** `match` (fixação rápida e divertida);
   - pelo menos 1 questão prática (`code`, `sql`, `pytest` ou `tdd`) quando o tema permitir;
   - `open` quando fizer sentido (justificar trade-offs, "como você explicaria…").
4. Um `say` final de resumo com `board: null`.

Entrevistas (`kind: 'interview'`): a Lia faz o papel de entrevistadora — apresenta o problema, pergunta a
abordagem (mcq), pede código, faz follow-ups (complexidade, casos de borda, escala) e dá feedback.

Tamanho: um módulo típico tem 300–600 linhas. **Qualidade > quantidade.**

## 4. Tipos de etapa (resumo — o formato completo está no topo de cada `js/steps/*.js`)

| Tipo | Uso | Campos principais |
|---|---|---|
| `say` | fala + quadro | `text` (string ou array; itens podem ser `{ text, mood }`), `mood`, `board: { title, md, code, caption } \| null` |
| `section` | cartão de transição | `title`, `subtitle`, `icon`, `text` |
| `mcq` | múltipla escolha | `prompt`, `options: [{ text, correct, why }]`, `multiple`, `explanation` |
| `open` | resposta aberta com rubrica | `prompt`, `rubric: [{ label, keywords, concept, why }]`, `minWords`, `modelAnswer` |
| `order` | ordenar | `prompt`, `items` (na ordem **correta**, 3–7), `explanation` |
| `match` | associar pares | `prompt`, `pairs: [{ left, right }]` (3–6), `explanation` |
| `code` | escrever Python testado | `starter`, `tests`, `perfTests`, `reviews`, `hints`, `solution`, `solutionExplanation` |
| `sql` | escrever SQL (SQLite) | `schema`, `variants`, `mode`, `verify`, `orderMatters`, `plan`, `starter`, `solution`, `reviews` |
| `pytest` | escrever testes | `module`, `implementation`, `starter`, `mutants`, `minTests`, `solution` |
| `tdd` | ciclo red-green-refactor | `kata`, `module`, `stub`, `checks`, `reference`, `solutionTests`, `solutionImpl` |

Todas as questões pontuadas precisam de `id` único **com o prefixo do autor** (ex.: `api-rl-q3`) e de `concept`.
Humores (`mood`): `neutral`, `happy`, `thinking`, `surprised`, `concerned`, `cheer` (só para comemorar algo) e `angry`
(bronca bem-humorada — use raramente; o jogo já usa quando o jogador pula a explicação).

**Checkpoints:** o progresso do jogador é salvo a cada atividade. Se você **adicionar, remover ou reordenar
etapas** de um módulo já publicado, os checkpoints desse módulo são descartados (quem estava no meio recomeça
do início, com um aviso). Corrigir textos, quadros e alternativas não afeta os checkpoints.

Etapas `say` e `section` são **de explicação**: o jogador pode voltar fala a fala (←), inclusive para a etapa
anterior do mesmo bloco, e pular o bloco inteiro até a próxima atividade (Shift+→). Por isso cada `say` deve
fazer sentido ao ser revisitado, e o conteúdo essencial deve estar no **quadro** (que é restaurado ao voltar).

### mcq
- 4 opções, **todas** com `why` (por que certa/errada). Distratores plausíveis — erros comuns reais.
- `explanation` ensina o conceito, não só repete a resposta.

### open
- 3–4 itens de rubrica. `keywords` **sem acento**, em minúsculas, casam por **prefixo/substring**
  (`'idempot'` casa "idempotente", "idempotência"). Um item em array exige todas as partes
  (`['retry', 'jitter']`). Use muitas variações e sinônimos.
- `modelAnswer` deve cobrir **todos** os itens da rubrica (confira manualmente).

### order / match
- `order.items` na ordem correta (o jogo embaralha). Ex.: fases de um circuit breaker, passos de um handshake OAuth.
- `match.pairs`: conceitos ↔ definições, status code ↔ significado, padrão ↔ intenção. Textos curtos.

### code
- `tests`: `{ name, expr, expected, compare? }` ou `{ name, code }` (asserts livres). Inclua **casos de borda**
  e **pelo menos 1 `hidden: true`**. `expected` é uma **expressão Python em string** (`'[0, 1]'`, `'"texto"'`).
- Testes podem ser **assíncronos**: se `expr` devolve uma corrotina ela é aguardada; testes `code` aceitam
  `await` no nível superior. **Nunca** chame `asyncio.run()` (já existe um event loop rodando).
- `perfTests` para questões algorítmicas: `{ name, setup, expr, expected, maxMs }`. Calibre: a solução ótima
  deve levar poucos ms e a ingênua deve estourar `maxMs` com folga, mas terminar em < 3 s (senão o worker é reiniciado).
- `reviews`: `{ when: (m, code) => bool, text, concept }` — **nunca** acionados pela sua solução (o validador checa).
  Explique *o que melhorar e por quê*, com o conceito.
- Evite depender de tempo real/aleatoriedade: **injete** relógio, `random.Random(seed)`, `sleep` etc.

Métricas `m` disponíveis (análise AST do código do jogador):
`loopDepth`, `loops`, `whileTrue`, `recursion`, `functions`, `funcs` (`[{name, lines, params, complexity, nesting}]`),
`maxComplexity`, `maxFunctionLines`, `maxParams`, `maxNesting`, `classes` (`[{name, bases, methods}]`), `calls`,
`names`, `attributes`, `imports`, `decorators`, `comprehensions`, `lambdas`, `usesGlobal`, `tryBlocks`,
`bareExcepts`, `broadExcepts`, `mutableDefaults`, `returns`, `yields`, `awaits`, `ifs`, `fstrings`, `asserts`, `lines`.
(`recursion`/`recursive` contam só chamadas diretas `f()` ou `self.f()`/`cls.f()` dentro de `f` — `super().f()` não conta.)

### sql
- `schema`: DDL + dados de exemplo (as tabelas aparecem para o jogador com até 6 linhas cada).
- `variants`: **datasets ocultos** (SQL aplicado depois do schema) — obrigatórios para impedir respostas "chumbadas".
  Faça variações que mudem o resultado (mais linhas, NULLs, empates, valores repetidos).
- `mode: 'query'` compara o resultado da consulta; `mode: 'script'` roda DDL/DML do jogador e compara as consultas `verify`.
- `orderMatters: true` só quando o enunciado pede uma ordem. Colunas são comparadas **por posição**; nomes não importam.
- `plan: { sql, mustContain: ['USING INDEX'], mustNotContain: ['SCAN'], hint }` — checa `EXPLAIN QUERY PLAN`
  depois do script do jogador (ótimo para aulas de índice). Use `USING COVERING INDEX` para índices de cobertura.
- `reviews: [{ when: sql => bool, text, concept }]` — recebe o **texto** SQL (use regex com `/i`).
- Alvo: **SQLite 3.39**. Pode: JOINs (inclusive RIGHT/FULL), window functions, CTEs recursivas, UPSERT,
  `RETURNING`, JSON (`json_extract`, `->>`), `STRICT`. **Não use** funções matemáticas (`sqrt`, `pow`, `ln`, `floor`…),
  `unixepoch()` com modificadores novos, nem nada posterior a 3.39.

### pytest
- `implementation` é o código correto (mostrado ao jogador). `mutants`: 3–6 versões **completas** com bugs
  **plausíveis** (limites, condição invertida, caso vazio, exceção não lançada, interação não feita…). Nada de erro
  de sintaxe/import. Cada mutante deve ser pego pela `solution` **e** sobreviver a testes ingênuos de caminho feliz.
- `reviews` usam as métricas do **arquivo de teste** (ex.: `!m.decorators.includes('parametrize')`, `!m.calls.includes('raises')`).

### tdd
- Siga `content/tracks/testing/04-tdd.js`. Ciclos com o mesmo `kata` herdam o código anterior.
  1º ciclo: `implStarter` + `testStarter` + `stub`. Todos: `checks` ocultos (barram *fake it*), `reference`,
  `solutionTests` (suíte acumulada), `solutionImpl`.

## 5. Ambiente de execução (importante!)

- **Python 3.12 (Pyodide)** no navegador. O validador usa CPython mais novo — **não use** nada de 3.13+
  (`copy.replace`, `warnings.deprecated`, etc.). Sintaxe 3.12 (PEP 695 `def f[T]`) funciona.
- **Não há threads** no navegador (`threading.Thread.start()` falha). Ensine threads com **simulações determinísticas**
  (ex.: intercalações de passos, locks falsos que registram a ordem), e use `asyncio` de verdade para concorrência.
- Sem rede, sem arquivos persistentes, sem `input()`. `time.sleep` deixa o teste lento: injete a função de espera.
- Bibliotecas: só a **stdlib** (+ `pytest` nas questões pytest/tdd). `sqlite3` funciona (é carregado sozinho).
  **Não existe** `hypothesis`, `requests`, `numpy` etc.
- Cada teste roda o código do jogador **do zero** (namespace novo).

## 6. Texto e estilo

- Português do Brasil **com acentuação correta** (ç, ã, é…). Termos técnicos em inglês quando é o usual.
- A personagem é a **Lia** (feminino): "obrigada", "estou animada".
- Falas curtas (1–2 frases por linha), naturais, com humor leve. O detalhe vai no **quadro**, não na fala.
- Markdown do quadro: `**negrito**`, `` `código` ``, listas, tabelas `| a | b |`, ` ```python `.
- JS: o conteúdo usa template literals — **escape crases** internas (`` \` ``) e **nunca** escreva `${` literal
  dentro de template string. Rode `node --check` no arquivo.

## 7. Validação (obrigatória)

```powershell
node --check content/tracks/<trilha>/<arquivo>.js
$env:CIQ_PYTHON = "<caminho do python com pytest>"; node tools/validate-content.js <trilha>/<id-do-modulo>
```

O filtro é por `trilha/id` (ex.: `apis/rate-limiting`). O validador executa soluções, mutantes, ciclos TDD e SQL.
Corrija **todos** os erros e avisos dos seus módulos antes de terminar.

## 8. Checklist final por módulo

- [ ] `unit`, `order`, `summary`, `concepts`, `takeaways` (3–5), `glossary` (3–6)
- [ ] 3–8 `say` com quadros ricos; pelo menos um `> [!sabia]` com algo pouco conhecido
- [ ] 4–6 questões variadas, ids únicos com prefixo, `concept` em todas
- [ ] mcq com `why` em todas as opções; open com rubrica e resposta modelo coerentes
- [ ] questões práticas com casos de borda, teste/dataset oculto, dicas progressivas, solução explicada e reviews
- [ ] `say` final com `board: null`
- [ ] validador com 0 erros e 0 avisos

## 9. Mapa de conteúdo (para evitar sobreposição)

**design-patterns** — fundamentos: intro · criacionais: singleton, factory, builder, prototype · estruturais: adapter,
facade, decorator, proxy, composite, bridge, flyweight · comportamentais: strategy, observer, command, state,
template-method, iterator, chain-of-responsibility, mediator, memento, visitor · pythonicos: null-object,
registry-plugins (`__init_subclass__`, registries, entry points), anti-patterns · entrevistas: interview, interview-avancada.

**leetcode** — fundamentos: big-o · arrays: hash-map, two-pointers, sliding-window, prefix-sum (e difference array),
greedy-intervals · estruturas: stack, binary-search, linked-list (fast/slow, Floyd), trees (DFS/BFS, BST), heaps
(top-k, merge k), trie · grafos: graphs (BFS/DFS, topo sort/Kahn), union-find, dijkstra · tecnicas: backtracking,
dynamic-programming (1D e 2D), bit-manipulation · entrevistas: interview-junior, interview-pleno, interview-senior.

**architecture** — principios: solid, dependency-injection · estilos: layers, hexagonal, monolith-microservices,
event-driven (eventos × comandos, coreografia × orquestração) · ddd: ddd-estrategico, ddd-tatico · dados-eventos:
cqrs-event-sourcing, sagas (compensações) · qualidades: scalability, evolutionary (fitness functions, métricas de
acoplamento Ca/Ce/instabilidade), adrs-c4 (ADRs, modelo C4) · entrevistas: interview-ddd, interview-system-design.

**testing** — fundamentos: fundamentos, pytest-essencial · dubles: mocks · tdd: tdd, tdd-kata · qualidade:
boas-praticas, property-based (mini-framework próprio: geradores, propriedades, *shrinking*), test-data-builders
(Test Data Builder, Object Mother, factories/fixtures), snapshot-approval (golden master, approval tests),
testes-integracao (sqlite real, testcontainers — conceito, contract testing/Pact, testing trophy × pirâmide ×
honeycomb) · entrevistas: entrevista-testes.

**apis** — fundamentos: http-fundamentos (métodos, safe/idempotente, status, headers, HTTP/1.1–2–3), rest-design
(recursos, Richardson, HATEOAS, ações não-CRUD) · design: paginacao-erros (offset × cursor/keyset, filtros,
RFC 9457 Problem Details, 400 × 422), versionamento (estratégias, breaking changes, Hyrum's Law, Tolerant Reader,
expand/contract, Deprecation/Sunset, semver), idempotencia (Idempotency-Key, ETag/If-Match, 412, lost update),
cache-http (Cache-Control, ETag/304, Vary, CDN, stale-while-revalidate, cache stampede) · confiabilidade:
rate-limiting (token/leaky bucket, fixed/sliding window, GCRA, 429 + Retry-After, distribuído), resiliencia
(timeouts, deadlines, retries com backoff exponencial + jitter, retry budget, retry storm), circuit-breaker
(estados, half-open, bulkhead, fallback, load shedding, backpressure, hedged requests, metastable failures) ·
seguranca: seguranca-api (authN × authZ, API keys, OAuth 2.0 + PKCE, JWT/HS256, CORS, OWASP API Top 10/BOLA,
mass assignment) · arquitetura: estilos-integracao (GraphQL e N+1/DataLoader, gRPC/protobuf, WebSocket × SSE ×
long polling, webhooks com assinatura HMAC), gateway-contratos (API gateway, BFF, service mesh, correlation ID,
OpenAPI, contract testing) · entrevistas: entrevista-api.

**databases** — sql: sql-fundamentos (SELECT, JOINs), agregacoes (GROUP BY/HAVING, NULL e lógica de três valores),
window-ctes (window functions, CTEs recursivas) · performance: indices (B-tree, compostos, prefixo mais à esquerda,
covering, EXPLAIN QUERY PLAN), modelagem (normalização, desnormalização, N+1 de ORM) · consistencia: transacoes
(ACID, isolamento, dirty/non-repeatable/phantom, write skew, MVCC, lock otimista × pessimista) · escala: nosql
(documento, chave-valor, colunar, grafo, LSM × B-tree), replicacao-sharding (réplicas, replication lag,
read-your-writes, sharding, consistent hashing, PACELC), dados-distribuidos (dual write, outbox, CDC,
consumidor idempotente) · entrevistas: entrevista-db.

**concurrency** — fundamentos: modelos (processo × thread × async, GIL, CPU × IO bound, free-threaded 3.13, Amdahl),
condicoes-corrida (intercalações, atomicidade, locks, deadlock/Coffman, ordem de locks — com simulações) · async:
asyncio (event loop, corrotinas, tasks, gather, TaskGroup, timeouts, cancelamento), asyncio-padroes (Semaphore,
Queue produtor/consumidor, backpressure, limitação de concorrência), armadilhas-async (bloquear o loop, tasks
órfãs, contextvars, to_thread, "function coloring") · entrevistas: entrevista-concorrencia.

**python** — objetos: modelo-de-dados (dunders, `__eq__`/`__hash__`, total_ordering, protocolo de sequência),
descritores (property, protocolo de descritor, `__set_name__`), metaprogramacao (metaclasses, `__init_subclass__`,
`__class_getitem__`, class decorators) · funcional: iteradores-geradores (protocolo, yield from, itertools, pipelines
preguiçosos), decoradores-avancados (com argumentos, wraps, em classes, cache), context-managers (with, contextlib,
ExitStack, suppress) · tipos: typing-moderno (Protocol, Generic, TypeVar, ParamSpec, TypedDict, Literal, overload,
Self, PEP 695), dataclasses-match (dataclasses a fundo, slots, frozen, `__post_init__`, pattern matching).

**clean-code** — fundamentos: nomes-funcoes, code-smells · refatoracao: refatoracoes (extract function, guard
clauses, replace conditional with polymorphism, parameter object…), complexidade (ciclomática e cognitiva, medida
com `ast`) · design: acoplamento-coesao (connascence, Lei de Demeter, tell don't ask), principios (DRY/regra de
três, YAGNI, KISS, Chesterton's fence, escoteiro) · legado: codigo-legado (seams, testes de caracterização,
sprout/wrap) · entrevistas: entrevista-code-review.

**observability** — sinais: logs (estruturados, níveis, correlação), metricas (counter/gauge/histogram, RED × USE,
cardinalidade), tracing (spans, propagação, W3C traceparent), latencia-percentis (média mente, p99, tail latency,
coordinated omission, Lei de Little) · confiabilidade: slos (SLI/SLO/SLA, error budget, burn rate) · operacao:
deploy-seguro (CI/CD, feature flags, canary, blue-green, rollback), incidentes (on-call, postmortem blameless,
5 porquês, chaos engineering) · entrevistas: entrevista-sre.

**security** — fundamentos: fundamentos (CIA, STRIDE, defesa em profundidade, menor privilégio) · ataques: injecao
(SQL injection com sqlite, command injection, path traversal), web (XSS, CSRF, SSRF, CSP, SameSite) · identidade:
senhas-autenticacao (hash de senha com scrypt/pbkdf2 + salt, timing attack/compare_digest, TOTP RFC 6238, MFA,
sessões), autorizacao (RBAC/ABAC, IDOR/BOLA, confused deputy) · pratica: criptografia (hash × cifra × assinatura ×
encoding, HMAC, não invente cripto), supply-chain (segredos, typosquatting, dependency confusion, SBOM, pinning) ·
entrevistas: entrevista-seguranca.

**distributed** — fundamentos: falacias (8 falácias, falha parcial, dois generais, timeouts ambíguos), tempo-ordem
(relógios físicos e skew, Lamport, vector clocks) · coordenacao: consenso-quorum (quóruns R+W>N, líder, Raft em
linhas gerais, split brain, fencing tokens, leases) · dados: consistencia-crdts (linearizável × eventual,
read-your-writes, CRDTs G-Counter/PN-Counter/LWW), mensageria (at-most/at-least/exactly-once, ordem por partição,
DLQ, poison message, consumidor idempotente) · entrevistas: entrevista-distribuidos.
