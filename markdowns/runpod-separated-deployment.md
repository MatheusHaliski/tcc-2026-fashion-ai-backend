# RunPod Deployment: Separated API + GPU Worker

## 1) Runtime split

### A. API / Orchestrator (`blender-api`)
Responsibilities:
- validate submit payloads
- dispatch jobs to GPU worker
- expose normalized status responses
- expose health/diagnostics

Suggested image:
- `stylistai-api:runpod-2026-04-09`

Base image:
- `python:3.11-slim`

### B. GPU Worker (`blender-worker`)
Responsibilities:
- run heavy GPU/PyTorch/Blender pipeline
- emit artifacts + metrics
- return structured errors

Suggested image:
- `docker.io/matheushaliski/stylistai-worker:runpod-2026-04-11-v5`

Base image:
- `runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404`

Why this tag:
- RunPod-maintained CUDA/Torch stack reduces custom CUDA layer drift.
- Avoids devel-heavy custom build path for runtime-only workloads.
- Aligns with RunPod template family used in your current environment.

## 2) Build commands

Run from repo root:

```bash
DOCKER_BUILDKIT=1 docker build -f blender-api/Dockerfile -t stylistai-api:runpod-2026-04-09 .
DOCKER_BUILDKIT=1 docker build -f blender-worker/Dockerfile -t stylistai-worker:runpod-2026-04-11-v5 .
```

## 3) Push commands

```bash
docker tag stylistai-api:runpod-2026-04-09 <registry>/stylistai-api:runpod-2026-04-09
docker tag stylistai-worker:runpod-2026-04-11-v5 <registry>/stylistai-worker:runpod-2026-04-11-v5

docker push <registry>/stylistai-api:runpod-2026-04-09
docker push <registry>/stylistai-worker:runpod-2026-04-11-v5
```

Optional:

```bash
docker tag <registry>/stylistai-api:runpod-2026-04-09 <registry>/stylistai-api:latest
docker tag <registry>/stylistai-worker:runpod-2026-04-11-v5 <registry>/stylistai-worker:latest
docker push <registry>/stylistai-api:latest
docker push <registry>/stylistai-worker:latest
```

## 4) RunPod pod setup

## GPU worker pod
- Container image: `docker.io/matheushaliski/stylistai-worker:runpod-2026-04-11-v5`
- Container port: `8000`
- Start command: use image default (`/usr/local/bin/runpod-worker-bootstrap.sh`)

Recommended env vars:

```bash
PORT=8000
BLENDER_WORKER_TOKEN=<strong-random-token>
WORKER_OUTPUT_DIR=/tmp/stylistai-3d-output
OUTPUT_PUBLIC_BASE_URL=
WORKER_MAX_THREADS=4
LOG_LEVEL=INFO
CORS_ALLOWED_ORIGINS=https://sai-tcc-2026.vercel.app,http://localhost:3000
```

No-heavy-rebuild mode (recommended):

```bash
WORKER_CODE_SYNC_DIR=/runpod-volume/stylistai-worker
# optional git mode
WORKER_CODE_SYNC_GIT=https://github.com/<org>/<repo>.git
WORKER_CODE_SYNC_REF=main
```

### API pod
- Container image: `<registry>/stylistai-api:runpod-2026-04-09`
- Container port: `8000`
- Start command: use image default (`uvicorn app:app`)

Recommended env vars:

```bash
PORT=8000
GPU_WORKER_URL=http://<worker-private-host>:8000
GPU_WORKER_TOKEN=<same-as-BLENDER_WORKER_TOKEN>
API_ORCHESTRATOR_TOKEN=<optional-api-token>
API_REQUEST_TIMEOUT_MS=30000
```

Public endpoint example:

```bash
GPU_WORKER_URL=https://your-worker-endpoint.runpod.net
GPU_WORKER_TOKEN=your-token-if-needed
API_REQUEST_TIMEOUT_MS=30000
```

## 5) Volume strategy (recommended for fast iteration)

1. Keep worker image base stable.
2. Mount RunPod network volume at `/runpod-volume`.
3. Place updated worker code at `/runpod-volume/stylistai-worker`.
4. Set `WORKER_CODE_SYNC_DIR=/runpod-volume/stylistai-worker`.
5. Restart pod; bootstrap script copies only code into `/app`.

Result: no new CUDA/PyTorch image build for regular Python changes.

## 6) Health and contract checks

```bash
curl -s http://<api-host>:8000/health
curl -s http://<api-host>:8000/diagnostics
curl -s http://<worker-host>:8000/health
curl -s http://<worker-host>:8000/diagnostics
```

Submit + status flow:

```bash
curl -s -X POST http://<api-host>:8000/submit \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://example.com/input.png","jobType":"blender_uv_pipeline","options":{"generation_mode":"fast_uv"}}'

curl -s http://<api-host>:8000/status/<jobId>
```

## 7) Safety and rollout

- Deploy new immutable tags side-by-side.
- Shift traffic only after `/health` + `/diagnostics` succeed.
- Keep previous worker image tag for rollback.
- Do not deploy `latest` as the primary production reference.
