package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogImage;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Colunas do nível A: o que apply()/finish() gravam a partir da Analysis; também usadas pelo
 * CatalogImageBatchCli (lote local), para o lote gravar no banco exatamente o que a API gravaria.
 */
final class CatalogImageColumns {
    private CatalogImageColumns() {
    }

    /** width/height: 0 (foto rejeitada antes do decode) vira NULL. */
    static Integer dimension(int px) {
        return px == 0 ? null : px;
    }

    /** crop_json: recorte 4:5 em coordenadas normalizadas da foto original; NULL quando não houve REFRAMING. */
    static String cropJson(CatalogImagePipeline.Analysis a) {
        return a.crop() == null ? null : Json.write(a.cropJson());
    }

    /** metrics_json: métricas do QUALITY CHECK + tipo de peça, detalhe, confiança, revisão, estágios e depuração. */
    static String metricsJson(CatalogImagePipeline.Analysis a) {
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
    static String gateReasons(List<String> reasons) {
        if (reasons.isEmpty()) {
            return null;
        }
        String joined = String.join(",", reasons);
        return joined.substring(0, Math.min(500, joined.length()));
    }

    /** quality_score: DECIMAL com 4 casas, arredondamento HALF_UP. */
    static BigDecimal qualityScore(Double quality) {
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
}
