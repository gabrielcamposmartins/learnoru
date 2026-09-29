/*
 * Autoverificação do conteúdo DENTRO do navegador (Pyodide: Python 3.12, SQLite 3.39).
 * O validador (tools/validate-content.js) usa o CPython local, que pode ser mais novo;
 * isto garante que as soluções de referência também rodam no ambiente do jogo.
 *
 * Uso no console:  await SelfCheck.run()            // tudo
 *                  await SelfCheck.run('databases') // uma trilha (ou 'trilha/modulo')
 */
(function () {
  const ok = r => !r.error && !r.timedOut && r.exitCode === 0 && r.collected > 0;

  async function checkStep(track, mod, s, kataImpl) {
    const where = `${track.id}/${mod.id}/${s.id}`;
    const problems = [];
    if (s.type === 'code' && s.solution) {
      const perf = (s.perfTests || []).map(p => Object.assign({ perf: true, maxMs: 500 }, p));
      const tests = (s.tests || []).concat(perf);
      const r = await PyRunner.run(s.solution, tests, { timeoutMs: s.timeoutMs || 12000 });
      if (r.error) problems.push(`erro: ${r.error}`);
      if (r.timedOut) problems.push('tempo esgotado');
      tests.forEach((t, i) => {
        const x = r.results[i];
        if (!x) return;
        if (!x.passed) problems.push(`falha em "${t.name || t.expr || i}": ${x.error || `esperado ${x.expected}, obtido ${x.got}`}`);
        else if (t.perf && x.ms > t.maxMs) problems.push(`perf "${t.name}" ${x.ms}ms > ${t.maxMs}ms`);
      });
    } else if (s.type === 'sql' && s.solution) {
      const r = await PyRunner.sql({ schema: s.schema, variants: s.variants || [], mode: s.mode || 'query', verify: s.verify || [],
        orderMatters: !!s.orderMatters, plan: s.plan || null, user: s.solution, solution: s.solution });
      if (r.error || r.timedOut) problems.push(r.error || 'tempo esgotado');
      else {
        r.datasets.forEach(d => { if (!d.passed) problems.push(`dataset ${d.index}: ${d.message || d.userError}`); });
        if (r.plan && !r.plan.passed) problems.push(`plano: ${r.plan.text}`);
      }
    } else if (s.type === 'pytest' && s.solution) {
      const files = impl => ({ [`${s.module}.py`]: impl, [`test_${s.module}.py`]: s.solution });
      const base = await PyRunner.pytest(files(s.implementation), { timeoutMs: 20000 });
      if (!ok(base)) problems.push(`testes de referência falham: ${base.error || (base.collectErrors || [])[0] || (base.tests || []).filter(t => t.outcome !== 'passed').map(t => t.name).join(', ')}`);
      for (const m of s.mutants || []) {
        const r = await PyRunner.pytest(files(m.code), { timeoutMs: 20000 });
        if (ok(r)) problems.push(`mutante vivo: ${m.name}`);
      }
    } else if (s.type === 'tdd' && s.solutionImpl) {
      const files = impl => ({ [`${s.module}.py`]: impl, [`test_${s.module}.py`]: s.solutionTests });
      const green = await PyRunner.pytest(files(s.solutionImpl), { timeoutMs: 20000 });
      if (!ok(green)) problems.push('solutionTests não passam na solutionImpl');
      const before = s.kata && kataImpl.has(s.kata) ? kataImpl.get(s.kata) : (s.implStarter || '');
      const red = await PyRunner.pytest(files(before), { timeoutMs: 20000 });
      if (ok(red)) problems.push('sem fase Red');
      if ((s.checks || []).length) {
        const c = await PyRunner.run(s.solutionImpl, s.checks);
        if (c.error || !c.results.every(x => x.passed)) problems.push('checks falham na solutionImpl');
      }
      if (s.kata) kataImpl.set(s.kata, s.solutionImpl);
    } else {
      return null;
    }
    return { where, problems };
  }

  const SelfCheck = {
    async run(filter = '', { log = true } = {}) {
      const started = performance.now();
      const report = { checked: 0, failed: [] };
      for (const track of Game.getTracks()) {
        for (const mod of track.modules) {
          if (filter && !`${track.id}/${mod.id}`.includes(filter)) continue;
          const kataImpl = new Map();
          for (const s of mod.steps) {
            const res = await checkStep(track, mod, s, kataImpl);
            if (!res) continue;
            report.checked++;
            if (res.problems.length) {
              report.failed.push(res);
              if (log) console.warn('[SelfCheck] ✗', res.where, res.problems);
            }
          }
        }
      }
      report.seconds = Math.round((performance.now() - started) / 1000);
      if (log) console.log(`[SelfCheck] ${report.checked} questões práticas verificadas no Pyodide em ${report.seconds}s — ${report.failed.length} com problema.`);
      return report;
    },
  };

  window.SelfCheck = SelfCheck;
})();
