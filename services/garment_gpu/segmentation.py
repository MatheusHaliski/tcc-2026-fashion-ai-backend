"""Stage 1 — Grounding DINO finds the garment, SAM 2.1 cuts its real pixels. Runs on our GPU; nothing leaves it."""
from __future__ import annotations

import os

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


class SegmentationError(ValueError):
    """Photo-level problem (nothing detected, inconsistent mask): retrying will not help; the client must act."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class SegmentEngine:
    def __init__(self, settings):
        if settings.device == "mps":   # Apple GPU: operators MPS lacks fall back to the CPU instead of failing
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        import torch
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model, Sam2Processor

        if settings.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("Worker precisa de uma GPU CUDA NVIDIA. Confira nvidia-smi e o NVIDIA Container Toolkit.")
        if settings.device == "mps" and not torch.backends.mps.is_available():
            raise RuntimeError("FAI_DEVICE=mps exige um Mac com Apple Silicon e PyTorch com suporte a MPS.")
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
        """SAM proposes three masks for the box; we keep the one that actually belongs to it.

        With a single mask SAM often returns the most contrasting object inside the box instead of the garment —
        bare legs under a pair of shorts, or the model's hair when the garment blends into the background."""
        inputs = self.sam_processor(images=image, input_boxes=[[box]], return_tensors="pt").to(self.device)
        with self.torch.inference_mode():
            outputs = self.sam_model(**inputs, multimask_output=True)
        area = image.width * image.height
        masks = self.sam_processor.post_process_masks(
            outputs.pred_masks.cpu(), inputs["original_sizes"],
            max_hole_area=area * 0.001, max_sprinkle_area=area * 0.0005,
        )[0]
        scores = (outputs.iou_scores.detach().cpu().numpy().reshape(-1)
                  if getattr(outputs, "iou_scores", None) is not None else None)
        return pick_mask([np.asarray(masks[0, i].numpy(), dtype=np.uint8) for i in range(masks.shape[1])], scores, box)

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


def inside_box(mask: np.ndarray, box) -> float:
    """Share of the mask lying inside the detector's box. A garment fills its own box; legs below a pair of shorts,
    or hair above a shirt, fall almost entirely outside it."""
    total = float(np.count_nonzero(mask))
    if not total:
        return 0.0
    x1, y1, x2, y2 = (int(round(v)) for v in box)
    return float(np.count_nonzero(mask[max(0, y1):y2, max(0, x1):x2])) / total


def pick_mask(candidates, scores, box):
    """Best candidate: the one that stays inside the box, with SAM's own confidence as the tie-break."""
    if not candidates:
        raise SegmentationError("NO_MASK", "SAM não devolveu máscara")
    fits = [inside_box(mask, box) for mask in candidates]
    confidence = [float(scores[i]) if scores is not None and i < len(scores) else 0.0 for i in range(len(candidates))]
    best = max(range(len(candidates)), key=lambda i: (round(fits[i], 2), confidence[i]))
    return candidates[best], (confidence[best] or None), fits[best]


def run_segmentation(engine, image: Image.Image, category: str, bbox=None):
    """Shared by the real engine and test doubles: detect (unless a manual box came in), segment, clean, validate."""
    if category not in PROMPTS:
        raise SegmentationError("INVALID_CATEGORY", "Categoria inválida")
    image = image.convert("RGB")
    if bbox:
        box, detection = check_bbox(bbox, image.width, image.height), {"detection_label": "manual_bbox"}
    else:
        box, detection = engine.detect(image, category)
    raw_mask, sam_score, box_fit = engine.segment(image, box)
    if box_fit < engine.settings.mask_min_inside_box:
        raise SegmentationError("MASK_OUTSIDE_DETECTION",
                                f"A máscara ficou {1 - box_fit:.0%} fora da caixa detectada: provavelmente pele, "
                                "cabelo ou fundo, e não a peça")
    from services.garment_gpu.analysis import skin

    # Skin is never added by hole filling (a hand on the fabric stays a hole for Phase 2). The holes used to be
    # looked up on an already-filled mask, so none were ever found and the hand was pasted into the cut-out.
    mask = clean_mask(raw_mask, box, keep_open=skin(np.asarray(image)))
    fraction = float(np.mean(mask > 0))
    if not engine.settings.mask_min_fraction <= fraction <= engine.settings.mask_max_fraction:
        raise SegmentationError("INCONSISTENT_MASK",
                                f"Máscara inconsistente: {fraction:.1%} do quadro (aceito "
                                f"{engine.settings.mask_min_fraction:.1%}–{engine.settings.mask_max_fraction:.0%})")
    metrics = {"box": [round(v, 2) for v in box], "mask_fraction": round(fraction, 4),
               "mask_inside_box": round(box_fit, 4), **detection}
    if sam_score is not None:
        metrics["mask_score"] = round(sam_score, 4)
    return mask, metrics
