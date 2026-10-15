"""Continuous, bounded annotation worker and incremental catalog-ingestion monitor."""
import argparse
import json
import os
from pathlib import Path
import signal
import threading
import time
from .auto_catalog import GarmentAutoAnnotator,decode_image
from .providers import HttpAnnotationProvider
from .store import ArtifactStore,S3ArtifactStore,CatalogStore,content_key


def configured_store():
    artifacts=S3ArtifactStore(os.environ['VTON_S3_BUCKET']) if os.getenv('VTON_S3_BUCKET') else ArtifactStore(os.getenv('VTON_ARTIFACT_DIR','work/vton-artifacts'))
    return CatalogStore(os.getenv('VTON_DATABASE_URL','sqlite:///work/vton-catalog.sqlite'),artifacts)


def configured_annotator():
    backend=os.getenv('VTON_BACKEND_URL','').rstrip('/')
    url=(backend+'/api/admin/vton/annotate') if backend else os.getenv('VTON_ANNOTATOR_URL')
    token=os.getenv('VTON_BACKEND_API_TOKEN') if backend else os.getenv('VTON_ANNOTATOR_TOKEN')
    if os.getenv('VTON_ANNOTATION_PROVIDER') == 'vertex':
        from .google_cloud import VertexAnnotationProvider,configured_vertex_client
        provider=VertexAnnotationProvider(configured_vertex_client('VTON_VERTEX_ANNOTATION_ENDPOINT_ID'))
    else:
        provider=HttpAnnotationProvider(url,token) if url and token else None
    return GarmentAutoAnnotator(provider,os.getenv('VTON_MODEL_VERSION','garment-anatomy-v1'))


class AutoGarmentProcessor:
    def __init__(self,store,annotator):self.store=store;self.annotator=annotator
    def process_one(self):
        # Do not exhaust retries because a model has not been provisioned yet.
        if self.annotator.provider is None:return {'status':'MODEL_NOT_CONFIGURED'}
        job=self.store.claim(model_version=self.annotator.version)
        if job is None:return {'status':'IDLE'}
        if job['model_version']!=self.annotator.version:
            from .models import AlignmentError
            self.store.fail(job,AlignmentError('MODEL_VERSION_NOT_AVAILABLE'));return {'status':'VERSION_UNAVAILABLE'}
        try:
            image=decode_image(self.store.artifacts.get(job['image_key']))
            annotation=self.annotator.annotate(image,job.get('error_code'))
            accepted=self.store.complete(job,annotation)
            return {'status':'READY' if accepted else 'STALE_LEASE','jobKey':job['job_key'],'repairs':annotation.repairs}
        except Exception as error:
            self.store.fail(job,error)
            return {'status':'REJECTED','jobKey':job['job_key'],'errorType':type(error).__name__}


def ingest_manifest(store,path,version,max_records=100):
    """Append-only ingestion feed; byte checkpoint makes restart O(new records).

    Each record has garment_id and image_path. Paths stay inside the feed directory.
    Ingestion publishes a new record whenever an image changes. No periodic full
    scan of millions of files is needed or implied.
    """
    path=Path(path).resolve();root=path.parent;key=content_key(str(path).encode());position=store.offset(key)
    if path.stat().st_size<position:raise ValueError('FEED_TRUNCATED_USE_A_NEW_FEED_ID')
    processed=0
    with path.open('rb') as feed:
        feed.seek(position)
        for _ in range(max_records):
            line=feed.readline(65537)
            if not line:break
            if not line.endswith(b'\n'):
                if len(line)>65536:raise ValueError('FEED_RECORD_TOO_LARGE')
                break  # writer has not committed the final newline yet
            row=json.loads(line);image=(root/row['image_path']).resolve()
            if not image.is_relative_to(root):raise ValueError('IMAGE_OUTSIDE_FEED_ROOT')
            store.enqueue(str(row['garment_id']),decode_image(image.read_bytes()),version)
            store.checkpoint(key,feed.tell());processed+=1
    return processed


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--feed');parser.add_argument('--once',action='store_true');parser.add_argument('--interval',type=float,default=5);parser.add_argument('--batch',type=int,default=20)
    args=parser.parse_args()
    if not 1<=args.batch<=1000 or not 1<=args.interval<=300:parser.error('batch 1..1000; interval 1..300')
    stop=threading.Event()
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,lambda *_:stop.set())
    store=configured_store();annotator=configured_annotator();processor=AutoGarmentProcessor(store,annotator)
    while not stop.is_set():
        if os.getenv('VTON_BACKEND_URL'):
            from .backend_feed import ingest_backend_page
            try:ingest_backend_page(store,os.environ['VTON_BACKEND_URL'],os.environ.get('VTON_BACKEND_API_TOKEN',''),annotator.version,set(filter(None,os.getenv('VTON_ALLOWED_IMAGE_ORIGINS','').split(','))),args.batch)
            except Exception as error:print(json.dumps({'event':'vton_feed_error','errorType':type(error).__name__}),flush=True)
        if args.feed:ingest_manifest(store,args.feed,annotator.version,args.batch)
        last={'status':'IDLE'}
        for _ in range(args.batch):
            if stop.is_set():break
            last=processor.process_one()
            if last['status'] in {'IDLE','MODEL_NOT_CONFIGURED'}:break
        print(json.dumps({'event':'vton_monitor','lastStatus':last['status'],'queue':store.stats()}),flush=True)
        if args.once:break
        stop.wait(args.interval)

if __name__=='__main__':main()
