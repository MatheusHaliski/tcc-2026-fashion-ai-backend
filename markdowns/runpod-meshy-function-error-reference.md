# RunPod Pipeline + Meshy 3D Generation Function Reference

This document explains the **purpose of each key function** in the RunPod-based 3D pipeline and Meshy API generation flow, and maps where/why the requested errors can happen: **401**, **403**, and **502**.

---

## 1) End-to-end flow (high level)

1. Backend service decides whether to use RunPod or Meshy fallback.
2. If RunPod is configured, backend submits job to worker and polls status.
3. Worker uses Meshy image-to-3D API to create/poll/download a base model.
4. Worker returns artifacts; backend validates model URL and persists state.
5. Backend surfaces failures as `ServiceError` (commonly HTTP `502` for upstream/provider failures).

Primary implementation files:
- `app/backend/services/WardrobeService.ts`
- `app/backend/services/MeshyService.ts`
- `blender-worker/meshy_pipeline.py`
- `blender-worker/handler.py`
- `blender-api/app.py`

---

## 2) RunPod pipeline functions (backend orchestration)

## `WardrobeService.generateModelFromImage(...)`
**Purpose**
- Central orchestration point for model generation from an image.
- Updates pipeline status and attempt counters.
- Routes to Meshy fallback when RunPod is not configured.
- Submits/polls RunPod jobs and converts worker/provider failures into API-friendly errors.

**Why 502 can occur here**
- `submitBlenderCloudJob` throws (endpoint/token/worker/network issue), then function wraps into `ServiceError(..., 502)`.
- RunPod returns `failed`/`cancelled` either at submit stage or poll stage.
- RunPod completes but artifacts have no valid HTTP model URL.
- Worker returns Meshy-related failures; this function maps worker codes (`meshy_*`) into pipeline failure metadata and throws `502`.

**Notes on 401/403 in this layer**
- This function usually does not emit raw 401/403 directly; auth-style upstream failures are typically transformed into `502` with diagnostics.

---

## 3) Meshy API functions (backend direct fallback client)

## `MeshyService.generate3DModelFromImage(imageUrl, options?)`
**Purpose**
- Runs direct Meshy flow for fallback scenarios (outside RunPod worker): create task, poll until finished, return GLB URL.

**Why 502 can occur here**
- Create response fails.
- Polling fails.
- Meshy task fails.
- Completed response has no GLB URL.

## `MeshyService.createTask(...)`
**Purpose**
- Sends `POST /openapi/v1/image-to-3d` to Meshy and extracts task ID.

**Why 502 can occur here**
- Any non-OK response is mapped to `ServiceError(..., 502)`.
- Missing task ID in successful payload also mapped to `502`.

## `MeshyService.waitUntilFinished(taskId)`
**Purpose**
- Polls `GET /openapi/v1/image-to-3d/{taskId}` until complete/fail/timeout.

**Why 502 can occur here**
- Poll request returns non-OK response.
- Task reaches failed status.
- (Timeout is currently mapped to `504`, not `502`.)

**401/403 behavior in this backend Meshy service**
- It does not explicitly special-case 401 vs 403; non-OK generally becomes 502 with response details.

---

## 4) Meshy API functions (RunPod worker implementation)

## `MeshyPipeline.generate_base_model(...)`
**Purpose**
- Worker-level top function for Meshy generation.
- Validates key inputs, creates task, waits for completion, selects model URL, downloads file, returns metadata.

**Error mapping relevance**
- Can raise `MeshyPipelineError` from inner calls for auth/provider/request issues.

## `MeshyPipeline._create_task(...)`
**Purpose**
- Build and send Meshy create-task request.

**Where 401/403 occur**
- If Meshy responds 401 or 403, this function throws `meshy_auth_failed`.

**Where provider/upstream failure occurs (mapped later to 502)**
- 5xx from Meshy causes `meshy_provider_error`.
- 4xx payload issues (other than 401/403 special case) causes `meshy_bad_request`.

## `MeshyPipeline._wait_for_completion(task_id)`
**Purpose**
- Poll Meshy task status until success/failure/timeout.

**Where 401/403 occur**
- Polling response 401/403 => `meshy_auth_failed`.

**Where provider/upstream failures occur (mapped later to 502)**
- Polling 5xx => `meshy_provider_error`.
- Polling 4xx => `meshy_bad_request`.
- Failed/cancelled task => `meshy_task_failed`.

## `MeshyPipeline._download(url, destination)`
**Purpose**
- Downloads final mesh artifact.

**Where 401/403 occur**
- Download response 401/403 => `meshy_auth_failed`.

**Where provider/upstream failures occur (mapped later to 502)**
- 4xx => `meshy_bad_request`.
- 5xx => `meshy_provider_error`.

