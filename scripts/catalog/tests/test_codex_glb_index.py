"""codex_glb_index + codex_glb_archive: o SQLite do Codex é aberto só para leitura, o ``schema`` nunca imprime valores,
e o ``archive`` remonta cada .glb base a partir dos pedaços com o SHA-256 conferido (pedaço e arquivo)."""
import csv
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import codex_glb_archive as arc  # noqa: E402
from scripts.catalog import codex_glb_index as idx  # noqa: E402
from scripts.catalog.tests.meshy_glb_fixture import meshy_glb  # noqa: E402

SECRET = "Maria da Silva maria@example.com"


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def archive_db(path: Path, glbs: dict[str, bytes], *, chunk=1000, corrupt=None) -> Path:
    """SQLite no formato FAI_GLB_ARCHIVE_V1 com cada .glb (base e P) em pedaços de ``chunk`` bytes."""
    conn = sqlite3.connect(path)
    conn.executescript("""CREATE TABLE glb_products (product_id TEXT PRIMARY KEY, metadata_json TEXT);
        CREATE TABLE glb_blobs (sha256 TEXT PRIMARY KEY, byte_length INT, content BLOB);
        CREATE TABLE glb_files (file_id TEXT PRIMARY KEY, product_id TEXT, size_label TEXT, sha256 TEXT,
                                byte_length INT, metadata_json TEXT);
        CREATE TABLE glb_file_parts (file_id TEXT, ordinal INT, blob_sha256 TEXT);
        CREATE TABLE glb_quality_reviews (product_id TEXT PRIMARY KEY, review_json TEXT);
        CREATE TABLE usuarios (id TEXT, email TEXT);""")
    conn.execute("INSERT INTO usuarios VALUES ('u1', ?)", (SECRET,))
    for pid, data in glbs.items():
        conn.execute("INSERT INTO glb_products VALUES (?, ?)", (pid, json.dumps({
            "id": pid, "brand": "Vans", "name": f"Camiseta {pid}", "category": "upper_piece", "subcategory": "t_shirt",
            "official_product_url": f"https://www.vans.com.br/p/{pid}?cor=1"})))
        conn.execute("INSERT INTO glb_quality_reviews VALUES (?, ?)", (pid, json.dumps({
            "quality_status": "QUARANTINE_ARTIFACT_REVIEW" if pid == "bbb" else "NO_HUMAN_VISIBLE",
            "garment_only_visual_gate": "PASS_FRONT_BACK_VIEWS", "quality_note": "costas" if pid == "bbb" else None})))
        for label, payload in (("base", data), ("P", data + b"P")):
            file_id = f"{pid}-{label}"
            conn.execute("INSERT INTO glb_files VALUES (?, ?, ?, ?, ?, ?)", (file_id, pid, label, _sha(payload),
                         len(payload), json.dumps({"task_id": f"task-{pid}", "size_label": label})))
            for n, start in enumerate(range(0, len(payload), chunk)):
                part = payload[start:start + chunk]
                stored = b"x" + part[1:] if corrupt == (file_id, n) else part
                conn.execute("INSERT OR IGNORE INTO glb_blobs VALUES (?, ?, ?)", (_sha(part), len(part), stored))
                conn.execute("INSERT INTO glb_file_parts VALUES (?, ?, ?)", (file_id, n, _sha(part)))
    conn.commit()
    conn.close()
    return path


def test_schema_lists_tables_and_roles_without_values(tmp_path, capsys):
    db = archive_db(tmp_path / "codex.sqlite3", {"aaa": meshy_glb()})
    assert idx.main(["schema", str(db)]) == 0
    out = capsys.readouterr().out
    assert "glb_files: 2 linhas" in out and "product_id=produto" in out and "FAI_GLB_ARCHIVE_V1" in out
    assert SECRET not in out and "maria" not in out and "Camiseta" not in out


