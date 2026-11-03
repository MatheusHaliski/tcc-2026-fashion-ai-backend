"""Peça inteira local com Stable Diffusion: as partes puras (máscara fantasma, composição, og:image, SQL, lote) sem GPU,
sem rede e sem modelo — o renderizador é um dublê que pinta a região pedida."""
import io
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from photo_set import PhotoMasks  # noqa: E402
import process_local_sd as sd  # noqa: E402
from scripts.catalog.tests.local_sd_fixture import masks, shirt_photo  # noqa: E402


class GhostMaskTest(unittest.TestCase):
    def test_fantasma_so_onde_o_corpo_aparece_por_dentro_da_peca(self):
        im, target, forbidden = shirt_photo()
        t, f = np.asarray(target) >= 128, np.asarray(forbidden) >= 128
        ghost = sd.ghost_mask(t, f, feather=0)
        self.assertTrue(ghost[215, 300])              # pescoço entre os ombros, dentro da gola aberta
        self.assertFalse(ghost[185, 300])             # acima da linha dos ombros (rosto) não entra
        self.assertFalse(ghost[400, 300])             # tecido nunca entra
        self.assertFalse(ghost[420, 100])             # braço ao lado do tronco, abaixo da manga: vira fundo
        self.assertFalse(ghost[60, 300])              # risco fora do perímetro não vira fantasma
        self.assertFalse(sd.ghost_mask(np.zeros((10, 10), bool), None).any())

    def test_sem_mascara_de_corpo_so_os_buracos_fechados(self):
        target = Image.new("L", (400, 400), 0)
        d = ImageDraw.Draw(target); d.rectangle((100, 100, 300, 360), fill=255); d.ellipse((170, 130, 230, 180), fill=0)   # gola fechada
        ghost = sd.ghost_mask(np.asarray(target) >= 128, None, feather=0)
        self.assertTrue(ghost[155, 200]); self.assertFalse(ghost[250, 200]); self.assertFalse(ghost[50, 200])
        # gola aberta para o fundo (fixture da camiseta) sem máscara de corpo: nada a preencher
        _, open_neck, _ = shirt_photo()
        self.assertFalse(sd.ghost_mask(np.asarray(open_neck) >= 128, None, feather=0).any())


class ForegroundBodyTest(unittest.TestCase):
    def test_corpo_e_o_primeiro_plano_menos_a_peca_com_folga(self):
        target = np.zeros((100, 100), bool); target[30:80, 30:70] = True            # peça
        fg = target.copy(); fg[10:30, 40:60] = True; fg[30:80, 20:30] = True        # pescoço acima e braço ao lado
        body = sd.body_from_foreground(target, fg, margin=2)
        self.assertTrue(body[15, 50]); self.assertTrue(body[50, 22])
        self.assertFalse(body[50, 50]); self.assertFalse(body[29, 50]); self.assertFalse(body[50, 29])   # peça e folga

    def test_masks_for_deduz_o_corpo_quando_o_provedor_nao_traz(self):
        im = Image.new("RGB", (100, 100))
        target = Image.new("L", im.size, 0); ImageDraw.Draw(target).rectangle((30, 30, 69, 79), fill=255)
        fg = Image.new("L", im.size, 0); ImageDraw.Draw(fg).rectangle((20, 10, 69, 79), fill=255)
        provider = type("P", (), {"masks": lambda self, image, c, s=None: PhotoMasks(target, None, verified=True, target_category=c, target_subcategory=s, source="u2net")})()
        segmenter = type("S", (), {"mask": lambda self, image, **k: fg})()
        masks = sd.masks_for(im, "upper_piece", "t_shirt", provider, segmenter)
        self.assertIsNotNone(masks.forbidden); self.assertTrue(masks.human_present); self.assertIn("isnet-foreground", masks.source)
        self.assertEqual(np.asarray(masks.forbidden)[15, 50], 255); self.assertEqual(np.asarray(masks.forbidden)[50, 50], 0)
        self.assertIsNone(sd.masks_for(im, "upper_piece", "t_shirt", provider, segmenter, foreground_body=False).forbidden)
        shoes = sd.masks_for(im, "shoes_piece", "sneaker", provider, segmenter)
        self.assertIsNone(shoes.forbidden); self.assertEqual(shoes.source, "isnet-general-use")


