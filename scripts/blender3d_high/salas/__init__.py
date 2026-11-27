"""Catálogo das salas high poly: cada sala modela a casca e os móveis-herói no espaço do jogo e diz quais modelos
prontos (os GLB do MET Gala Heist, gerados pela Meshy) entram nela, onde e com que altura."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

V3 = tuple[float, float, float]


@dataclass(frozen=True)
class Importado:
    """Modelo pronto posto na sala pelo carregador (o arquivo não é copiado: o manifesto aponta para ele)."""
    modelo: str
    pos: V3
    giro: float = 0.0
    altura: float = 1.0


@dataclass(frozen=True)
class SalaHigh:
    slug: str
    titulo: str
    #: família do orçamento (perfil.ORCAMENTO)
    familia: str
    modelar: Callable[[], None]
    #: câmera da prova renderizada, no espaço do jogo: posição e alvo
    camera: tuple[V3, V3]
    #: de onde o mapa de ambiente é capturado (espaço do jogo)
    ambiente: V3 = (0, 1.6, 0)
    importados: tuple[Importado, ...] = ()
    #: objetos da casca que recebem a oclusão assada com a sala inteira
    assar: tuple[str, ...] = ()
    #: objetos-herói cujo médio leva o relevo do alto assado (mapa normal)
    relevo: tuple[str, ...] = ()
    jogos: tuple[str, ...] = field(default_factory=tuple)


SALAS: dict[str, SalaHigh] = {}


def sala(**dados) -> Callable[[Callable[[], None]], Callable[[], None]]:
    def registrar(modelar: Callable[[], None]) -> Callable[[], None]:
        if dados["slug"] in SALAS:
            raise ValueError(f"sala repetida: {dados['slug']}")
        SALAS[dados["slug"]] = SalaHigh(modelar=modelar, **dados)
        return modelar
    return registrar


def carregar() -> dict[str, SalaHigh]:
    from . import detetive_a, detetive_b, detetive_c, passarela  # noqa: F401
    return SALAS
