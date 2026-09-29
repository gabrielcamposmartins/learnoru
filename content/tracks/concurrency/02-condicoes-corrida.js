(function () {
  // Passos reutilizados pelos testes da simulação de intercalações.
  const PASSOS = `INC = [("ler",), ("somar", 1), ("escrever",)]

def com_lock(passos):
    return [("travar",)] + passos + [("destravar",)]
`;

  Game.registerModule('concurrency', {
    id: 'condicoes-corrida',
    title: 'Condições de corrida e deadlocks',
    kind: 'lesson',
    level: 3,
    order: 2,
    unit: 'fundamentos',
    summary: 'Por que `x += 1` perde atualizações, como locks criam seções críticas e como quatro condições (Coffman) explicam — e evitam — todo deadlock. Com simulações que você mesmo escreve.',
    concepts: ['Condição de corrida', 'Atomicidade e bytecode', 'Locks e seção crítica', 'Deadlock e condições de Coffman', 'Livelock e starvation'],
    takeaways: [
      'Condição de corrida: o resultado depende da **intercalação**. `x += 1` é ler → somar → escrever (veja com `dis`): de 20 intercalações de dois incrementos, só 2 dão o resultado certo.',
      '*Check-then-act* (`if saldo >= valor: saldo -= valor`) é corrida mesmo com operações atômicas: o teste e a ação precisam estar na **mesma** seção crítica.',
      'Use `with lock:` (libera até com exceção), proteja **todo** acesso ao dado com o mesmo lock e mantenha a seção crítica curta.',
      'Deadlock exige as quatro **condições de Coffman**; a mais barata de quebrar é a espera circular, com **ordem global** de aquisição. Para detectar, procure um **ciclo** no grafo de espera.',
      '**Livelock**: todos ocupados e ninguém progride (remédio: backoff aleatório). **Starvation**: alguém nunca é atendido (remédio: filas justas e *aging*).',
    ],
    glossary: [
      { term: 'Condição de corrida', aliases: ['condições de corrida', 'condicao de corrida', 'condicoes de corrida', 'race condition', 'race conditions'], definition: 'Bug em que o resultado depende da **ordem** (intercalação) em que threads ou tarefas executam, e alguma ordem produz um resultado errado. Ex.: dois `x += 1` simultâneos que perdem um incremento.' },
      { term: 'Seção crítica', aliases: ['seções críticas', 'secao critica', 'secoes criticas', 'critical section'], definition: 'Trecho de código que acessa dados compartilhados e não pode ser intercalado com outro que mexe nos mesmos dados. É protegido por um lock: uma thread por vez.' },
      { term: 'Deadlock', aliases: ['deadlocks'], definition: 'Threads bloqueadas **para sempre**, cada uma esperando um recurso que outra segura. Só acontece se as quatro condições de Coffman valerem ao mesmo tempo.' },
      { term: 'Condições de Coffman', aliases: ['condição de Coffman', 'condicoes de Coffman', 'Coffman conditions'], definition: 'As quatro condições **necessárias** para um deadlock (Coffman et al., 1971): exclusão mútua, posse e espera, sem preempção e espera circular. Quebrar qualquer uma torna o deadlock impossível.' },
      { term: 'Livelock', aliases: ['livelocks'], definition: 'Threads que não estão bloqueadas — estão ocupadas reagindo umas às outras (recuando e tentando de novo no mesmo ritmo) —, mas nenhuma progride. Remédio típico: backoff **aleatório**.' },
      { term: 'Starvation', aliases: ['inanição', 'inanicao', 'thread starvation'], definition: 'Uma thread ou tarefa **nunca** consegue o recurso de que precisa, embora o sistema como um todo progrida. Causas: locks sem justiça, prioridades fixas, leitores que nunca deixam o escritor entrar.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Hoje vamos caçar o bug mais famoso da concorrência: a **condição de corrida**.',
          'É aquele que some quando você coloca um `print` para investigar — e volta às 3 da manhã, em produção.',
        ],
        board: {
          title: '🏁 Condição de corrida (race condition)',
          md: `Uma **condição de corrida** acontece quando o resultado depende da **ordem** (intercalação) em que as threads executam — e alguma ordem produz um resultado errado.

\`\`\`python
contador = 0

def trabalhar():               # duas threads rodam isto, 100 mil vezes cada
    global contador
    for _ in range(100_000):
        contador += 1

# esperado: 200_000 — obtido: às vezes menos (depende da versão e da sorte)
\`\`\`

A linha do tempo de um incremento perdido (*lost update*):

\`\`\`text
                    contador = 5
Thread A: LÊ 5
Thread B:                LÊ 5
Thread A: SOMA → 6
Thread B:                SOMA → 6
Thread A: ESCREVE 6
Thread B:                ESCREVE 6      ← dois incrementos, contador = 6
\`\`\`

O trecho que mexe no dado compartilhado e **não pode** ser intercalado é a **seção crítica**.

> [!sabia] Bugs de concorrência são o exemplo clássico de **Heisenbug** — trocadilho com o princípio da incerteza de Heisenberg: observar muda o comportamento. Um \`print\` ou um breakpoint alteram o *timing*, e a corrida "desaparece".`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Por que `x += 1` não é atômico? Vamos abrir a caixa com o módulo `dis`, que mostra o bytecode.',
          'Uma linha de Python vira várias instruções — e a troca de thread pode cair entre quaisquer duas delas.',
        ],
        board: {
          title: '🔬 Abrindo o x += 1 com dis',
          md: `\`\`\`python
import dis

contador = 0

def incrementar():
    global contador
    contador += 1

dis.dis(incrementar)
\`\`\`

\`\`\`text
(Python 3.12, simplificado)
LOAD_GLOBAL    contador    ← 1. LÊ o valor atual
LOAD_CONST     1
BINARY_OP      +=          ← 2. SOMA (cria um novo int)
STORE_GLOBAL   contador    ← 3. ESCREVE de volta
\`\`\`

O GIL garante que **cada instrução** roda inteira, mas a thread pode perder a vez **entre** o \`LOAD_GLOBAL\` e o \`STORE_GLOBAL\`. O mesmo vale para \`self.total += x\`, \`d[k] += 1\` e \`lista[i] = lista[i] * 2\`.

| Na prática atômico no CPython | Não atômico (ler → modificar → escrever) |
|---|---|
| \`L.append(x)\`, \`x = L.pop()\`, \`x = L[i]\` | \`i = i + 1\`, \`i += 1\` |
| \`D[x] = y\`, \`D1.update(D2)\` | \`D[x] = D[x] + 1\` |
| \`x = y\`, \`x.campo = y\` | \`L.append(L[-1])\`, \`L[i] = L[j]\` |

(Tabela baseada na FAQ oficial do Python — que avisa: na dúvida, **use um lock**.)

> [!atencao] "Rodei 10 vezes e deu 200 000!" Desde o 3.10, o CPython só atende pedidos de troca de thread em alguns pontos (como o salto de volta de um laço ou a entrada de uma função), então o contador clássico às vezes "passa" no seu notebook. Isso é **sorte de implementação**: um \`__iadd__\` escrito em Python, outra versão ou o build *free-threaded* trazem a corrida de volta.`,
        },
      },
      {
        type: 'say',
        text: [
          'Corrida não é só `+=`. O padrão mais traiçoeiro é o **check-then-act**: verificar uma condição e agir com base nela.',
          'Entre o "check" e o "act", o mundo pode mudar.',
        ],
        board: {
          title: 'Check-then-act: verificar e depois agir',
          md: `\`\`\`python
# 1. cache: duas threads calculam (e gravam) a mesma coisa
if chave not in cache:
    cache[chave] = calcular(chave)        # caro? com efeito colateral?

# 2. saldo: as duas veem saldo suficiente e as duas sacam
if conta.saldo >= valor:
    conta.saldo -= valor

# 3. inicialização preguiçosa: dois "singletons"
if Config._instancia is None:
    Config._instancia = Config()
\`\`\`

Cada operação isolada pode até ser atômica — a **sequência** não é. A correção: o teste e a ação na **mesma** seção crítica.

\`\`\`python
with lock:
    if conta.saldo >= valor:
        conta.saldo -= valor
\`\`\`

> [!sabia] **Data race ≠ race condition.** *Data race* é o acesso simultâneo à mesma memória, sem sincronização, com pelo menos uma escrita — em C e C++ é comportamento indefinido, e o Rust seguro nem compila. *Race condition* é o resultado depender do *timing*. Uma existe sem a outra: os exemplos acima não têm data race no CPython (cada operação é protegida pelo GIL), mas têm race condition. "Sem data race" nunca foi sinônimo de "correto".`,
        },
      },
      {
        type: 'say',
        text: [
          'A ferramenta básica é o **lock** (mutex): só uma thread por vez dentro da seção crítica.',
          'Regra de ouro: `with lock:` sempre — ele solta o lock até quando dá exceção.',
        ],
        board: {
          title: '🔐 Locks: seção crítica de verdade',
          md: `\`\`\`python
import threading

class Conta:
    def __init__(self, saldo):
        self.saldo = saldo
        self._lock = threading.Lock()

    def sacar(self, valor):
        with self._lock:                # adquire (ou espera); solta ao sair — até com exceção
            if self.saldo < valor:
                raise ValueError("saldo insuficiente")
            self.saldo -= valor         # check + act na MESMA seção crítica
\`\`\`

| Primitiva (\`threading\`) | Para quê |
|---|---|
| \`Lock\` | exclusão mútua simples; **não** reentrante: a mesma thread travando duas vezes fica presa para sempre |
| \`RLock\` | reentrante: a mesma thread pode adquirir de novo (um método com lock chamando outro) |
| \`Semaphore(n)\` | até *n* threads ao mesmo tempo (ex.: pool de conexões) |
| \`Condition\` / \`Event\` | esperar até algo acontecer ("a fila tem itens", "está pronto") |
| \`queue.Queue\` | passar dados entre threads — já vem com os locks certos |

> [!dica] Um lock protege **dados**, não código: **todo** acesso ao dado precisa passar pelo mesmo lock — inclusive as leituras. E mantenha a seção crítica curta: nada de I/O ou chamadas lentas lá dentro.`,
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Locks resolvem corridas… e criam um problema novo: o **deadlock**. Cada thread segura o que a outra quer, e as duas esperam para sempre.',
          'A boa notícia: todo deadlock precisa de **quatro** condições ao mesmo tempo. Quebre uma e ele fica impossível.',
        ],
        board: {
          title: '💀 Deadlock e as condições de Coffman',
          md: `\`\`\`python
def transferir(origem, destino, valor):
    with origem.lock:
        with destino.lock:          # T1: A → B  segura A, espera B
            origem.saldo -= valor   # T2: B → A  segura B, espera A  → 💀
            destino.saldo += valor
\`\`\`

\`\`\`text
T1 ── segura ──▶ lock A        T1 ── espera ──▶ lock B
T2 ── segura ──▶ lock B        T2 ── espera ──▶ lock A
        ciclo: T1 espera T2, que espera T1
\`\`\`

**Condições de Coffman** — as quatro são necessárias:

| Condição | Significa | Como quebrar |
|---|---|---|
| **Exclusão mútua** | o recurso só tem um dono por vez | dados imutáveis, cópias, estruturas sem lock |
| **Posse e espera** | segura um recurso enquanto espera outro | pegar **tudo de uma vez** (ou nada) |
| **Sem preempção** | ninguém tira o lock de quem o segura | \`acquire(timeout=...)\`: desistir e soltar o que tem |
| **Espera circular** | T1 espera T2, que espera… T1 | **ordem global** de aquisição |

> [!sabia] As quatro condições foram publicadas por **Edward G. Coffman Jr.** e colegas no artigo *System Deadlocks* (1971). Quase ninguém lembra o nome, mas toda técnica contra deadlock ataca uma delas — e a mais barata de quebrar costuma ser a **espera circular**.`,
        },
      },
      {
        type: 'say',
        text: [
          'Na prática, a arma principal é a **ordem global**: todas as threads adquirem os locks na mesma ordem. Sem ordem invertida, não há ciclo.',
          'E para **detectar**, bancos de dados montam um **grafo de espera** e procuram ciclos nele.',
        ],
        board: {
          title: 'Ordem global de locks e grafo de espera',
          md: `\`\`\`python
def transferir(origem, destino, valor):
    if origem is destino:
        return                              # Lock não é reentrante: travaria sozinha
    primeiro, segundo = sorted((origem, destino), key=lambda c: c.id)
    with primeiro.lock, segundo.lock:       # sempre o menor id antes, em TODAS as threads
        origem.saldo -= valor
        destino.saldo += valor
\`\`\`

**Grafo de espera** (*wait-for graph*): um nó por thread e uma seta **T1 → T2** quando T1 espera um lock que T2 segura. **Deadlock ⇔ ciclo.**

\`\`\`text
posse:  A → T1   B → T2   C → T3
espera: T1 → B   T2 → C   T3 → A   T4 → A

T4 ──▶ T1 ──▶ T2
        ▲      │
        └─ T3 ◀┘

ciclo T1 → T2 → T3 → T1 = DEADLOCK
T4 também está presa (espera T1), mas não faz parte do ciclo
\`\`\`

O PostgreSQL faz exatamente isso: se uma transação espera um lock por mais de \`deadlock_timeout\` (1 s por padrão), ele procura um ciclo no grafo e aborta uma **vítima** com \`ERROR: deadlock detected\` — o que libera todas as outras.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Existem mais dois jeitos de não sair do lugar. No **livelock**, todo mundo está ocupado… cedendo a vez, educadamente, para sempre.',
          'Na **starvation** (inanição), o sistema anda, mas alguém específico nunca é atendido.',
        ],
        board: {
          title: 'Livelock e starvation',
          md: `**Livelock** — duas pessoas no corredor desviando para o mesmo lado, de novo e de novo:

\`\`\`python
def pegar_os_dois(a, b):                   # T1 chama (x, y); T2 chama (y, x)
    while True:
        with a:
            if b.acquire(timeout=0.01):    # quebra "sem preempção"...
                try:
                    return trabalhar()
                finally:
                    b.release()
        time.sleep(0.01)                   # ...mas as duas recuam e voltam no MESMO ritmo
\`\`\`

A correção é **backoff aleatório** — \`time.sleep(random.uniform(0, 0.02))\` desencontra as tentativas. É o mesmo *jitter* dos retries em rede (a Ethernet faz isso desde os anos 70).

**Starvation** — uma thread nunca consegue o recurso:
- \`threading.Lock\` **não promete ordem**: quando o lock é solto, não está definido quem acorda — uma thread pode perder a disputa várias vezes seguidas;
- um *readers-writer lock* que sempre prioriza leitores pode deixar o escritor esperando para sempre;
- prioridades fixas: tarefas de baixa prioridade nunca rodam. Remédio: filas FIFO e **aging** (a prioridade sobe com o tempo de espera).

| Problema | Threads bloqueadas? | O sistema progride? |
|---|---|---|
| Deadlock | sim, para sempre | não |
| Livelock | não: ocupadas tentando | não |
| Starvation | uma (ou algumas) | sim, menos para a vítima |

> [!sabia] Em 1997 a sonda **Mars Pathfinder** reiniciava sozinha em Marte por causa de uma **inversão de prioridade**: uma tarefa de baixa prioridade segurava um mutex que a de alta prioridade queria, e tarefas de prioridade média não a deixavam terminar. A correção — ligar a **herança de prioridade** no mutex — foi enviada por rádio para a sonda.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Intercalações, locks e deadlocks — simulados de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'conc-race-q1',
        concept: 'Atomicidade',
        say: 'Aquecimento: onde está a corrida?',
        prompt: 'Qual destes trechos, executado por **várias threads ao mesmo tempo** (CPython com GIL, dados compartilhados), **não** tem condição de corrida?',
        options: [
          { text: '`contador += 1`, com `contador` global', why: 'É ler → somar → escrever: a troca de thread entre a leitura e a escrita perde incrementos.' },
          { text: '`if chave not in cache: cache[chave] = carregar(chave)`', why: '*Check-then-act*: duas threads podem ver a chave ausente e carregar (e gravar) duas vezes.' },
          { text: '`fila.put(item)`, com uma `queue.Queue` compartilhada', correct: true, why: '`queue.Queue` foi feita para isso: `put` e `get` usam locks e condições internas. É o jeito recomendado de passar dados entre threads.' },
          { text: '`saldos[conta] = saldos[conta] - valor`', why: 'Ler o item, subtrair e gravar são passos separados — a FAQ do Python cita `D[x] = D[x] + 1` como **não** atômico.' },
        ],
        explanation: 'Operações **únicas** sobre estruturas embutidas (`append`, `d[k] = v`) são indivisíveis na prática, mas qualquer **sequência** — ler e depois escrever, verificar e depois agir — pode ser intercalada. `queue.Queue` encapsula a sincronização: em vez de compartilhar memória e travar, as threads **trocam mensagens** ("não se comunique compartilhando memória; compartilhe memória se comunicando", diz o provérbio do Go).',
      },
      {
        type: 'code',
        id: 'conc-race-q2',
        concept: 'Intercalações e condição de corrida',
        title: 'Todas as intercalações possíveis',
        say: 'No navegador não há threads — então vamos fazer melhor: **simular todas** as ordens possíveis e ver quais dão errado.',
        prompt: `Vamos **simular** duas threads. Cada thread é uma lista de passos; existe uma variável compartilhada \`x\`, e cada thread tem um **registrador** local \`r\` (começa em 0):

| Passo | Efeito |
|---|---|
| \`("ler",)\` | \`r = x\` |
| \`("somar", k)\` | \`r = r + k\` |
| \`("escrever",)\` | \`x = r\` |
| \`("travar",)\` | pega o lock; se ele já estiver com alguém, **essa intercalação é impossível** (descarte-a) |
| \`("destravar",)\` | solta o lock |

Implemente:

1. \`intercalacoes(a, b)\` → lista com **todas** as intercalações de \`a\` e \`b\`: sequências com todos os elementos das duas listas, **preservando a ordem interna** de cada uma. São C(m+n, m) intercalações — inclusive quando há elementos iguais.
2. \`valores_finais(a, b, inicial=0)\` → lista **ordenada e sem repetição** dos valores finais possíveis de \`x\` quando a thread A executa \`a\` e a thread B executa \`b\`, considerando todas as intercalações possíveis.

Exemplo: \`intercalacoes(["a1", "a2"], ["b1"])\` → \`[["a1", "a2", "b1"], ["a1", "b1", "a2"], ["b1", "a1", "a2"]]\` (em qualquer ordem).`,
        starter: `def intercalacoes(a, b):
    # TODO: todas as intercalações, preservando a ordem de a e a de b
    return [list(a) + list(b)]


def valores_finais(a, b, inicial=0):
    # TODO: execute cada intercalação e colete os valores finais de x
    return []
`,
        tests: [
          { name: 'exemplo do enunciado', expr: 'intercalacoes(["a1", "a2"], ["b1"])', expected: '[["a1", "a2", "b1"], ["a1", "b1", "a2"], ["b1", "a1", "a2"]]', compare: 'sorted' },
          { name: '3 + 3 passos: 20 intercalações válidas e distintas', code: `r = intercalacoes(["a1", "a2", "a3"], ["b1", "b2", "b3"])
assert len(r) == 20, f"esperado C(6, 3) = 20 intercalações, obtido {len(r)}"
assert len({tuple(s) for s in r}) == 20, "há intercalações repetidas"
for s in r:
    assert [p for p in s if p[0] == "a"] == ["a1", "a2", "a3"], f"a ordem interna de A foi quebrada em {s}"
    assert [p for p in s if p[0] == "b"] == ["b1", "b2", "b3"], f"a ordem interna de B foi quebrada em {s}"
` },
          { name: 'uma lista vazia: uma intercalação só', expr: 'intercalacoes([], ["b1", "b2"])', expected: '[["b1", "b2"]]' },
          { name: 'dois x += 1 sem lock: 1 ou 2', code: PASSOS + `r = valores_finais(INC, INC)
assert r == [1, 2], f"esperado [1, 2] (2 = execução serial; 1 = atualização perdida), obtido {r!r}"
` },
          { name: 'incrementos diferentes: +1 e +10', code: PASSOS + `r = valores_finais(INC, [("ler",), ("somar", 10), ("escrever",)])
assert r == [1, 10, 11], f"esperado [1, 10, 11], obtido {r!r}"
` },
          { name: 'valor inicial de x', code: PASSOS + `r = valores_finais(INC, INC, inicial=5)
assert r == [6, 7], f"esperado [6, 7], obtido {r!r}"
` },
          { name: 'lock nas duas threads: só o resultado serial', code: PASSOS + `r = valores_finais(com_lock(INC), com_lock(INC))
assert r == [2], f"com a seção crítica protegida só deveria sobrar [2], obtido {r!r}"
` },
          { name: 'lock em uma thread só não protege nada', code: PASSOS + `r = valores_finais(com_lock(INC), INC)
assert r == [1, 2], f"a thread B ignora o lock, então a corrida continua: esperado [1, 2], obtido {r!r}"
` },
          { name: 'passos iguais nas duas listas contam como intercalações diferentes', hidden: true, code: `r = intercalacoes(["x", "y"], ["x", "y"])
assert len(r) == 6, f"esperado C(4, 2) = 6 intercalações (mesmo com elementos iguais), obtido {len(r)}"
` },
          { name: 'as duas travam e ninguém destrava: nenhuma execução termina', hidden: true, expr: 'valores_finais([("travar",)], [("travar",)])', expected: '[]' },
          { name: 'dois incrementos contra um', hidden: true, code: PASSOS + `r = valores_finais(INC + INC, INC)
assert r == [1, 2, 3], f"esperado [1, 2, 3], obtido {r!r}"
` },
          { name: 'lock com somas diferentes e x inicial', hidden: true, code: `a = [("travar",), ("ler",), ("somar", 5), ("escrever",), ("destravar",)]
b = [("travar",), ("ler",), ("somar", 7), ("escrever",), ("destravar",)]
r = valores_finais(a, b, inicial=10)
assert r == [22], f"esperado [22], obtido {r!r}"
` },
        ],
        reviews: [
          {
            when: m => m.calls.includes('permutations'),
            text: '`itertools.permutations` gera **todas** as n! ordens e depois filtra: com 6 + 6 passos são 479 milhões de permutações para achar 924 intercalações — e passos iguais geram duplicatas. Construa só as válidas: "o próximo passo é de A **ou** de B".',
            concept: 'Intercalações × permutações',
          },
          {
            when: m => m.usesGlobal,
            text: 'Você usou `global`/`nonlocal` para guardar o estado da simulação. Cada intercalação precisa começar do zero (x, registradores e lock): estado local em cada execução evita que uma intercalação "vaze" para a próxima.',
            concept: 'Estado isolado por execução',
          },
        ],
        hints: [
          'Recursão: uma intercalação de `a` e `b` começa com `a[0]` (seguida de uma intercalação de `a[1:]` com `b`) **ou** com `b[0]` (seguida de uma intercalação de `a` com `b[1:]`). Caso base: se uma das listas está vazia, só existe uma intercalação.',
          'Em `valores_finais`, os passos das duas threads podem ser **iguais** (`("ler",)`)! Marque cada passo com o dono antes de intercalar: `[("A", p) for p in a]` e `[("B", p) for p in b]`.',
          'Para cada intercalação, simule do zero: `x = inicial`, registradores `{"A": 0, "B": 0}` e `dono_do_lock = None`. Em `("travar",)` com o lock ocupado, descarte a intercalação. Junte os resultados num `set` e devolva `sorted(...)`.',
        ],
        solution: `def intercalacoes(a, b):
    if not a or not b:
        return [list(a) + list(b)]
    comeca_com_a = [[a[0]] + resto for resto in intercalacoes(a[1:], b)]
    comeca_com_b = [[b[0]] + resto for resto in intercalacoes(a, b[1:])]
    return comeca_com_a + comeca_com_b


def _executar(ordem, inicial):
    """Roda uma intercalação; devolve x no fim, ou None se ela for impossível."""
    x = inicial
    registrador = {"A": 0, "B": 0}
    dono_do_lock = None
    for quem, passo in ordem:
        op = passo[0]
        if op == "ler":
            registrador[quem] = x
        elif op == "somar":
            registrador[quem] += passo[1]
        elif op == "escrever":
            x = registrador[quem]
        elif op == "travar":
            if dono_do_lock is not None:
                return None              # lock ocupado: esta ordem não pode acontecer
            dono_do_lock = quem
        elif op == "destravar":
            dono_do_lock = None
    return x


def valores_finais(a, b, inicial=0):
    passos_a = [("A", p) for p in a]     # marca o dono: os passos podem ser iguais
    passos_b = [("B", p) for p in b]
    finais = set()
    for ordem in intercalacoes(passos_a, passos_b):
        x = _executar(ordem, inicial)
        if x is not None:
            finais.add(x)
    return sorted(finais)
`,
        solutionExplanation: 'A recursão "o próximo passo é de A **ou** de B" gera exatamente as C(m+n, m) intercalações, sem filtrar nada. Marcar cada passo com o dono resolve a ambiguidade dos passos iguais. A simulação mostra o que o `dis` sugeria: de 20 intercalações de dois `x += 1`, **18 perdem uma atualização** — e basta a thread perder a vez entre ler e escrever. Com o lock nas duas, as intercalações que entrariam na seção crítica ocupada são impossíveis e só sobram as duas ordens seriais. E com o lock em uma thread só, nada muda: um lock só protege quem o respeita. Isso é **model checking** em miniatura — ferramentas como TLA+ e o *loom* (Rust) exploram intercalações exatamente assim.',
      },
      {
        type: 'match',
        id: 'conc-race-q3',
        concept: 'Condições de Coffman',
        say: 'Para cada condição de Coffman, uma forma de quebrá-la. E dois bônus: livelock e starvation.',
        prompt: 'Associe cada **condição de Coffman** (ou problema de progresso) à estratégia que a quebra ou evita.',
        pairs: [
          { left: 'Exclusão mútua', right: 'Dados imutáveis ou estruturas sem lock' },
          { left: 'Posse e espera', right: 'Adquirir todos os locks de uma vez (tudo ou nada)' },
          { left: 'Sem preempção', right: '`acquire(timeout=...)`: desistir e soltar o que já tem' },
          { left: 'Espera circular', right: 'Ordem global de aquisição dos locks' },
          { left: 'Livelock', right: 'Backoff aleatório (jitter) antes de tentar de novo' },
          { left: 'Starvation', right: 'Fila justa (FIFO) ou *aging* de prioridade' },
        ],
        explanation: 'Deadlock só acontece com as **quatro** condições de Coffman juntas, então quebrar qualquer uma basta. Na prática: **ordem global** (espera circular) é a mais barata; timeout no `acquire` (sem preempção) transforma travamento eterno em erro tratável — mas, se todos recuarem no mesmo ritmo, vira **livelock**, curado com backoff aleatório. **Starvation** é um problema de justiça: filas FIFO e *aging* garantem que todos sejam atendidos um dia.',
      },
      {
        type: 'mcq',
        id: 'conc-race-q4',
        concept: 'Ordem global de locks',
        say: 'Um incidente real, em versão resumida.',
        prompt: `Este código às vezes **trava para sempre** em produção: uma thread transfere de A para B enquanto outra transfere de B para A.

\`\`\`python
def transferir(origem, destino, valor):
    with origem.lock:
        with destino.lock:
            origem.saldo -= valor
            destino.saldo += valor
\`\`\`

Qual é a melhor correção, mantendo transferências entre contas **diferentes** em paralelo?`,
        options: [
          { text: 'Adquirir os locks sempre na mesma ordem global — por exemplo, pelo id: `primeiro, segundo = sorted((origem, destino), key=lambda c: c.id)`.', correct: true, why: 'Com todas as threads travando o menor id primeiro, não existe ordem invertida — a **espera circular** fica impossível.' },
          { text: 'Trocar `threading.Lock` por `threading.RLock`.', why: '`RLock` só permite que a **mesma** thread adquira de novo. Aqui são duas threads diferentes, cada uma esperando a outra: o deadlock continua.' },
          { text: 'Colocar um `time.sleep(0.01)` entre os dois `with`.', why: 'Mudar o *timing* não remove o ciclo — só muda a frequência do problema (e aqui até aumenta a janela de risco).' },
          { text: 'Usar um único lock global para todas as contas.', why: 'Elimina o deadlock, mas **serializa** todas as transferências do sistema — viola o requisito de paralelismo entre contas diferentes.' },
        ],
        explanation: 'Deadlock exige **espera circular**; uma ordem global de aquisição a torna impossível: se todo mundo pega o lock de menor id primeiro, ninguém pode segurar o "maior" esperando o "menor". Cuidado com o caso de borda: transferir de uma conta para **ela mesma** faria a thread adquirir o mesmo `Lock` duas vezes e travar sozinha — trate `origem is destino` antes.',
      },
      {
        type: 'code',
        id: 'conc-race-q5',
        concept: 'Grafo de espera',
        title: 'Detector de deadlock',
        say: 'Agora você vai construir o detector de deadlock que os bancos de dados usam.',
        prompt: `Implemente \`detectar_deadlock(posse, espera)\` usando um **grafo de espera**:

- \`posse\`: dict **lock → thread** que o segura agora. Ex.: \`{"A": "T1", "B": "T2"}\`.
- \`espera\`: dict **thread → lock** que ela está tentando adquirir (cada thread espera no máximo um lock). Ex.: \`{"T1": "B", "T2": "A"}\`.
- Existe uma aresta **T → U** quando T espera um lock que U segura. Um lock livre (fora de \`posse\`) não gera aresta: quem o espera vai conseguir.
- Devolva a lista **ordenada** das threads que estão **em algum ciclo** (em deadlock), ou \`[]\` se não houver ciclo.

Atenção: uma thread que espera alguém do ciclo também fica presa, mas **não** faz parte dele — não a inclua. E o sistema pode ter **milhares** de threads (cadeias longas de espera).`,
        starter: `def detectar_deadlock(posse, espera):
    # TODO: monte o grafo de espera (thread -> thread) e encontre os ciclos
    return []
`,
        tests: [
          { name: 'clássico: T1 e T2 esperando uma pela outra', expr: 'detectar_deadlock({"A": "T1", "B": "T2"}, {"T1": "B", "T2": "A"})', expected: '["T1", "T2"]' },
          { name: 'fila de espera sem ciclo não é deadlock', expr: 'detectar_deadlock({"A": "T1", "B": "T2"}, {"T2": "A", "T3": "B"})', expected: '[]' },
          { name: 'ciclo de 3 e uma thread presa fora dele', expr: 'detectar_deadlock({"A": "T1", "B": "T2", "C": "T3"}, {"T1": "B", "T2": "C", "T3": "A", "T4": "A"})', expected: '["T1", "T2", "T3"]' },
          { name: 'lock livre: quem espera vai conseguir', expr: 'detectar_deadlock({"A": "T1"}, {"T1": "B", "T2": "B"})', expected: '[]' },
          { name: 'Lock não reentrante: a thread espera a si mesma', expr: 'detectar_deadlock({"A": "T1"}, {"T1": "A"})', expected: '["T1"]' },
          { name: 'nada acontecendo', expr: 'detectar_deadlock({}, {})', expected: '[]' },
          { name: 'dois ciclos independentes', hidden: true, expr: 'detectar_deadlock({"A": "T1", "B": "T2", "C": "T3", "D": "T4"}, {"T1": "B", "T2": "A", "T3": "D", "T4": "C"})', expected: '["T1", "T2", "T3", "T4"]' },
          { name: 'cadeia de 1.200 threads desembocando num ciclo de 2', hidden: true, code: `n = 1200
posse = {f"L{i}": f"T{i}" for i in range(n)}
espera = {f"T{i}": f"L{i + 1}" for i in range(n - 1)}
espera[f"T{n - 1}"] = f"L{n - 2}"          # as duas últimas esperam uma pela outra
r = detectar_deadlock(posse, espera)
assert r == [f"T{n - 2}", f"T{n - 1}"], f"esperado só as duas threads do ciclo, obtido {len(r)} thread(s): {r[:4]}"
` },
        ],
        perfTests: [
          { name: '1.500 threads num único ciclo', setup: `n = 1500
posse = {f"L{i}": f"T{i:04d}" for i in range(n)}
espera = {f"T{i:04d}": f"L{(i + 1) % n}" for i in range(n)}`, expr: 'len(detectar_deadlock(posse, espera))', expected: '1500', maxMs: 150 },
        ],
        slowConcept: 'Grafo de espera — visitar cada thread uma vez',
        reviews: [
          {
            when: m => m.recursion,
            text: 'Recursão para seguir o grafo estoura a pilha em cadeias longas (o limite padrão é ~1000 chamadas) — e grafos de espera reais podem ter milhares de threads. Siga as arestas com um laço: como cada thread espera no máximo um lock, basta "andar" de thread em thread.',
            concept: 'Percurso iterativo',
          },
        ],
        hints: [
          'Monte o grafo primeiro: para cada `thread, lock` em `espera`, se `lock` estiver em `posse`, a aresta é `thread → posse[lock]`.',
          'Cada thread tem **no máximo uma** aresta de saída: para achar ciclos, basta andar com `atual = aponta.get(atual)` até parar (sem aresta) ou repetir uma thread.',
          'Para ficar O(n), marque as threads visitadas **e em qual passeio** foram vistas. Se o passeio atual reencontrar uma thread **dele mesmo**, o trecho do caminho a partir dela é um ciclo; se esbarrar numa de um passeio anterior, não há ciclo novo ali.',
        ],
        solution: `def detectar_deadlock(posse, espera):
    # grafo de espera: cada thread bloqueada aponta para a dona do lock que ela quer
    aponta = {}
    for thread, lock in espera.items():
        dona = posse.get(lock)
        if dona is not None:
            aponta[thread] = dona

    passeio_de = {}                        # thread -> passeio em que foi visitada
    em_ciclo = set()
    for inicio in aponta:
        if inicio in passeio_de:
            continue
        caminho = []
        atual = inicio
        while atual is not None and atual not in passeio_de:
            passeio_de[atual] = inicio
            caminho.append(atual)
            atual = aponta.get(atual)
        if atual is not None and passeio_de[atual] == inicio:
            em_ciclo.update(caminho[caminho.index(atual):])   # voltou ao próprio caminho
    return sorted(em_ciclo)
`,
        solutionExplanation: 'O grafo de espera tem uma aresta por thread bloqueada: quem espera → quem segura o lock. Como cada thread espera no máximo um lock, cada nó tem no máximo **uma** saída — basta "andar" pelas arestas. Cada passeio marca as threads com o seu identificador: se voltar a uma thread **do próprio** passeio, o trecho do caminho a partir dela é um ciclo; se esbarrar numa thread de um passeio anterior, o que havia para descobrir ali já foi descoberto. Cada thread é visitada uma vez: **O(n)** e sem recursão. Threads que só esperam alguém do ciclo (como a T4) ficam presas, mas não entram na lista: abortar uma **vítima** do ciclo — o que PostgreSQL e MySQL fazem — libera todas.',
      },
      {
        type: 'open',
        id: 'conc-race-q6',
        concept: 'Diagnóstico de deadlock',
        say: 'Para fechar, um cenário de plantão. Me conta como você investigaria.',
        prompt: 'Um serviço Python com várias threads **congela** de vez em quando: CPU em 0%, as requisições param de ser respondidas e nada aparece no log. Você suspeita de deadlock. Como **confirmaria** o diagnóstico e o que faria para **prevenir** que volte a acontecer?',
        minWords: 30,
        rubric: [
          { label: 'Confirma com um **dump das pilhas** das threads (py-spy, faulthandler, `sys._current_frames`)', keywords: ['py-spy', 'pyspy', 'faulthandler', 'dump', 'stack trace', 'stacktrace', 'pilha', 'traceback', 'current_frames', 'gdb', 'onde cada thread'], concept: 'Diagnóstico de deadlock', why: 'Com o processo congelado, a pilha de cada thread mostra exatamente em qual `acquire()` ela está parada.' },
          { label: 'Procura a **espera circular**: quem segura qual lock e espera qual (grafo de espera)', keywords: ['circular', 'ciclo', 'grafo', 'coffman', 'quem segura', 'segura o lock', 'segurando', 'wait-for'], concept: 'Grafo de espera', why: 'Deadlock ⇔ ciclo no grafo de espera; sem ciclo, o problema é outro (I/O travado, starvation…).' },
          { label: 'Previne com **ordem global** de aquisição dos locks', keywords: ['ordem global', 'mesma ordem', 'ordenar', 'ordena', 'ordem fixa', 'hierarquia', 'ordem de aquisicao', 'sorted', 'sempre na ordem'], concept: 'Ordem global de locks', why: 'Sem ordem invertida, não existe espera circular — a condição de Coffman mais barata de quebrar.' },
          { label: 'Reduz o risco: **timeout** no acquire, menos locks, seções críticas curtas, filas ou dados imutáveis', keywords: ['timeout', 'tempo limite', 'menos lock', 'lock unico', 'um unico lock', 'secao critica curta', 'secoes criticas curtas', 'curtas', 'fila', 'queue', 'imutav', 'mensage'], concept: 'Prevenção de deadlock', why: 'Timeout transforma travamento eterno em erro visível; menos locks aninhados significa menos chances de ciclo.' },
        ],
        modelAnswer: `Para **confirmar**, eu tiraria um **dump das pilhas** de todas as threads no momento do congelamento: \`py-spy dump --pid <PID>\` (sem parar o processo) ou o \`faulthandler\` configurado de antemão para imprimir o traceback de todas as threads ao receber um sinal. Se duas ou mais threads estiverem paradas em \`acquire()\`, anoto quem segura qual lock e quem espera qual: se esse grafo de espera tiver um **ciclo** (espera circular), é deadlock.

Para **prevenir**:
- definir uma **ordem global** de aquisição (ex.: sempre pelo id do recurso, com \`sorted\`), o que quebra a espera circular;
- usar \`acquire(timeout=...)\` para detectar e desistir em vez de travar para sempre (com log e nova tentativa com backoff);
- manter as seções críticas **curtas**, sem I/O nem callbacks dentro, e preferir **filas** (\`queue.Queue\`) ou dados imutáveis a vários locks aninhados.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você sabe **por que** `x += 1` quebra, como a seção crítica protege e como quebrar uma condição de Coffman para matar o deadlock.',
          'Na próxima unidade trocamos de mundo: o **asyncio**, onde a troca de tarefa só acontece onde você escreveu `await`.',
        ],
        board: null,
      },
    ],
  });
})();
