package br.com.fashionai.application.service;

import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Contexto enviado à IA na composição de looks (RF5/RF19): atributos visuais das peças e resumo do DNA de estilo. */
final class CompositionContext {
    private CompositionContext() {
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
}
