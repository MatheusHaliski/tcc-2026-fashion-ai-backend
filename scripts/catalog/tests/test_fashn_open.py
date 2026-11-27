"""Engine fashn-open: rótulos iguais aos do fashn-vton-1.5, fusão parser × BiRefNet e pesos conferidos por hash antes de qualquer import."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fashn_open as fo  # noqa: E402

try:
    import torch  # noqa: F401
    HAS_TORCH = True
except ImportError:                                  # o CI do catálogo não instala torch
    HAS_TORCH = False


def names(ids):
    return sorted(fo.IDS_TO_LABELS[i] for i in ids)


class LabelsTest(unittest.TestCase):
    def test_rotulos_por_categoria_sao_os_do_fashn_vton(self):
        self.assertEqual(names(fo.garment_label_ids("upper_piece", "t_shirt")), ["dress", "scarf", "top"])
        self.assertEqual(names(fo.garment_label_ids("lower_piece", "skirt")), ["belt", "pants", "skirt"])
        self.assertEqual(names(fo.garment_label_ids("full_body_piece", "dress")), ["belt", "dress", "pants", "scarf", "skirt", "top"])
        self.assertEqual(fo.garment_label_ids("upper_piece", "matching_set"), fo.garment_label_ids("full_body_piece", "jumpsuit"))
        self.assertEqual(names(fo.garment_label_ids("shoes_piece", "sneaker")), ["feet"])
        self.assertIn("bag", names(fo.garment_label_ids("accessory_piece", "cap")))
        self.assertIsNone(fo.garment_label_ids("other", None))
        self.assertEqual(fo.fashn_category("lower_piece", "jeans"), "bottoms")
        self.assertIsNone(fo.fashn_category("shoes_piece", "boot"))

    def test_tabelas_iguais_as_do_pacote_quando_instalado(self):
        try:
            import fashn_human_parser as parser
        except ImportError:
            self.skipTest("fashn-human-parser não instalado")
        self.assertEqual(fo.LABELS_TO_IDS, parser.LABELS_TO_IDS)
        self.assertEqual(fo.BODY_COVERAGE_TO_LABELS, parser.BODY_COVERAGE_TO_LABELS)
        self.assertEqual(fo.CATEGORY_TO_BODY_COVERAGE, parser.CATEGORY_TO_BODY_COVERAGE)


def scene():
    """Camiseta (rótulo top) entre dois braços, rosto acima, barra que só o BiRefNet enxerga e um objeto solto longe."""
    labels = np.zeros((120, 100), dtype=np.int64)
    labels[40:80, 30:70] = 3            # top
    labels[10:30, 40:60] = 1            # rosto
    labels[30:40, 45:55] = 16           # pescoço (tronco) dentro da gola
    labels[40:80, 20:30] = 12           # braço esquerdo
    labels[40:80, 70:80] = 12           # braço direito
    alpha = np.zeros((120, 100), dtype=np.float32)
    alpha[labels > 0] = 1.0
    alpha[80:83, 30:70] = 1.0           # barra: o parser disse fundo, o BiRefNet vê peça
    alpha[100:110, 10:20] = 1.0         # objeto solto longe da peça (não é dela)
    return labels, alpha


class FuseTest(unittest.TestCase):
    def test_parser_define_corpo_e_birefnet_define_a_borda(self):
        labels, alpha = scene()
        f = fo.fuse(labels, alpha, fo.garment_label_ids("upper_piece", "t_shirt"))
        self.assertEqual(f.mode, "parser+birefnet"); self.assertTrue(f.person); self.assertEqual(f.kept, ("top",))
        self.assertTrue(f.target[60, 50]); self.assertTrue(f.target[82, 50], "a barra fina do BiRefNet entra na peça")
        self.assertFalse(f.target[60, 25]); self.assertFalse(f.target[20, 50]); self.assertFalse(f.target[35, 50])
        self.assertFalse(f.target[105, 15], "objeto solto longe da peça não é peça")
        for y, x in ((60, 25), (20, 50), (35, 50), (105, 15)):
            self.assertTrue(f.forbidden[y, x], (y, x))
        self.assertFalse(f.forbidden[60, 50])
        self.assertEqual(f.alpha[60, 50], 1.0); self.assertEqual(f.alpha[20, 50], 0.0); self.assertEqual(f.alpha[105, 15], 0.0)
        self.assertEqual(f.alpha.dtype, np.float32)

    def test_cascalhos_nao_entram_na_peca(self):
        labels, alpha = scene()
        labels[100:102, 80:82] = 3; alpha[100:102, 80:82] = 1.0      # 4 px rotulados 'top' longe da camiseta
        f = fo.fuse(labels, alpha, {3})
        self.assertFalse(f.target[100, 80]); self.assertTrue(f.target[60, 50])
        self.assertTrue(fo.keep_large(np.ones((10, 10), dtype=bool)).all())
        # um fio de 1 px saindo da peça (cabelo, linha solta) é descartado; a barra de 3 px de espessura fica
        hair = labels.copy(); alpha_hair = alpha.copy(); hair[20:40, 65] = 3; alpha_hair[20:40, 65] = 1.0
        g = fo.fuse(hair, alpha_hair, {3})
        self.assertFalse(g.target[25, 65]); self.assertTrue(g.target[82, 50])

    def test_sem_pessoa_e_flat_lay_so_birefnet(self):
        labels, alpha = scene()
        labels[labels > 0] = 2                       # o parser "viu" cabelo em cima do produto (bola, tricô): não é pessoa
        f = fo.fuse(labels, alpha, fo.garment_label_ids("upper_piece", "t_shirt"))
        self.assertEqual(f.mode, "birefnet-flat-lay"); self.assertFalse(f.person); self.assertIsNone(f.forbidden)
        np.testing.assert_array_equal(f.target, alpha >= 0.5)
        g = fo.fuse(labels, alpha, None)
        self.assertEqual(g.mode, "birefnet-only")

    def test_formas_diferentes_e_mascaras_para_o_measure(self):
        labels, alpha = scene()
        with self.assertRaises(ValueError):
            fo.fuse(labels[:-1], alpha, {3})
        masks = fo.fuse(labels, alpha, {3}).photo_masks("upper_piece", "t_shirt")
        self.assertEqual(masks.target.size, (100, 120)); self.assertEqual(masks.target.mode, "L")
        self.assertEqual(masks.source, "fashn-open:parser+birefnet"); self.assertTrue(masks.isolation_verified); self.assertTrue(masks.human_present)
        self.assertEqual(np.asarray(masks.target)[60, 50], 255); self.assertEqual(np.asarray(masks.forbidden)[60, 25], 255)
        self.assertIsNone(fo.fuse(labels, alpha, None).photo_masks("shoes_piece", "boot").forbidden)

    def test_atestacoes_do_preflight_vem_da_evidencia_dos_dois_modelos(self):
        labels, alpha = scene()
        f = fo.fuse(labels, alpha, {3})
        self.assertEqual(f.evidence, {"touchesBorder": False, "bodyInsideFraction": 0.0, "occluderFraction": 0.0})
        masks = f.photo_masks("upper_piece", "t_shirt")
        self.assertEqual((masks.complete, masks.occluded, masks.measurement_verified), (True, False, True))
        # mãos sobre o tecido: oclusão incerta (nenhum preenchimento recupera o que está NA FRENTE da peça)
        hands = labels.copy(); hands[55:65, 45:55] = 13
        self.assertIsNone(fo.fuse(hands, alpha, {3}).photo_masks("upper_piece", "t_shirt").occluded)
        # corpo demais por dentro da peça (um grande vão de pele entre os lados): oclusão incerta
        gap = labels.copy(); gap[45:80, 40:60] = 16; alpha_gap = alpha.copy()
        self.assertIsNone(fo.fuse(gap, alpha_gap, {3}).photo_masks("upper_piece", "t_shirt").occluded)
        # peça encostando na borda da foto: incompleta
        edge = labels.copy(); edge[40:80, 0:30] = 3; alpha_edge = alpha.copy(); alpha_edge[40:80, 0:30] = 1.0
        self.assertFalse(fo.fuse(edge, alpha_edge, {3}).photo_masks("upper_piece", "t_shirt").complete)
        # flat-lay verificado: sem pessoa, a máscara de corpo existe vazia e a medição é atestada
        flat = labels.copy(); flat[flat > 0] = 2
        fm = fo.fuse(flat, alpha, {3}).photo_masks("upper_piece", "t_shirt")
        self.assertTrue(fm.isolation_verified); self.assertIsNotNone(fm.forbidden); self.assertEqual(np.asarray(fm.forbidden).max(), 0)
        self.assertEqual((fm.complete, fm.occluded, fm.measurement_verified, fm.human_present), (True, False, True, False))
        # sem rótulos para a categoria (parser não roda): nada é atestado
        om = fo.fuse(labels, alpha, None).photo_masks("other", None)
        self.assertEqual((om.complete, om.occluded, om.measurement_verified, om.isolation_verified, om.human_present), (None, None, False, False, None))


def fake_manifest():
    content = {"a.bin": b"alpha" * 10, "birefnet.py": b"X = 1\n"}
    paths = {"a.bin": "demo/a.bin", "birefnet.py": "birefnet/code/birefnet.py"}
    files = [{"component": "demo", "repo": "org/demo", "revision": "rev", "filename": name, "path": paths[name], "size": len(data),
              "sha256": hashlib.sha256(data).hexdigest()} for name, data in content.items()]
    return content, {"files": files}


class AssetsTest(unittest.TestCase):
    def test_download_confere_o_sha256_e_nao_baixa_de_novo(self):
        content, manifest = fake_manifest()
        fetched = []

        def fetch(url, dest):
            fetched.append(url)
            Path(dest).write_bytes(content[url.rsplit("/", 1)[1]])
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fo, "assets", return_value=manifest):
            done = fo.download(Path(tmp), fetch=fetch, log=lambda m: None)
            self.assertEqual(len(done), 2); self.assertEqual(fetched, ["https://huggingface.co/org/demo/resolve/rev/a.bin", "https://huggingface.co/org/demo/resolve/rev/birefnet.py"])
            self.assertEqual(fo.verify(Path(tmp)), [])
            self.assertTrue((Path(tmp) / "birefnet/code/__init__.py").exists()); self.assertTrue((Path(tmp) / "fashn_open_manifest.json").exists())
            fo.download(Path(tmp), fetch=fetch, log=lambda m: None)
            self.assertEqual(len(fetched), 2, "arquivo íntegro não é baixado de novo")

    def test_download_recusa_conteudo_adulterado(self):
        _, manifest = fake_manifest()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fo, "assets", return_value=manifest):
            with self.assertRaisesRegex(ValueError, "FASHN_OPEN_SHA256_MISMATCH:demo/a.bin"):
                fo.download(Path(tmp), fetch=lambda url, dest: Path(dest).write_bytes(b"alpha" * 10 + b"!"), log=lambda m: None)
            self.assertEqual(list(Path(tmp).rglob("a.bin*")), [], "nem o .part fica")

    def test_verify_lista_ausente_tamanho_e_hash(self):
        content, manifest = fake_manifest()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fo, "assets", return_value=manifest):
            root = Path(tmp)
            self.assertEqual(fo.verify(root), ["ausente: demo/a.bin", "ausente: birefnet/code/birefnet.py"])
            (root / "demo").mkdir(); (root / "demo/a.bin").write_bytes(b"x")
            (root / "birefnet/code").mkdir(parents=True); (root / "birefnet/code/birefnet.py").write_bytes(b"X = 2\n")
            self.assertEqual(fo.verify(root), ["tamanho: demo/a.bin", "sha256: birefnet/code/birefnet.py"])
            with self.assertRaisesRegex(ValueError, "^FASHN_OPEN_ASSETS_INVALID:"):
                fo.verify_component(root, "demo")

    def test_pins_reais_estao_completos(self):
        files = fo.assets()["files"]
        self.assertEqual({f["component"] for f in files}, {"parser", "birefnet", "lama"})
        for f in files:
            self.assertRegex(f["revision"], r"^[0-9a-f]{40}$"); self.assertRegex(f["sha256"], r"^[0-9a-f]{64}$"); self.assertGreater(f["size"], 0)
            self.assertTrue(f["path"].endswith(f["filename"]))
        self.assertIn("birefnet/code/birefnet.py", {f["path"] for f in files})


class ImportTest(unittest.TestCase):
    def test_importa_o_codigo_do_birefnet_como_pacote_isolado(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fo, "PACKAGE", "fashn_open_birefnet_test"):
            code = Path(tmp) / "code"
            code.mkdir()
            (code / "BiRefNet_config.py").write_text("X = 20\n", encoding="utf-8")
            (code / "birefnet.py").write_text("from .BiRefNet_config import X\nY = X + 1\n", encoding="utf-8")
            try:
                module = fo.import_birefnet(code)
                self.assertEqual(module.net.Y, 21); self.assertEqual(module.cfg.X, 20)
                self.assertTrue((code / "__init__.py").exists())
            finally:
                for name in [n for n in sys.modules if n.startswith("fashn_open_birefnet_test")]:
                    sys.modules.pop(name, None)


class ProviderTest(unittest.TestCase):
    def test_parser_so_roda_quando_a_categoria_tem_rotulos(self):
        calls = []

        class Matting:
            device = "cpu"

            def alpha(self, image):
                a = np.zeros((image.height, image.width), np.float32); a[10:30, 10:30] = 1; return a

        class Parser:
            def predict(self, image):
                calls.append(1)
                labels = np.zeros((image.height, image.width), np.int64)
                labels[10:30, 10:30] = 3; labels[10:30, 5:10] = 12; labels[2:10, 15:25] = 1
                return labels
        provider = fo.FashnOpenProvider(Path("/nonexistent"), parser=Parser(), matting=Matting(), tta=False)
        f = provider.analyse(Image.new("RGB", (40, 40)), "upper_piece", "t_shirt")
        self.assertEqual(f.mode, "parser+birefnet"); self.assertEqual(len(calls), 1); self.assertTrue(f.forbidden[20, 7])
        g = provider.analyse(Image.new("RGB", (40, 40)), "other", None)
        self.assertEqual(g.mode, "birefnet-only"); self.assertEqual(len(calls), 1, "sem rótulos para a categoria o parser não roda")

    @unittest.skipUnless(HAS_TORCH, "torch ausente")
    def test_tta_media_os_logits_da_foto_e_do_espelho(self):
        import torch

        class Parser:
            """Na foto original a metade direita sai 'dress' por pouco; no espelho (onde ela vira a metade esquerda) sai 'pants' com folga."""

            def predict(self, image, return_logits=False):
                w = image.width
                logits = torch.zeros(1, 18, image.height, w)
                left = np.asarray(image)[0, 0, 0] == 0           # a imagem de teste marca a coluna 0 em preto; o espelho a leva para a direita
                if left:                                        # foto original
                    logits[0, 6, :, : w // 2] = 5.0             # pants à esquerda
                    logits[0, 4, :, w // 2:] = 1.0; logits[0, 6, :, w // 2:] = 0.8       # 'dress' ganha por pouco à direita
                else:                                           # espelho: a metade de interesse ficou à esquerda
                    logits[0, 6, :, : w // 2] = 4.0             # pants com folga
                    logits[0, 6, :, w // 2:] = 5.0
                return logits if return_logits else logits.argmax(1)[0].numpy()
        image = Image.new("RGB", (20, 10), (255, 255, 255))
        for y in range(10):
            image.putpixel((0, y), (0, 0, 0))
        plain = fo.FashnOpenProvider(Path("/x"), parser=Parser(), matting=object(), tta=False).labels(image)
        tta = fo.FashnOpenProvider(Path("/x"), parser=Parser(), matting=object(), tta=True).labels(image)
        self.assertEqual(int(plain[5, 15]), 4, "sem TTA a metade direita fica 'dress'")
        self.assertEqual(int(tta[5, 15]), 6, "com TTA a média com o espelho devolve 'pants'")
        self.assertEqual(int(tta[5, 3]), 6)


@unittest.skipUnless(HAS_TORCH, "torch ausente")
class TorchModelsTest(unittest.TestCase):
    def test_lama_preenche_so_a_mascara_e_preserva_o_resto(self):
        class FakeJit:
            def eval(self):
                return self

            def to(self, device):
                return self

            def __call__(self, image, mask):
                return image * (1 - mask) + 0.5 * mask
        lama = fo.LamaInpainter(Path("/nonexistent"))
        lama.model = FakeJit()                                   # já "carregado": nada é lido do disco
        image = Image.new("RGB", (70, 50), (200, 40, 40))        # 70×50 não é múltiplo de 8: exercita o padding
        mask = Image.new("L", (70, 50), 0); mask.paste(255, (10, 10, 30, 30))
        out = np.asarray(lama.inpaint(image, mask))
        self.assertEqual(out.shape, (50, 70, 3))
        self.assertEqual(tuple(out[5, 5]), (200, 40, 40)); self.assertEqual(tuple(out[20, 20]), (128, 128, 128))
        with self.assertRaises(ValueError):
            lama.inpaint(image, Image.new("L", (10, 10)))

    def test_alfa_do_birefnet_volta_no_tamanho_da_foto(self):
        import torch

        class FakeNet(torch.nn.Module):
            def __init__(self):
                super().__init__(); self.w = torch.nn.Parameter(torch.zeros(1))

            def forward(self, x):
                logits = torch.full((1, 1, x.shape[-2], x.shape[-1]), -8.0); logits[..., : x.shape[-2] // 2, :] = 8.0
                return [logits]
        matting = fo.BiRefNetMatting(Path("/nonexistent"), side=64)
        matting.model = FakeNet().eval(); matting.device = "cpu"
        alpha = matting.alpha(Image.new("RGB", (30, 40)))
        self.assertEqual(alpha.shape, (40, 30)); self.assertEqual(alpha.dtype, np.float32)
        self.assertGreater(alpha[5, 15], 0.99); self.assertLess(alpha[35, 15], 0.01)


if __name__ == "__main__":
    unittest.main()
