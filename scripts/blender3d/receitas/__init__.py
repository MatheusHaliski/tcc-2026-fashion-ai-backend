"""Catálogo de receitas: cada receita modela um objeto no Blender e é registrada pelo slug do arquivo ``.glb``."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Receita:
    slug: str
    titulo: str
    modelar: Callable[[], None]
    #: tipo de móvel procedural das salas que o objeto substitui (lib/flair/nucleos/scene/moveis)
    movel: str | None = None
    #: códigos dos jogos em que serve; vazio = todos
    jogos: tuple[str, ...] = ()


RECEITAS: dict[str, Receita] = {}


def receita(slug: str, titulo: str, movel: str | None = None, jogos: tuple[str, ...] = ()):
    def registrar(modelar: Callable[[], None]) -> Callable[[], None]:
        if slug in RECEITAS:
            raise ValueError(f"receita repetida: {slug}")
        RECEITAS[slug] = Receita(slug, titulo, modelar, movel, jogos)
        return modelar
    return registrar


def variantes(base: str, titulo: str, opcoes: dict[str, dict], movel: str | None = None, jogos: tuple[str, ...] = ()):
    """Receita com medidas: registra ``<base>-<sufixo>`` para cada opção, chamando a função com os parâmetros dela.

    Serve ao que muda de tamanho por sala (largura, altura, número de módulos). O móvel aponta o slug da medida com
    ``comGlb(..., `<base>-${medida}`)``; a sala ajusta a escala pela altura, então a receita precisa das proporções.
    """
    def registrar(modelar: Callable[..., None]) -> Callable[..., None]:
        for sufixo, parametros in opcoes.items():
            receita(f"{base}-{sufixo}", titulo.format(**parametros), movel, jogos)(lambda p=parametros: modelar(**p))
        return modelar
    return registrar


def carregar() -> dict[str, Receita]:
    """Importa os módulos de receita (o registro acontece na importação) e devolve o catálogo."""
    from . import mobilia, palco, urbano  # noqa: F401
    return RECEITAS
