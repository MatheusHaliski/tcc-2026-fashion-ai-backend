package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.CatalogNormalizer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SemanticRegionRegistryTest {
    private final SemanticRegionRegistry registry = SemanticRegionRegistry.get();

    @Test
    void subcategoriaSobrescreveSoOQueDeclara() {
        SemanticRegionRegistry.Profile jeans = registry.profile(PieceType.LOWER_PIECE, "jeans");
        SemanticRegionRegistry.Profile base = registry.profile(PieceType.LOWER_PIECE, "cargo_pants");
        assertThat(jeans.focus().name()).isEqualTo("waistband_front_coin_pocket");
        assertThat(jeans.critical()).extracting(SemanticRegionRegistry.Region::name).contains("coin_pocket");
        assertThat(base.focus().name()).isEqualTo("waistband_pockets");
        assertThat(jeans.occupancy()).isEqualTo(base.occupancy());
    }

    @Test
    void perfisRespeitamOcupacaoEMargemDoPadraoDeCatalogo() {
        for (PieceType t : PieceType.values()) {
            SemanticRegionRegistry.Profile p = registry.profile(t, null);
            assertThat(p.occupancy()[0]).isGreaterThanOrEqualTo(0.70);
            assertThat(p.occupancy()[2]).isLessThanOrEqualTo(0.92);
            assertThat(p.margin()[0]).isBetween(0.04, 0.08);
            assertThat(p.focus().rect().w()).isPositive();
        }
        assertThat(registry.aspectRatio()).isEqualTo(0.8);
    }

    @Test
    void calcadoSemCadarcoTemRegiaoEquivalente() {
        assertThat(registry.profile(PieceType.SHOES_PIECE, "loafers").laceless()).isTrue();
        assertThat(registry.profile(PieceType.SHOES_PIECE, "running_shoes").laceless()).isFalse();
    }

    @Test
    void subcategoriasDoRegistroExistemNaTaxonomiaDoMesmoPieceType() throws Exception {
        tools.jackson.databind.JsonNode root = new tools.jackson.databind.ObjectMapper()
                .readTree(getClass().getResourceAsStream(SemanticRegionRegistry.RESOURCE));
        CatalogNormalizer n = CatalogNormalizer.get();
        int checked = 0;
        for (PieceType t : PieceType.values()) {
            for (String sub : root.path("pieceTypes").path(t.name()).path("subcategories").propertyNames()) {
                assertThat(n.categoryOf(sub)).as(sub).isEqualToIgnoringCase(t.name());
                checked++;
            }
        }
        assertThat(checked).isGreaterThan(20);
    }

    @Test
    void categoriaDesconhecidaViraAcessorio() {
        assertThat(PieceType.of("upper_piece")).isEqualTo(PieceType.UPPER_PIECE);
        assertThat(PieceType.of(null)).isEqualTo(PieceType.ACCESSORY_PIECE);
        assertThat(PieceType.LOWER_PIECE.landmarkFamily("skirt")).isEqualTo("SKIRT");
        assertThat(PieceType.ACCESSORY_PIECE.landmarkFamily("watch")).isEqualTo("WATCH");
    }
}
