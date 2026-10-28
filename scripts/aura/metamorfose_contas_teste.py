#!/usr/bin/env python3
"""
Teste ponta a ponta da AURA Metamorfose com contas TESTE, só em ambiente LOCAL (backend + MySQL descartável).

Roteiro pedido: contas de marca teste montam presets de arte de fundo Metamorfose; depois contas teste de usuário comum
tentam criar um esquema com esses presets. O script registra cada passo (status HTTP, código e mensagem da API) e
grava um relatório JSON. Ele não contorna regra nenhuma do backend: o que a API recusa fica registrado como recusa.

Preparação de teste feita direto no banco LOCAL (documentada no relatório): saldo de FAI Points para as marcas e para
um dos usuários comuns (lançamento TEST_FIXTURE no razão), porque contas novas começam sem pontos e não há crédito
administrativo de pontos na API.

Uso (o script recusa qualquer API que não seja localhost):
  FAI_API=http://localhost:8080 FAI_ADMIN_EMAIL=... FAI_ADMIN_PASSWORD=... FAI_TEST_PASSWORD=... \\
  MYSQL_ROOT_PASSWORD=... python3 scripts/aura/metamorfose_contas_teste.py \\
      --backend-log <log do backend com EMAIL_LOG_BODIES=true> --mysql-container fai-mysql-local --out relatorio.json
Senhas vêm do ambiente e nunca são impressas nem gravadas no relatório.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zlib

API = os.environ.get("FAI_API", "http://localhost:8080").rstrip("/")
RUN = time.strftime("%m%d%H%M")

# marcas e usuários fictícios (nenhuma marca real); e-mails em domínio reservado para teste
BRANDS = [
    {"key": "aurora", "name": "Atelier Aurora Teste", "presets": ["META_PRISMA_IVORY", "META_CONSTELACAO_VIOLET"]},
    {"key": "litoral", "name": "Litoral Teste Moda", "presets": ["META_FIO_VIVO_MINT", "META_HOLOGRAFIA_ROSE"]},
    {"key": "noite", "name": "Noite Urbana Teste", "presets": ["META_PRISMA_CHROME", "META_HOLOGRAFIA_VIOLET"]},
]
COMMONS = [
    {"key": "inicio", "name": "Ana Teste Comum", "loft": False},
    {"key": "loft", "name": "Bruno Teste Comum", "loft": True},
]

steps: list[dict] = []


def local_only() -> None:
    host = urllib.parse.urlparse(API).hostname
    if host not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"recusado: a API precisa ser local (recebido {host}); este teste cria contas e pontos de teste")


def call(method: str, path: str, token: str | None = None, body=None, files=None, expect=None, step=None, actor=None):
    url = API + path
    headers = {"Accept": "application/json", "User-Agent": "fai-teste-metamorfose"}
    data = None
    if files:
        boundary = uuid.uuid4().hex
        parts = []
        for name, (filename, content, ctype) in files.items():
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
                         f"Content-Type: {ctype}\r\n\r\n".encode() + content + b"\r\n")
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    try:
        payload = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        payload = raw[:200].decode(errors="replace")
    if step:
        rec = {"passo": step, "conta": actor, "metodo": method, "rota": path.split("?")[0], "status": status}
        if isinstance(payload, dict) and status >= 400:
            rec["codigo"] = payload.get("code") or payload.get("error")
            rec["mensagem"] = payload.get("message") or payload.get("detail")
            if payload.get("details"):
                rec["detalhes"] = payload.get("details")
        if expect is not None:
            rec["esperado"] = expect
            rec["ok"] = status in (expect if isinstance(expect, (list, tuple)) else [expect])
        steps.append(rec)
        mark = "" if rec.get("ok", True) else "  <-- inesperado"
        print(f"[{status}] {actor or '-'}: {step}{(' · ' + str(rec.get('codigo'))) if rec.get('codigo') else ''}{mark}")
    return status, payload


def png(color: tuple[int, int, int], size: int = 64) -> bytes:
    """PNG liso (logo fictício e foto de peça de teste), sem depender de biblioteca de imagem."""
    raw = b"".join(b"\x00" + bytes(color) * size for _ in range(size))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def cnpj(seed: int) -> str:
    """CNPJ fictício com dígitos verificadores válidos (só formato; não corresponde a empresa)."""
    base = [int(c) for c in f"{(seed * 7919) % 10**8:08d}0001"]
    for weights in ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]):
        s = sum(d * w for d, w in zip(base, weights)) % 11
        base.append(0 if s < 2 else 11 - s)
    return "".join(map(str, base))


def code_from_log(log_path: str, email: str, timeout: float = 30) -> str | None:
    """Código de confirmação no corpo do e-mail registrado pelo backend local (EMAIL_LOG_BODIES=true)."""
    end = time.time() + timeout
    while time.time() < end:
        text = open(log_path, encoding="utf-8", errors="replace").read()
        idx = text.rfind(f"para={email} assunto=\"Confirme seu e-mail")   # o da marca chega junto com "Cadastro recebido"
        if idx >= 0:
            m = re.search(r"verify-email\?code=(\d+)", text[idx:idx + 6000])
            if m:
                return m.group(1)
        time.sleep(1)
    return None


def fixture_points(container: str, user_id: str, points: int, label: str) -> None:
    sql = ("INSERT INTO fai_points_ledger(id,user_id,delta,action_code,ref_type,ref_id,idempotency_key,counts_lifetime,created_at) "
           f"VALUES (UUID(),'{user_id}',{points},'TEST_FIXTURE','TESTE','{label}','teste:{user_id}:{label}',1,NOW(6))")
    env = dict(os.environ, MYSQL_PWD=os.environ["MYSQL_ROOT_PASSWORD"])
    subprocess.run(["docker", "exec", "-e", "MYSQL_PWD", container, "mysql", "-uroot", "fashionai", "-e", sql],
                   check=True, env=env, capture_output=True)
    steps.append({"passo": f"preparação: +{points} FAI Points de teste (TEST_FIXTURE) direto no banco local", "conta": label,
                  "status": "fixture"})
    print(f"[fixture] {label}: +{points} FAI Points")


def register(kind: str, who: dict, log_path: str, password: str, index: int):
    email = f"{kind.lower()}-{who['key']}-{RUN}@teste.fashionai.local"
    username = f"t{RUN}_{who['key']}"[:30]
    body = {"profileType": kind, "fullName": who["name"], "username": username, "email": email, "password": password,
            "confirmPassword": password, "acceptTerms": True, "birthDate": "1995-05-20", "country": "BR"}
    if kind == "MARCA":
        _, up = call("POST", "/api/auth/uploads?kind=logo", files={"file": ("logo.png", png((40 + 60 * index, 90, 160)), "image/png")},
                     step="enviar logo fictício no cadastro", actor=who["name"], expect=201)
        logo = up.get("url") if isinstance(up, dict) else None
        _, proof = call("POST", "/api/auth/uploads?kind=activity-proof", files={"file": ("comprovante.png", png((230, 230, 225), 96), "image/png")},
                        step="enviar comprovante de atividade fictício", actor=who["name"], expect=201)
        body["brand"] = {"razaoSocial": f"{who['name']} LTDA", "cnpj": cnpj(index + 11), "nomeFantasia": who["name"],
                         "logoUrl": logo, "fashionCategory": "VESTUARIO", "storeUrl": f"https://{who['key']}.teste.fashionai.local",
                         "commercialContact": email, "officialHashtag": f"#{who['key']}teste",
                         "activityProofUrl": proof.get("url") if isinstance(proof, dict) else None}
    else:
        body["sex"] = "FEMININO" if index % 2 == 0 else "MASCULINO"
    status, session = call("POST", "/api/auth/register", body=body, step=f"cadastrar conta {kind}", actor=who["name"], expect=201)
    if status != 201:
        return None
    token = session["accessToken"]
    code = code_from_log(log_path, email)
    call("POST", "/api/auth/email-verification", token, {"code": code}, step="confirmar e-mail com o código", actor=who["name"], expect=200)
    _, session = call("POST", "/api/auth/login", body={"identifier": email, "password": password, "rememberMe": False},
                      step="entrar de novo (sessão com e-mail confirmado)", actor=who["name"], expect=200)
    return {"id": session["user"]["id"], "token": session["accessToken"], "email": email, "name": who["name"]}


def create_piece_and_scheme(acct: dict, title: str, background: dict | None = None, expect_scheme=201):
    piece_body = {"useDefaultImage": True, "name": "Camiseta de teste", "category": "upper_piece", "subcategory": "t_shirt",
                  "sex": "UNISSEX", "color": "white", "material": "COTTON", "size": "m", "price": 0, "visibility": "PRIVATE",
                  "occasion": ["casual"], "style": ["basic"]}
    status, piece = call("POST", "/api/pieces", acct["token"], piece_body, step="cadastrar peça de teste (imagem padrão)", actor=acct["name"], expect=201)
    if status != 201:
        return None
    form = {"title": title, "visibility": "PRIVATE", "occasion": ["casual"], "style": ["basic"],
            "items": [{"wardrobeItemId": piece["id"], "slot": "TOP"}]}
    if background is not None:
        form["background"] = background
    status, out = call("POST", "/api/schemes", acct["token"], form,
                       step="criar esquema" + (" já com a Metamorfose no fundo" if background else ""), actor=acct["name"], expect=expect_scheme)
    if status != 201:
        return None
    return (out.get("scheme") or {}).get("id")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend-log", required=True)
    ap.add_argument("--mysql-container", default="fai-mysql-local")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    local_only()
    password = os.environ["FAI_TEST_PASSWORD"]

    _, admin = call("POST", "/api/auth/login", body={"identifier": os.environ["FAI_ADMIN_EMAIL"], "password": os.environ["FAI_ADMIN_PASSWORD"]},
                    step="admin entra", actor="admin local", expect=200)
    atoken = admin["accessToken"]
    _, offers = call("GET", "/api/admin/aura-store", atoken, step="listar presets Metamorfose cadastrados", actor="admin local", expect=200)
    by_code = {o["code"]: o for o in offers}
    wanted = sorted({c for b in BRANDS for c in b["presets"]})
    missing = [c for c in wanted if c not in by_code]
    if missing:
        sys.exit(f"presets ausentes no catálogo: {missing}")

    brands = []
    for i, b in enumerate(BRANDS):
        acct = register("MARCA", b, args.backend_log, password, i)
        if not acct:
            continue
        acct["presets"] = b["presets"]
        brands.append(acct)
    # aprovação do perfil institucional pela administração (critérios marcados como conferidos: contas de TESTE)
    _, queue = call("GET", "/api/admin/approvals", atoken, step="fila de verificação de marcas", actor="admin local", expect=200)
    items = (queue or {}).get("queue") or (queue or {}).get("items") or []
    for acct in brands:
        item = next((x for x in items if str(x.get("userId") or x.get("id")) == acct["id"]), {})
        codes = [c.get("code") for c in (item.get("checks") or item.get("criteria") or []) if isinstance(c, dict) and c.get("code")]
        codes = codes or ["CNPJ_ATIVO", "ATIVIDADE_MODA", "COMPROVANTE_ATIVIDADE", "PRESENCA_OFICIAL", "SEM_CONFLITO"]
        call("POST", f"/api/admin/approvals/{acct['id']}", atoken,
             {"decision": "APROVAR", "checklist": {c: True for c in codes}, "notes": "Conta de teste local (critérios conferidos pelo roteiro)"},
             step="aprovar perfil de marca", actor=f"admin local → {acct['name']}", expect=200)
        _, s = call("POST", "/api/auth/login", body={"identifier": acct["email"], "password": password}, step="marca entra aprovada", actor=acct["name"], expect=200)
        acct["token"] = s["accessToken"]

    # 1) marca tenta CRIAR um preset próprio (a API de criação de presets é da administração)
    if brands:
        b0 = brands[0]
        own = {"code": f"META_TESTE_{b0['name'].split()[0].upper()}", "name": f"{b0['name']} · Prisma próprio", "family": "METAMORPHOSE",
               "pricePoints": 150, "active": True, "config": {"auraMetamorphose": "PRISMA", "border": {"mode": "GRADIENT", "from": "#ff7a59", "to": "#ffd1a8", "effect": "SHIMMER"}}}
        call("POST", "/api/admin/aura-store", b0["token"], own, step="marca tenta criar preset Metamorfose próprio", actor=b0["name"], expect=403)

    # 2) presets publicados (ativação administrativa dos desenhos da V65 escolhidos pelas marcas)
    for code in wanted:
        o = by_code[code]
        call("POST", "/api/admin/aura-store", atoken, {"code": code, "name": o["name"], "family": o["family"], "pricePoints": o["pricePoints"],
                                                      "active": True, "config": o["config"]}, step=f"publicar preset {code}", actor="admin local", expect=200)
    call("GET", "/api/aura-store", step="loja de artes sem login", actor="visitante", expect=[200, 401])

    # 3) marcas compram a licença dos presets (antes e depois do saldo de teste) e aplicam no próprio esquema
    for acct in brands:
        call("POST", f"/api/aura-store/{acct['presets'][0]}/purchase", acct["token"], step=f"comprar licença {acct['presets'][0]} sem saldo", actor=acct["name"], expect=409)
        fixture_points(args.mysql_container, acct["id"], 1200, acct["name"])
        for code in acct["presets"]:
            call("POST", f"/api/aura-store/{code}/purchase", acct["token"], step=f"comprar licença {code}", actor=acct["name"], expect=200)
        _, arts = call("GET", "/api/me/arts/metamorphoses", acct["token"], step="Minhas Artes: Metamorfoses disponíveis", actor=acct["name"], expect=200)
        acct["arts"] = arts if isinstance(arts, list) else []
        scheme = create_piece_and_scheme(acct, f"Look teste {acct['name']}")
        if scheme and acct["arts"]:
            art = acct["arts"][0]
            call("PUT", f"/api/schemes/{scheme}/background", acct["token"], {"config": {**art["config"], "auraEntitlementCode": art["code"]}},
                 step=f"aplicar o preset {art['code']} no próprio esquema", actor=acct["name"], expect=200)

    # 4) usuários comuns tentam usar os presets das marcas
    presets = [(a["code"], a["config"]) for acct in brands for a in acct.get("arts", [])]
    for i, who in enumerate(COMMONS):
        acct = register("PESSOAL", who, args.backend_log, password, i)
        if not acct:
            continue
        if who["loft"]:
            fixture_points(args.mysql_container, acct["id"], 1200, acct["name"])
        call("GET", "/api/aura-store", acct["token"], step="ver a loja de artes", actor=acct["name"], expect=200)
        if presets:
            code, config = presets[i % len(presets)]
            call("POST", f"/api/aura-store/{code}/purchase", acct["token"], step=f"comprar licença {code}", actor=acct["name"], expect=403)
            call("GET", "/api/me/arts/metamorphoses", acct["token"], step="Minhas Artes: Metamorfoses disponíveis", actor=acct["name"], expect=[200, 403])
            create_piece_and_scheme(acct, f"Look teste {who['name']} com preset", {**config, "auraEntitlementCode": code}, expect_scheme=[201, 403])
            scheme = create_piece_and_scheme(acct, f"Look teste {who['name']}")
            if scheme:
                call("PUT", f"/api/schemes/{scheme}/background", acct["token"], {"config": {**config, "auraEntitlementCode": code}},
                     step=f"aplicar o preset {code} da marca no esquema", actor=acct["name"], expect=[200, 403])
                call("PUT", f"/api/schemes/{scheme}/background", acct["token"], {"config": {"auraMetamorphose": config.get("auraMetamorphose")}},
                     step="aplicar só o modo Metamorfose, sem a arte", actor=acct["name"], expect=[200, 403])
                call("PUT", f"/api/schemes/{scheme}/background", acct["token"], {"config": {"color": "#f1e6d5"}},
                     step="controle: fundo de cor lisa no mesmo esquema", actor=acct["name"], expect=200)

    report = {"api": API, "rodada": RUN, "passos": steps, "inesperados": [s for s in steps if s.get("ok") is False]}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n{len(steps)} passos · {len(report['inesperados'])} inesperados · relatório em {args.out}")


if __name__ == "__main__":
    main()
