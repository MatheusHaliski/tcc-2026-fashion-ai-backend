package br.com.fashionai.application.service;

import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.DEFAULT_DRAWER_LABELS;
import static br.com.fashionai.application.service.RoomService.drawerCapacity;
import static br.com.fashionai.application.service.RoomModules.capacity;
import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.modules;

/**
 * Meu Quarto — atribuição automática (RF32.CA02): ocupação atual do móvel e a primeira posição livre coerente com o
 * tipo da peça (cabide, gaveta por categoria, vitrines); sem posição livre, a Cadeira (CA07). Regras puras.
 */
final class RoomPlacement {
    private RoomPlacement() {
    }

    record Occupancy(Set<String> taken, Map<String, Integer> drawerCount, Map<String, String> drawerCategory) {
        static Occupancy of(Collection<RoomStorageEntry> entries, List<WardrobeItem> all) {
            Set<String> taken = new HashSet<>();
            Map<String, Integer> drawers = new HashMap<>();
            Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
            Map<String, String> categories = new HashMap<>();
            for (RoomStorageEntry e : entries) {
                taken.add(e.getAddress());
                RoomAddress.parse(e.getAddress()).filter(a -> a.zone().equals("drawer"))
                        .ifPresent(a -> {
                            drawers.merge(String.valueOf(a.index()), 1, Integer::sum);
                            WardrobeItem w = byId.get(e.getWardrobeItemId());
                            if (w != null) categories.put(String.valueOf(a.index()), w.getCategory());
                        });
            }
            return new Occupancy(taken, drawers, categories);
        }

        void add(RoomAddress a, String category) {
            taken.add(a.toString());
            if (a.zone().equals("drawer")) {
                drawerCount.merge(String.valueOf(a.index()), 1, Integer::sum);
                drawerCategory.put(String.valueOf(a.index()), category);
            }
        }
    }

    private static Optional<RoomAddress> freeIn(RoomLayout layout, String moduleId, String zone, Occupancy occ) {
        return module(layout, moduleId).flatMap(m -> {
            for (int k = 1; k <= capacity(m); k++) {
                RoomAddress a = RoomAddress.of(zone, k);
                if (!occ.taken().contains(a.toString())) {
                    return Optional.of(a);
                }
            }
            return Optional.empty();
        });
    }

    private static Optional<RoomAddress> freeHanger(RoomLayout layout, int door, Occupancy occ) {
        return module(layout, "door:" + door).flatMap(m -> {
            for (int k = 1; k <= capacity(m); k++) {
                RoomAddress a = RoomAddress.door(door, k);
                if (!occ.taken().contains(a.toString())) {
                    return Optional.of(a);
                }
            }
            return Optional.empty();
        });
    }

    private static Optional<RoomAddress> freeDrawer(RoomLayout layout, Map<String, String> labels, Occupancy occ, String preferred,
                                             boolean allowSpecial, String category) {
        List<Map<String, Object>> drawers = modules(layout).stream().filter(m -> "DRAWER".equals(m.get("slotType"))).toList();
        Set<String> special = DEFAULT_DRAWER_LABELS.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        // 1) gaveta com a categoria preferida; 2) gaveta sem rótulo; 3) qualquer gaveta que não seja de categoria especial
        for (int pass = 0; pass < 3; pass++) {
            for (Map<String, Object> m : drawers) {
                String idx = String.valueOf(m.get("id")).substring("drawer:".length());
                String label = labels.get(idx);
                boolean ok = switch (pass) {
                    case 0 -> preferred != null && label != null && label.equalsIgnoreCase(preferred);
                    case 1 -> label == null;
                    default -> allowSpecial || label == null || !special.contains(label.toLowerCase(Locale.ROOT));
                };
                if (ok && (occ.drawerCategory().get(idx) == null || category.equals(occ.drawerCategory().get(idx)))
                        && occ.drawerCount().getOrDefault(idx, 0) < Math.min(capacity(m), drawerCapacity(category))) {
                    return Optional.of(RoomAddress.of("drawer", Integer.parseInt(idx)));
                }
            }
        }
        return Optional.empty();
    }

    /** Posição automática coerente com o tipo (CA02); sem posição livre → Cadeira (CA07). */
    static RoomAddress place(WardrobeItem w, RoomLayout layout, Map<String, String> labels, Occupancy occ) {
        String cat = RoomPlacementRules.nz(w.getCategory());
        String sub = RoomPlacementRules.nz(w.getSubcategory());
        Optional<RoomAddress> found = Optional.empty();
        switch (cat) {
            case "upper_piece", "full_body_piece" -> {
                for (int d : RoomPlacementRules.hangerDoorOrder(cat, sub)) {
                    found = freeHanger(layout, d, occ);
                    if (found.isPresent()) {
                        break;
                    }
                }
            }
            case "shoes_piece" -> found = freeDrawer(layout, labels, occ, null, true, cat);
            case "accessory_piece" -> {
                if (RoomPlacementRules.BAGS.contains(sub)) {
                    found = freeIn(layout, "bags", "bags", occ);
                } else if (RoomPlacementRules.JEWELRY.contains(sub)) {
                    found = freeIn(layout, "jewelry", "jewelry", occ);
                }
                if (found.isEmpty()) {
                    found = freeDrawer(layout, labels, occ, RoomPlacementRules.preferredDrawerLabel(w), false, cat);
                }
            }
            default -> found = freeDrawer(layout, labels, occ, RoomPlacementRules.preferredDrawerLabel(w), false, cat);
        }
        if (found.isEmpty() && Set.of("lower_piece", "accessory_piece", "shoes_piece").contains(cat)) {
            found = freeDrawer(layout, labels, occ, null, true, cat);
        }
        RoomAddress a = found.orElseGet(() -> {
            int n = 1;
            while (occ.taken().contains("chair:" + n)) {
                n++;
            }
            return RoomAddress.of("chair", n);
        });
        occ.add(a, w.getCategory());
        return a;
    }
}
