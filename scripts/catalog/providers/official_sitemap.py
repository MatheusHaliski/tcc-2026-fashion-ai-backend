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

import gzip
import html
import json
import re
import time
import urllib.robotparser
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator, Optional
from urllib.parse import urljoin, urlparse

from normalize_product import Normalizer, domain, key
from validate_source import blocked, same_site

Fetch = Callable[[str], tuple[int, bytes, str]]
DEFAULT_UA = "FashionAI-CatalogBot/1.0 (+https://fashionai.app/catalog-bot)"
PRODUCT_HINTS = ("product", "produto", "/p/", "/t/", "/pd/", "/item", "-p-", "/prod")


class StopDomain(Exception):
    """O site pediu para parar (403/429) ou o robots.txt não deixa: o coletor larga o domínio."""


@dataclass
class Politeness:
    """Intervalo entre requisições por domínio: o maior entre o mínimo configurado e o Crawl-delay do robots.txt."""
    min_interval: float = 1.0
    last: dict = field(default_factory=dict)
    sleep: Callable[[float], None] = time.sleep
    clock: Callable[[], float] = time.monotonic

    def wait(self, host: str, crawl_delay: Optional[float]):
        interval = max(self.min_interval, crawl_delay or 0)
        now = self.clock()
        due = self.last.get(host, -1e9) + interval
        if now < due:
            self.sleep(due - now)
        self.last[host] = self.clock()


class Site:
    """Um domínio oficial: robots.txt, sitemaps e o fetch educado."""

    def __init__(self, official_domain: str, fetch: Fetch, politeness: Politeness, user_agent: str = DEFAULT_UA):
        self.domain = official_domain.lower()
        self.base = f"https://{self.domain}"
        self.fetch_raw, self.polite, self.ua = fetch, politeness, user_agent
        self.robots = urllib.robotparser.RobotFileParser()
        self.robots_loaded = False
        self.sitemaps: list[str] = []
        self.requests = 0

    def load_robots(self):
        try:
            status, body, _ = self._get(urljoin(self.base + "/", "robots.txt"), check_robots=False)
        except StopDomain:
            status, body = 403, b""
        if status in (0, 403, 404) and not self.domain.startswith("www."):
            alt = f"https://www.{self.domain}"                    # muitos sites só respondem (ou só liberam) no www.
            try:
                s2, b2, _ = self._get(urljoin(alt + "/", "robots.txt"), check_robots=False)
            except StopDomain:
                s2, b2 = 403, b""
            if s2 not in (0, 404):
                self.base, status, body = alt, s2, b2
        if status in (401, 403):
            raise StopDomain(f"{self.domain}: robots.txt respondeu {status} — sem permissão para coletar")
        if status == 0:
            raise StopDomain(f"{self.domain}: sem conexão com o site (rede/proxy bloqueou ou o domínio não respondeu)")
        text = body.decode("utf-8", "replace") if status == 200 else ""
        self.robots.parse(text.splitlines())                      # 404 = sem regras (permitido, como manda o padrão)
        self.sitemaps = [m.group(1).strip() for m in re.finditer(r"(?im)^\s*sitemap:\s*(\S+)", text)]
        if not self.sitemaps:
            self.sitemaps = [urljoin(self.base + "/", "sitemap.xml")]
        self.robots_loaded = True

    def allowed(self, url: str) -> bool:
        return self.robots.can_fetch(self.ua, url)

    def get(self, url: str) -> tuple[int, bytes, str]:
        return self._get(url, check_robots=True)

    def _get(self, url: str, check_robots: bool) -> tuple[int, bytes, str]:
        if not same_site(domain(url), self.domain):
            return 0, b"", ""                                     # nunca sai do domínio oficial
        if check_robots and self.robots_loaded and not self.allowed(url):
            return 0, b"", ""
        crawl_delay = self.robots.crawl_delay(self.ua) if self.robots_loaded else None
        self.polite.wait(self.domain, float(crawl_delay) if crawl_delay else None)
        self.requests += 1
        status, body, ctype = self.fetch_raw(url)
        if status in (403, 429):
            raise StopDomain(f"{self.domain}: {status} em {url} — o site pediu para parar")
        return status, body, ctype


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


