Game.registerModule('design-patterns', {
  id: 'memento',
  title: 'Memento',
  kind: 'lesson',
  level: 2,
  order: 38,
  unit: 'comportamentais',
  summary: 'Fotografar o estado de um objeto sem abrir suas entranhas — e voltar no tempo com desfazer, refazer e snapshots que cabem na memória.',
  concepts: ['Memento', 'Originator e Caretaker', 'Desfazer/refazer', 'Memento imutável', 'Snapshot incremental'],
  takeaways: [
    'Memento captura o estado de um objeto **sem violar o encapsulamento**: só o próprio objeto (o *originator*) sabe tirar a foto e restaurá-la; o *caretaker* apenas guarda.',
    'Mementos devem ser **imutáveis** e **independentes**: copie estruturas mutáveis ao salvar **e** ao restaurar — `frozen=True` congela o atributo, não a lista para a qual ele aponta.',
    'Desfazer por **snapshot** é simples e robusto; por **comando** economiza memória, mas exige um inverso correto para cada operação. Uma ação nova depois de desfazer **limpa o refazer**.',
    'Snapshot custa memória: limite o histórico (`deque(maxlen=N)`), guarde só o que mudou (**deltas**) e intercale *keyframes* completos para limitar o custo de reconstrução.',
  ],
  glossary: [
    { term: 'Originator', aliases: ['originators', 'originador', 'originadores'], definition: 'No Memento, o objeto dono do estado: cria mementos de si mesmo (`salvar()`) e sabe se restaurar a partir deles (`restaurar(m)`). É o único que lê o conteúdo da foto.' },
    { term: 'Caretaker', aliases: ['caretakers', 'zelador'], definition: 'No Memento, quem **guarda** os mementos (histórico, pilha de desfazer) e decide quando restaurar — sem nunca olhar dentro deles.' },
    { term: 'Interface estreita', aliases: ['interface larga', 'narrow interface', 'wide interface'], definition: 'Ideia do GoF para o Memento: o caretaker enxerga uma interface **estreita** (só guardar e devolver); o originator, uma **larga** (ler e escrever o estado). Em C++ o livro usava `friend`; em Python, é convenção e disciplina.' },
    { term: 'Delta reverso', aliases: ['deltas reversos', 'reverse delta', 'reverse deltas', 'before-image'], definition: 'Registro só do que mudou, com os valores **de antes**: aplicado sobre a versão nova, reconstrói a anterior. É como o RCS guarda versões antigas e como bancos de dados montam seus *undo logs*.' },
    { term: 'Keyframe', aliases: ['keyframes', 'quadro-chave', 'quadros-chave', 'I-frame'], definition: 'Snapshot **completo** gravado de tempos em tempos no meio de uma série de deltas, para limitar quanto é preciso reaplicar ao reconstruir um estado — a mesma ideia dos codecs de vídeo.' },
    { term: 'Undo tree', aliases: ['undo trees', 'árvore de desfazer', 'undo branches'], definition: 'Histórico em **árvore**: desfazer e fazer outra coisa cria um galho novo em vez de descartar o refazer. O Vim tem isso desde a versão 7.0 (`g-`, `g+`, `:earlier 10m`).' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Hoje é dia de **Memento**: o padrão por trás do Ctrl+Z, dos saves de videogame e dos rascunhos que sobrevivem ao F5.',
        'O desafio não é guardar o estado. É guardar **sem arrombar** o objeto.',
      ],
      board: {
        title: 'O problema: desfazer sem arrombar o objeto',
        md: `\`\`\`python
class Editor:
    def __init__(self):
        self._texto = ""
        self._cursor = 0
        self._selecao = None
        self._cache_render = {}          # derivado: não é estado "de verdade"
        self._observadores = []          # nem isto


# tentativa 1: o histórico lê as entranhas do editor
historico.append((editor._texto, editor._cursor))
#   …e esqueceu a _selecao. Cada campo novo quebra o desfazer em silêncio.

# tentativa 2: fotografar o objeto inteiro
historico.append(copy.deepcopy(editor))
#   …copia cache, observadores, conexões. Caro e, às vezes, impossível.
\`\`\`

**Intenção (GoF):** sem violar o encapsulamento, **capturar e externalizar** o estado interno de um objeto para que ele possa ser **restaurado** depois.

Onde aparece: desfazer em editores, *save states* de jogos, rascunhos de formulário, \`SAVEPOINT\`/\`ROLLBACK TO\` em bancos de dados e o "desfazer" otimista de interfaces.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'São três papéis. O **originator** tira a foto de si mesmo e sabe voltar a ela.',
        'O **caretaker** guarda as fotos — e nunca olha dentro. A foto em si é o **memento**.',
      ],
      board: {
        title: 'Os três papéis',
        md: `\`\`\`python
from dataclasses import dataclass


@dataclass(frozen=True)
class EditorMemento:                     # a foto: imutável
    texto: str
    cursor: int


class Editor:                            # originator
    def __init__(self):
        self._texto = ""
        self._cursor = 0

    def digitar(self, s):
        self._texto = self._texto[:self._cursor] + s + self._texto[self._cursor:]
        self._cursor += len(s)

    def salvar(self):
        return EditorMemento(self._texto, self._cursor)

    def restaurar(self, m):
        self._texto, self._cursor = m.texto, m.cursor


class Historico:                         # caretaker
    def __init__(self, editor):
        self._editor = editor
        self._pilha = []

    def checkpoint(self):                # chamado ANTES de cada mudança
        self._pilha.append(self._editor.salvar())

    def desfazer(self):
        if self._pilha:
            self._editor.restaurar(self._pilha.pop())
\`\`\`

\`\`\`text
 Historico (caretaker)                  Editor (originator)
   checkpoint() ───── salvar() ───────▶ cria EditorMemento(estado)
   guarda na pilha ◀──── memento ───────┘
   desfazer() ─────── restaurar(m) ───▶ lê m e volta no tempo
\`\`\`

O \`Historico\` nunca lê \`m.texto\`: se amanhã o editor ganhar \`_selecao\`, só \`salvar\` e \`restaurar\` mudam.

> [!sabia] O GoF descreve **duas interfaces** para o memento: uma **estreita**, para o caretaker (só guardar e devolver), e uma **larga**, para o originator (ler e escrever o estado). Em C++, o livro garantia isso com \`friend\`. Em Python não há como proibir de verdade — o \`_\` e um memento sem métodos úteis para terceiros são o contrato.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Agora a pegadinha mais comum: um memento que **muda sozinho** depois de salvo.',
        'O culpado é o velho *aliasing*: a foto e o objeto apontando para a mesma lista.',
      ],
      board: {
        title: 'Memento imutável — e cópia na hora certa',
        md: `\`\`\`python
@dataclass(frozen=True)
class Memento:
    itens: list                          # ⚠ frozen congela o ATRIBUTO, não a lista


class Carrinho:
    def __init__(self):
        self._itens = []

    def adicionar(self, item):
        self._itens.append(item)

    def salvar(self):
        return Memento(self._itens)      # ⚠ a MESMA lista, não uma cópia

    def restaurar(self, m):
        self._itens = m.itens            # ⚠ e o carrinho passa a escrever na foto


c = Carrinho()
c.adicionar("livro")
m = c.salvar()
c.adicionar("caneca")                    # a "foto" também ganhou a caneca!
\`\`\`

A correção: **copie na fronteira**, nos dois sentidos, e prefira tipos imutáveis dentro do memento.

\`\`\`python
@dataclass(frozen=True)
class Memento:
    itens: tuple                         # imutável de verdade (e hashable)


class Carrinho:
    ...
    def salvar(self):
        return Memento(tuple(self._itens))    # cópia imutável na ida

    def restaurar(self, m):
        self._itens = list(m.itens)           # lista nova na volta
\`\`\`

- Estado com objetos mutáveis **aninhados**? Aí sim, \`copy.deepcopy\` — **só do estado**, nunca do originator inteiro.
- Python já tem um "protocolo de memento": \`__getstate__\`/\`__setstate__\`, usados por \`copy\` e \`pickle\`. O objeto decide o que entra na foto:

\`\`\`python
class Cliente:
    def __getstate__(self):
        estado = self.__dict__.copy()
        del estado["_conexao"]           # não dá para fotografar um socket
        return estado

    def __setstate__(self, estado):
        self.__dict__.update(estado)
        self._conexao = None             # reconecta sob demanda
\`\`\`

> [!dica] Um memento imutável pode ser **compartilhado** sem medo: o mesmo objeto serve à pilha de desfazer, à de refazer e até a outra parte do sistema. Ninguém consegue estragá-lo.`,
      },
    },
    {
      type: 'say',
      text: [
        'Existem dois jeitos de desfazer: voltar a uma **foto**, ou executar o **inverso** da última operação.',
        'Você já viu o segundo no Command. Vamos comparar — e montar o desfazer/refazer completo.',
      ],
      board: {
        title: 'Desfazer por snapshot × por comando',
        md: `| | Snapshot (Memento) | Inverso (Command) |
|---|---|---|
| Guarda | o estado **inteiro** (ou a parte relevante) | só a operação e seus parâmetros |
| Memória | alta, cresce com o tamanho do estado | baixa |
| Correção | trivial: restaurar é copiar de volta | cada operação precisa de um inverso **correto** |
| Operação sem inverso fácil (filtro de imagem, ordenar) | funciona igual | precisa guardar o "antes" — um memento! |
| Risco | estourar a memória | inversos que "quase" desfazem acumulam erro |

Na prática, é comum o **híbrido**: cada comando guarda um memento só do pedaço que vai tocar.

\`\`\`python
class Historico:
    def __init__(self, originador):
        self._orig = originador
        self._desfazer, self._refazer = [], []

    def checkpoint(self):                 # antes de cada ação do usuário
        self._desfazer.append(self._orig.salvar())
        self._refazer.clear()             # ação nova: o "futuro alternativo" morre

    def desfazer(self):
        if not self._desfazer:
            return False
        self._refazer.append(self._orig.salvar())     # o presente vira "refazer"
        self._orig.restaurar(self._desfazer.pop())
        return True
\`\`\`

O \`refazer\` é o espelho: salva o presente em \`_desfazer\` e restaura do \`_refazer\`.

> [!sabia] Por que uma ação nova apaga o refazer? Porque o histórico é uma **pilha** — mas não precisa ser. O Vim guarda uma **undo tree** desde a versão 7.0: desfazer e digitar outra coisa cria um galho, e nada se perde. Dá para navegar por ela com \`g-\`/\`g+\` e até viajar no tempo com \`:earlier 10m\`.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Toda foto tem preço. Um documento de 20 MB com 200 níveis de desfazer são **4 GB** de mementos.',
        'A saída é guardar menos: limitar o histórico e fotografar só o que **mudou**.',
      ],
      board: {
        title: 'Quanto custa uma foto? Memória e snapshots incrementais',
        md: `| Técnica | Ideia | Custo |
|---|---|---|
| **Limitar o histórico** | \`deque(maxlen=100)\` descarta o mais antigo sozinho | perde o passado distante |
| **Delta (incremental)** | guarda só o que mudou, com o valor **de antes** | reconstruir exige reaplicar deltas |
| **Keyframes + deltas** | uma foto completa a cada *K* versões, deltas no meio | reconstrução limitada a *K* passos |
| **Compartilhamento estrutural** | estruturas imutáveis: a versão nova reaproveita as partes que não mudaram | exige estruturas persistentes |
| **Descarregar** | mementos antigos comprimidos ou em disco | demora para voltar muito |

Keyframes são o truque dos codecs de vídeo: um quadro completo de tempos em tempos e, entre eles, só as diferenças.

\`\`\`python
AUSENTE = object()                       # "a chave não existia"


def delta_reverso(antes, depois):
    """O mínimo para voltar de \`depois\` para \`antes\`."""
    d = {k: v for k, v in antes.items() if depois.get(k, AUSENTE) != v}
    d.update({k: AUSENTE for k in depois.keys() - antes.keys()})
    return d


antes = {"titulo": "Rascunho", "tags": ("a",), "autor": "Lia"}
depois = {"titulo": "Final", "tags": ("a",), "autor": "Lia", "revisor": "Bia"}
delta_reverso(antes, depois)             # {'titulo': 'Rascunho', 'revisor': AUSENTE}
\`\`\`

Por que \`AUSENTE\` e não \`None\`? Porque \`None\` pode ser um valor legítimo — e "valia \`None\`" é diferente de "não existia".

> [!sabia] Ao contrário do que muita gente pensa, o **Git guarda snapshots**, não diffs: cada commit aponta para a árvore completa do projeto. Deltas só aparecem ao compactar os *packfiles* — e aí, em geral, a versão **mais nova** fica inteira e as antigas viram deltas, porque é a nova que você mais acessa. O RCS, de 1982, já guardava a última revisão completa e as anteriores como **deltas reversos**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Aliasing, papéis, um histórico com desfazer/refazer e versões por deltas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-mem-q1',
      concept: 'Memento imutável',
      say: 'Primeira: o memento que mudou sozinho.',
      prompt: `O que o \`print\` mostra?

\`\`\`python
from dataclasses import dataclass


@dataclass(frozen=True)
class Memento:
    itens: list


class Lista:
    def __init__(self):
        self.itens = []

    def salvar(self):
        return Memento(self.itens)

    def restaurar(self, m):
        self.itens = m.itens


lista = Lista()
lista.itens.append("a")
m = lista.salvar()
lista.itens.append("b")
lista.restaurar(m)
print(lista.itens)
\`\`\``,
      options: [
        { text: "`['a']`", why: 'Seria o esperado se `salvar` guardasse uma **cópia** (`tuple(self.itens)`). Aqui o memento aponta para a mesma lista, que continuou crescendo.' },
        { text: "`['a', 'b']`", correct: true, why: '`Memento(self.itens)` guarda uma referência para a **mesma** lista. O `append("b")` altera a lista para a qual a "foto" também aponta, e o restaurar devolve exatamente isso.' },
        { text: '`FrozenInstanceError` no `append("b")`', why: '`frozen=True` só impede **reatribuir** o campo (`m.itens = ...`). Mutar a lista para a qual ele aponta é permitido — e o `append` nem passa pelo memento.' },
        { text: '`[]`', why: 'Nada esvazia a lista: o `"a"` foi adicionado antes do `salvar` e continua lá.' },
      ],
      explanation: 'É **aliasing**: o memento e o originator compartilham a mesma lista, então a "foto" muda junto com o objeto. `frozen=True` é um congelamento **raso** — protege o campo, não o conteúdo. A correção é copiar na fronteira, nos dois sentidos: `Memento(tuple(self.itens))` ao salvar (a tupla ainda torna o memento imutável e hashable) e `self.itens = list(m.itens)` ao restaurar — senão a próxima alteração do objeto corrompe a foto guardada.',
    },
    {
      type: 'match',
      id: 'dp-mem-q2',
      concept: 'Originator e Caretaker',
      say: 'Agora, cada peça no seu lugar.',
      prompt: 'Associe cada **peça** à sua responsabilidade.',
      pairs: [
        { left: 'Originator', right: 'Tira a foto de si mesmo e sabe restaurá-la' },
        { left: 'Memento', right: 'A foto: imutável e opaca para quem não a criou' },
        { left: 'Caretaker', right: 'Guarda as fotos e decide quando voltar, sem olhar dentro' },
        { left: 'Pilha de refazer', right: 'Esvaziada quando o usuário faz uma ação nova' },
        { left: 'Delta reverso', right: 'Só o que mudou, com os valores de antes' },
      ],
      explanation: 'O **originator** é o único que conhece o próprio estado: cria e consome mementos. O **memento** é a foto — imutável, para não mudar depois de tirada. O **caretaker** (o histórico) só guarda e devolve: é isso que preserva o encapsulamento. O **refazer** perde o sentido quando o usuário segue por outro caminho (a não ser numa *undo tree*). E o **delta reverso** é o memento econômico: guarda só a diferença.',
    },
    {
      type: 'code',
      id: 'dp-mem-q3',
      concept: 'Desfazer/refazer',
      title: 'Desenho com desfazer e refazer',
      say: 'Hora de codar! Um editor de desenho precisa de Ctrl+Z e Ctrl+Y — com mementos de verdade.',
      prompt: `Complete o **originator** \`Desenho\` e o **caretaker** \`Historico\`. O \`Memento\` já está pronto (imutável).

**\`Desenho\`**
- \`salvar()\` devolve um \`Memento\` com as formas (como **tupla**) e a cor atual.
- \`restaurar(m)\` volta ao estado do memento — e o desenho continua editável **sem** alterar o memento.

**\`Historico(desenho, limite=None)\`**
- \`salvar()\` guarda um memento do estado atual. É chamado **antes** de cada ação do usuário e **descarta o refazer**.
- \`desfazer()\` volta ao último estado salvo e devolve \`True\`; sem nada para desfazer, devolve \`False\` e não muda nada.
- \`refazer()\` reaplica o que foi desfeito (\`True\`/\`False\`, como acima).
- Com \`limite=N\`, só os **N** snapshots mais recentes ficam guardados para desfazer.
- O \`Historico\` só guarda e devolve mementos: não mexe em \`_formas\` nem em \`_cor\`.

\`\`\`python
d = Desenho()
h = Historico(d)
h.salvar(); d.adicionar("círculo")
h.salvar(); d.pintar("azul")
h.desfazer()    # True: volta a ('círculo',) em preto
h.refazer()     # True: ('círculo',) em azul de novo
\`\`\``,
      starter: `from collections import deque
from dataclasses import dataclass


@dataclass(frozen=True)
class Memento:
    formas: tuple
    cor: str


class Desenho:
    def __init__(self):
        self._formas = []
        self._cor = "preto"

    def adicionar(self, forma):
        self._formas.append(forma)

    def pintar(self, cor):
        self._cor = cor

    @property
    def formas(self):
        return tuple(self._formas)

    @property
    def cor(self):
        return self._cor

    def salvar(self):
        pass

    def restaurar(self, memento):
        pass


class Historico:
    def __init__(self, desenho, limite=None):
        self._desenho = desenho

    def salvar(self):
        pass

    def desfazer(self):
        pass

    def refazer(self):
        pass
`,
      tests: [
        {
          name: 'desfazer volta ao último salvo',
          code: `d = Desenho()
h = Historico(d)
h.salvar(); d.adicionar("círculo")
h.salvar(); d.adicionar("quadrado")
assert h.desfazer() is True
assert d.formas == ("círculo",), d.formas
assert h.desfazer() is True and d.formas == (), d.formas`,
        },
        {
          name: 'refazer',
          code: `d = Desenho()
h = Historico(d)
h.salvar(); d.adicionar("círculo")
h.salvar(); d.pintar("azul")
h.desfazer()
assert (d.formas, d.cor) == (("círculo",), "preto"), (d.formas, d.cor)
assert h.refazer() is True
assert (d.formas, d.cor) == (("círculo",), "azul"), (d.formas, d.cor)`,
        },
        {
          name: 'nada para desfazer ou refazer',
          code: `d = Desenho()
d.adicionar("x")
h = Historico(d)
assert h.desfazer() is False and h.refazer() is False
assert d.formas == ("x",), d.formas`,
        },
        {
          name: 'ação nova descarta o refazer',
          code: `d = Desenho()
h = Historico(d)
h.salvar(); d.adicionar("a")
h.desfazer()
h.salvar(); d.adicionar("b")
assert h.refazer() is False, "depois de uma ação nova, não há o que refazer"
assert d.formas == ("b",), d.formas`,
        },
        {
          name: 'memento imutável e independente',
          code: `d = Desenho()
d.adicionar("a")
m = d.salvar()
d.adicionar("b"); d.pintar("verde")
assert isinstance(m.formas, tuple), "guarde as formas como tupla"
assert (m.formas, m.cor) == (("a",), "preto"), (m.formas, m.cor)
hash(m)`,
        },
        {
          name: 'restaurar não liga o desenho ao memento',
          hidden: true,
          code: `d = Desenho()
d.adicionar("a")
m = d.salvar()
d.restaurar(m)
d.adicionar("b")
assert m.formas == ("a",) and d.formas == ("a", "b"), (m.formas, d.formas)`,
        },
        {
          name: 'limite de snapshots',
          hidden: true,
          code: `d = Desenho()
h = Historico(d, limite=2)
for forma in "abc":
    h.salvar(); d.adicionar(forma)
assert h.desfazer() and d.formas == ("a", "b"), d.formas
assert h.desfazer() and d.formas == ("a",), d.formas
assert h.desfazer() is False and d.formas == ("a",), "com limite=2, só 2 passos podem ser desfeitos"`,
        },
        {
          name: 'desfazer e refazer até o fim',
          hidden: true,
          code: `d = Desenho()
h = Historico(d)
for forma in ("a", "b", "c"):
    h.salvar(); d.adicionar(forma)
while h.desfazer():
    pass
assert d.formas == (), d.formas
while h.refazer():
    pass
assert d.formas == ("a", "b", "c"), d.formas`,
        },
        {
          name: 'históricos independentes',
          hidden: true,
          code: `d1, d2 = Desenho(), Desenho()
h1, h2 = Historico(d1), Historico(d2)
h1.salvar(); d1.adicionar("x")
assert h2.desfazer() is False and d1.formas == ("x",)`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /\b(?!self\b)\w+\._(formas|cor)\b/.test(code),
          text: 'O `Historico` mexe nos atributos privados do `Desenho` (`._formas`/`._cor`). O Memento existe justamente para evitar isso: o caretaker só guarda e devolve fotos — quem lê e escreve o estado é o próprio originator.',
          concept: 'Encapsulamento',
        },
        {
          when: m => m.calls.includes('deepcopy'),
          text: 'Você usou `deepcopy`. Aqui as formas são strings (imutáveis), então `tuple(self._formas)` já é uma cópia segura e bem mais barata. `deepcopy` só se justifica com objetos mutáveis **aninhados** — e nunca do originator inteiro.',
          concept: 'Memento imutável',
        },
        {
          when: (m, code) => /\.pop\(\s*0\s*\)/.test(code),
          text: 'Para descartar o snapshot mais antigo, `lista.pop(0)` custa O(n). `deque(maxlen=N)` faz isso sozinho, em O(1).',
          concept: 'Custo de memória',
        },
      ],
      hints: [
        '`salvar` do `Desenho`: `return Memento(tuple(self._formas), self._cor)`. Em `restaurar`, crie uma **lista nova** a partir da tupla — assim o desenho volta a ser editável e o memento fica intacto.',
        'O `Historico` tem duas pilhas: desfazer e refazer. Para o limite, use `deque(maxlen=limite)` na de desfazer (`maxlen=None` significa sem limite).',
        'Em `desfazer`: pilha vazia → `return False`. Senão, empilhe o **presente** (`self._desenho.salvar()`) no refazer, restaure o `pop()` da pilha de desfazer e `return True`. O `refazer` é o espelho. E o `salvar` do histórico termina com `self._refazer.clear()`.',
      ],
      solution: `from collections import deque
from dataclasses import dataclass


@dataclass(frozen=True)
class Memento:
    formas: tuple
    cor: str


class Desenho:
    def __init__(self):
        self._formas = []
        self._cor = "preto"

    def adicionar(self, forma):
        self._formas.append(forma)

    def pintar(self, cor):
        self._cor = cor

    @property
    def formas(self):
        return tuple(self._formas)

    @property
    def cor(self):
        return self._cor

    def salvar(self):
        return Memento(tuple(self._formas), self._cor)

    def restaurar(self, memento):
        self._formas = list(memento.formas)
        self._cor = memento.cor


class Historico:
    def __init__(self, desenho, limite=None):
        self._desenho = desenho
        self._desfazer = deque(maxlen=limite)
        self._refazer = []

    def salvar(self):
        self._desfazer.append(self._desenho.salvar())
        self._refazer.clear()

    def desfazer(self):
        if not self._desfazer:
            return False
        self._refazer.append(self._desenho.salvar())
        self._desenho.restaurar(self._desfazer.pop())
        return True

    def refazer(self):
        if not self._refazer:
            return False
        self._desfazer.append(self._desenho.salvar())
        self._desenho.restaurar(self._refazer.pop())
        return True
`,
      solutionExplanation: 'O `Desenho` é o único que conhece `_formas` e `_cor`: ele monta o memento com uma **tupla** (cópia imutável na ida) e restaura criando uma **lista nova** (cópia na volta) — sem isso, a próxima edição corromperia a foto guardada. O `Historico` só empilha e desempilha mementos: se amanhã o desenho ganhar espessura de linha, só `salvar` e `restaurar` mudam. Desfazer e refazer são espelhos: antes de voltar, o **presente** vai para a outra pilha. Uma ação nova (`salvar`) limpa o refazer, porque aquele futuro deixou de existir. E o `deque(maxlen=limite)` controla a memória descartando o snapshot mais antigo em O(1).',
    },
    {
      type: 'code',
      id: 'dp-mem-q4',
      concept: 'Snapshot incremental',
      title: 'Versões com deltas reversos',
      say: 'Agora, o memento econômico: guardar só o que mudou — do jeito que o RCS fazia.',
      prompt: `A classe \`Versoes\` guarda o histórico de um dicionário (por exemplo, as configurações de um sistema). Em vez de uma cópia completa por versão, ela mantém **só a versão mais recente inteira** (\`_atual\`) e, para cada versão antiga, um **delta reverso** em \`_deltas\`: um dict com as chaves que mudaram e seus valores **de antes** — ou \`AUSENTE\`, se a chave não existia.

Implemente:

- \`registrar(novo)\` — recebe o dict **completo** da nova versão e guarda o delta reverso em relação à versão atual. Alterações posteriores no dict recebido não podem afetar o histórico.
- \`versao(i)\` — devolve um **dict novo** com a versão \`i\` (0 = a inicial; índices negativos contam do fim, como em listas; fora do intervalo → \`IndexError\`).

\`__len__\` e \`custo()\` já estão prontos: \`custo()\` conta as entradas guardadas (\`_atual\` + todos os deltas). Mudar 1 chave de 500 deve custar **1** entrada, não 500.

\`\`\`python
v = Versoes({"tema": "claro", "idioma": "pt"})
v.registrar({"tema": "escuro", "idioma": "pt"})                # delta: {"tema": "claro"}
v.registrar({"tema": "escuro", "idioma": "pt", "beta": True})  # delta: {"beta": AUSENTE}
v.versao(0)    # {'tema': 'claro', 'idioma': 'pt'}
v.custo()      # 3 (versão atual) + 1 + 1 = 5
\`\`\``,
      starter: `AUSENTE = object()   # marca "a chave não existia nesta versão"


class Versoes:
    def __init__(self, inicial):
        self._atual = dict(inicial)
        self._deltas = []   # _deltas[k] leva da versão k + 1 de volta à versão k

    def __len__(self):
        return len(self._deltas) + 1

    def custo(self):
        return len(self._atual) + sum(len(d) for d in self._deltas)

    def registrar(self, novo):
        pass

    def versao(self, i):
        pass
`,
      tests: [
        {
          name: 'exemplo do enunciado',
          code: `v = Versoes({"tema": "claro", "idioma": "pt"})
v.registrar({"tema": "escuro", "idioma": "pt"})
v.registrar({"tema": "escuro", "idioma": "pt", "beta": True})
assert len(v) == 3
assert v.versao(0) == {"tema": "claro", "idioma": "pt"}, v.versao(0)
assert v.versao(1) == {"tema": "escuro", "idioma": "pt"}, v.versao(1)
assert v.versao(2) == {"tema": "escuro", "idioma": "pt", "beta": True}, v.versao(2)
assert v.custo() == 5, f"custo = {v.custo()}, esperado 5"`,
        },
        {
          name: 'chave removida volta a existir',
          code: `v = Versoes({"a": 1, "b": 2})
v.registrar({"a": 1})
assert v.versao(0) == {"a": 1, "b": 2}, v.versao(0)
assert v.versao(1) == {"a": 1}, v.versao(1)`,
        },
        {
          name: 'índices negativos e fora do intervalo',
          code: `v = Versoes({"x": 0})
v.registrar({"x": 1})
assert v.versao(-1) == {"x": 1} and v.versao(-2) == {"x": 0}
for i in (2, -3):
    try:
        v.versao(i)
    except IndexError:
        pass
    else:
        raise AssertionError(f"versao({i}) deveria lançar IndexError")`,
        },
        {
          name: 'custo cresce só com o que muda',
          code: `base = {f"k{i}": 0 for i in range(500)}
v = Versoes(base)
estado = dict(base)
for passo in range(50):
    estado[f"k{passo}"] = passo + 1
    v.registrar(dict(estado))
assert len(v) == 51
assert v.custo() == 550, f"custo = {v.custo()}, esperado 550 (500 da versão atual + 1 por versão)"
assert v.versao(0) == base
assert v.versao(10)["k9"] == 10 and v.versao(10)["k10"] == 0`,
        },
        {
          name: 'registrar copia o dict recebido',
          code: `cfg = {"tema": "claro"}
v = Versoes(cfg)
cfg["tema"] = "escuro"
v.registrar(cfg)
cfg["tema"] = "sépia"
assert v.versao(0) == {"tema": "claro"} and v.versao(1) == {"tema": "escuro"}, (v.versao(0), v.versao(1))`,
        },
        {
          name: 'versao devolve um dict novo',
          hidden: true,
          code: `v = Versoes({"a": 1})
v.registrar({"a": 2})
v.versao(-1)["a"] = 99
v.versao(0)["a"] = 99
assert v.versao(1) == {"a": 2} and v.versao(0) == {"a": 1}, (v.versao(0), v.versao(1))`,
        },
        {
          name: 'None é valor, não ausência',
          hidden: true,
          code: `v = Versoes({"a": None})
v.registrar({})
v.registrar({"a": None, "b": None})
assert v.versao(0) == {"a": None}, v.versao(0)
assert v.versao(1) == {}, v.versao(1)
assert v.versao(2) == {"a": None, "b": None}, v.versao(2)`,
        },
        {
          name: 'versão sem mudanças não custa nada',
          hidden: true,
          code: `v = Versoes({"a": 1, "b": 2})
v.registrar({"a": 1, "b": 2})
assert len(v) == 2 and v.custo() == 2, (len(v), v.custo())
assert v.versao(0) == v.versao(1) == {"a": 1, "b": 2}`,
        },
        {
          name: 'muitas versões indo e voltando',
          hidden: true,
          code: `v = Versoes({})
esperado = [{}]
for i in range(1, 30):
    novo = {f"c{j}": i * j for j in range(i % 5)}
    v.registrar(novo)
    esperado.append(dict(novo))
for i, e in enumerate(esperado):
    assert v.versao(i) == e, (i, v.versao(i), e)`,
        },
      ],
      reviews: [
        {
          when: (m, code) => /self\._(?!atual\b|deltas\b)\w+\s*(=|\.append)/.test(code),
          text: 'Você guardou dados em atributos além de `_atual` e `_deltas`. Se forem cópias das versões, o `custo()` passa a mentir: a economia dos deltas só é real se o histórico **inteiro** mora ali.',
          concept: 'Snapshot incremental',
        },
      ],
      hints: [
        'Em `registrar`, compare `self._atual` com o novo dict: para cada chave antiga que sumiu ou mudou de valor, guarde o valor **antigo**; para cada chave que só existe no novo, guarde `AUSENTE`. Depois, `self._atual = dict(novo)`.',
        '`_deltas[k]` desfaz a passagem da versão `k` para `k + 1`. Para chegar à versão `i`, comece de uma **cópia** de `_atual` e aplique os deltas do mais novo para o mais velho, parando no `_deltas[i]` — ou seja, `reversed(self._deltas[i:])`.',
        'Ao aplicar um delta: valor `AUSENTE` → `del estado[chave]`; qualquer outro → `estado[chave] = valor`. Compare com `is AUSENTE`, nunca com `None`. Para índices negativos, some `len(self)` antes de validar o intervalo.',
      ],
      solution: `AUSENTE = object()   # marca "a chave não existia nesta versão"


class Versoes:
    def __init__(self, inicial):
        self._atual = dict(inicial)
        self._deltas = []   # _deltas[k] leva da versão k + 1 de volta à versão k

    def __len__(self):
        return len(self._deltas) + 1

    def custo(self):
        return len(self._atual) + sum(len(d) for d in self._deltas)

    def registrar(self, novo):
        novo = dict(novo)
        reverso = {}
        for chave, valor in self._atual.items():
            if chave not in novo or novo[chave] != valor:
                reverso[chave] = valor          # como era antes
        for chave in novo.keys() - self._atual.keys():
            reverso[chave] = AUSENTE            # não existia antes
        self._deltas.append(reverso)
        self._atual = novo

    def versao(self, i):
        n = len(self)
        if i < 0:
            i += n
        if not 0 <= i < n:
            raise IndexError(f"versão fora do intervalo 0..{n - 1}")
        estado = dict(self._atual)
        for reverso in reversed(self._deltas[i:]):
            for chave, valor in reverso.items():
                if valor is AUSENTE:
                    del estado[chave]
                else:
                    estado[chave] = valor
        return estado
`,
      solutionExplanation: 'Cada `registrar` guarda o **mínimo** para voltar um passo: as chaves que mudaram ou sumiram, com o valor de antes, e as chaves novas marcadas como `AUSENTE`. Por isso mudar 1 chave de 500 custa 1 entrada. O sentinela `AUSENTE = object()` é a peça-chave: ele distingue "a chave não existia" de "o valor era `None`". Para reconstruir, `versao` parte de uma **cópia** da versão mais recente e aplica os deltas de trás para a frente — é o esquema de **deltas reversos** do RCS e dos packfiles do Git, que deixa a versão mais acessada (a atual) instantânea. O preço aparece nas versões antigas: reconstruí-las custa um passo por delta. Se isso pesar, grave um **keyframe** completo a cada *K* versões.',
    },
    {
      type: 'open',
      id: 'dp-mem-q5',
      concept: 'Custo de memória',
      say: 'Para fechar, uma pergunta de design com cara de entrevista.',
      prompt: 'Você vai implementar o desfazer de um editor de imagens: cada camada tem até 50 MB e o usuário quer 100 níveis de desfazer. Guardar um snapshot completo antes de cada ação resolve? Como você desenharia esse histórico?',
      minWords: 30,
      rubric: [
        { label: 'Aponta o **custo de memória** do snapshot completo (gigabytes)', keywords: ['memoria', 'gb', 'giga', 'custo', 'caro', 'pesad', 'espaco', 'estour', '5000', '5 000', 'muito grande'], concept: 'Custo de memória', why: '100 snapshots de 50 MB são 5 GB só de histórico — por camada.' },
        { label: 'Guarda **só o que mudou**: deltas, regiões/blocos alterados, compartilhamento', keywords: ['increment', 'delta', 'diferenc', 'diff', 'so o que mudou', 'apenas o que mudou', 'somente o que mudou', 'parte que mudou', 'regiao', 'regioes', 'tile', 'bloco', 'camada alterada', 'copy-on-write', 'compartilh', 'structural sharing'], concept: 'Snapshot incremental', why: 'Uma pincelada muda uma região pequena: guardar só os blocos tocados, com o conteúdo de antes, reduz o custo em ordens de grandeza.' },
        { label: '**Limita** o histórico ou tira os antigos da memória (teto, disco, compressão)', keywords: ['limit', 'maxlen', 'descart', 'mais antig', 'disco', 'compress', 'swap', 'arquivo temporario', 'lru', 'teto', 'orcamento'], concept: 'Custo de memória', why: 'Mesmo com deltas, o histórico precisa de um teto: descartar o mais antigo ou descarregá-lo em disco, comprimido.' },
        { label: 'Combina com **Command** (inverso) para operações baratas de desfazer', keywords: ['command', 'comando', 'inverso', 'inversa', 'hibrid', 'combinar', 'misturar', 'parametr', 'reversivel', 'reversiveis'], concept: 'Desfazer/refazer', why: 'Ajustes paramétricos (brilho, mover camada) têm inverso exato e barato; o memento fica para operações destrutivas, como pincel e filtros.' },
      ],
      modelAnswer: `Não. Um snapshot completo antes de cada ação custa 100 × 50 MB = **5 GB de memória** por camada — o editor estoura a RAM muito antes do centésimo desfazer.

Eu desenharia um histórico **híbrido**. Para operações com inverso exato e barato — mover uma camada, ajustar o brilho, renomear —, uso **Command**: o comando guarda só os parâmetros e sabe se desfazer. Para operações destrutivas, como pincel e filtros, uso um **memento incremental**: divido a imagem em blocos (*tiles*) e guardo só os blocos que a ação vai tocar, com o conteúdo de antes — uma pincelada que muda 2% da imagem custa 2% de um snapshot. Blocos que não mudaram são **compartilhados** entre as versões.

Por fim, o histórico tem **limite**: um orçamento em MB (não só em número de passos), descartando os mementos mais antigos ou movendo-os, comprimidos, para o **disco**.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Memento = **foto do estado** que só o próprio objeto sabe tirar e revelar; o caretaker só guarda.',
        'Fotos imutáveis, cópia na fronteira e deltas quando a memória apertar. Próximo: Visitor!',
      ],
      board: null,
    },
  ],
});
