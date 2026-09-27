"""
Corpo humano do Avatar 3D (RF40) — exportador offline, sem torch.

Gera public/avatar3d/body/fai-body-v1.{json,bin}: um corpo humano completo (malha MakeHuman "hm08", olhos de alta
resolução), esqueleto humanoide com nomes do Mixamo (52 ossos, pesos de pele CC0 do MPFB2), um espaço de formas do
corpo (PCA de milhares de combinações dos alvos macro — sexo, idade, massa muscular, peso, altura, proporções, etnia —
e dos alvos de medida — busto, cintura, quadril, ombros, braços, pernas…), um espaço de formas do rosto (PCA dos alvos
locais de nariz, boca, olhos, queixo, bochechas, testa, cabeça e orelhas), as regressões medida → forma que o
navegador usa para ajustar o corpo às proporções da pessoa, e a correspondência entre os 468 pontos do MediaPipe Face
Mesh e a superfície da cabeça (para ajustar o rosto e aplicar a textura da foto).

Fontes, todas livres:
  - MPFB2 / MakeHuman (malha base, alvos, esqueleto "mixamo" e pesos): CC0 1.0 — distribuídos no pacote `anny`
    (NAVER LABS, Apache-2.0) em anny/data/mpfb2 (`pip download anny==0.6.0 --no-deps` e descompactar o .whl);
  - olhos "high-poly" do MakeHuman 1.x (malha, encaixe .mhclo e textura brown_eye.png): CC0 1.0 —
    github.com/makehumancommunity/makehuman, pasta makehuman/data/eyes;
  - modelo canônico do MediaPipe Face Mesh (lib/avatar3d/canonical-face.ts): Apache-2.0.

Uso:
  python3 export_body.py --mpfb <.../anny/data/mpfb2> --eyes <.../makehuman/data/eyes> \
      --canon lib/avatar3d/canonical-face.ts --out public/avatar3d/body

Coordenadas de saída: metros, y para cima, a pessoa olhando para +z, pés no chão (y = 0) — as do three.js e do glTF.
"""
import argparse
import gzip
import json
import os
import re
import struct

import numpy as np

DM = 0.1                       # a malha do MakeHuman está em decímetros
REF_H = 1.70                   # estatura de referência das formas do corpo (m)
FORMAT = "fai-body-v1"

# ------------------------------------------------------------------ leitura


def load_obj(path):
    V, VT, F, FT, G = [], [], [], [], []
    grp = None
    for line in open(path, encoding="utf-8"):
        if line.startswith("v "):
            V.append(line.split()[1:4])
        elif line.startswith("vt "):
            VT.append(line.split()[1:3])
        elif line.startswith("g "):
            grp = line.split(None, 1)[1].strip()
        elif line.startswith("f "):
            parts = line.split()[1:]
            F.append([int(p.split("/")[0]) - 1 for p in parts])
            FT.append([int(p.split("/")[1]) - 1 if "/" in p and p.split("/")[1] else -1 for p in parts])
            G.append(grp)
    return np.array(V, float), np.array(VT, float), F, FT, G


def ranges(r):
    if r and isinstance(r[0], list):
        return np.concatenate([np.arange(a, b + 1) for a, b in r])
    return np.array(r, int)


class Targets:
    """Alvos .target.gz (linhas "índice dx dy dz", em decímetros), com cache."""

    def __init__(self, root):
        self.root = root
        self.cache = {}
        self.paths = {}
        for d, _, files in os.walk(root):
            for f in files:
                if f.endswith(".target.gz"):
                    self.paths[f[:-10]] = os.path.join(d, f)

    def get(self, name):
        if name not in self.cache:
            txt = gzip.open(self.paths[name]).read().decode()
            if not txt.strip():
                self.cache[name] = (np.zeros(0, int), np.zeros((0, 3)))
            else:
                a = np.array(txt.split(), float).reshape(-1, 4)
                self.cache[name] = (a[:, 0].astype(int), a[:, 1:])
        return self.cache[name]


# ------------------------------------------------------------------ fenótipo (alvos macro)

AGES = ["baby", "child", "young", "old"]


