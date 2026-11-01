"""Catalogue source for the GPU batch: READ-ONLY MySQL access (same MYSQL_* variables as the Java backend) and a
bounded image downloader. Nothing here writes to the database."""
from __future__ import annotations

import io
import ipaddress
import os
import socket
import urllib.request
from urllib.parse import quote, urlparse, urlunparse

from PIL import Image, ImageOps

MAX_IMAGE_BYTES = 15 * 1024 * 1024
UPLOAD_FORMATS = {"JPEG", "PNG", "WEBP"}      # what the GPU API accepts
UPLOAD_MAX_PIXELS = 12_000_000                # below the API's 16 MP cap; Phase 1 works at ~1 MP anyway
CATEGORY_MAP = {"upper_piece": "upper_piece", "lower_piece": "lower_piece", "shoes_piece": "shoes_piece",
                "accessory_piece": "accessory_piece", "full_body_piece": "auto"}

# One photo per product: the primary image first, then the oldest non-rejected one. The sample is deterministic
# (SHA2 of the id) so a rerun of the pilot sees the same products; --offset walks the whole catalogue in pages.
SELECT = """
SELECT id, category, subcategory, product_name, color, image_url FROM (
  SELECT p.id, p.category, p.subcategory, p.product_name, COALESCE(p.color_name, p.color) AS color,
         COALESCE(i.stored_url, i.image_url) AS image_url,
         ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY i.is_primary DESC, i.created_at ASC) AS rn,
         SHA2(p.id, 256) AS sample_key
    FROM catalog_products p JOIN catalog_images i ON i.product_id = p.id
   WHERE i.usage_status <> 'REJECTED' {category}
) ranked WHERE rn = 1 ORDER BY {order} LIMIT %(limit)s OFFSET %(offset)s
"""


def connect():
    import pymysql
    import pymysql.cursors

    password = os.environ.get("MYSQL_PASSWORD")
    if not password:
        raise SystemExit("MYSQL_PASSWORD não definida (mesmas variáveis MYSQL_* do backend)")
    ssl = {"ssl": {}} if os.environ.get("MYSQL_SSL_MODE", "").upper() in {"REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"} else {}
    conn = pymysql.connect(host=os.environ.get("MYSQL_HOST", "localhost"), port=int(os.environ.get("MYSQL_PORT", "3306")),
                           user=os.environ.get("MYSQL_USER", "fashionai"), password=password,
                           database=os.environ.get("MYSQL_DATABASE", "fashionai"), charset="utf8mb4",
                           cursorclass=pymysql.cursors.DictCursor, connect_timeout=10, read_timeout=120, **ssl)
    with conn.cursor() as cur:
        cur.execute("SET SESSION TRANSACTION READ ONLY")
    return conn


def describe_target() -> str:
    return f"{os.environ.get('MYSQL_HOST', 'localhost')}:{os.environ.get('MYSQL_PORT', '3306')}/{os.environ.get('MYSQL_DATABASE', 'fashionai')}"


def fetch_products(conn, limit: int, offset: int = 0, category: str | None = None, sample: bool = True) -> list[dict]:
    sql = SELECT.format(category="AND p.category = %(category)s" if category else "",
                        order="sample_key" if sample else "id")
    with conn.cursor() as cur:
        cur.execute(sql, {"limit": limit, "offset": offset, "category": category})
        return list(cur.fetchall())


def count_products(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM catalog_products")
        return int(cur.fetchone()["n"])


def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    return all(ipaddress.ip_address(info[4][0]).is_global for info in infos)


def download(url: str, timeout: int = 30, opener=None) -> bytes:
    """https/http only, public hosts only (no SSRF into the VM's private network), size-capped."""
    parsed = urlparse(url or "")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("URL_INVALIDA")
    if opener is None and not _public_host(parsed.hostname):
        raise ValueError("HOST_NAO_PUBLICO")
    # catalogue URLs carry accents and other non-ASCII characters; urllib needs them percent-encoded
    safe = urlunparse(parsed._replace(path=quote(parsed.path, safe="/%"),
                                      query=quote(parsed.query, safe="=&%+"),
                                      fragment=""))
    request = urllib.request.Request(safe, headers={"User-Agent": "FashionAI-catalog-batch/1.0"})
    with (opener or urllib.request.urlopen)(request, timeout=timeout) as response:
        data = response.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("IMAGEM_GRANDE_DEMAIS")
    if not data:
        raise ValueError("DOWNLOAD_VAZIO")
    return data


def prepare_upload(data: bytes, max_pixels: int = UPLOAD_MAX_PIXELS) -> bytes:
    """Catalogue photos come in any size and format (AVIF, GIF, 40 MP JPEGs). The API refuses them, so the batch
    sends a JPEG/PNG/WEBP of at most `max_pixels`, upright. Photos already within the contract go untouched."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            fmt, width, height = image.format, image.width, image.height
            if fmt in UPLOAD_FORMATS and width * height <= max_pixels:
                return data
            image = ImageOps.exif_transpose(image)
            scale = min(1.0, (max_pixels / (width * height)) ** 0.5)
            if scale < 1.0:
                image = image.resize((max(1, int(width * scale)), max(1, int(height * scale))),
                                     Image.Resampling.LANCZOS)
            alpha = image.mode in {"RGBA", "LA", "PA"} or "transparency" in image.info
            out = io.BytesIO()
            if alpha:
                image.convert("RGBA").save(out, "PNG", optimize=True)
            else:
                image.convert("RGB").save(out, "JPEG", quality=92)
            return out.getvalue()
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValueError(f"FORMATO_NAO_SUPORTADO: {exc}") from exc
