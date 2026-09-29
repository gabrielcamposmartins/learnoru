Game.registerModule('architecture', {
  id: 'interview-ddd',
  title: 'Entrevista: Domain-Driven Design',
  kind: 'interview',
  level: 3,
  order: 90,
  unit: 'entrevistas',
  summary: 'Modele uma plataforma de cursos online como numa entrevista real: bounded contexts, agregados, consistência eventual e código.',
  concepts: ['Bounded Context', 'Aggregate', 'Domain Events', 'Consistência eventual', 'Value Object', 'Concorrência otimista'],
  takeaways: [
    'Divida por **capacidade de negócio e linguagem** (Catálogo, Matrículas, Pagamentos, Certificação) — nunca por camadas técnicas ou "um serviço por entidade".',
    '**Eventos pivotais** — os fatos que mudam a fase do negócio — são ótimos candidatos a fronteira de contexto.',
    'A **invariante** escolhe o agregado: "a turma nunca passa do limite de vagas" depende das matrículas da turma, então `Turma` é a raiz.',
    'Entre contextos: **eventos de domínio** e **consistência eventual**, com reserva/compensação para os caminhos de falha e consumidores **idempotentes**.',
    'Duas cópias do mesmo agregado em memória? **Concorrência otimista** com número de versão: só uma gravação vence.',
  ],
  glossary: [
    { term: 'Evento pivotal', aliases: ['eventos pivotais', 'pivotal event', 'pivotal events'], definition: 'No Event Storming, um dos poucos eventos que mudam a **fase** do negócio (ex.: *Pagamento Aprovado*). Depois dele mudam as pessoas envolvidas, o vocabulário e as regras — por isso é um forte candidato a fronteira de bounded context.' },
    { term: 'Capacidade de negócio', aliases: ['capacidades de negócio', 'business capability', 'business capabilities'], definition: 'Algo que a empresa **faz** (publicar cursos, matricular, cobrar, certificar), independente de como ou por quem. Bounded contexts e serviços costumam se alinhar a capacidades — e não a entidades ou camadas técnicas.' },
    { term: 'Fronteira de consistência', aliases: ['fronteiras de consistência', 'consistency boundary'], definition: 'O conjunto de dados que precisa estar correto **ao fim da mesma transação**. Em DDD, é o agregado: dentro dele a consistência é imediata; entre agregados, eventual.' },
    { term: 'Consumidor idempotente', aliases: ['consumidores idempotentes', 'idempotent consumer'], definition: 'Consumidor de mensagens para o qual receber a mesma mensagem duas vezes tem o mesmo efeito que recebê-la uma vez — por exemplo, registrando os ids já processados. Necessário porque filas e barramentos entregam *at-least-once*.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Olá! Obrigada por vir. Eu vou conduzir sua entrevista de **modelagem de domínio**.',
        'O cenário é uma plataforma de cursos online, a **Aprende+**. Vou te passar os requisitos e a gente modela junto: contextos, agregados, consistência — e um pouco de código.',
        { text: 'Pode pensar em voz alta. Em DDD, o raciocínio sobre as fronteiras vale mais que a resposta decorada.', mood: 'neutral' },
      ],
      board: {
        title: '🎓 Aprende+ — requisitos',
        md: `- **Professores** publicam cursos no catálogo (título, descrição, preço, ementa)
- Cada curso tem **turmas** com período definido e **vagas limitadas**
- **Alunos** se matriculam numa turma; a matrícula só é **confirmada após o pagamento** ser aprovado
- Ao concluir a turma, o aluno recebe um **certificado** com código de verificação

**Roteiro da entrevista**
1. Bounded contexts
2. Agregados e invariantes
3. Consistência entre agregados
4. Código de um agregado e de um value object`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Antes da primeira pergunta, uma heurística que eu adoro ver candidatos usando para achar fronteiras.',
        'Conte a **história** do negócio como uma linha do tempo de eventos — e procure onde ela muda de fase.',
      ],
      board: {
        title: 'Heurística: eventos pivotais',
        md: `Linha do tempo de um **e-commerce**, no estilo Event Storming:

\`\`\`text
 Produto Publicado
 Preço Alterado
 Item Adicionado ao Carrinho
 ◆ PEDIDO REALIZADO ───────────── fim da compra; começa a cobrança
 Cobrança Criada
 ◆ PAGAMENTO APROVADO ─────────── dinheiro garantido; começa a operação
 Pacote Separado
 ◆ PEDIDO DESPACHADO ──────────── saiu do galpão; começa a entrega
 Entrega Confirmada
\`\`\`

Entre dois ◆ há uma **fase**, e o vocabulário muda junto: *carrinho* e *cliente* → *cobrança* e *estorno* → *pacote* e *destinatário*. Cada fase é uma candidata a **bounded context** (Vendas, Pagamentos, Logística).

> [!sabia] Alberto Brandolini, criador do Event Storming, chama esses marcos de **eventos pivotais** (*pivotal events*): os poucos fatos que mudam a fase do negócio. Depois deles mudam as **pessoas** envolvidas, o **vocabulário** e as **regras** — exatamente os sinais de uma fronteira de contexto. Procurar os eventos pivotais primeiro é um atalho para dividir um domínio em poucos minutos de conversa.`,
      },
    },
    {
      type: 'mcq',
      id: 'arq-ddd-int-q1',
      concept: 'Bounded Context',
      say: 'Primeira decisão: como você dividiria esse domínio?',
      prompt: 'Qual divisão em **bounded contexts** faz mais sentido para a Aprende+?',
      options: [
        { text: '**Catálogo** (cursos, ementas), **Matrículas** (turmas, vagas, matrículas), **Pagamentos** e **Certificação**.', correct: true, why: 'Cada contexto tem linguagem, regras e ritmo de mudança próprios — e "curso" significa coisas diferentes em Catálogo e em Matrículas.' },
        { text: '**Controllers**, **Services** e **Repositories**.', why: 'Isso são camadas técnicas, não fronteiras de domínio. Todos os conceitos de negócio ficariam misturados em cada camada.' },
        { text: 'Um serviço por entidade: **Aluno**, **Curso**, **Professor**, **Turma**.', why: 'Dividir por substantivo gera serviços que precisam conversar o tempo todo para qualquer regra ("serviços CRUD"). Contextos se organizam por capacidade de negócio.' },
        { text: 'Um único contexto com um modelo compartilhado por tudo.', why: 'O modelo único cresce sem controle: "Curso" para o Catálogo (texto de venda) e para Matrículas (vagas, datas) são conceitos diferentes.' },
      ],
      explanation: 'Bounded contexts se alinham a **capacidades de negócio** e à linguagem: Catálogo fala em ementa e preço de vitrine; Matrículas, em turmas e vagas; Pagamentos, em cobranças e estornos; Certificação, em emissão e verificação. Camadas técnicas ou "um serviço por entidade" não são fronteiras de domínio.',
    },
    {
      type: 'mcq',
      id: 'arq-ddd-int-q2',
      concept: 'Aggregate',
      say: 'Ótimo. Agora dentro de Matrículas: onde fica a regra das vagas?',
      prompt: 'A regra é: **"uma turma nunca pode ter mais matrículas que vagas"**. Qual agregado deve proteger essa invariante?',
      options: [
        { text: '`Turma`: ela conhece as vagas e os alunos matriculados, e toda matrícula passa pela raiz.', correct: true, why: 'A invariante envolve o conjunto de matrículas de uma turma — então a turma é a fronteira de consistência.' },
        { text: '`Aluno`: cada aluno verifica se a turma tem vaga antes de se matricular.', why: 'Um aluno não enxerga as matrículas dos outros; duas matrículas simultâneas quebrariam a regra.' },
        { text: '`Curso`, do contexto de Catálogo.', why: 'Catálogo é outro bounded context, e vagas são um conceito de Matrículas. Além disso, um agregado "Curso" com todas as turmas ficaria enorme.' },
        { text: '`Pagamento`: só aprova o pagamento se houver vaga.', why: 'Pagamentos não deveria conhecer regras de vagas; isso vazaria regra de Matrículas para outro contexto.' },
      ],
      explanation: 'Uma invariante define a **fronteira do agregado**: tudo que precisa ser consistente **na mesma transação** fica junto. Como a regra das vagas depende das matrículas de uma turma, `Turma` é a raiz — e o agregado continua pequeno (guarda só os **ids** dos alunos).',
    },
    {
      type: 'open',
      id: 'arq-ddd-int-q3',
      concept: 'Consistência eventual',
      say: 'Essa é a pergunta que separa quem decorou DDD de quem já aplicou.',
      prompt: 'Quando o **pagamento é aprovado** (contexto de Pagamentos), a **matrícula** deve ser confirmada (contexto de Matrículas). Você faria isso numa única transação envolvendo os dois agregados? Como integraria, e o que acontece se a turma lotar nesse meio-tempo?',
      minWords: 25,
      rubric: [
        { label: 'Evita transação única: **uma transação por agregado** / contextos independentes', keywords: ['uma transac', 'um agregado por', 'por agregado', 'transacao distribuida', 'nao usaria', 'nao faria', 'transacoes separadas', 'independ'], concept: 'Aggregate' },
        { label: 'Integra por **eventos de domínio** (ex.: PagamentoAprovado)', keywords: ['evento', 'pagamentoaprovado', 'pagamento aprovado', 'publica', 'mensag', 'fila', 'assincron'], concept: 'Domain Events' },
        { label: 'Assume **consistência eventual**', keywords: ['eventual', ['consisten', 'depois'], 'alguns segundos', 'atraso'], concept: 'Consistência eventual' },
        { label: 'Trata a falha: **compensação/estorno**, idempotência ou reserva de vaga', keywords: ['estorn', 'compens', 'reembols', 'idempot', 'reserv', 'saga', 'cancel'], concept: 'Saga / compensação', why: 'Com consistência eventual, a falha é um caminho de negócio que precisa ser modelado.' },
      ],
      modelAnswer: `Eu **não** faria uma transação única: Pagamento e Turma são agregados de **contextos diferentes** — a regra do DDD é **uma transação por agregado**. Uma transação distribuída acoplaria os contextos e escalaria mal.

A integração seria por **eventos de domínio**: Pagamentos publica \`PagamentoAprovado(matricula_id)\`; Matrículas consome o evento e confirma a matrícula na turma. Isso é **consistência eventual**: por alguns instantes o pagamento está aprovado e a matrícula ainda pendente — o que é aceitável para o negócio.

Se a turma lotar nesse meio-tempo, é um caminho de negócio a modelar: dá para **reservar a vaga** ao iniciar a matrícula (com expiração) ou, se não houver vaga ao processar o evento, publicar \`MatriculaRecusada\` e disparar o **estorno** (compensação, estilo saga). O consumidor precisa ser **idempotente**, porque o mesmo evento pode chegar duas vezes.`,
    },
    {
      type: 'order',
      id: 'arq-rx2-ddd-int-q7',
      concept: 'Integração por eventos',
      say: 'Agora me mostra o fluxo feliz, passo a passo — cada passo, uma transação.',
      prompt: 'Ordene o fluxo de uma matrícula **paga** na Aprende+ (com reserva de vaga), integrando os contextos por eventos.',
      items: [
        'Aluno pede a matrícula: `Turma` **reserva** a vaga e a matrícula fica *pendente*',
        'Pagamentos cobra o cartão do aluno',
        'Pagamentos publica o evento `PagamentoAprovado`',
        'Matrículas consome o evento (de forma **idempotente**) e confirma a matrícula',
        'Matrículas publica `MatriculaConfirmada`',
        'Outros contextos reagem — ex.: Certificação passa a acompanhar o aluno na turma',
      ],
      explanation: 'Cada passo altera **um** agregado numa transação própria e avisa os outros por **evento**. A reserva protege a invariante das vagas enquanto o pagamento não sai; `PagamentoAprovado` atravessa a fronteira entre contextos; o consumidor é **idempotente** porque o mesmo evento pode chegar duas vezes. Se o pagamento for recusado ou a reserva expirar, o fluxo alternativo **libera a vaga** — e, se a cobrança já tiver acontecido, dispara o **estorno** (compensação).',
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Muito bom. Vamos para o código: quero ver o agregado `Turma` protegendo a invariante das vagas e registrando eventos.',
      ],
    },
    {
      type: 'code',
      id: 'arq-ddd-int-q4',
      concept: 'Aggregate',
      title: 'Aggregate Turma',
      say: 'Implemente a `Turma`. As exceções e os eventos já estão prontos no código.',
      prompt: `Implemente o agregado \`Turma\`:

- \`Turma(turma_id, vagas)\` — \`vagas <= 0\` levanta \`ValueError\`
- \`matricular(aluno_id)\`:
  - aluno já matriculado → \`ValueError\`
  - sem vagas → \`TurmaLotadaError\` (e **nenhum** evento é registrado)
  - registra \`AlunoMatriculado(turma_id, aluno_id)\` em \`eventos\`; se essa matrícula **ocupar a última vaga**, registra também \`TurmaLotada(turma_id)\`
- \`cancelar(aluno_id)\` — aluno não matriculado → \`KeyError\`; libera a vaga e registra \`MatriculaCancelada(turma_id, aluno_id)\`
- propriedades \`vagas_restantes\` e \`alunos\` (sem expor a coleção interna)`,
      starter: `from dataclasses import dataclass


class TurmaLotadaError(Exception):
    pass


@dataclass(frozen=True)
class AlunoMatriculado:
    turma_id: str
    aluno_id: str


@dataclass(frozen=True)
class TurmaLotada:
    turma_id: str


@dataclass(frozen=True)
class MatriculaCancelada:
    turma_id: str
    aluno_id: str


class Turma:
    def __init__(self, turma_id, vagas):
        pass

    @property
    def vagas_restantes(self):
        pass

    @property
    def alunos(self):
        pass

    def matricular(self, aluno_id):
        pass

    def cancelar(self, aluno_id):
        pass
`,
      tests: [
        { name: 'vagas restantes', code: 't = Turma("t1", 3)\nt.matricular("ana")\nt.matricular("bia")\nassert t.vagas_restantes == 1' },
        { name: 'matricular registra evento', code: 't = Turma("t1", 3)\nt.matricular("ana")\nassert t.eventos == [AlunoMatriculado("t1", "ana")]' },
        { name: 'última vaga gera TurmaLotada', code: 't = Turma("t1", 2)\nt.matricular("ana")\nt.matricular("bia")\nassert t.eventos == [AlunoMatriculado("t1", "ana"), AlunoMatriculado("t1", "bia"), TurmaLotada("t1")]' },
        { name: 'turma lotada recusa matrícula', code: 't = Turma("t1", 1)\nt.matricular("ana")\ntry:\n    t.matricular("bia")\n    assert False, "turma lotada deveria levantar TurmaLotadaError"\nexcept TurmaLotadaError:\n    pass\nassert "bia" not in t.alunos and len(t.eventos) == 2' },
        { name: 'aluno duplicado → ValueError', code: 't = Turma("t1", 5)\nt.matricular("ana")\ntry:\n    t.matricular("ana")\n    assert False, "matrícula duplicada deveria levantar ValueError"\nexcept ValueError:\n    pass\nassert t.vagas_restantes == 4' },
        { name: 'cancelar libera vaga', code: 't = Turma("t1", 1)\nt.matricular("ana")\nt.cancelar("ana")\nassert t.vagas_restantes == 1 and t.eventos[-1] == MatriculaCancelada("t1", "ana")\nt.matricular("bia")\nassert "bia" in t.alunos' },
        { hidden: true, name: 'cancelar aluno inexistente → KeyError', code: 't = Turma("t1", 2)\ntry:\n    t.cancelar("zé")\n    assert False\nexcept KeyError:\n    pass' },
        { hidden: true, name: 'vagas inválidas → ValueError', code: 'for v in (0, -3):\n    try:\n        Turma("t1", v)\n        assert False\n    except ValueError:\n        pass' },
        { hidden: true, name: 'alunos não expõe a coleção interna', code: 't = Turma("t1", 3)\nt.matricular("ana")\nal = t.alunos\nfor op in ("add", "append"):\n    try:\n        getattr(al, op)("intruso")\n    except AttributeError:\n        pass\nassert "intruso" not in t.alunos and t.vagas_restantes == 2' },
      ],
      reviews: [
        {
          when: (m, code) => /self\.alunos\s*=/.test(code),
          text: 'Os alunos ficaram num atributo público (`self.alunos = ...`): qualquer código pode matricular "por fora" e furar o limite de vagas. Guarde em `self._alunos` e exponha um `frozenset`/tupla.',
          concept: 'Aggregate Root: encapsulamento',
        },
        {
          when: (m, code) => /def\s+set_\w+/.test(code),
          text: 'Setters genéricos permitem mudar o estado sem passar pelas regras — sinal de modelo anêmico. Exponha só operações de negócio.',
          concept: 'Modelo rico vs anêmico',
        },
      ],
      hints: [
        'Guarde `self._alunos = set()` e `self._vagas = vagas`; `vagas_restantes` é `self._vagas - len(self._alunos)`.',
        'Em `matricular`, verifique **antes** de alterar qualquer coisa: duplicado, depois lotação. Só então adicione o aluno e os eventos.',
        'Depois de adicionar, `if self.vagas_restantes == 0: self.eventos.append(TurmaLotada(self.id))`. Para `alunos`, devolva `frozenset(self._alunos)`.',
      ],
      solution: `from dataclasses import dataclass


class TurmaLotadaError(Exception):
    pass


@dataclass(frozen=True)
class AlunoMatriculado:
    turma_id: str
    aluno_id: str


@dataclass(frozen=True)
class TurmaLotada:
    turma_id: str


@dataclass(frozen=True)
class MatriculaCancelada:
    turma_id: str
    aluno_id: str


class Turma:
    def __init__(self, turma_id, vagas):
        if vagas <= 0:
            raise ValueError("a turma precisa de pelo menos uma vaga")
        self.id = turma_id
        self._vagas = vagas
        self._alunos = set()
        self.eventos = []

    @property
    def vagas_restantes(self):
        return self._vagas - len(self._alunos)

    @property
    def alunos(self):
        return frozenset(self._alunos)

    def matricular(self, aluno_id):
        if aluno_id in self._alunos:
            raise ValueError(f"{aluno_id} já está matriculado(a)")
        if self.vagas_restantes == 0:
            raise TurmaLotadaError(self.id)
        self._alunos.add(aluno_id)
        self.eventos.append(AlunoMatriculado(self.id, aluno_id))
        if self.vagas_restantes == 0:
            self.eventos.append(TurmaLotada(self.id))

    def cancelar(self, aluno_id):
        if aluno_id not in self._alunos:
            raise KeyError(aluno_id)
        self._alunos.remove(aluno_id)
        self.eventos.append(MatriculaCancelada(self.id, aluno_id))
`,
      solutionExplanation: 'A `Turma` é a fronteira de consistência da regra das vagas: toda matrícula passa pela raiz, que **valida antes de mudar** qualquer coisa — se falhar, nada muda e nenhum evento é registrado. Ela guarda só os **ids** dos alunos (referência a outros agregados por identidade) e expõe um `frozenset`. Os eventos (`AlunoMatriculado`, `TurmaLotada`) permitem que outros contextos reajam — por exemplo, o Catálogo pode marcar a turma como esgotada.',
    },
    {
      type: 'mcq',
      id: 'arq-ddd-int-q5',
      concept: 'Concorrência otimista',
      say: 'Follow-up de produção: e se duas pessoas disputarem a última vaga no mesmo instante?',
      prompt: 'Dois servidores carregam a mesma `Turma` (1 vaga restante) ao mesmo tempo, cada um matricula um aluno diferente e salva. Como garantir que a invariante não seja violada?',
      options: [
        { text: 'Concorrência otimista: o agregado tem um número de **versão**; o repositório só salva se a versão no banco for a mesma que foi carregada — o segundo salvamento falha e é refeito.', correct: true, why: 'É a técnica padrão para agregados: o conflito é detectado na gravação, sem locks longos.' },
        { text: 'Verificar a vaga no controller antes de chamar o agregado.', why: 'As duas requisições verificariam ao mesmo tempo, veriam 1 vaga e seguiriam — a condição de corrida continua.' },
        { text: 'Colocar a turma em cache para responder mais rápido.', why: 'Cache não resolve concorrência; pode até piorar, com dados desatualizados.' },
        { text: 'Aceitar a turma com vagas a mais e corrigir manualmente depois.', why: 'Isso viola a invariante que o agregado deveria proteger — overbooking vira problema de negócio.' },
      ],
      explanation: 'A invariante é garantida **dentro** do agregado, mas duas cópias em memória podem divergir. Com **concorrência otimista** (campo `versao` e um `UPDATE ... WHERE versao = :carregada`), só uma gravação vence; a outra recarrega a turma, vê que lotou e recebe `TurmaLotadaError`. Agregados pequenos tornam esses conflitos raros.',
    },
    {
      type: 'code',
      id: 'arq-ddd-int-q6',
      concept: 'Value Object',
      title: 'Value Object Período',
      say: 'Última: turmas do mesmo professor não podem ter períodos sobrepostos. Modele o `Periodo` como value object.',
      prompt: `Implemente o value object \`Periodo(inicio, fim)\` com datas (\`date\`), **ambas inclusivas**:

- **imutável** e com igualdade por valor
- \`fim\` antes de \`inicio\` → \`ValueError\` (um período de um dia só, com \`inicio == fim\`, é válido)
- \`dias\` (propriedade): quantidade de dias do período, contando as pontas
- \`contem(dia)\`: \`True\` se a data está dentro do período
- \`sobrepoe(outro)\`: \`True\` se os dois períodos têm **pelo menos um dia em comum**`,
      starter: `from dataclasses import dataclass
from datetime import date


@dataclass
class Periodo:
    inicio: date
    fim: date

    @property
    def dias(self):
        pass

    def contem(self, dia):
        pass

    def sobrepoe(self, outro):
        pass
`,
      tests: [
        { name: 'dias (inclusivo)', expr: 'Periodo(date(2025, 3, 1), date(2025, 3, 10)).dias', expected: '10' },
        { name: 'período de um dia', expr: 'Periodo(date(2025, 3, 1), date(2025, 3, 1)).dias', expected: '1' },
        { name: 'contem', expr: '[Periodo(date(2025, 3, 1), date(2025, 3, 10)).contem(d) for d in (date(2025, 3, 1), date(2025, 3, 10), date(2025, 3, 11))]', expected: '[True, True, False]' },
        { name: 'sobreposição parcial', expr: 'Periodo(date(2025, 3, 1), date(2025, 3, 10)).sobrepoe(Periodo(date(2025, 3, 8), date(2025, 3, 20)))', expected: 'True' },
        { name: 'períodos separados', expr: 'Periodo(date(2025, 3, 1), date(2025, 3, 10)).sobrepoe(Periodo(date(2025, 3, 11), date(2025, 3, 20)))', expected: 'False' },
        { name: 'fim antes do início → ValueError', code: 'try:\n    Periodo(date(2025, 3, 10), date(2025, 3, 1))\n    assert False, "deveria levantar ValueError"\nexcept ValueError:\n    pass' },
        { hidden: true, name: 'encostados na ponta se sobrepõem (inclusivo)', expr: 'Periodo(date(2025, 3, 1), date(2025, 3, 10)).sobrepoe(Periodo(date(2025, 3, 10), date(2025, 3, 12)))', expected: 'True' },
        { hidden: true, name: 'um contido no outro (nos dois sentidos)', code: 'a = Periodo(date(2025, 1, 1), date(2025, 12, 31))\nb = Periodo(date(2025, 6, 1), date(2025, 6, 2))\nassert a.sobrepoe(b) and b.sobrepoe(a)\nc = Periodo(date(2026, 1, 1), date(2026, 1, 1))\nassert not a.sobrepoe(c) and not c.sobrepoe(a)' },
        { hidden: true, name: 'imutável e igual por valor', code: 'p = Periodo(date(2025, 1, 1), date(2025, 1, 2))\nassert p == Periodo(date(2025, 1, 1), date(2025, 1, 2))\ntry:\n    p.fim = date(2030, 1, 1)\n    assert False\nexcept AttributeError:\n    pass' },
      ],
      reviews: [
        {
          when: (m, code) => !/frozen\s*=\s*True/.test(code),
          text: 'O `Periodo` não usa `@dataclass(frozen=True)`. Value objects devem ser imutáveis — o `frozen` garante isso e ainda dá `==` e `hash` por valor.',
          concept: 'Value Object imutável',
        },
        {
          when: (m, code) => (code.match(/\bif\b/g) || []).length >= 4,
          text: 'A sobreposição virou uma coleção de casos (`if` para cada situação). A condição clássica `self.inicio <= outro.fim and outro.inicio <= self.fim` cobre todos de uma vez.',
          concept: 'Sobreposição de intervalos',
        },
      ],
      hints: [
        'Use `@dataclass(frozen=True)` e valide no `__post_init__`: `if self.fim < self.inicio: raise ValueError(...)`.',
        '`dias` é `(self.fim - self.inicio).days + 1` — o `+ 1` conta as duas pontas.',
        'Dois intervalos inclusivos se sobrepõem quando **cada um começa antes (ou no dia) que o outro termina**: `self.inicio <= outro.fim and outro.inicio <= self.fim`.',
      ],
      solution: `from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Periodo:
    inicio: date
    fim: date

    def __post_init__(self):
        if self.fim < self.inicio:
            raise ValueError("o fim não pode ser antes do início")

    @property
    def dias(self):
        return (self.fim - self.inicio).days + 1

    def contem(self, dia):
        return self.inicio <= dia <= self.fim

    def sobrepoe(self, outro):
        return self.inicio <= outro.fim and outro.inicio <= self.fim
`,
      solutionExplanation: 'Imutável e validado na construção, o `Periodo` nunca existe invertido. A sobreposição usa a condição clássica de intervalos — duas comparações cobrem sobreposição parcial, contenção nos dois sentidos e pontas encostadas. Como é um value object, a regra de sobreposição mora **no próprio conceito**, e não espalhada pelos serviços.',
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'É isso! Obrigada pela conversa. Você separou os contextos pela linguagem do negócio, colocou a invariante das vagas no agregado certo…',
        '…integrou contextos com eventos e consistência eventual, e modelou value objects imutáveis. Exatamente o que eu procuro numa pessoa que vai modelar domínios complexos.',
        { text: 'Dica final: em entrevistas de DDD, sempre justifique **por que** a fronteira está ali — a invariante é o seu melhor argumento.', mood: 'neutral' },
      ],
      board: null,
    },
  ],
});
