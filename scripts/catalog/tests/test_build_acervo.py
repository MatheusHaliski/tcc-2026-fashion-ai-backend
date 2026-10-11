import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_acervo  # noqa: E402
from normalize_product import Normalizer  # noqa: E402

N = Normalizer()


def row(name, url, **kw):
    return {"brand": "Hering", "subcategory": "t_shirt", "product_name": name, "official_product_url": url,
            "images": [{"url": "https://hering.vtexassets.com/a.jpg", "type": "PACKSHOT"}], "source_type": "OFFICIAL_BRAND", **kw}


class BuildAcervoTest(unittest.TestCase):
    def write(self, tmp, rows):
        path = Path(tmp) / "hering.jsonl"
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        return path

    def test_so_pecas_novas_validas_e_descricao_em_texto_puro(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write(tmp, [
                row("Camiseta Básica", "https://www.hering.com.br/camiseta-basica/p",
                    description="Camiseta <b>básica</b><br /><li>Algodão</li>"),
                row("Camiseta Básica", "https://www.hering.com.br/camiseta-basica/p?utm_source=x"),   # repetida
                row("Camiseta Logo", "https://www.hering.com.br/camiseta-logo/p"),                  # já no acervo
                row("Vale-presente", "https://www.hering.com.br/vale/p"),                           # fora do acervo
            ])
            rows, counts = build_acervo.build([path], N, {"https://www.hering.com.br/camiseta-logo/p"})
        self.assertEqual([r["product_name"] for r in rows["hering"]], ["Camiseta Básica"])
        self.assertEqual(rows["hering"][0]["description"], "Camiseta básica Algodão")
        self.assertEqual(counts["hering"]["repetida"], 1)
        self.assertEqual(counts["hering"]["ja_no_acervo"], 1)
        self.assertEqual(counts["hering"]["ok"], 1)
        self.assertEqual(counts["hering"]["com_foto"], 1)

    def test_arquivo_gz_estavel_e_legivel_pelo_importador(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write(tmp, [row("Camiseta Básica", "https://www.hering.com.br/camiseta-basica/p")])
            out = Path(tmp) / "acervo-teste.jsonl.gz"
            build_acervo.main(["--out", str(out), str(path)])
            first = out.read_bytes()
            build_acervo.main(["--out", str(out), str(path)])
            self.assertEqual(out.read_bytes(), first)                              # gzip sem data: mesmo arquivo
            lines = gzip.decompress(first).decode("utf-8").splitlines()
        self.assertEqual(json.loads(lines[0])["product_name"], "Camiseta Básica")


if __name__ == "__main__":
    unittest.main()
