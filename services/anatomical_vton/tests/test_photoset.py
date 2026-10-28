"""Recorte de fotos do catálogo (photoSet) na T4 da FASHN: contrato do /predict, divisão da GPU e o lote real por trás.

O lote (scripts/catalog/process_local_sd.py) roda de verdade; o parser + BiRefNet e o LaMa são dublês explícitos e o torch
é falso (sem CUDA aqui). Nada aqui afirma qualidade de recorte: isso só se mede na GPU, com os modelos verdadeiros.
"""
import base64
import io
import json
import sys
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from services.anatomical_vton.models import AlignmentError
from services.anatomical_vton.photoset_runtime import MAX_SOURCE_BYTES,PhotoSetRuntime,lot_modules,sniff,source_bytes
from services.anatomical_vton.shared_runtime import SharedT4Runtime,engine_parts
from services.anatomical_vton.vertex_runtime.server import create_app

ROOT=Path(__file__).resolve().parents[3]
URL='https://brand.example/jaqueta.png'


def shirt():
    """Camiseta azul com braços de pele saindo das mangas e o pescoço dentro da gola (o que o recorte tem de tirar)."""
    image=Image.new('RGB',(600,800),(235,235,235));draw=ImageDraw.Draw(image)
    draw.rectangle((150,200,450,700),fill=(30,60,160));draw.rectangle((60,200,150,330),fill=(30,60,160));draw.rectangle((450,200,540,330),fill=(30,60,160))
    draw.ellipse((250,170,350,260),fill=(224,172,140));draw.rectangle((20,330,150,520),fill=(224,172,140));draw.rectangle((450,330,580,520),fill=(224,172,140))
    target=Image.new('L',image.size,0);t=ImageDraw.Draw(target)
    t.rectangle((150,200,450,700),fill=255);t.rectangle((60,200,150,330),fill=255);t.rectangle((450,200,540,330),fill=255);t.ellipse((250,170,350,260),fill=0)
    body=Image.new('L',image.size,0);b=ImageDraw.Draw(body)
    b.ellipse((250,170,350,260),fill=255);b.rectangle((20,330,150,520),fill=255);b.rectangle((450,330,580,520),fill=255)
    out=io.BytesIO();image.save(out,'PNG')
    return out.getvalue(),target,body


class Fusion:
    """O que parser + BiRefNet devolveriam para a fixture, com a evidência que o engine real atesta."""
    def __init__(self,target,body,occluder=0.0):self.target,self.body,self.occluder=target,body,occluder
    def analyse(self,image,category,subcategory):
        import fashn_open
        t=np.asarray(self.target)>=128;t[:150]=False;f=np.asarray(self.body)>=128
        return fashn_open.Fusion(t,f,t.astype(np.float32),'parser+birefnet',True,('top',),
                                 {'touchesBorder':False,'bodyInsideFraction':0.01,'occluderFraction':self.occluder})


class Filler:
    device='cpu'
    def inpaint(self,image,mask):return Image.new('RGB',image.size,(30,60,160))


@pytest.fixture
def no_cuda(monkeypatch):
    """torch falso: sem CUDA o runtime só sobe com device='cpu' (na T4 ele exige cuda)."""
    fake=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:False))
    monkeypatch.setitem(sys.modules,'torch',fake)
    return fake


def runtime(fusion,problems=()):
    lot,fashn_open=lot_modules(ROOT/'scripts/catalog')
    fake=SimpleNamespace(verify=lambda weights:list(problems),FashnOpenProvider=lambda weights,device:fusion,
                         LamaInpainter=lambda weights,device:Filler())
    return PhotoSetRuntime('/weights','/code',device='cpu',modules=(lot,fake))


def instance(data,**over):
    return {'task':'garment_photo_set','source_image':base64.b64encode(data).decode(),'catalog_category':'upper_piece',
            'subcategory':'t_shirt','source_url':URL,'image_id':'img-7','product_id':'p-7','color':'blue',**over}


def test_the_real_lot_cuts_out_the_photo_and_returns_the_set_json_with_its_pngs(no_cuda):
    data,target,body=shirt()
    result=runtime(Fusion(target,body)).predict(instance(data))
    photo_set=result['photoSet']
    assert result['status']=='RENDERED' and photo_set['status']=='READY' and photo_set['files']=={'whole':'whole.png','fabric':'fabric.png'}
    assert (photo_set['imageId'],photo_set['sourceUrl'],photo_set['category'],photo_set['engine'])==('img-7',URL,'upper_piece','fashn-open')
    assert set(result['files'])=={'whole','fabric'} and result['diagnostics']['engine']=='FASHN_OPEN_PHOTO_SET'
    whole=Image.open(io.BytesIO(base64.b64decode(result['files']['whole'])))
    assert whole.size==(900,1200) and whole.mode=='RGBA' and whole.getpixel((5,5))[3]==0 and whole.getpixel((450,600))[3]==255
    fabric=Image.open(io.BytesIO(base64.b64decode(result['files']['fabric'])))
    assert abs(fabric.width/fabric.height-0.75)<0.01


