package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.MannequinGeometry;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regras puras de valor das preferências (sem Spring, repositório, storage ou relógio). Dados sintéticos. */
class PreferenceValueRulesTest {

    private static void rejects(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(400);
            assertThat(e.code()).isEqualTo(code);
        });
    }

    @Test
    void conflitoSoIgnoraOEstritamenteAnterior() {
        Instant t = Instant.parse("2026-01-01T00:00:00Z");
        assertThat(PreferenceValueRules.isStale(t.minusMillis(1), t)).isTrue();
        assertThat(PreferenceValueRules.isStale(t, t)).isFalse();
        assertThat(PreferenceValueRules.isStale(t.plusSeconds(1), t)).isFalse();
        assertThat(PreferenceValueRules.isStale(null, t)).isFalse();
        assertThat(PreferenceValueRules.isStale(t, null)).isFalse();
    }

    @Test
    void valoresZeraveisVoltamAoPadrao() {
        assertThat(PreferenceValueRules.currency(" ")).isNull();
        assertThat(PreferenceValueRules.currency("Auto")).isNull();
        assertThat(PreferenceValueRules.currency("usd")).isEqualTo("USD");
        assertThat(PreferenceValueRules.coreAesthetic("")).isNull();
        assertThat(PreferenceValueRules.coreAesthetic("y2k")).isEqualTo("Y2K");
        assertThat(PreferenceValueRules.containerColor("  ")).isNull();
        assertThat(PreferenceValueRules.containerColor("#0a0B0c")).isEqualTo("#0A0B0C");
        assertThat(PreferenceValueRules.country(" ")).isNull();
        assertThat(PreferenceValueRules.country("de")).isEqualTo("DE");
        assertThat(PreferenceValueRules.CORES).hasSize(8).contains("OLD_MONEY", "COTTAGECORE");
        assertThat(PreferencesService.CORES).isSameAs(PreferenceValueRules.CORES);
    }

    @Test
    void foraDoPermitidoUsaOCodigoDeSempre() {
        rejects(() -> PreferenceValueRules.currency("GBP"), "MOEDA_INVALIDA");
        rejects(() -> PreferenceValueRules.fontScale(79), "FONTE_INVALIDA");
        rejects(() -> PreferenceValueRules.fontScale(161), "FONTE_INVALIDA");
        assertThat(PreferenceValueRules.fontScale(80)).isEqualTo(80);
        assertThat(PreferenceValueRules.fontScale(160)).isEqualTo(160);
        rejects(() -> PreferenceValueRules.coreAesthetic("emo"), "CORE_INVALIDO");
        rejects(() -> PreferenceValueRules.containerColor("#12345"), "COR_INVALIDA");
        rejects(() -> PreferenceValueRules.skinTone("azul"), "TOM_INVALIDO");
        String tone = MannequinGeometry.SKIN_TONES.keySet().iterator().next();
        assertThat(PreferenceValueRules.skinTone(tone)).isEqualTo(tone);
        rejects(() -> PreferenceValueRules.country("B1"), "PAIS_INVALIDO");
    }

    @Test
    void ordemDoMenuPreservaOrdemERecusaFormatos() {
        Map<String, Object> raw = new HashMap<>();
        raw.put("groups", List.of("nav.group.play", "nav.group.wardrobe"));
        assertThat(PreferenceValueRules.navOrder(raw)).containsExactly(
                Map.entry("groups", List.of("nav.group.play", "nav.group.wardrobe")), Map.entry("items", Map.of()));
        rejects(() -> PreferenceValueRules.navOrder(Map.of("groups", "nav.group.play")), "ORDEM_DO_MENU_INVALIDA");
        rejects(() -> PreferenceValueRules.navOrder(Map.of("items", Map.of("nav.group.play", List.of("/Closet")))), "ORDEM_DO_MENU_INVALIDA");
        rejects(() -> PreferenceValueRules.navOrder(Map.of("items", Map.of("nav.group.play", List.of("/a", "/a")))), "ORDEM_DO_MENU_INVALIDA");
    }

    @Test
    void linksERosto() {
        assertThat(PreferenceValueRules.links(List.of(Map.of("url", "https://example.com", "title", " Loja ")))).containsExactly(
                Map.of("title", "Loja", "url", "https://example.com"));
        rejects(() -> PreferenceValueRules.links(List.of(Map.of("url", "https://a"))), "LINK_INVALIDO");
        assertThat(PreferenceValueRules.links(List.of(Map.of(), Map.of(), Map.of(), Map.of(), Map.of()))).isEmpty();
        assertThat(PreferenceValueRules.mannequinFace(Map.of())).containsExactly(
                Map.entry("offsetX", 0.0), Map.entry("offsetY", 0.0), Map.entry("scale", 1.0));
        assertThat(PreferenceValueRules.mannequinFace(Map.of("offsetY", -0.9, "scale", 0.1))).containsExactly(
                Map.entry("offsetX", 0.0), Map.entry("offsetY", -0.3), Map.entry("scale", 0.6));
    }
}
