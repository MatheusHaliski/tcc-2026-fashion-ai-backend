"""Native pretrained FASHN pipeline. Generated try-on is not metrological fitting."""
import base64
import json
import os
import time
from pathlib import Path
import numpy as np
from PIL import Image
from pydantic import BaseModel,ConfigDict,Field
from typing import Literal
from .auto_catalog import decode_image,png_bytes
from .fashn_download import assets,verify_assets
from .models import AlignmentError

CATEGORIES={'upper_piece':'tops','top':'tops','outerwear':'tops',
            'lower_piece':'bottoms','bottom':'bottoms',
            'full_body_piece':'one-pieces','dress':'one-pieces','jumpsuit':'one-pieces'}


def fashion_category(category):
    if category not in CATEGORIES:raise AlignmentError('FASHN_CATEGORY_NOT_SUPPORTED')
    return CATEGORIES[category]


class FashnInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    task:Literal['virtual_try_on']
    person_image:str
    garment_image:str
    category:Literal['tops','bottoms','one-pieces']
    garment_photo_type:Literal['auto','model','flat-lay']='auto'
    num_timesteps:int=Field(default=30,ge=20,le=50)
    seed:int=Field(default=42,ge=0,le=2**31-1)


def decoded_image(encoded):
    try:
        rgba=decode_image(base64.b64decode(encoded,validate=True),'RGBA')
        alpha=rgba[:,:,3:4].astype(float)/255
        return np.round(rgba[:,:,:3]*alpha+255*(1-alpha)).astype(np.uint8)
    except Exception as error:raise AlignmentError('INVALID_VTON_IMAGE') from error


def pose_screen(original,rendered,original_size,rendered_size,*,min_points=6,max_error=.08):
    """Pose consistency only; cannot validate garment fidelity or unseen surfaces."""
    before,scores_a=original;after,scores_b=rendered
    before,after=np.asarray(before,float),np.asarray(after,float)
    scores_a,scores_b=np.asarray(scores_a,float),np.asarray(scores_b,float)
    for points,scores in ((before,scores_a),(after,scores_b)):
        if points.ndim!=3 or points.shape[0]!=1 or points.shape[1]<18 or points.shape[2]!=2 or scores.shape!=points.shape[:2]:
            raise AlignmentError('EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED')
        if not np.isfinite(points).all() or not np.isfinite(scores).all():raise AlignmentError('NONFINITE_DWPOSE')
    # Neck, shoulders, elbows, wrists, hips, knees and ankles (OpenPose order).
    indexes=np.arange(1,14);good=(scores_a[0,indexes]>=.5)&(scores_b[0,indexes]>=.5)
    indexes=indexes[good]
    if len(indexes)<min_points:raise AlignmentError('INSUFFICIENT_SHARED_BODY_LANDMARKS')
    a=before[0,indexes]/np.asarray(original_size,float)
    b=after[0,indexes]/np.asarray(rendered_size,float)
    if np.any((a<0)|(a>1)|(b<0)|(b>1)):raise AlignmentError('VISIBLE_LANDMARK_OUTSIDE_IMAGE')
    error=float(np.sqrt(np.mean(np.sum((a-b)**2,axis=1))))
    if error>max_error:raise AlignmentError('GENERATED_POSE_DRIFT_REJECTED')
    return {'sharedBodyLandmarks':len(indexes),'normalizedPoseRmse':error,
            'threshold':max_error,'policy':'INITIAL_POSE_SCREEN_NOT_FIT_CERTIFICATION'}


def inferred_photo_type(garment_pose):
    points,scores=map(np.asarray,garment_pose)
    if points.ndim!=3 or points.shape[-1]!=2 or scores.shape!=points.shape[:2]:raise AlignmentError('INVALID_GARMENT_POSE')
    if points.shape[0]>1:raise AlignmentError('MULTIPLE_GARMENT_MODELS_REJECTED')
    return 'model' if points.shape[0]==1 and np.count_nonzero(scores[0,:18]>=.5)>=3 else 'flat-lay'


def serving_dtype(torch):
    # torch>=2.3 reports bf16 as supported on Turing (T4) by emulation. There SDPA has no fused bf16 kernel and falls
    # back to the math path, whose 6912x6912 person+garment attention exhausts the 16 GB on the first step. FASHN's
    # README asks for bf16 on Ampere+ and float32 below it; float32 keeps the memory-efficient kernel on the T4.
    return torch.bfloat16 if torch.cuda.is_bf16_supported(including_emulation=False) else torch.float32


