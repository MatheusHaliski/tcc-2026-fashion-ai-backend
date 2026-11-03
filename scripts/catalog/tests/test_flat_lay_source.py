"""flat_lay_source: lotes antigos (sem image_id) recuperam a foto de origem pela mesma regra do lote, e só quando
nenhuma foto do produto mudou depois dele."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.catalog import apply_flat_lays as fl  # noqa: E402
from scripts.catalog import flat_lay_source as src  # noqa: E402
from scripts.catalog.tests.test_apply_flat_lays import SHA, Conn, Cursor, make_lot, row  # noqa: E402

LOT_START = datetime(2026, 11, 3, 1, 0, 0)


def old_row(pid):
    return {k: v for k, v in row(pid).items() if k not in {"image_id", "original_url", "photo_url", "source_sha256"}}


def pick(pid):
    return {"id": pid, "image_id": f"img-{pid}", "image_version": 7, "original_url": f"https://loja/{pid}.jpg",
            "source_sha256": SHA, "image_url": f"https://cdn/{pid}.jpg"}


class RecoverCursor(Cursor):
    def execute(self, sql, params):
        if "ROW_NUMBER()" in sql:
            self.conn.sql.append(("SELECIONA", params))
            self._rows = [self.conn.picks[p] for p in params["ids"] if p in self.conn.picks]
        elif "MAX(updated_at)" in sql:
            self._rows = [{"product_id": p, "changed": self.conn.changed[p]} for p in params["ids"] if p in self.conn.changed]
        else:
            super().execute(sql, params)


class RecoverConn(Conn):
    def __init__(self, live, picks, changed):
        super().__init__(live)
        self.picks, self.changed = picks, changed

    def cursor(self):
        return RecoverCursor(self)


def lot_started_at(lot, when):
    stamp = when.replace(tzinfo=timezone.utc).timestamp()
    os.utime(lot / "audit.jsonl", (stamp, stamp))


def test_recupera_so_o_que_nao_mudou_depois_do_lote(tmp_path, monkeypatch):
    lot = make_lot(tmp_path, [old_row("igual"), old_row("mudou"), old_row("sumiu"), row("ja-tinha")])
    monkeypatch.setattr(src, "batch_started", lambda lot: LOT_START)
    rows = fl.load_lots([lot])
    conn = RecoverConn([], {"igual": pick("igual"), "mudou": pick("mudou")},
                       {"igual": LOT_START - timedelta(days=2), "mudou": LOT_START + timedelta(minutes=5)})
    refused = src.recover(conn, rows, ["igual", "mudou", "sumiu", "ja-tinha", "fora"], sql="SELECT ROW_NUMBER() x")
    assert refused == {"mudou": "SOURCE_CHANGED_SINCE_BATCH", "sumiu": "IMAGE_NOT_FOUND"}
    assert rows["igual"]["image_id"] == "img-igual" and rows["igual"]["source_recovered"] is True
    assert rows["igual"]["photo_url"] == "https://cdn/igual.jpg" and rows["igual"]["source_sha256"] == SHA
    assert "image_id" not in rows["mudou"] and rows["ja-tinha"]["image_id"] == "img-ja-tinha"
    assert conn.sql[0][1]["ids"] == ("igual", "mudou", "sumiu")   # só os sem image_id, e só leitura


def test_inicio_do_lote_em_utc_como_o_banco(tmp_path):
    lot = make_lot(tmp_path, [row("x")])
    lot_started_at(lot, LOT_START)
    started = src.batch_started(lot)
    assert started.tzinfo is None                                      # o DATETIME do banco não tem fuso
    if not hasattr(os.stat(lot / "audit.jsonl"), "st_birthtime"):     # fora do macOS vale a última escrita
        assert abs((started - LOT_START).total_seconds()) < 2


def test_consulta_de_recuperacao_e_a_mesma_regra_do_lote():
    sql = src.selection_sql()
    assert "ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY i.is_primary DESC, i.created_at ASC)" in sql
    assert "AND p.id IN %(ids)s" in sql and "i.id AS image_id" in sql


def test_ensaio_com_recover_source_fica_pronto_e_registra_a_recuperacao(tmp_path, monkeypatch):
    lot = make_lot(tmp_path, [old_row("igual"), old_row("mudou")])
    monkeypatch.setattr(src, "batch_started", lambda lot: LOT_START)
    monkeypatch.setattr(src, "selection_sql", lambda: "SELECT ROW_NUMBER() x")
    (tmp_path / "ok.txt").write_text("igual\nmudou\n")
    live = [{"id": "img-igual", "image_url": "https://loja/igual.jpg", "source_sha256": SHA}]
    conn = RecoverConn(live, {"igual": pick("igual"), "mudou": pick("mudou")},
                       {"igual": LOT_START - timedelta(hours=1), "mudou": LOT_START + timedelta(hours=1)})
    args = ["--lots", str(lot), "--approved", str(tmp_path / "ok.txt"), "--audit", str(tmp_path / "a.jsonl")]
    assert fl.main(args, connect=lambda: (conn, "db")) == 0
    first = {r["id"]: r for r in map(json.loads, (tmp_path / "a.jsonl").read_text().splitlines())}
    assert first["igual"]["reason"] == "NO_IMAGE_ID"                   # sem a opção, continua pulando
    (tmp_path / "a.jsonl").unlink()
    assert fl.main([*args, "--recover-source"], connect=lambda: (conn, "db")) == 0
    results = {r["id"]: r for r in map(json.loads, (tmp_path / "a.jsonl").read_text().splitlines())}
    assert results["igual"]["status"] == "READY"
    assert results["mudou"] == {"id": "mudou", "status": "SKIPPED", "reason": "SOURCE_CHANGED_SINCE_BATCH"}
    assert json.loads(fl.metadata({**pick("igual"), "id": "igual", "lot": lot, "source_recovered": True}))["sourceRecovered"]
