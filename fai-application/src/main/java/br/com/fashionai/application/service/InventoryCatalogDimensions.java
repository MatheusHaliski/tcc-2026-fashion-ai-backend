package br.com.fashionai.application.service;

import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.InventoryCompleteness.completeness;
import static br.com.fashionai.application.service.InventoryCompleteness.missingFields;
import static br.com.fashionai.application.service.InventoryScoreRules.comboKeyOf;
import static br.com.fashionai.application.service.InventoryScoreRules.entropy;
import static br.com.fashionai.application.service.InventoryScoreRules.family;
import static br.com.fashionai.application.service.InventoryScoreRules.pct;
import static br.com.fashionai.application.service.InventoryScoreRubric.COMBO_CATEGORIES;
import static br.com.fashionai.application.service.InventoryScoreRubric.NAMES;
import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;
import static br.com.fashionai.application.service.InventoryScoreService.combos;

/** RF34 §3.1/§3.4 — dimensões do acervo em si: Catalogação (C), Diversidade (D) e Versatilidade (V). */
final class InventoryCatalogDimensions {
    private InventoryCatalogDimensions() {
    }

    /** C — catalogação: média da completude das peças. */
    static void catalog(InventoryScoreSheet sheet) {
        List<WardrobeItem> all = sheet.all;
        int n = sheet.n;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        Map<UUID, Integer> compl = new HashMap<>();
        all.forEach(w -> compl.put(w.getId(), completeness(w)));
        int cVal = n == 0 ? 0 : (int) Math.round(compl.values().stream().mapToInt(Integer::intValue).average().orElse(0));
        dims.put("C", cVal);
        explain.add(new Dimension("C", NAMES.get("C"), cVal, WEIGHTS.get("C"), Msg.t("inventoryScore.media_da_completude_das_pecas", cVal),
                all.stream().sorted(Comparator.comparingInt(w -> compl.get(w.getId()))).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()), "value", compl.get(w.getId()) + "%",
                                "hint", missingFields(w))).toList()));
    }

    /** D — diversidade: entropias de categoria, cor e estilo e cobertura de ocasiões. */
    static void diversity(InventoryScoreSheet sheet) {
        List<WardrobeItem> a = sheet.a;
        List<Scheme> allSchemes = sheet.allSchemes;
        Map<UUID, List<UUID>> schemePieces = sheet.schemePieces;
        Map<UUID, WardrobeItem> byId = sheet.byId;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        double hCat = entropy(a.stream().map(WardrobeItem::getCategory).filter(Objects::nonNull).toList(), Taxonomy.SUBCATEGORIES.size());
        Set<String> familyValues = new HashSet<>(Taxonomy.COLOR_FAMILY.values());
        double hCol = entropy(a.stream().map(w -> family(w.getColor())).filter(Objects::nonNull).toList(), familyValues.size());
        double hSty = entropy(a.stream().flatMap(w -> Json.csv(w.getStyleTags()).stream()).toList(), Taxonomy.STYLES.size());
        Set<String> discoveredKeys = allSchemes.stream().map(s -> comboKeyOf(schemePieces.getOrDefault(s.getId(), List.of()), byId))
                .filter(Objects::nonNull).collect(Collectors.toSet());
        InventoryComboCounter.Combos combos = combos(a, 12, discoveredKeys);
        double cob = combos.coverage().values().stream().mapToDouble(b -> b ? 1 : 0).sum() / InventoryComboCounter.OCCASION_GROUPS.size();
        int dVal = (int) Math.round(100 * (0.25 * hCat + 0.25 * hCol + 0.25 * hSty + 0.25 * cob));
        dims.put("D", dVal);
        String weakestAttr = hCat <= hCol && hCat <= hSty ? "categorias" : hCol <= hSty ? Msg.t("inventoryScore.familias_de_cor") : "estilos";
        List<String> uncovered = combos.coverage().entrySet().stream().filter(e -> !e.getValue()).map(Map.Entry::getKey).toList();
        explain.add(new Dimension("D", NAMES.get("D"), dVal, WEIGHTS.get("D"), Msg.t("inventoryScore.variedade_util_das_pecas_disponiveis", pct(hCat), pct(hCol), pct(hSty), pct(cob)), List.of(Map.of("name", Msg.t("inventoryScore.atributo_menos_variado"), "value", weakestAttr, "hint", Msg.t("inventoryScore.cadastre_estilos_cores_diferentes")),
                Map.of("name", Msg.t("inventoryScore.ocasioes_sem_combinacao_completa"), "value", uncovered.isEmpty() ? "nenhuma" : String.join(", ", uncovered),
                        "hint", Msg.t("inventoryScore.falta_peca_superior_inferior_ou")))));
        sheet.discoveredKeys = discoveredKeys;
        sheet.combos = combos;
    }

    /** V — versatilidade: peças conectadas e concentração das aparições nos looks. */
    static void versatility(InventoryScoreSheet sheet) {
        List<WardrobeItem> a = sheet.a;
        InventoryComboCounter.Combos combos = sheet.combos;
        List<List<UUID>> windowLooks = sheet.windowLooks;
        Map<String, Integer> dims = sheet.dims;
        List<Dimension> explain = sheet.explain;
        List<WardrobeItem> comboEligible = a.stream().filter(w -> COMBO_CATEGORIES.contains(w.getCategory())).toList();
        long connected = comboEligible.stream().filter(w -> combos.perPiece().getOrDefault(w.getId(), 0) >= 3).count();
        double conect = comboEligible.isEmpty() ? 0 : (double) connected / comboEligible.size();
        Map<UUID, Long> appearances = windowLooks.stream().flatMap(List::stream).collect(Collectors.groupingBy(id -> id, Collectors.counting()));
        long totalApp = appearances.values().stream().mapToLong(Long::longValue).sum();
        long top3 = appearances.values().stream().sorted(Comparator.reverseOrder()).limit(3).mapToLong(Long::longValue).sum();
        double conc = totalApp == 0 ? 1 : (double) top3 / totalApp; // sem looks: (1 − Conc) = 0
        int vVal = (int) Math.round(100 * (0.6 * conect + 0.4 * (1 - conc)));
        dims.put("V", vVal);
        explain.add(new Dimension("V", NAMES.get("V"), vVal, WEIGHTS.get("V"), Msg.t("inventoryScore.das_pecas_superiores_inferiores_calcados", (pct(conect)), (totalApp == 0 ? Msg.t("inventoryScore.sem_looks_na_janela_o") :
                Msg.t("inventoryScore.das_aparicoes_nos_looks_dos", (pct(conc))))),
                comboEligible.stream().sorted(Comparator.comparingInt(w -> combos.perPiece().getOrDefault(w.getId(), 0))).limit(5)
                        .map(w -> Map.<String, Object>of("pieceId", w.getId(), "name", String.valueOf(w.getName()),
                                "value", Msg.t("inventoryScore.combinacoes", (combos.perPiece().getOrDefault(w.getId(), 0))), "hint", InventoryComboCounter.occ(w).isEmpty()
                                        ? Msg.t("inventoryScore.sem_ocasiao_cadastrada_nao_forma") : Msg.t("inventoryScore.precisa_de_pecas_com_ocasiao"))).toList()));
        sheet.appearances = appearances;
    }
}
