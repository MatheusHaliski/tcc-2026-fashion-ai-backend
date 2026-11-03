package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.flair.FlairEngine.Hype;
import br.com.fashionai.application.flair.FlairEngine.PieceInput;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização (equivalência exata) de {@link FlairEngine} e {@link FlairLooks} com entradas fixas: cada retrato
 * cobre todas as funções públicas e as package-private com regra própria, e o digest congela o resultado.
 */
class FlairEngineLooksCharacterizationTest {
    static final List<String> SEASONS = List.of("SUMMER", "AUTUMN", "WINTER", "SPRING");

    static PieceInput piece(String id, String cat, String sub, String hex, String brand, boolean registered, List<String> styles,
                            List<String> occ, String material, Double quality, int flags, Hype hype, int seals) {
        return new PieceInput(id, "Peça " + id, cat, sub, "img/" + id, hex, brand, registered, registered ? "owner-" + brand : null, styles,
                occ, material, quality, (flags & 1) != 0, (flags & 2) != 0, (flags & 4) != 0, (flags & 8) != 0, (flags & 16) != 0, hype, seals);
    }

    static final List<PieceInput> PIECES = List.of(
            piece("tee", "upper_piece", "t_shirt", "#FFFFFF", "Norte", true, List.of("streetwear", "y2k"), List.of("festival", "casual", "party"),
                    "COTTON", 0.7, 0, Hype.NONE, 0),
            piece("cargo", "lower_piece", "cargo_pants", "#111111", "Norte", true, List.of("Streetwear ", "utility", ""), List.of("festival", "casual"),
                    "DENIM", null, 2, new Hype(70.0, "HOT", 62.0), 0),
            piece("dunk", "shoes_piece", "casual_sneakers", "#E0457B", "Norte", false, List.of("streetwear", "urban"), List.of("festival", "casual"),
                    "LEATHER", 0.95, 1, new Hype(88.0, "NICHE", 80.0), 1),
            piece("coat", "upper_piece", "coat", "#3355AA", "Lume", true, List.of("statement", "avant_garde"), List.of("work", "formal"),
                    "WOOL", 0.2, 4, new Hype(91.0, "VIRAL", 90.0), 0),
            piece("blazer", "upper_piece", "blazer", "#222222", "Lume", true, List.of("tailored", "minimalist"), List.of("work", "business"),
                    "WOOL", 0.8, 1 | 8, new Hype(40.0, "EMERGING", 20.0), 0),
            piece("pants", "lower_piece", "tailored_pants", "#222222", "Lume", true, List.of("tailored"), List.of("work", "business"),
                    "WOOL", 0.5, 16, Hype.NONE, 0),
            piece("loafer", "shoes_piece", "loafers", "#8B4513", null, false, List.of("classic", "vintage"), List.of("work", "formal", "date"),
                    "LEATHER", 0.65, 0, new Hype(null, null, 65.0), 0),
            piece("bag", "accessory_piece", "handbag", "#FFD700", "Ouro", false, List.of("vintage", "glam", "luxury"), List.of("party", "date"),
                    "SILK", 0.9, 1 | 2 | 4 | 8, new Hype(95.0, "ICONIC", 99.0), 3),
            piece("dress", "full_body_piece", "dress", "#C2185B", "Ouro", false, List.of("romantic", "chic"), List.of("date", "wedding", "formal"),
                    null, 0.75, 0, new Hype(55.0, "UNKNOWN_LEVEL", 10.0), 0),
            piece("sandal", "shoes_piece", "sandals", "#F5F5DC", "", false, null, null, "", 0.6, 0, null, 0));

    static List<Card> cards(String season) {
        return PIECES.stream().map(p -> FlairEngine.card(p, season)).toList();
    }

    static Look look(String id, Double hype, long likes, List<Card> cards, List<String> styles) {
        return FlairLooks.look(new FlairLooks.LookInput(id, "Look " + id, "u-" + id, null, hype, likes, likes / 2, likes / 3, likes / 4,
                likes / 5, styles, List.of(), null, cards));
    }

