/*
 * Etapa "code": o jogador escreve Python que é testado de verdade (Pyodide).
 *
 *   { type: 'code', say, title, prompt: 'markdown', starter: 'def f(x):\n    pass',
 *     tests: [
 *       { name: 'exemplo 1', expr: 'two_sum([2,7,11,15], 9)', expected: '[0, 1]', compare: 'sorted' },
 *       { name: 'singleton', code: 'a = Config()\nb = Config()\nassert a is b', hidden: true },
 *     ],
 *     perfTests: [{ name: 'n = 20.000', setup: 'nums = list(range(20000))', expr: 'two_sum(nums, 39997)', expected: '[19998, 19999]', compare: 'sorted', maxMs: 300 }],
 *     slowConcept: 'Hash Map — busca O(1)',
 *     reviews: [{ when: (m, code) => m.loopDepth >= 2, text: 'markdown', concept: 'Hash Map' }],
 *     hints: ['markdown', ...], solution: 'código', solutionExplanation: 'markdown',
 *     concept, points: 40, timeoutMs: 8000 }
 *
 * compare: eq (padrão) | sorted | set | approx | nested_sorted | truthy | is
 * `m` (métricas) vem da análise AST: loopDepth, loops, recursion, functions, classes[{name,bases,methods}],
 * calls, names, attributes, imports, decorators, comprehensions, lambdas, usesGlobal, whileTrue, lines...
 */
