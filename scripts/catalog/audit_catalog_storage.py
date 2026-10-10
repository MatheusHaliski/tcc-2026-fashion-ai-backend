#!/usr/bin/env python3
"""List potential framed-object orphans, read-only; never delete any object."""
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
from db import connect
from category_frame_storage import FrameStorage


def referenced_keys(value):
    if isinstance(value, dict):
        return set().union(*(referenced_keys(v) for v in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(referenced_keys(v) for v in value)) if value else set()
    if not isinstance(value,str):return set()
    if value.startswith(('{','[')):
        try:return referenced_keys(json.loads(value))
        except ValueError:return set()
    path=urlsplit(value).path
    marker='catalog/framed/'
    return {path[path.index(marker):]} if marker in path else set()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    conn=connect()
    keys=set()
    try:
        with conn.cursor() as cursor:
            cursor.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
            cursor.execute('SELECT stored_url, assets_json FROM catalog_images')
            for row in cursor.fetchall():keys.update(referenced_keys(row))
    finally:
        conn.rollback();conn.close()
    storage=FrameStorage()
    candidates=[];total=0
    for page in storage.client.get_paginator('list_objects_v2').paginate(Bucket=storage.bucket,Prefix='catalog/framed/'):
        for obj in page.get('Contents',[]):
            total+=1
            if obj['Key'] not in keys:
                candidates.append(dict(key=obj['Key'],size=obj['Size'],last_modified=str(obj['LastModified'])))
    report=dict(total_objects=total,potential_orphans=candidates,deleted=0,
                limitation='DB/S3 snapshots are not atomic. Candidates require human review; do not delete automatically.')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(dict(total_objects=total,potential_orphans=len(candidates),deleted=0)))

if __name__=='__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print('AUDIT_FAILED:'+type(error).__name__, file=sys.stderr)
        raise SystemExit(2)
