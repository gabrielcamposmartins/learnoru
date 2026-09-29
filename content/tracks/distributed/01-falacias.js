Game.registerModule('distributed', {
  id: 'falacias',
  title: 'Falácias e falhas parciais',
  kind: 'lesson',
  level: 2,
  order: 1,
  unit: 'fundamentos',
  summary: 'A rede não é confiável e um timeout não diz se a operação aconteceu: as 8 falácias, a falha parcial, os dois generais e como agir diante do "não sei".',
  concepts: ['8 falácias', 'Falha parcial', 'Dois generais', 'Timeout ambíguo', 'Gray failure'],
  takeaways: [
    'As **8 falácias** são premissas que valem numa máquina só e falham na rede: confiável, latência zero, banda infinita, segura, topologia fixa, um administrador, transporte grátis e rede homogênea.',
    'Sistema distribuído é sinônimo de **falha parcial**: uma parte funciona, outra não. Uma chamada remota tem **três** resultados — sucesso, falha e **"não sei"**.',
    'O **problema dos dois generais** prova que nenhuma sequência de confirmações garante acordo num canal que perde mensagens: a incerteza se **administra**, não se elimina.',
    'Timeout **não** diz se a operação aconteceu. Use uma **chave de idempotência** ligada à operação, **reconsulte o status** antes de repetir e, se as tentativas acabarem, trate o resultado como **incerto**, não como "falhou".',
    'Modelos de falha: **fail-stop** (para e se cala), **bizantino** (faz qualquer coisa; exige 3f + 1 nós) e **gray failure** (o monitor diz "ok", o usuário diz "quebrado").',
  ],
  glossary: [
    { term: 'Falácias da computação distribuída', aliases: ['8 falácias', 'oito falácias', 'fallacies of distributed computing'], definition: 'Oito premissas falsas que se costuma fazer ao sair de uma máquina só, reunidas na Sun nos anos 90 (Peter Deutsch, James Gosling e outros): a rede é confiável, a latência é zero, a banda é infinita, a rede é segura, a topologia não muda, há um só administrador, o transporte é grátis e a rede é homogênea.' },
    { term: 'Falha parcial', aliases: ['falhas parciais', 'partial failure'], definition: 'Quando **parte** do sistema falha e o resto continua funcionando — e quem chama muitas vezes não consegue distinguir "caiu", "está lento" e "a resposta se perdeu". É o que separa um sistema distribuído de um programa numa máquina só.' },
    { term: 'Problema dos dois generais', aliases: ['dois generais', 'two generals', 'two generals problem'], definition: 'Experimento mental: dois exércitos só vencem se atacarem juntos, e os mensageiros entre eles podem ser capturados. Prova que **nenhum** protocolo finito garante acordo sobre um canal que pode perder mensagens.' },
    { term: 'Fail-stop', aliases: ['crash-stop', 'fail stop'], definition: 'Modelo de falha mais simples: o nó **para** e fica em silêncio, sem mandar mensagens erradas. Na variante *crash-recovery*, ele pode voltar depois, com o que estava gravado em disco.' },
    { term: 'Falha bizantina', aliases: ['falhas bizantinas', 'bizantino', 'bizantina', 'byzantine', 'generais bizantinos'], definition: 'Modelo em que um nó pode se comportar de forma **arbitrária**: mentir, mandar respostas diferentes para nós diferentes, corromper dados. Tolerar *f* nós bizantinos exige **3f + 1** nós; é o terreno de blockchains e da aviônica.' },
    { term: 'Gray failure', aliases: ['gray failures', 'grey failure', 'falha cinzenta'], definition: 'Falha **parcial e sutil**: o componente parece saudável para o monitor (o health check passa), mas está degradado para quem o usa — lento, perdendo parte das requisições. O detector diz "ok", o usuário diz "quebrado".' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Bem-vinda(o) aos **sistemas distribuídos**! A definição mais honesta é do Leslie Lamport: é um sistema em que a falha de um computador que você nem sabia que existia deixa o seu inutilizável.',
        'A diferença para um programa comum é uma só, e ela muda tudo: numa chamada remota, além de "deu certo" e "deu erro", existe a resposta **"não sei"**.',
      ],
      board: {
        title: 'Chamada local × chamada remota',
        md: `| | Chamada **local** | Chamada **remota** |
|---|---|---|
| Resultados possíveis | sucesso ou exceção | sucesso, erro **ou silêncio** |
| Latência | nanossegundos, previsível | milissegundos a segundos, **variável** |
| Falhas | o processo inteiro cai junto | **uma parte** cai e o resto segue |
| Argumentos | passados por referência | serializados, copiados, podem chegar truncados |
| Ordem | a do código | mensagens podem chegar **fora de ordem** ou **duplicadas** |

\`\`\`python
saldo = conta.sacar(100)                 # local: ou sacou, ou lançou exceção

resp = cliente.post("/saques", json={"valor": 100})
# remota: 200 → sacou | 422 → não sacou | timeout → ??? (talvez tenha sacado)
\`\`\`

> [!atencao] Frameworks de RPC que fazem a chamada remota **parecer** local (o sonho do CORBA e do Java RMI) escondem justamente a parte perigosa. O artigo clássico *A Note on Distributed Computing* (Waldo et al., Sun, 1994) já avisava: latência, falha parcial e concorrência não dá para esconder atrás de uma interface.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Nos anos 90, engenheiros da Sun anotaram as premissas falsas que todo mundo faz ao sair de uma máquina só. Viraram as **8 falácias da computação distribuída**.',
        'Escritas no papel, todas parecem óbvias. Mesmo assim, cada uma já derrubou sistemas enormes.',
      ],
      board: {
        title: 'As 8 falácias da computação distribuída',
        md: `| # | Falácia | Como ela te morde |
|---|---|---|
| 1 | A rede é **confiável** | pacotes se perdem, conexões caem no meio da resposta |
| 2 | A **latência** é zero | 300 chamadas em sequência = uma página de 15 s |
| 3 | A **largura de banda** é infinita | payloads gigantes saturam o link e o vizinho sofre |
| 4 | A rede é **segura** | tráfego interno sem TLS "porque está dentro da VPC" |
| 5 | A **topologia** não muda | IP fixo na configuração; o failover troca a máquina |
| 6 | Existe **um** administrador | outro time muda o firewall e você descobre em produção |
| 7 | O **custo de transporte** é zero | serializar gasta CPU; tráfego entre regiões custa dinheiro (*egress*) |
| 8 | A rede é **homogênea** | versões, protocolos e *encodings* diferentes convivendo |

> [!sabia] A lista tem história: Bill Joy e Tom Lyon anotaram as quatro primeiras; **Peter Deutsch** chegou a sete em 1994, e **James Gosling** (o criador do Java) acrescentou a oitava por volta de 1997. Trinta anos depois, ela continua descrevendo incidentes toda semana — inclusive em microsserviços, que transformam chamadas de função em chamadas de rede.`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'A consequência mais importante é a **falha parcial**: um pedaço do sistema falha e o resto continua. Numa máquina só, em geral, ou tudo funciona ou tudo cai.',
        'E o pior: você envia uma requisição e a resposta não vem. Olha quantas coisas diferentes podem ter acontecido…',
      ],
      board: {
        title: 'Sem resposta: o que aconteceu?',
        md: `\`\`\`text
 cliente ─── requisição ───▶ servidor ─── resposta ───▶ cliente
            (1) se perde     (3) cai antes de processar  (5) se perde
            (2) fica presa   (4) processa e cai
                             (6) está lento (pausa de GC)
\`\`\`

| Caso | A operação aconteceu? |
|---|---|
| (1) requisição perdida | **não** |
| (2) requisição presa num roteador ou numa fila | **ainda não** — mas pode acontecer depois! |
| (3) servidor caiu antes de processar | **não** |
| (4) processou e caiu antes de responder | **sim** |
| (5) resposta perdida | **sim** |
| (6) servidor lento (GC, disco, CPU) | **vai** acontecer, mais tarde |

Do lado do cliente, os seis casos são **idênticos**: silêncio até o timeout. Só esperando, não há como distinguir "caiu" de "está lento".

> [!dica] Por isso detectores de falha em sistemas distribuídos só conseguem **suspeitar** ("não responde há 5 s"), nunca **ter certeza**. Todo algoritmo sério é escrito assumindo que a suspeita pode estar errada.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Dá para resolver com confirmações? "Recebi." — "Recebi o seu recebi." — "Recebi o recebi do recebi"… Esse é o **problema dos dois generais**, e a resposta é um sonoro **não**.',
        'É um dos resultados de impossibilidade mais antigos da computação, e explica por que nenhuma confirmação encerra a dúvida.',
      ],
      board: {
        title: 'O problema dos dois generais',
        md: `\`\`\`text
   General A            vale (território inimigo)             General B
 (colina oeste) ─── mensageiro ─── ✗ pode ser capturado ───▶ (colina leste)

 A → B: "atacamos às 6h"     B recebe… mas A não sabe se chegou
 B → A: "ok, às 6h"          A recebe… mas B não sabe se chegou
 A → B: "recebi seu ok"      B recebe… mas A não sabe se chegou
 …                           a ÚLTIMA mensagem sempre fica sem confirmação
\`\`\`

Os dois só vencem se atacarem **juntos**, e qualquer mensageiro pode ser capturado. Existe um protocolo que garanta que os dois **decidam a mesma coisa**?

**Não.** Pegue o protocolo com o menor número de mensagens que supostamente funciona e olhe a **última**: quem a enviou não sabe se ela chegou e age igual nos dois casos. Então ela era dispensável — e existiria um protocolo ainda menor. Contradição.

**Na prática:** TCP, ACKs e *two-phase commit* não "resolvem" os dois generais — eles **convivem** com a incerteza, usando timeouts, retries, operações idempotentes e reconciliação.

> [!sabia] O problema foi formulado em 1975 (Akkoyunlu, Ekanadham e Huber) e ganhou o nome de **dois generais** com Jim Gray, em 1978. É considerado o primeiro problema de comunicação entre computadores **provado insolúvel**. Não confunda com os **generais bizantinos** (Lamport, Shostak e Pease, 1982): lá as mensagens chegam, e o problema são generais **traidores**.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Então resta o timeout. Mas atenção: ele é uma decisão **sua**, não uma informação sobre o servidor. Ele diz "cansei de esperar", não "não aconteceu".',
        'Se a operação tem efeito colateral — cobrar, mandar e-mail, baixar estoque —, repetir às cegas pode duplicar o efeito. A saída tem duas peças: **idempotência** e **reconsulta de status**.',
      ],
      board: {
        title: 'Depois do timeout: repetir?',
        md: `| Operação | Repetir depois do timeout? |
|---|---|
| Leitura (\`GET /saldo\`) | sim — não tem efeito colateral |
| Escrita naturalmente idempotente (\`PUT preco = 10\`) | sim — aplicar duas vezes dá no mesmo |
| Escrita **não** idempotente (\`POST /cobrancas\`) | **não às cegas**: chave de idempotência e, na dúvida, pergunte o status |

\`\`\`python
chave = f"pedido-{pedido.id}"             # identifica a OPERAÇÃO, não a tentativa
try:
    return pagamentos.cobrar(chave, valor)
except Timeout:
    recibo = pagamentos.status(chave)     # "isso aconteceu?"
    if recibo is not None:
        return recibo                     # aconteceu: não cobre de novo
    return pagamentos.cobrar(chave, valor)   # não achou: reenvie com a MESMA chave
\`\`\`

- A **chave de idempotência** faz o servidor reconhecer a repetição e devolver o mesmo resultado.
- A **reconsulta** evita reenviar o que já aconteceu — e é a única saída quando a API não aceita chaves.
- Uma requisição **atrasada** (o caso 2) pode chegar **depois** de o status dizer "não achei". Só a chave de idempotência protege desse cenário.

> [!atencao] Se as tentativas acabarem, o resultado é **incerto**, não "falhou". Dizer "pagamento recusado" para quem foi cobrado é pior do que "estamos confirmando seu pagamento". (Backoff com jitter e orçamento de retries estão na trilha de APIs.)`,
      },
    },
    {
      type: 'say',
      mood: 'surprised',
      text: [
        'Última peça da teoria: **como** um nó pode falhar. Todo algoritmo distribuído escolhe um **modelo de falha** — e o preço de tolerar cada um é bem diferente.',
        'E existe um tipo traiçoeiro que só ganhou nome em 2017: a **gray failure**, quando o monitor jura que está tudo bem e o usuário jura que está tudo quebrado.',
      ],
      board: {
        title: 'Modelos de falha',
        md: `| Modelo | O nó com defeito… | Custo de tolerar *f* falhas |
|---|---|---|
| **Fail-stop / crash-stop** | para e fica calado para sempre | consenso com **2f + 1** nós (maioria) |
| **Crash-recovery** | para e pode voltar, com o que estava no disco | 2f + 1, com estado gravado de forma durável |
| **Bizantino** | faz **qualquer coisa**: mente, se contradiz, corrompe dados | **3f + 1** nós e protocolos BFT |
| **Gray failure** | continua "vivo", mas degradado: lento, falhando em parte | detectar pelo lado de quem chama e tirar do balanceamento |

Quase todo sistema de datacenter assume **crash-recovery** e confia que os nós não mentem. Tolerância bizantina aparece em blockchains, aviônica e onde há participantes que não confiam uns nos outros.

> [!sabia] **Gray failure** foi batizada num artigo da Microsoft Research (Huang et al., 2017). A marca registrada é a **observabilidade diferencial**: o detector de falhas vê uma coisa e os clientes veem outra. Exemplos: o health check responde 200 enquanto o pool de conexões está esgotado; um switch descarta 1% dos pacotes; um disco fica 10× mais lento. Antídotos: health checks que exercitam o caminho real, medir **do lado de quem chama** (erros e latência por instância) e *outlier detection* para tirar do balanceamento o nó "meio vivo".`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Seis questões — incluindo um cliente de pagamentos que sobrevive a respostas perdidas.', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dist-fal-q1',
      concept: 'Timeout ambíguo',
      say: 'Começando por um clássico de entrevista.',
      prompt: 'Seu serviço chamou `POST /cobrancas` (R$ 100) e, depois de 2 s, estourou o **timeout**. O que você pode afirmar sobre a cobrança?',
      options: [
        { text: 'Nada: ela pode ter acontecido ou não — a requisição ou a resposta podem ter se perdido, ou o servidor está só lento.', correct: true, why: 'Exato. O timeout é uma decisão **sua** de parar de esperar; ele não traz nenhuma informação sobre o que aconteceu do outro lado.' },
        { text: 'Não aconteceu: se tivesse dado certo, a resposta teria chegado. Pode repetir tranquilo.', why: 'A resposta pode ter se perdido **depois** da cobrança, ou o servidor pode ter processado e caído antes de responder. Repetir às cegas pode cobrar duas vezes.' },
        { text: 'Aconteceu: o servidor recebeu a requisição; é só esperar o processamento terminar.', why: 'Nada garante que a requisição chegou: ela pode ter se perdido no caminho, ou o servidor pode ter caído antes de processar.' },
        { text: 'O servidor está fora do ar: marque-o como morto e pare de mandar tráfego para ele.', why: 'Um timeout isolado não distingue "caiu" de "lento" ou de "pacote perdido". Detectores de falha só **suspeitam** — e marcar nós como mortos cedo demais causa instabilidade.' },
      ],
      explanation: 'Numa chamada remota existem três resultados: **sucesso**, **falha** e **"não sei"** — e o timeout cai no terceiro. A resposta de engenharia é tornar a operação segura para repetir (**idempotência**, com uma chave que identifica a operação) e, na dúvida, **consultar o status** antes de agir de novo.',
    },
    {
      type: 'match',
      id: 'dist-fal-q2',
      concept: '8 falácias',
      say: 'Seis falácias, seis bugs de verdade. Qual premissa falsa causou cada um?',
      prompt: 'Associe cada **falácia** ao **bug** que ela costuma causar.',
      pairs: [
        { left: 'A rede é confiável', right: 'Enviar o pedido uma vez, sem timeout nem retry, e assumir que chegou' },
        { left: 'A latência é zero', right: 'Montar uma página com 300 chamadas remotas em sequência, uma por item' },
        { left: 'A largura de banda é infinita', right: 'Cada resposta traz o catálogo inteiro, 80 MB, "por via das dúvidas"' },
        { left: 'A topologia não muda', right: 'IP do banco fixo na configuração: o failover troca a máquina e o app para' },
        { left: 'Existe um administrador', right: 'Outro time muda uma regra de firewall e sua integração cai sem aviso' },
        { left: 'A rede é homogênea', right: 'Um cliente legado fala outra versão do protocolo e interpreta mal as mensagens' },
      ],
      explanation: 'As falácias não são "erro de iniciante": são premissas **implícitas** que o código assume quando trata uma chamada remota como local. Antídotos típicos: timeouts e retries idempotentes (confiável), *batching* e chamadas em paralelo (latência), paginação e compressão (banda), service discovery em vez de IP fixo (topologia), contratos e observabilidade entre times (administrador), versionamento e *tolerant reader* (homogênea). As duas que ficaram de fora — **segura** e **transporte grátis** — pedem TLS/mTLS entre serviços e atenção ao custo de serializar e trafegar dados entre regiões.',
    },
    {
      type: 'order',
      id: 'dist-fal-q3',
      concept: 'Problema dos dois generais',
      say: 'Agora a prova de que os dois generais não têm salvação. Monte o raciocínio na ordem!',
      prompt: 'Ordene os passos do argumento que prova que **nenhum protocolo** garante o acordo dos dois generais quando o canal pode perder mensagens.',
      items: [
        'Suponha que existe um protocolo que garante o acordo e pegue o que usa **menos** mensagens',
        'Olhe a **última** mensagem desse protocolo: ela pode ser capturada no caminho',
        'Quem a enviou não fica sabendo se ela chegou, então age **igual** nos dois casos',
        'Como o acordo precisa valer também quando ela se perde, a decisão não pode depender dela: era **dispensável**',
        'Sem ela, sobra um protocolo **menor** que também funciona — contradição com "o menor"',
      ],
      explanation: 'É uma prova por contradição (ou por indução: remova a última mensagem até não sobrar nenhuma — e sem mensagens ninguém coordena nada). Conclusão: num canal que perde mensagens, **nenhuma** quantidade finita de confirmações dá certeza aos dois lados. Por isso sistemas reais não tentam eliminar a dúvida, e sim **administrá-la**: timeouts, retries idempotentes, reconsulta de status e reconciliação.',
    },
    {
      type: 'code',
      id: 'dist-fal-q4',
      concept: 'Idempotência + reconsulta de status',
      title: 'Cliente que sobrevive ao "não sei"',
      say: 'Mão na massa: um cliente de pagamentos que sobrevive a pedidos perdidos, respostas perdidas e pedidos atrasados. Tudo simulado — nada de rede de verdade.',
      prompt: `O \`ServicoPagamentos\` já é **idempotente**: a mesma chave nunca cobra duas vezes. Entre você e ele há uma \`RedeSimulada\` que segue um **roteiro de falhas**: pode perder o pedido, perder a resposta ou atrasar o pedido. Em todos esses casos, você recebe \`Timeout\`.

Implemente \`pagar(rede, pedido_id, valor, max_tentativas=4)\`:

- Use a chave de idempotência \`f"pedido-{pedido_id}"\` em **todas** as chamadas: ela identifica a *operação*, não a tentativa.
- Chame \`rede.cobrar(chave, valor)\`; se vier o recibo (ex.: \`"R1"\`), devolva-o.
- \`PagamentoRecusado\` é uma resposta **definitiva**: deixe a exceção subir, sem repetir.
- Depois de um \`Timeout\`, **não reenvie às cegas**: pergunte \`rede.status(chave)\`.
  - veio um recibo → devolva-o (a cobrança aconteceu; não cobre de novo);
  - veio \`None\` → a cobrança não existe: reenvie \`cobrar\` com a **mesma** chave;
  - o próprio status deu \`Timeout\` → pergunte o status de novo.
- Cada chamada à rede (\`cobrar\` ou \`status\`) gasta **uma** tentativa. Se o orçamento acabar sem uma resposta definitiva, lance \`ResultadoIncerto(chave)\` — o resultado é **incerto**, não "falhou".`,
      starter: `class Timeout(Exception):
    """Nenhuma resposta a tempo: a operação PODE ou NÃO ter acontecido."""


class PagamentoRecusado(Exception):
    """Resposta definitiva do serviço: não adianta repetir."""


class ResultadoIncerto(Exception):
    """Desistimos sem saber se a cobrança aconteceu."""


class ServicoPagamentos:
    """O servidor. Idempotente: a mesma chave nunca cobra duas vezes."""

    def __init__(self, limite=1000):
        self.limite = limite
        self.cobrancas = {}                    # chave -> (recibo, valor)

    def cobrar(self, chave, valor):
        if chave in self.cobrancas:            # repetição: devolve o mesmo recibo
            return self.cobrancas[chave][0]
        if valor > self.limite:
            raise PagamentoRecusado(f"{valor} acima do limite")
        recibo = f"R{len(self.cobrancas) + 1}"
        self.cobrancas[chave] = (recibo, valor)
        return recibo

    def status(self, chave):
        registro = self.cobrancas.get(chave)
        return registro[0] if registro else None


class RedeSimulada:
    """Leva cada chamada ao serviço seguindo um roteiro (um item por chamada):
      "ok"              entrega o pedido e devolve a resposta
      "perde_pedido"    o pedido some: o serviço NÃO executa          -> Timeout
      "perde_resposta"  o serviço EXECUTA, mas a resposta some        -> Timeout
      "atrasa"          o pedido fica preso e só chega depois da PRÓXIMA chamada -> Timeout
    Quando o roteiro acaba, tudo é "ok". A lista chamadas registra o que você enviou.
    """

    def __init__(self, servico, roteiro=()):
        self.servico = servico
        self.roteiro = list(roteiro)
        self.chamadas = []
        self._presos = []

    def cobrar(self, chave, valor):
        return self._chamar("cobrar", chave, valor)

    def status(self, chave):
        return self._chamar("status", chave)

    def _executar(self, operacao, args):
        return getattr(self.servico, operacao)(*args)

    def _chamar(self, operacao, *args):
        self.chamadas.append((operacao, *args))
        falha = self.roteiro.pop(0) if self.roteiro else "ok"
        presos, self._presos = self._presos, []
        try:
            if falha == "perde_pedido":
                raise Timeout(operacao)
            if falha == "atrasa":
                self._presos.append((operacao, args))
                raise Timeout(operacao)
            if falha == "perde_resposta":
                try:
                    self._executar(operacao, args)
                except PagamentoRecusado:
                    pass
                raise Timeout(operacao)
            return self._executar(operacao, args)
        finally:
            for operacao_presa, args_presos in presos:    # o pedido preso finalmente chega
                try:
                    self._executar(operacao_presa, args_presos)
                except PagamentoRecusado:
                    pass                                   # a resposta não vai para ninguém


def pagar(rede, pedido_id, valor, max_tentativas=4):
    # TODO: chave estável; Timeout -> status; None -> reenviar; sem orçamento -> ResultadoIncerto
    pass
`,
      tests: [
        {
          name: 'caminho feliz: uma chamada, um recibo',
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico)
assert pagar(rede, 7, 100) == "R1", "sem falhas, devolva o recibo"
assert rede.chamadas == [("cobrar", "pedido-7", 100)], f"chamadas: {rede.chamadas}"`,
        },
        {
          name: 'resposta perdida: pergunta o status e NÃO cobra de novo',
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["perde_resposta"])
assert pagar(rede, 7, 100) == "R1", "a cobrança aconteceu: devolva o recibo que o status informa"
ops = [c[0] for c in rede.chamadas]
assert ops == ["cobrar", "status"], f"depois do timeout, pergunte o status antes de reenviar; chamadas: {ops}"
assert len(servico.cobrancas) == 1`,
        },
        {
          name: 'pedido perdido: status vazio → reenvia com a mesma chave',
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["perde_pedido"])
assert pagar(rede, 7, 100) == "R1"
esperado = [("cobrar", "pedido-7", 100), ("status", "pedido-7"), ("cobrar", "pedido-7", 100)]
assert rede.chamadas == esperado, f"chamadas: {rede.chamadas}"`,
        },
        {
          name: 'recusa é definitiva: não repete',
          code: `servico = ServicoPagamentos(limite=50)
rede = RedeSimulada(servico)
try:
    pagar(rede, 7, 100)
    assert False, "PagamentoRecusado deveria subir"
except PagamentoRecusado:
    pass
assert len(rede.chamadas) == 1, f"uma recusa é resposta definitiva: não repita ({len(rede.chamadas)} chamadas)"`,
        },
        {
          name: 'pedido atrasado chega depois do status: continua 1 cobrança',
          hidden: true,
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["atrasa"])
recibo = pagar(rede, 7, 100)
assert recibo == "R1", f"recibo inesperado: {recibo!r}"
assert len(servico.cobrancas) == 1, "o pedido atrasado e o reenvio viraram duas cobranças: a chave precisa ser a mesma"`,
        },
        {
          name: 'rede fora do ar: ResultadoIncerto (e não Timeout)',
          hidden: true,
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["perde_pedido"] * 10)
try:
    pagar(rede, 7, 100)
    assert False, "sem nenhuma resposta, lance ResultadoIncerto"
except ResultadoIncerto:
    pass
assert len(rede.chamadas) == 4, f"o orçamento padrão é de 4 chamadas; foram {len(rede.chamadas)}"`,
        },
        {
          name: 'orçamento de 1 tentativa: incerto, mesmo tendo cobrado',
          hidden: true,
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["perde_resposta"])
try:
    pagar(rede, 7, 100, max_tentativas=1)
    assert False, "sem resposta e sem orçamento, o resultado é incerto"
except ResultadoIncerto:
    pass
assert len(rede.chamadas) == 1, f"max_tentativas=1 permite uma única chamada; foram {len(rede.chamadas)}"
assert len(servico.cobrancas) == 1, "e a cobrança de fato aconteceu — por isso não dá para dizer 'falhou'"`,
        },
        {
          name: 'o status também pode se perder',
          hidden: true,
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico, ["perde_pedido", "perde_pedido"])
assert pagar(rede, 7, 100) == "R1"
ops = [c[0] for c in rede.chamadas]
assert ops == ["cobrar", "status", "status", "cobrar"], f"status perdido → pergunte de novo; chamadas: {ops}"`,
        },
        {
          name: 'clique duplo: pagar o mesmo pedido duas vezes cobra uma vez',
          hidden: true,
          code: `servico = ServicoPagamentos()
rede = RedeSimulada(servico)
assert pagar(rede, 7, 100) == "R1"
assert pagar(rede, 7, 100) == "R1", "a chave identifica o pedido: a segunda chamada devolve o mesmo recibo"
assert pagar(rede, 8, 30) == "R2"
assert len(servico.cobrancas) == 2`,
        },
        {
          name: 'recusa depois de um pedido perdido também sobe',
          hidden: true,
          code: `servico = ServicoPagamentos(limite=50)
rede = RedeSimulada(servico, ["perde_pedido"])
try:
    pagar(rede, 7, 100)
    assert False, "PagamentoRecusado deveria subir"
except PagamentoRecusado:
    pass
assert [c[0] for c in rede.chamadas] == ["cobrar", "status", "cobrar"]`,
        },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Você captura exceções genéricas (`except:` ou `except Exception`). Isso engole `PagamentoRecusado` — uma resposta **definitiva** — e a trata como "não sei". Capture só `Timeout`: falha transitória e decisão do servidor pedem tratamentos diferentes.',
          concept: 'Falha definitiva × incerta',
        },
        {
          when: m => m.imports.includes('uuid') || m.imports.includes('random'),
          text: 'Gerar a chave com `uuid`/`random` quebra a idempotência sempre que ela muda entre tentativas — ou entre dois cliques no mesmo pedido. A chave deve vir da **operação de negócio** (o pedido), para que toda repetição seja reconhecida pelo servidor.',
          concept: 'Chave de idempotência',
        },
        {
          when: m => m.imports.includes('time'),
          text: 'Você importou `time`. Esperar entre tentativas (backoff com jitter) é boa ideia em produção, mas **injete** a função de espera: `time.sleep` de verdade deixa os testes lentos e não determinísticos.',
          concept: 'Injeção de dependências',
        },
      ],
      hints: [
        'A chave é sempre `f"pedido-{pedido_id}"`. Guarde numa variável o que fazer a seguir: `proxima = "cobrar"` ou `proxima = "status"`.',
        'Use `for _ in range(max_tentativas):` com a chamada dentro de um `try`. No `except Timeout:`, a próxima ação passa a ser `"status"`. Não capture `PagamentoRecusado`: ele deve subir sozinho.',
        'Se o status devolver um recibo, `return` nele; se devolver `None`, a próxima ação volta a ser `"cobrar"` (com a mesma chave). Depois do laço: `raise ResultadoIncerto(chave)`.',
      ],
      solution: `class Timeout(Exception):
    """Nenhuma resposta a tempo: a operação PODE ou NÃO ter acontecido."""


class PagamentoRecusado(Exception):
    """Resposta definitiva do serviço: não adianta repetir."""


class ResultadoIncerto(Exception):
    """Desistimos sem saber se a cobrança aconteceu."""


class ServicoPagamentos:
    """O servidor. Idempotente: a mesma chave nunca cobra duas vezes."""

    def __init__(self, limite=1000):
        self.limite = limite
        self.cobrancas = {}                    # chave -> (recibo, valor)

    def cobrar(self, chave, valor):
        if chave in self.cobrancas:            # repetição: devolve o mesmo recibo
            return self.cobrancas[chave][0]
        if valor > self.limite:
            raise PagamentoRecusado(f"{valor} acima do limite")
        recibo = f"R{len(self.cobrancas) + 1}"
        self.cobrancas[chave] = (recibo, valor)
        return recibo

    def status(self, chave):
        registro = self.cobrancas.get(chave)
        return registro[0] if registro else None


class RedeSimulada:
    """Leva cada chamada ao serviço seguindo um roteiro (um item por chamada):
      "ok"              entrega o pedido e devolve a resposta
      "perde_pedido"    o pedido some: o serviço NÃO executa          -> Timeout
      "perde_resposta"  o serviço EXECUTA, mas a resposta some        -> Timeout
      "atrasa"          o pedido fica preso e só chega depois da PRÓXIMA chamada -> Timeout
    Quando o roteiro acaba, tudo é "ok". A lista chamadas registra o que você enviou.
    """

    def __init__(self, servico, roteiro=()):
        self.servico = servico
        self.roteiro = list(roteiro)
        self.chamadas = []
        self._presos = []

    def cobrar(self, chave, valor):
        return self._chamar("cobrar", chave, valor)

    def status(self, chave):
        return self._chamar("status", chave)

    def _executar(self, operacao, args):
        return getattr(self.servico, operacao)(*args)

    def _chamar(self, operacao, *args):
        self.chamadas.append((operacao, *args))
        falha = self.roteiro.pop(0) if self.roteiro else "ok"
        presos, self._presos = self._presos, []
        try:
            if falha == "perde_pedido":
                raise Timeout(operacao)
            if falha == "atrasa":
                self._presos.append((operacao, args))
                raise Timeout(operacao)
            if falha == "perde_resposta":
                try:
                    self._executar(operacao, args)
                except PagamentoRecusado:
                    pass
                raise Timeout(operacao)
            return self._executar(operacao, args)
        finally:
            for operacao_presa, args_presos in presos:    # o pedido preso finalmente chega
                try:
                    self._executar(operacao_presa, args_presos)
                except PagamentoRecusado:
                    pass                                   # a resposta não vai para ninguém


def pagar(rede, pedido_id, valor, max_tentativas=4):
    chave = f"pedido-{pedido_id}"             # identifica a operação, não a tentativa
    proxima = "cobrar"
    for _ in range(max_tentativas):
        try:
            if proxima == "cobrar":
                return rede.cobrar(chave, valor)     # PagamentoRecusado sobe direto
            recibo = rede.status(chave)
            if recibo is not None:
                return recibo                        # já aconteceu: não cobre de novo
            proxima = "cobrar"                       # não existe: reenviar com a MESMA chave
        except Timeout:
            proxima = "status"                       # "não sei": pergunte antes de repetir
    raise ResultadoIncerto(chave)
`,
      solutionExplanation: 'O cliente distingue três resultados: **recibo** (aconteceu), **`PagamentoRecusado`** (resposta definitiva — repetir não muda nada) e **`Timeout`** ("não sei"). Depois de um timeout ele não reenvia às cegas: pergunta o **status**, porque reenviar o que já aconteceu é desperdício no melhor caso e cobrança dupla no pior. A chave `pedido-{id}` identifica a **operação**, então o reenvio, o pedido atrasado que chega depois do status e até um clique duplo do usuário caem na mesma cobrança. Quando o orçamento acaba, o erro é `ResultadoIncerto` — o teste de uma tentativa mostra que a cobrança pode **ter acontecido**. Em produção, esse estado vira "pagamento em verificação", e um processo de **reconciliação** consulta o status mais tarde.',
    },
    {
      type: 'mcq',
      id: 'dist-fal-q5',
      concept: 'Gray failure',
      say: 'Um incidente de verdade — daqueles que duram horas porque todos os painéis estão verdes.',
      prompt: 'O health check da instância `api-3` responde `200` em 2 ms, mas **8%** das requisições reais que ela recebe dão timeout: o pool de conexões com o banco está esgotado. O balanceador continua mandando tráfego para ela. Como classificar a falha e o que ajuda?',
      options: [
        { text: '**Gray failure**: o monitor e os clientes enxergam coisas diferentes. Ajudam health checks que exercitam o caminho real, métricas de erro e latência por instância e *outlier detection*.', correct: true, why: 'Isso: é a **observabilidade diferencial**. O health check mede "o processo está vivo", não "o serviço funciona" — é preciso olhar pelo lado de quem chama.' },
        { text: '**Falha bizantina**: o nó está mentindo no health check. A solução é replicar em 3f + 1 nós e votar as respostas.', why: 'Não há comportamento arbitrário nem malicioso: a instância está degradada. Protocolos BFT custam caro e não consertam um health check raso.' },
        { text: '**Fail-stop**: o nó caiu. Basta confiar no health check, que vai reiniciá-lo.', why: 'O nó não parou — e o health check é justamente quem não percebe o problema.' },
        { text: '**Partição de rede**: o balanceador e a instância não se falam. É esperar a rede voltar.', why: 'A rede entre eles funciona (o health check passa); o gargalo está dentro da instância, no pool de conexões.' },
      ],
      explanation: 'Gray failure se define pela **observabilidade diferencial**: quem monitora e quem usa veem coisas diferentes. Um health check que só responde "estou vivo" mede o processo, não o serviço. Melhor: checar as dependências críticas com cuidado (sem derrubar a frota inteira quando o banco oscila), medir sucesso e latência **por instância, do lado do cliente**, e ejetar *outliers* automaticamente — como fazem service meshes e balanceadores modernos.',
    },
    {
      type: 'open',
      id: 'dist-fal-q6',
      concept: 'Retries seguros',
      say: 'Para fechar: uma revisão de código. Explique como faria para o time.',
      prompt: 'Um colega colocou `@retry(tentativas=3)` na função que **cobra o cartão** do cliente, "porque a rede às vezes falha". Explique por que isso pode cobrar o cliente duas vezes e como você desenharia essa chamada.',
      minWords: 30,
      rubric: [
        { label: 'Explica que o **timeout é ambíguo**: a cobrança pode ter acontecido', keywords: ['nao sab', 'nao da para saber', 'ambig', 'incert', 'pode ter acontecido', 'pode ter sido', 'talvez', 'resposta se perdeu', 'resposta perdida', 'perdeu a resposta', 'processou', 'ja cobrou', 'ja foi cobrad'], concept: 'Timeout ambíguo', why: 'O timeout é só a decisão de parar de esperar: a resposta pode ter se perdido depois da cobrança.' },
        { label: 'Propõe **idempotência** com uma chave que identifica a operação', keywords: ['idempot', 'chave', 'idempotency', 'dedup', 'mesmo id', 'id da operacao', 'id do pedido', 'request id', 'identificador unico'], concept: 'Chave de idempotência', why: 'Com uma chave ligada à operação, o servidor reconhece a repetição e devolve o mesmo resultado em vez de cobrar de novo.' },
        { label: 'Propõe **consultar o status** antes de repetir (ou reconciliar depois)', keywords: ['status', 'consult', 'verificar', 'verifica', 'reconcili', 'perguntar', 'checar', 'confirmar se'], concept: 'Reconsulta de status', why: 'Perguntar "isso aconteceu?" evita reenviar o que já foi feito — e é a saída quando a API não aceita chaves.' },
        { label: 'Diferencia **erro definitivo** de transitório ou limita as tentativas', keywords: ['definitiv', 'transitori', 'recusad', 'negad', '4xx', '5xx', 'backoff', 'jitter', 'limite de tentativas', 'orcamento', 'maximo de tentativas', 'desist', 'em verificacao'], concept: 'Falha definitiva × incerta', why: 'Cartão recusado não melhora com retry; erros transitórios pedem backoff e limite — e o fim das tentativas é "incerto", não "falhou".' },
      ],
      modelAnswer: `O problema é que um timeout **não diz** se a cobrança aconteceu: a resposta pode ter se perdido depois de o cartão ser cobrado, e o retry cobra de novo. O resultado é **ambíguo**, não uma falha.

Eu desenharia assim: (1) uma **chave de idempotência** que identifica a operação — por exemplo \`pedido-42\` —, enviada em todas as tentativas, para o provedor devolver o mesmo resultado em vez de cobrar duas vezes; (2) depois de um timeout, **consultar o status** da cobrança por essa chave antes de reenviar; (3) repetir só erros **transitórios** (timeout, 503), com **backoff** com jitter e um limite de tentativas — cartão recusado é resposta **definitiva**; (4) se as tentativas acabarem, marcar o pagamento como **em verificação** e deixar um processo de **reconciliação** resolver, em vez de dizer ao cliente que falhou.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Muito bem! Recapitulando: numa chamada remota existe o **"não sei"**, e as 8 falácias são as premissas que escondem isso de nós.',
        'Os dois generais provam que confirmar a confirmação não resolve; a saída é **idempotência + reconsulta de status**. Na próxima aula: por que o **relógio** também mente!',
      ],
      board: null,
    },
  ],
});
