"""Opções comuns: --dry-run, --verbose e o cabeçalho com o destino (sem segredos)."""
from __future__ import annotations

import argparse

from db import IMPORT_VERSION, describe_target


def parser(description: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--dry-run", action="store_true", help="valida, normaliza e detecta duplicatas sem alterar o banco")
    p.add_argument("--verbose", action="store_true", help="mostra também itens sem mudança e decisões de dedup")
    return p


def banner(title: str, dry_run: bool):
    print(f"{title} [{IMPORT_VERSION}] → {describe_target()}{'  [DRY-RUN: nada será gravado]' if dry_run else ''}", flush=True)
