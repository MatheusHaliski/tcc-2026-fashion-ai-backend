"""Níveis de detalhe no Blender: a contagem por malha (para o teto de cada objeto) e a passagem do alto ao médio
(Decimate nas malhas grandes, relevo assado nos heróis, texturas pela metade)."""
from __future__ import annotations

import bpy

from . import perfil
from .assar import assar_relevo

#: abaixo disto a malha vai igual para o médio
MIN_PARA_DECIMAR = 1500


def _triangulos(obj: bpy.types.Object, grafo) -> int:
    malha = obj.evaluated_get(grafo).to_mesh()
    tri = sum(len(f.vertices) - 2 for f in malha.polygons)
    obj.evaluated_get(grafo).to_mesh_clear()
    return tri


def por_malha() -> dict[str, tuple[int, bool, int]]:
    """malha -> (triângulos de uma cópia com os modificadores, herói?, cópias)."""
    grafo = bpy.context.evaluated_depsgraph_get()
    contas: dict[str, tuple[int, bool, int]] = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or "importado" in obj:
            continue
        nome = obj.data.name
        if nome in contas:
            tri, heroi, n = contas[nome]
            contas[nome] = (tri, heroi or bool(obj.get("heroi")), n + 1)
        else:
            contas[nome] = (_triangulos(obj, grafo), bool(obj.get("heroi")), 1)
    return contas


def conferir_tetos() -> None:
    fora = perfil.estouros_de_objeto({k: (t, h) for k, (t, h, _n) in por_malha().items()})
    if fora:
        raise SystemExit("objetos acima do teto do perfil high:\n  " + "\n  ".join(fora))


def _congelar(obj: bpy.types.Object, extra: str | None = None, razao: float = 1.0) -> bpy.types.Mesh:
    """Malha nova com os modificadores do objeto (e um Decimate, se pedido) já aplicados."""
    if extra:
        obj.modifiers.new("medio", "DECIMATE").ratio = razao
    grafo = bpy.context.evaluated_depsgraph_get()
    malha = bpy.data.meshes.new_from_object(obj.evaluated_get(grafo))
    if extra:
        obj.modifiers.remove(obj.modifiers["medio"])
    return malha


def para_o_medio(relevo: tuple[str, ...], razao: float = perfil.RAZAO_MEDIO) -> None:
    """Troca a cena do alto pela do médio, no lugar (rode depois de exportar o alto)."""
    grafo = bpy.context.evaluated_depsgraph_get()
    usuarios: dict[str, list[bpy.types.Object]] = {}
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            usuarios.setdefault(obj.data.name, []).append(obj)
    for nome, objs in usuarios.items():
        modelo = objs[0]
        tri = _triangulos(modelo, grafo)
        if tri < MIN_PARA_DECIMAR:
            continue
        baixa = _congelar(modelo, "medio", max(razao, 600 / tri))
        if modelo.name in relevo or nome in relevo:
            temporario = bpy.data.objects.new(f"{modelo.name}-baixo", baixa)
            temporario.matrix_world = modelo.matrix_world
            bpy.context.scene.collection.objects.link(temporario)
            assar_relevo(modelo, temporario)
            bpy.context.scene.collection.objects.unlink(temporario)
        for obj in objs:
            obj.modifiers.clear()
            obj.data = baixa
    for imagem in bpy.data.images:
        lado = perfil.TEXTURA["medio"]
        if imagem.size[0] > lado:
            imagem.scale(lado, lado)
            imagem.pack()
