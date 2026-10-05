"""Seed para o teste real (RF53/RF54): usuários em 5 países, peças com imagem real, looks e sinais de Hype variados."""
import json, subprocess, sys, urllib.request

B = "http://localhost:8080"
PWD = "SenhaForte#2026"


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


USERS = {"ana.hype": "BR", "bia.hype": "BR", "caio.hype": "US", "dani.hype": "FR", "eiji.hype": "JP", "fran.hype": "AR"}


def register(u, country):
    s, b = call("POST", "/api/auth/register", {"profileType": "PESSOAL", "fullName": u.split(".")[0].title() + " Hype", "username": u,
                                               "email": u + "@example.com", "password": PWD, "confirmPassword": PWD, "acceptTerms": True,
                                               "birthDate": "1999-05-10", "country": country, "sex": "FEMININO"})
    if s >= 300 and s != 409:
        print("register", u, s, b)


IMG = {
    "polo_shirt": "/assets_pecas/01_Parte_superior/06_polo_shirt_camisa_polo.png",
    "hoodie": "/assets_pecas/01_Parte_superior/10_hoodie_moletom_com_capuz.png",
    "cardigan": "/assets_pecas/01_Parte_superior/11_cardigan.png",
    "blazer": "/assets_pecas/01_Parte_superior/13_blazer.png",
    "jacket": "/assets_pecas/01_Parte_superior/14_jacket_jaqueta.png",
    "coat": "/assets_pecas/01_Parte_superior/15_coat_casaco.png",
    "kimono": "/assets_pecas/01_Parte_superior/18_kimono_quimono.png",
    "jeans": "/assets_pecas/02_Parte_inferior/01_jeans.png",
    "cargo_pants": "/assets_pecas/02_Parte_inferior/04_calca_cargo.png",
    "skirt": "/assets_pecas/02_Parte_inferior/12_saia.png",
    "bermuda": "/assets_pecas/02_Parte_inferior/10_bermuda.png",
    "casual_sneakers": "/assets_pecas/03_Calcados/01_tenis_casual.png",
    "skate_shoes": "/assets_pecas/03_Calcados/04_tenis_skate.png",
    "high_top_sneakers": "/assets_pecas/03_Calcados/06_tenis_cano_alto.png",
    "loafer": "/assets_pecas/03_Calcados/05_loafer.png",
    "crossbody_bag": "/assets_pecas/04_Acessorios/01_bolsa_transversal.png",
}
CAT = {"polo_shirt": "upper_piece", "hoodie": "upper_piece", "cardigan": "upper_piece", "blazer": "upper_piece", "jacket": "upper_piece",
       "coat": "upper_piece", "kimono": "upper_piece", "jeans": "lower_piece", "cargo_pants": "lower_piece", "skirt": "lower_piece",
       "bermuda": "lower_piece", "casual_sneakers": "shoes_piece", "skate_shoes": "shoes_piece", "high_top_sneakers": "shoes_piece",
       "loafer": "shoes_piece", "crossbody_bag": "accessory_piece"}

