(function () {
  // Helpers Python dos testes (cada teste roda num namespace novo).
  const AUX = `def _servico(usuarios=("ana@loja.com", "bia@loja.com"), agora=1000):
    relogio_ = [agora]
    enviados = []
    trocas = []
    servico = ServicoReset(
        set(usuarios),
        lambda email, token: enviados.append((email, token)),
        lambda email, senha: trocas.append((email, senha)),
        relogio=lambda: relogio_[0],
    )
    return servico, enviados, trocas, relogio_

def _contem(obj, alvo, vistos=None):
    """Procura o token em texto puro em qualquer lugar do estado do objeto."""
    vistos = set() if vistos is None else vistos
    if id(obj) in vistos:
        return False
    vistos.add(id(obj))
    if isinstance(obj, str):
        return alvo in obj
    if isinstance(obj, (bytes, bytearray)):
        return alvo.encode() in obj
    if isinstance(obj, dict):
        return any(_contem(k, alvo, vistos) or _contem(v, alvo, vistos) for k, v in obj.items())
    if isinstance(obj, (list, tuple, set, frozenset)):
        return any(_contem(x, alvo, vistos) for x in obj)
    if obj is None or callable(obj) or isinstance(obj, (int, float)):
        return False
    atributos = getattr(obj, "__dict__", None)
    if isinstance(atributos, dict):
        return _contem(atributos, alvo, vistos)
    slots = getattr(type(obj), "__slots__", ())
    slots = [slots] if isinstance(slots, str) else slots
    return any(_contem(getattr(obj, nome, None), alvo, vistos) for nome in slots)
`;

  Game.registerModule('security', {
    id: 'entrevista-seguranca',
    title: 'Entrevista: segurança',
    kind: 'interview',
    level: 3,
    order: 90,
    unit: 'entrevistas',
    summary: 'A entrevistadora pede a modelagem de ameaças de um "esqueci minha senha": desenhar o fluxo e as fronteiras de confiança, levantar ameaças com STRIDE, priorizar pelo risco, propor mitigações — e corrigir um reset de senha vulnerável, com token de uso único, expiração e comparação em tempo constante.',
    concepts: ['Modelagem de ameaças', 'STRIDE', 'Priorização de riscos', 'Reset de senha seguro', 'Comparação em tempo constante'],
    takeaways: [
      'Modelagem de ameaças responde a quatro perguntas — **o que estamos construindo? o que pode dar errado? o que vamos fazer? fizemos um bom trabalho?** — a partir de um diagrama com as **fronteiras de confiança**.',
      '**STRIDE** é um checklist por categoria (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege); cada uma viola uma propriedade: autenticidade, integridade, não repúdio, confidencialidade, disponibilidade e autorização.',
      'Priorize por **risco = probabilidade × impacto**: o que é barato de explorar e toma contas vem antes do exótico — e as correções baratas entram logo.',
      'Reset seguro: token de `secrets` guardado só como **hash**, de **uso único**, que **expira** em minutos, amarrado à conta e comparado com `hmac.compare_digest`; a mesma resposta para qualquer e-mail; o link montado a partir de uma URL configurada, nunca do cabeçalho `Host`.',
      'Depois da troca: invalidar sessões e tokens pendentes, **avisar** o dono da conta e registrar tudo num log de auditoria (contra o repúdio).',
    ],
    glossary: [
      { term: 'Modelagem de ameaças', aliases: ['threat modeling', 'modelo de ameaças', 'modelagem de ameacas'], definition: 'Exercício estruturado para encontrar falhas de segurança **no design**, antes do código: descrever o sistema (em geral com um diagrama de fluxo de dados), perguntar o que pode dar errado (com STRIDE, por exemplo), decidir as mitigações e revisar o resultado.' },
      { term: 'Fronteira de confiança', aliases: ['fronteiras de confiança', 'fronteira de confianca', 'fronteiras de confianca', 'trust boundary', 'trust boundaries'], definition: 'Linha no diagrama onde o nível de confiança muda — internet ↔ API, API ↔ provedor de e-mail, painel interno ↔ banco. Todo dado que cruza uma fronteira precisa ser validado; é ali que a maioria das ameaças mora.' },
      { term: 'Enumeração de usuários', aliases: ['user enumeration', 'enumeracao de usuarios', 'enumeração de contas', 'enumeracao de contas', 'account enumeration'], definition: 'Falha em que a aplicação revela se uma conta existe — por mensagens diferentes ("e-mail não cadastrado"), códigos de status ou **tempo de resposta**. A lista de contas válidas alimenta phishing e *credential stuffing*.' },
      { term: 'Host header poisoning', aliases: ['envenenamento do cabeçalho Host', 'host header injection', 'password reset poisoning'], definition: 'Ataque em que o servidor monta URLs absolutas a partir do cabeçalho `Host` da requisição. O atacante pede o reset da vítima com `Host: evil.com`, e o e-mail legítimo leva um link — com o token — para o domínio dele.' },
      { term: 'Selector/verifier', aliases: ['selector e verifier', 'token dividido', 'split token'], definition: 'Padrão de token em duas partes: o **selector** (público) localiza o registro no banco, e o **verifier** (secreto) é comparado com o hash guardado, em tempo constante. A busca não vaza tempo sobre o segredo, e o banco nunca guarda o token em claro.' },
    ],
    steps: [
      {
        type: 'say',
        mood: 'neutral',
        text: [
          'Olá! Hoje eu sou sua **entrevistadora**. Não vou pedir para você recitar o OWASP Top 10.',
          'Vou pedir algo mais difícil: **pensar como atacante** sobre uma funcionalidade que todo sistema tem — e que muita gente implementa errado.',
        ],
        board: {
          title: '📋 Enunciado',
          md: `**Modele as ameaças do "Esqueci minha senha" de uma loja online.**

1. O usuário informa o e-mail em \`/esqueci-senha\`.
2. Se a conta existir, o sistema envia um e-mail com um link contendo um **token**.
3. O link abre \`/redefinir?email=…&token=…\`, onde ele escolhe a nova senha.

**Contexto:** 2 milhões de contas, muitas com cartão salvo · o atendimento também pode disparar um reset pelo **painel interno** · o login tem MFA opcional.

**Roteiro:** diagrama e fronteiras de confiança → ameaças com **STRIDE** → **priorizar** → **mitigar** → **corrigir** um trecho de código vulnerável.

> [!dica] Em entrevista de segurança, **método** vale mais que lista decorada. Mostre como você encontra as ameaças; depois aprofunde nas mais arriscadas.`,
        },
      },
      {
        type: 'say',
        mood: 'thinking',
        text: [
          'Primeiro passo: **o que estamos construindo?** Antes de caçar ameaças, desenhe o fluxo.',
          'E marque as **fronteiras de confiança** — é nelas que os problemas se concentram.',
        ],
        board: {
          title: 'O fluxo e suas fronteiras de confiança',
          md: `\`\`\`text
                   ┆ fronteira 1: internet            ┆ fronteira 2: e-mail
 [Usuário] ──POST /esqueci-senha──▶ (API de contas) ──┆──▶ [Provedor de e-mail] ──▶ caixa do usuário
                   ┆                   │    │         ┆                                  │
                   ┆             [(tokens)] [(contas)]                                   │ clica
 [Usuário] ──POST /redefinir (email, token, senha)──▶ (API de contas) ◀──────────────────┘
                   ┆                   │
                   ┆             [(sessões)] ── invalidar após a troca
 [Atendente] ──────┆──painel interno──▶ (API de contas)      ← fronteira 3: rede interna
\`\`\`

| Elemento | No diagrama |
|---|---|
| Entidades externas | usuário, atendente, provedor de e-mail — **e o atacante**, que usa as mesmas portas |
| Processos | a API de contas |
| Armazenamentos | tokens de reset, contas, sessões |
| Fluxos | cada seta — em especial as que **cruzam uma fronteira** |

As quatro perguntas guiam o resto da entrevista:

1. **O que estamos construindo?** → o diagrama acima.
2. **O que pode dar errado?** → STRIDE em cada elemento e fluxo.
3. **O que vamos fazer a respeito?** → mitigar, aceitar, transferir ou eliminar.
4. **Fizemos um bom trabalho?** → revisar, testar e repetir quando o design mudar.

> [!sabia] Essas quatro perguntas são o *Four Question Frame* de **Adam Shostack**, adotado pelo *Threat Modeling Manifesto* (2020). E o **STRIDE** é bem mais velho do que parece: nasceu na Microsoft em **1999**, num documento interno de Loren Kohnfelder e Praerit Garg, e até hoje é o ponto de partida mais usado para achar ameaças.`,
        },
      },
      {
        type: 'mcq',
        id: 'sec-ent-q1',
        concept: 'Enumeração de usuários',
        say: 'Aquecimento. Testei a sua tela de reset e anotei isto. O que você me diz?',
        prompt: 'Na tela de "Esqueci minha senha": `ana@loja.com` → *"Enviamos um link para o seu e-mail."*; `zzz@loja.com` → *"E-mail não cadastrado."* Em que categoria do STRIDE isso cai, e qual é a correção?',
        options: [
          { text: '**Information disclosure** (enumeração de usuários): responder **a mesma mensagem** — e no mesmo tempo — exista a conta ou não.', correct: true, why: 'Exato. A tela confirma quem é cliente. Com uma lista de e-mails vazados, o atacante descobre quais contas existem e mira nelas com phishing e *credential stuffing*. E o **tempo** também conta: se só o caminho da conta existente grava no banco e envia e-mail, ele é mais lento — mande o e-mail de forma assíncrona (fila).' },
          { text: '**Spoofing**: o atacante se passa pela Ana. A correção é exigir MFA no login.', why: 'Aqui ninguém se passou por ninguém: o que vazou foi a **informação** de que a conta existe. Isso pode **facilitar** um spoofing depois, mas a falha em si é de confidencialidade — e o MFA não impede a enumeração.' },
          { text: '**Denial of service**: a correção é colocar um CAPTCHA na tela.', why: 'CAPTCHA e rate limit **desaceleram** a enumeração em massa — são bons complementos —, mas cada resposta continua revelando se a conta existe. A causa é a mensagem diferente.' },
          { text: '**Repudiation**: a correção é registrar em log cada tentativa.', why: 'Logs ajudam a **detectar** a enumeração, mas não a impedem. Repúdio é alguém poder negar uma ação por falta de evidência — outro problema.' },
        ],
        explanation: 'É a **enumeração de usuários**, uma forma de *information disclosure*. A correção padrão é uma resposta única — *"Se o e-mail estiver cadastrado, você receberá um link"* — com tempo de resposta parecido nos dois caminhos. Vale checar os **outros** pontos que vazam o mesmo dado: o cadastro ("e-mail já em uso") e o login ("senha incorreta" × "usuário não existe"). No cadastro, às vezes o time **aceita** o risco por usabilidade; aí entram rate limit e monitoramento. Aceitar um risco conscientemente também é uma resposta válida da modelagem — desde que documentada.',
      },
      {
        type: 'say',
        text: [
          'Muito bem. Agora a segunda pergunta — **o que pode dar errado?** — aplicada com método: uma passada de STRIDE pelo fluxo inteiro.',
          'Cada letra é uma **propriedade** que o atacante tenta quebrar.',
        ],
        board: {
          title: 'STRIDE aplicado ao reset de senha',
          md: `| Categoria | Ameaça no reset | Propriedade violada |
|---|---|---|
| **S**poofing | token **previsível** (\`md5(email + hora)\`, \`random\`): o atacante calcula o token da vítima e toma a conta | autenticidade |
| **T**ampering | trocar o \`email\` do link, ou mandar **dois** e-mails no pedido para o link ir também para o atacante | integridade |
| **R**epudiation | "não fui eu que troquei a senha" — sem log de auditoria nem aviso ao dono da conta | não repúdio |
| **I**nformation disclosure | enumeração de usuários; token vazando no \`Referer\`, em logs de acesso ou no analytics | confidencialidade |
| **D**enial of service | um robô dispara milhares de e-mails de reset (*e-mail bombing*): custo, caixa lotada, domínio na lista de spam | disponibilidade |
| **E**levation of privilege | atendente reseta a conta de um admin pelo painel; reset que já faz login e **pula o MFA** | autorização |

> [!atencao] O "dois e-mails no pedido" não é teoria: na **CVE-2023-7028** (GitLab, janeiro de 2024, CVSS **10**), o endpoint de reset aceitava uma **lista** de e-mails e mandava o link também para um endereço não verificado, escolhido pelo atacante. Resultado: tomada de qualquer conta, sem interação da vítima.

> [!sabia] **Host header poisoning**: muitos frameworks montam URLs absolutas a partir do cabeçalho \`Host\` da requisição. O atacante pede o reset da vítima enviando \`Host: evil.com\`; o e-mail sai **legítimo**, do seu domínio, mas o link aponta para \`https://evil.com/redefinir?token=…\`. Um clique da vítima e o token chega ao atacante. Por isso o Django valida o \`ALLOWED_HOSTS\` — e o link de reset deve usar uma URL base **configurada**, nunca a da requisição.`,
        },
      },
      {
        type: 'match',
        id: 'sec-ent-q2',
        concept: 'STRIDE',
        say: 'Mostre que você domina o STRIDE: cada ameaça na sua categoria.',
        prompt: 'Associe cada **ameaça ao reset de senha** à sua **categoria do STRIDE**.',
        pairs: [
          { left: 'O atacante calcula o token porque ele é `md5(email + data)`', right: 'Spoofing' },
          { left: 'O campo oculto `user_id` do formulário é trocado pelo id de outra conta', right: 'Tampering' },
          { left: 'Não há registro de quem pediu nem de quem usou o reset', right: 'Repudiation' },
          { left: 'O token de reset aparece no log de acesso do proxy', right: 'Information disclosure' },
          { left: 'Um robô dispara 50 mil e-mails de reset por hora', right: 'Denial of service' },
          { left: 'Pelo painel interno, um atendente toma a conta de um admin', right: 'Elevation of privilege' },
        ],
        explanation: 'Um truque para classificar: pergunte **qual propriedade** foi quebrada. Token calculável → alguém **se passa** pela vítima (autenticidade). Campo alterado → **integridade** do pedido. Sem registro → ninguém **prova** quem fez (não repúdio). Token no log → **confidencialidade**. E-mails em massa → **disponibilidade**. Atendente virando admin → ganhou um poder que não tinha (**autorização**). Na prática, uma ameaça pode tocar mais de uma letra — o STRIDE é um roteiro para não esquecer nada, não uma taxonomia rígida.',
      },
      {
        type: 'say',
        text: [
          'Achar ameaças é a parte fácil; a lista sempre fica enorme. A pergunta de sênior é: **por onde começar?**',
          'Priorize pelo risco — e seja explícito sobre as suas estimativas.',
        ],
        board: {
          title: 'Priorizar: risco = probabilidade × impacto',
          md: `| Nota | Probabilidade (quão fácil explorar?) | Impacto (quão ruim se acontecer?) |
|---|---|---|
| 1 | exige acesso interno e sorte | incômodo, sem dados expostos |
| 3 | exige alguma habilidade ou condição | dados de alguns usuários |
| 5 | qualquer um, com um script pronto | **tomada de contas** em massa, dinheiro, multa regulatória |

\`\`\`text
 impacto ▲
       5 │         ● token previsível
       4 │   ● vazamento via Referer   ● token sem expiração
       2 │         ● e-mail bombing     ● enumeração
         └──────────────────────────────────────────▶ probabilidade
             2          3           4          5
\`\`\`

- As notas são **estimativas**: o valor está em discutir e registrar o raciocínio, não na casa decimal.
- Pondere também o **custo da correção**: um rate limit leva uma tarde — faça logo, mesmo que o risco seja médio.
- Para cada ameaça, uma decisão explícita: **mitigar**, **aceitar** (documentado, com dono), **transferir** (seguro, fornecedor) ou **eliminar** (remover a funcionalidade).

> [!sabia] A Microsoft também criou o **DREAD** (*Damage, Reproducibility, Exploitability, Affected users, Discoverability*), que dava nota de 1 a 10 a cada critério. Ele caiu em desuso — inclusive dentro da própria Microsoft — porque as notas mudavam muito conforme **quem** avaliava. Escalas simples e discutidas em grupo costumam funcionar melhor que fórmulas com cara de precisão.`,
        },
      },
      {
        type: 'order',
        id: 'sec-ent-q3',
        concept: 'Priorização de riscos',
        say: 'Sua vez de priorizar. Use as notas que o time estimou.',
        prompt: `Com as notas abaixo, ordene as ameaças da **mais** para a **menos** prioritária, usando **risco = probabilidade × impacto**.

| Ameaça | Probabilidade | Impacto |
|---|---|---|
| Token previsível: \`md5(email + hora)\` | 4 | 5 |
| Token sem expiração e reutilizável | 3 | 4 |
| Enumeração de usuários na tela de reset | 5 | 2 |
| Token vazando pelo \`Referer\` para um script de analytics | 2 | 4 |
| E-mail bombing: reset disparado sem limite | 3 | 2 |`,
        items: [
          'Token previsível: `md5(email + hora)`',
          'Token sem expiração e reutilizável',
          'Enumeração de usuários na tela de reset',
          'Token vazando pelo `Referer` para um script de analytics',
          'E-mail bombing: reset disparado sem limite',
        ],
        explanation: 'Os riscos ficam 20, 12, 10, 8 e 6. O token previsível lidera porque junta **alta probabilidade** (quem descobre a fórmula ataca qualquer conta, remotamente) com **impacto máximo** (tomada de conta). Repare que a enumeração, a mais **fácil** de explorar, fica no meio: sozinha ela não toma contas. Mas lembre-se do custo: o rate limit contra o e-mail bombing e o `Referrer-Policy: no-referrer` são correções de minutos — num plano real, eles entram junto com as prioridades altas.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Ótimo raciocínio. Terceira pergunta: **o que vamos fazer a respeito?**',
          'Um reset seguro é feito de várias peças pequenas — cada uma fecha uma ameaça da nossa tabela.',
        ],
        board: {
          title: 'O reset seguro, peça por peça',
          md: `| Controle | Ameaça que fecha |
|---|---|
| Token de \`secrets.token_urlsafe(32)\` (256 bits de um gerador criptográfico) | **S**: calcular ou adivinhar o token |
| Guardar só o \`sha256(token)\` no banco | **I**: um vazamento do banco não entrega tokens válidos |
| **Expira** em 15–60 min, **uso único**, e um pedido novo invalida o anterior | **S**/**I**: encurta a janela de um token vazado |
| Comparar com \`hmac.compare_digest\` | **I**: *timing attack* |
| Mesma resposta (e tempo) para qualquer e-mail | **I**: enumeração |
| Link só para o e-mail **verificado** da conta, com URL base configurada | **T**/**S**: CVE-2023-7028, Host header poisoning |
| \`Referrer-Policy: no-referrer\` na página de reset; token fora dos logs | **I**: vazamento pelo \`Referer\` |
| Rate limit por conta e por IP | **D**: e-mail bombing |
| Depois da troca: invalidar sessões, **avisar** o dono, pedir MFA no login, log de auditoria | **R**/**E** |

\`\`\`python
import hashlib, secrets

token = secrets.token_urlsafe(32)                       # vai no link — só no e-mail
guardado = hashlib.sha256(token.encode()).hexdigest()   # vai para o banco
\`\`\`

> [!atencao] \`random\` **não serve** para segredos: o Mersenne Twister é determinístico, e **624** saídas de 32 bits bastam para reconstruir o estado interno inteiro e prever todas as próximas. Tokens, senhas temporárias e chaves vêm **sempre** do módulo \`secrets\`.

> [!sabia] O padrão **selector/verifier** divide o token em duas partes: o *selector* (público) localiza o registro no banco com um \`WHERE\` comum, e o *verifier* (secreto) é conferido contra o hash guardado com \`compare_digest\`. Assim a **busca** no índice não vaza tempo sobre a parte secreta — no nosso exercício, o **e-mail** faz o papel de selector.`,
        },
      },
      {
        type: 'open',
        id: 'sec-ent-q4',
        concept: 'Mitigação de ameaças',
        say: 'Agora me convença: como você fecharia as ameaças mais prioritárias?',
        prompt: 'Proponha mitigações concretas para as três ameaças mais prioritárias — **token previsível**, **token sem expiração e reutilizável** e **enumeração de usuários** — e diga o que mais o sistema deve fazer **depois** que a senha é trocada.',
        minWords: 35,
        rubric: [
          { label: 'Token **imprevisível**, de um gerador criptográfico (`secrets`), de preferência guardado como hash', keywords: ['secrets', 'token_urlsafe', 'token_hex', 'token_bytes', 'csprng', 'criptograficamente', 'gerador criptografico', 'imprevis', 'aleatorio seguro', 'aleatoriedade', '128 bits', '256 bits', 'entropia', 'urandom'], concept: 'Geração de tokens', why: 'Um token vindo de `secrets` (256 bits) não pode ser calculado nem adivinhado; guardar só o hash impede que um vazamento do banco entregue tokens válidos.' },
          { label: 'Token que **expira** em minutos e é de **uso único**', keywords: [['expir', 'unico'], ['expir', 'uma vez'], ['expir', 'invalid'], ['expir', 'descart'], ['expir', 'apag'], ['expir', 'one-time'], ['ttl', 'unico'], ['validade', 'unico'], ['minutos', 'unico'], ['expir', 'reutiliz'], ['expir', 'consumid']], concept: 'Token de uso único', why: 'A expiração limita a janela em que um token vazado (log, e-mail encaminhado) serve; o uso único impede que ele seja reaproveitado depois.' },
          { label: '**Mesma resposta** para qualquer e-mail (anti-enumeração), com **rate limit**', keywords: ['mesma mensagem', 'mesma resposta', 'mensagem generica', 'resposta generica', 'mensagem unica', 'resposta unica', 'resposta identica', 'mensagem identica', 'mensagem neutra', 'resposta neutra', 'se o e-mail', 'se o email', 'rate limit', 'limite de tentativas', 'limitar tentativas', 'limitar pedidos', 'limite de pedidos'], concept: 'Anti-enumeração', why: 'Uma resposta única não revela quais contas existem; o rate limit contém tanto a enumeração pelo tempo quanto o e-mail bombing.' },
          { label: 'Depois da troca: **invalidar sessões**, **avisar** o usuário, auditar', keywords: ['sess', 'notific', 'avisar', 'aviso', 'alerta', 'audit', 'deslog', 'logout', 'revogar', 'revogue', 'mfa'], concept: 'Pós-reset', why: 'Se a conta foi tomada, as sessões do atacante precisam cair; o aviso ao dono (no e-mail antigo) transforma um ataque silencioso num incidente detectável, e a auditoria resolve o repúdio.' },
        ],
        modelAnswer: `**Token previsível:** gero o token com \`secrets.token_urlsafe(32)\` — 256 bits de um gerador criptográfico, impossível de calcular a partir do e-mail ou da hora — e guardo no banco só o \`sha256\` dele, comparando com \`hmac.compare_digest\`.

**Sem expiração e reutilizável:** cada token **expira** em 15 minutos, é de **uso único** (apagado assim que a senha é trocada) e um pedido novo invalida o anterior.

**Enumeração:** a tela responde sempre a **mesma mensagem** — "se o e-mail estiver cadastrado, você receberá um link" —, o envio vai para uma fila para o tempo de resposta não denunciar a conta, e há **rate limit** por conta e por IP, que também segura o e-mail bombing.

**Depois da troca:** invalido todas as **sessões** abertas e os outros tokens da conta, **aviso** o usuário por e-mail de que a senha mudou (com um caminho para reportar se não foi ele), continuo exigindo **MFA** no próximo login e registro o evento num log de **auditoria**.`,
      },
      {
        type: 'code',
        id: 'sec-ent-q5',
        concept: 'Reset de senha seguro',
        title: 'Conserte o reset de senha',
        say: 'Parte prática. Este reset passou na revisão de alguém — e tem pelo menos quatro vulnerabilidades. Os testes incluem ataques de verdade.',
        prompt: `A classe \`ServicoReset\` abaixo é vulnerável. Corrija-a para que cumpra este contrato:

- \`ServicoReset(usuarios, enviar_email, trocar_senha, relogio=time.time)\`: \`usuarios\` é o conjunto de e-mails cadastrados; \`enviar_email(email, token)\` entrega o link; \`trocar_senha(email, nova_senha)\` efetiva a troca; \`relogio()\` devolve o "agora" em segundos (nos testes, um relógio falso).
- \`solicitar(email)\` devolve **sempre** \`MENSAGEM\`, exista a conta ou não. Só para e-mail cadastrado, gera um token **imprevisível** (use \`secrets\`, com pelo menos 32 caracteres) e chama \`enviar_email\`. Um pedido novo **invalida** o token anterior daquela conta.
- O serviço **nunca guarda o token em texto puro** — só o hash (\`hashlib.sha256\`).
- \`redefinir(email, token, nova_senha) -> bool\`: \`True\` (e chama \`trocar_senha\`) só se o token for o **último** emitido para **aquele** e-mail, **não expirou** (vale enquanto \`relogio() < emissão + VALIDADE\`) e **não foi usado** — compare os hashes com \`hmac.compare_digest\`. Qualquer outro caso → \`False\`, sem exceção. Uma tentativa com token errado **não** invalida o token certo.`,
        starter: `import hashlib
import hmac
import secrets
import time

VALIDADE = 15 * 60  # segundos
MENSAGEM = "Se o e-mail estiver cadastrado, você receberá um link em instantes."


class ServicoReset:
    """Reset de senha. ATENÇÃO: este código tem vulnerabilidades — corrija-as."""

    def __init__(self, usuarios, enviar_email, trocar_senha, relogio=time.time):
        self.usuarios = usuarios            # conjunto de e-mails cadastrados
        self.enviar_email = enviar_email    # enviar_email(email, token)
        self.trocar_senha = trocar_senha    # trocar_senha(email, nova_senha)
        self.relogio = relogio
        self.tokens = {}                    # email -> token

    def solicitar(self, email):
        if email not in self.usuarios:
            return "E-mail não cadastrado."
        token = hashlib.md5(f"{email}{int(self.relogio())}".encode()).hexdigest()
        self.tokens[email] = token
        self.enviar_email(email, token)
        return MENSAGEM

    def redefinir(self, email, token, nova_senha):
        if self.tokens.get(email) == token:
            self.trocar_senha(email, nova_senha)
            return True
        return False
`,
        tests: [
          {
            name: 'fluxo feliz: o token chega por e-mail e troca a senha',
            code: AUX + `
servico, enviados, trocas, _ = _servico()
resposta = servico.solicitar("ana@loja.com")
assert resposta == MENSAGEM, f"solicitar deve devolver MENSAGEM, veio {resposta!r}"
assert len(enviados) == 1 and enviados[0][0] == "ana@loja.com", f"esperado um e-mail para ana@loja.com, enviados = {enviados!r}"
token = enviados[0][1]
assert isinstance(token, str), f"o token deve ser str, veio {type(token).__name__}"
assert servico.redefinir("ana@loja.com", token, "N0va-Senha!") is True, "o token recém-emitido deveria ser aceito"
assert trocas == [("ana@loja.com", "N0va-Senha!")], f"trocar_senha deveria ser chamado uma vez; chamadas = {trocas!r}"`,
          },
          {
            name: 'mesma resposta para e-mail cadastrado e não cadastrado (sem enumeração)',
            code: AUX + `
servico, enviados, _, _ = _servico()
r1 = servico.solicitar("ana@loja.com")
r2 = servico.solicitar("zzz@loja.com")
assert r1 == r2 == MENSAGEM, f"as respostas revelam quem tem conta: {r1!r} × {r2!r}. Devolva sempre MENSAGEM"
destinos = [email for email, _ in enviados]
assert destinos == ["ana@loja.com"], f"só a conta existente recebe e-mail; enviados para {destinos!r}"`,
          },
          {
            name: 'token imprevisível: pedidos no mesmo instante geram tokens diferentes e longos',
            code: AUX + `
servico, enviados, _, _ = _servico()
servico.solicitar("ana@loja.com")
servico.solicitar("ana@loja.com")          # mesmo e-mail, mesmo instante
outro, enviados2, _, _ = _servico()
outro.solicitar("ana@loja.com")            # outra instância, mesmo instante
t1, t2, t3 = enviados[0][1], enviados[1][1], enviados2[0][1]
assert len({t1, t2, t3}) == 3, "tokens repetidos para o mesmo e-mail no mesmo instante: o token é derivado de dados previsíveis (e-mail, hora, contador). Use secrets"
assert len(t1) >= 32, f"token curto demais ({len(t1)} caracteres): use secrets.token_urlsafe(32)"`,
          },
          {
            name: 'token de uso único',
            code: AUX + `
servico, enviados, trocas, _ = _servico()
servico.solicitar("ana@loja.com")
token = enviados[0][1]
assert servico.redefinir("ana@loja.com", token, "primeira") is True, "o primeiro uso deveria funcionar"
assert servico.redefinir("ana@loja.com", token, "segunda") is False, "o token foi aceito DUAS vezes: ele precisa ser de uso único"
assert trocas == [("ana@loja.com", "primeira")], f"trocas = {trocas!r}"`,
          },
          {
            name: 'o token expira (relógio injetado)',
            code: AUX + `
servico, enviados, _, relogio_ = _servico(agora=1000)
servico.solicitar("ana@loja.com")
relogio_[0] = 1000 + 10 * 60
assert servico.redefinir("ana@loja.com", enviados[0][1], "nova") is True, "10 minutos depois o token ainda vale (VALIDADE = 15 min)"
servico, enviados, trocas, relogio_ = _servico(agora=1000)
servico.solicitar("ana@loja.com")
relogio_[0] = 1000 + 30 * 60
assert servico.redefinir("ana@loja.com", enviados[0][1], "nova") is False, "30 minutos depois o token deveria ter expirado"
assert trocas == [], "um token expirado não pode trocar a senha"`,
          },
          {
            name: 'no instante exato da expiração o token já não vale',
            hidden: true,
            code: AUX + `
servico, enviados, _, relogio_ = _servico(agora=1000)
servico.solicitar("ana@loja.com")
relogio_[0] = 1000 + VALIDADE - 1
assert servico.redefinir("ana@loja.com", enviados[0][1], "nova") is True, "1 segundo antes de expirar o token ainda vale"
servico, enviados, _, relogio_ = _servico(agora=1000)
servico.solicitar("ana@loja.com")
relogio_[0] = 1000 + VALIDADE
assert servico.redefinir("ana@loja.com", enviados[0][1], "nova") is False, "em emissão + VALIDADE o token já expirou (vale enquanto relogio() < emissão + VALIDADE)"`,
          },
          {
            name: 'o token de uma conta não troca a senha de outra',
            hidden: true,
            code: AUX + `
servico, enviados, trocas, _ = _servico()
servico.solicitar("ana@loja.com")
token_da_ana = enviados[0][1]
assert servico.redefinir("bia@loja.com", token_da_ana, "hackeada") is False, "o token da Ana trocou a senha da Bia!"
assert trocas == [], f"trocas = {trocas!r}"
assert servico.redefinir("ana@loja.com", token_da_ana, "nova") is True, "a tentativa na conta errada não deveria invalidar o token da Ana"`,
          },
          {
            name: 'um pedido novo invalida o token anterior',
            hidden: true,
            code: AUX + `
servico, enviados, trocas, _ = _servico()
servico.solicitar("ana@loja.com")
servico.solicitar("ana@loja.com")
antigo, novo = enviados[0][1], enviados[1][1]
assert servico.redefinir("ana@loja.com", antigo, "x") is False, "o token antigo continuou valendo depois de um pedido novo"
assert servico.redefinir("ana@loja.com", novo, "y") is True, "o token mais recente deveria valer"
assert trocas == [("ana@loja.com", "y")], f"trocas = {trocas!r}"`,
          },
          {
            name: 'o serviço guarda só o hash, nunca o token em texto puro',
            hidden: true,
            code: AUX + `
servico, enviados, _, _ = _servico()
servico.solicitar("ana@loja.com")
token = enviados[0][1]
assert not _contem(vars(servico), token), "o token em texto puro está guardado no serviço: um vazamento do banco entregaria tokens válidos. Guarde só o hashlib.sha256 dele"
assert not _contem(dict(vars(type(servico))), token), "o token em texto puro está guardado num atributo de classe"`,
          },
          {
            name: 'token errado, vazio ou conta sem pedido → False, sem queimar o token certo',
            hidden: true,
            code: AUX + `
servico, enviados, trocas, _ = _servico()
assert servico.redefinir("ana@loja.com", "qualquer-coisa", "x") is False, "sem pedido de reset, nenhum token vale"
servico.solicitar("ana@loja.com")
token = enviados[0][1]
for errado in ["", "x" * 43, token[:-1], token + "a", token.upper() if token.upper() != token else token.lower()]:
    assert servico.redefinir("ana@loja.com", errado, "x") is False, f"o token errado {errado[:12]!r}… foi aceito"
assert servico.redefinir("zzz@loja.com", token, "x") is False, "e-mail sem conta → False"
assert trocas == [], f"trocas = {trocas!r}"
assert servico.redefinir("ana@loja.com", token, "certa") is True, "tentativas erradas não devem invalidar o token certo (senão qualquer um bloqueia o reset alheio)"`,
          },
        ],
        reviews: [
          {
            when: m => !m.calls.includes('compare_digest'),
            text: 'Você comparou os hashes sem `hmac.compare_digest`. O `==` para no **primeiro byte diferente**, então o tempo de resposta vaza quantos bytes do valor esperado o atacante já acertou (*timing attack*). O `compare_digest` leva o mesmo tempo, acertando ou errando.',
            concept: 'Comparação em tempo constante',
          },
          {
            when: m => m.imports.includes('random'),
            text: 'Você importou `random`. O Mersenne Twister **não** é criptográfico: com 624 saídas observadas dá para reconstruir o estado e prever os próximos tokens. Para segredos, use sempre `secrets` (`token_urlsafe`, `token_hex`).',
            concept: 'Gerador criptográfico',
          },
          {
            when: m => m.calls.includes('md5') || m.calls.includes('sha1') || m.calls.includes('uuid1'),
            text: 'Você ainda usa `md5`, `sha1` ou `uuid1`. Hash de dados previsíveis (e-mail, horário) continua previsível — quem descobre a fórmula calcula o token. E o `uuid1` é montado com o horário e o endereço MAC da máquina. O token deve vir de `secrets`; o hash (`sha256`) serve só para **guardá-lo**.',
            concept: 'Token imprevisível',
          },
          {
            when: m => m.calls.includes('time') && m.imports.includes('time'),
            text: 'Você chamou `time.time()` dentro da lógica. Use o `relogio` injetado: é ele que permite testar "um segundo antes" e "no instante exato" da expiração sem esperar 15 minutos.',
            concept: 'Injeção de relógio',
          },
        ],
        hints: [
          '**Enumeração:** `solicitar` devolve `MENSAGEM` em qualquer caso; só gere token e chame `enviar_email` se `email in self.usuarios`.',
          '**Token:** `token = secrets.token_urlsafe(32)`. Guarde, por e-mail, só `(hashlib.sha256(token.encode()).hexdigest(), self.relogio() + VALIDADE)` — um dicionário `email -> (hash, expira_em)` faz o pedido novo substituir o antigo naturalmente. O token em claro só vai para `enviar_email`.',
          '**Redefinir, nesta ordem:** existe pedido para o e-mail? → `self.relogio() >= expira_em` significa expirado → `hmac.compare_digest(sha256(token_recebido), hash_guardado)`; se não bater, `False` **sem** apagar o pedido → se bater, apague o pedido (**uso único**) e só então chame `trocar_senha`.',
        ],
        solution: `import hashlib
import hmac
import secrets
import time

VALIDADE = 15 * 60  # segundos
MENSAGEM = "Se o e-mail estiver cadastrado, você receberá um link em instantes."


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class ServicoReset:
    def __init__(self, usuarios, enviar_email, trocar_senha, relogio=time.time):
        self.usuarios = usuarios
        self.enviar_email = enviar_email
        self.trocar_senha = trocar_senha
        self.relogio = relogio
        self._pedidos = {}                  # email -> (sha256 do token, expira_em)

    def solicitar(self, email):
        if email in self.usuarios:
            token = secrets.token_urlsafe(32)                    # 256 bits de um CSPRNG
            self._pedidos[email] = (_hash(token), self.relogio() + VALIDADE)   # substitui o anterior
            self.enviar_email(email, token)                      # em claro, só no e-mail
        return MENSAGEM                                          # a mesma resposta, sempre

    def redefinir(self, email, token, nova_senha):
        pedido = self._pedidos.get(email)
        if pedido is None:
            return False
        hash_guardado, expira_em = pedido
        if self.relogio() >= expira_em:
            del self._pedidos[email]                             # expirado: limpa
            return False
        if not hmac.compare_digest(_hash(token), hash_guardado):
            return False                                         # errar não queima o token
        del self._pedidos[email]                                 # uso único
        self.trocar_senha(email, nova_senha)
        return True
`,
        solutionExplanation: 'Cada linha fecha uma ameaça do modelo. `solicitar` devolve **sempre** a mesma mensagem (sem enumeração) e gera o token com `secrets.token_urlsafe(32)` — 256 bits que ninguém calcula a partir do e-mail ou da hora. O dicionário guarda, por e-mail, só o **SHA-256** do token e o instante de expiração: um vazamento do banco não entrega tokens válidos, e um pedido novo sobrescreve o antigo. Em `redefinir`, a ordem importa: sem pedido ou **expirado** (`>=`, porque o token vale enquanto o agora é **anterior** ao limite) → `False`; hash diferente → `False` **sem** apagar o pedido (senão qualquer um bloquearia o reset alheio chutando tokens); hash igual → o pedido é apagado **antes** da troca (uso único). A comparação é com `hmac.compare_digest`. Por que SHA-256 e não scrypt? Porque o token tem 256 bits aleatórios: não existe dicionário para testar, e hash lento só compensa para entradas previsíveis como senhas humanas. Em produção, somam-se rate limit, a URL base configurada no link, o aviso ao dono da conta e a invalidação das sessões.',
      },
      {
        type: 'mcq',
        id: 'sec-ent-q6',
        concept: 'Hash de tokens',
        say: 'Follow-up, para fechar. Esta pergunta separa quem decorou de quem entendeu.',
        prompt: 'Para guardar **senhas**, exigimos um hash **lento** com salt (scrypt, bcrypt, Argon2). No reset, você guardou o token com um simples **SHA-256**. Por que isso é aceitável?',
        options: [
          { text: 'Porque o token tem **256 bits aleatórios**: não há dicionário nem força bruta viável contra ele. O hash lento só compensa quando a entrada é **previsível**, como uma senha escolhida por uma pessoa.', correct: true, why: 'Exato. O custo do scrypt existe para tornar caro testar bilhões de senhas **prováveis**. Contra 2²⁵⁶ possibilidades uniformes, até um hash rápido é inviável de reverter — o mesmo raciocínio vale para API keys.' },
          { text: 'Porque SHA-256 é mais seguro que scrypt.', why: 'Não é uma questão de "mais seguro": são ferramentas para problemas diferentes. Para senhas, a **velocidade** do SHA-256 é justamente o defeito — uma GPU testa bilhões de palpites por segundo.' },
          { text: 'Porque o token expira em 15 minutos — nem precisaria de hash.', why: 'Precisa, sim: um vazamento do banco (backup, réplica, SQL injection) **durante** a validade entregaria tokens prontos para tomar contas. O hash custa quase nada e fecha essa porta.' },
          { text: 'Porque com scrypt não daria para comparar em tempo constante.', why: 'Dá, sim: `hmac.compare_digest` compara quaisquer bytes, venham de onde vierem. O motivo real é a entropia do token.' },
        ],
        explanation: 'A escolha do hash depende da **entropia da entrada**. Senhas humanas são previsíveis — "Verao2024!" está em qualquer dicionário —, então o hash precisa ser lento e ter salt para encarecer cada palpite. Tokens de `secrets` são uniformes: com 256 bits, a força bruta é inviável seja qual for a velocidade do hash, e o SHA-256 ainda permite buscar e comparar rápido. O ponto que **não** se negocia é guardar o token **em claro**: aí o banco vira uma lista de chaves de contas alheias.',
      },
      {
        type: 'say',
        mood: 'happy',
        text: [
          'Entrevista encerrada — e foi muito boa! Você mostrou método: diagrama, STRIDE, prioridade, mitigação e código corrigido com teste de ataque.',
          { text: 'O feedback que eu daria: modelagem de ameaças não é um documento, é um hábito. Faça as quatro perguntas a cada funcionalidade nova, e o atacante encontra a porta fechada.', mood: 'cheer' },
        ],
        board: null,
      },
    ],
  });
})();
