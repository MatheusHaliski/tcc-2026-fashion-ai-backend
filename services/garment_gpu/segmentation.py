"""Stage 1 — Grounding DINO finds the garment, SAM 2.1 cuts its real pixels. Runs on our GPU; nothing leaves it."""
from __future__ import annotations

import numpy as np
from PIL import Image

from services.garment_gpu.image_ops import check_bbox, clean_mask

PROMPTS = {
    "upper_piece": "t-shirt. football jersey. shirt. polo shirt. sweatshirt. hoodie. jacket. sweater. blouse. dress.",
    "lower_piece": "shorts. trousers. pants. jeans. skirt. leggings.",
    "shoes_piece": "shoe. sneaker. boot. sandal.",
    "accessory_piece": "handbag. backpack. cap. hat. belt. scarf. sunglasses. watch.",
}
PROMPTS["auto"] = "garment. clothing. " + " ".join(p for k, p in PROMPTS.items() if k != "auto")
MIN_MASK_FRACTION = 0.005
MAX_MASK_FRACTION = 0.92


class SegmentationError(ValueError):
    """Photo-level problem (nothing detected, inconsistent mask): retrying will not help; the client must act."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class SegmentEngine:
    def __init__(self, settings):
        import torch
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model, Sam2Processor

        if settings.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("Worker precisa de uma GPU CUDA NVIDIA. Confira nvidia-smi e o NVIDIA Container Toolkit.")
        self.torch = torch
        self.settings = settings
        self.device = torch.device(settings.device)
        self.ground_processor = AutoProcessor.from_pretrained(settings.detector_model)
        self.ground_model = AutoModelForZeroShotObjectDetection.from_pretrained(settings.detector_model).to(self.device).eval()
        self.sam_processor = Sam2Processor.from_pretrained(settings.segmenter_model)
        self.sam_model = Sam2Model.from_pretrained(settings.segmenter_model).to(self.device).eval()
        self.models = {"detector": settings.detector_model, "segmenter": settings.segmenter_model}

    def detect(self, image: Image.Image, category: str):
        inputs = self.ground_processor(images=image, text=PROMPTS[category], return_tensors="pt").to(self.device)
        with self.torch.inference_mode():
            outputs = self.ground_model(**inputs)
        result = self.ground_processor.post_process_grounded_object_detection(
            outputs, input_ids=inputs["input_ids"], threshold=self.settings.box_threshold,
            text_threshold=self.settings.text_threshold, target_sizes=[(image.height, image.width)],
        )[0]
        boxes = result["boxes"].detach().cpu().tolist()
        scores = result["scores"].detach().cpu().tolist()
        labels = [str(label) for label in result.get("text_labels", result.get("labels", [""] * len(boxes)))]
        return pick_box(boxes, scores, labels, image.width, image.height)

    def segment(self, image: Image.Image, box):
        inputs = self.sam_processor(images=image, input_boxes=[[box]], return_tensors="pt").to(self.device)
        with self.torch.inference_mode():
            outputs = self.sam_model(**inputs, multimask_output=False)
        area = image.width * image.height
        masks = self.sam_processor.post_process_masks(
            outputs.pred_masks.cpu(), inputs["original_sizes"],
            max_hole_area=area * 0.001, max_sprinkle_area=area * 0.0005,
        )[0]
        score = float(outputs.iou_scores.flatten()[0].item()) if getattr(outputs, "iou_scores", None) is not None else None
        return np.asarray(masks[0, 0].numpy(), dtype=np.uint8), score

    def run(self, image: Image.Image, category: str, bbox=None):
        return run_segmentation(self, image, category, bbox)


def pick_box(boxes, scores, labels, width: int, height: int):
    """Highest-confidence detection, ignoring boxes that are basically the whole frame when alternatives exist
    (the detector sometimes boxes the entire person for a 'shirt' prompt)."""
    if not boxes:
        raise SegmentationError("NO_GARMENT_DETECTED", "Nenhuma peça detectada; envie bbox manual ou outra foto.")
    order = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    frame = float(width * height)

    def area(b):
        return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1]) / frame

    chosen = next((i for i in order if area(boxes[i]) < 0.95), order[0])
    b = boxes[chosen]
    box = check_bbox([max(0.0, b[0]), max(0.0, b[1]), min(float(width), b[2]), min(float(height), b[3])], width, height)
    return box, {"detection_score": round(float(scores[chosen]), 4), "detection_label": labels[chosen] if labels else "",
                 "detections": len(boxes)}


def run_segmentation(engine, image: Image.Image, category: str, bbox=None):
    """Shared by the real engine and test doubles: detect (unless a manual box came in), segment, clean, validate."""
    if category not in PROMPTS:
        raise SegmentationError("INVALID_CATEGORY", "Categoria inválida")
    image = image.convert("RGB")
    if bbox:
        box, detection = check_bbox(bbox, image.width, image.height), {"detection_label": "manual_bbox"}
    else:
        box, detection = engine.detect(image, category)
    raw_mask, sam_score = engine.segment(image, box)
    mask = clean_mask(raw_mask, box)
    fraction = float(np.mean(mask > 0))
    if fraction < MIN_MASK_FRACTION or fraction > MAX_MASK_FRACTION:
        raise SegmentationError("INCONSISTENT_MASK", "Máscara inconsistente; revise o bbox ou a foto")
    metrics = {"box": [round(v, 2) for v in box], "mask_fraction": round(fraction, 4), **detection}
    if sam_score is not None:
        metrics["mask_score"] = round(sam_score, 4)
    return mask, metrics
