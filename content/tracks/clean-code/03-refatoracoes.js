(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const BONUS_SETA = py(`
    def calcular_bonus(funcionario):
        if funcionario is not None:
            if funcionario["ativo"]:
                if funcionario["meses_de_casa"] >= 12:
                    if funcionario["avaliacao"] >= 4:
                        bonus = funcionario["salario"] * 0.2
                    else:
                        if funcionario["avaliacao"] >= 3:
                            bonus = funcionario["salario"] * 0.1
                        else:
                            bonus = 0
                    if funcionario["cargo"] == "gerente":
                        bonus = bonus + 1000
                    return round(bonus, 2)
                else:
                    return 0
            else:
                return 0
        else:
            raise ValueError("funcionário ausente")


    # TODO: extraia elegivel_a_bonus e percentual_do_bonus, use guard clauses
    #       e dê nome aos números mágicos — sem mudar nenhum resultado.
  `);

  const FOLHA_SWITCH = py(`
    def salario_liquido(funcionario):
        if funcionario["tipo"] == "clt":
            return round(funcionario["salario"] * 0.89 - 180, 2)
        elif funcionario["tipo"] == "pj":
            return round(funcionario["valor_nota"] * 0.94, 2)
        elif funcionario["tipo"] == "estagiario":
            return funcionario["bolsa"]
        raise ValueError(f"tipo desconhecido: {funcionario['tipo']}")


    def descricao(funcionario):
        if funcionario["tipo"] == "clt":
            return funcionario["nome"] + " (CLT)"
        elif funcionario["tipo"] == "pj":
            return funcionario["nome"] + " (PJ)"
        elif funcionario["tipo"] == "estagiario":
            return funcionario["nome"] + " (estágio)"
        raise ValueError(f"tipo desconhecido: {funcionario['tipo']}")


    def ferias_remuneradas(funcionario):
        if funcionario["tipo"] == "clt":
            return True
        elif funcionario["tipo"] == "pj":
            return False
        elif funcionario["tipo"] == "estagiario":
            return True
        raise ValueError(f"tipo desconhecido: {funcionario['tipo']}")


    def folha_de_pagamento(funcionarios):
        return round(sum(salario_liquido(f) for f in funcionarios), 2)


    # TODO: Funcionario (base) + Clt, Pj e Estagiario, criar_funcionario(dados)
    #       e uma folha_de_pagamento que não pergunta o tipo de ninguém.
  `);

  Game.registerModule('clean-code', {
    id: 'refatoracoes',
    title: 'Catálogo de refatorações',
    kind: 'lesson',
    level: 2,
    order: 10,
    unit: 'refatoracao',
    summary: 'Refatorar é mudar a estrutura sem mudar o comportamento — sob testes e em passos pequenos. Extract Function, Guard Clauses, Replace Conditional with Polymorphism, Parameter Object e o Método Mikado para as mudanças grandes.',
    concepts: ['Refatoração', 'Dois chapéus', 'Guard clauses', 'Replace Conditional with Polymorphism', 'Método Mikado'],
    takeaways: [
      'Refatorar é mudar a **estrutura** sem mudar o **comportamento observável**, em passos pequenos e com os testes verdes o tempo todo. Se o sistema fica quebrado por dias, não é refatoração.',
      '**Dois chapéus** (Kent Beck): ou você adiciona funcionalidade, ou refatora — nunca os dois no mesmo passo nem no mesmo commit.',
      '*Extract Function* quando custa esforço entender um trecho; *Inline Function* quando a indireção não se paga; *Rename* sempre que você aprender um nome melhor.',
      '*Guard clauses* achatam o código em seta: trate os casos especiais primeiro e deixe o caminho principal sem aninhamento.',
      '*Replace Conditional with Polymorphism* troca o **mesmo** switch repetido por classes — a decisão por tipo sobrevive uma única vez, na fábrica. Para mudanças grandes, use Mikado, *parallel change* ou *branch by abstraction*.',
    ],
    glossary: [
      { term: 'Refatoração', aliases: ['refactoring', 'refatoracao'], definition: 'Mudança na estrutura interna do software para torná-lo mais fácil de entender e de modificar **sem alterar seu comportamento observável** (Martin Fowler). Feita em passos pequenos, com os testes verdes a cada passo.' },
      { term: 'Dois chapéus', aliases: ['two hats', 'metáfora dos dois chapéus', 'metafora dos dois chapeus'], definition: 'Metáfora de Kent Beck: ao programar você usa um chapéu de cada vez — o de **adicionar funcionalidade** (testes novos, comportamento novo) ou o de **refatorar** (mesmo comportamento, estrutura melhor). Nunca os dois juntos.' },
      { term: 'Guard clause', aliases: ['guard clauses', 'cláusula de guarda', 'cláusulas de guarda', 'clausula de guarda', 'clausulas de guarda'], definition: 'Verificação no início da função que trata um caso especial e sai cedo (`return`/`raise`), deixando o caminho principal sem aninhamento. Refatoração: *Replace Nested Conditional with Guard Clauses*.' },
      { term: 'Refatoração preparatória', aliases: ['preparatory refactoring', 'refatoracao preparatoria'], definition: 'Refatorar **antes** de uma mudança para que ela fique fácil. Kent Beck: "primeiro torne a mudança fácil (isso pode ser difícil), depois faça a mudança fácil".' },
      { term: 'Método Mikado', aliases: ['Mikado Method', 'metodo mikado'], definition: 'Técnica para refatorações grandes (Ellnestam e Brolund): tente a mudança; se quebrar, anote os pré-requisitos num grafo, **reverta** e resolva primeiro as folhas. O código fica sempre verde e integrável.' },
      { term: 'Parallel Change', aliases: ['expand/contract', 'expand and contract', 'mudança paralela', 'mudanca paralela'], definition: 'Mudança de interface em três fases: **expandir** (o novo convive com o antigo), **migrar** os chamadores aos poucos e **contrair** (apagar o antigo). Permite mudanças grandes sem quebrar ninguém no meio do caminho.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Nesta unidade saímos do diagnóstico e partimos para o tratamento: **refatoração**.',
          'E a primeira lição é a mais importante: refatorar **não** muda o que o código faz.',
        ],
        board: {
          title: 'O que é (e o que não é) refatorar',
          md: `> *Refatoração*: uma mudança na estrutura interna do software para torná-lo mais fácil de entender e mais barato de modificar, **sem alterar seu comportamento observável**. — Martin Fowler

| É refatorar | Não é refatorar |
|---|---|
| extrair um trecho para uma função com nome | "aproveitar" para corrigir um bug no caminho |
| renomear uma variável no projeto inteiro | mudar a regra de arredondamento |
| trocar um switch repetido por polimorfismo | otimizar trocando o algoritmo (outra atividade, outros testes) |
| mover um método para a classe certa | reescrever o módulo do zero numa branch por um mês |

**Comportamento observável** = o que quem chama consegue ver: retornos, exceções, efeitos (banco, e-mail, eventos). A estrutura interna — e às vezes o desempenho — pode mudar.

> [!atencao] Se alguém diz "o sistema ficou quebrado dois dias porque estávamos refatorando", aquilo **não** era refatoração. Refatorar é uma sequência de passos pequenos que mantêm tudo funcionando o tempo todo.

> [!sabia] O termo ganhou forma acadêmica em 1992, na tese de doutorado de **William Opdyke**, orientada por Ralph Johnson (um dos quatro autores de *Design Patterns*). Ele definiu refatorações como transformações que **preservam o comportamento** e mostrou como verificá-las automaticamente — a semente dos botões *Rename* e *Extract Method* das IDEs de hoje.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Kent Beck tem uma metáfora ótima: programar é alternar entre **dois chapéus**.',
          'Com um, você adiciona funcionalidade. Com o outro, você refatora. **Nunca** os dois ao mesmo tempo.',
        ],
        board: {
          title: 'Dois chapéus, passos pequenos',
          md: `\`\`\`text
 chapéu "funcionalidade"             chapéu "refatoração"
 - escreve testes novos              - não adiciona comportamento
 - muda o comportamento              - não muda o comportamento
 - vermelho, depois verde            - verde o tempo TODO
\`\`\`

O ciclo da refatoração segura:

\`\`\`text
 testes verdes -> um passo pequeno -> rodar os testes -+-> verde: commit -> próximo passo
       ^                                               |
       +------------ vermelho: DESFAÇA (não depure) ---+
\`\`\`

- Passos **pequenos** o bastante para que, se algo quebrar, desfazer seja mais rápido que depurar.
- Um commit a cada passo verde: o histórico vira uma trilha de migalhas (e o \`git bisect\` agradece).
- Automatize: *Rename*, *Extract* e *Inline* da IDE são mais seguros que editar à mão.

**Quando refatorar?**
- **preparatória**: antes de uma feature — "primeiro torne a mudança fácil (isso pode ser difícil), depois faça a mudança fácil" (Kent Beck);
- **de compreensão**: se você precisou de esforço para entender algo, deixe o entendimento no código;
- **de limpeza**: a regra do escoteiro, um pouco a cada visita;
- **regra de três**: na terceira repetição, abstraia.

**Quando não?** Código que funciona e que ninguém precisa entender nem mudar — ou quando reescrever é mesmo mais barato.`,
        },
      },
      {
        type: 'say',
        text: [
          'As três refatorações mais usadas do catálogo: **Extract Function**, **Inline Function** e **Rename**.',
          'Parecem simples — e são. O poder está em fazê-las o tempo todo.',
        ],
        board: {
          title: 'Extract, Inline e Rename',
          md: `**Extract Function** — separe *intenção* de *implementação*. Se você precisa de esforço para entender o que um trecho faz, extraia-o e dê a ele o nome do que ele faz.

\`\`\`python
def imprimir_fatura(fatura):
    imprimir_cabecalho()
    # calcula o valor em aberto
    em_aberto = 0
    for pedido in fatura.pedidos:
        em_aberto += pedido.valor
    print(f"Cliente: {fatura.cliente}  Em aberto: {em_aberto}")
\`\`\`

\`\`\`python
def imprimir_fatura(fatura):
    imprimir_cabecalho()
    imprimir_detalhes(fatura, valor_em_aberto(fatura))

def valor_em_aberto(fatura):
    return sum(pedido.valor for pedido in fatura.pedidos)
\`\`\`

**Inline Function** — o inverso: quando o corpo é tão claro quanto o nome, ou a indireção só atrapalha.

\`\`\`python
def nota(motorista):
    return 2 if mais_de_cinco_atrasos(motorista) else 1

def mais_de_cinco_atrasos(motorista):     # usada só aqui: vale um inline
    return motorista.atrasos > 5
\`\`\`

**Rename** (*Change Function Declaration*, *Rename Variable*) — o nome melhor aparece quando você entende o código; não guarde esse entendimento só na sua cabeça. Em API pública, renomeie com **migração**: crie o nome novo, faça o antigo delegar (com um \`DeprecationWarning\`), migre os chamadores e só então apague o antigo.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora, a refatoração que mais melhora a leitura por linha alterada: **guard clauses**.',
          'Sabe aquele código em forma de seta, com `if` dentro de `if` dentro de `if`? Dá para achatar.',
        ],
        board: {
          title: 'Replace Nested Conditional with Guard Clauses',
          md: `\`\`\`python
def valor_a_pagar(conta):                    # código em seta
    if conta.ativa:
        if not conta.isenta:
            if conta.saldo_devedor > 0:
                return conta.saldo_devedor + multa(conta)
            else:
                return 0
        else:
            return 0
    else:
        raise ContaInativa(conta.id)
\`\`\`

\`\`\`python
def valor_a_pagar(conta):                    # guard clauses
    if not conta.ativa:
        raise ContaInativa(conta.id)
    if conta.isenta or conta.saldo_devedor <= 0:
        return 0
    return conta.saldo_devedor + multa(conta)
\`\`\`

- Casos especiais **primeiro**, cada um saindo cedo (\`return\`/\`raise\`); o caminho principal fica no fim, sem indentação.
- A leitura vira uma lista de condições, não uma árvore que você precisa manter na cabeça.
- Use \`if/else\` quando os dois ramos forem **igualmente normais**; use guard clause quando um deles for a **exceção**.

> [!sabia] A regra do "um único ponto de saída" (*single entry, single exit*) vem da programação estruturada e fazia sentido em C e assembly, onde sair cedo podia pular a liberação de memória ou de um *lock*. Em Python, \`with\` e \`try/finally\` garantem a limpeza — e o retorno antecipado deixa o código mais claro, não menos.`,
        },
      },
      {
        type: 'say',
        text: [
          'Quando o **mesmo** `if tipo == ...` aparece em várias funções, o código está pedindo classes.',
          { text: 'Cuidado: a ideia não é caçar todo `if`. É eliminar o switch **repetido**.', mood: 'thinking' },
        ],
        board: {
          title: 'Replace Conditional with Polymorphism',
          md: `\`\`\`python
def area(forma):
    if forma["tipo"] == "circulo":
        return pi * forma["raio"] ** 2
    elif forma["tipo"] == "retangulo":
        return forma["largura"] * forma["altura"]

def perimetro(forma):
    if forma["tipo"] == "circulo":           # o mesmo switch, de novo…
        ...
\`\`\`

\`\`\`python
class Forma(ABC):
    @abstractmethod
    def area(self): ...

class Circulo(Forma):
    def __init__(self, raio):
        self.raio = raio

    def area(self):
        return pi * self.raio ** 2

class Retangulo(Forma):
    def __init__(self, largura, altura):
        self.largura, self.altura = largura, altura

    def area(self):
        return self.largura * self.altura

def area_total(formas):
    return sum(forma.area() for forma in formas)     # nenhum if!
\`\`\`

- Um tipo novo = **uma classe nova**, sem editar \`area_total\` (aberto para extensão, fechado para modificação).
- A decisão por tipo não desaparece: ela sobrevive **uma vez**, na fábrica que cria os objetos a partir dos dados.
- Um \`if\` ou \`match\` isolado? Deixe como está — ou use um \`dict\` de funções. O polimorfismo se paga quando o switch se **repete**.`,
        },
      },
      {
        type: 'say',
        text: [
          'Mais algumas do catálogo, rápidas e muito úteis.',
          'Todas atacam cheiros que você já conhece: *data clumps*, números mágicos e condições difíceis de ler.',
        ],
        board: {
          title: 'Parameter Object, Magic Literal e amigas',
          md: `| Refatoração | Antes | Depois |
|---|---|---|
| **Introduce Parameter Object** | \`relatorio(vendas, inicio, fim)\` | \`relatorio(vendas, periodo)\` |
| **Replace Magic Literal** | \`if nota >= 7:\` | \`if nota >= NOTA_MINIMA_APROVACAO:\` |
| **Preserve Whole Object** | \`cabe(cli.limite, cli.gasto)\` | \`cabe(cli)\` |
| **Decompose Conditional** | \`if data < INICIO_VERAO or data > FIM_VERAO:\` | \`if fora_da_temporada(data):\` |
| **Replace Temp with Query** | \`base = qtd * preco\` reusado em vários pontos | um método \`preco_base()\` |

\`\`\`python
# Introduce Parameter Object: o grupo ganha nome, validação e comportamento
@dataclass(frozen=True)
class Periodo:
    inicio: date
    fim: date

    def contem(self, dia):
        return self.inicio <= dia < self.fim

def relatorio(vendas, periodo):
    return [venda for venda in vendas if periodo.contem(venda.data)]
\`\`\`

> [!dica] Um *parameter object* raramente fica "só com dados". Assim que \`Periodo\` existe, funções como \`noites()\` e \`contem(dia)\` migram para ele — é assim que objetos de domínio ricos costumam nascer.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'E quando a refatoração é **grande** demais para um passo só?',
          'A resposta não é uma branch de três semanas. É quebrar em muitos passos pequenos — e existe método para isso.',
        ],
        board: {
          title: 'Refatorações grandes: Mikado e companhia',
          md: `**Método Mikado** — para quando cada mudança puxa outra:

\`\`\`text
                  [ objetivo: trocar o ORM ]
                   /                      \\
      [ isolar as consultas ]       [ tirar SQL do Pedido ]
         /             \\                    |
 [ extrair Repo ]  [ injetar Repo ]   [ extrair CalculoFrete ]
\`\`\`

1. Tente a mudança-objetivo direto.
2. Quebrou? Anote no grafo **o que precisaria existir antes** e **reverta** (sim, jogue fora).
3. Repita a partir de cada pré-requisito, até chegar a folhas que dá para fazer com tudo verde.
4. Resolva as folhas uma a uma (commit a cada uma) e suba pelo grafo até o objetivo.

Outras técnicas para mudanças grandes sem parar o time:
- **Parallel Change** (*expand/contract*): crie o novo ao lado do antigo, migre os chamadores aos poucos, apague o antigo.
- **Branch by Abstraction**: coloque uma abstração na frente do código a trocar, crie a nova implementação atrás dela e vire a chave (às vezes com *feature flag*) — tudo na branch principal, integrando todo dia.

> [!sabia] O nome vem do **Mikado**, o pega-varetas: para tirar a vareta que você quer, primeiro precisa remover as que estão por cima sem mexer no resto. O método foi descrito por Ola Ellnestam e Daniel Brolund no livro *The Mikado Method* (2014).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Reconhecer refatorações, seguir a mecânica e refatorar duas funções de verdade.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'cc-ref-q1',
        concept: 'Dois chapéus',
        say: 'Primeiro, um review. Esse PR diz que é "só refatoração"…',
        prompt: `Um PR chamado **"Refatora cálculo de frete"** tem três commits:

1. extrai \`peso_total()\` de dentro de \`frete()\`;
2. renomeia \`calc_f\` para \`frete\` em todo o projeto;
3. muda o arredondamento de \`round(x, 1)\` para \`round(x, 2)\`, "aproveitando que já estava mexendo".

O que você comenta no review?`,
        options: [
          { text: '(1) e (2) são refatorações; (3) muda o comportamento observável. Deve sair deste PR e virar uma mudança própria, com teste e descrição (dois chapéus).', correct: true, why: 'Misturar os chapéus esconde uma mudança de regra dentro de um PR "sem efeito". Se o arredondamento novo causar um problema, ninguém vai procurar num PR de refatoração.' },
          { text: 'Tudo é refatoração, porque o código ficou melhor.', why: '"Melhor" não é o critério. O critério é **não mudar o comportamento observável** — e o valor devolvido por `frete()` mudou.' },
          { text: 'Só (1) é refatoração; renomear não muda a estrutura, então não conta.', why: 'Rename é uma das refatorações mais importantes (e mais frequentes) do catálogo: muda a estrutura do código (os nomes) sem mudar o comportamento.' },
          { text: 'Nada disso é refatoração: refatorar é reescrever o módulo com um design melhor.', why: 'Reescrever é outra coisa. Refatoração é uma sequência de passos **pequenos** que preservam o comportamento — exatamente como (1) e (2).' },
        ],
        explanation: 'Refatorar = mudar a estrutura **sem** mudar o comportamento. Quando uma mudança de regra pega carona num PR de refatoração, o revisor lê com a guarda baixa, os testes que falham parecem "efeito da refatoração" e o `git bisect` aponta para um commit enorme. Separe: um PR (ou pelo menos um commit) por chapéu.',
      },
      {
        type: 'order',
        id: 'cc-ref-q2',
        concept: 'Extract Function',
        say: 'Agora a mecânica. Na refatoração, a ordem dos passos é o que garante a segurança.',
        prompt: 'Ordene os passos de um **Extract Function** seguro, na mecânica descrita por Fowler.',
        items: [
          'Garantir que os testes estão verdes antes de começar',
          'Criar a função nova com um nome que diga a intenção (o quê, não o como)',
          'Copiar o trecho para dentro da função nova',
          'Transformar as variáveis locais usadas pelo trecho em parâmetros (e o resultado em retorno)',
          'Substituir o trecho original por uma chamada à função nova',
          'Rodar os testes e fazer commit',
        ],
        explanation: 'Repare que o código original só é tocado **no fim**: até o penúltimo passo, você apenas criou código novo ao lado do antigo. Se algo der errado, basta desfazer um passo. E os testes rodam antes (para saber que você parte do verde) e depois (para saber que o comportamento se manteve). IDEs automatizam esses passos — mas entender a mecânica ajuda quando a ferramenta não consegue.',
      },
      {
        type: 'match',
        id: 'cc-ref-q3',
        concept: 'Catálogo de refatorações',
        say: 'Hora de usar o catálogo como vocabulário: qual refatoração cada situação pede?',
        prompt: 'Associe cada **situação** à **refatoração** mais indicada.',
        pairs: [
          { left: 'Quatro `if` aninhados só para validar a entrada antes do cálculo', right: 'Replace Nested Conditional with Guard Clauses' },
          { left: 'O mesmo `if tipo == "clt" … elif tipo == "pj"` aparece em cinco funções', right: 'Replace Conditional with Polymorphism' },
          { left: '`inicio, fim` viajam juntos em todas as assinaturas', right: 'Introduce Parameter Object' },
          { left: '`if nota >= 7` espalhado pelo código para decidir a aprovação', right: 'Replace Magic Literal' },
          { left: '`mais_de_cinco_atrasos(m)`, usada uma vez, cujo corpo é só `return m.atrasos > 5`', right: 'Inline Function' },
          { left: 'Um bloco de 15 linhas precedido por `# calcula os impostos`', right: 'Extract Function' },
        ],
        explanation: 'O catálogo funciona como um vocabulário compartilhado: "isso pede um *Introduce Parameter Object*" comunica numa frase o problema e o plano. Note que *Extract* e *Inline* são inversos — nenhuma refatoração é "sempre boa"; cada uma resolve um problema específico de leitura ou de mudança.',
      },
      {
        type: 'code',
        id: 'cc-ref-q4',
        concept: 'Guard clauses',
        title: 'Achatando a seta do bônus',
        points: 50,
        say: 'Primeira refatoração guiada! Os testes ocultos comparam tudo com a versão original — o comportamento não pode mudar.',
        prompt: `A função \`calcular_bonus\` funciona, mas tem o formato de **seta**: quatro níveis de \`if\`, e cada \`else\` fica lá embaixo, longe da condição que o originou.

Refatore **sem mudar nenhum resultado** (inclusive os estranhos: \`"Gerente"\` com maiúscula não ganha o valor fixo):

1. **Extract Function** — \`elegivel_a_bonus(funcionario)\`: ativo **e** com pelo menos 12 meses de casa.
2. **Extract Function** — \`percentual_do_bonus(avaliacao)\`: 0,2 para nota ≥ 4; 0,1 para nota ≥ 3; senão 0.
3. **Guard clauses** em \`calcular_bonus\`: trate \`None\` (→ \`ValueError\`) e os não elegíveis (→ \`0\`) primeiro; o cálculo principal fica sem aninhamento e **usa** as duas funções extraídas.
4. **Replace Magic Literal** — dê nome aos números das regras de RH (12, 0,2, 0,1 e 1000).`,
        starter: BONUS_SETA,
        tests: [
          { name: 'nota 5, dev: 20% do salário', expr: 'calcular_bonus({"ativo": True, "meses_de_casa": 24, "avaliacao": 5, "salario": 8000.0, "cargo": "dev"})', expected: '1600.0', compare: 'approx' },
          { name: 'nota 3, gerente: 10% + fixo', expr: 'calcular_bonus({"ativo": True, "meses_de_casa": 12, "avaliacao": 3, "salario": 10000.0, "cargo": "gerente"})', expected: '2000.0', compare: 'approx' },
          {
            name: 'sem bônus: inativo ou com menos de 12 meses; None lança ValueError',
            code: py(`
              base = {"ativo": True, "meses_de_casa": 30, "avaliacao": 5, "salario": 5000.0, "cargo": "dev"}
              assert calcular_bonus(dict(base, ativo=False)) == 0
              assert calcular_bonus(dict(base, meses_de_casa=11)) == 0
              try:
                  calcular_bonus(None)
              except ValueError:
                  pass
              else:
                  raise AssertionError("funcionário ausente (None) deveria lançar ValueError")
            `),
          },
          {
            name: 'funções extraídas',
            code: py(`
              assert percentual_do_bonus(5) == 0.2 and percentual_do_bonus(4) == 0.2
              assert percentual_do_bonus(3) == 0.1
              assert percentual_do_bonus(2) == 0 and percentual_do_bonus(1) == 0
              assert elegivel_a_bonus({"ativo": True, "meses_de_casa": 12})
              assert not elegivel_a_bonus({"ativo": True, "meses_de_casa": 11})
              assert not elegivel_a_bonus({"ativo": False, "meses_de_casa": 40})
            `),
          },
          {
            name: 'mesmo resultado da versão original (caracterização)',
            hidden: true,
            code: py(`
              def _original(funcionario):
                  if funcionario is not None:
                      if funcionario["ativo"]:
                          if funcionario["meses_de_casa"] >= 12:
                              if funcionario["avaliacao"] >= 4:
                                  bonus = funcionario["salario"] * 0.2
                              elif funcionario["avaliacao"] >= 3:
                                  bonus = funcionario["salario"] * 0.1
                              else:
                                  bonus = 0
                              if funcionario["cargo"] == "gerente":
                                  bonus = bonus + 1000
                              return round(bonus, 2)
                          return 0
                      return 0
                  raise ValueError("funcionário ausente")

              for ativo in (True, False):
                  for meses in (0, 11, 12, 13, 60):
                      for nota in (1, 2, 3, 4, 5):
                          for cargo in ("dev", "gerente", "Gerente"):
                              for salario in (3000.0, 4567.89, 12345.67):
                                  f = {"ativo": ativo, "meses_de_casa": meses, "avaliacao": nota,
                                       "salario": salario, "cargo": cargo}
                                  esperado, obtido = _original(f), calcular_bonus(f)
                                  assert abs(obtido - esperado) < 1e-6, f"{f}: o original dava {esperado}, a refatoração deu {obtido}"
            `),
          },
          {
            name: 'calcular_bonus usa as funções extraídas',
            hidden: true,
            code: py(`
              import types

              def _nomes_usados(funcao):
                  nomes, pilha = set(), [funcao.__code__]
                  while pilha:
                      codigo = pilha.pop()
                      nomes.update(codigo.co_names)
                      pilha.extend(c for c in codigo.co_consts if isinstance(c, types.CodeType))
                  return nomes

              usados = _nomes_usados(calcular_bonus)
              for extraida in ("elegivel_a_bonus", "percentual_do_bonus"):
                  assert extraida in usados, f"calcular_bonus deve chamar {extraida}() — senão a lógica continua duplicada lá dentro"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.maxNesting >= 3,
            text: 'Ainda há **3 ou mais níveis de aninhamento** — a seta continua lá. Trate os casos especiais primeiro com *guard clauses* (`if funcionario is None: raise ...`, `if not elegivel_a_bonus(...): return 0`) e deixe o caminho principal reto.',
            concept: 'Guard clauses',
          },
          {
            when: m => m.funcs.some(f => f.name === 'calcular_bonus' && f.complexity > 4),
            text: '`calcular_bonus` ainda concentra decisões demais (complexidade ciclomática acima de 4). A escolha do percentual deveria morar só em `percentual_do_bonus`.',
            concept: 'Extract Function',
          },
          {
            when: (m, code) => /^[ \t]+[^#\n]*(\b0\.[12]\b|\b1000\b|>=\s*12\b)/m.test(code),
            text: 'Ainda há **números mágicos** dentro das funções (12, 0.2, 0.1, 1000). São regras de RH: dê nome a elas (`MESES_MINIMOS_PARA_BONUS`, `BONUS_FIXO_GERENTE`…) para que mudem num lugar só.',
            concept: 'Replace Magic Literal',
          },
        ],
        hints: [
          'Comece pelas extrações, que não mexem no resto: `elegivel_a_bonus` devolve `funcionario["ativo"] and funcionario["meses_de_casa"] >= MESES_MINIMOS_PARA_BONUS`; `percentual_do_bonus` são dois `if` com `return` e um `return 0.0` no fim.',
          'Agora as *guard clauses*: `if funcionario is None: raise ValueError(...)` e `if not elegivel_a_bonus(funcionario): return 0`. Depois delas, você já sabe que o funcionário é elegível — nada de `else`.',
          'O caminho principal: `bonus = funcionario["salario"] * percentual_do_bonus(funcionario["avaliacao"])`, some o fixo se o cargo for exatamente `"gerente"` e `return round(bonus, 2)`. Mantenha a mesma ordem das contas para os centavos baterem.',
        ],
        solution: py(`
          MESES_MINIMOS_PARA_BONUS = 12
          NOTA_EXCELENTE = 4
          NOTA_BOA = 3
          PERCENTUAL_NOTA_EXCELENTE = 0.2
          PERCENTUAL_NOTA_BOA = 0.1
          BONUS_FIXO_GERENTE = 1000


          def elegivel_a_bonus(funcionario):
              return funcionario["ativo"] and funcionario["meses_de_casa"] >= MESES_MINIMOS_PARA_BONUS


          def percentual_do_bonus(avaliacao):
              if avaliacao >= NOTA_EXCELENTE:
                  return PERCENTUAL_NOTA_EXCELENTE
              if avaliacao >= NOTA_BOA:
                  return PERCENTUAL_NOTA_BOA
              return 0.0


          def calcular_bonus(funcionario):
              if funcionario is None:
                  raise ValueError("funcionário ausente")
              if not elegivel_a_bonus(funcionario):
                  return 0
              bonus = funcionario["salario"] * percentual_do_bonus(funcionario["avaliacao"])
              if funcionario["cargo"] == "gerente":
                  bonus += BONUS_FIXO_GERENTE
              return round(bonus, 2)
        `),
        solutionExplanation: 'As duas extrações deram nome às regras escondidas na seta: "quem é elegível" e "quanto vale cada nota". Com elas, `calcular_bonus` virou uma lista de *guard clauses* (ausente → erro; não elegível → 0) seguida do caminho principal, sem nenhum `else` e com aninhamento máximo 1 — a complexidade caiu de 7 para 4. As constantes transformam números soltos em regras que dá para buscar e mudar num lugar só. Repare no que **não** mudou: `"Gerente"` com maiúscula continua sem o fixo e as contas seguem na mesma ordem (salário × percentual, depois o fixo, depois o arredondamento). Se a regra do cargo estiver errada, a correção é outra mudança, com o outro chapéu.',
      },
      {
        type: 'code',
        id: 'cc-ref-q5',
        concept: 'Replace Conditional with Polymorphism',
        title: 'Folha de pagamento sem switch',
        points: 60,
        say: 'Segunda refatoração guiada: o mesmo switch em três funções. Hora do polimorfismo!',
        prompt: `A folha de pagamento decide tudo por \`funcionario["tipo"]\` — e o **mesmo switch** aparece em três funções. Adicionar um tipo novo (freelancer, temporário…) exige caçar todos esses \`if\`s: *Shotgun Surgery* garantido.

Aplique **Replace Conditional with Polymorphism**:

- Classe base \`Funcionario\`, com o \`nome\` e a interface \`salario_liquido()\`, \`descricao()\` e \`ferias_remuneradas()\`.
- Subclasses \`Clt(nome, salario)\`, \`Pj(nome, valor_nota)\` e \`Estagiario(nome, bolsa)\`, com **os mesmos resultados** das funções atuais.
- \`criar_funcionario(dados)\` — a fábrica que converte os dicionários antigos no objeto certo. É o **único** lugar que ainda olha \`dados["tipo"]\` (tipo desconhecido → \`ValueError\`).
- \`folha_de_pagamento(funcionarios)\` — recebe **objetos** e soma os salários líquidos (2 casas), sem perguntar o tipo de ninguém.`,
        starter: FOLHA_SWITCH,
        tests: [
          { name: 'CLT: 89% do salário menos 180 de vale-transporte', expr: 'Clt("Ana", 5000.0).salario_liquido()', expected: '4270.0', compare: 'approx' },
          { name: 'PJ: 94% da nota', expr: 'Pj("Bia", 8000.0).salario_liquido()', expected: '7520.0', compare: 'approx' },
          { name: 'estagiário: a bolsa inteira', expr: 'Estagiario("Caio", 1500.0).salario_liquido()', expected: '1500.0', compare: 'approx' },
          {
            name: 'descrição e férias remuneradas',
            code: py(`
              assert Clt("Ana", 5000.0).descricao() == "Ana (CLT)"
              assert Pj("Bia", 8000.0).descricao() == "Bia (PJ)"
              assert Estagiario("Caio", 1500.0).descricao() == "Caio (estágio)"
              assert Clt("Ana", 5000.0).ferias_remuneradas() is True
              assert Pj("Bia", 8000.0).ferias_remuneradas() is False
              assert Estagiario("Caio", 1500.0).ferias_remuneradas() is True
            `),
          },
          {
            name: 'criar_funcionario: a única decisão por tipo',
            code: py(`
              assert isinstance(criar_funcionario({"tipo": "clt", "nome": "Ana", "salario": 5000.0}), Clt)
              assert isinstance(criar_funcionario({"tipo": "pj", "nome": "Bia", "valor_nota": 8000.0}), Pj)
              estagiario = criar_funcionario({"tipo": "estagiario", "nome": "Caio", "bolsa": 1500.0})
              assert isinstance(estagiario, Estagiario) and estagiario.nome == "Caio"
              try:
                  criar_funcionario({"tipo": "cooperado", "nome": "Duda"})
              except ValueError:
                  pass
              else:
                  raise AssertionError("tipo desconhecido deveria lançar ValueError")
            `),
          },
          { name: 'folha_de_pagamento soma objetos', expr: 'folha_de_pagamento([Clt("Ana", 5000.0), Pj("Bia", 8000.0), Estagiario("Caio", 1500.0)])', expected: '13290.0', compare: 'approx' },
          {
            name: 'mesmos resultados das funções antigas (caracterização)',
            hidden: true,
            code: py(`
              def _salario_liquido(f):
                  if f["tipo"] == "clt":
                      return round(f["salario"] * 0.89 - 180, 2)
                  if f["tipo"] == "pj":
                      return round(f["valor_nota"] * 0.94, 2)
                  return f["bolsa"]

              _rotulos = {"clt": "CLT", "pj": "PJ", "estagiario": "estágio"}
              dados = [
                  {"tipo": "clt", "nome": "Ana", "salario": 5000.0},
                  {"tipo": "clt", "nome": "Edu", "salario": 1412.0},
                  {"tipo": "clt", "nome": "Gil", "salario": 12345.67},
                  {"tipo": "pj", "nome": "Bia", "valor_nota": 8000.0},
                  {"tipo": "pj", "nome": "Fábio", "valor_nota": 3333.33},
                  {"tipo": "estagiario", "nome": "Caio", "bolsa": 1500.0},
                  {"tipo": "estagiario", "nome": "Duda", "bolsa": 999.99},
              ]
              for d in dados:
                  f = criar_funcionario(d)
                  assert abs(f.salario_liquido() - _salario_liquido(d)) < 1e-9, f"{d}: salário líquido mudou"
                  assert f.descricao() == f"{d['nome']} ({_rotulos[d['tipo']]})", f"{d}: descrição mudou"
                  assert f.ferias_remuneradas() == (d["tipo"] != "pj"), f"{d}: férias mudaram"
              total = folha_de_pagamento([criar_funcionario(d) for d in dados])
              assert abs(total - round(sum(_salario_liquido(d) for d in dados), 2)) < 1e-9, total
              assert folha_de_pagamento([]) == 0
            `),
          },
          {
            name: 'polimorfismo de verdade: a folha não pergunta o tipo',
            hidden: true,
            code: py(`
              import types

              def _nomes_e_textos(funcao):
                  nomes, textos, pilha = set(), set(), [funcao.__code__]
                  while pilha:
                      codigo = pilha.pop()
                      nomes.update(codigo.co_names)
                      for c in codigo.co_consts:
                          if isinstance(c, types.CodeType):
                              pilha.append(c)
                          elif isinstance(c, str):
                              textos.add(c)
                  return nomes, textos

              for classe in (Clt, Pj, Estagiario):
                  assert issubclass(classe, Funcionario), f"{classe.__name__} deve herdar de Funcionario"
              implementacoes = {Clt.salario_liquido, Pj.salario_liquido, Estagiario.salario_liquido}
              assert len(implementacoes) == 3, "cada subclasse deve ter o seu próprio salario_liquido() — é aí que o polimorfismo acontece"
              nomes, textos = _nomes_e_textos(folha_de_pagamento)
              assert not {"isinstance", "type", "tipo"} & nomes, "folha_de_pagamento não deve perguntar o tipo de ninguém"
              assert not {"clt", "pj", "estagiario"} & textos, "folha_de_pagamento não deve conhecer os tipos"
            `),
          },
          {
            name: 'um tipo novo não exige mudar a folha (aberto/fechado)',
            hidden: true,
            code: py(`
              class Freelancer(Funcionario):
                  def __init__(self):
                      pass

                  def salario_liquido(self):
                      return 2500.0

                  def descricao(self):
                      return "Duda (freela)"

                  def ferias_remuneradas(self):
                      return False

              total = folha_de_pagamento([Freelancer(), Clt("Ana", 5000.0)])
              assert abs(total - 6770.0) < 1e-9, f"a folha deveria aceitar qualquer Funcionario: {total}"
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => (code.match(/["']clt["']/g) || []).length > 1,
            text: 'O texto `"clt"` aparece em mais de um lugar: o switch por tipo ainda está espalhado. Depois da refatoração, a decisão por tipo mora **só** na fábrica (`criar_funcionario`).',
            concept: 'Replace Conditional with Polymorphism',
          },
          {
            when: m => m.calls.includes('isinstance') || m.calls.includes('type'),
            text: '`isinstance`/`type` para escolher o comportamento é o switch disfarçado: a cada tipo novo, alguém precisa lembrar de editar aquele `if`. Deixe o objeto responder (`funcionario.salario_liquido()`).',
            concept: 'Polimorfismo',
          },
          {
            when: m => m.funcs.some(f => f.name === 'folha_de_pagamento' && f.complexity > 2),
            text: '`folha_de_pagamento` ainda toma decisões. Com polimorfismo, ela só precisa somar `salario_liquido()` de cada um — quem sabe calcular é o próprio objeto.',
            concept: 'Replace Conditional with Polymorphism',
          },
        ],
        hints: [
          'Crie a base `Funcionario` (pode ser uma `ABC` com `@abstractmethod`) guardando o `nome`, e uma subclasse por tipo: `Clt(nome, salario)`, `Pj(nome, valor_nota)`, `Estagiario(nome, bolsa)`. Cada ramo do `if` vira o corpo de um método na subclasse certa.',
          'A decisão por tipo não desaparece — ela **muda de lugar**: `criar_funcionario(dados)` olha `dados["tipo"]` uma única vez e devolve `Clt(dados["nome"], dados["salario"])`, `Pj(...)` ou `Estagiario(...)` (ou lança `ValueError`).',
          '`folha_de_pagamento` vira `round(sum(funcionario.salario_liquido() for funcionario in funcionarios), 2)`: ela não sabe (nem quer saber) que tipos existem. Mantenha as contas idênticas às originais (`salario * 0.89 - 180`, `valor_nota * 0.94`) para os centavos baterem.',
        ],
        solution: py(`
          from abc import ABC, abstractmethod


          class Funcionario(ABC):
              def __init__(self, nome):
                  self.nome = nome

              @abstractmethod
              def salario_liquido(self): ...

              @abstractmethod
              def descricao(self): ...

              @abstractmethod
              def ferias_remuneradas(self): ...


          class Clt(Funcionario):
              PERCENTUAL_LIQUIDO = 0.89       # 11% de INSS/IRRF, simplificado
              VALE_TRANSPORTE = 180

              def __init__(self, nome, salario):
                  super().__init__(nome)
                  self.salario = salario

              def salario_liquido(self):
                  return round(self.salario * self.PERCENTUAL_LIQUIDO - self.VALE_TRANSPORTE, 2)

              def descricao(self):
                  return f"{self.nome} (CLT)"

              def ferias_remuneradas(self):
                  return True


          class Pj(Funcionario):
              PERCENTUAL_LIQUIDO = 0.94       # 6% de impostos sobre a nota

              def __init__(self, nome, valor_nota):
                  super().__init__(nome)
                  self.valor_nota = valor_nota

              def salario_liquido(self):
                  return round(self.valor_nota * self.PERCENTUAL_LIQUIDO, 2)

              def descricao(self):
                  return f"{self.nome} (PJ)"

              def ferias_remuneradas(self):
                  return False


          class Estagiario(Funcionario):
              def __init__(self, nome, bolsa):
                  super().__init__(nome)
                  self.bolsa = bolsa

              def salario_liquido(self):
                  return self.bolsa

              def descricao(self):
                  return f"{self.nome} (estágio)"

              def ferias_remuneradas(self):
                  return True                 # recesso remunerado (Lei do Estágio)


          def criar_funcionario(dados):
              """Fábrica: o único lugar que ainda decide pelo campo "tipo"."""
              tipo = dados["tipo"]
              if tipo == "clt":
                  return Clt(dados["nome"], dados["salario"])
              if tipo == "pj":
                  return Pj(dados["nome"], dados["valor_nota"])
              if tipo == "estagiario":
                  return Estagiario(dados["nome"], dados["bolsa"])
              raise ValueError(f"tipo desconhecido: {tipo}")


          def folha_de_pagamento(funcionarios):
              return round(sum(funcionario.salario_liquido() for funcionario in funcionarios), 2)
        `),
        solutionExplanation: 'Cada ramo do switch virou um método na subclasse certa: o conhecimento sobre CLT mora em `Clt`, sobre PJ em `Pj`, e assim por diante. Os três `if/elif` repetidos viraram **um só**, na fábrica `criar_funcionario` — a decisão por tipo não some, ela passa a acontecer uma única vez, na fronteira onde os dicionários viram objetos. `folha_de_pagamento` ficou fechada para modificação: o teste oculto cria um `Freelancer` que ela nunca viu, e a soma funciona sem mudar uma linha. Um tipo novo agora é **uma classe nova** (mais uma linha na fábrica), e não uma caça aos `if`s por três funções.',
      },
      {
        type: 'open',
        id: 'cc-ref-q6',
        concept: 'Refatoração segura',
        say: 'Para fechar, uma situação que todo dev sênior já viveu.',
        prompt: 'Seu gerente propõe congelar as features por **três semanas**, numa branch separada, para "refatorar o módulo de pagamentos inteiro". Como você conduziria essa refatoração de forma segura?',
        minWords: 35,
        rubric: [
          { label: 'Criar uma **rede de testes** antes de mexer (caracterização)', keywords: ['teste', 'test', 'caracteriza', 'cobertura', 'golden master', 'rede de seguranca'], concept: 'Refatoração segura', why: 'Sem testes, não há como saber se o comportamento foi preservado — e aí não é refatoração, é torcida.' },
          { label: '**Passos pequenos**, integrados com frequência (em vez de uma branch longa)', keywords: ['passos pequenos', 'pequenos passos', 'pequenas mudancas', 'incremental', 'aos poucos', 'commits pequenos', 'integr', 'trunk', 'branch longa', 'merge', 'continu'], concept: 'Passos pequenos', why: 'Uma branch de três semanas acumula conflitos e risco; passos pequenos integrados todo dia mantêm o sistema sempre funcionando.' },
          { label: 'Separar refatoração de mudança de comportamento (**dois chapéus**)', keywords: ['dois chapeus', 'two hats', 'comportamento', 'nao misturar', 'separar', 'separad'], concept: 'Dois chapéus', why: 'Misturar features e refatoração no mesmo passo esconde mudanças de regra e torna os problemas difíceis de rastrear.' },
          { label: 'Técnicas para mudanças grandes: **Mikado**, *branch by abstraction*, *parallel change*, feature flags', keywords: ['mikado', 'branch by abstraction', 'abstracao', 'parallel change', 'expand', 'contract', 'feature flag', 'flag', 'strangler', 'estrangul', 'preparat'], concept: 'Método Mikado', why: 'Essas técnicas quebram uma mudança grande em passos pequenos que convivem com o código atual, sem parar o time.' },
        ],
        modelAnswer: `Eu evitaria a branch de três semanas: ela acumula conflitos com o resto do time e transforma a integração final num evento de alto risco.

Primeiro, criaria uma **rede de testes**: testes de caracterização (até um *golden master*) que fixam o comportamento atual dos pagamentos, inclusive os casos estranhos.

Depois, faria a refatoração em **passos pequenos**, cada um com os testes verdes e um commit, integrando na branch principal todo dia. Refatoração e mudança de comportamento ficam **separadas** (os dois chapéus): se alguma regra estiver errada, a correção vira outro PR.

Para as mudanças grandes, usaria o **Método Mikado** para descobrir a ordem dos pré-requisitos, e *branch by abstraction* ou *parallel change* (expand/contract) para trocar partes grandes por trás de uma abstração, com *feature flag* se precisar virar a chave aos poucos. Assim o time continua entregando features enquanto o módulo melhora — e cada passo pode ser revertido sozinho.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente! Agora você tem um catálogo de refatorações — e, mais importante, sabe aplicá-las com segurança.',
          'Na próxima aula vamos **medir** complexidade, inclusive escrevendo nosso próprio medidor com o módulo `ast`.',
        ],
        board: null,
      },
    ],
  });
})();
