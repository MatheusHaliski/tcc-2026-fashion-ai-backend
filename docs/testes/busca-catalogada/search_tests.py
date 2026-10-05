"""Bateria de buscas reais na API do catálogo (GET /api/catalog/search), como o criador de peças faz:
tipo da peça (category) + Marca + "Como ela se chama?" (q). Verifica o que a tela precisa: resultado, marca certa,
tipo certo, cor pedida no topo e foto."""
import json
import os
import sys
import urllib.parse
import urllib.request

API = os.getenv("FAI_API", "http://localhost:8080").rstrip("/")   # FAI_API=https://<api-no-railway> para o ambiente publicado
TOKEN = open(sys.argv[1]).read().strip()

# (tipo, marca, texto, subtipos esperados, cor esperada no 1º resultado)
CASES = [
    ("upper_piece", "Nike", "camiseta azul", {"t_shirt"}, "blue"),
    ("upper_piece", "Nike", "camiseta preta", {"t_shirt"}, "black"),
    ("lower_piece", "Nike", "shorts preto", {"shorts"}, "black"),
    ("lower_piece", "Levi's", "calça jeans 501", {"jeans"}, None),
    ("shoes_piece", "Vans", "tênis slip-on preto", {"casual_sneakers", "slip_on_sneakers"}, "black"),
    ("full_piece", "Farm Rio", "vestido estampado", {"dress", "midi_dress", "maxi_dress", "mini_dress"}, None),
    ("upper_piece", "Burberry", "trench coat", {"trench_coat", "coat"}, None),
    ("upper_piece", "Everlane", "moletom com capuz preto", {"hoodie"}, "black"),
    ("lower_piece", "Dickies", "calça cargo", {"cargo_pants"}, None),
    ("shoes_piece", "Havaianas", "chinelo", {"flip_flops"}, None),
    ("upper_piece", "Lacoste", "polo branca", {"polo_shirt"}, "white"),   # lacoste.com recusa robôs: só o seed, sem foto
    ("upper_piece", None, "camiseta listrada", {"t_shirt"}, None),
]


def search(category, brand, q):
    params = {k: v for k, v in {"category": category, "brand": brand, "q": q, "limit": 24}.items() if v}
    req = urllib.request.Request(f"{API}/api/catalog/search?{urllib.parse.urlencode(params)}",
                                 headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


ok_all = True
report = []
for category, brand, q, subs, color in CASES:
    d = search(category, brand, q)
    res = d.get("results") or []
    top = res[0] if res else {}
    checks = {
        "tem resultado": bool(res),
        "marca certa": not brand or all((r.get("brand") or {}).get("name", "").lower() == brand.lower() for r in res[:5]),
        "tipo certo no topo": bool(top) and top.get("subcategory") in subs,
        "cor certa no topo": color is None or top.get("color") == color,
        "foto no topo": bool(top.get("imageUrl")) or brand == "Lacoste",   # limitação de dados conhecida (sem coleta)
    }
    with_img = sum(1 for r in res if r.get("imageUrl"))
    passed = all(checks.values())
    ok_all &= passed
    print(f"\n{'✅' if passed else '❌'} {brand or '(sem marca)'} · \"{q}\" · {category} → {d.get('total', len(res))} resultados, {with_img}/{len(res)} com foto")
    for r in res[:3]:
        print(f"   {r.get('matchPercent', '?'):>3}%  {r['productName'][:62]:<62} {r.get('subcategory'):<16} {str(r.get('color')):<8} "
              f"{'foto ✓' if r.get('imageUrl') else 'sem foto'}")
    failed = [k for k, v in checks.items() if not v]
    if failed:
        print("   falhou:", ", ".join(failed))
    report.append({"brand": brand, "q": q, "category": category, "total": d.get("total", len(res)), "with_image": with_img,
                   "checks": checks, "top": [{k: r.get(k) for k in ("productName", "subcategory", "color", "matchPercent", "imageUrl")}
                                             for r in res[:3]]})
json.dump(report, open(sys.argv[2] if len(sys.argv) > 2 else "/dev/null", "w"), ensure_ascii=False, indent=1)
print("\nRESULTADO:", "todas as buscas passaram" if ok_all else "há buscas com falha")
