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
    void cadaLookExplicaComAsSuasPecasMesmoComOcasiaoEEstiloIguais() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        var um = List.of(peca("Camiseta Vermelha"), peca("Jeans Hype Médio"), peca("Tênis branco"));
        var outro = List.of(peca("Camisa Hype Baixo"), peca("Calça azul"), peca("Tênis azul"));
        String a = LocalLookWording.rationale(um, List.of("casual"), List.of("basic"));
        String b = LocalLookWording.rationale(outro, List.of("casual"), List.of("basic"));
        assertThat(a).startsWith("Camiseta Vermelha + Jeans Hype Médio + Tênis branco: ocasião casual e estilo básico");
        assertThat(b).isNotEqualTo(a).startsWith("Camisa Hype Baixo + Calça azul + Tênis azul:");
    }

    private static br.com.fashionai.domain.model.WardrobeItem peca(String nome) {
        var w = new br.com.fashionai.domain.model.WardrobeItem();
        w.setName(nome);
        return w;
    }

    @Test
    void emEspanholOsNomesAcompanham() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("es"));
        assertThat(LocalLookWording.spoken(List.of("date", "work"))).isEqualTo("cita/trabajo");
    }
}
