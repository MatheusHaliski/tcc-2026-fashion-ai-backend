package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** FlairTier: faixas de bolsa e categoria, fatores de preço, marca e acabamento, teto sem preço verificado e posições. */
class FlairTierFaixasTest {
    private static FlairTier.Input in(String cat, String sub, Double price, Double min, Double max, String tier, boolean known, boolean verified,
                                      boolean all) {
        return new FlairTier.Input(cat, sub, price, min, max, tier, known, verified, all, all, all, all, all, all);
    }

    @Test
    void faixaDeBolsaECategoriaDesconhecida() {
        assertThat(FlairTier.band("accessory_piece", "handbag")).isEqualTo(FlairTier.BAG);
        assertThat(FlairTier.band("accessory_piece", "mini_bag")).isEqualTo(FlairTier.BAG);
        assertThat(FlairTier.band("accessory_piece", "cap")).isEqualTo(FlairTier.BANDS.get("accessory_piece"));
        assertThat(FlairTier.band(null, null)).isEqualTo(FlairTier.BANDS.get("upper_piece"));
        assertThat(FlairTier.band("outra", "x")).isEqualTo(FlairTier.BANDS.get("upper_piece"));
    }

    @Test
    void fatoresDePrecoMarcaEAcabamento() {
        FlairTier.Band b = FlairTier.BANDS.get("upper_piece");
        assertThat(FlairTier.priceFactor(null, b)).isZero();
        assertThat(FlairTier.priceFactor(-1.0, b)).isZero();
        assertThat(FlairTier.priceFactor(10.0, b)).isZero();
        assertThat(FlairTier.priceFactor(5000.0, b)).isEqualTo(1.0);
        assertThat(FlairTier.brandFactor(in("upper_piece", null, null, null, null, null, false, false, false))).isEqualTo(0.1);
        assertThat(FlairTier.brandFactor(in("upper_piece", null, null, null, null, "luxury", true, true, false))).isEqualTo(1.0);
        assertThat(FlairTier.brandFactor(in("upper_piece", null, null, null, null, "OUTRO", true, false, false))).isEqualTo(0.1);
        assertThat(FlairTier.brandFactor(in("upper_piece", null, null, null, null, "MID", false, true, false))).isEqualTo(0.5);
        assertThat(FlairTier.finishFactor(in("upper_piece", null, null, null, null, null, false, false, true))).isEqualTo(1.0);
        assertThat(FlairTier.finishFactor(in("upper_piece", null, null, null, null, null, false, false, false))).isZero();
    }

    @Test
    void precoVerificadoUsaAFaixaDoProdutoESemVerificacaoNaoPassaDePrata() {
        FlairTier.Result semPreco = FlairTier.compute(in("upper_piece", "shirt", 0.0, 100.0, 300.0, "LUXURY", true, true, true));
        assertThat(semPreco.priceVerified()).isTrue();
        assertThat(semPreco.priceUsed()).isEqualTo(200.0);
        FlairTier.Result acima = FlairTier.compute(in("upper_piece", "shirt", 900.0, 100.0, 300.0, "LUXURY", true, true, true));
        assertThat(acima.priceUsed()).isEqualTo(300.0);
        FlairTier.Result abaixo = FlairTier.compute(in("upper_piece", "shirt", null, 100.0, 0.0, null, false, false, false));
        assertThat(abaixo.priceVerified()).isFalse();
        assertThat(abaixo.priceUsed()).isNull();
        FlairTier.Result teto = FlairTier.compute(in("shoes_piece", "boots", 5000.0, null, null, "LUXURY", true, true, true));
        assertThat(teto.cappedByUnverifiedPrice()).isTrue();
        assertThat(teto.ovr()).isEqualTo(FlairTier.OURO_MIN - 1);
        assertThat(teto.tier()).isEqualTo("PRATA");
        assertThat(teto.priceUsed()).isEqualTo(450.0);
        FlairTier.Result ouro = FlairTier.compute(in("shoes_piece", "boots", 1200.0, 1100.0, 1300.0, "LUXURY", true, true, true));
        assertThat(ouro.tier()).isEqualTo("OURO");
        assertThat(ouro.basis()).containsEntry("priceVerified", true).containsEntry("cappedByUnverifiedPrice", false);
        assertThat(FlairTier.tierOf(64)).isEqualTo("BRONZE");
    }