def looks_like_product(url: str, patterns: Iterable[str] = PRODUCT_HINTS) -> bool:
    u = url.lower()
    return any(p in u for p in patterns)


PRODUCT_SITEMAP_HINTS = ("product", "produto", "pdp", "prod", "item", "sku", "catalog")
SKIP_SITEMAP_HINTS = ("help", "ajuda", "article", "blog", "news", "locator", "store-", "stores", "lojas", "landing",
                      "editorial", "journal", "story", "stories", "video", "image", "press", "career", "faq", "bfcm")
LOCALE_HINTS = ("pt-br", "pt_br", "/br/", "-br.", "_br.", "en-us", "en_us", "/us/", "-us.", "_us.")


def _sitemap_rank(url: str, extra: tuple) -> int:
    """Ordem de leitura: sitemap de produto do Brasil/EUA primeiro; ajuda, blog, lojas físicas etc. por último."""
    u = url.lower().replace("sitemap", "")                       # "s-item-ap" não é sitemap de item
    rank = 0
    if any(p in u for p in (*extra, *PRODUCT_SITEMAP_HINTS)):
        rank -= 10
    if any(p in u for p in LOCALE_HINTS):
        rank -= 3
    if any(p in u for p in SKIP_SITEMAP_HINTS):
        rank += 20
    return rank


def product_urls(site: Site, product_patterns: Iterable[str] = PRODUCT_HINTS, sitemap_patterns: Iterable[str] = (),
                 max_sitemaps: int = 60) -> Iterator[str]:
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
                if (product_map or looks_like_product(url, product_patterns)) and same_site(domain(url), site.domain) \
                        and not blocked(url):
                    yield url


# ───────────────────────── dados estruturados da página

_LD = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.S | re.I)
_META = re.compile(r'<meta\s+[^>]*(?:property|name)=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*>', re.I)
_META_REV = re.compile(r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']([^"\']+)["\'][^>]*>', re.I)


def _walk(node) -> Iterator[dict]:
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)


def _types(n: dict) -> set:
    t = n.get("@type")
    return set(t if isinstance(t, list) else [t]) if t else set()


def _text(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, dict):
        v = v.get("name") or v.get("@value")
    if isinstance(v, list):
        v = v[0] if v else None
    s = html.unescape(str(v)).strip() if v is not None else ""
    return re.sub(r"\s+", " ", s) or None


def _images(v) -> list[str]:
    out = []
    for item in v if isinstance(v, list) else [v]:
        if isinstance(item, dict):
            item = item.get("url") or item.get("contentUrl")
        if isinstance(item, str):
            item = item.strip()
            if item.startswith("//"):
                item = "https:" + item
            if item.startswith("http://"):                      # CDNs de loja servem https (o acervo só guarda https)
                item = "https://" + item[len("http://"):]
            if item.startswith("https://"):
                out.append(item)
    return out


def structured_product(page: bytes) -> Optional[dict]:
    """Product/ProductGroup do JSON-LD da página; sem JSON-LD de produto, o OpenGraph (og:type=product).
    O og:image vem junto: é a imagem que a própria página declara, usada quando o JSON-LD não traz foto."""
    text = page.decode("utf-8", "replace")
    meta = {k.lower(): v for k, v in _META.findall(text)}
    meta.update({k.lower(): v for v, k in _META_REV.findall(text)})
    og_image = html.unescape(meta.get("og:image") or "") or None
    for block in _LD.findall(text):
        try:
            data = json.loads(html.unescape(block.strip()))
        except ValueError:
            continue
        nodes = list(_walk(data))
        group = next((n for n in nodes if "ProductGroup" in _types(n)), None)
        prod = group or next((n for n in nodes if "Product" in _types(n)), None)
        if prod:
            variants = [n for n in (prod.get("hasVariant") or []) if isinstance(n, dict)] if group else []
            return {"kind": "jsonld", "node": prod, "variants": variants, "og_image": og_image}
    if meta.get("og:type", "").lower().startswith("product") or meta.get("product:retailer_item_id"):
        return {"kind": "og", "node": {"name": meta.get("og:title"), "description": meta.get("og:description"),
                                         "image": meta.get("og:image"), "sku": meta.get("product:retailer_item_id"),
                                         "color": meta.get("product:color")}, "variants": [], "og_image": og_image}
    return None


