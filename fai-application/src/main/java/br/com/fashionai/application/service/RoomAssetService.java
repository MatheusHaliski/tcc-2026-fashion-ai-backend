package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts.Model3dPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Generate once with Meshy, review, then sell the SAME stored model through the existing points shop. */
@Service
public class RoomAssetService {
    public record Command(UUID requestId, String name, String slotType, String moldId, int widthCm,
                          int pricePoints, String requiredLevel, String description) {}
    private final Guard guard;
    private final UserRepository users;
    private final PipelineJobRepository jobs;
    private final RoomCatalogItemRepository catalog;
    private final MediaStoragePort storage;
    private final WebFetchPort web;
    private final Model3dPort meshy;
    private final TransactionTemplate tx;
    static final Set<String> SUPPORTED_SLOTS = Set.of("RUG", "HANGER", "ISLAND", "BAG_DISPLAY", "JEWELRY");
    static final int MAX_GLB = 40 * 1024 * 1024;
    static final Duration LEASE = Duration.ofMinutes(3), TIMEOUT = Duration.ofMinutes(30);

    public RoomAssetService(Guard guard, UserRepository users, PipelineJobRepository jobs,
                            RoomCatalogItemRepository catalog, MediaStoragePort storage, WebFetchPort web,
                            List<Model3dPort> providers, TransactionTemplate tx) {
        this.guard = guard; this.users = users; this.jobs = jobs; this.catalog = catalog;
        this.storage = storage; this.web = web; this.tx = tx;
        this.meshy = providers.stream().filter(p -> "meshy".equals(p.providerId())).findFirst().orElse(null);
    }

    public Map<String, Object> list(CurrentUser user) {
        guard.requireAdmin(user);
        return Map.of("available", meshy != null && meshy.available(),
                "items", jobs.findTop100ByTypeOrderByQueuedAtDesc(PipelineJobType.ROOM_ASSET_GENERATION).stream().map(this::view).toList(),
                "blocks", WardrobeCreatorService.BLOCKS.stream().filter(b -> SUPPORTED_SLOTS.contains(b.slotType())).toList(), "levels", WardrobeCreatorService.LEVELS);
    }

    public Map<String, Object> create(CurrentUser user, Command c, byte[] image) {
        guard.requireAdmin(user); guard.requireCanCreate(user);
        if (c == null || c.requestId() == null || c.name() == null || c.name().isBlank() || c.name().length() > 120
                || c.pricePoints() < 1 || c.pricePoints() > 1_000_000 || c.description() != null && c.description().length() > 400
                || !SUPPORTED_SLOTS.contains(c.slotType()) || !WardrobeCreatorService.LEVELS.contains(c.requiredLevel())
                || WardrobeCreatorService.BLOCKS.stream().noneMatch(b -> b.slotType().equals(c.slotType()) && b.moldId().equals(c.moldId()) && b.widthCm() == c.widthCm())) {
            throw error(400, "ASSET_METADATA_INVALID");
        }
        if (image == null || image.length == 0 || image.length > 8 * 1024 * 1024) throw error(400, "ASSET_IMAGE_INVALID");
        // ImageOps bounds decoded pixels and normalizes orientation. Meshy accepts PNG data URIs.
        byte[] png = ImageOps.png(ImageOps.decode(image));
        if (png.length > 12 * 1024 * 1024) throw error(400, "ASSET_IMAGE_TOO_LARGE");
        return tx.execute(s -> {
            User owner = users.lockById(user.id()).orElseThrow(() -> error(404, "USER_NOT_FOUND"));
            var existing = jobs.findByTypeAndInputResourceIdOrderByCreatedAtDesc(PipelineJobType.ROOM_ASSET_GENERATION, c.requestId())
                    .stream().filter(j -> j.getUser().getId().equals(owner.getId())).findFirst();
            if (existing.isPresent()) {
                var original = Json.map(existing.get().getInputJson());
                if (!Json.map(Json.write(c)).equals(original.get("command"))
                        || !br.com.fashionai.application.common.Hashing.sha256(png).equals(original.get("referenceSha256"))) throw error(409, "ASSET_REQUEST_CHANGED");
                return view(existing.get()); // repeated HTTP request never consumes credits twice
            }
            if (meshy == null || !meshy.available()) throw error(503, "MESHY_UNAVAILABLE");
            if (jobs.findTop20ByTypeAndStatusInOrderByQueuedAtAsc(PipelineJobType.ROOM_ASSET_GENERATION,
                    List.of(PipelineJobStatus.PENDING, PipelineJobStatus.RUNNING, PipelineJobStatus.RENDERING)).size() >= 20) throw error(429, "ASSET_QUEUE_FULL");
            var block = WardrobeCreatorService.BLOCKS.stream().filter(b -> b.moldId().equals(c.moldId())).findFirst().orElseThrow();
            if (WardrobeCreatorService.LEVELS.indexOf(c.requiredLevel()) < WardrobeCreatorService.LEVELS.indexOf(block.minLevel())) throw error(400, "ASSET_LEVEL_INVALID");
            PipelineJob j = new PipelineJob(owner, PipelineJobType.ROOM_ASSET_GENERATION, "ROOM_ASSET", c.requestId());
            j.setProvider("meshy");
            String key = "room-assets/" + owner.getId() + "/" + c.requestId() + "/reference.png";
            String url = storage.put(key, png, "image/png").url();
            var in = new LinkedHashMap<String, Object>();
            in.put("command", c); in.put("referenceSha256", br.com.fashionai.application.common.Hashing.sha256(png)); in.put("referenceKey", key); in.put("referenceUrl", url);
            j.setInputJson(Json.write(in)); j.setResultJson(Json.write(Map.of("review", "PENDING", "progress", 0)));
            return view(jobs.saveAndFlush(j));
        });
    }

