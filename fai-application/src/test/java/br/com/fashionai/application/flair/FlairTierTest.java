package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR-UT §4 — nota e nível. Os exemplos do plano (docs/plano/FLAIR_UT_Cartas_e_Desafios.md §4) viram testes: o nível
 * vem do preço confirmado e da marca; preço só digitado nunca passa de Prata (D8).
 */
class FlairTierTest {
    /** Cadastro completo sem foto de estúdio nem 3D (acabamento 0,6). */
    private static FlairTier.Input in(String cat, String sub, Double price, Double min, Double max, String brandTier, boolean brand) {
        return new FlairTier.Input(cat, sub, price, min, max, brandTier, brand, false, true, true, true, true, false, false);
    }

    @Test
    void exemplosDoPlano() {
        FlairTier.Result tee = FlairTier.compute(in("upper_piece", "t_shirt", 39.0, null, null, null, false));
        assertThat(tee.tier()).isEqualTo("BRONZE");
        assertThat(tee.ovr()).isBetween(48, 54);

        FlairTier.Result sneaker = FlairTier.compute(in("shoes_piece", "sneaker", 399.0, 349.0, 449.0, "BUDGET", true));
        assertThat(sneaker.tier()).isEqualTo("PRATA");
        assertThat(sneaker.ovr()).isBetween(66, 71);
        assertThat(sneaker.priceVerified()).isTrue();

        FlairTier.Result bag = FlairTier.compute(in("accessory_piece", "handbag", 1900.0, 1700.0, 2100.0, "PREMIUM", true));
        assertThat(bag.tier()).isEqualTo("OURO");
        assertThat(bag.ovr()).isBetween(78, 86);

        // a mesma bolsa com preço só digitado: Prata 74 e o aviso
        FlairTier.Result typed = FlairTier.compute(in("accessory_piece", "handbag", 1900.0, null, null, "PREMIUM", true));
        assertThat(typed.ovr()).isEqualTo(74);
        assertThat(typed.tier()).isEqualTo("PRATA");
        assertThat(typed.cappedByUnverifiedPrice()).isTrue();
        assertThat(typed.priceUsed()).isEqualTo(FlairTier.BAG.p75());
    }

    @Test
    void precoDoCatalogoValeAFaixaDoProdutoEOAcabamentoNuncaMudaONivelSozinho() {
        // digitado acima da faixa do produto: vale o teto da faixa
        FlairTier.Result r = FlairTier.compute(in("shoes_piece", "sneaker", 5000.0, 349.0, 449.0, "BUDGET", true));
        assertThat(r.priceUsed()).isEqualTo(449.0);
        // acabamento máximo e mínimo: no máximo 6 pontos de diferença
        FlairTier.Input bare = new FlairTier.Input("upper_piece", null, 100.0, null, null, null, false, false, false, false, false, false, false, false);
        FlairTier.Input full = new FlairTier.Input("upper_piece", null, 100.0, null, null, null, false, false, true, true, true, true, true, true);
        assertThat(FlairTier.compute(full).ovr() - FlairTier.compute(bare).ovr()).isBetween(0, 6);
        // sem preço: a conta não quebra e a carta nasce Bronze
        assertThat(FlairTier.compute(in("lower_piece", null, null, null, null, null, false)).tier()).isEqualTo("BRONZE");
        // limites e posições
        assertThat(FlairTier.compute(in("accessory_piece", "handbag", 99999.0, 90000.0, 99999.0, "LUXURY", true)).ovr()).isLessThanOrEqualTo(FlairTier.GENERATED_MAX);
        assertThat(FlairTier.tierOf(64)).isEqualTo("BRONZE");
        assertThat(FlairTier.tierOf(65)).isEqualTo("PRATA");
        assertThat(FlairTier.tierOf(75)).isEqualTo("OURO");
        assertThat(FlairTier.position("shoes_piece")).isEqualTo("CAL");
        assertThat(FlairTier.position("full_body_piece")).isEqualTo("VES");
    }
}
