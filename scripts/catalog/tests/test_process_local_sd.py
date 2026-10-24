"""Peça inteira local com Stable Diffusion: as partes puras (máscara fantasma, composição, og:image, SQL, lote) sem GPU,
sem rede e sem modelo — o renderizador é um dublê que pinta a região pedida."""
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from photo_set import PhotoMasks  # noqa: E402
import process_local_sd as sd  # noqa: E402


def shirt_photo(size=(600, 800)):
    """Camiseta azul com gola em anel (buraco fechado com pele dentro), braços de pele saindo das mangas e um risco preto fora."""
    im = Image.new("RGB", size, (235, 235, 235))
    d = ImageDraw.Draw(im)
    d.rectangle((150, 200, 450, 700), fill=(30, 60, 160))          # tronco da camiseta
    d.rectangle((60, 200, 150, 330), fill=(30, 60, 160))           # manga esquerda
    d.rectangle((450, 200, 540, 330), fill=(30, 60, 160))          # manga direita
    d.ellipse((250, 170, 350, 260), fill=(224, 172, 140))          # pescoço (pele) dentro da gola
    d.rectangle((20, 330, 150, 520), fill=(224, 172, 140))         # braço esquerdo (pele) abaixo da manga
    d.rectangle((450, 330, 580, 520), fill=(224, 172, 140))        # braço direito
    d.line((30, 30, 580, 120), fill=(0, 0, 0), width=2)            # risco fora do perímetro
    target = Image.new("L", size, 0)
    t = ImageDraw.Draw(target)
    t.rectangle((150, 200, 450, 700), fill=255); t.rectangle((60, 200, 150, 330), fill=255); t.rectangle((450, 200, 540, 330), fill=255)
    t.ellipse((250, 170, 350, 260), fill=0)                        # a gola é um buraco na máscara da peça
    t.line((30, 30, 580, 120), fill=255, width=2)                  # o segmentador "pegou" o risco
    forbidden = Image.new("L", size, 0)
    f = ImageDraw.Draw(forbidden)
    f.ellipse((250, 170, 350, 260), fill=255); f.rectangle((20, 330, 150, 520), fill=255); f.rectangle((450, 330, 580, 520), fill=255)
    f.line((31, 29, 580, 120), fill=255, width=2)
    return im, target, forbidden


def masks(target, forbidden, category="upper_piece", subcategory="t_shirt"):
    return PhotoMasks(target, forbidden, verified=True, target_category=category, target_subcategory=subcategory,
                      human_present=True, source="fixture")


class GhostMaskTest(unittest.TestCase):
    def test_fantasma_so_onde_o_corpo_aparece_por_dentro_da_peca(self):
        im, target, forbidden = shirt_photo()
        t, f = np.asarray(target) >= 128, np.asarray(forbidden) >= 128
        ghost = sd.ghost_mask(t, f, feather=0)
        self.assertTrue(ghost[215, 300])              # pescoço entre os ombros, dentro da gola aberta
        self.assertFalse(ghost[185, 300])             # acima da linha dos ombros (rosto) não entra
        self.assertFalse(ghost[400, 300])             # tecido nunca entra
        self.assertFalse(ghost[420, 100])             # braço ao lado do tronco, abaixo da manga: vira fundo
        self.assertFalse(ghost[60, 300])              # risco fora do perímetro não vira fantasma
        self.assertFalse(sd.ghost_mask(np.zeros((10, 10), bool), None).any())

    def test_sem_mascara_de_corpo_so_os_buracos_fechados(self):
        target = Image.new("L", (400, 400), 0)
        d = ImageDraw.Draw(target); d.rectangle((100, 100, 300, 360), fill=255); d.ellipse((170, 130, 230, 180), fill=0)   # gola fechada
        ghost = sd.ghost_mask(np.asarray(target) >= 128, None, feather=0)
        self.assertTrue(ghost[155, 200]); self.assertFalse(ghost[250, 200]); self.assertFalse(ghost[50, 200])
        # gola aberta para o fundo (fixture da camiseta) sem máscara de corpo: nada a preencher
        _, open_neck, _ = shirt_photo()
        self.assertFalse(sd.ghost_mask(np.asarray(open_neck) >= 128, None, feather=0).any())


