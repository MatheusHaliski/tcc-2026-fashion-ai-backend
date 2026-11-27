"""Móveis do kit da mansão por cômodo, cada um com acabamento próprio e a camada de detalhe pequeno (puxadores,
entalhes, rebites, borlas): escadaria do hall, cadeira dourada do salão, estante cheia e escada de biblioteca, mesa de
jantar posta e cadeira de jantar, mesa de ébano do escritório, espelho triplo e manequim vestido do closet, estante de
partitura."""
from __future__ import annotations

import math

from scripts.blender3d.core import barra, caixa, cilindro, esfera, toro, torneado

from ..formas import capitone, esconder_modelo, instancia, suavizar, varrer
from ..salas.kit_atelie import manequim as _manequim
from ..salas.kit_moveis import roupa
from . import acabamentos as a
from .pecas import peca

TORNEADO = [(0, 0), (0.03, 0), (0.035, 0.04), (0.022, 0.1), (0.032, 0.16), (0.02, 0.3), (0.026, 0.5), (0.018, 0.62), (0.03, 0.68),
            (0.03, 0.72), (0, 0.72)]


@peca("escadaria-hall", "Escadaria do hall com balaústres torneados e passadeira", "piso", ("hall",))
def escadaria() -> None:
    mogno, passadeira = a.mogno("escadaria"), a.veludo("escadaria-passadeira", "#7A1028")
    latao, marmore = a.latao_velho("escadaria"), a.marmore("escadaria", "#ECE6DA")
    larg, n, piso, espelho = 1.8, 15, 0.3, 0.18
    for i in range(n):
        y, z = i * piso, (i + 1) * espelho
        caixa(f"degrau-{i}", marmore, (larg, piso + 0.03, 0.04), pos=(0, y, z - 0.02), chanfro=0.012, seg=3)
        caixa(f"espelho-{i}", marmore, (larg - 0.04, 0.03, espelho), pos=(0, y - piso / 2 + 0.015, z - espelho / 2))
    tapete = caixa("passadeira", passadeira, (1.0, 0.33, 0.012), chanfro=0.004, seg=2)
    vareta = cilindro("vareta", latao, 0.008, 1.08, giro=(0, 90, 0), lados=16)
    balaustre = torneado("balaustre", mogno, [(0, 0), (0.025, 0), (0.03, 0.03), (0.018, 0.08), (0.035, 0.3), (0.02, 0.55), (0.03, 0.62),
                                               (0.016, 0.82), (0, 0.82)], lados=24)
    for m in (tapete, vareta, balaustre):
        esconder_modelo(m)
    for i in range(n):
        y, z = i * piso, (i + 1) * espelho
        instancia(tapete, (0, y, z + 0.006))
        instancia(vareta, (0, y - piso / 2 + 0.03, z + 0.012))
        for s in (-1, 1):
            for k in (0.25, 0.75):
                instancia(balaustre, (s * (larg / 2 - 0.05), y - piso / 2 + k * piso, z))
    for s in (-1, 1):
        x = s * (larg / 2 - 0.05)
        varrer(f"corrimao-{s}", mogno, [(-0.04, -0.03), (0.04, -0.03), (0.045, 0.01), (0.02, 0.04), (-0.02, 0.04), (-0.045, 0.01), (-0.04, -0.03)],
               [(x, -piso / 2, espelho + 0.84), (x, (n - 1) * piso, n * espelho + 0.84)])
        torneado(f"pilarete-{s}", mogno, [(0, 0), (0.09, 0), (0.09, 0.1), (0.07, 0.14), (0.07, 0.9), (0.09, 0.95), (0.09, 1.02), (0.05, 1.08),
                                          (0.06, 1.16), (0, 1.22)], lados=48, pos=(x, -piso, 0))
        esfera(f"pinha-{s}", latao, 0.05, (x, -piso, 1.27), escala=(1, 1, 1.3), lados=24)


