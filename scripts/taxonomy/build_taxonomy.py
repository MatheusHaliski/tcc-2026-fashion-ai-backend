#!/usr/bin/env python3
"""Gera a taxonomia de peças a partir de scripts/taxonomy/{variations,attributes}.py (fonte editável).

    python3 scripts/taxonomy/build_taxonomy.py            # gera e valida
    python3 scripts/taxonomy/build_taxonomy.py --check    # só confere se os arquivos gerados estão em dia (CI/local)

Saídas (nunca edite à mão):
  fai-application/src/main/resources/taxonomy/taxonomy.json      — lida pelo backend (TaxonomyRegistry) e pelo Python
  db/migration/V39__taxonomia_seed_estrutura.sql                 — categorias, subcategorias, legado, dimensões, escopos
  db/migration/V40__taxonomia_seed_valores.sql                   — valores das dimensões + aliases de valor
  db/migration/V41__taxonomia_seed_variacoes.sql                 — variações, subcategoria × variação, aliases
  docs/taxonomia/proposta/taxonomia_variacoes.csv                — tabela mestre (uma linha por subcategoria × variação)
  fai-application/src/main/resources/catalog/normalization.json  — seções taxonomy.subcategories, taxonomy.materials,
                                                                   legacySubcategories e sinônimos das subcategorias novas
As migrations já aplicadas não mudam: depois que V39–V41 forem para produção, mudanças entram numa migration nova.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from attributes import (COLUMN_DIMENSIONS, DIMENSIONS, LEGACY, LEGACY_COLORS, LEGACY_MATERIALS,  # noqa: E402
                        NEW_SUBCATEGORIES, NEW_SUBCATEGORY_LABELS_ES, NEW_SUBCATEGORY_SYNONYMS, SUBCATEGORY_ORDER,
                        VALUES)
from variations import S, V  # noqa: E402

RESOURCE = REPO / "fai-application/src/main/resources/taxonomy/taxonomy.json"
NORMALIZATION = REPO / "fai-application/src/main/resources/catalog/normalization.json"
MIGRATIONS = REPO / "fai-infrastructure/persistence-mysql/src/main/resources/db/migration"
CSV_OUT = REPO / "docs/taxonomia/proposta/taxonomia_variacoes.csv"

CAT_ABBR = {"UP": "upper_piece", "LO": "lower_piece", "FB": "full_body_piece", "SH": "shoes_piece", "AC": "accessory_piece"}
CATS = ["upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece"]
CAT_LABELS = {"upper_piece": ("Parte superior", "Top", "Parte superior"),
              "lower_piece": ("Parte inferior", "Bottom", "Parte inferior"),
              "full_body_piece": ("Peça inteira", "One-piece", "Prenda entera"),
              "shoes_piece": ("Calçados", "Shoes", "Calzado"),
              "accessory_piece": ("Acessórios", "Accessories", "Accesorios")}
TIER_ORDER = {"CORE": 0, "EXTENDED": 1, "NICHE": 2}


def key(s: str) -> str:
    """Mesma normalização de CatalogNormalizer.key()."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def labels(path: str) -> dict:
    return dict(re.findall(r'(\w+): "([^"]*)"', (REPO / path).read_text(encoding="utf-8")))


PT, EN, ES = labels("lib/api/labels-pt.ts"), labels("lib/api/labels-en.ts"), labels("lib/api/labels-es.ts")
NJ = json.loads(NORMALIZATION.read_text(encoding="utf-8"))
TX = (REPO / "fai-application/src/main/java/br/com/fashionai/application/taxonomy/Taxonomy.java").read_text(encoding="utf-8")


def java_list(name: str) -> list[str]:
    m = re.search(name + r"\s*=\s*List\.of\(([^;]*)\);", TX, re.S)
    return re.findall(r'"([^"]+)"', m.group(1))


STYLES, OCCASIONS, SEXES = java_list("STYLES"), java_list("OCCASIONS"), java_list("SEXES")
COLORS = re.findall(r'\{"([^"]+)", "([a-z_]+)", "(#[0-9A-Fa-f]{6})"\}', TX)

errors: list[str] = []

