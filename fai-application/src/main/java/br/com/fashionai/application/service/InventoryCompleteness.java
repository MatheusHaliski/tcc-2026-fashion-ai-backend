package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * RF34 §3.1 — completude da peça (também usada pelo RF4/RF35), com o antifraude §5 sobre a detecção da IA, e o texto
 * do que falta cadastrar. Regras puras do {@link InventoryScoreService}.
 */
final class InventoryCompleteness {
    private InventoryCompleteness() {
    }

    static int completeness(WardrobeItem w) {
        Map<String, Double> detected = detectedConfidence(w);
        Map<String, Object> det = detected(w);
        int total = 0;
        total += field("category", w.getCategory() != null, 15, det, detected, w.getCategory());
        total += field("color", w.getColor() != null, 15, det, detected, w.getColor());
        total += !Json.csv(w.getOccasionTags()).isEmpty() ? 15 : 0;
        total += !Json.csv(w.getStyleTags()).isEmpty() ? 15 : 0;
        total += w.getImageUrl() != null && !w.isDefaultImage() && w.getModerationStatus() == ModerationStatus.APPROVED ? 15 : 0;
        total += field("material", w.getMaterial() != null, 10, det, detected, w.getMaterial());
        total += field("brand", (w.getBrand() != null || (w.getBrandName() != null && !w.getBrandName().isBlank())), 10, det, detected,
                w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        total += w.getModel3dUrl() != null ? 5 : 0;
        return total;
    }

    /** Antifraude §5 — campo divergente da detecção da IA (RF4) com confiança alta conta 50%. */
    private static int field(String name, boolean filled, int weight, Map<String, Object> det, Map<String, Double> conf, String value) {
        if (!filled) {
            return 0;
        }
        Object detectedValue = det.get(name);
        Double c = conf.get(name);
        if (detectedValue != null && c != null && c >= 0.85 && value != null
                && !String.valueOf(detectedValue).equalsIgnoreCase(value)) {
            return weight / 2;
        }
        return weight;
    }

    static Map<String, Object> detected(WardrobeItem w) {
        Object d = Json.map(w.getFlatLayMetadataJson()).get("detected");
        return d instanceof Map<?, ?> m ? m.entrySet().stream().filter(e -> e.getValue() != null)
                .collect(Collectors.toMap(e -> String.valueOf(e.getKey()), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)) : Map.of();
    }

    static Map<String, Double> detectedConfidence(WardrobeItem w) {
        Object c = detected(w).get("confidence");
        Map<String, Double> out = new HashMap<>();
        if (c instanceof Map<?, ?> m) {
            m.forEach((k, v) -> {
                if (v instanceof Number n) {
                    out.put(String.valueOf(k), n.doubleValue());
                }
            });
        }
        return out;
    }

    /** Peça pronta para o catálogo (RF35 §5.2, "passa no catalog_readiness_score"): dados essenciais + imagem própria. */
    static boolean catalogReady(WardrobeItem w) {
        return completeness(w) >= 60 && w.getImageUrl() != null && !w.isDefaultImage();
    }

    static String missingFields(WardrobeItem w) {
        List<String> m = new ArrayList<>();
        if (w.getColor() == null) {
            m.add("cor");
        }
        if (Json.csv(w.getOccasionTags()).isEmpty()) {
            m.add(Msg.t("inventoryScore.ocasioes"));
        }
        if (Json.csv(w.getStyleTags()).isEmpty()) {
            m.add("estilos");
        }
        if (w.getImageUrl() == null || w.isDefaultImage()) {
            m.add(Msg.t("inventoryScore.foto_propria"));
        }
        if (w.getMaterial() == null) {
            m.add("material");
        }
        if (w.getBrand() == null && (w.getBrandName() == null || w.getBrandName().isBlank())) {
            m.add("marca");
        }
        return m.isEmpty() ? "completa" : "falta " + String.join(", ", m);
    }
}
