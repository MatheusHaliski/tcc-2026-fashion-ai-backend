"""export_glb_batch + glb_batch_sources: lote sem exigir flat lay. Fonte por produto: flat lay aprovado › Peça inteira
(RENDERED) › foto (canônica aprovada › principal › do bucket); só https; só lê o banco; --catalogo pega todo produto sem
modelo PUBLISHED; --fontes restringe; lista quem ficou sem imagem."""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import export_glb_batch as exp  # noqa: E402
from scripts.catalog import glb_batch_sources as src  # noqa: E402

A, B, C, D, E = (f"{n}" * 8 + "-1111-4111-8111-" + f"{n}" * 12 for n in "abcde")
URL = "https://app.example/media/catalog/"


def image(pid, **kw):
    row = {"product_id": pid, "flat_lay_url": None, "flat_lay_back_url": None, "flat_lay_status": None,
           "whole_url": None, "whole_status": None, "stored_url": None, "image_url": None, "is_canonical": False,
           "processing_status": "PENDING", "is_primary": False, "updated_at": "2026-11-01", "category": "upper_piece",
           "subcategory": "t_shirt"}
    return {**row, **kw}


ROWS = [
    image(A, flat_lay_url=URL + "a-old.jpg", flat_lay_status="APPROVED", updated_at="2026-10-01"),
    image(A, flat_lay_url=URL + "a.jpg", flat_lay_back_url=URL + "a-back.jpg", flat_lay_status="APPROVED",
          whole_url=URL + "a-whole.png", whole_status="RENDERED", stored_url=URL + "a-foto.jpg"),
    image(B, flat_lay_url=URL + "b-pend.jpg", flat_lay_status="REVIEW",                 # flat lay não aprovado
          whole_url=URL + "b-whole.png", whole_status="RENDERED"),
    image(C, whole_url=URL + "c-whole.png", whole_status="REVIEW", image_url="https://loja.example/c.jpg",
          is_primary=True),
    image(C, stored_url=URL + "c-canonica.jpg", is_canonical=True, processing_status="APPROVED"),
    image(D, image_url="http://inseguro.example/d.jpg", flat_lay_url="/media/relativo.jpg", flat_lay_status="APPROVED"),
    image(E, image_url="https://loja.example/e.jpg"),
]


class Conn:
    def __init__(self, rows, without_model=()):
        self.rows, self.without_model, self.params, self.closed = rows, list(without_model), [], False

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        assert sql.lstrip().startswith("SELECT")   # só leitura
        self.params.append(params)
        self.result = ([{"id": p} for p in self.without_model] if params is None
                       else [r for r in self.rows if r["product_id"] in params["ids"]])

    def fetchall(self):
        return self.result

    def close(self):
        self.closed = True


def test_best_source_per_product_without_requiring_a_flat_lay():
    got = {pid: (r["fonte"], r["front_url"], r["back_url"]) for pid, r in src.choose(ROWS).items()}
    assert got == {
        A: ("FLAT_LAY", URL + "a.jpg", URL + "a-back.jpg"),         # o com costas vence o mais antigo
        B: ("WHOLE", URL + "b-whole.png", ""),
        C: ("FOTO", URL + "c-canonica.jpg", ""),                     # canônica aprovada › principal da loja
        E: ("FOTO", "https://loja.example/e.jpg", ""),
    }                                                                # D: nada https


def test_allowed_sources_restrict_the_choice():
    got = src.choose(ROWS, allowed={"WHOLE", "FOTO"})
    assert (got[A]["fonte"], got[A]["front_url"]) == ("WHOLE", URL + "a-whole.png")
    assert set(src.choose(ROWS, allowed={"FLAT_LAY"})) == {A}


def test_catalog_mode_reads_products_without_model_in_chunks(tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(exp, "CHUNK", 2)
    conn = Conn(ROWS, without_model=[A.upper(), B, C, D, E])
    assert exp.main(["--catalogo", "--out-dir", str(tmp_path)], connect=lambda: (conn, "teste")) == 0
    lot = list(csv.DictReader((tmp_path / "lote.csv").open(encoding="utf-8")))
    assert [(r["product_id"], r["fonte"], r["motivo"]) for r in lot] == [
        (A, "FLAT_LAY", "SEM_MODELO"), (B, "WHOLE", "SEM_MODELO"), (C, "FOTO", "SEM_MODELO"), (E, "FOTO", "SEM_MODELO")]
    assert [p["ids"] for p in conn.params[1:]] == [(A, B), (C, D), (E,)] and conn.closed
    assert (tmp_path / "sem_imagem.txt").read_text().split() == [D]
    out = capsys.readouterr().out
    assert "1  fonte FLAT_LAY" in out and "2  fonte FOTO" in out and "1  sem nenhuma imagem" in out


def test_missing_list_plus_report_regenerates(tmp_path):
    (tmp_path / "faltam.txt").write_text(f"{B}\n\n{C.upper()}\n")
    with (tmp_path / "relatorio.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["product_id", "situacao"])
        writer.writeheader()
        writer.writerows([{"product_id": C, "situacao": "GERAR_DE_NOVO"}, {"product_id": "", "situacao": "GERAR_DE_NOVO"},
                          {"product_id": E, "situacao": "IMPORTAR"}])
    conn = Conn(ROWS)
    exp.main(["--faltam", str(tmp_path / "faltam.txt"), "--relatorio", str(tmp_path / "relatorio.csv"),
              "--out-dir", str(tmp_path)], connect=lambda: (conn, "t"))
    lot = {r["product_id"]: r["motivo"] for r in csv.DictReader((tmp_path / "lote.csv").open(encoding="utf-8"))}
    assert lot == {B: "FALTA", C: "GERAR_DE_NOVO"}


def test_unknown_source_is_refused(tmp_path):
    with pytest.raises(SystemExit):
        exp.main(["--catalogo", "--fontes", "FOTO,MESHY"], connect=lambda: pytest.fail("conectou"))
