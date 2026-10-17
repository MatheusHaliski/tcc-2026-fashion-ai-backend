"""Bottomwear constraints in calibrated metres, distinct from projected 2-D warping."""
import numpy as np
from pydantic import BaseModel,ConfigDict,Field
from .models import AlignmentError
from .auto_catalog import GarmentAttributeSchema
from .dynamic import DynamicAnatomicalWarper


class BottomwearAttributeSchema(GarmentAttributeSchema):
    bottom_type:str=Field(pattern=r'^(jeans|tailored|shorts|bermuda|skirt|leggings|compression|swim_brief|bikini_bottom|wide_trousers)$')
    rise:str=Field(pattern=r'^(high|mid|low)$')
    leg_fit:str=Field(pattern=r'^(tight|slim|straight|flare|wide|loose|not_applicable)$')
    fabric_stiffness:float=Field(ge=0,le=1)
    hem_length:str=Field(pattern=r'^(full|ankle|calf|knee|mid_thigh|upper_thigh|brief|not_applicable)$')
    max_stretch_ratio:float=Field(default=1.05,ge=1,le=2.5)
    crotch_ease_m:float=Field(default=.01,ge=0,le=.2)


def closed_perimeter(ring):
    ring=np.asarray(ring,float)
    if ring.ndim!=2 or ring.shape[1]!=3 or len(ring)<6 or not np.isfinite(ring).all():raise AlignmentError('CALIBRATED_360_WAIST_RING_REQUIRED')
    if np.linalg.norm(ring[0]-ring[-1])<1e-8:ring=ring[:-1]
    if len(ring)<6 or np.linalg.matrix_rank(ring-ring.mean(0))<2:raise AlignmentError('DEGENERATE_WAIST_RING')
    return float(np.linalg.norm(np.roll(ring,-1,axis=0)-ring,axis=1).sum())


def sample_closed_ring(ring,count):
    ring=np.asarray(ring,float)
    if np.linalg.norm(ring[0]-ring[-1])<1e-8:ring=ring[:-1]
    closed_perimeter(ring)
    if len(ring)==count:return ring.copy()
    loop=np.vstack([ring,ring[0]])
    distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(loop,axis=0),axis=1))]
    if np.any(np.diff(distance)<1e-7):raise AlignmentError('COINCIDENT_WAIST_POINTS')
    t=np.linspace(0,distance[-1],count,endpoint=False)
    return np.c_[[np.interp(t,distance,loop[:,axis]) for axis in range(3)]].T


class WaistbandPerimeterConstraint:
    def calculate(self,source_ring,target_ring,max_stretch_ratio):
        source_length=closed_perimeter(source_ring);target_length=closed_perimeter(target_ring)
        if target_length>source_length*max_stretch_ratio:raise AlignmentError('WAIST_SIZE_MISMATCH_DO_NOT_COMPRESS_THE_BODY')
        return {'targetRing':sample_closed_ring(target_ring,len(source_ring)),
                'sourcePerimeterM':source_length,'targetPerimeterM':target_length,
                'stretchRatio':target_length/source_length}


class FlyLineStraightnessLoss:
    def __call__(self,closure,sagittal_curve):
        closure=np.asarray(closure,float);curve=np.asarray(sagittal_curve,float)
        if closure.shape!=curve.shape or closure.ndim!=2 or closure.shape[1]!=3 or len(closure)<2 or not np.isfinite(closure).all() or not np.isfinite(curve).all():raise AlignmentError('MATCHED_FLY_AND_SAGITTAL_CURVES_REQUIRED')
        # The 3-D sagittal surface may curve over the abdomen; straightness means
        # correspondence to that curve, not flattening the abdomen into a line.
        return float(np.mean(np.sum((closure-curve)**2,axis=1)))


class InseamAnatomicalAlignment:
    def validate(self,left,right,crotch,tolerance_m=.003):
        left,right,crotch=np.asarray(left,float),np.asarray(right,float),np.asarray(crotch,float)
        if left.ndim!=2 or right.ndim!=2 or left.shape[1]!=3 or right.shape[1]!=3 or not len(left) or not len(right) or crotch.shape!=(3,) or not np.isfinite(np.r_[left.ravel(),right.ravel(),crotch]).all():raise AlignmentError('INVALID_INSEAM_GEOMETRY')
        error=max(np.linalg.norm(left[0]-crotch),np.linalg.norm(right[0]-crotch))
        if error>tolerance_m:raise AlignmentError('INSEAMS_DO_NOT_MEET_AT_CROTCH')
        return float(error)


class ShoeCollisionOcclusion:
    def project(self,vertices,signed_distance,*,clearance_m=.001,iterations=8):
        result=np.asarray(vertices,float).copy()
        for _ in range(iterations):
            distance,gradient=signed_distance(result);distance=np.asarray(distance);gradient=np.asarray(gradient)
            if distance.shape!=(len(result),) or gradient.shape!=result.shape or not np.isfinite(distance).all() or not np.isfinite(gradient).all():raise AlignmentError('INVALID_FOOTWEAR_SDF')
            delta=np.maximum(clearance_m-distance,0)
            result+=delta[:,None]*gradient/np.maximum(np.linalg.norm(gradient,axis=1,keepdims=True),1e-8)
        distance,_=signed_distance(result)
        if np.any(distance<-.0001):raise AlignmentError('SHOE_COLLISION_UNRESOLVED')
        return result


