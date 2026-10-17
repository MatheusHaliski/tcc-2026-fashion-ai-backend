import numpy as np
from scipy.ndimage import gaussian_filter
from .anchors import validate_mask
from .models import AlignmentError


def blend_skin_and_cloth(person_rgb, warped_rgba, body_mask, foreground_skin_mask, wearable_region_mask, *, feather_px=.6):
    """Preserve foreground skin and clip to an explicitly supplied wearable region.

    Body silhouette is not used to clip a loose garment: the allowed garment
    region must include its true intended volume. Occlusion order is supplied by
    segmentation/depth evidence, never guessed by treating all skin as foreground.
    """
    shape = person_rgb.shape[:2]
    if warped_rgba.shape != (*shape, 4):
        raise AlignmentError('MISMATCHED_COMPOSITE_SHAPE')
    body = validate_mask(body_mask, shape, 'BODY')
    skin = np.asarray(foreground_skin_mask,dtype=float)
    if skin.shape != shape or not np.isfinite(skin).all() or np.any((skin<0)|(skin>1)):
        raise AlignmentError('INVALID_FOREGROUND_SKIN_MASK')
    allowed = validate_mask(wearable_region_mask, shape, 'WEARABLE_REGION')
    if np.any((skin>.5)&(body<.1)):
        raise AlignmentError('OCCLUDER_OUTSIDE_PERSON')
    if not 0 <= feather_px <= 2:
        raise AlignmentError('INVALID_FEATHER_RADIUS')
    alpha = warped_rgba[:, :, 3].astype(float)/255
    if feather_px:
        alpha = gaussian_filter(alpha, feather_px)
    # Apply hard clipping AFTER feathering, so neither background nor foreground
    # skin receives a blur halo.
    alpha *= allowed*(1-skin)
    if not np.any(alpha>.05):
        raise AlignmentError('NO_VISIBLE_GARMENT_AFTER_OCCLUSION')
    out = warped_rgba[:, :, :3]*alpha[:, :, None]+person_rgb*(1-alpha[:, :, None])
    return np.clip(np.rint(out),0,255).astype(np.uint8)
