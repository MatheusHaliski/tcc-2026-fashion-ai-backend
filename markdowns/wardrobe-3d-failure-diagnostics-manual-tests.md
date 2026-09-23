# Wardrobe 3D failure diagnostics manual test log

Date: 2026-04-27

## Scenarios covered

1. `preparationStatus=pending` should stop before RunPod and return `failedStage=preparation_not_ready` with `model_status=needs_preparation` and `nextAction=POST /api/wardrobe/process-piece`.
2. Missing `garmentAnchors` / preconditions should produce `failedStage=branding_precondition_failed` and skip strict branding QA.
3. RunPod `POST /jobs` 404 should produce `failedStage=runpod_route_mismatch` and a route hint.
4. Missing `GPU_WORKER_URL` should return `failedStage=env_validation`.
5. Missing token-only config should return `failedStage=auth_config_missing`.
6. Branding quality failure now includes score breakdown in diagnostics.
7. Successful submit path in `/api/3d-worker/submit` still returns `ok=true`, `status`, and `jobId` for processing flows.

## Notes

- Diagnostics payload intentionally excludes secret tokens and logs only boolean presence of secrets.
- `pipeline_stage_details.history[]` preserves prior stage details during retries/failure updates.
