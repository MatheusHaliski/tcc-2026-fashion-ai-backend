package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.moments.MomentViews;
import br.com.fashionai.domain.model.FlairChallenge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** FLAIR 3D MAKE UP — montagem dos JSONs do catálogo e do jogo sobre as projeções do CBC (§1.4 do desenho). */
final class FlairGameViews {
    private FlairGameViews() {
    }

    static final List<String> HYPE_SUMMARY = List.of("deckMin", "mandatoryMin", "mandatoryMax");
    static final List<String> EFFECT_KINDS = List.of("comum", "metamorfose", "impersonation");

    /** GameSummary = resumo do CBC + número, série, distrito, raridade, níveis exigidos, capa, deck, Hype, acesso e recompensas. */
    static Map<String, Object> summary(Map<String, Object> v, FlairChallenge g, Flair3dAccess.Access access) {
        v.put("number", g.getGameNumber());
        v.put("series", g.getSeries());
        v.put("district", g.getDistrict());
        v.put("rarity", g.getRarity());
        v.put("requiredTier", g.getRequiredLevel());
        v.put("requiredWardrobeLevel", g.getRequiredWardrobeLevel());
        v.put("thumbnail", g.getThumbnail());
        v.put("deck", Json.map(g.getDeckJson()));
        Map<String, Object> hype = Json.map(g.getHypeJson());
        Map<String, Object> h = new LinkedHashMap<>();
        HYPE_SUMMARY.forEach(k -> h.put(k, hype.get(k)));
        v.put("hype", h);
        v.put("access", access.toMap());
        v.put("rewards", Flair3dRewards.promised(g));
        return v;
    }

    /** Detalhe: ficha (7 textos no idioma), cena, regras de Hype e as vagas com {@code optional}, efeitos e bônus. */
    static Map<String, Object> detail(Map<String, Object> v, FlairChallenge g) {
        v.put("ficha", localized(Json.map(g.getFichaJson())));
        v.put("scene", Json.map(g.getSceneJson()));
        v.put("hypeRules", Json.map(g.getHypeJson()));
        v.put("slots", slots(v.get("slots"), g));
        return v;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> slots(Object cbcSlots, FlairChallenge g) {
        Map<String, Map<String, Object>> raw = rawSlots(g);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : cbcSlots instanceof List<?> l ? l : List.of()) {
            Map<String, Object> s = new LinkedHashMap<>((Map<String, Object>) o);
            Map<String, Object> r = raw.getOrDefault(String.valueOf(s.get("key")), Map.of());
            s.put("optional", Boolean.TRUE.equals(FlairChallengeService.accepts(r).get("optional")));
            s.put("effects", effects(r));
            s.put("bonus", r.get("bonus") instanceof Map<?, ?> b ? b : Map.of());
            out.add(s);
        }
        return out;
    }

