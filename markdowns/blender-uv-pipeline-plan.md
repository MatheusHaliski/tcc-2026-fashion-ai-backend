# Blender UV Auto-Generation Pipeline Plan (Add Wardrobe Item)

## Goal
Build a reliable, low-latency pipeline where submitting a wardrobe item (for example: **"red adidas shirt"**) from `add-wardrobe-item` triggers a local Blender Python workflow that:
1. Loads an upper-body base mesh template.
2. Automatically unwraps / validates UVs for the garment region.
3. Applies a generated apparel layer (color + brand placement).
4. Exports UV/layout artifacts and textured preview assets.
5. Reports progress and final outputs back to the app.

---

## 1) End-to-end architecture

### A. Frontend input and request contract
- Extend the `add-wardrobe-item` submit payload with:
  - `category` (e.g., `upper_body`)
  - `garment_prompt` (e.g., `red adidas shirt`)
  - `color` (normalized hex/rgb)
  - `brand` (`adidas`)
  - `base_model_id` (`upper_body_v1`)
  - `generation_mode` (`fast_uv` vs `hq_uv`)
- Add idempotency key to avoid duplicate Blender jobs when users retry.

### B. Orchestrator API (existing backend)
- Create/extend an endpoint (suggestion: `POST /api/wardrobe-items/generate-uv`) that:
  - Validates request.
  - Creates a `pipeline_job` row/document.
  - Pushes a job to a queue (`pending`).
  - Returns `jobId` immediately.
- Add `GET /api/pipeline-jobs/:id` for status polling or websocket/SSE updates.

### C. Blender worker service (local account)
- Run a local worker daemon that:
  - Pulls pending jobs.
  - Launches Blender headless:
    - `blender -b <base.blend> --python worker_entry.py -- --job <json>`
  - Writes outputs to local storage.
  - Pushes status + artifact URLs/paths to backend.

### D. Storage and artifacts
- Persist:
  - UV layout PNG (`uv_layout.png`)
  - UV map data (`uv_data.json`)
  - Textured preview render (`preview_front.png`, optional turntable)
  - Generated texture (`shirt_texture.png`)
  - Optional exported model (`shirt_applied.glb`)

---

## 2) Blender Python injection workflow

## Script stages inside Blender (`worker_entry.py`)
1. **Load scene/template**
   - Open `upper_body_v1.blend`.
   - Ensure deterministic scene state (disable random modifiers, apply transforms).

2. **Select target mesh and region**
   - Resolve mesh object by naming convention (`UBODY_BASE`, `GARMENT_LAYER`).
   - Optionally isolate vertex groups (`torso`, `sleeves`).

3. **UV generation strategy**
   - If no UV exists: Smart UV Project or seam-based unwrap preset.
   - If UV exists: run quality validator (overlap %, island distortion, texel density spread).
   - Auto-correct via pack islands with margin profile (`fast` vs `hq`).

4. **Material synthesis from prompt metadata**
   - Build/clone `ShirtMaterial` node graph.
   - Apply base color (red).
   - Load brand decal asset from catalog (`adidas.svg/png`).
   - Place logo through a dedicated UV/decal channel (chest anchor).

5. **Bake/compose texture outputs**
   - Bake combined albedo (and optional normal/roughness).
   - Export texture(s) and UV layout.

6. **Render preview**
   - Render low-cost front + angled preview for UI confirmation.

7. **Emit structured result**
   - Write `result.json` with timings, quality metrics, paths.

---

## 3) Data model updates

Add a `pipeline_jobs` entity/table with:
- `id`, `user_id`, `wardrobe_item_id` (nullable until final save)
- `status` (`pending`, `running`, `retrying`, `failed`, `completed`)
- `input_payload` (json)
- `worker_host`, `attempt`, `started_at`, `finished_at`
- `error_code`, `error_message`
- `artifacts` (json with URLs/paths)
- `metrics` (total ms, unwrap ms, bake ms, render ms)

Add optional fields in wardrobe item:
- `uv_ready` boolean
- `uv_artifact_ref`
- `preview_image_ref`

---

## 4) Performance strategy (to reduce slow tasks)

1. **Template preloading**
   - Keep Blender worker warm with preloaded base scenes to avoid startup cost per request.

2. **Mode tiers**
   - `fast_uv`: lower texture resolution, skip heavy passes, strict timeout.
   - `hq_uv`: full bake + extra validation.

3. **Queue + concurrency control**
   - Limit concurrent Blender processes per machine (e.g., 1-2).
   - Backpressure when queue exceeds threshold.

4. **Caching**
   - Hash normalized input (`base_model_id + brand + color + garment_type`).
   - Reuse artifacts for repeated requests.

5. **Timeouts + retries**
   - Stage-level timeouts (unwrap/bake/render).
   - Retry with fallback unwrap profile before marking failed.

6. **Observability**
   - Emit stage timings and failure categories.
   - Dashboard: p50/p95 latency, fail %, queue depth.

---

## 5) Suggested API contract

### Request (from add-wardrobe-item)
```json
{
  "userId": "u_123",
  "category": "upper_body",
  "garmentPrompt": "red adidas shirt",
  "brand": "adidas",
  "color": "#C1121F",
  "baseModelId": "upper_body_v1",
  "generationMode": "fast_uv",
  "idempotencyKey": "uuid-v4"
}
```

### Async status response
```json
{
  "jobId": "job_789",
  "status": "running",
  "stage": "uv_unwrap",
  "progress": 55,
  "artifacts": {
    "previewFront": null,
    "uvLayout": null
  }
}
```

### Completion response
```json
{
  "jobId": "job_789",
  "status": "completed",
  "artifacts": {
    "uvLayout": ".../uv_layout.png",
    "texture": ".../shirt_texture.png",
    "previewFront": ".../preview_front.png",
    "modelGlb": ".../shirt_applied.glb"
  },
  "metrics": {
    "totalMs": 18200,
    "unwrapMs": 2100,
    "bakeMs": 9800,
    "renderMs": 2400
  }
}
```

---

## 6) Rollout plan

### Phase 1 (MVP)
- Single local Blender worker.
- Upper body only.
- Color + brand decal placement.
- One preview render and UV layout output.

### Phase 2
- Better seam presets by garment type.
- Multi-angle previews.
- Retry profiles + cache.

### Phase 3
- Multi-worker scaling.
- Quality scoring + automatic rejection when UV quality below threshold.
- Support pants/jackets/dresses base templates.

---

## 7) Key risks and mitigations

- **Blender startup latency** -> persistent warm workers.
- **UV quality inconsistency** -> validator + deterministic unwrap presets.
- **Brand logo misuse/compliance** -> enforce brand asset whitelist.
- **Local worker downtime** -> heartbeat + failover queue behavior.
- **Duplicate jobs from UI retries** -> idempotency keys.

---

## 8) Practical next implementation steps in this repo

1. Add a backend job endpoint + status endpoint.
2. Add `pipeline_jobs` repository/service/controller.
3. Extend `add-wardrobe-item` submit action to call new async endpoint.
4. Create a standalone `blender-worker` folder with:
   - `worker_entry.py`
   - `uv_pipeline.py`
   - `materials.py`
   - `exporters.py`
5. Add feature flags: `ENABLE_BLENDER_PIPELINE`, `BLENDER_WORKER_URL`.
6. Add telemetry logs for each stage and integrate into existing monitoring.

This plan prioritizes **fast user feedback**, **deterministic Blender automation**, and **progressive quality improvements** without blocking wardrobe item creation flows.
