package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/** Unidade extraída no lote GoF 14: regras puras da arte do card, sem Spring nem mocks. */
class StudioArtworkRulesTest {

    private static String code(Runnable r) {
        ApiException e = catchThrowableOfType(r::run, ApiException.class);
        return e == null ? null : e.status() + ":" + e.code();
    }

    @Test
    void servicoDelegaParaAMesmaRegraEPublicaOMesmoConjunto() {
        assertThat(BackgroundStudioService.PHOTO_FRAMINGS).isSameAs(StudioArtworkRules.PHOTO_FRAMINGS);
        for (Object mode : List.of("OFF", "COLLAB_DROP_MOMENTUM", "HOLO_ROSE", "HOLO_RED", "rare_key_triad", 1))
            assertThat(BackgroundStudioService.validHypeMode(mode)).isEqualTo(StudioArtworkRules.validHypeMode(mode));
    }

    @Test
    void trintaEDoisModosHypeDeAcabamentoELayout() {
        int ok = 0;
        for (String finish : List.of("COMMON", "RARE", "LEGENDARY", "COLLAB_DROP"))
            for (String layout : List.of("STATIC_HORIZONTAL", "STATIC_VERTICAL", "STATIC_COLUMNS", "STATIC_GLOBAL",
                    "RANKED_BARS", "EXTREMES", "MOMENTUM", "KEY_TRIAD"))
                if (StudioArtworkRules.validHypeMode(finish + "_" + layout)) ok++;
        assertThat(ok).isEqualTo(32);
        assertThat(StudioArtworkRules.validHypeMode("EPIC_MOMENTUM")).isFalse();
        assertThat(StudioArtworkRules.validHypeMode("RARE_MOMENTUM ")).isFalse();
    }

    @Test
    void composicaoComPaletaNulaOuIdVazioEhRecusada() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", "");
        p.put("name", "x");
        p.put("family", "HYPE");
        p.put("image", "/aura/fashion-curated/.webp");
        p.put("palette", List.of("#000000", "#ffffff"));
        assertThat(code(() -> StudioArtworkRules.validateArtwork(Map.of("compositionPreset", p))))
                .isEqualTo("400:AURA_COMPOSITION_INVALID");
        p.put("id", "ok");
        p.put("image", "/aura/fashion-curated/ok.webp");
        java.util.ArrayList<Object> palette = new java.util.ArrayList<>();
        palette.add("#000000");
        palette.add(null);
        p.put("palette", palette);
        assertThat(code(() -> StudioArtworkRules.validateArtwork(Map.of("compositionPreset", p))))
                .isEqualTo("400:AURA_COMPOSITION_INVALID");
        p.put("palette", List.of("#000000", "#FFFFFF"));
        assertThat(code(() -> StudioArtworkRules.validateArtwork(Map.of("compositionPreset", p)))).isNull();
    }

    @Test
    void bordaValidaCadaCorNaOrdemColorFromTo() {
        assertThat(code(() -> StudioArtworkRules.validateArtwork(Map.of("border",
                Map.of("mode", "COLOR", "effect", "GLOW", "color", "#a1b2c3"))))).isNull();
        assertThat(code(() -> StudioArtworkRules.validateArtwork(Map.of("border", Map.of("from", 123)))))
                .isEqualTo("400:CARD_BORDER_INVALID");
    }

    @Test
    @SuppressWarnings("unchecked")
    void revisaoIncrementaEConflitaComBaseAntiga() {
        Map<String, Object> first = (Map<String, Object>) StudioArtworkRules.withRevision(null, Map.of("skin", "atelier"));
        assertThat(first).containsEntry("rev", 1);
        Map<String, Object> second = (Map<String, Object>) StudioArtworkRules.withRevision("{\"rev\":1}", Map.of("baseRev", 1));
        assertThat(second).containsExactly(Map.entry("rev", 2));
        assertThat(code(() -> StudioArtworkRules.withRevision("{\"rev\":2}", Map.of("baseRev", 1.0))))
                .isEqualTo("409:ARTE_ALTERADA");
        assertThat(StudioArtworkRules.withRevision("{}", null)).isNull();
    }

    @Test
    void motionDoServidorPodeSerMantidoOuRemovido() {
        StudioArtworkRules.validateMotionWrite("{\"impersonationData\":{\"status\":\"READY\"}}", Map.of("color", "#ffffff"));
        StudioArtworkRules.validateMotionWrite("{\"impersonationData\":{\"status\":\"READY\"}}",
                Map.of("impersonationData", Map.of("status", "READY")));
        assertThat(code(() -> StudioArtworkRules.validateMotionWrite("{}", Map.of("impersonationData", Map.of()))))
                .isEqualTo("400:AURA_MOTION_SERVER_ONLY");
    }
}