class ForegroundBodyTest(unittest.TestCase):
    def test_corpo_e_o_primeiro_plano_menos_a_peca_com_folga(self):
        target = np.zeros((100, 100), bool); target[30:80, 30:70] = True            # peça
        fg = target.copy(); fg[10:30, 40:60] = True; fg[30:80, 20:30] = True        # pescoço acima e braço ao lado
        body = sd.body_from_foreground(target, fg, margin=2)
        self.assertTrue(body[15, 50]); self.assertTrue(body[50, 22])
        self.assertFalse(body[50, 50]); self.assertFalse(body[29, 50]); self.assertFalse(body[50, 29])   # peça e folga

    def test_masks_for_deduz_o_corpo_quando_o_provedor_nao_traz(self):
        im = Image.new("RGB", (100, 100))
        target = Image.new("L", im.size, 0); ImageDraw.Draw(target).rectangle((30, 30, 69, 79), fill=255)
        fg = Image.new("L", im.size, 0); ImageDraw.Draw(fg).rectangle((20, 10, 69, 79), fill=255)
        provider = type("P", (), {"masks": lambda self, image, c, s=None: PhotoMasks(target, None, verified=True, target_category=c, target_subcategory=s, source="u2net")})()
        segmenter = type("S", (), {"mask": lambda self, image, **k: fg})()
        masks = sd.masks_for(im, "upper_piece", "t_shirt", provider, segmenter)
        self.assertIsNotNone(masks.forbidden); self.assertTrue(masks.human_present); self.assertIn("isnet-foreground", masks.source)
        self.assertEqual(np.asarray(masks.forbidden)[15, 50], 255); self.assertEqual(np.asarray(masks.forbidden)[50, 50], 0)
        self.assertIsNone(sd.masks_for(im, "upper_piece", "t_shirt", provider, segmenter, foreground_body=False).forbidden)
        shoes = sd.masks_for(im, "shoes_piece", "sneaker", provider, segmenter)
        self.assertIsNone(shoes.forbidden); self.assertEqual(shoes.source, "isnet-general-use")


class MeasureAndComposeTest(unittest.TestCase):
    def test_mede_limpa_e_compoe_com_o_tecido_original_e_a_ia_so_no_fantasma(self):
        im, target, forbidden = shirt_photo()
        t, f, metrics = sd.measure(im, masks(target, forbidden), "upper_piece", "t_shirt", im.size)
        self.assertFalse(t[60, 300])                                     # o risco saiu na limpeza
        self.assertAlmostEqual(metrics["sourceGarmentHeightFraction"], 500 / 800, places=2)
        ghost = sd.ghost_mask(t, f)
        generated = Image.new("RGB", im.size, (255, 0, 0))               # dublê da IA: pinta tudo de vermelho
        shot = sd.compose_packshot(im, t, generated, ghost)
        with Image.open(io.BytesIO(shot.data)) as out:
            self.assertEqual(out.size, (900, 1200))
            box = shot.info["box"]
            self.assertAlmostEqual(max(box["w"], box["h"]), 0.5, places=2)
            cx, cy = 450, 600
            self.assertLess(out.getpixel((cx, cy))[0], 80)               # azul original no centro: a IA não redesenhou o tecido
            # a gola (fantasma) ficou com o resultado da IA (vermelho) e não com a pele
            # a peça recortada vai de x 60..540 e y 200..700 na foto; o pescoço (300, 230) cai no meio, perto do topo
            gx = int((box["x"] + box["w"] * ((300 - 60) / 480)) * 900); gy = int((box["y"] + box["h"] * ((230 - 200) / 500)) * 1200)
            self.assertGreater(out.getpixel((gx, gy))[0], 200); self.assertLess(out.getpixel((gx, gy))[1], 80)
            self.assertEqual(out.getpixel((20, 20)), (255, 255, 255))   # fundo branco
        self.assertTrue(shot.info["ai"]); self.assertGreater(shot.info["ghostPixels"], 0)

    def test_sem_ia_e_so_o_recorte_centralizado(self):
        im, target, forbidden = shirt_photo()
        t, f, _ = sd.measure(im, masks(target, forbidden), "upper_piece", "t_shirt", im.size)
        shot = sd.compose_packshot(im, t, None, sd.ghost_mask(t, f), shadow=False)
        with Image.open(io.BytesIO(shot.data)) as out:
            self.assertEqual(out.getpixel((450, 600))[2] > 100, True)
        self.assertFalse(shot.info["ai"]); self.assertEqual(shot.info["ghostPixels"], 0)

    def test_peca_baixa_demais_e_inelegivel_sem_gerar(self):
        im = Image.new("RGB", (600, 800), "white")
        target = Image.new("L", im.size, 0); ImageDraw.Draw(target).rectangle((200, 300, 400, 450), fill=255)   # 150/800 = 19%
        with self.assertRaises(sd.PhotoSkip) as ctx:
            sd.measure(im, masks(target, Image.new("L", im.size, 0)), "upper_piece", "t_shirt", im.size)
        self.assertEqual(ctx.exception.status, "INELIGIBLE")
        self.assertEqual(str(ctx.exception), "SOURCE_GARMENT_BELOW_MIN_HEIGHT")
        self.assertAlmostEqual(ctx.exception.metrics["sourceGarmentHeightFraction"], 151 / 800, places=3)

    def test_entradas_da_ia_recortam_a_peca_em_multiplos_de_8(self):
        im, target, forbidden = shirt_photo()
        t = np.asarray(target) >= 128; f = np.asarray(forbidden) >= 128
        init, mask, box = sd.sd_inputs(im, t, sd.ghost_mask(t, f), 512)
        self.assertEqual(init.size, mask.size)
        self.assertEqual(init.width % 8, 0); self.assertEqual(init.height % 8, 0); self.assertLessEqual(max(init.size), 512)
        self.assertLess(box[0], 60); self.assertGreater(box[2], 540)
        self.assertGreater(np.asarray(mask).max(), 0)


