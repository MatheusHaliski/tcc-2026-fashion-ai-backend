"""--force-category-frame: decisão explícita do responsável pelo lote.

Dispensa só a autorização da fonte e a identificação visual confirmada; as proteções técnicas de download, os
checksums, os guardas de concorrência e a limpeza de uploads sem referência continuam iguais. O modo padrão não muda.
"""
import hashlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image

from scripts.catalog.category_frame import FORCED_DECISION, apply_frame, focus_point, frame_rect, report_fields
from scripts.catalog.category_frame_storage import FrameStorage, render_frame_info
from scripts.catalog.process_catalog_images import (
    DownloadFailure, JAVA_TRANSPORT_ERRORS, audit_record, geometric_fallback_response, main,
)


def response(width=1200, height=1600, product=None, focus=None, gate=None, status="APPROVED"):
    crop = {}
    if product is not None:
        crop["product"] = product
    if focus is not None:
        crop["focus"] = focus
    return {"ok": True, "op": "analyze", "outcome": status,
            "columns": {"width": width, "height": height, "processing_status": status, "gate_reasons": gate,
                        "crop_json": json.dumps(crop) if crop else None, "metrics_json": json.dumps({"segmentationConfidence": .9}),
                        "pipeline_version": "CATALOG_IMAGE_PIPELINE_V4", "source_sha256": "a" * 64}}


PRODUCT = {"x": .1, "y": .1, "w": .8, "h": .8}


def frame(result):
    return json.loads(result["columns"]["crop_json"])


