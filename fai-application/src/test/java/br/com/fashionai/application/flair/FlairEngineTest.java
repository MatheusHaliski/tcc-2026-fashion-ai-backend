package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FlairEngineTest {
    static FlairEngine.PieceInput piece(String name, String cat, String sub, String brand, List<String> styles, List<String> occ,
                                        String material, boolean studio, double price, double hype) {
        return new FlairEngine.PieceInput(name, name, cat, sub, null, "#000000", brand, brand != null, null, styles, occ, material,
                0.7, studio, false, false, false, false, price, hype, 0);
    }

    @Test
    void seasonFollowsTheSouthernHemisphere() {
        assertThat(FlairEngine.season(LocalDate.of(2026, 1, 10))).isEqualTo("SUMMER");
        assertThat(FlairEngine.season(LocalDate.of(2026, 7, 10))).isEqualTo("WINTER");
        assertThat(FlairEngine.season(LocalDate.of(2026, 9, 24))).isEqualTo("SPRING");
        assertThat(FlairEngine.season(LocalDate.of(2026, 4, 1))).isEqualTo("AUTUMN");
    }

    @Test
    void cardStatsComeFromStylesOccasionsBrandAndStudio() {
        Card c = FlairEngine.card(piece("Blazer", "upper_piece", "blazer", "Atelier Lume", List.of("tailored", "classic"),
                List.of("work", "business", "formal"), "WOOL", true, 700, 40), "WINTER");
        assertThat(c.stats().get("RANGE")).isEqualTo(60);                 // 3 ocasiões × 20
        assertThat(c.stats().get("CLOUT")).isEqualTo(90);                 // marca cadastrada
        assertThat(c.stats().get("GLOW")).isEqualTo(88);                  // foto de estúdio
        assertThat(c.stats().get("SYNC")).isEqualTo(100);                 // blazer é peça de inverno
        assertThat(c.rarity()).isEqualTo("PREMIUM");
        assertThat(c.ability().code()).isEqualTo("SHIELD");
        Card summer = FlairEngine.card(piece("Blazer", "upper_piece", "blazer", null, List.of(), List.of(), null, false, 0, 0), "SUMMER");
        assertThat(summer.stats().get("SYNC")).isZero();                  // estação oposta
        assertThat(summer.rarity()).isEqualTo("STANDARD");
        assertThat(summer.ability()).isNull();
    }

    @Test
    void rarityClimbsWithHypeAndPrice() {
        assertThat(FlairEngine.card(piece("A", "shoes_piece", "boots", null, List.of(), List.of(), null, false, 1600, 0), "SPRING").rarity()).isEqualTo("RARE");
        assertThat(FlairEngine.card(piece("B", "shoes_piece", "boots", null, List.of(), List.of(), null, false, 0, 70), "SPRING").rarity()).isEqualTo("LIMITED");
    }

    @Test
    void deckAddsCombosAndBrandMultiplier() {
        List<Card> cards = List.of(
                FlairEngine.card(piece("1", "upper_piece", "shirt", "Lume", List.of("classic"), List.of("work", "casual"), "COTTON", false, 0, 0), "SPRING"),
                FlairEngine.card(piece("2", "lower_piece", "tailored_pants", "Lume", List.of("classic"), List.of("work"), "WOOL", false, 0, 0), "SPRING"),
                FlairEngine.card(piece("3", "shoes_piece", "loafers", "Lume", List.of("classic"), List.of("work", "formal"), "LEATHER", false, 0, 0), "SPRING"));
        Deck d = FlairEngine.deck("s", "Trabalho", cards, "SPRING", "SPRING");
        assertThat(d.combos()).extracting(FlairEngine.Combo::code).contains("STYLE_SYNERGY", "OCCASION_SYNERGY", "MATERIAL_CONTRAST");
        assertThat(d.brandMultiplier()).isEqualTo(1.20);                  // 3 peças da mesma marca
        assertThat(d.topBrand()).isEqualTo("lume");
        assertThat(d.seasonBonus()).isEqualTo(15);
        Deck plain = FlairEngine.deck("s", "Trabalho", cards.subList(0, 1), null, "SPRING");
        assertThat(d.power()).isGreaterThan(plain.power());
    }

    @Test
    void duelHasFiveRoundsAndTheStrongerDeckWins() {
        List<Card> strong = List.of(
                FlairEngine.card(piece("1", "upper_piece", "blazer", "Lume", List.of("avant_garde", "statement"), List.of("work", "party", "formal", "date"), "WOOL", true, 900, 60), "WINTER"),
                FlairEngine.card(piece("2", "lower_piece", "tailored_pants", "Lume", List.of("avant_garde", "tailored"), List.of("work", "formal", "party"), "SILK", true, 700, 60), "WINTER"));
        List<Card> weak = List.of(FlairEngine.card(piece("3", "upper_piece", "t_shirt", null, List.of(), List.of("casual"), null, false, 0, 0), "WINTER"));
        FlairEngine.DuelResult r = FlairEngine.duel(FlairEngine.deck("a", "A", strong, null, "WINTER"), FlairEngine.deck("b", "B", weak, null, "WINTER"));
        assertThat(r.rounds()).hasSize(5).extracting(FlairEngine.Round::stat).containsExactly("EDGE", "RANGE", "CLOUT", "GLOW", "ART");
        assertThat(r.winner()).isEqualTo("A");
        assertThat(r.winsA()).isGreaterThan(r.winsB());
    }

    @Test
    void occasionScoreRewardsCoverage() {
        Card party = FlairEngine.card(piece("1", "full_body_piece", "dress", null, List.of("glam"), List.of("party"), "SILK", false, 0, 0), "SPRING");
        Card office = FlairEngine.card(piece("2", "full_body_piece", "dress", null, List.of("glam"), List.of("work"), "SILK", false, 0, 0), "SPRING");
        assertThat(FlairEngine.occasionScore(FlairEngine.deck("a", "A", List.of(party), null, "SPRING"), "party"))
                .isGreaterThan(FlairEngine.occasionScore(FlairEngine.deck("b", "B", List.of(office), null, "SPRING"), "party"));
    }

    @Test
    void rankLadder() {
        assertThat(FlairEngine.rank(0)).containsEntry("code", "ROOKIE");
        assertThat(FlairEngine.rank(1600)).containsEntry("code", "STYLE_MAVEN");
        assertThat(((Map<?, ?>) FlairEngine.rank(1600).get("next")).get("label")).isEqualTo("Fashion Architect");
        assertThat(FlairEngine.rank(20000)).containsEntry("code", "LEGEND");
        assertThat(FlairEngine.rank(20000).get("next")).isNull();
    }
}
