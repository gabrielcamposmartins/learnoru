(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  const LOJA_DUPLICADA = py(`
    def preco_final(pedido):
        total = 0
        for item in pedido["itens"]:
            total += item["preco"] * item["qtd"]
        cliente = pedido["cliente"]
        if cliente["compras_no_ano"] >= 10 or cliente["gasto_no_ano"] >= 5000:
            total = total - total * 0.10
        return round(total, 2)


    def frete(pedido):
        total = 0
        for item in pedido["itens"]:
            total += item["preco"] * item["qtd"]
        cliente = pedido["cliente"]
        if cliente["compras_no_ano"] >= 10 or cliente["gasto_no_ano"] >= 5000:
            return 0.0
        if total >= 200:
            return 0.0
        return 25.0


    def taxa_de_servico(pedido):
        total = 0
        for item in pedido["itens"]:
            total += item["preco"] * item["qtd"]
        return round(total * 0.10, 2)


    def saudacao(cliente):
        if cliente["compras_no_ano"] >= 10 or cliente["gasto_no_ano"] >= 5000:
            return f"Olá, {cliente['nome']}! Obrigada por ser VIP."
        return f"Olá, {cliente['nome']}!"


    # TODO: uma única fonte para "quem é VIP" (eh_vip) e para a soma dos itens
    #       (subtotal); DESCONTO_VIP e TAXA_DE_SERVICO como constantes SEPARADAS.
  `);

  // Versão original, usada pelo teste de caracterização (comportamento não pode mudar).
  const ORIGINAL = py(`
    def _preco_original(pedido):
        total = 0
        for item in pedido["itens"]:
            total += item["preco"] * item["qtd"]
        c = pedido["cliente"]
        if c["compras_no_ano"] >= 10 or c["gasto_no_ano"] >= 5000:
            total = total - total * 0.10
        return round(total, 2)

    def _frete_original(pedido):
        total = sum(item["preco"] * item["qtd"] for item in pedido["itens"])
        c = pedido["cliente"]
        if c["compras_no_ano"] >= 10 or c["gasto_no_ano"] >= 5000 or total >= 200:
            return 0.0
        return 25.0

    def _taxa_original(pedido):
        total = 0
        for item in pedido["itens"]:
            total += item["preco"] * item["qtd"]
        return round(total * 0.10, 2)
  `);

  Game.registerModule('clean-code', {
    id: 'principios',
    title: 'Princípios (e seus exageros)',
    kind: 'lesson',
    level: 2,
    order: 21,
    unit: 'design',
    summary: 'DRY, Regra de Três, YAGNI, KISS, regra do escoteiro, menor surpresa — e as duas ideias que quase ninguém conhece: a cerca de Chesterton e o "worse is better". Princípios são heurísticas, não leis.',
    concepts: ['DRY', 'Regra de Três', 'YAGNI e KISS', 'Cerca de Chesterton', 'Menor surpresa'],
    takeaways: [
      '**DRY** é sobre **conhecimento**, não sobre texto: duas linhas iguais que mudam por motivos diferentes são duplicação **acidental** — unificá-las cria acoplamento falso.',
      '**Regra de Três**: tolere a duplicação na segunda vez; abstraia na terceira, quando o padrão real aparece. "Duplicação é muito mais barata que a abstração errada" (Sandi Metz).',
      '**YAGNI** e **KISS**: construa o que é preciso agora, do jeito mais simples, e mantenha o código fácil de mudar. Pense à frente só nas decisões caras de reverter.',
      '**Cerca de Chesterton**: antes de remover algo estranho, descubra por que foi colocado (git blame, issue, testes, pessoas). Depois, remova com segurança — ou documente o motivo.',
      '**Menor surpresa**: nomes e comportamentos devem fazer o que o leitor espera. Consulta não altera estado; `get_` não grava no banco.',
    ],
    glossary: [
      { term: 'DRY', aliases: ["Don't Repeat Yourself", 'dont repeat yourself'], definition: '*Don\'t Repeat Yourself* (Hunt e Thomas, *The Pragmatic Programmer*): "todo conhecimento deve ter uma representação única, inequívoca e oficial no sistema". É sobre **conhecimento** (regras, decisões), não sobre linhas de texto iguais.' },
      { term: 'Regra de Três', aliases: ['rule of three', 'regra de tres'], definition: 'Heurística atribuída a Don Roberts (e popularizada por Fowler): na primeira vez, faça; na segunda, tolere a duplicação; na **terceira**, abstraia — quando já dá para ver o padrão de verdade.' },
      { term: 'KISS', aliases: ['Keep It Simple, Stupid', 'keep it simple'], definition: '*Keep It Simple, Stupid*: prefira a solução mais simples que resolve o problema. O lema vem da engenharia aeronáutica (Kelly Johnson, Lockheed): o avião tinha de ser consertável em campo, com ferramentas básicas.' },
      { term: 'Cerca de Chesterton', aliases: ["Chesterton's fence", 'chestertons fence', 'cerca de chesterton'], definition: 'Princípio de G. K. Chesterton (1929): não derrube uma cerca até saber **por que** ela foi colocada. No código: antes de remover algo que parece inútil, investigue o motivo (histórico, issues, testes, pessoas).' },
      { term: 'Worse is better', aliases: ['pior é melhor', 'pior e melhor', 'new jersey style'], definition: 'Ensaio de Richard Gabriel (1989): software com implementação **simples**, mesmo que incompleto ou menos "correto", tende a se espalhar mais rápido do que o design perfeito. Explica o sucesso de Unix e C sobre sistemas mais elegantes.' },
      { term: 'Princípio da menor surpresa', aliases: ['POLA', 'principle of least astonishment', 'menor surpresa', 'least surprise'], definition: 'Um componente deve se comportar como a maioria dos leitores espera a partir do nome, da assinatura e das convenções da linguagem. Se o comportamento surpreende, mude o comportamento ou o nome.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Hoje vamos falar dos **princípios** que todo mundo cita em code review: DRY, YAGNI, KISS…',
          'Spoiler: eles são **heurísticas**, não leis. E cada um tem um lado sombrio quando levado ao extremo.',
        ],
        board: {
          title: 'Princípios são heurísticas',
          md: `| Princípio | Ideia central | Exagero comum |
|---|---|---|
| **DRY** | uma regra, um lugar | unificar tudo que *parece* igual |
| **Regra de Três** | abstraia na terceira repetição | abstrair na primeira "por via das dúvidas" |
| **YAGNI** | não construa o que ninguém pediu | ignorar decisões caras de reverter |
| **KISS** | a solução mais simples que resolve | "simples" virar "simplório" (sem validação, sem erro) |
| **Escoteiro** | deixe o código melhor do que encontrou | refatorar meio sistema num PR de bugfix |
| **Menor surpresa** | faça o que o nome promete | — (esse raramente é exagerado!) |

Princípios **entram em conflito**: DRY puxa para compartilhar código; baixo acoplamento puxa para separar. YAGNI diz "não generalize"; o aberto/fechado diz "prepare para extensão". Saber **quando** cada um vence é o que separa um dev sênior de alguém que decorou siglas.

> [!dica] Em review, troque "isso viola o DRY" por **qual problema concreto** a mudança causa: "se a regra de VIP mudar, vamos ter que lembrar de editar estes 3 arquivos".`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Começando pelo mais famoso — e mais mal-entendido: **DRY**.',
          'O DRY original não fala de linhas repetidas. Fala de **conhecimento** repetido.',
        ],
        board: {
          title: 'DRY: conhecimento, não texto',
          md: `> "Todo **conhecimento** deve ter uma representação única, inequívoca e oficial dentro de um sistema." — Andy Hunt e Dave Thomas, *The Pragmatic Programmer* (1999)

**Conhecimento duplicado** (unifique!): a mesma regra de negócio em dois lugares. Quando ela mudar, alguém vai esquecer um deles.

\`\`\`python
# cadastro.py
if len(cpf) != 11 or cpf == cpf[0] * 11: ...
# checkout.py — a MESMA regra; um dia só uma das cópias vai ser corrigida
if len(cpf) != 11 or cpf == cpf[0] * 11: ...
\`\`\`

**Duplicação acidental** (deixe separado!): textos iguais **por coincidência**, que mudam por **motivos diferentes**.

\`\`\`python
DESCONTO_VIP = 0.10      # decisão do marketing
TAXA_DE_SERVICO = 0.10   # custo operacional, decisão do financeiro

# Unificar em PERCENTUAL_PADRAO = 0.10 cria um acoplamento FALSO:
# o marketing muda o desconto e, sem querer, a taxa de serviço muda junto.
\`\`\`

Teste rápido: **"se uma cópia mudar, a outra precisa mudar junto?"** Se sim, é conhecimento duplicado. Se não, é coincidência.

> [!atencao] O DRY vale para além do código: um esquema de banco documentado à mão num wiki, uma regra de validação repetida no front e no back, o mesmo número mágico no código e na planilha do financeiro — tudo isso é conhecimento duplicado.`,
        },
      },
      {
        type: 'say',
        text: [
          'Se unificar cedo demais é perigoso, **quando** abstrair? A resposta clássica: na **terceira** vez.',
          { text: 'E se você já criou a abstração errada, a saída pode ser… **duplicar de volta**.', mood: 'surprised' },
        ],
        board: {
          title: 'Regra de Três e a abstração errada',
          md: `**Regra de Três** (Don Roberts, via Fowler): na 1ª vez, faça. Na 2ª, torça o nariz, mas duplique. Na **3ª**, abstraia — agora você tem três exemplos reais para enxergar o que é comum e o que varia.

Com dois exemplos, qualquer abstração é um palpite. O palpite errado costuma evoluir assim:

\`\`\`python
def calcula(pedido, percentual, eh_desconto=True, arredonda=True, ignora_vip=False):
    ...   # cada chamador novo ganhou um parâmetro-flag; ninguém entende mais
\`\`\`

> "Duplicação é muito mais barata que a abstração errada." — Sandi Metz

Quando a abstração virou um emaranhado de flags, o conselho de Metz é **voltar atrás**: faça *inline* dela em cada chamador, apague o que cada um não usa e deixe a abstração certa emergir depois.

| Sigla | Significado | Mensagem |
|---|---|---|
| **DRY** | *Don't Repeat Yourself* | uma regra, um lugar |
| **WET** | *Write Everything Twice* (ou, na piada, *We Enjoy Typing*) | tolerar a 2ª cópia; o apelido também é usado para código cheio de repetição |
| **AHA** | *Avoid Hasty Abstractions* (Kent C. Dodds) | prefira duplicar a abstrair às pressas |`,
        },
      },
      {
        type: 'say',
        text: [
          '**YAGNI** e **KISS** são primos: um diz "não construa o que ninguém pediu", o outro "construa do jeito mais simples".',
          'Mas YAGNI não é desculpa para código ruim. Ele fala de **funcionalidade** presumida, não de qualidade.',
        ],
        board: {
          title: 'YAGNI e KISS',
          md: `**YAGNI** — *You Aren't Gonna Need It* (Extreme Programming). Os custos de uma feature **presumida** (Martin Fowler):

| Custo | O que é |
|---|---|
| de **construir** | o tempo gasto nela, em vez de no que foi pedido |
| de **atraso** | o que foi pedido chega depois |
| de **carregar** | toda mudança futura precisa contornar esse código a mais |
| de **reparo** | quando a necessidade real chega, ela é diferente da prevista — e é preciso desfazer |

YAGNI **não** se aplica a: testes, refatorar, nomes bons, separar responsabilidades. Tudo isso **facilita a mudança** — é justamente o que permite adiar as features com tranquilidade.

**KISS** — *Keep It Simple, Stupid*. O lema é atribuído a Kelly Johnson, engenheiro da Lockheed: um jato tinha de ser consertável por um mecânico mediano, em campo, com ferramentas básicas.

\`\`\`python
# complexo sem necessidade
eh_par = lambda n: functools.reduce(lambda a, _: not a, range(n), True)
# simples
def eh_par(n):
    return n % 2 == 0
\`\`\`

> [!atencao] Simples ≠ fácil ≠ curto. Uma *one-liner* cheia de truques é curta, mas não é simples. E "simples" não autoriza pular validação ou tratamento de erro: a solução precisa **resolver** o problema.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'A **regra do escoteiro** diz: deixe o código um pouco melhor do que você encontrou.',
          'Mas cuidado com o entusiasmo: antes de "limpar" algo estranho, pergunte **por que** está ali.',
        ],
        board: {
          title: 'Regra do escoteiro e a cerca de Chesterton',
          md: `**Regra do escoteiro** (Robert C. Martin, adaptando Baden-Powell): a cada visita, uma melhoria **pequena** — renomear a variável confusa, extrair uma função, apagar código morto. Um pouco por vez, sem pedir permissão e sem transformar o PR de bugfix num PR de 2.000 linhas.

Agora, imagine este trecho num código que você está limpando:

\`\`\`python
def enviar_pedido(pedido, gateway):
    time.sleep(0.2)        # ???
    return gateway.cobrar(pedido)
\`\`\`

A tentação é apagar o \`sleep\`. Mas…

> [!sabia] **A cerca de Chesterton** (*Chesterton's fence*): em 1929, o escritor G. K. Chesterton imaginou um reformador que encontra uma cerca no meio de uma estrada e quer derrubá-la porque "não vê utilidade". A resposta: *"Se você não sabe para que ela serve, eu certamente não vou deixar você derrubá-la. Vá descobrir. Quando souber para que ela serve, aí talvez eu deixe."* No código: aquele \`sleep\` pode existir porque o gateway recusa duas cobranças em menos de 200 ms, ou porque a réplica do banco demora a receber o pedido.

Como investigar a cerca:
1. \`git blame\` / \`git log -S "sleep(0.2)"\` — quem colocou, quando, com que mensagem e qual issue;
2. testes que falham sem ela (ou a falta deles);
3. perguntar a quem conhece o sistema;
4. achou o motivo? Troque a gambiarra por uma solução **explícita** e deixe um comentário ou um teste. Não achou? Remova numa mudança **pequena e reversível**, e observe.

A cerca não é um "se funciona, não mexe": ela pede **entender antes de mudar**, não preservar para sempre.`,
        },
      },
      {
        type: 'say',
        text: [
          'O **princípio da menor surpresa** é o mais fácil de explicar: o código deve fazer o que o leitor espera.',
          'O próprio Python tem exemplos ótimos — alguns a favor e um famoso contra.',
        ],
        board: {
          title: 'Princípio da menor surpresa (POLA)',
          md: `**Surpresas que custam caro:**

\`\`\`python
def get_nome(usuario):                 # "get" que grava no banco!
    if not usuario.nome:
        usuario.nome = "Anônimo"
        usuario.salvar()
    return usuario.nome

def adicionar(item, itens=[]):         # o default é criado UMA vez só
    itens.append(item)
    return itens

adicionar("a")    # ['a']
adicionar("b")    # ['a', 'b']  <- surpresa!
\`\`\`

**Escolhas do Python pensadas para evitar surpresa:**
- \`lista.sort()\` devolve \`None\` de propósito: sinaliza que a mudança foi **no lugar**. Quem quer uma cópia usa \`sorted(lista)\`.
- \`dict.get(chave)\` devolve \`None\` em vez de lançar exceção — e o nome avisa que é uma consulta "tolerante".
- *Command-Query Separation* (Bertrand Meyer): um método ou **consulta** (devolve algo, sem efeito colateral) ou **comando** (muda estado). \`get_nome\` acima quebra essa regra.

> [!dica] Se você precisou escrever um comentário "atenção: esta função também…", o comportamento provavelmente surpreende. Mude o **nome** (\`obter_ou_definir_nome_padrao\`) ou, melhor, separe as responsabilidades.`,
        },
      },
      {
        type: 'say',
        mood: 'surprised',
        text: [
          'Para fechar a teoria, uma ideia provocadora que pouca gente conhece: ***worse is better***.',
          'Às vezes o design "pior" vence — e entender por quê ajuda a não cair no perfeccionismo.',
        ],
        board: {
          title: 'Worse is better',
          md: `> [!sabia] Em 1989, **Richard Gabriel** escreveu o ensaio *"Lisp: Good News, Bad News, How to Win Big"*. Nele, comparou dois estilos: o **"do MIT"** (*the right thing*: interface correta, consistente e completa, custe o que custar à implementação) e o **"de New Jersey"** (Unix e C, da Bell Labs: **implementação simples** acima de tudo, mesmo que a interface fique um pouco pior). A conclusão incômoda: o "pior" se espalha como um vírus — é fácil de portar, de entender e de melhorar aos poucos — e acaba vencendo. Ele chamou isso de ***worse is better***.

\`\`\`text
 "the right thing" (MIT)            "worse is better" (New Jersey)
 correção      > simplicidade       simplicidade da IMPLEMENTAÇÃO > tudo
 completude    > simplicidade       completude pode ser sacrificada
 consistência  > simplicidade       consistência pode ser sacrificada
\`\`\`

O que tirar disso no dia a dia:
- uma solução simples e **entregue** gera feedback real; a perfeita que nunca sai não gera nada;
- o simples pode **evoluir** (iterar é mais fácil sobre pouco código);
- mas não é licença para desleixo: o próprio Gabriel passou anos discutindo com ele mesmo, com réplicas como *"Worse is better is worse"* (assinada com pseudônimo!).

**Princípios em tensão** — não há vencedor fixo:

| Tensão | Quando um lado vence |
|---|---|
| DRY × baixo acoplamento | dois microsserviços com a "mesma" classe: muitas vezes é melhor duplicar do que criar uma biblioteca compartilhada que amarra os *deploys* |
| YAGNI × pensar à frente | decisões caras de reverter (API pública, formato de dados salvo) merecem mais cuidado desde o início |
| KISS × completude | um script de uso único pode ser simples; um sistema de pagamentos precisa tratar os casos de erro |`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Distinguir duplicações, investigar cercas e aplicar DRY sem exagero.', icon: '🎯' },
      {
        type: 'mcq',
        id: 'cc-princ-q1',
        concept: 'DRY',
        say: 'Primeiro, um review com duas propostas "em nome do DRY". Qual está certa?',
        prompt: `Num mesmo PR, um colega faz duas mudanças "para seguir o DRY":

1. A validação de CPF estava copiada em \`cadastro.py\` e em \`checkout.py\`; ele criou \`validar_cpf()\` num módulo compartilhado.
2. \`calcula_frete\` usava \`peso * 0.1\` e \`calcula_imposto_importacao\` usava \`valor * 0.1\`; ele criou \`aplica_dez_por_cento(x)\` e trocou os dois.

O que você comenta?`,
        options: [
          { text: '(1) está certa: é a mesma regra de negócio, que precisa mudar junto. (2) é duplicação acidental: frete e imposto mudam por motivos diferentes — mantenha separados, com constantes de nomes próprios.', correct: true, why: 'É exatamente a distinção do DRY original: **conhecimento** duplicado (a regra do CPF) versus **coincidência** textual (dois 10% que só são iguais hoje).' },
          { text: 'As duas estão certas: o DRY manda eliminar todo código repetido.', why: 'O DRY fala de conhecimento, não de texto. Quando a alíquota de importação mudar para 12%, `aplica_dez_por_cento` vai mentir no nome ou arrastar o frete junto.' },
          { text: 'As duas estão erradas: "duplicação é mais barata que a abstração errada", então nunca vale unificar.', why: 'A frase de Sandi Metz fala da abstração **errada**. Unificar uma regra de negócio realmente duplicada (o CPF) é a abstração certa.' },
          { text: '(2) está certa porque o número é igual; (1) deveria ficar duplicada, já que os módulos são de times diferentes.', why: 'Está invertido. O número igual é coincidência; a regra do CPF é a mesma regra, e duas cópias vão divergir no primeiro bugfix.' },
        ],
        explanation: 'Pergunte sempre: **"se uma cópia mudar, a outra precisa mudar junto?"**. Para o CPF, sim — é conhecimento duplicado, e unificar evita que um bugfix corrija só um dos lados. Para os 10%, não — são decisões diferentes (logística e tributação) que por acaso têm o mesmo valor hoje. Unificá-las cria **acoplamento falso**: uma mudança legítima numa regra quebra a outra. Constantes com nomes próprios (`TAXA_FRETE_POR_KG`, `ALIQUOTA_IMPORTACAO`) resolvem o número mágico sem acoplar nada.',
      },
      {
        type: 'match',
        id: 'cc-princ-q2',
        concept: 'Princípios de design',
        say: 'Agora, fixação rápida: qual princípio cada situação invoca?',
        prompt: 'Associe cada **situação** ao **princípio** que ela ilustra (ou viola).',
        pairs: [
          { left: 'A regra de "cliente VIP" está copiada em 5 arquivos, e a última mudança esqueceu dois deles', right: 'DRY' },
          { left: 'Criar uma interface `ExportadorPlugavel` com registro dinâmico quando só existe exportação para CSV', right: 'YAGNI' },
          { left: 'Uma regex de 300 caracteres onde um `split` e dois `if` resolveriam', right: 'KISS' },
          { left: 'Um `if` estranho, sem comentário: antes de apagá-lo, rodar `git blame` e ler a issue ligada', right: 'Cerca de Chesterton' },
          { left: 'Ao corrigir um bug, renomear a variável confusa ao lado e extrair uma função pequena', right: 'Regra do escoteiro' },
          { left: 'Um método `validar()` que, além de validar, salva o objeto no banco', right: 'Princípio da menor surpresa' },
        ],
        explanation: 'Os princípios funcionam melhor como **vocabulário** de review: "isso é uma cerca de Chesterton — alguém sabe por que esse `if` existe?" comunica a preocupação e o próximo passo numa frase. Repare que YAGNI e KISS andam juntos, mas são diferentes: YAGNI é sobre **o que** construir (só o necessário); KISS é sobre **como** construir (do jeito mais simples).',
      },
      {
        type: 'mcq',
        id: 'cc-princ-q3',
        concept: 'Cerca de Chesterton',
        say: 'Uma situação bem real: o `sleep` misterioso.',
        prompt: `Você encontra isto num serviço de pagamentos, sem comentário nem teste:

\`\`\`python
def enviar_pedido(pedido, gateway):
    time.sleep(0.2)
    return gateway.cobrar(pedido)
\`\`\`

Um colega quer apagar o \`sleep\` porque "deixa o checkout lento, e os testes passam sem ele". O que fazer?`,
        options: [
          { text: 'Investigar antes: `git log`/`git blame` da linha, a issue ou o PR de origem, e perguntar ao time. Achando o motivo, trocar por uma solução explícita (e documentada); não achando, remover numa mudança pequena, reversível e monitorada.', correct: true, why: 'É a cerca de Chesterton aplicada com equilíbrio: entender o porquê primeiro, sem ficar paralisado se o motivo não aparecer.' },
          { text: 'Apagar: se os testes passam, a linha é inútil.', why: 'Os testes só provam o que eles cobrem. O motivo do `sleep` provavelmente é algo que os testes não simulam (limite de taxa do gateway, réplica atrasada) — e o bug só vai aparecer em produção.' },
          { text: 'Nunca mexer: se funciona, não se mexe em código de pagamento.', why: 'A cerca de Chesterton não manda preservar para sempre; manda **entender antes de mudar**. Deixar gambiarras misteriosas acumula custo e medo.' },
          { text: 'Deixar a linha e adicionar o comentário `# não remova!` para ninguém mais tentar.', why: 'O comentário perpetua a ignorância: o próximo leitor continua sem saber **por quê**. Um bom comentário explica o motivo; esse só assusta.' },
        ],
        explanation: 'A cerca de Chesterton é um antídoto contra dois extremos: o reformador apressado (que apaga o que não entende) e o conservador medroso (que não toca em nada). O caminho do meio: **investigar** com as ferramentas certas (`git log -S`, `git blame`, issues, testes, pessoas). Se o motivo for real — por exemplo, o gateway recusa duas cobranças em menos de 200 ms —, substitua o `sleep` por algo explícito (um *rate limiter*, um *retry* com espera) e registre o motivo num comentário ou teste. Se ninguém souber, remova numa mudança isolada e fácil de reverter, observando as métricas.',
      },
      {
        type: 'code',
        id: 'cc-princ-q4',
        concept: 'DRY',
        title: 'DRY sem exagero: a loja do VIP',
        points: 50,
        say: 'Hora de praticar! A regra de VIP aparece três vezes — a Regra de Três diz que chegou a hora. Mas cuidado com o 0.10 duplicado…',
        prompt: `O código abaixo funciona, mas a regra "**cliente VIP** = 10+ compras no ano **ou** 5.000+ gastos no ano" está copiada em **três** funções, e a soma dos itens também. Quando o marketing mudar a regra de VIP, alguém vai esquecer uma cópia.

Refatore **sem mudar nenhum resultado**:

1. \`eh_vip(cliente)\` — a **única** representação da regra de VIP. As outras funções devem usá-la.
2. \`subtotal(pedido)\` — a **única** representação da soma \`preco * qtd\` dos itens.
3. Constantes \`DESCONTO_VIP\` e \`TAXA_DE_SERVICO\`, **separadas** — as duas valem \`0.10\` hoje, mas são decisões diferentes (marketing × financeiro). As funções devem lê-las (nada de copiar o valor em parâmetros padrão).
4. Dê nome também aos outros números da regra (10, 5000, 200, 25.0).

Os testes ocultos trocam a regra de VIP, a soma e as constantes **num lugar só** e conferem se todas as funções obedecem.`,
        starter: LOJA_DUPLICADA,
        tests: [
          { name: 'cliente comum, 2 × 60,00: sem desconto', expr: 'preco_final({"cliente": {"nome": "Caio", "compras_no_ano": 2, "gasto_no_ano": 300.0}, "itens": [{"preco": 60.0, "qtd": 2}]})', expected: '120.0', compare: 'approx' },
          { name: 'VIP por compras: 10% de desconto e frete grátis', code: py(`
            vip = {"nome": "Ana", "compras_no_ano": 10, "gasto_no_ano": 0.0}
            pedido = {"cliente": vip, "itens": [{"preco": 50.0, "qtd": 1}]}
            assert abs(preco_final(pedido) - 45.0) < 1e-9, preco_final(pedido)
            assert frete(pedido) == 0.0
            assert saudacao(vip) == "Olá, Ana! Obrigada por ser VIP."
          `) },
          { name: 'frete: grátis a partir de 200,00; senão 25,00', code: py(`
            comum = {"nome": "Bia", "compras_no_ano": 0, "gasto_no_ano": 4999.99}
            assert frete({"cliente": comum, "itens": [{"preco": 200.0, "qtd": 1}]}) == 0.0
            assert frete({"cliente": comum, "itens": [{"preco": 199.99, "qtd": 1}]}) == 25.0
            assert saudacao(comum) == "Olá, Bia!"
          `) },
          { name: 'funções e constantes pedidas', code: py(`
            assert eh_vip({"compras_no_ano": 0, "gasto_no_ano": 5000})
            assert not eh_vip({"compras_no_ano": 9, "gasto_no_ano": 4999.99})
            assert abs(subtotal({"itens": [{"preco": 10.0, "qtd": 3}, {"preco": 2.5, "qtd": 2}]}) - 35.0) < 1e-9
            assert subtotal({"itens": []}) == 0
            assert DESCONTO_VIP == 0.10 and TAXA_DE_SERVICO == 0.10
          `) },
          {
            name: 'mesmos resultados da versão original (caracterização)',
            hidden: true,
            code: ORIGINAL + py(`
              clientes = [
                  {"nome": "A", "compras_no_ano": c, "gasto_no_ano": g}
                  for c in (0, 9, 10, 11) for g in (0.0, 4999.99, 5000, 7500.5)
              ]
              carrinhos = [
                  [],
                  [{"preco": 19.9, "qtd": 3}],
                  [{"preco": 199.99, "qtd": 1}],
                  [{"preco": 200.0, "qtd": 1}],
                  [{"preco": 33.33, "qtd": 3}, {"preco": 0.01, "qtd": 7}],
                  [{"preco": 1234.56, "qtd": 2}, {"preco": 9.99, "qtd": 1}],
              ]
              for cliente in clientes:
                  for itens in carrinhos:
                      p = {"cliente": cliente, "itens": itens}
                      assert abs(preco_final(p) - _preco_original(p)) < 1e-9, f"preco_final mudou para {p}"
                      assert frete(p) == _frete_original(p), f"frete mudou para {p}"
                      assert abs(taxa_de_servico(p) - _taxa_original(p)) < 1e-9, f"taxa_de_servico mudou para {p}"
            `),
          },
          {
            name: 'a regra de VIP mora num lugar só',
            hidden: true,
            code: py(`
              eh_vip = lambda cliente: cliente["nome"] == "Ana"     # o marketing mudou a regra!
              ana = {"nome": "Ana", "compras_no_ano": 0, "gasto_no_ano": 0.0}
              bia = {"nome": "Bia", "compras_no_ano": 50, "gasto_no_ano": 99999.0}
              item = [{"preco": 100.0, "qtd": 1}]
              assert abs(preco_final({"cliente": ana, "itens": item}) - 90.0) < 1e-9, "preco_final não consulta eh_vip()"
              assert abs(preco_final({"cliente": bia, "itens": item}) - 100.0) < 1e-9, "preco_final ainda tem uma cópia da regra de VIP"
              assert frete({"cliente": ana, "itens": item}) == 0.0, "frete não consulta eh_vip()"
              assert frete({"cliente": bia, "itens": item}) == 25.0, "frete ainda tem uma cópia da regra de VIP"
              assert saudacao(ana).endswith("VIP."), "saudacao não consulta eh_vip()"
              assert saudacao(bia) == "Olá, Bia!", "saudacao ainda tem uma cópia da regra de VIP"
            `),
          },
          {
            name: 'a soma dos itens mora num lugar só',
            hidden: true,
            code: py(`
              subtotal = lambda pedido: 1000.0
              comum = {"nome": "Caio", "compras_no_ano": 0, "gasto_no_ano": 0.0}
              p = {"cliente": comum, "itens": [{"preco": 1.0, "qtd": 1}]}
              assert abs(preco_final(p) - 1000.0) < 1e-9, "preco_final não usa subtotal()"
              assert frete(p) == 0.0, "frete não usa subtotal()"
              assert abs(taxa_de_servico(p) - 100.0) < 1e-9, "taxa_de_servico não usa subtotal()"
            `),
          },
          {
            name: 'desconto e taxa são conhecimentos separados',
            hidden: true,
            code: py(`
              vip = {"nome": "Ana", "compras_no_ano": 10, "gasto_no_ano": 0.0}
              p = {"cliente": vip, "itens": [{"preco": 100.0, "qtd": 1}]}
              TAXA_DE_SERVICO = 0.2
              assert abs(taxa_de_servico(p) - 20.0) < 1e-9, "taxa_de_servico não lê TAXA_DE_SERVICO"
              assert abs(preco_final(p) - 90.0) < 1e-9, "mudar a taxa de serviço mudou o desconto VIP: acoplamento falso!"
              DESCONTO_VIP = 0.5
              assert abs(preco_final(p) - 50.0) < 1e-9, "preco_final não lê DESCONTO_VIP"
              assert abs(taxa_de_servico(p) - 20.0) < 1e-9, "mudar o desconto mudou a taxa de serviço: acoplamento falso!"
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => (code.match(/compras_no_ano/g) || []).length > 1,
            text: '`compras_no_ano` ainda aparece em mais de um lugar: a regra de VIP continua duplicada. Todo o conhecimento "quem é VIP" deve morar em `eh_vip` — as outras funções só perguntam.',
            concept: 'DRY',
          },
          {
            when: (m, code) => (code.match(/\[\s*["']preco["']\s*\]/g) || []).length > 1,
            text: 'A conta `preco * qtd` ainda aparece em mais de uma função. Se um dia entrar desconto por item, você vai ter que lembrar de todas as cópias: deixe só em `subtotal`.',
            concept: 'DRY',
          },
          {
            when: (m, code) => /^[ \t]+[^#\n]*(\b0\.1\d*\b|\b5000\b|\b200\b|\b25\.0\b)/m.test(code),
            text: 'Ainda há **números mágicos** dentro das funções. Com nome (`FRETE_GRATIS_A_PARTIR_DE`, `GASTO_MINIMO_VIP`…), a regra vira algo que dá para buscar, ler e mudar num lugar só.',
            concept: 'Replace Magic Literal',
          },
          {
            when: m => m.maxParams >= 3,
            text: 'Uma função com 3 ou mais parâmetros aqui costuma ser a **abstração errada**: juntar desconto, taxa e frete numa função genérica com flags acopla conhecimentos que mudam por motivos diferentes. Prefira funções pequenas com nomes do domínio.',
            concept: 'Abstração errada',
          },
        ],
        hints: [
          'Comece pelas duas extrações, sem mexer no resto: `eh_vip(cliente)` devolve `cliente["compras_no_ano"] >= COMPRAS_MINIMAS_VIP or cliente["gasto_no_ano"] >= GASTO_MINIMO_VIP`; `subtotal(pedido)` devolve `sum(item["preco"] * item["qtd"] for item in pedido["itens"])`.',
          'Depois troque cada cópia por uma chamada: `if eh_vip(pedido["cliente"]):` em `preco_final` e `frete`, `if eh_vip(cliente):` em `saudacao`, e `total = subtotal(pedido)` onde havia o `for`.',
          'Crie `DESCONTO_VIP = 0.10` e `TAXA_DE_SERVICO = 0.10` como **duas** constantes, cada uma usada só pela sua regra. Mantenha a ordem das contas (`total - total * DESCONTO_VIP`, depois `round`) para os centavos baterem.',
        ],
        solution: py(`
          DESCONTO_VIP = 0.10              # política comercial (marketing)
          TAXA_DE_SERVICO = 0.10           # custo operacional (financeiro) — igual hoje só por coincidência
          COMPRAS_MINIMAS_VIP = 10
          GASTO_MINIMO_VIP = 5000
          FRETE_GRATIS_A_PARTIR_DE = 200
          FRETE_PADRAO = 25.0


          def eh_vip(cliente):
              return (cliente["compras_no_ano"] >= COMPRAS_MINIMAS_VIP
                      or cliente["gasto_no_ano"] >= GASTO_MINIMO_VIP)


          def subtotal(pedido):
              return sum(item["preco"] * item["qtd"] for item in pedido["itens"])


          def preco_final(pedido):
              total = subtotal(pedido)
              if eh_vip(pedido["cliente"]):
                  total -= total * DESCONTO_VIP
              return round(total, 2)


          def frete(pedido):
              if eh_vip(pedido["cliente"]) or subtotal(pedido) >= FRETE_GRATIS_A_PARTIR_DE:
                  return 0.0
              return FRETE_PADRAO


          def taxa_de_servico(pedido):
              return round(subtotal(pedido) * TAXA_DE_SERVICO, 2)


          def saudacao(cliente):
              if eh_vip(cliente):
                  return f"Olá, {cliente['nome']}! Obrigada por ser VIP."
              return f"Olá, {cliente['nome']}!"
        `),
        solutionExplanation: 'A regra de VIP e a soma dos itens eram **conhecimento duplicado** — três cópias de cada, exatamente o ponto em que a Regra de Três manda abstrair. Agora cada uma tem uma representação única (`eh_vip` e `subtotal`), e os testes ocultos provam isso trocando a regra num lugar só e vendo todas as funções obedecerem. Já `DESCONTO_VIP` e `TAXA_DE_SERVICO` continuam **separadas** de propósito: valem 0,10 por coincidência, mas mudam por motivos diferentes. Unificá-las num `PERCENTUAL_PADRAO` seria DRY mal aplicado — o teste oculto muda uma e confere que a outra não se mexe. Repare também no que **não** fizemos: nenhuma função genérica `aplica_percentual(pedido, percentual, eh_desconto)` com flags. Funções pequenas com nomes do domínio são a abstração certa aqui.',
      },
      {
        type: 'mcq',
        id: 'cc-princ-q5',
        concept: 'Princípio da menor surpresa',
        multiple: true,
        say: 'Agora, um olhar de revisor: quais destas APIs vão surpreender quem as usa?',
        prompt: 'Marque **todas** as APIs que violam o **princípio da menor surpresa**.',
        options: [
          { text: '`usuario.get_nome()` que, se o nome estiver vazio, grava "Anônimo" no banco e devolve esse valor.', correct: true, why: 'Um `get_` promete uma **consulta**. Gravar no banco é um efeito colateral escondido — viola também a *Command-Query Separation*.' },
          { text: '`def adicionar(item, itens=[])`, que acumula itens de chamadas anteriores quando `itens` não é passado.', correct: true, why: 'O default mutável é avaliado uma única vez, na definição da função. Quase todo mundo espera uma lista nova a cada chamada.' },
          { text: 'Uma classe `Fila` cujo `__len__` remove e descarta os itens expirados enquanto conta.', correct: true, why: '`len()` é universalmente entendido como uma leitura. Uma chamada inocente de `len(fila)` num log mudaria o estado da fila.' },
          { text: '`lista.sort()` devolver `None` em vez da lista ordenada.', why: 'É uma decisão **a favor** da menor surpresa: devolver `None` deixa claro que a ordenação foi no lugar. Quem quer uma cópia nova usa `sorted(lista)`.' },
          { text: '`config.get("porta")` devolver `None` quando a chave não existe.', why: 'É a convenção do `dict.get` que todo dev Python conhece: o nome `get` já avisa que a ausência é tolerada. Surpresa seria lançar `KeyError`.' },
        ],
        explanation: 'O princípio da menor surpresa (*Principle of Least Astonishment*) mede a distância entre o que o leitor **espera** — a partir do nome, da assinatura e das convenções da linguagem — e o que o código **faz**. Por isso ele depende do contexto: `sort()` devolver `None` seria estranho em outra linguagem, mas em Python é a convenção para mutação no lugar. Quando o comportamento surpreende, há duas saídas: mudar o comportamento (separar consulta de comando) ou mudar o **nome** para contar a verdade.',
      },
      {
        type: 'open',
        id: 'cc-princ-q6',
        concept: 'YAGNI',
        say: 'Para fechar, uma discussão que acontece em todo time.',
        prompt: 'A história da sprint é "exportar o relatório mensal em **CSV**". Um colega sênior propõe construir já um **framework de exportação** com plugins, suporte a PDF, XLSX e JSON, "porque um dia vão pedir". Como você argumentaria? E em que casos vale, sim, pensar no futuro?',
        minWords: 35,
        rubric: [
          { label: 'Cita **YAGNI** e os custos da feature presumida (construir, atrasar, carregar, errar a previsão)', keywords: ['yagni', 'nao vai precisar', 'nao vamos precisar', 'custo', 'manutenc', 'atras', 'especulat', 'presumid', 'previs', 'pode nao ser', 'talvez nunca', 'ninguem pediu'], concept: 'YAGNI', why: 'Feature presumida custa para construir, atrasa o que foi pedido, pesa em toda mudança futura e, quando a necessidade real chega, costuma ser diferente da prevista.' },
          { label: 'Propõe a solução **simples** agora (KISS): entregar o CSV', keywords: ['simples', 'kiss', 'so o csv', 'apenas o csv', 'somente o csv', 'entregar o csv', 'minimo', 'necessario agora', 'o que foi pedido'], concept: 'KISS', why: 'Entregar o que foi pedido, do jeito mais simples, gera valor e feedback real mais cedo.' },
          { label: 'Mantém o código **fácil de mudar** (testes, refatoração, Regra de Três) para generalizar quando a necessidade real aparecer', keywords: ['refator', 'teste', 'regra de tres', 'terceir', 'quando precisar', 'quando pedirem', 'quando surgir', 'facil de mudar', 'facil de estender', 'bem separad', 'extrair depois', 'generalizar depois'], concept: 'Regra de Três', why: 'YAGNI funciona porque código limpo e testado é barato de mudar: a abstração certa pode nascer quando o segundo ou terceiro formato for pedido de verdade.' },
          { label: 'Reconhece a exceção: decisões **caras de reverter** (API pública, formato de dados, contratos) merecem pensar à frente', keywords: ['reverter', 'irreversi', 'caro de mudar', 'cara de mudar', 'dificil de mudar', 'dificil de desfazer', 'api publica', 'contrato', 'formato de dados', 'dados persistid', 'porta de mao unica', 'one-way', 'one way', 'migracao'], concept: 'Decisões reversíveis', why: 'O YAGNI mira funcionalidade presumida. Interfaces públicas e formatos de dados salvos são caros de mudar depois — nesses pontos, um pouco de cuidado antecipado se paga.' },
        ],
        modelAnswer: `Eu argumentaria com **YAGNI**: ninguém pediu PDF, XLSX ou JSON. O framework tem custo para construir, **atrasa** o CSV que foi pedido, vira código a **manter** em toda mudança futura e, se um dia pedirem outro formato, a necessidade real provavelmente vai ser diferente da prevista — e aí será preciso desfazer.

Proponho a solução **simples** agora (KISS): entregar só o CSV, com uma função bem nomeada que separa "montar as linhas do relatório" de "escrever em CSV".

Essa separação, com **testes**, deixa o código **fácil de mudar**: quando o segundo formato for pedido, **refatoramos** e extraímos a interface; na terceira vez (Regra de Três), talvez um registro de exportadores faça sentido.

A exceção são as decisões **caras de reverter**: se o CSV fosse uma **API pública** ou um **formato de dados** consumido por outros sistemas (um contrato), valeria pensar à frente em versionamento e compatibilidade, porque mudar depois exige migrar todos os consumidores.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Muito bem! Agora você sabe usar os princípios como ferramentas — e reconhecer quando eles viram dogma.',
          'Na próxima unidade vamos encarar o monstro de verdade: **código legado**, aquele sem testes que ninguém quer tocar.',
        ],
        board: null,
      },
    ],
  });
})();
