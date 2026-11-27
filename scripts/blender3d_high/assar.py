"""Mapas assados no Cycles (CPU): a oclusão de ambiente da casca da sala (o contato dos móveis com o piso e as paredes,
calculado com toda a geometria de alta densidade) e o relevo do alto no médio (mapa normal do objeto herói decimado).

Cada objeto assado ganha um segundo mapa de UV (``assado``) sem sobreposição, aberto pelo Smart UV Project.
"""
from __future__ import annotations

import bpy

from .materiais import com_oclusao

UV = "assado"


def _so(obj: bpy.types.Object, *outros: bpy.types.Object) -> None:
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in (*outros, obj):
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj


def abrir_uv(obj: bpy.types.Object, margem: float = 0.004) -> None:
    """Segundo mapa de UV, sem sobreposição (o primeiro, em metros, continua com a textura que se repete)."""
    if UV not in obj.data.uv_layers:
        obj.data.uv_layers.new(name=UV)
    obj.data.uv_layers.active = obj.data.uv_layers[UV]
    _so(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=margem)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.uv_layers.active = obj.data.uv_layers[0]


def _cycles(amostras: int) -> None:
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = amostras
    cena.render.bake.margin = 6


def _alvo(obj: bpy.types.Object, imagem: bpy.types.Image) -> list:
    """Põe um nó de imagem ativo em cada material do objeto (é nele que o Cycles grava); devolve os nós para limpar."""
    nos = []
    for slot in obj.material_slots:
        arvore = slot.material.node_tree
        no = arvore.nodes.new("ShaderNodeTexImage")
        no.image = imagem
        arvore.nodes.active = no
        nos.append((arvore, no))
    return nos


def assar_oclusao(obj: bpy.types.Object, lado: int = 1024, amostras: int = 48, distancia: float = 1.2) -> bpy.types.Image:
    """Oclusão do objeto vista com a sala toda (os outros objetos fazem sombra de contato nele)."""
    abrir_uv(obj)
    # cada objeto assado precisa de material próprio: o mapa é só dele
    for slot in obj.material_slots:
        slot.material = slot.material.copy()
    imagem = bpy.data.images.new(f"ao-{obj.name}", lado, lado, alpha=False)
    imagem.colorspace_settings.name = "Non-Color"
    _cycles(amostras)
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new("mundo")
    bpy.context.scene.world.light_settings.distance = distancia
    nos = _alvo(obj, imagem)
    obj.data.uv_layers.active = obj.data.uv_layers[UV]
    _so(obj)
    bpy.ops.object.bake(type="AO", use_clear=True, margin=6)
    obj.data.uv_layers.active = obj.data.uv_layers[0]
    for arvore, no in nos:
        arvore.nodes.remove(no)
    imagem.pack()
    for slot in obj.material_slots:
        slot.material = com_oclusao(slot.material, imagem, UV)
    return imagem


def assar_relevo(alto: bpy.types.Object, baixo: bpy.types.Object, lado: int = 512, amostras: int = 4) -> bpy.types.Image:
    """Mapa normal do ``alto`` (com modificadores) gravado no ``baixo`` (decimado): o médio guarda o relevo do alto."""
    abrir_uv(baixo)
    imagem = bpy.data.images.new(f"relevo-{baixo.name}", lado, lado, alpha=False)
    imagem.colorspace_settings.name = "Non-Color"
    _cycles(amostras)
    for slot in baixo.material_slots:
        slot.material = slot.material.copy()
    nos = _alvo(baixo, imagem)
    baixo.data.uv_layers.active = baixo.data.uv_layers[UV]
    _so(baixo, alto)
    bpy.ops.object.bake(type="NORMAL", use_selected_to_active=True, use_cage=False, cage_extrusion=0.02,
                        max_ray_distance=0.06, normal_space="TANGENT", use_clear=True, margin=4)
    baixo.data.uv_layers.active = baixo.data.uv_layers[0]
    for arvore, no in nos:
        arvore.nodes.remove(no)
    imagem.pack()
    for slot in baixo.material_slots:
        arvore = slot.material.node_tree
        bsdf = arvore.nodes["Principled BSDF"]
        mapa_uv = arvore.nodes.new("ShaderNodeUVMap")
        mapa_uv.uv_map = UV
        no = arvore.nodes.new("ShaderNodeTexImage")
        no.image = imagem
        arvore.links.new(mapa_uv.outputs["UV"], no.inputs["Vector"])
        mapa = arvore.nodes.new("ShaderNodeNormalMap")
        mapa.uv_map = UV
        arvore.links.new(no.outputs["Color"], mapa.inputs["Color"])
        arvore.links.new(mapa.outputs["Normal"], bsdf.inputs["Normal"])
    return imagem
