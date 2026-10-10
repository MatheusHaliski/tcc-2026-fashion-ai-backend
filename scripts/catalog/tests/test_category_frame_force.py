"""--force-category-frame com a política do quadro 100% tecido (CATALOG_FRAME_34_FABRIC_V2).

O quadro vem da máscara de tecido do pipeline Java (FabricFrame): nunca fundo, pessoa ou objeto. Sem quadro de tecido
(análise falhou, região pequena, acessório sem tecido, pessoa no quadro) a foto não é reenquadrada nem gravada — nem no
modo forçado, que só dispensa a autorização da fonte e a identificação visual confirmada.
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

from scripts.catalog.category_frame import FORCED_DECISION, POLICY, VERSION, apply_frame, report_fields
from scripts.catalog.category_frame_storage import FrameStorage, render_frame_info
from scripts.catalog.process_catalog_images import DownloadFailure, JAVA_TRANSPORT_ERRORS, audit_record, main

PRODUCT = {"x": .1, "y": .1, "w": .8, "h": .8}


def fabric(crop=None, target="chest", source="ESTIMATED_CHEST", ok=True, reason=None, coverage=1.0, skin=0.0):
    """Quadro de tecido como o CatalogImageBatchCli devolve (FabricFrame.Result.toMap)."""
    crop = crop if crop is not None else {"x": .375, "y": .3, "w": .25, "h": .25}
    return {"version": "FABRIC_FRAME_34_V1", "ok": ok, "reason": reason, "crop": crop if ok or reason != "NOT_TEXTILE_ACCESSORY" else None,
            "aspect": "3:4", "target": target, "anchor": {"x": .5, "y": .4, "source": source},
            "region": {"x": .3, "y": .2, "w": .4, "h": .6}, "fabricCoverage": coverage, "skinExcluded": skin, "cropWidthPx": 300, "erosionPx": 3}


def response(width=1200, height=1600, product=PRODUCT, gate=None, status="APPROVED", frame="default"):
    crop = {"product": product} if product is not None else {}
    out = {"ok": True, "op": "analyze", "outcome": status,
           "columns": {"width": width, "height": height, "processing_status": status, "gate_reasons": gate,
                       "crop_json": json.dumps(crop) if crop else None, "metrics_json": json.dumps({"segmentationConfidence": .9}),
                       "pipeline_version": "CATALOG_IMAGE_PIPELINE_V4", "source_sha256": "a" * 64}}
    out["fabricFrame"] = fabric() if frame == "default" else frame
    return out


def frame(result):
    return json.loads(result["columns"]["crop_json"])


class FabricFrameRulesTest(unittest.TestCase):
    """O quadro é o do Java (3:4 em pixels, 100% tecido); categoria e subcategoria decidem o alvo; sem quadro, nada."""

    def test_quadro_de_tecido_vira_o_recorte_com_a_politica_registrada(self):
        result = apply_frame(response(), "upper_piece", force=True, subcategory="t_shirt")
        crop = frame(result)
        r = crop["crop"]
        self.assertAlmostEqual(r["w"] * 1200 / (r["h"] * 1600), .75)
        self.assertEqual(crop["aspect"], "3:4")
        editor = crop["editorFrame"]
        self.assertEqual((editor["version"], editor["policy"], editor["fabricCoverage"]), (VERSION, POLICY, 1.0))
        self.assertEqual((editor["category"], editor["subcategory"], editor["target"]), ("upper_piece", "t_shirt", "chest"))
        self.assertEqual(editor["observations"], [])
        self.assertEqual(editor["decision"], FORCED_DECISION)
        self.assertEqual(result["columns"]["pipeline_version"], VERSION)
        self.assertEqual(result["columns"]["processing_status"], "APPROVED")
        self.assertEqual(report_fields(result)["frame_policy"], POLICY)
        self.assertEqual(report_fields(result)["frame_fabric_coverage"], 1.0)

    def test_sem_quadro_de_tecido_nao_ha_enquadramento_nem_no_modo_forcado(self):
        for frame_value, reason in ((fabric(ok=False, reason="FABRIC_REGION_TOO_SMALL"), "FABRIC_REGION_TOO_SMALL"),
                                    (fabric(ok=False, reason="NOT_TEXTILE_ACCESSORY", target="body"), "NOT_TEXTILE_ACCESSORY"),
                                    (fabric(ok=False, reason="HUMAN_IN_FABRIC_FRAME"), "HUMAN_IN_FABRIC_FRAME"),
                                    (fabric(coverage=.97), "FABRIC_COVERAGE_BELOW_100"),
                                    (fabric(crop={"x": .9, "y": .3, "w": .25, "h": .25}), "INVALID_CROP")):
            for force in (True, False):
                with self.subTest(reason=reason, force=force), self.assertRaisesRegex(ValueError, "FABRIC_FRAME_UNAVAILABLE:" + reason):
                    apply_frame(response(frame=frame_value), "upper_piece", force=force)
        # análise recusada antes do quadro (ex.: foto pequena): o motivo do Java vai para o erro
        with self.assertRaisesRegex(ValueError, "FABRIC_FRAME_UNAVAILABLE:IMAGE_TOO_SMALL"):
            apply_frame(response(frame=None, gate="IMAGE_TOO_SMALL", status="REJECTED"), "upper_piece", force=True)
        with self.assertRaisesRegex(ValueError, "FABRIC_FRAME_UNAVAILABLE:JAVA_IMAGE_TOO_SMALL"):
            apply_frame(response(), "upper_piece", force=True, fallback="IMAGE_TOO_SMALL")

    def test_quadro_fora_de_3x4_e_recusado(self):
        with self.assertRaisesRegex(ValueError, "ASPECT_NOT_3_4"):
            apply_frame(response(frame=fabric(crop={"x": .1, "y": .1, "w": .5, "h": .3})), "upper_piece", force=True)

    def test_ziper_e_cadarco_estimados_pedem_revisao_so_no_modo_padrao(self):
        detected = frame(apply_frame(response(frame=fabric(target="fly", source="PIPELINE_LANDMARK")), "lower_piece", force=True))
        self.assertNotIn("ZIPPER_NOT_DETECTED_ESTIMATED", detected["editorFrame"]["observations"])
        estimated = apply_frame(response(frame=fabric(target="fly", source="ESTIMATED_FLY")), "lower_piece", force=True)
        self.assertIn("ZIPPER_NOT_DETECTED_ESTIMATED", frame(estimated)["editorFrame"]["observations"])
        self.assertEqual(estimated["columns"]["processing_status"], "APPROVED")
        default = apply_frame(response(frame=fabric(target="fly", source="ESTIMATED_FLY")), "lower_piece")["columns"]
        self.assertEqual(default["processing_status"], "NEEDS_REPROCESSING")
        self.assertTrue(frame({"columns": default})["editorFrame"]["requiresReview"])
        self.assertIn("CATEGORY_FRAME_LANDMARK_REVIEW", default["gate_reasons"])
        laces = frame(apply_frame(response(frame=fabric(target="upper", source="ESTIMATED_UPPER")), "shoes_piece", force=True))
        self.assertIn("LACES_NOT_DETECTED_ESTIMATED", laces["editorFrame"]["observations"])
        # regras geométricas da categoria (peito, painel, corpete, corpo do acessório) não são "estimativa de landmark"
        for category, target in (("upper_piece", "front_panel"), ("full_body_piece", "bodice"), ("accessory_piece", "body")):
            plain = apply_frame(response(frame=fabric(target=target, source="ESTIMATED_X")), category)
            self.assertFalse(frame(plain)["editorFrame"]["requiresReview"], category)

    def test_pele_tirada_da_mascara_e_baixa_confianca_viram_observacao(self):
        low = response(frame=fabric(skin=.12))
        low["columns"]["metrics_json"] = json.dumps({"segmentationConfidence": .2})
        editor = frame(apply_frame(low, "upper_piece", force=True))["editorFrame"]
        self.assertIn("PERSON_SKIN_EXCLUDED_FROM_MASK", editor["observations"])
        self.assertIn("LOW_SEGMENTATION_CONFIDENCE", editor["observations"])

    def test_categoria_desconhecida_so_no_modo_forcado(self):
        editor = frame(apply_frame(response(frame=fabric(target="body")), "bag_piece", force=True))["editorFrame"]
        self.assertIn("CATEGORY_UNKNOWN:bag_piece", editor["observations"])
        with self.assertRaisesRegex(ValueError, "CATEGORY_FRAME_UNSUPPORTED"):
            apply_frame(response(), "bag_piece")


class RenderTest(unittest.TestCase):
    def test_recorte_para_dentro_3x4_exato_e_ampliacao_registrada(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "small.png"
            image = Image.new("RGB", (301, 401), (246, 246, 246))          # fundo de estúdio
            image.paste((31, 58, 107), (75, 100, 226, 301))                # tecido: 151 × 201 px
            image.save(path)
            # quadro de tecido exatamente na borda do tecido (como o Java devolve, já erodido)
            crop = {"crop": {"x": 75 / 301, "y": 100 / 401, "w": 150 / 301, "h": 200 / 401}}
            data, info = render_frame_info(path, crop)
            self.assertEqual((info["sourceCropWidth"], info["sourceCropHeight"]), (150, 200))
            self.assertEqual(info["upscaleFactor"], 6.0)
            self.assertEqual(info["qualityNote"], "UPSCALED_REDUCED_QUALITY")
            with Image.open(io.BytesIO(data)) as out:
                self.assertEqual(out.size, (900, 1200))
                # nenhum pixel de fundo nas bordas do quadro
                for x, y in ((0, 0), (899, 0), (0, 1199), (899, 1199), (450, 0), (0, 600)):
                    r, g, b = out.getpixel((x, y))
                    self.assertLess(r, 90, (x, y)); self.assertGreater(b, 70, (x, y))

    def test_assets_json_registra_decisao_original_render_e_versao(self):
        class S3:
            def put_object(self, **kwargs): self.data = kwargs["Body"]
            def get_object(self, **kwargs): return {"Body": io.BytesIO(self.data)}
            def delete_object(self, **kwargs): self.deleted = kwargs["Key"]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.png"
            Image.new("RGB", (1200, 1600), "blue").save(path)
            source = response(frame=fabric(crop={"x": .25, "y": .25, "w": .5, "h": .5}))
            source["columns"]["source_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            framed = apply_frame(source, "upper_piece", force=True)
            decision = {"mode": FORCED_DECISION, "sourceState": "UNKNOWN", "sourceReason": "SOURCE_HOST_NOT_REGISTERED", "host": "brand.example", "decidedBy": "PROJECT_OWNER"}
            with patch.dict(os.environ, {"S3_BUCKET": "test", "STORAGE_PUBLIC_BASE_URL": "https://media.example.com", "S3_SERVE_THROUGH_API": "false"}):
                assets = FrameStorage(S3()).store({"source_url": "https://brand.example/a.jpg", "stored_url": "https://old/a.jpg", "assets_json": json.dumps({"card": "https://old/a.jpg"})}, framed, path, decision=decision)
            recorded = json.loads(assets["assets_json"])
            self.assertEqual(recorded["framingVersion"], VERSION)
            self.assertEqual(recorded["persistenceDecision"], decision)
            self.assertEqual(recorded["originalUrl"], "https://brand.example/a.jpg")
            self.assertEqual(recorded["previousStoredUrl"], "https://old/a.jpg")
            self.assertEqual(recorded["previousAssets"]["card"], "https://old/a.jpg")
            self.assertEqual(recorded["render"]["upscaleFactor"], 1.5)
            self.assertEqual(recorded["editorFrame"]["policy"], POLICY)
            self.assertEqual(assets["render_info"]["sourceCropWidth"], 600)


class PreviousAssetsTest(unittest.TestCase):
    def test_metadado_anterior_vem_do_banco_como_objeto_ou_de_snapshot_como_texto(self):
        from scripts.catalog.category_frame_storage import previous_assets
        self.assertEqual(previous_assets({"assets_json": {"card": "https://old/a.jpg"}}), {"card": "https://old/a.jpg"})
        self.assertEqual(previous_assets({"assets_json": '{"card": "https://old/a.jpg"}'}), {"card": "https://old/a.jpg"})
        self.assertEqual(previous_assets({"assets_json": None, "assets": {"master": "m"}}), {"master": "m"})
        self.assertIsNone(previous_assets({"assets_json": "não é json"}))
        self.assertIsNone(previous_assets({}))


class StandardizedTest(unittest.TestCase):
    """Só o quadro 100% tecido gravado conta como padronizado; o quadro antigo de 50% (podia mostrar fundo) é refeito."""

    def record(self, version=VERSION, coverage=1.0, policy=POLICY):
        return {"image_url": "https://brand.example/a.jpg", "processing_status": "APPROVED", "pipeline_version": version,
                "review_status": "NONE", "stored_url": "https://media.example.com/f.jpg",
                "assets_json": {"card": "https://media.example.com/f.jpg", "framingVersion": version, "sha256": "b" * 64},
                "crop_json": {"aspect": "3:4", "crop": {"x": .3, "y": .3, "w": .3, "h": .3}, "ruleCompliant": True,
                              "editorFrame": {"version": version, "policy": policy, "fabricCoverage": coverage, "requiresReview": False, "observations": []}}}

    def test_so_quadro_de_tecido_completo_e_padronizado(self):
        from scripts.catalog.catalog_image_inventory import is_standardized
        self.assertTrue(is_standardized(self.record()))
        self.assertFalse(is_standardized(self.record(coverage=.98)))
        self.assertFalse(is_standardized(self.record(policy="EDITOR_50")))
        legacy = self.record(version="CATALOG_FRAME_34_50_V1")
        legacy["crop_json"]["editorFrame"].update(widthPercent=50)
        self.assertFalse(is_standardized(legacy))

    def test_reexecucao_preserva_v2_e_refaz_v1(self):
        analyzer = Mock(spec=["analyze", "rank", "ready", "category_frame", "force_frame", "frame_storage"])
        analyzer.ready = {"pipelineVersion": "CATALOG_IMAGE_PIPELINE_V4"}; analyzer.category_frame = True; analyzer.force_frame = True; analyzer.frame_storage = Mock()
        downloader = Mock()
        base = {"category": "upper_piece", "source_url": "https://brand.example/a.jpg", "image_id": "a", "product_id": "p"}
        kept = audit_record({**self.record(), **base}, downloader, analyzer, Mock(), apply=True)
        self.assertIn("preservado", kept["status_note"])
        downloader.get.assert_not_called()
        checkpoint = Mock(); checkpoint.get.return_value = None
        downloader.get.side_effect = DownloadFailure("NETWORK_PROXY_BLOCKED")
        redo = audit_record({**self.record(version="CATALOG_FRAME_34_50_V1"), **base}, downloader, analyzer, checkpoint, apply=True)
        self.assertNotIn("preservado", redo["status_note"])
        downloader.get.assert_called()


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

    def test_java_sem_foto_ou_sem_tecido_nao_grava_e_transporte_continua_falha(self):
        from scripts.catalog.catalog_image_analyzer import AnalyzerError
        downloader, checkpoint = Mock(), Mock()
        checkpoint.get.return_value = None
        downloader.get.return_value = Path("/tmp/a.img")
        downloader.final_urls = {}
        storage = Mock()
        analyzer = self.analyzer(storage=storage)
        analyzer.analyze.side_effect = AnalyzerError("IMAGE_TOO_SMALL", "pequena")
        result = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertEqual(result["error"], "FABRIC_FRAME_UNAVAILABLE:JAVA_IMAGE_TOO_SMALL")
        storage.store.assert_not_called()
        checkpoint.put.assert_not_called()
        # análise feita, mas sem região de tecido: também não grava
        analyzer.analyze.side_effect = None
        analyzer.analyze.return_value = response(frame=fabric(ok=False, reason="FABRIC_REGION_TOO_SMALL"))
        small = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertEqual(small["error"], "FABRIC_FRAME_UNAVAILABLE:FABRIC_REGION_TOO_SMALL")
        storage.store.assert_not_called()
        # falha do canal Java nunca vira enquadramento de uma foto
        for code in sorted(JAVA_TRANSPORT_ERRORS)[:3]:
            analyzer.analyze.side_effect = AnalyzerError(code, "canal")
            failed = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
            self.assertEqual(failed["error"], "JAVA:" + code)

    def test_analise_guardada_sem_quadro_de_tecido_e_refeita(self):
        downloader, checkpoint = Mock(), Mock()
        stale = response(); stale.pop("fabricFrame")
        checkpoint.get.return_value = stale
        downloader.get.return_value = Path("/tmp/a.img")
        downloader.final_urls = {}
        storage = Mock()
        storage.store.return_value = {"stored_url": "https://media.example.com/f.jpg", "assets_json": "{}", "owned_key": "k", "render_info": {}}
        analyzer = self.analyzer(storage=storage)
        analyzer.analyze.return_value = response()
        with patch("scripts.catalog.process_catalog_images.public_image_url", side_effect=lambda url: url):
            result = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertNotIn("error", result, result.get("status_note"))
        analyzer.analyze.assert_called_once()
        checkpoint.put.assert_called_once()

    def test_url_invalida_continua_falha_tecnica_no_modo_forcado(self):
        class Downloader:
            def get(self, url, allowed_domains=None):
                raise DownloadFailure("UNSAFE_IMAGE_URL")
        checkpoint = Mock(); checkpoint.get.return_value = None
        result = audit_record(self.record(source_url="http://brand.example/a.jpg"), Downloader(), self.analyzer(storage=Mock()), checkpoint, apply=True)
        self.assertEqual(result["error"], "UNSAFE_IMAGE_URL")
        self.assertNotIn("analysis", result)

    def test_ja_enquadrada_nesta_versao_e_preservada(self):
        record = self.record(processing_status="APPROVED", pipeline_version=VERSION, review_status="NONE",
                             stored_url="https://media.example.com/f.jpg", image_url="https://brand.example/a.jpg",
                             assets_json=json.dumps({"card": "https://media.example.com/f.jpg", "framingVersion": VERSION, "sha256": "b" * 64}),
                             crop_json=json.dumps({"aspect": "3:4", "crop": {"x": .25, "y": .25, "w": .3, "h": .3}, "ruleCompliant": True,
                                                   "editorFrame": {"version": VERSION, "policy": POLICY, "fabricCoverage": 1.0, "requiresReview": False}}))
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
