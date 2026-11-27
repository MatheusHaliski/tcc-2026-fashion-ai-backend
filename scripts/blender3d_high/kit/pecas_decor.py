"""Decoração e estrutura do kit da mansão: quadros com moldura entalhada e editoriais do próprio FashionAI (as imagens
dos desafios de vestir, em public/flair/desafios), espelho oval do hall, tapete persa com franjas, cortina de brocado
com bandô e borlas, medalhão de teto, castiçal de prata, módulos de sanca, rodapé e moldura de parede."""
from __future__ import annotations

import math

import bpy

from scripts.blender3d.core import caixa, cilindro, esfera, torneado

from ..build import RAIZ
from ..formas import cortina, esconder_modelo, instancia, varrer
from ..materiais import material
from . import acabamentos as a
from .pecas import peca

EDITORIAIS = {
    "arena": "public/flair/desafios/vestir-arena/depois.webp",
    "atelie": "public/flair/desafios/vestir-atelie/depois.webp",
    "show": "public/flair/desafios/vestir-show/depois.webp",
    "praca": "public/flair/desafios/vestir-praca/depois.webp",
}
#: perfis das molduras: cada quadro tem o seu
PERFIS = {
    "arena": [(0, 0), (0.06, 0), (0.075, 0.02), (0.06, 0.04), (0.085, 0.06), (0.07, 0.075), (0.02, 0.06), (0, 0.04)],
    "atelie": [(0, 0), (0.09, 0), (0.1, 0.03), (0.07, 0.05), (0.05, 0.04), (0.03, 0.06), (0, 0.05)],
    "show": [(0, 0), (0.05, 0), (0.05, 0.05), (0.03, 0.07), (0, 0.07)],
    "praca": [(0, 0), (0.12, 0), (0.13, 0.015), (0.1, 0.04), (0.11, 0.07), (0.08, 0.09), (0.04, 0.07), (0, 0.06)],
}
TOM = {"arena": "#C9A24A", "atelie": "#B8903E", "show": "#2A2A2E", "praca": "#D4AF37"}


