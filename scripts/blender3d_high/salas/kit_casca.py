"""Casca das salas do Fashion Detective em alta densidade: piso com textura e oclusão assada, três paredes com lambri
de almofadas, moldura de cadeira, rodapé e sanca em perfil, quadros de moldura no alto e arandelas. Mesmas medidas da
sala procedural (components/flair/detetive/sala-3d.tsx): 9,6 × 7,4 m, pé-direito 3,4 m, frente aberta para a câmera.
"""
from __future__ import annotations

from dataclasses import dataclass

from scripts.blender3d.core import caixa, cilindro, esfera, torneado

from ..formas import esconder_modelo, instancia, jogo, varrer
from ..materiais import material
from ..render import luz_area

LARGURA, FUNDO, ALTURA = 9.6, 7.4, 3.4
#: face de dentro das paredes (espaço do jogo)
FUNDO_Z = -FUNDO / 2 + 0.06
LADO_X = LARGURA / 2 - 0.06

RODAPE = [(0, 0), (0.018, 0), (0.018, 0.1), (0.012, 0.115), (0.014, 0.13), (0.006, 0.145), (0, 0.145)]
SANCA = [(0, -0.16), (0.02, -0.15), (0.03, -0.12), (0.07, -0.08), (0.1, -0.03), (0.12, 0), (0, 0)]
CADEIRA = [(0, -0.03), (0.012, -0.03), (0.022, -0.015), (0.024, 0), (0.022, 0.015), (0.012, 0.03), (0, 0.03)]
FRISO = [(-0.03, 0), (-0.028, 0.008), (-0.015, 0.016), (0, 0.02), (0.015, 0.012), (0.03, 0.004), (0.035, 0)]


@dataclass(frozen=True)
class Estilo:
    piso: str
    textura_piso: str
    parede: str
    detalhe: str
    lambri: str
    repete_piso: float = 1.0


def _ao_longo(z_ou_x: str, de: float, ate: float, altura: float, recuo: float = 0.0) -> list:
    """Pontos rente a uma parede: ``"fundo"`` corre em x no fundo; ``"esq"``/``"dir"`` correm em z nas laterais."""
    if z_ou_x == "fundo":
        return [jogo(x, altura, FUNDO_Z + recuo) for x in (de, ate)]
    s = -1 if z_ou_x == "esq" else 1
    return [jogo(s * (LADO_X - recuo), altura, z) for z in (de, ate)]


def _perfis_corridos(perfil, altura: float, mat, nome: str) -> None:
    """Rodapé, moldura de cadeira ou sanca nas três paredes, com meia-esquadria nas duas quinas do fundo."""
    caminho = [jogo(-LADO_X, altura, FUNDO / 2), jogo(-LADO_X, altura, FUNDO_Z), jogo(LADO_X, altura, FUNDO_Z),
               jogo(LADO_X, altura, FUNDO / 2)]
    varrer(nome, mat, perfil, caminho)


def _painel(nome: str, mat, moldura, largura: float, altura: float) -> tuple:
    """Almofada (painel com chanfro) e a moldura em volta, deitadas no plano da parede do fundo (modelo das cópias)."""
    almofada = caixa(nome, mat, (largura, 0.03, altura), chanfro=0.014, seg=3)
    l, a = largura / 2 + 0.03, altura / 2 + 0.03
    quadro = varrer(f"{nome}-moldura", moldura, FRISO, [(-l, 0, -a), (l, 0, -a), (l, 0, a), (-l, 0, a)], fechado=True,
                    normal=(0, -1, 0))
    return almofada, quadro


def _parede(nome: str, mat, comprimento: float, centro: tuple[float, float], giro: float) -> None:
    x, z = centro
    caixa(nome, mat, (comprimento, 0.12, ALTURA), pos=jogo(x, ALTURA / 2, z), giro=(0, 0, giro))


