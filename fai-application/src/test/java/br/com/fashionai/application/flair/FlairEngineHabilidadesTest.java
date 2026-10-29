package br.com.fashionai.application.flair;

import br.com.fashionai.domain.model.enums.HypeLevel;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** FlairEngine: estações, sintonia, atributos da carta, raridade e habilidades, combos do deck e regras do duelo. */
class FlairEngineHabilidadesTest {
    private static FlairEngine.PieceInput piece(String sub, String brand, boolean registered, List<String> styles, List<String> occ, String material,
                                                Double quality, boolean studio, boolean defaultImage, FlairEngine.Hype hype, int seals, boolean model3d) {
        return new FlairEngine.PieceInput("id-" + sub + material, "Peça " + sub, "upper_piece", sub, "/i.png", "#000000", brand, registered, null,
                styles, occ, material, quality, studio, true, model3d, true, defaultImage, hype, seals);
    }

    private static FlairEngine.Card card(List<String> styles, FlairEngine.Hype hype, int seals, boolean model3d, boolean studio) {
        return FlairEngine.card(piece("t_shirt", null, false, styles, List.of("casual"), null, null, studio, false, hype, seals, model3d), "SPRING");
    }

    @Test
    void estacoesESintonia() {
        assertThat(FlairEngine.season(LocalDate.of(2026, 1, 5))).isEqualTo("SUMMER");
        assertThat(FlairEngine.season(LocalDate.of(2026, 4, 5))).isEqualTo("AUTUMN");
        assertThat(FlairEngine.season(LocalDate.of(2026, 7, 5))).isEqualTo("WINTER");
        assertThat(FlairEngine.season(LocalDate.of(2026, 10, 5))).isEqualTo("SPRING");
        assertThat(FlairEngine.pieceSeason(null)).isEqualTo("ALL");
        assertThat(FlairEngine.pieceSeason("coat")).isEqualTo("WINTER");
        assertThat(FlairEngine.pieceSeason("sandals")).isEqualTo("SUMMER");
        assertThat(FlairEngine.sync("WINTER", "WINTER")).isEqualTo(100);
        assertThat(FlairEngine.sync("WINTER", "SUMMER")).isZero();
        assertThat(FlairEngine.sync("SPRING", "AUTUMN")).isZero();
        assertThat(FlairEngine.sync("WINTER", "SPRING")).isEqualTo(50);
    }

    @Test
    void hypeDoJobSoComStatusDisponivel() {
        assertThat(FlairEngine.Hype.of(false, "AVAILABLE", 80.0, "HOT", 70.0)).isEqualTo(FlairEngine.Hype.NONE);
        assertThat(FlairEngine.Hype.of(true, "AVAILABLE", 80.0, "HOT", 70.0).score()).isEqualTo(80.0);
        FlairEngine.Hype pendente = FlairEngine.Hype.of(true, "INSUFFICIENT_DATA", 80.0, "HOT", 70.0);
        assertThat(pendente.score()).isNull();
        assertThat(pendente.rarity()).isEqualTo(70.0);
        assertThat(FlairEngine.Hype.of(true, "AVAILABLE", null, "HOT", null).level()).isNull();
        assertThat(new FlairEngine.Hype(1.0, "NOVA_FAIXA", null).atLeast(HypeLevel.NICHE)).isFalse();
    }

    @Test
    void atributosDaCartaPorMarcaImagemEQualidade() {
        var registrada = FlairEngine.card(piece("coat", "Norte", true, List.of("edgy"), List.of(), "wool", null, true, false, null, 2, false), "WINTER");
        assertThat(registrada.stats()).containsEntry("CLOUT", 100).containsEntry("GLOW", 88).containsEntry("SYNC", 100).containsEntry("RANGE", 0);
        var nomeada = FlairEngine.card(piece("t_shirt", "Norte", false, List.of(), List.of("a", "b"), null, 0.1, false, true, null, 0, false), "SPRING");
        assertThat(nomeada.stats()).containsEntry("CLOUT", 60).containsEntry("GLOW", 55).containsEntry("RANGE", 40);
        var semMarca = FlairEngine.card(piece("t_shirt", " ", false, List.of(), List.of(), null, 0.1, false, false, null, 0, false), "SPRING");
        assertThat(semMarca.stats()).containsEntry("CLOUT", 20).containsEntry("GLOW", 30);
        var semQualidade = FlairEngine.card(piece("t_shirt", null, false, null, null, null, null, false, false, null, 0, false), "SPRING");
        assertThat(semQualidade.stats()).containsEntry("GLOW", 60);
    }

