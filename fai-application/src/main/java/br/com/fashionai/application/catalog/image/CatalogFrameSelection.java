package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogImageColumns.metricsJson;
import static br.com.fashionai.application.catalog.image.CatalogImageColumns.qualityScore;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.previewAssets;

/**
 * Enquadramento sob demanda: confere se a foto pedida já tem quadro atual (cache de preview ou photo set) e, quando
 * não tem ou o retry é forçado, refaz a regra do produto na foto original desta peça/variante.
 */
final class CatalogFrameSelection {
    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final CatalogVariantRepository variants;
    private final WebFetchPort web;
    private final TransactionTemplate tx;
    private final CatalogImagePipeline pipeline;
    private final CatalogImageBindings bindings;
    private final CatalogPreviewWriter writer;

    /** Cached automatic display framing. Striped locks bound memory and serialize duplicate requests. */
    private final Object[] previewLocks = java.util.stream.IntStream.range(0, 32).mapToObj(i -> new Object()).toArray();
    private final java.util.concurrent.Semaphore previewCapacity = new java.util.concurrent.Semaphore(2);

    CatalogFrameSelection(CatalogImageRepository images, CatalogProductRepository products, CatalogVariantRepository variants,
                          WebFetchPort web, TransactionTemplate tx, CatalogImagePipeline pipeline, CatalogImageBindings bindings,
                          CatalogPreviewWriter writer) {
        this.images = images;
        this.products = products;
        this.variants = variants;
        this.web = web;
        this.tx = tx;
        this.pipeline = pipeline;
        this.bindings = bindings;
        this.writer = writer;
    }

    /** {@code verifySelection}: a verificação do serviço (com a mesma autorização) quando o quadro precisa ser refeito. */
    void ensurePreview(UUID productId, boolean force, UUID variantId, UUID imageId, Runnable verifySelection) {
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product))
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        var productVariants=variants.findByProductIdOrderByVariantKey(productId);
        var requestedVariant=bindings.selectedVariant(product,productVariants,variantId,imageId);
        synchronized (previewLocks[Math.floorMod(productId.hashCode(), previewLocks.length)]) {
            List<CatalogImage> selected=images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                    .filter(i->imageId==null||imageId.equals(i.getId()))
                    .filter(i->CatalogImageIdentity.matches(i,product,requestedVariant,productVariants))
                    .filter(i->i.isCanonical()||variantId!=null||imageId!=null).toList();
            boolean ready = selected.stream()
                    .filter(i -> i.getUsageStatus() != CatalogImageUsage.REJECTED && !"REJECTED".equals(i.getReviewStatus()))
                    .anyMatch(i -> bindings.currentBoundPreview(product, i, bindings.allowsPersistence(product, i))
                            && "READY".equals(previewAssets(i).get("status")));
            boolean cleaned=selected.stream().map(i -> bindings.boundPhotoSet(i,product)).anyMatch(m -> "READY".equals(m.get("status")) || "DEFAULT".equals(m.get("status")));
            if ((ready || cleaned) && !force) return;
            if (!previewCapacity.tryAcquire()) throw new ApiException(429, "CATALOG_PREVIEW_BUSY", "Enquadramento em andamento. Tente novamente.");
            try { verifySelection.run(); } finally { previewCapacity.release(); }
        }
    }

    void verifySelection(UUID productId, UUID variantId, UUID imageId) {
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("catalog product"));
        if (br.com.fashionai.application.catalog.CatalogPhotoEligibility.excluded(product)) {
            throw ApiException.badRequest("PRODUTO_RECUSADO", "Este produto foi recusado.");
        }
        var productVariants=variants.findByProductIdOrderByVariantKey(productId);
        var requestedVariant=bindings.selectedVariant(product,productVariants,variantId,imageId);
        List<CatalogImage> candidates = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId).stream()
                .filter(i->imageId==null||imageId.equals(i.getId()))
                .filter(i->CatalogImageIdentity.matches(i,product,requestedVariant,productVariants))
                .filter(i -> i.getUsageStatus() != CatalogImageUsage.REJECTED && !"REJECTED".equals(i.getReviewStatus()))
                .filter(i -> i.getImageUrl() != null && !i.getImageUrl().isBlank())
                .filter(i -> !Set.of("REVIEW","INELIGIBLE","RETRY").contains(String.valueOf(bindings.boundPhotoSet(i,product).get("status"))))
                .sorted(java.util.Comparator.comparing((CatalogImage i) -> !i.isCanonical()).thenComparing(CatalogTextureTransport::viewRank))
                .limit(3).toList();
        if (candidates.isEmpty()) throw new ApiException(422, "CATALOG_IMAGE_MISSING", "Esta peça não tem foto disponível para verificar.");
        boolean downloaded = false;
        for (CatalogImage image : candidates) {
            // Verified photo-set derivatives are already source-bound and need no new download or heuristic crop.
            if ("READY".equals(bindings.boundPhotoSet(image,product).get("status"))) return;
            Optional<WebFetchPort.Fetched> fetched = web.get(image.getImageUrl(), (int) ImageOps.MAX_UPLOAD_BYTES, "image/");
            if (fetched.isEmpty()) continue;
            downloaded = true;
            boolean persist = bindings.allowsPersistence(product, image);
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
                writer.rememberPreview(product, image, analysis, fetched.get().body(), persist);
                image.setMetricsJson(metricsJson(analysis));
                image.setPipelineVersion(CatalogImagePipeline.VERSION);
                image.setProcessedAt(Instant.now());
                image.setProcessingStatus("APPROVED");
                image.setQualityScore(qualityScore(analysis.qualityScore()));
                if (variantId==null&&imageId==null) {
                    image.setCanonical(true);
                    for (CatalogImage other : images.findByProductIdOrderByPrimaryDescCreatedAtAsc(productId)) {
                        if (!other.getId().equals(image.getId()) && other.isCanonical()) { other.setCanonical(false); images.save(other); }
                    }
                }
                images.save(image);
            });
            return;
        }
        if (!downloaded) throw new ApiException(422, "CATALOG_IMAGE_FETCH_FAILED", "Não foi possível verificar as fotos desta peça. Tente novamente.");
        throw new ApiException(422, "CATEGORY_FRAME_UNAVAILABLE", "As fotos disponíveis não permitem o enquadramento desta categoria. Escolha outra foto ou use sua própria foto.");
    }
}