# (n, dono, nome, sub, cor, material, marca, estilos, ocasião, visibilidade, idade dias, último uso dias, intensidade de sinais)
PIECES = [
    (1, "ana.hype", "TS Lacoste", "polo_shirt", "white", "COTTON", "Lacoste", "sporty,classic", "casual", "PUBLIC", 200, 10, 6),
    (2, "ana.hype", "Levi's 501", "jeans", "blue", "COTTON", "Levi's", "classic", "casual", "PUBLIC", 400, 127, 3),
    (3, "ana.hype", "Nike Dunk Low", "casual_sneakers", "black", "LEATHER", "Nike", "streetwear", "casual", "PUBLIC", 20, None, 10),
    (4, "ana.hype", "Blazer privado", "blazer", "black", "WOOL", "Zara", "classic", "work", "PRIVATE", 90, None, 0),
    (5, "bia.hype", "Polo Bia", "polo_shirt", "white", "COTTON", "Lacoste", "classic", "work", "PUBLIC", 60, None, 1),
    (6, "bia.hype", "Jeans Bia", "jeans", "blue", "COTTON", "Levi's", "classic", "casual", "PUBLIC", 60, None, 4),
    (7, "bia.hype", "Bolsa transversal", "crossbody_bag", "brown", "LEATHER", "Arezzo", "minimal", "casual", "PUBLIC", 45, 3, 2),
    (8, "caio.hype", "Hoodie Essentials", "hoodie", "gray", "COTTON", "Fear of God", "streetwear", "casual", "PUBLIC", 30, 2, 8),
    (9, "caio.hype", "Cargo Carhartt", "cargo_pants", "green", "COTTON", "Carhartt", "streetwear,utility", "casual", "PUBLIC", 50, 5, 7),
    (10, "caio.hype", "Jordan 1 High", "high_top_sneakers", "red", "LEATHER", "Nike", "streetwear", "casual", "PUBLIC", 15, 1, 9),
    (11, "dani.hype", "Trench Burberry", "coat", "beige", "COTTON", "Burberry", "classic,minimal", "work", "PUBLIC", 120, 20, 8),
    (12, "dani.hype", "Loafer Gucci", "loafer", "black", "LEATHER", "Gucci", "classic", "work", "PUBLIC", 80, 9, 5),
    (13, "dani.hype", "Saia plissada", "skirt", "navy", "POLYESTER", "Sézane", "romantic", "casual", "PUBLIC", 70, None, 2),
    (14, "eiji.hype", "Kimono jacket", "kimono", "indigo", "LINEN", "Visvim", "minimal,artsy", "casual", "PUBLIC", 40, 4, 7),
    (15, "eiji.hype", "Jaqueta Workwear", "jacket", "black", "COTTON", "Uniqlo", "minimal,utility", "casual", "PUBLIC", 100, 30, 3),
    (16, "eiji.hype", "Vans Old Skool", "skate_shoes", "black", "CANVAS", "Vans", "streetwear,skate", "casual", "PUBLIC", 200, 60, 5),
    (17, "fran.hype", "Cardigan tricot", "cardigan", "cream", "WOOL", "Rapsodia", "romantic", "casual", "PUBLIC", 300, 200, 1),
    (18, "fran.hype", "Bermuda linho", "bermuda", "beige", "LINEN", "Rapsodia", "minimal", "casual", "PUBLIC", 150, 45, 2),
]
LOOKS = [
    (1, "ana.hype", "Look Clube", "classic,sporty", "casual", [1, 2, 3], 30, 6),
    (2, "caio.hype", "Street NYC", "streetwear", "casual", [8, 9, 10], 12, 9),
    (3, "dani.hype", "Paris office", "classic,minimal", "work", [11, 12, 13], 25, 7),
    (4, "eiji.hype", "Tokyo layers", "minimal,artsy", "casual", [14, 15, 16], 18, 5),
    (5, "fran.hype", "Buenos Aires verão", "romantic,minimal", "casual", [17, 18], 60, 1),
]


def pid(n): return f"11111111-0000-0000-0000-{n:012d}"
def sid(n): return f"22222222-0000-0000-0000-{n:012d}"
def q(s): return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"


def signals(entity, eid, intensity, kinds):
    """Intensidade 0–10 → contagens nos últimos 30 dias, crescendo nos últimos 7 (tendência) para os mais fortes."""
    rows = []
    if intensity <= 0:
        return rows
    for d in range(0, 28):
        recent = d < 7
        base = intensity ** 1.6 / 6
        boost = (1 + intensity / 4) if recent else 1
        for k, w in kinds:
            c = int(round(base * w * boost * (1 + ((d * 7 + len(k)) % 5) / 10)))
            if c > 0:
                rows.append(f"(UUID(),'{entity}','{eid}','{k}',CURDATE() - INTERVAL {d} DAY,{c},{c},NOW(6))")
    return rows


