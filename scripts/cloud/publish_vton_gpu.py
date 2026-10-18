#!/usr/bin/env python3
"""Stage verified artifacts and produce a Cloud Shell publication plan.

No cloud command is executed without --apply. A real model bundle is mandatory,
including in plan mode: empty endpoints are not a deployable model.
"""
import argparse
import json
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from services.anatomical_vton.vertex_runtime.bundle import validate_bundle,contained_file
from scripts.cloud.plan_vton_gpu import deployment_plan

PROJECT='project-14023673-32d6-4bf2-8b7'
REGION='southamerica-east1'
ENDPOINT='481863169896087552'


def stage_context(bundle,destination):
    source,manifest=validate_bundle(bundle);destination=Path(destination)
    target=destination/'services'/'anatomical_vton'
    shutil.copytree(ROOT/'services'/'anatomical_vton',target,
                    ignore=shutil.ignore_patterns('__pycache__','*.pyc','tests','deploy'))
    weights=destination/'model-bundle';weights.mkdir()
    names={'manifest.json',manifest.garment.file,manifest.body.file,manifest.calibration_report}
    for name in names:
        path=weights/name;path.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(contained_file(source,name),path)
    shutil.copyfile(ROOT/'services/anatomical_vton/deploy/google-cloud/Dockerfile.gpu',destination/'Dockerfile')
    validate_bundle(weights)
    return manifest


def registration_command(image,project=PROJECT,region=REGION):
    return ['gcloud','ai','models','upload','--project='+project,'--region='+region,
            '--display-name=fashionai-anatomy-shared-gpu','--container-image-uri='+image,
            '--container-health-route=/health','--container-predict-route=/predict',
            '--container-ports=8080','--container-shared-memory-size-mb=1024',
            '--format=value(name)','--quiet']


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',required=True)
    parser.add_argument('--tag',required=True,help='Immutable release label, e.g. anatomy-v1-<commit>')
    parser.add_argument('--project',default=PROJECT);parser.add_argument('--region',default=REGION)
    parser.add_argument('--endpoint',default=ENDPOINT)
    parser.add_argument('--apply',action='store_true',help='Build and register the model; GPU deploy remains a separate command')
    args=parser.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{0,100}',args.tag):parser.error('Invalid release tag')
    # Reuse strict project/region/endpoint validation; no shell interpolation.
    service_account='fashionai-vton-runtime@'+args.project+'.iam.gserviceaccount.com'
    deployment_plan(args.project,args.region,args.endpoint,'1',service_account)
    _,manifest=validate_bundle(args.bundle)
    image=f'{args.region}-docker.pkg.dev/{args.project}/fashionai-vton/anatomy:{args.tag}'
    commands=[
        ['gcloud','services','enable','cloudbuild.googleapis.com','artifactregistry.googleapis.com','--project='+args.project],
        ['gcloud','artifacts','repositories','create','fashionai-vton','--repository-format=docker','--location='+args.region,'--project='+args.project],
        ['gcloud','builds','submit','STAGED_CONTEXT','--tag='+image,'--project='+args.project],
        registration_command(image,args.project,args.region),
    ]
    if not args.apply:
        print(json.dumps({'executed':False,'modelVersion':manifest.model_version,'image':image,
                          'gpuDeploymentExecuted':False,'commands':[shlex.join(c) for c in commands]},indent=2));return
    if not shutil.which('gcloud'):parser.error('Run this command in authenticated Google Cloud Shell')
    # --apply builds/registers only. It never silently starts billed GPU replicas.
    subprocess.run(commands[0],check=True)
    exists=subprocess.run(['gcloud','artifacts','repositories','list','--location='+args.region,
        '--project='+args.project,'--filter=name=projects/'+args.project+'/locations/'+args.region+'/repositories/fashionai-vton','--format=value(name)'],check=True,capture_output=True,text=True).stdout.strip()
    if not exists:subprocess.run(commands[1],check=True)
    with tempfile.TemporaryDirectory(prefix='fashionai-build-') as context:
        stage_context(args.bundle,context)
        command=commands[2].copy();command[3]=context
        subprocess.run(command,check=True)
    model=subprocess.run(commands[3],check=True,capture_output=True,text=True).stdout.strip().rsplit('/',1)[-1]
    if not re.fullmatch(r'[0-9]{1,30}',model):raise RuntimeError('MODEL_REGISTRATION_ID_NOT_RETURNED')
    plan=deployment_plan(args.project,args.region,args.endpoint,model,service_account)
    print(json.dumps({'modelId':model,'image':image,'gpuDeploymentExecuted':False,
                      'nextStep':'Review model and service-account permissions, then GPU smoke test and deploy plan.',
                      'deploymentPlan':plan},indent=2))

if __name__=='__main__':main()
