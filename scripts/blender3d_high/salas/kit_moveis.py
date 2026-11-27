"""Esconderijos do Fashion Detective em alta densidade: arara com cabides e roupas com pregas, estante com caixas de
arquivo e livros, e pilha de caixotes de ripas. Modelos na origem (frente em -y), postos com ``kit_pecas.em_ponto``.
"""
from __future__ import annotations

import math

import bmesh
import bpy

from scripts.blender3d.core import _objeto, caixa, cilindro, toro

from ..formas import instancia, juntar, varrer
from ..materiais import material
from .kit_pecas import modelos


def roupa(nome: str, mat, altura: float = 1.05, ombro: float = 0.42, barra_larg: float = 0.62, pregas: int = 9) -> bpy.types.Object:
    """Vestido pendurado: tubo achatado do ombro à barra, que abre em pregas para baixo (seção com ondas)."""
    bm = bmesh.new()
    lados, aneis = 96, 34
    camadas = []
    for j in range(aneis + 1):
        v = j / aneis                                     # 0 no ombro, 1 na barra
        cintura = 1 - 0.28 * math.exp(-((v - 0.32) / 0.12) ** 2)
        meia = (ombro + (barra_larg - ombro) * v ** 1.4) / 2 * cintura
        fundo = 0.07 + 0.08 * v
        anel = []
        for i in range(lados):
            a = 2 * math.pi * i / lados
            onda = 1 + (0.1 * v ** 1.5) * math.sin(pregas * a + 0.7 * math.sin(3 * a))
            anel.append(bm.verts.new((meia * math.cos(a) * onda, fundo * math.sin(a) * onda, altura * (1 - v))))
        camadas.append(anel)
    for cima, baixo in zip(camadas, camadas[1:]):
        for i in range(lados):
            bm.faces.new((cima[i], cima[(i + 1) % lados], baixo[(i + 1) % lados], baixo[i]))
    bm.faces.new(camadas[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _objeto(bm, nome, mat, (0, 0, 0), (0, 0, 0), liso=True)


def cabide(metal) -> bpy.types.Object:
    """Cabide de arame: gancho e ombros num só arame (perfil redondo arrastado)."""
    circulo = [(0.004 * math.cos(a), 0.004 * math.sin(a)) for a in [2 * math.pi * i / 8 for i in range(9)]]
    gancho = [(0, 0, 0.0), (0, 0, 0.06), (0.012, 0, 0.085), (0.03, 0, 0.09), (0.042, 0, 0.075), (0.035, 0, 0.06)]
    ombros = [(-0.2, 0, -0.08), (0, 0, 0.0), (0.2, 0, -0.08), (-0.2, 0, -0.08)]
    return juntar([varrer("cabide-gancho", metal, circulo, gancho), varrer("cabide-ombro", metal, circulo, ombros)], "cabide")


def arara(cores: tuple[str, ...], larg: float = 1.6, alt: float = 1.7) -> list[bpy.types.Object]:
    metal = material("arara-metal", "#C9CCD2", "escovado", metal=1.0, aspereza=0.25, repete=2)
    borracha = material("borracha", "#1A1A1E", aspereza=0.8)
    pecas = []
    for lado in (-1, 1):
        x = lado * larg / 2
        pecas.append(cilindro("arara-montante", metal, 0.016, alt, pos=(x, 0, alt / 2), lados=24, chanfro=0.003))
        pecas.append(cilindro("arara-pe", metal, 0.016, 0.5, pos=(x, 0, 0.07), giro=(90, 0, 0), lados=24, chanfro=0.003))
        for y in (-0.22, 0.22):
            pecas.append(toro("arara-roda", borracha, 0.03, 0.012, pos=(x, y, 0.032), giro=(90, 0, 90), lados=24, lados_tubo=10))
    pecas.append(cilindro("arara-barra", metal, 0.014, larg + 0.06, pos=(0, 0, alt), giro=(0, 90, 0), lados=24, chanfro=0.003))
    gancho = cabide(material("cabide", "#8F949C", metal=1.0, aspereza=0.3))
    roupas = [roupa(f"roupa-{i}", material(f"roupa-{i}", c, "tecido", aspereza=0.75, fibra=0.6, repete=3),
                    altura=0.95 + 0.12 * (i % 2), barra_larg=0.5 + 0.08 * i) for i, c in enumerate(cores)]
    copias = []
    for k, x in enumerate([-0.62 + i * 0.155 for i in range(9)]):
        giro = 8 * math.sin(k * 1.7)
        copias.append(instancia(gancho, (x, 0, alt - 0.09), 90 + giro))
        copias.append(instancia(roupas[k % len(roupas)], (x, 0, alt - 0.17 - roupas[k % len(roupas)].dimensions.z), 90 + giro))
    from ..formas import esconder_modelo

    for r in (gancho, *roupas):
        esconder_modelo(r)
    corpo = modelos(*pecas)
    for c in copias:
        bpy.context.scene.collection.objects.unlink(c)
        c["heroi"] = True
    return corpo + copias


def estante(madeira_cor: str, caixas_cor: str = "#C8B48C", larg: float = 1.8, alt: float = 2.3, fundo: float = 0.45,
            livros: tuple[str, ...] = ("#6B2A2A", "#203A5C", "#2F4F3A", "#B08A3E", "#3A2A4A")) -> list[bpy.types.Object]:
    """Estante com laterais, cinco prateleiras, fundo, sanca, caixas de arquivo com etiqueta e fileiras de livros."""
    madeira = material("estante-madeira", madeira_cor, "madeira", aspereza=0.42, verniz=0.3, repete=1.5)
    papelao = material("caixa-arquivo", caixas_cor, "tecido", aspereza=0.85, repete=2)
    pecas = [caixa("estante-lateral", madeira, (0.04, fundo, alt), pos=(s * (larg / 2 - 0.02), 0, alt / 2), chanfro=0.006, seg=2)
             for s in (-1, 1)]
    pecas.append(caixa("estante-fundo", madeira, (larg - 0.08, 0.015, alt - 0.1), pos=(0, fundo / 2 - 0.01, alt / 2)))
    niveis = [0.08 + i * (alt - 0.2) / 5 for i in range(6)]
    for z in niveis:
        pecas.append(caixa("estante-prateleira", madeira, (larg - 0.08, fundo - 0.02, 0.03), pos=(0, 0, z), chanfro=0.005, seg=2))
    pecas.append(varrer("estante-sanca", madeira, [(0, 0), (0.03, 0), (0.04, 0.02), (0.035, 0.04), (0, 0.05)],
                        [(-larg / 2, -fundo / 2, alt - 0.05), (larg / 2, -fundo / 2, alt - 0.05)]))
    arquivo = caixa("arquivo", papelao, (0.3, 0.36, 0.26), chanfro=0.008, seg=2)
    furo = caixa("arquivo-alca", material("sombra", "#2A2420", aspereza=0.9), (0.08, 0.01, 0.025), chanfro=0.008, seg=3)
    livro = [caixa(f"livro-{i}", material(f"livro-{i}", c, "tecido", aspereza=0.6, repete=4), (0.035 + 0.01 * (i % 2), 0.26, 0.28 - 0.03 * (i % 3)),
                   chanfro=0.006, seg=2) for i, c in enumerate(livros)]
    copias = []
    for n, z in enumerate(niveis[:-1]):
        if n % 2 == 0:
            for x in (-0.6, -0.27, 0.06):
                copias.append(instancia(arquivo, (x, 0.02, z + 0.145)))
                copias.append(instancia(furo, (x, -0.165, z + 0.2)))
        x = 0.25 if n % 2 == 0 else -0.8
        while x < (0.8 if n % 2 == 0 else 0.75):
            k = int(abs(x * 97 + n * 13)) % len(livro)
            copias.append(instancia(livro[k], (x, 0.04, z + 0.015 + livro[k].dimensions.z / 2), 0))
            x += livro[k].dimensions.x + 0.004
    from ..formas import esconder_modelo

    for m in (arquivo, furo, *livro):
        esconder_modelo(m)
    for c in copias:
        bpy.context.scene.collection.objects.unlink(c)
    return modelos(*pecas) + copias


def caixotes(madeira_cor: str = "#9C7A50") -> list[bpy.types.Object]:
    """Pilha de caixotes de ripas (três embaixo deslocados, um em cima, girado)."""
    madeira = material("caixote", madeira_cor, "madeira", aspereza=0.7, repete=1.2)
    ripas = []
    for z in (0.06, 0.2, 0.34, 0.48):
        for y in (-0.255, 0.255):
            ripas.append(caixa("ripa", madeira, (0.6, 0.018, 0.1), pos=(0, y, z), chanfro=0.004, seg=2))
        for x in (-0.29, 0.29):
            ripas.append(caixa("ripa", madeira, (0.018, 0.5, 0.1), pos=(x, 0, z), chanfro=0.004, seg=2))
    for x in (-0.27, 0.27):
        for y in (-0.235, 0.235):
            ripas.append(caixa("canto", madeira, (0.045, 0.045, 0.54), pos=(x, y, 0.27), chanfro=0.006, seg=2))
    ripas.append(caixa("fundo", madeira, (0.58, 0.5, 0.02), pos=(0, 0, 0.01)))
    caixote = juntar(ripas, "caixote")
    from ..formas import esconder_modelo

    esconder_modelo(caixote)
    copias = [instancia(caixote, (x, y, 0), g) for x, y, g in ((-0.36, 0.05, 3), (0.3, -0.04, -4), (0.0, 0.1, 88))]
    copias.append(instancia(caixote, (-0.05, 0.02, 0.55), 12))
    copias.append(instancia(caixote, (0.08, -0.05, 1.1), -7))
    for c in copias:
        c["heroi"] = True
        bpy.context.scene.collection.objects.unlink(c)
    return copias