@peca("cadeira-dourada", "Cadeira dourada de salão (bambu) com almofada de veludo", "piso", ("salao-baile",))
def cadeira_dourada() -> None:
    ouro, veludo = a.dourado("cadeira-dourada", "#D8B04A"), a.veludo("cadeira-dourada", "#F2E6E8")
    for x in (-0.2, 0.2):
        for y in (-0.19, 0.19):
            barra("perna", ouro, (x * 1.08, y * 1.08, 0), (x, y, 0.45), 0.014, 16)
            for t in (0.15, 0.3):
                toro("anel", ouro, 0.017, 0.005, pos=(x * (1.08 - 0.08 * t / 0.45), y * (1.08 - 0.08 * t / 0.45), t), lados=16, lados_tubo=6)
    for x in (-0.2, 0.2):
        barra("montante", ouro, (x, 0.19, 0.45), (x * 0.95, 0.25, 0.92), 0.013, 16)
    for z in (0.62, 0.74, 0.86):
        barra("travessa", ouro, (-0.19, 0.2 + (z - 0.45) * 0.12, z), (0.19, 0.2 + (z - 0.45) * 0.12, z), 0.01, 12)
    for y in (-0.19, 0.19):
        barra("travessa-baixa", ouro, (-0.21, y * 1.04, 0.18), (0.21, y * 1.04, 0.18), 0.008, 10)
    caixa("assento", ouro, (0.42, 0.4, 0.03), pos=(0, 0, 0.45), chanfro=0.01, seg=3)
    suavizar(caixa("almofada", veludo, (0.4, 0.38, 0.06), pos=(0, 0, 0.49), chanfro=0.025, seg=3), 1)


@peca("estante-biblioteca", "Estante de nogueira cheia (livros, globo, castiçal, bustos)", "piso", ("biblioteca",))
def estante_biblioteca() -> None:
    nogueira, latao = a.nogueira("estante-biblioteca", "#3A2212"), a.latao_velho("estante-biblioteca")
    larg, alt, fundo = 2.2, 2.7, 0.42
    for s in (-1, 1):
        caixa(f"lateral-{s}", nogueira, (0.05, fundo, alt), pos=(s * (larg / 2 - 0.025), 0, alt / 2), chanfro=0.008, seg=2)
        torneado(f"pilastra-{s}", nogueira, [(0, 0), (0.04, 0), (0.035, 0.1), (0.03, alt - 0.25), (0.045, alt - 0.18), (0, alt - 0.18)],
                 lados=24, pos=(s * (larg / 2 - 0.03), -fundo / 2 - 0.02, 0))
    caixa("fundo", nogueira, (larg - 0.1, 0.015, alt - 0.1), pos=(0, fundo / 2 - 0.01, alt / 2))
    varrer("sanca", nogueira, [(0, 0), (0.04, 0), (0.06, 0.03), (0.09, 0.07), (0.1, 0.12), (0, 0.12)],
           [(-larg / 2 - 0.05, -fundo / 2, alt - 0.12), (larg / 2 + 0.05, -fundo / 2, alt - 0.12)])
    prateleiras = [0.1 + i * 0.43 for i in range(6)]
    for z in prateleiras:
        caixa("prateleira", nogueira, (larg - 0.1, fundo - 0.02, 0.035), pos=(0, 0, z), chanfro=0.006, seg=2)
    cores = ("#5A1A1A", "#1C2A44", "#244030", "#6A4A20", "#2A1A30", "#8A7A5A", "#3A0E10")
    livros = [caixa(f"livro-{i}", a.couro(f"livro-{i}", c), (0.035 + 0.012 * (i % 3), 0.24, 0.24 + 0.03 * (i % 4)), chanfro=0.008, seg=2)
              for i, c in enumerate(cores)]
    friso = caixa("livro-friso", a.dourado("livro-friso"), (0.002, 0.01, 0.012), chanfro=0.0)
    for m in (*livros, friso):
        esconder_modelo(m)
    for n, z in enumerate(prateleiras[:-1]):
        x = -larg / 2 + 0.08
        fim = larg / 2 - (0.5 if n % 2 else 0.08)
        while x < fim:
            k = int(abs(x * 131 + n * 17)) % len(livros)
            lv = livros[k]
            inclina = 8 if (int(x * 50) % 13 == 0) else 0
            instancia(lv, (x + lv.dimensions.x / 2, -0.04, z + 0.02 + lv.dimensions.z / 2), inclina)
            instancia(friso, (x + lv.dimensions.x / 2, -0.165, z + 0.02 + lv.dimensions.z * 0.8))
            x += lv.dimensions.x + 0.003
        if n % 2:
            torneado(f"castical-{n}", latao, [(0, 0), (0.05, 0), (0.04, 0.02), (0.012, 0.05), (0.02, 0.15), (0.012, 0.2), (0.025, 0.22), (0, 0.23)],
                     lados=32, pos=(larg / 2 - 0.3, -0.04, z + 0.02))
    esfera("globo", a.pintado("globo", "#C8B48A"), 0.13, (larg / 2 - 0.3, -0.04, prateleiras[-2] + 0.2), lados=48)
    toro("globo-meridiano", latao, 0.14, 0.006, pos=(larg / 2 - 0.3, -0.04, prateleiras[-2] + 0.2), giro=(90, 23, 0), lados=48, lados_tubo=8)


