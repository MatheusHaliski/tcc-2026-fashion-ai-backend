#!/usr/bin/env python3
"""RF47 · Reaplica as regras atuais de tipo aos JSONL já coletados (antes de importar).

    python scripts/catalog/recheck_collected.py                 # todas as marcas de data/catalog/collected
    python scripts/catalog/recheck_collected.py --dry-run       # só mostra o que mudaria

O título é limpo ("| Marca® Official", "- Women", "| Tall" saem; "| Black" vira a cor e o nome limpo vira o modelo,
para as cores entrarem como variantes). O tipo vem do nome do produto: roupa íntima/vale-presente sai, kit sem tipo
claro sai, nome sem tipo reconhecido sai (nunca chutado) e tipo diferente do lido no nome é corrigido. Cada arquivo é reescrito por inteiro (via arquivo
temporário). Não rode com o coletor gravando na mesma pasta.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from normalize_product import Normalizer  # noqa: E402
from providers.official_sitemap import clean_title, infer_subcategory, is_pack, unsupported_reason  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "data/catalog/collected"


def recheck(item: dict, n: Normalizer) -> tuple[str, dict | None]:
    raw = item.get("product_name")
    name, title_color = clean_title(raw, item.get("brand") or "", n)
    if name != raw:                                               # "Hoodie | Black | Tall" → "Hoodie", cor Black
        item = {**item, "product_name": name}
        if title_color:
            item["model_name"] = item.get("model_name") or name
            if not item.get("color") and n.color(title_color):
                item["color"], item["color_name"] = n.color(title_color), title_color
    if unsupported_reason(name):
        return "fora_do_acervo", None
    sub = infer_subcategory(n, name)
    if not sub:
        return "sem_tipo_no_nome", None
    if is_pack(name) and sub != "socks":
        return "kit_sem_tipo", None
    if sub != item.get("subcategory"):
        return "tipo_corrigido", {**item, "subcategory": sub}
    return ("titulo_limpo" if name != raw else "ok"), item


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Reaplica as regras de tipo aos JSONL coletados")
    ap.add_argument("--dir", default=str(OUT))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)
    n = Normalizer()
    total = Counter()
    for path in sorted(Path(args.dir).glob("*.jsonl")):
        kept, counts = [], Counter()
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            item = json.loads(line)
            outcome, new = recheck(item, n)
            counts[outcome] += 1
            if args.verbose and outcome != "ok":
                print(f"  {outcome:<16} {item.get('subcategory')} → {new and new['subcategory']}  {item.get('product_name')}")
            if new:
                kept.append(new)
        total.update(counts)
        if counts.keys() - {"ok"}:
            print(f"{path.name}: " + " · ".join(f"{k} {v}" for k, v in sorted(counts.items())))
            if not args.dry_run:
                tmp = path.with_suffix(".jsonl.tmp")
                tmp.write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in kept), encoding="utf-8")
                tmp.replace(path)
    print("Total: " + " · ".join(f"{k} {v}" for k, v in sorted(total.items())) + ("  [DRY-RUN]" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
