package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Caracterização (lote GoF 14) do contrato estático que {@link BackgroundStudioService} expõe a WardrobeService,
 * AuraCommerceService e MetamorphoseInventoryService: validação da arte do card (composição AURA, Hype, Metamorfose,
 * enquadramento, borda), escrita de motion só pelo servidor e revisão otimista do backgroundConfigJson/studioConfigJson.
 * Escrito e executado ANTES da extração para {@code StudioArtworkRules}; precisa continuar verde depois.
 */
class BackgroundStudioArtworkContractTest {

    private static Map<String, Object> preset(String id) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", id);
        p.put("name", "Curado");
        p.put("family", "ELECTRO");
        p.put("image", "/aura/fashion-curated/" + id + ".webp");
        p.put("palette", List.of("#112233", "#aabbcc"));
        return p;
    }

    private static String code(Runnable r) {
        ApiException e = catchThrowableOfType(r::run, ApiException.class);
        return e == null ? null : e.status() + ":" + e.code();
    }

    private static String artwork(Map<String, Object> cfg) {
        return code(() -> BackgroundStudioService.validateArtwork(cfg));
    }

    @Test
    void composicaoAuraValidaComESemVideo() {
        assertThat(artwork(Map.of("compositionPreset", preset("neon-01")))).isNull();
        Map<String, Object> video = preset("neon-01");
        video.put("video", "/aura/fashion-curated/neon-01.mp4");
        assertThat(artwork(Map.of("compositionPreset", video))).isNull();
        BackgroundStudioService.validateArtwork(null);
        BackgroundStudioService.validateArtwork(Map.of());
    }

    @Test
    void composicaoAuraRecusaCadaCampoForaDoContrato() {
        String bad = "400:AURA_COMPOSITION_INVALID";
        assertThat(artwork(Map.of("compositionPreset", "neon-01"))).isEqualTo(bad);
        Map<String, Object> p;
        p = preset("Neon_01"); p.put("image", "/aura/fashion-curated/Neon_01.webp");
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("name", "n".repeat(161));
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("name", "n".repeat(160));
        assertThat(artwork(Map.of("compositionPreset", p))).isNull();
        p = preset("x"); p.put("family", "OUTRA");
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        for (String fam : List.of("COMMON", "ELECTRO", "SPLASH", "HYPE", "METAMORPHOSE")) {
            p = preset("x"); p.put("family", fam);
            assertThat(artwork(Map.of("compositionPreset", p))).isNull();
        }
        p = preset("x"); p.put("image", "/aura/fashion-curated/y.webp");
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("video", "/aura/fashion-curated/y.mp4");
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("palette", List.of("#112233"));
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("palette", List.of("#112233", "#abc"));
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("palette", List.of("#112233", 7));
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
        p = preset("x"); p.put("id", "a".repeat(81));
        assertThat(artwork(Map.of("compositionPreset", p))).isEqualTo(bad);
    }

    @Test
    void hypeEMetamorfose() {
        assertThat(artwork(Map.of("auraHype", "OFF"))).isNull();
        for (String m : List.of("SCANNER", "XRAY", "DOTS", "STARS", "METRICS", "RARE_KEY_TRIAD", "PRISM_CHAMPAGNE"))
            assertThat(artwork(Map.of("auraHype", m))).isNull();
        assertThat(artwork(Map.of("auraHype", "RARE_KEY"))).isEqualTo("400:AURA_HYPE_INVALID");
        assertThat(artwork(Map.of("auraHype", 3))).isEqualTo("400:AURA_HYPE_INVALID");
        assertThat(BackgroundStudioService.validHypeMode(null)).isFalse();
        assertThat(BackgroundStudioService.validHypeMode("off")).isFalse();
        for (String m : List.of("OFF", "PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA"))
            assertThat(artwork(Map.of("auraMetamorphose", m))).isNull();
        assertThat(artwork(Map.of("auraMetamorphose", "NEON"))).isEqualTo("400:AURA_METAMORPHOSE_INVALID");
        assertThat(artwork(Map.of("auraMetamorphose", "PRISMA", "auraMetamorphosePreset", "NIKE_ORANGE"))).isNull();
        assertThat(artwork(Map.of("auraMetamorphose", "FIO_VIVO", "auraMetamorphosePreset", "ADIDAS_BLUE"))).isNull();
        assertThat(artwork(Map.of("auraMetamorphose", "HOLOGRAFIA", "auraMetamorphosePreset", "ASICS_WHITE"))).isNull();
        assertThat(artwork(Map.of("auraMetamorphose", "PRISMA", "auraMetamorphosePreset", "ADIDAS_BLUE"))).isEqualTo("400:AURA_METAMORPHOSE_INVALID");
        assertThat(artwork(Map.of("auraMetamorphosePreset", "NIKE_ORANGE"))).isEqualTo("400:AURA_METAMORPHOSE_INVALID");
        assertThat(artwork(Map.of("auraMetamorphose", "PRISMA", "auraMetamorphosePreset", 1))).isEqualTo("400:AURA_METAMORPHOSE_INVALID");
    }

    @Test
    void enquadramentoEBorda() {
        assertThat(artwork(Map.of("photoFraming", "FABRIC"))).isNull();
        assertThat(artwork(Map.of("photoFraming", "WHOLE"))).isNull();
        assertThat(artwork(Map.of("photoFraming", "fabric"))).isEqualTo("400:PHOTO_FRAMING_INVALID");
        assertThat(artwork(Map.of("border", Map.of()))).isNull();
        assertThat(artwork(Map.of("border", Map.of("mode", "GRADIENT", "effect", "HOLO", "from", "#000000", "to", "#FFFFFF")))).isNull();
        assertThat(artwork(Map.of("border", "red"))).isEqualTo("400:CARD_BORDER_INVALID");
        assertThat(artwork(Map.of("border", Map.of("mode", "IMAGE")))).isEqualTo("400:CARD_BORDER_INVALID");
        assertThat(artwork(Map.of("border", Map.of("effect", "BLINK")))).isEqualTo("400:CARD_BORDER_INVALID");
        assertThat(artwork(Map.of("border", Map.of("color", "red")))).isEqualTo("400:CARD_BORDER_INVALID");
        assertThat(artwork(Map.of("border", Map.of("to", "#12345")))).isEqualTo("400:CARD_BORDER_INVALID");
    }

    @Test
    void ordemDasValidacoesDecideOPrimeiroErro() {
        Map<String, Object> all = new HashMap<>();
        all.put("compositionPreset", "x");
        all.put("auraHype", "x");
        all.put("auraMetamorphose", "x");
        all.put("photoFraming", "x");
        all.put("border", "x");
        String[] expected = {"AURA_COMPOSITION_INVALID", "AURA_HYPE_INVALID", "AURA_METAMORPHOSE_INVALID",
                "PHOTO_FRAMING_INVALID", "CARD_BORDER_INVALID"};
        for (String key : List.of("compositionPreset", "auraHype", "auraMetamorphose", "photoFraming", "border")) {
            int i = List.of("compositionPreset", "auraHype", "auraMetamorphose", "photoFraming", "border").indexOf(key);
            assertThat(artwork(all)).isEqualTo("400:" + expected[i]);
            all.remove(key);
        }
        assertThat(artwork(all)).isNull();
    }

    @Test
    void motionSoPeloServidor() {
        Map<String, Object> data = Map.of("status", "READY", "url", "/m.mp4");
        BackgroundStudioService.validateMotionWrite(null, "texto");
        BackgroundStudioService.validateMotionWrite(null, Map.of("color", "#ffffff"));
        BackgroundStudioService.validateMotionWrite("{\"impersonationData\":{\"status\":\"READY\",\"url\":\"/m.mp4\"}}",
                Map.of("impersonationData", data));
        assertThat(code(() -> BackgroundStudioService.validateMotionWrite(null, Map.of("impersonationData", data))))
                .isEqualTo("400:AURA_MOTION_SERVER_ONLY");
        assertThat(code(() -> BackgroundStudioService.validateMotionWrite("{\"impersonationData\":{\"status\":\"PENDING\"}}",
                Map.of("impersonationData", data)))).isEqualTo("400:AURA_MOTION_SERVER_ONLY");
    }

    @Test
    @SuppressWarnings("unchecked")
    void revisaoPreservaOrdemDasChavesEValidaAntes() {
        Map<String, Object> in = new LinkedHashMap<>();
        in.put("v", 2);
        in.put("baseRev", 3);
        in.put("skin", "atelier");
        Map<String, Object> out = (Map<String, Object>) BackgroundStudioService.withRevision("{\"rev\":3,\"old\":true}", in);
        assertThat(out.keySet()).containsExactly("v", "skin", "rev");
        assertThat(out).containsEntry("rev", 4).doesNotContainKey("old");
        assertThat(((Map<String, Object>) BackgroundStudioService.withRevision("  ", Map.of("a", 1)))).containsEntry("rev", 1);
        assertThat(((Map<String, Object>) BackgroundStudioService.withRevision("{\"rev\":\"x\"}", Map.of("baseRev", 0)))).containsEntry("rev", 1);
        assertThat(code(() -> BackgroundStudioService.withRevision("{\"rev\":2}", Map.of("baseRev", 1)))).isEqualTo("409:ARTE_ALTERADA");
        assertThat(code(() -> BackgroundStudioService.withRevision("{\"rev\":2}", Map.of("baseRev", 1, "border", "x"))))
                .isEqualTo("400:CARD_BORDER_INVALID");
        assertThat(code(() -> BackgroundStudioService.withRevision(null, Map.of("impersonationData", "x", "border", "x"))))
                .isEqualTo("400:AURA_MOTION_SERVER_ONLY");
        assertThat(BackgroundStudioService.withRevision("{\"rev\":9}", List.of(1))).isEqualTo(List.of(1));
        assertThatThrownBy(() -> BackgroundStudioService.withRevision("{\"rev\":9}", Map.of("baseRev", 8)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void enquadramentosPublicados() {
        assertThat(BackgroundStudioService.PHOTO_FRAMINGS).containsExactlyInAnyOrder("FABRIC", "WHOLE");
    }
}
