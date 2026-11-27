"""Texturas geradas pelo próprio motor (numpy, que vem com o Blender): pequenas, repetíveis e já tingidas com a cor.

Cada textura é um mapa de cor de 128 px que se repete sem emenda (as ondas usam frequências inteiras). O mapeamento do
objeto está em metros (core._mapear), e ``REPETE_A_CADA`` diz de quantos em quantos metros o desenho se repete.
"""
from __future__ import annotations

import bpy
import numpy as np

LADO = 128
REPETE_A_CADA = 0.5
_imagens: dict[tuple[str, tuple[float, float, float]], bpy.types.Image] = {}


def _ruido(semente: int, frequencias: tuple[int, ...], eixo_longo: bool) -> np.ndarray:
    """Soma de ondas com fase aleatória; com ``eixo_longo`` as ondas quase não variam ao longo de v (veio, escovado)."""
    sorteio = np.random.default_rng(semente)
    u, v = np.meshgrid(np.arange(LADO) / LADO, np.arange(LADO) / LADO)
    campo = np.zeros((LADO, LADO))
    for f in frequencias:
        fv = sorteio.integers(0, 2) if eixo_longo else f
        campo += np.sin(2 * np.pi * (f * u + fv * v) + sorteio.uniform(0, 2 * np.pi)) / f ** 0.5
    return campo / np.abs(campo).max()


def _desenho(tipo: str) -> np.ndarray:
    """Variação de claro e escuro em torno de 1.0 (multiplica a cor)."""
    if tipo == "madeira":                                  # veio comprido, com um ou outro anel mais escuro
        veio = _ruido(7, (3, 5, 9, 14, 23, 37), eixo_longo=True)
        return 1.0 + 0.16 * veio - 0.08 * (veio > 0.55)
    if tipo == "tecido":                                   # trama: fios cruzados
        u, v = np.meshgrid(np.arange(LADO), np.arange(LADO))
        trama = np.sin(u * np.pi / 2) * np.sin(v * np.pi / 2)
        return 1.0 + 0.1 * trama + 0.04 * _ruido(11, (2, 3, 5), eixo_longo=False)
    if tipo == "escovado":                                 # riscos finos numa direção
        return 1.0 + 0.07 * _ruido(19, (17, 29, 41, 53, 61), eixo_longo=True)
    if tipo == "borracha":                                 # fosco, levemente manchado
        return 1.0 + 0.09 * _ruido(23, (2, 3, 5, 8), eixo_longo=False)
    raise ValueError(f"textura desconhecida: {tipo}")


def imagem(tipo: str, cor: tuple[float, float, float]) -> bpy.types.Image:
    """Mapa de cor da textura já tingido (um por tipo e cor na receita). ``cor`` em sRGB, de 0 a 1."""
    chave = (tipo, tuple(round(c, 4) for c in cor))
    if chave in _imagens:
        return _imagens[chave]
    desenho = _desenho(tipo)
    pixels = np.ones((LADO, LADO, 4), dtype=np.float32)
    for canal in range(3):
        pixels[:, :, canal] = np.clip(cor[canal] * desenho, 0, 1)
    img = bpy.data.images.new(f"{tipo}-{len(_imagens)}", LADO, LADO, alpha=False)   # espaço de cor padrão: sRGB
    img.pixels = pixels.ravel()
    img.pack()
    _imagens[chave] = img
    return img


def limpar() -> None:
    _imagens.clear()
