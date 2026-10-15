"""Durable content-addressed jobs. SQLite for local use; MySQL 8 SKIP LOCKED for workers."""
import base64
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import time
import uuid
from urllib.parse import urlparse,unquote
from .auto_catalog import Annotation,png_bytes
from .models import AlignmentError


def content_key(data): return hashlib.sha256(data).hexdigest()


class ArtifactStore:
    def __init__(self,root): self.root=Path(root).resolve();self.root.mkdir(parents=True,exist_ok=True)
    def put(self,data):
        digest=content_key(data);key=f'{digest[:2]}/{digest}.png';path=self.root/key;path.parent.mkdir(exist_ok=True)
        if not path.exists():
            with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as file:
                file.write(data);temporary=file.name
            os.replace(temporary,path)
        return key
    def get(self,key):
        if not re.fullmatch(r'[a-f0-9]{2}/[a-f0-9]{64}\.png',key): raise AlignmentError('INVALID_ARTIFACT_KEY')
        path=(self.root/key).resolve()
        if not path.is_relative_to(self.root): raise AlignmentError('INVALID_ARTIFACT_KEY')
        return path.read_bytes()


class S3ArtifactStore:
    def __init__(self,bucket,prefix='private/vton'):
        import boto3
        self.client=boto3.client('s3');self.bucket=bucket;self.prefix=prefix.rstrip('/')
    def put(self,data):
        digest=content_key(data);key=f'{digest[:2]}/{digest}.png'
        self.client.put_object(Bucket=self.bucket,Key=f'{self.prefix}/{key}',Body=data,ContentType='image/png',ServerSideEncryption='AES256')
        return key
    def get(self,key):
        if not re.fullmatch(r'[a-f0-9]{2}/[a-f0-9]{64}\.png',key): raise AlignmentError('INVALID_ARTIFACT_KEY')
        return self.client.get_object(Bucket=self.bucket,Key=f'{self.prefix}/{key}')['Body'].read(6_000_001)


