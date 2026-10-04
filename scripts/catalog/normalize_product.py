"""Normalização do catálogo. A fonte de verdade é a MESMA do backend Java:
fai-application/src/main/resources/catalog/normalization.json (taxonomia, sinônimos, apelidos de marca)."""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[2]
NORMALIZATION = ROOT / "fai-application/src/main/resources/catalog/normalization.json"


def key(s: Optional[str]) -> str:
    """Igual a CatalogNormalizer.key: minúsculas, sem acento, & → and, só letras/dígitos separados por espaço."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slug(s: Optional[str]) -> str:
    """Igual a CatalogNormalizer.slug (compatível com brands.slug): "Levi's" → levis, "H&M" → h-m."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower().replace("'", "").replace("’", "").replace(".", "")
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", s))


def canonical_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    u = re.sub(r"(?i)^https?://", "", url.strip())
    u = re.sub(r"(?i)^www\.", "", u).split("?")[0].split("#")[0].rstrip("/")
    head, sep, tail = u.partition("/")
    return head.lower() + (sep + tail if sep else "")


def domain(url: Optional[str]) -> Optional[str]:
    c = canonical_url(url)
    return c.split("/")[0] if c else None


class Normalizer:
    def __init__(self, path: Path = NORMALIZATION):
        data = json.loads(path.read_text(encoding="utf-8"))
        self.version = data.get("version")
        self.taxonomy: dict[str, list[str]] = data["taxonomy"]["subcategories"]
        self.sub_category = {s: c for c, subs in self.taxonomy.items() for s in subs}
        self.categories = {key(c): c for c in self.taxonomy}
        self.subcategories = {key(s): s for s in self.sub_category}
        self.colors = {key(c): c for c in data["taxonomy"]["colors"]}
        self.materials = {key(m): m for m in data["taxonomy"]["materials"]}
        self.genders: dict[str, str] = {}
        self.brand_aliases: dict[str, str] = {}
        for target, src in ((self.categories, "categorySynonyms"), (self.subcategories, "subcategorySynonyms"),
                            (self.colors, "colorSynonyms"), (self.materials, "materialSynonyms"),
                            (self.genders, "genderSynonyms"), (self.brand_aliases, "brandAliases")):
            for canon, syns in data.get(src, {}).items():
                target.setdefault(key(canon), canon)
                for s in syns:
                    target.setdefault(key(s), canon)
        self.stopwords = {key(s) for s in data.get("stopwords", [])}
        # vocabulário das características únicas da peça (o mesmo do CatalogDesignInterpreter no Java)
        design = data.get("design", {})
        self.design_patterns = set(design.get("patterns", {}))
        self.design_placements = set(design.get("placements", {}))
        self.design_sizes = set(design.get("sizes", {}))
        self.design_sides = set(design.get("sides", {}))

    def category(self, raw):
        return self.categories.get(key(raw))

    def subcategory(self, raw):
        return self.subcategories.get(key(raw))

    def color(self, raw):
        k = key(raw)
        if k in self.colors:
            return self.colors[k]
        for part in re.split(r" and |/| e | ", k):
            if part.strip() in self.colors:
                return self.colors[part.strip()]
        return None

    def material(self, raw):
        k = key(raw)
        if k in self.materials:
            return self.materials[k]
        return next((self.materials[t] for t in k.split() if t in self.materials), None)

    def gender(self, raw):
        return self.genders.get(key(raw))

    def brand_slug(self, raw):
        return self.brand_aliases.get(key(raw)) or slug(raw)

    def tokens(self, raw):
        return [t for t in key(raw).split() if t and t not in self.stopwords]

    def dedup_key(self, brand_slug, p: "Product") -> str:
        """Mesma ordem e formato do Java (CatalogNormalizer.dedupKey): gtin › ean › upc › sku › código › URL canônica › marca+modelo+variante › marca+título+cor."""
        digits = lambda s: re.sub(r"[^0-9]", "", s)
        code = lambda s: re.sub(r"[^A-Z0-9]", "", s.strip().upper())
        if p.gtin:
            return "gtin:" + digits(p.gtin)
        if p.ean:
            return "ean:" + digits(p.ean)
        if p.upc:
            return "upc:" + digits(p.upc)
        if p.sku:
            return f"sku:{brand_slug}:{code(p.sku)}"
        if p.product_code:
            return f"code:{brand_slug}:{code(p.product_code)}"
        if p.canonical_url:
            return "url:" + p.canonical_url
        c = p.color or ""
        if p.model_name:
            variant = p.color_name or c
            return f"model:{brand_slug}:{p.subcategory}:{key(p.model_name).replace(' ', '-')}:{key(variant).replace(' ', '-')}"
        return f"title:{brand_slug}:{p.subcategory}:{' '.join(self.tokens(p.product_name)).replace(' ', '-')}:{key(c).replace(' ', '-')}"


