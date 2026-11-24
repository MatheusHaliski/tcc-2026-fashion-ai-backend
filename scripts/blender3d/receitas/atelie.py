"""Ateliê: bancada de trabalho com as amostras e os rolos de tecido."""
from __future__ import annotations

from ..core import barra, caixa, cilindro, esfera, material, toro
from . import receita, variantes


@variantes("bancada", "Bancada de ateliê de {largura} m", {str(round(l * 10)): {"largura": l} for l in (2.0, 2.2, 2.4)}, movel="bancada")
def _bancada(largura: float) -> None:
    madeira = material("carvalho", "#B98F5A", aspereza=0.6, papel="madeira", textura="madeira")
    metal = material("aco", "#3A3D42", metal=1.0, aspereza=0.4, papel="metal", textura="escovado")
    amostras = material("amostras", "#C6275E", aspereza=0.85, papel="amostras", textura="tecido")
    meia = largura / 2
    caixa("tampo", madeira, (largura, 0.8, 0.06), (0, 0, 0.89), chanfro=0.012)
    caixa("prateleira", madeira, (largura - 0.2, 0.66, 0.03), (0, 0, 0.3), chanfro=0.008)
    for x in (-meia + 0.08, meia - 0.08):
        for y in (-0.3, 0.3):
            caixa("pe", metal, (0.05, 0.05, 0.84), (x, y, 0.44), chanfro=0.006, seg=1)
            cilindro("sapata", metal, 0.03, 0.02, (x, y, 0.01), lados=8)
        caixa("travessa-lado", metal, (0.04, 0.6, 0.04), (x, 0, 0.82))
        caixa("apoio-prateleira", metal, (0.04, 0.6, 0.03), (x, 0, 0.27))
    for y in (-0.3, 0.3):
        caixa("longarina", metal, (largura - 0.16, 0.04, 0.04), (0, y, 0.82))
    caixa("gaveta", madeira, (0.6, 0.7, 0.12), (-meia + 0.5, -0.02, 0.76), chanfro=0.006, seg=1)
    barra("puxador", metal, (-meia + 0.36, -0.385, 0.76), (-meia + 0.64, -0.385, 0.76), 0.008, 6)
    for i in range(5):                                                   # as amostras de tecido abertas em leque
        caixa("amostra", amostras, (0.2, 0.3, 0.012), (-0.5 + i * 0.13, -0.08, 0.93 + i * 0.004), giro=(0, 0, -16 + i * 8), chanfro=0.004, seg=1)
    caixa("caixa-de-amostras", amostras, (0.36, 0.26, 0.1), (0.62, 0.12, 0.97), chanfro=0.012)
    toro("fita-metrica", metal, 0.045, 0.014, (0.2, -0.2, 0.934), lados=12, lados_tubo=4, achatado=0.5)
    esfera("alfineteiro", amostras, 0.045, (0.34, 0.2, 0.94), escala=(1, 1, 0.7), lados=10)
    for dx, dy in ((0.01, 0.012), (-0.015, 0.0), (0.004, -0.014)):
        barra("alfinete", metal, (0.34 + dx, 0.2 + dy, 0.96), (0.34 + 2.5 * dx, 0.2 + 2.5 * dy, 1.01), 0.002, 4)


def _rolo(nome: str, tecido, miolo, raio: float, altura: float, pos, giro) -> None:
    cilindro(nome, tecido, raio, altura, pos, giro=giro, lados=18, chanfro=0.012)
    cilindro(f"{nome}-volta", tecido, raio * 0.72, altura + 0.012, pos, giro=giro, lados=14)
    cilindro(f"{nome}-miolo", miolo, 0.03, altura + 0.1, pos, giro=giro, lados=8)


@receita("rolos-de-tecido", "Rolos de tecido: dois em pé e um deitado", movel="rolosDeTecido")
def rolos_de_tecido() -> None:
    tecido_a = material("tecido-a", "#7A2E46", aspereza=0.9, papel="tecidoA", textura="tecido")
    tecido_b = material("tecido-b", "#2F5D8A", aspereza=0.9, papel="tecidoB", textura="tecido")
    miolo = material("papelao", "#B79A6B", aspereza=0.8, papel="miolo")
    _rolo("rolo-alto", tecido_a, miolo, 0.11, 1.45, (0, 0, 0.74), (0, -6, 0))
    _rolo("rolo-medio", tecido_b, miolo, 0.09, 1.3, (0.26, -0.04, 0.66), (0, 5, 0))
    _rolo("rolo-deitado", tecido_b, miolo, 0.1, 1.2, (0.2, -0.42, 0.1), (0, 90, 0))
    caixa("ponta-solta", tecido_b, (1.1, 0.16, 0.006), (0.2, -0.56, 0.004), chanfro=0.002, seg=1)   # a ponta desenrolada
    caixa("ponta-pendurada", tecido_a, (0.008, 0.2, 0.5), (0.118, 0, 1.1), giro=(0, -6, 0), chanfro=0.003, seg=1)
