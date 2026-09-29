Game.registerModule('design-patterns', {
  id: 'flyweight',
  title: 'Flyweight',
  kind: 'lesson',
  level: 3,
  order: 26,
  unit: 'estruturais',
  summary: 'Compartilhar o estado repetido entre milhares de objetos para caber na memória — do GoF ao sys.intern e aos inteiros pequenos do CPython.',
  concepts: ['Flyweight', 'Estado intrínseco × extrínseco', 'Fábrica com cache', 'sys.intern', '__slots__'],
  takeaways: [
    'O **Flyweight** divide o estado em **intrínseco** (igual para muitos, imutável, compartilhado) e **extrínseco** (único por uso, fica no contexto e chega por parâmetro).',
    'Uma **fábrica com cache**, indexada por uma **chave canônica** do estado intrínseco, garante uma única instância por valor.',
    'O flyweight precisa ser **imutável**: uma mutação no objeto compartilhado vaza para todos que o usam.',
    'O CPython já faz isso: inteiros de **-5 a 256**, `sys.intern` para strings e singletons como `None`. Por isso `is` não serve para comparar valores — use `==`.',
    'Só vale com **muitos** objetos e memória **medida** (`tracemalloc`); antes do padrão completo, tente `__slots__`, tuplas e `sys.intern`.',
  ],
  glossary: [
    { term: 'Flyweight', aliases: ['padrão Flyweight', 'flyweights', 'peso-mosca'], definition: 'Padrão estrutural que economiza memória compartilhando entre muitos objetos a parte do estado que se repete (intrínseca e imutável) e deixando de fora a parte que varia (extrínseca).' },
    { term: 'Estado intrínseco', aliases: ['intrinsic state'], definition: 'Parte do estado que não depende do contexto e é igual para muitos objetos (espécie e textura de uma árvore, glifo de um caractere). Fica **dentro** do flyweight e precisa ser imutável.' },
    { term: 'Estado extrínseco', aliases: ['extrinsic state'], definition: 'Parte do estado que varia de objeto para objeto (posição de uma árvore, linha e coluna de um caractere). Fica **fora** do flyweight, no contexto, e é passada como parâmetro.' },
    { term: 'String interning', aliases: ['interning', 'internar strings', 'internação de strings'], definition: 'Manter uma única cópia de cada string igual. `sys.intern(s)` devolve a cópia canônica, o que economiza memória e permite comparar com `is`. O CPython interna sozinho identificadores e muitas constantes.' },
    { term: 'Hash consing', aliases: ['hash-consing'], definition: 'Técnica de compiladores e linguagens funcionais: antes de criar um valor imutável, procura-se um igual numa tabela hash e ele é reaproveitado — uma cópia por valor estrutural. É o Flyweight aplicado a dados.' },
    { term: 'Objeto imortal', aliases: ['objetos imortais', 'immortal objects'], definition: 'Desde o Python 3.12 (PEP 683), objetos como `None`, `True`, `False` e os inteiros pequenos têm contador de referências fixo: nunca são desalocados, e o refcount deles nunca muda.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Hoje o assunto é **memória**. Imagine um jogo com **um milhão de árvores** no mapa — mas só três espécies.',
        'Se cada árvore carrega a própria cópia de nome, cor e textura, a memória vai embora. O **Flyweight** separa o que se repete do que é único.',
      ],
      board: {
        title: 'O problema: um milhão de objetos quase iguais',
        md: `\`\`\`python
class Arvore:                            # versão ingênua
    def __init__(self, x, y, especie, cor, textura):
        self.x, self.y = x, y            # único por árvore
        self.especie = especie           # repetido...
        self.cor = cor                   # repetido...
        self.textura = textura           # repetido (e enorme!)

# lendo o mapa de um arquivo: cada linha cria strings e bytes NOVOS
floresta = [Arvore(x, y, esp, cor, carregar_textura(esp))
            for x, y, esp, cor in ler_mapa("mapa.csv")]
\`\`\`

| Dado | Por árvore | × 1.000.000 árvores |
|---|---|---|
| Posição (x, y) | poucos bytes | necessário: é único |
| Espécie e cor | dezenas de bytes | **repetido** um milhão de vezes |
| Textura | ~1 MB | **~1 TB** 😱 |

> [!atencao] Em Python, objetos são passados **por referência**: se você entregar o **mesmo** objeto de textura a todas as árvores, ele já é compartilhado. O problema aparece quando valores **iguais** nascem **de forma independente** — lendo arquivo, desserializando JSON, recebendo da rede — e quando o **custo fixo por objeto** domina.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'A chave do padrão é dividir o estado em dois.',
        'O **intrínseco** não depende do contexto e pode ser compartilhado. O **extrínseco** muda de objeto para objeto: fica de fora e chega como **parâmetro**.',
      ],
      board: {
        title: 'Estado intrínseco × extrínseco',
        md: `| | **Intrínseco** | **Extrínseco** |
|---|---|---|
| Onde fica | **Dentro** do flyweight (compartilhado) | **Fora**: no contexto ou no cliente |
| Muda? | Nunca: o flyweight é **imutável** | Varia a cada uso |
| Floresta | espécie, cor, textura | posição (x, y), idade |
| Editor de texto | glifo do caractere naquela fonte | linha e coluna no documento |
| Mapa de jogo | sprite e regras do tipo de terreno | coordenadas do tile |

\`\`\`python
from dataclasses import dataclass


@dataclass(frozen=True)                  # o FLYWEIGHT: imutável e compartilhado
class TipoArvore:
    especie: str
    cor: str
    textura: bytes

    def desenhar(self, x, y):            # o extrínseco chega por parâmetro
        return f"{self.especie} ({self.cor}) em ({x}, {y})"


class Arvore:                            # o CONTEXTO: só o que é único
    __slots__ = ("x", "y", "tipo")

    def __init__(self, x, y, tipo):
        self.x, self.y, self.tipo = x, y, tipo

    def desenhar(self):
        return self.tipo.desenhar(self.x, self.y)
\`\`\``,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E quem garante que ninguém crie um `TipoArvore` duplicado? A **fábrica de flyweights**: um cache indexado pelo estado intrínseco.',
        'Pediu um tipo que já existe? Recebe **o mesmo objeto**. Senão, ele é criado uma vez e guardado.',
      ],
      board: {
        title: 'Fábrica de flyweights',
        md: `\`\`\`python
class FabricaDeTipos:
    def __init__(self):
        self._cache = {}                         # chave intrínseca → flyweight

    def obter(self, especie, cor):
        chave = (especie, cor)
        if chave not in self._cache:             # só na 1ª vez
            self._cache[chave] = TipoArvore(especie, cor, carregar_textura(especie))
        return self._cache[chave]

    def __len__(self):
        return len(self._cache)


fabrica = FabricaDeTipos()
floresta = [Arvore(x, y, fabrica.obter(esp, cor))
            for x, y, esp, cor in ler_mapa("mapa.csv")]
len(floresta)   # 1_000_000 contextos leves
len(fabrica)    # 3 flyweights — uma textura por espécie
\`\`\`

> [!dica] Um \`@functools.cache\` numa função-fábrica faz o mesmo em uma linha, mas cuidado: ele trata \`obter("pinheiro", "verde")\` e \`obter(especie="pinheiro", cor="verde")\` como chaves **diferentes**, nunca esvazia e, em **métodos**, guarda \`self\` para sempre. Para liberar flyweights que ninguém usa mais, a fábrica pode guardá-los num \`weakref.WeakValueDictionary\`.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Sabe quem usa Flyweight o tempo todo? O próprio CPython! Os inteiros de **-5 a 256** são criados uma vez, na inicialização, e reaproveitados.',
        'Com strings, o `sys.intern` faz o papel da fábrica: devolve sempre a **cópia canônica**.',
      ],
      board: {
        title: 'Flyweights de fábrica: inteiros pequenos e sys.intern',
        md: `\`\`\`python
a, b = int("256"), int("256")
a is b                    # True  — de -5 a 256, sempre o MESMO objeto

c, d = int("257"), int("257")
c is d                    # False — fora do cache: dois objetos
c == d                    # True  — valores se comparam com ==, SEMPRE

import sys
s1 = "".join(["pinhei", "ro"])         # strings montadas em runtime
s2 = "".join(["pin", "heiro"])
s1 is s2                               # False
sys.intern(s1) is sys.intern(s2)       # True — a cópia canônica
\`\`\`

| Onde o CPython compartilha | Detalhe |
|---|---|
| Inteiros pequenos | de -5 a 256, criados na inicialização |
| Strings | identificadores e muitas constantes são internados sozinhos; \`sys.intern\` para o resto |
| Singletons | \`None\`, \`True\`, \`False\`, \`()\`, \`Ellipsis\` |
| Dicionários de instância | desde o 3.3 (PEP 412), instâncias da mesma classe **compartilham as chaves** do \`__dict__\` |

> [!atencao] \`is\` testa **identidade**, não igualdade. Nunca use \`is\` para comparar números ou strings: o resultado depende de detalhes do interpretador (o Python até emite \`SyntaxWarning\` para \`x is 257\`). Use \`is\` só com singletons, como em \`if x is None\`.`,
      },
    },
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Falta o outro lado da conta: o **contexto**. Com um milhão de `Arvore`, cada byte por objeto conta.',
        'O `__slots__` elimina o `__dict__` de cada instância. Mas não acredite em mim: **meça**.',
      ],
      board: {
        title: '__slots__ e como medir',
        md: `\`\`\`python
import tracemalloc

class PontoDict:
    def __init__(self, x, y):
        self.x, self.y = x, y

class PontoSlots:
    __slots__ = ("x", "y")               # atributos fixos, sem __dict__
    def __init__(self, x, y):
        self.x, self.y = x, y

tracemalloc.start()
pontos = [PontoSlots(i, i) for i in range(100_000)]
atual, pico = tracemalloc.get_traced_memory()
print(f"{atual / 100_000:.0f} bytes por ponto")   # compare com PontoDict
\`\`\`

| | Efeito do \`__slots__\` |
|---|---|
| ✅ | Menos memória por instância (dezenas de bytes a menos por objeto no CPython 64-bit) |
| ❌ | Não dá para criar atributos novos: \`AttributeError\` |
| ❌ | Sem \`__dict__\`: \`functools.cached_property\` não funciona |
| ❌ | Sem \`__weakref__\`: não entra num \`WeakValueDictionary\`, a menos que você inclua \`"__weakref__"\` nos slots |

> [!sabia] Desde o Python 3.12 (PEP 683), \`None\`, \`True\`, \`False\` e os inteiros pequenos são **objetos imortais**: o contador de referências deles nunca muda. Isso evita escritas em memória compartilhada (bom para o *copy-on-write* depois de um \`fork\`) e é um passo rumo ao Python sem GIL. E um termo que pouca gente conhece: **hash consing** — a técnica de compiladores e linguagens funcionais de, antes de criar um valor imutável, procurar um igual numa tabela hash e reusá-lo. É o Flyweight aplicado a dados.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Antes de sair aplicando Flyweight em tudo, a pergunta certa é: **isso é mesmo um problema**?',
        'O padrão troca memória por complexidade — e só compensa em condições bem específicas.',
      ],
      board: {
        title: 'Quando usar (e quando não)',
        md: `**Use quando *todas* forem verdade:**

1. há **muitos** objetos (milhares a milhões) e a memória é um problema **medido**;
2. boa parte do estado se **repete** e pode virar intrínseca;
3. o estado intrínseco pode ser **imutável**;
4. o código não depende da **identidade** de cada objeto (o compartilhado é o mesmo para todos).

**Evite quando:**

- são poucas centenas de objetos: otimização prematura;
- o estado "compartilhado" precisa mudar por objeto: uma mutação **vaza para todos**;
- recalcular ou passar o estado extrínseco a cada chamada custa mais do que a memória economizada.

> [!dica] Em Python, antes do Flyweight clássico, tente o barato: \`__slots__\`, tuplas ou \`NamedTuple\`, \`sys.intern\` nos valores repetidos (códigos de país, status) ou estruturas colunares como \`array\` e listas paralelas.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Compartilhe o que se repete, isole o que varia.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-fly-q1',
      concept: 'Estado extrínseco',
      say: 'Primeiro, separe o estado. Atenção: pode haver mais de uma correta!',
      prompt: 'Num jogo com 1 milhão de árvores de 3 espécies, você vai aplicar Flyweight. Quais dados devem ficar **fora** do flyweight, como estado **extrínseco**? Marque todas as corretas.',
      multiple: true,
      options: [
        { text: 'A posição (x, y) de cada árvore no mapa', correct: true, why: 'É única por árvore e depende do contexto: o exemplo clássico de estado extrínseco.' },
        { text: 'A idade de cada árvore, que aumenta a cada ano do jogo', correct: true, why: 'Varia por árvore **e** muda com o tempo. No flyweight, envelhecer uma árvore envelheceria a espécie inteira.' },
        { text: 'A textura de 1 MB da espécie', why: 'É igual para todas as árvores da espécie: justamente o que o flyweight existe para compartilhar (intrínseco).' },
        { text: 'O nome científico da espécie', why: 'Não depende de qual árvore é: intrínseco e compartilhável.' },
      ],
      explanation: 'Pergunta prática: "isso é igual para todos os objetos deste tipo **e** nunca muda?". Se sim, é intrínseco — mora no flyweight imutável. Se varia por objeto ou com o tempo, é extrínseco: fica no contexto (`Arvore`) e entra como **parâmetro** (`tipo.desenhar(x, y)`).',
    },
    {
      type: 'mcq',
      id: 'dp-fly-q2',
      concept: 'Cache de inteiros pequenos',
      say: 'Agora uma de interpretador. O que sai na tela?',
      prompt: `O que este código imprime no CPython?

\`\`\`python
a, b = int("256"), int("256")
c, d = int("257"), int("257")
print(a is b, c is d, c == d)
\`\`\``,
      options: [
        { text: '`True False True`', correct: true, why: '256 está no cache de inteiros pequenos (-5 a 256): os dois `int("256")` devolvem o mesmo objeto. Cada `int("257")` cria um objeto novo — iguais em valor, diferentes em identidade.' },
        { text: '`True True True`', why: 'Seria assim se todo inteiro fosse compartilhado; o cache vai só até 256.' },
        { text: '`False False True`', why: 'O CPython pré-cria os inteiros de -5 a 256, e `int("256")` devolve o objeto do cache.' },
        { text: '`True False False`', why: '`==` compara **valor**: `257 == 257` é sempre `True`, sejam ou não o mesmo objeto.' },
      ],
      explanation: 'É o Flyweight dentro do interpretador: números pequenos são tão comuns que o CPython os cria uma vez e compartilha. Usamos `int("...")` de propósito: literais iguais no **mesmo bloco de código** podem ser deduplicados pelo compilador (`x = 257; y = 257; x is y` pode dar `True`), o que só aumenta a confusão. Moral: `is` é para identidade (`is None`); valores se comparam com `==`.',
    },
    {
      type: 'match',
      id: 'dp-fly-q3',
      concept: 'Flyweight',
      say: 'Rodada rápida: cada ferramenta do Python com o papel que ela cumpre.',
      prompt: 'Associe cada ferramenta ao papel que ela cumpre quando o assunto é compartilhar objetos e economizar memória.',
      pairs: [
        { left: '`sys.intern(s)`', right: 'Devolve a cópia canônica de uma string: iguais passam a ser o mesmo objeto' },
        { left: '`__slots__`', right: 'Tira o `__dict__` de cada instância do contexto para economizar memória' },
        { left: 'Cache de inteiros pequenos', right: '`int("7") is int("7")` é `True`, mas com 257 não' },
        { left: '`weakref.WeakValueDictionary`', right: 'Cache de flyweights que deixa o coletor liberar os que ninguém mais usa' },
        { left: '`@dataclass(frozen=True)`', right: 'Torna o flyweight imutável: alterar um campo lança erro' },
      ],
      explanation: '`sys.intern` e o cache de inteiros são **fábricas de flyweights** prontas; `frozen=True` garante a **imutabilidade** que torna o compartilhamento seguro; `__slots__` enxuga o **contexto**, que existe aos milhões; e o `WeakValueDictionary` evita que a fábrica vire um vazamento de memória.',
    },
    {
      type: 'code',
      id: 'dp-fly-q4',
      concept: 'Flyweight',
      title: 'Estilos de um editor de texto',
      say: 'Agora é com você: um editor com milhões de caracteres e poucas dezenas de estilos.',
      prompt: `Cada caractere de um documento tem um **estilo** (fonte, tamanho, negrito, cor). Há milhões de caracteres, mas só algumas dezenas de estilos distintos. Implemente:

**1. \`Estilo\`** — o flyweight, com os campos \`fonte\`, \`tamanho\`, \`negrito\` e \`cor\`. Ele precisa ser **imutável**: \`estilo.tamanho = 99\` deve lançar \`AttributeError\`.

**2. \`FabricaDeEstilos\`** — \`obter(fonte, tamanho, negrito=False, cor="preto")\` devolve **o mesmo objeto** para o mesmo estilo:

- a fonte é normalizada: \`"  Arial "\` e \`"arial"\` são o mesmo estilo (guarde \`"arial"\`);
- chamadas equivalentes, como \`obter("arial", 12)\` e \`obter("arial", 12, negrito=False)\`, devolvem o mesmo objeto;
- \`len(fabrica)\` informa quantos estilos distintos existem, e cada fábrica tem o **seu próprio** cache.

**3. \`Documento(fabrica)\`** — o contexto: \`escrever(texto, fonte, tamanho, negrito=False, cor="preto")\` acrescenta a \`self.caracteres\` um par \`(caractere, estilo)\` para cada caractere do texto; \`texto()\` devolve o texto completo.`,
      starter: `class Estilo:
    """Flyweight: fonte, tamanho, negrito e cor. Deve ser imutável."""
    pass


class FabricaDeEstilos:
    def __init__(self):
        pass

    def obter(self, fonte, tamanho, negrito=False, cor="preto"):
        pass

    def __len__(self):
        return 0


class Documento:
    def __init__(self, fabrica):
        self.fabrica = fabrica
        self.caracteres = []

    def escrever(self, texto, fonte, tamanho, negrito=False, cor="preto"):
        pass

    def texto(self):
        pass
`,
      tests: [
        { name: 'mesmo estilo → mesmo objeto', code: `f = FabricaDeEstilos()
assert f.obter("arial", 12) is f.obter("arial", 12), "a fábrica criou dois objetos para o mesmo estilo"
assert len(f) == 1` },
        { name: 'estilos diferentes → objetos diferentes', code: `f = FabricaDeEstilos()
a = f.obter("arial", 12)
b = f.obter("arial", 14)
c = f.obter("arial", 12, negrito=True)
assert a is not b and a is not c and b is not c
assert len(f) == 3, f"len(fabrica) = {len(f)}"` },
        { name: 'normaliza o nome da fonte', code: `f = FabricaDeEstilos()
e = f.obter("  Arial ", 12)
assert e is f.obter("arial", 12)
assert e.fonte == "arial", f"fonte guardada: {e.fonte!r}"
assert len(f) == 1` },
        { name: 'chamadas equivalentes → mesmo objeto', code: `f = FabricaDeEstilos()
e = f.obter("arial", 12)
assert e is f.obter("arial", 12, negrito=False, cor="preto"), "defaults explícitos geraram outro objeto"
assert e is f.obter(fonte="arial", tamanho=12), "argumentos nomeados geraram outro objeto"
assert len(f) == 1` },
        { name: 'Estilo é imutável', code: `e = FabricaDeEstilos().obter("arial", 12)
try:
    e.tamanho = 99
except AttributeError:
    pass
else:
    raise AssertionError("o flyweight é compartilhado: alterar um campo deveria lançar AttributeError")
assert e.tamanho == 12` },
        { name: 'documento compartilha os estilos', code: `f = FabricaDeEstilos()
d = Documento(f)
d.escrever("Olá", "Arial", 12)
d.escrever(" mundo", "arial", 12, negrito=True)
assert d.texto() == "Olá mundo", d.texto()
assert len(d.caracteres) == 9
assert len(f) == 2, f"len(fabrica) = {len(f)}"
assert d.caracteres[0] == ("O", f.obter("arial", 12))
assert d.caracteres[0][1] is d.caracteres[2][1]
assert d.caracteres[3][1] is d.caracteres[8][1]
assert d.caracteres[0][1] is not d.caracteres[3][1]` },
        { name: 'cada fábrica tem o seu cache', hidden: true, code: `f1 = FabricaDeEstilos()
f1.obter("arial", 12)
f2 = FabricaDeEstilos()
assert len(f2) == 0, "o cache está sendo compartilhado entre fábricas (estado global?)"
f2.obter("mono", 10)
assert len(f1) == 1 and len(f2) == 1` },
        { name: '10.000 caracteres, 1 estilo', hidden: true, code: `f = FabricaDeEstilos()
d = Documento(f)
for _ in range(1000):
    d.escrever("abcdefghij", "Mono", 10)
assert len(d.caracteres) == 10000
assert len(f) == 1
assert len({id(e) for _, e in d.caracteres}) == 1` },
        { name: 'cor faz parte da chave', hidden: true, code: `f = FabricaDeEstilos()
azul = f.obter("arial", 12, cor="azul")
assert azul is not f.obter("arial", 12)
assert azul.cor == "azul" and azul.negrito is False
assert len(f) == 2` },
      ],
      reviews: [
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. Um cache global é compartilhado por todas as fábricas e por todos os testes — é estado global disfarçado. Guarde o cache na instância (`self._cache = {}` no `__init__`).',
          concept: 'Estado global',
        },
        {
          when: m => m.decorators.includes('cache') || m.decorators.includes('lru_cache'),
          text: '`@functools.cache`/`@lru_cache` como fábrica tem três pegadinhas: trata `f(1)` e `f(1, b=0)` como chamadas **diferentes**, nunca esvazia e, aplicado a um **método**, guarda `self` no cache da função para sempre (a regra B019 do flake8-bugbear alerta para isso). Um `dict` com chave canônica na própria fábrica é mais explícito.',
          concept: 'Fábrica com cache',
        },
        {
          when: m => m.mutableDefaults > 0,
          text: 'Há um argumento padrão **mutável** (lista/dict/set na assinatura). Ele é criado uma vez e compartilhado entre chamadas — um "flyweight acidental" que costuma causar bugs. Use `None` e crie dentro da função.',
          concept: 'Argumento padrão mutável',
        },
      ],
      hints: [
        '`@dataclass(frozen=True)` resolve o `Estilo`: gera `__init__`, `__eq__` e `__hash__` e bloqueia atribuições com `FrozenInstanceError` (uma subclasse de `AttributeError`).',
        'Na fábrica, crie `self._cache = {}` no `__init__` e monte uma **chave canônica** com os argumentos já normalizados: `(fonte.strip().lower(), tamanho, negrito, cor)`. Assim, `obter("arial", 12)` e `obter("arial", 12, negrito=False)` geram a mesma chave.',
        'Em `Documento.escrever`, obtenha o estilo **uma vez** e faça `self.caracteres.extend((c, estilo) for c in texto)`. O `texto()` é `"".join(c for c, _ in self.caracteres)`.',
      ],
      solution: `from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Estilo:
    """Flyweight: fonte, tamanho, negrito e cor. Deve ser imutável."""
    fonte: str
    tamanho: int
    negrito: bool = False
    cor: str = "preto"


class FabricaDeEstilos:
    def __init__(self):
        self._cache = {}                     # chave canônica → Estilo

    def obter(self, fonte, tamanho, negrito=False, cor="preto"):
        chave = (fonte.strip().lower(), tamanho, negrito, cor)
        estilo = self._cache.get(chave)
        if estilo is None:
            estilo = Estilo(*chave)
            self._cache[chave] = estilo
        return estilo

    def __len__(self):
        return len(self._cache)


class Documento:
    def __init__(self, fabrica):
        self.fabrica = fabrica
        self.caracteres = []                 # estado extrínseco: (caractere, estilo)

    def escrever(self, texto, fonte, tamanho, negrito=False, cor="preto"):
        estilo = self.fabrica.obter(fonte, tamanho, negrito, cor)
        self.caracteres.extend((c, estilo) for c in texto)

    def texto(self):
        return "".join(c for c, _ in self.caracteres)
`,
      solutionExplanation: 'O `Estilo` congelado é o estado **intrínseco**: imutável e seguro para compartilhar (`slots=True` ainda enxuga cada instância). A fábrica normaliza os argumentos numa **chave canônica** antes de consultar o cache — é isso que faz chamadas equivalentes e `" Arial "` × `"arial"` caírem no mesmo objeto, algo que um `@functools.cache` ingênuo não faria. O `Documento` guarda o estado **extrínseco** (qual caractere, em que posição) e só uma **referência** ao estilo: 10.000 caracteres, um único `Estilo`.',
    },
    {
      type: 'open',
      id: 'dp-fly-q5',
      concept: 'Flyweight',
      say: 'Para fechar, uma conversa de code review.',
      prompt: 'Um colega propõe aplicar Flyweight "em todas as entidades do sistema, para economizar memória". Como você responderia? Diga quando o padrão vale a pena e que cuidados ele exige.',
      minWords: 25,
      rubric: [
        { label: 'Sugere **medir** antes (evitar otimização prematura)', keywords: ['medir', 'medi', 'mensur', 'profil', 'tracemalloc', 'benchmark', 'prematur', 'metrica', 'dados reais', 'evidencia'], concept: 'Otimização prematura', why: 'Sem medição, não dá para saber se a memória é mesmo o gargalo — nem se o padrão ajudou.' },
        { label: 'Só compensa com **muitos objetos** e estado **repetido**', keywords: ['milhares', 'milhoes', 'muitos objetos', 'muitas instancias', 'grande quantidade', 'grande volume', 'repetid', 'duplicad', 'se repete', 'compartilh'], concept: 'Flyweight', why: 'O ganho vem de compartilhar o que se repete entre MUITOS objetos; com poucos, sobra só a complexidade.' },
        { label: 'O estado compartilhado precisa ser **imutável**', keywords: ['imutav', 'imutab', 'frozen', 'nao pode mudar', 'nao pode ser alterad', 'mutac', 'vaza para todos', 'afeta todos'], concept: 'Estado intrínseco', why: 'Mudar um flyweight muda todos os objetos que o compartilham.' },
        { label: 'Cita **custos**: complexidade, estado extrínseco passado por parâmetro, cache que só cresce', keywords: ['complex', 'extrinsec', 'parametro', 'indirec', 'vazamento', 'leak', 'weak', 'cresce', 'custo', 'legibil'], concept: 'Estado extrínseco', why: 'O padrão troca memória por complexidade: separar estados, passar contexto e administrar a fábrica.' },
      ],
      modelAnswer: `Eu não aplicaria em tudo. Primeiro, **medir** (com \`tracemalloc\` ou um profiler): sem evidência de que a memória é o gargalo, é **otimização prematura**.

O Flyweight só compensa quando existem **muitos objetos** (milhares ou milhões) com boa parte do estado **repetido**, que pode ser **compartilhado**. Esse estado intrínseco precisa ser **imutável** — uma mutação no objeto compartilhado afetaria todos.

E há **custos**: mais **complexidade** (separar estado intrínseco do **extrínseco**, que passa a ser enviado por **parâmetro**), uma fábrica para administrar e um cache que **cresce** sem parar se não usarmos algo como \`WeakValueDictionary\`. Para a maioria das entidades, \`__slots__\` ou \`sys.intern\` nos campos repetidos já resolvem.`,
    },
    {
      type: 'say',
      mood: 'cheer',
      text: [
        'Fechamos os estruturais pesados! Flyweight é compartilhar o que se repete (intrínseco, imutável) e deixar de fora o que varia (extrínseco).',
        'Lembre da fábrica com chave canônica, dos flyweights do próprio CPython — e de **medir** antes de otimizar.',
      ],
      board: null,
    },
  ],
});
