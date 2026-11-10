"""import_meshy_glbs: liga o id do Codex ao produto do catálogo (UUID › URL oficial › marca + nome, nunca adivinha),
dá nota à versão WEB, respeita a quarentena do Codex, escolhe o melhor .glb por produto, gera faltam.txt; o ensaio não
grava nada; o --apply publica só nota BOM (REVISAR fica DRAFT), completa as peças do guarda-roupa sem modelo e, se
falhar, desfaz a transação e apaga o que enviou ao bucket."""
import csv
import hashlib
import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import codex_catalog_match as match  # noqa: E402
from scripts.catalog import import_meshy_glbs as imp  # noqa: E402
from scripts.catalog import meshy_glb_apply as ap  # noqa: E402
from scripts.catalog.tests.meshy_glb_fixture import meshy_glb  # noqa: E402

P1, P2, P3, P4 = (f"{n}" * 8 + "-1111-4111-8111-" + f"{n}" * 12 for n in "1234")
CATALOG = [
    {"id": P1, "product_name": "Camiseta Classic", "category": "upper_piece", "subcategory": "t_shirt",
     "official_product_url": "https://vans.com.br/p/classic/", "brand": "Vans"},
    {"id": P2, "product_name": "VMWILLOW Top", "category": "upper_piece", "subcategory": "top",
     "official_product_url": "https://www.veromoda.com/p/10350847_4", "brand": "Vero Moda"},
    {"id": P3, "product_name": "VMWILLOW Top", "category": "upper_piece", "subcategory": "top",
     "official_product_url": "https://www.veromoda.com/p/10350847_10363", "brand": "Vero Moda"},
    {"id": P4, "product_name": "Calça Jeans Reta", "category": "lower_piece", "subcategory": "jeans",
     "official_product_url": None, "brand": "Vans"},
]


class Cursor:
    def __init__(self, conn):
        self.conn, self.rowcount, self._rows = conn, 0, []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        c, head = self.conn, " ".join(sql.split())
        if head.startswith(("UPDATE", "INSERT")):
            if c.fail_on and c.fail_on in head:
                raise RuntimeError("banco caiu")
            c.writes.append((head.split()[0] + " " + head.split()[2 if head.startswith("INSERT") else 1], params))
            self.rowcount = c.pieces.get(params.get("product_id"), 0) if "wardrobe_items" in head else 1
        elif "WHERE p.id IN" in head:
            self._rows = [p for p in CATALOG if p["id"] in params["ids"]]
        elif "LOWER(b.name) IN" in head:
            self._rows = [p for p in CATALOG if p["brand"].lower() in params["brands"]]
        elif "FROM catalog_product_models_3d" in head:
            if c.no_table:
                raise RuntimeError(1146, "Table 'catalog_product_models_3d' doesn't exist")
            self._rows = c.existing
        elif "flat_lay_status" in head:
            self._rows = [{"product_id": p} for p in c.flat_lays]
        elif "FROM wardrobe_items" in head:
            self._rows = [{"catalog_product_id": p, "n": n} for p, n in c.pieces.items() if p in params["ids"]]
        else:
            raise AssertionError(head)

    def fetchall(self):
        return self._rows


class Conn:
    def __init__(self, existing=(), flat_lays=(), pieces=None, fail_on=None, no_table=False):
        self.existing, self.flat_lays, self.pieces = list(existing), list(flat_lays), dict(pieces or {})
        self.no_table = no_table
        self.fail_on, self.writes, self.commits, self.rollbacks = fail_on, [], 0, 0

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class Body(io.BytesIO):
    pass


class S3:
    def __init__(self, tamper=False):
        self.objects, self.deleted, self.tamper = {}, [], tamper

    def put_object(self, Bucket, Key, Body, ContentType, IfNoneMatch):
        assert ContentType == "model/gltf-binary" and IfNoneMatch == "*" and Key.startswith("catalog/model3d/")
        self.objects[Key] = Body[:-1] + b"?" if self.tamper else Body

    def get_object(self, Bucket, Key):
        return {"Body": Body(self.objects[Key])}

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)
        self.objects.pop(Key, None)


class Storage:
    def __init__(self, **kw):
        self.client, self.bucket = S3(**kw), "fashionai-media"