# ───────────── subcategorias
subcats = []
for cat in CATS:
    for i, code in enumerate(SUBCATEGORY_ORDER[cat]):
        new = NEW_SUBCATEGORIES.get(code)
        x = {"code": code, "category": cat, "status": "LEGACY" if code in LEGACY else "ACTIVE", "order": i + 1,
             "labels": {"pt-BR": new[1] if new else PT.get(code, code), "en": new[2] if new else EN.get(code, code),
                        "es": NEW_SUBCATEGORY_LABELS_ES.get(code) or ES.get(code, EN.get(code, code))}}
        if new:
            x["description"] = new[3]
        if code in LEGACY:
            target, implies, review, why = LEGACY[code]
            x.update(replacedBy=target, implies={d: c for d, c in implies}, needsReview=review, reason=why)
        subcats.append(x)
SUB = {x["code"]: x for x in subcats}
for code, (cat, *_r) in NEW_SUBCATEGORIES.items():
    if SUB.get(code, {}).get("category") != cat:
        errors.append(f"subcategoria nova fora da ordem: {code}")
active = [x["code"] for x in subcats if x["status"] == "ACTIVE"]
for code in active:
    if code not in S:
        errors.append(f"subcategoria ativa sem variações: {code}")
for code in S:
    if SUB.get(code, {}).get("status") != "ACTIVE":
        errors.append(f"variações numa subcategoria que não está ativa: {code}")

# ───────────── variações
used = defaultdict(list)
for sub, rows in S.items():
    seen = set()
    for code, tier, prio in rows:
        if code not in V:
            errors.append(f"{sub}: variação inexistente {code}")
        if code in seen:
            errors.append(f"{sub}: {code} repetida")
        seen.add(code)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", code) or not 1 <= prio <= 5:
            errors.append(f"{sub}: código/prioridade inválida {code} {prio}")
        used[code].append(sub)
for code in V:
    if code not in used:
        errors.append(f"variação definida e não usada: {code}")
for sub, rows in S.items():           # dentro da subcategoria, um alias normalizado aponta para UMA variação
    owner: dict[str, str] = {}
    for code, _t, _p in rows:
        for a in V[code]["aliases_pt"] + V[code]["aliases_en"] + [V[code]["pt"], V[code]["en"]]:
            k = key(a)
            if k and owner.get(k, code) != code:
                errors.append(f"{sub}: '{a}' → {owner[k]} e {code}")
            owner.setdefault(k, code)

# ───────────── dimensões e valores
VALUES["COLOR"] = [{"code": code, "pt": PT.get(code, code), "en": EN.get(code, code), "es": ES.get(code), "tier": "CORE",
                    "priority": 1, "group": family, "hex": hexv, "scope": [],
                    "status": "LEGACY" if code in LEGACY_COLORS else "ACTIVE",
                    "aliases_pt": [s for s in NJ["colorSynonyms"].get(code, []) if key(s) != code], "aliases_en": []}
                   for family, code, hexv in COLORS]
VALUES["STYLE"] = [{"code": c, "pt": PT.get(c, c), "en": EN.get(c, c), "es": ES.get(c), "tier": "CORE", "priority": 1,
                    "group": None, "scope": [], "aliases_pt": [], "aliases_en": []} for c in STYLES]
VALUES["OCCASION"] = [{"code": c, "pt": PT.get(c, c), "en": EN.get(c, c), "es": ES.get(c), "tier": "CORE", "priority": 1,
                       "group": None, "scope": [], "aliases_pt": [], "aliases_en": []} for c in OCCASIONS]
VALUES["GENDER"] = [{"code": c, "pt": PT.get(c.lower(), c.title()), "en": EN.get(c.lower(), c.title()),
                     "es": ES.get(c.lower()), "tier": "CORE", "priority": 1, "group": None, "scope": [],
                     "aliases_pt": [a for a in NJ["genderSynonyms"].get(c, []) if len(key(a)) > 1], "aliases_en": []}
                    for c in SEXES]
for x in VALUES["MATERIAL"]:
    if x["code"] in LEGACY_MATERIALS:
        x["status"] = "LEGACY"

dims = []
for order, (code, pt, en, multi, mp, ms, scope, desc) in enumerate(DIMENSIONS):
    vs = VALUES[code]
    scope = [CAT_ABBR.get(s, s) for s in scope]
    for x in vs:
        x["scope"] = [CAT_ABBR.get(s, s) for s in x.get("scope", [])]
        for s in x["scope"] + scope:
            if s not in CATS and s not in SUB:
                errors.append(f"{code}.{x['code']}: escopo desconhecido {s}")
    for i, a in enumerate(vs):
        for b in vs[i + 1:]:
            if not set(a["scope"] or scope) & set(b["scope"] or scope):
                continue
            ka = {key(t) for t in a["aliases_pt"] + a["aliases_en"]} - {""}
            kb = {key(t) for t in b["aliases_pt"] + b["aliases_en"]} - {""}
            for k in sorted(ka & kb):
                errors.append(f"{code}: alias '{k}' em {a['code']} e {b['code']}")
    if len({x["code"] for x in vs}) != len(vs):
        errors.append(f"{code}: código repetido")
    dims.append({"code": code, "labels": {"pt-BR": pt, "en": en}, "multiValued": multi, "maxPerPiece": mp,
                 "maxPerScheme": ms, "storage": "COLUMN" if code in COLUMN_DIMENSIONS else "ATTRIBUTE",
                 "appliesTo": scope, "description": desc, "values": vs})
