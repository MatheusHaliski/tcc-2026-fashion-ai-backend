package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.taxonomy.TaxonomyRegistry;

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
    void subcategoriaAntigaUsaOEnquadramentoDaQueASubstituiu() {
        // denim_shorts virou LEGACY na taxonomia (substituída por shorts + material DENIM): a peça antiga continua com o
        // enquadramento do short, não com o genérico da parte de baixo
        assertThat(registry.profile(PieceType.LOWER_PIECE, "denim_shorts").focus())
                .isEqualTo(registry.profile(PieceType.LOWER_PIECE, "shorts").focus());
        assertThat(registry.profile(PieceType.LOWER_PIECE, "denim_shorts").focus())
                .isNotEqualTo(registry.profile(PieceType.LOWER_PIECE, null).focus());
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
        // a taxonomia (TaxonomyRegistry) conhece as subcategorias ativas e as LEGACY: o registro pode guardar o
        // enquadramento próprio de uma subcategoria antiga (bota de cano curto, tênis cano alto…) para as peças já gravadas;
        // o normalizador do catálogo só indexa as ativas
        TaxonomyRegistry n = TaxonomyRegistry.get();
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