(function () {
  const { h, escapeHtml } = U;
  const { header, resultPanel } = StepHelpers;

  function testLabel(t, i) {
    if (t.name) return t.name;
    if (t.expr) return t.expr;
    return `Teste ${i + 1}`;
  }

  function renderTestRow(t, r, i) {
    const perf = !!t.perf;
    const timedOut = r && r.timedOut;
    const passed = r && r.passed && !(perf && r.slow);
    const status = !r ? 'pending' : timedOut ? 'timeout' : passed ? 'pass' : (perf && r.passed && r.slow) ? 'slow' : 'fail';
    const icon = { pending: '…', pass: '✓', fail: '✗', timeout: '⏱', slow: '🐢' }[status];
    const row = h('div', { class: `test-row ${status}` },
      h('span', { class: 'tr-icon' }, icon),
      h('div', { class: 'tr-body' },
        h('div', { class: 'tr-name' },
          perf ? h('span', { class: 'tr-tag' }, 'desempenho') : null,
          t.hidden ? h('span', { class: 'tr-tag' }, 'oculto') : null,
          t.hidden ? `Teste oculto #${i + 1}` : testLabel(t, i),
          r && r.ms !== undefined && !timedOut ? h('span', { class: 'tr-ms' }, `${r.ms} ms${perf ? ` / limite ${t.maxMs} ms` : ''}`) : null)));
    const body = row.querySelector('.tr-body');
    if (r && timedOut) body.appendChild(h('div', { class: 'tr-detail' }, 'Tempo esgotado — loop infinito ou solução muito lenta.'));
    if (r && !r.passed && !timedOut) {
      if (r.error) body.appendChild(h('div', { class: 'tr-detail err' }, r.error));
      else if (!t.hidden && r.expected !== undefined) {
        body.appendChild(h('div', { class: 'tr-detail', html: `esperado <code>${escapeHtml(r.expected)}</code>, obtido <code>${escapeHtml(r.got)}</code>` }));
      }
    }
    if (r && r.stdout && !t.hidden) body.appendChild(h('pre', { class: 'tr-stdout' }, r.stdout));
    return row;
  }

  Game.registerStepType('code', {
    scored: true,
    async run(ctx, step) {
      PyRunner.warmup();
      const tests = (step.tests || []).map(t => Object.assign({}, t));
      const perfTests = (step.perfTests || []).map(t => Object.assign({ perf: true, maxMs: 500 }, t));
      const visibleTests = tests.filter(t => !t.hidden);
      const allTests = tests.concat(perfTests);
      const hints = step.hints || [];
      let hintsUsed = 0;
      let failedSubmissions = 0;

      const editorHost = h('div', { class: 'editor-host' });
      const output = h('div', { class: 'code-output' },
        h('div', { class: 'muted small' }, 'Use ▶ Executar para rodar os testes de exemplo e ✔ Enviar para a avaliação completa (testes ocultos + desempenho + review).'));
      const hintsBox = h('div', { class: 'hints' });
      const feedback = h('div', { class: 'q-feedback' });

      const runBtn = h('button', { class: 'btn', title: 'Ctrl+Enter' }, '▶ Executar');
      const submitBtn = h('button', { class: 'btn btn-primary', title: 'Ctrl+Shift+Enter' }, '✔ Enviar');
      const hintBtn = h('button', { class: 'btn btn-ghost' }, `💡 Dica (${hints.length})`);
      const resetBtn = h('button', { class: 'btn btn-ghost', title: 'Voltar ao código inicial' }, '↺');
      const giveUpBtn = h('button', { class: 'btn btn-ghost danger-text' }, '🏳 Ver solução');
      if (!hints.length) hintBtn.disabled = true;

      const card = h('div', { class: 'card question code-question' },
        header(step, 'Desafio de código · Python'),
        step.title ? h('h3', { class: 'q-title' }, step.title) : null,
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        visibleTests.length ? h('details', { class: 'examples', open: true },
          h('summary', null, 'Exemplos'),
          h('div', { class: 'md', html: visibleTests.filter(t => t.expr).map(t =>
            MD.codeBlock(`>>> ${t.expr}\n${t.expected ?? ''}`, 'python')).join('') })) : null,
        editorHost,
        h('div', { class: 'q-actions code-actions' }, runBtn, submitBtn, h('span', { class: 'spacer' }), hintBtn, resetBtn, giveUpBtn),
        hintsBox,
        output,
        feedback);
      ctx.stage.set(card);
      const editor = CodeEditor.create(editorHost, { value: step.starter || '', minLines: 10 });
      ctx.say(step.say || U.pick(ctx.lines('askCode')), { mood: 'neutral', wait: false });

      let busy = false;
      const setBusy = b => {
        busy = b;
        [runBtn, submitBtn, giveUpBtn].forEach(x => { x.disabled = b; });
        card.classList.toggle('busy', b);
      };

      function renderResults(list, results, extra) {
        output.innerHTML = '';
        if (extra) output.appendChild(extra);
        list.forEach((t, i) => output.appendChild(renderTestRow(t, results[i], i)));
      }

      async function execute(list) {
        if (PyRunner.status !== 'ready') {
          output.innerHTML = '';
          output.appendChild(h('div', { class: 'muted' }, '⏳ Carregando o interpretador Python (só na primeira vez)…'));
        }
        const results = [];
        const res = await PyRunner.run(editor.getValue(), list, {
          timeoutMs: step.timeoutMs || 8000,
          onTest: r => { results[r.index] = r; renderResults(list, results); },
        });
        (res.results || []).forEach(r => { results[r.index] = r; });
        // Marca desempenho lento.
        list.forEach((t, i) => {
          const r = results[i];
          if (r && t.perf && r.ms > t.maxMs) r.slow = true;
        });
        if (res.timedOut) results[res.timedOutIndex] = { index: res.timedOutIndex, timedOut: true, passed: false };
        return { res, results };
      }

      function showError(res) {
        output.innerHTML = '';
        output.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
          h('div', { class: 'tr-body' }, h('div', { class: 'tr-name' }, res.loadError ? 'Python indisponível' : 'Erro ao executar seu código'),
            h('div', { class: 'tr-detail err' }, res.error))));
        if (res.stdout) output.appendChild(h('pre', { class: 'tr-stdout' }, res.stdout));
      }

      runBtn.onclick = async () => {
        if (busy) return;
        setBusy(true);
        try {
          const list = visibleTests.length ? visibleTests : [];
          const { res, results } = await execute(list);
          if (res.error) { showError(res); return; }
          const stdout = res.stdout ? h('div', null, h('div', { class: 'muted small' }, 'Saída (print):'), h('pre', { class: 'tr-stdout' }, res.stdout)) : null;
          renderResults(list, results, stdout);
          if (!list.length && !res.stdout) output.appendChild(h('div', { class: 'muted' }, 'Código executado sem erros.'));
        } finally { setBusy(false); }
      };

      hintBtn.onclick = () => {
        if (hintsUsed >= hints.length) return;
        const hint = hints[hintsUsed++];
        hintsBox.appendChild(h('div', { class: 'hint', html: `<b>Dica ${hintsUsed}:</b> ${MD.render(hint)}` }));
        hintBtn.textContent = `💡 Dica (${hints.length - hintsUsed})`;
        if (hintsUsed >= hints.length) hintBtn.disabled = true;
        ctx.say(hint.replace(/```[\s\S]*?```/g, '(veja o código no quadro)'), { mood: 'thinking', wait: false });
      };

      resetBtn.onclick = () => { editor.setValue(step.starter || ''); };

      editor.addKey('Ctrl-Enter', () => runBtn.onclick());
      editor.addKey('Cmd-Enter', () => runBtn.onclick());
      editor.addKey('Shift-Ctrl-Enter', () => submitBtn.onclick());
      editor.addKey('Shift-Cmd-Enter', () => submitBtn.onclick());

      const outcome = await new Promise(resolve => {
        submitBtn.onclick = async () => {
          if (busy) return;
          setBusy(true);
          try {
            const { res, results } = await execute(allTests);
            if (res.error) {
              failedSubmissions++;
              showError(res);
              Sound.wrong();
              ctx.say(res.loadError ? 'Parece que o Python não carregou... confira sua conexão e clique no indicador "Python" no topo para tentar de novo.' : U.pick(ctx.lines('codeError')), { mood: 'concerned', wait: false });
              return;
            }
            renderResults(allTests, results);
            const correctness = tests.every((t, i) => results[i] && results[i].passed);
            if (!correctness) {
              failedSubmissions++;
              Sound.wrong();
              const firstFail = tests.findIndex((t, i) => !(results[i] && results[i].passed));
              const r = results[firstFail];
              ctx.say(r && r.timedOut ? 'Hmm, a execução travou. Será que tem um loop que nunca termina?' : U.pick(ctx.lines('testsFail')), { mood: 'concerned', wait: false });
              return;
            }
            // Desempenho: resposta errada em entrada grande conta como falha de correção.
            const perfResults = perfTests.map((t, j) => results[tests.length + j]);
            const perfWrong = perfResults.some(r => r && !r.timedOut && !r.passed);
            if (perfWrong) {
              failedSubmissions++;
              Sound.wrong();
              ctx.say('Os testes pequenos passaram, mas a resposta saiu errada numa entrada grande. Pense nos casos de borda!', { mood: 'concerned', wait: false });
              return;
            }
            const slow = perfResults.some(r => !r || r.timedOut || r.slow);
            const metrics = await PyRunner.analyze(editor.getValue());
            const code = editor.getValue();
            const reviewFlags = metrics ? (step.reviews || []).filter(rv => {
              try { return rv.when(metrics, code); } catch (e) { return false; }
            }) : [];
            resolve({ solved: true, slow, reviewFlags, metrics });
          } finally { setBusy(false); }
        };

        giveUpBtn.onclick = () => {
          if (busy) return;
          U.modal('Ver a solução?', h('p', null, 'Você não ganhará estrelas nesta questão, mas verá a solução de referência com a explicação.'), {
            actions: [
              { label: 'Continuar tentando', onClick: () => {} },
              { label: 'Ver solução', danger: true, onClick: () => resolve({ solved: false, gaveUp: true, reviewFlags: [] }) },
            ],
          });
        };
      });

      [runBtn, submitBtn, hintBtn, resetBtn, giveUpBtn].forEach(b => b.remove());

      const { stars, deductions } = Scoring.codeStars({
        solved: outcome.solved,
        gaveUp: outcome.gaveUp,
        hintsUsed,
        failedSubmissions,
        slow: outcome.slow,
        slowConcept: step.slowConcept,
        reviewFlags: outcome.reviewFlags,
      });
      if (stars > 0) Sound.correct();

      const title = !outcome.solved ? 'Solução de referência'
        : stars === 3 ? 'Todos os testes passaram — solução excelente!'
          : 'Todos os testes passaram, mas dá para melhorar.';

      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, title, h('div', null,
        deductions.length ? h('div', { class: 'deductions' },
          h('div', { class: 'small muted' }, stars === 3 ? '' : 'O que poderia ser melhor:'),
          h('ul', null, deductions.map(d => h('li', null,
            h('span', { html: MD.inline(d.text) }),
            d.concept ? Widgets.concept(d.concept) : null)))) : null,
        step.solution ? h('details', { class: 'model-answer', open: stars < 3 },
          h('summary', null, 'Solução de referência'),
          h('div', { class: 'md', html: MD.codeBlock(step.solution, 'python') }),
          step.solutionExplanation ? h('div', { class: 'md', html: MD.render(step.solutionExplanation) }) : null) : null)));
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const line = !outcome.solved ? 'Sem problemas — estudar a solução também é aprender. Leia com calma.'
        : U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial'));
      ctx.say(line, { mood: stars === 3 ? 'cheer' : stars === 0 ? 'neutral' : 'thinking', wait: false });

      const reviews = deductions.filter(d => d.concept || !outcome.solved).map(d => ({ text: d.text, concept: d.concept || step.concept }));
      const flags = [];
      if (outcome.solved && perfTests.length && !outcome.slow && failedSubmissions === 0) flags.push('perf-first');
      const result = { stars, reviews, flags, hintsUsed };
      await ctx.continueButton(card, { result });
      return result;
    },
  });
})();
