package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.application.service.FlairChallengeService.Window;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairChallengeService.OPEN;
import static br.com.fashionai.application.service.FlairChallengeService.UPCOMING;

/**
 * Funções puras dos Desafios de Montagem: visão curta do Momento, leitura escolhida e leituras do Momento no formato do
 * motor, multiplicador e pontos previstos (S3), e a leitura tolerante dos campos do desafio (vaga, posição, ids, listas,
 * datas e enums da administração). Colaborador do {@link FlairChallengeService} (R82).
 */
final class FlairChallengeValues {
    static Map<String, Object> momentView(Moment m) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", m.getId());
        v.put("slug", m.getSlug());
        v.put("name", MomentViews.localized(m.getName(), m.getNamesJson()));
        v.put("type", m.getType().name());
        v.put("nature", m.getNature().name());
        v.put("theme", MomentViews.theme(m));
        v.put("groupId", m.getGroupId());
        return v;
    }

    /** "Minha leitura" quando nada (ou uma leitura que o Momento não tem) é pedido: nunca um erro (P3). */
    static String interpretationOf(String asked, Moment m) {
        if (asked == null || asked.isBlank() || m == null) {
            return CbcRules.OWN;
        }
        boolean known = Json.list(m.getInterpretationsJson()).stream().anyMatch(i -> asked.equals(String.valueOf(i.get("key"))));
        return known ? asked : CbcRules.OWN;
    }

    @SuppressWarnings("unchecked")
    static List<CbcRules.Interpretation> interpretations(Moment m) {
        List<CbcRules.Interpretation> out = new ArrayList<>();
        for (Map<String, Object> i : Json.list(m.getInterpretationsJson())) {
            out.add(new CbcRules.Interpretation(String.valueOf(i.get("key")), Set.copyOf(strings(i.get("styleTags"))), Set.copyOf(strings(i.get("colorTags")))));
        }
        return out;
    }

    static double multiplier(Moment m, Window w) {
        if (m == null || !OPEN.equals(w.status()) && !UPCOMING.equals(w.status()) || !m.isPointsEnabled() || m.getNature().sensitive()) {
            return 1.0;
        }
        return m.getPointsMultiplier() == null ? 1.0 : m.getPointsMultiplier().doubleValue();
    }

    static int basePoints(FlairChallenge c, Moment m, Window w) {
        return BigDecimal.valueOf(c.getPoints()).multiply(BigDecimal.valueOf(multiplier(m, w))).setScale(0, RoundingMode.HALF_UP).intValue();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> accepts(Map<String, Object> slot) {
        return slot.get("accepts") instanceof Map<?, ?> a ? (Map<String, Object>) a : Map.of();
    }

    static String position(Object v) {
        return v == null ? CbcRules.ANY : String.valueOf(v).toUpperCase(Locale.ROOT);
    }

    static UUID uuid(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(v));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static List<String> strings(Object v) {
        if (v instanceof Collection<?> c) {
            return c.stream().filter(Objects::nonNull).map(String::valueOf).toList();
        }
        if (v instanceof String s && !s.isBlank()) {
            return List.of(s);
        }
        return List.of();
    }

    static Instant instant(String v, String field) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(v);
        } catch (RuntimeException e) {
            throw ApiException.badRequest("DATA_INVALIDA", Msg.t("cbc.admin.data_invalida"), Map.of("field", field));
        }
    }

    static <E extends Enum<E>> E enumOf(Class<E> type, String raw, String field) {
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("cbc.admin.invalido"), Map.of("field", field));
        }
    }
}