def main():
    for u, c in USERS.items():
        register(u, c)
    sql = ["SET NAMES utf8mb4;", "UPDATE users SET role='ADMIN', email_verified=1 WHERE username='caio.hype';",
           "UPDATE users SET email_verified=1, status='ACTIVE', profile_visibility='PUBLIC' WHERE username LIKE '%.hype';"]
    for u in USERS:
        sql.append(f"SET @{u.split('.')[0]}=(SELECT id FROM users WHERE username='{u}');")
    vals = []
    for (n, o, name, sub, color, mat, brand, styles, occ, vis, age, worn, _) in PIECES:
        vals.append(f"('{pid(n)}',@{o.split('.')[0]},{q(name)},'{CAT[sub]}','{sub}','{color}','{mat}','{IMG[sub]}','APPROVED','{vis}',{q(brand)},'{styles}','{occ}','',"
                    f"NOW(6) - INTERVAL {age} DAY,NOW(6),{'NULL' if worn is None else f'CURDATE() - INTERVAL {worn} DAY'},0)")
    sql.append("INSERT INTO wardrobe_items (id,user_id,name,category,subcategory,color,material,image_url,moderation_status,visibility,brand_name,style_tags,occasion_tags,tags,created_at,updated_at,last_worn_date,likes_count) VALUES\n" + ",\n".join(vals) + ";")
    lv, li = [], []
    for (n, o, title, style, occ, items, age, _) in LOOKS:
        lv.append(f"('{sid(n)}',@{o.split('.')[0]},{q(title)},'MANUAL','{style}','{occ}','PUBLIC','PUBLISHED',NOW(6) - INTERVAL {age} DAY,NOW(6) - INTERVAL {age} DAY,NOW(6))")
        slots = {"upper_piece": "TOP", "lower_piece": "BOTTOM", "shoes_piece": "SHOES", "accessory_piece": "ACCESSORY"}
        for i, p in enumerate(items):
            sub = next(x[3] for x in PIECES if x[0] == p)
            li.append(f"(UUID(),'{sid(n)}','{pid(p)}','{slots[CAT[sub]]}',{i},NOW(6),NOW(6))")
    sql.append("INSERT INTO schemes (id,user_id,title,creation_mode,style,occasion,visibility,status,published_at,created_at,updated_at) VALUES\n" + ",\n".join(lv) + ";")
    sql.append("INSERT INTO scheme_items (id,scheme_id,wardrobe_item_id,slot,sort_order,created_at,updated_at) VALUES\n" + ",\n".join(li) + ";")
    rows = []
    for p in PIECES:
        rows += signals("PIECE", pid(p[0]), p[12], [("LIKE_CREATED", 1.0), ("SAVE_CREATED", 0.6), ("PIECE_VIEWED", 3.0), ("SHARE_CREATED", 0.2), ("PIECE_USED", 0.15)])
    for l in LOOKS:
        rows += signals("SCHEME", sid(l[0]), l[7], [("LIKE_CREATED", 1.0), ("SAVE_CREATED", 0.5), ("LOOK_VIEWED", 3.0), ("LOOK_REMIXED", 0.15)])
    for i in range(0, len(rows), 400):
        sql.append("INSERT INTO hype_signal_daily (id,entity_type,entity_id,signal_type,signal_date,event_count,weighted_count,updated_at) VALUES\n" + ",\n".join(rows[i:i + 400]) + ";")
    script = "\n".join(sql)
    open(sys.argv[1] if len(sys.argv) > 1 else "/dev/null", "w").write(script)
    r = subprocess.run(["docker", "exec", "-i", "fai-mysql", "mysql", "-uroot", "-proot", "--default-character-set=utf8mb4", "fashionai"], input=script.encode(), capture_output=True)
    print("mysql rc", r.returncode, r.stderr.decode()[-800:])
    s, b = call("POST", "/api/auth/login", {"identifier": "caio.hype@example.com", "password": PWD, "rememberMe": True})
    tok = b["accessToken"]
    print("job", call("POST", "/api/admin/hype/snapshots", None, tok))


if __name__ == "__main__":
    main()
