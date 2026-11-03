package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.TipoLookRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.MirrorSlots.slotOf;
import static br.com.fashionai.application.service.MirrorSlots.accessories;
import static br.com.fashionai.application.service.MirrorSlots.single;
import static br.com.fashionai.application.service.MirrorSlots.rack;
import static br.com.fashionai.application.service.MirrorSlots.putRack;
import static br.com.fashionai.application.service.MirrorSlots.addToRack;
import static br.com.fashionai.application.service.MirrorSlots.available;
import static br.com.fashionai.application.service.MirrorService.MAX_ACCESSORIES;

/**
 * Montagem manual no espelho (CA01/CA02/CA05): tipo de look, vestir por slot, lista do espelho
 * (QUARTO-ESPELHO), tirar e limpar.
 */
final class MirrorAssembly {
    private final MirrorStore store;
    private final MirrorStateView view;
    private final MirrorStateRepository mirrors;
    private final WardrobeService wardrobe;
    private final RoomService room;
    private final ApplicationEventPublisher events;
    private final TipoLookRepository tiposLook;

    MirrorAssembly(MirrorStore store, MirrorStateView view, MirrorStateRepository mirrors, WardrobeService wardrobe,
                   RoomService room, ApplicationEventPublisher events, TipoLookRepository tiposLook) {
        this.store = store;
        this.view = view;
        this.mirrors = mirrors;
        this.wardrobe = wardrobe;
        this.room = room;
        this.events = events;
        this.tiposLook = tiposLook;
    }

    Map<String, Object> updateTipoLook(CurrentUser user, UUID tipoLookId) {
        if (tipoLookId == null) throw ApiException.badRequest("TIPO_LOOK_INVALIDO", Msg.t("mirror.tipo_look_invalido"));
        var tipo = tiposLook.findById(tipoLookId).orElseThrow(() -> ApiException.badRequest("TIPO_LOOK_INVALIDO", Msg.t("mirror.tipo_look_invalido")));
        MirrorState state = store.stateEntity(user.id());
        state.setTipoLook(tipo);
        mirrors.save(state);
        return view.render(user, state, store.slots(state), Map.of());
    }

    // ================================================================== montagem manual (CA01/CA02/CA05)
    Map<String, Object> place(CurrentUser user, UUID pieceId) {
        if (pieceId == null) {   // corpo sem pieceId: 400 com a mensagem, não erro interno ao buscar id nulo
            throw ApiException.badRequest("PECA_OBRIGATORIA", Msg.t("mirror.escolha_uma_peca"));
        }
        WardrobeItem w = wardrobe.owned(user, pieceId);
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        String slot = slotOf(w);
        Map<UUID, RoomService.Location> where = room.locateAll(user.id());
        List<Map<String, Object>> returned = new ArrayList<>();
        if (slot.equals("accessory")) {
            List<String> acc = accessories(slots).stream().map(UUID::toString).collect(Collectors.toCollection(ArrayList::new));
            if (!acc.contains(pieceId.toString())) {
                if (acc.size() >= MAX_ACCESSORIES) {
                    UUID old = UUID.fromString(acc.remove(0));
                    store.load(user.id(), List.of(old)).values().forEach(o -> returned.add(view.pieceView(o, where)));
                }
                acc.add(pieceId.toString());
            }
            slots.put("accessory", acc);
        } else {
            UUID previous = single(slots, slot);
            if (previous != null && !previous.equals(pieceId)) {
                store.load(user.id(), List.of(previous)).values().forEach(o -> returned.add(view.pieceView(o, where)));
            }
            slots.put(slot, pieceId.toString());
            if (slot.equals("dress")) {
                for (String k : List.of("upper", "lower")) {
                    UUID prev = single(slots, k);
                    if (prev != null) {
                        store.load(user.id(), List.of(prev)).values().forEach(o -> returned.add(view.pieceView(o, where)));
                        slots.remove(k);
                    }
                }
            } else if (slot.equals("upper") || slot.equals("lower")) {
                UUID prev = single(slots, "dress");
                if (prev != null) {
                    store.load(user.id(), List.of(prev)).values().forEach(o -> returned.add(view.pieceView(o, where)));
                    slots.remove("dress");
                }
            }
        }
        addToRack(slots, pieceId);   // vestida também fica na lista do espelho (para trocar e voltar a ela)
        if ("vista_me".equals(slots.get("origin"))) {
            slots.put("origin", "smart_mirror");
        } else {
            slots.putIfAbsent("origin", "manual");
        }
        slots.put("updatedAt", Instant.now().toString());
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        events.publishEvent(new DomainEvents.MirrorAction(user.id(), "PLACE"));
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("placed", view.pieceView(w, where));
        extra.put("returned", returned);
        if (!available(w)) {
            extra.put("notice", Msg.t("mirror.esta_no_cesto_indisponivel_pode", w.getName()));
        }
        return view.render(user, s, slots, extra);
    }

    // ================================================================== lista do espelho (QUARTO-ESPELHO)
    /** Leva a peça ao espelho: entra na lista para provar (sem vestir). Repetir o pedido não duplica. */
    Map<String, Object> bring(CurrentUser user, UUID pieceId) {
        if (pieceId == null) {
            throw ApiException.badRequest("PECA_OBRIGATORIA", Msg.t("mirror.escolha_uma_peca"));
        }
        WardrobeItem w = wardrobe.owned(user, pieceId);
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        boolean added = addToRack(slots, w.getId());
        if (added) {
            slots.put("updatedAt", Instant.now().toString());
            s.setSlotsJson(Json.write(slots));
            mirrors.save(s);
            events.publishEvent(new DomainEvents.MirrorAction(user.id(), "BRING"));
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("brought", w.getId());
        extra.put("added", added);
        return view.render(user, s, slots, extra);
    }

    /** Tira a peça da lista do espelho (e do corpo, se estava vestida). A peça continua no guarda-roupa. */
    Map<String, Object> unbring(CurrentUser user, UUID pieceId) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        List<UUID> rack = rack(slots);
        rack.remove(pieceId);
        putRack(slots, rack);
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            if (pieceId.equals(single(slots, slot))) {
                slots.remove(slot);
            }
        }
        slots.put("accessory", accessories(slots).stream().filter(id -> !id.equals(pieceId)).map(UUID::toString).toList());
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return view.render(user, s, slots, Map.of("unbrought", pieceId));
    }

    Map<String, Object> remove(CurrentUser user, UUID pieceId) {
        MirrorState s = store.stateEntity(user.id());
        Map<String, Object> slots = store.slots(s);
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer")) {
            if (pieceId.equals(single(slots, slot))) {
                slots.remove(slot);
            }
        }
        List<String> acc = accessories(slots).stream().filter(id -> !id.equals(pieceId)).map(UUID::toString).toList();
        slots.put("accessory", acc);
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return view.render(user, s, slots, Map.of());
    }

    Map<String, Object> clear(CurrentUser user) {
        MirrorState s = store.stateEntity(user.id());
        // limpar tira tudo do corpo; a lista do espelho fica (tirar da lista é pedido a pedido)
        Map<String, Object> slots = new LinkedHashMap<>();
        putRack(slots, rack(store.slots(s)));
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return view.render(user, s, slots, Map.of());
    }
}
