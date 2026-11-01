"""Test doubles shared by the suite: a synthetic person photo and deterministic stand-ins for the neural networks."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

from services.garment_gpu.segmentation import run_segmentation

ORANGE = (240, 110, 20)
KEYS = {"backend": "b" * 64, "reviewer": "r" * 64, "reader": "e" * 64, "ops": "o" * 64}


def person_photo(size=(240, 360)) -> Image.Image:
    """Grey studio, an orange 'jersey' rectangle with black sleeve trims and a skin-tone 'arm' next to it."""
    img = Image.new("RGB", size, (128, 128, 128))
    px = np.asarray(img).copy()
    px[60:240, 50:190] = ORANGE
    px[60:80, 50:190] = (15, 15, 15)
    px[100:300, 195:215] = (224, 172, 140)
    return Image.fromarray(px)


def png(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()


class FakeSegmentEngine:
    models = {"detector": "fake-dino", "segmenter": "fake-sam"}

    def __init__(self, settings=None):
        from services.garment_gpu import config

        self.calls = []
        self.settings = settings or config.load({})

    def detect(self, image, category):
        self.calls.append(("detect", category))
        return [50.0, 60.0, 190.0, 240.0], {"detection_score": 0.9, "detection_label": "jersey", "detections": 1}

    def segment(self, image, box):
        self.calls.append(("segment", tuple(box)))
        px = np.asarray(image.convert("RGB")).astype(int)
        orange = (abs(px - np.array(ORANGE)).sum(-1) < 30) | (px.max(-1) < 40)
        mask = np.zeros(px.shape[:2], np.uint8)
        x1, y1, x2, y2 = (int(v) for v in box)
        mask[y1:y2, x1:x2] = orange[y1:y2, x1:x2]
        return mask, 0.97, 1.0

    def run(self, image, category, bbox=None):
        return run_segmentation(self, image, category, bbox)


class FakePipeline:
    """Stands in for QwenImageEditPlusPipeline: returns the garment, front-facing, on white."""

    def __init__(self, color=ORANGE):
        self.color = color
        self.calls = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        w, h = kwargs["width"], kwargs["height"]
        img = Image.new("RGB", (w, h), (255, 255, 255))
        px = np.asarray(img).copy()
        px[int(h * 0.2):int(h * 0.8), int(w * 0.2):int(w * 0.8)] = self.color
        px[int(h * 0.2):int(h * 0.27), int(w * 0.2):int(w * 0.8)] = (15, 15, 15)

        class Result:
            images = [Image.fromarray(px)]
        return Result()


def drain(settings, redis):
    """Runs every queued stage like the GPU workers would (segment first, then reconstruct)."""
    from rq import Queue, SimpleWorker

    for name in (settings.segment_queue, settings.reconstruct_queue, settings.segment_queue):
        SimpleWorker([Queue(name, connection=redis)], connection=redis).work(burst=True)
