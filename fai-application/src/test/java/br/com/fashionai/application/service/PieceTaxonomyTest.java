package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Peça com variação e atributos da taxonomia nova; código LEGACY vira o equivalente (docs/taxonomia, C.3 e C.6). */
class PieceTaxonomyTest {

    private static WardrobeService.PieceForm form(String sub, String material, String variation, Map<String, List<String>> attrs) {
        return new WardrobeService.PieceForm(null, true, "Peça", Taxonomy.categoryOf(sub), sub, "UNISSEX", null, null, "blue",
                material, "m", null, List.of("casual"), List.of("streetwear"), List.of(), BigDecimal.TEN, null, List.of(), null,
                null, null, null, null, null, false, null, null, null, null, null, null, variation, attrs);
    }

    private static WardrobeItem piece() {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername("ana");
        u.setProfileType(br.com.fashionai.domain.model.enums.ProfileType.PESSOAL);
        w.setUser(u);
        w.setVisibility(Visibility.PRIVATE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        return w;
    }

    @Test
    void legadoNoFormularioViraSubcategoriaNovaMaisAtributo() {
        WardrobeService.PieceForm bermuda = form("bermuda_shorts", "COTTON", null, null).resolveTaxonomy();
        assertThat(bermuda.subcategory()).isEqualTo("shorts");
        assertThat(bermuda.attributes()).containsEntry("LENGTH", List.of("KNEE"));
        WardrobeService.PieceForm shortJeans = form("denim_shorts", "COTTON", null, null).resolveTaxonomy();
        assertThat(shortJeans.subcategory()).isEqualTo("shorts");
        assertThat(shortJeans.material()).isEqualTo("DENIM");                       // algodão antigo → denim
        WardrobeService.PieceForm coturno = form("combat_boots", "LEATHER", null, Map.of("SHAFT_HEIGHT", List.of("MID_CALF"))).resolveTaxonomy();
        assertThat(coturno.subcategory()).isEqualTo("boots");
        assertThat(coturno.variation()).isEqualTo("COMBAT");
        assertThat(coturno.attributes()).containsEntry("SHAFT_HEIGHT", List.of("MID_CALF")); // a escolha da pessoa vale
        assertThat(form("jeans", "DENIM", "mom", null).variation()).isEqualTo("MOM");          // código normalizado
        assertThat(Taxonomy.variationErrors("lower_piece", bermuda.subcategory(), bermuda.variation(), bermuda.attributes())).isEmpty();
    }

    @Test
    void gravaVariacaoAtributosEstiloEOcasiao() {
        WardrobeItem w = piece();
        WardrobeService.PieceForm f = form("jeans", "DENIM", "MOM", Map.of("RISE", List.of("HIGH_RISE"), "FINISH", List.of("RIPPED", "LIGHT_WASH")));
        WardrobeService.applyTaxonomy(w, f);
        assertThat(w.getVariationCode()).isEqualTo("MOM");
        assertThat(w.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        Map<String, List<String>> all = TaxonomyAttribute.toMap(w.getAttributes(), java.util.Set.of());
        assertThat(all).containsEntry("RISE", List.of("HIGH_RISE")).containsEntry("FINISH", List.of("RIPPED", "LIGHT_WASH"))
                .containsEntry("STYLE", List.of("streetwear")).containsEntry("OCCASION", List.of("casual"));

        // a view mostra variação e atributos (sem estilo/ocasião, que têm campo próprio)
        w.setName("Mom");
        Views.PieceView v = Views.piece(w, null, null);
        assertThat(v.variation()).isEqualTo("MOM");
        assertThat(v.attributes()).containsOnlyKeys("RISE", "FINISH");

        // formulário antigo (sem variação nem atributos) não apaga o que a peça tem
        WardrobeService.applyTaxonomy(w, form("jeans", "DENIM", null, null));
        assertThat(w.getVariationCode()).isEqualTo("MOM");
        assertThat(TaxonomyAttribute.toMap(w.getAttributes(), Taxonomy.FIELD_DIMENSIONS)).containsKeys("RISE", "FINISH");

        // formulário novo sem uma dimensão: ela sai; variação trocada
        WardrobeService.applyTaxonomy(w, form("jeans", "DENIM", "WIDE_LEG", Map.of("RISE", List.of("MID_RISE"))));
        assertThat(w.getVariationCode()).isEqualTo("WIDE_LEG");
        assertThat(TaxonomyAttribute.toMap(w.getAttributes(), Taxonomy.FIELD_DIMENSIONS)).containsOnlyKeys("RISE").containsEntry("RISE", List.of("MID_RISE"));

        // mudou de subcategoria com formulário antigo: a variação que não vale mais sai
        WardrobeService.applyTaxonomy(w, form("skirt", "DENIM", null, null));
        assertThat(w.getVariationCode()).isNull();
    }
}
