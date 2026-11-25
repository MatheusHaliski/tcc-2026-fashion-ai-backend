"""Download das fotos do catálogo com educação: um ritmo por site (o VTEX devolve 429 a quem corre), nova tentativa
com espera crescente, endereço com espaço e acento escapado, e cache em disco pelo hash do endereço.
"""
from __future__ import annotations

import hashlib
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MIN_GAP = 0.5        # s entre dois pedidos ao mesmo site
MAX_GAP = 8.0
TRIES = 4
MAX_BYTES = 25_000_000


def quoted(url: str) -> str:
    """Escapa espaço, acento e o que mais não for de URL, sem escapar duas vezes o que já veio escapado."""
    parts = urllib.parse.urlsplit(url.strip())
    path = urllib.parse.quote(parts.path, safe="/%:@!$&'()*+,;=-._~")
    query = urllib.parse.quote(parts.query, safe="=&%:/?+,;-._~")
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, query, ""))


class Pacer:
    """Intervalo mínimo entre pedidos a cada site; dobra a cada 429 e volta devagar a cada acerto."""

    def __init__(self):
        self.lock = threading.Lock()
        self.next_at: dict[str, float] = {}
        self.gap: dict[str, float] = {}

    def wait(self, host: str) -> None:
        with self.lock:
            now = time.monotonic()
            at = max(now, self.next_at.get(host, 0.0))
            self.next_at[host] = at + self.gap.get(host, MIN_GAP)
        time.sleep(max(0.0, at - now))

    def slower(self, host: str) -> None:
        with self.lock:
            self.gap[host] = min(MAX_GAP, self.gap.get(host, MIN_GAP) * 2)

    def faster(self, host: str) -> None:
        with self.lock:
            self.gap[host] = max(MIN_GAP, self.gap.get(host, MIN_GAP) * 0.9)


PACER = Pacer()


def fetch(url: str, cache: Path, pacer: Pacer = PACER, opener=urllib.request.urlopen) -> tuple[Path | None, str]:
    """Baixa (ou pega do cache) e devolve (arquivo, situação): "ok", "cache", "http_404"…"""
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]
    if target.is_file() and target.stat().st_size > 0:
        return target, "cache"
    safe = quoted(url)
    host = urllib.parse.urlsplit(safe).netloc
    status = "erro"
    for attempt in range(TRIES):
        pacer.wait(host)
        try:
            req = urllib.request.Request(safe, headers={"User-Agent": AGENT, "Accept": "image/*,*/*;q=0.8"})
            with opener(req, timeout=30) as resp:
                data = resp.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES or len(data) < 500:
                return None, "tamanho"
            tmp = target.with_suffix(".tmp")
            tmp.write_bytes(data)
            tmp.replace(target)
            pacer.faster(host)
            return target, "ok"
        except urllib.error.HTTPError as e:
            status = f"http_{e.code}"
            if e.code in (429, 500, 502, 503, 504):
                pacer.slower(host)
                time.sleep(min(30.0, 2.0 * 2 ** attempt))
                continue
            return None, status
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            status = f"rede_{type(e).__name__}"
            time.sleep(1.5 * (attempt + 1))
    return None, status
