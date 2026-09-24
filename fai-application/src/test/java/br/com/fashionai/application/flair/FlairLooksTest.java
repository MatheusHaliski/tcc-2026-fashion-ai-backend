package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Look;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FlairLooksTest {
    static Card card(String id, String cat, String sub, String hex, String brand, List<String> styles, List<String> occ, double price) {
        return FlairEngine.card(new FlairEngine.PieceInput(id, id, cat, sub, null, hex, brand, brand != null, null, styles, occ, "COTTON",
                0.7, false, false, false, false, false, price, 0, 0), "SPRING");
    }

    static Look look(String title, double hype, long likes, List<Card> cards) {
        return FlairLooks.look(new FlairLooks.LookInput(title, title, "u", null, hype, likes, 0, 0, 0, 0, List.of(), List.of(), null, cards));
    }

    static final List<Card> STREET = List.of(
            card("tee", "upper_piece", "t_shirt", "#FFFFFF", "A", List.of("streetwear", "y2k"), List.of("festival", "casual", "party"), 100),
            card("cargo", "lower_piece", "cargo_pants", "#111111", "B", List.of("streetwear", "utility"), List.of("festival", "casual"), 200),
            card("dunk", "shoes_piece", "casual_sneakers", "#E0457B", "C", List.of("streetwear"), List.of("festival", "casual"), 700));
    static final List<Card> MINIMAL = List.of(
            card("blazer", "upper_piece", "blazer", "#222222", "Lume", List.of("tailored", "minimalist"), List.of("work", "business"), 900),
            card("shirt", "upper_piece", "shirt", "#FFFFFF", "Lume", List.of("minimalist", "classic"), List.of("work", "business"), 300),
            card("pants", "lower_piece", "tailored_pants", "#222222", "Lume", List.of("tailored"), List.of("work", "business"), 500),
            card("loafer", "shoes_piece", "loafers", "#111111", "Lume", List.of("classic"), List.of("work", "formal"), 700));

    @Test
    void lookHasTenStatsAndSynergies() {
        Look street = look("Neon Street", 86, 40, STREET);
        assertThat(street.stats()).containsOnlyKeys(FlairLooks.STATS);
        assertThat(street.synergies()).extracting(FlairLooks.Synergy::code).contains("STREETWEAR_COMBO", "MIX_MATCH");
        Look minimal = look("Minimal Luxury", 89, 10, MINIMAL);
        assertThat(minimal.synergies()).extracting(FlairLooks.Synergy::code).contains("CLASSIC_FORMAL", "BRAND_LOYALTY");
    }

    @Test
    void themeChangesTheWinnerNotOnlyTheHypeScore() {
        Look street = look("Neon Street", 80, 40, STREET), minimal = look("Minimal Luxury", 92, 40, MINIMAL);
        assertThat(FlairLooks.battle(street, minimal, FlairLooks.theme("FESTIVAL_NOITE")).winner()).isEqualTo("A");
        assertThat(FlairLooks.battle(street, minimal, FlairLooks.theme("BUSINESS_MEETING")).winner()).isEqualTo("B");
    }

    @Test
    void squadAssignsEachSituationToADifferentLook() {
        List<Look> looks = List.of(look("Street", 80, 0, STREET), look("Office", 80, 0, MINIMAL));
        List<Integer> a = FlairLooks.assign(looks, List.of(FlairLooks.theme("MUSIC_FESTIVAL"), FlairLooks.theme("BUSINESS_MEETING")));
        assertThat(a).containsExactly(0, 1);
    }

    @Test
    void divisionsLadder() {
        assertThat(FlairLooks.division(0)).containsEntry("code", "BRONZE");
        assertThat(FlairLooks.division(13)).containsEntry("code", "GOLD");
        assertThat(FlairLooks.division(40)).containsEntry("code", "FLAIR_ELITE");
    }

    @Test
    void draftIsSnakeOrder() {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            b.append(FlairLooks.draftTurn(i));
        }
        assertThat(b.toString()).isEqualTo("ABBAABBA");
    }

    @Test
    void chessRewardsPositionAndAdjacency() {
        Map<String, Card> good = new LinkedHashMap<>();
        good.put("TOP", MINIMAL.get(1));       // camisa branca
        good.put("HERO", MINIMAL.get(2));      // calça escura logo abaixo (TOP é vizinho do HERO)
        good.put("OUTERWEAR", MINIMAL.get(0));
        good.put("SHOES_L", MINIMAL.get(3));
        Map<String, Card> bad = new LinkedHashMap<>();
        bad.put("SHOES_L", MINIMAL.get(1));
        bad.put("TOP", MINIMAL.get(3));
        bad.put("ACCESSORY_L", MINIMAL.get(2));
        bad.put("SHOES_R", MINIMAL.get(0));
        double g = ((Number) FlairLooks.chess(good).get("total")).doubleValue(), w = ((Number) FlairLooks.chess(bad).get("total")).doubleValue();
        assertThat(g).isGreaterThan(w);
        assertThat((List<?>) FlairLooks.chess(good).get("bonuses")).anySatisfy(x -> assertThat(String.valueOf(x)).contains("+5 Harmony"));
    }

    @Test
    void tagTeamHarmonyPrefersCompatibleLooks() {
        Look s1 = look("S1", 80, 0, STREET), s2 = look("S2", 80, 0, STREET), m = look("M", 80, 0, MINIMAL);
        assertThat(FlairLooks.harmony(s1, s2)).isGreaterThan(FlairLooks.harmony(s1, m));
    }

    @Test
    void bossesTeachAndHaveFixedStats() {
        assertThat(FlairLooks.BOSSES).containsKeys("MINIMALIST", "STREET_KING", "LUXURY_QUEEN", "COLOR_MASTER", "VINTAGE_COLLECTOR", "AVANT_GARDE_AI");
        Look boss = FlairLooks.bossLook(FlairLooks.BOSSES.get("MINIMALIST"));
        assertThat(boss.stats().get("STYLE")).isEqualTo(100);
        assertThat(FlairLooks.bossScore(boss, FlairLooks.theme("NEW_YORK_MINIMAL"))).isGreaterThan(80);
    }

    @Test
    void colorFamilies() {
        assertThat(FlairLooks.family("#FFFFFF")).isEqualTo("neutral");
        assertThat(FlairLooks.family("#E53935")).isEqualTo("red");
        assertThat(FlairLooks.family("#1E88E5")).isEqualTo("blue");
    }
}
