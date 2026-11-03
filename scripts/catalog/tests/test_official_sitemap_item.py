"""Coletor oficial sem rede: dados estruturados (JSON-LD/OpenGraph), item do catálogo, taxonomia do nome e hosts
de imagem aceitos."""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

from normalize_product import normalize_product  # noqa: E402
from providers.official_sitemap import Site, brand_cdn_ok, infer_subcategory, structured_product, to_catalog_item  # noqa: E402
from scripts.catalog.tests.sitemap_fixture import N, TEE, FakeWeb, ld, polite  # noqa: E402


class StructuredDataTest(unittest.TestCase):
    def test_json_ld_com_entidade_html_dentro_de_texto_continua_valido(self):
        # VTEX (Hering): avaliação vazia publicada como "&quot;&quot;" — converter antes de ler quebrava o JSON
        block = ('{"@context":"https://schema.org","@type":"Product","name":"Gorro Unissex em Tricô","brand":{"@type":"Brand","name":"Hering"},'
                 '"image":"https://hering.vtexassets.com/arquivos/ids/1/g.jpg","review":[{"reviewBody":"&quot;&quot;","name":"&quot;&quot;"}]}')
        page = f'<html><head><script type="application/ld+json" id="x">{block}</script></head></html>'.encode()
        found = structured_product(page)
        self.assertEqual(found["kind"], "jsonld")
        self.assertEqual(found["node"]["name"], "Gorro Unissex em Tricô")

    def test_atributos_sem_aspas_html_minificado(self):
        block = '{"@context":"https://schema.org","@type":"Product","name":"Baby Look Fit Garden","brand":{"@type":"Brand","name":"Baw"}}'
        page = (f'<html><head><meta property=og:type content=website /><meta property=og:image content=https://cdn.baw.com.br/a.jpg>'
                f'<script type=application/ld+json>{block}</script></head></html>').encode()
        found = structured_product(page)
        self.assertEqual(found["kind"], "jsonld")
        self.assertEqual(found["node"]["name"], "Baby Look Fit Garden")
        self.assertEqual(found["og_image"], "https://cdn.baw.com.br/a.jpg")

    def test_og_type_com_prefixo_og_tambem_e_produto(self):
        page = b'<html><head><meta property="og:type" content="og:product"><meta property="og:title" content="Bermuda"></head></html>'
        self.assertEqual(structured_product(page)["kind"], "og")

    def test_product_jsonld_vira_item_importavel(self):
        warnings = []
        item = to_catalog_item(structured_product(ld(TEE)), "https://www.nike.com.br/p/nk-1", "Nike", "nike.com.br", "OFFICIAL_STORE", N, warnings)
        self.assertEqual(item["subcategory"], "t_shirt")
        self.assertEqual(item["product_name"], "Camiseta Listras Off-White")
        self.assertEqual(item["official_product_url"], "https://www.nike.com.br/p/nk-1")
        self.assertEqual(item["gtin"], "7891234567895")
        self.assertEqual([i["url"] for i in item["images"]], ["https://static.nike.com/a/1.jpg"])   # pinimg fora
        p = normalize_product(item, N)
        self.assertEqual(p.source_domain, "nike.com.br")
        self.assertEqual(p.category, "upper_piece")

    def test_product_group_com_variantes_no_graph(self):
        group = {"@context": "https://schema.org", "@graph": [{"@type": "WebPage"}, {
            "@type": "ProductGroup", "name": "Tênis Originals 98", "brand": "adidas", "productGroupID": "G1",
            "hasVariant": [{"@type": "Product", "color": "Bege", "sku": "A1"}, {"@type": "Product", "color": "Preto", "sku": "A2"}]}]}
        item = to_catalog_item(structured_product(ld(group)), "https://www.adidas.com.br/originals-98", "adidas", "adidas.com.br", "OFFICIAL_STORE", N, [])
        self.assertEqual(item["subcategory"], "casual_sneakers")
        self.assertEqual([v["sku"] for v in item["variants"]], ["A1", "A2"])
        self.assertEqual(item["color_name"], "Bege")

    def test_opengraph_quando_nao_ha_jsonld(self):
        page = b'<meta property="og:type" content="product"><meta property="og:title" content="Jaqueta Flight Essentials">' \
               b'<meta content="Preta" property="product:color">'
        found = structured_product(page)
        self.assertEqual(found["kind"], "og")
        item = to_catalog_item(found, "https://www.nike.com/t/flight", "Nike", "nike.com", "OFFICIAL_BRAND", N, [])
        self.assertEqual(item["subcategory"], "jacket")
        self.assertEqual(item["color_name"], "Preta")

    def test_sem_dados_estruturados(self):
        self.assertIsNone(structured_product(b"<html><h1>Camiseta</h1></html>"))

    def test_subtipo_desconhecido_nao_e_chutado(self):
        warnings = []
        item = to_catalog_item({"node": {"name": "Garrafa Térmica 1L", "brand": "Nike"}, "variants": []}, "https://nike.com/p/gift",
                               "Nike", "nike.com", "OFFICIAL_BRAND", N, warnings)
        self.assertIsNone(item)
        self.assertIn("nunca chutado", warnings[0])

    def test_marca_da_pagina_aceita_so_pela_excecao_da_fonte(self):
        # a loja oficial da Scotch & Soda escreve a licenciada "United Legwear" como marca do produto
        found = structured_product(ld({**TEE, "brand": {"@type": "Brand", "name": "United Legwear"}, "name": "Camiseta Listras"}))
        self.assertIsNone(to_catalog_item(found, "https://www.scotchandsoda.com/products/x", "Scotch & Soda", "scotchandsoda.com", "OFFICIAL_BRAND", N, []))
        item = to_catalog_item(found, "https://www.scotchandsoda.com/products/x", "Scotch & Soda", "scotchandsoda.com", "OFFICIAL_BRAND", N, [],
                               page_brands=("United Legwear",))
        self.assertEqual(item["brand"], "Scotch & Soda")
        # a exceção não abre para qualquer outra marca
        other = structured_product(ld({**TEE, "brand": {"@type": "Brand", "name": "Adidas"}, "name": "Camiseta Listras"}))
        self.assertIsNone(to_catalog_item(other, "https://www.scotchandsoda.com/products/y", "Scotch & Soda", "scotchandsoda.com", "OFFICIAL_BRAND", N, [],
                                          page_brands=("United Legwear",)))

    def test_marca_diferente_da_fonte_e_recusada(self):
        warnings = []
        item = to_catalog_item({"node": {"name": "Camiseta Logo", "brand": "Puma"}, "variants": []}, "https://nike.com/p/x",
                               "Nike", "nike.com", "OFFICIAL_BRAND", N, warnings)
        self.assertIsNone(item)
        self.assertIn("difere", warnings[0])

    def test_gtin_invalido_cai_e_url_externa_volta_para_a_pagina(self):
        node = {**TEE, "gtin13": "abc", "offers": {"url": "https://marketplace.com/x"}}
        item = to_catalog_item({"node": node, "variants": []}, "https://www.nike.com.br/p/nk-1", "Nike", "nike.com.br", "OFFICIAL_STORE", N, [])
        self.assertNotIn("gtin", item)
        self.assertEqual(item["official_product_url"], "https://www.nike.com.br/p/nk-1")

    def test_nucleo_do_nome_e_modificadores(self):
        self.assertNotEqual(infer_subcategory(N, "Nike Academy+ Men's Dri-FIT Soccer Short-Sleeve Top"), "shorts")
        self.assertEqual(infer_subcategory(N, "Nike Academy Men's Nike Dri-FIT Soccer Shorts"), "shorts")
        self.assertEqual(infer_subcategory(N, "Plush Women's Therma-FIT Shawl Jacket"), "jacket")
        self.assertEqual(infer_subcategory(N, "Camiseta Levi's Perfect Graphic Tee"), "t_shirt")
        self.assertEqual(infer_subcategory(N, "Calça Levi's XX Chino Cargo Taper Verde"), "cargo_pants")
        self.assertEqual(infer_subcategory(N, "Calça Jeans Levi's 514 Straight"), N.subcategory("calça jeans"))
        self.assertIsNone(infer_subcategory(N, "Nike Academy Shoe Bag (11L)"))

    def test_tipo_so_pelo_nome_e_fora_do_acervo(self):
        def item(name, **extra):
            return to_catalog_item({"node": {"name": name, "brand": "Everlane", **extra}, "variants": []}, "https://www.everlane.com/p/x",
                                   "Everlane", "everlane.com", "OFFICIAL_BRAND", N, [])
        self.assertEqual(item("The City Boot | Cream", description="Wear it with your favorite sweater.")["subcategory"], "boots")
        self.assertIsNone(item("The Cotton Tank Bra | Black"))
        self.assertIsNone(item("Tripack Cano Alto Fbox"))
        self.assertEqual(item("Kit 3 Pares de Meias Cano Alto")["subcategory"], "socks")
        self.assertEqual(item("UA Matchplay", category="Men's Golf Shorts")["subcategory"], "shorts")

    def test_titulo_limpo_e_cor_do_titulo(self):
        from providers.official_sitemap import clean_title
        self.assertEqual(clean_title("The Utility Barrel Pant | Bone | Tall", "Everlane", N)[0], "The Utility Barrel Pant")
        self.assertEqual(clean_title("The Waffle-Knit Hoodie | Black", "Everlane", N), ("The Waffle-Knit Hoodie", "Black"))
        self.assertEqual(clean_title("Long Cashmere Kensington Trench Coat in Ivory white - Women | Burberry® Official", "Burberry", N),
                         ("Long Cashmere Kensington Trench Coat", "Ivory white"))
        self.assertEqual(clean_title("Camiseta Levi's® Perfect Graphic Tee", "Levi's", N)[0], "Camiseta Levi's® Perfect Graphic Tee")
        item = to_catalog_item({"node": {"name": "The Waffle-Knit Hoodie | Black", "brand": "Everlane"}, "variants": []},
                               "https://www.everlane.com/p/x", "Everlane", "everlane.com", "OFFICIAL_BRAND", N, [])
        self.assertEqual((item["product_name"], item["color"]), ("The Waffle-Knit Hoodie", "black"))

    def test_imagem_das_variantes_e_og_image(self):
        group = {"@context": "https://schema.org", "@type": "ProductGroup", "name": "Nike Dri-FIT Shorts", "brand": "Nike",
                 "hasVariant": [{"@type": "Product", "color": "Black", "image": "https://static.nike.com/a/1.png"},
                                {"@type": "Product", "color": "Blue", "image": ["https://static.nike.com/a/2.png"]}]}
        item = to_catalog_item(structured_product(ld(group)), "https://www.nike.com/t/x", "Nike", "nike.com", "OFFICIAL_BRAND", N, [])
        self.assertEqual([i["url"] for i in item["images"]], ["https://static.nike.com/a/1.png", "https://static.nike.com/a/2.png"])
        page = ld({"@type": "Product", "name": "Camiseta Logo", "brand": "Fila"}).replace(
            b"<head>", b'<head><meta property="og:image" content="http://fila.vtexassets.com/arquivos/ids/1/a.jpg">')
        item = to_catalog_item(structured_product(page), "https://www.fila.com.br/x/p", "Fila", "fila.com.br", "OFFICIAL_STORE", N, [])
        self.assertEqual(item["images"][0]["url"], "https://fila.vtexassets.com/arquivos/ids/1/a.jpg")   # og:image, http → https

    def test_cdn_propria_da_marca_em_outro_dominio_so_por_configuracao(self):
        # Superdry serve as fotos em images.laguna-live.sd.co.uk; Banana Republic em content.gapinc.com
        self.assertFalse(brand_cdn_ok("https://images.laguna-live.sd.co.uk/zoom/a.jpg", "superdry.com"))
        self.assertTrue(brand_cdn_ok("https://images.laguna-live.sd.co.uk/zoom/a.jpg", "superdry.com", ("sd.co.uk",)))
        self.assertTrue(brand_cdn_ok("https://content.gapinc.com/b/0059/cn59585151.png", "bananarepublic.gap.com", ("gapinc.com",)))
        self.assertFalse(brand_cdn_ok("https://cdn.pinimg.com/x.jpg", "superdry.com", ("pinimg.com",)))     # bloqueado nunca passa
        found = structured_product(ld({**TEE, "brand": "Superdry", "name": "Camiseta Vintage", "image": ["https://images.laguna-live.sd.co.uk/zoom/a.jpg"]}))
        self.assertNotIn("images", to_catalog_item(found, "https://www.superdry.com/x-1.html", "Superdry", "superdry.com", "OFFICIAL_BRAND", N, []))
        item = to_catalog_item(found, "https://www.superdry.com/x-1.html", "Superdry", "superdry.com", "OFFICIAL_BRAND", N, [], image_hosts=("sd.co.uk",))
        self.assertEqual(item["images"], [{"url": "https://images.laguna-live.sd.co.uk/zoom/a.jpg", "type": "PACKSHOT"}])

    def test_hosts_de_imagem_da_loja(self):
        self.assertTrue(brand_cdn_ok("https://lojalevis.vtexassets.com/arquivos/ids/1/a.jpg", "levi.com.br"))
        self.assertTrue(brand_cdn_ok("https://cdn.shopify.com/s/files/1/a.jpg", "dickies.com"))
        self.assertTrue(brand_cdn_ok("https://valentino-cdn.thron.com/a.jpg", "valentino.com"))
        self.assertTrue(brand_cdn_ok("https://amq-mcq.dam.kering.com/asset/a", "alexandermcqueen.com"))
        self.assertTrue(brand_cdn_ok("https://cdn.media.amplience.net/i/drmartens/NX_32166001.80", "drmartens.com"))
        self.assertTrue(brand_cdn_ok("https://dcdn-us.mitiendanube.com/stores/007/products/a-480-0.webp", "amaro.com"))
        self.assertFalse(brand_cdn_ok("https://i.pinimg.com/a.jpg", "levi.com.br"))
        self.assertFalse(brand_cdn_ok("https://http2.mlstatic.com/a.jpg", "levi.com.br"))

    def test_marca_sem_pontuacao(self):
        item = to_catalog_item({"node": {"name": "Camiseta Logo", "brand": "Levis"}, "variants": []}, "https://www.levi.com.br/x/p",
                               "Levi's", "levi.com.br", "OFFICIAL_STORE", N, [])
        self.assertIsNotNone(item)

    def test_robots_no_www(self):
        web = FakeWeb({"https://www.loja.com.br/robots.txt": (200, b"Sitemap: https://www.loja.com.br/sm.xml", "text/plain")})
        site = Site("loja.com.br", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://www.loja.com.br/sm.xml"])

    def test_inferencia_e_cdn(self):
        self.assertEqual(infer_subcategory(N, "Blusa Manga Curta Padronagem Aop"), N.subcategory("blusa"))
        self.assertEqual(infer_subcategory(N, "New York Tennis Off White"), N.subcategory("tennis"))
        self.assertTrue(brand_cdn_ok("https://static.nike.com/x.jpg", "nike.com.br"))
        self.assertTrue(brand_cdn_ok("https://www.nike.com.br/x.jpg", "nike.com.br"))
        self.assertFalse(brand_cdn_ok("https://i.pinimg.com/x.jpg", "nike.com.br"))


if __name__ == "__main__":
    unittest.main()
