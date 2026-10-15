"""Validate artifacts without deploying resources. --gpu also loads/warms CUDA models."""
import argparse
import json
from .bundle import validate_bundle, SharedGpuBundle


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle');parser.add_argument('--gpu',action='store_true')
    args=parser.parse_args()
    _,manifest=validate_bundle(args.bundle)
    if args.gpu:SharedGpuBundle(args.bundle)
    print(json.dumps({'status':'ARTIFACTS_VERIFIED','modelVersion':manifest.model_version,
                      'cudaModelLoaded':args.gpu,'physicalFitCertified':False}))

if __name__=='__main__':main()
