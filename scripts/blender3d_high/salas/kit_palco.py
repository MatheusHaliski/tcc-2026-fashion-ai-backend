"""Peças de desfile em alta densidade (Passarela do jogo 1 e sala 9 do Detective): poltrona de plateia capitonê,
refletor Fresnel com lente em degraus, aletas e bandeiras, treliça quadrada de tubos, passarela laqueada com friso de
LED, telão de módulos com moldura e o arco do backstage com cortina pregueada."""
from __future__ import annotations

import math

import bpy

from scripts.blender3d.core import barra, caixa, cilindro, toro, torneado

from ..formas import capitone, cortina, esconder_modelo, juntar, suavizar, varrer
from ..materiais import material

TUBO = [(math.cos(2 * math.pi * i / 12), math.sin(2 * math.pi * i / 12)) for i in range(13)]


def _so_modelos(*objs: bpy.types.Object, heroi: bool = True) -> list[bpy.types.Object]:
    for o in objs:
        o["heroi"] = heroi
        esconder_modelo(o)
    return list(objs)


def poltrona(veludo_cor: str, metal_cor: str = "#B8903E") -> list[bpy.types.Object]:
    """Poltrona de plateia (frente em -y): encosto capitonê curvo, assento estofado subdividido, braços arredondados,
    pés cônicos de latão. Uma malha por material, para o instancing pegar todas as cópias de uma vez."""
    veludo = material("poltrona-veludo", veludo_cor, "veludo", aspereza=0.75, fibra=1.0, repete=3)
    latao = material("poltrona-latao", metal_cor, metal=1.0, aspereza=0.25)
    encosto = capitone("poltrona-encosto", veludo, 0.52, 0.5, 0.07, botoes=(3, 3), pos=(0, 0.2, 0.72), giro=(-8, 0, 0), resolucao=10)
    assento = suavizar(caixa("poltrona-assento", veludo, (0.5, 0.46, 0.12), pos=(0, -0.02, 0.44), chanfro=0.04, seg=3), 1)
    costas = suavizar(caixa("poltrona-costas", veludo, (0.56, 0.08, 0.6), pos=(0, 0.25, 0.68), giro=(-8, 0, 0), chanfro=0.03, seg=2), 1)
    bracos = [suavizar(caixa("poltrona-braco", veludo, (0.07, 0.5, 0.26), pos=(s * 0.29, 0.0, 0.5), chanfro=0.03, seg=3), 1) for s in (-1, 1)]
    estofado = juntar([encosto, assento, costas, *bracos], "poltrona-estofado")
    pes = [torneado("poltrona-pe", latao, [(0, 0), (0.016, 0), (0.024, 0.36), (0.03, 0.38), (0, 0.38)], lados=20,
                    pos=(sx * 0.24, sy * 0.2, 0)) for sx in (-1, 1) for sy in (-1, 1)]
    base = juntar(pes, "poltrona-pes")
    return _so_modelos(estofado, base)


def refletor() -> list[bpy.types.Object]:
    """Refletor Fresnel apontado para -y e para baixo: corpo torneado, 12 aletas, lente em anéis concêntricos (acesa),
    garfo, grampo de treliça e quatro bandeiras (barn doors)."""
    carcaca = material("refletor-carcaca", "#18181C", metal=0.6, aspereza=0.4)
    aluminio = material("refletor-garfo", "#2A2A30", "escovado", metal=0.9, aspereza=0.35, repete=3)
    lente = material("refletor-lente", "#FFF1D6", emissao=9.0, aspereza=0.05)
    corpo = [torneado("refletor-corpo", carcaca, [(0, -0.28), (0.09, -0.28), (0.13, -0.24), (0.14, -0.1), (0.15, 0.12), (0.16, 0.14),
                                                  (0.16, 0.18), (0.13, 0.18)], lados=48)]
    corpo += [toro("refletor-aleta", carcaca, 0.142, 0.006, pos=(0, 0, -0.22 + i * 0.026), lados=48, lados_tubo=6, achatado=2.2)
              for i in range(12)]
    for i, r in enumerate((0.125, 0.095, 0.065, 0.035)):
        corpo.append(torneado("refletor-lente", lente, [(r, 0.165 + i * 0.006), (r - 0.03 if r > 0.04 else 0, 0.178 + i * 0.006)], lados=48))
    for a in range(4):
        giro = 90 * a
        p = caixa("refletor-bandeira", carcaca, (0.3, 0.005, 0.16), pos=(0, 0.16, 0.26), giro=(-25, 0, 0), chanfro=0.002, seg=1)
        p.rotation_euler.rotate_axis("Z", math.radians(giro))
        p.location = (0.16 * math.sin(math.radians(giro)), 0.16 * math.cos(math.radians(giro)), 0.26)
        corpo.append(p)
    peca = juntar(corpo, "refletor")
    peca.rotation_euler = (math.radians(110), 0, 0)              # a lente para -y, inclinada para baixo
    lentes = [o for o in [peca]]
    garfo = juntar([varrer("refletor-garfo", aluminio, [(0.012 * x, 0.025 * y) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))],
                           [(-0.19, 0, 0), (-0.19, 0, 0.26), (0.19, 0, 0.26), (0.19, 0, 0)]),
                    cilindro("refletor-grampo", aluminio, 0.03, 0.08, pos=(0, 0, 0.3), lados=24, chanfro=0.005)], "refletor-garfo")
    garfo.location = (0, 0, 0.0)
    return _so_modelos(*lentes, garfo)


