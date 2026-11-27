"""Qualidade de um .glb gerado (Meshy, pelo Codex) lida só do arquivo: sem renderizar, sem rede, sem dependência pesada.

Mede o que decide se o modelo serve para o visualizador da peça (WEB/DESKTOP): triângulos e vértices (contagem dos
accessors, vale também com Draco), texturas (quantidade e resolução, lidas do cabeçalho da imagem), materiais PBR,
caixa da malha (min/max do POSITION, obrigatório no glTF) e tamanho do arquivo. Devolve uma nota:

- ``BOM``: pronto para o visualizador;
- ``REVISAR``: abre, mas tem algo a conferir à mão (textura grande, malha pesada, arquivo acima do perfil WEB, peça
  fina demais de lado);
- ``RUIM``: não serve (sem textura, malha quase vazia, peça achatada, arquivo inválido ou grande demais).
"""
from __future__ import annotations

import io
import json
import struct

from PIL import Image

WEB_BYTES = 6_000_000            # QualityProfile.WEB.maxGarmentBytes
DESKTOP_BYTES = 12_000_000       # QualityProfile.DESKTOP_HIGH.maxGarmentBytes
MIN_TRIANGLES = 2_000            # abaixo disso a roupa vira um bloco
HEAVY_TRIANGLES = 300_000        # acima disso pesa no celular
MAX_TEXTURE = 4096
FLAT_RATIO = 0.02                # menor lado da caixa / maior lado: abaixo disso é uma placa, não uma peça
THIN_RATIO = 0.10                # profundidade (Z) / maior lado da frente (X, Y): relevo, não volume de peça vestida
BAD = {"INVALID_GLB", "NO_MESH", "NO_TEXTURE", "TOO_FEW_TRIANGLES", "FLAT_MESH", "TOO_LARGE"}
COMPONENT_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def split_glb(data: bytes) -> tuple[dict, bytes]:
    """JSON e BIN de um GLB 2.0, com cada limite conferido; erro vira ValueError('INVALID_GLB')."""
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("INVALID_GLB")
    _, version, length = struct.unpack_from("<4sII", data)
    if version != 2 or length != len(data):
        raise ValueError("INVALID_GLB")
    offset, document, binary = 12, None, b""
    while offset + 8 <= len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if offset + size > len(data):
            raise ValueError("INVALID_GLB")
        if kind == b"JSON":
            document = json.loads(data[offset:offset + size])
        elif kind == b"BIN\x00":
            binary = data[offset:offset + size]
        offset += size
    if not isinstance(document, dict):
        raise ValueError("INVALID_GLB")
    return document, binary


def _image_size(document: dict, binary: bytes, image: dict) -> tuple[int, int] | None:
    view = image.get("bufferView")
    if view is None or view >= len(document.get("bufferViews", [])):
        return None   # imagem externa (uri): o GLB da Meshy embute tudo, então trata como ausente
    bv = document["bufferViews"][view]
    start = bv.get("byteOffset", 0)
    try:
        with Image.open(io.BytesIO(binary[start:start + bv["byteLength"]])) as img:
            return img.size
    except Exception:   # noqa: BLE001 - imagem que não abre conta como ausente
        return None


def _geometry(document: dict) -> tuple[int, int, int, list[float] | None, list[float] | None]:
    accessors = document.get("accessors", [])
    triangles = vertices = primitives = 0
    lo: list[float] | None = None
    hi: list[float] | None = None
    for mesh in document.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("mode", 4) != 4:
                continue   # só listas de triângulos contam como superfície
            primitives += 1
            position = accessors[prim["attributes"]["POSITION"]] if "POSITION" in prim.get("attributes", {}) else {}
            vertices += position.get("count", 0)
            index = prim.get("indices")
            triangles += (accessors[index]["count"] if index is not None else position.get("count", 0)) // 3
            if len(position.get("min", [])) == 3 and len(position.get("max", [])) == 3:
                lo = position["min"] if lo is None else [min(a, b) for a, b in zip(lo, position["min"])]
                hi = position["max"] if hi is None else [max(a, b) for a, b in zip(hi, position["max"])]
    return triangles, vertices, primitives, lo, hi


def inspect(data: bytes) -> dict:
    """Métricas e nota do .glb. Nunca levanta: arquivo inválido vira nota RUIM com o motivo."""
    report: dict = {"bytes": len(data)}
    try:
        document, binary = split_glb(data)
        triangles, vertices, primitives, lo, hi = _geometry(document)
    except (ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError):
        return {**report, "grade": "RUIM", "issues": ["INVALID_GLB"]}
    sizes = [s for s in (_image_size(document, binary, img) for img in document.get("images", [])) if s]
    materials = document.get("materials", [])
    textured = sum(1 for m in materials if (m.get("pbrMetallicRoughness") or {}).get("baseColorTexture"))
    dims = [round(b - a, 4) for a, b in zip(lo, hi)] if lo and hi else None
    report.update({
        "triangles": triangles, "vertices": vertices, "primitives": primitives, "materials": len(materials),
        "textured_materials": textured, "textures": len(sizes), "max_texture": max((max(s) for s in sizes), default=0),
        "normal_map": any(m.get("normalTexture") for m in materials), "dimensions": dims,
        "extensions": sorted(document.get("extensionsUsed", [])),
        "generator": (document.get("asset") or {}).get("generator"),
    })
    report["issues"] = issues(report)
    report["grade"] = "RUIM" if BAD & set(report["issues"]) else ("REVISAR" if report["issues"] else "BOM")
    return report


def issues(r: dict) -> list[str]:
    found = []
    if not r["primitives"]:
        found.append("NO_MESH")
    elif r["triangles"] < MIN_TRIANGLES:
        found.append("TOO_FEW_TRIANGLES")
    if r["triangles"] > HEAVY_TRIANGLES:
        found.append("HEAVY_MESH")
    if not r["textures"] or not r["textured_materials"]:
        found.append("NO_TEXTURE")   # cor e estampa da peça vêm da textura: sem ela o modelo não representa a peça
    if r["max_texture"] > MAX_TEXTURE:
        found.append("TEXTURE_TOO_LARGE")
    dims = r["dimensions"]
    if dims and max(dims) > 0 and min(dims) / max(dims) < FLAT_RATIO:
        found.append("FLAT_MESH")
    elif dims and max(dims[:2]) > 0 and dims[2] / max(dims[:2]) < THIN_RATIO:
        found.append("THIN_PROFILE")   # Meshy de uma foto só: frente boa, de lado parece um relevo
    if r["bytes"] > DESKTOP_BYTES:
        found.append("TOO_LARGE")
    elif r["bytes"] > WEB_BYTES:
        found.append("ABOVE_WEB_PROFILE")
    return found


def rendition_profile(size: int) -> str | None:
    """Perfil do garment_assets_3d em que o arquivo cabe (GarmentAssetService confere o mesmo limite)."""
    if size <= WEB_BYTES:
        return "WEB"
    return "DESKTOP_HIGH" if size <= DESKTOP_BYTES else None
