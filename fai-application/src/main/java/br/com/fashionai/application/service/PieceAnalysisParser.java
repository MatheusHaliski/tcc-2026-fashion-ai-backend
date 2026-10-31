package br.com.fashionai.application.service;

import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.enums.ModerationStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.AiResponseJson.extractJson;
import static br.com.fashionai.application.service.AiResponseJson.logoBox;
import static br.com.fashionai.application.service.AiResponseJson.oneOf;
import static br.com.fashionai.application.service.AiResponseJson.str;
import static br.com.fashionai.application.service.AiResponseJson.strings;
import static br.com.fashionai.application.service.PieceAnalyzerPrompts.ANALYZER_DIMENSIONS;

/**
 * Respostas da IA na análise da peça (RF4) → valores validados pela taxonomia: palpite da peça, moderação e leitura da
 * marca nos recortes. Nada fora do vocabulário entra; resposta ilegível vira {@code null} (o motor usa o fallback local).
 */
final class PieceAnalysisParser {
    private PieceAnalysisParser() {
    }

    static LocalVision.PieceGuess parseAnalysis(String text) {
        return parseAnalysis(text, null);
    }

    /**
     * Variação e atributos da resposta da IA (C.6): só códigos do vocabulário da subcategoria (código exato ou alias),
     * atributos só com confiança ≥ 0,75 e no máximo o teto de cada dimensão. O resto é descartado, nunca gravado como veio.
     */
    static LocalVision.Insights withTaxonomy(LocalVision.Insights base, Map<String, Object> m, String category, String sub) {
        if (sub == null || category == null) {
            return base;
        }
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        String variation = null;
        double vConf = 0;
        if (m.get("variation") instanceof Map<?, ?> vm && str(vm.get("code")) != null) {
            String raw = str(vm.get("code")).trim();
            String up = raw.toUpperCase(Locale.ROOT);
            variation = reg.isVariationOf(sub, up) ? up : reg.variationByText(sub, raw).orElse(null);
            vConf = vm.get("confidence") instanceof Number n ? Math.max(0, Math.min(1, n.doubleValue())) : 0;
        }
        Map<String, List<String>> attrs = new LinkedHashMap<>();
        if (m.get("attributes") instanceof Map<?, ?> am) {
            am.forEach((k, v) -> {
                String dim = String.valueOf(k).toUpperCase(Locale.ROOT);
                if (!ANALYZER_DIMENSIONS.contains(dim) || !(v instanceof Map<?, ?> dm)) {
                    return;
                }
                double conf = dm.get("confidence") instanceof Number n ? n.doubleValue() : 0;
                int max = reg.dimension(dim).map(TaxonomyRegistry.Dimension::maxPerPiece).orElse(1);
                List<String> codes = strings(dm.get("codes")).stream()
                        .map(x -> reg.isAllowed(dim, x.trim().toUpperCase(Locale.ROOT), category, sub) ? x.trim().toUpperCase(Locale.ROOT)
                                : reg.valueByText(dim, category, sub, x).orElse(null))
                        .filter(java.util.Objects::nonNull).distinct().limit(max).toList();
                if (conf >= 0.75 && !codes.isEmpty()) {
                    attrs.put(dim, codes);
                }
            });
        }
        return new LocalVision.Insights(base.name(), base.occasion(), base.style(), base.brandZone(), base.brandEvidence(),
                base.matchesCategory(), base.detectedCategory(), base.fullyVisible(), base.viewAngle(), base.singlePiece(),
                base.photoConfidence(), base.ranking(), vConf >= 0.40 ? variation : null, Math.round(vConf * 100) / 100.0, attrs);
    }

