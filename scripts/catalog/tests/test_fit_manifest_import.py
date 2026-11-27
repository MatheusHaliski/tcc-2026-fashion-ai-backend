"""O manifesto de encaixe do provador acompanha o .glb: baixado do lote e enviado ao lado do .glb importado."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import meshy_glb_apply as ap  # noqa: E402
from scripts.catalog import meshy_lote_download as dl  # noqa: E402


class FakeClient:
    def __init__(self, bucket_files=None):
        self.put, self.files = {}, bucket_files or {}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.put[Key] = (Body, ContentType)

    def download_file(self, bucket, key, out):
        if key not in self.files:
            raise FileNotFoundError(key)
        Path(out).write_bytes(self.files[key])


class FakeStorage:
    def __init__(self):
        self.client, self.bucket = FakeClient(), "b"


def test_manifesto_ao_lado_do_glb_vai_com_o_mesmo_caminho(tmp_path):
    glb = tmp_path / "modelo-web.glb"
    glb.write_bytes(b"glb")
    (tmp_path / "modelo-web.fit.json").write_text('{"versao": 1}')
    storage = FakeStorage()
    ap.store_manifest(storage, "catalog/model3d/abc/sha.glb", glb)
    assert storage.client.put == {"catalog/model3d/abc/sha.fit.json": (b'{"versao": 1}', "application/json")}


def test_sem_manifesto_nada_e_enviado(tmp_path):
    glb = tmp_path / "modelo-web.glb"
    glb.write_bytes(b"glb")
    storage = FakeStorage()
    ap.store_manifest(storage, "catalog/model3d/abc/sha.glb", glb)
    assert storage.client.put == {}


def test_download_traz_o_manifesto_do_motor_e_tolera_lote_sem_ele(tmp_path):
    base = "catalog/model3d/lote/top/t1"
    files = {f"{base}/modelo-web.glb": b"glb", f"{base}/tarefa.json": b"{}", f"{base}/modelo.fit.json": b"{}"}
    row = {"prefixo": "catalog/model3d/lote", "subcategoria": "top", "tarefa": "t1"}
    target = dl.download(FakeClient(files), "b", row, tmp_path)
    assert (target / "modelo-web.fit.json").read_bytes() == b"{}"
    files.pop(f"{base}/modelo.fit.json")
    target = dl.download(FakeClient(files), "b", {**row, "tarefa": "t1"}, tmp_path / "outro")
    assert not (target / "modelo-web.fit.json").exists()
