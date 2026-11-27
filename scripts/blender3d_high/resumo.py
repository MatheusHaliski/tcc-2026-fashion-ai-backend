"""Resumo (hash) do perfil high e das formas do motor que ele usa: amarra cada sala publicada ao código que a gerou."""
from __future__ import annotations

import hashlib
from pathlib import Path

PASTA = Path(__file__).resolve().parent
NUCLEO = PASTA.parent / "blender3d" / "core.py"
#: o que não muda o arquivo gerado fica fora da conta
FORA = {"folha.py"}


def arquivos() -> list[Path]:
    proprios = sorted(p for p in PASTA.rglob("*.py") if "tests" not in p.parts and "__pycache__" not in p.parts
                      and p.name not in FORA)
    return [*proprios, NUCLEO]


def resumo() -> str:
    conta = hashlib.sha256()
    for arquivo in arquivos():
        conta.update(arquivo.relative_to(PASTA.parent).as_posix().encode())
        conta.update(arquivo.read_bytes())
    return conta.hexdigest()[:16]
