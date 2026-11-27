"""audit_model3d_import: só lê; cruza objetos de catalog/model3d/ com renditions_json, separa órfãos (objeto sem linha)
de chaves sem objeto (modelo quebrado) e conta por status e gerador."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import audit_model3d_import as audit  # noqa: E402

K1, K2, K3, K4 = (f"catalog/model3d/{n * 32}/{n * 64}.glb" for n in "1234")


def row(status, *keys, generator="meshy-6-lite"):
    profiles = ("WEB", "DESKTOP_HIGH")
    return {"status": status, "generator": generator,
            "renditions_json": json.dumps({p: {"key": k, "bytes": 1} for p, k in zip(profiles, keys)})}


class Client:
    def __init__(self, objects):
        self.objects, self.writes = objects, []

    def get_paginator(self, name):
        assert name == "list_objects_v2"
        return self

    def paginate(self, Bucket, Prefix):
        return [{"Contents": [{"Key": k, "Size": s} for k, s in self.objects.items() if k.startswith(Prefix)]}, {}]


class Conn:
    def __init__(self, rows):
        self.rows, self.closed = rows, False

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql):
        assert sql.startswith("SELECT")

    def fetchall(self):
        return self.rows

    def close(self):
        self.closed = True


def test_compare_finds_orphans_and_dangling_keys():
    objects = {K1: 2_000_000, K2: 500_000, K3: 1_000_000}
    rows = [row("PUBLISHED", K1, K2), row("DRAFT", K4, generator="hunyuan3d-2.1"), row("RETIRED", K3),
            {"status": "DRAFT", "generator": None, "renditions_json": None}]
    result = audit.compare(objects, rows)
    assert result["objects"] == 3 and result["mb"] == 3.5
    assert result["status"] == {"PUBLISHED": 1, "DRAFT": 2, "RETIRED": 1}
    assert result["generators"] == {"meshy-6-lite": 2, "hunyuan3d-2.1": 1, "?": 1}
    assert result["orphans"] == [] and result["dangling"] == [K4]


def test_main_reads_only_and_writes_lists(tmp_path, capsys):
    client, conn = Client({K1: 10, K2: 10, "catalog/flatlay/x.jpg": 5}), Conn([row("PUBLISHED", K1)])
    code = audit.main(["--out-dir", str(tmp_path)], sources=lambda: (conn, "teste", client, "bucket-x"))
    assert code == 0 and conn.closed
    assert (tmp_path / "orfaos.txt").read_text().split() == [K2]
    assert (tmp_path / "sem_objeto.txt").read_text() == ""
    out = capsys.readouterr().out
    assert "bucket bucket-x" in out and "2  objetos em catalog/model3d/" in out
