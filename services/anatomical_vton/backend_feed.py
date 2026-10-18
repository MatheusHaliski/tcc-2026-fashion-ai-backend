"""Incremental producer using the existing FashionAI backend's governed services."""
import argparse
import json
import os
from urllib.parse import urlparse
import httpx
from .auto_catalog import decode_image
from .store import content_key


def ingest_backend_page(store,backend_url,backend_token,version,allowed_image_origins,limit=100):
    if not backend_url or not backend_token:raise ValueError('BACKEND_URL_AND_SERVICE_JWT_REQUIRED')
    monitor=content_key((backend_url+':vton-feed:'+version).encode())
    with store.connection() as db:
        store.execute(db,'CREATE TABLE IF NOT EXISTS vton_backend_cursors (monitor_id VARCHAR(64) PRIMARY KEY,cursor_json VARCHAR(1024) NOT NULL)')
        row=store.execute(db,'SELECT cursor_json FROM vton_backend_cursors WHERE monitor_id=?',(monitor,)).fetchone();db.commit()
    cursor=json.loads(row['cursor_json']) if row else {'after':'1970-01-01T00:00:01Z','afterId':''}
    headers={'Authorization':f'Bearer {backend_token}'}
    with httpx.Client(timeout=httpx.Timeout(30,connect=5),follow_redirects=False) as client:
        response=client.get(backend_url.rstrip('/')+'/api/admin/vton/catalog-feed',params={**cursor,'limit':min(max(limit,1),100)},headers=headers);response.raise_for_status()
        if len(response.content)>1_000_000:raise ValueError('BACKEND_FEED_LIMIT')
        feed=response.json()
        for row in feed['items']:
            url=row['image_url'];parsed=urlparse(url)
            if not parsed.netloc:url=backend_url.rstrip('/')+'/'+url.lstrip('/');parsed=urlparse(url)
            origin=f'{parsed.scheme}://{parsed.netloc}'
            if origin not in allowed_image_origins or parsed.username or parsed.password:raise ValueError('CATALOG_IMAGE_ORIGIN_NOT_ALLOWED')
            data=bytearray()
            # JWT is only sent to the backend origin, never to object-storage hosts.
            same_origin=origin==f'{urlparse(backend_url).scheme}://{urlparse(backend_url).netloc}'
            with client.stream('GET',url,headers=headers if same_origin else {}) as image:
                image.raise_for_status()
                for chunk in image.iter_bytes():
                    data.extend(chunk)
                    if len(data)>6_000_000:raise ValueError('CATALOG_IMAGE_BYTE_LIMIT')
            store.enqueue(row['garment_id'],decode_image(bytes(data)),version)
        # Only checkpoint a fully enqueued page. Replays are content-idempotent.
        with store.connection() as db:
            value=json.dumps(feed['cursor'])
            if store.mysql:store.execute(db,'INSERT INTO vton_backend_cursors VALUES(?,?) ON DUPLICATE KEY UPDATE cursor_json=VALUES(cursor_json)',(monitor,value))
            else:store.execute(db,'INSERT INTO vton_backend_cursors VALUES(?,?) ON CONFLICT(monitor_id) DO UPDATE SET cursor_json=excluded.cursor_json',(monitor,value))
            db.commit()
    return len(feed['items'])
