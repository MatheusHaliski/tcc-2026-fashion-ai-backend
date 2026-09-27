package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TaxonomyTest {
    @Test
    void validPiecePassesValidation() {
        assertThatCode(() -> Taxonomy.requirePiece("upper_piece", "t_shirt", "UNISSEX", "white", "COTTON", "m",
                List.of("casual"), List.of("classic"))).doesNotThrowAnyException();
    }

    @Test
    void emptyFormReportsEveryFieldInsteadOfCrashing() {
        assertThatThrownBy(() -> Taxonomy.requirePiece(null, null, null, null, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.status()).isEqualTo(400);
                    assertThat(api.code()).isEqualTo("FORMULARIO_INVALIDO");
                    assertThat(api.details()).containsKeys("category", "sex", "color", "material", "size", "occasion", "style");
                });
    }

    @Test
    void subcategoryMustBelongToCategoryAndTagsAreLimited() {
        assertThatThrownBy(() -> Taxonomy.requirePiece("upper_piece", "jeans", "UNISSEX", "white", "COTTON", "m",
                List.of("casual"), List.of("classic")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).details()).containsKey("subcategory"));
        assertThatThrownBy(() -> Taxonomy.requirePiece("upper_piece", "t_shirt", "UNISSEX", "white", "COTTON", "m",
                List.of("casual"), List.of("classic", "modern", "chic")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).details()).containsKey("style"));
        assertThat(Taxonomy.categoryOf("jeans")).isEqualTo("lower_piece");
        assertThat(Taxonomy.isValidCategory(null)).isFalse();
    }

    // ---- P0 (27/09): estilos e ocasiões da PEÇA — até 2 de cada, mensagens que a pessoa entende ----
    private static java.util.Map<String, Object> pieceErrors(List<String> occasion, List<String> style) {
        try {
            Taxonomy.requirePiece("upper_piece", "t_shirt", "UNISSEX", "white", "COTTON", "m", occasion, style);
            return java.util.Map.of();
        } catch (br.com.fashionai.application.common.ApiException e) {
            java.util.Map<String, Object> d = e.details();
            return d;
        }
    }

    @Test
    void estiloDaPecaAceitaUmOuDoisEReprovaZeroOuTres() {
        assertThat(pieceErrors(List.of("casual"), List.of())).containsKey("style");
        assertThat(pieceErrors(List.of("casual"), List.of("classic"))).isEmpty();
        assertThat(pieceErrors(List.of("casual", "work"), List.of("classic", "basic"))).isEmpty();
        assertThat(String.valueOf(pieceErrors(List.of("casual"), List.of("classic", "basic", "chic")).get("style")))
                .contains("2").doesNotContain("taxonomia");
        assertThat(String.valueOf(pieceErrors(List.of("casual", "work", "party"), List.of("classic")).get("occasion"))).contains("2");
    }

    @Test
    void duplicatasContamUmaVez() {
        assertThat(pieceErrors(List.of("casual", "casual"), List.of("classic", "classic", "basic"))).isEmpty();
        assertThat(Taxonomy.canonicalTags(List.of(" Classic", "classic", "BASIC", ""))).containsExactly("classic", "basic");
    }

    @Test
    void ocasiaoNoCampoDeEstiloExplicaOEngano() {
        Object msg = pieceErrors(List.of("work"), List.of("casual")).get("style");
        assertThat(String.valueOf(msg)).contains("Casual").doesNotContain("fora da taxonomia");
        Object msg2 = pieceErrors(List.of("classic"), List.of("basic")).get("occasion");
        assertThat(String.valueOf(msg2)).contains("Clássico").doesNotContain("fora da taxonomia");
    }

    @Test
    void esquemaContinuaComAteTres() {
        java.util.Map<String, Object> errors = new java.util.LinkedHashMap<>();
        Taxonomy.requireTags("style", List.of("classic", "basic", "chic"), Taxonomy.STYLES, Taxonomy.MAX_SCHEME_TAGS, errors);
        assertThat(errors).isEmpty();
        Taxonomy.requireTags("style", List.of("classic", "basic", "chic", "glam"), Taxonomy.STYLES, Taxonomy.MAX_SCHEME_TAGS, errors);
        assertThat(String.valueOf(errors.get("style"))).contains("3");
    }
}
