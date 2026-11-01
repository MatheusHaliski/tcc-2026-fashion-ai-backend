"""Environment configuration. Read once into an immutable Settings object so tests can build their own."""
from __future__ import annotations

import os
from dataclasses import dataclass

CATEGORIES = ("upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "auto")
BACKGROUNDS = ("white", "transparent")
FRAMINGS = ("catalog", "cutout")
MODES = ("segment", "reconstruct")


def _int(env, name: str, default: int, low: int, high: int) -> int:
    value = int(env.get(name, str(default)))
    if not low <= value <= high:
        raise ValueError(f"{name} deve estar entre {low} e {high}")
    return value


def _float(env, name: str, default: float, low: float, high: float) -> float:
    value = float(env.get(name, str(default)))
    if not low <= value <= high:
        raise ValueError(f"{name} deve estar entre {low} e {high}")
    return value


def _bool(env, name: str, default: bool) -> bool:
    return env.get(name, "true" if default else "false").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "fai-garment-assets"
    s3_region: str = "us-east-1"
    retention_days: int = 30
    api_key: str = ""
    api_keys: str = ""
    max_upload_mb: int = 12
    max_pixels: int = 16_000_000
    rate_limit_per_minute: int = 30
    max_active_jobs_per_client: int = 20
    job_ttl_seconds: int = 7 * 86400
    segment_queue: str = "fai-segment"
    reconstruct_queue: str = "fai-reconstruct"
    segment_timeout_seconds: int = 600
    reconstruct_timeout_seconds: int = 1800
    device: str = "cuda"
    detector_model: str = "IDEA-Research/grounding-dino-tiny"
    segmenter_model: str = "facebook/sam2.1-hiera-tiny"
    mask_min_inside_box: float = 0.75
    mask_min_fraction: float = 0.005
    mask_max_fraction: float = 0.92
    box_threshold: float = 0.30
    text_threshold: float = 0.25
    recon_model: str = "Qwen/Qwen-Image-Edit-2511"
    recon_steps: int = 40
    recon_true_cfg: float = 4.0
    recon_offload: str = "none"
    recon_lora_path: str = ""
    recon_lora_scale: float = 1.0
    recon_lora_weight_name: str = ""
    recon_back_view: bool = True
    recon_quantize: str = "none"
    recon_max_side: int = 1024
    recon_max_attempts: int = 2
    qa_min_score: float = 0.62
    qa_max_delta_e: float = 10.0
    worker_metrics_port: int = 9101
    worker_max_idle_seconds: int = 0
    worker_name: str = ""
    metrics_public: bool = True

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


def load(env=None) -> Settings:
    env = os.environ if env is None else env
    offload = env.get("RECON_OFFLOAD", "none").strip().lower()
    if offload not in {"none", "model", "sequential"}:
        raise ValueError("RECON_OFFLOAD deve ser none, model ou sequential")
    device = env.get("FAI_DEVICE", "cuda").strip().lower()
    if device not in {"cuda", "cpu", "mps"}:
        raise ValueError("FAI_DEVICE deve ser cuda, cpu ou mps (GPU do Mac, só Fase 1)")
    quantize = env.get("RECON_QUANTIZE", "none").strip().lower()
    if quantize not in {"none", "nf4"} or (quantize == "nf4" and device != "cuda"):
        raise ValueError("RECON_QUANTIZE deve ser none ou nf4 (nf4 exige FAI_DEVICE=cuda)")
    if device != "cuda" and offload != "none":
        raise ValueError("RECON_OFFLOAD (CPU offload) só existe com FAI_DEVICE=cuda")
    if quantize == "nf4" and offload == "sequential":
        raise ValueError("RECON_QUANTIZE=nf4 aceita RECON_OFFLOAD=none ou model (sequential não funciona com 4 bits)")
    return Settings(
        redis_url=env.get("REDIS_URL", Settings.redis_url),
        s3_endpoint=env.get("S3_ENDPOINT", Settings.s3_endpoint),
        s3_access_key=env.get("S3_ACCESS_KEY", ""),
        s3_secret_key=env.get("S3_SECRET_KEY", ""),
        s3_bucket=env.get("S3_BUCKET", Settings.s3_bucket),
        s3_region=env.get("S3_REGION", Settings.s3_region),
        retention_days=_int(env, "RETENTION_DAYS", 30, 0, 3650),
        api_key=env.get("FAI_API_KEY", "").strip(),
        api_keys=env.get("FAI_API_KEYS", "").strip(),
        max_upload_mb=_int(env, "MAX_UPLOAD_MB", 12, 1, 64),
        max_pixels=_int(env, "MAX_PIXELS", 16_000_000, 250_000, 60_000_000),
        rate_limit_per_minute=_int(env, "RATE_LIMIT_PER_MINUTE", 30, 0, 100_000),
        max_active_jobs_per_client=_int(env, "MAX_ACTIVE_JOBS_PER_CLIENT", 20, 0, 100_000),
        job_ttl_seconds=_int(env, "JOB_TTL_SECONDS", 7 * 86400, 3600, 365 * 86400),
        segment_queue=env.get("SEGMENT_QUEUE", Settings.segment_queue),
        reconstruct_queue=env.get("RECONSTRUCT_QUEUE", Settings.reconstruct_queue),
        segment_timeout_seconds=_int(env, "SEGMENT_TIMEOUT_SECONDS", 600, 30, 7200),
        reconstruct_timeout_seconds=_int(env, "RECONSTRUCT_TIMEOUT_SECONDS", 1800, 60, 14400),
        device=device,
        detector_model=env.get("DETECTOR_MODEL", Settings.detector_model),
        segmenter_model=env.get("SEGMENTER_MODEL", Settings.segmenter_model),
        mask_min_inside_box=_float(env, "MASK_MIN_INSIDE_BOX", 0.75, 0.0, 1.0),
        mask_min_fraction=_float(env, "MASK_MIN_FRACTION", 0.005, 0.0001, 0.5),
        mask_max_fraction=_float(env, "MASK_MAX_FRACTION", 0.92, 0.5, 1.0),
        box_threshold=_float(env, "BOX_THRESHOLD", 0.30, 0.05, 0.95),
        text_threshold=_float(env, "TEXT_THRESHOLD", 0.25, 0.05, 0.95),
        recon_model=env.get("RECON_MODEL", Settings.recon_model),
        recon_steps=_int(env, "RECON_STEPS", 40, 4, 150),
        recon_true_cfg=_float(env, "RECON_TRUE_CFG", 4.0, 1.0, 15.0),
        recon_offload=offload,
        recon_lora_path=env.get("RECON_LORA_PATH", "").strip(),
        recon_lora_scale=_float(env, "RECON_LORA_SCALE", 1.0, 0.0, 2.0),
        recon_lora_weight_name=env.get("RECON_LORA_WEIGHT_NAME", "").strip(),
        recon_back_view=_bool(env, "RECON_BACK_VIEW", True),
        recon_quantize=quantize,
        recon_max_side=_int(env, "RECON_MAX_SIDE", 1024, 384, 2048),
        recon_max_attempts=_int(env, "RECON_MAX_ATTEMPTS", 2, 1, 5),
        qa_min_score=_float(env, "QA_MIN_SCORE", 0.62, 0.0, 1.0),
        qa_max_delta_e=_float(env, "QA_MAX_DELTA_E", 10.0, 1.0, 100.0),
        worker_metrics_port=_int(env, "WORKER_METRICS_PORT", 9101, 0, 65535),
        worker_max_idle_seconds=_int(env, "WORKER_MAX_IDLE_SECONDS", 0, 0, 86400),
        worker_name=env.get("WORKER_NAME", "").strip(),
        metrics_public=_bool(env, "METRICS_PUBLIC", True),
    )
