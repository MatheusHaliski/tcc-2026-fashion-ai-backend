"""Recorte de fotos no endpoint Vertex: o lote sai no formato do --from-lot, o host que pediu para parar não é consultado e
o cliente para sozinho quando a imagem implantada não atende o recorte. Nenhuma chamada real ao Google Cloud."""
import base64
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import deploy_fashn_vertex as deploy  # noqa: E402
import photo_sets_vertex as client  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 32
HOST = "123.southamerica-east1-999.prediction.vertexai.goog"
ENDPOINT = "projects/p/locations/southamerica-east1/endpoints/8378820113129799680"


def ready(image_id, url, status="READY"):
    files = {"whole": "whole.png", "fabric": "fabric.png"} if status == "READY" else None
    photo_set = {"version": "CATALOG_PHOTO_SET_V2", "imageId": image_id, "sourceUrl": url, "category": "upper_piece", "status": status,
                 "reason": None if status == "READY" else "GARMENT_OCCLUSION_UNCERTAIN", **({"files": files} if files else {})}
    encoded = base64.b64encode(PNG).decode()
    return {"status": "RENDERED", "photoSet": photo_set, "files": {"whole": encoded, "fabric": encoded} if files else {},
            "diagnostics": {"engine": "FASHN_OPEN_PHOTO_SET", "device": "cuda:0", "peakCudaBytes": 123, "seconds": 4.2}}


class FakeCloud:
    """Responde :predict a partir de uma fila: dict (predição) ou exceção; guarda o que foi enviado."""

    def __init__(self, answers):
        self.answers, self.sent, self.parent, self.region = list(answers), [], "projects/p/locations/southamerica-east1", "southamerica-east1"

    def request(self, method, path, body=None, host=None):
        self.sent.append((method, path, body, host))
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return {"predictions": [answer(body["instances"][0]) if callable(answer) else answer]}


class Failure(RuntimeError):
    pass


class FakeDownloader:
    def __init__(self, directory, blocked=()):
        self.directory, self.blocked, self.urls = Path(directory), set(blocked), []

    def get(self, url, *, allowed_domains=None):
        self.urls.append(url)
        if url in self.blocked:
            raise Failure("IMAGE_DOMAIN_BLOCKED_429")
        path = self.directory / hashlib.sha256(url.encode()).hexdigest()
        path.write_bytes(PNG + url.encode())
        return path


def row(n, category="upper_piece"):
    return {"id": f"img-{n}", "product_id": f"p-{n}", "image_url": f"https://cdn.brand.example/{n}.png", "category": category,
            "subcategory": "jacket", "color": "preto"}


def echo(instance):
    return ready(instance["image_id"], instance["source_url"])