class LenientCleanupTest(unittest.TestCase):
    def test_contorno_fino_nao_classificado_cai_na_limpeza_tolerante(self):
        im = Image.new("RGB", (400, 600), "white")
        target = Image.new("L", im.size, 0); d = ImageDraw.Draw(target)
        d.rectangle((120, 100, 180, 500), fill=255); d.rectangle((220, 100, 280, 500), fill=255)   # duas pernas
        d.line((180, 300, 395, 300), fill=255, width=1)                                             # fio NÃO classificado (4-conexo, preso à perna)
        empty = Image.new("L", im.size, 0)
        with self.assertRaises(sd.PhotoSkip) as strict:
            sd.measure(im, masks(target, empty, "lower_piece", "jeans"), "lower_piece", "jeans", im.size, lenient=False)
        self.assertEqual(str(strict.exception), "UNCLASSIFIED_THIN_CONTOUR")
        t, _, metrics = sd.measure(im, masks(target, empty, "lower_piece", "jeans"), "lower_piece", "jeans", im.size)
        self.assertEqual(metrics["cleanup"]["cleanupMode"], "LENIENT_OPENING"); self.assertEqual(metrics["cleanup"]["strictReason"], "UNCLASSIFIED_THIN_CONTOUR")
        self.assertEqual(metrics["cleanup"]["retainedParts"], 2); self.assertFalse(t[300, 380]); self.assertTrue(t[300, 150]); self.assertTrue(t[300, 250])
        clean = Image.new("L", im.size, 0); ImageDraw.Draw(clean).rectangle((120, 100, 280, 500), fill=255)
        self.assertEqual(sd.measure(im, masks(clean, empty, "upper_piece", "t_shirt"), "upper_piece", "t_shirt", im.size)[2]["cleanup"]["cleanupMode"], "STRICT")


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


class FakeRenderer:
    def __init__(self):
        self.calls = 0; self.max_side = 512; self.model = "fake"; self.device = "cpu"; self.steps = 1; self.guidance = 1.0; self.seed = 0; self.controlnet = False

    def render(self, init, mask):
        self.calls += 1
        return Image.new("RGB", init.size, (255, 0, 0))

    def free(self):
        pass


class Provider:
    def __init__(self, target, forbidden):
        self.target, self.forbidden = target, forbidden

    def masks(self, image, category, subcategory=None):
        return masks(self.target, self.forbidden, category, subcategory)


