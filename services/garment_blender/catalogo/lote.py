"""Etapa A do lote (venv do segmentador): para cada peça de cima do catálogo, baixa as fotos, lê nelas a pintura (cor,
listras, estampa corrida, desenhos e logos com o lugar de cada um) e grava a ficha do motor — a base da subcategoria
com os detalhes que o texto confirma — mais as imagens das estampas. A etapa B (``construir.py``, venv do Blender)
monta os .glb. Retomável: produto com ``ficha.json`` ou ``pulado.json`` na pasta não é refeito.

    cd services/garment_blender && ~/.venv-catalogo/bin/python -m catalogo.lote --saida ~/catalogo-3d --por-sub 5
"""
from __future__ import annotations

import argparse
import json
import random
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

from garment_blender.geometry import ellipse_semi_axes
from garment_blender.sizes import top_measures
from garment_blender.spec import parse

from . import forma, produtos, texto
from .analise import analyze
from .baixar import fetch
from .ficha import button_color, spec_for
from .nomes_cor import color_from_name

FULL_SIDE = 2400     # lado maior da foto guardada para recortar os desenhos (px)
TRIES = 2            # fotos olhadas por produto (a primeira costuma ser a da frente)


def _open(path: Path) -> Image.Image | None:
    try:
        img = Image.open(path)
        img.draft("RGB", (FULL_SIDE, FULL_SIDE))
        img = img.convert("RGB")
        img.thumbnail((FULL_SIDE, FULL_SIDE), Image.Resampling.LANCZOS)
        return img if min(img.size) >= 64 else None
    except Exception:   # noqa: BLE001 - foto corrompida ou em formato que o PIL não lê: tenta a próxima
        return None


class LazySegmenter:
    """O segmentador só carrega (8–9 s, 1 GB) na primeira foto sem rótulos guardados."""

    def __init__(self, threads: int):
        self.threads, self.model = threads, None

    def labels(self, img: Image.Image) -> np.ndarray:
        if self.model is None:
            from .segmentador import Segmentador
            self.model = Segmentador(self.threads)
        return self.model.labels(img)


def _labels(seg, img: Image.Image, path: Path) -> np.ndarray:
    """Rótulos do segmentador, guardados ao lado da foto baixada: refazer a análise (outra regra de estampa, de cor)
    não roda a rede de novo."""
    cached = path.with_name(path.name + ".rotulos.png")
    if cached.is_file():
        return np.asarray(Image.open(cached))
    labels = seg.labels(img)
    Image.fromarray(labels).save(cached, optimize=True)
    return labels


def _measures(spec: dict) -> tuple[float, float]:
    """(comprimento do ombro à barra, meia largura do tronco no peito), em metros, da base no M."""
    m = top_measures("M", spec["sexo"], spec["caimento"], spec.get("medidas_marca"))
    return m.comprimento / 100, ellipse_semi_axes(m.torax / 100, 0.68)[0]


def _stripes_from_text(spec: dict, name: str, result: dict) -> None:
    """Nome diz listrada e a foto não mostrou (listra fina, foto pequena): listra fina do tecido com branco, na
    vertical na camisa e na horizontal no resto."""
    if result["padrao"] != "liso" or not texto.STRIPED.search(name):
        return
    base = spec["tecido"]["cor"]
    light = "#" + "".join(f"{round(int(base[i:i + 2], 16) * 0.25 + 255 * 0.75):02x}" for i in (1, 3, 5))
    result.update(padrao="listras", listras={"direcao": "vertical" if spec["subcategoria"] in ("shirt", "blouse") else
                                             "horizontal", "fundo": base, "listra": light, "periodo": 0.012,
                                             "fracao": 0.35, "fonte": "nome"})


def _write_prints(spec: dict, result: dict, folder: Path) -> None:
    """Imagens da pintura na pasta do produto e os campos da ficha que apontam para elas."""
    if result["padrao"] == "listras":
        spec["listras"] = {k: result["listras"][k] for k in ("direcao", "fundo", "listra", "periodo", "fracao")}
    elif result["padrao"] == "corrida":
        Image.fromarray(result["corrida"]["imagem"]).save(folder / "corrida.jpg", quality=92)
        spec["estampa_corrida"] = {"imagem": "corrida.jpg", "lado": result["corrida"]["lado"]}
    for k, d in enumerate(result.get("decalques", [])):
        Image.fromarray(d["imagem"], "RGBA").save(folder / f"estampa-{k}.png", optimize=True)
        spec.setdefault("estampas", []).append({"imagem": f"estampa-{k}.png", "x": float(d["x"]),
                                                "abaixo_do_ombro": float(d["abaixo_do_ombro"]),
                                                "largura": float(d["largura"])})


def _validate(spec: dict, folder: Path) -> None:
    """A ficha tem de montar no motor: o recorte lido na foto que deixa a peça incoerente (cava maior que o
    comprimento…) é desfeito e volta a base."""
    try:
        parse(spec, base_dir=folder)
    except ValueError:
        spec.get("medidas_marca", {}).pop("comprimento", None)
        spec["origem"]["recorte"] = []
        parse(spec, base_dir=folder)


