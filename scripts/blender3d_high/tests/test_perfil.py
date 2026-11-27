"""Perfil high: tetos por objeto, orçamento por sala e as medidas lidas do GLB publicado. Roda sem Blender:
``python -m unittest discover -s scripts/blender3d_high/tests -t .``."""
import json
import tempfile
import unittest
from pathlib import Path

from scripts.blender3d.build import MAX_TRIANGULOS
from scripts.blender3d_high import perfil
from scripts.blender3d_high.build import atualizar_manifesto
from scripts.blender3d_high.exportar import ler_glb, medidas

RAIZ = Path(__file__).resolve().parents[3]
SALAS = RAIZ / "public/flair/3d/salas"


class PerfilTest(unittest.TestCase):
    def test_objeto_comum_segue_o_teto_do_motor_e_so_o_heroi_sobe(self) -> None:
        self.assertEqual(perfil.TETO_COMUM, MAX_TRIANGULOS)
        self.assertEqual(perfil.teto_do_objeto(False), 3000)
        self.assertEqual(perfil.teto_do_objeto(True), perfil.TETO_HEROI)
        fora = perfil.estouros_de_objeto({"poltrona": (12000, True), "vaso": (3500, False), "ripa": (40, False)})
        self.assertEqual(fora, ["vaso: 3500 triângulos (teto 3000)"])

    def test_orcamento_da_sala_por_nivel(self) -> None:
        self.assertEqual(perfil.estouros_da_sala("detetive", "medio", 10, 10, 1000), [])
        fora = perfil.estouros_da_sala("detetive", "medio", 10**6, 999, 50 * 2**20)
        self.assertEqual(len(fora), 3)

    def test_medidas_contam_cada_copia_instanciada_e_uma_chamada_por_grupo(self) -> None:
        doc = {"accessors": [{"count": 30}, {"count": 4}, {"count": 6}],
               "meshes": [{"primitives": [{"indices": 0, "attributes": {"POSITION": 0}}]},
                          {"primitives": [{"indices": 2, "attributes": {"POSITION": 2}}]}],
               "nodes": [{"mesh": 0, "extensions": {"EXT_mesh_gpu_instancing": {"attributes": {"TRANSLATION": 1}}}},
                         {"mesh": 1}, {"children": [0]}]}
        m = medidas(doc)
        self.assertEqual((m["triangulos"], m["chamadas"], m["instanciadas"]), (10 * 4 + 2, 2, 4))

    def test_manifesto_troca_pelo_slug_e_tira_sala_sem_receita(self) -> None:
        arquivo = Path(tempfile.mkdtemp()) / "manifest.json"
        arquivo.write_text(json.dumps([{"slug": "a", "v": 1}, {"slug": "velha"}]), encoding="utf-8")
        resultado = atualizar_manifesto([{"slug": "a", "v": 2}, {"slug": "b"}], arquivo, {"a", "b"})
        self.assertEqual(resultado, [{"slug": "a", "v": 2}, {"slug": "b"}])

    def test_salas_publicadas_cabem_no_orcamento(self) -> None:
        manifesto = json.loads((SALAS / "manifest.json").read_text(encoding="utf-8"))
        self.assertGreater(len(manifesto), 0)
        for sala in manifesto:
            for nivel, dados in sala["levels"].items():
                glb = RAIZ / "public" / dados["url"].lstrip("/")
                m = medidas(ler_glb(glb))
                self.assertEqual((m["triangulos"], m["chamadas"]), (dados["triangles"], dados["calls"]), sala["slug"])
                total = dados.get("withImports", {"triangles": m["triangulos"], "calls": m["chamadas"]})
                fora = perfil.estouros_da_sala(sala["family"], nivel, total["triangles"], total["calls"], glb.stat().st_size)
                self.assertEqual(fora, [], sala["slug"])
            for imp in sala["imports"]:
                self.assertTrue((RAIZ / "public" / imp["url"].lstrip("/")).exists(), imp["url"])
                self.assertIn("Meshy", imp["credit"])


if __name__ == "__main__":
    unittest.main()
