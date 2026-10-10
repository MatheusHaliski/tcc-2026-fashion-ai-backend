"""Contrato JSONL e ciclo de vida do bridge; protocolo fake não exige Java ou conexão no CI."""
from __future__ import annotations

import concurrent.futures
import json
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalog_image_analyzer import AnalyzerError, CatalogImageAnalyzer, PIPELINE_VERSION, build_command, ensure_classpath


SERVER = r'''
import json,sys,time
MODE=__MODE__
if MODE=="exit_before_ready": sys.exit(3)
if MODE=="no_ready": time.sleep(20)
if MODE=="invalid_ready":
    print("not-json",flush=True);time.sleep(20)
print(json.dumps({"op":"ready","pipelineVersion":"CATALOG_IMAGE_PIPELINE_V3" if MODE=="old_version" else "CATALOG_IMAGE_PIPELINE_V4","registryVersion":"2.0.0"}),flush=True)
waiting=[]
for line in sys.stdin:
    r=json.loads(line)
    if MODE=="closed_pipe": sys.exit(7)
    if MODE=="no_response": time.sleep(20)
    if MODE=="bad_json":
        print("[unrelated console output]",flush=True);continue
    if r["id"]=="missing":
        print(json.dumps({"id":r["id"],"op":r["op"],"ok":False,"error":"FILE_NOT_FOUND","message":"missing image"}),flush=True);continue
    if r["op"]=="rank":
        out={"id":r["id"],"op":"rank","ok":True,"roles":[{"id":r["candidates"][0]["id"],"role":"CANONICAL","score":0.95}]}
    else:
        columns={"mime":"image/png","width":800,"height":1000,"source_sha256":"abc","phash":"1234","processing_status":"APPROVED","pipeline_version":"CATALOG_IMAGE_PIPELINE_V4","quality_score":"0.9000","gate_reasons":None,"crop_json":json.dumps({"aspect":"4:5","crop":{"x":0.1,"y":0.1,"w":0.8,"h":0.8}}),"metrics_json":json.dumps({"debug":{"ruleCompliance":{"mode":"GARMENT_COVER","pipelineVersion":"GARMENT_COVER_V1","foregroundOnly":True}}})}
        if MODE=="numeric_quality": columns["quality_score"]=0.9
        if MODE=="json_as_object": columns["metrics_json"]={"debug":{}}
        if MODE=="malformed_metadata": columns["metrics_json"]="malformed"
        if MODE=="wrong_status": columns["processing_status"]="REJECTED"
        if MODE=="wrong_column_version": columns["pipeline_version"]="CATALOG_IMAGE_PIPELINE_V3"
        if MODE=="missing_column": del columns["crop_json"]
        out={"id":r["id"],"op":"analyze","ok":True,"outcome":"APPROVED","columns":columns,"received":r}
    if MODE=="out_of_order":
        waiting.append(out)
        if len(waiting)==2:
            for response in reversed(waiting): print(json.dumps(response),flush=True)
            waiting=[]
    else: print(json.dumps(out),flush=True)
'''


class AnalyzerProtocolTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def analyzer(self, mode="normal", **kwargs):
        server = self.root / f"server-{mode}.py"
        server.write_text(SERVER.replace("__MODE__", repr(mode)), encoding="utf-8")
        with patch("catalog_image_analyzer.build_command", return_value=[sys.executable, str(server)]):
            analyzer = CatalogImageAnalyzer("unused", threads=2, timeout=2, startup_timeout=1, **kwargs)
        self.addCleanup(analyzer.close)
        return analyzer

    def test_one_process_preserves_analysis_metadata_and_request_category(self):
        with self.analyzer() as analyzer:
            pid = analyzer._process.pid
            first = analyzer.analyze(self.root / "camisa.png", "upper_piece", "shirt", image_id="shirt")
            second = analyzer.analyze(self.root / "jeans.png", "lower_piece", "jeans", "FRONT", image_id="jeans")
            self.assertEqual(analyzer.ready["pipelineVersion"], PIPELINE_VERSION)
            self.assertEqual(analyzer._process.pid, pid)
            self.assertEqual(first["columns"]["quality_score"], "0.9000")
            self.assertIsInstance(first["columns"]["crop_json"], str)
            self.assertTrue(json.loads(first["columns"]["metrics_json"])["debug"]["ruleCompliance"]["foregroundOnly"])
            self.assertEqual(second["received"]["category"], "lower_piece")
            self.assertEqual(second["received"]["subcategory"], "jeans")
            self.assertEqual(second["received"]["imageType"], "FRONT")
            self.assertTrue(Path(second["received"]["path"]).is_absolute())
        self.assertIsNotNone(analyzer._process.poll())

    def test_parallel_requests_match_their_ids_when_responses_are_reordered(self):
        with self.analyzer("out_of_order") as analyzer, concurrent.futures.ThreadPoolExecutor(2) as workers:
            futures = [workers.submit(analyzer.analyze, self.root / f"{identifier}.png", "upper_piece", "shirt", image_id=identifier)
                       for identifier in ("first", "second")]
            self.assertEqual([future.result()["id"] for future in futures], ["first", "second"])

    def test_error_for_one_photo_does_not_prevent_next_analysis(self):
        with self.analyzer() as analyzer:
            with self.assertRaises(AnalyzerError) as caught:
                analyzer.analyze(self.root / "missing.png", "upper_piece", "shirt", image_id="missing")
            self.assertEqual(caught.exception.code, "FILE_NOT_FOUND")
            self.assertEqual(caught.exception.response["ok"], False)
            self.assertEqual(analyzer.analyze(self.root / "next.png", "upper_piece", "shirt")["outcome"], "APPROVED")

    def test_rank_returns_java_roles_without_inventing_a_canonical(self):
        with self.analyzer() as analyzer:
            result = analyzer.rank("upper_piece", [{"id": "image-1", "imageType": "PACKSHOT", "outcome": "APPROVED",
                                                    "quality": 0.9, "detailView": False, "phash": "1234"}], product_id="product")
            self.assertEqual(result["roles"], [{"id": "image-1", "role": "CANONICAL", "score": 0.95}])

    def test_old_java_artifact_is_rejected_at_startup(self):
        with self.assertRaises(AnalyzerError) as caught:
            self.analyzer("old_version")
        self.assertEqual(caught.exception.code, "PIPELINE_VERSION_MISMATCH")

    def test_exit_and_invalid_output_are_explicit_startup_errors(self):
        for mode, code in (("exit_before_ready", "PROCESS_EXITED"), ("invalid_ready", "PROTOCOL_ERROR")):
            with self.subTest(mode=mode), self.assertRaises(AnalyzerError) as caught:
                self.analyzer(mode)
            self.assertEqual(caught.exception.code, code)

    def test_startup_timeout_terminates_the_child(self):
        with self.assertRaises(AnalyzerError) as caught:
            self.analyzer("no_ready")
        self.assertEqual(caught.exception.code, "STARTUP_TIMEOUT")

    def test_closed_pipe_fails_the_request_instead_of_hanging(self):
        with self.analyzer("closed_pipe") as analyzer, self.assertRaises(AnalyzerError) as caught:
            analyzer.analyze(self.root / "sample.png", "upper_piece", "shirt")
        self.assertIn(caught.exception.code, ("PROCESS_EXITED", "PIPE_CLOSED"))

    def test_response_timeout_closes_the_worker_for_safe_resume(self):
        with self.analyzer("no_response") as analyzer, self.assertRaises(AnalyzerError) as caught:
            analyzer.analyze(self.root / "sample.png", "upper_piece", "shirt")
        self.assertEqual(caught.exception.code, "REQUEST_TIMEOUT")
        self.assertIsNotNone(analyzer._process.poll())

    def test_unrelated_stdout_is_never_treated_as_an_analysis(self):
        with self.analyzer("bad_json") as analyzer, self.assertRaises(AnalyzerError) as caught:
            analyzer.analyze(self.root / "sample.png", "upper_piece", "shirt")
        self.assertEqual(caught.exception.code, "PROTOCOL_ERROR")

    def test_wrong_metadata_types_and_versions_cannot_reach_the_database_writer(self):
        for mode in ("numeric_quality", "json_as_object", "malformed_metadata", "wrong_status", "wrong_column_version", "missing_column"):
            with self.subTest(mode=mode), self.analyzer(mode) as analyzer, self.assertRaises(AnalyzerError) as caught:
                analyzer.analyze(self.root / "sample.png", "upper_piece", "shirt")
            self.assertEqual(caught.exception.code, "PROTOCOL_ERROR")

    def test_closed_analyzer_and_duplicate_pending_id_fail_clearly(self):
        analyzer = self.analyzer()
        analyzer.close()
        with self.assertRaises(AnalyzerError) as caught:
            analyzer.analyze(self.root / "sample.png", "upper_piece", "shirt")
        self.assertEqual(caught.exception.code, "ANALYZER_CLOSED")
        with self.analyzer("out_of_order") as analyzer, concurrent.futures.ThreadPoolExecutor(2) as workers:
            first = workers.submit(analyzer.analyze, self.root / "first.png", "upper_piece", "shirt", image_id="same-id")
            # Wait until the first request owns its ID without arbitrary blocking sleeps.
            import time
            deadline = time.monotonic() + 1
            while "same-id" not in analyzer._pending and time.monotonic() < deadline:
                threading_event = __import__("threading").Event()
                threading_event.wait(0.01)
            with self.assertRaises(AnalyzerError) as duplicate:
                analyzer.analyze(self.root / "duplicate.png", "upper_piece", "shirt", image_id="same-id")
            self.assertEqual(duplicate.exception.code, "DUPLICATE_REQUEST_ID")
            second = workers.submit(analyzer.analyze, self.root / "second.png", "upper_piece", "shirt", image_id="different-id")
            self.assertEqual(first.result()["id"], "same-id")
            self.assertEqual(second.result()["id"], "different-id")


