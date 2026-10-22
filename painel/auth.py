"""Login por perfil para o painel: uma senha por perfil (socio, gerente, cozinha).

- Senhas guardadas com PBKDF2 na tabela `acessos`; sessao em cookie assinado (HMAC) de 30 dias.
- Cada perfil so acessa as APIs das telas dele (o servidor confere, nao so a tela).
- O n8n chama /api/zap/* por dentro da rede do Docker (http://painel:8080) e continua sem login.
"""
import base64
import hashlib
import hmac
import ipaddress
import secrets
import time

from fastapi import Body, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
import os

PERFIS = ("socio", "gerente", "cozinha")
COOKIE = "m2_sessao"
DURACAO = 30 * 24 * 3600
ITER = 200_000

# prefixos de API liberados por perfil (socio libera tudo)
_COZINHA = ("/api/eu", "/api/logout", "/api/unidades", "/api/marcas", "/api/estoque", "/api/insumo", "/api/fornecedor",
            "/api/compras", "/api/sugestao_compra", "/api/config_troca", "/api/nota",
            "/api/operacao", "/api/previsao")
_GERENTE = _COZINHA + ("/api/clientes", "/api/retencao", "/api/bairros", "/api/meta", "/api/zap/pergunta_painel", "/api/resumo_operacao")
PERMITIDO = {"cozinha": _COZINHA, "gerente": _GERENTE}

PUBLICO = ("/login", "/api/login", "/static/", "/favicon.ico", "/v2/assets/login")
_falhas = {}   # ip -> [timestamps]


def hash_senha(senha, salt=None):
    salt = salt or secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, ITER)
    return f"pbkdf2${ITER}${base64.b64encode(salt).decode()}${base64.b64encode(h).decode()}"


def confere_senha(senha, guardado):
    try:
        _, it, salt, h = guardado.split("$")
        novo = hashlib.pbkdf2_hmac("sha256", senha.encode(), base64.b64decode(salt), int(it))
        return hmac.compare_digest(novo, base64.b64decode(h))
    except Exception:
        return False


def instalar_auth(app, consultar, executar):
    def segredo():
        r = consultar("SELECT valor FROM acesso_config WHERE chave = 'segredo'", {})
        if r:
            return r[0]["valor"].encode()
        novo = secrets.token_hex(32)
        executar("INSERT INTO acesso_config (chave, valor) VALUES ('segredo', %(v)s) ON CONFLICT DO NOTHING", {"v": novo})
        return consultar("SELECT valor FROM acesso_config WHERE chave = 'segredo'", {})[0]["valor"].encode()

    _seg = {}

    def chave():
        if "k" not in _seg:
            _seg["k"] = segredo()
        return _seg["k"]

    def assinar(perfil):
        corpo = f"{perfil}|{int(time.time()) + DURACAO}"
        sig = hmac.new(chave(), corpo.encode(), hashlib.sha256).hexdigest()
        return base64.urlsafe_b64encode(f"{corpo}|{sig}".encode()).decode()

    def ler(token):
        try:
            perfil, exp, sig = base64.urlsafe_b64decode(token.encode()).decode().split("|")
            esperado = hmac.new(chave(), f"{perfil}|{exp}".encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, esperado) and int(exp) > time.time() and perfil in PERFIS:
                return perfil
        except Exception:
            pass
        return None

    def interno(request: Request, path: str):
        """n8n -> painel por dentro do Docker: host 'painel', IP privado (nao o gateway .1), so /api/zap/*."""
        if not path.startswith("/api/zap/") or path.startswith("/api/zap/pergunta_painel"):
            return False
        if request.headers.get("host", "").split(":")[0] != "painel":
            return False
        try:
            ip = ipaddress.ip_address(request.client.host)
        except Exception:
            return False
        return ip.is_private and not str(ip).endswith(".1")

    @app.middleware("http")
    async def exigir_login(request: Request, call_next):
        path = request.url.path
        if path.startswith(PUBLICO) or interno(request, path):
            return await call_next(request)
        perfil = ler(request.cookies.get(COOKIE, ""))
        if not perfil:
            if path.startswith("/api/"):
                return JSONResponse({"ok": False, "erro": "login necessário"}, status_code=401)
            return RedirectResponse("/login?next=" + path, status_code=303)
        request.state.perfil = perfil
        if perfil != "socio":
            if path.startswith("/api/"):
                ok = path.startswith(PERMITIDO[perfil])
                if ok and path.startswith("/api/meta") and request.method != "GET":
                    ok = False
                if not ok:
                    return JSONResponse({"ok": False, "erro": "sem permissão para este perfil"}, status_code=403)
            elif not (path == "/" or path.startswith("/v2")):
                return RedirectResponse("/v2", status_code=303)
        return await call_next(request)

    @app.get("/login")
    def pagina_login():
        return FileResponse(os.path.join(os.path.dirname(__file__), "v2", "login.html"),
                            headers={"Cache-Control": "no-cache"})

    @app.post("/api/login")
    def login(request: Request, dados: dict = Body(...)):
        ip = request.client.host if request.client else "?"
        agora = time.time()
        _falhas[ip] = [t for t in _falhas.get(ip, []) if agora - t < 300]
        if len(_falhas[ip]) >= 5:
            return JSONResponse({"ok": False, "erro": "muitas tentativas, espere uns minutos"}, status_code=429)
        perfil = str(dados.get("perfil", ""))
        senha = str(dados.get("senha", ""))
        r = consultar("SELECT senha_hash FROM acessos WHERE perfil = %(p)s", {"p": perfil}) if perfil in PERFIS else []
        if not r or not confere_senha(senha, r[0]["senha_hash"]):
            _falhas[ip].append(agora)
            return JSONResponse({"ok": False, "erro": "perfil ou senha incorretos"}, status_code=401)
        _falhas.pop(ip, None)
        resp = JSONResponse({"ok": True, "perfil": perfil})
        resp.set_cookie(COOKIE, assinar(perfil), max_age=DURACAO, httponly=True, samesite="lax",
                        secure=request.url.scheme == "https")
        return resp

    @app.post("/api/logout")
    def logout():
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(COOKIE)
        return resp

    @app.get("/api/eu")
    def eu(request: Request):
        return {"ok": True, "perfil": getattr(request.state, "perfil", None)}
