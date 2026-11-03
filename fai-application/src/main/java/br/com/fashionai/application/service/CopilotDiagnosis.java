package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Diagnóstico do guarda-roupa (§3.3 / CA14): reuso antes de compra e sugestões genéricas que somam combinações. */
final class CopilotDiagnosis extends CopilotTools {
    CopilotDiagnosis(CopilotContext ctx) {
        super(ctx);
    }

    /** §3.3 / CA14 — diagnóstico: reuso antes de compra, Δcombinações visível, genérico, patrocínio separado, opt-out. */
    Map<String, Object> diagnosis(CurrentUser user) {
        List<WardrobeItem> a = wardrobe.eligible(user.id());
        long uppers = a.stream().filter(w -> "upper_piece".equals(w.getCategory())).count();
        long lowers = a.stream().filter(w -> "lower_piece".equals(w.getCategory())).count();
        long shoes = a.stream().filter(w -> "shoes_piece".equals(w.getCategory())).count();
        List<String> findings = new ArrayList<>();
        findings.add(Msg.t("copilot.partes_de_cima_para_partes", (uppers), lowers, shoes));
        Map<UUID, Long> freq = new HashMap<>();
        long totalApp = 0;
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED)) {
            for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(s.getId())) {
                freq.merge(si.getWardrobeItem().getId(), 1L, Long::sum);
                totalApp++;
            }
        }
        if (totalApp > 0) {
            long top3 = freq.values().stream().sorted(Comparator.reverseOrder()).limit(3).mapToLong(Long::longValue).sum();
            findings.add(Msg.t("copilot.das_aparicoes_nos_seus_looks", (Math.round(100.0 * top3 / totalApp))));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        // 1) reuso primeiro
        Map<String, Object> reuse = new CopilotClosetAnswers(ctx).forgotten(user);
        Map<String, Object> album = inventory.album(user);
        List<Map<String, Object>> reuseSuggestions = new ArrayList<>();
        reuseSuggestions.add(Map.of("type", "FORGOTTEN", "text", reuse.get("text"), "chips", reuse.getOrDefault("chips", List.of())));
        reuseSuggestions.add(Map.of("type", "UNSEEN_COMBOS", "text", album.get("message"), "undiscovered", album.getOrDefault("undiscovered", List.of())));
        out.put("findings", findings);
        out.put("reuse", reuseSuggestions);
        // 2) sugestão de compra só depois, com Δcombinações > 0, genérica e com opt-out
        boolean enabled = preferences.findByUserId(user.id()).map(UserPreferences::isPurchaseSuggestionsEnabled).orElse(true);
        List<Map<String, Object>> purchases = enabled ? purchaseSuggestions(a) : new ArrayList<>();
        out.put("purchaseSuggestions", enabled ? purchases.stream().limit(3).toList() : List.of());
        out.put("purchaseSuggestionsEnabled", enabled);
        out.put("purchaseRules", List.of(Msg.t("copilot.reuso_antes_de_compra"), Msg.t("copilot.combinacoes_visivel"), Msg.t("copilot.sem_marca_ou_produto"), Msg.t("copilot.patrocinio_so_em_bloco_separado"), Msg.t("copilot.opt_out_em_preferencias")));
        out.put("sponsored", Map.of("label", "Patrocinado", "items", List.of(), "note", Msg.t("copilot.conteudo_de_marca_nunca_entra")));
        out.put("text", String.join(" ", findings) + (purchases.isEmpty() || !enabled ? "" : Msg.t("copilot.depois_de_reaproveitar_o_que", purchases.get(0).get("subcategory"), purchases.get(0).get("color"), purchases.get(0).get("gainText"))));
        out.put("tools", List.of("buscar_pecas", "historico_uso", "ler_inventory_score"));
        return out;
    }

    /**
     * Sugestões de compra GENÉRICAS (subcategoria + cor, nunca marca ou produto) que aumentam as combinações válidas do
     * acervo disponível ({@code InventoryScoreService.combos}), em ordem de ganho. Só aparecem DEPOIS do reuso (quem chama
     * mostra antes as peças esquecidas e as combinações não descobertas) e respeitam o opt-out das preferências.
     */
    public static List<Map<String, Object>> purchaseSuggestions(List<WardrobeItem> a) {
        List<Map<String, Object>> purchases = new ArrayList<>();
        long base = InventoryScoreService.combos(a, 0, null).total();
        WeatherService.Context none = WeatherService.Context.none("");
        for (LocalAdvisors.PieceSuggestion g : LocalAdvisors.wardrobeGaps(a, none.temperatureC())) {
            String cat = Taxonomy.categoryOf(g.subcategory());
            Set<String> occ = new LinkedHashSet<>();
            a.stream().flatMap(w -> Json.csv(w.getOccasionTags()).stream()).collect(Collectors.groupingBy(o -> o, Collectors.counting()))
                    .entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(2).forEach(e -> occ.add(e.getKey()));
            WardrobeItem hyp = new WardrobeItem();
            hyp.setCategory(cat);
            hyp.setSubcategory(g.subcategory());
            hyp.setColor(g.color());
            hyp.setOccasionTags(String.join(",", occ));
            hyp.setDisponivel(true);
            hyp.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
            List<WardrobeItem> plus = new ArrayList<>(a);
            plus.add(hyp);
            long gain = InventoryScoreService.combos(plus, 0, null).total() - base;
            if (gain > 0) {
                purchases.add(Map.of("category", String.valueOf(cat), "subcategory", g.subcategory(), "color", g.color(), "occasions", occ,
                        "gain", gain, "gainText", Msg.t("copilot.combinacoes_possiveis", gain), "reason", g.reason(), "external", true,
                        "action", Map.of("type", "ADD_PIECE", "label", Msg.t("copilot.cadastrar_se_voce_ja_tiver"), "href", "/pieces/new")));
            }
        }
        purchases.sort(Comparator.comparingLong((Map<String, Object> m) -> (Long) m.get("gain")).reversed());
        return purchases;
    }
}
