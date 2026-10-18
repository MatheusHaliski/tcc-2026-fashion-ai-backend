"""SAM 3D Body for the shared T4: pinned code checkout and gated weights fetched at image build time.

The Hugging Face token comes from the BuildKit secret (/run/secrets/hf_token, mounted only for that RUN) or HF_TOKEN.
It is passed in memory to huggingface_hub and is never printed, logged or written. Every file is checked against the
size/hash Hugging Face publishes for the resolved commit; the commit and SHA-256 of each file are written to
manifest.json next to the weights, and the server checks them again before serving. Once "revision" and "sha256"
are filled in sam3d_assets.json, the build accepts exactly those and nothing else.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from .fashn_download import artifact_path
from .models import AlignmentError

ASSETS=Path(__file__).with_name('sam3d_assets.json')
DEFAULT_WEIGHTS_DIR='/opt/fashionai/weights/sam3d'
DEFAULT_CODE_DIR='/opt/fashionai/src'
MANIFEST='manifest.json'
TOKEN_FILE=Path('/run/secrets/hf_token')


def assets():return json.loads(ASSETS.read_text())


def read_token(token_file=TOKEN_FILE):
    try:token=token_file.read_text().strip() if token_file.is_file() else ''
    except OSError:token=''
    token=token or os.getenv('HF_TOKEN','').strip()
    if not token:raise AlignmentError('HF_TOKEN_REQUIRED_FOR_GATED_SAM3D_WEIGHTS')
    return token


def file_digest(path,algorithm='sha256',prefix=b''):
    digest=hashlib.new(algorithm,prefix)
    with path.open('rb') as file:
        for data in iter(lambda:file.read(1024*1024),b''):digest.update(data)
    return digest.hexdigest()


def published_check(path,sibling):
    """Size and hash published by Hugging Face: LFS files carry SHA-256, small files the git blob SHA-1."""
    size=path.stat().st_size
    if getattr(sibling,'size',None) is not None and size!=sibling.size:return False
    lfs=getattr(sibling,'lfs',None)
    lfs_sha=getattr(lfs,'sha256',None) or (lfs.get('sha256') if isinstance(lfs,dict) else None)
    if lfs_sha:return file_digest(path)==lfs_sha
    blob=getattr(sibling,'blob_id',None)
    return bool(blob) and file_digest(path,'sha1',b'blob %d\0'%size)==blob


def download(output,api=None,fetch=None,token_file=TOKEN_FILE):
    spec=assets();token=read_token(token_file)
    if api is None or fetch is None:
        from huggingface_hub import HfApi,hf_hub_download
        api=api or HfApi();fetch=fetch or hf_hub_download
    info=api.model_info(spec['repo'],revision=spec['revision'] or 'main',files_metadata=True,token=token)
    revision=getattr(info,'sha',None)
    if not re.fullmatch(r'[0-9a-f]{40}',revision or ''):raise AlignmentError('SAM3D_REVISION_NOT_RESOLVED')
    if spec['revision'] and revision!=spec['revision']:raise AlignmentError('SAM3D_REVISION_MISMATCH')
    root=Path(output).resolve();root.mkdir(parents=True,exist_ok=True)
    siblings={s.rfilename:s for s in (getattr(info,'siblings',None) or [])}
    files=[]
    for entry in spec['files']:
        name=entry['path'];path=artifact_path(root,name)
        if name not in siblings:raise AlignmentError('SAM3D_FILE_NOT_IN_REPOSITORY:'+name)
        # Download from the resolved commit, never a moving branch.
        if Path(fetch(spec['repo'],name,revision=revision,token=token,local_dir=str(root))).resolve()!=path:
            raise AlignmentError('SAM3D_DOWNLOAD_PATH_MISMATCH:'+name)
        if not published_check(path,siblings[name]):raise AlignmentError('SAM3D_PUBLISHED_HASH_MISMATCH:'+name)
        digest=file_digest(path)
        if entry.get('sha256') and digest!=entry['sha256']:raise AlignmentError('SAM3D_PINNED_SHA256_MISMATCH:'+name)
        path.chmod(0o444)
        files.append({'path':name,'size':path.stat().st_size,'sha256':digest})
    shutil.rmtree(root/'.cache',ignore_errors=True)
    manifest={'model_version':spec['model_version'],'repo':spec['repo'],'revision':revision,'files':files}
    (root/MANIFEST).write_text(json.dumps(manifest,indent=2)+'\n');(root/MANIFEST).chmod(0o444)
    return manifest


def verify_assets(root):
    """Startup check: every weight matches the build manifest, and the repository pins when they are filled."""
    spec=assets();root=Path(root).resolve()
    try:manifest=json.loads((root/MANIFEST).read_text())
    except (OSError,ValueError) as error:raise AlignmentError('SAM3D_MANIFEST_MISSING') from error
    if manifest.get('repo')!=spec['repo'] or manifest.get('model_version')!=spec['model_version']:raise AlignmentError('SAM3D_MANIFEST_MISMATCH')
    if spec['revision'] and manifest.get('revision')!=spec['revision']:raise AlignmentError('SAM3D_REVISION_MISMATCH')
    built={entry.get('path'):entry for entry in manifest.get('files',[])}
    for entry in spec['files']:
        name=entry['path'];path=artifact_path(root,name);recorded=built.get(name)
        try:
            if recorded is None or not path.is_file():raise AlignmentError('SAM3D_WEIGHT_MISSING:'+name)
            if path.stat().st_size!=recorded['size']:raise AlignmentError('SAM3D_WEIGHT_SIZE_MISMATCH:'+name)
            digest=file_digest(path)
            if digest!=recorded['sha256'] or (entry.get('sha256') and digest!=entry['sha256']):
                raise AlignmentError('SAM3D_WEIGHT_SHA256_MISMATCH:'+name)
        except OSError as error:
            raise AlignmentError('SAM3D_WEIGHT_UNREADABLE:'+name) from error
    return manifest


def checkout_code(destination):
    """Exact commits from sam3d_assets.json; .git is removed after the commit is confirmed."""
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    for name,source in assets()['code'].items():
        target=destination/name
        if target.exists():raise AlignmentError('SAM3D_CODE_ALREADY_PRESENT:'+name)
        git=lambda *args:subprocess.run(['git','-C',str(target),*args],check=True,capture_output=True,text=True).stdout.strip()
        subprocess.run(['git','init','-q',str(target)],check=True)
        git('fetch','-q','--depth','1',source['url'],source['commit']);git('checkout','-q','--detach','FETCH_HEAD')
        if git('rev-parse','HEAD')!=source['commit']:raise AlignmentError('SAM3D_CODE_COMMIT_MISMATCH:'+name)
        shutil.rmtree(target/'.git')
        print(json.dumps({'code':name,'commit':source['commit'],'status':'VERIFIED'}),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default=DEFAULT_WEIGHTS_DIR)
    parser.add_argument('--verify-only',action='store_true')
    parser.add_argument('--checkout-code',metavar='DIR',help='Clone the pinned sam-3d-body and dinov3 commits into DIR')
    args=parser.parse_args()
    if args.checkout_code:checkout_code(args.checkout_code);return
    manifest=verify_assets(args.output) if args.verify_only else download(args.output)
    # Public metadata only: commit and hashes, so the next build can pin them in sam3d_assets.json.
    print(json.dumps({'status':'SAM3D_WEIGHTS_VERIFIED',**manifest}),flush=True)

if __name__=='__main__':main()
