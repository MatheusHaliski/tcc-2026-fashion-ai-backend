package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.SealPolicies.HYPE_DIMENSIONS;
import static br.com.fashionai.application.service.SealPolicies.MAX_HYPE_MOMENTUM;
import static br.com.fashionai.application.service.SealPolicies.MAX_RULES;
import static br.com.fashionai.application.service.SealPolicies.MAX_TAGS;
import static br.com.fashionai.application.service.SealPolicies.QUANTIFIERS;
import static br.com.fashionai.application.service.SealPolicyValues.strings;
import static br.com.fashionai.application.service.SealPolicyValues.text;
import static br.com.fashionai.application.service.SealPolicyValues.upper;

/**
 * RF25/RF53 — validação do JSON da política vindo da tela (regras, tags, critério de Hype, modelo de referência e
 * modo); erros viram 400 legíveis. Extraído de {@link SealPolicies} (R80).
 */
final class SealPolicyNormalizer {
    private SealPolicyNormalizer() {
    }

    /** Valida o JSON vindo da tela; devolve null quando não há política (selo sem regras). Erros viram 400 legíveis. */
    static Map<String, Object> normalize(Map<String, Object> raw) {
        if (raw == null) {
            return null;
        }
        List<Map<String, Object>> rules = new ArrayList<>();
        Object rs = raw.get("rules");
        if (rs instanceof Collection<?> c) {
            for (Object o : c) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                String q = upper(m.get("quantifier"), "AT_LEAST");
                if (!QUANTIFIERS.contains(q)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantificador_invalido", q));
                }
                int count = 1;
                if (m.get("count") instanceof Number n) {
                    count = n.intValue();
                } else if (m.get("count") != null && !String.valueOf(m.get("count")).isBlank()) {
                    try {
                        count = Integer.parseInt(String.valueOf(m.get("count")).trim());
                    } catch (NumberFormatException e) {
                        throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                    }
                }
                if ("AT_LEAST".equals(q) && (count < 1 || count > 4)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                }
                String color = text(m.get("color"));
                if (color != null && !Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) && !families().contains(color)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.cor_fora_da_taxonomia", color));
                }
                String category = text(m.get("category"));
                if (category != null && !Taxonomy.SUBCATEGORIES.containsKey(category)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", category));
                }
                String sub = text(m.get("subcategory"));
                if (sub != null && !Taxonomy.isSubcategory(sub)) {                        // ativa ou LEGACY
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", sub));
                }
                String brand = text(m.get("brand"));
                if (brand != null && brand.length() > 80) {
                    brand = brand.substring(0, 80);
                }
                HypeLevel hypeMin = level(m.get("hypeMin"));   // RF53: Hype mínimo da peça também é filtro
                if (color == null && brand == null && category == null && sub == null && hypeMin == null) {
                    continue;                                   // regra sem filtro nenhum não diz nada
                }
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("quantifier", q);
                r.put("count", "AT_LEAST".equals(q) ? count : null);
                r.put("color", color == null ? null : (Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) ? color.toLowerCase(Locale.ROOT) : color));
                r.put("brand", brand);
                r.put("category", category);
                r.put("subcategory", sub);
                if (hypeMin != null) {
                    r.put("hypeMin", hypeMin.name());           // só quando existe: política sem Hype fica igual à de antes
                }
                rules.add(r);
            }
        }
        if (rules.size() > MAX_RULES) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.regras_demais", MAX_RULES));
        }
        List<String> occasions = tags(raw.get("occasions"), Taxonomy.OCCASIONS);
        List<String> styles = tags(raw.get("styles"), Taxonomy.STYLES);
        Map<String, Object> hype = normalizeHype(raw.get("hype"));
        Map<String, Object> reference = raw.get("referenceModel") == null ? null : SealReferenceModels.normalize(raw.get("referenceModel"));
        String mode = upper(raw.get("mode"), "");
        if (!mode.isEmpty() && !Set.of("HYPE", "REFERENCE").contains(mode))
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_policy"));
        if ("HYPE".equals(mode) && (hype == null || reference != null))
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_policy"));
        if (rules.isEmpty() && occasions.isEmpty() && styles.isEmpty() && hype == null && reference == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if ("MANUAL".equals(raw.get("generationMode"))) out.put("generationMode", "MANUAL");
        out.put("match", "ANY".equals(upper(raw.get("match"), "ALL")) ? "ANY" : "ALL");
        out.put("rules", rules);
        out.put("occasions", occasions);
        out.put("styles", styles);
        if (!mode.isEmpty()) out.put("mode", mode);
        if (hype != null) {
            out.put("hype", hype);
        }
        if (reference != null) out.put("referenceModel", reference);
        return out;
    }

    /**
     * RF53 — critério de Hype da política: {@code minLevel} (HypeLevel), {@code minScore} (inteiro 0–100) e
     * {@code momentum} (até {@value SealPolicies#MAX_HYPE_MOMENTUM} HypeMomentum). Nulo quando não há critério nenhum.
     */
    static Map<String, Object> normalizeHype(Object raw) {
        if (!(raw instanceof Map<?, ?> m)) {
            return null;
        }
        HypeLevel minLevel = level(m.get("minLevel"));
        Integer minScore = null;
        Object sc = m.get("minScore");
        if (sc != null && !String.valueOf(sc).isBlank() && !"null".equals(String.valueOf(sc).trim())) {
            double v;
            if (sc instanceof Number n) {
                v = n.doubleValue();
            } else {
                try {
                    v = Double.parseDouble(String.valueOf(sc).trim().replace(',', '.'));
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido"));
                }
            }
            if (Double.isNaN(v) || v < 0 || v > 100 || v != Math.rint(v)) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido"));
            }
            minScore = (int) v;
        }
        List<String> raws = strings(m.get("momentum"));
        if (raws.size() > MAX_HYPE_MOMENTUM) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.momentos_demais", MAX_HYPE_MOMENTUM));
        }
        List<String> momentum = new ArrayList<>();
        for (String x : raws) {
            String k = x.toUpperCase(Locale.ROOT);
            try {
                HypeMomentum.valueOf(k);
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.momento_invalido", x));
            }
            if (!momentum.contains(k)) {
                momentum.add(k);
            }
        }
        Map<String, Integer> dimensionMins = new LinkedHashMap<>();
        if (m.get("dimensionMins") != null) {
            if (!(m.get("dimensionMins") instanceof Map<?, ?> values))
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_dimension"));
            for (Map.Entry<?, ?> entry : values.entrySet()) {
                String key = String.valueOf(entry.getKey()).toUpperCase(Locale.ROOT);
                if (!HYPE_DIMENSIONS.contains(key)) throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_dimension"));
                double value;
                try { value = Double.parseDouble(String.valueOf(entry.getValue())); }
                catch (NumberFormatException ex) { throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido")); }
                if (!Double.isFinite(value) || value < 0 || value > 100 || value != Math.rint(value))
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido"));
                dimensionMins.put(key, (int) value);
            }
        }
        if (minLevel == null && minScore == null && momentum.isEmpty() && dimensionMins.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minLevel", minLevel == null ? null : minLevel.name());
        out.put("minScore", minScore);
        out.put("momentum", momentum);
        if (!dimensionMins.isEmpty()) out.put("dimensionMins", dimensionMins);
        return out;
    }

    /** Nível de Hype vindo da tela (nulo/vazio = sem filtro); fora de HypeLevel vira 400. */
    static HypeLevel level(Object raw) {
        String s = text(raw);
        if (s == null) {
            return null;
        }
        try {
            return HypeLevel.valueOf(s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.nivel_invalido", s));
        }
    }

    static Set<String> families() {
        return new LinkedHashSet<>(Taxonomy.COLOR_FAMILY.values());
    }

    static List<String> tags(Object o, List<String> allowed) {
        List<String> out = new ArrayList<>();
        for (String s : strings(o)) {
            String k = s.toLowerCase(Locale.ROOT).trim();
            if (!allowed.contains(k)) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tag_fora_da_taxonomia", s));
            }
            if (!out.contains(k)) {
                out.add(k);
            }
        }
        if (out.size() > MAX_TAGS) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tags_demais", MAX_TAGS));
        }
        return out;
    }
}
