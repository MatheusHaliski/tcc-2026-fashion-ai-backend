package br.com.fashionai.application.catalog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Título da loja com marcação HTML ("Supima<sup>®</sup>") vira texto puro na importação e no card da busca. */
class CatalogPlainTextTest {
    @Test
    void tiraMarcacaoEEntidadesDoTitulo() {
        assertThat(CatalogIngestService.plainText("Supima<sup>®</sup> Cotton Pique Polo Shirt")).isEqualTo("Supima® Cotton Pique Polo Shirt");
        assertThat(CatalogIngestService.plainText("Levi&#39;s 501 &amp; Co.")).isEqualTo("Levi's 501 & Co.");
        assertThat(CatalogIngestService.plainText("  Camiseta   básica ")).isEqualTo("Camiseta básica");
        assertThat(CatalogIngestService.plainText(null)).isNull();
    }
}