@peca("escada-biblioteca", "Escada de biblioteca de correr com trilho de latão", "piso", ("biblioteca",))
def escada_biblioteca() -> None:
    carvalho, latao = a.carvalho("escada-biblioteca", "#6A4428"), a.latao_velho("escada-biblioteca")
    for s in (-1, 1):
        barra(f"banzo-{s}", carvalho, (s * 0.22, -0.5, 0.0), (s * 0.22, 0.0, 2.6), 0.03, 12)
        toro(f"roda-{s}", latao, 0.04, 0.012, pos=(s * 0.22, -0.5, 0.04), giro=(0, 90, 0), lados=24, lados_tubo=8)
        torneado(f"gancho-{s}", latao, [(0, 0), (0.02, 0), (0.02, 0.08), (0, 0.1)], lados=16, pos=(s * 0.22, 0.03, 2.55))
    for i in range(9):
        t = (i + 0.5) / 9
        caixa(f"degrau-{i}", carvalho, (0.42, 0.12, 0.03), pos=(0, -0.5 + 0.5 * t, 2.6 * t), chanfro=0.008, seg=2)
    cilindro("trilho", latao, 0.014, 2.4, pos=(0, 0.06, 2.62), giro=(0, 90, 0), lados=24)


@peca("mesa-jantar-posta", "Mesa de jantar de mogno posta para oito (pratos, talheres, castiçais, flores)", "piso", ("jantar",))
def mesa_jantar() -> None:
    mogno, prata = a.mogno("mesa-jantar", "#4A1A10"), a.cromo("mesa-jantar-prata")
    porcelana, linho = a.pintado("mesa-jantar-porcelana", "#F6F2EA"), a.brocado("mesa-jantar-trilho", "#C9A24A")
    caixa("tampo", mogno, (3.0, 1.1, 0.06), pos=(0, 0, 0.76), chanfro=0.02, seg=4)
    caixa("saia", mogno, (2.8, 0.95, 0.12), pos=(0, 0, 0.67), chanfro=0.01, seg=3)
    varrer("entalhe", mogno, [(0, 0), (0.012, 0.004), (0.016, 0.02), (0.012, 0.036), (0, 0.04)], [(-1.4, -0.48, 0.63), (1.4, -0.48, 0.63)])
    pe = torneado("pe", mogno, TORNEADO, lados=32)
    for x in (-1.35, 1.35):
        for y in (-0.45, 0.45):
            instancia(pe, (x, y, 0))
    esconder_modelo(pe)
    caixa("trilho", linho, (2.6, 0.38, 0.004), pos=(0, 0, 0.792))
    prato = torneado("prato", porcelana, [(0, 0), (0.08, 0), (0.12, 0.012), (0.135, 0.018), (0.13, 0.02), (0, 0.006)], lados=48)
    garfo = caixa("garfo", prata, (0.012, 0.19, 0.004), chanfro=0.002, seg=2)
    faca = caixa("faca", prata, (0.014, 0.21, 0.004), chanfro=0.002, seg=2)
    taca = torneado("taca", a.vidro("mesa-jantar-cristal", "#E8F0F4"), [(0, 0), (0.035, 0), (0.006, 0.01), (0.005, 0.09), (0.03, 0.11),
                                                                         (0.04, 0.17), (0.036, 0.18), (0, 0.11)], lados=32)
    for m in (prato, garfo, faca, taca):
        esconder_modelo(m)
    for x in (-1.05, -0.35, 0.35, 1.05):
        for s in (-1, 1):
            y = s * 0.38
            instancia(prato, (x, y, 0.79))
            instancia(garfo, (x - 0.17, y, 0.792))
            instancia(faca, (x + 0.17, y, 0.792))
            instancia(taca, (x + 0.14, y - s * 0.16, 0.79))
    for x in (-0.7, 0.7):
        torneado(f"candelabro-{x}", prata, [(0, 0), (0.08, 0), (0.07, 0.02), (0.02, 0.05), (0.03, 0.2), (0.015, 0.35), (0.03, 0.4), (0, 0.41)],
                 lados=48, pos=(x, 0, 0.79))
        for k in (-1, 1):
            barra(f"braco-{x}-{k}", prata, (x, 0, 1.12), (x + k * 0.14, 0, 1.2), 0.008, 12)
            cilindro(f"vela-{x}-{k}", a.luz(f"mesa-jantar-vela-{x}-{k}", "#FFE0A0", 3.0), 0.012, 0.14, pos=(x + k * 0.14, 0, 1.28), lados=16)
    for i, c in enumerate(("#C6275E", "#F2E6E8", "#E8C93C")):
        for k in range(5):
            g = 2 * math.pi * (k + i * 0.33) / 5
            esfera(f"flor-{i}-{k}", a.veludo(f"mesa-jantar-flor-{i}", c), 0.035, (0.09 * math.cos(g), 0.09 * math.sin(g), 0.92 + 0.02 * i), lados=12)
    torneado("fruteira", prata, [(0, 0), (0.06, 0), (0.03, 0.05), (0.03, 0.08), (0.14, 0.12), (0.15, 0.13), (0, 0.1)], lados=48, pos=(0, 0, 0.79))


