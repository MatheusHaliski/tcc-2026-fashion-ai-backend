package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Quality Gate: APPROVED (vai para o card), NEEDS_REPROCESSING (fila de revisão do admin) ou REJECTED (fallback para a
 * próxima foto oficial). Remoção de fundo sozinha nunca aprova: a foto precisa passar em todas as métricas.
 */
public final class CatalogImageValidator {
    public static final double APPROVE_OVERALL = 0.70;
    public static final double REVIEW_OVERALL = 0.50;

    public enum Outcome { APPROVED, NEEDS_REPROCESSING, REJECTED }

    public record Verdict(Outcome outcome, List<String> reasons, boolean manualReview, double confidence) {
    }

    /**
     * @param persisted nível B: pessoa sobre a peça não pode ser removida sem reconstruir pixels → REJECT_IMAGE
     */
    public Verdict validate(Map<String, Double> m, double overall, double humanEvidence, boolean persisted,
                            ProductSegmenter.Segmentation seg) {
        List<String> hard = new ArrayList<>(), soft = new ArrayList<>();
        if (seg.empty() || seg.coverage() < 0.02) {
            hard.add("NO_PRODUCT");
        }
        if (humanEvidence >= 0.06) {
            (persisted ? hard : soft).add(persisted ? "HUMAN_OCCLUSION_REJECT_IMAGE" : "HUMAN_PRESENT");
        }
        if (m.getOrDefault("segmentationConfidence", 0.0) < 0.45) {
            soft.add("LOW_SEGMENTATION");
        }
        if (m.getOrDefault("productVisibility", 0.0) < 1) {
            soft.add("PRODUCT_TRUNCATED_IN_SOURCE");
        }
        if (m.getOrDefault("objectResidueScore", 1.0) < 0.8) {
            soft.add("DISTRACTOR_IN_FRAME");
        }
        if (m.getOrDefault("cropScore", 0.0) < 0.55) {
            soft.add("WEAK_CROP");
        }
        if (m.getOrDefault("edgeQuality", 0.0) < 0.35) {
            soft.add("ROUGH_EDGES");
        }
        double confidence = Math.min(overall, m.getOrDefault("segmentationConfidence", 0.0));
        if (!hard.isEmpty() || overall < REVIEW_OVERALL) {
            if (hard.isEmpty()) {
                hard.add("LOW_QUALITY");
            }
            hard.addAll(soft);
            return new Verdict(Outcome.REJECTED, hard, false, confidence);
        }
        if (!soft.isEmpty() || overall < APPROVE_OVERALL) {
            if (soft.isEmpty()) {
                soft.add("BELOW_APPROVAL_THRESHOLD");
            }
            return new Verdict(Outcome.NEEDS_REPROCESSING, soft, true, confidence);
        }
        return new Verdict(Outcome.APPROVED, List.of(), false, confidence);
    }
}
