package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Context;
import br.com.fashionai.application.flair.CbcRules.Interpretation;
import br.com.fashionai.application.flair.CbcRules.Slot;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização (equivalência exata) de {@link CbcRules}: avaliação completa de mosaicos com todos os tipos de
 * requisito, o que cada vaga aceita, sintonia, validação da administração e utilitários, com entradas fixas.
 */
class CbcRulesCharacterizationTest {
    static final LocalDate TODAY = LocalDate.of(2026, 10, 25);
    static final Instant START = Instant.parse("2026-10-20T03:00:00Z");

    static UUID id(String n) {
        return UUID.nameUUIDFromBytes(n.getBytes(StandardCharsets.UTF_8));
    }

    static Set<String> set(String... v) {
        return new LinkedHashSet<>(List.of(v));
    }

    static Card card(String n, String pos, String tier, int ovr, String brand, String origin, Set<String> styles, Set<String> colors,
                     Set<String> occ, Set<String> mats, Map<String, Double> hype, int addedDaysAgo, Integer wornDaysAgo, String cat, String sub) {
        return new Card(id(n), pos, tier, ovr, brand, origin, styles, colors, occ, mats, hype,
                addedDaysAgo < 0 ? null : START.minusSeconds(86_400L * addedDaysAgo), wornDaysAgo == null ? null : TODAY.minusDays(wornDaysAgo), cat, sub);
    }

    static final List<Card> CARDS = List.of(
            card("a", "SUP", "OURO", 82, "Norte", "PIECE", set("edgy", "Grunge "), set("black"), set("party"), set("cotton"),
                    Map.of("HYP", 71.0, "POP", 40.0), 200, 5, "upper_piece", "t_shirt"),
            card("b", "INF", "PRATA", 66, "norte ", "PIECE", set("minimalist"), set("charcoal"), set("work", "party"), set("denim"),
                    Map.of("HYP", 30.0), 90, null, "lower_piece", "jeans"),
            card("c", "CAL", "BRONZE", 55, "Lumi", "CATALOG", set("sporty"), set("orange"), set(), set("leather"), null, -1, 70, "shoes_piece", "sneakers"),
            card("d", "ACE", "ESPECIAL", 91, null, "PIECE", set("romantic"), set("pink", "crimson"), set("date"), set(), Map.of(), 3, null,
                    "accessory_piece", "handbag"),
            card("e", "VES", "BRONZE", 49, "", "PIECE", null, set("navy"), set("formal"), set("silk"), Map.of("RAR", 88.0), 400, 1, "full_body_piece", "dress"),
            card("f", "SUP", "PRATA", 73, "Lumi", "PIECE", set("grunge", "basic"), set("multicolor"), set("party"), set(), null, 61, 61, "upper_piece", "hoodie"));

    static final List<Interpretation> READINGS = List.of(
            new Interpretation("dark", set("edgy", "grunge"), set("black", "gray")),
            new Interpretation("orange-black", Set.of(), set("orange", "black")),
            new Interpretation("minimal", set("minimalist", "basic"), set("black")));

    static Context ctx(String chosen, boolean theme) {
        return theme ? new Context(READINGS, set("romantic"), set("red"), set("formal"), chosen, START, TODAY)
                : new Context(null, null, null, null, chosen, null, null);
    }

