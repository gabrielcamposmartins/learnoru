Game.registerModule('design-patterns', {
  id: 'strategy',
  title: 'Strategy',
  kind: 'lesson',
  level: 1,
  order: 30,
  unit: 'comportamentais',
  summary: 'Algoritmos intercambiáveis: de classes com Protocol a funções como estratégias.',
  concepts: ['Strategy', 'Protocol', 'Funções de primeira classe', 'Aberto/Fechado'],
  takeaways: [
    'O Strategy encapsula uma **família de algoritmos intercambiáveis** atrás da mesma interface; o **contexto** guarda a estratégia e só delega.',
    'Em Python, estratégia sem estado e com um único método é uma **função** — o `key=` de `sorted`, `max` e `min` é Strategy puro.',
    'Promova a estratégia a **classe** quando houver estado/configuração ou vários métodos relacionados; `Protocol` documenta o contrato sem exigir herança.',
    'Strategy cumpre o **Aberto/Fechado** e melhora os testes: cada algoritmo é testado isolado, e o contexto recebe estratégias falsas.',
    'Um `if` com dois ramos que nunca vai crescer **não** precisa de Strategy: o padrão se paga quando as variações se multiplicam ou mudam em runtime.',
  ],
  glossary: [
    { term: 'Strategy', aliases: ['padrão Strategy', 'Strategy pattern'], definition: 'Padrão comportamental do GoF (também chamado de *Policy*): encapsula uma família de algoritmos intercambiáveis atrás da mesma interface; o contexto guarda a estratégia escolhida e delega a ela.' },
    { term: 'Policy-based design', aliases: ['design baseado em políticas'], definition: 'Técnica de C++ popularizada por Andrei Alexandrescu (*Modern C++ Design*, 2001): estratégias ("policies") passadas como parâmetros de template e escolhidas em tempo de **compilação**.' },
    { term: 'Schwartzian transform', aliases: ['decorate-sort-undecorate', 'transformada de Schwartz'], definition: 'Técnica de ordenação que calcula a chave de cada elemento **uma única vez**, ordena pelos pares (chave, item) e descarta as chaves. É o que o `key=` do `sorted` faz por dentro. Homenagem a Randal Schwartz, do Perl.' },
    { term: 'cmp_to_key', aliases: ['functools.cmp_to_key'], definition: 'Função do `functools` que converte um comparador no estilo antigo, `(a, b)` → negativo/0/positivo, numa função `key=`. É um Adapter entre dois contratos de estratégia de ordenação.' },
    { term: 'Função de ordem superior', aliases: ['funções de ordem superior', 'higher-order function', 'higher-order functions'], definition: 'Função que recebe ou devolve outras funções, como `sorted(key=...)`, `map` e decoradores. É o que torna o Strategy quase "de graça" em Python.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'neutral',
      text: [
        'Imagine um e-commerce calculando frete. Começa com um `if`… e em seis meses vira isto aqui.',
      ],
      board: {
        title: 'O problema: o if/elif que só cresce',
        code: `def calcular_frete(pedido, modalidade):
    if modalidade == "pac":
        return pedido.peso * 1.5 + 10
    elif modalidade == "sedex":
        return pedido.peso * 3.0 + 20
    elif modalidade == "retirada":
        return 0
    elif modalidade == "transportadora":
        base = pedido.peso * 2.2
        return base * 0.9 if pedido.valor > 500 else base
    # ... e a Black Friday, e o frete grátis para VIP, e...`,
        caption: 'Toda regra nova mexe na mesma função — e arrisca quebrar as outras.',
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'O **Strategy** resolve isso: cada algoritmo vira uma **estratégia** separada, com a mesma interface.',
        'O objeto que usa o algoritmo — o **contexto** — só guarda uma referência para a estratégia e delega o cálculo.',
      ],
      board: {
        title: 'Strategy clássico com Protocol',
        code: `from typing import Protocol

class EstrategiaFrete(Protocol):
    def calcular(self, peso: float) -> float: ...


class Pac:
    def calcular(self, peso):
        return peso * 1.5 + 10

class Sedex:
    def calcular(self, peso):
        return peso * 3.0 + 20


class Pedido:                       # o contexto
    def __init__(self, peso, frete: EstrategiaFrete):
        self.peso = peso
        self.frete = frete

    def total_frete(self):
        return self.frete.calcular(self.peso)   # delega!


print(Pedido(2, Sedex()).total_frete())   # 26.0`,
        caption: '`Protocol` descreve a interface por estrutura (duck typing tipado) — as estratégias nem precisam herdar dela.',
      },
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Agora a mágica do Python: se a estratégia tem **um único método**, ela pode ser simplesmente uma **função**!',
        'Funções são objetos de primeira classe — dá para passá-las como parâmetro, guardar em atributos e em dicionários.',
      ],
      board: {
        title: 'Strategy pythônico: funções',
        code: `def pac(peso):      return peso * 1.5 + 10
def sedex(peso):    return peso * 3.0 + 20
def retirada(peso): return 0


class Pedido:
    def __init__(self, peso, frete=pac):
        self.peso = peso
        self.frete = frete          # guarda a FUNÇÃO

    def total_frete(self):
        return self.frete(self.peso)


p = Pedido(2)
p.frete = sedex                     # troca em runtime
p.frete = lambda peso: 0            # estratégia ad hoc

# escolha a partir de um valor externo:
MODALIDADES = {"pac": pac, "sedex": sedex, "retirada": retirada}
p.frete = MODALIDADES["sedex"]`,
      },
    },
    {
      type: 'say',
      text: [
        'Quando usar classe e quando usar função? Classes fazem sentido quando a estratégia tem **estado** ou **vários métodos** relacionados.',
        'Para um único cálculo sem estado, a função é mais simples — e simplicidade ganha.',
      ],
      board: {
        title: 'Classe ou função?',
        md: `| Use **função** quando… | Use **classe** quando… |
|---|---|
| A estratégia é um único cálculo | Há vários métodos relacionados (\`calcular\`, \`descricao\`, \`prazo\`) |
| Não há estado | A estratégia precisa de configuração/estado (\`Desconto(percentual=10)\`) |
| Você quer lambdas ad hoc | Você quer documentar a interface com \`Protocol\`/ABC |

**Benefícios do Strategy:**

- Cada algoritmo isolado e **testável** sozinho
- Novas estratégias sem mexer no contexto (**Aberto/Fechado**)
- Troca de comportamento **em tempo de execução**

> [!dica] Uma classe configurável também pode ser "chamável": defina \`__call__\` e ela se comporta como função.`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Você já usa Strategy todo dia: o `key=` do `sorted` é uma estratégia de comparação injetada!',
        'E a história desse parâmetro esconde um detalhe de desempenho que pouca gente conhece.',
      ],
      board: {
        title: 'Strategy na biblioteca padrão',
        md: `\`\`\`python
frutas = ["banana", "Kiwi", "abacaxi", "uva"]

sorted(frutas, key=len)          # ['uva', 'Kiwi', 'banana', 'abacaxi']
sorted(frutas, key=str.lower)    # ['abacaxi', 'banana', 'Kiwi', 'uva']
max(frutas, key=len)             # 'abacaxi'

import re
re.sub(r"\\d+", lambda m: str(int(m[0]) * 2), "3 maçãs e 10 peras")
# '6 maçãs e 20 peras' — a função de substituição é a estratégia

from functools import cmp_to_key
def por_tamanho(a, b):           # comparador "estilo antigo": negativo, 0 ou positivo
    return len(a) - len(b)
sorted(frutas, key=cmp_to_key(por_tamanho))
\`\`\`

| Estratégia injetada | Onde aparece |
|---|---|
| \`key=\` | \`sorted\`, \`min\`, \`max\`, \`heapq.nsmallest\`, \`itertools.groupby\` |
| \`default=\` | \`json.dumps\` (o que fazer com tipos desconhecidos) |
| função de substituição | \`re.sub\` |

> [!sabia] O GoF dá outro nome ao Strategy: **Policy** — em C++, isso virou o *policy-based design*. E o \`key=\` do Python esconde uma otimização clássica, a **Schwartzian transform** (ou *decorate-sort-undecorate*, homenagem a Randal Schwartz, do Perl): a função é chamada **uma vez por elemento**, e não a cada comparação. O antigo parâmetro \`cmp=\`, chamado O(n log n) vezes, sumiu no Python 3 — e o \`functools.cmp_to_key\`, que converte comparadores antigos, é… um **Adapter**.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Identifique, explique e implemente estratégias.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-strategy-q1',
      concept: 'Strategy',
      say: 'Qual destes cenários pede um Strategy?',
      prompt: 'Em qual cenário o **Strategy** é a escolha mais natural?',
      options: [
        { text: 'Um app de mapas que calcula rotas de carro, a pé ou de bicicleta, escolhidas pelo usuário.', correct: true, why: 'Vários algoritmos intercambiáveis para o mesmo objetivo, escolhidos em runtime — Strategy puro.' },
        { text: 'Garantir que exista apenas uma conexão com o banco.', why: 'Instância única é assunto do **Singleton** (ou, melhor, de injeção de dependência).' },
        { text: 'Avisar vários módulos quando um pedido é pago.', why: 'Notificar interessados sobre um evento é o **Observer**.' },
        { text: 'Converter a interface de uma biblioteca antiga para a que seu sistema espera.', why: 'Converter interfaces é o **Adapter**.' },
      ],
      explanation: 'Strategy encapsula uma **família de algoritmos intercambiáveis** e deixa o cliente escolher (ou trocar) qual usar.',
    },
    {
      type: 'mcq',
      id: 'dp-strategy-q2',
      concept: 'Funções de primeira classe',
      say: 'E em Python, qual a forma mais enxuta?',
      prompt: 'Você tem estratégias de ordenação de produtos **sem estado**, cada uma com uma única operação. Qual implementação é mais pythônica?',
      options: [
        { text: 'Uma classe abstrata `EstrategiaOrdenacao` com uma subclasse por critério.', why: 'Funciona, mas é cerimônia demais para um único método sem estado.' },
        { text: 'Funções como `por_preco(produto)` passadas como `key=` para `sorted`.', correct: true, why: 'É exatamente como a biblioteca padrão usa Strategy: `sorted(itens, key=estrategia)`.' },
        { text: 'Um grande `if/elif` dentro da função de ordenação.', why: 'É justamente o que o Strategy quer eliminar.' },
        { text: 'Um Singleton que guarda o critério atual.', why: 'Estado global para um critério de ordenação só adiciona acoplamento.' },
      ],
      explanation: 'O parâmetro `key` de `sorted`/`max`/`min` **é** um Strategy: você injeta a função que define o critério. Em Python, funções são a forma mais simples de estratégia.',
    },
    {
      type: 'code',
      id: 'dp-strategy-q3',
      concept: 'Strategy',
      title: 'Carrinho com estratégias de desconto',
      say: 'Hora de codar! Implemente as estratégias como **funções** e um carrinho que delega o desconto.',
      prompt: `Implemente três estratégias de desconto — **funções** que recebem o total e devolvem o total final:

- \`sem_desconto(total)\` → o próprio total
- \`black_friday(total)\` → 30% de desconto
- \`cupom_10(total)\` → R$ 10 a menos, **nunca abaixo de 0**

E a classe \`Carrinho(estrategia=sem_desconto)\`:

- \`adicionar(preco)\` adiciona um item;
- \`total()\` soma os itens e aplica a estratégia guardada no atributo \`estrategia\`.

O carrinho deve aceitar **qualquer** função como estratégia (inclusive \`lambda\`) e permitir trocá-la depois.`,
      starter: `def sem_desconto(total):
    pass


def black_friday(total):
    pass


def cupom_10(total):
    pass


class Carrinho:
    def __init__(self, estrategia=sem_desconto):
        pass

    def adicionar(self, preco):
        pass

    def total(self):
        pass
`,
      tests: [
        { name: 'sem desconto', setup: 'c = Carrinho()\nc.adicionar(50)\nc.adicionar(50)', expr: 'c.total()', expected: '100', compare: 'approx' },
        { name: 'black friday (30%)', setup: 'c = Carrinho(black_friday)\nc.adicionar(100)', expr: 'c.total()', expected: '70', compare: 'approx' },
        { name: 'cupom nunca negativo', setup: 'c = Carrinho(cupom_10)\nc.adicionar(5)', expr: 'c.total()', expected: '0', compare: 'approx' },
        { name: 'aceita lambda', code: 'c = Carrinho(lambda t: t / 2)\nc.adicionar(40)\nassert c.total() == 20, "o carrinho deve chamar a estratégia recebida"' },
        { name: 'trocar estratégia em runtime', hidden: true, code: 'c = Carrinho()\nc.adicionar(100)\nc.estrategia = cupom_10\nassert abs(c.total() - 90) < 1e-9' },
        { name: 'carrinhos independentes', hidden: true, code: 'a = Carrinho()\nb = Carrinho()\na.adicionar(10)\nassert b.total() == 0, "cada carrinho precisa da própria lista de itens"' },
      ],
      reviews: [
        {
          when: (m, code) => /\belif\b/.test(code) || /==\s*(black_friday|cupom_10|sem_desconto)\b/.test(code) || /estrategia\s*==/.test(code),
          text: 'O `Carrinho` compara qual estratégia recebeu (`if/elif`). A graça do Strategy é **delegar**: apenas chame `self.estrategia(soma)`.',
          concept: 'Strategy',
        },
        {
          when: m => m.calls.includes('isinstance'),
          text: 'Checar tipos com `isinstance` acopla o contexto às estratégias conhecidas. Qualquer *callable* deveria servir.',
          concept: 'Duck typing / polimorfismo',
        },
      ],
      hints: [
        'Guarde a estratégia e uma lista: `self.estrategia = estrategia` e `self.itens = []`.',
        'Em `total()`: `return self.estrategia(sum(self.itens))`.',
        'Para o cupom: `max(total - 10, 0)`.',
      ],
      solution: `def sem_desconto(total):
    return total


def black_friday(total):
    return total * 0.7


def cupom_10(total):
    return max(total - 10, 0)


class Carrinho:
    def __init__(self, estrategia=sem_desconto):
        self.estrategia = estrategia
        self.itens = []

    def adicionar(self, preco):
        self.itens.append(preco)

    def total(self):
        return self.estrategia(sum(self.itens))
`,
      solutionExplanation: 'O carrinho (contexto) não sabe **qual** desconto está aplicando — só chama a função guardada. Isso permite estratégias novas, lambdas e troca em tempo de execução sem tocar no `Carrinho`. Note também que `self.itens` é criado no `__init__`: uma lista no corpo da classe seria compartilhada por todos os carrinhos.',
    },
    {
      type: 'order',
      id: 'dp-rx-strategy-q5',
      concept: 'Refatoração para Strategy',
      say: 'Agora coloque em ordem: como refatorar aquele `if/elif` do frete para Strategy **sem quebrar nada**?',
      prompt: 'Ordene os passos para refatorar o `calcular_frete` cheio de `if/elif` para **Strategy**, com segurança.',
      items: [
        'Cobrir o comportamento atual com testes — um por ramo do `if/elif`',
        'Extrair cada ramo para uma função com a mesma assinatura (`pac(peso)`, `sedex(peso)`…)',
        'Criar o dicionário que mapeia cada modalidade à sua função',
        'Fazer o contexto receber a estratégia e apenas delegar a ela',
        'Apagar o `if/elif` antigo e rodar os testes de novo',
      ],
      explanation: 'Primeiro, a **rede de segurança**: sem testes, você não sabe se a refatoração mudou o comportamento. Depois, passos pequenos: extrair os ramos para funções com o **mesmo contrato**, registrá-las num dicionário, fazer o contexto delegar e, só no fim, apagar o condicional — com os testes verdes a cada passo. Martin Fowler chama o movimento geral de **Replace Conditional with Polymorphism**.',
    },
    {
      type: 'open',
      id: 'dp-strategy-q4',
      concept: 'Aberto/Fechado',
      say: 'Última: conecte o Strategy aos princípios de design.',
      prompt: 'Explique como o **Strategy** ajuda a cumprir o **Princípio Aberto/Fechado** e por que isso facilita testes.',
      minWords: 12,
      rubric: [
        { label: 'Novas estratégias **sem modificar** o contexto', keywords: ['sem modificar', 'sem alterar', 'sem mexer', 'nao modifica', 'nao precisa alterar', 'nao precisa mudar', 'nova estrategia', 'novas estrategias', 'adicionar'], concept: 'Aberto/Fechado', why: 'Aberto para extensão (nova estratégia), fechado para modificação (o contexto fica intacto).' },
        { label: 'Elimina a cadeia de **if/elif**', keywords: ['elif', ' if ', 'ifs', 'condicion', 'switch'], concept: 'Strategy', why: 'As condicionais viram polimorfismo/delegação.' },
        { label: 'Cada estratégia pode ser **testada isoladamente**', keywords: ['isolad', 'separad', 'individual', 'unitari', 'sozinh'], concept: 'Testabilidade', why: 'Cada algoritmo é uma unidade pequena com entrada e saída claras.' },
        { label: 'Permite injetar estratégias **falsas/mock** ou trocar em runtime', keywords: ['mock', 'fake', 'falsa', 'dubl', 'injet', 'runtime', 'execucao', 'trocar'], concept: 'Injeção de dependência', why: 'O contexto recebe a estratégia, então o teste pode passar uma versão controlada.' },
      ],
      modelAnswer: `No Strategy, cada algoritmo fica numa estratégia separada com a mesma interface, e o contexto apenas **delega**. Para adicionar um comportamento novo, basta criar uma **nova estratégia sem modificar** o contexto — o código fica aberto para extensão e fechado para modificação. A cadeia de \`if/elif\` desaparece.

Nos testes, cada estratégia pode ser **testada isoladamente** (entrada → saída). E como o contexto **recebe** a estratégia (injeção), dá para passar uma estratégia **falsa/mock** e testar o contexto sem depender das regras reais.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Excelente! Strategy = **algoritmos intercambiáveis** atrás de uma mesma interface, com o contexto delegando.',
        'Em Python, comece com **funções**; promova a classes quando houver estado ou vários métodos. Próximo: Observer!',
      ],
      board: null,
    },
  ],
});
