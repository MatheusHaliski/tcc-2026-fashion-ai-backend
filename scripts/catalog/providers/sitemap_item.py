"""Item do catálogo a partir dos dados estruturados da página oficial: marca conferida, tipo pelo nome, URL de origem
no domínio oficial, fotos só de hosts aceitos e variantes de cor."""
from __future__ import annotations

import re
from typing import Iterable, Optional
from urllib.parse import urljoin

from normalize_product import Normalizer, domain
from validate_source import blocked, same_site

from .sitemap_structured import _images, _text
from .sitemap_taxonomy import clean_title, infer_subcategory, is_pack, same_brand, unsupported_reason

# Servidores de imagem das plataformas de loja e DAMs das marcas: a página oficial declara a foto apontando para eles
# (lojalevis.vtexassets.com, cdn.shopify.com, amq-mcq.dam.kering.com, cdn.media.amplience.net/i/drmartens, Nuvemshop…). Entram só como referência (URL), nunca copiadas.
STORE_IMAGE_HOSTS = ("vtexassets.com", "vteximg.com.br", "cdn.shopify.com", "dam.kering.com", "thron.com", "bynder.com",
                     "scene7.com", "demandware.static.net", "imgix.net", "cloudinary.com", "ctfassets.net", "akamaized.net",
                     "amplience.net", "mitiendanube.com")


def brand_cdn_ok(image_url: str, official: str, extra_hosts: Iterable[str] = ()) -> bool:
    """Imagem que a página oficial declara: do próprio domínio oficial, de um host com o rótulo da marca no nome
    (static.nike.com, valentino-cdn.thron.com), do servidor de imagens da plataforma da loja (STORE_IMAGE_HOSTS) ou da
    CDN própria da marca cadastrada em brands.json (`collector.image_hosts`: sd.co.uk da Superdry, gapinc.com do grupo
    Gap). Domínios bloqueados (Pinterest, marketplaces…) nunca passam."""
    d = (domain(image_url) or "").lower()
    if not d or blocked(image_url):
        return False
    if same_site(d, official):
        return True
    if any(d == h.lower() or d.endswith("." + h.lower()) for h in extra_hosts):
        return True
    parts = official.lower().split(".")
    label = parts[-3] if len(parts) >= 3 and len(parts[-2]) <= 3 and len(parts[-1]) == 2 else parts[-2] if len(parts) >= 2 else official
    if label in re.split(r"[.-]", d):
        return True
    return any(d == h or d.endswith("." + h) for h in STORE_IMAGE_HOSTS)


def to_catalog_item(found: dict, page_url: str, brand: str, official: str, source_type: str, n: Normalizer,
                    warnings: list, page_brands: Iterable[str] = (), image_hosts: Iterable[str] = ()) -> Optional[dict]:
    """`page_brands`: nomes que a loja oficial escreve no lugar da marca e que valem como ela — a licenciada que opera a
    loja (Scotch & Soda publica "United Legwear"). `image_hosts`: CDN própria da marca em outro domínio registrado.
    Os dois vêm de brands.json (`collector.accept_page_brands` / `collector.image_hosts`), por marca."""
    node = found["node"]
    name, title_color = clean_title(_text(node.get("name")), brand, n)
    if not name:
        warnings.append(f"{page_url}: sem nome de produto")
        return None
    page_brand = _text(node.get("brand"))
    if page_brand and not same_brand(n, page_brand, brand) and not any(same_brand(n, page_brand, b) for b in page_brands):
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
    imgs = product_images(found, official, image_hosts)
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


def product_images(found: dict, official: str, extra_hosts: Iterable[str] = ()) -> list[str]:
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
        if u not in seen and brand_cdn_ok(u, official, extra_hosts):
            seen.add(u)
            out.append(u)
    return out


def _gtin(node: dict) -> Optional[str]:
    for k in ("gtin", "gtin13", "gtin14", "gtin12", "gtin8"):
        v = _text(node.get(k))
        if v:
            return re.sub(r"\D", "", v)
    return None
