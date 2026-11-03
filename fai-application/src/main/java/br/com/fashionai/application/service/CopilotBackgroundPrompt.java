package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.CopilotService.BackgroundPrompt;
import br.com.fashionai.application.service.CopilotService.LookPrompt;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static br.com.fashionai.application.service.CopilotLookPrompt.lookPrompt;
import static br.com.fashionai.application.service.CopilotPieceVocabulary.COLOR_WORDS;
import static br.com.fashionai.application.service.CopilotText.mentions;
import static br.com.fashionai.application.service.CopilotText.normalized;
import static br.com.fashionai.application.service.CopilotText.startsWithWord;

/**
 * Arte de fundo pedida em texto livre (Background Studio): cor hexadecimal ou nomeada, preset e variação AURA,
 * material, gradiente e cartela sazonal; e a orientação livre do Criar Look, que junta o fundo ao prompt de look.
 */
final class CopilotBackgroundPrompt {
    private final BackgroundStudioService backgroundStudio;

    CopilotBackgroundPrompt(BackgroundStudioService backgroundStudio) {
        this.backgroundStudio = backgroundStudio;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> catalogEntries(Object entries) {
        if (!(entries instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(x -> (Map<String, Object>) x).toList();
    }

    static Map<String, Object> namedEntry(List<Map<String, Object>> entries, String text, String... fields) {
        for (Map<String, Object> entry : entries) {
            for (String field : fields) {
                Object value = entry.get(field);
                if (value instanceof String s && s.length() > 2 && mentions(text, s.replace('_', ' '))) return entry;
            }
        }
        return null;
    }

    /**
     * Orientação livre do Criar Look ("Gerar com IA"): o mesmo vocabulário do Copilot (CopilotLexicon, 800+ termos
     * PT/EN/ES de ocasião, estilo, humor, estação, clima, cores, tipos e materiais de peça, presets e variações AURA,
     * materiais de fundo, gradientes e cartela sazonal) lido sem exigir a palavra "fundo": o que a pessoa citar vira
     * arte de background, ocasião, estilo, estação e humor do look gerado.
     */
    public Map<String, Object> orientation(String text, List<String> styles, List<String> occasions) {
        if (text == null || text.isBlank()) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        BackgroundPrompt bg = backgroundPrompt(text, styles, occasions, false);
        if (bg.configuration() != null && bg.configuration().get("scheme") instanceof Map<?, ?> scheme && !scheme.isEmpty()) {
            out.put("background", scheme);
        }
        if (!bg.unresolved().isEmpty()) out.put("unresolved", bg.unresolved());
        LookPrompt look = lookPrompt(text, occasions, null);
        if (!look.occasions().isEmpty()) out.put("occasions", look.occasions());
        if (!look.styles().isEmpty()) out.put("styles", look.styles());
        if (look.season() != null) out.put("season", look.season());
        if (look.mood() != null) out.put("mood", look.mood());
        if (look.weather() != null) out.put("weather", look.weather());
        return out;
    }

    BackgroundPrompt backgroundPrompt(String message, List<String> styles, List<String> occasions, boolean requireCue) {
        String text = normalized(message);
        Map<String, Object> scheme = new LinkedHashMap<>();
        Map<String, String> unresolved = new LinkedHashMap<>();
        boolean backgroundRequested = !requireCue || List.of("fundo", "background", "arte de fundo", "aura", "material", "moldura", "arte do card", "fondo")
                .stream().anyMatch(term -> mentions(message, term));
        if (!backgroundRequested) return new BackgroundPrompt(null, Map.of());

        Matcher hex = Pattern.compile("#[0-9a-fA-F]{6}(?![0-9a-fA-F])").matcher(message);
        if (hex.find() && (mentions(message, "fundo") || mentions(message, "background") || mentions(message, "container"))) {
            String color = hex.group().toUpperCase(Locale.ROOT);
            if (mentions(message, "container")) scheme.put("container", Map.of("color", color));
            else scheme.put("color", color);
        } else if (mentions(message, "fundo") || mentions(message, "background")) {
            for (Map.Entry<String, Set<String>> term : COLOR_WORDS.entrySet()) {
                if (!startsWithWord(message, term.getKey())) continue;
                String colorId = term.getValue().stream().filter(Taxonomy.COLORS::containsKey).findFirst().orElse(null);
                if (colorId != null) {
                    scheme.put("color", Taxonomy.COLORS.get(colorId));
                    break;
                }
            }
        }

        Map<String, Object> catalog = backgroundStudio.catalog();
        List<Map<String, Object>> auraPresets = catalogEntries(catalog.get("auraPresets"));
        Map<String, Object> selectedAura = null;
        Map<String, Object> selectedVariant = null;
        for (Map<String, Object> preset : auraPresets) {
            if (mentions(message, String.valueOf(preset.get("name"))) || mentions(message, String.valueOf(preset.get("id")).replace('_', ' '))) {
                selectedAura = preset;
                break;
            }
            for (Map<String, Object> variant : catalogEntries(preset.get("variants"))) {
                if (mentions(message, String.valueOf(variant.get("theme"))) || mentions(message, String.valueOf(variant.get("code"))
                        .replace('_', ' ')) || mentions(message, String.valueOf(variant.get("id")).replace('_', ' '))) {
                    selectedAura = preset;
                    selectedVariant = variant;
                    break;
                }
            }
            if (selectedAura != null) break;
        }
        String gradientTerm = CopilotLexicon.first(CopilotLexicon.GRADIENTS, message);
        if (selectedAura == null && (gradientTerm == null || mentions(message, "aura"))) {
            // vocabulário: "fundo geométrico", "aura elétrica ciano", "fundo floral"… → preset (e variação, se citada)
            String presetId = CopilotLexicon.first(CopilotLexicon.AURA_PRESETS, message);
            if (presetId != null) {
                selectedAura = auraPresets.stream().filter(p -> presetId.equals(p.get("id"))).findFirst().orElse(null);
                String suffix = selectedAura == null ? null : CopilotLexicon.variantSuffix(presetId, message);
                if (suffix != null) {
                    String variantId = presetId + "__" + suffix;
                    selectedVariant = catalogEntries(selectedAura.get("variants")).stream().filter(v -> variantId.equals(v.get("id"))).findFirst().orElse(null);
                }
            }
        }
        boolean asksAura = mentions(message, "aura") || selectedAura != null;
        if (asksAura && selectedAura == null && (mentions(message, "geometry") || mentions(message, "geometria")
                || mentions(message, "electro") || mentions(message, "eletro"))) {
            unresolved.put("aura", Msg.t("backgroundStudio.preset_aura_desconhecido", "Aura solicitada"));
        } else if (asksAura && selectedAura == null) {
            Map<String, Object> direction = backgroundStudio.recommend(styles, occasions);
            Object recommendedAura = direction.get("aura");
            if (recommendedAura instanceof String id) {
                scheme.put("aura", Map.of("variantId", id));
                if (direction.get("skin") instanceof String skin) scheme.put("cardSkin", skin);
                if (direction.get("material") instanceof String material && mentions(message, "material")) scheme.put("materialId", material);
            } else {
                unresolved.put("aura", Msg.t("backgroundStudio.preset_aura_desconhecido", "Aura solicitada"));
            }
        }
        if (selectedAura != null) {
            if (selectedVariant == null) {
                List<Map<String, Object>> variants = catalogEntries(selectedAura.get("variants"));
                selectedVariant = variants.isEmpty() ? null : variants.get(0);
            }
            if (selectedVariant != null && selectedVariant.get("id") instanceof String id) {
                Map<String, Object> aura = new LinkedHashMap<>();
                aura.put("variantId", id);
                if (mentions(message, "gif") || mentions(message, "animado") || mentions(message, "dinamico")) aura.put("animated", true);
                scheme.put("aura", aura);
            }
        }

        List<Map<String, Object>> materials = catalogEntries(catalog.get("materials"));
        Map<String, Object> selectedMaterial = namedEntry(materials, message, "id", "name");
        if (selectedMaterial == null && CopilotLexicon.MATERIAL_CUES.stream().anyMatch(cue -> mentions(message, cue))) {
            String materialId = CopilotLexicon.first(CopilotLexicon.BACKGROUND_MATERIALS, message);
            selectedMaterial = materialId == null ? null : materials.stream().filter(m -> materialId.equals(m.get("id"))).findFirst().orElse(null);
        }
        if (selectedMaterial != null && selectedMaterial.get("id") instanceof String id) scheme.put("materialId", id);
        else if (mentions(message, "material")) {
            Map<String, Object> direction = backgroundStudio.recommend(styles, occasions);
            if (direction.get("material") instanceof String id) scheme.put("materialId", id);
            else unresolved.put("material", Msg.t("backgroundStudio.material_desconhecido", "material solicitado"));
        }

        List<Map<String, Object>> gradients = catalogEntries(catalog.get("gradients"));
        Map<String, Object> selectedGradient = namedEntry(gradients, message, "id", "name");
        if (selectedGradient == null && gradientTerm != null) {
            selectedGradient = gradients.stream().filter(g -> gradientTerm.equals(g.get("id"))).findFirst().orElse(null);
        }
        if (selectedGradient != null) {
            scheme.put("gradientPresetId", selectedGradient.get("id"));
            scheme.put("gradient", selectedGradient);
        }
        List<Map<String, Object>> seasonal = catalogEntries(catalog.get("seasonal"));
        Map<String, Object> selectedSeasonal = namedEntry(seasonal, message, "id", "name");
        if (selectedSeasonal == null && CopilotLexicon.SEASONAL_CUES.stream().anyMatch(cue -> mentions(message, cue))) {
            String seasonalId = CopilotLexicon.SEASONAL_PRESETS.get(lookPrompt(message, List.of(), null).season());
            selectedSeasonal = seasonalId == null ? null : seasonal.stream().filter(g -> seasonalId.equals(g.get("id"))).findFirst().orElse(null);
        }
        if (selectedSeasonal != null) {
            scheme.put("seasonalPresetId", selectedSeasonal.get("id"));
            scheme.put("gradient", selectedSeasonal);
        }
        if (scheme.get("aura") instanceof Map<?, ?> aura && scheme.containsKey("materialId")
                && (mentions(message, "gif") || mentions(message, "animado") || mentions(message, "dinamico"))) {
            ((Map<String, Object>) aura).put("format", "IMAGEM_UNICA");
        }
        if (scheme.isEmpty()) return new BackgroundPrompt(null, unresolved);
        Map<String, Object> configuration = new LinkedHashMap<>();
        configuration.put("scheme", scheme);
        configuration.put("pieces", Map.of("anatomy", "PECA_AMPLIADO"));
        return new BackgroundPrompt(configuration, unresolved);
    }
}
