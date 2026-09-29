Game.registerModule('design-patterns', {
  id: 'facade',
  title: 'Facade',
  kind: 'lesson',
  level: 1,
  order: 21,
  unit: 'estruturais',
  summary: 'Uma porta de entrada simples para um subsistema complicado — que concentra a coreografia sem trancar as outras portas.',
  concepts: ['Facade', 'Subsistema', 'Lei de Demeter', 'Facade × Adapter × Mediator', 'Tradução de exceções'],
  takeaways: [
    'A Facade oferece uma **interface simples** para um subsistema complexo: o cliente chama um método e a facade orquestra as peças.',
    'Ela é um **atalho, não um muro**: o subsistema continua acessível para quem precisa de controle fino — e nem sabe que a facade existe.',
    'Uma boa facade concentra a **ordem dos passos**, as **compensações** em caso de falha e a **tradução de erros** para o vocabulário do cliente (`raise ... from e`).',
    'Facade **simplifica** (vários objetos, interface nova); Adapter **converte** (uma interface na esperada); Mediator **coordena** colegas que conversam com ele.',
    'Facades ajudam a respeitar a **Lei de Demeter** — mas cuidado para não virarem um *God object* nem um mero repassador de chamadas.',
  ],
  glossary: [
    { term: 'Facade', aliases: ['fachada', 'facades', 'fachadas', 'padrão Facade'], definition: 'Padrão estrutural que oferece uma interface única e simplificada para um conjunto de classes (subsistema), sem impedir o acesso direto a elas.' },
    { term: 'Subsistema', aliases: ['subsistemas'], definition: 'Conjunto de classes que colaboram para oferecer uma capacidade (pagamento, estoque, notificações) e que o cliente teria de orquestrar sozinho sem uma facade.' },
    { term: 'Abstração vazada', aliases: ['abstrações vazadas', 'leaky abstraction', 'leaky abstractions'], definition: 'Quando detalhes que a abstração deveria esconder escapam para o cliente — por exemplo, exceções específicas do fornecedor atravessando a facade.' },
    { term: 'Tradução de exceções', aliases: ['exception translation', 'traduzir exceções'], definition: 'Capturar exceções de uma camada inferior e relançá-las no vocabulário da abstração de cima. Em Python, `raise NovoErro(...) from e` preserva a causa original em `__cause__`.' },
    { term: 'Transação pivô', aliases: ['pivot transaction', 'transacao pivo'], definition: 'Em sagas, o passo "sem volta": antes dele, os passos são compensáveis; depois dele, só devem vir passos que possam ser re-tentados até dar certo.' },
  ],
  steps: [
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Hoje o padrão é o **Facade** — em português, *fachada*: esconder um subsistema complicado atrás de uma porta de entrada simples.',
        'Olha o que o controller da loja precisa fazer, hoje, para fechar uma compra…',
      ],
      board: {
        title: 'O problema: o cliente sabe demais',
        code: `def finalizar_pedido_http(request):
    itens = request.json["itens"]
    reserva = estoque.reservar(itens)
    total = sum(catalogo.preco(sku) * qtd for sku, qtd in itens.items())
    try:
        tx = gateway.cobrar(request.json["cartao"], total)
    except PagamentoRecusado:
        estoque.liberar(reserva)            # não esquecer! 😬
        raise
    nota = fiscal.emitir(tx, itens)
    email.enviar(request.user.email, "Pedido confirmado", anexo=nota)
    return {"pedido": reserva}

# ...e o app mobile, o painel admin e o job de assinaturas
# repetem essa MESMA coreografia 😩`,
        caption: 'Cinco dependências, uma ordem que importa e uma compensação fácil de esquecer — copiadas em cada cliente.',
      },
    },
    {
      type: 'say',
      text: [
        'A **Facade** junta essa coreografia num lugar só. O cliente chama **um** método; a facade conversa com estoque, catálogo, pagamento, fiscal e e-mail.',
        'Repare na direção das setas: o subsistema **não sabe** que a facade existe. Ela é só mais um cliente dele — um cliente muito bem-educado.',
      ],
      board: {
        title: 'Facade: uma porta de entrada',
        md: `\`\`\`text
Controller web ──┐
App mobile ──────┼──►CheckoutFacade
Job noturno ─────┘          │
    ┌───────────┬───────────┼───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼
 Estoque    Catálogo    Pagamento    Fiscal       Email
\`\`\`

\`\`\`python
class CheckoutFacade:
    def __init__(self, estoque, catalogo, pagamento, fiscal, email):
        self.estoque = estoque
        self.catalogo = catalogo
        self.pagamento = pagamento
        self.fiscal = fiscal
        self.email = email

    def finalizar_compra(self, cliente, itens, cartao):
        ...                          # toda a coreografia mora aqui
        return Recibo(reserva, tx, total)


# o controller agora só faz isto:
def finalizar_pedido_http(request):
    recibo = checkout.finalizar_compra(request.user.email,
                                       request.json["itens"],
                                       request.json["cartao"])
    return {"pedido": recibo.reserva}
\`\`\`

> [!dica] As peças do subsistema são **injetadas** no construtor. Nos testes, você passa objetos falsos e verifica a coreografia inteira sem banco nem gateway de verdade.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Um detalhe que o GoF faz questão de dizer: a facade **não proíbe** o acesso direto ao subsistema.',
        'Ela atende o caso comum. Quem precisa de controle fino — um relatório de estoque, um estorno manual — continua usando as classes de baixo.',
      ],
      board: {
        title: 'Atalho, não muro',
        md: `- **Caso comum** → \`checkout.finalizar_compra(...)\`: simples, seguro, testado
- **Caso especial** → \`estoque.relatorio_por_deposito()\`, \`pagamento.estornar(tx)\`, direto no subsistema
- A facade **não é dona** do subsistema: as classes de baixo não devem "conhecer" a facade

> [!nota] Nas palavras do GoF: a Facade não impede as aplicações de usar as classes do subsistema se precisarem — assim, você escolhe entre **facilidade de uso** e **generalidade**.

O próprio Python está cheio de facades assim:

| Facade | O que ela esconde | Quando descer um nível |
|---|---|---|
| \`subprocess.run()\` | \`Popen\`, pipes, \`communicate()\`, timeout | ler a saída em *streaming* → \`Popen\` |
| \`json.dumps()\` | a criação e a configuração de um \`JSONEncoder\` | serializar tipos próprios em vários lugares → subclasse de \`JSONEncoder\` |
| \`logging.basicConfig()\` | handler, formatter e logger raiz | vários destinos com níveis diferentes → handlers próprios |
| \`shutil.copytree()\` | varrer pastas, criar diretórios, copiar arquivo a arquivo | filtros e progresso sob medida |`,
      },
    },
    {
      type: 'say',
      mood: 'concerned',
      text: [
        'O trabalho mais valioso da facade é o que o cliente **não** vê: a ordem dos passos e o que fazer quando um deles falha.',
        'Se o pagamento é recusado, a reserva precisa ser desfeita. E o cliente não deveria ter que conhecer o `PagamentoRecusado` do gateway nem o `SemEstoque` do depósito.',
      ],
      board: {
        title: 'Falhas: compensar e traduzir',
        md: `\`\`\`python
class CompraRecusada(Exception):
    """O único erro que o cliente da facade precisa conhecer."""


class CheckoutFacade:
    ...
    def finalizar_compra(self, cliente, itens, cartao):
        if not itens:
            raise ValueError("carrinho vazio")
        try:
            reserva = self.estoque.reservar(itens)          # compensável
        except SemEstoque as e:
            raise CompraRecusada("item indisponível") from e

        total = sum(self.catalogo.preco(s) * q for s, q in itens.items())
        try:
            tx = self.pagamento.cobrar(cartao, total)       # ponto sem volta
        except PagamentoRecusado as e:
            self.estoque.liberar(reserva)                   # compensação
            raise CompraRecusada("pagamento recusado") from e

        nota = self.fiscal.emitir(tx, itens)
        self.email.enviar(cliente, "Pedido confirmado", anexo=nota)
        return Recibo(reserva, tx, total)
\`\`\`

> [!atencao] Deixar \`SemEstoque\` atravessar a facade é uma **abstração vazada** (*leaky abstraction*): o cliente volta a depender do subsistema. Traduza para um erro do vocabulário da facade e use \`raise ... from e\` — a causa original fica em \`__cause__\` e continua aparecendo no traceback.

> [!sabia] Essa ordem tem nome no mundo das **sagas**: primeiro os passos **compensáveis** (reservar), depois a **transação pivô** — o ponto sem volta (cobrar) — e, por fim, só passos **re-tentáveis**. Se o e-mail falhar, ele vai para uma fila de reenvio: ninguém cancela uma compra paga porque o servidor de e-mail caiu. Você verá mais na trilha de Arquitetura.`,
      },
    },
    {
      type: 'say',
      mood: 'thinking',
      text: [
        'Facades também ajudam a respeitar a **Lei de Demeter**: "fale só com seus amigos imediatos".',
        'Quando o cliente navega `pedido.cliente.endereco.cidade`, ele passa a depender da estrutura **inteira** do caminho. Mudou um elo, quebrou o cliente.',
      ],
      board: {
        title: 'Lei de Demeter: só fale com amigos',
        md: `Um método \`m\` de um objeto \`o\` só deveria chamar métodos de:

1. o próprio \`o\` (\`self\`);
2. os **parâmetros** de \`m\`;
3. objetos **criados** dentro de \`m\`;
4. os **atributos diretos** de \`o\`.

\`\`\`python
# ❌ "train wreck": o cliente conhece o caminho inteiro
frete = pedido.cliente.endereco.cidade.tabela_frete.calcular(peso)

# ✅ pergunte a quem sabe (ou a uma facade)
frete = pedido.calcular_frete(peso)
\`\`\`

> [!sabia] O nome vem do **Projeto Demeter**, da Northeastern University (1987), batizado em homenagem à deusa grega da agricultura. E a lei não é "proibido usar dois pontos": \`texto.strip().lower()\` ou um builder fluente encadeiam chamadas sobre o **mesmo** tipo de objeto, sem navegar pela estrutura de outros. Martin Fowler brinca que preferia chamá-la de "Sugestão Ocasionalmente Útil de Demeter".`,
      },
    },
    {
      type: 'say',
      text: [
        'Três padrões vivem sendo confundidos: **Facade**, **Adapter** e **Mediator**. Todos ficam "no meio do caminho" — a diferença é a **intenção** e a **direção** da conversa.',
        { text: 'E um alerta: facade que cresce sem controle vira um *God object*; facade que só repassa chamadas uma a uma é peso morto.', mood: 'concerned' },
      ],
      board: {
        title: 'Facade × Adapter × Mediator',
        md: `| | Facade | Adapter | Mediator |
|---|---|---|---|
| Intenção | **Simplificar** o uso de um subsistema | **Converter** uma interface na esperada | **Coordenar** colegas que não se conhecem |
| Envolve | Vários objetos; interface nova | Normalmente um objeto | Vários colegas |
| Direção | Cliente → facade → subsistema (que nem sabe dela) | Cliente → adapter → adaptado | Colegas ↔ mediator (eles o conhecem e o avisam) |
| Exemplo | \`CheckoutFacade.finalizar_compra()\` | adapter para o SDK de um gateway de pagamento | torre de controle: aviões falam com a torre, não entre si |

**Armadilhas:**

- **God object** — a facade acumula regra de negócio de tudo. Prefira **várias facades pequenas**, uma por caso de uso.
- **Middle Man** — métodos que só repassam 1:1 (\`def cobrar(self, x): return self.pagamento.cobrar(x)\`) não simplificam nada.
- **Muro** — esconder o subsistema a ponto de impedir os casos avançados.`,
      },
    },
    { type: 'section', title: 'Atividades de fixação', subtitle: 'Simplificar, converter ou coordenar?', icon: '🎯' },
    {
      type: 'mcq',
      id: 'dp-fac-q1',
      concept: 'Facade × Mediator',
      say: 'Primeiro, um cenário para separar os primos.',
      prompt: 'Numa tela de cadastro, marcar **"Pessoa jurídica"** precisa habilitar o campo CNPJ, esconder o CPF e trocar a validação do botão **Salvar**. Hoje cada widget guarda referências para os outros e eles se chamam em todas as direções. Qual padrão organiza melhor essa conversa?',
      options: [
        { text: 'Facade', why: 'Facade simplifica o acesso **de fora** a um subsistema; aqui o problema é a conversa **entre** os próprios componentes, que continuariam se referenciando.' },
        { text: 'Mediator', correct: true, why: 'Cada widget só avisa o mediador ("mudei!") e ele decide o que os outros fazem. Os colegas deixam de se conhecer.' },
        { text: 'Adapter', why: 'Não há nenhuma interface incompatível a converter.' },
        { text: 'Observer', why: 'Observer ajuda a **notificar**, mas sozinho mantém a teia de regras espalhada pelos widgets. É comum o Mediator usar notificações por dentro.' },
      ],
      explanation: 'Na Facade, a seta vai num sentido só: o subsistema nem sabe que ela existe. No **Mediator**, os colegas **conhecem** o mediador e conversam com ele nos dois sentidos — é ele quem concentra as regras de interação, trocando uma malha de N×N referências por N conexões com o centro.',
    },
    {
      type: 'mcq',
      id: 'dp-fac-q2',
      concept: 'Lei de Demeter',
      say: 'Agora, olho clínico: qual linha desrespeita a Lei de Demeter?',
      prompt: `Qual linha **viola** a Lei de Demeter?

\`\`\`python
class Checkout:
    def __init__(self, pagamento):
        self.pagamento = pagamento

    def pagar(self, pedido):
        total = pedido.total()                      # (A)
        self.pagamento.cobrar(total)                # (B)
        recibo = Recibo(total)
        recibo.imprimir()                           # (C)
        cidade = pedido.cliente.endereco.cidade     # (D)
        return recibo, cidade
\`\`\``,
      options: [
        { text: '(A)', why: '`pedido` é **parâmetro** do método: conversar com ele é permitido.' },
        { text: '(B)', why: '`self.pagamento` é **atributo direto** do objeto: é um "amigo imediato".' },
        { text: '(C)', why: '`recibo` foi **criado** dentro do método: pode receber chamadas.' },
        { text: '(D)', correct: true, why: 'O método atravessa `cliente` e `endereco` — "amigos de amigos". Se o `Cliente` mudar a forma de guardar o endereço, o `Checkout` quebra.' },
      ],
      explanation: 'A Lei de Demeter limita **com quem** o método conversa: o próprio objeto, os parâmetros, os objetos que ele cria e os atributos diretos. O remédio para (D) é pedir a quem sabe — `pedido.cidade_de_entrega()` — ou colocar uma facade na frente do subsistema.',
    },
    {
      type: 'order',
      id: 'dp-fac-q3',
      concept: 'Transação pivô',
      say: 'Coloque a coreografia do checkout na ordem que minimiza o estrago se algo falhar.',
      prompt: 'Ordene os passos que a `CheckoutFacade.finalizar_compra` deve executar:',
      items: [
        'Validar o carrinho (não pode estar vazio)',
        'Reservar os itens no estoque',
        'Cobrar o cartão do cliente',
        'Emitir a nota fiscal da compra',
        'Enviar o e-mail de confirmação',
      ],
      explanation: 'Primeiro o que é barato e não tem efeito colateral (validar); depois o passo **compensável** (a reserva pode ser liberada); então o **ponto sem volta** (a cobrança — a transação pivô). Nota fiscal só existe para compra paga, e o e-mail vai por último: é o único passo que não dá para "desenviar" — e, se falhar, pode ser re-tentado sem cancelar a compra.',
    },
    {
      type: 'match',
      id: 'dp-fac-q4',
      concept: 'Facade × Adapter × Mediator',
      say: 'Rapidinha: ligue cada padrão à sua intenção.',
      prompt: 'Associe cada padrão à sua **intenção**:',
      pairs: [
        { left: 'Facade', right: 'Porta de entrada simples para um subsistema que nem sabe dela' },
        { left: 'Adapter', right: 'Converte a interface de um objeto na que o cliente espera' },
        { left: 'Mediator', right: 'Centraliza a conversa entre colegas que não se conhecem' },
        { left: 'Decorator', right: 'Mesma interface, com comportamento extra' },
        { left: 'Proxy', right: 'Mesma interface, controlando o acesso ao objeto real' },
      ],
      explanation: 'Os cinco intermediam objetos — o que os separa é a **intenção**: simplificar (Facade), converter (Adapter), coordenar (Mediator), acrescentar comportamento (Decorator) ou controlar o acesso (Proxy: cache, carregamento preguiçoso, permissão).',
    },
    {
      type: 'code',
      id: 'dp-fac-q5',
      concept: 'Facade',
      title: 'Facade de checkout',
      say: 'Mão na massa: sua própria `CheckoutFacade`, com compensação e tradução de erros. Os testes ocultos derrubam o servidor de e-mail — prepare-se!',
      prompt: `O subsistema da loja (\`Estoque\`, \`Pagamento\`, \`Email\`, a tabela \`PRECOS\` e as exceções) já existe — **não o modifique**. Implemente \`CheckoutFacade(estoque, pagamento, email)\` com o método \`finalizar_compra(cliente, itens, cartao)\`, em que \`itens\` é um dict \`{sku: quantidade}\`:

1. Carrinho vazio → \`ValueError\`.
2. Reserve os itens com \`estoque.reservar(itens)\`. Se faltar estoque (\`SemEstoque\` — inclusive para SKU inexistente), lance **\`CompraRecusada\`**, sem cobrar nem enviar e-mail.
3. Calcule o total com \`PRECOS\` e cobre com \`pagamento.cobrar(cartao, total)\`. Se vier \`PagamentoRecusado\`, **libere a reserva** e lance \`CompraRecusada\`.
4. Envie \`email.enviar(cliente, "Pedido confirmado")\`. Se o e-mail falhar com \`ConnectionError\`, a compra **continua valendo**.
5. Retorne \`{"reserva": ..., "transacao": ..., "total": ..., "email_enviado": True ou False}\`.

Toda \`CompraRecusada\` deve **encadear** a exceção original (\`raise ... from e\`), para que ela fique em \`__cause__\`.`,
      starter: `class SemEstoque(Exception):
    pass


class PagamentoRecusado(Exception):
    pass


class CompraRecusada(Exception):
    """Erro da facade: o único que o cliente precisa conhecer."""


PRECOS = {"livro": 50.0, "caneca": 30.0, "camiseta": 80.0}


class Estoque:
    def __init__(self, disponivel):
        self.disponivel = dict(disponivel)       # sku -> quantidade
        self.reservas = {}
        self._seq = 0

    def reservar(self, itens):
        for sku, qtd in itens.items():
            if self.disponivel.get(sku, 0) < qtd:
                raise SemEstoque(sku)
        for sku, qtd in itens.items():
            self.disponivel[sku] -= qtd
        self._seq += 1
        reserva = f"R{self._seq}"
        self.reservas[reserva] = dict(itens)
        return reserva

    def liberar(self, reserva):
        for sku, qtd in self.reservas.pop(reserva).items():
            self.disponivel[sku] += qtd


class Pagamento:
    def __init__(self, limite):
        self.limite = limite
        self.cobrancas = []

    def cobrar(self, cartao, valor):
        if valor > self.limite:
            raise PagamentoRecusado(f"limite excedido: {valor}")
        self.cobrancas.append((cartao, valor))
        return f"TX{len(self.cobrancas)}"


class Email:
    def __init__(self):
        self.enviados = []

    def enviar(self, para, assunto):
        self.enviados.append((para, assunto))


class CheckoutFacade:
    def __init__(self, estoque, pagamento, email):
        pass

    def finalizar_compra(self, cliente, itens, cartao):
        pass
`,
      tests: [
        { name: 'compra aprovada', code: 'est = Estoque({"livro": 5, "caneca": 2})\npag = Pagamento(limite=1000)\nmail = Email()\nr = CheckoutFacade(est, pag, mail).finalizar_compra("ana@x.com", {"livro": 2, "caneca": 1}, "4111")\nassert r == {"reserva": "R1", "transacao": "TX1", "total": 130.0, "email_enviado": True}, r\nassert est.disponivel == {"livro": 3, "caneca": 1}, est.disponivel\nassert pag.cobrancas == [("4111", 130.0)], pag.cobrancas\nassert mail.enviados == [("ana@x.com", "Pedido confirmado")], mail.enviados' },
        { name: 'sem estoque → CompraRecusada, nada cobrado', code: 'est = Estoque({"livro": 1})\npag = Pagamento(limite=1000)\nmail = Email()\ntry:\n    CheckoutFacade(est, pag, mail).finalizar_compra("ana@x.com", {"livro": 2}, "4111")\nexcept CompraRecusada:\n    pass\nelse:\n    raise AssertionError("faltou estoque: deveria lançar CompraRecusada")\nassert pag.cobrancas == [] and mail.enviados == [], "nada pode ser cobrado nem enviado"' },
        { name: 'pagamento recusado → libera a reserva', code: 'est = Estoque({"camiseta": 3})\npag = Pagamento(limite=100)\nmail = Email()\ntry:\n    CheckoutFacade(est, pag, mail).finalizar_compra("bia@x.com", {"camiseta": 2}, "5555")\nexcept CompraRecusada:\n    pass\nelse:\n    raise AssertionError("pagamento recusado: deveria lançar CompraRecusada")\nassert est.disponivel == {"camiseta": 3}, f"a reserva não foi liberada: {est.disponivel}"\nassert est.reservas == {} and mail.enviados == []' },
        { name: 'carrinho vazio → ValueError', code: 'try:\n    CheckoutFacade(Estoque({}), Pagamento(100), Email()).finalizar_compra("a@x.com", {}, "1")\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("carrinho vazio deveria lançar ValueError")' },
        { name: 'causa encadeada (raise ... from e)', hidden: true, code: 'loja = CheckoutFacade(Estoque({"livro": 1}), Pagamento(limite=10), Email())\nfor itens, causa in (({"livro": 9}, SemEstoque), ({"livro": 1}, PagamentoRecusado)):\n    try:\n        loja.finalizar_compra("a@x.com", itens, "1")\n    except CompraRecusada as e:\n        assert isinstance(e.__cause__, causa), f"__cause__ deveria ser {causa.__name__}, veio {e.__cause__!r} — use raise ... from e"\n    else:\n        raise AssertionError("deveria lançar CompraRecusada")' },
        { name: 'e-mail fora do ar não desfaz a compra', hidden: true, code: 'class EmailFora:\n    def enviar(self, para, assunto):\n        raise ConnectionError("servidor de e-mail indisponível")\n\nest = Estoque({"livro": 2})\npag = Pagamento(limite=1000)\nr = CheckoutFacade(est, pag, EmailFora()).finalizar_compra("a@x.com", {"livro": 1}, "1")\nassert r["email_enviado"] is False, r\nassert pag.cobrancas == [("1", 50.0)] and est.disponivel == {"livro": 1}, "a compra deve continuar valendo"' },
        { name: 'SKU inexistente → CompraRecusada', hidden: true, code: 'pag = Pagamento(limite=1000)\ntry:\n    CheckoutFacade(Estoque({"livro": 2}), pag, Email()).finalizar_compra("a@x.com", {"livro": 1, "drone": 1}, "1")\nexcept CompraRecusada:\n    pass\nelse:\n    raise AssertionError("SKU inexistente deveria virar CompraRecusada")\nassert pag.cobrancas == []' },
        { name: 'duas compras seguidas', hidden: true, code: 'est = Estoque({"livro": 5})\nloja = CheckoutFacade(est, Pagamento(limite=1000), Email())\nr1 = loja.finalizar_compra("a@x.com", {"livro": 1}, "1")\nr2 = loja.finalizar_compra("b@x.com", {"livro": 2}, "2")\nassert (r1["reserva"], r2["reserva"], r2["transacao"], r2["total"]) == ("R1", "R2", "TX2", 100.0), (r1, r2)\nassert est.disponivel == {"livro": 2}' },
      ],
      reviews: [
        {
          when: m => m.bareExcepts > 0 || m.broadExcepts > 0,
          text: 'Você capturou `Exception` (ou usou `except:` puro). Assim, um bug de verdade — um `TypeError`, um `KeyError` — vira "compra recusada" ou "e-mail não enviado" e some. Capture só o que você sabe tratar: `SemEstoque`, `PagamentoRecusado`, `ConnectionError`.',
          concept: 'Tratamento de exceções',
        },
        {
          when: m => ['Estoque', 'Pagamento', 'Email'].some(c => m.calls.includes(c)),
          text: 'A facade cria as próprias dependências (`Estoque(...)`, `Email()`…). Receba-as prontas no construtor: assim os testes passam objetos falsos e a facade não decide sozinha qual implementação usar.',
          concept: 'Injeção de dependência',
        },
        {
          when: (m, code) => /\.(disponivel|reservas|cobrancas|enviados|_seq)\b/.test(code.split('class CheckoutFacade')[1] || ''),
          text: 'A facade mexe em **atributos internos** do subsistema (`disponivel`, `reservas`, `cobrancas`…). Use só a interface pública (`reservar`, `liberar`, `cobrar`, `enviar`): senão, qualquer mudança interna quebra a facade — e a Lei de Demeter chora.',
          concept: 'Lei de Demeter',
        },
      ],
      hints: [
        'Guarde as três dependências no `__init__`. No método, a ordem é: validar → reservar → calcular o total → cobrar → e-mail → retornar.',
        'Envolva **só** a reserva num `try/except SemEstoque as e:` e relance com `raise CompraRecusada("sem estoque") from e`.',
        'No `except PagamentoRecusado as e:`, chame `self.estoque.liberar(reserva)` **antes** de relançar a `CompraRecusada`.',
        'Para o e-mail: `try:` envia e marca `email_enviado = True`; `except ConnectionError:` marca `email_enviado = False`.',
      ],
      solution: `class SemEstoque(Exception):
    pass


class PagamentoRecusado(Exception):
    pass


class CompraRecusada(Exception):
    """Erro da facade: o único que o cliente precisa conhecer."""


PRECOS = {"livro": 50.0, "caneca": 30.0, "camiseta": 80.0}


class Estoque:
    def __init__(self, disponivel):
        self.disponivel = dict(disponivel)       # sku -> quantidade
        self.reservas = {}
        self._seq = 0

    def reservar(self, itens):
        for sku, qtd in itens.items():
            if self.disponivel.get(sku, 0) < qtd:
                raise SemEstoque(sku)
        for sku, qtd in itens.items():
            self.disponivel[sku] -= qtd
        self._seq += 1
        reserva = f"R{self._seq}"
        self.reservas[reserva] = dict(itens)
        return reserva

    def liberar(self, reserva):
        for sku, qtd in self.reservas.pop(reserva).items():
            self.disponivel[sku] += qtd


class Pagamento:
    def __init__(self, limite):
        self.limite = limite
        self.cobrancas = []

    def cobrar(self, cartao, valor):
        if valor > self.limite:
            raise PagamentoRecusado(f"limite excedido: {valor}")
        self.cobrancas.append((cartao, valor))
        return f"TX{len(self.cobrancas)}"


class Email:
    def __init__(self):
        self.enviados = []

    def enviar(self, para, assunto):
        self.enviados.append((para, assunto))


class CheckoutFacade:
    def __init__(self, estoque, pagamento, email):
        self.estoque = estoque
        self.pagamento = pagamento
        self.email = email

    def finalizar_compra(self, cliente, itens, cartao):
        if not itens:
            raise ValueError("carrinho vazio")
        try:
            reserva = self.estoque.reservar(itens)              # compensável
        except SemEstoque as e:
            raise CompraRecusada(f"sem estoque: {e}") from e

        total = sum(PRECOS[sku] * qtd for sku, qtd in itens.items())
        try:
            transacao = self.pagamento.cobrar(cartao, total)    # ponto sem volta
        except PagamentoRecusado as e:
            self.estoque.liberar(reserva)                       # compensação
            raise CompraRecusada("pagamento recusado") from e

        try:
            self.email.enviar(cliente, "Pedido confirmado")     # re-tentável
            email_enviado = True
        except ConnectionError:
            email_enviado = False

        return {"reserva": reserva, "transacao": transacao,
                "total": total, "email_enviado": email_enviado}
`,
      solutionExplanation: 'A facade concentra a **coreografia**: valida, reserva (passo compensável), cobra (o ponto sem volta) e só então envia o e-mail — que é re-tentável, por isso uma falha nele não desfaz a compra. Cada falha do subsistema é **traduzida** para `CompraRecusada` com `raise ... from e`, que preserva a causa em `__cause__` sem obrigar o cliente a conhecer `SemEstoque` ou `PagamentoRecusado`. A reserva é liberada quando o pagamento falha — a compensação que o controller vivia esquecendo. E, como as dependências são injetadas, os testes rodam com objetos falsos.',
    },
    {
      type: 'open',
      id: 'dp-fac-q6',
      concept: 'Facade',
      say: 'Para fechar, uma discussão de design. Responda como numa entrevista.',
      prompt: 'Um colega propõe: *"Agora que temos a `CheckoutFacade`, vamos tornar `Estoque` e `Pagamento` privados para ninguém mais usá-los diretamente."* Você concorda? Que cuidados você teria ao desenhar e evoluir essa facade?',
      minWords: 15,
      rubric: [
        { label: 'Explica que a facade **não deve impedir** o acesso direto ao subsistema', keywords: ['acesso direto', 'nao impede', 'nao deve impedir', 'nao precisa impedir', 'atalho', 'muro', 'continua acessivel', 'continuam acessiveis', 'controle fino', 'casos avancados', 'caso especial', 'casos especiais', 'discordo', 'nao concordo'], concept: 'Facade', why: 'A facade atende o caso comum; casos especiais (relatórios, estornos) ainda precisam do subsistema.' },
        { label: 'Alerta para não virar **God object** (facade enxuta, uma por caso de uso)', keywords: ['god', 'deus', 'inchad', 'gigante', 'enxut', 'pequena', 'caso de uso', 'casos de uso', 'regra de negocio', 'responsabilidade'], concept: 'God object', why: 'Uma facade que absorve toda a regra de negócio vira um ponto central frágil.' },
        { label: 'Cuida dos **erros**: traduzir exceções, não vazar detalhes', keywords: ['exce', 'erro', 'vaz', 'leaky', 'traduz'], concept: 'Tradução de exceções', why: 'Sem tradução, o cliente volta a depender dos tipos do subsistema.' },
        { label: 'Mantém **injeção de dependência** / testabilidade', keywords: ['inje', 'test', 'fake', 'mock', 'dubl', 'construtor'], concept: 'Injeção de dependência', why: 'Receber o subsistema pronto permite testar a coreografia com objetos falsos.' },
      ],
      modelAnswer: `Eu **não** concordo. A facade é um **atalho para o caso comum**, não um muro: o próprio GoF diz que ela não impede o acesso direto ao subsistema. Casos especiais — um relatório de estoque, um estorno manual, uma conciliação — precisam de controle fino e devem continuar usando \`Estoque\` e \`Pagamento\` diretamente.

Ao desenhar e evoluir a facade, eu teria alguns cuidados:

- mantê-la **enxuta**, orquestrando o caso de uso sem virar um *God object* com toda a regra de negócio — se crescer demais, divido em várias facades, uma por caso de uso;
- **traduzir as exceções** do subsistema para erros do vocabulário dela (\`CompraRecusada\`), com \`raise ... from e\` para não perder a causa — evitando uma abstração vazada;
- receber as dependências por **injeção** no construtor, para testar a coreografia com objetos falsos;
- evitar métodos que só repassam chamadas 1:1, que não simplificam nada.`,
    },
    {
      type: 'say',
      mood: 'happy',
      text: [
        'Ótimo trabalho! **Facade** é uma porta simples para um subsistema complexo: concentra a ordem, as compensações e a tradução de erros — sem trancar as outras portas.',
        'E guarde a diferença: Facade **simplifica**, Adapter **converte**, Mediator **coordena**. A Lei de Demeter agradece.',
      ],
      board: null,
    },
  ],
});
