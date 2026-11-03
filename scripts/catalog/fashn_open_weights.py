"""Pesos fixados do engine fashn-open (fashn_open_assets.json): download em blocos, sha256 conferido antes de aceitar
e verificação por componente."""
from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from pathlib import Path
from typing import Callable, Iterable, Optional

ASSETS_FILE = Path(__file__).resolve().parent / "fashn_open_assets.json"
HF_URL = "https://huggingface.co/{repo}/resolve/{revision}/{filename}"
UA = "FashionAI-CatalogBot/1.0 (+https://fashionai.app/catalog-bot)"


# ───────────────────────── pesos fixados

def assets() -> dict:
    return json.loads(ASSETS_FILE.read_text(encoding="utf-8"))


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hf_url(entry: dict) -> str:
    return HF_URL.format(**entry)


def urllib_fetch(url: str, dest: Path, timeout: float = 120) -> None:
    """Baixa em blocos para `dest` (sem token: tudo é público). Quem chama confere o sha256 antes de aceitar."""
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=timeout) as response, Path(dest).open("wb") as out:
        for chunk in iter(lambda: response.read(1 << 20), b""):
            out.write(chunk)


def _selected(components: Optional[Iterable[str]]) -> list[dict]:
    wanted = set(components) if components else None
    return [e for e in assets()["files"] if wanted is None or e["component"] in wanted]


def verify(dest: Path, components: Optional[Iterable[str]] = None) -> list[str]:
    """Problemas (arquivo ausente, tamanho ou sha256 diferente do fixado); lista vazia = tudo confere."""
    problems = []
    for entry in _selected(components):
        path = Path(dest) / entry["path"]
        if not path.is_file():
            problems.append(f"ausente: {entry['path']}")
        elif path.stat().st_size != entry["size"]:
            problems.append(f"tamanho: {entry['path']}")
        elif sha256_of(path) != entry["sha256"]:
            problems.append(f"sha256: {entry['path']}")
    return problems


def verify_component(dest: Path, component: str) -> None:
    problems = verify(dest, {component})
    if problems:
        raise ValueError("FASHN_OPEN_ASSETS_INVALID:" + ";".join(problems))


def download(dest: Path, components: Optional[Iterable[str]] = None, fetch: Optional[Callable[[str, Path], None]] = None,
             log: Callable[[str], None] = print) -> list[dict]:
    """Baixa o que falta, confere o sha256 e só então renomeia; arquivo já íntegro não é baixado de novo."""
    fetch = fetch or urllib_fetch
    dest = Path(dest)
    manifest = []
    for entry in _selected(components):
        path = dest / entry["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_file() and path.stat().st_size == entry["size"] and sha256_of(path) == entry["sha256"]:
            log(f"  ✓ {entry['path']} já presente")
        else:
            part = path.with_name(path.name + ".part")
            started = time.monotonic()
            fetch(hf_url(entry), part)
            digest = sha256_of(part)
            if part.stat().st_size != entry["size"] or digest != entry["sha256"]:
                part.unlink(missing_ok=True)
                raise ValueError(f"FASHN_OPEN_SHA256_MISMATCH:{entry['path']}")
            part.replace(path)
            log(f"  ↓ {entry['path']} ({entry['size'] / 1e6:.1f} MB em {time.monotonic() - started:.0f}s, sha256 ok)")
        manifest.append({"path": entry["path"], "size": entry["size"], "sha256": entry["sha256"], "repo": entry["repo"], "revision": entry["revision"]})
    code_dir = dest / "birefnet" / "code"
    if code_dir.is_dir():
        (code_dir / "__init__.py").touch()          # vira pacote importável (import_birefnet)
    (dest / "fashn_open_manifest.json").write_text(json.dumps({"files": manifest}, indent=1), encoding="utf-8")
    return manifest
