/*
 * Lista de arquivos de conteúdo, carregados em ordem.
 * Para adicionar uma trilha ou módulo: crie o arquivo e acrescente o caminho aqui.
 * (A ordem dos módulos na tela vem do campo `order` de cada módulo, não desta lista.)
 */
(function () {
  const T = 'content/tracks/';
  const track = (id, files) => [`${T}${id}/_track.js`, ...files.map(f => `${T}${id}/${f}.js`)];

  window.CONTENT_MANIFEST = [
    'content/characters.js',

    ...track('design-patterns', [
      '01-intro', '02-singleton', '03-factory', '04-strategy', '05-observer', '06-decorator', '07-adapter', '08-interview',
      '09-builder', '10-prototype', '12-facade', '13-proxy', '14-composite', '15-bridge', '16-flyweight',
      '17-command', '18-state', '19-template-method', '20-iterator', '21-chain-of-responsibility', '22-mediator', '23-memento', '24-visitor',
      '25-null-object', '26-registry-plugins', '28-anti-patterns', '29-interview-avancada',
    ]),

    ...track('leetcode', [
      '01-big-o', '02-hash-map', '03-two-pointers', '04-sliding-window', '05-stack', '06-binary-search', '07-interview-junior', '08-interview-pleno',
      '09-linked-list', '10-trees', '11-heaps', '12-graphs', '13-union-find', '14-trie', '15-backtracking', '16-dynamic-programming',
      '18-prefix-sum', '19-greedy-intervals', '20-bit-manipulation', '21-dijkstra', '22-interview-senior',
    ]),

    ...track('architecture', [
      '01-solid', '02-layers', '03-dependency-injection', '04-hexagonal', '05-monolith-microservices', '06-scalability',
      '07-interview-system-design', '08-ddd-estrategico', '09-ddd-tatico', '10-interview-ddd',
      '11-event-driven', '12-cqrs-event-sourcing', '13-sagas', '14-evolutionary', '15-adrs-c4',
    ]),

    ...track('testing', [
      '01-fundamentos', '02-pytest-essencial', '03-mocks', '04-tdd', '05-tdd-kata', '06-boas-praticas', '07-interview',
      '08-property-based', '09-test-data-builders', '10-snapshot-approval', '11-testes-integracao',
    ]),

    ...track('apis', [
      '01-http-fundamentos', '02-rest-design', '03-paginacao-erros', '04-versionamento', '05-idempotencia', '06-cache-http',
      '07-rate-limiting', '08-resiliencia', '09-circuit-breaker', '10-seguranca-api', '11-estilos-integracao',
      '12-gateway-contratos', '13-entrevista-api',
    ]),

    ...track('databases', [
      '01-sql-fundamentos', '02-agregacoes', '03-window-ctes', '04-indices', '05-modelagem', '06-transacoes',
      '07-nosql', '08-replicacao-sharding', '09-dados-distribuidos', '10-entrevista-db',
    ]),

    ...track('concurrency', [
      '01-modelos', '02-condicoes-corrida', '03-asyncio', '04-asyncio-padroes', '05-armadilhas-async', '06-entrevista-concorrencia',
    ]),

    ...track('python', [
      '01-modelo-de-dados', '02-iteradores-geradores', '03-decoradores-avancados', '04-context-managers',
      '05-descritores', '06-metaprogramacao', '07-typing-moderno', '08-dataclasses-match',
    ]),

    ...track('clean-code', [
      '01-nomes-funcoes', '02-code-smells', '03-refatoracoes', '04-complexidade',
      '05-acoplamento-coesao', '06-principios', '07-codigo-legado', '08-entrevista-code-review',
    ]),

    ...track('observability', [
      '01-logs', '02-metricas', '03-tracing', '04-latencia-percentis',
      '05-slos', '06-deploy-seguro', '07-incidentes', '08-entrevista-sre',
    ]),

    ...track('security', [
      '01-fundamentos', '02-injecao', '03-web', '04-senhas-autenticacao',
      '05-autorizacao', '06-criptografia', '07-supply-chain', '08-entrevista-seguranca',
    ]),

    ...track('distributed', [
      '01-falacias', '02-tempo-ordem', '03-consenso-quorum', '04-consistencia-crdts', '05-mensageria', '06-entrevista-distribuidos',
    ]),
  ];
})();
