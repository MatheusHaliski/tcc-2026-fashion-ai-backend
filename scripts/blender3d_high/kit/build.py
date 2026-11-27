"""Gera o kit de interiores da mansão em ``public/flair/3d/kit-mansao`` (perfil high do motor Blender).

    python -m scripts.blender3d_high.kit.build --materiais            # pisos, paredes e tetos assados
    python -m scripts.blender3d_high.kit.build --pecas                # móveis, lustres, portas e decoração
    python -m scripts.blender3d_high.kit.build --so piso-porcelanato

O manifesto (``manifest.json``) lista cada material (mapas WebP e amostra GLB) e cada peça (GLB alto e médio, medidas,
apoio no piso, na parede ou no teto, cômodos). ``lib/flair/3d/kit-mansao.ts`` lê esse manifesto no jogo.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import numpy as np

from ..build import RAIZ

PASTA = RAIZ / "public/flair/3d/kit-mansao"
URL = "/flair/3d/kit-mansao"


def _amostra_glb(m, destino: Path, mapas: dict[str, Path]) -> dict:
    """Uma repetição do material num plano (o material inteiro, com a oclusão), comprimida."""
    import bpy

    from .. import exportar
    from ..build import nova_cena
    from ..materiais import com_oclusao

    nova_cena()
    bpy.ops.mesh.primitive_plane_add(size=m.metros, calc_uvs=True)
    plano = bpy.context.object
    if m.tipo == "parede":
        plano.rotation_euler = (1.5708, 0, 0)                    # de pé, de frente para -y (+z do jogo)
    elif m.tipo == "teto":
        plano.rotation_euler = (3.14159, 0, 0)                   # virado para baixo
    mat = bpy.data.materials.new(m.slug)
    mat.use_nodes = True
    nos, ligar = mat.node_tree.nodes, mat.node_tree.links.new
    bsdf = nos["Principled BSDF"]
    for chave, entrada in (("cor", "Base Color"), ("aspereza", "Roughness"), ("normal", None)):
        no = nos.new("ShaderNodeTexImage")
        no.image = bpy.data.images.load(str(mapas[chave]))
        if chave != "cor":
            no.image.colorspace_settings.name = "Non-Color"
        if entrada:
            ligar(no.outputs["Color"], bsdf.inputs[entrada])
        else:
            normal = nos.new("ShaderNodeNormalMap")
            ligar(no.outputs["Color"], normal.inputs["Color"])
            ligar(normal.outputs["Normal"], bsdf.inputs["Normal"])
    ao = bpy.data.images.load(str(mapas["ao"]))
    ao.colorspace_settings.name = "Non-Color"
    plano.data.materials.append(com_oclusao(mat, ao, plano.data.uv_layers[0].name))
    with tempfile.TemporaryDirectory() as tmp:
        exportar.comprimir(exportar.exportar_bruto(Path(tmp) / "bruto.glb"), destino)
    return {"url": f"{URL}/materiais/{destino.name}", "bytes": destino.stat().st_size}


def gerar_material(m) -> dict:
    from .materiais import _salvar, assar

    pasta = PASTA / "materiais"
    pasta.mkdir(parents=True, exist_ok=True)
    mapas = assar(m)
    # desgaste: a sujeira assenta onde a oclusão é funda (juntas, quinas do relevo), e o brilho cai ali
    sombra = np.clip(mapas["ao"][..., :1], 0, 1)
    mapas["cor"] = mapas["cor"] * (0.72 + 0.28 * sombra)
    mapas["aspereza"] = np.clip(mapas["aspereza"] + 0.18 * (1 - sombra[..., 0]), 0, 1)
    arquivos, medios = {}, {}
    for chave, lado, q in (("cor", 1024, 86), ("normal", 1024, 92), ("aspereza", 512, 85), ("ao", 512, 85)):
        arquivos[chave] = pasta / f"{m.slug}-{chave}.webp"
        _salvar(mapas[chave], arquivos[chave], lado, q)
        if lado > 512:
            medios[chave] = pasta / f"{m.slug}-{chave}-512.webp"
            _salvar(mapas[chave], medios[chave], 512, q)
    amostra = _amostra_glb(m, pasta / f"{m.slug}.glb", {**arquivos, **medios})
    return {"slug": m.slug, "title": m.titulo, "kind": m.tipo, "repeatMeters": m.metros,
            "maps": {k: f"{URL}/materiais/{p.name}" for k, p in arquivos.items()},
            "mapsMedium": {**{k: f"{URL}/materiais/{p.name}" for k, p in arquivos.items() if k not in medios},
                           **{k: f"{URL}/materiais/{p.name}" for k, p in medios.items()}},
            "sample": amostra, "bytes": sum(p.stat().st_size for p in [*arquivos.values(), *medios.values()])}


def atualizar(secao: str, linhas: list[dict]) -> None:
    manifesto = PASTA / "manifest.json"
    atual = json.loads(manifesto.read_text(encoding="utf-8")) if manifesto.exists() else {"materials": [], "pieces": []}
    novas = {linha["slug"]: linha for linha in linhas}
    atual[secao] = [novas.pop(i["slug"], i) for i in atual.get(secao, [])] + list(novas.values())
    atual["generator"] = "scripts/blender3d_high/kit"
    manifesto.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    from .materiais import MATERIAIS

    opcoes = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    opcoes.add_argument("--materiais", action="store_true")
    opcoes.add_argument("--pecas", action="store_true")
    opcoes.add_argument("--so", nargs="*", default=None)
    args = opcoes.parse_args(sys.argv[1:] if argv is None else argv)
    PASTA.mkdir(parents=True, exist_ok=True)
    if args.materiais or (args.so and any(m.slug in args.so for m in MATERIAIS)):
        for m in MATERIAIS:
            if args.so and m.slug not in args.so:
                continue
            linha = gerar_material(m)
            atualizar("materials", [linha])
            print(f"{m.slug:28} {linha['bytes'] / 1024:6.0f} KB de mapas, amostra {linha['sample']['bytes'] / 1024:5.0f} KB")
    if args.pecas or (args.so and not args.materiais):
        from .pecas import gerar_pecas

        gerar_pecas(args.so, atualizar)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
