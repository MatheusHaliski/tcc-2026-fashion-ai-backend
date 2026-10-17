"""Mixed hard/soft thin-plate splines with measurable, fail-closed acceptance."""
import numpy as np
from scipy.spatial.distance import cdist
from scipy.ndimage import map_coordinates
from .models import AlignmentError, WarpResult


def kernel(a, b):
    r2 = cdist(a, b, 'sqeuclidean')
    return r2 * np.log(np.maximum(r2, 1e-20))


class ConstrainedTPS:
    def __init__(self, source, target, hard, weights, rigidity=.002):
        if not np.isfinite(rigidity) or rigidity < 0:
            raise AlignmentError('INVALID_RIGIDITY')
        self.origin = np.mean(source, axis=0)
        self.scale = max(float(np.ptp(source, axis=0).max()), 1)
        self.controls = (source-self.origin)/self.scale
        n = len(source)
        if len(np.unique(source, axis=0)) != n or np.linalg.matrix_rank(np.c_[np.ones(n), source]) < 3:
            raise AlignmentError('DEGENERATE_TPS_CONTROLS')
        if np.any(weights <= 0) or not np.isfinite(weights).all():
            raise AlignmentError('INVALID_CONSTRAINT_WEIGHTS')
        p = np.c_[np.ones(n), self.controls]
        k = kernel(self.controls, self.controls)
        # Hard rows have exactly zero regularization; soft rows absorb residuals.
        k += np.diag(np.where(hard, 0., rigidity/weights))
        matrix = np.block([[k, p], [p.T, np.zeros((3, 3))]])
        if np.linalg.cond(matrix) > 1e12:
            raise AlignmentError('ILL_CONDITIONED_TPS')
        try:
            self.coefficients = np.linalg.solve(matrix, np.vstack([target, np.zeros((3, 2))]))
        except np.linalg.LinAlgError as exc:
            raise AlignmentError('SINGULAR_TPS') from exc

    def __call__(self, points):
        points = (np.asarray(points)-self.origin)/self.scale
        return kernel(points, self.controls) @ self.coefficients[:-3] + np.c_[np.ones(len(points)), points] @ self.coefficients[-3:]


def _line_controls(anchors):
    src, dst = anchors.source.copy(), anchors.target.copy()
    hard, weights = anchors.hard.copy(), anchors.weights.copy()
    if anchors.placket_source is not None:
        # Sample corresponding ordered centerline segments. This enforces a vector
        # field along the closure instead of unconstrained zigzag between buttons.
        for a, b, c, d in zip(anchors.placket_source[:-1], anchors.placket_source[1:], anchors.placket_target[:-1], anchors.placket_target[1:]):
            for t in np.linspace(0, 1, 5):
                p, q = a*(1-t)+b*t, c*(1-t)+d*t
                distances = np.linalg.norm(src-p, axis=1)
                match = np.flatnonzero(distances < 1e-5)
                if len(match):
                    idx = match[0]
                    if np.linalg.norm(dst[idx]-q) > .05:
                        raise AlignmentError('CONFLICTING_PLACKET_CONSTRAINT')
                    hard[idx] = True
                else:
                    src = np.vstack([src, p]); dst = np.vstack([dst, q])
                    hard = np.r_[hard, True]; weights = np.r_[weights, 1.]
    if len(src) > 128:
        raise AlignmentError('TOO_MANY_CONTROLS')
    return src, dst, hard, weights


