package br.com.fashionai.application.ai.local;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class LocalLookWordingTest {
    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void tituloUsaONomeDoEstiloEDaOcasiaoNoIdiomaDeQuemPediu() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(LocalLookWording.title(List.of("basic"), List.of("date"), null)).isEqualTo("Look Básico para encontro");
        assertThat(LocalLookWording.spoken(List.of("date", "social"))).isEqualTo("encontro/social");
        assertThat(LocalLookWording.spoken(List.of("basic", "romantic"))).isEqualTo("básico/romântico");
    }

    @Test
    void emEspanholOsNomesAcompanham() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("es"));
        assertThat(LocalLookWording.spoken(List.of("date", "work"))).isEqualTo("cita/trabajo");
    }
}
