"""Perfil ``high`` do motor Blender: salas inteiras em alta densidade (scripts/blender3d_high).

Fica fora de ``scripts/blender3d`` de propósito: o resumo (hash) do motor cobre só aquela pasta, então as salas high
poly entram sem regerar os objetos soltos das salas. O perfil reaproveita as formas do motor (``scripts.blender3d.core``)
e acrescenta o que a alta densidade pede: subdivisão, chanfros finos, tecido com dobras, texturas PBR geradas, mapas
assados (oclusão e relevo) e duas versões por sala (``alto`` e ``medio``), comprimidas com meshopt.
"""