def apply_constrained_anatomical_warping(garment_rgba, anchors, output_shape, *,
        rigidity=.002, anchor_tolerance_px=.5, placket_tolerance_px=1.5,
        max_fold_fraction=.005, max_cycle_error_px=3.) -> WarpResult:
    """Inverse-map a 2-D garment, reject hard-point errors, folds and closure twists.

    This is a 2-D evidence-driven warp, not volumetric cloth simulation or 3-D fit.
    """
    h, w = output_shape
    if not 16 <= h <= 1536 or not 16 <= w <= 1536:
        raise AlignmentError('OUTPUT_SIZE_OUT_OF_RANGE')
    if any(not np.isfinite(v) or v < 0 for v in (anchor_tolerance_px, placket_tolerance_px, max_fold_fraction, max_cycle_error_px)):
        raise AlignmentError('INVALID_ACCEPTANCE_THRESHOLDS')
    src, dst, hard, weights = _line_controls(anchors)
    forward = ConstrainedTPS(src, dst, hard, weights, rigidity)
    inverse = ConstrainedTPS(dst, src, hard, weights, rigidity)
    hard_error = float(np.linalg.norm(forward(src[hard])-dst[hard], axis=1).max(initial=0))
    inverse_error = float(np.linalg.norm(inverse(dst[hard])-src[hard], axis=1).max(initial=0))
    if max(hard_error, inverse_error) > anchor_tolerance_px:
        raise AlignmentError('HARD_ANCHOR_ERROR')
    placket_error = 0.
    if anchors.placket_source is not None:
        for a, b, c, d in zip(anchors.placket_source[:-1], anchors.placket_source[1:], anchors.placket_target[:-1], anchors.placket_target[1:]):
            t = np.linspace(0, 1, 41)[:, None]
            placket_error = max(placket_error, float(np.linalg.norm(forward(a*(1-t)+b*t)-(c*(1-t)+d*t), axis=1).max()))
        if placket_error > placket_tolerance_px:
            raise AlignmentError('PLACKET_STRAIGHTNESS_ERROR')
    yy, xx = np.mgrid[:h, :w]
    grid = np.c_[xx.ravel(), yy.ravel()]
    mapped = np.empty_like(grid, dtype=float)
    for start in range(0, len(grid), 16384):
        mapped[start:start+16384] = inverse(grid[start:start+16384])
    mx, my = mapped[:, 0].reshape(h, w), mapped[:, 1].reshape(h, w)
    rgba = garment_rgba.astype(float)/255
    alpha = rgba[:, :, 3] * anchors.garment_mask
    coords = [my, mx]
    out_alpha = map_coordinates(alpha, coords, order=1, mode='constant', cval=0)
    # Premultiplication avoids black/color halos at a transparent edge.
    out = np.zeros((h, w, 4), float)
    for channel in range(3):
        premultiplied = map_coordinates(rgba[:, :, channel]*alpha, coords, order=1, mode='constant', cval=0)
        out[:, :, channel] = np.divide(premultiplied, out_alpha, out=np.zeros_like(out_alpha), where=out_alpha>1e-7)
    out[:, :, 3] = out_alpha
    dx_x, dy_x = np.gradient(mx, axis=1), np.gradient(mx, axis=0)
    dx_y, dy_y = np.gradient(my, axis=1), np.gradient(my, axis=0)
    visible = out_alpha > .1
    if not visible.any():
        raise AlignmentError('EMPTY_WARP')
    determinant = dx_x*dy_y-dy_x*dx_y
    folds = float(np.mean(determinant[visible] <= 1e-5))
    if folds > max_fold_fraction:
        raise AlignmentError('FOLDED_OR_REFLECTED_WARP')
    # Forward/inverse TPS are not exact inverses away from controls: measure it.
    samples = np.flatnonzero(visible.ravel())[::max(1, int(visible.sum())//1500)]
    cycle = float(np.percentile(np.linalg.norm(forward(mapped[samples])-grid[samples], axis=1), 95))
    if cycle > max_cycle_error_px:
        raise AlignmentError('INVERSE_CYCLE_ERROR')
    diagnostics = {'space':'PROJECTED_2D','hardAnchorErrorPx':hard_error,
                   'inverseAnchorErrorPx':inverse_error,'placketErrorPx':placket_error,
                   'foldFraction':folds,'cycleP95Px':cycle,'controls':len(src),
                   'provenance':anchors.provenance,'physicalFitCertified':False}
    return WarpResult(np.clip(np.rint(out*255), 0, 255).astype(np.uint8), diagnostics)
