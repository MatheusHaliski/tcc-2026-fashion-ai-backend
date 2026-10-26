#!/usr/bin/env python3
"""Recorte das fotos do catálogo (photoSet) no endpoint Vertex fashionai-fashn-gpu, em lote.

A réplica precisa ter sido implantada com a imagem que inclui o recorte:
  python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --new-release --deploy-only --with-photo-set --output work/fashn-photo-set

Cada foto é baixada aqui, pelo mesmo baixador do worker do catálogo (só HTTPS público, intervalo mínimo por host, host
parado em 403/429, User-Agent próprio do FashionAI), e os bytes vão para a T4 (tarefa garment_photo_set: parser + BiRefNet
+ LaMa, o engine fashn-open). A saída é o mesmo lote que `process_local_sd.py --photo-set` grava na máquina local:

  <out>/photo-sets/<sha256(id)[:24]>/{set.json, whole.png, fabric.png}   e   <out>/report.jsonl

que `python3 -m scripts.catalog.process_photo_sets --from-lot <out>` confere (ensaio) e, com --apply, importa com o CAS do
worker. Aqui nada é gravado em banco ou bucket, e a réplica não é criada nem removida: ela continua faturável até
`deploy_fashn_vertex.py --apply --undeploy --output <a mesma pasta do deploy>`.

  python3 -m scripts.catalog.process_photo_sets --export-rows rows.json    # com as variáveis do banco no ambiente
  python3 -u scripts/cloud/photo_sets_vertex.py --input rows.json --out lote-vertex
  python3 -m scripts.catalog.process_photo_sets --from-lot lote-vertex     # ensaio: confere e conta; --apply grava

  # opcional, depois da GPU: gera candidatos canônicos SEM alterar whole.png/set.json nem gravar banco
  python3 -u scripts/cloud/photo_sets_vertex.py --input rows.json --out lote-vertex \
    --canonical-asset-root work/garments-canonical-v0

  # ou reprocessa um lote existente sem usar a GPU:
  python3 -m scripts.catalog.canonical_full_frame --from-lot lote-vertex \
    --asset-root work/garments-canonical-v0

Rodar de novo continua de onde parou: foto com set.json da mesma URL já no lote é pulada (--force refaz).
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

try:
    from . import deploy_fashn_vertex as deploy
except ImportError:  # rodado como script: scripts/cloud já está no sys.path
    import deploy_fashn_vertex as deploy

ROOT=Path(__file__).resolve().parents[2]
CATEGORIES=frozenset({'upper_piece','lower_piece','full_body_piece'})
MAX_SOURCE_BYTES=6_000_000          # o mesmo limite do contêiner (photoset_runtime.MAX_SOURCE_BYTES)
# Só estes esperam e repetem: a GPU está com outra foto, o modelo ainda carrega, ou o Vertex recusou sem código nosso.
RETRY_CODES=frozenset({'GPU_BUSY_RETRY_LATER','MODEL_NOT_READY'})
# Erros que valem para o lote inteiro: parar já em vez de repetir o mesmo erro em milhares de fotos.
FATAL_CODES=frozenset({'TASK_NOT_SUPPORTED_BY_MODEL','PHOTOSET_ASSETS_MISSING','PHOTOSET_WEIGHTS_INVALID','REAL_CUDA_DEVICE_REQUIRED'})
GPU_FAILURES=frozenset({'GPU_PREDICTION_FAILED','PHOTOSET_GPU_FAILED','GPU_NETWORK_UNAVAILABLE'})
MAX_GPU_FAILURES_IN_A_ROW=3
DEDICATED_DNS=re.compile(r'[a-z0-9][a-z0-9.-]*\.prediction\.vertexai\.goog')
SUBCATEGORY=re.compile(r'[a-z0-9_]{1,80}')   # o mesmo padrão do contêiner (vertex_runtime/server.py)


class BatchStopped(RuntimeError):
    """O lote não pode continuar (endpoint sem réplica, imagem sem o recorte, credencial recusada)."""


def catalog_downloader(directory,min_interval):
    """O ImageDownloader do worker do catálogo (scripts/catalog/process_catalog_images.py): só biblioteca padrão."""
    catalog=str(ROOT/'scripts/catalog')
    if catalog not in sys.path:sys.path.insert(0,catalog)
    from process_catalog_images import DownloadFailure,ImageDownloader
    return ImageDownloader(Path(directory),min_interval=min_interval),DownloadFailure


def load_rows(path,limit=None):
    """Linhas do --export-rows (ou do acervo: lista, ou {"images": [...]}/{"products": [...]}) no formato do lote."""
    raw=json.loads(Path(path).read_text(encoding='utf-8'))
    items=raw.get('images',raw.get('products',[])) if isinstance(raw,dict) else raw
    rows=[]
    for item in items:
        row={str(k).lower():v for k,v in item.items()}
        rows.append({'id':row.get('id'),'product_id':row.get('product_id'),'image_url':row.get('image_url') or row.get('url'),
                     'category':row.get('category'),'subcategory':row.get('subcategory'),'color':row.get('color')})
    return rows[:limit] if limit else rows


def find_endpoint(cloud,endpoint_id=None):
    """(nome do recurso, host dedicado) do endpoint com réplica; recusa endpoint sem modelo implantado."""
    if endpoint_id:
        if not re.fullmatch(r'[0-9]{1,24}',endpoint_id):raise ValueError('INVALID_ENDPOINT_ID')
        endpoint=cloud.request('GET',f'{cloud.parent}/endpoints/{endpoint_id}')
    else:
        matches=[e for e in cloud.endpoints() if e.get('displayName')==deploy.NAME]
        if len(matches)!=1:raise BatchStopped(f'ENDPOINT_NOT_FOUND: {len(matches)} endpoints chamados {deploy.NAME} em {cloud.region}; use --endpoint <ID>')
        endpoint=matches[0]
    if not endpoint.get('deployedModels'):
        raise BatchStopped('ENDPOINT_HAS_NO_REPLICA: implante antes com deploy_fashn_vertex.py --apply --new-release --deploy-only --with-photo-set')
    host=endpoint.get('dedicatedEndpointDns','')
    if not DEDICATED_DNS.fullmatch(host):raise BatchStopped('DEDICATED_DNS_NOT_AVAILABLE')
    return endpoint['name'],host


def predict(cloud,endpoint_name,host,instance,attempts=5,sleep=time.sleep):
    """Uma foto por vez (a réplica atende uma inferência por vez): espera e repete em GPU ocupada ou modelo carregando."""
    for attempt in range(attempts):
        try:
            predictions=cloud.request('POST',endpoint_name+':predict',{'instances':[instance]},host=host).get('predictions',[])
            if len(predictions)!=1:raise RuntimeError('INVALID_GPU_PREDICTION_CONTRACT')
            return predictions[0]
        except deploy.CloudHTTPError as error:
            if error.code in FATAL_CODES or error.status in (401,403,404):raise BatchStopped(str(error)) from None
            retry=error.code in RETRY_CODES or (error.code is None and error.status in (429,503))
            if not retry or attempt==attempts-1:return {'status':'FAILED','reason':error.code or f'HTTP_{error.status}','photoSet':None}
        except (urllib.error.URLError,TimeoutError,ConnectionError):
            # Rede do Cloud Shell; se a GPU ainda estiver com esta foto, a próxima tentativa volta 429 e espera.
            if attempt==attempts-1:return {'status':'FAILED','reason':'GPU_NETWORK_UNAVAILABLE','photoSet':None}
        sleep(min(15*2**attempt,120))
    return {'status':'FAILED','reason':'GPU_UNAVAILABLE','photoSet':None}  # pragma: no cover


def already_done(out,row):
    """Resume only a complete result for the *same* catalog image context.

    A reused URL alone is insufficient: the product category or subcategory
    might have been corrected after the previous GPU call. Missing READY PNGs
    also require regeneration, not a misleading ALREADY_IN_LOT outcome.
    """
    path=deploy.photo_set_folder(out,row['id'])/'set.json'
    try:
        record=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(record,dict):return False
        if record.get('sourceUrl')!=row['image_url'] or str(record.get('imageId'))!=str(row['id']):return False
        for key in ('category','subcategory','color'):
            if record.get(key)!=row.get(key):return False
        if row.get('product_id') is not None and str(record.get('productId'))!=str(row['product_id']):return False
        if record.get('status') not in ('READY','REVIEW','INELIGIBLE'):return False
        if record.get('status')=='READY':
            if record.get('files')!={'whole':'whole.png','fabric':'fabric.png'}:return False
            if not all((path.parent/filename).is_file() and not (path.parent/filename).is_symlink()
                       for filename in ('whole.png','fabric.png')):return False
        return True
    except (OSError,ValueError,TypeError):return False


def process_row(row,data,cloud,endpoint_name,host,out,sleep=time.sleep):
    """Foto já baixada → recorte na GPU → photo-sets/<id>/; devolve a linha do report.jsonl (sem URL, só o hash)."""
    base={'id':row['id'],'product_id':row.get('product_id'),'category':row.get('category'),'subcategory':row.get('subcategory'),
          'source_url_sha256':hashlib.sha256(str(row.get('image_url') or '').encode()).hexdigest()}
    if len(data)>MAX_SOURCE_BYTES:return {**base,'status':'REVIEW','reason':'SOURCE_IMAGE_TOO_LARGE'}
    instance={'task':'garment_photo_set','source_image':base64.b64encode(data).decode(),'catalog_category':row['category'],
              'source_url':row['image_url'],'image_id':str(row['id'])}
    for key,limit in (('subcategory',80),('product_id',200),('color',80)):
        # a cor só acompanha o set.json (o importador usa a do banco): longa demais, fica de fora
        if row.get(key) and len(str(row[key]))<=limit:instance[key]=str(row[key])
    started=time.monotonic()
    try:
        prediction=predict(cloud,endpoint_name,host,instance,sleep=sleep)
        folder=deploy.write_photo_set(prediction,out,row['id'],row['image_url'])
    except BatchStopped:raise
    except RuntimeError as error:
        # Resposta fora do contrato vale para todas as fotos seguintes: o lote para (nada desta foto foi gravado como set.json).
        raise BatchStopped(deploy.short_reason(str(error).split(':',1)[0])) from None
    diagnostics={k:(prediction.get('diagnostics') or {}).get(k) for k in ('engine','device','peakCudaBytes','seconds')}
    if folder is None:
        return {**base,'status':'FAILED','reason':deploy.short_reason(prediction.get('reason')),'diagnostics':diagnostics,
                'seconds':round(time.monotonic()-started,1)}
    # Postflight also runs locally in Cloud Shell, protecting the current
    # already-deployed GPU image without a new build. The GPU response is first
    # saved/validated with its original contract; unsafe READY is then
    # downgraded to REVIEW with a preserved set.json backup (PNGs untouched).
    catalog_path=str(ROOT/'scripts/catalog')
    if catalog_path not in sys.path:sys.path.insert(0,catalog_path)
    from audit_photo_set_lot import harden_set_path
    verdict=harden_set_path(folder/'set.json',apply_local=True)
    if verdict['status'] in {'BACKUP_CONFLICT_REVIEW_REQUIRED'}:
        raise BatchStopped('POSTFLIGHT_BACKUP_CONFLICT')
    photo_set=json.loads((folder/'set.json').read_text(encoding='utf-8'))
    return {**base,'status':photo_set['status'],'reason':photo_set.get('reason'),'lotStatus':prediction.get('status'),
            'dir':folder.relative_to(out).as_posix(),'diagnostics':diagnostics,'seconds':round(time.monotonic()-started,1)}


def run(rows,cloud,endpoint_name,host,out,*,min_interval=1.0,force=False,sleep=time.sleep,downloader=None,log=print):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    counts={};failures=0
    pending=[]
    for row in rows:
        if not row.get('id') or not row.get('image_url') or len(str(row['id']))>200 or len(row['image_url'])>2048:status='INVALID_ROW'
        elif row.get('category') not in CATEGORIES:status='CATEGORY_WITHOUT_PHOTO_SET'
        # subcategoria fora do padrão: o contêiner recusaria, e sem ela o importador acharia o set "stale"
        elif row.get('subcategory') and not SUBCATEGORY.fullmatch(str(row['subcategory'])):status='SUBCATEGORY_NOT_NORMALIZED'
        elif not force and already_done(out,row):status='ALREADY_IN_LOT'
        else:pending.append(row);continue
        counts[status]=counts.get(status,0)+1
    with tempfile.TemporaryDirectory(prefix='photo-sets-download-') as directory, (out/'report.jsonl').open('a',encoding='utf-8') as report:
        fetcher,failure=downloader or catalog_downloader(directory,min_interval)

        def fetch(row):
            try:
                path=fetcher.get(row['image_url'])
                try:return path.read_bytes(),None
                finally:path.unlink(missing_ok=True)  # a foto não fica no Cloud Shell depois de enviada
            except failure as error:
                return None,str(error)

        # Baixa a próxima foto enquanto a GPU recorta a atual (o baixador mantém o intervalo por host).
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(fetch,pending[0]) if pending else None
            for index,row in enumerate(pending):
                data,problem=future.result()
                future=pool.submit(fetch,pending[index+1]) if index+1<len(pending) else None
                if data is None:
                    # Host parado (403/429), indisponível ou 5xx: volta noutra execução; o resto (404, não é imagem, URL insegura) não.
                    result={'id':row['id'],'product_id':row.get('product_id'),'category':row.get('category'),'subcategory':row.get('subcategory'),
                            'source_url_sha256':hashlib.sha256(row['image_url'].encode()).hexdigest(),
                            'status':'RETRY' if 'BLOCKED' in problem or 'UNAVAILABLE' in problem or 'HTTP_5' in problem else 'REJECTED',
                            'reason':deploy.short_reason(problem)}
                else:
                    result=process_row(row,data,cloud,endpoint_name,host,out,sleep=sleep)
                report.write(json.dumps(result,ensure_ascii=False)+'\n');report.flush()
                counts[result['status']]=counts.get(result['status'],0)+1
                log(f"[{index+1}/{len(pending)}] {result['status']}"+(f" ({result['reason']})" if result.get('reason') else ''),flush=True)
                # Falha da GPU ou recusa genérica do Vertex (ex.: 400 com a réplica removida no meio do lote) várias vezes seguidas
                # é do endpoint, não da foto: parar em vez de marcar milhares de fotos como FAILED.
                reason=str(result.get('reason') or '')
                failures=failures+1 if result['status']=='FAILED' and (reason in GPU_FAILURES or reason.startswith('HTTP_')) else 0
                if failures>=MAX_GPU_FAILURES_IN_A_ROW:
                    raise BatchStopped(f'GPU_FAILING_REPEATEDLY: {failures} fotos seguidas falharam na GPU; veja os logs do endpoint '
                                       'no Cloud Logging antes de continuar (rodar de novo retoma de onde parou)')
    return counts


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--input',type=Path,required=True,help='linhas do process_photo_sets.py --export-rows (id, image_url, category, subcategory, color, product_id)')
    parser.add_argument('--out',type=Path,default=Path('work/photo-sets-vertex'),help='pasta do lote (o --from-lot do importador)')
    parser.add_argument('--limit',type=int,help='no máximo N fotos desta lista')
    parser.add_argument('--force',action='store_true',help='refaz fotos que já têm set.json da mesma URL no lote')
    parser.add_argument('--min-interval',type=float,default=1.0,help='segundos mínimos entre downloads no mesmo host')
    parser.add_argument('--endpoint',help='ID numérico do endpoint (padrão: o endpoint chamado '+deploy.NAME+')')
    parser.add_argument('--canonical-asset-root',type=Path,
                        help='após a GPU, gera prévias canônicas em <out>/canonical-preview; não altera o photoSet')
    parser.add_argument('--project',default=deploy.PROJECT);parser.add_argument('--region',default=deploy.REGION)
    args=parser.parse_args(argv)
    if args.limit is not None and args.limit<1:parser.error('--limit deve ser positivo')
    if args.min_interval<0.5:parser.error('--min-interval mínimo de 0,5 s por host (regra do coletor)')
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',args.project) or not re.fullmatch(r'[a-z]+-[a-z]+[0-9]',args.region):parser.error('Invalid project/region')
    rows=load_rows(args.input,args.limit)
    cloud=deploy.Cloud(args.project,args.region)
    try:
        endpoint_name,host=find_endpoint(cloud,args.endpoint)
        print(f'{len(rows)} fotos → {endpoint_name.rsplit("/",1)[-1]} ({host}); lote em {args.out}',flush=True)
        counts=run(rows,cloud,endpoint_name,host,args.out,min_interval=args.min_interval,force=args.force)
    except (BatchStopped,deploy.CloudHTTPError) as error:
        print(f'LOTE_PARADO: {error}',file=sys.stderr);return 3
    print('Recorte na GPU: '+' · '.join(f'{k}: {v}' for k,v in sorted(counts.items())),flush=True)
    if args.canonical_asset_root:
        # Um renderizador local e independente: não usa GPU nem exige nova release.
        # A saída é REVIEW em pasta paralela. O importador não a consome.
        catalog_path=str(ROOT/'scripts/catalog')
        if catalog_path not in sys.path:sys.path.insert(0,catalog_path)
        from canonical_full_frame import render_lot
        rendered=render_lot(args.out,args.canonical_asset_root,limit=args.limit)
        print('Prévia canônica (nada gravado no banco): '+json.dumps(rendered,ensure_ascii=False),flush=True)
    print(f'Próximo passo (ensaio, sem gravar): python3 -m scripts.catalog.process_photo_sets --from-lot {args.out}',flush=True)
    print('ATENÇÃO: a réplica continua ativa e faturável. Para remover: python3 -u scripts/cloud/deploy_fashn_vertex.py '
          '--apply --undeploy --output <a mesma pasta do deploy>',flush=True)
    return 0


if __name__=='__main__':
    sys.exit(main())
