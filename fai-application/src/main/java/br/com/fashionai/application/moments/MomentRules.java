package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentParticipation;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.MomentParticipationStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Regras puras dos Momentos: arredondamento, desfecho, explicação, contagens e o que fica público sem observador. */
final class MomentRules {
    private MomentRules() {
    }

    static UUID idOf(CurrentUser user) {
        return user == null ? null : user.id();
    }

    static Integer rounded(Double v) {
        return v == null ? null : (int) Math.round(v);
    }

    static String outcome(MomentParticipation p) {
        if (p.getRanking() != null && p.getRanking() == 1) {
            return "WINNER";
        }
        if (p.getPercentile() != null && p.getPercentile() <= 10) {
            return "TOP_10";
        }
        if (p.getStatus() == MomentParticipationStatus.COMPLETED) {
            return "COMPLETED";
        }
        return "PARTICIPATED";
    }

    static Integer contextualHype(Double hype, Integer match) {
        if (hype == null || match == null) {
            return null;
        }
        return (int) Math.max(0, Math.min(100, Math.round(hype + (match - 50) * 0.5)));
    }

    /** Explicação do MomentMatch (§13): razões, nunca um veredito. */
    static List<Map<String, Object>> explain(MomentMatch.Result r) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (r == null) {
            return out;
        }
        for (String reason : r.reasons()) {
            int i = reason.indexOf(':');
            String kind = i < 0 ? reason : reason.substring(0, i);
            List<String> values = i < 0 ? List.of() : Json.csv(reason.substring(i + 1));
            out.add(Map.of("kind", kind, "values", values));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    static List<String> strings(Object v) {
        return v instanceof List<?> l ? ((List<Object>) l).stream().map(String::valueOf).toList() : List.of();
    }

    /**
     * Elegível para o que fica PÚBLICO sem um observador (ranking final, vencedor e destaques da Memória): em Momentos
     * públicos, só looks PUBLIC; em Momentos de grupo ou não descobríveis, todos (só membros/administração os veem).
     */
    static boolean publiclyListed(Moment m, Scheme sc) {
        return sc != null && (m.getGroupId() != null || !m.getVisibility().discoverable() || sc.getVisibility() == Visibility.PUBLIC);
    }

    static List<Map<String, Object>> top(Map<String, Integer> counts, int limit) {
        return counts.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).limit(limit)
                .map(e -> Map.<String, Object>of("key", e.getKey(), "count", e.getValue())).toList();
    }

    static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    static <T> Collection<T> nonNull(Collection<T> c) {
        return c == null ? List.of() : c;
    }

    static <K, V> Map<K, V> index(Collection<V> values, Function<V, K> key) {
        return values.stream().collect(Collectors.toMap(key, v -> v, (a, b) -> a));
    }
}
