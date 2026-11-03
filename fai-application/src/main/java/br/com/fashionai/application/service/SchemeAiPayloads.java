package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.SchemeService.ComposeRequest;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Etapa 2 (RF5.CA04) — o que vai para a IA além do acervo (atributos visuais da peça e resumo do DNA de estilo) e a
 * leitura da resposta: só peças do acervo, uma de cada tipo, sem repetir combinações, tags da taxonomia.
 */
final class SchemeAiPayloads {
    private SchemeAiPayloads() {
    }

    /** Atributos visuais detectados no RF4 (Piece Analyzer / flat lay): padrão, estampa, textura, cores, caimento. */
    static Map<String, Object> pieceAnalysis(WardrobeItem w) {
        Map<String, Object> src = Json.map(w.getFlatLayMetadataJson());
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("pattern", "print", "texture", "fit", "colors", "dominantColors", "secondaryColors",
                "neckline", "sleeve", "length", "finish", "silhouette", "season", "attributes")) {
            Object v = src.get(key);
            if (v != null && !(v instanceof Map<?, ?>)) {
                out.put(key, v instanceof String str ? InputSanitizer.clean(str, 120) : v);
            }
        }
        return out.isEmpty() ? null : out;
    }

    /** Resumo do DNA de estilo (RF19) que orienta cores, silhueta e arquétipo na composição. */
    static Map<String, Object> dnaContext(StyleDna d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("archetype", d.getArchetype() == null ? null : d.getArchetype().name());
        m.put("boldnessIndex", d.getBoldnessIndex());
        m.put("identityPhrase", d.getIdentityPhrase());
        m.put("colorPalette", d.getColorPalette());
        m.put("colorSeason", d.getColorSeason());
        m.put("styleKeywords", d.getStyleKeywords());
        m.put("silhouette", d.getSilhouette());
        m.put("iconPiece", d.getIconPieceName());
        return m;
    }

    static List<LocalSchemeComposer.Composition> parseCompositions(String text, Map<String, WardrobeItem> byRef, ComposeRequest req,
                                                                   Set<String> exclude) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("compositions") instanceof List<?> list)) {
            return null;
        }
        List<LocalSchemeComposer.Composition> out = new ArrayList<>();
        Set<String> seen = new HashSet<>(exclude);
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> c) || !(c.get("refs") instanceof List<?> refs)) {
                continue;
            }
            // a IA às vezes repete o tipo (duas blusas); o look fica com a primeira de cada tipo
            List<WardrobeItem> chosen = LocalSchemeComposer.onePerType(
                    refs.stream().map(String::valueOf).map(byRef::get).filter(Objects::nonNull).distinct().toList());
            if (chosen.size() < 2) {
                continue;
            }
            String key = SchemeService.combinationKey(chosen.stream().map(WardrobeItem::getId).toList());
            if (!seen.add(key)) {
                continue;
            }
            LocalSchemeComposer.Composition base = LocalSchemeComposer.toComposition(chosen,
                    strs(c.get("occasion"), Taxonomy.OCCASIONS, 3, req.occasion()), strs(c.get("style"), Taxonomy.STYLES, 3, req.style()),
                    req.season(), 0);
            String title = c.get("title") == null ? base.title() : InputSanitizer.clean(String.valueOf(c.get("title")), 120);
            String mood = c.get("mood") != null && Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED")
                    .contains(String.valueOf(c.get("mood"))) ? String.valueOf(c.get("mood")) : base.mood();
            String rationale = c.get("rationale") == null ? base.rationale() : InputSanitizer.clean(String.valueOf(c.get("rationale")), 300);
            // selos só vêm de vínculo com marca/celebridade (RF25), nunca de rótulo genérico da composição
            out.add(new LocalSchemeComposer.Composition(title, base.items(), base.occasions(), base.styles(), req.season(), mood,
                    List.of(), base.totalPrice(), 1, rationale));
            if (out.size() == 3) {
                break;
            }
        }
        return out.isEmpty() ? null : out;
    }

    private static List<String> strs(Object o, List<String> allowed, int max, List<String> fallback) {
        List<String> out = new ArrayList<>();
        if (o instanceof List<?> l) {
            l.stream().map(String::valueOf).filter(allowed::contains).distinct().limit(max).forEach(out::add);
        }
        return out.isEmpty() && fallback != null ? fallback.stream().limit(max).toList() : out;
    }
}