def macro_weights(ph):
    """Peso de cada rótulo das variáveis macro do MakeHuman (macrodetails/macro.json)."""
    w = {"universal": 1.0}
    g = ph["gender"]
    w["female"], w["male"] = 1 - g, g
    a = ph["age"]
    aw = dict.fromkeys(AGES, 0.0)
    if a < 0.1875:
        t = a / 0.1875; aw["baby"], aw["child"] = 1 - t, t
    elif a < 0.5:
        t = (a - 0.1875) / 0.3125; aw["child"], aw["young"] = 1 - t, t
    else:
        t = (a - 0.5) / 0.5; aw["young"], aw["old"] = 1 - t, t
    w.update(aw)

    def tri(v, lo, mid, hi):
        if v < 0.5:
            return {lo: 1 - v / 0.5, mid: v / 0.5, hi: 0.0}
        return {lo: 0.0, mid: 1 - (v - 0.5) / 0.5, hi: (v - 0.5) / 0.5}

    w.update(tri(ph["muscle"], "minmuscle", "averagemuscle", "maxmuscle"))
    w.update(tri(ph["weight"], "minweight", "averageweight", "maxweight"))
    w.update(tri(ph["cupsize"], "mincup", "averagecup", "maxcup"))
    w.update(tri(ph["firmness"], "minfirmness", "averagefirmness", "maxfirmness"))
    h, p = ph["height"], ph["proportions"]
    w["minheight"], w["maxheight"] = max(0.0, 1 - h / 0.5), max(0.0, (h - 0.5) / 0.5)
    w["uncommonproportions"], w["idealproportions"] = max(0.0, 1 - p / 0.5), max(0.0, (p - 0.5) / 0.5)
    r = np.array([ph["african"], ph["asian"], ph["caucasian"]], float)
    r = r / r.sum()
    w["african"], w["asian"], w["caucasian"] = r
    return w


NEUTRAL = dict(gender=0.5, age=0.5, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, cupsize=0.5, firmness=0.5,
               african=1 / 3, asian=1 / 3, caucasian=1 / 3)

# modificadores locais do corpo (valor em [-1, 1]: + usa o alvo "incr"/positivo, − o "decr"/negativo)
BODY_MODS = [
    "measure-bust-circ", "measure-underbust-circ", "measure-waist-circ", "measure-hips-circ", "measure-shoulder-dist",
    "measure-frontchest-dist", "measure-napetowaist-dist", "measure-waisttohip-dist", "measure-neck-circ",
    "measure-neck-height", "measure-upperarm-circ", "measure-upperarm-length", "measure-lowerarm-length",
    "measure-thigh-circ", "measure-calf-circ", "measure-upperleg-height", "measure-lowerleg-height",
    "stomach-pregnant", "buttocks-volume", "torso-vshape", "torso-scale-depth", "hip-scale-depth",
]
FACE_GROUPS = ["head", "nose", "mouth", "chin", "cheek", "forehead", "eyebrows", "eyes", "ears"]
FACE_SKIP = re.compile(r"trans-(in|out)|head-trans|head-angle|asym|ear-rot|jaw-drop")   # nada que desloque o rosto de lado


def modifiers(target_json):
    """Modificadores do target.json: nome → (alvos do lado positivo, alvos do lado negativo). L e R andam juntos."""
    out = {}
    for grp, spec in target_json.items():
        for c in spec["categories"]:
            o = c.get("opposites")
            ts = list(c["targets"])
            if o:
                pos = [x for x in (o.get("positive-unsided"), o.get("positive-left"), o.get("positive-right")) if x]
                neg = [x for x in (o.get("negative-unsided"), o.get("negative-left"), o.get("negative-right")) if x]
            elif len(ts) == 1:
                pos, neg = ts, []
            elif c.get("has_left_and_right") and len(ts) == 4:      # r-a, r-b, l-a, l-b
                neg, pos = [ts[0], ts[2]], [ts[1], ts[3]]
            elif len(ts) == 2:
                neg, pos = [ts[0]], [ts[1]]
            else:
                pos, neg = ts, []
            out[c["name"]] = (grp, pos, neg)
    return out


class Composer:
    def __init__(self, mpfb, T):
        self.T = T
        base = os.path.join(mpfb, "3dobjs", "base.obj")
        self.V, self.VT, self.F, self.FT, self.G = load_obj(base)
        mac = [n for n, p in T.paths.items() if "macrodetails" in p or "/breast/" in p]
        self.macro = []
        for n in mac:
            toks = n.split("-")
            if any(t in ("baby", "child") for t in toks):
                continue                                   # só adultos
            known = {"universal", "female", "male", "young", "old", "african", "asian", "caucasian",
                     "minmuscle", "averagemuscle", "maxmuscle", "minweight", "averageweight", "maxweight",
                     "minheight", "maxheight", "idealproportions", "uncommonproportions",
                     "mincup", "averagecup", "maxcup", "minfirmness", "averagefirmness", "maxfirmness"}
            if all(t in known for t in toks):
                self.macro.append((n, toks))
        mods = modifiers(json.load(open(os.path.join(mpfb, "targets", "target.json"))))
        self.mods = mods

    def compose(self, ph, local=None):
        X = self.V.copy()
        w = macro_weights(ph)
        for n, toks in self.macro:
            wt = 1.0
            for t in toks:
                wt *= w[t]
                if wt < 1e-5:
                    break
            if wt < 1e-5:
                continue
            idx, d = self.T.get(n)
            if len(idx):
                X[idx] += wt * d
        for name, v in (local or {}).items():
            if abs(v) < 1e-4:
                continue
            _, pos, neg = self.mods[name]
            for n in (pos if v > 0 else neg):
                idx, d = self.T.get(n)
                if len(idx):
                    X[idx] += abs(v) * d
        return X


