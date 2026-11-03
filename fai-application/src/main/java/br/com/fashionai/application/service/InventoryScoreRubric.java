package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** RF34 §2 — rubrica do Inventory Score: peso e nome de cada dimensão e as categorias que formam combinação. */
final class InventoryScoreRubric {
    static final Map<String, Double> WEIGHTS = new LinkedHashMap<>();
    static final Map<String, String> NAMES = new LinkedHashMap<>();
    static final Set<String> COMBO_CATEGORIES = Set.of("upper_piece", "lower_piece", "shoes_piece", "full_body_piece");

    static {
        WEIGHTS.put("C", 0.20);
        WEIGHTS.put("U", 0.20);
        WEIGHTS.put("V", 0.15);
        WEIGHTS.put("R", 0.13);
        WEIGHTS.put("D", 0.12);
        WEIGHTS.put("O", 0.10);
        WEIGHTS.put("I", 0.10);
        NAMES.put("C", Msg.k("common.catalogacao"));
        NAMES.put("U", Msg.k("common.utilizacao"));
        NAMES.put("V", "Versatilidade");
        NAMES.put("R", "Descoberta");
        NAMES.put("D", "Diversidade");
        NAMES.put("O", Msg.k("common.organizacao"));
        NAMES.put("I", "Identidade");
    }

    private InventoryScoreRubric() {
    }
}
