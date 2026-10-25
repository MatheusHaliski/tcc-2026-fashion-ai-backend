#!/usr/bin/env python3
"""Run the real catalog photo provider against local source files, with no DB/upload.

Input: {"products": [{"id":"p", "category":"upper_piece", "subcategory":"shirt",
                     "images":[{"path":"source.jpg"}]}]}
Paths are relative to the manifest. Only READY derivatives are written. The
offline exclusion report is evidence for review and cannot be applied to a DB.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from PIL import Image
try:
    from .photo_set import PHOTO_SET_VERSION, process_photo
    from .semantic_photo_provider import AutomaticClothProvider, AUTOMATIC_POLICY_VERSION
    from .quarantine_unsafe_products import report_for
except ImportError:
    from photo_set import PHOTO_SET_VERSION, process_photo
    from semantic_photo_provider import AutomaticClothProvider, AUTOMATIC_POLICY_VERSION
    from quarantine_unsafe_products import report_for


def run(manifest, output, provider=None):
    manifest, output = Path(manifest).resolve(), Path(output)
    raw = manifest.read_bytes()
    document = json.loads(raw)
    provider = provider or AutomaticClothProvider()
    output.mkdir(parents=True, exist_ok=True)
    products, rows = [], []
    for p_index, product in enumerate(document['products']):
        current = {'id': str(product['id']), 'version': 0, 'category': product['category'],
                   'subcategory': product.get('subcategory'), 'color': product.get('color'),
                   'ingestion_status': 'VALIDATED', 'metadata_json': {}, 'images': []}
        for index, candidate in enumerate(product['images']):
            path = (manifest.parent / candidate['path']).resolve()
            image_id = str(candidate.get('id') or f'{p_index}-{index}')
            row = {'productId': current['id'], 'imageId': image_id, 'sourcePath': str(path),
                   'sourceSha256': None, 'status': 'RETRY', 'reason': 'SOURCE_UNAVAILABLE'}
            state = {'version': PHOTO_SET_VERSION, 'isolationPolicyVersion': AUTOMATIC_POLICY_VERSION,
                     'imageId': image_id, 'variantId': None,
                     'category': current['category'], 'subcategory': current['subcategory'], 'color': current['color'],
                     'sourceUrl': candidate.get('sourceUrl') or 'offline-source:'+image_id, 'sourceSha256': None}
            try:
                source = path.read_bytes()
                sha = hashlib.sha256(source).hexdigest()
                state['sourceSha256'] = sha; row['sourceSha256'] = sha
                selected = provider.for_source(sha, state['sourceUrl']) if hasattr(provider,'for_source') else provider
                with Image.open(path) as image:
                    result = process_photo(image, current['category'], current['subcategory'], provider=selected)
                state.update(status=result.status, reason=result.reason, metrics=result.metrics)
                row.update(status=result.status, reason=result.reason, metrics=result.metrics)
                if result.status == 'READY':
                    name = hashlib.sha256((current['id']+'\0'+image_id+'\0'+sha).encode()).hexdigest()[:24]
                    for kind, payload in [('whole',result.whole), ('fabric',result.fabric)]:
                        target = output/(name+'-'+kind+'.png'); target.write_bytes(payload)
                        row[kind+'Path'] = str(target.resolve())
                        row[kind+'Sha256'] = hashlib.sha256(payload).hexdigest()
            except (OSError, ValueError, RuntimeError, ImportError):
                state.update(status='RETRY',reason='SOURCE_OR_PROVIDER_UNAVAILABLE',
                             metrics={'sourceGarmentHeightFraction':None})
                row.update(status=state['status'],reason=state['reason'],metrics=state['metrics'])
            current['images'].append({'id':image_id,'version':0,'image_url':state['sourceUrl'],
                                      'source_sha256':state['sourceSha256'],'assets_json':{'photoSet':state}})
            rows.append(row)
        products.append(current)
    report = report_for(products, origin='OFFLINE_SOURCE_RUN:'+hashlib.sha256(raw).hexdigest())
    (output/'images.json').write_text(json.dumps(rows,indent=2))
    (output/'snapshot.json').write_text(json.dumps({'products':products},indent=2))
    (output/'exclusion-report.json').write_text(json.dumps(report,indent=2))
    summary = {'policyVersion':AUTOMATIC_POLICY_VERSION, 'databaseConnections':0, 'uploads':0,
               'sourceImages':len(rows), 'products':len(products), 'statuses':dict(Counter(row['status'] for row in rows)),
               'productsConfirmedBelow25Percent':[row['productId'] for row in report['products']],
               'reportSha256':report['reportSha256']}
    (output/'summary.json').write_text(json.dumps(summary,indent=2))
    return summary


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--parser-weights',type=Path);parser.add_argument('--device',default='cpu')
    args=parser.parse_args(argv)
    summary=run(args.input,args.output,AutomaticClothProvider(weights=args.parser_weights,device=args.device))
    print(json.dumps(summary))
    return 0 if summary['statuses'].get('READY',0)+summary['statuses'].get('INELIGIBLE',0) else 2

if __name__=='__main__':
    raise SystemExit(main())