    @Test
    void motorDeCartasDecksEDuelos() {
        List<Object> r = new ArrayList<>();
        for (String s : SEASONS) {
            r.add(cards(s));
        }
        for (int m = 1; m <= 12; m++) {
            r.add(FlairEngine.season(LocalDate.of(2026, m, 15)));
        }
        r.add(List.of(FlairEngine.pieceSeason(null), FlairEngine.pieceSeason("coat"), FlairEngine.pieceSeason("sandals"), FlairEngine.pieceSeason("x")));
        for (String a : List.of("ALL", "SUMMER", "AUTUMN", "WINTER", "SPRING")) {
            for (String b : SEASONS) {
                r.add(FlairEngine.sync(a, b));
            }
        }
        r.add(FlairEngine.rarity(null, 0, false, false));
        r.add(FlairEngine.rarity(new Hype(10.0, "HOT", 10.0), 0, false, false));
        r.add(FlairEngine.rarity(Hype.NONE, 0, false, true));
        r.add(List.of(Hype.of(false, "AVAILABLE", 1.0, "HOT", 2.0), Hype.of(true, "AVAILABLE", 1.0, "HOT", 2.0), Hype.of(true, "PENDING", 1.0, "HOT", 2.0)));
        List<Card> sp = cards("SPRING"), wi = cards("WINTER");
        List<Deck> decks = List.of(
                FlairEngine.deck("d1", "Street", sp.subList(0, 3), "SPRING", "SPRING"),
                FlairEngine.deck("d2", "Office", sp.subList(3, 7), "WINTER", "SPRING"),
                FlairEngine.deck("d3", "Gala", List.of(sp.get(7), sp.get(8), sp.get(6), sp.get(9)), null, "SPRING"),
                FlairEngine.deck("d4", "Tudo", wi, "WINTER", "WINTER"),
                FlairEngine.deck("d5", "Vazio", List.of(), null, "SUMMER"),
                FlairEngine.deck("d6", "Lume", List.of(sp.get(3), sp.get(4), sp.get(5), sp.get(4)), "SPRING", "SPRING"));
        r.add(decks);
        for (Deck a : decks) {
            for (Deck b : decks) {
                r.add(FlairEngine.duel(a, b));
            }
            for (String occ : List.of("casual", "work", "party", "date", "formal", "none")) {
                r.add(FlairEngine.occasionScore(a, occ));
            }
        }
        for (int p : new int[]{0, 499, 500, 1500, 3999, 4000, 8000, 15000, 99999}) {
            r.add(FlairEngine.rank(p));
        }
        assertThat(Retrato.sha("flair-engine", r)).isEqualTo("0b137dbff917781637c90356557ac030f70b02a5c953de3473d1ed83285e4796");
    }

