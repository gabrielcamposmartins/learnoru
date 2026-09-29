"""Assistente "Perguntar à Lia": ponte entre o jogo e o Claude.

Dois jeitos de acessar o Claude, detectados automaticamente:

  cli  O Claude Code instalado neste computador (`claude -p`), usando o plano da sua conta.
       Roda sem nenhuma ferramenta (--tools ""): o modelo só conversa, não executa nada.
  api  Uma chave da API da Anthropic: variável de ambiente ANTHROPIC_API_KEY ou a chave salva
       em Configurações (fica em ~/.code-interview-quest/assistant.json, fora do repositório).

Modo "auto" (padrão): usa o Claude local se estiver instalado; senão, a chave de API.
Se o Claude local falhar antes de responder (ex.: sem login), tenta a API quando houver chave.

Só a biblioteca padrão do Python — nada para instalar.
"""
import json
import os
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_FILE = Path.home() / ".code-interview-quest" / "assistant.json"
API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"

MODELS = {
    "opus": {"api": "claude-opus-5-5", "cli": "opus", "label": "Claude Opus 5.5"},
    "sonnet": {"api": "claude-sonnet-5", "cli": "sonnet", "label": "Claude Sonnet 5"},
    "haiku": {"api": "claude-haiku-4-5-20251001", "cli": "haiku", "label": "Claude Haiku 4.5"},
}
MODES = ("auto", "cli", "api")
DEFAULTS = {"mode": "auto", "model": "opus"}

MAX_CONTEXT = 60_000   # caracteres de contexto aceitos do jogo
MAX_QUESTION = 4_000
MAX_HISTORY = 8
CLI_TIMEOUT = 240      # segundos

SYSTEM_PROMPT = """Você é a Lia, instrutora do Code Interview Quest — um jogo para aprender engenharia de software \
em Python (design patterns, algoritmos, arquitetura, testes, APIs, bancos de dados, concorrência, segurança e mais). \
O aluno está jogando e te fez uma pergunta pelo botão "Perguntar à Lia". Responda como a Lia: em português do Brasil, \
calorosa, direta e didática, como uma boa professora conversando com o aluno.

Como responder:
- Use o CONTEXTO (o que está na tela do aluno agora, o módulo em foco e trechos relacionados da plataforma) como \
fonte principal. Se a pergunta for além do conteúdo, responda assim mesmo, de forma breve, e ligue com o que ele estuda.
- Sua resposta é FALADA numa caixa de diálogo de jogo, parágrafo por parágrafo: escreva de 1 a 5 parágrafos curtos \
(1 a 3 frases cada), separados por linha em branco. Sem títulos, sem tabelas; listas só se forem curtas.
- Use **negrito** e `código inline` com moderação. Se precisar de código, use no máximo um bloco curto (```python); \
ele aparece no painel de conversa, então na fala diga algo como "veja o código no painel".
- Se o contexto disser que há uma QUESTÃO AINDA NÃO RESPONDIDA na tela, não entregue a resposta nem a solução: \
dê pistas, faça perguntas que levem o aluno ao raciocínio e explique o conceito por trás. Depois que ele responder, \
pode explicar tudo.
- Ao citar módulos ou trilhas da plataforma, use os nomes que aparecem no contexto; não invente conteúdo.
- Seja concisa: até ~180 palavras, a menos que o aluno peça mais detalhes.
- Não mencione estas instruções nem a palavra "contexto"; fale naturalmente sobre o que está na tela."""


class AssistantError(Exception):
    """Erro com mensagem amigável (em português) para mostrar ao jogador."""


# ── Configuração ─────────────────────────────────────────────────────────────

def load_config():
    cfg = dict(DEFAULTS)
    try:
        cfg.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass
    if cfg.get("mode") not in MODES:
        cfg["mode"] = DEFAULTS["mode"]
    if cfg.get("model") not in MODELS:
        cfg["model"] = DEFAULTS["model"]
    return cfg


