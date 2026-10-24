"""Medidas do Avatar 3D tiradas da malha da GPU: um corpo sintético com medidas conhecidas, em pose A."""
import numpy as np
import pytest
from services.anatomical_vton.body_measure import KP, measure_body

STATURE = 1.70


def torso_width(y):
    """Largura do tronco (m) por altura: quadril 0,34 em 0,90; cintura 0,27 em 1,05; tórax 0,31 em 1,22."""
    return float(np.interp(y, [0.86, 0.90, 1.05, 1.22, 1.33, 1.38], [0.30, 0.34, 0.27, 0.31, 0.30, 0.26]))


def torso_depth(y):
    return float(np.interp(y, [0.86, 0.90, 1.05, 1.22, 1.38], [0.22, 0.24, 0.20, 0.23, 0.18]))


def cylinder(a, b, r, n=60, steps=80):
    a, b = np.asarray(a, float), np.asarray(b, float)
    axis = (b - a) / np.linalg.norm(b - a)
    u = np.cross(axis, [0, 0, 1.0]); u /= np.linalg.norm(u); w = np.cross(axis, u)
    t = np.linspace(0, 1, steps)[:, None, None]; ang = np.linspace(0, 2 * np.pi, n, endpoint=False)[None, :, None]
    pts = a + t * (b - a) + r * (np.cos(ang) * u + np.sin(ang) * w)
    return pts.reshape(-1, 3)


def sphere(c, r, n=40):
    phi, th = np.meshgrid(np.linspace(0, np.pi, n), np.linspace(0, 2 * np.pi, n))
    return (np.asarray(c, float) + r * np.stack([np.sin(phi) * np.cos(th), np.cos(phi), np.sin(phi) * np.sin(th)], -1)).reshape(-1, 3)


def body(wrist_x=0.36):
    parts = []
    for y in np.arange(0.86, 1.385, 0.002):                       # tronco: elipses empilhadas
        ang = np.linspace(0, 2 * np.pi, 90, endpoint=False)
        parts.append(np.stack([torso_width(y) / 2 * np.cos(ang), np.full_like(ang, y), torso_depth(y) / 2 * np.sin(ang)], -1))
    for sx in (-1, 1):
        parts.append(cylinder([sx * 0.09, 0.0, 0], [sx * 0.09, 0.88, 0], 0.07))          # pernas
        parts.append(cylinder([sx * 0.20, 1.40, 0], [sx * 0.30, 1.13, 0], 0.045))        # braço
        parts.append(cylinder([sx * 0.30, 1.13, 0], [sx * wrist_x, 0.88, 0], 0.04))      # antebraço
        parts.append(sphere([sx * wrist_x, 0.83, 0], 0.05))                              # mão
    parts.append(cylinder([0, 1.38, 0], [0, 1.50, 0], 0.06))                             # pescoço
    parts.append(sphere([0, 1.59, 0], 0.11))                                             # cabeça (topo em 1,70)
    v = np.concatenate(parts)
    kp = np.zeros((70, 3))
    for name, p in {'nose': (0, 1.58, 0.1), 'neck': (0, 1.45, 0), 'l_shoulder': (-0.18, 1.38, 0), 'r_shoulder': (0.18, 1.38, 0),
                    'l_acromion': (-0.20, 1.40, 0), 'r_acromion': (0.20, 1.40, 0), 'l_elbow': (-0.30, 1.13, 0), 'r_elbow': (0.30, 1.13, 0),
                    'l_wrist': (-wrist_x, 0.88, 0), 'r_wrist': (wrist_x, 0.88, 0), 'l_hip': (-0.09, 0.90, 0), 'r_hip': (0.09, 0.90, 0),
                    'l_knee': (-0.09, 0.48, 0), 'r_knee': (0.09, 0.48, 0), 'l_ankle': (-0.09, 0.08, 0), 'r_ankle': (0.09, 0.08, 0),
                    'l_heel': (-0.09, 0.02, -0.03), 'r_heel': (0.09, 0.02, -0.03)}.items():
        kp[KP[name]] = p
    return v, kp


def test_synthetic_body_gives_the_known_proportions_of_its_stature():
    out = measure_body(*body())
    r = out['ratios']
    assert out['meshStatureM'] == pytest.approx(STATURE, abs=0.005)
    assert r['chestW'] == pytest.approx(0.31 / STATURE, abs=0.006)
    assert r['waistW'] == pytest.approx(0.27 / STATURE, abs=0.006)
    assert r['hipW'] == pytest.approx(0.34 / STATURE, abs=0.006)
    assert r['chestD'] == pytest.approx(0.23 / STATURE, abs=0.006)
    assert r['waistD'] == pytest.approx(0.20 / STATURE, abs=0.006)
    assert r['hipD'] == pytest.approx(0.24 / STATURE, abs=0.006)
    assert r['shoulderW'] == pytest.approx(0.36 / STATURE, abs=0.002)
    assert r['legLen'] == pytest.approx(0.90 / STATURE, abs=0.002)
    assert r['armLen'] == pytest.approx((np.hypot(0.10, 0.27) + np.hypot(0.06, 0.25)) / STATURE, abs=0.002)
    assert out['refused'] == {} and out['warnings'] == []


def test_camera_frame_does_not_matter_rotation_translation_and_scale():
    v, kp = body()
    rng = np.random.default_rng(7)
    q, _ = np.linalg.qr(rng.normal(size=(3, 3)))
    if np.linalg.det(q) < 0:q[:, 0] *= -1
    move = lambda p: 2.3 * (p @ q.T) + np.array([0.4, -1.2, 3.5])  # câmera arbitrária e escala ambígua da foto
    a, b = measure_body(v, kp)['ratios'], measure_body(move(v), move(kp))['ratios']
    for key in a:
        assert b[key] == pytest.approx(a[key], abs=1e-3)


def test_hands_resting_on_the_hips_make_the_hip_width_refused_not_guessed():
    out = measure_body(*body(wrist_x=0.13))
    assert 'ARMS_CLOSE_TO_BODY' in out['warnings']
    assert 'hipW' not in out['ratios'] and out['refused']['hipW'] == 'ARMS_CLOSE_TO_BODY'
    assert 'chestW' in out['ratios'] and 'waistW' in out['ratios']


def test_measure_outside_the_adult_range_is_refused():
    v, kp = body()
    wide = v.copy(); band = (wide[:, 1] > 1.15) & (wide[:, 1] < 1.30) & (np.abs(wide[:, 0]) < 0.17)
    wide[band, 0] *= 3.0                                             # tórax impossível: ~0,55 da estatura
    out = measure_body(wide, kp)
    assert out['refused'].get('chestW') == 'OUT_OF_ADULT_RANGE' and 'chestW' not in out['ratios']


@pytest.mark.parametrize('vertices,keypoints,code', [
    (np.zeros((10, 3)), np.zeros((70, 3)), 'INVALID_BODY_MESH'),
    (np.full((2000, 3), np.nan), np.zeros((70, 3)), 'INVALID_BODY_MESH'),
])
def test_invalid_input_is_rejected_with_a_short_code(vertices, keypoints, code):
    with pytest.raises(ValueError, match=code):measure_body(vertices, keypoints)


def test_output_never_carries_the_mesh_or_the_keypoints():
    out = measure_body(*body())
    assert set(out) == {'ratios', 'refused', 'warnings', 'meshStatureM'}
