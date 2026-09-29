Game.registerModule('architecture', {
  id: 'cqrs-event-sourcing',
  title: 'CQRS e Event Sourcing',
  kind: 'lesson',
  level: 3,
  order: 30,
  unit: 'dados-eventos',
  summary: 'Separar escrita e leitura, guardar fatos em vez de estado — projeções, snapshots, upcasting e quando NÃO usar.',
  concepts: ['CQRS', 'Event Sourcing', 'Projeções', 'Snapshots', 'Upcasting'],
  takeaways: [
    '**CQRS** separa o modelo que **decide** (escrita, com invariantes) dos modelos que **respondem** (leitura, desnormalizados para cada tela).',
    'No **Event Sourcing**, a fonte da verdade é um log **append-only** de eventos; o estado atual é um *fold*: aplicar os eventos em ordem.',
    '`aplicar` **nunca valida** — eventos são fatos. Quem valida é o **comando**, antes de gerar o evento; e o event store grava com **versão esperada** (concorrência otimista).',
    'Projeções são descartáveis e reconstruíveis; com um **checkpoint**, aguentam duplicatas. **Snapshots** aceleram a leitura e **upcasters** cuidam da evolução do esquema.',
    'Não use em CRUD simples: consistência eventual, versionamento de eventos para sempre e LGPD num log imutável custam caro.',
  ],
  glossary: [
    { term: 'CQRS', aliases: ['Command Query Responsibility Segregation'], definition: '*Command Query Responsibility Segregation*: usar **modelos diferentes** para escrever (comandos, invariantes) e para ler (consultas, visões desnormalizadas). Não exige Event Sourcing nem bancos separados.' },
    { term: 'Event Sourcing', aliases: ['event-sourced', 'event sourced'], definition: 'Persistir **cada mudança como um evento** num log append-only, em vez de sobrescrever o estado. O estado atual é reconstruído aplicando os eventos em ordem (um *fold*).' },
    { term: 'Event store', aliases: ['event stores'], definition: 'Banco **append-only** de eventos, organizado em *streams* (normalmente um por agregado). Grava com **concorrência otimista** (versão esperada) e permite ler um stream ou acompanhar todos os eventos em ordem global.' },
    { term: 'Projeção', aliases: ['projeções', 'projection', 'read model', 'modelo de leitura'], definition: 'Componente que consome eventos e mantém um **modelo de leitura** otimizado para uma consulta. É descartável: dá para apagar e reconstruir reprocessando os eventos desde o início.' },
    { term: 'Snapshot', aliases: ['snapshots'], definition: 'Foto do estado de um agregado numa certa versão. Para reconstituí-lo, carrega-se o snapshot e aplicam-se só os eventos posteriores — é uma **otimização** (um cache), não a fonte da verdade.' },
    { term: 'Upcasting', aliases: ['upcaster', 'upcasters'], definition: 'Converter, **na leitura**, eventos antigos para a versão atual do esquema (v1 → v2 → v3), sem reescrever o histórico imutável. O código de domínio só conhece a versão mais nova.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Bem-vinda(o) à unidade **Dados & eventos**! Vamos começar com uma ideia simples e poderosa: **CQRS**.',
        'O modelo que **protege as regras** quase nunca tem o formato que a **tela** quer ler. Então… por que forçar um único modelo a fazer as duas coisas?',
      ],
      board: {
        title: 'CQRS — dois modelos, dois trabalhos',
        md: `\`\`\`text
             ┌────────────── ESCRITA ──────────────┐
 comando ──▶ │ caso de uso → agregado → banco      │ ──┐
             └─────────────────────────────────────┘   │ eventos /
             ┌────────────── LEITURA ──────────────┐   │ mudanças
 consulta ─▶ │ visão desnormalizada, pronta p/ tela│ ◀─┘ (projeção)
             └─────────────────────────────────────┘
\`\`\`

| | Lado de **escrita** (command) | Lado de **leitura** (query) |
|---|---|---|
| Objetivo | Decidir e proteger invariantes | Responder rápido |
| Formato | Agregados normalizados | Visões **desnormalizadas**, uma por tela |
| Escala | Menos escritas | Muitas leituras (cache, réplicas) |
| Consistência | Forte, dentro do agregado | Geralmente **eventual** |

A ideia vem do **CQS** de Bertrand Meyer — "um método ou muda estado ou devolve dado, nunca os dois". Greg Young levou o princípio do método para a arquitetura.

> [!dica] CQRS **não** exige Event Sourcing, nem bancos separados, nem mensageria. Pode ser só: escrever pelo ORM, com as regras, e ler com SQL direto numa view. Comece pequeno.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora a ideia mais radical: **Event Sourcing**. Em vez de guardar o **estado atual** e sobrescrevê-lo, guardamos **cada mudança** como um evento.',
        'O estado vira consequência: é só aplicar os eventos em ordem. Em programação funcional isso tem nome — **fold**, o famoso `reduce`.',
      ],
      board: {
        title: 'Estado = fold(eventos)',
        md: `\`\`\`text
 CRUD tradicional                Event Sourcing — stream "conta-42"
 ┌──────────┬───────┐            #1 ContaAberta(titular="Ana")
 │ conta_id │ saldo │            #2 Depositado(100)
 ├──────────┼───────┤            #3 Sacado(30)
 │ 42       │    75 │            #4 Depositado(5)
 └──────────┴───────┘            saldo = 0 + 100 − 30 + 5 = 75

 CRUD: o UPDATE apaga o passado. Event Sourcing: o passado É o dado.
\`\`\`

\`\`\`python
from functools import reduce

def evoluir(saldo, evento):              # (estado, evento) -> novo estado
    match evento:
        case Depositado(valor=v):
            return saldo + v
        case Sacado(valor=v):
            return saldo - v
    return saldo                         # eventos que não mexem no saldo

saldo = reduce(evoluir, eventos, 0)      # estado = fold dos eventos
\`\`\`

- **Auditoria completa** de graça: o histórico *é* o dado.
- **Viagem no tempo**: "qual era o saldo em 1º de março?" → aplique os eventos até lá.
- **Leituras novas, retroativas**: uma projeção nova processa o histórico inteiro.
- **Depuração**: reproduza exatamente a sequência que causou um bug.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Como fica um agregado com Event Sourcing? Ele tem **duas metades**: os **comandos**, que validam e *decidem* quais eventos gerar…',
        '…e o **aplicar**, que só *evolui* o estado. Regra de ouro: `aplicar` **nunca valida** — um evento é um fato consumado, e não se discute com o passado.',
      ],
      board: {
        title: 'Agregado event-sourced: decidir × evoluir',
        code: `class Conta:
    def __init__(self):
        self.id, self.saldo, self.versao = None, 0, 0
        self.novos_eventos = []            # ainda não gravados no event store

    # ── comando: VALIDA e decide ─────────────────────────
    def sacar(self, valor):
        if valor <= 0 or valor > self.saldo:
            raise ValueError("saque inválido")
        self._registrar(Sacado(self.id, valor))

    def _registrar(self, evento):
        self.aplicar(evento)               # toda mudança passa pelo aplicar
        self.novos_eventos.append(evento)

    # ── evolução: só muda o estado, NUNCA lança ──────────
    def aplicar(self, evento):
        match evento:
            case ContaAberta(conta_id=cid):
                self.id = cid
            case Depositado(valor=v):
                self.saldo += v
            case Sacado(valor=v):
                self.saldo -= v
        self.versao += 1

    @classmethod
    def reconstituir(cls, eventos):
        conta = cls()
        for evento in eventos:
            conta.aplicar(evento)
        return conta`,
        caption: 'Se uma regra mudar amanhã (ex.: um novo limite de saque), eventos antigos que a "violam" continuam válidos — validar no `aplicar` quebraria a reconstrução.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Onde moram os eventos? Num **event store**: um banco **append-only**, organizado em *streams* — normalmente um por agregado.',
        'O detalhe crucial é a **concorrência otimista**: ao gravar, você diz "espero que o stream esteja na versão 7". Se alguém gravou antes, dá conflito — e ninguém sobrescreve ninguém.',
      ],
      board: {
        title: 'Event store e concorrência otimista',
        md: `**Fluxo de um comando:**
1. \`carregar\` o stream e **reconstituir** o agregado (versão *n*)
2. executar o comando → novos eventos
3. \`anexar(novos, versao_esperada=n)\` — se outra escrita chegou antes, **conflito**: recarregue e tente de novo

\`\`\`python
class ConflitoDeVersao(Exception):
    pass

class EventStore:
    def __init__(self):
        self._streams = {}      # stream_id -> [eventos]
        self._todos = []        # (posicao_global, evento) — alimenta as projeções

    def carregar(self, stream_id):
        return list(self._streams.get(stream_id, []))

    def anexar(self, stream_id, eventos, versao_esperada):
        stream = self._streams.setdefault(stream_id, [])
        if len(stream) != versao_esperada:
            raise ConflitoDeVersao(f"esperava v{versao_esperada}, está em v{len(stream)}")
        for evento in eventos:
            stream.append(evento)
            self._todos.append((len(self._todos) + 1, evento))
\`\`\``,
        caption: 'Nada de `UPDATE` nem `DELETE`: o event store só cresce. A posição global é o que as projeções usam para saber "onde parei".',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E as consultas? Ninguém quer fazer *fold* de milhões de eventos a cada tela aberta. Para isso existem as **projeções**.',
        'Uma projeção assina o fluxo de eventos e mantém um **modelo de leitura** pronto para uma consulta. Deu bug? Apague e **reprocesse** tudo desde o evento 1.',
      ],
      board: {
        title: 'Projeções: o lado de leitura',
        md: `\`\`\`text
 event store (posição global)      projeções
  1 ContaAberta(c1, "Ana")  ──┬──▶ SaldosPorConta {c1: 70, c2: 10}
  2 Depositado(c1, 100)       ├──▶ Ranking [("Ana", 70), ("Bia", 10)]
  3 ContaAberta(c2, "Bia")    └──▶ ExtratoMensal (por conta e mês)
  4 Sacado(c1, 30)
  5 Depositado(c2, 10)
\`\`\`

- A projeção guarda um **checkpoint**: a última posição processada. Ao reiniciar, continua dali.
- Entrega *at-least-once* → a mesma posição pode chegar de novo: **ignore o que não passa do checkpoint**.
- Projeções são **descartáveis**: tela nova? Projeção nova, alimentada pelo histórico inteiro.

> [!atencao] O modelo de leitura fica **atrás** da escrita por milissegundos (ou segundos): consistência eventual. A tela que acabou de salvar pode ler do próprio agregado ou mostrar "processando…".`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Dois problemas aparecem com o tempo. Primeiro: um agregado com **100 mil eventos** demora para reconstituir. A saída são os **snapshots**.',
        'Segundo — e esse quase ninguém conhece antes de sofrer: o **formato dos eventos muda**, mas o histórico é imutável. A técnica para isso se chama **upcasting**.',
      ],
      board: {
        title: 'Snapshots e upcasting',
        md: `**Snapshot** = foto do estado na versão *n*. Reconstituir = carregar a foto + aplicar só os eventos depois de *n*. É um **cache**: pode ser apagado e refeito a qualquer momento.

\`\`\`python
# evento v1 (2023): valor em reais, como float
{"tipo": "Depositado", "versao": 1, "conta_id": "c1", "valor": 10.5}
# evento v2 (hoje): centavos inteiros
{"tipo": "Depositado", "versao": 2, "conta_id": "c1", "valor_centavos": 1050}

def upcast_depositado_v1(dado):          # roda NA LEITURA, antes do aplicar
    return {"tipo": "Depositado", "versao": 2, "conta_id": dado["conta_id"],
            "valor_centavos": round(dado["valor"] * 100)}
\`\`\`

> [!sabia] **Upcasting** é converter eventos antigos para o esquema atual **no momento da leitura**, numa cadeia v1 → v2 → v3. O histórico gravado nunca muda, e o domínio só conhece a versão mais nova. As alternativas são piores: aceitar todas as versões no \`aplicar\` (espalha \`if\` pelo código) ou *copy-and-replace* — reescrever o stream inteiro num novo, uma migração rara e arriscada.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora a parte que separa a pessoa sênior da empolgada: **quando não usar**.',
        'Event Sourcing é uma decisão **difícil de desfazer**. O próprio Greg Young, que popularizou o CQRS, alerta: não é arquitetura para o sistema inteiro — use só onde o histórico **é** o negócio.',
      ],
      board: {
        title: 'Quando NÃO usar',
        md: `| Use quando… | Evite quando… |
|---|---|
| O histórico **é** o negócio: conta, ledger, estoque, auditoria regulatória | CRUD simples: cadastro de clientes, configurações |
| Leituras muito diferentes da escrita (muitas telas, relatórios) | A tela lê exatamente o que foi escrito |
| Auditoria, "viagem no tempo", reprocessar o passado | O time não conhece o padrão e o prazo é curto |
| Muita concorrência sobre o mesmo agregado | Toda leitura exige consistência forte |

**Custos reais:**
- consistência eventual na leitura;
- versionamento de eventos **para sempre** (upcasters);
- projeções para reconstruir, monitorar e depurar;
- **LGPD/GDPR**: como "apagar" dados pessoais de um log imutável? Uma técnica é o *crypto-shredding* — cifrar os dados de cada pessoa com uma chave própria e **destruir a chave**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo reconstituir um agregado e escrever uma projeção à prova de duplicatas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'arq-cqrs-q1',
      concept: 'Event Sourcing',
      say: 'Pergunta de base, mas que derruba muita gente em entrevista.',
      prompt: 'Num sistema com **Event Sourcing**, qual é a **fonte da verdade**?',
      options: [
        { text: 'O log append-only de eventos; o estado atual é derivado aplicando-os em ordem.', correct: true, why: 'Exato: o estado é consequência (um *fold*) dos eventos. Estado em memória, snapshots e projeções podem ser reconstruídos a partir deles.' },
        { text: 'A tabela com o estado atual; os eventos são um log de auditoria ao lado.', why: 'Isso é CRUD **com** auditoria. Se o estado é que vale, os dois podem divergir sem que você saiba qual está certo — não é Event Sourcing.' },
        { text: 'O snapshot mais recente de cada agregado.', why: 'Snapshot é **cache** de desempenho: pode ser apagado e recalculado a partir dos eventos.' },
        { text: 'O modelo de leitura (projeção) usado pelas telas.', why: 'Projeções são **descartáveis**, derivadas dos eventos, e ficam atrás da escrita (consistência eventual).' },
      ],
      explanation: 'No Event Sourcing, **só os eventos são gravados como verdade**. Todo o resto — estado do agregado, snapshots, modelos de leitura — é derivado e reconstruível. É isso que permite auditoria completa, "viagem no tempo" e criar projeções novas sobre o histórico inteiro.',
    },
    {
      type: 'order',
      id: 'arq-cqrs-q2',
      concept: 'Event store — fluxo de um comando',
      say: 'Vamos ver se o fluxo ficou claro. Ordene os passos!',
      prompt: 'Ordene o que acontece quando o comando **`sacar(30)`** chega a uma conta event-sourced, do início ao fim.',
      items: [
        'Carregar o stream da conta (ou o snapshot + os eventos posteriores)',
        'Reconstituir o agregado aplicando os eventos em ordem (versão *n*)',
        'Executar o comando: validar o saldo e gerar o evento `Sacado(30)`',
        'Anexar o evento com **versão esperada = n** (conflito se outra escrita chegou antes)',
        'As projeções recebem o evento e atualizam os modelos de leitura',
      ],
      explanation: 'Carregar → reconstituir → decidir → anexar com concorrência otimista → projetar. A **versão esperada** garante que duas escritas concorrentes não se atropelem: a segunda recebe conflito, recarrega o stream e tenta de novo. As projeções vêm **depois**, de forma assíncrona — por isso a leitura é eventualmente consistente.',
    },
    {
      type: 'mcq',
      id: 'arq-cqrs-q3',
      concept: 'Upcasting',
      say: 'Agora um problema que só aparece anos depois do primeiro deploy…',
      prompt: 'O evento `Depositado` v1 guardava `valor` em reais (`float`). A versão 2 usa `valor_centavos` (`int`). Há **três anos** de eventos v1 no event store. Qual a abordagem mais adequada?',
      options: [
        { text: 'Escrever um **upcaster** v1 → v2, aplicado na leitura: o histórico fica intacto e o domínio só conhece a v2.', correct: true, why: 'É o padrão para evolução de esquema em Event Sourcing: conversão na leitura, centralizada e testável isoladamente.' },
        { text: 'Rodar um `UPDATE` na tabela de eventos convertendo o campo de todos os eventos antigos.', why: 'Viola a imutabilidade do log: o histórico deixa de ser confiável (e auditável), e quem já consumiu os eventos antigos fica inconsistente.' },
        { text: 'Apagar os eventos v1 e gravar um snapshot com o saldo atual de cada conta.', why: 'Você perde o histórico — a razão de existir do Event Sourcing (auditoria, reprocessar projeções, viagem no tempo).' },
        { text: 'Tratar as duas versões com `if` em todo `aplicar` e em toda projeção que lê o evento.', why: 'Funciona, mas espalha o conhecimento de versões pelo código inteiro; cada v3, v4… multiplica os `if`. O upcaster concentra isso num lugar só.' },
      ],
      explanation: 'Eventos são **imutáveis**: o que muda é como você os **lê**. O *upcaster* transforma a versão antiga na nova antes do `aplicar`, em cadeia (v1 → v2 → v3). Quando o dado novo não pode ser derivado do antigo, o upcaster preenche um **valor padrão** explícito — ou a mudança vira um evento novo, com outro nome.',
    },
    {
      type: 'code',
      id: 'arq-cqrs-q4',
      concept: 'Decidir × evoluir',
      title: 'Reconstituindo uma conta',
      say: 'Mão na massa: um agregado event-sourced de verdade. Lembre: o comando decide, o `aplicar` só evolui.',
      prompt: `Implemente o agregado event-sourced \`Conta\`. Os eventos já estão prontos: \`ContaAberta(conta_id, titular)\`, \`Depositado(conta_id, valor)\` e \`Sacado(conta_id, valor)\`.

- \`aplicar(evento)\` — **evolui** o estado e **nunca valida**: \`ContaAberta\` define \`id\` e \`titular\`; \`Depositado\` soma ao \`saldo\`; \`Sacado\` subtrai. **Todo** evento incrementa \`versao\`.
- \`Conta.reconstituir(eventos)\` (classmethod) — cria uma conta nova e aplica os eventos em ordem.
- \`sacar(valor)\` — **comando**: se \`valor <= 0\` ou \`valor > saldo\`, lança \`ValueError\` sem mudar nada. Senão, cria \`Sacado(self.id, valor)\`, aplica, guarda em \`novos_eventos\` e devolve o evento.

Uma conta nova (\`Conta()\`) começa com \`id=None\`, \`titular=None\`, \`saldo=0\`, \`versao=0\` e \`novos_eventos=[]\`.`,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class ContaAberta:
    conta_id: str
    titular: str


@dataclass(frozen=True)
class Depositado:
    conta_id: str
    valor: int


@dataclass(frozen=True)
class Sacado:
    conta_id: str
    valor: int


class Conta:
    def __init__(self):
        self.id = None
        self.titular = None
        self.saldo = 0
        self.versao = 0
        self.novos_eventos = []

    def aplicar(self, evento):
        # TODO: evolua o estado conforme o tipo do evento (sem validar!)
        pass

    @classmethod
    def reconstituir(cls, eventos):
        # TODO: crie uma Conta e aplique os eventos em ordem
        pass

    def sacar(self, valor):
        # TODO: valide, gere Sacado, aplique e registre em novos_eventos
        pass
`,
      tests: [
        {
          name: 'reconstituir aplica os eventos em ordem',
          code: `eventos = [ContaAberta("c1", "Ana"), Depositado("c1", 100), Sacado("c1", 30), Depositado("c1", 5)]
c = Conta.reconstituir(eventos)
assert isinstance(c, Conta), "reconstituir deve devolver uma Conta"
assert (c.id, c.titular, c.saldo) == ("c1", "Ana", 75), f"estado inesperado: {(c.id, c.titular, c.saldo)}"
assert c.versao == 4, f"versao deveria ser 4 (uma por evento), obtido {c.versao}"`,
        },
        {
          name: 'reconstituir sem eventos',
          code: `c = Conta.reconstituir([])
assert (c.id, c.saldo, c.versao) == (None, 0, 0), f"estado inesperado: {(c.id, c.saldo, c.versao)}"`,
        },
        {
          name: 'sacar gera, aplica e registra o evento',
          code: `c = Conta.reconstituir([ContaAberta("c1", "Ana"), Depositado("c1", 100)])
ev = c.sacar(40)
assert ev == Sacado("c1", 40), f"sacar deveria devolver Sacado('c1', 40), devolveu {ev}"
assert c.saldo == 60 and c.versao == 3, f"saldo/versao inesperados: {c.saldo}, {c.versao}"
assert c.novos_eventos == [Sacado("c1", 40)], f"novos_eventos: {c.novos_eventos}"`,
        },
        {
          name: 'saque maior que o saldo é recusado sem mudar nada',
          code: `c = Conta.reconstituir([ContaAberta("c1", "Ana"), Depositado("c1", 50)])
try:
    c.sacar(80)
    assert False, "sacar mais que o saldo deveria lançar ValueError"
except ValueError:
    pass
assert c.saldo == 50 and c.versao == 2 and c.novos_eventos == [], "um comando recusado não pode mudar o estado"`,
        },
        {
          name: 'aplicar não valida: eventos antigos são fatos',
          hidden: true,
          code: `# histórico de antes da regra de saldo existir: um saque a descoberto
eventos = [ContaAberta("c9", "Caio"), Depositado("c9", 10), Sacado("c9", 25), Depositado("c9", 20)]
c = Conta.reconstituir(eventos)
assert c.saldo == 5, "reconstituir não pode rejeitar eventos antigos — eles já aconteceram"`,
        },
        {
          name: 'valores inválidos e o limite exato do saldo',
          hidden: true,
          code: `c = Conta.reconstituir([ContaAberta("c1", "Ana"), Depositado("c1", 50)])
for v in (0, -10):
    try:
        c.sacar(v)
        assert False, f"sacar({v}) deveria lançar ValueError"
    except ValueError:
        pass
assert c.novos_eventos == [] and c.saldo == 50
c.sacar(50)
assert c.saldo == 0, "sacar exatamente o saldo é permitido"`,
        },
        {
          name: 'histórico + novos eventos reconstituem o mesmo estado',
          hidden: true,
          code: `historico = [ContaAberta("c1", "Ana"), Depositado("c1", 100)]
c = Conta.reconstituir(historico)
c.sacar(10)
c.sacar(20)
de_novo = Conta.reconstituir(historico + c.novos_eventos)
assert (de_novo.saldo, de_novo.versao) == (c.saldo, c.versao) == (70, 4), "o estado em memória divergiu do que os eventos produzem"`,
        },
      ],
      reviews: [
        {
          when: (m, code) => {
            const corpo = (code.split(/def\s+aplicar\b/)[1] || '').split(/\n {4}(?:def|@)/)[0];
            return /\braise\b/.test(corpo);
          },
          text: '`aplicar` lança exceção. Eventos são **fatos que já aconteceram**: se uma regra mudar, a reconstrução de históricos antigos quebra. Valide no **comando** (`sacar`), antes de gerar o evento.',
          concept: 'Decidir × evoluir',
        },
        {
          when: (m, code) => {
            const corpo = (code.split(/def\s+sacar\b/)[1] || '').split(/\n {4}(?:def|@)/)[0];
            return /self\.saldo\s*[-+*/]?=(?!=)/.test(corpo);
          },
          text: 'O comando `sacar` altera `self.saldo` diretamente. Em Event Sourcing, **toda** mudança de estado passa pelo `aplicar` — senão o estado em memória diverge do que a reconstrução a partir dos eventos produziria.',
          concept: 'Event Sourcing',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O estado do agregado deve viver na instância — cada `Conta` é reconstituída dos **seus** eventos.',
          concept: 'Event Sourcing',
        },
      ],
      hints: [
        'No `aplicar`, use `match evento:` com `case ContaAberta(conta_id=cid, titular=t):`, `case Depositado(valor=v):` e `case Sacado(valor=v):` (ou `isinstance`). Some 1 em `versao` **fora** do `match`.',
        '`reconstituir` é um *fold*: `conta = cls()`, depois `for evento in eventos: conta.aplicar(evento)` e `return conta`.',
        'Em `sacar`, valide **antes** de criar o evento; depois `self.aplicar(evento)`, `self.novos_eventos.append(evento)` e `return evento`. Nunca mexa em `self.saldo` direto no comando.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class ContaAberta:
    conta_id: str
    titular: str


@dataclass(frozen=True)
class Depositado:
    conta_id: str
    valor: int


@dataclass(frozen=True)
class Sacado:
    conta_id: str
    valor: int


class Conta:
    def __init__(self):
        self.id = None
        self.titular = None
        self.saldo = 0
        self.versao = 0
        self.novos_eventos = []

    def aplicar(self, evento):
        match evento:
            case ContaAberta(conta_id=conta_id, titular=titular):
                self.id = conta_id
                self.titular = titular
            case Depositado(valor=valor):
                self.saldo += valor
            case Sacado(valor=valor):
                self.saldo -= valor
        self.versao += 1

    @classmethod
    def reconstituir(cls, eventos):
        conta = cls()
        for evento in eventos:
            conta.aplicar(evento)
        return conta

    def sacar(self, valor):
        if valor <= 0 or valor > self.saldo:
            raise ValueError("saque inválido")
        evento = Sacado(self.id, valor)
        self.aplicar(evento)
        self.novos_eventos.append(evento)
        return evento
`,
      solutionExplanation: 'O agregado tem duas metades: `sacar` **decide** (valida contra o estado atual e gera o evento) e `aplicar` **evolui** (só muda o estado, sem questionar). Como o comando também passa pelo `aplicar`, o estado em memória é sempre igual ao que a reconstrução produziria — o teste "histórico + novos eventos" prova isso. E como `aplicar` não valida, um histórico antigo com saque a descoberto (de antes da regra existir) continua reconstituível: eventos são fatos. Por fim, `novos_eventos` é o que o repositório anexa ao event store com `versao_esperada = versao - len(novos_eventos)`.',
    },
    {
      type: 'code',
      id: 'arq-cqrs-q5',
      concept: 'Projeções',
      title: 'Projeção à prova de duplicatas',
      say: 'Agora o lado da leitura: uma projeção que aguenta reentregas sem contar dinheiro duas vezes.',
      prompt: `Implemente a projeção \`SaldosProjecao\`, que mantém um modelo de leitura a partir do fluxo **global** de eventos (os mesmos \`ContaAberta\`, \`Depositado\` e \`Sacado\`):

- \`processar(posicao, evento)\` — \`posicao\` é a posição global do evento no event store (1, 2, 3…).
  - A entrega é *at-least-once*: se \`posicao <= checkpoint\`, o evento **já foi processado** → ignore e devolva \`False\`.
  - Senão, atualize o modelo, avance o \`checkpoint\` para \`posicao\` e devolva \`True\` — **inclusive** para eventos que a projeção não usa.
- \`saldo(conta_id)\` — saldo atual da conta (\`0\` se ela não existir).
- \`ranking()\` — lista de tuplas \`(titular, saldo)\` de **todas as contas abertas**, do **maior** para o menor saldo; empate → ordem alfabética do titular.

\`checkpoint\` começa em \`0\`. Repare: \`Depositado\` e \`Sacado\` não trazem o titular — a projeção precisa **lembrar** dele desde o \`ContaAberta\`. E, como toda projeção, ela **não valida** nada: só reflete os fatos.`,
      starter: `from dataclasses import dataclass


@dataclass(frozen=True)
class ContaAberta:
    conta_id: str
    titular: str


@dataclass(frozen=True)
class Depositado:
    conta_id: str
    valor: int


@dataclass(frozen=True)
class Sacado:
    conta_id: str
    valor: int


class SaldosProjecao:
    def __init__(self):
        self.checkpoint = 0

    def processar(self, posicao, evento):
        # TODO: ignore duplicatas, atualize o modelo de leitura e o checkpoint
        return False

    def saldo(self, conta_id):
        return 0

    def ranking(self):
        return []
`,
      tests: [
        {
          name: 'projeta os saldos',
          code: `p = SaldosProjecao()
eventos = [ContaAberta("c1", "Ana"), Depositado("c1", 100), ContaAberta("c2", "Bia"), Sacado("c1", 30), Depositado("c2", 10)]
for pos, ev in enumerate(eventos, start=1):
    p.processar(pos, ev)
assert p.saldo("c1") == 70 and p.saldo("c2") == 10, f"saldos: c1={p.saldo('c1')}, c2={p.saldo('c2')}"
assert p.checkpoint == 5, f"checkpoint deveria ser 5, obtido {p.checkpoint}"`,
        },
        { name: 'conta inexistente tem saldo 0', expr: 'SaldosProjecao().saldo("nada")', expected: '0' },
        {
          name: 'duplicata é ignorada (at-least-once)',
          code: `p = SaldosProjecao()
assert p.processar(1, ContaAberta("c1", "Ana")) is True
assert p.processar(2, Depositado("c1", 100)) is True
assert p.processar(2, Depositado("c1", 100)) is False, "a posição 2 de novo é duplicata: devolva False"
assert p.saldo("c1") == 100, f"o depósito foi contado duas vezes: saldo {p.saldo('c1')}"`,
        },
        {
          name: 'ranking do maior para o menor (empate por nome)',
          code: `p = SaldosProjecao()
evs = [ContaAberta("c1", "Ana"), ContaAberta("c2", "Bia"), ContaAberta("c3", "Caio"),
       Depositado("c1", 50), Depositado("c2", 80), Depositado("c3", 50)]
for pos, ev in enumerate(evs, start=1):
    p.processar(pos, ev)
assert p.ranking() == [("Bia", 80), ("Ana", 50), ("Caio", 50)], f"ranking inesperado: {p.ranking()}"`,
        },
        {
          name: 'reentrega de um lote antigo não conta de novo',
          hidden: true,
          code: `p = SaldosProjecao()
evs = [ContaAberta("c1", "Ana"), Depositado("c1", 10), Depositado("c1", 20), Sacado("c1", 5)]
for pos, ev in enumerate(evs, start=1):
    p.processar(pos, ev)
for pos, ev in enumerate(evs[1:], start=2):
    assert p.processar(pos, ev) is False, f"posição {pos} já foi processada"
assert p.saldo("c1") == 25 and p.checkpoint == 4`,
        },
        {
          name: 'evento desconhecido também avança o checkpoint',
          hidden: true,
          code: `from dataclasses import dataclass

@dataclass(frozen=True)
class EmailAlterado:
    conta_id: str
    email: str

p = SaldosProjecao()
p.processar(1, ContaAberta("c1", "Ana"))
assert p.processar(2, EmailAlterado("c1", "ana@x.com")) is True, "eventos que a projeção não usa também são 'processados'"
assert p.checkpoint == 2 and p.saldo("c1") == 0
assert p.processar(2, EmailAlterado("c1", "ana@x.com")) is False`,
        },
        {
          name: 'conta sem movimento entra no ranking; projeção não valida',
          hidden: true,
          code: `p = SaldosProjecao()
p.processar(1, ContaAberta("c1", "Zé"))
p.processar(2, ContaAberta("c2", "Ana"))
p.processar(3, Sacado("c2", 5))
assert p.ranking() == [("Zé", 0), ("Ana", -5)], f"ranking inesperado: {p.ranking()}"`,
        },
        {
          name: 'cada projeção tem seu próprio estado',
          hidden: true,
          code: `a, b = SaldosProjecao(), SaldosProjecao()
a.processar(1, ContaAberta("c1", "Ana"))
a.processar(2, Depositado("c1", 10))
assert b.saldo("c1") == 0 and b.ranking() == [] and b.checkpoint == 0, "o estado vazou entre projeções"`,
        },
      ],
      reviews: [
        {
          when: (m, code) => {
            const corpo = (code.split(/def\s+saldo\b/)[1] || '').split(/\n {4}(?:def|@)/)[0];
            return /\bfor\b|\bsum\(/.test(corpo);
          },
          text: 'O `saldo` percorre dados a cada consulta. A graça de uma projeção é **pré-calcular**: atualize o modelo no `processar` e deixe a leitura em O(1).',
          concept: 'Projeções',
        },
        {
          when: (m, code) => /^ {4}[A-Za-z_]\w*\s*=\s*(\{\}|\[\]|dict\(\)|list\(\))/m.test(code),
          text: 'Há um dicionário/lista criado como **atributo de classe** — ele seria compartilhado por todas as projeções. Crie o estado no `__init__`.',
          concept: 'Estado por instância',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O modelo de leitura deve viver na instância — assim dá para descartar uma projeção e reconstruí-la do zero.',
          concept: 'Projeções',
        },
      ],
      hints: [
        'Guarde dois dicionários no `__init__`: `self._titulares = {}` e `self._saldos = {}` (ambos por `conta_id`).',
        'Comece `processar` com `if posicao <= self.checkpoint: return False`. No fim, `self.checkpoint = posicao` e `return True` — mesmo que o evento não mude nada.',
        'Para o ranking, monte `(titular, saldo)` a partir de `self._titulares` e ordene com `sorted(linhas, key=lambda l: (-l[1], l[0]))`.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True)
class ContaAberta:
    conta_id: str
    titular: str


@dataclass(frozen=True)
class Depositado:
    conta_id: str
    valor: int


@dataclass(frozen=True)
class Sacado:
    conta_id: str
    valor: int


class SaldosProjecao:
    def __init__(self):
        self.checkpoint = 0
        self._titulares = {}    # conta_id -> titular
        self._saldos = {}       # conta_id -> saldo

    def processar(self, posicao, evento):
        if posicao <= self.checkpoint:
            return False        # duplicata: já passou por aqui
        match evento:
            case ContaAberta(conta_id=conta_id, titular=titular):
                self._titulares[conta_id] = titular
                self._saldos.setdefault(conta_id, 0)
            case Depositado(conta_id=conta_id, valor=valor):
                self._saldos[conta_id] = self._saldos.get(conta_id, 0) + valor
            case Sacado(conta_id=conta_id, valor=valor):
                self._saldos[conta_id] = self._saldos.get(conta_id, 0) - valor
        self.checkpoint = posicao
        return True

    def saldo(self, conta_id):
        return self._saldos.get(conta_id, 0)

    def ranking(self):
        linhas = [(titular, self.saldo(cid)) for cid, titular in self._titulares.items()]
        return sorted(linhas, key=lambda linha: (-linha[1], linha[0]))
`,
      solutionExplanation: 'A projeção **pré-calcula** o que a tela precisa: consultar um saldo é O(1), sem *fold* na hora. O **checkpoint** resolve a entrega *at-least-once*: posições já vistas são ignoradas, então reentregas e replays parciais não contam dinheiro duas vezes. Eventos que não interessam também avançam o checkpoint — senão, após um reinício, a projeção reprocessaria tudo desde o último evento "útil". Por ser derivada, dá para apagá-la e reconstruir do zero, ou criar outra (um extrato mensal, por exemplo) sobre o mesmo histórico. Em produção, o checkpoint é gravado **na mesma transação** que o modelo de leitura.',
    },
    {
      type: 'open',
      id: 'arq-cqrs-q6',
      concept: 'Quando não usar Event Sourcing',
      say: 'Para fechar, uma revisão de design: seu colega está empolgado demais…',
      prompt: 'Um colega quer usar **CQRS + Event Sourcing** no novo cadastro de clientes (um CRUD com três telas). Que **custos** e **riscos** você apontaria — e em que tipo de sistema essa arquitetura compensa?',
      minWords: 25,
      rubric: [
        { label: 'Aponta a **complexidade** desnecessária para um CRUD simples', keywords: ['complex', 'crud', 'overengineering', 'over-engineering', 'exagero', 'cerimonia', 'curva de aprendizado', 'custo de desenvolvimento'], concept: 'Complexidade acidental', why: 'Event store, projeções e versionamento custam caro quando o domínio é só guardar e mostrar dados.' },
        { label: 'Cita a **consistência eventual** entre escrita e leitura', keywords: ['eventual', 'atraso', 'defasag', 'desatualiz', 'lag', 'nao aparece', 'demora para aparecer'], concept: 'Consistência eventual', why: 'O modelo de leitura fica atrás da escrita; as telas precisam lidar com isso.' },
        { label: 'Cita o **versionamento de eventos** (upcasting) ou o problema de dados imutáveis/LGPD', keywords: ['version', 'upcast', 'esquema', 'schema', 'imutav', 'lgpd', 'gdpr', 'apagar', 'esquecimento', 'shredding'], concept: 'Upcasting', why: 'Eventos ficam para sempre: mudar seu formato e apagar dados pessoais exigem técnicas próprias.' },
        { label: 'Diz **onde compensa**: quando o histórico/auditoria é o negócio', keywords: ['auditor', 'historico', 'ledger', 'financ', 'contab', 'banc', 'rastreab', 'viagem no tempo', 'regulat'], concept: 'Event Sourcing', why: 'O padrão brilha quando o histórico é parte do domínio.' },
      ],
      modelAnswer: `Para um CRUD de clientes com três telas, eu seria contra. O custo é alto: event store, projeções para manter e monitorar, *replays*, e uma **complexidade** que o time vai pagar em toda mudança — é *overengineering* para um domínio que só guarda e mostra dados.

Os riscos: a leitura passa a ter **consistência eventual** (o cliente salva e a lista ainda não mostra); os eventos ficam para sempre, então toda mudança de formato exige **versionamento** e *upcasting*; e dados pessoais num log **imutável** complicam a **LGPD** — apagar exige técnicas como *crypto-shredding*.

Eu usaria CQRS + Event Sourcing onde o **histórico é o negócio**: contas e **ledger** financeiro, estoque, sistemas com **auditoria** regulatória, ou quando as leituras são muito diferentes da escrita e precisamos criar visões novas sobre o passado. E, mesmo assim, só naquele bounded context — não no sistema inteiro.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Recapitulando: **CQRS** separa quem decide de quem responde; **Event Sourcing** guarda fatos e deriva o estado com um *fold*…',
        '…projeções com checkpoint aguentam duplicatas, snapshots aceleram, **upcasters** cuidam da evolução — e nada disso entra num CRUD simples. Próxima aula: **sagas**!',
      ],
      board: null,
    },
  ],
});
