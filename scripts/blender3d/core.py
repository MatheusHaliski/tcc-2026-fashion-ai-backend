"""Núcleo de modelagem do motor Blender do FashionAI (sem API externa: tudo é gerado por código, no Blender).

Convenções de todo objeto gerado:
- unidades em metros; origem no piso (z = 0), centrado em x/y;
- a FRENTE do objeto aponta para -Y no Blender, que vira +Z no glTF (a mesma frente dos móveis das salas);
- materiais Principled BSDF (cor, metal, aspereza, emissão), que o exportador grava como PBR do glTF;
- material com ``papel`` sai nomeado ``sala:<papel>``: no jogo ele é pintado com o material da sala que o móvel
  procedural usava (lib/flair/nucleos/scene/assets.ts), então um arquivo serve a todas as salas;
- toda face ganha mapeamento de textura em metros (projeção em caixa), para as texturas do motor e as da sala.

As formas são criadas com bmesh (sem depender de contexto de janela), então rodam no Blender em modo ``--background``
e no módulo ``bpy`` instalado por pip.
"""
from __future__ import annotations

import math

import bpy  # antes do bmesh: no módulo do pip o bmesh só existe depois de carregar o bpy
import bmesh  # noqa: I001
from mathutils import Euler, Matrix, Vector

V3 = tuple[float, float, float]
_materiais: dict[str, bpy.types.Material] = {}


def nova_cena() -> None:
    """Zera o arquivo: nenhum objeto, malha ou material de uma receita vaza para a seguinte."""
    from . import texturas

    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materiais.clear()
    texturas.limpar()


