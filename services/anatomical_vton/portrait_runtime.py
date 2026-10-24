"""Retrato estilizado do Avatar na GPU: um desenho 3D semirrealista que preserva a identidade da foto.

SDXL + InstantID (vetor de identidade do ArcFace + ControlNet dos 5 pontos do rosto), na mesma T4 da FASHN. A foto só
existe em memória durante a geração: nada é gravado. A resposta leva o retrato e a semelhança medida pelo próprio
ArcFace entre a foto e o retrato (cosseno), para o app mostrar o quanto a identidade foi preservada; não é prova de
identidade nem certifica nada.
"""
import base64
import gc
import io
import json
from pathlib import Path
import sys
import threading
import time
from typing import Literal
import numpy as np
from pydantic import BaseModel,ConfigDict,Field
from .models import AlignmentError
from .portrait_download import DEFAULT_CODE_DIR,DEFAULT_WEIGHTS_DIR,FACE_DIR,verify_assets,verify_code
from .portrait_face import FaceIdentity,cosine,portrait_keypoints

ENGINE='SDXL_INSTANTID_STYLIZED_PORTRAIT'
# Resolução nativa do SDXL em retrato (896x1152 ~ 1 MP): busto com espaço para ombros e cabelo.
SIZE=(896,1152)
STEPS=30
GUIDANCE=5.0
IDENTITY_SCALE=.8   # força do vetor de identidade (IP-Adapter do InstantID)
LANDMARK_SCALE=.8   # força dos 5 pontos do rosto (ControlNet do InstantID)
STYLE='semi_realistic'
PROMPT=('semi-realistic stylized 3D character portrait of the person, video game character art, head and shoulders, '
        'facing the camera, soft studio lighting, smooth stylized skin shading, detailed hair, '
        'wearing a plain crew-neck t-shirt, clean light grey background, high detail, sharp focus')
NEGATIVE=('photograph, photo, photorealistic, hyperrealistic, anime, cartoon, chibi, flat illustration, sketch, painting, '
          'nsfw, nudity, cleavage, lingerie, deformed, disfigured, asymmetric eyes, extra limbs, extra fingers, '
          'multiple people, text, watermark, logo, signature, lowres, blurry, jpeg artifacts')


class PortraitInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    task:Literal['stylized_portrait']
    person_image:str
    seed:int=Field(default=42,ge=0,le=2**31-1)


def jpeg_b64(rgb,quality=92):
    from PIL import Image
    out=io.BytesIO();Image.fromarray(np.asarray(rgb,np.uint8)).save(out,format='JPEG',quality=quality,optimize=True)
    return base64.b64encode(out.getvalue()).decode()


def stylize(rgb,face,generate,size=SIZE):
    """Foto RGB -> (retrato RGB, métricas). `generate(vetor, pontos, tamanho)` devolve o retrato gerado."""
    _,kps,identity=face.analyze(rgb)
    target=portrait_keypoints(kps,size)
    output=np.asarray(generate(identity,target,size))
    if output.shape!=(size[1],size[0],3) or output.dtype!=np.uint8 or output.std()<2:raise AlignmentError('DEGENERATE_GENERATED_IMAGE')
    try:_,_,generated=face.analyze(output)
    except AlignmentError as error:raise AlignmentError('GENERATED_FACE_REJECTED') from error
    return output,{'identitySimilarity':round(cosine(identity,generated),4),'identityMetric':'ARCFACE_GLINTR100_COSINE'}


