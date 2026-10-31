package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regras puras da arte do card (RF11 / AURA) aplicadas ao {@code backgroundConfigJson} da peça e ao
 * {@code studioConfigJson} do esquema: composição AURA curada, modos Hype, Metamorfose, enquadramento da foto, borda,
 * motion emitido só pelo servidor e revisão otimista. Sem Spring, repositório ou storage: o
 * {@link BackgroundStudioService} continua dono de transação, autorização e persistência e apenas delega para cá.
 * Ordem das checagens é contrato (decide qual erro 400 o editor recebe primeiro).
 */
final class StudioArtworkRules {
    /** Enquadramento da foto da peça no card: recorte de tecido (padrão) ou Total frame (a peça inteira no quadro). */
    static final Set<String> PHOTO_FRAMINGS = Set.of("FABRIC", "WHOLE");

    private static final List<String> HYPE_FIXED_MODES = List.of("OFF", "SCANNER", "XRAY", "DOTS", "STARS", "METRICS");
    private static final String HYPE_FINISH_LAYOUT = "(COMMON|RARE|LEGENDARY|COLLAB_DROP)_(STATIC_HORIZONTAL|STATIC_VERTICAL"
            + "|STATIC_COLUMNS|STATIC_GLOBAL|RANKED_BARS|EXTREMES|MOMENTUM|KEY_TRIAD)";
    private static final String HYPE_TECH_PALETTE = "(SCAN|CONTOUR|MESH|HOLO|FIBER|PRISM|PARTICLES|SPOTLIGHT)"
            + "_(GRAPHITE|CHROME|ROSE|VIOLET|CHAMPAGNE)";
    private static final List<String> COMPOSITION_FAMILIES = List.of("COMMON", "ELECTRO", "SPLASH", "HYPE", "METAMORPHOSE");
    private static final List<String> METAMORPHOSE_MODES = List.of("OFF", "PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA");
    private static final List<String> BORDER_MODES = List.of("AUTO", "COLOR", "GRADIENT");
    private static final List<String> BORDER_EFFECTS = List.of("AUTO", "NONE", "GLOW", "SHIMMER", "HOLO");
    private static final String HEX6 = "#[0-9a-fA-F]{6}";

    private StudioArtworkRules() {
    }

    /** Structured border paint only: arbitrary CSS and unknown visual modes are not accepted. */
    static boolean validHypeMode(Object value) {
        if (!(value instanceof String mode)) return false;
        if (HYPE_FIXED_MODES.contains(mode)) return true;
        return mode.matches(HYPE_FINISH_LAYOUT) || mode.matches(HYPE_TECH_PALETTE);
    }

    static void validateArtwork(Map<?, ?> config) {
        if (config == null) return;
        Object composition = config.get("compositionPreset");
        if (composition != null && !validComposition(composition))
            throw ApiException.badRequest("AURA_COMPOSITION_INVALID", "Composição AURA inválida.");
        Object hype = config.get("auraHype");
        if (hype != null && !validHypeMode(hype))
            throw ApiException.badRequest("AURA_HYPE_INVALID", Msg.t("auraHype.invalid"));
        validateMetamorphose(config.get("auraMetamorphose"), config.get("auraMetamorphosePreset"));
        // enquadramento da foto no card: FABRIC (recorte de tecido, o de sempre) ou WHOLE (Total frame: a peça inteira)
        Object framing = config.get("photoFraming");
        if (framing != null && !PHOTO_FRAMINGS.contains(framing))
            throw ApiException.badRequest("PHOTO_FRAMING_INVALID", Msg.t("backgroundStudio.enquadramento_invalido"));
        validateBorder(config.get("border"));
    }