@peca("cadeira-jantar", "Cadeira de jantar entalhada com encosto de brocado capitonê", "piso", ("jantar",))
def cadeira_jantar() -> None:
    mogno, brocado = a.mogno("cadeira-jantar", "#5A1E12"), a.brocado("cadeira-jantar", "#2E5244")
    pe = torneado("pe", mogno, [(0, 0), (0.022, 0), (0.026, 0.05), (0.018, 0.15), (0.024, 0.3), (0.018, 0.42), (0, 0.44)], lados=24)
    for x in (-0.21, 0.21):
        for y in (-0.2, 0.2):
            instancia(pe, (x, y, 0))
    esconder_modelo(pe)
    caixa("quadro-assento", mogno, (0.48, 0.46, 0.05), pos=(0, 0, 0.46), chanfro=0.012, seg=3)
    suavizar(caixa("assento", brocado, (0.44, 0.42, 0.07), pos=(0, -0.01, 0.51), chanfro=0.03, seg=3), 1)
    for x in (-0.22, 0.22):
        barra("montante", mogno, (x, 0.21, 0.46), (x * 0.92, 0.27, 1.05), 0.02, 16)
    varrer("cimalha", mogno, [(-0.03, -0.02), (0.03, -0.02), (0.035, 0.02), (0, 0.04), (-0.035, 0.02), (-0.03, -0.02)],
           [(-0.22, 0.27, 1.05), (-0.1, 0.275, 1.1), (0.1, 0.275, 1.1), (0.22, 0.27, 1.05)])
    capitone("encosto", brocado, 0.38, 0.42, 0.04, botoes=(3, 3), pos=(0, 0.25, 0.78), giro=(-8, 0, 0), resolucao=10)


