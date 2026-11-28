"""Peças de camarim e ateliê em alta densidade: penteadeira com espelho de lâmpadas, kit de costura com carretéis,
manequim de costura no tripé, mesa de corte com tecido desenrolado, pilha de chapeleiras e cesto de rolos de tecido."""
from __future__ import annotations

import math

import bpy

from scripts.blender3d.core import barra, caixa, cilindro, esfera, toro, torneado

from ..formas import cortina, esconder_modelo, instancia, juntar
from ..materiais import material
from .kit_pecas import armario, modelos


def _copias(modelo: bpy.types.Object, lugares: list[tuple[float, float, float, float]]) -> list[bpy.types.Object]:
    """Cópias (x, y, z, giro) de um modelo, fora da cena: viram peças que ``em_ponto`` instancia de novo."""
    esconder_modelo(modelo)
    feitas = []
    for x, y, z, g in lugares:
        c = instancia(modelo, (x, y, z), g)
        bpy.context.scene.collection.objects.unlink(c)
        feitas.append(c)
    return feitas


def penteadeira(madeira: str = "#F2E6E0") -> list[bpy.types.Object]:
    """Mesa com gavetas (o armário do jogo, baixo e largo) e o espelho de camarim com doze lâmpadas na moldura."""
    corpo = armario(madeira, larg=1.3, alt=0.78, fundo=0.5, prefixo="penteadeira")
    moldura = material("penteadeira-moldura", madeira, "laca", aspereza=0.25, verniz=0.6)
    espelho = material("espelho", "#C8D2DC", metal=1.0, aspereza=0.02)
    lampada = material("lampada", "#FFF2D0", emissao=6.0)
    pecas = [caixa("espelho-moldura", moldura, (1.2, 0.05, 0.95), pos=(0, 0.2, 1.3), chanfro=0.02, seg=4),
             caixa("espelho-vidro", espelho, (0.98, 0.01, 0.75), pos=(0, 0.17, 1.3))]
    bulbo = esfera("lampada", lampada, 0.03, lados=20)
    soquete = cilindro("soquete", material("latao", "#B8903E", metal=1.0, aspereza=0.28), 0.018, 0.03, giro=(90, 0, 0), lados=16)
    lugares = [(-0.54, 0.16, 0.95 + i * 0.175, 0) for i in range(5)] + [(0.54, 0.16, 0.95 + i * 0.175, 0) for i in range(5)]
    lugares += [(-0.18, 0.16, 1.72, 0), (0.18, 0.16, 1.72, 0)]
    bulbos = _copias(bulbo, [(x, y - 0.03, z, g) for x, y, z, g in lugares])
    soquetes = _copias(soquete, lugares)
    return corpo + modelos(*pecas, heroi=True) + bulbos + soquetes


def kit_de_costura() -> list[bpy.types.Object]:
    """Mesinha (armário baixo) com a caixa de costura de tampa aberta, carretéis de linha e alfineteira."""
    corpo = armario("#8A6A4A", larg=0.9, alt=0.8, prefixo="mesinha")
    caixa_mat = material("caixa-costura", "#C6275E", "tecido", aspereza=0.6, fibra=0.5, repete=3)
    pecas = [caixa("costura-caixa", caixa_mat, (0.42, 0.28, 0.14), pos=(-0.12, 0, 0.87), chanfro=0.015, seg=4),
             caixa("costura-tampa", caixa_mat, (0.42, 0.02, 0.26), pos=(-0.12, 0.15, 1.0), giro=(-15, 0, 0), chanfro=0.008, seg=3),
             torneado("alfineteira", material("alfineteira", "#E04060", "veludo", aspereza=0.7, fibra=0.9), [(0, 0), (0.05, 0), (0.06, 0.02),
                      (0.055, 0.045), (0.03, 0.06), (0, 0.065)], pos=(0.25, -0.08, 0.8), lados=32)]
    carretel = []
    for i, cor in enumerate(("#1F7A76", "#F2C230", "#3A5BA0", "#FFFFFF")):
        linha = material(f"linha-{i}", cor, "tecido", aspereza=0.6, repete=8)
        carretel.append(torneado(f"carretel-{i}", linha, [(0, 0), (0.022, 0), (0.022, 0.006), (0.016, 0.008), (0.016, 0.052),
                                                          (0.022, 0.054), (0.022, 0.06), (0, 0.06)], lados=24))
    copias = []
    for i, m in enumerate(carretel):
        copias += _copias(m, [(0.08 + 0.06 * i, 0.12, 0.8, 0), (0.11 + 0.06 * i, 0.04, 0.8, 0)])
    return corpo + modelos(*pecas) + copias


