"""Model registry: which open weights each stage runs, their license and source. Every job records the exact model
ids it used, so a stored image can always be traced back to the weights (and license) that produced it."""
from __future__ import annotations

KNOWN = {
    "IDEA-Research/grounding-dino-tiny": {"role": "detection", "license": "Apache-2.0",
                                          "source": "https://huggingface.co/IDEA-Research/grounding-dino-tiny"},
    "IDEA-Research/grounding-dino-base": {"role": "detection", "license": "Apache-2.0",
                                          "source": "https://huggingface.co/IDEA-Research/grounding-dino-base"},
    "facebook/sam2.1-hiera-tiny": {"role": "segmentation", "license": "Apache-2.0",
                                   "source": "https://huggingface.co/facebook/sam2.1-hiera-tiny"},
    "facebook/sam2.1-hiera-small": {"role": "segmentation", "license": "Apache-2.0",
                                    "source": "https://huggingface.co/facebook/sam2.1-hiera-small"},
    "facebook/sam2.1-hiera-large": {"role": "segmentation", "license": "Apache-2.0",
                                    "source": "https://huggingface.co/facebook/sam2.1-hiera-large"},
    "Qwen/Qwen-Image-Edit-2511": {"role": "reconstruction", "license": "Apache-2.0",
                                  "source": "https://huggingface.co/Qwen/Qwen-Image-Edit-2511"},
    "Qwen/Qwen-Image-Edit-2509": {"role": "reconstruction", "license": "Apache-2.0",
                                  "source": "https://huggingface.co/Qwen/Qwen-Image-Edit-2509"},
}


def describe(model_id: str, role: str) -> dict:
    info = KNOWN.get(model_id, {"role": role, "license": "VERIFICAR", "source": f"https://huggingface.co/{model_id}"})
    return {"id": model_id, **info}


def configured(settings) -> list[dict]:
    return [
        describe(settings.detector_model, "detection"),
        describe(settings.segmenter_model, "segmentation"),
        describe(settings.recon_model, "reconstruction"),
    ]
