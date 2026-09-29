"""Servidor local do jogo, sem cache (edições em JS/CSS/conteúdo aparecem ao recarregar).

Uso: python tools/serve.py [porta] [--open]

  porta   porta preferida (padrão: 8000). Se estiver ocupada por outro programa,
          usa a próxima livre.
  --open  abre o jogo no navegador. Se o jogo já estiver rodando nessa porta,
          só abre o navegador e sai.
"""
import http.server
import json
import os
import socket
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser
from functools import partial

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assistant  # noqa: E402  (tools/assistant.py)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARCA = b"Code Interview Quest"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}
MAX_BODY = 512 * 1024


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Arquivos do jogo sem cache + API local do assistente (/api/assistant/*)."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # sem uma linha de log por arquivo carregado

    # ── API do assistente ──
    # Só atende o próprio jogo: Host/Origin locais (contra DNS rebinding) e um cabeçalho próprio, que
    # obriga um preflight CORS em chamadas de outros sites — e este servidor não responde a preflights.
    def _api_allowed(self):
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        if host not in LOCAL_HOSTS:
            return False
        origin = self.headers.get("Origin")
        if origin and urllib.parse.urlparse(origin).hostname not in LOCAL_HOSTS:
            return False
        return self.headers.get("X-CIQ-Assistant") == "1"

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("tamanho inválido")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path.startswith("/api/"):
            if not self._api_allowed():
                return self._json(403, {"error": "proibido"})
            if self.path.split("?")[0] == "/api/assistant/status":
                return self._json(200, assistant.status())
            return self._json(404, {"error": "não encontrado"})
        return super().do_GET()

    def do_POST(self):
        if not self._api_allowed():
            return self._json(403, {"error": "proibido"})
        route = self.path.split("?")[0]
        try:
            payload = self._read_json()
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {"error": "JSON inválido"})
        if route == "/api/assistant/config":
            assistant.save_config(payload if isinstance(payload, dict) else {})
            return self._json(200, assistant.status())
        if route == "/api/assistant/ask":
            return self._stream_answer(payload if isinstance(payload, dict) else {})
        return self._json(404, {"error": "não encontrado"})

    def _stream_answer(self, payload):
        # Resposta em NDJSON (um evento JSON por linha), enviada aos poucos; a conexão fecha no fim.
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        def emit(event):
            self.wfile.write((json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8"))
            self.wfile.flush()

        try:
            assistant.ask(payload, emit)
        except assistant.AssistantError as e:
            try:
                emit({"type": "error", "message": str(e)})
            except OSError:
                pass
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # o jogador fechou a página ou cancelou a pergunta
        except Exception as e:  # noqa: BLE001 — mostra o erro no jogo em vez de derrubar a conexão
            try:
                emit({"type": "error", "message": f"Erro inesperado no servidor: {e}"})
            except OSError:
                pass


def porta_ocupada(porta):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", porta)) == 0


def jogo_rodando(porta):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{porta}/index.html", timeout=2) as r:
            return MARCA in r.read(4096)
    except Exception:
        return False


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    abrir = "--open" in sys.argv
    porta = int(args[0]) if args else 8000

    for tentativa in range(porta, porta + 20):
        if not porta_ocupada(tentativa):
            porta = tentativa
            break
        if jogo_rodando(tentativa):
            url = f"http://localhost:{tentativa}/"
            print(f"O jogo já está rodando em {url}")
            if abrir:
                webbrowser.open(url)
            return 0
    else:
        print("Nenhuma porta livre encontrada entre", porta, "e", porta + 19)
        return 1

    url = f"http://localhost:{porta}/"
    handler = partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", porta), handler) as httpd:
        print("=" * 56)
        print("  Code Interview Quest")
        print(f"  Rodando em {url}")
        print("  Feche esta janela (ou Ctrl+C) para desligar o servidor.")
        print("=" * 56)
        if abrir:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor desligado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
