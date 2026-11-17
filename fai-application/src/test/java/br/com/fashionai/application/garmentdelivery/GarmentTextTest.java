package br.com.fashionai.application.garmentdelivery;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Texto livre da ficha reduzido a palavras sem acento para reconhecer tipo, fibra e cuidados. */
class GarmentTextTest {

    @Test
    void normalizaAcentosPontuacaoEMaiusculas() {
        String t = GarmentText.normalize("Calça-Jeans, 98% Algodão");
        assertThat(t).startsWith(" ").endsWith(" ");                                  // espaços nas pontas para casar palavras inteiras
        assertThat(t.trim().split(" +")).containsExactly("calca", "jeans", "98%", "algodao");
        assertThat(GarmentText.normalize(null)).isEqualTo(" ");
    }

    @Test
    void mantemDecimaisEPorcentagem() {
        assertThat(GarmentText.normalize("Elastano 2,5% e poliéster 97.5%")).isEqualTo(" elastano 2,5% e poliester 97.5% ");
    }

    @Test
    void palavraSoCasaNoComecoDeUmaPalavra() {
        String t = GarmentText.normalize("Camiseta de algodão");
        assertThat(GarmentText.has(t, "camiseta")).isTrue();
        assertThat(GarmentText.has(t, "algod")).isTrue();
        assertThat(GarmentText.has(t, "seta")).isFalse();
        assertThat(GarmentText.hasAny(t, List.of("jeans", "algodao"))).isTrue();
        assertThat(GarmentText.hasAny(t, List.of("jeans", "seda"))).isFalse();
    }

    @Test
    void primeiraPosicaoDeQualquerPalavraDaLista() {
        String t = GarmentText.normalize("vestido de seda com forro de algodão");
        assertThat(GarmentText.firstIndex(t, List.of("algodao", "seda"))).isEqualTo(t.indexOf(" seda"));
        assertThat(GarmentText.firstIndex(t, List.of("linho"))).isEqualTo(-1);
    }

    @Test
    void textoEmBranco() {
        assertThat(GarmentText.blank(null)).isTrue();
        assertThat(GarmentText.blank("  ")).isTrue();
        assertThat(GarmentText.blank("a")).isFalse();
    }
}
