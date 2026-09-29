/*
 * Etapa "sql": o jogador escreve SQL que roda de verdade em SQLite (3.39, no navegador).
 *
 *   { type: 'sql', id, concept, title, say, prompt: 'markdown',
 *     schema: 'CREATE TABLE …; INSERT …;',        // dataset visível (as tabelas aparecem para o jogador)
 *     variants: ['INSERT …;', 'DELETE …;'],        // datasets OCULTOS: SQL aplicado depois do schema
 *     mode: 'query',                              // 'query' compara o resultado da consulta;
 *                                                 // 'script' roda DDL/DML e compara as consultas `verify`
 *     verify: ['SELECT * FROM contas ORDER BY id'], // (mode 'script')
 *     orderMatters: false,                        // true quando o enunciado pede ORDER BY
 *     plan: { sql: 'SELECT … WHERE email = ?', mustContain: ['USING INDEX'], mustNotContain: ['SCAN'], hint: 'markdown' },
 *     starter: 'SELECT …', solution: 'SELECT …', solutionExplanation: 'markdown',
 *     reviews: [{ when: sql => /select\s+[*]/i.test(sql), text: 'markdown', concept }],   // regex sobre o SQL do jogador
 *     hints: ['markdown'], points: 30 }
 *
 * Colunas são comparadas por posição (nomes/aliases não importam); números com tolerância.
 */
