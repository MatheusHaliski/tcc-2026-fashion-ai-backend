"""Formas de alta densidade do perfil high, sobre o núcleo do motor (scripts/blender3d/core.py).

- ``varrer``: um perfil 2D arrastado por um caminho (moldura, rodapé, corrimão, aro);
- ``cortina``: pano com pregas que se abrem para baixo e caimento (dobras modeladas, não pintadas);
- ``capitone``: estofado com botões afundados (encosto de poltrona, painel acústico);
- ``suavizar``: subdivisão (aplicada na exportação), para o que precisa de curva lisa de verdade;
- ``juntar``: várias peças numa malha só (uma chamada de desenho por material), mantendo os materiais.

Coordenadas no Blender (z para cima, a frente em -y). As salas pensam no espaço do jogo (three.js: y para cima, z para
a câmera); ``jogo(x, y, z)`` converte.
"""
from __future__ import annotations

import math

import bpy
import bmesh
from mathutils import Matrix, Vector

from scripts.blender3d.core import _objeto

V3 = tuple[float, float, float]


def jogo(x: float, y: float, z: float) -> V3:
    """Ponto do espaço do jogo (y para cima, +z para a câmera) no espaço do Blender."""
    return (x, -z, y)


def suavizar(obj: bpy.types.Object, niveis: int = 1) -> bpy.types.Object:
    mod = obj.modifiers.new("subdividir", "SUBSURF")
    mod.levels = mod.render_levels = niveis
    return obj


def varrer(nome: str, mat, perfil: list[tuple[float, float]], caminho: list[V3], fechado: bool = False,
           pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0), normal: V3 | None = None) -> bpy.types.Object:
    """Arrasta ``perfil`` (pares (lateral, altura) no plano normal ao caminho) pelos pontos de ``caminho``.

    Sem ``normal``, a altura do perfil é o "para cima" do mundo (rodapé, corrimão); com ``normal`` (a frente da
    parede), o caminho é uma moldura nesse plano e a altura do perfil sai da parede."""
    bm = bmesh.new()
    pontos = [Vector(p) for p in caminho]
    aneis = []
    n = len(pontos)
    fixa = Vector(normal).normalized() if normal else None

    def lado_de(t: Vector) -> Vector:
        cima = fixa if fixa is not None else (Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((0, 1, 0)))
        return t.cross(cima).normalized()

    for i, p in enumerate(pontos):
        antes = pontos[i - 1] if (i > 0 or fechado) else p
        depois = pontos[(i + 1) % n] if (i < n - 1 or fechado) else p
        t1 = (p - antes).normalized() if (p - antes).length > 1e-9 else (depois - p).normalized()
        t2 = (depois - p).normalized() if (depois - p).length > 1e-9 else t1
        tangente = (t1 + t2).normalized() if (t1 + t2).length > 1e-6 else t2
        # meia-esquadria: na quina o perfil abre para não afinar a moldura
        l1, lado = lado_de(t1), lado_de(tangente)
        lado = lado / max(0.35, lado.dot(l1))
        cima = fixa if fixa is not None else lado.normalized().cross(tangente).normalized()
        aneis.append([bm.verts.new(p + lado * a + cima * b) for a, b in perfil])
    pares = list(zip(aneis, aneis[1:] + ([aneis[0]] if fechado else [])))
    for a, b in pares:
        for j in range(len(perfil) - 1):
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    if not fechado and len(perfil) > 2:
        bm.faces.new(aneis[0][::-1])
        bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _objeto(bm, nome, mat, pos, giro, liso=True)


def _grade(colunas: int, linhas: int, ponto) -> bmesh.types.BMesh:
    bm = bmesh.new()
    vs = [[bm.verts.new(ponto(i / colunas, j / linhas)) for i in range(colunas + 1)] for j in range(linhas + 1)]
    for j in range(linhas):
        for i in range(colunas):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    return bm