def trelica(comprimento: float, lado: float = 0.29, raio: float = 0.024, passo: float = 0.5) -> bpy.types.Object:
    """Treliça quadrada ao longo de x: quatro banzos e diagonais em zigue-zague nas quatro faces (uma malha só)."""
    aluminio = material("trelica", "#B8BCC4", "escovado", metal=1.0, aspereza=0.3, repete=4)
    h = lado / 2
    cantos = [(-h, -h), (h, -h), (h, h), (-h, h)]
    tubos = [barra("banzo", aluminio, (-comprimento / 2, y, z), (comprimento / 2, y, z), raio, 16) for y, z in cantos]
    n = int(comprimento / passo)
    for i in range(n):
        x0, x1 = -comprimento / 2 + i * passo, -comprimento / 2 + (i + 1) * passo
        for k in range(4):
            (ya, za), (yb, zb) = cantos[k], cantos[(k + 1) % 4]
            de, ate = ((x0, ya, za), (x1, yb, zb)) if i % 2 == 0 else ((x0, yb, zb), (x1, ya, za))
            tubos.append(barra("diagonal", aluminio, de, ate, raio * 0.55, 10))
    return _so_modelos(juntar(tubos, f"trelica-{comprimento:g}"))[0]


def passarela(largura: float, comprimento: float, altura: float, laca_cor: str, led_cor: str, saia_cor: str = "#121016") -> list:
    """Passarela laqueada (verniz) com tampo chanfrado e borda em perfil, saia de veludo pregueada e friso de LED
    embutido nas duas bordas. Comprimento ao longo de -y (para o fundo da sala), origem no meio."""
    laca = material("passarela-laca", laca_cor, "laca", aspereza=0.06, verniz=1.0, repete=0.5)
    led = material("passarela-led", led_cor, emissao=7.0)
    saia = material("passarela-saia", saia_cor, "veludo", aspereza=0.8, fibra=0.8, repete=2)
    tampo = caixa("passarela-tampo", laca, (largura, comprimento, 0.06), pos=(0, 0, altura - 0.03), chanfro=0.02, seg=5)
    pecas = [tampo]
    for s in (-1, 1):
        pecas.append(caixa("passarela-led", led, (0.03, comprimento - 0.24, 0.012), pos=(s * (largura / 2 - 0.08), 0, altura + 0.002)))
        if altura > 0.15:                                       # a passarela rente ao piso não tem saia
            pecas.append(cortina("passarela-saia", saia, comprimento - 0.04, altura - 0.06, pregas=int(comprimento * 3), fundo=0.025,
                                 pos=(s * (largura / 2 - 0.03), 0, 0), giro=(0, 0, 90)))
    if altura > 0.15:
        pecas.append(cortina("passarela-saia-ponta", saia, largura - 0.06, altura - 0.06, pregas=5, fundo=0.025,
                             pos=(0, -comprimento / 2 + 0.03, 0)))
    return _so_modelos(*pecas)


def telao(largura: float, altura: float, tela_cor: str = "#2A1033", moldura_cor: str = "#1A1A1E") -> list[bpy.types.Object]:
    """Telão de LED: grade de módulos chanfrados (cópias de um módulo), moldura em perfil e pés com sapata."""
    tela = material("telao-modulo", tela_cor, emissao=1.6, aspereza=0.2, verniz=0.6)
    moldura = material("telao-moldura", moldura_cor, "escovado", metal=0.8, aspereza=0.35, repete=2)
    modulos = []
    colunas, linhas = int(largura / 0.5), int(altura / 0.5)
    for i in range(colunas):
        for j in range(linhas):
            x = -largura / 2 + (i + 0.5) * largura / colunas
            z = (j + 0.5) * altura / linhas
            modulos.append(caixa("telao-modulo", tela, (largura / colunas - 0.012, 0.04, altura / linhas - 0.012), pos=(x, 0, z),
                                 chanfro=0.004, seg=2))
    grade = juntar(modulos, "telao-tela")
    perfil = [(0, 0), (0.06, 0), (0.08, 0.02), (0.08, 0.08), (0.06, 0.1), (0, 0.1)]
    quadro = varrer("telao-moldura", moldura, perfil, [(-largura / 2 - 0.04, 0, -0.04), (largura / 2 + 0.04, 0, -0.04),
                                                       (largura / 2 + 0.04, 0, altura + 0.04), (-largura / 2 - 0.04, 0, altura + 0.04)],
                    fechado=True, normal=(0, -1, 0))
    return _so_modelos(grade, quadro)


def arco(largura: float, altura: float, cortina_cor: str, metal_cor: str = "#1A1A1E", luz_cor: str = "#FF4FA3") -> list:
    """Arco do backstage: dois pilares e a verga em perfil moldurado, filete de luz e a cortina de veludo puxada."""
    metal = material("arco", metal_cor, "escovado", metal=0.85, aspereza=0.3, repete=2)
    luz = material("arco-luz", luz_cor, emissao=8.0)
    pano = material("arco-cortina", cortina_cor, "veludo", aspereza=0.75, fibra=1.0, repete=1.5)
    perfil = [(-0.16, -0.16), (0.16, -0.16), (0.16, 0.12), (0.12, 0.16), (-0.12, 0.16), (-0.16, 0.12), (-0.16, -0.16)]
    caminho = [(-largura / 2, 0, 0), (-largura / 2, 0, altura), (largura / 2, 0, altura), (largura / 2, 0, 0)]
    pecas = [varrer("arco-portico", metal, perfil, caminho, normal=(0, -1, 0))]
    pecas.append(caixa("arco-filete", luz, (largura - 0.3, 0.02, 0.04), pos=(0, -0.17, altura - 0.2)))
    for s in (-1, 1):
        pecas.append(cortina("arco-cortina", pano, largura * 0.55, altura - 0.2, pregas=9, fundo=0.07,
                             pos=(s * largura * 0.24, 0.12, 0), puxada=0.5 * s))
    return _so_modelos(*pecas)
