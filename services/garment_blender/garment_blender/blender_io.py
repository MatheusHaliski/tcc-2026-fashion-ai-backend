"""Camada Blender (bpy): malha → objeto com UV, vincos de costura e materiais de tecido → .glb; e a prévia renderizada.

Só este módulo importa ``bpy`` (Blender 4.2 como módulo Python, sem interface). Eixos: a malha vem no espaço do
provador (Y para cima, frente +Z); no Blender (Z para cima) ela entra como (x, −z, y) e o exportador glTF devolve
(x, y, z), então o .glb sai no mesmo espaço do provador, em metros.
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy  # noqa: I001 - o bpy registra bmesh e mathutils: vem antes deles
import bmesh
from mathutils import Vector

from .fabric import write_maps
from .geometry import Mesh

SEAM_DEPTH = 0.0009   # profundidade do vinco da costura (m)
# Rótulo da parte em cada vértice (COLOR_0, canal R): o provador encaixa cada parte no osso certo sem adivinhar pela
# posição (lib/avatar3d/meshy/part-codes.ts). Tronco, capuz e detalhes do tronco = 0; vértice da cava = tronco.
PART_CODE = {"manga_d": 0.25, "manga_e": 0.5, "perna_d": 0.75, "perna_e": 1.0}


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _material(name: str, maps: dict[str, Path], roughness: float, metal: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    if "cor" in maps:
        tex = nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(maps["cor"]))
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if "normal" in maps:
        tex = nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(maps["normal"]))
        tex.image.colorspace_settings.name = "Non-Color"
        nm = nodes.new("ShaderNodeNormalMap")
        links.new(tex.outputs["Color"], nm.inputs["Color"]); links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def solid_material(name: str, rgb: tuple[float, float, float], roughness: float, metal: float = 0.0):
    mat = _material(name, {}, roughness, metal)
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1.0)
    return mat


def fabric_materials(spec, tex_dir: Path) -> dict:
    """Materiais da peça: tecido, ribana, cadarço do zíper (sarja um tom abaixo) e dentes (metal)."""
    kind, color = spec.tecido.tipo, spec.tecido.cor
    rough = {"denim": 0.82, "sarja": 0.75}.get(kind, 0.9)
    mats = {"corpo": _material("corpo", write_maps(kind, color, tex_dir), rough)}
    rib_kind = kind if kind.startswith("malha") or kind in ("moletom", "jersey") else "malha_algodao"
    mats["ribana"] = _material("ribana", write_maps(rib_kind, color, tex_dir, rib=spec.ribana), rough)
    if spec.calca:   # cós: elástico em ribana no jogger/moletom, o próprio tecido nas outras
        mats["cos"] = mats["ribana"] if spec.fechamento == "cordao" else mats["corpo"]
    if spec.fechamento != "nenhum":
        darker = "#" + "".join(f"{int(int(color[i:i + 2], 16) * 0.8):02x}" for i in (1, 3, 5))
        mats["cadarco"] = _material("cadarco", write_maps("sarja", darker, tex_dir), 0.7)
        mats["dentes"] = _material("dentes", write_maps("dentes", spec.cor_ziper, tex_dir), 0.35, metal=0.85)
    return mats


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
    for poly, corners, mat in zip(data.polygons, mesh.uvs, mesh.mats):
        poly.material_index = order.index(mat)
        poly.use_smooth = True
        for loop_index, (u, v) in zip(poly.loop_indices, corners):
            uv.data[loop_index].uv = (u, v)
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
                              export_image_format="JPEG", export_jpeg_quality=88, export_materials="EXPORT",
                              export_vertex_color="ACTIVE")


def render_preview(path: Path, views=((0, "frente"), (35, "tres-quartos"))) -> list[Path]:
    """Prévia em Cycles (CPU): manequim nenhum, fundo neutro, luz de estúdio. Uma imagem por ângulo."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 48
    scene.render.resolution_x, scene.render.resolution_y = 900, 640
    scene.view_settings.view_transform = "Standard"   # sem o AgX: a cor do tecido sai como a da ficha
    world = bpy.data.worlds.new("estudio"); scene.world = world
    world.use_nodes = True; world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.93, 0.92, 0.9, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    for loc, energy in (((2, -3, 3), 260), ((-3, -2, 2), 120), ((0, 3, 2.5), 120)):
        light = bpy.data.objects.new("luz", bpy.data.lights.new("luz", "AREA"))
        light.data.energy, light.data.size = energy, 2.5
        light.location = loc; light.rotation_euler = (Vector((0, 0, 0.4)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid = (lo + hi) / 2
    cam.data.type = "ORTHO"; cam.data.ortho_scale = max(hi.x - lo.x, (hi.z - lo.z) * 900 / 640) * 1.15
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