def manequim(tecido: str = "#E8DCC8") -> list[bpy.types.Object]:
    """Manequim de costura: busto torneado (ombro, busto, cintura, quadril), pescoço com tampa, haste e tripé."""
    linho = material("manequim", tecido, "tecido", aspereza=0.8, fibra=0.4, repete=4)
    madeira = material("manequim-pe", "#5A3A24", "madeira", aspereza=0.4, verniz=0.4)
    perfil = [(0, 0.82), (0.13, 0.82), (0.16, 0.86), (0.17, 0.92), (0.15, 1.0), (0.125, 1.08), (0.15, 1.18), (0.17, 1.26),
              (0.165, 1.33), (0.15, 1.4), (0.07, 1.46), (0.045, 1.5), (0.045, 1.58), (0, 1.6)]
    busto = torneado("manequim-busto", linho, perfil, lados=64)
    busto.scale = (1.0, 0.72, 1.0)
    pecas = [busto, torneado("manequim-tampa", madeira, [(0, 1.6), (0.05, 1.6), (0.055, 1.62), (0, 1.64)], lados=32),
             cilindro("manequim-haste", madeira, 0.014, 0.82, pos=(0, 0, 0.41), lados=16)]
    for i in range(3):
        a = math.radians(120 * i + 90)
        pecas.append(barra("manequim-pe", madeira, (0, 0, 0.3), (0.28 * math.cos(a), 0.28 * math.sin(a), 0.02), 0.014, 12))
        pecas.append(esfera("manequim-sapata", madeira, 0.022, (0.28 * math.cos(a), 0.28 * math.sin(a), 0.02), lados=12))
    return modelos(*pecas, heroi=True)


def mesa_de_corte(tecido: str = "#1F7A76") -> list[bpy.types.Object]:
    """Mesa de corte grande: tampo com base de corte quadriculada, tecido desenrolado caindo pela borda, régua e tesoura."""
    madeira = material("mesa-corte", "#B98F62", "madeira", aspereza=0.4, verniz=0.3, repete=1)
    base = material("base-corte", "#2E6B4E", "tecido", aspereza=0.7, repete=6)
    pano = material("tecido-corte", tecido, "tecido", aspereza=0.75, fibra=0.7, repete=3)
    aco = material("tesoura", "#C9CCD2", metal=1.0, aspereza=0.2)
    pecas = [caixa("mesa-tampo", madeira, (1.0, 2.0, 0.05), pos=(0, 0, 0.9), chanfro=0.012, seg=3),
             caixa("mesa-base", base, (0.9, 1.6, 0.006), pos=(0, 0, 0.928))]
    for x in (-0.42, 0.42):
        for y in (-0.92, 0.92):
            pecas.append(caixa("mesa-perna", madeira, (0.07, 0.07, 0.87), pos=(x, y, 0.44), chanfro=0.01, seg=2))
    pecas.append(caixa("mesa-prateleira", madeira, (0.9, 1.9, 0.03), pos=(0, 0, 0.2), chanfro=0.006, seg=2))
    rolo = cilindro("rolo-na-mesa", pano, 0.07, 0.95, pos=(0.1, 0.6, 1.0), giro=(0, 90, 0), lados=48, chanfro=0.006)
    desenrolado = cortina("tecido-desenrolado", pano, 0.9, 1.25, pregas=4, fundo=0.025, pos=(0.05, 0, 0.935), giro=(-90, 0, 0))
    caida = cortina("tecido-caido", pano, 0.9, 0.55, pregas=5, fundo=0.04, pos=(0.05, -0.62, 0.38), giro=(0, 0, 0))
    regua = caixa("regua", material("regua", "#E8E0C0", metal=0.3, aspereza=0.3), (0.05, 0.6, 0.004), pos=(-0.3, -0.2, 0.935), giro=(0, 0, 12))
    laminas = [barra("tesoura-lamina", aco, (-0.2, 0.3, 0.94), (-0.05 + 0.03 * s, 0.42, 0.94), 0.006, 8) for s in (-1, 1)]
    aros = [toro("tesoura-aro", material("tesoura-cabo", "#1A1A1E", aspereza=0.5), 0.025, 0.006, pos=(-0.24 + 0.05 * s, 0.26, 0.94),
                 lados=24, lados_tubo=8) for s in (0, 1)]
    return modelos(*pecas, rolo, desenrolado, caida, regua, juntar([*laminas, *aros], "tesoura"), heroi=True)


