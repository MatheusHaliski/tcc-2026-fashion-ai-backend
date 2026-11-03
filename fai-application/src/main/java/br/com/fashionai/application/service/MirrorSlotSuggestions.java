package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.single;
import static br.com.fashionai.application.service.MirrorSlots.allIds;
import static br.com.fashionai.application.service.MirrorService.SLOTS;

/**
 * Alternativas para um slot (CA04 / CA12) pela IA validada ou pelo fallback local, e a escolha manual
 * do guarda-roupa (WARDROBE-FIX), sem IA.
 */
final class MirrorSlotSuggestions {
    private final MirrorStore store;
    private final MirrorStateView stateView;
    private final MirrorStateRepository mirrors;
    private final RoomService room;
    private final AiEngine ai;
    private final Audit audit;

    MirrorSlotSuggestions(MirrorStore store, MirrorStateView stateView, MirrorStateRepository mirrors, RoomService room, AiEngine ai,
                          Audit audit) {
        this.store = store;
        this.stateView = stateView;
        this.mirrors = mirrors;
        this.room = room;
        this.ai = ai;
        this.audit = audit;
    }

    // ================================================================== sugerir para um slot (CA04 / CA12)
    Map<String, Object> suggest(CurrentUser user, String slot) {
        if (!SLOTS.contains(slot)) {
            throw ApiException.badRequest("SLOT_INVALIDO", "Slots: " + SLOTS);
        }
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        List<UUID> inMirror = allIds(slots);
        Map<UUID, WardrobeItem> mirrorPieces = store.load(user.id(), inMirror);
        UUID current = slot.equals("accessory") ? null : single(slots, slot);
        List<WardrobeItem> context = mirrorPieces.values().stream().filter(w -> !w.getId().equals(current)).toList();
        List<WardrobeItem> candidates = store.eligible(user.id()).stream().filter(w -> slotOf(w).equals(slot))
                .filter(w -> !inMirror.contains(w.getId())).toList();
        if (candidates.isEmpty()) {
            throw new ApiException(422, "SEM_CANDIDATAS", Msg.t("mirror.voce_nao_tem_peca_disponivel"),
                    Map.of("href", "/pieces/new", "slot", slot));
        }
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : candidates) {
            String ref = "c" + i++;
            byRef.put(ref, w);
            catalog.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()),
                    "color", String.valueOf(w.getColor()), "style", Json.csv(w.getStyleTags()), "occasion", Json.csv(w.getOccasionTags())));
        }
        List<Map<String, Object>> ctx = context.stream().map(w -> Map.<String, Object>of("name", String.valueOf(w.getName()),
                "subcategory", String.valueOf(w.getSubcategory()), "color", String.valueOf(w.getColor()), "style", Json.csv(w.getStyleTags()))).toList();
        AiOutcome<List<Map<String, Object>>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.SCHEME_COMPOSER,
                "Você é o Smart Mirror do Fashion AI. Escolha até 3 alternativas para o slot pedido, SOMENTE entre as candidatas (refs c1, c2...), "
                        + "que combinem com as peças já no espelho. Responda SOMENTE com JSON {\"alternatives\":[{\"ref\":\"c1\",\"why\":\"1 frase\"}]}.",
                "Slot: " + slot + "\nNo espelho: " + Json.write(ctx) + "\nCandidatas: " + Json.write(catalog),
                List.of(), 500, List.of(Msg.t("mirror.pecas_ja_no_espelho_e")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    if (!(m.get("alternatives") instanceof List<?> list)) {
                        return null;
                    }
                    List<Map<String, Object>> out = new ArrayList<>();
                    Set<UUID> seen = new HashSet<>();
                    for (Object o : list) {
                        if (o instanceof Map<?, ?> alt && byRef.containsKey(String.valueOf(alt.get("ref")))) {
                            WardrobeItem w = byRef.get(String.valueOf(alt.get("ref")));
                            if (seen.add(w.getId())) {
                                out.add(Map.of("pieceId", w.getId(), "why", InputSanitizer.clean(alt.get("why") == null ? "" : String.valueOf(alt.get("why")), 160)));
                            }
                        } else if (o instanceof Map<?, ?> alt) {
                            audit.log(user, "VISTA_ME_ID_DESCARTADO", "mirror:" + user.id(), Map.of("ref", String.valueOf(alt.get("ref")), "slot", slot));
                        }
                        if (out.size() == 3) {
                            break;
                        }
                    }
                    return out.isEmpty() ? null : out;
                },
                () -> localAlternatives(candidates, context), null));
        List<Map<String, Object>> alternatives = outcome.value() == null ? localAlternatives(candidates, context) : outcome.value();
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> view = new ArrayList<>();
        for (Map<String, Object> alt : alternatives) {
            WardrobeItem w = candidates.stream().filter(c -> c.getId().equals(alt.get("pieceId"))).findFirst().orElse(null);
            if (w != null) {
                Map<String, Object> m = stateView.pieceView(w, where);
                m.put("why", alt.get("why"));
                view.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slot", slot);
        out.put("alternatives", view);
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        out.put("message", outcome.userMessage());
        return out;
    }

    // ================================================================== escolher do guarda-roupa (WARDROBE-FIX)
    /**
     * Todas as peças que podem ir para o slot, para a pessoa escolher à mão: sem IA e sem custo. As mesmas regras do
     * Vista-me valem aqui (só disponíveis, dentro da estação, permitidas pelo desafio ativo); as que já estão no espelho
     * vêm marcadas.
     */
    Map<String, Object> wardrobe(CurrentUser user, String slot) {
        if (!SLOTS.contains(slot)) {
            throw ApiException.badRequest("SLOT_INVALIDO", "Slots: " + SLOTS);
        }
        Set<UUID> inMirror = new HashSet<>(mirrors.findByUserId(user.id()).map(s -> allIds(store.slots(s))).orElse(List.of()));
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> pieces = new ArrayList<>();
        for (WardrobeItem w : store.eligible(user.id())) {
            if (slotOf(w).equals(slot)) {
                Map<String, Object> m = stateView.pieceView(w, where);
                m.put("inMirror", inMirror.contains(w.getId()));
                pieces.add(m);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slot", slot);
        out.put("pieces", pieces);
        if (pieces.isEmpty()) {
            out.put("message", Msg.t("mirror.voce_nao_tem_peca_disponivel"));
            out.put("href", "/pieces/new");
        }
        return out;
    }

    /** Fallback local (RNF8): similaridade ponderada com as peças do espelho + ocasião em comum + neutros. */
    static List<Map<String, Object>> localAlternatives(List<WardrobeItem> candidates, List<WardrobeItem> context) {
        List<Similarity.Signature> ctx = context.stream().map(Similarity::of).toList();
        Set<String> ctxOcc = context.stream().flatMap(w -> Json.csv(w.getOccasionTags()).stream()).collect(Collectors.toSet());
        return candidates.stream().map(c -> {
            Similarity.Signature sig = Similarity.of(c);
            double sim = ctx.isEmpty() ? 0.5 : ctx.stream().mapToDouble(x -> Similarity.weighted(sig, x)).average().orElse(0);
            boolean occ = ctxOcc.isEmpty() || Json.csv(c.getOccasionTags()).stream().anyMatch(ctxOcc::contains);
            double score = sim + (occ ? 0.3 : 0) + (br.com.fashionai.application.ai.local.ColorMath.isNeutral(c.getColor()) ? 0.1 : 0);
            String why = occ ? Msg.t("mirror.combina_com_a_ocasiao_das") : Msg.t("mirror.traz_contraste_com_o_que");
            return Map.<String, Object>of("pieceId", c.getId(), "why", why, "score", score);
        }).sorted((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score"))).limit(3).toList();
    }
}