class ClasspathTest(unittest.TestCase):
    def test_environment_classpath_does_not_build_or_extract(self):
        with patch.dict(os.environ, {"CATALOG_IMAGE_JAVA_CLASSPATH": "/prepared/classes:/prepared/lib/*"}):
            self.assertEqual(ensure_classpath("/not-a-repository"), "/prepared/classes:/prepared/lib/*")

    def test_extracts_boot_dependencies_once_and_reuses_content_hash_cache(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            root = Path(directory)
            artifact = root / "backend.jar"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("BOOT-INF/classes/catalog/settings.json", "{}")
                archive.writestr("BOOT-INF/lib/application.jar", b"fake-jar")
            first = ensure_classpath(root, jar=artifact, cache_dir=root / "cache")
            second = ensure_classpath(root, jar=artifact, cache_dir=root / "cache")
            self.assertEqual(first, second)
            classes, libs = first.split(os.pathsep)
            self.assertTrue((Path(classes) / "catalog/settings.json").is_file())
            self.assertTrue((Path(libs).parent / "application.jar").is_file())
            self.assertEqual(len(list((root / "cache").iterdir())), 1)

    def test_missing_artifact_reports_how_to_supply_classpath(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(AnalyzerError) as caught:
                ensure_classpath(directory)
            self.assertEqual(caught.exception.code, "CLASSPATH_UNAVAILABLE")

    def test_jar_path_traversal_does_not_write_outside_cache(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            root = Path(directory)
            artifact = root / "backend.jar"
            with zipfile.ZipFile(artifact, "w") as archive:
                archive.writestr("BOOT-INF/lib/application.jar", b"fake-jar")
                archive.writestr("BOOT-INF/classes/../../outside", b"unsafe")
            with self.assertRaises(AnalyzerError) as caught:
                ensure_classpath(root, jar=artifact, cache_dir=root / "cache")
            self.assertEqual(caught.exception.code, "CLASSPATH_UNAVAILABLE")
            self.assertFalse((root / "outside").exists())

    def test_thread_limits_and_absolute_java_command(self):
        for threads in (0, 65, True):
            with self.subTest(threads=threads), self.assertRaises(ValueError):
                build_command("classes", java=sys.executable, threads=threads)
        command = build_command("classes", java=sys.executable, threads=2)
        self.assertTrue(Path(command[0]).is_absolute())
        self.assertEqual(command[-2:], ["--threads", "2"])


if __name__ == "__main__":
    unittest.main()
