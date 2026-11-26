package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Exercício 12 (política do selo: quantidade mínima por cor). A regra estruturada {quantifier, count, color} fica em
 * background_config_json.policy, é validada (AT_LEAST de 1 a 4, inteiro, cor da taxonomia) e conta peças distintas que
 * passam na mesma regra: 2 azuis passam, 1 azul + 1 vermelha não, e a mesma peça enviada duas vezes conta uma vez.
 */
class SealPolicyQuantidadeCorTest {
    private static WardrobeItem peca(String cor) {
        WardrobeItem w = new WardrobeItem();
        ReflectionTestUtils.setField(w, "id", UUID.randomUUID());
        w.setCategory("upper_piece");
        w.setColor(cor);
        return w;
    }

    private static Map<String, Object> regra(Object count, String color) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("quantifier", "AT_LEAST");
        r.put("count", count);
        r.put("color", color);
        return r;
    }

    private static Map<String, Object> politica(Object count, String color) {
        return Map.of("rules", List.of(regra(count, color)));
    }

    private static final SealPolicies.Policy DOIS_AZUIS = SealPolicies.parse(SealPolicies.normalize(politica(2, "blue")));

    private static SealPolicies.Verdict avaliar(WardrobeItem... pecas) {
        return SealPolicies.evaluate(DOIS_AZUIS, SealTier.LOOK, List.of(pecas), List.of(), List.of());
    }

    @Test
    void aPoliticaGravadaEAEstruturaDoContrato() {
        Map<String, Object> normalizada = SealPolicies.normalize(politica(2, "blue"));

        assertThat(normalizada).containsEntry("match", "ALL");
        assertThat(normalizada.get("rules")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST).singleElement()
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("quantifier", "AT_LEAST").containsEntry("count", 2).containsEntry("color", "blue");
        assertThat(DOIS_AZUIS.rules()).singleElement().satisfies(r -> {
            assertThat(r.quantifier()).isEqualTo("AT_LEAST");
            assertThat(r.count()).isEqualTo(2);
            assertThat(r.color()).isEqualTo("blue");
        });
        assertThat(SealPolicies.normalize(politica(2.0, "blue"))).as("2.0 é inteiro: o JSON pode trazer o número assim")
                .isEqualTo(normalizada);
    }

    @Test
    void duasAzuisPassamEAsPecasContadasSaoAsAzuis() {
        WardrobeItem azul1 = peca("blue");
        WardrobeItem azul2 = peca("blue");
        WardrobeItem preta = peca("black");

        SealPolicies.Verdict v = avaliar(azul1, preta, azul2);

        assertThat(v.matched()).isTrue();
        assertThat(v.pieceIds()).containsExactly(azul1.getId(), azul2.getId());
        assertThat(v.why()).isNotBlank();
    }

    @Test
    void umaAzulMaisUmaVermelhaNaoSomaParaARegraDeAzul() {
        SealPolicies.Verdict v = avaliar(peca("blue"), peca("red"));

        assertThat(v.matched()).isFalse();
        assertThat(v.pieceIds()).isEmpty();
        assertThat(avaliar(peca("blue")).matched()).isFalse();
        assertThat(avaliar(peca("red"), peca("red")).matched()).isFalse();
    }

    @Test
    void aMesmaPecaEnviadaDuasVezesContaUmaVezSo() {
        WardrobeItem azul = peca("blue");
        WardrobeItem outraAzul = peca("blue");

        assertThat(avaliar(azul, azul).matched()).as("uma peça azul repetida não vira duas").isFalse();
        SealPolicies.Verdict v = avaliar(azul, azul, outraAzul, outraAzul);
        assertThat(v.matched()).isTrue();
        assertThat(v.pieceIds()).containsExactly(azul.getId(), outraAzul.getId());
    }

    @Test
    void quantidadeZeroCincoOuFracionadaECorForaDaTaxonomiaSao400() {
        for (Object invalida : new Object[]{0, 5, -1, 2.5, 2.8, "2.5", "dois"}) {
            ApiException e = catchThrowableOfType(() -> SealPolicies.normalize(politica(invalida, "blue")), ApiException.class);
            assertThat(e).as("count %s", invalida).isNotNull();
            assertThat(e.status()).isEqualTo(400);
            assertThat(e.code()).isEqualTo("POLITICA_INVALIDA");
        }
        ApiException cor = catchThrowableOfType(() -> SealPolicies.normalize(politica(2, "azul-piscina")), ApiException.class);
        assertThat(cor.code()).isEqualTo("POLITICA_INVALIDA");
        for (Object valida : new Object[]{1, 4, "3"}) {
            assertThat(SealPolicies.normalize(politica(valida, "blue"))).as("count %s", valida).isNotNull();
        }
    }

    @Test
    void politicaAntigaSemRegrasNaoViraCondicaoObrigatoria() {
        assertThat(SealPolicies.normalize(null)).isNull();
        assertThat(SealPolicies.normalize(Map.of("rules", List.of()))).as("sem regra nem tag não há política").isNull();
        assertThat(SealPolicies.parse(null)).isNull();
        assertThat(SealPolicies.evaluate(null, SealTier.LOOK, List.of(peca("blue")), List.of(), List.of()).matched())
                .as("selo sem política estruturada não é concedido por esta avaliação").isFalse();
    }
}
