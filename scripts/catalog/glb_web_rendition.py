"""Versão WEB (≤ 6 MB) de um .glb da Meshy, feita só recomprimindo texturas: geometria, UV e materiais intactos.

O .glb da Meshy (meshy-6-lite, exportado pelo Blender) traz ~31 mil triângulos (~1 MB) e três texturas 2048 px:
cor-base e metal/rugosidade em JPEG e a normal map em PNG, que sozinha pesa 2–6 MB e põe 90% dos arquivos acima do
perfil WEB. A receita, em degraus, para no primeiro que couber:

1. normal map PNG → JPEG (qualidade 90, mesma resolução);
2. todas as texturas reduzidas para 1024 px (JPEG 88).

O arquivo original continua sendo a versão DESKTOP_HIGH quando cabe em 12 MB. Nada de rede ou IA: Pillow e o próprio
contêiner GLB (o BIN é remontado com cada bufferView alinhado a 4 bytes e os offsets refeitos).
"""
from __future__ import annotations

import io
import json
import struct

from PIL import Image

try:
    from .glb_quality import WEB_BYTES, split_glb
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from glb_quality import WEB_BYTES, split_glb

STEPS = ({"name": "normal_jpeg", "max_side": None, "quality": 90, "only_png": True},
         {"name": "textures_1024", "max_side": 1024, "quality": 88, "only_png": False})


def pack_glb(document: dict, binary: bytes) -> bytes:
    """Contêiner GLB 2.0: cabeçalho de 12 bytes, chunk JSON (espaços) e BIN (zeros), ambos alinhados a 4."""
    text = json.dumps(document, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    body = struct.pack("<I4s", len(text), b"JSON") + text
    if binary:
        body += struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    return b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body


def _encode(raw: bytes, max_side: int | None, quality: int) -> bytes:
    with Image.open(io.BytesIO(raw)) as img:
        rgb = img.convert("RGB")
    if max_side and max(rgb.size) > max_side:
        scale = max_side / max(rgb.size)
        rgb = rgb.resize((max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))), Image.LANCZOS)
    out = io.BytesIO()
    rgb.save(out, "JPEG", quality=quality, optimize=True)
    return out.getvalue()


def _recompress(document: dict, binary: bytes, step: dict) -> bytes:
    """Novo GLB com as imagens embutidas recomprimidas conforme o degrau; o resto dos bufferViews copiado igual."""
    doc = json.loads(json.dumps(document))
    views = doc.get("bufferViews", [])
    replaced: dict[int, bytes] = {}
    for image in doc.get("images", []):
        index = image.get("bufferView")
        if index is None or index in replaced:
            continue
        mime = image.get("mimeType", "")
        if step["only_png"] and mime != "image/png":
            continue
        view = views[index]
        start = view.get("byteOffset", 0)
        replaced[index] = _encode(binary[start:start + view["byteLength"]], step["max_side"], step["quality"])
        image["mimeType"] = "image/jpeg"
    out = bytearray()
    for index, view in enumerate(views):
        start = view.get("byteOffset", 0)
        chunk = replaced.get(index, binary[start:start + view["byteLength"]])
        out += b"\x00" * (-len(out) % 4)
        view["byteOffset"], view["byteLength"] = len(out), len(chunk)
        out += chunk
    if doc.get("buffers"):
        doc["buffers"][0]["byteLength"] = len(out)
    return pack_glb(doc, bytes(out))


def web_rendition(data: bytes, limit: int = WEB_BYTES) -> tuple[bytes, str] | None:
    """(bytes, receita) da versão WEB, ou None se nem o último degrau couber. Já cabendo, devolve o próprio arquivo."""
    if len(data) <= limit:
        return data, "original"
    document, binary = split_glb(data)
    if len(document.get("buffers", [])) > 1:
        return None   # mais de um buffer: fora do formato que a Meshy entrega, não arrisca remontar
    for step in STEPS:
        candidate = _recompress(document, binary, step)
        if len(candidate) <= limit:
            return candidate, step["name"]
    return None
