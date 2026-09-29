(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const CALC_SUJO = py(`
    log = []


    def calc(itens, c, e, r):
        # itens: lista de (nome, preço, quantidade)
        t = 0
        for i in itens:
            t += i[1] * i[2]
        if c == "PRIMEIRA":
            t = t * 0.9
        if t < 199.9:
            if e:
                t = t + 35.0
            else:
                t = t + 12.5
        t = round(t, 2)
        if r:
            log.append(t)
        return t


    # TODO: refatore para a API pedida no enunciado (sem mudar nenhum resultado!)
  `);

  Game.registerModule('clean-code', {
    id: 'nomes-funcoes',
    title: 'Nomes e funções',
    kind: 'lesson',
    level: 1,
    order: 1,
    unit: 'fundamentos',
    summary: 'Nomes que contam a história, adeus números mágicos, funções pequenas com poucos parâmetros — e por que uma função não deve perguntar e mandar ao mesmo tempo.',
    concepts: ['Nomes que revelam intenção', 'Números mágicos', 'Funções pequenas', 'Command-Query Separation', 'Flag arguments'],
    takeaways: [
      'Um bom nome revela **intenção** (por que existe, o que faz, como se usa). Se precisa de comentário para ser entendido, ainda não é um bom nome.',
      'Troque **números mágicos** por constantes nomeadas ou `Enum` — quando o literal carrega uma regra ou um significado que o leitor teria de adivinhar.',
      'Funções pequenas fazem **uma coisa**, num único nível de abstração. O objetivo é legibilidade, não contar linhas.',
      'Poucos parâmetros e nada de **flag arguments**: um booleano que muda o comportamento anuncia duas funções escondidas numa só.',
      '**Command-Query Separation**: ou a função muda estado (comando) ou responde (consulta). Efeitos colaterais escondidos surpreendem quem chama e criam acoplamento temporal.',
    ],
    glossary: [
      { term: 'Número mágico', aliases: ['números mágicos', 'numero magico', 'numeros magicos', 'magic number', 'magic numbers', 'literal mágico'], definition: 'Literal sem nome no meio do código (`86400`, `0.15`, `status == 3`) cujo significado o leitor precisa adivinhar. Troque por uma constante nomeada ou um `Enum`: a regra ganha nome e passa a mudar num lugar só.' },
      { term: 'Command-Query Separation', aliases: ['CQS', 'separação comando-consulta', 'separacao comando-consulta'], definition: 'Princípio de Bertrand Meyer (1988): cada método é um **comando** (muda estado e não retorna valor) ou uma **consulta** (retorna valor sem efeito colateral) — nunca os dois. "Fazer uma pergunta não deve mudar a resposta."' },
      { term: 'Flag argument', aliases: ['flag arguments', 'argumento-bandeira', 'argumento booleano', 'parâmetro booleano', 'parametro booleano'], definition: 'Parâmetro booleano que escolhe entre comportamentos diferentes da função (`gerar(relatorio, True)`). Denuncia que a função faz duas coisas; prefira duas funções com nomes honestos.' },
      { term: 'Efeito colateral escondido', aliases: ['efeitos colaterais escondidos', 'hidden side effect', 'efeito colateral oculto'], definition: 'Mudança de estado que o nome da função não anuncia — como um `verificar_senha()` que também inicia a sessão. Surpreende quem chama e cria acoplamento temporal.' },
      { term: 'Acoplamento temporal', aliases: ['temporal coupling'], definition: 'Quando operações só funcionam se chamadas numa certa ordem (ex.: `conectar()` antes de `enviar()`), mas nada no código obriga essa ordem. Torne-a explícita: passe o resultado de uma para a outra ou junte as duas.' },
      { term: 'Linguistic antipattern', aliases: ['linguistic antipatterns', 'antipadrão linguístico', 'antipadrao linguistico'], definition: 'Nome que contradiz o comportamento: `get_total()` que não retorna, `is_valido()` que devolve texto, `lista_itens` que guarda um item só. Catalogado por Venera Arnaoudova e colegas (2013).' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Bem-vindo(a) à trilha de Clean Code! Vamos começar pelo que mais rende: **nomes** e **funções**.',
          'Código é lido muito mais vezes do que é escrito — então vamos escrever para quem lê.',
        ],
        board: {
          title: 'Por que nomes e funções?',
          md: `**O que este código faz?**

\`\`\`python
def calc(l):
    t = 0
    for i in l:
        if i[2] == 3:
            t += i[1]
    return t
\`\`\`

**E este?**

\`\`\`python
STATUS_CANCELADO = 3

def total_a_reembolsar(pedidos):
    return sum(p.valor for p in pedidos if p.status == STATUS_CANCELADO)
\`\`\`

A lógica é a mesma, mas o segundo **conta a história**: ninguém precisa executar o código de cabeça para entender.

Nesta aula:
- nomes que revelam intenção (e nomes que mentem);
- números mágicos → constantes nomeadas;
- funções pequenas, que fazem **uma coisa**;
- poucos parâmetros e nada de *flag arguments*;
- **Command-Query Separation** e efeitos colaterais escondidos.

> [!dica] Robert C. Martin (*Clean Code*, 2008) estima que passamos **mais de 10 vezes** mais tempo lendo código do que escrevendo. Otimizar para a leitura é otimizar para o custo real.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Um bom nome responde três perguntas: **por que** isso existe, **o que** faz e **como** se usa.',
          'Se o nome precisa de um comentário do lado para ser entendido, ele ainda não chegou lá.',
        ],
        board: {
          title: 'Regras de bolso para nomes',
          md: `| Regra | Ruim | Melhor |
|---|---|---|
| Revele a intenção | \`d = 7\` | \`dias_para_expirar = 7\` |
| Não desinforme | \`lista_clientes = {}\` (é um dict!) | \`clientes_por_cpf = {}\` |
| Distinções com significado | \`dados\`, \`info\`, \`dados2\` | \`pedido_original\`, \`pedido_corrigido\` |
| Pronunciável e buscável | \`dtmdfc\`, \`e\` | \`data_modificacao\`, \`evento\` |
| Um termo por conceito | \`buscar_\`, \`obter_\` e \`recuperar_\` misturados | escolha **um** e use sempre |
| Classes = substantivos, funções = verbos | \`class Processa\`, \`def usuario()\` | \`class Pedido\`, \`def cancelar_pedido()\` |
| Booleanos soam como pergunta | \`status_ok\`, \`flag\` | \`esta_ativo\`, \`tem_estoque\`, \`pode_editar\` |

**Tamanho proporcional ao escopo:** \`i\` num laço de duas linhas é aceitável; uma variável de módulo chamada \`x\`, não. Quanto maior o alcance de um nome, mais descritivo ele precisa ser.

> [!sabia] O nome que **mente** tem nome: **linguistic antipattern** (Venera Arnaoudova e colegas, 2013). Exemplos: \`get_total()\` que não retorna nada, \`is_valido()\` que devolve uma string, \`set_limite()\` que retorna um valor, \`lista_itens\` que guarda um item só. Um estudo de 2018 que mediu a atividade cerebral (fNIRS) de desenvolvedores mostrou que esses nomes **aumentam a carga cognitiva** de quem lê: o cérebro confia no nome e tropeça no comportamento.`,
        },
      },
      {
        type: 'say',
        text: [
          'Agora os **números mágicos**: literais soltos cujo significado você precisa adivinhar.',
          'O `86400` você até reconhece… mas e o `3` do status? E o `0.15`?',
        ],
        board: {
          title: 'Números mágicos → constantes nomeadas',
          md: `\`\`\`python
# Antes: o que é 3? E 0.15? E 86400?
if pedido.status == 3 and agora - pedido.pago_em > 86400:
    multa = pedido.valor * 0.15
\`\`\`

\`\`\`python
from enum import Enum

class Status(Enum):
    ABERTO = 1
    PAGO = 2
    CANCELADO = 3

SEGUNDOS_POR_DIA = 24 * 60 * 60
MULTA_CANCELAMENTO_TARDIO = 0.15    # 15%: cláusula 7.2 do contrato

cancelou_tarde = pedido.status == Status.CANCELADO and agora - pedido.pago_em > SEGUNDOS_POR_DIA
if cancelou_tarde:
    multa = pedido.valor * MULTA_CANCELAMENTO_TARDIO
\`\`\`

Ganhos:
- o **nome** explica o valor, e o comentário explica o **porquê** (algo que o nome sozinho não consegue);
- mudar a regra é mexer em **um** lugar — e dá para buscar por ela;
- a variável \`cancelou_tarde\` dá nome à condição (*Introduce Explaining Variable*).

> [!atencao] Nem todo literal é mágico: \`0\` e \`1\` em contadores, \`/ 2\` numa média, \`range(len(x))\`… Troque o literal quando ele carrega uma **regra de negócio** ou um significado que o leitor teria de adivinhar. \`UM = 1\` não ajuda ninguém.`,
        },
      },
      {
        type: 'say',
        text: [
          'Regra de ouro das funções: **pequenas**, e fazendo **uma coisa só**.',
          'Mas o que é "uma coisa"? A melhor pista: todos os passos estão no **mesmo nível de abstração**.',
        ],
        board: {
          title: 'Uma coisa, um nível de abstração',
          md: `\`\`\`python
# Mistura níveis: SQL, soma, formatação e SMTP no mesmo lugar
def fechar_mes(conn, mes):
    linhas = conn.execute("SELECT valor FROM vendas WHERE mes = ?", (mes,)).fetchall()
    total = 0
    for (valor,) in linhas:
        total += valor
    texto = "Total do mês " + str(mes) + ": R$ " + format(total, ".2f")
    smtp = SMTP("mail.local")
    smtp.sendmail("financeiro@ex.com", texto)
\`\`\`

\`\`\`python
# Cada linha é um passo de alto nível; os detalhes descem para funções com nome
def fechar_mes(repositorio, notificador, mes):
    vendas = repositorio.vendas_do_mes(mes)
    total = somar_valores(vendas)
    notificador.avisar_financeiro(relatorio_mensal(mes, total))
\`\`\`

- **Stepdown rule** (Robert C. Martin): o arquivo se lê de cima para baixo como uma narrativa — cada função é seguida pelas funções do nível logo abaixo.
- Se você consegue extrair um trecho com um nome que **não** é só a reformulação do código, a função fazia mais de uma coisa.
- Comentários de seção dentro da função (\`# carrega\`, \`# calcula\`, \`# envia\`) são um convite: cada seção quer ser uma função.

> [!atencao] Dá para exagerar. Dezenas de funções de duas linhas que só repassam chamadas espalham a lógica e obrigam o leitor a pular de arquivo em arquivo. John Ousterhout (*A Philosophy of Software Design*, 2018) defende **módulos profundos**: uma interface simples escondendo bastante trabalho. O objetivo é **legibilidade**, não um número mágico de linhas.`,
        },
      },
      {
        type: 'say',
        text: [
          'Cada parâmetro é mais uma coisa para o leitor segurar na cabeça — e mais combinações para testar.',
          { text: 'E o pior tipo é o booleano que muda o que a função faz: o **flag argument**.', mood: 'concerned' },
        ],
        board: {
          title: 'Poucos parâmetros, nenhuma bandeira',
          md: `| Parâmetros | Leitura |
|---|---|
| 0–2 | ideal |
| 3 | pede uma boa razão |
| 4 ou mais | quase sempre há um objeto (ou duas funções) escondido ali |

\`\`\`python
relatorio = gerar_relatorio(vendas, True)   # True o quê?

def gerar_relatorio(vendas, em_pdf):
    if em_pdf:
        ...   # um comportamento
    else:
        ...   # outro comportamento
\`\`\`

Um booleano que escolhe o comportamento **anuncia** que a função faz duas coisas — e cada flag dobra as combinações a testar. Remédios:

\`\`\`python
# 1) Duas funções com nomes honestos (Fowler: "Remove Flag Argument")
gerar_relatorio_pdf(vendas)
gerar_relatorio_html(vendas)

# 2) Receba o comportamento, não a bandeira (funções são objetos em Python)
def total_do_pedido(itens, frete=frete_normal):
    valor = subtotal(itens)
    return valor + frete(valor)

# 3) Vários parâmetros que andam juntos? Agrupe (Introduce Parameter Object)
@dataclass(frozen=True)
class Periodo:
    inicio: date
    fim: date
\`\`\`

> [!dica] Quando um booleano for inevitável, force o nome na chamada com parâmetros **keyword-only**: em \`def exportar(dados, *, comprimido=False)\`, a chamada \`exportar(dados, True)\` vira erro e quem chama precisa escrever \`comprimido=True\`.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Agora um princípio que pouca gente conhece pelo nome: **Command-Query Separation**.',
          'Uma função ou **faz** algo (comando) ou **responde** algo (consulta). Fazer as duas coisas é pedir para ser surpreendido.',
        ],
        board: {
          title: 'Command-Query Separation (CQS)',
          md: `| | Comando | Consulta |
|---|---|---|
| Muda estado? | sim | **não** |
| Retorna valor? | não (\`None\`) | sim |
| Exemplo | \`conta.depositar(100)\` | \`conta.saldo()\` |

**Efeito colateral escondido** — o nome promete uma consulta, mas a função também age:

\`\`\`python
def verificar_senha(usuario, senha):
    if hash_de(senha) == usuario.hash_senha:
        Sessao.iniciar(usuario)      # surpresa!
        return True
    return False
\`\`\`

Quem chama \`verificar_senha\` só para reconfirmar a senha antes de uma operação sensível **reinicia a sessão sem saber**. E surge um **acoplamento temporal**: a função só é segura em certos momentos do fluxo.

\`\`\`python
def senha_confere(usuario, senha):        # consulta: só responde
    return hash_de(senha) == usuario.hash_senha

def autenticar(usuario, senha):           # comando: o nome anuncia o efeito
    if not senha_confere(usuario, senha):
        raise CredenciaisInvalidas()
    Sessao.iniciar(usuario)
\`\`\`

> [!sabia] O CQS foi formulado por **Bertrand Meyer**, criador da linguagem Eiffel, em *Object-Oriented Software Construction* (1988): "fazer uma pergunta não deve mudar a resposta". Anos depois, Greg Young levou a ideia para a arquitetura e nasceu o **CQRS** (*Command Query Responsibility Segregation*). E a senha que inicia a sessão é o exemplo clássico de efeito colateral do livro *Clean Code*.

> [!atencao] Há exceções pragmáticas: \`lista.pop()\`, \`next(iterador)\` e \`dict.setdefault()\` mudam estado **e** retornam. Em código concorrente, separar a consulta do comando cria uma corrida *check-then-act* — às vezes você **precisa** da operação atômica que faz as duas coisas. Viole o CQS de propósito, com um nome que diga isso (\`tentar_reservar\`).`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Nomes, bandeiras, consultas que mandam — e uma refatoração de verdade.', icon: '🎯' },
      {
        type: 'match',
        id: 'cc-nom-q1',
        concept: 'Nomes que revelam intenção',
        say: 'Aquecimento: cada trecho tem um problema de nome ou de assinatura. Qual?',
        prompt: 'Associe cada **trecho** ao **problema** que ele tem.',
        pairs: [
          { left: '`lista_clientes = {}`', right: 'Desinformação: o nome diz lista, mas é um dict' },
          { left: '`if status == 3:`', right: 'Número mágico: o leitor precisa adivinhar o que é 3' },
          { left: '`def is_valido(): return "ok"`', right: 'Linguistic antipattern: o nome promete um booleano' },
          { left: '`enviar(msg, True, False)`', right: 'Flag arguments: ninguém sabe o que cada booleano faz' },
          { left: '`buscar_cliente()`, `obter_pedido()`, `recuperar_nota()`', right: 'Três termos diferentes para o mesmo conceito' },
          { left: '`def calc(l, f):`', right: 'Nome que não revela intenção' },
        ],
        explanation: 'Nomes são a documentação que **sempre** está presente — e que ninguém esquece de atualizar quando renomeia. Os piores são os que **mentem** (`lista_clientes` que é dict, `is_valido` que devolve texto): o leitor confia no nome e tropeça. Números mágicos e booleanos posicionais escondem o significado no ponto de uso; vários verbos para a mesma ideia fazem o leitor procurar uma diferença que não existe.',
      },
      {
        type: 'mcq',
        id: 'cc-nom-q2',
        concept: 'Flag arguments',
        say: 'Code review: essa assinatura apareceu num PR. O que você sugere?',
        prompt: `\`\`\`python
def exportar(vendas, formato_pdf, incluir_graficos, enviar, email):
    ...

exportar(vendas, True, False, True, "financeiro@ex.com")
\`\`\`

Qual é a melhor direção de refatoração?`,
        options: [
          { text: 'Separar os comportamentos em funções com nomes honestos (`exportar_pdf`, `exportar_csv`) e tirar o envio daqui: exportar e enviar são responsabilidades diferentes (`enviar_por_email(arquivo, destinatario)`).', correct: true, why: 'Cada flag era uma função escondida. Separando, cada função faz uma coisa, a chamada fica legível e as combinações a testar caem drasticamente.' },
          { text: 'Trocar os booleanos por strings: `exportar(vendas, "pdf", "sem_graficos", "enviar", email)`.', why: 'A chamada fica um pouco mais legível, mas a função continua fazendo tudo — e strings soltas trazem erros de digitação que só aparecem em produção.' },
          { text: 'Manter a assinatura e documentar cada parâmetro na docstring.', why: 'A docstring não aparece no ponto de chamada: quem lê `exportar(vendas, True, False, True, ...)` continua sem saber o que acontece. E a função segue com 5 responsabilidades.' },
          { text: 'Trocar tudo por `**kwargs` para ganhar flexibilidade.', why: 'Esconde a API: o leitor e o editor perdem a lista de opções válidas, e erros de nome passam em silêncio. É menos legível, não mais.' },
        ],
        explanation: 'Três booleanos já são **8 combinações** de comportamento — cada uma um caminho a testar. Um *flag argument* denuncia que a função faz mais de uma coisa; a cura é dar a cada comportamento sua própria função (ou receber o comportamento como parâmetro). Se um booleano for mesmo inevitável, torne-o *keyword-only* (`def exportar(vendas, *, com_graficos=False)`) para que a chamada diga o que ele significa.',
      },
      {
        type: 'mcq',
        id: 'cc-nom-q3',
        concept: 'Command-Query Separation',
        say: 'Mais um review. Esse bug já derrubou um e-commerce que eu conheço…',
        prompt: `A página de produto chama \`estoque.disponivel("caneca", 1)\` só para decidir se mostra o selo "Em estoque":

\`\`\`python
class Estoque:
    def __init__(self):
        self._quantidades = {}

    def disponivel(self, produto, qtd):
        atual = self._quantidades.get(produto, 0)
        if atual >= qtd:
            self._quantidades[produto] = atual - qtd    # já reserva!
            return True
        return False
\`\`\`

Qual é o problema principal e a melhor correção?`,
        options: [
          { text: 'É uma consulta com efeito colateral escondido (viola o CQS): cada visita à página baixa o estoque. Separe em `disponivel(produto, qtd)`, que só responde, e `reservar(produto, qtd)`, um comando.', correct: true, why: 'Com a separação, a consulta pode ser chamada quantas vezes quiser sem consequências, e a mudança de estado fica explícita no nome de quem a faz.' },
          { text: 'O problema é só o nome: basta renomear para `verificar_disponibilidade`.', why: 'O novo nome promete ainda mais claramente uma consulta — e a função continua reservando. Renomear só resolveria se o nome anunciasse o efeito (`reservar_se_disponivel`).' },
          { text: 'O dicionário deveria ser público para a página consultar a quantidade diretamente.', why: 'Quebra o encapsulamento e espalha regras de estoque pelo sistema. O problema é o efeito colateral, não a visibilidade do dado.' },
          { text: 'Não há problema: retornar `True`/`False` informa se a reserva deu certo, e isso é uma boa prática.', why: 'O retorno não é o problema — o problema é que o nome `disponivel` promete uma pergunta e a função executa uma ação que ninguém pediu.' },
        ],
        explanation: 'CQS: **perguntar não deve mudar a resposta**. Aqui, perguntar muda o estoque — e a página de produto, chamada milhares de vezes, esvazia o estoque sem vender nada. A correção separa consulta (`disponivel`) de comando (`reservar`). Em cenários concorrentes, "consultar e depois reservar" pode ter corrida; aí uma operação combinada e **atômica** é legítima, desde que o nome diga o que faz (`tentar_reservar`).',
      },
      {
        type: 'code',
        id: 'cc-nom-q4',
        concept: 'Nomes e funções',
        title: 'Desmontando o `calc`',
        points: 50,
        say: 'Hora de refatorar! Os testes descrevem o comportamento de hoje — e ele não pode mudar, nem para "melhorar".',
        prompt: `A função \`calc\` funciona, mas é um festival de problemas: nomes crípticos, números mágicos, dois *flag arguments* (\`e\` e \`r\`) e um efeito colateral escondido (o \`log\` global). Hoje ela é chamada assim:

\`\`\`python
calc(itens, "PRIMEIRA", True, False)   # True o quê? False o quê?
\`\`\`

Refatore para a API abaixo **sem mudar nenhum resultado** — inclusive os estranhos: o cupom continua sensível a maiúsculas e o frete é decidido pelo valor **já com desconto**.

- **Constantes nomeadas** (em MAIÚSCULAS) para o desconto (\`0.9\` ou \`0.10\`), \`12.5\`, \`35.0\` e \`199.9\`.
- \`subtotal(itens)\` — soma de \`preco * quantidade\` dos itens \`(nome, preco, quantidade)\`.
- \`aplicar_cupom(valor, cupom)\` — 10% de desconto se o cupom for \`"PRIMEIRA"\`; senão, devolve o valor.
- \`frete_normal(valor)\` e \`frete_expresso(valor)\` — no lugar do flag \`e\`: 12,50 ou 35,00; grátis a partir de 199,90.
- \`total_do_pedido(itens, cupom="", frete=frete_normal)\` — uma **consulta** pura, arredondada em 2 casas.
- \`registrar_venda(historico, valor)\` — um **comando**: acrescenta o valor à lista recebida e não retorna nada. Nada de estado global.`,
        starter: CALC_SUJO,
        tests: [
          { name: 'subtotal soma preço × quantidade', expr: 'subtotal([("café", 30.0, 2), ("caneca", 45.5, 1)])', expected: '105.5', compare: 'approx' },
          { name: 'cupom PRIMEIRA dá 10% de desconto', expr: 'aplicar_cupom(200.0, "PRIMEIRA")', expected: '180.0', compare: 'approx' },
          { name: 'outro cupom não muda o valor', expr: 'aplicar_cupom(200.0, "OUTRO")', expected: '200.0', compare: 'approx' },
          {
            name: 'fretes normal e expresso (grátis a partir de 199,90)',
            code: py(`
              assert frete_normal(199.89) == 12.5, frete_normal(199.89)
              assert frete_normal(199.9) == 0, "a partir de 199,90 o frete é grátis"
              assert frete_expresso(100.0) == 35.0, frete_expresso(100.0)
              assert frete_expresso(500.0) == 0, frete_expresso(500.0)
            `),
          },
          { name: 'total com frete normal (frete sobre o valor com desconto)', expr: 'total_do_pedido([("livro", 80.0, 2)], "PRIMEIRA")', expected: '156.5', compare: 'approx' },
          { name: 'total com frete expresso', expr: 'total_do_pedido([("livro", 80.0, 2)], "PRIMEIRA", frete=frete_expresso)', expected: '179.0', compare: 'approx' },
          {
            name: 'registrar_venda é um comando',
            code: py(`
              historico = []
              resultado = registrar_venda(historico, 156.5)
              assert resultado is None, "registrar_venda é um comando: não deve retornar nada (CQS)"
              registrar_venda(historico, 12.5)
              assert historico == [156.5, 12.5], historico
            `),
          },
          {
            name: 'mesmo comportamento do calc original (caracterização)',
            hidden: true,
            code: py(`
              def _calc_original(itens, c, e):
                  t = 0
                  for i in itens:
                      t += i[1] * i[2]
                  if c == "PRIMEIRA":
                      t = t * 0.9
                  if t < 199.9:
                      if e:
                          t = t + 35.0
                      else:
                          t = t + 12.5
                  return round(t, 2)

              casos = [
                  [],
                  [("livro", 80.0, 2)],
                  [("café", 30.0, 2), ("caneca", 45.5, 1)],
                  [("kit", 111.0, 2)],
                  [("fone", 199.9, 1)],
                  [("tv", 1999.0, 1), ("cabo", 20.0, 3)],
              ]
              for itens in casos:
                  for cupom in ("", "PRIMEIRA", "primeira", "OUTRO"):
                      for expresso, frete in ((False, frete_normal), (True, frete_expresso)):
                          esperado = _calc_original(itens, cupom, expresso)
                          obtido = total_do_pedido(itens, cupom, frete=frete)
                          assert abs(obtido - esperado) < 1e-9, (
                              f"itens={itens}, cupom={cupom!r}, expresso={expresso}: "
                              f"o original dava {esperado}, a refatoração deu {obtido}"
                          )
            `),
          },
          {
            name: 'total_do_pedido é uma consulta sem efeito colateral',
            hidden: true,
            code: py(`
              import copy
              antes = {k: copy.deepcopy(v) for k, v in globals().items()
                       if not k.startswith("__") and isinstance(v, (list, dict, set))}
              primeiro = total_do_pedido([("x", 50.0, 1)], "PRIMEIRA")
              segundo = total_do_pedido([("x", 50.0, 1)], "PRIMEIRA", frete=frete_expresso)
              assert total_do_pedido([("x", 50.0, 1)], "PRIMEIRA") == primeiro, "perguntar duas vezes deve dar a mesma resposta"
              for nome, valor in antes.items():
                  assert globals()[nome] == valor, f"total_do_pedido alterou o estado global \`{nome}\`: efeito colateral escondido"
            `),
          },
          {
            name: 'sem números mágicos dentro das funções',
            hidden: true,
            code: py(`
              import types

              def _literais(funcao):
                  achados, pilha = set(), [funcao.__code__]
                  while pilha:
                      codigo = pilha.pop()
                      for c in codigo.co_consts:
                          if isinstance(c, types.CodeType):
                              pilha.append(c)
                          elif isinstance(c, (int, float)) and not isinstance(c, bool):
                              achados.add(c)
                  return achados

              magicos = {0.9, 0.1, 12.5, 35.0, 199.9}
              for funcao in (subtotal, aplicar_cupom, frete_normal, frete_expresso, total_do_pedido):
                  sobrando = _literais(funcao) & magicos
                  assert not sobrando, f"{funcao.__name__} ainda usa números mágicos: {sorted(sobrando)}"
              constantes = {v for k, v in globals().items()
                            if k.isupper() and isinstance(v, (int, float)) and not isinstance(v, bool)}
              for valor in (12.5, 35.0, 199.9):
                  assert valor in constantes, f"crie uma constante nomeada (em MAIÚSCULAS) para {valor}"
              assert constantes & {0.9, 0.1}, "crie uma constante nomeada para o desconto do cupom (0.9 ou 0.10)"
            `),
          },
          {
            name: 'sem flag arguments',
            hidden: true,
            code: py(`
              import inspect
              assert len(inspect.signature(frete_normal).parameters) == 1, "frete_normal(valor) recebe só o valor"
              assert len(inspect.signature(frete_expresso).parameters) == 1, "frete_expresso(valor) recebe só o valor"
              for nome, obj in list(globals().items()):
                  if inspect.isfunction(obj) and obj.__module__ == __name__:
                      for p in inspect.signature(obj).parameters.values():
                          assert not isinstance(p.default, bool), f"{nome}({p.name}={p.default!r}) ainda é um flag argument"
            `),
          },
        ],
        reviews: [
          {
            when: m => m.maxParams >= 4,
            text: 'Ainda existe função com **4 ou mais parâmetros**. Cada parâmetro é algo a mais para o leitor segurar na cabeça — e mais combinações a testar. Divida a função ou agrupe o que anda junto.',
            concept: 'Poucos parâmetros',
          },
          {
            when: m => m.funcs.some(f => f.name.replace(/_/g, '').length <= 4),
            text: 'Há função com nome curto ou abreviado (como `calc`). O nome é a documentação que sempre está lá: diga **o que** a função calcula.',
            concept: 'Nomes que revelam intenção',
          },
          {
            when: m => m.names.some(n => /^[a-z]$/.test(n)),
            text: 'Variáveis de uma letra (`t`, `i`, `c`…) obrigam o leitor a decodificar o código. Use nomes do domínio: `total`, `item`, `preco`, `cupom`.',
            concept: 'Nomes que revelam intenção',
          },
          {
            when: (m, code) => /^[ \t]+[^#\n]*\b(0\.9|0\.1|12\.5|35\.0|199\.9)\b/m.test(code),
            text: 'Ainda há **números mágicos** dentro das funções. Dê nome às regras (`FRETE_EXPRESSO`, `FRETE_GRATIS_A_PARTIR_DE`) e use as constantes: a regra passa a morar num lugar só.',
            concept: 'Números mágicos',
          },
          {
            when: m => m.mutableDefaults > 0,
            text: 'Parâmetro com **valor padrão mutável** (como `historico=[]`): a lista é criada uma única vez e compartilhada entre as chamadas — um efeito colateral escondido clássico do Python. Use `None` ou exija o argumento.',
            concept: 'Efeitos colaterais escondidos',
          },
          {
            when: m => m.usesGlobal,
            text: 'Você usou `global`. Estado global é efeito colateral esperando para acontecer: passe o estado como parâmetro (como o `historico` de `registrar_venda`).',
            concept: 'Efeitos colaterais escondidos',
          },
        ],
        hints: [
          'Comece pelas constantes: `DESCONTO_PRIMEIRA_COMPRA = 0.10`, `FRETE_NORMAL = 12.5`, `FRETE_EXPRESSO = 35.0`, `FRETE_GRATIS_A_PARTIR_DE = 199.9`. Depois extraia `subtotal(itens)`: um `sum(preco * quantidade for _nome, preco, quantidade in itens)` resolve.',
          'O flag `e` escolhia entre dois fretes: vire duas funções (`frete_normal`, `frete_expresso`) e passe a **função** escolhida para `total_do_pedido` no parâmetro `frete`. Lembre: o frete olha o valor **já com desconto**: `valor = aplicar_cupom(subtotal(itens), cupom)` e depois `frete(valor)`.',
          'O flag `r` + o `log` global eram um efeito colateral escondido. `total_do_pedido` só calcula e retorna `round(valor + frete(valor), 2)`; quem quiser registrar chama `registrar_venda(historico, total)`, que faz `historico.append(valor)` e não retorna nada.',
        ],
        solution: py(`
          DESCONTO_PRIMEIRA_COMPRA = 0.10
          CUPOM_PRIMEIRA_COMPRA = "PRIMEIRA"
          FRETE_NORMAL = 12.5
          FRETE_EXPRESSO = 35.0
          FRETE_GRATIS_A_PARTIR_DE = 199.9


          def subtotal(itens):
              return sum(preco * quantidade for _nome, preco, quantidade in itens)


          def aplicar_cupom(valor, cupom):
              if cupom == CUPOM_PRIMEIRA_COMPRA:
                  return valor * (1 - DESCONTO_PRIMEIRA_COMPRA)
              return valor


          def tem_frete_gratis(valor):
              return valor >= FRETE_GRATIS_A_PARTIR_DE


          def frete_normal(valor):
              return 0.0 if tem_frete_gratis(valor) else FRETE_NORMAL


          def frete_expresso(valor):
              return 0.0 if tem_frete_gratis(valor) else FRETE_EXPRESSO


          def total_do_pedido(itens, cupom="", frete=frete_normal):
              valor = aplicar_cupom(subtotal(itens), cupom)
              return round(valor + frete(valor), 2)


          def registrar_venda(historico, valor):
              historico.append(valor)
        `),
        solutionExplanation: 'Cada regra ganhou um **nome**: as constantes dizem o que são `12.5` e `199.9`, e `tem_frete_gratis` dá nome à condição. O flag `e` virou duas funções honestas, e `total_do_pedido` recebe o **comportamento** (`frete=frete_expresso`) em vez de uma bandeira — a chamada `total_do_pedido(itens, "PRIMEIRA", frete=frete_expresso)` se explica sozinha. O flag `r` e o `log` global eram um efeito colateral escondido: agora `total_do_pedido` é uma **consulta** pura (pode ser chamada quantas vezes quiser) e `registrar_venda` é um **comando** explícito, que recebe o histórico em vez de mexer num global. Repare que nada foi "corrigido" de passagem: o cupom continua sensível a maiúsculas e o pedido vazio continua pagando frete — refatorar é mudar a estrutura **sem** mudar o comportamento. Se essas regras estiverem erradas, isso é outra mudança, em outro commit.',
      },
      {
        type: 'open',
        id: 'cc-nom-q5',
        concept: 'Command-Query Separation',
        say: 'Para fechar: explique o CQS como se fosse para um colega do time.',
        prompt: 'Um colega pergunta: "o que é esse tal de **Command-Query Separation** e por que eu deveria me importar?". Explique com suas palavras, dê um exemplo e diga **quando** é aceitável violar o princípio.',
        minWords: 30,
        rubric: [
          { label: 'Define **comando**: muda o estado e não retorna valor', keywords: ['comando', 'command', 'muda o estado', 'altera o estado', 'modifica o estado', 'efeito colateral', 'efeitos colaterais'], concept: 'Command-Query Separation', why: 'Comandos fazem algo acontecer; por isso não deveriam também responder perguntas.' },
          { label: 'Define **consulta**: retorna um valor sem efeito colateral', keywords: ['consulta', 'query', 'queries', 'pergunta', 'so responde', 'so retorna', 'apenas retorna', 'sem efeito'], concept: 'Command-Query Separation', why: 'Consultas respondem sem mudar nada: "fazer uma pergunta não deve mudar a resposta".' },
          { label: 'Explica o **benefício**: chamar consultas sem medo, sem surpresas, fácil de testar', keywords: ['sem medo', 'surpresa', 'previs', 'confian', 'seguranc', 'teste', 'testar', 'raciocin', 'quantas vezes', 'repetir', 'idempot', 'entender'], concept: 'Efeitos colaterais escondidos', why: 'Se consultas não têm efeito, qualquer um pode chamá-las a qualquer momento — o código fica previsível e fácil de testar.' },
          { label: 'Cita **exceções** pragmáticas (pop, next, operações atômicas em concorrência)', keywords: ['pop', 'next', 'setdefault', 'atomic', 'concorr', 'corrida', 'race', 'check-then-act', 'check then act', 'excec', 'pragmat', 'iterador', 'pilha', 'fila'], concept: 'Command-Query Separation', why: 'Operações como `pop()` ou uma reserva atômica fazem as duas coisas de propósito — separar criaria corridas ou APIs desajeitadas.' },
        ],
        modelAnswer: `CQS (Bertrand Meyer) diz que cada função deve ser **ou** um **comando** — muda o estado do sistema e não retorna valor — **ou** uma **consulta** — retorna um valor e não tem efeito colateral. Nunca os dois: "fazer uma pergunta não deve mudar a resposta".

Exemplo: \`conta.saldo()\` é uma consulta e \`conta.depositar(100)\` é um comando. Um \`verificar_senha()\` que também inicia a sessão viola o princípio: quem só queria confirmar a senha reinicia a sessão sem saber.

O benefício é previsibilidade: posso chamar consultas **sem medo**, quantas vezes quiser, em qualquer ordem; o código fica mais fácil de entender e de testar, e os efeitos colaterais aparecem só onde o nome anuncia.

Violar é aceitável quando a operação combinada é o ponto: \`lista.pop()\`, \`next(iterador)\`, \`dict.setdefault()\` — e, principalmente, em **concorrência**, onde consultar e depois agir cria uma condição de corrida (*check-then-act*) e você precisa de uma operação **atômica** como \`tentar_reservar()\`. Nesses casos, o nome deve deixar claro que a função age e responde.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Nomes que contam a história, constantes no lugar de mágica, funções pequenas e honestas.',
          'Na próxima aula, vamos aprender a **farejar** problemas maiores: os *code smells*.',
        ],
        board: null,
      },
    ],
  });
})();
