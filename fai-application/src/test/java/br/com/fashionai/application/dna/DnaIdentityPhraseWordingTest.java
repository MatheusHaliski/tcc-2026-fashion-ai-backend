package br.com.fashionai.application.dna;

import java.util.Locale;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

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

    @Test
    void fraseGravadaComOCodigoDaSilhuetaApareceComAPalavra() {
        assertThat(DnaIdentityPhrase.legivel("Minimalista de silhueta layering que chega de jaqueta — com elegância serena."))
                .isEqualTo("Minimalista de silhueta em camadas que chega de jaqueta — com elegância serena.");
        assertThat(DnaIdentityPhrase.legivel("Clásico de silueta fitted.")).isEqualTo("Clásico de silueta ajustada.");
        assertThat(DnaIdentityPhrase.legivel("Uma frase sem código.")).isEqualTo("Uma frase sem código.");
        assertThat(DnaIdentityPhrase.legivel(null)).isNull();
    }
}