def cortina(nome: str, mat, largura: float, altura: float, pregas: int = 12, fundo: float = 0.07,
            pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0), puxada: float = 0.0, espessura: float = 0.012) -> bpy.types.Object:
    """Pano pendurado no topo (z = altura) com ``pregas`` dobras; ``puxada`` (0 a 1) junta a barra para um lado,
    como a cortina presa por um laço. As pregas crescem para baixo e cada uma tem fase própria (não é uma onda só)."""
    def ponto(u: float, v: float) -> Vector:
        z = altura * v
        caimento = 1 - v
        x = -largura / 2 + largura * u
        x -= puxada * caimento ** 1.6 * (x + largura / 2) * 0.55
        fase = math.sin(u * pregas * 2 * math.pi) + 0.25 * math.sin(u * pregas * 5.3 * math.pi + 1.3)
        y = fundo * fase * (0.55 + 0.45 * caimento) + 0.01 * math.sin(v * 9 + u * 31)
        return Vector((x, y, z))
    bm = _grade(pregas * 10, 36, ponto)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _objeto(bm, nome, mat, pos, giro, liso=True)
    obj.data.set_sharp_from_angle(angle=math.radians(180))
    sol = obj.modifiers.new("espessura", "SOLIDIFY")
    sol.thickness = espessura
    return obj


def capitone(nome: str, mat, largura: float, altura: float, espessura: float, botoes: tuple[int, int] = (4, 3),
             pos: V3 = (0, 0, 0), giro: V3 = (0, 0, 0), resolucao: int = 10) -> bpy.types.Object:
    """Estofado em pé (plano XZ, frente em -y) com os botões afundados em losango e as bordas arredondadas."""
    bx, bz = botoes

    def ponto(u: float, v: float) -> Vector:
        borda = min(u, 1 - u, v, 1 - v)
        cheio = math.sin(min(1.0, borda * 9) * math.pi / 2)
        du = (u * bx) % 1 - 0.5
        dv = (v * bz + (0.5 if int(u * bx) % 2 else 0)) % 1 - 0.5
        botao = math.exp(-(du * du + dv * dv) * 40)
        return Vector((largura * (u - 0.5), -espessura * cheio * (1 - 0.55 * botao), altura * (v - 0.5)))
    bm = _grade(bx * resolucao, bz * resolucao, ponto)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:                                                   # a frente olha para -y
        if f.normal.y > 0:
            f.normal_flip()
    obj = _objeto(bm, nome, mat, pos, giro, liso=True)
    obj.data.set_sharp_from_angle(angle=math.radians(180))
    sol = obj.modifiers.new("fundo", "SOLIDIFY")
    sol.thickness = 0.02
    return obj


def juntar(objetos: list[bpy.types.Object], nome: str) -> bpy.types.Object:
    """Funde peças (com os modificadores aplicados) numa malha só, na origem; os materiais de todas são mantidos."""
    bpy.context.view_layer.update()
    grafo = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    materiais: list = []
    for obj in objetos:
        avaliado = obj.evaluated_get(grafo)
        malha = bpy.data.meshes.new_from_object(avaliado)
        malha.transform(obj.matrix_world)
        if obj.matrix_world.determinant() < 0:
            malha.flip_normals()
        locais = [m for m in malha.materials]
        antes = len(bm.faces)
        bm.from_mesh(malha)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[antes:]:
            mat = locais[f.material_index] if locais else None
            if mat not in materiais:
                materiais.append(mat)
            f.material_index = materiais.index(mat)
        bpy.data.meshes.remove(malha)
    for obj in objetos:
        bpy.data.objects.remove(obj)
    malha = bpy.data.meshes.new(nome)
    bm.to_mesh(malha)
    bm.free()
    for mat in materiais:
        malha.materials.append(mat)
    novo = bpy.data.objects.new(nome, malha)
    bpy.context.scene.collection.objects.link(novo)
    return novo


def instancia(modelo: bpy.types.Object, pos: V3, giro_z: float = 0.0, escala: float = 1.0) -> bpy.types.Object:
    """Cópia que divide a malha (no arquivo vira instancing: uma chamada de desenho para todas)."""
    copia = modelo.copy()
    # compõe com a posição do próprio modelo (a peça que já está fora do centro, como a perna de uma arara)
    copia.matrix_world = (Matrix.Translation(pos) @ Matrix.Rotation(math.radians(giro_z), 4, "Z") @ Matrix.Scale(escala, 4)
                          @ modelo.matrix_basis)
    bpy.context.scene.collection.objects.link(copia)
    return copia


def esconder_modelo(modelo: bpy.types.Object) -> None:
    """O modelo das cópias sai da cena (fica só nos dados); as cópias continuam usando a malha."""
    bpy.context.scene.collection.objects.unlink(modelo)
