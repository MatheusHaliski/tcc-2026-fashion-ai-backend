"""Reduz as texturas de um ``.glb`` já comprimido (meshopt), sem tocar na geometria: cada imagem fica no mesmo formato
com o lado máximo pedido, e o bloco binário é remontado com os deslocamentos novos (inclusive os da extensão meshopt).

Serve à versão média dos modelos prontos: o gltfpack do npm simplifica a malha, mas não redimensiona textura (a
compressão de textura dele precisa do BasisU, que a versão WebAssembly não tem).
"""
from __future__ import annotations

import io
import json
import struct
from pathlib import Path


def _ler(arquivo: Path) -> tuple[dict, bytes]:
    dados = arquivo.read_bytes()
    tamanho_json = struct.unpack_from("<I", dados, 12)[0]
    doc = json.loads(dados[20:20 + tamanho_json])
    inicio_bin = 20 + tamanho_json
    tamanho_bin = struct.unpack_from("<I", dados, inicio_bin)[0]
    return doc, dados[inicio_bin + 8:inicio_bin + 8 + tamanho_bin]


def _escrever(arquivo: Path, doc: dict, binario: bytes) -> None:
    texto = json.dumps(doc, separators=(",", ":")).encode()
    texto += b" " * (-len(texto) % 4)
    binario += b"\0" * (-len(binario) % 4)
    total = 12 + 8 + len(texto) + 8 + len(binario)
    arquivo.write_bytes(struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<I4s", len(texto), b"JSON") + texto
                        + struct.pack("<I4s", len(binario), b"BIN\0") + binario)


FORMATOS = {"image/webp": "WEBP", "image/jpeg": "JPEG", "image/png": "PNG"}


def _reduzir(dados: bytes, formato: str, lado: int, qualidade: int) -> bytes:
    """A mesma imagem, no mesmo formato, com o lado maior limitado a ``lado``."""
    from PIL import Image

    imagem = Image.open(io.BytesIO(dados))
    if max(imagem.size) <= lado:
        return dados
    imagem.thumbnail((lado, lado))
    saida = io.BytesIO()
    imagem.save(saida, formato, **({"quality": qualidade} if formato != "PNG" else {"optimize": True}))
    return saida.getvalue()


def reduzir_texturas(arquivo: Path, lado: int = 512, qualidade: int = 78) -> int:
    """Reescreve ``arquivo`` com as texturas reduzidas; devolve quantos bytes saíram."""
    doc, antigo = _ler(arquivo)
    vistas = doc.get("bufferViews", [])
    de_imagem = {img["bufferView"]: img for img in doc.get("images", []) if "bufferView" in img}
    novo = bytearray()

    def guardar(trecho: bytes) -> int:
        novo.extend(b"\0" * (-len(novo) % 4))
        inicio = len(novo)
        novo.extend(trecho)
        return inicio

    for i, vista in enumerate(vistas):
        meshopt = vista.get("extensions", {}).get("EXT_meshopt_compression")
        if meshopt and meshopt.get("buffer", 0) == 0:
            trecho = antigo[meshopt.get("byteOffset", 0):meshopt.get("byteOffset", 0) + meshopt["byteLength"]]
            meshopt["byteOffset"] = guardar(trecho)
            continue
        if vista.get("buffer", 0) != 0:
            continue
        trecho = antigo[vista.get("byteOffset", 0):vista.get("byteOffset", 0) + vista["byteLength"]]
        formato = FORMATOS.get(de_imagem[i].get("mimeType", "")) if i in de_imagem else None
        if formato:
            trecho = _reduzir(trecho, formato, lado, qualidade)
        vista["byteOffset"] = guardar(trecho)
        vista["byteLength"] = len(trecho)
    doc["buffers"][0]["byteLength"] = len(novo)
    antes = arquivo.stat().st_size
    _escrever(arquivo, doc, bytes(novo))
    return antes - arquivo.stat().st_size