DIM = {d["code"]: d for d in dims}
for legacy, (target, implies, _r, _w) in LEGACY.items():
    for d, c in implies:
        if d == "VARIATION":
            if c not in [r[0] for r in S[target]]:
                errors.append(f"legado {legacy}: {c} não é variação de {target}")
        elif c not in [x["code"] for x in VALUES[d]]:
            errors.append(f"legado {legacy}: {d}={c} inexistente")

if errors:
    sys.exit("taxonomia inválida:\n  " + "\n  ".join(errors))


def sorted_links(sub: str):
    return sorted(S[sub], key=lambda r: (TIER_ORDER[r[1]], r[2]))


def value_json(x: dict) -> dict:
    out = {"code": x["code"], "labels": {k: v for k, v in {"pt-BR": x["pt"], "en": x["en"], "es": x.get("es")}.items() if v},
           "tier": x["tier"], "priority": x["priority"]}
    for k_out, k_in in (("group", "group"), ("hex", "hex")):
        if x.get(k_in):
            out[k_out] = x[k_in]
    if x["scope"]:
        out["appliesTo"] = x["scope"]
    if x.get("status", "ACTIVE") != "ACTIVE":
        out["status"] = x["status"]
    al = {k: v for k, v in {"pt-BR": x["aliases_pt"], "en": x["aliases_en"]}.items() if v}
    if al:
        out["aliases"] = al
    return out


# ───────────── JSON de recurso (backend e Python)
doc = {
    "_doc": "Taxonomia de peças CATEGORY → SUBCATEGORY → VARIATION + dimensões de atributo. GERADO por "
            "scripts/taxonomy/build_taxonomy.py a partir de scripts/taxonomy/{variations,attributes}.py — não edite à mão. "
            "Desenho: docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md.",
    "version": "1.0.0",
    "categories": [{"code": c, "labels": dict(zip(("pt-BR", "en", "es"), CAT_LABELS[c]))} for c in CATS],
    "subcategories": [{k: v for k, v in {
        "code": x["code"], "category": x["category"], "status": x["status"], "labels": x["labels"],
        "description": x.get("description"), "replacedBy": x.get("replacedBy"), "implies": x.get("implies"),
        "needsReview": x.get("needsReview"),
        "variations": [{"code": c, "tier": t, "priority": p} for c, t, p in sorted_links(x["code"])] if x["code"] in S else None,
    }.items() if v is not None} for x in subcats],
    "variations": {c: {"labels": {"pt-BR": d["pt"], "en": d["en"]}, "description": d["desc"],
                       "aliases": {"pt-BR": d["aliases_pt"], "en": d["aliases_en"]}} for c, d in sorted(V.items())},
    "dimensions": [{k: v for k, v in {
        "code": d["code"], "labels": d["labels"], "multiValued": d["multiValued"], "maxPerPiece": d["maxPerPiece"],
        "maxPerScheme": d["maxPerScheme"], "storage": d["storage"], "appliesTo": d["appliesTo"],
        "description": d["description"], "values": [value_json(x) for x in d["values"]]}.items() if v is not None}
        for d in dims],
}
outputs: dict[Path, str] = {RESOURCE: json.dumps(doc, ensure_ascii=False, indent=1) + "\n"}


# ───────────── migrations (seed; INSERT simples: o Flyway roda cada uma uma vez)
def q(s) -> str:
    if s is None:
        return "NULL"
    if isinstance(s, bool):
        return "TRUE" if s else "FALSE"
    if isinstance(s, int):
        return str(s)
    return "'" + str(s).replace("\\", "\\\\").replace("'", "''") + "'"


def inserts(out: io.StringIO, table: str, cols: list[str], rows: list[tuple], size: int = 100):
    for i in range(0, len(rows), size):
        out.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES\n")
        out.write(",\n".join("  (" + ", ".join(q(v) for v in r) + ")" for r in rows[i:i + size]))
        out.write(";\n")