# ───────────────────────── produto do catálogo

MODIFIERS = ("short sleeve", "short sleeved", "long sleeve", "long sleeved", "manga curta", "manga longa", "manga corta",
             "shoe bag", "for shoes", "shoe care", "sock liner", "boot cut", "bootcut", "shirt dress", "tee dress")
ENGLISH_HINTS = {"men", "mens", "women", "womens", "kids", "boys", "girls", "unisex", "with", "the", "and", "for", "s"}


def infer_subcategory(n: Normalizer, *texts: Optional[str]) -> Optional[str]:
    """Subtipo pela taxonomia, lendo nome/categoria da página. Modificadores ("short sleeve", "manga curta") não contam.
    Em inglês o núcleo do nome vem no fim ("...Short-Sleeve Top" = top); em português/espanhol, no começo ("Camiseta
    ..."). Frases maiores vencem as menores na mesma posição. Sem acerto: None (nunca chutado)."""
    for t in texts:
        k = " " + key(t) + " "
        for m in MODIFIERS:
            k = k.replace(" " + m + " ", " · ")
        words = k.split()
        hits = []                                                 # (início, fim, subtipo)
        for size in (3, 2, 1):
            for i in range(len(words) - size + 1):
                gram = words[i:i + size]
                if "·" in gram:
                    continue
                sub = n.subcategory(" ".join(gram))
                if sub and not any(h[0] <= i and i + size <= h[1] for h in hits):
                    hits.append((i, i + size, sub))
        if hits:
            english = len(ENGLISH_HINTS & set(words)) > 0
            hits.sort(key=lambda h: h[0])
            return hits[-1][2] if english else hits[0][2]
    return None


UNSUPPORTED = ("bra", "bras", "sports bra", "sutia", "underwear", "cueca", "cuecas", "calcinha", "calcinhas", "boxer", "boxers",
               "brief", "briefs", "lingerie", "thong", "tanga", "gift card", "vale presente", "cartao presente")
_PACK = re.compile(r"\b(tripack|tri pack|\d+\s?pack|pack\s?\d+|kit\s?(com\s)?\d+|\d+\s?pares|multipack)\b")


_AUDIENCE = re.compile(r"\s+-\s+(women|men|unisex|kids|boys|girls|baby|feminino|masculino|infantil)\s*$", re.I)


def clean_title(raw: Optional[str], brand: str, n: Normalizer) -> tuple[Optional[str], Optional[str]]:
    """Título da página → (nome do produto, cor citada no título).

    "Utility Barrel Pant | Bone | Tall" → ("Utility Barrel Pant", "Bone");
    "Trench Coat in Ivory white - Women | Burberry® Official" → ("Trench Coat", "Ivory white").
    Sufixo da loja ("| Marca® Official"), público ("- Women") e caimento ("| Tall") saem; a cor só é separada quando a
    taxonomia a reconhece (senão fica no nome)."""
    if not raw:
        return raw, None
    parts = [p.strip() for p in re.split(r"\s+\|\s+", raw) if p.strip()]
    brand_key = _squash(brand)
    parts = [p for p in parts if not (brand_key and brand_key in _squash(p) and re.search(r"official|oficial|loja|store|®", p, re.I))
             and not re.fullmatch(r"(official|oficial)( site| store| loja)?", p, re.I)] or parts[:1]
    name, color = parts[0], None
    for extra in parts[1:]:
        if color is None and n.color(extra):
            color = extra
    name = _AUDIENCE.sub("", name).strip()
    m = re.search(r"\s+in\s+([A-Za-z][A-Za-z /-]{2,30})$", name)
    if m and n.color(m.group(1)):
        color = color or m.group(1).strip()
        name = name[:m.start()].strip()
    return name or raw, color


