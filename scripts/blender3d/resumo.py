"""Resumo (hash) do motor: amarra cada ``.glb`` publicado ao código que o gerou. Não depende do Blender.

O manifesto guarda o resumo em cada objeto gerado; o teste das salas (lib/flair/nucleos/scene/assets.test.ts) refaz a
conta e falha se uma receita mudou e os arquivos não foram gerados de novo.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

PASTA = Path(__file__).resolve().parent
#: o que não muda o arquivo gerado fica fora da conta
FORA = {"preview.py"}


def arquivos_do_motor() -> list[Path]:
    return sorted(p for p in PASTA.rglob("*.py") if "tests" not in p.parts and "__pycache__" not in p.parts and p.name not in FORA)


def resumo_do_motor() -> str:
    conta = hashlib.sha256()
    for arquivo in arquivos_do_motor():
        conta.update(arquivo.relative_to(PASTA).as_posix().encode())
        conta.update(arquivo.read_bytes())
    return conta.hexdigest()[:16]