class MeasureAndComposeTest(unittest.TestCase):
    def test_mede_limpa_e_compoe_com_o_tecido_original_e_a_ia_so_no_fantasma(self):
        im, target, forbidden = shirt_photo()
        t, f, metrics = sd.measure(im, masks(target, forbidden), "upper_piece", "t_shirt", im.size)
        self.assertFalse(t[60, 300])                                     # o risco saiu na limpeza
        self.assertAlmostEqual(metrics["sourceGarmentHeightFraction"], 500 / 800, places=2)
        ghost = sd.ghost_mask(t, f)
        generated = Image.new("RGB", im.size, (255, 0, 0))               # dublê da IA: pinta tudo de vermelho
        shot = sd.compose_packshot(im, t, generated, ghost)
        with Image.open(io.BytesIO(shot.data)) as out:
            self.assertEqual(out.size, (900, 1200))
            box = shot.info["box"]
            self.assertAlmostEqual(max(box["w"], box["h"]), 0.5, places=2)
            cx, cy = 450, 600
            self.assertLess(out.getpixel((cx, cy))[0], 80)               # azul original no centro: a IA não redesenhou o tecido
            # a gola (fantasma) ficou com o resultado da IA (vermelho) e não com a pele
            # a peça recortada vai de x 60..540 e y 200..700 na foto; o pescoço (300, 230) cai no meio, perto do topo
            gx = int((box["x"] + box["w"] * ((300 - 60) / 480)) * 900); gy = int((box["y"] + box["h"] * ((230 - 200) / 500)) * 1200)
            self.assertGreater(out.getpixel((gx, gy))[0], 200); self.assertLess(out.getpixel((gx, gy))[1], 80)
            self.assertEqual(out.getpixel((20, 20)), (255, 255, 255))   # fundo branco
        self.assertTrue(shot.info["ai"]); self.assertGreater(shot.info["ghostPixels"], 0)

    def test_sem_ia_e_so_o_recorte_centralizado(self):
        im, target, forbidden = shirt_photo()
        t, f, _ = sd.measure(im, masks(target, forbidden), "upper_piece", "t_shirt", im.size)
        shot = sd.compose_packshot(im, t, None, sd.ghost_mask(t, f), shadow=False)
        with Image.open(io.BytesIO(shot.data)) as out:
            self.assertEqual(out.getpixel((450, 600))[2] > 100, True)
        self.assertFalse(shot.info["ai"]); self.assertEqual(shot.info["ghostPixels"], 0)

    def test_peca_baixa_demais_e_inelegivel_sem_gerar(self):
        im = Image.new("RGB", (600, 800), "white")
        target = Image.new("L", im.size, 0); ImageDraw.Draw(target).rectangle((200, 300, 400, 450), fill=255)   # 150/800 = 19%
        with self.assertRaises(sd.PhotoSkip) as ctx:
            sd.measure(im, masks(target, Image.new("L", im.size, 0)), "upper_piece", "t_shirt", im.size)
        self.assertEqual(ctx.exception.status, "INELIGIBLE")
        self.assertEqual(str(ctx.exception), "SOURCE_GARMENT_BELOW_MIN_HEIGHT")
        self.assertAlmostEqual(ctx.exception.metrics["sourceGarmentHeightFraction"], 151 / 800, places=3)

    def test_entradas_da_ia_recortam_a_peca_em_multiplos_de_8(self):
        im, target, forbidden = shirt_photo()
        t = np.asarray(target) >= 128; f = np.asarray(forbidden) >= 128
        init, mask, box = sd.sd_inputs(im, t, sd.ghost_mask(t, f), 512)
        self.assertEqual(init.size, mask.size)
        self.assertEqual(init.width % 8, 0); self.assertEqual(init.height % 8, 0); self.assertLessEqual(max(init.size), 512)
        self.assertLess(box[0], 60); self.assertGreater(box[2], 540)
        self.assertGreater(np.asarray(mask).max(), 0)


class LenientCleanupTest(unittest.TestCase):
    def test_contorno_fino_nao_classificado_cai_na_limpeza_tolerante(self):
        im = Image.new("RGB", (400, 600), "white")
        target = Image.new("L", im.size, 0); d = ImageDraw.Draw(target)
        d.rectangle((120, 100, 180, 500), fill=255); d.rectangle((220, 100, 280, 500), fill=255)   # duas pernas
        d.line((180, 300, 395, 300), fill=255, width=1)                                             # fio NÃO classificado (4-conexo, preso à perna)
        empty = Image.new("L", im.size, 0)
        with self.assertRaises(sd.PhotoSkip) as strict:
            sd.measure(im, masks(target, empty, "lower_piece", "jeans"), "lower_piece", "jeans", im.size, lenient=False)
        self.assertEqual(str(strict.exception), "UNCLASSIFIED_THIN_CONTOUR")
        t, _, metrics = sd.measure(im, masks(target, empty, "lower_piece", "jeans"), "lower_piece", "jeans", im.size)
        self.assertEqual(metrics["cleanup"]["cleanupMode"], "LENIENT_OPENING"); self.assertEqual(metrics["cleanup"]["strictReason"], "UNCLASSIFIED_THIN_CONTOUR")
        self.assertEqual(metrics["cleanup"]["retainedParts"], 2); self.assertFalse(t[300, 380]); self.assertTrue(t[300, 150]); self.assertTrue(t[300, 250])
        clean = Image.new("L", im.size, 0); ImageDraw.Draw(clean).rectangle((120, 100, 280, 500), fill=255)
        self.assertEqual(sd.measure(im, masks(clean, empty, "upper_piece", "t_shirt"), "upper_piece", "t_shirt", im.size)[2]["cleanup"]["cleanupMode"], "STRICT")


class InpaintInputsTest(unittest.TestCase):
    def test_extra_mask_entra_na_mascara_sem_alargar_o_recorte(self):
        im, target, forbidden = shirt_photo()
        t = np.asarray(target.convert("L")) >= 128
        f = np.asarray(forbidden.convert("L")) >= 128
        ghost = sd.ghost_mask(t, f)
        init, mask, box = sd.sd_inputs(im, t, ghost, 4000)
        init2, mask2, box2 = sd.sd_inputs(im, t, ghost, 4000, extra_mask=f)
        self.assertEqual(box, box2); self.assertEqual(init.size, init2.size)
        sx, sy = mask2.width / (box[2] - box[0]), mask2.height / (box[3] - box[1])
        arm = (int((80 - box[0]) * sx), int((420 - box[1]) * sy))          # braço esquerdo (pele) abaixo da manga
        self.assertEqual(mask.getpixel(arm), 0, "sem extra_mask o braço fora da região fantasma não é preenchido")
        self.assertEqual(mask2.getpixel(arm), 255, "com extra_mask o braço some do contexto do preenchimento")
        self.assertGreater(np.asarray(mask2).mean(), np.asarray(mask).mean())


if __name__ == "__main__":
    unittest.main()
