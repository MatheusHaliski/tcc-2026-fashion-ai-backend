package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Evidências da análise da foto (RF4): recusa pelos critérios de aceite, palpite local pelo ranking de silhuetas,
 * candidatos de subtipo, resumo da busca da marca (IA, detector local, OCR) e a caixa do logo relativa à peça.
 */
final class DraftEvidence {
    private DraftEvidence() {
    }

    /** Recusa com a primeira orientação como mensagem principal e todos os critérios no detalhe. */
    static PhotoRejectedException rejection(List<PhotoAcceptance.Check> checks) {
        return rejection(checks, null);
    }

    static PhotoRejectedException rejection(List<PhotoAcceptance.Check> checks, String detectedCategory) {
        String first = checks.stream().filter(c -> !c.ok()).map(PhotoAcceptance.Check::message).findFirst().orElse("");
        return new PhotoRejectedException(Msg.t("photoAcceptance.recusada", first), checks, detectedCategory);
    }

    /**
     * Palpite local (sem IA): cor pela paleta; tipo = o escolhido pela pessoa; subtipo = a referência mais parecida
     * (similaridade de silhueta), com confiança pela similaridade e pela folga para o segundo colocado.
     */
    static LocalVision.PieceGuess localGuess(LocalVision.PieceGuess base, String chosen, List<SubtypeReferences.Match> ranking) {
        String category = chosen != null ? chosen : base.category();
        String sub = base.subcategory();
        double subConf = base.confidence().getOrDefault("subcategory", 0.0);
        List<SubtypeReferences.Match> inCategory = ranking.stream()
                .filter(m -> category != null && Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).contains(m.subcategory())).toList();
        if (!inCategory.isEmpty()) {
            sub = inCategory.get(0).subcategory();
            double gap = inCategory.size() > 1 ? inCategory.get(0).score() - inCategory.get(1).score() : 0.1;
            subConf = Math.min(0.9, Math.max(0, (inCategory.get(0).score() - 0.6) * 1.2 + gap * 3));
        } else if (chosen != null && (sub == null || !Taxonomy.SUBCATEGORIES.get(chosen).contains(sub))) {
            sub = Taxonomy.SUBCATEGORIES.get(chosen).get(0);
            subConf = 0.2;
        }
        Map<String, Double> conf = new LinkedHashMap<>(base.confidence());
        conf.put("category", chosen != null ? 1.0 : conf.getOrDefault("category", 0.0));
        conf.put("subcategory", Math.round(subConf * 100) / 100.0);
        double overall = Math.round((conf.get("category") + conf.get("subcategory") + conf.getOrDefault("color", 0.0)) / 3 * 100) / 100.0;
        return new LocalVision.PieceGuess(category, sub, base.color(), base.material(), base.brand(), base.sex(), conf, overall,
                base.palette(), null, LocalVision.Insights.NONE.withRanking(inCategory.isEmpty() ? ranking : inCategory));
    }

    /** Subtipos candidatos para a tela ({code, score}), só da categoria, os 3 primeiros. */
    static List<Map<String, Object>> candidates(List<SubtypeReferences.Match> ranking, String category) {
        return ranking.stream()
                .filter(m -> category == null || Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of()).contains(m.subcategory()))
                .limit(3).map(m -> Map.<String, Object>of("code", m.subcategory(), "score", m.score())).toList();
    }

    /** Resumo da busca da marca: as zonas olhadas, onde achou (zona da IA ou a zona do logo) e quem achou. */
    static Map<String, Object> brandSearch(List<BrandRegions.Zone> zones, LocalVision.PieceGuess guess, double[] logoRel, String logoSource) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("zones", zones.stream().map(BrandRegions.Zone::id).toList());
        String brand = guess.brand() == null || guess.brand().isBlank() ? null : guess.brand();
        String zone = guess.insights().brandZone();
        if (zone == null || zones.stream().noneMatch(z -> z.id().equals(guess.insights().brandZone()))) {
            zone = BrandRegions.zoneOf(zones, logoRel);
        }
        out.put("brand", brand);
        out.put("foundIn", brand != null || logoRel != null ? zone : null);
        out.put("logoSource", logoSource);
        out.put("evidence", guess.insights().brandEvidence());
        return out;
    }

    /** Resultado do OCR local no resumo da busca da marca: onde leu, o texto visto e se é marca do catálogo. */
    static void applyOcr(Map<String, Object> brandSearch, br.com.fashionai.application.imaging.BrandReader.Found ocr, List<BrandRegions.Zone> zones) {
        String zone = zones.stream().anyMatch(z -> z.id().equals(ocr.region())) ? ocr.region() : BrandRegions.zoneOf(zones, ocr.box());
        if (ocr.confirmed()) {
            brandSearch.put("brand", ocr.brand());
            brandSearch.put("foundIn", zone != null ? zone : ocr.region());
            brandSearch.put("logoSource", "ocr");
        } else {
            brandSearch.put("suggestion", ocr.brand());
            if (brandSearch.get("foundIn") == null) {
                brandSearch.put("foundIn", zone != null ? zone : ocr.region());
            }
        }
        brandSearch.put("evidence", ocr.evidence());
        brandSearch.put("certainty", ocr.confirmed() ? "confirmada" : "possivel");
    }

    /**
     * Caixa do logo devolvida pela IA sobre a imagem enviada (768 px, peça centralizada com margem de 6%) → caixa
     * relativa à peça, que vale para o recorte em qualquer resolução.
     */
    static double[] logoRelative(double[] box1000, int cw, int ch) {
        if (box1000 == null || cw <= 0 || ch <= 0) {
            return null;
        }
        int size = 768, inner = (int) Math.round(size * (1 - 2 * 0.06));
        double sc = Math.min(inner / (double) cw, inner / (double) ch);
        int gw = (int) Math.round(cw * sc), gh = (int) Math.round(ch * sc);
        int x0 = (size - gw) / 2, y0 = (size - gh) / 2;
        double[] out = new double[4];
        for (int i = 0; i < 4; i++) {
            double px = box1000[i] * size / 1000.0;
            out[i] = Math.max(0, Math.min(1, i % 2 == 0 ? (px - x0) / gw : (px - y0) / gh));
        }
        return out[2] - out[0] >= 0.01 && out[3] - out[1] >= 0.01 ? out : null;
    }
}