def chapeleiras() -> list[bpy.types.Object]:
    """Armário baixo com três chapeleiras redondas empilhadas, de tampa e fita (a caixa de chapéu da pista)."""
    corpo = armario("#D9D6D0", "#1F7A76", larg=1.0, alt=0.8, prefixo="chapeleiro")
    pecas = []
    for i, (r, cor) in enumerate(((0.3, "#1F7A76"), (0.25, "#F2E6E0"), (0.2, "#C6275E"))):
        papel = material(f"chapeleira-{i}", cor, "tecido", aspereza=0.6, repete=4)
        z = 0.8 + i * 0.24
        pecas.append(cilindro(f"chapeleira-{i}", papel, r, 0.2, pos=(0, 0, z + 0.1), lados=64, chanfro=0.006))
        pecas.append(cilindro(f"chapeleira-tampa-{i}", papel, r + 0.012, 0.05, pos=(0, 0, z + 0.205), lados=64, chanfro=0.01))
        pecas.append(toro(f"chapeleira-fita-{i}", material("fita", "#F2C230", aspereza=0.4, fibra=0.6), r + 0.002, 0.008,
                          pos=(0, 0, z + 0.12), lados=64, lados_tubo=8, achatado=0.4))
    return corpo + modelos(*pecas, heroi=True)


def rolos_de_tecido(cores: tuple[str, ...] = ("#1F7A76", "#C6275E", "#F2C230", "#3A5BA0", "#E8DCC8", "#7A1028")) -> list[bpy.types.Object]:
    """Cesto de vime (aros) com rolos de tecido em pé, levemente inclinados."""
    vime = material("vime", "#B08A5A", "tecido", aspereza=0.8, repete=6)
    cesto = [torneado("cesto", vime, [(0, 0), (0.32, 0), (0.34, 0.05), (0.36, 0.5), (0.35, 0.52), (0.33, 0.5), (0.31, 0.05), (0, 0.04)], lados=64)]
    cesto += [toro("cesto-aro", vime, 0.335 + 0.04 * t, 0.01, pos=(0, 0, 0.05 + 0.45 * t), lados=64, lados_tubo=8) for t in (0, 0.5, 1)]
    rolos = []
    for i, cor in enumerate(cores):
        a = 2 * math.pi * i / len(cores)
        pano = material(f"rolo-{i}", cor, "tecido", aspereza=0.75, fibra=0.6, repete=4)
        inclina = 6 + 3 * (i % 2)
        rolos.append(cilindro(f"rolo-{i}", pano, 0.075, 1.5, pos=(0.17 * math.cos(a), 0.17 * math.sin(a), 0.78), lados=40, chanfro=0.008,
                              giro=(inclina * math.sin(a), -inclina * math.cos(a), 0)))
    return modelos(*cesto, *rolos, heroi=True)
