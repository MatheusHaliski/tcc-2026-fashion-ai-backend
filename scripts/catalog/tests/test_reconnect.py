"""Queda de conexão no meio do lote: o item é repetido numa conexão nova em vez de virar ERROR (e todo o resto junto)."""
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pymysql  # noqa: E402

import ingest  # noqa: E402
from ingest import Ingestor  # noqa: E402


class FakeConn:
    def __init__(self, fail_times=0):
        self.fail_times = fail_times
        self.commits = 0
        self.closed = False

    def cursor(self):
        if self.fail_times > 0:
            self.fail_times -= 1
            raise pymysql.err.OperationalError(2013, "Lost connection to MySQL server during query")
        return mock.MagicMock()

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass

    def close(self):
        self.closed = True


ITEM = {"brand": "Nike", "subcategory": "t_shirt", "product_name": "Camiseta básica"}


class ReconnectTest(unittest.TestCase):
    def setUp(self):
        self.sleep = mock.patch.object(ingest.time, "sleep").start()
        mock.patch.object(Ingestor, "_upsert", return_value="CREATE").start()
        self.addCleanup(mock.patch.stopall)

    def test_queda_reconecta_e_repete_o_item(self):
        fresh = FakeConn()
        ing = Ingestor(FakeConn(fail_times=1), reconnect=lambda: fresh)
        self.assertEqual(ing.ingest(ITEM, "lote#1"), "CREATE")
        self.assertIs(ing.conn, fresh)
        self.assertEqual(fresh.commits, 1)
        self.assertEqual(ing.report.errors, 0)

    def test_desiste_depois_das_tentativas(self):
        ing = Ingestor(FakeConn(fail_times=99), reconnect=lambda: FakeConn(fail_times=99), retries=2)
        self.assertEqual(ing.ingest(ITEM, "lote#1"), "ERROR")
        self.assertEqual(ing.report.errors, 1)
        self.assertEqual(self.sleep.call_count, 2)

    def test_erro_de_dado_nao_reconecta(self):
        conn = FakeConn()
        with mock.patch.object(Ingestor, "_upsert", side_effect=pymysql.err.IntegrityError(1062, "Duplicate entry")):
            ing = Ingestor(conn, reconnect=lambda: self.fail("não devia reconectar"))
            self.assertEqual(ing.ingest(ITEM, "lote#1"), "ERROR")


if __name__ == "__main__":
    unittest.main()
