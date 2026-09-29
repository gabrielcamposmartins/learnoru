# Code Interview Quest

Jogo web de perguntas e respostas para aprender engenharia de software em **Python**.
Um personagem (instrutor/entrevistador) ensina os conceitos numa caixa de diálogo estilo RPG,
mostra exemplos no quadro e depois aplica atividades de fixação e entrevistas técnicas:
múltipla escolha, respostas abertas e **código Python executado de verdade no navegador** (Pyodide).

- 12 trilhas: Design Patterns (GoF completo + idiomas pythônicos), Algoritmos & LeetCode, Arquitetura
  (com DDD, CQRS, sagas), Testes em Python, **APIs & Integração**, Bancos de Dados, Concorrência & Async,
  Python Avançado, Clean Code, Observabilidade & SRE, Segurança e Sistemas Distribuídos — organizadas em capítulos
- 10 tipos de atividade: múltipla escolha, resposta aberta, **ordenar**, **associar**, código Python testado,
  **SQL de verdade** (SQLite no navegador), escrever testes com **pytest** (avaliados por *mutation testing*)
  e ciclos de **TDD** guiados (🔴 Red → 🟢 Green → 🔵 Refactor)
- **Glossário** com os termos de todas as trilhas: nos quadros das aulas eles aparecem sublinhados, com a
  definição ao passar o mouse; cada módulo destaca algo pouco conhecido em "💡 Você sabia?"
- Pontuação (XP), níveis, 0–3 ★ por questão e por módulo, **sequência de dias**, meta diária e 21 **conquistas**
- Review ao final: o que poderia ser melhor em cada questão e **qual conceito** estudar; página **Revisão**
  com os conceitos fracos e um **caderno** com os principais pontos de cada aula
- Busca global (**Ctrl+K**) por módulos, trilhas e termos
- **Perguntar à Lia** (tecla **?**): um assistente com Claude que vê o que está na sua tela — quadro, questão,
  seu código — e conhece todo o conteúdo da plataforma. A Lia responde falando, como numa explicação, e em
  questões ainda não respondidas dá pistas em vez da resposta. Usa o seu plano do Claude (`claude -p`) ou
  uma chave de API, o que estiver disponível
- **Checkpoints**: cada atividade concluída fica salva. Ao sair no meio de um módulo, da próxima vez a Lia
  pergunta se você quer continuar da atividade seguinte ou recomeçar — sem refazer o que já fez
- Na explicação dá para **voltar** fala a fala (inclusive para o quadro anterior) e **pular** direto para a
  próxima atividade — a Lia não fica muito feliz na primeira vez 😠
- Dois temas em Configurações → Aparência: **Moderno** e **Retrofuturista** (neon, grade no horizonte,
  linhas de CRT opcionais) com 5 paletas: Synthwave, Tron, Vaporwave, Fósforo verde e Âmbar
- Testes de desempenho (detecta O(n²) quando existe O(n)) e análise do código via `ast` (complexidade, aninhamento…)
- Progresso salvo no `localStorage`

## Como rodar

Não há build. No Windows, dê dois cliques em **`tools/iniciar.bat`** (ou no atalho "Code Interview Quest"
da área de trabalho): ele sobe o servidor e abre o jogo no navegador. Fechar a janela do servidor desliga o jogo.

Pelo terminal:

```bash
python tools/serve.py 8000 --open   # sem cache: edições aparecem ao recarregar
```

Se a porta estiver ocupada por outro programa, o servidor usa a próxima livre; se o jogo já estiver
rodando, `--open` só abre o navegador.

Qualquer servidor estático também serve (`python -m http.server 8000`), mas aí o navegador pode
manter JS antigo em cache — use Ctrl+F5 depois de editar.

Abrir o `index.html` direto do disco também funciona na maioria dos navegadores.
Na primeira questão de código o Pyodide (~10 MB) é baixado do CDN; depois fica em cache.

Atalhos: **Ctrl+K** busca · **?** pergunta à Lia · **Espaço/Enter/→** avança o diálogo · **←** volta uma fala · **Shift+→** pula a
explicação · **Ctrl+Enter** executa o código · **Ctrl+Shift+Enter** envia.

## Assistente — Perguntar à Lia

Na tela inicial e durante as aulas, o botão **Perguntar à Lia** (ou a tecla **?**) abre um painel de conversa.
A pergunta vai com o contexto do que está em foco: o quadro ou a questão atual, o código nos editores, as
últimas falas, o módulo inteiro, trechos relacionados de outros módulos e do glossário, o seu progresso e o
catálogo de trilhas. A resposta aparece no painel (com código, se houver) e a Lia a **fala** na caixa de
diálogo — digitando, com voz e com voltar/pular; depois a aula continua de onde estava.