def unsupported_reason(name: Optional[str]) -> Optional[str]:
    """Peças fora da taxonomia do acervo (roupa íntima, vale-presente): ficam de fora em vez de virar outro tipo."""
    k = " " + key(name) + " "
    hit = next((u for u in UNSUPPORTED if f" {u} " in k), None)
    return f"tipo fora do acervo ({hit})" if hit else None


def is_pack(name: Optional[str]) -> bool:
    return bool(_PACK.search(key(name)))


# Servidores de imagem das plataformas de loja e DAMs das marcas: a página oficial declara a foto apontando para eles
# (lojalevis.vtexassets.com, cdn.shopify.com, amq-mcq.dam.kering.com…). Entram só como referência (URL), nunca copiadas.
STORE_IMAGE_HOSTS = ("vtexassets.com", "vteximg.com.br", "cdn.shopify.com", "dam.kering.com", "thron.com", "bynder.com",
                     "scene7.com", "demandware.static.net", "imgix.net", "cloudinary.com", "ctfassets.net", "akamaized.net")


def brand_cdn_ok(image_url: str, official: str) -> bool:
    """Imagem que a página oficial declara: do próprio domínio oficial, de um host com o rótulo da marca no nome
    (static.nike.com, valentino-cdn.thron.com) ou do servidor de imagens da plataforma da loja (STORE_IMAGE_HOSTS).
    Domínios bloqueados (Pinterest, marketplaces…) nunca passam."""
    d = (domain(image_url) or "").lower()
    if not d or blocked(image_url):
        return False
    if same_site(d, official):
        return True
    parts = official.lower().split(".")
    label = parts[-3] if len(parts) >= 3 and len(parts[-2]) <= 3 and len(parts[-1]) == 2 else parts[-2] if len(parts) >= 2 else official
    if label in re.split(r"[.-]", d):
        return True
    return any(d == h or d.endswith("." + h) for h in STORE_IMAGE_HOSTS)


def _squash(s: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]", "", key(s))


def same_brand(n: Normalizer, page_brand: str, brand: str) -> bool:
    """"Levis" = "Levi's" = "LEVI’S®"; apelidos cadastrados (CK → Calvin Klein) também valem."""
    a, b = _squash(page_brand), _squash(brand)
    if a and b and (a in b or b in a):
        return True
    sa, sb = n.brand_slug(page_brand), n.brand_slug(brand)
    return bool(sa and sb and sa == sb)


def to_catalog_item(found: dict, page_url: str, brand: str, official: str, source_type: str, n: Normalizer,
                    warnings: list) -> Optional[dict]:
    node = found["node"]
    name, title_color = clean_title(_text(node.get("name")), brand, n)
    if not name:
        warnings.append(f"{page_url}: sem nome de produto")
        return None
    page_brand = _text(node.get("brand"))
    if page_brand and not same_brand(n, page_brand, brand):
        # site oficial de multimarcas autorizadas: a marca da página vence se for outra marca conhecida?
        # aqui só aceitamos a marca da própria fonte (um domínio = uma marca), para nunca atribuir errado
        warnings.append(f"{page_url}: marca da página ({page_brand}) difere da fonte ({brand}) — ignorado")
        return None
    unsupported = unsupported_reason(name)
    if unsupported:
        warnings.append(f"{page_url}: \"{name}\" — {unsupported} — ignorado")
        return None
    # o tipo vem do NOME; a categoria da página só entra se o nome não disser. A descrição nunca decide o tipo
    # ("The City Boot", descrito como "combina com o seu sweater", não vira suéter)
    sub = infer_subcategory(n, name) or infer_subcategory(n, _text(node.get("category")))
    if sub and is_pack(name) and sub != "socks":
        warnings.append(f"{page_url}: kit/pacote sem tipo claro em \"{name}\" — ignorado")
        return None
    if not sub:
        warnings.append(f"{page_url}: subtipo não reconhecido em \"{name}\" — ignorado (nunca chutado)")
        return None
    offers = node.get("offers")
    offer_url = None
    if isinstance(offers, dict):
        offer_url = offers.get("url")
    elif isinstance(offers, list) and offers and isinstance(offers[0], dict):
        offer_url = offers[0].get("url")
    url = node.get("url") or offer_url or page_url
    url = urljoin(page_url, url)
    if not same_site(domain(url), official):
        url = page_url
    imgs = product_images(found, official)
    color_raw = _text(node.get("color")) or title_color
    item = {
        "brand": brand, "subcategory": sub, "product_name": name[:240],
        # cor tirada do título ("Hoodie | Black"): o nome limpo vira o modelo, e as outras cores entram como variantes
        "model_name": _text(node.get("model")) or (name if title_color else None),
        "sku": _text(node.get("sku")), "gtin": _gtin(node), "product_code": _text(node.get("mpn")),
        "color": n.color(color_raw) if color_raw else None, "color_name": color_raw,
        "description": (_text(node.get("description")) or "")[:2000] or None,
        "official_product_url": url if url.startswith("https://") else None,
        "images": [{"url": u, "type": "PACKSHOT"} for u in imgs[:4]],
        "source_type": source_type,
    }
    variants = []
    for v in found.get("variants", []):
        vc = _text(v.get("color"))
        variants.append({"color": n.color(vc) if vc else None, "color_name": vc, "sku": _text(v.get("sku")), "gtin": _gtin(v)})
    if variants:
        item["variants"] = [v for v in variants if v.get("color") or v.get("sku") or v.get("gtin")]
        if not item["color"]:
            first = next((v for v in item["variants"] if v.get("color")), None)
            if first:
                item["color"], item["color_name"] = first["color"], first["color_name"]
    if item["gtin"] and not re.fullmatch(r"\d{8,14}", item["gtin"]):
        item["gtin"] = None
    return {k: v for k, v in item.items() if v not in (None, "", [])}