def process(p: dict, files: list[tuple[str, Path | None, str]], seg, prior: dict, folder: Path) -> dict:
    """Um produto: devolve a linha do relatório e grava a ficha (ou ``pulado.json``)."""
    reason = texto.skip_reason(p.get("product_name"))
    if reason:
        return {"situacao": "pulado", "motivo": reason}
    spec = spec_for(p, "#808080", prior)
    length, chest_a = _measures(spec)
    avoid = spec["fechamento"] in ("botoes", "ziper_inteiro", "aberto")
    best, best_url, photo = None, None, None
    for url, path, status in files:
        img = _open(path) if path else None
        if img is None:
            continue
        rgb = np.asarray(img)
        result = analyze(rgb, _labels(seg, img, path), length, chest_a, avoid)
        if result["ok"] and (best is None or result["nota_foto"] > best["nota_foto"]):
            best, best_url, photo = result, url, img
        if best is not None and best["nota_foto"] >= 0.6:
            break
    if best is None:
        color = color_from_name(p.get("color_name"), p.get("color"), p.get("product_name"))
        if color is None:
            why = "sem_foto" if not files else "sem_peca_na_foto" if any(f[1] for f in files) else "download"
            return {"situacao": "pulado", "motivo": why, "downloads": [f[2] for f in files]}
        spec["tecido"]["cor"] = color
        best = {"padrao": "liso", "fonte_cor": "nome"}
    else:
        spec["tecido"]["cor"] = best["cor"]
        if spec.get("cor_botao"):
            spec["cor_botao"] = button_color(best["cor"], bool(texto.GOLD.search(texto.plain(p.get("product_name")))),
                                             spec["tecido"]["tipo"])
        folder.mkdir(parents=True, exist_ok=True)
        _stripes_from_text(spec, texto.plain(p.get("product_name")), best)
        _write_prints(spec, best, folder)
        said = texto.first(texto.SLEEVES, texto.plain(p.get("product_name")), texto.plain(p.get("description")))
        best["recorte"] = forma.from_photo(spec, best, said is not None)
        thumb = photo.copy(); thumb.thumbnail((512, 512)); thumb.save(folder / "foto.jpg", quality=85)
    folder.mkdir(parents=True, exist_ok=True)
    summary = {k: v for k, v in best.items() if k not in ("decalques", "corrida", "listras")}
    spec["origem"] = {"sku": p.get("sku"), "imagem": best_url, **summary}
    _validate(spec, folder)
    (folder / "ficha.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"situacao": "ficha", "padrao": best["padrao"], "desenhos": len(spec.get("estampas", [])),
            "cor": spec["tecido"]["cor"], "gola": spec["gola"], "fechamento": spec["fechamento"],
            "manga": "sem" if spec["sem_manga"] else "curta" if spec["manga_curta"] else "longa"}


def choose(items: list[dict], per_sub: int | None, limit: int | None, seed: int) -> list[dict]:
    rng = random.Random(seed)
    items = sorted(items, key=lambda p: produtos.ident(p))
    rng.shuffle(items)
    if per_sub:   # amostra: os primeiros de cada subcategoria na ordem sorteada
        count: Counter = Counter()
        picked = []
        for p in items:
            if count[p["subcategory"]] < per_sub:
                count[p["subcategory"]] += 1
                picked.append(p)
        items = picked
    return items[:limit] if limit else items


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--saida", type=Path, required=True)
    ap.add_argument("--por-sub", type=int, help="amostra: quantos por subcategoria")
    ap.add_argument("--limite", type=int)
    ap.add_argument("--semente", type=int, default=7)
    ap.add_argument("--threads", type=int, default=3, help="núcleos do segmentador")
    ap.add_argument("--parte", default="0/1", help="i/n: só a parte i de n (vários processos em paralelo)")
    args = ap.parse_args(argv)
    everything = produtos.read_all()
    prior = produtos.brand_prior(everything)
    part, parts = (int(v) for v in args.parte.split("/"))
    todo = [p for p in choose(produtos.tops(everything), args.por_sub, args.limite, args.semente)
            if produtos.shard(produtos.ident(p), parts) == part
            and not any((args.saida / produtos.ident(p) / f).exists() for f in ("ficha.json", "pulado.json"))]
    print(json.dumps({"produtos": len(todo)}), flush=True)
    args.saida.mkdir(parents=True, exist_ok=True)
    seg, cache = LazySegmenter(args.threads), args.saida / "_cache"
    report = (args.saida / f"relatorio-{part}.jsonl").open("a", encoding="utf-8")

    def download(p):
        return [(u, *fetch(u, cache)) for u in produtos.image_urls(p, TRIES)]

    with ThreadPoolExecutor(8) as pool:
        futures = [pool.submit(download, p) for p in todo]
        for p, fut in zip(todo, futures):
            t0, folder = time.time(), args.saida / produtos.ident(p)
            try:
                row = process(p, fut.result(), seg, prior, folder)
            except Exception as e:   # noqa: BLE001 - um produto com problema não para o lote
                row = {"situacao": "erro", "motivo": f"{type(e).__name__}: {e}"[:300]}
            if row["situacao"] != "ficha":
                folder.mkdir(parents=True, exist_ok=True)
                (folder / "pulado.json").write_text(json.dumps(row, ensure_ascii=False), encoding="utf-8")
            row |= {"id": folder.name, "sub": p["subcategory"], "marca": p.get("brand"),
                    "nome": (p.get("product_name") or "")[:80], "s": round(time.time() - t0, 1)}
            report.write(json.dumps(row, ensure_ascii=False) + "\n"); report.flush()
    (args.saida / f"fim-analise-{part}").write_text(time.strftime("%Y-%m-%d %H:%M:%S"))
    if all((args.saida / f"fim-analise-{i}").exists() for i in range(parts)):
        (args.saida / "fim-analise").write_text(time.strftime("%Y-%m-%d %H:%M:%S"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
