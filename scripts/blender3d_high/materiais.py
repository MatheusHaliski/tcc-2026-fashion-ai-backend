"""Materiais PBR do perfil high: Principled BSDF com cor, relevo e aspereza gerados (pbr.py), laca com verniz
(clearcoat), veludo com brilho de fibra (sheen) e emissão. O exportador do glTF grava tudo como extensões que o three.js
lê: KHR_materials_clearcoat, KHR_materials_sheen, KHR_texture_transform (a escala da repetição) e a oclusão assada.
"""
from __future__ import annotations

import bpy

from . import pbr

_cache: dict[str, bpy.types.Material] = {}


def srgb(cor: str) -> tuple[float, float, float]:
    return tuple(int(cor.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def linear(cor: str) -> tuple[float, float, float, float]:
    return (*(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb(cor)), 1.0)  # type: ignore[return-value]


def material(nome: str, cor: str, textura: str | None = None, metal: float = 0.0, aspereza: float = 0.5,
             repete: float = 1.0, verniz: float = 0.0, fibra: float = 0.0, emissao: float = 0.0) -> bpy.types.Material:
    """Material pelo nome (reaproveitado na sala). ``repete``: quantas vezes o desenho cabe numa unidade de UV (o motor
    mapeia 0,5 m por unidade); ``verniz``: clearcoat (laca); ``fibra``: sheen (veludo, tecido); ``emissao``: força."""
    if nome in _cache:
        return _cache[nome]
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    nos, ligar = mat.node_tree.nodes, mat.node_tree.links.new
    bsdf = nos["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = linear(cor)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = aspereza
    if textura:
        imagens = pbr.conjunto(textura, srgb(cor), aspereza)
        uv = nos.new("ShaderNodeTexCoord")
        escala = nos.new("ShaderNodeMapping")
        escala.inputs["Scale"].default_value = (repete, repete, 1)
        ligar(uv.outputs["UV"], escala.inputs["Vector"])
        for chave, entrada in (("cor", "Base Color"), ("aspereza", "Roughness")):
            no = nos.new("ShaderNodeTexImage")
            no.image = imagens[chave]
            ligar(escala.outputs["Vector"], no.inputs["Vector"])
            ligar(no.outputs["Color"], bsdf.inputs[entrada])
        normal = nos.new("ShaderNodeTexImage")
        normal.image = imagens["normal"]
        ligar(escala.outputs["Vector"], normal.inputs["Vector"])
        mapa = nos.new("ShaderNodeNormalMap")
        ligar(normal.outputs["Color"], mapa.inputs["Color"])
        ligar(mapa.outputs["Normal"], bsdf.inputs["Normal"])
    if verniz:
        bsdf.inputs["Coat Weight"].default_value = verniz
        bsdf.inputs["Coat Roughness"].default_value = 0.04
    if fibra:
        bsdf.inputs["Sheen Weight"].default_value = fibra
        bsdf.inputs["Sheen Tint"].default_value = linear(cor)
        bsdf.inputs["Sheen Roughness"].default_value = 0.4
    if emissao:
        bsdf.inputs["Emission Color"].default_value = linear(cor)
        bsdf.inputs["Emission Strength"].default_value = emissao
    _cache[nome] = mat
    return mat


def _saida_gltf() -> bpy.types.NodeTree:
    """O grupo ``glTF Material Output``: é por ele que o exportador acha a oclusão assada."""
    grupo = bpy.data.node_groups.get("glTF Material Output")
    if grupo is None:
        grupo = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        grupo.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return grupo


def com_oclusao(mat: bpy.types.Material, imagem: bpy.types.Image, uv: str) -> bpy.types.Material:
    """Cópia do material com a oclusão assada (``imagem``, lida pelo mapa ``uv``): cada objeto assado tem a sua."""
    copia = mat.copy()
    copia.name = f"{mat.name}~ao-{imagem.name}"
    nos, ligar = copia.node_tree.nodes, copia.node_tree.links.new
    mapa = nos.new("ShaderNodeUVMap")
    mapa.uv_map = uv
    no = nos.new("ShaderNodeTexImage")
    no.image = imagem
    ligar(mapa.outputs["UV"], no.inputs["Vector"])
    separa = nos.new("ShaderNodeSeparateColor")
    ligar(no.outputs["Color"], separa.inputs["Color"])
    saida = nos.new("ShaderNodeGroup")
    saida.node_tree = _saida_gltf()
    ligar(separa.outputs["Red"], saida.inputs["Occlusion"])
    return copia


def limpar() -> None:
    _cache.clear()
    pbr.limpar()
