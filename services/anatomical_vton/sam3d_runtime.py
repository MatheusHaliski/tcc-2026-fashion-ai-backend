"""Medidas do Avatar 3D na GPU com o SAM 3D Body (Meta), no mesmo contêiner e na mesma T4 da FASHN.

Uma foto de corpo inteiro vira a malha MHR e, dela, as proporções do Avatar (body_measure.py). A foto só existe em
memória durante a inferência: nada é gravado, e a resposta não leva imagem, malha nem pontos do corpo.
"""
from contextlib import contextmanager
import gc
import json
from pathlib import Path
import sys
import time
from typing import Literal
import numpy as np
from pydantic import BaseModel,ConfigDict
from .body_measure import measure_body
from .models import AlignmentError
from .shared_runtime import SharedT4Runtime

ENGINE='SAM_3D_BODY_DINOV3'
# Pontos do DWPose (ordem OpenPose) que precisam estar nítidos para medir: nariz, pescoço, ombros, quadris, joelhos e
# tornozelos. Sem os pés na foto o modelo inventa as pernas, e a estatura (base de todas as proporções) sai errada.
FULL_BODY=(0,1,2,5,8,11,9,12,10,13)
MIN_SCORE=.5


class BodyMeasurementInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    task:Literal['body_measurement']
    person_image:str


def full_body_box(evidence,size):
    """A caixa da única pessoa da foto, só se o corpo inteiro (da cabeça aos tornozelos) estiver visível."""
    boxes,points,scores=(np.asarray(value,float) for value in evidence)
    if boxes.ndim!=2 or boxes.shape[1:]!=(4,) or len(boxes)!=1 or points.ndim!=3 or points.shape[0]!=1 or points.shape[1]<18 \
            or scores.shape!=points.shape[:2]:
        raise AlignmentError('EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED')
    if not np.isfinite(boxes).all() or not np.isfinite(points).all() or not np.isfinite(scores).all():raise AlignmentError('NONFINITE_DWPOSE')
    index=np.asarray(FULL_BODY)
    if np.any(scores[0,index]<MIN_SCORE):raise AlignmentError('FULL_BODY_NOT_VISIBLE')
    width,height=size
    visible=points[0,index]/np.asarray([width,height],float)
    if np.any((visible<0)|(visible>1)):raise AlignmentError('VISIBLE_LANDMARK_OUTSIDE_IMAGE')
    x0,y0,x1,y1=np.clip(boxes[0],0,[width,height,width,height])
    if x1-x0<16 or y1-y0<32:raise AlignmentError('INVALID_PERSON_DETECTION')
    return np.asarray([[x0,y0,x1,y1]],float)


def measure_photo(rgb,person_evidence,reconstruct):
    """Foto RGB -> proporções. `reconstruct(rgb, caixa)` devolve as saídas do SAM 3D Body (uma por caixa)."""
    box=full_body_box(person_evidence(rgb),(rgb.shape[1],rgb.shape[0]))
    outputs=reconstruct(rgb,box)
    if len(outputs)!=1:raise AlignmentError('ONE_BODY_RECONSTRUCTION_REQUIRED')
    try:result=measure_body(outputs[0]['pred_vertices'],outputs[0]['pred_keypoints_3d'])
    except ValueError as error:raise AlignmentError(str(error)) from error
    return {key:result[key] for key in ('ratios','refused','warnings')}


def dinov3_hub_load(backbones):
    """Substituto de torch.hub.load para o backbone: código do checkout fixado na imagem, sem rede e sem pesos
    pré-treinados (os pesos do backbone vêm do próprio checkpoint do SAM 3D Body)."""
    def load(repo_or_dir,model,*args,source='github',**kwargs):
        if repo_or_dir!='facebookresearch/dinov3' or source!='github':raise AlignmentError('UNEXPECTED_TORCH_HUB_REPOSITORY')
        if kwargs.get('pretrained',True):raise AlignmentError('DINOV3_PRETRAINED_DOWNLOAD_FORBIDDEN')
        if not model.startswith('dinov3_') or not callable(getattr(backbones,model,None)):raise AlignmentError('UNKNOWN_DINOV3_BACKBONE')
        return getattr(backbones,model)(*args,**kwargs)
    return load


@contextmanager
def local_dinov3(torch):
    # O SAM 3D Body monta o backbone com torch.hub.load('facebookresearch/dinov3', source='github'), que baixaria
    # código do GitHub a cada subida do contêiner.
    from dinov3.hub import backbones
    original=torch.hub.load;torch.hub.load=dinov3_hub_load(backbones)
    try:yield
    finally:torch.hub.load=original


