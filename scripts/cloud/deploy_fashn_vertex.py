#!/usr/bin/env python3
"""Build/deploy ONE native FASHN T4 and run a real-image CUDA smoke test.

Run in authenticated Cloud Shell. No credentials are written or printed.
Without --apply, only a local plan is emitted. By default the smoke deployment
is undeployed afterwards; --keep-deployed retains a billed serving replica.
--with-sam3d builds the same container with SAM 3D Body (Avatar 3D body measurements) on the same T4; its gated
Hugging Face weights are read at build time from the Secret Manager secret named by --hf-secret.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
PROJECT='project-14023673-32d6-4bf2-8b7'
REGION='southamerica-east1'
NAME='fashionai-fashn-gpu'
HF_SECRET='fashionai-hf-token'
# Códigos curtos que o servidor da GPU devolve (vertex_runtime/server.py e fashn_runtime.py). Só eles são mostrados:
# o corpo bruto de um erro pode ecoar a entrada (imagens em base64) e nunca é impresso.
SERVER_HINTS={
    'INVALID_PREDICTION_INPUT':'o corpo da requisição não segue o contrato do /predict',
    'TASK_NOT_SUPPORTED_BY_MODEL':'a imagem implantada não atende esta tarefa: a prova pede VTON_MODEL_ENGINE=fashn e as medidas do corpo, uma imagem construída com --with-sam3d',
    'INVALID_VTON_IMAGE':'a foto não pôde ser lida: use JPG, PNG ou WebP com até 1536 px no maior lado e até 6 MB',
    'EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED':'a foto da pessoa precisa ter exatamente uma pessoa detectada (sem reflexo, pôster ou gente ao fundo)',
    'INSUFFICIENT_SHARED_BODY_LANDMARKS':'corpo pouco visível: use foto de frente, em pé, com ombros, cotovelos, punhos e quadril aparecendo',
    'VISIBLE_LANDMARK_OUTSIDE_IMAGE':'parte do corpo detectada fora da imagem: deixe uma margem em volta da pessoa',
    'NONFINITE_DWPOSE':'a detecção de pose falhou nesta foto; tente outra foto',
    'INVALID_PERSON_DETECTION':'a detecção de pessoa falhou nesta foto; tente outra foto',
    'GENERATED_POSE_DRIFT_REJECTED':'a GPU gerou a imagem, mas a pose mudou além do limite (RMSE 0,08); tente outra foto de pessoa (de frente, braços ao lado do corpo) ou outro --seed',
    'DEGENERATE_GENERATED_IMAGE':'a imagem gerada saiu vazia ou uniforme; tente outra foto ou outro --seed',
    'ONE_GENERATED_IMAGE_REQUIRED':'o modelo não devolveu exatamente uma imagem',
    'INVALID_GARMENT_POSE':'a foto da peça não pôde ser analisada; use --garment-photo-type flat-lay ou model',
    'MULTIPLE_GARMENT_MODELS_REJECTED':'a foto da peça tem mais de um modelo vestindo; use foto de uma pessoa só ou flat-lay',
    'FASHN_CATEGORY_NOT_SUPPORTED':'categoria não suportada: tops, bottoms ou one-pieces',
    'GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD':'a T4 ficou sem memória: reduza o tamanho das fotos',
    'GPU_BUSY_RETRY_LATER':'a GPU está ocupada com outra inferência; tente de novo em instantes',
    'GPU_PREDICTION_FAILED':'falha interna na GPU; rode --diagnose e veja os logs do endpoint',
    'MODEL_NOT_READY':'o modelo ainda não terminou de carregar; aguarde e tente de novo',
    'VERTEX_PAYLOAD_LIMIT':'requisição grande demais para o endpoint',
    'VERTEX_RESPONSE_LIMIT':'resposta grande demais para o endpoint',
    'REAL_CUDA_DEVICE_REQUIRED':'o contêiner não encontrou CUDA',
    'DWPOSE_CUDA_PROVIDER_REQUIRED':'o ONNX Runtime não carregou o provedor CUDA',
    'VTON_MODEL_NOT_ON_GPU':'o modelo não foi carregado na GPU',
    'FULL_BODY_NOT_VISIBLE':'para medir o corpo, a foto precisa mostrar a pessoa inteira, da cabeça aos pés (tornozelos visíveis), de frente e em pé',
    'ONE_BODY_RECONSTRUCTION_REQUIRED':'o SAM 3D Body não reconstruiu exatamente um corpo; tente outra foto',
    'INVALID_BODY_MESH':'a malha do corpo reconstruída veio inválida; tente outra foto',
    'INVALID_BODY_KEYPOINTS':'os pontos 3D do corpo vieram inválidos; tente outra foto',
    'IMPLAUSIBLE_BODY_SCALE':'a reconstrução do corpo saiu degenerada; use foto de frente, em pé, corpo inteiro',
    'IMPLAUSIBLE_BODY_PROPORTIONS':'a reconstrução do corpo saiu implausível (pose torta ou corpo cortado); use foto de frente, em pé, braços levemente afastados',
    'DEGENERATE_BODY_FRAME':'não deu para orientar o corpo (ombros, quadris e tornozelos); use foto de frente, em pé',
}
# Máquina padrão por GPU de serving no Vertex (1 GPU por réplica).
MACHINE_FOR={'NVIDIA_TESLA_T4':'n1-standard-8','NVIDIA_L4':'g2-standard-8'}
MAX_SIDE=1536  # decode_image (auto_catalog.py) recusa lados maiores: IMAGE_DIMENSION_LIMIT -> 422 INVALID_VTON_IMAGE


def server_code(raw):
    """Primeiro código conhecido no corpo de erro (JSON do Vertex ou do FastAPI); nunca devolve texto livre."""
    text=raw.decode('utf-8','replace') if isinstance(raw,bytes) else str(raw or '')
    for token in re.findall(r'[A-Z][A-Z0-9_]{3,80}',text):
        if token in SERVER_HINTS:return token
    return None


def image_size(data):
    """(largura, altura) de PNG, JPEG ou WebP lendo só o cabeçalho; None se o formato não for reconhecido."""
    if data[:8]==b'\x89PNG\r\n\x1a\n' and data[12:16]==b'IHDR':
        return int.from_bytes(data[16:20],'big'),int.from_bytes(data[20:24],'big')
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP':
        chunk=data[12:16]
        if chunk==b'VP8X':return 1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little')
        if chunk==b'VP8L':
            bits=int.from_bytes(data[21:25],'little');return (bits&0x3FFF)+1,((bits>>14)&0x3FFF)+1
        if chunk==b'VP8 ':return int.from_bytes(data[26:28],'little')&0x3FFF,int.from_bytes(data[28:30],'little')&0x3FFF
        return None
    if data[:2]==b'\xff\xd8':
        i=2
        while i+9<len(data):
            if data[i]!=0xFF:i+=1;continue
            marker=data[i+1]
            if marker in (0xD8,0x01) or 0xD0<=marker<=0xD7:i+=2;continue
            length=int.from_bytes(data[i+2:i+4],'big')
            if marker in (0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF):
                return int.from_bytes(data[i+7:i+9],'big'),int.from_bytes(data[i+5:i+7],'big')
            i+=2+length
    return None


def fitted_image(data,max_side=MAX_SIDE):
    """Reduz a foto para caber em max_side (proporção mantida), como o servidor exige; precisa do Pillow."""
    try:
        from PIL import Image
    except ImportError:
        raise ValueError(f'SMOKE_IMAGE_OVER_{max_side}_PX: instale o Pillow (python3 -m pip install --user pillow) '
                         f'para o script reduzir a foto, ou reduza-a para no máximo {max_side} px no maior lado') from None
    import io
    with Image.open(io.BytesIO(data)) as image:
        image.load();scale=max_side/max(image.size)
        resized=image.resize((max(16,round(image.width*scale)),max(16,round(image.height*scale))),Image.LANCZOS)
        out=io.BytesIO()
        if resized.mode in ('RGBA','LA','P'):resized.save(out,'PNG',optimize=True)
        else:resized.convert('RGB').save(out,'JPEG',quality=92)
        return out.getvalue()


def command(*args,capture=False):
    result=subprocess.run(['gcloud',*args],check=True,text=True,
                          stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


class CloudOperationFailed(RuntimeError):
    def __init__(self,operation):
        self.operation=operation
        error=operation.get('error',{})
        # Management operations carry resource diagnostics, not prediction inputs.
        message=str(error.get('message','No error message returned'))[:4000]
        message=re.sub(r'(?i)bearer\s+[^\s]+','Bearer [REDACTED]',message)
        super().__init__(f"CLOUD_OPERATION_FAILED: {error.get('code')}; "
                         f"operation={operation.get('name')}; message={message}")


class CloudHTTPError(RuntimeError):
    def __init__(self,status,message):
        self.status=status;super().__init__(message)


def google_error(raw):
    """Status, motivo e mensagem do erro JSON da API de gerenciamento (nunca usado para :predict)."""
    try:error=json.loads(raw).get('error',{})
    except (ValueError,AttributeError):return ''
    if not isinstance(error,dict):return ''
    reasons=[d.get('reason') for d in error.get('details',[]) if isinstance(d,dict) and d.get('reason')]
    message=re.sub(r'(?i)bearer\s+[^\s]+','Bearer [REDACTED]',str(error.get('message','')))[:500]
    return '; '.join(str(part) for part in (error.get('status'),*reasons[:2],message) if part)


class Cloud:
    def __init__(self,project,region):
        self.project=project;self.region=region
        self.base=f'https://{region}-aiplatform.googleapis.com/v1/'
        self.parent=f'projects/{project}/locations/{region}'

    def request(self,method,path,body=None,host=None):
        # Refresh from active gcloud identity; never echo token or inference body.
        token=command('auth','print-access-token',capture=True)
        url=(f'https://{host}/v1/' if host else self.base)+path
        data=None if body is None else json.dumps(body,separators=(',',':')).encode()
        if data is not None and len(data)>9_000_000:raise RuntimeError('PREDICTION_PAYLOAD_OVER_9_MB')
        request=urllib.request.Request(url,data=data,method=method,headers={
            'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        try:
            with urllib.request.build_opener(NoRedirect).open(request,timeout=650) as response:
                raw=response.read(10_000_001)
                if len(raw)>10_000_000:raise RuntimeError('CLOUD_RESPONSE_TOO_LARGE')
                return json.loads(raw)
        except urllib.error.HTTPError as error:
            # :predict errors may echo the photos: their raw body is never printed, only a known short server code
            # and its hint. Management calls (no dedicated host) carry resource diagnostics, shown like operation errors.
            try:raw=error.read(65_536)
            except Exception:raw=b''
            code=server_code(raw)
            detail=f'; servidor: {code} — {SERVER_HINTS[code]}' if code else ''
            if not code and host is None and not path.endswith(':predict'):
                reason=google_error(raw);detail=f'; Google: {reason}' if reason else ''
            raise CloudHTTPError(error.code,f'GOOGLE_CLOUD_HTTP_{error.code}: {method} {path.split(":")[0]}{detail}') from None

    def wait(self,operation,seconds=2400):
        started=time.monotonic();deadline=started+seconds
        print('Operação: '+str(operation.get('name','UNKNOWN')),flush=True)
        while not operation.get('done'):
            metadata=operation.get('metadata',{})
            # DeployModel reports where it is: ADDING_NODES_TO_CLUSTER = waiting for a GPU machine,
            # GETTING_CONTAINER_IMAGE = pulling the image, STARTING_MODEL_SERVER = container/startup probe.
            stage=metadata.get('deploymentStage','')
            stage='' if stage in ('','DEPLOYMENT_STAGE_UNSPECIFIED') else stage
            if time.monotonic()>deadline:
                raise RuntimeError(f"CLOUD_OPERATION_STILL_RUNNING: {operation.get('name')}"+(f' (etapa {stage})' if stage else '')+
                    '; a operação continua no Google Cloud. Rode o mesmo comando para continuar acompanhando, sem novo deploy.')
            kind=metadata.get('@type','operação').rsplit('.',1)[-1]+(f' [{stage}]' if stage else '')
            print(f'Aguardando Google Cloud: {kind} ({round(time.monotonic()-started)}s)...',flush=True)
            time.sleep(20)
            name=operation['name']
            for attempt in range(4):
                # Polling is read-only and the operation keeps running in Google Cloud: ride out a transient
                # 403/429/5xx (e.g. Cloud Shell refreshing credentials) instead of aborting a 20-minute wait.
                try:operation=self.request('GET',name);break
                except CloudHTTPError as error:
                    if attempt==3 or not (error.status in (403,429) or error.status>=500):raise
                    print(f'Consulta da operação falhou ({error}); nova tentativa em 30 s...',flush=True)
                    time.sleep(30)
        if operation.get('error'):raise CloudOperationFailed(operation)
        return operation.get('response',{})

    def endpoints(self):
        values=[];path=self.parent+'/endpoints?pageSize=100'
        while path:
            result=self.request('GET',path);values.extend(result.get('endpoints',[]))
            page=result.get('nextPageToken');path=self.parent+'/endpoints?pageSize=100&pageToken='+page if page else None
        return values


def stage_context(destination):
    target=Path(destination)/'services/anatomical_vton'
    shutil.copytree(ROOT/'services/anatomical_vton',target,
                    ignore=shutil.ignore_patterns('__pycache__','*.pyc','tests'))
    shutil.copyfile(ROOT/'services/anatomical_vton/deploy/google-cloud/Dockerfile.fashn',Path(destination)/'Dockerfile')


def release_tag(source,with_sam3d=False):
    """12 hex do commit; a variante com SAM 3D Body ganha outra tag no mesmo formato, para nunca sobrescrever nem ser
    confundida com a imagem só FASHN do mesmo commit."""
    return hashlib.sha256((source+'+sam3d_body').encode()).hexdigest()[:12] if with_sam3d else source[:12]


def build_config(image,service_account,project,hf_secret=None):
    step={'name':'gcr.io/cloud-builders/docker','env':['DOCKER_BUILDKIT=1'],'args':['build','-t',image,'.']}
    config={'steps':[step],'images':[image],'timeout':'2400s','serviceAccount':service_account,
            'options':{'machineType':'E2_HIGHCPU_8','diskSizeGb':100,'logging':'CLOUD_LOGGING_ONLY'}}
    if hf_secret:
        # Cloud Build puts the secret only in this step's environment. It reaches BuildKit as a file in a private temp
        # directory removed when the step ends, and is never echoed. "$$" escapes Cloud Build substitutions.
        script=('set -eu; umask 077; t=$$(mktemp -d); trap \'rm -rf "$$t"\' EXIT; printf %s "$$HF_TOKEN" > "$$t/hf_token"; '
                f'docker build --build-arg VTON_ENGINE=fashn+sam3d_body --secret id=hf_token,src="$$t/hf_token" -t {image} .')
        step.update(entrypoint='bash',args=['-c',script],secretEnv=['HF_TOKEN'])
        config['availableSecrets']={'secretManager':[{'versionName':f'projects/{project}/secrets/{hf_secret}/versions/latest','env':'HF_TOKEN'}]}
        config['timeout']='3600s'
    return config


def iam_command(*args,attempts=8):
    """Retry only identity propagation/concurrent-policy failures; never hide 403."""
    for attempt in range(attempts):
        result=subprocess.run(['gcloud',*args],text=True,capture_output=True)
        if result.returncode==0:return result.stdout.strip()
        message=(result.stderr or '').lower()
        transient=any(code in message for code in (
            'does not exist','not_found','not found','concurrent policy changes'))
        if not transient or attempt==attempts-1:
            print(result.stderr or 'Google Cloud IAM command failed.',file=sys.stderr)
            raise subprocess.CalledProcessError(result.returncode,['gcloud',*args])
        delay=min(5*2**attempt,20)
        print(f'Aguardando propagação da identidade IAM ({attempt+1}/{attempts}, {delay}s)...',flush=True)
        time.sleep(delay)


def ensure_build_account(project,email):
    args=['iam','service-accounts','describe',email,'--project='+project,'--format=json']
    result=subprocess.run(['gcloud',*args],text=True,capture_output=True)
    if result.returncode:
        if not any(code in (result.stderr or '').lower() for code in ('not_found','not found','does not exist')):
            print(result.stderr,file=sys.stderr)
            raise subprocess.CalledProcessError(result.returncode,['gcloud',*args])
        created=subprocess.run(['gcloud','iam','service-accounts','create','fashionai-vton-build',
            '--display-name=FashionAI VTON build','--project='+project,'--quiet'],text=True,capture_output=True)
        if created.returncode and not any(code in (created.stderr or '').lower() for code in ('already_exists','already exists')):
            print(created.stderr,file=sys.stderr)
            raise subprocess.CalledProcessError(created.returncode,created.args)
    # A successful create/list is not evidence that all IAM replicas see it.
    account=json.loads(iam_command(*args))
    if account.get('email')!=email or account.get('disabled'):
        raise RuntimeError('BUILD_SERVICE_ACCOUNT_DISABLED_OR_MISMATCHED')


def grant_build_secret(project,secret,email):
    """O build lê só este segredo (o token do Hugging Face); o valor nunca passa por este script."""
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,255}',secret):raise ValueError('INVALID_SECRET_NAME')
    found=subprocess.run(['gcloud','secrets','describe',secret,'--project='+project,'--format=value(name)'],text=True,capture_output=True)
    if found.returncode:
        raise RuntimeError(f'HF_SECRET_NOT_FOUND: crie o segredo {secret} no Secret Manager com um token de leitura do Hugging Face '
                           'de uma conta com acesso aprovado a facebook/sam-3d-body-dinov3, e rode de novo')
    iam_command('secrets','add-iam-policy-binding',secret,'--project='+project,'--member=serviceAccount:'+email,
                '--role=roles/secretmanager.secretAccessor','--condition=None','--quiet')


def resumed_state(state,project,image):
    if state and state.get('project')!=project:raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    if state.get('image') not in (None,image) and (state.get('model') or state.get('deployOperation')):
        raise RuntimeError('STATE_BELONGS_TO_ANOTHER_RELEASE_USE_NEW_OUTPUT_DIRECTORY')
    # Before model registration a newer installer may safely resume the same
    # empty endpoint; never delete prior state, models or deployment operations.
    return {**state,'project':project,'image':image}


def prepare_build_identity(project,region):
    email='fashionai-vton-build@'+project+'.iam.gserviceaccount.com'
    member='serviceAccount:'+email
    ensure_build_account(project,email)
    # No Owner/Editor grant. Build can read only its staged sources, push only
    # into this repository and write build logs in the selected project.
    iam_command('projects','add-iam-policy-binding',project,'--member='+member,
            '--role=roles/logging.logWriter','--condition=None','--quiet')
    iam_command('artifacts','repositories','add-iam-policy-binding','fashionai-vton',
            '--location='+region,'--project='+project,'--member='+member,
            '--role=roles/artifactregistry.writer','--quiet')
    bucket=project+'-vton-build'
    buckets=json.loads(command('storage','buckets','list','--project='+project,'--format=json',capture=True))
    if not any(b.get('name','').removeprefix('gs://').rstrip('/')==bucket for b in buckets):
        command('storage','buckets','create','gs://'+bucket,'--location='+region,
                '--project='+project,'--uniform-bucket-level-access','--quiet')
    iam_command('storage','buckets','add-iam-policy-binding','gs://'+bucket,
            '--member='+member,'--role=roles/storage.objectViewer','--quiet')
    return 'projects/'+project+'/serviceAccounts/'+email,'gs://'+bucket+'/sources'


def describe_build(project,region,build_id):
    if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',build_id):
        raise ValueError('INVALID_CLOUD_BUILD_ID')
    return json.loads(command('builds','describe',build_id,'--project='+project,
                              '--region='+region,'--format=json',capture=True))


def build_image_reference(build,project,region):
    images=build.get('images',[])
    prefix=f'{region}-docker.pkg.dev/{project}/fashionai-vton/fashn:'
    if build.get('projectId',project)!=project or len(images)!=1 or not images[0].startswith(prefix):
        raise RuntimeError('BUILD_DOES_NOT_MATCH_FASHIONAI_PROJECT_AND_IMAGE')
    if not re.fullmatch(r'[0-9a-f]{12}',images[0][len(prefix):]):
        raise RuntimeError('INVALID_BUILD_RELEASE_TAG')
    return images[0]


def replacement_build(project,region,original_id,image):
    builds=json.loads(command('builds','list','--project='+project,'--region='+region,
        '--filter=images:"'+image+'"','--sort-by=~createTime','--limit=20','--format=json',capture=True))
    candidates=[build for build in builds if build.get('id')!=original_id and build.get('images')==[image]
                and build.get('status') in ('PENDING','QUEUED','WORKING','SUCCESS')]
    active=[build for build in candidates if build.get('status')!='SUCCESS']
    if len(active)>1:raise RuntimeError('MULTIPLE_ACTIVE_BUILDS_DO_NOT_SUBMIT_ANOTHER')
    return active[0] if active else next(iter(candidates),None)


def adopted_build(state,build,build_id,project,region,current_image,restart_cancelled=False):
    if state.get('project') not in (None,project):raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    image=build_image_reference(build,project,region)
    if state.get('image') not in (None,image):raise RuntimeError('STATE_AND_RESUMED_BUILD_IMAGE_MISMATCH')
    if restart_cancelled and build.get('status')=='CANCELLED':
        if state.get('model') or state.get('deployOperation'):
            raise RuntimeError('CANNOT_RESTART_BUILD_WITH_REGISTERED_OR_DEPLOYING_MODEL')
        print(f'Build {build_id} confirmado CANCELLED; preparando nova compilação.',flush=True)
        result={**state};result.pop('buildId',None)
        return result,current_image
    # A fresh release may contain only the ID loaded from image-build.json.
    # Carry validated identity forward before resumed_state checks the project.
    return {**state,'project':project,'image':image,'buildId':build_id},image


def wait_build(project,region,build_id,image,seconds=3000):
    deadline=time.monotonic()+seconds
    while True:
        build=describe_build(project,region,build_id)
        if build_image_reference(build,project,region)!=image:raise RuntimeError('CLOUD_BUILD_IMAGE_MISMATCH')
        status=build.get('status')
        print(f'Cloud Build {build_id}: {status}',flush=True)
        if status=='SUCCESS':return build
        if status not in ('PENDING','QUEUED','WORKING'):
            raise RuntimeError(f'CLOUD_BUILD_{status}: {build_id}; consulte o log antes de iniciar outro build')
        if time.monotonic()>deadline:raise RuntimeError('CLOUD_BUILD_WAIT_TIMEOUT_RESUME_SAME_BUILD')
        time.sleep(20)


def build_image(project,region,image,state,state_file,hf_secret=None):
    build_id=state.get('buildId')
    if not build_id:
        service_account,staging=prepare_build_identity(project,region)
        if hf_secret:grant_build_secret(project,hf_secret,service_account.rsplit('/',1)[-1])
        with tempfile.TemporaryDirectory(prefix='fashionai-cloud-build-') as directory:
            stage_context(directory)
            config=build_config(image,service_account,project,hf_secret)
            path=Path(directory)/'cloudbuild.json';path.write_text(json.dumps(config))
            # Submit once, checkpoint the server ID, then poll separately. Ctrl+C
            # during polling cannot invoke gcloud submit's cancellation handler.
            build_id=command('builds','submit',directory,'--config='+str(path),'--project='+project,
                    '--region='+region,'--gcs-source-staging-dir='+staging,'--quiet',
                    '--async','--format=value(id)',capture=True)
            if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',build_id):
                raise RuntimeError('CLOUD_BUILD_ID_NOT_RETURNED_CHECK_CONSOLE_BEFORE_RESUBMIT')
            state['buildId']=build_id;save_json(state_file,state)
    print(f'Logs: https://console.cloud.google.com/cloud-build/builds;region={region}/{build_id}?project={project}',flush=True)
    return wait_build(project,region,build_id,image,4200 if hf_secret else 3000)


def resume_deployment(cloud,state,state_file,retry_failed=False):
    previous=cloud.request('GET',state['deployOperation'])
    if previous.get('done') and previous.get('error') and retry_failed:
        history=state.setdefault('failedDeployOperations',[])
        history.append({'name':previous.get('name',state['deployOperation']),
                        'error':previous['error']})
        state.pop('deployOperation',None);state.pop('deployedModelId',None)
        save_json(state_file,state)
        print('Nova tentativa de deploy solicitada explicitamente; falha anterior preservada no estado.',flush=True)
    else:
        # Even a completed operation MUST have its error checked. Never silently
        # submit another billed attempt when retrying this script after failure.
        cloud.wait(previous)


def diagnose_deployment(project,region,output):
    path=Path(output)/'deployment.json'
    if not path.is_file():raise RuntimeError('NO_SAVED_DEPLOYMENT_STATE')
    state=json.loads(path.read_text())
    if state.get('project')!=project:raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    cloud=Cloud(project,region)
    print(json.dumps({key:state.get(key) for key in ('project','image','buildId','model','endpoint','deployOperation')},indent=2),flush=True)
    if state.get('deployOperation'):
        operation=cloud.request('GET',state['deployOperation'])
        print(json.dumps({**{key:operation.get(key) for key in ('name','done','error')},
            'deploymentStage':operation.get('metadata',{}).get('deploymentStage')},indent=2,ensure_ascii=False),flush=True)
    if state.get('endpoint'):
        endpoint=cloud.request('GET',state['endpoint'])
        print(json.dumps({'endpoint':endpoint.get('name'),'deployedModels':[
            {key:model.get(key) for key in ('id','model','displayName')} for model in endpoint.get('deployedModels',[])]},indent=2),flush=True)


def start_new_release(cloud,state,state_file,image,endpoint):
    if not state or state.get('image')==image:return state
    if endpoint.get('deployedModels'):raise RuntimeError('NEW_RELEASE_REQUIRES_NO_DEPLOYED_MODEL')
    if state.get('endpoint') not in (None,endpoint.get('name')):
        raise RuntimeError('STATE_ENDPOINT_MISMATCH')
    if state.get('deployOperation'):
        operation=cloud.request('GET',state['deployOperation'])
        if not operation.get('done'):raise RuntimeError('PREVIOUS_DEPLOYMENT_STILL_RUNNING')
    elif state.get('buildId'):
        build=describe_build(cloud.project,cloud.region,state['buildId'])
        if build.get('status') in ('PENDING','QUEUED','WORKING'):
            raise RuntimeError('PREVIOUS_BUILD_STILL_RUNNING')
    archive=Path(state_file).with_name('deployment.previous-'+str(time.time_ns())+'.json')
    save_json(archive,state)
    print('Estado da versão anterior preservado em '+str(archive),flush=True)
    # Preserve all registered cloud resources. The new image gets a new model;
    # never silently change the image of an existing registered model.
    return {}


def image_payload(path):
    """Confere a foto ANTES de qualquer deploy: o servidor recusa (422) lados acima de 1536 px e formatos ilegíveis."""
    data=Path(path).read_bytes()
    if not data:raise ValueError('SMOKE_IMAGE_EMPTY')
    size=image_size(data)
    if size is None:raise ValueError('SMOKE_IMAGE_FORMAT_UNSUPPORTED: use JPG, PNG ou WebP (HEIC e outros formatos não são lidos pelo servidor)')
    if min(size)<16:raise ValueError('SMOKE_IMAGE_TOO_SMALL')
    if max(size)>MAX_SIDE:
        data=fitted_image(data)
        print(f'Foto {Path(path).name} reduzida de {size[0]}x{size[1]} para caber em {MAX_SIDE} px (exigência do servidor).',flush=True)
    if len(data)>3_000_000:raise ValueError('SMOKE_IMAGE_MUST_BE_1_BYTE_TO_3_MB')
    return base64.b64encode(data).decode(),hashlib.sha256(data).hexdigest()


def fashn_container_spec(image):
    # Vertex defaults to only three startup failures. Python/CUDA imports, hashing
    # 2.55 GB and loading the model happen before Uvicorn can answer /health.
    check={'exec':{'command':['python','-c',
        'import urllib.request; urllib.request.urlopen("http://localhost:8080/health", timeout=5)']},
        'periodSeconds':10,'timeoutSeconds':15}
    return {'imageUri':image,'ports':[{'containerPort':8080}],
        'healthRoute':'/health','predictRoute':'/predict','sharedMemorySizeMb':'1024',
        'deploymentTimeout':'1800s',
        'startupProbe':{**check,'initialDelaySeconds':30,'failureThreshold':60,'successThreshold':1},
        'healthProbe':{**check,'failureThreshold':3,'successThreshold':1}}


def reregister_model(cloud,state,state_file,endpoint):
    """Keep the built image/endpoint; archive immutable model registration data."""
    if not state.get('model') or not state.get('image') or not state.get('buildId'):
        raise RuntimeError('REGISTERED_MODEL_AND_EXISTING_BUILD_REQUIRED')
    if state.get('project')!=cloud.project:raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    if state.get('endpoint')!=endpoint.get('name'):raise RuntimeError('STATE_ENDPOINT_MISMATCH')
    if endpoint.get('deployedModels'):raise RuntimeError('REREGISTER_REQUIRES_NO_DEPLOYED_MODEL')
    if state.get('deployOperation'):
        operation=cloud.request('GET',state['deployOperation'])
        if not operation.get('done'):raise RuntimeError('PREVIOUS_DEPLOYMENT_STILL_RUNNING')
    archive=Path(state_file).with_name('deployment.registration.previous-'+str(time.time_ns())+'.json')
    save_json(archive,state)
    print('Registro anterior preservado em '+str(archive)+'; reutilizando imagem '+state['image'],flush=True)
    return {key:state[key] for key in ('project','image','buildId','endpoint')}


def build_only_release(project,region,image,output,apply=False,hf_secret=None):
    """Publish a container, without creating endpoints, models or GPU replicas."""
    plan={'executed':False,'image':image,'project':project,'region':region,'gpuReplicas':0,'withSam3d':bool(hf_secret)}
    if not apply:
        print(json.dumps(plan,indent=2));return plan
    # Read-only authentication/project check before enabling services or uploading.
    command('projects','describe',project,'--format=value(projectId)',capture=True)
    command('services','enable','artifactregistry.googleapis.com','cloudbuild.googleapis.com',
            'iam.googleapis.com',*(['secretmanager.googleapis.com'] if hf_secret else []),'--project='+project)
    repositories=json.loads(command('artifacts','repositories','list','--location='+region,
                                    '--project='+project,'--format=json',capture=True))
    if not any(r['name'].endswith('/fashionai-vton') for r in repositories):
        command('artifacts','repositories','create','fashionai-vton','--repository-format=docker',
                '--location='+region,'--project='+project,'--quiet')
    directory=Path(output)/'images'/image.rsplit(':',1)[-1]
    directory.mkdir(parents=True,exist_ok=True)
    state_file=directory/'build.json'
    state=json.loads(state_file.read_text()) if state_file.exists() else {}
    if state and (state.get('project')!=project or state.get('image')!=image):
        raise RuntimeError('IMAGE_BUILD_STATE_MISMATCH')
    state.update(project=project,image=image)
    save_json(state_file,state)
    build_image(project,region,image,state,state_file,hf_secret)
    result={'executed':True,'status':'IMAGE_BUILD_SUCCEEDED','image':image,'withSam3d':bool(hf_secret),
            'buildId':state['buildId'],'gpuReplicas':0,'gpuInferenceValidated':False}
    save_json(directory/'result.json',result)
    print(json.dumps(result,indent=2),flush=True)
    return result


def remove_replica(cloud,endpoint_name,model):
    current=cloud.request('GET',endpoint_name)
    ours=[m['id'] for m in current.get('deployedModels',[]) if m.get('model')==model]
    for model_id in ours:
        cloud.wait(cloud.request('POST',endpoint_name+':undeployModel',{'deployedModelId':model_id,'trafficSplit':{}}))
    print('Replica GPU removida. Imagem e modelo registrados foram preservados.' if ours else
          'Nenhuma réplica deste instalador estava implantada.',flush=True)
    return ours


def undeploy_ours(cloud,state_file):
    """--undeploy: remove only the replica of the model saved in deployment.json; never another model."""
    if not Path(state_file).is_file():raise RuntimeError('DEPLOYMENT_STATE_NOT_FOUND: rode com o mesmo --output do deploy')
    state=json.loads(Path(state_file).read_text())
    if state.get('project')!=cloud.project:raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    if not state.get('endpoint') or not state.get('model'):raise RuntimeError('NO_SAVED_ENDPOINT_OR_MODEL')
    return remove_replica(cloud,state['endpoint'],state['model'])


def body_measurement_smoke(cloud,endpoint_name,host,person):
    """Medidas do corpo na mesma réplica: só proporções e diagnósticos voltam (a foto não é gravada na GPU)."""
    result=cloud.request('POST',endpoint_name+':predict',{'instances':[{'task':'body_measurement','person_image':person}]},host=host)
    predictions=result.get('predictions',[])
    if len(predictions)!=1:raise RuntimeError('INVALID_GPU_PREDICTION_CONTRACT')
    prediction=predictions[0];diagnostics=prediction.get('diagnostics',{});measurement=prediction.get('measurement',{})
    if prediction.get('status')!='READY' or diagnostics.get('device')!='cuda:0' or diagnostics.get('engine')!='SAM_3D_BODY_DINOV3' \
            or not isinstance(measurement.get('ratios'),dict) or not diagnostics.get('peakCudaBytes'):
        raise RuntimeError('REAL_CUDA_BODY_MEASUREMENT_EVIDENCE_REQUIRED')
    return {'ratios':measurement['ratios'],'refused':measurement.get('refused',{}),'warnings':measurement.get('warnings',[]),
            'diagnostics':diagnostics}


def save_json(path,value):
    path=Path(path);temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=path.parent,
                prefix='.'+path.name+'-',delete=False) as file:
            temporary=Path(file.name);file.write(json.dumps(value,indent=2)+'\n')
        temporary.replace(path)
    finally:
        if temporary is not None:temporary.unlink(missing_ok=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',default=PROJECT);parser.add_argument('--region',default=REGION)
    parser.add_argument('--person',help='Local image of one consenting adult, full body recommended')
    parser.add_argument('--garment',help='Local catalog garment photo')
    parser.add_argument('--category',choices=['tops','bottoms','one-pieces'])
    parser.add_argument('--garment-photo-type',choices=['model','flat-lay'],default='model')
    parser.add_argument('--output',default='work/fashn-gpu-proof')
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--build-only',action='store_true',help='Build/publish the corrected image only; no input photos, Vertex model or GPU deployment')
    parser.add_argument('--keep-deployed',action='store_true',help='Keep the billed T4 replica after the smoke, also when it fails, to retry other photos without a new cold start')
    parser.add_argument('--deploy-only',action='store_true',help='Bring the GPU replica up and keep it (no photos, no smoke test); pairs with --region/--source-image/--accelerator to move regions')
    parser.add_argument('--source-image',help='Reuse an already built image (e.g. from another region\'s deployment.json) instead of building again')
    parser.add_argument('--accelerator',choices=sorted(MACHINE_FOR),default='NVIDIA_TESLA_T4',help='Serving GPU: NVIDIA_TESLA_T4 (default) or NVIDIA_L4')
    parser.add_argument('--machine-type',help='Override the machine type (default: n1-standard-8 for T4, g2-standard-8 for L4)')
    parser.add_argument('--undeploy',action='store_true',help='Only remove this installer\'s replica from the endpoint (reads deployment.json); no build, model or photo needed')
    parser.add_argument('--new-release',action='store_true',help='Archive terminal previous release state and build/register the current code; preserves old cloud resources')
    parser.add_argument('--reregister-model',action='store_true',help='Register the saved image again with corrected immutable startup probes; no rebuild or deletion of the old model')
    parser.add_argument('--diagnose',action='store_true',help='Read saved deployment/operation diagnostics; no cloud mutations')
    parser.add_argument('--retry-failed-deploy',action='store_true',help='Retry a confirmed failed deployment after its cause was corrected')
    parser.add_argument('--resume-build',help='Resume this existing build without submitting another one')
    parser.add_argument('--restart-cancelled-build',action='store_true',help='Start a replacement only if the selected build is confirmed CANCELLED')
    parser.add_argument('--with-sam3d',action='store_true',help='Same container plus SAM 3D Body (Avatar 3D body measurements); the smoke also measures --person, which must show the whole body')
    parser.add_argument('--hf-secret',default=HF_SECRET,help='Secret Manager secret with a Hugging Face read token approved for facebook/sam-3d-body-dinov3 (used with --with-sam3d at build time only)')
    args=parser.parse_args()
    hf_secret=args.hf_secret if args.with_sam3d else None
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',args.project) or not re.fullmatch(r'[a-z]+-[a-z]+[0-9]',args.region):parser.error('Invalid project/region')
    if args.build_only:
        if args.diagnose or args.new_release or args.reregister_model or args.resume_build or args.retry_failed_deploy or args.restart_cancelled_build or args.keep_deployed:
            parser.error('--build-only cannot be combined with deployment/resume options; repeat it to resume its saved build')
        source=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,check=True,capture_output=True,text=True).stdout.strip()
        image=f'{args.region}-docker.pkg.dev/{args.project}/fashionai-vton/fashn:{release_tag(source,args.with_sam3d)}'
        build_only_release(args.project,args.region,image,args.output,args.apply,hf_secret);return
    if args.diagnose:
        diagnose_deployment(args.project,args.region,args.output);return
    if args.undeploy:
        if not args.apply:print(json.dumps({'executed':False,'undeploy':str(Path(args.output)/'deployment.json')},indent=2));return
        undeploy_ours(Cloud(args.project,args.region),Path(args.output)/'deployment.json');return
    if args.reregister_model and (args.new_release or args.resume_build or args.retry_failed_deploy or args.restart_cancelled_build):
        parser.error('--reregister-model reuses the saved image; cannot combine with build/release/retry flags')
    if args.new_release and (args.resume_build or args.retry_failed_deploy):parser.error('--new-release cannot reuse the old build or retry its old model')
    if args.source_image and (args.new_release or args.resume_build or args.reregister_model or args.restart_cancelled_build):
        parser.error('--source-image reuses a built image; cannot combine with build/release/reregister flags')
    if args.source_image and not re.fullmatch(r'[a-z0-9-]+-docker\.pkg\.dev/'+re.escape(args.project)+r'/fashionai-vton/fashn:[0-9a-f]{12}',args.source_image):
        parser.error('--source-image must be an image of this project: REGION-docker.pkg.dev/PROJECT/fashionai-vton/fashn:<12 hex>')
    machine=args.machine_type or MACHINE_FOR[args.accelerator]
    if args.deploy_only:
        person=garment=person_hash=garment_hash=None
    else:
        if not args.person or not args.garment or not args.category:parser.error('--person, --garment and --category are required for inference (or use --deploy-only)')
        person,person_hash=image_payload(args.person);garment,garment_hash=image_payload(args.garment)
    source=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,check=True,capture_output=True,text=True).stdout.strip()
    tag=release_tag(source,args.with_sam3d);image=f'{args.region}-docker.pkg.dev/{args.project}/fashionai-vton/fashn:{tag}'
    if args.source_image:
        # Same image, any region: Vertex pulls it from the project's Artifact Registry; no new Cloud Build.
        image=args.source_image;tag=image.rsplit(':',1)[-1]
    if args.reregister_model:
        saved_file=Path(args.output)/'deployment.json'
        if not saved_file.is_file():parser.error('--reregister-model requires saved deployment.json')
        saved=json.loads(saved_file.read_text())
        image=build_image_reference({'projectId':saved.get('project'),'images':[saved.get('image','')]},args.project,args.region)
        tag=image.rsplit(':',1)[-1]
    plan={'executed':False,'engine':'FASHN_VTON_1_5+SAM_3D_BODY' if args.with_sam3d else 'FASHN_VTON_1_5','project':args.project,'region':args.region,
          'image':None if args.resume_build else image,'resumeBuildId':args.resume_build,'replicas':{'min':1,'max':1},'accelerator':args.accelerator,
          'machineType':machine,'deployOnly':args.deploy_only,'sourceImage':bool(args.source_image),
          'keepDeployed':args.keep_deployed,'newRelease':args.new_release,
          'reregisterModel':args.reregister_model,'physicalFitCertified':False}
    if not args.apply:print(json.dumps(plan,indent=2));return
    # Authentication and project access are checked before any mutation.
    cloud=Cloud(args.project,args.region);endpoints=cloud.endpoints()
    matches=[e for e in endpoints if e.get('displayName')==NAME]
    if len(matches)>1:raise RuntimeError('MULTIPLE_FASHN_ENDPOINTS_REVIEW_REQUIRED')
    for endpoint in endpoints:
        if endpoint.get('deployedModels') and endpoint not in matches:
            raise RuntimeError('OTHER_MODELS_ALREADY_DEPLOYED_CHECK_SHARED_T4_QUOTA')
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    if matches and not matches[0].get('dedicatedEndpointEnabled'):raise RuntimeError('DEDICATED_ENDPOINT_REQUIRED')
    command('services','enable','aiplatform.googleapis.com','artifactregistry.googleapis.com','cloudbuild.googleapis.com','iam.googleapis.com',
            *(['secretmanager.googleapis.com'] if hf_secret else []),'--project='+args.project)
    repositories=json.loads(command('artifacts','repositories','list','--location='+args.region,'--project='+args.project,'--format=json',capture=True))
    if not any(r['name'].endswith('/fashionai-vton') for r in repositories):
        command('artifacts','repositories','create','fashionai-vton','--repository-format=docker','--location='+args.region,'--project='+args.project,'--quiet')
    state_file=output/'deployment.json'
    state=json.loads(state_file.read_text()) if state_file.exists() else {}
    if state and state.get('project')!=args.project:raise RuntimeError('STATE_BELONGS_TO_ANOTHER_PROJECT')
    if args.reregister_model:
        if not matches:raise RuntimeError('PREVIOUS_ENDPOINT_NOT_FOUND')
        state=reregister_model(cloud,state,state_file,matches[0])
        image=state['image'];tag=image.rsplit(':',1)[-1]
    if args.new_release:
        if not matches and state.get('endpoint'):raise RuntimeError('PREVIOUS_ENDPOINT_NOT_FOUND')
        state=start_new_release(cloud,state,state_file,image,matches[0] if matches else {})
    # Reuse an image built separately rather than charging for a duplicate build.
    prepared=output/'images'/tag/'build.json'
    if not args.resume_build and not state.get('buildId') and not state.get('model') and prepared.is_file():
        built=json.loads(prepared.read_text())
        if built.get('project')!=args.project or built.get('image')!=image:
            raise RuntimeError('IMAGE_BUILD_STATE_MISMATCH')
        if built.get('buildId'):state['buildId']=built['buildId']
    resume_id=args.resume_build or state.get('buildId')
    if resume_id:
        build=describe_build(args.project,args.region,resume_id)
        if build.get('status')=='CANCELLED':
            prior_image=build_image_reference(build,args.project,args.region)
            replacement=replacement_build(args.project,args.region,resume_id,prior_image)
            if replacement:
                resume_id=replacement['id'];build=replacement
                print(f'Tentativa já existente encontrada: {resume_id}; nenhum build duplicado será iniciado.',flush=True)
        state,image=adopted_build(state,build,resume_id,args.project,args.region,image,args.restart_cancelled_build)
        tag=image.rsplit(':',1)[-1]
    state=resumed_state(state,args.project,image)
    endpoint=matches[0] if matches else cloud.wait(cloud.request('POST',cloud.parent+'/endpoints',{
        'displayName':NAME,'dedicatedEndpointEnabled':True,'clientConnectionConfig':{'inferenceTimeout':'600s'}}))
    endpoint_name=endpoint['name']
    state.update(project=args.project,image=image,endpoint=endpoint_name);save_json(state_file,state)
    if state.get('deployOperation'):
        # Resume a previous submission instead of creating another deployment.
        resume_deployment(cloud,state,state_file,args.retry_failed_deploy)
        endpoint=cloud.request('GET',endpoint_name)
    deployed=endpoint.get('deployedModels',[])
    if len(deployed)>1:raise RuntimeError('MORE_THAN_ONE_REPLICA_MODEL_NOT_ALLOWED')
    if deployed and deployed[0].get('model')!=state.get('model'):raise RuntimeError('ENDPOINT_CONTAINS_DIFFERENT_MODEL_NO_REPLACEMENT_PERFORMED')
    if not state.get('model'):
        if not args.source_image:build_image(args.project,args.region,image,state,state_file,hf_secret)
        result=cloud.wait(cloud.request('POST',cloud.parent+'/models:upload',{'model':{
            'displayName':'fashionai-fashn-'+tag,'containerSpec':fashn_container_spec(image)}}))
        state['model']=result['model'];save_json(state_file,state)
    gpu_id=deployed[0]['id'] if deployed else None
    smoke_passed=False
    try:
        if not gpu_id:
            operation=cloud.request('POST',endpoint_name+':deployModel',{
                'deployedModel':{'displayName':'fashionai-fashn-'+tag,'model':state['model'],
                    'dedicatedResources':{'machineSpec':{'machineType':machine,'acceleratorType':args.accelerator,'acceleratorCount':1},
                                          'minReplicaCount':1,'maxReplicaCount':1},'disableContainerLogging':False},
                'trafficSplit':{'0':100}})
            # Persist operation BEFORE waiting, so an interrupted shell can be inspected.
            state['deployOperation']=operation['name'];save_json(state_file,state)
            result=cloud.wait(operation);gpu_id=result['deployedModel']['id']
            state['deployedModelId']=gpu_id;save_json(state_file,state)
        endpoint=cloud.request('GET',endpoint_name);host=endpoint.get('dedicatedEndpointDns','')
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.prediction\.vertexai\.goog',host):raise RuntimeError('DEDICATED_DNS_NOT_AVAILABLE')
        if args.deploy_only:
            configuration={'VTON_RENDER_PROVIDER':'vertex_fashn','GOOGLE_CLOUD_PROJECT':args.project,
                'GOOGLE_CLOUD_LOCATION':args.region,'VTON_VERTEX_TRYON_ENDPOINT_ID':endpoint_name.rsplit('/',1)[-1],
                'VTON_VERTEX_TRYON_DEDICATED_HOST':host,'VTON_WORKER_TIMEOUT_SECONDS':'650'}
            save_json(output/'backend-config.json',configuration)
            print(json.dumps({'status':'GPU_DEPLOYED','region':args.region,'accelerator':args.accelerator,'machineType':machine,
                'endpoint':endpoint_name,'deployedModelId':gpu_id,'dedicatedHost':host},indent=2),flush=True)
            return
        payload={'instances':[{'task':'virtual_try_on','person_image':person,'garment_image':garment,
                              'category':args.category,'garment_photo_type':args.garment_photo_type,'num_timesteps':30,'seed':42}]}
        result=cloud.request('POST',endpoint_name+':predict',payload,host=host)
        predictions=result.get('predictions',[])
        if len(predictions)!=1:raise RuntimeError('INVALID_GPU_PREDICTION_CONTRACT')
        prediction=predictions[0];diagnostics=prediction.get('diagnostics',{})
        if prediction.get('status')!='READY' or diagnostics.get('device')!='cuda:0' or not diagnostics.get('peakCudaBytes') or not diagnostics.get('qualityScreen'):
            raise RuntimeError('REAL_CUDA_AND_POSE_SCREEN_EVIDENCE_REQUIRED')
        png=base64.b64decode(prediction.get('image_png',''),validate=True)
        if not png.startswith(b'\x89PNG\r\n\x1a\n'):raise RuntimeError('INVALID_GPU_OUTPUT_PNG')
        (output/'try-on-gpu.png').write_bytes(png)
        evidence={'status':'GPU_SMOKE_PASSED','installerCommit':source,
            'containerSourceCommitPrefix':tag,'containerImage':image,'withSam3d':args.with_sam3d,
            'personSha256':person_hash,'garmentSha256':garment_hash,'outputSha256':hashlib.sha256(png).hexdigest(),
            'diagnostics':diagnostics,'model':state['model'],'endpoint':endpoint_name}
        save_json(output/'evidence.json',evidence)
        if args.with_sam3d:
            # Saved after the try-on evidence, so a photo without the feet does not lose the render proof.
            evidence['bodyMeasurement']=body_measurement_smoke(cloud,endpoint_name,host,person)
            save_json(output/'evidence.json',evidence)
        configuration={'VTON_RENDER_PROVIDER':'vertex_fashn','GOOGLE_CLOUD_PROJECT':args.project,
            'GOOGLE_CLOUD_LOCATION':args.region,'VTON_VERTEX_TRYON_ENDPOINT_ID':endpoint_name.rsplit('/',1)[-1],
            'VTON_VERTEX_TRYON_DEDICATED_HOST':host,'VTON_WORKER_TIMEOUT_SECONDS':'650'}
        save_json(output/'backend-config.json',configuration)
        smoke_passed=True
        print('GPU_SMOKE_PASSED: '+str(output/'try-on-gpu.png'),flush=True)
    finally:
        if not args.keep_deployed and not args.deploy_only:
            # Undeploy even if smoke failed. Never delete another model.
            remove_replica(cloud,endpoint_name,state['model'])
        elif not gpu_id:
            # The local wait stopped but Google keeps deploying; billing starts once the GPU node exists.
            print(f'ATENÇÃO: o deploy da réplica {args.accelerator} continua no Google Cloud. Para acompanhar: rode o mesmo comando; '
                  f'para ver a etapa: python3 scripts/cloud/deploy_fashn_vertex.py --diagnose --region {args.region} --output {args.output}',flush=True)
        else:
            # Kept on purpose (also after a failed smoke): the next run with --keep-deployed reuses this replica and
            # sends only the new photos, without another 15–20 min GPU cold start.
            print(f'ATENÇÃO: a réplica {args.accelerator} permanece ativa e faturável. Para remover: '
                  f'python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --undeploy --region {args.region} --output {args.output}',flush=True)

if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:
        print('\nEspera local interrompida. Confira deployment.json e retome o mesmo build; nenhum novo build foi iniciado por esta interrupção.',file=sys.stderr)
        sys.exit(130)