def detected_pose(rgb,estimator,detector):
    # Upstream DWPose deliberately estimates a whole-image pose when detection
    # finds nobody. Never treat that fallback as evidence of a person.
    bgr=np.ascontiguousarray(rgb[:,:,::-1])
    boxes=np.asarray(detector(estimator.session_det,bgr))
    if boxes.size==0:return np.empty((0,134,2)),np.empty((0,134))
    if boxes.ndim!=2 or boxes.shape[1]!=4 or not np.isfinite(boxes).all():raise AlignmentError('INVALID_PERSON_DETECTION')
    return estimator(bgr)


class NativeFashnRuntime:
    tasks=('virtual_try_on',)

    def __init__(self,weights_dir):
        root=Path(weights_dir).resolve()
        print(json.dumps({'event':'fashn_weights_preflight','directory':str(root),
            'uid':os.geteuid(),'directoryExists':root.is_dir(),
            'directoryReadable':os.access(root,os.R_OK|os.X_OK)}),flush=True)
        verify_assets(root)
        import torch
        import onnxruntime as ort
        if not torch.cuda.is_available():raise AlignmentError('REAL_CUDA_DEVICE_REQUIRED')
        if hasattr(ort,'preload_dlls'):ort.preload_dlls()
        from fashn_vton import TryOnPipeline
        from fashn_vton.dwpose.onnxdet import inference_detector
        self.detector=inference_detector
        from fashn_human_parser import FashnHumanParser
        class OfflinePipeline(TryOnPipeline):
            def _setup_tryon_model(self):
                self.inference_dtype=serving_dtype(torch)
                super()._setup_tryon_model()
            def _setup_hp_model(self):
                self.hp_model=FashnHumanParser(model_id=str(root/'parser'),device='cuda')
        self.torch=torch
        self.pipeline=OfflinePipeline(weights_dir=str(root),device='cuda:0')
        sessions=self.pipeline.pose_model.pose_estimation
        if any('CUDAExecutionProvider' not in session.get_providers() for session in (sessions.session_det,sessions.session_pose)):
            raise AlignmentError('DWPOSE_CUDA_PROVIDER_REQUIRED')
        if next(self.pipeline.tryon_model.parameters()).device.type!='cuda':raise AlignmentError('VTON_MODEL_NOT_ON_GPU')
        self.ready=True

    def predict(self,instance):
        request=FashnInput.model_validate(instance)
        person=decoded_image(request.person_image);garment=decoded_image(request.garment_image)
        torch=self.torch;torch.cuda.synchronize();torch.cuda.reset_peak_memory_stats();started=time.monotonic()
        try:
            original_pose=detected_pose(person,self.pipeline.pose_model.pose_estimation,self.detector)
            # Reject absent/ambiguous/low-confidence poses before diffusion.
            size=(person.shape[1],person.shape[0])
            pose_screen(original_pose,original_pose,size,size)
            photo_type=request.garment_photo_type
            if photo_type=='auto':
                photo_type=inferred_photo_type(detected_pose(garment,self.pipeline.pose_model.pose_estimation,self.detector))
            result=self.pipeline(person_image=Image.fromarray(person),garment_image=Image.fromarray(garment),
                category=request.category,garment_photo_type=photo_type,
                num_samples=1,num_timesteps=request.num_timesteps,seed=request.seed,segmentation_free=True)
            if len(result.images)!=1:raise AlignmentError('ONE_GENERATED_IMAGE_REQUIRED')
            output=np.asarray(result.images[0].convert('RGB'))
            if output.ndim!=3 or min(output.shape[:2])<16 or max(output.shape[:2])>1536 or output.std()<2:
                raise AlignmentError('DEGENERATE_GENERATED_IMAGE')
            generated_pose=detected_pose(output,self.pipeline.pose_model.pose_estimation,self.detector)
            quality=pose_screen(original_pose,generated_pose,(person.shape[1],person.shape[0]),(output.shape[1],output.shape[0]))
            torch.cuda.synchronize()
            return {'status':'READY','image_png':base64.b64encode(png_bytes(output)).decode(),
                'diagnostics':{'engine':'FASHN_VTON_1_5','modelVersion':assets()['model_version'],
                    'device':'cuda:0','gpuName':torch.cuda.get_device_name(0),
                    'dtype':str(self.pipeline.inference_dtype),'latencyMs':round((time.monotonic()-started)*1000),
                    'peakCudaBytes':torch.cuda.max_memory_allocated(0),'category':request.category,'garmentPhotoType':photo_type,
                    'seed':request.seed,'numTimesteps':request.num_timesteps,'qualityScreen':quality,
                    'renderKind':'GENERATIVE_2D','physicalFitCertified':False,
                    'garmentFidelityCertified':False,'millimetricAccuracyCertified':False}}
        except torch.cuda.OutOfMemoryError as error:
            print(json.dumps({'event':'fashn_cuda_oom','dtype':str(self.pipeline.inference_dtype),'detail':str(error)[:600]}),flush=True)
            torch.cuda.empty_cache()
            raise AlignmentError('GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD') from error
