"""Relatório da importação do catálogo (contadores e erros), a comparação de colunas que evita regravar e o logging
dos scripts de importação."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field


def same_value(column: str, current, new) -> bool:
    """design_json volta do MySQL reformatado (ordem e espaços): compara o JSON, não o texto — rodar de novo não regrava."""
    if column == "design_json" and current is not None:
        try:
            return json.loads(current) == json.loads(new)
        except (TypeError, ValueError):
            return False
    return current == new

@dataclass
class Report:
    total_read: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    duplicates_found: int = 0
    errors: int = 0
    error_details: list = field(default_factory=list)

    def as_dict(self):
        return {"total_read": self.total_read, "created": self.created, "updated": self.updated, "skipped": self.skipped,
                "duplicates_found": self.duplicates_found, "errors": self.errors}

    def print(self, title="Relatório"):
        print(f"\n{title}")
        for k, v in self.as_dict().items():
            print(f"  {k:<17} {v}")
        for e in self.error_details[:50]:
            print(f"  · {e}")


def setup_logging(verbose: bool):
    """INFO mostra [CREATE]/[UPDATE]/[DUP]/[ERROR]; --verbose acrescenta [SKIP] e as decisões de deduplicação."""
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, format="%(message)s")
