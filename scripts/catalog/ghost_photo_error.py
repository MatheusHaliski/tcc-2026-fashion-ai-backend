"""Erro de processamento que determina o status da foto no lote."""

from typing import Optional


class PhotoSkip(Exception):
    """Foto que não gera packshot: `status` (REJECTED, REVIEW, INELIGIBLE, RETRY) e motivo curto em maiúsculas."""

    def __init__(self, reason: str, status: str = "REVIEW", metrics: Optional[dict] = None):
        super().__init__(reason)
        self.status, self.metrics = status, metrics or {}
