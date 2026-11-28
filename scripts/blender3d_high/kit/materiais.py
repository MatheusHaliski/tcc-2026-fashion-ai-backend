"""Materiais de piso, parede e teto do kit da mansão, assados no Blender.

Para cada material: o desenho (kit/padroes.py) dá a altura, a cor e a aspereza de uma repetição; o Blender monta uma
malha de alta densidade deslocada por essa altura (Displace sobre uma grade de ~400 mil quadrados, 25% maior que a
repetição para a oclusão não cortar na borda) e assa nela, para um plano de uma repetição, o **mapa normal** (espaço
tangente) e a **oclusão** (Cycles, CPU). Saem quatro mapas WebP (cor e normal de 1024 px; aspereza e oclusão de 512),
a versão média (512 px) e uma amostra ``.glb`` de uma repetição com o material inteiro (meshopt).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from . import padroes

GRADE = 640


@dataclass(frozen=True)
class MaterialDoKit:
    slug: str
    titulo: str
    #: piso, parede ou teto
    tipo: str
    desenho: Callable[..., tuple]
    #: tamanho de uma repetição, em metros
    metros: float
    #: profundidade do relevo (m) e alcance da oclusão (m)
    profundidade: float
    oclusao: float
    opcoes: dict = field(default_factory=dict)


MATERIAIS = [
    MaterialDoKit("piso-espinha-nogueira", "Parquet espinha-de-peixe de nogueira", "piso", padroes.espinha, 0.72, 0.004, 0.02),
    MaterialDoKit("piso-espinha-carvalho", "Parquet espinha-de-peixe de carvalho", "piso", padroes.espinha, 0.72, 0.004, 0.02,
                  {"madeira": "#9A6A3A", "clara": "#C89A62"}),
    MaterialDoKit("piso-marmore-xadrez", "Mármore em xadrez (Carrara e Nero Marquina)", "piso", padroes.marmore_xadrez, 1.2, 0.002, 0.01),
    MaterialDoKit("piso-porcelanato", "Porcelanato polido", "piso", padroes.porcelanato, 1.2, 0.0015, 0.01),
    MaterialDoKit("piso-carpete-bordo", "Carpete bordô com medalhão", "piso", padroes.carpete, 1.5, 0.006, 0.02),
    MaterialDoKit("piso-carpete-azul", "Carpete azul com medalhão", "piso", padroes.carpete, 1.5, 0.006, 0.02,
                  {"fundo": "#1B2440", "desenho": "#B8C4D8", "borda": "#0E1426"}),
    MaterialDoKit("parede-boiserie-creme", "Boiserie pintada de creme", "parede", padroes.boiserie, 1.0, 0.025, 0.08),
    MaterialDoKit("parede-boiserie-nogueira", "Boiserie de nogueira", "parede", padroes.nogueira_painel, 1.0, 0.025, 0.08),
    MaterialDoKit("parede-damasco-bordo", "Papel de parede damasco bordô", "parede", padroes.damasco, 0.6, 0.0015, 0.01),
    MaterialDoKit("parede-damasco-verde", "Papel de parede damasco verde", "parede", padroes.damasco, 0.6, 0.0015, 0.01,
                  {"fundo": "#1E3A30", "motivo": "#2E5244"}),
    MaterialDoKit("parede-estuque", "Estuque veneziano", "parede", padroes.estuque, 1.5, 0.002, 0.02),
    MaterialDoKit("teto-gesso", "Teto de gesso", "teto", padroes.gesso, 1.0, 0.001, 0.01),
    MaterialDoKit("teto-caixotoes", "Teto de caixotões de madeira", "teto", padroes.caixotoes, 1.2, 0.12, 0.3),
]


def _imagem(nome: str, dados: np.ndarray, cor: bool):
    import bpy

    lado = dados.shape[0]
    img = bpy.data.images.new(nome, lado, lado, alpha=False, float_buffer=not cor)
    if not cor:
        img.colorspace_settings.name = "Non-Color"
    pixels = np.ones((lado, lado, 4), dtype=np.float32)
    pixels[..., :3] = dados if dados.ndim == 3 else dados[..., None]
    img.pixels.foreach_set(pixels.ravel())
    return img


def _ler_pixels(img) -> np.ndarray:
    lado = img.size[0]
    px = np.empty(lado * lado * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(lado, lado, 4)[..., :3]


def _salvar(rgb: np.ndarray, destino: Path, lado: int, qualidade: int) -> None:
    from PIL import Image

    # as linhas do Blender começam embaixo; a imagem do arquivo começa em cima
    img = Image.fromarray((np.clip(rgb[::-1], 0, 1) * 255).astype(np.uint8))
    img.resize((lado, lado), Image.LANCZOS).save(destino, "WEBP", quality=qualidade, method=5)


def assar(m: MaterialDoKit) -> dict[str, np.ndarray]:
    """Monta a malha de alta densidade e assa normal e oclusão; devolve os quatro mapas (linhas de baixo para cima)."""
    import bpy

    from ..assar import _cycles, _so
    from ..build import nova_cena

    nova_cena()
    altura, cor, aspereza = m.desenho(**m.opcoes)
    img_altura = _imagem("altura", altura.astype(np.float32), cor=False)
    textura = bpy.data.textures.new("altura", "IMAGE")
    textura.image = img_altura
    textura.extension = "REPEAT"
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=GRADE, y_subdivisions=GRADE, size=m.metros * 1.25, calc_uvs=True)
    alto = bpy.context.object
    for laco in alto.data.uv_layers[0].data:                     # a grade cobre 1,25 repetição, centrada
        laco.uv = ((laco.uv[0] - 0.5) * 1.25 + 0.5, (laco.uv[1] - 0.5) * 1.25 + 0.5)
    relevo = alto.modifiers.new("relevo", "DISPLACE")
    relevo.texture, relevo.texture_coords, relevo.strength, relevo.mid_level = textura, "UV", m.profundidade, 1.0
    for f in alto.data.polygons:
        f.use_smooth = True
    bpy.ops.mesh.primitive_plane_add(size=m.metros, calc_uvs=True)
    baixo = bpy.context.object
    mat = bpy.data.materials.new("alvo")
    mat.use_nodes = True
    baixo.data.materials.append(mat)
    alto.data.materials.append(mat)
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new("mundo")
    bpy.context.scene.world.light_settings.distance = m.oclusao
    mapas = {}
    for tipo, amostras in (("NORMAL", 1), ("AO", 32)):
        alvo = bpy.data.images.new(tipo, padroes.LADO, padroes.LADO, alpha=False, float_buffer=True)
        alvo.colorspace_settings.name = "Non-Color"
        no = mat.node_tree.nodes.new("ShaderNodeTexImage")
        no.image = alvo
        mat.node_tree.nodes.active = no
        _cycles(amostras)
        _so(baixo, alto)
        bpy.ops.object.bake(type=tipo, use_selected_to_active=True, cage_extrusion=m.profundidade * 1.5 + 0.002,
                            max_ray_distance=m.profundidade * 4 + 0.01, normal_space="TANGENT", use_clear=True, margin=0)
        mapas[tipo] = _ler_pixels(alvo)
        mat.node_tree.nodes.remove(no)
    return {"cor": cor, "normal": mapas["NORMAL"], "aspereza": aspereza, "ao": mapas["AO"]}
