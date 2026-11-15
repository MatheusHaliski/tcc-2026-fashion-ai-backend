package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regressão da auditoria: buscar "Azul" na aba Peças não achava nenhuma peça azul (a cor é gravada como código). */
class SearchColorTermTest {
    static WardrobeItem piece(String name, String color) {
        WardrobeItem w = new WardrobeItem();
        ReflectionTestUtils.setField(w, "id", UUID.randomUUID());
        w.setName(name);
        w.setColor(color);
        return w;
    }

    @Test
    void nomeDaCorEmQualquerIdiomaViraCodigoDaTaxonomia() {
        assertThat(SearchColorTerm.codesOf("Azul")).contains("blue", "navy", "light_blue");
        assertThat(SearchColorTerm.codesOf("blue")).contains("blue");
        assertThat(SearchColorTerm.codesOf("azul-marinho")).containsExactly("navy");
        assertThat(SearchColorTerm.codesOf("AZUL MARINO")).containsExactly("navy");
        assertThat(SearchColorTerm.codesOf("Azul")).doesNotContain("black", "red");
    }

    @Test
    void termoQueNaoECorNaoMudaABusca() {
        assertThat(SearchColorTerm.codesOf("jaqueta")).isEmpty();
        assertThat(SearchColorTerm.codesOf("")).isEmpty();
        assertThat(SearchColorTerm.codesOf(null)).isEmpty();
        List<WardrobeItem> found = List.of(piece("Jaqueta", "black"));
        assertThat(SearchColorTerm.withColor(found, "jaqueta", () -> {
            throw new AssertionError("não deve ler as peças públicas");
        })).isSameAs(found);
    }

    @Test
    void pecasDaCorEntramDepoisDasAchadasPeloTextoSemRepetir() {
        WardrobeItem byName = piece("Camisa Azul", "white");
        WardrobeItem blue = piece("Jeans", "blue");
        WardrobeItem navy = piece("Blazer", "navy");
        WardrobeItem red = piece("Vestido", "red");
        List<WardrobeItem> out = SearchColorTerm.withColor(List.of(byName), "Azul", () -> List.of(byName, blue, red, navy));
        assertThat(out).containsExactly(byName, blue, navy);
    }

    /** Reauditoria: "camiseta azul" não achava nada, embora buscar só "azul" listasse as camisetas azuis. */
    @Test
    void tipoECorNaMesmaBuscaAchamAPecaDoTipoNaquelaCor() {
        WardrobeItem camisetaAzul = piece("Camiseta Zero", "blue");
        camisetaAzul.setSubcategory("t_shirt");
        WardrobeItem semNome = piece("Zero", "navy");
        semNome.setSubcategory("t_shirt");
        WardrobeItem jeansAzul = piece("Jeans", "blue");
        jeansAzul.setSubcategory("jeans");
        WardrobeItem camisetaVermelha = piece("Camiseta Vermelha", "red");
        camisetaVermelha.setSubcategory("t_shirt");
        List<WardrobeItem> todas = List.of(camisetaAzul, semNome, jeansAzul, camisetaVermelha);
        assertThat(SearchColorTerm.withColor(List.of(), "camiseta azul", () -> todas)).containsExactly(camisetaAzul, semNome);
        assertThat(SearchColorTerm.withColor(List.of(), "Azul Camiseta", () -> todas)).containsExactly(camisetaAzul, semNome);
        assertThat(SearchColorTerm.withColor(List.of(), "camiseta azul marinho", () -> todas)).containsExactly(semNome);
        assertThat(SearchColorTerm.withColor(List.of(), "t-shirt blue", () -> todas)).containsExactly(camisetaAzul);
        assertThat(SearchColorTerm.typeAndColor("jaqueta de couro")).isNull();
        assertThat(SearchColorTerm.typeAndColor("azul")).isNull();
    }
}
