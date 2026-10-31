"""Private object storage (RustFS in the compose stack, or any S3). Originals, masks, PNGs and metadata live under jobs/<id>/."""
from __future__ import annotations

import threading


class ObjectNotFound(KeyError):
    pass


class S3Store:
    def __init__(self, settings):
        import boto3
        from botocore.config import Config

        self.bucket = settings.s3_bucket
        self.retention_days = settings.retention_days
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint or None,
            aws_access_key_id=settings.s3_access_key or None,
            aws_secret_access_key=settings.s3_secret_key or None,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"},
                          connect_timeout=5, read_timeout=60),
        )
        self._ready = False
        self._lock = threading.Lock()

    def prepare(self) -> None:
        """Creates the bucket once and applies the retention lifecycle (images expire, they are not kept forever)."""
        from botocore.exceptions import ClientError

        with self._lock:
            if self._ready:
                return
            try:
                self._client.head_bucket(Bucket=self.bucket)
            except ClientError as exc:
                if str(exc.response.get("Error", {}).get("Code", "")) not in {"404", "NoSuchBucket", "NotFound"}:
                    raise
                self._client.create_bucket(Bucket=self.bucket)
            if self.retention_days > 0:
                self._client.put_bucket_lifecycle_configuration(
                    Bucket=self.bucket,
                    LifecycleConfiguration={"Rules": [{
                        "ID": "fai-job-retention", "Status": "Enabled", "Filter": {"Prefix": "jobs/"},
                        "Expiration": {"Days": self.retention_days},
                    }]},
                )
            self._ready = True

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.prepare()
        self._client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)

    def get(self, key: str) -> bytes:
        from botocore.exceptions import ClientError

        try:
            return self._client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as exc:
            if str(exc.response.get("Error", {}).get("Code", "")) in {"404", "NoSuchKey", "NotFound"}:
                raise ObjectNotFound(key) from exc
            raise

    def delete_prefix(self, prefix: str) -> int:
        removed = 0
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self._client.delete_objects(Bucket=self.bucket, Delete={"Objects": keys, "Quiet": True})
                removed += len(keys)
        return removed

    def list_prefix(self, prefix: str) -> list[str]:
        paginator = self._client.get_paginator("list_objects_v2")
        return [o["Key"] for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix) for o in page.get("Contents", [])]

    def ping(self) -> bool:
        self.prepare()
        return True


class MemoryStore:
    """In-process store for tests and CPU smoke runs."""

    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}

    def prepare(self) -> None:
        return None

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = (bytes(content), content_type)

    def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise ObjectNotFound(key)
        return self.objects[key][0]

    def delete_prefix(self, prefix: str) -> int:
        keys = [k for k in self.objects if k.startswith(prefix)]
        for k in keys:
            del self.objects[k]
        return len(keys)

    def list_prefix(self, prefix: str) -> list[str]:
        return sorted(k for k in self.objects if k.startswith(prefix))

    def ping(self) -> bool:
        return True