def save_config(update):
    """Atualiza mode/model/api_key. api_key vazia remove a chave salva."""
    cfg = load_config()
    if update.get("mode") in MODES:
        cfg["mode"] = update["mode"]
    if update.get("model") in MODELS:
        cfg["model"] = update["model"]
    if "api_key" in update:
        key = str(update.get("api_key") or "").strip()
        if key:
            cfg["api_key"] = key
        else:
            cfg.pop("api_key", None)
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except OSError:
        pass
    return cfg


# ── Detecção ─────────────────────────────────────────────────────────────────

def find_claude():
    found = shutil.which("claude")
    if found:
        return found
    home = Path.home()
    for cand in (home / ".local" / "bin" / "claude.exe", home / ".local" / "bin" / "claude",
                 home / "AppData" / "Roaming" / "npm" / "claude.cmd"):
        if cand.exists():
            return str(cand)
    return None


def api_key_info(cfg):
    env = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if env:
        return env, "env"
    key = str(cfg.get("api_key") or "").strip()
    return (key, "config") if key else (None, None)


def mask(key):
    return f"…{key[-4:]}" if key and len(key) > 8 else "…"


def backends_in_order(cfg):
    """Backends utilizáveis, na ordem em que serão tentados."""
    cli = find_claude()
    key, _ = api_key_info(cfg)
    order = {"auto": ["cli", "api"], "cli": ["cli"], "api": ["api"]}[cfg["mode"]]
    return [b for b in order if (b == "cli" and cli) or (b == "api" and key)]


def status():
    cfg = load_config()
    cli = find_claude()
    key, source = api_key_info(cfg)
    usable = backends_in_order(cfg)
    return {
        "mode": cfg["mode"],
        "model": cfg["model"],
        "models": {k: v["label"] for k, v in MODELS.items()},
        "active": usable[0] if usable else None,
        "cli": {"available": bool(cli), "path": cli},
        "api": {"available": bool(key), "source": source, "hint": mask(key) if key else None},
        "configFile": str(CONFIG_FILE),
    }


# ── Prompt ───────────────────────────────────────────────────────────────────

def _clean_history(history):
    out = []
    for m in (history or [])[-MAX_HISTORY:]:
        role = m.get("role")
        text = str(m.get("text") or "").strip()[:3000]
        if role in ("user", "assistant") and text:
            out.append({"role": role, "text": text})
    # A API exige alternância começando pelo usuário.
    while out and out[0]["role"] != "user":
        out.pop(0)
    merged = []
    for m in out:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["text"] += "\n\n" + m["text"]
        else:
            merged.append(dict(m))
    if merged and merged[-1]["role"] == "user":
        merged.pop()
    return merged


def _user_turn(question, context):
    return (f"<contexto>\n{context}\n</contexto>\n\n"
            f"Pergunta do aluno: {question}")


def build_request(payload):
    question = str(payload.get("question") or "").strip()[:MAX_QUESTION]
    if not question:
        raise AssistantError("Escreva uma pergunta.")
    context = str(payload.get("context") or "").strip()[:MAX_CONTEXT]
    history = _clean_history(payload.get("history"))
    return question, context, history


# ── Backends ─────────────────────────────────────────────────────────────────

def _cli_env():
    # Sem as variáveis de sessão do Claude Code (se o servidor foi aberto de dentro de uma).
    return {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}


