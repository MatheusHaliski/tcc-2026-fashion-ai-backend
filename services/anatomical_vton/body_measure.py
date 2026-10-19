"""Medidas do Avatar 3D a partir da malha do corpo reconstruída na GPU (SAM 3D Body / MHR).

Entrada: os vértices da malha (N×3, metros, em qualquer referencial da câmera) e os 70 primeiros pontos MHR em 3D.
Saída: as mesmas proporções de ``lib/avatar3d/body-spec.ts`` (todas divididas pela estatura da própria malha), de modo
que a escala ambígua de uma foto só não importa: a altura em centímetros continua vindo da pessoa.

Nada aqui devolve a malha nem pontos do corpo: só as proporções e os avisos (minimização do dado biométrico).
Medida que cai fora da faixa plausível de um adulto é recusada, nunca "corrigida".
"""
import numpy as np

# Índices dos 70 primeiros pontos MHR (sam_3d_body/metadata/mhr70.py).
KP = {'nose':0,'l_shoulder':5,'r_shoulder':6,'l_elbow':7,'r_elbow':8,'l_hip':9,'r_hip':10,'l_knee':11,'r_knee':12,
      'l_ankle':13,'r_ankle':14,'l_heel':17,'r_heel':20,'r_wrist':41,'l_wrist':62,'l_acromion':67,'r_acromion':68,'neck':69}

# Faixas de BODY_RANGE (lib/avatar3d/body-spec.ts): fora delas a medida é recusada.
RANGES = {'shoulderW':(0.15,0.26),'chestW':(0.13,0.26),'waistW':(0.11,0.26),'hipW':(0.15,0.27),'legLen':(0.46,0.58),
          'armLen':(0.29,0.38),'chestD':(0.08,0.22),'waistD':(0.07,0.24),'hipD':(0.08,0.24)}

BAND = 0.0035           # meia espessura da fatia horizontal, em fração da estatura
ARM_RADIUS = 0.041      # vértices a menos disto do braço/antebraço não contam como tronco (fração da estatura)
HAND_RADIUS = 0.065     # e a menos disto do punho (mão)
MIN_SLICE_POINTS = 24


def _unit(v):
    n = np.linalg.norm(v)
    if not np.isfinite(n) or n < 1e-9:raise ValueError('DEGENERATE_BODY_FRAME')
    return v / n


def body_frame(kp):
    """Eixos do corpo: para cima (tornozelos → ombros), lateral (quadril esquerdo → direito) e frente."""
    up = _unit((kp[KP['l_shoulder']] + kp[KP['r_shoulder']]) / 2 - (kp[KP['l_ankle']] + kp[KP['r_ankle']]) / 2)
    lateral = kp[KP['r_hip']] - kp[KP['l_hip']]
    lateral = _unit(lateral - np.dot(lateral, up) * up)
    return up, lateral, np.cross(up, lateral)


def _segment_distance(points, a, b):
    ab = b - a
    t = np.clip(((points - a) @ ab) / max(float(ab @ ab), 1e-12), 0.0, 1.0)
    return np.linalg.norm(points - (a + t[:, None] * ab), axis=1)