HEADER = ("-- GERADO por scripts/taxonomy/build_taxonomy.py a partir de scripts/taxonomy/*.py — não edite à mão.\n"
          "-- Taxonomia de peças (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md). Só INSERT em tabelas da V38.\n")

v39 = io.StringIO()
v39.write(HEADER + "-- Estrutura: categorias, subcategorias (ativas e LEGACY), o que cada legado implica, dimensões e escopos.\n\n")
inserts(v39, "taxonomy_categories", ["code", "display_name_pt_br", "display_name_en", "sort_order"],
        [(c, CAT_LABELS[c][0], CAT_LABELS[c][1], i + 1) for i, c in enumerate(CATS)])
cols = ["code", "category_code", "display_name_pt_br", "display_name_en", "status", "replaced_by_code", "sort_order"]
inserts(v39, "taxonomy_subcategories", cols,
        [(x["code"], x["category"], x["labels"]["pt-BR"], x["labels"]["en"], "ACTIVE", None, x["order"]) for x in subcats if x["status"] == "ACTIVE"])
inserts(v39, "taxonomy_subcategories", cols,
        [(x["code"], x["category"], x["labels"]["pt-BR"], x["labels"]["en"], "LEGACY", x["replacedBy"], x["order"]) for x in subcats if x["status"] == "LEGACY"])
inserts(v39, "taxonomy_subcategory_mappings", ["legacy_code", "dimension_code", "value_code", "needs_review"],
        [(c, d, v, r) for c, (t, imp, r, _w) in LEGACY.items() for d, v in imp])
inserts(v39, "taxonomy_dimensions", ["code", "display_name_pt_br", "display_name_en", "multi_valued", "max_per_piece",
                                     "max_per_scheme", "storage", "sort_order"],
        [(d["code"], d["labels"]["pt-BR"], d["labels"]["en"], d["multiValued"], d["maxPerPiece"], d["maxPerScheme"],
          d["storage"], i + 1) for i, d in enumerate(dims)])
scope_rows = []
for d in dims:
    for s in d["appliesTo"]:
        scope_rows.append((d["code"], s, "") if s in CATS else (d["code"], SUB[s]["category"], s))
inserts(v39, "taxonomy_dimension_scopes", ["dimension_code", "category_code", "subcategory_code"], scope_rows)

v40 = io.StringIO()
v40.write(HEADER + "-- Valores das dimensões (os atuais — cores, estilos, ocasiões, gêneros — com os mesmos códigos) e aliases de valor.\n\n")
val_rows, val_alias = [], []
for d in dims:
    for i, x in enumerate(d["values"]):
        val_rows.append((d["code"], x["code"], x["pt"], x["en"], x["tier"], x["priority"], x["group"], x.get("hex"),
                         json.dumps(x["scope"]) if x["scope"] else None, x.get("status", "ACTIVE"), i + 1))
        seen = set()
        for loc, lst in (("pt-BR", x["aliases_pt"]), ("en", x["aliases_en"])):
            for a in lst:
                k = key(a)
                if k and k not in seen and k != key(x["code"]):
                    seen.add(k)
                    val_alias.append(("VALUE", d["code"], x["code"], "", a, k, loc))
# alias igual em valores de escopos disjuntos (ex.: "cropped" em comprimento de blusa × de calça) não cabe na chave
# única sem escopo: fica só o primeiro no banco; a resolução por escopo é feita pelo TaxonomyRegistry (JSON)
uniq, alias_rows = set(), []
for r in val_alias:
    if (r[1], r[5]) not in uniq:
        uniq.add((r[1], r[5]))
        alias_rows.append(r)
inserts(v40, "taxonomy_values", ["dimension_code", "code", "display_name_pt_br", "display_name_en", "tier", "priority",
                                 "value_group", "hex", "scope_json", "status", "sort_order"], val_rows)
inserts(v40, "taxonomy_aliases", ["target_type", "dimension_code", "target_code", "scope_subcategory_code", "alias",
                                  "alias_norm", "locale"], alias_rows)

v41 = io.StringIO()
v41.write(HEADER + f"-- {len(V)} variações (corte/silhueta/construção), ligações subcategoria × variação e aliases por subcategoria.\n\n")
inserts(v41, "taxonomy_variations", ["code", "display_name_pt_br", "display_name_en", "description_pt_br"],
        [(c, d["pt"], d["en"], d["desc"]) for c, d in sorted(V.items())])
