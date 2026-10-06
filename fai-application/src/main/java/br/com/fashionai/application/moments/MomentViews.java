package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Projeções JSON dos Momentos: nome/descrição no idioma da requisição (names_json), tema como camada (§50–§51). */
public final class MomentViews {
    private MomentViews() {
    }

    /** Texto localizado: names_json[idioma] → names_json[pt-BR] → campo base. */
    public static String localized(String base, String json) {
        if (json == null || json.isBlank()) {
            return base;
        }
        Map<String, Object> m = Json.map(json);
        Locale l = Msg.locale();
        String tag = l.getLanguage().equals("en") ? "en" : l.getLanguage().equals("es") ? "es" : "pt-BR";
        Object v = m.get(tag);
        if (v == null) {
            v = m.get("pt-BR");
        }
        return v == null ? base : String.valueOf(v);
    }

    /** Rótulo de uma interpretação: {"pt-BR":…} ou string simples. */
    @SuppressWarnings("unchecked")
    public static String label(Object label) {
        if (label instanceof Map<?, ?> m) {
            Locale l = Msg.locale();
            String tag = l.getLanguage().equals("en") ? "en" : l.getLanguage().equals("es") ? "es" : "pt-BR";
            Object v = ((Map<String, Object>) m).get(tag);
            if (v == null) {
                v = ((Map<String, Object>) m).get("pt-BR");
            }
            return v == null ? null : String.valueOf(v);
        }
        return label == null ? null : String.valueOf(label);
    }

    public static Map<String, Object> theme(Moment m) {
        Map<String, Object> t = new LinkedHashMap<>(Json.map(m.getThemeJson()));
        t.putIfAbsent("accent", null);
        t.putIfAbsent("background", null);
        t.putIfAbsent("gradient", null);
        t.putIfAbsent("icon", null);
        t.putIfAbsent("animation", "none");
        t.put("cover", m.getCoverUrl());
        t.put("banner", m.getBannerUrl());
        return t;
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> interpretations(Moment m) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> i : Json.list(m.getInterpretationsJson())) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("key", i.get("key"));
            v.put("label", label(i.get("label")));
            v.put("styleTags", i.getOrDefault("styleTags", List.of()));
            v.put("colorTags", i.getOrDefault("colorTags", List.of()));
            out.add(v);
        }
        return out;
    }

    /** Card resumido (home, calendário, listas). Sem dados de participantes de Momentos privados (§28). */
    public static Map<String, Object> card(Moment m, Instant now) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", m.getId());
        v.put("slug", m.getSlug());
        v.put("name", localized(m.getName(), m.getNamesJson()));
        v.put("description", localized(m.getDescription(), m.getDescriptionsJson()));
        v.put("type", m.getType().name());
        v.put("nature", m.getNature().name());
        v.put("scope", m.getScope().name());
        v.put("visibility", m.getVisibility().name());
        v.put("country", m.getCountry());
        v.put("region", m.getRegion());
        v.put("season", m.getSeason() == null ? null : m.getSeason().name());
        v.put("official", m.isOfficial());
        v.put("featured", m.isFeatured());
        v.put("sponsored", m.isSponsored());
        v.put("sponsorName", m.isSponsored() ? m.getSponsorName() : null);
        v.put("pointsEnabled", m.isPointsEnabled() && !m.getNature().sensitive());
        v.put("basePoints", m.getBasePoints());
        v.put("pointsMultiplier", m.getPointsMultiplier() == null ? 1.0 : m.getPointsMultiplier().doubleValue());
        v.put("styleTags", Json.csv(m.getStyleTags()));
        v.put("occasionTags", Json.csv(m.getOccasionTags()));
        v.put("colorTags", Json.csv(m.getColorTags()));
        v.put("theme", theme(m));
        v.put("time", MomentTime.view(m, now));
        v.put("participantCount", m.getVisibility().discoverable() ? m.getParticipantCount() : null);
        v.put("groupId", m.getGroupId());
        v.put("flairMode", m.getFlairMode() == null ? null : m.getFlairMode().name());
        v.put("cooperativeGoal", m.getCooperativeGoal());
        v.put("badgeCode", m.getBadgeCode());
        return v;
    }

    public static Map<String, Object> challenge(MomentChallenge c) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", c.getId());
        v.put("code", c.getCode());
        v.put("name", localized(c.getName(), c.getNamesJson()));
        v.put("description", localized(c.getDescription(), c.getDescriptionsJson()));
        v.put("kind", c.getKind().name());
        v.put("points", c.getPoints());
        v.put("styleTags", Json.csv(c.getStyleTags()));
        v.put("colorTags", Json.csv(c.getColorTags()));
        v.put("occasionTags", Json.csv(c.getOccasionTags()));
        v.put("params", Json.map(c.getParamsJson()));
        v.put("active", c.isActive());
        return v;
    }
}