O acesso ao Claude é detectado sozinho pelo servidor local (`tools/serve.py` → `tools/assistant.py`):

| Ordem | Acesso | Como ativar |
|---|---|---|
| 1 | **Claude Code local** (`claude -p`) — usa o **seu plano** do Claude | instale o Claude Code e faça login rodando `claude` uma vez |
| 2 | **Chave de API** da Anthropic | variável `ANTHROPIC_API_KEY` ou Configurações → Assistente |

- Em Configurações → Assistente dá para fixar o modo (automático, só Claude local, só API) e o modelo
  (Claude Opus 5.5 por padrão; Sonnet 5 e Haiku 4.5 respondem mais rápido).
- A chave de API fica só em `~/.code-interview-quest/assistant.json` — nunca no navegador nem no repositório.
- O `claude -p` roda **sem nenhuma ferramenta** (`--tools ""`), sem MCP e sem sessão salva: o modelo só conversa.
- A API local só atende o próprio jogo: exige `Host`/`Origin` locais e um cabeçalho próprio, então outros sites
  abertos no navegador não conseguem usá-la.
- O assistente precisa do servidor do jogo (o atalho ou `python tools/serve.py`); aberto de outro jeito, o
  painel explica o que fazer.

## Estrutura

```
index.html
css/main.css             tema moderno (padrão)
css/retro.css            tema retrofuturista e paletas (ativado por <html data-theme="retro">)
js/
  core/      registry (API de extensão, glossário, unidades), storage, theme, scoring, achievements,
             assistant (cliente da API local e contexto enviado ao Claude),
             python-runner (Pyodide em Web Worker: testes, pytest, SQL, análise AST), markdown
  ui/        shell (barra lateral/topo), character (sprites ou SVG), dialog, editor (CodeMirror),
             widgets, icons, glossary (termos sublinhados), palette (Ctrl+K), confetti,
             ask-panel (painel "Perguntar à Lia")
  steps/     tipos de etapa: say, section, mcq, open, order, match, code, sql, pytest, tdd
  screens/   home, track, session, results, glossary, review, achievements
  app.js     roteamento e carregamento do conteúdo
content/
  manifest.js            lista de arquivos de conteúdo (ordem de carga)
  characters.js          personagens
  assets/                sprites da Lia (cores harmonizadas) e originais/ (arquivos sem ajuste)
  tracks/<trilha>/_track.js e um arquivo por módulo
docs/AUTHORING.md        guia completo para escrever módulos (formato, qualidade, restrições)
```

## Adicionando conteúdo

> O guia completo — todos os tipos de etapa, campos `unit`, `takeaways` e `glossary`, restrições do
> ambiente (Python 3.12/Pyodide, SQLite 3.39) e checklist de qualidade — está em **`docs/AUTHORING.md`**.

1. Crie o arquivo (ex.: `content/tracks/design-patterns/09-command.js`).
2. Adicione o caminho em `content/manifest.js`.

### Nova trilha

```js
Game.registerTrack({
  id: 'testes',
  title: 'Testes Automatizados',
  icon: '🧪',
  color: '#f472b6',
  character: 'lia',          // id de um personagem
  characterRole: 'Instrutora · Testes',   // opcional: papel do personagem nesta trilha
  side: 'right',             // opcional: lado da tela nesta trilha
  lines: { correct: ['…'] }, // opcional: falas de reação próprias da trilha
  description: 'pytest, mocks, TDD…',
  intro: ['Fala de boas-vindas da trilha.'],
});
```

### Novo personagem

Com **sprites** (imagens do busto, uma por expressão — ex.: `content/assets/*.png`, proporção 2:3):

```js
Game.registerCharacter({
  id: 'lia', name: 'Lia', role: 'Instrutora', side: 'right', voicePitch: 640,
  sprites: {
    idle: 'content/assets/idle.png',             // parada, boca fechada (padrão)
    explaining: 'content/assets/explaining.png', // mesma pose, boca aberta
    waiting: 'content/assets/waiting.png',       // aguardando a resposta do jogador
    cheering: 'content/assets/cheering.png',     // comemorando acertos
    worried: 'content/assets/worried.png',       // preocupada com erros
    happy: 'content/assets/happy.png',           // sorrindo (saudações, elogios)
    angry: 'content/assets/angry.png',           // bronca bem-humorada (ex.: pular a explicação)
  },
  // opcionais (valores padrão):
  // moods: { neutral: 'idle', happy: 'happy', thinking: 'waiting', surprised: 'explaining',
  //          concerned: 'worried', cheer: 'cheering', angry: 'angry' },
  // talk: ['idle', 'explaining'],                        // alternados enquanto fala
  // talkingMoods: ['neutral', 'thinking', 'surprised'],  // humores que usam o ciclo de fala
});
```

