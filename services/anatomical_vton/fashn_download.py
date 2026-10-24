"""Download public native weights at immutable revisions, verifying size and SHA-256."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import tempfile
import urllib.request
from .models import AlignmentError

MANIFEST=Path(__file__).with_name('fashn_assets.json')
DEFAULT_WEIGHTS_DIR='/opt/fashionai/weights/fashn'


def assets():return json.loads(MANIFEST.read_text())


def artifact_path(root,name):
    root=Path(root).resolve();path=(root/name).resolve()
    if not path.is_relative_to(root):raise AlignmentError('FASHN_ASSET_PATH_OUTSIDE_ROOT')
    return path


def verify_file(path,entry):
    if not path.is_file() or path.stat().st_size!=entry['size']:return False
    digest=hashlib.sha256()
    with path.open('rb') as file:
        for data in iter(lambda:file.read(1024*1024),b''):digest.update(data)
    return digest.hexdigest()==entry['sha256']


def verify_assets(root):
    for entry in assets()['files']:
        path=artifact_path(root,entry['path'])
        # These are public model assets, never personal photographs or tokens.
        name=entry['path']
        try:
            if not path.is_file():raise AlignmentError('FASHN_WEIGHT_MISSING:'+name)
            if path.stat().st_size!=entry['size']:raise AlignmentError('FASHN_WEIGHT_SIZE_MISMATCH:'+name)
            if not verify_file(path,entry):raise AlignmentError('FASHN_WEIGHT_SHA256_MISMATCH:'+name)
        except OSError as error:
            raise AlignmentError('FASHN_WEIGHT_UNREADABLE:'+name) from error


def download_file(root,entry):
    path=artifact_path(root,entry['path']);path.parent.mkdir(parents=True,exist_ok=True)
    if verify_file(path,entry):
        path.chmod(0o444)
        return {'file':entry['path'],'status':'CACHED'}
    url=f"https://huggingface.co/{entry['repo']}/resolve/{entry['revision']}/{entry['filename']}"
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as out:
            temporary=Path(out.name)
            with urllib.request.urlopen(url,timeout=120) as response:
                total=0
                for chunk in iter(lambda:response.read(1024*1024),b''):
                    total+=len(chunk)
                    if total>entry['size']:raise AlignmentError('FASHN_ASSET_SIZE_MISMATCH')
                    out.write(chunk)
        if not verify_file(temporary,entry):raise AlignmentError('FASHN_ASSET_CHECKSUM_MISMATCH')
        # NamedTemporaryFile starts with mode 0600. The builder and inference
        # UIDs differ: publish verified public weights as read-only for both.
        temporary.chmod(0o444)
        os.replace(temporary,path)
        return {'file':entry['path'],'status':'VERIFIED','bytes':entry['size']}
    finally:
        if temporary is not None:temporary.unlink(missing_ok=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True)
    parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
    if args.verify_only:verify_assets(args.output)
    else:
        with ThreadPoolExecutor(max_workers=3) as executor:
            for result in executor.map(lambda entry:download_file(args.output,entry),assets()['files']):print(json.dumps(result),flush=True)
        verify_assets(args.output)
    print(json.dumps({'status':'WEIGHTS_VERIFIED','modelVersion':assets()['model_version']}),flush=True)

if __name__=='__main__':main()
