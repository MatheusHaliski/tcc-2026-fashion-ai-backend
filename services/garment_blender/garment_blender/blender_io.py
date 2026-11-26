"""Camada Blender (bpy): malha → objeto com UV, vincos de costura e materiais de tecido → .glb; e a prévia renderizada.

Só este módulo importa ``bpy`` (Blender 4.2 como módulo Python, sem interface). Eixos: a malha vem no espaço do
provador (Y para cima, frente +Z); no Blender (Z para cima) ela entra como (x, −z, y) e o exportador glTF devolve
(x, y, z), então o .glb sai no mesmo espaço do provador, em metros.
"""
from __future__ import annotations

from pathlib import Path

import bpy  # noqa: I001 - o bpy registra bmesh e mathutils: vem antes deles
import bmesh
from mathutils import Vector

from .fabric import repeat, write_maps
from .finish import METAL, PLASTIC, TRIM, Finish, finish
from .geometry import Mesh
from .pattern import pattern_maps
from .previa import render_preview  # noqa: F401 - a prévia mora em previa.py; o cli a chama por aqui

SEAM_DEPTH = 0.0009   # profundidade do vinco da costura (m)
# Rótulo da parte em cada vértice (COLOR_0, canal R): o provador encaixa cada parte no osso certo sem adivinhar pela
# posição (lib/avatar3d/meshy/part-codes.ts). Tronco, capuz e detalhes do tronco = 0; vértice da cava = tronco.
PART_CODE = {"manga_d": 0.25, "manga_e": 0.5, "perna_d": 0.75, "perna_e": 1.0}


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _material(name: str, maps: dict[str, Path], fin: Finish, metal: float = 0.0, tint=(1.0, 1.0, 1.0)):
    """Principled BSDF com o acabamento ``fin`` (finish.py); ``tint``: cor linear do tecido, que tinge o sheen."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = fin.roughness
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = fin.specular
    if fin.sheen:   # Weight 1 e a força no Tint: o glTF (sheenColorFactor) e o Cycles veem o mesmo brilho
        bsdf.inputs["Sheen Weight"].default_value = 1.0
        bsdf.inputs["Sheen Tint"].default_value = (*(fin.sheen * c for c in tint), 1.0)
        bsdf.inputs["Sheen Roughness"].default_value = fin.sheen_roughness
    if fin.coat:
        bsdf.inputs["Coat Weight"].default_value = fin.coat
        bsdf.inputs["Coat Roughness"].default_value = fin.coat_roughness
    if fin.anisotropic:
        bsdf.inputs["Anisotropic"].default_value = fin.anisotropic
    if "cor" in maps:
        tex = nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(maps["cor"]))
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if "normal" in maps:
        tex = nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(maps["normal"]))
        tex.image.colorspace_settings.name = "Non-Color"
        nm = nodes.new("ShaderNodeNormalMap")
        links.new(tex.outputs["Color"], nm.inputs["Color"]); links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def solid_material(name: str, rgb: tuple[float, float, float], fin: Finish, metal: float = 0.0):
    mat = _material(name, {}, fin, metal)
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1.0)
    return mat


def _tiled(mat, kind: str):
    """O tecido cuja imagem cobre mais de uma repetição de 5 cm (o gomo do acolchoado): o UV encolhe junto."""
    if repeat(kind) > 1:
        mat["uv_scale"] = (1.0 / repeat(kind), 1.0 / repeat(kind))
    return mat


def fabric_materials(spec, tex_dir: Path) -> dict:
    """Materiais da peça: tecido, ribana, cadarço do zíper (sarja um tom abaixo) e dentes (metal)."""
    kind, color = spec.tecido.tipo, spec.tecido.cor
    fin, tint = finish(kind), _rgb(color)
    if spec.listras is not None or spec.estampa_corrida is not None:   # a padronagem é a cor do corpo
        maps, scale = pattern_maps(kind, spec, tex_dir)
        mats = {"corpo": _material("corpo", maps, fin, tint=tint)}
        mats["corpo"]["uv_scale"] = scale
    else:
        mats = {"corpo": _tiled(_material("corpo", write_maps(kind, color, tex_dir), fin, tint=tint), kind)}
    knit = kind.startswith("malha") or kind in ("moletom", "jersey")
    if knit or spec.ribana:   # malha: a ribana do próprio fio; tecido plano com punho de ribana (bomber): algodão
        rib_kind = kind if knit else "malha_algodao"
        mats["ribana"] = _material("ribana", write_maps(rib_kind, color, tex_dir, rib=spec.ribana), finish(rib_kind),
                                   tint=tint)
    else:   # gola de pé, gola careca do tecido plano: o próprio tecido, liso (sem a padronagem do corpo)
        mats["ribana"] = _tiled(_material("ribana", write_maps(kind, color, tex_dir), fin, tint=tint), kind)
    if spec.calca:   # cós: elástico em ribana no jogger/moletom, o próprio tecido nas outras
        mats["cos"] = mats["ribana"] if spec.fechamento == "cordao" else mats["corpo"]
    if spec.fechamento != "nenhum" or kind == "denim":   # o denim leva rebites de metal mesmo sem zíper
        darker = "#" + "".join(f"{int(int(color[i:i + 2], 16) * 0.8):02x}" for i in (1, 3, 5))
        mats["cadarco"] = _material("cadarco", write_maps("sarja", darker, tex_dir), TRIM)
        mats["dentes"] = _material("dentes", write_maps("dentes", spec.cor_ziper, tex_dir), METAL, metal=0.85)
    # linha: a da ficha; no denim, a dourada clássica do jeans; nas outras, um tom abaixo do tecido
    thread = spec.cor_linha or ("#c58a3b" if kind == "denim" else
                                "#" + "".join(f"{int(int(color[i:i + 2], 16) * 0.72):02x}" for i in (1, 3, 5)))
    mats["linha"] = solid_material("linha", _rgb(thread), Finish(0.6, specular=0.15))
    if spec.fechamento in ("botoes", "polo") or "vivo" in spec.bolsos:   # botão da vista ou do bolso embutido
        mats["botao"] = solid_material("botao", _rgb(spec.cor_botao), PLASTIC)
        mats["furo"] = solid_material("furo", tuple(c * 0.35 for c in _rgb(spec.cor_botao)), Finish(0.8))
    for k, decal in enumerate(spec.estampas):
        mats[f"estampa_{k}"] = decal_material(f"estampa_{k}", Path(decal.imagem))
    return mats


def decal_material(name: str, png: Path):
    """Desenho com recorte: a cor da imagem e o alfa arredondado (o exportador glTF vira ``alphaMode: MASK``)."""
    mat = _material(name, {"cor": png}, Finish(0.65, specular=0.15))
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = next(n for n in nodes if n.type == "TEX_IMAGE")
    cut = nodes.new("ShaderNodeMath"); cut.operation = "ROUND"
    links.new(tex.outputs["Alpha"], cut.inputs[0])
    links.new(cut.outputs[0], nodes["Principled BSDF"].inputs["Alpha"])
    if hasattr(mat, "blend_method"):
        mat.blend_method = "CLIP"
    return mat


def _rgb(hex_color: str) -> tuple[float, float, float]:
    """#rrggbb → cor linear do Blender (o Base Color é linear; a ficha está em sRGB)."""
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def to_object(mesh: Mesh, name: str, materials: dict) -> bpy.types.Object:
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in mesh.verts], [], mesh.faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    order = list(materials)
    for key in order:
        data.materials.append(materials[key])
    uv = data.uv_layers.new(name="UVMap")
    scales = {k: tuple(m["uv_scale"]) if "uv_scale" in m else (1.0, 1.0) for k, m in materials.items()}
    for poly, corners, mat in zip(data.polygons, mesh.uvs, mesh.mats):
        poly.material_index = order.index(mat)
        poly.use_smooth = True
        su, sv = scales[mat]   # a padronagem cobre mais de uma repetição do tecido (pattern.py)
        for loop_index, (u, v) in zip(poly.loop_indices, corners):
            uv.data[loop_index].uv = (u * su, v * sv)
    code = [0.0] * len(mesh.verts)
    torso = set()
    for face, part in zip(mesh.faces, mesh.parts):
        part = part.split("@")[-1]   # "detalhe@perna_d": o bolso da perna anda com a perna
        if part in PART_CODE:
            for v in face:
                code[v] = max(code[v], PART_CODE[part])
        else:
            torso.update(face)
    colors = data.color_attributes.new(name="parte", type="FLOAT_COLOR", domain="POINT")
    for v, item in enumerate(colors.data):
        item.color = (0.0 if v in torso else code[v], 1.0, 1.0, 1.0)
    data.color_attributes.active_color = colors
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for island in _islands(bm):   # cada pedaço (tronco, bolso, zíper) com a normal para fora do eixo do corpo
        outward = sum(f.normal.dot(_radial(f.calc_center_median())) * f.calc_area() for f in island)
        if outward < 0:
            bmesh.ops.reverse_faces(bm, faces=island)
    bm.normal_update()
    for v in bm.verts:   # vinco: o vértice da costura afunda um pouco para dentro da peça
        if v.index in mesh.seams:
            v.co -= v.normal * SEAM_DEPTH
    bm.to_mesh(data); bm.free()
    return obj


def _radial(p: Vector) -> Vector:
    """Para fora do eixo vertical do corpo (no Blender, Z é para cima): a direção "para fora" de uma roupa."""
    r = Vector((p.x, p.y, 0.0))
    return r.normalized() if r.length > 1e-6 else Vector((0, 0, 1))


def _islands(bm) -> list[list]:
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, island = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop(); island.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index); stack.append(h)
        out.append(island)
    return out


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
                              export_image_format="AUTO", export_jpeg_quality=88, export_materials="EXPORT",
                              export_vertex_color="ACTIVE")
