"""A peça na foto: máscara da roupa de cima a partir dos rótulos do segmentador de pessoas (fashn-human-parser, 18
classes) e os pontos de referência que ligam a foto à peça 3D — alto da peça (linha do ombro), barra, eixo do centro
da frente e a escala em pixels por metro.

Tudo aqui é numpy/scipy sobre o mapa de rótulos (o segmentador roda em ``segmentador.py``): os testes usam mapas
sintéticos.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import ndimage

TOP, DRESS = 3, 4                 # a regata e o body às vezes saem como vestido: as duas são a peça de cima
FACE, HAIR = 1, 2
PERSON = (1, 2, 12, 13, 14, 15, 16)   # rosto, cabelo, braços, mãos, pernas, pés, tronco (pele): alguém vestindo
FACE_M = 0.185                    # altura do rosto (queixo à linha do cabelo) de um adulto, em metros


def garment_mask(labels: np.ndarray, lab: np.ndarray | None = None) -> np.ndarray:
    """Máscara da peça de cima: rótulos de blusa ∪ vestido, buracos fechados (a estampa às vezes sai com outro rótulo)
    — menos onde há pessoa por cima (cabelo e mão sobre a peça não são estampa) e menos o vão entre o braço e o tronco
    (``lab``: a foto em Lab, para reconhecer o fundo que aparece pelo vão) — e só os pedaços grandes."""
    m = np.isin(labels, (TOP, DRESS))
    if not m.any():
        return m
    person = np.isin(labels, PERSON)
    holes = ndimage.binary_fill_holes(m) & ~person & ~m
    if lab is not None:
        holes &= ~_gaps(holes, labels, m, lab)
    m = ndimage.binary_opening(m | holes, iterations=2)
    comps, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, comps, range(1, n + 1))
    keep = np.flatnonzero(sizes >= sizes.max() * 0.15) + 1
    return np.isin(comps, keep)


def background(labels: np.ndarray, lab: np.ndarray) -> np.ndarray | None:
    """Cor (Lab) do fundo da foto: a mediana do que o segmentador deixou como fundo na borda; None sem fundo à vista."""
    border = np.zeros(labels.shape, bool)
    k = max(2, int(0.05 * min(labels.shape)))
    border[:k], border[-k:], border[:, :k], border[:, -k:] = True, True, True, True
    px = lab[border & (labels == 0)]
    return np.median(px, 0) if len(px) >= 200 else None


def _gaps(holes: np.ndarray, labels: np.ndarray, m: np.ndarray, lab: np.ndarray) -> np.ndarray:
    """Buracos da máscara que são o fundo da foto aparecendo (entre o braço e o tronco, pela alça): rotulados como
    fundo, da cor do fundo da borda da foto e fora do meio do peito (ali o buraco de fundo claro pode ser a estampa
    branca que o segmentador não rotulou como peça)."""
    out = np.zeros_like(holes)
    bg = background(labels, lab)
    if bg is None:
        return out
    cols = np.flatnonzero(m.any(0))
    center, width = (cols[0] + cols[-1]) / 2, cols[-1] - cols[0] + 1
    comps, n = ndimage.label(holes & (labels == 0))
    for i, sl in enumerate(ndimage.find_objects(comps), start=1):
        comp = comps[sl] == i
        cx = (sl[1].start + sl[1].stop) / 2
        if abs(cx - center) < 0.15 * width:
            continue
        near = np.abs(lab[sl][comp] - bg).max(-1) < 12
        if near.mean() > 0.8:
            out[sl] |= comp
    return out


@dataclass(frozen=True)
class Frame:
    """Referências da peça na foto (pixels): ``top`` linha do ombro, ``hem`` barra, ``center`` eixo da frente."""
    top: int
    hem: int
    center: float
    left: int
    right: int
    worn: bool                 # alguém veste a peça (foto em modelo); senão é foto da peça sozinha
    top_cut: bool              # a peça encosta na borda de cima da foto (o alto não aparece)
    hem_cut: bool              # a barra encosta na borda de baixo (cortada pela foto)
    face_h: float | None       # altura do rosto (px), quando aparece
    back_view: bool            # cabelo sem rosto: a foto é das costas
    symmetry: float            # IoU da máscara com o espelho dela no eixo: < 0,75 é pose de lado
    area: float                # fração da foto ocupada pela peça

    chin: int | None = None    # linha do queixo (px), quando o rosto aparece inteiro

    @property
    def height(self) -> int:
        return self.hem - self.top


def frame_of(labels: np.ndarray, mask: np.ndarray, hooded: bool = False) -> Frame | None:
    """Referências da peça; None sem peça. ``hooded``: peça com capuz (o alto da máscara é o capuz, não o ombro)."""
    rows, cols = np.nonzero(mask)
    if len(rows) < 200:
        return None
    h, w = mask.shape
    top, hem = int(rows.min()), int(rows.max())
    center = _center(mask, top, hem)
    if hooded:   # o alto da foto é o capuz: a linha do ombro é o alto da peça ao lado dele
        top = _shoulder_top(mask, center, int(cols.max()) - int(cols.min()), top)
    face = labels == FACE
    face_rows = np.nonzero(face.any(1))[0]
    face_h = float(face_rows.max() - face_rows.min() + 1) if face.sum() > 0.0015 * mask.size and len(face_rows) else None
    if face_h and face_rows.min() <= 2:   # a foto corta a testa: a altura do rosto não serve de régua
        face_h = None
    chin = int(face_rows.max()) if face_h else None
    person = np.isin(labels, PERSON).sum() > 0.01 * mask.size
    hair = (labels == HAIR).sum() > 0.004 * mask.size
    frame = Frame(top, hem, center, int(cols.min()), int(cols.max()), worn=bool(person or face_h), chin=chin,
                 top_cut=top <= 1, hem_cut=hem >= h - 2, face_h=face_h,
                 back_view=bool(hair and face_h is None and person), symmetry=_symmetry(mask, center),
                 area=float(mask.mean()))
    return frame


def _shoulder_top(mask: np.ndarray, center: float, width: int, fallback: int) -> int:
    """Alto da peça nas faixas dos ombros (de 18 % a 30 % da largura para cada lado do eixo), onde o capuz não
    chega: a mediana das primeiras linhas de peça de cada coluna."""
    tops = []
    for sign in (-1, 1):
        for x in range(int(center + sign * 0.18 * width), int(center + sign * 0.30 * width), sign):
            if 0 <= x < mask.shape[1] and mask[:, x].any():
                tops.append(int(np.argmax(mask[:, x])))
    return int(np.median(tops)) if tops else fallback


def _center(mask: np.ndarray, top: int, hem: int) -> float:
    """Eixo do centro da frente: o meio do trecho de peça que passa pelo centroide, nas linhas do peito à cintura
    (mediana: um braço dobrado de um lado não puxa o eixo)."""
    cx = float(np.nonzero(mask)[1].mean())
    mids = []
    for y in np.linspace(top + 0.2 * (hem - top), top + 0.6 * (hem - top), 12).astype(int):
        row = mask[y]
        if not row.any():
            continue
        xs = np.flatnonzero(row)
        runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
        run = min(runs, key=lambda r: 0 if r[0] <= cx <= r[-1] else min(abs(r[0] - cx), abs(r[-1] - cx)))
        mids.append((run[0] + run[-1]) / 2)
    return float(np.median(mids)) if mids else cx


def _symmetry(mask: np.ndarray, center: float) -> float:
    """IoU da máscara com o espelho dela em torno do eixo (peça de frente ≈ 0,9; pose de lado < 0,7)."""
    h, w = mask.shape
    xs = np.arange(w)
    mirror_x = np.round(2 * center - xs).astype(int)
    valid = (mirror_x >= 0) & (mirror_x < w)
    mirrored = np.zeros_like(mask)
    mirrored[:, valid] = mask[:, mirror_x[valid]]
    inter = (mask & mirrored).sum()
    union = (mask | mirrored).sum()
    return float(inter / union) if union else 0.0


def pixels_per_meter(frame: Frame, length_m: float) -> tuple[float, str]:
    """Escala da foto: pela altura da peça (do ombro à barra = ``length_m`` da ficha) quando a peça aparece inteira;
    pela altura do rosto quando a barra some (cortada, por dentro da calça) ou as duas discordam muito."""
    by_face = frame.face_h / FACE_M if frame.face_h else None
    if frame.top_cut or frame.hem_cut:
        return (by_face, "rosto") if by_face else (frame.height / length_m, "peca_cortada")
    by_length = frame.height / length_m
    if by_face and not 0.74 < by_length / by_face < 1.35:   # barra para dentro da calça ou peça bem maior que a ficha
        return by_face, "rosto"
    return by_length, "comprimento"


SKIN, ARMS = 16, 12


def body_hints(labels: np.ndarray, mask: np.ndarray, frame: Frame) -> dict:
    """O que a pessoa na foto diz da peça: o comprimento dela (pela altura do rosto), se a barriga aparece logo abaixo
    da barra (cropped de verdade, não para dentro da calça) e quanto braço aparece (manga curta ou longa)."""
    arms, area = labels == ARMS, max(1, mask.sum())
    split = frame.top + int(0.3 * frame.height)   # alto do braço (ombro até um pouco abaixo da axila) e o resto
    out = {"bracos": round(float(arms.sum() / area), 4), "braco_alto": round(float(arms[:split].sum() / area), 4),
           "braco_baixo": round(float(arms[split:].sum() / area), 4)}
    if not frame.worn or not frame.face_h or frame.hem_cut or frame.top_cut or frame.back_view:
        return out
    out["comprimento_foto"] = round(frame.height / (frame.face_h / FACE_M), 3)
    if frame.chin is not None:   # do queixo ao alto da peça: ~5–12 cm com alça ou manga, 17 cm ou mais no tomara que caia
        out["topo_abaixo_queixo"] = round((frame.top - frame.chin) / (frame.face_h / FACE_M), 3)
    width = frame.right - frame.left
    cols = range(int(frame.center - 0.3 * width), int(frame.center + 0.3 * width))
    reach = max(3, int(0.04 * frame.height))
    skin = seen = 0
    for x in cols:
        ys = np.flatnonzero(mask[:, x]) if 0 <= x < mask.shape[1] else []
        if len(ys) == 0:
            continue
        seen += 1
        below = labels[ys[-1] + 1:ys[-1] + 1 + reach, x]
        skin += bool((below == SKIN).any())
    out["pele_abaixo"] = round(skin / max(1, seen), 3)
    return out


def image_score(frame: Frame | None) -> float:
    """Quão boa é a foto para ler estampa e logo: peça inteira, de frente, grande; foto da peça sozinha ganha."""
    if frame is None or frame.back_view:
        return 0.0
    s = min(1.0, frame.area / 0.15) * min(1.0, max(0.0, frame.symmetry - 0.45) / 0.4)
    s *= 0.5 if frame.top_cut or frame.hem_cut else 1.0
    return s * (1.0 if not frame.worn else 0.85)
