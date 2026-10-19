import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.catalog.whole_frame import FULL, LOWER, UPPER, GarmentSegmenter, cloth_class, render_whole  # noqa: E402
from scripts.catalog import process_whole_frames as batch  # noqa: E402


def model_photo():
    """Foto larga de estúdio com uma 'pessoa' (pele) e a calça (azul) pequena no meio — o caso G-Star."""
    im = Image.new("RGB", (1600, 900), (190, 190, 190))
    d = ImageDraw.Draw(im)
    d.rectangle((740, 80, 860, 300), fill=(224, 172, 140))   # tronco/rosto (pele)
    d.rectangle((730, 300, 870, 860), fill=(30, 60, 140))    # calça
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rectangle((730, 300, 870, 860), fill=255)
    return im, mask


class ClothClassTest(unittest.TestCase):
    def test_category_to_segmenter_class(self):
        self.assertEqual(cloth_class("upper_piece", "t_shirt"), UPPER)
        self.assertEqual(cloth_class("lower_piece", "jeans"), LOWER)
        self.assertEqual(cloth_class("lower_piece", "dress"), FULL)
        self.assertEqual(cloth_class("full_body_piece", None), FULL)
        self.assertIsNone(cloth_class("shoes_piece", "sneaker"))
        self.assertIsNone(cloth_class(None))


class RenderWholeTest(unittest.TestCase):
    def test_piece_only_centered_without_person_and_large(self):
        im, mask = model_photo()
        result = render_whole(im, mask)
        with Image.open(io.BytesIO(result.data)) as out:
            self.assertEqual(out.size, (900, 1200))
            # a calça ocupa o quadro (era ~9% da largura e 62% da altura da foto original)
            self.assertAlmostEqual(result.info["box"]["h"], 0.74, places=2)
            self.assertGreater(result.info["box"]["w"], 0.1)
            center = out.getpixel((450, 600))
            self.assertLess(center[0], 80)          # azul da calça no centro
            self.assertGreater(center[2], 100)
            # sem pele da pessoa em lugar nenhum: o topo do quadro é fundo claro
            top = out.getpixel((450, 60))
            self.assertGreater(min(top), 235)
        self.assertTrue(result.info["upscaled"])
        self.assertEqual(result.info["background"], "#F4F5F7")

    def test_truncated_bottom_touches_frame_edge(self):
        im, mask = model_photo()
        result = render_whole(im, mask, truncated=["bottom", "nonsense"])
        box = result.info["box"]
        self.assertAlmostEqual(box["y"] + box["h"], 1.0, places=2)
        self.assertGreater(box["y"], 0.1)   # o topo mantém a margem: só o lado cortado encosta
        self.assertEqual(result.info["truncated"], ["bottom"])

    def test_empty_or_tiny_mask_is_refused(self):
        im, _ = model_photo()
        with self.assertRaisesRegex(ValueError, "WHOLE_EMPTY_MASK"):
            render_whole(im, Image.new("L", im.size, 0))
        tiny = Image.new("L", im.size, 0)
        ImageDraw.Draw(tiny).rectangle((10, 10, 20, 20), fill=255)
        with self.assertRaisesRegex(ValueError, "WHOLE_MASK_TOO_SMALL"):
            render_whole(im, tiny)


class SegmenterTest(unittest.TestCase):
    def test_backend_gets_cloth_class_and_model_flag(self):
        calls = []
        seg = GarmentSegmenter(backend=lambda image, klass, model: calls.append((klass, model)) or Image.new("L", image.size, 255))
        seg.mask(Image.new("RGB", (10, 10)), category="lower_piece", subcategory="jeans", model=True)
        self.assertEqual(calls, [(LOWER, True)])


class Downloader:
    def __init__(self, path):
        self.path = path

    def get(self, url):
        return self.path


class Storage:
    def __init__(self):
        self.data = None

    def put(self, data):
        self.data = data
        return "https://media.example.com/catalog/whole/x/y.jpg"


class BatchTest(unittest.TestCase):
    def test_process_uses_tecido_analysis_and_builds_guarded_patch(self):
        im, mask = model_photo()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "src.jpg"
            im.save(path, "JPEG")
            import hashlib
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            seen = {}
            seg = GarmentSegmenter(backend=lambda image, klass, model: seen.update(klass=klass, model=model) or mask)
            record = {"id": "img1", "product_id": "p1", "image_url": "https://brand.example/jeans.jpg", "source_sha256": sha,
                      "category": "lower_piece", "subcategory": "jeans",
                      "metrics_json": json.dumps({"debug": {"productFrame": {"model": True}, "truncated": []}})}
            storage = Storage()
            row = batch.process(record, Downloader(path), seg, out_dir=Path(tmp) / "out", storage=storage)
            self.assertEqual(seen, {"klass": LOWER, "model": True})
            self.assertEqual(row["status"], "STORED")
            self.assertTrue((Path(tmp) / "out" / "img1.jpg").exists())
            patch = row["patch"]
            self.assertEqual((patch["status"], patch["version"], patch["sha"]), ("DONE", "WHOLE_FRAME_V2", sha))
            info = json.loads(patch["json"])
            self.assertTrue(info["model"])
            self.assertIn("box", info)
            self.assertIsNotNone(storage.data)

    def test_source_changed_since_analysis_is_skipped(self):
        im, mask = model_photo()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "src.jpg"
            im.save(path, "JPEG")
            record = {"id": "img1", "image_url": "https://brand.example/a.jpg", "source_sha256": "0" * 64, "category": "lower_piece"}
            row = batch.process(record, Downloader(path), GarmentSegmenter(backend=lambda *a, **k: mask))
            self.assertEqual(row["reason"], "SOURCE_CHANGED_SINCE_ANALYSIS")


if __name__ == "__main__":
    unittest.main()