    public Map<String, Object> review(CurrentUser user, UUID id, boolean approve) {
        guard.requireAdmin(user); guard.requireCanCreate(user);
        return tx.execute(s -> {
            PipelineJob j = locked(id);
            var result = new LinkedHashMap<>(Json.map(j.getResultJson()));
            if (result.containsKey("sku")) throw error(409, "ASSET_ALREADY_PUBLISHED");
            if (j.getStatus() != PipelineJobStatus.COMPLETED || j.getOutputUrl() == null) throw error(409, "ASSET_NOT_READY");
            result.put("review", approve ? "APPROVED" : "REJECTED");
            result.put("reviewedBy", user.id()); result.put("reviewedAt", Instant.now());
            j.setResultJson(Json.write(result)); jobs.save(j); return view(j);
        });
    }

    public Map<String, Object> publish(CurrentUser user, UUID id) {
        guard.requireAdmin(user); guard.requireCanCreate(user);
        return tx.execute(s -> {
            PipelineJob j = locked(id); var result = new LinkedHashMap<>(Json.map(j.getResultJson()));
            if (result.containsKey("sku")) return view(j);
            if (j.getStatus() != PipelineJobStatus.COMPLETED || !"APPROVED".equals(result.get("review"))) throw error(409, "ASSET_REVIEW_REQUIRED");
            Map<String, Object> in = Json.map(j.getInputJson());
            Map<?, ?> c = (Map<?, ?>) in.get("command");
            RoomCatalogItem item = new RoomCatalogItem();
            item.setSku("MESHY-" + j.getId().toString().replace("-", ""));
            item.setName(String.valueOf(c.get("name"))); item.setSlotType(String.valueOf(c.get("slotType")));
            item.setMoldId(String.valueOf(c.get("moldId"))); item.setWidthCm(((Number)c.get("widthCm")).intValue());
            item.setPricePoints(((Number)c.get("pricePoints")).intValue()); item.setRequiredLevel(String.valueOf(c.get("requiredLevel")));
            item.setDescription(c.get("description") == null ? null : String.valueOf(c.get("description")));
            item.setRarity("BASICO"); item.setActive(true); item.setKind("COMPONENT");
            item.setArtUrl(String.valueOf(in.get("referenceUrl")));
            item.setFinishJson(Json.write(Map.of("model3dUrl", j.getOutputUrl(), "assetJobId", j.getId(),
                    "provider", "meshy", "referenceUrl", in.get("referenceUrl"), "color", "#EDE6DA")));
            catalog.saveAndFlush(item);
            result.put("sku", item.getSku()); result.put("publishedBy", user.id()); result.put("publishedAt", Instant.now());
            j.setResultJson(Json.write(result)); jobs.save(j); return view(j);
        });
    }

