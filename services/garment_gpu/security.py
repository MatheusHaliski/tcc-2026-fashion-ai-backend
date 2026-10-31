"""Per-client API keys with scopes. Only SHA-256 digests live in the environment; the raw key is shown once.

FAI_API_KEYS="fashionai-backend:<sha256>:submit|read|review;ops:<sha256>:admin"
FAI_API_KEY (legacy, single raw key) maps to client "default" with every scope.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass

SCOPES = frozenset({"submit", "read", "review", "admin"})
_CLIENT = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,63}$")
_DIGEST = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class Client:
    client_id: str
    scopes: frozenset

    def can(self, scope: str) -> bool:
        return "admin" in self.scopes or scope in self.scopes

    @property
    def is_admin(self) -> bool:
        return "admin" in self.scopes


def digest(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def parse_keys(spec: str, legacy_key: str = "") -> list[tuple[str, Client]]:
    entries: list[tuple[str, Client]] = []
    for chunk in (c.strip() for c in spec.split(";")):
        if not chunk:
            continue
        parts = chunk.split(":")
        if len(parts) != 3:
            raise ValueError("FAI_API_KEYS: use cliente:sha256:escopo|escopo separados por ';'")
        client_id, key_digest, scope_list = (p.strip() for p in parts)
        scopes = frozenset(s.strip() for s in scope_list.split("|") if s.strip())
        if not _CLIENT.match(client_id) or not _DIGEST.match(key_digest.lower()) or not scopes <= SCOPES or not scopes:
            raise ValueError(f"FAI_API_KEYS: entrada inválida para o cliente {client_id!r}")
        entries.append((key_digest.lower(), Client(client_id, scopes)))
    if legacy_key:
        if len(legacy_key) < 32 or legacy_key.startswith("CHANGE_ME"):
            raise ValueError("FAI_API_KEY precisa de pelo menos 32 caracteres aleatórios (openssl rand -hex 32)")
        entries.append((digest(legacy_key), Client("default", SCOPES)))
    ids = [c.client_id for _, c in entries]
    if len(ids) != len(set(ids)):
        raise ValueError("FAI_API_KEYS: cliente repetido")
    return entries


class KeyRing:
    def __init__(self, entries: list[tuple[str, Client]]):
        self._entries = entries

    @classmethod
    def from_settings(cls, settings) -> "KeyRing":
        return cls(parse_keys(settings.api_keys, settings.api_key))

    def __len__(self) -> int:
        return len(self._entries)

    def authenticate(self, presented: str | None) -> Client | None:
        if not presented or len(presented) > 512:
            return None
        candidate = digest(presented)
        found = None
        for key_digest, client in self._entries:  # no early exit: constant work per request
            if hmac.compare_digest(candidate, key_digest):
                found = client
        return found


def new_key(client_id: str, scopes: str) -> tuple[str, str]:
    """Returns (raw key to hand to the client once, FAI_API_KEYS entry to store on the server)."""
    raw = secrets.token_hex(32)
    entry = f"{client_id}:{digest(raw)}:{scopes}"
    parse_keys(entry)
    return raw, entry


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gera uma chave de cliente para FAI_API_KEYS")
    parser.add_argument("client_id")
    parser.add_argument("--scopes", default="submit|read")
    args = parser.parse_args()
    key, line = new_key(args.client_id, args.scopes)
    print(f"Chave (entregue ao cliente uma única vez): {key}")
    print(f"Entrada para FAI_API_KEYS: {line}")
