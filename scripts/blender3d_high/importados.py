"""Modelos prontos reaproveitados nas salas high poly: os GLB do MET Gala Heist (public/heist/models), gerados pela
Meshy para o projeto entre 31/10 e 02/11/2026 (scripts/heist/meshy/run.mjs). Já vêm em alta densidade (15 a 61 mil
triângulos), com meshopt e texturas WebP.

Os arquivos não são copiados: o manifesto das salas aponta para ``/heist/models/<modelo>.glb``. Aqui eles entram na
cena do Blender só para a oclusão assada (a sombra de contato no piso) e para a prova renderizada, e saem antes da
exportação. Para o nível médio sai uma versão simplificada própria (``salas/importados/<modelo>-medio.glb``).
"""
from __future__ import annotations

import math
import tempfile
from pathlib import Path

from .exportar import _gltfpack

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "public/heist/models"
URL = "/heist/models"
MEDIO = RAIZ / "public/flair/3d/salas/importados"
URL_MEDIO = "/flair/3d/salas/importados"
#: razão de triângulos da versão média de um modelo pronto
RAZAO_MEDIO = 0.22
CREDITO = "Meshy (gerado pelo projeto para o MET Gala Heist, 31/10 a 02/11/2026; scripts/heist/meshy/run.mjs)"
_aberto = Path(tempfile.gettempdir()) / "fai-heist-aberto"


def aberto(modelo: str) -> Path:
    """Cópia descomprimida (o importador do Blender não lê meshopt), em pasta temporária."""
    import subprocess

    _aberto.mkdir(parents=True, exist_ok=True)
    destino = _aberto / f"{modelo}.glb"
    if not destino.exists():
        subprocess.run([*_gltfpack(), "-i", str(ORIGEM / f"{modelo}.glb"), "-o", str(destino), "-noq"], check=True,
                       capture_output=True)
    return destino


def medio(modelo: str) -> Path:
    """Versão simplificada (gltfpack -si), comprimida; gerada uma vez por modelo."""
    import subprocess

    MEDIO.mkdir(parents=True, exist_ok=True)
    destino = MEDIO / f"{modelo}-medio.glb"
    if not destino.exists():
        subprocess.run([*_gltfpack(), "-i", str(ORIGEM / f"{modelo}.glb"), "-o", str(destino), "-cc", "-si",
                        str(RAZAO_MEDIO)], check=True, capture_output=True)
    return destino


def por_na_cena(modelo: str, pos_jogo: tuple[float, float, float], giro: float, altura: float) -> list:
    """Importa o modelo, escala pela altura e apoia a base no ponto (espaço do jogo); devolve os objetos criados."""
    import bpy
    from mathutils import Matrix, Vector

    from .formas import jogo

    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(aberto(modelo)))
    novos = [o for o in bpy.data.objects if o not in antes]
    bpy.context.view_layer.update()
    cantos = [o.matrix_world @ Vector(c) for o in novos if o.type == "MESH" for c in o.bound_box]
    minimo = Vector((min(c.x for c in cantos), min(c.y for c in cantos), min(c.z for c in cantos)))
    maximo = Vector((max(c.x for c in cantos), max(c.y for c in cantos), max(c.z for c in cantos)))
    k = altura / max(maximo.z - minimo.z, 1e-3)
    centro = Vector(((minimo.x + maximo.x) / 2, (minimo.y + maximo.y) / 2, minimo.z))
    # mesmo encaixe do carregador do jogo: centro da caixa no ponto, base no piso, giro em torno do eixo vertical
    ajuste = (Matrix.Translation(jogo(*pos_jogo)) @ Matrix.Rotation(math.radians(giro), 4, "Z") @ Matrix.Scale(k, 4)
              @ Matrix.Translation(-centro))
    for o in novos:
        if o.parent is None:
            o.matrix_world = ajuste @ o.matrix_world
        o["importado"] = modelo
    return novos


def tirar_da_cena() -> None:
    import bpy

    for o in [o for o in bpy.data.objects if "importado" in o]:
        bpy.data.objects.remove(o)
