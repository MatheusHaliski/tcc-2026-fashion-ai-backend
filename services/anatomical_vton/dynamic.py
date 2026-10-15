"""Attribute-driven targets. No guessed wrist width, cervical depth or perineum."""
import numpy as np
from .models import Anchor, Observation, AlignmentError, AnchorRule
from .anchors import extract_garment_and_body_anchors
from .warping import apply_constrained_anatomical_warping
from .compositing import blend_skin_and_cloth
from .auto_catalog import GarmentAutoAnnotator
from .profiles import rules_for


def sample_curve(points, count=7):
    points=np.asarray([[p.x,p.y] if hasattr(p,'x') else p for p in points],float)
    if len(points)<2 or not np.isfinite(points).all(): raise AlignmentError('INVALID_ANATOMICAL_CURVE')
    lengths=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
    if lengths[-1]<1 or np.any(np.diff(lengths)<1e-5): raise AlignmentError('DEGENERATE_ANATOMICAL_CURVE')
    t=np.linspace(0,lengths[-1],count)
    return np.c_[np.interp(t,lengths,points[:,0]),np.interp(t,lengths,points[:,1])]


class DynamicAnatomicalWarper:
    def warp(self, annotation, garment_rgba, person_rgb, body:Observation, *,
             foreground_skin_mask,wearable_region_mask,neckline_target=None,sagittal_target=None):
        attr=annotation.attributes; garment=GarmentAutoAnnotator.observation(annotation)
        targets=dict(body.anchors); source=dict(garment.anchors)
        if attr.sleeve_length!='sleeveless':
            section={'long_sleeve':'wrist','short_sleeve':'biceps','elbow_length':'elbow','3_4_sleeve':'forearm_mid'}[attr.sleeve_length]
            for side in ('left','right'):
                for edge in ('inner','outer'):
                    key=f'{section}_{side}_{edge}'
                    if key not in targets: raise AlignmentError(f'MISSING_BODY_CROSS_SECTION:{key}')
                    targets[f'cuff_{side}_{edge}']=targets[key]
        rules=list(rules_for(attr.family,attr.sleeve_profile))
        if attr.neckline_type!='none' and annotation.neckline_curve:
            if neckline_target is None: raise AlignmentError('STYLE_SPECIFIC_NECKLINE_TARGET_REQUIRED')
            # Off-shoulder/strapless targets belong to the upper chest/shoulders,
            # not the cervical ring. Provider must supply the correct projected curve.
            src_curve=sample_curve(annotation.neckline_curve)
            dst_curve=sample_curve(neckline_target)
            for i,(src,dst) in enumerate(zip(src_curve,dst_curve)):
                key=f'neckline_curve_{i}';source[key]=Anchor(*src);targets[key]=Anchor(*dst);rules.append(AnchorRule(key))
        ps=pt=None
        if attr.closure_type=='front_buttons':
            if sagittal_target is None: raise AlignmentError('SAGITTAL_TARGET_REQUIRED')
            ps=sample_curve(annotation.placket,7);pt=sample_curve(sagittal_target,7)
        garment=Observation(source,garment.mask,garment.provenance)
        body=Observation(targets,body.mask,body.provenance,body.dense_uv)
        anchors=extract_garment_and_body_anchors(garment_rgba,person_rgb,attr.family,
                    garment=garment,body=body,custom_rules=rules,placket_source=ps,placket_target=pt)
        warped=apply_constrained_anatomical_warping(garment_rgba,anchors,person_rgb.shape[:2])
        composite=blend_skin_and_cloth(person_rgb,warped.rgba,body.mask,foreground_skin_mask,wearable_region_mask)
        warped.diagnostics.update({'attributes':attr.model_dump(mode='json'),'repairs':annotation.repairs,
                                   'necklineMapped':bool(annotation.neckline_curve),'frontClosureConstrained':ps is not None})
        return composite,warped.diagnostics
