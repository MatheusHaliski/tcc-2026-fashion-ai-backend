package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.accessories;
import static br.com.fashionai.application.service.MirrorSlots.single;
import static br.com.fashionai.application.service.MirrorSlots.rack;
import static br.com.fashionai.application.service.MirrorSlots.allIds;
import static br.com.fashionai.application.service.MirrorSlots.complete;

/**
 * "Tira uma coisa" (DET-M01): escolhe pela IA ou pela regra local o acessório ou a camada de fora a tirar.
 */
final class MirrorTakeOneOff {
    private final MirrorStore store;
    private final MirrorStateView view;
    private final MirrorAssembly assembly;
    private final RoomService room;
    private final AiEngine ai;
    private final ApplicationEventPublisher events;

    MirrorTakeOneOff(MirrorStore store, MirrorStateView view, MirrorAssembly assembly, RoomService room, AiEngine ai,
                     ApplicationEventPublisher events) {
        this.store = store;
        this.view = view;
        this.assembly = assembly;
        this.room = room;
        this.ai = ai;
        this.events = events;
    }

    // ================================================================== "Tira uma coisa" (DET-M01)
    Map<String, Object> takeOneOff(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        if (!complete(slots)) {
            throw new ApiException(409, "LOOK_INCOMPLETO", Msg.t("mirror.complete_o_look_superior_inferior"));
        }
        List<UUID> wantRack = rack(slots);
        List<UUID> toLoad = new ArrayList<>(allIds(slots));
        wantRack.stream().filter(id -> !toLoad.contains(id)).forEach(toLoad::add);
        Map<UUID, WardrobeItem> loaded = store.load(user.id(), toLoad);
        List<WardrobeItem> removable = new ArrayList<>();
        accessories(slots).stream().map(loaded::get).filter(Objects::nonNull).forEach(removable::add);
        UUID outer = single(slots, "outer_layer");
        if (outer != null && loaded.containsKey(outer)) {
            removable.add(loaded.get(outer));
        }
        if (removable.isEmpty()) {
            throw new ApiException(409, "NADA_A_TIRAR", Msg.t("mirror.esse_look_nao_tem_acessorio"));
        }
        List<WardrobeItem> look = allIds(slots).stream().map(loaded::get).filter(Objects::nonNull).toList();
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> cands = new ArrayList<>();
        int i = 1;
        for (WardrobeItem w : removable) {
            String ref = "r" + i++;
            byRef.put(ref, w);
            cands.add(Map.of("ref", ref, "name", String.valueOf(w.getName()), "subcategory", String.valueOf(w.getSubcategory()), "color", String.valueOf(w.getColor())));
        }
        AiOutcome<Map<String, Object>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.STYLE_ADVISOR,
                "Regra de Coco Chanel: antes de sair, tire uma coisa. Entre as peças removíveis (refs), escolha UMA para tirar e diga por quê em 1 frase "
                        + "curta (ex.: 'o colar compete com a estampa'). Responda SOMENTE com JSON {\"remove_ref\":\"r1\",\"why\":\"...\"}.",
                "Look: " + look.stream().map(w -> w.getName() + " (" + w.getSubcategory() + ", " + w.getColor() + ")").toList() + "\nRemovíveis: " + Json.write(cands),
                List.of(), 200, List.of(Msg.t("mirror.pecas_do_look_no_espelho")),
                text -> {
                    Map<String, Object> m = WardrobeService.extractJson(text);
                    WardrobeItem w = byRef.get(String.valueOf(m.get("remove_ref")));
                    return w == null ? null : Map.of("pieceId", w.getId(), "why", InputSanitizer.clean((m.get("why") == null ? "" : String.valueOf(m.get("why"))), 160));
                },
                () -> localTakeOneOff(removable, look), null));
        Map<String, Object> pick = outcome.value() == null ? localTakeOneOff(removable, look) : outcome.value();
        UUID removeId = (UUID) pick.get("pieceId");
        WardrobeItem removed = loaded.get(removeId);
        Map<String, Object> state = assembly.remove(user, removeId);
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "TIRA_UMA_COISA"));
        Map<String, Object> out = new LinkedHashMap<>(state);
        out.put("removed", view.pieceView(removed, room.locateAll(user.id())));
        out.put("why", pick.get("why"));
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("explanation", outcome.explanation());
        return out;
    }

    static Map<String, Object> localTakeOneOff(List<WardrobeItem> removable, List<WardrobeItem> look) {
        Map<String, Long> families = look.stream().map(w -> Taxonomy.COLOR_FAMILY.getOrDefault(w.getColor(), "Especiais"))
                .collect(Collectors.groupingBy(f -> f, Collectors.counting()));
        WardrobeItem pick = removable.stream().filter(w -> "print".equals(w.getColor()) || "multicolor".equals(w.getColor())).findFirst()
                .orElseGet(() -> removable.stream().min((a, b) -> Long.compare(families.getOrDefault(Taxonomy.COLOR_FAMILY.get(a.getColor()), 0L),
                        families.getOrDefault(Taxonomy.COLOR_FAMILY.get(b.getColor()), 0L))).orElse(removable.get(removable.size() - 1)));
        String why = "print".equals(pick.getColor()) || "multicolor".equals(pick.getColor()) ? Msg.t("mirror.a_estampa_compete_com_o")
                : Msg.t("mirror.e_a_cor_que_menos");
        return Map.of("pieceId", pick.getId(), "why", why);
    }
}
