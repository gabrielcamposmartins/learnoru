#!/usr/bin/env node
/*
 * Valida o conteúdo do jogo:
 *  - estrutura dos módulos/etapas (campos obrigatórios, ids únicos, mcq com alternativa correta…)
 *  - code:   a SOLUÇÃO passa nos testes; o starter não; a solução não aciona os próprios reviews
 *  - pytest: os testes de referência passam no código correto e detectam TODOS os mutantes
 *  - tdd:    cada ciclo fica vermelho no código anterior e verde na implementação de referência;
 *            os ciclos de um mesmo kata são encadeados
 *
 * Uso: node tools/validate-content.js [filtro]
 *      (filtro opcional: parte do caminho, ex. "leetcode" ou "02-hash-map")
 * Requer: node e python (3.10+) com pytest. Para usar outro Python: CIQ_PYTHON=/caminho/python
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const filter = process.argv[2] || '';
const PYTHON = process.env.CIQ_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

// ── Carrega registry + conteúdo num contexto isolado ─────────────────────────
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
const run = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
run('js/core/registry.js');
for (const t of ['say', 'section']) sandbox.Game.registerStepType(t, {});
for (const t of ['mcq', 'open', 'code', 'pytest', 'tdd', 'order', 'match', 'sql']) sandbox.Game.registerStepType(t, { scored: true });
run('content/manifest.js');

let errors = 0;
let warnings = 0;
const err = (where, msg) => { errors++; console.log(`  ✗ ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`  ⚠ ${where}: ${msg}`); };

for (const file of sandbox.CONTENT_MANIFEST) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    if (!filter || file.includes(filter)) err(file, 'arquivo listado no manifest não existe');
    continue;
  }
  try { run(file); } catch (e) { err(file, `erro ao carregar: ${e.message}`); }
}

// ── Personagens: sprites existem e trilhas apontam para personagens válidos ──
const charIds = new Set(sandbox.Game.getCharacters().map(c => c.id));
for (const c of sandbox.Game.getCharacters()) {
  for (const [name, src] of Object.entries(c.sprites || {})) {
    if (!fs.existsSync(path.join(ROOT, src))) err(`personagem ${c.id}`, `sprite "${name}" não encontrado: ${src}`);
  }
  if (c.sprites && !c.sprites.idle) warn(`personagem ${c.id}`, 'sem sprite "idle" (usado como padrão)');
}
for (const t of sandbox.Game.getTracks()) {
  if (t.character && !charIds.has(t.character)) err(`trilha ${t.id}`, `personagem "${t.character}" não registrado`);
  for (const m of t.modules) if (m.character && !charIds.has(m.character)) err(`${t.id}/${m.id}`, `personagem "${m.character}" não registrado`);
}

// ── Execução em Python (usa o mesmo harness do jogo) ─────────────────────────
const runnerSrc = fs.readFileSync(path.join(ROOT, 'js/core/python-runner.js'), 'utf8');
const harness = runnerSrc.match(/const HARNESS = String\.raw`([\s\S]*?)`;/)[1];

const PY_DRIVER = `
import json, sys, asyncio
${harness}
jobs = json.load(sys.stdin)
out = []
for job in jobs:
    kind = job["kind"]
    if kind == "run":
        results = []
        summary = json.loads(asyncio.run(_ciq_run(job["code"], json.dumps(job["tests"]), lambda s: results.append(json.loads(s)))))
        out.append({"summary": summary, "results": results})
    elif kind == "pytest":
        out.append(json.loads(_ciq_pytest(json.dumps(job["files"]))))
    elif kind == "analyze":
        out.append(json.loads(_ciq_analyze(job["code"])))
    elif kind == "sql":
        out.append(json.loads(_ciq_sql(json.dumps(job["payload"]))))
    elif kind == "sqlInspect":
        out.append(json.loads(_ciq_sql_inspect(job["schema"])))
print(json.dumps(out))
`;

function runPython(jobs) {
  const tmp = path.join(os.tmpdir(), `ciq-validate-${process.pid}.py`);
  fs.writeFileSync(tmp, PY_DRIVER);
  const res = spawnSync(PYTHON, [tmp], { input: JSON.stringify(jobs), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  fs.unlinkSync(tmp);
  if (res.status !== 0) throw new Error(res.stderr || res.error);
  return JSON.parse(res.stdout);
}

// Fila de jobs: cada job tem um callback que recebe o resultado.
const jobs = [];
const job = (payload, onResult) => jobs.push({ payload, onResult });
const pyOk = r => !r.error && r.exitCode === 0 && r.collected > 0;
const pyDescribe = r => r.error || (r.collectErrors || [])[0]
  || (r.tests || []).filter(t => t.outcome !== 'passed').map(t => `${t.name}: ${t.message.split('\n')[0]}`).join('; ')
  || `exitCode ${r.exitCode}, ${r.collected} teste(s)`;
let needsPytest = false;

function checkReviews(where, step, code) {
  if (!(step.reviews || []).length) return;
  job({ kind: 'analyze', code }, metrics => {
    step.reviews.forEach((rv, i) => {
      let hit = false;
      try { hit = rv.when(metrics, code); } catch (e) { err(where, `review[${i}].when lançou erro: ${e.message}`); }
      if (hit) err(where, `a solução de referência aciona o review[${i}]: "${rv.text.slice(0, 60)}…"`);
    });
  });
}

// ── Validação estrutural + montagem dos jobs ─────────────────────────────────
const ids = new Map();
const VALID = new Set(['say', 'section', 'mcq', 'open', 'code', 'pytest', 'tdd', 'order', 'match', 'sql']);
const SCORED = new Set(['mcq', 'open', 'code', 'pytest', 'tdd', 'order', 'match', 'sql']);
const MOODS = new Set(['neutral', 'happy', 'thinking', 'surprised', 'concerned', 'cheer', 'angry']);

for (const track of sandbox.Game.getTracks()) {
  for (const mod of track.modules) {
    const where0 = `${track.id}/${mod.id}`;
    if (filter && !where0.includes(filter)) continue;
    console.log(`▸ ${where0} (${mod.steps.length} etapas)`);
    if (!['lesson', 'interview', 'challenge'].includes(mod.kind)) err(where0, `kind inválido: ${mod.kind}`);
    if (!mod.steps.some(s => SCORED.has(s.type))) warn(where0, 'módulo sem questões pontuadas');
    if (track.units && track.units.length) {
      if (!mod.unit) warn(where0, 'módulo sem `unit` (a trilha tem unidades)');
      else if (!track.units.some(u => u.id === mod.unit)) err(where0, `unit "${mod.unit}" não existe em track.units`);
    }
    if (!mod.takeaways || !mod.takeaways.length) warn(where0, 'sem `takeaways` (resumo mostrado no fim do módulo)');
    (mod.glossary || []).forEach((g, k) => {
      if (!g.term || !g.definition) err(where0, `glossary[${k}] precisa de term e definition`);
      else if (g.definition.length > 420) warn(where0, `definição de "${g.term}" longa demais (${g.definition.length} caracteres; o tooltip pede 1–3 frases)`);
    });
    const kataImpl = new Map(); // kata -> implementação ao fim do ciclo anterior

    mod.steps.forEach((s, i) => {
      const where = `${where0}#${i} (${s.type}${s.id && !/^s\d+$/.test(s.id) ? ' ' + s.id : ''})`;
      if (!VALID.has(s.type)) return err(where, `tipo desconhecido "${s.type}"`);
      if (s.mood && !MOODS.has(s.mood)) err(where, `mood inválido "${s.mood}"`);
      for (const line of [].concat(s.text || [])) {
        if (line && typeof line === 'object' && line.mood && !MOODS.has(line.mood)) err(where, `mood inválido "${line.mood}"`);
      }
      if (SCORED.has(s.type)) {
        if (!s.id || /^s\d+$/.test(s.id)) warn(where, 'questão sem id explícito (progresso por questão fica instável)');
        else if (ids.has(s.id)) err(where, `id duplicado (também em ${ids.get(s.id)})`);
        else ids.set(s.id, where);
        if (!s.concept) warn(where, 'sem concept');
        if (!s.prompt) err(where, 'sem prompt');
      }
      if (s.type === 'say' && !s.text) err(where, 'say sem text');
      if (s.type === 'mcq') {
        if (!Array.isArray(s.options) || s.options.length < 2) err(where, 'precisa de 2+ opções');
        else if (!s.options.some(o => o.correct)) err(where, 'nenhuma opção correta');
        if (!s.explanation) warn(where, 'sem explanation');
      }
      if (s.type === 'open') {
        if (!s.rubric || !s.rubric.length) err(where, 'sem rubric');
        if (!s.modelAnswer) err(where, 'sem modelAnswer');
        (s.rubric || []).forEach((r, j) => { if (!r.keywords || !r.keywords.length) err(where, `rubric[${j}] sem keywords`); });
      }

      if (s.type === 'order') {
        if (!Array.isArray(s.items) || s.items.length < 3) err(where, 'order precisa de 3+ items (na ordem correta)');
        else if (new Set(s.items).size !== s.items.length) err(where, 'order com items repetidos');
        if (!s.explanation) warn(where, 'sem explanation');
      }
      if (s.type === 'match') {
        if (!Array.isArray(s.pairs) || s.pairs.length < 3) err(where, 'match precisa de 3+ pairs');
        else {
          if (s.pairs.some(p => !p.left || !p.right)) err(where, 'cada par precisa de left e right');
          if (new Set(s.pairs.map(p => p.left)).size !== s.pairs.length) err(where, 'match com itens da esquerda repetidos');
          if (new Set(s.pairs.map(p => p.right)).size !== s.pairs.length) err(where, 'match com itens da direita repetidos');
          if (s.pairs.length > 7) warn(where, 'mais de 7 pares fica cansativo');
        }
        if (!s.explanation) warn(where, 'sem explanation');
      }
      if (s.type === 'sql') {
        if (!s.schema) return err(where, 'sql sem schema');
        if (!s.solution) return err(where, 'sql sem solution');
        if ((s.mode || 'query') === 'script' && !(s.verify || []).length) return err(where, "mode 'script' precisa de verify");
        const base = { schema: s.schema, variants: s.variants || [], mode: s.mode || 'query', verify: s.verify || [], orderMatters: !!s.orderMatters, plan: s.plan || null, solution: s.solution };
        job({ kind: 'sqlInspect', schema: s.schema }, r => { if (r.error) err(where, `schema inválido: ${r.error}`); });
        job({ kind: 'sql', payload: Object.assign({}, base, { user: s.solution }) }, r => {
          if (r.error) return err(where, r.error);
          r.datasets.forEach(d => { if (!d.passed) err(where, `a solução falha no dataset ${d.index}: ${d.message || d.userError}`); });
          if (r.plan && !r.plan.passed) err(where, `o plano da solução não passa: ${r.plan.text.replace(/\n/g, ' | ')}`);
          if (!(s.variants || []).length) warn(where, 'sem variants — uma consulta "chumbada" passaria');
        });
        if (s.starter) {
          job({ kind: 'sql', payload: Object.assign({}, base, { user: s.starter }) }, r => {
            if (!r.error && r.datasets.every(d => d.passed) && (!r.plan || r.plan.passed)) warn(where, 'o starter já passa');
          });
        }
        (s.reviews || []).forEach((rv, k) => {
          let hit = false;
          try { hit = rv.when(s.solution); } catch (e) { err(where, `review[${k}].when lançou erro: ${e.message}`); }
          if (hit) err(where, `a solução aciona o review[${k}]`);
        });
      }

      if (s.type === 'code') {
        if (!s.solution) return err(where, 'sem solution');
        if (!s.tests || !s.tests.length) return err(where, 'sem tests');
        const tests = s.tests.concat((s.perfTests || []).map(t => Object.assign({ perf: true, maxMs: 500 }, t)));
        job({ kind: 'run', code: s.solution, tests }, o => {
          if (o.summary.error) return err(where, `solução lança erro: ${o.summary.error}`);
          tests.forEach((t, k) => {
            const r = o.results[k];
            const label = t.name || t.expr || `teste ${k + 1}`;
            if (!r) return err(where, `sem resultado para "${label}"`);
            if (!r.passed) err(where, `solução falha em "${label}": ${r.error || `esperado ${r.expected}, obtido ${r.got}`}`);
            else if (t.perf && r.ms > t.maxMs * 0.5) warn(where, `perf "${label}" levou ${r.ms}ms (limite ${t.maxMs}ms; Pyodide é ~2x mais lento que CPython)`);
          });
        });
        job({ kind: 'run', code: s.starter || '', tests: s.tests }, o => {
          const allPass = !o.summary.error && o.results.length === s.tests.length && o.results.every(r => r.passed);
          if (allPass) warn(where, 'o código inicial (starter) já passa em todos os testes');
        });
        checkReviews(where, s, s.solution);
      }

      if (s.type === 'pytest') {
        needsPytest = true;
        if (!s.module) return err(where, 'sem module');
        if (!s.implementation) return err(where, 'sem implementation');
        if (!s.solution) return err(where, 'sem solution (testes de referência)');
        if (!(s.mutants || []).length) warn(where, 'sem mutants — a questão não mede a qualidade dos testes');
        const files = impl => ({ [`${s.module}.py`]: impl, [`test_${s.module}.py`]: s.solution });
        job({ kind: 'pytest', files: files(s.implementation) }, r => {
          if (!pyOk(r)) return err(where, `testes de referência não passam no código correto: ${pyDescribe(r)}`);
          if (r.collected < (s.minTests ?? 1)) err(where, `testes de referência têm ${r.collected} teste(s), menos que minTests=${s.minTests}`);
        });
        (s.mutants || []).forEach((m, k) => {
          if (!m.name || !m.code) return err(where, `mutants[${k}] precisa de name e code`);
          if (m.code.trim() === s.implementation.trim()) err(where, `mutante "${m.name}" é idêntico ao código correto`);
          job({ kind: 'pytest', files: files(m.code) }, r => {
            if (pyOk(r)) err(where, `mutante "${m.name}" NÃO é detectado pelos testes de referência`);
            else if ((r.collectErrors || []).length) warn(where, `mutante "${m.name}" quebra a importação (é detectado, mas trivialmente): ${r.collectErrors[0].split('\n').pop()}`);
          });
        });
        checkReviews(where, s, s.solution);
      }

      if (s.type === 'tdd') {
        needsPytest = true;
        if (!s.module) return err(where, 'sem module');
        if (!s.solutionTests || !s.solutionImpl) return err(where, 'precisa de solutionTests e solutionImpl');
        const before = s.kata && kataImpl.has(s.kata) ? kataImpl.get(s.kata) : (s.implStarter || '');
        const reference = s.reference || s.solutionImpl;
        const files = impl => ({ [`${s.module}.py`]: impl, [`test_${s.module}.py`]: s.solutionTests });
        job({ kind: 'pytest', files: files(before) }, r => {
          if (pyOk(r)) err(where, 'solutionTests já passam no código do início do ciclo — o ciclo não tem fase Red');
        });
        job({ kind: 'pytest', files: files(reference) }, r => {
          if (!pyOk(r)) err(where, `solutionTests não passam na implementação de referência: ${pyDescribe(r)}`);
        });
        if (s.stub) {
          job({ kind: 'pytest', files: files(s.stub) }, r => {
            if (pyOk(r)) err(where, 'solutionTests passam no stub — o stub não serve para barrar testes vazios');
          });
        }
        if (s.reference) {
          job({ kind: 'pytest', files: files(s.solutionImpl) }, r => {
            if (!pyOk(r)) err(where, `solutionTests não passam em solutionImpl: ${pyDescribe(r)}`);
          });
        }
        if ((s.checks || []).length) {
          job({ kind: 'run', code: s.solutionImpl, tests: s.checks }, o => {
            if (o.summary.error) return err(where, `solutionImpl lança erro nos checks: ${o.summary.error}`);
            s.checks.forEach((c, k) => {
              const r = o.results[k];
              if (!r || !r.passed) err(where, `solutionImpl falha no check "${c.name || c.expr}": ${r ? (r.error || `esperado ${r.expected}, obtido ${r.got}`) : 'sem resultado'}`);
            });
          });
          job({ kind: 'run', code: before, tests: s.checks }, o => {
            if (!o.summary.error && o.results.length === s.checks.length && o.results.every(r => r.passed)) {
              warn(where, 'os checks já passam no código do início do ciclo');
            }
          });
        } else {
          warn(where, 'sem checks — "fake it" (valor chumbado) passaria direto pela fase Green');
        }
        checkReviews(where, s, s.solutionImpl);
        if (s.kata) kataImpl.set(s.kata, s.solutionImpl);
      }
    });
  }
}

// ── Executa ──────────────────────────────────────────────────────────────────
if (jobs.length) {
  if (needsPytest) {
    const probe = spawnSync(PYTHON, ['-c', 'import pytest'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      console.log(`\n✗ Há questões de pytest/TDD, mas o Python "${PYTHON}" não tem pytest.`);
      console.log('  Instale com `pip install pytest` ou aponte CIQ_PYTHON para um Python que tenha.');
      process.exit(2);
    }
  }
  console.log(`\n▸ Executando ${jobs.length} verificações em Python…`);
  let outputs;
  try {
    outputs = runPython(jobs.map(j => j.payload));
  } catch (e) {
    console.log('  ✗ Falha ao rodar Python:', e.message || e);
    process.exit(2);
  }
  outputs.forEach((o, k) => jobs[k].onResult(o));
}

console.log(`\n${errors ? '✗' : '✓'} ${errors} erro(s), ${warnings} aviso(s).`);
process.exit(errors ? 1 : 0);