class StylizedPortraitRuntime:
    tasks=('stylized_portrait',)

    def __init__(self,weights_dir=DEFAULT_WEIGHTS_DIR,code_dir=DEFAULT_CODE_DIR):
        started=time.monotonic();root=Path(weights_dir).resolve()
        # Tudo conferido por SHA-256 antes de ocupar memória com o modelo.
        manifest=verify_assets(root);verify_code(code_dir)
        import torch
        if not torch.cuda.is_available():raise AlignmentError('REAL_CUDA_DEVICE_REQUIRED')
        if str(code_dir) not in sys.path:sys.path.insert(0,str(code_dir))
        from diffusers import AutoencoderKL,ControlNetModel
        from pipeline_stable_diffusion_xl_instantid import StableDiffusionXLInstantIDPipeline,draw_kps
        dtype=torch.float16
        controlnet=ControlNetModel.from_pretrained(str(root/'instantid'/'ControlNetModel'),torch_dtype=dtype,local_files_only=True)
        vae=AutoencoderKL.from_pretrained(str(root/'vae'),torch_dtype=dtype,local_files_only=True)
        pipe=StableDiffusionXLInstantIDPipeline.from_pretrained(str(root/'sdxl'),controlnet=controlnet,vae=vae,torch_dtype=dtype,
                                                                variant='fp16',local_files_only=True)
        pipe.load_ip_adapter_instantid(str(root/'instantid'/'ip-adapter.bin'),scale=IDENTITY_SCALE)
        # A FASHN continua na T4: cada parte do SDXL só ocupa a GPU enquanto trabalha.
        pipe.enable_model_cpu_offload(gpu_id=0)
        pipe.image_proj_model.to('cuda:0',dtype=dtype)
        pipe.set_progress_bar_config(disable=True)
        self.pipe=pipe;self.draw_kps=draw_kps;self.torch=torch;self.lock=threading.Lock()
        self.face=FaceIdentity(root/FACE_DIR/'scrfd_10g_bnkps.onnx',root/FACE_DIR/'glintr100.onnx')
        self.revisions=manifest['revisions']
        print(json.dumps({'event':'portrait_model_loaded','revisions':self.revisions,'loadMs':round((time.monotonic()-started)*1000),
                          'cudaBytes':torch.cuda.memory_allocated(0)}),flush=True)
        self.ready=True

    def generate(self,identity,kps,size,seed):
        from PIL import Image
        control=self.draw_kps(Image.new('RGB',size),kps)
        result=self.pipe(prompt=PROMPT,negative_prompt=NEGATIVE,image_embeds=identity,image=control,
                         controlnet_conditioning_scale=LANDMARK_SCALE,ip_adapter_scale=IDENTITY_SCALE,
                         num_inference_steps=STEPS,guidance_scale=GUIDANCE,width=size[0],height=size[1],
                         generator=self.torch.Generator('cpu').manual_seed(seed))
        if len(result.images)!=1:raise AlignmentError('ONE_GENERATED_IMAGE_REQUIRED')
        return np.asarray(result.images[0].convert('RGB'))

    def predict(self,instance):
        from .fashn_runtime import decoded_image
        request=PortraitInput.model_validate(instance)
        rgb=decoded_image(request.person_image)
        torch=self.torch;torch.cuda.reset_peak_memory_stats();started=time.monotonic()
        try:
            with self.lock:
                output,metrics=stylize(rgb,self.face,lambda identity,kps,size:self.generate(identity,kps,size,request.seed))
            return {'status':'READY','image_jpeg':jpeg_b64(output),'width':output.shape[1],'height':output.shape[0],**metrics,
                    'diagnostics':{'engine':ENGINE,'style':STYLE,'revisions':self.revisions,'device':'cuda:0',
                                   'gpuName':torch.cuda.get_device_name(0),'dtype':'float16','seed':request.seed,'steps':STEPS,
                                   'latencyMs':round((time.monotonic()-started)*1000),'peakCudaBytes':torch.cuda.max_memory_allocated(0),
                                   'photoStored':False,'identityCertified':False}}
        except torch.cuda.OutOfMemoryError as error:
            print(json.dumps({'event':'portrait_cuda_oom'}),flush=True)
            raise AlignmentError('GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD') from error
        finally:
            del rgb;torch.cuda.empty_cache()

    def unload(self):
        self.ready=False;self.pipe=None;self.face=None
        gc.collect();self.torch.cuda.empty_cache()
        print(json.dumps({'event':'portrait_model_unloaded','cudaBytes':self.torch.cuda.memory_allocated(0)}),flush=True)
