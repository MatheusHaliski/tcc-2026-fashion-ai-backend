"""Avaliação da leitura de estampa contra rótulos feitos a olho: refaz a análise de cada produto do lote com a foto e
os rótulos do segmentador guardados no cache (sem rodar a rede) e compara padronagem e desenhos com o esperado.

Os rótulos (``tests/data/rotulos_estampa.json``) dizem, por produto: a padronagem certa (e as outras aceitáveis), os
desenhos que se veem na frente da foto (lado e, na frente, se ficam no centro, à direita ou à esquerda da foto;
``pequeno``: logo miúdo, que pode faltar) e se a manga tem faixa. Não guardam imagem nenhuma.

    cd services/garment_blender && ~/.venv-catalogo/bin/python -m catalogo.avaliacao --catalogo ~/catalogo-3d
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from . import pistas
from .analise import analyze

ROTULOS = Path(__file__).resolve().parents[1] / "tests" / "data" / "rotulos_estampa.json"
CENTER = 0.07    # desenho com o centro até 7 cm do eixo (ou que passa pelo eixo) é "do centro"
SIDE = 0.02      # do lado: o centro a mais de 2 cm do eixo para esse lado


def cached_photo(catalog: Path, url: str) -> Path:
    """A foto baixada pelo lote fica no cache com o nome do hash do endereço (``baixar.fetch``)."""
    return catalog / "_cache" / hashlib.sha1(url.encode()).hexdigest()[:20]


def run_product(catalog: Path, ident: str) -> dict | None:
    """A análise do lote para um produto já processado, com a ficha gravada dando a base (medidas, fechamento, gola) e o
    nome do produto como pista de texto. None quando a foto ou os rótulos não estão no cache."""
    from .lote import _measures, _open   # o lote importa o motor (medidas da base): só quando avalia de verdade
    spec = json.loads((catalog / ident / "ficha.json").read_text(encoding="utf-8"))
    url = (spec.get("origem") or {}).get("imagem")
    path = cached_photo(catalog, url) if url else None
    labels = path.with_name(path.name + ".rotulos.png") if path else None
    if path is None or not path.is_file() or not labels.is_file():
        return None
    img = _open(path)
    length, chest_a, sleeve, neck = _measures(spec)
    avoid = spec["fechamento"] in ("botoes", "ziper_inteiro", "aberto")
    clues = pistas.from_text(spec.get("produto"), "", spec.get("subcategoria"), spec["fechamento"])
    return analyze(np.asarray(img), np.asarray(Image.open(labels)), length, chest_a, avoid, sleeve,
                   hooded=spec["gola"] == "capuz", neck=neck, clues=clues)


def _matches(decal: dict, want: dict) -> bool:
    if decal["lado"] != want["lado"]:
        return False
    if want["lado"] != "frente":
        return True
    x, half = decal["x"], decal["largura"] / 2
    return {"centro": abs(x) <= CENTER or abs(x) < half, "dir": x > SIDE, "esq": x < -SIDE}[want["x"]]


def score(want: dict, got: dict) -> dict:
    """Um produto: a padronagem bate? quais desenhos esperados apareceram, quantos decalques não são desenho nenhum."""
    ok_patterns = {want["padrao"], *want.get("aceita", [])}
    decals = got.get("decalques", []) if got["padrao"] == "localizada" else []
    wanted = want.get("desenhos", []) if want["padrao"] == "localizada" else []
    good = [d for d in decals if any(_matches(d, w) for w in wanted)]
    found = [w for w in wanted if any(_matches(d, w) for d in decals)]
    wrong_pattern = got["padrao"] not in ok_patterns
    junk = len(decals) - len(good)
    return {"padrao": got["padrao"], "esperado": want["padrao"], "padrao_ok": not wrong_pattern,
            "falso": got["padrao"] != "liso" and (wrong_pattern or (got["padrao"] == "localizada" and not good)),
            "decalques": len(decals), "decalques_bons": len(good), "decalques_falsos": junk,
            "peito": [bool(any(_matches(d, w) for d in decals)) for w in wanted
                      if w["lado"] == "frente" and not w.get("pequeno")],
            "achados": len(found), "faixas": bool(got.get("faixas_manga")), "faixas_esperadas":
            bool(want.get("faixas_manga"))}


def summary(rows: dict[str, dict]) -> dict:
    """As medidas do conjunto: falso positivo da padronagem não lisa (entre as que saíram não lisas, as que não têm o
    desenho que a foto mostra), o quanto dos desenhos grandes da frente aparece e quantos decalques são lixo."""
    r = list(rows.values())
    non_plain = [x for x in r if x["padrao"] != "liso"]
    chest = [hit for x in r for hit in x["peito"]]
    decals = sum(x["decalques"] for x in r)
    plain = [x for x in r if x["esperado"] == "liso"]
    allover = [x for x in r if x["padrao"] == "corrida"]
    allover_want = [x for x in r if x["esperado"] == "corrida"]
    bands = [x for x in r if x["faixas_esperadas"]]
    bands_got = [x for x in r if x["faixas"]]

    def frac(a, b):
        return round(a / b, 3) if b else None
    return {
        "produtos": len(r), "padrao_certo": frac(sum(x["padrao_ok"] for x in r), len(r)),
        "nao_liso": len(non_plain), "falso_nao_liso": frac(sum(x["falso"] for x in non_plain), len(non_plain)),
        "liso_marcado_nao_liso": frac(sum(x["padrao"] != "liso" for x in plain), len(plain)),
        "peito_achado": frac(sum(chest), len(chest)), "peito_total": len(chest),
        "decalques": decals, "decalques_falsos": frac(sum(x["decalques_falsos"] for x in r), decals),
        "corrida_precisao": frac(sum(x["esperado"] == "corrida" for x in allover), len(allover)),
        "corrida_achada": frac(sum(x["padrao"] == "corrida" for x in allover_want), len(allover_want)),
        "faixas_achadas": frac(sum(x["faixas"] for x in bands), len(bands)),
        "faixas_precisao": frac(sum(x["faixas_esperadas"] for x in bands_got), len(bands_got)),
    }


def _save(folder: Path, ident: str, got: dict) -> None:
    """Os decalques e o ladrilho da corrida de cada produto, para olhar o antes e o depois."""
    folder.mkdir(parents=True, exist_ok=True)
    for k, d in enumerate(got.get("decalques", [])):
        Image.fromarray(d["imagem"], "RGBA").save(folder / f"{ident}-estampa-{k}.png")
    if got.get("padrao") == "corrida":
        Image.fromarray(got["corrida"]["imagem"]).save(folder / f"{ident}-corrida.jpg", quality=88)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--catalogo", type=Path, required=True, help="pasta do lote (com _cache)")
    ap.add_argument("--rotulos", type=Path, default=ROTULOS)
    ap.add_argument("--imagens", type=Path, help="grava aqui os decalques e ladrilhos de cada produto")
    ap.add_argument("--linhas", type=Path, help="grava aqui o resultado de cada produto (jsonl)")
    args = ap.parse_args(argv)
    labels = json.loads(args.rotulos.read_text(encoding="utf-8"))
    rows = {}
    out = args.linhas.open("w", encoding="utf-8") if args.linhas else None
    for ident, want in sorted(labels.items()):
        if want.get("ambiguo"):
            continue
        got = run_product(args.catalogo, ident)
        if got is None or not got.get("ok"):
            continue
        rows[ident] = score(want, got)
        if args.imagens:
            _save(args.imagens, ident, got)
        if out:
            slim = [{k: v for k, v in d.items() if k != "imagem"} for d in got.get("decalques", [])]
            out.write(json.dumps({"id": ident, **rows[ident], "lugares": slim,
                                  "faixas_manga": got.get("faixas_manga")}, ensure_ascii=False) + "\n")
    print(json.dumps(summary(rows), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