def test_an_uncertain_occlusion_comes_back_as_review_without_images(no_cuda):
    data,target,body=shirt()
    result=runtime(Fusion(target,body,occluder=0.08)).predict(instance(data))
    assert (result['photoSet']['status'],result['photoSet']['reason'])==('REVIEW','GARMENT_OCCLUSION_UNCERTAIN') and result['files']=={}


def test_the_photo_bytes_and_inputs_are_checked_before_any_model(no_cuda):
    data,target,body=shirt();model=runtime(Fusion(target,body))
    assert sniff(data)=='image/png' and sniff(b'\xff\xd8\xff\xe0rest')=='image/jpeg' and sniff(b'RIFF\0\0\0\0WEBPVP8 ')=='image/webp'
    for bad,code in ((b'GIF89a....','INVALID_SOURCE_IMAGE'),(b'RIFF\0\0\0\0AVI ','INVALID_SOURCE_IMAGE')):
        with pytest.raises(AlignmentError,match=code):model.predict(instance(bad))
    with pytest.raises(AlignmentError,match='INVALID_SOURCE_IMAGE'):model.predict({**instance(data),'source_image':'não é base64'})
    with pytest.raises(AlignmentError,match='SOURCE_IMAGE_TOO_LARGE'):source_bytes(base64.b64encode(data+b'\0'*MAX_SOURCE_BYTES).decode())
    with pytest.raises(AlignmentError,match='PHOTOSET_CATEGORY_NOT_SUPPORTED'):model.predict(instance(data,catalog_category='footwear'))
    with pytest.raises(AlignmentError,match='SOURCE_URL_REQUIRED'):model.predict(instance(data,source_url='file:///etc/passwd'))


def test_weights_that_do_not_match_the_pinned_hashes_stop_the_model(no_cuda):
    data,target,body=shirt()
    with pytest.raises(AlignmentError,match='PHOTOSET_WEIGHTS_INVALID'):runtime(Fusion(target,body),problems=['sha256: lama/big-lama.pt'])
    lot,_=lot_modules(ROOT/'scripts/catalog')
    fake=SimpleNamespace(verify=lambda weights:[],FashnOpenProvider=None,LamaInpainter=None)
    with pytest.raises(AlignmentError,match='REAL_CUDA_DEVICE_REQUIRED'):PhotoSetRuntime('/weights','/code',device='cuda',modules=(lot,fake))


def test_a_set_json_pointing_outside_its_folder_is_refused(no_cuda,tmp_path):
    class Lot:
        Options=lambda **kw:SimpleNamespace(**kw)
        class GhostPipeline:
            def __init__(self,renderer,options,**kw):self.options=options
            def process(self,row):
                folder=self.options.out_dir/'photo-sets'/'x';folder.mkdir(parents=True)
                (tmp_path/'secret.png').write_bytes(b'\x89PNG\r\n\x1a\nsecret')
                (folder/'set.json').write_text(json.dumps({'status':'READY','files':{'whole':str(tmp_path/'secret.png')}}))
                return {'status':'RENDERED','photoSet':{'status':'READY','dir':str(folder)}}
    fake=SimpleNamespace(verify=lambda weights:[],FashnOpenProvider=lambda w,d:None,LamaInpainter=lambda w,d:None)
    data,_,_=shirt()
    with pytest.raises(AlignmentError,match='PHOTOSET_FILE_MISSING'):
        PhotoSetRuntime('/weights','/code',device='cpu',modules=(Lot,fake)).predict(instance(data))


def test_a_gpu_failure_inside_the_lot_comes_back_as_a_short_code(no_cuda):
    class Lot:
        Options=lambda **kw:SimpleNamespace(**kw)
        class GhostPipeline:
            def __init__(self,renderer,options,**kw):pass
            def process(self,row):return {'status':'FAILED','reason':'RuntimeError','image_path':None}
    fake=SimpleNamespace(verify=lambda weights:[],FashnOpenProvider=lambda w,d:None,LamaInpainter=lambda w,d:None)
    data,_,_=shirt()
    result=PhotoSetRuntime('/weights','/code',device='cpu',modules=(Lot,fake)).predict(instance(data))
    assert (result['status'],result['reason'],result['photoSet'],result['files'])==('FAILED','PHOTOSET_GPU_FAILED',None,{})


class Cutter:
    ready=True
    tasks=('virtual_try_on','garment_photo_set')
    def __init__(self):self.received=[]
    def predict(self,instance):
        self.received.append(instance)
        return {'status':'RENDERED','photoSet':{'status':'REVIEW'},'files':{},'diagnostics':{'engine':'FASHN_OPEN_PHOTO_SET'}}


