"""Desenhos dos materiais de piso, parede e teto do kit da mansão (numpy): cada um devolve, para uma repetição que
fecha sem emenda, o campo de altura (0 a 1, que vira a malha de alta densidade assada no Blender), a cor (sRGB) e a
aspereza. O relevo e a oclusão saem do bake (kit/materiais.py), não daqui.
"""
from __future__ import annotations

import numpy as np

from ..pbr import ruido

LADO = 1024


def _r(semente: int, expoente: float, esticar: tuple[float, float] = (1, 1)) -> np.ndarray:
    return ruido(semente, expoente, esticar, LADO)


def _uv(lado: int = LADO) -> tuple[np.ndarray, np.ndarray]:
    return np.meshgrid((np.arange(lado) + 0.5) / lado, (np.arange(lado) + 0.5) / lado)


def _hex(cor: str) -> np.ndarray:
    return np.array([int(cor.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def _misturar(a: str, b: str, t: np.ndarray) -> np.ndarray:
    return _hex(a) * (1 - t[..., None]) + _hex(b) * t[..., None]


def _sulco(d: np.ndarray, largura: float) -> np.ndarray:
    """1 longe da junta, descendo suave até 0 nela (d = distância à junta, na unidade do desenho)."""
    return np.clip(d / largura, 0, 1) ** 0.6


def _hash(*inteiros: np.ndarray) -> np.ndarray:
    h = np.zeros_like(inteiros[0], dtype=np.int64)
    for k, i in enumerate(inteiros):
        h = h * 73856093 ^ (i.astype(np.int64) * (19349663 + 1000003 * k))
    return (h % 9973) / 9973.0


def espinha(madeira: str = "#7A4A2A", clara: str = "#A8744A", k: int = 4):
    """Parquet espinha-de-peixe (tábuas de k × 1, em degrau): a repetição tem 2k larguras de tábua."""
    u, v = _uv()
    x, y = u * 2 * k, v * 2 * k
    i, j = np.floor(x), np.floor(y)
    d = np.mod(i - j, 2 * k)
    horizontal = d < k
    x0 = np.where(horizontal, i - d, i)                       # início da tábua (na direção dela)
    y0 = np.where(horizontal, j, j + (d - k))                 # a tábua vertical desce k células
    ao_longo = np.where(horizontal, x - x0, y - (j - (2 * k - 1 - d)))
    atraves = np.where(horizontal, y - j, x - i)
    borda = np.minimum(np.minimum(atraves, 1 - atraves), np.minimum(ao_longo, k - ao_longo) / 1.0)
    tom = _hash(x0, y0, horizontal)
    veio = np.where(horizontal, _r(41, 1.3, esticar=(1, 14)), _r(43, 1.3, esticar=(14, 1)))
    cor = _misturar(madeira, clara, np.clip(0.1 + 0.8 * tom + 0.25 * (veio - 0.5), 0, 1))
    altura = 0.92 + 0.08 * veio
    altura = altura * _sulco(borda, 0.04)
    return altura, cor, np.clip(0.38 + 0.12 * (1 - veio) - 0.08 * tom, 0.2, 0.7)


def _veios(semente: int, forca: float = 1.0) -> np.ndarray:
    u, v = _uv()
    veia = np.abs(np.sin(3 * np.pi * (u + 0.6 * v) + 9 * _r(semente, 1.5)))
    return np.clip(1 - veia / 0.12, 0, 1) ** 1.5 * (0.3 + 0.7 * _r(semente + 1, 1.2)) * forca


def marmore_xadrez(claro: str = "#ECE8E0", escuro: str = "#1C1B1F"):
    """Mármore em xadrez (2 × 2 placas por repetição): Carrara de veios cinza e Nero Marquina de veios brancos."""
    u, v = _uv()
    casa = (np.floor(u * 2) + np.floor(v * 2)) % 2
    junta = np.minimum(np.abs(((u * 2) % 1) - 0.5), np.abs(((v * 2) % 1) - 0.5))
    junta = 0.5 - junta
    veio_claro, veio_escuro = _veios(51), _veios(57, 0.8)
    branco = _misturar(claro, "#9A9AA0", veio_claro * 0.8)
    preto = _misturar(escuro, "#E8E6E0", veio_escuro * 0.7)
    cor = np.where(casa[..., None] > 0.5, preto, branco)
    cor = cor * (0.6 + 0.4 * _sulco(junta, 0.006))[..., None]
    return _sulco(junta, 0.008) * (0.98 + 0.02 * _r(59, 2)), cor, np.clip(0.1 + 0.08 * _r(61, 1.5), 0.05, 0.3)


def porcelanato(cor_base: str = "#D9D2C6"):
    """Porcelanato polido de placas grandes (2 × 2 por repetição), nuvem suave e rejunte fino."""
    u, v = _uv()
    junta = 0.5 - np.minimum(np.abs(((u * 2) % 1) - 0.5), np.abs(((v * 2) % 1) - 0.5))
    nuvem = _r(63, 2.2)
    cor = _misturar(cor_base, "#BDB4A6", nuvem * 0.6 + _veios(65, 0.3) * 0.4) * (0.7 + 0.3 * _sulco(junta, 0.004))[..., None]
    return _sulco(junta, 0.005), cor, np.clip(0.08 + 0.05 * nuvem, 0.05, 0.2)


def carpete(fundo: str = "#5A1424", desenho: str = "#C9A24A", borda: str = "#2A0A12"):
    """Carpete de lã com padrão de treliça e medalhão (um medalhão por repetição) e fibra."""
    u, v = _uv()
    cu, cv = u - 0.5, v - 0.5
    r = np.hypot(cu, cv)
    a = np.arctan2(cv, cu)
    trelica = np.abs(np.sin(np.pi * (u + v) * 4)) < 0.06
    trelica |= np.abs(np.sin(np.pi * (u - v) * 4)) < 0.06
    medalhao = (np.abs(r - 0.18 - 0.03 * np.cos(8 * a)) < 0.015) | (r < 0.06 + 0.02 * np.cos(6 * a))
    fibra = _r(67, 0.15)
    cor = np.where((trelica | medalhao)[..., None], _hex(desenho), _hex(fundo))
    cor = np.where((np.abs(r - 0.24) < 0.008)[..., None], _hex(borda), cor) * (0.85 + 0.3 * fibra)[..., None]
    altura = 0.8 + 0.2 * fibra - 0.15 * (trelica | medalhao)
    return altura, cor, np.full(fibra.shape, 0.92)


def boiserie(pintura: str = "#E8E0D0", moldura: str = "#D8CDB8"):
    """Boiserie (painel de madeira pintada): uma almofada por repetição, com quadro, chanfro e almofada saltada."""
    u, v = _uv()
    d = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
    quadro = np.clip((d - 0.06) / 0.02, 0, 1)                 # degrau do quadro para dentro
    chanfro = np.clip((d - 0.1) / 0.06, 0, 1)                 # a rampa da almofada
    altura = 1 - 0.35 * quadro + 0.25 * chanfro - 0.05 * (np.abs(d - 0.06) < 0.006)
    cor = _misturar(pintura, moldura, 1 - quadro) * (0.96 + 0.06 * _r(71, 1.0))[..., None]
    return np.clip(altura, 0, 1), cor, np.clip(0.45 + 0.05 * _r(73, 1.0), 0.3, 0.6)


def nogueira_painel():
    """Boiserie de nogueira envernizada (mesmo relevo, cor de madeira com veio vertical)."""
    altura, _cor, _a = boiserie()
    veio = _r(77, 1.3, esticar=(14, 1))
    cor = _misturar("#3E2414", "#6E4426", np.clip(0.3 + 0.6 * veio, 0, 1))
    return altura, cor, np.clip(0.28 + 0.1 * veio, 0.15, 0.5)


def damasco(fundo: str = "#5C1A2A", motivo: str = "#7A2838"):
    """Papel de parede damasco: motivo simétrico em losango (dois por repetição), acetinado no desenho."""
    u, v = _uv()
    def flor(cu, cv):
        cu, cv = cu * 0.7, cv * 0.7
        r = np.hypot(cu * 1.4, cv)
        a = np.arctan2(cv, cu * 1.4)
        return (r < 0.16 * (0.6 + 0.4 * np.abs(np.cos(3 * a))) + 0.03 * np.cos(9 * a)) & (r > 0.02)
    m = flor(u - 0.5, v - 0.5) | flor(u % 1 - 0.0, v - 0.0) | flor(u - 1, v) | flor(u, v - 1) | flor(u - 1, v - 1)
    m |= flor(np.abs(u - 0.5) - 0.5, np.abs(v - 0.5) - 0.5)
    cor = np.where(m[..., None], _hex(motivo), _hex(fundo)) * (0.95 + 0.08 * _r(79, 0.4))[..., None]
    return 0.9 + 0.1 * m, cor, np.where(m, 0.35, 0.8)


def estuque(cor_base: str = "#D8CCB4"):
    """Estuque veneziano: manchas de espátula, relevo baixo e brilho irregular."""
    manchas = _r(81, 1.9)
    riscos = _r(83, 0.9, esticar=(3, 1))
    cor = _misturar(cor_base, "#B8A888", np.clip(manchas * 0.7 + riscos * 0.3, 0, 1))
    return 0.7 + 0.2 * manchas + 0.1 * riscos, cor, np.clip(0.25 + 0.4 * riscos, 0.15, 0.7)


def gesso(cor_base: str = "#F2EEE6"):
    """Teto de gesso liso com textura fina de rolo."""
    fino = _r(87, 0.5)
    return 0.9 + 0.1 * fino, _misturar(cor_base, "#E0DAD0", fino * 0.5), np.full(fino.shape, 0.88)


def caixotoes(madeira: str = "#4A2C18", fundo: str = "#E8E0D0"):
    """Teto de caixotões (um por repetição): vigas de madeira, degraus de moldura e o fundo de gesso."""
    u, v = _uv()
    d = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v))
    viga = d < 0.08
    degraus = np.clip((d - 0.08) / 0.1, 0, 1)
    altura = np.where(viga, 1.0, 1 - 0.5 * np.round(degraus * 3) / 3 - 0.2)
    veio = _r(89, 1.3, esticar=(1, 12))
    cor = np.where((d < 0.18)[..., None], _misturar(madeira, "#6A4428", veio), _hex(fundo) * (0.95 + 0.05 * veio)[..., None])
    return np.clip(altura, 0, 1), cor, np.where(d < 0.18, 0.35, 0.85)
