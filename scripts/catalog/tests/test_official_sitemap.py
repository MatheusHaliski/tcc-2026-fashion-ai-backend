"""Coletor oficial (sitemaps + JSON-LD) sem rede: páginas de exemplo num fetch falso."""
import gzip
import json
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

import collect_official  # noqa: E402
from import_products import read_items  # noqa: E402
from normalize_product import Normalizer, normalize_product  # noqa: E402
from providers.official_sitemap import (Politeness, Site, brand_cdn_ok, collect, infer_subcategory, looks_like_product,  # noqa: E402
                                        product_urls, structured_product, to_catalog_item)

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


class SitemapTest(unittest.TestCase):
    def site(self, pages, robots="User-agent: *\nAllow: /\nSitemap: https://www.nike.com.br/sitemap_index.xml\n"):
        pages = {"https://nike.com.br/robots.txt": (200, robots.encode(), "text/plain"), **pages}
        web = FakeWeb(pages)
        p, slept = polite()
        site = Site("nike.com.br", web, p)
        return site, web, slept

    def test_indice_aninhado_e_gz(self):
        gz = gzip.compress(urlset("https://www.nike.com.br/tenis-air-max-90", "https://outra.com/x"))
        site, web, _ = self.site({
            "https://www.nike.com.br/sitemap_index.xml": (200, index("https://www.nike.com.br/sitemap-blog.xml",
                                                                     "https://www.nike.com.br/sitemap-pdp-pt-br-1.xml.gz",
                                                                     "https://www.nike.com.br/sitemap-paginas.xml"), XML),
            "https://www.nike.com.br/sitemap-pdp-pt-br-1.xml.gz": (200, gz, "application/gzip"),
            "https://www.nike.com.br/sitemap-paginas.xml": (200, urlset("https://www.nike.com.br/institucional",
                                                                        "https://www.nike.com.br/p/b"), XML),
        })
        site.load_robots()
        # sitemap de produto primeiro (toda URL do domínio conta); no sitemap genérico só URL com cara de produto
        self.assertEqual(list(product_urls(site)), ["https://www.nike.com.br/tenis-air-max-90", "https://www.nike.com.br/p/b"])
        self.assertNotIn("https://www.nike.com.br/sitemap-blog.xml", web.calls)              # blog nem é baixado

    def test_sem_sitemap_no_robots_tenta_tambem_sitemap_index_xml(self):
        # superdry.com: robots sem Sitemap, /sitemap.xml 404 e o índice de verdade em /sitemap_index.xml
        sm = urlset("https://www.superdry.com/products/jaqueta-x")
        web = FakeWeb({"https://superdry.com/robots.txt": (200, b"User-agent: *\nAllow: /", "text/plain"),
                       "https://superdry.com/sitemap_index.xml": (200, index("https://www.superdry.com/sitemap-customSitemap_sd-uk_en_GB_product.xml"), XML),
                       "https://www.superdry.com/sitemap-customSitemap_sd-uk_en_GB_product.xml": (200, sm, XML)})
        site = Site("superdry.com", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://superdry.com/sitemap.xml", "https://superdry.com/sitemap_index.xml"])
        self.assertEqual(list(product_urls(site)), ["https://www.superdry.com/products/jaqueta-x"])

    def test_sem_sitemap_no_robots_usa_sitemap_xml(self):
        site, _, _ = self.site({"https://nike.com.br/sitemap.xml": (200, urlset("https://nike.com.br/p/x"), XML)}, robots="User-agent: *\n")
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://nike.com.br/sitemap.xml", "https://nike.com.br/sitemap_index.xml"])
        self.assertEqual(list(product_urls(site)), ["https://nike.com.br/p/x"])

    def test_urlset_que_lista_sitemaps_vira_indice(self):
        # Diesel/Carhartt WIP: o sitemap_index.xml é um <urlset> cujas URLs são os sitemaps de cada país
        site, web, _ = self.site({
            "https://www.nike.com.br/sitemap_index.xml": (200, urlset("https://www.nike.com.br/fr-fr/sitemap.xml",
                                                                      "https://www.nike.com.br/en-us/sitemap-products_en_US.xml"), XML),
            "https://www.nike.com.br/en-us/sitemap-products_en_US.xml": (200, urlset("https://www.nike.com.br/en-us/air-max-90.html"), XML),
            "https://www.nike.com.br/fr-fr/sitemap.xml": (200, urlset("https://www.nike.com.br/fr-fr/p/x"), XML),
        })
        site.load_robots()
        self.assertEqual(list(product_urls(site)), ["https://www.nike.com.br/en-us/air-max-90.html", "https://www.nike.com.br/fr-fr/p/x"])
        # o de produto dos EUA é lido antes do genérico da França; nenhuma URL .xml chega a ser tratada como página
        self.assertLess(web.calls.index("https://www.nike.com.br/en-us/sitemap-products_en_US.xml"),
                        web.calls.index("https://www.nike.com.br/fr-fr/sitemap.xml"))

    def test_sitemap_proprio_em_http_vira_https(self):
        web = FakeWeb({"https://aeropostale.com/robots.txt": (200, b"Sitemap: http://www.aeropostale.com/sitemap_index.xml\n"
                                                                    b"Sitemap: http://outra.com/sitemap.xml", "text/plain")})
        site = Site("aeropostale.com", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://www.aeropostale.com/sitemap_index.xml", "http://outra.com/sitemap.xml"])

    def test_pagina_de_produto_vtex_termina_em_p(self):
        self.assertTrue(looks_like_product("https://www.cea.com.br/vestido-midi-floral-1082857/p"))
        self.assertFalse(looks_like_product("https://www.cea.com.br/feminino/roupas/vestidos"))
        self.assertFalse(looks_like_product("https://www.cea.com.br/politica-de-privacidade"))

    def test_padrao_de_produto_por_expressao_regular(self):
        pat = ("re:/en-us/.+/[A-Z0-9]+-[A-Z0-9]+\\.html$",)
        self.assertTrue(looks_like_product("https://www.guess.com/en-us/guess/women/bags/lua-bag-pink/RG920575-PIN.html", pat))
        self.assertFalse(looks_like_product("https://www.guess.com/en-ca/guess/women/bags/lua-bag-pink/RG920575-PIN.html", pat))
        self.assertFalse(looks_like_product("https://www.guess.com/en-us/guess/women/bags/", pat))
        self.assertTrue(looks_like_product("https://www.nike.com.br/P/abc", ("/p/",)))         # trecho comum: sem caixa

    def test_nunca_sai_do_dominio_oficial(self):
        site, web, _ = self.site({"https://www.nike.com.br/sitemap_index.xml": (200, urlset("https://www.nike.com.br/p/a", "https://outra.com/p/b"), XML)})
        site.load_robots()
        self.assertEqual(list(product_urls(site)), ["https://www.nike.com.br/p/a"])
        self.assertEqual(site.get("https://outra.com/p/b")[0], 0)
        self.assertNotIn("https://outra.com/p/b", web.calls)

    def test_robots_bloqueia_e_crawl_delay(self):
        robots = "User-agent: *\nDisallow: /p/secreto\nCrawl-delay: 5\nSitemap: https://www.nike.com.br/sm.xml\n"
        site, web, slept = self.site({
            "https://www.nike.com.br/sm.xml": (200, urlset("https://www.nike.com.br/p/secreto", "https://www.nike.com.br/p/nk-1"), XML),
            "https://www.nike.com.br/p/nk-1": (200, ld(TEE), HTML),
        }, robots=robots)
        out = []
        rep = collect(site, "Nike", "OFFICIAL_STORE", N, 10, on_item=out.append)
        self.assertEqual(rep["blocked_by_robots"], 1)
        self.assertNotIn("https://www.nike.com.br/p/secreto", web.calls)
        self.assertEqual(rep["accepted"], 1)
        self.assertTrue(slept and all(s >= 4.99 for s in slept))           # Crawl-delay 5 > intervalo mínimo 1

    def test_403_para_o_dominio(self):
        site, _, _ = self.site({
            "https://www.nike.com.br/sitemap_index.xml": (200, urlset("https://www.nike.com.br/p/1", "https://www.nike.com.br/p/2"), XML),
            "https://www.nike.com.br/p/1": (403, b"", HTML),
        })
        rep = collect(site, "Nike", "OFFICIAL_STORE", N, 10)
        self.assertIn("403", rep["stopped"])
        self.assertEqual(rep["accepted"], 0)

    def test_robots_403_no_dominio_puro_tenta_www(self):
        web = FakeWeb({"https://vans.com/robots.txt": (403, b"", "text/plain"),
                       "https://www.vans.com/robots.txt": (200, b"Sitemap: https://www.vans.com/sm.xml", "text/plain")})
        site = Site("vans.com", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://www.vans.com/sm.xml"])

    def test_robots_que_redireciona_para_a_pagina_inicial_tenta_www(self):
        # hering.com.br/robots.txt redireciona para www.hering.com.br/ (HTML): isso não é robots.txt
        home = (200, b"<!DOCTYPE html><html><body>Hering</body></html>", "text/html; charset=utf-8")
        web = FakeWeb({"https://hering.com.br/robots.txt": home,
                       "https://www.hering.com.br/robots.txt": (200, b"User-agent: *\nSitemap: https://www.hering.com.br/sitemap.xml", "text/plain")})
        site = Site("hering.com.br", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.base, "https://www.hering.com.br")
        self.assertEqual(site.sitemaps, ["https://www.hering.com.br/sitemap.xml"])

    def test_dominio_com_palavra_de_descarte_nao_some(self):
        # "lojasrenner.com.br" contém "lojas" (sitemap de lojas físicas é pulado), mas é o domínio, não o sitemap
        sm = urlset("https://www.lojasrenner.com.br/p/camiseta-basica/1")
        web = FakeWeb({"https://lojasrenner.com.br/robots.txt": (200, b"Sitemap: https://www.lojasrenner.com.br/sitemap.xml", "text/plain"),
                       "https://www.lojasrenner.com.br/sitemap.xml": (200, sm, "application/xml")})
        site = Site("lojasrenner.com.br", web, polite()[0])
        site.load_robots()
        self.assertEqual(list(product_urls(site)), ["https://www.lojasrenner.com.br/p/camiseta-basica/1"])

    def test_desiste_do_site_que_nao_publica_dados_estruturados(self):
        urls = [f"https://www.semdados.com/produto/p{i}" for i in range(10)]
        pages = {u: (200, b"<html><body>sem json-ld</body></html>", "text/html") for u in urls}
        web = FakeWeb({"https://semdados.com/robots.txt": (200, b"Sitemap: https://semdados.com/sm.xml", "text/plain"),
                       "https://semdados.com/sm.xml": (200, urlset(*urls), "application/xml"), **pages})
        rep = collect(Site("semdados.com", web, polite()[0]), "X", "OFFICIAL_BRAND", N, 100, give_up_after=3)
        self.assertEqual(rep["pages"], 3)
        self.assertIn("3 páginas seguidas", rep["stopped"])

    def test_sitemap_declarado_em_outro_dominio_tenta_o_do_proprio_site(self):
        web = FakeWeb({"https://lezalez.com/robots.txt": (200, b"Sitemap: https://www.lezalez.com.br/sitemap.xml", "text/plain")})
        site = Site("lezalez.com", web, polite()[0])
        site.load_robots()
        self.assertEqual(site.sitemaps, ["https://www.lezalez.com.br/sitemap.xml", "https://lezalez.com/sitemap.xml", "https://lezalez.com/sitemap_index.xml"])

    def test_robots_403_nao_coleta(self):
        web = FakeWeb({"https://nike.com.br/robots.txt": (403, b"", "text/plain")})
        rep = collect(Site("nike.com.br", web, polite()[0]), "Nike", "OFFICIAL_STORE", N, 10)
        self.assertIsNotNone(rep["stopped"])
        # domínio puro e www. recusam: para sem baixar mais nada
        self.assertEqual(web.calls, ["https://nike.com.br/robots.txt", "https://www.nike.com.br/robots.txt"])

    def test_sem_conexao_avisa(self):
        web = FakeWeb({"https://nike.com.br/robots.txt": (0, b"", "")})
        rep = collect(Site("nike.com.br", web, polite()[0]), "Nike", "OFFICIAL_STORE", N, 10)
        self.assertIn("sem conexão", rep["stopped"])

    def test_busca_melhorada_por_paginas_de_categoria(self):
        # sitemap só com categorias (C&A, Balenciaga, Birkenstock): o coletor lê a página de categoria e segue os links de
        # produto dela — sem sair do domínio e respeitando o robots.txt
        cat = (b'<html><body><a href="/women/jeans/p/jeans-reta-1">Jeans</a><a href="https://outra.com/p/x">fora</a>'
               b'<a href="/women/jeans/pagina2">2</a><a href="#topo">topo</a><a href="https://blog.marca.com/women/p/post-1">blog</a></body></html>')
        web = FakeWeb({"https://marca.com/robots.txt": (200, b"User-agent: *\nDisallow: /women/jeans/pagina2\nSitemap: https://marca.com/sitemap.xml", "text/plain"),
                       "https://marca.com/sitemap.xml": (200, urlset("https://marca.com/women/jeans", "https://marca.com/sobre-nos"), XML),
                       "https://marca.com/women/jeans": (200, cat, HTML),
                       "https://marca.com/women/jeans/p/jeans-reta-1": (200, ld({**TEE, "brand": "Marca", "name": "Calça Jeans Reta"}), HTML)})
        got = []
        rep = collect(Site("marca.com", web, polite()[0]), "Marca", "OFFICIAL_BRAND", N, 10, on_item=got.append)
        self.assertEqual(rep["accepted"], 1)
        self.assertEqual(rep["crawled_categories"], 1)
        self.assertEqual(got[0]["subcategory"], "jeans")
        self.assertNotIn("https://outra.com/p/x", web.calls)
        self.assertNotIn("https://marca.com/women/jeans/pagina2", web.calls)
        self.assertNotIn("https://marca.com/sobre-nos", web.calls)
        self.assertNotIn("https://blog.marca.com/women/p/post-1", web.calls)   # subdomínio que não é a loja: um 403 lá pararia tudo

    def test_busca_melhorada_sem_pista_na_url_segue_links_folha_da_pagina_inicial(self):
        # loja sem sitemap e sem "product" na URL (Magento: /chuck-70-…): da página inicial, segue os links "folha"
        home = b'<html><body><a href="/feminino-c">Fem</a><a href="/camiseta-chuck-basica-ct123">Chuck</a><a href="/sobre">Sobre</a></body></html>'
        web = FakeWeb({"https://loja.com/robots.txt": (200, b"User-agent: *\nAllow: /", "text/plain"),
                       "https://loja.com/": (200, home, HTML),
                       "https://loja.com/camiseta-chuck-basica-ct123": (200, ld({**TEE, "brand": "Loja", "name": "Camiseta Chuck Básica"}), HTML)})
        rep = collect(Site("loja.com", web, polite()[0]), "Loja", "OFFICIAL_BRAND", N, 10)
        self.assertEqual(rep["accepted"], 1)
        self.assertGreaterEqual(rep["crawled_categories"], 1)

    def test_link_de_produto_sem_pista_pela_forma_do_ultimo_segmento(self):
        from providers.official_sitemap import looks_like_product_leaf
        for u in ("https://www.balenciaga.com/en-us/alaska-fur-high-boot-brown-802177WBFC12200.html", "https://www.balenciaga.com/A006QCWCG822290.html",
                  "https://www.ralphlauren.com/men-clothing-polos/custom-slim-fit-mesh-polo-shirt/0043104999.html",
                  "https://converse.com.br/chuck-70-material-cano-alto-ct35630001-verde", "https://loja.com/camiseta-chuck-basica-ct123"):
            self.assertTrue(looks_like_product_leaf(u), u)
        for u in ("https://www.birkenstock.com/de-en/privacy-policy.html", "https://www.balenciaga.com/en-us/women/shoes-for-women/boots-for-women",
                  "https://loja.com/sobre", "https://loja.com/feminino-c", "https://loja.com/busca?q=jeans", "https://loja.com/"):
            self.assertFalse(looks_like_product_leaf(u), u)

    def test_limite_e_visitados(self):
        urls = [f"https://www.nike.com.br/p/{i}" for i in range(5)]
        pages = {"https://www.nike.com.br/sitemap_index.xml": (200, urlset(*urls), XML)}
        pages.update({u: (200, ld({**TEE, "sku": u[-1], "offers": {"url": u}}), HTML) for u in urls})
        site, _, _ = self.site(pages)
        out = []
        rep = collect(site, "Nike", "OFFICIAL_STORE", N, 2, visited={urls[0]}, on_item=out.append)
        self.assertEqual(rep["accepted"], 2)
        self.assertEqual([i["official_product_url"] for i in out], urls[1:3])


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


class CliTest(unittest.TestCase):
    BRANDS = [{"name": "Nike", "sources": [{"domain": "nike.com.br", "source_type": "OFFICIAL_STORE"},
                                           {"domain": "revenda.com", "source_type": "MANUAL_ADMIN"}]},
              {"name": "Outra", "sources": [{"domain": "outra.com", "source_type": "OFFICIAL_BRAND"}]}]

    def args(self, out, **kw):
        base = dict(brands="nike", max_per_brand=10, min_interval=0, timeout=5, user_agent="t", out=out, fresh=False,
                    dry_run=False, verbose=False, workers=2, progress_every=50)
        return SimpleNamespace(**{**base, **kw})

    def test_url_com_acento_vira_ascii(self):
        self.assertEqual(collect_official.ascii_url("https://www.loja.com.br/camiseta-básica?cor=azul marinho"),
                         "https://www.loja.com.br/camiseta-b%C3%A1sica?cor=azul%20marinho")
        self.assertEqual(collect_official.ascii_url("https://www.loja.com/p/a%20b"), "https://www.loja.com/p/a%20b")

    def test_corpo_gzip_mesmo_pedindo_identity(self):
        page = b'<html><script type="application/ld+json">{"@type":"Product","name":"Bermuda"}</script></html>'
        zipped = gzip.compress(page)
        self.assertEqual(collect_official.decoded(zipped, "gzip"), page)
        self.assertEqual(collect_official.decoded(zipped, None), page)            # sem cabeçalho: pela assinatura
        self.assertEqual(collect_official.decoded(zlib.compress(page), "deflate"), page)
        self.assertEqual(collect_official.decoded(page, None), page)
        self.assertTrue(page.startswith(collect_official.decoded(zipped[:-12], "gzip")))   # truncado: o que deu para ler
        self.assertEqual(collect_official.decoded(b"lixo", "gzip"), b"")

    def test_so_fontes_oficiais(self):
        srcs = collect_official.official_sources(self.BRANDS, None)
        self.assertEqual([s["domain"] for _, s in srcs], ["nike.com.br", "outra.com"])
        self.assertEqual(len(collect_official.official_sources(self.BRANDS, {"nike"})), 1)

    def test_jsonl_retomada_e_importacao(self):
        urls = ["https://www.nike.com.br/p/1", "https://www.nike.com.br/p/2"]
        pages = {"https://nike.com.br/robots.txt": (200, b"Sitemap: https://www.nike.com.br/sm.xml", "text/plain"),
                 "https://www.nike.com.br/sm.xml": (200, urlset(*urls), XML)}
        pages.update({u: (200, ld({**TEE, "sku": u[-1], "offers": {"url": u}}), HTML) for u in urls})
        with tempfile.TemporaryDirectory() as tmp:
            web = FakeWeb(pages)
            total = collect_official.run(self.args(tmp), fetch=web, brands=self.BRANDS, log=lambda *_: None)
            self.assertEqual(total["accepted"], 2)
            jsonl = Path(tmp) / "nike.jsonl"
            rows = list(read_items(jsonl))
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0][0], "nike.jsonl:1")
            for _, raw in rows:
                normalize_product(raw, N)
            web2 = FakeWeb(pages)                                  # segunda rodada: nada repetido, páginas não rebaixadas
            total2 = collect_official.run(self.args(tmp), fetch=web2, brands=self.BRANDS, log=lambda *_: None)
            self.assertEqual(total2["accepted"], 0)
            self.assertFalse(set(urls) & set(web2.calls))
            self.assertEqual(len(jsonl.read_text(encoding="utf-8").splitlines()), 2)

    def test_sem_produto_nao_cria_arquivo(self):
        with tempfile.TemporaryDirectory() as tmp:
            collect_official.run(self.args(tmp), fetch=FakeWeb({}), brands=self.BRANDS, log=lambda *_: None)
            self.assertFalse((Path(tmp) / "nike.jsonl").exists())

    def test_dry_run_nao_grava(self):
        pages = {"https://nike.com.br/robots.txt": (200, b"", "text/plain"),
                 "https://nike.com.br/sitemap.xml": (200, urlset("https://nike.com.br/p/1"), XML),
                 "https://nike.com.br/p/1": (200, ld(TEE), HTML)}
        with tempfile.TemporaryDirectory() as tmp:
            total = collect_official.run(self.args(tmp, dry_run=True), fetch=FakeWeb(pages), brands=self.BRANDS, log=lambda *_: None)
            self.assertEqual(total["accepted"], 1)
            self.assertEqual(list(Path(tmp).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
