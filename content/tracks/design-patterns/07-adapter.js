(function () {
  // Gateway falso usado pelos testes (definido no setup de cada teste).
  const FAKE_GATEWAY = `class FakeGateway:
    def __init__(self, status="aprovado"):
        self.status = status
        self.chamadas = []

    def efetuar_cobranca(self, centavos, moeda):
        self.chamadas.append((centavos, moeda))
        return {"status": self.status, "id": "tx-1"}
`;

  Game.registerModule('design-patterns', {
    id: 'adapter',
    title: 'Adapter (e Facade)',
    kind: 'lesson',
    level: 2,
    order: 20,
    unit: 'estruturais',
    summary: 'Encaixar interfaces incompatíveis — e a diferença para Facade e Decorator.',
    concepts: ['Adapter', 'Facade', 'Anti-corruption layer', 'Integração com terceiros'],
    takeaways: [
      'O **Adapter** implementa a interface que o seu código espera e, por dentro, **traduz** nomes, parâmetros, unidades e formatos de retorno para a interface do fornecedor.',
      'Prefira o adapter de **objeto** (composição, com o adaptado recebido no construtor): funciona com qualquer implementação compatível e facilita testes com fakes.',
      'Conversão de unidades é onde moram os bugs: `int(19.99 * 100)` dá `1998`. Para dinheiro, use `round`, `Decimal` ou centavos inteiros desde o início.',
      'Envolver SDKs de terceiros atrás de uma interface sua cria uma **camada anticorrupção**: trocar de fornecedor ou de versão da API mexe num lugar só.',
      'Adapter **converte** uma interface na esperada; Facade **simplifica** um subsistema; Decorator **adiciona** comportamento mantendo a mesma interface.',
    ],
    glossary: [
      { term: 'Adapter', aliases: ['adapters', 'padrão Adapter', 'adaptador', 'adaptadores'], definition: 'Padrão estrutural (GoF) que converte a interface de uma classe existente na interface que o cliente espera, traduzindo nomes, parâmetros e formatos — como um adaptador de tomada.' },
      { term: 'Camada anticorrupção', aliases: ['camadas anticorrupção', 'anti-corruption layer', 'anticorruption layer'], definition: 'Termo do DDD (Eric Evans, 2003): conjunto de adapters e tradutores que isola o modelo do seu domínio do vocabulário e dos formatos de um sistema externo ou legado.' },
      { term: 'Adapter de classe', aliases: ['adapters de classe', 'class adapter', 'adaptador de classe'], definition: 'Variante do Adapter que **herda** da classe adaptada (no C++ do GoF, por herança múltipla) em vez de embrulhá-la. Acopla o adaptador à implementação concreta; em Python, prefira o adapter de objeto.' },
      { term: 'Wrapper', aliases: ['wrappers', 'invólucro', 'invólucros'], definition: 'Objeto ou função que embrulha outro e repassa as chamadas a ele, fazendo algo no caminho. É a estrutura comum a Adapter, Decorator e Proxy — tanto que o GoF lista *Wrapper* como apelido do Adapter e do Decorator.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Sabe aquele adaptador de tomada que você leva em viagem? O **Adapter** é exatamente isso, só que para interfaces de código.',
          'Situação clássica: seu sistema espera uma interface, e a biblioteca de terceiros oferece outra.',
        ],
        board: {
          title: 'O problema: interfaces incompatíveis',
          code: `# O que o SEU sistema espera:
class ProcessadorPagamento(Protocol):
    def pagar(self, valor_reais: float) -> bool: ...


# O que o SDK do fornecedor oferece:
class GatewayXPay:
    def efetuar_cobranca(self, centavos: int, moeda: str) -> dict:
        ...   # {"status": "aprovado", "id": "tx-9"}


# Nomes diferentes, unidades diferentes (reais × centavos),
# retornos diferentes (bool × dict). E você não pode editar o SDK.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'O Adapter é uma classe que **implementa a interface que você espera** e, por dentro, **traduz** as chamadas para a interface do fornecedor.',
          'Ele converte nomes, parâmetros, unidades e formatos de retorno.',
        ],
        board: {
          title: 'Adapter de objeto (por composição)',
          code: `class AdaptadorXPay:                        # implementa ProcessadorPagamento
    def __init__(self, gateway):
        self.gateway = gateway                   # embrulha o SDK

    def pagar(self, valor_reais: float) -> bool:
        centavos = round(valor_reais * 100)      # converte unidade
        resposta = self.gateway.efetuar_cobranca(centavos, "BRL")
        return resposta["status"] == "aprovado"  # converte retorno


def finalizar_compra(processador, valor):   # só conhece a SUA interface
    return processador.pagar(valor)

finalizar_compra(AdaptadorXPay(GatewayXPay()), 99.90)`,
          caption: 'Trocar de fornecedor? Escreva outro adaptador. O resto do sistema nem percebe.',
        },
      },
      {
        type: 'say',
        mood: 'concerned',
        text: [
          'Reparou no `round(valor_reais * 100)`? Isso não é detalhe!',
          'Floats são binários: `19.99 * 100` dá `1998.9999999999998`. Com `int(...)` você cobraria **um centavo a menos**.',
        ],
        board: {
          title: '⚠️ Dinheiro e ponto flutuante',
          code: `>>> 19.99 * 100
1998.9999999999998
>>> int(19.99 * 100)      # trunca!
1998
>>> round(19.99 * 100)
1999

# Em sistemas financeiros de verdade, prefira Decimal
# ou trabalhe com centavos inteiros desde o início:
from decimal import Decimal
Decimal("19.99") * 100    # Decimal('1999.00')`,
          caption: 'Converter unidades é responsabilidade do adapter — e é onde moram os bugs sutis.',
        },
      },
      {
        type: 'say',
        text: [
          'Existe também o **Adapter de classe**, que usa herança. Em Python ele funciona, mas acopla o adaptador à implementação concreta — por isso preferimos composição.',
          'Em arquitetura, um conjunto de adapters que protege seu domínio das APIs externas é chamado de **camada anticorrupção**.',
        ],
        board: {
          title: 'Por que adaptar integrações externas',
          md: `- **Isolamento:** detalhes do fornecedor ficam num lugar só
- **Troca de fornecedor:** novo adapter, zero mudança no domínio
- **Testabilidade:** nos testes, passe um gateway falso para o adapter — ou um processador falso para o sistema
- **Anti-corruption layer:** o vocabulário do terceiro (\`efetuar_cobranca\`, centavos, dicts) não "vaza" para o seu código

> [!dica] Regra prática: **nunca** chame SDKs de terceiros espalhados pelo domínio. Encapsule atrás de uma interface sua.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Agora uma comparação que confunde muita gente: **Adapter**, **Facade** e **Decorator** embrulham objetos. A diferença está na **intenção**.',
        ],
        board: {
          title: 'Adapter × Facade × Decorator',
          md: `| Padrão | Intenção | Interface resultante |
|---|---|---|
| **Adapter** | Fazer algo **existente caber** numa interface esperada | **Diferente** da original (a que o cliente espera) |
| **Facade** | **Simplificar** o uso de um subsistema complexo | **Nova e mais simples**, cobrindo vários objetos |
| **Decorator** | **Adicionar** comportamento | **A mesma** da original |

\`\`\`python
class LojaFacade:                    # Facade: um método, vários subsistemas
    def comprar(self, cliente, itens):
        self.estoque.reservar(itens)
        self.pagamento.cobrar(cliente, total(itens))
        self.frete.agendar(cliente.endereco, itens)
        self.email.confirmar(cliente)
\`\`\``,
        },
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Quer ver adapters de verdade? A biblioteca padrão do Python está cheia deles — só não levam o nome no crachá.',
          'Todos embrulham algo que já existe e o expõem na interface que o cliente espera.',
        ],
        board: {
          title: 'Adapters escondidos na biblioteca padrão',
          md: `| Adapter | Recebe… | …e expõe como |
|---|---|---|
| \`io.TextIOWrapper\` | stream de **bytes** | arquivo de **texto** (\`str\`, encoding, linhas) |
| \`socket.makefile()\` | conexão de rede | objeto tipo arquivo (\`read\`, \`readline\`) |
| \`contextlib.closing\` | qualquer objeto com \`close()\` | context manager (\`with\`) |
| \`functools.cmp_to_key\` | comparador \`cmp(a, b)\` (negativo, zero ou positivo) | função \`key=\` do \`sorted\` |

\`\`\`python
import functools

def comparar(a, b):            # estilo Python 2: negativo, zero ou positivo
    return len(a) - len(b) or (a > b) - (a < b)

sorted(["ccc", "a", "bb", "aa"], key=functools.cmp_to_key(comparar))
# ['a', 'aa', 'bb', 'ccc']
\`\`\`

> [!sabia] O \`cmp_to_key\` é um Adapter de livro. O Python 3 aboliu o parâmetro \`cmp=\` do \`sorted\` e do \`list.sort\`; para o código antigo não precisar reescrever suas funções de comparação, o \`cmp_to_key\` (criado no 2.7/3.2 justamente para a migração) embrulha cada valor num objeto cujo \`<\` chama o seu \`comparar\`. E, no catálogo do GoF, Adapter e Decorator têm o **mesmo** apelido: *Wrapper*.`,
        },
      },
      { type: 'section', title: 'Atividades de fixação', subtitle: 'Adaptar, simplificar ou decorar?', icon: '🎯' },
      {
        type: 'mcq',
        id: 'dp-adapter-q1',
        concept: 'Adapter',
        say: 'Qual padrão cabe aqui?',
        prompt: 'Seu sistema de relatórios espera objetos com `exportar() -> str`. Você quer reaproveitar uma biblioteca legada cuja classe tem `gerar_documento(formato, encoding)` e retorna `bytes`. Qual padrão usar?',
        options: [
          { text: 'Adapter', correct: true, why: 'Você tem uma interface existente e precisa que ela **caiba** na interface esperada, convertendo parâmetros e retorno.' },
          { text: 'Facade', why: 'Facade simplifica um **subsistema inteiro**; aqui o problema é a incompatibilidade de uma interface.' },
          { text: 'Decorator', why: 'Decorator mantém **a mesma** interface e adiciona comportamento; aqui as interfaces são diferentes.' },
          { text: 'Strategy', why: 'Strategy troca algoritmos com a mesma interface; não resolve incompatibilidade.' },
        ],
        explanation: 'Interfaces **incompatíveis** + código que você não quer (ou não pode) alterar → **Adapter**, traduzindo `exportar()` para `gerar_documento(...)` e `bytes` para `str`.',
      },
      {
        type: 'mcq',
        id: 'dp-adapter-q2',
        concept: 'Facade',
        say: 'E agora?',
        prompt: 'Para gerar um vídeo, o cliente precisa configurar um codec, um mixer de áudio, um buffer e um compressor, na ordem certa. Você quer oferecer só `converter(arquivo, formato)`. Qual padrão?',
        options: [
          { text: 'Adapter', why: 'Não há uma interface específica esperada a ser atendida; o objetivo é **esconder a complexidade**.' },
          { text: 'Facade', correct: true, why: 'Uma interface simples na frente de um subsistema complexo com várias peças.' },
          { text: 'Decorator', why: 'Não estamos adicionando comportamento a um objeto, e sim simplificando o acesso a vários.' },
          { text: 'Observer', why: 'Observer trata de notificação de eventos.' },
        ],
        explanation: 'A **Facade** oferece um ponto de entrada simples (`converter`) que orquestra várias classes internas. O subsistema continua disponível para quem precisar de controle fino.',
      },
      {
        type: 'match',
        id: 'dp-rx2-adapter-match',
        concept: 'Adapter',
        say: 'Rodada rápida: reconheça os adapters pelo que eles convertem.',
        prompt: 'Associe cada adapter ao que ele **converte**:',
        pairs: [
          { left: '`io.TextIOWrapper`', right: 'Stream de bytes → leitura e escrita de `str`' },
          { left: '`socket.makefile()`', right: 'Conexão de rede → objeto tipo arquivo' },
          { left: '`contextlib.closing`', right: 'Objeto com `close()` → bloco `with`' },
          { left: '`functools.cmp_to_key`', right: 'Comparador `cmp(a, b)` → função `key=`' },
          { left: '`AdaptadorXPay`', right: '`pagar(reais)` → `efetuar_cobranca(centavos, "BRL")`' },
        ],
        explanation: 'Todos têm a estrutura do **Adapter**: embrulham algo que já existe e o expõem na interface que o cliente espera — texto em vez de bytes, arquivo em vez de socket, `with` em vez de `close()` manual, `key=` em vez de `cmp`. O `AdaptadorXPay` da aula faz o mesmo com o SDK de pagamento. Reconhecer o padrão em código real vale mais do que decorar o diagrama.',
      },
      {
        type: 'code',
        id: 'dp-adapter-q3',
        concept: 'Adapter',
        title: 'Adaptador de pagamento',
        say: 'Hora de escrever um adapter de verdade. Cuidado com a conversão de reais para centavos!',
        prompt: `Seu sistema chama \`processador.pagar(valor_reais) -> bool\`. O gateway do fornecedor tem:

\`\`\`python
gateway.efetuar_cobranca(centavos: int, moeda: str) -> dict
# retorna {"status": "aprovado" | "recusado", "id": "..."}
\`\`\`

Implemente \`AdaptadorPagamento(gateway)\`:

- recebe o gateway no construtor (não crie o gateway dentro da classe);
- \`pagar(valor_reais)\` converte para **centavos inteiros corretos** (\`19.99\` → \`1999\`), chama \`efetuar_cobranca(centavos, "BRL")\` e retorna \`True\` se o status for \`"aprovado"\`, senão \`False\`.

Nos testes, um \`FakeGateway\` registra as chamadas em \`gateway.chamadas\`.`,
        starter: `class AdaptadorPagamento:
    def __init__(self, gateway):
        pass

    def pagar(self, valor_reais):
        pass
`,
        tests: [
          { name: 'aprovado + chamada correta', setup: FAKE_GATEWAY, code: 'g = FakeGateway()\nassert AdaptadorPagamento(g).pagar(10.0) is True\nassert g.chamadas == [(1000, "BRL")], f"chamadas = {g.chamadas}"' },
          { name: 'recusado → False', setup: FAKE_GATEWAY, code: 'g = FakeGateway(status="recusado")\nassert AdaptadorPagamento(g).pagar(50) is False' },
          { name: '19,99 → 1999 centavos (cuidado com float!)', setup: FAKE_GATEWAY, code: 'g = FakeGateway()\nAdaptadorPagamento(g).pagar(19.99)\nassert g.chamadas[0][0] == 1999, f"enviou {g.chamadas[0][0]} centavos"\nassert isinstance(g.chamadas[0][0], int), "centavos devem ser int"' },
          { name: 'outro valor com arredondamento', hidden: true, setup: FAKE_GATEWAY, code: 'g = FakeGateway()\nAdaptadorPagamento(g).pagar(0.29)\nassert g.chamadas == [(29, "BRL")], f"chamadas = {g.chamadas}"' },
          { name: 'retorna bool de verdade', hidden: true, setup: FAKE_GATEWAY, code: 'r = AdaptadorPagamento(FakeGateway()).pagar(1)\nassert type(r) is bool' },
        ],
        reviews: [
          {
            when: m => m.classes.some(c => c.name === 'AdaptadorPagamento' && c.bases.some(b => b !== 'object')),
            text: 'Seu adapter usa **herança**. Adapter de objeto (composição) é mais flexível: funciona com qualquer gateway compatível e facilita testes com dublês.',
            concept: 'Composição > herança',
          },
          {
            when: (m, code) => /\bint\s*\(/.test(code) && !m.calls.includes('round') && !/Decimal/.test(code),
            text: 'Converter dinheiro com `int(valor * 100)` **trunca** (19.99 vira 1998). Use `round(...)` ou `Decimal` — a conversão de unidades é a parte crítica de um adapter.',
            concept: 'Ponto flutuante e dinheiro',
          },
        ],
        hints: [
          'Guarde a dependência: `self.gateway = gateway`.',
          'Centavos: `round(valor_reais * 100)` — o `round` sem casas decimais já devolve `int`.',
          '`return resposta["status"] == "aprovado"` já é um `bool`.',
        ],
        solution: `class AdaptadorPagamento:
    def __init__(self, gateway):
        self.gateway = gateway

    def pagar(self, valor_reais):
        centavos = round(valor_reais * 100)
        resposta = self.gateway.efetuar_cobranca(centavos, "BRL")
        return resposta["status"] == "aprovado"
`,
        solutionExplanation: 'O adapter recebe o gateway (composição + injeção, fácil de testar com o `FakeGateway`), traduz a **unidade** (reais → centavos com `round`, evitando o truncamento de `int`), o **nome** do método e o **formato de retorno** (`dict` → `bool`). O resto do sistema continua falando só `pagar(valor)`.',
      },
      {
        type: 'open',
        id: 'dp-adapter-q4',
        concept: 'Anti-corruption layer',
        say: 'Pergunta de entrevista: por que colocar um adapter na frente de uma API de terceiros?',
        prompt: 'Por que é uma boa prática envolver APIs/SDKs de terceiros com um **Adapter** em vez de usá-los diretamente no código de negócio?',
        minWords: 12,
        rubric: [
          { label: 'Permite **trocar de fornecedor** sem mexer no domínio', keywords: ['trocar', 'troca', 'substituir', 'mudar de fornecedor', 'outro fornecedor', 'fornecedor'], concept: 'Adapter', why: 'Só o adapter muda; o resto do sistema depende da sua própria interface.' },
          { label: 'Isola/**desacopla** o código de detalhes externos', keywords: ['isol', 'desacopl', 'acopla', 'encapsul', 'nao vaza', 'vazar', 'anticorrup', 'anti-corrup'], concept: 'Anti-corruption layer', why: 'O vocabulário e as mudanças do terceiro ficam contidos num ponto.' },
          { label: 'Facilita **testes** com dublês/mocks', keywords: ['test', 'mock', 'fake', 'dubl', 'stub'], concept: 'Testabilidade', why: 'Dá para substituir o adapter (ou o gateway) por uma versão falsa, sem rede.' },
          { label: 'Centraliza **conversões** e mudanças de versão da API', keywords: ['convers', 'convert', 'traduz', 'formato', 'versao', 'unidade', 'centraliz', 'um lugar', 'unico lugar'], concept: 'Integração com terceiros', why: 'Se a API mudar, você ajusta em um lugar só.' },
        ],
        modelAnswer: `Porque o adapter cria uma **fronteira** entre o domínio e o fornecedor (uma camada anticorrupção):

- **Desacoplamento/isolamento:** o código de negócio depende de uma interface **minha** (\`pagar(valor)\`), não do vocabulário e dos formatos do SDK.
- **Troca de fornecedor:** mudar de gateway significa escrever outro adapter, sem tocar no domínio.
- **Testes:** posso substituir o adapter por um fake nos testes do domínio, e testar o adapter com um gateway falso — sem rede.
- **Conversões e versões centralizadas:** unidades (centavos), formatos de retorno e mudanças na API ficam num **único lugar**.`,
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Perfeito! Adapter **converte** uma interface na que você espera; Facade **simplifica** um subsistema; Decorator **adiciona** mantendo a mesma interface.',
          'E lembre: envolva SDKs de terceiros, converta unidades com cuidado e prefira composição. Agora você está pronto(a) para a **entrevista** desta trilha!',
        ],
        board: null,
      },
    ],
  });
})();
