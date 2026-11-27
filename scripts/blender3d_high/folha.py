"""Folha de contato de arquivos GLB prontos (os do MET Gala Heist, gerados pela Meshy): um quadro por arquivo.

    python -m scripts.blender3d_high.folha --pasta /tmp/folha arquivo1.glb arquivo2.glb

Arquivos com meshopt precisam ser descomprimidos antes (o importador do Blender não lê meshopt):
``gltfpack -i <comprimido> -o <aberto> -noq``. Cada quadro sai com o nome, os triângulos e a altura original.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

LADO = 320


def _palco_de_estudio(tamanho: float, centro_z: float) -> None:
    import bpy
    from mathutils import Vector

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 16
    cena.render.resolution_x = cena.render.resolution_y = LADO
    mundo = bpy.data.worlds.new("mundo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.82, 0.86, 1)
    cena.world = mundo
    sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN"))
    sol.data.energy = 3.0
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cena.collection.objects.link(sol)
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    camera.data.lens = 50
    d = tamanho * 2.6 + 0.4
    camera.location = Vector((d * 0.55, -d * 0.82, centro_z + d * 0.35))
    camera.rotation_euler = (Vector((0, 0, centro_z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    cena.collection.objects.link(camera)
    cena.camera = camera


def quadro(arquivo: Path, pasta: Path) -> tuple[Path, int, float]:
    """Importa, apoia no piso, renderiza; devolve a imagem, os triângulos e a altura do arquivo."""
    import bpy

    from scripts.blender3d import core

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(arquivo))
    core.assentar()
    minimo, maximo = core.caixa_envolvente()
    tri = core.triangulos()
    _palco_de_estudio(max(maximo - minimo), (maximo.z - minimo.z) / 2)
    destino = pasta / f"{arquivo.stem}.png"
    bpy.context.scene.render.filepath = str(destino)
    bpy.ops.render.render(write_still=True)
    return destino, tri, maximo.z - minimo.z


def montar(quadros: list[tuple[Path, str]], destino: Path, colunas: int = 6) -> None:
    """Junta os quadros numa grade com a legenda embaixo de cada um (Pillow)."""
    from PIL import Image, ImageDraw

    linhas = math.ceil(len(quadros) / colunas)
    folha = Image.new("RGB", (colunas * LADO, linhas * (LADO + 22)), "white")
    desenho = ImageDraw.Draw(folha)
    for i, (imagem, legenda) in enumerate(quadros):
        x, y = (i % colunas) * LADO, (i // colunas) * (LADO + 22)
        folha.paste(Image.open(imagem).convert("RGB"), (x, y))
        desenho.text((x + 6, y + LADO + 4), legenda, fill="black")
    folha.save(destino)


def main(argv: list[str] | None = None) -> int:
    opcoes = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    opcoes.add_argument("--pasta", type=Path, required=True)
    opcoes.add_argument("arquivos", nargs="+", type=Path)
    args = opcoes.parse_args(sys.argv[1:] if argv is None else argv)
    args.pasta.mkdir(parents=True, exist_ok=True)
    feitos = []
    for arquivo in args.arquivos:
        imagem, tri, altura = quadro(arquivo, args.pasta)
        feitos.append((imagem, f"{arquivo.stem}  {tri // 1000}k tri  {altura:.2f} m"))
        print(feitos[-1][1])
    montar(feitos, args.pasta / "folha.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
