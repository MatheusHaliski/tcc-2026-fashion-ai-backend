"""Prévia em Cycles (CPU): estúdio de três luzes de área, fundo claro e câmera ortográfica de frente e de ¾.

A luz é calibrada (``calibracao.py`` e o teste ``test_calibracao_previa``): amostras lisas de #0d0d0d a #f2f2f2 saem
no tronco da frente a até 4 de L da cor da ficha e com pelo menos 85 % do croma. O ambiente (o "mundo") quase não
ilumina — o reflexo neutro dele clareava e acinzentava os escuros —, mas a câmera continua vendo o fundo claro de
sempre (o raio de câmera vê o ``BACKDROP``; o resto da cena vê o mundo fraco).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


@dataclass(frozen=True)
class Studio:
    world: float = 0.06                                     # força do mundo que ilumina (cor ``BACKDROP``)
    lights: tuple = (((2, -3, 3), 260), ((-3, -2, 2), 120), ((0, 3, 2.5), 120))   # (posição, W) das luzes de área
    exposure: float = 0.09                                  # exposição da câmera (stops)
    size: float = 2.5                                       # lado das luzes de área (m)


STUDIO = Studio()
BACKDROP = (0.93, 0.92, 0.9)
BACKDROP_STRENGTH = 0.35   # o fundo que a câmera vê (o cinza-claro das prévias)


def _world(scene, studio: Studio) -> None:
    """Mundo fraco para a luz e o fundo claro para a câmera (Light Path: Is Camera Ray)."""
    world = bpy.data.worlds.new("estudio"); scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    lit = nodes["Background"]
    lit.inputs["Color"].default_value = (*BACKDROP, 1); lit.inputs["Strength"].default_value = studio.world
    seen = nodes.new("ShaderNodeBackground")
    seen.inputs["Color"].default_value = (*BACKDROP, 1); seen.inputs["Strength"].default_value = BACKDROP_STRENGTH
    path, mix = nodes.new("ShaderNodeLightPath"), nodes.new("ShaderNodeMixShader")
    links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(lit.outputs["Background"], mix.inputs[1]); links.new(seen.outputs["Background"], mix.inputs[2])
    links.new(mix.outputs["Shader"], nodes["World Output"].inputs["Surface"])


def _lights(scene, studio: Studio) -> None:
    for loc, energy in studio.lights:
        light = bpy.data.objects.new("luz", bpy.data.lights.new("luz", "AREA"))
        light.data.energy, light.data.size = energy, studio.size
        light.location = loc
        light.rotation_euler = (Vector((0, 0, 0.4)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)


def render_preview(path: Path, views=((0, "frente"), (35, "tres-quartos")), resolution=(900, 640), samples: int = 48,
                   studio: Studio = STUDIO) -> list[Path]:
    """Uma imagem por ângulo, ``<path.stem>-<rótulo>.png``. Sem manequim; a cor do tecido sai como a da ficha."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.view_settings.view_transform = "Standard"   # sem o AgX: a cor do tecido sai como a da ficha
    scene.view_settings.exposure = studio.exposure
    _world(scene, studio)
    _lights(scene, studio)
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid = (lo + hi) / 2
    aspect = resolution[0] / resolution[1]
    cam.data.type = "ORTHO"; cam.data.ortho_scale = max(hi.x - lo.x, (hi.z - lo.z) * aspect) * 1.15
    scene.collection.objects.link(cam); scene.camera = cam
    out = []
    for yaw, label in views:
        a = math.radians(yaw)
        cam.location = (mid.x + 4 * math.sin(a), mid.y - 4 * math.cos(a), mid.z)
        cam.rotation_euler = (math.radians(90), 0, a)
        scene.render.filepath = str(path.with_name(f"{path.stem}-{label}.png"))
        bpy.ops.render.render(write_still=True)
        out.append(Path(scene.render.filepath))
    return out