    @Test
    void posicaoPelaCategoria() {
        assertThat(FlairTier.position("lower_piece")).isEqualTo("INF");
        assertThat(FlairTier.position("shoes_piece")).isEqualTo("CAL");
        assertThat(FlairTier.position("accessory_piece")).isEqualTo("ACE");
        assertThat(FlairTier.position("full_body_piece")).isEqualTo("VES");
        assertThat(FlairTier.position(null)).isEqualTo("SUP");
        assertThat(FlairTier.position("x")).isEqualTo("SUP");
    }

    @Test
    void historiaComCenarioLivreCartasSemMarcaEFechamentoPorSintonia() {
        UUID id = UUID.randomUUID();
        var slots = List.of(new CbcStory.SlotText("a", Map.of("pt-BR", "{name}")), new CbcStory.SlotText("b", null), new CbcStory.SlotText("c", null));
        var placed = Map.of("a", new CbcStory.CardText("Camisa", " ", null), "b", new CbcStory.CardText("Calça", "Norte", "blue"));
        var results = List.of(new CbcRules.SlotResult("a", "SUP", id, true, false, false, 1), new CbcRules.SlotResult("b", "INF", id, true, true, true, 3));
        var ev = new CbcRules.Evaluation(results, List.of(), 4, 9, 2, false, false, List.of());

        List<Map<String, Object>> livre = CbcStory.write(CbcStory.FREE, slots, placed, ev, CbcRules.OWN);
        assertThat(livre.get(0)).containsEntry("key", "cbc.story.open_free");
        assertThat(livre.get(1)).containsEntry("key", "cbc.story.reading_own");
        assertThat(livre.get(2)).containsEntry("key", null).containsEntry("slot", "a").containsEntry("sintonia", 1).containsKey("text");
        assertThat(varsOf(livre.get(2))).containsEntry("brand", "none").containsEntry("color", "none");
        assertThat(livre.get(3)).containsEntry("key", null).containsEntry("sintonia", 3);
        assertThat(livre.get(4)).containsEntry("key", "cbc.story.close.mid");

        List<Map<String, Object>> halloween = CbcStory.write("halloween", slots, placed, null, "dark");
        assertThat(halloween.get(1)).containsEntry("key", "cbc.story.reading");
        assertThat(halloween.get(3)).containsEntry("key", "cbc.scenario.halloween.b.story").containsEntry("sintonia", 0);
        assertThat(halloween).hasSize(4);

        var alta = new CbcRules.Evaluation(results, List.of(), 7, 9, 2, true, true, List.of());
        assertThat(CbcStory.write("halloween", slots, placed, alta, null).get(4)).containsEntry("key", "cbc.story.close.high");
        var baixa = new CbcRules.Evaluation(results, List.of(), 1, 9, 2, true, true, List.of());
        assertThat(CbcStory.write("halloween", slots, placed, baixa, null).get(4)).containsEntry("key", "cbc.story.close.low");
        var zero = new CbcRules.Evaluation(List.of(), List.of(), 0, 0, 1, true, true, List.of());
        assertThat(CbcStory.write("halloween", List.of(), Map.of(), zero, null).get(2)).containsEntry("key", "cbc.story.close.low");
        var vazia = new CbcRules.Evaluation(List.of(), List.of(), 0, 0, 0, true, true, List.of());
        assertThat(CbcStory.write("halloween", List.of(), Map.of(), vazia, null)).hasSize(2);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> varsOf(Map<String, Object> line) {
        return (Map<String, Object>) line.get("vars");
    }
}
