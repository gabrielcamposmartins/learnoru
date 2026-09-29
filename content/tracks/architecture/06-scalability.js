Game.registerModule('architecture', {
  id: 'scalability',
  title: 'Escalabilidade, Cache e Filas',
  kind: 'lesson',
  level: 2,
  order: 40,
  unit: 'qualidades',
  summary: 'Escala vertical e horizontal, serviços stateless, cache-aside, filas, teorema CAP e idempotência.',
  concepts: ['Escala horizontal', 'Stateless', 'Cache-aside', 'LRU', 'Filas', 'CAP', 'Idempotência'],
  takeaways: [
    'Escale **verticalmente** enquanto for barato, mas projete para o **horizontal**: apps **stateless**, com sessões e arquivos em serviços compartilhados.',
    '**Cache-aside**: leia do cache; no *miss*, busque no banco e guarde com **TTL**. Na escrita, grave no banco e **invalide** a chave. A remoção **LRU** roda em O(1) com hash map + lista ligada.',
    '**Filas** absorvem picos e desacoplam, mas entregam *at-least-once*: consumidores e pagamentos precisam de **idempotência** (chave única + resultado guardado).',
    '**CAP**: durante uma partição, escolha entre recusar (consistência) ou responder com um dado possivelmente velho (disponibilidade) — pelo custo de errar para o negócio.',
    'Escalar não é linear: pela **Universal Scalability Law**, contenção e coerência criam um pico — depois dele, mais máquinas **reduzem** a vazão.',
  ],
  glossary: [
    { term: 'Stateless', aliases: ['stateless service'], definition: 'Componente que não guarda estado entre chamadas. Num serviço, nada na memória local de que a próxima requisição dependa: sessões, uploads e filas ficam em serviços compartilhados, e qualquer instância atende qualquer requisição — pré-requisito da escala horizontal.' },
    { term: 'Cache-aside', aliases: ['cache aside', 'look-aside cache'], definition: 'Padrão em que a **aplicação** consulta o cache primeiro; no *miss*, lê do banco e grava no cache com TTL. Na escrita, atualiza o banco (a fonte da verdade) e **invalida** a chave.' },
    { term: 'TTL', aliases: ['time to live', 'time-to-live'], definition: '*Time to live*: por quanto tempo um item vale no cache (ou num registro DNS, numa mensagem). Ao expirar, a próxima leitura busca a fonte de novo — o TTL limita por quanto tempo um dado velho pode ser servido.' },
    { term: 'LRU', aliases: ['least recently used'], definition: '*Least Recently Used*: política de remoção que descarta o item usado há mais tempo quando o cache enche. Faz `get`/`put` em O(1) com hash map + lista duplamente ligada — em Python, o `OrderedDict`.' },
    { term: 'Teorema CAP', aliases: ['CAP', 'teorema de Brewer'], definition: 'Durante uma **partição** de rede, um sistema distribuído precisa escolher entre **consistência** (toda leitura vê a última escrita) e **disponibilidade** (toda requisição recebe resposta). O PACELC completa: sem partição, o trade-off é latência × consistência.' },
    { term: 'Universal Scalability Law', aliases: ['USL', 'lei universal da escalabilidade', 'retrograde scaling', 'escalabilidade retrógrada'], definition: 'Modelo de Neil Gunther para a capacidade com N nós: `N / (1 + α(N−1) + βN(N−1))`. α mede a **contenção** (fila por um recurso compartilhado); β, a **coerência** (nós conversando entre si). Com β > 0 há um pico: depois dele, mais nós **reduzem** a vazão.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Seu sistema fez sucesso e o tráfego multiplicou por 10. E agora? Hoje vamos falar de **escalabilidade**.',
        'Existem dois caminhos básicos: escalar **verticalmente** ou **horizontalmente**.',
      ],
      board: {
        title: 'Vertical vs horizontal',
        md: `| | Vertical (*scale up*) | Horizontal (*scale out*) |
|---|---|---|
| O que é | Máquina **maior** (mais CPU/RAM) | **Mais** máquinas iguais |
| Simplicidade | Nenhuma mudança no código | Exige app **stateless** + load balancer |
| Limite | O maior servidor que existe | Praticamente ilimitado |
| Disponibilidade | Um ponto único de falha | Uma instância cai, as outras seguem |
| Custo | Cresce rápido no topo | Linear, com máquinas comuns |

> [!dica] Escalar verticalmente primeiro é legítimo! É barato em esforço. Mas planeje para o horizontal.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Para escalar horizontalmente, a aplicação precisa ser **stateless**: nenhuma instância pode guardar em memória algo que as outras precisem.',
        'Se a sessão do usuário fica na memória do servidor A, e o load balancer manda a próxima requisição para o B… o usuário é deslogado!',
      ],
      board: {
        title: 'Stateless + estado externo',
        md: `\`\`\`text
                    ┌──────────────┐
 usuários ──▶ Load  │ app 1 (sem   │──┐
            Balancer│ estado local)│  │     ┌─────────┐
               │    ├──────────────┤  ├───▶ │  Redis  │  sessões, cache
               ├──▶ │ app 2        │──┤     └─────────┘
               │    ├──────────────┤  │     ┌─────────┐
               └──▶ │ app 3        │──┴───▶ │  Banco  │  dados
                    └──────────────┘        └─────────┘
\`\`\`

Estado (sessões, uploads, filas de trabalho) vai para **serviços externos compartilhados**. As instâncias viram descartáveis: dá para criar ou matar quantas quiser.`,
      },
    },
    {
      type: 'say',
      text: [
        'A ferramenta mais poderosa para aguentar leitura é o **cache**. O padrão mais comum é o **cache-aside** (ou *lazy loading*).',
        'A aplicação olha primeiro no cache; se não achar, busca no banco e guarda no cache para a próxima vez.',
      ],
      board: {
        title: 'Cache-aside',
        code: `def buscar_produto(sku):
    chave = f"produto:{sku}"
    produto = cache.get(chave)
    if produto is not None:
        return produto                         # HIT: rápido, sem banco

    produto = banco.buscar_produto(sku)        # MISS: vai ao banco
    cache.set(chave, produto, ttl=300)         # guarda por 5 minutos
    return produto


def atualizar_preco(sku, preco):
    banco.atualizar_preco(sku, preco)          # 1) grava na fonte da verdade
    cache.delete(f"produto:{sku}")             # 2) INVALIDA o cache`,
        caption: 'Na escrita, invalidar (delete) costuma ser mais seguro que atualizar o cache.',
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Tem uma frase famosa: "só existem duas coisas difíceis em computação — **invalidar cache** e dar nomes às coisas".',
        'Cache significa aceitar dados possivelmente **desatualizados**. O **TTL** limita por quanto tempo; a invalidação ativa reduz a janela.',
        'E como o cache tem memória limitada, precisamos de uma **política de remoção**. A mais usada é a **LRU**: remove o item usado há mais tempo.',
      ],
      board: {
        title: 'TTL, invalidação e LRU',
        md: `- **TTL (time to live)**: o item expira sozinho. Simples, mas tolera dados velhos até expirar.
- **Invalidação na escrita**: apaga a chave quando a fonte muda.
- **Políticas de remoção**: **LRU** (menos usado recentemente), LFU (menos frequente), FIFO.

Uma LRU eficiente faz \`get\` e \`put\` em **O(1)** com **hash map + lista duplamente ligada** — em Python, o \`collections.OrderedDict\` já é exatamente isso:

\`\`\`python
from collections import OrderedDict

d = OrderedDict()
d["a"] = 1; d["b"] = 2
d.move_to_end("a")        # "a" vira o mais recente — O(1)
d.popitem(last=False)     # remove o mais antigo ("b") — O(1)
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Outra peça-chave são as **filas**. Nem tudo precisa acontecer durante a requisição do usuário.',
        'Enviar e-mail, gerar PDF, processar vídeo… a API só **publica uma mensagem** e responde rápido. **Workers** consomem a fila no ritmo deles.',
      ],
      board: {
        title: 'Processamento assíncrono com filas',
        md: `\`\`\`text
 API ──publica──▶ [ fila: pedidos_criados ] ──consome──▶ worker 1  (e-mail)
  │                                          └─consome──▶ worker 2  (nota fiscal)
  └── responde 202 Accepted imediatamente
\`\`\`

- **Absorve picos**: a fila acumula, os workers processam no seu ritmo.
- **Desacopla**: o produtor não sabe quem consome.
- **Resiliência**: se o worker cai, a mensagem espera na fila.

> [!atencao] Filas geralmente entregam **pelo menos uma vez** (*at-least-once*): a mesma mensagem pode chegar duas vezes. O consumidor precisa ser **idempotente**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Isso nos leva à **idempotência**: executar a mesma operação várias vezes tem o **mesmo efeito** que executar uma vez.',
        'Para pagamentos, usamos uma **chave de idempotência**: se a mesma chave chegar de novo, devolvemos o resultado anterior em vez de cobrar outra vez.',
      ],
      board: {
        title: 'Chave de idempotência',
        code: `def processar_pagamento(chave_idempotencia, valor, cartao):
    anterior = repo.buscar_por_chave(chave_idempotencia)
    if anterior is not None:
        return anterior                      # já processado: não cobra de novo

    resultado = gateway.cobrar(valor, cartao)
    repo.salvar(chave_idempotencia, resultado)   # idealmente com UNIQUE no banco
    return resultado`,
      },
    },
    {
      type: 'say',
      text: [
        'Por fim, o **teorema CAP**: um sistema distribuído, durante uma **partição de rede**, precisa escolher entre **consistência** e **disponibilidade**.',
        'Como partições *vão* acontecer, a escolha real é: responder com um dado possivelmente velho, ou recusar até ter certeza?',
      ],
      board: {
        title: 'Teorema CAP',
        md: `| Letra | Significa |
|---|---|
| **C**onsistency | Toda leitura vê a escrita mais recente |
| **A**vailability | Toda requisição recebe resposta (sem erro) |
| **P**artition tolerance | Continua funcionando com a rede partida |

- **CP** (prefere consistência): saldo bancário, estoque de último item → melhor recusar do que errar.
- **AP** (prefere disponibilidade): feed de rede social, contador de likes → melhor mostrar algo levemente desatualizado.

> [!dica] Em entrevistas, mencione também o **PACELC**: mesmo **sem** partição, há um trade-off entre **latência** e consistência.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Uma última ideia antes dos exercícios: dobrar o número de máquinas **dobra** a capacidade?',
        'Quase nunca. E, passando de certo ponto, ela até **cai**! Quem explica isso é uma lei pouco conhecida.',
      ],
      board: {
        title: 'Universal Scalability Law — quando mais é menos',
        md: `A capacidade com **N** nós (1 nó = 1,0×) segue a **USL**, de Neil Gunther:

\`\`\`python
def capacidade(n, alfa, beta):
    return n / (1 + alfa * (n - 1) + beta * n * (n - 1))
\`\`\`

| Parâmetro | Nome | De onde vem |
|---|---|---|
| \`alfa\` | **Contenção** | Fila por algo compartilhado: um lock, a mesma linha do banco, um líder único |
| \`beta\` | **Coerência** | Nós conversando para ficar em acordo: invalidação de caches, locks distribuídos. Cresce com os N×(N−1) pares! |

| Nós | 1 | 8 | 16 | 32 | 64 | 128 |
|---|---|---|---|---|---|---|
| Só contenção (\`alfa=0.05\`, \`beta=0\`) | 1,0× | 5,9× | 9,1× | 12,5× | 15,4× | 17,4× |
| Contenção + coerência (\`beta=0.001\`) | 1,0× | 5,7× | 8,0× | 9,0× | 7,8× | 5,4× |

> [!sabia] Com \`beta > 0\` a curva tem um **pico** em N ≈ √((1 − alfa) / beta) — aqui, ~31 nós. Depois dele, cada máquina nova **reduz** a vazão: é a *escalabilidade retrógrada* (*retrograde scaling*). Com \`beta = 0\`, a USL vira a velha **Lei de Amdahl**. Medindo a vazão com poucos nós e ajustando \`alfa\` e \`beta\`, dá para **prever** onde o sistema vai parar de escalar — antes de comprar as máquinas.

**Remédio:** cortar a conversa entre os nós — arquitetura *shared-nothing*, dados particionados (cada nó dono da sua fatia) e menos locks globais.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — e uma cache LRU testada até em desempenho.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-scale-q1',
      concept: 'Stateless',
      say: 'Um bug clássico de quem escala horizontalmente pela primeira vez…',
      prompt: 'Depois de subir de 1 para 4 instâncias atrás de um load balancer, usuários começaram a ser **deslogados aleatoriamente**. Qual a causa mais provável e a correção?',
      options: [
        { text: 'As sessões ficavam na memória de cada instância; mover as sessões para um armazenamento compartilhado (ex.: Redis) ou usar tokens.', correct: true, why: 'Cada instância só conhece as sessões que ela mesma criou — a app precisa ser stateless.' },
        { text: 'O load balancer está sobrecarregado; escalar o load balancer verticalmente.', why: 'Sobrecarga causaria lentidão/erros, não logout aleatório.' },
        { text: 'O banco de dados está lento; adicionar um índice na tabela de usuários.', why: 'Um índice não resolve sessões perdidas entre instâncias.' },
        { text: 'Faltou cache; adicionar cache-aside na consulta de usuários.', why: 'O problema é estado local na instância, não desempenho de leitura.' },
      ],
      explanation: 'Para escalar horizontalmente a aplicação deve ser **stateless**: o estado do usuário fica num **armazenamento compartilhado** (Redis, banco) ou no próprio cliente (token JWT). *Sticky sessions* resolvem paliativamente, mas prejudicam o balanceamento e a tolerância a falhas.',
    },
    {
      type: 'mcq',
      id: 'arq-scale-q2',
      concept: 'Cache-aside',
      say: 'Agora a ordem das operações no cache-aside.',
      prompt: 'No padrão **cache-aside**, ao **atualizar** o preço de um produto, qual sequência é a mais segura?',
      options: [
        { text: 'Gravar no banco e depois **invalidar** (apagar) a chave no cache.', correct: true, why: 'A fonte da verdade é atualizada primeiro; a próxima leitura recarrega o valor novo do banco.' },
        { text: 'Apagar a chave do cache e nunca mais usar cache para produtos.', why: 'Joga fora o benefício do cache sem necessidade.' },
        { text: 'Atualizar só o cache; o banco é sincronizado depois por um job.', why: 'Se o cache cair ou expirar, o dado se perde — o banco deixa de ser a fonte da verdade.' },
        { text: 'Invalidar o cache e só depois gravar no banco.', why: 'Entre os dois passos, uma leitura concorrente pode recarregar o valor **antigo** do banco no cache, e ele fica velho até o TTL.' },
      ],
      explanation: 'No cache-aside o **banco é a fonte da verdade**: atualize-o primeiro e depois **invalide** a chave. Invalidar costuma ser mais seguro que reescrever o cache, e o **TTL** funciona como rede de segurança contra inconsistências raras.',
    },
    {
      type: 'mcq',
      id: 'arq-scale-q3',
      concept: 'Teorema CAP',
      say: 'Uma sobre o CAP.',
      prompt: 'Durante uma **partição de rede**, um sistema de **reserva de assentos de avião** deve priorizar o quê, segundo o teorema CAP?',
      options: [
        { text: 'Consistência (CP): é melhor recusar temporariamente do que vender o mesmo assento duas vezes.', correct: true, why: 'Venda duplicada tem custo alto de negócio; a indisponibilidade momentânea é o mal menor.' },
        { text: 'Disponibilidade (AP): sempre aceitar a reserva e resolver conflitos depois.', why: 'Para assentos (recurso único e escasso), aceitar e conciliar depois gera overbooking e clientes furiosos.' },
        { text: 'As três propriedades ao mesmo tempo, com um banco melhor.', why: 'O teorema mostra que, com partição, não dá para ter C e A simultaneamente.' },
        { text: 'Tolerância a partição é opcional; basta desligá-la.', why: 'Em sistemas distribuídos, partições acontecem — não é uma escolha.' },
      ],
      explanation: 'Com partição (P inevitável), escolhe-se entre **C** e **A**. Recursos únicos e críticos (assentos, saldo, último item em estoque) pedem **consistência**; feeds, likes e recomendações toleram dados velhos e preferem **disponibilidade**.',
    },
    {
      type: 'open',
      id: 'arq-scale-q4',
      concept: 'Idempotência',
      say: 'Pergunta que separa plenos de seniores. Como você evitaria cobrança duplicada?',
      prompt: 'O app mobile faz **retry** automático quando a requisição de pagamento dá timeout — e alguns clientes foram **cobrados duas vezes**. Como você resolveria?',
      minWords: 15,
      rubric: [
        { label: 'Propõe **idempotência** / chave de idempotência', keywords: ['idempot', 'chave unica', 'request id', 'idempotency'], concept: 'Idempotência', why: 'A mesma operação repetida deve ter o mesmo efeito de uma única execução.' },
        { label: 'O cliente envia um **identificador único** reaproveitado no retry', keywords: ['uuid', 'identificador', ' id ', 'mesmo id', 'mesma chave', 'header', 'cabecalho', 'cliente gera', 'cliente envia'], concept: 'Chave de idempotência', why: 'O retry precisa carregar a mesma chave da tentativa original.' },
        { label: 'O servidor **guarda o resultado** e devolve o mesmo sem cobrar de novo', keywords: ['guard', 'armazen', 'registr', 'salv', 'mesmo resultado', 'resposta anterior', 'ja processad', 'verific'], concept: 'Idempotência', why: 'Chegou uma chave já vista → devolve a resposta anterior.' },
        { label: 'Cita **concorrência**: restrição única/lock para requisições simultâneas', keywords: ['unique', 'unica', 'unico', 'lock', 'concorr', 'simult', 'transac', 'atomic'], concept: 'Concorrência', why: 'Duas requisições com a mesma chave ao mesmo tempo não podem ambas passar pela verificação.' },
      ],
      modelAnswer: `O problema é que a operação de pagamento **não é idempotente**: o timeout não significa que a cobrança falhou, e o retry cobra de novo.

A solução é uma **chave de idempotência**: o cliente gera um **UUID** por intenção de pagamento e o envia (por exemplo no header \`Idempotency-Key\`), **reaproveitando a mesma chave** em todos os retries.

No servidor, antes de cobrar, verifico se a chave já foi processada: se sim, **devolvo o resultado armazenado** sem cobrar de novo; se não, cobro e **salvo** a chave com o resultado. Para requisições **simultâneas** com a mesma chave, uso uma restrição **UNIQUE** no banco (ou lock/transação) para garantir que só uma prossiga. As chaves podem expirar depois de um tempo (ex.: 24h).`,
    },
    {
      type: 'code',
      id: 'arq-scale-q5',
      concept: 'Cache LRU',
      title: 'Cache LRU em O(1)',
      say: 'Pergunta favorita de entrevistas: implemente uma cache LRU. E sim, vou testar o desempenho!',
      prompt: `Implemente a classe \`CacheLRU(capacidade)\`:

- \`get(chave)\` → devolve o valor, ou \`None\` se não existir. Um \`get\` bem-sucedido marca a chave como **usada recentemente**.
- \`put(chave, valor)\` → insere ou atualiza (e marca como recente). Se passar da capacidade, remove o item **usado há mais tempo**.
- As duas operações devem ser **O(1)** — há um teste de desempenho com dezenas de milhares de operações.`,
      starter: `class CacheLRU:
    def __init__(self, capacidade):
        self.capacidade = capacidade

    def get(self, chave):
        # TODO
        return None

    def put(self, chave, valor):
        # TODO
        pass
`,
      tests: [
        {
          name: 'remove o menos usado recentemente',
          code: `c = CacheLRU(2)
c.put("a", 1)
c.put("b", 2)
assert c.get("a") == 1
c.put("c", 3)            # "b" é o menos recente → sai
assert c.get("b") is None, "b deveria ter sido removido"
assert c.get("a") == 1 and c.get("c") == 3`,
        },
        { name: 'chave inexistente devolve None', expr: 'CacheLRU(3).get("x")', expected: 'None' },
        {
          name: 'put em chave existente atualiza e renova',
          code: `c = CacheLRU(2)
c.put("a", 1)
c.put("b", 2)
c.put("a", 10)           # atualiza e "a" vira o mais recente
c.put("c", 3)            # agora quem sai é "b"
assert c.get("a") == 10, f"esperado 10, obtido {c.get('a')}"
assert c.get("b") is None`,
        },
        { name: 'capacidade 1', hidden: true, code: 'c = CacheLRU(1)\nc.put(1, "x")\nc.put(2, "y")\nassert c.get(1) is None and c.get(2) == "y"' },
        { name: 'mantém só os mais recentes', hidden: true, code: 'c = CacheLRU(3)\nfor i in range(10):\n    c.put(i, i * i)\nassert [c.get(i) for i in range(10)] == [None] * 7 + [49, 64, 81]' },
      ],
      perfTests: [
        {
          name: '120 mil operações (capacidade 5000)',
          setup: `def _carga():
    c = CacheLRU(5000)
    for i in range(60000):
        c.put(i % 7000, i)
        c.get((i * 7) % 7000)
    return c.get(59999 % 7000)`,
          expr: '_carga()',
          expected: '59999',
          maxMs: 900,
        },
      ],
      slowConcept: 'LRU — hash map + lista ligada (O(1))',
      reviews: [
        {
          when: m => ['remove', 'index', 'insert'].some(c => m.calls.includes(c)),
          text: 'Você usou `list.remove`/`index`/`insert`, que são **O(n)**: cada operação percorre a lista. Com `OrderedDict` (`move_to_end` e `popitem(last=False)`) tudo fica O(1).',
          concept: 'LRU — hash map + lista ligada (O(1))',
        },
        {
          when: m => m.calls.includes('min') || m.calls.includes('sorted') || m.calls.includes('sort'),
          text: 'Procurar o item mais antigo com `min`/`sorted` custa O(n) (ou O(n log n)) a cada remoção. Mantenha a **ordem de uso** na própria estrutura para remover em O(1).',
          concept: 'LRU — hash map + lista ligada (O(1))',
        },
      ],
      hints: [
        'Use `from collections import OrderedDict` e guarde `self.dados = OrderedDict()`.',
        'No `get`: se a chave existir, `self.dados.move_to_end(chave)` e devolva o valor.',
        'No `put`: grave o valor, faça `move_to_end`, e se `len(self.dados) > self.capacidade`, chame `self.dados.popitem(last=False)`.',
      ],
      solution: `from collections import OrderedDict


class CacheLRU:
    def __init__(self, capacidade):
        self.capacidade = capacidade
        self.dados = OrderedDict()

    def get(self, chave):
        if chave not in self.dados:
            return None
        self.dados.move_to_end(chave)          # marca como mais recente
        return self.dados[chave]

    def put(self, chave, valor):
        self.dados[chave] = valor
        self.dados.move_to_end(chave)
        if len(self.dados) > self.capacidade:
            self.dados.popitem(last=False)     # remove o menos recente
`,
      solutionExplanation: 'O `OrderedDict` combina um **hash map** (acesso O(1) pela chave) com uma **lista duplamente ligada** que mantém a ordem. `move_to_end` move a chave para o fim (mais recente) e `popitem(last=False)` remove do início (menos recente) — tudo em **O(1)**. Numa entrevista em outra linguagem, você implementaria esses dois componentes à mão.',
    },
    {
      type: 'match',
      id: 'arq-rx2-scale-q6',
      concept: 'Técnicas de escalabilidade',
      say: 'Rodada relâmpago: cada sintoma de produção tem um remédio nesta aula.',
      prompt: 'Associe cada **sintoma** à técnica que o resolve.',
      pairs: [
        { left: 'Usuários deslogados após subir para 4 instâncias', right: 'Sessões fora da instância (app **stateless**)' },
        { left: 'O mesmo produto é lido milhares de vezes por minuto', right: '**Cache-aside** com TTL' },
        { left: 'Emitir nota fiscal dentro da requisição trava o checkout no pico', right: '**Fila** + workers assíncronos' },
        { left: 'A fila entregou a mesma mensagem duas vezes', right: 'Consumidor **idempotente**' },
        { left: 'O cache encheu: quem sai para dar lugar?', right: 'Política de remoção **LRU**' },
        { left: 'A vazão caiu ao passar de 32 para 64 nós', right: 'Menos coerência: dados particionados (*shared-nothing*)' },
      ],
      explanation: 'Cada técnica ataca um gargalo diferente: **stateless** libera a escala horizontal; **cache-aside** poupa o banco de leituras repetidas; a **fila** tira o trabalho lento do caminho da requisição e absorve picos — mas, como entrega *at-least-once*, o consumidor precisa ser **idempotente**; a **LRU** decide quem sai quando a memória acaba. E quando mais nós **pioram** a vazão, a USL aponta o culpado: **coerência** — nós demais conversando entre si. Particionar os dados corta essa conversa.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Arrasou! Resumo: apps **stateless** escalam horizontalmente; **cache-aside** com TTL e invalidação alivia o banco; **filas** absorvem picos…',
        '…consumidores e pagamentos precisam ser **idempotentes**; e o **CAP** lembra que, na partição, escolhemos entre consistência e disponibilidade. Agora você está pronto(a) para a entrevista de **system design**!',
      ],
      board: null,
    },
  ],
});