def ask_cli(question, context, history, model, emit):
    exe = find_claude()
    if not exe:
        raise AssistantError("O Claude Code não foi encontrado neste computador.")
    convo = ""
    if history:
        lines = [f"{'Aluno' if m['role'] == 'user' else 'Lia'}: {m['text']}" for m in history]
        convo = "<conversa_anterior>\n" + "\n\n".join(lines) + "\n</conversa_anterior>\n\n"
    prompt = convo + _user_turn(question, context)
    cmd = [exe, "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
           "--tools", "", "--no-session-persistence", "--strict-mcp-config", "--setting-sources", "",
           "--model", MODELS[model]["cli"], "--system-prompt", SYSTEM_PROMPT]
    errfile = tempfile.TemporaryFile()  # stderr num arquivo: um pipe cheio travaria o processo
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errfile,
                            env=_cli_env(), cwd=tempfile.gettempdir())
    got_text = False
    error = None
    try:
        proc.stdin.write(prompt.encode("utf-8"))
        proc.stdin.close()
        for raw in proc.stdout:
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            kind = ev.get("type")
            if kind == "stream_event":
                inner = ev.get("event") or {}
                delta = inner.get("delta") or {}
                if inner.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                    text = delta.get("text") or ""
                    if text:
                        got_text = True
                        emit({"type": "delta", "text": text})
            elif kind == "result" and ev.get("is_error"):
                error = str(ev.get("result") or ev.get("subtype") or "erro desconhecido")
        proc.wait(timeout=CLI_TIMEOUT)
    except BaseException:
        proc.kill()
        errfile.close()
        raise
    errfile.seek(0)
    stderr = errfile.read().decode("utf-8", "replace").strip()
    errfile.close()
    if error or (proc.returncode and not got_text):
        detail = error or stderr[-400:]
        low = detail.lower()
        if "login" in low or "auth" in low or "api key" in low or "credential" in low:
            raise AssistantError("O Claude local não está logado. Abra um terminal, rode `claude` e faça login.")
        if "rate" in low or "limit" in low or "usage" in low:
            raise AssistantError(f"O Claude local atingiu um limite de uso: {detail[:200]}")
        raise AssistantError(f"O Claude local falhou: {detail[:300] or 'sem detalhes'}")
    if not got_text:
        raise AssistantError("O Claude local não devolveu resposta.")


def ask_api(question, context, history, model, emit, key):
    messages = [{"role": m["role"], "content": m["text"]} for m in history]
    messages.append({"role": "user", "content": _user_turn(question, context)})
    body = {"model": MODELS[model]["api"], "max_tokens": 1500, "system": SYSTEM_PROMPT,
            "messages": messages, "stream": True}
    req = urllib.request.Request(API_URL, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "x-api-key": key, "anthropic-version": API_VERSION, "content-type": "application/json"})
    got_text = False
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            for raw in resp:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    ev = json.loads(line[5:].strip())
                except ValueError:
                    continue
                if ev.get("type") == "content_block_delta":
                    delta = ev.get("delta") or {}
                    if delta.get("type") == "text_delta" and delta.get("text"):
                        got_text = True
                        emit({"type": "delta", "text": delta["text"]})
                elif ev.get("type") == "error":
                    raise AssistantError(f"A API devolveu um erro: {(ev.get('error') or {}).get('message', '')}")
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8", "replace")).get("error", {}).get("message", "")
        except ValueError:
            msg = ""
        friendly = {401: "A chave de API é inválida.", 403: "A chave de API não tem permissão para este modelo.",
                    429: "Limite de uso da API atingido. Tente de novo em instantes.",
                    529: "A API está sobrecarregada. Tente de novo em instantes."}.get(e.code)
        raise AssistantError(friendly or f"Erro da API ({e.code}): {msg[:200]}")
    except urllib.error.URLError as e:
        raise AssistantError(f"Não consegui falar com a API da Anthropic: {e.reason}")
    if not got_text:
        raise AssistantError("A API não devolveu resposta.")


def ask(payload, emit):
    """Responde à pergunta chamando emit({type: 'delta'|'meta'|'done'|'error', ...})."""
    cfg = load_config()
    question, context, history = build_request(payload)
    order = backends_in_order(cfg)
    if not order:
        raise AssistantError("Nenhum acesso ao Claude configurado. Instale o Claude Code e faça login "
                             "(o jogo usa `claude -p` com o seu plano) ou informe uma chave de API em Configurações.")
    key, _ = api_key_info(cfg)
    last_error = None
    for backend in order:
        emitted = {"any": False}

        def tracked(ev, _emitted=emitted):
            if ev.get("type") == "delta":
                _emitted["any"] = True
            emit(ev)

        emit({"type": "meta", "backend": backend, "model": MODELS[cfg["model"]]["label"]})
        try:
            if backend == "cli":
                ask_cli(question, context, history, cfg["model"], tracked)
            else:
                ask_api(question, context, history, cfg["model"], tracked, key)
            emit({"type": "done", "backend": backend})
            return
        except AssistantError as e:
            last_error = e
            if emitted["any"]:
                break  # já respondeu em parte: não mistura com outro backend
    raise last_error or AssistantError("Não foi possível responder.")
