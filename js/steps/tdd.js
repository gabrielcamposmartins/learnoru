/*
 * Etapa "tdd": um ciclo de TDD guiado — 🔴 Red → 🟢 Green → 🔵 Refactor.
 *
 *  RED:      o jogador escreve um teste para o requisito. Ele precisa FALHAR no código atual
 *            e PASSAR numa implementação de referência (ou seja: testa o requisito certo).
 *  GREEN:    o jogador implementa o mínimo para os testes passarem; `checks` (testes ocultos)
 *            confirmam que o requisito foi cumprido de fato.
 *  REFACTOR: melhora o código mantendo tudo verde; `reviews` sugerem melhorias.
 *
 *   { type: 'tdd', id, concept, title, say, prompt: 'requisito em markdown',
 *     module: 'fizzbuzz',                        // arquivos fizzbuzz.py e test_fizzbuzz.py
 *     kata: 'fizzbuzz',                          // opcional: ciclos com o mesmo kata continuam o código anterior
 *     testStarter: '…', implStarter: '…',        // usados no 1º ciclo do kata (ou se não houver kata)
 *     reference: 'implementação correta deste ciclo' (padrão: solutionImpl),
 *     stub: 'def f(x):\n    return None\n',   // opcional: o teste também precisa falhar nele
 *                                             // (útil no 1º ciclo, quando o import falha de qualquer jeito)
 *     checks: [{ name, expr, expected } | { name, code }],   // ocultos, rodam na implementação do jogador
 *     reviews: [{ when: (m, code) => …, text, concept }],     // métricas da IMPLEMENTAÇÃO, na fase refactor
 *     refactorTip: 'markdown', hints: ['markdown'],
 *     solutionTests: '…', solutionImpl: '…', solutionExplanation: 'markdown', points: 50 }
 */
