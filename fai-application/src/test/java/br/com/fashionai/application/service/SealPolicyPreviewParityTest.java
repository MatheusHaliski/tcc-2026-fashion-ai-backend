package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercício 12: a prévia de elegibilidade e o pedido real usam o mesmo avaliador. Para o mesmo look, as peças contadas
 * na prévia são as que o vínculo grava; 1 azul + 1 vermelha não atende "no mínimo 2 azuis" em nenhum dos dois; e só o
 * dono do look pede a prévia.
 */
class SealPolicyPreviewParityTest extends SealPromotionFlowFixture {
    private static Map<String, Object> doisAzuis() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("quantifier", "AT_LEAST");
        r.put("count", 2);
        r.put("color", "blue");
        return policyOf(r);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> previa(Scheme look) {
        return (List<Map<String, Object>>) seals.previewScheme(anaSession, look.getId()).get("suggestions");
    }

    @Test
    void previaEPedidoRealContamAsMesmasPecas() {
        seal(brand, "Azul em dobro", SealTier.LOOK, doisAzuis(), null);
        WardrobeItem azul1 = piece(ana, "Camisa", "Maison", "blue");
        WardrobeItem azul2 = piece(ana, "Calça", "Maison", "blue");
        WardrobeItem vermelha = piece(ana, "Bolsa", "Maison", "red");
        Scheme look = look("Azul", azul1, vermelha, azul2);

        Map<String, Object> naPrevia = previa(look).stream().filter(s -> brand.getId().equals(s.get("targetOwnerId"))).findFirst().orElseThrow();
        UUID vinculo = suggestionFor(look, brand);

        assertThat(naPrevia.get("pieceIds")).isEqualTo(List.of(azul1.getId(), azul2.getId()));
        assertThat(naPrevia.get("justification")).asString().isNotBlank();
        assertThat(br.com.fashionai.application.common.Json.strings(bond(vinculo).getLinkedPieceIdsJson()))
                .containsExactly(azul1.getId().toString(), azul2.getId().toString());
    }

    @Test
    void umaAzulEUmaVermelhaNaoAtendeNemNaPreviaNemNoPedido() {
        seal(brand, "Azul em dobro", SealTier.LOOK, doisAzuis(), null);
        Scheme look = look("Misto", piece(ana, "Camisa", "Maison", "blue"), piece(ana, "Bolsa", "Maison", "red"));

        assertThat(previa(look)).noneMatch(s -> brand.getId().equals(s.get("targetOwnerId")));
        assertThat(suggestions(look)).isEmpty();
    }

    @Test
    void soODonoDoLookPedeAPrevia() {
        seal(brand, "Azul em dobro", SealTier.LOOK, doisAzuis(), null);
        Scheme look = look("Azul", piece(ana, "Camisa", "Maison", "blue"), piece(ana, "Calça", "Maison", "blue"));

        assertThatThrownBy(() -> seals.previewScheme(visitor, look.getId()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> seals.previewScheme(brandSession, look.getId()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
    }
}