## `MeshyPipeline._request_with_retry(...)`
**Purpose**
- Shared network wrapper with retry/backoff for transient connectivity issues.

**Indirect path to 502**
- DNS or connection failures are raised as structured `MeshyPipelineError` (`dns_resolution_failure` / `meshy_temporarily_unavailable`), which upstream orchestration later surfaces as provider-style failures (commonly 502 in backend API responses).

## `MeshyPipeline._validate_image_url_public(image_url)`
**Purpose**
- Verifies the source image is publicly reachable before task creation.

**How 403 can appear here**
- HEAD may return 403 and code retries with GET bytes probe.
- If final probe still returns HTTP >= 400, raises `meshy_input_image_unreachable`.

**Indirect path to 502**
- This is an upstream validation failure in worker; backend typically converts it into a 502-class pipeline failure.

---

## 5) RunPod worker HTTP auth entry points (direct 401)

## `blender-worker/handler.py` → `validate_auth_header(...)`
**Purpose**
- Enforces bearer-token auth on worker API requests.

**Why 401 occurs**
- Missing bearer token.
- Invalid bearer token.
- In this case worker raises `HTTPException(status_code=401)` directly.

## `blender-worker/app.py` auth middleware/guard
**Purpose**
- Protects worker endpoints.

**Why 401 occurs**
- Unauthorized request at worker API boundary.

---

## 6) API gateway/proxy layer that emits 502

## `blender-api/app.py` proxy calls to worker
**Purpose**
- Sits in front of GPU worker and forwards job requests / status calls.

**Why 502 occurs**
- Worker unreachable (connection failure, timeout).
- Worker request-level errors wrapped as upstream failure.

This layer explicitly raises `HTTPException(status_code=502, ...)` when upstream worker communication fails.

---

## 7) Error-by-error summary (requested set)

## 401 Unauthorized
**Common causes**
- Invalid/missing Meshy API key (`Authorization: Bearer ...`).
- Invalid/missing bearer token when calling protected RunPod worker endpoints.

**Functions that trigger/report it**
- `MeshyPipeline._create_task` (Meshy create 401)
- `MeshyPipeline._wait_for_completion` (Meshy poll 401)
- `MeshyPipeline._download` (asset download 401)
- `validate_auth_header` in worker handler (direct worker 401)
- worker app auth guard (direct worker 401)

## 403 Forbidden
**Common causes**
- Meshy credentials recognized but lacking permission/quota scope.
- Asset or source-image URL denies access to Meshy or to the worker probe.

**Functions that trigger/report it**
- `MeshyPipeline._create_task` (Meshy create 403)
- `MeshyPipeline._wait_for_completion` (Meshy poll 403)
- `MeshyPipeline._download` (asset download 403)
- `MeshyPipeline._validate_image_url_public` (403 during reachability probe)

## 502 Bad Gateway
**Common causes**
- Upstream provider failure (Meshy 5xx, malformed response, task failure).
- RunPod worker submit/poll failure from backend perspective.
- Proxy/gateway cannot reach worker.

**Functions that trigger/report it**
- `WardrobeService.generateModelFromImage` (many upstream failures normalized to 502)
- `MeshyService.createTask` / `waitUntilFinished` / `generate3DModelFromImage` (backend fallback path)
- `blender-api/app.py` worker proxy handlers (worker unreachable/request error -> 502)

---

## 8) Practical debugging hints by error

- **401**: verify `MESHY_API_KEY`, worker bearer token, and whether headers are being forwarded exactly once.
- **403**: verify key permissions/quota, private asset/image ACLs, signed URL token presence and expiration.
- **502**: inspect which layer threw it first:
  1) backend orchestration (`WardrobeService`),
  2) proxy (`blender-api/app.py`),
  3) worker Meshy stage (`meshy_pipeline.py`).
  Use stage/errorCode metadata to isolate submit vs poll vs download vs endpoint mismatch.

---

## 9) Perguntas e respostas para diagnóstico rápido (401, 403, 502)

Use este roteiro em ordem. A ideia é descobrir **em qual camada** o erro nasce (backend, proxy, worker, Meshy) e por que o pipeline 3D trava.

## Bloco A — Identificar a camada da falha

**Pergunta 1:** O erro aparece no backend como `pipelineFailure.failedStage`?
- **Resposta esperada:** Sim, geralmente em `WardrobeService.generateModelFromImage(...)`.
- **Interpretação:** Se houver `failedStage`, comece por ele para saber se falhou em `runpod_submit`, `meshy_submit`, `runpod_worker_failure` etc.

**Pergunta 2:** O erro veio como `HTTPException 502` no `blender-api`?
- **Resposta esperada:** Sim, quando o proxy não alcança o worker ou recebe erro de comunicação.
- **Interpretação:** O problema pode ser conectividade entre API e worker, não necessariamente a Meshy.