link_rows, var_alias, csv_rows = [], [], []
for x in subcats:
    if x["code"] not in S:
        continue
    for order, (code, tier, prio) in enumerate(sorted_links(x["code"])):
        d = V[code]
        link_rows.append((x["code"], code, tier, prio, order + 1))
        seen = set()
        for loc, lst in (("pt-BR", d["aliases_pt"]), ("en", d["aliases_en"])):
            for a in lst:
                k = key(a)
                if k and k not in seen:
                    seen.add(k)
                    var_alias.append(("VARIATION", code, x["code"], a, k, loc))
        csv_rows.append({"category_code": x["category"], "subcategory_code": x["code"], "subcategory_pt_br": x["labels"]["pt-BR"],
                         "variation_code": code, "tier": tier, "priority": prio, "sort_order": order + 1,
                         "display_name_pt_br": d["pt"], "display_name_en": d["en"], "description_pt_br": d["desc"],
                         "aliases_pt_br": " | ".join(d["aliases_pt"]), "aliases_en": " | ".join(d["aliases_en"]),
                         "shared_with": " ".join(s for s in used[code] if s != x["code"])})
inserts(v41, "taxonomy_subcategory_variations", ["subcategory_code", "variation_code", "tier", "priority", "sort_order"], link_rows)
inserts(v41, "taxonomy_aliases", ["target_type", "target_code", "scope_subcategory_code", "alias", "alias_norm", "locale"], var_alias)
outputs[MIGRATIONS / "V39__taxonomia_seed_estrutura.sql"] = v39.getvalue()
outputs[MIGRATIONS / "V40__taxonomia_seed_valores.sql"] = v40.getvalue()
outputs[MIGRATIONS / "V41__taxonomia_seed_variacoes.sql"] = v41.getvalue()

buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=list(csv_rows[0]), lineterminator="\n")
w.writeheader()
w.writerows(csv_rows)
outputs[CSV_OUT] = buf.getvalue()

# ───────────── normalization.json (mesma taxonomia para CatalogNormalizer e scripts/catalog)
nj = json.loads(NORMALIZATION.read_text(encoding="utf-8"))
nj["taxonomy"]["subcategories"] = {c: [s for s in SUBCATEGORY_ORDER[c] if s not in LEGACY] for c in CATS}
nj["taxonomy"]["materials"] = [x["code"] for x in VALUES["MATERIAL"]]
nj["legacySubcategories"] = {c: {"category": SUB[c]["category"], "replacedBy": t, "implies": {d: v for d, v in imp},
                                 "needsReview": r} for c, (t, imp, r, _w) in LEGACY.items()}
syn = nj["subcategorySynonyms"]
for code, words in NEW_SUBCATEGORY_SYNONYMS.items():
    syn[code] = words
mat: dict[str, list[str]] = {}
taken = set()
for x in VALUES["MATERIAL"]:                      # aliases da taxonomia primeiro (DENIM, LINEN, SUEDE, NYLON…)
    lst = []
    for a in x["aliases_pt"] + x["aliases_en"]:
        k = key(a)
        if k and k not in taken and k != key(x["code"]):
            taken.add(k)
            lst.append(a)
    mat[x["code"]] = lst
for code, lst in NJ["materialSynonyms"].items():  # sinônimos antigos que não colidem ("la" sai: "camiseta de la marca")
    for a in lst:
        k = key(a)
        if k and k not in taken and k != "la" and k != key(code):
            taken.add(k)
            mat.setdefault(code, []).append(a)
nj["materialSynonyms"] = mat
order = ["_doc", "version", "taxonomy", "legacySubcategories"]
nj = {k: nj[k] for k in order + [k for k in nj if k not in order]}
outputs[NORMALIZATION] = json.dumps(nj, ensure_ascii=False, indent=1) + "\n"

if "--check" in sys.argv:
    stale = [str(p.relative_to(REPO)) for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
    if stale:
        sys.exit("arquivos gerados desatualizados (rode scripts/taxonomy/build_taxonomy.py):\n  " + "\n  ".join(stale))
    print("taxonomia em dia")
else:
    for p, text in outputs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    print(f"{len(V)} variações · {len(link_rows)} ligações · {len(active)} subcategorias ativas · {len(LEGACY)} legado · "
          f"{len(dims)} dimensões · {len(val_rows)} valores · {len(alias_rows) + len(var_alias)} aliases no banco")
