package br.com.fashionai.application.fit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Grades de referência do provador: letras, numeração de calças/saias e calçado. */
class SizeGridsTest {

    @Test
    void gradesTemOsLimitesDocumentados() {
        assertThat(SizeGrids.LETTER).containsExactly("PP", "P", "M", "G", "GG", "XG");
        assertThat(SizeGrids.NUMERIC).first().isEqualTo("34");
        assertThat(SizeGrids.NUMERIC).last().isEqualTo("50");
        assertThat(SizeGrids.NUMERIC).hasSize(9);
        assertThat(SizeGrids.SHOES).first().isEqualTo("33");
        assertThat(SizeGrids.SHOES).last().isEqualTo("46");
        assertThat(SizeGrids.SHOES).hasSize(14);
    }

    @Test
    void gradeDependeDaCategoriaEDaSubcategoria() {
        assertThat(SizeGrids.gridOf("shoes_piece", "sneakers")).isEqualTo("shoes");
        assertThat(SizeGrids.gridOf("lower_piece", "jeans")).isEqualTo("numeric");
        assertThat(SizeGrids.gridOf("LOWER_PIECE", "Midi_Skirt")).isEqualTo("numeric");
        assertThat(SizeGrids.gridOf("lower_piece", "sweatpants")).isEqualTo("letter");
        assertThat(SizeGrids.gridOf("upper_piece", "t_shirt")).isEqualTo("letter");
        assertThat(SizeGrids.gridOf("full_body_piece", "dress")).isEqualTo("letter");
        assertThat(SizeGrids.gridOf("accessory_piece", "belt")).isNull();
        assertThat(SizeGrids.gridOf(null, null)).isNull();
    }

    @Test
    void rotuloDoCadastroViraORotuloDaGrade() {
        assertThat(SizeGrids.labelOf("xs")).isEqualTo("PP");
        assertThat(SizeGrids.labelOf(" L ")).isEqualTo("G");
        assertThat(SizeGrids.labelOf("xxl")).isEqualTo("XG");
        assertThat(SizeGrids.labelOf("br_40")).isEqualTo("40");
        assertThat(SizeGrids.labelOf("shoe_38")).isEqualTo("38");
        assertThat(SizeGrids.labelOf("one_size")).isEqualTo("one_size");
        assertThat(SizeGrids.labelOf("plus_size")).isEqualTo("PLUS_SIZE");
        assertThat(SizeGrids.labelOf(" ")).isNull();
        assertThat(SizeGrids.labelOf(null)).isNull();
    }

    @Test
    void rotulosDeCadaGrade() {
        assertThat(SizeGrids.labels("letter")).isSameAs(SizeGrids.LETTER);
        assertThat(SizeGrids.labels("numeric")).isSameAs(SizeGrids.NUMERIC);
        assertThat(SizeGrids.labels("shoes")).isSameAs(SizeGrids.SHOES);
        assertThat(SizeGrids.labels("outra")).isEmpty();
        assertThat(SizeGrids.labels(null)).isEmpty();
    }
}
