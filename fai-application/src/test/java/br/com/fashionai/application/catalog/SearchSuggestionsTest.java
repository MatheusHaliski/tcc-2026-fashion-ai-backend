package br.com.fashionai.application.catalog;

import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

class SearchSuggestionsTest {
    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void naoSugereOProprioTermoNemPeloNomeNaTela() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(SearchSuggestions.similar("jaqueta", List.of("jacket", "jeans", "casual"))).doesNotContain("jacket");
        assertThat(SearchSuggestions.similar("jeans", List.of("jeans", "earrings"))).doesNotContain("jeans");
    }

    @Test
    void sugereTermoParecidoComErroDeDigitacao() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(SearchSuggestions.similar("casul", List.of("casual", "formal"))).containsExactly("casual");
    }
}
