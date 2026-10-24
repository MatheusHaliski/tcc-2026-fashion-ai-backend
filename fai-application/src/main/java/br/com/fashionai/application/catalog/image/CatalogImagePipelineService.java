package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Worker e operação do pipeline de imagens da Busca Catalogada (docs/catalogo/PIPELINE_IMAGENS_CATALOGO.md).
 * Ligado por padrão ({@code fashionai.catalog.image-pipeline.enabled}); cada tick pega um lote de imagens PENDING
 * (ou de versão anterior do pipeline), baixa com o {@link WebFetchPort} (só https, só IP público, redirecionamento
 * revalidado a cada salto, limite de bytes), roda o {@link CatalogImagePipeline} e grava só metadados — ou, quando a
 * fonte permite persistência, também o master no storage. Depois reclassifica as fotos do produto e escolhe a canônica.
 */
@Service
public class CatalogImagePipelineService {
    private static final Logger log = LoggerFactory.getLogger(CatalogImagePipelineService.class);
    static final Set<String> DONE = Set.of("APPROVED", "NEEDS_REPROCESSING", "REJECTED");
    public static final Set<String> ACTIONS = Set.of("APPROVE", "REPROCESS", "SELECT_ALTERNATE_IMAGE", "REJECT");

    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final CatalogSourceRepository sources;
    private final WebFetchPort web;
    private final MediaStoragePort storage;
    private final Guard guard;
    private final TransactionTemplate tx;
    private final CatalogImagePipeline pipeline;
    private final ImageCandidateRanker ranker = new ImageCandidateRanker();
    private final boolean enabled;
    private final int batch;
    private final int maxAttempts;

