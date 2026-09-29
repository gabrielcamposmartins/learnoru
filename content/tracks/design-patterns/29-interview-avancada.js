(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  // ── Código compartilhado pelas duas partes do live coding ──────────────────
  const BASE = py(`
    from dataclasses import dataclass


    @dataclass
    class Pagamento:
        id: str
        valor: int      # em centavos
        metodo: str     # "cartao" ou "pix"


    class ProvedorIndisponivel(Exception):
        """O provedor recusou a conexão ANTES de processar: é seguro tentar outro."""


    class Provedor:
        """Base dos adapters: cada subclasse traduz o SDK de um provedor para este contrato."""

        nome = "?"
        fixo = 0                  # centavos por transação
        bps = 0                   # pontos-base: 100 bps = 1%
        metodos = frozenset()

        def __init__(self, fora_do_ar=False):
            self.fora_do_ar = fora_do_ar
            self.cobrancas = []

        def aceita(self, metodo):
            return metodo in self.metodos

        def custo(self, valor):
            return self.fixo + valor * self.bps // 10000

        def cobrar(self, pagamento):
            if self.fora_do_ar:
                raise ProvedorIndisponivel(self.nome)
            self.cobrancas.append(pagamento.id)
            return f"{self.nome}-{pagamento.id}"
  `);

  const PROVS = py(`
    @registrar("alfa")
    class Alfa(Provedor):
        nome = "alfa"
        fixo, bps = 30, 290           # R$ 0,30 + 2,9%
        metodos = frozenset({"cartao"})


    @registrar("beta")
    class Beta(Provedor):
        nome = "beta"
        fixo, bps = 0, 350            # 3,5%
        metodos = frozenset({"cartao"})


    @registrar("pixfacil")
    class PixFacil(Provedor):
        nome = "pixfacil"
        fixo, bps = 0, 99             # 0,99%
        metodos = frozenset({"pix"})
  `);
  const PROVS_SIMPLES = PROVS.replace(/^@registrar\("\w+"\)\n/gm, '');

  const REGISTRO_TODO = py(`
    PROVEDORES = {}


    def registrar(nome):
        """Decorator de classe: guarda a classe em PROVEDORES[nome]."""
        def decorador(classe):
            # TODO: registre a classe (nome já registrado → ValueError)
            return classe
        return decorador


    def criar_provedor(nome, **config):
        """Factory: cria o provedor registrado com esse nome, repassando a config."""
        # TODO
  `);

  const REGISTRO_OK = py(`
    PROVEDORES = {}


    def registrar(nome):
        """Decorator de classe: guarda a classe em PROVEDORES[nome]."""
        def decorador(classe):
            if nome in PROVEDORES:
                raise ValueError(f"provedor já registrado: {nome}")
            PROVEDORES[nome] = classe
            return classe
        return decorador


    def criar_provedor(nome, **config):
        """Factory: cria o provedor registrado com esse nome, repassando a config."""
        classe = PROVEDORES.get(nome)
        if classe is None:
            raise ValueError(f"provedor desconhecido: {nome}")
        return classe(**config)
  `);

  const ESTRATEGIAS_TODO = py(`
    # Estratégias de roteamento: (pagamento, provedores) -> candidatos, na ordem de tentativa
    def por_prioridade(pagamento, provedores):
        """Os que aceitam o método do pagamento, na ordem recebida."""
        # TODO


    def mais_barato(pagamento, provedores):
        """Os que aceitam o método, do menor para o maior custo; empate mantém a ordem."""
        # TODO
  `);

  const ESTRATEGIAS_OK = py(`
    # Estratégias de roteamento: (pagamento, provedores) -> candidatos, na ordem de tentativa
    def por_prioridade(pagamento, provedores):
        """Os que aceitam o método do pagamento, na ordem recebida."""
        return [p for p in provedores if p.aceita(pagamento.metodo)]


    def mais_barato(pagamento, provedores):
        """Os que aceitam o método, do menor para o maior custo; empate mantém a ordem."""
        return sorted(por_prioridade(pagamento, provedores), key=lambda p: p.custo(pagamento.valor))
  `);

  const ORQ_TODO = py(`
    class SemProvedorDisponivel(Exception):
        """Nenhum provedor candidato conseguiu processar o pagamento."""


    class EventBus:
        def __init__(self):
            pass

        def inscrever(self, evento, callback):
            pass

        def publicar(self, evento, **dados):
            pass


    class Orquestrador:
        def __init__(self, provedores, estrategia, bus):
            pass

        def pagar(self, pagamento):
            pass
  `);

  const ORQ_OK = py(`
    class SemProvedorDisponivel(Exception):
        """Nenhum provedor candidato conseguiu processar o pagamento."""


    class EventBus:
        def __init__(self):
            self._assinantes = {}          # evento -> [callbacks]
            self.erros = []                # (evento, exceção) de assinantes com defeito

        def inscrever(self, evento, callback):
            self._assinantes.setdefault(evento, []).append(callback)

        def publicar(self, evento, **dados):
            for callback in list(self._assinantes.get(evento, [])):
                try:
                    callback(**dados)
                except Exception as erro:  # um assinante com defeito não derruba os outros
                    self.erros.append((evento, erro))


    class Orquestrador:
        def __init__(self, provedores, estrategia, bus):
            self.provedores = list(provedores)
            self.estrategia = estrategia   # Strategy injetada
            self.bus = bus                 # Observer

        def pagar(self, pagamento):
            for provedor in self.estrategia(pagamento, self.provedores):
                try:
                    transacao = provedor.cobrar(pagamento)
                except ProvedorIndisponivel:   # recusado ANTES de processar: failover seguro
                    self.bus.publicar("provedor_indisponivel", pagamento=pagamento, provedor=provedor.nome)
                    continue
                self.bus.publicar("pagamento_aprovado", pagamento=pagamento,
                                  provedor=provedor.nome, transacao=transacao)
                return transacao
            self.bus.publicar("pagamento_falhou", pagamento=pagamento)
            raise SemProvedorDisponivel(pagamento.id)
  `);

  // Assinante de teste que registra (evento, provedor) de todos os eventos do orquestrador.
  const LOG = py(`
    bus = EventBus()
    log = []
    for _ev in ("provedor_indisponivel", "pagamento_aprovado", "pagamento_falhou"):
        bus.inscrever(_ev, lambda _ev=_ev, **d: log.append((_ev, d.get("provedor"))))
  `);

  // Parte do código a partir do Orquestrador (para os reviews da parte 2).
  const depoisDoOrquestrador = code => code.split(/class\s+Orquestrador/)[1] || '';

  Game.registerModule('design-patterns', {
    id: 'interview-avancada',
    title: 'Entrevista: patterns na prática',
    kind: 'interview',
    level: 3,
    order: 91,
    unit: 'entrevistas',
    summary: 'Projete pagamentos com vários provedores: combine Adapter, Registry/Factory, Strategy e Observer, trate falhas reais e saiba quando não usar padrão.',
    concepts: ['Combinação de padrões', 'Registry + Factory', 'Strategy', 'Observer', 'Quando não usar padrões'],
    takeaways: [
      'Em sistemas reais, padrões aparecem **combinados**: Adapter isola cada SDK, Registry + Factory cria provedores a partir da config, Strategy escolhe a rota e Observer espalha os efeitos colaterais.',
      'Observer é para reações **opcionais e independentes**; um passo obrigatório do fluxo deve ser chamado explicitamente — e um assinante com defeito não pode derrubar o que já aconteceu.',
      'Failover só é seguro quando o erro garante que **nada foi processado**; timeout é **ambíguo** e pede consulta de status no mesmo provedor, não uma nova cobrança em outro.',
      'Todo padrão cobra indireção: com um único provedor e nenhuma variação à vista, uma chamada direta atrás de um adapter fino basta — introduza os demais quando a variação aparecer.',
      'Alta **densidade de padrões** deixa o design fácil de usar e difícil de mudar: comprima o design só depois de entender o problema.',
    ],
    glossary: [
      { term: 'Pattern density', aliases: ['densidade de padrões', 'densidade de padroes'], definition: 'Termo de Kent Beck e Erich Gamma (*JUnit: A Cook\'s Tour*): quantos padrões se sobrepõem nas mesmas classes. Alta densidade torna o design fácil de **usar** e difícil de **mudar** — típico de frameworks maduros.' },
      { term: 'Speculative Generality', aliases: ['generalidade especulativa'], definition: '*Code smell* do catálogo de Martin Fowler: ganchos, parâmetros e abstrações criados "porque um dia vamos precisar". Um sinal clássico: os únicos usuários da abstração são os testes.' },
      { term: 'Failover', aliases: ['fail-over', 'failovers'], definition: 'Desviar automaticamente o trabalho para uma alternativa (outro provedor, réplica ou região) quando a principal falha. Só é seguro quando se sabe que a tentativa anterior **não** produziu efeito.' },
      { term: 'Timeout ambíguo', aliases: ['timeouts ambíguos', 'timeout ambiguo'], definition: 'Quando uma chamada estoura o tempo, não dá para saber se o outro lado processou ou não. Repetir — ou mudar de provedor — uma operação não idempotente pode duplicar o efeito, como uma cobrança.' },
      { term: 'Event bus', aliases: ['barramento de eventos', 'event buses'], definition: 'Objeto que liga publicadores e assinantes por **nome de evento**: quem publica não conhece quem reage. É o Observer com um intermediário; em memória, é síncrono e perde os eventos se o processo cair.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Olá! Que bom te ver de novo. Hoje a entrevista é de **nível sênior**: vamos projetar um sistema de verdade.',
          'Pense em voz alta — eu quero ouvir **por que** cada padrão entra e quanto ele custa.',
        ],
        board: {
          title: '🎤 Formato da entrevista',
          md: `1. **Arquitetura** — que padrões combinar, e por quê
2. **Live coding** — catálogo de provedores (*Registry + Factory + Strategy*) e orquestrador com eventos (*Observer + failover*)
3. **Follow-ups** — falhas reais, trade-offs e quando **não** usar padrão

> [!dica] Em entrevista sênior, nomear o padrão vale pouco. O que conta é dizer **qual força** ele resolve, **quanto custa** — e reconhecer quando uma função simples resolve.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O cenário: a Loja Aurora cobra tudo por um único SDK, com `if metodo == ...` espalhados pelo código.',
          'O negócio cresceu, e chegaram estes requisitos.',
        ],
        board: {
          title: 'O problema: pagamentos com vários provedores',
          md: `- **Cartão** por dois provedores (**Alfa** e **Beta**) e **Pix** pelo **PixFácil** — e novos provedores chegam a cada trimestre.
- Escolher o provedor por **regra** (custo, método, país), trocável sem mexer no núcleo.
- Se um provedor estiver **fora do ar**, tentar o próximo.
- Depois da aprovação: e-mail, analytics e antifraude, de **outros times**, que não podem acoplar ao núcleo.
- Tudo testável **sem rede**.

\`\`\`text
                    ┌─▶ Alfa      charge(amount_cents, token) → dict
Loja ─ cobrar ─▶ ?  ├─▶ Beta      criar_transacao(Decimal) / BetaError
                    └─▶ PixFácil  QR code + confirmação por webhook
\`\`\``,
        },
      },
      {
        type: 'mcq',
        id: 'dp-int2-q1',
        concept: 'Adapter',
        say: 'Primeira decisão: os três SDKs não se parecem em nada. Como o resto do sistema conversa com eles?',
        prompt: 'O Alfa expõe `charge(amount_cents, token)` e devolve um `dict`; o Beta tem `criar_transacao(valor: Decimal, cartao)` e lança `BetaError` com códigos numéricos; o PixFácil gera um QR code. Você quer que o resto do sistema conheça **um único** contrato: `cobrar(pagamento) -> id_transacao`. Qual padrão faz essa ponte?',
        options: [
          { text: 'Adapter — um por SDK, traduzindo chamadas, tipos e exceções para o seu contrato.', correct: true, why: 'Cada adapter converte centavos × `Decimal`, `dict` × id e `BetaError` × suas exceções. O domínio nunca importa um SDK.' },
          { text: 'Facade — uma interface simplificada na frente dos três SDKs.', why: 'A Facade simplifica **um** subsistema complexo com uma interface nova. Aqui são **vários** SDKs que precisam obedecer a um contrato **que já existe** — trabalho de Adapter.' },
          { text: 'Bridge — separar a abstração "pagamento" das implementações de cada provedor.', why: 'O Bridge é decidido **antes**, para duas hierarquias variarem juntas. Integrar SDKs prontos e incompatíveis é Adapter: "o Adapter faz funcionar depois; o Bridge, antes".' },
          { text: 'Proxy — um objeto na frente de cada SDK controlando o acesso.', why: 'O Proxy tem a **mesma** interface do objeto real (cache, lazy loading, permissão). Ele não converte interfaces.' },
        ],
        explanation: 'Na fronteira com sistemas externos, o **Adapter** é o padrão que mais se paga: traduz tipos, erros e nomes para a linguagem do seu domínio (em DDD, uma *anticorruption layer*) e vira a **costura** dos testes — neles, o provedor é um fake que cumpre o mesmo contrato.',
      },
      {
        type: 'match',
        id: 'dp-int2-q2',
        concept: 'Combinação de padrões',
        say: 'Agora monte o mapa: cada requisito, um padrão.',
        prompt: 'Associe cada **requisito** do sistema de pagamentos ao **padrão** que o resolve.',
        pairs: [
          { left: 'Cada provedor tem um SDK com interface própria', right: 'Adapter' },
          { left: 'Criar o provedor a partir do nome na config (`"alfa"`)', right: 'Registry + Factory' },
          { left: 'Escolher o provedor por custo, método ou país', right: 'Strategy' },
          { left: 'E-mail e analytics reagem ao pagamento aprovado', right: 'Observer' },
          { left: 'Se o provedor estiver fora, tentar o próximo da lista', right: 'Chain of Responsibility' },
          { left: 'Retry com backoff em volta de qualquer provedor', right: 'Decorator' },
        ],
        explanation: 'Cada requisito tem uma **força** diferente: Adapter converte interfaces; Registry + Factory decide *o que criar* a partir de dados; Strategy decide *qual algoritmo*; Observer desacopla *quem reage*; a cadeia de failover passa o pedido adiante até alguém resolver; e o Decorator acrescenta comportamento (retry, métricas) sem mudar o contrato. Repare que a "cadeia" pode ser só um laço sobre uma lista — padrão não exige uma classe por elo.',
      },
      {
        type: 'mcq',
        id: 'dp-int2-q3',
        concept: 'Observer × passo obrigatório',
        say: 'Um detalhe que separa plenos de seniores…',
        prompt: 'O `EventBus` publica `pagamento_aprovado` e três times assinam: **e-mail**, **analytics** e **estoque**. Só que a baixa de estoque é obrigatória: se falhar, o pedido não pode ser despachado e o pagamento precisa ser estornado. Qual é a melhor avaliação?',
        options: [
          { text: 'E-mail e analytics são bons assinantes; a baixa de estoque é um passo **obrigatório** e deve ser chamada explicitamente pelo orquestrador, com tratamento de falha (estorno).', correct: true, why: 'O Observer esconde o fluxo de controle: ótimo para reações que podem falhar sozinhas, péssimo para passos dos quais o negócio depende.' },
          { text: 'Está ótimo: no Observer o publicador não conhece ninguém, então todos os passos devem ser assinantes.', why: 'Desacoplamento não é objetivo absoluto. Um passo obrigatório escondido num assinante vira regra de negócio invisível: o fluxo completo não está escrito em lugar nenhum.' },
          { text: 'Mantenha o estoque como assinante e faça-o lançar exceção para abortar o pagamento.', why: 'Quando o evento sai, a cobrança **já aconteceu** — e o e-mail "pagamento aprovado" pode já ter sido enviado. Exceção em assinante não desfaz nada e acopla o publicador às falhas de terceiros.' },
          { text: 'Troque o Observer por um Singleton global de estoque, consultado por todos.', why: 'Não responde quem é dono do passo obrigatório e ainda adiciona estado global.' },
        ],
        explanation: 'Regra prática: **eventos** anunciam fatos ("pagamento aprovado") para quem quiser reagir; **comandos** pedem algo que *precisa* acontecer. Passos obrigatórios ficam explícitos no orquestrador (ou numa saga, com compensações); efeitos opcionais viram assinantes. Em escala, o bus sai da memória para uma fila — com *outbox*, para o evento não se perder se o processo cair entre cobrar e publicar.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo. Então a arquitetura fica assim: cada peça com **uma** responsabilidade.',
          'Repare que o orquestrador não conhece nenhum provedor concreto nem nenhum assinante.',
        ],
        board: {
          title: 'A proposta',
          md: `\`\`\`text
config ─▶ criar_provedor("alfa") ─▶ PROVEDORES     Registry + Factory

pagar(p) ─▶ Orquestrador ─▶ estrategia(p, provs)   Strategy
               │ tenta em ordem                    cadeia (failover)
               ▼
      Alfa · Beta · PixFácil                       Adapters
               │ publicar("pagamento_aprovado")
               ▼
           EventBus ─▶ e-mail · analytics          Observer
\`\`\`

\`\`\`python
class Provedor(Protocol):            # o contrato que todo adapter cumpre
    nome: str
    def aceita(self, metodo: str) -> bool: ...
    def custo(self, valor: int) -> int: ...      # em centavos
    def cobrar(self, pagamento) -> str: ...      # id da transação

Roteamento = Callable[[Pagamento, list[Provedor]], list[Provedor]]   # Strategy
\`\`\`

> [!atencao] Dinheiro em **centavos** (\`int\`), nunca em \`float\`: \`0.1 + 0.2 != 0.3\`. Os provedores já calculam o custo com aritmética inteira.`,
        },
      },
      { type: 'section', title: 'Live coding', subtitle: 'Duas partes. Rode os exemplos antes de enviar.', icon: '⌨️', mood: 'neutral', text: 'Vamos ao código. Primeiro o catálogo de provedores; depois, o orquestrador.' },
      {
        type: 'code',
        id: 'dp-int2-q4',
        concept: 'Registry + Factory',
        title: 'Catálogo de provedores e roteamento',
        points: 50,
        say: 'Parte 1: o registro de provedores, a fábrica e as estratégias de roteamento. Um teste oculto vai plugar um provedor novo!',
        prompt: `Os adapters já estão prontos: \`Alfa\`, \`Beta\` e \`PixFacil\` herdam de \`Provedor\` e têm \`nome\`, \`aceita(metodo)\`, \`custo(valor)\` (em centavos) e \`cobrar(pagamento)\`.

1. **Registry + Factory**
   - \`registrar(nome)\`: decorator de classe que guarda a classe em \`PROVEDORES[nome]\` e a devolve intacta. Nome já registrado → \`ValueError\` (dois plugins com o mesmo nome é bug de configuração).
   - \`criar_provedor(nome, **config)\`: instancia a classe registrada repassando a \`config\`. Nome desconhecido → \`ValueError\` com o nome na mensagem.
2. **Strategy** de roteamento — funções \`(pagamento, provedores) -> list\` que devolvem os **candidatos** na ordem de tentativa, **sem alterar** a lista recebida:
   - \`por_prioridade\`: os que aceitam \`pagamento.metodo\`, na ordem recebida;
   - \`mais_barato\`: os que aceitam o método, do menor para o maior \`custo(pagamento.valor)\`; em empate, mantém a ordem recebida.

\`\`\`python
provs = [criar_provedor(n) for n in ("alfa", "beta", "pixfacil")]
[p.nome for p in mais_barato(Pagamento("p1", 2000, "cartao"), provs)]
# ['beta', 'alfa'] — em R$ 20, os 3,5% do Beta custam menos que R$ 0,30 + 2,9% do Alfa
\`\`\``,
        starter: BASE + '\n\n' + REGISTRO_TODO + '\n\n' + PROVS + '\n\n' + ESTRATEGIAS_TODO,
        tests: [
          { name: 'os três provedores estão registrados', expr: 'sorted(PROVEDORES)', expected: '["alfa", "beta", "pixfacil"]' },
          {
            name: 'a factory cria a classe registrada',
            code: py(`
              p = criar_provedor("beta")
              assert type(p) is Beta, f"esperado Beta, obtido {type(p).__name__}"
              assert p.fora_do_ar is False
            `),
          },
          { name: 'a factory repassa a configuração', expr: 'criar_provedor("alfa", fora_do_ar=True).fora_do_ar', expected: 'True' },
          {
            name: 'provedor desconhecido → ValueError',
            code: py(`
              try:
                  criar_provedor("zeta")
              except ValueError as e:
                  assert "zeta" in str(e), "a mensagem deve conter o nome pedido"
              else:
                  raise AssertionError("provedor desconhecido deveria lançar ValueError")
            `),
          },
          { name: 'por_prioridade filtra pelo método', setup: 'provs = [criar_provedor(n) for n in ("beta", "pixfacil", "alfa")]', expr: '[p.nome for p in por_prioridade(Pagamento("p1", 1000, "cartao"), provs)]', expected: '["beta", "alfa"]' },
          { name: 'mais_barato: R$ 20 → Beta primeiro', setup: 'provs = [criar_provedor(n) for n in ("alfa", "beta", "pixfacil")]', expr: '[p.nome for p in mais_barato(Pagamento("p2", 2000, "cartao"), provs)]', expected: '["beta", "alfa"]' },
          { name: 'mais_barato: R$ 200 → Alfa primeiro', setup: 'provs = [criar_provedor(n) for n in ("alfa", "beta", "pixfacil")]', expr: '[p.nome for p in mais_barato(Pagamento("p3", 20000, "cartao"), provs)]', expected: '["alfa", "beta"]' },
          { name: 'Pix só vai para provedores de Pix', hidden: true, setup: 'provs = [criar_provedor(n) for n in ("alfa", "beta", "pixfacil")]', expr: '[p.nome for p in mais_barato(Pagamento("p4", 5000, "pix"), provs)]', expected: '["pixfacil"]' },
          {
            name: 'empate de custo mantém a ordem recebida',
            hidden: true,
            code: py(`
              beta, alfa = criar_provedor("beta"), criar_provedor("alfa")
              pg = Pagamento("p5", 5000, "cartao")      # R$ 50: os dois custam 175 centavos
              assert alfa.custo(5000) == beta.custo(5000) == 175
              msg = "em empate, mantenha a ordem recebida (o sorted do Python é estável)"
              assert [p.nome for p in mais_barato(pg, [beta, alfa])] == ["beta", "alfa"], msg
              assert [p.nome for p in mais_barato(pg, [alfa, beta])] == ["alfa", "beta"], msg
            `),
          },
          {
            name: 'método sem provedor → lista vazia',
            hidden: true,
            code: py(`
              provs = [criar_provedor(n) for n in ("alfa", "beta", "pixfacil")]
              pg = Pagamento("p6", 1000, "boleto")
              assert list(por_prioridade(pg, provs)) == []
              assert list(mais_barato(pg, provs)) == []
            `),
          },
          {
            name: 'nome repetido no registro → ValueError',
            hidden: true,
            code: py(`
              try:
                  @registrar("alfa")
                  class OutroAlfa(Provedor):
                      nome = "alfa"
              except ValueError:
                  pass
              else:
                  raise AssertionError("registrar um nome repetido deveria lançar ValueError")
              assert PROVEDORES["alfa"] is Alfa, "o registro original não pode ser sobrescrito"
            `),
          },
          {
            name: 'plugin novo funciona sem mudar a factory nem as estratégias',
            hidden: true,
            code: py(`
              @registrar("gama")
              class Gama(Provedor):
                  nome = "gama"
                  fixo, bps = 0, 100
                  metodos = frozenset({"cartao", "pix"})

              provs = [criar_provedor(n) for n in ("alfa", "beta", "gama")]
              rota = [p.nome for p in mais_barato(Pagamento("p7", 10000, "cartao"), provs)]
              assert rota == ["gama", "alfa", "beta"], rota
            `),
          },
          {
            name: 'as estratégias não alteram a lista recebida',
            hidden: true,
            code: py(`
              provs = [criar_provedor(n) for n in ("alfa", "pixfacil", "beta")]
              copia = list(provs)
              mais_barato(Pagamento("p8", 2000, "cartao"), provs)
              por_prioridade(Pagamento("p8", 2000, "cartao"), provs)
              assert provs == copia, "a estratégia alterou a lista do chamador — devolva uma lista nova"
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /\belif\b/.test(code) || /==\s*["'](alfa|beta|pixfacil)["']/.test(code),
            text: 'Você compara nomes de provedores com `if/elif`. Cada provedor novo exigiria editar o núcleo — deixe o **registro** ser a fonte única (Aberto/Fechado).',
            concept: 'Registry + Factory',
          },
          {
            when: m => m.calls.includes('eval') || m.calls.includes('globals') || m.calls.includes('getattr'),
            text: 'Achar a classe pelo nome com `eval`/`globals()`/`getattr` permite instanciar **qualquer** objeto a partir de uma string de configuração. Um registro explícito limita o que pode ser criado.',
            concept: 'Registry + Factory',
          },
          {
            when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
            text: 'O código pergunta o tipo do provedor. Use o contrato (`aceita`, `custo`) — *tell, don\'t ask* — e um provedor novo entra sem mudar as estratégias.',
            concept: 'Polimorfismo',
          },
          {
            when: (m, code) => /provedores\.sort\s*\(/.test(code),
            text: '`provedores.sort(...)` reordena a lista **do chamador**: um efeito colateral escondido dentro de uma estratégia. Use `sorted(...)`, que devolve uma lista nova.',
            concept: 'Strategy',
          },
        ],
        hints: [
          'No decorator: `if nome in PROVEDORES: raise ValueError(...)`, depois `PROVEDORES[nome] = classe` e `return classe`.',
          'Na factory: `classe = PROVEDORES.get(nome)`; se vier `None`, `raise ValueError(f"provedor desconhecido: {nome}")`; senão, `return classe(**config)`.',
          'Estratégias: `[p for p in provedores if p.aceita(pagamento.metodo)]`. Para o mais barato, `sorted(candidatos, key=lambda p: p.custo(pagamento.valor))` — o `sorted` é **estável**, então empates mantêm a ordem recebida.',
        ],
        solution: BASE + '\n\n' + REGISTRO_OK + '\n\n' + PROVS + '\n\n' + ESTRATEGIAS_OK,
        solutionExplanation: 'O **registro** é a fonte única de provedores: o decorator cadastra cada adapter no momento em que a classe é definida, e a **factory** só consulta o dicionário — um provedor novo entra com uma classe nova, sem editar o núcleo (Aberto/Fechado). O `ValueError` em nome repetido pega um erro de configuração cedo (*fail fast*). As **estratégias** são funções com o mesmo contrato: `mais_barato` reaproveita `por_prioridade` para filtrar e usa `sorted`, que devolve uma lista nova (sem efeito colateral no chamador) e é **estável** — em empate, vale a ordem configurada.',
      },
      {
        type: 'code',
        id: 'dp-int2-q5',
        concept: 'Observer',
        title: 'Orquestrador com eventos e failover',
        points: 50,
        say: 'Parte 2: o orquestrador. Ele usa a estratégia injetada, faz failover e avisa os outros times por eventos. Cuidado com os erros!',
        prompt: `O código da parte 1 já está no topo (sem o registro, para encurtar): \`Pagamento\`, os provedores, \`por_prioridade\` e \`mais_barato\`.

1. **Observer** — \`EventBus\`:
   - \`inscrever(evento, callback)\` registra um assinante;
   - \`publicar(evento, **dados)\` chama \`callback(**dados)\` para cada assinante daquele evento, **na ordem de inscrição**;
   - se um assinante lançar exceção, os demais continuam sendo chamados e o erro vai para a lista \`bus.erros\` como \`(evento, excecao)\`.
2. \`Orquestrador(provedores, estrategia, bus)\` — \`pagar(pagamento)\`:
   - tenta os provedores **na ordem devolvida pela estratégia injetada**;
   - \`ProvedorIndisponivel\` → publica \`"provedor_indisponivel"\` (\`pagamento\`, \`provedor\`=nome) e tenta o próximo;
   - **qualquer outra exceção sobe**, sem tentar outro provedor;
   - sucesso → publica \`"pagamento_aprovado"\` (\`pagamento\`, \`provedor\`=nome, \`transacao\`) e devolve o id da transação;
   - ninguém conseguiu (ou não havia candidatos) → publica \`"pagamento_falhou"\` (\`pagamento\`) e lança \`SemProvedorDisponivel\`.

\`\`\`python
bus = EventBus()
bus.inscrever("pagamento_aprovado", lambda **d: print("e-mail para", d["pagamento"].id))
orq = Orquestrador([Alfa(fora_do_ar=True), Beta()], por_prioridade, bus)
orq.pagar(Pagamento("p1", 1000, "cartao"))    # 'beta-p1' (e imprime: e-mail para p1)
\`\`\``,
        starter: BASE + '\n\n' + PROVS_SIMPLES + '\n\n' + ESTRATEGIAS_OK + '\n\n' + ORQ_TODO,
        tests: [
          {
            name: 'EventBus chama os assinantes na ordem de inscrição',
            code: py(`
              bus = EventBus()
              log = []
              bus.inscrever("x", lambda **d: log.append(("a", d)))
              bus.inscrever("x", lambda **d: log.append(("b", d)))
              bus.inscrever("y", lambda **d: log.append(("c", d)))
              bus.publicar("x", n=1)
              assert log == [("a", {"n": 1}), ("b", {"n": 1})], log
            `),
          },
          {
            name: 'evento sem assinantes não é erro',
            code: py(`
              bus = EventBus()
              bus.publicar("ninguem_ouve", n=1)
              assert bus.erros == [], bus.erros
            `),
          },
          {
            name: 'aprovado no primeiro provedor',
            code: LOG + py(`
              detalhes = []
              bus.inscrever("pagamento_aprovado", lambda **d: detalhes.append(d))
              alfa, beta = Alfa(), Beta()
              orq = Orquestrador([alfa, beta], por_prioridade, bus)
              assert orq.pagar(Pagamento("p1", 1000, "cartao")) == "alfa-p1"
              assert log == [("pagamento_aprovado", "alfa")], log
              assert detalhes[0]["transacao"] == "alfa-p1" and detalhes[0]["pagamento"].id == "p1", detalhes
              assert beta.cobrancas == [], "só o primeiro provedor deveria ser cobrado"
            `),
          },
          {
            name: 'failover quando o provedor está fora do ar',
            code: LOG + py(`
              orq = Orquestrador([Alfa(fora_do_ar=True), Beta()], por_prioridade, bus)
              assert orq.pagar(Pagamento("p2", 1000, "cartao")) == "beta-p2"
              assert log == [("provedor_indisponivel", "alfa"), ("pagamento_aprovado", "beta")], log
            `),
          },
          { name: 'a estratégia injetada decide a ordem', expr: 'Orquestrador([Alfa(), Beta()], mais_barato, EventBus()).pagar(Pagamento("p3", 2000, "cartao"))', expected: '"beta-p3"' },
          {
            name: 'todos fora do ar → SemProvedorDisponivel',
            hidden: true,
            code: LOG + py(`
              orq = Orquestrador([Alfa(fora_do_ar=True), Beta(fora_do_ar=True)], por_prioridade, bus)
              try:
                  orq.pagar(Pagamento("p4", 1000, "cartao"))
              except SemProvedorDisponivel:
                  pass
              else:
                  raise AssertionError("sem provedor disponível, pagar() deveria lançar SemProvedorDisponivel")
              esperado = [("provedor_indisponivel", "alfa"), ("provedor_indisponivel", "beta"), ("pagamento_falhou", None)]
              assert log == esperado, log
            `),
          },
          {
            name: 'método sem candidatos → SemProvedorDisponivel',
            hidden: true,
            code: LOG + py(`
              orq = Orquestrador([Alfa(), PixFacil()], por_prioridade, bus)
              try:
                  orq.pagar(Pagamento("p5", 1000, "boleto"))
              except SemProvedorDisponivel:
                  pass
              else:
                  raise AssertionError("sem candidatos, pagar() deveria lançar SemProvedorDisponivel")
              assert log == [("pagamento_falhou", None)], log
            `),
          },
          {
            name: 'timeout NÃO dispara failover',
            hidden: true,
            code: py(`
              class Lento(Provedor):
                  nome = "lento"
                  metodos = frozenset({"cartao"})

                  def cobrar(self, pagamento):
                      raise TimeoutError("sem resposta em 10 s")

              beta = Beta()
              bus = EventBus()
              aprovados = []
              bus.inscrever("pagamento_aprovado", lambda **d: aprovados.append(d["provedor"]))
              orq = Orquestrador([Lento(), beta], por_prioridade, bus)
              try:
                  orq.pagar(Pagamento("p6", 1000, "cartao"))
              except TimeoutError:
                  pass
              else:
                  raise AssertionError("TimeoutError deveria subir: timeout é ambíguo, a cobrança pode ter acontecido")
              assert beta.cobrancas == [], "failover depois de um timeout pode cobrar o cliente duas vezes!"
              assert aprovados == [], aprovados
            `),
          },
          {
            name: 'assinante com defeito não derruba o pagamento',
            hidden: true,
            code: py(`
              def quebrado(**dados):
                  raise RuntimeError("serviço de e-mail fora do ar")

              bus = EventBus()
              recebidos = []
              bus.inscrever("pagamento_aprovado", quebrado)
              bus.inscrever("pagamento_aprovado", lambda **d: recebidos.append(d["transacao"]))
              orq = Orquestrador([Alfa()], por_prioridade, bus)
              assert orq.pagar(Pagamento("p7", 1000, "cartao")) == "alfa-p7", "a cobrança já aconteceu: um assinante com defeito não pode fazer pagar() falhar"
              assert recebidos == ["alfa-p7"], "os demais assinantes precisam ser chamados"
              assert len(bus.erros) == 1, bus.erros
              evento, erro = bus.erros[0]
              assert evento == "pagamento_aprovado" and isinstance(erro, RuntimeError), bus.erros
            `),
          },
          {
            name: 'qualquer callable serve de estratégia',
            hidden: true,
            code: py(`
              alfa, beta = Alfa(), Beta()
              ao_contrario = lambda pagamento, provedores: list(reversed(provedores))
              orq = Orquestrador([alfa, beta], ao_contrario, EventBus())
              assert orq.pagar(Pagamento("p8", 1000, "cartao")) == "beta-p8", "use a estratégia recebida no construtor"
              assert alfa.cobrancas == []
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /except\s*(\(\s*)?(Exception|BaseException)?\s*(\)\s*)?(as\s+\w+\s*)?:/.test(depoisDoOrquestrador(code)),
            text: 'Parece que o `Orquestrador` captura **qualquer** exceção para fazer failover. Timeout, cartão recusado ou bug não significam "nada foi processado" — só `ProvedorIndisponivel` garante isso. Capture a exceção específica.',
            concept: 'Failover e timeout ambíguo',
          },
          {
            when: (m, code) => /\b(mais_barato|por_prioridade)\s*\(/.test(depoisDoOrquestrador(code)),
            text: 'O `Orquestrador` chama uma estratégia específica. Use a estratégia **injetada** (`self.estrategia`): é isso que permite trocar a política de roteamento sem tocar no orquestrador.',
            concept: 'Strategy',
          },
          {
            when: (m, code) => /\b(Alfa|Beta|PixFacil)\s*\(/.test(depoisDoOrquestrador(code)),
            text: 'O `Orquestrador` instancia provedores concretos. Receba-os prontos no construtor (injeção de dependência): assim a config decide quem entra e os testes passam fakes.',
            concept: 'Injeção de dependência',
          },
          {
            when: m => m.calls.includes('isinstance'),
            text: 'Checar tipos com `isinstance` acopla o código a classes concretas. Confie no contrato (`cobrar`) e na exceção específica.',
            concept: 'Polimorfismo',
          },
        ],
        hints: [
          'No `EventBus`: `self._assinantes = {}` (evento → lista de callbacks) e `self.erros = []`. Em `inscrever`: `self._assinantes.setdefault(evento, []).append(callback)`.',
          'Em `publicar`, chame cada `callback(**dados)` dentro de `try/except Exception as erro:` e guarde `(evento, erro)` em `self.erros` — a cobrança já aconteceu, e um e-mail quebrado não pode desfazê-la.',
          'Em `pagar`: `for provedor in self.estrategia(pagamento, self.provedores):` com `try/except ProvedorIndisponivel` (**só** ela!) em volta de `provedor.cobrar(pagamento)`. Depois do laço: publique `"pagamento_falhou"` e `raise SemProvedorDisponivel(pagamento.id)`.',
        ],
        solution: BASE + '\n\n' + PROVS_SIMPLES + '\n\n' + ESTRATEGIAS_OK + '\n\n' + ORQ_OK,
        solutionExplanation: 'O `EventBus` é um Observer com intermediário: guarda callbacks por nome de evento, chama-os na ordem de inscrição e **isola** cada assinante — a cobrança já aconteceu, então um e-mail com defeito vira um registro em `erros`, e não uma exceção em `pagar`. O `Orquestrador` recebe provedores, estratégia e bus prontos (injeção) e não conhece nenhuma classe concreta. O failover captura **só** `ProvedorIndisponivel`, o único erro que garante "nada foi processado"; timeout, recusa do cartão ou bug sobem, porque tentar outro provedor poderia cobrar o cliente duas vezes.',
      },
      {
        type: 'mcq',
        id: 'dp-int2-q6',
        concept: 'Failover e timeout ambíguo',
        say: 'Follow-up de produção. Esse aqui já causou cobrança dupla em muita empresa…',
        prompt: 'Em produção, o SDK do **Alfa** estourou o tempo (`TimeoutError` depois de 10 s). Um colega propõe: "é só tratar timeout como `ProvedorIndisponivel` — aí o orquestrador cai para o Beta". O que você responde?',
        options: [
          { text: 'Não: timeout é **ambíguo** — o Alfa pode ter cobrado e só a resposta se perdeu. Failover automático só em erros que garantem "nada foi processado"; no timeout, consulto o status no Alfa (com a mesma chave de idempotência) antes de decidir.', correct: true, why: 'Cobrar no Beta depois de um timeout do Alfa pode cobrar o cliente **duas vezes**. A decisão depende de reconciliar o estado no provedor original.' },
          { text: 'Concordo: failover existe justamente para isso, e o cliente prefere pagar a ver um erro.', why: 'Trocar de provedor depois de um timeout arrisca **cobrança dupla**: a primeira pode ter sido aprovada e só a resposta se perdeu.' },
          { text: 'Concordo, desde que o Beta receba a mesma `Idempotency-Key` usada no Alfa.', why: 'Chaves de idempotência valem **dentro de um provedor**: o Beta não sabe nada do que o Alfa fez. Deduplicar entre provedores é problema seu.' },
          { text: 'Nem Alfa nem Beta: devolvo erro ao cliente e peço que ele clique em "pagar" de novo.', why: 'Empurra a ambiguidade para o cliente: o novo clique pode gerar uma segunda cobrança. O sistema precisa reconciliar o estado (consultar o status) antes de responder.' },
        ],
        explanation: 'O live coding já separava os dois casos: `ProvedorIndisponivel` significa "recusado antes de processar" (failover seguro); qualquer outro erro sobe. Em pagamentos, a sequência madura é: timeout → consultar o status no **mesmo** provedor com a chave de idempotência → decidir. Os padrões organizam o código, mas quem garante a correção é a **semântica dos erros**.',
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Vamos contar: Adapter, Registry, Factory, Strategy, Observer e uma cadeia de failover. Seis padrões num sistema só.',
          'Isso é bom ou ruim? Depende do que eles **custam** — e todo padrão cobra alguma coisa.',
        ],
        board: {
          title: 'O preço de cada padrão',
          md: `| Padrão | Ganho | Custo |
|---|---|---|
| Adapter | SDK isolado; fake fácil nos testes | uma classe por provedor |
| Registry + Factory | provedor novo sem editar o núcleo | nome errado só falha em runtime; registro global |
| Strategy | regras de roteamento trocáveis e testáveis | mais um salto para ler o fluxo |
| Observer | outros times reagem sem acoplar | fluxo invisível; ordem e falhas implícitas |
| Failover | disponibilidade | risco de efeito duplicado; exige semântica de erro clara |

**Com um provedor só**, quase tudo isso vira peso morto: uma chamada direta atrás de um adapter fino resolve.

> [!sabia] Kent Beck e Erich Gamma cunharam o termo **pattern density** (densidade de padrões) no artigo *JUnit: A Cook's Tour*: o \`TestCase\` do JUnit era, ao mesmo tempo, Command, Template Method e peça de um Composite. A conclusão deles: designs com alta densidade de padrões são **fáceis de usar e difíceis de mudar** — frameworks maduros são densos; sistemas jovens devem começar ralos e "comprimir" o design só depois de entender o problema. O erro oposto tem nome no catálogo de Fowler: **Speculative Generality**, o *smell* das abstrações criadas "porque um dia vamos precisar".`,
        },
      },
      {
        type: 'open',
        id: 'dp-int2-q7',
        concept: 'Quando não usar padrões',
        say: 'Última pergunta, e é a minha favorita.',
        prompt: 'E se a Loja Aurora só aceitasse **Pix**, com **um único provedor** e nenhum plano de ter outros? Você manteria Registry, Strategy e EventBus? Explique quando **não** usar esses padrões, o que faria no lugar e que **sinais** fariam você introduzi-los.',
        minWords: 30,
        rubric: [
          { label: 'Aponta o custo: **over-engineering** / indireção sem problema real (YAGNI)', keywords: ['yagni', 'over-engineering', 'overengineering', 'over engineering', 'complexidade', 'indirec', 'desnecessari', 'excesso', 'especulat', 'speculative', 'prematur', 'cerimonia', 'peso morto', 'nao manteria', 'nao usaria'], concept: 'YAGNI', why: 'Cada padrão adiciona indireção; sem variação real, é só custo de leitura e manutenção.' },
          { label: 'Propõe algo **simples** no lugar (chamada direta, uma função)', keywords: ['simples', 'simplic', 'chamada direta', 'chamar direto', 'diretamente', 'direto', 'uma funcao', 'kiss'], concept: 'Simplicidade (KISS)', why: 'Um fluxo linear que cabe numa função é mais fácil de ler, testar e mudar.' },
          { label: 'Cita **gatilhos** concretos para introduzir os padrões (2º provedor, regra de três, outros times)', keywords: ['segundo provedor', 'segundo', 'terceiro', 'regra de tres', 'quando surgir', 'quando aparecer', 'quando precisar', 'quando houver', 'quando chegar', 'novo provedor', 'novos provedores', 'mais de um', 'variacao', 'necessidade real'], concept: 'Padrões resolvem problemas', why: 'O padrão entra quando a força que ele resolve aparece — não antes.' },
          { label: 'Mantém uma **fronteira fina** (adapter) para o SDK externo — testes e refatoração baratos', keywords: ['adapter', 'adaptador', 'fronteira', 'anticorrup', 'isolar o sdk', 'isola o sdk', 'encapsul', 'seam', 'costura', 'fake', 'dubl', 'mock', 'refator'], concept: 'Adapter', why: 'Isolar código de terceiros quase sempre se paga: dá uma costura para testes e deixa a evolução barata.' },
        ],
        modelAnswer: `Não manteria. Com um único provedor e nenhuma variação à vista, Registry, Strategy e EventBus seriam **over-engineering**: três indireções para ler um fluxo que cabe numa função — e abstrações "para o futuro" (*Speculative Generality*) costumam errar o futuro. Sigo o **YAGNI**.

No lugar, faria o **simples**: \`pagar()\` chama o provedor **diretamente** e, depois, envia o e-mail. O único padrão que eu manteria é um **adapter** fino em volta do SDK: ele isola o código externo (uma **fronteira**), dá uma **costura** para usar um fake nos testes e deixa a refatoração barata.

Os **gatilhos** seriam concretos: o **segundo provedor** chegando (aí entram a Strategy e o failover), a mesma estrutura se repetindo pela terceira vez (regra de três → registry) ou outros times precisando reagir ao pagamento sem tocar no núcleo (Observer).`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Obrigada! Foi uma ótima conversa de design.',
          'Você combinou Adapter, Registry, Strategy e Observer com justificativa, tratou falhas reais e soube dizer quando **não** usar padrão. O resultado detalhado vem a seguir.',
        ],
        board: null,
      },
    ],
  });
})();