def measure_body(vertices, keypoints):
    v = np.asarray(vertices, dtype=np.float64)
    kp = np.asarray(keypoints, dtype=np.float64)
    if v.ndim != 2 or v.shape[1] != 3 or len(v) < 1000 or not np.isfinite(v).all():raise ValueError('INVALID_BODY_MESH')
    if kp.ndim != 2 or kp.shape[0] < 70 or kp.shape[1] != 3 or not np.isfinite(kp[:70]).all():raise ValueError('INVALID_BODY_KEYPOINTS')
    kp = kp[:70]
    up, lateral, forward = body_frame(kp)
    height = v @ up
    floor, top = float(height.min()), float(height.max())
    stature = top - floor
    if not stature > 1e-3:raise ValueError('IMPLAUSIBLE_BODY_SCALE')   # a escala absoluta não importa: tudo vira fração da estatura
    h = lambda p: float(p @ up) - floor

    # Braços e mãos não entram nas fatias do tronco.
    arm = np.zeros(len(v), dtype=bool)
    for side in ('l', 'r'):
        acromion, elbow, wrist = kp[KP[f'{side}_acromion']], kp[KP[f'{side}_elbow']], kp[KP[f'{side}_wrist']]
        arm |= _segment_distance(v, acromion, elbow) < ARM_RADIUS * stature
        arm |= _segment_distance(v, elbow, wrist) < ARM_RADIUS * stature
        arm |= np.linalg.norm(v - wrist, axis=1) < HAND_RADIUS * stature
    torso = ~arm
    x, z = v @ lateral, v @ forward

    warnings, refused, ratios = [], {}, {}
    hip_mid = (kp[KP['l_hip']] + kp[KP['r_hip']]) / 2
    hip_half = abs(float((kp[KP['r_hip']] - kp[KP['l_hip']]) @ lateral)) / 2
    for side in ('l', 'r'):
        if abs(float((kp[KP[f'{side}_wrist']] - hip_mid) @ lateral)) < hip_half + 0.035 * stature:
            warnings.append('ARMS_CLOSE_TO_BODY')      # mãos rentes ao quadril: largura do quadril fica duvidosa
            break

    def slice_at(level):
        sel = torso & (np.abs(height - floor - level) < BAND * stature)
        if sel.sum() < MIN_SLICE_POINTS:return None
        xs, zs = x[sel], z[sel]
        return float(np.percentile(xs, 98) - np.percentile(xs, 2)), float(np.percentile(zs, 98) - np.percentile(zs, 2))

    shoulder_h = (h(kp[KP['l_shoulder']]) + h(kp[KP['r_shoulder']])) / 2
    hip_h = (h(kp[KP['l_hip']]) + h(kp[KP['r_hip']])) / 2
    span = shoulder_h - hip_h
    if span <= 0.1 * stature:raise ValueError('IMPLAUSIBLE_BODY_PROPORTIONS')

    def scan(lo, hi, pick):
        found = []
        for s in np.linspace(lo, hi, 15):
            m = slice_at(hip_h + s * span)
            if m:found.append(m)
        return pick(found, key=lambda wd: wd[0]) if found else None

    chest = scan(0.58, 0.74, max)       # tórax: a maior largura abaixo das axilas
    waist = scan(0.15, 0.50, min)       # cintura: a menor largura entre quadril e tórax
    hip = scan(-0.20, 0.12, max)        # quadril: a maior largura em volta da articulação
    for name, m in (('chest', chest), ('waist', waist), ('hip', hip)):
        if m is None:
            refused[f'{name}W'] = refused[f'{name}D'] = 'SLICE_WITHOUT_TORSO'
            continue
        ratios[f'{name}W'], ratios[f'{name}D'] = m[0] / stature, m[1] / stature
    if 'ARMS_CLOSE_TO_BODY' in warnings and 'hipW' in ratios:
        ratios.pop('hipW'); refused['hipW'] = 'ARMS_CLOSE_TO_BODY'

    ratios['shoulderW'] = float(np.linalg.norm(kp[KP['l_shoulder']] - kp[KP['r_shoulder']])) / stature
    ratios['legLen'] = hip_h / stature
    arms = [float(np.linalg.norm(kp[KP[f'{s}_acromion']] - kp[KP[f'{s}_elbow']]) + np.linalg.norm(kp[KP[f'{s}_elbow']] - kp[KP[f'{s}_wrist']]))
            for s in ('l', 'r')]
    ratios['armLen'] = sum(arms) / 2 / stature

    out = {}
    for key, value in ratios.items():
        lo, hi = RANGES[key]
        if np.isfinite(value) and lo <= value <= hi:out[key] = round(float(value), 4)
        else:refused[key] = 'OUT_OF_ADULT_RANGE'
    return {'ratios': out, 'refused': refused, 'warnings': sorted(set(warnings)), 'meshStatureM': round(stature, 4)}