class CatalogStore:
    def __init__(self,url,artifacts,max_attempts=3):
        self.url=url;self.artifacts=artifacts;self.mysql=url.startswith('mysql://');self.max_attempts=max_attempts
        if not 1<=max_attempts<=10: raise ValueError('INVALID_ATTEMPT_LIMIT')
        with self.connection() as db:
            self.execute(db,'''CREATE TABLE IF NOT EXISTS vton_annotation_jobs (
                job_key VARCHAR(64) PRIMARY KEY,image_hash VARCHAR(64) NOT NULL,
                model_version VARCHAR(80) NOT NULL,image_key VARCHAR(160) NOT NULL,
                state VARCHAR(20) NOT NULL,attempts INT NOT NULL DEFAULT 0,
                due_at DOUBLE NOT NULL,leased_until DOUBLE NOT NULL DEFAULT 0,
                lease_token VARCHAR(64),error_code VARCHAR(160),result_json MEDIUMTEXT,
                created_at DOUBLE NOT NULL,updated_at DOUBLE NOT NULL)''')
            self.execute(db,'''CREATE TABLE IF NOT EXISTS vton_garments (
                garment_id VARCHAR(80) PRIMARY KEY,job_key VARCHAR(64) NOT NULL,updated_at DOUBLE NOT NULL)''')
            self.execute(db,'''CREATE TABLE IF NOT EXISTS vton_monitor_offsets (
                monitor_id VARCHAR(64) PRIMARY KEY,position BIGINT NOT NULL)''')
            if self.mysql:
                # Independent of catalog cardinality; ready work never requires a table scan.
                present=self.execute(db,"SHOW INDEX FROM vton_annotation_jobs WHERE Key_name='idx_vton_ready'").fetchone()
                if not present:self.execute(db,'CREATE INDEX idx_vton_ready ON vton_annotation_jobs(state,due_at,job_key)')
                present=self.execute(db,"SHOW INDEX FROM vton_annotation_jobs WHERE Key_name='idx_vton_lease'").fetchone()
                if not present:self.execute(db,'CREATE INDEX idx_vton_lease ON vton_annotation_jobs(state,leased_until)')
            else:
                self.execute(db,'CREATE INDEX IF NOT EXISTS idx_vton_ready ON vton_annotation_jobs(state,due_at,job_key)')
                self.execute(db,'CREATE INDEX IF NOT EXISTS idx_vton_lease ON vton_annotation_jobs(state,leased_until)')
            db.commit()
    @contextmanager
    def connection(self):
        db=self._connect()
        try:
            yield db
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()
    def _connect(self):
        if self.mysql:
            import pymysql
            p=urlparse(self.url)
            return pymysql.connect(host=p.hostname,port=p.port or 3306,user=unquote(p.username or ''),password=unquote(p.password or ''),database=p.path.lstrip('/'),charset='utf8mb4',cursorclass=pymysql.cursors.DictCursor,autocommit=False,connect_timeout=5,read_timeout=15,write_timeout=15)
        if not self.url.startswith('sqlite:///'):raise ValueError('EXPECTED_MYSQL_OR_SQLITE_URL')
        db=sqlite3.connect(self.url[len('sqlite:///'):],timeout=15,isolation_level=None);db.row_factory=sqlite3.Row;db.execute('PRAGMA journal_mode=WAL');return db
    def execute(self,db,sql,params=()):
        if self.mysql:
            cursor=db.cursor();cursor.execute(sql.replace('?', '%s'),params);return cursor
        return db.execute(sql,params)
    def begin(self,db):
        if self.mysql:db.begin()
        else:db.execute('BEGIN IMMEDIATE')
    def enqueue(self,garment_id,image,model_version):
        if not re.fullmatch(r'[A-Za-z0-9_:-]{1,80}',garment_id):raise AlignmentError('INVALID_GARMENT_ID')
        canonical=png_bytes(image);digest=content_key(canonical);job_key=content_key(f'{digest}:{model_version}'.encode());image_key=self.artifacts.put(canonical);now=time.time()
        with self.connection() as db:
            self.begin(db)
            verb='INSERT IGNORE' if self.mysql else 'INSERT OR IGNORE'
            self.execute(db,f'''{verb} INTO vton_annotation_jobs(job_key,image_hash,model_version,image_key,state,due_at,created_at,updated_at)
                VALUES(?,?,?,?,'PENDING',?,?,?)''',(job_key,digest,model_version,image_key,now,now,now))
            if self.mysql:self.execute(db,'INSERT INTO vton_garments(garment_id,job_key,updated_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE job_key=VALUES(job_key),updated_at=VALUES(updated_at)',(garment_id,job_key,now))
            else:self.execute(db,'INSERT INTO vton_garments(garment_id,job_key,updated_at) VALUES(?,?,?) ON CONFLICT(garment_id) DO UPDATE SET job_key=excluded.job_key,updated_at=excluded.updated_at',(garment_id,job_key,now))
            row=self.execute(db,'SELECT state FROM vton_annotation_jobs WHERE job_key=?',(job_key,)).fetchone();db.commit();return {'jobKey':job_key,'state':row['state'],'imageHash':digest}
    def claim(self,now=None,lease_seconds=240,model_version=None):
        now=time.time() if now is None else now
        if lease_seconds<90:raise ValueError('LEASE_MUST_EXCEED_MODEL_TIMEOUT')
        with self.connection() as db:
            self.begin(db)
            self.execute(db,"UPDATE vton_annotation_jobs SET state='DEAD',error_code='LEASE_EXHAUSTED',updated_at=? WHERE state='RUNNING' AND leased_until<=? AND attempts>=?",(now,now,self.max_attempts))
            lock=' FOR UPDATE SKIP LOCKED' if self.mysql else ''
            version_clause=" AND model_version=?" if model_version else ""
            params=(self.max_attempts,now,now)+((model_version,) if model_version else ())
            row=self.execute(db,"SELECT * FROM vton_annotation_jobs WHERE attempts<? AND ((state IN ('PENDING','RETRY') AND due_at<=?) OR (state='RUNNING' AND leased_until<=?)) "+version_clause+" ORDER BY due_at,job_key LIMIT 1"+lock,params).fetchone()
            if not row:db.commit();return None
            token=uuid.uuid4().hex
            self.execute(db,"UPDATE vton_annotation_jobs SET state='RUNNING',attempts=attempts+1,leased_until=?,lease_token=?,updated_at=? WHERE job_key=?",(now+lease_seconds,token,now,row['job_key']));db.commit();return {**dict(row),'lease_token':token,'attempts':row['attempts']+1}
    def complete(self,job,annotation):
        result=annotation.model_dump(mode='json');mask=base64.b64decode(result.pop('mask_png'),validate=True);result['mask_key']=self.artifacts.put(mask)
        return self._finish(job,'READY',json.dumps(result),None,0)
    def fail(self,job,error):
        # Store a bounded diagnostic code, never exception text containing photos,
        # tokens, response payloads or provider URLs.
        code=str(error) if isinstance(error,AlignmentError) else type(error).__name__
        code=re.sub(r'[^A-Za-z0-9_:. -]','_',code)[:160]
        state='DEAD' if job['attempts']>=self.max_attempts else 'RETRY'
        return self._finish(job,state,None,code,time.time()+min(3600,5*2**job['attempts']))
    def _finish(self,job,state,result,error,due):
        with self.connection() as db:
            self.begin(db);cursor=self.execute(db,"UPDATE vton_annotation_jobs SET state=?,result_json=?,error_code=?,due_at=?,leased_until=0,updated_at=? WHERE job_key=? AND state='RUNNING' AND lease_token=?",(state,result,error,due,time.time(),job['job_key'],job['lease_token']));accepted=cursor.rowcount==1;db.commit();return accepted
    def get(self,garment_id):
        with self.connection() as db:
            row=self.execute(db,'SELECT j.* FROM vton_garments g JOIN vton_annotation_jobs j ON j.job_key=g.job_key WHERE g.garment_id=?',(garment_id,)).fetchone()
            return dict(row) if row else None
    def annotation(self,row):
        if not row or row['state']!='READY':raise AlignmentError('GARMENT_ANNOTATION_NOT_READY')
        data=json.loads(row['result_json']);data['mask_png']=base64.b64encode(self.artifacts.get(data.pop('mask_key'))).decode();return Annotation.model_validate(data)
    def stats(self):
        with self.connection() as db:return {row['state']:row['n'] for row in self.execute(db,'SELECT state,COUNT(*) AS n FROM vton_annotation_jobs GROUP BY state').fetchall()}
    def offset(self,monitor_id):
        with self.connection() as db:
            row=self.execute(db,'SELECT position FROM vton_monitor_offsets WHERE monitor_id=?',(monitor_id,)).fetchone();return row['position'] if row else 0
    def checkpoint(self,monitor_id,position):
        with self.connection() as db:
            if self.mysql:self.execute(db,'INSERT INTO vton_monitor_offsets VALUES(?,?) ON DUPLICATE KEY UPDATE position=VALUES(position)',(monitor_id,position))
            else:self.execute(db,'INSERT INTO vton_monitor_offsets VALUES(?,?) ON CONFLICT(monitor_id) DO UPDATE SET position=excluded.position',(monitor_id,position))
            db.commit()
