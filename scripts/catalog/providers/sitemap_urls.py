"""Classificação de URLs do coletor oficial, sem rede: página de produto, arquivo de sitemap, ordem de leitura dos
sitemaps, links de uma página e páginas de categoria."""
from __future__ import annotations

import html
import re
import urllib.parse
from typing import Iterable
from urllib.parse import urljoin

# "re:/p$": página de produto VTEX (/nome-da-peca-1082857/p — C&A, Renner, Hering) sem barra final
PRODUCT_HINTS = ("product", "produto", "/p/", "/t/", "/pd/", "/item", "-p-", "/prod", "re:/p$")


def looks_like_product(url: str, patterns: Iterable[str] = PRODUCT_HINTS) -> bool:
    """Trecho da URL (sem caixa) ou, com o prefixo "re:", expressão regular sobre a URL original — para lojas cuja
    página de produto só se reconhece pelo formato (Guess: /en-us/…/<código>-<cor>.html)."""
    u = url.lower()
    return any(re.search(p[3:], url) if p.startswith("re:") else p.lower() in u for p in patterns)


def is_sitemap_file(url: str) -> bool:
    """Arquivo de sitemap listado como <url> comum (Diesel e Carhartt WIP põem os sitemaps de cada país num urlset)."""
    path = urllib.parse.urlsplit(url).path.lower()
    return path.endswith((".xml", ".xml.gz"))


PRODUCT_SITEMAP_HINTS = ("product", "produto", "pdp", "prod", "item", "sku", "catalog")
SKIP_SITEMAP_HINTS = ("help", "ajuda", "article", "blog", "news", "locator", "store-", "stores", "lojas", "landing",
                      "editorial", "journal", "story", "stories", "video", "image", "press", "career", "faq", "bfcm")
LOCALE_HINTS = ("pt-br", "pt_br", "/br/", "-br.", "_br.", "en-us", "en_us", "/us/", "-us.", "_us.")


def _sitemap_rank(url: str, extra: tuple) -> int:
    """Ordem de leitura: sitemap de produto do Brasil/EUA primeiro; ajuda, blog, lojas físicas etc. por último."""
    # só o caminho conta: o domínio da marca não diz nada sobre o sitemap ("lojasrenner.com.br" tem "lojas" e era
    # descartado inteiro como sitemap de lojas físicas)
    parts = urllib.parse.urlsplit(url)
    u = (parts.path + ("?" + parts.query if parts.query else "")).lower().replace("sitemap", "")  # "s-item-ap" não é sitemap de item
    rank = 0
    if any(p in u for p in (*extra, *PRODUCT_SITEMAP_HINTS)):
        rank -= 10
    if any(p in u for p in LOCALE_HINTS):
        rank -= 3
    if any(p in u for p in SKIP_SITEMAP_HINTS):
        rank += 20
    return rank


# ───────────────────────── busca melhorada: páginas de categoria

_HREF = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""", re.I | re.S)
CATEGORY_HINTS = ("categor", "collection", "colecao", "coleção", "/c/", "-c/", "/women", "/men", "/mulher", "/homem", "/feminino",
                  "/masculino", "/kids", "/infantil", "/shop/", "/loja/", "department", "departamento", "/roupas", "/clothing",
                  "/calcados", "/shoes", "/sapatos", "/tenis", "/acessorios", "/accessories", "/new", "/novidades", "/sale")
MAX_CATEGORY_QUEUE = 500
MAX_CATEGORY_PAGES = 40
MAX_LINKS_PER_PAGE = 60


def page_links(page: bytes, base_url: str) -> list[str]:
    """Links <a href> da página, resolvidos contra ela: só http(s), sem #fragmento, sem repetição, na ordem da página."""
    text = page.decode("utf-8", "replace")
    out: list[str] = []
    seen: set[str] = set()
    for m in _HREF.finditer(text):
        raw = html.unescape(next(g for g in m.groups() if g is not None)).strip()
        if not raw or raw.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        url = urljoin(base_url, raw).split("#")[0]
        if url.startswith(("http://", "https://")) and url not in seen:
            seen.add(url)
            out.append(url)
    return out


_SKU_SEGMENT = re.compile(r"[a-z0-9]*\d{5,}[a-z0-9]*", re.I)


def _sku_like(last_segment: str) -> bool:
    """Último segmento com um código de 5+ dígitos (802177WBFC12200, 0043104999, ct35630001): é produto, não categoria."""
    stem = last_segment[:-5] if last_segment.lower().endswith(".html") else last_segment
    return any(_SKU_SEGMENT.fullmatch(tok) for tok in re.split(r"[-_.]", stem) if tok)


def looks_like_category(url: str) -> bool:
    """URL com cara de página de categoria/coleção (lista de produtos): caminho curto com termo de categoria ou "-c" no fim.
    Um código de produto no último segmento (Ralph Lauren /men-…/…/0043104999.html) nunca é categoria."""
    parts = urllib.parse.urlsplit(url)
    path = parts.path.lower().rstrip("/")
    if not path or path.count("/") > 4 or looks_like_product(url) or _sku_like(path.rsplit("/", 1)[-1]):
        return False
    u = path + ("?" + parts.query.lower() if parts.query else "")
    return path.endswith("-c") or any(h in u for h in CATEGORY_HINTS)


def looks_like_product_leaf(url: str) -> bool:
    """Link de produto SEM pista na URL, pela forma do último segmento: um código com 5+ dígitos (Balenciaga
    /en-us/alaska-fur-high-boot-802177WBFC12200.html, Ralph Lauren /…/0043104999.html) ou um caminho "folha" de um
    nível com hífen (Magento: /chuck-70-cano-alto-ct16030001-prata). Categoria e .html sem código, nunca."""
    parts = urllib.parse.urlsplit(url)
    path = parts.path.rstrip("/")
    if not path or parts.query:
        return False
    last = path.rsplit("/", 1)[-1]
    if _sku_like(last):
        return True
    if looks_like_category(url) or last.lower().endswith(".html"):
        return False                                              # .html sem código é página institucional (privacy-policy.html)
    return path.count("/") == 1 and len(path) > 8 and "-" in last
