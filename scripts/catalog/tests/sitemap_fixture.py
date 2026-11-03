"""Fixtures compartilhadas dos testes do coletor oficial: páginas JSON-LD, sitemaps e índice de exemplo, um fetch
falso que registra as chamadas e uma polidez com relógio simulado."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

from normalize_product import Normalizer  # noqa: E402
from providers.official_sitemap import Politeness  # noqa: E402

N = Normalizer()
HTML = "text/html; charset=utf-8"
XML = "application/xml"


def ld(obj) -> bytes:
    return f'<html><head><script type="application/ld+json">{json.dumps(obj)}</script></head><body></body></html>'.encode()


def urlset(*urls) -> bytes:
    body = "".join(f"<url><loc>{u}</loc></url>" for u in urls)
    return f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'.encode()


def index(*maps) -> bytes:
    body = "".join(f"<sitemap><loc>{u}</loc></sitemap>" for u in maps)
    return f'<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</sitemapindex>'.encode()


class FakeWeb:
    def __init__(self, pages: dict):
        self.pages, self.calls = pages, []

    def __call__(self, url):
        self.calls.append(url)
        return self.pages.get(url, (404, b"", "text/plain"))


def polite():
    t = [0.0]
    slept = []

    def sleep(s):
        slept.append(s)
        t[0] += s
    return Politeness(min_interval=1.0, sleep=sleep, clock=lambda: t[0]), slept


TEE = {"@context": "https://schema.org", "@type": "Product", "name": "Camiseta Listras Off-White", "brand": {"@type": "Brand", "name": "Nike"},
       "sku": "NK-1", "gtin13": "7891234567895", "color": "Off-White", "description": "Camiseta de algodão com listras.",
       "image": ["https://static.nike.com/a/1.jpg", "https://cdn.pinimg.com/x.jpg"], "offers": {"url": "https://www.nike.com.br/p/nk-1"}}
