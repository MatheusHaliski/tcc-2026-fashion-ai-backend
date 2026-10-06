package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.catalog.CatalogNormalizer;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Taxonomia CATEGORY → SUBCATEGORY → VARIATION + atributos (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md). */
class TaxonomyRegistryTest {
    private final TaxonomyRegistry reg = TaxonomyRegistry.get();

    private static Set<String> attrKeys(Map<String, Object> errors) {
        return ((Map<?, ?>) errors.get("attributes")).keySet().stream().map(String::valueOf).collect(Collectors.toSet());
    }

    @Test
    void subcategoriasAtivasNovasELegado() {
        assertThat(reg.activeSubcategories().get("upper_piece")).contains("top").doesNotContain("crop_top");
        assertThat(reg.activeSubcategories().get("shoes_piece")).contains("boots").doesNotContain("ankle_boots", "long_boots", "combat_boots");
        assertThat(reg.activeSubcategories().values().stream().mapToInt(List::size).sum()).isEqualTo(72);
        assertThat(reg.legacySubcategories()).hasSize(8);
        assertThat(Taxonomy.SUBCATEGORIES).isEqualTo(reg.activeSubcategories());
        assertThat(Taxonomy.categoryOf("bermuda_shorts")).isEqualTo("lower_piece");   // legado continua válido
        assertThat(Taxonomy.isSubcategoryOf("lower_piece", "bermuda_shorts")).isTrue();
    }

    @Test
    void legadoViraSubcategoriaNovaMaisAtributo() {
        TaxonomyRegistry.Resolved bermuda = reg.resolve("bermuda_shorts");
        assertThat(bermuda.subcategory()).isEqualTo("shorts");
        assertThat(bermuda.implied()).containsEntry("LENGTH", "KNEE");
        assertThat(bermuda.legacyCode()).isEqualTo("bermuda_shorts");
        TaxonomyRegistry.Resolved coturno = reg.resolve("combat_boots");
        assertThat(coturno.subcategory()).isEqualTo("boots");
        assertThat(coturno.variation()).isEqualTo("COMBAT");
        assertThat(reg.resolve("long_boots").needsReview()).isTrue();
        assertThat(reg.resolve("crossbody_bag").implied()).containsEntry("CARRY_MODE", "CROSSBODY");
        assertThat(reg.resolve("jeans").legacyCode()).isNull();
        assertThat(reg.resolve("inventado")).isNull();
    }

    @Test
    void variacoesDosJeansPedidas() {
        Set<String> jeans = reg.variationsOf("jeans").stream().map(TaxonomyRegistry.VariationLink::code).collect(Collectors.toSet());
        assertThat(jeans).contains("SKINNY", "SLIM", "STRAIGHT", "REGULAR", "RELAXED", "LOOSE", "BAGGY", "WIDE_LEG", "TAPERED",
                "BOOTCUT", "FLARE", "BELL_BOTTOM", "MOM", "DAD", "BOYFRIEND", "GIRLFRIEND", "CARROT", "BARREL", "BALLOON", "HORSESHOE");
        assertThat(reg.variationsOf("jeans").get(0).tier()).isEqualTo("CORE");   // CORE primeiro
        assertThat(reg.isVariationOf("jeans", "MOM")).isTrue();
        assertThat(reg.isVariationOf("skirt", "MOM")).isFalse();
        assertThat(reg.variationsOf("bermuda_shorts")).isEmpty();                 // legado não tem variação própria
    }

    @Test
    void aliasViraCodigoNoEscopoDaSubcategoria() {
        assertThat(reg.variationByText("jeans", "boca de sino")).contains("BELL_BOTTOM");
        assertThat(reg.variationByText("jeans", "Mom Jeans")).contains("MOM");
        assertThat(reg.variationByText("dress", "chemise")).contains("SHIRT_DRESS");
        assertThat(reg.variationByText("skirt", "godê")).contains("CIRCLE");
        assertThat(reg.variationByText("dress", "godê")).contains("FIT_AND_FLARE");   // mesmo alias, outra subcategoria
        assertThat(reg.variationByText("jeans", "chemise")).isEmpty();
        assertThat(reg.variationInText("jeans", "Calça Jeans Wide Leg Cintura Alta Azul")).contains("WIDE_LEG");
        assertThat(reg.variationInText("t_shirt", "Camiseta Oversized Preta")).contains("OVERSIZED");
        assertThat(reg.variationInText("t_shirt", "Camiseta Preta")).isEmpty();
        assertThat(reg.valueByText("RISE", "lower_piece", "jeans", "cintura alta")).contains("HIGH_RISE");
        assertThat(reg.valueByText("LENGTH", "lower_piece", "jeans", "cropped")).contains("ANKLE_LENGTH");   // calça cropped = 7/8
        assertThat(reg.valueByText("LENGTH", "upper_piece", "t_shirt", "cropped")).contains("CROPPED");
    }

