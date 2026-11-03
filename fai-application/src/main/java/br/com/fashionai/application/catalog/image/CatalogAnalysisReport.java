package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.vision.landmarks.LandmarkDetector;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Parte do relatório da análise que não depende de pixels (puro): motivos de revisão da regra de enquadramento
 * (§9.1, fragmento, vista declarada) e o mapa de depuração visual gravado em metrics_json.
 */
final class CatalogAnalysisReport {
    /** vistas que a origem declara de fato (PACKSHOT, OTHER e DETAIL não dizem qual lado da peça aparece) */
    static final Set<String> VIEWS = Set.of("FRONT", "BACK", "SIDE", "TOP");
    /** Área mínima da peça num packshot (fração da foto): no acervo o menor acessório aprovado ocupa 13%; abaixo de 8% é fragmento. */
    static final double MIN_PRODUCT_AREA = 0.08;

    private CatalogAnalysisReport() {
    }

    /** Acrescenta a {@code extra} os motivos que mandam para revisão mesmo com métricas boas. */
    static void reviewReasons(List<String> extra, SemanticCropper.Result crop, ProductSegmenter.Segmentation seg, String imageType) {
        // REGRA DE ENQUADRAMENTO (§9.1): recorte fora da regra ou vista declarada diferente da exigida vão para revisão
        if (crop.rule() != null && Boolean.FALSE.equals(crop.compliance().get("ok"))) {
            extra.add("FRAMING_RULE_NOT_MET");
        }
        // fragmento: num packshot a peça nunca ocupa só uma lasca da foto — peça clara sobre fundo claro faz a segmentação
        // pegar só o detalhe escuro (patch, logo) e o recorte vira um close do detalhe. Foto de detalhe declarada fica de fora.
        NRect box = seg.productBox();
        if (!"DETAIL".equalsIgnoreCase(imageType) && box.w() * box.h() < MIN_PRODUCT_AREA) {
            extra.add("SEGMENTATION_FRAGMENT");
        }
        String required = crop.rule() == null ? "ANY" : crop.rule().view();
        String declared = imageType == null ? null : imageType.toUpperCase(java.util.Locale.ROOT);
        if (!"ANY".equals(required) && declared != null && VIEWS.contains(declared) && !declared.equals(required)) {
            extra.add("VIEW_MISMATCH_" + required);
        }
    }

    /** Depuração visual: bbox, distratores, foco, regiões críticas, landmarks, candidatos, recorte final e quadros. */
    static Map<String, Object> debug(ProductSegmenter.Segmentation seg, FramingStrategy.Focus focus, LandmarkDetector.Result lm,
                                     SemanticCropper.Result crop, String registryVersion, double sourceHuman, double human,
                                     FabricFrame.Result fabric, ProductRuleFrame.Result productFrame) {
        Map<String, Object> debug = new LinkedHashMap<>();
        debug.put("bbox", seg.productBox().toMap());
        debug.put("distractors", seg.distractors().stream().map(NRect::toMap).toList());
        debug.put("focus", focus.rect().toMap());
        debug.put("critical", focus.critical().stream().map(r -> Map.of("name", r.name(), "rect", r.rect().toMap())).toList());
        debug.put("landmarks", lm.landmarks().stream().filter(LandmarkDetector.Landmark::visible).map(LandmarkDetector.Landmark::toMap).toList());
        debug.put("candidates", crop.candidates().stream().map(SemanticCropper.Candidate::toMap).toList());
        debug.put("finalCrop", crop.best().crop().toMap());
        debug.put("truncated", seg.truncatedSides());
        debug.put("hangerTrimmed", seg.hangerTrimmed());
        debug.put("registryVersion", registryVersion);
        debug.put("sourceHumanEvidence", NRect.r4(sourceHuman));
        debug.put("cropHumanEvidence", NRect.r4(human));
        debug.put("fabricFrame", fabric.toMap());
        debug.put("productFrame", productFrame.toMap());
        if (crop.rule() != null) {
            debug.put("framingRule", crop.rule().toMap());
            debug.put("ruleCompliance", crop.compliance());
        }
        return debug;
    }
}