# ------------------------------------------------------------------ olhos (encaixe .mhclo)


class Proxy:
    def __init__(self, folder):
        name = os.path.basename(folder.rstrip("/"))
        self.V, self.VT, self.F, self.FT, _ = load_obj(os.path.join(folder, name + ".obj"))
        refs, wts, offs, scale = [], [], [], {}
        in_verts = False
        for line in open(os.path.join(folder, name + ".mhclo"), encoding="utf-8"):
            s = line.split()
            if not s or s[0].startswith("#"):
                continue
            if s[0] in ("x_scale", "y_scale", "z_scale"):
                scale[s[0][0]] = (int(s[1]), int(s[2]), float(s[3]))
            elif s[0] == "verts":
                in_verts = True
            elif in_verts and len(s) == 9:
                refs.append([int(x) for x in s[:3]]); wts.append([float(x) for x in s[3:6]]); offs.append([float(x) for x in s[6:9]])
            elif in_verts and len(s) == 1 and s[0].isdigit():
                refs.append([int(s[0])] * 3); wts.append([1.0, 0, 0]); offs.append([0.0, 0, 0])
            elif in_verts and s[0] in ("delete_verts",):
                break
        self.refs, self.wts, self.offs, self.scale = np.array(refs), np.array(wts), np.array(offs), scale
        assert len(self.refs) == len(self.V), (len(self.refs), len(self.V))

    def fit(self, X):
        sc = []
        for k, ax in (("x", 0), ("y", 1), ("z", 2)):
            a, b, den = self.scale[k]
            sc.append(abs(X[a, ax] - X[b, ax]) / den)
        return np.einsum("nk,nkd->nd", self.wts, X[self.refs]) + self.offs * np.array(sc)


# ------------------------------------------------------------------ geometria auxiliar


def tri_split(F):
    out = []
    for f in F:
        for k in range(1, len(f) - 1):
            out.append([f[0], f[k], f[k + 1]])
    return np.array(out, int)


def closest_on_tris(P, A, B, C):
    """Ponto mais próximo de cada P nos triângulos (A,B,C): devolve (tri, u, v, w, dist). Força bruta em blocos."""
    best_d = np.full(len(P), np.inf); best = np.zeros((len(P), 4))
    AB, AC = B - A, C - A
    for s in range(0, len(P), 64):
        p = P[s:s + 64, None, :]
        ap = p - A[None]
        d1 = (AB[None] * ap).sum(-1); d2 = (AC[None] * ap).sum(-1)
        bp = p - B[None]; d3 = (AB[None] * bp).sum(-1); d4 = (AC[None] * bp).sum(-1)
        cp = p - C[None]; d5 = (AB[None] * cp).sum(-1); d6 = (AC[None] * cp).sum(-1)
        va = d3 * d6 - d5 * d4; vb = d5 * d2 - d1 * d6; vc = d1 * d4 - d3 * d2
        den = np.where(np.abs(va + vb + vc) < 1e-20, 1e-20, va + vb + vc)
        v = vb / den; w = vc / den
        # regiões de Voronoi (Ericson, Real-Time Collision Detection 5.1.5)
        v = np.where((d1 <= 0) & (d2 <= 0), 0, v); w = np.where((d1 <= 0) & (d2 <= 0), 0, w)
        m = (d3 >= 0) & (d4 <= d3); v = np.where(m, 1, v); w = np.where(m, 0, w)
        m = (d6 >= 0) & (d5 <= d6); v = np.where(m, 0, v); w = np.where(m, 1, w)
        m = (vc <= 0) & (d1 >= 0) & (d3 <= 0); t = d1 / np.where(np.abs(d1 - d3) < 1e-20, 1e-20, d1 - d3)
        v = np.where(m, t, v); w = np.where(m, 0, w)
        m = (vb <= 0) & (d2 >= 0) & (d6 <= 0); t = d2 / np.where(np.abs(d2 - d6) < 1e-20, 1e-20, d2 - d6)
        v = np.where(m, 0, v); w = np.where(m, t, w)
        m = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0); t = (d4 - d3) / np.where(np.abs((d4 - d3) + (d5 - d6)) < 1e-20, 1e-20, (d4 - d3) + (d5 - d6))
        v = np.where(m, 1 - t, v); w = np.where(m, t, w)
        v = np.clip(v, 0, 1); w = np.clip(w, 0, 1); s_ = v + w; over = s_ > 1; v = np.where(over, v / s_, v); w = np.where(over, w / s_, w)
        q = A[None] + AB[None] * v[..., None] + AC[None] * w[..., None]
        d = np.linalg.norm(p - q, axis=-1)
        i = d.argmin(1); r = np.arange(len(i))
        best_d[s:s + 64] = d[r, i]
        best[s:s + 64] = np.stack([i, 1 - v[r, i] - w[r, i], v[r, i], w[r, i]], 1)
    return best[:, 0].astype(int), best[:, 1], best[:, 2], best[:, 3], best_d


