"""Objetos de rua, quadra e box: caixote, tambor, pilha de pneus, trave e skate."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, duplicar, material, toro, torneado
from . import receita


@receita("caixote", "Caixote de madeira ripado", movel="caixote")
def caixote() -> None:
    madeira = material("pinho", "#B98F5A", aspereza=0.8)
    escura = material("pinho-escuro", "#8B6538", aspereza=0.85)
    prego = material("prego", "#5A5D62", metal=1.0, aspereza=0.5)
    lado, meio = 0.7, 0.35
    for x in (-1, 1):
        for y in (-1, 1):
            caixa("montante", escura, (0.06, 0.06, lado), (x * (meio - 0.03), y * (meio - 0.03), meio), chanfro=0.006)
    for i in range(5):                                                   # ripas com fresta nos quatro lados
        z = 0.07 + i * 0.14
        for y in (-1, 1):
            caixa("ripa", madeira, (lado, 0.018, 0.115), (0, y * (meio + 0.004), z), chanfro=0.005, seg=1)
        for x in (-1, 1):
            caixa("ripa-lado", madeira, (0.018, lado, 0.115), (x * (meio + 0.004), 0, z), chanfro=0.005, seg=1)
    for i in range(5):
        caixa("tampa", madeira, (lado + 0.03, 0.125, 0.018), (0, -0.28 + i * 0.14, lado + 0.006), chanfro=0.005, seg=1)
    for y in (-1, 1):
        caixa("diagonal", escura, (lado * 0.86, 0.014, 0.07), (0, y * (meio + 0.02), meio), giro=(0, 42 * y, 0), chanfro=0.004)
    cabeca = cilindro("prego", prego, 0.008, 0.006, (-0.3, -0.28, lado + 0.016), lados=6)
    for i in range(5):
        for x in (-0.3, 0.3):
            if (i, x) != (0, -0.3):
                duplicar(cabeca, (x, -0.28 + i * 0.14, lado + 0.016))


@receita("tambor", "Tambor de aço", movel="tambor")
def tambor() -> None:
    lata = material("lata", "#1F5E7A", metal=0.7, aspereza=0.45)
    aro = material("aro", "#9AA0A6", metal=1.0, aspereza=0.35)
    perfil = [(0, 0), (0.28, 0), (0.29, 0.012), (0.29, 0.27)]
    for z in (0.3, 0.58):                                               # as duas nervuras roladas do corpo
        perfil += [(0.302, z - 0.012), (0.302, z + 0.012), (0.29, z + 0.03)]
    perfil += [(0.29, 0.862), (0.28, 0.88), (0.27, 0.865), (0, 0.865)]
    torneado("corpo", lata, perfil, lados=24)
    for z in (0.012, 0.874):
        toro("virola", aro, 0.288, 0.012, (0, 0, z), lados=24, lados_tubo=6)
    cilindro("bocal", aro, 0.035, 0.016, (0.15, 0.1, 0.873), lados=10, chanfro=0.003)
    cilindro("respiro", aro, 0.016, 0.012, (-0.17, -0.08, 0.871), lados=8)


def _pneu(nome: str, borracha, z: float, giro: float, desvio: tuple[float, float]) -> None:
    # seção do pneu: talão, flanco abaulado e a banda com três sulcos (os frisos é que dão leitura de pneu)
    perfil = [(0.15, -0.085), (0.2, -0.1), (0.3, -0.1), (0.332, -0.085), (0.345, -0.07), (0.345, -0.045), (0.336, -0.04),
              (0.336, -0.03), (0.345, -0.025), (0.345, -0.008), (0.336, -0.004), (0.336, 0.004), (0.345, 0.008),
              (0.345, 0.025), (0.336, 0.03), (0.336, 0.04), (0.345, 0.045), (0.345, 0.07), (0.332, 0.085), (0.3, 0.1),
              (0.2, 0.1), (0.15, 0.085), (0.165, 0.05), (0.165, -0.05), (0.15, -0.085)]
    torneado(nome, borracha, perfil, pos=(desvio[0], desvio[1], z), giro=(0, 0, giro), lados=14)
    for i in range(6):                                                  # gomos rasos no ombro do pneu
        a = math.radians(60 * i + giro)
        caixa("gomo", borracha, (0.03, 0.012, 0.03), (desvio[0] + 0.338 * math.cos(a), desvio[1] + 0.338 * math.sin(a), z + 0.078),
              giro=(0, 0, math.degrees(a)))


def _pilha(quantos: int) -> None:
    borracha = material("borracha", "#17171A", aspereza=0.85)
    desalinho = ((0, (0, 0)), (17, (0.015, -0.01)), (41, (-0.012, 0.014)), (8, (0.01, 0.008)))
    for i, (giro, desvio) in enumerate(desalinho[:quantos]):
        _pneu(f"pneu-{i}", borracha, 0.1 + i * 0.2, giro, desvio)


# as salas empilham 2, 3 ou 4 pneus: um arquivo por altura (a sala aponta o slug certo; a escala segue a altura)
for _quantos in (2, 3, 4):
    receita(f"pilha-de-pneus-{_quantos}", f"Pilha de {_quantos} pneus do box", movel="pilhaDePneus")(
        lambda quantos=_quantos: _pilha(quantos))


@receita("trave", "Trave de futebol de 5 com rede", movel="trave")
def trave() -> None:
    branco = material("trave", "#F4F4F0", metal=0.3, aspereza=0.35)
    rede = material("rede", "#E8ECEF", aspereza=0.9)
    for x in (-1.5, 1.5):
        cilindro("poste", branco, 0.04, 2.0, (x, 0, 1.0), lados=12)
        barra("esteio", branco, (x, 0, 2.0), (x, 0.9, 0.03), 0.02, 6)
        barra("pe", branco, (x, 0, 0.03), (x, 0.9, 0.03), 0.02, 6)
    barra("travessao", branco, (-1.54, 0, 2.0), (1.54, 0, 2.0), 0.04, 12)
    barra("fundo", branco, (-1.5, 0.9, 0.03), (1.5, 0.9, 0.03), 0.02, 6)
    for i in range(1, 12):                                              # a rede: fios de 4 lados, do travessão ao fundo
        x = -1.5 + i * 0.25
        barra("fio", rede, (x, 0, 2.0), (x, 0.9, 0.03), 0.004, 4)
    for i in range(1, 8):
        t = i / 8
        barra("fio-h", rede, (-1.5, 0.9 * t, 2.0 - 1.97 * t), (1.5, 0.9 * t, 2.0 - 1.97 * t), 0.004, 4)
        for x in (-1.5, 1.5):
            barra("fio-lado", rede, (x, 0, 2.0 - 1.97 * t), (x, 0.9 * t, 2.0 - 1.97 * t), 0.004, 4)


@receita("skate", "Skate de rua", movel="skate")
def skate() -> None:
    shape = material("shape", "#D9A066", aspereza=0.55)
    lixa = material("lixa", "#121214", aspereza=1.0)
    truck = material("truck", "#B4B8BD", metal=1.0, aspereza=0.3)
    roda = material("roda", "#F2EFE6", aspereza=0.4)
    caixa("deck", shape, (0.2, 0.56, 0.012), (0, 0, 0.09), chanfro=0.005)
    caixa("lixa", lixa, (0.196, 0.555, 0.002), (0, 0, 0.097))
    for y, giro in ((-0.34, -16), (0.34, 16)):                          # nose e tail levantados, colados ao deck
        caixa("ponta", shape, (0.2, 0.13, 0.012), (0, y, 0.108), giro=(giro, 0, 0), chanfro=0.005)
    for y in (-0.2, 0.2):
        caixa("base-truck", truck, (0.06, 0.08, 0.012), (0, y, 0.078), chanfro=0.003)
        torneado("pivo", truck, [(0, 0), (0.022, 0), (0.014, 0.03), (0, 0.03)], pos=(0, y, 0.045), lados=10)
        barra("eixo", truck, (-0.105, y, 0.03), (0.105, y, 0.03), 0.007, 8)
        for x in (-0.09, 0.09):
            cilindro("roda", roda, 0.028, 0.032, (x, y, 0.028), giro=(0, 90, 0), lados=14, chanfro=0.006)