def _tela(nome: str, arquivo: str):
    img = bpy.data.images.load(str(RAIZ / arquivo))
    img.pack()
    mat = bpy.data.materials.new(f"{nome}:tela")
    mat.use_nodes = True
    no = mat.node_tree.nodes.new("ShaderNodeTexImage")
    no.image = img
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    mat.node_tree.links.new(no.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    return mat, img.size[0] / max(1, img.size[1])


def _quadro(chave: str) -> None:
    tela, proporcao = _tela(f"quadro-{chave}", EDITORIAIS[chave])
    moldura = (a.ebano if chave == "show" else a.dourado)(f"quadro-{chave}", TOM[chave])
    alt = 1.0
    larg = alt * proporcao
    bpy.ops.mesh.primitive_plane_add(size=1.0, calc_uvs=True)  # a tela com a imagem inteira (UV de 0 a 1)
    plano = bpy.context.object
    plano.name, plano.scale, plano.rotation_euler = "tela", (larg, alt, 1), (math.radians(90), 0, 0)
    plano.location = (0, -0.02, alt / 2 + 0.1)
    plano.data.materials.append(tela)
    caixa("chassi", a.pintado(f"quadro-{chave}-chassi", "#3A2A1A"), (larg, 0.02, alt), pos=(0, -0.005, alt / 2 + 0.1))
    l, h = larg / 2, alt + 0.1
    varrer("moldura", moldura, PERFIS[chave], [(-l, 0, 0.1), (-l, 0, h), (l, 0, h), (l, 0, 0.1)], fechado=True, normal=(0, -1, 0))
    if chave in ("arena", "praca"):                               # ornatos dos cantos e o brasão do topo
        rosa = torneado("ornato", moldura, [(0, 0), (0.05, 0), (0.045, 0.02), (0.02, 0.035), (0, 0.04)], lados=24, giro=(90, 0, 0))
        esconder_modelo(rosa)
        for x, z in ((-l, 0.1), (l, 0.1), (-l, h), (l, h)):
            instancia(rosa, (x, -0.06, z))
        torneado("brasao", moldura, [(0, 0), (0.12, 0), (0.1, 0.04), (0.05, 0.07), (0, 0.08)], lados=32, giro=(90, 0, 0), pos=(0, -0.07, h + 0.06))
    caixa("arame", a.latao_velho(f"quadro-{chave}"), (0.3, 0.004, 0.004), pos=(0, 0.002, h - 0.15))


for _chave in EDITORIAIS:
    peca(f"quadro-{_chave}", f"Quadro com editorial do FashionAI ({_chave})", "parede", ("qualquer",))(lambda c=_chave: _quadro(c))


@peca("espelho-oval", "Espelho oval do hall com moldura dourada e laço", "parede", ("hall", "closet"))
def espelho_oval() -> None:
    ouro, vidro = a.dourado("espelho-oval", "#C9A24A"), a.cromo("espelho-oval")
    pontos = [(0.42 * math.cos(t), 0, 0.62 * math.sin(t) + 0.75) for t in [2 * math.pi * i / 72 for i in range(72)]]
    varrer("moldura", ouro, [(0, 0), (0.05, 0), (0.07, 0.025), (0.05, 0.05), (0.02, 0.055), (0, 0.04)], pontos, fechado=True, normal=(0, -1, 0))
    oval = torneado("vidro", vidro, [(0, 0), (0.42, 0), (0.42, 0.01), (0, 0.01)], lados=72, giro=(90, 0, 0), pos=(0, 0, 0.75))
    oval.scale = (1, 1.48, 1)
    for s in (-1, 1):
        torneado(f"laco-{s}", ouro, [(0, 0), (0.08, 0), (0.06, 0.03), (0.02, 0.05), (0, 0.05)], lados=24, giro=(90, 0, 0),
                 pos=(s * 0.1, -0.04, 1.42)).scale = (1.4, 1.0, 0.7)
    esfera("no", ouro, 0.04, (0, -0.05, 1.42), lados=20)


@peca("tapete-persa", "Tapete persa com medalhão e franjas", "piso", ("qualquer",))
def tapete() -> None:
    la = material("tapete-persa:la", "#5A1424", "carpete", aspereza=0.95, fibra=0.6, repete=0.6)
    borda = material("tapete-persa:borda", "#1C1A30", "carpete", aspereza=0.95, fibra=0.6, repete=2)
    caixa("campo", la, (2.6, 1.7, 0.012), pos=(0, 0, 0.006), chanfro=0.004, seg=2)
    caixa("barra", borda, (3.0, 2.1, 0.01), pos=(0, 0, 0.005), chanfro=0.004, seg=2)
    torneado("medalhao", material("tapete-persa:medalhao", "#C9A24A", "carpete", aspereza=0.95, repete=3),
             [(0, 0.0125), (0.45, 0.0125), (0.45, 0.013), (0, 0.013)], lados=16).scale = (1.4, 1.0, 1.0)
    fio = cilindro("franja", a.pintado("tapete-persa-franja", "#EDE6D6"), 0.004, 0.08, giro=(0, 90, 0), lados=6)
    esconder_modelo(fio)
    for y in [-1.0 + 0.04 * i for i in range(51)]:
        for s in (-1, 1):
            instancia(fio, (s * 1.54, y, 0.003))


@peca("cortina-brocado", "Cortina de brocado com bandô, varão e borlas", "parede", ("qualquer",))
def cortina_brocado() -> None:
    pano, ouro = a.brocado("cortina-brocado", "#5C1A2A"), a.dourado("cortina-brocado", "#C9A24A")
    for s in (-1, 1):
        cortina(f"pano-{s}", pano, 1.0, 2.7, pregas=12, fundo=0.08, pos=(s * 0.75, -0.15, 0.0), puxada=0.45 * s)
        torneado(f"borla-{s}", ouro, [(0, 0), (0.03, 0), (0.05, 0.12), (0.02, 0.16), (0.025, 0.2), (0, 0.21)], lados=24, pos=(s * 1.0, -0.22, 0.85))
    cortina("bando", pano, 2.4, 0.45, pregas=18, fundo=0.05, pos=(0, -0.24, 2.4))
    cilindro("varao", ouro, 0.02, 2.6, pos=(0, -0.12, 2.78), giro=(0, 90, 0), lados=24)
    for s in (-1, 1):
        esfera(f"ponteira-{s}", ouro, 0.045, (s * 1.32, -0.12, 2.78), lados=20)


@peca("medalhao-teto", "Medalhão de gesso para o lustre", "teto", ("qualquer",))
def medalhao() -> None:
    gesso = a.pintado("medalhao", "#F2EEE6")
    torneado("medalhao", gesso, [(0, 0), (0.45, 0), (0.44, -0.02), (0.4, -0.025), (0.36, -0.045), (0.3, -0.05), (0.22, -0.035), (0.15, -0.06),
                                 (0.08, -0.07), (0, -0.07)], lados=96)
    folha = torneado("folha", gesso, [(0, 0), (0.035, 0), (0.02, -0.02), (0, -0.025)], lados=12)
    folha.scale = (1.0, 2.4, 1.0)
    esconder_modelo(folha)
    for i in range(16):
        g = 2 * math.pi * i / 16
        instancia(folha, (0.33 * math.cos(g), 0.33 * math.sin(g), -0.04), math.degrees(g) + 90)


@peca("castical-prata", "Castiçal de prata de três braços com velas", "piso", ("jantar", "salao-baile", "hall", "biblioteca"))
def castical() -> None:
    prata = a.cromo("castical")
    torneado("corpo", prata, [(0, 0), (0.09, 0), (0.08, 0.02), (0.025, 0.05), (0.035, 0.15), (0.018, 0.3), (0.03, 0.34), (0, 0.35)], lados=48)
    for k in (-1, 0, 1):
        x = k * 0.15
        if k:
            varrer(f"braco-{k}", prata, [(0.008 * math.cos(t), 0.008 * math.sin(t)) for t in [i * math.pi / 4 for i in range(9)]],
                   [(0, 0, 0.3), (x * 0.5, 0, 0.27), (x, 0, 0.33), (x, 0, 0.38)])
        torneado(f"bobeche-{k}", prata, [(0, 0), (0.035, 0), (0.04, 0.01), (0.015, 0.012), (0, 0.012)], lados=24, pos=(x, 0, 0.38 if k else 0.35))
        cilindro(f"vela-{k}", a.pintado("castical-vela", "#F4EEDF"), 0.012, 0.16, pos=(x, 0, (0.38 if k else 0.35) + 0.09), lados=20)
        torneado(f"chama-{k}", a.luz("castical", "#FFD890", 9), [(0, 0), (0.008, 0.015), (0.004, 0.035), (0, 0.045)], lados=12,
                 pos=(x, 0, (0.38 if k else 0.35) + 0.17))


@peca("sanca-1m", "Módulo de sanca (1 m)", "parede", ("qualquer",))
def sanca() -> None:
    varrer("sanca", a.pintado("sanca", "#F2EEE6"), [(0, 0), (0.02, 0.0), (0.03, 0.03), (0.07, 0.07), (0.1, 0.12), (0.14, 0.14), (0.16, 0.17), (0, 0.17)],
           [(-0.5, 0, 0), (0.5, 0, 0)])


@peca("rodape-1m", "Módulo de rodapé (1 m)", "parede", ("qualquer",))
def rodape() -> None:
    varrer("rodape", a.pintado("rodape", "#E8E0D0"), [(0, 0), (0.02, 0), (0.02, 0.14), (0.012, 0.16), (0.016, 0.18), (0.006, 0.2), (0, 0.2)],
           [(-0.5, 0, 0), (0.5, 0, 0)])


@peca("moldura-parede", "Moldura de parede (quadro de boiserie 1 × 1,5 m)", "parede", ("qualquer",))
def moldura_parede() -> None:
    varrer("moldura", a.dourado("moldura-parede", "#C9A24A"), [(-0.025, 0), (-0.02, 0.01), (0, 0.02), (0.02, 0.012), (0.03, 0)],
           [(-0.5, 0, 0), (-0.5, 0, 1.5), (0.5, 0, 1.5), (0.5, 0, 0)], fechado=True, normal=(0, -1, 0))