def product_images(found: dict, official: str) -> list[str]:
    """Fotos do produto: as do nó principal; sem elas, a 1ª de cada variante (Nike e Shopify põem a foto só nas
    variantes de cor); sem nenhuma, o og:image da página. Sem repetição, só hosts aceitos por brand_cdn_ok."""
    node = found.get("node") or {}
    imgs = _images(node.get("image"))
    if not imgs:
        for v in found.get("variants") or []:
            imgs += _images(v.get("image"))[:1]
    if not imgs and found.get("og_image"):
        imgs = _images(found["og_image"])
    seen, out = set(), []
    for u in imgs:
        if u not in seen and brand_cdn_ok(u, official):
            seen.add(u)
            out.append(u)
    return out


def _gtin(node: dict) -> Optional[str]:
    for k in ("gtin", "gtin13", "gtin14", "gtin12", "gtin8"):
        v = _text(node.get(k))
        if v:
            return re.sub(r"\D", "", v)
    return None


def collect(site: Site, brand: str, source_type: str, n: Normalizer, max_products: int, product_patterns=PRODUCT_HINTS,
            sitemap_patterns=(), visited: Optional[set] = None, warnings: Optional[list] = None,
            on_item: Optional[Callable[[dict], None]] = None) -> dict:
    """Percorre o domínio oficial e devolve um relatório; cada produto aceito vai para on_item (JSONL no CLI)."""
    visited = visited if visited is not None else set()
    warnings = warnings if warnings is not None else []
    report = {"domain": site.domain, "pages": 0, "accepted": 0, "skipped": 0, "blocked_by_robots": 0, "stopped": None}
    try:
        site.load_robots()
        for url in product_urls(site, product_patterns, sitemap_patterns):
            if report["accepted"] >= max_products:
                break
            if url in visited:
                continue
            visited.add(url)
            if not site.allowed(url):
                report["blocked_by_robots"] += 1
                continue
            status, body, ctype = site.get(url)
            report["pages"] += 1
            if status != 200 or "html" not in (ctype or "text/html"):
                report["skipped"] += 1
                continue
            found = structured_product(body)
            item = to_catalog_item(found, url, brand, site.domain, source_type, n, warnings) if found else None
            if not item:
                if not found:
                    warnings.append(f"{url}: sem dados estruturados de produto (JSON-LD/OpenGraph)")
                report["skipped"] += 1
                continue
            report["accepted"] += 1
            if on_item:
                on_item(item)
    except StopDomain as e:
        report["stopped"] = str(e)
    return report
