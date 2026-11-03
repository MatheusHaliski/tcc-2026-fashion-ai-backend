package br.com.fashionai.application.service;

import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.repository.StyleDnaRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.service.InventoryScoreRules.cosine;
import static br.com.fashionai.application.service.InventoryScoreRules.distribution;
import static br.com.fashionai.application.service.InventoryScoreRules.family;
import static br.com.fashionai.application.service.InventoryScoreRules.pct;
import static br.com.fashionai.application.service.InventoryScoreRubric.NAMES;
import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;

/** RF34 §3.7 — dimensão Identidade (I), só quando há DNA de estilo sintetizado. */
final class InventoryIdentityDimension {
    private InventoryIdentityDimension() {
    }

    /** I — identidade: correspondência com a Camada 1 do DNA de estilo (nunca a Identidade de Vida, RNF6). */
    static void identity(InventoryScoreSheet sheet, StyleDnaRepository dnas) {
        UUID userId = sheet.userId;
        List<WardrobeItem> a = sheet.a;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        Optional<StyleDna> dna = dnas.findByUserId(userId);
        Integer iVal = null;
        List<Map<String, Object>> iDown = new ArrayList<>();
        if (dna.isPresent() && dna.get().getSynthesizedAt() != null) {
            Map<String, Double> invColors = distribution(a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).toList());
            Map<String, Double> dnaColors = distribution(Json.csv(dna.get().getColorPalette()).stream().map(InventoryScoreService::family).filter(Objects::nonNull).toList());
            Map<String, Double> invStyles = distribution(a.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList());
            Map<String, Double> dnaStyles = distribution(Json.csv(dna.get().getStyleKeywords()).stream().map(s -> s.toLowerCase().trim()).toList());
            double cc = cosine(invColors, dnaColors);
            double cs = cosine(invStyles, dnaStyles);
            iVal = (int) Math.round(100 * (0.5 * cc + 0.5 * cs));
            dims.put("I", iVal);
            a.stream().filter(w -> family(w.getColor()) != null && !dnaColors.containsKey(family(w.getColor()))).limit(3)
                    .forEach(w -> iDown.add(Map.of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", Msg.t("inventoryScore.cor_fora_da_paleta_do"), "hint", Msg.t("inventoryScore.informativo_nao_e_defeito"))));
            explain.add(new Dimension("I", NAMES.get("I"), iVal, WEIGHTS.get("I"), Msg.t("inventoryScore.correspondencia_entre_o_inventario", pct(cc), pct(cs)), iDown));
        } else {
            explain.add(new Dimension("I", NAMES.get("I"), null, WEIGHTS.get("I"), Msg.t("inventoryScore.sem_dna_de_estilo_gerado"), List.of()));
        }
    }
}
