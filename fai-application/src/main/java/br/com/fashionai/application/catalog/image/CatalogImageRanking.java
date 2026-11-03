package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogImagePipelineService.DONE;

/** Papel de cada foto analisada do produto (canônica, alternativa, detalhe, duplicada) pelo {@link ImageCandidateRanker}. */
final class CatalogImageRanking {
    private final CatalogImageRepository images;
    private final CatalogProductRepository products;
    private final ImageCandidateRanker ranker = new ImageCandidateRanker();

    CatalogImageRanking(CatalogImageRepository images, CatalogProductRepository products) {
        this.images = images;
        this.products = products;
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
}
