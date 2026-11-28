"""Provas e luz das salas high poly no Cycles (CPU): a foto da sala e o mapa de ambiente (panorama equirretangular
capturado no meio da sala), que o jogo usa como reflexo e luz de ambiente (``scene.environment`` no three.js).

As luzes da prova são criadas pela receita da sala (``luz_area``, ``luz_foco``); o exportador não as grava no GLB.
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

from .formas import jogo


def luz_area(nome: str, pos_jogo, alvo_jogo, energia: float, tamanho: float = 1.0, cor=(1, 0.95, 0.88)) -> None:
    luz = bpy.data.lights.new(nome, "AREA")
    luz.energy, luz.size, luz.color = energia, tamanho, cor
    _apontar(bpy.data.objects.new(nome, luz), pos_jogo, alvo_jogo)


def luz_foco(nome: str, pos_jogo, alvo_jogo, energia: float, abertura: float = 40, cor=(1, 0.95, 0.85)) -> None:
    luz = bpy.data.lights.new(nome, "SPOT")
    luz.energy, luz.spot_size, luz.spot_blend, luz.color = energia, math.radians(abertura), 0.6, cor
    luz.shadow_soft_size = 0.15
    _apontar(bpy.data.objects.new(nome, luz), pos_jogo, alvo_jogo)


def _apontar(obj, pos_jogo, alvo_jogo) -> None:
    obj.location = Vector(jogo(*pos_jogo))
    obj.rotation_euler = (Vector(jogo(*alvo_jogo)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(obj)


def _mundo(cor=(0.03, 0.028, 0.035), forca: float = 1.0) -> None:
    cena = bpy.context.scene
    if cena.world is None:
        cena.world = bpy.data.worlds.new("mundo")
    cena.world.use_nodes = True
    fundo = cena.world.node_tree.nodes["Background"]
    fundo.inputs["Color"].default_value = (*cor, 1)
    fundo.inputs["Strength"].default_value = forca


def _cycles(largura: int, altura: int, amostras: int) -> None:
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = amostras
    cena.cycles.use_denoising = True
    cena.cycles.max_bounces = 4
    cena.render.resolution_x, cena.render.resolution_y = largura, altura
    cena.render.resolution_percentage = 100
    cena.view_settings.view_transform = "AgX"
    cena.view_settings.look = "AgX - Medium High Contrast"


def _camera(pos_jogo, alvo_jogo, lente: float = 24) -> bpy.types.Object:
    cam = bpy.data.objects.new("prova", bpy.data.cameras.new("prova"))
    cam.data.lens = lente
    _apontar(cam, pos_jogo, alvo_jogo)
    bpy.context.scene.camera = cam
    return cam


def foto(destino: Path, pos_jogo, alvo_jogo, largura: int = 1280, altura: int = 720, amostras: int = 48) -> Path:
    _mundo()
    _cycles(largura, altura, amostras)
    cam = _camera(pos_jogo, alvo_jogo)
    bpy.context.scene.render.filepath = str(destino)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    return destino


def ambiente(destino_webp: Path, pos_jogo, largura: int = 1024, amostras: int = 24) -> Path:
    """Panorama equirretangular do ponto (WebP de 8 bits; o jogo o filtra com PMREM)."""
    from PIL import Image

    _mundo()
    _cycles(largura, largura // 2, amostras)
    cena = bpy.context.scene
    cena.view_settings.view_transform = "Standard"
    cena.view_settings.look = "None"
    cam = bpy.data.objects.new("panorama", bpy.data.cameras.new("panorama"))
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    cam.location = Vector(jogo(*pos_jogo))
    # o three.js lê o centro do panorama como +x do jogo (equirectUv): a câmera olha para +x, em pé
    cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    cena.collection.objects.link(cam)
    cena.camera = cam
    png = destino_webp.with_suffix(".png")
    cena.render.filepath = str(png)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    Image.open(png).convert("RGB").save(destino_webp, "WEBP", quality=80)
    png.unlink()
    return destino_webp
