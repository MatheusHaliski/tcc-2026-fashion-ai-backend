"""Reparo dos produtos agrupados pela URL canônica antiga (Gap ?pid=): detecção, esconder e reimportar (SQLite)."""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import normalize_product  # noqa: E402
from ingest import Ingestor  # noqa: E402
from repair_merged_products import find_merged, repair  # noqa: E402
from test_ingest import Database  # noqa: E402


def old_canonical_url(url):
    """A regra antiga: descartava a query inteira (?pid= incluído)."""
    if not url:
        return None
    u = re.sub(r"(?i)^https?://", "", url.strip())
    u = re.sub(r"(?i)^www\.", "", u).split("#")[0].split("?")[0].rstrip("/")
    head, sep, tail = u.partition("/")
    return head.lower() + (sep + tail if sep else "")


def gap_row(pid: str, name: str) -> dict:
    return {"brand": "Gap", "subcategory": "t_shirt", "product_name": name,
            "official_product_url": f"https://www.gap.com/browse/product.do?pid={pid}&vid=1#reviews",
            "images": [{"url": f"https://www.gap.com/webcontent/{pid}.jpg"}]}


ROWS = [gap_row("1300460420010", "Camiseta Gap Logo"), gap_row("1300460420020", "Camiseta Gap Arco"),
        gap_row("1300460420030", "Camiseta Gap Bolso")]


class FindMergedTest(unittest.TestCase):
    def test_so_agrupados_de_verdade(self):
        products = [
            {"id": "gap", "canonical_url": "gap.com/browse/product.do"},
            {"id": "um", "canonical_url": "gap.com/browse/product.do?pid=9"},          # já na regra nova
            {"id": "mesma-pagina", "canonical_url": "nike.com/t/af1"},                # várias fotos, uma página
            {"id": "outra-base", "canonical_url": "levi.com/p"},                      # páginas de outro caminho
        ]
        images = [
            {"product_id": "gap", "source_url": "https://www.gap.com/browse/product.do?pid=1"},
            {"product_id": "gap", "source_url": "https://www.gap.com/browse/product.do?pid=2&vid=3"},
            {"product_id": "um", "source_url": "https://www.gap.com/browse/product.do?pid=9"},
            {"product_id": "mesma-pagina", "source_url": "https://www.nike.com/t/af1?utm=x"},
            {"product_id": "mesma-pagina", "source_url": "https://nike.com/t/af1"},
            {"product_id": "outra-base", "source_url": "https://levi.com/q?pid=1"},
            {"product_id": "outra-base", "source_url": "https://levi.com/q?pid=2"},
        ]
        merged = find_merged(products, images)
        self.assertEqual([m["id"] for m in merged], ["gap"])
        self.assertEqual(merged[0]["pieces"], ["gap.com/browse/product.do?pid=1", "gap.com/browse/product.do?pid=2"])
        self.assertEqual(merged[0]["photos"], 2)


class RepairTest(unittest.TestCase):
    def setUp(self):
        self.conn = Database()
        self.addCleanup(self.conn.close)
        # banco importado com a regra antiga: as três peças da Gap viram um produto com as três fotos
        with patch.object(normalize_product, "canonical_url", old_canonical_url):
            ing = Ingestor(self.conn)
            self.assertEqual([ing.ingest(r) for r in ROWS][0], "CREATE")
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        self.assertEqual(len(self.conn.rows("catalog_images")), 3)
        tmp = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8")
        tmp.write("\n".join(json.dumps(r, ensure_ascii=False) for r in ROWS) + "\n")
        tmp.close()
        self.acervo = tmp.name
        self.addCleanup(Path(tmp.name).unlink)
        self.log = []

    def visible(self):
        return [p for p in self.conn.rows("catalog_products") if p["ingestion_status"] in ("VALIDATED", "PERSISTABLE", "REFERENCE_ONLY")]

    def test_sem_apply_so_relata(self):
        result = repair(self.conn, apply=False, reimport=[self.acervo], out=self.log.append)
        self.assertEqual(len(result["merged"]), 1)
        self.assertEqual(len(result["merged"][0]["pieces"]), 3)
        self.assertEqual(result["report"].created, 3)          # simulação: contaria 3 peças novas
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        self.assertEqual(len(self.visible()), 1)
        self.assertTrue(any("[AGRUPADO]" in line and "3 peças" in line for line in self.log))

    def test_apply_esconde_o_agrupado_e_cria_uma_peca_por_pagina_com_a_propria_foto(self):
        result = repair(self.conn, apply=True, reimport=[self.acervo], out=self.log.append)
        self.assertEqual(result["hidden"], 1)
        visible = self.visible()
        self.assertEqual(len(visible), 3)
        self.assertEqual(sorted(p["canonical_url"] for p in visible), sorted(
            f"gap.com/browse/product.do?pid={r['official_product_url'].split('pid=')[1].split('&')[0]}" for r in ROWS))
        images = self.conn.rows("catalog_images")
        for p in visible:
            mine = [i for i in images if i["product_id"] == p["id"]]
            self.assertEqual(len(mine), 1, "cada peça com a própria foto, nenhuma das outras")
            self.assertTrue(mine[0]["is_primary"])
        # o agrupado continua no banco (peças do guarda-roupa que apontam para ele seguem válidas), só escondido
        self.assertEqual(len(self.conn.rows("catalog_products")), 4)
        # idempotente: rodar de novo não encontra nada
        again = repair(self.conn, apply=True, reimport=[self.acervo], out=self.log.append)
        self.assertEqual(again["merged"], [])
        self.assertEqual(len(self.visible()), 3)


if __name__ == "__main__":
    unittest.main()
