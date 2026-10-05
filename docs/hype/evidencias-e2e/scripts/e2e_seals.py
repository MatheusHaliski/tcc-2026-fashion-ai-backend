"""E2E real (MySQL + backend): looks promovidos no perfil de marca/celebridade por POLÍTICA ACEITA.

Pré-requisito: seed_e2e.py já rodou (ana.hype etc. com peças 11111111-…). Cria a marca "Maison E2E" e a celebridade
"Estrela E2E" (perfis aprovados via SQL), selos com política, looks da ana e percorre sugestão → aceite → revisão →
perfil. Imprime OK/FALHA por verificação e sai com código 1 se algo falhar.
"""
import json, subprocess, sys, urllib.request

B = "http://localhost:8080"
PWD = "SenhaForte#2026"
fails = []


def call(method, path, body=None, tok=None):
    req = urllib.request.Request(B + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try:
            return e.code, json.loads(t) if t else None
        except Exception:
            return e.code, t


def sql(script):
    r = subprocess.run(["docker", "exec", "-i", "fai-mysql", "mysql", "-uroot", "-proot", "--default-character-set=utf8mb4", "-N", "fashionai"],
                       input=script.encode(), capture_output=True)
    if r.returncode:
        print("SQL ERRO", r.stderr.decode()[-600:])
    return r.stdout.decode()


def check(label, cond, extra=""):
    print(("OK    " if cond else "FALHA ") + label + (f"  [{extra}]" if extra and not cond else ""))
    if not cond:
        fails.append(label)


def login(u):
    s, b = call("POST", "/api/auth/login", {"identifier": u + "@example.com", "password": PWD, "rememberMe": True})
    assert s == 200, (u, s, b)
    return b["accessToken"]


def register(u):
    s, b = call("POST", "/api/auth/register", {"profileType": "PESSOAL", "fullName": u.split(".")[0].title(), "username": u,
                                               "email": u + "@example.com", "password": PWD, "confirmPassword": PWD, "acceptTerms": True,
                                               "birthDate": "1990-01-01", "country": "BR", "sex": "FEMININO"})
    if s >= 300 and s != 409:
        print("register", u, s, b)


def ids_of(tab_payload, key):
    return [e[key]["id"] for e in (tab_payload or [])]


def tab(slug, name, tok=None):
    s, b = call("GET", f"/api/institutional/{slug}/tabs/{name}", None, tok)
    assert s == 200, (name, s, b)
    return b


def main():
    register("maison.e2e")
    register("estrela.e2e")
    sql("""
SET @m=(SELECT id FROM users WHERE username='maison.e2e'); SET @c=(SELECT id FROM users WHERE username='estrela.e2e');
UPDATE users SET profile_type='MARCA', status='ACTIVE', email_verified=1 WHERE id=@m;
UPDATE users SET profile_type='CELEBRIDADE', status='ACTIVE', email_verified=1 WHERE id=@c;
UPDATE users SET status='ACTIVE', email_verified=1 WHERE username LIKE '%.hype';
INSERT IGNORE INTO brand_profiles (id, owner_user_id, brand_name, slug, approval_status, source, version, created_at, updated_at)
  VALUES (UUID(), @m, 'Maison E2E', 'maison-e2e', 'APROVADO', 'USER_SUBMITTED', 0, NOW(6), NOW(6));
INSERT IGNORE INTO celebrity_profiles (id, owner_user_id, stage_name, slug, verification_status, seal_consent_granted, version, created_at, updated_at)
  VALUES (UUID(), @c, 'Estrela E2E', 'estrela-e2e', 'APROVADO', 1, 0, NOW(6), NOW(6));
""")
    tm, tc, ta, tv = login("maison.e2e"), login("estrela.e2e"), login("ana.hype"), login("bia.hype")

    # selos com política padronizada
    s, seal_m = call("POST", "/api/seals", {"name": "Maison Street", "tier": "LOOK",
                                             "policy": {"match": "ALL", "rules": [{"quantifier": "AT_LEAST", "count": 1, "brand": "Nike"}]}}, tm)
    check("marca cria selo com política (201)", s == 201, f"{s} {seal_m}")
    s, seal_c = call("POST", "/api/seals", {"name": "Preto Estrela", "tier": "PECA",
                                             "policy": {"match": "ALL", "rules": [{"quantifier": "AT_LEAST", "count": 1, "color": "black"}]}}, tc)
    check("celebridade cria selo de peça com política (201)", s == 201, f"{s} {seal_c}")

    # looks da ana: um com Nike (atende a marca) + peça preta (atende a celebridade), outro sem Nike
    P = lambda n: f"11111111-0000-0000-0000-{n:012d}"
    form1 = {"title": "E2E Nike preto", "visibility": "PUBLIC", "publish": True, "style": ["streetwear"], "occasion": ["casual"],
             "items": [{"wardrobeItemId": P(3), "slot": "SHOES", "sortOrder": 0}, {"wardrobeItemId": P(2), "slot": "BOTTOM", "sortOrder": 1}]}
    s, look1 = call("POST", "/api/schemes", form1, ta)
    check("ana cria look com Nike + peça preta", s in (200, 201), f"{s} {str(look1)[:300]}")
    s, look2 = call("POST", "/api/schemes", {"title": "E2E sem Nike", "visibility": "PUBLIC", "publish": True,
                                             "items": [{"wardrobeItemId": P(1), "slot": "TOP", "sortOrder": 0}, {"wardrobeItemId": P(2), "slot": "BOTTOM", "sortOrder": 1}]}, ta)
    pick = lambda o: (o or {}).get("id") or ((o or {}).get("scheme") or {}).get("id")
    l1, l2 = pick(look1), pick(look2)

    s, sug = call("GET", f"/api/schemes/{l1}/seal-suggestions", None, ta)
    check("sugestões do look 1 (200)", s == 200, f"{s} {str(sug)[:300]}")
    by_target = {x["target"]["username"]: x for x in (sug or {}).get("suggestions", [])}
    check("política da marca atendida → sugestão Maison", "maison.e2e" in by_target, list(by_target))
    check("política da celebridade atendida → sugestão Estrela (selo de PEÇA)", by_target.get("estrela.e2e", {}).get("tier") == "PECA", list(by_target))
    s, sug2 = call("GET", f"/api/schemes/{l2}/seal-suggestions", None, ta)
    check("look 2 sem Nike não recebe sugestão da Maison", all(x["target"]["username"] != "maison.e2e" for x in (sug2 or {}).get("suggestions", [])))

    base_m = set(ids_of(tab("maison-e2e", "ESQUEMAS_DESTAQUE"), "scheme"))
    base_mc = set(ids_of(tab("maison-e2e", "LOOKS_CONSAGRADOS", tv), "scheme"))
    base_c = set(ids_of(tab("estrela-e2e", "ESQUEMAS_DESTAQUE"), "scheme"))
    check("antes do aceite o look não está em destaque (marca)", l1 not in base_m)

    bm = by_target.get("maison.e2e", {}).get("id")
    s, acc = call("POST", f"/api/seal-bonds/{bm}/accept", {}, ta)
    check("aceite da sugestão da marca → APPROVED", s == 200 and acc.get("status") == "APPROVED", f"{s} {str(acc)[:300]}")
    check("código rastreável BRD", str((acc or {}).get("sealCode", "")).startswith("BRD"))
    dest = tab("maison-e2e", "ESQUEMAS_DESTAQUE")
    check("look promovido aparece em Esquemas em destaque (anônimo)", set(ids_of(dest, "scheme")) == base_m | {l1}, ids_of(dest, "scheme"))
    mine = [e for e in dest if e["scheme"]["id"] == l1]
    check("entrada traz promotion vigente", mine and mine[0].get("promotion", {}).get("expired") is False, str(mine[:1])[:300])
    check("Looks consagrados (visitante bia)", set(ids_of(tab("maison-e2e", "LOOKS_CONSAGRADOS", tv), "scheme")) == base_mc | {l1})
    pecas = tab("maison-e2e", "PECAS_DESTAQUE")
    by_look = [e["piece"]["id"] for e in pecas if e.get("schemeId") == l1]
    check("Peças em destaque incluem as peças do look (selo de LOOK)", {P(3), P(2)} <= set(ids_of(pecas, "piece")), ids_of(pecas, "piece"))

    bc = by_target.get("estrela.e2e", {}).get("id")
    s, r = call("POST", f"/api/seal-bonds/{bc}/accept", {}, ta)
    check("aceite da celebridade sem consentimento de imagem → 400", s == 400, f"{s} {r}")
    s, r = call("POST", f"/api/seal-bonds/{bc}/accept", {"imageRightsConsent": True}, ta)
    check("aceite com consentimento → PENDING_REVIEW", s == 200 and r.get("status") == "PENDING_REVIEW", f"{s} {str(r)[:200]}")
    check("pendente não aparece no perfil da celebridade", l1 not in ids_of(tab("estrela-e2e", "ESQUEMAS_DESTAQUE"), "scheme"))
    s, r = call("POST", f"/api/seal-bonds/{bc}/review", {"approve": True}, tc)
    check("celebridade aprova → APPROVED (PRM)", s == 200 and r.get("status") == "APPROVED" and str(r.get("sealCode", "")).startswith("PRM"), f"{s} {str(r)[:200]}")
    check("look aparece no perfil da celebridade", set(ids_of(tab("estrela-e2e", "ESQUEMAS_DESTAQUE"), "scheme")) == base_c | {l1})
    pcs = tab("estrela-e2e", "PECAS_DESTAQUE")
    pc = sorted({e["piece"]["id"] for e in pcs})
    check("selo de PEÇA destaca só a peça preta (Nike Dunk), nunca o jeans do mesmo look", P(3) in pc and P(2) not in pc, pc)

    # privacidade: look privado some (e revoga)
    s, r = call("PUT", f"/api/schemes/{l1}", {**form1, "visibility": "PRIVATE"}, ta)
    check("look tornado privado (200)", s in (200, 204), f"{s} {str(r)[:200]}")
    check("look privado some do destaque da marca", l1 not in ids_of(tab("maison-e2e", "ESQUEMAS_DESTAQUE"), "scheme"))
    check("look privado some dos consagrados", l1 not in ids_of(tab("maison-e2e", "LOOKS_CONSAGRADOS", tv), "scheme"))
    st = sql(f"SELECT status FROM seal_bonds WHERE scheme_id='{l1}' ORDER BY status;").split()
    check("vínculos do look privado revogados (CA14)", st and all(x == "REVOKED" for x in st), st)

    print(f"\n{len(fails)} falha(s)")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
