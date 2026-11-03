"""Lote local de peça inteira de ponta a ponta com dublês: gravação, dry-run e measure-only, engine fashn-open (LaMa,
alfa fino, SD opcional) e o photoSet gravado."""
import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import process_local_sd as sd  # noqa: E402
from scripts.catalog.tests.local_sd_fixture import FakeFiller, FakeFusionProvider, FakeRenderer, Provider, shirt_photo  # noqa: E402


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

    def test_photo_set_grava_whole_fabric_e_set_json_com_preflight_atestado(self):
        import fashn_open as fo
        im, target, forbidden = shirt_photo()
        png = io.BytesIO(); im.save(png, "PNG")
        row = {"id": "img-1", "product_id": "p1", "brand": "Marca", "category": "upper_piece", "subcategory": "t_shirt",
               "image_url": "https://brand.com/ok.png", "color": "blue"}
        fetch = lambda u: (200, png.getvalue(), "image/png")

        class Provider:
            """Fusão da fixture (sem o risco externo) com a evidência que o engine real traria."""

            def __init__(self, evidence):
                self.evidence = evidence

            def analyse(self, image, category, subcategory):
                t = np.asarray(target.convert("L")) >= 128; t[:150] = False
                f = np.asarray(forbidden.convert("L")) >= 128
                return fo.Fusion(t, f, t.astype(np.float32), "parser+birefnet", True, ("top",), self.evidence)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            ok = Provider({"touchesBorder": False, "bodyInsideFraction": 0.01, "occluderFraction": 0.0})
            results = sd.GhostPipeline(None, sd.Options(out_dir=out / "a", engine="fashn-open", dry_run=True, photo_set=True), fetch=fetch,
                                       open_provider=ok, filler=FakeFiller()).run([row])
            self.assertEqual(results[0]["status"], "RENDERED"); self.assertEqual(results[0]["metrics"]["preflight"]["status"], "PASS")
            ps = results[0]["photoSet"]; self.assertEqual(ps["status"], "READY")
            folder = Path(ps["dir"]); data = json.loads((folder / "set.json").read_text(encoding="utf-8"))
            self.assertEqual((data["version"], data["status"], data["imageId"], data["sourceUrl"], data["color"]),
                             ("CATALOG_PHOTO_SET_V2", "READY", "img-1", "https://brand.com/ok.png", "blue"))
            self.assertEqual(data["sourceSha256"], hashlib.sha256(png.getvalue()).hexdigest())
            pf = data["metrics"]["preflight"]
            self.assertTrue(pf["measurementReliable"] and pf["complete"] and pf["isolationVerified"] and pf["humanAssessmentComplete"])
            self.assertFalse(pf["occluded"]); self.assertGreaterEqual(pf["sourceGarmentHeightFraction"], 0.25)
            self.assertEqual(data["files"], {"whole": "whole.png", "fabric": "fabric.png"})
            whole = Image.open(folder / "whole.png")
            self.assertEqual((whole.size, whole.mode), ((900, 1200), "RGBA"))
            self.assertEqual(whole.getpixel((5, 5)), (255, 255, 255, 0), "fundo transparente com RGB branco por baixo")
            self.assertEqual(whole.getpixel((450, 600))[3], 255, "peça opaca no centro")
            fabric = Image.open(folder / "fabric.png"); self.assertAlmostEqual(fabric.width / fabric.height, 0.75, places=2)
            self.assertEqual(data["metrics"]["fabric"]["coverage"], 1.0); self.assertIn("box", data["metrics"]["whole"])
            # mão sobre o tecido: oclusão incerta → o preflight não passa, o conjunto fica REVIEW e nenhuma imagem é gravada
            unsure = Provider({"touchesBorder": False, "bodyInsideFraction": 0.0, "occluderFraction": 0.08})
            results = sd.GhostPipeline(None, sd.Options(out_dir=out / "b", engine="fashn-open", dry_run=True, photo_set=True), fetch=fetch,
                                       open_provider=unsure, filler=FakeFiller()).run([row])
            ps = results[0]["photoSet"]; self.assertEqual((ps["status"], ps["reason"]), ("REVIEW", "GARMENT_OCCLUSION_UNCERTAIN"))
            self.assertFalse((Path(ps["dir"]) / "whole.png").exists()); self.assertTrue((Path(ps["dir"]) / "set.json").exists())

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
