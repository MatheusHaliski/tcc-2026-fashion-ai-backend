"""Coletor oficial (sitemaps + JSON-LD) sem rede: páginas de exemplo num fetch falso."""
import gzip
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

from providers.official_sitemap import Site, collect, looks_like_product, product_urls  # noqa: E402
from scripts.catalog.tests.sitemap_fixture import HTML, N, TEE, XML, FakeWeb, index, ld, polite, urlset  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