    @Test
    void escopoDasDimensoes() {
        assertThat(reg.valuesFor("RISE", "upper_piece", "t_shirt")).isEmpty();
        assertThat(reg.valuesFor("RISE", "lower_piece", "jeans")).isNotEmpty();
        assertThat(reg.valuesFor("SHAFT_HEIGHT", "accessory_piece", "socks")).extracting(TaxonomyRegistry.Value::code).contains("CREW").doesNotContain("HIGH_TOP");
        assertThat(reg.valuesFor("SHAFT_HEIGHT", "shoes_piece", "casual_sneakers")).extracting(TaxonomyRegistry.Value::code).contains("HIGH_TOP");
        assertThat(reg.valuesFor("MATERIAL", "upper_piece", null)).extracting(TaxonomyRegistry.Value::code).contains("DENIM", "LINEN").doesNotContain("BLEND");
        assertThat(Taxonomy.isMaterial("BLEND")).isTrue();     // legado aceito nos dados
        assertThat(Taxonomy.MATERIALS).doesNotContain("BLEND", "SYNTHETIC").contains("COTTON", "DENIM", "LINEN", "VISCOSE");
    }

    @Test
    void validacaoDaVariacaoEDosAtributos() {
        assertThat(Taxonomy.variationErrors("lower_piece", "jeans", "MOM", Map.of("RISE", List.of("HIGH_RISE"), "FINISH", List.of("RIPPED", "LIGHT_WASH")))).isEmpty();
        assertThat(Taxonomy.variationErrors("lower_piece", "skirt", "MOM", Map.of())).containsKey("variation");
        Map<String, Object> e = Taxonomy.variationErrors("upper_piece", "t_shirt", null, Map.of("RISE", List.of("HIGH_RISE")));
        assertThat(attrKeys(e)).contains("RISE");                         // cintura não vale para camiseta
        e = Taxonomy.variationErrors("lower_piece", "jeans", null, Map.of("LENGTH", List.of("MIDI", "MAXI")));
        assertThat(attrKeys(e)).contains("LENGTH");                       // comprimento é um só
        e = Taxonomy.variationErrors("lower_piece", "jeans", null, Map.of("FINISH", List.of("INVENTADO")));
        assertThat(attrKeys(e)).contains("FINISH");
        e = Taxonomy.variationErrors("shoes_piece", "heels", "PUMP", Map.of("HEEL_HEIGHT", List.of("FLAT")));
        assertThat(attrKeys(e)).contains("HEEL_HEIGHT");                  // salto rasteiro em "salto"
        e = Taxonomy.variationErrors("upper_piece", "t_shirt", null, Map.of("STYLE", List.of("classic")));
        assertThat(attrKeys(e)).contains("STYLE");                        // estilo vai no campo próprio
    }

    @Test
    void ocasiaoSemRestricaoPorCategoria() {
        assertThat(Taxonomy.allowedOccasions("accessory_piece")).contains("work", "formal", "wedding");
        assertThat(Taxonomy.pieceErrors("accessory_piece", "tie", "MASCULINO", "navy", "SILK", "one_size", List.of("work"), List.of("classic"))).isEmpty();
    }

    @Test
    void rotulosDosCodigosNovos() {
        assertThat(reg.label("BELL_BOTTOM", Locale.forLanguageTag("pt-BR"))).contains("Boca de sino");
        assertThat(reg.label("BELL_BOTTOM", Locale.ENGLISH)).contains("Bell-bottom");
        assertThat(reg.label("boots", Locale.forLanguageTag("es"))).contains("Botas");
    }

    @Test
    void normalizationJsonTemOsMesmosCodigos() {
        CatalogNormalizer n = CatalogNormalizer.get();
        assertThat(n.taxonomy()).isEqualTo(reg.activeSubcategories());
        assertThat(n.subcategory("bermuda")).contains("bermuda_shorts");      // sinônimo antigo → legado → shorts + KNEE
        assertThat(n.subcategory("corset")).contains("top");
        assertThat(n.material("linho")).contains("LINEN");
        assertThat(n.material("camiseta de la marca")).isEmpty();             // "la" não é mais lã
        assertThat(n.material("couro sintético")).contains("FAUX_LEATHER");
    }

    /** As migrations V40–V42 são geradas do mesmo JSON: cada variação e cada subcategoria do JSON está no seed. */
    @Test
    void seedDoBancoEmDiaComOJson() throws IOException {
        Path dir = Path.of("..", "fai-infrastructure", "persistence-mysql", "src", "main", "resources", "db", "migration");
        String v39 = Files.readString(dir.resolve("V45__taxonomia_seed_estrutura.sql"));
        String v41 = Files.readString(dir.resolve("V47__taxonomia_seed_variacoes.sql"));
        reg.variations().keySet().forEach(code -> assertThat(v41).as(code).contains("('" + code + "', "));
        reg.activeSubcategories().values().stream().flatMap(List::stream)
                .forEach(code -> assertThat(v39).as(code).contains("('" + code + "', "));
        long links = reg.activeSubcategories().values().stream().flatMap(List::stream).mapToLong(s -> reg.variationsOf(s).size()).sum();
        assertThat(v41.lines().filter(l -> l.matches("\\s+\\('[a-z_]+', '[A-Z0-9_]+', '(CORE|EXTENDED|NICHE)', \\d, \\d+\\)[,;]")).count()).isEqualTo(links);
    }
}