Fluxo: enquanto o texto é digitado, a personagem alterna `idle` ↔ `explaining`; ao terminar, fica no
sprite do humor (nas questões, `waiting`). Acertos com 3★ usam `cheering` e erros usam `worried`.
Sprite ausente cai no `idle` (sem `happy`, o humor happy usa o ciclo de fala).

As cores dos sprites são harmonizadas a partir do `idle.png` (mesmo tom de cabelo, pele, terno e fundo):

```bash
python tools/harmonize_sprites.py content/assets/originais content/assets   # requer numpy e Pillow
```

Ao trocar ou adicionar uma imagem, coloque o arquivo original em `content/assets/originais/`, inclua o nome
na lista `NAMES` do script e rode de novo (ele sempre parte dos originais, então não acumula ajustes).

Ou desenhado em **SVG** (sem precisar de arte):

```js
Game.registerCharacter({
  id: 'bia', name: 'Bia', role: 'Tech Lead', side: 'right', voicePitch: 600,
  look: { skin: '#e0ac69', hair: '#2d1b10', hairStyle: 'long', eyes: '#3b2414',
          jacket: '#1e3a8a', shirt: '#e0e7ff', accent: '#60a5fa', glasses: false, accessory: 'earrings' },
  lines: { correct: ['Boa!'], wrong: ['Hmm…'] },   // opcional
});
```

`hairStyle`: `short | bob | long | bun | curly | buzz` · `accessory`: `headset | earrings | pencil` · `beard`, `glasses`: bool.

### Novo módulo (aula ou entrevista)

```js
Game.registerModule('design-patterns', {
  id: 'command',
  title: 'Command',
  kind: 'lesson',            // 'lesson' | 'interview' | 'challenge'
  level: 2,                  // 1 fácil · 2 médio · 3 difícil
  order: 9,
  summary: 'Encapsular uma ação como objeto.',
  concepts: ['Command', 'Desfazer/Refazer'],
  steps: [ /* etapas abaixo */ ],
});
```

### Tipos de etapa

**say** — fala do personagem + quadro opcional (markdown com código Python realçado):

```js
{ type: 'say', mood: 'happy', text: ['linha 1', { text: 'linha 2', mood: 'thinking' }],
  board: { title: 'Título', md: 'markdown…', code: 'print(1)', caption: 'legenda' } }   // board: null limpa
```

Humores: `neutral | happy | thinking | surprised | concerned | cheer` (`cheer` = comemoração; use com moderação).
Markdown do quadro: títulos, listas, tabelas, blocos ```` ```python ````, `> [!dica]` / `> [!atencao]`.

**section** — cartão de transição: `{ type: 'section', title: 'Atividades de fixação', subtitle: '…', icon: '🎯' }`

**mcq** — múltipla escolha (3★ de primeira, 2★ na segunda, 1★ depois):

```js
{ type: 'mcq', id: 'id-unico', concept: 'Conceito', say: 'fala', prompt: 'markdown',
  options: [{ text: 'A', correct: true, why: 'por quê' }, { text: 'B', why: 'por que não' }],
  multiple: false, shuffle: false, explanation: 'markdown', points: 10 }
```

**open** — resposta aberta corrigida por rubrica (≥80% dos critérios = 3★):

```js
{ type: 'open', id, concept, say, prompt, minWords: 10,
  rubric: [{ label: 'Cita acoplamento', keywords: ['acopla', ['depende', 'concret']], concept: 'Acoplamento', why: '…' }],
  modelAnswer: 'markdown' }
```

Cada critério é atendido se **qualquer** keyword aparecer (sem acento/maiúscula, casa prefixos);
uma keyword em array exige **todas** as partes.

**code** — código Python testado com Pyodide:

```js
{ type: 'code', id, concept, title, say, prompt, starter: 'def f(x):\n    pass\n',
  tests: [
    { name: 'exemplo', expr: 'f([1, 2])', expected: '3' },                 // compara resultado
    { name: 'ordem livre', expr: 'g()', expected: '[1, 2]', compare: 'sorted' },
    { name: 'asserts', code: 'assert f([]) == 0' },                          // código livre
    { expr: 'f([5])', expected: '5', hidden: true },                         // teste oculto
  ],
  perfTests: [{ name: 'n = 10⁵', setup: 'xs = list(range(100000))', expr: 'f(xs)', expected: '…', maxMs: 300 }],
  slowConcept: 'Hash Map — busca O(1)',
  reviews: [{ when: (m, code) => m.loopDepth >= 2, text: 'Loops aninhados → O(n²).', concept: 'Complexidade' }],
  hints: ['markdown'], solution: 'código', solutionExplanation: 'markdown', timeoutMs: 8000 }
