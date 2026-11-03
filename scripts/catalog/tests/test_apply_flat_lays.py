"""apply_flat_lays: só flat lays aprovados e reconstruídos vão ao catálogo, renderizados no quadro 3:4, com a foto de
origem conferida no banco; ensaio não grava nada; linha que mudou é recusada sem deixar imagem órfã no bucket."""
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.catalog import apply_flat_lays as fl  # noqa: E402

SHA = "a" * 64


def png(size=(1024, 1536), color=(30, 90, 200)):
    img = Image.new("RGB", size, (255, 255, 255))
    img.paste(Image.new("RGB", (size[0] // 2, size[1] // 2), color), (size[0] // 4, size[1] // 4))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def make_lot(tmp_path, rows):
    lot = tmp_path / "lote-020"
    (lot / "cutouts").mkdir(parents=True)
    (lot / "backs").mkdir()
    for row in rows:
        (lot / "cutouts" / f"{row['id']}.png").write_bytes(png())
        if row.pop("_back", True):
            (lot / "backs" / f"{row['id']}.png").write_bytes(png(color=(20, 70, 160)))
    (lot / "audit.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))
    return lot


def row(pid, **extra):
    base = {"id": pid, "output": fl.RECONSTRUCTED, "image_id": f"img-{pid}", "original_url": f"https://loja/{pid}.jpg",
            "photo_url": f"https://cdn/{pid}.jpg", "source_sha256": SHA, "quality": "warn", "back_quality": "pass"}
    return {**base, **extra}


class Cursor:
    def __init__(self, conn):
        self.conn, self.rowcount = conn, 0

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params):
        self.conn.sql.append((sql.split()[0], params))
        if sql.lstrip().startswith("SELECT"):
            self._rows = [r for r in self.conn.live if r["id"] in params["ids"]]
        elif "flat_lay_status = 'APPROVED'" in sql:
            hit = [r for r in self.conn.live if r["id"] == params["image_id"] and r["image_url"] == params["original_url"]
                   and r["source_sha256"] == params["sha"]]
            self.rowcount = len(hit)
            self.conn.updates.extend(params for _ in hit)
        else:
            self.rowcount = 1

    def fetchall(self):
        return self._rows


class Conn:
    def __init__(self, live):
        self.live, self.sql, self.updates, self.commits, self.rollbacks = live, [], [], 0, 0

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class Storage:
    def __init__(self):
        self.put_calls, self.discarded = [], 0

    def put(self, data):
        self.put_calls.append(data)
        return f"https://media.example/catalog/flatlay/{len(self.put_calls)}.jpg"

    def discard(self, count):
        self.discarded += count


def run(tmp_path, rows, live, approved, *extra, storage=None):
    lot = make_lot(tmp_path, rows)
    (tmp_path / "ok.txt").write_text("\n".join(approved) + "\n")
    conn = Conn(live)
    code = fl.main(["--lots", str(lot), "--approved", str(tmp_path / "ok.txt"), "--audit", str(tmp_path / "a.jsonl"),
                    *extra], connect=lambda: (conn, "db-teste"), make_storage=lambda: storage)
    results = {r["id"]: r for r in map(json.loads, (tmp_path / "a.jsonl").read_text().splitlines())}
    return code, conn, results


def live_row(pid, **extra):
    return {"id": f"img-{pid}", "image_url": f"https://loja/{pid}.jpg", "source_sha256": SHA, **extra}


def test_ensaio_nao_grava_e_so_aceita_flat_lay_aprovado_e_reconstruido(tmp_path):
    rows = [row("ok"), row("recorte", output="needs_reconstruction_unavailable"), row("antigo", image_id=None),
            row("fora-da-lista")]
    code, conn, results = run(tmp_path, rows, [live_row("ok")], ["ok", "recorte", "antigo", "sumiu"],
                              "--out-dir", str(tmp_path / "previa"))
    assert code == 0 and conn.updates == [] and conn.commits == 0
    assert results["ok"]["status"] == "READY" and results["ok"]["back"] is True
    assert results["recorte"]["reason"] == "NOT_RECONSTRUCTED" and results["antigo"]["reason"] == "NO_IMAGE_ID"
    assert results["sumiu"]["reason"] == "NOT_IN_LOTS" and "fora-da-lista" not in results
    with Image.open(tmp_path / "previa" / "ok-front.jpg") as preview:
        assert preview.size == fl.FRAME and preview.getpixel((5, 5)) == (255, 255, 255)


def test_apply_envia_frente_e_costas_e_grava_a_identidade_da_foto(tmp_path):
    storage = Storage()
    code, conn, results = run(tmp_path, [row("ok")], [live_row("ok")], ["ok"], "--apply", storage=storage)
    assert code == 0 and len(storage.put_calls) == 2 and conn.commits == 1
    update = conn.updates[0]
    info = json.loads(update["json"])
    assert update["url"].endswith("/1.jpg") and update["back"].endswith("/2.jpg")
    assert info["version"] == "FLAT_LAY_V1" and info["aiGenerated"] is True and info["imageId"] == "img-ok"
    assert info["originalUrl"] == "https://loja/ok.jpg" and info["sourceSha256"] == SHA and info["lot"] == "lote-020"
    assert results["ok"]["status"] == "APPLIED"


def test_foto_trocada_no_catalogo_e_recusada_antes_de_enviar(tmp_path):
    storage = Storage()
    live = [live_row("ok", image_url="https://loja/nova-foto.jpg")]
    code, conn, results = run(tmp_path, [row("ok")], live, ["ok"], "--apply", storage=storage)
    assert results["ok"]["status"] == "STALE" and storage.put_calls == [] and conn.updates == []


def test_linha_alterada_entre_a_conferencia_e_a_gravacao_nao_deixa_imagem_orfa(tmp_path, monkeypatch):
    storage = Storage()
    monkeypatch.setattr(fl, "unchanged", lambda live, r: True)          # passou na conferência...
    live = [live_row("ok", source_sha256="b" * 64)]                    # ...mas o UPDATE não acha a linha
    code, conn, results = run(tmp_path, [row("ok")], live, ["ok"], "--apply", storage=storage)
    assert results["ok"]["status"] == "STALE" and storage.discarded == 2 and conn.rollbacks == 1 and conn.commits == 0


def test_sem_costas_grava_so_a_frente(tmp_path):
    storage = Storage()
    code, conn, results = run(tmp_path, [row("ok", _back=False)], [live_row("ok")], ["ok"], "--apply", storage=storage)
    assert len(storage.put_calls) == 1 and conn.updates[0]["back"] is None


def test_clear_desfaz_e_ensaio_do_clear_nao_grava(tmp_path):
    (tmp_path / "rm.txt").write_text("p1\np2\n")
    conn = Conn([])
    assert fl.main(["--clear", "--approved", str(tmp_path / "rm.txt")], connect=lambda: (conn, "db")) == 0
    assert conn.sql == [] and conn.commits == 0
    assert fl.main(["--clear", "--approved", str(tmp_path / "rm.txt"), "--apply"], connect=lambda: (conn, "db")) == 0
    assert [p["product_id"] for _, p in conn.sql] == ["p1", "p2"] and conn.commits == 1


def test_lote_refeito_vence_o_resultado_anterior(tmp_path):
    make_lot(tmp_path, [row("x", output="needs_reconstruction_unavailable")])
    retry = tmp_path / "retry"
    (retry / "cutouts").mkdir(parents=True)
    (retry / "audit.jsonl").write_text(json.dumps(row("x")) + "\n")
    lots = fl.load_lots([tmp_path / "lote-020", retry])
    assert lots["x"]["output"] == fl.RECONSTRUCTED and lots["x"]["lot"] == retry