@dataclass
class Product:
    brand: str
    category: str
    subcategory: str
    product_name: str
    model_name: Optional[str] = None
    product_code: Optional[str] = None
    sku: Optional[str] = None
    gtin: Optional[str] = None
    ean: Optional[str] = None
    upc: Optional[str] = None
    color: Optional[str] = None
    color_name: Optional[str] = None
    material: Optional[str] = None
    collection: Optional[str] = None
    gender: Optional[str] = None
    official_product_url: Optional[str] = None
    canonical_url: Optional[str] = None
    source_domain: Optional[str] = None
    source_type: str = "MANUAL_ADMIN"
    images: list = field(default_factory=list)
    aliases: list = field(default_factory=list)
    variants: list = field(default_factory=list)
    description: Optional[str] = None
    design: Optional[dict] = None
    warnings: list = field(default_factory=list)


class ValidationError(ValueError):
    pass


FIELDS = ["brand", "category", "subcategory", "product_name", "model_name", "product_code", "sku", "gtin", "ean", "upc",
          "color", "color_name", "material", "collection", "gender", "official_product_url", "source_type"]


def normalize_product(raw: dict, n: Normalizer) -> Product:
    """Valida e normaliza um item cru (JSON ou linha de CSV). Valor fora da taxonomia → erro, nunca gravado como veio."""
    def s(name):
        v = raw.get(name)
        return str(v).strip() if v not in (None, "") else None

    for required in ("brand", "subcategory", "product_name"):
        if not s(required):
            raise ValidationError(f"campo obrigatório ausente: {required}")
    sub = n.subcategory(s("subcategory"))
    if not sub:
        raise ValidationError(f"subcategoria fora da taxonomia: {s('subcategory')}")
    cat = n.sub_category[sub]
    p = Product(brand=s("brand"), category=cat, subcategory=sub, product_name=re.sub(r"\s+", " ", s("product_name")))
    if s("category") and n.category(s("category")) not in (None, cat):
        p.warnings.append(f"categoria {s('category')} corrigida para {cat} pela subcategoria")
    elif s("category") and n.category(s("category")) is None:
        raise ValidationError(f"categoria inválida: {s('category')}")
    for name in ("model_name", "product_code", "sku", "gtin", "ean", "upc", "collection", "color_name"):
        setattr(p, name, s(name))
    for name in ("gtin", "ean", "upc"):
        v = getattr(p, name)
        if v and not re.fullmatch(r"\d{8,14}", re.sub(r"[\s-]", "", v)):
            raise ValidationError(f"{name} inválido: {v}")
    p.color = n.color(s("color")) if s("color") else (n.color(s("color_name")) if s("color_name") else None)
    if s("color") and not p.color:
        p.warnings.append(f"cor fora da taxonomia ignorada: {s('color')}")
    p.material = n.material(s("material")) if s("material") else None
    p.gender = n.gender(s("gender")) if s("gender") else None
    url = s("official_product_url")
    if url:
        if not url.startswith("https://"):
            raise ValidationError(f"URL oficial precisa ser https: {url}")
        p.official_product_url = url
        p.canonical_url = canonical_url(url)
        p.source_domain = domain(url)
    p.source_type = (s("source_type") or "MANUAL_ADMIN").upper()
    imgs = list(raw.get("images") or [])
    if s("primary_image_url"):
        imgs.insert(0, {"url": s("primary_image_url"), "type": "PACKSHOT"})
    p.images = imgs
    aliases = raw.get("aliases") or []
    p.aliases = [a for a in (aliases.split("|") if isinstance(aliases, str) else aliases) if str(a).strip()]
    p.variants = list(raw.get("variants") or [])
    p.description = re.sub(r"\s+", " ", s("description")) if s("description") else None
    p.design = normalize_design(raw.get("design"), n, p.warnings)
    return p


def normalize_design(raw, n: Normalizer, warnings: list) -> Optional[dict]:
    """Design da peça (estampa, logo, lados, cores da peça × da estampa) só com o vocabulário de normalization.json → design.
    Valor fora do vocabulário vira aviso e sai do design (nunca é gravado como veio). Sem design, o backend lê a descrição."""
    if not raw:
        return None
    if not isinstance(raw, dict):
        warnings.append("design ignorado: não é um objeto")
        return None
    out: dict = {}
    for name, allowed in (("pattern", n.design_patterns), ("logoPlacement", n.design_placements), ("logoSize", n.design_sizes)):
        v = raw.get(name)
        if v in (None, ""):
            continue
        v = str(v).strip().upper()
        if v in allowed:
            out[name] = v
        else:
            warnings.append(f"design.{name} fora do vocabulário ignorado: {v}")
    sides = [str(x).strip().upper() for x in raw.get("sides") or []]
    bad = [x for x in sides if x not in n.design_sides]
    if bad:
        warnings.append(f"design.sides fora do vocabulário ignorado: {', '.join(bad)}")
    if [x for x in sides if x in n.design_sides]:
        out["sides"] = [x for x in sides if x in n.design_sides]
    for name in ("baseColors", "printColors", "anyColors"):
        colors = []
        for c in raw.get(name) or []:
            code = n.color(c)
            if code and code not in ("print", "multicolor"):
                colors.append(code)
            else:
                warnings.append(f"design.{name}: cor fora da taxonomia ignorada: {c}")
        if colors:
            out[name] = list(dict.fromkeys(colors))
    return out or None
