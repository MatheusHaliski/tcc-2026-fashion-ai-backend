"""Retrato estilizado do Avatar (SDXL + InstantID): pesos e código baixados no build da imagem, todos fixados.

Nada aqui pede token: os três repositórios do Hugging Face são públicos, o pacote de rosto vem do release oficial da
InsightFace no GitHub e o código do InstantID vem de um commit fixo. Cada arquivo é conferido contra o tamanho e o
SHA-256 (ou o blob git, nos arquivos pequenos) gravados em portrait_assets.json; qualquer diferença derruba o build.
O manifesto com os hashes fica ao lado dos pesos e o servidor confere de novo antes de carregar o modelo.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from .fashn_download import artifact_path
from .models import AlignmentError
from .sam3d_download import file_digest

ASSETS=Path(__file__).with_name('portrait_assets.json')
DEFAULT_WEIGHTS_DIR='/opt/fashionai/weights/portrait'
DEFAULT_CODE_DIR='/opt/fashionai/src/instantid'
MANIFEST='manifest.json'
FACE_DIR='antelopev2'


def assets():return json.loads(ASSETS.read_text())


def matches(path,entry):
    """Tamanho e hash fixados: SHA-256 nos arquivos LFS, blob git (SHA-1) nos pequenos."""
    size=path.stat().st_size
    if entry.get('size') is not None and size!=entry['size']:return False
    if entry.get('sha256'):return file_digest(path)==entry['sha256']
    blob=entry.get('blob_id')
    return bool(blob) and file_digest(path,'sha1',b'blob %d\0'%size)==blob


def expected_files(spec=None):
    """(caminho relativo, entrada fixada) de cada peso, na pasta da imagem."""
    spec=spec or assets()
    for key,repo in spec['repos'].items():
        for entry in repo['files']:yield f"{key}/{entry['path']}",entry
    for name in spec['face']['members'].values():yield f'{FACE_DIR}/{name}',None


def fetch_url(url,destination):
    with urllib.request.urlopen(url,timeout=120) as response,open(destination,'wb') as out:
        shutil.copyfileobj(response,out,length=1024*1024)


def download(output,fetch=None,fetch_url=fetch_url):
    spec=assets();root=Path(output).resolve();root.mkdir(parents=True,exist_ok=True)
    if fetch is None:
        from huggingface_hub import hf_hub_download
        fetch=hf_hub_download
    files=[]
    for key,repo in spec['repos'].items():
        if not repo.get('revision'):raise AlignmentError('PORTRAIT_REVISION_NOT_PINNED:'+key)
        for entry in repo['files']:
            path=artifact_path(root/key,entry['path'])
            # Do commit fixado, nunca de um branch que anda.
            if Path(fetch(repo['repo'],entry['path'],revision=repo['revision'],local_dir=str(root/key))).resolve()!=path:
                raise AlignmentError('PORTRAIT_DOWNLOAD_PATH_MISMATCH:'+entry['path'])
            if not matches(path,entry):raise AlignmentError('PORTRAIT_PINNED_HASH_MISMATCH:'+key+'/'+entry['path'])
            path.chmod(0o444)
            files.append({'path':f"{key}/{entry['path']}",'size':path.stat().st_size,'sha256':file_digest(path)})
        shutil.rmtree(root/key/'.cache',ignore_errors=True)
    face=spec['face'];target=root/FACE_DIR;target.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as scratch:
        archive=Path(scratch)/'face.zip';fetch_url(face['url'],archive)
        if archive.stat().st_size!=face['size'] or file_digest(archive)!=face['sha256']:raise AlignmentError('PORTRAIT_FACE_ARCHIVE_HASH_MISMATCH')
        with zipfile.ZipFile(archive) as bundle:
            for member,name in face['members'].items():
                path=target/name
                with bundle.open(member) as source,open(path,'wb') as out:shutil.copyfileobj(source,out,length=1024*1024)
                path.chmod(0o444)
                files.append({'path':f'{FACE_DIR}/{name}','size':path.stat().st_size,'sha256':file_digest(path)})
    manifest={'model_version':spec['model_version'],'revisions':{k:r['revision'] for k,r in spec['repos'].items()},
              'faceArchiveSha256':face['sha256'],'files':files}
    (root/MANIFEST).write_text(json.dumps(manifest,indent=2)+'\n');(root/MANIFEST).chmod(0o444)
    return manifest


def verify_assets(root,hashes=True):
    """Pesos iguais ao manifesto do build e às fixações do repositório. Sem `hashes`, confere só presença e tamanho
    (subida rápida do contêiner); o carregamento do modelo, sob demanda, confere os SHA-256."""
    spec=assets();root=Path(root).resolve()
    try:manifest=json.loads((root/MANIFEST).read_text())
    except (OSError,ValueError) as error:raise AlignmentError('PORTRAIT_MANIFEST_MISSING') from error
    if manifest.get('model_version')!=spec['model_version'] or manifest.get('revisions')!={k:r['revision'] for k,r in spec['repos'].items()} \
            or manifest.get('faceArchiveSha256')!=spec['face']['sha256']:
        raise AlignmentError('PORTRAIT_MANIFEST_MISMATCH')
    built={entry.get('path'):entry for entry in manifest.get('files',[])}
    for name,entry in expected_files(spec):
        recorded=built.get(name);path=artifact_path(root,name)
        try:
            if recorded is None or not path.is_file():raise AlignmentError('PORTRAIT_WEIGHT_MISSING:'+name)
            if path.stat().st_size!=recorded['size']:raise AlignmentError('PORTRAIT_WEIGHT_SIZE_MISMATCH:'+name)
            if hashes:
                digest=file_digest(path)
                if digest!=recorded['sha256'] or (entry and entry.get('sha256') and digest!=entry['sha256']):
                    raise AlignmentError('PORTRAIT_WEIGHT_SHA256_MISMATCH:'+name)
        except OSError as error:
            raise AlignmentError('PORTRAIT_WEIGHT_UNREADABLE:'+name) from error
    return manifest


def checkout_code(destination):
    """O commit fixado do InstantID; cada arquivo usado é conferido por SHA-256 e o .git sai depois."""
    source=assets()['code']['instantid'];target=Path(destination)
    if target.exists():raise AlignmentError('PORTRAIT_CODE_ALREADY_PRESENT')
    git=lambda *args:subprocess.run(['git','-C',str(target),*args],check=True,capture_output=True,text=True).stdout.strip()
    target.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['git','init','-q',str(target)],check=True)
    git('fetch','-q','--depth','1',source['url'],source['commit']);git('checkout','-q','--detach','FETCH_HEAD')
    if git('rev-parse','HEAD')!=source['commit']:raise AlignmentError('PORTRAIT_CODE_COMMIT_MISMATCH')
    shutil.rmtree(target/'.git')
    verify_code(target)
    print(json.dumps({'code':'instantid','commit':source['commit'],'status':'VERIFIED'}),flush=True)


def verify_code(target):
    for name,digest in assets()['code']['instantid']['files'].items():
        path=artifact_path(Path(target),name)
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise AlignmentError('PORTRAIT_CODE_SHA256_MISMATCH:'+name)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default=DEFAULT_WEIGHTS_DIR)
    parser.add_argument('--verify-only',action='store_true')
    parser.add_argument('--checkout-code',metavar='DIR',help='Clone the pinned InstantID commit into DIR')
    args=parser.parse_args()
    if args.checkout_code:checkout_code(args.checkout_code);return
    manifest=verify_assets(args.output) if args.verify_only else download(args.output)
    print(json.dumps({'status':'PORTRAIT_WEIGHTS_VERIFIED','files':len(manifest['files']),'revisions':manifest['revisions']}),flush=True)

if __name__=='__main__':main()