    static Map<String, Object> req(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    static final List<Map<String, Object>> REQS = List.of(
            req("type", "tier", "only", "prata"), req("type", "tier", "max", "OURO"), req("type", "tier", "exact", "BRONZE", "count", 2),
            req("type", "tier", "min", "PRATA"), req("type", "tier"), req("type", "ovrAvg", "min", 60), req("type", "ovrMin", "min", 60),
            req("type", "ovrMin", "min", 60, "count", 3), req("type", "brand", "anyOf", List.of("Norte", "lumi"), "count", 3),
            req("type", "sintonia", "min", 7), req("type", "sameBrand", "count", 2), req("type", "distinctBrands", "count", 3),
            req("type", "tag", "field", "color", "anyOf", List.of("black", "red")), req("type", "tag", "field", "occasion", "anyOf", List.of("party"), "count", 2),
            req("type", "tag", "field", "material", "anyOf", List.of("silk")), req("type", "tag", "anyOf", List.of("grunge")),
            req("type", "theme", "count", 3), req("type", "hype", "dim", "hyp", "min", 50), req("type", "hype", "dim", "RAR", "min", 80, "count", 1),
            req("type", "origin"), req("type", "origin", "only", "catalog"), req("type", "noBuy"), req("type", "rediscovery", "count", 2),
            req("type", "rediscovery", "idleDays", 100), req("type", "strictPosition"), req("type", "desconhecido"));

    static List<Slot> slots() {
        return List.of(new Slot("s1", "SUP", Map.of("tier", List.of("ouro", "prata"), "minOvr", 70)),
                new Slot("s2", "INF", Map.of("brand", "Norte", "category", "lower_piece", "color", List.of("black"))),
                new Slot("s3", CbcRules.ANY, Map.of("style", "sporty", "occasion", List.of("party"), "origin", "piece")),
                new Slot("s4", "ACE"), new Slot("s5", null, Map.of("subcategory", List.of("dress"), "material", "silk", "tier", "BRONZE")),
                new Slot("s6", "SUP", null));
    }

    static Map<String, Card> board(int... idx) {
        Map<String, Card> b = new LinkedHashMap<>();
        for (int i = 0; i < idx.length; i++) {
            if (idx[i] >= 0) {
                b.put("s" + (i + 1), CARDS.get(idx[i]));
            }
        }
        return b;
    }

    @Test
    void avaliacaoRequisitosESintonia() {
        List<Object> r = new ArrayList<>();
        List<Slot> slots = slots();
        for (Map<String, Card> b : List.of(board(0, 1, 2, 3, 4, 5), board(5, 4, 3, 2, 1, 0), board(0, -1, 2, -1, 4, -1), board())) {
            for (Context c : List.of(ctx(CbcRules.OWN, true), ctx("dark", true), ctx("minimal", true), ctx(null, false))) {
                r.add(CbcRules.evaluate(slots, b, REQS, c));
                r.add(CbcRules.evaluate(slots, b, REQS, c).slots().stream().map(CbcRules.SlotResult::toMap).toList());
                r.add(CbcRules.evaluate(slots, b, REQS, c).requirements().stream().map(CbcRules.RequirementResult::toMap).toList());
            }
        }
        r.add(CbcRules.evaluate(slots, null, null, ctx(null, true)));
        for (Card c : CARDS) {
            for (Slot s : slots) {
                r.add(CbcRules.misses(s, c));
            }
            for (Context x : List.of(ctx(CbcRules.OWN, true), ctx("orange-black", true), ctx(null, false))) {
                r.add(CbcRules.themeAny(c, x));
            }
            r.add(List.of(CbcRules.idleDays(c, TODAY), CbcRules.idleDays(c, null)));
        }
        r.add(CbcRules.misses(slots.get(0), null));
        r.add(CbcRules.suggestInterpretation(CARDS, READINGS));
        r.add(CbcRules.suggestInterpretation(List.of(), READINGS));
        assertThat(Retrato.sha("cbc-avaliacao", r)).isEqualTo("a4a68836fa7009b70c1d379a6bf9c5f3a428f03d34ece766b7d4a5ed5302b1d4");
    }

    @Test
    void coresValidacaoEUtilitarios() {
        List<Object> r = new ArrayList<>();
        List<String> colors = List.of("black", "white", "red", "crimson", "orange", "yellow", "green", "navy", "blue", "purple", "pink",
                "charcoal", "beige", "multicolor", "print", "xyz");
        for (String x : colors) {
            for (String y : colors) {
                r.add(CbcRules.colorHarmony(x, y));
            }
        }
        r.add(CbcRules.colorHarmony(null, "red"));
        r.add(CbcRules.levelOpen(null));
        r.add(CbcRules.levelOpen(List.of(req("type", "tier", "min", "BRONZE"), req("type", "ovrAvg", "min", 90))));
        r.add(CbcRules.levelOpen(List.of(req("type", "tier", "min", "prata"))));
        r.add(CbcRules.levelOpen(List.of(req("type", "tier", "exact", "OURO"))));
        r.add(CbcRules.levelOpen(List.of(req("type", "tier", "only", "ESPECIAL"))));
        r.add(CbcRules.hasTheme(null));
        r.add(CbcRules.hasTheme(REQS));
        r.add(CbcRules.hasTheme(REQS.subList(0, 3)));
        List<Slot> slots = slots();
        r.add(CbcRules.validate(slots, REQS));
        r.add(CbcRules.validate(null, REQS));
        r.add(CbcRules.validate(slots.subList(0, 2), REQS));
        List<Slot> bad = List.of(new Slot("ok", "SUP"), new Slot("ok", "XX"), new Slot("Maiúscula", null),
                new Slot("acc", "ANY", new LinkedHashMap<>(Map.of("tier", "OURO"))), new Slot(null, "LOOK"));
        List<Map<String, Object>> badReqs = List.of(req("type", 3), req("type", "tier", "min", "DIAMANTE"), req("type", "tier"),
                req("type", "tag", "field", "brand", "anyOf", List.of("x")), req("type", "tag", "field", "style"), req("type", "brand"),
                req("type", "hype", "dim", "xyz"), req("type", "hype"), req("type", "ovrMin", "count", 0), req("type", "ovrMin", "count", 9),
                req("type", "theme", "count", 2));
        r.add(CbcRules.validate(bad, badReqs));
        r.add(List.of(CbcRules.POSITIONS, CbcRules.TYPES, CbcRules.ACCEPT_KEYS, CbcRules.TAG_FIELDS, CbcRules.HYPE_DIMS, CbcRules.TIERS,
                CbcRules.ANY, CbcRules.OWN, CbcRules.REDISCOVERY_DAYS, CbcRules.MIN_SLOTS, CbcRules.MAX_SLOTS));
        r.add(CbcRules.norm(java.util.Arrays.asList(" B ", "a", null, "", "b")));
        r.add(new Card(id("z"), "SUP", "OURO", 1, null, null, null, null, null, null, null, null, null));
        assertThat(Retrato.sha("cbc-cores", r)).isEqualTo("33fa5d5b1b86980bf6970e6784a393f22621f8cde91f1f105ba97aff5d3ef05b");
    }
}
