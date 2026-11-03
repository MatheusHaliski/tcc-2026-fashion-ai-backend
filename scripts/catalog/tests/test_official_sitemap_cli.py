"""Coletor oficial pela CLI (collect_official.run) sem rede: fontes oficiais, corpo gzip, JSONL com retomada e
importação, dry-run."""
import gzip
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
from normalize_product import normalize_product  # noqa: E402
from scripts.catalog.tests.sitemap_fixture import HTML, N, TEE, XML, FakeWeb, ld, urlset  # noqa: E402


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