class FrameRulesTest(unittest.TestCase):
    """Uma verificação por regra de foco; o quadro é sempre 50% de largura, 3:4 em pixels, dentro da foto."""

    def assert_geometry(self, crop, width, height):
        r = crop["crop"]
        self.assertAlmostEqual(r["w"] * width / (r["h"] * height), .75)
        self.assertGreaterEqual(r["x"], 0); self.assertGreaterEqual(r["y"], 0)
        self.assertLessEqual(r["x"] + r["w"], 1 + 1e-9); self.assertLessEqual(r["y"] + r["h"], 1 + 1e-9)

    def test_parte_de_cima_centra_na_peca(self):
        crop = frame(apply_frame(response(product=PRODUCT), "upper_piece", force=True))
        self.assert_geometry(crop, 1200, 1600)
        self.assertEqual(crop["crop"]["w"], .5)
        self.assertEqual(crop["editorFrame"]["focus"], {"x": .5, "y": .5})
        self.assertEqual(crop["editorFrame"]["focusSource"], "PRODUCT_CENTER")
        self.assertEqual(crop["editorFrame"]["observations"], [])
        self.assertEqual(crop["editorFrame"]["decision"], FORCED_DECISION)

    def test_parte_de_baixo_usa_o_ziper_detectado_ou_estima_o_centro_superior(self):
        detected = frame(apply_frame(response(product=PRODUCT, focus={"name": "waistband_pockets_fastening", "rect": {"x": .4, "y": .2, "w": .2, "h": .2}}), "lower_piece", force=True))
        self.assertEqual(detected["editorFrame"]["focusSource"], "PIPELINE_LANDMARK")
        self.assertEqual(detected["editorFrame"]["focus"], {"x": .5, "y": .3})
        self.assertNotIn("ZIPPER_NOT_DETECTED_ESTIMATED", detected["editorFrame"]["observations"])
        estimated = frame(apply_frame(response(product=PRODUCT, focus={"name": "waistband", "rect": {"x": .4, "y": .1, "w": .2, "h": .1}}), "lower_piece", force=True))
        self.assertEqual(estimated["editorFrame"]["focusSource"], "ESTIMATED_UPPER_CENTER")
        self.assertAlmostEqual(estimated["editorFrame"]["focus"]["y"], .1 + .8 * .25)
        self.assertIn("ZIPPER_NOT_DETECTED_ESTIMATED", estimated["editorFrame"]["observations"])
        # modo forçado conclui mesmo com foco estimado; o modo padrão continua pedindo revisão
        self.assertEqual(apply_frame(response(product=PRODUCT), "lower_piece", force=True)["columns"]["processing_status"], "APPROVED")
        default = apply_frame(response(product=PRODUCT), "lower_piece")["columns"]
        self.assertEqual(default["processing_status"], "NEEDS_REPROCESSING")
        self.assertTrue(frame({"columns": default})["editorFrame"]["requiresReview"])

    def test_calcado_usa_cadarco_detectado_ou_estima_o_cabedal(self):
        laces = frame(apply_frame(response(product=PRODUCT, focus={"name": "laces_tongue_upper", "rect": {"x": .3, "y": .3, "w": .4, "h": .2}}), "shoes_piece", force=True))
        self.assertEqual(laces["editorFrame"]["focusSource"], "PIPELINE_LANDMARK")
        upper = frame(apply_frame(response(product=PRODUCT, focus={"name": "vamp_heel", "rect": {"x": .3, "y": .3, "w": .4, "h": .2}}), "shoes_piece", force=True))
        self.assertEqual(upper["editorFrame"]["focusSource"], "ESTIMATED_UPPER_CENTER")
        self.assertAlmostEqual(upper["editorFrame"]["focus"]["y"], .1 + .8 * .4)
        self.assertIn("LACES_NOT_DETECTED_ESTIMATED", upper["editorFrame"]["observations"])

    def test_acessorio_e_corpo_inteiro_centram_no_objeto(self):
        for category in ("accessory_piece", "full_body_piece"):
            crop = frame(apply_frame(response(product={"x": .5, "y": .5, "w": .3, "h": .3}), category, force=True))
            self.assertEqual(crop["editorFrame"]["focusSource"], "PRODUCT_CENTER")
            self.assertEqual(crop["editorFrame"]["focus"], {"x": .65, "y": .65})

    def test_categoria_desconhecida_centra_no_objeto_ou_na_foto(self):
        known_object = frame(apply_frame(response(product={"x": .2, "y": .2, "w": .2, "h": .2}), "bag_piece", force=True))
        self.assertEqual(known_object["editorFrame"]["focus"], {"x": .3, "y": .3})
        self.assertIn("CATEGORY_UNKNOWN:bag_piece", known_object["editorFrame"]["observations"])
        no_object = frame(apply_frame(response(product=None), None, force=True))
        self.assertEqual(no_object["editorFrame"]["focus"], {"x": .5, "y": .5})
        self.assertEqual(no_object["editorFrame"]["focusSource"], "IMAGE_CENTER")
        self.assertIn("NO_PRODUCT_REGION", no_object["editorFrame"]["observations"])
        # o modo padrão continua recusando categoria desconhecida e peça não detectada
        with self.assertRaises(ValueError):
            apply_frame(response(product=PRODUCT), "bag_piece")
        with self.assertRaises(ValueError):
            apply_frame(response(product=None), "upper_piece")

    def test_peca_nao_detectada_pelo_java_usa_a_foto_inteira_e_registra_o_motivo(self):
        result = apply_frame(response(product=None, gate="IMAGE_TOO_SMALL", status="REJECTED"), "upper_piece", force=True, fallback="NO_PRODUCT:IMAGE_TOO_SMALL")
        crop = frame(result)
        self.assertEqual(crop["product"], {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0})
        self.assertEqual(result["columns"]["processing_status"], "APPROVED")
        self.assertEqual(crop["editorFrame"]["fallback"], "NO_PRODUCT:IMAGE_TOO_SMALL")
        self.assertIn("JAVA_ANALYSIS_FALLBACK:NO_PRODUCT:IMAGE_TOO_SMALL", crop["editorFrame"]["observations"])
        self.assertIn("PIPELINE_GATE:IMAGE_TOO_SMALL", crop["editorFrame"]["observations"])
        self.assertEqual(report_fields(result)["frame_fallback"], "NO_PRODUCT:IMAGE_TOO_SMALL")

    def test_foto_muito_larga_reduz_o_quadro_so_no_modo_forcado(self):
        rect, percent, notes = frame_rect(4000, 1000, .5, .5, force=True)
        self.assertEqual(rect["h"], 1.0)
        self.assertAlmostEqual(rect["w"] * 4000 / (rect["h"] * 1000), .75)
        self.assertLess(percent, 50)
        self.assertIn("FRAME_REDUCED_TO_FIT_IMAGE", notes)
        with self.assertRaisesRegex(ValueError, "DOES_NOT_FIT"):
            frame_rect(4000, 1000, .5, .5)
        clamped = frame(apply_frame(response(product={"x": .9, "y": .9, "w": .1, "h": .1}), "accessory_piece", force=True))
        self.assertIn("FRAME_CLAMPED_TO_IMAGE_BOUNDS", clamped["editorFrame"]["observations"])
        self.assertTrue(clamped["editorFrame"]["clamped"])

    def test_baixa_confianca_vira_observacao(self):
        low = response(product=PRODUCT)
        low["columns"]["metrics_json"] = json.dumps({"segmentationConfidence": .2})
        crop = frame(apply_frame(low, "upper_piece", force=True))
        self.assertIn("LOW_SEGMENTATION_CONFIDENCE", crop["editorFrame"]["observations"])
        self.assertEqual(crop["editorFrame"]["requiresReview"], False)

    def test_focus_point_sem_produto(self):
        self.assertEqual(focus_point("upper_piece", None, None), (.5, .5, "IMAGE_CENTER", "NO_PRODUCT_REGION"))