class Sam3dBodyRuntime:
    tasks=('body_measurement',)

    def __init__(self,weights_dir,code_dir,person_evidence,manifest):
        import torch
        if not torch.cuda.is_available():raise AlignmentError('REAL_CUDA_DEVICE_REQUIRED')
        for name in ('sam-3d-body','dinov3'):
            path=str(Path(code_dir)/name)
            if path not in sys.path:sys.path.insert(0,path)
        from sam_3d_body import SAM3DBodyEstimator
        from sam_3d_body.models.meta_arch import SAM3DBody
        from sam_3d_body.utils.config import get_config
        from .fashn_runtime import serving_dtype
        root=Path(weights_dir).resolve();started=time.monotonic()
        # Mesmo passo a passo de sam_3d_body.build_models.load_sam_3d_body, com duas diferenças: o backbone vem do
        # checkout local e, numa GPU sem bf16 nativo (T4), o backbone roda em float32 em vez do bf16 emulado.
        cfg=get_config(str(root/'model_config.yaml'))
        cfg.defrost();cfg.MODEL.MHR_HEAD.MHR_MODEL_PATH=str(root/'assets/mhr_model.pt')
        self.dtype=serving_dtype(torch)
        if self.dtype==torch.float32 and cfg.TRAIN.get('USE_FP16',False):cfg.TRAIN.USE_FP16=False
        cfg.freeze()
        with local_dinov3(torch):model=SAM3DBody(cfg)
        # Checkpoint do repositório fechado da Meta, conferido por SHA-256 no build e de novo ao subir (verify_assets).
        checkpoint=torch.load(str(root/'model.ckpt'),map_location='cpu',weights_only=False)
        keys=model.load_state_dict(checkpoint.get('state_dict',checkpoint),strict=False);del checkpoint
        # O backbone foi criado sem pesos pré-treinados: se o checkpoint não o preencher, as medidas sairiam de ruído.
        if any(key.startswith('backbone.') for key in keys.missing_keys):raise AlignmentError('SAM3D_BACKBONE_WEIGHTS_MISSING')
        self.model=model.to('cuda').eval()
        if next(self.model.parameters()).device.type!='cuda':raise AlignmentError('SAM3D_MODEL_NOT_ON_GPU')
        self.estimator=SAM3DBodyEstimator(self.model,cfg)
        self.torch=torch;self.person_evidence=person_evidence;self.revision=manifest['revision']
        print(json.dumps({'event':'sam3d_body_loaded','dtype':str(self.dtype),'revision':self.revision,
            'missingKeys':len(keys.missing_keys),'unexpectedKeys':len(keys.unexpected_keys),
            'loadMs':round((time.monotonic()-started)*1000),'cudaBytes':torch.cuda.memory_allocated(0)}),flush=True)
        self.ready=True

    def reconstruct(self,rgb,box):
        # Só o decodificador do corpo: as mãos não entram nas medidas e custariam mais duas passadas.
        return self.estimator.process_one_image(rgb,bboxes=box,inference_type='body')

    def predict(self,instance):
        from .fashn_runtime import decoded_image
        request=BodyMeasurementInput.model_validate(instance)
        rgb=decoded_image(request.person_image)
        torch=self.torch;torch.cuda.synchronize();torch.cuda.reset_peak_memory_stats();started=time.monotonic()
        try:
            measurement=measure_photo(rgb,self.person_evidence,self.reconstruct)
            torch.cuda.synchronize()
            return {'status':'READY','measurement':measurement,
                'diagnostics':{'engine':ENGINE,'modelRevision':self.revision,'device':'cuda:0',
                    'gpuName':torch.cuda.get_device_name(0),'dtype':str(self.dtype),
                    'latencyMs':round((time.monotonic()-started)*1000),'peakCudaBytes':torch.cuda.max_memory_allocated(0),
                    'inferenceType':'body','photoStored':False,'meshReturned':False,'metrologyCertified':False}}
        except torch.cuda.OutOfMemoryError as error:
            print(json.dumps({'event':'sam3d_cuda_oom','dtype':str(self.dtype)}),flush=True)
            raise AlignmentError('GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD') from error
        finally:
            del rgb;self.estimator.batch=None;self.estimator.output=None
            torch.cuda.empty_cache()

    def unload(self):
        self.ready=False;self.estimator=None;self.model=None
        gc.collect();self.torch.cuda.empty_cache()
        print(json.dumps({'event':'sam3d_body_unloaded','cudaBytes':self.torch.cuda.memory_allocated(0)}),flush=True)


class FashnWithBodyRuntime(SharedT4Runtime):
    """A FASHN com o SAM 3D Body sob demanda (shared_runtime.SharedT4Runtime só com a medida do corpo)."""

    def __init__(self,fashn,body_factory):super().__init__(fashn,{'body_measurement':body_factory})

    @property
    def body(self):return self.loaded.get('body_measurement')


def shared_t4_runtime():
    from .shared_runtime import shared_t4_runtime as build
    return build('fashn+sam3d_body')