    /**
     * Resposta do analisador → palpite validado pela taxonomia: nada fora do vocabulário entra. Com o tipo escolhido pela
     * pessoa, a categoria é a dela e o subtipo só vale se for desse tipo (senão, o primeiro do ranking da IA que for).
     */
    static LocalVision.PieceGuess parseAnalysis(String text, String chosen) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        String category = str(m.get("category"));
        String sub = Taxonomy.activeSubcategory(str(m.get("subcategory")));          // legado → código novo
        String detected = Taxonomy.isValidCategory(str(m.get("detectedCategory"))) ? str(m.get("detectedCategory"))
                : Taxonomy.isValidCategory(category) ? category : null;
        List<SubtypeReferences.Match> ranking = new ArrayList<>();
        if (m.get("subcategoryRanking") instanceof List<?> rl) {
            for (Object o : rl) {
                if (o instanceof Map<?, ?> rm && str(rm.get("code")) != null && Taxonomy.categoryOf(str(rm.get("code"))) != null) {
                    double sim = rm.get("similarity") instanceof Number n ? Math.max(0, Math.min(1, n.doubleValue())) : 0;
                    String code = Taxonomy.activeSubcategory(str(rm.get("code")));
                    if (ranking.stream().noneMatch(x -> x.subcategory().equals(code))) {
                        ranking.add(new SubtypeReferences.Match(code, Math.round(sim * 1000) / 1000.0));
                    }
                }
            }
        }
        if (chosen != null) {
            category = chosen;
            List<String> allowed = Taxonomy.SUBCATEGORIES.get(chosen);
            ranking.removeIf(x -> !allowed.contains(x.subcategory()));
            if (sub == null || !allowed.contains(sub)) {
                sub = ranking.isEmpty() ? null : ranking.get(0).subcategory();
            }
        } else if (sub != null && Taxonomy.categoryOf(sub) != null) {
            category = Taxonomy.categoryOf(sub);
        } else if (!Taxonomy.isValidCategory(category)) {
            category = null;
            sub = null;
        } else {
            sub = null;
        }
        // campo ausente ou null na resposta não pode derrubar o parser: List.of(...).contains(null) lança NPE, o motor
        // tomava a resposta inteira por falha do provedor e caía no motor local (que não lê marca)
        String color = oneOf(str(m.get("color")), Taxonomy.COLORS.keySet());
        String material = oneOf(str(m.get("material")), Taxonomy.MATERIALS);
        String sex = oneOf(str(m.get("sex")), Taxonomy.SEXES);
        Map<String, Double> conf = new LinkedHashMap<>();
        Object c = m.get("confidence");
        if (c instanceof Map<?, ?> cm) {
            cm.forEach((k, v) -> conf.put(String.valueOf(k), v instanceof Number n ? n.doubleValue() : 0.0));
        }
        double photoConf = conf.getOrDefault("photo", 0.0);
        conf.remove("photo");
        double overall = conf.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.5);
        Map<?, ?> photo = m.get("photo") instanceof Map<?, ?> pm ? pm : Map.of();
        String name = str(m.get("name"));
        LocalVision.Insights insights = new LocalVision.Insights(
                name == null || name.isBlank() ? null : InputSanitizer.clean(name, 80),
                Taxonomy.keepAllowed(strings(m.get("occasion")), Taxonomy.allowedOccasions(category), 2),
                Taxonomy.keepAllowed(strings(m.get("style")), Taxonomy.STYLES, 2),
                str(m.get("brandZone")), str(m.get("brandEvidence")),
                m.get("matchesCategory") instanceof Boolean b ? b : null, detected,
                photo.get("fullyVisible") instanceof Boolean b ? b : null, str(photo.get("viewAngle")),
                photo.get("singlePiece") instanceof Boolean b ? b : null, photoConf, ranking);
        insights = withTaxonomy(insights, m, category, sub);
        return new LocalVision.PieceGuess(category, sub, color, material, brandName(str(m.get("brand"))), sex, conf,
                Math.round(overall * 100) / 100.0, List.of(), logoBox(m.get("logo")), insights);
    }

    /** Nome de marca da IA: "null", "none", "sem marca" e afins não são marca; texto limpo e curto. */
    static String brandName(String raw) {
        if (raw == null) {
            return null;
        }
        String b = raw.trim();
        if (b.isEmpty() || b.length() > 60 || Set.of("null", "none", "n/a", "desconhecida", "unknown", "nenhuma", "generic", "genérica")
                .contains(b.toLowerCase(Locale.ROOT)) || isNoBrandPlaceholder(b)) {
            return null;
        }
        return InputSanitizer.clean(b, 60);
    }

    /**
     * "Sem marca" é o que a análise escreve no campo quando não acha marca na gola nem no peito: o campo nunca fica em
     * branco na tela, mas a peça é salva sem marca (nada de uma marca fictícia chamada "Sem marca" no card).
     */
    static boolean isNoBrandPlaceholder(String name) {
        String n = name.trim();
        return java.util.stream.Stream.of(Locale.forLanguageTag("pt-BR"), Locale.ENGLISH, Locale.forLanguageTag("es"))
                .anyMatch(l -> n.equalsIgnoreCase(Msg.t(l, "wardrobe.sem_marca")));
    }

    static LocalVision.ModerationVerdict parseModeration(String text) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        boolean clothing = Boolean.TRUE.equals(m.get("isClothing"));
        boolean safe = Boolean.TRUE.equals(m.get("safe"));
        double conf = m.get("confidence") instanceof Number n ? n.doubleValue() : 0.5;
        List<String> cats = m.get("categories") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of();
        if (!safe) {
            return new LocalVision.ModerationVerdict(conf >= 0.85 ? ModerationStatus.REJECTED_POLICY : ModerationStatus.PENDING,
                    conf, cats.isEmpty() ? List.of(Msg.t("wardrobe.conteudo_possivelmente_improprio")) : cats, true);
        }
        if (!clothing) {
            return new LocalVision.ModerationVerdict(conf >= 0.85 ? ModerationStatus.REJECTED_NOT_CLOTHING : ModerationStatus.PENDING,
                    conf, List.of(Msg.t("wardrobe.a_imagem_nao_parece_ser")), true);
        }
        return new LocalVision.ModerationVerdict(conf >= 0.6 ? ModerationStatus.APPROVED : ModerationStatus.PENDING, conf,
                List.of(Msg.t("wardrobe.peca_de_roupa_sem_violacao")), conf < 0.6);
    }

    /** Resposta da IA sobre os recortes → {brand, image, text, confidence}; marca vazia ou fraca = sem marca. */
    static Map<String, Object> parseBrandTiles(String text) {
        Map<String, Object> m = extractJson(text);
        if (m.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>(m);
        String b = brandName(str(m.get("brand")));
        double conf = m.get("confidence") instanceof Number n ? n.doubleValue() : 0.7;
        out.put("brand", b != null && conf >= 0.5 ? b : null);
        return out;
    }
}
