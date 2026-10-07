package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.application.catalog.image.SemanticRegionRegistry.FramingRule.Align;
import br.com.fashionai.application.catalog.image.SemanticRegionRegistry.FramingRule.Fit;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SemanticRegionRegistryTest {
    private final SemanticRegionRegistry registry = SemanticRegionRegistry.get();

    @Test
    void subcategoriaSobrescreveSoOQueDeclara() {
        SemanticRegionRegistry.Profile jeans = registry.profile(PieceType.LOWER_PIECE, "jeans");
        SemanticRegionRegistry.Profile base = registry.profile(PieceType.LOWER_PIECE, "cargo_pants");
        assertThat(jeans.focus().name()).isEqualTo("waistband_patch_back_pockets");
        assertThat(jeans.focus().rect().h()).isEqualTo(0.38);
        assertThat(base.focus().rect().h()).isEqualTo(0.40);
        assertThat(jeans.critical()).extracting(SemanticRegionRegistry.Region::name)
                .containsExactly("waistband", "patch", "back_pocket_left", "back_pocket_right");
        assertThat(registry.profile(PieceType.LOWER_PIECE, "skirt").critical()).extracting(SemanticRegionRegistry.Region::name)
                .containsExactly("waistband");
        assertThat(jeans.occupancy()).isEqualTo(base.occupancy());
        assertThat(jeans.rule()).isEqualTo(base.rule());
    }

    @Test
    void todoPieceTypeTemRegraDeEnquadramentoEMargemCoerente() {
        for (PieceType t : PieceType.values()) {
            SemanticRegionRegistry.Profile p = registry.profile(t, null);
            assertThat(p.rule()).as(t.name()).isNotNull();
            double maxMargin = p.rule().fit() == Fit.CONTAIN ? 0.06 : 0.02;
            assertThat(p.margin()[0]).as(t.name()).isBetween(0.0, maxMargin);
            assertThat(p.focus().rect().w()).isPositive();
        }
        assertThat(registry.aspectRatio()).isEqualTo(0.8);
    }

    /** Regras de Enquadramento do Produto (§9.1): uma linha por regra do produto final. */
    @Test
    void regrasDoProdutoFinalPorCategoria() {
        assertRule(PieceType.UPPER_PIECE, "t_shirt", Fit.COVER, Align.TOP, "FRONT", true);
        assertRule(PieceType.LOWER_PIECE, "jeans", Fit.COVER, Align.TOP, "BACK", true);
        assertRule(PieceType.SHOES_PIECE, "casual_sneakers", Fit.WIDTH, Align.CENTER, "SIDE", false);
        assertRule(PieceType.ACCESSORY_PIECE, "sunglasses", Fit.WIDTH, Align.CENTER, "FRONT", false);
        assertRule(PieceType.ACCESSORY_PIECE, "watch", Fit.COVER, Align.FOCUS, "ANY", false);
        for (String jewel : new String[]{"bracelet", "earrings", "ring", "necklace"}) {
            assertRule(PieceType.ACCESSORY_PIECE, jewel, Fit.CONTAIN, Align.CENTER, "TOP", false);
        }
        assertRule(PieceType.ACCESSORY_PIECE, "beanie", Fit.CONTAIN, Align.CENTER, "ANY", false);
        assertRule(PieceType.ACCESSORY_PIECE, "scarf", Fit.CONTAIN, Align.CENTER, "ANY", false);
        assertRule(PieceType.ACCESSORY_PIECE, "belt", Fit.CONTAIN, Align.FOCUS, "ANY", false);
        assertThat(registry.profile(PieceType.ACCESSORY_PIECE, "belt").focus().name()).isEqualTo("buckle");
    }

    private void assertRule(PieceType t, String sub, Fit fit, Align align, String view, boolean topHalf) {
        SemanticRegionRegistry.FramingRule r = registry.profile(t, sub).rule();
        assertThat(r).as(sub).isEqualTo(new SemanticRegionRegistry.FramingRule(fit, align, view, topHalf));
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
    void subcategoriaAntigaUsaOEnquadramentoDaQueASubstituiu() {
        assertThat(registry.profile(PieceType.LOWER_PIECE, "denim_shorts").focus())
                .isEqualTo(registry.profile(PieceType.LOWER_PIECE, "shorts").focus());
        assertThat(registry.profile(PieceType.LOWER_PIECE, "denim_shorts").focus())
                .isNotEqualTo(registry.profile(PieceType.LOWER_PIECE, null).focus());
    }

    @Test
    void categoriaDesconhecidaViraAcessorio() {
        assertThat(PieceType.of("upper_piece")).isEqualTo(PieceType.UPPER_PIECE);
        assertThat(PieceType.of(null)).isEqualTo(PieceType.ACCESSORY_PIECE);
        assertThat(PieceType.LOWER_PIECE.landmarkFamily("skirt")).isEqualTo("SKIRT");
        assertThat(PieceType.ACCESSORY_PIECE.landmarkFamily("watch")).isEqualTo("WATCH");
    }
}
