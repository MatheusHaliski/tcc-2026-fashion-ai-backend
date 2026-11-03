"""Download da foto do lote local: link direto ou página HTML (og:image), polidez por host com disjuntor e abertura da
imagem para análise."""
from __future__ import annotations

import html as html_lib
import io
import re
import time
from typing import Callable, Optional
from urllib.parse import urljoin, urlsplit

from PIL import Image, ImageOps, UnidentifiedImageError

from photo_set import MAX_ANALYSIS_SIDE, MAX_INPUT_PIXELS
from local_sd_base import IMAGE_EXT, MAX_BYTES, MIN_SIDE, UA, PhotoSkip

# ───────────────────────── download: link direto ou página HTML (og:image)

Fetch = Callable[[str], tuple[int, bytes, str]]
_META = re.compile(r"<meta\b[^>]*>", re.I)
_ATTR = re.compile(r"""([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""")


def og_image(page: bytes, page_url: str) -> Optional[str]:
    """`og:image` (ou `og:image:secure_url`, `twitter:image`) da página; só http(s), resolvido contra a página."""
    text = page.decode("utf-8", "replace")
    found = {}
    for tag in _META.findall(text):
        attrs = {m.group(1).lower(): next(g for g in m.groups()[1:] if g is not None) for m in _ATTR.finditer(tag)}
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in ("og:image:secure_url", "og:image", "twitter:image") and attrs.get("content"):
            found.setdefault(key, html_lib.unescape(attrs["content"]).strip())
    for key in ("og:image:secure_url", "og:image", "twitter:image"):
        url = found.get(key)
        if url:
            url = urljoin(page_url, "https:" + url if url.startswith("//") else url)
            if urlsplit(url).scheme in ("http", "https"):
                return url
    return None


HOST_PAUSED = "host-paused"                 # "content-type" sintético: o host pediu para parar e não foi mais consultado


def polite_fetch(fetch: Fetch, min_interval: float = 1.0, retries: int = 2, sleep=time.sleep, clock=time.monotonic,
                 host_limit: int = 3) -> Fetch:
    """Polidez por host (os CDNs das lojas — vtexassets.com — devolvem 429 a quem baixa em rajada) e espera em 429/503:
    respeita Retry-After quando vem, senão 5 s, até `retries` vezes; depois devolve o status para virar RETRY no relatório.
    Disjuntor por host (a regra do coletor, "o site pediu para parar"): depois de `host_limit` URLs seguidas em que o host
    terminou em 429/503 mesmo após as esperas, as próximas URLs dele voltam 429 sem pedido algum; um 200 zera a conta; 0 desliga."""
    last: dict[str, float] = {}
    strikes: dict[str, int] = {}

    def fetch_polite(url: str) -> tuple[int, bytes, str]:
        host = urlsplit(url).hostname or ""
        if host_limit and strikes.get(host, 0) >= host_limit:
            return 429, b"", HOST_PAUSED
        for attempt in range(retries + 1):
            wait = last.get(host, -1e9) + min_interval - clock()
            if wait > 0:
                sleep(wait)
            last[host] = clock()
            status, body, ctype = fetch(url)
            if status not in (429, 503) or attempt == retries:
                strikes[host] = strikes.get(host, 0) + 1 if status in (429, 503) else 0
                return status, body, ctype
            retry_after = ctype if isinstance(ctype, str) and ctype.startswith("retry-after:") else ""
            try:
                pause = float(retry_after.split(":", 1)[1]) if retry_after else 5.0
            except ValueError:
                pause = 5.0
            sleep(min(max(pause, 1.0), 60.0))
        return status, body, ctype                                  # pragma: no cover

    return fetch_polite


def requests_fetch(timeout: float = 20, min_interval: float = 1.0, host_limit: int = 3) -> Fetch:
    """fetch(url) -> (status, corpo até MAX_BYTES, content-type) com requests, polidez por host e espera em 429.
    Em 429/503 o "content-type" devolvido é "retry-after:<s>" para o polite_fetch saber quanto esperar."""
    import requests

    def fetch(url: str) -> tuple[int, bytes, str]:
        with requests.get(url, headers={"User-Agent": UA, "Accept": "image/*,text/html;q=0.9,*/*;q=0.5"},
                          timeout=timeout, stream=True) as r:
            if r.status_code in (429, 503):
                return r.status_code, b"", "retry-after:" + (r.headers.get("Retry-After") or "")
            data = bytearray()
            for chunk in r.iter_content(64 * 1024):
                data.extend(chunk)
                if len(data) > MAX_BYTES:
                    raise PhotoSkip("IMAGE_TOO_LARGE", "REJECTED")
            return r.status_code, bytes(data), r.headers.get("Content-Type", "")
    return polite_fetch(fetch, min_interval, host_limit=host_limit)


def resolve_image(url: str, fetch: Fetch) -> tuple[bytes, str]:
    """Bytes da imagem: a própria URL se for imagem; página HTML → og:image → imagem. (status, url final)."""
    if not url or urlsplit(url).scheme not in ("http", "https"):
        raise PhotoSkip("INVALID_IMAGE_URL", "REJECTED")
    status, body, ctype = fetch(url)
    if status in (403, 429):
        raise PhotoSkip(f"HTTP_{status}" + ("_HOST_PAUSED" if ctype == HOST_PAUSED else ""), "RETRY")
    if status != 200:
        raise PhotoSkip(f"HTTP_{status}", "RETRY" if status >= 500 else "REJECTED")
    kind = (ctype or "").split(";")[0].strip().lower()
    if kind.startswith("image/") or (not kind and urlsplit(url).path.lower().endswith(IMAGE_EXT)):
        return body, url
    if "html" in kind or body[:512].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        direct = og_image(body, url)
        if not direct:
            raise PhotoSkip("NO_OG_IMAGE", "REJECTED")
        status, body, ctype = fetch(direct)
        if status != 200 or not (ctype or "").lower().startswith("image/"):
            raise PhotoSkip("OG_IMAGE_UNAVAILABLE", "RETRY" if status >= 500 else "REJECTED")
        return body, direct
    raise PhotoSkip("NOT_AN_IMAGE", "REJECTED")


def open_image(data: bytes) -> tuple[Image.Image, tuple[int, int]]:
    """Imagem RGB orientada pelo EXIF e reduzida para análise; devolve também o tamanho original."""
    try:
        with Image.open(io.BytesIO(data)) as raw:
            if raw.width * raw.height > MAX_INPUT_PIXELS:
                raise PhotoSkip("IMAGE_TOO_LARGE", "REJECTED")
            if min(raw.size) < MIN_SIDE:
                raise PhotoSkip("BELOW_MINIMUM_300X300", "REJECTED")
            image = ImageOps.exif_transpose(raw).convert("RGB")
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise PhotoSkip("CORRUPT_IMAGE", "REJECTED") from None
    original = image.size
    image.thumbnail((MAX_ANALYSIS_SIDE, MAX_ANALYSIS_SIDE), Image.Resampling.LANCZOS)
    return image, original
