#!/usr/bin/env python3
"""Build/deploy ONE native FASHN T4 and run a real-image CUDA smoke test.

Run in authenticated Cloud Shell. No credentials are written or printed.
Without --apply, only a local plan is emitted. By default the smoke deployment
is undeployed afterwards; --keep-deployed retains a billed serving replica.
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


def command(*args,capture=False):
    result=subprocess.run(['gcloud',*args],check=True,text=True,
                          stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


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
            # API errors may echo inputs. Do not print raw response.
            raise RuntimeError(f'GOOGLE_CLOUD_HTTP_{error.code}: {method} {path.split(":")[0]}') from None

    def wait(self,operation,seconds=2400):
        deadline=time.monotonic()+seconds
        while not operation.get('done'):
            if time.monotonic()>deadline:raise RuntimeError('CLOUD_OPERATION_TIMEOUT_CHECK_CONSOLE')
            print('Aguardando operação do Google Cloud...',flush=True)
            time.sleep(20)
            operation=self.request('GET',operation['name'])
        if operation.get('error'):raise RuntimeError('CLOUD_OPERATION_FAILED: '+str(operation['error'].get('code')))
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
    image=build_image_reference(build,project,region)
    if state.get('image') not in (None,image):raise RuntimeError('STATE_AND_RESUMED_BUILD_IMAGE_MISMATCH')
    if restart_cancelled and build.get('status')=='CANCELLED':
        if state.get('model') or state.get('deployOperation'):
            raise RuntimeError('CANNOT_RESTART_BUILD_WITH_REGISTERED_OR_DEPLOYING_MODEL')
        print(f'Build {build_id} confirmado CANCELLED; preparando nova compilação.',flush=True)
        result={**state};result.pop('buildId',None)
        return result,current_image
    return {**state,'buildId':build_id},image


def wait_build(project,region,build_id,image):
    deadline=time.monotonic()+3000
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


def build_image(project,region,image,state,state_file):
    build_id=state.get('buildId')
    if not build_id:
        service_account,staging=prepare_build_identity(project,region)
        with tempfile.TemporaryDirectory(prefix='fashionai-cloud-build-') as directory:
            stage_context(directory)
            config={'steps':[{'name':'gcr.io/cloud-builders/docker','env':['DOCKER_BUILDKIT=1'],
                              'args':['build','-t',image,'.']}],
                    'images':[image],'timeout':'2400s','serviceAccount':service_account,
                    'options':{'machineType':'E2_HIGHCPU_8','diskSizeGb':100,'logging':'CLOUD_LOGGING_ONLY'}}
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
    return wait_build(project,region,build_id,image)


def image_payload(path):
    data=Path(path).read_bytes()
    if not data or len(data)>3_000_000:raise ValueError('SMOKE_IMAGE_MUST_BE_1_BYTE_TO_3_MB')
    return base64.b64encode(data).decode(),hashlib.sha256(data).hexdigest()


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
    parser.add_argument('--person',required=True,help='Local image of one consenting adult, full body recommended')
    parser.add_argument('--garment',required=True,help='Local catalog garment photo')
    parser.add_argument('--category',choices=['tops','bottoms','one-pieces'],required=True)
    parser.add_argument('--garment-photo-type',choices=['model','flat-lay'],default='model')
    parser.add_argument('--output',default='work/fashn-gpu-proof')
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--keep-deployed',action='store_true')
    parser.add_argument('--resume-build',help='Resume this existing build without submitting another one')
    parser.add_argument('--restart-cancelled-build',action='store_true',help='Start a replacement only if the selected build is confirmed CANCELLED')
    args=parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',args.project) or not re.fullmatch(r'[a-z]+-[a-z]+[0-9]',args.region):parser.error('Invalid project/region')
    person,person_hash=image_payload(args.person);garment,garment_hash=image_payload(args.garment)
    source=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,check=True,capture_output=True,text=True).stdout.strip()
    tag=source[:12];image=f'{args.region}-docker.pkg.dev/{args.project}/fashionai-vton/fashn:{tag}'
    plan={'executed':False,'engine':'FASHN_VTON_1_5','project':args.project,'region':args.region,
          'image':None if args.resume_build else image,'resumeBuildId':args.resume_build,'replicas':{'min':1,'max':1},'accelerator':'NVIDIA_TESLA_T4',
          'keepDeployed':args.keep_deployed,'physicalFitCertified':False}
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
    command('services','enable','aiplatform.googleapis.com','artifactregistry.googleapis.com','cloudbuild.googleapis.com','iam.googleapis.com','--project='+args.project)
    repositories=json.loads(command('artifacts','repositories','list','--location='+args.region,'--project='+args.project,'--format=json',capture=True))
    if not any(r['name'].endswith('/fashionai-vton') for r in repositories):
        command('artifacts','repositories','create','fashionai-vton','--repository-format=docker','--location='+args.region,'--project='+args.project,'--quiet')
    state_file=output/'deployment.json'
    state=json.loads(state_file.read_text()) if state_file.exists() else {}
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
        previous=cloud.request('GET',state['deployOperation'])
        if not previous.get('done'):cloud.wait(previous)
        endpoint=cloud.request('GET',endpoint_name)
    deployed=endpoint.get('deployedModels',[])
    if len(deployed)>1:raise RuntimeError('MORE_THAN_ONE_REPLICA_MODEL_NOT_ALLOWED')
    if deployed and deployed[0].get('model')!=state.get('model'):raise RuntimeError('ENDPOINT_CONTAINS_DIFFERENT_MODEL_NO_REPLACEMENT_PERFORMED')
    if not state.get('model'):
        build_image(args.project,args.region,image,state,state_file)
        result=cloud.wait(cloud.request('POST',cloud.parent+'/models:upload',{'model':{
            'displayName':'fashionai-fashn-'+tag,'containerSpec':{'imageUri':image,'ports':[{'containerPort':8080}],
            'healthRoute':'/health','predictRoute':'/predict','sharedMemorySizeMb':'1024',
            'startupProbe':{'exec':{'command':['python','-c','import urllib.request; urllib.request.urlopen("http://localhost:8080/health")']},'periodSeconds':30,'timeoutSeconds':10}}}}))
        state['model']=result['model'];save_json(state_file,state)
    gpu_id=deployed[0]['id'] if deployed else None
    smoke_passed=False
    try:
        if not gpu_id:
            operation=cloud.request('POST',endpoint_name+':deployModel',{
                'deployedModel':{'displayName':'fashionai-fashn-'+tag,'model':state['model'],
                    'dedicatedResources':{'machineSpec':{'machineType':'n1-standard-8','acceleratorType':'NVIDIA_TESLA_T4','acceleratorCount':1},
                                          'minReplicaCount':1,'maxReplicaCount':1},'disableContainerLogging':False},
                'trafficSplit':{'0':100}})
            # Persist operation BEFORE waiting, so an interrupted shell can be inspected.
            state['deployOperation']=operation['name'];save_json(state_file,state)
            result=cloud.wait(operation);gpu_id=result['deployedModel']['id']
            state['deployedModelId']=gpu_id;save_json(state_file,state)
        endpoint=cloud.request('GET',endpoint_name);host=endpoint.get('dedicatedEndpointDns','')
        if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.prediction\.vertexai\.goog',host):raise RuntimeError('DEDICATED_DNS_NOT_AVAILABLE')
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
        save_json(output/'evidence.json',{'status':'GPU_SMOKE_PASSED','installerCommit':source,
            'containerSourceCommitPrefix':tag,'containerImage':image,
            'personSha256':person_hash,'garmentSha256':garment_hash,'outputSha256':hashlib.sha256(png).hexdigest(),
            'diagnostics':diagnostics,'model':state['model'],'endpoint':endpoint_name})
        configuration={'VTON_RENDER_PROVIDER':'vertex_fashn','GOOGLE_CLOUD_PROJECT':args.project,
            'GOOGLE_CLOUD_LOCATION':args.region,'VTON_VERTEX_TRYON_ENDPOINT_ID':endpoint_name.rsplit('/',1)[-1],
            'VTON_VERTEX_TRYON_DEDICATED_HOST':host,'VTON_WORKER_TIMEOUT_SECONDS':'650'}
        save_json(output/'backend-config.json',configuration)
        smoke_passed=True
        print('GPU_SMOKE_PASSED: '+str(output/'try-on-gpu.png'),flush=True)
    finally:
        if not args.keep_deployed or not smoke_passed:
            # Undeploy even if smoke failed. Never delete another model.
            current=cloud.request('GET',endpoint_name)
            ours=[m['id'] for m in current.get('deployedModels',[]) if m.get('model')==state['model']]
            for model_id in ours:
                cloud.wait(cloud.request('POST',endpoint_name+':undeployModel',{'deployedModelId':model_id,'trafficSplit':{}}))
            print('Replica GPU removida. Imagem e modelo registrados foram preservados.',flush=True)
        else:
            print('ATENÇÃO: uma réplica T4 permanece ativa e faturável.',flush=True)

if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:
        print('\nEspera local interrompida. Confira deployment.json e retome o mesmo build; nenhum novo build foi iniciado por esta interrupção.',file=sys.stderr)
        sys.exit(130)
