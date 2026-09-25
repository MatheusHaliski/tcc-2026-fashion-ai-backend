#!/usr/bin/env python3
"""
Fluxo de tradução dos catálogos (RF23).
  python3 scripts/i18n/translations.py todo <pasta> [--size 120]   → grava <pasta>/NN.json com {"fe:chave"|"be:chave": "texto pt-BR"} das chaves sem tradução
  python3 scripts/i18n/translations.py apply <arquivo.json>...      → lê {"fe:chave": ["en", "es"], ...} e grava em lib/i18n/messages/{en,es}.json e
                                                                       fai-application/src/main/resources/i18n/messages_{en,es}.properties
  python3 scripts/i18n/translations.py status                       → chaves sem tradução por catálogo
"""
import json, os, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "lib/i18n/messages")
BE = os.path.join(ROOT, "fai-application/src/main/resources/i18n")

def read_props(p):
    out = {}
    if not os.path.exists(p): return out
    for line in open(p, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1); out[k] = unescape(v)
    return out
def unescape(v):
    o = []; i = 0
    while i < len(v):
        c = v[i]
        if c == "\\" and i + 1 < len(v): n = v[i+1]; o.append("\n" if n == "n" else "\t" if n == "t" else n); i += 2
        else: o.append(c); i += 1
    return "".join(o)
def escape(v):
    s = v.replace("\\", "\\\\").replace("\n", "\\n").replace("\t", "\\t")
    return ("\\ " + s[1:]) if s.startswith(" ") else s
def write_props(p, d, header):
    with open(p, "w", encoding="utf-8") as f:
        f.write(header + "\n")
        for k in sorted(d): f.write(f"{k}={escape(d[k])}\n")
def read_json(p): return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
def write_json(p, d):
    json.dump(dict(sorted(d.items())), open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")

def catalogs():
    return {"fe": (read_json(f"{FE}/pt-BR.json"), read_json(f"{FE}/en.json"), read_json(f"{FE}/es.json")),
            "be": (read_props(f"{BE}/messages.properties"), read_props(f"{BE}/messages_en.properties"), read_props(f"{BE}/messages_es.properties"))}

def todo(folder, size):
    os.makedirs(folder, exist_ok=True)
    items = []
    for kind, (pt, en, es) in catalogs().items():
        for k, v in pt.items():
            if k not in en or k not in es: items.append((f"{kind}:{k}", v))
    for i in range(0, len(items), size):
        chunk = dict(items[i:i + size])
        write_json(os.path.join(folder, f"{i // size + 1:02d}.json"), chunk)
    print(f"{len(items)} chaves sem tradução em {(len(items) + size - 1) // size} arquivos")

def apply(files):
    cats = catalogs(); n = {"fe": 0, "be": 0}
    for f in files:
        for k, pair in json.load(open(f, encoding="utf-8")).items():
            kind, key = k.split(":", 1)
            pt, en, es = cats[kind]
            if key not in pt: print("chave desconhecida:", k); continue
            if not isinstance(pair, list) or len(pair) != 2: print("formato inválido:", k); continue
            en[key], es[key] = pair; n[kind] += 1
    write_json(f"{FE}/en.json", cats["fe"][1]); write_json(f"{FE}/es.json", cats["fe"][2])
    write_props(f"{BE}/messages_en.properties", cats["be"][1], "# Fashion AI — backend texts (English). MessageFormat patterns; keep {0}, {1}… and %s.")
    write_props(f"{BE}/messages_es.properties", cats["be"][2], "# Fashion AI — textos del backend (español). Patrones MessageFormat; mantener {0}, {1}… y %s.")
    print(f"aplicadas: frontend {n['fe']}, backend {n['be']}")

def status():
    for kind, (pt, en, es) in catalogs().items():
        miss_en = [k for k in pt if k not in en]; miss_es = [k for k in pt if k not in es]
        extra = [k for k in en if k not in pt] + [k for k in es if k not in pt]
        print(f"{kind}: {len(pt)} chaves · sem en {len(miss_en)} · sem es {len(miss_es)} · órfãs {len(extra)}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "todo": todo(sys.argv[2], int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 120)
    elif cmd == "apply": apply(sys.argv[2:])
    else: status()
