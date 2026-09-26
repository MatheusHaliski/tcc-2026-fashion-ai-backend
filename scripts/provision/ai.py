#!/usr/bin/env python3
"""
Configuração dos serviços de IA do FashionAI: basta autenticar (definir a chave de cada provedor como variável de
ambiente do backend) e rodar este script. Ele confere cada chave com uma chamada leve e sem custo ao provedor, mostra
quais capacidades (RF) passam a usar IA remota e quais continuam no motor local, e — com --write-env — gera um bloco de
variáveis pronto para colar nas configurações do host (sem as chaves: só as flags de recurso derivadas).

Nenhuma chave é impressa, gravada em disco ou enviada a outro lugar além do próprio provedor.

  python3 scripts/provision/ai.py --check        # confere as chaves definidas
  python3 scripts/provision/ai.py --write-env    # idem + imprime as flags sugeridas (FEATURE_RF16_3D, AI_REMOTE_ENABLED…)
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

# (variável, provedor, RFs/capacidades, verificação online) — a verificação usa só endpoints de conta ou listagem
PROVIDERS = [
    ("ANTHROPIC_API_KEY", "Anthropic Claude", "composição de looks (RF5/RF10), DNA (RF13), Copilot, visão (RF4)",
     ("GET", "https://api.anthropic.com/v1/models?limit=1", lambda k: {"x-api-key": k, "anthropic-version": "2023-06-01"})),
    ("GOOGLE_AI_API_KEY", "Google Gemini", "visão e texto econômicos (RF4, RF24)",
     ("GET", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", lambda k: {"x-goog-api-key": k})),
    ("REPLICATE_API_TOKEN", "Replicate (FLUX schnell)", "arte de fundo (RF11)",
     ("GET", "https://api.replicate.com/v1/account", lambda k: {"Authorization": f"Bearer {k}"})),
    ("STABILITY_API_KEY", "Stability AI", "3D Stable Fast 3D (RF16) e upscale do estúdio (RF4)",
     ("GET", "https://api.stability.ai/v1/user/account", lambda k: {"Authorization": f"Bearer {k}"})),
    ("REMOVE_BG_API_KEY", "remove.bg", "remoção de fundo (RF4)",
     ("GET", "https://api.remove.bg/v1.0/account", lambda k: {"X-Api-Key": k})),
    ("MESHY_API_KEY", "Meshy", "modelo 3D image-to-3D (RF16)", None),
    ("PHOTOROOM_API_KEY", "Photoroom", "estúdio: fundo, reiluminação e sombra (RF4)", None),
    ("FASHN_API_KEY", "FASHN", "provador virtual (RF18)", None),
]


def env(name):
    v = os.environ.get(name, "")
    if not v and name == "REPLICATE_API_TOKEN":
        v = os.environ.get("REPLICATE_API_KEY", "")
    if not v and name == "REMOVE_BG_API_KEY":
        v = os.environ.get("REMBG_API_KEY", "")
    return v.strip()


def probe(method, url, headers):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "fashionai-provision/1.0", **headers})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310 — URLs fixas dos provedores
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read(300).decode(errors="replace")
    except Exception as e:  # noqa: BLE001
        return 0, str(e)[:160]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="confere as chaves (padrão)")
    ap.add_argument("--write-env", action="store_true", help="imprime as flags de recurso sugeridas")
    ap.add_argument("--offline", action="store_true", help="não chama os provedores; só confere se as chaves existem")
    args = ap.parse_args()
    print("FashionAI — serviços de IA")
    ok_remote, rows = [], []
    for var, name, caps, check in PROVIDERS:
        key = env(var)
        if not key:
            rows.append((name, "sem chave", f"{caps} → motor local"))
            continue
        if check is None or args.offline:
            rows.append((name, "chave presente", f"{caps} (não verificada online{'' if check is None else ': --offline'})"))
            ok_remote.append(var)
            continue
        method, url, hdr = check
        status, detail = probe(method, url, hdr(key))
        if 200 <= status < 300:
            rows.append((name, "ok", caps)); ok_remote.append(var)
        elif status in (401, 403):
            rows.append((name, "chave recusada", f"HTTP {status}: gere outra chave no painel do provedor"))
        elif status == 429:
            rows.append((name, "ok (limite)", f"{caps} — o provedor aceitou a chave, mas limitou a taxa agora")); ok_remote.append(var)
        else:
            rows.append((name, "sem resposta", f"HTTP {status or '—'} {detail[:80]}"))
    rembg = env("REMBG_URL")
    if rembg:
        status, _ = probe("GET", rembg.rstrip("/") + "/", {})
        rows.append(("rembg (auto-hospedado)", "ok" if 200 <= status < 500 else "sem resposta", "remoção de fundo local (RF4)"))
    width = max(len(r[0]) for r in rows)
    for n, st, d in rows:
        print(f"  {n:<{width}}  [{st}]  {d}")
    three_d = any(v in ok_remote for v in ("MESHY_API_KEY", "STABILITY_API_KEY"))
    text = any(v in ok_remote for v in ("ANTHROPIC_API_KEY", "GOOGLE_AI_API_KEY"))
    print(f"\n{len(ok_remote)} de {len(PROVIDERS)} provedores prontos. Sem chave, cada capacidade usa o motor local (o app funciona igual, com resultados mais simples).")
    if args.write_env:
        print("\n# flags sugeridas (cole nas variáveis do backend; as chaves já estão lá)")
        print(f"AI_REMOTE_ENABLED={'true' if ok_remote else 'false'}")
        print("FEATURE_RF16_3D=true" + ("" if three_d else "   # sem Meshy/Stability: relevo local gera o .glb"))
        if not text:
            print("# sem Claude/Gemini: composição, DNA e Copilot usam as heurísticas locais")
    sys.exit(0)


if __name__ == "__main__":
    main()
