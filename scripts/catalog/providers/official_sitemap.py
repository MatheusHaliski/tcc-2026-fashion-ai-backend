"""RF47 · Coletor de produtos dos sites OFICIAIS das marcas (sitemaps + dados estruturados da própria página).

Regras (as mesmas do catálogo — RN47.03/RN47.04):
  * só domínios oficiais/autorizados cadastrados para a marca (catalog_sources / data/catalog/brands.json);
  * robots.txt é lei: URL bloqueada para o nosso User-Agent não é baixada; Crawl-delay é respeitado (e nunca menos
    que o intervalo mínimo configurado);
  * só dados ESTRUTURADOS que a marca publica para buscadores: JSON-LD schema.org Product/ProductGroup e, na falta,
    OpenGraph — nada de raspar HTML livre;
  * a página de origem fica gravada (official_product_url); imagem só do domínio oficial ou do CDN da marca, e entra
    como referência (REFERENCE_ONLY) salvo autorização da fonte;
  * sem subtipo reconhecível pela taxonomia, o item é descartado (nunca chutado);
  * 403/429 do site = o coletor para naquele domínio (sem insistir).
O módulo não faz rede por conta própria: recebe um `fetch(url) -> (status, bytes, content_type)` — os testes usam
páginas de exemplo e o CLI (collect_official.py) usa urllib com proxy do ambiente.
"""
from __future__ import annotations

from typing import Callable, Iterable, Optional

# Fachada: o percurso (collect) fica aqui; site/robots, URLs, sitemaps e categorias, dados estruturados, taxonomia e
# item do catálogo em sitemap_*.py. Os nomes de antes continuam importáveis deste módulo (collect_official,
# enrich_images, recheck_collected e os testes).
from normalize_product import Normalizer, domain, key  # noqa: F401
from validate_source import blocked, same_site  # noqa: F401
from .sitemap_site import DEFAULT_UA, Fetch, Politeness, Site, StopDomain, looks_like_html  # noqa: F401
from .sitemap_urls import (CATEGORY_HINTS, LOCALE_HINTS, MAX_CATEGORY_PAGES, MAX_CATEGORY_QUEUE, MAX_LINKS_PER_PAGE,  # noqa: F401
                           PRODUCT_HINTS, PRODUCT_SITEMAP_HINTS, SKIP_SITEMAP_HINTS, _sitemap_rank, _sku_like, is_sitemap_file,
                           looks_like_category, looks_like_product, looks_like_product_leaf, page_links)
from .sitemap_crawl import _locs, _xml, crawl_categories, product_urls  # noqa: F401
from .sitemap_structured import _images, _ld_json, _metas, _text, _types, _walk, structured_product  # noqa: F401
from .sitemap_taxonomy import (ENGLISH_HINTS, MODIFIERS, UNSUPPORTED, _squash, clean_title, infer_subcategory,  # noqa: F401
                               is_pack, same_brand, unsupported_reason)
from .sitemap_item import STORE_IMAGE_HOSTS, _gtin, brand_cdn_ok, product_images, to_catalog_item  # noqa: F401

GIVE_UP_AFTER = 150


def collect(site: Site, brand: str, source_type: str, n: Normalizer, max_products: int, product_patterns=PRODUCT_HINTS,
            sitemap_patterns=(), visited: Optional[set] = None, warnings: Optional[list] = None,
            on_item: Optional[Callable[[dict], None]] = None, give_up_after: int = GIVE_UP_AFTER,
            page_brands: Iterable[str] = (), image_hosts: Iterable[str] = ()) -> dict:
    """Percorre o domínio oficial e devolve um relatório; cada produto aceito vai para on_item (JSONL no CLI).
    Após `give_up_after` páginas seguidas sem dados estruturados de produto, larga o domínio: o site não publica
    JSON-LD/OpenGraph e insistir só gasta requisições dele."""
    visited = visited if visited is not None else set()
    misses = 0
    warnings = warnings if warnings is not None else []
    report = {"domain": site.domain, "pages": 0, "accepted": 0, "skipped": 0, "blocked_by_robots": 0, "stopped": None, "crawled_categories": 0}
    categories: list[str] = []
    done = lambda: report["accepted"] >= max_products

    def visit(url: str) -> Optional[bool]:
        """Uma URL candidata: True = produto aceito, False = descartada, None = não baixada (já vista ou robots)."""
        nonlocal misses
        if url in visited:
            return None
        visited.add(url)
        if not site.allowed(url):
            report["blocked_by_robots"] += 1
            return None
        status, body, ctype = site.get(url)
        report["pages"] += 1
        if status != 200 or "html" not in (ctype or "text/html"):
            report["skipped"] += 1
            return False
        found = structured_product(body)
        item = to_catalog_item(found, url, brand, site.domain, source_type, n, warnings, page_brands, image_hosts) if found else None
        misses = 0 if found else misses + 1
        if not item:
            if not found:
                warnings.append(f"{url}: sem dados estruturados de produto (JSON-LD/OpenGraph)")
            report["skipped"] += 1
            if give_up_after and misses >= give_up_after:
                raise StopDomain(f"{site.domain}: {misses} páginas seguidas sem dados estruturados de produto")
            return False
        report["accepted"] += 1
        if on_item:
            on_item(item)
        return True

    try:
        site.load_robots()
        for url in product_urls(site, product_patterns, sitemap_patterns, category_sink=categories):
            if done():
                break
            visit(url)
        if report["accepted"] == 0 and not done():
            crawl_categories(site, categories, visit, done, product_patterns, report)
    except StopDomain as e:
        report["stopped"] = str(e)
    return report