    @Test
    void raridadeEHabilidades() {
        var nicho = new FlairEngine.Hype(50.0, "NICHE", 80.0);
        assertThat(card(List.of("statement", "edgy", "avant_garde", "y2k"), nicho, 0, false, false).ability().code()).isEqualTo("TRENDSETTER");
        assertThat(card(List.of(), nicho, 0, false, true).ability().code()).isEqualTo("SPOTLIGHT");
        assertThat(card(List.of(), nicho, 0, false, false).ability().code()).isEqualTo("ICON");
        assertThat(card(List.of("statement"), null, 1, false, false).ability().code()).isEqualTo("STATEMENT_LOCK");
        assertThat(card(List.of("urban"), null, 0, true, false).ability().code()).isEqualTo("HYPE_BOOST");
        assertThat(card(List.of("classic"), new FlairEngine.Hype(null, null, 65.0), 0, false, false).rarity()).isEqualTo("LIMITED");
        assertThat(card(List.of("classic"), new FlairEngine.Hype(null, null, 65.0), 0, false, false).ability()).isNull();
        assertThat(card(List.of(), new FlairEngine.Hype(90.0, "HOT", 10.0), 0, false, false).ability().code()).isEqualTo("SHIELD");
        assertThat(card(List.of(), FlairEngine.Hype.NONE, 0, false, false).ability()).isNull();
        assertThat(FlairEngine.rarity(null, 0, false, false)).isEqualTo("STANDARD");
        assertThat(FlairEngine.rarity(new FlairEngine.Hype(1.0, "LOW_SIGNAL", 90.0), 0, false, false)).isEqualTo("LIMITED");
    }

    @Test
    void combosDoDeckMarcaEstacaoEMateriais() {
        List<FlairEngine.Card> cards = List.of(
                FlairEngine.card(piece("coat", "Norte", false, List.of("edgy"), List.of("work", "party"), "wool", null, false, false, null, 0, false), "WINTER"),
                FlairEngine.card(piece("boots", "norte", false, List.of("edgy"), List.of("work"), "leather", null, false, false, null, 0, false), "WINTER"),
                FlairEngine.card(piece("sweater", "NORTE", false, List.of("edgy"), List.of("work"), "cotton", null, false, false, null, 0, false), "WINTER"),
                FlairEngine.card(piece("scarf", "Norte", false, List.of(), List.of("work"), " ", null, false, false, null, 0, false), "WINTER"));

        FlairEngine.Deck d = FlairEngine.deck("s", "Inverno", cards, "WINTER", "WINTER");

        assertThat(d.combos()).extracting(FlairEngine.Combo::code).containsExactly("STYLE_SYNERGY", "OCCASION_SYNERGY", "SEASON_SWEEP", "MATERIAL_CONTRAST");
        assertThat(d.brandMultiplier()).isEqualTo(1.35);
        assertThat(d.topBrand()).isEqualTo("norte");
        assertThat(d.seasonBonus()).isEqualTo(15);
        assertThat(FlairEngine.deck("s", "Dois", cards.subList(0, 2), null, "WINTER").brandMultiplier()).isEqualTo(1.10);
        assertThat(FlairEngine.deck("s", "Tres", cards.subList(0, 3), "SUMMER", "WINTER").brandMultiplier()).isEqualTo(1.20);
        FlairEngine.Deck vazio = FlairEngine.deck("v", "Vazio", List.of(), null, "WINTER");
        assertThat(vazio.combos()).isEmpty();
        assertThat(vazio.topBrand()).isNull();
        assertThat(FlairEngine.occasionScore(vazio, "work")).isZero();
        assertThat(FlairEngine.occasionScore(d, "work")).isPositive();
    }

    @Test
    void dueloComTrendsetterSpotlightBloqueioEEscudo() {
        var nicho = new FlairEngine.Hype(50.0, "NICHE", 80.0);
        var trend = card(List.of("statement", "edgy", "avant_garde", "y2k"), nicho, 0, false, false);
        var spot = card(List.of(), nicho, 0, false, true);
        var lock = card(List.of("statement"), null, 1, false, false);
        var boost1 = card(List.of("urban"), null, 0, true, false);
        var boost2 = card(List.of("streetwear"), null, 0, true, false);
        var shield = card(List.of(), new FlairEngine.Hype(90.0, "HOT", 10.0), 0, false, false);

        FlairEngine.Deck a = FlairEngine.deck("a", "A", List.of(trend, spot, boost1, boost2), null, "SPRING");
        FlairEngine.Deck b = FlairEngine.deck("b", "B", List.of(lock, shield, shield), null, "SPRING");
        FlairEngine.DuelResult r = FlairEngine.duel(a, b);

        assertThat(r.rounds()).hasSize(5);
        assertThat(r.rounds().get(0).notes()).anyMatch(n -> n.contains("A"));
        assertThat(r.winsA() + r.winsB()).isLessThanOrEqualTo(5);
        assertThat(r.winner()).isIn("A", "B", "DRAW");
        FlairEngine.DuelResult espelho = FlairEngine.duel(b, b);
        assertThat(espelho.winner()).isEqualTo("DRAW");
        assertThat(FlairEngine.side(FlairEngine.deck("v", "V", List.of(), null, "SPRING"), a, "EDGE", new java.util.ArrayList<>(), "A")).isZero();
    }
}
