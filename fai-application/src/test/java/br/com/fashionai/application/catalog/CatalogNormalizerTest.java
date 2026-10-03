package br.com.fashionai.application.catalog;

import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogNormalizerTest {
    private final CatalogNormalizer n = CatalogNormalizer.get();

    @Test
    void normalizationJsonEspelhaATaxonomiaDoBackend() {
        assertThat(n.taxonomy()).isEqualTo(Taxonomy.SUBCATEGORIES);
        Taxonomy.COLORS.keySet().forEach(c -> assertThat(n.color(c)).as(c).contains(c));
        Taxonomy.MATERIALS.forEach(m -> assertThat(n.material(m)).contains(m));
    }

    @Test
    void sinonimosViramCodigosDaTaxonomia() {
        assertThat(n.subcategory("Tee")).contains("t_shirt");
        assertThat(n.subcategory("camiseta")).contains("t_shirt");
        assertThat(n.subcategory("T-Shirt")).contains("t_shirt");
        assertThat(n.subcategory("tênis")).contains("casual_sneakers");
        assertThat(n.category("Calçados")).contains("shoes_piece");
        assertThat(n.category("UPPER_PIECE")).contains("upper_piece");
        assertThat(n.color("branco")).contains("white");
        assertThat(n.color("White/Black")).contains("white");
        assertThat(n.material("100% algodão")).contains("COTTON");
        assertThat(n.gender("Men")).contains("MASCULINO");
    }

    @Test
    void marcaComGrafiasEApelidosResolveNoMesmoSlug() {
        assertThat(n.brandSlug("NIKE")).isEqualTo("nike");
        assertThat(n.brandSlug("Levi's")).isEqualTo("levis");
        assertThat(n.brandSlug("PRL")).isEqualTo("ralph-lauren");
        assertThat(n.brandSlug("Polo Ralph Lauren")).isEqualTo("ralph-lauren");
        assertThat(n.brandSlug("H&M")).isEqualTo("h-m");
    }

    @Test
    void dedupPeloIdentificadorMaisForte() {
        assertThat(n.dedupKey("nike", "0195238321123", null, null, "CW2288-111", null, null, null, null, "x", null))
                .isEqualTo("gtin:0195238321123");
        assertThat(n.dedupKey("nike", null, null, null, "cw2288-111", null, null, null, null, "x", null)).isEqualTo("sku:nike:CW2288111");
        assertThat(n.dedupKey("nike", null, null, null, null, null, "https://www.nike.com/t/af1/CW2288-111?x=1", null, null, "x", null))
                .isEqualTo("url:nike.com/t/af1/CW2288-111");
        String a = n.dedupKey("nike", null, null, null, null, null, null, "Air Force 1 '07", "White", "x", "white");
        String b = n.dedupKey("nike", null, null, null, null, null, null, "air force 1 07", "white", "y", "white");
        assertThat(a).isEqualTo(b);
    }

    @Test
    void dominioOficialAceitaSubdominio() {
        assertThat(CatalogNormalizer.domain("https://www.nike.com.br/p/x")).isEqualTo("nike.com.br");
        assertThat(CatalogNormalizer.sameSite("store.nike.com", "nike.com")).isTrue();
        assertThat(CatalogNormalizer.sameSite("fakenike.com", "nike.com")).isFalse();
        assertThat(CatalogNormalizer.sameSite("pinterest.com", "nike.com")).isFalse();
    }
}
