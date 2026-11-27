"""GLB sintético no formato da Meshy (uma malha, três texturas embutidas: normal PNG, cor e metal/rugosidade JPEG),
montado em memória para os testes do lote do Codex. Sem arquivo versionado."""
import io

import numpy as np
from PIL import Image

from scripts.catalog.tests.glb_fixture import glb_bytes


def image(fmt: str, size: int = 64, color=(120, 60, 30), noise: bool = False) -> bytes:
    if noise:   # ruído não comprime: serve para inflar o arquivo acima de um limite
        pixels = np.random.default_rng(7).integers(0, 255, (size, size, 3), dtype=np.uint8)
        img = Image.fromarray(pixels, "RGB")
    else:
        img = Image.new("RGB", (size, size), color)
    out = io.BytesIO()
    img.save(out, fmt)
    return out.getvalue()


def meshy_glb(*, triangles=3000, dims=(1.0, 1.6, 0.3), textures=True, normal_size=64, noise=False) -> bytes:
    """Caixa com ``dims`` (X, Y, Z) e ``triangles`` triângulos (índices repetidos: só a contagem importa)."""
    x, y, z = dims
    positions = np.array([[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]],
                         dtype="<f4")
    indices = np.tile(np.array([0, 1, 2], dtype="<u2"), triangles)
    blobs = [positions.tobytes(), indices.tobytes()]
    if textures:
        blobs += [image("PNG", normal_size, noise=noise), image("JPEG"), image("JPEG", color=(90, 90, 90))]
    views, binary = [], b""
    for blob in blobs:
        binary += b"\x00" * (-len(binary) % 4)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(blob)})
        binary += blob
    document = {
        "asset": {"version": "2.0", "generator": "Khronos glTF Blender I/O"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 8, "type": "VEC3",
                       "min": [0, 0, 0], "max": [x, y, z]},
                      {"bufferView": 1, "componentType": 5123, "count": len(indices), "type": "SCALAR"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
        "materials": [{"name": "Material_0"}],
    }
    if textures:
        document["images"] = [{"bufferView": 2, "mimeType": "image/png"}, {"bufferView": 3, "mimeType": "image/jpeg"},
                              {"bufferView": 4, "mimeType": "image/jpeg"}]
        document["textures"] = [{"source": 0}, {"source": 1}, {"source": 2}]
        document["materials"][0].update({"normalTexture": {"index": 0}, "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 1}, "metallicRoughnessTexture": {"index": 2}}})
    return glb_bytes(document, binary)