def test_open_is_read_only(tmp_path):
    db = archive_db(tmp_path / "codex.sqlite3", {"aaa": meshy_glb()})
    before = _sha(db.read_bytes())
    conn = idx.open_ro(db)
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("DELETE FROM usuarios")
    conn.close()
    assert _sha(db.read_bytes()) == before
    with pytest.raises(SystemExit):
        idx.open_ro(tmp_path / "nao-existe.sqlite3")


def test_archive_reassembles_base_glbs_and_writes_manifest(tmp_path, capsys):
    glbs = {"aaa": meshy_glb(), "bbb": meshy_glb(triangles=2500)}
    db = archive_db(tmp_path / "codex.sqlite3", glbs, chunk=777)
    out = tmp_path / "saida"
    assert idx.main(["archive", str(db), "--out", str(out)]) == 0
    assert sorted(p.name for p in (out / "glb").iterdir()) == ["aaa.glb", "bbb.glb"]   # só o base, nunca P/M/G/GG
    for pid, data in glbs.items():
        assert (out / "glb" / f"{pid}.glb").read_bytes() == data
    rows = list(csv.DictReader((out / "manifesto.csv").open(encoding="utf-8")))
    assert [r["codex_product_id"] for r in rows] == ["aaa", "bbb"]
    first, second = rows
    assert first["product_id"] == "" and first["glb"] == "glb/aaa.glb" and first["meshy_task_id"] == "task-aaa"
    assert first["official_product_url"].startswith("https://www.vans.com.br/p/aaa") and first["brand"] == "Vans"
    assert second["codex_quality"] == "QUARANTINE_ARTIFACT_REVIEW" and second["codex_note"] == "costas"
    assert SECRET not in (out / "manifesto.csv").read_text(encoding="utf-8")
    assert "2 .glb base" in capsys.readouterr().out


def test_corrupt_part_stops_the_export(tmp_path):
    db = archive_db(tmp_path / "codex.sqlite3", {"aaa": meshy_glb()}, chunk=500, corrupt=("aaa-base", 1))
    conn = idx.open_ro(db)
    with pytest.raises(ValueError, match="BLOB_SHA_MISMATCH aaa-base"):
        arc.export_archive(conn, tmp_path / "saida")


def test_wrong_total_or_not_a_glb_is_refused(tmp_path):
    db = archive_db(tmp_path / "codex.sqlite3", {"aaa": meshy_glb(), "ccc": b"PK\x03\x04 zip, not glb"})
    conn = idx.open_ro(db)
    data = meshy_glb()
    with pytest.raises(ValueError, match="GLB_SHA_MISMATCH"):
        arc.assemble(conn, "aaa-base", _sha(data), len(data) + 1)
    with pytest.raises(ValueError, match="NOT_GLB ccc-base"):
        arc.export_archive(conn, tmp_path / "saida")


def test_unsafe_product_id_never_becomes_a_path(tmp_path):
    db = archive_db(tmp_path / "codex.sqlite3", {"../../fora": meshy_glb()})
    with pytest.raises(ValueError, match="id de produto inválido"):
        arc.export_archive(idx.open_ro(db), tmp_path / "saida")
    assert not (tmp_path / "fora.glb").exists()


def test_archive_command_refuses_other_formats(tmp_path):
    db = tmp_path / "outro.sqlite3"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE meshy_jobs (product_id TEXT, glb_path TEXT, task_id TEXT)")
    conn.execute("INSERT INTO meshy_jobs VALUES ('ABC', 'x/a.glb', 't1')")
    conn.commit()
    conn.close()
    with pytest.raises(SystemExit):
        idx.main(["archive", str(db), "--out", str(tmp_path)])
    out = tmp_path / "manifesto.csv"
    assert idx.main(["export", str(db), "--table", "meshy_jobs", "--product-col", "product_id",
                     "--glb-col", "glb_path", "--task-col", "task_id", "--out", str(out)]) == 0
    assert out.read_text(encoding="utf-8").splitlines() == ["product_id,glb,meshy_task_id", "abc,x/a.glb,t1"]
    with pytest.raises(SystemExit):
        idx.quoted("x; DROP TABLE y")