class PipelineTest(unittest.TestCase):
    def test_lote_gera_grava_e_nao_para_em_erro(self):
        im, target, forbidden = shirt_photo()
        png = io.BytesIO(); im.save(png, "PNG")
        web = {"https://brand.com/ok.png": (200, png.getvalue(), "image/png"), "https://brand.com/404.png": (404, b"", ""),
               "https://brand.com/corrupt.png": (200, b"zzz", "image/png")}
        rows = [{"id": "i1", "product_id": "p1", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt", "image_url": "https://brand.com/ok.png"},
                {"id": "i2", "product_id": "p2", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt", "image_url": "https://brand.com/404.png"},
                {"id": "i3", "product_id": "p3", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt", "image_url": "https://brand.com/corrupt.png"}]
        stored = {}
        renderer = FakeRenderer()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "output_images"
            pipe = sd.GhostPipeline(renderer, sd.Options(out_dir=out), fetch=lambda u: web.get(u, (404, b"", "")),
                                    provider=Provider(target, forbidden), segmenter=object())
            results = pipe.run(rows, store=lambda row, value: stored.setdefault(row["id"], value) == value)
            self.assertEqual([r["status"] for r in results], ["RENDERED", "REJECTED", "REJECTED"])
            self.assertEqual(renderer.calls, 1)
            self.assertEqual(stored, {"i1": "output_images/Marca_upper_piece_p1_i1.png".replace("output_images", out.as_posix())})
            self.assertTrue((out / "Marca_upper_piece_p1_i1.png").exists()); self.assertTrue((out / "Marca_upper_piece_p1_i1.json").exists())
            manifest = json.loads((out / "metadata_clean.json").read_text())
            self.assertEqual(manifest["counts"], {"RENDERED": 1, "REJECTED": 2}); self.assertTrue(manifest["complete"])
            self.assertEqual(len((out / "report.jsonl").read_text().splitlines()), 3)
            self.assertEqual(json.loads((out / "ineligible.json").read_text())["products"], [])

    def test_dry_run_e_measure_only_nao_gravam(self):
        im, target, forbidden = shirt_photo()
        png = io.BytesIO(); im.save(png, "PNG")
        row = {"id": "i1", "product_id": "p1", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt", "image_url": "https://brand.com/ok.png"}
        fetch = lambda u: (200, png.getvalue(), "image/png")
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            stored = []
            sd.GhostPipeline(FakeRenderer(), sd.Options(out_dir=out / "a", dry_run=True, public_base_url="https://media.example/packshot/"),
                             fetch=fetch, provider=Provider(target, forbidden), segmenter=object()).run([row], store=lambda r, v: stored.append(v))
            self.assertEqual(stored, [])
            report = json.loads((out / "a" / "report.jsonl").read_text().splitlines()[0])
            self.assertEqual(report["stored_value"], "https://media.example/packshot/Marca_upper_piece_p1_i1.png")
            renderer = FakeRenderer()
            results = sd.GhostPipeline(renderer, sd.Options(out_dir=out / "b", measure_only=True), fetch=fetch,
                                       provider=Provider(target, forbidden), segmenter=object()).run([row], store=lambda r, v: stored.append(v))
            self.assertEqual(results[0]["status"], "MEASURED"); self.assertEqual(renderer.calls, 0); self.assertEqual(stored, [])
            self.assertFalse(list((out / "b").glob("*.png")))


class InpaintInputsTest(unittest.TestCase):
    def test_extra_mask_entra_na_mascara_sem_alargar_o_recorte(self):
        im, target, forbidden = shirt_photo()
        t = np.asarray(target.convert("L")) >= 128
        f = np.asarray(forbidden.convert("L")) >= 128
        ghost = sd.ghost_mask(t, f)
        init, mask, box = sd.sd_inputs(im, t, ghost, 4000)
        init2, mask2, box2 = sd.sd_inputs(im, t, ghost, 4000, extra_mask=f)
        self.assertEqual(box, box2); self.assertEqual(init.size, init2.size)
        sx, sy = mask2.width / (box[2] - box[0]), mask2.height / (box[3] - box[1])
        arm = (int((80 - box[0]) * sx), int((420 - box[1]) * sy))          # braço esquerdo (pele) abaixo da manga
        self.assertEqual(mask.getpixel(arm), 0, "sem extra_mask o braço fora da região fantasma não é preenchido")
        self.assertEqual(mask2.getpixel(arm), 255, "com extra_mask o braço some do contexto do preenchimento")
        self.assertGreater(np.asarray(mask2).mean(), np.asarray(mask).mean())


class FakeFusionProvider:
    """Fusão pronta a partir da fixture: alfa = máscara da peça, corpo = forbidden (o que o parser + BiRefNet devolveriam)."""

    def __init__(self, target, forbidden, mode="parser+birefnet"):
        self.target, self.forbidden, self.mode = target, forbidden, mode

    def analyse(self, image, category, subcategory):
        import fashn_open as fo
        t = np.asarray(self.target.convert("L")) >= 128
        f = np.asarray(self.forbidden.convert("L")) >= 128
        return fo.Fusion(t, f, t.astype(np.float32), self.mode, True, ("top",))


class FakeFiller:
    device = "cpu"

    def __init__(self):
        self.calls = 0

    def inpaint(self, image, mask):
        self.calls += 1
        return Image.new("RGB", image.size, (0, 255, 0))


class FashnOpenEngineTest(unittest.TestCase):
    def test_engine_fashn_open_lama_alfa_fino_e_sd_opcional(self):
        im, target, forbidden = shirt_photo()
        png = io.BytesIO(); im.save(png, "PNG")
        row = {"id": "i1", "product_id": "p1", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt", "image_url": "https://brand.com/ok.png"}
        fetch = lambda u: (200, png.getvalue(), "image/png")
        provider = FakeFusionProvider(target, forbidden)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            filler = FakeFiller()
            results = sd.GhostPipeline(None, sd.Options(out_dir=out / "a", engine="fashn-open", dry_run=True), fetch=fetch,
                                       open_provider=provider, filler=filler).run([row])
            self.assertEqual(results[0]["status"], "RENDERED"); self.assertEqual(filler.calls, 1)
            info = results[0]["metrics"]
            self.assertEqual((info["matte"], info["engine"], info["fashnOpen"]["mode"]), ("birefnet", "fashn-open", "parser+birefnet"))
            self.assertIn("lama", info); self.assertNotIn("sd", info); self.assertTrue(info["ai"])
            arr = np.asarray(Image.open(results[0]["image_path"]).convert("RGB"))
            green = int(((arr[..., 1] > 200) & (arr[..., 0] < 60) & (arr[..., 2] < 60)).sum())
            blue = int(((arr[..., 2] > 120) & (arr[..., 0] < 60)).sum())
            self.assertGreater(green, 0, "o preenchimento do LaMa aparece na gola"); self.assertGreater(blue, green, "o tecido original domina")
            renderer, filler2 = FakeRenderer(), FakeFiller()
            results = sd.GhostPipeline(renderer, sd.Options(out_dir=out / "b", engine="fashn-open", dry_run=True), fetch=fetch,
                                       open_provider=provider, filler=filler2).run([row])
            self.assertEqual((filler2.calls, renderer.calls), (1, 1), "--sd: LaMa primeiro, Stable Diffusion por cima")
            self.assertIn("sd", results[0]["metrics"])
            filler3 = FakeFiller()
            results = sd.GhostPipeline(None, sd.Options(out_dir=out / "c", engine="fashn-open", measure_only=True), fetch=fetch,
                                       open_provider=provider, filler=filler3).run([row])
            self.assertEqual(results[0]["status"], "MEASURED"); self.assertEqual(filler3.calls, 0)
            results = sd.GhostPipeline(None, sd.Options(out_dir=out / "d", engine="fashn-open", dry_run=True, no_ai=True), fetch=fetch,
                                       open_provider=provider, filler=FakeFiller()).run([row])
            self.assertEqual(results[0]["status"], "RENDERED"); self.assertFalse(results[0]["metrics"]["ai"]); self.assertEqual(results[0]["metrics"]["matte"], "birefnet")

    def test_compose_com_alfa_fino_usa_a_borda_do_modelo(self):
        im, target, _ = shirt_photo()
        t = np.asarray(target.convert("L")) >= 128
        alpha = np.where(t, 0.6, 0).astype(np.float32)          # semitransparente de propósito: tem de misturar com o fundo
        shot = sd.compose_packshot(im, t, None, np.zeros_like(t), alpha=alpha, shadow=False)
        self.assertEqual(shot.info["matte"], "birefnet")
        center = np.asarray(Image.open(io.BytesIO(shot.data)).convert("RGB"))[600, 450]
        self.assertTrue(100 < center[0] < 140 and 180 < center[2] < 215, center)   # 60 % azul (30,60,160) + 40 % branco


if __name__ == "__main__":
    unittest.main()
