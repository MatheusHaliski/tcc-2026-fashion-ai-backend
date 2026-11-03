package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorService.Interpretation;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.key;
import static br.com.fashionai.application.service.MirrorSlotSuggestions.localAlternatives;

/**
 * Vista-me — composição do look com âncoras obrigatórias e sem repetir as combinações já mostradas: IA
 * validada contra o acervo elegível (CA09) ou regras locais.
 */
final class MirrorComposer {
    private final AiEngine ai;
    private final Audit audit;

    MirrorComposer(AiEngine ai, Audit audit) {
        this.ai = ai;
        this.audit = audit;
    }

    /** Composição com âncoras obrigatórias e sem repetir as já mostradas — IA validada ou regras locais. */
    Optional<List<WardrobeItem>> compose(CurrentUser user, Interpretation it, List<WardrobeItem> eligible, Set<String> shown,
                                         List<WardrobeItem> mirrorContext, AiOutcome<?>[] holder) {
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            byRef.put(ref, w);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("name", w.getName());
            m.put("slot", slotOf(w));
            m.put("subcategory", w.getSubcategory());
            m.put("color", w.getColor());
            m.put("style", Json.csv(w.getStyleTags()));
            m.put("occasion", Json.csv(w.getOccasionTags()));
            m.put("anchor", it.anchors().contains(w.getId()));
            catalog.add(m);
        }
        Set<UUID> eligibleIds = byRef.values().stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        java.util.function.Supplier<List<WardrobeItem>> local = () -> localCompose(it, eligible, shown);
        AiOutcome<List<WardrobeItem>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.SCHEME_COMPOSER,
                "Você é o Vista-me do Smart Mirror do Fashion AI. Monte UM look completo usando SOMENTE as peças do acervo (refs). "
                        + "Obrigatório: (upper + lower) ou dress, e shoes; até 1 outer_layer e até 2 accessory. Toda peça marcada anchor=true DEVE "
                        + "entrar. Nunca invente peças. Responda SOMENTE com JSON {\"refs\":[...],\"title\":string,\"rationale\":\"até 2 frases\"}.",
                Msg.t("mirror.pedido_interpretado_acervo_elegivel", Json.write(Map.of("occasion", it.occasion(), "mood", String.valueOf(it.mood()), "constraints", it.constraints(),
                        "season", String.valueOf(it.season()))), Json.write(catalog), (mirrorContext.isEmpty() ? "" : "\nJá no espelho (prefira manter): " + mirrorContext.stream().map(WardrobeItem::getName).toList()), (shown.isEmpty() ? "" : "\nNÃO repita estas combinações (ids ordenados): " + shown)),
                List.of(), 700, List.of("acervo elegível (metadados, sem fotos)", "pedido interpretado", Msg.t("mirror.combinacoes_ja_mostradas_na_sessao")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (!(m.get("refs") instanceof List<?> refs)) {
                        return null;
                    }
                    List<WardrobeItem> chosen = new ArrayList<>();
                    for (Object r : refs) {
                        WardrobeItem w = byRef.get(String.valueOf(r));
                        if (w == null || !eligibleIds.contains(w.getId())) {
                            // RF33.CA09 — id fora do conjunto elegível: descarta a sugestão inteira e registra
                            audit.log(user, "VISTA_ME_SUGESTAO_DESCARTADA", "mirror:" + user.id(), Map.of("ref", String.valueOf(r), "motivo", "id fora do conjunto elegível"));
                            return null;
                        }
                        if (!chosen.contains(w)) {
                            chosen.add(w);
                        }
                    }
                    if (!chosen.stream().map(WardrobeItem::getId).collect(Collectors.toSet()).containsAll(it.anchors())) {
                        audit.log(user, "VISTA_ME_SUGESTAO_DESCARTADA", "mirror:" + user.id(), Map.of("motivo", "âncora ausente"));
                        return null;
                    }
                    if (chosen.size() < 2 || shown.contains(key(chosen.stream().map(WardrobeItem::getId).toList()))) {
                        return null;
                    }
                    return chosen;
                }, local, null));
        holder[0] = outcome;
        List<WardrobeItem> look = outcome.value() == null ? local.get() : outcome.value();
        return look == null || look.isEmpty() ? Optional.empty() : Optional.of(look);
    }

    static List<WardrobeItem> localCompose(Interpretation it, List<WardrobeItem> eligible, Set<String> shown) {
        Set<UUID> anchors = new HashSet<>(it.anchors());
        List<LocalSchemeComposer.Composition> comps = LocalSchemeComposer.compose(eligible, it.occasion(), List.of(), it.season(),
                String.join(" ", it.constraints()), 24);
        Map<UUID, WardrobeItem> byId = eligible.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        for (LocalSchemeComposer.Composition c : comps) {
            List<UUID> ids = c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList();
            if (ids.containsAll(anchors) && !shown.contains(key(ids))) {
                return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
            }
        }
        // monta na mão: âncoras + melhor candidata por slot faltante (similaridade com as âncoras + ocasião)
        List<WardrobeItem> look = new ArrayList<>(anchors.stream().map(byId::get).filter(Objects::nonNull).toList());
        Set<String> filled = look.stream().map(MirrorService::slotOf).collect(Collectors.toSet());
        List<String> need = new ArrayList<>();
        if (!filled.contains("dress")) {
            if (!filled.contains("upper")) {
                need.add("upper");
            }
            if (!filled.contains("lower")) {
                need.add("lower");
            }
        }
        if (!filled.contains("shoes")) {
            need.add("shoes");
        }
        for (String slot : need) {
            List<WardrobeItem> cands = eligible.stream().filter(w -> slotOf(w).equals(slot)).filter(w -> !look.contains(w)).toList();
            if (slot.equals("upper") && cands.isEmpty()) {
                cands = eligible.stream().filter(w -> slotOf(w).equals("dress")).toList();
            }
            List<Map<String, Object>> ranked = localAlternatives(cands, look);
            for (Map<String, Object> r : ranked) {
                WardrobeItem w = byId.get((UUID) r.get("pieceId"));
                if (w != null && !shown.contains(key(concat(look, w)))) {
                    look.add(w);
                    break;
                }
            }
            if (look.stream().noneMatch(w -> slotOf(w).equals(slot)) && !ranked.isEmpty()) {
                look.add(byId.get((UUID) ranked.get(0).get("pieceId")));
            }
        }
        return look.size() >= 2 ? look : List.of();
    }

    private static List<UUID> concat(List<WardrobeItem> look, WardrobeItem w) {
        List<UUID> ids = look.stream().map(WardrobeItem::getId).collect(Collectors.toCollection(ArrayList::new));
        ids.add(w.getId());
        return ids;
    }
}
