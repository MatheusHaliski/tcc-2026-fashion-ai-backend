#!/usr/bin/env python3
"""Converte lotes de tradução em TSV (chave<TAB>en<TAB>es; prefixo fe:/be: opcional via --kind) no JSON aceito por translations.py apply."""
import json, sys
kind = sys.argv[sys.argv.index("--kind") + 1] if "--kind" in sys.argv else "be"
files = [a for a in sys.argv[1:] if a.endswith(".tsv")]
for f in files:
    out = {}
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if not line.strip(): continue
        parts = line.split("\t")
        if len(parts) != 3: sys.exit(f"{f}:{n}: esperado 3 colunas, veio {len(parts)}: {line[:80]}")
        k, en, es = parts
        out[k if ":" in k.split(".")[0] else f"{kind}:{k}"] = [en, es]
    json.dump(out, open(f[:-4] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f, len(out))
