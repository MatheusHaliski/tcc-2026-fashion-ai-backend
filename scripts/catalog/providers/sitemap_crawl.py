"""Percurso do coletor oficial pelo site: sitemaps (índices aninhados, urlset com sitemaps, .xml.gz) e, quando eles
não rendem produto, as páginas de categoria."""
from __future__ import annotations

import gzip
import xml.etree.ElementTree as ET
from typing import Callable, Iterable, Iterator, Optional

from normalize_product import domain
from validate_source import blocked, same_site

from .sitemap_site import Site, looks_like_html
from .sitemap_urls import (MAX_CATEGORY_PAGES, MAX_CATEGORY_QUEUE, MAX_LINKS_PER_PAGE, PRODUCT_HINTS, _sitemap_rank,
                           is_sitemap_file, looks_like_category, looks_like_product, looks_like_product_leaf, page_links)

# ───────────────────────── sitemaps

def _xml(body: bytes) -> Optional[ET.Element]:
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    try:
        return ET.fromstring(body)
    except ET.ParseError:
        return None


def _locs(root: ET.Element, tag: str) -> list[str]:
    """<loc> de cada filho <tag> (url/sitemap), com ou sem namespace."""
    return [loc.text.strip() for parent in root if parent.tag.endswith(tag)
            for loc in parent if loc.tag.endswith("loc") and loc.text and loc.text.strip()]


def product_urls(site: Site, product_patterns: Iterable[str] = PRODUCT_HINTS, sitemap_patterns: Iterable[str] = (),
                 max_sitemaps: int = 60, category_sink: Optional[list] = None) -> Iterator[str]:
    """URLs de produto a partir dos sitemaps do robots.txt (índices aninhados e .xml.gz). Sitemaps de produto (e do
    Brasil/EUA) são lidos antes; sitemaps de ajuda, blog e lojas físicas ficam de fora. Num sitemap de produto, toda URL
    do domínio conta como produto; nos demais, só as que parecem página de produto."""
    extra = tuple(p.lower() for p in sitemap_patterns)
    queue, seen, read = [u for u in site.sitemaps if _sitemap_rank(u, extra) < 20], set(), 0
    product_patterns = tuple(product_patterns)
    while queue and read < max_sitemaps:
        queue.sort(key=lambda u: _sitemap_rank(u, extra))
        sm = queue.pop(0)
        if sm in seen:
            continue
        seen.add(sm)
        status, body, _ = site.get(sm)
        read += 1
        root = _xml(body) if status == 200 else None
        if root is None:
            continue
        if root.tag.endswith("sitemapindex"):
            queue.extend(c for c in _locs(root, "sitemap") if c not in seen and _sitemap_rank(c, extra) < 20)
        else:
            product_map = _sitemap_rank(sm, extra) <= -10
            for url in _locs(root, "url"):
                if not same_site(domain(url), site.domain) or blocked(url):
                    continue
                if is_sitemap_file(url):                          # sitemap dentro de urlset: lido como índice
                    if url not in seen and _sitemap_rank(url, extra) < 20:
                        queue.append(url)
                elif product_map or looks_like_product(url, product_patterns):
                    yield url
                elif category_sink is not None and len(category_sink) < MAX_CATEGORY_QUEUE and looks_like_category(url) and url not in category_sink:
                    category_sink.append(url)                     # guardada para a busca por páginas de categoria


def crawl_categories(site: Site, categories: list[str], visit: Callable[[str], Optional[bool]], done: Callable[[], bool],
                     product_patterns: Iterable[str], report: dict, max_pages: int = MAX_CATEGORY_PAGES, max_links: int = MAX_LINKS_PER_PAGE):
    """Busca melhorada: quando os sitemaps não rendem produto (só categorias, como C&A/Balenciaga/Birkenstock, ou nenhum
    sitemap, como Patagonia), lê páginas de categoria — as vistas nos sitemaps ou, sem elas, a página inicial — e segue
    os links de produto delas. Mesmas regras de sempre: robots.txt, nunca sai do domínio, cada página de produto passa
    pelos dados estruturados e conta no limite de páginas sem dados. Lojas sem pista na URL (Magento: /chuck-70-…) usam
    os links "folha" da página que não parecem categoria."""
    queue = list(dict.fromkeys(categories)) or [site.base + "/"]
    # só o host da loja (www.cea.com.br e cea.com.br): um link para blog./ajuda./carreiras. da mesma marca não é a loja,
    # e um 403 lá encerraria o domínio inteiro
    shop_hosts = {domain(site.base), site.domain, "www." + site.domain}
    own = lambda u: (domain(u) or "") in shop_hosts
    seen: set[str] = set()
    crawled = 0
    while queue and crawled < max_pages and not done():
        page = queue.pop(0)
        if page in seen:
            continue
        seen.add(page)
        if not site.allowed(page):
            report["blocked_by_robots"] += 1
            continue
        status, body, ctype = site.get(page)
        crawled += 1
        if status != 200 or not (("html" in (ctype or "")) or looks_like_html(body, ctype)):
            continue
        links = [u for u in page_links(body, page) if own(u) and not blocked(u) and u != page]
        products = [u for u in links if looks_like_product(u, product_patterns)]
        if not products:
            products = [u for u in links if looks_like_product_leaf(u)]
        for u in products[:max_links]:
            if done():
                break
            visit(u)
        for u in links:
            if looks_like_category(u) and u not in seen and u not in queue and len(queue) < MAX_CATEGORY_QUEUE:
                queue.append(u)
    report["crawled_categories"] = crawled
