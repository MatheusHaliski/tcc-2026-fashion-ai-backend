package br.com.fashionai.application.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class DnaIdentityPhraseWordingTest {
    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void silhuetaApareceEmPalavrasDoIdiomaNaoComoCodigo() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(DnaIdentityPhrase.silhouetteWord("layering")).isEqualTo("em camadas");
        assertThat(DnaIdentityPhrase.silhouetteWord("oversized")).isEqualTo("ampla");
        assertThat(DnaIdentityPhrase.silhouetteWord("fitted")).isEqualTo("ajustada");
        LocaleContextHolder.setLocale(Locale.forLanguageTag("es"));
        assertThat(DnaIdentityPhrase.silhouetteWord("layering")).isEqualTo("en capas");
    }
}
