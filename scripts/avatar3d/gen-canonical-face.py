#!/usr/bin/env python3
"""Gera lib/avatar3d/canonical-face.ts a partir do modelo canônico do MediaPipe (Apache-2.0).

    python3 scripts/avatar3d/gen-canonical-face.py [caminho/do/canonical_face_model.obj]

Sem argumento, baixa o .obj de google-ai-edge/mediapipe (mediapipe/modules/face_geometry/data).
"""
import sys, urllib.request
from collections import Counter, defaultdict

URL = "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj"
src = open(sys.argv[1]).read() if len(sys.argv) > 1 else urllib.request.urlopen(URL).read().decode()
V, VT, F, uvOf = [], [], [], {}
for line in src.splitlines():
    p = line.split()
    if not p:
        continue
    if p[0] == "v":
        V.append([float(x) for x in p[1:4]])
    elif p[0] == "vt":
        VT.append([float(x) for x in p[1:3]])
    elif p[0] == "f":
        tri = []
        for t in p[1:]:
            v, u = (int(x) - 1 for x in t.split("/")[:2])
            uvOf[v] = u
            tri.append(v)
        F.append(tri)
assert len(V) == 468 and len(F) == 898 and len(uvOf) == 468
# contorno do rosto: a única borda da malha (arestas usadas por um triângulo só), em ordem
E = Counter(tuple(sorted(e)) for a, b, c in F for e in ((a, b), (b, c), (c, a)))
adj = defaultdict(list)
for (a, b), n in E.items():
    if n == 1:
        adj[a].append(b); adj[b].append(a)
ring, prev = [10], None
while True:
    nxt = [n for n in adj[ring[-1]] if n != prev and n not in ring]
    if not nxt:
        break
    prev = ring[-1]; ring.append(nxt[0])
assert len(ring) == 36

def nums(xs, d):
    return ",".join(f"{x:.{d}f}".rstrip("0").rstrip(".").replace("-0", "-0") if x else "0" for x in xs)

pos = [c for v in V for c in v]
uv = [c for i in range(468) for c in (VT[uvOf[i]][0], 1 - VT[uvOf[i]][1])]   # v para baixo (como a imagem)
tri = [i for t in F for i in t]
out = f"""/*
 * Modelo canônico do rosto do MediaPipe Face Mesh: 468 vértices (cm, y para cima, rosto olhando para +z), UV canônico
 * (u para a direita, v para baixo) e 898 triângulos. Gerado por scripts/avatar3d/gen-canonical-face.py a partir de
 * mediapipe/modules/face_geometry/data/canonical_face_model.obj — Copyright The MediaPipe Authors, Apache License 2.0.
 * Não edite à mão.
 */
export const CANON_POS = new Float32Array([{nums(pos, 5)}]);
export const CANON_UV = new Float32Array([{nums(uv, 6)}]);
export const CANON_TRI = new Uint16Array([{",".join(map(str, tri))}]);
/** Contorno do rosto (a borda da malha), em ordem a partir da testa (10). */
export const FACE_OVAL = [{",".join(map(str, ring))}] as const;
"""
open("lib/avatar3d/canonical-face.ts", "w").write(out)
print("lib/avatar3d/canonical-face.ts", len(out), "bytes")
