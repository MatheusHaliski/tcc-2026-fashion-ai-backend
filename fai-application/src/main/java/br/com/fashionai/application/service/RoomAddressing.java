package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.service.RoomPlacement.Occupancy;
import br.com.fashionai.application.service.RoomService.Location;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.HANGERS_PER_DOOR;
import static br.com.fashionai.application.service.RoomService.coherent;
import static br.com.fashionai.application.service.RoomService.drawerCapacity;
import static br.com.fashionai.application.service.RoomModules.labels;
import static br.com.fashionai.application.service.RoomPlacement.place;

/** Meu Quarto — endereçamento estável (§1.1): toda peça com endereço, reparo de endereços incoerentes, atribuição automática e localização. */
final class RoomAddressing {
    private final RoomStorageEntryRepository storage;
    private final WardrobeItemRepository pieces;
    private final RoomFurniture furniture;

    RoomAddressing(RoomContext ctx) {
        this.storage = ctx.storage;
        this.pieces = ctx.pieces;
        this.furniture = ctx.furniture;
    }

    /** Garante que toda peça do acervo tem endereço (peças anteriores ao quarto recebem posição automática). */
    List<RoomStorageEntry> entries(UUID userId, List<WardrobeItem> all) {
        RoomLayout layout = furniture.layout(userId);
        List<RoomStorageEntry> entries = new ArrayList<>(storage.findByUserId(userId));
        Set<UUID> known = entries.stream().map(RoomStorageEntry::getWardrobeItemId).collect(Collectors.toSet());
        Set<UUID> alive = all.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        entries.removeIf(e -> {
            if (!alive.contains(e.getWardrobeItemId())) {
                storage.delete(e);
                return true;
            }
            return false;
        });
        Map<String, String> labels = labels(layout);
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        Occupancy occ = new Occupancy(new HashSet<>(), new HashMap<>(), new HashMap<>());
        List<RoomStorageEntry> repair = new ArrayList<>();
        for (RoomStorageEntry entry : entries) {
            WardrobeItem w = byId.get(entry.getWardrobeItemId());
            RoomAddress address = RoomAddress.parse(entry.getAddress()).orElse(null);
            boolean valid = address != null && coherent(w, address, labels)
                && (!address.zone().equals("door") || address.sub() <= HANGERS_PER_DOOR)
                && (!address.zone().equals("drawer") || occ.drawerCount().getOrDefault(String.valueOf(address.index()), 0) < drawerCapacity(w.getCategory())
                    && (occ.drawerCategory().get(String.valueOf(address.index())) == null || w.getCategory().equals(occ.drawerCategory().get(String.valueOf(address.index())))));
            if (!valid) {
                repair.add(entry);
            } else occ.add(address, w.getCategory());
        }
        // Hibernate inserts before deletes: replacing an existing row with the same unique piece ID fails at flush.
        // Repair its address in place, preserving the row ID, timestamps and one-row-per-piece invariant.
        for (RoomStorageEntry entry : repair) {
            WardrobeItem w = byId.get(entry.getWardrobeItemId());
            entry.setAddress(place(w, layout, labels, occ).toString());
            entry.setAssignedBy("AUTO");
            storage.save(entry);
        }
        for (WardrobeItem w : all) {
            if (!known.contains(w.getId())) {
                RoomAddress proposed = place(w, layout, labels, occ);
                RoomStorageEntry e = automaticEntry(userId, w.getId(), proposed);
                entries.add(e);
                known.add(w.getId());
            }
        }
        return entries;
    }

    RoomAddress autoAssign(UUID userId, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        RoomLayout layout = furniture.layout(userId);
        Optional<RoomStorageEntry> existing = storage.findByWardrobeItemId(pieceId);
        if (existing.isPresent()) {
            return RoomAddress.parse(existing.get().getAddress()).orElseThrow();
        }
        Occupancy occ = Occupancy.of(storage.findByUserId(userId), pieces.findByUserIdOrderByCreatedAtDesc(userId));
        RoomAddress a = place(w, layout, labels(layout), occ);
        RoomStorageEntry entry = automaticEntry(userId, pieceId, a);
        return RoomAddress.parse(entry.getAddress()).orElseThrow();
    }

    RoomStorageEntry automaticEntry(UUID userId, UUID pieceId, RoomAddress address) {
        storage.insertAutomaticIfAbsent(UUID.randomUUID().toString(), userId.toString(), pieceId.toString(), address.toString());
        // Locking read sees a concurrent winner even under MySQL REPEATABLE READ.
        return storage.findFirstByWardrobeItemId(pieceId).orElseThrow();
    }

    void onPieceDeleted(DomainEvents.PieceDeleted ev) {
        storage.deleteByWardrobeItemId(ev.pieceId());
    }

    /** Endereço de uma peça (Copilot RF10.CA09, Vista-me RF33.CA10). */
    Optional<Location> locate(UUID userId, UUID pieceId) {
        RoomLayout layout = furniture.layout(userId);
        Map<String, String> labels = labels(layout);
        return storage.findByWardrobeItemId(pieceId).filter(e -> e.getUserId().equals(userId))
                .flatMap(e -> RoomAddress.parse(e.getAddress()))
                .or(() -> pieces.findById(pieceId).filter(w -> w.getUser().getId().equals(userId)).map(w -> autoAssign(userId, pieceId)))
                .map(a -> new Location(a, a.label(labels), a.moduleId()));
    }

    Map<UUID, Location> locateAll(UUID userId) {
        RoomLayout layout = furniture.layout(userId);
        Map<String, String> labels = labels(layout);
        Map<UUID, Location> out = new HashMap<>();
        for (RoomStorageEntry e : storage.findByUserId(userId)) {
            RoomAddress.parse(e.getAddress()).ifPresent(a -> out.put(e.getWardrobeItemId(), new Location(a, a.label(labels), a.moduleId())));
        }
        return out;
    }

    /** Peças guardadas fora de estação (Penthouse) — o Vista-me as ignora (RF35 §5.3). */
    Set<UUID> outOfSeason(UUID userId) {
        return storage.findByUserId(userId).stream().filter(e -> e.getAddress().startsWith("season:"))
                .map(RoomStorageEntry::getWardrobeItemId).collect(Collectors.toSet());
    }
}