    @Scheduled(fixedDelayString = "${fashionai.ai.room-assets-poll-ms:10000}", initialDelay = 15000)
    public void tick() {
        if (meshy == null || !meshy.available()) return;
        for (PipelineJob candidate : jobs.findTop20ByTypeAndStatusInOrderByQueuedAtAsc(PipelineJobType.ROOM_ASSET_GENERATION,
                List.of(PipelineJobStatus.PENDING, PipelineJobStatus.RUNNING, PipelineJobStatus.RENDERING))) {
            UUID token = UUID.randomUUID();
            PipelineJob claimed = tx.execute(s -> claim(candidate.getId(), token));
            if (claimed == null) continue;
            try {
                if (claimed.getStatus() == PipelineJobStatus.RENDERING) {
                    String key = String.valueOf(Json.map(claimed.getInputJson()).get("referenceKey"));
                    Optional<String> external = meshy.submit(storage.get(key));
                    finish(claimed.getId(), token, j -> {
                        if (external.isEmpty()) fail(j, "MESHY_SUBMISSION_UNCONFIRMED");
                        else { j.setExternalJobId(external.get()); j.setStatus(PipelineJobStatus.RUNNING); }
                    });
                } else {
                    var status = meshy.poll(claimed.getExternalJobId());
                    if (status.isEmpty()) { finish(claimed.getId(), token, j -> {}); continue; }
                    var st = status.get();
                    if ("SUCCEEDED".equals(st.state())) {
                        byte[] glb = web.get(st.glbUrl(), MAX_GLB, null).map(WebFetchPort.Fetched::body).orElseThrow();
                        validateGlb(glb);
                        // Deterministic key makes download retries harmless; the provider task is NEVER resubmitted.
                        String key = "room-assets/models/" + claimed.getId() + ".glb";
                        String url = storage.put(key, glb, "model/gltf-binary").url();
                        finish(claimed.getId(), token, j -> {
                            j.setOutputUrl(url); j.setStatus(PipelineJobStatus.COMPLETED); j.setFinishedAt(Instant.now());
                            var r = new LinkedHashMap<>(Json.map(j.getResultJson())); r.put("progress", 100); r.put("bytes", glb.length); j.setResultJson(Json.write(r));
                        });
                    } else finish(claimed.getId(), token, j -> {
                        if ("FAILED".equals(st.state())) fail(j, "MESHY_GENERATION_FAILED");
                        else { var r = new LinkedHashMap<>(Json.map(j.getResultJson())); r.put("progress", Math.clamp(st.progress(), 0, 99)); j.setResultJson(Json.write(r)); }
                    });
                }
            } catch (RuntimeException ex) {
                finish(claimed.getId(), token, j -> {
                    // A lost submit response may already have incurred credits. Do NOT automatically resubmit.
                    if (j.getStatus() == PipelineJobStatus.RENDERING) fail(j, "MESHY_SUBMISSION_UNCONFIRMED");
                    else { j.setRetryCount(j.getRetryCount() + 1); if (j.getRetryCount() >= 6) fail(j, "ASSET_DOWNLOAD_OR_POLL_FAILED"); }
                });
            }
        }
    }

