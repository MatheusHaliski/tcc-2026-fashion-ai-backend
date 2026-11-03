"""Download das fotos do catálogo: só HTTPS público (sem credenciais, sem host interno), redirecionamento conferido
contra os domínios autorizados e um ImageDownloader que deduplica e para domínio bloqueado ou proxy recusado."""
from __future__ import annotations

import hashlib
import ipaddress
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024  # Mesmo ImageOps.MAX_UPLOAD_BYTES da API Java.


class DownloadFailure(RuntimeError):
    pass


def public_image_url(url: str) -> str:
    """Reject credentials, non-HTTPS sources, and local/internal addresses."""
    try:
        parts = urllib.parse.urlsplit(url)
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
            raise DownloadFailure("UNSAFE_IMAGE_URL")
        if parts.port not in (None, 443):
            raise DownloadFailure("UNSAFE_IMAGE_PORT")
        addresses = socket.getaddrinfo(parts.hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
            raise DownloadFailure("NON_PUBLIC_IMAGE_HOST")
    except (ValueError, socket.gaierror) as error:
        raise DownloadFailure("IMAGE_HOST_UNAVAILABLE") from error
    return url


def authorize_download(url, allowed_domains):
    if allowed_domains is None:
        return
    from source_persistence import image_hostname, matches
    host = image_hostname(url)
    if not any(matches(host, domain) for domain in allowed_domains):
        raise DownloadFailure("REDIRECT_OR_HOST_UNAUTHORIZED")


class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_domains=None):
        super().__init__()
        self.allowed_domains = allowed_domains

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_image_url(newurl)
        authorize_download(newurl, self.allowed_domains)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ImageDownloader:
    """Deduplicate downloads; stop a blocked domain and a rejected CONNECT proxy."""
    def __init__(self, directory: Path, *, timeout=25, min_interval=.5):
        self.directory = directory
        self.timeout = timeout
        self.min_interval = min_interval
        self.lock = threading.Lock()
        self.domain_locks = {}
        self.last_request = {}
        self.stopped_domains = {}
        self.proxy_blocked = False
        self.final_urls = {}

    def get(self, url: str, *, allowed_domains=None) -> Path:
        authorize_download(url, allowed_domains)
        host = urllib.parse.urlsplit(url).hostname or ""
        key = hashlib.sha256(url.encode()).hexdigest()
        path = self.directory / (key + ".img")
        with self.lock:
            domain_lock = self.domain_locks.setdefault(host, threading.Lock())
        with domain_lock:
            if self.proxy_blocked:
                raise DownloadFailure("NETWORK_PROXY_BLOCKED")
            if host in self.stopped_domains:
                raise DownloadFailure(self.stopped_domains[host])
            try:
                public_image_url(url)
            except DownloadFailure as error:
                if str(error) == "IMAGE_HOST_UNAVAILABLE":
                    self.stopped_domains[host] = str(error)
                raise
            if path.exists() and 0 < path.stat().st_size <= MAX_BYTES:
                authorize_download(self.final_urls.get(str(path), url), allowed_domains)
                return path
            for attempt in range(3):
                delay = self.min_interval - (time.monotonic() - self.last_request.get(host, 0))
                if delay > 0:
                    time.sleep(delay)
                self.last_request[host] = time.monotonic()
                request = urllib.request.Request(url, headers={
                    "User-Agent": "FashionAI-catalog-image-pipeline/4.0",
                    "Accept": "image/*", "Accept-Encoding": "identity",
                })
                try:
                    opener = urllib.request.build_opener(CheckedRedirect(allowed_domains))
                    with opener.open(request, timeout=self.timeout) as response:
                        public_image_url(response.geturl())
                        authorize_download(response.geturl(), allowed_domains)
                        self.final_urls[str(path)] = response.geturl()
                        if response.headers.get_content_maintype() != "image":
                            raise DownloadFailure("NOT_AN_IMAGE")
                        if int(response.headers.get("Content-Length", "0")) > MAX_BYTES:
                            raise DownloadFailure("IMAGE_TOO_LARGE")
                        body = response.read(MAX_BYTES + 1)
                    if not body or len(body) > MAX_BYTES:
                        raise DownloadFailure("IMAGE_TOO_LARGE_OR_EMPTY")
                    temp = path.with_suffix(".tmp")
                    temp.write_bytes(body)
                    temp.replace(path)
                    return path
                except urllib.error.HTTPError as error:
                    if error.code in (403, 429):
                        self.stopped_domains[host] = f"IMAGE_DOMAIN_BLOCKED_{error.code}"
                    if error.code >= 500 and attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    raise DownloadFailure(f"IMAGE_HTTP_{error.code}") from error
                except (urllib.error.URLError, TimeoutError, OSError) as error:
                    # A proxy's CONNECT rejection applies to the execution environment,
                    # not to each of the thousands of product photos individually.
                    reason = str(getattr(error, "reason", ""))
                    if "Tunnel connection failed: 403" in reason or "CONNECT tunnel failed" in reason:
                        self.proxy_blocked = True
                        raise DownloadFailure("NETWORK_PROXY_BLOCKED") from error
                    if attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    raise DownloadFailure("IMAGE_DOWNLOAD_UNAVAILABLE") from error
            raise DownloadFailure("IMAGE_DOWNLOAD_UNAVAILABLE")
