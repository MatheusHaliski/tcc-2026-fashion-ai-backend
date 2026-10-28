"""rows.json a partir do acervo: categoria pela taxonomia, uma peça por URL, sem foto fica fora, hosts intercalados."""
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import acervo_rows as ar  # noqa: E402
from normalize_product import Normalizer  # noqa: E402


def item(url, brand="Hering", sub="t_shirt", images=("https://cdn-a.com/1.jpg",), sku="SKU1"):
    return {"brand": brand, "subcategory": sub, "sku": sku, "product_name": "Peça", "official_product_url": url,
            "images": [{"url": u, "type": "PACKSHOT"} for u in images], "source_type": "OFFICIAL_BRAND", "description": ""}


def write(tmp, name, items):
    path = Path(tmp) / name
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        fh.write("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
    return path


class AcervoRowsTest(unittest.TestCase):
    def test_linhas_categoria_dedupe_e_sem_foto(self):
        n = Normalizer()
        with tempfile.TemporaryDirectory() as tmp:
            a = write(tmp, "a.jsonl.gz", [item("https://hering.com.br/p/1", images=("https://cdn-a.com/1.jpg", "https://cdn-a.com/1b.jpg")),
                                           item("https://hering.com.br/p/2", sub="casual_pants", images=("https://cdn-a.com/2.jpg",), sku="SKU2"),
                                           item("https://hering.com.br/p/3", images=())])
            b = write(tmp, "b.jsonl.gz", [item("https://hering.com.br/p/1"), item("https://amaro.com/p/9", brand="Amaro", sub="dress", images=("https://cdn-b.com/9.jpg",), sku="SKU9")])
            rows = ar.rows_from([a, b], n)
            self.assertEqual([r["id"] for r in rows], ["https://hering.com.br/p/1", "https://hering.com.br/p/2", "https://amaro.com/p/9"])
            self.assertEqual(rows[0]["category"], "upper_piece"); self.assertEqual(rows[1]["category"], "lower_piece"); self.assertEqual(rows[2]["category"], "full_body_piece")
            self.assertEqual(rows[0]["image_url"], "https://cdn-a.com/1.jpg"); self.assertEqual(rows[1]["product_id"], "SKU2")
            todas = ar.rows_from([a, b], n, all_images=True)
            self.assertEqual([r["id"] for r in todas][:2], ["https://hering.com.br/p/1", "https://hering.com.br/p/1#img1"])
            self.assertEqual([r["brand"] for r in ar.rows_from([a, b], n, brands={"amaro"})], ["Amaro"])
            self.assertEqual(len(ar.rows_from([a, b], n, max_per_brand=1)), 2)

    def test_intercala_hosts(self):
        rows = [{"image_url": f"https://cdn-a.com/{i}.jpg", "n": i} for i in range(4)] + [{"image_url": "https://cdn-b.com/x.jpg", "n": 9}]
        hosts = [r["image_url"].split("/")[2] for r in ar.interleave_by_host(rows)]
        self.assertEqual(hosts[:2], ["cdn-a.com", "cdn-b.com"]); self.assertEqual(len(hosts), 5)

    def test_cli_escreve_o_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = write(tmp, "a.jsonl.gz", [item("https://hering.com.br/p/1")])
            out = Path(tmp) / "rows.json"
            self.assertEqual(ar.main([str(a), "--out", str(out)]), 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))[0]["brand"], "Hering")


if __name__ == "__main__":
    unittest.main()
