(function () {
  const RLE = `import random


def comprimir(texto):
    """Run-length encoding: "aaabcc" -> [("a", 3), ("b", 1), ("c", 2)].

    Contrato: cada par tem contagem >= 1 e pares vizinhos nunca
    repetem o caractere (forma canônica). Maiúsculas e espaços contam.
    """
    if not texto:
        return []
    pares = []
    atual, n = texto[0], 1
    for ch in texto[1:]:
        if ch == atual:
            n += 1
        else:
            pares.append((atual, n))
            atual, n = ch, 1
    pares.append((atual, n))
    return pares


def descomprimir(pares):
    return "".join(ch * n for ch, n in pares)


# ── mini-framework de propriedades (o mesmo que você construiu) ──

def textos(rng):
    """Gera textos em blocos repetidos, como 'aaaaBB  b', 'AAAAAAAAAAAa' ou ''."""
    blocos = [rng.choice("aAbB ") * rng.randint(1, 12) for _ in range(rng.randint(0, 5))]
    return "".join(blocos)


def _falha(propriedade, valor):
    try:
        return propriedade(valor) is False
    except Exception:
        return True


def _candidatos(s):
    """Textos menores: as metades e o texto sem cada caractere."""
    metades = [s[:len(s) // 2], s[len(s) // 2:]] if len(s) > 1 else []
    return metades + [s[:i] + s[i + 1:] for i in range(len(s))]


def _encolher(valor, propriedade):
    while True:
        for menor in _candidatos(valor):
            if _falha(propriedade, menor):
                valor = menor
                break
        else:
            return valor


def for_all(gerador, propriedade, runs=200, seed=0):
    """Devolve None se a propriedade valeu sempre; senão, o contraexemplo encolhido."""
    rng = random.Random(seed)
    for _ in range(runs):
        valor = gerador(rng)
        if _falha(propriedade, valor):
            return _encolher(valor, propriedade)
    return None
`;

  const mutR = (from, to) => {
    const code = RLE.replace(from, to);
    if (code === RLE) throw new Error(`mutante sem efeito: ${from}`);
    return code;
  };

  const GERADORES = `def inteiros(lo, hi):
    def gerar(rng):
        return rng.randint(lo, hi)
    return gerar


def listas(elemento, max_len=8):
    def gerar(rng):
        return [elemento(rng) for _ in range(rng.randint(0, max_len))]
    return gerar
`;

  const FALHA = `def falha(propriedade, valor):
    """True se a propriedade FALHA para valor: devolve False ou levanta exceção."""
    try:
        return propriedade(valor) is False
    except Exception:
        return True
`;

  Game.registerModule('testing', {
    id: 'property-based',
    title: 'Property-based testing: propriedades, geradores e shrinking',
    kind: 'lesson',
    level: 3,
    order: 31,
    unit: 'qualidade',
    summary: 'Em vez de escolher exemplos, afirme regras que valem para qualquer entrada — e construa seu próprio mini-Hypothesis, com geradores e shrinking.',
    concepts: ['Property-based testing', 'Tipos de propriedade', 'Metamorphic testing', 'Geradores com seed', 'Shrinking'],
    takeaways: [
      'Um teste de propriedade afirma uma **regra que vale para qualquer entrada** e deixa um gerador caçar o contraexemplo; exemplos documentam, propriedades exploram.',
      'Padrões para achar propriedades: **ida e volta**, **invariantes**, **idempotência**, **oráculo** e **relações metamórficas** — combine várias, porque cada uma sozinha costuma ser fraca.',
      'Geradores recebem **um** `random.Random(seed)`: a seed torna qualquer falha **reprodutível**, e o viés para bordas (vazio, 0, extremos) acha bugs mais cedo.',
      '**Shrinking** reduz o contraexemplo ao mínimo que ainda falha — de `[93, -41, 7, 7, 0, 55, -12]` para `[7, 7]`.',
      'No dia a dia, use o **Hypothesis** (`@given`, estratégias `st.*`, `@example`): ele encolhe a sequência de escolhas e guarda as falhas para repeti-las.',
    ],
    glossary: [
      { term: 'Property-based testing', aliases: ['property-based', 'testes baseados em propriedades', 'teste baseado em propriedades', 'testes de propriedade', 'PBT'], definition: 'Técnica em que o teste afirma uma **propriedade** que deve valer para qualquer entrada, e um gerador produz centenas de entradas aleatórias procurando um contraexemplo. Nasceu com o QuickCheck (Haskell); em Python, o padrão é o Hypothesis.' },
      { term: 'Shrinking', aliases: ['encolhimento'], definition: 'Etapa em que o framework reduz um contraexemplo encontrado até uma versão mínima que ainda falha (ex.: `[93, 7, 7, 0]` → `[7, 7]`), o que torna o bug fácil de entender.' },
      { term: 'Metamorphic testing', aliases: ['teste metamórfico', 'testes metamórficos', 'relação metamórfica', 'relações metamórficas', 'metamorphic relation'], definition: 'Técnica para quando não se conhece a saída correta: em vez de verificar uma saída, verifica-se uma **relação** entre as saídas de entradas relacionadas (ex.: acrescentar um termo à busca nunca aumenta os resultados).' },
      { term: 'Oráculo de teste', aliases: ['test oracle', 'problema do oráculo', 'oráculo'], definition: 'Mecanismo que decide se uma saída está correta: um valor esperado, uma implementação de referência simples ou uma propriedade. O **problema do oráculo** surge quando não existe um jeito prático de saber a resposta certa.' },
      { term: 'Propriedade de ida e volta', aliases: ['propriedades de ida e volta', 'round-trip property'], definition: 'Propriedade em que uma operação seguida da sua inversa devolve a entrada original, como `json.loads(json.dumps(x)) == x`. Ideal para serializadores, codificadores e parsers.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Até agora, todo teste que você escreveu verificou **exemplos** escolhidos por você: `calcular_frete(200, 1) == 0`, `conceito(9) == "A"`…',
          'O problema: bugs adoram os casos que **ninguém pensou em escrever**. Hoje a ideia é outra — afirmar uma **regra** e deixar o computador caçar o contraexemplo.',
        ],
        board: {
          title: 'Exemplos × propriedades',
          md: `| | Testes de exemplo | Testes de propriedade |
|---|---|---|
| Quem escolhe a entrada | você | um **gerador** (centenas de entradas) |
| O que verifica | uma saída exata | uma **regra** geral |
| Ponto forte | documenta casos concretos | acha casos que você não imaginou |
| Ponto fraco | só testa o que você pensou | exige achar uma regra (e é mais lento) |`,
          code: `from collections import Counter
import random


# Baseado em EXEMPLOS: você escolhe a entrada e a saída esperada
def test_ordenar_exemplos():
    assert ordenar([3, 1, 2]) == [1, 2, 3]
    assert ordenar([]) == []


# Baseado em PROPRIEDADES: uma regra que vale para QUALQUER lista
def test_ordenar_propriedades():
    rng = random.Random(42)                      # seed fixa: reprodutível
    for _ in range(200):
        xs = [rng.randint(-50, 50) for _ in range(rng.randint(0, 20))]
        saida = ordenar(xs)
        assert all(a <= b for a, b in zip(saida, saida[1:]))   # está em ordem
        assert Counter(saida) == Counter(xs)                    # mesmos elementos`,
          caption: 'A ideia nasceu no **QuickCheck** (Haskell, 2000); em Python, a biblioteca de referência é o **Hypothesis**. Exemplos e propriedades se complementam.',
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A parte difícil é **achar** boas propriedades. A boa notícia: elas seguem padrões que se repetem.',
          'Guarde esta tabela — ela resolve a maioria dos casos do dia a dia.',
        ],
        board: {
          title: 'Tipos de propriedade',
          md: `| Padrão | Ideia | Exemplo |
|---|---|---|
| **Ida e volta** (*round-trip*) | desfazer o que foi feito devolve a entrada | \`json.loads(json.dumps(x)) == x\` |
| **Invariante** | algo que a operação não muda | \`len(ordenar(xs)) == len(xs)\`; a soma dos saldos antes e depois de uma transferência |
| **Idempotência** | aplicar duas vezes = aplicar uma | \`normalizar(normalizar(s)) == normalizar(s)\` |
| **Oráculo** (implementação de referência) | comparar com uma versão lenta, porém obviamente correta | \`busca_binaria(xs, x) == (x in xs)\` |
| **Difícil de calcular, fácil de verificar** | conferir a resposta é mais simples que produzi-la | \`math.prod(fatorar(n)) == n\`, com todos os fatores primos |

> [!atencao] Cuidado com propriedades **fracas** — \`isinstance(ordenar(xs), list)\` passa até para \`return []\` — e **tautológicas**: reimplementar a função dentro do teste (mesmo algoritmo, mesmos bugs). Combine propriedades até que só a implementação correta passe em todas.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E quando você **não sabe** qual é a saída certa? Um buscador, um compilador, um modelo de machine learning… Isso tem nome: **problema do oráculo**.',
          'A saída é elegante: em vez de verificar **uma** saída, você verifica a **relação** entre as saídas de entradas relacionadas.',
        ],
        board: {
          title: 'Metamorphic testing',
          md: `\`\`\`text
  entrada x  ───── f ─────▶  f(x)
      │                        │
  transforma            relação esperada?
      ▼                        │
  entrada x' ───── f ─────▶  f(x')
\`\`\`

| Sistema | Transformação da entrada | Relação esperada entre as saídas |
|---|---|---|
| \`buscar(termos)\` (exige todos os termos) | acrescentar um termo | resultados novos ⊆ resultados antigos |
| \`media(xs)\` | embaralhar \`xs\` | a mesma média |
| \`media(xs)\` | somar \`k\` a todos | média antiga + \`k\` |
| \`rota_mais_curta(mapa, a, b)\` | adicionar uma estrada | a distância **não aumenta** |
| classificador de imagens | ajustar levemente o brilho | a mesma classe |

> [!sabia] O **metamorphic testing** foi proposto por T. Y. Chen em 1998 justamente para o problema do oráculo. Uma variação da ideia para compiladores — gerar programas **equivalentes** e comparar os resultados (*Equivalence Modulo Inputs*) — já encontrou centenas de bugs no GCC e no LLVM, sem ninguém saber de antemão a saída "certa" de cada programa.`,
        },
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Agora, a mecânica. Um **gerador** é só uma função que recebe um `random.Random` e devolve um valor — e geradores se compõem.',
          'O detalhe crucial é a **seed**: com o mesmo `random.Random(seed)`, a mesma sequência de entradas se repete, e uma falha no CI pode ser reproduzida na sua máquina.',
        ],
        board: {
          title: 'Geradores com random.Random(seed)',
          md: `- Use **uma** instância \`random.Random(seed)\` por execução — nunca o \`random\` global, cujo estado é compartilhado com o programa inteiro.
- Não recrie o \`Random(seed)\` dentro do laço: você geraria **o mesmo valor** em todas as rodadas.
- **Mostre a seed** quando falhar: é ela que permite reproduzir o erro.
- Dê um **viés para as bordas** (vazio, \`0\`, extremos, duplicatas). O Hypothesis faz isso de forma agressiva.`,
          code: `import random


def inteiros(lo, hi):
    bordas = [v for v in (lo, hi, 0, 1, -1) if lo <= v <= hi]

    def gerar(rng):
        if rng.random() < 0.25:            # 25% das vezes: um caso de borda
            return rng.choice(bordas)
        return rng.randint(lo, hi)
    return gerar


def listas(elemento, max_len=8):
    def gerar(rng):                         # um gerador feito de outro gerador
        return [elemento(rng) for _ in range(rng.randint(0, max_len))]
    return gerar


gen = listas(inteiros(-5, 5))
rng = random.Random(1234)                   # UMA instância, criada uma vez
print(gen(rng), gen(rng), gen(rng))         # sempre as mesmas três listas`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O gerador achou um contraexemplo. Ótimo! Mas depurar `[93, -41, 7, 7, 0, 55, -12]` não é nada divertido.',
          'Por isso os frameworks fazem **shrinking**: reduzem o contraexemplo, passo a passo, até o menor valor que **ainda falha**.',
        ],
        board: {
          title: 'Shrinking: do contraexemplo ao mínimo',
          md: `\`\`\`text
propriedade: "a lista não tem elementos repetidos"

[93, -41, 7, 7, 0, 55, -12]
  tenta []                         passa  → descarta
  tenta [93, -41, 7]               passa  → descarta
  tenta [7, 0, 55, -12]            passa  → descarta
  tenta [-41, 7, 7, 0, 55, -12]    FALHA  → fica com ele
[-41, 7, 7, 0, 55, -12]
  tenta []                         passa  → descarta
  tenta [-41, 7, 7]                FALHA  → fica com ele
[-41, 7, 7]
  tenta [] e [-41]                 passam
  tenta [7, 7]                     FALHA  → fica com ele
[7, 7]
  tenta [], [7], [0, 7], [3, 7]…   tudo passa → FIM
\`\`\`

**Algoritmo guloso:** gere candidatos "menores" — lista vazia, metades, a lista sem um elemento, um elemento encolhido; para inteiros, \`0\`, a metade e um passo em direção a zero. Se algum ainda falhar, troque o valor por ele e recomece. Quando nenhum falhar, você chegou a um **mínimo local**.

> [!sabia] O Hypothesis não encolhe o valor final, e sim a **sequência de escolhas aleatórias** que o gerou (*internal shrinking*). Por isso qualquer estratégia composta — até objetos montados com \`st.builds\` — encolhe sozinha, sem você escrever uma linha de shrinking. E ele vai além do nosso algoritmo guloso: para essa propriedade, ele reporta \`[0, 0]\`.`,
        },
      },
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'No trabalho, você não vai escrever seu próprio framework: vai usar o **Hypothesis**. Ele não está disponível aqui no navegador, então vamos só conhecer a API — e depois construir a nossa versão.',
          'Repare que os conceitos são os mesmos: estratégias são geradores, `@given` faz o papel do nosso `for_all`, e o shrinking vem de graça.',
        ],
        board: {
          title: 'A API do Hypothesis (para conhecer — não roda aqui)',
          code: `from collections import Counter
from hypothesis import assume, example, given, settings, strategies as st


@given(st.lists(st.integers()))
def test_ordenar_preserva_os_elementos(xs):
    assert Counter(ordenar(xs)) == Counter(xs)


@given(st.text())
@example("")                          # caso fixo, sempre testado (regressão)
def test_ida_e_volta(s):
    assert descomprimir(comprimir(s)) == s


@settings(max_examples=500)           # mais exemplos que os 100 padrão
@given(st.integers(), st.integers())
def test_divisao_inteira(a, b):
    assume(b != 0)                    # descarta entradas inválidas
    assert (a // b) * b + a % b == a


# Se ordenar() perdesse elementos repetidos, o pytest mostraria:
#   Falsifying example: test_ordenar_preserva_os_elementos(xs=[0, 0])`,
          caption: 'O Hypothesis também guarda os contraexemplos numa pasta `.hypothesis/` e os testa **primeiro** na próxima execução — um bug encontrado não "some" por azar do sorteio.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Property-based testing é poderoso, mas não é bala de prata.',
          'Ele brilha em código com **regras claras** — parsers, serializadores, estruturas de dados, cálculos — e rende pouco onde não existe uma regra simples para afirmar.',
        ],
        board: {
          title: 'Quando usar — e quando não',
          md: `| ✅ Brilha em | ⚠️ Rende menos em |
|---|---|
| Serialização, parsers, codificadores (ida e volta) | Layout de tela, textos, "parece certo?" |
| Estruturas de dados e algoritmos (invariantes, oráculo) | Código cuja única propriedade seria reimplementá-lo |
| Regras com conservação (dinheiro, estoque) | Testes lentos (banco, rede): 100 execuções custam caro |
| Refatorações: a versão antiga vira **oráculo** da nova | Entradas muito restritas (o \`assume\` descarta quase tudo) |

> [!dica] Na prática: mantenha alguns **testes de exemplo** (documentam o comportamento e as regressões conhecidas) e acrescente **propriedades** onde houver regras. Quando uma propriedade achar um bug, fixe o contraexemplo com \`@example(...)\`.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Propriedades, um mini-framework com shrinking e testes de propriedade de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'tst-pbt-q1',
        concept: 'Propriedades suficientes',
        say: 'Primeiro, o olho de quem escolhe propriedades.',
        prompt: 'Você quer testar `ordenar(xs)` com propriedades. Qual conjunto é **suficiente** — isto é, só uma ordenação correta passa em todas?',
        options: [
          { text: 'A saída está em ordem não decrescente **e** `Counter(saida) == Counter(xs)`.', correct: true, why: 'Estar em ordem e ser uma permutação da entrada (mesmos elementos, mesmas quantidades) determina a saída de forma única.' },
          { text: 'A saída está em ordem, `set(saida) == set(xs)` e `len(saida) == len(xs)`.', why: 'Quase! Mas `set` ignora repetições: transformar `[1, 1, 2]` em `[1, 2, 2]` passa nas três.' },
          { text: '`ordenar(ordenar(xs)) == ordenar(xs)` (idempotência).', why: 'É uma propriedade verdadeira, mas fraca: `return []` também é idempotente.' },
          { text: '`len(saida) == len(xs)` e `saida[0] == min(xs)`.', why: 'Não garante a ordem do resto (`[1, 3, 2]` passa) e ainda quebra com a lista vazia.' },
        ],
        explanation: 'Cada propriedade isolada é uma condição **necessária**; a arte é combiná-las até que sejam **suficientes** — ou, pelo menos, fortes o bastante para matar os bugs plausíveis. Para ordenação, "está em ordem" + "é uma permutação" (comparando com `Counter`, que conta repetições) especifica tudo.',
      },
      {
        type: 'match',
        id: 'tst-pbt-q2',
        concept: 'Tipos de propriedade',
        say: 'Agora, ligue cada tipo de propriedade a um exemplo.',
        prompt: 'Associe cada **tipo de propriedade** ao exemplo que ele descreve.',
        pairs: [
          { left: 'Ida e volta (round-trip)', right: '`descomprimir(comprimir(s)) == s`' },
          { left: 'Invariante', right: 'A soma dos saldos é a mesma antes e depois de `transferir`' },
          { left: 'Idempotência', right: '`slug(slug(t)) == slug(t)`' },
          { left: 'Oráculo (implementação de referência)', right: '`busca_binaria(xs, x)` concorda com `x in xs`' },
          { left: 'Relação metamórfica', right: 'Acrescentar um termo à busca nunca aumenta o número de resultados' },
        ],
        explanation: 'A **ida e volta** compara uma operação com a sua inversa; o **invariante** é algo que a operação preserva (dinheiro não surge nem some numa transferência); **idempotência** é "aplicar de novo não muda nada"; o **oráculo** é uma implementação simples e confiável usada como referência; e a **relação metamórfica** liga as saídas de duas entradas relacionadas — sem precisar saber a resposta certa de nenhuma delas.',
      },
      {
        type: 'code',
        id: 'tst-pbt-q3',
        concept: 'Geradores com seed',
        title: 'Seu próprio for_all',
        say: 'Mão na massa: vamos construir o coração de um framework de propriedades. Primeiro, **sem** shrinking.',
        prompt: `Implemente o núcleo de um mini-framework de property-based testing:

- \`falha(propriedade, valor)\` → \`True\` se a propriedade **falha** para \`valor\`: ela devolve \`False\` **ou** levanta qualquer exceção (inclusive \`AssertionError\`). Devolver \`True\` ou \`None\` (uma propriedade só com \`assert\`) conta como **sucesso**.
- \`for_all(gerador, propriedade, runs=100, seed=0)\` → cria **um** \`random.Random(seed)\`, gera até \`runs\` valores com \`gerador(rng)\` e devolve o **primeiro** valor em que a propriedade falha. Se ela valer em todos, devolve \`None\`.

Os geradores \`inteiros(lo, hi)\` e \`listas(elemento, max_len)\` já estão prontos.

\`\`\`python
>>> for_all(inteiros(0, 100), lambda n: n < 90)
97
>>> for_all(listas(inteiros(0, 9)), lambda xs: len(xs) <= 8)   # nenhum contraexemplo
\`\`\``,
        starter: `import random


def falha(propriedade, valor):
    """True se a propriedade FALHA para valor: devolve False ou levanta exceção."""
    ...


def for_all(gerador, propriedade, runs=100, seed=0):
    """Roda a propriedade em até runs valores gerados; devolve o 1º contraexemplo ou None."""
    ...


# ── geradores prontos ──

${GERADORES}`,
        tests: [
          { name: 'falha: devolver False é falha', expr: 'falha(lambda x: False, 1)', expected: 'True' },
          { name: 'falha: True e None são sucesso', code: 'assert falha(lambda x: True, 1) is False, "devolver True deveria ser sucesso"\nassert falha(lambda x: None, 1) is False, "devolver None (propriedade só com assert) deveria ser sucesso"' },
          { name: 'falha: exceção é falha', code: 'assert falha(lambda x: 1 / 0, 1) is True, "ZeroDivisionError deveria contar como falha"\n\ndef prop(x):\n    assert x > 5\n\nassert falha(prop, 3) is True, "AssertionError deveria contar como falha"' },
          { name: 'propriedade sempre verdadeira → None', expr: 'for_all(inteiros(0, 100), lambda n: 0 <= n <= 100)', expected: 'None' },
          { name: 'devolve um contraexemplo', code: 'r = for_all(inteiros(0, 100), lambda n: n < 90, seed=1)\nassert r is not None and r >= 90, f"esperava um valor >= 90, veio {r!r}"' },
          { name: 'devolve o PRIMEIRO contraexemplo', code: 'seq = iter([3, 8, 12, 9, 15])\nr = for_all(lambda rng: next(seq), lambda n: n < 10, runs=5)\nassert r == 12, f"esperava 12 (o primeiro >= 10), veio {r!r}"' },
          { name: 'para no primeiro contraexemplo', code: 'vistos = []\n\ndef prop(n):\n    vistos.append(n)\n    return n != 5\n\nseq = iter([1, 5, 2, 5])\nfor_all(lambda rng: next(seq), prop, runs=4)\nassert vistos == [1, 5], f"a propriedade rodou para {vistos}"' },
          { name: 'propriedade só com assert passa', code: 'def prop(n):\n    assert n >= 0\n\nassert for_all(inteiros(0, 10), prop) is None, "uma propriedade que devolve None não falhou"' },
          { name: 'roda exatamente runs vezes', code: 'chamadas = []\nfor_all(inteiros(0, 9), chamadas.append, runs=37)\nassert len(chamadas) == 37, f"a propriedade rodou {len(chamadas)} vezes"' },
          { name: 'exceção na propriedade vira contraexemplo', expr: 'for_all(inteiros(0, 10), lambda n: 10 // n > 0)', expected: '0' },
          { name: 'um único Random(seed) para todas as rodadas', hidden: true, code: 'import random\nvalores = []\nfor_all(inteiros(0, 10**9), valores.append, runs=50, seed=7)\nr = random.Random(7)\nesperado = [r.randint(0, 10**9) for _ in range(50)]\nassert valores == esperado, "crie UM random.Random(seed) antes do laço e passe-o ao gerador"' },
          { name: 'mesma seed, mesmo resultado', hidden: true, code: 'g = listas(inteiros(-50, 50))\n\ndef p(xs):\n    return sum(xs) < 60\n\nprimeiro = for_all(g, p, seed=3)\nassert primeiro is not None and primeiro == for_all(g, p, seed=3)' },
        ],
        reviews: [
          {
            when: (m, code) => /\brandom\.(seed|randint|random|choice|choices|shuffle|uniform|randrange|sample)\s*\(/.test(code),
            text: 'Você chamou funções do módulo `random` direto (`random.seed`, `random.randint`…). Elas usam um gerador **global**, compartilhado com o programa inteiro e com outros testes — a reprodutibilidade vai embora. Crie uma instância própria: `rng = random.Random(seed)`.',
            concept: 'Geradores com seed',
          },
          {
            when: m => m.bareExcepts > 0,
            text: '`except:` sem tipo captura até `KeyboardInterrupt` e `SystemExit` — você não conseguiria nem interromper uma propriedade travada. Para "qualquer falha da propriedade", use `except Exception:`.',
            concept: 'Tratamento de exceções',
          },
        ],
        hints: [
          'Em `falha`, envolva a chamada num `try`: `return propriedade(valor) is False` e, no `except Exception:`, `return True`.',
          'Por que `is False` e não `not ...`? Uma propriedade só com `assert` devolve `None` — e `not None` é `True`, o que a faria "falhar" sempre.',
          'Em `for_all`: `rng = random.Random(seed)` **antes** do laço; dentro dele, `valor = gerador(rng)` e, se `falha(propriedade, valor)`, `return valor`. Depois do laço, `return None`.',
        ],
        solution: `import random


${FALHA}

def for_all(gerador, propriedade, runs=100, seed=0):
    """Roda a propriedade em até runs valores gerados; devolve o 1º contraexemplo ou None."""
    rng = random.Random(seed)
    for _ in range(runs):
        valor = gerador(rng)
        if falha(propriedade, valor):
            return valor
    return None


# ── geradores prontos ──

${GERADORES}`,
        solutionExplanation: 'O `try/except Exception` transforma qualquer exceção em falha — é assim que o Hypothesis trata os `assert` dentro da propriedade. O `is False` evita o erro clássico de tratar `None` como falha. E o `random.Random(seed)` é criado **uma única vez**: a sequência inteira de entradas fica determinada pela seed, então a mesma falha se repete em qualquer máquina (recriá-lo dentro do laço geraria o mesmo valor em todas as rodadas).',
      },
      {
        type: 'code',
        id: 'tst-pbt-q4',
        concept: 'Shrinking',
        title: 'Shrinking: do contraexemplo ao mínimo',
        say: 'Agora a parte mágica: fazer o contraexemplo **encolher**. O `for_all` do desafio anterior já está no código — falta o shrinking.',
        prompt: `Implemente o shrinking para **inteiros** e **listas de inteiros**.

**\`candidatos(valor)\`** devolve uma lista de valores "menores":
- inteiro \`n\`: \`[]\` se \`n == 0\`; senão \`0\`, a metade em direção a zero (\`int(n / 2)\`) e um passo em direção a zero (\`n - 1\` se positivo, \`n + 1\` se negativo);
- lista \`xs\`: \`[]\` se vazia; senão, nesta ordem: a lista vazia, as duas metades (só com 2+ elementos), a lista **sem** cada elemento e a lista com **cada elemento** trocado por cada um dos candidatos dele;
- qualquer outro tipo: \`[]\`.

**\`encolher(valor, falha_em)\`**: enquanto algum candidato ainda falhar (\`falha_em(c)\` é \`True\`), troque \`valor\` pelo **primeiro** que falhar e recomece; quando nenhum falhar, devolva \`valor\`.

Por fim, faça o **\`for_all\`** devolver o contraexemplo **encolhido**.

\`\`\`python
>>> encolher(1000, lambda n: n >= 10)
10
>>> encolher([5, 3, 99, 1, 42], lambda xs: any(x > 40 for x in xs))
[41]
\`\`\``,
        starter: `import random


${FALHA}

def candidatos(valor):
    """Valores "menores" que valor, dos mais agressivos aos mais sutis."""
    return []  # TODO


def encolher(valor, falha_em):
    """Troca valor pelo 1º candidato que ainda falha, até nenhum falhar."""
    return valor  # TODO


def for_all(gerador, propriedade, runs=100, seed=0):
    rng = random.Random(seed)
    for _ in range(runs):
        valor = gerador(rng)
        if falha(propriedade, valor):
            return valor  # TODO: devolva o contraexemplo encolhido
    return None


# ── geradores prontos ──

${GERADORES}`,
        tests: [
          { name: 'candidatos(0) == []', expr: 'candidatos(0)', expected: '[]' },
          { name: 'candidatos(10)', expr: 'set(candidatos(10))', expected: '{0, 5, 9}' },
          { name: 'candidatos(-7) vão em direção a zero', expr: 'set(candidatos(-7))', expected: '{0, -3, -6}' },
          { name: 'candidatos([]) == []', expr: 'candidatos([])', expected: '[]' },
          { name: 'candidatos([4, 1])', code: 'c = candidatos([4, 1])\nfor esperado in ([], [4], [1], [2, 1], [3, 1], [0, 1], [4, 0]):\n    assert esperado in c, f"faltou o candidato {esperado}"\nassert [4, 1] not in c, "o próprio valor não pode ser candidato (loop infinito!)"' },
          { name: 'encolher(1000, n >= 10) == 10', expr: 'encolher(1000, lambda n: n >= 10)', expected: '10' },
          { name: 'encolher(-37, n < -5) == -6', expr: 'encolher(-37, lambda n: n < -5)', expected: '-6' },
          { name: 'encolher lista: algum elemento > 40', expr: 'encolher([5, 3, 99, 1, 42], lambda xs: any(x > 40 for x in xs))', expected: '[41]' },
          { name: 'encolher lista: soma > 100', code: 'r = encolher([60, 70, 80], lambda xs: sum(xs) > 100)\nassert sum(r) == 101, f"{r} ainda pode encolher: a menor soma que falha é 101"' },
          { name: 'for_all devolve o contraexemplo encolhido', code: 'r = for_all(listas(inteiros(-10, 100)), lambda xs: sum(xs) < 50, seed=1)\nassert r is not None and sum(r) == 50 and all(x > 0 for x in r), f"{r} não está encolhido"' },
          { name: 'for_all sem contraexemplo → None', expr: 'for_all(listas(inteiros(0, 9)), lambda xs: len(xs) <= 8)', expected: 'None' },
          { name: 'duplicatas encolhem para 2 elementos iguais', hidden: true, code: 'r = encolher([7, 2, 7, 9], lambda xs: len(set(xs)) < len(xs))\nassert len(r) == 2 and r[0] == r[1], f"veio {r}"' },
          { name: 'nenhum candidato falha → devolve o próprio valor', hidden: true, expr: 'encolher([3, 3], lambda xs: xs == [3, 3])', expected: '[3, 3]' },
          { name: 'lista de 1 elemento não gera a si mesma', hidden: true, code: 'c = candidatos([5])\nassert [5] not in c and [] in c' },
          { name: 'o shrinking usa falha(): assert na propriedade', hidden: true, code: 'def sem_sete(xs):\n    assert 7 not in xs\n\nr = for_all(listas(inteiros(0, 9)), sem_sete)\nassert r == [7], f"veio {r!r}"' },
        ],
        reviews: [
          {
            when: (m, code) => !/\/\/?\s*2\b/.test(code),
            text: 'Seus candidatos não cortam nada **pela metade**. Funciona, mas encolher 1.000.000 de um em um leva um milhão de passos; tentando metades primeiro (`int(n / 2)`, `xs[:len(xs) // 2]`), o shrinking converge em cerca de log₂ n passos.',
            concept: 'Shrinking eficiente',
          },
          {
            when: m => (m.recursive || []).includes('encolher'),
            text: 'Seu `encolher` é recursivo: cada passo empilha uma chamada. Com contraexemplos grandes, isso estoura o limite de recursão do Python (~1000). Um `while True` com `for ... else` faz o mesmo sem pilha.',
            concept: 'Recursão × laço',
          },
        ],
        hints: [
          'Inteiros: `if valor == 0: return []` e depois `return [0, int(valor / 2), valor - 1 if valor > 0 else valor + 1]`. Use `isinstance(valor, int)` e `isinstance(valor, list)` para separar os casos.',
          'Listas: comece com `menores = [[]]`; se `len(xs) > 1`, some as metades `xs[:meio]` e `xs[meio:]`; depois `xs[:i] + xs[i + 1:]` para cada `i` e `xs[:i] + [c] + xs[i + 1:]` para cada `c` em `candidatos(xs[i])`.',
          '`encolher` cabe num `while True` com um `for ... else`: se `falha_em(c)`, faça `valor = c` e `break`; o `else` do `for` (ninguém falhou) faz `return valor`. No `for_all`: `return encolher(valor, lambda v: falha(propriedade, v))`.',
        ],
        solution: `import random


${FALHA}

def candidatos(valor):
    """Valores "menores" que valor, dos mais agressivos aos mais sutis."""
    if isinstance(valor, int):
        if valor == 0:
            return []
        return [0, int(valor / 2), valor - 1 if valor > 0 else valor + 1]
    if isinstance(valor, list):
        if not valor:
            return []
        menores = [[]]
        if len(valor) > 1:
            meio = len(valor) // 2
            menores += [valor[:meio], valor[meio:]]
        menores += [valor[:i] + valor[i + 1:] for i in range(len(valor))]
        for i, x in enumerate(valor):
            menores += [valor[:i] + [c] + valor[i + 1:] for c in candidatos(x)]
        return menores
    return []


def encolher(valor, falha_em):
    """Troca valor pelo 1º candidato que ainda falha, até nenhum falhar."""
    while True:
        for c in candidatos(valor):
            if falha_em(c):
                valor = c
                break
        else:
            return valor


def for_all(gerador, propriedade, runs=100, seed=0):
    rng = random.Random(seed)
    for _ in range(runs):
        valor = gerador(rng)
        if falha(propriedade, valor):
            return encolher(valor, lambda v: falha(propriedade, v))
    return None


# ── geradores prontos ──

${GERADORES}`,
        solutionExplanation: 'O shrinking é uma **busca gulosa**: a cada passo, fica com o primeiro candidato menor que ainda falha. Tentar primeiro os candidatos agressivos (lista vazia, metades, `0`) faz a busca convergir rápido; os sutis (tirar um elemento, dar um passo em direção a zero) fazem o ajuste fino. A busca sempre termina, porque cada troca diminui o tamanho da lista ou a distância dos números até zero. E o `for_all` encolhe usando o mesmo `falha()`: uma exceção durante o shrinking também conta como falha.',
      },
      {
        type: 'pytest',
        id: 'tst-pbt-q5',
        concept: 'Property-based testing',
        title: 'RLE: testes de propriedade de verdade',
        module: 'rle',
        say: 'Agora, testes de propriedade num código de verdade. Os bugs que plantei aqui **passam** em testes de exemplo comuns — só propriedades pegam.',
        prompt: `O arquivo \`rle.py\` tem um compressor *run-length* (\`comprimir\`/\`descomprimir\`) e, no fim, um mini-framework pronto: \`for_all(gerador, propriedade)\`, **com shrinking**, e o gerador \`textos\`.

Escreva **testes de propriedade** usando \`for_all\`. O padrão é:

\`\`\`python
def test_alguma_propriedade():
    assert for_all(textos, lambda s: ...) is None   # None = nenhum contraexemplo
\`\`\`

Pense em **ida e volta** e nos **invariantes** do contrato da docstring. Se uma propriedade falhar, o pytest mostra o contraexemplo já encolhido. Pelo menos **3 testes**.`,
        implementation: RLE,
        starter: `from rle import comprimir, descomprimir, for_all, textos


def test_exemplo_documenta_o_formato():
    assert comprimir("aaabcc") == [("a", 3), ("b", 1), ("c", 2)]


def test_ida_e_volta():
    # descomprimir(comprimir(s)) deve devolver s — para QUALQUER texto
    ...
`,
        minTests: 3,
        mutants: [
          {
            name: 'texto vazio quebra com IndexError',
            code: mutR('    if not texto:\n        return []\n', ''),
            why: 'ninguém escreve `comprimir("")` à mão — mas o gerador produz textos vazios, e qualquer propriedade com `for_all` pega o `IndexError`.',
            concept: 'Casos de borda gerados',
          },
          {
            name: 'blocos limitados a 9 (formato legado de um dígito)',
            code: mutR('        if ch == atual:', '        if ch == atual and n < 9:'),
            why: 'a **ida e volta** continua funcionando (`[("a", 9), ("a", 1)]` volta a ser o texto); só o **contrato de forma canônica** — pares vizinhos com caracteres diferentes — pega esse bug.',
            concept: 'Invariantes',
          },
          {
            name: 'maiúsculas e minúsculas no mesmo bloco',
            code: mutR('        if ch == atual:', '        if ch.lower() == atual.lower():'),
            why: 'a **ida e volta** pega: `"aA"` vira `[("a", 2)]`, que volta como `"aa"`.',
            concept: 'Propriedade de ida e volta',
          },
          {
            name: 'espaços nas pontas descartados',
            code: mutR('    if not texto:', '    texto = texto.strip()\n    if not texto:'),
            why: 'a **ida e volta** (ou a soma das contagens) pega: `" "` comprime para `[]`.',
            concept: 'Propriedade de ida e volta',
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('for_all'),
            text: 'Seus testes não usam `for_all`: eles verificam só os exemplos que você escolheu. Os bugs daqui moram em entradas que ninguém escreve à mão — texto vazio, blocos com 10+ letras iguais, `"aA"`, espaços nas pontas.',
            concept: 'Property-based testing',
          },
          {
            when: m => !m.calls.includes('descomprimir'),
            text: 'Faltou a propriedade de **ida e volta**: `descomprimir(comprimir(s)) == s`. Para codificadores e serializadores, ela é a primeira a escrever.',
            concept: 'Propriedade de ida e volta',
          },
        ],
        hints: [
          'Ida e volta: `assert for_all(textos, lambda s: descomprimir(comprimir(s)) == s) is None`.',
          'Só ida e volta não basta: um compressor que quebra blocos (`[("a", 9), ("a", 1)]`) ainda volta ao texto original. Verifique o contrato — pares vizinhos com caracteres **diferentes** e contagens `>= 1`.',
          'Outro invariante barato: a soma das contagens é o tamanho do texto — `sum(n for _, n in comprimir(s)) == len(s)`.',
        ],
        solution: `from rle import comprimir, descomprimir, for_all, textos


def test_exemplo_documenta_o_formato():
    assert comprimir("aaabcc") == [("a", 3), ("b", 1), ("c", 2)]


def test_ida_e_volta():
    assert for_all(textos, lambda s: descomprimir(comprimir(s)) == s) is None


def test_contagens_somam_o_tamanho_do_texto():
    assert for_all(textos, lambda s: sum(n for _, n in comprimir(s)) == len(s)) is None


def test_forma_canonica():
    def canonica(s):
        pares = comprimir(s)
        vizinhos_diferentes = all(a[0] != b[0] for a, b in zip(pares, pares[1:]))
        return vizinhos_diferentes and all(n >= 1 for _, n in pares)

    assert for_all(textos, canonica) is None
`,
        solutionExplanation: 'Cada propriedade pega um tipo de bug: a **ida e volta** pega a comparação que ignora maiúsculas (`"aA"` vira `"aa"`) e o `strip()` escondido; o **contrato de forma canônica** pega o limite de 9 por bloco, que ainda faz ida e volta; e todas pegam o texto vazio, que derruba a versão sem a guarda. O teste de exemplo continua útil: ele **documenta** o formato. Repare como o shrinking entrega contraexemplos legíveis, como `"aA"`, `" "` ou dez letras iguais.',
      },
      {
        type: 'open',
        id: 'tst-pbt-q6',
        concept: 'Metamorphic testing',
        say: 'Última, como numa entrevista de sênior.',
        prompt: 'Você precisa testar `rota_mais_curta(mapa, origem, destino)`, que devolve a rota e a distância num mapa de estradas com milhares de cruzamentos — e ninguém sabe a resposta certa para mapas desse tamanho. **Como você testaria essa função com propriedades?** Cite propriedades concretas e diga como tornaria as falhas fáceis de reproduzir e depurar.',
        minWords: 30,
        rubric: [
          { label: 'Propõe **relações metamórficas** (ex.: adicionar uma estrada não aumenta a distância; trocar origem e destino)', keywords: ['metamorf', 'adicionar uma estrada', 'adicionar estrada', 'nova estrada', 'adicionar uma aresta', 'nova aresta', 'nunca aumenta', 'nao aumenta', 'trocar origem', 'inverter origem', 'simetri'], concept: 'Metamorphic testing' },
          { label: 'Verifica **invariantes** fáceis de checar na resposta (caminho válido, começa na origem, termina no destino, distância = soma)', keywords: ['invariant', 'caminho valido', 'rota valida', 'comeca na origem', 'termina no destino', 'soma das', 'soma dos', 'estradas existem', 'arestas existem', 'facil de verificar', 'faceis de verificar', 'conferir a rota', 'verificar a rota'], concept: 'Propriedades fáceis de verificar' },
          { label: 'Usa um **oráculo** em entradas pequenas (força bruta ou implementação simples de referência)', keywords: ['oraculo', 'forca bruta', 'brute', 'referencia', 'implementacao simples', 'mapas pequenos', 'grafos pequenos', 'todos os caminhos', 'todas as rotas'], concept: 'Oráculo de teste' },
          { label: 'Garante **reprodutibilidade e depuração**: seed fixa/registrada e shrinking para o menor mapa que falha', keywords: ['seed', 'semente', 'reprodu', 'shrink', 'encolh', 'menor mapa', 'contraexemplo minimo'], concept: 'Seeds e shrinking', why: 'Uma falha aleatória que não se repete, ou um contraexemplo com mil cruzamentos, quase não ajuda a achar o bug.' },
        ],
        modelAnswer: `Como não sei a distância certa para mapas grandes, eu não verificaria uma saída exata — usaria **propriedades**.

Primeiro, invariantes fáceis de verificar na própria resposta: a rota devolvida é um **caminho válido** (todas as estradas existem), começa na origem, termina no destino, e a distância informada é a **soma das** estradas da rota.

Depois, **relações metamórficas**: adicionar uma estrada nova nunca aumenta a distância; trocar origem e destino (num mapa de mão dupla) dá a mesma distância; multiplicar todos os pesos por 2 dobra a distância.

Para mapas pequenos, uso um **oráculo**: uma força bruta que testa todos os caminhos — lenta, mas obviamente correta — e comparo as distâncias.

Por fim, gero os mapas com um \`random.Random(seed)\` e registro a **seed** para reproduzir qualquer falha, e faço **shrinking** para chegar ao menor mapa que ainda falha, o que deixa o bug fácil de depurar.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Você saiu dos exemplos para as **regras**: ida e volta, invariantes, idempotência, oráculos e relações metamórficas.',
          'E construiu o motor por trás de tudo: geradores com **seed**, `for_all` e **shrinking**. No trabalho, use o Hypothesis — agora você sabe exatamente o que ele faz por baixo.',
        ],
        board: null,
      },
    ],
  });
})();