```

- `compare`: `eq` (padrão) · `sorted` · `set` · `approx` · `nested_sorted` · `truthy` · `is`
- Estrelas: começa em 3★ e perde 1 por: desempenho lento, review acionado, uso de dicas, 3+ envios com falha (mín. 1★ se resolveu; 0★ se viu a solução).
- Métricas `m` para os reviews (via `ast`): `loopDepth`, `loops`, `whileTrue`, `recursion`, `functions`,
  `classes` (`[{name, bases, methods}]`), `calls`, `names`, `attributes`, `imports`, `decorators`,
  `comprehensions`, `lambdas`, `usesGlobal`, `tryBlocks`, `returns`, `yields`, `lines`.

**pytest** — o jogador **escreve os testes**; avaliação por *mutation testing* (o pytest roda no navegador):

```js
{ type: 'pytest', id, concept, title, say, prompt,
  module: 'frete',                                   // arquivos frete.py e test_frete.py
  implementation: 'def frete(peso): ...',            // código correto, mostrado ao jogador
  starter: 'from frete import frete\n\n\ndef test_...():\n    ...\n',
  minTests: 3,
  mutants: [{ name: 'limite 1 kg', code: 'versão com bug', why: 'por que importa', concept: 'Valores-limite' }],
  reviews: [{ when: m => !m.decorators.includes('parametrize'), text: '…', concept: 'parametrize' }],  // métricas do arquivo de TESTE
  hints, solution: 'testes de referência', solutionExplanation }
```

- Os testes precisam **passar** no código correto e **falhar** em cada mutante. Bugs não detectados viram review.
- Estrelas: 3★ − 1 se algum mutante sobreviveu (−2 se sobreviveram mais de 40%) − 1 por review/dicas/3+ envios inválidos.

**tdd** — um ciclo de TDD guiado; ciclos com o mesmo `kata` continuam o código do ciclo anterior:

```js
{ type: 'tdd', id, concept, title, say, prompt: 'requisito',
  kata: 'fizzbuzz', module: 'fizzbuzz',
  testStarter: '…', implStarter: '…',               // só no 1º ciclo do kata
  stub: 'def fizzbuzz(n):\n    return None\n',       // 1º ciclo: o teste também precisa falhar nele
  reference: 'implementação correta do ciclo',       // padrão: solutionImpl
  checks: [{ name, expr, expected } | { name, code }],   // ocultos: barram "fake it" no fim do ciclo
  refactorTip: 'markdown', reviews: [...],           // métricas da IMPLEMENTAÇÃO
  hints, solutionTests: 'suíte acumulada', solutionImpl, solutionExplanation }
```

- 🔴 **Red**: o teste precisa falhar no código atual (e no `stub`) e passar na `reference`.
- 🟢 **Green**: os testes do jogador e os `checks` precisam passar.
- 🔵 **Refactor**: tudo continua verde; `reviews` descontam estrelas se sobrarem ao concluir.

### Validando o conteúdo

```bash
pip install pytest                       # necessário para questões pytest/tdd
node tools/validate-content.js           # tudo
node tools/validate-content.js testing   # só uma trilha/módulo
```

Roda cada solução de referência em Python: questões `code` passam nos testes, testes de referência
matam todos os mutantes, ciclos TDD ficam vermelhos → verdes, soluções não acionam os próprios reviews.
Para usar outro interpretador: `CIQ_PYTHON=/caminho/python node tools/validate-content.js`.

O validador usa o seu Python local; o jogo roda no **Pyodide** (Python 3.12, SQLite 3.39). Para conferir
que as soluções também funcionam lá, abra o jogo e rode no console do navegador:

```js
await SelfCheck.run()              // todas as trilhas
await SelfCheck.run('databases')   // uma trilha (ou 'trilha/modulo')
```

### Novo tipo de etapa

```js
Game.registerStepType('ordenar', {
  scored: true,
  async run(ctx, step) {
    ctx.stage.set(elemento);                         // mostra no quadro
    ctx.say('fala', { mood: 'thinking', wait: false });
    // ... espera a resposta ...
    const result = { stars: 3, reviews: [{ text: '…', concept: '…' }] };
    await ctx.continueButton(elemento, { result });  // o resultado já entra no checkpoint aqui
    return result;
  },
});
```

Etapas pontuadas devem passar o resultado final para `ctx.continueButton(card, { result })`: a sessão
grava o checkpoint nesse momento, então quem fecha o jogo antes de clicar em "Continuar" não perde a atividade.
Etapas de explicação usam `teaching: true` e `ctx.explain(...)` (ver `js/steps/say.js`).
