"""Uma T4 para todas as tarefas: a FASHN fica sempre carregada e as demais sobem no primeiro pedido.

- Medidas do corpo (SAM 3D Body) dividem a GPU com a FASHN; se a prova de roupa estourar a memória, os modelos extras
  saem e a prova é repetida uma vez (a prova tem prioridade).
- O retrato estilizado (SDXL + InstantID) é "exclusivo": enquanto gera, o modelo da prova vai para a RAM e os outros
  extras saem da GPU; a FASHN volta à GPU no próximo pedido de prova.
- O recorte de fotos do catálogo (photoSet: parser + BiRefNet + LaMa) também é exclusivo: num lote ele recebe muitas fotos
  seguidas, e a prova, se chegar no meio, recupera a GPU do mesmo jeito.
"""
import json
import os
import threading
from .models import AlignmentError

OOM='GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD'
EXCLUSIVE=frozenset({'stylized_portrait','garment_photo_set'})


class SharedT4Runtime:
    def __init__(self,fashn,extras):
        self.fashn=fashn;self.factories=dict(extras);self.loaded={};self.lock=threading.Lock()
        self.tasks=('virtual_try_on',*self.factories)

    @property
    def ready(self):return bool(getattr(self.fashn,'ready',False))

    def _extra(self,task):
        with self.lock:
            if task not in self.loaded:self.loaded[task]=self.factories[task]()
            return self.loaded[task]

    def release(self,keep=None):
        with self.lock:
            gone=[(task,model) for task,model in self.loaded.items() if task!=keep]
            for task,_ in gone:del self.loaded[task]
        for task,model in gone:
            model.unload()
            print(json.dumps({'event':'shared_t4_released','task':task}),flush=True)
        return bool(gone)

    def _park_fashn(self):
        if hasattr(self.fashn,'park'):self.fashn.park()

    def _restore_fashn(self):
        if hasattr(self.fashn,'restore'):self.fashn.restore()

    def predict(self,instance):
        task=instance.get('task')
        if task in self.factories:
            if task in EXCLUSIVE:
                self.release(keep=task);self._park_fashn()
            else:
                # Um extra comum convive com a FASHN, mas nunca com um exclusivo carregado.
                if EXCLUSIVE & set(self.loaded):self.release(keep=task)
                self._restore_fashn()
            return self._extra(task).predict(instance)
        if any(name in EXCLUSIVE for name in self.loaded):self.release()
        self._restore_fashn()
        try:return self.fashn.predict(instance)
        except AlignmentError as error:
            if str(error)!=OOM or not self.loaded:raise
        print(json.dumps({'event':'fashn_oom_released_extras_retrying'}),flush=True)
        self.release()
        return self.fashn.predict(instance)


def engine_parts(engine):
    parts=(engine or '').split('+')
    if parts[0]!='fashn' or len(set(parts))!=len(parts) or not set(parts[1:])<= {'sam3d_body','portrait','photo_set'}:
        raise AlignmentError('INVALID_VTON_MODEL_ENGINE')
    return set(parts[1:])


def shared_t4_runtime(engine=None):
    """O contêiner descrito por VTON_MODEL_ENGINE: fashn com qualquer combinação de +sam3d_body, +portrait e +photo_set."""
    from pathlib import Path
    from .fashn_download import DEFAULT_WEIGHTS_DIR as FASHN_WEIGHTS_DIR
    from .fashn_runtime import NativeFashnRuntime
    parts=engine_parts(engine or os.getenv('VTON_MODEL_ENGINE'))
    extras={}
    # Pesos ausentes ou alterados derrubam a subida antes de ocupar a GPU; os modelos extras só carregam no 1º pedido.
    if 'sam3d_body' in parts:
        from . import sam3d_download
        from .sam3d_runtime import Sam3dBodyRuntime
        weights=os.getenv('VTON_SAM3D_WEIGHTS',sam3d_download.DEFAULT_WEIGHTS_DIR);code=os.getenv('VTON_SAM3D_CODE',sam3d_download.DEFAULT_CODE_DIR)
        manifest=sam3d_download.verify_assets(weights)
        if not all((Path(code)/name).is_dir() for name in ('sam-3d-body','dinov3')):raise AlignmentError('SAM3D_CODE_MISSING')
    if 'portrait' in parts:
        from . import portrait_download
        from .portrait_runtime import StylizedPortraitRuntime
        portrait_weights=os.getenv('VTON_PORTRAIT_WEIGHTS',portrait_download.DEFAULT_WEIGHTS_DIR)
        portrait_code=os.getenv('VTON_PORTRAIT_CODE',portrait_download.DEFAULT_CODE_DIR)
        # Na subida: presença e tamanho (rápido); os SHA-256 são conferidos ao carregar o modelo, no 1º retrato.
        portrait_download.verify_assets(portrait_weights,hashes=False);portrait_download.verify_code(portrait_code)
        extras['stylized_portrait']=lambda:StylizedPortraitRuntime(portrait_weights,portrait_code)
    if 'photo_set' in parts:
        from .photoset_runtime import DEFAULT_CODE_DIR as PHOTOSET_CODE,DEFAULT_WEIGHTS_DIR as PHOTOSET_WEIGHTS,PhotoSetRuntime
        photoset_weights=os.getenv('VTON_PHOTOSET_WEIGHTS',PHOTOSET_WEIGHTS);photoset_code=os.getenv('VTON_PHOTOSET_CODE',PHOTOSET_CODE)
        # Na subida: só presença (rápido); tamanho e SHA-256 dos pesos são conferidos ao carregar, no 1º recorte.
        if not (Path(photoset_weights)/'fashn_open_manifest.json').is_file() or not (Path(photoset_code)/'process_local_sd.py').is_file():
            raise AlignmentError('PHOTOSET_ASSETS_MISSING')
        extras['garment_photo_set']=lambda:PhotoSetRuntime(photoset_weights,photoset_code)
    fashn=NativeFashnRuntime(os.getenv('VTON_FASHN_WEIGHTS',FASHN_WEIGHTS_DIR))
    if 'sam3d_body' in parts:
        extras={'body_measurement':lambda:Sam3dBodyRuntime(weights,code,fashn.person_evidence,manifest),**extras}
    return SharedT4Runtime(fashn,extras)