def calculate_crotch_and_waist_constraints(attributes,garment_waist_ring,body_waist_rings,body_perineum=None):
    if attributes.category.value!='bottom':raise AlignmentError('BOTTOM_CATEGORY_REQUIRED')
    target=body_waist_rings.get(attributes.rise)
    if target is None:raise AlignmentError('REQUESTED_RISE_RING_NOT_MEASURED')
    constraint=WaistbandPerimeterConstraint().calculate(garment_waist_ring,target,attributes.max_stretch_ratio)
    if attributes.bottom_type=='skirt':constraint['crotchTarget']=None
    else:
        perineum=np.asarray(body_perineum,float)
        if perineum.shape!=(3,) or not np.isfinite(perineum).all():raise AlignmentError('CALIBRATED_PERINEAL_POINT_REQUIRED')
        # Clearance belongs to the garment pattern, not a guessed anatomical point.
        constraint['crotchTarget']=perineum+np.array([0,-attributes.crotch_ease_m,0])
    return constraint


class BottomwearAnatomicalWarper:
    def warp_2d(self,annotation,*args,**kwargs):
        if annotation.attributes.category.value!='bottom':raise AlignmentError('BOTTOM_CATEGORY_REQUIRED')
        return DynamicAnatomicalWarper().warp(annotation,*args,**kwargs)
    def fit_mesh(self,vertices,edges,*,attributes,waist_indices,body_waist_rings,crotch_index=None,body_perineum=None,body_sdf=None,steps=20):
        """Small quasi-static constraint solver for a supplied 3-D garment pattern.

        Not a substitute for anisotropic cloth material calibration, thickness,
        self-collision or full garment construction from an unseen rear view.
        """
        rest=np.asarray(vertices,float);edges=np.asarray(edges,int);waist_indices=np.asarray(waist_indices,int)
        if rest.ndim!=2 or rest.shape[1]!=3 or not np.isfinite(rest).all() or edges.ndim!=2 or edges.shape[1]!=2 or not edges.size or edges.min()<0 or edges.max()>=len(rest) or len(waist_indices)<6 or waist_indices.min()<0 or waist_indices.max()>=len(rest):raise AlignmentError('VALID_GARMENT_MESH_REQUIRED')
        constraints=calculate_crotch_and_waist_constraints(attributes,rest[waist_indices],body_waist_rings,body_perineum)
        result=rest.copy();rest_lengths=np.linalg.norm(rest[edges[:,1]]-rest[edges[:,0]],axis=1)
        pinned=np.zeros(len(rest),bool);pinned[waist_indices]=True
        if constraints['crotchTarget'] is not None:
            if crotch_index is None or not 0<=crotch_index<len(rest):raise AlignmentError('CROTCH_VERTEX_REQUIRED')
            pinned[crotch_index]=True
        for _ in range(max(1,min(steps,100))):
            if attributes.fabric_stiffness<.4:result[~pinned,1]-=.0005
            # Jacobi distance projections preserve topology without index-order bias.
            a,b=edges[:,0],edges[:,1];delta=result[b]-result[a];length=np.linalg.norm(delta,axis=1)
            correction=delta*((length-rest_lengths)/np.maximum(length,1e-8))[:,None]
            accumulated=np.zeros_like(result);counts=np.zeros(len(rest))
            np.add.at(accumulated,a,correction*.5);np.add.at(accumulated,b,-correction*.5)
            np.add.at(counts,a,1);np.add.at(counts,b,1)
            result[~pinned]+=accumulated[~pinned]/np.maximum(counts[~pinned,None],1)*(.3+.6*attributes.fabric_stiffness)
            if body_sdf is not None:result=ShoeCollisionOcclusion().project(result,body_sdf)
            result[waist_indices]=constraints['targetRing']
            if constraints['crotchTarget'] is not None:result[crotch_index]=constraints['crotchTarget']
        strain=np.linalg.norm(result[edges[:,1]]-result[edges[:,0]],axis=1)/np.maximum(rest_lengths,1e-8)
        if np.max(strain)>attributes.max_stretch_ratio+.01:raise AlignmentError('FABRIC_STRAIN_EXCEEDS_ALLOWED_FIT')
        if body_sdf is not None:
            distance,_=body_sdf(result)
            if np.any(distance<-.001):raise AlignmentError('PINNED_CLOTH_BODY_COLLISION')
        return result,{'waistErrorM':float(np.linalg.norm(result[waist_indices]-constraints['targetRing'],axis=1).max()),
                       'maxStrain':float(strain.max()),'solver':'QUASISTATIC_DISTANCE_CONSTRAINTS','physicalFitCertified':False}

BottomwearAnatomicalEngine=BottomwearAnatomicalWarper
