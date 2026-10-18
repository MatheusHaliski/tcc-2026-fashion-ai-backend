"""Metric rigid fitting for accessories and footwear. Requires calibrated 3-D landmarks."""
import numpy as np
from scipy.spatial.transform import Rotation


def fit_rigid_anchors(source,target,allow_scale=False):
    source,target=np.asarray(source,float),np.asarray(target,float)
    if source.shape!=target.shape or source.ndim!=2 or source.shape[1]!=3 or len(source)<3 or not np.isfinite(source).all() or not np.isfinite(target).all():raise ValueError('CALIBRATED_3D_ANCHORS_REQUIRED')
    a,b=source-source.mean(0),target-target.mean(0)
    if np.linalg.matrix_rank(a)<2 or np.linalg.matrix_rank(b)<2:raise ValueError('DEGENERATE_3D_ANCHORS')
    u,_,vt=np.linalg.svd(a.T@b);rotation=vt.T@u.T
    if np.linalg.det(rotation)<0:vt[-1]*=-1;rotation=vt.T@u.T
    scale=np.sqrt((b*b).sum()/max((a*a).sum(),1e-10)) if allow_scale else 1.
    if not .75<=scale<=1.25:raise ValueError('ACCESSORY_SIZE_MISMATCH')
    translation=target.mean(0)-source.mean(0)@rotation.T*scale
    predicted=source@rotation.T*scale+translation
    return {'rotation':rotation,'translation':translation,'scale':float(scale),'rmsErrorM':float(np.sqrt(np.mean((predicted-target)**2)))}


class HeadwearAndEyewearWarper:
    def eyewear(self,asset_anchors,face_anchors):
        names=['nasal_bridge','ear_top_left','ear_top_right','zygomatic_left','zygomatic_right']
        return fit_rigid_anchors([asset_anchors[k] for k in names],[face_anchors[k] for k in names])
    def headwear(self,inner_crown,cranial_perimeter):
        # Corresponding sampled closed curves, not a guessed face bbox.
        return fit_rigid_anchors(inner_crown,cranial_perimeter,allow_scale=True)


def compress_hair_under_headwear(strands,roots,hat_inner_sdf,scalp_sdf,iterations=8,clearance_m=.0005):
    """SDF callbacks return (signed distance, outward allowed-direction gradient).
    Both distances are positive in allowed space: inside the hat and outside scalp.
    """
    points=np.asarray(strands,float).copy();roots=np.asarray(roots,float)
    if points.ndim!=3 or points.shape[2]!=3 or roots.shape!=(len(points),3):raise ValueError('INVALID_HAIR_GEOMETRY')
    for sdf in (hat_inner_sdf,scalp_sdf):
        distance,_=sdf(roots)
        if np.any(np.asarray(distance)<0):raise ValueError('HEADWEAR_CANNOT_CONTAIN_PINNED_ROOTS')
    for _ in range(iterations):
        for sdf in (hat_inner_sdf,scalp_sdf):
            distance,gradient=sdf(points);distance=np.asarray(distance);gradient=np.asarray(gradient)
            if distance.shape!=points.shape[:2] or gradient.shape!=points.shape or not np.isfinite(distance).all() or not np.isfinite(gradient).all():raise ValueError('INVALID_COLLISION_SDF')
            direction=gradient/np.maximum(np.linalg.norm(gradient,axis=-1,keepdims=True),1e-9)
            points+=np.maximum(clearance_m-distance,0)[...,None]*direction
        points[:,0]=roots
    for sdf in (hat_inner_sdf,scalp_sdf):
        distance,_=sdf(points[:,1:])
        if np.any(distance<-.0001):raise ValueError('HEADWEAR_COMPRESSION_UNRESOLVED')
    return points


class FootwearPoseWarper:
    def fit(self,foot_keypoints,*,heel_height_m,sole_forefoot_height_m=0.,ground_y=0.):
        required=['heel','metatarsal','toe','ankle']
        points={key:np.asarray(foot_keypoints[key],float) for key in required}
        if any(p.shape!=(3,) or not np.isfinite(p).all() for p in points.values()) or not 0<=heel_height_m<=.25 or not 0<=sole_forefoot_height_m<=.15:raise ValueError('INVALID_FOOTWEAR_GEOMETRY')
        forward=points['metatarsal']-points['heel'];forward[1]=0;span=np.linalg.norm(forward)
        if span<.03:raise ValueError('FOOT_SPAN_TOO_SMALL')
        forward/=span;up=np.array([0.,1.,0.]);lateral=np.cross(up,forward)
        angle=np.arctan2(heel_height_m-sole_forefoot_height_m,span)
        if abs(angle)>np.deg2rad(45):raise ValueError('HEEL_REQUIRES_UNSUPPORTED_POSE')
        rotation=Rotation.from_rotvec(lateral*angle).as_matrix();pivot=points['metatarsal']
        transformed={name:(point-pivot)@rotation.T+pivot for name,point in points.items()}
        lift=ground_y+sole_forefoot_height_m-transformed['metatarsal'][1]
        translation=pivot-pivot@rotation.T+np.array([0,lift,0])
        for point in transformed.values():point[1]+=lift
        return {'rotation':rotation,'translation':translation,'plantarFlexionRadians':float(angle),
                'keypoints':transformed,'contactPoint':'metatarsal','requiresLegIK':bool(abs(angle)>.001),
                'physicalFitCertified':False}