    @Test
    void motorDosLooksTemasEModos() {
        List<Card> sp = cards("SPRING");
        List<Look> looks = List.of(
                look("street", 80.0, 40, sp.subList(0, 3), List.of("streetwear")),
                look("office", 92.0, 10, sp.subList(4, 7), List.of("tailored")),
                look("gala", null, 300, List.of(sp.get(7), sp.get(8), sp.get(6)), List.of()),
                look("mix", 55.5, 0, List.of(sp.get(3), sp.get(1), sp.get(9), sp.get(7)), null),
                look("solo", 101.0, 5, List.of(sp.get(8)), List.of("romantic")),
                look("vazio", null, 0, null, List.of()));
        List<Object> r = new ArrayList<>();
        r.add(List.of(FlairLooks.STATS, FlairLooks.LABELS, FlairLooks.THEMES, FlairLooks.SQUAD_SITUATIONS, FlairLooks.BOSSES, FlairLooks.ROLES,
                FlairLooks.BOARD, FlairLooks.DIVISIONS, FlairLooks.OUTERWEAR, FlairLooks.NEUTRAL_HYPE));
        r.add(looks);
        for (String hex : new String[]{null, "#FFFFFF", "000000", "#FF0000", "#FF8800", "#FFEE00", "#00AA00", "#0044FF", "#8800FF", "#FF00AA", "#7F7F80", "zz"}) {
            r.add(FlairLooks.family(hex));
        }
        r.add(List.of(FlairLooks.theme((String) null), FlairLooks.theme("date_night"), FlairLooks.theme("NAO_EXISTE")));
        for (long seed = 0; seed < 20; seed++) {
            r.add(FlairLooks.drawTheme(seed * 7919L).code());
        }
        for (Theme t : FlairLooks.THEMES.values()) {
            for (String k : FlairLooks.STATS) {
                r.add(FlairLooks.weight(t, k));
            }
            for (Look l : looks) {
                r.add(FlairLooks.score(l, t));
                r.add(FlairLooks.synergies(l.cards(), t));
                r.add(FlairLooks.comboScore(l, t));
                r.add(FlairLooks.runwayScore(l, t, 2, 42L));
            }
            r.add(FlairLooks.battle(looks.get(0), looks.get(1), t));
            r.add(FlairLooks.battle(looks.get(2), looks.get(3), t));
            r.add(FlairLooks.tagScore(looks.get(0), looks.get(3), t));
            r.add(FlairLooks.bestLook(sp, t, cs -> look("best", 70.0, 3, cs, List.of())));
        }
        List<Theme> sits = FlairLooks.SQUAD_SITUATIONS.stream().map(FlairLooks::theme).toList();
        r.add(FlairLooks.assign(looks, sits));
        r.add(FlairLooks.squad(looks.subList(0, 3), looks.subList(3, 6), sits));
        r.add(FlairLooks.squad(looks.subList(0, 1), looks.subList(2, 6), sits));
        r.add(FlairLooks.leagueMatch(looks.subList(0, 2), looks.subList(2, 4), List.of(sp.get(7)), looks.subList(3, 5), List.of(looks.get(5)),
                List.of(), sits));
        for (int p : new int[]{0, 5, 6, 13, 18, 24, 31}) {
            r.add(FlairLooks.division(p));
        }
        for (Look a : looks) {
            for (Look b : looks) {
                r.add(FlairLooks.harmony(a, b));
            }
            for (String role : FlairLooks.ROLES.keySet()) {
                if (!a.stats().isEmpty()) {
                    r.add(FlairLooks.roleValue(a, role));
                }
            }
        }
        for (FlairLooks.Boss b : FlairLooks.BOSSES.values()) {
            Look boss = FlairLooks.bossLook(b);
            r.add(boss);
            r.add(FlairLooks.bossScore(boss, FlairLooks.theme(b.theme())));
        }
        Map<String, Look> roster = new LinkedHashMap<>();
        List<String> roles = new ArrayList<>(FlairLooks.ROLES.keySet());
        for (int i = 0; i < 5; i++) {
            roster.put(roles.get(i), looks.get(i));
        }
        roster.put(roles.get(5), null);
        r.add(FlairLooks.teamRating(roster));
        r.add(FlairLooks.teamRating(Map.of()));
        Map<String, Card> board = FlairLooks.autoBoard(sp);
        r.add(board);
        r.add(FlairLooks.chess(board));
        Map<String, Card> wrong = new LinkedHashMap<>();
        wrong.put("TOP", sp.get(1));
        wrong.put("BOTTOM", sp.get(0));
        wrong.put("HERO", sp.get(2));
        wrong.put("SUPPORT", sp.get(4));
        wrong.put("OUTERWEAR", sp.get(3));
        r.add(FlairLooks.chess(wrong));
        for (int pick = 0; pick < 12; pick++) {
            r.add(FlairLooks.draftTurn(pick));
        }
        r.add(FlairLooks.bestLook(List.of(sp.get(9), sp.get(7)), FlairLooks.theme("GYM_RUN"), cs -> look("x", null, 0, cs, List.of())));
        r.add(FlairLooks.wardrobeWars(new FlairLooks.Wardrobe("a", 71.3, 5, 4, 2.5, 30, 0.4, 12),
                new FlairLooks.Wardrobe("b", null, 5, 6, 2.0, 31, 0.7, 12)));
        r.add(FlairLooks.winner(10, 10.4) + FlairLooks.winner(10, 11) + FlairLooks.winner(11, 10));
        r.add(new java.util.TreeMap<>(FlairLooks.count(List.of("a", "b", "a", "c", "a"))));
        assertThat(Retrato.sha("flair-looks", r)).isEqualTo("602af8ddd0df5bf3466be369da96f7f6666b42da745b980d0954ed96b2c714d9");
    }
}
