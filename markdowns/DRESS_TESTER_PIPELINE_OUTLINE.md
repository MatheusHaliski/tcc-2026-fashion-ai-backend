# Dress Tester Pipeline: Piece Ingestion, 3D Generation, and 2D Fitting Redesign

## 1) Goal of this document
- Define the **end-to-end process** for adding a clothing piece and generating a 3D model.
- List all required infrastructure and runtime configuration:
  - RunPod GPU + environment variables.
  - Meshy AI availability and API integration assumptions.
  - Vercel deployment environment variables.
- Propose a redesign plan for **Tester 2D** so clothes visually fit the mannequin body correctly (geometry-aware fit), not a flat pasted overlay.

---

## 2) Current pain points (from provided examples)
- The current browser result places the apparel image over the mannequin using mostly 2D overlay rules, producing:
  - bad shoulder/neck alignment,
  - poor torso contour adherence,
  - sleeve mismatch,
  - low realism compared with the “correct” reference.
- The pipeline likely lacks robust body/garment landmarks, segmentation masks, and warping constraints tied to mannequin geometry.

---

## 3) End-to-end process: add piece -> generate 3D -> publish to tester

### Stage A — Piece ingestion (frontend + backend)
1. User clicks **Add Piece**.
2. User uploads source images (minimum required set):
   - Front image (required),
   - Optional back/side details,
   - Optional material/texture references.
3. Backend validates file type/resolution/background quality.
4. Backend stores originals in object storage and creates a `piece_id`.
5. System classifies metadata:
   - category (TOP/BOTTOM/FULLBODY/OUTERWEAR),
   - gender/mannequin family,
   - fit class (slim/regular/oversized),
   - sleeve type and neckline.

**Output of Stage A**
- Canonical piece record with metadata + storage URLs.
- Pipeline status = `INGESTED`.

### Stage B — Preprocessing (normalization + mask extraction)
1. Background removal / alpha extraction.
2. Garment segmentation mask creation.
3. Landmark extraction (collar, shoulders, sleeves, hem points).
4. Texture enhancement and color normalization.
5. Optional synthetic depth estimation for better 2.5D projection.

**Output of Stage B**
- `garment_rgba.png`
- `garment_mask.png`
- `garment_landmarks.json`
- optional `garment_depth.exr` / `garment_normal.png`
- Pipeline status = `PREPARED`

### Stage C — 3D generation (RunPod GPU + Meshy + Blender worker)
1. Orchestrator queues job with `piece_id` and preprocessing artifacts.
2. RunPod worker starts GPU task.
3. Meshy API (or equivalent service) is called to generate base garment mesh from image/text prompt + category hints.
4. Worker polls Meshy job until complete.
5. Download generated mesh assets.
6. Blender refinement stage:
   - scale normalization,
   - topology cleanup,
   - UV unwrap and seam checks,
   - projection of garment texture,
   - mannequin compatibility transform.
7. Export final assets (`.glb`, preview renders, UV texture atlas).
8. Store final assets and update DB record.

**Output of Stage C**
- `piece.glb`
- `piece_preview_front.png` (+ optional turntable frames)
- `piece_texture_atlas.png`
- Pipeline status = `READY_3D`

### Stage D — Publish to Dress Tester
1. Mark piece as available in catalog/search index.
2. Associate supported mannequin templates.
3. Enable 2D tester compatibility artifacts (masks/anchors/warp maps).
4. Expose piece via API for web UI lists.

**Output of Stage D**
- Piece visible in right-side panel with status `READY`.

---

## 4) Required setup

### 4.1 RunPod GPU setup
- Provision a pod with:
  - CUDA-compatible GPU,
  - Python runtime,
  - Blender headless support,
  - worker process entrypoint.
- Install dependencies:
  - Python packages (`requirements.txt`),
  - system libs required by Blender and image tooling,
  - optional queue client / storage SDK.
- Expose worker service port (if HTTP-based orchestration is used).

#### Suggested RunPod env vars
- `RUNPOD_API_KEY`
- `RUNPOD_ENDPOINT_ID` (if serverless endpoint orchestration is used)
- `WORKER_MODE` (`queue` or `http`)
- `GPU_DEVICE` (optional explicit selector)
- `MODEL_CACHE_DIR`
- `BLENDER_BINARY`
- `PYTHONUNBUFFERED=1`

### 4.2 Meshy AI availability and reliability checklist
- Confirm account/API key is active.
- Validate quota/credits and per-day throughput.
- Test generation for at least one sample per category.
- Define fallback behavior when Meshy is unavailable:
  - retry with exponential backoff,
  - circuit breaker after N failures,
  - status = `PENDING_EXTERNAL` or `FAILED_RETRYABLE`.
- Persist external job IDs for traceability.

