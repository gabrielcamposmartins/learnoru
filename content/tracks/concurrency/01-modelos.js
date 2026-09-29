Game.registerModule('concurrency', {
  id: 'modelos',
  title: 'Modelos de concorrência',
  kind: 'lesson',
  level: 2,
  order: 1,
  unit: 'fundamentos',
  summary: 'Processos, threads ou corrotinas? Concorrência × paralelismo, o que o GIL protege (e o que não), CPU-bound × IO-bound, o Python sem GIL e a Lei de Amdahl.',
  concepts: ['Concorrência × paralelismo', 'Processos, threads e corrotinas', 'GIL', 'CPU-bound × IO-bound', 'Lei de Amdahl'],
  takeaways: [
    'Concorrência é **lidar** com várias tarefas ao mesmo tempo (estrutura); paralelismo é **executar** várias no mesmo instante (precisa de vários núcleos).',
    'O **GIL** deixa só uma thread executar bytecode Python por vez: protege o **interpretador**, não o seu código — `x += 1` e *check-then-act* continuam precisando de lock.',
    'Esperando I/O → `asyncio` (muitas conexões) ou threads (bibliotecas bloqueantes). Calculando em Python puro → **processos** (`ProcessPoolExecutor`) ou código nativo que libera o GIL.',
    'Desde o 3.13 existe o build **free-threaded** (PEP 703, `python3.13t`): threads em paralelo de verdade — e as corridas que o GIL escondia aparecem.',
    '**Lei de Amdahl**: o speedup máximo é `1 / (1 − p)`. Com 95% paralelizável, nem mil núcleos passam de 20× — reduza a parte serial antes de comprar núcleos.',
  ],
  glossary: [
    { term: 'GIL', aliases: ['Global Interpreter Lock', 'trava global do interpretador'], definition: '*Global Interpreter Lock*: trava do CPython que deixa só **uma** thread executar bytecode Python por vez. Protege o estado interno do interpretador (como a contagem de referências), **não** as sequências de operações do seu código.' },
    { term: 'Free-threading', aliases: ['free-threaded', 'build free-threaded', 'sem GIL', 'nogil', 'PEP 703', 'python3.13t'], definition: 'Build do CPython **sem GIL** (PEP 703): experimental no 3.13 (`python3.13t`) e suportado a partir do 3.14. Threads executam Python em paralelo; as coleções embutidas têm locks internos, mas o seu código continua precisando de sincronização.' },
    { term: 'Lei de Amdahl', aliases: ["Amdahl's Law", 'Amdahl'], definition: 'Com fração paralelizável *p* e *n* núcleos, o speedup é `1 / ((1 − p) + p/n)`; com infinitos núcleos, `1 / (1 − p)`. A parte serial limita tudo: 95% paralelo nunca passa de 20×.' },
    { term: 'CPU-bound', aliases: ['CPU bound', 'limitado por CPU', 'intensivo em CPU'], definition: 'Trabalho cujo tempo é gasto **calculando** (laços, parsing, compressão). Acelera com mais núcleos — no CPython com GIL, usando **processos** ou código nativo que libera o GIL.' },
    { term: 'IO-bound', aliases: ['I/O-bound', 'IO bound', 'I/O bound', 'limitado por I/O', 'limitado por IO'], definition: 'Trabalho cujo tempo é gasto **esperando** rede, disco ou banco. Acelera com concorrência (`asyncio` ou threads), mesmo num único núcleo.' },
    { term: 'Multitarefa preemptiva', aliases: ['preemptiva', 'preemptivo', 'preemptive multitasking'], definition: 'O sistema operacional **interrompe** uma thread a qualquer momento para dar a vez a outra. O código não escolhe onde a troca acontece — por isso threads precisam de locks. O oposto é a multitarefa **cooperativa** do `asyncio`.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Bem-vindo(a) à trilha mais traiçoeira do jogo! Hoje vamos montar o mapa: **como** um programa faz várias coisas ao mesmo tempo.',
        'Primeira distinção — e ela cai em toda entrevista: concorrência **não** é paralelismo.',
      ],
      board: {
        title: '🍳 Concorrência × paralelismo',
        md: `> "Concorrência é sobre **lidar** com muitas coisas ao mesmo tempo. Paralelismo é sobre **fazer** muitas coisas ao mesmo tempo." — Rob Pike

\`\`\`text
CONCORRÊNCIA: 1 cozinheiro, 3 pratos       PARALELISMO: 3 cozinheiros
núcleo 1: [arroz][molho][arroz][salada]    núcleo 1: [arroz..........]
           ↑ alterna enquanto algo ferve   núcleo 2: [molho..........]
                                           núcleo 3: [salada.........]
\`\`\`

| | Concorrência | Paralelismo |
|---|---|---|
| O que é | **estrutura**: várias tarefas em andamento, intercaladas | **execução**: várias tarefas no mesmo instante |
| Precisa de vários núcleos? | não | sim |
| Ganho típico | aproveitar **esperas** (rede, disco) | dividir **cálculo** |
| Em Python | threads, \`asyncio\` | processos (e threads no build sem GIL) |

Dá para ter concorrência sem paralelismo (\`asyncio\` numa thread só) e paralelismo sem concorrência no seu código (uma instrução SIMD somando 8 números de uma vez).`,
      },
    },
    {
      type: 'say',
      text: [
        'O Python oferece três "motores": **processos**, **threads** e **corrotinas**.',
        'A diferença que mais importa é **quem decide** a hora de trocar de tarefa — e o que elas compartilham.',
      ],
      board: {
        title: 'Processos × threads × corrotinas',
        md: `| | Processo | Thread | Corrotina (\`asyncio\`) |
|---|---|---|---|
| Memória | **isolada** (cada um tem a sua) | compartilhada com o processo | compartilhada (uma thread só) |
| Quem troca de tarefa | o SO, a qualquer momento | o SO, a qualquer momento (**preemptiva**) | o seu código, em cada \`await\` (**cooperativa**) |
| Custo de criar | alto: novo interpretador, ms e dezenas de MB | médio: pilha própria, dezenas de µs | baixo: um objeto de poucos KB |
| Paralelismo de CPU (CPython com GIL) | ✅ sim | ❌ não | ❌ não |
| Comunicação | pipes e filas, com *pickle* | memória compartilhada + locks | memória compartilhada, sem troca inesperada |
| Se um falhar feio… | só ele cai | derruba o processo | derruba o processo |

\`\`\`text
PREEMPTIVA (threads)                      COOPERATIVA (asyncio)
A: lê x ─┐ ← o SO interrompe AQUI         A: lê x, soma, escreve ── await ─┐
B:       └ lê x, soma, escreve            B:                               └ roda até o seu await
A: soma, escreve (com o x antigo!)        As trocas só acontecem nos await
\`\`\`

> [!dica] É por isso que um servidor \`asyncio\` segura **dezenas de milhares** de conexões numa thread só, enquanto "uma thread por conexão" costuma parar nos poucos milhares: cada thread reserva uma pilha e custa trocas de contexto do SO.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Agora o famoso **GIL**: no CPython, só **uma** thread executa bytecode Python por vez.',
        'Ele protege o **interpretador**, não o **seu** código. Se você lembrar de uma frase desta aula, que seja essa.',
      ],
      board: {
        title: '🔒 O GIL: o que ele protege — e o que não',
        md: `**Por que existe:** o CPython gerencia memória por **contagem de referências** — cada objeto tem um contador que sobe e desce o tempo todo. Sem uma trava, duas threads corromperiam esses contadores. O GIL (*Global Interpreter Lock*) é a solução simples: **uma** trava para o interpretador inteiro.

Uma thread **solta** o GIL:
- ao fazer I/O bloqueante (socket, arquivo, \`time.sleep\`) → as outras rodam enquanto ela espera;
- a cada **5 ms** (\`sys.getswitchinterval()\`), se outra thread pediu a vez;
- em código C que o libera explicitamente (NumPy, \`hashlib\` e \`zlib\` com dados grandes).

| O GIL **protege** | O GIL **não** protege |
|---|---|
| contagens de referência e estruturas internas | sequências: \`x += 1\` é **ler → somar → escrever** |
| uma operação em C, como \`lista.append(x)\` ou \`d[k] = v\` (na prática, no CPython) | *check-then-act*: \`if k not in d: d[k] = criar()\` |
| — | invariantes entre objetos (tirar de uma conta e pôr em outra) |

\`\`\`python
saldo = 100

def sacar(valor):              # rodando em duas threads
    global saldo
    if saldo >= valor:         # A verifica 100 >= 80 ✔ … troca de thread!
        saldo -= valor         # B também viu 100 >= 80 ✔ → saldo = -60
\`\`\`

> [!atencao] "É thread-safe por causa do GIL" descreve um **detalhe de implementação** do CPython, não uma garantia da linguagem. Operações compostas **sempre** precisam de lock — na próxima aula vamos ver a troca acontecendo bem no meio do \`+=\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'A pergunta que decide o modelo: seu programa passa o tempo **calculando** ou **esperando**?',
        'Esperar rede e disco é *IO-bound*; queimar CPU é *CPU-bound*. As receitas são opostas.',
      ],
      board: {
        title: 'CPU-bound × IO-bound',
        md: `| | IO-bound | CPU-bound |
|---|---|---|
| O tempo vai para… | esperar rede, disco, banco | calcular (laços, parsing, compressão) |
| Sintoma | CPU ociosa, latência alta | um núcleo a 100%, os outros parados |
| Threads ajudam? | ✅ sim: o GIL é solto durante a espera | ❌ não (com GIL): só uma calcula por vez — e disputar o GIL ainda custa |
| Melhor ferramenta | \`asyncio\` (muitas conexões) ou threads (bibliotecas bloqueantes) | **processos** ou código nativo que libera o GIL |

\`\`\`text
IO-bound, 3 threads (o GIL é solto na espera)
T1: [cpu]........espera a rede........[cpu]
T2:  [cpu]........espera a rede........[cpu]
T3:   [cpu]........espera a rede........[cpu]    → ~3× mais rápido

CPU-bound, 3 threads (uma de cada vez segura o GIL)
T1: [cpu]      [cpu]      [cpu]
T2:      [cpu]      [cpu]      [cpu]
T3:           [cpu]      [cpu]      [cpu]        → o mesmo tempo (ou pior)
\`\`\`

> [!dica] Antes de escolher, **meça**: \`cProfile\`, \`time.perf_counter()\` ou só o uso de CPU. Um "processamento lento" que na verdade espera o banco não melhora com mais núcleos.`,
      },
    },
    {
      type: 'say',
      text: [
        'Na prática, quase ninguém cria threads e processos na mão: `concurrent.futures` dá a **mesma interface** para os dois.',
        'Trocar thread por processo é uma linha — mas processos cobram pedágio: tudo o que vai e volta é **serializado**.',
      ],
      board: {
        title: 'concurrent.futures e multiprocessing',
        code: `from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed

# IO-bound: threads (o GIL é solto enquanto cada uma espera a rede)
with ThreadPoolExecutor(max_workers=20) as pool:
    paginas = list(pool.map(baixar, urls))         # resultados na ordem de urls

# CPU-bound: processos (cada um com o SEU interpretador e o SEU GIL)
def main():
    with ProcessPoolExecutor() as pool:            # padrão: um worker por núcleo
        futuros = [pool.submit(comprimir, arq) for arq in arquivos]
        for futuro in as_completed(futuros):       # na ordem em que terminam
            print(futuro.result())                 # re-lança a exceção do worker

if __name__ == "__main__":    # obrigatório com "spawn" (Windows, macOS):
    main()                    # o processo filho reimporta este módulo`,
        caption: 'O pedágio: argumentos e resultados viajam por *pickle* (lambdas, conexões e locks não passam) e cada worker é um interpretador inteiro. Para milhares de tarefas pequenas, use `chunksize` em `pool.map`, ou a comunicação engole o ganho.',
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'E se eu disser que o GIL está virando **opcional**? Desde o Python 3.13 existe um build *free-threaded*, sem GIL.',
        'Threads rodando em paralelo de verdade… e as corridas que o GIL escondia aparecendo com força.',
      ],
      board: {
        title: '🧪 Python sem GIL: PEP 703 (free-threading)',
        md: `- **PEP 703** (Sam Gross, aceita em 2023): tornar o GIL **opcional** no CPython, em fases.
- **3.13** (out/2024): build **experimental** separado — o executável \`python3.13t\` (o "t" é de *free-threaded*). Os instaladores oficiais de Windows e macOS oferecem a opção.
- **3.14**: o build sem GIL passa a ser **suportado** (PEP 779), mas continua opcional — o padrão segue com GIL.

\`\`\`python
import sys, sysconfig

sysconfig.get_config_var("Py_GIL_DISABLED")   # 1 no build free-threaded
sys._is_gil_enabled()                          # False se o GIL está desligado agora (3.13+)
# PYTHON_GIL=1 (ou -X gil=1) religa o GIL. Importar uma extensão C que não
# declarou suporte a free-threading também religa — com um aviso.
\`\`\`

| Muda | Não muda |
|---|---|
| threads fazem trabalho **CPU-bound em paralelo** | \`x += 1\` e *check-then-act* continuam precisando de **lock** |
| código de uma thread só fica um pouco mais lento | \`list\` e \`dict\` não se corrompem (há locks internos por objeto) |
| extensões C precisam ser adaptadas | a regra: **estado mutável compartilhado exige sincronização** |

> [!sabia] Tirar o GIL já tinha sido tentado: o *Gilectomy* (Larry Hastings, 2016) deixava o código de uma thread muito mais lento. A PEP 703 viabilizou a ideia com truques pouco conhecidos: **biased reference counting** (a thread "dona" do objeto conta referências sem operações atômicas; as outras usam um segundo contador, atômico), objetos **imortais** (PEP 683: \`None\`, \`True\` e inteiros pequenos nunca mexem no contador) e o alocador **mimalloc**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Última ferramenta: uma fórmula de 1967 que evita muita frustração — a **Lei de Amdahl**.',
        'Se 10% do programa é serial, nem mil núcleos passam de **10×**. A parte serial manda.',
      ],
      board: {
        title: '📐 Lei de Amdahl: o teto do paralelismo',
        md: `Com uma fração **p** do tempo paralelizável e **n** núcleos:

\`\`\`text
                     1
speedup(n) = ─────────────────        teto (n → ∞) = 1 / (1 − p)
              (1 − p)  +  p / n
              serial     paralela
\`\`\`

| p (paralelizável) | 4 núcleos | 16 núcleos | ∞ núcleos |
|---|---|---|---|
| 50% | 1,6× | 1,9× | **2×** |
| 90% | 3,1× | 6,4× | **10×** |
| 95% | 3,5× | 9,1× | **20×** |
| 99% | 3,9× | 13,9× | **100×** |

Onde a parte serial se esconde: ler a entrada, juntar os resultados, um lock global disputado, serializar dados para os processos.

> [!sabia] A **Lei de Amdahl** (Gene Amdahl, 1967) tem um contraponto otimista: a **Lei de Gustafson** (1988) observa que, com mais máquinas, costumamos **aumentar o problema** — a parte paralela cresce e o ganho continua subindo. E um pessimista: a **Universal Scalability Law** (Neil Gunther) soma o custo de **coordenação** entre núcleos, que pode fazer o desempenho **cair** a partir de certo ponto.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Escolha o modelo certo — e calcule o teto do ganho.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'conc-mod-q1',
      concept: 'GIL',
      say: 'Começando pelo clássico de entrevista…',
      prompt: 'Um colega afirma: *"Nosso contador compartilhado entre threads não precisa de lock: o GIL garante que só uma thread roda por vez."* Qual é a avaliação correta?',
      options: [
        { text: 'Ele está certo: com o GIL, cada linha de Python é executada de forma atômica.', why: 'O GIL garante um **bytecode** por vez, não uma linha. `contador += 1` vira vários bytecodes (ler, somar, escrever), e a troca de thread pode acontecer entre eles.' },
        { text: 'Ele está errado: o GIL só impede duas threads de executar bytecode **no mesmo instante**; a troca pode ocorrer no meio de `contador += 1`, e um incremento se perde. Precisa de lock.', correct: true, why: 'Exato: o GIL protege o interpretador (contagem de referências), não a sua sequência ler → somar → escrever.' },
        { text: 'Ele está certo, mas só em máquinas com um único núcleo.', why: 'O número de núcleos não importa: mesmo com um núcleo, a troca de thread acontece entre bytecodes (o CPython pede a troca a cada 5 ms).' },
        { text: 'Ele está errado porque o GIL é desligado automaticamente quando o programa cria mais de uma thread.', why: 'No build padrão do CPython o GIL está sempre lá — ele existe justamente por causa das threads. Só o build *free-threaded* roda sem ele.' },
      ],
      explanation: 'O GIL torna **cada bytecode** (e muitas operações em C, como `list.append`) indivisível, mas `contador += 1` é uma **sequência**: carregar → somar → guardar. Se a thread perde a vez depois de ler, outra lê o mesmo valor e um incremento some (*lost update*). Soluções: `with lock: contador += 1`, ou evitar o estado compartilhado (cada thread acumula localmente e você soma no final). No build **free-threaded** o problema fica ainda mais frequente.',
    },
    {
      type: 'match',
      id: 'conc-mod-q2',
      concept: 'Escolha do modelo de concorrência',
      say: 'Agora o que mais importa na prática: escolher o modelo certo para cada cenário.',
      prompt: 'Associe cada **cenário** ao modelo mais adequado.',
      pairs: [
        { left: 'Servidor de chat com 10 mil conexões WebSocket, quase sempre ociosas', right: '`asyncio`: uma thread, milhares de corrotinas' },
        { left: 'Comprimir 5 mil imagens com código Python puro', right: '`ProcessPoolExecutor`: paralelismo de CPU' },
        { left: '20 consultas simultâneas com um driver de banco **síncrono**', right: '`ThreadPoolExecutor`: o GIL é solto durante a espera' },
        { left: 'Somar uma coluna de um CSV de 2 MB', right: 'Código sequencial: concorrência só adicionaria custo' },
        { left: 'Rodar um script de terceiros que pode travar ou vazar memória', right: 'Processo separado (`subprocess`) com timeout: isola a falha' },
      ],
      explanation: 'Esperar muito e calcular pouco → `asyncio` (ou threads, quando a biblioteca é bloqueante). Calcular muito em Python puro → processos, cada um com o seu GIL. Trabalho pequeno → sequencial: criar threads e processos custa mais que o ganho. E processos também servem para **isolar falhas**: se o script travar, você o encerra sem derrubar o seu programa.',
    },
    {
      type: 'code',
      id: 'conc-mod-q3',
      concept: 'Lei de Amdahl',
      title: 'O teto do speedup',
      say: 'Vamos transformar a Lei de Amdahl em código — e responder a pergunta que todo gestor faz: "quantos núcleos eu preciso?"',
      prompt: `A **Lei de Amdahl** diz quanto um programa pode acelerar com **n** núcleos quando uma fração **p** do tempo é paralelizável:

\`\`\`text
speedup(n) = 1 / ((1 − p) + p / n)
\`\`\`

Implemente:

1. \`speedup(p, n=None)\` → o speedup teórico (float).
   - \`n=None\` significa **infinitos núcleos**: devolva o speedup máximo, \`1 / (1 − p)\`; com \`p = 1\`, devolva \`math.inf\`.
   - \`p\` fora de \`[0, 1]\` ou \`n < 1\` → \`ValueError\`.
2. \`nucleos_para(p, alvo)\` → o **menor** número inteiro de núcleos \`n ≥ 1\` com \`speedup(p, n) >= alvo\`, ou \`None\` se nem infinitos núcleos chegam lá.
   - \`alvo <= 1\` → \`1\` (um núcleo já basta).

Exemplo: com 90% paralelizável, 6× exige 14 núcleos, e 12× é impossível (o teto é 10×).`,
      starter: `import math

def speedup(p, n=None):
    # TODO: Lei de Amdahl (n=None → infinitos núcleos)
    return 1.0


def nucleos_para(p, alvo):
    # TODO: menor n com speedup(p, n) >= alvo, ou None se for impossível
    return None
`,
      tests: [
        { name: 'p = 0,5 com 2 núcleos', expr: 'speedup(0.5, 2)', expected: '1.3333333333333333', compare: 'approx' },
        { name: 'p = 0,9 com 8 núcleos', expr: 'speedup(0.9, 8)', expected: '4.705882352941177', compare: 'approx' },
        { name: 'teto com p = 0,95 (infinitos núcleos)', expr: 'speedup(0.95)', expected: '20.0', compare: 'approx' },
        { name: 'tudo paralelizável: não há teto', expr: 'speedup(1.0)', expected: 'float("inf")' },
        { name: 'nada paralelizável: 1× com qualquer n', expr: 'speedup(0.0, 64)', expected: '1.0', compare: 'approx' },
        { name: 'valores inválidos lançam ValueError', code: `for args in [(1.5, 4), (-0.1, 4), (0.5, 0)]:
    try:
        speedup(*args)
    except ValueError:
        continue
    raise AssertionError(f"speedup{args} deveria lançar ValueError")
` },
        { name: '90% paralelizável: 6× exige 14 núcleos', expr: 'nucleos_para(0.9, 6)', expected: '14' },
        { name: 'acima do teto é impossível', expr: 'nucleos_para(0.9, 12)', expected: 'None' },
        { name: 'alvo <= 1: um núcleo basta', expr: 'nucleos_para(0.3, 1)', expected: '1' },
        { name: 'p = 0,99 e alvo de 60×', expr: 'nucleos_para(0.99, 60)', expected: '149' },
        { name: 'sem parte paralela, nada acelera', hidden: true, expr: 'nucleos_para(0.0, 1.5)', expected: 'None' },
        { name: 'sempre o MENOR n (sem off-by-one)', hidden: true, code: `casos = [(0.95, 12, 29), (0.5, 1.7, 6), (0.98, 33, 96), (0.7, 2.9, 16), (1.0, 999.5, 1000), (0.9999, 6500, 18570)]
for p, alvo, esperado in casos:
    obtido = nucleos_para(p, alvo)
    assert obtido == esperado, f"nucleos_para({p}, {alvo}) = {obtido!r}, esperado {esperado}"
` },
      ],
      reviews: [
        {
          when: m => m.loops > 0,
          text: 'Você encontrou n **testando** valores num laço. Funciona, mas perto do teto o laço explode: com p = 0,9999 e alvo de 9.999×, são ~10⁸ núcleos. Isolando n na desigualdade, `n = ⌈p / (1/alvo − (1 − p))⌉`, a resposta sai em O(1).',
          concept: 'Resolver a desigualdade × força bruta',
        },
        {
          when: (m, code) => /[!=]=\s*None\b/.test(code),
          text: 'Compare com `None` usando `is` / `is not` (PEP 8): `==` chama `__eq__`, que pode ser sobrescrito; `is` compara identidade — o que você quer com o singleton `None`.',
          concept: 'Comparação com None',
        },
      ],
      hints: [
        'A parte serial não encolhe: com n núcleos, o tempo relativo é `(1 − p) + p / n`. O speedup é o inverso disso.',
        'Para `nucleos_para`, isole n em `(1 − p) + p / n <= 1 / alvo`: sobra uma `folga = 1 / alvo − (1 − p)` para a parte paralela caber.',
        'Se `folga <= 0`, é impossível (`None`). Senão, `n >= p / folga` → `math.ceil(p / folga)`. Cuidado com ponto flutuante: `math.ceil(p / folga - 1e-9)` evita que 13.000000000000002 vire 14.',
      ],
      solution: `import math

def _validar(p):
    if not 0 <= p <= 1:
        raise ValueError("p deve estar entre 0 e 1")

def speedup(p, n=None):
    _validar(p)
    serial = 1 - p
    if n is None:                          # infinitos núcleos: sobra só a parte serial
        return math.inf if serial == 0 else 1 / serial
    if n < 1:
        raise ValueError("n deve ser >= 1")
    return 1 / (serial + p / n)

def nucleos_para(p, alvo):
    _validar(p)
    if alvo <= 1:
        return 1
    folga = 1 / alvo - (1 - p)             # tempo que sobra para a parte paralela
    if folga <= 0:
        return None                        # nem infinitos núcleos chegam lá
    return max(1, math.ceil(p / folga - 1e-9))
`,
      solutionExplanation: 'O speedup compara o tempo com 1 núcleo (normalizado para 1) com o tempo com n: a parte serial `(1 − p)` fica intacta e só a paralela encolhe para `p / n`. Com n → ∞ sobra `1 / (1 − p)` — o **teto**. Em `nucleos_para`, a condição vira `p / n <= 1/alvo − (1 − p)`: se essa folga não for positiva, nem infinitos núcleos resolvem; senão, `n = ⌈p / folga⌉`. O `- 1e-9` protege contra erros de ponto flutuante perto de inteiros. A lição prática: antes de comprar núcleos, **reduza a parte serial**.',
    },
    {
      type: 'order',
      id: 'conc-mod-q4',
      concept: 'ProcessPoolExecutor e pickle',
      say: 'Quanto custa mandar trabalho para outro processo? Vamos seguir o caminho de uma tarefa.',
      prompt: 'Coloque em ordem o que acontece quando você chama `pool.submit(comprimir, arquivo)` num `ProcessPoolExecutor` e depois `futuro.result()`.',
      items: [
        'O executor cria (ou reaproveita) os processos worker',
        'A função e os argumentos são serializados com `pickle`',
        'Os bytes viajam por um canal entre processos (pipe/fila)',
        'O worker desserializa e executa `comprimir(arquivo)` com o seu próprio GIL',
        'O resultado (ou a exceção) é serializado e enviado de volta',
        '`futuro.result()` entrega o valor — ou re-lança a exceção no processo principal',
      ],
      explanation: 'Cada ida e volta paga **serialização + cópia + desserialização**. Por isso processos compensam para tarefas pesadas (segundos de CPU), não para milhares de tarefas de microssegundos — nesse caso, agrupe com `chunksize`. E só passa o que é *picklable*: funções definidas no nível do módulo, sim; `lambda`, conexões e locks, não. Sobre o 1º passo: no Linux o padrão era `fork` (copia o processo; no 3.14 virou `forkserver`), enquanto Windows e macOS usam `spawn` — um interpretador novo que reimporta o seu módulo, daí o `if __name__ == "__main__"`.',
    },
    {
      type: 'mcq',
      id: 'conc-mod-q5',
      concept: 'Free-threading (PEP 703)',
      say: 'Uma pergunta sobre o futuro próximo — que, na verdade, já chegou.',
      prompt: 'Sua equipe vai testar um serviço no **Python 3.13t** (*free-threaded*, sem GIL). Ele tem um cache global (`dict`) e um contador `total += 1`, ambos usados por várias threads, que "nunca deram problema". O que esperar?',
      options: [
        { text: 'Nada muda: o que funcionava com GIL continua funcionando igual.', why: 'Com GIL, a troca de thread só acontece em certos pontos; sem GIL, as threads rodam **ao mesmo tempo** e corridas que eram raras ficam frequentes.' },
        { text: 'O `dict` continua íntegro (há locks internos por objeto), mas `total += 1` e sequências *check-then-act* ficam **mais** expostas a corridas: precisam de lock.', correct: true, why: 'É a regra de sempre, agora sem a "sorte": as estruturas embutidas não se corrompem, mas as **suas** sequências de operações não são atômicas.' },
        { text: 'O `dict` passa a se corromper (e o processo cai) quando duas threads escrevem nele ao mesmo tempo.', why: 'A PEP 703 adicionou locks por objeto em `list`, `dict` e companhia justamente para isso não acontecer.' },
        { text: 'O código nem roda: o build free-threaded só aceita `asyncio`, não threads.', why: 'Pelo contrário: o objetivo do build é permitir que **threads** executem Python em paralelo.' },
      ],
      explanation: 'O build *free-threaded* (PEP 703) remove a trava global, mas mantém a **segurança de memória** do interpretador com *biased reference counting* e locks por objeto nas coleções embutidas. O que ele não pode fazer é adivinhar as **suas** seções críticas: `total += 1` continua sendo ler → somar → escrever. Código que "funcionava" graças ao GIL fica exposto — rode testes de estresse antes de migrar.',
    },
    {
      type: 'open',
      id: 'conc-mod-q6',
      concept: 'GIL e escolha do modelo',
      say: 'Para fechar, uma pergunta de conversa — do jeito que aparece em entrevista.',
      prompt: 'Um colega diz: *"Python não serve para concorrência por causa do GIL."* Como você responderia, com argumentos técnicos? Diga quando threads, processos e `asyncio` funcionam bem.',
      minWords: 30,
      rubric: [
        { label: 'Explica que em trabalho **IO-bound** threads e `asyncio` funcionam (o GIL é solto na espera)', keywords: ['io-bound', 'io bound', 'i/o', 'entrada e saida', 'rede', 'asyncio', 'async', 'espera', 'solto', 'solta o gil', 'libera', 'liberad'], concept: 'CPU-bound × IO-bound', why: 'Enquanto uma thread espera rede ou disco, ela não segura o GIL — as outras rodam.' },
        { label: 'Para **CPU-bound**, propõe **processos** ou código nativo que libera o GIL', keywords: ['processo', 'multiprocessing', 'processpool', 'process pool', 'numpy', 'extensa', 'extensoes', 'nativo', 'nativa', 'cython', 'rust'], concept: 'Paralelismo com processos', why: 'Cada processo tem o seu interpretador e o seu GIL; bibliotecas em C (NumPy, hashlib) soltam o GIL no trabalho pesado.' },
        { label: 'Diferencia **concorrência** de **paralelismo** (o GIL limita só o paralelismo de bytecode)', keywords: ['paralelismo', 'paralel'], concept: 'Concorrência × paralelismo', why: 'O GIL impede duas threads de executar bytecode no mesmo instante; ele não impede concorrência.' },
        { label: 'Menciona o Python **sem GIL** (PEP 703) ou que o GIL não dispensa locks', keywords: ['free-thread', 'free thread', 'pep 703', '3.13', '3.14', 'sem gil', 'nogil', 'no-gil', 'gil opcional', 'lock', 'trava', 'thread-safe', 'thread safe', 'sincroniz'], concept: 'Free-threading (PEP 703)', why: 'O GIL está virando opcional — e, com ou sem ele, estado compartilhado exige sincronização.' },
      ],
      modelAnswer: `Depende do tipo de carga — e de separar **concorrência** de **paralelismo**. O GIL só impede que duas threads executem bytecode Python no mesmo instante: ele limita o paralelismo de CPU, não a concorrência.

- **IO-bound** (rede, disco, banco): threads funcionam bem, porque o GIL é solto enquanto a thread espera; com muitas conexões, \`asyncio\` é ainda melhor (uma thread, milhares de corrotinas).
- **CPU-bound**: uso **processos** (\`ProcessPoolExecutor\`/\`multiprocessing\`), cada um com o seu interpretador e o seu GIL, ou bibliotecas nativas como NumPy, que liberam o GIL no trabalho pesado.
- E o cenário está mudando: desde o 3.13 existe o build **free-threaded** (PEP 703), sem GIL. Mas, com ou sem GIL, o código não fica thread-safe sozinho: estado compartilhado continua exigindo **lock**.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo começo! Guarde o mapa: esperando I/O → `asyncio` ou threads; calculando → processos; e a parte serial limita tudo (Amdahl).',
        'Na próxima aula vamos abrir o `x += 1` com `dis`, ver as intercalações que perdem dados e caçar **deadlocks**.',
      ],
      board: null,
    },
  ],
});
