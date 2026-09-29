(function () {
  // Remove a indentação comum de um bloco Python escrito dentro do JS.
  const py = src => {
    const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    return lines.map(l => l.slice(indent)).join('\n') + '\n';
  };

  // O código do PR em revisão (funciona no caminho feliz — e só nele).
  const PR_CUPOM = py(`
    import sqlite3


    def aplica_cupom(db, codigo, hoje, itens=[]):
        cur = db.cursor()
        cur.execute(f"SELECT desconto, validade, usos FROM cupons WHERE codigo = '{codigo}'")
        c = cur.fetchone()
        t = 0
        for i in itens:
            t += i["preco"] * i["qtd"]
        if c:
            if hoje < c[1]:
                if c[2] > 0:
                    t = t - t * c[0] / 100
                    cur.execute(f"UPDATE cupons SET usos = usos - 1 WHERE codigo = '{codigo}'")
        try:
            db.commit()
        except:
            pass
        return round(t, 2)
  `);

  // Banco de teste compartilhado pelos testes da questão de código.
  const BANCO = py(`
    import sqlite3

    def _banco(*cupons):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE cupons (codigo TEXT PRIMARY KEY, desconto INTEGER, validade TEXT, usos INTEGER)")
        db.executemany("INSERT INTO cupons VALUES (?, ?, ?, ?)", cupons or [
            ("PROMO10", 10, "2024-06-30", 5),
            ("ESGOTADO", 50, "2024-12-31", 0),
            ("VENCIDO", 20, "2024-01-31", 3),
        ])
        db.commit()
        return db

    def _usos(db, codigo):
        return db.execute("SELECT usos FROM cupons WHERE codigo = ?", (codigo,)).fetchone()[0]

    _ITENS = [{"preco": 50.0, "qtd": 2}, {"preco": 30.0, "qtd": 1}]     # subtotal: 130,00
  `);

  Game.registerModule('clean-code', {
    id: 'entrevista-code-review',
    title: 'Entrevista: code review ao vivo',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'Revise ao vivo o PR de um dev júnior: encontre bugs, falhas de segurança e cheiros de código, priorize do bloqueante ao nit, escreva um comentário construtivo e corrija o código — com follow-up de concorrência.',
    concepts: ['Code review', 'Severidade de comentários', 'SQL injection', 'Comentário construtivo', 'Check-then-act'],
    takeaways: [
      'Revise em camadas, do mais caro de mudar ao mais barato: **segurança e correção** primeiro, depois robustez e testes, e só então design, nomes e estilo.',
      'Rotule cada comentário com a **severidade** (bloqueante, sugestão, *nit*): o autor sabe o que precisa mudar antes do merge e o que é opinião.',
      'Um bom comentário diz **o quê**, **por quê** (o impacto) e **como** (uma sugestão concreta), fala do **código** e não da pessoa, e reconhece o que ficou bom.',
      'SQL nunca é montado com f-string: use **query parametrizada** (`?`). Erros não são engolidos com `except: pass`. Limites (`<` × `<=`) merecem um teste.',
      '"Ler, checar e depois escrever" é uma corrida (**check-then-act**/TOCTOU): torne a operação **atômica** no banco (`UPDATE ... WHERE usos > 0` e confira o `rowcount`).',
    ],
    glossary: [
      { term: 'Conventional Comments', aliases: ['conventional comment', 'comentários convencionais', 'comentarios convencionais'], definition: 'Convenção para comentários de review com um **rótulo** no início — `praise:`, `issue:`, `suggestion:`, `question:`, `nitpick:` — e decorações como `(blocking)` ou `(non-blocking)`. Deixa claro o tipo e a severidade de cada comentário.' },
      { term: 'Nit', aliases: ['nits', 'nitpick', 'nitpicks', 'nit:'], definition: 'Comentário de review sobre um detalhe menor (estilo, formatação, preferência) que **não bloqueia** o merge. Se aparece sempre, é sinal de que a regra deveria estar num linter ou formatador.' },
      { term: 'Bikeshedding', aliases: ['bike shedding', 'lei da trivialidade', 'lei de parkinson da trivialidade', 'law of triviality'], definition: 'A "Lei da Trivialidade" de C. Northcote Parkinson (1957): um comitê aprova uma usina nuclear em minutos, mas discute por horas o bicicletário. Em review: gastar energia no trivial (nomes, vírgulas) e deixar passar o importante.' },
      { term: 'Query parametrizada', aliases: ['queries parametrizadas', 'consulta parametrizada', 'consultas parametrizadas', 'prepared statement', 'prepared statements', 'parameterized query'], definition: 'Consulta SQL em que os valores vão **separados** do texto do comando (`WHERE codigo = ?` + a tupla de parâmetros). O banco nunca interpreta o valor como SQL — é a defesa padrão contra SQL injection.' },
      { term: 'TOCTOU', aliases: ['time-of-check to time-of-use', 'check-then-act', 'checar e depois agir'], definition: '*Time-of-check to time-of-use*: bug em que você **checa** uma condição e depois **age** com base nela, mas o estado muda entre os dois passos (outra requisição, outro processo). A correção é tornar checagem e ação uma única operação atômica.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Olá! Hoje eu sou sua **entrevistadora**, e a entrevista é um **code review ao vivo**.',
          'Vou mostrar o PR de um dev júnior do time. Quero ver o que você **encontra**, como **prioriza** e como **comunica**.',
        ],
        board: {
          title: '📋 Enunciado',
          md: `**Você é a pessoa revisora do PR #482.** O autor é o Rafa, no segundo mês de empresa.

O que vamos avaliar nesta entrevista:

| Etapa | O que eu observo |
|---|---|
| **Encontrar** | bugs, segurança, robustez, testes, legibilidade — e **não** apontar falsos problemas |
| **Priorizar** | separar o que **bloqueia** o merge do que é sugestão ou detalhe |
| **Comunicar** | um comentário que ensina, sem humilhar ninguém |
| **Corrigir** | reescrever o trecho mantendo a interface |
| **Follow-up** | o que acontece com esse código sob carga, em produção |

> [!dica] Em entrevistas de code review, o erro mais comum é **começar pelos nomes** das variáveis. Leia primeiro procurando o que pode dar prejuízo — dinheiro, dados, segurança — e deixe o estilo para o fim.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Aqui está o PR. O Rafa diz que "testou na máquina dele e funcionou".',
          'Leia com calma. Funcionar no caminho feliz é só o começo.',
        ],
        board: {
          title: 'PR #482 — Aplica cupom de desconto no checkout',
          md: `> **Descrição:** "Implementei o cupom. \`hoje\` vem do checkout no formato \`AAAA-MM-DD\`. Testei na minha máquina com o PROMO10 e funcionou!" · **+21 −0** · nenhum arquivo de teste alterado

\`\`\`python
import sqlite3


def aplica_cupom(db, codigo, hoje, itens=[]):
    cur = db.cursor()
    cur.execute(f"SELECT desconto, validade, usos FROM cupons WHERE codigo = '{codigo}'")
    c = cur.fetchone()
    t = 0
    for i in itens:
        t += i["preco"] * i["qtd"]
    if c:
        if hoje < c[1]:
            if c[2] > 0:
                t = t - t * c[0] / 100
                cur.execute(f"UPDATE cupons SET usos = usos - 1 WHERE codigo = '{codigo}'")
    try:
        db.commit()
    except:
        pass
    return round(t, 2)
\`\`\`

A tabela: \`cupons(codigo TEXT PRIMARY KEY, desconto INTEGER, validade TEXT, usos INTEGER)\` — \`desconto\` em %, \`validade\` é o **último dia** em que o cupom vale (\`'2024-06-30'\`), \`usos\` é quantos usos restam. O \`codigo\` é digitado pelo cliente na tela do checkout.

> [!dica] Algo **bom** também: o Rafa recebeu \`hoje\` como parâmetro em vez de chamar \`date.today()\` lá dentro. Isso facilita testar — e merece um elogio no review.`,
        },
      },
      {
        type: 'mcq',
        id: 'cc-cr-q1',
        concept: 'Code review',
        multiple: true,
        say: 'Primeira pergunta: o que, neste PR, é problema **de verdade**?',
        prompt: 'Marque **todos** os problemas **reais** do PR #482.',
        options: [
          { text: 'O `codigo`, digitado pelo cliente, entra na SQL por f-string: com `\' OR \'1\'=\'1` qualquer pessoa aplica o primeiro cupom do banco (SQL injection).', correct: true, why: 'É o problema mais grave: entrada do usuário interpretada como SQL. No `UPDATE`, o mesmo ataque ainda decrementa **todos** os cupons.' },
          { text: '`hoje < c[1]`: no último dia da validade o cupom já é recusado.', correct: true, why: '`validade` é o último dia **válido**, então a condição deveria ser `hoje <= validade`. Um erro de limite clássico, que um teste com a data exata pegaria.' },
          { text: 'O `except: pass` em volta do `commit`: se a gravação falhar, o cliente leva o desconto, o uso não é descontado e ninguém fica sabendo.', correct: true, why: 'Erro engolido em silêncio vira inconsistência de dados difícil de rastrear. Se o commit falha, a exceção precisa subir.' },
          { text: 'O `for` que soma os itens deixa a função O(n²).', why: 'É um único laço sobre os itens: O(n). Apontar falsos problemas de desempenho tira a credibilidade do review.' },
          { text: 'Comparar datas como texto (`\'2024-06-30\'`) é sempre errado.', why: 'Datas ISO 8601 (`AAAA-MM-DD`) com o mesmo formato comparam corretamente como texto — por isso o formato foi desenhado assim. O problema está no **operador** (`<`), não no tipo.' },
          { text: 'A lógica deveria estar numa classe `CupomService`; funções soltas não passam em code review.', why: 'Preferência de estilo, não problema. Uma função bem escrita é perfeitamente adequada aqui — impor classes é o tipo de comentário que só gera atrito.' },
        ],
        explanation: 'Um bom review encontra os problemas que causam **prejuízo real** — a injeção de SQL (segurança), o limite errado da validade (regra de negócio) e o erro engolido (dados inconsistentes) — e **não** inventa problemas. Falsos positivos ("isso é O(n²)", "use uma classe") gastam o tempo do autor, geram discussão inútil e fazem ele levar menos a sério os comentários importantes. Repare também no que o PR **não tem**: nenhum teste. Com um teste do último dia de validade e outro com um código malicioso, dois dos três bugs teriam aparecido antes do review.',
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Achou os problemas? Ótimo. Mas despejar 15 comentários sem ordem deixa qualquer autor perdido.',
          'O próximo passo é **classificar** e **priorizar**.',
        ],
        board: {
          title: 'Severidade: do bloqueante ao nit',
          md: `| Nível | Exemplos | Rótulo sugerido |
|---|---|---|
| 🔴 **Bloqueante — segurança** | injeção, segredo no código, autorização faltando | \`issue (blocking):\` |
| 🔴 **Bloqueante — correção** | regra errada, limite errado, perda de dados | \`issue (blocking):\` |
| 🟠 **Importante — robustez** | erro engolido, falta de transação, corrida | \`issue:\` |
| 🟠 **Importante — testes** | caminhos novos sem teste | \`issue:\` / \`suggestion:\` |
| 🟡 **Sugestão — design** | aninhamento, nomes, duplicação | \`suggestion (non-blocking):\` |
| ⚪ **Nit — estilo** | import sem uso, formatação | \`nitpick:\` — melhor ainda: deixe para o linter |

Os rótulos vêm do padrão **Conventional Comments**: cada comentário começa dizendo **o que ele é** (\`praise\`, \`issue\`, \`suggestion\`, \`question\`, \`nitpick\`) e se **bloqueia** ou não. O autor sabe na hora o que é obrigatório e o que é opinião.

A ordem segue o **custo de corrigir depois**: um bug de segurança em produção custa caro; um nome ruim custa pouco — e dá para mudar amanhã.

> [!sabia] ***Bikeshedding*** (a "Lei da Trivialidade", de C. Northcote Parkinson, 1957): um comitê aprova o projeto de uma **usina nuclear** em poucos minutos — ninguém se sente capaz de discuti-lo —, mas passa horas debatendo o **bicicletário** (*bike shed*), que todo mundo entende. Em code review, é o PR que recebe 20 comentários sobre nomes e nenhum sobre a query vulnerável. Revise primeiro o que é difícil.

> [!dica] A diretriz de review do Google resume o objetivo: aprove quando o PR **melhora a saúde geral do código**, mesmo que não esteja perfeito. Não existe código perfeito — existe código **melhor**.`,
        },
      },
      {
        type: 'match',
        id: 'cc-cr-q2',
        concept: 'Code review',
        say: 'Vamos categorizar: cada trecho do PR, com o seu tipo de problema.',
        prompt: 'Associe cada **trecho do PR** à **categoria** do problema.',
        pairs: [
          { left: '`f"... WHERE codigo = \'{codigo}\'"`', right: 'Segurança (injeção de SQL)' },
          { left: '`if hoje < c[1]:`', right: 'Bug de regra (limite errado)' },
          { left: '`except: pass`', right: 'Erro silenciado (robustez)' },
          { left: '`c[0]`, `c[2]`, `t`, `i`', right: 'Nomes pouco expressivos' },
          { left: 'Três `if` aninhados, um dentro do outro', right: 'Complexidade (código em seta)' },
          { left: 'Nenhum `test_*.py` no PR', right: 'Falta de testes' },
        ],
        explanation: 'Nomear a **categoria** ajuda o autor a aprender o padrão, e não só a corrigir a linha: "injeção de SQL" leva a estudar queries parametrizadas; "limite errado" leva a testar fronteiras; "código em seta" leva a *guard clauses*. Um review que só diz "muda isso" corrige um PR; um review que diz **qual é o problema** melhora os próximos.',
      },
      {
        type: 'order',
        id: 'cc-cr-q3',
        concept: 'Severidade de comentários',
        say: 'Agora, a ordem dos seus comentários. O que o Rafa precisa ler primeiro?',
        prompt: 'Ordene os comentários do review do **mais grave** (bloqueante) ao **mais leve** (nit).',
        items: [
          'SQL injection: `codigo` interpolado na query com f-string',
          'Cupom recusado no próprio dia da validade (`<` em vez de `<=`)',
          '`except: pass` esconde falhas no `commit`',
          'Nenhum teste para cupom vencido, esgotado ou inexistente',
          'Três `if` aninhados: sugerir guard clauses e nomes como `cupom` e `total`',
          'nit: `import sqlite3` sem uso',
        ],
        explanation: 'Segurança primeiro: a injeção expõe o banco inteiro a qualquer cliente. Depois a **correção** (clientes com cupom válido sendo recusados), a **robustez** (dados inconsistentes sem alarme) e a falta de **testes**, que é o que deixaria esses bugs voltarem. Design e nomes são sugestões valiosas, mas não bloqueiam; o import sem uso é um *nit* — e o ideal é que um linter (como o Ruff) o pegue antes de qualquer humano. Numa entrevista, verbalizar essa ordem mostra **senso de prioridade**, que é justamente o que diferencia um review sênior.',
      },
      {
        type: 'say',
        text: [
          'Priorizado. Agora, a parte que mais separa um revisor bom de um revisor temido: **como** escrever o comentário.',
          'Lembre: do outro lado tem uma pessoa no segundo mês de empresa.',
        ],
        board: {
          title: 'Anatomia de um comentário construtivo',
          md: `**Ruim:**

> "Isso tá errado, nunca faça SQL assim. Básico."

**Bom:**

> **issue (blocking):** o \`codigo\` vem do cliente e entra direto na SQL pela f-string. Com \`' OR '1'='1\`, qualquer pessoa aplica o primeiro cupom do banco — e, no \`UPDATE\`, decrementa **todos** os cupons (SQL injection).
>
> Sugestão: usar uma query parametrizada, que deixa o próprio driver cuidar do valor:
> \`db.execute("SELECT ... WHERE codigo = ?", (codigo,))\`
>
> Tem uma boa explicação no guia da OWASP; se quiser, podemos parear nisso rapidinho. E gostei de você receber \`hoje\` por parâmetro — isso deixa os testes fáceis!

| Elemento | No exemplo |
|---|---|
| **rótulo e severidade** | \`issue (blocking)\` |
| **o quê + impacto** | a entrada do cliente vira SQL; o ataque aplica cupom e estraga os dados |
| **como** (sugestão concreta) | query parametrizada, com o código |
| **fala do código, não da pessoa** | "o \`codigo\` entra na SQL", e não "você fez errado" |
| **ajuda e elogio sincero** | link, oferta de pareamento, elogio ao \`hoje\` injetado |

> [!atencao] Perguntas genuínas ("o que acontece se o \`codigo\` tiver uma aspa?") ensinam mais do que ordens — mas **não** use pergunta retórica para disfarçar um bloqueio. Se é bloqueante, diga que é.`,
        },
      },
      {
        type: 'open',
        id: 'cc-cr-q4',
        concept: 'Comentário construtivo',
        say: 'Sua vez de escrever. Imagine que o Rafa vai ler agora.',
        prompt: 'Escreva o **comentário de review** sobre a **injeção de SQL** no PR #482, dirigido ao Rafa (dev júnior, segundo mês de empresa). Ele deve deixar claro o problema, o impacto, a gravidade e como corrigir — sem desanimar o autor.',
        minWords: 30,
        placeholder: 'Escreva o comentário como se fosse publicá-lo no PR…',
        rubric: [
          { label: 'Explica o problema e o **impacto** (entrada do cliente vira SQL; exemplo de ataque)', keywords: ['injec', 'injection', 'atacante', 'ataque', 'malicios', "or '1'='1", 'or 1=1', "'1'='1", 'qualquer cupom', 'qualquer pessoa', 'qualquer cliente', 'drop table', 'vazar', 'explor', 'interpreta'], concept: 'SQL injection', why: 'Sem o impacto, o comentário parece preferência de estilo. Com um exemplo concreto de ataque, o autor entende por que é grave.' },
          { label: 'Sugere a **correção concreta**: query parametrizada', keywords: ['parametriz', 'placeholder', 'bind', 'prepared', 'where codigo = ?', 'codigo = ?', '(codigo,)', 'segundo argumento', 'segundo parametro', 'tupla'], concept: 'Query parametrizada', why: 'Um bom comentário diz **como** resolver: a query parametrizada separa o comando dos valores, e o banco nunca executa o valor como SQL.' },
          { label: 'Deixa clara a **severidade** (bloqueante)', keywords: ['bloque', 'blocking', 'blocker', 'antes do merge', 'antes de mergear', 'antes de aprovar', 'nao pode ir', 'nao podemos subir', 'nao da para aprovar', 'impede', 'obrigatori', 'critic', 'grave', 'urgente'], concept: 'Severidade de comentários', why: 'O autor precisa saber que esse ponto impede o merge — não é uma opinião entre tantas.' },
          { label: 'Tom **construtivo**: fala do código, oferece ajuda ou referência, reconhece algo bom', keywords: ['ajud', 'parear', 'pareamento', 'pair', 'link', 'owasp', 'document', 'podemos', 'vamos', 'sugiro', 'sugestao', 'que tal', 'gostei', 'legal', 'bom trabalho', 'mandou bem', 'obrigad', 'aprend', 'dica', 'elogi'], concept: 'Comentário construtivo', why: 'Review é também mentoria: oferecer ajuda e reconhecer acertos faz o júnior aprender em vez de ficar na defensiva.' },
        ],
        modelAnswer: `**issue (blocking):** Rafa, o \`codigo\` é digitado pelo cliente e entra direto na SQL pela f-string. Isso abre uma **SQL injection**: com \`' OR '1'='1\`, qualquer pessoa aplica o primeiro cupom do banco, e no \`UPDATE\` o mesmo ataque decrementa todos os cupons. Por isso é **bloqueante** — não dá para aprovar o merge assim.

A correção é simples: usar uma **query parametrizada**, passando o valor separado do comando — \`db.execute("SELECT desconto, validade, usos FROM cupons WHERE codigo = ?", (codigo,))\` —, e o mesmo no \`UPDATE\`. Assim o banco nunca interpreta o código como SQL.

Tem uma explicação ótima no guia da **OWASP** sobre injeção; se quiser, **podemos parear** nisso depois do almoço. E **gostei** de você receber \`hoje\` por parâmetro: deixa o código fácil de testar!`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Excelente comentário! Agora eu mudo o jogo: o Rafa está de férias e o cupom precisa subir hoje.',
          'Você mesmo(a) vai corrigir o código — e os testes vão conferir cada problema que você apontou.',
        ],
        board: {
          title: 'O que a correção precisa garantir',
          md: `| Problema do review | O que muda |
|---|---|
| SQL injection | \`?\` + tupla de parâmetros em **todas** as queries |
| Limite da validade | o cupom vale **até o último dia, inclusive** |
| \`except: pass\` | se o \`commit\` falhar, o erro **sobe** |
| Uso do cupom | só desconta um uso quando o desconto é aplicado; esgotado não vai a negativo |
| Seta e nomes | guard clauses, \`cupom\`, \`subtotal\`, desempacotar a tupla em vez de \`c[0]\` |

\`\`\`python
# desempacotar dá nome ao que era índice mágico
desconto_percentual, validade = cupom           # em vez de c[0], c[1]
\`\`\`

> [!dica] Um truque para o uso do cupom: em vez de "ler \`usos\`, checar e depois escrever", deixe o **banco** fazer as duas coisas de uma vez — \`UPDATE ... SET usos = usos - 1 WHERE codigo = ? AND usos > 0\` — e confira \`cursor.rowcount\` para saber se conseguiu. Já já você vai ver por que isso importa.`,
        },
      },
      {
        type: 'code',
        id: 'cc-cr-q5',
        concept: 'SQL injection',
        title: 'Corrigindo o PR #482',
        points: 60,
        say: 'Corrija o PR! Mantenha a assinatura — o checkout já chama essa função.',
        prompt: `Reescreva \`aplica_cupom(db, codigo, hoje, itens)\` (\`db\` é uma conexão \`sqlite3\`; \`hoje\` é uma string \`AAAA-MM-DD\`) resolvendo **tudo** o que o review apontou:

1. **Queries parametrizadas** (\`?\`) — nada de f-string, \`%\` ou \`+\` montando SQL.
2. O cupom vale **até o dia da validade, inclusive**.
3. Só aplica o desconto se o cupom existir, estiver na validade e tiver **usos > 0**; nesse caso, desconta **um** uso e faz \`db.commit()\`. Nos outros casos, devolve o subtotal sem mexer no banco.
4. Se o \`commit\` falhar, a exceção deve **subir** (nada de \`except: pass\`).
5. Devolve o total com 2 casas: \`subtotal - subtotal * desconto / 100\` quando há desconto.
6. Sem código em seta, sem default mutável e com nomes que dizem o que as coisas são.`,
        starter: PR_CUPOM,
        tests: [
          { name: 'PROMO10 na validade: 10% de desconto e um uso a menos', code: BANCO + py(`
            db = _banco()
            total = aplica_cupom(db, "PROMO10", "2024-06-10", _ITENS)
            assert abs(total - 117.0) < 1e-9, total
            assert _usos(db, "PROMO10") == 4, _usos(db, "PROMO10")
          `) },
          { name: 'código inexistente: sem desconto', code: BANCO + py(`
            db = _banco()
            assert abs(aplica_cupom(db, "NAOEXISTE", "2024-06-10", _ITENS) - 130.0) < 1e-9
          `) },
          { name: 'vencido ou esgotado: sem desconto e sem gastar uso', code: BANCO + py(`
            db = _banco()
            assert abs(aplica_cupom(db, "VENCIDO", "2024-06-10", _ITENS) - 130.0) < 1e-9
            assert _usos(db, "VENCIDO") == 3
            assert abs(aplica_cupom(db, "ESGOTADO", "2024-06-10", _ITENS) - 130.0) < 1e-9
            assert _usos(db, "ESGOTADO") == 0
          `) },
          { name: 'o cupom vale no último dia da validade', code: BANCO + py(`
            db = _banco()
            total = aplica_cupom(db, "PROMO10", "2024-06-30", _ITENS)
            assert abs(total - 117.0) < 1e-9, f"no dia 30/06 o PROMO10 ainda vale: esperado 117.0, obtido {total}"
            assert abs(aplica_cupom(db, "PROMO10", "2024-07-01", _ITENS) - 130.0) < 1e-9, "no dia seguinte não vale mais"
          `) },
          {
            name: 'SQL injection não aplica desconto nem mexe no banco',
            hidden: true,
            code: BANCO + py(`
              for ataque in ("' OR '1'='1", "PROMO10' --", "x' OR codigo LIKE '%"):
                  db = _banco()
                  total = aplica_cupom(db, ataque, "2024-06-10", _ITENS)
                  assert abs(total - 130.0) < 1e-9, f"o código {ataque!r} ganhou desconto: a query ainda é montada com o texto do cliente"
                  usos = [linha[0] for linha in db.execute("SELECT usos FROM cupons ORDER BY codigo")]
                  assert usos == [0, 5, 3], f"o código {ataque!r} alterou os cupons: {usos}"
            `),
          },
          {
            name: 'o último uso: a segunda compra não ganha desconto',
            hidden: true,
            code: BANCO + py(`
              db = _banco(("ULTIMO", 25, "2024-12-31", 1))
              assert abs(aplica_cupom(db, "ULTIMO", "2024-06-10", _ITENS) - 97.5) < 1e-9
              assert abs(aplica_cupom(db, "ULTIMO", "2024-06-10", _ITENS) - 130.0) < 1e-9
              assert _usos(db, "ULTIMO") == 0, "os usos não podem ficar negativos"
              assert aplica_cupom(_banco(), "PROMO10", "2024-06-10", []) == 0
            `),
          },
          {
            name: 'falha no commit não é engolida',
            hidden: true,
            code: BANCO + py(`
              class _BancoQueFalha:
                  def __init__(self, db):
                      self._db = db

                  def __getattr__(self, nome):
                      return getattr(self._db, nome)

                  def commit(self):
                      raise sqlite3.OperationalError("disco cheio")

              try:
                  aplica_cupom(_BancoQueFalha(_banco()), "PROMO10", "2024-06-10", _ITENS)
              except Exception:
                  pass
              else:
                  raise AssertionError("o commit falhou e a função devolveu o total como se nada tivesse acontecido")
            `),
          },
        ],
        reviews: [
          {
            when: (m, code) => /execute\(\s*(f["']|["'][^"'\n]*["']\s*(\+|%|\.format))/.test(code),
            text: 'Ainda há SQL montado com texto (f-string, `%`, `+` ou `.format`). Mesmo que os testes passem, esse é o caminho da **injeção**: passe os valores como parâmetros — `db.execute("... WHERE codigo = ?", (codigo,))`.',
            concept: 'Query parametrizada',
          },
          {
            when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
            text: '`except:`/`except Exception` engolindo erros: se o banco falha, a função mente que deu tudo certo. Deixe a exceção subir — ou capture só a exceção **específica** que você sabe tratar.',
            concept: 'Erro silenciado',
          },
          {
            when: m => m.mutableDefaults > 0,
            text: '`itens=[]` é um **default mutável**: a mesma lista é compartilhada entre as chamadas. Aqui os itens são obrigatórios — tire o valor padrão.',
            concept: 'Default mutável',
          },
          {
            when: m => m.maxNesting >= 3,
            text: 'Ainda há **3 ou mais níveis** de aninhamento. Use *guard clauses*: cupom inexistente → devolve o subtotal; vencido → subtotal; sem uso disponível → subtotal. O caminho do desconto fica reto no fim.',
            concept: 'Guard clauses',
          },
          {
            when: m => ['c', 't', 'i'].some(nome => m.names.includes(nome)),
            text: 'Nomes de uma letra (`c`, `t`, `i`) obrigam o leitor a decifrar o código. `cupom`, `subtotal`, `item` — e desempacotar a tupla (`desconto_percentual, validade = cupom`) em vez de usar `c[0]`.',
            concept: 'Nomes expressivos',
          },
          {
            when: (m, code) => /UPDATE\s+cupons/i.test(code) && !/usos\s*>\s*0/i.test(code.slice(code.search(/UPDATE\s+cupons/i))),
            text: 'O `UPDATE` não verifica `usos > 0`. Se a checagem acontece antes, num `SELECT`, duas compras simultâneas podem ler o mesmo último uso (*check-then-act*). Faça `UPDATE ... WHERE codigo = ? AND usos > 0` e confira o `rowcount`.',
            concept: 'Check-then-act',
          },
        ],
        hints: [
          'Comece pelo subtotal (`sum(item["preco"] * item["qtd"] for item in itens)`) e pela busca parametrizada: `cupom = db.execute("SELECT desconto, validade FROM cupons WHERE codigo = ?", (codigo,)).fetchone()`.',
          'Guard clauses: `if cupom is None: return round(subtotal, 2)`; depois `desconto_percentual, validade = cupom` e `if hoje > validade: return round(subtotal, 2)` — repare no `>`: o último dia ainda vale.',
          'Para o uso: `atualizados = db.execute("UPDATE cupons SET usos = usos - 1 WHERE codigo = ? AND usos > 0", (codigo,)).rowcount`. Se for 0, o cupom está esgotado: devolva o subtotal. Senão, `db.commit()` (sem `try`) e devolva `round(subtotal - subtotal * desconto_percentual / 100, 2)`.',
        ],
        solution: py(`
          def calcular_subtotal(itens):
              return sum(item["preco"] * item["qtd"] for item in itens)


          def aplica_cupom(db, codigo, hoje, itens):
              subtotal = calcular_subtotal(itens)
              cupom = db.execute(
                  "SELECT desconto, validade FROM cupons WHERE codigo = ?", (codigo,)
              ).fetchone()
              if cupom is None:
                  return round(subtotal, 2)

              desconto_percentual, validade = cupom
              if hoje > validade:                    # vale até o último dia, inclusive
                  return round(subtotal, 2)

              # checar e gastar o uso numa única operação atômica (sem check-then-act)
              usos_gastos = db.execute(
                  "UPDATE cupons SET usos = usos - 1 WHERE codigo = ? AND usos > 0", (codigo,)
              ).rowcount
              if usos_gastos == 0:                   # esgotado
                  return round(subtotal, 2)

              db.commit()                            # se falhar, a exceção sobe
              return round(subtotal - subtotal * desconto_percentual / 100, 2)
        `),
        solutionExplanation: 'Cada comentário do review virou uma mudança verificável. As queries usam **parâmetros** (`?`), então `\' OR \'1\'=\'1` é só um código de cupom que não existe. A validade usa `hoje > validade` para recusar — o último dia vale. Não há `try/except`: se o `commit` falhar, quem chamou fica sabendo. As *guard clauses* tiram a seta (cupom inexistente, vencido, esgotado → subtotal), e desempacotar a tupla dá nome ao que era `c[0]` e `c[1]`. O detalhe mais sênior é o `UPDATE ... WHERE usos > 0` com `rowcount`: checar e gastar o uso viram **uma única operação atômica** no banco, então duas compras simultâneas não conseguem usar o mesmo último cupom. A assinatura continua a mesma (menos o default mutável), e o checkout não precisa mudar.',
      },
      {
        type: 'mcq',
        id: 'cc-cr-q6',
        concept: 'Check-then-act',
        say: 'Follow-up clássico de entrevista: e sob carga?',
        prompt: `Black Friday. O cupom \`FRETE0\` tem **1** uso restante e dois clientes finalizam a compra no mesmo instante, em **dois servidores** diferentes. Considere uma versão (parametrizada e sem os outros bugs) que faz:

\`\`\`python
usos = db.execute("SELECT usos FROM cupons WHERE codigo = ?", (codigo,)).fetchone()[0]
if usos > 0:
    db.execute("UPDATE cupons SET usos = usos - 1 WHERE codigo = ?", (codigo,))
\`\`\`

O que pode acontecer, e como resolver?`,
        options: [
          { text: 'Os dois leem `usos = 1`, os dois aplicam o desconto e o contador vai a -1: uma corrida *check-then-act* (TOCTOU). Resolva com uma operação atômica — `UPDATE ... WHERE codigo = ? AND usos > 0` conferindo o `rowcount` — ou com um lock/transação adequada.', correct: true, why: 'A checagem e a ação precisam ser **uma coisa só**. O `UPDATE` condicional deixa o banco decidir, de forma atômica, quem leva o último uso.' },
          { text: 'Nada: o banco executa um comando de cada vez, então é impossível os dois lerem 1.', why: 'Cada comando é atômico, mas a **sequência** SELECT → if → UPDATE não é. Entre a leitura de um e a escrita dele, o outro servidor também lê 1.' },
          { text: 'Colocar um `time.sleep(random.random())` antes do `UPDATE` para espalhar as chamadas.', why: 'Só diminui a probabilidade (e deixa o checkout mais lento). Corridas não se resolvem com sorte, e o bug vai aparecer justamente no pico.' },
          { text: 'Guardar o contador de usos num `dict` global do processo, que é mais rápido que o banco.', why: 'Cada servidor tem a sua própria memória: os dois contadores divergem e o problema piora. O estado compartilhado precisa morar num lugar compartilhado e com operações atômicas.' },
        ],
        explanation: '*Check-then-act* (ou **TOCTOU**, *time-of-check to time-of-use*) é um dos bugs de concorrência mais comuns em sistemas web: você verifica uma condição e age com base nela, mas o mundo muda entre as duas coisas. O antídoto é fazer **checagem e ação numa única operação atômica** — o `UPDATE` condicional com `rowcount`, um `INSERT` com restrição `UNIQUE`, um `SELECT ... FOR UPDATE` (em bancos que suportam) ou um lock otimista com versão. Numa entrevista, mencionar esse risco ao revisar código que "lê, confere e escreve" é um sinal forte de senioridade.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Fim da entrevista! Você encontrou os problemas certos, priorizou, escreveu um comentário que ensina e ainda corrigiu o código.',
          { text: 'Meu feedback: um grande review começa pelo que dá **prejuízo** — segurança, correção, dados — e termina com o autor **aprendendo**, não com medo do próximo PR. Leve isso para o seu time!', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
