/*
 * Etapa "pytest": o jogador ESCREVE TESTES com pytest para um código dado.
 * A avaliação é por mutation testing: os testes precisam passar no código
 * correto e falhar em cada versão com bug plantado (mutante).
 *
 *   { type: 'pytest', id, concept, title, say, prompt: 'markdown',
 *     module: 'carrinho',                 // arquivos: carrinho.py e test_carrinho.py
 *     implementation: 'código correto',   // mostrado ao jogador (somente leitura)
 *     starter: 'from carrinho import total\n\ndef test_...',
 *     minTests: 3,
 *     mutants: [{ name: 'desconto não aplicado', code: 'versão com bug', why: 'por que importa', concept: 'Valores-limite' }],
 *     reviews: [{ when: (m, code) => !m.decorators.includes('parametrize'), text, concept }],   // métricas do arquivo de TESTE
 *     hints: ['markdown'], solution: 'testes de referência', solutionExplanation: 'markdown', points: 40 }
 */
(function () {
  const { h, escapeHtml } = U;
  const { header, resultPanel } = StepHelpers;

  const OUTCOME_ICON = { passed: '✓', failed: '✗', error: '!', skipped: '–' };

  /** Lista de resultados de uma execução do pytest. */
  function renderPytest(res, { title } = {}) {
    const box = h('div', { class: 'pytest-report' });
    if (title) box.appendChild(h('div', { class: 'small muted' }, title));
    if (res.error || res.loadError) {
      box.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
        h('div', { class: 'tr-body' }, h('div', { class: 'tr-detail err' }, res.error))));
      return box;
    }
    if (res.timedOut) {
      box.appendChild(h('div', { class: 'test-row timeout' }, h('span', { class: 'tr-icon' }, '⏱'),
        h('div', { class: 'tr-body' }, h('div', { class: 'tr-name' }, 'Tempo esgotado — loop infinito no código ou nos testes?'))));
      return box;
    }
    for (const err of res.collectErrors || []) {
      box.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
        h('div', { class: 'tr-body' }, h('div', { class: 'tr-name' }, 'Erro ao coletar os testes'), h('pre', { class: 'tr-detail err' }, err))));
    }
    if (res.exitCode === 5 || (!res.collected && !(res.collectErrors || []).length)) {
      box.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '∅'),
        h('div', { class: 'tr-body' }, h('div', { class: 'tr-name' }, 'Nenhum teste encontrado'),
          h('div', { class: 'tr-detail', html: 'O pytest só coleta funções cujo nome começa com <code>test_</code>.' }))));
    }
    for (const t of res.tests || []) {
      const cls = t.outcome === 'passed' ? 'pass' : t.outcome === 'skipped' ? 'pending' : 'fail';
      const row = h('div', { class: `test-row ${cls}` },
        h('span', { class: 'tr-icon' }, OUTCOME_ICON[t.outcome] || '?'),
        h('div', { class: 'tr-body' },
          h('div', { class: 'tr-name' }, t.name, t.outcome === 'error' ? h('span', { class: 'tr-tag' }, 'erro na fixture') : null),
          t.message ? h('pre', { class: 'tr-detail err' }, t.message) : null,
          t.stdout ? h('pre', { class: 'tr-stdout' }, t.stdout) : null));
      box.appendChild(row);
    }
    if (res.collected) {
      const passed = (res.tests || []).filter(t => t.outcome === 'passed').length;
      box.appendChild(h('div', { class: 'pytest-summary small' }, `${passed} passou · ${res.collected - passed} falhou — ${res.ms ?? '?'} ms`));
    }
    return box;
  }

  const allPassed = res => !res.error && !res.timedOut && res.exitCode === 0 && res.collected > 0;

  function fileLabel(name, extra) {
    return h('div', { class: 'file-label' }, h('span', { class: 'file-icon' }, '🐍'), name, extra ? h('span', { class: 'muted small' }, extra) : null);
  }

  Game.registerStepType('pytest', {
    scored: true,
    async run(ctx, step) {
      PyRunner.warmup();
      const mod = step.module;
      const implFile = `${mod}.py`;
      const testFile = `test_${mod}.py`;
      const mutants = step.mutants || [];
      const minTests = step.minTests ?? 1;
      const hints = step.hints || [];
      let hintsUsed = 0;
      let failedSubmissions = 0;

      const editorHost = h('div', { class: 'editor-host' });
      const output = h('div', { class: 'code-output' },
        h('div', { class: 'muted small' }, `▶ Rodar executa seus testes contra o código correto. ✔ Enviar também verifica se eles pegam ${mutants.length} bug(s) plantado(s) no código.`));
      const hintsBox = h('div', { class: 'hints' });
      const feedback = h('div', { class: 'q-feedback' });
      const runBtn = h('button', { class: 'btn', title: 'Ctrl+Enter' }, '▶ Rodar pytest');
      const submitBtn = h('button', { class: 'btn btn-primary', title: 'Ctrl+Shift+Enter' }, '✔ Enviar');
      const hintBtn = h('button', { class: 'btn btn-ghost', disabled: !hints.length }, `💡 Dica (${hints.length})`);
      const resetBtn = h('button', { class: 'btn btn-ghost', title: 'Voltar ao código inicial' }, '↺');
      const giveUpBtn = h('button', { class: 'btn btn-ghost danger-text' }, '🏳 Ver solução');

      const card = h('div', { class: 'card question code-question' },
        header(step, 'Escreva os testes · pytest'),
        step.title ? h('h3', { class: 'q-title' }, step.title) : null,
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('details', { class: 'examples', open: true },
          h('summary', null, `Código sob teste — ${implFile}`),
          h('div', { class: 'md', html: MD.codeBlock(step.implementation, 'python') })),
        fileLabel(testFile, minTests > 1 ? `· mínimo de ${minTests} testes` : ''),
        editorHost,
        h('div', { class: 'q-actions code-actions' }, runBtn, submitBtn, h('span', { class: 'spacer' }), hintBtn, resetBtn, giveUpBtn),
        hintsBox, output, feedback);
      ctx.stage.set(card);
      const editor = CodeEditor.create(editorHost, { value: step.starter || `from ${mod} import *\n\n\ndef test_exemplo():\n    ...\n`, minLines: 12 });
      ctx.say(step.say || 'Agora o jogo inverte: **você** escreve os testes. Vou plantar bugs no código para ver se eles pegam.', { mood: 'thinking', wait: false });

      let busy = false;
      const setBusy = b => { busy = b; [runBtn, submitBtn, giveUpBtn].forEach(x => { x.disabled = b; }); card.classList.toggle('busy', b); };
      const loading = () => {
        output.innerHTML = '';
        output.appendChild(h('div', { class: 'muted' }, PyRunner.status !== 'ready' ? '⏳ Carregando Python e pytest (só na primeira vez)…' : '⏳ Rodando pytest…'));
      };
      const runOn = impl => PyRunner.pytest({ [implFile]: impl, [testFile]: editor.getValue() });

      runBtn.onclick = async () => {
        if (busy) return;
        setBusy(true);
        loading();
        try {
          const res = await runOn(step.implementation);
          output.innerHTML = '';
          output.appendChild(renderPytest(res, { title: `pytest ${testFile} (código correto)` }));
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
      resetBtn.onclick = () => editor.setValue(step.starter || '');
      editor.addKey('Ctrl-Enter', () => runBtn.onclick());
      editor.addKey('Cmd-Enter', () => runBtn.onclick());
      editor.addKey('Shift-Ctrl-Enter', () => submitBtn.onclick());
      editor.addKey('Shift-Cmd-Enter', () => submitBtn.onclick());

      const outcome = await new Promise(resolve => {
        submitBtn.onclick = async () => {
          if (busy) return;
          setBusy(true);
          loading();
          feedback.innerHTML = '';
          try {
            const base = await runOn(step.implementation);
            output.innerHTML = '';
            output.appendChild(renderPytest(base, { title: `pytest ${testFile} (código correto)` }));
            if (!allPassed(base)) {
              failedSubmissions++;
              Sound.wrong();
              const why = base.error ? 'Deu erro ao rodar o pytest.'
                : base.timedOut ? 'A execução travou.'
                  : (base.collectErrors || []).length ? 'Seu arquivo de teste nem chegou a rodar: há erro na coleta (import ou sintaxe).'
                    : !base.collected ? 'Não encontrei nenhum teste. Lembre: funções `test_...`.'
                      : 'Seus testes **falham no código correto** — então o problema está no teste, não no código. Confira o valor esperado.';
              ctx.say(why, { mood: 'concerned', wait: false });
              return;
            }
            if (base.collected < minTests) {
              ctx.say(`Quero pelo menos **${minTests} testes** cobrindo casos diferentes. Você tem ${base.collected}.`, { mood: 'thinking', wait: false });
              return;
            }
            // Mutation testing: cada mutante precisa ser "morto" (algum teste falhar).
            const results = [];
            for (const m of mutants) {
              const r = await runOn(m.code);
              results.push({ mutant: m, killed: !allPassed(r) });
            }
            const killed = results.filter(r => r.killed).length;
            const survivors = results.filter(r => !r.killed).map(r => r.mutant);
            output.appendChild(h('div', { class: 'mutants' },
              h('div', { class: 'small muted' }, `Bugs plantados: ${killed}/${mutants.length} detectados`),
              results.map(({ mutant, killed: k }) => h('div', { class: `test-row ${k ? 'pass' : 'fail'}` },
                h('span', { class: 'tr-icon' }, k ? '🐞' : '✗'),
                h('div', { class: 'tr-body' },
                  h('div', { class: 'tr-name' }, mutant.name, h('span', { class: 'tr-tag' }, k ? 'detectado' : 'passou despercebido')))))));

            const metrics = await PyRunner.analyze(editor.getValue());
            const code = editor.getValue();
            const reviewFlags = metrics ? (step.reviews || []).filter(rv => { try { return rv.when(metrics, code); } catch (e) { return false; } }) : [];

            if (survivors.length) {
              Sound.wrong();
              ctx.say(`Seus testes passam, mas **${survivors.length}** bug(s) passaram despercebidos. Quer reforçar os testes ou finalizar assim?`, { mood: 'thinking', wait: false });
              const again = h('button', { class: 'btn' }, '✍️ Melhorar meus testes');
              const done = h('button', { class: 'btn btn-primary' }, `Finalizar assim`);
              const row = h('div', { class: 'q-actions continue-row' }, again, done);
              feedback.appendChild(row);
              again.onclick = () => { row.remove(); editor.focus(); };
              done.onclick = () => { row.remove(); resolve({ killed, total: mutants.length, survivors, reviewFlags }); };
              return;
            }
            resolve({ killed, total: mutants.length, survivors, reviewFlags });
          } finally { setBusy(false); }
        };

        giveUpBtn.onclick = () => {
          if (busy) return;
          U.modal('Ver a solução?', h('p', null, 'Você não ganhará estrelas nesta questão, mas verá os testes de referência com a explicação.'), {
            actions: [
              { label: 'Continuar tentando', onClick: () => {} },
              { label: 'Ver solução', danger: true, onClick: () => resolve({ gaveUp: true, killed: 0, total: mutants.length, survivors: [], reviewFlags: [] }) },
            ],
          });
        };
      });

      [runBtn, submitBtn, hintBtn, resetBtn, giveUpBtn].forEach(b => b.remove());
      editor.setReadOnly(true);
      const { stars, deductions } = Scoring.pytestStars(Object.assign({ hintsUsed, failedSubmissions }, outcome));
      if (stars > 0) Sound.correct();

      const title = outcome.gaveUp ? 'Testes de referência'
        : stars === 3 ? 'Todos os bugs foram detectados — ótimos testes!'
          : 'Testes válidos, mas dá para melhorar.';
      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, title, h('div', null,
        deductions.length ? h('div', { class: 'deductions' },
          h('div', { class: 'small muted' }, 'O que poderia ser melhor:'),
          h('ul', null, deductions.map(d => h('li', null, h('span', { html: MD.inline(d.text) }), d.concept ? Widgets.concept(d.concept) : null)))) : null,
        step.solution ? h('details', { class: 'model-answer', open: stars < 3 },
          h('summary', null, 'Testes de referência'),
          h('div', { class: 'md', html: MD.codeBlock(step.solution, 'python') }),
          step.solutionExplanation ? h('div', { class: 'md', html: MD.render(step.solutionExplanation) }) : null) : null)));
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ctx.say(outcome.gaveUp ? 'Sem problemas — leia os testes de referência e repare em quais casos eles cobrem.' : U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')),
        { mood: stars === 3 ? 'cheer' : 'thinking', wait: false });

      const reviews = deductions.filter(d => d.concept || outcome.gaveUp).map(d => ({ text: d.text, concept: d.concept || step.concept }));
      const flags = !outcome.gaveUp && outcome.total > 0 && outcome.killed === outcome.total ? ['mutants-all'] : [];
      const result = { stars, reviews, flags, hintsUsed };
      await ctx.continueButton(card, { result });
      return result;
    },
  });

  window.StepHelpers = Object.assign(window.StepHelpers || {}, { renderPytest, allPassed, fileLabel });
})();