(function () {
  const { h } = U;
  const { header, resultPanel, renderPytest, allPassed, fileLabel } = StepHelpers;

  const PHASES = [
    { key: 'red', icon: '🔴', label: 'Red', desc: 'Escreva um teste que falhe' },
    { key: 'green', icon: '🟢', label: 'Green', desc: 'Faça passar com o mínimo de código' },
    { key: 'refactor', icon: '🔵', label: 'Refactor', desc: 'Melhore mantendo verde' },
  ];

  Game.registerStepType('tdd', {
    scored: true,
    async run(ctx, step) {
      PyRunner.warmup();
      const mod = step.module;
      const implFile = `${mod}.py`;
      const testFile = `test_${mod}.py`;
      const reference = step.reference || step.solutionImpl;
      const shared = step.kata ? (ctx.shared[step.kata] || null) : null;
      const startTests = shared ? shared.tests : (step.testStarter ?? `from ${mod} import *\n\n\n`);
      const startImpl = shared ? shared.impl : (step.implStarter ?? '');
      const hints = step.hints || [];
      let hintsUsed = 0;
      let failedSubmissions = 0;
      let phase = 'red';
      let phaseStart = { tests: startTests, impl: startImpl };

      const stepper = h('div', { class: 'tdd-stepper' }, PHASES.map(p => h('div', { class: `tdd-phase ph-${p.key}`, dataset: { phase: p.key } },
        h('span', { class: 'tdd-icon' }, p.icon),
        h('div', null, h('strong', null, p.label), h('div', { class: 'small muted' }, p.desc)))));

      const testHost = h('div', { class: 'editor-host' });
      const implHost = h('div', { class: 'editor-host' });
      const output = h('div', { class: 'code-output' }, h('div', { class: 'muted small' }, 'Comece pelo teste: ele precisa falhar antes de existir a implementação.'));
      const hintsBox = h('div', { class: 'hints' });
      const tipBox = h('div', { class: 'tdd-tip' });
      const feedback = h('div', { class: 'q-feedback' });
      const runBtn = h('button', { class: 'btn btn-primary', title: 'Ctrl+Enter' });
      const backBtn = h('button', { class: 'btn btn-ghost', title: 'Voltar para escrever mais um teste' }, '↩ Voltar ao Red');
      const finishBtn = h('button', { class: 'btn btn-primary' }, '✔ Concluir ciclo');
      const hintBtn = h('button', { class: 'btn btn-ghost', disabled: !hints.length }, `💡 Dica (${hints.length})`);
      const resetBtn = h('button', { class: 'btn btn-ghost', title: 'Desfazer as mudanças desta fase' }, '↺');
      const giveUpBtn = h('button', { class: 'btn btn-ghost danger-text' }, '🏳 Ver solução');

      const card = h('div', { class: 'card question code-question tdd-question' },
        header(step, 'TDD · Red → Green → Refactor'),
        step.title ? h('h3', { class: 'q-title' }, step.title) : null,
        stepper,
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('div', { class: 'tdd-editors' },
          h('div', { class: 'tdd-pane pane-tests' }, fileLabel(testFile), testHost),
          h('div', { class: 'tdd-pane pane-impl' }, fileLabel(implFile), implHost)),
        tipBox,
        h('div', { class: 'q-actions code-actions' }, runBtn, backBtn, finishBtn, h('span', { class: 'spacer' }), hintBtn, resetBtn, giveUpBtn),
        hintsBox, output, feedback);
      ctx.stage.set(card);
      const tests = CodeEditor.create(testHost, { value: startTests, minLines: 12 });
      const impl = CodeEditor.create(implHost, { value: startImpl, minLines: 12 });

      function setPhase(p) {
        phase = p;
        phaseStart = { tests: tests.getValue(), impl: impl.getValue() };
        const idx = PHASES.findIndex(x => x.key === p);
        stepper.querySelectorAll('.tdd-phase').forEach((el, i) => {
          el.classList.toggle('active', i === idx);
          el.classList.toggle('done', i < idx);
        });
        card.dataset.phase = p;
        tests.setReadOnly(p === 'green');
        impl.setReadOnly(p === 'red');
        runBtn.textContent = { red: '🔴 Rodar testes (devem falhar)', green: '🟢 Rodar testes', refactor: '🔵 Rodar testes' }[p];
        backBtn.hidden = p !== 'green';
        finishBtn.hidden = p !== 'refactor';
        tipBox.innerHTML = '';
        if (p === 'refactor') {
          tipBox.appendChild(h('div', { class: 'callout tip md', html: MD.render(step.refactorTip ||
            'Tudo verde! Agora é a hora de **melhorar o código** (nomes, duplicação, clareza) sem mudar o comportamento. Rode os testes a cada mudança. Quando estiver satisfeito(a), conclua o ciclo.') }));
        }
        (p === 'red' ? tests : impl).focus();
      }

      const say = (text, mood) => ctx.say(text, { mood, wait: false });
      say(step.say || (shared ? 'Próximo ciclo! Comece pelo **teste** do novo requisito — ele precisa ficar vermelho.' :
        'Vamos de TDD! Primeiro o **teste**, que precisa falhar. Só depois a implementação.'), 'thinking');
      setPhase('red');

      let busy = false;
      const setBusy = b => { busy = b; [runBtn, backBtn, finishBtn, giveUpBtn].forEach(x => { x.disabled = b; }); card.classList.toggle('busy', b); };
      const loading = () => {
        output.innerHTML = '';
        output.appendChild(h('div', { class: 'muted' }, PyRunner.status !== 'ready' ? '⏳ Carregando Python e pytest (só na primeira vez)…' : '⏳ Rodando pytest…'));
      };
      const pytestOn = implCode => PyRunner.pytest({ [implFile]: implCode, [testFile]: tests.getValue() });
      const fail = (text, mood = 'concerned') => { failedSubmissions++; Sound.wrong(); say(text, mood); };

      /** Verde = testes do jogador passam E os checks ocultos do requisito passam. */
      async function verifyGreen() {
        const res = await pytestOn(impl.getValue());
        output.innerHTML = '';
        output.appendChild(renderPytest(res, { title: `pytest ${testFile}` }));
        if (!allPassed(res)) return { ok: false, reason: 'tests' };
        if (step.checks && step.checks.length) {
          const chk = await PyRunner.run(impl.getValue(), step.checks, { timeoutMs: 8000 });
          const failed = chk.error ? [{ name: chk.error }] : step.checks.filter((c, i) => !(chk.results[i] && chk.results[i].passed));
          if (chk.timedOut || failed.length) {
            output.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
              h('div', { class: 'tr-body' },
                h('div', { class: 'tr-name' }, 'Requisito ainda não cumprido (verificação oculta)'),
                h('ul', { class: 'tr-detail' }, (chk.timedOut ? [{ name: 'tempo esgotado' }] : failed).map(c => h('li', null, c.name || c.expr))))));
            return { ok: false, reason: 'checks' };
          }
        }
        return { ok: true };
      }

      async function runRed() {
        const cur = await pytestOn(impl.getValue());
        output.innerHTML = '';
        output.appendChild(renderPytest(cur, { title: `pytest ${testFile} — código atual` }));
        if (cur.error || cur.timedOut) return fail('Deu erro ao rodar os testes. Veja a saída.');
        if (!cur.collected && !(cur.collectErrors || []).length) return fail('Não encontrei nenhum teste. As funções precisam começar com `test_`.');
        if (allPassed(cur)) return fail('Seu teste **já passa** com o código atual — então ele não testa nada novo. No TDD o teste do novo requisito precisa começar **vermelho**.', 'thinking');
        if (step.stub) {
          // Falhar só porque o import quebrou não basta: o teste precisa verificar comportamento.
          const st = await pytestOn(step.stub);
          if (allPassed(st)) return fail('Seu teste passa até com uma implementação que **não faz nada** — ele precisa verificar o resultado com `assert`.', 'thinking');
        }
        const ref = await pytestOn(reference);
        if (!allPassed(ref)) {
          output.appendChild(renderPytest(ref, { title: 'Os mesmos testes contra uma implementação CORRETA do requisito:' }));
          return fail('Seu teste falha até numa implementação **correta** do requisito — então é o teste que está pedindo a coisa errada. Releia o requisito.');
        }
        Sound.correct();
        output.insertBefore(h('div', { class: 'tdd-banner red' }, '🔴 Vermelho! O teste falha pelo motivo certo.'), output.firstChild);
        say('Vermelho, pelo motivo certo! Agora escreva **o mínimo de código** para esse teste passar.', 'happy');
        setPhase('green');
      }

      async function runGreen() {
        const v = await verifyGreen();
        if (!v.ok) {
          if (v.reason === 'tests') return fail(U.pick(ctx.lines('testsFail')));
          return fail('Seus testes passam, mas o requisito ainda não está completo. Se você "chumbou" um valor (fake it), tudo bem como passo — mas agora generalize. Se quiser, volte ao Red e escreva outro teste (triangulação).', 'thinking');
        }
        Sound.correct();
        output.insertBefore(h('div', { class: 'tdd-banner green' }, '🟢 Verde! Todos os testes passam.'), output.firstChild);
        say('Verde! Agora a fase que muita gente pula: **refatorar**, com a rede de segurança dos testes.', 'happy');
        setPhase('refactor');
      }

      async function runRefactor() {
        const v = await verifyGreen();
        if (!v.ok) return fail('Opa, a refatoração quebrou algo — refatorar é mudar a estrutura **sem mudar o comportamento**. Os testes avisaram na hora.');
        output.insertBefore(h('div', { class: 'tdd-banner green' }, '🟢 Continua verde.'), output.firstChild);
        say('Continua verde. Pode seguir refatorando ou concluir o ciclo.', 'neutral');
      }

      runBtn.onclick = async () => {
        if (busy) return;
        setBusy(true);
        loading();
        try {
          if (phase === 'red') await runRed();
          else if (phase === 'green') await runGreen();
          else await runRefactor();
        } finally { setBusy(false); }
      };
      backBtn.onclick = () => {
        say('Boa ideia: um novo teste com outro exemplo força a generalização (triangulação).', 'neutral');
        setPhase('red');
      };
      resetBtn.onclick = () => { tests.setValue(phaseStart.tests); impl.setValue(phaseStart.impl); };
      hintBtn.onclick = () => {
        if (hintsUsed >= hints.length) return;
        const hint = hints[hintsUsed++];
        hintsBox.appendChild(h('div', { class: 'hint', html: `<b>Dica ${hintsUsed}:</b> ${MD.render(hint)}` }));
        hintBtn.textContent = `💡 Dica (${hints.length - hintsUsed})`;
        if (hintsUsed >= hints.length) hintBtn.disabled = true;
        say(hint.replace(/```[\s\S]*?```/g, '(veja o código no quadro)'), 'thinking');
      };
      for (const ed of [tests, impl]) {
        ed.addKey('Ctrl-Enter', () => runBtn.onclick());
        ed.addKey('Cmd-Enter', () => runBtn.onclick());
      }

      const outcome = await new Promise(resolve => {
        finishBtn.onclick = async () => {
          if (busy) return;
          setBusy(true);
          loading();
          try {
            const v = await verifyGreen();
            if (!v.ok) return fail('Antes de concluir, tudo precisa estar verde.');
            const metrics = await PyRunner.analyze(impl.getValue());
            const code = impl.getValue();
            const reviewFlags = metrics ? (step.reviews || []).filter(rv => { try { return rv.when(metrics, code); } catch (e) { return false; } }) : [];
            resolve({ solved: true, reviewFlags });
          } finally { setBusy(false); }
        };
        giveUpBtn.onclick = () => {
          if (busy) return;
          U.modal('Ver a solução?', h('p', null, 'Você não ganhará estrelas neste ciclo. Os testes e a implementação de referência serão carregados para você continuar.'), {
            actions: [
              { label: 'Continuar tentando', onClick: () => {} },
              { label: 'Ver solução', danger: true, onClick: () => resolve({ solved: false, gaveUp: true, reviewFlags: [] }) },
            ],
          });
        };
      });

      if (outcome.gaveUp) {
        tests.setValue(step.solutionTests || tests.getValue());
        impl.setValue(step.solutionImpl || impl.getValue());
      }
      if (step.kata) ctx.shared[step.kata] = { tests: tests.getValue(), impl: impl.getValue() };
      stepper.querySelectorAll('.tdd-phase').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
      [runBtn, backBtn, finishBtn, hintBtn, resetBtn, giveUpBtn].forEach(b => b.remove());
      tipBox.innerHTML = '';
      tests.setReadOnly(true);
      impl.setReadOnly(true);

      const { stars, deductions } = Scoring.codeStars({
        solved: outcome.solved, gaveUp: outcome.gaveUp, hintsUsed, failedSubmissions, slow: false, reviewFlags: outcome.reviewFlags,
      });
      if (stars > 0) Sound.correct();
      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, outcome.gaveUp ? 'Solução de referência' : stars === 3 ? 'Ciclo completo — TDD de livro!' : 'Ciclo completo, com pontos a melhorar.',
        h('div', null,
          deductions.length ? h('div', { class: 'deductions' },
            h('div', { class: 'small muted' }, 'O que poderia ser melhor:'),
            h('ul', null, deductions.map(d => h('li', null, h('span', { html: MD.inline(d.text) }), d.concept ? Widgets.concept(d.concept) : null)))) : null,
          h('details', { class: 'model-answer', open: stars < 3 },
            h('summary', null, 'Solução de referência'),
            step.solutionTests ? h('div', null, fileLabel(testFile), h('div', { class: 'md', html: MD.codeBlock(step.solutionTests, 'python') })) : null,
            step.solutionImpl ? h('div', null, fileLabel(implFile), h('div', { class: 'md', html: MD.codeBlock(step.solutionImpl, 'python') })) : null,
            step.solutionExplanation ? h('div', { class: 'md', html: MD.render(step.solutionExplanation) }) : null))));
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
      say(outcome.gaveUp ? 'Carreguei a solução no editor — o próximo ciclo continua a partir dela.' : U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')),
        stars === 3 ? 'cheer' : 'neutral');

      const reviews = deductions.filter(d => d.concept || outcome.gaveUp).map(d => ({ text: d.text, concept: d.concept || step.concept }));
      const result = { stars, reviews, flags: stars === 3 ? ['tdd-perfect'] : [], hintsUsed };
      await ctx.continueButton(card, { result });
      return result;
    },
  });
})();