def test_vertex_contract_forwards_only_the_photo_set_fields():
    model=Cutter();body={'task':'garment_photo_set','source_image':'AAAA','catalog_category':'upper_piece','source_url':URL,
                         'subcategory':'jacket','image_id':'img-1','product_id':'p-1','color':'preto'}
    with TestClient(create_app(model)) as client:
        assert client.post('/predict',json={'instances':[body]}).status_code==200 and model.received==[body]
        for change in ({'source_url':None},{'source_url':'ftp://x/y.png'},{'source_image':None},{'catalog_category':'footwear'},
                       {'subcategory':'Jaqueta Couro'},{'garment_image':'AAAA'},{'person_image':'AAAA'},{'category':'tops'},{'seed':1}):
            assert client.post('/predict',json={'instances':[{**body,**change}]}).status_code==422,change
        # e nenhuma outra tarefa aceita os campos do recorte
        for task in ({'task':'virtual_try_on','person_image':'A','garment_image':'B','category':'tops'},{'task':'body_measurement','person_image':'A'}):
            assert client.post('/predict',json={'instances':[{**task,'source_url':URL}]}).status_code==422


class Model:
    def __init__(self,name,log):self.name,self.log=name,log
    def predict(self,instance):self.log.append(('predict',self.name));return {'task':instance['task']}
    def unload(self):self.log.append(('unload',self.name))
    def park(self):self.log.append(('park',self.name))
    def restore(self):self.log.append(('restore',self.name))
    ready=True


def test_the_cut_out_takes_the_t4_alone_and_try_on_gets_it_back():
    log=[];runtime=SharedT4Runtime(Model('fashn',log),{'body_measurement':lambda:Model('body',log),'garment_photo_set':lambda:Model('cut',log)})
    assert runtime.tasks==('virtual_try_on','body_measurement','garment_photo_set')
    runtime.predict({'task':'body_measurement'});runtime.predict({'task':'garment_photo_set'});runtime.predict({'task':'garment_photo_set'})
    assert log==[('restore','fashn'),('predict','body'),('unload','body'),('park','fashn'),('predict','cut'),('park','fashn'),('predict','cut')]
    log.clear();runtime.predict({'task':'virtual_try_on'})
    assert log==[('unload','cut'),('restore','fashn'),('predict','fashn')] and runtime.loaded=={}


def test_photo_set_is_one_more_closed_engine_part(monkeypatch,tmp_path):
    assert engine_parts('fashn+photo_set')=={'photo_set'} and engine_parts('fashn+sam3d_body+portrait+photo_set')=={'sam3d_body','portrait','photo_set'}
    for bad in ('photo_set','fashn+photo_set+photo_set','fashn+photoset'):
        with pytest.raises(AlignmentError,match='INVALID_VTON_MODEL_ENGINE'):engine_parts(bad)
    from services.anatomical_vton import shared_runtime
    monkeypatch.setenv('VTON_PHOTOSET_WEIGHTS',str(tmp_path/'missing'));monkeypatch.setenv('VTON_PHOTOSET_CODE',str(ROOT/'scripts/catalog'))
    monkeypatch.setattr('services.anatomical_vton.fashn_runtime.NativeFashnRuntime',lambda weights:pytest.fail('a FASHN não sobe sem os pesos do recorte'))
    with pytest.raises(AlignmentError,match='PHOTOSET_ASSETS_MISSING'):shared_runtime.shared_t4_runtime('fashn+photo_set')


def test_the_container_installs_verifies_and_imports_the_cut_out_as_the_inference_user():
    docker=(ROOT/'services/anatomical_vton/deploy/google-cloud/Dockerfile.fashn').read_text()
    assert 'COPY scripts/catalog /app/scripts/catalog' in docker and 'requirements-photoset.lock' in docker
    assert 'fashn_open.py download --dest "$VTON_PHOTOSET_WEIGHTS"' in docker
    user=docker.index('USER 10001:10001')
    assert docker.index('fashn_open.py verify --dest "$VTON_PHOTOSET_WEIGHTS"')>user and docker.index('PHOTOSET_IMPORTS_VERIFIED_NO_GPU_INFERENCE')>user
    lock=(ROOT/'services/anatomical_vton/requirements-photoset.lock').read_text()
    pins={line.split('==')[0].lower():line.split('==')[1].split()[0] for line in lock.splitlines() if '==' in line and not line.startswith('#')}
    for other in ('fashn','sam3d','portrait'):
        shared={line.split('==')[0].lower():line.split('==')[1].split()[0] for line in
                (ROOT/f'services/anatomical_vton/requirements-{other}.lock').read_text().splitlines() if '==' in line and not line.startswith('#')}
        assert {name:pins[name] for name in pins if name in shared}=={name:shared[name] for name in pins if name in shared},other
    assert {'timm','kornia'}<=set(pins)