**Pergunta 3:** O worker retornou código `meshy_*` no `raw.error.code`?
- **Resposta esperada:** Pode aparecer `meshy_auth_failed`, `meshy_bad_request`, `meshy_timeout`, etc.
- **Interpretação:** A falha nasceu dentro do `meshy_pipeline.py`.

## Bloco B — Diagnóstico de 401 (Unauthorized)

**Pergunta 4:** `MESHY_API_KEY` está presente e sem espaços extras?
- **Resposta:** Se não, `_create_task(...)` e `_wait_for_completion(...)` podem retornar 401/403 e virar `meshy_auth_failed`.

**Pergunta 5:** O token Bearer enviado ao worker RunPod está correto?
- **Resposta:** Se inválido/ausente, `validate_auth_header(...)` retorna 401 direto.

**Pergunta 6:** O erro 401 ocorre ao criar task, ao poll, ou ao baixar asset?
- **Resposta:** 
  - criar task -> provável chave inválida/escopo insuficiente;
  - poll -> chave pode ter sido rotacionada/expirada durante execução;
  - download -> URL final do asset pode exigir outra autorização.

**Pergunta 7:** O header `Authorization` está sendo sobrescrito por outro serviço no caminho?
- **Resposta:** Se sim, tokens podem chegar truncados/duplicados, gerando 401 intermitente.

## Bloco C — Diagnóstico de 403 (Forbidden)

**Pergunta 8:** A chave Meshy tem permissão/quota para image-to-3d?
- **Resposta:** Sem quota/permissão, `_create_task(...)` pode retornar 403.

**Pergunta 9:** A imagem de entrada é realmente pública para a Meshy?
- **Resposta:** `_validate_image_url_public(...)` testa acessibilidade; URLs privadas/tokens expirados causam rejeição.

**Pergunta 10:** URL Firebase tem `token` na query string e ele ainda é válido?
- **Resposta:** Sem token (ou com token expirado), a Meshy não consegue baixar a imagem e o job falha.

**Pergunta 11:** O HEAD retornou 403 mas o GET de probe também falhou?
- **Resposta:** Isso normalmente indica bloqueio de acesso real ao arquivo; resultado costuma evoluir para falha de submit/pipeline.

## Bloco D — Diagnóstico de 502 (Bad Gateway)

**Pergunta 12:** O 502 aconteceu imediatamente no submit do RunPod?
- **Resposta:** Em geral aponta para `submitBlenderCloudJob(...)` (endpoint incorreto, worker offline, rota errada, timeout).

**Pergunta 13:** O 502 aconteceu após vários polls?
- **Resposta:** Indica falha tardia no worker/provider (`meshy_provider_error`, `meshy_task_failed`, cancelamento).

**Pergunta 14:** O job completou mas sem `model_url` válido?
- **Resposta:** `WardrobeService.generateModelFromImage(...)` lança 502 quando artifacts não têm URL HTTP utilizável.

**Pergunta 15:** O proxy (`blender-api`) registrou “Worker unreachable”?
- **Resposta:** O 502 vem da camada de gateway (rede/healthcheck do worker), não da lógica de modelagem 3D.

**Pergunta 16:** Há sinais de DNS falhando no worker (`dns_resolution_failure`)?
- **Resposta:** Esse cenário quebra create/poll/download e costuma virar erro de upstream no backend (muitas vezes 502).

## Bloco E — Perguntas sobre travamento/intermitência

**Pergunta 17:** O erro é constante ou intermitente?
- **Resposta:**
  - constante -> configuração (token, URL base, rota, permissões);
  - intermitente -> rede, DNS, timeout, sobrecarga da Meshy/worker.

**Pergunta 18:** O problema ocorre só em imagens específicas?
- **Resposta:** Pode indicar URL de origem inacessível, formato inválido, bloqueio por ACL/CDN ou payload inadequado.

**Pergunta 19:** A falha ocorre só em horários de pico?
- **Resposta:** Sugere saturação/instabilidade externa (Meshy 5xx) ou gargalo de infraestrutura do RunPod.

**Pergunta 20:** O fallback para Meshy direta (sem RunPod) também falha?
- **Resposta:**
  - se sim -> problema tende a estar na Meshy/credenciais/input;
  - se não -> problema tende a estar na integração RunPod/worker/proxy.

## Bloco F — Ações objetivas após cada diagnóstico

- Se **401**: rotacionar/revalidar `MESHY_API_KEY`, checar Bearer do worker e logs de headers sanitizados.
- Se **403**: revisar quota/permissões Meshy e tornar `image_url` realmente pública (token válido, sem bloqueio).
- Se **502**: separar por camada (backend vs proxy vs worker) e agir no primeiro ponto de falha observado nos logs.

