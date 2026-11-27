package br.com.fashionai.application.catalog.image;

import java.util.Map;

/**
 * Evidência de preflight da foto de origem (CATALOG_SOURCE_PREFLIGHT_V1): a peça inteira, isolada e medida com
 * confiança. Exigida antes de expor um derivado de pixels reais (Peça inteira processada, photo set READY).
 * Extraída do CatalogImagePipelineService (regra própria, usada por mais de um caminho do card).
 */
final class CatalogSourcePreflight {
    private CatalogSourcePreflight() {
    }

    static boolean valid(Object raw) {
        if (!(raw instanceof Map<?, ?> evidence)) return false;
        double height = evidence.get("sourceGarmentHeightFraction") instanceof Number n ? n.doubleValue() : Double.NaN;
        return "CATALOG_SOURCE_PREFLIGHT_V1".equals(evidence.get("version"))
                && "PASS".equals(evidence.get("status"))
                && Boolean.TRUE.equals(evidence.get("measurementReliable"))
                && Boolean.TRUE.equals(evidence.get("complete")) && Boolean.FALSE.equals(evidence.get("occluded"))
                && Boolean.TRUE.equals(evidence.get("isolationVerified"))
                && Boolean.TRUE.equals(evidence.get("humanAssessmentComplete"))
                && Double.isFinite(height) && height >= .25 && height <= 1;
    }
}
