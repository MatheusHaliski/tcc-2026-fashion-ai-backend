"""export_glb_batch: junta faltam.txt com os GERAR_DE_NOVO do relatório, escolhe um flat lay aprovado por produto
(principal › com costas › mais recente), só aceita URL https, só lê o banco e lista quem ficou sem flat lay."""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import export_glb_batch as exp  # noqa: E402

A, B, C, D = (f"{n}" * 8 + "-1111-4111-8111-" + f"{n}" * 12 for n in "abcd")
URL = "https://app.example/media/catalog/flatlay/"


def image(pid, front, back=None, primary=False, updated="2026-11-01"):
    return {"product_id": pid, "flat_lay_url": front, "flat_lay_back_url": back, "is_primary": primary,
            "updated_at": updated, "category": "upper_piece", "subcategory": "t_shirt"}


class Conn:
    def __init__(self, rows):
        self.rows, self.sql, self.closed = rows, [], False

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params):
        assert sql.lstrip().startswith("SELECT")   # só leitura
        self.sql.append(params)

    def fetchall(self):
        return [r for r in self.rows if r["product_id"] in self.sql[-1]["ids"]]

    def close(self):
        self.closed = True


def test_lot_merges_inputs_picks_best_image_and_reports_missing(tmp_path, capsys):
    (tmp_path / "faltam.txt").write_text(f"{A}\n{B.upper()}\n\n{C}\n")
    with (tmp_path / "relatorio.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["product_id", "situacao"])
        writer.writeheader()
        writer.writerows([{"product_id": C, "situacao": "GERAR_DE_NOVO"}, {"product_id": D, "situacao": "GERAR_DE_NOVO"},
                          {"product_id": "", "situacao": "GERAR_DE_NOVO"}, {"product_id": A, "situacao": "IMPORTAR"}])
    conn = Conn([
        image(A, URL + "a-old.jpg", updated="2026-10-01"), image(A, URL + "a-new.jpg", URL + "a-back.jpg"),
        image(B, "/media/relativo.jpg"),                                     # sem https: não serve
        image(C, URL + "c-front.jpg", primary=True), image(C, URL + "c-other.jpg", URL + "c-back.jpg"),
        image(D, URL + "d.jpg", "http://inseguro/d-back.jpg"),
    ])
    out = tmp_path / "lote"
    assert exp.main(["--faltam", str(tmp_path / "faltam.txt"), "--relatorio", str(tmp_path / "relatorio.csv"),
                     "--out-dir", str(out)], connect=lambda: (conn, "teste")) == 0
    lot = {r["product_id"]: r for r in csv.DictReader((out / "lote.csv").open(encoding="utf-8"))}
    assert set(lot) == {A, C, D} and conn.closed
    assert (lot[A]["front_url"], lot[A]["back_url"], lot[A]["motivo"]) == (URL + "a-new.jpg", URL + "a-back.jpg", "FALTA")
    assert (lot[C]["front_url"], lot[C]["back_url"], lot[C]["motivo"]) == (URL + "c-front.jpg", "", "GERAR_DE_NOVO")
    assert lot[D]["back_url"] == "" and lot[D]["category"] == "upper_piece"
    assert (out / "sem_flat_lay.txt").read_text().split() == [B]
    assert "3  no lote.csv (1 com costas)" in capsys.readouterr().out   # só A tem costas https


def test_without_report_only_missing_list_is_used(tmp_path):
    (tmp_path / "faltam.txt").write_text(f"{A}\n")
    conn = Conn([image(A, URL + "a.jpg"), image(B, URL + "b.jpg")])
    exp.main(["--faltam", str(tmp_path / "faltam.txt"), "--out-dir", str(tmp_path)], connect=lambda: (conn, "t"))
    rows = list(csv.DictReader((tmp_path / "lote.csv").open(encoding="utf-8")))
    assert [r["product_id"] for r in rows] == [A] and conn.sql[0]["ids"] == (A,)
