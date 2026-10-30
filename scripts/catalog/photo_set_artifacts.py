"""Photo-set artifact I/O: local PNG validation and verified content-addressed upload.

No policy, inference, database access or worker orchestration lives here. The caller
supplies the pipeline version so the historical worker entrypoint stays compatible.
"""
from __future__ import annotations

import hashlib
import io
from urllib.parse import quote
from PIL import Image

def upload_verified(storage,payload,version):
    """PNG no bucket com chave pelo sha256, lido de volta e conferido; devolve a URL pública."""
    key=f"catalog/photo-sets/{version}/{hashlib.sha256(payload).hexdigest()}.png"
    storage.client.put_object(Bucket=storage.bucket,Key=key,Body=payload,ContentType='image/png')
    body=storage.client.get_object(Bucket=storage.bucket,Key=key)['Body']
    try:verified=body.read(len(payload)+1)
    finally:body.close()
    if hashlib.sha256(verified).digest()!=hashlib.sha256(payload).digest():raise ValueError('UPLOAD_VERIFICATION_FAILED')
    return storage.base+'/'+quote(key,safe='/')

def ready_files(path,files):
    """Validate only the two expected local PNGs; forbid traversal and partial lots.

    A corrupted or absent READY image must stay local for review. In
    particular, never try to upload a file from an arbitrary set.json path.
    """
    if files!={'whole':'whole.png','fabric':'fabric.png'}:
        return None,'PHOTO_SET_FILES_INVALID'
    data={}
    for kind in ('whole','fabric'):
        item=path.parent/files[kind]
        if not item.is_file() or item.is_symlink() or item.stat().st_size>15_000_000:
            return None,'PHOTO_SET_FILES_INVALID'
        payload=item.read_bytes()
        if not payload.startswith(b'\x89PNG\r\n\x1a\n'):
            return None,'PHOTO_SET_FILES_INVALID'
        try:
            with Image.open(io.BytesIO(payload)) as pic:
                if pic.format!='PNG' or pic.width<24 or pic.height<24:
                    return None,'PHOTO_SET_FILES_INVALID'
                if kind=='whole' and pic.size!=(900,1200):
                    return None,'PHOTO_SET_FILES_INVALID'
                pic.verify()
        except (OSError,ValueError):
            return None,'PHOTO_SET_FILES_INVALID'
        data[kind]=payload
    return data,None
