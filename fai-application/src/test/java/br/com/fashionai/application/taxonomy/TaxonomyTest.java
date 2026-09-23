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
}
