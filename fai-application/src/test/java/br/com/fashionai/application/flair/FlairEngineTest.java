package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FlairEngineTest {
    static FlairEngine.PieceInput piece(String name, String cat, String sub, String brand, List<String> styles, List<String> occ,
                                        String material, boolean studio, FlairEngine.Hype hype) {
        return new FlairEngine.PieceInput(name, name, cat, sub, null, "#000000", brand, brand != null, null, styles, occ, material,
                0.7, studio, false, false, false, false, hype, 0);
    }

    static FlairEngine.PieceInput piece(String name, String cat, String sub, String brand, List<String> styles, List<String> occ,
                                        String material, boolean studio) {
        return piece(name, cat, sub, brand, styles, occ, material, studio, FlairEngine.Hype.NONE);
    }

    static FlairEngine.Hype hype(Double score, String level, Double rarity) {
        return new FlairEngine.Hype(score, level, rarity);
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
                List.of("work", "business", "formal"), "WOOL", true), "WINTER");
        assertThat(c.stats().get("RANGE")).isEqualTo(60);                 // 3 ocasiões × 20
        assertThat(c.stats().get("CLOUT")).isEqualTo(90);                 // marca cadastrada
        assertThat(c.stats().get("GLOW")).isEqualTo(88);                  // foto de estúdio
        assertThat(c.stats().get("SYNC")).isEqualTo(100);                 // blazer é peça de inverno
        assertThat(c.rarity()).isEqualTo("PREMIUM");                      // foto de estúdio (sem Hype público)
        assertThat(c.ability().code()).isEqualTo("SHIELD");
        Card summer = FlairEngine.card(piece("Blazer", "upper_piece", "blazer", null, List.of(), List.of(), null, false), "SUMMER");
        assertThat(summer.stats().get("SYNC")).isZero();                  // estação oposta
        assertThat(summer.rarity()).isEqualTo("STANDARD");
        assertThat(summer.ability()).isNull();
    }

    // ------------------------------------------------------------------ RF53 · P2-18: raridade pelo HypeScore v2, sem preço

    @Test
    void rarityComesFromTheV2RarityDimensionAndLevel() {
        // modelo raro (RARITY ≥ 75) com faixa ≥ Nicho = RARE (mesma régua do selo de Hype "Raro")
        assertThat(FlairEngine.rarity(hype(72.0, "HOT", 80.0), 0, false, false)).isEqualTo("RARE");
        assertThat(FlairEngine.rarity(hype(30.0, "NICHE", 76.0), 0, false, false)).isEqualTo("RARE");
        // modelo raro sem tração (Sinal baixo) ou com dados insuficientes: LIMITED, nunca rebaixado a 0
        assertThat(FlairEngine.rarity(hype(12.0, "LOW_SIGNAL", 90.0), 0, false, false)).isEqualTo("LIMITED");
        assertThat(FlairEngine.rarity(hype(null, null, 82.0), 0, false, false)).isEqualTo("LIMITED");
        assertThat(FlairEngine.rarity(hype(null, null, 61.0), 0, false, false)).isEqualTo("LIMITED");
        // relevância pública (faixa ≥ Em alta) com modelo comum: PREMIUM — popularidade sozinha não faz carta RARE
        assertThat(FlairEngine.rarity(hype(97.0, "VIRAL", 10.0), 0, false, false)).isEqualTo("PREMIUM");
        assertThat(FlairEngine.rarity(hype(55.0, "RELEVANT", 10.0), 0, false, false)).isEqualTo("STANDARD");
        // sem Hype público: só os critérios estruturais (selo, 3D, estúdio)
        assertThat(FlairEngine.rarity(FlairEngine.Hype.NONE, 0, false, false)).isEqualTo("STANDARD");
        assertThat(FlairEngine.rarity(null, 1, false, false)).isEqualTo("LIMITED");
        assertThat(FlairEngine.rarity(FlairEngine.Hype.NONE, 0, true, false)).isEqualTo("LIMITED");
        assertThat(FlairEngine.rarity(FlairEngine.Hype.NONE, 0, false, true)).isEqualTo("PREMIUM");
        // faixa de uma versão futura do algoritmo não quebra nem conta
        assertThat(FlairEngine.rarity(hype(99.0, "MEGA", 99.0), 0, false, false)).isEqualTo("LIMITED");
    }

    @Test
    void priceIsNotAnInputSoItNeverBuysPower() {
        // sem pay-to-win: a entrada da carta nem tem preço
        assertThat(Arrays.stream(FlairEngine.PieceInput.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName))
                .doesNotContain("price").contains("hype");
        Card plain = FlairEngine.card(piece("A", "shoes_piece", "boots", null, List.of(), List.of(), null, false), "SPRING");
        assertThat(plain.rarity()).isEqualTo("STANDARD");
        Card rare = FlairEngine.card(piece("B", "shoes_piece", "boots", null, List.of(), List.of(), null, false, hype(70.0, "HOT", 88.0)), "SPRING");
        assertThat(rare.rarity()).isEqualTo("RARE");
        assertThat(rare.power()).isGreaterThan(plain.power());           // mesmos atributos, só o multiplicador da raridade muda
        assertThat(rare.hype().rarity()).isEqualTo(88.0);                 // a carta expõe o Hype público que decidiu a raridade
    }

    @Test
    void onlyPublicHypeEntersTheGame() {
        // item privado/só seguidores: nada do Hype pessoal entra (mesma carta para qualquer jogador, nada vaza)
        assertThat(FlairEngine.Hype.of(false, "AVAILABLE", 95.0, "VIRAL", 90.0)).isEqualTo(FlairEngine.Hype.NONE);
        // dados insuficientes: score e faixa nulos (nunca 0); a raridade estrutural continua
        FlairEngine.Hype insufficient = FlairEngine.Hype.of(true, "INSUFFICIENT_DATA", null, null, 80.0);
        assertThat(insufficient.score()).isNull();
        assertThat(insufficient.level()).isNull();
        assertThat(insufficient.rarity()).isEqualTo(80.0);
        assertThat(FlairEngine.Hype.of(true, "AVAILABLE", 64.0, "HOT", 30.0)).isEqualTo(hype(64.0, "HOT", 30.0));
        assertThat(FlairEngine.Hype.NONE.atLeast(br.com.fashionai.domain.model.enums.HypeLevel.LOW_SIGNAL)).isFalse();
    }

    @Test
    void hypeBoostKeepsItsCodeButIsNotNamedAfterTheHypeScore() {
        Card street = FlairEngine.card(piece("Moletom", "upper_piece", "hoodie", null, List.of("streetwear"), List.of("casual"), null, false,
                hype(null, null, 65.0)), "SPRING");
        assertThat(street.rarity()).isEqualTo("LIMITED");
        assertThat(street.ability().code()).isEqualTo("HYPE_BOOST");
        assertThat(street.ability().label()).isEqualTo("Street Boost").doesNotContainIgnoringCase("hype");
    }

    @Test
    void deckAddsCombosAndBrandMultiplier() {
        List<Card> cards = List.of(
                FlairEngine.card(piece("1", "upper_piece", "shirt", "Lume", List.of("classic"), List.of("work", "casual"), "COTTON", false), "SPRING"),
                FlairEngine.card(piece("2", "lower_piece", "tailored_pants", "Lume", List.of("classic"), List.of("work"), "WOOL", false), "SPRING"),
                FlairEngine.card(piece("3", "shoes_piece", "loafers", "Lume", List.of("classic"), List.of("work", "formal"), "LEATHER", false), "SPRING"));
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
                FlairEngine.card(piece("1", "upper_piece", "blazer", "Lume", List.of("avant_garde", "statement"), List.of("work", "party", "formal", "date"), "WOOL", true), "WINTER"),
                FlairEngine.card(piece("2", "lower_piece", "tailored_pants", "Lume", List.of("avant_garde", "tailored"), List.of("work", "formal", "party"), "SILK", true), "WINTER"));
        List<Card> weak = List.of(FlairEngine.card(piece("3", "upper_piece", "t_shirt", null, List.of(), List.of("casual"), null, false), "WINTER"));
        FlairEngine.DuelResult r = FlairEngine.duel(FlairEngine.deck("a", "A", strong, null, "WINTER"), FlairEngine.deck("b", "B", weak, null, "WINTER"));
        assertThat(r.rounds()).hasSize(5).extracting(FlairEngine.Round::stat).containsExactly("EDGE", "RANGE", "CLOUT", "GLOW", "ART");
        assertThat(r.winner()).isEqualTo("A");
        assertThat(r.winsA()).isGreaterThan(r.winsB());
    }

    @Test
    void occasionScoreRewardsCoverage() {
        Card party = FlairEngine.card(piece("1", "full_body_piece", "dress", null, List.of("glam"), List.of("party"), "SILK", false), "SPRING");
        Card office = FlairEngine.card(piece("2", "full_body_piece", "dress", null, List.of("glam"), List.of("work"), "SILK", false), "SPRING");
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
