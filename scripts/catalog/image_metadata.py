"""Metadados das fotos oficiais: tipo, hash da URL (dedup), proveniência e status de uso."""
from __future__ import annotations

import hashlib

IMAGE_TYPES = {"FRONT", "BACK", "SIDE", "TOP", "DETAIL", "SOLE", "PACKSHOT", "OTHER"}


def image_type(raw: str | None) -> str:
    t = (raw or "PACKSHOT").strip().upper()
    return t if t in IMAGE_TYPES else "OTHER"


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def usage_status(allows_persistence: bool) -> str:
    return "PERSISTED" if allows_persistence else "REFERENCE_ONLY"
