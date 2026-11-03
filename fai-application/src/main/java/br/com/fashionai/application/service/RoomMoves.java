package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.RoomPlacement.Occupancy;
import br.com.fashionai.application.service.RoomService.Location;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.RoomService.coherent;
import static br.com.fashionai.application.service.RoomService.drawerCapacity;
import static br.com.fashionai.application.service.RoomModules.capacity;
import static br.com.fashionai.application.service.RoomModules.labelSources;
import static br.com.fashionai.application.service.RoomModules.labels;
import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.saveLabels;
import static br.com.fashionai.application.service.RoomPlacement.place;

/** Meu Quarto — ações da pessoa (CA03/CA04/CA09): mover peça, renomear gaveta, "Mostrar no quarto" e maleiro de estação (Loft). */
final class RoomMoves {
    private final WardrobeItemRepository pieces;
    private final RoomStorageEntryRepository storage;
    private final RoomLayoutRepository layouts;
    private final Guard guard;
    private final ApplicationEventPublisher events;
    private final RoomFurniture furniture;
    private final RoomAddressing addressing;

    RoomMoves(RoomContext ctx) {
        this.pieces = ctx.pieces;
        this.storage = ctx.storage;
        this.layouts = ctx.layouts;
        this.guard = ctx.guard;
        this.events = ctx.events;
        this.furniture = ctx.furniture;
        this.addressing = ctx.addressing;
    }

    WardrobeItem owned(CurrentUser user, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + pieceId);
        return w;
    }

    Map<String, Object> move(CurrentUser user, UUID pieceId, String rawAddress) {
        WardrobeItem w = owned(user, pieceId);
        RoomAddress a = RoomAddress.parse(rawAddress).orElseThrow(() -> ApiException.badRequest("ENDERECO_INVALIDO",
                Msg.t("room.endereco_invalido_use_door_n")));
        RoomLayout layout = furniture.layout(user.id());
        if (!coherent(w, a, labels(layout))) throw ApiException.badRequest("CATEGORIA_INCOMPATIVEL", "Este endereço não guarda peças desta categoria.");
        if (!a.zone().equals("chair")) {
            Map<String, Object> module = module(layout, a.moduleId()).orElseThrow(() -> new ApiException(409, "MODULO_INDISPONIVEL",
                    Msg.t("room.este_modulo_nao_existe_no", layout.getLevel())));
            int cap = a.zone().equals("drawer") ? Math.min(capacity(module), drawerCapacity(w.getCategory())) : capacity(module);
            int pos = a.zone().equals("door") ? a.sub() : a.index();
            if (a.zone().equals("drawer")) {
                boolean differentCategory = storage.findByUserId(user.id()).stream()
                        .filter(e -> !e.getWardrobeItemId().equals(pieceId) && e.getAddress().equals(a.toString()))
                        .map(e -> pieces.findById(e.getWardrobeItemId()).orElse(null))
                        .anyMatch(other -> other != null && !w.getCategory().equals(other.getCategory()));
                if (differentCategory) throw ApiException.badRequest("GAVETA_CATEGORIA_DIFERENTE", "Esta gaveta guarda peças de outra categoria.");
                long count = storage.findByUserId(user.id()).stream().filter(e -> !e.getWardrobeItemId().equals(pieceId))
                        .filter(e -> e.getAddress().equals(a.toString())).count();
                if (count >= cap) {
                    throw new ApiException(409, "GAVETA_CHEIA", Msg.t("room.a_gaveta_ja_tem_pecas", a.index(), cap));
                }
            } else if (pos < 1 || pos > cap) {
                throw ApiException.badRequest("POSICAO_INVALIDA", Msg.t("room.a_posicao_vai_de_1", cap));
            } else {
                boolean taken = storage.findByUserId(user.id()).stream().filter(e -> !e.getWardrobeItemId().equals(pieceId))
                        .anyMatch(e -> e.getAddress().equals(a.toString()));
                if (taken) {
                    throw new ApiException(409, "POSICAO_OCUPADA", Msg.t("room.ja_existe_uma_peca_nesta"));
                }
            }
        }
        RoomStorageEntry e = storage.findByWardrobeItemId(pieceId)
                .orElseGet(() -> addressing.automaticEntry(user.id(), pieceId, a));
        e.setAddress(a.toString());
        e.setAssignedBy("USER");
        storage.save(e);
        Map<String, String> labels = labels(layout);
        return Map.of("pieceId", pieceId, "address", a.toString(), "label", a.label(labels), "moduleId", a.moduleId(),
                "coherent", coherent(w, a, labels));
    }

    Map<String, String> renameDrawer(CurrentUser user, int drawer, String label) {
        RoomLayout layout = furniture.layout(user.id());
        module(layout, "drawer:" + drawer).orElseThrow(() -> ApiException.notFound("Gaveta"));
        Map<String, String> labels = labels(layout);
        Map<String, String> sources = labelSources(layout);
        String clean = InputSanitizer.clean(label == null ? "" : label, 24);
        if (clean.isBlank()) {
            labels.remove(String.valueOf(drawer));
            sources.remove(String.valueOf(drawer));
        } else {
            labels.put(String.valueOf(drawer), clean);
            sources.put(String.valueOf(drawer), "USER");
        }
        saveLabels(layout, labels, sources);
        layouts.save(layout);
        events.publishEvent(new DomainEvents.RoomOrganized(user.id()));
        return labels;
    }

    /** RF32.CA09 — "Mostrar no quarto": endereço + enquadramento da câmera + destaque com iluminação. */
    Map<String, Object> showInRoom(CurrentUser user, UUID pieceId) {
        owned(user, pieceId);
        Location loc = addressing.locate(user.id(), pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("room.posicao")));
        return Map.of("pieceId", pieceId, "address", loc.address().toString(), "label", loc.label(), "moduleId", loc.moduleId(),
                "camera", Map.of("target", loc.moduleId(), "highlight", loc.address().toString(), "lighting", "spot", "open", true));
    }

    /** Loft — guardar/retirar peças do maleiro de estação (RF35 §5.3). */
    Map<String, Object> seasonStorage(CurrentUser user, List<UUID> pieceIds, boolean store) {
        if (!furniture.levelOf(user.id()).atLeast(FaiPointsService.Level.LOFT)) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("room.a_troca_de_estacao_e"));
        }
        RoomLayout layout = furniture.layout(user.id());
        Map<String, String> labels = labels(layout);
        List<RoomStorageEntry> entries = storage.findByUserId(user.id());
        Occupancy occ = Occupancy.of(entries, pieces.findByUserIdOrderByCreatedAtDesc(user.id()));
        int moved = 0;
        for (UUID id : pieceIds) {
            WardrobeItem w = owned(user, id);
            RoomStorageEntry e = entries.stream().filter(x -> x.getWardrobeItemId().equals(id)).findFirst().orElse(null);
            if (e == null) {
                continue;
            }
            occ.taken().remove(e.getAddress());
            RoomAddress a;
            if (store) {
                int n = 1;
                while (occ.taken().contains("season:" + n)) {
                    n++;
                }
                a = RoomAddress.of("season", n);
                occ.add(a, w.getCategory());
            } else {
                a = place(w, layout, labels, occ);
            }
            e.setAddress(a.toString());
            e.setAssignedBy("USER");
            storage.save(e);
            moved++;
        }
        return Map.of("moved", moved, "stored", store);
    }
}
