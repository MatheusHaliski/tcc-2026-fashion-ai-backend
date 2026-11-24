"""Manifesto dos objetos: o motor troca as próprias linhas, limpa as órfãs e nunca mexe no que é de terceiros.

Roda sem Blender: ``python -m unittest discover -s scripts/blender3d/tests``.
"""
import json
import tempfile
import unittest
from pathlib import Path

from scripts.blender3d.build import GERADOR, MAX_TRIANGULOS, atualizar_manifesto

TERCEIRO = {"slug": "poltrona", "triangles": 1928, "license": "CC BY 4.0", "source": "https://sketchfab.com/x", "games": ["BOUTIQUE_3D"]}


def gerado(slug: str, triangulos: int = 100) -> dict:
    return {"slug": slug, "triangles": triangulos, "license": "Própria", "source": f"{GERADOR}/receitas"}


class ManifestoTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pasta = Path(tempfile.mkdtemp())
        self.manifesto = self.pasta / "manifest.json"

    def escrever(self, itens: list[dict]) -> None:
        self.manifesto.write_text(json.dumps(itens), encoding="utf-8")
        for item in itens:
            (self.pasta / f"{item['slug']}.glb").write_bytes(b"glTF")

    def test_troca_a_linha_gerada_e_preserva_a_de_terceiros_na_ordem(self) -> None:
        self.escrever([TERCEIRO, gerado("cadeira", 100)])
        resultado = atualizar_manifesto([gerado("cadeira", 872), gerado("trave", 616)], self.manifesto)
        self.assertEqual([i["slug"] for i in resultado], ["poltrona", "cadeira", "trave"])
        self.assertEqual(resultado[0], TERCEIRO)
        self.assertEqual(resultado[1]["triangles"], 872)
        self.assertEqual(json.loads(self.manifesto.read_text(encoding="utf-8")), resultado)

    def test_remove_objeto_gerado_sem_receita_mas_nunca_o_de_terceiros(self) -> None:
        self.escrever([TERCEIRO, gerado("pilha-de-pneus"), gerado("cadeira")])
        resultado = atualizar_manifesto([gerado("cadeira")], self.manifesto, receitas={"cadeira"})
        self.assertEqual([i["slug"] for i in resultado], ["poltrona", "cadeira"])
        self.assertFalse((self.pasta / "pilha-de-pneus.glb").exists())
        self.assertTrue((self.pasta / "poltrona.glb").exists())

    def test_sem_a_lista_de_receitas_nada_e_removido(self) -> None:
        self.escrever([gerado("antigo")])
        self.assertEqual([i["slug"] for i in atualizar_manifesto([gerado("novo")], self.manifesto)], ["antigo", "novo"])

    def test_o_teto_de_triangulos_e_o_mesmo_do_teste_das_salas(self) -> None:
        self.assertEqual(MAX_TRIANGULOS, 3000)


if __name__ == "__main__":
    unittest.main()
