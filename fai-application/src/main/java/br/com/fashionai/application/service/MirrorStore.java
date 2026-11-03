package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.MirrorService.PieceRestrictionProvider;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Acesso ao estado do espelho e ao acervo do dono: estado gravado, peças carregadas (só as próprias) e o
 * acervo elegível com a restrição do desafio ativo (RF33 §2.2 passo 2).
 */
final class MirrorStore {
    private final MirrorStateRepository mirrors;
    private final WardrobeItemRepository pieces;
    private final WardrobeService wardrobe;
    private final RoomService room;
    private final ObjectProvider<PieceRestrictionProvider> restrictions;

    MirrorStore(MirrorStateRepository mirrors, WardrobeItemRepository pieces, WardrobeService wardrobe, RoomService room,
                ObjectProvider<PieceRestrictionProvider> restrictions) {
        this.mirrors = mirrors;
        this.pieces = pieces;
        this.wardrobe = wardrobe;
        this.room = room;
        this.restrictions = restrictions;
    }

    MirrorState stateEntity(UUID userId) {
        return mirrors.findByUserId(userId).orElseGet(() -> {
            MirrorState s = new MirrorState();
            s.setUserId(userId);
            s.setSlotsJson("{}");
            s.setShownCombinationsJson("[]");
            return mirrors.save(s);
        });
    }

    /** slots_json: upper/lower/dress/shoes/outer_layer → id; accessory → [ids]; origin, prompt, interpretation. */
    Map<String, Object> slots(MirrorState s) {
        return Json.map(s.getSlotsJson());
    }

    Map<UUID, WardrobeItem> load(UUID userId, List<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return pieces.findByIdIn(ids).stream().filter(w -> w.getUser().getId().equals(userId))
                .collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a, LinkedHashMap::new));
    }

    // ================================================================== elegibilidade (RF33 §2.2 passo 2)
    Optional<PieceRestrictionProvider.Restriction> restriction(UUID userId) {
        return restrictions.orderedStream().map(p -> p.restriction(userId)).filter(Optional::isPresent).map(Optional::get).findFirst();
    }

    /** Só peças disponíveis (RF31.CA02), dentro da estação (Penthouse) e permitidas pelo desafio ativo (RF36.CA14). */
    List<WardrobeItem> eligible(UUID userId) {
        Set<UUID> outOfSeason = room.outOfSeason(userId);
        Optional<PieceRestrictionProvider.Restriction> r = restriction(userId);
        return wardrobe.eligible(userId).stream()
                .filter(w -> !w.isForSale())
                .filter(w -> !outOfSeason.contains(w.getId()))
                .filter(w -> r.isEmpty() || r.get().allowedPieceIds().contains(w.getId()))
                .toList();
    }
}
