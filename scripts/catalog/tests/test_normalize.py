"""python -m unittest discover -s scripts/catalog/tests  (sem banco)."""
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

from normalize_product import Normalizer, Product, ValidationError, canonical_url, normalize_product  # noqa: E402
from validate_source import blocked, same_site  # noqa: E402

ROOT = HERE.parents[3]
N = Normalizer()


class NormalizeTest(unittest.TestCase):
    def test_sinonimos(self):
        self.assertEqual(N.subcategory("Tee"), "t_shirt")
        self.assertEqual(N.subcategory("tênis"), "casual_sneakers")
        self.assertEqual(N.category("Calçados"), "shoes_piece")
        self.assertEqual(N.color("Branco"), "white")
        self.assertEqual(N.color("White/Black"), "white")
        self.assertEqual(N.material("100% algodão"), "COTTON")
        self.assertEqual(N.brand_slug("PRL"), "ralph-lauren")
        self.assertEqual(N.brand_slug("NIKE"), "nike")
        self.assertEqual(N.brand_slug("H&M"), "h-m")

    def test_paridade_de_dedup_com_o_java(self):
        cases = json.loads((ROOT / "fai-application/src/test/resources/catalog/dedup-cases.json").read_text(encoding="utf-8"))
        for c in cases:
            p = Product(brand=c["brand"], category="", subcategory=c["subcategory"], product_name=c.get("title") or "x",
                        model_name=c.get("model"), product_code=c.get("product_code"), sku=c.get("sku"), gtin=c.get("gtin"),
                        color=c.get("color"), color_name=c.get("variant"), canonical_url=canonical_url(c.get("url")))
            self.assertEqual(N.dedup_key(c["brand"], p), c["expected"], c)

    def test_validacao(self):
        with self.assertRaises(ValidationError):
            normalize_product({"brand": "Nike", "subcategory": "cueca", "product_name": "x"}, N)
        with self.assertRaises(ValidationError):
            normalize_product({"brand": "Nike", "subcategory": "tenis"}, N)
        with self.assertRaises(ValidationError):
            normalize_product({"brand": "Nike", "subcategory": "tenis", "product_name": "x", "official_product_url": "http://nike.com/x"}, N)
        with self.assertRaises(ValidationError):
            normalize_product({"brand": "Nike", "subcategory": "tenis", "product_name": "x", "gtin": "abc"}, N)
        p = normalize_product({"brand": "Nike", "category": "UPPER_PIECE", "subcategory": "tenis", "product_name": "AF1"}, N)
        self.assertEqual(p.category, "shoes_piece")
        self.assertTrue(p.warnings)

    def test_fontes(self):
        self.assertTrue(blocked("https://www.pinterest.com/pin/1"))
        self.assertFalse(blocked("https://www.nike.com/t/af1"))
        self.assertTrue(same_site("store.nike.com", "nike.com"))
        self.assertFalse(same_site("fakenike.com", "nike.com"))

    def test_seed_valido(self):
        brands = json.loads((ROOT / "data/catalog/brands.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(brands), 10)
        keys = set()
        for f in (ROOT / "data/catalog/products").glob("*.json"):
            for raw in json.loads(f.read_text(encoding="utf-8")):
                p = normalize_product(raw, N)
                k = N.dedup_key(N.brand_slug(p.brand), p)
                self.assertNotIn(k, keys, f"duplicata no seed: {k}")
                keys.add(k)


class PlainTextTest(unittest.TestCase):
    def test_bolsa_com_subcategoria_de_roupa_nao_entra(self):
        n = Normalizer()
        with self.assertRaises(ValidationError):
            normalize_product({"brand": "Desigual", "subcategory": "jeans", "product_name": "Bossa denim mitjana blau"}, n)
        # "bolso" é o bolso da roupa, e "baggy" não é bolsa
        self.assertEqual(normalize_product({"brand": "X", "subcategory": "jeans", "product_name": "Calça jeans baggy com bolso"}, n).subcategory, "jeans")

    def test_titulo_com_marcacao_html_vira_texto_puro(self):
        from normalize_product import plain_text
        self.assertEqual(plain_text("Supima<sup>®</sup> Cotton Pique Polo Shirt"), "Supima® Cotton Pique Polo Shirt")
        self.assertEqual(plain_text("Levi&#39;s 501 &amp; Co."), "Levi's 501 & Co.")


if __name__ == "__main__":
    unittest.main()


class DesignTest(unittest.TestCase):
    """RF47 · design da peça só com o vocabulário compartilhado (normalization.json → design)."""

    def setUp(self):
        self.n = Normalizer()

    def test_design_valido_e_normalizado(self):
        p = normalize_product({"brand": "Calvin Klein", "subcategory": "t_shirt", "product_name": "Camiseta Monogram Allover",
                               "description": "Monograma CK  em toda a superfície.",
                               "design": {"pattern": "allover_logo", "logoPlacement": "ALLOVER", "sides": ["front", "back"],
                                          "baseColors": ["cinza"], "printColors": ["preto"]}}, self.n)
        self.assertEqual(p.description, "Monograma CK em toda a superfície.")
        self.assertEqual(p.design, {"pattern": "ALLOVER_LOGO", "logoPlacement": "ALLOVER", "sides": ["FRONT", "BACK"],
                                    "baseColors": ["gray"], "printColors": ["black"]})

    def test_fora_do_vocabulario_vira_aviso(self):
        p = normalize_product({"brand": "X", "subcategory": "t_shirt", "product_name": "Y",
                               "design": {"pattern": "GALAXY", "baseColors": ["azul", "furta-cor"]}}, self.n)
        self.assertEqual(p.design, {"baseColors": ["blue"]})
        self.assertTrue(any("GALAXY" in w for w in p.warnings))
        self.assertTrue(any("furta-cor" in w for w in p.warnings))
