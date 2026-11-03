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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogImageColumns.copyAnalysis;
import static br.com.fashionai.application.catalog.image.CatalogImageColumns.dimension;
import static br.com.fashionai.application.catalog.image.CatalogImageColumns.gateReasons;
import static br.com.fashionai.application.catalog.image.CatalogImageColumns.metricsJson;
import static br.com.fashionai.application.catalog.image.CatalogImageColumns.qualityScore;
import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.DONE;

/**
 * Worker do pipeline: reserva o lote, baixa cada foto, reaproveita a análise dos mesmos bytes no mesmo contexto ou
 * roda o {@link CatalogImagePipeline}, grava os metadados (e o master no nível B) e reclassifica as fotos do produto.
 */
final class CatalogImageWorker {
    private static final Logger log = LoggerFactory.getLogger(CatalogImagePipelineService.class);

    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final WebFetchPort web;
    private final TransactionTemplate tx;
    private final CatalogImagePipeline pipeline;
    private final CatalogImageBindings bindings;
    private final CatalogPreviewWriter writer;
    private final CatalogImageRanking ranking;
    private final int maxAttempts;

    CatalogImageWorker(CatalogImageRepository images, CatalogProductRepository products, WebFetchPort web, TransactionTemplate tx,
                       CatalogImagePipeline pipeline, CatalogImageBindings bindings, CatalogPreviewWriter writer,
                       CatalogImageRanking ranking, int maxAttempts) {
        this.images = images;
        this.products = products;
        this.web = web;
        this.tx = tx;
        this.pipeline = pipeline;
        this.bindings = bindings;
        this.writer = writer;
        this.ranking = ranking;
        this.maxAttempts = maxAttempts;
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

    /** Falha inesperada no processamento de uma foto do lote: FAILED com PIPELINE_ERROR, sem derrubar o tick. */
    void markFailed(UUID id) {
        tx.executeWithoutResult(s -> images.findById(id).ifPresent(i -> {
            i.setProcessingStatus("FAILED");
            i.setGateReasons("PIPELINE_ERROR");
            images.save(i);
        }));
    }

    /** Uma imagem: download seguro → cache por hash → pipeline → metadados (+ master no nível B) → canônica do produto. */
    void process(UUID imageId) {
        CatalogImage img = images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image"));
        CatalogProduct product = products.findById(img.getProductId()).orElse(null);
        if (!CatalogImageIdentity.matches(img,product,null,bindings.contextVariants(img))) {
            finish(img,"NEEDS_REPROCESSING",List.of("CATALOG_IMAGE_VARIANT_MISMATCH"),null);
            images.save(img);return;
        }
        Map<String,Object> sourceGate = bindings.boundPhotoSet(img,product);
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
        boolean persist = product != null && bindings.allowsPersistence(product, img);
        Optional<CatalogImage> cached = persist ? Optional.empty()
                : images.findFirstBySourceSha256AndPipelineVersionAndProcessingStatusIn(sha, CatalogImagePipeline.VERSION, DONE)
                .filter(c -> !c.getId().equals(img.getId()))
                .filter(c -> sameContext(c, img, product));
        if (cached.isPresent()) {
            copyAnalysis(cached.get(), img);
            writer.rememberPreview(product, img, null, null, false);
        } else {
            CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(bytes,
                    product == null ? null : product.getCategory(), product == null ? null : product.getSubcategory(),
                    img.getImageType() == null ? null : img.getImageType().name(), persist));
            apply(img, a, persist);
            writer.rememberPreview(product, img, a, bytes, persist);
        }
        tx.executeWithoutResult(s -> {
            images.save(img);
            ranking.rerank(img.getProductId());
        });
        log.info("event=catalog_image_processed imageId={} productId={} status={} quality={} reasons={} persisted={} cached={} ms={} version={}",
                img.getId(), img.getProductId(), img.getProcessingStatus(), img.getQualityScore(), img.getGateReasons(), persist,
                cached.isPresent(), (System.nanoTime() - t0) / 1_000_000, CatalogImagePipeline.VERSION);
    }

    /**
     * O pipeline usa categoria, subcategoria e tipo de vista para decidir peça, foco, recorte e detailView: os mesmos
     * bytes em outro contexto não podem herdar a análise — sem contexto igual, roda o pipeline de novo.
     */
    boolean sameContext(CatalogImage cached, CatalogImage img, CatalogProduct product) {
        if (cached.getImageType() != img.getImageType() || product == null) return false;
        CatalogProduct other = cached.getProductId() == null ? null : products.findById(cached.getProductId()).orElse(null);
        // Product metadata can be edited after the first analysis. Even sibling images in the
        // same product must prove which category/subcategory produced their cached crop.
        return other != null && Objects.equals(other.getCategory(), product.getCategory())
                && Objects.equals(other.getSubcategory(), product.getSubcategory())
                && bindings.currentBoundPreview(other, cached, false);
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
            Map<String, Object> assets = writer.store(img, a.rendered());
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
}
