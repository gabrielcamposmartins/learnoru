Game.registerModule('design-patterns', {
  id: 'prototype',
  title: 'Prototype',
  kind: 'lesson',
  level: 2,
  order: 13,
  unit: 'criacionais',
  summary: 'Criar objetos clonando um modelo pronto — e dominar copy, deepcopy, __deepcopy__ e o memo sem cair no aliasing.',
  concepts: ['Prototype', 'copy × deepcopy', '__deepcopy__ e memo', 'Registro de protótipos', 'Aliasing'],
  takeaways: [
    'Prototype cria objetos **clonando um modelo** já configurado, em vez de montar tudo do zero — útil quando a configuração é cara ou cheia de detalhes.',
    '`b = a` não copia nada: é um **alias**. `copy.copy` cria um objeto novo mas **compartilha** os filhos; `copy.deepcopy` copia o grafo inteiro.',
    'Em `__deepcopy__`, registre o clone em `memo[id(self)]` **antes** de copiar os filhos e **repasse** o `memo` — é isso que preserva ciclos e referências compartilhadas.',
    'Personalizar a cópia permite **compartilhar** recursos pesados e imutáveis e dar **identidade nova** ao clone (a cópia não chama `__init__`).',
    'Cuidado com o aliasing escondido: `[[0] * 3] * 3`, `dict.fromkeys(chaves, [])` e cópias rasas de estruturas aninhadas.',
  ],
  glossary: [
    { term: 'Prototype', aliases: ['padrão Prototype', 'protótipo', 'protótipos'], definition: 'Padrão criacional em que novos objetos nascem da **clonagem** de uma instância-modelo já configurada, em vez de serem construídos do zero.' },
    { term: 'Cópia rasa', aliases: ['cópias rasas', 'copia rasa', 'shallow copy'], definition: 'Cópia que cria um objeto novo mas **reaproveita** as referências internas: listas e dicts filhos continuam compartilhados (`copy.copy`, `lista[:]`, `dict(d)`).' },
    { term: 'Cópia profunda', aliases: ['cópias profundas', 'copia profunda', 'deep copy'], definition: 'Cópia recursiva: os objetos internos também são copiados (`copy.deepcopy`), preservando ciclos e compartilhamentos graças ao memo.' },
    { term: 'Aliasing', aliases: ['aliasing de referências'], definition: 'Situação em que dois nomes (ou duas estruturas) apontam para o **mesmo** objeto mutável: alterar por um caminho muda o que o outro "vê".' },
    { term: 'Memo do deepcopy', aliases: ['dicionário memo', 'memo do copy.deepcopy'], definition: 'Dicionário `id(original) → cópia` que o `deepcopy` carrega pela recursão para não copiar o mesmo objeto duas vezes nem se perder em ciclos.' },
    { term: 'Copy-on-write', aliases: ['cópia na escrita', 'copy on write'], definition: 'Técnica em que a cópia só acontece de verdade quando alguém **escreve**; até lá, original e "cópia" compartilham os dados. É o que torna o `fork()` barato.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje vamos clonar coisas! O **Prototype** cria objetos novos **copiando um modelo** já pronto, em vez de montar tudo do zero.',
        'Pensa num jogo: configurar um goblin com atributos, habilidades e sprite dá trabalho. Melhor ter um goblin-modelo e clonar quantos precisar.',
      ],
      board: {
        title: 'Prototype — criar clonando',
        md: `**Problema:** criar certos objetos é caro ou trabalhoso — carregar assets, ler configuração, aplicar dezenas de ajustes — e você precisa de **muitos parecidos**.

**Solução:** mantenha uma instância-modelo (o **protótipo**) e produza as novas **clonando-a**, ajustando só o que muda.

\`\`\`python
import copy

goblin_modelo = Inimigo("goblin", vida=30, habilidades=["furtividade"],
                        sprite=carregar_sprite("goblin.png"))   # caro!

horda = [copy.deepcopy(goblin_modelo) for _ in range(50)]      # barato… será?
chefe = copy.deepcopy(goblin_modelo)
chefe.nome, chefe.vida = "Rei Goblin", 300
\`\`\`

Barato **se** o sprite pesado não for copiado junto — já já a gente resolve isso.

> [!dica] Quem cria não precisa conhecer a classe concreta: basta ter **um objeto** para copiar. Por isso o Prototype é um padrão **criacional**.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'Antes de clonar, uma verdade que pega muita gente: em Python, **atribuição não copia nada**.',
        '`b = a` só cria um segundo nome para o **mesmo** objeto. Com objetos mutáveis, isso é o famoso **aliasing** — e ele se esconde em lugares inesperados.',
      ],
      board: {
        title: '⚠️ Atribuição não é cópia (aliasing)',
        md: `\`\`\`python
a = {"nome": "goblin", "itens": ["adaga"]}
b = a                        # alias: mesmo objeto
b["nome"] = "orc"
print(a["nome"], a is b)     # orc True 😱

grade = [[0] * 3] * 3        # 3 referências para a MESMA lista
grade[0][0] = 1
print(grade)                 # [[1, 0, 0], [1, 0, 0], [1, 0, 0]]

notas = dict.fromkeys(["ana", "bia"], [])   # um único [] para todas as chaves
notas["ana"].append(10)
print(notas["bia"])          # [10]
\`\`\`

| Em vez de… | Use… |
|---|---|
| \`[[0] * 3] * 3\` | \`[[0] * 3 for _ in range(3)]\` |
| \`dict.fromkeys(chaves, [])\` | \`{k: [] for k in chaves}\` |
| \`b = a\` (quando quer uma cópia) | \`copy.copy(a)\` ou \`copy.deepcopy(a)\` |`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O módulo `copy` tem dois níveis. `copy.copy` faz uma cópia **rasa**: objeto novo, mas os filhos continuam **compartilhados**.',
        '`copy.deepcopy` desce recursivamente e copia os filhos também. Olha a diferença na prática:',
      ],
      board: {
        title: 'copy.copy × copy.deepcopy',
        md: `\`\`\`python
import copy

modelo = {"nome": "goblin", "itens": ["adaga"]}
raso = copy.copy(modelo)
fundo = copy.deepcopy(modelo)

raso["nome"] = "orc"               # topo: independente
raso["itens"].append("escudo")     # filho: COMPARTILHADO com o modelo!

print(modelo)   # {'nome': 'goblin', 'itens': ['adaga', 'escudo']}
print(fundo)    # {'nome': 'goblin', 'itens': ['adaga']}
\`\`\`

| | \`b = a\` | \`copy.copy(a)\` | \`copy.deepcopy(a)\` |
|---|---|---|---|
| Objeto novo? | ❌ | ✅ | ✅ |
| Filhos novos? | ❌ | ❌ (compartilhados) | ✅ (recursivo) |
| Custo | zero | baixo | proporcional ao grafo de objetos |

> [!dica] Atalhos de cópia **rasa**: \`lista[:]\`, \`list(x)\`, \`x.copy()\`, \`dict(d)\`, \`{**d}\`. E imutáveis nem precisam de cópia: para \`t = (1, 2)\`, \`copy.copy(t) is t\` é \`True\`.`,
      },
    },
    {
      type: 'say',
      text: [
        'E quando a cópia padrão não serve? Classes podem definir `__copy__` e `__deepcopy__` para decidir **o que** copiar.',
        'No nosso goblin: as habilidades devem ser copiadas, o sprite pesado deve ser **compartilhado** e o clone precisa de **id novo** — porque a cópia **não chama `__init__`**!',
      ],
      board: {
        title: 'Cópia sob medida com __deepcopy__',
        code: `import copy
import itertools

_ids = itertools.count(1)


class Inimigo:
    def __init__(self, nome, vida, habilidades, sprite):
        self.id = next(_ids)
        self.nome = nome
        self.vida = vida
        self.habilidades = habilidades   # mutável → copiar
        self.sprite = sprite             # pesado e imutável → compartilhar

    def __deepcopy__(self, memo):
        clone = copy.copy(self)          # cópia rasa de TODOS os atributos
        memo[id(self)] = clone           # registra ANTES de descer (ciclos!)
        clone.id = next(_ids)            # identidade nova
        clone.habilidades = copy.deepcopy(self.habilidades, memo)
        return clone                     # sprite: mesma referência`,
        caption: 'Começar com `copy.copy(self)` garante que nenhum atributo "suma" do clone — você só trata as exceções. Para a cópia rasa, o gancho equivalente é `__copy__(self)`.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'E esse `memo`? É um dicionário `id(original) → cópia` que o `deepcopy` carrega por toda a recursão.',
        'Ele resolve dois problemas: não copiar o **mesmo** objeto duas vezes e não se perder quando há **ciclos**.',
      ],
      board: {
        title: 'Para que serve o memo',
        md: `\`\`\`python
import copy

x = [1, 2]
par = [x, x]                   # dois caminhos para a MESMA lista
c = copy.deepcopy(par)
print(c[0] is c[1])            # True — o compartilhamento foi preservado

ciclo = []
ciclo.append(ciclo)            # lista que contém a si mesma
d = copy.deepcopy(ciclo)
print(d[0] is d)               # True — e nada de recursão infinita
\`\`\`

**Regras de ouro do \`__deepcopy__(self, memo)\`:**

1. Faça \`memo[id(self)] = clone\` **antes** de copiar os filhos. Se um filho apontar de volta para \`self\`, o \`deepcopy\` encontra o clone no memo; sem isso, ele copia \`self\` **de novo** — no melhor caso você ganha clones duplicados, no pior, recursão infinita.
2. **Repasse** o memo em toda cópia interna: \`copy.deepcopy(self.x, memo)\`.
3. Não chame \`copy.deepcopy(self)\` lá dentro: isso cai no próprio \`__deepcopy__\` outra vez.

> [!atencao] Nem tudo é copiável: \`deepcopy\` de um objeto que guarda um arquivo aberto, um lock ou um gerador lança \`TypeError\` (*cannot pickle…*). Esses recursos devem ser **compartilhados** ou recriados no clone.`,
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Juntando tudo: um **registro de protótipos** guarda modelos prontos por nome e entrega clones sob demanda, com ajustes.',
        'É um catálogo de "moldes" — ótimo para spawn de inimigos, modelos de documento ou configurações padrão.',
      ],
      board: {
        title: 'Registro de protótipos',
        md: `\`\`\`python
class RegistroDePrototipos:
    def __init__(self):
        self._modelos = {}

    def registrar(self, nome, prototipo):
        self._modelos[nome] = prototipo

    def criar(self, nome, /, **ajustes):        # "/" → nome só por posição
        clone = copy.deepcopy(self._modelos[nome])
        for campo, valor in ajustes.items():
            setattr(clone, campo, valor)
        return clone


spawn = RegistroDePrototipos()
spawn.registrar("goblin", Inimigo("goblin", 30, ["furtividade"], SPRITE_GOBLIN))
chefe = spawn.criar("goblin", nome="Rei Goblin", vida=300)
\`\`\`

> [!atencao] Sem o \`/\`, essa última linha quebra: \`TypeError: ... got multiple values for argument 'nome'\` — o ajuste \`nome=\` colide com o parâmetro. Parâmetros **somente-posicionais** (PEP 570, Python 3.8) resolvem; é o mesmo truque da assinatura \`dict(mapping, /, **kwargs)\`.

| Use Prototype quando… | Evite quando… |
|---|---|
| Criar do zero é caro (I/O, parsing, muitos ajustes) | O construtor já é simples e barato |
| Você quer "moldes" configuráveis em runtime | O objeto guarda recursos não copiáveis (conexões, locks) |
| O código não deve depender das classes concretas | A cópia profunda sairia mais cara que construir |

> [!sabia] O \`fork()\` do sistema operacional é um Prototype: o processo filho nasce como **clone** do pai. Para ficar barato, o kernel usa **copy-on-write** — uma página de memória só é copiada quando alguém escreve nela. No CPython, porém, só de *usar* um objeto o contador de referências dele muda (uma escrita!), o que estragava esse compartilhamento em servidores que fazem *pre-fork*. Casos como o do Instagram motivaram o \`gc.freeze()\` (Python 3.7) e os **objetos imortais** da PEP 683 (Python 3.12), cujo contador nunca muda.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Alias, cópia rasa, cópia profunda e clones sob medida.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-pro-q1',
      concept: 'copy × deepcopy',
      say: 'Primeira: acompanhe as referências com calma.',
      prompt: `O que este código imprime?

\`\`\`python
import copy

class Time:
    def __init__(self, nome, jogadores):
        self.nome = nome
        self.jogadores = jogadores

base = Time("Azul", ["Ana", "Bia"])
t1 = copy.copy(base)
t2 = copy.deepcopy(base)
t1.nome = "Verde"
t1.jogadores.append("Caio")
t2.jogadores.remove("Ana")
print(base.nome, base.jogadores)
\`\`\``,
      options: [
        { text: "`Azul ['Ana', 'Bia']`", why: 'Faltou lembrar que a cópia rasa **compartilha** a lista: o `append` em `t1.jogadores` altera a lista do `base`.' },
        { text: "`Azul ['Ana', 'Bia', 'Caio']`", correct: true, why: '`t1.nome = ...` só religa o atributo **no clone**; mas `t1.jogadores` é a mesma lista do `base`. Já `t2` tem lista própria, então o `remove` não afeta ninguém.' },
        { text: "`Verde ['Ana', 'Bia', 'Caio']`", why: 'Atribuir `t1.nome` troca a referência **em `t1`**; o `base` continua com `"Azul"`.' },
        { text: "`Azul ['Bia', 'Caio']`", why: '`t2` foi criado com `deepcopy`: a lista dele é independente, então o `remove` não chega ao `base`.' },
      ],
      explanation: 'A cópia rasa cria um **objeto novo** (por isso `t1.nome = ...` não afeta o `base`), mas os atributos apontam para os **mesmos** filhos. **Mutar** um filho (`append`) aparece nos dois; **reatribuir** um atributo, não. A cópia profunda isola tudo.',
    },
    {
      type: 'mcq',
      id: 'dp-pro-q2',
      concept: 'Aliasing',
      multiple: true,
      say: 'Agora várias podem estar certas — e tem uma pegadinha de `deepcopy` no meio.',
      prompt: 'Quais expressões criam estruturas cujos elementos internos são **independentes** (alterar um não altera os outros)? Marque todas as corretas.',
      options: [
        { text: '`[[0] * 3 for _ in range(3)]`', correct: true, why: 'A compreensão avalia `[0] * 3` **a cada iteração**: três listas distintas.' },
        { text: '`[[0] * 3] * 3`', why: 'Multiplicar a lista externa repete a **referência**: são três caminhos para a mesma lista interna.' },
        { text: '`copy.deepcopy([[0] * 3] * 3)`', why: 'Pegadinha! O memo do `deepcopy` **preserva** o compartilhamento: o resultado tem três referências para **uma** lista nova.' },
        { text: '`{k: [] for k in "abc"}`', correct: true, why: 'Cada iteração cria um `[]` novo para cada chave.' },
        { text: '`dict.fromkeys("abc", [])`', why: 'O `[]` é avaliado **uma vez** e o mesmo objeto vira o valor de todas as chaves.' },
      ],
      explanation: 'Repetir uma referência (`* 3`, `fromkeys`) não cria objetos novos. E o `deepcopy` copia o **grafo** de objetos como ele é: se dois caminhos levavam ao mesmo objeto, a cópia também terá dois caminhos para um mesmo objeto (novo). Para ter independência, crie cada elemento separadamente.',
    },
    {
      type: 'match',
      id: 'dp-pro-q3',
      concept: 'copy × deepcopy',
      say: 'Rapidinha: ligue cada ferramenta ao que ela faz.',
      prompt: 'Associe cada item ao seu efeito:',
      pairs: [
        { left: '`b = a`', right: 'Segundo nome para o mesmo objeto' },
        { left: '`copy.copy(a)`', right: 'Objeto novo com filhos compartilhados' },
        { left: '`copy.deepcopy(a)`', right: 'Objeto novo com filhos copiados recursivamente' },
        { left: '`memo`', right: 'Mapa id(original) → cópia que protege ciclos' },
        { left: '`__deepcopy__`', right: 'Gancho para decidir o que copiar e o que compartilhar' },
      ],
      explanation: 'Atribuição cria **alias**; `copy.copy` copia um nível; `copy.deepcopy` copia o grafo inteiro usando o **memo** para lembrar o que já copiou; e `__deepcopy__` deixa a classe personalizar esse processo.',
    },
    {
      type: 'code',
      id: 'dp-pro-q4',
      concept: '__deepcopy__ e memo',
      title: 'Spawner de inimigos',
      say: 'Hora de programar um spawner com protótipos. Um teste oculto cria inimigos que são aliados **uns dos outros** — o memo vai ser posto à prova!',
      prompt: `Complete o sistema de *spawn* do jogo.

**1.** Em \`Inimigo\`, implemente \`__deepcopy__(self, memo)\` para que \`copy.deepcopy(inimigo)\` devolva um clone em que:

- o \`id\` é **novo** (use \`next(_ids)\`);
- \`habilidades\` e \`aliados\` são cópias **independentes**;
- o \`sprite\` é o **mesmo objeto** (asset pesado, compartilhado);
- inimigos aliados **uns dos outros** (ciclo) também podem ser clonados — no clone, os aliados apontam para os **clones**.

**2.** Implemente \`RegistroDePrototipos\`:

- \`registrar(nome, prototipo)\`;
- \`criar(nome, /, **ajustes)\` devolve um clone profundo com os ajustes aplicados (\`criar("goblin", nome="Rei Goblin", vida=99)\`) — o \`/\` já está na assinatura e deixa \`nome\` somente-posicional, para o ajuste \`nome=\` não colidir com o parâmetro;
- nome não registrado → \`KeyError\`; ajuste de um atributo que o protótipo **não tem** → \`AttributeError\` (pega erros de digitação como \`vidda=99\`).`,
      starter: `import copy
import itertools

_ids = itertools.count(1)


class Sprite:
    """Asset pesado (imagem carregada). Deve ser COMPARTILHADO entre clones."""
    def __init__(self, arquivo):
        self.arquivo = arquivo


class Inimigo:
    def __init__(self, nome, vida, habilidades, sprite):
        self.id = next(_ids)
        self.nome = nome
        self.vida = vida
        self.habilidades = habilidades
        self.sprite = sprite
        self.aliados = []

    def __deepcopy__(self, memo):
        # TODO: id novo, habilidades/aliados copiados, sprite compartilhado
        pass


class RegistroDePrototipos:
    def __init__(self):
        pass

    def registrar(self, nome, prototipo):
        pass

    def criar(self, nome, /, **ajustes):   # "/": nome só por posição
        pass
`,
      tests: [
        { name: 'clone é outro objeto, com os mesmos dados', code: 'import copy\ng = Inimigo("goblin", 30, ["furtividade"], Sprite("goblin.png"))\nc = copy.deepcopy(g)\nassert c is not None, "__deepcopy__ precisa devolver o clone"\nassert c is not g, "o clone deve ser outro objeto"\nassert (c.nome, c.vida, c.habilidades) == ("goblin", 30, ["furtividade"]), vars(c)' },
        { name: 'habilidades independentes', code: 'import copy\ng = Inimigo("goblin", 30, ["furtividade"], Sprite("goblin.png"))\nc = copy.deepcopy(g)\nc.habilidades.append("fúria")\nassert g.habilidades == ["furtividade"], "o clone alterou as habilidades do protótipo"' },
        { name: 'sprite compartilhado', code: 'import copy\ng = Inimigo("goblin", 30, [], Sprite("goblin.png"))\nc = copy.deepcopy(g)\nassert c.sprite is g.sprite, "o sprite (asset pesado) deve ser o MESMO objeto no clone"' },
        { name: 'id novo a cada clone', code: 'import copy\ng = Inimigo("goblin", 30, [], Sprite("goblin.png"))\nc1 = copy.deepcopy(g)\nc2 = copy.deepcopy(g)\nassert len({g.id, c1.id, c2.id}) == 3, f"ids repetidos: {g.id}, {c1.id}, {c2.id}"' },
        { name: 'registro com ajustes', code: 'r = RegistroDePrototipos()\ng = Inimigo("goblin", 30, ["furtividade"], Sprite("goblin.png"))\nr.registrar("goblin", g)\nchefe = r.criar("goblin", nome="Rei Goblin", vida=300)\nassert (chefe.nome, chefe.vida) == ("Rei Goblin", 300), vars(chefe)\nassert (g.nome, g.vida) == ("goblin", 30), "o protótipo não pode mudar"\nassert chefe is not g and chefe.sprite is g.sprite' },
        { name: 'nome não registrado → KeyError', code: 'r = RegistroDePrototipos()\ntry:\n    r.criar("dragao")\nexcept KeyError:\n    pass\nelse:\n    raise AssertionError("criar() com nome desconhecido deveria lançar KeyError")' },
        { name: 'aliados em ciclo', hidden: true, code: 'import copy\ns = Sprite("x.png")\na = Inimigo("a", 10, [], s)\nb = Inimigo("b", 10, [], s)\na.aliados.append(b)\nb.aliados.append(a)\nc = copy.deepcopy(a)\nassert c.aliados[0] is not b, "os aliados do clone devem ser clones"\nassert c.aliados[0].aliados[0] is c, "o ciclo deve voltar ao próprio clone — registre no memo ANTES de copiar os filhos"\nassert a.aliados == [b] and b.aliados == [a], "os originais não podem mudar"' },
        { name: 'ajuste inexistente → AttributeError', hidden: true, code: 'r = RegistroDePrototipos()\nr.registrar("goblin", Inimigo("goblin", 30, [], Sprite("g.png")))\ntry:\n    r.criar("goblin", vidda=99)\nexcept AttributeError:\n    pass\nelse:\n    raise AssertionError("ajuste com atributo inexistente (vidda) deveria lançar AttributeError")' },
        { name: 'clones do registro independentes entre si', hidden: true, code: 'r = RegistroDePrototipos()\ng = Inimigo("goblin", 30, ["furtividade"], Sprite("g.png"))\nr.registrar("goblin", g)\nx = r.criar("goblin")\ny = r.criar("goblin")\nx.habilidades.append("fúria")\nassert y.habilidades == ["furtividade"] and g.habilidades == ["furtividade"]\nassert len({g.id, x.id, y.id}) == 3' },
      ],
      reviews: [
        {
          when: (m, code) => /deepcopy\(\s*self\.\w+\s*\)/.test(code),
          text: 'Você chamou `copy.deepcopy(self.atributo)` **sem** repassar o `memo`. Cada chamada começa um memo vazio: referências compartilhadas viram cópias duplicadas e ciclos que passem por ali podem recursar para sempre. Use `copy.deepcopy(self.x, memo)`.',
          concept: 'Memo do deepcopy',
        },
        {
          when: (m, code) => m.calls.includes('Inimigo') || /type\(self\)\(|self\.__class__\(/.test(code),
          text: 'O clone foi criado chamando o **construtor** de novo. Funciona, mas acopla o `__deepcopy__` à assinatura do `__init__`: um atributo novo que você esquecer de repassar some do clone. Partir de `copy.copy(self)` copia tudo, e você só trata as exceções.',
          concept: 'Prototype',
        },
        {
          when: m => m.imports.includes('pickle'),
          text: 'Clonar com `pickle` (serializar e desserializar) funciona, mas é mais lento, exige que tudo seja serializável e não deixa escolher o que compartilhar. O protocolo de cópia (`__deepcopy__`) é a ferramenta certa.',
          concept: 'copy × deepcopy',
        },
        {
          when: m => m.usesGlobal,
          text: 'Você usou `global`. O contador `_ids` já é um iterador: `next(_ids)` avança sem precisar declarar nada — e estado global a mais só aumenta o acoplamento.',
          concept: 'Estado global',
        },
      ],
      hints: [
        'Comece o `__deepcopy__` com `clone = copy.copy(self)`: isso copia todos os atributos **por referência**, inclusive o `sprite` — que é exatamente o que queremos para ele.',
        'Logo em seguida, **antes** de copiar qualquer filho: `memo[id(self)] = clone`. Depois gere o id novo com `clone.id = next(_ids)`.',
        'Copie os filhos repassando o memo: `clone.habilidades = copy.deepcopy(self.habilidades, memo)` (idem para `aliados`) e devolva o `clone`.',
        'No `criar` (mantenha o `/` da assinatura!), pegue o protótipo com `self._prototipos[nome]` — o `KeyError` sai de graça —, confira cada ajuste com `hasattr` e só então clone e aplique com `setattr`.',
      ],
      solution: `import copy
import itertools

_ids = itertools.count(1)


class Sprite:
    """Asset pesado (imagem carregada). Deve ser COMPARTILHADO entre clones."""
    def __init__(self, arquivo):
        self.arquivo = arquivo


class Inimigo:
    def __init__(self, nome, vida, habilidades, sprite):
        self.id = next(_ids)
        self.nome = nome
        self.vida = vida
        self.habilidades = habilidades
        self.sprite = sprite
        self.aliados = []

    def __deepcopy__(self, memo):
        clone = copy.copy(self)            # rasa: sprite continua compartilhado
        memo[id(self)] = clone             # antes de descer: protege os ciclos
        clone.id = next(_ids)
        clone.habilidades = copy.deepcopy(self.habilidades, memo)
        clone.aliados = copy.deepcopy(self.aliados, memo)
        return clone


class RegistroDePrototipos:
    def __init__(self):
        self._prototipos = {}

    def registrar(self, nome, prototipo):
        self._prototipos[nome] = prototipo

    def criar(self, nome, /, **ajustes):
        prototipo = self._prototipos[nome]          # KeyError se não existir
        for campo in ajustes:
            if not hasattr(prototipo, campo):
                raise AttributeError(f"o protótipo {nome!r} não tem o atributo {campo!r}")
        clone = copy.deepcopy(prototipo)
        for campo, valor in ajustes.items():
            setattr(clone, campo, valor)
        return clone
`,
      solutionExplanation: 'O `copy.copy(self)` cria o clone **sem chamar `__init__`**, com todos os atributos apontando para os mesmos objetos — por isso o `sprite` continua compartilhado sem esforço. Registrar `memo[id(self)] = clone` **antes** de descer é o que faz o ciclo de aliados funcionar: quando a recursão volta ao original, o `deepcopy` encontra o clone no memo em vez de copiar tudo de novo. As listas são copiadas **repassando o memo**, e o id novo vem do contador. O registro valida os ajustes antes de gastar a cópia e usa `setattr` para aplicá-los.',
    },
    {
      type: 'open',
      id: 'dp-pro-q5',
      concept: 'Cópia rasa',
      say: 'Última: um bug que todo time já teve. Me explica a causa e como você resolveria.',
      prompt: 'Um colega clona uma configuração-modelo com `copy.copy(modelo)` para cada cliente. De vez em quando, alterar a configuração de **um** cliente muda a de **outros**. Explique a causa e como você resolveria — e evitaria que voltasse a acontecer.',
      minWords: 15,
      rubric: [
        { label: 'Explica que a cópia **rasa** compartilha os objetos internos (aliasing)', keywords: ['rasa', 'shallow', 'compartilh', 'mesma referencia', 'mesmas referencias', 'mesmo objeto', 'mesma lista', 'mesmo dict', 'mesmo dicionario', 'alias'], concept: 'Cópia rasa', why: 'O objeto externo é novo, mas listas e dicts internos continuam sendo os mesmos.' },
        { label: 'Propõe **cópia profunda** (`deepcopy`)', keywords: ['deepcopy', 'deep copy', 'profunda', 'recursiv'], concept: 'Cópia profunda', why: 'Copiar recursivamente isola as estruturas aninhadas.' },
        { label: 'Menciona controlar a cópia com `__deepcopy__`/`__copy__` (o que copiar × compartilhar)', keywords: ['__deepcopy__', '__copy__', 'personaliz', 'customiz', 'memo', 'sobrescrev', 'o que copiar', 'o que compartilhar'], concept: 'Memo do deepcopy', why: 'Nem tudo deve ser copiado: recursos pesados ou não copiáveis podem ser compartilhados de propósito.' },
        { label: 'Sugere **imutabilidade** ou um teste para prevenir', keywords: ['imut', 'frozen', 'tupla', 'tuple', 'frozenset', 'mappingproxy', 'teste'], concept: 'Imutabilidade', why: 'Estruturas imutáveis tornam o compartilhamento seguro — não há o que vazar.' },
      ],
      modelAnswer: `A causa é **aliasing**: \`copy.copy\` faz uma cópia **rasa** — o objeto de configuração é novo, mas as listas e os dicionários internos continuam sendo **os mesmos objetos** do modelo. Quando um cliente faz \`config.limites["api"] = 10\`, está mexendo no dict compartilhado com o modelo e com todos os outros clones.

A correção imediata é usar \`copy.deepcopy(modelo)\`, que copia a estrutura recursivamente. Se a classe tiver algo que não deve ser copiado (um cliente HTTP, um lock, um asset pesado), implemento \`__deepcopy__\` para decidir o que copiar e o que **compartilhar**, repassando o \`memo\`.

Para prevenir, eu tornaria as partes da configuração **imutáveis** (tuplas, \`frozenset\`, \`@dataclass(frozen=True)\`, \`MappingProxyType\`) — imutáveis podem ser compartilhados sem risco — e escreveria um teste garantindo que alterar um clone não afeta o modelo nem os outros clones.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Agora você clona sem sustos: **alias** não é cópia, `copy.copy` compartilha os filhos e `deepcopy` copia o grafo inteiro — com o `memo` cuidando dos ciclos.',
        'E com `__deepcopy__` você decide o que copiar e o que compartilhar. Com isso fechamos os criacionais — próxima parada: os **estruturais**!',
      ],
      board: null,
    },
  ],
});