    private static boolean validComposition(Object composition) {
        return composition instanceof Map<?, ?> preset
                && preset.get("id") instanceof String id && id.matches("[a-z0-9-]{1,80}")
                && preset.get("name") instanceof String name && name.length() <= 160
                && COMPOSITION_FAMILIES.contains(preset.get("family"))
                && ("/aura/fashion-curated/" + id + ".webp").equals(preset.get("image"))
                && (preset.get("video") == null || ("/aura/fashion-curated/" + id + ".mp4").equals(preset.get("video")))
                && preset.get("palette") instanceof List<?> palette && palette.size() == 2
                && palette.stream().allMatch(c -> c instanceof String hex && hex.matches(HEX6));
    }

    private static void validateMetamorphose(Object metamorphose, Object metamorphosePreset) {
        if (metamorphose != null && !METAMORPHOSE_MODES.contains(metamorphose))
            throw ApiException.badRequest("AURA_METAMORPHOSE_INVALID", "AURA Metamorfose inválida.");
        if (metamorphosePreset == null) return;
        String requiredMode = switch (metamorphosePreset instanceof String id ? id : "") {
            case "NIKE_ORANGE" -> "PRISMA";
            case "ADIDAS_BLUE" -> "FIO_VIVO";
            case "ASICS_WHITE" -> "HOLOGRAFIA";
            default -> null;
        };
        if (requiredMode == null || !requiredMode.equals(metamorphose))
            throw ApiException.badRequest("AURA_METAMORPHOSE_INVALID", "AURA Metamorfose inválida.");
    }

    private static void validateBorder(Object value) {
        if (value == null) return;
        if (!(value instanceof Map<?, ?> border)) throw ApiException.badRequest("CARD_BORDER_INVALID", "Borda inválida.");
        if (border.get("mode") != null && !BORDER_MODES.contains(border.get("mode")))
            throw ApiException.badRequest("CARD_BORDER_INVALID", "Modo de borda inválido.");
        if (border.get("effect") != null && !BORDER_EFFECTS.contains(border.get("effect")))
            throw ApiException.badRequest("CARD_BORDER_INVALID", "Efeito de borda inválido.");
        for (String key : List.of("color", "from", "to")) {
            Object color = border.get(key);
            if (color != null && (!(color instanceof String hex) || !hex.matches(HEX6)))
                throw ApiException.badRequest("CARD_BORDER_INVALID", "Cor da borda inválida.");
        }
    }

    /** Clients may retain/remove server-issued motion, never forge or replace it. */
    static void validateMotionWrite(String currentJson, Object cfg) {
        if (!(cfg instanceof Map<?, ?> incoming) || incoming.get("impersonationData") == null) return;
        Object existing = Json.map(currentJson).get("impersonationData");
        if (existing == null || !existing.equals(incoming.get("impersonationData")))
            throw ApiException.badRequest("AURA_MOTION_SERVER_ONLY", Msg.t("auraMotion.notReady"));
    }

    /**
     * Arte do card da peça (RF11 v2): cada gravação ganha uma revisão ({@code rev}). Quando o editor manda a revisão que
     * leu ({@code baseRev}) e ela não é mais a atual (outra aba ou outro aparelho aplicou antes), a gravação é recusada
     * com 409 em vez de sobrescrever em silêncio. Sem {@code baseRev} (clientes antigos, criação da peça) grava como antes.
     */
    static Object withRevision(String currentJson, Object cfg) {
        validateMotionWrite(currentJson, cfg);
        if (!(cfg instanceof Map<?, ?> in)) return cfg;
        validateArtwork(in);
        Map<String, Object> current = currentJson == null || currentJson.isBlank() ? Map.of() : Json.map(currentJson);
        int rev = current.get("rev") instanceof Number n ? n.intValue() : 0;
        Map<String, Object> out = new LinkedHashMap<>();
        in.forEach((k, v) -> out.put(String.valueOf(k), v));
        Object base = out.remove("baseRev");
        if (base instanceof Number b && b.intValue() != rev) {
            throw ApiException.conflict("ARTE_ALTERADA", Msg.t("backgroundStudio.arte_alterada_em_outra_janela"));
        }
        out.put("rev", rev + 1);
        return out;
    }
}
