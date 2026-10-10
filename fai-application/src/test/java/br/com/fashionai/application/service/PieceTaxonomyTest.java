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
        assertThat(w.getVariationSource()).isEqualTo("USER");
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

    private static WardrobeService.PieceForm confirming(WardrobeService.PieceForm f, List<String> confirmed) {
        return new WardrobeService.PieceForm(f.draftId(), f.useDefaultImage(), f.name(), f.category(), f.subcategory(), f.sex(),
                f.brandId(), f.brandName(), f.color(), f.material(), f.size(), f.market(), f.occasion(), f.style(), f.seals(),
                f.price(), f.visibility(), f.tags(), f.notes(), f.condition(), f.purchaseDate(), f.purchaseLocation(), f.sku(),
                f.careInstructions(), f.forSale(), f.studio(), f.brandLogoUrl(), f.brandSource(), f.brandRef(), f.background(),
                f.captureSessionId(), f.variation(), f.attributes(), confirmed);
    }

    @Test
    void variacaoSugeridaPelaIaSoViraDaPessoaQuandoConfirmadaOuTrocada() {
        Map<String, Object> prefill = Map.of("variation", "MOM", "variationConfidence", 0.82);

        // volta igual à sugestão, sem confirmação: continua sugestão da IA, com a confiança dela
        WardrobeItem untouched = piece();
        WardrobeService.applyTaxonomy(untouched, form("jeans", "DENIM", "MOM", null), prefill);
        assertThat(untouched.getVariationStatus()).isEqualTo("AI_SUGGESTED");
        assertThat(untouched.getVariationSource()).isEqualTo("AI");
        assertThat(untouched.getVariationConfidence()).isEqualByComparingTo("0.82");

        // reenviada sem mudança na edição: a proveniência fica como está
        WardrobeService.applyTaxonomy(untouched, form("jeans", "DENIM", "MOM", null));
        assertThat(untouched.getVariationStatus()).isEqualTo("AI_SUGGESTED");

        // confirmada depois, na edição: vira da pessoa
        WardrobeService.applyTaxonomy(untouched, confirming(form("jeans", "DENIM", "MOM", null), List.of("variation")));
        assertThat(untouched.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        assertThat(untouched.getVariationSource()).isEqualTo("USER");
        assertThat(untouched.getVariationConfidence()).isNull();

        // confirmada já no cadastro
        WardrobeItem confirmed = piece();
        WardrobeService.applyTaxonomy(confirmed, confirming(form("jeans", "DENIM", "MOM", null), List.of("variation")), prefill);
        assertThat(confirmed.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        assertThat(confirmed.getVariationSource()).isEqualTo("USER");

        // trocada pela pessoa: é escolha dela
        WardrobeItem changed = piece();
        WardrobeService.applyTaxonomy(changed, form("jeans", "DENIM", "WIDE_LEG", null), prefill);
        assertThat(changed.getVariationStatus()).isEqualTo("USER_CONFIRMED");
        assertThat(changed.getVariationSource()).isEqualTo("USER");
        assertThat(changed.getVariationConfidence()).isNull();
    }
}