@peca("mesa-escritorio", "Mesa de ébano laqueado com tampo de couro, luminária de banqueiro e papéis", "piso", ("escritorio",))
def mesa_escritorio() -> None:
    ebano, couro, latao = a.ebano("mesa-escritorio"), a.couro("mesa-escritorio", "#1E3A28"), a.latao_velho("mesa-escritorio")
    caixa("tampo", ebano, (1.8, 0.9, 0.05), pos=(0, 0, 0.76), chanfro=0.015, seg=4)
    caixa("couro", couro, (1.5, 0.6, 0.006), pos=(0, 0.02, 0.788), chanfro=0.002, seg=1)
    for x in (-0.6, 0.6):
        caixa(f"gaveteiro-{x}", ebano, (0.5, 0.8, 0.72), pos=(x, 0, 0.37), chanfro=0.012, seg=3)
        for z in (0.18, 0.4, 0.6):
            caixa(f"gaveta-{x}-{z}", ebano, (0.44, 0.02, 0.18), pos=(x, -0.405, z), chanfro=0.006, seg=2)
            barra(f"puxador-{x}-{z}", latao, (x - 0.07, -0.43, z), (x + 0.07, -0.43, z), 0.007, 12)
    torneado("abajur-base", latao, [(0, 0), (0.09, 0), (0.08, 0.02), (0.015, 0.04), (0.015, 0.3), (0, 0.3)], lados=32, pos=(-0.55, 0.15, 0.79))
    cupula = torneado("abajur-cupula", a.luz("mesa-escritorio-abajur", "#2E7A4A", 2.0), [(0.0, 0.0), (0.05, 0.0), (0.06, 0.07), (0, 0.07)], lados=32)
    cupula.scale = (2.6, 1.0, 1.0)
    cupula.location = (-0.55, 0.15, 1.02)
    for i in range(6):
        caixa(f"papel-{i}", a.pintado("mesa-escritorio-papel", "#F4F1EA"), (0.21, 0.297, 0.002), pos=(0.2 + 0.01 * i, -0.05, 0.792 + 0.002 * i),
              giro=(0, 0, 4 * i - 8))
    torneado("tinteiro", a.vidro("mesa-escritorio-tinteiro", "#101820"), [(0, 0), (0.04, 0), (0.04, 0.05), (0.015, 0.06), (0, 0.06)],
             lados=32, pos=(0.55, 0.2, 0.79))
    barra("pena", a.pintado("mesa-escritorio-pena", "#F2EEE6"), (0.55, 0.2, 0.84), (0.6, 0.15, 1.0), 0.006, 8)


@peca("espelho-triplo", "Espelho triplo de provador com molduras douradas", "piso", ("closet",))
def espelho_triplo() -> None:
    ouro, espelho = a.dourado("espelho-triplo", "#C9A24A"), a.cromo("espelho-triplo-vidro")
    perfil = [(0, 0), (0.05, 0), (0.06, 0.015), (0.04, 0.03), (0.02, 0.035), (0, 0.03)]
    for i, (x, g) in enumerate(((-0.62, -30), (0, 0), (0.62, 30))):
        h = 1.9 if i == 1 else 1.75
        moldura = varrer(f"moldura-{i}", ouro, perfil, [(-0.28, 0, 0.1), (-0.28, 0, h), (0.28, 0, h), (0.28, 0, 0.1)], fechado=True, normal=(0, -1, 0))
        vidro = caixa(f"vidro-{i}", espelho, (0.54, 0.01, h - 0.1), pos=(0, 0.01, (h + 0.1) / 2))
        for o in (moldura, vidro):
            o.rotation_euler[2] = math.radians(g)
            o.location = (x, 0.18 * abs(g) / 30, 0)
    caixa("base", a.pintado("espelho-triplo-base", "#F2EDE2"), (1.8, 0.4, 0.08), pos=(0, 0.1, 0.04), chanfro=0.015, seg=3)


@peca("manequim-vestido", "Manequim de costura com vestido de festa", "piso", ("closet",))
def manequim_vestido() -> None:
    from ..formas import instancia as copia

    for p in _manequim("#E8DCC8"):
        copia(p, (0, 0, 0))
    vestido = roupa("vestido", a.veludo("manequim-vestido", "#7A1028"), altura=1.0, ombro=0.34, barra_larg=0.9, pregas=14)
    vestido.location = (0, 0, 0.45)


@peca("estante-partitura", "Estante de partitura com folhas abertas", "piso", ("salao-baile",))
def estante_partitura() -> None:
    latao, papel = a.latao_velho("estante-partitura"), a.pintado("estante-partitura-papel", "#F2ECDC")
    for i in range(3):
        g = math.radians(120 * i)
        barra(f"pe-{i}", latao, (0, 0, 0.5), (0.3 * math.cos(g), 0.3 * math.sin(g), 0), 0.01, 12)
    cilindro("haste", latao, 0.012, 0.7, pos=(0, 0, 0.85), lados=16)
    caixa("suporte", latao, (0.5, 0.01, 0.32), pos=(0, -0.02, 1.32), giro=(-15, 0, 0), chanfro=0.004, seg=2)
    for s in (-1, 1):
        caixa(f"folha-{s}", papel, (0.22, 0.003, 0.3), pos=(s * 0.115, -0.04, 1.34), giro=(-15, 0, s * 6))
