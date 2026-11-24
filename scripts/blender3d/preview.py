"""Folha de contato dos objetos gerados: renderiza cada receita (Cycles na CPU, sem placa de vídeo) para conferência.

    python -m scripts.blender3d.preview --pasta /tmp/previas            # todos
    python -m scripts.blender3d.preview --pasta /tmp/previas --so poste

Gera ``<slug>.png`` por objeto e ``folha.png`` com todos lado a lado. É a conferência visual antes de publicar: forma,
proporção, materiais e a frente do objeto (a câmera olha a frente, levemente de lado).
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

LADO = 360


def _palco(tamanho: float, centro_z: float) -> None:
    import bpy
    from mathutils import Vector

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 24
    cena.cycles.use_denoising = False
    cena.render.resolution_x = cena.render.resolution_y = LADO
    cena.render.film_transparent = False
    mundo = bpy.data.worlds.new("mundo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.88, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    cena.world = mundo
    bpy.ops.mesh.primitive_plane_add(size=40)
    piso = bpy.context.object
    material = bpy.data.materials.new("piso")
    material.diffuse_color = (0.75, 0.75, 0.75, 1)
    piso.data.materials.append(material)
    sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN"))
    sol.data.energy = 3.2
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cena.collection.objects.link(sol)
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    camera.data.lens = 60
    distancia = tamanho * 3.1 + 0.6
    # a frente do objeto é -Y: a câmera fica na frente, um pouco à direita e acima
    camera.location = Vector((distancia * 0.55, -distancia * 0.82, centro_z + distancia * 0.32))
    alvo = Vector((0, 0, centro_z))
    camera.rotation_euler = (alvo - camera.location).to_track_quat("-Z", "Y").to_euler()
    cena.collection.objects.link(camera)
    cena.camera = camera


def renderizar(slug: str, pasta: Path) -> Path:
    import bpy

    from . import core
    from .receitas import carregar

    core.nova_cena()
    carregar()[slug].modelar()
    core.assentar()
    minimo, maximo = core.caixa_envolvente()
    _palco(max(maximo.x - minimo.x, maximo.y - minimo.y, maximo.z - minimo.z), (maximo.z - minimo.z) / 2)
    destino = pasta / f"{slug}.png"
    bpy.context.scene.render.filepath = str(destino)
    bpy.ops.render.render(write_still=True)
    return destino


def folha(imagens: list[Path], destino: Path, colunas: int = 5) -> None:
    """Junta as prévias numa grade (numpy vem com o Blender)."""
    import bpy
    import numpy as np

    linhas = math.ceil(len(imagens) / colunas)
    grade = np.ones((linhas * LADO, colunas * LADO, 4), dtype=np.float32)
    for i, caminho in enumerate(imagens):
        imagem = bpy.data.images.load(str(caminho))
        pixels = np.array(imagem.pixels[:], dtype=np.float32).reshape(LADO, LADO, 4)
        linha, coluna = linhas - 1 - i // colunas, i % colunas
        grade[linha * LADO:(linha + 1) * LADO, coluna * LADO:(coluna + 1) * LADO] = pixels
    saida = bpy.data.images.new("folha", colunas * LADO, linhas * LADO)
    saida.pixels = grade.ravel()
    saida.filepath_raw = str(destino)
    saida.file_format = "PNG"
    saida.save()


def main(argv: list[str] | None = None) -> int:
    from .receitas import carregar

    opcoes = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    opcoes.add_argument("--pasta", type=Path, required=True, help="pasta das prévias (fora do repositório)")
    opcoes.add_argument("--so", nargs="*", metavar="SLUG")
    args = opcoes.parse_args(sys.argv[1:] if argv is None else argv)
    args.pasta.mkdir(parents=True, exist_ok=True)
    slugs = args.so or list(carregar())
    imagens = [renderizar(slug, args.pasta) for slug in slugs]
    folha(imagens, args.pasta / "folha.png")
    print(f"{len(imagens)} prévias em {args.pasta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