(function () {
  const { h } = U;
  const { header, resultPanel } = StepHelpers;

  function renderTable(preview, { title, cls = '' } = {}) {
    const wrap = h('div', { class: `sql-table ${cls}` });
    if (title) wrap.appendChild(h('div', { class: 'sql-table-title' }, title));
    if (!preview) { wrap.appendChild(h('div', { class: 'muted small' }, '(sem resultado)')); return wrap; }
    const table = h('table', null,
      h('thead', null, h('tr', null, preview.cols.map(c => h('th', null, c)))),
      h('tbody', null, preview.rows.map(r => h('tr', null, r.map(v => v === null
        ? h('td', { class: 'null' }, 'NULL')
        : h('td', { class: typeof v === 'number' ? 'num' : '' }, String(v)))))));
    wrap.appendChild(h('div', { class: 'sql-table-scroll' }, table));
    const extra = preview.rowCount > preview.rows.length ? ` (mostrando ${preview.rows.length})` : '';
    wrap.appendChild(h('div', { class: 'sql-table-foot' }, `${preview.rowCount} linha(s)${extra}`));
    return wrap;
  }

  function renderSchema(info) {
    if (!info || info.error) return h('div', { class: 'q-hint bad' }, info ? info.error : 'Não foi possível ler o schema.');
    return h('div', { class: 'sql-schema' }, info.tables.map(t => h('div', { class: 'sql-schema-table' },
      h('div', { class: 'sql-schema-head' },
        h('span', { class: 'sql-schema-name' }, t.name),
        h('span', { class: 'muted small' }, `${t.count} linha(s)`)),
      h('div', { class: 'sql-schema-cols' }, t.columns.map(c => h('span', { class: `sql-col ${c.pk ? 'pk' : ''}`, title: c.type || '' },
        c.pk ? '🔑 ' : '', c.name, c.type ? h('small', null, ` ${c.type.toLowerCase()}`) : null))),
      t.rows.length ? renderTable({ cols: t.columns.map(c => c.name), rows: t.rows, rowCount: t.count }, { cls: 'compact' }) : null)));
  }

  Game.registerStepType('sql', {
    scored: true,
    async run(ctx, step) {
      PyRunner.warmup();
      const mode = step.mode || 'query';
      const hints = step.hints || [];
      let hintsUsed = 0;
      let failedSubmissions = 0;

      const schemaBox = h('div', { class: 'sql-schema-box' }, h('div', { class: 'muted small' }, '⏳ Carregando tabelas…'));
      const editorHost = h('div', { class: 'editor-host' });
      const output = h('div', { class: 'code-output' },
        h('div', { class: 'muted small' }, mode === 'script'
          ? '▶ Executar roda seu script e mostra o estado das tabelas. ✔ Enviar compara com o esperado (inclusive em dados ocultos).'
          : '▶ Executar mostra o resultado da sua consulta. ✔ Enviar compara com o esperado (inclusive em dados ocultos).'));
      const hintsBox = h('div', { class: 'hints' });
      const feedback = h('div', { class: 'q-feedback' });
      const runBtn = h('button', { class: 'btn', title: 'Ctrl+Enter' }, '▶ Executar');
      const submitBtn = h('button', { class: 'btn btn-primary', title: 'Ctrl+Shift+Enter' }, '✔ Enviar');
      const hintBtn = h('button', { class: 'btn btn-ghost', disabled: !hints.length }, `💡 Dica (${hints.length})`);
      const resetBtn = h('button', { class: 'btn btn-ghost', title: 'Voltar ao SQL inicial' }, '↺');
      const giveUpBtn = h('button', { class: 'btn btn-ghost danger-text' }, '🏳 Ver solução');

      const card = h('div', { class: 'card question code-question sql-question' },
        header(step, mode === 'script' ? 'Desafio SQL · script' : 'Desafio SQL · consulta'),
        step.title ? h('h3', { class: 'q-title' }, step.title) : null,
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('details', { class: 'examples', open: true }, h('summary', null, 'Tabelas'), schemaBox),
        StepHelpers.fileLabel ? StepHelpers.fileLabel(mode === 'script' ? 'script.sql' : 'consulta.sql') : null,
        editorHost,
        h('div', { class: 'q-actions code-actions' }, runBtn, submitBtn, h('span', { class: 'spacer' }), hintBtn, resetBtn, giveUpBtn),
        hintsBox, output, feedback);
      ctx.stage.set(card);
      const editor = CodeEditor.create(editorHost, { value: step.starter || '', minLines: 8, mode: 'sql' });
      ctx.say(step.say || 'Escreva o SQL. Pode executar quantas vezes quiser antes de enviar.', { mood: 'neutral', wait: false });

      PyRunner.sqlInspect(step.schema || '').then(info => {
        schemaBox.innerHTML = '';
        schemaBox.appendChild(info.timedOut ? h('div', { class: 'muted' }, 'Tempo esgotado ao ler o schema.') : renderSchema(info));
      });

      let busy = false;
      const setBusy = b => { busy = b; [runBtn, submitBtn, giveUpBtn].forEach(x => { x.disabled = b; }); card.classList.toggle('busy', b); };
      const loading = () => {
        output.innerHTML = '';
        output.appendChild(h('div', { class: 'muted' }, PyRunner.status !== 'ready' ? '⏳ Carregando o banco (só na primeira vez)…' : '⏳ Executando…'));
      };
      const payload = extra => Object.assign({
        schema: step.schema || '', variants: step.variants || [], mode, verify: step.verify || [],
        orderMatters: !!step.orderMatters, plan: step.plan || null, user: editor.getValue(), solution: step.solution || '',
      }, extra);

      function showRun(res) {
        output.innerHTML = '';
        if (res.error || res.timedOut) {
          output.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
            h('div', { class: 'tr-body' }, h('div', { class: 'tr-detail err' }, res.timedOut ? 'Tempo esgotado.' : res.error))));
          return;
        }
        const ds = res.datasets[0];
        if (ds.userError) {
          output.appendChild(h('div', { class: 'test-row fail' }, h('span', { class: 'tr-icon' }, '✗'),
            h('div', { class: 'tr-body' }, h('div', { class: 'tr-name' }, 'Erro no SQL'), h('pre', { class: 'tr-detail err' }, ds.userError))));
          return;
        }
        if (mode === 'script') {
          if (ds.user) output.appendChild(renderTable(ds.user, { title: 'Resultado do último comando' }));
          (ds.verifyUser || []).forEach((v, k) => output.appendChild(renderTable(v, { title: `Estado: ${step.verify[k]}` })));
          if (!ds.user && !(ds.verifyUser || []).length) output.appendChild(h('div', { class: 'muted' }, 'Script executado sem erros.'));
        } else {
          output.appendChild(renderTable(ds.user, { title: 'Seu resultado' }));
        }
      }

      runBtn.onclick = async () => {
        if (busy) return;
        setBusy(true);
        loading();
        try { showRun(await PyRunner.sql(payload({ runOnly: true }))); } finally { setBusy(false); }
      };

      hintBtn.onclick = () => {
        if (hintsUsed >= hints.length) return;
        const hint = hints[hintsUsed++];
        hintsBox.appendChild(h('div', { class: 'hint', html: `<b>Dica ${hintsUsed}:</b> ${MD.render(hint)}` }));
        hintBtn.textContent = `💡 Dica (${hints.length - hintsUsed})`;
        if (hintsUsed >= hints.length) hintBtn.disabled = true;
        ctx.say(hint.replace(/```[\s\S]*?```/g, '(veja no quadro)'), { mood: 'thinking', wait: false });
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
          try {
            const res = await PyRunner.sql(payload({}));
            output.innerHTML = '';
            if (res.error || res.timedOut) { showRun(res); failedSubmissions++; Sound.wrong(); return; }
            const base = res.datasets[0];
            const rows = h('div', { class: 'sql-checks' });
            res.datasets.forEach(ds => rows.appendChild(h('div', { class: `test-row ${ds.passed ? 'pass' : 'fail'}` },
              h('span', { class: 'tr-icon' }, ds.passed ? '✓' : '✗'),
              h('div', { class: 'tr-body' },
                h('div', { class: 'tr-name' }, ds.hidden ? h('span', { class: 'tr-tag' }, 'oculto') : null, ds.hidden ? `Dados ocultos #${ds.index}` : 'Dados visíveis'),
                ds.message ? h('div', { class: 'tr-detail' }, ds.message) : null))));
            if (res.plan) {
              rows.appendChild(h('div', { class: `test-row ${res.plan.passed ? 'pass' : 'fail'}` },
                h('span', { class: 'tr-icon' }, res.plan.passed ? '✓' : '✗'),
                h('div', { class: 'tr-body' },
                  h('div', { class: 'tr-name' }, h('span', { class: 'tr-tag' }, 'plano'), 'EXPLAIN QUERY PLAN'),
                  h('pre', { class: 'tr-stdout' }, res.plan.text),
                  !res.plan.passed && step.plan && step.plan.hint ? h('div', { class: 'tr-detail', html: MD.inline(step.plan.hint) }) : null)));
            }
            output.appendChild(rows);
            if (base.userError) output.appendChild(h('pre', { class: 'tr-detail err' }, base.userError));
            else if (mode === 'script') {
              (base.verifyUser || []).forEach((v, k) => {
                const pair = h('div', { class: 'sql-compare' }, renderTable(v, { title: 'Seu estado' }));
                if (!base.passed && base.verifyExpected) pair.appendChild(renderTable(base.verifyExpected[k], { title: 'Esperado', cls: 'expected' }));
                output.appendChild(h('div', { class: 'small muted' }, step.verify[k]));
                output.appendChild(pair);
              });
            } else {
              const pair = h('div', { class: 'sql-compare' }, renderTable(base.user, { title: 'Seu resultado' }));
              if (!base.passed && base.expected) pair.appendChild(renderTable(base.expected, { title: 'Esperado', cls: 'expected' }));
              output.appendChild(pair);
            }
            const allOk = res.datasets.every(d => d.passed) && (!res.plan || res.plan.passed);
            if (!allOk) {
              failedSubmissions++;
              Sound.wrong();
              const hiddenFail = base.passed && res.datasets.some(d => !d.passed);
              ctx.say(hiddenFail ? 'Nos dados visíveis deu certo, mas falhou em dados **ocultos**. Sua consulta depende de algum valor específico?'
                : res.plan && !res.plan.passed && res.datasets.every(d => d.passed) ? 'O resultado está certo, mas o **plano de execução** ainda não é o esperado.'
                  : U.pick(ctx.lines('testsFail')), { mood: 'concerned', wait: false });
              return;
            }
            const sql = editor.getValue();
            const reviewFlags = (step.reviews || []).filter(rv => { try { return rv.when(sql); } catch (e) { return false; } });
            resolve({ solved: true, reviewFlags });
          } finally { setBusy(false); }
        };
        giveUpBtn.onclick = () => {
          if (busy) return;
          U.modal('Ver a solução?', h('p', null, 'Você não ganhará estrelas nesta questão, mas verá o SQL de referência com a explicação.'), {
            actions: [
              { label: 'Continuar tentando', onClick: () => {} },
              { label: 'Ver solução', danger: true, onClick: () => resolve({ solved: false, gaveUp: true, reviewFlags: [] }) },
            ],
          });
        };
      });

      [runBtn, submitBtn, hintBtn, resetBtn, giveUpBtn].forEach(b => b.remove());
      editor.setReadOnly(true);
      const { stars, deductions } = Scoring.codeStars({
        solved: outcome.solved, gaveUp: outcome.gaveUp, hintsUsed, failedSubmissions, slow: false, reviewFlags: outcome.reviewFlags,
      });
      if (stars > 0) Sound.correct();
      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, outcome.gaveUp ? 'SQL de referência' : stars === 3 ? 'Resultado certo em todos os dados!' : 'Correto, mas dá para melhorar.',
        h('div', null,
          deductions.length ? h('div', { class: 'deductions' },
            h('div', { class: 'small muted' }, 'O que poderia ser melhor:'),
            h('ul', null, deductions.map(d => h('li', null, h('span', { html: MD.inline(d.text) }), d.concept ? Widgets.concept(d.concept) : null)))) : null,
          step.solution ? h('details', { class: 'model-answer', open: stars < 3 },
            h('summary', null, 'SQL de referência'),
            h('div', { class: 'md', html: MD.codeBlock(step.solution, 'sql') }),
            step.solutionExplanation ? h('div', { class: 'md', html: MD.render(step.solutionExplanation) }) : null) : null)));
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ctx.say(outcome.gaveUp ? 'Leia a solução com calma — e experimente rodar variações dela.' : U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')),
        { mood: stars === 3 ? 'cheer' : 'thinking', wait: false });
      const reviews = deductions.filter(d => d.concept || outcome.gaveUp).map(d => ({ text: d.text, concept: d.concept || step.concept }));
      const result = { stars, reviews, flags: outcome.solved ? ['sql-solved'] : [], hintsUsed };
      await ctx.continueButton(card, { result });
      return result;
    },
  });

  window.StepHelpers = Object.assign(window.StepHelpers || {}, { renderSqlTable: renderTable });
})();
