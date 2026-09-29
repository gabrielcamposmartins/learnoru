/*
 * Executa Python no navegador com Pyodide, dentro de um Web Worker.
 *
 * - O worker é criado a partir de um Blob, então funciona até abrindo o
 *   index.html direto do disco (file://).
 * - Loops infinitos: se a execução passar do tempo limite o worker é
 *   encerrado e recriado.
 * - Pacotes (pytest, sqlite3…) são baixados sob demanda a partir dos imports;
 *   o tempo limite pausa enquanto um pacote é baixado.
 * - Testes podem ser assíncronos: expressões que devolvem corrotinas são
 *   aguardadas e testes `code` aceitam `await` no nível superior.
 * - Além de rodar testes, analisa o código com `ast` e devolve métricas
 *   (profundidade de loops, complexidade, recursão, chamadas usadas...) que
 *   as questões usam para gerar os reviews.
 */
(function () {
  const PYODIDE_VERSION = '0.26.4';
  const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

  const HARNESS = String.raw`
import ast, sys, io, time, json, math, traceback, inspect

def _ciq_no_input(*a, **k):
    raise RuntimeError("input() não é suportado aqui — use os parâmetros da função.")

# ───────────────────────────── análise de código ─────────────────────────────

class _CiqMetrics(ast.NodeVisitor):
    def __init__(self):
        self.depth = 0
        self.max_depth = 0
        self.nest = 0
        self.max_nest = 0
        self.loops = 0
        self.while_true = False
        self.func_stack = []
        self.func_info = []
        self.funcs = []
        self.recursive = set()
        self.functions = []
        self.classes = []
        self.calls = set()
        self.names = set()
        self.attributes = set()
        self.imports = set()
        self.decorators = set()
        self.comprehensions = 0
        self.lambdas = 0
        self.uses_global = False
        self.try_blocks = 0
        self.returns = 0
        self.yields = 0
        self.awaits = 0
        self.ifs = 0
        self.fstrings = 0
        self.bare_excepts = 0
        self.broad_excepts = 0
        self.mutable_defaults = 0
        self.asserts = 0

    # complexidade ciclomática da função atual
    def _cx(self, n=1):
        if self.func_info:
            self.func_info[-1]["complexity"] += n

    def _block(self, body_nodes):
        self.nest += 1
        self.max_nest = max(self.max_nest, self.nest)
        if self.func_info:
            fi = self.func_info[-1]
            fi["nesting"] = max(fi["nesting"], self.nest - fi["base"])
        for n in body_nodes:
            self.visit(n)
        self.nest -= 1

    def _enter_loop(self, node, levels=1):
        self.loops += 1
        self._cx(1)
        self.depth += levels
        self.max_depth = max(self.max_depth, self.depth)
        for f in ("target", "iter", "test"):
            if hasattr(node, f) and getattr(node, f) is not None:
                self.visit(getattr(node, f))
        self._block(node.body)
        if node.orelse:
            self._block(node.orelse)
        self.depth -= levels

    def visit_For(self, node): self._enter_loop(node)
    def visit_AsyncFor(self, node): self._enter_loop(node)

    def visit_While(self, node):
        if isinstance(node.test, ast.Constant) and node.test.value is True:
            self.while_true = True
        self._enter_loop(node)

    def visit_If(self, node):
        self.ifs += 1
        self._cx(1)
        self.visit(node.test)
        self._block(node.body)
        # elif continua no mesmo nível de aninhamento
        if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            self.visit(node.orelse[0])
        elif node.orelse:
            self._block(node.orelse)

    def visit_IfExp(self, node):
        self._cx(1)
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        self._cx(len(node.values) - 1)
        self.generic_visit(node)

    def _with(self, node):
        for item in node.items:
            self.visit(item)
        self._block(node.body)

    visit_With = visit_AsyncWith = _with

    def visit_Try(self, node):
        self.try_blocks += 1
        self._block(node.body)
        for h in node.handlers:
            self._cx(1)
            if h.type is None:
                self.bare_excepts += 1
            elif isinstance(h.type, ast.Name) and h.type.id in ("Exception", "BaseException"):
                self.broad_excepts += 1
            if h.type is not None:
                self.visit(h.type)
            self._block(h.body)
        if node.orelse:
            self._block(node.orelse)
        if node.finalbody:
            self._block(node.finalbody)

    visit_TryStar = visit_Try

    def visit_Match(self, node):
        self.visit(node.subject)
        for case in node.cases:
            self._cx(1)
            self._block(case.body)

    def _comp(self, node):
        self.comprehensions += 1
        self._cx(len(node.generators) + sum(len(g.ifs) for g in node.generators))
        self.depth += len(node.generators)
        self.max_depth = max(self.max_depth, self.depth)
        self.generic_visit(node)
        self.depth -= len(node.generators)

    visit_ListComp = visit_SetComp = visit_DictComp = visit_GeneratorExp = _comp

    def _func(self, node):
        self.functions.append(node.name)
        for d in node.decorator_list:
            target = d.func if isinstance(d, ast.Call) else d
            if isinstance(target, ast.Name): self.decorators.add(target.id)
            elif isinstance(target, ast.Attribute): self.decorators.add(target.attr)
        a = node.args
        params = [x.arg for x in a.posonlyargs + a.args + a.kwonlyargs]
        if params and params[0] in ("self", "cls"):
            params = params[1:]
        n_params = len(params) + (1 if a.vararg else 0) + (1 if a.kwarg else 0)
        for dflt in a.defaults + [d for d in a.kw_defaults if d is not None]:
            if isinstance(dflt, (ast.List, ast.Dict, ast.Set)):
                self.mutable_defaults += 1
        info = {"name": node.name, "lines": (getattr(node, "end_lineno", node.lineno) - node.lineno + 1),
                "params": n_params, "complexity": 1, "nesting": 0, "base": self.nest}
        self.func_info.append(info)
        self.func_stack.append(node.name)
        saved = self.depth
        self.depth = 0  # loops de funções internas não somam com os de fora
        for d in node.decorator_list:
            self.visit(d)
        self.visit(node.args)
        for s in node.body:
            self.visit(s)
        self.depth = saved
        self.func_stack.pop()
        self.func_info.pop()
        info.pop("base")
        self.funcs.append(info)

    visit_FunctionDef = visit_AsyncFunctionDef = _func

    def visit_ClassDef(self, node):
        bases = []
        for b in node.bases:
            if isinstance(b, ast.Name): bases.append(b.id)
            elif isinstance(b, ast.Attribute): bases.append(b.attr)
            elif isinstance(b, ast.Subscript) and isinstance(b.value, ast.Name): bases.append(b.value.id)
        methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        for d in node.decorator_list:
            target = d.func if isinstance(d, ast.Call) else d
            if isinstance(target, ast.Name): self.decorators.add(target.id)
            elif isinstance(target, ast.Attribute): self.decorators.add(target.attr)
        self.classes.append({"name": node.name, "bases": bases, "methods": methods})
        self.generic_visit(node)

    def visit_Call(self, node):
        f = node.func
        name = None
        if isinstance(f, ast.Name): name = f.id
        elif isinstance(f, ast.Attribute): name = f.attr
        if name:
            self.calls.add(name)
            # Recursão: f() direto ou self.f()/cls.f() — super().f() e obj.f() não contam.
            if self.func_stack and name == self.func_stack[-1]:
                direct = isinstance(f, ast.Name)
                via_self = isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id in ("self", "cls")
                if direct or via_self:
                    self.recursive.add(name)
        self.generic_visit(node)

    def visit_Name(self, node):
        self.names.add(node.id)

    def visit_Attribute(self, node):
        self.attributes.add(node.attr)
        self.generic_visit(node)

    def visit_Import(self, node):
        for a in node.names: self.imports.add(a.name.split(".")[0])

    def visit_ImportFrom(self, node):
        if node.module: self.imports.add(node.module.split(".")[0])
        for a in node.names: self.names.add(a.name)

    def visit_Lambda(self, node):
        self.lambdas += 1
        self.generic_visit(node)

    def visit_Global(self, node): self.uses_global = True
    def visit_Nonlocal(self, node): self.uses_global = True

    def visit_Return(self, node):
        self.returns += 1
        self.generic_visit(node)

    def visit_Yield(self, node):
        self.yields += 1
        self.generic_visit(node)

    visit_YieldFrom = visit_Yield

    def visit_Await(self, node):
        self.awaits += 1
        self.generic_visit(node)

    def visit_JoinedStr(self, node):
        self.fstrings += 1
        self.generic_visit(node)

    def visit_Assert(self, node):
        self.asserts += 1
        self.generic_visit(node)

def _ciq_analyze(src):
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return json.dumps({"syntaxError": f"{e.msg} (linha {e.lineno})"})
    m = _CiqMetrics()
    m.visit(tree)
    lines = [l for l in src.splitlines() if l.strip() and not l.strip().startswith("#")]
    funcs = m.funcs
    return json.dumps({
        "loopDepth": m.max_depth,
        "loops": m.loops,
        "whileTrue": m.while_true,
        "recursion": bool(m.recursive),
        "recursive": sorted(m.recursive),
        "functions": m.functions,
        "funcs": funcs,
        "maxComplexity": max([f["complexity"] for f in funcs] or [1]),
        "maxFunctionLines": max([f["lines"] for f in funcs] or [0]),
        "maxParams": max([f["params"] for f in funcs] or [0]),
        "maxNesting": m.max_nest,
        "classes": m.classes,
        "calls": sorted(m.calls),
        "names": sorted(m.names),
        "attributes": sorted(m.attributes),
        "imports": sorted(m.imports),
        "decorators": sorted(m.decorators),
        "comprehensions": m.comprehensions,
        "lambdas": m.lambdas,
        "usesGlobal": m.uses_global,
        "tryBlocks": m.try_blocks,
        "bareExcepts": m.bare_excepts,
        "broadExcepts": m.broad_excepts,
        "mutableDefaults": m.mutable_defaults,
        "returns": m.returns,
        "yields": m.yields,
        "awaits": m.awaits,
        "ifs": m.ifs,
        "fstrings": m.fstrings,
        "asserts": m.asserts,
        "lines": len(lines),
    })

# ───────────────────────────── execução de testes ─────────────────────────────

def _ciq_short_tb(e):
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<seu_codigo>"]
    where = f" (linha {frames[-1].lineno})" if frames else ""
    msg = str(e)
    return f"{type(e).__name__}{': ' + msg if msg else ''}{where}"

def _ciq_repr(v):
    try:
        s = repr(v)
    except Exception:
        s = "<objeto>"
    return s if len(s) <= 400 else s[:400] + "…"

def _ciq_compare(got, exp, mode):
    if mode == "sorted": return sorted(got) == sorted(exp)
    if mode == "set": return set(got) == set(exp)
    if mode == "approx": return math.isclose(got, exp, rel_tol=1e-6, abs_tol=1e-9)
    if mode == "nested_sorted": return sorted(sorted(x) for x in got) == sorted(sorted(x) for x in exp)
    if mode == "truthy": return bool(got) == bool(exp)
    if mode == "is": return got is exp
    return got == exp

def _ciq_exec_user(src):
    ns = {"__name__": "__ciq__", "input": _ciq_no_input}
    exec(compile(src, "<seu_codigo>", "exec"), ns)
    return ns

_CIQ_AWAIT = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT

async def _ciq_exec_async(code, ns, name="<teste>"):
    r = eval(compile(code, name, "exec", flags=_CIQ_AWAIT), ns)
    if inspect.iscoroutine(r):
        await r

async def _ciq_eval_async(expr, ns):
    v = eval(compile(expr, "<teste>", "eval", flags=_CIQ_AWAIT), ns)
    if inspect.isawaitable(v):
        v = await v
    return v

async def _ciq_run(src, tests_json, report):
    tests = json.loads(tests_json)
    old = sys.stdout
    out = io.StringIO()
    try:
        compile(src, "<seu_codigo>", "exec")
    except SyntaxError as e:
        return json.dumps({"error": f"SyntaxError: {e.msg} (linha {e.lineno})", "stdout": ""})
    sys.stdout = out
    try:
        _ciq_exec_user(src)
    except Exception as e:
        return json.dumps({"error": _ciq_short_tb(e), "stdout": out.getvalue()[:5000]})
    finally:
        sys.stdout = old
    summary = {"error": None, "stdout": out.getvalue()[:5000]}

    for idx, t in enumerate(tests):
        r = {"index": idx}
        buf = io.StringIO()
        sys.stdout = buf
        t0 = time.perf_counter()
        try:
            ns = _ciq_exec_user(src)
            if t.get("setup"):
                await _ciq_exec_async(t["setup"], ns, "<setup>")
            t0 = time.perf_counter()
            if t.get("code"):
                await _ciq_exec_async(t["code"], ns)
                r["passed"] = True
            else:
                got = await _ciq_eval_async(t["expr"], ns)
                r["ms"] = round((time.perf_counter() - t0) * 1000, 2)
                r["got"] = _ciq_repr(got)
                if t.get("expected") is not None:
                    exp = await _ciq_eval_async(t["expected"], ns)
                    r["expected"] = _ciq_repr(exp)
                    r["passed"] = bool(_ciq_compare(got, exp, t.get("compare", "eq")))
                else:
                    r["passed"] = True
        except AssertionError as e:
            r["passed"] = False
            r["error"] = str(e) or "assert falhou"
        except Exception as e:
            r["passed"] = False
            r["error"] = _ciq_short_tb(e)
        finally:
            sys.stdout = old
        if "ms" not in r:
            r["ms"] = round((time.perf_counter() - t0) * 1000, 2)
        r["stdout"] = buf.getvalue()[:1000]
        report(json.dumps(r))
    return json.dumps(summary)

# ─────────────────────────────────── pytest ───────────────────────────────────

def _ciq_pytest_msg(report, limit=700):
    text = getattr(report, "longreprtext", "") or str(report.longrepr or "")
    lines = text.splitlines()
    err = [l[1:].strip() for l in lines if l.startswith("E ")]
    msg = "\n".join(err) if err else "\n".join(lines[-4:])
    return msg[:limit]

def _ciq_pytest(files_json):
    """Roda o pytest sobre arquivos {nome: código} num diretório temporário."""
    import os, shutil, tempfile
    try:
        import pytest
    except ImportError:
        return json.dumps({"error": "pytest não está disponível neste Python."})
    files = json.loads(files_json)
    d = tempfile.mkdtemp(prefix="ciq_")
    for name, src in files.items():
        with open(os.path.join(d, name), "w", encoding="utf-8") as fh:
            fh.write(src)
    for name in files:
        if name.endswith(".py"):
            sys.modules.pop(name[:-3], None)

    class _Collector:
        def __init__(self):
            self.tests = []
            self.collected = 0
            self.errors = []

        def pytest_collection_modifyitems(self, session, config, items):
            self.collected = len(items)

        def pytest_collectreport(self, report):
            if report.failed:
                self.errors.append(_ciq_pytest_msg(report, 1500))

        def pytest_runtest_logreport(self, report):
            if report.when == "call" or (report.when == "setup" and report.outcome != "passed"):
                outcome = report.outcome
                if report.when == "setup" and outcome == "failed":
                    outcome = "error"
                self.tests.append({
                    "name": report.nodeid.split("::", 1)[-1],
                    "outcome": outcome,
                    "message": _ciq_pytest_msg(report) if outcome in ("failed", "error") else "",
                    "stdout": (getattr(report, "capstdout", "") or "")[:500],
                })

    col = _Collector()
    out = io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    sys.path.insert(0, d)
    t0 = time.perf_counter()
    try:
        code = pytest.main([d, "-q", "-p", "no:cacheprovider", "-p", "no:faulthandler",
                            "--import-mode=importlib", "--capture=sys", "--tb=short",
                            "--color=no", "-rN", "--rootdir", d], plugins=[col])
    except BaseException as e:
        code = 3
        col.errors.append(_ciq_short_tb(e))
    finally:
        sys.stdout, sys.stderr = old_out, old_err
        if d in sys.path:
            sys.path.remove(d)
        for name in files:
            if name.endswith(".py"):
                sys.modules.pop(name[:-3], None)
        shutil.rmtree(d, ignore_errors=True)
    return json.dumps({
        "exitCode": int(code),
        "collected": col.collected,
        "tests": col.tests,
        "collectErrors": col.errors,
        "ms": round((time.perf_counter() - t0) * 1000, 1),
        "output": out.getvalue()[-3000:],
    })

# ──────────────────────────────────── SQL ────────────────────────────────────

def _ciq_sql_split(script):
    """Separa um script em comandos (respeita ';' dentro de strings e comentários)."""
    import sqlite3
    stmts, buf = [], ""
    for ch in script:
        buf += ch
        if ch == ";" and sqlite3.complete_statement(buf):
            if buf.strip(" \t\r\n;"):
                stmts.append(buf)
            buf = ""
    if buf.strip():
        stmts.append(buf)
    return stmts

def _ciq_sql_norm(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, float):
        r = round(v, 6)
        return int(r) if r == int(r) and abs(r) < 1e15 else r
    if isinstance(v, (bytes, bytearray)):
        return bytes(v).hex()
    return v

def _ciq_sql_db(schema, variant=None):
    import sqlite3
    conn = sqlite3.connect(":memory:")
    conn.isolation_level = None  # o jogador controla BEGIN/COMMIT
    start = time.perf_counter()
    conn.set_progress_handler(lambda: 1 if time.perf_counter() - start > 5 else 0, 20000)
    conn.execute("PRAGMA foreign_keys = ON")
    if schema:
        conn.executescript(schema)
    if variant:
        conn.executescript(variant)
    return conn

def _ciq_sql_exec(conn, script):
    cols, rows = None, None
    for stmt in _ciq_sql_split(script):
        cur = conn.execute(stmt)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [tuple(_ciq_sql_norm(v) for v in r) for r in cur.fetchall()]
    return cols, rows

def _ciq_sql_err(e):
    msg = str(e)
    if "interrupted" in msg:
        return "Consulta interrompida: demorou demais (recursão sem fim?)."
    return f"{type(e).__name__}: {msg}"

def _ciq_sql_key(row):
    return json.dumps(row, default=str)

def _ciq_sql_cmp(user, exp, order_matters):
    ucols, urows = user
    ecols, erows = exp
    if urows is None:
        return False, "Seu SQL não devolveu nenhum resultado (faltou um SELECT?)."
    if len(ucols) != len(ecols):
        return False, f"Seu resultado tem {len(ucols)} coluna(s); o esperado tem {len(ecols)}."
    if len(urows) != len(erows):
        return False, f"Seu resultado tem {len(urows)} linha(s); o esperado tem {len(erows)}."
    same_set = sorted(urows, key=_ciq_sql_key) == sorted(erows, key=_ciq_sql_key)
    if order_matters and urows != erows:
        if same_set:
            return False, "As linhas estão certas, mas a ordem não — confira o ORDER BY."
        return False, "Os valores não batem com o esperado."
    if not same_set:
        return False, "Os valores não batem com o esperado."
    return True, ""

def _ciq_sql_preview(cols, rows, limit):
    if rows is None:
        return None
    return {"cols": cols, "rows": [list(r) for r in rows[:limit]], "rowCount": len(rows)}

def _ciq_sql(payload_json):
    """
    Avalia SQL do jogador em SQLite.
    mode 'query':  compara o resultado da consulta com o da solução.
    mode 'script': roda o script (DDL/DML) e compara as consultas 'verify'.
    'variants' são datasets ocultos (SQL aplicado depois do schema) contra consultas "chumbadas".
    """
    import sqlite3
    p = json.loads(payload_json)
    mode = p.get("mode", "query")
    limit = p.get("maxRows", 50)
    order = bool(p.get("orderMatters"))
    t0 = time.perf_counter()
    datasets = [None] + list(p.get("variants") or [])
    if p.get("runOnly"):
        datasets = [None]
    out = {"error": None, "datasets": [], "plan": None}
    for i, variant in enumerate(datasets):
        ds = {"index": i, "hidden": i > 0}
        try:
            cu = _ciq_sql_db(p.get("schema", ""), variant)
            cs = None if p.get("runOnly") else _ciq_sql_db(p.get("schema", ""), variant)
        except sqlite3.Error as e:
            return json.dumps({"error": "Erro no schema do exercício: " + str(e)})
        try:
            ucols, urows = _ciq_sql_exec(cu, p.get("user", ""))
        except sqlite3.Error as e:
            ds.update({"passed": False, "userError": _ciq_sql_err(e), "message": _ciq_sql_err(e)})
            out["datasets"].append(ds)
            continue
        if mode == "script":
            verify = p.get("verify") or []
            try:
                ures = [_ciq_sql_exec(cu, q) for q in verify]
            except sqlite3.Error as e:
                ds.update({"passed": False, "message": "Depois do seu script, a verificação falhou: " + _ciq_sql_err(e)})
                out["datasets"].append(ds)
                continue
            if not ds["hidden"]:
                ds["user"] = _ciq_sql_preview(ucols, urows, limit)
                ds["verifyUser"] = [_ciq_sql_preview(c, r, limit) for c, r in ures]
            if p.get("runOnly"):
                out["datasets"].append(ds)
                continue
            _ciq_sql_exec(cs, p.get("solution", ""))
            sres = [_ciq_sql_exec(cs, q) for q in verify]
            ok, msg = True, ""
            for k, (u, s) in enumerate(zip(ures, sres)):
                good, why = _ciq_sql_cmp(u, s, order)
                if not good:
                    ok, msg = False, f"Verificação {k + 1}: {why}"
                    break
            ds.update({"passed": ok, "message": msg})
            if not ds["hidden"]:
                ds["verifyExpected"] = [_ciq_sql_preview(c, r, limit) for c, r in sres]
        else:
            if not ds["hidden"]:
                ds["user"] = _ciq_sql_preview(ucols, urows, limit)
            if p.get("runOnly"):
                out["datasets"].append(ds)
                continue
            scols, srows = _ciq_sql_exec(cs, p.get("solution", ""))
            ok, msg = _ciq_sql_cmp((ucols, urows), (scols, srows), order)
            ds.update({"passed": ok, "message": msg})
            if not ds["hidden"]:
                ds["expected"] = _ciq_sql_preview(scols, srows, limit)
        if i == 0 and p.get("plan") and not p.get("runOnly"):
            plan = p["plan"]
            try:
                rows = cu.execute("EXPLAIN QUERY PLAN " + plan["sql"]).fetchall()
                text = "\n".join(str(r[-1]) for r in rows)
                low = text.lower()
                missing = [s for s in plan.get("mustContain", []) if s.lower() not in low]
                forbidden = [s for s in plan.get("mustNotContain", []) if s.lower() in low]
                out["plan"] = {"text": text, "passed": not missing and not forbidden, "missing": missing, "forbidden": forbidden}
            except sqlite3.Error as e:
                out["plan"] = {"text": _ciq_sql_err(e), "passed": False, "missing": [], "forbidden": []}
        out["datasets"].append(ds)
    out["ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return json.dumps(out)

def _ciq_sql_inspect(schema):
    """Lista as tabelas do schema com colunas e algumas linhas de exemplo."""
    import sqlite3
    try:
        conn = _ciq_sql_db(schema)
    except sqlite3.Error as e:
        return json.dumps({"error": str(e)})
    tables = []
    names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")]
    for name in names:
        cols = [{"name": c[1], "type": c[2], "pk": bool(c[5])} for c in conn.execute(f'PRAGMA table_info("{name}")')]
        count = conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        rows = [[_ciq_sql_norm(v) for v in r] for r in conn.execute(f'SELECT * FROM "{name}" LIMIT 6')]
        tables.append({"name": name, "columns": cols, "rows": rows, "count": count})
    return json.dumps({"tables": tables})
`;

  const WORKER_SRC = `
    const HARNESS = ${JSON.stringify(HARNESS)};
    let py = null;
    const ready = (async () => {
      importScripts(${JSON.stringify(PYODIDE_URL + 'pyodide.js')});
      py = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} });
      py.runPython(HARNESS);
      postMessage({ type: 'ready', version: py.version });
    })().catch(e => postMessage({ type: 'load-error', error: String(e && e.message || e) }));

    // Baixa pacotes pedidos pelos imports; o tempo limite fica pausado enquanto isso.
    async function withPackages(id, fn) {
      postMessage({ id, type: 'pkg-start' });
      try { await fn(); } catch (e) { /* código com erro de sintaxe: o run reporta */ }
      postMessage({ id, type: 'pkg-end' });
    }

    // O hashlib do Pyodide vem sem OpenSSL (sem pbkdf2_hmac/scrypt). Quando o código usa
    // hashlib/hmac, carrega o _hashlib (OpenSSL) uma vez e recarrega os módulos.
    let hashlibReady = false;
    async function ensureHashlib(text) {
      if (hashlibReady || !/hashlib|hmac|pbkdf2|scrypt/.test(text)) return;
      await py.loadPackagesFromImports('import _hashlib');
      py.runPython('import importlib, hashlib, hmac\\nimportlib.reload(hashlib)\\nimportlib.reload(hmac)');
      hashlibReady = true;
    }

    onmessage = async (ev) => {
      const { id, action, code, tests } = ev.data;
      try {
        await ready;
        if (!py) throw new Error('Pyodide não carregou');
        if (action === 'analyze') {
          const res = py.globals.get('_ciq_analyze')(code);
          postMessage({ id, type: 'done', payload: JSON.parse(res) });
        } else if (action === 'pytest') {
          await withPackages(id, async () => {
            await py.loadPackage('pytest');
            const all = Object.values(tests).join('\\n');
            await py.loadPackagesFromImports(all);
            await ensureHashlib(all);
          });
          const res = py.globals.get('_ciq_pytest')(JSON.stringify(tests));
          postMessage({ id, type: 'done', payload: JSON.parse(res) });
        } else if (action === 'sql' || action === 'sqlInspect') {
          await withPackages(id, () => py.loadPackage('sqlite3'));
          const res = action === 'sql'
            ? py.globals.get('_ciq_sql')(JSON.stringify(tests))
            : py.globals.get('_ciq_sql_inspect')(code);
          postMessage({ id, type: 'done', payload: JSON.parse(res) });
        } else if (action === 'run') {
          const extra = (tests || []).map(t => [t.setup, t.code, t.expr, t.expected].filter(Boolean).join('\\n')).join('\\n');
          await withPackages(id, async () => {
            await py.loadPackagesFromImports(code + '\\n' + extra);
            await ensureHashlib(code + '\\n' + extra);
          });
          const report = (json) => postMessage({ id, type: 'test', payload: JSON.parse(json) });
          const res = await py.globals.get('_ciq_run')(code, JSON.stringify(tests || []), report);
          postMessage({ id, type: 'done', payload: JSON.parse(res) });
        }
      } catch (e) {
        postMessage({ id, type: 'done', payload: { error: 'Erro interno: ' + String(e && e.message || e) } });
      }
    };
  `;

  let worker = null;
  let status = 'idle';
  let seq = 0;
  const pending = new Map();
  const statusListeners = new Set();

  function setStatus(s, detail) {
    status = s;
    statusListeners.forEach(fn => fn(s, detail));
  }

  function spawn() {
    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    setStatus('loading');
    worker.onmessage = ev => {
      const msg = ev.data;
      if (msg.type === 'ready') { setStatus('ready', msg.version); return; }
      if (msg.type === 'load-error') {
        setStatus('error', msg.error);
        for (const p of pending.values()) p.resolve({ error: 'Não foi possível carregar o Python (Pyodide). Verifique sua conexão com a internet.', loadError: true, results: [] });
        pending.clear();
        worker.terminate();
        worker = null;
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'pkg-start') {
        clearTimeout(p.timer);
        p.timer = null;
      } else if (msg.type === 'pkg-end') {
        if (p.arm) p.arm();
      } else if (msg.type === 'test') {
        p.results.push(msg.payload);
        p.onTest && p.onTest(msg.payload);
      } else if (msg.type === 'done') {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        p.resolve(Object.assign({ results: p.results }, msg.payload));
      }
    };
    worker.onerror = e => {
      console.error('[PyRunner]', e);
    };
  }

  function ensure() {
    if (!worker) spawn();
  }

  function request(action, code, tests, { timeoutMs = 8000, onTest } = {}) {
    ensure();
    const id = ++seq;
    return new Promise(resolve => {
      const p = { resolve, results: [], onTest, timer: null, arm: null };
      pending.set(id, p);
      p.arm = () => {
        clearTimeout(p.timer);
        p.timer = setTimeout(() => {
          // Tempo esgotado: provavelmente um loop infinito ou solução muito lenta.
          pending.delete(id);
          worker && worker.terminate();
          worker = null;
          for (const other of pending.values()) other.resolve({ error: 'Execução cancelada.', results: [] });
          pending.clear();
          resolve({
            error: null,
            timedOut: true,
            timedOutIndex: p.results.length,
            results: p.results,
            stdout: '',
          });
          spawn();
        }, timeoutMs);
      };
      // O tempo limite só começa a contar quando o Python estiver pronto.
      if (status === 'ready') p.arm();
      else {
        const off = PyRunner.onStatus(s => {
          if (s === 'ready' && pending.has(id)) { off(); p.arm(); }
          if (s === 'error') off();
        });
      }
      worker.postMessage({ id, action, code, tests });
    });
  }

  const PyRunner = {
    get status() { return status; },
    onStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    warmup() { ensure(); },
    retry() { if (worker) worker.terminate(); worker = null; spawn(); },
    /** Roda o código do jogador contra testes ({expr, expected} | {code}); testes podem usar await. */
    run(code, tests, opts) { return request('run', code, tests, opts); },
    /**
     * Roda o pytest sobre arquivos { 'modulo.py': código, 'test_modulo.py': código }.
     * Resolve com { exitCode, collected, tests: [{name, outcome, message, stdout}], collectErrors, output }
     * ou { timedOut: true } / { error }.
     * exitCode: 0 tudo passou · 1 falhas · 2 erro de coleta · 5 nenhum teste encontrado.
     */
    pytest(files, { timeoutMs = 10000 } = {}) {
      return request('pytest', null, files, { timeoutMs });
    },
    /** Avalia SQL em SQLite (ver _ciq_sql no harness). */
    sql(payload, { timeoutMs = 10000 } = {}) {
      return request('sql', null, payload, { timeoutMs });
    },
    /** Tabelas, colunas e linhas de exemplo de um schema. */
    sqlInspect(schema) {
      return request('sqlInspect', schema, null, { timeoutMs: 10000 });
    },
    async analyze(code) {
      const res = await request('analyze', code, null, { timeoutMs: 5000 });
      return res && !res.error && !res.timedOut ? res : null;
    },
  };

  window.PyRunner = PyRunner;
})();
