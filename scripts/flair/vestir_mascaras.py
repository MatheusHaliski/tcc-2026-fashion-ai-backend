"""Desafios de Montagem "vestir a cena": recortes da roupa nova de cada personagem.

Cada fonte (scripts/flair/vestir/fontes/*.webp) tem duas metades lado a lado: a cena ANTES (esquerda) e DEPOIS
(direita), com o mesmo fundo e só as roupas trocadas. Para cada personagem o script gera um recorte RGBA da metade
direita que cobre exatamente a região que mudou nele (a roupa antiga some e a nova aparece); o resto fica a metade
esquerda. A cena do desafio começa com `antes.webp`, sobrepõe `veste-N.webp` quando a carta certa entra na vaga N e
termina em `depois.webp` (a metade direita inteira) com as quatro vagas completas.

Como a máscara é feita (config.json manda nos números de cada cena):
  1. alinhamento: a metade direita começa em `deslocamento` (a linha divisória fica entre as duas);
  2. diferença: distância de cor entre as metades depois de um desfoque gaussiano (o mosaico de fundo foi redesenhado
     com pequenas variações de pastilha; o desfoque deixa só a mudança de região, isto é, a roupa);
  3. limiar + abertura morfológica (tira pontinhos) e, por personagem, fechamento + preenchimento de buracos;
  4. atribuição: cada pixel pertence ao personagem cuja `caixa` o contém; onde duas caixas se cruzam, ao centro mais
     próximo; a `cabeca` (elipse) nunca entra, porque rosto e cabelo não mudam;
  5. borda: dilatação de poucos px e suavização (feather) do alfa.

Uso (no venv com numpy, scipy e Pillow):
  python scripts/flair/vestir_mascaras.py            # grava public/flair/desafios/** e lib/flair/vestir/cenas.json
  python scripts/flair/vestir_mascaras.py --qa DIR   # também grava folhas de conferência (máscaras e etapas) em DIR
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "scripts" / "flair" / "vestir"
SAIDA = RAIZ / "public" / "flair" / "desafios"
MANIFESTO = RAIZ / "lib" / "flair" / "vestir" / "cenas.json"

DESFOQUE = 3.0      # sigma (px) antes da diferença
ABERTURA = 2        # raio (px) que limpa pontinhos isolados
FECHAMENTO = 9      # raio (px) que une a peça
AREA_MINIMA = 600   # componentes menores somem (px²)
CRESCER = 3         # dilatação final (px), cobre a costura do recorte
FEATHER = 2.0       # sigma (px) da borda do alfa
QUALIDADE = 80


def disco(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def metades(img: np.ndarray, deslocamento: int, largura: int) -> tuple[np.ndarray, np.ndarray]:
    antes = img[:, :largura]
    depois = img[:, deslocamento:deslocamento + largura]
    if depois.shape[1] < largura:
        depois = np.pad(depois, ((0, 0), (0, largura - depois.shape[1]), (0, 0)), mode="edge")
    return antes, depois


def diferenca(antes: np.ndarray, depois: np.ndarray) -> np.ndarray:
    a = ndi.gaussian_filter(antes.astype(np.float32), (DESFOQUE, DESFOQUE, 0))
    b = ndi.gaussian_filter(depois.astype(np.float32), (DESFOQUE, DESFOQUE, 0))
    return np.sqrt(((a - b) ** 2).sum(-1))


def elipse(shape: tuple[int, int], cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    y, x = np.ogrid[:shape[0], :shape[1]]
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def regioes(shape: tuple[int, int], pessoas: list[dict]) -> tuple[list[np.ndarray], np.ndarray]:
    """Região de cada personagem (caixa, sem cabeças, sobreposição pelo centro mais próximo) e a máscara das cabeças."""
    cabecas = np.zeros(shape, bool)
    for p in pessoas:
        cabecas |= elipse(shape, *p["cabeca"])
    xs = np.arange(shape[1])[None, :]
    caixas, distancias = [], []
    for p in pessoas:
        x0, x1, y0, y1 = p["caixa"]
        c = np.zeros(shape, bool)
        c[y0:y1, x0:x1] = True
        caixas.append(c)
        distancias.append(np.where(c, np.abs(xs - (x0 + x1) / 2), np.inf))
    dono = np.argmin(np.stack(distancias), axis=0)
    return [c & (dono == k) & ~cabecas for k, c in enumerate(caixas)], cabecas


def mascaras(antes: np.ndarray, depois: np.ndarray, d: dict) -> list[np.ndarray]:
    mudou = ndi.binary_opening(diferenca(antes, depois) > d["limiar"], structure=disco(ABERTURA))
    shape = mudou.shape
    regs, cabecas = regioes(shape, d["pessoas"])
    saida = []
    for k, reg in enumerate(regs):
        m = ndi.binary_closing(mudou & reg, structure=disco(FECHAMENTO), border_value=0) & reg
        m = ndi.binary_fill_holes(m)
        rotulos, n = ndi.label(m)
        if n:
            areas = ndi.sum(m, rotulos, range(1, n + 1))
            m = np.isin(rotulos, [i + 1 for i, a in enumerate(areas) if a >= AREA_MINIMA])
        x0, x1, y0, y1 = d["pessoas"][k]["caixa"]
        caixa = np.zeros(shape, bool)
        caixa[y0:y1, x0:x1] = True
        m = ndi.binary_dilation(m, structure=disco(CRESCER)) & caixa & ~cabecas
        saida.append(np.clip(ndi.gaussian_filter(m.astype(np.float32), FEATHER) * 1.15, 0, 1))
    return saida


def recorte(depois: np.ndarray, alfa: np.ndarray) -> tuple[Image.Image, list[int]]:
    ys, xs = np.nonzero(alfa > 0.01)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    rgba = np.dstack([depois[y0:y1, x0:x1], (alfa[y0:y1, x0:x1] * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA"), [x0, y0, x1 - x0, y1 - y0]


def compor(antes: np.ndarray, depois: np.ndarray, alfas: list[np.ndarray]) -> np.ndarray:
    out = antes.astype(np.float32)
    for a in alfas:
        out = out * (1 - a[..., None]) + depois.astype(np.float32) * a[..., None]
    return out.round().astype(np.uint8)


def folha_qa(pasta: Path, d: dict, antes: np.ndarray, depois: np.ndarray, alfas: list[np.ndarray]) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    cores = np.array([[255, 60, 60], [60, 220, 60], [60, 120, 255], [255, 220, 40]], np.float32)
    tinta = depois.astype(np.float32) * 0.55
    for k, a in enumerate(alfas):
        tinta = tinta * (1 - 0.45 * a[..., None]) + cores[k] * 0.45 * a[..., None]
    passos = [compor(antes, depois, alfas[:n]) for n in range(5)]
    linhas = [np.hstack([passos[0], passos[1], passos[2]]), np.hstack([passos[3], passos[4], tinta.astype(np.uint8)])]
    Image.fromarray(np.vstack(linhas)).save(pasta / f"{d['cenario']}-etapas.jpg", quality=85)


def gerar(qa: Path | None) -> dict:
    cfg = json.loads((PASTA / "config.json").read_text(encoding="utf-8"))
    largura, altura = cfg["largura"], cfg["altura"]
    manifesto: dict = {}
    for d in cfg["desafios"]:
        img = np.asarray(Image.open(PASTA / "fontes" / d["fonte"]).convert("RGB"))
        assert img.shape[0] == altura, d["fonte"]
        antes, depois = metades(img, d["deslocamento"], largura)
        alfas = mascaras(antes, depois, d)
        destino = SAIDA / d["cenario"]
        destino.mkdir(parents=True, exist_ok=True)
        Image.fromarray(antes).save(destino / "antes.webp", quality=QUALIDADE, method=6)
        Image.fromarray(depois).save(destino / "depois.webp", quality=QUALIDADE, method=6)
        pessoas = []
        for k, (p, a) in enumerate(zip(d["pessoas"], alfas), start=1):
            img_k, caixa = recorte(depois, a)
            img_k.save(destino / f"veste-{k}.webp", quality=QUALIDADE, alpha_quality=90, method=6)
            pessoas.append({"vaga": p["vaga"], "x": caixa[0], "y": caixa[1], "w": caixa[2], "h": caixa[3]})
        manifesto[d["cenario"]] = {"slug": d["slug"], "largura": largura, "altura": altura, "pessoas": pessoas}
        if qa:
            folha_qa(qa, d, antes, depois, alfas)
    MANIFESTO.parent.mkdir(parents=True, exist_ok=True)
    MANIFESTO.write_text(json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return manifesto


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--qa", type=Path, default=None, help="pasta para as folhas de conferência")
    args = ap.parse_args()
    manifesto = gerar(args.qa)
    total = sum(f.stat().st_size for f in SAIDA.rglob("*.webp"))
    print(f"{len(manifesto)} cenas; {total / 1024:.0f} KiB em {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
