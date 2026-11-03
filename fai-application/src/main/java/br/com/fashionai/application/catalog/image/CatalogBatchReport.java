package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.Json;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Respostas do protocolo do {@link CatalogImageBatchCli}: veredito e colunas de uma análise, papéis do {@code rank} e
 * o objeto de erro — sempre uma linha JSON que ecoa o {@code id}.
 */
final class CatalogBatchReport {
    private CatalogBatchReport() {
    }

    static String analyzed(String id, CatalogImagePipeline.Analysis a, long t0) {
        SemanticCropper.Result crop = a.crop();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", "analyze");
        m.put("ok", true);
        m.put("outcome", a.outcome().name());
        m.put("reasons", a.reasons());
        m.put("qualityScore", a.qualityScore());
        m.put("pieceType", a.pieceType() == null ? null : a.pieceType().name());
        m.put("detailView", a.detailView());
        m.put("focus", a.focus() == null ? null : a.focus().name());
        m.put("rule", crop == null || crop.rule() == null ? null : crop.rule().toMap());
        m.put("compliance", crop == null || crop.rule() == null ? Map.of() : crop.compliance());
        m.put("ms", (System.nanoTime() - t0) / 1_000_000);
        // quadro só de tecido da V2 (depuração); null quando a análise parou antes (foto recusada)
        m.put("fabricFrame", a.debug() == null ? null : a.debug().get("fabricFrame"));
        // quadro 3:4 pela regra do produto (o mesmo cálculo do card), usado pelo lote V3; null quando a análise parou antes
        m.put("productFrame", a.debug() == null ? null : a.debug().get("productFrame"));
        m.put("columns", columns(a));
        return Json.write(m);
    }

    /**
     * Colunas de catalog_images que a API grava para esta análise no nível A (apply + finish com persist=false), pelos
     * mesmos helpers do {@link CatalogImagePipelineService}. Fora daqui ficam processed_at, review_status, view_role e
     * is_canonical, que dependem do estado da linha no banco (o orquestrador aplica as mesmas regras da API).
     */
    static Map<String, Object> columns(CatalogImagePipeline.Analysis a) {
        BigDecimal quality = CatalogImagePipelineService.qualityScore(a.qualityScore());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mime", a.mime());
        m.put("width", CatalogImagePipelineService.dimension(a.width()));
        m.put("height", CatalogImagePipelineService.dimension(a.height()));
        m.put("source_sha256", a.sha256());
        m.put("phash", a.phash());
        m.put("processing_status", a.outcome().name());
        m.put("pipeline_version", CatalogImagePipeline.VERSION);
        m.put("quality_score", quality == null ? null : quality.toPlainString());
        m.put("gate_reasons", CatalogImagePipelineService.gateReasons(a.reasons()));
        m.put("crop_json", CatalogImagePipelineService.cropJson(a));
        m.put("metrics_json", CatalogImagePipelineService.metricsJson(a));
        return m;
    }

    static String ranked(String id, List<ImageCandidateRanker.Ranked> ranked) {
        List<Map<String, Object>> roles = new ArrayList<>();
        for (ImageCandidateRanker.Ranked r : ranked) {
            Map<String, Object> role = new LinkedHashMap<>();
            role.put("id", r.candidate().id());
            role.put("role", r.role().name());
            role.put("score", r.score());
            roles.add(role);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", "rank");
        m.put("ok", true);
        m.put("roles", roles);
        return Json.write(m);
    }

    static String error(String id, String op, String code, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("op", op);
        m.put("ok", false);
        m.put("error", code);
        if (message != null) {
            m.put("message", message);
        }
        return Json.write(m);
    }
}
