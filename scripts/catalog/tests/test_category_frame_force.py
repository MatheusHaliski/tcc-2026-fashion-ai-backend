"""--force-category-frame com a regra de enquadramento do produto (CATALOG_FRAME_34_PRODUCT_RULE_V3, PRODUCT_RULE).

O quadro 3:4 vem do pipeline Java (ProductRuleFrame) com a mesma regra do card (catalog/semantic-regions.json): parte de cima e
de baixo preenchem o quadro a partir da gola/do cós, calçado inteiro na largura, acessório inteiro contido. Sem quadro pela regra
(peça não isolada, cós não visível, análise falhou) a foto não é reenquadrada nem gravada — nem no modo forçado, que só dispensa
a autorização da fonte e a identificação visual confirmada. Imagens das versões anteriores (V1 50%, V2 só tecido) são refeitas.
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

from scripts.catalog.category_frame import FORCED_DECISION, LEGACY_VERSIONS, POLICY, VERSION, apply_frame, report_fields
from scripts.catalog.category_frame_storage import FrameStorage, render_frame_info
from scripts.catalog.process_catalog_images import DownloadFailure, JAVA_TRANSPORT_ERRORS, audit_record, main

PRODUCT = {"x": .1, "y": .1, "w": .8, "h": .8}
COVER_TOP = {"fit": "COVER", "align": "TOP", "view": "FRONT", "focusTopHalf": True}
WIDTH_CENTER = {"fit": "WIDTH", "align": "CENTER", "view": "SIDE", "focusTopHalf": False}
CONTAIN_CENTER = {"fit": "CONTAIN", "align": "CENTER", "view": "ANY", "focusTopHalf": False}


def frame_of(crop=None, rule=None, target="neckline_top", ok=True, reason=None, coverage=1.0, scope="FRAME", inside=1.0,
             padding=0.0, model=False, skin=0.0, compliance_ok=True, observations=(), version="PRODUCT_RULE_FRAME_V1"):
    """Quadro da regra do produto como o CatalogImageBatchCli devolve (ProductRuleFrame.Result.toMap)."""
    rule = rule or COVER_TOP
    crop = crop if crop is not None else ({"x": .375, "y": .3, "w": .25, "h": .25} if ok else None)
    whole = rule["fit"] != "COVER"
    return {"version": version, "ok": ok, "reason": reason, "crop": crop, "aspect": "3:4", "rule": rule,
            "ruleSource": {"registry": "catalog/semantic-regions.json", "registryVersion": "2.1.0", "pieceType": "UPPER_PIECE",
                           "subcategory": None, "origin": "pieceType"},
            "target": target, "focus": {"name": "collar_chest", "x": .5, "y": .4}, "product": {"x": .3, "y": .2, "w": .4, "h": .6},
            "model": model, "skinExcluded": skin, "garmentCoverage": 0.0 if whole else coverage,
            "coverageScope": None if whole else scope, "objectInside": inside, "padding": padding,
            "background": "#f6f6f6", "truncated": [], "sideView": True if rule.get("view") == "SIDE" else None,
            "compliance": {"ok": compliance_ok, "focusInTopHalf": compliance_ok}, "cropWidthPx": 300,
            "observations": list(observations)}


def response(width=1200, height=1600, product=PRODUCT, gate=None, status="APPROVED", frame="default"):
    crop = {"product": product} if product is not None else {}
    out = {"ok": True, "op": "analyze", "outcome": status,
           "columns": {"width": width, "height": height, "processing_status": status, "gate_reasons": gate,
                       "crop_json": json.dumps(crop) if crop else None, "metrics_json": json.dumps({"segmentationConfidence": .9}),
                       "pipeline_version": "CATALOG_IMAGE_PIPELINE_V4", "source_sha256": "a" * 64}}
    out["productFrame"] = frame_of() if frame == "default" else frame
    source = out["productFrame"]
    if source:
        out["fabricFrame"] = {"version": "FABRIC_FRAME_34_V2" if source["version"] == "PRODUCT_RULE_FRAME_V1" else source["version"],
                              "ok": source["ok"], "reason": source["reason"], "crop": source["crop"],
                              "fabricCoverage": source["garmentCoverage"], "target": "collar",
                              "anchor": {"x": .5, "y": .4, "source": "ESTIMATED_COLLAR"}}
    return out


def frame(result):
    return json.loads(result["columns"]["crop_json"])


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

    def test_objeto_inteiro_arredonda_para_fora_e_completa_com_o_fundo_de_cada_lado(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "shoe.png"
            image = Image.new("RGB", (1200, 600), (240, 240, 240))             # fundo de estúdio, foto larga (2:1)
            image.paste((176, 34, 42), (100, 200, 1100, 400))                  # tênis: 1000 × 200 px, de lado
            image.save(path)
            # WIDTH: o comprimento inteiro na largura com 2% de folga; 3:4 passa da foto em cima e embaixo
            w = 1000 / .96 / 1200
            h = w * 1200 / .75 / 600
            crop = {"crop": {"x": .5 - w / 2, "y": .5 - h / 2, "w": w, "h": h},
                    "editorFrame": {"rule": {"fit": "WIDTH", "align": "CENTER"}, "background": "#f0f0f0"}}
            data, info = render_frame_info(path, crop)
            self.assertEqual(info["rounding"], "OUTWARD")
            self.assertEqual(sorted(info["paddedSides"]), ["bottom", "top"])
            self.assertGreater(info["paddingShare"], .5)
            self.assertEqual(info["sourceCropWidth"] * 4, info["sourceCropHeight"] * 3)
            with Image.open(io.BytesIO(data)) as out:
                self.assertEqual(out.size, (900, 1200))
                # o tênis inteiro: as pontas aparecem (vermelho) e a borda do quadro é fundo
                px = out.load()
                row = 600
                reds = [x for x in range(900) if px[x, row][0] > 140 and px[x, row][1] < 90]
                self.assertTrue(reds and reds[0] > 5 and reds[-1] < 894, "nada do tênis cortado nas laterais")
                for x, y in ((0, 0), (899, 0), (450, 5), (450, 1194), (0, 1199)):
                    r, g, b = px[x, y]
                    self.assertTrue(abs(r - 240) < 8 and abs(g - 240) < 8 and abs(b - 240) < 8, (x, y, px[x, y]))

    def test_png_transparente_vira_fundo_e_nao_preto(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bag.png"
            image = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
            image.paste((90, 58, 34, 255), (250, 250, 550, 550))
            image.save(path)
            crop = {"crop": {"x": .2, "y": .1333, "w": .6, "h": .8}, "editorFrame": {"rule": {"fit": "CONTAIN", "align": "CENTER"},
                                                                                    "background": "#ffffff"}}
            data, _ = render_frame_info(path, crop)
            with Image.open(io.BytesIO(data)) as out:
                self.assertGreater(min(out.getpixel((5, 5))), 245)

    def test_assets_json_registra_decisao_original_render_e_versao(self):
        class S3:
            def put_object(self, **kwargs): self.data = kwargs["Body"]
            def get_object(self, **kwargs): return {"Body": io.BytesIO(self.data)}
            def delete_object(self, **kwargs): self.deleted = kwargs["Key"]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.png"
            Image.new("RGB", (1200, 1600), "blue").save(path)
            source = response(frame=frame_of(crop={"x": .25, "y": .25, "w": .5, "h": .5}))
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
            self.assertEqual((recorded["editorFrame"]["fit"], recorded["editorFrame"]["align"]), ("COVER", "FOCUS"))
            self.assertEqual(recorded["editorFrame"]["target"], "collar")
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
    """Só o quadro da regra do produto gravado (V3) conta como padronizado; V1 (50%) e V2 (só tecido) são refeitos."""

    def record(self, version=VERSION, coverage=1.0, policy=POLICY, fit="COVER", crop=None, inside=1.0):
        garment = fit == "COVER"
        return {"image_url": "https://brand.example/a.jpg", "processing_status": "APPROVED", "pipeline_version": version,
                "review_status": "NONE", "stored_url": "https://media.example.com/f.jpg",
                "assets_json": {"card": "https://media.example.com/f.jpg", "framingVersion": version, "sha256": "b" * 64},
                "crop_json": {"aspect": "3:4", "crop": crop or {"x": .3, "y": .3, "w": .3, "h": .3}, "ruleCompliant": True,
                              "editorFrame": {"version": version, "policy": policy, "fit": fit, "align": "FOCUS", "padding": 0,
                                              "garmentCoverage": coverage if garment else 0.0, "coverageScope": "FRAME" if garment else None,
                                              "objectInside": inside, "requiresReview": False, "observations": []}}}

    def test_so_quadro_da_regra_do_produto_e_padronizado(self):
        from scripts.catalog.catalog_image_inventory import is_standardized
        self.assertTrue(is_standardized(self.record()))
        self.assertFalse(is_standardized(self.record(coverage=.98)))
        self.assertFalse(is_standardized(self.record(policy="FABRIC_ONLY_100")))
        # objeto inteiro com fundo completado: o recorte passa da foto e continua padronizado
        self.assertFalse(is_standardized(self.record(fit="WIDTH", crop={"x": .05, "y": -.3, "w": .9, "h": 1.6})))
        self.assertFalse(is_standardized(self.record(fit="CONTAIN", inside=.9)))
        # versões anteriores, gravadas e válidas na época, não contam
        self.assertEqual(LEGACY_VERSIONS, ("CATALOG_FRAME_34_50_V1", "CATALOG_FRAME_34_FABRIC_V2", "CATALOG_FRAME_34_PRODUCT_RULE_V3"))
        for legacy in LEGACY_VERSIONS:
            old = self.record(version=legacy, policy="FABRIC_ONLY_100" if "FABRIC" in legacy else None)
            old["crop_json"]["editorFrame"].update(fabricCoverage=1.0, widthPercent=50)
            self.assertFalse(is_standardized(old), legacy)

    def test_reexecucao_preserva_v3_e_refaz_v1_e_v2(self):
        analyzer = Mock(spec=["analyze", "rank", "ready", "category_frame", "force_frame", "frame_storage"])
        analyzer.ready = {"pipelineVersion": "CATALOG_IMAGE_PIPELINE_V4", "fabricFrameVersion": "FABRIC_FRAME_34_V2"}
        analyzer.category_frame = True; analyzer.force_frame = True; analyzer.frame_storage = Mock()
        downloader = Mock()
        base = {"category": "upper_piece", "source_url": "https://brand.example/a.jpg", "image_id": "a", "product_id": "p"}
        kept = audit_record({**self.record(), **base}, downloader, analyzer, Mock(), apply=True)
        self.assertIn("preservado", kept["status_note"])
        downloader.get.assert_not_called()
        for legacy in LEGACY_VERSIONS:
            with self.subTest(legacy=legacy):
                checkpoint = Mock(); checkpoint.get.return_value = None
                downloader = Mock(); downloader.get.side_effect = DownloadFailure("NETWORK_PROXY_BLOCKED")
                redo = audit_record({**self.record(version=legacy), **base}, downloader, analyzer, checkpoint, apply=True)
                self.assertNotIn("preservado", redo["status_note"])
                downloader.get.assert_called()


class ForcedAuditRecordTest(unittest.TestCase):
    def analyzer(self, force=True, storage=None):
        analyzer = Mock(spec=["analyze", "rank", "ready", "category_frame", "force_frame", "frame_storage"])
        analyzer.ready = {"pipelineVersion": "CATALOG_IMAGE_PIPELINE_V4", "fabricFrameVersion": "FABRIC_FRAME_34_V2"}
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

    def test_java_sem_foto_ou_sem_quadro_nao_grava_e_transporte_continua_falha(self):
        from scripts.catalog.catalog_image_analyzer import AnalyzerError
        downloader, checkpoint = Mock(), Mock()
        checkpoint.get.return_value = None
        downloader.get.return_value = Path("/tmp/a.img")
        downloader.final_urls = {}
        storage = Mock()
        analyzer = self.analyzer(storage=storage)
        analyzer.analyze.side_effect = AnalyzerError("IMAGE_TOO_SMALL", "pequena")
        result = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertEqual(result["error"], "FRAME_UNAVAILABLE:JAVA_IMAGE_TOO_SMALL")
        storage.store.assert_not_called()
        checkpoint.put.assert_not_called()
        # análise feita, mas a regra não se cumpre (tênis no pé): também não grava
        analyzer.analyze.side_effect = None
        analyzer.analyze.return_value = response(frame=frame_of(ok=False, reason="PIECE_NOT_ISOLATED"))
        refused = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
        self.assertEqual(refused["error"], "FRAME_UNAVAILABLE:PIECE_NOT_ISOLATED")
        storage.store.assert_not_called()
        self.assertNotIn("analysis", refused)
        # falha do canal Java nunca vira enquadramento de uma foto
        for code in sorted(JAVA_TRANSPORT_ERRORS)[:3]:
            analyzer.analyze.side_effect = AnalyzerError(code, "canal")
            failed = audit_record(self.record(), downloader, analyzer, checkpoint, apply=True)
            self.assertEqual(failed["error"], "JAVA:" + code)

    def test_analise_guardada_da_v2_ou_de_outra_versao_da_regra_e_refeita(self):
        stale_v2 = response(frame=None)
        stale_v2.pop("productFrame")
        stale_v2["fabricFrame"] = {"version": "FABRIC_FRAME_34_V1", "ok": True, "crop": {"x": .4, "y": .3, "w": .2, "h": .2}}
        other = response(frame=frame_of(version="PRODUCT_RULE_FRAME_V0"))
        for stale in (stale_v2, other):
            with self.subTest(stale=stale.get("productFrame", {}).get("version") if stale.get("productFrame") else "V2"):
                downloader, checkpoint = Mock(), Mock()
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
                                                   "editorFrame": {"version": VERSION, "policy": POLICY, "fit": "COVER", "padding": 0,
                                                                   "garmentCoverage": 1.0, "coverageScope": "FRAME", "requiresReview": False}}))
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
