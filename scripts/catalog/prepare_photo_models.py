"""Provision immutable public CPU segmentation weights, then optionally exec the worker.

Only model bytes are downloaded. Source photographs never leave this worker.
All files must match the pinned size and SHA-256 before any database job starts.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import urllib.request

PARSER_REVISION = '1f80c34dbab321c5730dda5c3fea279fd3e97498'
PARSER_BASE = 'https://huggingface.co/fashn-ai/fashn-human-parser/resolve/'+PARSER_REVISION+'/'
MODELS = [
    ('parser/model.safetensors',PARSER_BASE+'model.safetensors',256146352,'e43c8c8a9b04f28798f0a4630cf18caa2cdb27a0d454fae43a5716e6f7078244'),
    ('parser/config.json',PARSER_BASE+'config.json',1654,'87bd5b66419dbfa7c02cfbeb94e292454863b1606c5df29526b19a6c1de70d9f'),
    ('parser/preprocessor_config.json',PARSER_BASE+'preprocessor_config.json',340,'54007eb4cedae02565c4f035750aeebe3ddc53d36ab575e8534615623e6b6225'),
    ('u2net/models/u2net_cloth_seg/u2net_cloth_seg.onnx','https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_cloth_seg.onnx',176194565,'6d2cbc27bfbdc989e1fd325656d65902ecc6a3ccbe94b2d3655ec114efcb128e'),
]


def verified(path, size, sha):
    if not path.is_file() or path.stat().st_size != size:
        return False
    digest=hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
    return digest.hexdigest()==sha


def prepare(cache, *, download=False):
    root=Path(cache).resolve();rows=[]
    for relative,url,size,sha in MODELS:
        path=root/relative
        if not verified(path,size,sha):
            if not download:
                raise ValueError('CATALOG_MODEL_MISSING_OR_HASH_MISMATCH:'+relative)
            path.parent.mkdir(parents=True,exist_ok=True)
            temporary=None
            try:
                with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as target:
                    temporary=Path(target.name);received=0
                    with urllib.request.urlopen(url,timeout=60) as response:
                        while block:=response.read(1024*1024):
                            received+=len(block)
                            if received>size:raise ValueError('CATALOG_MODEL_OVERSIZE:'+relative)
                            target.write(block)
                if not verified(temporary,size,sha):raise ValueError('CATALOG_MODEL_HASH_MISMATCH:'+relative)
                temporary.chmod(0o644);temporary.replace(path)
            finally:
                if temporary is not None:temporary.unlink(missing_ok=True)
        rows.append({'path':relative,'bytes':size,'sha256':sha,'verified':True})
    return {'version':'CATALOG_SEGMENTATION_WEIGHTS_V1','cache':str(root),'models':rows}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir',type=Path,default=Path(os.getenv('CATALOG_PHOTO_MODEL_CACHE','/home/worker/.cache/fashionai/catalog')))
    parser.add_argument('--download',action='store_true')
    parser.add_argument('--exec',dest='command',nargs=argparse.REMAINDER)
    args=parser.parse_args(argv)
    evidence=prepare(args.cache_dir,download=args.download)
    print(json.dumps(evidence),flush=True)
    if args.command:
        os.environ['CATALOG_PHOTO_PARSER_WEIGHTS']=str(args.cache_dir.resolve()/'parser')
        os.environ['U2NET_HOME']=str(args.cache_dir.resolve()/'u2net')
        os.execvp(args.command[0],args.command)
    return 0

if __name__=='__main__':raise SystemExit(main())
