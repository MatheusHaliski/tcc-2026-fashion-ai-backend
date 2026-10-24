"""Geometry cleanup, preserving intended curls and pinned scalp roots.

NumPy routines are used for offline QA. Real-time manager uses equivalent Torch
capsule projections. A free tip is normal: it is not by itself a broken strand.
"""
import numpy as np
from scipy.spatial import cKDTree


def _validate(strands,roots):
    strands=np.asarray(strands,float);roots=np.asarray(roots,float)
    if strands.ndim!=3 or strands.shape[2]!=3 or strands.shape[1]<2 or roots.shape!=(len(strands),3) or not np.isfinite(strands).all() or not np.isfinite(roots).all():raise ValueError('INVALID_STRAND_GEOMETRY')
    return strands,roots


def smooth_disconnected_strands(strands,roots,*,intended_guides=None,threshold_m=.025,strength=.3,intentional_flyaways=None):
    strands,roots=_validate(strands,roots)
    if not 0<=strength<=1 or threshold_m<=0:raise ValueError('INVALID_CLEANUP_PARAMETERS')
    out=strands.copy();offset=roots-out[:,0];out+=offset[:,None,:];out[:,0]=roots
    repaired=np.linalg.norm(offset,axis=1)>1e-5
    if intended_guides is not None:
        guides=np.asarray(intended_guides,float)
        if guides.ndim!=3 or guides.shape[1:]!=out.shape[1:] or not np.isfinite(guides).all():raise ValueError('GUIDES_REQUIRE_MATCHED_ARCLENGTH_SAMPLES')
        # Root-nearest reference preserves the intended haircut, not a spherical
        # envelope that would flatten a 4C afro or erase intentional flyaways.
        _,indices=cKDTree(guides[:,0]).query(roots)
        reference=guides[indices]+(roots-guides[indices,0])[:,None,:]
        flags=np.max(np.linalg.norm(out-reference,axis=2),axis=1)>threshold_m
        if intentional_flyaways is not None:
            intentional=np.asarray(intentional_flyaways,bool)
            if intentional.shape!=(len(out),):raise ValueError('INVALID_FLYAWAY_MASK')
            flags&=~intentional
        taper=np.linspace(0,1,out.shape[1])[None,:,None]
        out[flags]+=strength*taper*(reference[flags]-out[flags]);repaired|=flags
    return out,{'repairedStrands':int(repaired.sum()),'rootMaxErrorM':float(np.linalg.norm(out[:,0]-roots,axis=1).max(initial=0))}


def capsule_projection(points,a,b,radius,clearance=.0005):
    a,b=np.asarray(a,float),np.asarray(b,float);axis=b-a;den=float(axis@axis)
    t=np.clip(((points-a)@axis)/max(den,1e-12),0,1)
    center=a+t[...,None]*axis;delta=points-center;distance=np.linalg.norm(delta,axis=-1,keepdims=True)
    direction=np.divide(delta,distance,out=np.zeros_like(delta),where=distance>1e-9)
    direction=np.where(distance>1e-9,direction,np.array([1.,0,0]))
    return np.where(distance<radius+clearance,center+direction*(radius+clearance),points)


def optimize_ear_neck_collision(strands,roots,colliders,*,clearance_m=.0005,iterations=4):
    strands,roots=_validate(strands,roots);out=strands.copy()
    if not 0<=clearance_m<=.005 or not 1<=iterations<=32:raise ValueError('INVALID_COLLISION_PARAMETERS')
    for collider in colliders:
        if collider['radius']<=0:raise ValueError('INVALID_COLLIDER')
        projected=capsule_projection(roots,collider['a'],collider['b'],collider['radius'],clearance_m)
        if np.any(np.linalg.norm(projected-roots,axis=1)>1e-6):raise ValueError('PINNED_ROOT_INSIDE_COLLIDER')
    for _ in range(iterations):
        for collider in colliders:out=capsule_projection(out,collider['a'],collider['b'],collider['radius'],clearance_m)
        out[:,0]=roots
    residual=0.
    for collider in colliders:
        residual=max(residual,float(np.linalg.norm(capsule_projection(out,collider['a'],collider['b'],collider['radius'],clearance_m)-out,axis=2).max(initial=0)))
    if residual>1e-5:raise ValueError('UNRESOLVED_HAIR_COLLISION')
    return out,{'maxPenetrationM':residual,'colliderKind':'CAPSULE_APPROXIMATION'}


def align_neckline_cut(strands,roots,*,nape_strands,cut_point,cut_normal,epsilon_m=.0005):
    """Clip only explicitly selected nape strands to the intended cut half-space.

    Positive signed distance is retained. Long hair must not be labeled nape-cut
    hair. Returns per-strand active segment counts; no opacity mask hides clipping.
    """
    strands,roots=_validate(strands,roots);out=strands.copy();mask=np.asarray(nape_strands,bool)
    normal=np.asarray(cut_normal,float);point=np.asarray(cut_point,float)
    if mask.shape!=(len(out),) or normal.shape!=(3,) or point.shape!=(3,) or not np.isfinite(normal).all() or not np.isfinite(point).all() or np.linalg.norm(normal)<1e-9:raise ValueError('INVALID_CUT_CONTOUR')
    normal/=np.linalg.norm(normal);lengths=np.full(len(out),out.shape[1]-1,dtype=int)
    for i in np.flatnonzero(mask):
        signed=(out[i]-point)@normal
        if signed[0]<-epsilon_m:raise ValueError('CUT_CONTOUR_EXCLUDES_ROOT')
        crossings=np.flatnonzero(signed[1:] < -epsilon_m)
        if not len(crossings):continue
        k=int(crossings[0])+1;a,b=out[i,k-1],out[i,k];sa,sb=signed[k-1],signed[k]
        t=np.clip(sa/max(sa-sb,1e-12),0,1);intersection=a+t*(b-a)
        out[i,k:]=intersection;lengths[i]=k
    return out,lengths
