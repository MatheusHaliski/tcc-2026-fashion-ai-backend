"""Exportação das salas high poly: glTF binário com texturas WebP (Blender) e compressão meshopt com instancing
(gltfpack: EXT_meshopt_compression, KHR_mesh_quantization, EXT_mesh_gpu_instancing). O three.js do repositório lê os
três (o useGLTF do drei já traz o decodificador meshopt; nada vem de CDN). ``medidas`` lê o arquivo final e conta
triângulos desenhados e chamadas de desenho como o navegador vai ter.
"""
from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
from pathlib import Path

#: versão fixa do gltfpack (pacote npm com WebAssembly: roda sem instalar nada no sistema)
GLTFPACK = "gltfpack@0.22.0"


def exportar_bruto(destino: Path) -> Path:
    import bpy

    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", export_apply=True, export_yup=True,
                              use_selection=False, export_cameras=False, export_lights=False,
                              export_image_format="WEBP", export_image_quality=82, export_extras=False)
    return destino


def _gltfpack() -> list[str]:
    local = os.environ.get("GLTFPACK")
    if local:
        return [local]
    achado = shutil.which("gltfpack")
    return [achado] if achado else ["npx", "-y", GLTFPACK]


def comprimir(bruto: Path, destino: Path, simplificar: float | None = None) -> Path:
    """meshopt (-cc) e instancing (-mi); ``simplificar`` (0 a 1) é a razão de triângulos do nível médio."""
    comando = [*_gltfpack(), "-i", str(bruto), "-o", str(destino), "-cc", "-mi", "-km"]
    if simplificar:
        comando += ["-si", str(simplificar), "-se", "0.004"]
    subprocess.run(comando, check=True, capture_output=True)
    return destino


def ler_glb(arquivo: Path) -> dict:
    """O JSON de um ``.glb`` (o primeiro bloco do arquivo)."""
    with arquivo.open("rb") as f:
        cabecalho = f.read(12)
        if cabecalho[:4] != b"glTF":
            raise ValueError(f"{arquivo} não é glTF binário")
        tamanho, _tipo = struct.unpack("<II", f.read(8))
        return json.loads(f.read(tamanho))


def medidas(doc: dict) -> dict:
    """Triângulos desenhados (cada cópia conta), chamadas de desenho (um grupo instanciado conta uma por primitiva),
    malhas, cópias instanciadas e texturas."""
    acessores = doc.get("accessors", [])
    malhas = doc.get("meshes", [])
    triangulos = chamadas = copias = 0
    for no in doc.get("nodes", []):
        if "mesh" not in no:
            continue
        inst = no.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        n = acessores[inst["attributes"]["TRANSLATION"]]["count"] if inst and "TRANSLATION" in inst["attributes"] else 1
        copias += n if inst else 0
        for prim in malhas[no["mesh"]]["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            indices = acessores[prim["indices"]]["count"] if "indices" in prim else acessores[prim["attributes"]["POSITION"]]["count"]
            triangulos += indices // 3 * n
            chamadas += 1
    return {"triangulos": triangulos, "chamadas": chamadas, "malhas": len(malhas), "instanciadas": copias,
            "texturas": len(doc.get("images", []))}
