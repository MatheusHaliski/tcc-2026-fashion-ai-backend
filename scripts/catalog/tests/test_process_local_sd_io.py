"""Lote local de peça inteira: download (og:image, link direto, imagem recusada), polidez por host e disjuntor,
dispositivo e SQL — sem rede nem banco."""
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import process_local_sd as sd  # noqa: E402


class DownloadTest(unittest.TestCase):
    def test_og_image_de_pagina_html_e_link_direto(self):
        page = (b'<html><head><meta property="og:title" content="Camisa"><meta property=og:image content="//cdn.brand.com/a.jpg?w=1200">'
                b'</head><body></body></html>')
        self.assertEqual(sd.og_image(page, "https://brand.com/p/camisa"), "https://cdn.brand.com/a.jpg?w=1200")
        self.assertIsNone(sd.og_image(b"<html><head></head></html>", "https://brand.com/x"))
        png = io.BytesIO(); Image.new("RGB", (8, 8), "red").save(png, "PNG")
        web = {"https://brand.com/p/camisa": (200, page, "text/html; charset=utf-8"),
               "https://cdn.brand.com/a.jpg?w=1200": (200, png.getvalue(), "image/png"),
               "https://brand.com/direta.png": (200, png.getvalue(), "image/png"),
               "https://brand.com/fora.png": (404, b"", ""), "https://brand.com/bloqueada.png": (403, b"", "")}
        fetch = lambda u: web.get(u, (404, b"", ""))
        self.assertEqual(sd.resolve_image("https://brand.com/p/camisa", fetch)[1], "https://cdn.brand.com/a.jpg?w=1200")
        self.assertEqual(sd.resolve_image("https://brand.com/direta.png", fetch)[1], "https://brand.com/direta.png")
        with self.assertRaises(sd.PhotoSkip) as c1:
            sd.resolve_image("https://brand.com/fora.png", fetch)
        self.assertEqual(c1.exception.status, "REJECTED")
        with self.assertRaises(sd.PhotoSkip) as c2:
            sd.resolve_image("https://brand.com/bloqueada.png", fetch)
        self.assertEqual(c2.exception.status, "RETRY")
        with self.assertRaises(sd.PhotoSkip):
            sd.resolve_image("javascript:alert(1)", fetch)

    def test_imagem_pequena_ou_corrompida_e_recusada(self):
        small = io.BytesIO(); Image.new("RGB", (299, 400), "red").save(small, "PNG")
        with self.assertRaises(sd.PhotoSkip) as c:
            sd.open_image(small.getvalue())
        self.assertEqual(str(c.exception), "BELOW_MINIMUM_300X300")
        with self.assertRaises(sd.PhotoSkip) as c2:
            sd.open_image(b"not an image")
        self.assertEqual(str(c2.exception), "CORRUPT_IMAGE")