def material(nome: str, cor: str, metal: float = 0.0, aspereza: float = 0.6, emissao: float = 0.0,
             papel: str | None = None, textura: str | None = None) -> bpy.types.Material:
    """Material PBR pelo nome (reaproveitado na receita). ``cor`` em hexadecimal sRGB; ``emissao`` em intensidade.

    ``papel``: papel de cor do móvel (``estofado``, ``metal``...): o material sai como ``sala:<papel>`` e, no jogo,
    recebe o material da sala; a cor daqui vale na prévia e fora das salas. ``textura``: desenho gerado pelo motor
    (``madeira``, ``tecido``, ``escovado``, ``borracha``), já tingido com a cor.
    """
    nome = f"sala:{papel}" if papel else nome
    if nome in _materiais:
        return _materiais[nome]
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r, g, b = (int(cor.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4))
    linear = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b))
    bsdf.inputs["Base Color"].default_value = (*linear, 1.0)
    if textura:
        from . import texturas

        no = mat.node_tree.nodes.new("ShaderNodeTexImage")
        no.image = texturas.imagem(textura, (r, g, b))
        mat.node_tree.links.new(no.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = aspereza
    if emissao > 0:
        bsdf.inputs["Emission Color"].default_value = (*linear, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissao
    _materiais[nome] = mat
    return mat


def _mapear(bm: bmesh.types.BMesh) -> None:
    """Mapeamento de textura em metros, por projeção em caixa: cada face usa os dois eixos em que é mais larga."""
    from .texturas import REPETE_A_CADA

    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal
        eixo = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != eixo]
        for laco in face.loops:
            laco[uv].uv = (laco.vert.co[a] / REPETE_A_CADA, laco.vert.co[b] / REPETE_A_CADA)


def _objeto(bm: bmesh.types.BMesh, nome: str, mat: bpy.types.Material, pos: V3, giro: V3, liso: bool) -> bpy.types.Object:
    bm.normal_update()
    _mapear(bm)
    malha = bpy.data.meshes.new(nome)
    bm.to_mesh(malha)
    bm.free()
    malha.materials.append(mat)
    if liso:
        for face in malha.polygons:
            face.use_smooth = True
        malha.set_sharp_from_angle(angle=math.radians(40))
    obj = bpy.data.objects.new(nome, malha)
    obj.location = pos
    obj.rotation_euler = Euler([math.radians(a) for a in giro], "XYZ")
    bpy.context.scene.collection.objects.link(obj)
    return obj


def caixa(nome: str, mat, tam: V3, pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0), chanfro: float = 0.0, seg: int = 2):
    """Caixa centrada em ``pos`` com as quinas chanfradas (o chanfro é o que tira a cara de bloco)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    if chanfro > 0:
        limite = min(tam) * 0.45
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(chanfro, limite), segments=seg, affect="EDGES", profile=0.5)
    return _objeto(bm, nome, mat, pos, giro, liso=chanfro > 0)


def cilindro(nome: str, mat, raio: float, altura: float, pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0),
             lados: int = 16, raio_topo: float | None = None, chanfro: float = 0.0):
    """Cilindro (ou tronco de cone, com ``raio_topo``) em pé no eixo Z, centrado em ``pos``."""
    bm = bmesh.new()
    topo = raio if raio_topo is None else raio_topo
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=raio, radius2=topo, depth=altura)
    if chanfro > 0:
        bordas = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=bordas, offset=min(chanfro, altura * 0.3, raio * 0.4), segments=2, affect="EDGES", profile=0.5)
    return _objeto(bm, nome, mat, pos, giro, liso=True)


def esfera(nome: str, mat, raio: float, pos: V3 = (0, 0, 0), escala: V3 = (1, 1, 1), lados: int = 16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=lados, v_segments=max(4, lados // 2), radius=raio)
    bmesh.ops.scale(bm, vec=escala, verts=bm.verts)
    return _objeto(bm, nome, mat, pos, (0, 0, 0), liso=True)


def toro(nome: str, mat, raio: float, tubo: float, pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0),
         lados: int = 20, lados_tubo: int = 8, achatado: float = 1.0):
    """Anel deitado no plano XY (pneu, aro, argola). ``achatado`` < 1 achata a seção do tubo na direção radial."""
    bm = bmesh.new()
    aneis = []
    for i in range(lados):
        a = 2 * math.pi * i / lados
        anel = []
        for j in range(lados_tubo):
            b = 2 * math.pi * j / lados_tubo
            r = raio + tubo * achatado * math.cos(b)
            anel.append(bm.verts.new((r * math.cos(a), r * math.sin(a), tubo * math.sin(b))))
        aneis.append(anel)
    for i in range(lados):
        for j in range(lados_tubo):
            bm.faces.new((aneis[i][j], aneis[(i + 1) % lados][j], aneis[(i + 1) % lados][(j + 1) % lados_tubo], aneis[i][(j + 1) % lados_tubo]))
    return _objeto(bm, nome, mat, pos, giro, liso=True)


def torneado(nome: str, mat, perfil: list[tuple[float, float]], pos: V3 = (0, 0, 0), lados: int = 20, giro: V3 = (0, 0, 0)):
    """Sólido de revolução: ``perfil`` é a lista de (raio, altura) de baixo para cima (vaso, cúpula, base torneada)."""
    bm = bmesh.new()
    aneis = []
    for raio, z in perfil:
        aneis.append([bm.verts.new((raio * math.cos(2 * math.pi * i / lados), raio * math.sin(2 * math.pi * i / lados), z))
                      for i in range(lados)] if raio > 1e-6 else [bm.verts.new((0, 0, z))])
    for baixo, cima in zip(aneis, aneis[1:]):
        for i in range(lados):
            a, b = baixo[i % len(baixo)], baixo[(i + 1) % len(baixo)]
            c, d = cima[(i + 1) % len(cima)], cima[i % len(cima)]
            cantos = [v for k, v in enumerate((a, b, c, d)) if v not in (a, b, c, d)[:k]]
            if len(cantos) >= 3:
                bm.faces.new(cantos)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _objeto(bm, nome, mat, pos, giro, liso=True)


def barra(nome: str, mat, de: V3, ate: V3, raio: float, lados: int = 8):
    """Haste redonda entre dois pontos (perna inclinada, travessa, cabo esticado)."""
    a, b = Vector(de), Vector(ate)
    eixo = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=raio, radius2=raio, depth=eixo.length)
    obj = _objeto(bm, nome, mat, tuple((a + b) / 2), (0, 0, 0), liso=True)
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(eixo.normalized()).to_euler()
    return obj


def duplicar(obj: bpy.types.Object, pos: V3, giro: V3 | None = None) -> bpy.types.Object:
    """Cópia que divide a mesma malha (perna de cadeira, ripa, lâmpada): o arquivo não cresce por repetição."""
    copia = obj.copy()
    copia.location = pos
    if giro is not None:
        copia.rotation_euler = Euler([math.radians(a) for a in giro], "XYZ")
    bpy.context.scene.collection.objects.link(copia)
    return copia


def espelhar_x(obj: bpy.types.Object) -> bpy.types.Object:
    """Cópia espelhada no plano YZ (o lado esquerdo de uma peça simétrica)."""
    copia = obj.copy()
    copia.data = obj.data.copy()
    copia.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    copia.data.flip_normals()
    copia.location = (-obj.location.x, obj.location.y, obj.location.z)
    rx, ry, rz = obj.rotation_euler
    copia.rotation_euler = Euler((rx, -ry, -rz), "XYZ")
    bpy.context.scene.collection.objects.link(copia)
    return copia


def triangulos() -> int:
    """Triângulos da cena (cada face de n lados conta n - 2), como o orçamento das salas espera."""
    return sum(len(f.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for f in o.data.polygons)


def caixa_envolvente() -> tuple[Vector, Vector]:
    cantos = [o.matrix_world @ Vector(c) for o in bpy.context.scene.objects if o.type == "MESH" for c in o.bound_box]
    return (Vector((min(c.x for c in cantos), min(c.y for c in cantos), min(c.z for c in cantos))),
            Vector((max(c.x for c in cantos), max(c.y for c in cantos), max(c.z for c in cantos))))


def assentar() -> None:
    """Centra a peça em x/y e apoia o ponto mais baixo no piso: toda receita sai com a origem no lugar certo."""
    bpy.context.view_layer.update()
    minimo, maximo = caixa_envolvente()
    desvio = Vector((-(minimo.x + maximo.x) / 2, -(minimo.y + maximo.y) / 2, -minimo.z))
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.location += desvio
    bpy.context.view_layer.update()