class WritePhotoSetTest(unittest.TestCase):
    def test_grava_a_pasta_que_o_importador_percorre_com_set_json_por_ultimo(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = deploy.write_photo_set(ready("img-1", "https://x.example/1.png"), tmp, "img-1", "https://x.example/1.png")
            self.assertEqual(folder.name, hashlib.sha256(b"img-1").hexdigest()[:24])
            self.assertEqual(sorted(p.name for p in folder.iterdir()), ["fabric.png", "set.json", "whole.png"])
            self.assertEqual((folder / "whole.png").read_bytes(), PNG)
            from scripts.catalog.process_photo_sets import lot_sets
            [(path, data)] = list(lot_sets(tmp))
            self.assertEqual((path, data["imageId"], data["status"]), (folder / "set.json", "img-1", "READY"))

    def test_review_sem_imagens_e_falha_sem_nada_gravado(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = deploy.write_photo_set(ready("img-2", "https://x.example/2.png", "REVIEW"), tmp, "img-2", "https://x.example/2.png")
            self.assertEqual([p.name for p in folder.iterdir()], ["set.json"])
            self.assertIsNone(deploy.write_photo_set({"status": "FAILED", "reason": "PHOTOSET_GPU_FAILED", "photoSet": None}, tmp, "img-3", "u"))
            self.assertFalse(deploy.photo_set_folder(tmp, "img-3").exists())

    def test_resposta_fora_do_contrato_nao_vira_lote(self):
        url = "https://x.example/1.png"
        bad = []
        other = ready("img-9", url); bad.append(other)                                   # outra foto
        moved = ready("img-1", url + "?v=2"); bad.append(moved)                           # outra URL (o importador acharia "stale")
        escape = ready("img-1", url); escape["photoSet"]["files"] = {"whole": "../../x.png", "fabric": "fabric.png"}; bad.append(escape)
        missing = ready("img-1", url); del missing["files"]["fabric"]; bad.append(missing)
        not_png = ready("img-1", url); not_png["files"]["whole"] = base64.b64encode(b"GIF89a").decode(); bad.append(not_png)
        review_with_files = ready("img-1", url, "REVIEW"); review_with_files["files"] = {"whole": base64.b64encode(PNG).decode()}; bad.append(review_with_files)
        with tempfile.TemporaryDirectory() as tmp:
            for prediction in bad:
                with self.assertRaises(RuntimeError):
                    deploy.write_photo_set(prediction, tmp, "img-1", url)
            self.assertEqual(list(Path(tmp).rglob("set.json")), [])
            self.assertFalse((Path(tmp).parent / "x.png").exists())


class BatchTest(unittest.TestCase):
    def run_batch(self, rows, answers, out, blocked=(), force=False):
        cloud, sleeps, lines = FakeCloud(answers), [], []
        with tempfile.TemporaryDirectory() as downloads:
            downloader = FakeDownloader(downloads, blocked)
            counts = client.run(rows, cloud, ENDPOINT, HOST, out, force=force, sleep=sleeps.append, downloader=(downloader, Failure),
                                log=lambda message, flush=True: lines.append(message))
            left = list(Path(downloads).iterdir())
        return counts, cloud, downloader, sleeps, left

    def test_lote_completo_retoma_sem_gastar_gpu_de_novo(self):
        rows = [row(1), row(2, "footwear"), row(3), row(4), {"id": "img-5", "image_url": None, "category": "upper_piece"}]
        busy = deploy.CloudHTTPError(429, "GOOGLE_CLOUD_HTTP_429", "GPU_BUSY_RETRY_LATER")
        with tempfile.TemporaryDirectory() as out:
            counts, cloud, downloader, sleeps, left = self.run_batch(rows, [echo, busy, echo], out, blocked={row(3)["image_url"]})
            self.assertEqual(counts, {"READY": 2, "RETRY": 1, "CATEGORY_WITHOUT_PHOTO_SET": 1, "INVALID_ROW": 1})
            self.assertEqual(sleeps, [15], "GPU ocupada: espera e repete a mesma foto")
            self.assertEqual(left, [], "a foto baixada não fica no Cloud Shell")
            self.assertNotIn(row(2)["image_url"], downloader.urls, "categoria sem recorte nem é baixada")
            sent = cloud.sent[0][2]["instances"][0]
            self.assertEqual(set(sent), {"task", "source_image", "catalog_category", "source_url", "image_id", "subcategory", "product_id", "color"})
            self.assertEqual((sent["task"], sent["source_url"], sent["image_id"], cloud.sent[0][3]), ("garment_photo_set", row(1)["image_url"], "img-1", HOST))
            report = [json.loads(line) for line in (Path(out) / "report.jsonl").read_text().splitlines()]
            self.assertEqual([(r["id"], r["status"]) for r in report], [("img-1", "READY"), ("img-3", "RETRY"), ("img-4", "READY")])
            self.assertNotIn("cdn.brand.example", (Path(out) / "report.jsonl").read_text(), "o relatório guarda só o hash da URL")
            self.assertEqual(report[1]["reason"], "IMAGE_DOMAIN_BLOCKED_429")
            # rodar de novo: só a foto que faltou volta à GPU
            counts, cloud, *_ = self.run_batch(rows, [echo], out)
            self.assertEqual((counts["ALREADY_IN_LOT"], counts["READY"], len(cloud.sent)), (2, 1, 1))

    def test_imagem_sem_o_recorte_ou_credencial_recusada_param_o_lote(self):
        for error in (deploy.CloudHTTPError(422, "x", "TASK_NOT_SUPPORTED_BY_MODEL"), deploy.CloudHTTPError(403, "x"),
                      deploy.CloudHTTPError(422, "x", "PHOTOSET_ASSETS_MISSING")):
            with tempfile.TemporaryDirectory() as out, self.assertRaises(client.BatchStopped):
                self.run_batch([row(1), row(2)], [error], out)

    def test_falha_por_foto_segue_mas_tres_falhas_de_gpu_seguidas_param(self):
        failed = {"status": "FAILED", "reason": "PHOTOSET_GPU_FAILED", "photoSet": None, "diagnostics": {}}
        refused = deploy.CloudHTTPError(422, "x", "INVALID_SOURCE_IMAGE")
        with tempfile.TemporaryDirectory() as out:
            counts, *_ = self.run_batch([row(1), row(2), row(3)], [refused, failed, echo], out)
            self.assertEqual(counts, {"FAILED": 2, "READY": 1})
            self.assertEqual(len(list(Path(out).rglob("set.json"))), 1, "foto que falhou não deixa set.json: volta na próxima execução")
            with self.assertRaises(client.BatchStopped):
                self.run_batch([row(4), row(5), row(6), row(7)], [failed, failed, failed, echo], out)

    def test_linha_fora_do_padrao_nao_e_baixada_nem_enviada(self):
        rows = [{**row(1), "subcategory": "Jaqueta Couro"}, {**row(2), "image_url": "https://x.example/" + "a" * 2100}, {**row(3), "color": "c" * 81}]
        with tempfile.TemporaryDirectory() as out:
            counts, cloud, downloader, *_ = self.run_batch(rows, [echo], out)
            self.assertEqual(counts, {"SUBCATEGORY_NOT_NORMALIZED": 1, "INVALID_ROW": 1, "READY": 1})
            self.assertEqual(downloader.urls, [row(3)["image_url"]])
            self.assertNotIn("color", cloud.sent[0][2]["instances"][0], "cor longa fica fora; o importador usa a do banco")

    def test_recusa_generica_repetida_do_vertex_para_o_lote(self):
        gone = deploy.CloudHTTPError(400, "GOOGLE_CLOUD_HTTP_400")
        with tempfile.TemporaryDirectory() as out, self.assertRaises(client.BatchStopped):
            self.run_batch([row(1), row(2), row(3), row(4)], [gone, gone, gone, echo], out)

    def test_resposta_fora_do_contrato_para_o_lote(self):
        with tempfile.TemporaryDirectory() as out, self.assertRaises(client.BatchStopped):
            self.run_batch([row(1)], [lambda instance: ready("img-other", instance["source_url"])], out)


class EndpointTest(unittest.TestCase):
    def test_so_aceita_o_endpoint_com_replica_e_dns_dedicado(self):
        class Cloud(FakeCloud):
            def __init__(self, endpoints):
                super().__init__([]); self.listed = endpoints

            def endpoints(self):
                return self.listed

            def request(self, method, path, body=None, host=None):
                return next(e for e in self.listed if e["name"].endswith(path.rsplit("/", 1)[-1]))
        live = {"name": ENDPOINT, "displayName": deploy.NAME, "deployedModels": [{"id": "1"}], "dedicatedEndpointDns": HOST}
        self.assertEqual(client.find_endpoint(Cloud([live])), (ENDPOINT, HOST))
        self.assertEqual(client.find_endpoint(Cloud([live]), "8378820113129799680"), (ENDPOINT, HOST))
        for endpoints in ([], [live, {**live, "name": ENDPOINT + "0"}], [{**live, "deployedModels": []}], [{**live, "dedicatedEndpointDns": "evil.example"}]):
            with self.assertRaises(client.BatchStopped):
                client.find_endpoint(Cloud(endpoints))
        with self.assertRaises(ValueError):
            client.find_endpoint(Cloud([live]), "../models")


class DeployTest(unittest.TestCase):
    def test_variante_com_recorte_tem_tag_propria_e_build_mais_longo(self):
        source = "0123456789abcdef0123456789abcdef01234567"
        tags = {deploy.release_tag(source), deploy.release_tag(source, False, False, True), deploy.release_tag(source, True, True, True)}
        self.assertEqual(len(tags), 3)
        self.assertEqual(deploy.engine_name(with_photo_set=True), "fashn+photo_set")
        config = deploy.build_config("IMAGE", "SA", "fashionai-test", None, "fashn+photo_set")
        self.assertEqual(config["steps"][0]["args"], ["build", "--build-arg", "VTON_ENGINE=fashn+photo_set", "-t", "IMAGE", "."])
        self.assertEqual((config["timeout"], deploy.build_config("IMAGE", "SA", "fashionai-test", None, "fashn+portrait+photo_set")["timeout"]), ("3600s", "5400s"))

    def test_contexto_do_build_leva_o_codigo_do_lote_sem_testes(self):
        with tempfile.TemporaryDirectory() as tmp:
            deploy.stage_context(tmp)
            catalog = Path(tmp) / "scripts/catalog"
            for name in ("process_local_sd.py", "fashn_open.py", "fashn_open_assets.json", "photo_set.py", "whole_frame.py", "photo_preflight.py"):
                self.assertTrue((catalog / name).is_file(), name)
            self.assertFalse((catalog / "tests").exists())
            self.assertFalse(list(catalog.rglob("__pycache__")))
            self.assertTrue((Path(tmp) / "services/anatomical_vton/photoset_runtime.py").is_file())
            self.assertIn("COPY scripts/catalog", (Path(tmp) / "Dockerfile").read_text())

    def test_fumaca_do_recorte_confere_a_gpu_e_grava_a_pasta(self):
        with tempfile.TemporaryDirectory() as out:
            cloud = FakeCloud([echo])
            result = deploy.photo_set_smoke(cloud, ENDPOINT, HOST, "AAAA", "bottoms", "jeans", out)
            sent = cloud.sent[0][2]["instances"][0]
            self.assertEqual((sent["catalog_category"], sent["subcategory"], cloud.sent[0][1]), ("lower_piece", "jeans", ENDPOINT + ":predict"))
            self.assertEqual(result["status"], "READY")
            self.assertTrue((Path(result["folder"]) / "whole.png").is_file())
            cpu = lambda instance: {**echo(instance), "diagnostics": {"engine": "FASHN_OPEN_PHOTO_SET", "device": "cpu"}}
            failed = {"status": "FAILED", "reason": "PHOTOSET_GPU_FAILED", "photoSet": None,
                      "diagnostics": {"engine": "FASHN_OPEN_PHOTO_SET", "device": "cuda:0", "peakCudaBytes": 9}}
            for answer, message in ((cpu, "REAL_CUDA_PHOTO_SET_EVIDENCE_REQUIRED"), (failed, "PHOTO_SET_SMOKE_FAILED: PHOTOSET_GPU_FAILED")):
                with self.assertRaisesRegex(RuntimeError, message):
                    deploy.photo_set_smoke(FakeCloud([answer]), ENDPOINT, HOST, "AAAA", "tops", None, out)

    def test_motivo_livre_nunca_e_impresso(self):
        self.assertEqual(deploy.short_reason("PHOTOSET_GPU_FAILED"), "PHOTOSET_GPU_FAILED")
        self.assertEqual(deploy.short_reason("CUDA error: out of memory at /path/x.py"), "UNKNOWN")
        self.assertEqual(deploy.short_reason(None), "UNKNOWN")


if __name__ == "__main__":
    unittest.main()