    /** Vagas cruas do {@code slots_json}, por chave, na ordem do desafio. */
    static Map<String, Map<String, Object>> rawSlots(FlairChallenge g) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        for (Map<String, Object> s : Json.list(g.getSlotsJson())) {
            out.put(String.valueOf(s.get("key")), s);
        }
        return out;
    }

    /** Textos dos efeitos de uma vaga no idioma de quem lê: {comum, metamorfose, impersonation}. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> effects(Map<String, Object> rawSlot) {
        Map<String, Object> src = rawSlot.get("effects") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        EFFECT_KINDS.forEach(k -> out.put(k, MomentViews.label(src.get(k))));
        return out;
    }

    static Map<String, Object> localized(Map<String, Object> texts) {
        Map<String, Object> out = new LinkedHashMap<>();
        texts.forEach((k, v) -> out.put(k, MomentViews.label(v)));
        return out;
    }

    /** Contadores do catálogo (por série, dificuldade, raridade e nível), em ordem alfabética das chaves. */
    static Map<String, Object> counts(List<FlairChallenge> games) {
        Map<String, Integer> bySeries = new TreeMap<>();
        Map<String, Integer> byDifficulty = new TreeMap<>();
        Map<String, Integer> byRarity = new TreeMap<>();
        Map<String, Integer> byTier = new TreeMap<>();
        for (FlairChallenge c : games) {
            bySeries.merge(String.valueOf(c.getSeries()), 1, Integer::sum);
            byDifficulty.merge(c.getDifficulty().name(), 1, Integer::sum);
            byRarity.merge(String.valueOf(c.getRarity()), 1, Integer::sum);
            byTier.merge(String.valueOf(c.getRequiredLevel()), 1, Integer::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bySeries", bySeries);
        out.put("byDifficulty", byDifficulty);
        out.put("byRarity", byRarity);
        out.put("byTier", byTier);
        return out;
    }

    /** Reconstrói os resultados por vaga a partir do {@code evaluation.slots} que o CBC devolve. */
    @SuppressWarnings("unchecked")
    static List<CbcRules.SlotResult> slotResults(Map<String, Object> evaluation) {
        List<CbcRules.SlotResult> out = new ArrayList<>();
        Object slots = evaluation == null ? null : evaluation.get("slots");
        for (Object o : slots instanceof List<?> l ? l : List.of()) {
            Map<String, Object> s = (Map<String, Object>) o;
            out.add(new CbcRules.SlotResult(String.valueOf(s.get("slot")), s.get("position") == null ? null : String.valueOf(s.get("position")),
                    FlairChallengeService.uuid(s.get("cardId")), Boolean.TRUE.equals(s.get("positionOk")), Boolean.TRUE.equals(s.get("neighbor")),
                    Boolean.TRUE.equals(s.get("theme")), intOf(s.get("sintonia")), !Boolean.FALSE.equals(s.get("accepted")),
                    s.get("misses") instanceof List<?> m ? (List<String>) m : List.of()));
        }
        return out;
    }

    static int intOf(Object v) {
        return v instanceof Number n ? n.intValue() : 0;
    }

    static UUID uuid(Map<String, Object> out, String key) {
        return out.get(key) instanceof Map<?, ?> m ? FlairChallengeService.uuid(m.get("id")) : null;
    }

    /** A abertura da história é o cenário da ficha, em todos os idiomas ({key:null, text:{…}}); o resto da história fica. */
    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> story(Object story, FlairChallenge g) {
        List<Map<String, Object>> lines = new ArrayList<>(story instanceof List<?> l ? (List<Map<String, Object>>) l : List.of());
        Object scenario = Json.map(g.getFichaJson()).get("scenario");
        if (!lines.isEmpty() && scenario instanceof Map<?, ?> text) {
            Map<String, Object> open = new LinkedHashMap<>();
            open.put("key", null);
            open.put("vars", Map.of());
            open.put("text", text);
            lines.set(0, open);
        }
        return lines;
    }

    /** Linha FLAIR_3D_PERFECT somada a {@code points} ({@code award} nulo = prévia do check). */
    @SuppressWarnings("unchecked")
    static void perfectLine(Map<String, Object> out, FlairChallenge g, FaiPointsService.Award award) {
        Map<String, Object> line = new LinkedHashMap<>(new FlairChallengeService.Line("FLAIR_3D_PERFECT", FlairGameService.PERFECT_BONUS,
                g.getId().toString(), "perfect").toMap());
        if (award != null) {
            line.put("granted", award.granted());
            line.put("capReached", award.capReached());
        }
        Map<String, Object> pts = out.get("points") instanceof Map<?, ?> p ? (Map<String, Object>) p : Map.of();
        List<Map<String, Object>> lines = new ArrayList<>(pts.get("lines") instanceof List<?> l ? (List<Map<String, Object>>) l : List.of());
        lines.add(line);
        int granted = award == null ? FlairGameService.PERFECT_BONUS : award.granted() ? award.points() : 0;
        Map<String, Object> points = new LinkedHashMap<>();
        points.put("lines", lines);
        points.put("total", intOf(pts.get("total")) + granted);
        out.put("points", points);
    }
}