#### Suggested Meshy env vars
- `MESHY_API_KEY`
- `MESHY_BASE_URL`
- `MESHY_TIMEOUT_MS`
- `MESHY_MAX_RETRIES`
- `MESHY_WEBHOOK_SECRET` (if webhooks are used)

### 4.3 Vercel deployment env vars (web + server actions/API)
Group variables by concern:

**Core app**
- `NEXT_PUBLIC_APP_URL`
- `NODE_ENV`

**Database/storage**
- `DATABASE_URL`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`

**Auth/session**
- `NEXTAUTH_URL` (or equivalent)
- `NEXTAUTH_SECRET`

**Pipeline orchestrator**
- `PIPELINE_API_BASE_URL`
- `PIPELINE_INTERNAL_TOKEN`
- `RUNPOD_ENDPOINT_ID`

**Meshy integration**
- `MESHY_API_KEY`
- `MESHY_BASE_URL`

**Feature flags / tuning**
- `ENABLE_TESTER_2D_V2`
- `ENABLE_GARMENT_WARP_DEBUG`
- `PIPELINE_DEFAULT_MANNEQUIN`

**Observability**
- `SENTRY_DSN`
- `LOG_LEVEL`
- `METRICS_WRITE_KEY`

---

## 5) Tester 2D redesign plan (fit-realism pipeline)

### 5.1 Target result
The cloth should visually “wrap” the mannequin torso with realistic alignment at collar/shoulders/sleeves/hem, preserving logo position and fabric proportion, and respecting mannequin occlusion boundaries.

### 5.2 Proposed technical architecture

#### Step 1: Mannequin geometry model (2D-compatible)
- For each mannequin template, precompute and version:
  - body segmentation mask (torso/arms/neck),
  - key landmarks (neck center, shoulder tips, armpits, waist, hips),
  - UV-like canonical map for torso region.
- Save as static assets + JSON metadata.

#### Step 2: Garment canonicalization
- Standardize garment images before fitting:
  - isolate garment mask,
  - detect garment landmarks (collar center, shoulder seam points, sleeve cuffs, hem corners),
  - infer symmetry axis and scale priors.

#### Step 3: Geometry-aware warping engine
- Replace flat overlay with constrained warp:
  - Thin Plate Spline (TPS) or piecewise affine transform driven by garment/body landmarks,
  - region-aware warp strength (torso vs sleeves),
  - edge-preserving interpolation.
- Add collision constraints:
  - keep neckline above chest anchor,
  - prevent sleeve crossing torso interior unnaturally,
  - cap stretch/compression per axis.

#### Step 4: Occlusion and compositing
- Compose in layers:
  1. mannequin base,
  2. warped garment,
  3. foreground body occlusion mask (if needed for realism near arms/neck).
- Apply subtle shading transfer from mannequin normals/depth approximation.
- Optional wrinkle/light enhancement pass.

#### Step 5: Quality scoring + auto-fallback
- Compute quality metrics:
  - landmark residual error,
  - boundary overlap score (IoU with torso region),
  - distortion score.
- If score below threshold:
  - run second-pass warp with adjusted anchors,
  - or fallback to conservative centered fit template.

### 5.3 Implementation phases

#### Phase 0 — Instrumentation (1–2 days)
- Add debug overlays for landmarks, masks, and warp mesh.
- Add per-piece fitting logs with residual metrics.

#### Phase 1 — Data assets (2–4 days)
- Create mannequin landmark + mask assets for all supported body templates.
- Build garment landmark extractor service.

#### Phase 2 — Warp V2 (4–7 days)
- Implement TPS/piecewise warp with constraints.
- Integrate layered compositor.
- Expose feature flag `ENABLE_TESTER_2D_V2`.

#### Phase 3 — Evaluation harness (2–3 days)
- Build benchmark set (at least 50 garments across categories).
- Compare current pipeline vs V2 with objective metrics + human review.

#### Phase 4 — Rollout (2 days)
- Canary rollout (internal users).
- Monitor error rates and quality scores.
- Promote to 100% if stable.

### 5.4 Acceptance criteria
- Collar alignment error < defined pixel threshold.
- Shoulder seam match improves vs baseline by target percentage.
- No major sleeve-body overlap artifacts in benchmark set.
- Product team rates realism as “acceptable” in >90% of benchmark cases.

---

## 6) Operational checklist
- [ ] RunPod worker deployed and reachable.
- [ ] Meshy API key valid and quota verified.
- [ ] All Vercel env vars configured for Preview + Production.
- [ ] Pipeline status tracking visible in admin panel.
- [ ] Tester 2D V2 behind feature flag with safe rollback.
- [ ] Regression dataset created and stored.

---

## 7) Suggested next actions for the team
1. Confirm final env-var naming convention and secret ownership.
2. Implement Phase 0 instrumentation immediately (highest leverage).
3. Produce 10 known-failure garments from production for rapid iteration.
4. Stand up weekly quality review with side-by-side baseline vs V2 render comparisons.