def umeyama(src, dst, w=None):
    """Semelhança (s, R, t) que leva src em dst por mínimos quadrados ponderados."""
    w = np.ones(len(src)) if w is None else w
    w = w / w.sum()
    ms, md = (src * w[:, None]).sum(0), (dst * w[:, None]).sum(0)
    a, b = src - ms, dst - md
    cov = (b * w[:, None]).T @ a
    U, S, Vt = np.linalg.svd(cov)
    D = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        D[2, 2] = -1
    R = U @ D @ Vt
    var = ((a ** 2).sum(1) * w).sum()
    s = np.trace(np.diag(S) @ D) / var
    return s, R, md - s * R @ ms


def pca(M, var_keep, kmax):
    mean = M.mean(0)
    A = M - mean
    Gm = A @ A.T
    ev, U = np.linalg.eigh(Gm)
    ev, U = ev[::-1], U[:, ::-1]
    ev = np.maximum(ev, 0)
    cum = np.cumsum(ev) / ev.sum()
    k = int(min(kmax, np.searchsorted(cum, var_keep) + 1))
    comps = (U[:, :k].T @ A) / np.sqrt(ev[:k])[:, None]        # base ortonormal
    sig = np.sqrt(ev[:k] / (len(M) - 1))                        # desvio de cada coeficiente
    Z = (A @ comps.T) / sig                                     # coeficientes branqueados das amostras
    return mean, comps * sig[:, None], Z, cum[k - 1], k


def parse_ts_array(src, name, typ=float):
    m = re.search(rf"export const {name} = new \w+Array\(\[([^\]]*)\]\)", src)
    if m:
        return np.array([typ(x) for x in m.group(1).split(",") if x.strip()])
    m = re.search(rf"export const {name}[^=]*= \[([^\]]*)\]", src)
    return np.array([typ(x) for x in m.group(1).split(",") if x.strip()])


