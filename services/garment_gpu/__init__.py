"""FashionAI self-hosted garment pipeline: segmentation (Grounding DINO + SAM 2.1) and generative
reconstruction (Qwen-Image-Edit) on our own NVIDIA GPUs, behind a private FastAPI + Redis/RQ + S3 (RustFS) API.

No third-party image API is called: open weights are downloaded once into a persistent volume and run locally."""
