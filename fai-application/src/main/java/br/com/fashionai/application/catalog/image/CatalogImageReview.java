package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogImagePipelineService.ReviewCommand;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.ACTIONS;
import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.DONE;

/** Administração do pipeline (a autorização fica no serviço): CatalogImageReviewQueue, métricas, depuração e reprocesso. */
final class CatalogImageReview {
    private static final Logger log = LoggerFactory.getLogger(CatalogImagePipelineService.class);

    private final CatalogImageRepository images;
    private final TransactionTemplate tx;
    private final CatalogImageRanking ranking;
    private final boolean enabled;

    CatalogImageReview(CatalogImageRepository images, TransactionTemplate tx, CatalogImageRanking ranking, boolean enabled) {
        this.images = images;
        this.tx = tx;
        this.ranking = ranking;
        this.enabled = enabled;
    }

    Map<String, Object> reviewQueue(int limit) {
        List<Map<String, Object>> items = images.findByReviewStatusOrderByProcessedAtAsc("PENDING", PageRequest.of(0, Math.min(100, Math.max(1, limit))))
                .stream().map(this::view).toList();
        return Map.of("items", items, "pending", images.countByReviewStatus("PENDING"), "actions", ACTIONS);
    }

    Map<String, Object> decide(CurrentUser user, UUID imageId, ReviewCommand cmd) {
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
            ranking.rerank(img.getProductId());
            log.info("event=catalog_image_review imageId={} action={} admin={}", imageId, action, user.id());
            return view(img);
        });
    }

    Map<String, Object> metrics() {
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

    Map<String, Object> debug(UUID imageId) {
        return view(images.findById(imageId).orElseThrow(() -> ApiException.notFound("catalog image")));
    }

    Map<String, Object> enqueueProduct(UUID productId) {
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
}
