"""Peças do kit da mansão: registro, encaixe pelo apoio e exportação em dois níveis (alto e médio, meshopt).

Convenção de cada peça (como os objetos do motor): metros, frente para -y do Blender (+z do jogo), centrada em x.
- ``piso``: centrada em x/y, base em z = 0;
- ``parede``: as costas em y = 0 (encostam na parede), base em z = 0 (quem monta escolhe a altura);
- ``teto``: centrada em x/y, o topo em z = 0 (pendura para baixo).
"""
from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from mathutils import Vector

COMODOS = ("hall", "salao-baile", "biblioteca", "closet", "jantar", "escritorio", "jardim", "qualquer")


@dataclass(frozen=True)
class PecaDoKit:
    slug: str
    titulo: str
    apoio: str
    comodos: tuple[str, ...]
    modelar: Callable[[], None]
    #: "porta" (folha que abre: o nó "folha" sai separado), "luz" (lustre/arandela: o jogo acende uma luz nela)
    papel: str = ""


PECAS: dict[str, PecaDoKit] = {}


def peca(slug: str, titulo: str, apoio: str, comodos: tuple[str, ...], papel: str = ""):
    def registrar(modelar: Callable[[], None]) -> Callable[[], None]:
        assert apoio in ("piso", "parede", "teto") and all(c in COMODOS for c in comodos), slug
        PECAS[slug] = PecaDoKit(slug, titulo, apoio, comodos, modelar, papel)
        return modelar
    return registrar


def carregar() -> dict[str, PecaDoKit]:
    from . import pecas_decor, pecas_lustres, pecas_moveis, pecas_portas  # noqa: F401
    return PECAS


def _encaixar(apoio: str) -> tuple[float, float, float]:
    import bpy

    from scripts.blender3d.core import caixa_envolvente

    bpy.context.view_layer.update()
    minimo, maximo = caixa_envolvente()
    alvo = {"piso": Vector(((minimo.x + maximo.x) / 2, (minimo.y + maximo.y) / 2, minimo.z)),
            "parede": Vector(((minimo.x + maximo.x) / 2, maximo.y, minimo.z)),
            "teto": Vector(((minimo.x + maximo.x) / 2, (minimo.y + maximo.y) / 2, maximo.z))}[apoio]
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.location -= alvo
    tamanho = maximo - minimo
    return round(tamanho.x, 3), round(tamanho.z, 3), round(tamanho.y, 3)


def gerar(p: PecaDoKit, pasta: Path, url: str) -> dict:
    from .. import exportar, niveis
    from ..build import nova_cena

    nova_cena()
    p.modelar()
    tamanho = _encaixar(p.apoio)
    import bpy

    for o in bpy.context.scene.objects:                         # cada peça do kit é uma peça-herói (teto de 80 mil)
        o["heroi"] = True
    niveis.conferir_tetos()
    linha = {"slug": p.slug, "title": p.titulo, "support": p.apoio, "rooms": list(p.comodos), "role": p.papel,
             "size": list(tamanho), "levels": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for nivel in ("alto", "medio"):
            if nivel == "medio":
                niveis.para_o_medio(())
            arquivo = pasta / (f"{p.slug}.glb" if nivel == "alto" else f"{p.slug}-medio.glb")
            exportar.comprimir(exportar.exportar_bruto(Path(tmp) / f"{nivel}.glb"), arquivo, nos=p.papel == "porta")
            m = exportar.medidas(exportar.ler_glb(arquivo))
            linha["levels"][nivel] = {"url": f"{url}/{arquivo.name}", "triangles": m["triangulos"], "calls": m["chamadas"],
                                      "bytes": arquivo.stat().st_size}
    return linha


def gerar_pecas(so: list[str] | None, atualizar) -> None:
    from .build import PASTA, URL

    pasta = PASTA / "pecas"
    pasta.mkdir(parents=True, exist_ok=True)
    for slug, p in carregar().items():
        if so and slug not in so:
            continue
        linha = gerar(p, pasta, f"{URL}/pecas")
        atualizar("pieces", [linha])
        a, m = linha["levels"]["alto"], linha["levels"]["medio"]
        print(f"{slug:26} alto {a['triangles']:6} tri {a['calls']:3} ch {a['bytes'] / 1024:5.0f} KB | medio {m['triangles']:6} tri")