# ------------------------------------------------------------------ principal


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mpfb", required=True)
    ap.add_argument("--eyes", required=True)
    ap.add_argument("--canon", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--nbody", type=int, default=900)
    ap.add_argument("--nface", type=int, default=900)
    ap.add_argument("--seed", type=int, default=20260927)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    T = Targets(os.path.join(a.mpfb, "targets"))
    C = Composer(a.mpfb, T)
    groups = json.load(open(os.path.join(a.mpfb, "mesh_metadata", "basemesh_vertex_groups.json")))
    gidx = {k: ranges(v) for k, v in groups.items()}
    body_v = gidx["body"]; hair_v = gidx["helper-hair"]
    nb = len(body_v)
    eyes = Proxy(os.path.join(a.eyes, "high-poly"))
    ne = len(eyes.V)

    rig = json.load(open(os.path.join(a.mpfb, "rigs", "standard", "rig.mixamo.json")))["bones"]
    wts = json.load(open(os.path.join(a.mpfb, "rigs", "standard", "weights.mixamo.json")))["weights"]
    order = []
    def visit(b):
        if b in order:
            return
        p = rig[b]["parent"]
        if p:
            visit(p)
        order.append(b)
    for b in sorted(rig):
        visit(b)
    bone_i = {b: i for i, b in enumerate(order)}

    def joint_sets(end):
        out = []
        for b in order:
            spec = rig[b][end]
            if spec["strategy"] == "CUBE":
                out.append(gidx[spec["cube_name"]])
            else:
                out.append(np.array(spec["vertex_indices"], int))
        return out
    head_sets = joint_sets("head"); tail_sets = joint_sets("tail")

    # vetor de uma amostra: corpo, olhos, casca do cabelo, cabeças dos ossos e pontas (em metros, pés no chão)
    def vec(X, normalize=False):
        E = eyes.fit(X)
        J = np.array([X[s].mean(0) for s in head_sets]); Jt = np.array([X[s].mean(0) for s in tail_sets])
        P = np.concatenate([X[body_v], E, X[hair_v], J, Jt]) * DM
        lo, hi = X[body_v, 1].min() * DM, X[body_v, 1].max() * DM
        P[:, 1] -= lo
        if normalize:                      # a estatura vem da pessoa (escala uniforme no navegador): aqui só a forma
            P *= REF_H / (hi - lo)
        return P
    nh = len(hair_v); nj = len(order)
    sl_body = slice(0, nb); sl_eye = slice(nb, nb + ne); sl_hair = slice(nb + ne, nb + ne + nh)
    sl_j = slice(nb + ne + nh, nb + ne + nh + nj); sl_jt = slice(nb + ne + nh + nj, nb + ne + nh + 2 * nj)

    X0 = C.compose(NEUTRAL)
    P0 = vec(X0)

    # ---------------- rosto: amostras dos modificadores locais (simétricos) sobre o corpo neutro
    face_mods = [n for n, (g, pos, neg) in C.mods.items() if g in FACE_GROUPS and not FACE_SKIP.search(n)]
    print("modificadores do rosto:", len(face_mods))
    FS = []
    for i in range(a.nface):
        local = {}
        for n in face_mods:
            _, pos, neg = C.mods[n]
            if rng.random() < 0.55:
                continue
            v = rng.normal(0, 0.45)
            if not neg:
                v = abs(v)
            local[n] = float(np.clip(v, -1, 1))
        FS.append((vec(C.compose(NEUTRAL, local)) - P0)[: nb + ne + nh])
    FS = np.array(FS)
    support = np.where(np.abs(FS).max(axis=(0, 2)) > 1e-5)[0]
    fmean, fcomps, _, fvar, kf = pca(FS[:, support].reshape(len(FS), -1), 0.985, 48)
    fcomps = fcomps.reshape(kf, len(support), 3)
    fmean = fmean.reshape(len(support), 3)
    print(f"rosto: {len(support)} vértices, {kf} componentes, {fvar:.4f} da variância")

    # ---------------- correspondência MediaPipe (468 pontos) ↔ cabeça do corpo neutro
    src = open(a.canon, encoding="utf-8").read()
    canon = parse_ts_array(src, "CANON_POS").reshape(-1, 3) * 0.01
    cuv = parse_ts_array(src, "CANON_UV").reshape(-1, 2)
    ctri = parse_ts_array(src, "CANON_TRI", int).reshape(-1, 3)
    oval = parse_ts_array(src, "FACE_OVAL", int)
    tris_all = tri_split([f for f, g in zip(C.F, C.G) if g == "body"])
    B0 = P0[sl_body]
    head_y = P0[sl_j][bone_i["mixamorig:Neck"]][1]
    head_tris = tris_all[(B0[tris_all][:, :, 1].min(1) > head_y)]
    front = head_tris[(B0[head_tris][:, :, 2].mean(1) > B0[head_tris][:, :, 2].mean() - 0.01)]
    eyeL = P0[sl_eye][P0[sl_eye][:, 0] > 0].mean(0); eyeR = P0[sl_eye][P0[sl_eye][:, 0] < 0].mean(0)
    hv = np.unique(head_tris)
    nose = B0[hv[np.argmax(B0[hv, 2] - 2 * np.abs(B0[hv, 0]))]]
    ce_a = canon[[33, 133, 160, 158, 144, 153]].mean(0); ce_b = canon[[362, 263, 385, 387, 373, 380]].mean(0)
    c_eyeL, c_eyeR = (ce_a, ce_b) if ce_a[0] > ce_b[0] else (ce_b, ce_a)
    c_nose = canon[np.argmax(canon[:, 2])]
    s, R, t = umeyama(np.array([c_eyeL, c_eyeR, c_nose]), np.array([eyeL, eyeR, nose]))
    fit_c = np.zeros(kf)
    fsup = {v: k for k, v in enumerate(support)}
    sup_body = np.array([fsup.get(v, -1) for v in range(nb)])

    def head_now(c):
        B = B0.copy()
        m = sup_body >= 0
        B[m] += (fmean + np.tensordot(c, fcomps, 1))[sup_body[m]]
        return B
    Bf = B0
    for it in range(12):
        Q = (s * (R @ canon.T)).T + t
        ti, u, v, w, d = closest_on_tris(Q, Bf[front[:, 0]], Bf[front[:, 1]], Bf[front[:, 2]])
        corr = Bf[front[ti, 0]] * u[:, None] + Bf[front[ti, 1]] * v[:, None] + Bf[front[ti, 2]] * w[:, None]
        if it < 6:
            s, R, t = umeyama(canon, corr)
        else:
            # não rígido: a cabeça do MakeHuman se ajusta ao rosto canônico (forma do rosto, regularizada)
            rows = []; rhs = []
            for k in range(len(Q)):
                vs = front[ti[k]]; bb = np.array([u[k], v[k], w[k]])
                sidx = sup_body[vs]
                Bk = np.zeros((3, kf))
                for j in range(3):
                    if sidx[j] >= 0:
                        Bk += bb[j] * fcomps[:, sidx[j], :].T
                rows.append(Bk); rhs.append(Q[k] - (B0[vs] * bb[:, None]).sum(0) - sum(bb[j] * (fmean[sidx[j]] if sidx[j] >= 0 else 0) for j in range(3)))
            A_ = np.concatenate(rows); r_ = np.concatenate(rhs)
            fit_c = np.linalg.solve(A_.T @ A_ + 4e-3 * np.eye(kf), A_.T @ r_)
            Bf = head_now(fit_c)
            s, R, t = umeyama(canon, corr)
        print(f"registro {it}: erro médio {1000 * d.mean():.1f} mm, escala {s:.3f}")
    Q = (s * (R @ canon.T)).T + t
    ti, u, v, w, d = closest_on_tris(Q, Bf[front[:, 0]], Bf[front[:, 1]], Bf[front[:, 2]])
    lm_tri = front[ti]; lm_bary = np.stack([u, v, w], 1)
    print(f"correspondência final: {1000 * d.mean():.1f} mm (máx {1000 * d.max():.1f})")
    chin_v = int(hv[np.argmin(np.linalg.norm(B0[hv] - (B0[lm_tri[152]] * lm_bary[152][:, None]).sum(0), axis=1))])
    top_set = np.where(B0[:, 1] > B0[:, 1].max() - 0.012)[0]

    # UV canônico de cada vértice da cabeça (e dos olhos): ponto mais próximo no rosto canônico registrado
    def canon_uv(P):
        ti, u, v, w, d = closest_on_tris(P, Q[ctri[:, 0]], Q[ctri[:, 1]], Q[ctri[:, 2]])
        uv = cuv[ctri[ti, 0]] * u[:, None] + cuv[ctri[ti, 1]] * v[:, None] + cuv[ctri[ti, 2]] * w[:, None]
        return uv, d
    head_vs = hv[Bf[hv, 2] > t[2] - 0.06]
    huv, hd = canon_uv(Bf[head_vs])
    face_uv = np.zeros((nb, 2)); face_w = np.zeros(nb)
    face_uv[head_vs] = huv
    face_w[head_vs] = np.clip(1 - (hd - 0.004) / 0.012, 0, 1)
    Pf = P0[: nb + ne + nh].copy()
    Pf[support] += fmean + np.tensordot(fit_c, fcomps, 1)
    E_fit = Pf[nb: nb + ne]
    euv, ed = canon_uv(E_fit)
    print(f"olhos: distância média ao rosto canônico {1000 * ed.mean():.1f} mm")

    # ---------------- corpo: amostras do fenótipo + medidas locais
    print("amostrando corpos…")
    BS, PH = [], []
    labels = ["gender", "age", "muscle", "weight", "height", "proportions"]
    for i in range(a.nbody):
        fem = rng.random() < 0.5
        ph = dict(gender=float(np.clip(rng.normal(0.08 if fem else 0.92, 0.07), 0, 1)),
                  age=float(rng.uniform(0.5, 0.8)), muscle=float(np.clip(rng.normal(0.5, 0.2), 0, 1)),
                  weight=float(np.clip(rng.normal(0.5, 0.24), 0, 1)), height=float(rng.uniform(0.15, 0.85)),
                  proportions=float(rng.uniform(0.3, 1)), cupsize=float(rng.uniform(0.15, 0.9)) if fem else 0.5,
                  firmness=float(rng.uniform(0.3, 0.8)) if fem else 0.5)
        r = rng.dirichlet([1, 1, 1]); ph.update(african=float(r[0]), asian=float(r[1]), caucasian=float(r[2]))
        local = {n + "-decr-incr": float(np.clip(rng.normal(0, 0.3), -1, 1)) for n in BODY_MODS if rng.random() < 0.7}
        BS.append(vec(C.compose(ph, local), normalize=True))
        PH.append([ph[k] for k in labels])
        if i % 100 == 0:
            print(" ", i)
    BS = np.array(BS); PH = np.array(PH)
    npts = BS.shape[1]
    bmean, bcomps, Zb, bvar, kb = pca(BS.reshape(len(BS), -1), 0.995, 40)
    bmean = bmean.reshape(npts, 3); bcomps = bcomps.reshape(kb, npts, 3)
    print(f"corpo: {kb} componentes, {bvar:.4f} da variância")

    # ---------------- medidas (as mesmas definições da foto: lib/avatar3d/body.ts)
    wmat = np.zeros((nb, nj))
    for b, lst in wts.items():
        if b not in bone_i:
            continue
        for vtx, ww in lst:
            if vtx < nb:
                wmat[vtx, bone_i[b]] += ww
    dom = wmat.argmax(1)
    arm_bones = {i for b, i in bone_i.items() if re.search(r"(Arm|ForeArm|Hand)", b)}
    torso_mask = np.array([d_ not in arm_bones for d_ in dom])

    tor_tris = tris_all[torso_mask[tris_all].all(1)]
    edges = np.unique(np.sort(np.concatenate([tor_tris[:, [0, 1]], tor_tris[:, [1, 2]], tor_tris[:, [2, 0]]]), 1), axis=0)

    def section(B, y):
        """Corte horizontal exato do tronco (e das coxas) na altura y: largura (x) e profundidade (z)."""
        pa, pb = B[edges[:, 0]], B[edges[:, 1]]
        m = (pa[:, 1] - y) * (pb[:, 1] - y) < 0
        if m.sum() < 6:
            return 0.0, 0.0
        tt = (y - pa[m, 1]) / (pb[m, 1] - pa[m, 1])
        q = pa[m] + (pb[m] - pa[m]) * tt[:, None]
        return q[:, 0].max() - q[:, 0].min(), q[:, 2].max() - q[:, 2].min()

    def measures(P):
        B = P[sl_body]; J = P[sl_j]
        H = B[top_set, 1].max() - B[:, 1].min()
        jl = lambda n: J[bone_i["mixamorig:" + n]]
        sh = (jl("LeftArm") + jl("RightArm")) / 2; hip = (jl("LeftUpLeg") + jl("RightUpLeg")) / 2
        span = sh[1] - hip[1]
        cw, cd = section(B, sh[1] - 0.28 * span)
        waist = min((section(B, sh[1] - f * span) for f in np.arange(0.45, 0.8001, 0.05)), key=lambda r: r[0])
        hips = max((section(B, hip[1] - f * H) for f in np.arange(0, 0.1201, 0.03)), key=lambda r: r[0])
        arm = np.linalg.norm(jl("LeftArm") - jl("LeftForeArm")) + np.linalg.norm(jl("LeftForeArm") - jl("LeftHand"))
        chin = B[chin_v, 1]
        return [H, np.linalg.norm(jl("LeftArm") - jl("RightArm")) / H, cw / H, waist[0] / H, hips[0] / H,
                hip[1] / H, arm / H, (B[top_set, 1].max() - chin) / H, cd / H, waist[1] / H, hips[1] / H]
    mnames = ["stature", "shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "headH", "chestD", "waistD", "hipD"]
    M = np.array([measures(P) for P in BS])
    Y = np.concatenate([M, PH], 1); ynames = mnames + labels
    Xr = np.concatenate([np.ones((len(Zb), 1)), Zb], 1)
    coef, *_ = np.linalg.lstsq(Xr, Y, rcond=None)
    pred = Xr @ coef
    r2 = 1 - ((Y - pred) ** 2).sum(0) / ((Y - Y.mean(0)) ** 2).sum(0)
    rmse = np.sqrt(((Y - pred) ** 2).mean(0))
    for n, r, e, lo, hi in zip(ynames, r2, rmse, Y.min(0), Y.max(0)):
        print(f"  {n:12s} R²={r:.3f} erro={e:.4f} faixa=[{lo:.3f}, {hi:.3f}]")

    # ---------------- malha de desenho: UV do MakeHuman (vértices duplicados nas costuras)
    body_faces = [(f, ft) for f, ft, g in zip(C.F, C.FT, C.G) if g == "body"]
    keymap = {}; rv = []; ruv = []; rtris = []
    for f, ft in body_faces:
        ids = []
        for vtx, vt in zip(f, ft):
            k = (vtx, vt)
            if k not in keymap:
                keymap[k] = len(rv); rv.append(vtx); ruv.append(C.VT[vt])
            ids.append(keymap[k])
        for k in range(1, len(ids) - 1):
            rtris.append([ids[0], ids[k], ids[k + 1]])
    rv = np.array(rv); ruv = np.array(ruv); rtris = np.array(rtris)
    ekey = {}; erv = []; eruv = []; etris = []
    for f, ft in zip(eyes.F, eyes.FT):
        ids = []
        for vtx, vt in zip(f, ft):
            k = (vtx, vt)
            if k not in ekey:
                ekey[k] = len(erv); erv.append(vtx); eruv.append(eyes.VT[vt])
            ids.append(ekey[k])
        for k in range(1, len(ids) - 1):
            etris.append([ids[0], ids[k], ids[k + 1]])
    erv = np.array(erv); eruv = np.array(eruv); etris = np.array(etris)
    hair_faces = [f for f, g in zip(C.F, C.G) if g == "helper-hair"]
    hmap = {v: i for i, v in enumerate(hair_v)}
    htris = np.array([[hmap[x] for x in t_] for t_ in tri_split(hair_faces)])

    # pesos de pele: 4 maiores por vértice (olhos herdam dos vértices de referência do encaixe)
    def top4(W):
        idx = np.argsort(-W, 1)[:, :4]; ww = np.take_along_axis(W, idx, 1)
        ww = ww / np.maximum(ww.sum(1, keepdims=True), 1e-9)
        q = np.round(ww * 255).astype(int); q[:, 0] += 255 - q.sum(1)
        return idx.astype(np.uint8), q.astype(np.uint8)
    wfull = np.zeros((len(C.V), nj))
    for b, lst in wts.items():
        if b in bone_i:
            for vtx, ww in lst:
                wfull[vtx, bone_i[b]] += ww
    Wb = wfull[body_v]; We = np.einsum("nk,nkj->nj", eyes.wts, wfull[eyes.refs]); Wh = wfull[hair_v]

    # ---------------- gravação
    os.makedirs(a.out, exist_ok=True)
    blob = bytearray(); layout = {}

    def put(name, arr, dtype):
        nonlocal blob
        arr = np.ascontiguousarray(arr, dtype=dtype)
        while len(blob) % 4:
            blob += b"\0"
        layout[name] = {"offset": len(blob), "length": int(arr.size), "type": np.dtype(dtype).name, "shape": list(arr.shape)}
        blob += arr.tobytes()

    def put_q(name, comps):
        scale = np.abs(comps).reshape(len(comps), -1).max(1) / 32767
        put(name, np.round(comps / scale[:, None, None]), np.int16)
        layout[name]["scale"] = [float(x) for x in scale]

    mean_all = bmean
    put("body.position", mean_all[sl_body], np.float32)
    put("eye.position", mean_all[sl_eye], np.float32)
    put("hair.position", mean_all[sl_hair], np.float32)
    put_q("shape.body", bcomps[:, sl_body]); put_q("shape.eye", bcomps[:, sl_eye]); put_q("shape.hair", bcomps[:, sl_hair])
    put("shape.joints", bcomps[:, sl_j], np.float32); put("shape.tails", bcomps[:, sl_jt], np.float32)
    put("body.render.vertex", rv, np.uint16); put("body.render.uv", ruv, np.float32); put("body.render.index", rtris, np.uint16)
    put("eye.render.vertex", erv, np.uint16); put("eye.render.uv", eruv, np.float32); put("eye.render.index", etris, np.uint16)
    put("hair.index", htris, np.uint16)
    for nm, W in (("body", Wb), ("eye", We), ("hair", Wh)):
        i4, w4 = top4(W); put(nm + ".skin.index", i4, np.uint8); put(nm + ".skin.weight", w4, np.uint8)
    put("face.support", support, np.uint16)
    put("face.mean", fmean, np.float32)
    put_q("face.shape", fcomps)
    put("face.uv", face_uv, np.float32); put("face.weight", np.round(face_w * 255), np.uint8)
    put("eye.faceUv", euv, np.float32)
    put("landmark.tri", lm_tri, np.uint16); put("landmark.bary", lm_bary, np.float32)
    put("torso", torso_mask.astype(np.uint8), np.uint8)
    open(os.path.join(a.out, FORMAT + ".bin"), "wb").write(bytes(blob))

    meta = {
        "format": FORMAT,
        "units": "m, y para cima, frente +z, pés em y=0",
        "license": "Malha, alvos, esqueleto e pesos: MakeHuman/MPFB2, CC0 1.0. Olhos: MakeHuman 1.x, CC0 1.0. "
                   "Correspondência com o MediaPipe Face Mesh (Apache-2.0). Exportado por scripts/avatar3d/body-export/export_body.py.",
        "counts": {"body": nb, "eye": ne, "hair": nh, "bones": nj, "bodyShape": kb, "faceShape": kf, "landmarks": len(canon)},
        "bones": [{"name": b, "parent": bone_i[rig[b]["parent"]] if rig[b]["parent"] else -1} for b in order],
        "joints": mean_all[sl_j].round(6).tolist(), "tails": mean_all[sl_jt].round(6).tolist(),
        "variance": {"body": round(float(bvar), 5), "face": round(float(fvar), 5)},
        "regression": {"names": ynames, "coef": coef.T.round(7).tolist(), "r2": r2.round(4).tolist(), "rmse": rmse.round(5).tolist(),
                       "min": Y.min(0).round(5).tolist(), "max": Y.max(0).round(5).tolist()},
        "faceFit": {"lambda": 4e-3, "canonScale": float(s), "canonRotation": R.round(6).tolist(), "canonTranslation": t.round(6).tolist(),
                    "templateCoef": fit_c.round(5).tolist()},
        "vertices": {"chin": chin_v, "top": top_set.tolist(), "sole": np.argsort(B0[:, 1])[:60].tolist()},
        "layout": layout,
        "samples": {"body": a.nbody, "face": a.nface, "seed": a.seed},
    }
    json.dump(meta, open(os.path.join(a.out, FORMAT + ".json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("ok", len(blob) / 1e6, "MB", {k: v["length"] for k, v in layout.items() if v["length"] > 100000})


if __name__ == "__main__":
    main()
