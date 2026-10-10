package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.QualityMetrics;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * QUALITY CHECK: métricas 0–1 (1 = melhor) que alimentam o Quality Gate. No nível A (só metadados) a foto exibida é a
 * original da marca: cor, logo e detalhes ficam 100% preservados e não há reconstrução, então esses três valem 1. No
 * nível B (master gravado) o {@link BackgroundNormalizer} mede a cor depois da composição.
 */
public final class ImageQualityAnalyzer {
    public static final int MIN_SOURCE_SIDE = 320;
    public static final int GOOD_SOURCE_SIDE = 900;
    public static final int MIN_PRODUCT_PX = 200;

    public static final Map<String, Double> WEIGHTS = Map.ofEntries(
            Map.entry("segmentationConfidence", 0.14), Map.entry("productVisibility", 0.12), Map.entry("garmentCompleteness", 0.10),
            Map.entry("occupancyScore", 0.08), Map.entry("emptySpaceScore", 0.05), Map.entry("focusScore", 0.10),
            Map.entry("cropScore", 0.08), Map.entry("edgeQuality", 0.07), Map.entry("colorPreservationScore", 0.06),
            Map.entry("logoPreservationScore", 0.04), Map.entry("reconstructionConfidence", 0.04),
            Map.entry("sourceQuality", 0.08), Map.entry("humanResidueScore", 0.02), Map.entry("objectResidueScore", 0.02));

    public record Report(Map<String, Double> metrics, double overall) {
    }

    /**
     * @param humanEvidence fração estimada da foto/peça que é pessoa (0 = nenhuma)
     * @param colorScore    colorPreservationScore (1 no nível A)
     * @param logoInside    logo achado pelo detector local cai dentro do recorte (null = nenhum logo achado)
     */
    public Report analyze(BufferedImage source, ProductSegmenter.Segmentation seg, SemanticCropper.Result crop,
                          double humanEvidence, double colorScore, Boolean logoInside, double reconstruction) {
        Map<String, Double> m = new LinkedHashMap<>();
        int shortSide = Math.min(source.getWidth(), source.getHeight());
        double resolution = Math.min(1, (double) shortSide / GOOD_SOURCE_SIDE);
        m.put("sourceQuality", r(0.6 * resolution + 0.4 * QualityMetrics.sharpness(source)));
        m.put("segmentationConfidence", r(seg.confidence()));
        m.put("productVisibility", r(1 - seg.truncatedSides().size() / 4.0));
        m.put("garmentCompleteness", r(crop.best().parts().get("completeness") * (seg.truncatedSides().isEmpty() ? 1 : 0.6)));
        m.put("occupancyScore", r(crop.best().parts().get("occupancy")));
        double maskArea = crop.best().parts().getOrDefault("foregroundCoverage",
                seg.coverage() / Math.max(1e-6, crop.best().crop().area()));
        double empty = 1 - Math.min(1, maskArea);
        m.put("emptySpace", r(empty));
        // com Regra de Enquadramento COVER/WIDTH a peça preenche o quadro de propósito: pouco fundo não é defeito
        double tooLittle = crop.rule() == null ? 0.25 : 0;
        m.put("emptySpaceScore", r(empty < tooLittle ? empty / tooLittle : empty > 0.70 ? Math.max(0, 1 - (empty - 0.70) / 0.3) : 1));
        m.put("focusScore", r(crop.best().parts().get("focus")));
        m.put("cropScore", r(crop.best().score()));
        m.put("edgeQuality", r(seg.edgeQuality()));
        m.put("colorPreservationScore", r(colorScore));
        m.put("logoPreservationScore", logoInside == null || logoInside ? 1.0 : 0.0);
        m.put("reconstructionConfidence", r(reconstruction));
        m.put("humanResidueScore", r(1 - Math.min(1, humanEvidence * 4)));
        m.put("objectResidueScore", r(crop.best().parts().get("distractor")));
        double overall = 0;
        for (Map.Entry<String, Double> e : WEIGHTS.entrySet()) {
            overall += e.getValue() * m.getOrDefault(e.getKey(), 0.0);
        }
        return new Report(m, r(overall));
    }

    static double r(double v) {
        return Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000.0;
    }
}