class FallbackAndStorageTest(unittest.TestCase):
    def test_fallback_geometrico_decodifica_a_foto_e_ampliacao_fica_registrada(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "small.jpg"
            Image.new("RGB", (300, 400), "red").save(path)
            fallback = geometric_fallback_response(path, "CATALOG_IMAGE_PIPELINE_V4", "IMAGE_TOO_SMALL")
            self.assertEqual((fallback["columns"]["width"], fallback["columns"]["height"], fallback["columns"]["mime"]), (300, 400, "image/jpeg"))
            self.assertEqual(fallback["columns"]["source_sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual(fallback["columns"]["gate_reasons"], "JAVA_ANALYSIS_UNAVAILABLE:IMAGE_TOO_SMALL")
            framed = apply_frame(fallback, "accessory_piece", force=True, fallback="IMAGE_TOO_SMALL")
            data, info = render_frame_info(path, json.loads(framed["columns"]["crop_json"]))
            self.assertEqual((info["sourceCropWidth"], info["sourceCropHeight"]), (150, 200))
            self.assertEqual(info["upscaleFactor"], 6.0)
            self.assertEqual(info["qualityNote"], "UPSCALED_REDUCED_QUALITY")
            with Image.open(io.BytesIO(data)) as out:
                self.assertEqual(out.size, (900, 1200))
            with self.assertRaisesRegex(ValueError, "IMAGE_UNREADABLE"):
                broken = Path(directory) / "broken.jpg"
                broken.write_bytes(b"not an image")
                geometric_fallback_response(broken, "CATALOG_IMAGE_PIPELINE_V4", "X")

    def test_assets_json_registra_decisao_original_e_render(self):
        class S3:
            def put_object(self, **kwargs): self.data = kwargs["Body"]
            def get_object(self, **kwargs): return {"Body": io.BytesIO(self.data)}
            def delete_object(self, **kwargs): self.deleted = kwargs["Key"]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.png"
            Image.new("RGB", (1200, 1600), "blue").save(path)
            framed = apply_frame({"columns": {"width": 1200, "height": 1600, "processing_status": "APPROVED",
                                              "crop_json": json.dumps({"product": PRODUCT}), "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}},
                                 "upper_piece", force=True)
            decision = {"mode": FORCED_DECISION, "sourceState": "UNKNOWN", "sourceReason": "SOURCE_HOST_NOT_REGISTERED", "host": "brand.example", "decidedBy": "PROJECT_OWNER"}
            with patch.dict(os.environ, {"S3_BUCKET": "test", "STORAGE_PUBLIC_BASE_URL": "https://media.example.com", "S3_SERVE_THROUGH_API": "false"}):
                assets = FrameStorage(S3()).store({"source_url": "https://brand.example/a.jpg", "stored_url": "https://old/a.jpg", "assets_json": json.dumps({"card": "https://old/a.jpg"})}, framed, path, decision=decision)
            recorded = json.loads(assets["assets_json"])
            self.assertEqual(recorded["persistenceDecision"], decision)
            self.assertEqual(recorded["originalUrl"], "https://brand.example/a.jpg")
            self.assertEqual(recorded["previousStoredUrl"], "https://old/a.jpg")
            self.assertEqual(json.loads(recorded["previousAssets"])["card"], "https://old/a.jpg")
            self.assertEqual(recorded["render"]["upscaleFactor"], 1.5)
            self.assertEqual(recorded["editorFrame"]["decision"], FORCED_DECISION)
            self.assertEqual(assets["render_info"]["sourceCropWidth"], 600)


class ForcedAuditRecordTest(unittest.TestCase):
    def analyzer(self, force=True, storage=None):
        analyzer = Mock(spec=["analyze", "rank", "ready", "category_frame", "force_frame", "frame_storage"])
        analyzer.ready = {"pipelineVersion": "CATALOG_IMAGE_PIPELINE_V4"}
        analyzer.category_frame = True
        analyzer.force_frame = force
        analyzer.frame_storage = storage
        return analyzer

    def record(self, **changes):
        return {"category": "upper_piece", "source_url": "https://brand.example/a.jpg", "image_id": "a", "product_id": "p",
                "allows_image_persistence": False,
                "persistence_decision": {"state": "UNKNOWN", "reason": "SOURCE_HOST_NOT_REGISTERED", "host": "brand.example", "domains": []},
                **changes}

    def test_fonte_nao_autorizada_e_enquadrada_e_persistida_com_a_decisao(self):
        downloader, checkpoint = Mock(), Mock()
        checkpoint.get.return_value = None
        downloader.get.return_value = Path("/tmp/a.img")
        downloader.final_urls = {}
        storage = Mock()
        storage.store.return_value = {"stored_url": "https://media.example.com/f.jpg", "assets_json": "{}", "owned_key": "k", "render_info": {"upscaleFactor": 1.0}}
        analyzer = self.analyzer(storage=storage)
        analyzer.analyze.return_value = response(product=PRODUCT)
        with patch("scripts.catalog.process_catalog_images.public_image_url", side_effect=lambda url: url):
            result = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertNotIn("error", result, result.get("status_note"))
        downloader.get.assert_called_with("https://brand.example/a.jpg", allowed_domains=None)
        decision = storage.store.call_args.kwargs["decision"]
        self.assertEqual(decision["mode"], FORCED_DECISION)
        self.assertEqual(decision["sourceReason"], "SOURCE_HOST_NOT_REGISTERED")
        self.assertTrue(result["java_analysis_completed"])
        self.assertEqual(result["frame_decision"], FORCED_DECISION)
        self.assertEqual(result["frame_render"], {"upscaleFactor": 1.0})
        self.assertEqual(result["analysis"]["columns"]["processing_status"], "APPROVED")

    def test_modo_padrao_continua_bloqueando_a_mesma_fonte(self):
        downloader, checkpoint = Mock(), Mock()
        result = audit_record(self.record(), downloader, self.analyzer(force=False, storage=Mock()), checkpoint, apply=True)
        self.assertEqual(result["error"], "SOURCE_HOST_NOT_REGISTERED")
        downloader.get.assert_not_called()

    def test_java_sem_peca_usa_fallback_e_transporte_continua_falha(self):
        from scripts.catalog.catalog_image_analyzer import AnalyzerError
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "a.jpg"
            Image.new("RGB", (300, 400), "green").save(path)
            downloader, checkpoint = Mock(), Mock()
            checkpoint.get.return_value = None
            downloader.get.return_value = path
            downloader.final_urls = {}
            analyzer = self.analyzer()
            analyzer.analyze.side_effect = AnalyzerError("IMAGE_TOO_SMALL", "pequena")
            result = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
            self.assertNotIn("error", result)
            self.assertFalse(result["java_analysis_completed"])
            self.assertEqual(result["frame_fallback"], "IMAGE_TOO_SMALL")
            checkpoint.put.assert_not_called()
            # falha do canal Java nunca vira enquadramento de uma foto
            for code in sorted(JAVA_TRANSPORT_ERRORS)[:3]:
                analyzer.analyze.side_effect = AnalyzerError(code, "canal")
                failed = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
                self.assertEqual(failed["error"], "JAVA:" + code)

    def test_url_invalida_continua_falha_tecnica_no_modo_forcado(self):
        class Downloader:
            def get(self, url, allowed_domains=None):
                raise DownloadFailure("UNSAFE_IMAGE_URL")
        checkpoint = Mock(); checkpoint.get.return_value = None
        result = audit_record(self.record(source_url="http://brand.example/a.jpg"), Downloader(), self.analyzer(storage=Mock()), checkpoint, apply=True)
        self.assertEqual(result["error"], "UNSAFE_IMAGE_URL")
        self.assertNotIn("analysis", result)

    def test_ja_enquadrada_nesta_versao_e_preservada(self):
        record = self.record(processing_status="APPROVED", pipeline_version="CATALOG_FRAME_34_50_V1", review_status="NONE",
                             stored_url="https://media.example.com/f.jpg", image_url="https://brand.example/a.jpg",
                             assets_json=json.dumps({"card": "https://media.example.com/f.jpg", "framingVersion": "CATALOG_FRAME_34_50_V1", "sha256": "b" * 64}),
                             crop_json=json.dumps({"aspect": "3:4", "crop": {"x": .25, "y": .25, "w": .5, "h": .5}, "ruleCompliant": True,
                                                   "editorFrame": {"version": "CATALOG_FRAME_34_50_V1", "widthPercent": 50, "requiresReview": False}}))
        downloader = Mock()
        result = audit_record(record, downloader, self.analyzer(storage=Mock()), Mock(), apply=True)
        self.assertIn("preservado", result["status_note"])
        downloader.get.assert_not_called()


class CliFlagTest(unittest.TestCase):
    def test_flag_forcada_exige_database_apply_e_category_frame(self):
        for argv in (["--snapshot", "x.jsonl", "--force-category-frame", "--apply", "--category-frame", "--output", "o.xlsx"],
                     ["--database", "--force-category-frame", "--category-frame", "--output", "o.xlsx"],
                     ["--database", "--apply", "--force-category-frame", "--output", "o.xlsx"]):
            with self.subTest(argv=argv), patch("sys.stderr", new=io.StringIO()):
                with self.assertRaises(SystemExit) as stop:
                    main(argv)
                self.assertEqual(stop.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
