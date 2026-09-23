# HTTP Errors Guide — SAI-TCC-2026

This document maps every common HTTP error code to its root cause, the project files that raise it, and the recommended fix.

---

## Quick Reference Table

| Code | Name | Root Cause | Triggering Files | Fix |
|------|------|-----------|-----------------|-----|
| [400](#400-bad-request) | Bad Request | Missing or invalid request fields | Multiple service & route files | Validate required fields before calling the API |
| [401](#401-unauthorized) | Unauthorized | Missing or invalid auth token/session | `blender-worker/handler.py`, `blender-worker/app.py`, `app/api/auth/session/route.ts` | Pass a valid Bearer token; refresh the user session |
| [403](#403-forbidden) | Forbidden | Invalid API key or URL not allowed | `app/api/3d-worker/utils.ts`, `app/api/model-proxy/route.ts` | Check `MESHY_API_KEY`; use only allowed Meshy asset URLs |
| [404](#404-not-found) | Not Found | Requested resource does not exist | Multiple service & route files | Confirm the resource ID is correct before the request |
| [409](#409-conflict) | Conflict | Resource state prevents the operation | `app/backend/services/BlenderPipelineService.ts` | Wait for the previous step to finish before retrying |
| [500](#500-internal-server-error) | Internal Server Error | Missing env var, unhandled exception, or provider misconfiguration | Multiple service & route files | Set the missing env var; check server logs for the stack trace |
| [502](#502-bad-gateway) | Bad Gateway | Upstream service (OpenAI, Meshy, RunPod, Replicate) returned an error | Multiple service & route files | Inspect the upstream error; retry; verify API keys and quotas |
| [503](#503-service-unavailable) | Service Unavailable | Required service or API key not configured / worker unreachable | `ArtworkStudioService.ts`, `OutfitCardAiService.ts`, `3d-worker/status/route.ts` | Set the missing API key env var; ensure the worker pod is running |
| [504](#504-gateway-timeout) | Gateway Timeout | Polling exceeded max wait time / worker cold start | `ImageSegmentationService.ts`, `MeshyService.ts`, `blender-api/app.py`, `try-on-2d/route.ts` | Increase timeout; warm up the worker pod; retry the operation |

---

## Detailed Breakdown

### 400 Bad Request

The caller sent a request with missing or invalid fields.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/ArtworkStudioService.ts` | `user_id` or `prompt` is missing | Always include both fields in the request body |
| `app/backend/services/PieceIsolationService.ts` | `imageUrl` not provided | Pass the image URL when calling the piece isolation endpoint |
| `app/backend/services/Clothing2DGenerationService.ts` | `wardrobe_item_id` or `raw_upload_image_url` missing | Include both fields; neither can be null |
| `app/backend/services/WardrobeService.ts` | Required wardrobe-item fields absent | Validate the wardrobe item payload before submission |
| `app/backend/services/BlenderPipelineService.ts` | `user_id` or `wardrobe_item_id` missing for UV job | Supply both IDs when submitting a UV generation job |
| `app/backend/services/OutfitCardAiService.ts` | `prompt` is empty or missing | Pass a non-empty prompt string |
| `app/api/3d-worker/submit/route.ts` | Invalid JSON body, or `pieceId`/`imageUrl` missing | Send valid JSON with `pieceId` and `imageUrl` |
| `blender-worker/handler.py` | Neither `glbUrl` nor `imageUrl` provided | Provide at least one of `glbUrl` or `imageUrl` in the worker payload |
| `blender-worker/app.py` | Base scene file not found on disk | Ensure the base scene asset is present in the worker container |
| `app/api/upload-image/route.ts` | No file attached, wrong MIME type, or file > 8 MB | Attach a valid image file ≤ 8 MB |
| `app/api/users/me/route.ts` | `userId` parameter missing | Include `userId` as a query param or in the session |
| `app/api/authview/route.ts` | Malformed auth request body | Send a correctly-structured auth payload |
| `app/api/auth/reset/route.ts` | Malformed password-reset request | Validate the reset payload structure |

---

### 401 Unauthorized

The request did not supply a valid authentication credential.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `blender-worker/handler.py` | `Authorization` header value does not match the expected Bearer token | Set the correct `BLENDER_WORKER_SECRET` env var and pass it in the `Authorization` header |
| `blender-worker/app.py` | Bearer token missing or invalid | Include `Authorization: Bearer <token>` in the request |
| `app/api/auth/session/route.ts` | Session cookie absent or expired | Re-authenticate to obtain a fresh session |
| `app/api/3d-worker/reconcile/route.ts` | Internal reconcile call sent without valid credentials | Ensure the internal service-to-service token is configured |
| `useAuthGate.ts` (client) | API returns 401 after token expiry | The hook automatically refreshes the session; no manual fix needed |

---

### 403 Forbidden

The caller is authenticated but lacks permission for the requested resource or URL.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/api/3d-worker/utils.ts` | Meshy or RunPod rejected the key (returns 403) | Verify `MESHY_API_KEY` / `RUNPOD_API_KEY` is correct and has the required permissions |
| `app/api/model-proxy/route.ts` | Requested URL is not a Meshy asset URL | Only proxy Meshy CDN URLs through this endpoint |

---

### 404 Not Found

The requested resource does not exist in the database or upstream service.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/SchemeItemsService.ts` | Scheme or wardrobe item ID not in DB | Confirm the ID before the request; handle gracefully in the UI |
| `app/backend/services/WardrobeService.ts` | Wardrobe item ID not found | Check that the item was created successfully before fetching |
| `app/backend/services/BlenderPipelineService.ts` | Wardrobe item or pipeline job ID not found | Verify the job ID returned at submission time |
| `app/api/users/[id]/route.ts` | User ID does not exist | Ensure user creation completed before requesting their profile |
| `app/api/wardrobe/[id]/route.ts` | Wardrobe item not in DB | Use a valid item ID |
| `app/api/brands/[brandId]/logo-catalog/route.ts` | No active logo catalog for the brand | Activate a logo catalog for the brand in the admin panel |
| `app/api/internal/blender-cloud/diagnostics/route.ts` | Diagnostic record not found | Run diagnostics collection before querying this endpoint |
| `app/api/3d-worker/utils.ts` | Meshy or RunPod endpoint path incorrect (returns 404) | Verify `MESHY_BASE_URL` and the RunPod endpoint path (`/jobs` vs `/run`) |
| `app/api/3d-worker/status/route.ts` | Worker returns 404 (job not found) | Re-submit the job; the worker may have lost state after a restart |
| `app/services/blenderWorkerClient.ts` (client) | Worker responds `job_not_found` | Re-submit the 3D job |

---

### 409 Conflict

The current state of the resource prevents the requested operation.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/BlenderPipelineService.ts` | UV generation requested but the 3D model is not ready yet (`model_status !== 'done'`) | Poll the 3D generation status and only start UV generation once it reaches `done` |

---

### 500 Internal Server Error

An unexpected server-side error, usually a missing environment variable or an unhandled exception.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/ImageSegmentationService.ts` | Unsupported segmentation provider configured, or provider env var missing | Set `SEGMENTATION_PROVIDER` to a supported value and ensure its API key is present |
| `app/backend/services/ClothingAnalysisService.ts` | Missing clothing-analysis provider configuration | Configure the `CLOTHING_ANALYSIS_PROVIDER` env var |
| `app/backend/services/MeshyService.ts` | `MESHY_API_KEY` env var not set | Add `MESHY_API_KEY` to the server environment |
| `app/api/3d-worker/submit/route.ts` | Required env vars missing at job submission | Ensure `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, and related vars are set |
| `blender-worker/handler.py` | Blender pipeline execution failed (non-zero exit code) | Check the Blender worker container logs for the specific pipeline error |
| `blender-worker/app.py` | Blender command failed or output artifact not generated | Inspect the Blender render log inside the worker; check disk space and model validity |
| `app/api/users/me/route.ts` | Unhandled exception during profile load, update, or delete | Check server logs for the stack trace; ensure Firestore is reachable |
| `app/api/dress-tester/try-on-2d/route.ts` | Unexpected error during virtual try-on processing | Review the server error log; retry; check all upstream dependencies |

---

### 502 Bad Gateway

An upstream service (OpenAI, Meshy, RunPod, Replicate) returned an error or an unexpected response.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/ArtworkStudioService.ts` | OpenAI returned no usable artwork variations, or the generation call itself failed | Retry the request; check OpenAI API status and quota |
| `app/backend/services/ImageSegmentationService.ts` | Replicate or custom segmentation API returned an error during task submission or polling | Check the segmentation provider's status page; verify the API key and model slug |
| `app/backend/services/WardrobeService.ts` | RunPod Blender model generation failed or QA result was invalid | Check RunPod pod logs; verify the input model/texture assets |
| `app/backend/services/BlenderPipelineService.ts` | Pipeline job submission to the worker failed | Confirm the worker is running and reachable; check worker logs |
| `app/backend/services/ClothingAnalysisService.ts` | Clothing analysis service or OpenAI classification call failed | Retry; verify the OpenAI API key and connectivity |
| `app/backend/services/MeshyService.ts` | Meshy task failed, did not return a GLB URL, or polling failed | Check Meshy task status in the Meshy dashboard; retry if transient |
| `blender-worker/handler.py` | Failed to download GLB from remote URL, or Meshy generation step failed inside the worker | Verify the GLB URL is publicly accessible; check Meshy task status |
| `app/api/3d-worker/submit/route.ts` | RunPod submission failed; a 404 from RunPod is mapped here | Check `RUNPOD_ENDPOINT_ID` and `RUNPOD_API_KEY`; ensure the endpoint is deployed |
| `app/api/3d-worker/status/route.ts` | Worker unreachable or polling returned a non-OK response | Verify the worker pod is running; check network routing to the pod |
| `app/api/3d-worker/reconcile/route.ts` | Worker status or reconciliation call failed | Same as above; also check reconcile auth credentials |
| `app/api/dress-tester/try-on-2d/route.ts` | Garment/mannequin image fetch failed, background removal failed, or virtual try-on request failed | Verify all image URLs are reachable; check the try-on service status |

---

### 503 Service Unavailable

A required service or API key is not configured, or the worker pod is unreachable.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/ArtworkStudioService.ts` | `OPENAI_API_KEY` environment variable not set | Add `OPENAI_API_KEY` to the server environment |
| `app/backend/services/OutfitCardAiService.ts` | `OPENAI_API_KEY` not configured | Same as above |
| `app/api/3d-worker/status/route.ts` | Worker pod is unreachable (connection refused or DNS failure) | Ensure the RunPod / Blender worker pod is started and the endpoint URL is correct |
| `app/api/3d-worker/jobs/[jobId]/route.ts` | Job polling failed; job still pending and service not ready | Wait and retry; if persistent, restart the worker pod |

---

### 504 Gateway Timeout

A polling loop exceeded the maximum wait time, or the worker took too long to respond.

| File | Trigger Condition | Fix |
|------|------------------|-----|
| `app/backend/services/ImageSegmentationService.ts` | Segmentation task did not finish within the configured polling window | Increase the polling timeout env var; check if the segmentation provider is under load |
| `app/backend/services/MeshyService.ts` | Meshy 3D task did not complete within the max polling time | Increase `MESHY_POLL_TIMEOUT_MS`; check Meshy task queue depth |
| `blender-api/app.py` | Worker processing exceeded the timeout (cold start or heavy mesh) | Pre-warm the worker pod; increase `WORKER_TIMEOUT_SECONDS` in the Blender API config |
| `app/api/dress-tester/try-on-2d/route.ts` | Virtual try-on request timed out | Increase the route timeout or retry; check the try-on service response time |

---

## Error Class Reference

| Class / Utility | File | Description |
|----------------|------|-------------|
| `ServiceError` | `app/backend/services/errors.ts` | TypeScript base error class; carries `statusCode` (defaults to 400). All service-layer errors extend or use this class |
| `StructuredStageError` | `app/api/3d-worker/utils.ts` | Enhanced error for the 3D pipeline; includes `stage`, `provider`, `status`, `hint`, and `code` for rich debugging |
| `deriveFailureHint()` | `app/api/3d-worker/utils.ts` | Maps a raw HTTP status code + provider to a human-readable hint (see table below) |
| `HTTPException` | `blender-worker/handler.py`, `blender-api/app.py` | FastAPI exception; used in all Python workers |

### `deriveFailureHint` Mapping

| Upstream Status | Provider | Hint |
|----------------|---------|------|
| 401 / 403 | Meshy | "Invalid or missing MESHY_API_KEY" |
| 401 / 403 | RunPod | "Missing or invalid token — check Authorization Bearer credentials" |
| 404 | Meshy | "Meshy endpoint not found — check MESHY_BASE_URL" |
| 404 | RunPod | "Wrong endpoint path — verify `/jobs` vs `/run`" |
| 405 | Any | "Wrong HTTP method used by the remote service" |
| 502 / 503 | Meshy | "Meshy service unavailable" |
| 502 / 503 | RunPod | "RunPod pod not ready or Uvicorn app is not running" |
| Timeout | Any | "Request timeout: worker cold start or long 3D generation job" |
| `ENOTFOUND` | Network | "DNS resolution failed for hostname" |
| `ECONNREFUSED` | Network | "Connection refused by hostname" |
