#!/usr/bin/env python3
"""Produce reviewable Vertex GPU commands. Never creates resources itself."""
import argparse
import json
import re
import shlex


def deployment_plan(project, region, endpoint, model, service_account):
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]', project):
        raise ValueError('Invalid Google Cloud project ID')
    if not re.fullmatch(r'[a-z]+-[a-z]+[0-9]', region):
        raise ValueError('Invalid Google Cloud region')
    if not re.fullmatch(r'[0-9]{1,30}', endpoint) or not re.fullmatch(r'[0-9]{1,30}', model):
        raise ValueError('Existing numeric Vertex endpoint and model IDs are required')
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,28}[a-z0-9]@'+re.escape(project)+r'\.iam\.gserviceaccount\.com', service_account):
        raise ValueError('A dedicated runtime service account in this project is required')
    common=['--project='+project, '--region='+region]
    return {
        'executed': False, 'provider': 'Vertex AI custom prediction',
        'gpu': '1 NVIDIA Tesla T4', 'machine': 'n1-standard-8',
        'replicas': {'min': 1, 'max': 1},
        'warning': 'Deployment starts billed GPU capacity. Region quota and model VRAM must be verified; 16 GB may be insufficient for reconstruction or video models.',
        'commands': [
            shlex.join(['gcloud','ai','models','describe',model,*common]),
            shlex.join(['gcloud','ai','endpoints','describe',endpoint,*common]),
            shlex.join(['gcloud','ai','endpoints','deploy-model',endpoint,*common,
                '--model='+model,'--display-name=fashionai-vton-gpu',
                '--machine-type=n1-standard-8','--accelerator=type=nvidia-tesla-t4,count=1',
                '--min-replica-count=1','--max-replica-count=1',
                '--service-account='+service_account,'--traffic-split=0=100']),
        ],
    }


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('project','region','endpoint','model','service-account'):
        parser.add_argument('--'+key,required=True)
    args=parser.parse_args()
    print(json.dumps(deployment_plan(args.project,args.region,args.endpoint,args.model,args.service_account),indent=2))