    private PipelineJob claim(UUID id, UUID token) {
        PipelineJob j = locked(id); Instant now = Instant.now();
        if (!List.of(PipelineJobStatus.PENDING, PipelineJobStatus.RUNNING, PipelineJobStatus.RENDERING).contains(j.getStatus())) return null;
        var r = new LinkedHashMap<>(Json.map(j.getResultJson()));
        if (r.get("leaseUntil") instanceof String until && Instant.parse(until).isAfter(now)) return null;
        if (j.getStatus() == PipelineJobStatus.RENDERING) { fail(j, "MESHY_SUBMISSION_UNCONFIRMED"); jobs.save(j); return null; }
        if (j.getStartedAt() != null && j.getStartedAt().plus(TIMEOUT).isBefore(now)) { fail(j, "MESHY_TIMEOUT"); jobs.save(j); return null; }
        if (j.getStatus() == PipelineJobStatus.PENDING) { j.setStatus(PipelineJobStatus.RENDERING); j.setStartedAt(now); j.setAttempts(j.getAttempts() + 1); }
        r.put("lease", token.toString()); r.put("leaseUntil", now.plus(LEASE).toString());
        j.setResultJson(Json.write(r)); jobs.saveAndFlush(j); return j;
    }

    private void finish(UUID id, UUID token, java.util.function.Consumer<PipelineJob> change) {
        tx.executeWithoutResult(s -> {
            PipelineJob j = locked(id); var r = Json.map(j.getResultJson());
            if (!token.toString().equals(r.get("lease"))) return;
            change.accept(j); r = new LinkedHashMap<>(Json.map(j.getResultJson())); r.remove("lease"); r.remove("leaseUntil");
            j.setResultJson(Json.write(r)); jobs.save(j);
        });
    }

    private PipelineJob locked(UUID id) {
        PipelineJob j = jobs.findByIdForUpdate(id).orElseThrow(() -> error(404, "ASSET_NOT_FOUND"));
        if (j.getType() != PipelineJobType.ROOM_ASSET_GENERATION) throw error(404, "ASSET_NOT_FOUND");
        return j;
    }
    private static void fail(PipelineJob j, String reason) { j.setStatus(PipelineJobStatus.FAILED); j.setErrorCode(reason); j.setFinishedAt(Instant.now()); }
    private static ApiException error(int code, String reason) { return new ApiException(code, reason, br.com.fashionai.application.common.Msg.t("roomAssets.error")); }
    private Map<String, Object> view(PipelineJob j) {
        var v = new LinkedHashMap<String, Object>(); v.put("id", j.getId()); v.put("status", j.getStatus());
        v.put("input", Json.map(j.getInputJson())); v.put("result", Json.map(j.getResultJson()));
        v.put("modelUrl", j.getOutputUrl()); v.put("errorCode", j.getErrorCode()); v.put("createdAt", j.getQueuedAt()); return v;
    }

    /** Self-contained GLB only: never publish a model referencing local files or a third party texture URL. */
    static void validateGlb(byte[] b) {
        if (b == null || b.length < 24 || b.length > MAX_GLB) throw error(422, "INVALID_GLB");
        ByteBuffer bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN);
        if (bb.getInt() != 0x46546C67 || bb.getInt() != 2 || bb.getInt() != b.length) throw error(422, "INVALID_GLB");
        int size = bb.getInt(), type = bb.getInt();
        if (size <= 0 || size % 4 != 0 || size > b.length - 20 || type != 0x4E4F534A) throw error(422, "INVALID_GLB");
        Map<String, Object> json = Json.map(new String(b, 20, size, StandardCharsets.UTF_8));
        if (!(json.get("asset") instanceof Map<?, ?> asset) || !"2.0".equals(asset.get("version")) || !(json.get("meshes") instanceof List<?> meshes) || meshes.isEmpty()) throw error(422, "INVALID_GLB");
        for (String k : List.of("buffers", "images")) if (json.get(k) instanceof List<?> list)
            for (Object item : list) if (item instanceof Map<?, ?> m && m.get("uri") != null && !String.valueOf(m.get("uri")).startsWith("data:")) throw error(422, "GLB_EXTERNAL_RESOURCE");
        bb.position(20 + size);
        while (bb.hasRemaining()) { if (bb.remaining() < 8) throw error(422, "INVALID_GLB"); int n = bb.getInt(); bb.getInt(); if (n < 0 || n % 4 != 0 || n > bb.remaining()) throw error(422, "INVALID_GLB"); bb.position(bb.position() + n); }
    }
}
