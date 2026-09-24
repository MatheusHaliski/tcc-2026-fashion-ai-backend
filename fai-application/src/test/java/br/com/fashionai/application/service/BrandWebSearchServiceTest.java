package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 · buscador web de marcas: regras puras (slug do catálogo aberto, casamento do texto, junção e ordem das fontes). */
class BrandWebSearchServiceTest {

    @Test
    void slugSegueARegraDoSimpleIcons() {
        assertThat(BrandWebSearchService.slugOf("H&M")).isEqualTo("handm");
        assertThat(BrandWebSearchService.slugOf("The North Face")).isEqualTo("thenorthface");
        assertThat(BrandWebSearchService.slugOf("Dr. Martens")).isEqualTo("drdotmartens");
        assertThat(BrandWebSearchService.slugOf("Hermès")).isEqualTo("hermes");
    }

    @Test
    void casamentoDoTextoDigitado() {
        assertThat(BrandWebSearchService.matchOf("Zara", List.of(), "zara")).isZero();
        assertThat(BrandWebSearchService.matchOf("Zara", List.of(), "zar")).isEqualTo(1);
        assertThat(BrandWebSearchService.matchOf("The North Face", List.of(), "north")).isEqualTo(2);
        assertThat(BrandWebSearchService.matchOf("Hennes & Mauritz", List.of("H&M"), "h&m")).isEqualTo(3);
        assertThat(BrandWebSearchService.matchOf("Nike", List.of(), "zara")).isEqualTo(9);
        assertThat(BrandWebSearchService.matchOf("Lazarus", List.of(), "zar")).isEqualTo(9);        // no meio da palavra não conta
        assertThat(BrandWebSearchService.matchOf("CSS Wizardry", List.of(), "zar")).isEqualTo(9);
    }

    @Test
    void mesmaMarcaDeDuasFontesViraUmResultadoDaFonteMaisConfiavel() {
        BrandWebSearchService.Hit si = new BrandWebSearchService.Hit("Zara", "Logo vetorial", "SIMPLE_ICONS", "zara", "zara.com", "https://www.zara.com",
                "#000000", "https://raw/zara.svg", true, null, 0);
        BrandWebSearchService.Hit wd = new BrandWebSearchService.Hit("Zara", "rede espanhola de lojas de roupa", "WIKIDATA", "Q147662", null, null,
                null, null, false, true, 0);
        BrandWebSearchService.Hit other = new BrandWebSearchService.Hit("Zara Home", "decoração", "SIMPLE_ICONS", "zarahome", null, null,
                null, null, true, null, 1);
        List<BrandWebSearchService.Hit> merged = BrandWebSearchService.merge(List.of(other, si, wd));
        assertThat(merged).hasSize(2);
        BrandWebSearchService.Hit zara = merged.get(0);
        assertThat(zara.source()).isEqualTo("WIKIDATA");
        assertThat(zara.domain()).isEqualTo("zara.com");            // herdado do catálogo aberto
        assertThat(zara.logoUrl()).isEqualTo("https://raw/zara.svg");
        assertThat(zara.vector()).isTrue();
        assertThat(merged.get(1).name()).isEqualTo("Zara Home");
    }
}