def casca(e: Estilo, painel_alto: bool = True, sem_quadro: tuple[tuple[int, float], ...] = ()) -> None:
    """``sem_quadro``: (lado, z) dos quadros altos que não entram (onde a sala põe janela)."""
    piso = material("piso", e.piso, e.textura_piso, aspereza=0.35, repete=e.repete_piso)
    parede = material("parede", e.parede, "tecido" if e.textura_piso != "concreto" else "concreto", aspereza=0.85, repete=0.5)
    lambri = material("lambri", e.lambri, "laca", aspereza=0.32, verniz=0.4)
    detalhe = material("detalhe", e.detalhe, metal=0.85, aspereza=0.3)
    caixa("piso", piso, (LARGURA, FUNDO, 0.04), pos=jogo(0, -0.02, 0))
    _parede("parede-fundo", parede, LARGURA, (0, -FUNDO / 2), 0)
    _parede("parede-esq", parede, FUNDO, (-LARGURA / 2, 0), 90)
    _parede("parede-dir", parede, FUNDO, (LARGURA / 2, 0), 90)
    _perfis_corridos(RODAPE, 0.0, lambri, "rodape")
    _perfis_corridos(CADEIRA, 0.95, detalhe, "moldura-cadeira")
    _perfis_corridos(SANCA, ALTURA, lambri, "sanca")
    baixo, moldura_b = _painel("almofada", lambri, detalhe, 0.78, 0.6)
    alto, moldura_a = _painel("quadro", lambri, detalhe, 1.1, 1.5) if painel_alto else (None, None)
    for modelo in (baixo, moldura_b, alto, moldura_a):
        if modelo:
            esconder_modelo(modelo)
    # fundo: 10 almofadas no lambri e 6 quadros altos; laterais: 8 almofadas e 5 quadros de cada lado
    for i in range(10):
        x = -4.2 + i * 0.933
        for m in (baixo, moldura_b):
            instancia(m, jogo(x, 0.52, FUNDO_Z + 0.015), 0)
    for lado in (-1, 1):
        for i in range(7):
            z = -3.0 + i * 0.95
            for m in (baixo, moldura_b):
                instancia(m, jogo(lado * (LADO_X - 0.015), 0.52, z), -lado * 90)
    if alto:
        for x in (-3.6, -2.2, 2.2, 3.6):
            for m in (alto, moldura_a):
                instancia(m, jogo(x, 2.1, FUNDO_Z + 0.015), 0)
        for lado in (-1, 1):
            for z in (-2.4, -0.6, 1.2, 2.9):
                if (lado, z) in sem_quadro:
                    continue
                for m in (alto, moldura_a):
                    instancia(m, jogo(lado * (LADO_X - 0.015), 2.1, z), -lado * 90)


def arandelas(cor: str, posicoes: list[tuple[float, float, float, float]]) -> None:
    """Arandela de latão com cúpula de tecido acesa: (x, y, z, giro) no espaço do jogo; uma malha, várias cópias."""
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    cupula = material("cupula", cor, emissao=2.5)
    base = torneado("arandela-base", latao, [(0, 0), (0.06, 0), (0.06, 0.012), (0.03, 0.02), (0, 0.02)], lados=24,
                    giro=(90, 0, 0))
    braco = cilindro("arandela-braco", latao, 0.008, 0.16, pos=(0, -0.09, 0.02), giro=(90, 0, 0), lados=10)
    abaj = torneado("arandela-cupula", cupula, [(0.07, 0), (0.07, 0.004), (0.045, 0.15), (0.044, 0.152)], lados=28,
                    pos=(0, -0.17, -0.02))
    bola = esfera("arandela-pingente", latao, 0.012, (0, -0.17, -0.04), lados=12)
    for peca in (base, braco, abaj, bola):
        esconder_modelo(peca)
        for x, y, z, giro in posicoes:
            instancia(peca, jogo(x, y, z), giro)


def luz_de_prova(cor=(1, 0.93, 0.85)) -> None:
    """As luzes da foto no Cycles (o jogo tem as próprias): duas áreas grandes e uma de preenchimento pela frente."""
    luz_area("teto-1", (-2, 3.3, 0), (-2, 0, 0), 450, 2.5, cor)
    luz_area("teto-2", (2, 3.3, 0), (2, 0, 0), 450, 2.5, cor)
    luz_area("frente", (0, 2.6, 6), (0, 1, 0), 300, 3, cor)