def lot(tmp_path, files):
    """Pasta com os .glb e o manifesto no formato do codex_glb_index.py archive."""
    (tmp_path / "glb").mkdir()
    rows = []
    for codex_id, data, extra in files:
        (tmp_path / "glb" / f"{codex_id}.glb").write_bytes(data)
        rows.append({"product_id": "", "glb": f"glb/{codex_id}.glb", "meshy_task_id": f"t-{codex_id}",
                     "codex_product_id": codex_id, "official_product_url": "", "brand": "", "name": "",
                     "codex_quality": "NO_HUMAN_VISIBLE; OTHER_QUALITY_NOT_CERTIFIED", **extra})
    with (tmp_path / "manifesto.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return tmp_path / "manifesto.csv"


def files():
    return [
        ("c1", meshy_glb(), {"official_product_url": "https://www.VANS.com.br/p/classic?cor=branco", "brand": "Vans"}),
        ("c2", meshy_glb(dims=(1.0, 1.8, 0.12)), {"official_product_url": "https://www.veromoda.com/p/10350847_4"}),
        ("c3", meshy_glb(), {"official_product_url": "https://www.veromoda.com/p/10350847_10363",
                             "codex_quality": "QUARANTINE_ARTIFACT_REVIEW"}),
        ("c4", meshy_glb(), {"brand": "Vero Moda", "name": "VMWILLOW Top"}),          # nome igual a dois produtos
        ("c5", meshy_glb(), {"brand": "Vans", "name": "Calça  jeans RETA"}),           # marca + nome, sem URL
        ("c6", meshy_glb(triangles=2500), {"product_id": P1}),                        # UUID direto, 2º do P1
        ("c7", meshy_glb(), {"official_product_url": "https://outra.loja/p/x"}),
    ]


def run(tmp_path, conn, *extra, storage=None):
    manifest = lot(tmp_path, files())
    out = tmp_path / "saida"
    code = imp.main(["--manifest", str(manifest), "--root", str(tmp_path), "--out-dir", str(out), *extra],
                    connect=lambda: (conn, "teste"), make_storage=lambda: storage)
    rows = {r["codex_id"]: r for r in csv.DictReader((out / "relatorio.csv").open(encoding="utf-8"))}
    return code, rows, out


def test_url_and_name_keys_normalize():
    assert match.url_key("https://WWW.Vans.com.br/p/classic/?cor=1#x") == "vans.com.br/p/classic"
    assert match.url_key("") is None and match.name_key("Vans", None) is None
    assert match.name_key("Vero Moda", "Calça  Jeans—Reta!") == "vero moda calca jeans reta"


def test_dry_run_matches_grades_and_writes_nothing(tmp_path):
    conn = Conn(flat_lays=[P1, P2, P3, P4, "9" * 36], pieces={P1: 2, P2: 1})
    code, rows, out = run(tmp_path, conn)
    assert code == 0 and conn.writes == [] and conn.commits == 0
    got = {k: (r["product_id"], r["ligacao"], r["nota"], r["situacao"]) for k, r in rows.items()}
    assert got == {
        "c1": (P1, "URL", "BOM", "DUPLICADO"),     # mesma nota do c6, mas o c6 é mais leve
        "c2": (P2, "URL", "REVISAR", "IMPORTAR"),
        "c3": (P3, "URL", "RUIM", "GERAR_DE_NOVO"),
        "c4": ("", "AMBIGUO_MARCA_NOME", "BOM", "SEM_PRODUTO"),
        "c5": (P4, "MARCA_NOME", "BOM", "IMPORTAR"),
        "c6": (P1, "ID", "BOM", "IMPORTAR"),
        "c7": ("", "NAO_ACHADO", "BOM", "SEM_PRODUTO"),
    }
    assert rows["c2"]["problemas"] == "THIN_PROFILE"
    assert "CODEX_QUARANTINE" in rows["c3"]["problemas"]
    assert rows["c1"]["pecas_guarda_roupa"] == "2" and rows["c1"]["receita_web"] == "original"
    assert (out / "faltam.txt").read_text().split() == sorted([P2, P3, "9" * 36])
    assert (out / "revisar.txt").read_text().split() == [P2]


def test_best_glb_per_product_wins_by_grade_then_size():
    items = [{"status": "IMPORTAR", "product_id": P1, "grade": g, "web_bytes": b} for g, b in
             (("REVISAR", 10), ("BOM", 30), ("BOM", 20))]
    imp.keep_best(items)
    assert [i["status"] for i in items] == ["DUPLICADO", "DUPLICADO", "IMPORTAR"]


def test_already_imported_and_published_is_skipped_and_covered(tmp_path):
    sha = hashlib.sha256(meshy_glb()).hexdigest()
    conn = Conn(existing=[{"catalog_product_id": P1, "sha256": sha, "status": "PUBLISHED"},
                          {"catalog_product_id": P4, "sha256": "x" * 64, "status": "DRAFT"}], flat_lays=[P1, P4])
    _, rows, out = run(tmp_path, conn)
    assert rows["c1"]["situacao"] == "JA_IMPORTADO" and rows["c6"]["situacao"] == "IMPORTAR"   # outro arquivo
    assert (out / "faltam.txt").read_text().split() == []   # P4 entra agora com nota BOM (c5)


def test_apply_publishes_good_drafts_review_and_backfills_pieces(tmp_path):
    conn, storage = Conn(flat_lays=[P1, P2], pieces={P1: 2, P2: 1}), Storage()
    code, rows, out = run(tmp_path, conn, "--apply", storage=storage)
    assert code == 0 and conn.rollbacks == 0
    kinds = [w[0] for w in conn.writes]
    assert kinds.count("INSERT catalog_product_models_3d") == 3          # c1/c6 (o melhor), c2, c5
    inserts = {w[1]["product_id"]: w[1] for w in conn.writes if w[0] == "INSERT catalog_product_models_3d"}
    assert inserts[P2]["status"] == "DRAFT" and inserts[P2]["published_at"] is None
    assert inserts[P4]["status"] == "PUBLISHED" and inserts[P4]["published_by"] == ap.ACTOR
    backfills = [w[1] for w in conn.writes if w[0] == "UPDATE wardrobe_items"]
    assert sorted(b["product_id"] for b in backfills) == sorted([P1, P4])   # DRAFT nunca vai para a peça
    assert all(b["url"].startswith("/media/catalog/model3d/") for b in backfills)
    assert {w[1]["product_id"] for w in conn.writes if w[0] == "UPDATE catalog_product_models_3d"} == {P1, P4}
    assert sum(r["situacao"] == "IMPORTADO" for r in rows.values()) == 3
    assert len(storage.client.objects) == 3 and storage.client.deleted == []   # arquivos pequenos: só WEB
    assert (out / "faltam.txt").read_text().split() == [P2]


def test_apply_failure_rolls_back_and_deletes_uploads(tmp_path):
    conn, storage = Conn(fail_on="INSERT INTO catalog_product_models_3d"), Storage()
    code, rows, _ = run(tmp_path, conn, "--apply", storage=storage)
    assert code == 1 and conn.commits == 0 and conn.rollbacks == 3
    assert storage.client.objects == {} and len(storage.client.deleted) == 3
    assert rows["c6"]["situacao"] == "FALHOU RuntimeError: banco caiu"


def test_without_the_v86_table_dry_run_works_and_apply_refuses(tmp_path, capsys):
    code, rows, out = run(tmp_path, Conn(no_table=True, flat_lays=[P2]))
    assert code == 0 and rows["c6"]["situacao"] == "IMPORTAR" and "V97 não aplicada" in capsys.readouterr().out
    manifest = tmp_path / "manifesto.csv"
    conn, storage = Conn(no_table=True), Storage()
    assert imp.main(["--manifest", str(manifest), "--root", str(tmp_path), "--out-dir", str(tmp_path / "x"), "--apply"],
                    connect=lambda: (conn, "teste"), make_storage=lambda: storage) == 2
    assert conn.writes == [] and storage.client.objects == {}


def test_dead_connection_still_cleans_the_bucket_and_reconnects(tmp_path):
    class Dead(Conn):
        def __init__(self):
            super().__init__(fail_on="INSERT INTO catalog_product_models_3d")
            self.pings = 0

        def rollback(self):
            raise RuntimeError("conexão encerrada")

        def ping(self, reconnect=False):
            assert reconnect
            self.pings += 1
    conn, storage = Dead(), Storage()
    code, rows, _ = run(tmp_path, conn, "--apply", storage=storage)
    assert code == 1 and storage.client.objects == {} and len(storage.client.deleted) == 3
    assert conn.pings == 4                                   # antes de cada peça e antes do faltam.txt
    assert imp.failure(ValueError("linha 1\nlinha 2")) == "FALHOU ValueError: linha 1 linha 2"
    assert imp.failure(KeyError()) == "FALHOU KeyError"


def test_upload_is_read_back_and_tampered_copy_removed():
    storage = Storage(tamper=True)
    with pytest.raises(ValueError, match="GLB_UPLOAD_VERIFICATION_FAILED"):
        ap.store(storage, meshy_glb())
    assert storage.client.objects == {} and len(storage.client.deleted) == 1


def test_large_original_keeps_desktop_rendition(monkeypatch):
    data = meshy_glb()
    monkeypatch.setattr(imp, "web_rendition", lambda d: (d[: len(d) // 2], "normal_jpeg"))
    out = imp.renditions(data)
    assert set(out) == {"WEB", "DESKTOP_HIGH"} and out["DESKTOP_HIGH"] == (data, "original")
    monkeypatch.setattr(imp, "web_rendition", lambda d: None)
    assert imp.renditions(data) == {}


def test_missing_file_is_bad_and_locate_never_leaves_root(tmp_path):
    q, size, recipe = imp.grade(None, "")
    assert q["issues"] == ["FILE_NOT_FOUND"] and size is None and recipe == ""
    (tmp_path / "a").mkdir()
    (tmp_path / "b").mkdir()
    for d in ("a", "b"):
        (tmp_path / d / "x.glb").write_bytes(b"glTF")
    assert imp.locate(tmp_path, "x.glb") is None                    # nome repetido: ambíguo
    assert imp.locate(tmp_path, "a/x.glb") == (tmp_path / "a" / "x.glb").resolve()
    escaped = imp.locate(tmp_path / "a", "../b/x.glb")          # caminho que sai da pasta: só o nome, dentro dela
    assert escaped == (tmp_path / "a" / "x.glb") and (tmp_path / "a").resolve() in escaped.resolve().parents
