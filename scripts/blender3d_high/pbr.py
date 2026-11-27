"""Texturas PBR geradas pelo perfil high (numpy): cor, relevo (mapa normal) e aspereza, que se repetem sem emenda.

O desenho nasce de um campo de altura feito por ruído filtrado no espectro (FFT): o resultado é periódico, então a
textura se repete sem costura. O mapa normal sai do gradiente da altura; a aspereza, da própria altura. Cada conjunto
é guardado no arquivo (``pack``) e o exportador grava como WebP.
"""
from __future__ import annotations

import bpy
import numpy as np

LADO = 512
_conjuntos: dict[tuple, dict[str, bpy.types.Image]] = {}


def ruido(semente: int, expoente: float, esticar: tuple[float, float] = (1, 1), lado: int = LADO) -> np.ndarray:
    """Ruído periódico com espectro 1/f^expoente (maior = mais suave); ``esticar`` alonga num eixo (veio, escovado)."""
    sorteio = np.random.default_rng(semente)
    f = np.fft.fftfreq(lado)
    fu, fv = np.meshgrid(f * esticar[0], f * esticar[1])
    raio = np.sqrt(fu ** 2 + fv ** 2)
    raio[0, 0] = 1
    espectro = np.fft.fft2(sorteio.normal(size=(lado, lado))) / raio ** expoente
    espectro[0, 0] = 0
    campo = np.real(np.fft.ifft2(espectro))
    return (campo - campo.min()) / (np.ptp(campo) or 1)


def _altura(tipo: str) -> tuple[np.ndarray, float]:
    """Campo de altura (0 a 1) e a força do relevo de cada tipo."""
    u, v = np.meshgrid(np.arange(LADO) / LADO, np.arange(LADO) / LADO)
    if tipo == "veludo":
        return 0.6 * ruido(3, 1.2) + 0.4 * ruido(4, 0.5), 1.2
    if tipo == "laca":
        return ruido(5, 2.4), 0.4
    if tipo == "concreto":
        poros = (ruido(8, 0.3) > 0.82) * 0.4
        return 0.7 * ruido(7, 1.6) + 0.3 * ruido(9, 0.8) - poros, 2.5
    if tipo == "escovado":
        return ruido(11, 1.0, esticar=(1, 40)), 1.5
    if tipo == "madeira":
        veio = ruido(13, 1.4, esticar=(1, 12))
        tabuas = (np.abs(((v * 4) % 1) - 0.5) > 0.49) * -0.6        # quatro tábuas por repetição, com a junta
        return 0.8 * veio + tabuas, 3.0
    if tipo == "marmore":
        veia = np.abs(np.sin(2 * np.pi * (u + 0.5 * v) + 7 * ruido(17, 1.6)))     # veios finos e tortos
        veios = np.clip(1 - veia / 0.06, 0, 1) * (0.4 + 0.6 * ruido(31, 1.2))
        junta = (np.abs(((u * 2) % 1) - 0.5) > 0.496) | (np.abs(((v * 2) % 1) - 0.5) > 0.496)
        return 0.9 + 0.1 * ruido(37, 2.0) - 0.6 * veios - 0.5 * junta, 1.2
    if tipo == "tecido":
        trama = 0.5 + 0.25 * (np.sin(u * LADO * np.pi / 2) + np.sin(v * LADO * np.pi / 2))
        return 0.7 * trama + 0.3 * ruido(19, 1.0), 1.0
    if tipo == "carpete":
        return 0.5 * ruido(23, 0.2) + 0.5 * ruido(29, 1.3), 1.8
    raise ValueError(f"textura desconhecida: {tipo}")


def _cor(tipo: str, altura: np.ndarray, cor: tuple[float, float, float]) -> np.ndarray:
    variacao = {"veludo": 0.25, "laca": 0.02, "concreto": 0.35, "escovado": 0.08, "madeira": 0.45, "marmore": 0.0,
                "tecido": 0.18, "carpete": 0.3}[tipo]
    fator = 1 - variacao / 2 + variacao * altura
    rgb = np.stack([np.clip(c * fator, 0, 1) for c in cor], axis=-1)
    if tipo == "marmore":                                       # os veios cinza e a junta das placas
        rgb *= (0.55 + 0.45 * np.sqrt(altura))[..., None]
    return rgb


def _normal(altura: np.ndarray, forca: float) -> np.ndarray:
    du = (np.roll(altura, -1, axis=1) - np.roll(altura, 1, axis=1)) * forca
    dv = (np.roll(altura, -1, axis=0) - np.roll(altura, 1, axis=0)) * forca
    n = np.stack([-du, -dv, np.ones_like(altura)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def _imagem(nome: str, rgb: np.ndarray, dados: bool) -> bpy.types.Image:
    img = bpy.data.images.new(nome, LADO, LADO, alpha=False)
    if dados:
        img.colorspace_settings.name = "Non-Color"
    pixels = np.ones((LADO, LADO, 4), dtype=np.float32)
    pixels[..., :3] = rgb if rgb.ndim == 3 else rgb[..., None]
    img.pixels.foreach_set(pixels.ravel())
    img.pack()
    return img


def conjunto(tipo: str, cor: tuple[float, float, float], aspereza: float) -> dict[str, bpy.types.Image]:
    """As três imagens do tipo, tingidas com ``cor`` (sRGB 0 a 1) e com a aspereza média ``aspereza``."""
    chave = (tipo, tuple(round(c, 3) for c in cor), round(aspereza, 2))
    if chave not in _conjuntos:
        altura, forca = _altura(tipo)
        altura = (altura - altura.min()) / (np.ptp(altura) or 1)
        aspera = np.clip(aspereza + (altura - 0.5) * min(0.3, aspereza * 0.6), 0.02, 1)
        n = len(_conjuntos)
        _conjuntos[chave] = {"cor": _imagem(f"{tipo}-{n}-cor", _cor(tipo, altura, cor), False),
                             "normal": _imagem(f"{tipo}-{n}-normal", _normal(altura, forca), True),
                             "aspereza": _imagem(f"{tipo}-{n}-aspereza", np.repeat(aspera[..., None], 3, -1), True)}
    return _conjuntos[chave]


def limpar() -> None:
    _conjuntos.clear()