class PoliteFetchTest(unittest.TestCase):
    def test_intervalo_por_host_e_espera_em_429(self):
        calls = []; slept = []; t = [0.0]
        answers = {"https://cdn.loja.com/a.png": [(429, b"", "retry-after:2"), (200, b"ok", "image/png")],
                   "https://cdn.loja.com/b.png": [(200, b"ok", "image/png")], "https://outra.com/c.png": [(200, b"ok", "image/png")]}
        def raw(url):
            calls.append((round(t[0], 2), url)); return answers[url].pop(0)
        def sleep(s): slept.append(round(s, 2)); t[0] += s
        fetch = sd.polite_fetch(raw, min_interval=1.0, retries=2, sleep=sleep, clock=lambda: t[0])
        self.assertEqual(fetch("https://cdn.loja.com/a.png")[0], 200)        # 429 → espera Retry-After (2 s) → 200
        self.assertEqual(fetch("https://outra.com/c.png")[0], 200)           # outro host: sem espera
        self.assertEqual(fetch("https://cdn.loja.com/b.png")[0], 200)        # mesmo host: espera o intervalo
        self.assertEqual([u.rsplit("/", 1)[1] for _, u in calls], ["a.png", "a.png", "c.png", "b.png"])
        self.assertIn(2.0, slept)                                             # Retry-After respeitado
        self.assertTrue(all(0 < s_ <= 2.0 for s_ in slept))
        gaps = [c for c in calls if "cdn.loja.com" in c[1]]
        self.assertGreaterEqual(gaps[-1][0] - gaps[-2][0], 1.0)              # intervalo mínimo entre pedidos ao mesmo host

    def test_429_persistente_vira_retry_no_relatorio(self):
        fetch = sd.polite_fetch(lambda u: (429, b"", "retry-after:"), min_interval=0, retries=1, sleep=lambda s: None, clock=lambda: 0.0)
        with self.assertRaises(sd.PhotoSkip) as c:
            sd.resolve_image("https://cdn.loja.com/a.png", fetch)
        self.assertEqual(c.exception.status, "RETRY")

    def test_disjuntor_por_host_para_de_consultar_quem_pediu_para_parar(self):
        calls = []

        def raw(url):
            calls.append(url)
            return (200, b"ok", "image/png") if "outra.com" in url else (429, b"", "retry-after:")
        fetch = sd.polite_fetch(raw, min_interval=0, retries=0, sleep=lambda s: None, clock=lambda: 0.0, host_limit=3)
        for i in range(3):
            self.assertEqual(fetch(f"https://cdn.loja.com/{i}.png")[0], 429)
        self.assertEqual(fetch("https://cdn.loja.com/4.png"), (429, b"", sd.HOST_PAUSED))    # sem pedido: o host pediu para parar
        self.assertEqual(fetch("https://outra.com/c.png")[0], 200)                           # outro host segue normal
        self.assertEqual(len(calls), 4)
        with self.assertRaises(sd.PhotoSkip) as c:
            sd.resolve_image("https://cdn.loja.com/5.png", fetch)
        self.assertEqual((c.exception.status, str(c.exception)), ("RETRY", "HTTP_429_HOST_PAUSED"))
        # um 200 zera a conta; host_limit=0 desliga o disjuntor
        ok_then_429 = iter([(200, b"ok", "image/png")] + [(429, b"", "retry-after:")] * 5)
        fetch2 = sd.polite_fetch(lambda u: next(ok_then_429), min_interval=0, retries=0, sleep=lambda s: None, clock=lambda: 0.0, host_limit=2)
        self.assertEqual([fetch2("https://x.com/a")[0], fetch2("https://x.com/b")[0], fetch2("https://x.com/c")[0]], [200, 429, 429])
        self.assertEqual(fetch2("https://x.com/d")[2], sd.HOST_PAUSED)
        n = []
        fetch3 = sd.polite_fetch(lambda u: n.append(1) or (429, b"", ""), min_interval=0, retries=0, sleep=lambda s: None, clock=lambda: 0.0, host_limit=0)
        [fetch3("https://y.com/z") for _ in range(5)]
        self.assertEqual(len(n), 5)


class DeviceTest(unittest.TestCase):
    def test_cuda_mps_cpu(self):
        fake = lambda cuda, mps: SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: cuda),
                                                 backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: mps)))
        self.assertEqual(sd.pick_device(fake(True, True)), "cuda")
        self.assertEqual(sd.pick_device(fake(False, True)), "mps")
        self.assertEqual(sd.pick_device(fake(False, False)), "cpu")
        self.assertEqual(sd.pick_device(fake(True, True), "cpu"), "cpu")
        calls = []
        torch = SimpleNamespace(cuda=SimpleNamespace(empty_cache=lambda: calls.append("cuda")), mps=SimpleNamespace(empty_cache=lambda: calls.append("mps")))
        sd.free_memory("cuda", torch); sd.free_memory("mps", torch); sd.free_memory("cpu", torch)
        self.assertEqual(calls, ["cuda", "mps"])


class SqlTest(unittest.TestCase):
    def test_sql_pendentes_e_identificadores(self):
        spec = sd.TableSpec()
        sql = sd.pending_sql(spec)
        self.assertIn("JOIN catalog_products", sql); self.assertIn("processed_image_url IS NULL", sql); self.assertIn("<> 'REJECTED'", sql)
        generic = sd.pending_sql(sd.TableSpec("products", "id", "image_url", "processed_image_url"), product_id="x")
        self.assertTrue(generic.startswith("SELECT * FROM products WHERE")); self.assertIn("id = :product_id", generic)
        with self.assertRaises(SystemExit):
            sd.TableSpec("products; DROP TABLE x")
        row = sd.normalize_row({"ID": "7", "url": "https://b/x.png", "brand": {"name": "Nike"}}, sd.TableSpec("products"))
        self.assertEqual((row["id"], row["image_url"], row["brand"], row["product_id"]), ("7", "https://b/x.png", "Nike", "7"))
        self.assertEqual(sd.output_name({"brand": "Dr. Martens", "category": "shoes_piece", "product_id": "p1", "id": "img-123456789"}),
                         "Dr_Martens_shoes_piece_p1_img-1234.png")


if __name__ == "__main__":
    unittest.main()
