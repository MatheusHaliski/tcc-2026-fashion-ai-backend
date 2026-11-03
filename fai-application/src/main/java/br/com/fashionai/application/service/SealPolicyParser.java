package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.application.service.SealPolicies.HypeCriteria;
import br.com.fashionai.application.service.SealPolicies.Policy;
import br.com.fashionai.application.service.SealPolicies.Rule;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.service.SealPolicies.HYPE_DIMENSIONS;
import static br.com.fashionai.application.service.SealPolicyValues.strings;
import static br.com.fashionai.application.service.SealPolicyValues.text;
import static br.com.fashionai.application.service.SealPolicyValues.upper;

/**
 * RF25/RF53 — leitura da política já gravada em {@code seals.background_config_json.policy}; valor desconhecido é
 * ignorado (o JSON salvo nunca derruba a leitura). Extraído de {@link SealPolicies} (R80).
 */
final class SealPolicyParser {
    private SealPolicyParser() {
    }

    static Policy parse(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        List<Rule> rules = new ArrayList<>();
        if (m.get("rules") instanceof Collection<?> c) {
            for (Object o : c) {
                if (o instanceof Map<?, ?> r) {
                    int count = r.get("count") instanceof Number n ? n.intValue() : 1;
                    rules.add(new Rule(upper(r.get("quantifier"), "AT_LEAST"), Math.max(1, count), text(r.get("color")),
                            text(r.get("brand")), text(r.get("category")), text(r.get("subcategory")), parseEnum(HypeLevel.class, r.get("hypeMin"))));
                }
            }
        }
        Policy p = new Policy("ANY".equals(upper(m.get("match"), "ALL")), rules, strings(m.get("occasions")), strings(m.get("styles")),
                parseHype(m.get("hype")), m.get("referenceModel") == null ? null : SealReferenceModels.normalize(m.get("referenceModel")));
        return p.isEmpty() ? null : p;
    }

    /** Critério de Hype já gravado (valor desconhecido é ignorado: o JSON salvo nunca derruba a leitura). */
    static HypeCriteria parseHype(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        Integer minScore = m.get("minScore") instanceof Number n ? Math.max(0, Math.min(100, n.intValue())) : null;
        List<HypeMomentum> momentum = new ArrayList<>();
        for (String x : strings(m.get("momentum"))) {
            HypeMomentum mm = parseEnum(HypeMomentum.class, x);
            if (mm != null && !momentum.contains(mm)) {
                momentum.add(mm);
            }
        }
        Map<String, Integer> dimensions = new LinkedHashMap<>();
        if (m.get("dimensionMins") instanceof Map<?, ?> values) values.forEach((key, value) -> {
            if (HYPE_DIMENSIONS.contains(String.valueOf(key)) && value instanceof Number n) dimensions.put(String.valueOf(key), n.intValue());
        });
        HypeCriteria c = new HypeCriteria(parseEnum(HypeLevel.class, m.get("minLevel")), minScore, List.copyOf(momentum), dimensions);
        return c.isEmpty() ? null : c;
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, Object raw) {
        String s = text(raw);
        if (s == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