    public CatalogImagePipelineService(CatalogImageRepository images, CatalogProductRepository products, CatalogSourceRepository sources,
                                       WebFetchPort web, MediaStoragePort storage, Guard guard, TransactionTemplate tx,
                                       ObjectProvider<PersonSegmentationPort> persons,
                                       @Value("${fashionai.catalog.image-pipeline.enabled:true}") boolean enabled,
                                       @Value("${fashionai.catalog.image-pipeline.batch:8}") int batch,
                                       @Value("${fashionai.catalog.image-pipeline.max-attempts:3}") int maxAttempts) {
        this.images = images;
        this.products = products;
        this.sources = sources;
        this.web = web;
        this.storage = storage;
        this.guard = guard;
        this.tx = tx;
        this.pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), persons.getIfAvailable());
        this.enabled = enabled;
        this.batch = Math.min(32, Math.max(1, batch));
        this.maxAttempts = Math.max(1, maxAttempts);
    }

    @Scheduled(fixedDelayString = "${fashionai.catalog.image-pipeline.poll-ms:15000}", initialDelay = 20000)
    public void tick() {
        if (!enabled) {
            return;
        }
        for (UUID id : claim(batch)) {
            try {
                process(id);
            } catch (RuntimeException e) {
                log.warn("event=catalog_image_failed imageId={} error={}", id, e.getClass().getSimpleName());
                tx.executeWithoutResult(s -> images.findById(id).ifPresent(i -> {
                    i.setProcessingStatus("FAILED");
                    i.setGateReasons("PIPELINE_ERROR");
                    images.save(i);
                }));
            }
        }
    }

    /** Marca o lote como DOWNLOADING numa transação curta (um tick não pega o que outro já pegou). */
    List<UUID> claim(int size) {
        List<UUID> ids = tx.execute(s -> {
            List<UUID> out = new ArrayList<>();
            for (CatalogImage i : images.pipelineQueue(CatalogImagePipeline.VERSION, maxAttempts,
                    Instant.now().minus(java.time.Duration.ofMinutes(15)), PageRequest.of(0, size))) {
                i.setProcessingStatus("DOWNLOADING");
                i.setAttempts(i.getAttempts() + 1);
                images.save(i);
                out.add(i.getId());
            }
            return out;
        });
        return ids == null ? List.of() : ids;
    }

    /** Uma imagem: download seguro → cache por hash → pipeline → metadados (+ master no nível B) → canônica do produto. */
    public void process(UUID imageId) {
        CatalogImage img = images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image"));
        CatalogProduct product = products.findById(img.getProductId()).orElse(null);
        Map<String,Object> sourceGate = photoSet(img,product);
        if (Set.of("REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(sourceGate.get("status")))) {
            finish(img,"NEEDS_REPROCESSING",List.of("SOURCE_PREFLIGHT_REVIEW_REQUIRED"),null);
            img.setReviewStatus("PENDING"); images.save(img); return;
        }
        if ("READY".equals(sourceGate.get("status"))) return;
        long t0 = System.nanoTime();
        Optional<WebFetchPort.Fetched> fetched = web.get(img.getImageUrl(), (int) ImageOps.MAX_UPLOAD_BYTES, "image/");
        if (fetched.isEmpty()) {
            finish(img, "FAILED", List.of("FETCH_FAILED"), null);
            log.info("event=catalog_image_processed imageId={} productId={} status=FAILED reason=FETCH_FAILED", img.getId(), img.getProductId());
            return;
        }
        byte[] bytes = fetched.get().body();
        String sha = CatalogImagePipeline.sha256(bytes);
        boolean persist = product != null && allowsPersistence(product, img);
        Optional<CatalogImage> cached = persist ? Optional.empty()
                : images.findFirstBySourceSha256AndPipelineVersionAndProcessingStatusIn(sha, CatalogImagePipeline.VERSION, DONE)
                .filter(c -> !c.getId().equals(img.getId()))
                .filter(c -> sameContext(c, img, product));
        if (cached.isPresent()) {
            copyAnalysis(cached.get(), img);
            rememberPreview(product, img, null, null, false);
        } else {
            CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(bytes,
                    product == null ? null : product.getCategory(), product == null ? null : product.getSubcategory(),
                    img.getImageType() == null ? null : img.getImageType().name(), persist));
            apply(img, a, persist);
            rememberPreview(product, img, a, bytes, persist);
        }
        tx.executeWithoutResult(s -> {
            images.save(img);
            rerank(img.getProductId());
        });
        log.info("event=catalog_image_processed imageId={} productId={} status={} quality={} reasons={} persisted={} cached={} ms={} version={}",
                img.getId(), img.getProductId(), img.getProcessingStatus(), img.getQualityScore(), img.getGateReasons(), persist,
                cached.isPresent(), (System.nanoTime() - t0) / 1_000_000, CatalogImagePipeline.VERSION);
    }

    /** Cached automatic display framing. Striped locks bound memory and serialize duplicate requests. */
    private final Object[] previewLocks = java.util.stream.IntStream.range(0, 32).mapToObj(i -> new Object()).toArray();
    private final java.util.concurrent.Semaphore previewCapacity = new java.util.concurrent.Semaphore(2);

    public void ensurePreview(CurrentUser user, UUID productId) {
        ensurePreview(user, productId, false);
    }

    public record TexturePhoto(byte[] bytes, String mime) { }

    /** Authenticated transport for the approved original, not the display fabric crop or an arbitrary URL. */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId) {
        return texturePhoto(user, productId, false);
    }

    /** isolated=true never falls back to an unsegmented catalogue/model photograph. */
    public TexturePhoto texturePhoto(CurrentUser user, UUID productId, boolean isolated) {
        guard.requireCanCreate(user);
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product))
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        CatalogImage selected = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i -> (i.isCanonical() && "APPROVED".equals(i.getProcessingStatus()) || "READY".equals(photoSet(i,product).get("status")))
                        && i.getUsageStatus() != CatalogImageUsage.REJECTED && !"REJECTED".equals(i.getReviewStatus()))
                .filter(i -> !Set.of("REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(photoSet(i,product).get("status"))))
                .sorted(java.util.Comparator.comparing(i -> !"READY".equals(photoSet(i,product).get("status"))))
                .findFirst().orElseThrow(() -> ApiException.notFound("catalog image"));
        Map<String,Object> cleaned=photoSet(selected,product);
        if("DEFAULT".equals(cleaned.get("status"))) throw new ApiException(422,"CATALOG_PHOTO_DEFAULT_ONLY","A peça usa uma ilustração padrão.");
        if("READY".equals(cleaned.get("status")) && allowsPersistence(product,selected)) {
            Optional<String> key=storage.keyOf((String)cleaned.get("wholeUrl"));
            if(key.isPresent()) { byte[] data=storage.get(key.get()); return new TexturePhoto(data,ImageOps.requireAcceptedImage(data)); }
        }
        if (isolated) throw new ApiException(422,"CATALOG_ISOLATED_PHOTO_UNAVAILABLE","Foto isolada ainda não disponível.");
        if (allowsPersistence(product, selected) && currentPreview(product, selected, true)
                && previewAssets(selected).get("whole") instanceof Map<?, ?> whole && whole.get("url") instanceof String url) {
            try {
                Optional<String> key = storage.keyOf(url);
                if (key.isPresent()) {
                    byte[] bytes = storage.get(key.get());
                    return new TexturePhoto(bytes, ImageOps.requireAcceptedImage(bytes));
                }
            } catch (RuntimeException missing) { /* Recover from the approved original; never use the fabric crop. */ }
        }
        WebFetchPort.Fetched fetched = web.get(selected.getImageUrl(), (int) ImageOps.MAX_UPLOAD_BYTES, "image/")
                .orElseThrow(() -> new ApiException(422, "CATALOG_IMAGE_FETCH_FAILED", "Não foi possível carregar a foto desta peça."));
        return new TexturePhoto(fetched.body(), ImageOps.requireAcceptedImage(fetched.body()));
    }

    /** An explicit retry rechecks this product's original/alternative photos, without discarding the last valid frame. */
    public void ensurePreview(CurrentUser user, UUID productId, boolean force) {
        guard.requireCanCreate(user);
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product))
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        synchronized (previewLocks[Math.floorMod(productId.hashCode(), previewLocks.length)]) {
            boolean ready = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                    .filter(i -> i.isCanonical() && i.getUsageStatus() != CatalogImageUsage.REJECTED && !"REJECTED".equals(i.getReviewStatus()))
                    .anyMatch(i -> currentPreview(product, i, allowsPersistence(product, i))
                            && "READY".equals(previewAssets(i).get("status")));
            boolean cleaned=images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream().filter(CatalogImage::isCanonical)
                .map(i -> photoSet(i,product)).anyMatch(m -> "READY".equals(m.get("status")) || "DEFAULT".equals(m.get("status")));
            if ((ready || cleaned) && !force) return;
            if (!previewCapacity.tryAcquire()) throw new ApiException(429, "CATALOG_PREVIEW_BUSY", "Enquadramento em andamento. Tente novamente.");
            try { verifySelection(user, productId); } finally { previewCapacity.release(); }
        }
    }

    /** Apply the same product framing rule as the worker, using another photo of this product if needed. */
    public void verifySelection(CurrentUser user, UUID productId) {
        guard.requireCanCreate(user);
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product)) {
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        }
        List<CatalogImage> candidates = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i -> i.getUsageStatus() != CatalogImageUsage.REJECTED && !"REJECTED".equals(i.getReviewStatus()))
                .filter(i -> i.getImageUrl() != null && !i.getImageUrl().isBlank())
                .filter(i -> !Set.of("REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(photoSet(i,product).get("status"))))
                .sorted(java.util.Comparator.comparing((CatalogImage i) -> !i.isCanonical()))
                .limit(3).toList();
        if (candidates.isEmpty()) throw new ApiException(422, "CATALOG_IMAGE_MISSING", "Esta peça não tem foto disponível para verificar.");
        boolean downloaded = false;
        for (CatalogImage image : candidates) {
            Optional<WebFetchPort.Fetched> fetched = web.get(image.getImageUrl(), (int) ImageOps.MAX_UPLOAD_BYTES, "image/");
            if (fetched.isEmpty()) continue;
            downloaded = true;
            boolean persist = allowsPersistence(product, image);
            CatalogImagePipeline.Analysis analysis = pipeline.run(new CatalogImagePipeline.Request(fetched.get().body(),
                    product.getCategory(), product.getSubcategory(), image.getImageType() == null ? null : image.getImageType().name(), persist));
            Object value = analysis.debug().get("productFrame");
            if (!(value instanceof Map<?, ?> frame) || !Boolean.TRUE.equals(frame.get("ok")) || !(frame.get("crop") instanceof Map<?, ?>)) {
                continue;
            }
            Map<String, Object> crop = new LinkedHashMap<>(analysis.cropJson());
            crop.put("crop", frame.get("crop"));
            crop.put("aspect", "3:4");
            crop.put("ruleCompliant", true);
            for (String stale : List.of("rule", "detail", "padding")) crop.remove(stale);
            crop.put("selectionFrame", Map.of("version", ProductRuleFrame.VERSION, "target", frame.get("target"),
                    "verifiedAt", Instant.now().toString(), "sourceSha256", analysis.sha256()));
            // Keep earlier assets intact. This fresh frame is applied to the source photograph by the card renderer.
            // It is also inherited by the wardrobe item when the user saves, without re-cropping an already cropped JPEG.
            tx.executeWithoutResult(status -> {
                image.setCropJson(Json.write(crop));
                image.setWidth(analysis.width()); image.setHeight(analysis.height());
                image.setSourceSha256(analysis.sha256());
                rememberPreview(product, image, analysis, fetched.get().body(), persist);
                image.setMetricsJson(metricsJson(analysis));
                image.setPipelineVersion(CatalogImagePipeline.VERSION);
                image.setProcessedAt(Instant.now());
                image.setProcessingStatus("APPROVED");
                image.setQualityScore(qualityScore(analysis.qualityScore()));
                image.setCanonical(true);
                for (CatalogImage other : images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId)) {
                    if (!other.getId().equals(image.getId()) && other.isCanonical()) { other.setCanonical(false); images.save(other); }
                }
                images.save(image);
            });
            return;
        }
        if (!downloaded) throw new ApiException(422, "CATALOG_IMAGE_FETCH_FAILED", "Não foi possível verificar as fotos desta peça. Tente novamente.");
        throw new ApiException(422, "CATEGORY_FRAME_UNAVAILABLE", "As fotos disponíveis não permitem o enquadramento desta categoria. Escolha outra foto ou use sua própria foto.");
    }

    public static final String PREVIEW_CACHE_VERSION = "CATALOG_PREVIEW_FRAMES_V2";

    private static String previewContext(CatalogProduct product, CatalogImage image, boolean persist) {
        return CatalogImagePipeline.sha256(String.join("\n", PREVIEW_CACHE_VERSION, CatalogImagePipeline.VERSION,
                ProductRuleFrame.VERSION, Objects.toString(product == null ? null : product.getCategory(), ""),
                Objects.toString(product == null ? null : product.getSubcategory(), ""),
                Objects.toString(image.getImageType(), ""), Boolean.toString(persist)));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> previewAssets(CatalogImage image) {
        if (image == null || image.getAssetsJson() == null) return Map.of();
        Object value = Json.map(image.getAssetsJson()).get("previewFrames");
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private static boolean currentPreviewSource(CatalogImage image) {
        Map<String, Object> preview = previewAssets(image);
        return PREVIEW_CACHE_VERSION.equals(preview.get("version"))
                && Objects.equals(image.getImageUrl(), preview.get("sourceUrl"))
                && image.getSourceSha256() != null && Objects.equals(image.getSourceSha256(), preview.get("sourceSha256"));
    }

    private static boolean currentPreview(CatalogProduct product, CatalogImage image, boolean persist) {
        return currentPreviewSource(image) && Objects.equals(previewContext(product, image, persist), previewAssets(image).get("contextHash"));
    }

    /** Persist stable derivatives once; reference-only sources keep URLs and framing metadata without copying bytes. */
    private void rememberPreview(CatalogProduct product, CatalogImage image, CatalogImagePipeline.Analysis analysis, byte[] source, boolean persist) {
        Map<String, Object> crop = image.getCropJson() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(Json.map(image.getCropJson()));
        Map<?, ?> frame = analysis != null && analysis.debug().get("productFrame") instanceof Map<?, ?> f ? f : Map.of();
        if (analysis != null) {
            if (!Boolean.TRUE.equals(frame.get("ok")) || !(frame.get("crop") instanceof Map<?, ?>)) return;
            crop.put("crop", frame.get("crop")); crop.put("aspect", "3:4"); crop.put("ruleCompliant", true);
            if (!crop.containsKey("selectionFrame")) crop.put("selectionFrame", Map.of("version", ProductRuleFrame.VERSION, "sourceSha256", analysis.sha256(), "automatic", true));
            image.setCropJson(Json.write(crop));
        } else if (!Boolean.TRUE.equals(crop.get("ruleCompliant")) || !(crop.get("crop") instanceof Map<?, ?>)) return;
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("version", PREVIEW_CACHE_VERSION);
        preview.put("sourceUrl", image.getImageUrl()); preview.put("sourceSha256", image.getSourceSha256());
        preview.put("contextHash", previewContext(product, image, persist));
        preview.put("status", "READY"); preview.put("persisted", persist); preview.put("generatedAt", Instant.now().toString());
        if (persist && analysis != null) {
            CatalogPreviewRenderer.Frames frames = analysis.previewFrames();
            java.awt.image.BufferedImage fabric = frames == null ? CatalogPreviewRenderer.fabricFrom(source, frame) : frames.fabric();
            if (fabric == null) return;
            String key = "catalog/previews/" + image.getProductId() + "/" + image.getId() + "/"
                    + preview.get("contextHash") + "/" + analysis.sha256() + "/";
            preview.put("fabricUrl", put(key + "fabric.jpg", ImageOps.jpeg(fabric, .92f), "image/jpeg"));
            image.setUsageStatus(CatalogImageUsage.PERSISTED);
            preview.put("width", fabric.getWidth()); preview.put("height", fabric.getHeight());
            Map<String,Object> selectedPhotoSet = photoSet(image,product);
            Object sourceMetrics = selectedPhotoSet.get("metrics");
            if (frames != null && frames.whole() != null && sourceMetrics instanceof Map<?,?> verifiedMetrics
                    && validPreflight(verifiedMetrics.get("preflight"))) {
                String wholeUrl = put(key + "whole.png", ImageOps.png(frames.whole()), "image/png");
                Map<String, Object> whole = new LinkedHashMap<>(frames.wholeMetadata());
                whole.put("url", wholeUrl); whole.put("rendered", true); whole.put("processed", true);
                preview.put("whole", whole); preview.put("wholeStatus", "READY");
                image.setWholeUrl(wholeUrl); image.setWholeJson(Json.write(whole)); image.setWholeStatus("DONE");
                image.setWholePipelineVersion(CatalogPreviewRenderer.VERSION);
            } else {
                preview.put("wholeStatus", "UNAVAILABLE");
                preview.put("wholeUnavailableReason", frames == null ? "MISSING_SEGMENTATION" : frames.wholeUnavailableReason());
            }
        } else {
            preview.put("wholeStatus", "REFERENCE_ONLY");
        }
        Map<String, Object> assets = image.getAssetsJson() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(Json.map(image.getAssetsJson()));
        // A successful explicit retry may replace a prior DEFAULT-only verdict.
        // Keep it on errors or partial frames; only two persisted masked views qualify.
        if (persist && preview.get("whole") instanceof Map<?, ?> whole && Boolean.TRUE.equals(whole.get("rendered"))
                && assets.get("photoSet") instanceof Map<?, ?> previous && "DEFAULT".equals(previous.get("status")))
            assets.remove("photoSet");
        assets.put("previewFrames", preview); image.setAssetsJson(Json.write(assets));
    }

    /**
     * O pipeline usa categoria, subcategoria e tipo de vista para decidir peça, foco, recorte e detailView: os mesmos
     * bytes em outro contexto não podem herdar a análise — sem contexto igual, roda o pipeline de novo.
     */
    boolean sameContext(CatalogImage cached, CatalogImage img, CatalogProduct product) {
        if (cached.getImageType() != img.getImageType()) {
            return false;
        }
        if (cached.getProductId() != null && cached.getProductId().equals(img.getProductId())) {
            return true;
        }
        CatalogProduct other = cached.getProductId() == null ? null : products.findById(cached.getProductId()).orElse(null);
        String category = product == null ? null : product.getCategory(), subcategory = product == null ? null : product.getSubcategory();
        return other == null ? category == null && subcategory == null
                : Objects.equals(other.getCategory(), category) && Objects.equals(other.getSubcategory(), subcategory);
    }

    void apply(CatalogImage img, CatalogImagePipeline.Analysis a, boolean persist) {
        img.setMime(a.mime());
        img.setWidth(dimension(a.width()));
        img.setHeight(dimension(a.height()));
        img.setSourceSha256(a.sha256());
        img.setPhash(a.phash());
        img.setCropJson(automaticFrame(a, persist));
        img.setMetricsJson(metricsJson(a));
        if (persist && a.rendered() != null && a.outcome() != CatalogImageValidator.Outcome.REJECTED) {
            Map<String, Object> assets = store(img, a.rendered());
            img.setAssetsJson(Json.write(assets));
            img.setStoredUrl(String.valueOf(assets.get("master")));
            img.setUsageStatus(CatalogImageUsage.PERSISTED);
        }
        finish(img, a.outcome().name(), a.reasons(), a.qualityScore());
    }

    /**
     * O worker aplica a regra editorial assim que a foto chega ao catálogo. A UI somente lê o
     * resultado; ela não deve precisar de uma ação da pessoa para enquadrar uma foto já analisada.
     */
    @SuppressWarnings("unchecked")
    String automaticFrame(CatalogImagePipeline.Analysis analysis, boolean persist) {
        Map<String, Object> crop = new LinkedHashMap<>(analysis.cropJson());
        // No nível B, o card persistido já é a saída enquadrada do pipeline e mantém sua proporção de renderização.
        if (persist) {
            return crop.isEmpty() ? null : Json.write(crop);
        }
        Object value = analysis.debug().get("productFrame");
        if (!(value instanceof Map<?, ?> frame) || !Boolean.TRUE.equals(frame.get("ok"))
                || !(frame.get("crop") instanceof Map<?, ?>)) {
            return crop.isEmpty() ? null : Json.write(crop);
        }
        crop.put("crop", frame.get("crop"));
        crop.put("aspect", frame.get("aspect") == null ? "3:4" : frame.get("aspect"));
        crop.put("ruleCompliant", true);
        crop.remove("detail");
        crop.remove("padding");
        Map<String, Object> framing = new LinkedHashMap<>();
        framing.put("version", frame.get("version"));
        framing.put("target", frame.get("target"));
        framing.put("focus", frame.get("focus"));
        framing.put("automatic", true);
        framing.put("processedAt", Instant.now().toString());
        framing.put("sourceSha256", analysis.sha256());
        crop.put("selectionFrame", framing);
        return Json.write(crop);
    }

    private void finish(CatalogImage img, String status, List<String> reasons, Double quality) {
        img.setProcessingStatus(status);
        img.setGateReasons(gateReasons(reasons));
        img.setQualityScore(qualityScore(quality));
        img.setPipelineVersion(CatalogImagePipeline.VERSION);
        img.setProcessedAt(Instant.now());
        if ("NEEDS_REPROCESSING".equals(status) && !"APPROVED".equals(img.getReviewStatus())) {
            img.setReviewStatus("PENDING");
        }
        if ("FAILED".equals(status)) {
            images.save(img);
        }
    }

    // ── colunas do nível A: o que apply()/finish() gravam a partir da Analysis; também usadas pelo
    //    CatalogImageBatchCli (lote local), para o lote gravar no banco exatamente o que a API gravaria ──

    /** width/height: 0 (foto rejeitada antes do decode) vira NULL. */
    public static Integer dimension(int px) {
        return px == 0 ? null : px;
    }

    /** crop_json: recorte 4:5 em coordenadas normalizadas da foto original; NULL quando não houve REFRAMING. */
    public static String cropJson(CatalogImagePipeline.Analysis a) {
        return a.crop() == null ? null : Json.write(a.cropJson());
    }

    /** metrics_json: métricas do QUALITY CHECK + tipo de peça, detalhe, confiança, revisão, estágios e depuração. */
    public static String metricsJson(CatalogImagePipeline.Analysis a) {
        Map<String, Object> metrics = new LinkedHashMap<>(a.metrics());
        metrics.put("pieceType", a.pieceType() == null ? null : a.pieceType().name());
        metrics.put("detailView", a.detailView());
        metrics.put("confidence", a.confidence());
        metrics.put("manualReview", a.manualReview());
        metrics.put("stages", a.stages().stream().map(CatalogImagePipeline.Stage::toMap).toList());
        metrics.put("debug", a.debug());
        return Json.write(metrics);
    }

    /** gate_reasons: motivos separados por vírgula, cortados em 500 caracteres (tamanho da coluna); NULL sem motivo. */
    public static String gateReasons(List<String> reasons) {
        if (reasons.isEmpty()) {
            return null;
        }
        String joined = String.join(",", reasons);
        return joined.substring(0, Math.min(500, joined.length()));
    }

    /** quality_score: DECIMAL com 4 casas, arredondamento HALF_UP. */
    public static BigDecimal qualityScore(Double quality) {
        return quality == null ? null : BigDecimal.valueOf(quality).setScale(4, RoundingMode.HALF_UP);
    }

    /** Mesmo conteúdo em outra URL: reaproveita a análise (sourceImageHash), sem baixar o pipeline de novo. */
    static void copyAnalysis(CatalogImage from, CatalogImage to) {
        to.setMime(from.getMime());
        to.setWidth(from.getWidth());
        to.setHeight(from.getHeight());
        to.setSourceSha256(from.getSourceSha256());
        to.setPhash(from.getPhash());
        to.setCropJson(from.getCropJson());
        to.setMetricsJson(from.getMetricsJson());
        to.setQualityScore(from.getQualityScore());
        to.setGateReasons(from.getGateReasons());
        to.setProcessingStatus(from.getProcessingStatus());
        to.setPipelineVersion(CatalogImagePipeline.VERSION);
        to.setProcessedAt(Instant.now());
        if ("NEEDS_REPROCESSING".equals(to.getProcessingStatus())) {
            to.setReviewStatus("PENDING");
        }
    }

    /** Nível B só quando a fonte oficial do domínio da foto declara allows_image_persistence (RN47.03). */
    boolean allowsPersistence(CatalogProduct product, CatalogImage img) {
        String host = host(img.getImageUrl());
        for (CatalogSource s : sources.findByBrandIdAndActiveTrue(product.getBrandId())) {
            if (!s.isAllowsImagePersistence() || s.getDomain() == null) {
                continue;
            }
            String d = s.getDomain().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "").replaceAll("\\.+$", "");
            if ((host != null && (host.equals(d) || host.endsWith("." + d)))) {
                return true;
            }
        }
        return false;
    }

    static String host(String url) {
        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            String h = uri.getHost();
            return h == null ? null : h.toLowerCase(Locale.ROOT).replaceAll("\\.+$", "");
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Map<String, Object> store(CatalogImage img, BackgroundNormalizer.Rendered r) {
        String base = "catalog/" + img.getProductId() + "/" + img.getId() + "/" + CatalogImagePipeline.VERSION.toLowerCase(Locale.ROOT) + "/";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("master", put(base + "master.png", ImageOps.png(r.transparent()), "image/png"));
        out.put("white", put(base + "white.jpg", ImageOps.jpeg(r.white(), 0.92f), "image/jpeg"));
        out.put("neutral", put(base + "neutral.jpg", ImageOps.jpeg(r.neutral(), 0.92f), "image/jpeg"));
        out.put("card", put(base + "card.jpg", ImageOps.jpeg(r.card(), 0.9f), "image/jpeg"));
        out.put("thumbnail", put(base + "thumb.jpg", ImageOps.jpeg(r.thumbnail(), 0.85f), "image/jpeg"));
        out.put("width", r.width());
        out.put("height", r.height());
        return out;
    }

    private String put(String key, byte[] body, String type) {
        storage.put(key, body, type);
        return storage.publicUrl(key).toString();
    }

    /** Reclassifica as fotos do produto: canônica = melhor APROVADA de vista principal; detalhe nunca é master. */
    void rerank(UUID productId) {
        List<CatalogImage> all = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i -> DONE.contains(i.getProcessingStatus())).toList();
        if (all.isEmpty()) {
            return;
        }
        Map<String, CatalogImage> byId = new LinkedHashMap<>();
        List<ImageCandidateRanker.Candidate> cands = new ArrayList<>();
        for (CatalogImage i : all) {
            byId.put(i.getId().toString(), i);
            CatalogImageValidator.Outcome outcome = "APPROVED".equals(i.getReviewStatus()) ? CatalogImageValidator.Outcome.APPROVED
                    : "REJECTED".equals(i.getReviewStatus()) ? CatalogImageValidator.Outcome.REJECTED
                    : CatalogImageValidator.Outcome.valueOf(i.getProcessingStatus());
            Map<String, Object> m = i.getMetricsJson() == null ? Map.of() : Json.map(i.getMetricsJson());
            cands.add(new ImageCandidateRanker.Candidate(i.getId().toString(), i.getImageType() == null ? null : i.getImageType().name(),
                    outcome, i.getQualityScore() == null ? 0 : i.getQualityScore().doubleValue(), Boolean.TRUE.equals(m.get("detailView")),
                    i.getPhash()));
        }
        PieceType type = products.findById(productId).map(p -> PieceType.of(p.getCategory())).orElse(null);
        List<ImageCandidateRanker.Ranked> ranked = ranker.rank(cands, type);
        boolean manualCanonical = all.stream().anyMatch(i -> i.isCanonical() && "APPROVED".equals(i.getReviewStatus()));
        for (ImageCandidateRanker.Ranked r : ranked) {
            CatalogImage i = byId.get(r.candidate().id());
            i.setViewRole(r.role().name());
            if (!manualCanonical) {
                i.setCanonical(r.role() == ImageCandidateRanker.Role.CANONICAL);
            }
            images.save(i);
        }
    }

    // ── administração: CatalogImageReviewQueue, métricas e depuração visual ──

    public Map<String, Object> reviewQueue(CurrentUser user, int limit) {
        guard.requireAdmin(user);
        List<Map<String, Object>> items = images.findByReviewStatusOrderByProcessedAtAsc("PENDING", PageRequest.of(0, Math.min(100, Math.max(1, limit))))
                .stream().map(this::view).toList();
        return Map.of("items", items, "pending", images.countByReviewStatus("PENDING"), "actions", ACTIONS);
    }

    public record ReviewCommand(String action, UUID alternateImageId, String note) {
    }

    public Map<String, Object> decide(CurrentUser user, UUID imageId, ReviewCommand cmd) {
        guard.requireAdmin(user);
        String action = cmd == null || cmd.action() == null ? "" : cmd.action().toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(action)) {
            throw ApiException.badRequest("ACAO_INVALIDA", "Ação deve ser uma de " + ACTIONS);
        }
        return tx.execute(s -> {
            CatalogImage img = images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image"));
            switch (action) {
                case "APPROVE" -> {
                    img.setReviewStatus("APPROVED");
                    img.setProcessingStatus("APPROVED");
                }
                case "REJECT" -> {
                    img.setReviewStatus("REJECTED");
                    img.setProcessingStatus("REJECTED");
                    img.setCanonical(false);
                }
                case "REPROCESS" -> {
                    img.setReviewStatus("NONE");
                    img.setProcessingStatus("PENDING");
                    img.setAttempts(0);
                    img.setCanonical(false);
                }
                default -> {                                   // SELECT_ALTERNATE_IMAGE
                    if (cmd.alternateImageId() == null) {
                        throw ApiException.badRequest("ALTERNATIVA_OBRIGATORIA", "Informe alternateImageId (outra foto oficial do mesmo produto)");
                    }
                    CatalogImage alt = images.findById(cmd.alternateImageId()).orElseThrow(() -> ApiException.notFound("catalog image"));
                    if (!alt.getProductId().equals(img.getProductId())) {
                        throw ApiException.badRequest("ALTERNATIVA_DE_OUTRO_PRODUTO", "A foto alternativa precisa ser do mesmo produto");
                    }
                    images.findByProductIdOrderByPrimaryDescCreatedAtAsc(img.getProductId()).forEach(o -> {
                        o.setCanonical(false);
                        images.save(o);
                    });
                    img.setReviewStatus("REJECTED");
                    alt.setReviewStatus("APPROVED");
                    alt.setCanonical(true);
                    if (!DONE.contains(alt.getProcessingStatus())) {
                        alt.setProcessingStatus("APPROVED");
                    }
                    images.save(alt);
                }
            }
            images.save(img);
            rerank(img.getProductId());
            log.info("event=catalog_image_review imageId={} action={} admin={}", imageId, action, user.id());
            return view(img);
        });
    }

    public Map<String, Object> metrics(CurrentUser user) {
        guard.requireAdmin(user);
        Map<String, Object> byStatus = new LinkedHashMap<>();
        images.countByStatus().forEach(r -> byStatus.put(String.valueOf(r[0]), r[1]));
        List<Map<String, Object>> reasons = images.topReasons(PageRequest.of(0, 10)).stream()
                .map(r -> Map.<String, Object>of("reasons", String.valueOf(r[0]), "count", r[1])).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pipelineVersion", CatalogImagePipeline.VERSION);
        m.put("enabled", enabled);
        m.put("byStatus", byStatus);
        m.put("canonical", images.countByCanonicalTrue());
        m.put("reviewPending", images.countByReviewStatus("PENDING"));
        m.put("averageQuality", images.averageQuality());
        m.put("topRejectionReasons", reasons);
        return m;
    }

    /** Antes/depois e depuração visual (bbox, máscara, foco, regiões críticas, candidatos, recorte final): só admin. */
    public Map<String, Object> debug(CurrentUser user, UUID imageId) {
        guard.requireAdmin(user);
        return view(images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image")));
    }

    /** Reprocessa todas as fotos de um produto (ou uma nova versão do pipeline pega tudo sozinha pelo pipeline_version). */
    public Map<String, Object> enqueueProduct(CurrentUser user, UUID productId) {
        guard.requireAdmin(user);
        Integer n = tx.execute(s -> {
            List<CatalogImage> list = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId);
            list.forEach(i -> {
                i.setProcessingStatus("PENDING");
                i.setAttempts(0);
                images.save(i);
            });
            return list.size();
        });
        return Map.of("productId", productId, "queued", n == null ? 0 : n);
    }

    Map<String, Object> view(CatalogImage i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("productId", i.getProductId());
        m.put("sourceUrl", i.getImageUrl());
        m.put("processedUrl", i.getStoredUrl());
        m.put("viewType", i.getImageType() == null ? null : i.getImageType().name());
        m.put("viewRole", i.getViewRole());
        m.put("canonical", i.isCanonical());
        m.put("processingStatus", i.getProcessingStatus());
        m.put("reviewStatus", i.getReviewStatus());
        m.put("qualityScore", i.getQualityScore());
        m.put("reasons", i.getGateReasons() == null ? List.of() : List.of(i.getGateReasons().split(",")));
        m.put("usageStatus", i.getUsageStatus() == null ? null : i.getUsageStatus().name());
        m.put("width", i.getWidth());
        m.put("height", i.getHeight());
        m.put("crop", i.getCropJson() == null ? null : Json.map(i.getCropJson()));
        m.put("metrics", i.getMetricsJson() == null ? null : Json.map(i.getMetricsJson()));
        m.put("assets", i.getAssetsJson() == null ? null : Json.map(i.getAssetsJson()));
        m.put("pipelineVersion", i.getPipelineVersion());
        m.put("processedAt", i.getProcessedAt());
        return m;
    }

    /**
     * Imagem que o card deve mostrar e como: master processado (nível B) ou URL original com o recorte semântico (nível A).
     * null = sem enquadramento aprovado; a interface deve mostrar estado de processamento/erro, nunca foto crua.
     */
    public static Map<String, Object> cardImage(CatalogImage canonical) {
        if (canonical == null || !canonical.isCanonical() || !"APPROVED".equals(canonical.getProcessingStatus())
                || canonical.getUsageStatus() == CatalogImageUsage.REJECTED || "REJECTED".equals(canonical.getReviewStatus())) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        Map<String, Object> selectionCrop = canonical.getCropJson() == null ? Map.of() : Json.map(canonical.getCropJson());
        if (!Boolean.TRUE.equals(selectionCrop.get("ruleCompliant")) || !(selectionCrop.get("crop") instanceof Map<?, ?>)) return null;
        boolean automaticFrame = selectionCrop.get("selectionFrame") instanceof Map<?, ?> frame
                && Boolean.TRUE.equals(frame.get("automatic"));
        Map<String, Object> preview = previewAssets(canonical);
        if (!preview.isEmpty() && !currentPreviewSource(canonical)) return null;
        if (currentPreviewSource(canonical) && preview.get("fabricUrl") instanceof String fabricUrl && !fabricUrl.isBlank()) {
            m.put("url", fabricUrl); m.put("thumbnailUrl", fabricUrl); m.put("mode", "PROCESSED"); m.put("aspect", "3:4");
        } else if (preview.isEmpty() && canonical.getAssetsJson() != null && (!selectionCrop.containsKey("selectionFrame") || automaticFrame)
                && Json.map(canonical.getAssetsJson()).get("card") instanceof String) {
            Map<String, Object> assets = Json.map(canonical.getAssetsJson());
            m.put("url", assets.getOrDefault("card", canonical.getStoredUrl()));
            m.put("thumbnailUrl", assets.get("thumbnail"));
            m.put("mode", "PROCESSED");
        } else if (selectionCrop.containsKey("selectionFrame")) {
            m.put("url", canonical.getImageUrl()); m.put("mode", "SEMANTIC_CROP");
            m.put("crop", selectionCrop.get("crop")); m.put("aspect", "3:4");
            m.put("framing", selectionCrop.get("selectionFrame"));
        } else {
            m.put("url", canonical.getImageUrl());
            m.put("mode", "SEMANTIC_CROP");
            if (canonical.getCropJson() != null) {
                Map<String, Object> crop = Json.map(canonical.getCropJson());
                m.put("crop", crop.get("crop"));
                m.put("background", crop.get("background"));
                m.put("aspect", crop.get("aspect"));
            }
        }
        if (!automaticFrame && canonical.getCropJson() != null) {
            m.put("aspect", Json.map(canonical.getCropJson()).get("aspect"));
        }
        m.put("sourceUrl", canonical.getImageUrl());
        m.put("imageId", canonical.getId());
        m.put("qualityScore", canonical.getQualityScore());
        m.put("pipelineVersion", canonical.getPipelineVersion());
        if (currentPreviewSource(canonical)) m.put("previewCache", preview);
        Map<String, Object> whole = wholeFrame(canonical);
        if (whole != null) m.put("whole", whole);
        return m;
    }

    @SuppressWarnings("unchecked")
    public static Map<String,Object> photoSet(CatalogImage image, CatalogProduct product) {
        if(image==null || product==null || image.getAssetsJson()==null || image.getUsageStatus()==CatalogImageUsage.REJECTED || "REJECTED".equals(image.getReviewStatus())) return Map.of();
        Object raw=Json.map(image.getAssetsJson()).get("photoSet");
        if(!(raw instanceof Map<?,?> m) || !"CATALOG_PHOTO_SET_V2".equals(m.get("version"))
          || !Objects.equals(image.getImageUrl(),m.get("sourceUrl")) || !Objects.equals(image.getSourceSha256(),m.get("sourceSha256"))
          || !Objects.equals(product.getCategory(),m.get("category")) || !Objects.equals(product.getSubcategory(),m.get("subcategory"))
          || !Objects.equals(product.getColor(),m.get("color")) || !(m.get("defaultAssetUrl") instanceof String url) || !url.startsWith("/api/catalog/default-asset?")) return Map.of();
        if("READY".equals(m.get("status")) && (!(m.get("wholeUrl") instanceof String) || !(m.get("fabricUrl") instanceof String)
                || !(m.get("metrics") instanceof Map<?,?> metrics) || !validPreflight(metrics.get("preflight")))) return Map.of();
        return (Map<String,Object>)m;
    }

    /** Product edits invalidate the old derivative without downloading any photograph on a list/read request. */
    public static Map<String, Object> cardImage(CatalogImage canonical, CatalogProduct product) {
        Map<String, Object> packshot = packshotWhole(canonical);
        Map<String, Object> photo = photoSet(canonical, product);
        if (!photo.isEmpty() && Set.of("READY","DEFAULT","REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(photo.get("status")))) {
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("url", "READY".equals(photo.get("status")) ? photo.get("fabricUrl") : photo.get("defaultAssetUrl"));
            card.put("mode", "READY".equals(photo.get("status")) ? "PROCESSED" : "DEFAULT");
            card.put("sourceUrl", canonical.getImageUrl()); card.put("photoSet", photo); card.put("defaultAssetUrl", photo.get("defaultAssetUrl"));
            card.put("aspect", "3:4"); card.put("imageId", canonical.getId());
            if (packshot != null) card.put("whole", packshot);
            else if ("READY".equals(photo.get("status"))) card.put("whole", Map.of("url",photo.get("wholeUrl"),"box",Map.of("x",0,"y",0,"w",1,"h",1),"rendered",true,"processed",true,"version","CATALOG_PHOTO_SET_V2"));
            return card;
        }
        Map<String, Object> preview = previewAssets(canonical);
        Map<String, Object> card = !preview.isEmpty() && !currentPreview(product, canonical, Boolean.TRUE.equals(preview.get("persisted")))
                ? null : cardImage(canonical);
        if (packshot == null) return card;
        if (card == null) {
            // sem enquadramento aprovado da foto original: o packshot é a foto do card (nunca a foto crua da marca)
            card = new LinkedHashMap<>();
            card.put("url", packshot.get("url")); card.put("thumbnailUrl", packshot.get("url")); card.put("mode", "PROCESSED");
            card.put("aspect", "3:4"); card.put("sourceUrl", canonical.getImageUrl()); card.put("imageId", canonical.getId());
        }
        card.put("whole", packshot);
        return card;
    }

    /** Versão do Total frame vindo de catalog_images.processed_image_url (packshot processado fora da API). */
    public static final String PACKSHOT_VERSION = "PROCESSED_IMAGE_URL_V1";

    /**
     * Total frame do packshot (V81): a imagem já pronta para o quadro — a interface só a encaixa inteira, sem caixa nem
     * novo recorte. Vale para a foto que não foi recusada; endereço só https ou do nosso /media/ (nunca data:, http ou
     * javascript:). null sem packshot.
     */
    static Map<String, Object> packshotWhole(CatalogImage image) {
        if (image == null || image.getUsageStatus() == CatalogImageUsage.REJECTED || "REJECTED".equals(image.getReviewStatus())) return null;
        String url = image.getProcessedImageUrl() == null ? "" : image.getProcessedImageUrl().trim();
        if (url.length() > 2048 || url.chars().anyMatch(c -> c <= ' ' || c == '"' || c == '<' || c == '>' || c == '\\')) return null;
        boolean ours = url.startsWith("/media/") && !url.contains("..");
        if (!ours) {
            try {
                java.net.URI uri = java.net.URI.create(url);
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null) return null;
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", url);
        m.put("box", Map.of("x", 0, "y", 0, "w", 1, "h", 1));
        m.put("background", "#F4F5F7");
        m.put("rendered", true);
        m.put("processed", true);
        m.put("alpha", false);
        m.put("version", PACKSHOT_VERSION);
        return m;
    }

    /** Versão do Total frame: a interface encaixa a caixa da peça num quadro 3:4 com margem uniforme. */
    public static final String WHOLE_FRAME_VERSION = "WHOLE_FRAME_V1";

    /** Total frame requires a source-bound derivative with measured, complete semantic isolation. */
    static Map<String, Object> wholeFrame(CatalogImage canonical) {
        // Legacy studio/background/skin heuristics cannot prove semantic isolation.
        // Only a derivative with current source-bound preflight evidence is exposed.
        return processedWhole(canonical);
    }

    static boolean validPreflight(Object raw) {
        if (!(raw instanceof Map<?, ?> evidence)) return false;
        double height = number(evidence.get("sourceGarmentHeightFraction"));
        return "CATALOG_SOURCE_PREFLIGHT_V1".equals(evidence.get("version"))
                && "PASS".equals(evidence.get("status"))
                && Boolean.TRUE.equals(evidence.get("measurementReliable"))
                && Boolean.TRUE.equals(evidence.get("complete")) && Boolean.FALSE.equals(evidence.get("occluded"))
                && Boolean.TRUE.equals(evidence.get("isolationVerified"))
                && Boolean.TRUE.equals(evidence.get("humanAssessmentComplete"))
                && Double.isFinite(height) && height >= .25 && height <= 1;
    }

    /** Versão da Peça inteira processada (lote process_whole_frames): a peça recortada sem pessoa, 900×1200. */
    public static final String WHOLE_PROCESSED_VERSION = "WHOLE_FRAME_V3";

    /**
     * Peça inteira processada: o JPEG 900×1200 com a peça recortada (sem pessoa, sem fundo da marca) e a caixa dela no
     * quadro. Vale também para foto com modelo — é a peça isolada, não a foto original. null sem o processamento.
     */
    static Map<String, Object> processedWhole(CatalogImage canonical) {
        if (canonical == null || canonical.getWholeUrl() == null || canonical.getWholeUrl().isBlank()
                || !"DONE".equals(canonical.getWholeStatus()) || canonical.getWholeJson() == null) return null;
        Map<String, Object> info = Json.map(canonical.getWholeJson());
        if (!WHOLE_PROCESSED_VERSION.equals(canonical.getWholePipelineVersion())
                || !WHOLE_PROCESSED_VERSION.equals(info.get("version"))
                || !Objects.equals(canonical.getImageUrl(),info.get("sourceUrl"))
                || canonical.getSourceSha256() == null || !Objects.equals(canonical.getSourceSha256(),info.get("sourceSha256"))
                || !validPreflight(info.get("preflight"))) return null;
        if (info.get("truncated") instanceof List<?> sides && !sides.isEmpty()) return null;
        if (!(info.get("box") instanceof Map<?, ?> box)) return null;
        double x = number(box.get("x")), y = number(box.get("y")), w = number(box.get("w")), h = number(box.get("h"));
        if (!(w > 0 && h > 0 && w <= .501 && h <= .501 && Math.abs(Math.max(w,h)-.5) <= .001 && Math.abs(x-(1-w)/2) <= .001 && Math.abs(y-(1-h)/2) <= .001)) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", canonical.getWholeUrl());
        m.put("box", Map.of("x", x, "y", y, "w", w, "h", h));
        m.put("background", info.getOrDefault("background", "#F4F5F7"));
        m.put("width", info.getOrDefault("width", 900));
        m.put("height", info.getOrDefault("height", 1200));
        m.put("truncated", info.get("truncated") instanceof List<?> sides ? sides : List.of());
        m.put("alpha", false);
        m.put("processed", true);
        m.put("version", WHOLE_PROCESSED_VERSION);
        return m;
    }

    private static double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : Double.NaN;
    }

    /**
     * Foto do catálogo que pode ir à GPU na Prova com IA: a canônica aprovada e gravada com autorização da fonte (nunca a
     * cópia forçada pelo responsável) e comprovadamente sem pessoa — sem modelo vestindo e com a evidência de pele medida
     * abaixo do limite. Sem essa medição, fica de fora: foto de marca com gente não vai à GPU.
     */
    public static boolean vtonGarment(CatalogImage image) {
        if (image == null || !image.isCanonical() || !"APPROVED".equals(image.getProcessingStatus())
                || image.getUsageStatus() != CatalogImageUsage.PERSISTED || image.getStoredUrl() == null) return false;
        Map<String, Object> assets = image.getAssetsJson() == null ? Map.of() : Json.map(image.getAssetsJson());
        if (assets.get("persistenceDecision") instanceof Map<?, ?> decision && "FORCED_CATEGORY_FRAME".equals(decision.get("mode"))) return false;
        Map<String, Object> metrics = image.getMetricsJson() == null ? Map.of() : Json.map(image.getMetricsJson());
        Map<?, ?> debug = metrics.get("debug") instanceof Map<?, ?> d ? d : Map.of();
        Map<?, ?> productFrame = debug.get("productFrame") instanceof Map<?, ?> f ? f : Map.of();
        if (Boolean.TRUE.equals(productFrame.get("model"))) return false;
        return debug.get("sourceHumanEvidence") instanceof Number human && human.doubleValue() < ProductRuleFrame.MIN_PERSON_SKIN;
    }
}
